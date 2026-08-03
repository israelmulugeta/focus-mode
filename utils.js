export const COLUMNS = ['ID', 'Test Case', 'Steps', 'Expected Result', 'Priority', 'Status'];
export const todayStamp = () => new Date().toISOString().slice(0, 10);
export function normalizeNewlines(text) { return String(text || '').replace(/\r\n?/g, '\n'); }
export function collapseInline(text) { return normalizeNewlines(text).split('\n').map((l) => l.trim()).filter(Boolean).join(' '); }
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function debounce(fn, wait = 150) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }
export function downloadBlob(content, filename, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
export function validationFor(records, skipped) { const counts = new Map(); records.forEach((r) => counts.set(r.id, (counts.get(r.id) || 0) + 1)); const duplicateIds = [...counts].filter(([, c]) => c > 1).map(([id]) => id); return { recordsParsed: records.length, duplicateIds, missingPriority: records.filter((r) => !r.priority).length, missingExpectedResult: records.filter((r) => !r.expectedResult.trim()).length, missingSteps: records.filter((r) => !r.steps.trim()).length, skippedRecords: skipped.length }; }
