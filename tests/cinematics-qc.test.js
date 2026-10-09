import test from 'node:test';
import assert from 'node:assert/strict';
import { pickEntries, timeoutFor, spread, quatAngle, analyse, inkDensity, scoreTechnical, formatReport } from '../scripts/cinematics-qc.mjs';
import { CINEMATICS } from '../src/cinematics-page/catalog.js';

const Q0 = [0, 0, 0, 1];
/** A run of samples at 60 fps: idle, then `secs` playing with the camera moving along x, then idle. */
function run(secs, { cam = (t) => [t, 2, 0], extra = () => ({}), lead = 0.5, tail = 0.5 } = {}) {
  const out = [], dt = 1 / 60;
  for (let t = 0; t < lead + secs + tail; t += dt) {
    const playing = t >= lead && t < lead + secs;
    out.push({ t, playing, cam: playing ? cam(t - lead) : [0, 1, 0], q: Q0, fov: 50, hud: playing ? [] : ['cue'], bars: playing, skip: playing, sub: '', player: [0, 0, 0], db: -30, ...(playing ? extra(t - lead) : {}) });
  }
  return out;
}

test('picks entries by id, prefix and group from the review page\'s list', () => {
  assert.deepEqual(pickEntries(CINEMATICS, { only: ['desert.flow'] }).map((e) => e.id), ['desert.flow']);
  assert.ok(pickEntries(CINEMATICS, { only: ['box.desert*'] }).every((e) => e.id.startsWith('box.desert')));
  assert.equal(pickEntries(CINEMATICS, { group: 'World moments' }).length, CINEMATICS.filter((e) => e.group === 'World moments').length);
  assert.equal(pickEntries(CINEMATICS).length, CINEMATICS.length);
  assert.ok(timeoutFor({ id: 'prologue' }) > timeoutFor({ id: 'desert.flow' }));
});

test('spread keeps n evenly spaced frames, first and last', () => {
  assert.deepEqual(spread(10, 3), [0, 5, 9]);
  assert.deepEqual(spread(3, 8), [0, 1, 2]);
  assert.deepEqual(spread(0, 4), []);
  assert.equal(spread(100, 8).length, 8);
});

test('quaternion angle', () => {
  assert.ok(Math.abs(quatAngle(Q0, [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)]) - 90) < 1e-6);
  assert.equal(quatAngle(Q0, Q0), 0);
});

test('analyse finds the span, the cuts, the holds and a clean hand-back', () => {
  // three panels: a move, a hold, a move from somewhere else (two cuts)
  const cam = (t) => (t < 3 ? [t, 2, 0] : t < 6 ? [20, 2, 0] : [40 + t, 2, 5]);
  const a = analyse(run(9, { cam }));
  assert.ok(a.played && Math.abs(a.duration - 9) < 0.05);
  assert.equal(a.cuts, 2); assert.equal(a.shots, 3);
  assert.ok(a.longestHold > 2.8 && a.longestHold < 3.1, `hold ${a.longestHold}`);
  assert.ok(a.endedCleanly && a.skipShown && a.barsShare === 1);
  assert.deepEqual(a.hudLeaks, {});
  assert.equal(a.pops.length, 0);
});

test('analyse flags HUD leaks, a pop inside a still shot, the lens in a wall and loudness', () => {
  const cam = (t) => (t < 2 ? [0, 2, 0] : [0.6, 2, 0]);   // a 0.6 m jump between two still frames
  const a = analyse(run(4, { cam, extra: (t) => ({ hud: ['touch'], embedded: t > 1 && t < 2, db: t > 3 ? -3 : -30 }) }));
  assert.equal(a.pops.length, 1);
  assert.ok(a.hudLeaks.touch > 200);
  assert.ok(a.embedded > 50);
  assert.equal(a.peakDb, -3);
  const s = scoreTechnical(a);
  assert.ok(s.score < 3, `score ${s.score}`);
  assert.ok(s.why.some((w) => /HUD/.test(w)) && s.why.some((w) => /inside geometry/.test(w)) && s.why.some((w) => /pops/.test(w)) && s.why.some((w) => /loud/.test(w)));
});

test('a cinematic that never ends or never plays scores low', () => {
  const never = analyse(run(0));
  assert.equal(never.played, false);
  assert.equal(scoreTechnical(never, { status: 'Could not play: no box' }).score, 0);
  const stuck = analyse(run(5, { tail: 0 }));
  assert.equal(stuck.endedCleanly, false);
  assert.ok(scoreTechnical(stuck).why.includes('did not hand back control'));
  assert.equal(scoreTechnical(analyse(run(5))).score, 5);
  assert.ok(scoreTechnical(analyse(run(5)), { skip: { ok: false, why: 'still playing' } }).score <= 4);
});

test('ink density tells an inked frame from an empty one', () => {
  const W = 64, H = 64, flat = new Uint8Array(W * H * 3).fill(200), lines = flat.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 6) lines.set([20, 20, 20], (y * W + x) * 3);
  const e = inkDensity({ width: W, height: H, channels: 3, pixels: flat }), l = inkDensity({ width: W, height: H, channels: 3, pixels: lines });
  assert.equal(e.gradient, 0);
  assert.ok(l.gradient > 20 && l.edges > 0.1);
});

test('the report is one Markdown row per cinematic', () => {
  const a = analyse(run(5));
  const md = formatReport([{ entry: { id: 'x.y', group: 'G' }, analysis: a, tech: scoreTechnical(a), errors: [], skip: { ok: true, secs: 1.2 } }]);
  const rows = md.split('\n');
  assert.equal(rows.length, 3);
  assert.match(rows[2], /^\| x\.y \| G \| 5\.0 s \| 1 \|.*\| 5 \| ok 1\.2 s \|/);
});
