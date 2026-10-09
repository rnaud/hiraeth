// The traveller standing still: his legs hold still. (The author: "one of the legs is twitching".)
// The coral-shirt traveller's ankle sits high over the ball of his foot, so the ankle -> ball line
// is steep; feet.js read the foot's way from it, and a little roll of the foot swung that way
// through tens of degrees and flipped it to the body's: the held foot snapped round (50 rad/s in a
// frame) and took a settling step every second or so. And the idle layer's weight shift moved the
// hips over the free leg and swung that leg back, so its foot stepped back and forth every 8 s.
// Also here, on the same standing (one run of the captured idles serves three checks, each of which ran its own
// 30-49 s of standing in a file of its own; the run is the same frames whoever reads it): his head on his
// shoulders through the idles (once tests/head-turn.test.js), and holding still while talking
// (once tests/talk-still.test.js).
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

/**
 * Stand `secs` (60 Hz), talking or not; per frame: each leg bone's world turn rate and each foot's ball and state, the
 * captured idle playing, the face's way from the chest (deg) and in the body's frame, the pelvis's sideways place.
 */
function stand(p, secs, { talking = false } = {}) {
  p.talking = talking;
  const B = p.humanoid.b, R = p.humanoid.rest, legs = ['thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'], dt = 1 / 60;
  const turn = (b) => b.getWorldQuaternion(new T.Quaternion()).multiply(R.get(b).q.clone().invert());
  const frames = [];
  let prev = null;
  for (let i = 0; i < secs * 60; i++) {
    p.update(dt, {}, CAM_PLUS_Z);
    p.object.updateMatrixWorld(true);
    const q = legs.map((k) => B[k].getWorldQuaternion(new T.Quaternion()));
    const F = p.humanoid._feet;
    const f = { i, t: i * dt, rate: {}, feet: {} };
    legs.forEach((k, j) => { f.rate[k] = prev ? q[j].angleTo(prev[j]) / dt : 0; });
    for (const s of ['l', 'r']) f.feet[s] = { ball: B[`ball_${s}`].getWorldPosition(new T.Vector3()), step: !!F?.[s].step, locked: !!F?.[s].locked };
    f.move = p.animator.move?.clip?.name ?? null; f.moveW = p.animator.moveW; f.look = p.animator.w.look;
    // the face's way in the chest's frame (the head's limits, below)
    const head = turn(B.Head), c = new T.Vector3(0, 0, 1).applyQuaternion(head).applyQuaternion(turn(B.spine_03).invert());
    f.chestYaw = deg(Math.atan2(c.x, c.z)); f.chestPitch = deg(Math.asin(-c.y));
    // and in the body's (talking, below)
    const b = new T.Vector3(0, 0, 1).applyQuaternion(head).applyQuaternion(p.object.getWorldQuaternion(new T.Quaternion()).invert());
    f.bodyYaw = deg(Math.atan2(b.x, b.z));
    f.hip = p.object.worldToLocal(B.pelvis.getWorldPosition(new T.Vector3())).x;
    frames.push(f);
    prev = q;
  }
  return frames;
}
const deg = (r) => r * 180 / Math.PI;

// One standing with the captured idles, 49 s (the looking about from 7 s, the breathing idle from 23 s, the library's
// look-around from 43 s), run once and read by the tests below: the legs' over its first 36 s, the head's over all of
// it, talking's as the standing to compare with over its first 30 s.
let idles = null;
const idleRun = async () => (idles ??= stand(await traveller({ moves: true }), 49));

for (const moves of [false, true]) test(`standing still, the traveller's legs hold still: no twitch, no steps, the feet planted${moves ? ' (with the captured idles: looking about, breathing)' : ''}`, { timeout: 240000 }, async () => {
  // (20 s: two of the idle layer's weight shifts, and a look around after 7 s; with the captured
  // idles 36 s: Mixamo's looking about from 7 s, its breathing idle from 23 s: the shared run's first 36 s)
  const frames = (moves ? (await idleRun()).filter((f) => f.t < 36) : stand(await traveller(), 20)).filter((f) => f.t > 0.5);
  if (moves) for (const n of ['mixamo_looking_around', 'mixamo_breathing_idle']) assert.ok(frames.some((f) => f.move === n && f.moveW > 0.9), `${n} played`);
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
  // he stands upright with his feet under him, as drawn, not in the idle clip's split stance
  // (one foot 43 cm ahead of the other: side on, a stride)
  const { l, r } = frames.at(-1).feet;
  assert.ok(Math.abs(l.ball.z - r.ball.z) < 0.2, `the feet ${Math.abs(l.ball.z - r.ball.z).toFixed(2)} m apart fore and aft`);
  assert.ok(Math.abs(l.ball.x - r.ball.x) < 0.45, `the feet ${Math.abs(l.ball.x - r.ball.x).toFixed(2)} m apart side to side`);
});

