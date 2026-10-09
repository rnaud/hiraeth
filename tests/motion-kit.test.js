// The locomotion kit (src/motion-kit/, docs/systems/procedural-animation.md "The kit"): springs, IK, the gait
// planner, the body from the feet, the pose blend with the telegraph's timing, the detail tiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SecondOrder, SecondOrderAngle, expDamp, quantise, deadband } from '../src/motion-kit/spring.js';
import { twoBone, fabrik, bendAngle } from '../src/motion-kit/ik.js';
import { GaitPlanner, layoutLegs } from '../src/motion-kit/gait.js';
import { BodyFromFeet } from '../src/motion-kit/body.js';
import { PoseBlend, coilK } from '../src/motion-kit/pose.js';
import { Rig, TierHold, jointedLeg, TIERS } from '../src/motion-kit/rig.js';
import { PLANS, poleFor } from '../src/motion-kit/plans.js';
import { POSE_DONE } from '../src/telegraph.js';
import { correlation } from '../scripts/motion-audit/metrics.mjs';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- springs
test('a second-order spring settles on its target and stays stable from 10 to 240 fps', () => {
  for (const fps of [10, 24, 30, 60, 144, 240]) for (const [f, z] of [[3, 0.5], [8, 0.3], [1, 1], [12, 0.1]]) {
    if (z < 0.3 && fps < 30) continue;   // (a near-undamped spring at 10 fps wobbles long: bounded below, not settled)
    const s = new SecondOrder(f, z, 0, 0);
    let worst = 0;
    for (let i = 0; i < fps * 12; i++) { const y = s.update(1 / fps, 1); worst = Math.max(worst, Math.abs(y)); assert.ok(Number.isFinite(y), `${fps} fps f=${f}`); }
    assert.ok(worst < 3, `bounded at ${fps} fps f=${f} z=${z}: ${worst}`);
    assert.ok(Math.abs(s.y - 1) < 0.02, `settled at ${fps} fps f=${f} z=${z}: ${s.y}`);
  }
});

test('the damping sets the overshoot; r < 0 anticipates by going the wrong way first', () => {
  const peak = (f, z, r) => { const s = new SecondOrder(f, z, r, 0); let p = 0, low = 0; for (let i = 0; i < 300; i++) { const y = s.update(1 / 60, 1); p = Math.max(p, y); low = Math.min(low, y); } return { p, low }; };
  assert.ok(peak(3, 0.3, 0).p > 1.2, 'underdamped overshoots');
  assert.ok(peak(3, 1, 0).p < 1.01, 'critical does not');
  assert.ok(peak(3, 0.7, -1).low < -0.05, 'anticipation dips first');
  // the angle version turns the short way round
  const a = new SecondOrderAngle(4, 1, 0, 3.0);
  for (let i = 0; i < 120; i++) a.update(1 / 60, -3.0);
  assert.ok(Math.abs(Math.atan2(Math.sin(a.y + 3), Math.cos(a.y + 3))) < 0.02 && a.y > 3, `wrapped: ${a.y}`);
  assert.ok(Math.abs(expDamp(0, 1, 10, 1) - 1) < 1e-3);
  assert.equal(quantise(0.26, 0.1).toFixed(2), '0.30');
  assert.equal(deadband(1, 1.04, 0.05), 1); assert.equal(deadband(1, 1.1, 0.05), 1.1);
});

