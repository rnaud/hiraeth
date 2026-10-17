import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLASS_ATTR } from './dune-glass-shader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODE_TERRAIN } from './materials.js';

// ---------------------------------------------------------------------------
// The Glass Dunes' big masses (issue #393): the pieces the reference plates are
// made of, so the new places fill their frames the way the plates do: towers with
// scalloped tops, stacked set-back blocks crowded with small deep openings, lumpy
// eroded rock with dwellings carved into it, faceted crystal columns, and pale
// floors laid over the sand. Every piece goes through RoomKit.add, so a place costs
// a draw call per material however many pieces it has; openings are not solid
// (the player walks against the wall behind them) and cast no shadow.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
/** Move a geometry: scale, then yaw, then position. */
const place = (g, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(sx, sy, sz)));
const OPEN = { solid: false, shadow: false };

/** The materials the masses use beside a place's own stone and trim: dark openings, lamplit ones. */
export function massMaterials(kit, M, { hole = '#34403f', lit = '#f2b85a', rock = null } = {}) {
  return {
    ...M,
    hole: kit.mat({ color: hole, line: 0.2, hatch: 0, shade: 0.1 }),
    lit: kit.mat({ color: lit, glow: 0.9, line: 0.2, hatch: 0, shade: 0.1 }),
    ...(rock ? { rock: kit.mat(rock) } : {}),
  };
}

/** An opening on a wall (a dark recess, or a lit window): a thin plate standing just proud of the face. */
export function hole(kit, mat, x, y, z, yaw, w, h, { arch = false } = {}) {
  kit.add(mat, place(new THREE.BoxGeometry(w, h, 0.04), x, y + h / 2, z, yaw), OPEN);
  if (arch) kit.add(mat, place(new THREE.CylinderGeometry(w / 2, w / 2, 0.04, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2), x, y + h, z, yaw), OPEN);
}

/** Rounded merlons round a circle (the plates' scalloped tops) on a corbelled lip. */
export function scallopRing(kit, mat, x, y, z, r, { size = 0.9, lip = 0.7, rng = Math.random } = {}) {
  kit.add(mat, place(new THREE.CylinderGeometry(r + lip, r, 1.4, 18, 1), x, y + 0.7, z));
  const n = Math.max(6, Math.round(TAU * (r + lip) / (size * 2.3)));
  for (let i = 0; i < n; i++) {
    if (rng() < 0.12) continue;   // (a broken one here and there)
    const a = (i + 0.5) / n * TAU, s = size * (0.85 + rng() * 0.3);
    kit.add(mat, place(new THREE.SphereGeometry(1, 7, 4, 0, TAU, 0, Math.PI / 2), x + Math.cos(a) * (r + lip - s * 0.4), y + 1.4, z + Math.sin(a) * (r + lip - s * 0.4), -a, s, s * 1.25, s * 0.7));
  }
}

/** Rounded merlons along the top edges of a box (w across x, d across z, turned by yaw). */
export function scallopBox(kit, mat, x, y, z, w, d, yaw = 0, { size = 0.9, rng = Math.random } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  kit.add(mat, place(new THREE.BoxGeometry(w + 1.2, 1.3, d + 1.2), x, y + 0.65, z, yaw));
  for (const [len, other, along] of [[w, d, true], [d, w, false]]) for (const side of [-1, 1]) {
    const n = Math.max(2, Math.round(len / (size * 2.4)));
    for (let i = 0; i < n; i++) {
      if (rng() < 0.12) continue;
      const t = ((i + 0.5) / n - 0.5) * len, e = side * (other / 2 + 0.6 - size * 0.35);
      const [px, pz] = along ? at(t, e) : at(e, t), k = size * (0.85 + rng() * 0.3);
      kit.add(mat, place(new THREE.SphereGeometry(1, 7, 4, 0, TAU, 0, Math.PI / 2), px, y + 1.3, pz, yaw + (along ? 0 : Math.PI / 2), k, k * 1.25, k * 0.6));
    }
  }
}

/**
 * A round tower: a slightly tapered drum, a scalloped top, small deep openings (a few lit) and,
 * sometimes, a narrower drum set back on top. Returns its top height.
 */
