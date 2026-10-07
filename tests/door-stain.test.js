// The stains round the doors (src/door-stain.js, docs/systems/materials.md): a patch round the opening,
// over its lintel and down to its foot, lying on the face (or round a curved wall), and darker than the wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '../src/noise.js';
import { doorStainGeometry, stainColor } from '../src/door-stain.js';

test('a door stain covers the opening, a little wider and taller, on the face', () => {
  const g = doorStainGeometry(mulberry32(1), 1.2, 2);
  g.computeBoundingBox();
  const b = g.boundingBox;
  assert.ok(b.min.x < -0.6 - 0.2 && b.max.x > 0.6 + 0.2, `wider than the door: ${b.min.x}..${b.max.x}`);
  assert.ok(b.max.y > 2.3 && b.max.y < 3.2, `over the lintel: ${b.max.y}`);
  assert.ok(b.min.y >= 0 && b.min.y < 0.9, `down toward the foot: ${b.min.y}`);
  assert.ok(Math.abs(b.min.z) < 1e-6 && Math.abs(b.max.z) < 1e-6, 'flat on the face');
  // round a drum of radius 5 its vertices stay on the drum
  const c = doorStainGeometry(mulberry32(1), 1.2, 2, 5), p = c.attributes.position;
  for (let i = 0; i < p.count; i++) assert.ok(Math.abs(Math.hypot(p.getX(i), p.getZ(i) + 5) - 5) < 1e-4);
});

test('the stain is the wall darkened toward grime', () => {
  const wall = new THREE.Color('#f3ead8'), s = stainColor('#f3ead8', 0.25);
  assert.ok(s.r < wall.r && s.g < wall.g && s.b < wall.b);
});
