// Issue #460: the buried-tree checks (src/physics.js dropBuriedInstancesSteps) ask embedded() first, their own
// collider then, the rest of buried() last, and share one up ray along each vertical line of a tree's points (UpColumn).
// Every instance dropped or kept must be what the check in its old order, a ray for every point, says.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics, dropBuriedInstances, UpColumn } from '../src/physics.js';

/** A seeded random (mulberry32). */
const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** A town of closed boxes, one-sided floors and roofs (either way up), slabs flush on the street, low overhangs, trunks. */
function town(seed) {
  const R = rng(seed), scene = new THREE.Scene();
  const add = (geo, x, y, z, o = {}) => { const m = new THREE.Mesh(geo); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; scene.add(m); return m; };
  add(new THREE.BoxGeometry(160, 1, 160), 0, -0.5, 0);
  for (let i = 0; i < 70; i++) {
    const w = 3 + R() * 10, h = 2 + R() * 12, d = 3 + R() * 10;
    add(new THREE.BoxGeometry(w, h, d), (R() - 0.5) * 120, h / 2 + (R() < 0.2 ? 4 + R() * 6 : 0), (R() - 0.5) * 120, { ry: R() < 0.5 ? R() * Math.PI : 0 });
  }
  // (a floor flush on the street: a front face and a back one at the same distance, embedded's coplanar case)
  for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(6 + R() * 8, 0.4, 6 + R() * 8), (R() - 0.5) * 120, 0.2, (R() - 0.5) * 120);
  // (one-sided planes facing up or down, some just above a tree's heights: a column's hit within its margin)
  for (let i = 0; i < 40; i++) {
    const y = [1.02, 3.52, 6.03, 1 + R() * 10, 7 + R() * 20][i % 5];
    add(new THREE.PlaneGeometry(4 + R() * 12, 4 + R() * 12), (R() - 0.5) * 120, y, (R() - 0.5) * 120, { rx: R() < 0.5 ? -Math.PI / 2 : Math.PI / 2 });
  }
  // (a house on a house, the upper's floor on the lower's roof: from inside the lower, a front face and a back one at the
  // same distance up)
  for (let i = 0; i < 15; i++) {
    const x = (R() - 0.5) * 120, z = (R() - 0.5) * 120, w = 4 + R() * 8, h = 2 + R() * 4;
    add(new THREE.BoxGeometry(w, h, w), x, h / 2, z); add(new THREE.BoxGeometry(w, 5, w), x, h + 2.5, z);
  }
  // (far up, facing up: a hit at the edge of embedded()'s 400 m, within the column's reach and past it)
  for (let i = 0; i < 25; i++) add(new THREE.PlaneGeometry(30, 30), (R() - 0.5) * 120, 399 + R() * 12, (R() - 0.5) * 120, { rx: -Math.PI / 2 });
  // (an invisible trunk standing where a tree will: a point inside only its own collider)
  const trunks = [];
  for (let i = 0; i < 20; i++) { const x = (R() - 0.5) * 120, z = (R() - 0.5) * 120; const t = add(new THREE.CylinderGeometry(0.3, 0.3, 7, 8).translate(0, 3.5, 0), x, 0, z); t.visible = false; trunks.push([x, z]); }
  return { scene, R, trunks };
}

/** n trees (a cone 8 m tall), turned about y, a few leaning, some on a trunk; two copies with the same matrices. */
function trees(scene, R, trunks, n) {
  const geo = new THREE.ConeGeometry(1.2, 8, 7).translate(0, 4, 0), mat = new THREE.MeshBasicMaterial();
  const a = new THREE.InstancedMesh(geo, mat, n), b = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (i < trunks.length) p.set(trunks[i][0], 0, trunks[i][1]); else p.set((R() - 0.5) * 130, R() < 0.15 ? R() * 8 : 0, (R() - 0.5) * 130);
    e.set(R() < 0.1 ? (R() - 0.5) * 0.5 : 0, R() * Math.PI * 2, R() < 0.1 ? (R() - 0.5) * 0.5 : 0);
    const k = 0.6 + R() * 0.9;
    m.compose(p, q.setFromEuler(e), s.set(k, k * (0.8 + R() * 0.4), k));
    a.setMatrixAt(i, m); b.setMatrixAt(i, m);
  }
  for (const t of [a, b]) { t.userData.noCollide = true; scene.add(t); }
  return [a, b];
}

