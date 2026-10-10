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