// ---------------------------------------------------------------- IK
test('two-bone IK reaches a target in reach, keeps its lengths, and stops short on the line to one out of reach', () => {
  const hip = v(0, 1, 0), knee = v(), end = v(), pole = v(0, 0, 1);
  for (const t of [v(0.3, 0.2, 0.4), v(-0.5, 0.4, 0.1), v(0, 0.1, 0)]) {
    const miss = twoBone(hip, t, 0.6, 0.55, pole, knee, end);
    assert.ok(miss < 1e-9 && end.distanceTo(t) < 1e-9, `reached ${t.toArray()}`);
    assert.ok(Math.abs(knee.distanceTo(hip) - 0.6) < 1e-9 && Math.abs(knee.distanceTo(end) - 0.55) < 1e-9);
  }
  const far = v(0, -3, 0), miss = twoBone(hip, far, 0.6, 0.55, pole, knee, end);
  assert.ok(miss > 1.5, 'reports the miss');
  assert.ok(end.distanceTo(hip) < 1.15 && end.distanceTo(hip) > 1.14, 'stops just short of full stretch');
  assert.ok(Math.abs(end.x) < 1e-9 && Math.abs(end.z) < 1e-9 && end.y < hip.y, 'on the line to the target');
  assert.ok(knee.z > 0, 'still bends to the pole side');
  // too close: folded as far as the lengths allow, not NaN
  twoBone(hip, hip.clone(), 0.6, 0.55, pole, knee, end);
  assert.ok(Number.isFinite(knee.x + knee.y + knee.z) && Number.isFinite(end.y));
});

test('the knee never flips through a straight leg: a target sweeping under the hip keeps it on the pole side', () => {
  const hip = v(0, 1, 0), knee = v(), end = v(), pole = v(0.7, 0.6, 0.2);
  let prev = null;
  for (let i = 0; i <= 200; i++) {
    const t = v(Math.sin(i * 0.05) * 0.9, 1 - 1.3 + Math.cos(i * 0.07) * 0.2, Math.cos(i * 0.05) * 0.3);   // (often beyond reach: straight)
    twoBone(hip, t, 0.6, 0.6, pole, knee, end);
    const side = knee.clone().sub(hip).sub(end.clone().sub(hip).multiplyScalar(0.5)).dot(pole);
    assert.ok(side >= -1e-6, `knee on the pole side at ${i}`);
    if (prev) assert.ok(knee.distanceTo(prev) < 0.2, `no jump at ${i}`);
    prev = knee.clone();
  }
  twoBone(hip, v(0.5, 0.2, 0), 0.6, 0.6, pole, knee, end);
  assert.ok(bendAngle(hip, knee, end) < Math.PI - 0.3, 'a near target bends the knee');
});

test('FABRIK reaches with three or more joints and stretches straight at a target out of reach', () => {
  const pts = [v(0, 0, 0), v(0, 1, 0), v(0, 2, 0), v(0, 3, 0)], lens = [1, 1, 1];
  const t = v(1.5, 1.5, 0.5);
  assert.ok(fabrik(pts, lens, t) < 1e-3);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(pts[i].distanceTo(pts[i + 1]) - 1) < 1e-3, 'lengths kept');
  assert.ok(pts[0].length() < 1e-9, 'root fixed');
  const far = v(10, 0, 0);
  fabrik(pts, lens, far);
  assert.ok(Math.abs(pts[3].x - 3) < 1e-6 && Math.abs(pts[3].y) < 1e-6, 'straight at it');
});

// ---------------------------------------------------------------- gait
const ring = (n, r = 1) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + Math.PI / n; return { x: Math.sin(a) * r, z: Math.cos(a) * r }; });
const rows = (perSide, x = 1, dz = 0.5) => { const h = []; for (const s of [1, -1]) for (let k = 0; k < perSide; k++) h.push({ x: s * x, z: ((perSide - 1) / 2 - k) * dz }); return h; };

