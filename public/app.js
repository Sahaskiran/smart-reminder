// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCmLt52foqRYkxSXAiEZXhsVYy0d8kN9j0",
  authDomain: "smart-reminder-36155.firebaseapp.com",
  databaseURL: "https://smart-reminder-36155-default-rtdb.firebaseio.com",
  projectId: "smart-reminder-36155",
  storageBucket: "smart-reminder-36155.firebasestorage.app",
  messagingSenderId: "123987610859",
  appId: "1:123987610859:web:a1d9e4f02c68b6122e42ae",
  measurementId: "G-7GNN8NWH85"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Views
const authView = document.getElementById('auth-view');
const setupView = document.getElementById('setup-view');
const dashboardView = document.getElementById('dashboard-view');

// Auth Form Elements
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleMsg = document.getElementById('auth-toggle-msg');

// Setup Form Elements
const setupForm = document.getElementById('setup-form');
const leetcodeUsernameInput = document.getElementById('leetcode-username-input');
const setupSubmitBtn = document.getElementById('setup-submit-btn');

// Dashboard DOM Elements
const currentStreakEl = document.getElementById('current-streak');
const longestStreakEl = document.getElementById('longest-streak');
const totalSolvedDaysEl = document.getElementById('total-solved-days');
const clockDisplayEl = document.getElementById('clock-display');
const statusCircleEl = document.getElementById('status-circle');
const statusIconEl = document.getElementById('status-icon');
const statusTitleEl = document.getElementById('status-title');
const statusDescEl = document.getElementById('status-desc');
const checkNowBtn = document.getElementById('check-now-btn');
const testEmailBtn = document.getElementById('test-email-btn');
const heatmapGridEl = document.getElementById('heatmap-grid');
const fireIconEl = document.querySelector('.fire-icon');
const streakMotivationalMsgEl = document.getElementById('streak-motivational-msg');

const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');

// App State
let isSignUpMode = false;
let userToken = null;
let todayGoalSolved = false;
let pollingInterval = null;

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

// Helper for making API calls with Authorization header
async function apiCall(endpoint, method = 'GET', body = null) {
  if (!userToken) {
    throw new Error('Not authenticated');
  }

  const headers = {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, options);
  if (res.status === 401) {
    auth.signOut();
    throw new Error('Session expired');
  }

  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error || 'Request failed');
  }
  return result;
}

// Toggle Auth mode (Login vs Signup)
authToggleMsg.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'auth-toggle-link') {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
      authTitle.textContent = 'Create Account';
      authSubtitle.textContent = 'Join the gang & build consistency';
      authSubmitBtn.textContent = 'Sign Up';
      authToggleMsg.innerHTML = 'Already have an account? <a href="#" id="auth-toggle-link">Sign In</a>';
    } else {
      authTitle.textContent = 'Welcome Gang';
      authSubtitle.textContent = 'Login to check your coding streak';
      authSubmitBtn.textContent = 'Sign In';
      authToggleMsg.innerHTML = 'Don\'t have an account? <a href="#" id="auth-toggle-link">Create Account</a>';
    }
  }
});

// Auth form submit
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  authSubmitBtn.disabled = true;
  authSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

  try {
    if (isSignUpMode) {
      await auth.createUserWithEmailAndPassword(email, password);
      showToast('Account created successfully!', 'success');
    } else {
      await auth.signInWithEmailAndPassword(email, password);
      showToast('Logged in successfully!', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  }
});

// LeetCode setup form submit
setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = leetcodeUsernameInput.value.trim();

  setupSubmitBtn.disabled = true;
  setupSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

  try {
    const res = await apiCall('/api/user/verify-leetcode', 'POST', { username });
    showToast(res.message, 'success');
    
    // Switch to Dashboard
    setupView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    // Load dashboard data
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setupSubmitBtn.disabled = false;
    setupSubmitBtn.textContent = 'Verify & Save Profile';
  }
});

// Logout click
logoutBtn.addEventListener('click', () => {
  auth.signOut();
  showToast('Logged out successfully!', 'success');
});