export function roundTower(kit, M, { x, y, z, r, h, seed = 1, upper = 0, windows = 0.5 }) {
  const rng = mulberry32(seed);
  kit.add(M.stone, place(new THREE.CylinderGeometry(r * 0.94, r * 1.04, h, 16, 3), x, y + h / 2, z));
  // a girdle part-way up: the plates' towers are built in courses
  if (h > 18) kit.add(M.trim, place(new THREE.CylinderGeometry(r * 1.0, r * 1.0, 0.8, 16), x, y + h * (0.45 + rng() * 0.15), z));
  scallopRing(kit, M.stone, x, y + h, z, r * 0.94, { rng, size: Math.max(0.8, r * 0.2) });
  openingsRound(kit, M, x, y, z, r, h, rng, windows);
  if (upper) {
    const r2 = r * (0.5 + rng() * 0.15), h2 = upper, dx = (rng() - 0.5) * r * 0.5, dz = (rng() - 0.5) * r * 0.5;
    kit.add(M.stone, place(new THREE.CylinderGeometry(r2 * 0.92, r2, h2, 14, 2), x + dx, y + h + 1.4 + h2 / 2, z + dz));
    scallopRing(kit, M.stone, x + dx, y + h + 1.4 + h2, z + dz, r2 * 0.92, { rng, size: Math.max(0.7, r2 * 0.2) });
    openingsRound(kit, M, x + dx, y + h + 1.4, z + dz, r2, h2, rng, windows * 0.6);
    return y + h + 1.4 + h2 + 2.4;
  }
  return y + h + 2.4;
}

function openingsRound(kit, M, x, y, z, r, h, rng, k) {
  // (on the middle of a face of the 16-sided drum, just proud of it, so the opening lies on the wall)
  const rows = Math.floor((h - 3) / 4.2);
  for (let j = 0; j < rows; j++) for (let i = 0; i < 16; i++) {
    if (rng() > k * 0.55) continue;
    const a = (i + 0.5) / 16 * TAU, yy = y + 3 + j * 4.2 + rng() * 0.8, rr = r * (1.04 - 0.1 * ((yy - y) / h)) * Math.cos(Math.PI / 16) + 0.012;
    const lit = rng() < 0.12;
    hole(kit, lit ? M.lit : M.hole, x + Math.sin(a) * rr, yy, z + Math.cos(a) * rr, a, 0.6 + rng() * 0.35, 1.0 + rng() * 0.7, { arch: rng() < 0.5 });
  }
}

/** A square tower (or a block of rooms): set-back storeys, a scalloped or broken top, small openings on every face. */
export function squareTower(kit, M, { x, y, z, w, d, h, yaw = 0, seed = 1, steps = 2, scallop = true, windows = 0.5, color = 'stone' }) {
  const rng = mulberry32(seed);
  let yy = y, ww = w, dd = d, ox = 0, oz = 0;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let k = 0; k < steps; k++) {
    const hh = k === steps - 1 ? h - (yy - y) : h * (0.45 + rng() * 0.2) / Math.max(1, steps - 1) * (steps > 2 ? 1 : 1.2);
    const cx = x + ox * c + oz * s, cz = z - ox * s + oz * c;
    kit.add(M[color], place(new THREE.BoxGeometry(ww, hh, dd), cx, yy + hh / 2, cz, yaw));
    openingsBox(kit, M, cx, yy, cz, ww, dd, hh, yaw, rng, windows);
    if (k < steps - 1) {
      kit.add(M.trim, place(new THREE.BoxGeometry(ww + 0.5, 0.6, dd + 0.5), cx, yy + hh, cz, yaw));
      // the next storey set back toward one corner, the roof left as a terrace
      const nw = ww * (0.62 + rng() * 0.2), nd = dd * (0.62 + rng() * 0.2);
      ox += (rng() < 0.5 ? -1 : 1) * (ww - nw) / 2 * rng(); oz += (rng() < 0.5 ? -1 : 1) * (dd - nd) / 2 * rng();
      ww = nw; dd = nd;
    }
    yy += hh;
  }
  const cx = x + ox * c + oz * s, cz = z - ox * s + oz * c;
  if (scallop) scallopBox(kit, M[color], cx, yy, cz, ww, dd, yaw, { rng, size: Math.max(0.8, Math.min(ww, dd) * 0.12) });
  return yy + 2;
}

