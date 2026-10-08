import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { HAND_POSES, POSE_IDS, N_PARAMS, TONE_GESTURES, PROP_GRIPS, handTargets, mixPose, easePose, tightness, playerHands, npcHands, talkOf, updateHands, HANDS } from '../src/hands.js';
import { TONES } from '../src/story/tone.js';
import { PROPS } from '../src/costumes.js';

// The hands (src/hands.js): the fingers' relaxed arc at rest, poses by context, blended smoothly.
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
async function glb(name) {
  const bytes = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}
const human = prepareHuman(await glb('human_m.glb'), 'm');
const body = () => new Humanoid(human, buildCharacter(), 'm');
const at = (b) => b.getWorldPosition(new THREE.Vector3());

/** A finger's bend: the angle between the palm's line (wrist -> knuckle) and the knuckle -> fingertip (rad). */
function bend(h, f, s = 'l') {
  const B = h.b;
  h.model.updateMatrixWorld(true);
  const wrist = at(B[`hand_${s}`]), knuckle = at(B[`${f}_01_${s}`]), tip = at(B[`${f}_04_leaf_${s}`]);
  return knuckle.clone().sub(wrist).angleTo(tip.sub(knuckle));
}
/** How far the fingertip has moved toward the palm's side (m, along its facing at rest: down in the T-pose). */
function towardPalm(h, f, s = 'l') {
  h.model.updateMatrixWorld(true);
  return -(at(h.b[`${f}_04_leaf_${s}`]).y - at(h.b[`hand_${s}`]).y);
}

test('the bodies have finger bones, and every person starts with a relaxed hand: an arc, more curled toward the little finger', () => {
  const h = body();
  assert.ok(h.hands, 'a Humanoid has hands');
  assert.equal(h.hands.sides.length, 2);
  for (const S of h.hands.sides) {
    assert.equal(S.joints.length, 12, 'three joints in each of four fingers');
    assert.equal(S.thumb.length, 3);
  }
  for (const s of ['l', 'r']) {
    const b = ['index', 'middle', 'ring', 'pinky'].map((f) => bend(h, f, s));
    for (const x of b) assert.ok(x > 0.5 && x < 1.4, `a relaxed finger is bent (${x.toFixed(2)} rad)`);
    for (let i = 1; i < 4; i++) assert.ok(b[i] > b[i - 1], `each finger more curled than the last (${b.map((x) => x.toFixed(2))})`);
    // toward the palm, not the back of the hand
    for (const f of ['index', 'middle', 'ring', 'pinky']) assert.ok(towardPalm(h, f, s) > 0.015, `${f} curls toward the palm`);
  }
});

test('the flat pose is nearly straight, the fist closes and the thumb comes in under the palm', () => {
  const h = body();
  h.hands.set('flat');
  const flat = bend(h, 'middle');
  assert.ok(flat < 0.25, `flat: ${flat}`);
  h.hands.set('fist');
  const fist = bend(h, 'middle');
  assert.ok(fist > 2.2, `a fist folds the finger back on itself (${fist})`);
  // the thumb: across the palm toward the index's middle (closer than in the flat hand)
  const thumbTo = () => { h.model.updateMatrixWorld(true); return at(h.b.thumb_04_leaf_l).distanceTo(at(h.b.middle_02_l)); };
  const closed = thumbTo();
  h.hands.set('flat');
  assert.ok(closed < thumbTo() - 0.01, 'the fist\'s thumb wraps in');
});

test('poses: every pose is complete and in range; every tone and every prop has one', () => {
  for (const id of POSE_IDS) {
    assert.equal(HAND_POSES[id].length, N_PARAMS, id);
    for (const v of HAND_POSES[id]) assert.ok(Number.isFinite(v) && Math.abs(v) < 2, `${id}: ${v}`);
  }
  for (const t of TONES) assert.ok(HAND_POSES[TONE_GESTURES[t]], `tone ${t}`);
  for (const p of Object.keys(PROPS)) if (p !== 'none') assert.ok(HAND_POSES[PROP_GRIPS[p]], `prop ${p}`);
});

const top = (w) => Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
const sum = (w) => Object.values(w).reduce((a, b) => a + b, 0);

