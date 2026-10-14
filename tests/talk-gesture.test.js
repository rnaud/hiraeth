// Gestures while people talk (issue #197; src/talk-gesture.js, public/anim/gestures.glb from
// scripts/mocap/build-gestures.mjs): every tone has clips and every clip is in the file; the words pick
// a head shake, a wave, a nod or thanks; the same clip never twice in a row; the clips play on every
// kind of body (the traveller, the people's MakeHuman bodies, the Quaternius ones) with the feet where
// they stand, the hands outside the trunk and the head on the shoulders; nothing at all without the clips
// (the engine bridge); and what it costs a frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };
const { TONES } = await import('../src/story/tone.js');
const { GESTURE_CLIPS, TONE_GESTURES, INTENTS, ACK, GESTURE, TalkGesture, talkGestures, pickGesture, gestureChoices, intentOf } = await import('../src/talk-gesture.js');
const { course, traveller, loadAssets } = await import('./gait-sim.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { Animator } = await import('../src/animator.js');
const { buildCharacter } = await import('../src/player.js');
const { parseBody } = await import('../src/makehuman/body.js');
const { MakeHumanPeople } = await import('../src/makehuman/people.js');
const { readGLB } = await import('../scripts/mocap/glb.js');
const { snapshot } = await import('./rollback.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const FILE = readGLB(readFileSync('public/anim/gestures.glb'));
const IN_FILE = new Map(FILE.clips.map((c) => [c.name, c]));
const ALL = Object.keys(GESTURE_CLIPS);

test('every tone has gestures, every gesture is in gestures.glb, and the file is small', () => {
  for (const tone of TONES) {
    const list = TONE_GESTURES[tone];
    assert.ok(list?.length >= 2, `${tone}: at least two clips (a second line in it takes another)`);
    for (const id of list) assert.ok(GESTURE_CLIPS[id], `${tone}: ${id} is a gesture`);
  }
  for (const I of INTENTS) for (const id of [...I.clips, ...(I.angry ?? [])]) assert.ok(GESTURE_CLIPS[id], `${I.kind}: ${id}`);
  for (const id of ACK.clips) assert.ok(GESTURE_CLIPS[id]);
  for (const id of ALL) {
    const c = IN_FILE.get(`gesture_${id}`);
    assert.ok(c, `${id} in the file`);
    assert.equal(!!c.extras.loop, !!GESTURE_CLIPS[id].loop, `${id}: loops as the table says`);
    assert.equal(c.extras.use, 'clip');
    // (the body above the hips only: no legs, no hips' place; rotations only)
    for (const ch of c.channels) assert.equal(ch.path, 'rotation');
    const bones = c.channels.map((ch) => FILE.nodes[ch.node].name);
    assert.ok(!bones.some((b) => /^(thigh|calf|foot|ball)_|^pelvis$/.test(b)), `${id}: nothing below the spine`);
    assert.ok(bones.includes('Head') && bones.includes('hand_l') && bones.includes('spine_01'), `${id}: the head, the hands, the spine`);
    for (const ch of c.channels) assert.ok(ch.data.every(Number.isFinite), `${id}: finite`);
  }
  assert.equal(FILE.clips.length, ALL.length, 'nothing in the file the layer does not know');
  const bytes = readFileSync('public/anim/gestures.glb').length;
  assert.ok(bytes < 260 * 1024, `gestures.glb ${(bytes / 1024).toFixed(0)} KB`);
});

test('a loop comes round seamlessly: its last frame is its first', () => {
  for (const id of ALL.filter((x) => GESTURE_CLIPS[x].loop)) {
    const c = IN_FILE.get(`gesture_${id}`);
    for (const ch of c.channels) {
      const a = new THREE.Quaternion().fromArray(ch.data, 0), b = new THREE.Quaternion().fromArray(ch.data, (c.n - 1) * 4);
      assert.ok(a.angleTo(b) < 0.02, `${id} ${FILE.nodes[ch.node].name}: ends ${(a.angleTo(b) * 180 / Math.PI).toFixed(1)}° from its start`);
    }
  }
});

test('what the words say picks over the tone: no shakes the head, hello waves, yes nods, thanks are thankful', () => {
  assert.equal(intentOf('No, I cannot let you through.')?.kind, 'no');
  assert.equal(intentOf('Never. Not while I keep this door.')?.kind, 'no');
  assert.equal(intentOf('Hello there, traveller.')?.kind, 'greet');
  assert.equal(intentOf('Farewell, and mind the dunes.')?.kind, 'greet');
  assert.equal(intentOf('Yes, that is the one.')?.kind, 'yes');
  assert.equal(intentOf('Of course I will.')?.kind, 'yes');
  assert.equal(intentOf('I cannot thank you enough.')?.kind, 'thanks');
  assert.equal(intentOf('Nobody comes here.'), null, '"Nobody" is not a no');
  assert.equal(intentOf('Hire a cab at the stand.'), null, '"Hire" is not a hi');
  assert.deepEqual(gestureChoices('neutral', 'No, not that one.'), ['shaking_head_no', 'annoyed_head_shake']);
  assert.deepEqual(gestureChoices('angry', 'No! Get out.'), ['annoyed_head_shake', 'dismissing_gesture']);
  assert.deepEqual(gestureChoices('happy', 'Hello!'), ['waving']);
  assert.deepEqual(gestureChoices('surprised', 'What is that?'), TONE_GESTURES.surprised);
  assert.deepEqual(gestureChoices('no-such-tone', ''), TONE_GESTURES.neutral);
});

test('never the same clip twice in a row, and every clip of a tone comes up', () => {
  for (const tone of TONES) {
    let last = null;
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const id = pickGesture(tone, '', last, (i * 0.6180339) % 1);
      assert.notEqual(id, last, `${tone}: ${id} twice`);
      seen.add(id); last = id;
    }
    for (const id of TONE_GESTURES[tone]) assert.ok(seen.has(id), `${tone}: ${id} came up`);
  }
  // a tone with one clip left after the last (a greeting after a wave): the talk instead, never the wave again
  assert.notEqual(pickGesture('happy', 'Hello again!', 'waving', 0.5), 'waving');
});

// a stand-in Animator for the layer alone: its clips by name, durations as in the file
const fakeA = () => ({ moveClip: (n) => { const c = IN_FILE.get(n); return c ? { duration: (c.n - 1) / 30, userData: { loop: c.extras.loop } } : null; } });

test('a conversation: each line gestures, crossfades from the last, the listener nods now and then, and all of it eases out after', () => {
  const A = fakeA(), you = new TalkGesture(7), them = new TalkGesture(11);
  const dt = 1 / 60;
  let lastYou = null, lastThem = null, nods = 0, lines = 0, most = 0;
  const say = (G, other, who, key, tone, secs, text = '') => {
    for (let t = 0; t < secs + 1.5; t += dt) {
      const speaking = t < secs;
      const out = G.update(dt, { speaking, tone, key, text }, A);
      other.update(dt, { speaking: false, tone, key, text, listening: speaking }, A);
      most = Math.max(most, out.length);
      if (t > 0.5 && speaking) assert.ok(out.some((g) => g.w > 0.5), `${key}: a gesture while it is said`);
      for (const g of out) { assert.ok(g.w >= 0 && g.w <= 1); assert.ok(g.t >= 0); }
    }
  };
  const tones = ['neutral', 'happy', 'happy', 'angry', 'sad', 'sad', 'curious', 'surprised', 'neutral', 'playful'];
  tones.forEach((tone, i) => {
    const G = i % 3 === 2 ? you : them, other = G === you ? them : you;
    say(G, other, G === you ? 'you' : 'them', `n${i}:0`, tone, 1.5 + (i % 4) * 0.8);
    lines++;
    const first = G.last;
    if (G === you) { assert.notEqual(first, lastYou); lastYou = first; } else { assert.notEqual(first, lastThem); lastThem = first; }
  });
  assert.ok(most <= 2, 'two layers at most (the one coming in, the one going out)');
  // the listener's nods: about ACK.chance of the other's lines
  const G = new TalkGesture(3);
  for (let i = 0; i < 100; i++) {
    let nodded = false;
    for (let t = 0; t < 3; t += dt) { const out = G.update(dt, { speaking: false, tone: 'neutral', key: `k${i}`, text: '', listening: true }, A); if (out.some((g) => ACK.clips.includes(g.name.replace('gesture_', '')))) nodded = true; }
    if (nodded) nods++;
  }
  assert.ok(nods > 20 && nods < 60, `the listener nods at ${nods} of 100 lines`);
  // out of the conversation: everything eases out within a blend
  them.update(dt, { speaking: true, tone: 'angry', key: 'last', text: '' }, A);
  for (let t = 0; t < 0.4; t += dt) them.update(dt, { speaking: true, tone: 'angry', key: 'last', text: '' }, A);
  let out;
  for (let t = 0; t <= GESTURE.out + 0.05; t += dt) out = them.update(dt, null, A);
  assert.equal(out.length, 0);
  assert.ok(them.idle);
});

test('a long line: a one-shot over, a talking loop carries on; said, a loop holds a moment and lets go', () => {
  const A = fakeA(), G = new TalkGesture(5), dt = 1 / 60;
  const ids = [];
  for (let t = 0; t < 9; t += dt) { G.update(dt, { speaking: true, tone: 'neutral', key: 'long', text: 'Hello, and welcome to the long road.' }, A); const cur = G.layers.find((L) => !L.out); if (cur && ids.at(-1) !== cur.id) ids.push(cur.id); }
  assert.equal(ids[0], 'waving', 'a greeting waves first');
  assert.ok(ids.length >= 2 && GESTURE_CLIPS[ids[1]].loop, `then a talking loop (${ids.join(', ')})`);
  let t = 0;
  for (; t < 5 && G.layers.length; t += dt) G.update(dt, { speaking: false, tone: 'neutral', key: 'long', text: '' }, A);
  assert.ok(t > GESTURE.hold && t < GESTURE.hold + GESTURE.out + 0.1, `let go ${t.toFixed(2)} s after the line`);
});

// ------------------------------------------------------------------ on the bodies
const segDist = (p, a, b) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
const wp = (o) => o.getWorldPosition(new THREE.Vector3());

/** Play `id` on a body for its length (driven as a line being said), measuring the feet, the hands and the head. */
function play(body, A, B, step, id, secs, seated = false) {
  const info = { speaking: true, key: 'line', tone: 'neutral', text: '', seated };
  if (id) { talkGestures.drive(A, info); A.talkGesture.start(id, A, seated ? GESTURE.seated : 1, 0, !seated); A.talkGesture.key = 'line'; A.talkGesture.last = id; }
  const r = { feet: 0, inside: Infinity, face: 0, finite: true, played: 0 };
  const balls = [wp(B.ball_l), wp(B.ball_r)];
  const R = body.humanoid.rest, turn = (b) => b.getWorldQuaternion(new THREE.Quaternion()).multiply(R.get(b).q.clone().invert());
  for (let i = 0; i < secs * 60; i++) {
    if (id) talkGestures.drive(A, info);
    step();
    if (A.talkW > 0.9 * (seated ? GESTURE.seated : 1) * (GESTURE_CLIPS[id]?.w ?? 1)) r.played++;
    r.feet = Math.max(r.feet, wp(B.ball_l).distanceTo(balls[0]), wp(B.ball_r).distanceTo(balls[1]));
    const pel = wp(B.pelvis), chest = wp(B.spine_03), neck = wp(B.neck_01);
    for (const s of ['l', 'r']) {
      const h = wp(B[`hand_${s}`]), m = wp(B[`middle_02_${s}`] ?? B[`hand_${s}`]);
      if (!Number.isFinite(h.x + h.y + h.z)) r.finite = false;
      // (the trunk's line, hips to chest to neck: the wrist and the hand's middle kept off it)
      for (const p of [h, m]) r.inside = Math.min(r.inside, segDist(p, pel, chest), segDist(p, chest, neck));
    }
    // the face's way from the chest's (deg): on the shoulders, not round behind them
    const c = new THREE.Vector3(0, 0, 1).applyQuaternion(turn(B.Head)).applyQuaternion(turn(B.spine_03).invert());
    r.face = Math.max(r.face, Math.acos(THREE.MathUtils.clamp(c.z, -1, 1)) * 180 / Math.PI);
  }
  return r;
}

const ARMS = ['excited', 'thankful', 'thinking', 'waving', 'yelling', 'talking_2', 'disappointed', 'standing_arguing', 'surprised'];
// (the traveller is built and warmed once, then rolled back to that moment for each clip, tests/rollback.js: every
// clip's feet, hands, face and frames at full weight came out bitwise as on a fresh build's, Math.random seeded alike)
let travellerBuilt = null;
const bodies = {
  async traveller() {
    travellerBuilt ??= (async () => {
      const p = await traveller(course(), V(0, 0, -60), { moves: true, body: 'b3' });
      for (let i = 0; i < 30; i++) p.update(1 / 60, {}, Math.PI);
      p.talking = true;
      const b = { body: p, A: p.animator, B: p.humanoid.b, step: () => { p.update(1 / 60, {}, Math.PI); p.object.updateMatrixWorld(true); } };
      return { b, rewind: snapshot(b, talkGestures) };
    })();
    const { b, rewind } = await travellerBuilt;
    rewind.restore();
    return b;
  },
  async person({ human, kind = 'm', seat = null }) {
    const { lib } = await loadAssets();
    const scene = new THREE.Scene(), physics = new Physics(scene);
    const npc = new NPC(scene, physics, { route: [V()], cape: 0, lines: ['…'], lib, human, kind, seat });
    const player = { pos: V(0, 0, 1.6), vel: V(), riding: false, ride: null, wind: V() };
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 6);
    npc.talkTo = { speaking: true };
    for (let i = 0; i < 90; i++) npc.update(1 / 60, player, camera);
    return { body: npc, A: npc.animator, B: npc.humanoid.b, step: () => { npc.update(1 / 60, player, camera); npc.object.updateMatrixWorld(true); } };
  },
};
const mhData = (() => { const b = readFileSync('public/anim/mh/body.bin'); return parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); })();

