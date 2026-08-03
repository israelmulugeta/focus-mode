import { COLUMNS, todayStamp } from './utils.js';
const clean = (value) => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
const rowValues = (r) => [r.id, r.testCase, r.steps, r.expectedResult, r.priority, r.status];
export function recordsToTsv(records, includeHeader = true) { const rows = records.map((r) => rowValues(r).map(clean).join('\t')); return (includeHeader ? [COLUMNS.join('\t'), ...rows] : rows).join('\n'); }
function csvCell(value) { const v = clean(value); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
export function recordsToCsv(records) { return [COLUMNS.map(csvCell).join(','), ...records.map((r) => rowValues(r).map(csvCell).join(','))].join('\n'); }
export const tsvFilename = () => `qa_test_cases_${todayStamp()}.tsv`;
export const csvFilename = () => `qa_test_cases_${todayStamp()}.csv`;
