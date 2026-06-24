const https = require('https');
const http = require('http');

/**
 * Make an HTTPS request and return parsed JSON
 */
function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartReminder/1.0',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Get today's start and end timestamps in IST
 */
function getTodayBoundsIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  // Start of today IST (00:00:00)
  const startOfDay = new Date(istNow);
  startOfDay.setHours(0, 0, 0, 0);
  // Convert back to UTC timestamp
  const startTimestamp = Math.floor((startOfDay.getTime() - istOffset - now.getTimezoneOffset() * 60 * 1000) / 1000);

  // End of today IST (23:59:59)
  const endOfDay = new Date(istNow);
  endOfDay.setHours(23, 59, 59, 999);
  const endTimestamp = Math.floor((endOfDay.getTime() - istOffset - now.getTimezoneOffset() * 60 * 1000) / 1000);

  return { startTimestamp, endTimestamp };
}

/**
 * Check LeetCode for today's accepted submissions using GraphQL API
 * @param {string} username - LeetCode username
 * @returns {Object} { solved: boolean, details: Object }
 */
async function checkLeetCode(username) {
  if (!username) {
    return { solved: false, details: { error: 'No LeetCode username configured' } };
  }

  try {
    console.log(`[Checker] Checking LeetCode for user: ${username}`);

    // Query 1: Get recent accepted submissions
    const recentResult = await fetchJSON('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      body: {
        query: `
          query getRecentAcSubmissions($username: String!, $limit: Int) {
            recentAcSubmissionList(username: $username, limit: $limit) {
              id
              title
              titleSlug
              timestamp
            }
          }
        `,
        variables: { username, limit: 20 }
      }
    });

    if (recentResult.errors) {
      console.error('[Checker] LeetCode GraphQL errors:', recentResult.errors);
      return { solved: false, details: { error: recentResult.errors[0]?.message || 'GraphQL error' } };
    }

    const submissions = recentResult.data?.recentAcSubmissionList || [];
    const { startTimestamp, endTimestamp } = getTodayBoundsIST();

    // Filter for today's submissions (timestamps are in seconds)
    const todaySubmissions = submissions.filter(sub => {
      const ts = parseInt(sub.timestamp);
      return ts >= startTimestamp && ts <= endTimestamp;
    });

    if (todaySubmissions.length > 0) {
      console.log(`[Checker] ✅ LeetCode: Found ${todaySubmissions.length} accepted submissions today`);
      return {
        solved: true,
        details: {
          platform: 'leetcode',
          count: todaySubmissions.length,
          problems: todaySubmissions.map(s => ({
            title: s.title,
            slug: s.titleSlug,
            timestamp: s.timestamp
          }))
        }
      };
    }

    // Query 2: Also check submission calendar as backup
    const calendarResult = await fetchJSON('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      body: {
        query: `
          query userProfileCalendar($username: String!, $year: Int) {
            matchedUser(username: $username) {
              userCalendar(year: $year) {
                activeYears
                streak
                totalActiveDays
                submissionCalendar
              }
            }
          }
        `,
        variables: { username, year: new Date().getFullYear() }
      }
    });

    const calendar = calendarResult.data?.matchedUser?.userCalendar;
    if (calendar?.submissionCalendar) {
      try {
        const calMap = JSON.parse(calendar.submissionCalendar);
        // Check if today's start-of-day timestamp exists in calendar
        const todayKey = startTimestamp.toString();
        if (calMap[todayKey] && calMap[todayKey] > 0) {
          console.log(`[Checker] ✅ LeetCode calendar: Found activity today`);
          return {
            solved: true,
            details: {
              platform: 'leetcode',
              count: calMap[todayKey],
              source: 'calendar',
              leetcodeStreak: calendar.streak
            }
          };
        }
      } catch (e) {
        console.error('[Checker] Error parsing LeetCode calendar:', e.message);
      }
    }

    console.log(`[Checker] ❌ LeetCode: No accepted submissions today`);
    return {
      solved: false,
      details: {
        platform: 'leetcode',
        submissionsChecked: submissions.length,
        leetcodeStreak: calendar?.streak || 0
      }
    };

  } catch (err) {
    console.error('[Checker] LeetCode check failed:', err.message);
    return {
      solved: false,
      details: { error: `LeetCode API error: ${err.message}` }
    };
  }
}