test('the gait groups: a tripod on six legs, alternating tetrapods on eight, diagonal pairs on four, one at a time on three', () => {
  // rows(): left legs 0..n-1 front to back, then right legs
  const six = layoutLegs(rows(3));
  assert.deepEqual(six.groups.map((g) => g.slice().sort()), [[0, 2, 4], [1, 3, 5]], 'L1 L3 R2 | L2 R1 R3');
  const eight = layoutLegs(rows(4));
  assert.deepEqual(eight.groups.map((g) => g.slice().sort()), [[0, 2, 5, 7], [1, 3, 4, 6]], 'L1 R2 L3 R4 | R1 L2 R3 L4');
  const four = layoutLegs(rows(2));
  assert.deepEqual(four.groups.map((g) => g.slice().sort()), [[0, 3], [1, 2]], 'diagonals');
  const three = layoutLegs(ring(3));
  assert.equal(three.groups.length, 3);
  assert.ok(three.groups.every((g) => g.length === 1));
  // no group holds two neighbours
  for (const lay of [six, eight, four, three]) for (const g of lay.groups) for (const a of g) for (const b of g) assert.ok(!lay.neighbours[a].includes(b), `${a} and ${b} are neighbours in one group`);
});

/** Walk a planner `seconds` at `speed`, checking every frame; returns its record. */
function walk(planner, { speed = 2, seconds = 5, dt = 1 / 60, turn = 0, ground = () => 0, check = true } = {}) {
  const root = v(), heading = { h: 0 };
  const rec = { lifts: 0, touch: 0, heights: planner.feet.map(() => []), dist: 0 };
  const prev = planner.feet.map(() => null);
  for (let i = 0; i < seconds / dt; i++) {
    heading.h += turn * dt;
    const vx = Math.sin(heading.h) * speed, vz = Math.cos(heading.h) * speed;
    root.x += vx * dt; root.z += vz * dt; rec.dist += speed * dt;
    const before = planner.feet.map((f) => f.planted);
    const ev = planner.update(dt, root, heading.h, { x: vx, z: vz }, ground);
    rec.touch += ev.length;
    planner.feet.forEach((f, k) => {
      if (before[k] && !f.planted) rec.lifts++;
      rec.heights[k].push(f.pos.y);
      if (check && before[k] && f.planted && prev[k]) assert.ok(f.pos.distanceTo(prev[k]) < 1e-9, `planted foot ${k} slid at frame ${i}`);
      prev[k] = f.pos.clone();
    });
    if (check) {
      const up = planner.feet.map((f, k) => (f.planted ? -1 : k)).filter((k) => k >= 0);
      for (const a of up) for (const b of up) assert.ok(!planner.neighbours[a].includes(b), `neighbours ${a} and ${b} both up at frame ${i}`);
      const groups = new Set(up.map((k) => planner.feet[k].group));
      assert.ok(groups.size <= 1, `two groups up at once at frame ${i}`);
    }
  }
  return rec;
}

test('planted feet never slide, neighbours never lift together, groups never overlap (six, eight, four and three legs, walking and turning)', () => {
  for (const homes of [rows(3), rows(4), rows(2, 0.3, 0.8), ring(3, 0.6)]) {
    walk(new GaitPlanner({ homes, drift: 0.3, height: 0.1, seed: 3 }), { speed: 2.5 });
    walk(new GaitPlanner({ homes, drift: 0.3, height: 0.1, seed: 4 }), { speed: 0.8, turn: 1.2 });
    walk(new GaitPlanner({ homes, drift: 0.3, height: 0.1, seed: 5, arc: 'machine' }), { speed: 0, turn: 2 });   // (turning on the spot steps round)
  }
});

test('the cadence follows the speed; one ground ray per step; a touchdown for each landing', () => {
  const rate = (speed) => { const p = new GaitPlanner({ homes: rows(3), drift: 0.3, seed: 9 }); const r = walk(p, { speed, seconds: 8 }); return { r, p, perS: r.lifts / 8 }; };
  const full = rate(3), half = rate(1.5);
  assert.ok(half.perS < full.perS * 0.75 && half.perS > full.perS * 0.35, `steps/s ${full.perS} at 3 m/s, ${half.perS} at 1.5 m/s`);
  assert.equal(full.p.rays, full.r.lifts, 'one ray per step');
  assert.ok(Math.abs(full.r.touch - full.r.lifts) <= 6, 'every step lands');
  // the ray sets the landing height: up a step
  const p = new GaitPlanner({ homes: rows(3), drift: 0.3, seed: 2 });
  walk(p, { speed: 2, seconds: 3, ground: (x, y, z) => (z > 2 ? 0.4 : 0), check: false });
  assert.ok(p.feet.every((f) => !f.planted || Math.abs(f.pos.y - 0.4) < 1e-9), 'feet land on the higher ground');
});

