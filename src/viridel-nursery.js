import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';

// Viridel's pyramid nursery (issue #189, after references/levels/Viridel/environment/explorations/pyramid-nursery): Oro
// grows pyramids, and the meadow west of the walk up to the Greenhouse is where they are grown, not a scatter. By age,
// north from the seed row: beds of knee-high seedlings, a row of sprouts (one step), a row of sheds (a stair you walk up),
// then houses in vine scaffolds (ledges to jump) on an arc, three great ones with trees on their terraces (a climb) over it,
// and at the rows' end, by the foot of the water stair, the old one, 44 m, a steep stair up its south face. From its top
// the rows draw the builders' mark across the meadow: three dots over an arc. White androids tend them. Everything that
// stands collides as drawn (scaffolds, trees and androids are drawn only); nothing goes where something already stands.
//
//   buildNursery(scene, terrain, { blocked }) → { pyramids, old: { top, stairFoot }, sights, avoid(x, z, r) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The nursery's plan: the seedling beds, the rows by age, the builders' mark (in glyph units of `unit` m) and the old one. */
export const NURSERY = {
  seedlings: { x0: 30, x1: 82, rows: [98, 103.5, 109], bed: 6.5 },
  sprouts: { z: 114, x0: 31, x1: 82, step: 6.4 },
  sheds: { z: 121, x0: 33, x1: 80, step: 9.5 },
  mark: { x: 48, z: 166, unit: 18 },
  old: { x: 18, z: 240, size: 54, steps: 8, rise: 5.5 },
};
/** The ages: footprint (m), steps, and the rise of a step. */
export const AGES = {
  seedling: { size: 0.8, steps: 3, rise: 0.2 },
  sprout: { size: 2.4, steps: 3, rise: 0.5 },
  shed: { size: 6, steps: 5, rise: 0.55 },
  house: { size: 9, steps: 6, rise: 1.25 },
  great: { size: 16, steps: 7, rise: 1.9 },
};
/** The builders' mark, as on the scorch and Talo's post: three dots over an arc (u right, v up). */
const DOTS = [[-1.2, 1.3], [0, 1.65], [1.2, 1.3]], ARC = { v: -1.1, r: 1.8, a0: 0.17 * Math.PI, a1: 0.83 * Math.PI };

const prep = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; };

