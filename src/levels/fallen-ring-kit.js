import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, createNoise2D } from '../noise.js';
import { FORM } from '../materials.js';
import { keepForm } from '../form.js';
import { taper } from './wood-kit.js';
import { layeredCrown, leafCrown } from './garden-kit.js';
import { cloth, stall } from './salt-harbour-kit.js';
import { trussStair, bar } from './antennas-kit.js';
import { lumpy } from './sky-stones-kit.js';

// ---------------------------------------------------------------------------
// The Fallen Ring's shapes, shared by the world (fallen-ring.js) and its reference views (reference-fallenring.js),
// after the pictures (references/The Fallen Ring/reference-1 … 4): a broken orbital ring lying across a sage-green
// plain, its colossal curved segments standing as arches into the sky, lying in the grass as tubes, tilted on their
// broken ends; their cut sections showing the streets and parks inside; the lowest segment a village with awnings
// and warm windows; grazing animals; trees growing from the hull's seams; weathered ivory and faded vermilion.
//
//   ringSegment   a length of the ring: a tube of superellipse section swept along an arc, its broken ends ragged,
//                 painted bands, openings in its skin (the exposed interior: the inner wall, floors, ribs), the
//                 joints between its segments; built in the arc's own frame and placed by a matrix (ringPose)
//   ringPose      the matrix that stands an arc up as an arch, lays it on the ground or tilts it
//   tree          an umbrella tree: a leaning trunk, a layered crown
//   village       a row of houses built against a hull's foot: cabins with lit windows, upper storeys,
//                 awnings, stalls, lanterns, crates
//   grazer        a woolly grazing beast, head down (instanced by the world, merged by the views)
//   cloudBank     the pictures' great cumulus: lumpy puffs piled in banks far off (instanced)
// Each returns plain geometries by role (no materials): hull (ivory), red (vermilion), cut (the wall's thickness at a
// break), inner (the inside wall), floor, frame (ribs, rails: thin dark metal), joint (the collars between segments),
// green (foliage), bark, plaster, wood, dark, glow (lit windows), cloth, cloth2, goods, wool.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const nR = createNoise2D(61001), nT = createNoise2D(61002);
const unindexed = (g) => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; };
/** Merge a list of geometries (or null for none). */
export const merged = (list) => (list.length ? mergeGeometries(list.map((g) => { const n = unindexed(g); if (!n.attributes.normal) n.computeVertexNormals(); return n; })) : null);
const roles = () => ({ hull: [], red: [], cut: [], inner: [], floor: [], frame: [], joint: [], green: [], bark: [], plaster: [], wood: [], dark: [], glow: [], cloth: [], cloth2: [], goods: [], wool: [] });
/** Every role of b appended to a's. */
export function gather(a, b) { for (const [k, v] of Object.entries(b)) if (Array.isArray(v) && (!v.length || v[0]?.isBufferGeometry)) (a[k] ??= []).push(...v); return a; }
/** Each geometry of every role moved by f(g) (in place), the parts returned. */
export function moveParts(parts, f) { for (const v of Object.values(parts)) if (Array.isArray(v)) for (const g of v) if (g?.isBufferGeometry) f(g); return parts; }

// ------------------------------------------------------------------ the ring
/** A superellipse's point at angle phi: [radial, across], half-sizes rh (radial) and rw (across), exponent n. */
const sup = (phi, rh, rw, n) => { const c = Math.cos(phi), s = Math.sin(phi), e = 2 / n; return [rh * Math.sign(c) * Math.abs(c) ** e, rw * Math.sign(s) * Math.abs(s) ** e]; };
/** Within a wrapped range [s0, s1] of the section (0..1, s1 < s0 wraps through 0). */
const inS = (s, [s0, s1]) => (s0 <= s1 ? s >= s0 && s <= s1 : s >= s0 || s <= s1);

/**
 * A length of the ring, in the arc's own frame: its centre line the circle of radius R round the origin in the xy plane,
 * from angle a0 to a1 (rad, a1 > a0); its section a superellipse (exponent `round`: 2 round, 4 a rounded box) of
 * radial thickness h and width w (along z). The section's angle s (0..1): 0 the outer face (away from the ring's
 * centre), 0.25 the +z side, 0.5 the inner face, 0.75 the -z side.
 *   seg      the arc's rows: metres a row (along the centre line), or { n }
 *   sseg     the section's columns
 *   bands    [{ t: [t0, t1] (the arc's share, 0..1), s: [s0, s1] }]: painted vermilion
 *   open     [{ t, s, floors, ribs }]: the skin cut away there, the inside shown (the inner wall, the wall's thickness
 *            round the cut, ribs across it, floors inside)
 *   ends     { 0: { rag, deep }, 1: { … } }: a broken end, ragged by `rag` m, the inside shown `deep` m into it;
 *            false: closed (a cap), absent: open and clean
 *   wall     the skin's thickness (m)
 *   floors   'r' (the habitat's: concentric, across z) | 'z' (level: across the radius, for a tube lying down)
 *   joints   metres between the collars between segments (0: none)
 * { ...roles, at(t, s, out = 0) → { p, n } (a point of the skin and its outward normal), rows, length }.
 */
