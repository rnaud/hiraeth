// The even frame rate (src/frame-pace.js): every second refresh while the main thread is too slow for every one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer, PACE } from '../src/frame-pace.js';
import { QUALITY_PRESETS } from '../src/perf.js';

const P = 1000 / 60;

test('no pace: every refresh drawn, whatever the frames cost', () => {
  const p = new FramePacer();
  for (let i = 0; i < 10; i++) assert.equal(p.judge(40, P, undefined), 1);
  for (let i = 0; i < 6; i++) assert.equal(p.skip(i * P), false);
});

test('auto: slow windows running → every second refresh; quick ones running → every refresh again', () => {
  const p = new FramePacer();
  for (let i = 1; i < PACE.slowWindows; i++) assert.equal(p.judge(20, P, 'auto'), 1);
  assert.equal(p.judge(20, P, 'auto'), 2);
  assert.equal(p.interval, 2 * P);
  // (one quick window among slow ones is not enough)
  for (let i = 1; i < PACE.quickWindows; i++) p.judge(8, P, 'auto');
  assert.equal(p.judge(15, P, 'auto'), 2);
  for (let i = 1; i < PACE.quickWindows; i++) assert.equal(p.judge(8, P, 'auto'), 2);
  assert.equal(p.judge(8, P, 'auto'), 1);
});

test('a slow window in between resets the count', () => {
  const p = new FramePacer();
  p.judge(20, P, 'auto'); p.judge(20, P, 'auto'); p.judge(10, P, 'auto'); p.judge(20, P, 'auto');
  assert.equal(p.every, 1);
});

test('paced: every second animation frame left out, a late one never held back', () => {
  const p = new FramePacer();
  p.every = 2;
  const drawn = [];
  for (let i = 0; i < 12; i++) { const ts = 1000 + i * P + (i % 3) * 0.4; if (!p.skip(ts)) drawn.push(i); }
  assert.deepEqual(drawn, [0, 2, 4, 6, 8, 10]);
  // a frame that took 40 ms: the next callback comes late and is drawn at once
  const q = new FramePacer();
  q.every = 2;
  assert.equal(q.skip(1000), false);
  assert.equal(q.skip(1000 + 3 * P), false);
});

test('the refresh is read only while drawing every one', () => {
  const p = new FramePacer();
  p.judge(5, 8.33, undefined);
  assert.ok(Math.abs(p.period - 8.33) < 1e-9);
  p.every = 2;
  p.judge(30, 16.7, 'auto');
  assert.ok(Math.abs(p.period - 8.33) < 1e-9);
});

test('only the Xbox paces, with the Deck’s shadows', () => {
  for (const [k, q] of Object.entries(QUALITY_PRESETS)) if (k !== 'xbox') assert.equal(q.pace, undefined, k);
  const x = QUALITY_PRESETS.xbox;
  assert.equal(x.pace, 'auto');
  assert.deepEqual(x.shadow, QUALITY_PRESETS.deck.shadow);
  assert.equal(x.nearEvery, 2);
  assert.ok(x.dynamic.cpuBound > 0, 'a slow main thread drops no resolution');
});
