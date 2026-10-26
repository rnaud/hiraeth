// The technical audit's frame statistics (scripts/tech-audit/stats.mjs; docs/audits/technical-v2.28.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { stats, stutters, low, summarize, blame } from '../scripts/tech-audit/stats.mjs';

test('the 1% low is the frame rate of the slowest 1% of frames, not the 99th percentile', () => {
  const ms = [...Array(990).fill(10), ...Array(10).fill(40)];
  assert.equal(Math.round(low(ms, 0.01)), 25);
  const s = stats(ms.map((x) => ({ ms: x })));
  assert.equal(s.low1_fps, 25);
  assert.equal(s.median, 10);
  assert.equal(s.worst, 40);
  assert.equal(s.over33, 10);
  assert.equal(s.over50, 0);
});

test('a stutter stands out from its neighbours; a steady slow stretch is not one', () => {
  const steady = Array(60).fill(30);
  assert.deepEqual(stutters(steady), [], 'a slow scene, evenly paced');
  const hitch = Array(60).fill(8); hitch[30] = 45; hitch[31] = 12;
  assert.deepEqual(stutters(hitch), [30], 'one frame five times its neighbours');
  const small = Array(60).fill(5); small[10] = 15;
  assert.deepEqual(stutters(small), [], 'three times its neighbours but under 20 ms: not felt at 60 Hz');
});

test('per phase and for all; the programs linked are counted', () => {
  const f = (ms, phase, link = 0) => ({ ms, phase, link, wait: link ? 30 : 0 });
  const s = summarize([f(10, 'run'), f(10, 'run'), f(60, 'spin', 1), f(10, 'spin'), f(1, 'menu')]);
  assert.equal(s.all.frames, 4, 'the menus left out of the whole');
  assert.equal(s.phases.menu.frames, 1);
  assert.equal(s.phases.run.frames, 2);
  assert.equal(s.phases.spin.links, 1);
  assert.equal(s.all.waitMs, 30);
});

test('blame: the functions by their own time inside a window of the recording', () => {
  const profile = {
    nodes: [{ id: 1, callFrame: { functionName: 'upload', url: 'http://x/assets/three.js', lineNumber: 9 } }, { id: 2, callFrame: { functionName: 'walk', url: 'http://x/assets/main.js', lineNumber: 0 } }],
    samples: [1, 1, 2, 1, 2], timeDeltas: [1000, 1000, 1000, 1000, 1000, 0],
  };
  // (samples at 1, 2, 3, 4, 5 ms after the profile's start at 100 ms: the window 101-104 holds the first four)
  const top = blame(profile, 100, 101, 104);
  assert.deepEqual(top, [['upload three.js:10', 3], ['walk main.js:1', 1]]);
});