export function ringSegment({ R = 300, a0 = 0, a1 = 1, w = 40, h = 40, round = 3, seg = 6, sseg = 28, bands = [], open = [], ends = {}, wall = 1.6, floors = 'r', nFloors = 4, joints = 0, seed = 1, detail = 1, holes = 0, wrap = true } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 7919) + 5);
  const L = R * (a1 - a0), rows = typeof seg === 'object' ? seg.n : Math.max(2, Math.ceil(L / (seg / detail))), cols = Math.max(8, Math.round(sseg * Math.min(1, 0.5 + detail * 0.5)));
  const rh = h / 2, rw = w / 2;
  // the broken ends: each column's end pushed back along the arc by a ragged amount (m)
  const ragAt = (k, j) => { const e = ends[k]; if (!e) return 0; return e.rag * (0.5 + 0.5 * nR(j * 0.55 + k * 17 + seed, seed * 3.1)) + e.rag * 0.25 * Math.abs(nR(j * 2.3 + seed, k * 5 + 9)); };
  const angle = (i, j, inner = 0) => {
    const t = i / rows; let a = a0 + (a1 - a0) * t;
    if (i === 0) a += (ragAt(0, j) + inner) / R;
    if (i === rows) a -= (ragAt(1, j) + inner) / R;
    return a;
  };
  /** The point at arc angle a, section angle phi (rad), offset `inset` m inward (the inside wall). */
  const point = (a, phi, inset = 0, target = new THREE.Vector3()) => {
    const [sr, sz] = sup(phi, Math.max(0.1, rh - inset), Math.max(0.1, rw - inset), round), c = Math.cos(a), s = Math.sin(a), r = R + sr;
    return target.set(c * r, s * r, sz);
  };
  const phiOf = (j) => (j / cols) * TAU;
  const tOf = (i) => i / rows;
  // which faces are painted, cut away
  const red = (i, j) => bands.some((b) => tOf(i + 0.5) >= b.t[0] && tOf(i + 0.5) <= b.t[1] && inS((j + 0.5) / cols, b.s));
  const opening = (i, j) => open.find((o) => tOf(i + 0.5) >= o.t[0] && tOf(i + 0.5) <= o.t[1] && inS((j + 0.5) / cols, o.s));
  const hole = (i, j) => holes > 0 && (i < 3 || i >= rows - 3) && nT(i * 0.9 + seed, j * 0.7) > 1 - holes;
  // ---- the skin: a grid of rows × cols, the outward normal by winding (∂a × ∂φ)
  const grid = (inset, flip, keep, list, formed = wrap) => {
    const pos = [], form = formed ? [] : null, axis = formed ? [] : null, p = new THREE.Vector3();
    const quad = (i, j) => {
      const A = [i, j], B = [i + 1, j], C = [i + 1, j + 1], D = [i, j + 1];
      const tri = flip ? [A, C, B, A, D, C] : [A, B, D, B, C, D];
      for (const [ii, jj] of tri) {
        const a = angle(ii, jj % cols, inset > 0 ? (ends[ii === 0 ? 0 : 1]?.deep ?? 0) * 0 : 0);
        point(a, phiOf(jj), inset, p); pos.push(p.x, p.y, p.z);
        if (form) { form.push(Math.cos(a) * R, Math.sin(a) * R, 0, FORM.kinds.wrap); axis.push(-Math.sin(a), Math.cos(a), 0); }
      }
    };
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (keep(i, j)) quad(i, j);
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (form) { g.setAttribute('aFormC', new THREE.Float32BufferAttribute(form, 4)); g.setAttribute('aFormA', new THREE.Float32BufferAttribute(axis, 3)); keepForm(g); }
    g.computeVertexNormals();
    list.push(g);
  };
  grid(0, false, (i, j) => !red(i, j) && !opening(i, j) && !hole(i, j), out.hull);
  grid(0, false, (i, j) => red(i, j) && !opening(i, j) && !hole(i, j), out.red);
  // ---- the inside wall: behind the openings, and some way into each broken end
  const deepRows = (k) => (ends[k] ? Math.ceil((ends[k].deep ?? 20) / (L / rows)) : 0);
  const showInner = (i, j) => opening(i, j) || hole(i, j) || i < deepRows(0) || i >= rows - deepRows(1);
  grid(wall, true, showInner, out.inner, false);
  // ---- the wall's thickness (a quad strip between the skin and the inside wall)
  const lipPos = [];
  const lip = (P, Q, Pi, Qi, want) => {
    const n = new THREE.Vector3().subVectors(Q, P).cross(new THREE.Vector3().subVectors(Pi, P));
    const flip = n.dot(want) < 0, tri = flip ? [P, Pi, Q, Q, Pi, Qi] : [P, Q, Pi, Q, Qi, Pi];
    for (const v of tri) lipPos.push(v.x, v.y, v.z);
  };
  const P = (i, j, inset) => point(angle(i, j % cols), phiOf(j), inset);
  for (const k of [0, 1]) {
    if (!ends[k] && ends[k] !== undefined) continue;
    if (ends[k] === false) continue;
    const i = k ? rows : 0;
    for (let j = 0; j < cols; j++) {
      const a = angle(i, j), want = V(-Math.sin(a), Math.cos(a), 0).multiplyScalar(k ? 1 : -1);
      lip(P(i, j, 0), P(i, j + 1, 0), P(i, j, wall), P(i, j + 1, wall), want);
    }
  }
  // round the openings' borders: wherever a cut face meets a kept one
  const cutAt = (i, j) => i >= 0 && i < rows && (opening(i, (j + cols) % cols) || hole(i, (j + cols) % cols));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (!cutAt(i, j)) continue;
    if (!cutAt(i, j - 1)) lip(P(i, j, 0), P(i + 1, j, 0), P(i, j, wall), P(i + 1, j, wall), point(angle(i, j), phiOf(j - 0.5)).sub(point(angle(i, j), phiOf(j + 0.5))));
    if (!cutAt(i, j + 1)) lip(P(i, j + 1, 0), P(i + 1, j + 1, 0), P(i, j + 1, wall), P(i + 1, j + 1, wall), point(angle(i, j), phiOf(j + 1.5)).sub(point(angle(i, j), phiOf(j + 0.5))));
    if (i > 0 && !cutAt(i - 1, j)) { const a = angle(i, j); lip(P(i, j, 0), P(i, j + 1, 0), P(i, j, wall), P(i, j + 1, wall), V(Math.sin(a), -Math.cos(a), 0)); }
    if (i < rows - 1 && !cutAt(i + 1, j)) { const a = angle(i + 1, j); lip(P(i + 1, j, 0), P(i + 1, j + 1, 0), P(i + 1, j, wall), P(i + 1, j + 1, wall), V(-Math.sin(a), Math.cos(a), 0)); }
  }
  if (lipPos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lipPos, 3)); g.computeVertexNormals(); out.cut.push(g); }
  // ---- closed ends: a cap
  for (const k of [0, 1]) if (ends[k] === false) {
    const a = k ? a1 : a0, ring = Array.from({ length: cols }, (_, j) => point(a, phiOf(j))), c = V(Math.cos(a) * R, Math.sin(a) * R, 0), pos = [], want = V(-Math.sin(a), Math.cos(a), 0).multiplyScalar(k ? 1 : -1);
    for (let j = 0; j < cols; j++) { const A = ring[j], B = ring[(j + 1) % cols], n = B.clone().sub(A).cross(c.clone().sub(A)), f = n.dot(want) < 0; for (const v of f ? [A, c, B] : [A, B, c]) pos.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); out.hull.push(g);
  }
  // ---- the collars between segments
  if (joints > 0) {
    for (let d = joints * (0.5 + rng() * 0.5); d < L - 4; d += joints) {
      const t = d / L, i = Math.round(t * rows);
      if (i < 2 || i > rows - 2 || open.some((o) => t >= o.t[0] - 0.01 && t <= o.t[1] + 0.01)) continue;
      const a = a0 + (a1 - a0) * t, da = 0.9 / R, pos = [];
      for (let j = 0; j < cols; j++) {
        const q = (aa, jj, k) => { const [sr, sz] = sup(phiOf(jj), rh + k, rw + k, round); return V(Math.cos(aa) * (R + sr), Math.sin(aa) * (R + sr), sz); };
        // (a raised band: its two flanks and its top)
        for (const [p0, p1, p2, p3] of [[q(a - da, j, 0), q(a - da, j + 1, 0), q(a - da, j + 1, 0.22), q(a - da, j, 0.22)], [q(a - da, j, 0.22), q(a - da, j + 1, 0.22), q(a + da, j + 1, 0.22), q(a + da, j, 0.22)], [q(a + da, j, 0.22), q(a + da, j + 1, 0.22), q(a + da, j + 1, 0), q(a + da, j, 0)]]) {
          const n = p1.clone().sub(p0).cross(p3.clone().sub(p0)), mid = p0.clone().add(p2).multiplyScalar(0.5), outw = mid.clone().sub(V(Math.cos(a) * R, Math.sin(a) * R, 0));
          const f = n.dot(outw) < 0;
          for (const v of f ? [p0, p3, p1, p1, p3, p2] : [p0, p1, p3, p1, p2, p3]) pos.push(v.x, v.y, v.z);
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); out.joint.push(g);
    }
  }
  // ---- inside: floors (with houses and parks on them) and ribs across the openings, behind each cut
  const rhI = rh - wall, rwI = rw - wall;
  const spans = [...open.map((o) => ({ t: o.t, s: o.s, o })), ...[0, 1].filter((k) => ends[k]).map((k) => { const d = ((ends[k].deep ?? 20) + ends[k].rag) / L; return { t: k ? [1 - d, 1] : [0, d], s: [0, 1], o: ends[k] }; })];
  for (const [si, sp] of spans.entries()) {
    const nf = sp.o.floors ?? nFloors;
    const t0 = Math.max(0, sp.t[0]), t1 = Math.min(1, sp.t[1]), A0 = a0 + (a1 - a0) * t0, A1 = a0 + (a1 - a0) * t1, nA = Math.max(2, Math.ceil((R * (A1 - A0)) / (8 / detail)));
    // the bulkhead closing a broken end's inside, where its inside wall stops
    if (!sp.o.s && sp.o.rag !== undefined) {
      const k = sp.t[0] === 0 ? 0 : 1, a = k ? A0 : A1, pos = [], c = V(Math.cos(a) * R, Math.sin(a) * R, 0), ring = Array.from({ length: cols }, (_, j) => point(a, phiOf(j), wall * 0.9));
      for (let j = 0; j < cols; j++) for (const v of [ring[j], ring[(j + 1) % cols], c]) pos.push(v.x, v.y, v.z);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); out.inner.push(g);
    }
    if ((sp.o.mode ?? floors) === 'x') {
      // decks across the tube (an upright leg's storeys): a disc of the inside at every `step` m, houses and gardens on
      // its upper side (+ along the arc, or - with up: -1), most of them near the opening
      const step = sp.o.step ?? 9, nd = Math.max(1, Math.floor((R * (A1 - A0)) / step)), sgn = sp.o.up ?? 1, sc = sp.o.scale ?? 1;
      const [s0, s1] = sp.s ?? [0, 1], span = s1 >= s0 ? s1 - s0 : 1 - s0 + s1;
      for (let d = 0; d < nd; d++) {
        const a = A0 + ((A1 - A0) * (d + 0.5)) / nd, ring = Array.from({ length: cols }, (_, j) => point(a, phiOf(j), wall * 0.95)), c = V(Math.cos(a) * R, Math.sin(a) * R, 0), pos = [];
        for (let j = 0; j < cols; j++) for (const v of [ring[j], ring[(j + 1) % cols], c]) pos.push(v.x, v.y, v.z);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); out.floor.push(g);
        const up = V(-Math.sin(a), Math.cos(a), 0).multiplyScalar(sgn), r2 = mulberry32(seed * 53 + si * 11 + d);
        for (let q = 0; q < 5 * detail; q++) {
          const phi = (s0 + span * (0.1 + 0.8 * r2())) * TAU, k = 0.45 + r2() * 0.45, [sr, sz] = sup(phi, rhI * k, rwI * k, round);
          const base = V(Math.cos(a) * (R + sr), Math.sin(a) * (R + sr), sz).addScaledVector(up, 0.05);
          if (r2() < 0.4) { const s = (1.4 + r2() * 2.2) * sc, gg = leafCrown(si * 17 + d * 5 + q, { lobes: 4, detail: 0 }).scale(s, s * 0.9, s); orient(gg, up, a + Math.PI / 2); out.green.push(gg.translate(base.x + up.x * s * 0.6, base.y + up.y * s * 0.6, base.z + up.z * s * 0.6)); continue; }
          const bw = (2.5 + r2() * 3.5) * sc, hgt = Math.min(step * 0.7, (2.5 + r2() * 3) * sc), bd = (2.5 + r2() * 3) * sc, b = new THREE.BoxGeometry(bw, hgt, bd).translate(0, hgt / 2, 0);
          orient(b, up, a + Math.PI / 2);
          (r2() < 0.5 ? out.plaster : out.wood).push(b.translate(base.x, base.y, base.z));
          if (r2() < 0.7) { const wg = new THREE.BoxGeometry(bw * 1.02, hgt * 0.25, bd * 0.3).translate(0, hgt * 0.55, 0); orient(wg, up, a + Math.PI / 2); out.glow.push(wg.translate(base.x, base.y, base.z)); }
        }
      }
    } else for (let f = 0; f < nf; f++) {
      // a level: across z at radial offset r (the habitat's), or across the radius at height z (lying)
      const u = (f + 1) / (nf + 1) * 2 - 1, lev = (floors === 'z' ? rwI : rhI) * u * 0.92;
      const other = (floors === 'z' ? rhI : rwI) * Math.pow(Math.max(0, 1 - Math.abs(lev / (floors === 'z' ? rwI : rhI)) ** round), 1 / round) * 0.98;
      if (other < 2) continue;
      const pos = [], th = 0.5;
      for (let k = 0; k < nA; k++) {
        const aa = A0 + ((A1 - A0) * k) / nA, ab = A0 + ((A1 - A0) * (k + 1)) / nA;
        const at = (a, x, y) => (floors === 'z' ? V(Math.cos(a) * (R + x), Math.sin(a) * (R + x), y) : V(Math.cos(a) * (R + y), Math.sin(a) * (R + y), x));
        // its top and its underside (up: toward the ring's centre for 'r', +z for 'z')
        for (const [y, dir] of [[lev, 1], [lev + (floors === 'z' ? -th : th), -1]]) {
          const p = [at(aa, -other, y), at(ab, -other, y), at(ab, other, y), at(aa, other, y)];
          const want = floors === 'z' ? V(0, 0, dir) : V(-Math.cos(aa), -Math.sin(aa), 0).multiplyScalar(dir);
          const n = p[1].clone().sub(p[0]).cross(p[3].clone().sub(p[0])), fl = n.dot(want) < 0;
          for (const v of fl ? [p[0], p[3], p[1], p[1], p[3], p[2]] : [p[0], p[1], p[3], p[1], p[2], p[3]]) pos.push(v.x, v.y, v.z);
        }
        // houses and parks on it, toward the cut (the arc's ends) and behind the openings
        const r2 = mulberry32(seed * 31 + si * 7 + f * 3 + k);
        for (let q = 0; q < 3 * detail; q++) {
          const am = aa + (ab - aa) * r2(), x = (r2() * 2 - 1) * other * 0.85, hgt = 2 + r2() * 4 * (f === 0 ? 1.4 : 1);
          const up = floors === 'z' ? V(0, 0, 1) : V(-Math.cos(am), -Math.sin(am), 0), base = at(am, x, lev);
          if (r2() < 0.35) { const s = 1.6 + r2() * 2.4, g = leafCrown(si * 13 + f * 5 + k + q, { lobes: 4, detail: 0 }).scale(s, s * 0.9, s); orient(g, up, am); out.green.push(g.translate(base.x + up.x * s * 0.7, base.y + up.y * s * 0.7, base.z + up.z * s * 0.7)); continue; }
          const bw = 2.5 + r2() * 4, bd = 2.5 + r2() * 3, g = new THREE.BoxGeometry(bw, hgt, bd).translate(0, hgt / 2, 0);
          orient(g, up, am);
          (r2() < 0.5 ? out.plaster : out.wood).push(g.translate(base.x, base.y, base.z));
          if (r2() < 0.6) { const wg = new THREE.BoxGeometry(bw * 0.3, hgt * 0.25, bd + 0.1).translate(0, hgt * 0.6, 0); orient(wg, up, am); out.glow.push(wg.translate(base.x, base.y, base.z)); }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); out.floor.push(g);
    }
    // ribs: hoops of the frame across an opening, following the section between its edges
    if (sp.o.ribs) {
      for (let k = 1; k < sp.o.ribs; k++) {
        const a = A0 + ((A1 - A0) * k) / sp.o.ribs, pts = [];
        const [s0, s1] = sp.s, span = s1 >= s0 ? s1 - s0 : 1 - s0 + s1;
        for (let m = 0; m <= 10; m++) pts.push(point(a, (s0 + (span * m) / 10) * TAU, wall * 0.5));
        out.frame.push(taper(pts, 0.35 * Math.max(1, w / 40), 1, 12, 5));
      }
    }
  }
  /** A point of the skin at the arc's share t and the section's s (0..1), `off` m out from it, and its outward normal. */
  const at = (t, s, off = 0) => {
    const a = a0 + (a1 - a0) * t, phi = s * TAU, p = point(a, phi), q = point(a, phi + 0.01), r = point(a + 0.002, phi);
    const n = r.clone().sub(p).cross(q.clone().sub(p)).normalize();
    return { p: p.addScaledVector(n, off), n, a };
  };
  return { ...out, at, rows, length: L };
}
/** Turn a geometry built with +y up to stand on a surface whose up is `up` (its +x along the arc at angle a). */
function orient(g, up, a) {
  const along = V(-Math.sin(a), Math.cos(a), 0);
  if (Math.abs(along.dot(up)) > 0.9) along.set(1, 0, 0);
  const x = along.clone().sub(up.clone().multiplyScalar(along.dot(up))).normalize(), z = new THREE.Vector3().crossVectors(x, up);
  return g.applyMatrix4(new THREE.Matrix4().makeBasis(x, up, z));
}

