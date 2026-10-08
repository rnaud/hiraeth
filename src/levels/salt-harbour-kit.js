import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { leafCrown } from './garden-kit.js';

// ---------------------------------------------------------------------------
// The Salt Harbour's shapes, shared by the world (salt-harbour.js) and its reference views
// (reference-saltharbour.js), after the pictures (references/The Salt Harbour/reference-1 … 4):
// huge weathered ships standing on their keels in a dry white salt basin, made into apartment
// buildings; the streets between their hulls, sailcloth shading them, gangways joining the decks
// overhead, shops cut into the hulls' feet, herbs on the porthole ledges, mooring ropes staked
// into the salt.
//   hull        a ship's hull on its keel (or stood on its stern: upright), white over a terracotta
//               bottom (band) and/or under a terracotta top band; plated, portholes in rows
//   houseStack  the wooden houses built onto a hull's flank or in the cleft between two hulls:
//               storeys of cabins with balconies, rails, doors and windows, pots of herbs
//   superstructure  the decks' upper works: stepped blocks with portholes and railings, a mast
//   cloth       a sailcloth stretched between four points, sagging, folded
//   curtain     a sailcloth hung from a sagging top edge, falling in folds to a scalloped hem
//   gangway     a footbridge from deck to deck: planks, rails, a truss under it
//   rope        a mooring rope, from high on a hull to its stake in the salt (stake: the stake)
//   stall       a shop at a hull's foot: a counter of goods, crates, a sloped awning on poles
//   archDoor    a round-headed shop door cut into the hull, its timber frame
//   herbs       a planter of herbs on a ledge
//   figure      a resident: a cloaked figure, sometimes hauling a bundle
// Each returns plain geometries in the caller's frame, grouped by role ({ white, red, … }); no
// materials, nothing placed in a scene. `detail` (1 the views, under 1 the world) thins the segments.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const push = (out, k, g) => { (out[k] ??= []).push(g); return g; };

/**
 * A ship's hull on its keel, the keel's lowest point at y = 0, its length along z (the bow toward +z), its
 * centre at the origin. L long, B wide, D deep (keel to gunwale). n: the sections' squareness (2 round … 4 boxy);
 * band: the height (m) under which it is painted terracotta (its bottom); top: the depth (m) of a terracotta band
 * under the gunwale; rise: [stern, bow] the keel's rise at the ends (× D); tumble: how far the side draws in again
 * over its widest toward the gunwale (0 … 0.4, a share of the beam); upright: stood on its stern instead,
 * the bow up (+y), its keel toward +z and its deck toward -z.
 * Returns { white: [geo], red: [geo], deck: [geo], at(t, y): { p, n } (a point of its side: t 0 stern … 1 bow,
 * y over the keel, on the starboard (+x) side; turned like the geometry), halfB(t), keelY(t), D, L }.
 */
