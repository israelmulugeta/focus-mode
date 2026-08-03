import { collapseInline, normalizeNewlines, validationFor } from './utils.js';
const ID_RE = /\bTC-\d+[A-Za-z0-9-]*\b/g;
const PRIORITY_RE = /\bP[123]\b/i;
const STEP_START_RE = /^\s*\d+\.\s*/;
const STEP_ANYWHERE_RE = /(?:^|\n|\s)(\d+\.\s+)/;

function splitRecords(text) {
  const matches = [...text.matchAll(ID_RE)];
  return matches.map((match, index) => ({ id: match[0], raw: text.slice(match.index, matches[index + 1]?.index ?? text.length).trim() }));
}
function findStepIndex(lines) { return lines.findIndex((line) => STEP_START_RE.test(line)); }
function parseSingle({ id, raw }) {
  let body = raw.replace(ID_RE, '').trim();
  const priorityMatch = [...body.matchAll(new RegExp(PRIORITY_RE, 'gi'))].pop();
  let priority = '';
  if (priorityMatch) { priority = priorityMatch[0].toUpperCase(); body = `${body.slice(0, priorityMatch.index)} ${body.slice(priorityMatch.index + priorityMatch[0].length)}`.trim(); }
  const lines = normalizeNewlines(body).split('\n').map((l) => l.trim()).filter(Boolean);
  let stepIndex = findStepIndex(lines);
  if (stepIndex === -1) {
    const inline = lines.join(' '); const m = inline.match(STEP_ANYWHERE_RE);
    if (m) { const before = inline.slice(0, m.index).trim(); const after = inline.slice(m.index).trim(); lines.splice(0, lines.length, before, after); stepIndex = before ? 1 : 0; }
  }
  const titleLines = stepIndex >= 0 ? lines.slice(0, stepIndex) : lines;
  const afterTitle = stepIndex >= 0 ? lines.slice(stepIndex) : [];
  let expectedIndex = afterTitle.length;
  for (let i = afterTitle.length - 1; i >= 0; i -= 1) { if (STEP_START_RE.test(afterTitle[i])) { expectedIndex = i + 1; break; } }
  const steps = afterTitle.slice(0, expectedIndex);
  const expected = afterTitle.slice(expectedIndex);
  const record = { id, testCase: collapseInline(titleLines.join('\n')), steps: collapseInline(steps.join('\n')), expectedResult: collapseInline(expected.join('\n')), priority, status: '', raw, invalid: [] };
  if (!record.steps) record.invalid.push('Missing Steps');
  if (!record.expectedResult) record.invalid.push('Missing Expected Result');
  if (!record.priority) record.invalid.push('Missing Priority');
  return record;
}
export function parseTestCases(input) {
  const text = normalizeNewlines(input).trim();
  if (!text) throw new Error('The input is empty. Upload a TXT file or paste test cases before converting.');
  const chunks = splitRecords(text);
  if (!chunks.length) throw new Error('No records were found. Each test case must begin with an ID like TC-1491.');
  const records = chunks.map(parseSingle);
  const ids = new Map(); records.forEach((r) => ids.set(r.id, (ids.get(r.id) || 0) + 1));
  records.forEach((r) => { if (ids.get(r.id) > 1) r.invalid.push('Duplicate ID'); });
  const skipped = [];
  return { records, skipped, validation: validationFor(records, skipped) };
}
