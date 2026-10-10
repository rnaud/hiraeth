// The temple guardians on the locomotion kit (kit phase 6: docs/systems/procedural-animation.md, "Phase 6, the
// guardians"; src/temples/guardians.js, src/temples/guardian-motion.js), measured as the motion audit does
// (scripts/motion-audit/walk.mjs guardianSubject): a regression in foot slide, knee bend, lift, gait groups or
// cadence is a bug. Their fights' timings and twists are tests/guardian-twists.test.js and tests/temples.test.js.
//   walkers   the Cistern-Keeper (six legs, a tripod), the Gardener and the Clockwork Foreman (four, diagonal pairs),
//             the sentinel and the First Sign (three, one at a time), the Tooth-Warden (the sentinel on four), the
//             Elder (two bird's legs, one at a time)
//   planted   the legs stay out of the fight's tell rig: the body rears, crouches and coils over planted feet
//   chains    the Snapper's neck (a FABRIK chain that never stretches and lags a lunge), the wings, fins and veils
//             (travelling waves: the tips behind the roots)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GUARDIANS } from '../scripts/motion-audit/walk.mjs';
import { keeperModel, snapperModel, mothModel, whaleModel, echoModel, elderModel } from '../src/temples/guardians.js';

const WALKERS = [
  { id: 'keeper', n: 6, groups: [[0, 3, 4], [1, 2, 5]] },
  { id: 'gardener', n: 4, groups: [[0, 2], [1, 3]] },
  { id: 'foreman', n: 4, groups: [[0, 2], [1, 3]] },
  { id: 'sentinel', n: 3, groups: [[0], [1], [2]] },
  { id: 'warden', n: 4, groups: [[0, 2], [1, 3]] },
  { id: 'sign', n: 3, groups: [[0], [1], [2]] },
  { id: 'elder', n: 2, groups: [[0], [1]] },
];

for (const W of WALKERS) {
  test(`${W.id}: planted feet, bending knees, a lift, the right groups, a cadence that follows its speed`, () => {
    const full = GUARDIANS[W.id](1), half = GUARDIANS[W.id](0.5);
    assert.equal(full.legsN, W.n);
    assert.ok(full.slidePerMetre < 0.05, `slide ${full.slidePerMetre.toFixed(3)} m/m`);
    assert.ok(full.worstSlide < 0.1, `worst contact ${full.worstSlide.toFixed(3)} m`);
    assert.ok(full.reachShare > 0.15, `reach span ${(full.reachShare * 100).toFixed(0)} % of the leg`);
    assert.ok(full.liftShare >= 0.06, `lift ${(full.liftShare * 100).toFixed(0)} % of the leg`);
    assert.ok(full.knee.mean > 30 && full.knee.least > 20, `knees bend ${full.knee.mean.toFixed(0)}° (least ${full.knee.least.toFixed(0)}°): a bend under 20° does not read in ink`);
    assert.deepEqual(full.groups, W.groups);
    assert.ok(half.cadence < full.cadence * 0.85, `cadence ${full.cadence.toFixed(2)} → ${half.cadence.toFixed(2)} steps/s at half speed`);
    assert.ok(half.slidePerMetre < 0.05);
  });
}

/** A model placed as its fight places it (src/temples/boss.js place), then animated. */
const frame = (m, dt, t, o) => { m.group.position.copy(m.pos); m.group.rotation.y = m.heading; m.animate(dt, t, { state: 'fight', speed: 0, meter: 0, phase: 0, ...o }); m.group.updateMatrixWorld(true); };
const footAt = (m, i) => m.kit.legs[i].foot.getWorldPosition(new THREE.Vector3());

test('the Keeper\'s stamp: it braces, then rears on four planted feet while its forelegs lift; the tell rig moves its body, never its feet', () => {
  const m = keeperModel();
  assert.ok(m.tellRig && m.tellRig.parent === m.group, 'its own tell rig (boss.js uses it, does not wrap the legs)');
  for (const L of m.kit.legs) assert.equal(L.root.parent, m.group, 'each leg hangs from the root, outside the tell rig');
  let t = 0;
  for (let i = 0; i < 90; i++) frame(m, 1 / 60, (t += 1 / 60), {});
  const stamp = { id: 'stamp', track: 0.3 }, hind = [2, 3, 4, 5], front = [0, 1];
  let k = 0, held = null, frontStart = null;
  for (let i = 0; i < 120; i++) {
    k = Math.min(0.99, i / 120);
    frame(m, 1 / 60, (t += 1 / 60), { attack: stamp, k });
    if (k >= 0.75 && !held) { held = hind.map((j) => footAt(m, j)); frontStart = front.map((j) => footAt(m, j).y); }
    if (held) hind.forEach((j, n) => assert.ok(footAt(m, j).distanceTo(held[n]) < 0.02, `hind foot ${j} planted through the hold (${footAt(m, j).distanceTo(held[n]).toFixed(3)} m)`));
  }
  front.forEach((j) => assert.ok(footAt(m, j).y > 0.6, `foreleg ${j} lifted (${footAt(m, j).y.toFixed(2)} m)`));
  assert.ok(frontStart.every((y) => y > 0.2), 'the forelegs were already coming up as it reared');
  // the fight's generic wind-up (boss.js poseRig): the tell rig rears and crouches; the planted feet stay where they are
  const before = hind.map((j) => footAt(m, j));
  m.tellRig.rotation.x = -0.3; m.tellRig.position.y = 0.5; m.tellRig.scale.setScalar(1.08);
  frame(m, 1 / 60, (t += 1 / 60), { attack: stamp, k: 0.99 });
  hind.forEach((j, n) => assert.ok(footAt(m, j).distanceTo(before[n]) < 0.02, `foot ${j} stays planted as the tell rig moves the body`));
});

