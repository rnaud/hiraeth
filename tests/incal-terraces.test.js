// The City-Shaft's terraces (src/levels/incal.js): each level's ring is cut into 2-3 sectors with a gap
// between them, the sectors going round the ring one after the other. Until October 2026 the angle never
// advanced between them, so a level's sectors were all built at the same angle: their slabs (and their
// houses, stalls and railings) drawn on top of each other, and the rest of the ring empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIncal } from '../src/levels/incal.js';

const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const scene = new THREE.Scene(), level = quiet(() => createIncal(scene));
const S = level.shaft, TAU = Math.PI * 2;
const norm = (a) => ((a % TAU) + TAU) % TAU;
/** how far round from a0 the angle b lies (0..TAU) */
const round = (a0, b) => norm(b - a0);
const byLevel = S.LEVELS.map((y) => S.terraces.filter((t) => t.y === y));

test('every level of terraces is 2 or 3 sectors going round the ring, none on top of another', () => {
  for (const ts of byLevel) {
    assert.ok(ts.length >= 2 && ts.length <= 3, `${ts.length} sectors at ${ts[0].y} m`);
    for (const [i, t] of ts.entries()) for (const [j, u] of ts.entries()) {
      if (i === j) continue;
      // u's start and end lie outside t's span (round from t's start)
      for (const b of [u.a0, u.a1]) {
        const d = round(t.a0, b);
        assert.ok(d > t.a1 - t.a0 + 1e-6 && d < TAU - 1e-6, `${t.y} m: sector ${j} (${norm(u.a0).toFixed(2)}-${norm(u.a1).toFixed(2)}) overlaps sector ${i} (${norm(t.a0).toFixed(2)}-${norm(t.a1).toFixed(2)})`);
      }
    }
    // together they go round the ring but for the gaps between them (a fifth at most)
    const covered = ts.reduce((s, t) => s + (t.a1 - t.a0), 0);
    assert.ok(covered > TAU * 0.8 && covered < TAU, `${ts[0].y} m: the sectors cover ${(covered / TAU * 100).toFixed(0)} % of the ring`);
  }
});

test('the drawn slabs: one top under every point of a ring, no two at the same place', () => {
  // the slabs: the sector meshes at a level's height, 7 m thick
  const slabs = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'ExtrudeGeometry' || !S.LEVELS.includes(o.position.y)) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    if (Math.abs(b.max.y - b.min.y - 7) < 0.01) slabs.push(o);
  });
  assert.equal(slabs.length, S.terraces.length, 'a slab for every sector');
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  for (const ts of byLevel) {
    const y = ts[0].y, mid = ts.reduce((s, t) => s + (t.r0 + S.R) / 2, 0) / ts.length;
    let hit = 0, n = 0;
    for (let a = 0; a < TAU; a += 0.01) {
      n++;
      ray.set(new THREE.Vector3(Math.cos(a) * mid, y + 1, Math.sin(a) * mid), down);
      ray.far = 2;
      const tops = ray.intersectObjects(slabs, false).filter((h) => Math.abs(h.point.y - y) < 0.01);
      assert.ok(tops.length <= 1, `${y} m, at ${a.toFixed(2)} rad: ${tops.length} slab tops drawn on top of each other`);
      hit += tops.length;
    }
    assert.ok(hit / n > 0.8, `${y} m: a slab under ${(hit / n * 100).toFixed(0)} % of the ring`);
  }
});

test('every sector has its town: market stalls along each one', () => {
  for (const t of S.terraces) {
    const n = S.stallSpots.filter(([x, y, z]) => y === t.y && round(t.a0, Math.atan2(z, x)) <= t.a1 - t.a0).length;
    assert.ok(n >= 3, `${t.y} m, sector at ${norm(t.a0).toFixed(2)}: ${n} stalls`);
  }
});

test('the story places stand on their terraces', () => {
  const on = (p, y) => S.terraces.some((t) => t.y === y && round(t.a0, Math.atan2(p.z, p.x)) <= t.a1 - t.a0 && Math.hypot(p.x, p.z) > t.r0);
  const P = S.places;
  assert.ok(on(P.nima, S.LEVELS[0]), 'Nima on the high terrace');
  for (const k of ['shrine', 'ossa', 'pip', 'lamp', 'wren']) assert.ok(on(P[k], S.LEVELS[S.LEVELS.length - 1]), `${k} on the bottom terrace`);
});
