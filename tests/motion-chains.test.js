// The locomotion kit's phase 4 (src/motion-kit/chain.js, src/motion-kit/wave-legs.js; docs/systems/procedural-animation.md
// §5 "Chains"): the path trail a body follows exactly, follow-the-leader with angle limits, travelling waves on a
// phase accumulator, metachronal legs on distance; and the chain archetypes measured through the game's own models
// (scripts/motion-audit/chains.mjs): bodies on their heads' paths, wing beats by speed, the jelly's pulse as a tell.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PathTrail, FollowChain, Wave } from '../src/motion-kit/chain.js';
import { WaveLegs } from '../src/motion-kit/wave-legs.js';
import { chainReport } from '../scripts/motion-audit/chains.mjs';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('a path trail: points back along the path the head took, at fixed distances; a body on it never leaves the path', () => {
  const t = new PathTrail({ spacing: 0.05, length: 4 }), head = v(), p = v(), d = v();
  const path = [];
  for (let i = 0; i < 600; i++) { head.set(Math.sin(i / 60) * 2, 0, i * 0.02); t.update(head); path.push(head.clone()); }
  assert.ok(Math.abs(t.travelled - path.reduce((s, q, i) => s + (i ? q.distanceTo(path[i - 1]) : 0), 0)) < 1e-6, 'it counts the distance');
  for (const s of [0.5, 1.3, 2.9]) {
    t.at(s, p, d);
    const near = Math.min(...path.map((q) => q.distanceTo(p)));
    assert.ok(near < 0.03, `${s} m back: on the path (${near.toFixed(3)})`);
    assert.ok(Math.abs(d.length() - 1) < 1e-6, 'its heading there is a unit');
  }
  // arc length: s back along it is s along the path
  let arc = 0; t.at(0, p); const a = p.clone(); t.at(1, p);
  for (let i = path.length - 1; i > 0 && path[i].distanceTo(p) > 0.03; i--) arc += path[i].distanceTo(path[i - 1]);
  assert.ok(Math.abs(arc - 1) < 0.06, `1 m back is 1 m of path (${arc.toFixed(3)})`); void a;
  // seeded as a coil, the trail lays the shape out behind the head
  t.seed(v(), (s) => ({ x: Math.sin(s), z: -Math.cos(s) + 1 }));
  t.at(Math.PI / 2, p);
  assert.ok(p.distanceTo(v(1, 0, 1)) < 0.06, 'the seed shape');
});

test('follow-the-leader: each link at its length behind the last, bent no more than its limit; it settles straight behind', () => {
  const c = new FollowChain({ n: 6, length: 0.3, maxBend: 0.4 }), head = v();
  for (let i = 0; i < 200; i++) { head.set(Math.sin(i / 10) * 1.5, 0, i * 0.05); c.update(head, v(0, 0, -1)); }
  const P = c.points;
  for (let i = 1; i < P.length; i++) assert.ok(Math.abs(P[i].distanceTo(P[i - 1]) - 0.3) < 1e-9, `link ${i}: its length`);
  for (let i = 2; i < P.length; i++) {
    const a = P[i - 1].clone().sub(P[i - 2]).normalize(), b = P[i].clone().sub(P[i - 1]).normalize();
    assert.ok(Math.acos(Math.min(1, a.dot(b))) <= 0.4 + 1e-6, `joint ${i - 1}: within its limit`);
  }
  const s = new FollowChain({ n: 4, length: 0.2, maxBend: 1, straighten: 5 });
  for (let i = 0; i < 300; i++) s.update(v(), v(1, 0, 0), 1 / 60);
  assert.ok(s.points.at(-1).distanceTo(v(0.8, 0, 0)) < 0.01, 'a whip settles back along its rest');
});