/**
 * The matrix that places an arc built in its own frame (ringSegment's): its centre at `at` [x, y, z], its plane turned
 * by yaw about the vertical (0: the arc in the world's xy plane, facing ±z), leaned by `lean` about the vertical line in
 * its plane... `lie` lays it flat (the arc in the ground's plane, its section's z then the world's up), `tilt` then
 * tips it about the world's x and `roll` about z. Apply with geometry.applyMatrix4 (moveParts).
 */
export function ringPose({ at = [0, 0, 0], yaw = 0, lie = false, tilt = 0, roll = 0, spin = 0 } = {}) {
  const m = new THREE.Matrix4(), r = new THREE.Matrix4();
  m.makeRotationZ(spin);
  if (lie) m.premultiply(r.makeRotationX(-Math.PI / 2));
  m.premultiply(r.makeRotationY(yaw));
  if (tilt) m.premultiply(r.makeRotationX(tilt));
  if (roll) m.premultiply(r.makeRotationZ(roll));
  m.premultiply(r.makeTranslation(at[0], at[1], at[2]));
  return m;
}
/**
 * The circle through three points A, M, B (Vector3s, in that order along it): its centre, radius, the matrix of its
 * own frame (x toward A, z its plane's normal: ringSegment's frame) and the angles of the three (A at 0, rising
 * through M to B). `up`: the normal turned to point up (a ring lying down: its section's z the world's up).
 * yAt(y) → the angles where the circle crosses height y (to run an arch's legs into the ground).
 */
