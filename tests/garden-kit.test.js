// The Garden of Spheres' shapes (src/levels/garden-kit.js; docs/systems/references.md, "The Garden of Spheres'
// sheets"): foliage in leaf masses, spheres printed in two tones, the sculpted rock, the arcades, the robot, the
// hedges' fruit, the plaza's paving; and the shader's branching veins and dense hatching (src/materials.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { leafCrown, crescentSphere, pillowRock, arcade, robotParts, hedge, paintPaving, pavingSegments } from '../src/levels/garden-kit.js';
import { makeMaterial, shadeOf, FORM } from '../src/materials.js';
import { WHITE_SHADE } from '../src/levels/spheres.js';

const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };

test('foliage is a cluster of welded leaf masses, about a unit round', () => {
  const g = leafCrown(3, { lobes: 6 });
  assert.ok(g.index, 'welded (indexed): smooth, not faceted');
  assert.equal(g.index.count / 3, 7 * 80, 'a core and six lobes of 80 faces');
  const b = box(g);
  assert.ok(b.max.x > 0.8 && b.max.x < 1.4 && b.min.y > -0.9, JSON.stringify(b));
});

test('a printed sphere has two tones split by the plane across its light, whatever the sun', () => {
  const g = crescentSphere(10, 32, 20, '#ffffff', '#000000', [1, 0, 0]);
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    assert.equal(c.getX(i), x > 0 ? 1 : 0);
  }
});

test('the sculpted rock stands on its foot, flattened on top', () => {
  const b = box(pillowRock(1, 4, 3, 2));
  assert.ok(Math.abs(b.min.y) < 0.6 && b.max.y < 3 * 1.2, JSON.stringify(b));
});

test('an arcade is pierced by its arches, its piers between them', () => {
  const g = arcade({ bays: 3, span: 6, h: 9, pier: 1.4 });
  const p = g.attributes.position, W = 3 * 6 + 1.4;
  // no face of the wall's front lies in the middle of an opening below the springing
  let inOpening = 0, onPier = 0;
  for (let i = 0; i < p.count; i += 3) {
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    if (Math.abs(Math.abs(cz) - 0.8) > 0.01 || cy > 4) continue;
    const u = (cx + W / 2 - 0.7) / 6, f = u - Math.floor(u);
    if (f > 0.3 && f < 0.7) inOpening++; else if (f < 0.05 || f > 0.95) onPier++;
  }
  assert.equal(inOpening, 0);
  assert.ok(onPier > 0);
});

test('the robot statue stands about 30 m tall on its feet, its visor and vents dark slots', () => {
  const { parts, slots } = robotParts();
  assert.ok(parts.length >= 25 && slots.length >= 2);
  const b = new THREE.Box3(); for (const g of parts) b.union(box(g));
  assert.ok(Math.abs(b.min.y) < 0.01 && b.max.y > 28 && b.max.y < 34, JSON.stringify(b));
});

test('a hedge carries its fruit on its top and its long faces', () => {
  const { hedge: g, fruit } = hedge(2, 3, 1.5, 2, 20);
  const b = box(g);
  assert.equal(fruit.length, 20);
  for (const [x, y, z] of fruit) assert.ok(Math.abs(x) <= 1.5 && y > 0 && y < 1.7 && Math.abs(z) <= 1.1, `${x} ${y} ${z}`);
  assert.ok(b.min.y > -0.1 && b.max.y < 1.7);
});

test('the plaza is paved: neighbouring slabs a tone apart, enough for the ink to draw their joint', () => {
  const R = 12, g = new THREE.CylinderGeometry(R, R, 0.3, pavingSegments(R), 1).toNonIndexed();
  paintPaving(g, 0, 0, R, 0, { tones: ['#efe7d4', '#e0d5bf'] });
  const c = g.attributes.color, p = g.attributes.position, tones = new Set();
  for (let i = 0; i < p.count; i += 3) if (p.getY(i) > 0.1 && p.getY(i + 1) > 0.1 && p.getY(i + 2) > 0.1) tones.add(c.getX(i).toFixed(3));
  assert.equal(tones.size, 2);
  const a = new THREE.Color('#efe7d4'), b = new THREE.Color('#e0d5bf');
  assert.ok(Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) > 0.08, 'past post.js colour-edge threshold');
});

test('veins branch, a hatch over 1 is denser, the white stone prints flat with almost no strokes', () => {
  const m = makeMaterial({ color: '#2b4535', form: true, veins: 1 });
  assert.match(m.fragmentShader, /veinLines\(/);
  assert.ok(FORM.veins.bough > 0 && FORM.veins.boughs >= 2);
  assert.match(m.fragmentShader, /float darkH = min\(dark \* /);
  assert.equal(shadeOf({ hatch: 2 })[2], 2);
  assert.deepEqual(shadeOf({ color: '#fff', ...WHITE_SHADE }).slice(1, 3), [3, 0.08]);
});
