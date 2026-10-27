// One footprint per real foot contact (issue #717, the author: "when I start running after a ledge climb I see 100 foot
// steps on the ground?"). The traveller's feet (src/feet.js plantFeet) call onStep as a foot is set down; main.js prints
// a footprint there and plays a step. Pulled up onto a thin wall and setting off at a sprint, he drops off its far side
// still in the start's move (the gait's share near nothing, so the feet think he is standing) at 5-8 m/s: a held foot
// left 60 cm behind was let go as if teleported and set down again at once, the next frame, where it was drawn, and let
// go again: a print and a step's sound every frame, 33 in half a second. Here: the climbs, the drop, the landings, a
// teleport, setting off and stopping, each foot printing at most once per real touchdown.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { course, traveller, CAM_PLUS_Z } from './gait-sim.js';

const DT = 1 / 60;
const R = { KeyW: true, ShiftLeft: true }, W = { KeyW: true };

/** A traveller on the flat course with `build(scene)`'s walls, climbing on, every print logged with its foot and time. */
async function setUp(build) {
  const scene = course({ ramp: false, stairs: false });
  build(scene);
  const p = await traveller(scene, new THREE.Vector3(0, 0, 0), { moves: true, body: 'b3' });
  p.opts.climb = true;
  p.stopFeel = 'carry';
  const prints = [];
  p.onStep = (pt, heading, up, i) => prints.push({ t: p.time, i, z: pt.z });
  const step = (input) => { p.update(DT, input, CAM_PLUS_Z); p.object.updateMatrixWorld(true); };
  return { p, prints, step };
}
const wall = (w, h, d, z) => (scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(0, h / 2, z); scene.add(m); };

/** Walk into the wall until he has climbed it and stands on top. */
function climbOn({ p, step }) {
  let saw = false;
  for (let i = 0; i < 12 * 60; i++) {
    step(W);
    if (p.mantle || p.climbing) saw = true;
    if (saw && !p.mantle && !p.climbing && p.onGround) return true;
  }
  return false;
}

/** The shortest time between two prints of the same foot, and the most prints in any half second. */
function cadence(prints) {
  let gap = Infinity, dense = 0;
  for (const [k, a] of prints.entries()) {
    const next = prints.slice(k + 1).find((b) => b.i === a.i);
    if (next) gap = Math.min(gap, next.t - a.t);
    dense = Math.max(dense, prints.filter((b) => b.t >= a.t && b.t < a.t + 0.5).length);
  }
  return { gap, dense };
}
const assertOnePerContact = (prints, what) => {
  const { gap, dense } = cadence(prints);
  // (a foot lifts, swings and comes down between two of its prints: a sprint's stride is 0.6 s a foot, a settling step 0.3 s;
  // the quickest real one here, landing from the drop into the sprint, 0.2 s)
  assert.ok(gap >= 0.15, `${what}: a foot printed twice ${(gap * 1000).toFixed(0)} ms apart`);
  assert.ok(dense <= 5, `${what}: ${dense} prints in half a second`);
};

test('up onto a thin wall and off its far side at a sprint: one print per touchdown, no burst', async () => {
  const S = await setUp(wall(8, 1.8, 0.5, 2.25));
  assert.ok(climbOn(S), 'he climbed onto the wall');
  for (let i = 0; i < 30; i++) S.step({});
  const from = S.prints.length;
  for (let i = 0; i < 90; i++) S.step(R);
  const run = S.prints.slice(from);
  assert.ok(run.length >= 3, `the run prints its steps (${run.length})`);
  assertOnePerContact(run, 'setting off over the far side');
});

test('climbing, the climb onto a ledge, then a run: no prints on the wall, one per touchdown after', async () => {
  const S = await setUp(wall(8, 4, 8, 6));
  let climbed = 0;
  for (let i = 0; i < 12 * 60 && !(climbed && !S.p.climbing && !S.p.mantle && S.p.onGround); i++) {
    const n = S.prints.length;
    S.step(W);
    if (S.p.climbing) { climbed++; assert.equal(S.prints.length, n, 'no print while climbing'); }
  }
  assert.ok(climbed > 0, 'he climbed the wall');
  const from = S.prints.length;
  for (let i = 0; i < 120; i++) S.step(R);
  assertOnePerContact(S.prints.slice(from), 'running on from the ledge');
});

test('running off a high wall, landing at a run, stopping and setting off again: one print per touchdown', async () => {
  const S = await setUp(wall(8, 1.8, 8, 6));
  assert.ok(climbOn(S));
  const from = S.prints.length;
  for (let i = 0; i < 100; i++) S.step(R);   // (off the far side, a 1.8 m drop, landing at a sprint)
  for (let i = 0; i < 60; i++) S.step({});
  for (let i = 0; i < 60; i++) S.step(R);
  assertOnePerContact(S.prints.slice(from), 'the drop, the stop, the start');
});

test('a teleport at a run: no line of prints between where he was and where he is', async () => {
  const S = await setUp(() => {});
  for (let i = 0; i < 90; i++) S.step(R);
  const from = S.prints.length;
  S.p.teleport(new THREE.Vector3(30, 0, 30), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  for (let i = 0; i < 90; i++) S.step(R);
  assertOnePerContact(S.prints.slice(from), 'after the teleport');
});
