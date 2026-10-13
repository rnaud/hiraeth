// Ladders are climbed without spending stamina; a wall still costs it (issue #252).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { porch } from '../src/levels/overnight-train-kit.js';
import { pillar } from '../src/levels/moon-foundry-kit.js';

const climb = (ladders) => {
  const scene = new THREE.Scene(), wall = new THREE.Mesh(new THREE.BoxGeometry(20, 40, 1));
  wall.position.set(0, 20, 8); scene.add(wall);
  const physics = new Physics(scene); physics.ladders = ladders;
  const p = new Player(physics); p.pos.set(0, 2, 7.1); p.animator = {};
  p.startClimb(new THREE.Vector3(0, 0, -1));
  for (let i = 0; i < 120; i++) p.updateClimb(1 / 60, 1, 0, {});
  return p;
};

test('a wall spends stamina; a ladder on it does not', () => {
  const wall = climb(null);
  assert.ok(wall.stamina < 0.95, `the wall tired him (${wall.stamina})`);
  const ladder = climb([{ x: 0, z: 7.6, y0: 0, y1: 30 }]);
  assert.equal(ladder.stamina, 1);
  assert.ok(ladder.climbing && ladder.onLadder);
});

test('winded at the foot of a ladder, he still takes hold and keeps climbing', () => {
  const scene = new THREE.Scene(), physics = new Physics(scene);
  physics.ladders = [{ x: 0, z: 7.6, y0: 0, y1: 30 }];
  assert.ok(physics.onLadder(new THREE.Vector3(0, 2, 7.1)));
  assert.ok(!physics.onLadder(new THREE.Vector3(3, 2, 7.1)), 'beside it, a wall');
  assert.ok(!physics.onLadder(new THREE.Vector3(0, 32, 7.1)), 'over its top');
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 40, 1)); wall.position.set(0, 20, 8); scene.add(wall);
  const p = new Player(new Physics(scene)); p.physics.ladders = physics.ladders; p.pos.set(0, 2, 7.1); p.animator = {};
  p.stamina = 0; p.winded = true;
  p.startClimb(new THREE.Vector3(0, 0, -1));
  for (let i = 0; i < 30; i++) p.updateClimb(1 / 60, 1, 0, {});
  assert.ok(p.climbing, 'still on the ladder');
});

test('the train porches and the foundry pillars say where their ladders are', () => {
  const P = porch(10, 1, { ladder: 1 });
  assert.equal(P.ladder.length, 1);
  assert.ok(P.ladder[0].y1 > P.ladder[0].y0);
  const F = pillar({ h: 40, r: 3, detail: 0.7, dressing: 0 });
  assert.equal(F.ladders.length, 1);
  assert.ok(Math.hypot(F.ladders[0].x, F.ladders[0].z) > 3);
});

test('the Overnight Train: up a porch ladder to the roof walk, its rungs held as a ladder, the stamina full all the way', async () => {
  await import('./register-gadgets.js');
  const { LEVELS } = await import('../src/levels/index.js');
  const quiet = (f) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return f(); } finally { console.warn = w; console.info = i; } };
  const scene = new THREE.Scene(), level = quiet(() => LEVELS.find((l) => l.id === 'overnighttrain').create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  physics.ladders = level.ladders;   // (as main.js)
  assert.ok(level.ladders.length >= 8, `${level.ladders.length} porch ladders`);
  const l = level.ladders[0];
  // on the porch, in front of the ladder, walking into it
  const p = new Player(physics, { spawn: new THREE.Vector3(l.x + 0.75, l.y0, l.z), climb: true });
  p.pos.set(l.x + 0.75, l.y0, l.z);
  let held = 0, maxY = 0;
  for (let k = 0; k < 360; k++) { p.update(1 / 60, { KeyW: true }, Math.atan2(1, 0)); if (p.climbing && p.onLadder) held++; maxY = Math.max(maxY, p.pos.y); }
  assert.ok(held > 60, `held on the ladder (${held} frames)`);
  assert.ok(maxY > l.y1 - 0.2, `up to the roof walk (${maxY.toFixed(2)} of ${l.y1.toFixed(2)})`);
  assert.equal(p.stamina, 1, 'not a breath of stamina spent');
});