// (`clear`: how far a hand stays off the trunk's line, m. The Quaternius body, the people's old one (?mh=0), is the
// slimmest: Excited's fists come 6.6 cm from its line, in front of the robe in the game's pictures)
for (const [name, make, clips, clear = 0.085] of [
  // (the B3 traveller is slimmer than the coral-shirt body this was measured on: Thinking's hand at his chin comes 7.4 cm
  // from his line, every other gesture 10.5 or more; his hands against his real mesh and clothes: tests/traveller-b3.test.js)
  ['the traveller', () => bodies.traveller(), ALL, 0.07],
  ['a MakeHuman man (the people)', () => bodies.person({ human: new MakeHumanPeople(mhData).template('m'), kind: 'm' }), ARMS],
  ['a MakeHuman woman', () => bodies.person({ human: new MakeHumanPeople(mhData).template('f'), kind: 'f' }), ARMS],
  ['a Quaternius man', async () => bodies.person({ human: (await loadAssets()).human.m, kind: 'm' }), ARMS, 0.06],
]) {
  test(`the gestures on ${name}: played, the feet where they stand, the hands outside the trunk, the head on the shoulders`, async () => {
    const base = await make();
    const still = play(base.body, base.A, base.B, base.step, null, 2);
    for (const id of clips) {
      const b = await make();
      const secs = Math.min(3, b.A.moveClip(`gesture_${id}`).duration);
      const r = play(b.body, b.A, b.B, b.step, id, secs);
      assert.ok(r.finite, `${name} / ${id}: finite`);
      assert.ok(r.played > 20, `${name} / ${id}: played (${r.played} frames at full weight)`);
      assert.ok(r.feet < still.feet + 0.01, `${name} / ${id}: the feet move ${(r.feet * 100).toFixed(1)} cm (standing still ${(still.feet * 100).toFixed(1)})`);
      assert.ok(r.inside > clear, `${name} / ${id}: a hand ${(r.inside * 100).toFixed(1)} cm from the trunk's line`);
      assert.ok(r.face < 95, `${name} / ${id}: the face ${r.face.toFixed(0)}° from the chest's way`);
    }
  });
}

