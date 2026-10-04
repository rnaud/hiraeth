import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuried, BURIED_CONTENT, OCULUS, canyonX, WHEEL} from '../src/levels/buried.js';
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
  // (a little off-centre: the oculus lamp stands in the middle of the drum)
  const hit = physics.rayHit(new THREE.Vector3(OCULUS.x - 5, -31, OCULUS.z + 60), new THREE.Vector3(0, 0, -1), 80);
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

test('the story is a quest (manual page); the balcony inside the oculus is still reachable and open to the sky', () => {
  const {goal, manual} = BURIED_CONTENT.story;
  assert.equal(manual, true, 'the page closes when the wheel has turned (src/story/buried.js)');
  assert.ok(Math.hypot(goal[0] - WHEEL.x, goal[2] - WHEEL.z) < 1, 'the page frames the great wheel');
  const y = physics.groundAt(OCULUS.x, 1e4, OCULUS.z - 31, 2e4);
  assert.ok(Math.abs(y - OCULUS.balcony) < 0.01, `balcony surface ${y}`);
  // the drum is open to the sky above the lamp in its centre
  assert.equal(physics.rayHit(new THREE.Vector3(OCULUS.x, -28, OCULUS.z), new THREE.Vector3(0, 1, 0), 2000), null);
});

test('the great wheel breaks the dunes east of the canyon: a solid rim you can stand on, clear of the canyon', () => {
  const {wheel} = level.buried;
  assert.ok(wheel.top - wheel.ground > 25, `the arc rises ${(wheel.top - wheel.ground).toFixed(1)} m out of the sand`);
  const top = physics.groundAt(wheel.centre.x, 1e4, wheel.centre.z, 2e4);
  assert.ok(Math.abs(top - (wheel.centre.y + wheel.R + wheel.tooth * 0.5)) < 0.6, `the rim's top is solid (${top})`);
  // the canyon floor beside it stays open
  const z = wheel.centre.z, g = physics.groundAt(canyonX(z), 0, z, 60);
  assert.ok(Math.abs(g + 34) < 0.5, `canyon floor beside the wheel ${g}`);
});

test('static collision stays within budget; the hanging city and ring are not collidable', () => {
  assert.ok(physics.triangles < 60000, `static collision budget: ${physics.triangles}`);
  // overhead city: a ray straight up from the dunes meets nothing
  assert.equal(physics.rayHit(new THREE.Vector3(-70, 20, -170), new THREE.Vector3(0, 1, 0), 2000), null);
});

test('the sand round the great wheel can slide away: the heights, the collision and the normals follow, and it comes back', () => {
  const W = level.buried.wheel, T = level.ground;
  assert.ok(W.sand.length > 20, 'a patch of the dunes round the wheel');
  const at = [W.centre.x + W.face.x * 4, W.centre.z + W.face.z * 4];
  const h0 = T.heightAt(...at);
  W.clear(1);
  const h1 = T.heightAt(...at);
  assert.ok(h0 - h1 > 8 && h0 - h1 < 11, `a hollow along its face (${(h0 - h1).toFixed(2)} m)`);
  assert.ok(Math.abs(physics.groundAt(at[0], h0 + 20, at[1], 60) - h1) < 1e-6, 'the collision follows');
  // the patched normals are the ones three.js computes for the whole mesh
  const geo = T.mesh.geometry, mine = geo.attributes.normal.array.slice();
  geo.computeVertexNormals();
  const ref = geo.attributes.normal.array;
  let worst = 0;
  for (const v of W.sand) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(mine[v.i * 3 + k] - ref[v.i * 3 + k]));
  assert.ok(worst < 1e-5, `normals match (${worst})`);
  // a hollow you can walk out of: no slope in it steeper than about 40 degrees
  let steep = 1;
  for (const v of W.sand) steep = Math.min(steep, ref[v.i * 3 + 1]);
  assert.ok(steep > 0.75, `gentle sides (${steep.toFixed(2)})`);
  W.clear(0);
  assert.ok(Math.abs(T.heightAt(...at) - h0) < 1e-6, 'and it comes back');
});