export function arcThrough(A, M, B, { up = false } = {}) {
  const u = M.clone().sub(A), v = B.clone().sub(A), w = new THREE.Vector3().crossVectors(u, v), w2 = w.lengthSq();
  if (up && w.y < 0) { const r = arcThrough(B, M, A); return { ...r, flipped: true }; }
  const O = A.clone().add(new THREE.Vector3().crossVectors(w, u).multiplyScalar(v.lengthSq()).add(new THREE.Vector3().crossVectors(v, w).multiplyScalar(u.lengthSq())).multiplyScalar(1 / (2 * w2)));
  const R = A.distanceTo(O), n = w.normalize(), x = A.clone().sub(O).normalize(), y = new THREE.Vector3().crossVectors(n, x);
  const ang = (P) => { const d = P.clone().sub(O); let a = Math.atan2(d.dot(y), d.dot(x)); if (a < -1e-9) a += TAU; return a; };
  const matrix = new THREE.Matrix4().makeBasis(x, y, n).setPosition(O);
  const yAt = (h) => { const a = x.y, b = y.y, c = (h - O.y) / R, r = Math.hypot(a, b); if (Math.abs(c) > r) return []; const base = Math.atan2(b, a), d = Math.acos(c / r); return [base - d, base + d].map((t) => ((t % TAU) + TAU) % TAU); };
  return { centre: O, R, normal: n, matrix, a: [0, ang(M), ang(B)], yAt, flipped: false };
}
/** Every geometry of the parts moved by m; the parts' `at` then answers in the world's frame. */
export function placeRing(parts, m) {
  moveParts(parts, (g) => g.applyMatrix4(m));
  const at0 = parts.at, nm = new THREE.Matrix3().getNormalMatrix(m);
  parts.at = (t, s, off = 0) => { const q = at0(t, s, 0); const n = q.n.applyMatrix3(nm).normalize(); return { p: q.p.applyMatrix4(m).addScaledVector(n, off), n, a: q.a }; };
  return parts;
}