/** The face's pitch (deg, + down) in the body's frame: the Head bone's turn from its rest applied to straight ahead. */
const facePitch = (p) => {
  const B = p.humanoid.b, q = B.Head.getWorldQuaternion(new T.Quaternion()).multiply(p.humanoid.rest.get(B.Head).q.clone().invert());
  const f = new T.Vector3(0, 0, 1).applyQuaternion(q).applyQuaternion(p.object.getWorldQuaternion(new T.Quaternion()).invert());
  return Math.asin(-f.y) * 180 / Math.PI;
};

test('the traveller looks ahead, standing and running, not at the ground', { timeout: 120000 }, async () => {
  // (the retarget turned the whole head by the neck's line: running, the neck leans 35-50 deg forward
  // while the clip's head stays up, so the face looked 35 deg down jogging and 48 sprinting; standing,
  // the idle clip holds it 15 deg down)
  for (const [input, most, label] of [[{}, 10, 'standing'], [{ KeyW: true }, 26, 'jogging'], [{ KeyW: true, ShiftLeft: true }, 28, 'sprinting']]) {
    const p = await traveller(), dt = 1 / 60, pitches = [];
    for (let i = 0; i < 360; i++) { p.update(dt, input, CAM_PLUS_Z); p.object.updateMatrixWorld(true); if (i > 120) pitches.push(facePitch(p)); }
    const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    assert.ok(mean < most && mean > -10, `${label}: the face ${mean.toFixed(1)} deg down on average`);
  }
});

// ------------------------------------------------------------------ the head on his shoulders (once tests/head-turn.test.js)
// The traveller's head on his neck through the standing idles. (The author: "an animation where his
// mouth opens wide and his neck moves strangely".) The looking-around idles turned his skull 105° on
// the neck, the jaw into the shoulder and the face stretched over it: the clip's head is read in the
// world, so it carried the chest's twist too, which our chest doesn't take (Animator HEAD_TURN;
// tests/head-turn.test.js has limitHeadTurn's own test).
test('standing through the captured idles and the look-around, his head stays on his shoulders', { timeout: 300000 }, async () => {
  const frames = await idleRun(), played = new Set();
  let most = { yaw: 0 }, low = { pitch: 0 };
  for (const f of frames) {
    if (f.moveW > 0.5) played.add(f.move ?? undefined);
    if (f.look > 0.5) played.add('look');
    if (Math.abs(f.chestYaw) > Math.abs(most.yaw)) most = { yaw: f.chestYaw, t: f.t };
    if (f.chestPitch > low.pitch) low = { pitch: f.chestPitch, t: f.t };
  }
  for (const n of ['mixamo_looking_around', 'mixamo_breathing_idle', 'look']) assert.ok(played.has(n), `${n} played`);
  // (before: 105° round at 11.2 s, in the looking about)
  assert.ok(Math.abs(most.yaw) < 80, `the face turned ${most.yaw.toFixed(0)}° from the chest (at ${most.t.toFixed(1)} s)`);
  assert.ok(low.pitch < 50, `the face ${low.pitch.toFixed(0)}° down from the chest (at ${low.t.toFixed(1)} s)`);
});

// ------------------------------------------------------------------ talking (once tests/talk-still.test.js)
// In a conversation the traveller holds still and keeps his eyes on the speaker (playtest, October 2026:
// "when the camera points at the player's character, the character moves around"; "the character looks
// around too much during dialogue"). Standing, his idle layer shifts his weight, turns his head ±25° and
// after 7 s plays the captured looking-about and breathing idles; talking (Player.talking, set by
// src/story/index.js while a conversation is open), none of that: src/player.js TALK_CALM.
test('talking, the traveller holds still: no head glances, no weight shifts, no looking about', { timeout: 240000 }, async () => {
  // 30 s: the weight shift's full swing (16 s), the head's glances (30 s), the captured idles from 7 s; settled
  // into it after 1.5 s (standing: the shared run's first 30 s)
  const watch = (frames) => {
    const f = frames.filter((x) => x.i >= 90 && x.i < 30 * 60), range = (a) => Math.max(...a) - Math.min(...a);
    return { yaw: range(f.map((x) => x.bodyYaw)), hip: range(f.map((x) => x.hip)), moves: new Set(f.filter((x) => x.move && x.moveW > 0.2).map((x) => x.move)) };
  };
  const idle = watch(await idleRun());
  const talk = watch(stand(await traveller({ moves: true }), 30, { talking: true }));
  assert.ok(idle.moves.size > 0, `standing, the captured idles play (${[...idle.moves]})`);
  assert.equal(talk.moves.size, 0, `talking, none of them (${[...talk.moves]})`);
  assert.ok(idle.yaw > 20, `standing, the head looks about (${idle.yaw.toFixed(1)} deg)`);
  assert.ok(talk.yaw < 6, `talking, the head holds (${talk.yaw.toFixed(1)} deg; ${idle.yaw.toFixed(1)} standing)`);
  assert.ok(talk.hip < idle.hip * 0.4, `talking, the hips sway ${(talk.hip * 100).toFixed(1)} cm (${(idle.hip * 100).toFixed(1)} standing)`);
});
