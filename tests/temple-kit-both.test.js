// TempleKit.both(mat, geo, proxy) draws geo and makes it solid. Several boxes passed loose (both(mat, a, b, c))
// drew only the first, made the second the invisible proxy and dropped the rest (issue #358: the Hush-House's
// side mouths, the Lamp-House's niches, the Mooring-House's irons). Now several go as an array, each drawn and
// solid, and a loose fourth argument throws.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TempleKit, box } from '../src/temples/kit.js';

const at = [[-4, 1, 0], [0, 1, 3], [5, 1, -2]];

function build(fn) {
  const root = new THREE.Group();
  const K = new TempleKit(root, 'test', new THREE.Vector3(10, 0, -6), 0.7);
  const mat = new THREE.MeshBasicMaterial();
  fn(K, mat);
  K.flush();
  root.updateMatrixWorld(true);
  const drawn = root.getObjectByName('test').children.filter((m) => m.visible);
  const solid = root.getObjectByName('test collision');
  return { K, drawn, solid };
}

// a ray straight down onto each box's top, in the world: does it hit the mesh there?
const hits = (K, mesh, [x, y, z]) => {
  const p = K.world(x, y + 5, z);
  const ray = new THREE.Raycaster(p, new THREE.Vector3(0, -1, 0), 0, 10);
  return ray.intersectObject(mesh).some((h) => Math.abs(h.point.y - (y + 0.5)) < 1e-3);
};

test('both() with an array of boxes draws and collides every one of them', () => {
  const { K, drawn, solid } = build((K, mat) => K.both(mat, at.map(([x, y, z]) => box(1, 1, 1, x, y, z))));
  assert.equal(drawn.length, 1);
  assert.ok(solid, 'a collision mesh');
  for (const p of at) {
    assert.ok(hits(K, drawn[0], p), `box at ${p} drawn`);
    assert.ok(hits(K, solid, p), `box at ${p} solid`);
  }
});

test('both() with one geometry and a proxy draws the one and collides the proxy', () => {
  const { K, drawn, solid } = build((K, mat) => K.both(mat, box(1, 1, 1, ...at[0]), box(1, 1, 1, ...at[1])));
  assert.ok(hits(K, drawn[0], at[0]) && !hits(K, drawn[0], at[1]));
  assert.ok(hits(K, solid, at[1]) && !hits(K, solid, at[0]));
});

test('both() with several geometries passed loose throws', () => {
  assert.throws(() => build((K, mat) => K.both(mat, ...at.map(([x, y, z]) => box(1, 1, 1, x, y, z)))), /array/);
});