/**
 * A segment of the ring through three points of its centre line (A, M, B: [x, y, z] in the caller's frame), run on past
 * its ends by `ext` [m, m] (an arch's legs into the ground), placed: ringSegment's options otherwise (w, h, round, seg,
 * sseg, bands, open, ends, wall, floors, nFloors, joints, seed, detail, holes). `lie`: a ring lying down, its section's
 * z the world's up; it then runs from B to A, so what is given from A (ext, ends, the bands' and openings' t, at()'s t)
 * is mirrored here and reads from A as given. The parts, with `circle` (arcThrough's) and at(t, s, off) in the frame.
 */
export function ringThrough(o) {
  const C = arcThrough(V(...o.A), V(...o.M), V(...o.B), { up: o.lie });
  const f = C.flipped, ft = (r) => (f ? [1 - r[1], 1 - r[0]] : r), oe = o.ends ?? {};
  const [e0, e1] = f ? [...(o.ext ?? [0, 0])].reverse() : o.ext ?? [0, 0];
  const ends = f ? { ...(oe[1] !== undefined ? { 0: oe[1] } : {}), ...(oe[0] !== undefined ? { 1: oe[0] } : {}) } : oe;
  const P = ringSegment({ R: C.R, a0: -e0 / C.R, a1: C.a[2] + e1 / C.R, w: o.w, h: o.h, round: o.round ?? 3, seg: o.seg ?? 5, sseg: o.sseg ?? 32,
    bands: (o.bands ?? []).map((b) => ({ ...b, t: ft(b.t) })), open: (o.open ?? []).map((b) => ({ ...b, t: ft(b.t), up: (b.up ?? 1) * (f ? -1 : 1) })), ends,
    wall: o.wall ?? 1.8, floors: o.floors ?? (o.lie ? 'z' : 'r'), nFloors: o.nFloors ?? 4, joints: o.joints ?? 0, seed: o.seed ?? 1, detail: o.detail ?? 1, holes: o.holes ?? 0, wrap: o.wrap ?? true });
  placeRing(P, C.matrix);
  if (f) { const at = P.at; P.at = (t, s, off) => at(1 - t, s, off); }
  P.circle = C;
  return P;
}

