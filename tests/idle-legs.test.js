// The traveller standing still: his legs hold still. (The author: "one of the legs is twitching".)
// The coral-shirt traveller's ankle sits high over the ball of his foot, so the ankle -> ball line
// is steep; feet.js read the foot's way from it, and a little roll of the foot swung that way
// through tens of degrees and flipped it to the body's: the held foot snapped round (50 rad/s in a
// frame) and took a settling step every second or so. And the idle layer's weight shift moved the
// hips over the free leg and swung that leg back, so its foot stepped back and forth every 8 s.
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

const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
async function traveller() {
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

/** Stand `secs` (60 Hz): per frame, each leg bone's world turn rate and each foot's ball and state. */
function stand(p, secs) {
  const B = p.humanoid.b, legs = ['thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'], dt = 1 / 60;
  const frames = [];
  let prev = null;
  for (let i = 0; i < secs * 60; i++) {
    p.update(dt, {}, CAM_PLUS_Z);
    p.object.updateMatrixWorld(true);
    const q = legs.map((k) => B[k].getWorldQuaternion(new T.Quaternion()));
    const F = p.humanoid._feet;
    const f = { t: i * dt, rate: {}, feet: {} };
    legs.forEach((k, j) => { f.rate[k] = prev ? q[j].angleTo(prev[j]) / dt : 0; });
    for (const s of ['l', 'r']) f.feet[s] = { ball: B[`ball_${s}`].getWorldPosition(new T.Vector3()), step: !!F?.[s].step, locked: !!F?.[s].locked };
    frames.push(f);
    prev = q;
  }
  return frames;
}

test('standing still, the traveller\'s legs hold still: no twitch, no steps, the feet planted', { timeout: 120000 }, async () => {
  const p = await traveller();
  // (20 s: two of the idle layer's weight shifts, and a look around after 7 s)
  const frames = stand(p, 20).filter((f) => f.t > 0.5);
  let fastest = { rate: 0 }, jolt = { d: 0 };
  for (let i = 1; i < frames.length; i++) {
    for (const [k, r] of Object.entries(frames[i].rate)) {
      if (r > fastest.rate) fastest = { rate: r, k, t: frames[i].t };
      const d = Math.abs(r - frames[i - 1].rate[k]);
      if (d > jolt.d) jolt = { d, k, t: frames[i].t };
    }
  }
  // (before: a foot turned 52 rad/s in one frame, a shin 27; the slow sway of the idle is under 1)
  assert.ok(fastest.rate < 2, `a leg bone turned ${fastest.rate.toFixed(2)} rad/s (${fastest.k} at ${fastest.t?.toFixed(2)} s)`);
  assert.ok(jolt.d < 1.5, `a leg bone's turn rate jumped by ${jolt.d.toFixed(2)} rad/s in a frame (${jolt.k} at ${jolt.t?.toFixed(2)} s)`);
  for (const s of ['l', 'r']) {
    const steps = frames.filter((f, i) => i && f.feet[s].step && !frames[i - 1].feet[s].step);
    assert.equal(steps.length, 0, `the ${s} foot took ${steps.length} settling steps standing still (at ${steps.map((f) => f.t.toFixed(2)).join(', ')} s)`);
    assert.ok(frames.every((f) => f.feet[s].locked), `the ${s} foot stays held`);
    const from = frames[0].feet[s].ball;
    const moved = Math.max(...frames.map((f) => f.feet[s].ball.distanceTo(from)));
    assert.ok(moved < 0.003, `the ${s} foot's ball moved ${(moved * 1000).toFixed(1)} mm while planted`);
  }
});
