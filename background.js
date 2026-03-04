import { DEFAULT_DISTRACTING_DOMAINS } from './domains.js';
import {
  DEFAULT_STATE,
  FOCUS_ALARM,
  dedupePatterns,
  getFocusPageUrl,
  getSessionRemainingMs,
  getSessionState,
  isIgnoredUrl,
  isSupportedHttpUrl,
  normalizeBlockPattern,
  urlMatchesPattern
} from './utils.js';

function shouldApplyGrayscale(state) {
  return Boolean(state?.settings?.grayscaleEnabled);
}

function isBlockedUrl(rawUrl, state) {
  if (!isSupportedHttpUrl(rawUrl)) return false;

  const blockPatterns = [...DEFAULT_DISTRACTING_DOMAINS, ...(state.userBlockedDomains || [])];
  return blockPatterns.some((pattern) => urlMatchesPattern(rawUrl, pattern));
}

async function notifyAllTabsSessionState() {
  const state = await getSessionState();
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url && !isIgnoredUrl(tab.url))
      .map((tab) =>
        chrome.tabs
          .sendMessage(tab.id, {
            type: 'SESSION_STATE_CHANGED',
            payload: {
              isFocusActive: state.isFocusActive,
              grayscaleEnabled: shouldApplyGrayscale(state)
            }
          })
          .catch(() => undefined)
      )
  );
}

async function redirectBlockedTabs() {
  const state = await getSessionState();
  if (!state.isFocusActive) return;

  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id && tab.url)
      .map((tab) => maybeRedirectTab(tab.id, tab.url, state))
  );
}

async function clearSessionState() {
  const existing = await getSessionState();
  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    settings: {
      ...DEFAULT_STATE.settings,
      grayscaleEnabled: existing.settings?.grayscaleEnabled ?? DEFAULT_STATE.settings.grayscaleEnabled
    },
    userBlockedDomains: existing.userBlockedDomains || []
  });

  await chrome.alarms.clear(FOCUS_ALARM);
  await notifyAllTabsSessionState();
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

async function maybeRedirectTab(tabId, rawUrl, providedState = null) {
  if (!tabId || !rawUrl) return;
  if (isIgnoredUrl(rawUrl)) return;
  if (rawUrl.startsWith(chrome.runtime.getURL('focus.html'))) return;

  const state = providedState || (await getSessionState());
  if (!state.isFocusActive) return;

  if (isBlockedUrl(rawUrl, state)) {
    await chrome.tabs.update(tabId, { url: getFocusPageUrl(rawUrl) });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));

  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    ...existing,
    settings: {
      ...DEFAULT_STATE.settings,
      ...(existing.settings || {})
    },
    userBlockedDomains: dedupePatterns(existing.userBlockedDomains || [])
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await enforceSessionTimeout();
  await notifyAllTabsSessionState();
  await redirectBlockedTabs();
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

      const prev = await getSessionState();
      const nextState = {
        ...prev,
        isFocusActive: true,
        currentTask: task,
        sessionStartTime: Date.now(),
        sessionDuration: duration
      };

      await chrome.storage.local.set(nextState);
      await enforceSessionTimeout();
      await notifyAllTabsSessionState();
      await redirectBlockedTabs();

      sendResponse({ ok: true, state: nextState, remainingMs: duration * 60 * 1000 });
      return;
    }

    if (message?.type === 'END_SESSION') {
      await clearSessionState();
      const state = await getSessionState();
      sendResponse({ ok: true, state, remainingMs: 0 });
      return;
    }

    if (message?.type === 'SET_GRAYSCALE') {
      const enabled = Boolean(message.payload?.enabled);
      const state = await getSessionState();
      const nextState = {
        ...state,
        settings: {
          ...state.settings,
          grayscaleEnabled: enabled
        }
      };

      await chrome.storage.local.set(nextState);
      await notifyAllTabsSessionState();
      sendResponse({ ok: true, state: nextState });
      return;
    }

    if (message?.type === 'ADD_BLOCKED_SITE') {
      const rawValue = message.payload?.value;
      const normalized = normalizeBlockPattern(rawValue);

      if (!normalized) {
        sendResponse({ ok: false, error: 'Please enter a valid domain or URL pattern.' });
        return;
      }

      const state = await getSessionState();
      const nextState = {
        ...state,
        userBlockedDomains: dedupePatterns([...(state.userBlockedDomains || []), normalized])
      };

      await chrome.storage.local.set(nextState);
      await redirectBlockedTabs();
      sendResponse({ ok: true, state: nextState });
      return;
    }

    if (message?.type === 'REMOVE_BLOCKED_SITE') {
      const normalized = normalizeBlockPattern(message.payload?.value);
      const state = await getSessionState();
      const nextState = {
        ...state,
        userBlockedDomains: (state.userBlockedDomains || []).filter((item) => item !== normalized)
      };

      await chrome.storage.local.set(nextState);
      sendResponse({ ok: true, state: nextState });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message type.' });
  })();

  return true;
});

(async () => {
  await enforceSessionTimeout();
})();