test('seated: the gesture lifts the arms off the lap, the back stays on the seat', async () => {
  const { lib } = await loadAssets();
  const make = () => bodies.person({ human: new MakeHumanPeople(mhData).template('m'), kind: 'm', seat: 0.45 });
  const a = await make(), b = await make();
  const hand = (x) => wp(x.B.hand_r).sub(x.body.object.position);
  const chest = (x) => wp(x.B.spine_03).sub(x.body.object.position);
  play(a.body, a.A, a.B, a.step, null, 1.2);
  const r = play(b.body, b.A, b.B, b.step, 'waving', 1.2, true);
  assert.ok(r.finite);
  assert.ok(hand(b).y > hand(a).y + 0.15, `the waving hand up ${((hand(b).y - hand(a).y) * 100).toFixed(0)} cm`);
  assert.ok(chest(b).distanceTo(chest(a)) < 0.03, 'the chest where it sat');
  assert.ok(lib);
});

test('walking, or under a move of the whole body, the gestures let go; without the clips (the engine bridge) nothing runs', async () => {
  const { lib } = await loadAssets();
  const A = new Animator(lib, buildCharacter());
  const s = (speed) => ({ speed, onGround: true, mode: 'ground', walkAt: 1, jogAt: 2, sprintAt: 3, strideScale: 1 });
  const info = { speaking: true, key: 'k', tone: 'angry', text: '' };
  for (let i = 0; i < 40; i++) { talkGestures.drive(A, info); A.update(1 / 60, s(0)); }
  assert.ok(A.talkW > 0.9, 'standing: the gesture plays');
  for (let i = 0; i < 40; i++) { talkGestures.drive(A, info); A.update(1 / 60, s(2)); }
  assert.equal(A.talkW, 0, 'walking: let go');
  // the bridge loads no captured motion (engine/game.js): drive() makes nothing, update() steps nothing
  const B = new Animator({ ...lib, motion: null }, buildCharacter());
  talkGestures.drive(B, info);
  assert.equal(B.talkGesture, undefined);
  B.update(1 / 60, s(0));
  assert.equal(B.talkW, undefined, 'nothing stepped');
});