test('the pose for each context', () => {
  const cases = [
    [{}, 'relaxed', 'relaxed'],
    [{ mode: 'ground', speed: 1.3 }, 'relaxed', 'relaxed'],
    [{ mode: 'ground', speed: 6 }, 'open', 'open'],
    [{ mode: 'glide' }, 'open', 'open'],
    [{ mode: 'climb' }, 'grip', 'grip'],
    [{ mode: 'mantle' }, 'flat', 'flat'],
    [{ mode: 'ride', ride: 'bike' }, 'grip', 'grip'],
    [{ mode: 'ride', ride: 'bird' }, 'reins', 'reins'],
    [{ mode: 'swim' }, 'cup', 'cup'],
    [{ mode: 'down' }, 'limp', 'limp'],
    [{ mode: 'seated' }, 'limp', 'limp'],
    [{ mode: 'ground', aim: 1 }, 'fist', 'cup'],
    [{ mode: 'ground', handoff: 1 }, 'grip', 'grip'],
    [{ mode: 'ground', prop: 'staff' }, 'grip', 'relaxed'],
    [{ mode: 'ground', prop: 'lantern' }, 'hook', 'relaxed'],
    [{ mode: 'ground', startle: 1 }, 'splay', 'splay'],
    [{ mode: 'ground', talk: { tone: 'angry', k: 1, beat: 0.5 } }, 'fist', 'fist'],
    [{ mode: 'ground', talk: { tone: 'curious', k: 1, beat: 1 } }, 'point', 'talk'],   // (pointing with one hand)
    [{ mode: 'ground', talk: { tone: 'sad', k: 1 } }, 'limp', 'limp'],
    // a staff in the right hand: the left one gestures
    [{ mode: 'ground', prop: 'staff', talk: { tone: 'happy', k: 1 } }, 'grip', 'open'],
    // on a wall the hands hold on, whatever is said
    [{ mode: 'climb', talk: { tone: 'shout', k: 1 } }, 'grip', 'grip'],
    [{ pose: 'pinch', mode: 'climb' }, 'pinch', 'pinch'],
  ];
  for (const [ctx, r, l] of cases) {
    const T = handTargets(ctx);
    assert.equal(top(T.r), r, `right hand for ${JSON.stringify(ctx)}: ${JSON.stringify(T.r)}`);
    assert.equal(top(T.l), l, `left hand for ${JSON.stringify(ctx)}: ${JSON.stringify(T.l)}`);
    assert.ok(Math.abs(sum(T.r) - 1) < 1e-9 && Math.abs(sum(T.l) - 1) < 1e-9, 'weights sum to 1');
    assert.ok(T.rate > 0);
  }
  // grabbing is quicker than letting go
  assert.ok(handTargets({ mode: 'climb' }).rate > handTargets({ mode: 'ground' }).rate);
  // a hop off a kerb doesn't throw the hands open; a real fall does
  assert.equal(top(handTargets({ mode: 'air', air: 0.05 }).r), 'relaxed');
  assert.notEqual(top(handTargets({ mode: 'air', air: 1 }).r), 'relaxed');
});

test('walking into a run opens the hand gradually; the blend is the weighted angles', () => {
  let last = -1;
  for (let v = 0; v <= 7; v += 0.5) {
    const w = handTargets({ mode: 'ground', speed: v }).r;
    const open = w.open ?? 0;
    assert.ok(open >= last - 1e-9, 'never closes again as you speed up');
    last = open;
  }
  const m = mixPose({ relaxed: 0.5, fist: 0.5 });
  for (let i = 0; i < N_PARAMS; i++) assert.ok(Math.abs(m[i] - (HAND_POSES.relaxed[i] + HAND_POSES.fist[i]) / 2) < 1e-6);
  assert.equal(tightness({ grip: 0.6, relaxed: 0.4 }), 0.6);
});

