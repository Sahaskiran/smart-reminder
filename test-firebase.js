require('dotenv').config();
const { db } = require('./src/firebase');
const store = require('./src/store');
const checker = require('./src/checker');

async function runTest() {
  console.log('==================================================');
  console.log('Firebase connection test starting...');
  console.log('==================================================');

  try {
    // 1. Fetch collections list
    const collections = await db.listCollections();
    console.log('Successfully connected to Firestore! Collections present:');
    collections.forEach(col => console.log(` - ${col.id}`));

    // 2. Try creating a mock user
    const mockUid = 'test-uid-' + Date.now();
    console.log(`\nCreating mock user with uid: ${mockUid}`);
    await store.updateUserProfile(mockUid, {
      email: 'mock-user@gmail.com',
      leetcodeUsername: 'sahaskiran80',
      streak: { current: 0, longest: 0, lastActiveDate: null },
      createdAt: new Date().toISOString()
    });
    console.log('Mock user profile created successfully!');

    // 3. Retrieve user profile
    const profile = await store.getUserProfile(mockUid);
    console.log('Retrieved user profile from DB:', JSON.stringify(profile));

    // 4. Test checking LeetCode activity
    console.log('\nChecking LeetCode activity for mock user...');
    const checkResult = await checker.checkAll(mockUid);
    console.log('Activity check result:', JSON.stringify(checkResult));

    // 5. Test history sync
    console.log('\nSyncing historical calendar for mock user...');
    const syncResult = await checker.syncHistory(mockUid);
    console.log('Sync history result:', JSON.stringify(syncResult));

    // 6. Retrieve today's activity status
    const today = await store.getToday(mockUid);
    console.log("\nToday's status post-sync:", JSON.stringify(today));

    // 7. Clean up mock user data
    console.log('\nCleaning up mock database documents...');
    await db.collection('users').doc(mockUid).delete();
    await db.collection('activity_logs').doc(`${mockUid}_${store.getTodayIST()}`).delete();
    
    // Delete synced days
    const logsSnapshot = await db.collection('activity_logs')
      .where('userId', '==', mockUid)
      .get();
    const batch = db.batch();
    logsSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('Cleanup finished successfully!');

    console.log('\n==================================================');
    console.log('🎉 All Firebase tests passed successfully!');
    console.log('==================================================');
  } catch (err) {
    console.error('\n❌ Firebase test failed:', err);
  }
}

runTest();