// ------------------------------------------------------------------ trees, from the hull's seams and on the plain
/**
 * An umbrella tree, its foot at the origin, h high: a trunk leaning a little and forking, a layered crown of leaf masses
 * r round over it (the pictures' dark round trees). { bark, green }.
 */
export function tree({ h = 9, r = 4, lean = [0.1, 0], seed = 1, detail = 1, up = V(0, 1, 0) } = {}) {
  const rng = mulberry32(Math.floor(seed * 3331) + 7), out = { bark: [], green: [] };
  const ty = Math.max(h * 0.45, h - r * 1.1), top = V(lean[0] * h, ty, lean[1] * h);
  out.bark.push(taper([V(0, -0.6, 0), V(top.x * 0.4, ty * 0.5, top.z * 0.4), top], Math.max(0.2, r * 0.07), 0.5, detail ? 8 : 4, detail ? 6 : 4));
  for (let k = 0; k < (detail ? 3 : 1); k++) {
    const a = rng() * TAU, e = V(top.x + Math.cos(a) * r * 0.55, ty + r * (0.35 + rng() * 0.25), top.z + Math.sin(a) * r * 0.55);
    out.bark.push(taper([top.clone().multiplyScalar(0.92), e], Math.max(0.1, r * 0.035), 0.5, 4, 4));
  }
  const crown = (detail ? layeredCrown(seed, { lobes: [6, 4, 1] }) : leafCrown(seed, { lobes: 4, detail: 0 })).scale(r, r * 0.62, r).translate(top.x, ty + r * 0.45, top.z);
  out.green.push(crown);
  if (up.y < 0.999) { const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up.clone().normalize()); moveParts(out, (g) => g.applyQuaternion(q)); }
  return out;
}

// ------------------------------------------------------------------ the village at a hull's foot
/**
 * A row of houses against a wall, in its own frame: the wall at z = 0 rising from y = 0, the street toward +z, from x0 to
 * x1. Cabins of plaster and planks (lit windows, a door), now and then an upper storey set back with a railed
 * balcony, awnings sloping from the wall over the fronts, stalls, lanterns, crates and sacks. `lit` the share of
 * windows lit. { plaster, wood, dark, glow, cloth, cloth2, frame, goods, lights: [[x, y, z]], fronts: [[x0, x1, d]] }.
 */
