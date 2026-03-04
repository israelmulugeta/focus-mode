export const FOCUS_ALARM = 'focus-session-end';

export const DEFAULT_STATE = {
  isFocusActive: false,
  currentTask: '',
  sessionStartTime: null,
  sessionDuration: 0,
  settings: {
    grayscaleEnabled: true
  },
  userBlockedDomains: []
};

export function isSupportedHttpUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isIgnoredUrl(rawUrl) {
  if (!rawUrl) return true;
  return rawUrl.startsWith('chrome://') || rawUrl.startsWith('chrome-extension://') || rawUrl.startsWith('about:');
}

export function normalizeBlockPattern(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';

  const withoutProtocol = raw.replace(/^https?:\/\//, '');
  const cleaned = withoutProtocol.replace(/^www\./, '').replace(/\/$/, '');
  return cleaned;
}

export function dedupePatterns(patterns) {
  return [...new Set((patterns || []).map(normalizeBlockPattern).filter(Boolean))];
}

export function urlMatchesPattern(rawUrl, pattern) {
  if (!isSupportedHttpUrl(rawUrl)) return false;
  const normalizedPattern = normalizeBlockPattern(pattern);
  if (!normalizedPattern) return false;

  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const hostAndPath = `${host}${parsed.pathname}`.toLowerCase();

  if (normalizedPattern.includes('/')) {
    return hostAndPath.startsWith(normalizedPattern);
  }

  return host === normalizedPattern || host.endsWith(`.${normalizedPattern}`);
}

export function getSessionRemainingMs(state) {
  if (!state?.isFocusActive || !state.sessionStartTime || !state.sessionDuration) return 0;
  const durationMs = state.sessionDuration * 60 * 1000;
  const elapsedMs = Date.now() - state.sessionStartTime;
  return Math.max(0, durationMs - elapsedMs);
}

export function getFocusPageUrl(blockedUrl = '') {
  const url = new URL(chrome.runtime.getURL('focus.html'));
  if (blockedUrl) {
    url.searchParams.set('blockedUrl', blockedUrl);
  }
  return url.toString();
}

export async function getSessionState() {
  const state = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    ...DEFAULT_STATE,
    ...state,
    settings: {
      ...DEFAULT_STATE.settings,
      ...(state.settings || {})
    },
    userBlockedDomains: dedupePatterns(state.userBlockedDomains || [])
  };
}