function openingsBox(kit, M, x, y, z, w, d, h, yaw, rng, k) {
  const rows = Math.floor((h - 2.5) / 4);
  for (const [face, len, off] of [[0, w, d / 2], [Math.PI / 2, d, w / 2], [Math.PI, w, d / 2], [-Math.PI / 2, d, w / 2]]) {
    const a = yaw + face, nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
    const cols = Math.max(1, Math.floor(len / 3.6));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (rng() > k * 0.6) continue;
      const u = ((i + 0.5) / cols - 0.5) * len * 0.86 + (rng() - 0.5) * 0.8, yy = y + 2.4 + j * 4 + rng() * 0.6;
      const lit = rng() < 0.1;
      hole(kit, lit ? M.lit : M.hole, x + nx * (off + 0.012) + tx * u, yy, z + nz * (off + 0.012) + tz * u, a, 0.55 + rng() * 0.4, 0.9 + rng() * 0.8, { arch: rng() < 0.35 });
    }
  }
}

/**
 * A street block of the buried city: a core with rooms stacked out of it at every storey (boxes of
 * all sizes jutting from the faces, set back and overhanging), small lit and dark openings, balconies.
 * front: the yaw its street face looks along (+z turned by yaw).
 */
export function crowdedBlock(kit, M, { x, y = 0, z, w, d, h, yaw = 0, seed = 1, lit = 0.25, from = 4.5, clear = null }) {
  const rng = mulberry32(seed), c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  const wall = M.wall ?? M.stone;
  kit.add(wall, place(new THREE.BoxGeometry(w * 0.74, h, d * 0.74), x, y + h / 2, z, yaw));
  // the ground storey: the whole footprint, a door and a few openings
  kit.add(wall, place(new THREE.BoxGeometry(w * 0.94, from, d * 0.94), x, y + from / 2, z, yaw));
  for (let yy = y + from; yy < y + h - 3; yy += 2.6 + rng() * 3.4) {
    // rooms jutting from each face, as far as the footprint's edge or a little over: the street face most
    for (const [face, len, depth, n] of [[0, w, d, 3], [Math.PI, w, d, 1], [Math.PI / 2, d, w, 2], [-Math.PI / 2, d, w, 2]]) {
      const count = Math.round(n * (0.4 + rng()));
      for (let i = 0; i < count; i++) {
        const bw = 1.8 + rng() * Math.min(6.5, len * 0.42), bh = 2 + rng() * 5.5;
        const outer = depth / 2 + rng() * 0.7, bd = outer - depth * 0.37 + 0.2;
        const u = (rng() - 0.5) * (len - bw), a = yaw + face, nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
        const off = outer - bd / 2;
        const px = x + nx * off + tx * u, pz = z + nz * off + tz * u;
        if (clear && clear(px, yy, pz, Math.max(bw, bd) / 2)) continue;   // (over a walk: left out)
        const mat = rng() < 0.3 ? M.trim : wall;
        kit.add(mat, place(new THREE.BoxGeometry(bw, bh, bd), px, yy + bh / 2, pz, a));
        // its opening: dark, or lamplit amber
        if (rng() < 0.7) {
          const ow = 0.45 + rng() * 0.45, oh = 0.7 + rng() * 1.0;
          hole(kit, rng() < lit ? M.lit : M.hole, px + nx * (bd / 2 + 0.012) + tx * (rng() - 0.5) * Math.max(0, bw - 1.2), yy + 0.5 + rng() * Math.max(0.2, bh - oh - 1), pz + nz * (bd / 2 + 0.012), a, ow, oh);
        }
        // a slab under it now and then: a ledge
        if (rng() < 0.2) kit.add(M.trim, place(new THREE.BoxGeometry(bw + 0.5, 0.3, bd + 0.5), px, yy - 0.15, pz, a));
      }
    }
  }
  // a door and small openings in the street face's ground storey
  const nx = Math.sin(yaw), nz = Math.cos(yaw), tx = Math.cos(yaw), tz = -Math.sin(yaw), fo = d * 0.47 + 0.012;
  hole(kit, M.door ?? M.hole, x + nx * fo + tx * (rng() - 0.5) * w * 0.5, y, z + nz * fo + tz * (rng() - 0.5) * w * 0.5, yaw, 1.3, 2.6);
  for (let i = 0; i < 3; i++) if (rng() < 0.6) { const u = (rng() - 0.5) * w * 0.8; hole(kit, rng() < lit ? M.lit : M.hole, x + nx * fo + tx * u, y + 1.4, z + nz * fo + tz * u, yaw, 0.5, 0.8); }
  // a ragged top: boxes of different heights
  for (let i = 0; i < 5; i++) {
    const bw = w * (0.18 + rng() * 0.3), bd = d * (0.18 + rng() * 0.3), bh = 1.5 + rng() * 6;
    const [px, pz] = at((rng() - 0.5) * (w * 0.74 - bw), (rng() - 0.5) * (d * 0.74 - bd));
    kit.add(wall, place(new THREE.BoxGeometry(bw, bh, bd), px, y + h + bh / 2, pz, yaw));
  }
}