test('a pack does not step in unison: two foes of a kind walk out of phase', () => {
  const pack = [11, 12, 13, 14, 15, 16].map((seed) => walk(new GaitPlanner({ homes: rows(3), drift: 0.3, seed }), { speed: 2.5, check: false }).heights[0]);
  let sum = 0, n = 0, same = 0;
  for (let a = 0; a < pack.length; a++) for (let b = a + 1; b < pack.length; b++) { const c = correlation(pack[a], pack[b]); sum += c; n++; if (c > 0.9) same++; }
  assert.ok(sum / n < 0.5, `six of a kind: leg 0 correlates ${(sum / n).toFixed(2)} on average`);
  assert.ok(same <= 2, `${same} of ${n} pairs in step`);
});

test('a wind-up braces the feet once, then nothing steps until it is released', () => {
  const p = new GaitPlanner({ homes: rows(3), drift: 0.3, seed: 6 });
  walk(p, { speed: 2, seconds: 2, check: false });
  p.setStance(true, 1.2);
  const root = v(0, 0, 4), vel = { x: 0, z: 0 };
  for (let i = 0; i < 40; i++) p.update(1 / 60, root, 0, vel, () => 0);   // (the brace)
  assert.ok(p.feet.every((f) => f.planted), 'braced');
  const held = p.feet.map((f) => f.pos.clone());
  for (let i = 0; i < 60; i++) { root.z += 0.01; p.update(1 / 60, root, 0, { x: 0, z: 0.6 }, () => 0); }
  p.feet.forEach((f, k) => assert.ok(f.pos.distanceTo(held[k]) < 1e-9, `foot ${k} held`));
  p.setStance(false);
  for (let i = 0; i < 60; i++) { root.z += 0.04; p.update(1 / 60, root, 0, { x: 0, z: 2.4 }, () => 0); }
  assert.ok(p.feet.some((f, k) => f.pos.distanceTo(held[k]) > 0.1), 'released: it walks again');
});

// ---------------------------------------------------------------- body from feet
test('the body follows the plane of its feet on a slope, dips while a group is up, and banks into a turn', () => {
  const run = (ground, turn = 0, speed = 1.5) => {
    const p = new GaitPlanner({ homes: rows(3, 0.8, 0.6), drift: 0.3, height: 0.12, seed: 1 }), b = new BodyFromFeet({ bob: 0.04, bank: 0.05, spring: { f: 4, z: 0.8, r: 0 } });
    const root = v(), ys = [], rolls = [];
    let h = 0;
    for (let i = 0; i < 240; i++) {
      h += turn / 60;
      root.x += Math.sin(h) * speed / 60; root.z += Math.cos(h) * speed / 60; root.y = ground(root.x, 0, root.z);
      p.update(1 / 60, root, h, { x: Math.sin(h) * speed, z: Math.cos(h) * speed }, ground);
      const o = b.update(1 / 60, p, root, h, { x: Math.sin(h) * speed, z: Math.cos(h) * speed });
      ys.push(o.y); rolls.push(o.roll);
    }
    return { o: b.out, ys, rolls };
  };
  const up = run((x, y, z) => z * 0.25);
  assert.ok(Math.abs(up.o.pitch + Math.atan(0.25)) < 0.08, `nose up the slope: ${up.o.pitch}`);
  const side = run((x) => x * 0.2);
  assert.ok(Math.abs(side.o.roll - Math.atan(0.2)) < 0.08, `left side up: ${side.o.roll}`);
  const flat = run(() => 0);
  const span = Math.max(...flat.ys.slice(60)) - Math.min(...flat.ys.slice(60));
  assert.ok(span > 0.01 && span < 0.08, `bobs with its steps: ${span}`);
  const turning = run(() => 0, 1.5, 2);
  assert.ok(turning.rolls.slice(120).reduce((s, r) => s + r, 0) / 120 < -0.02, 'leans into the turn');
});

