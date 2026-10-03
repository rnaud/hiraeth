import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid } from '../src/humanoid.js';
import { buildCharacter, Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { Gear } from '../src/gear.js';

const bytes = await readFile(new URL('../public/anim/traveller.glb', import.meta.url));
const length = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + length));
// Test the real geometry and skeleton without requiring a browser image decoder.
const json = structuredClone(asset);
for (const m of json.materials) delete m.pbrMetallicRoughness.baseColorTexture;
delete json.images; delete json.textures;
const binary = bytes.subarray(28 + length);
json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const template = (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;

test('traveller asset includes an embedded illustrated texture and weighted humanoid skin', () => {
  assert.equal(asset.images.length, 1);
  assert.ok(asset.images[0].bufferView !== undefined);
  assert.equal(asset.skins[0].joints.length, 22);
  template.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const weights = o.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < .002);
  });
});

test('imported rig retargets, plants feet and reaches walls under rotated gravity', () => {
  for (const angle of [0, Math.PI / 2]) {
    const char = buildCharacter();
    const h = new Humanoid(template, char, 'm', { imported: true });
    char.root.rotation.z = angle;
    const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    const normal = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < 30; i++) {
      char.legs[0].rotation.x = Math.sin(i * .2) * .7;
      char.legs[1].rotation.x = -Math.sin(i * .2) * .7;
      char.arms[0].rotation.x = -.5; char.elbows[0].rotation.x = -1;
      h.update();
      h.plantFeet(1 / 60, { heightAbove: p => p.dot(up), groundNormal: (x, y, z, out) => out.copy(up) }, up, char.root.position, new THREE.Vector3(0, 0, 1));
      h.resetFeet();
    }
    const B = h.b;
    h.reach({ hands: ['r', 'l'].map(s => B[`hand_${s}`].getWorldPosition(new THREE.Vector3())), feet: ['r', 'l'].map(s => B[`foot_${s}`].getWorldPosition(new THREE.Vector3())), wallN: normal, up, wallContact: true });
    for (const s of ['r', 'l']) {
      const toe = B[`ball_${s}`].getWorldPosition(new THREE.Vector3()).sub(B[`foot_${s}`].getWorldPosition(new THREE.Vector3())).normalize();
      assert.ok(toe.dot(normal) < -.9);
      const fingerRest = new THREE.Vector3(0, 1, 0).applyQuaternion(h.rest.get(B[`hand_${s}`]).q);
      const finger = fingerRest.applyQuaternion(h.rest.get(B[`hand_${s}`]).q.clone().invert()).applyQuaternion(B[`hand_${s}`].getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(finger.dot(up) > .99);
    }
    h.model.traverse(o => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      for (let i = 0; i < o.geometry.attributes.position.count; i += 17) {
        const p = o.getVertexPosition(i, new THREE.Vector3());
        assert.ok(p.toArray().every(Number.isFinite));
        assert.ok(p.length() < 4, 'skin stays within character scale');
      }
    });
  }
});

