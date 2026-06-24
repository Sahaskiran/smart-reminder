require('dotenv').config();

const express = require('express');
const path = require('path');
const { initScheduler, runCheck } = require('./src/scheduler');
const mailer = require('./src/mailer');
const store = require('./src/store');
const checker = require('./src/checker');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// ──────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────

/**
 * GET /api/status
 * Returns today's activity status and streak info
 */
app.get('/api/status', (req, res) => {
  try {
    const today = store.getToday();
    res.json({
      success: true,
      data: {
        date: today.date,
        solved: today.activity?.solved || false,
        platform: today.activity?.platform || null,
        solvedAt: today.activity?.solvedAt || null,
        remindersSent: today.activity?.remindersSent || 0,
        manualEntry: today.activity?.manualEntry || false,
        streak: today.streak
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/history
 * Returns historical data for dashboard (last 90 days by default)
 */
app.get('/api/history', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const history = store.getHistory(days);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/check-now
 * Manually trigger an activity check (useful for testing)
 */
app.post('/api/check-now', async (req, res) => {
  try {
    console.log('\n[API] Manual check triggered');
    const result = await checker.checkAll();
    const today = store.getToday();
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

app.post('/api/test-reminder', async (req, res) => {
  try {
    console.log('\n[API] Manual test-reminder triggered');
    const result = await checker.checkAll();
    const today = store.getToday();

    if (result.solved) {
      console.log('[API] Goal met: Force-sending completion email');
      const mailSent = await mailer.sendStreakUpdate({
        streak: today.streak.current,
        platform: result.platform || 'leetcode',
        problemTitle: result.details?.problems?.[0]?.title || result.details?.problems?.[0]?.name || null
      });

      // Ensure congratsSent is updated in local store
      store.updateToday({ congratsSent: true });

      if (mailSent) {
        return res.json({ success: true, message: 'Force-sent completion email successfully!' });
      } else {
        return res.status(500).json({ success: false, error: 'Failed to send completion email.' });
      }
    } else {
      console.log('[API] Goal not met: Force-sending reminder email');
      const reminderCount = (today.activity?.remindersSent || 0) + 1;
      const mailSent = await mailer.sendReminder({
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
// Sync LeetCode history
// ──────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  try {
    console.log('\n[API] Syncing LeetCode history...');
    const result = await checker.syncHistory(process.env.LEETCODE_USERNAME);
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
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
║         🔥 Smart Reminder v1.0.0            ║
╠══════════════════════════════════════════════╣
║                                              ║
║  Dashboard: http://localhost:${PORT}             ║
║  LeetCode:  ${(process.env.LEETCODE_USERNAME || 'not set').padEnd(30)}  ║
║  Email:     ${(process.env.EMAIL_FROM === 'your-email@gmail.com' ? 'not configured' : process.env.EMAIL_FROM || 'not set').padEnd(30)}  ║
║                                              ║
╚══════════════════════════════════════════════╝
  `);

  // Initialize email transporter
  mailer.initTransporter();

  // Initialize the cron scheduler
  initScheduler();

  // Log current status
  const today = store.getToday();
  if (today.activity?.solved) {
    console.log(`[Status] ✅ Today's goal already met (${today.activity.platform})`);
  } else {
    console.log(`[Status] ⏳ Waiting for today's coding activity...`);
  }
  console.log(`[Status] 🔥 Current streak: ${today.streak.current} days`);
  console.log(`[Status] 🏆 Longest streak: ${today.streak.longest} days\n`);
});
