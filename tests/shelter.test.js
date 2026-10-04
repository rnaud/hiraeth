import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { buildRoom } from '../src/interiors.js';
import { Shelter, addIndoors, isIndoors, dryReach, ROOF_REACH } from '../src/shelter.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const RAIN = { kind: 'rain', rain: 1, storm: 0, fog: 0 };

// open ground; a porch roof 3.2 m up over x in [-5, 5]; a room built far off (as Edena's cabin is)
const scene = new THREE.Scene();
const ground = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400)); ground.position.y = -0.5; scene.add(ground);
const porch = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 6)); porch.position.set(0, 3.2, 40); scene.add(porch);
const room = buildRoom(scene, { pos: v(0, 1500, 0), w: 6, d: 10, h: 3.2 });
const physics = new Physics(scene);

/** Run the shelter at `cam` for `secs` (from a fresh start there, or carried on from `sh`). */
const settle = (cam, secs = 2, sh = new Shelter(physics)) => { for (let i = 0; i < secs * 60; i++) sh.update(1 / 60, cam, UP); return sh; };

test('out in the open the rain falls everywhere, and sounds as rain', () => {
  const w = settle(v(20, 1.8, 0)).apply(RAIN);
  assert.equal(w.rain, 1);
  assert.equal(w.dryNear, 0, 'drawn right up to the lens');
  assert.ok(w.rainOut > 0.99 && w.rainRoof < 0.01);
});

test('it never rains indoors: no rain or sand drawn in a room, only a drumming on the roof', () => {
  assert.ok(isIndoors(room.inside.clone().setY(room.inside.y + 1.5)), 'the room is an interior');
  assert.ok(!isIndoors(room.doorOut.clone().add(v(0, 1.5, 0))), 'its doorstep is not');
  const w = settle(room.inside.clone().setY(room.inside.y + 1.6)).apply({ ...RAIN, storm: 1 });
  assert.ok(w.rain < 0.01 && w.storm < 0.01, `no weather drawn indoors (${w.rain}, ${w.storm})`);
  assert.ok(w.rainOut < 0.01, 'no open hiss');
  assert.ok(w.rainRoof > 0.9, 'the rain heard muffled, on the roof');
  // the camera stepped out through the doorway and the player still in: still indoors
  const sh = new Shelter(physics);
  for (let i = 0; i < 120; i++) sh.update(1 / 60, room.doorOut.clone().add(v(0, 2, 2)), UP, [room.inside]);
  assert.ok(sh.apply(RAIN).rain < 0.01, 'the player inside counts too');
});

test('under a roof the rain keeps off what is under it with you, and still falls past its edge', () => {
  const sh = settle(v(0, 1.8, 40));
  const w = sh.apply(RAIN);
  assert.equal(w.rain, 1, 'the picture still rains, out past the porch');
  assert.ok(w.dryNear > 3 && w.dryNear < 12, `dry for ${w.dryNear.toFixed(1)} m round about`);
  assert.ok(w.rainOut < 0.6 && w.rainRoof > 0.4, 'and it sounds a little muffled');
  // walk out into the open: the rain comes back in about a second
  settle(v(0, 1.8, 60), 1.5, sh);
  assert.ok(sh.apply(RAIN).dryNear < 0.1, 'back out in the rain');
});

test('dryReach: nothing overhead, a porch, a high arch, the sky', () => {
  assert.equal(dryReach(Infinity), 0);
  assert.equal(dryReach(ROOF_REACH + 1), 0);
  assert.ok(dryReach(1.4) >= 3 && dryReach(1.4) < dryReach(10));
});

test('a level can add an interior of its own, and take it away', () => {
  const inBox = (p) => Math.abs(p.x - 300) < 5 && Math.abs(p.z) < 5 && p.y > 0 && p.y < 4;
  const remove = addIndoors(inBox);
  assert.ok(settle(v(300, 1.8, 0)).apply(RAIN).rain < 0.01);
  remove();
  assert.ok(!isIndoors(v(300, 1.8, 0)));
});
