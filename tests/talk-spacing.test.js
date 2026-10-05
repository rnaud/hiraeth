import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { talkSpace, stepBack, gapOf } from '../src/story/spacing.js';
import { Dialogue, CUT_GAP } from '../src/story/dialogue.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** A level of boxes [x, y, z, w, h, d] on a floor (the floor's top at y = 0). */
const level = (...boxes) => {
  const scene = new THREE.Scene();
  for (const [x, y, z, w, h, d] of [[0, -0.5, 0, 200, 1, 200], ...boxes]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); }
  return new Physics(scene);
};

test('talking space: about 1.45 m; a child a little less, someone seated a little more', () => {
  const adult = talkSpace({ object: { scale: { y: 1 } } });
  assert.ok(adult.want > 1.3 && adult.want < 1.6 && adult.min > 1.1 && adult.min < adult.want);
  const child = talkSpace({ object: { scale: { y: 0.7 } } });
  assert.ok(child.want < adult.want && child.want > 1.1, `${child.want}`);
  const seated = talkSpace({ object: { scale: { y: 1 } }, seat: 0.5 });
  assert.ok(seated.want > adult.want);
});

test('too close: the traveller steps straight back to the gap; far enough: nobody moves', () => {
  const physics = level();
  const b = V(0, 0, 0);
  assert.equal(stepBack({ a: V(1.5, 0, 0), b, physics }), null, 'already at a good distance');
  const to = stepBack({ a: V(0.6, 0, 0), b, want: 1.45, min: 1.2, physics });
  assert.ok(to, 'a place to stand');
  assert.ok(Math.abs(gapOf(to, b) - 1.45) < 1e-6);
  assert.ok(to.x > 1.4 && Math.abs(to.z) < 1e-6, `straight back: ${to.toArray()}`);
  assert.ok(Math.abs(to.y) < 0.05, 'on the floor');
  // the same spot: backs away from the way he faces
  const same = stepBack({ a: V(0, 0, 0), b, physics, facing: V(0, 0, 1) });
  assert.ok(same.z < -1.3, `${same.toArray()}`);
});

test('a wall at the traveller’s back: he steps round the other instead, never into it', () => {
  const physics = level([1.3, 1.5, 0, 0.3, 3, 8]);   // a wall 1.3 m from them, behind the traveller
  const a = V(0.6, 0, 0), b = V(0, 0, 0);
  const to = stepBack({ a, b, want: 1.45, min: 1.2, physics });
  assert.ok(to, 'somewhere to go');
  assert.ok(to.x < 1.0, `not through the wall: ${to.toArray()}`);
  assert.ok(Math.abs(gapOf(to, b) - 1.45) < 1e-6);
  // boxed in on every side: nowhere
  const box = level([1.0, 1.5, 0, 0.3, 3, 8], [-1.0, 1.5, 0, 0.3, 3, 8], [0, 1.5, 1.0, 8, 3, 0.3], [0, 1.5, -1.0, 8, 3, 0.3]);
  assert.equal(stepBack({ a: V(0.4, 0, 0), b: V(-0.2, 0, 0), physics: box }), null);
});

test('never off a ledge or up onto a block', () => {
  // they stand on a platform 2 m up whose edge is 1 m behind the traveller
  const physics = level([-2, 1, 0, 6, 2, 10]);   // the platform: x in [-5, 1], top at y = 2
  const a = V(0.5, 2, 0), b = V(-0.1, 2, 0);
  const to = stepBack({ a, b, want: 1.45, min: 1.2, physics });
  assert.ok(to, 'somewhere on the platform');
  assert.ok(to.x < 0.95 && Math.abs(to.y - 2) < 0.05, `stays on top: ${to.toArray()}`);
  // a knee-high block where he would step: not stood on
  const block = level([1.4, 0.4, 0, 0.8, 0.8, 0.8]);
  const t2 = stepBack({ a: V(0.6, 0, 0), b: V(0, 0, 0), physics: block });
  assert.ok(t2 && t2.y < 0.05 && Math.abs(t2.z) > 0.3, `round the block: ${t2?.toArray()}`);
});

test('nobody is stepped onto: a bystander behind the traveller', () => {
  const physics = level();
  const to = stepBack({ a: V(0.6, 0, 0), b: V(0, 0, 0), physics, others: [V(1.45, 0, 0)] });
  assert.ok(to && to.distanceTo(V(1.45, 0, 0)) > 0.7, `${to?.toArray()}`);
});

