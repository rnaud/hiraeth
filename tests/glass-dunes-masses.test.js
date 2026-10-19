// The Glass Dunes' big masses (src/glass-dunes-masses.js, issue #393): what each piece promises the places
// built from it. The places themselves (walks, stairs, the cave) are tests/glass-dunes-quarter.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoomKit } from '../src/levels/lab-kit.js';
import { GLASS_ATTR } from '../src/dune-glass-shader.js';
import { massMaterials, hole, crowdedBlock, paleFloor, crystalColumn, lump, roundTower, squareTower, rockDwelling, cottage } from '../src/glass-dunes-masses.js';

const kitOf = (ground = null) => new RoomKit({ group: new THREE.Group(), ground, centre: new THREE.Vector3(), seed: 1 });
const mats = (kit) => massMaterials(kit, {
  stone: kit.mat({ color: '#eeeeee' }), trim: kit.mat({ color: '#dddddd' }), ochre: kit.mat({ color: '#bb9955' }),
}, { rock: { color: '#e6dbbd' } });
/** The kit's static pieces, solid or not: [{ solid, shadow, box }]. */
const buckets = (kit) => [...kit.buckets.values()].map((b) => {
  const box = new THREE.Box3();
  for (const g of b.list) { g.computeBoundingBox(); box.union(g.boundingBox); }
  return { solid: b.solid, shadow: b.shadow, mat: b.mat, box };
});

test('an opening is drawn only: no collision, no shadow, lying on its wall', () => {
  const kit = kitOf(), M = mats(kit);
  hole(kit, M.hole, 0, 1, 2.012, 0, 1, 2, { arch: true });
  const [b] = buckets(kit);
  assert.equal(b.solid, false); assert.equal(b.shadow, false);
  assert.ok(b.box.max.z - 2 < 0.06 && b.box.min.z > 1.99, `${b.box.min.z}..${b.box.max.z}: at most 5 cm proud of the wall`);
});

test('a crowded block keeps its jutting rooms off the walks it is given', () => {
  const kit = kitOf(), M = mats(kit);
  crowdedBlock(kit, M, { x: 0, z: 0, w: 12, d: 10, h: 40, seed: 3, clear: () => true });
  for (const b of buckets(kit)) if (b.solid) {
    assert.ok(b.box.max.x <= 12 * 0.47 + 1e-3 && b.box.max.z <= 10 * 0.47 + 1e-3, `a room jutted out though every place is a walk: ${b.box.max.x}, ${b.box.max.z}`);
  }
  const free = kitOf(), F = mats(free);
  crowdedBlock(free, F, { x: 0, z: 0, w: 12, d: 10, h: 40, seed: 3 });
  const solid = buckets(free).filter((b) => b.solid).reduce((a, b) => a.union(b.box), new THREE.Box3());
  assert.ok(solid.max.z > 10 * 0.47 + 0.2, 'with nothing to keep clear, rooms jut from the faces');
  assert.ok(solid.max.y > 40, 'and a ragged top stands over the core');
  assert.ok(buckets(free).some((b) => b.mat === F.lit), 'some openings are lamplit');
});

test('a pale floor is solid, follows the ground a few centimetres over it, never dipping into it, and casts no shadow', () => {
  // (the ground folds between the floor's corners, as the sand's own triangles do: ridges every 4 m, midway between two
  // of the floor's corners; each corner stands over the highest ground a little round it, issue #498)
  const ground = { heightAt: (x, z) => 0.05 * Math.abs(((x % 4) + 4) % 4 - 2) + z * 0.05 };
  const kit = kitOf(ground), M = mats(kit);
  paleFloor(kit, M.stone, ground, { x: 0, z: 0, w: 30, d: 20, lift: 0.06 });
  const [b] = [...kit.buckets.values()];
  assert.equal(b.solid, true); assert.equal(b.shadow, false);
  const p = b.list[0].attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const tri = [0, 1, 2].map((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
    for (const [u, v] of [[1 / 3, 1 / 3], [0.5, 0], [0, 0.5], [0.5, 0.5], [0, 0]]) {
      const q = [0, 1, 2].map((k) => tri[0][k] * (1 - u - v) + tri[1][k] * u + tri[2][k] * v), gap = q[1] - ground.heightAt(q[0], q[2]);
      assert.ok(gap > 0.02 && gap < 0.3, `the floor ${gap.toFixed(3)} m over the ground at ${q[0].toFixed(1)}, ${q[2].toFixed(1)}`);
    }
  }
});

test('crystal columns carry the glass data on every vertex (Unity has no constant attributes)', () => {
  const geoms = [];
  crystalColumn(geoms, { x: 0, y: 0, z: 0, r: 5, h: 60, seed: 4, tones: ['#2f7a63', '#8fcfa4'] });
  const g = geoms[0];
  assert.equal(g.attributes[GLASS_ATTR].count, g.attributes.position.count);
  assert.equal(g.attributes.color.count, g.attributes.position.count);
  g.computeBoundingBox();
  assert.ok(g.boundingBox.max.y > 55 && g.boundingBox.max.y < 66, `its top ${g.boundingBox.max.y}`);
  // every face looks outward, away from the column's axis
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count - 3; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (Math.abs(n.getY(i)) < 0.5) assert.ok(cx * n.getX(i) + cz * n.getZ(i) > 0, 'a side face turned inward');
  }
});

test('towers and blocks rise to the height asked, with scalloped tops', () => {
  const kit = kitOf(), M = mats(kit);
  const t = roundTower(kit, M, { x: 0, y: 0, z: 0, r: 6, h: 40, upper: 12, seed: 2 });
  const s = squareTower(kit, M, { x: 30, y: 0, z: 0, w: 12, d: 10, h: 50, steps: 3, seed: 2 });
  assert.ok(t > 52 && t < 60, `round tower top ${t}`);
  assert.ok(s > 50 && s < 56, `square tower top ${s}`);
  const top = buckets(kit).filter((b) => b.solid).reduce((a, b) => a.union(b.box), new THREE.Box3()).max.y;
  assert.ok(top > 53, 'merlons stand over the parapet');
});

test('rock dwellings, lumps and cottages stand on their feet', () => {
  const kit = kitOf(), M = { ...mats(kit), door: mats(kitOf()).ochre };
  lump(kit, M.rock, 0, 5, 0, 3, 4, 3, 7);
  const [b] = buckets(kit);
  assert.ok(b.box.min.y >= 5 - 0.55 * 4 * 1.25 - 1e-3, `a lump's foot ${b.box.min.y}`);
  const k2 = kitOf(), M2 = mats(k2);
  rockDwelling(k2, M2, { x: 0, y: 0, z: 0, w: 8, d: 8, h: 12, seed: 3 });
  cottage(k2, M2, { x: 20, y: 0, z: 0, w: 5, d: 5, h: 4, seed: 3, spire: true });
  const all = buckets(k2).filter((x) => x.solid).reduce((a, x) => a.union(x.box), new THREE.Box3());
  assert.ok(all.min.y >= -2.5 && all.max.y > 12, `${all.min.y}..${all.max.y}`);
});