test('easing: smooth, frame-rate independent, never overshooting', () => {
  const goal = HAND_POSES.fist;
  const a = Float32Array.from(HAND_POSES.relaxed), b = Float32Array.from(HAND_POSES.relaxed);
  for (let i = 0; i < 60; i++) easePose(a, goal, 7, 1 / 60);
  for (let i = 0; i < 20; i++) easePose(b, goal, 7, 1 / 20);
  for (let i = 0; i < N_PARAMS; i++) {
    assert.ok(Math.abs(a[i] - b[i]) < 1e-4, 'the same after a second at 60 or 20 fps');
    const lo = Math.min(HAND_POSES.relaxed[i], goal[i]) - 1e-6, hi = Math.max(HAND_POSES.relaxed[i], goal[i]) + 1e-6;
    assert.ok(a[i] >= lo && a[i] <= hi, 'between the two poses');
  }
  // most of the way there within half a second, but not at once
  const c = Float32Array.from(HAND_POSES.relaxed);
  easePose(c, goal, 7, 1 / 60);
  const d0 = Math.abs(goal[4] - HAND_POSES.relaxed[4]);
  assert.ok(Math.abs(goal[4] - c[4]) > d0 * 0.8, 'no snap in one frame');
  for (let i = 0; i < 29; i++) easePose(c, goal, 7, 1 / 60);
  assert.ok(Math.abs(goal[4] - c[4]) < d0 * 0.1);
});

test('a body\'s hands follow its context over time, with a little motion of their own', () => {
  const h = body();
  const H = h.hands;
  for (let i = 0; i < 90; i++) H.update(1 / 60, { mode: 'climb' });
  const S = H.sides[0];
  for (let i = 0; i < N_PARAMS; i++) assert.ok(Math.abs(S.cur[i] - HAND_POSES.grip[i]) < 0.02, 'in the grip after 1.5 s');
  const gripBend = bend(h, 'middle', 'r');
  for (let i = 0; i < 120; i++) H.update(1 / 60, { mode: 'ground', speed: 0 });
  assert.ok(bend(h, 'middle', 'r') < gripBend - 0.5, 'and let go again');
  // at rest the fingers drift a little, never far
  const seen = [];
  for (let i = 0; i < 300; i++) { H.update(1 / 30, { mode: 'ground', speed: 0 }); seen.push(bend(h, 'index', 'r')); }
  const span = Math.max(...seen) - Math.min(...seen);
  assert.ok(span > 0.01 && span < 0.3, `drift ${span.toFixed(3)} rad`);
  // a person's speed (none given): measured from the body's own movement, so a run opens the hands
  const root = h.char.root;
  for (let i = 0; i < 90; i++) { root.position.z += 6 / 60; root.updateMatrixWorld(true); h.update(); H.update(1 / 60, { mode: 'ground', speed: undefined }); }
  assert.ok(H.speed > 5 && (H.targets.r.open ?? 0) > 0.9, `running at ${H.speed.toFixed(1)} m/s: ${JSON.stringify(H.targets.r)}`);
  // the wrist jerked about: the fingers lag, bounded, and settle again
  for (let i = 0; i < 60; i++) { root.position.y = Math.sin(i * 0.9) * 0.08; root.updateMatrixWorld(true); h.update(); H.update(1 / 60, { mode: 'ground' }); }
  assert.ok(Math.abs(S.lag) <= HANDS.lagMax + 1e-9);
  root.position.set(400, 0, 0); root.updateMatrixWorld(true); h.update(); H.update(1 / 60, { mode: 'ground' });
  assert.ok(Number.isFinite(S.lag) && Math.abs(S.lag) <= HANDS.lagMax, 'a teleport doesn\'t fling the fingers');
});

test('the game\'s contexts: the traveller\'s state, a person\'s, a talking face', () => {
  const U = new THREE.Vector3(0, 1, 0);
  const p = { onGround: true, vel: new THREE.Vector3(3, -1, 4), frame: { up: U }, aim: { k: 0.5 }, handoffGrip: () => 0.25 };
  assert.deepEqual(playerHands(p), { mode: 'ground', ride: undefined, speed: 5, aim: 0.5, handoff: 0.25, sword: 0, shield: 0 });
  assert.equal(playerHands({ ...p, climbing: true }).mode, 'climb');
  assert.equal(playerHands({ ...p, ride: { kind: 'bird' } }).ride, 'bird');
  assert.equal(playerHands({ ...p, onGround: false }).mode, 'air');
  assert.equal(playerHands({ ...p, onGround: false, gliding: true }).mode, 'glide');
  assert.equal(npcHands({ time: 5, seat: 0.45, look: { prop: 'staff' } }).mode, 'seated');
  assert.equal(npcHands({ time: 5, look: { prop: 'staff' } }).prop, 'staff');
  assert.equal(npcHands({ time: 5, stumbleUntil: 6 }).startle, 1);
  assert.equal(npcHands({ time: 5, person: { speed: 0, pose: 2 }, crowd: { time: 1 } }).mode, 'rail');
  const h = {};
  const faces = { faces: new Map([[h, { tone: 'angry', talk: 1, hold: 1.3, open: 0.5 }]]) };
  assert.deepEqual(talkOf(h, faces), { tone: 'angry', k: 1, beat: 0.8 });
  assert.equal(talkOf({}, faces), null);
});