/** A lump of eroded rock: a squashed, wobbled sphere (merged with the rest of its material). */
export function lump(kit, mat, x, y, z, sx, sy, sz, seed = 1, { solid = true, detail = 1 } = {}) {
  const rng = mulberry32(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position;
  const k1 = rng() * 6, k2 = rng() * 6;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const f = 1 + 0.13 * Math.sin(vx * 3.1 + k1) * Math.cos(vz * 2.7 + k2) + 0.08 * Math.sin(vy * 4.3 + k2);
    p.setXYZ(i, vx * f, Math.max(vy * f, -0.55), vz * f);   // (a flattened foot: it sits on what is under it)
  }
  g.computeVertexNormals();
  kit.add(mat, place(g, x, y, z, rng() * TAU, sx, sy, sz), { solid });
}

/**
 * A rock dwelling (the courtyard plate): a rounded block of pale rock, lumps piled on its shoulders and
 * corners, doors and small windows carved in its front (+z turned by yaw), sometimes a second storey.
 */
export function rockDwelling(kit, M, { x, y, z, w, d, h, yaw = 0, seed = 1, door = 'hole', windows = 3 }) {
  const rng = mulberry32(seed), c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  kit.add(M.rock, place(new THREE.BoxGeometry(w, h, d, 1, 1, 1), x, y + h / 2, z, yaw));
  // lumps on its corners and along its top: the block reads as weathered rock
  for (const [u, v] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]) {
    const [px, pz] = at(u * w * 0.92, v * d * 0.92), r = Math.min(w, d) * (0.22 + rng() * 0.12);
    lump(kit, M.rock, px, y + h * (0.25 + rng() * 0.5), pz, r, h * (0.35 + rng() * 0.3), r, seed * 7 + u * 3 + v);
  }
  for (let i = 0; i < 3; i++) {
    const [px, pz] = at((rng() - 0.5) * w * 0.8, (rng() - 0.5) * d * 0.6), r = Math.min(w, d) * (0.25 + rng() * 0.2);
    lump(kit, rng() < 0.3 ? M.trim : M.rock, px, y + h - r * 0.35, pz, r * 0.95, r * (0.8 + rng() * 0.7), r * 0.9, seed * 13 + i);
  }
  const fx = Math.sin(yaw), fz = Math.cos(yaw), tx = Math.cos(yaw), tz = -Math.sin(yaw);
  const face = (u, yy, ww, hh, mat, arch) => hole(kit, mat, x + fx * (d / 2 + 0.012) + tx * u, yy, z + fz * (d / 2 + 0.012) + tz * u, yaw, ww, hh, { arch });
  if (door) face((rng() - 0.5) * w * 0.4, y, 1.3, 2.5, M[door] ?? M.hole, rng() < 0.4);
  for (let i = 0; i < windows; i++) face((rng() - 0.5) * w * 0.75, y + 3.2 + rng() * Math.max(0.5, h - 5), 0.55 + rng() * 0.3, 0.8 + rng() * 0.5, rng() < 0.15 ? M.gold ?? M.lit : M.hole, false);
}

/**
 * A faceted crystal column (the prism plates): an irregular prism of 5-7 flat faces, its top cut on a
 * slant, each face its own shade of green, drawn with the dune glass.
 */
