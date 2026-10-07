// The loading pen's stops (scripts/transition-perf/pen-stops.mjs): what pen.mjs and pen-android.mjs report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { penStops, turn } from '../scripts/transition-perf/pen-stops.mjs';

const smooth = (from, n, t0 = 0, a0 = 0) => Array.from({ length: n }, (_, i) => ({ t: t0 + (from + i) * 1000 / 60, a: ((a0 + (from + i) * 2.5 + 180) % 360) - 180 }));

test('turn folds the angle difference across ±180°', () => {
  assert.equal(turn(170, -170), 20);
  assert.equal(turn(-170, 170), -20);
  assert.equal(turn(10, 12.5), 2.5);
});

test('a pen turning every refresh: stops of one refresh, 150° a second', () => {
  const s = penStops(smooth(0, 300));
  assert.equal(s.stopMax, 17);
  assert.equal(s.over50, 0);
  assert.equal(s.over100, 0);
  assert.equal(s.degPerS, 150);
});

test('a frozen pen: frames that repeat its angle, or no frames at all, both count as one stop', () => {
  // 0.3 s with frames but the pen still, then 0.2 s without a frame (a screen recording of a still screen)
  const a = smooth(0, 60);
  const last = a[a.length - 1];
  const still = Array.from({ length: 18 }, (_, i) => ({ t: last.t + (i + 1) * 1000 / 60, a: last.a }));
  const b = smooth(0, 60, still[still.length - 1].t + 1000 / 60, last.a + 2.5);
  const gap = smooth(0, 60, b[b.length - 1].t + 200, b[b.length - 1].a + 2.5);
  const s = penStops([...a, ...still, ...b, ...gap]);
  assert.equal(s.over100, 2);
  assert.deepEqual(s.long, [317, 200]);
  assert.equal(s.over250, 1);
  assert.equal(s.stoppedS, 0.52);
});

test('frames without the pen (the game already showing) are left out', () => {
  const s = penStops([...smooth(0, 30), { t: 600, a: null }, { t: 700, a: null }]);
  assert.equal(s.frames, 30);
  assert.equal(s.over100, 0);
});
