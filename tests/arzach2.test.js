import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createArzach2, ARZACH2_CONTENT } from '../src/levels/arzach2.js';
import { Physics } from '../src/physics.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { LEVELS } from '../src/levels/index.js';

const scene = new THREE.Scene();
const level = createArzach2(scene);
const physics = new Physics(scene, level.ground);

test('arzach2 builds and is registered', () => {
  assert.equal(level.id, 'arzach2');
  assert.ok(ORDER.includes('arzach2'));
  assert.ok(LEVELS.some((l) => l.id === 'arzach2'));
  assert.equal(CONTENT.arzach2, ARZACH2_CONTENT);
  assert.equal(level.mountName, 'bird');
  for (const k of ['spawn', 'ground', 'defaults', 'life', 'sky', 'atmo', 'update']) assert.ok(level[k], `missing ${k}`);
  level.update(0.016, 1);
});

test('spawn stands on the solid start plateau, above the cloud sea', () => {
  const { x, y, z } = level.spawn;
  const g = physics.groundAt(x, y + 2, z, 10);
  assert.ok(Math.abs(g - y) < 0.3, `spawn ground ${g} vs ${y}`);
  assert.ok(y > 30, 'spawn is on the plateau, not the chasm floor');
  assert.ok(!level.unsafe(level.spawn));
});

test('five relics sit on reachable surfaces', () => {
  const { spots, names } = ARZACH2_CONTENT.relics;
  assert.equal(spots.length, 5);
  assert.equal(names.length, 5);
  for (const { at: [x, y, z] } of spots) {
    const g = physics.groundAt(x, y + 3, z, 6);
    assert.ok(Number.isFinite(g) && y - g > -2 && y - g < 3, `relic ${x},${y},${z} has a surface near it: ${g}`);
    assert.ok(!level.unsafe(new THREE.Vector3(x, g, z)), 'relic not in the cloud');
  }
});

test('npcs on plateaus have ground under their whole route', () => {
  for (const n of ARZACH2_CONTENT.npcs) {
    const r = n.radius ?? 14;
    for (let a = 0; a < 6.28; a += 0.5) {
      const x = n.at[0] + Math.cos(a) * r, z = n.at[1] + Math.sin(a) * r;
      const g = physics.groundAt(x, (n.y ?? 1e4) + 2, z);
      assert.ok(!level.unsafe(new THREE.Vector3(x, g, z)), `npc route falls into the cloud at ${x},${z}`);
    }
  }
});

test('story goal: the lone tower on the peach plain', () => {
  const { goal, radius } = ARZACH2_CONTENT.story;
  assert.equal(goal[1], 'ground');
  assert.ok(radius > 0);
  const h = level.ground.heightAt(goal[0], goal[2]);
  assert.ok(h > 20, `tower stands on the plain, not in the chasm: ${h}`);
  assert.ok(physics.groundAt(goal[0], 1e4, goal[2], 2e4) > h + 100, 'the tower rises above the plain');
});

test('aqueducts carry you across the chasm', () => {
  // walk the aqueduct from the start plateau to the needle plateau
  for (let t = 0; t <= 1; t += 0.05) {
    const x = 52 + (150 - 52) * t, z = -58 + (-178 + 58) * t;
    const g = physics.groundAt(x, 45, z, 10);
    assert.ok(g > 38 && g < 43, `aqueduct deck at ${x.toFixed(0)},${z.toFixed(0)}: ${g}`);
  }
});

test('collision budget holds and clouds do not collide', () => {
  // (the rock collides as drawn since the contact audit, docs/systems/movement.md "Contact": ~390 k; Incal has ~920 k)
  assert.ok(physics.triangles < 420000, `static collision budget: ${physics.triangles}`);
  // straight down through open cloud reaches nothing but the chasm floor
  const g = physics.groundAt(-300, 10, -620, 400);
  assert.ok(level.unsafe(new THREE.Vector3(-300, g, -620)), `cloud sea is not walkable: ${g}`);
});

test('the long aqueduct reaches the peach plain', () => {
  for (let z = -330; z >= -900; z -= 10) {
    const g = physics.groundAt(215, 45, z, 10);
    assert.ok(g > 37 && g < 43, `aqueduct deck at z ${z}: ${g}`);
  }
});