test('a wind-up still aiming lets the feet step round; once it holds, they brace and lock', () => {
  const m = keeperModel();
  let t = 0;
  for (let i = 0; i < 60; i++) frame(m, 1 / 60, (t += 1 / 60), {});
  frame(m, 1 / 60, (t += 1 / 60), { attack: { id: 'sweep', track: 0.5 }, k: 0.2 });
  assert.equal(m.kit.rig.planner.locked, false, 'aiming: free');
  frame(m, 1 / 60, (t += 1 / 60), { attack: { id: 'sweep', track: 0.5 }, k: 0.6 });
  assert.equal(m.kit.rig.planner.locked, true, 'holding: locked');
  assert.ok(m.kit.rig.planner.spread > 1.1, 'braced wide');
});

test('the Snapper\'s neck is a FABRIK chain: it never stretches past its curve, lags a lunge, and settles', () => {
  const m = snapperModel({ reach: 12 });
  const N = m.beads.length, C = m.neckChain;
  let t = 0, lagMax = 0;
  // (how far the chain's middle is off the curve it follows: to the nearest point of the curve's polyline)
  const off = () => { const q = C[Math.floor(N / 2)], S = m.neckShape, l = new THREE.Line3(), c = new THREE.Vector3(); let d = Infinity; for (let j = 1; j < S.length; j++) { l.set(S[j - 1], S[j]); d = Math.min(d, l.closestPointToPoint(q, true, c).distanceTo(q)); } return d; };
  const linkOf = () => { let s = 0; for (let j = 1; j < m.neckShape.length; j++) s += m.neckShape[j].distanceTo(m.neckShape[j - 1]); return s / N; };
  for (let i = 0; i < 120; i++) frame(m, 1 / 60, (t += 1 / 60), {});
  for (let i = 0; i < 150; i++) {
    const k = i < 90 ? i / 90 : 1;
    frame(m, 1 / 60, (t += 1 / 60), { attack: { id: 'lunge' }, k });
    const link = linkOf();
    for (let j = 1; j <= N; j++) assert.ok(C[j].distanceTo(C[j - 1]) < link * 1.02 + 1e-6, 'no link longer than its share of the curve');
    lagMax = Math.max(lagMax, off());
  }
  assert.ok(lagMax > 0.3, `the middle of the neck lags the lunge (${lagMax.toFixed(2)} m)`);
  for (let i = 0; i < 180; i++) frame(m, 1 / 60, (t += 1 / 60), { attack: { id: 'lunge' }, k: 1 });
  assert.ok(off() < 0.1, `and settles onto its curve (${off().toFixed(3)} m off)`);
  // (the chain ends at the back of the head: the head and its mouth are where the fight puts them)
  const back = m.H.position.clone().addScaledVector(new THREE.Vector3(Math.sin(m.turn) * Math.cos(m.pitch), -Math.sin(m.pitch), Math.cos(m.turn) * Math.cos(m.pitch)), -1.4);
  assert.ok(C[N].distanceTo(back) < 0.05);
});

/** The lag (frames) at which `tip` best follows `root`: > 0 when the tip trails. */
function lagOf(root, tip) {
  let best = 0, bestC = -Infinity;
  for (let lag = 0; lag < 20; lag++) {
    let c = 0;
    for (let i = 20; i < root.length; i++) c += root[i - lag] * tip[i];
    if (c > bestC) { bestC = c; best = lag; }
  }
  return best;
}

test('wings, fins and veils beat on travelling waves: each tip trails its root', () => {
  const cases = [
    { name: 'moth wing', m: mothModel(), root: (m) => m.wings[0].w.rotation.z, tip: (m) => m.wings[0].w.rotation.z + m.wings[0].outer.rotation.z },
    { name: 'whale fin', m: whaleModel(), root: (m) => m.fins[0].f.rotation.z, tip: (m) => m.fins[0].joints.reduce((s, j) => s + j.rotation.z, 0) },
    { name: 'echo veil', m: echoModel(), root: (m) => m.veils[0].rotation.x, tip: (m) => m.veils[0].userData.joints.reduce((s, j) => s + j.rotation.x, 0) },
    { name: 'Elder wing', m: elderModel(), o: { phase: 1 }, root: (m) => m.wings[0].w.rotation.z, tip: (m) => m.wings[0].w.rotation.z + m.wings[0].joints.reduce((s, j, i) => s + (i ? j.rotation.z : 0), 0) },
  ];
  for (const c of cases) {
    const r = [], p = [];
    let t = 0;
    for (let i = 0; i < 240; i++) {
      c.m.pos.z += 0.02;
      frame(c.m, 1 / 60, (t += 1 / 60), { speed: 1.2, ...(c.o ?? {}) });
      if (i >= 60) { r.push(c.root(c.m)); p.push(c.tip(c.m)); }
    }
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length, mr = mean(r), mp = mean(p);
    assert.ok(lagOf(r.map((x) => x - mr), p.map((x) => x - mp)) > 0, `${c.name}: the tip trails the root`);
  }
});