export function hull({ L = 90, B = 26, D = 32, n = 3, band = 0, top = 0, rise = [0.3, 0.55], tumble = 0, detail = 1, upright = false, deck = true } = {}) {
  // (across: fine enough that a facet sits within ~0.1 m of the true side, where the portholes and doors are put)
  const NT = Math.max(16, Math.round(48 * detail)), NV = Math.max(8, Math.round(20 * detail));
  const e = 2 / n;
  const halfB = (t) => {
    const u = 2 * t - 1;
    return (B / 2) * Math.max(0.02, u > 0 ? Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.62) : Math.pow(Math.max(0, 1 - Math.pow(-u, 5)), 0.35));
  };
  const keelY = (t) => { const u = 2 * t - 1; return D * (rise[1] * Math.pow(sstep(0.5, 1, u), 1.5) + rise[0] * Math.pow(sstep(0.72, 1, -u), 2)); };
  // a point of the side: t along, s across (-1 the port gunwale, 0 the keel, 1 the starboard gunwale)
  const P = (t, s) => {
    const phi = s * Math.PI / 2, c = Math.abs(Math.cos(phi)), sn = Math.sin(phi), y0 = keelY(t);
    // (tumble: the side drawn in again over its widest, as the pictures' round-shouldered hulls)
    const yrel = 1 - Math.pow(c, e), bulge = (1 + 0.06 * Math.sin(Math.PI * Math.min(1, yrel * 1.25))) * (1 - tumble * Math.pow(sstep(0.45, 1, yrel), 1.4));
    return V(halfB(t) * Math.sign(sn) * Math.pow(Math.abs(sn), e) * bulge, y0 + (D - y0) * yrel, (2 * t - 1) * (L / 2));
  };
  // s at which the side reaches height y over the keel (or ±1 if above the gunwale, 0 below the keel)
  const sAt = (t, y) => { const y0 = keelY(t), r = (y - y0) / Math.max(D - y0, 1e-3); if (r <= 0) return 0; if (r >= 1) return 1; return (Math.acos(Math.pow(1 - r, 1 / e)) / (Math.PI / 2)); };
  const grid = (s0, s1) => {
    // s0(t), s1(t): the band's edges across; a grid of NT × NV quads between them
    const pos = [], idx = [];
    for (let i = 0; i <= NT; i++) {
      const t = i / NT, a = s0(t), b = s1(t);
      for (let j = 0; j <= NV; j++) { const p = P(t, a + ((b - a) * j) / NV); pos.push(p.x, p.y, p.z); }
    }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NV; j++) { const q = i * (NV + 1) + j; idx.push(q, q + 1, q + NV + 1, q + 1, q + NV + 2, q + NV + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const out = { white: [], red: [], deck: [] };
  const sb = (t) => (band > 0 ? sAt(t, band) : 0), st = (t) => (top > 0 ? sAt(t, D - top) : 1);
  for (const side of [-1, 1]) {
    // (the port side's s runs negative: its grid wound the other way round, so both face out)
    const f = (fn) => (t) => side * fn(t);
    const strips = [[() => 0, sb, 'red'], [sb, st, 'white'], [st, () => 1, 'red']];
    for (const [a, b, k] of strips) {
      if ((k === 'red' && b === sb && band <= 0) || (k === 'red' && a === st && top <= 0)) continue;
      const g = side > 0 ? grid(f(a), f(b)) : grid(f(b), f(a));
      out[k].push(g);
    }
  }
  if (deck) {
    // the deck: a flat cap along the gunwales, a little under them (the bulwark stands round it)
    const pos = [], idx = [], y = D - 0.6;
    for (let i = 0; i <= NT; i++) { const t = i / NT, h = halfB(t) * 0.98, z = (2 * t - 1) * (L / 2); pos.push(-h, y, z, h, y, z); }
    for (let i = 0; i < NT; i++) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    out.deck.push(g);
  }
  // a point of the drawn (faceted) side, not the true curve it is cut from: what is put on the plating sits on the
  // facets, so a porthole or a door stands no further proud of the collision than it is drawn (s ≥ 0: the starboard side)
  const bands = [[() => 0, sb], [sb, st], [st, () => 1]];
  const facet = (t, s) => {
    const fi = Math.min(NT - 1e-6, Math.max(0, t * NT)), i0 = Math.floor(fi), ft = fi - i0, at = (i) => {
      const tt = i / NT, [a, b] = bands.find(([a, b]) => s <= b(t) + 1e-9) ?? bands[2], A = a(t), Bb = b(t), u = Bb > A ? (s - A) / (Bb - A) : 0;
      const fj = Math.min(NV - 1e-6, Math.max(0, u * NV)), j0 = Math.floor(fj), fu = fj - j0, a0 = a(tt), b0 = b(tt);
      return P(tt, a0 + ((b0 - a0) * j0) / NV).lerp(P(tt, a0 + ((b0 - a0) * (j0 + 1)) / NV), fu);
    };
    return at(i0).lerp(at(i0 + 1), ft);
  };
  const turn = (g) => (upright ? g.rotateX(-Math.PI / 2).translate(0, L / 2, 0) : g);
  for (const k of ['white', 'red', 'deck']) out[k] = out[k].map(turn);
  const m = new THREE.Matrix4();
  if (upright) m.makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, L / 2, 0));
  out.at = (t, y, side = 1) => {
    const s = side * sAt(t, y), dt = 1e-3, ds = 1e-3;
    const p = facet(t, Math.abs(s)), pt = P(Math.min(1, t + dt), s).sub(P(Math.max(0, t - dt), s)), ps = P(t, s + ds).sub(P(t, s - ds));
    if (side < 0) p.x = -p.x;
    const nrm = side > 0 ? pt.clone().cross(ps).normalize() : ps.clone().cross(pt).normalize();
    if (nrm.x * side < 0) nrm.negate();
    p.applyMatrix4(m); nrm.transformDirection(m);
    return { p, n: nrm };
  };
  out.halfB = halfB; out.keelY = keelY; out.D = D; out.L = L; out.B = B;
  return out;
}

