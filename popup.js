const setupView = document.getElementById('setup-view');
const activeView = document.getElementById('active-view');
const taskInput = document.getElementById('task-input');
const durationInput = document.getElementById('duration-input');
const startBtn = document.getElementById('start-btn');
const endBtn = document.getElementById('end-btn');
const activeTask = document.getElementById('active-task');
const remainingTime = document.getElementById('remaining-time');
const statusEl = document.getElementById('status');

let countdownTimer = null;

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function setStatus(message = '') {
  statusEl.textContent = message;
}

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

async function fetchState() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' });
  if (!response?.ok) {
    throw new Error(response?.error || 'Unable to load state.');
  }
  return response;
}

function renderActiveState(state) {
  setupView.classList.add('hidden');
  activeView.classList.remove('hidden');
  activeTask.textContent = state.currentTask;

  clearCountdown();
  const tick = () => {
    const start = state.sessionStartTime || Date.now();
    const totalMs = (state.sessionDuration || 0) * 60 * 1000;
    const leftMs = Math.max(0, start + totalMs - Date.now());
    remainingTime.textContent = formatRemaining(leftMs);

    if (leftMs <= 0) {
      clearCountdown();
      initialize().catch(() => undefined);
    }
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function renderInactiveState() {
  clearCountdown();
  setupView.classList.remove('hidden');
  activeView.classList.add('hidden');
}

async function initialize() {
  const { state } = await fetchState();
  if (state.isFocusActive) {
    renderActiveState(state);
  } else {
    renderInactiveState();
  }
}

startBtn.addEventListener('click', async () => {
  const task = taskInput.value.trim();
  const durationMinutes = Number(durationInput.value);

  if (!task) {
    setStatus('Please enter a task.');
    return;
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    setStatus('Please enter a valid duration in minutes.');
    return;
  }

  setStatus('');
  const response = await chrome.runtime.sendMessage({
    type: 'START_SESSION',
    payload: { task, durationMinutes }
  });

  if (!response?.ok) {
    setStatus(response?.error || 'Unable to start session.');
    return;
  }

  renderActiveState(response.state);
});

endBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'END_SESSION' });
  if (!response?.ok) {
    setStatus(response?.error || 'Unable to end session.');
    return;
  }

  setStatus('Session ended.');
  renderInactiveState();
});

initialize().catch((error) => {
  setStatus(error.message || 'Failed to initialize popup.');
});
