const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

/**
 * Default data structure for history.json
 */
function getDefaultData() {
  return {
    streak: {
      current: 0,
      longest: 0,
      lastActiveDate: null
    },
    days: {}
  };
}

/**
 * Ensure the data directory and history file exist
 */
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(getDefaultData(), null, 2));
  }
}

/**
 * Read the full history data
 */
function readData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading history file, resetting:', err.message);
    const data = getDefaultData();
    writeData(data);
    return data;
  }
}

/**
 * Write the full history data
 */
function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get today's date string in IST (YYYY-MM-DD)
 */
function getTodayIST() {
  const now = new Date();
  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
  const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return istDate.toISOString().split('T')[0];
}

/**
 * Get yesterday's date string in IST (YYYY-MM-DD)
 */
function getYesterdayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  istDate.setDate(istDate.getDate() - 1);
  return istDate.toISOString().split('T')[0];
}

/**
 * Get today's activity record
 */
function getToday() {
  const data = readData();
  const today = getTodayIST();
  return {
    date: today,
    activity: data.days[today] || null,
    streak: data.streak
  };
}

/**
 * Update today's activity
 * @param {Object} update - { solved, platform, solvedAt, manualEntry }
 */
function updateToday(update) {
  const data = readData();
  const today = getTodayIST();

  // Merge with existing data for today
  const existing = data.days[today] || {
    solved: false,
    platform: null,
    solvedAt: null,
    remindersSent: 0,
    manualEntry: false
  };

  data.days[today] = {
    ...existing,
    ...update
  };

  // Update streak if solved
  if (update.solved) {
    const yesterday = getYesterdayIST();
    const wasActiveYesterday = data.days[yesterday]?.solved === true;

    if (data.streak.lastActiveDate === today) {
      // Already updated streak today, no change
    } else if (data.streak.lastActiveDate === yesterday || wasActiveYesterday) {
      // Continue streak
      data.streak.current += 1;
    } else {
      // Start new streak
      data.streak.current = 1;
    }

    data.streak.lastActiveDate = today;
    data.streak.longest = Math.max(data.streak.longest, data.streak.current);
  }

  writeData(data);
  return data;
}

/**
 * Increment the reminder count for today
 */
function incrementReminders() {
  const data = readData();
  const today = getTodayIST();

  if (!data.days[today]) {
    data.days[today] = {
      solved: false,
      platform: null,
      solvedAt: null,
      remindersSent: 0,
      manualEntry: false
    };
  }

  data.days[today].remindersSent = (data.days[today].remindersSent || 0) + 1;
  writeData(data);
  return data.days[today].remindersSent;
}

/**
 * Get history for the last N days
 * @param {number} numDays - Number of days to look back
 */
function getHistory(numDays = 90) {
  const data = readData();
  const result = [];

  for (let i = 0; i < numDays; i++) {
    const date = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset + date.getTimezoneOffset() * 60 * 1000);
    istDate.setDate(istDate.getDate() - i);
    const dateStr = istDate.toISOString().split('T')[0];

    result.push({
      date: dateStr,
      ...(data.days[dateStr] || { solved: false, platform: null, remindersSent: 0 })
    });
  }

  return {
    days: result,
    streak: data.streak,
    totalSolved: Object.values(data.days).filter(d => d.solved).length
  };
}

module.exports = {
  getToday,
  updateToday,
  incrementReminders,
  getHistory,
  getTodayIST,
  readData,
  writeData
};
