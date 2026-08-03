import { parseTestCases } from './parser.js';
import { recordsToCsv, recordsToTsv, csvFilename, tsvFilename } from './export.js';
import { COLUMNS, debounce, downloadBlob, escapeHtml } from './utils.js';
import { loadSettings, saveSettings } from './storage.js';

const $ = (id) => document.getElementById(id);
let records = [], rawText = '', wordWrap = true, mode = 'raw';
const els = ['uploadBtn','pasteBtn','clearBtn','convertBtn','themeBtn','fileInput','dropZone','fileMeta','pastePanel','manualInput','progressText','progressBar','validationGrid','errorBox','artifactViewer','excelPreview','rawModeBtn','previewModeBtn','searchInput','wrapBtn','copyBtn','downloadTsvBtn','downloadCsvBtn','copyNoHeaderBtn'].reduce((a, id) => (a[id]=$(id), a), {});

init();
async function init() { const s = await loadSettings(); wordWrap = s.wordWrap; rawText = s.lastText || ''; els.manualInput.value = rawText; document.body.dataset.theme = s.theme; renderEmpty(); bind(); updateWrap(); }
function bind() {
  els.uploadBtn.onclick = () => els.fileInput.click(); els.dropZone.onclick = () => els.fileInput.click();
  els.fileInput.onchange = () => readFile(els.fileInput.files[0]);
  els.pasteBtn.onclick = () => { els.pastePanel.hidden = !els.pastePanel.hidden; els.manualInput.focus(); };
  els.clearBtn.onclick = clearAll; els.convertBtn.onclick = convert; els.themeBtn.onclick = toggleTheme;
  els.wrapBtn.onclick = () => { wordWrap = !wordWrap; saveSettings({ wordWrap }); updateWrap(); renderArtifact(); };
  els.copyBtn.onclick = () => copy(recordsToTsv(records), 'TSV copied.'); els.copyNoHeaderBtn.onclick = () => copy(recordsToTsv(records, false), 'TSV without header copied.');
  els.downloadTsvBtn.onclick = () => downloadBlob(recordsToTsv(records), tsvFilename(), 'text/tab-separated-values;charset=utf-8');
  els.downloadCsvBtn.onclick = () => downloadBlob(recordsToCsv(records), csvFilename(), 'text/csv;charset=utf-8');
  els.rawModeBtn.onclick = () => setMode('raw'); els.previewModeBtn.onclick = () => setMode('preview');
  els.searchInput.oninput = debounce(renderArtifact, 100); els.manualInput.oninput = debounce(() => { rawText = els.manualInput.value; saveSettings({ lastText: rawText }); }, 200);
  ['dragenter','dragover'].forEach((e) => els.dropZone.addEventListener(e, (ev) => { ev.preventDefault(); els.dropZone.classList.add('drag'); }));
  ['dragleave','drop'].forEach((e) => els.dropZone.addEventListener(e, (ev) => { ev.preventDefault(); els.dropZone.classList.remove('drag'); }));
  els.dropZone.addEventListener('drop', (ev) => readFile(ev.dataTransfer.files[0]));
  document.addEventListener('keydown', shortcuts); window.addEventListener('resize', debounce(() => saveSettings({ windowSize: { width: innerWidth, height: innerHeight } }), 300));
}
function shortcuts(e) { const k = e.key.toLowerCase(); if (e.ctrlKey && k === 'o') { e.preventDefault(); els.fileInput.click(); } if (e.ctrlKey && e.key === 'Enter') convert(); if (e.ctrlKey && e.shiftKey && k === 'c') { e.preventDefault(); els.copyBtn.click(); } if (e.ctrlKey && k === 'f') { e.preventDefault(); els.searchInput.focus(); } if (e.ctrlKey && k === 's') { e.preventDefault(); els.downloadTsvBtn.click(); } }
async function readFile(file) { if (!file) return; try { setProgress('Uploading...', 25); if (!/text|\.txt$/i.test(file.type || file.name)) throw new Error('Please choose a readable plain text .txt file.'); rawText = await file.text(); if (!rawText.trim()) throw new Error('The selected file is empty.'); els.manualInput.value = rawText; els.fileMeta.textContent = `${file.name} • ${rawText.length.toLocaleString()} chars`; await saveSettings({ lastText: rawText }); setProgress('Done.', 100); } catch (err) { showError(err.message); } }
async function convert() { try { showError(''); rawText = els.manualInput.value || rawText; setProgress('Parsing...', 45); await pause(); const result = parseTestCases(rawText); records = result.records; setProgress('Generating TSV...', 75); renderValidation(result.validation); renderArtifact(); renderPreview(); setProgress('Done.', 100); } catch (err) { records = []; renderEmpty(); showError(err.message); setProgress('Ready.', 0); } }
function renderValidation(v) { const items = [['Records Parsed', v.recordsParsed], ['Duplicate IDs', v.duplicateIds.length ? v.duplicateIds.join(', ') : 0], ['Missing Priority', v.missingPriority], ['Missing Expected Result', v.missingExpectedResult], ['Missing Steps', v.missingSteps], ['Skipped Records', v.skippedRecords]]; els.validationGrid.innerHTML = items.map(([l, n]) => `<div><strong>${escapeHtml(n)}</strong><span>${l}</span></div>`).join(''); }
function renderArtifact() { const tsv = recordsToTsv(records); const q = els.searchInput.value.trim(); const lines = tsv.split('\n'); els.artifactViewer.innerHTML = lines.map((line, i) => { let html = escapeHtml(line).replace(/\t/g, '<span class="tab">→\t</span>'); if (q) html = html.replaceAll(escapeHtml(q), `<mark>${escapeHtml(q)}</mark>`); const bad = i && records[i-1]?.invalid.length ? ' invalid' : ''; return `<div class="code-line${bad}"><span class="ln">${i + 1}</span><code>${html || ' '}</code></div>`; }).join(''); }
function renderPreview() { let html = `<table><thead><tr>${COLUMNS.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>`; html += records.map((r, ri) => `<tr class="${r.invalid.length ? 'invalid' : ''}" title="${escapeHtml(r.invalid.join(', '))}">${COLUMNS.map((c) => { const key = { 'ID':'id','Test Case':'testCase','Steps':'steps','Expected Result':'expectedResult','Priority':'priority','Status':'status' }[c]; return `<td contenteditable data-row="${ri}" data-key="${key}">${escapeHtml(r[key])}</td>`; }).join('')}</tr>`).join(''); els.excelPreview.innerHTML = `${html}</tbody></table>`; els.excelPreview.querySelectorAll('td').forEach((td) => td.oninput = () => { records[td.dataset.row][td.dataset.key] = td.textContent; renderArtifact(); }); }
function renderEmpty() { els.artifactViewer.innerHTML = '<div class="empty">Converted TSV will appear here with line numbers.</div>'; els.excelPreview.innerHTML = '<div class="empty">Excel Preview will appear after conversion.</div>'; renderValidation({ recordsParsed:0, duplicateIds:[], missingPriority:0, missingExpectedResult:0, missingSteps:0, skippedRecords:0 }); }
function setMode(next) { mode = next; els.artifactViewer.hidden = mode !== 'raw'; els.excelPreview.hidden = mode !== 'preview'; els.rawModeBtn.classList.toggle('active', mode === 'raw'); els.previewModeBtn.classList.toggle('active', mode === 'preview'); }
function updateWrap() { els.artifactViewer.classList.toggle('wrap', wordWrap); els.wrapBtn.classList.toggle('active', wordWrap); }
function clearAll() { records = []; rawText = ''; els.manualInput.value = ''; els.fileMeta.textContent = 'No file selected'; saveSettings({ lastText: '' }); renderEmpty(); setProgress('Ready.', 0); showError(''); }
function setProgress(text, pct) { els.progressText.textContent = text; els.progressBar.style.width = `${pct}%`; }
function showError(msg) { els.errorBox.hidden = !msg; els.errorBox.textContent = msg; }
function pause() { return new Promise((r) => setTimeout(r, 25)); }
async function copy(text, msg) { if (!records.length) return showError('Convert test cases before copying.'); await navigator.clipboard.writeText(text); setProgress(msg, 100); }
function toggleTheme() { const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; document.body.dataset.theme = theme; saveSettings({ theme }); }