const panel = () => {
  const m = new Map(), game = new GameState({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
  return new Dialogue({ game, quests: new Quests({ game }) });
};
const TALKER = { id: 'tester', name: 'Tester', kind: 'f', talk: { nodes: { a: { say: ['~neutral~ One.', '~neutral~ Two.', '~neutral~ Three.'] } } } };

test('the conversation camera cuts to the two-shot on the first frame, and cuts back after', () => {
  const d = panel(), cam = new THREE.PerspectiveCamera(50, 1.6);
  const player = { pos: V(0, 0, 0) }, npc = { talkTo: null, pos: V(1.5, 0, 0) };
  cam.position.set(0, 3, 8); cam.lookAt(0, 1.5, 0);
  assert.ok(d.start(TALKER, npc));
  assert.equal(d.blend, 1, 'no ease in');
  d.update(1 / 60);
  d.frameCamera(cam, player, npc.pos);
  const first = cam.position.clone(), q = cam.quaternion.clone();
  const mid = V(0.75, 1.5, 0);
  assert.ok(first.distanceTo(mid) > 2 && first.distanceTo(mid) < 8, `at the two-shot already: ${first.toArray()}`);
  const f = cam.getWorldDirection(V());
  assert.ok(f.clone().setY(0).normalize().dot(mid.clone().sub(first).setY(0).normalize()) > 0.97, 'looking between them');
  // the frames after: it stays (no swing toward it, from where the play camera was)
  for (let i = 0; i < 30; i++) { cam.position.set(0, 3, 8); cam.lookAt(0, 1.5, 0); d.update(1 / 60); d.frameCamera(cam, player, npc.pos); }
  assert.ok(cam.position.distanceTo(first) < 0.05 && cam.quaternion.angleTo(q) < 0.02, 'held');
  d.close();
  assert.equal(d.blend, 0, 'no ease out: the follow camera has it again at once');
  cam.position.set(0, 3, 8);
  d.update(1 / 60); d.frameCamera(cam, player, npc.pos);
  assert.ok(cam.position.distanceTo(V(0, 3, 8)) < 1e-6, 'left where the follow camera put it');
});

test('a new angle mid-talk is a cut, never a swing; small drifts are eased', () => {
  const d = panel(), cam = new THREE.PerspectiveCamera(50, 1.6);
  const player = { pos: V(0, 0, 0) }, npc = { talkTo: null, pos: V(1.5, 0, 0) };
  cam.position.set(0, 3, 8);
  d.start(TALKER, npc);
  d.update(1 / 60); d.frameCamera(cam, player, npc.pos);
  const before = cam.position.clone(), cuts0 = d.cuts;
  // a bystander walks into the line of sight, right between the camera and the pair
  const crowd = [before.clone().lerp(V(0.75, 0, 0), 0.5).setY(0)];
  let maxStep = 0, last = cam.position.clone();
  for (let i = 0; i < 60 * (CUT_GAP + 1); i++) {
    d.update(1 / 60); d.frameCamera(cam, player, npc.pos, undefined, crowd);
    const step = cam.position.distanceTo(last);
    if (step < 0.5) maxStep = Math.max(maxStep, step);
    last.copy(cam.position);
  }
  assert.ok(d.cuts > cuts0, 'the shot changed');
  assert.ok(cam.position.distanceTo(before) > 0.8, 'to another angle');
  assert.ok(maxStep < 0.05, `no camera move between the cuts (largest frame step ${maxStep.toFixed(3)} m)`);
});

test('the translator is quick: the whole line in English well within half a second of its last word', async () => {
  const { LAG, FADE } = await import('../src/story/dialogue.js');
  const { REVEAL_CPS } = await import('../src/story/voice.js');
  // (even the slowest voice, 0.65 of the even pace)
  assert.ok((LAG + FADE) / (REVEAL_CPS * 0.65) < 0.5, `${((LAG + FADE) / (REVEAL_CPS * 0.65)).toFixed(2)} s`);
  assert.ok(LAG >= 3, 'still word by word: the word at the caret is in the script');
  const d = panel(), line = 'Go down to the well, child, and wait for me there.';
  d.start({ id: 'tester', name: 'Tester', kind: 'f', lang: 'desert', talk: { nodes: { a: { say: [`~neutral~ ${line}`] } } } });
  let t = 0;
  while (d.revealed < line.length && t < 10) { d.update(1 / 60); t += 1 / 60; }
  const typed = t;
  while (d.translated < line.length + FADE && t < 10) { d.update(1 / 60); t += 1 / 60; }
  assert.ok(t - typed < 0.5, `English ${(t - typed).toFixed(2)} s after the last word`);
});
