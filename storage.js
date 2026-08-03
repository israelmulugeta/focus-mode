const defaults = { theme: 'light', wordWrap: true, lastText: '', windowSize: { width: 920, height: 760 } };
export async function loadSettings() { return new Promise((resolve) => chrome.storage.local.get(defaults, resolve)); }
export async function saveSettings(patch) { return new Promise((resolve) => chrome.storage.local.set(patch, resolve)); }