test('a travelling wave: the rate changes, the motion never jumps; joint i trails the root by i × lag', () => {
  const w = new Wave(0);
  let last = w.angle(0, 1, 0), worst = 0;
  for (let i = 0; i < 600; i++) { w.update(1 / 60, i < 300 ? 1 : 3); const a = w.angle(0, 1, 0); worst = Math.max(worst, Math.abs(a - last)); last = a; }
  assert.ok(worst < 2 * Math.PI * 3 / 60 + 1e-6, `no jump when the rate changes (${worst.toFixed(3)})`);
  assert.ok(Math.abs(w.cycles + w.phase - (300 / 60 + 900 / 60)) < 1e-6, 'it counts its cycles');
  const u = new Wave(0.25);
  assert.ok(Math.abs(u.angle(0, 1, 0) - 1) < 1e-9 && Math.abs(u.angle(1, 1, Math.PI / 2)) < 1e-9, 'the next joint a quarter behind');
});

test('metachronal legs: a planted foot never moves; the wave runs on distance (still: every foot down); a pair steps apart', () => {
  const L = new WaveLegs({ n: 8, stride: 0.5, duty: 0.65, height: 0.1, lag: 0.6, seed: 0 });
  const fwd = v(0, 0, 1);
  let s = 0, slid = 0;
  const held = new Map();
  for (let f = 0; f < 600; f++) {
    s += 0.03;
    for (let i = 0; i < 8; i++) {
      const rest = v((i % 2 ? 1 : -1) * 0.5, 0, s - Math.floor(i / 2) * 0.4);
      const pos = L.update(i, s - Math.floor(i / 2) * 0.4, rest, fwd);
      const F = L.feet[i];
      if (F.planted) { if (held.has(i)) slid = Math.max(slid, held.get(i).distanceTo(pos)); else held.set(i, pos.clone()); }
      else held.delete(i);
      if (F.planted && f > 60) assert.ok(Math.abs(pos.z - rest.z) <= 0.5 * 0.65 * 0.5 + 0.035, `a stance foot stays within its reach (${(pos.z - rest.z).toFixed(3)})`);
    }
  }
  assert.equal(slid, 0, 'planted feet never move');
  assert.ok(L.feet.every((F) => F.steps > 10), 'they step');
  assert.ok(L.feet[0].off !== L.feet[1].off && Math.abs(((L.feet[1].off - L.feet[0].off + 1) % 1) - 0.5) < 1e-9, 'a pair half a cycle apart');
  // standing still, the phase stands: whatever was down stays down
  const before = L.feet.map((F) => F.pos.clone());
  for (let f = 0; f < 60; f++) for (let i = 0; i < 8; i++) L.update(i, s - Math.floor(i / 2) * 0.4, v((i % 2 ? 1 : -1) * 0.5, 0, s - Math.floor(i / 2) * 0.4), fwd);
  L.feet.forEach((F, i) => { if (F.planted) assert.ok(F.pos.distanceTo(before[i]) < 1e-9, `foot ${i} stays put`); });
});

test('the chain archetypes, measured: the centipede and the worm keep to their heads’ paths; the ray and the moth beat by speed, tips lagging; the jelly pulses faster as it winds up', () => {
  const r = chainReport();
  assert.ok(r.centipede.pathError < 0.05, `the centipede's segments on its path (${r.centipede.pathError.toFixed(3)} m)`);
  assert.ok(r.worm.pathError < 0.05, `the worm's mounds on its path (${r.worm.pathError.toFixed(3)} m)`);
  for (const k of ['ray', 'moth']) {
    assert.ok(r[k].beatHalf < r[k].beatFull * 0.95, `${k}: slower beats at half speed (${r[k].beatHalf.toFixed(2)} against ${r[k].beatFull.toFixed(2)})`);
    assert.ok(r[k].tipLag > 0.5, `${k}: the tip trails the root`);
  }
  assert.ok(r.ray.beatFull < 2 && r.moth.beatFull > 5, 'the ray glides on slow beats, the moth flutters');
  assert.ok(r.jelly.pulseWind > r.jelly.pulseDrift * 2.5, `the jelly's pulse quickens through a wind-up (${r.jelly.pulseDrift.toFixed(2)} → ${r.jelly.pulseWind.toFixed(2)})`);
});