export function crystalColumn(geoms, { x, y, z, r, h, seed = 1, tones, lean = 0.06 }) {
  const rng = mulberry32(seed), n = 5 + Math.floor(rng() * 3), ring = [];
  for (let i = 0; i < n; i++) { const a = (i + rng() * 0.6) / n * TAU; ring.push([Math.cos(a) * r * (0.75 + rng() * 0.35), Math.sin(a) * r * (0.75 + rng() * 0.35)]); }
  const cut = [(rng() - 0.5) * 0.9, (rng() - 0.5) * 0.9];
  const lx = (rng() - 0.5) * lean * h, lz = (rng() - 0.5) * lean * h;
  const pos = [], col = [], glass = [];
  const tri = (a, b, c, ta, tb, tc, shine) => { for (const [p, t] of [[a, ta], [b, tb], [c, tc]]) { pos.push(...p); col.push(t.r, t.g, t.b); glass.push(100, shine, 0.75, Math.min(1, Math.max(0, (p[1] - y) / h))); } };
  const C = tones.map((t) => new THREE.Color(t)), EDGE = new THREE.Color('#e4fbe9');
  // stacked segments, each a little narrower and set over (the plates' columns step in, with ledges)
  const segs = 1 + Math.floor(rng() * 3), cuts = [y - 2];
  for (let k = 1; k < segs; k++) cuts.push(y + h * (k / segs) * (0.8 + rng() * 0.3));
  cuts.push(y + h);
  for (let k = 0; k < segs; k++) {
    const sc = 1 - k * 0.14, ox = lx * (k / segs) + (rng() - 0.5) * r * 0.15, oz = lz * (k / segs) + (rng() - 0.5) * r * 0.15;
    const y0 = cuts[k], last = k === segs - 1;
    const at = (i, yy) => [x + ring[i][0] * sc + ox, yy, z + ring[i][1] * sc + oz];
    const top = (i) => last ? cuts[k + 1] + (ring[i][0] / r * cut[0] + ring[i][1] / r * cut[1]) * r * 2 : cuts[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, A0 = at(i, y0), B0 = at(j, y0), A1 = at(i, top(i)), B1 = at(j, top(j));
      // each face in three strips: its edges lighter, as the plates' bevelled crystal
      const base = C[Math.floor(rng() * C.length)].clone().multiplyScalar(0.8 + rng() * 0.35), edge = base.clone().lerp(EDGE, 0.45), shine = 0.08 + rng() * 0.3;
      const mix = (P, Q, t) => P.map((v, q) => v + (Q[q] - v) * t);
      const e = 0.12 + rng() * 0.08;
      const L0 = mix(A0, B0, e), R0 = mix(A0, B0, 1 - e), L1 = mix(A1, B1, e), R1 = mix(A1, B1, 1 - e);
      tri(A0, L0, L1, edge, base, base, shine); tri(A0, L1, A1, edge, base, edge, shine);
      tri(L0, R0, R1, base, base, base, shine); tri(L0, R1, L1, base, base, base, shine);
      tri(R0, B0, B1, base, edge, edge, shine); tri(R0, B1, R1, base, edge, base, shine);
    }
    // its top: a flat ledge, the last one a slanted cut, barely peaked
    const cx = x + ox, cz = z + oz, cy = last ? cuts[k + 1] + r * 0.06 * rng() : cuts[k + 1], tone = C[C.length - 1].clone().lerp(EDGE, 0.3);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(at(i, top(i)), [cx, cy, cz], at(j, top(j)), tone, tone, tone, 0.4); }
  }
  // wind the faces outward (the ring goes counter-clockwise seen from above)
  for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute(GLASS_ATTR, new THREE.Float32BufferAttribute(glass, 4));
  g.computeVertexNormals();
  geoms.push(g);
  return g;
}

/** A sand floor's material, the world's own ground shading (ripples, wind strokes) in paler colours. */
export const floorMaterial = (kit, [c1, c2, c3]) => kit.mat({ color: c1, color2: c2, color3: c3, mode: MODE_TERRAIN, ripples: true, sandInk: true, shade: 0.6, shadeHue: 0.5 });

/**
 * A pale floor laid over the sand (the plates' bright floors): a sheet following the ground a few
 * centimetres above it, inside a rounded rectangle (its corners rounded off).
 */