/**
 * Portholes along a hull's side: rows at heights `rows` (m over the keel), every `step` m along it, between t0 and t1;
 * some lit. A ring and a dark (or lit) disc a little proud of the side. { dark: [geo], glow: [geo], rim: [geo] }.
 */
export function portholes(H, { rows = [8, 14], step = 6, t0 = 0.12, t1 = 0.88, r = 0.55, lit = 0.25, seed = 1, sides = [1, -1], skip = 0.15, jitter = 0.4 } = {}) {
  const rng = mulberry32(Math.floor(seed * 7331) + 5), out = { dark: [], glow: [], rim: [] };
  const n = Math.max(1, Math.round(((t1 - t0) * H.L) / step));
  for (const side of sides) for (const y of rows) for (let i = 0; i <= n; i++) {
    if (rng() < skip) continue;
    const t = t0 + ((t1 - t0) * i) / n + ((rng() - 0.5) * jitter * step) / H.L, { p, n: nr } = H.at(t, y + (rng() - 0.5) * jitter);
    if (side < 0) { p.x = -p.x; nr.x = -nr.x; }
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), nr), rr = r * (0.85 + rng() * 0.3);
    // (a hair proud of the facet it sits on: the collision is the plating, the audit's 6 cm allowance)
    push(out, rng() < lit ? 'glow' : 'dark', new THREE.CircleGeometry(rr, 10).applyQuaternion(q).translate(p.x + nr.x * 0.035, p.y + nr.y * 0.035, p.z + nr.z * 0.035));
    out.rim.push(new THREE.TorusGeometry(rr * 1.12, rr * 0.16, 3, 10).scale(1, 1, 0.12).applyQuaternion(q).translate(p.x + nr.x * 0.02, p.y + nr.y * 0.02, p.z + nr.z * 0.02));
  }
  return out;
}

/**
 * A round-headed door at the foot of a wall, its threshold at (x, y, z), facing `nrm` (a unit vector, horizontal):
 * a dark mouth, a timber frame round it, a wooden leaf ajar. w wide, h high. { dark: [geo], wood: [geo], glow: [geo] }.
 */
export function archDoor(x, y, z, nrm, { w = 2.4, h = 3.6, lit = false, leaf = true } = {}) {
  const out = { dark: [], wood: [], glow: [] }, q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(nrm.x, 0, nrm.z).normalize());
  const r = w / 2, s = new THREE.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  const put = (g, off) => g.applyQuaternion(q).translate(x + nrm.x * off, y, z + nrm.z * off);
  (lit ? out.glow : out.dark).push(put(new THREE.ShapeGeometry(s, 8), 0.12));
  // the frame: two jambs and the arch
  for (const e of [-1, 1]) out.wood.push(put(new THREE.BoxGeometry(0.28, h - r, 0.4).translate(e * (r + 0.1), (h - r) / 2, 0), 0.15));
  out.wood.push(put(new THREE.TorusGeometry(r + 0.1, 0.16, 4, 12, Math.PI).translate(0, h - r, 0), 0.15));
  if (leaf) out.wood.push(put(new THREE.BoxGeometry(r * 0.95, h - r * 0.4, 0.12).translate(-r * 0.5, (h - r * 0.4) / 2, 0).rotateY(0.9).translate(-r * 0.5, 0, 0.1), 0.2));
  return out;
}

/** A planter of herbs: a box of earth with tufts of green, w long, centred at (x, y, z) along `yaw`. { pot: [geo], leaves: [geo] }. */
export function herbs(x, y, z, yaw = 0, { w = 1.4, seed = 1, detail = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 4129) + 3), out = { pot: [], leaves: [] };
  out.pot.push(new THREE.BoxGeometry(w, 0.38, 0.45).translate(0, 0.19, 0).rotateY(yaw).translate(x, y, z));
  const k = Math.max(2, Math.round(w / 0.4));
  for (let i = 0; i < k; i++) {
    const s = 0.3 + rng() * 0.25, u = (i + 0.5) / k * w - w / 2;
    const g = leafCrown(seed * 31 + i, { lobes: detail >= 1 ? 5 : 3, detail: 0, core: 0.6, flat: 0.8 }).scale(s, s * (1 + rng() * 0.6), s);
    out.leaves.push(g.translate(u, 0.38 + s * 0.45, 0).rotateY(yaw).translate(x, y, z));
  }
  return out;
}