/**
 * Check LeetCode for today's activity for a specific user
 */
async function checkAll(userId, forceSync = false) {
  const store = require('./store');
  const today = await store.getToday(userId);

  // If already marked as solved today, no need to check API unless forceSync is requested
  if (today.activity?.solved) {
    console.log(`[Checker] ✅ User ${userId} already solved today (${today.activity.platform})`);
    let currentStreak = today.streak.current;
    let longestStreak = today.streak.longest;

    if (forceSync) {
      console.log(`[Checker] Force sync requested for user ${userId}. Recalculating streaks...`);
      const syncResult = await syncHistory(userId);
      currentStreak = syncResult.streak.current;
      longestStreak = syncResult.streak.longest;
    }

    return {
      solved: true,
      platform: today.activity.platform,
      details: today.activity,
      alreadyRecorded: true,
      streak: {
        current: currentStreak,
        longest: longestStreak
      }
    };
  }

  const userProfile = await store.getUserProfile(userId);
  const leetcodeUsername = userProfile?.leetcodeUsername;

  if (!leetcodeUsername) {
    return { solved: false, details: { error: 'No LeetCode username configured' } };
  }

  const leetcode = await checkLeetCode(leetcodeUsername);

  let solvedToday = false;
  let platform = null;
  let details = leetcode.details;
  let currentStreak = today.streak.current;
  let longestStreak = today.streak.longest;

  if (leetcode.solved) {
    solvedToday = true;
    platform = 'leetcode';
    const now = new Date().toISOString();
    await store.updateToday(userId, {
      solved: true,
      platform: 'leetcode',
      solvedAt: now,
      manualEntry: false
    });
    
    // Always sync history when today becomes solved to compute correct consecutive streaks
    console.log(`[Checker] Goal met today for user ${userId}. Running history sync...`);
    const syncResult = await syncHistory(userId);
    currentStreak = syncResult.streak.current;
    longestStreak = syncResult.streak.longest;
  }

  return {
    solved: solvedToday,
    platform: platform,
    details: details,
    streak: {
      current: currentStreak,
      longest: longestStreak
    }
  };
}

/**
 * Sync historical LeetCode activity from the submission calendar for a specific user
 * Backfills all past active days into activity_logs and recalculates streak in users collection
 */
