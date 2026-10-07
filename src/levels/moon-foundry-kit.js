import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { formAxis } from '../form.js';
import { greebles } from './greeble-kit.js';
import { leafCrown } from './garden-kit.js';
import { bar, lathe, latticeTower, trussStair, moveParts, gather } from './antennas-kit.js';

// ---------------------------------------------------------------------------
// The Moon Foundry's shapes, shared by the world (moon-foundry.js) and its reference views
// (reference-moonfoundry.js), after the sheets (references/The Moon Foundry/reference-1 … 4): an abandoned
// monumental workshop where miniature moons were made, under a vast open hangar roof.
//
//   moon         an ivory sphere, its craters drawn as shallow rimmed dents laid on it (their inner wall
//                catches the light as the sheets' crescents do); `cut` breaks it open like an eggshell (a
//                ragged hole, the shell's thickness, its inside of another tone)
//   courtyard    what lives in a broken moon: a floor across its inside, little houses, mint trees, a stair
//   bowl         the lower half of a shell sitting in its cradle, a garden and houses on its rim (sheet 1, left)
//   cradle       the orange mechanical cradle a moon rests in: a drum, claw arms gripping it from below,
//                pistons, knuckles, machinery dressing the drum (greeble-kit)
//   hangRig      a moon hung from the roof: the clamp ring on its crown, the yoke and the hook block, the
//                cables up to the trolley on the girder
//   pillar       an enormous rust column from the floor to the roof: banded, pipes up it, a cage ladder,
//                a platform ring, machinery round its foot
//   roof         the hangar's roof: girder trusses both ways, a dark ceiling over them drawn as a grid, cables
//                hanging from it
//   gantry       a railed truss walkway along points, on legs down to the floor (its deck walked on)
//   house        a small warm home made in the old machinery: walls, a roof, lit windows, a door, a balcony
//   tree         a mint-green puffy tree (garden-kit's leafCrown)
//   jibCrane     a slender lattice crane with its jib and hook (the antennas' lattice, no vines)
// Each returns plain geometries by role in the caller's frame (no materials, no placing in a scene):
//   shell, crater, inner, edge (a moon), rust, rust2 (the machinery's two oranges), dark (pistons, knuckles,
//   greebles), steel (the roof's girders), ceiling, strut (thin bars: trusses, rails, cables, ladders), plank
//   (walked decks), rail (railings: thin, but solid in the world), wall, wall2, roofing (houses), glow (windows), leaf,
//   trunk, floor (a courtyard's), gMetal, gDark, gPale (machinery dressing, greeble-kit: drawn only in the world).
// `detail` (1 the views' near shapes; under 1 the world's and the far ones) thins segments and pieces.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const UP = V(0, 1, 0);
const roles = () => ({ shell: [], crater: [], inner: [], edge: [], rust: [], rust2: [], dark: [], steel: [], ceiling: [], strut: [], rail: [], plank: [], wall: [], wall2: [], roofing: [], glow: [], leaf: [], trunk: [], floor: [], gMetal: [], gDark: [], gPale: [] });
export { gather, moveParts, bar };
/** Plain geometry for merging: no uv, its own normals. */
const plain = (g) => { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1'); return g; };
/** A box from its centre, w × h × d, turned about y. */
const box = (w, h, d, x, y, z, yaw = 0) => plain(new THREE.BoxGeometry(w, h, d)).rotateY(yaw).translate(x, y, z);
/** A beam (a box) from a to b, w wide (sideways, horizontal) and d deep (its other side). */
export function beam(a, b, w, d = w) {
  const dir = b.clone().sub(a), L = dir.length();
  const g = plain(new THREE.BoxGeometry(w, d, L));
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), dir.clone().normalize(), Math.abs(dir.y / L) > 0.98 ? V(1, 0, 0) : UP);
  return g.applyMatrix4(m).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
/** Two unit vectors square to d (a frame round it). */
function frame(d) {
  const t1 = Math.abs(d.y) < 0.9 ? V(0, 1, 0).cross(d).normalize() : V(1, 0, 0).cross(d).normalize();
  return [t1, d.clone().cross(t1).normalize()];
}

// ------------------------------------------------------------------ the look
/** The sheets' haze: pale warm-cream planes from 70 m, the far moons and pillars stepping into it. */
export const MF_HAZE = { uHazeLayers: [130, 1.7, 0.12, 5], uHazeTone: [0.93, 0.92, 0.85, 0.8] };
/** The print preset's touches: no clouds (a roof over all), light hatching, a little spot black in the machinery. */
export const MF_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.12, uHatch: 0.42, uLineWidth: 0.95, uWobble: 0.2, uFogDensity: 0.0009, uSpotTone: [0.2, 0.2, 0.26, 0.4], ...MF_HAZE };
/** The day's colours (sky top, horizon, shadow, light, sun): a pale blue-mint sky, cream at the horizon, a cool grey shade. */
export const MF_DAY = ['#b4d0d6', '#ece6d0', '#9a9cb6', '#fff6e4', '#fff0d0'];
export const MF_DUSK = ['#9fa8c8', '#f2cfa6', '#8a80a8', '#ffe2c4', '#ffc890'];
export const MF_NIGHT = ['#151a34', '#2a3050', '#30365e', '#7278a4', '#dce0f2'];
/** The surfaces' tones, read off the sheets. */
export const MF_TONES = {
  ivory: '#f4e4c8', ivory2: '#eedfc6', plated: '#bdb9b0', ivory3: '#f2e8d4', crater: '#d8c4a4', inner: '#a99a86', innerMint: '#9dc4b4', edge: '#f6eedc',
  rust: '#d4763c', rust2: '#e3975e', rust3: '#b25e36', dark: '#5a3a2e', pale: '#e4b48a',
  steel: '#465260', steel2: '#5a6874', ceiling: '#4a5462', strut: '#3e3634', strutRust: '#8a4a30',
  plank: '#9a6a4c', floor: '#d6cfc0', floor2: '#cdc5b4', floor3: '#ddd7c9', rail: '#4a4040',
  wall: '#d9844e', wall2: '#ead2aa', wall3: '#c9a07a', roofing: '#8a4a34', glow: '#ffd88a', trunk: '#4c4a3e',
  leaf: '#9cc9b4', leaf2: '#86bba8', leaf3: '#b2d6c2', molten: '#ffd466', molten2: '#ff8a3c', molten3: '#fff0a8',
};

