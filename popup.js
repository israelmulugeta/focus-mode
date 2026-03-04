const setupView = document.getElementById('setup-view');
const activeView = document.getElementById('active-view');
const taskInput = document.getElementById('task-input');
const durationInput = document.getElementById('duration-input');
const startBtn = document.getElementById('start-btn');
const endBtn = document.getElementById('end-btn');
const activeTask = document.getElementById('active-task');
const remainingTime = document.getElementById('remaining-time');
const grayscaleToggle = document.getElementById('grayscale-toggle');
const blockedSiteInput = document.getElementById('blocked-site-input');
const addBlockedSiteBtn = document.getElementById('add-blocked-site-btn');
const blockedSitesList = document.getElementById('blocked-sites-list');
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

function renderBlockedSites(sites = []) {
  blockedSitesList.innerHTML = '';

  if (!sites.length) {
    const empty = document.createElement('li');
    empty.className = 'site-item';
    empty.textContent = 'No custom blocked sites yet.';
    blockedSitesList.appendChild(empty);
    return;
  }

  sites.forEach((site) => {
    const item = document.createElement('li');
    item.className = 'site-item';

    const label = document.createElement('span');
    label.textContent = site;

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-btn';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', async () => {
      const response = await chrome.runtime.sendMessage({
        type: 'REMOVE_BLOCKED_SITE',
        payload: { value: site }
      });

      if (!response?.ok) {
        setStatus(response?.error || 'Unable to remove blocked site.');
        return;
      }

      renderBlockedSites(response.state.userBlockedDomains || []);
      setStatus('Blocked site removed.');
    });

    item.append(label, removeButton);
    blockedSitesList.appendChild(item);
  });
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

  grayscaleToggle.checked = Boolean(state.settings?.grayscaleEnabled);
  renderBlockedSites(state.userBlockedDomains || []);
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
  renderBlockedSites(response.state.userBlockedDomains || []);
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

grayscaleToggle.addEventListener('change', async () => {
  const response = await chrome.runtime.sendMessage({
    type: 'SET_GRAYSCALE',
    payload: { enabled: grayscaleToggle.checked }
  });

  if (!response?.ok) {
    setStatus(response?.error || 'Unable to update grayscale setting.');
    return;
  }

  setStatus('Grayscale preference updated.');
});

addBlockedSiteBtn.addEventListener('click', async () => {
  const value = blockedSiteInput.value.trim();

  if (!value) {
    setStatus('Enter a domain or URL pattern to block.');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: 'ADD_BLOCKED_SITE',
    payload: { value }
  });

  if (!response?.ok) {
    setStatus(response?.error || 'Unable to add blocked site.');
    return;
  }

  blockedSiteInput.value = '';
  renderBlockedSites(response.state.userBlockedDomains || []);
  setStatus('Blocked site added.');
});

initialize().catch((error) => {
  setStatus(error.message || 'Failed to initialize popup.');
});
