const taskEl = document.getElementById('task');
const blockedUrlEl = document.getElementById('blocked-url');
const statusEl = document.getElementById('status');
const goBackBtn = document.getElementById('go-back');
const endSessionBtn = document.getElementById('end-session');

const blockedUrl = new URL(window.location.href).searchParams.get('blockedUrl') || '';
blockedUrlEl.textContent = blockedUrl || 'Unknown';

function setStatus(message = '') {
  statusEl.textContent = message;
}

async function getState() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' });
  return response?.ok ? response.state : null;
}

goBackBtn.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = 'https://www.google.com';
});

endSessionBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'END_SESSION' });
  if (!response?.ok) {
    setStatus(response?.error || 'Failed to end focus session.');
    return;
  }

  window.location.href = blockedUrl || 'about:blank';
});

(async () => {
  const state = await getState();

  if (!state?.isFocusActive) {
    if (blockedUrl) {
      window.location.href = blockedUrl;
      return;
    }
    taskEl.textContent = 'No active session';
    return;
  }

  taskEl.textContent = state.currentTask || 'No task provided';
})();
