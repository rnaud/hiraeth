import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuried, BURIED_CONTENT, OCULUS, canyonX} from '../src/levels/buried.js';
import {Physics} from '../src/physics.js';
import {CONTENT, ORDER} from '../src/levels/content.js';
import {LEVELS} from '../src/levels/index.js';

const scene = new THREE.Scene(), level = createBuried(scene), physics = new Physics(scene, level.ground);

test('the buried machine builds as a jetpack level and is registered', () => {
  assert.equal(level.id, 'buried');
  assert.equal(level.features.jetpack, true);
  assert.equal(level.features.climb, true);
  assert.ok(ORDER.includes('buried'));
  assert.equal(CONTENT.buried, BURIED_CONTENT);
  assert.ok(LEVELS.some((l) => l.id === 'buried' && l.create === createBuried));
  assert.equal(level.sky.script.day.length, 5);
  assert.equal(typeof level.atmo(0, 0, 0).name, 'string');
  level.update(0.016, 1, {});
});

test('spawn stands on solid sand', () => {
  const {x, y, z} = level.spawn;
  const ground = physics.groundAt(x, y + 5, z);
  assert.ok(Number.isFinite(ground));
  assert.ok(Math.abs(ground - y) < 0.05, `spawn ground ${ground} vs ${y}`);
  // nothing solid in the first steps toward the canyon
  assert.equal(physics.rayHit(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(0, 0, -1), 10), null);
});

test('the canyon floor is open from the ramp to the oculus doorway', () => {
  for (let z = -160; z >= OCULUS.z + OCULUS.r + 4; z -= 6) {
    const xs = [-1, 0, 1].map((k) => canyonX(z) + k * 6);
    for (const x of xs) {
      const g = physics.groundAt(x, -10, z, 40);
      assert.ok(Math.abs(g + 34) < 0.5, `floor at ${x.toFixed(1)},${z}: ${g}`);
    }
  }
  // into the drum through the arched door
  const hit = physics.rayHit(new THREE.Vector3(OCULUS.x, -31, OCULUS.z + 60), new THREE.Vector3(0, 0, -1), 80);
  assert.ok(!hit || hit.point.z < OCULUS.z - OCULUS.r + 8, `doorway blocked at ${hit?.point.z}`);
});

test('five relics rest on reachable structures, open to the sky', () => {
  const {spots, names} = BURIED_CONTENT.relics;
  assert.equal(spots.length, 5);
  assert.equal(names.length, 5);
  for (const s of spots) {
    const [x, z] = s;
    const top = physics.groundAt(x, 1e4, z, 2e4);
    assert.ok(Number.isFinite(top), `relic surface at ${x},${z}`);
    assert.ok(top - level.ground.heightAt(x, z) > 1.5, `relic at ${x},${z} sits on a structure, not the sand`);
    assert.ok(top < 120, `relic at ${x},${z} within jetpack reach: ${top}`);
    // standing room: the surface is roughly level and nothing is directly above it
    const n = physics.groundNormal(x, top + 1, z);
    assert.ok(n.y > 0.7, `relic surface at ${x},${z} is walkable (n.y ${n.y.toFixed(2)})`);
    assert.equal(physics.rayHit(new THREE.Vector3(x, top + 0.3, z), new THREE.Vector3(0, 1, 0), 500), null);
  }
});

test('the story goal is the balcony inside the oculus', () => {
  const {goal, radius, verticalRadius} = BURIED_CONTENT.story;
  assert.equal(goal[1], 'top');
  const y = physics.groundAt(goal[0], 1e4, goal[2], 2e4);
  assert.ok(Math.abs(y - OCULUS.balcony) < 0.01, `goal surface ${y}`);
  assert.ok(Math.hypot(goal[0] - OCULUS.x, goal[2] - OCULUS.z) < OCULUS.r, 'goal is inside the drum');
  assert.ok(radius <= 6 && verticalRadius <= 6, 'you have to climb or fly up to it');
  // the drum is open to the sky above the floor centre
  assert.equal(physics.rayHit(new THREE.Vector3(OCULUS.x, -30, OCULUS.z), new THREE.Vector3(0, 1, 0), 2000), null);
});

test('static collision stays within budget; the hanging city and ring are not collidable', () => {
  assert.ok(physics.triangles < 60000, `static collision budget: ${physics.triangles}`);
  // overhead city: a ray straight up from the dunes meets nothing
  assert.equal(physics.rayHit(new THREE.Vector3(-70, 20, -170), new THREE.Vector3(0, 1, 0), 2000), null);
});