/**
 * Wooden houses built onto a wall (a hull's flank, the cleft between two hulls): storeys of cabins standing out
 * from the wall along +z (the wall at z = 0, the street toward +z), from x0 to x1, from y0 up `floors` storeys of `fh` m.
 * Each cabin its own depth and width; a balcony with a rail in front of each storey now and then, doors and
 * windows (some lit), shutters, herbs on the ledges, struts under the jutting ones, pipes, washing.
 * { wood: [geo], plaster: [geo], dark: [geo], glow: [geo], cloth: [geo], pot: [geo], leaves: [geo], decks: [{ x0, x1, y, z }] }.
 */
export function houseStack({ x0 = -6, x1 = 6, y0 = 0, floors = 5, fh = 3.4, depth = [2, 4.5], seed = 1, lit = 0.3, detail = 1, herbs: herbShare = 0.5, plaster = 0.35 } = {}) {
  const rng = mulberry32(Math.floor(seed * 2741) + 1), out = { wood: [], plaster: [], dark: [], glow: [], cloth: [], pot: [], leaves: [], decks: [] };
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * fh;
    let x = x0 + (rng() - 0.5) * 1.5;
    while (x < x1 - 1.5) {
      const w = Math.min(x1 - x, 2.6 + rng() * 3.8), d = depth[0] + rng() * (depth[1] - depth[0]), h = fh * (0.82 + rng() * 0.18), cx = x + w / 2;
      const kind = rng() < plaster ? 'plaster' : 'wood';
      out[kind].push(new THREE.BoxGeometry(w * 0.96, h, d).translate(cx, y + h / 2, d / 2 - 0.3));
      // a little roof slab over it, jutting
      out.wood.push(new THREE.BoxGeometry(w * 1.04, 0.18, d + 0.5).translate(cx, y + h + 0.05, d / 2 - 0.05));
      // its front: a door or a window or two, round- or square-headed, a shutter
      const front = d - 0.28, nw = w > 4.2 ? 2 : 1;
      for (let k = 0; k < nw; k++) {
        const wx = cx + (nw === 2 ? (k - 0.5) * w * 0.45 : (rng() - 0.5) * w * 0.3), ww = 0.7 + rng() * 0.5, wh = rng() < 0.4 ? h * 0.66 : 0.9 + rng() * 0.5;
        const wy = wh > h * 0.6 ? y + 0.05 : y + h * 0.42;
        const g = rng() < 0.4 ? new THREE.CircleGeometry(ww * 0.55, 10).scale(1, wh / ww * 0.9, 1).translate(wx, wy + wh / 2, front) : new THREE.PlaneGeometry(ww, wh).translate(wx, wy + wh / 2, front);
        (rng() < lit ? out.glow : out.dark).push(g);
        if (rng() < 0.4) out.wood.push(new THREE.BoxGeometry(ww * 0.5, wh, 0.08).translate(wx + ww * 0.55, wy + wh / 2, front + 0.08));
      }
      // a balcony or a ledge in front, a rail, herbs
      if (rng() < 0.55) {
        const bd = 0.9 + rng() * 0.6;
        out.wood.push(new THREE.BoxGeometry(w, 0.16, bd).translate(cx, y + 0.02, front + bd / 2));
        out.decks.push({ x0: x, x1: x + w, y: y + 0.1, z: front + bd });
        const posts = Math.max(2, Math.round(w / 0.7));
        for (let i = 0; i <= posts; i++) out.wood.push(new THREE.BoxGeometry(0.06, 0.95, 0.06).translate(x + (w * i) / posts, y + 0.55, front + bd - 0.05));
        out.wood.push(new THREE.BoxGeometry(w, 0.07, 0.08).translate(cx, y + 1.02, front + bd - 0.05));
        // struts under it, back to the wall below
        if (f > 0) for (const e of [-0.4, 0.4]) out.wood.push(stick(V(cx + e * w, y - 0.05, front + bd * 0.9), V(cx + e * w, y - 1.4, front - 0.4), 0.06));
        if (rng() < herbShare) { const H = herbs(cx + (rng() - 0.5) * w * 0.4, y + 0.1, front + bd - 0.3, 0, { w: Math.min(w * 0.6, 1.6), seed: seed * 7 + f * 13 + x, detail }); out.pot.push(...H.pot); out.leaves.push(...H.leaves); }
        if (rng() < 0.25) {   // washing on a line across it
          const ly = y + 2.1;
          out.dark.push(stick(V(x + 0.1, ly, front + bd - 0.1), V(x + w - 0.1, ly, front + bd - 0.1), 0.015));
          for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) { const wx = x + 0.4 + rng() * (w - 0.8), s = 0.4 + rng() * 0.4; out.cloth.push(new THREE.PlaneGeometry(s, s * 1.2).translate(wx, ly - s * 0.6, front + bd - 0.1)); }
        }
      } else if (rng() < herbShare) {
        const H = herbs(cx, y + h * 0.42 - 0.2, front + 0.25, 0, { w: Math.min(w * 0.5, 1.3), seed: seed * 5 + f * 11 + x, detail });
        out.pot.push(...H.pot); out.leaves.push(...H.leaves);
        out.wood.push(new THREE.BoxGeometry(Math.min(w * 0.6, 1.5), 0.1, 0.5).translate(cx, y + h * 0.42 - 0.22, front + 0.25));
      }
      // now and then a pipe down its corner
      if (rng() < 0.2) out.dark.push(stick(V(x + 0.15, y, front + 0.1), V(x + 0.15, y + h, front + 0.1), 0.07));
      x += w + (rng() < 0.15 ? 0.6 + rng() : 0);
    }
  }
  return out;
}