// ------------------------------------------------------------------ a moon
/**
 * A shallow dent on a sphere of radius R, centred on the unit direction c, r across: a bowl rising to a rim,
 * then a skirt down into the sphere, each vertex laid on the sphere (so it hugs it however large). Its inner
 * wall faces in: lit on the far side, shaded on the near, as the sheets draw a crater's crescent.
 */
function crater(R, c, r, seg) {
  const [t1, t2] = frame(c), P = [[0, 0.015], [0.45, 0.03], [0.8, 0.12], [1, 0.22], [1.3, -0.05]];
  const pos = [], idx = [], q = V(0, 0, 0);
  for (const [f, h] of P) for (let j = 0; j < seg; j++) {
    const a = (j / seg) * TAU, rho = f * r;
    q.copy(c).multiplyScalar(R).addScaledVector(t1, Math.cos(a) * rho).addScaledVector(t2, Math.sin(a) * rho).normalize().multiplyScalar(R + h * r);
    pos.push(q.x, q.y, q.z);
  }
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + ((j + 1) % seg), d = a + seg, e = b + seg;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** n directions on the sphere, each with its crater's radius: a few large, many small; none in the hole. */
export function craterSpots(R, n, seed = 1, hole = null) {
  const rng = mulberry32(Math.floor(seed * 9173) + 5), out = [];
  for (let t = 0; t < n * 6 && out.length < n; t++) {
    const u = rng() * 2 - 1, a = rng() * TAU, s = Math.sqrt(1 - u * u), c = V(Math.cos(a) * s, u, Math.sin(a) * s);
    const k = rng(), r = R * (0.025 + 0.13 * k * k * k);
    if (hole && c.angleTo(hole.dir) < hole.angle * 1.25 + r / R * 1.4) continue;
    if (out.some((o) => o.c.angleTo(c) * R < (o.r + r) * 0.9)) continue;
    out.push({ c, r });
  }
  return out;
}
/**
 * A moon: an ivory sphere of radius R about the origin, `craters` dents on it. cut: { dir, angle (the hole's half
 * angle, rad), ragged (0..0.5: how broken its edge), thick, sill (rad: round the hole's lowest point the edge never
 * comes in past the hole's angle, so its lip stays under a courtyard's floor and can be walked over) } breaks it
 * open: the shell, its inside (inner) and the edge's thickness (edge). { shell, crater, inner, edge, hole }.
 */
export function moon({ R = 20, seg = 56, craters = 40, seed = 1, cut = null, detail = 1 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 4271) + 3);
  seg = Math.max(16, Math.round(seg * detail));
  let hole = null;
  if (!cut) out.shell.push(plain(new THREE.SphereGeometry(R, seg, Math.ceil(seg / 2))));
  else {
    const d = cut.dir.clone().normalize(), [b1, b2] = frame(d), thick = cut.thick ?? Math.max(0.35, R * 0.03), ragged = cut.ragged ?? 0.25;
    hole = { dir: d, angle: cut.angle };
    const nP = seg, nT = Math.ceil(seg / 2), s0 = rng() * 10;
    // the hole's edge: its polar angle round the axis, broken (a few slow lobes and a jag at every vertex)
    const jag = Array.from({ length: nP }, () => (rng() - 0.5));
    const bottom = b2.y > 0 ? Math.PI * 1.5 : Math.PI * 0.5, sill = cut.sill ?? 0;   // (the azimuth of the hole's lowest point)
    const edgeAt = (j) => {
      const p = (j / nP) * TAU, e = cut.angle * (1 + ragged * (0.55 * Math.sin(3 * p + s0) + 0.35 * Math.sin(5 * p + 2 * s0) + 0.6 * jag[j % nP]));
      const off = Math.abs(Math.atan2(Math.sin(p - bottom), Math.cos(p - bottom)));
      return off < sill ? Math.max(e, cut.angle * 1.02) : e;
    };
    const at = (th, p, r) => d.clone().multiplyScalar(Math.cos(th) * r).addScaledVector(b1, Math.cos(p) * Math.sin(th) * r).addScaledVector(b2, Math.sin(p) * Math.sin(th) * r);
    const sheet = (r, flip) => {
      const pos = [], idx = [];
      for (let i = 0; i <= nT; i++) for (let j = 0; j <= nP; j++) {
        const t0 = edgeAt(j % nP), th = t0 + (Math.PI - t0) * Math.pow(i / nT, 0.9), p = at(th, (j / nP) * TAU, r);
        pos.push(p.x, p.y, p.z);
      }
      for (let i = 0; i < nT; i++) for (let j = 0; j < nP; j++) {
        const a = i * (nP + 1) + j, b = a + 1, c = a + nP + 1, e = c + 1;
        if (flip) idx.push(a, b, c, b, e, c); else idx.push(a, c, b, b, c, e);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    out.shell.push(sheet(R, false));
    out.inner.push(sheet(R - thick, true));
    // the edge: the shell's thickness round the hole, a band from the outside to the inside
    const pos = [];
    for (let j = 0; j < nP; j++) {
      const t0 = edgeAt(j), t1 = edgeAt((j + 1) % nP), p0 = (j / nP) * TAU, p1 = ((j + 1) / nP) * TAU;
      const A = at(t0, p0, R), B = at(t1, p1, R), C = at(t0, p0, R - thick), D = at(t1, p1, R - thick);
      pos.push(...A.toArray(), ...C.toArray(), ...B.toArray(), ...B.toArray(), ...C.toArray(), ...D.toArray());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    out.edge.push(g);
  }
  if (craters > 0) {
    const list = craterSpots(R, craters, seed, hole).map(({ c, r }) => crater(R, c, r, r > R * 0.06 ? Math.round(16 * Math.max(detail, 0.6)) : Math.round(10 * Math.max(detail, 0.6))));
    if (list.length) out.crater.push(mergeGeometries(list));
  }
  return { ...out, hole };
}

// ------------------------------------------------------------------ what lives in a broken moon
/** A mint tree, its foot at (x, y, z), s its crown's half width. { trunk, leaf }. */
export function tree(x, y, z, s = 2, seed = 1, detail = 1) {
  const out = roles(), h = s * 1.2;
  out.trunk.push(bar(V(x, y - 0.2, z), V(x, y + h, z), Math.max(0.08, s * 0.07), Math.max(0.05, s * 0.04), 5));
  out.leaf.push(plain(leafCrown(seed, { lobes: detail < 0.7 ? 4 : 7, detail: detail < 0.7 ? 0 : 1 })).scale(s, s * 0.95, s).translate(x, y + h + s * 0.55, z));
  return out;
}
/**
 * A small warm home made in the old machinery, its foot's centre at (x, y, z), its door toward +z turned by yaw:
 * floors stacked (each a little smaller), lit windows on its faces, a door, a flat roof with a parapet or a
 * pitched one, a balcony now and then, a stove pipe. { wall, wall2, roofing, glow, dark, rust, plank, strut, windows }.
 */
export function house({ x = 0, y = 0, z = 0, w = 6, d = 5, fh = 3, floors = 1, yaw = 0, seed = 1, lit = 0.5, pitched = false, tone = 0, balcony = 0.5, detail = 1 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 6113) + 1), c = Math.cos(yaw), s = Math.sin(yaw), windows = [];
  const P = (lx, ly, lz) => V(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
  const wallRole = tone ? 'wall2' : 'wall';
  let top = 0, ww = w, dd = d, ox = 0;
  for (let f = 0; f < floors; f++) {
    out[f % 2 && floors > 1 ? (tone ? 'wall' : 'wall2') : wallRole].push(box(ww, fh, dd, 0, 0, 0).rotateY(yaw).translate(...P(ox, top + fh / 2, 0).toArray()));
    // windows on the front and sides: a lit pane or a dark one in its frame
    for (const [face, len, nx, nz] of [[0, ww, 0, 1], [1, dd, 1, 0], [2, dd, -1, 0]]) {
      const n = Math.max(1, Math.floor(len / 2.2));
      for (let k = 0; k < n; k++) {
        if (face === 0 && f === 0 && k === Math.floor(n / 2)) continue;   // (the door's place)
        if (rng() < 0.25) continue;
        const u = (k + 0.5) / n - 0.5, ww2 = Math.min(1.1, len / n * 0.5), wh = fh * 0.38;
        const lx = ox + (face === 0 ? u * len : nx * (ww / 2 + 0.03)), lz = face === 0 ? dd / 2 + 0.03 : u * len;
        const q = P(lx, top + fh * 0.55, lz), g = plain(new THREE.PlaneGeometry(face === 0 ? ww2 : ww2, wh)).rotateY(Math.atan2(nx, nz) + yaw).translate(q.x, q.y, q.z);
        const on = rng() < lit;
        out[on ? 'glow' : 'dark'].push(g);
        if (on) windows.push(q.toArray());
        if (detail >= 0.8) { const fr = P(lx + (face === 0 ? 0 : nx * 0.02), top + fh * 0.55 - wh / 2 - 0.08, lz + (face === 0 ? 0.04 : 0)); out.rust.push(box(face === 0 ? ww2 + 0.3 : 0.12, 0.12, face === 0 ? 0.14 : ww2 + 0.3, 0, 0, 0).rotateY(yaw).translate(fr.x, fr.y, fr.z)); }
      }
    }
    top += fh;
    if (f < floors - 1) { const sh = 0.6 + rng() * 0.8; ox += (rng() - 0.5) * sh; ww -= sh; dd -= sh * 0.6; }
  }
  // the door
  { const q = P(0, 1.05, d / 2 + 0.04); out.dark.push(plain(new THREE.PlaneGeometry(1, 2.1)).rotateY(yaw).translate(q.x, q.y, q.z)); }
  // the roof: pitched (a gable, its ridge along x) or flat with a parapet and a stove pipe
  if (pitched) {
    const g = new THREE.BufferGeometry(), hw = ww / 2 + 0.3, hd = dd / 2 + 0.3, rh = Math.min(ww, dd) * 0.35;
    const p = [[-hw, 0, -hd], [hw, 0, -hd], [hw, rh, 0], [-hw, rh, 0], [-hw, 0, hd], [hw, 0, hd]];
    const tri = [0, 3, 1, 1, 3, 2, 4, 5, 3, 5, 2, 3, 0, 4, 3, 1, 2, 5];
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((i) => p[i]), 3));
    g.computeVertexNormals();
    const q = P(ox, top, 0);
    out.roofing.push(g.rotateY(yaw).translate(q.x, q.y, q.z));
  } else {
    const q = P(ox, top + 0.12, 0);
    out.roofing.push(box(ww + 0.3, 0.24, dd + 0.3, 0, 0, 0).rotateY(yaw).translate(q.x, q.y, q.z));
    for (const e of [-1, 1]) { const r = P(ox, top + 0.45, e * (dd / 2 + 0.1)); out.roofing.push(box(ww + 0.3, 0.5, 0.18, 0, 0, 0).rotateY(yaw).translate(r.x, r.y, r.z)); }
  }
  { const a = P(ox + ww * 0.3, top - 0.2, -dd * 0.2), b = a.clone().add(V(0, 1.8 + rng() * 1.5, 0)); out.dark.push(bar(a, b, 0.14, 0.14, 6)); }
  // a balcony on the upper floor's front: its planks, a railing
  if (floors > 1 && rng() < balcony) {
    const by = fh, q = P(0, by, d / 2 + 0.6);
    out.plank.push(box(w * 0.7, 0.14, 1.2, 0, 0, 0).rotateY(yaw).translate(q.x, q.y, q.z));
    const a = P(-w * 0.35, by + 0.95, d / 2 + 1.15), b = P(w * 0.35, by + 0.95, d / 2 + 1.15);
    out.rail.push(bar(a, b, 0.035, 0.035, 4));
    for (let k = 0; k <= 4; k++) { const p = a.clone().lerp(b, k / 4); out.rail.push(bar(p.clone().add(V(0, -0.95, 0)), p, 0.03, 0.03, 3)); }
  }
  return { ...out, windows, top: y + top };
}
/** The height (over a broken moon's centre) of a courtyard's floor just over its hole's lip: ri the inner radius. */
export function lipFloor(ri, dir, angle) {
  const el = Math.asin(THREE.MathUtils.clamp(dir.y / dir.length(), -1, 1));
  return Math.max(-0.82 * ri, ri * Math.sin(el - angle * 0.9) + 0.2);
}
/**
 * The life in a broken moon of radius R (its centre the origin): a floor across its inside just over the hole's lip
 * (fy: given, or from the hole, so the lip hides the floor's front and the houses fill the opening, as the sheets
 * draw them), houses on it toward the back (up to four floors where the shell's curve leaves room), a terrace on the
 * back wall with a house or two on it and its stair, mint trees between. { ...roles, windows, floorR, fy, terrace }.
 */
export function courtyard({ R, thick = 0.6, fy, hole = null, houses = 6, trees = 6, seed = 1, lit = 0.5, detail = 1, toward = V(0, 0, 1), terrace = true } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 2207) + 9), ri = R - thick;
  if (fy === undefined) fy = lipFloor(ri, hole?.dir ?? toward, hole?.angle ?? 0.8);
  const fr = Math.sqrt(Math.max(1, ri * ri - fy * fy));
  // the floor: a disc meeting the inner wall, a little under the wall's line so no seam shows
  out.floor.push(plain(new THREE.CylinderGeometry(fr + 0.2, fr + 0.2, 0.5, Math.max(18, Math.round(40 * detail)))).translate(0, fy - 0.25, 0));
  const back = Math.atan2(-toward.x, -toward.z);   // (the houses stand toward the back, facing the hole)
  const spots = [], windows = [];
  const room = (x, z, r) => Math.sqrt(Math.max(0, ri * ri - (Math.hypot(x, z) + r) ** 2));   // (the shell's height over the centre there)
  const place = (r0, r1, spread, gap = 1.6) => {
    for (let t = 0; t < 50; t++) {
      const a = back + (rng() - 0.5) * spread, rr = r0 + rng() * (r1 - r0), px = Math.sin(a) * rr, pz = Math.cos(a) * rr;
      if (spots.every(([qx, qz, qr]) => Math.hypot(qx - px, qz - pz) > qr + gap)) return [px, pz];
    }
    return null;
  };
  // the terrace on the back wall (the sheets' stairways inside the shells): a deck, a house or two on it, its stair
  let deck = null;
  if (terrace && fr > 7) {
    const ty = fy + 3.4, tw = Math.min(10, fr * 0.7), td = 3.6, tr = Math.sqrt(Math.max(1, ri * ri - ty * ty)) - td / 2 - 0.4, a = back;
    const tx = Math.sin(a) * tr, tz = Math.cos(a) * tr, ca = Math.cos(a), sa = Math.sin(a);
    out.plank.push(box(tw, 0.3, td, tx, ty - 0.15, tz, a));
    for (const e of [-1, 1]) out.rust.push(beam(V(tx + ca * e * tw * 0.4, fy, tz - sa * e * tw * 0.4), V(tx + ca * e * tw * 0.4, ty - 0.3, tz - sa * e * tw * 0.4), 0.3, 0.3));
    const s0 = V(tx + ca * (tw / 2 + 4.4) - sa * 0.9, fy, tz - sa * (tw / 2 + 4.4) - ca * 0.9), s1 = V(tx + ca * (tw / 2 - 0.4) - sa * 0.9, ty, tz - sa * (tw / 2 - 0.4) - ca * 0.9);
    gather(out, renameParts(trussStair(s0.toArray(), s1.toArray(), { w: 1.2, rise: 0.25 }), { frame: 'strut' }));
    const H = house({ x: tx - ca * tw * 0.15, y: ty, z: tz + sa * tw * 0.15, w: Math.min(5, tw * 0.5), d: 2.8, floors: room(tx, tz, 2) - ty > 7 ? 2 : 1, yaw: a + Math.PI, seed: seed * 29, lit, tone: 1, pitched: true, detail });
    gather(out, H); windows.push(...H.windows);
    spots.push([tx, tz, tw * 0.55], [s0.x * 0.5 + s1.x * 0.5, s0.z * 0.5 + s1.z * 0.5, 2.6]);
    deck = { x: tx, y: ty, z: tz, w: tw, d: td, yaw: a };
  }
  for (let i = 0; i < houses; i++) {
    const w = 3.4 + rng() * 3, d = 3 + rng() * 2.2, p = place(fr * 0.15, fr - Math.max(w, d) * 0.7, 2.8);
    if (!p) continue;
    // its upper floors stay under the shell's curve
    const floors = Math.max(1, Math.min(4, Math.floor((room(p[0], p[1], Math.max(w, d) * 0.6) - fy - 1.2) / 3)));
    const yaw = Math.atan2(-p[0], -p[1]) + (rng() - 0.5) * 0.5;
    const H = house({ x: p[0], y: fy, z: p[1], w, d, floors, yaw, seed: seed * 13 + i, lit, tone: i % 3 === 1 ? 1 : 0, pitched: rng() < 0.3, detail });
    gather(out, H);
    windows.push(...H.windows);
    spots.push([p[0], p[1], Math.max(w, d) * 0.6]);
  }
  // the inner wall's old machinery round the back (tangent patches facing in): the sheets' shelves, pipes and stairs
  for (let k = 0, n = Math.round(7 * detail); k < n; k++) {
    const a = back + ((k + 0.5) / n - 0.5) * 2.6, y = fy + 1 + rng() * Math.max(1, ri * 0.5), rr = Math.sqrt(Math.max(1, ri * ri - y * y)) - 0.05;
    const nrm = V(-Math.sin(a), 0, -Math.cos(a)), u = V(Math.cos(a), 0, -Math.sin(a)), w = Math.min(6, rr * 0.5), h = 2.5 + rng() * 3;
    dress(out, seed * 41 + k, V(Math.sin(a) * rr, y, Math.cos(a) * rr).addScaledVector(u, -w / 2), u, UP, nrm, w, h, { density: 1.2, scale: 0.7, depth: 0.5 });
  }
  for (let i = 0; i < trees; i++) {
    const p = place(fr * 0.1, fr - 1.5, 4.8, 0.8);
    if (!p) continue;
    const s = 1.2 + rng() * 1.6;
    gather(out, tree(p[0], fy, p[1], s, seed * 7 + i, detail));
    spots.push([p[0], p[1], s * 0.6]);
  }
  return { ...out, windows, floorR: fr, fy, terrace: deck };
}
/** Parts renamed by role (from: to). */
function renameParts(parts, map) {
  const out = {};
  for (const [k, v] of Object.entries(parts)) if (Array.isArray(v)) (out[map[k] ?? k] ??= []).push(...v);
  return out;
}