/** The check in its old order: no sure(), so dropBuriedInstances takes its stand-in's way (own collider, buried, every ray). */
const oldWay = (physics) => ({ bvh: physics.bvh, base: physics.base, rayHit: (...a) => physics.rayHit(...a), buried: (p) => physics.buried(p) });

const shown = (mesh) => {
  const m = new THREE.Matrix4(), out = [];
  for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); out.push(Math.abs(m.determinant()) >= 1e-9 ? 1 : 0); }
  return out.join('');
};

test('the trees dropped are the same as the check a ray at a time drops: towns of houses, one-sided floors, flush slabs, trunks', () => {
  let dropped = 0, kept = 0;
  for (const seed of [1, 2, 3, 4]) {
    const { scene, R, trunks } = town(seed);
    const [a, b] = trees(scene, R, trunks, 500);
    const physics = new Physics(scene);
    // a tree's trunk, middle and crown, and a ring round each (the City-Shaft's own check, src/levels/incal.js)
    const nOld = dropBuriedInstances(a, oldWay(physics), [1, 3.5, 6], { ring: 0.9 });
    const nNew = dropBuriedInstances(b, physics, [1, 3.5, 6], { ring: 0.9 });
    assert.equal(nNew, nOld, `seed ${seed}: as many dropped`);
    assert.equal(shown(b), shown(a), `seed ${seed}: the same trees`);
    // a tuft: only when buried root to tip (dropBuriedFlora's all)
    const [c, d] = trees(scene, rng(seed + 10), [], 500);
    assert.equal(dropBuriedInstances(d, physics, [0.35, 0.65, 0.95], { all: true }), dropBuriedInstances(c, oldWay(physics), [0.35, 0.65, 0.95], { all: true }));
    assert.equal(shown(d), shown(c), `seed ${seed}: the same tufts`);
    dropped += nOld; kept += a.count - nOld;
  }
  // (the towns are worth testing on: trees go both ways)
  assert.ok(dropped > 100 && kept > 1000, `dropped ${dropped}, kept ${kept}`);
});

test('a column answers embedded()\'s up axis as a ray from each point would, or leaves the point to its own ray', () => {
  const { scene } = town(7);
  const physics = new Physics(scene);
  const R = rng(70), p = new THREE.Vector3(), ray = new THREE.Ray(), up = new THREE.Vector3(0, 1, 0);
  // the up axis on its own: free (false), or a back face first (true)
  const upAxis = (q) => {
    ray.origin.copy(q); ray.direction.copy(up);
    const hit = physics.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 400);
    if (!hit) return false;
    if (hit.face.normal.y > 0) return true;
    return physics.bvh.raycast(ray, THREE.DoubleSide, 0, hit.distance + 0.02).some((h) => h.face.normal.y > 0);
  };
  let answered = 0, own = 0;
  for (let i = 0; i < 3000; i++) {
    const x = (R() - 0.5) * 120, z = (R() - 0.5) * 120, y0 = R() * 8, col = new UpColumn(6);
    for (const dy of [0, 2.5, 5, 6, R() * 6, -1, 7]) {
      p.set(x, y0 + dy, z);
      const r = col.up(physics, p, 400);
      if (r === null) { own++; continue; }
      answered++;
      assert.equal(r === 1, upAxis(p), `(${x}, ${y0 + dy}, ${z})`);
    }
    // (off its line: its own ray)
    assert.equal(col.up(physics, p.set(x + 0.5, y0 + 1, z), 400), null);
  }
  assert.ok(answered > 10000 && own > 3000, `answered ${answered}, own ${own}`);
});
