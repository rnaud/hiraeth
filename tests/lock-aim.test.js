// Aiming the gun locked on (src/fluid-tool.js LOCK_AIM, lockAim, rayMiss; main.js turns the camera): the camera's yaw and
// pitch toward the locked foe from where it stands, and a crosshair near its chest takes it (v1.41, the author: "gun aim
// stays on the locked target when aiming with L2 while locked on").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidTool, LOCK_AIM, lockAim, rayMiss } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { clearTargets } from '../src/targets.js';
import { traveller, course } from './gait-sim.js';
import { LOCK_VIEW, lockViewAngle, LOCK_TURN, lockTurn } from '../src/foes.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const F = { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(-1, 0, 0) };

test('lockAim: the rig\'s yaw and pitch that look from the camera at the foe', () => {
  // (the rig's convention: yaw 0 puts the camera behind along +z, looking toward -z; pitch + looks down)
  const a = lockAim(v(0, 2, 0), v(0, 1, -10), F);
  assert.ok(Math.abs(a.yaw) < 1e-9); assert.ok(a.pitch > 0 && Math.abs(a.pitch - Math.asin(1 / Math.hypot(1, 10))) < 1e-9);
  const b = lockAim(v(0, 1, 0), v(10, 1, 0), F);   // (to the frame's left, -right)
  const dir = F.right.clone().multiplyScalar(-Math.sin(b.yaw)).addScaledVector(F.fwd, -Math.cos(b.yaw));   // the camera's forward for that yaw (main.js: yaw = atan2(-r, -a))
  assert.ok(dir.distanceTo(v(1, 0, 0)) < 1e-6, 'its forward points at the foe');
  assert.ok(rayMiss(v(), v(0, 0, -1), v(0.5, 0, -4)) - 0.5 < 1e-9);
  assert.equal(rayMiss(v(), v(0, 0, -1), v(0, 0, 4)), Infinity, 'behind: never');
});

test('locked on, the crosshair near the foe\'s chest takes it; far off, or with no lock, it is where the camera looks', async () => {
  clearTargets();
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'v1' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0.6, 1.9, -63); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const chest = v(0.4, 1.3, -52);
  tool.lockOn = () => ({ position: () => chest, lock: true });
  // looking a little off the foe (well within LOCK_AIM.snap at its distance)
  camera.lookAt(chest.x + 0.7, chest.y + 0.4, chest.z); camera.updateMatrixWorld();
  tool.updateAimPoint();
  assert.ok(tool.aimPoint.distanceTo(chest) < 1e-6 && tool.aimKind === 'target' && tool.aimLocked, 'the crosshair takes the chest');
  // far off: where the camera looks
  camera.lookAt(chest.x + 6, chest.y + 3, chest.z); camera.updateMatrixWorld();
  tool.updateAimPoint();
  assert.ok(tool.aimPoint.distanceTo(chest) > 2 && !tool.aimLocked);
  // no lock
  tool.lockOn = () => null;
  camera.lookAt(chest.x + 0.7, chest.y + 0.4, chest.z); camera.updateMatrixWorld();
  tool.updateAimPoint();
  assert.ok(tool.aimPoint.distanceTo(chest) > 0.3 && !tool.aimLocked);
  assert.ok(LOCK_AIM.snap >= 1 && LOCK_AIM.rate > 6, 'the camera turns quicker than the lock\'s own (6)');
  tool.dispose();
});

test('the lock camera swings a small foe out from behind the traveller (combat-v1.47 rec. 3, #107)', () => {
  // from the swing θ, where the foe's centre is seen from the camera, off the traveller's: atan2(d sin θ, arm + d cos θ)
  const seen = (d, arm, th) => Math.atan2(d * Math.sin(th), arm + d * Math.cos(th));
  for (const [d, r] of [[3, 0.6], [6, 0.6], [9, 0.85], [14, 0.32]]) {
    const arm = 5, th = lockViewAngle(d, arm, r, 0.55), need = Math.atan(LOCK_VIEW.body / arm) + Math.atan(r / (arm + d));
    assert.ok(th > 0 && th <= LOCK_VIEW.max, `a swing (${th.toFixed(2)} rad at ${d} m)`);
    if (th < LOCK_VIEW.max) assert.ok(seen(d, arm, th) >= need - 1e-6, `clear of his body at ${d} m`);
  }
  // nearer needs more, further less; a tall foe (its chest over his head) needs none; a guardian none
  assert.ok(lockViewAngle(4, 5, 0.6, 0.6) > lockViewAngle(9, 5, 0.6, 0.6) && lockViewAngle(9, 5, 0.6, 0.6) > lockViewAngle(16, 5, 0.6, 0.6));
  assert.equal(lockViewAngle(6, 5, 1.2, 3), 0);
  assert.equal(lockViewAngle(0, 5), 0);
  assert.equal(lockViewAngle(1.2, 5, 0.6, 0.55), 0, 'in the cut\'s reach: none (they overlap from anywhere behind him)');
});

test('the lock camera\'s turn eases its speed and stops on the line (issue #236)', () => {
  // the line flips half round (walking past a foe): the speed rises by at most acc a second, never past max, and the
  // camera comes to rest on the line without passing it
  const dt = 1 / 60;
  let yaw = 0, vel = 0, peak = 0, past = 0, kink = 0;
  for (let i = 0; i < 300; i++) {
    const v2 = lockTurn(Math.PI - yaw, vel, 6, dt);
    kink = Math.max(kink, Math.abs(v2 - vel) / dt); vel = v2; yaw += vel * dt;
    peak = Math.max(peak, Math.abs(vel)); past = Math.max(past, yaw - Math.PI);
  }
  assert.ok(kink <= LOCK_TURN.acc + 1e-6, `its speed changes ${kink.toFixed(1)} rad/s a second`);
  assert.ok(peak <= LOCK_TURN.max + 1e-6, `at most ${peak.toFixed(2)} rad/s`);
  assert.ok(past < 0.05, `passes the line by ${past.toFixed(3)} rad`);
  assert.ok(Math.abs(Math.PI - yaw) < 0.01 && Math.abs(vel) < 0.05, 'settles on it');
  // circling a foe, the line turning steadily: it trails it by about what the old ease did (1 / 6 s of the turn)
  yaw = 0; vel = 0; let line = 0;
  for (let i = 0; i < 300; i++) { line += 1.2 * dt; vel = lockTurn(line - yaw, vel, 6, dt); yaw += vel * dt; }
  assert.ok(Math.abs((line - yaw) - 1.2 / 6) < 0.035, `trails by ${(line - yaw).toFixed(3)} rad`);
  assert.equal(lockTurn(1, 0.5, 6, 0), 0.5, 'no time, no change');
});