/**
 * The lower half of a shell in its cradle (sheet 1, left): a bowl of radius R, cut flat at height `cutY` over its centre
 * (the origin), its rim's thickness, plating seams; a deck across its top with houses and trees. { ...roles, deckY }.
 */
export function bowl({ R = 14, cutY = R * 0.3, thick = 0.6, seed = 1, houses = 2, trees = 3, lit = 0.4, detail = 1, below = 0.5 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 3313) + 7), seg = Math.max(24, Math.round(56 * detail));
  const a0 = Math.acos(THREE.MathUtils.clamp(cutY / R, -1, 1));   // polar angle of the cut from +y
  out.shell.push(plain(new THREE.SphereGeometry(R, seg, Math.ceil(seg / 2), 0, TAU, a0, Math.PI - a0)));
  out.inner.push(plain(new THREE.SphereGeometry(R - thick, seg, Math.ceil(seg / 2), 0, TAU, a0, Math.PI - a0)).scale(-1, 1, 1));
  const rr = Math.sqrt(R * R - cutY * cutY), ri = Math.sqrt((R - thick) ** 2 - cutY * cutY);
  out.edge.push(plain(new THREE.RingGeometry(ri, rr, seg, 1)).rotateX(-Math.PI / 2).translate(0, cutY + 0.01, 0));
  // a ring of round ports below the rim (sheet 1 draws them as a row of circles)
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU, el = Math.asin(THREE.MathUtils.clamp(cutY / R, -1, 1)) - 0.22, n = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const g = plain(new THREE.CylinderGeometry(R * 0.035, R * 0.035, 0.25, 12)).rotateX(Math.PI / 2);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n)).translate(n.x * R, n.y * R, n.z * R);
    out.dark.push(g);
  }
  // the deck over it a little under the rim, houses and trees on it
  const deckY = cutY - below;   // (below: the deck that far under the rim; 0 level with it, walked onto)
  out.floor.push(plain(new THREE.CylinderGeometry(ri + 0.1, ri + 0.1, 0.4, seg)).translate(0, deckY - 0.2, 0));
  const windows = [];
  for (let i = 0; i < houses; i++) {
    const a = (i / Math.max(1, houses)) * 2.4 + rng() * 0.6 + 0.4, r = ri * (0.35 + rng() * 0.25);
    const H = house({ x: Math.cos(a) * r, y: deckY, z: Math.sin(a) * r, w: 4 + rng() * 3, d: 3.4 + rng() * 2, floors: 1 + Math.floor(rng() * 2), yaw: rng() * TAU, seed: seed * 5 + i, lit, detail });
    gather(out, H); windows.push(...H.windows);
  }
  for (let i = 0; i < trees; i++) { const a = rng() * TAU, r = ri * (0.4 + rng() * 0.45); gather(out, tree(Math.cos(a) * r, deckY, Math.sin(a) * r, 2 + rng() * 1.8, seed * 3 + i, detail)); }
  return { ...out, windows, deckY, rimR: rr };
}