/**
 * The upper works on a deck at y (the deck's height), centred at (x, z), w across, d along: stepped blocks, each a
 * storey or two, set back as they rise, portholes on their faces, railings round each roof, a mast or two.
 * { white: [geo], red: [geo], dark: [geo], glow: [geo], rail: [geo] }.
 */
export function superstructure({ x = 0, y = 0, z = 0, w = 14, d = 20, tiers = 3, th = 4.2, seed = 1, red = 0.3, lit = 0.2, mast = true } = {}) {
  const rng = mulberry32(Math.floor(seed * 1913) + 7), out = { white: [], red: [], dark: [], glow: [], rail: [] };
  let cw = w, cd = d, cy = y, cz = z;
  for (let i = 0; i < tiers; i++) {
    const h = th * (0.9 + rng() * 0.4), k = rng() < red ? 'red' : 'white';
    out[k].push(new THREE.BoxGeometry(cw, h, cd).translate(x, cy + h / 2, cz));
    // portholes round its faces
    for (const e of [-1, 1]) {
      const m = Math.max(1, Math.floor(cd / 2.4));
      for (let j = 0; j < m; j++) if (rng() < 0.8) (rng() < lit ? out.glow : out.dark).push(new THREE.CircleGeometry(0.42, 8).rotateY(e * Math.PI / 2).translate(x + e * (cw / 2 + 0.03), cy + h * 0.55, cz - cd / 2 + (j + 0.5) * (cd / m)));
      const m2 = Math.max(1, Math.floor(cw / 2.4));
      for (let j = 0; j < m2; j++) if (rng() < 0.8) (rng() < lit ? out.glow : out.dark).push(new THREE.CircleGeometry(0.42, 8).rotateY(e > 0 ? 0 : Math.PI).translate(x - cw / 2 + (j + 0.5) * (cw / m2), cy + h * 0.55, cz + e * (cd / 2 + 0.03)));
    }
    // the railing round its roof
    cy += h;
    out.rail.push(...railRect(x, cy, cz, cw, cd));
    cw *= 0.62 + rng() * 0.2; cd *= 0.55 + rng() * 0.25; cz += (rng() - 0.5) * d * 0.15;
  }
  if (mast) {
    const mh = 8 + rng() * 10;
    out.dark.push(new THREE.CylinderGeometry(0.14, 0.22, mh, 5).translate(x, cy + mh / 2, cz));
    out.dark.push(new THREE.BoxGeometry(cw * 0.9, 0.12, 0.12).translate(x, cy + mh * 0.7, cz));
  }
  return out;
}
/** A railing round a rectangle's roof at y: posts and a top rail. */
function railRect(x, y, z, w, d) {
  const out = [];
  for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
    const A = V(x + (a[0] * w) / 2, y, z + (a[1] * d) / 2), B = V(x + (b[0] * w) / 2, y, z + (b[1] * d) / 2), n = Math.max(1, Math.round(A.distanceTo(B) / 1.4));
    out.push(stick(A.clone().setY(y + 1), B.clone().setY(y + 1), 0.05));
    for (let i = 0; i < n; i++) { const p = A.clone().lerp(B, i / n); out.push(new THREE.BoxGeometry(0.08, 1, 0.08).translate(p.x, y + 0.5, p.z)); }
  }
  return out;
}

