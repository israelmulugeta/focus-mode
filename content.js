const STYLE_ID = 'focus-extension-grayscale-style';

function ensureGrayscaleStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = 'html { filter: grayscale(100%) !important; }';
  document.documentElement.appendChild(style);
}

function removeGrayscaleStyle() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

function applySessionVisuals({ isFocusActive, grayscaleEnabled }) {
  if (isFocusActive && grayscaleEnabled) {
    ensureGrayscaleStyle();
  } else {
    removeGrayscaleStyle();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'SESSION_STATE_CHANGED') {
    applySessionVisuals(message.payload || {});
  }
});

(async () => {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' });
  if (response?.ok) {
    applySessionVisuals({
      isFocusActive: response.state?.isFocusActive,
      grayscaleEnabled: response.state?.settings?.grayscaleEnabled
    });
  }
})();
