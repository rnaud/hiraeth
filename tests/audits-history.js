// Explicit <=1.87 dashboard fixture; new publications must not rewrite this historical coverage.
import { readFileSync } from 'node:fs';
import { auditsData } from '../scripts/audits-data.mjs';
import { compareVersions, cinematicVerdicts, buildIndex } from '../src/audits-page/parse.js';
import { themeOf } from '../src/audits-page/themes.js';
export function historicalAudits() {
  const reports = auditsData().reports.filter(r => compareVersions(r.version, '1.87') <= 0);
  const cine = reports.find(r => r.id === 'cinematics-v1.87');
  const { by, counts } = cinematicVerdicts(JSON.parse(readFileSync(new URL('./fixtures/audits-v187-verdicts.json', import.meta.url))));
  cine.verdicts = counts;
  for (const t of cine.scoreTables) for (const row of t.rows) if (by[row.id]) row.verdict = by[row.id];
  cine.theme = themeOf(cine, readFileSync(new URL('../docs/audits/cinematics-v1.87.md', import.meta.url), 'utf8'));
  return { reports, index: buildIndex(reports) };
}
