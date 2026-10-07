import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpheres, SPHERES_CONTENT, LAYOUT } from '../src/levels/spheres.js';
import { Physics } from '../src/physics.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { LEVELS } from '../src/levels/index.js';

const scene = new THREE.Scene(), level = createSpheres(scene), physics = new Physics(scene, level.ground);

test('the garden builds and is registered', () => {
  assert.equal(level.id, 'spheres');
  assert.ok(ORDER.includes('spheres'));
  assert.ok(LEVELS.some((l) => l.id === 'spheres'));
  assert.equal(CONTENT.spheres, SPHERES_CONTENT);
  for (const k of ['ground', 'spawn', 'features', 'defaults', 'sky', 'life', 'atmo', 'update']) assert.ok(level[k] !== undefined, k);
  assert.equal(level.features.climb, true);
  assert.equal(SPHERES_CONTENT.npcs.length >= 2 && SPHERES_CONTENT.npcs.length <= 4, true);
});

test('spawn stands on solid, dry ground with open meadow around it', () => {
  const { x, y, z } = level.spawn;
  const g = physics.groundAt(x, y + 3, z);
  assert.ok(Number.isFinite(g) && Math.abs(g - y) < 0.5, `spawn ground ${g} vs ${y}`);
  assert.equal(level.unsafe(level.spawn), false);
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, 0, 1]]) {
    assert.equal(physics.rayHit(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(...d), 5), null, `spawn boxed in ${d}`);
  }
});

test('five relics sit on reachable surfaces', () => {
  const { spots, names } = SPHERES_CONTENT.relics;
  assert.equal(spots.length, 5);
  assert.equal(names.length, 5);
  for (const [i, s] of spots.entries()) {
    const [x, z] = s;
    const top = physics.groundAt(x, 1e4, z, 2e4);
    const terrain = level.ground.heightAt(x, z);
    assert.ok(Number.isFinite(top), `relic ${names[i]} has a surface`);
    assert.ok(top - terrain > 6, `relic ${names[i]} is up on something (${top} over ${terrain})`);
    // flat enough to stand on: the surface a metre around is within a step
    for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) {
      assert.ok(Math.abs(physics.groundAt(x + dx, top + 2, z + dz, 4) - top) < 0.6, `relic ${names[i]} footing`);
    }
  }
});

test('the canopy relic can be reached by stepping down from the hill terrace', () => {
  const H = LAYOUT.hill, T = LAYOUT.hillTree;
  const edgeX = H.x + H.r[1] * 0.97 - 1.5;                      // standing on the middle terrace, east edge
  const terrace = physics.groundAt(edgeX, 1e4, H.z, 2e4);
  const canopy = physics.groundAt(H.x + H.r[1] + 2.5, terrace + 1, H.z, 10);
  assert.ok(terrace - canopy > 0.3 && terrace - canopy < 2.5, `terrace ${terrace} -> canopy ${canopy}`);
  const top = physics.groundAt(T.x + 3, 1e4, T.z - 4, 2e4);
  assert.ok(Math.abs(top - canopy) < 4, 'the canopy is one walkable surface');
});

test('stairs lead up the white hill and the pyramid without gaps', () => {
  const H = LAYOUT.hill;
  let prev = physics.groundAt(H.x, 2, H.z + 86, 10);
  for (let z = H.z + 86; z >= H.z + 7; z -= 0.25) {
    const g = physics.groundAt(H.x, prev + 1.2, z, 3);
    assert.ok(Number.isFinite(g) && g - prev < 0.6 && g - prev > -0.6, `stair step at z=${z}: ${prev} -> ${g}`);
    prev = g;
  }
  assert.ok(prev > level.ground.heightAt(H.x, H.z) + 48, `summit reached: ${prev}`);
});

test('the path through the sphere-arch and down the avenue is open', () => {
  for (let z = -200; z >= LAYOUT.plaza.z + 20; z -= 4) {
    const y = physics.groundAt(0, 6, z);
    assert.ok(y < level.ground.heightAt(0, z) + 1.2, `path is not blocked at ${z}: ${y}`);
    const hit = physics.rayHit(new THREE.Vector3(-2.5, y + 1, z), new THREE.Vector3(1, 0, 0), 5);
    assert.equal(hit, null, `avenue blocked at ${z}`);
  }
});

test('the story goal is the round plaza at the end of the avenue', () => {
  const [gx, gy, gz] = SPHERES_CONTENT.story.goal;
  assert.equal(gy, 'ground');
  assert.ok(gz < LAYOUT.avenue.z1);
  const y = physics.groundAt(gx + 6, 30, gz);
  assert.ok(y > level.ground.heightAt(gx + 6, gz) + 0.3, 'plaza paving present');
  assert.ok(SPHERES_CONTENT.story.title && SPHERES_CONTENT.story.intro && SPHERES_CONTENT.story.outro);
});

test('deep lake water is unsafe, the shore is not', () => {
  const L = LAYOUT.lake;
  assert.equal(level.unsafe(new THREE.Vector3(L.x, level.ground.heightAt(L.x, L.z), L.z)), true);
  assert.equal(level.unsafe(new THREE.Vector3(L.x, 0, L.z + L.rz * 1.3)), false);
});

test('static collision stays within budget', () => {
  console.log('collision triangles', physics.triangles);
  // (the spheres, the umbrella trees and, since the contact audit's second pass, the hill's boulders,
  // the pillars, the monoliths, the android wood's ruins and statue and the Footprint's heel collide as
  // they are drawn, docs/systems/movement.md "Contact": 157 k → ~179 k, the BVH 49 → 61 ms to bake; the hill's
  // sculpted pillows, the robot's 28 parts and the arcades, solid as drawn, ~200 k: docs/systems/references.md)
  assert.ok(physics.triangles < 215000, `static collision budget: ${physics.triangles}`);
});
