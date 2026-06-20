const cron = require('node-cron');
const checker = require('./checker');
const mailer = require('./mailer');
const store = require('./store');

let scheduledJobs = [];

/**
 * Run the activity check and send reminder if needed
 * @param {string} timeLabel - Human-readable time label (e.g., "9:00 PM")
 */
async function runCheck(timeLabel) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[Scheduler] ⏰ Running check at ${timeLabel}`);
  console.log(`${'='.repeat(50)}`);

  try {
    const result = await checker.checkAll();
    const todayData = store.getToday();

    if (result.solved) {
      console.log(`[Scheduler] ✅ Goal met! Platform: ${result.platform}`);

      // Send congratulatory email once today if not already sent
      if (!todayData.activity?.congratsSent) {
        console.log('[Scheduler] Sending goal completion email');
        const mailSent = await mailer.sendStreakUpdate({
          streak: todayData.streak.current,
          platform: result.platform,
          problemTitle: result.details?.problems?.[0]?.title || result.details?.problems?.[0]?.name || null
        });
        if (mailSent) {
          store.updateToday({ congratsSent: true });
        }
      }
      return;
    }

    // No activity — send reminder
    const reminderCount = store.incrementReminders();
    console.log(`[Scheduler] ❌ No activity detected. Sending reminder #${reminderCount}`);

    await mailer.sendReminder({
      streak: todayData.streak.current,
      reminderCount,
      time: timeLabel
    });

  } catch (err) {
    console.error(`[Scheduler] Error during check:`, err);
  }
}

/**
 * Initialize the cron scheduler
 * Runs at 9:00 PM, 10:00 PM, 11:00 PM IST and 12:00 AM IST
 */
function initScheduler() {
  console.log('[Scheduler] 📅 Initializing reminder schedule (IST)');
  console.log('[Scheduler]   • 9:00 PM  (21:00)');
  console.log('[Scheduler]   • 10:00 PM (22:00)');
  console.log('[Scheduler]   • 11:00 PM (23:00)');
  console.log('[Scheduler]   • 12:00 AM (00:00)');

  // Schedule with timezone-aware cron (node-cron supports timezone option)
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
  runCheck
};