// ------------------------------------------------------------------ the machinery
/** Dress a rectangle of a face with greebles (greeble-kit), in their own roles: gMetal, gDark, gPale. */
function dress(out, seed, o, u, v, n, w, h, opts) {
  const m = greebles(seed).patch(o, u, v, n, w, h, opts).merged();
  if (m.metal) out.gMetal.push(m.metal);
  if (m.dark) out.gDark.push(m.dark);
  if (m.pale) out.gPale.push(m.pale);
}
/**
 * The cradle a moon of radius R rests in, its centre `yc` over the floor at the origin: a low drum on the floor, `arms`
 * claw arms rising from it out and up to grip the moon below its middle, pistons from the drum to each arm's elbow,
 * knuckles at the joints, machinery round the drum; skip: [azimuth, half width] leaves that side free. { rust, rust2, dark,
 * strut, top (the drum's top) }.
 */
export function cradle({ R = 20, yc = R * 1.15, arms = 4, rot = 0, seed = 1, detail = 1, drum = 0.62, dressing = 1, skip = null } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 5021) + 3), dh = Math.max(1.6, yc - R * 1.02), seg = Math.max(16, Math.round(32 * detail));
  // the drum: from the floor up to just under the moon, a flare at its foot and a collar at its top
  const r0 = R * drum;
  out.rust2.push(plain(lathe([[r0 * 1.12, 0], [r0 * 1.1, 0.6], [r0, 0.9], [r0, dh - 0.8], [r0 * 1.06, dh - 0.6], [r0 * 1.06, dh], [r0 * 0.4, dh + 0.05]], seg)));
  out.dark.push(plain(new THREE.TorusGeometry(r0 * 1.03, 0.25, 4, seg)).rotateX(Math.PI / 2).translate(0, dh * 0.55, 0));
  // machinery round the drum's waist (tangent patches)
  if (dressing > 0) for (let k = 0, n = Math.round(10 * detail); k < n; k++) {
    const a = (k / n) * TAU + rng() * 0.3, nrm = V(Math.cos(a), 0, Math.sin(a)), u = V(-Math.sin(a), 0, Math.cos(a)), w = Math.min(TAU * r0 / n * 0.9, 9);
    dress(out, seed * 31 + k, nrm.clone().multiplyScalar(r0 + 0.02).addScaledVector(u, -w / 2).add(V(0, 1, 0)), u, UP, nrm, w, Math.max(1, dh - 2), { density: 0.9 * dressing, scale: Math.max(0.8, R / 20), depth: 0.6 });
  }
  // the arms: base → elbow (out past the moon's side) → grip (on it below its middle) → tip (a claw along it)
  const W = R * 0.11, D = R * 0.075;
  for (let k = 0; k < arms; k++) {
    const a = rot + (k / arms) * TAU, ca = Math.cos(a), sa = Math.sin(a), P = (r, y) => V(ca * r, y, sa * r);
    // (skip: [azimuth, half width]: no arm there, where a broken moon's hole is: it would cross the opening)
    if (skip && Math.abs(Math.atan2(Math.sin(a - skip[0]), Math.cos(a - skip[0]))) < skip[1]) continue;
    const elG = -0.62 - rng() * 0.12, elT = -0.12 + rng() * 0.12;
    const On = (el) => P((R + D * 0.9) * Math.cos(el), yc + (R + D * 0.9) * Math.sin(el));   // (a point standing off the moon along its normal)
    const base = P(r0 * 0.9, dh * 0.6), elbow = P(R * 1.08, yc - R * 0.78), grip = On(elG), tip = On(elT);
    // (the claw's finger follows the moon's curve in two pieces: one straight bar from grip to tip would cut a chord into it)
    const mid = On((elG + elT) / 2);
    out.rust.push(beam(base, elbow, W, D), beam(elbow, grip, W * 0.9, D), beam(grip, mid, W * 0.75, D * 0.85), beam(mid, tip, W * 0.65, D * 0.75));
    // a pad where it grips, and knuckles across the joints
    const tg = V(-sa, 0, ca);
    for (const [p, r] of [[base, W * 0.55], [elbow, W * 0.6], [grip, W * 0.5]]) out.dark.push(plain(new THREE.CylinderGeometry(r, r, D * 1.5, 12)).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, tg)).translate(p.x, p.y, p.z));
    // the piston: from the drum's top to halfway up the arm, its rod and its sleeve
    const pa = P(r0 * 0.5, dh + 0.2), pb = elbow.clone().lerp(grip, 0.45), pm = pa.clone().lerp(pb, 0.55);
    out.dark.push(bar(pa, pm, W * 0.22, W * 0.22, 10, true));
    out.rust2.push(bar(pm.clone().lerp(pa, 0.1), pb, W * 0.12, W * 0.12, 8, true));
    // hoses along the arm
    if (detail >= 0.7) out.strut.push(bar(base.clone().add(V(0, D * 0.8, 0)), elbow.clone().add(V(0, D * 0.8, 0)), 0.09, 0.09, 4), bar(elbow.clone().addScaledVector(tg, W * 0.6), grip.clone().addScaledVector(tg, W * 0.6), 0.08, 0.08, 4));
  }
  return { ...out, top: dh };
}
/**
 * A moon of radius R hung by its crown from a girder at height `top` (its centre the origin): the clamp ring on its
 * crown and its claws, the yoke over it, the hook block, `cables` cables up to the trolley. { rust, dark, strut }.
 */
