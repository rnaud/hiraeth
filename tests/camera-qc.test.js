// The camera QC (.claude/skills/camera-qc): its judgement (scripts/camera-qc/lib.mjs) on made-up tracks, and the follow
// camera through the Overnight Train's carriages in node (scripts/camera-qc/sim.mjs: the real CameraRig, the real
// collision), held to the skill's limits. The author: "in the train when I'm walking it keeps jumping around." Before
// the fixes the walk through the carriages had 16 pops of up to 1.7 m and 27 turns of the view nobody asked for (up to
// 6000°/s, at the porches); the sleeping car's corridor pumped the arm in and out at every compartment door.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyse, steps, worst, LIMITS } from '../scripts/camera-qc/lib.mjs';
import { trainWorld, runWalk } from '../scripts/camera-qc/sim-train.mjs';
import { Physics } from '../src/physics.js';
import { CameraRig } from '../src/player.js';
import { FLOOR, car } from '../src/levels/overnight-train.js';

globalThis.window ??= { addEventListener() {} };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A made-up track: a walk along +x at 4 m/s, the camera 2 m behind and 1 m up, 60 frames a second. */
function track(n = 240, edit = () => {}) {
  const S = [];
  for (let i = 0; i < n; i++) {
    const t = i / 60, x = 4 * t;
    const s = { t, dt: 1 / 60, pos: [x, 0, 0], look: [x, 1.5, 0], cam: [x - 2, 2.5, 0], fwd: [0.894, -0.447, 0], cmdYaw: 0, cmdPitch: 0, clear: 1, occl: false, head: [0, 0.1], chest: [0, -0.2] };
    edit(s, i);
    S.push(s);
  }
  return S;
}

test('the judgement: a smooth walk is green; a pop, a snap, a spin, the lens in a wall and the traveller out of frame are each caught', () => {
  const calm = analyse(track());
  assert.ok(calm.green, calm.fails.join('; '));
  assert.equal(calm.measures.pops + calm.measures.jumps + calm.measures.spins, 0);
  // a pop: the arm cut by a metre for a stretch (in at once, out at once)
  const pop = analyse(track(240, (s, i) => { if (i >= 100 && i < 140) s.cam[0] += 1; }));
  assert.ok(pop.measures.pops >= 2 && pop.measures.popMax > 0.7, `pops ${pop.measures.pops}, ${pop.measures.popMax} m`);
  assert.ok(pop.events[0].kind === 'pop' || pop.events[0].kind === 'jump');
  // a snap sideways: a kink in the path, the look point too
  const snap = analyse(track(240, (s, i) => { if (i >= 120) { s.cam[2] += 0.5; s.look[2] += 0.4; } }));
  assert.ok(snap.measures.jumps >= 1 && snap.measures.lookJumps >= 1);
  // a turn nobody asked for, in one frame; the same turn asked for by the stick is not one
  const turn = (asked) => analyse(track(240, (s, i) => { if (i === 120) { s.fwd = [0.6, -0.447, 0.663]; s.cmdYaw = asked ? 0.85 : 0; } if (i > 120) s.fwd = [0.894, -0.447, 0]; }));
  assert.ok(turn(false).measures.spins >= 1, 'an unasked turn');
  assert.ok(turn(true).measures.spins < turn(false).measures.spins, 'the turn asked for is not counted (only the snap back)');
  // the lens in a wall, the traveller out of the frame
  const clip = analyse(track(240, (s, i) => { if (i % 10 === 0) s.clear = 0.1; }));
  assert.ok(!clip.green && clip.measures.clip > LIMITS.share.clip);
  const out = analyse(track(240, (s, i) => { if (i % 5 === 0) s.head = [1.4, 0]; }));
  assert.ok(!out.green && out.measures.out > LIMITS.share.out);
  // a hand-over (a teleport) is not judged
  assert.equal(steps(track(3, (s, i) => { if (i === 2) s.pos[0] += 10; }))[1], null);
  // the worst, one a moment
  const w = worst([{ t: 1, sev: 3 }, { t: 1.1, sev: 2 }, { t: 3, sev: 1 }], 6, 0.6);
  assert.deepEqual(w.map((e) => e.t), [1, 3]);
});