test('imported outfit keeps the scout dock and handheld device without duplicate wearables', () => {
  const char = buildCharacter(), h = new Humanoid(template, char, 'm', { imported: true });
  const g = new Gear(new THREE.Scene(), h, char);
  h.update(); g.update(1 / 60, new THREE.Vector3(), 0, 0, true);
  assert.ok(g.scoutDock.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
  assert.equal(g.noShadow.length, 1);
  assert.ok(g.noShadow[0].isSkinnedMesh);
  assert.equal(g.springs.length, 0);
  assert.ok(g.device.visible);
});

test('vehicle animation reaches the skin on the first frame and releases foot locks', () => {
  const p = new Player(new Physics(new THREE.Scene()));
  p.ride = { speed: 0, pos: new THREE.Vector3(), update() {}, seatTransform(pos, q) { pos.set(0, 2, 0); q.identity(); } };
  p.humanoid = new Humanoid(template, p.char, 'm', { imported: true });
  p.humanoid._feet = { l: { locked: true }, r: { locked: true } };
  p.gear = { device: { visible: true } };
  p.updateCloth = () => {};
  const before = p.humanoid.b.thigh_r.quaternion.clone();
  p.update(1 / 60, {}, 0);
  assert.ok(before.angleTo(p.humanoid.b.thigh_r.quaternion) > .5);
  assert.equal(p.humanoid._feet.r.locked, false);
  assert.equal(p.gear.device.visible, false);
});

// Sample the actual shipped motion library, including the seam at the end of
// each loop. This caught the fixed 78-degree A-pose/T-pose wrist mismatch.
const motionBytes = await readFile(new URL('../public/anim/ual.glb', import.meta.url));
const motion = await new GLTFLoader().parseAsync(motionBytes.buffer.slice(motionBytes.byteOffset, motionBytes.byteOffset + motionBytes.byteLength), '');
const { Animator } = await import('../src/animator.js');
const gaitClips = Object.fromEntries([['walk', 'Walk_Loop'], ['jog', 'Jog_Fwd_Loop'], ['sprint', 'Sprint_Loop']].map(([key, name]) => [key, motion.animations.find(c => c.name === name)]));
const direction = (a, b) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();
for (const gait of ['walk', 'jog', 'sprint']) test(`${gait}: arms, legs, hands and palms match all 120 phases of the source motion`, () => {
  const char = buildCharacter(), h = new Humanoid(template, char, 'm', { imported: true });
  const a = new Animator({ scene: motion.scene, clips: gaitClips, native: { walk: 1, jog: 3, sprint: 6 } }, char);
  const rootQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, .7, -.4));
  char.root.quaternion.copy(rootQ);
  let first;
  for (let frame = 0; frame <= 120; frame++) {
    for (const [name, action] of Object.entries(a.actions)) { action.setEffectiveWeight(name === gait ? 1 : 0); action.time = (frame % 120) / 120 * gaitClips[name].duration; }
    a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(char.root); h.update(); h.poseHands(a);
    const B = h.b;
    for (const s of ['r', 'l']) {
      for (const [parent, child] of [['upperarm', 'lowerarm'], ['lowerarm', 'hand'], ['thigh', 'calf'], ['calf', 'foot']]) {
        const from = `${parent}_${s}`, to = `${child}_${s}`;
        const want = direction(a.bone(from), a.bone(to)).applyQuaternion(rootQ);
        assert.ok(direction(B[from], B[to]).dot(want) > .99999, `${gait} ${frame}: ${from} follows its own source limb`);
        const length = B[from].getWorldPosition(new THREE.Vector3()).distanceTo(B[to].getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(length - h.rest.get(B[from]).p.distanceTo(h.rest.get(B[to]).p)) < .0001, 'limb length stays fixed');
      }
      const foot = B[`foot_${s}`];
      const sole = new THREE.Vector3(0, 0, 1).applyQuaternion(h.rest.get(foot).q.clone().invert()).applyQuaternion(foot.getWorldQuaternion(new THREE.Quaternion()));
      const expectedSole = new THREE.Vector3(0, 0, 1).applyQuaternion(char.feet[s === 'r' ? 0 : 1].getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(sole.dot(expectedSole) > .99999, 'boot sole keeps the corrected clip pitch');
      const hand = B[`hand_${s}`], q = hand.getWorldQuaternion(new THREE.Quaternion());
      const along = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const want = direction(a.bone(`hand_${s}`), a.bone(`middle_01_${s}`)).applyQuaternion(rootQ);
      assert.ok(along.dot(want) > .99999, `${gait} ${frame}: fingertips follow the source wrist`);
      const rest = h.handFrames[s];
      const palm = rest.normal.clone().addScaledVector(rest.along, -rest.normal.dot(rest.along)).normalize()
        .applyQuaternion(h.rest.get(hand).q.clone().invert()).applyQuaternion(q);
      const sourcePalm = a.handFrames[s].normal.clone().applyQuaternion(a.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ);
      assert.ok(palm.dot(sourcePalm) > .99999, `${gait} ${frame}: palm twist follows source`);
    }
    const pose = Object.values(h.b).map(b => b.quaternion.clone());
    if (!first) first = pose;
    if (frame === 120) pose.forEach((q, i) => assert.ok(q.angleTo(first[i]) < .0001, 'no jump at loop boundary'));
  }
});
