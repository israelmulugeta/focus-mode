# QA Test Case TSV Converter

A local-only Chrome Extension (Manifest V3) that converts plain-text QA test cases into spreadsheet-ready TSV or CSV.

## Install as an unpacked extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Pin **QA Test Case TSV Converter** from the Extensions menu.

## Usage

1. Click the extension icon.
2. Upload a `.txt` file, drag and drop one into the upload area, or click **Paste Text**.
3. Click **Convert** or press `Ctrl + Enter`.
4. Review validation counts and inspect the TSV in the Artifact Viewer.
5. Switch to **Excel Preview** to edit parsed cells before exporting.
6. Use **Copy TSV**, **Download TSV**, **Download CSV**, or **Copy Without Header**.

## Supported input format

Each record must start with an ID such as `TC-1491`. Text after the ID and before the first numbered step becomes **Test Case**. Numbered lines beginning with `1.`, `2.`, `3.` become **Steps**. Text after the last numbered step and before `P1`, `P2`, or `P3` becomes **Expected Result**. Priority is exported as **Priority** and **Status** is intentionally blank.

The parser tolerates wrapped text, inconsistent spacing, tabs, extra blank lines, Windows newlines, Unix newlines, and records written mostly on one line.

## Keyboard shortcuts

- `Ctrl + O` opens the file picker.
- `Ctrl + Enter` converts the current input.
- `Ctrl + Shift + C` copies TSV.
- `Ctrl + F` focuses artifact search.
- `Ctrl + S` downloads TSV.

## Screenshots

Add screenshots here after loading the extension locally:

- Upload and conversion view
- Raw TSV Artifact Viewer
- Excel Preview editing mode

## Privacy

All parsing, previewing, copying, and downloading runs locally in Chrome. The extension has no backend, no API calls, no AI calls, and no external libraries.
