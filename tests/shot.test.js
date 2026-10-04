import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { pickTwoShot, pickLookShot, sightOf, pullIn } from '../src/story/shot.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** A level of boxes [x, y, z, w, h, d] on a floor. */
const level = (...boxes) => {
  const scene = new THREE.Scene();
  for (const [x, y, z, w, h, d] of [[0, -0.5, 0, 200, 1, 200], ...boxes]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); }
  return new Physics(scene);
};
const clear = (physics, from, to, margin = 0.15) => physics.rayDistance(from, to.clone().sub(from).normalize(), from.distanceTo(to)) >= from.distanceTo(to) - margin;
const faces = (a, b) => [a.clone().addScaledVector(UP, 1.55), b.clone().addScaledVector(UP, 1.55)];

test('the two-shot in the open: off to the side, both faces in view', () => {
  const a = V(0, 0, 0), b = V(1.6, 0, 0);
  const s = pickTwoShot({ a, b, from: V(0, 3, 8) });
  assert.equal(s.kind, 'two');
  assert.ok(s.eye.z > 2, `on the side the camera was on: ${s.eye.toArray()}`);
  const mid = V(0.8, 1.45, 0);
  assert.ok(s.eye.distanceTo(mid) > 2.5 && s.eye.distanceTo(mid) < 7);
});

test('a wall on the camera’s side: the two-shot goes round to the other side, nothing in the way', () => {
  const physics = level([0.8, 2, 1.6, 12, 4, 0.3]);   // a wall 1.6 m in front of them, on the +z side
  const sight = sightOf(physics);
  const a = V(0, 0, 0), b = V(1.6, 0, 0), [fa, fb] = faces(a, b);
  const s = pickTwoShot({ a, b, from: V(0, 3, 8), sight });
  assert.equal(s.blocked, 0);
  assert.ok(s.eye.z < 1.4, `not behind the wall: ${s.eye.toArray()}`);
  assert.ok(clear(physics, s.eye, fa) && clear(physics, s.eye, fb), 'both faces seen');
});

test('a narrow street: walls on both sides; the shot moves in (or over a shoulder) and still sees both faces', () => {
  // a 2.6 m wide street running along x, and a wall across it 1.5 m behind the traveller
  const physics = level([0, 3, 1.3, 40, 6, 0.3], [0, 3, -1.3, 40, 6, 0.3], [-1.5, 3, 0, 0.3, 6, 3]);
  const sight = sightOf(physics);
  const a = V(0, 0, 0), b = V(1.4, 0, 0), [fa, fb] = faces(a, b);
  const s = pickTwoShot({ a, b, from: V(0, 3, 8), sight });
  assert.ok(Math.abs(s.eye.z) < 1.15 && s.eye.x > -1.35, `inside the street: ${s.eye.toArray()}`);
  assert.ok(clear(physics, s.eye, fa) && clear(physics, s.eye, fb), `both faces seen from ${s.eye.toArray()} (${s.kind})`);
  assert.ok(sight.room(s.eye, 0.2), 'not pressed into a wall');
});

test('a bystander standing in the shot: it is taken from where they are not', () => {
  const a = V(0, 0, 0), b = V(1.6, 0, 0);
  const open = pickTwoShot({ a, b, from: V(0, 3, 8) });
  const stander = open.eye.clone().lerp(V(0.8, 0, 0), 0.5).setY(0);
  const s = pickTwoShot({ a, b, from: V(0, 3, 8), people: [stander] });
  const line = new THREE.Line3(s.eye, V(0.8, 1.45, 0)), q = line.closestPointToPoint(stander.clone().setY(1.2), true, V());
  assert.ok(Math.hypot(q.x - stander.x, q.z - stander.z) > 0.5, 'the line of sight passes clear of them');
});

test('the two-shot is not taken through the traveller’s back', () => {
  // the other person straight ahead of where the camera already is: the classic eye would put the traveller in front
  const a = V(0, 0, 0), b = V(0, 0, -0.8);
  const s = pickTwoShot({ a, b, from: V(0, 2, 4) });
  const fb = b.clone().addScaledVector(UP, 1.55);
  const line = new THREE.Line3(s.eye, fb), q = line.closestPointToPoint(V(0, 1.2, 0), true, V());
  assert.ok(Math.hypot(q.x, q.z) > 0.35 || q.y > 1.9, `their face is not behind the traveller: ${s.eye.toArray()}`);
});

test('looking at a thing: behind the traveller’s shoulder, the thing in view past them', () => {
  const physics = level([0, 1, -3, 1, 2, 0.4]);   // a stele 3 m ahead
  const sight = sightOf(physics);
  const a = V(0, 0, 0), target = V(0, 1.4, -2.8);
  const s = pickLookShot({ a, target, sight, from: V(2, 3, 6) });
  const head = V(0, 1.6, 0);
  assert.ok(s.eye.z > head.z + 0.5, `behind them: ${s.eye.toArray()}`);
  assert.ok(Math.abs(s.eye.x) > 0.3, 'off to a shoulder');
  const dir = s.look.clone().sub(s.eye).normalize();
  assert.ok(dir.dot(target.clone().sub(s.eye).normalize()) > 0.97, 'looking at the thing');
  const line = new THREE.Line3(s.eye, target), q = line.closestPointToPoint(V(0, 1.2, 0), true, V());
  assert.ok(Math.hypot(q.x, q.z) > 0.3, 'the traveller does not hide it');
});

test('looking at a thing with a wall at the traveller’s back: the camera stays in front of the wall', () => {
  const physics = level([0, 2, 1.0, 10, 4, 0.3], [0, 1, -3, 1, 2, 0.4]);
  const sight = sightOf(physics);
  const a = V(0, 0, 0), target = V(0, 1.4, -2.8);
  const s = pickLookShot({ a, target, sight, from: V(0, 3, 6) });
  assert.ok(s.eye.z < 0.85, `this side of the wall: ${s.eye.toArray()}`);
  assert.ok(clear(physics, s.eye, V(0, 1.6, 0)), 'sees the traveller');
});

test('a thing high above: looked up at, the traveller still at the bottom of the frame', () => {
  const a = V(0, 0, 0), target = V(0, 14, -6);
  const s = pickLookShot({ a, target, fov: 50 });
  const dir = s.look.clone().sub(s.eye).normalize();
  const toT = target.clone().sub(s.eye).normalize(), toH = V(0, 1.6, 0).sub(s.eye).normalize();
  const half = THREE.MathUtils.degToRad(25);
  assert.ok(Math.acos(dir.dot(toT)) < half, 'the thing is in view');
  assert.ok(Math.acos(dir.dot(toH)) < half * 1.01 || Math.acos(dir.dot(toT)) > 0.8 * half, 'the traveller too, or the thing at the very top');
  assert.ok(dir.y > 0.3, 'looking up');
});

test('a blocked line pulls the camera in, but never into someone’s face', () => {
  const sight = sightOf(level([0, 1.5, -3, 4, 3, 0.3]));   // a wall 3 m out
  const far = pullIn(V(0, 1.5, -5), V(0, 1.5, 0.5), sight);
  assert.ok(far.z > -2.9 && far.z < -1, `in front of the far wall: ${far.z}`);
  const near = pullIn(V(0, 1.5, -5), V(0, 1.5, 0), sightOf(level([0, 1.5, -0.5, 4, 3, 0.3])));   // a wall half a metre from the anchor
  assert.equal(near.z, -5, 'a wall right at the anchor: left where it was');
});