// Clock updates
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let seconds = now.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12;
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

    if (todayGoalSolved) {
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

// Load Dashboard Data
async function loadDashboard() {
  try {
    // 1. Get user status
    const statusRes = await apiCall('/api/user/status');
    const status = statusRes.data;

    currentStreakEl.textContent = status.streak.current;
    longestStreakEl.textContent = status.streak.longest;

    // Motivational Message
    if (status.streak.current > 0) {
      fireIconEl.classList.add('active');
      streakMotivationalMsgEl.textContent = `Keep it burning! You are on a ${status.streak.current}-day streak!`;
    } else {
      fireIconEl.classList.remove('active');
      streakMotivationalMsgEl.textContent = 'Solve a problem to start your streak today!';
    }

    // 2. Goal status card updates
    todayGoalSolved = status.solved;
    statusCircleEl.className = 'status-circle';
    if (todayGoalSolved) {
      statusCircleEl.classList.add('success');
      statusIconEl.className = 'fa-solid fa-check';
      statusTitleEl.textContent = 'Goal Completed!';
      statusDescEl.textContent = `Excellent! Verified today on LeetCode at ${new Date(status.solvedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
    } else {
      statusCircleEl.classList.add('pending');
      statusIconEl.className = 'fa-solid fa-hourglass-half';
      statusTitleEl.textContent = 'Awaiting Completion';
      statusDescEl.textContent = `Reminders active. ${status.remindersSent} alerts sent so far today.`;
    }

    // 3. Get history for heatmap
    const historyRes = await apiCall('/api/user/history');
    const history = historyRes.data;

    totalSolvedDaysEl.textContent = history.totalProblemsSolved || status.totalProblemsSolved || 0;
    heatmapGridEl.innerHTML = '';

    // Render left-to-right (oldest first)
    const renderDays = history.days.reverse();
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
    showToast('Failed to load dashboard statistics.', 'error');
  }
}

// Manual check activity button click
checkNowBtn.addEventListener('click', async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

  try {
    const res = await apiCall('/api/user/check-now', 'POST');
    if (res.success) {
      if (res.data.solved) {
        showToast(`Activity detected on ${res.data.platform.toUpperCase()}! Streak saved.`);
      } else {
        showToast('No recent activity found today.', 'error');
      }
      await loadDashboard();
    }
  } catch (err) {
    showToast('Failed to verify activity: ' + err.message, 'error');
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Check Activity';
  }
});

// Test Email button click
testEmailBtn.addEventListener('click', async () => {
  testEmailBtn.disabled = true;
  testEmailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const res = await apiCall('/api/user/test-reminder', 'POST');
    if (res.success) {
      showToast('✅ Test email sent! Check your inbox.', 'success');
      await loadDashboard();
    }
  } catch (err) {
    showToast('Failed to send test email: ' + err.message, 'error');
  } finally {
    testEmailBtn.disabled = false;
    testEmailBtn.innerHTML = '<i class="fa-solid fa-envelope"></i>';
  }
});

// Firebase Auth Observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    userEmailDisplay.textContent = user.email;
    
    try {
      userToken = await user.getIdToken();
      
      // Get user profile configuration status
      const statusRes = await apiCall('/api/user/status');
      
      authView.classList.add('hidden');
      
      if (statusRes.data.needSetup) {
        // Setup View (need leetcode username)
        setupView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
      } else {
        // Dashboard View
        setupView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        await loadDashboard();
        
        // Start polling every 60 seconds
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(loadDashboard, 60000);
      }
    } catch (err) {
      showToast('Authentication failed: ' + err.message, 'error');
      auth.signOut();
    }
  } else {
    // Logged out state
    userToken = null;
    userEmailDisplay.textContent = '';
    if (pollingInterval) clearInterval(pollingInterval);
    
    // Clear forms
    authForm.reset();
    setupForm.reset();
    
    authView.classList.remove('hidden');
    setupView.classList.add('hidden');
    dashboardView.classList.add('hidden');
  }
});

// Init clock
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
});
