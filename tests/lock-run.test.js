// Locked on, the sprint runs you in (issue #770, the author: "I should be able to run towards an enemy with l3 when
// fighting and locked on"; src/player.js LOCK_RUN, lockRunWanted): the run (L3 / Shift) with the stick toward the locked
// foe is a sprint straight at it, at the run's speed, facing it, until LOCK_RUN.near m off; sideways or back the run is
// the lock's jog-strafe as before, and a cut pressed on the way in is the running cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCK_MOVE, LOCK_RUN, lockRunWanted } from '../src/player.js';

const RUN = 8.2;   // (src/player.js's run speed)
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { Physics } from '../src/physics.js';
import { lockWalk } from '../scripts/camera-qc/sim-lock.mjs';
import { analyse } from '../scripts/camera-qc/lib.mjs';

const dt = 1 / 60, v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('the rule: run held, the stick toward the foe, not yet at it', () => {
  assert.ok(lockRunWanted({ run: true, f: 1, s: 0, dist: 10 }));
  assert.ok(lockRunWanted({ run: true, f: 1, s: 0.6, dist: 10 }), 'a diagonal in still runs in');
  assert.ok(!lockRunWanted({ run: false, f: 1, s: 0, dist: 10 }), 'without the run: the jog');
  assert.ok(!lockRunWanted({ run: true, f: 0, s: 1, dist: 10 }), 'sideways: the strafe');
  assert.ok(!lockRunWanted({ run: true, f: -1, s: 0, dist: 10 }), 'back: the walk back');
  assert.ok(!lockRunWanted({ run: true, f: 1, s: 0, dist: LOCK_RUN.near - 0.1 }), 'at it: no more running');
  assert.ok(lockRunWanted({ run: true, f: 1, s: 0 }), 'no distance known: it runs');
});

/** The traveller locked on a foe 14 m ahead (+z), the input held each frame; his speed and heading measured. */
async function lockedRun(input, frames = 60 * 1.6) {
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'b3' });
  const foe = v(0, 0, -46);
  let top = 0, offFace = 0, closest = Infinity, close = 0, closeSprint = false;
  for (let i = 0; i < frames; i++) {
    p.lockOn = { dir: v(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize(), at: foe.clone() };
    p.update(dt, input, CAM_PLUS_Z);
    const hs = Math.hypot(p.vel.x, p.vel.z);
    top = Math.max(top, hs);
    if (i > 30) offFace = Math.max(offFace, Math.abs(Math.atan2(Math.sin(p.heading - p.frame.headingOf(p.lockOn.dir)), Math.cos(p.heading - p.frame.headingOf(p.lockOn.dir)))));
    closest = Math.min(closest, Math.hypot(foe.x - p.pos.x, foe.z - p.pos.z));
    // (at the foe, inside where the run gives way to the jog, a stride's braking on: no foe body here to stop him)
    if (closest < LOCK_RUN.near - 1.4) { close = Math.max(close, hs); closeSprint ||= p.sprinting; }
  }
  return { p, top, offFace, closest, close, closeSprint, sprinting: p.sprinting };
}

test('locked on, run with the stick toward the foe: a sprint straight at it, facing it, stopping short of it (#770)', async () => {
  const jog = await lockedRun({ KeyW: true });
  assert.ok(jog.top <= LOCK_MOVE.speed + 0.05, `without the run, the lock's jog (${jog.top.toFixed(2)} m/s)`);
  const run = await lockedRun({ KeyW: true, ShiftLeft: true });
  assert.ok(run.top > LOCK_MOVE.speed + 1.5 && run.top <= RUN + 0.05, `with it, a sprint (${run.top.toFixed(2)} m/s, the run ${RUN})`);
  assert.ok(run.offFace < 0.15, `facing the foe as he runs (${run.offFace.toFixed(2)} rad off)`);
  assert.ok(Math.abs(run.p.pos.x) < 0.05, `straight at it (${run.p.pos.x.toFixed(3)} m off the line)`);
  const long = await lockedRun({ KeyW: true, ShiftLeft: true }, 60 * 4);
  assert.ok(long.closest < LOCK_RUN.near - 1.4, 'he reached it');
  assert.ok(!long.closeSprint && long.close <= LOCK_MOVE.speed + 0.3, `at it the sprint is over: the lock's jog (${long.close.toFixed(2)} m/s)`);
});

test('locked on, run held sideways: the strafe at the lock\'s jog, round the foe (unchanged)', async () => {
  const side = await lockedRun({ KeyD: true, ShiftLeft: true });
  assert.ok(side.top <= LOCK_MOVE.speed + 0.05, `sideways the run is ignored (${side.top.toFixed(2)} m/s)`);
  assert.ok(!side.sprinting);
});

test('running in locked on, the camera keeps its lock-on framing (#752): green, he on the screen, the foe never hidden, no spin', () => {
  const scene = new THREE.Scene(), ground = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 200), new THREE.MeshBasicMaterial());
  ground.position.y = -0.5; scene.add(ground); scene.updateMatrixWorld(true);
  const world = { physics: new Physics(scene) };
  const walk = (seg) => lockWalk(world, { segs: [{ for: 1, stick: [0, 0] }, { for: 1.6, stick: [0, 1], ...seg }, { for: 1, stick: [0, 0] }], foe: v(0, 0, 14), start: v(0, 0, 0), yaw: Math.PI }).samples;
  for (const [label, seg] of [['the jog in', {}], ['the run in', { run: RUN }]]) {
    const S = walk(seg), r = analyse(S), m = r.measures;
    assert.ok(r.green, `${label}: ${r.fails.join('; ')}`);
    assert.equal(m.out, 0, `${label}: he never off the screen`);
    assert.equal(m.lockHidden, 0, `${label}: the foe never hidden behind him`);
    assert.ok(m.spinMax < 60, `${label}: no spin (${m.spinMax}°/s at most)`);
    const near = Math.min(...S.map((s) => s.foeD));
    if (process.env.SHOW) console.log(label, near.toFixed(2), m);
  }
});
