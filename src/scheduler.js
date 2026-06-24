const cron = require('node-cron');
const checker = require('./checker');
const mailer = require('./mailer');
const store = require('./store');
const { db } = require('./firebase');

let scheduledJobs = [];

/**
 * Run the activity check and send reminder if needed for a specific user
 * @param {Object} user - User document data including id, email, leetcodeUsername
 * @param {string} timeLabel - Human-readable time label (e.g., "9:00 PM")
 */
async function runCheckForUser(user, timeLabel) {
  const userId = user.id;
  const userEmail = user.email;

  try {
    const result = await checker.checkAll(userId);
    const todayData = await store.getToday(userId);

    if (result.solved) {
      console.log(`[Scheduler] ✅ User ${userEmail}: Goal met! Platform: ${result.platform}`);

      // Send congratulatory email once today if not already sent
      if (!todayData.activity?.congratsSent) {
        console.log(`[Scheduler] Sending goal completion email to ${userEmail}`);
        const mailSent = await mailer.sendStreakUpdate(userEmail, {
          streak: todayData.streak.current,
          platform: result.platform,
          problemTitle: result.details?.problems?.[0]?.title || result.details?.problems?.[0]?.name || null
        });
        if (mailSent) {
          await store.updateToday(userId, { congratsSent: true });
        }
      }
      return;
    }

    // No activity — send reminder
    const reminderCount = await store.incrementReminders(userId);
    console.log(`[Scheduler] ❌ User ${userEmail}: No activity. Sending reminder #${reminderCount}`);

    await mailer.sendReminder(userEmail, {
      streak: todayData.streak.current,
      reminderCount,
      time: timeLabel
    });

  } catch (err) {
    console.error(`[Scheduler] Error during check for user ${userEmail}:`, err);
  }
}

/**
 * Run the activity check and send reminder if needed for all active users
 * @param {string} timeLabel - Human-readable time label (e.g., "9:00 PM")
 */
async function runCheck(timeLabel) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[Scheduler] ⏰ Running check at ${timeLabel} for all users`);
  console.log(`${'='.repeat(50)}`);

  try {
    const usersSnapshot = await db.collection('users').get();
    const activeUsers = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.leetcodeUsername) {
        activeUsers.push({ id: doc.id, ...data });
      }
    });

    console.log(`[Scheduler] Found ${activeUsers.length} users with LeetCode profiles to check.`);

    // Run checks sequentially to avoid rate-limiting and logs overlapping
    for (const user of activeUsers) {
      await runCheckForUser(user, timeLabel);
    }

    console.log(`[Scheduler] Check finished for all users!`);
  } catch (err) {
    console.error(`[Scheduler] Error running global check:`, err);
  }
}

/**
 * Initialize the cron scheduler
 * Runs at 9:00 PM, 10:00 PM, 11:00 PM IST and 12:00 AM IST
 */
function initScheduler() {
  console.log('[Scheduler] 📅 Initializing reminder schedule (IST) for multiple users');
  console.log('[Scheduler]   • 9:00 PM  (21:00)');
  console.log('[Scheduler]   • 10:00 PM (22:00)');
  console.log('[Scheduler]   • 11:00 PM (23:00)');
  console.log('[Scheduler]   • 12:00 AM (00:00)');

  // Schedule with timezone-aware cron
  scheduledJobs = [
    cron.schedule('0 21 * * *', () => runCheck('9:00 PM'), { timezone: 'Asia/Kolkata' }),
    cron.schedule('0 22 * * *', () => runCheck('10:00 PM'), { timezone: 'Asia/Kolkata' }),
    cron.schedule('0 23 * * *', () => runCheck('11:00 PM'), { timezone: 'Asia/Kolkata' }),
    cron.schedule('0 0 * * *', () => runCheck('12:00 AM'), { timezone: 'Asia/Kolkata' })
  ];

  console.log('[Scheduler] ✅ All cron jobs scheduled successfully\n');
}

/**
 * Stop all scheduled jobs
 */
function stopScheduler() {
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];
  console.log('[Scheduler] 🛑 All cron jobs stopped');
}

module.exports = {
  initScheduler,
  stopScheduler,
  runCheck,
  runCheckForUser
};
