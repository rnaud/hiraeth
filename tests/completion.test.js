// What finishing the game takes, from its own data (tests/completion-spec.js, issue #670): nothing asked before it can be
// had in route order, every world on the chart in time, the ending's chain as the game evaluates it, and the
// play-through's route covering every world of it. The play-through itself (tests/playthrough.test.js) checks the spec
// against what it played: every world, every temple to its guardian, the core gadgets, `ending.final`.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import { completionSpec, specMarkdown, chartedAfter } from './completion-spec.js';
import { ORDER } from '../src/levels/names.js';
import { TEMPLES } from '../src/temples/index.js';

const spec = completionSpec();

test('the data asks for nothing out of route order: every temple’s items had by its world, every core gadget in its world, every world charted', () => {
  assert.deepEqual(spec.problems, [], specMarkdown(spec));
});

test('every temple belongs to a world on the route, once', () => {
  const listed = spec.worlds.flatMap((w) => w.temples.map((t) => t.id)).sort();
  assert.deepEqual(listed, Object.keys(TEMPLES).sort());
  for (const w of spec.worlds) for (const t of w.temples) assert.ok(t.guardian, `${t.name} has a guardian to finish it`);
});

test('the ending’s chain holds as the game’s own predicates evaluate it, and ends at ending.final', () => {
  for (const s of spec.ending.steps) assert.notEqual(s.holds, false, s.step);
  assert.equal(spec.ending.final, 'ending.final');
  assert.equal(spec.ending.steps.at(-1).sets, 'ending.final');
});

test('the chart: the desert from the start, each world after those before it, the true ending needs the market charted', () => {
  assert.equal(chartedAfter(ORDER[0]), 0);
  for (let i = 1; i < ORDER.length; i++) assert.ok(chartedAfter(ORDER[i]) <= i, `${ORDER[i]} charted by the time the worlds before it are done`);
  assert.ok(spec.minimum.worlds >= spec.ending.endingWorlds && spec.minimum.worlds <= ORDER.length, spec.minimum.why);
});

test('the play-through’s route plays every world of the spec, in its order', async () => {
  const { ROUTE } = await import('./playthrough-worlds.js');
  assert.deepEqual(ROUTE.map((r) => r.id), spec.order);
});

test('the daily run plays the game to its end in node and in Chrome, and keeps the evidence', async () => {
  const { readFileSync } = await import('node:fs');
  const yaml = readFileSync(new URL('../.github/workflows/nightly-tests.yml', import.meta.url), 'utf8');
  assert.match(yaml, /PLAYTHROUGH_OUT: completion-evidence\/node/);
  assert.match(yaml, /node --test tests\/completion\.test\.js tests\/playthrough\.test\.js/);
  assert.match(yaml, /node scripts\/playthrough-browser\.mjs --url http:\/\/127\.0\.0\.1:6101\/ --port 6101 --out completion-evidence\/browser/);
  assert.match(yaml, /name: completion-evidence/);
});