/** A straight stick from a to b, r thick. */
export const stick = (a, b, r = 0.06, radial = 4) => new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, r, radial, false);

/**
 * A sailcloth stretched between four corners (A, B one edge, D, C the other: A–B–C–D round it), sagging by `sag` m in
 * its middle, folded in `folds` soft waves across A→B, its free edges drooping in scallops. Double-sided.
 */
export function cloth(A, B, C, D, { sag = 2, folds = 3, fold = 0.35, nu = 18, nv = 10, droop = 0.6, seed = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 613) + 1), pos = [], idx = [], ph = rng() * TAU;
  const a = V(...A), b = V(...B), c = V(...C), d = V(...D), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    p.copy(a).lerp(b, u); q.copy(d).lerp(c, u); p.lerp(q, v);
    // the sag: deepest in the middle; the folds: waves across, fading at the corners; the free ends (v 0, 1) droop between the corners
    p.y -= sag * Math.sin(Math.PI * u) * Math.pow(Math.sin(Math.PI * v), 0.6);
    p.y -= droop * Math.sin(Math.PI * u) * (Math.pow(1 - v, 6) + Math.pow(v, 6)) * (0.6 + 0.4 * Math.sin(u * folds * TAU + ph));
    p.y += fold * Math.sin(u * folds * TAU + ph + v * 0.8) * Math.sin(Math.PI * u) * (0.4 + 0.6 * Math.sin(Math.PI * v));
    pos.push(p.x, p.y, p.z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/**
 * A sailcloth hung from a top edge A→B (sagging by `sag`), falling `drop` m in folds (its hem scalloped, pulled toward
 * `pull` [x, z] m at the hem: a cloth tied back or blown). Double-sided.
 */
export function curtain(A, B, drop, { sag = 1, folds = 5, fold = 0.5, pull = [0, 0], nu = 48, nv = 12, hem = 0.07, seed = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 787) + 3), pos = [], idx = [], ph = rng() * TAU;
  const a = V(...A), b = V(...B), side = V(-(b.z - a.z), 0, b.x - a.x).normalize(), p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    p.copy(a).lerp(b, u);
    // (the hem: a gentle scallop, each fold's middle hanging a little lower than its sides)
    p.y -= sag * Math.sin(Math.PI * u) + v * drop * (1 - hem * 0.5 * (1 - Math.cos(u * folds * TAU + ph)) * v * v);
    const w = Math.sin(u * folds * TAU + ph) * fold * (0.3 + v);
    p.addScaledVector(side, w);
    p.x += pull[0] * v * v; p.z += pull[1] * v * v;
    pos.push(p.x, p.y, p.z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/**
 * A footbridge from A to B ([x, y, z]: its deck's top at each end), w wide: planks, rails both sides, a truss under it,
 * sagging a little. { deck: [geo], wood: [geo], dark: [geo] }.
 */
export function gangway(A, B, { w = 2.4, sag = 0.4, truss = 1.6, rail = true, roofed = false } = {}) {
  const a = V(...A), b = V(...B), out = { deck: [], wood: [], dark: [] }, L = a.distanceTo(b), n = Math.max(4, Math.round(L / 2.5));
  const dir = b.clone().sub(a).normalize(), side = V(-dir.z, 0, dir.x).normalize();
  const at = (t) => a.clone().lerp(b, t).add(V(0, -sag * Math.sin(Math.PI * t), 0));
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), dir, V(0, 1, 0));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = at(t), seg = (L / n) * 1.04;
    out.deck.push(new THREE.BoxGeometry(w, 0.3, seg).applyMatrix4(m).translate(p.x, p.y - 0.15, p.z));
  }
  // the side beams and the truss under: a lower chord and diagonals
  for (const e of [-1, 1]) {
    const o = side.clone().multiplyScalar(e * w * 0.5);
    const top = [], low = [];
    for (let i = 0; i <= n; i++) { const p = at(i / n).add(o); top.push(p.clone().add(V(0, -0.35, 0))); low.push(p.clone().add(V(0, -0.35 - truss * Math.sin(Math.PI * i / n) * 0.7 - truss * 0.3, 0))); }
    out.dark.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), n * 2, 0.16, 4, false));
    out.dark.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(low), n * 2, 0.12, 4, false));
    for (let i = 0; i < n; i++) { out.dark.push(stick(top[i], low[i + 1], 0.07)); out.dark.push(stick(top[i], low[i], 0.06)); }
    if (rail) {
      const rl = [];
      for (let i = 0; i <= n * 2; i++) { const p = at(i / (n * 2)).add(o); out.wood.push(new THREE.BoxGeometry(0.08, 1.05, 0.08).translate(p.x, p.y + 0.52, p.z)); rl.push(p.add(V(0, 1.05, 0))); }
      out.wood.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rl), n * 2, 0.05, 4, false));
    }
  }
  if (roofed) for (let i = 0; i <= n; i += 2) { const p = at(i / n); out.wood.push(stick(p.clone().addScaledVector(side, -w / 2).add(V(0, 1, 0)), p.clone().addScaledVector(side, -w / 2).add(V(0, 2.4, 0)), 0.05)); }
  return out;
}