async function syncHistory(userId) {
  const store = require('./store');
  const { db } = require('./firebase');
  const userProfile = await store.getUserProfile(userId);
  const username = userProfile?.leetcodeUsername;

  if (!username) {
    return { success: false, error: 'No LeetCode username configured' };
  }

  try {
    console.log(`[Sync] Fetching full submission calendar for user: ${username}`);

    const calendarResult = await fetchJSON('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      body: {
        query: `
          query userProfileCalendar($username: String!, $year: Int) {
            matchedUser(username: $username) {
              userCalendar(year: $year) {
                activeYears
                streak
                totalActiveDays
                submissionCalendar
              }
            }
          }
        `,
        variables: { username, year: new Date().getFullYear() }
      }
    });

    const calendar = calendarResult.data?.matchedUser?.userCalendar;
    if (!calendar?.submissionCalendar) {
      return { success: false, error: 'Could not fetch submission calendar' };
    }

    const calMap = JSON.parse(calendar.submissionCalendar);
    let daysAdded = 0;

    // Fetch existing logs from Firestore for this user
    const existingLogsSnapshot = await db.collection('activity_logs')
      .where('userId', '==', userId)
      .get();
    
    const existingDates = new Set();
    existingLogsSnapshot.forEach(doc => {
      existingDates.add(doc.data().date);
    });

    // We'll write new dates using a batch write
    let batch = db.batch();
    let batchCount = 0;
    const allActiveDates = [];

    for (const [timestamp, count] of Object.entries(calMap)) {
      if (count <= 0) continue;

      const utcMs = parseInt(timestamp) * 1000;
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(utcMs + istOffset);
      const dateStr = istDate.toISOString().split('T')[0];
      allActiveDates.push(dateStr);

      if (!existingDates.has(dateStr)) {
        const docId = `${userId}_${dateStr}`;
        const logRef = db.collection('activity_logs').doc(docId);
        
        batch.set(logRef, {
          userId,
          date: dateStr,
          solved: true,
          platform: 'leetcode',
          solvedAt: new Date(utcMs).toISOString(),
          remindersSent: 0,
          congratsSent: true,
          manualEntry: false,
          source: 'calendar-sync'
        });

        daysAdded++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Merge any locally recorded solves that might not be in the calendar yet (or from other platforms)
    existingLogsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.solved && !allActiveDates.includes(data.date)) {
        allActiveDates.push(data.date);
      }
    });

    // Recalculate streak using only dates since registration
    const registrationDate = userProfile.createdAt ? userProfile.createdAt.split('T')[0] : store.getTodayIST();
    const sorted = allActiveDates.filter(d => d >= registrationDate).sort();
    let longestStreak = 0;
    let currentStreak = 0;

    if (sorted.length > 0) {
      const todayIST = store.getTodayIST();
      const yesterdayIST = store.getYesterdayIST();

      function dayDiff(a, b) {
        const msA = Date.UTC(+a.slice(0,4), +a.slice(5,7)-1, +a.slice(8,10));
        const msB = Date.UTC(+b.slice(0,4), +b.slice(5,7)-1, +b.slice(8,10));
        return Math.round((msA - msB) / (24 * 60 * 60 * 1000));
      }

      longestStreak = 1;
      let runLength = 1;

      for (let i = 1; i < sorted.length; i++) {
        if (dayDiff(sorted[i], sorted[i - 1]) === 1) {
          runLength++;
        } else {
          longestStreak = Math.max(longestStreak, runLength);
          runLength = 1;
        }
      }
      longestStreak = Math.max(longestStreak, runLength);

      const mostRecent = sorted[sorted.length - 1];
      if (mostRecent === todayIST || mostRecent === yesterdayIST) {
        currentStreak = 1;
        for (let i = sorted.length - 2; i >= 0; i--) {
          if (dayDiff(sorted[i+1], sorted[i]) === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
      
      // Update user streak in Firestore
      await db.collection('users').doc(userId).set({
        streak: {
          current: currentStreak,
          longest: longestStreak,
          lastActiveDate: mostRecent
        }
      }, { merge: true });
    }

    console.log(`[Sync] ✅ User ${userId}: Synced ${daysAdded} new days. Streak: ${currentStreak} (longest: ${longestStreak})`);
    return {
      success: true,
      daysAdded,
      totalSolvedDays: sorted.length,
      streak: { current: currentStreak, longest: longestStreak }
    };

  } catch (err) {
    console.error(`[Sync] Error syncing user ${userId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch total questions solved directly from LeetCode GraphQL
 */
async function getUserProblemsSolved(username) {
  if (!username) return 0;
  try {
    const result = await fetchJSON('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      body: {
        query: `
          query userProblemsSolved($username: String!) {
            matchedUser(username: $username) {
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `,
        variables: { username }
      }
    });

    const stats = result.data?.matchedUser?.submitStats?.acSubmissionNum || [];
    const allStat = stats.find(s => s.difficulty === 'All');
    return allStat ? allStat.count : 0;
  } catch (err) {
    console.error(`[Checker] Error fetching total solved count for ${username}:`, err.message);
    return 0;
  }
}

module.exports = {
  checkLeetCode,
  checkAll,
  syncHistory,
  getUserProblemsSolved
};
