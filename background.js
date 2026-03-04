const FOCUS_ALARM = 'focus-session-end';

const DISTRACTING_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'reddit.com',
  'news.google.com',
  'nytimes.com',
  'washingtonpost.com',
  'cnn.com',
  'foxnews.com',
  'bbc.com',
  'theguardian.com',
  'wsj.com',
  'bloomberg.com'
];

const DEFAULT_STATE = {
  isFocusActive: false,
  currentTask: '',
  sessionStartTime: null,
  sessionDuration: 0,
  settings: { grayscaleEnabled: true }
};

function getFocusPageUrl(blockedUrl = '') {
  const url = new URL(chrome.runtime.getURL('focus.html'));
  if (blockedUrl) {
    url.searchParams.set('blockedUrl', blockedUrl);
  }
  return url.toString();
}

function isSupportedHttpUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isBlockedDomain(rawUrl) {
  if (!isSupportedHttpUrl(rawUrl)) return false;
  const { hostname } = new URL(rawUrl);
  return DISTRACTING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

async function getSessionState() {
  const state = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    ...DEFAULT_STATE,
    ...state,
    settings: {
      ...DEFAULT_STATE.settings,
      ...(state.settings || {})
    }
  };
}

async function clearSessionState() {
  await chrome.storage.local.set({ ...DEFAULT_STATE });
  await chrome.alarms.clear(FOCUS_ALARM);
  await notifyAllTabsSessionState();
}

function getSessionRemainingMs(state) {
  if (!state.isFocusActive || !state.sessionStartTime || !state.sessionDuration) return 0;
  const durationMs = state.sessionDuration * 60 * 1000;
  const elapsedMs = Date.now() - state.sessionStartTime;
  return Math.max(0, durationMs - elapsedMs);
}

async function enforceSessionTimeout() {
  const state = await getSessionState();
  if (!state.isFocusActive) return;

  const remaining = getSessionRemainingMs(state);
  if (remaining <= 0) {
    await clearSessionState();
    return;
  }

  await chrome.alarms.create(FOCUS_ALARM, { when: Date.now() + remaining });
}

async function notifyAllTabsSessionState() {
  const state = await getSessionState();
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url && isSupportedHttpUrl(tab.url))
      .map((tab) =>
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'SESSION_STATE_CHANGED',
            payload: {
              isFocusActive: state.isFocusActive,
              grayscaleEnabled: state.settings?.grayscaleEnabled
            }
          })
          .catch(() => undefined)
      )
  );
}

async function maybeRedirectTab(tabId, rawUrl) {
  if (!tabId || !rawUrl) return;
  const state = await getSessionState();
  if (!state.isFocusActive) return;

  if (!isSupportedHttpUrl(rawUrl)) return;
  if (rawUrl.startsWith(chrome.runtime.getURL('focus.html'))) return;

  if (isBlockedDomain(rawUrl)) {
    await chrome.tabs.update(tabId, { url: getFocusPageUrl(rawUrl) });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  if (Object.keys(existing).length === 0) {
    await chrome.storage.local.set({ ...DEFAULT_STATE });
    return;
  }

  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    ...existing,
    settings: {
      ...DEFAULT_STATE.settings,
      ...(existing.settings || {})
    }
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await enforceSessionTimeout();
  await notifyAllTabsSessionState();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FOCUS_ALARM) {
    await clearSessionState();
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await maybeRedirectTab(tabId, changeInfo.url);
  } else if (changeInfo.status === 'complete' && tab?.url) {
    await maybeRedirectTab(tabId, tab.url);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id && tab.pendingUrl) {
    await maybeRedirectTab(tab.id, tab.pendingUrl);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'GET_SESSION_STATE') {
      const state = await getSessionState();
      const remainingMs = getSessionRemainingMs(state);
      if (state.isFocusActive && remainingMs <= 0) {
        await clearSessionState();
        const resetState = await getSessionState();
        sendResponse({ ok: true, state: resetState, remainingMs: 0 });
        return;
      }
      sendResponse({ ok: true, state, remainingMs });
      return;
    }

    if (message?.type === 'START_SESSION') {
      const task = String(message.payload?.task || '').trim();
      const duration = Number(message.payload?.durationMinutes || 0);

      if (!task || !Number.isFinite(duration) || duration <= 0) {
        sendResponse({ ok: false, error: 'Invalid task or duration.' });
        return;
      }

      const nextState = {
        isFocusActive: true,
        currentTask: task,
        sessionStartTime: Date.now(),
        sessionDuration: duration,
        settings: { grayscaleEnabled: true }
      };

      await chrome.storage.local.set(nextState);
      await enforceSessionTimeout();
      await notifyAllTabsSessionState();
      sendResponse({ ok: true, state: nextState, remainingMs: duration * 60 * 1000 });
      return;
    }

    if (message?.type === 'END_SESSION') {
      await clearSessionState();
      const state = await getSessionState();
      sendResponse({ ok: true, state, remainingMs: 0 });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message type.' });
  })();

  return true;
});

(async () => {
  await enforceSessionTimeout();
})();