export function hangRig({ R = 18, top = 60, cables = 2, seed = 1, detail = 1, ring = 0.32 } = {}) {
  const out = roles(), rr = R * ring, ry = Math.sqrt(R * R - rr * rr), seg = Math.max(16, Math.round(36 * detail));
  out.rust.push(plain(new THREE.TorusGeometry(rr, Math.max(0.25, R * 0.025), 6, seg)).rotateX(Math.PI / 2).translate(0, ry + 0.1, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3, c = Math.cos(a), s = Math.sin(a);
    const p0 = V(c * rr, ry + 0.2, s * rr), el = Math.asin(ry / R) - 0.18, p1 = V(c * R * Math.cos(el) * 1.02, R * Math.sin(el) * 1.02, s * R * Math.cos(el) * 1.02);
    out.rust.push(beam(p0, p1, R * 0.04, R * 0.03));
    out.dark.push(beam(p0, V(0, R + R * 0.12, 0), R * 0.025, R * 0.025));
  }
  const hy = R + R * 0.14;
  out.rust2.push(box(R * 0.16, R * 0.1, R * 0.12, 0, hy + R * 0.05, 0));
  out.dark.push(plain(new THREE.TorusGeometry(R * 0.05, R * 0.012, 6, 14, Math.PI)).rotateZ(Math.PI).translate(0, hy + R * 0.13, 0));
  const blockY = hy + R * 0.28;
  out.rust.push(box(R * 0.12, R * 0.16, R * 0.1, 0, blockY, 0));
  out.dark.push(plain(new THREE.CylinderGeometry(R * 0.05, R * 0.05, R * 0.11, 12)).rotateX(Math.PI / 2).translate(0, blockY + R * 0.04, 0));
  for (let k = 0; k < cables; k++) {
    const dx = (k - (cables - 1) / 2) * R * 0.06;
    out.strut.push(bar(V(dx, blockY + R * 0.05, 0), V(dx * 1.6, top - 1.2, 0), 0.07, 0.07, 4));
  }
  out.rust2.push(box(R * 0.3, 1.4, 3, 0, top - 0.6, 0));
  out.dark.push(box(R * 0.36, 0.5, 2.2, 0, top - 1.45, 0));
  return out;
}
/**
 * An enormous rust column, its foot at the origin, h tall, r round: a flared foot and a capital, rings up it at
 * uneven heights, pipes up one side, a cage ladder, a platform ring, machinery round its foot. { rust, rust2, dark, strut, plank }.
 */
export function pillar({ h = 80, r = 3, seed = 1, detail = 1, pipes = 3, ladder = true, platform = 0.62, dressing = 1, rings = 7 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 7477) + 5), seg = Math.max(12, Math.round(24 * detail));
  out.rust.push(formAxis(plain(lathe([[r * 1.5, -0.5], [r * 1.45, 1.2], [r * 1.12, 2.2], [r, 3.2], [r, h - 4], [r * 1.2, h - 2.6], [r * 1.5, h - 1], [r * 1.5, h + 0.5]], seg)), 'wrap'));
  // rings at uneven heights (a sleeve now and then, a band otherwise)
  for (let y = 5 + rng() * 4, i = 0; y < h - 6 && i < rings; y += h / rings * (0.6 + rng() * 0.8), i++) {
    const tall = rng() < 0.35 ? 1.6 + rng() * 2.4 : 0.5;
    out.rust2.push(plain(new THREE.CylinderGeometry(r * 1.06, r * 1.06, tall, seg)).translate(0, y, 0));
  }
  // pipes up its side, standing off on brackets
  const side = rng() * TAU;
  for (let k = 0; k < pipes; k++) {
    const a = side + (k - (pipes - 1) / 2) * 0.32, pr = 0.18 + rng() * 0.22, px = Math.cos(a) * (r + pr + 0.2), pz = Math.sin(a) * (r + pr + 0.2), top = h * (0.5 + rng() * 0.45);
    out.dark.push(plain(new THREE.CylinderGeometry(pr, pr, top, 8, 1, true)).translate(px, top / 2, pz));
  }
  // a cage ladder up the other side: two rails, hoops every 2.5 m
  if (ladder) {
    const a = side + Math.PI * 0.75, c = Math.cos(a), s = Math.sin(a), t = V(-s, 0, c), o = V(c * (r + 0.35), 0, s * (r + 0.35)), lh = h * 0.8;
    for (const e of [-1, 1]) out.rail.push(bar(o.clone().addScaledVector(t, e * 0.25), o.clone().addScaledVector(t, e * 0.25).add(V(0, lh, 0)), 0.035, 0.035, 3));
    if (detail >= 0.7) for (let y = 3; y < lh; y += 2.5) out.rail.push(plain(new THREE.TorusGeometry(0.42, 0.025, 3, 8, Math.PI)).rotateX(Math.PI / 2).rotateY(-a + Math.PI / 2).translate(o.x + c * 0.15, y, o.z + s * 0.15));
  }
  // a platform ring partway up (planks and a rail)
  if (platform > 0) {
    const py = h * platform, n = Math.max(12, Math.round(20 * detail));
    out.plank.push(plain(new THREE.RingGeometry(r * 1.02, r + 1.6, n, 1)).rotateX(-Math.PI / 2).translate(0, py, 0), plain(new THREE.RingGeometry(r * 1.02, r + 1.6, n, 1)).rotateX(Math.PI / 2).translate(0, py - 0.05, 0));
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, R1 = r + 1.5; out.strut.push(bar(V(Math.cos(a) * R1, py + 1, Math.sin(a) * R1), V(Math.cos(a1) * R1, py + 1, Math.sin(a1) * R1), 0.03, 0.03, 3)); if (k % 2 === 0) out.strut.push(bar(V(Math.cos(a) * R1, py, Math.sin(a) * R1), V(Math.cos(a) * R1, py + 1, Math.sin(a) * R1), 0.03, 0.03, 3)); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; out.dark.push(beam(V(Math.cos(a) * r, py - 2.2, Math.sin(a) * r), V(Math.cos(a) * (r + 1.5), py - 0.1, Math.sin(a) * (r + 1.5)), 0.2, 0.2)); }
  }
  // machinery round its foot
  if (dressing > 0) for (let k = 0, n = Math.max(3, Math.round(6 * detail)); k < n; k++) {
    const a = (k / n) * TAU + rng(), nrm = V(Math.cos(a), 0, Math.sin(a)), u = V(-Math.sin(a), 0, Math.cos(a)), w = Math.min(TAU * r / n, 5);
    dress(out, seed * 17 + k, nrm.clone().multiplyScalar(r + 0.02).addScaledVector(u, -w / 2).add(V(0, 3.4, 0)), u, UP, nrm, w, 6 + rng() * 8, { density: 1.1 * dressing, scale: 0.8, depth: 0.5 });
  }
  return out;
}
/**
 * The hangar's roof over x0 … x1, z0 … z1 at height y (its girders' top): girder trusses along x every `bay` in z and
 * along z every `bay` in x (a top and a bottom chord, the web between), a ceiling over them, cables hanging from it.
 * { steel, strut, ceiling }.
 */
