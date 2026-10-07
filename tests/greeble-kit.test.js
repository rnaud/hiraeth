// The small machinery kit (src/levels/greeble-kit.js; docs/systems/references.md, "Small machinery"): pieces on a face,
// standing off it no more than asked, facing out of it, a few faces each, merged by role.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { greebles, GREEBLE } from '../src/levels/greeble-kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const boxOf = (m) => { const b = new THREE.Box3(); for (const g of Object.values(m)) if (g) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };

test('a patch fills its rectangle with pieces that stand out of the face, never behind it or past their depth', () => {
  const g = greebles(3).patch(V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), 12, 8, { density: 1.2, depth: 0.6 });
  assert.ok(g.count > 40, `pieces: ${g.count}`);
  const b = boxOf(g.merged());
  assert.ok(b.min.z > -0.05 && b.max.z < 0.6 + 0.35, `depth ${b.min.z.toFixed(2)} … ${b.max.z.toFixed(2)}`);
  assert.ok(b.min.x > -2 && b.max.x < 14 && b.min.y > -1 && b.max.y < 9.5, JSON.stringify(b));
});

test('a left-handed frame is turned round, so the pieces still stand out of the face', () => {
  const b = boxOf(greebles(4).patch(V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), V(0, 0, -1), 10, 6).merged());
  assert.ok(b.max.z < 0.05 && b.min.z < -0.1 && b.min.x > -2 && b.max.x < 12, JSON.stringify(b));
});

test('the pieces are cheap: a few dozen faces at most, about a dozen a square metre at density 1', () => {
  for (const [k, n] of Object.entries(GREEBLE.faces)) assert.ok(n <= 80, `${k}: ${n}`);
  const m = greebles(5).patch(V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), 20, 10).merged();
  const faces = Object.values(m).reduce((t, g) => t + (g ? g.attributes.position.count / 3 : 0), 0);
  assert.ok(faces / 200 < 12, `${(faces / 200).toFixed(1)} faces a m²`);
});

test('rock dressing: knobs and ribs on the face (Vael II’s undersides)', () => {
  const m = greebles(6).patch(V(0, 0, 0), V(1, 0, 0), V(0, 0, 1), V(0, -1, 0), 20, 20, { kinds: 'rock', scale: 2 }).merged();
  assert.ok(m.rock && !m.metal);
});