// ---------------------------------------------------------------- the pose blend and the telegraph
test('the coil moves against the strike with the telegraph’s timing, holds still before the strike, then snaps through', () => {
  const poses = { coil: { y: -0.2, z: -0.15, pitch: -0.1, spread: 1.2 }, strike: { z: 0.2, pitch: 0.1 }, recover: { y: -0.1 } };
  const pb = new PoseBlend({ poses });
  const wind = 0.8, dt = 1 / 60, zs = [];
  for (let i = 0; i < 30; i++) pb.update(dt, { state: 'chase' });
  for (let t = 0; t < wind; t += dt) { const o = pb.update(dt, { state: 'wind', k: t / wind, atk: { id: 'x' } }); zs.push(o.z); assert.ok(o.lock, 'the feet lock through the wind-up'); assert.equal(o.spread, 1.2); }
  assert.ok(zs.every((z) => z <= 1e-9), 'the body only ever moves back (against the strike) while winding up');
  const at = Math.floor(zs.length * POSE_DONE);
  assert.ok(zs[at] < -0.12, `coiled by POSE_DONE: ${zs[at]}`);
  const tail = zs.slice(-Math.floor(zs.length * 0.12));
  assert.ok(Math.max(...tail) - Math.min(...tail) < 0.012, 'held still before the strike');
  assert.ok(coilK(POSE_DONE) === 1 && coilK(1) === 1 && coilK(0) === 0);
  let peak = -1;
  for (let i = 0; i < 18; i++) peak = Math.max(peak, pb.update(dt, { state: 'strike', k: i / 18, atk: { id: 'x' } }).z);
  assert.ok(peak > 0.2, `snaps through the strike pose with overshoot: ${peak}`);
  for (let i = 0; i < 120; i++) pb.update(dt, { state: 'recover', recovery: 1 - i / 120 });
  for (let i = 0; i < 60; i++) pb.update(dt, { state: 'chase' });
  assert.ok(Math.abs(pb.out.z) < 0.01 && Math.abs(pb.out.y) < 0.01 && !pb.out.lock, 'settles back to rest, unlocked');
  // a lunge travels: the feet are free through its strike
  assert.equal(pb.update(dt, { state: 'strike', k: 0.2, atk: { id: 'x', lunge: 4 } }).lock, false);
});

// ---------------------------------------------------------------- the rig: tiers and the stepped clock
function hexRig(extra = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.55; g.add(body);
  const mat = new THREE.MeshBasicMaterial(), plan = PLANS.walker;
  const legs = rows(3, 0.6, 0.3).map((h, i) => {
    const foot = { x: h.x * 1.9, z: h.z * 1.3 }, d = Math.hypot(foot.x - h.x, 0.5, foot.z - h.z);
    return jointedLeg({ group: g, body, hip: { x: h.x, y: -0.05, z: h.z }, foot, lenA: d * plan.knee.lenA, lenB: d * plan.knee.lenB, pole: poleFor('out-up', foot), mats: { joint: mat }, name: `leg ${i}` });
  });
  return { g, body, rig: new Rig({ plan, group: g, body, legs, seed: 5, ...extra }) };
}

