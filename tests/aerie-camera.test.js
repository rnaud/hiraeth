// #617: exercise the shared follow rig through the Aerie's actual collision and runtime bounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { templeOf } from '../src/temples/attachment.js';
import { createArzach } from '../src/levels/arzach.js';
import { Physics } from '../src/physics.js';
import { CameraRig } from '../src/player.js';
import { cameraFollow } from '../src/host/game-host.js';
import { WELL } from '../src/temples/arzach.js';

globalThis.window ??= { addEventListener() {} };
const scene = new THREE.Scene();
const level = createArzach(scene);
const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
level.init?.(physics);
const house = templeOf(level, 'arzach') ?? level.temple;
if (!house.physics) house.init(physics);
const dt = 1 / 60;
const make = (pos) => {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, { addEventListener() {} }, physics);
  rig.yaw = Math.PI;
  const player = { pos, vel: new THREE.Vector3(), heading: 0, gliding: true, onGround: false, houses: [house] };
  const follow = cameraFollow({ rig, player });
  const frame = () => { follow(dt); rig.update(player.pos, dt); };
  return { rig, player, frame };
};

test('Aerie Wind Well ascent keeps the Traveller readable instead of the open-sky chase (#617)', () => {
  const { rig, player, frame } = make(house.kit.world(0, 12, WELL.z));
  assert.ok(house.inside(player.pos), 'actual temple bounds select the shot');
  for (let i = 0; i < 240; i++) frame();
  let largestArm = 0, smallestBody = Infinity, largestStep = 0, previous = rig._curDist;
  for (let i = 0; i < 240; i++) {
    player.pos.y += 4 * dt; frame();
    const arm = rig.camera.position.distanceTo(rig._look);
    largestArm = Math.max(largestArm, arm);
    largestStep = Math.max(largestStep, Math.abs(rig._curDist - previous)); previous = rig._curDist;
    rig.camera.updateMatrixWorld();
    const foot = player.pos.clone().project(rig.camera), head = player.pos.clone().add(new THREE.Vector3(0, 1.8, 0)).project(rig.camera);
    smallestBody = Math.min(smallestBody, (head.y - foot.y) / 2);
    assert.ok(Number.isFinite(arm) && Math.abs(head.x) < 1 && Math.abs(head.y) < 1, 'head remains on screen');
  }
  assert.ok(largestArm <= 6.5, `flight arm ${largestArm.toFixed(3)} m`);
  assert.ok(smallestBody >= 0.18, `body share ${smallestBody.toFixed(3)}`);
  assert.ok(largestStep < 0.25, `arm change ${largestStep.toFixed(3)} m/frame`);
});

test('leaving Aerie restores outdoor glide, re-entry settles close, landing and zoom remain usable (#617)', () => {
  const { rig, player, frame } = make(house.kit.world(1000, 30, 1000));
  assert.ok(!house.inside(player.pos));
  for (let i = 0; i < 360; i++) frame();
  assert.ok(Math.abs(rig.armLength() - 13.4) < 0.1, 'outdoor glide is unchanged');
  player.pos.copy(house.kit.world(0, 24, WELL.z));
  for (let i = 0; i < 360; i++) frame();
  assert.ok(rig.armLength() <= 6.5, 'existing wide state drains after entering the house');
  rig.zoom(1.1);
  for (let i = 0; i < 120; i++) frame();
  assert.ok(rig.armLength() > 6.4 && rig.armLength() < 7.1, 'manual zoom remains in charge');
  player.gliding = false; player.onGround = true;
  for (let i = 0; i < 360; i++) frame();
  assert.ok(Math.abs(rig.armLength() - rig.dist) < 0.1, 'landing returns to the chosen walking distance');
});
