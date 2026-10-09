// The traveller's head on his neck through the standing idles. (The author: "an animation where his
// mouth opens wide and his neck moves strangely".) The looking-around idles turned his skull 105° on
// the neck, the jaw into the shoulder and the face stretched over it: the clip's head is read in the
// world, so it carried the chest's twist too, which our chest doesn't take (Animator HEAD_TURN).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { parseBody } = await import('../src/makehuman/body.js');
const { Player } = await import('../src/player.js');
const { Physics } = await import('../src/physics.js');
const { Animator, libraryFrom } = await import('../src/animator.js');
const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
const { course, CAM_PLUS_Z } = await import('../src/gait-course.js');
const { HEAD_TURN, limitHeadTurn } = await import('../src/animator.js');
const { attachMotion } = await import('../src/motion-match.js');

const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
async function traveller({ moves = false } = {}) {
  const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const dir = 'public/characters/traveller-v1/';
  const report = JSON.parse(readFileSync(dir + 'rig.json')), colors = JSON.parse(readFileSync(dir + 'colors.json'));
  // (the shipped GLB without its textures: Node has no image decoder)
  const g = readFileSync(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.materials;
  for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const lib = libraryFrom(await parse('public/anim/ual.glb'));
  if (moves) attachMotion(lib, await parse('public/anim/moves.glb'));   // (the captured idles: Animator idleMoves)
  const scene = course(), physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.character = createTravellerV1(p.char, { gltf, data, report, colors });
  p.humanoid = p.character.humanoid;
  p.gear = { update() {}, device: { visible: true } };
  p._lastVel = new T.Vector3();
  p.pos.set(0, physics.groundAt(0, 5, 0), 0); p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true; p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}


const deg = (r) => r * 180 / Math.PI;

test('limitHeadTurn: small turns as they are, big ones eased under the limits, the way kept', () => {
  const q = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, 'YXZ'));
  const small = q(0.1, 0.2, 0), out = limitHeadTurn(small.clone());
  assert.ok(out.angleTo(small) < 0.02, 'a small turn barely changes');
  const yawOf = (r) => { const f = new T.Vector3(0, 0, 1).applyQuaternion(r); return Math.atan2(f.x, f.z); };
  const big = limitHeadTurn(q(0, 1.83, 0));   // 105°
  assert.ok(Math.abs(yawOf(big)) <= HEAD_TURN.yaw + 1e-6 && yawOf(big) > 0.9, `105° about the neck comes to ${deg(yawOf(big)).toFixed(0)}°, the same way`);
  const nod = limitHeadTurn(q(1.2, 0, 0));
  const tilt = 2 * Math.acos(Math.min(1, Math.abs(nod.w)));
  assert.ok(tilt <= HEAD_TURN.tilt + 1e-6 && nod.x > 0, `a 69° nod comes to ${deg(tilt).toFixed(0)}°, still down`);
  assert.ok(limitHeadTurn(new T.Quaternion()).angleTo(new T.Quaternion()) < 1e-9, 'none stays none');
});

test('standing through the captured idles and the look-around, his head stays on his shoulders', { timeout: 300000 }, async () => {
  const p = await traveller({ moves: true }), B = p.humanoid.b, R = p.humanoid.rest, dt = 1 / 60;
  const turn = (b) => b.getWorldQuaternion(new T.Quaternion()).multiply(R.get(b).q.clone().invert());
  let most = { yaw: 0 }, low = { pitch: 0 }, played = new Set();
  // (the looking about from 7 s, the breathing idle from 23 s, the library's look-around from 43 s)
  for (let i = 0; i < 49 * 60; i++) {
    p.update(dt, {}, CAM_PLUS_Z); p.object.updateMatrixWorld(true);
    if (p.animator.moveW > 0.5) played.add(p.animator.move?.clip?.name);
    if (p.animator.w.look > 0.5) played.add('look');
    // the face's way in the chest's frame
    const f = new T.Vector3(0, 0, 1).applyQuaternion(turn(B.Head)).applyQuaternion(turn(B.spine_03).invert());
    const yaw = deg(Math.atan2(f.x, f.z)), pitch = deg(Math.asin(-f.y));
    if (Math.abs(yaw) > Math.abs(most.yaw)) most = { yaw, t: i * dt };
    if (pitch > low.pitch) low = { pitch, t: i * dt };
  }
  for (const n of ['mixamo_looking_around', 'mixamo_breathing_idle', 'look']) assert.ok(played.has(n), `${n} played`);
  // (before: 105° round at 11.2 s, in the looking about)
  assert.ok(Math.abs(most.yaw) < 80, `the face turned ${most.yaw.toFixed(0)}° from the chest (at ${most.t.toFixed(1)} s)`);
  assert.ok(low.pitch < 50, `the face ${low.pitch.toFixed(0)}° down from the chest (at ${low.t.toFixed(1)} s)`);
});
