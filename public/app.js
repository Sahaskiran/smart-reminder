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

// Fetch general status data
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const result = await res.json();

    if (result.success) {
      const data = result.data;
      window.todayGoalSolved = data.solved;

      // Update Streaks
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

      // Update Today's Goal Section
      statusCircleEl.className = 'status-circle';
      if (data.solved) {
        statusCircleEl.classList.add('success');
        statusIconEl.className = 'fa-solid fa-check';
        statusTitleEl.textContent = 'Goal Completed!';
        
        let platformDisplay = data.platform.toUpperCase();
        if (data.manualEntry) {
          platformDisplay += ' (Logged Manually)';
        }
        statusDescEl.textContent = `Excellent! Verified today on ${platformDisplay} at ${new Date(data.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
      } else {
        statusCircleEl.classList.add('pending');
        statusIconEl.className = 'fa-solid fa-hourglass-half';
        statusTitleEl.textContent = 'Awaiting Completion';
        statusDescEl.textContent = `Reminders active. ${data.remindersSent} alerts sent so far today.`;
      }

      const now = new Date();
      updateTimelineHighlights(now.getHours(), now.getMinutes());
    }
  } catch (err) {
    console.error('Error fetching status:', err);
    showToast('Failed to connect to backend api', 'error');
  }
}

// Build 90-day heatmap grid
async function fetchAndRenderHeatmap() {
  try {
    const res = await fetch('/api/history?days=90');
    const result = await res.json();

    if (result.success) {
      const historyData = result.data;
      totalSolvedDaysEl.textContent = historyData.totalSolved;

      // Clean grid
      heatmapGridEl.innerHTML = '';

      // Populate grid (reversed so latest is at the end or correctly ordered left-to-right)
      // We will render days from oldest to newest (historyData.days is returned latest first)
      const days = [...historyData.days].reverse();

      days.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'heatmap-day';
        
        // Add activity level
        if (day.solved) {
          dayEl.classList.add('level-1');
          dayEl.setAttribute('data-platform', day.platform || 'manual');
        } else {
          dayEl.classList.add('level-0');
        }

        // Formats tooltip content
        const dateStr = new Date(day.date).toLocaleDateString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });

        let statusText = 'No activity';
        if (day.solved) {
          statusText = `Solved on ${day.platform.toUpperCase()}`;
          if (day.solvedAt) {
            statusText += ` (${new Date(day.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
          }
        }
        dayEl.setAttribute('data-tooltip', `${dateStr}: ${statusText}`);

        heatmapGridEl.appendChild(dayEl);
      });
    }
  } catch (err) {
    console.error('Error fetching heatmap history:', err);
  }
}

// Manual Activity Check Event
checkNowBtn.addEventListener('click', async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
  
  try {
    const res = await fetch('/api/check-now', { method: 'POST' });
    const result = await res.json();
    
    if (result.success) {
      if (result.data.solved) {
        showToast(`Activity detected on ${result.data.platform.toUpperCase()}! Streak saved.`);
      } else {
        showToast('No recent activity found. Make sure submissions are Accepted.', 'error');
      }
      await fetchStatus();
      await fetchAndRenderHeatmap();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to trigger check.', 'error');
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Check Activity';
  }
});

// Test Email Event
testEmailBtn.addEventListener('click', async () => {
  testEmailBtn.disabled = true;
  testEmailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  
  try {
    const res = await fetch('/api/test-reminder', { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast('Checked details. Check backend console for notification details.');
    }
  } catch (err) {
    showToast('Failed to execute test check.', 'error');
  } finally {
    testEmailBtn.disabled = false;
    testEmailBtn.innerHTML = '<i class="fa-solid fa-envelope"></i>';
  }
});

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Fetch data
  fetchStatus();
  fetchAndRenderHeatmap();

  // Poll status every 60 seconds
  setInterval(fetchStatus, 60000);
});