export function roof({ x0 = -100, x1 = 100, z0 = -100, z1 = 100, y = 60, bay = 24, depth = 3.2, web = 4, cables = 0, seed = 1, detail = 1, ceiling = true } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 1999) + 1), c = 0.55;
  const girder = (a, b) => {
    out.steel.push(beam(a, b, c, c), beam(a.clone().add(V(0, -depth, 0)), b.clone().add(V(0, -depth, 0)), c * 0.8, c * 0.8));
    const L = a.distanceTo(b), n = Math.max(2, Math.round(L / web * detail));
    for (let i = 0; i < n; i++) {
      const p = a.clone().lerp(b, i / n), q = a.clone().lerp(b, (i + 1) / n);
      out.strut.push(bar(i % 2 ? p : p.clone().add(V(0, -depth, 0)), i % 2 ? q.clone().add(V(0, -depth, 0)) : q, 0.09, 0.09, 4));
      if (detail >= 0.8 || i % 2 === 0) out.strut.push(bar(p, p.clone().add(V(0, -depth, 0)), 0.08, 0.08, 4));
    }
  };
  for (let z = z0; z <= z1 + 0.01; z += bay) girder(V(x0, y, z), V(x1, y, z));
  for (let x = x0; x <= x1 + 0.01; x += bay) girder(V(x, y + 0.02, z0), V(x, y + 0.02, z1));
  if (ceiling) out.ceiling.push(plain(new THREE.PlaneGeometry(x1 - x0 + bay * 0.5, z1 - z0 + bay * 0.5, Math.max(1, Math.round((x1 - x0) / 40)), Math.max(1, Math.round((z1 - z0) / 40)))).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y + 0.6, (z0 + z1) / 2));
  for (let i = 0; i < cables; i++) {
    const x = x0 + rng() * (x1 - x0), z = z0 + Math.round(rng() * (z1 - z0) / bay) * bay, L = 6 + rng() * rng() * (y * 0.7);
    out.strut.push(bar(V(x, y - depth, z), V(x, y - depth - L, z), 0.05, 0.05, 3));
  }
  return out;
}
/**
 * A railed truss walkway along pts ([x, y, z]…, its deck's top), w wide: a deck of planks per segment, a truss under
 * each side (chords, posts, diagonals), a railing (none within a gap: [[x, z, r]…], where another way meets it), legs
 * down to the floor (ground(x, z)) every `span` m.
 * { plank (walked), rust (the legs and chords), strut (the web and the rails) }.
 */