export function village({ plaster = 0.6, x0 = -20, x1 = 20, deep = [3, 5.5], high = [2.8, 3.6], upper = 0.45, awnings = 0.7, stalls = 0.25, lit = 0.75, seed = 1, detail = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 4513) + 3), R = (a, b) => a + rng() * (b - a);
  const out = { plaster: [], wood: [], dark: [], glow: [], cloth: [], cloth2: [], frame: [], goods: [], lights: [], fronts: [] };
  const box = (list, w, h, d, x, y, z) => list.push(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z));
  const windows = (x, y, z, w, h, n) => {
    for (let k = 0; k < n; k++) {
      const wx = x - w / 2 + (w * (k + 0.5)) / n, on = rng() < lit;
      box(out.dark, 1.5, 1.45, 0.08, wx, y + h * 0.3, z + 0.02);
      if (on) { box(out.glow, 1.25, 1.2, 0.1, wx, y + h * 0.3 + 0.12, z + 0.04); if (rng() < 0.5) out.lights.push([wx, y + h * 0.55, z + 1]); }
      else box(out.wood, 1.25, 1.2, 0.1, wx, y + h * 0.3 + 0.12, z + 0.03);
    }
  };
  for (let x = x0; x < x1 - 2;) {
    const w = Math.min(x1 - x, R(3.2, 6.5)), cx = x + w / 2, d = R(deep[0], deep[1]), hh = R(high[0], high[1]);
    if (rng() < stalls) {
      const S = stall({ x: cx, w: w * 0.9, deep: d, seed: seed * 17 + x, goods: 3, high: hh });
      out.wood.push(...S.wood); out.cloth2.push(...S.cloth); out.dark.push(...S.dark); for (const g of S.goods) out.goods.push(...g);
      out.lights.push([cx, hh * 0.7, d]);
      x += w + R(0.3, 1.2);
      continue;
    }
    const mat = rng() < plaster ? out.plaster : out.wood;
    box(mat, w, hh, d, cx, 0, d / 2);
    // its roof: a plank slab over it, a lip out front
    box(out.wood, w + 0.4, 0.22, d + 0.6, cx, hh, d / 2 + 0.2);
    // a door and windows on its front (z = d)
    box(out.dark, 1.1, 2.1, 0.1, cx + (rng() - 0.5) * w * 0.5, 0, d + 0.03);
    windows(cx, 0, d, w, hh, Math.max(1, Math.floor(w / 2.2)));
    out.fronts.push([x, x + w, d]);
    if (rng() < upper * detail) {
      const w2 = w * R(0.6, 0.9), d2 = d * R(0.5, 0.75), h2 = R(2.6, 3.2);
      box(rng() < plaster ? out.plaster : out.wood, w2, h2, d2, cx, hh + 0.22, d2 / 2);
      box(out.wood, w2 + 0.3, 0.18, d2 + 0.4, cx, hh + 0.22 + h2, d2 / 2 + 0.1);
      windows(cx, hh + 0.22, d2, w2, h2, Math.max(1, Math.floor(w2 / 2.4)));
      // the balcony's rail on the roof below it
      for (const [ax, bx] of [[cx - w / 2, cx + w / 2]]) out.frame.push(bar(V(ax, hh + 1.2, d - 0.1), V(bx, hh + 1.2, d - 0.1), 0.04, 0.04, 4));
      for (let k = 0; k <= 4; k++) { const px = cx - w / 2 + (w * k) / 4; out.frame.push(bar(V(px, hh + 0.2, d - 0.1), V(px, hh + 1.2, d - 0.1), 0.035, 0.035, 3)); }
    }
    if (rng() < awnings) {
      // a sailcloth from over the door out on two poles
      const ah = hh * R(0.75, 0.95), out2 = d + R(1.6, 2.6), list = rng() < 0.5 ? out.cloth : out.cloth2;
      list.push(cloth([cx - w * 0.48, ah + 0.5, d], [cx + w * 0.48, ah + 0.5, d], [cx + w * 0.5, ah - 0.5, out2], [cx - w * 0.5, ah - 0.5, out2], { sag: 0.2, folds: 2, fold: 0.06, nu: detail ? 8 : 4, nv: detail ? 4 : 2, droop: 0.18, seed: seed + x }));
      for (const e of [-1, 1]) box(out.wood, 0.1, ah - 0.5, 0.1, cx + e * w * 0.5, 0, out2);
    }
    // crates and sacks before it, a lantern by the door
    for (let k = 0; k < (detail ? 2 : 1); k++) if (rng() < 0.5) { const s = R(0.4, 0.75); out.wood.push(new THREE.BoxGeometry(s, s * 0.8, s).rotateY(rng()).translate(cx + R(-w, w) * 0.45, s * 0.4, d + R(0.4, 1.4))); }
    if (rng() < 0.5) { out.glow.push(new THREE.SphereGeometry(0.18, 6, 4).translate(cx + w * 0.42, 2.3, d + 0.35)); out.lights.push([cx + w * 0.42, 2.3, d + 0.6]); }
    x += w + (rng() < 0.3 ? R(0.8, 2.5) : 0.05);
  }
  return out;
}

/** A stair onto a hull (antennas-kit's truss stair, its rails and stringers in the frame's role). { wood (treads), frame }. */
export function serviceStair(A, B, o = {}) { const S = trussStair(A, B, o); return { wood: S.plank, frame: S.frame }; }

// ------------------------------------------------------------------ the grazing beasts
/**
 * A woolly grazer, its feet at the origin, facing +z, s its scale (1: a beast 1.3 m at the back): a lumpy fleece,
 * its head down to the grass, four dark legs. { wool, dark }. ~120 faces.
 */