test('updateHands drives the traveller and the people near the camera only', () => {
  const calls = [];
  const fake = (name) => ({ update: (dt, ctx) => calls.push([name, ctx]) });
  const camera = { position: new THREE.Vector3() };
  const player = { humanoid: { hands: fake('player') }, onGround: true, vel: new THREE.Vector3(), object: { visible: true } };
  const near = { humanoid: { hands: fake('near') }, pos: new THREE.Vector3(5, 0, 0), object: { visible: true }, time: 0 };
  const far = { humanoid: { hands: fake('far') }, pos: new THREE.Vector3(80, 0, 0), object: { visible: true }, time: 0 };
  const hidden = { humanoid: { hands: fake('hidden') }, pos: new THREE.Vector3(1, 0, 0), object: { visible: false }, time: 0 };
  const handheld = { humanoid: { hands: fake('handheld') }, pos: new THREE.Vector3(20, 0, 0), object: { visible: true }, time: 0, lowDetail: true };
  updateHands(1 / 60, { player, npcs: [near, far, hidden, handheld, { pos: new THREE.Vector3() }], camera, faces: { faces: new Map() } });
  assert.deepEqual(calls.map((c) => c[0]), ['player', 'near']);
});

test('gliding, the hands hold still: open, palms down, the same turn on the arm every frame (they used to spin)', async () => {
  // (the IK that spreads the arms kept each hand's world turn, read back from the hand's last-frame
  // local turn on a freshly posed forearm: the difference fed back into itself, ~10° a frame)
  const { Player } = await import('../src/player.js');
  const { Physics } = await import('../src/physics.js');
  const { items, ITEMS } = await import('../src/items.js');
  for (const id of Object.keys(ITEMS)) if (id === 'backpack' || id === 'glider') items.grant(id); else items.revoke(id);
  const scene = new THREE.Scene();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4000, 1, 4000)); slab.position.y = -0.5; scene.add(slab);
  const p = new Player(new Physics(scene));
  p.humanoid = new Humanoid(human, p.char, 'm');
  p.attach(scene);
  p.update(1 / 60, {}, 0);
  p.pos.set(0, 300, 0); p.onGround = false; p.vel.set(0, 0, 0);
  const H = p.humanoid, q = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const onBody = (s) => p.object.getWorldQuaternion(qb).clone().invert().multiply(H.b[`hand_${s}`].getWorldQuaternion(q));
  const palm = (s) => H.handFrames[s].normal.clone().applyQuaternion(H.b[`hand_${s}`].getWorldQuaternion(q).multiply(H.rest.get(H.b[`hand_${s}`]).q.clone().invert()));
  for (let i = 0; i < 60; i++) p.update(1 / 60, { Space: true }, 0);
  assert.ok(p.gliding && p.wingK === 1, 'gliding, the wings open');
  const before = ['r', 'l'].map(onBody);
  for (let i = 0; i < 30; i++) p.update(1 / 60, { Space: true }, 0);
  ['r', 'l'].forEach((s, i) => {
    const turned = before[i].angleTo(onBody(s)) * 180 / Math.PI;
    assert.ok(turned < 1, `the ${s} hand held its turn: ${turned.toFixed(1)}° in half a second`);
    assert.ok(palm(s).y < -0.85, `the ${s} palm faces down: ${palm(s).y.toFixed(2)}`);
  });
  // banking into a turn the hands tip with the arms, but don't spin
  let most = 0, last = ['r', 'l'].map(onBody);
  for (let i = 0; i < 40; i++) {
    p.update(1 / 60, { Space: true, KeyA: true }, 0);
    const now = ['r', 'l'].map(onBody);
    most = Math.max(most, ...now.map((n, k) => n.angleTo(last[k]) * 180 / Math.PI));
    last = now;
  }
  assert.ok(most < 2, `no more than ${most.toFixed(2)}° a frame in a turn`);
});