export function buildNursery(scene, terrain, { blocked = () => false } = {}) {
  const N = NURSERY, H = (x, z) => terrain.heightAt(x, z);
  const stone = [], band = [], soil = [], kerb = [], drawnStone = [], vines = [], trunks = [], crowns = [], androids = [], teal = [];
  const pyramids = [], skipped = [];
  const lowest = (x, z, r) => { let lo = H(x, z); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lo = Math.min(lo, H(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return lo; };
  /** A step pyramid on the ground at (x, z): boxes stacked, the bottom one sunk into the ground's lowest under it. */
  const pyramid = (age, x, z, { yaw = 0, drawn = false, bands = true, cap = true, lift = 0, name = age } = {}) => {
    const A = typeof age === 'string' ? AGES[age] : age, half = A.size / 2;
    if (!drawn && blocked(x, z, half * 1.42 + 0.5)) { skipped.push({ age: name, x, z }); return null; }
    const g0 = lowest(x, z, half * 1.42) + lift, sink = Math.min(1, A.rise * 0.8), base = g0 - sink;
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
    const into = drawn ? drawnStone : stone;
    let y = base;
    for (let i = 0; i < A.steps; i++) {
      const w = A.size * (1 - i / A.steps), h = (i === 0 ? sink : 0) + A.rise + (i === 0 ? H(x, z) + lift - g0 : 0);
      into.push(new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0).applyMatrix4(m));
      // a teal band round every other step's top (the sheet's), part of the collision (it stands 3 cm proud)
      if (bands && !drawn && i % 2 === 1 && A.rise > 0.4) band.push(new THREE.BoxGeometry(w + 0.06, Math.min(0.3, A.rise * 0.25), w + 0.06).translate(0, y + h - Math.min(0.3, A.rise * 0.25) / 2 - 0.12, 0).applyMatrix4(m));
      y += h;
    }
    // the cap: a little teal-tipped stone on the top step
    const cw = A.size / A.steps * 0.6;
    if (cap) {
      into.push(new THREE.BoxGeometry(cw, A.rise * 0.9, cw).translate(0, y + A.rise * 0.45, 0).applyMatrix4(m));
      if (!drawn) teal.push(new THREE.ConeGeometry(cw * 0.45, A.rise * 0.8, 4).rotateY(Math.PI / 4).translate(0, y + A.rise * 1.3, 0).applyMatrix4(m));
    }
    // (ground: the meadow under its middle; step i's top stands (i + 1) rises over it)
    const p = { age: name, x, z, base, ground: H(x, z) + lift, top: y + (cap ? A.rise * 0.9 : 0), size: A.size, steps: A.steps, rise: A.rise, yaw };
    pyramids.push(p);
    return p;
  };
  // a vine scaffold: poles at the corners and up the faces, two rings of bars, leaves climbing (drawn only)
  const scaffold = (p) => {
    const A = AGES[p.age], h = p.top - p.base;
    const m = new THREE.Matrix4().makeRotationY(p.yaw).setPosition(p.x, 0, p.z);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lean = A.size * 0.12;
      const a = V(sx * (A.size / 2 + 0.3), p.base + 1, sz * (A.size / 2 + 0.3)), b = V(sx * lean, p.top + 0.6, sz * lean);
      const d = b.clone().sub(a), len = d.length();
      vines.push(new THREE.CylinderGeometry(0.07, 0.09, len, 5).translate(0, len / 2, 0)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())).translate(a.x, a.y, a.z).applyMatrix4(m));
    }
    for (const t of [0.3, 0.62]) {
      const y = p.base + h * t, r = A.size / 2 * (1 - t) + 0.45;
      for (let s = 0; s < 4; s++) vines.push(new THREE.BoxGeometry(r * 2, 0.08, 0.08).translate(0, y, r).rotateY((s * Math.PI) / 2).applyMatrix4(m));
    }
  };
  // a small umbrella tree on a terrace (drawn only: you climb the pyramid, not the tree)
  const smallTree = (x, y, z, s) => {
    trunks.push(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 4.5 * s, 6).translate(x, y + 2.25 * s, z));
    crowns.push(new THREE.CylinderGeometry(2.6 * s, 2.3 * s, 0.6 * s, 12).translate(x, y + 4.6 * s, z));
  };
  // a white android gardener (the white builders' kind), with a watering can or a pruning pole (drawn only)
  const android = (x, z, yaw, tool) => {
    const y = H(x, z), m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
    const parts = [
      new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6).translate(-0.13, 0.48, 0), new THREE.CylinderGeometry(0.06, 0.06, 0.95, 6).translate(0.13, 0.48, 0),
      new THREE.CapsuleGeometry(0.2, 0.55, 3, 8).translate(0, 1.3, 0), new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5).translate(0, 1.82, 0),
      new THREE.SphereGeometry(0.26, 12, 8).translate(0, 2.1, 0),
      new THREE.CylinderGeometry(0.045, 0.045, 0.75, 5).rotateX(-0.9).translate(-0.3, 1.3, 0.25), new THREE.CylinderGeometry(0.045, 0.045, 0.75, 5).rotateX(-0.9).translate(0.3, 1.3, 0.25),
    ];
    androids.push(...parts.map((g) => g.applyMatrix4(m)));
    teal.push(new THREE.CircleGeometry(0.08, 10).translate(0, 2.12, 0.255).applyMatrix4(m));
    if (tool === 'can') teal.push(new THREE.CylinderGeometry(0.16, 0.18, 0.32, 10).translate(0, 1.2, 0.62).applyMatrix4(m), new THREE.CylinderGeometry(0.025, 0.035, 0.6, 5).rotateX(1.1).translate(0, 1.32, 0.98).applyMatrix4(m));
    else androids.push(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5).rotateX(-0.45).translate(0, 2.1, 1.1).applyMatrix4(m));
  };

  // ---- the seedling beds: kerbed soil, little pyramids knee-high in it (drawn only: you step over them)
  for (const z of N.seedlings.rows) for (let x = N.seedlings.x0; x + N.seedlings.bed <= N.seedlings.x1 + 0.01; x += N.seedlings.bed + 1.4) {
    const cx = x + N.seedlings.bed / 2;
    if (blocked(cx, z, 3.5)) { skipped.push({ age: 'bed', x: cx, z }); continue; }
    const y = H(cx, z);
    kerb.push(new THREE.BoxGeometry(N.seedlings.bed, 0.8, 1.9).translate(cx, y - 0.2, z));   // (solid: you step up into it, 0.2 m)
    soil.push(new THREE.BoxGeometry(N.seedlings.bed - 0.4, 0.06, 1.5).translate(cx, y + 0.23, z));
    for (let k = 0; k < 4; k++) { const sx = x + 0.9 + k * 1.55, j = Math.sin(sx * 3.1 + z) * 0.25; pyramid({ ...AGES.seedling, size: AGES.seedling.size * (0.7 + 0.15 * ((k + Math.round(z)) % 3)) }, sx, z + j, { drawn: true, lift: 0.26, name: 'seedling' }); }
  }
  // ---- the sprouts, then the sheds: a row each, by age
  for (let x = N.sprouts.x0; x <= N.sprouts.x1; x += N.sprouts.step) pyramid('sprout', x, N.sprouts.z, { yaw: 0.06 });
  for (let x = N.sheds.x0; x <= N.sheds.x1; x += N.sheds.step) pyramid('shed', x, N.sheds.z, { yaw: -0.04 });
  // ---- the builders' mark: the great ones are its dots, houses in their scaffolds its arc
  const M = N.mark, at = (u, v) => [M.x - u * M.unit, M.z - v * M.unit];
  const greats = DOTS.map(([u, v]) => pyramid('great', ...at(u, v), { yaw: 0.02 * u })).filter(Boolean);
  const houses = [];
  for (let i = 0; i < 7; i++) {
    const a = ARC.a0 + (ARC.a1 - ARC.a0) * (i / 6);
    const [x, z] = at(Math.cos(a) * ARC.r, ARC.v + Math.sin(a) * ARC.r);
    const p = pyramid('house', x, z, { yaw: Math.PI / 2 - a });
    if (p) { houses.push(p); scaffold(p); }
  }
  for (const g of greats) {   // (trees on its terraces, two a side, the sheet's)
    const A = AGES.great;
    for (const [i, s] of [[2, 1], [4, -1]]) { const w = A.size * (1 - (i + 1) / A.steps) / 2 + A.size / A.steps / 4; smallTree(g.x + s * w, g.ground + A.rise * (i + 1), g.z - w * 0.6, 0.8); smallTree(g.x - s * w * 0.4, g.ground + A.rise * (i + 1), g.z + w, 0.7); }
  }
  // ---- the old one, at the rows' end: its steep stair up the south face, out over the meadow in front
  const O = N.old;
  const old = pyramid({ size: O.size, steps: O.steps, rise: O.rise }, O.x, O.z, { name: 'old', cap: false });
  let oldTop = null, stairFoot = null;
  if (old) {
    // the surface's height dz m in front of its middle: the highest step whose half-width reaches there
    const surface = (dz) => { let y = -Infinity; for (let i = 0; i < O.steps; i++) if (O.size * (1 - i / O.steps) / 2 >= dz) y = old.ground + (i + 1) * O.rise; return y; };
    const topY = old.ground + O.steps * O.rise, lastZ = O.z - O.size / O.steps / 2;
    // (as many steps as reach down to the meadow where the stair's foot comes to rest, its first step a stride up off it)
    const rise = 0.45;
    let n = Math.ceil((topY - H(O.x, O.z - O.size / 2)) / rise);
    while (topY - (n - 1) * rise > H(O.x, lastZ - n * 0.47) + 0.45 && n < 200) n++;
    const z0 = lastZ - n * 0.47;
    for (let j = 0; j < n; j++) {
      const za = z0 + j * 0.47, zb = za + 0.47, ty = topY - (n - 1 - j) * rise;
      if (ty < H(O.x, za) + 0.15) continue;
      const lo = Math.max(surface(O.z - zb), surface(O.z - za), Math.min(H(O.x - 2, za), H(O.x + 2, za), H(O.x, zb)) - 0.6);
      if (ty - lo > 0.05) stone.push(new THREE.BoxGeometry(4, ty - lo, 0.47).translate(O.x, (ty + lo) / 2, (za + zb) / 2));
      stairFoot ??= V(O.x, ty, (za + zb) / 2);
    }
    oldTop = V(O.x, topY, O.z);
    for (const [dx, dz] of [[-8, -6], [9, 4], [-5, 9]]) smallTree(O.x + dx, old.ground + 6 * O.rise, O.z + dz, 1.1);
    for (const [dx, dz] of [[-22, 8], [22, -14], [14, 22], [-16, -22]]) smallTree(O.x + dx, old.ground + 2 * O.rise, O.z + dz, 1.3);
  }
  // ---- the androids, tending
  android(44, 101, 0.2, 'can'); android(63, 111.2, Math.PI, 'can'); android(57.5, 147.5, -2.6, 'pole');

  // ---- into the scene, a mesh a material
  const strata = makeMaterial({ color: '#f3ead8', color2: '#f2c5b0', color3: '#e7d8b6', mode: MODE_STRATA, strataSize: 1.2, flat: true, grid: 1.25 });
  const add = (list, mat, name, o = {}) => { if (!list.length) return null; const m = new THREE.Mesh(mergeGeometries(list.map(prep)), mat); m.name = name; Object.assign(m.userData, o); scene.add(m); return m; };
  add(stone, strata, 'The pyramid nursery');
  add(band, makeMaterial({ color: '#62c3c9', flat: true }), 'The pyramid nursery’s bands');
  add(kerb, makeMaterial({ color: '#f8f6f0', flat: true }), 'The pyramid nursery’s seedling beds');
  add(soil, makeMaterial({ color: '#7a5a3c', flat: true }), 'The pyramid nursery’s seedling beds’ earth');
  add(drawnStone, strata, 'The pyramid nursery’s seedlings', { noCollide: true, flora: true });
  add(teal, makeMaterial({ color: '#62c3c9', flat: true }), 'The pyramid nursery’s caps', { noCollide: true, flora: true });
  add(vines, makeMaterial({ color: '#6f9a4e', flat: true }), 'The pyramid nursery’s vine scaffolds', { noCollide: true, flora: true });
  add(trunks, makeMaterial({ color: '#c98a76', flat: true }), 'The pyramid nursery’s terrace trees', { noCollide: true, flora: true });
  add(crowns, makeMaterial({ color: '#7fcfa8', color2: '#9fd6c9', flat: true }), 'The pyramid nursery’s terrace trees’ crowns', { noCollide: true, flora: true });
  add(androids, makeMaterial({ color: '#fbf8f0', flat: true }), 'The pyramid nursery’s android gardeners', { noCollide: true, flora: true });

  const sights = [];
  if (oldTop) sights.push({ name: 'the old pyramid’s top', at: oldTop.clone() });
  sights.push({ name: 'the pyramid nursery’s seedling beds', at: V(56, H(56, 103.5), 103.5) });
  if (greats[1]) sights.push({ name: 'the great pyramids', at: V(greats[1].x, greats[1].top, greats[1].z) });
  return {
    pyramids, greats, houses, skipped, sights,
    old: old ? { ...old, top: oldTop, stairFoot } : null,
    /** (x, z) within r of a pyramid, a bed or the old one's stair (the flora keeps off them) */
    avoid: (x, z, r = 0) => pyramids.some((p) => p.age !== 'seedling' && Math.abs(x - p.x) < p.size / 2 + 0.8 + r && Math.abs(z - p.z) < p.size / 2 + 0.8 + r)
      || (old && Math.abs(x - O.x) < 2.6 + r && z < O.z && z > O.z - O.size / 2 - 22 - r)
      || N.seedlings.rows.some((rz) => Math.abs(z - rz) < 1.2 + r && x > N.seedlings.x0 - r && x < N.seedlings.x1 + r),
  };
}