export function grazer(s = 1, { head = 'down', seed = 1 } = {}) {
  const body = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.12, 1.6, seed).scale(0.55, 0.48, 0.95).translate(0, 0.95, 0);
  const hd = head === 'down' ? [0, 0.42, 1.12, 0.6] : [0, 1.1, 1.05, -0.3];
  const neck = new THREE.CylinderGeometry(0.17, 0.24, 0.6, 6).rotateX(hd[3] + 1.1).translate(0, (0.95 + hd[1]) / 2 + 0.05, 0.85);
  const skull = new THREE.IcosahedronGeometry(0.22, 0).scale(0.8, 0.85, 1.4).rotateX(hd[3]).translate(hd[0], hd[1], hd[2]);
  const ears = [-1, 1].map((e) => new THREE.ConeGeometry(0.07, 0.22, 3).rotateZ(e * 1.2).translate(e * 0.17, hd[1] + 0.14, hd[2] - 0.1));
  const legs = [[-0.28, 0.55], [0.28, 0.55], [-0.28, -0.55], [0.28, -0.55]].map(([x, z]) => new THREE.CylinderGeometry(0.06, 0.07, 0.7, 4).translate(x, 0.35, z));
  const tail = new THREE.ConeGeometry(0.08, 0.35, 4).rotateX(-2.4).translate(0, 0.95, -0.98);
  const wool = merged([body, neck, tail]).scale(s, s, s), dark = merged([skull, ...ears, ...legs]).scale(s, s, s);
  return { wool: [wool], dark: [dark] };
}

// ------------------------------------------------------------------ the sky's great cumulus
/** One puff (an icosahedron made lumpy: the pictures' cauliflower cloud). */
export function puff(detail = 1, seed = 0) { const g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); const m = mergeVertices(lumpy(g, 0.16, 2.2, seed), 1e-4); m.computeVertexNormals(); return m; }
/**
 * A bank of cumulus far off: n clusters between d0 and d1 m from `eye` [x, z] across the azimuths az0..az1 (rad, 0 the
 * view's -z, positive to the right), each a big puff with lobes round it and growths on top, their feet at `base` m;
 * [{ x, y, z, s, sy }] (a puff each, for an instanced draw).
 */
export function cloudBank(rng, { n = 8, az0 = -0.6, az1 = 0.6, d0 = 1400, d1 = 2400, base = 120, size = [90, 200], tall = 1, eye = [0, 0] } = {}) {
  const out = [], R = (a, b) => a + rng() * (b - a);
  for (let i = 0; i < n; i++) {
    const az = R(az0, az1), d = R(d0, d1), x = eye[0] + Math.sin(az) * d, z = eye[1] - Math.cos(az) * d, s = R(size[0], size[1]);
    const y0 = base + s * 0.35;
    out.push({ x, y: y0, z, s, sy: R(0.7, 0.85) });
    for (let k = 0, m = 7 + Math.floor(rng() * 5); k < m; k++) {
      const a = rng() * TAU, rr = s * R(0.5, 1.15), ls = s * R(0.35, 0.65);
      out.push({ x: x + Math.cos(a) * rr, y: y0 - ls * 0.15 + R(0, s * 0.2), z: z + Math.sin(a) * rr * 0.6, s: ls, sy: R(0.7, 0.9) });
    }
    // the towers on top
    for (let k = 0, m = Math.floor(R(1, 3) * tall); k < m; k++) {
      const ls = s * R(0.45, 0.7);
      out.push({ x: x + R(-0.4, 0.4) * s, y: y0 + s * R(0.5, 0.9) * tall, z: z + R(-0.2, 0.2) * s, s: ls, sy: 0.85 });
      if (rng() < 0.6) out.push({ x: x + R(-0.5, 0.5) * s, y: y0 + s * R(0.9, 1.3) * tall, z: z + R(-0.2, 0.2) * s, s: ls * 0.7, sy: 0.85 });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the look
/** Haze by depth: the pictures' pale blue-green air, the far ring paling into it in bands. */
export const RING_HAZE = { uHazeLayers: [220, 1.8, 0.09, 5], uHazeTone: [0.8, 0.88, 0.88, 0.8] };
/**
 * The print preset's touches: the pictures' clean flat colour (little hatching, few half-tones), a teal shade, the
 * great cumulus drawn as geometry (no bank on the horizon, no flat clouds), cast shadows kept, the haze.
 */
export const RING_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.35, uHatch: 0.35, uHalftone: 0.2, uShadeKeep: 0.2, uBounce: 0.3, uLineWidth: 0.95, uFogDensity: 0.00028, uAerial: 0.35, uSpotTone: [0.12, 0.2, 0.2, 0.4], ...RING_HAZE };
/** The day's colours (sky top, horizon, shadow, light, sun): a teal-blue sky, a blue-green shade, warm light. */
export const RING_DAY = ['#5d9fb6', '#a8c8cc', '#7d9aa4', '#fff8ea', '#fff3dc'];
/** The surfaces' tones, read off the pictures. */
export const RING_TONES = {
  grass: '#8e9f56', grass2: '#9aac60', grass3: '#7a8a4a', path: '#d8c9a0',
  hull: '#f8e6c8', hull2: '#efdcbc', red: '#ef9a7c', red2: '#c9764e', cut: '#cdbfa0', inner: '#4d6f68', inner2: '#335450', floor: '#7a8a78',
  joint: '#e6d2b0', frame: '#3a3c38', green: '#3f4e2a', green2: '#33432a', bark: '#4a3a2a',
  plaster: '#d8b88e', wood: '#8a5c38', woodDark: '#5a4028', dark: '#2e2a26', glow: '#f4a868', cloth: '#efe2c4', cloth2: '#e8b48c', goods: '#c4664a',
  wool: '#ece2cc', woolDark: '#5a4a3c', far: '#d8d6c4', cloud: '#fffaf0',
};
