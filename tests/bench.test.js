// The web-vs-Unity benchmark's own pieces (scripts/bench/): the statistics, the viewpoints both sides
// read, and the quiet-machine gate's report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stats, hitches, median, quietCheck, options } from '../scripts/bench/lib.mjs';

const VP = JSON.parse(readFileSync(new URL('../scripts/bench/viewpoints.json', import.meta.url), 'utf8'));

test('stats: median, percentiles, mean and max of the positive finite values', () => {
  const a = Array.from({ length: 100 }, (_, i) => i + 1);
  const s = stats([...a, NaN, -1, 0, Infinity]);
  assert.equal(s.n, 100);
  assert.equal(s.median, 51);
  assert.equal(s.p95, 96);
  assert.equal(s.p99, 100);
  assert.equal(s.max, 100);
  assert.equal(s.mean, 50.5);
  assert.equal(stats([]), null);
  assert.equal(median([3, 1, 2]), 2);
});

test('hitches: frames over twice the median and 4 ms more', () => {
  assert.equal(hitches([5, 5, 5, 11, 9, 30], 5), 2);   // 11 and 30 (9 is under twice the median)
  assert.equal(hitches([2, 2, 5, 6.5], 2), 1);         // 5 is 2.5x but not 4 ms more; 6.5 is both
});

test('options: --key value pairs, flags', () => {
  assert.deepEqual(options(['--preset', 'high', '--res', '1280x720', '--strict']), { preset: 'high', res: '1280x720', strict: true });
});

test('viewpoints: every view has the traveller, an eye, a target and a fov; the hour and weather are fixed', () => {
  assert.ok(Number.isFinite(VP.hour) && typeof VP.weather === 'string');
  const names = VP.views.map((v) => v.name);
  for (const n of ['spawn', 'qanat-tree', 'camps', 'dunes', 'cave']) assert.ok(names.includes(n), n);
  for (const v of VP.views) {
    for (const k of ['player', 'eye', 'target']) assert.ok(v[k].length === 3 && v[k].every(Number.isFinite), `${v.name}.${k}`);
    assert.ok(v.fov > 20 && v.fov < 100);
    const d = Math.hypot(...v.eye.map((x, i) => x - v.target[i]));
    assert.ok(d > 1, `${v.name}: the eye is on its target`);
  }
});

test('viewpoints: each path is long enough for its speed and time, in steps of a metre', () => {
  assert.ok(VP.paths.some((p) => p.name === 'ride-city') && VP.paths.some((p) => p.name === 'walk-camps'));
  for (const p of VP.paths) {
    assert.ok((p.points.length - 1) * p.step >= p.speed * p.secs, p.name);
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1].p, b = p.points[i].p;
      const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
      assert.ok(d < 1.6, `${p.name}: a ${d.toFixed(2)} m step at ${i}`);
      assert.ok(Math.abs(b[1] - a[1]) < 3, `${p.name}: a ${(b[1] - a[1]).toFixed(2)} m jump at ${i}`);
    }
  }
});

test('the quiet gate reports what it saw', () => {
  const q = quietCheck();
  assert.equal(typeof q.quiet, 'boolean');
  assert.ok(Array.isArray(q.reasons) && Array.isArray(q.seen));
  assert.equal(q.quiet, q.reasons.length === 0);
  assert.equal(q.load.length, 3);
});