test('detail tiers change only after 30 frames of asking; mid plans every 2nd frame; far runs the canned cycle', () => {
  const t = new TierHold();
  for (let i = 0; i < TIERS.hold - 1; i++) assert.equal(t.update(40), 'near', `held at ${i}`);
  assert.equal(t.update(40), 'mid');
  for (let i = 0; i < 10; i++) t.update(10);   // (a flicker back does not stick)
  for (let i = 0; i < 10; i++) assert.equal(t.update(40), 'mid');
  const { rig, g, body } = hexRig();
  const f = { pos: v(), heading: 0, state: 'chase' };
  const eye = v(0, 0, -45);
  let calls = 0;
  const update = rig.planner.update.bind(rig.planner);
  rig.planner.update = (...a) => { calls++; return update(...a); };
  for (let i = 0; i < 120; i++) { f.pos.z += 0.04; eye.z += 0.04; rig.update(f, 1 / 60, { eye, ground: () => 0 }); g.position.copy(f.pos); rig.write(); }
  assert.equal(rig.tier, 'mid');
  assert.ok(calls > 70 && calls < 90, `mid: planned on about half the frames (${calls} of 120, 30 near first)`);
  const far = v(0, 0, -200);
  for (let i = 0; i < 60; i++) { f.pos.z += 0.04; rig.update(f, 1 / 60, { eye: far.set(0, 0, f.pos.z - 200), ground: () => 0 }); }
  assert.equal(rig.tier, 'far');
  const rays = rig.planner.rays;
  for (let i = 0; i < 60; i++) { f.pos.z += 0.04; rig.update(f, 1 / 60, { eye: far.set(0, 0, f.pos.z - 200), ground: () => 0 }); }
  assert.equal(rig.planner.rays, rays, 'far: no rays');
  assert.ok(body && g);
});

test('the stepped clock (off by default) shows the pose only on its ticks', () => {
  const plain = hexRig().rig;
  assert.equal(plain.stepped, 0);
  const { rig } = hexRig({ stepped: 12 });
  const f = { pos: v(), heading: 0, state: 'chase' };
  let ticks = 0;
  for (let i = 0; i < 120; i++) { f.pos.z += 0.04; rig.update(f, 1 / 60, { ground: () => 0 }); if (rig.tick) ticks++; }
  assert.ok(ticks >= 23 && ticks <= 25, `12 fps over 2 s: ${ticks}`);
});

test('the rig plants its drawn feet: the foot meshes stay put while down, and the knees bend', () => {
  const { rig, g, body } = hexRig();
  const f = { pos: v(), heading: 0, state: 'chase' };
  const w = v(), prev = rig.legs.map(() => null);
  let slid = 0, minD = Infinity, maxD = 0;
  for (let i = 0; i < 240; i++) {
    f.pos.z += 2 / 60;
    const o = rig.update(f, 1 / 60, { ground: () => 0 });
    g.position.copy(f.pos); body.position.set(o.x, 0.55 + o.y, o.z); body.rotation.set(o.pitch, o.yaw, o.roll);
    rig.write(); g.updateMatrixWorld(true);
    rig.legs.forEach((L, k) => {
      L.foot.getWorldPosition(w);
      const planted = rig.planner.feet[k].planted;
      if (i > 60 && planted && prev[k]?.planted) slid += Math.hypot(w.x - prev[k].p.x, w.z - prev[k].p.z);
      prev[k] = { p: w.clone(), planted };
      if (i > 60 && k === 0) { const d = w.distanceTo(L.root.getWorldPosition(v())); minD = Math.min(minD, d); maxD = Math.max(maxD, d); }
    });
  }
  assert.ok(slid / 6 / 6 < 0.03, `drawn feet slide ${(slid / 36).toFixed(3)} m per m walked`);
  assert.ok((maxD - minD) / rig.length > 0.15, `hip-to-foot changes ${((maxD - minD) / rig.length * 100).toFixed(0)} % of the leg`);
});