export function paleFloor(kit, mat, ground, { x, z, w, d, yaw = 0, cell = 2, lift = 0.06, round = 0.35, clear = null }) {
  const nx = Math.ceil(w / cell), nz = Math.ceil(d / cell), c = Math.cos(yaw), s = Math.sin(yaw);
  const pos = [], idx = [], keep = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = (i / nx - 0.5) * w, v = (j / nz - 0.5) * d, px = x + u * c + v * s, pz = z - u * s + v * c;
    // a superellipse: the corners rounded off so the floor has no hard rectangle
    const e = Math.pow(Math.abs(2 * u / w), 2 / round) + Math.pow(Math.abs(2 * v / d), 2 / round);
    keep.push(e <= 1 && !(clear && clear(px, pz)));
    pos.push(px, ground.heightAt(px, pz) + lift, pz);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, dd = cc + 1;
    if (keep[a] && keep[b] && keep[cc] && keep[dd]) idx.push(a, cc, b, b, cc, dd);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (solid: the traveller walks on it, a few centimetres over the sand, so what is drawn is what is stood on)
  kit.add(mat, g, { shadow: false });
}

/** Rubble: low broken blocks and fallen lumps strewn over an area, clear of the given walks. */
export function rubble(kit, mat, ground, { x, z, r, n = 20, seed = 1, clear = () => false, size = 1, y = null }) {
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, rr = Math.sqrt(rng()) * r, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    if (clear(px, pz)) continue;
    const k = size * (0.4 + rng() * 1.1), py = y ?? ground.heightAt(px, pz);
    if (rng() < 0.5) kit.add(mat, place(new THREE.BoxGeometry(k * 1.6, k * 0.7, k), px, py + k * 0.25, pz, rng() * TAU));
    else lump(kit, mat, px, py + k * 0.15, pz, k, k * 0.6, k * 0.8, seed * 31 + i, { detail: 0 });
  }
}

/**
 * A small whitewashed house (the painted quarter): a rounded-cornered drum with a flat roof and a low
 * parapet, a door and a window or two in its front (+z turned by yaw), sometimes a spire. Light: 20
 * segments round, so a hillside of them stays cheap.
 */
export function cottage(kit, M, { x, y, z, w, d, h, yaw = 0, seed = 1, color = 'stone', spire = false, windows = 2 }) {
  const rng = mulberry32(seed), n = 20, e = 0.42, pos = [], idx = [];
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, cx = Math.cos(a), sz = Math.sin(a);
    ring.push([Math.sign(cx) * Math.pow(Math.abs(cx), e) * w / 2, Math.sign(sz) * Math.pow(Math.abs(sz), e) * d / 2]);
  }
  const top = (i) => h + 0.25 * Math.sin(i * 1.7 + seed);
  for (const [k, yy] of [[0, -1], [1, null]]) for (let i = 0; i < n; i++) pos.push(ring[i][0], yy ?? top(i), ring[i][1]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j, j, n + i, n + j); }
  const c = pos.length / 3; pos.push(0, h - 0.15, 0);
  for (let i = 0; i < n; i++) idx.push(c, (i + 1) % n + n, i + n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  kit.add(M[color], place(g, x, y, z, yaw));
  if (spire) kit.add(M.stone, place(new THREE.LatheGeometry([[0, 0], [1.4, 0], [1.35, 0.9], [1.05, 2.2], [0.6, 3.4], [0.2, 4.1], [0, 4.3]].map(([r, hh]) => new THREE.Vector2(r * Math.min(w, d) / 4, hh * Math.min(w, d) / 4)), 10), x + (rng() - 0.5) * w * 0.3, y + h - 0.2, z + (rng() - 0.5) * d * 0.3));
  const fx = Math.sin(yaw), fz = Math.cos(yaw), tx = Math.cos(yaw), tz = -Math.sin(yaw), f = d / 2 + 0.015;
  const at = (u, yy, ww, hh, mat) => hole(kit, mat, x + fx * f + tx * u, y + yy, z + fz * f + tz * u, yaw, ww, hh);
  at((rng() - 0.5) * w * 0.4, 0, 0.9, 2.1, M.door ?? M.ochre);
  for (let i = 0; i < windows; i++) at((rng() - 0.5) * w * 0.7, 2.6 + rng() * Math.max(0.2, h - 4), 0.45, 0.7, M.window ?? M.ochre);
}
