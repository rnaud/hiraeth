// In a conversation the traveller holds still and keeps his eyes on the speaker (playtest, October 2026:
// "when the camera points at the player's character, the character moves around"; "the character looks
// around too much during dialogue"). Standing, his idle layer shifts his weight, turns his head ±25° and
// after 7 s plays the captured looking-about and breathing idles; talking (Player.talking, set by
// src/story/index.js while a conversation is open), none of that: src/player.js TALK_CALM.
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


/** Stand `secs` (60 Hz), talking or not: the head's yaw in the body's frame (deg), the pelvis's sideways place (m), the captured idles played. */
function watch(p, secs, talking) {
  p.talking = talking;
  const B = p.humanoid.b, yaws = [], hips = [], moves = new Set();
  for (let i = 0; i < secs * 60; i++) {
    p.update(1 / 60, {}, CAM_PLUS_Z);
    p.object.updateMatrixWorld(true);
    if (i < 90) continue;   // (settled into it)
    const inv = p.object.getWorldQuaternion(new T.Quaternion()).invert();
    const q = B.Head.getWorldQuaternion(new T.Quaternion()).multiply(p.humanoid.rest.get(B.Head).q.clone().invert());
    const f = new T.Vector3(0, 0, 1).applyQuaternion(q).applyQuaternion(inv);
    yaws.push(Math.atan2(f.x, f.z) * 180 / Math.PI);
    hips.push(p.object.worldToLocal(B.pelvis.getWorldPosition(new T.Vector3())).x);
    if (p.animator.move && p.animator.moveW > 0.2) moves.add(p.animator.move.clip.name);
  }
  const range = (a) => Math.max(...a) - Math.min(...a);
  return { yaw: range(yaws), hip: range(hips), moves };
}

test('talking, the traveller holds still: no head glances, no weight shifts, no looking about', { timeout: 240000 }, async () => {
  // 30 s: the weight shift's full swing (16 s), the head's glances (30 s), the captured idles from 7 s
  const idle = watch(await traveller({ moves: true }), 30, false);
  const talk = watch(await traveller({ moves: true }), 30, true);
  assert.ok(idle.moves.size > 0, `standing, the captured idles play (${[...idle.moves]})`);
  assert.equal(talk.moves.size, 0, `talking, none of them (${[...talk.moves]})`);
  assert.ok(idle.yaw > 20, `standing, the head looks about (${idle.yaw.toFixed(1)} deg)`);
  assert.ok(talk.yaw < 6, `talking, the head holds (${talk.yaw.toFixed(1)} deg; ${idle.yaw.toFixed(1)} standing)`);
  assert.ok(talk.hip < idle.hip * 0.4, `talking, the hips sway ${(talk.hip * 100).toFixed(1)} cm (${(idle.hip * 100).toFixed(1)} standing)`);
});
