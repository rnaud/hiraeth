// Lorn's crystals' shapes (src/crystal-forms.js, issue #693): six-sided prisms with their points, chipped, in clusters,
// closed and wound outward, their facet frame (u 0 on a face's edges and 1 in its middle, v up from the root) in the uv.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { crystalPrism, crystalCluster, crystalCollider, crystalRand, clipSolid, CRYSTAL_FORM } from '../src/crystal-forms.js';

const tris = (g) => g.attributes.position.count / 3;
const corner = (g, i) => new THREE.Vector3().fromBufferAttribute(g.attributes.position, i);

/** Every edge shared by two triangles (to 0.1 mm): the solid is closed. */
function closed(g) {
  const key = (p) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  const edges = new Map();
  for (let t = 0; t < tris(g); t++) for (let k = 0; k < 3; k++) {
    const a = key(corner(g, t * 3 + k)), b = key(corner(g, t * 3 + (k + 1) % 3));
    if (a === b) continue;
    const e = a < b ? `${a}|${b}` : `${b}|${a}`;
    edges.set(e, (edges.get(e) ?? 0) + 1);
  }
  return [...edges.values()].every((n) => n === 2);
}

test('issue #693: a plain crystal is a six-sided prism with its point: its triangles, its height, closed, wound outward', () => {
  const g = crystalPrism({ r: 1, h: 10, chips: 0, broken: 0 }, crystalRand(1, 2));
  // six sides (a fan of 4 round each middle), six faces of the point (3 each), the foot (a plain fan of 4)
  assert.equal(tris(g), 6 * 4 + 6 * 3 + 4);
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y - 10) < 1e-6 && Math.abs(g.boundingBox.min.y) < 1e-6, 'from its root to its point');
  assert.ok(closed(g));
  for (let t = 0; t < tris(g); t++) {
    const [a, b, c] = [0, 1, 2].map((k) => corner(g, t * 3 + k));
    const n = b.clone().sub(a).cross(c.clone().sub(a)), m = a.clone().add(b).add(c).divideScalar(3);
    if (n.lengthSq() > 1e-12) assert.ok(n.dot(m.sub(new THREE.Vector3(0, 4, 0))) > 0, `triangle ${t} faces out`);
  }
});

test('issue #693: the facet frame: u 0 on each face\'s edges and 1 in its middle, v its height over h, the foot v -1', () => {
  const h = 12, g = crystalPrism({ r: 1.5, h }, crystalRand(3, 4)), U = g.attributes.uv, P = g.attributes.position;
  let framed = 0;
  for (let t = 0; t < tris(g); t++) {
    const us = [0, 1, 2].map((k) => U.getX(t * 3 + k)), vs = [0, 1, 2].map((k) => U.getY(t * 3 + k));
    if (vs.every((v) => v === -1)) continue;   // (the foot: its tone only)
    framed++;
    assert.deepEqual(us.slice().sort(), [0, 0, 1], 'a fan triangle: its middle and an edge');
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(vs[k] - P.getY(t * 3 + k) / h) < 1e-6, 'v up from the root');
  }
  assert.ok(framed > tris(g) - 6);
});

test('issue #693: worn: chips and broken tips add faces but never take more than a corner; the same seed, the same crystal', () => {
  let chipped = 0, broken = 0, total = 0;
  for (let s = 0; s < 300; s++) {
    const R = crystalRand(s * 1.7, s * -2.3), r = 0.5 + R() * 3, h = 4 + R() * 40;
    const g = crystalPrism({ r, h }, R);
    total += tris(g);
    assert.ok(closed(g), `crystal ${s} closed`);
    g.computeBoundingBox();
    const b = g.boundingBox;
    if (tris(g) > 46) chipped++;
    if (b.max.y < h - 1e-6) broken++;
    assert.ok(b.max.y > h * 0.6, 'a broken tip keeps most of it');
    assert.ok(b.max.x - b.min.x > r * 1.2, 'a chip never cuts through');
  }
  assert.ok(chipped > 250, `most are chipped (${chipped})`);
  assert.ok(broken > 30 && broken < 150, `some tips broken or blunted (${broken})`);
  assert.ok(total / 300 < 70, `about 60 triangles a crystal (${total / 300})`);
  const a = crystalPrism({ r: 1, h: 8 }, crystalRand(5, 6)), b = crystalPrism({ r: 1, h: 8 }, crystalRand(5, 6));
  assert.deepEqual([...a.attributes.position.array], [...b.attributes.position.array]);
});

test('issue #693: a cluster: the main crystal and a few smaller ones leaning out round its foot', () => {
  for (let s = 0; s < 40; s++) {
    const h = 6 + s, cl = crystalCluster({ r: 1.2, h }, crystalRand(s, 0));
    assert.equal(cl.filter((q) => q.main).length, 1);
    assert.ok(cl.length >= 2 && cl.length <= 4, `${cl.length} crystals`);
    for (const { geo, main } of cl.slice(1)) {
      assert.ok(!main);
      geo.computeBoundingBox();
      const top = geo.boundingBox.max.y;
      assert.ok(top < h * CRYSTAL_FORM.companions.height[1] + 0.01, 'smaller than the main');
      // leaning out: its highest point further from the main's axis than the middle of its foot
      const P = geo.attributes.position, b = geo.boundingBox, foot = new THREE.Vector2();
      let hi = 0, n = 0;
      for (let i = 0; i < P.count; i++) {
        if (P.getY(i) > P.getY(hi)) hi = i;
        if (P.getY(i) < b.min.y + 0.15 * (b.max.y - b.min.y)) { foot.x += P.getX(i); foot.y += P.getZ(i); n++; }
      }
      foot.divideScalar(n);
      assert.ok(Math.hypot(P.getX(hi), P.getZ(hi)) > foot.length(), 'it leans out');
    }
  }
});

test('issue #693: clipSolid cuts a cube\'s corner into a new triangle face, wound outward', () => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const c = [V(0, 0, 0), V(1, 0, 0), V(1, 1, 0), V(0, 1, 0), V(0, 0, 1), V(1, 0, 1), V(1, 1, 1), V(0, 1, 1)];
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]].map((q) => ({ kind: 'side', pts: q.map((i) => c[i]) }));
  const n = V(1, 1, 1).normalize(), out = clipSolid(faces, n, n.dot(V(1, 1, 1)) - 0.2);
  assert.equal(out.length, 7);
  const cap = out.find((f) => f.kind === 'chip');
  assert.equal(cap.pts.length, 3);
  const [a, b, d] = cap.pts;
  assert.ok(b.clone().sub(a).cross(d.clone().sub(a)).dot(n) > 0, 'the cut faces out');
});

test('issue #693: the collider: the same solid, each face once, under half the triangles, no foot', () => {
  const g = crystalPrism({ r: 1.2, h: 14 }, crystalRand(9, 9)).rotateX(0.2).translate(5, 1, -3);
  const c = crystalCollider(g);
  assert.ok(c.attributes.position.count / 3 < tris(g) / 2 + 2, `${c.attributes.position.count / 3} of ${tris(g)}`);
  // the same area (the faces but the foot)
  const area = (geo, skipFoot) => {
    let a = 0; const P = geo.attributes.position, U = geo.attributes.uv;
    for (let t = 0; t < P.count / 3; t++) {
      if (skipFoot && U.getY(t * 3) < -0.5) continue;
      const [p, q, r] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(P, t * 3 + k));
      a += q.sub(p).cross(r.sub(p)).length() / 2;
    }
    return a;
  };
  assert.ok(Math.abs(area(g, true) - area(c, false)) < 1e-3 * area(g, true));
});