// ---------------------------------------------------------------- phase 5 (the roster's batch 3)
test('a three-segment arm (the root knot’s): FABRIK keeps its three lengths, ends on its planted foot, and its two bends stay on their side frame to frame', () => {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.3; g.add(body);
  const legs = [0, 1, 2, 3, 4].map((k) => { const a = Math.PI / 5 + (k / 5) * Math.PI * 2; return jointedLeg({ group: g, body, hip: { x: Math.sin(a) * 0.5, y: 0, z: Math.cos(a) * 0.5 }, foot: { x: Math.sin(a) * 1.4, z: Math.cos(a) * 1.4 }, lenA: 0.7, lenB: 0.7, lenC: 0.55, pole: poleFor('out-up', { x: Math.sin(a), z: Math.cos(a) }), radius: 0.1, pad: 'point', mats: { joint: new THREE.MeshBasicMaterial() } }); });
  assert.ok(legs.every((l) => l.chain && l.tip), 'a third segment and its chain');
  const rig = new Rig({ plan: PLANS.tentacled, group: g, body, legs });
  assert.ok(Math.abs(rig.length - (0.7 + 0.7 + 0.55)) < 1e-9, 'the leg length counts all three');
  const f = { pos: v(), heading: 0, state: 'chase' }, first = [];
  for (let i = 0; i < 180; i++) {
    f.pos.z += 1.6 / 60;
    rig.update(f, 1 / 60, { ground: () => 0 }); g.position.copy(f.pos); rig.write();
    for (const [k, L] of legs.entries()) {
      const P = L.chain;
      assert.ok(Math.abs(P[0].distanceTo(P[1]) - 0.7) < 2e-3 && Math.abs(P[1].distanceTo(P[2]) - 0.7) < 2e-3 && Math.abs(P[2].distanceTo(P[3]) - 0.55) < 2e-3, `arm ${k}: its lengths at ${i}`);
      // (the first bend out from the body, beyond its hip and its foot's line: never folded back under it)
      const out = Math.hypot(P[1].x, P[1].z) - Math.hypot(P[0].x, P[0].z);
      if (i === 0) first[k] = Math.sign(out);
      assert.equal(Math.sign(out), first[k], `arm ${k}: its first bend keeps its side at ${i}`);
    }
  }
  const P = legs[0].chain, foot = rig.planner.feet[0].pos.clone().sub(g.position);
  assert.ok(P[3].distanceTo(foot.setY(foot.y + legs[0].ankle)) < 0.02, 'its tip on its planted foot');
});

test('a bird’s leg (the stilt plan’s `back` pole) bends its joint behind the line from hip to foot; a swarm’s rig plans at the mid tier at most (plan.tier)', () => {
  const knee = v();
  twoBone(v(0, 2.5, 0), v(0, 0, 0.1), 0.95, 1.8, new THREE.Vector3(...Object.values(poleFor('back', { x: 0.3, z: 0 }))).normalize(), knee);
  assert.ok(knee.z < -0.05, `the joint points back (${knee.z.toFixed(2)})`);
  assert.equal(PLANS.skitterers.tier, 'mid');
  const { rig, g } = hexRig({ tier: 'mid' });
  const f = { pos: v(), heading: 0, state: 'chase' };
  let calls = 0; const update = rig.planner.update.bind(rig.planner); rig.planner.update = (...a) => { calls++; return update(...a); };
  for (let i = 0; i < 60; i++) { f.pos.z += 0.04; rig.update(f, 1 / 60, { eye: v(0, 0, f.pos.z - 2), ground: () => 0 }); g.position.copy(f.pos); rig.write(); }
  assert.equal(rig.tier, 'mid', 'close by, still mid');
  assert.ok(calls >= 28 && calls <= 32, `planned every 2nd frame (${calls} of 60)`);
});

test('a hopper lands with its feet at their homes, not spread over a stride (ctx.landHome)', () => {
  const { rig, g } = hexRig();
  const f = { pos: v(), heading: 0, state: 'chase' };
  rig.update(f, 1 / 60, { ground: () => 0 });
  rig.update(f, 1 / 60, { ground: () => 0, air: 1.5 });
  f.pos.z = 1.2;
  rig.update(f, 1 / 60, { ground: () => 0, landHome: true });
  const h = v();
  rig.planner.feet.forEach((foot) => { rig.planner.homeOf(foot, f.pos, 0, h); assert.ok(foot.pos.distanceTo(h) < 1e-9 && foot.planted, 'at its home, planted'); });
  assert.ok(g);
});
