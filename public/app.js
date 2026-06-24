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

// Detect if running locally (has backend) or on GitHub Pages (static only)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// GitHub Actions workflow trigger for static deployment
const GITHUB_REPO = 'Sahaskiran/smart-reminder';
const WORKFLOW_FILE = 'check-and-deploy.yml';

function getGitHubToken() {
  let token = localStorage.getItem('github_pat');
  if (!token) {
    token = prompt(
      '🔑 Enter your GitHub Personal Access Token (PAT)\n\n' +
      'This is needed to trigger email checks from the dashboard.\n' +
      'Create one at: github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained\n' +
      'Give it "Actions: Read & Write" permission for the smart-reminder repo.\n\n' +
      'It will be saved in your browser for future use.'
    );
    if (token) {
      localStorage.setItem('github_pat', token.trim());
    }
  }
  return token;
}

async function triggerGitHubWorkflow(force = false) {
  const token = getGitHubToken();
  if (!token) {
    showToast('GitHub token is required to trigger email checks.', 'error');
    return false;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { force: force.toString() }
      })
    });

    if (res.status === 204) {
      return true;
    } else if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('github_pat');
      showToast('Invalid token — please try again with a valid PAT.', 'error');
      return false;
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`Failed: ${data.message || res.statusText}`, 'error');
      return false;
    }
  } catch (err) {
    showToast('Network error triggering workflow.', 'error');
    return false;
  }
}

// Manual Activity Check
checkNowBtn.addEventListener('click', async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

  try {
    if (isLocal) {
      // On localhost — call the backend API directly
      const res = await fetch('/api/check-now', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        if (result.data.solved) {
          showToast(`Activity detected on ${result.data.platform.toUpperCase()}! Streak saved.`);
        } else {
          showToast('No recent activity found.', 'error');
        }
      }
    } else {
      // On GitHub Pages — just refresh the static data
      await fetchAndRenderData();
      showToast('Dashboard refreshed with latest data!', 'success');
    }
    await fetchAndRenderData();
  } catch (err) {
    showToast('Failed to check activity.', 'error');
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Check Activity';
  }
});

// Test Email
testEmailBtn.addEventListener('click', async () => {
  testEmailBtn.disabled = true;
  testEmailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    if (isLocal) {
      // On localhost — call the backend API directly
      const res = await fetch('/api/test-reminder', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        showToast('✅ Test email sent! Check your inbox.', 'success');
      } else {
        showToast('Failed to send email: ' + (result.error || 'Unknown error'), 'error');
      }
    } else {
      // On GitHub Pages — trigger the GitHub Actions workflow with force=true
      showToast('Triggering email check via GitHub Actions...', 'success');
      const triggered = await triggerGitHubWorkflow(true);
      if (triggered) {
        showToast('✅ Workflow triggered! Email will arrive in ~2 minutes.', 'success');
      }
    }
  } catch (err) {
    showToast('Failed to send test email.', 'error');
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
  fetchAndRenderData();

  // Poll history every 60 seconds
  setInterval(fetchAndRenderData, 60000);
});
