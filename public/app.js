// DOM Elements
const currentStreakEl = document.getElementById('current-streak');
const longestStreakEl = document.getElementById('longest-streak');
const totalSolvedDaysEl = document.getElementById('total-solved-days');
const clockDisplayEl = document.getElementById('clock-display');
const statusCircleEl = document.getElementById('status-circle');
const statusIconEl = document.getElementById('status-icon');
const statusTitleEl = document.getElementById('status-title');
const statusDescEl = document.getElementById('status-desc');
const statusCardEl = document.getElementById('status-card');
const checkNowBtn = document.getElementById('check-now-btn');
const testEmailBtn = document.getElementById('test-email-btn');
const heatmapGridEl = document.getElementById('heatmap-grid');
const fireIconEl = document.querySelector('.fire-icon');
const streakMotivationalMsgEl = document.getElementById('streak-motivational-msg');

window.todayGoalSolved = false;

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastIcon = toast.querySelector('.toast-icon');
  const toastMsg = document.getElementById('toast-message');

  toast.className = `toast show ${type}`;
  toastMsg.textContent = message;

  if (type === 'success') {
    toastIcon.className = 'fa-solid fa-circle-check toast-icon';
  } else {
    toastIcon.className = 'fa-solid fa-triangle-exclamation toast-icon';
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Get today's date string in IST (YYYY-MM-DD)
function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
  const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return istDate.toISOString().split('T')[0];
}

// Clock updates
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let seconds = now.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  minutes = minutes < 10 ? '0' + minutes : minutes;
  seconds = seconds < 10 ? '0' + seconds : seconds;

  clockDisplayEl.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
  updateTimelineHighlights(now.getHours(), now.getMinutes());
}

// Timeline schedule updates
function updateTimelineHighlights(currentHour, currentMinute) {
  const times = [
    { id: 'time-9pm', hour: 21 },
    { id: 'time-10pm', hour: 22 },
    { id: 'time-11pm', hour: 23 },
    { id: 'time-12am', hour: 0 }
  ];

  times.forEach(t => {
    const el = document.getElementById(t.id);
    if (!el) return;

    el.classList.remove('active', 'passed', 'complete');

    // If goal is solved, make everything status complete
    if (window.todayGoalSolved) {
      el.classList.add('complete');
      return;
    }

    if (currentHour === t.hour) {
      el.classList.add('active');
    } else if (currentHour > t.hour || (t.hour === 0 && currentHour >= 0)) {
      el.classList.add('passed');
    }
  });
}

// Fetch static history.json and render dashboard
async function fetchAndRenderData() {
  try {
    // Read from static JSON file generated during check job
    const res = await fetch('data/history.json');
    if (!res.ok) {
      throw new Error(`Failed to load data file: ${res.status}`);
    }
    const data = await res.json();

    // 1. Update Streaks
    currentStreakEl.textContent = data.streak.current;
    longestStreakEl.textContent = data.streak.longest;

    // Motivational Message
    if (data.streak.current > 0) {
      fireIconEl.classList.add('active');
      streakMotivationalMsgEl.textContent = `Keep it burning! You are on a ${data.streak.current}-day streak!`;
    } else {
      fireIconEl.classList.remove('active');
      streakMotivationalMsgEl.textContent = 'Solve a problem to start your streak today!';
    }

    // 2. Update Today's Goal Section
    const todayStr = getTodayIST();
    const todayActivity = data.days[todayStr] || null;
    window.todayGoalSolved = todayActivity?.solved || false;

    statusCircleEl.className = 'status-circle';
    if (window.todayGoalSolved) {
      statusCircleEl.classList.add('success');
      statusIconEl.className = 'fa-solid fa-check';
      statusTitleEl.textContent = 'Goal Completed!';
      statusDescEl.textContent = `Excellent! Verified today on LeetCode at ${new Date(todayActivity.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
    } else {
      statusCircleEl.classList.add('pending');
      statusIconEl.className = 'fa-solid fa-hourglass-half';
      statusTitleEl.textContent = 'Awaiting Completion';
      const remindersSent = todayActivity?.remindersSent || 0;
      statusDescEl.textContent = `Reminders active. ${remindersSent} alerts sent so far today.`;
    }

    // 3. Render 90-day heatmap calendar
    const numDays = 90;
    const resultDays = [];
    let totalSolved = 0;

    for (let i = 0; i < numDays; i++) {
      const date = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(date.getTime() + istOffset + date.getTimezoneOffset() * 60 * 1000);
      istDate.setDate(istDate.getDate() - i);
      const dateStr = istDate.toISOString().split('T')[0];

      const dayData = data.days[dateStr] || { solved: false, platform: null, remindersSent: 0 };
      if (dayData.solved) totalSolved++;
      
      resultDays.push({
        date: dateStr,
        ...dayData
      });
    }

    totalSolvedDaysEl.textContent = totalSolved;
    heatmapGridEl.innerHTML = '';

    // Render left-to-right (oldest first)
    const renderDays = resultDays.reverse();
    renderDays.forEach(day => {
      const dayEl = document.createElement('div');
      dayEl.className = 'heatmap-day';
      
      if (day.solved) {
        dayEl.classList.add('level-1');
        dayEl.setAttribute('data-platform', day.platform || 'leetcode');
      } else {
        dayEl.classList.add('level-0');
      }

      const dateStr = new Date(day.date).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });

      let statusText = 'No activity';
      if (day.solved) {
        statusText = `Solved on LeetCode`;
        if (day.solvedAt) {
          statusText += ` (${new Date(day.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
        }
      }
      dayEl.setAttribute('data-tooltip', `${dateStr}: ${statusText}`);
      heatmapGridEl.appendChild(dayEl);
    });

    const now = new Date();
    updateTimelineHighlights(now.getHours(), now.getMinutes());

  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    showToast('Failed to load history data', 'error');
  }
}

// Manual Activity Check — refresh dashboard data from history.json
checkNowBtn.addEventListener('click', async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
  
  try {
    await fetchAndRenderData();
    showToast('Dashboard refreshed with latest data!', 'success');
  } catch (err) {
    showToast('Failed to refresh data.', 'error');
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Check Activity';
  }
});

// Test Email — must be triggered via GitHub Actions (no backend on static site)
testEmailBtn.addEventListener('click', () => {
  showToast('Opening GitHub Actions — click "Run workflow" with Force enabled to send a test email.', 'success');
  setTimeout(() => {
    window.open('https://github.com/Sahaskiran/smart-reminder/actions/workflows/check-and-deploy.yml', '_blank');
  }, 2000);
});

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Fetch data
  fetchAndRenderData();

  // Poll history every 60 seconds
  setInterval(fetchAndRenderData, 60000);
});