test('a ball swept along the arm sees a row of thin uprights as the band it is, where a ray flickers between them', () => {
  const scene = new THREE.Scene();
  for (let x = -6; x <= 6; x += 0.6) scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.08).translate(x, 1.5, -1.5)));   // mullions 1.5 m behind
  const P = new Physics(scene);
  const flips = (f) => { let n = 0, last = null; for (let x = -3; x <= 3; x += 0.03) { const hit = f(V(x, 1.5, 0)) < 2.5; if (last !== null && hit !== last) n++; last = hit; } return n; };
  const dir = V(0, 0, -1);
  const ray = flips((p) => P.rayDistance(p, dir, 3)), ball = flips((p) => P.sweepSphere(p, dir, 3, 0.3));
  assert.ok(ray > 15, `a ray hits a mullion, misses, hits… (${ray} flips walking past)`);
  assert.equal(ball, 0, 'the ball is stopped all the way along');
  assert.ok(P.sweepSphere(V(0.3, 1.5, 0), dir, 3, 0.3) < 1.4, 'short of the band, by about its radius');
  assert.ok(P.roomAt(V(0, 1.5, -1.3), 0.5) < 0.2 && P.roomAt(V(0.3, 1.5, 2), 0.5) === 0.5, 'the room round a point');
});

let world = null;
const train = () => (world ??= trainWorld());

test('the Overnight Train: walking through the carriages, the camera holds steady (the author\'s jumping camera)', () => {
  const r = runWalk(train(), 'train-walk');
  const m = r.measures;
  assert.ok(m.secs > 30, 'the whole way, deck to balcony');
  assert.ok(r.green, `${r.fails.join('; ')}`);
  assert.equal(m.pops, 0, `no pops (${m.popMax} m at most)`);
  assert.ok(m.spinMax < 150, `no turn of the view nobody asked for (${m.spinMax}°/s at most; it was 6000)`);
  assert.equal(m.out, 0, 'the traveller always in the frame');
});

test('the Overnight Train: the sleeping car\'s corridor (open compartment doors along it), turning round in it; the dining car\'s aisle turned in; the roof walk', () => {
  for (const name of ['train-sleeper', 'train-dining-turns', 'train-roof']) {
    const r = runWalk(train(), name);
    assert.ok(r.green, `${name}: ${r.fails.join('; ')}`);
  }
});

test('the Overnight Train at a run: at most a small pop at a door taken at speed while turning', () => {
  const r = runWalk(train(), 'train-run');
  assert.ok(r.measures.pops <= 2 && r.measures.popMax < 0.6, `pops ${r.measures.pops}, at most ${r.measures.popMax} m`);
  assert.ok(r.measures.spinMax < 400 && r.measures.out < 0.01, `spins at most ${r.measures.spinMax}°/s, out ${r.measures.out}`);
});

test('the carriages\' windows are glazed for the camera and the traveller (never drawn): the lens stays inside', () => {
  const { physics } = train();
  const D = car('dining');
  // from the aisle out through a window opening: the glass stops a ray and the traveller's capsule
  let stopped = 0, n = 0;
  for (let x = D.x0 + 4; x < D.x1 - 2; x += 0.5) { n++; if (physics.rayDistance(V(x, FLOOR + 1.6, 0), V(0, 0, -1), 6) < 3.2) stopped++; }
  assert.equal(stopped, n, 'nothing gets out through the window band');
  // pressed against the window band, even up off the floor (on a seat's arm, a table), turning round: the camera stays
  // in the carriage (it slipped out of a window behind, or through the wall from a look point pressed to it, and looked
  // at the hull from the plain)
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), rig = new CameraRig(camera, { addEventListener() {} }, physics);
  const p = V(D.xc + 0.4, FLOOR + 1.17, -2.68);   // (floating against the wall: the worst case, a look point touching it)
  rig.yaw = Math.PI * 0.75;
  rig.update(p, 1 / 60);
  for (let i = 0; i < 240; i++) { rig.yaw += 0.01; rig._lastMouse = rig._now; rig.update(p, 1 / 60); assert.ok(Math.abs(camera.position.z) < 2.95, `inside the carriage (${camera.position.z.toFixed(2)})`); }
});
