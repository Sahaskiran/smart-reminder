require('dotenv').config();

const express = require('express');
const path = require('path');
const { initScheduler, runCheckForUser } = require('./src/scheduler');
const mailer = require('./src/mailer');
const store = require('./src/store');
const checker = require('./src/checker');
const { auth } = require('./src/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Firebase Auth Authentication Middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
}

// ──────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────

/**
 * GET /api/user/status
 * Returns today's activity status and streak info
 */
app.get('/api/user/status', authenticate, async (req, res) => {
  try {
    const { uid, email } = req.user;
    
    // Check if user profile exists, if not, create it
    let userProfile = await store.getUserProfile(uid);
    if (!userProfile) {
      userProfile = {
        email: email,
        leetcodeUsername: null,
        streak: { current: 0, longest: 0, lastActiveDate: null },
        createdAt: new Date().toISOString()
      };
      await store.updateUserProfile(uid, userProfile);
    }

    if (!userProfile.leetcodeUsername) {
      return res.json({
        success: true,
        data: {
          needSetup: true,
          email: userProfile.email
        }
      });
    }

    const today = await store.getToday(uid);
    const totalProblemsSolved = await checker.getUserProblemsSolved(userProfile.leetcodeUsername);
    res.json({
      success: true,
      data: {
        needSetup: false,
        date: today.date,
        solved: today.activity?.solved || false,
        platform: today.activity?.platform || null,
        solvedAt: today.activity?.solvedAt || null,
        remindersSent: today.activity?.remindersSent || 0,
        manualEntry: today.activity?.manualEntry || false,
        streak: today.streak,
        leetcodeUsername: userProfile.leetcodeUsername,
        totalProblemsSolved
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/user/history
 * Returns historical data for dashboard (last 90 days by default)
 */
app.get('/api/user/history', authenticate, async (req, res) => {
  try {
    const { uid } = req.user;
    const userProfile = await store.getUserProfile(uid);
    const totalProblemsSolved = await checker.getUserProblemsSolved(userProfile?.leetcodeUsername);
    const days = parseInt(req.query.days) || 90;
    const history = await store.getHistory(uid, days);
    res.json({
      success: true,
      data: {
        ...history,
        totalProblemsSolved
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/verify-leetcode
 * Verifies if a LeetCode username exists and associates it with the account
 */
app.post('/api/user/verify-leetcode', authenticate, async (req, res) => {
  try {
    const { uid } = req.user;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: 'LeetCode username is required' });
    }

    console.log(`[API] Verifying LeetCode profile: ${username} for user ${uid}`);

    // Verify username via public check first
    const testCheck = await checker.checkLeetCode(username);
    
    // If it threw an authentication or profile error, check if it's a valid profile
    if (testCheck.details?.error && testCheck.details.error.includes('does not exist')) {
      return res.status(400).json({ success: false, error: 'LeetCode username does not exist' });
    }

    // Save username in user profile
    await store.updateUserProfile(uid, { leetcodeUsername: username });

    // Sync history
    const syncResult = await checker.syncHistory(uid);

    res.json({
      success: true,
      message: 'LeetCode profile verified and synchronized!',
      data: syncResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/check-now
 * Manually trigger an activity check
 */
app.post('/api/user/check-now', authenticate, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log(`\n[API] Manual check triggered for user ${uid}`);
    
    const result = await checker.checkAll(uid);
    const today = await store.getToday(uid);
    
    res.json({
      success: true,
      data: {
        ...result,
        streak: today.streak
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/test-reminder
 * Manually trigger a test email reminder/update
 */
app.post('/api/user/test-reminder', authenticate, async (req, res) => {
  try {
    const { uid, email } = req.user;
    console.log(`\n[API] Manual test-reminder triggered for user ${uid}`);
    
    const result = await checker.checkAll(uid);
    const today = await store.getToday(uid);
    const userProfile = await store.getUserProfile(uid);

    if (result.solved) {
      console.log(`[API] Goal met: Force-sending completion email to ${email}`);
      const mailSent = await mailer.sendStreakUpdate(email, {
        streak: today.streak.current,
        platform: result.platform || 'leetcode',
        problemTitle: result.details?.problems?.[0]?.title || result.details?.problems?.[0]?.name || null
      });

      await store.updateToday(uid, { congratsSent: true });

      if (mailSent) {
        return res.json({ success: true, message: 'Force-sent completion email successfully!' });
      } else {
        return res.status(500).json({ success: false, error: 'Failed to send completion email.' });
      }
    } else {
      console.log(`[API] Goal not met: Force-sending reminder email to ${email}`);
      const reminderCount = (today.activity?.remindersSent || 0) + 1;
      const mailSent = await mailer.sendReminder(email, {
        streak: today.streak.current,
        reminderCount,
        time: 'Manual Test'
      });

      if (mailSent) {
        return res.json({ success: true, message: 'Force-sent reminder email successfully!' });
      } else {
        return res.status(500).json({ success: false, error: 'Failed to send reminder email.' });
      }
    }
  } catch (err) {
    console.error('[API] Test reminder failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// Serve dashboard for all other routes
// ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║     🔥 Smart Reminder Multi-User v2.0.0      ║
╠══════════════════════════════════════════════╣
║                                              ║
║  Portal:    http://localhost:${PORT}             ║
║  Database:  Firebase Cloud Firestore         ║
║  SMTP From: ${(process.env.EMAIL_FROM === 'your-email@gmail.com' ? 'not configured' : process.env.EMAIL_FROM || 'not set').padEnd(30)}  ║
║                                              ║
╚══════════════════════════════════════════════╝
  `);

  // Initialize email transporter
  mailer.initTransporter();

  // Initialize the cron scheduler
  initScheduler();
});
