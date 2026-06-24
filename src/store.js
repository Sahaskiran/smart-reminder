const { db } = require('./firebase');

// Helper to get today's date string in IST (YYYY-MM-DD)
function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
  const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return istDate.toISOString().split('T')[0];
}

// Helper to get yesterday's date string in IST (YYYY-MM-DD)
function getYesterdayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  istDate.setDate(istDate.getDate() - 1);
  return istDate.toISOString().split('T')[0];
}

/**
 * Get a user's profile from Firestore
 */
async function getUserProfile(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  return userDoc.data();
}

/**
 * Update a user's profile fields
 */
async function updateUserProfile(userId, update) {
  await db.collection('users').doc(userId).set(update, { merge: true });
}

/**
 * Get today's activity record for a specific user
 */
async function getToday(userId) {
  const today = getTodayIST();
  const docId = `${userId}_${today}`;
  const logDoc = await db.collection('activity_logs').doc(docId).get();
  const userProfile = await getUserProfile(userId);

  let streak = userProfile ? (userProfile.streak || { current: 0, longest: 0, lastActiveDate: null }) : { current: 0, longest: 0, lastActiveDate: null };

  const yesterday = getYesterdayIST();
  if (streak.lastActiveDate && streak.lastActiveDate !== today && streak.lastActiveDate !== yesterday) {
    if (streak.current > 0) {
      streak.current = 0;
      await db.collection('users').doc(userId).set({ streak }, { merge: true });
    }
  }

  return {
    date: today,
    activity: logDoc.exists ? logDoc.data() : null,
    streak
  };
}

/**
 * Update today's activity for a specific user, recalculating streaks
 */
async function updateToday(userId, update) {
  const today = getTodayIST();
  const docId = `${userId}_${today}`;
  
  const logRef = db.collection('activity_logs').doc(docId);
  const logDoc = await logRef.get();
  
  const existing = logDoc.exists ? logDoc.data() : {
    solved: false,
    platform: null,
    solvedAt: null,
    remindersSent: 0,
    congratsSent: false,
    manualEntry: false
  };

  const newActivity = {
    userId,
    date: today,
    ...existing,
    ...update
  };

  await logRef.set(newActivity);

  // Update streak if solved
  if (update.solved) {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};
    const streak = userData.streak || { current: 0, longest: 0, lastActiveDate: null };

    const yesterday = getYesterdayIST();
    // Check if solved yesterday
    const yesterdayDocId = `${userId}_${yesterday}`;
    const yesterdayLogDoc = await db.collection('activity_logs').doc(yesterdayDocId).get();
    const wasActiveYesterday = yesterdayLogDoc.exists && yesterdayLogDoc.data().solved === true;

    if (streak.lastActiveDate === today) {
      // Streak already updated today
    } else if (streak.lastActiveDate === yesterday || wasActiveYesterday) {
      streak.current += 1;
    } else {
      streak.current = 1;
    }

    streak.lastActiveDate = today;
    streak.longest = Math.max(streak.longest, streak.current);

    await userRef.set({ streak }, { merge: true });
  }
}

/**
 * Increment the reminder count for a specific user today
 */
async function incrementReminders(userId) {
  const today = getTodayIST();
  const docId = `${userId}_${today}`;
  const logRef = db.collection('activity_logs').doc(docId);
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(logRef);
    if (!doc.exists) {
      transaction.set(logRef, {
        userId,
        date: today,
        solved: false,
        platform: null,
        solvedAt: null,
        remindersSent: 1,
        congratsSent: false,
        manualEntry: false
      });
    } else {
      const currentReminders = doc.data().remindersSent || 0;
      transaction.update(logRef, { remindersSent: currentReminders + 1 });
    }
  });

  const finalDoc = await logRef.get();
  return finalDoc.data().remindersSent;
}

/**
 * Get history for the last N days for a specific user
 */
async function getHistory(userId, numDays = 90) {
  const userProfile = await getUserProfile(userId);
  const result = [];
  
  const logsSnapshot = await db.collection('activity_logs')
    .where('userId', '==', userId)
    .orderBy('date', 'desc')
    .limit(numDays)
    .get();

  const logsMap = {};
  logsSnapshot.forEach(doc => {
    const data = doc.data();
    logsMap[data.date] = data;
  });

  for (let i = 0; i < numDays; i++) {
    const date = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset + date.getTimezoneOffset() * 60 * 1000);
    istDate.setDate(istDate.getDate() - i);
    const dateStr = istDate.toISOString().split('T')[0];

    const dayData = logsMap[dateStr] || { solved: false, platform: null, remindersSent: 0 };
    result.push({
      date: dateStr,
      solved: dayData.solved,
      platform: dayData.platform,
      solvedAt: dayData.solvedAt,
      remindersSent: dayData.remindersSent
    });
  }

  const streak = userProfile ? (userProfile.streak || { current: 0, longest: 0, lastActiveDate: null }) : { current: 0, longest: 0, lastActiveDate: null };
  const totalSolved = Object.values(logsMap).filter(d => d.solved).length;

  return {
    days: result,
    streak,
    totalSolved
  };
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  getToday,
  updateToday,
  incrementReminders,
  getHistory,
  getTodayIST,
  getYesterdayIST
};
