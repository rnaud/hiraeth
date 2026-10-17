// The walker of the makers' houses (tests/house-walk.js) never walks into a wall (issue #444): a cell that falls on a
// wall's face dropped into its thickness, where the underside of the wall's foot looked like ground and a body on the
// face's plane was pushed nowhere. In the Mooring-House the flood went from the east landing's railing into the north
// wall, along it over the void and under the west landing, and tests/wings-reach.js flew a "running jump and late
// double jump over the gangway (br2)" from inside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { walk } from './house-walk.js';

const slab = (scene, w, h, d, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  m.position.set(x, y, z);
  scene.add(m);
};

test('the walker stays out of a thick wall whose face lies on its grid, over a void', () => {
  const scene = new THREE.Scene();
  slab(scene, 10, 0.8, 10, 0, -0.4, 0);       // a floor, its top at 0, z -5..5
  slab(scene, 30, 14, 1.2, 0, 3, 5.6);        // a wall on its far edge, z 5..6.2, its foot 4 m down over nothing
  const physics = new Physics(scene);
  const W = { physics, rt: { pits: [] }, level: {} };
  const spots = walk(W, new THREE.Vector3(0, 0, 0));
  assert.ok(spots.length > 50, `the floor walked (${spots.length})`);
  const inWall = spots.filter((p) => p.z >= 5 - 1e-6);
  assert.deepEqual(inWall.map((p) => p.toArray().map((v) => +v.toFixed(2))), [], 'no spot on or in the wall');
  assert.ok(spots.every((p) => Math.abs(p.y) < 1e-6), 'every spot on the floor, none down at the wall\'s foot');
});