export function gantry(pts, { w = 2.6, truss = 1.4, rail = true, span = 16, ground = () => 0, legs = true, detail = 1, deck = 0.3, gaps = [] } = {}) {
  const open = (p) => gaps.some(([x, z, r]) => Math.hypot(p.x - x, p.z - z) < r);
  const out = roles(), P = pts.map((p) => V(...p));
  let run = span * 0.5;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], d = b.clone().sub(a), L = d.length(), dir = d.clone().normalize(), side = V(-dir.z, 0, dir.x).normalize();
    out.plank.push(beam(a.clone().add(V(0, -deck / 2, 0)), b.clone().add(V(0, -deck / 2, 0)), w, deck));
    const n = Math.max(1, Math.round(L / 2.4));
    for (const e of [-1, 1]) {
      const o = side.clone().multiplyScalar(e * (w / 2 - 0.1)), lo = V(0, -deck - truss, 0), top = V(0, -deck, 0);
      out.rust.push(beam(a.clone().add(o).add(top), b.clone().add(o).add(top), 0.22, 0.22), beam(a.clone().add(o).add(lo), b.clone().add(o).add(lo), 0.18, 0.18));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n).add(o), q = a.clone().lerp(b, (k + 1) / n).add(o);
        out.strut.push(bar(p.clone().add(top), p.clone().add(lo), 0.06, 0.06, 4));
        if (detail >= 0.6) out.strut.push(bar(k % 2 ? p.clone().add(top) : p.clone().add(lo), k % 2 ? q.clone().add(lo) : q.clone().add(top), 0.05, 0.05, 3));
      }
      if (rail) for (let k = 0; k < n; k++) {
        // (a bay of railing at a time: none where a gap is)
        const p = a.clone().lerp(b, k / n).add(o), q = a.clone().lerp(b, (k + 1) / n).add(o);
        if (open(p) || open(q)) continue;
        const r0 = p.clone().add(V(0, 1.05, 0)), r1 = q.clone().add(V(0, 1.05, 0));
        out.rail.push(bar(r0, r1, 0.045, 0.045, 4), bar(r0.clone().add(V(0, -0.5, 0)), r1.clone().add(V(0, -0.5, 0)), 0.03, 0.03, 3), bar(p, r0, 0.035, 0.035, 3));
        if (k === n - 1 || open(a.clone().lerp(b, (k + 2) / n).add(o))) out.rail.push(bar(q, r1, 0.035, 0.035, 3));
      }
    }
    // legs every `span` along the way: two posts down to the floor, braced
    if (legs) for (; run < L; run += span) {
      const p = a.clone().addScaledVector(dir, run), g = ground(p.x, p.z), hh = p.y - deck - truss - g;
      if (hh < 1) continue;
      for (const e of [-1, 1]) { const q = p.clone().addScaledVector(side, e * (w / 2 - 0.15)); out.rust.push(beam(V(q.x, g - 0.3, q.z), V(q.x, p.y - deck - truss, q.z), 0.32, 0.32)); }
      const l = p.clone().addScaledVector(side, -(w / 2 - 0.15)), r = p.clone().addScaledVector(side, w / 2 - 0.15);
      for (let y = g + 2, k = 0; y < p.y - deck - truss - 1; y += 4, k++) out.strut.push(bar(V(l.x, y, l.z), V(r.x, Math.min(y + 4, p.y - deck - truss), r.z), 0.07, 0.07, 3));
    }
    run -= L;
  }
  return out;
}
/** A slender lattice crane, its foot at the origin: the mast, the jib along +x, its counter-jib, a hook hanging on its cable. { rust, strut, dark }. */
export function jibCrane({ h = 40, jib = 22, seed = 1, detail = 1, hook = 18 } = {}) {
  const out = roles();
  const L = latticeTower({ h, w0: 1.2, w1: 0.9, legs: 4, bay: 2.4, r: 0.13, s: 0.06, vines: 0, hang: 0, seed, detail, foot: 0.3 });
  out.strut.push(...L.iron);
  const y = h + 0.6;
  for (const [e, len] of [[1, jib], [-1, jib * 0.35]]) {
    const a = V(0, y, 0), b = V(e * len, y, 0);
    out.rust.push(beam(a.clone().add(V(0, 0, -0.5)), b.clone().add(V(0, 0, -0.5)), 0.25, 0.25), beam(a.clone().add(V(0, 0, 0.5)), b.clone().add(V(0, 0, 0.5)), 0.25, 0.25), beam(a.clone().add(V(0, 1.3, 0)), b.clone().add(V(0, 1.3, 0)), 0.2, 0.2));
    const n = Math.max(2, Math.round(len / 2 * detail));
    for (let k = 0; k < n; k++) { const p = a.clone().lerp(b, k / n), q = a.clone().lerp(b, (k + 1) / n); out.strut.push(bar(p.clone().add(V(0, 1.3, 0)), q.clone().add(V(0, 0, k % 2 ? 0.5 : -0.5)), 0.05, 0.05, 3)); }
  }
  out.rust2.push(box(2.2, 2.2, 2.2, 0, y + 1.6, 0), box(2.6, 2, 2, -jib * 0.33, y - 0.8, 0));
  const hx = jib * 0.8;
  out.strut.push(bar(V(hx, y - 0.2, 0), V(hx, y - hook, 0), 0.04, 0.04, 3));
  out.dark.push(box(0.8, 1, 0.6, hx, y - hook - 0.5, 0), plain(new THREE.TorusGeometry(0.35, 0.08, 4, 10, Math.PI * 1.4)).translate(hx, y - hook - 1.3, 0));
  return out;
}

// ------------------------------------------------------------------ the last furnace's pour (the world)
/**
 * A pour of molten metal from (0, 0, 0) falling `drop` m: a stream drawn as stacked rings of three flat hot tones that
 * march down it (a printed band pattern, not a light), widening into a splash at its foot. Returns { bands: [geo, geo,
 * geo] (one per tone, positions only, their y as the band's phase), move(t) (shifts the bands down the stream) }.
 */
export function pourStream({ drop = 8, r = 0.35, rings = 18 } = {}) {
  const segs = [], step = drop / rings;
  for (let i = 0; i < rings; i++) {
    const t = i / rings, rr = r * (1 - 0.25 * Math.sin(t * Math.PI)) * (t > 0.9 ? 1 + (t - 0.9) * 8 : 1);
    segs.push(plain(new THREE.CylinderGeometry(rr * 1.02, rr, step * 1.02, 10, 1, true)).translate(0, -(i + 0.5) * step, 0));
  }
  return { segs, step };
}