/** A mooring rope from a (high on a hull) to b (its stake in the salt), sagging by `sag`, r thick. */
export function rope(a, b, { sag = 0.6, r = 0.07, seg = 8 } = {}) {
  const A = V(...a), B = V(...b), pts = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push(A.clone().lerp(B, t).add(V(0, -sag * Math.sin(Math.PI * t), 0))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 3, false);
}
/** A mooring stake at (x, y, z): a leaning post driven into the salt, a block lashed to it, a coil at its foot. */
export function stake(x, y, z, { lean = 0.25, az = 0, h = 0.7 } = {}) {
  const top = V(x + Math.cos(az) * lean, y + h, z + Math.sin(az) * lean);
  return [stick(V(x, y - 0.4, z), top, 0.06, 4), new THREE.BoxGeometry(0.18, 0.18, 0.18).translate(top.x, top.y - 0.15, top.z), new THREE.TorusGeometry(0.22, 0.05, 3, 8).rotateX(Math.PI / 2).translate(x, y + 0.05, z)];
}

/**
 * A shop at a wall's foot, the wall behind it at z = 0 and the street toward +z, centred at x, w wide: a counter heaped
 * with goods, crates and sacks, jars, a sloped sailcloth awning on poles out over it. { wood, cloth, goods: [[geo]…], dark }.
 */
export function stall({ x = 0, y = 0, w = 4, deep = 3.2, seed = 1, goods = 4, high = 3.1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 3457) + 11), out = { wood: [], cloth: [], dark: [], goods: Array.from({ length: goods }, () => []) };
  const g = (k, geo) => out.goods[k % goods].push(geo);
  out.wood.push(new THREE.BoxGeometry(w * 0.9, 0.95, 0.9).translate(x, y + 0.47, deep * 0.55));
  for (let u = -w * 0.4; u < w * 0.4; u += 0.45 + rng() * 0.3) {
    const kind = rng();
    if (kind < 0.5) { const R = 0.2 + rng() * 0.12; g(Math.floor(rng() * goods), new THREE.SphereGeometry(R, 7, 4, 0, TAU, 0, Math.PI / 2).translate(x + u, y + 0.95, deep * 0.55 + (rng() - 0.5) * 0.4)); }
    else if (kind < 0.8) g(Math.floor(rng() * goods), new THREE.CylinderGeometry(0.1, 0.13, 0.35, 6).translate(x + u, y + 1.12, deep * 0.55 + (rng() - 0.5) * 0.4));
    else g(Math.floor(rng() * goods), new THREE.BoxGeometry(0.4, 0.3, 0.35).translate(x + u, y + 1.1, deep * 0.55));
  }
  // crates and sacks before the counter and beside it
  for (let i = 0; i < 3 + Math.floor(rng() * 4); i++) {
    const s = 0.4 + rng() * 0.35, cx = x + (rng() - 0.5) * w * 1.1, cz = deep * (0.75 + rng() * 0.35);
    if (rng() < 0.5) out.wood.push(new THREE.BoxGeometry(s, s * 0.8, s).rotateY(rng()).translate(cx, y + s * 0.4, cz));
    else g(Math.floor(rng() * goods), new THREE.SphereGeometry(s * 0.38, 7, 5).scale(1, 1.15, 1).translate(cx, y + s * 0.4, cz));
  }
  // shelves at the back
  for (const yy of [1.2, 2.0]) {
    out.wood.push(new THREE.BoxGeometry(w * 0.8, 0.06, 0.45).translate(x, y + yy, 0.3));
    for (let u = -w * 0.38; u < w * 0.38; u += 0.3 + rng() * 0.25) g(Math.floor(rng() * goods), new THREE.CylinderGeometry(0.08, 0.1, 0.28, 6).translate(x + u, y + yy + 0.17, 0.3));
  }
  // the poles and the awning: a cloth sloping from the wall out over the counter
  for (const e of [-1, 1]) out.wood.push(new THREE.CylinderGeometry(0.05, 0.06, high - 0.4, 4).translate(x + e * w * 0.48, y + (high - 0.4) / 2, deep));
  out.cloth.push(cloth([x - w * 0.55, y + high + 0.6, 0.05], [x + w * 0.55, y + high + 0.6, 0.05], [x + w * 0.55, y + high - 0.45, deep + 0.4], [x - w * 0.55, y + high - 0.45, deep + 0.4], { sag: 0.25, folds: 2, fold: 0.06, nu: 8, nv: 4, droop: 0.15, seed }));
  return out;
}

