import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { wireWardrobe, wardrobeShot } from '../src/wardrobe.js';
import { fistGrip } from '../src/blade-grip.js';

for (const body of ['b3', 'plain']) test(`${body}: Wardrobe holds the whole blade in the fitted fist and restores the gameplay pose and equipment`, async () => {
  const scene = course({ ramp: false, stairs: false });
  const player = await traveller(scene, new THREE.Vector3(0, 0, -60), { body });
  for (let i = 0; i < 30; i++) player.update(1 / 60, {}, CAM_PLUS_Z);
  const H = player.humanoid, B = H.b;
  const group = new THREE.Group(); B.hand_r.add(group);
  const flags = { 'item.sword': true }, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } };
  const tool = { swordOn: true, blade: { group, drawn: false, lit: 0, sheath: { t: 0.37 } } };
  const w = wireWardrobe({ game, tool, player });
  const before = Object.values(B).map((b) => [b, b.quaternion.clone()]);
  const state = JSON.stringify(flags), sheath = JSON.stringify(tool.blade.sheath);
  const hands = H.hands.sides.map((s) => [Array.from(s.cur), Array.from(s.goal), s.lag, s.lagV, s.tight]);
  const mount = fistGrip(H);
  for (const [visible, drawn] of [[true, false], [true, true], [false, false]]) {
    group.visible = visible; tool.blade.drawn = drawn;
    w.preview(null);
    assert.equal(group.visible, false, 'the real carried sword is hidden only during the preview');
    for (let frame = 0; frame < 20; frame++) {
      w.tick(1 / 60); w.place(wardrobeShot(player));
      const contact = mount.position.clone().applyMatrix4(B.hand_r.matrixWorld);
      assert.ok(w.sword.getWorldPosition(new THREE.Vector3()).distanceTo(contact) < 1e-7, 'hilt exactly in the fitted fist');
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(w.sword.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(axis.y > 0.9, 'blade upright beside the body, clear of his face');
      for (const aspect of [1.1, 0.75, 0.6]) for (const yaw of [0, 0.9, Math.PI / 2, Math.PI]) {
        const shot = wardrobeShot(player, yaw, aspect), camera = new THREE.PerspectiveCamera(shot.fov, aspect);
        camera.position.copy(shot.eye); camera.lookAt(shot.look); camera.updateMatrixWorld();
        for (const y of [-0.082, 1.01]) {
          const ndc = new THREE.Vector3(0, y, 0).applyMatrix4(w.sword.matrixWorld).project(camera);
          assert.ok(Math.abs(ndc.x) < 0.96 && Math.abs(ndc.y) < 0.96, 'pommel and blade tip stay inside the turntable picture');
        }
      }
    }
    w.leave();
    for (const [b, q] of before) assert.ok(b.quaternion.equals(q), `${b.name}: exact original pose restored`);
    assert.deepEqual(H.hands.sides.map((s) => [Array.from(s.cur), Array.from(s.goal), s.lag, s.lagV, s.tight]), hands);
    assert.equal(group.visible, visible); assert.equal(group.parent, B.hand_r);
    assert.equal(tool.blade.drawn, drawn); assert.equal(tool.blade.lit, 0);
    assert.equal(JSON.stringify(tool.blade.sheath), sheath); assert.equal(JSON.stringify(flags), state);
    assert.equal(w.sword.parent, null);
  }
});
