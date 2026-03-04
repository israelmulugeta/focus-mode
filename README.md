# Focus Extension (Manifest V3)

A Chrome extension that starts fixed-duration focus sessions, grayscales pages, and blocks distracting domains until the session ends.

## Folder structure

```text
focus-mode/
├── manifest.json
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

- `popup.*` starts/ends sessions and shows task + remaining time.
- `background.js` stores session state in `chrome.storage.local`, restores on startup, sets an alarm for session expiry, and redirects blocked domains to `focus.html`.
- `content.js` applies/removes grayscale based on active session state.
- `focus.*` shows the blocking screen with current task and options to go back or end session.

## Load & test in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose this folder (`/workspace/focus-mode`).
4. Open the extension popup.
5. Enter a task and duration (minutes), then click **Start Session**.
6. Visit a blocked domain (e.g., youtube.com) and confirm redirect to `focus.html`.
7. Confirm grayscale applies on normal pages.
8. Click **End Session** from popup or `focus.html` and verify access + normal colors return.
9. Restart Chrome and confirm active sessions persist and still enforce blocking.

## Blocked domain list

- YouTube, Twitter/X, Instagram, Facebook, TikTok, Reddit
- News sites: Google News, NYTimes, Washington Post, CNN, Fox News, BBC, The Guardian, WSJ, Bloomberg