/**
 * A resident, standing at (x, y, z) facing yaw: a cloak to the ankles, a hood, now and then a bundle carried (bundle:
 * groceries, hauled aboard). s their scale. { cloak: [geo], skin: [geo], bundle: [geo] }.
 */
export function figure(x, y, z, { s = 1, yaw = 0, bundle = false, hood = true } = {}) {
  const out = { cloak: [], skin: [], bundle: [] }, c = Math.cos(yaw), sn = Math.sin(yaw);
  out.cloak.push(new THREE.CylinderGeometry(0.17 * s, 0.33 * s, 1.35 * s, 8).translate(x, y + 0.67 * s, z));
  out.cloak.push(new THREE.SphereGeometry(0.2 * s, 8, 5).scale(1.15, 0.7, 0.9).translate(x, y + 1.36 * s, z));
  (hood ? out.cloak : out.skin).push(new THREE.SphereGeometry(0.15 * s, 8, 6).translate(x, y + 1.56 * s, z));
  if (bundle) out.bundle.push(new THREE.SphereGeometry(0.26 * s, 7, 5).scale(1, 0.85, 0.8).translate(x - sn * 0.22 * s + c * 0.22 * s, y + 1.05 * s, z - c * 0.22 * s - sn * 0.22 * s));
  return out;
}

/** Merge a list of geometries (or null for none). */
export const merged = (list) => (list.length ? mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))) : null);

// ---------------------------------------------------------------- the world's look (the views and the world)
/**
 * The harbour's touches on the print preset: a clean sky, its shade printed flat in one blue-grey (as the pictures
 * print every shadow on the salt and the hulls), little hatching (the pictures' fine pen lines are the seams), a warm
 * pale haze in bands down the long streets, cast shadows kept whole (the pictures' great blue shadows on the salt).
 */
export const SALT_HAZE = { uHazeLayers: [90, 1.6, 0.14, 4], uHazeTone: [0.86, 0.9, 0.97, 0.75] };
// (colour pass, v0.94: the shade a clearer cerulean printed flatter, the plating's seams and the ropes in a lighter line)
export const SALT_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.3, uShadowFlat: 0.92, uShadeKeep: 0.12, uHalftone: 0.15, uBounce: 0.3, uHatch: 0.25, uFogDensity: 0.0007, uAlbedoEdges: 0.35, uLineWidth: 0.85, uSpot: [0.6, 3, 0.3, 0.1], uSpotTone: [0.22, 0.24, 0.36, 0.35], ...SALT_HAZE };
/** The day's colours (sky top, horizon, shadow, light, sun): a deep clear blue over a blinding salt, the shade blue-grey. */
export const SALT_DAY = ['#5a8cc2', '#c0d6ea', '#4a74ac', '#fff6ea', '#fff2dc'];
/** The surfaces' tones. */
export const SALT_TONES = {
  salt: '#f8f2ea', salt2: '#f1eae4', salt3: '#e9e2de',
  hull: '#eee4d8', hull2: '#e6dccf', red: '#c4664a', red2: '#b65a44', deck: '#a88a70',
  wood: '#8a6448', wood2: '#a07a58', woodDark: '#5c4434', plaster: '#e2cdb4', dark: '#3a3448', glow: '#ffcf86',
  cloth: '#efdfca', cloth2: '#e6d2bc', rope: '#3d3330', iron: '#5a4c48', pot: '#a65a3e', leaves: '#6f8f5a',
  goods: ['#d88a4a', '#e3b85a', '#8aa05a', '#b8584a', '#e8d8b0'],
  cloak: ['#7c4a38', '#a0644a', '#5e5068', '#8a6a52', '#b07a5a'], skin: '#d8a888', travellerBlue: '#4d6a9a', travellerBrown: '#7a4a36', pack: '#d8f0ff',
};
