import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { omitCoveredCap } from '../src/covered-cap.js';

function directions(g) {
  const n = g.attributes.normal, a = g.index.array;
  const counts = { up: 0, down: 0, side: 0 };
  for (let i = 0; i < a.length; i += 3) {
    const ys = [n.getY(a[i]), n.getY(a[i+1]), n.getY(a[i+2])];
    counts[ys.every(y => y > .999) ? 'up' : ys.every(y => y < -.999) ? 'down' : 'side']++;
  }
  return counts;
}
test('buried caps disappear while lower silhouettes and exposed roofs remain closed', () => {
  for (const create of [() => new THREE.BoxGeometry(4, 8, 4), () => new THREE.CylinderGeometry(2, 3, 8, 8)]) {
    const g = create(), before = directions(g);
    omitCoveredCap(g, (x,y,z) => y > 0 && Math.hypot(x,z) < 4);
    assert.deepEqual(directions(g), { ...before, up: 0 });
    const exposed = create();
    omitCoveredCap(exposed, () => false);
    assert.deepEqual(directions(exposed), before);
  }
});
test('a roof crossing the cover boundary keeps its uncovered triangles', () => {
  const g = new THREE.BoxGeometry(4, 8, 4);
  const before = directions(g);
  omitCoveredCap(g, x => x < 0);
  assert.deepEqual(directions(g), before);
});
