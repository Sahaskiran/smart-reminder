require('dotenv').config();

const checker = require('./checker');
const mailer = require('./mailer');
const store = require('./store');

async function run() {
  console.log('==================================================');
  console.log('Smart Reminder - Running automated LeetCode check...');
  console.log('==================================================');
  
  // Get current hour in IST to label time
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const hour = istNow.getHours();
  
  let timeLabel = 'Manual Test';
  let isScheduledTime = false;
  
  if (hour === 21) { timeLabel = '9:00 PM'; isScheduledTime = true; }
  else if (hour === 22) { timeLabel = '10:00 PM'; isScheduledTime = true; }
  else if (hour === 23) { timeLabel = '11:00 PM'; isScheduledTime = true; }
  else if (hour === 0) { timeLabel = '12:00 AM'; isScheduledTime = true; }

  // Check if force parameter is passed (e.g. node src/cron-run.js --force)
  const isForce = process.argv.includes('--force');

  try {
    const result = await checker.checkAll();
    const todayData = store.getToday();

    if (result.solved) {
      console.log(`✅ Goal met! Platform: ${result.platform}`);

      // Send congratulatory email once today if not already sent
      if (!todayData.activity?.congratsSent || isForce) {
        console.log('Sending goal completion email...');
        const mailSent = await mailer.sendStreakUpdate({
          streak: todayData.streak.current,
          platform: result.platform,
          problemTitle: result.details?.problems?.[0]?.title || result.details?.problems?.[0]?.name || null
        });
        if (mailSent && !isForce) {
          store.updateToday({ congratsSent: true });
        }
      } else {
        console.log('Goal completion email was already sent today.');
      }
    } else {
      // No activity
      if (isScheduledTime || isForce) {
        const reminderCount = store.incrementReminders();
        console.log(`❌ No activity detected. Sending reminder #${reminderCount} at ${timeLabel}`);

        await mailer.sendReminder({
          streak: todayData.streak.current,
          reminderCount,
          time: timeLabel
        });
      } else {
        console.log('❌ No activity detected. Skipping email reminder (outside scheduled hours).');
      }
    }
    
    console.log('Check finished successfully!');
  } catch (err) {
    console.error('Error running check:', err);
    process.exit(1);
  }
}

run();
