// Pieces that follow physics (issues #753, #754, src/enemies/debris.js): the one small rigid-body integrator a foe's
// pieces and its knocked-off plates fly on. Deterministic, they land on the ground and its slope, bounce, tumble onto a
// face, slide to a stop and sleep.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Piece, stepPiece, DEBRIS, throwFrom, groundPlane } from '../src/enemies/debris.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = () => 0;
const slope = (deg) => { const k = Math.tan((deg * Math.PI) / 180); return (x) => -k * x; };   // (down toward +x)
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const plate = (o = {}) => new Piece({ pos: v(0, 1.5, 0), q: new THREE.Quaternion(), half: v(0.18, 0.025, 0.12), vel: v(2.5, 3, 0.4), spin: v(6, -4, 5), ...o });
const corners = (P) => { const out = []; for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) out.push(v(a * P.half.x, b * P.half.y, c * P.half.z).applyQuaternion(P.q).add(P.pos)); return out; };
const run = (P, ground, secs = 6) => { const trace = []; for (let i = 0; i < secs * 60; i++) { stepPiece(P, 1 / 60, ground); trace.push(P.pos.y); } return trace; };

test('the same throw lands the same way (no clock, no Math.random)', () => {
  const a = plate(), b = plate();
  run(a, flat); run(b, flat);
  assert.deepEqual(a.pos.toArray(), b.pos.toArray());
  assert.deepEqual(a.q.toArray(), b.q.toArray());
  const t1 = throwFrom(v(1, 1, 0), v(), { rng: seeded(7), blow: 2, dir: v(0, 0, 1) }), t2 = throwFrom(v(1, 1, 0), v(), { rng: seeded(7), blow: 2, dir: v(0, 0, 1) });
  assert.deepEqual(t1.vel.toArray(), t2.vel.toArray());
  assert.ok(t1.vel.x > 0 && t1.vel.z > 0 && t1.vel.y > 0, 'out from the blast, along the blow, up');
});

test('a plate falls, bounces, tumbles onto a face and sleeps on flat ground, no corner under it', () => {
  const P = plate(), ys = run(P, flat);
  assert.ok(P.asleep, 'asleep within 6 s');
  assert.ok(P.hits >= 1, `it bounced (${P.hits} hard landings)`);
  // (lying flat: its thin axis upright, its centre half its thickness over the ground)
  const thin = v(0, 1, 0).applyQuaternion(P.q);
  assert.ok(Math.abs(thin.y) > 0.97, `lying on a face (${thin.y.toFixed(3)})`);
  assert.ok(Math.abs(P.pos.y - P.half.y) < 0.01, `on the ground (${P.pos.y.toFixed(3)})`);
  for (const c of corners(P)) assert.ok(c.y > -0.012, `a corner ${c.y.toFixed(3)} m under`);
  assert.ok(Math.min(...ys) > -0.05, 'never through the ground');
  assert.ok(Math.hypot(P.pos.x, P.pos.z) > 0.3, 'it went somewhere');
});

test('on a 20° slope it rests (friction holds it), lying on the slope, no corner under the ground', () => {
  const G = slope(20), P = plate({ vel: v(0.5, 1, 0.3) });
  run(P, G, 8);
  assert.ok(P.asleep, 'asleep on the slope');
  for (const c of corners(P)) assert.ok(c.y - G(c.x) > -0.015, `a corner ${(c.y - G(c.x)).toFixed(3)} m under the slope`);
  const n = v(Math.sin(20 * Math.PI / 180), Math.cos(20 * Math.PI / 180), 0), thin = v(0, 1, 0).applyQuaternion(P.q);
  assert.ok(Math.abs(thin.dot(n)) > 0.95, `lying on the slope's face (${thin.dot(n).toFixed(3)})`);
});

test('on a steep 40° slope it slides and tumbles down it', () => {
  const G = slope(40), P = plate({ vel: v(0, 0, 0), spin: v(0, 0, 0), pos: v(0, 0.3, 0) });
  run(P, G, 2);
  assert.ok(P.pos.x > 0.6, `down the slope (${P.pos.x.toFixed(2)} m)`);
});

test('the ground plane: its height and its slope from three reads', () => {
  const n = v();
  assert.equal(groundPlane(slope(30), 1, 5, 0, n), -Math.tan(Math.PI / 6));
  assert.ok(Math.abs(n.angleTo(v(0, 1, 0)) - Math.PI / 6) < 1e-6 && n.x > 0, 'its normal tipped down the slope');
  assert.equal(groundPlane(() => null, 0, 0, 0, n), -Infinity);
});

test('cheap: 48 pieces flying 2 s, then asleep (no ground reads)', () => {
  let reads = 0;
  const G = (x) => { reads++; return 0; }, rng = seeded(3);
  const pieces = Array.from({ length: DEBRIS.max }, (_, i) => { const t = throwFrom(v(Math.sin(i), 1, Math.cos(i)), v(0, 0.8, 0), { rng }); return new Piece({ pos: v(Math.sin(i) * 0.3, 1, Math.cos(i) * 0.3), q: new THREE.Quaternion(), half: v(0.08 + 0.05 * rng(), 0.04, 0.06), vel: t.vel, spin: t.spin }); });
  const t0 = performance.now();
  for (let f = 0; f < 120; f++) for (const P of pieces) stepPiece(P, 1 / 60, G);
  const ms = (performance.now() - t0) / 120;
  assert.ok(ms < 2, `${ms.toFixed(3)} ms a frame for ${DEBRIS.max}`);
  for (let f = 0; f < 360; f++) for (const P of pieces) stepPiece(P, 1 / 60, G);
  assert.ok(pieces.every((P) => P.asleep), `${pieces.filter((P) => !P.asleep).length} still moving after 8 s`);
  const before = reads; for (const P of pieces) stepPiece(P, 1 / 60, G);
  assert.equal(reads, before, 'asleep: no reads');
});
