require('dotenv').config();
const { runCheck } = require('./scheduler');

async function main() {
  console.log('==================================================');
  console.log('🔥 Smart Reminder: Running Manual Check for All Users...');
  console.log('==================================================');
  
  try {
    // Run the scheduler check pipeline for all users
    await runCheck('Manual Trigger');
    console.log('\n✅ Manual trigger check finished successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Manual trigger check failed:', err);
    process.exit(1);
  }
}

main();
