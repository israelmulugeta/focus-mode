# Focus Extension (Manifest V3)

Focus Extension helps users stay on task with timed focus sessions, grayscale mode, and both default + custom blocked sites.

## Folder structure

```text
focus-mode/
├── manifest.json
├── domains.js
├── utils.js
├── background.js
├── content.js
├── popup.html
├── popup.css
├── popup.js
├── focus.html
├── focus.css
├── focus.js
└── README.md
```

## How it works

### 1) Focus sessions

- The popup lets users enter a task and session duration in minutes.
- Starting a session stores this state in `chrome.storage.local`:

```js
{
  isFocusActive: true,
  currentTask: '...',
  sessionStartTime: 1710000000000,
  sessionDuration: 25,
  settings: { grayscaleEnabled: true },
  userBlockedDomains: []
}
```

- The background service worker schedules an alarm for session expiration.
- If a user visits a blocked URL while focus is active, they are redirected to `focus.html?blockedUrl=...`.
- Session state persists across browser restarts.

### 2) Grayscale toggle

- Popup includes **Enable Grayscale** checkbox.
- Toggling updates storage and instantly broadcasts state to all open tabs.
- `content.js` applies/removes:

```css
html { filter: grayscale(100%) !important; }
```

### 3) Custom blocked sites

- Popup includes input + list for custom blocked patterns.
- Users can add/remove domains or host/path entries (for example, `example.com` or `example.com/feed`).
- Updates are persisted immediately and enforced during active sessions.

### Blocking behavior details

- Uses default distracting domains from `domains.js` plus user patterns.
- Applies matching on host and optional path prefix.
- Ignores unsupported/unsafe URLs (`chrome://`, `chrome-extension://`, `about:`).
- Prevents redirect loops by skipping `focus.html`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/workspace/focus-mode`.
5. Pin the extension (optional) and open the popup.

## Step-by-step testing guide

1. In popup, enter task + duration and click **Start Session**.
2. Try opening a default blocked site (e.g., `youtube.com`) and verify redirect to `focus.html`.
3. In popup, enable/disable **Enable Grayscale** and verify all tabs update instantly.
4. Add a custom blocked site (e.g., `github.com/explore`) and verify it appears in the list.
5. While session is active, navigate to the custom blocked site and verify redirection.
6. Click **End Focus Session** in popup (or on `focus.html`) and verify access is restored.
7. Start a session, close/reopen Chrome, and verify the session remains active until timeout.

