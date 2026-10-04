import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Qanat's burning tree is a closed solid: no open ends, no faces turned inside out, so
// from anywhere round the trunk you see bark, never the inside of a root or a limb.

globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), body: {}, getElementById: () => null, querySelector: () => null };
const { taper } = await import('../src/desert-city.js');
const { createDesert } = await import('../src/levels/desert.js');
const { STORY } = await import('../src/desert-sites.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Weld by position, drop the triangles the weld collapsed; then every edge must be shared by
 *  exactly two triangles running it in opposite directions (a closed, consistently wound surface). */
function edges(geo, tol) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position.clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const w = mergeVertices(g, tol), ix = w.index.array, p = w.attributes.position;
  const dir = new Map();
  let vol = 0;
  const a = V(), b = V(), c = V();
  for (let i = 0; i < ix.length; i += 3) {
    const t = [ix[i], ix[i + 1], ix[i + 2]];
    if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue;
    a.fromBufferAttribute(p, t[0]); b.fromBufferAttribute(p, t[1]); c.fromBufferAttribute(p, t[2]);
    vol += a.dot(b.clone().cross(c)) / 6;
    for (let k = 0; k < 3; k++) { const key = `${t[k]},${t[(k + 1) % 3]}`; dir.set(key, (dir.get(key) ?? 0) + 1); }
  }
  let open = 0, flipped = 0;
  for (const [key, n] of dir) {
    const [u, v] = key.split(',');
    const back = dir.get(`${v},${u}`) ?? 0;
    if (n > 1) flipped++;
    else if (back === 0) open++;
  }
  return { open, flipped, vol };
}

test('a taper is a closed tube, its faces turned outward', () => {
  for (const [pts, r0, r1] of [
    [[V(0, 0, 0), V(3, -0.8, 0), V(7, -1.4, 0.5), V(9, -3.6, 0.2)], 1.1, 0.35],
    [[V(0, 0, 0), V(0.5, 4, 0.2), V(1, 9, -0.4), V(1.2, 14, 0)], 2.1, 0.8],
  ]) {
    const g = taper(pts, r0, r1, 12, 6);
    const e = edges(g, 1e-5);
    assert.equal(e.open, 0, 'no open edges (the ends are capped)');
    assert.equal(e.flipped, 0, 'consistently wound');
    assert.ok(e.vol > 0, `outward (volume ${e.vol.toFixed(2)})`);
    // every face looks away from the curve
    const p = g.attributes.position, ix = g.index.array, curve = new THREE.CatmullRomCurve3(pts);
    const near = curve.getSpacedPoints(200);
    for (let i = 0; i < ix.length; i += 3) {
      const A = V().fromBufferAttribute(p, ix[i]), B = V().fromBufferAttribute(p, ix[i + 1]), C = V().fromBufferAttribute(p, ix[i + 2]);
      const n = B.clone().sub(A).cross(C.clone().sub(A)), m = A.clone().add(B).add(C).divideScalar(3);
      const axis = near.reduce((best, q) => (q.distanceToSquared(m) < best.distanceToSquared(m) ? q : best));
      assert.ok(n.dot(m.clone().sub(axis)) > -1e-9, 'face turned outward');
    }
  }
});

const level = createDesert(new THREE.Scene());
const bark = level.qanat.city.bark;

test('the tree (trunk, roots, limbs, the ledge’s buttress) is closed and wound outward', () => {
  assert.ok(bark?.isMesh, 'the tree’s bark mesh');
  const e = edges(bark.geometry, 0.01);
  assert.equal(e.open, 0, `no open edges (${e.open})`);
  assert.equal(e.flipped, 0, `no faces turned inside out (${e.flipped})`);
  assert.ok(e.vol > 0, 'outward');
});

test('looking at the tree from the terraces and the stairs, every ray meets bark from outside', () => {
  const mesh = new THREE.Mesh(bark.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const base = level.qanat.city.treeBase, C = STORY.city;
  let hits = 0;
  const box = new THREE.Box3().setFromBufferAttribute(bark.geometry.attributes.position);
  // eyes round the tree: on the top terrace, the tier below, the stairs, and up the trunk (climbing)
  const eyes = [];
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2;
    for (const [r, dy] of [[7.5, 1.7], [9.5, 1.0], [11, 1.7], [13.5, -0.6], [16, -0.4], [6.5, 6], [5.6, 12], [5.2, 20]]) eyes.push(V(base.x + Math.sin(a) * r, base.y + dy, base.z + Math.cos(a) * r));
  }
  for (const s of [1, -1]) for (const d of [13, 16, 20, 26]) eyes.push(V(0, 0, 0).set(Math.sin(C.yaw) * d * s, 0, Math.cos(C.yaw) * d * s).add(V(base.x, base.y - (d - 12) * 0.25, base.z)));
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (const eye of eyes) {
    // (an eye that ended up inside the bark, say in a limb, isn't somewhere you can stand)
    ray.set(eye, V(0, 1, 0));
    const up = ray.intersectObject(mesh);
    if (up.length % 2 === 1) continue;
    for (let n = 0; n < 24; n++) {
      const target = V(THREE.MathUtils.lerp(box.min.x, box.max.x, rnd()), THREE.MathUtils.lerp(base.y - 3, base.y + 30, rnd()), THREE.MathUtils.lerp(box.min.z, box.max.z, rnd()));
      ray.set(eye, target.sub(eye).normalize());
      const hit = ray.intersectObject(mesh)[0];
      if (!hit) continue;
      hits++;
      const n3 = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
      assert.ok(n3.dot(ray.ray.direction) < 0, `from ${eye.toArray().map((v) => v.toFixed(1))} the first bark hit is a back face (the inside) at ${hit.point.toArray().map((v) => v.toFixed(1))}`);
    }
  }
  assert.ok(hits > 2000, `enough rays met the tree (${hits})`);
});
