// The walkthrough against the play-through (issue #777). The site's walkthrough page (walkthrough.html,
// src/walkthrough-page/) is drawn from src/walkthrough-page/steps.js; tests/playthrough.test.js plays the game from a new
// game to the true ending and records every step it takes (tests/playthrough-agent.js TRACE: { id, how }). Here each part
// of the walkthrough (a world, home, the Lantern, the ending) is held against what was played in that part: the same
// steps, in the same order, done the same way. A part that differs names its first step that broke.
//
//   checkPart(part, played, testName) → { part, test, ok, message, steps: [{ id, how, ok, played? }] }
//   statusFile(parts, meta)           → the JSON the daily run writes beside its evidence (walkthrough-status.json):
//                                       per part and per step, passed or not, for the page's "last daily run" marks
//
// WALKTHROUGH_RECORD=<file>: also write what was played, part by part, as a skeleton of steps.js (when the route changes
// and the guide needs new steps written: docs/systems/testing.md, "The walkthrough").
import { writeFileSync } from 'node:fs';
import { WALKTHROUGH, stepsOf } from '../src/walkthrough-page/steps.js';

const RECORD = process.env.WALKTHROUGH_RECORD;
const recorded = {};

export function checkPart(partId, played, testName) {
  const part = WALKTHROUGH.find((p) => p.id === partId);
  if (RECORD) { recorded[partId] = played; writeFileSync(RECORD, JSON.stringify(recorded, null, 1)); }
  if (!part) return { part: partId, test: testName, ok: false, message: `the walkthrough has no part "${partId}" (src/walkthrough-page/steps.js)`, steps: [] };
  const want = stepsOf(part);
  const steps = [];
  let bad = -1;
  for (let i = 0; i < Math.max(want.length, played.length); i++) {
    const w = want[i], p = played[i];
    const ok = bad < 0 && !!w && !!p && w.id === p.id && w.how === p.how;
    if (!ok && bad < 0) bad = i;
    if (w) steps.push({ id: w.id, how: w.how, ok, ...(p && (p.id !== w.id || p.how !== w.how) ? { played: `${p.id} (${p.how})` } : {}) });
  }
  const ok = bad < 0 && part.test === testName;
  const say = (x) => (x ? `${x.id} (${x.how})` : 'nothing');
  const message = ok ? '' : part.test !== testName ? `the walkthrough's part "${partId}" names the test "${part.test}", but it is played in "${testName}"`
    : `the walkthrough's part "${partId}" (${part.title}) broke at its step ${bad + 1}: the guide says ${say(want[bad])}, the play-through did ${say(played[bad])}`
      + `${played.length !== want.length ? ` (the guide has ${want.length} steps, the play-through ${played.length})` : ''}`
      + '. A change to the route or a temple needs the guide changed with it: src/walkthrough-page/steps.js (WALKTHROUGH_RECORD=<file> writes what was played).';
  return { part: partId, test: testName, ok, message, steps };
}

export function statusFile(parts, meta = {}) {
  const E = process.env, run = E.GITHUB_RUN_ID && E.GITHUB_REPOSITORY ? `${E.GITHUB_SERVER_URL ?? 'https://github.com'}/${E.GITHUB_REPOSITORY}/actions/runs/${E.GITHUB_RUN_ID}` : null;
  return { kind: 'hiraeth-walkthrough-status', ...meta, run, ok: parts.every((p) => p.ok), parts: parts.map(({ part, test, ok, message, steps }) => ({ part, test, ok, message, steps: steps.map((s) => ({ id: s.id, ok: s.ok })) })) };
}