test('the cost: three bodies in a conversation gesturing take a few hundredths of a millisecond a frame', async () => {
  const { lib } = await loadAssets();
  const As = [0, 1, 2].map(() => new Animator(lib, buildCharacter()));
  const s = { speed: 0, onGround: true, mode: 'talk', walkAt: 1, jogAt: 2, sprintAt: 3, strideScale: 1 };
  // (the layer's own time: Animator.layTalk, the stepping and the overlay, as the game calls it)
  let spent = 0;
  const lay = Animator.prototype.layTalk;
  const timed = function (...a) { const t0 = performance.now(); lay.apply(this, a); spent += performance.now() - t0; };
  for (const A of As) A.layTalk = timed;
  const run = (frames) => {
    spent = 0;
    for (let f = 0; f < frames; f++) As.forEach((A, i) => {
      // (one says a line, the others listen; a new line every 4 s)
      talkGestures.drive(A, { speaking: i === Math.floor(f / 240) % 3, tone: ['neutral', 'angry', 'happy'][i], key: `k${Math.floor(f / 240)}`, text: '', listening: i !== Math.floor(f / 240) % 3 });
      A.update(1 / 60, s);
    });
    return spent / frames;
  };
  run(600);   // (warm)
  const ms = run(2400);
  console.log(`three bodies talking: the gesture layer ${ms.toFixed(4)} ms a frame (Node, this machine)`);
  assert.ok(ms < 0.1, `${ms.toFixed(3)} ms a frame`);
});
