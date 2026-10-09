import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { thinBar } from '../thin.js';
import { shrubs, puffGeo, boulder } from './underside-kit.js';
import { figure, stick } from './salt-harbour-kit.js';

// ---------------------------------------------------------------------------
// The Overnight Train's shapes, shared by the world (overnight-train.js) and its reference views
// (reference-overnighttrain.js), after the pictures (references/levels/The Overnight Train/environment/reference-1 … 4): a long
// streamlined train crossing a flat lavender plain at dusk under two moons, its rounded carriages in plum and
// silver-lavender, rows of lit orange windows, a great round nose with a railed balcony full of people, gardens
// growing on the roofs, pink pennants streaming back, and a salmon cloud of dust kicked up along its wheels.
//
//   profile     a carriage's cross-section (half, mirrored): a tucked skirt, upright sides, a rounded roof
//   shell       a carriage's body from it: outer skin, inner skin, window openings and their reveals, or
//               closed by glowing panes (the carriages you never enter)
//   endWall     a carriage's end, its door; nose: the lead carriage's round prow, open onto its balcony
//   bogie       wheels in a frame (big spoked drive wheels on the lead carriage); underframe: tanks, boxes
//   porch       the railed platform at a carriage's end, the plate across the gap, the ladder to the roof
//   furniture   armchairs, tables with their lamps, bunks, shelves, a counter
//   pennant     a long streamer; garden: planters and bushes on a roof
//   dust        the salmon cloud along the wheels (puffs, laid out by dustPuffs)
//   scenery     telegraph poles and their wires, stones, far buttes, a station (platform, house, lamps)
//   train       the whole train from a list of carriages (TRAIN_LAYOUT in the world; the views their own)
// Coordinates: the train runs along +x (its nose at the largest x), y up from the plain (0), z across.
// Each returns plain geometries in the caller's frame, grouped by role, or adds to a RoomKit with the materials of
// trainMats(kit). `detail` (1 the views, under 1 the world) thins the segments.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;
const push = (out, k, g) => { (out[k] ??= []).push(g); return g; };
export { stick };

/** The train's measures (m): rails' top, the carriages' floor, half their width, a carriage's length, the gap between two. */
export const TR = { rail: 0.95, floor: 2.7, half: 3.0, car: 26, gap: 2.4, gauge: 3.4, wall: 0.15, crown: 4.5, sill: 1.0, head: 2.55 };
/** The roof walk's top over the floor (planks laid along the crown). */
TR.walk = TR.crown + 0.1;

// ------------------------------------------------------------------ the look
/** The lamps' light on the walls inside: a warm amber (makeMaterial lampTint). */
export const LAMP_TINT = ['#ffa860', 0.55];
/** The surfaces' tones, read off the pictures. */
export const TRAIN_TONES = {
  hull: '#7c6ca8', hull2: '#70609c', hull3: '#8a7ab4', plum: '#7a5080', plum2: '#6a4474', roof: '#6a5c96', skirt: '#4a4078',
  frame: '#3a2e4c', iron: '#2c2638', steel: '#6e6890', brass: '#c89a5a',
  glow: '#ff8a3a', pane: '#ffa24a', lamp: '#ffc878', ceil: '#ff9c5c',
  wood: '#7a3e30', wood2: '#94523c', panel: '#b85a3a', floor: '#5e3a34', rug: '#9a3a40', plush: '#8a2e3c', plush2: '#5e4a7a', linen: '#f4ece0', brassDark: '#8a6a3a',
  plank: '#6e5a62', shrub: '#3e5a48', shrub2: '#4e6a4e', leaves: '#5a7a52', pot: '#9a5a44', pennant: '#ec8a86', pennant2: '#f2a088',
  dust: '#f49c88', dust2: '#f6b49a',
  plain: '#7e70b8', streak: '#221c46', ballast: '#4a4074', sleeper: '#2e2840', rails: '#c8bce0',
  pole: '#3a3050', wire: '#2a2440', stone: '#7a6aae', butte: '#8a78b8', station: '#c8a8c0', station2: '#b08aa8', roofTile: '#6a4e7a',
  moon: '#fff4e0',
  cloak: ['#6a4e8a', '#8a5a6a', '#4e5a8a', '#a0607a', '#5a4a6a', '#7a6a9a'], skin: '#e0a890',
};
/** The day's colours (sky top, horizon, shadow, light, sun): a pale lavender day over the plain. */
export const TRAIN_DAY = ['#7c94d0', '#f0d6d4', '#8a82c0', '#fff4ec', '#fff0dc'];
/** Dusk: the plain rose under a violet sky, the sun low and gold. */
export const TRAIN_DUSK = ['#5e66b0', '#f4a890', '#6a5aa0', '#ffd4c0', '#ffb890'];
/** The night the pictures draw: a deep blue-violet sky to a rose band at the horizon, the plain lavender in the moons' light. */
export const TRAIN_NIGHT = ['#42509a', '#e88a90', '#4c4a90', '#d6bce2', '#fff0e0'];
/** The haze: stepped rose-lavender bands over the plain, so the far end of the train and the far buttes go pale. */
export const TRAIN_HAZE = { uHazeLayers: [260, 1.7, 0.12, 4], uHazeTone: [0.9, 0.66, 0.76, 0.7] };
/**
 * The train's touches on the print preset: no clouds in the sky (the dust is the cloud), a grain on it, the shade printed
 * flat in one deep blue-violet (the pictures' shaded flanks are one tone), little hatching, few spot blacks but deep ones
 * under the carriages, no pen dots on the plain (they would stand still while the plain runs past).
 */
export const TRAIN_LOOK = {
  uClouds: 0, uCumulus: 0, uSkyDots: 0.55, uShadowFlat: 0.8, uShadeKeep: 0.15, uHalftone: 0.16, uBounce: 0.12, uHatch: 0.28, uDots: 0,
  uFogDensity: 0.00032, uSpot: [0.7, 3, 0.3, 0.12], uSpotTone: [0.16, 0.14, 0.26, 0.45], uCast: [0.35, 0.2], ...TRAIN_HAZE,
  // the sky a gradient, not the print's flat tint (October 2026 colour pass): the pictures' rose band climbs a little way up
  // the sky into the blue-violet, where the flat sky kept only a thin pale line on the horizon (mostly gradient)
  uSkyFlat: 0.3,
};

/** The train's materials, made by the kit (shared per option set). */
export function trainMats(kit, { lamps = true } = {}) {
  const T = TRAIN_TONES, DS = THREE.DoubleSide, LT = lamps ? { lampTint: LAMP_TINT } : {};
  // (inside, everything is in the moons' shade under the roof: lit by the lamps, it keeps its own hue, lifted, instead of
  // the world's flat blue-violet print that would turn the whole carriage to one tone)
  const IN = { shadeHue: 1, shade: 0.55, ...LT };
  return {
    // the hull: painted steel plates, their seams drawn; the roof a shade deeper; the skirt and the frames dark
    hull: kit.mat({ color: T.hull, color2: T.hull3, plates: 2.4, flat: true, hatch: 0.45, ...LT }),
    plum: kit.mat({ color: T.plum, color2: T.plum2, plates: 2.4, flat: true, hatch: 0.45, ...LT }),
    roof: kit.mat({ color: T.roof, plates: 3, flat: true, hatch: 0.4, ...LT }),
    skirt: kit.mat({ color: T.skirt, flat: true, hatch: 0.5, ...LT }),
    frame: kit.mat({ color: T.frame, flat: true, ...LT }),
    iron: kit.mat({ color: T.iron, flat: true, metal: 'iron' }),
    steel: kit.mat({ color: T.steel, flat: true, metal: 'steel', ...LT }),
    brass: kit.mat({ color: T.brass, flat: true, metal: 'brass', ...LT }),
    rod: kit.mat({ color: T.frame, flat: true, thin: 1.3 }),
    // the light: the windows of the closed carriages, the lamps' shades, the ceilings' lamp strips
    pane: kit.mat({ color: T.pane, glow: 1, flat: true, spot: 0 }),
    glow: kit.mat({ color: T.glow, glow: 0.9, flat: true, spot: 0 }),
    lamp: kit.mat({ color: T.lamp, glow: 1, flat: true, spot: 0, line: 0.5, lineTint: 0.6 }),
    // inside: a warm cream ceiling lit from within (it reads as light through the windows), wood panels, plush
    ceil: kit.mat({ color: T.ceil, glow: 0.5, flat: true, hatch: 0.2, spot: 0, ...IN }),
    panel: kit.mat({ color: T.panel, glow: 0.22, flat: true, pattern: 'cracks', ...IN }),
    wood: kit.mat({ color: T.wood, flat: true, glow: 0.06, ...IN }),
    wood2: kit.mat({ color: T.wood2, flat: true, glow: 0.06, ...IN }),
    floor: kit.mat({ color: T.floor, flat: true, glow: 0.05, ...IN }),
    rug: kit.mat({ color: T.rug, flat: true, hatch: 0.3, glow: 0.08, ...IN }),
    plush: kit.mat({ color: T.plush, flat: true, glow: 0.08, ...IN }),
    plush2: kit.mat({ color: T.plush2, flat: true, glow: 0.08, ...IN }),
    linen: kit.mat({ color: T.linen, flat: true, glow: 0.12, ...IN }),
    plank: kit.mat({ color: T.plank, flat: true, line: 0.6, lineTint: 0.5, ...LT }),
    // the gardens on the roofs, the pennants (soft long shapes: a light line of their own)
    shrub: [T.shrub, T.shrub2].map((c) => kit.mat({ color: c, pattern: 'leaves', hatch: 0.5, shade: 0.35, line: 0.6, lineTint: 0.7 })),
    leaves: kit.mat({ color: T.leaves, pattern: 'leaves', hatch: 0.5, shade: 0.4, line: 0.7, lineTint: 0.7 }),
    pot: kit.mat({ color: T.pot, flat: true, ...LT }),
    pennant: [T.pennant, T.pennant2].map((c) => kit.mat({ color: c, side: DS, shade: 0.25, hatch: 0.2, line: 0.6, lineTint: 0.6, glow: 0.15 })),
    // the dust: a cloud's print, lit salmon even in the dusk
    dust: kit.mat({ color: T.dust, shade: 0.18, shadeFlat: 0.6, hatch: 0, spot: 0, glow: 0.22, line: 0.4, lineTint: 1 }),
    dust2: kit.mat({ color: T.dust2, shade: 0.18, shadeFlat: 0.6, hatch: 0, spot: 0, glow: 0.22, line: 0.4, lineTint: 1 }),
    // the plain and what runs past on it
    plain: kit.mat({ color: T.plain, flat: true, hatch: 0, spot: 0 }),
    streak: kit.mat({ color: T.streak, flat: true, hatch: 0, spot: 0, line: 0.2, lineTint: 1 }),
    ballast: kit.mat({ color: T.ballast, flat: true, hatch: 0.3 }),
    sleeper: kit.mat({ color: T.sleeper, flat: true }),
    rails: kit.mat({ color: T.rails, flat: true, metal: 'steel', thin: 1.2 }),
    pole: kit.mat({ color: T.pole, flat: true, thin: 1.3 }),
    wire: kit.mat({ color: T.wire, flat: true, thin: 1.1, line: 0.5, lineTint: 0.6 }),
    stone: kit.mat({ color: T.stone, flat: true, hatch: 0.4 }),
    butte: kit.mat({ color: T.butte, flat: true, hatch: 0.3, line: 0.6, lineTint: 0.7 }),
    station: kit.mat({ color: T.station, color2: T.station2, flat: true, patches: 0.3, hatch: 0.5, ...LT }),
    roofTile: kit.mat({ color: T.roofTile, flat: true, hatch: 0.4, ...LT }),
    moon: kit.mat({ color: T.moon, glow: 0.72, flat: true, spot: 0, line: 0.6, lineTint: 0.5 }),
    cloaks: T.cloak.map((c) => kit.mat({ color: c, flat: true, figure: true, ...LT })),
    skin: kit.mat({ color: T.skin, flat: true, figure: true, ...LT }),
  };
}

// ------------------------------------------------------------------ the cross-section
/**
 * A carriage's cross-section, one side (z ≥ 0), [z, y] over its floor, foot to crown: the skirt tucked under, the side
 * upright to the window band (sill → head), the roof a quarter ellipse to its crown. `inn` the inside wall from the
 * floor up, `wall` m in. SILL/HEAD: the window band's points on each.
 */
export function profile({ half = TR.half, sill = TR.sill, head = TR.head, crown = TR.crown, skirt = 0.78, tuck = 0.48, wall = TR.wall, roof = 7 } = {}) {
  const out = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4; out.push([half - tuck * (1 - t) ** 2, -skirt + (0.62 + skirt) * t]); }
  out.push([half, sill]);
  const SILL = out.length - 1, zh = half - 0.06;
  out.push([zh, head]);
  const HEAD = out.length - 1;
  for (let i = 1; i <= roof; i++) { const f = (i / roof) * Math.PI / 2; out.push([zh * Math.cos(f) ** 0.9, head + (crown - head) * Math.sin(f)]); }
  out[out.length - 1][0] = 0;
  const inn = [[half - wall - 0.02, 0], [half - wall, sill], [zh - wall, head]];
  for (let i = 1; i <= roof; i++) { const f = (i / roof) * Math.PI / 2; inn.push([(zh - wall) * Math.cos(f) ** 0.9, head + (crown - wall - head) * Math.sin(f)]); }
  inn[inn.length - 1][0] = 0;
  return { out, inn, SILL, HEAD, ISILL: 1, IHEAD: 2, half, sill, head, crown, skirt };
}
/** The outward normals of a profile's points ([nz, ny], smooth: the mean of the two segments'). */
function normalsOf(pts) {
  const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const dz = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dz, dy) || 1; seg.push([dy / l, -dz / l]); }
  return pts.map((_, i) => { const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i)], z = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(z, y) || 1; return [z / l, y / l]; });
}

// ------------------------------------------------------------------ triangles, oriented
/** A geometry builder: triangles each turned so its face looks the way its vertices' normals do. */
class Tris {
  constructor() { this.p = []; this.n = []; }
  tri(a, b, c, na, nb = na, nc = na) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const w = (na[0] + nb[0] + nc[0]) * f[0] + (na[1] + nb[1] + nc[1]) * f[1] + (na[2] + nb[2] + nc[2]) * f[2];
    if (w < 0) { this.p.push(...a, ...c, ...b); this.n.push(...na, ...nc, ...nb); } else { this.p.push(...a, ...b, ...c); this.n.push(...na, ...nb, ...nc); }
  }
  /** a quad a b c d (in order round it) */
  quad(a, b, c, d, na, nb = na, nc = na, nd = na) { this.tri(a, b, c, na, nb, nc); this.tri(a, c, d, na, nc, nd); }
  geo() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    return g;
  }
}

/** Profile points i0..i1 swept along x over each [xa, xb] of `runs`, on side s (+1 / -1), its normals flipped (inner). */
function sweep(T, pts, nrm, i0, i1, runs, s, y0, flip = 1, step = 6) {
  for (const [xa, xb] of runs) {
    const n = Math.max(1, Math.ceil((xb - xa) / step));
    for (let k = 0; k < n; k++) {
      const x0 = xa + ((xb - xa) * k) / n, x1 = xa + ((xb - xa) * (k + 1)) / n;
      for (let i = i0; i < i1; i++) {
        const [za, ya] = pts[i], [zb, yb] = pts[i + 1], na = [0, nrm[i][1] * flip, s * nrm[i][0] * flip], nb = [0, nrm[i + 1][1] * flip, s * nrm[i + 1][0] * flip];
        T.quad([x0, y0 + ya, s * za], [x1, y0 + ya, s * za], [x1, y0 + yb, s * zb], [x0, y0 + yb, s * zb], na, na, nb, nb);
      }
    }
  }
}
/** The stretches of [a, b] between the windows' [x0, x1]s. */
function between(a, b, holes) {
  const out = []; let x = a;
  for (const [p, q] of [...holes].sort((m, n) => m[0] - n[0])) { if (p > x + 1e-3) out.push([x, p]); x = Math.max(x, q); }
  if (b > x + 1e-3) out.push([x, b]);
  return out;
}

/**
 * A carriage's shell from x0 to x1 (its floor at y0): the outer skin (skirt, side, roof), the inner one (wainscot,
 * window band, ceiling), the window openings and their reveals. windows: { 1: [[xa, xb]…], -1: [...] } (each side's
 * openings); panes: true closes them with glowing panes set in (a carriage you never enter: no inner skin then).
 * { hull: [geo] (the side), roof: [geo], skirt: [geo], frame: [geo] (reveals), wain, panel, ceil: [geo] (inside), pane: [geo] }
 */
export function shell({ x0, x1, y0 = TR.floor, P = profile(), windows = { 1: [], [-1]: [] }, panes = false, inside = !panes }) {
  const out = {}, nO = normalsOf(P.out), nI = normalsOf(P.inn);
  const lower = new Tris(), side = new Tris(), up = new Tris(), fr = new Tris(), pa = new Tris(), wain = new Tris(), pan = new Tris(), ceil = new Tris();
  const whole = [[x0, x1]];
  for (const s of [1, -1]) {
    const holes = (windows[s] ?? []).filter(([a, b]) => b > x0 && a < x1);
    sweep(lower, P.out, nO, 0, 4, whole, s, y0);
    sweep(side, P.out, nO, 4, P.SILL, whole, s, y0);
    sweep(up, P.out, nO, P.HEAD, P.out.length - 1, whole, s, y0);
    if (panes) sweep(side, P.out, nO, P.SILL, P.HEAD, whole, s, y0);
    else sweep(side, P.out, nO, P.SILL, P.HEAD, between(x0, x1, holes), s, y0);
    if (inside) {
      sweep(wain, P.inn, nI, 0, P.ISILL, whole, s, y0, -1);
      sweep(pan, P.inn, nI, P.ISILL, P.IHEAD, between(x0, x1, holes), s, y0, -1);
      sweep(ceil, P.inn, nI, P.IHEAD, P.inn.length - 1, whole, s, y0, -1);
    }
    const [zs, ys] = P.out[P.SILL], [zh, yh] = P.out[P.HEAD], [zis, yis] = P.inn[P.ISILL], [zih, yih] = P.inn[P.IHEAD];
    for (const [a, b] of holes) {
      if (panes) {
        // a glowing pane set a little in, its frame round it
        const d = 0.035, m = 0.09;
        pa.quad([a + m, y0 + ys + m, s * (zs - d)], [b - m, y0 + ys + m, s * (zs - d)], [b - m, y0 + yh - m, s * (zh - d)], [a + m, y0 + yh - m, s * (zh - d)], [0, 0, s]);
        continue;
      }
      // the reveals: the sill (up), the head (down), the jambs (facing into the opening)
      fr.quad([a, y0 + ys, s * zs], [b, y0 + ys, s * zs], [b, y0 + yis, s * zis], [a, y0 + yis, s * zis], [0, 1, 0]);
      fr.quad([a, y0 + yh, s * zh], [b, y0 + yh, s * zh], [b, y0 + yih, s * zih], [a, y0 + yih, s * zih], [0, -1, 0]);
      for (const [x, nx] of [[a, 1], [b, -1]]) fr.quad([x, y0 + ys, s * zs], [x, y0 + yh, s * zh], [x, y0 + yih, s * zih], [x, y0 + yis, s * zis], [nx, 0, 0]);
    }
    if (panes) for (const [a, b] of holes) {
      // the pane's frame, proud of the skin: four thin bars
      const fz = s * (zs + 0.02), fz2 = s * (zh + 0.02);
      for (const [p, q] of [[[a, y0 + ys, fz], [b, y0 + ys, fz]], [[a, y0 + yh, fz2], [b, y0 + yh, fz2]], [[a, y0 + ys, fz], [a, y0 + yh, fz2]], [[b, y0 + ys, fz], [b, y0 + yh, fz2]]]) push(out, 'frame', bar(V(...p), V(...q), 0.05));
    }
  }
  for (const [k, T] of [['skirt', lower], ['hull', side], ['roof', up], ['frame', fr], ['pane', pa], ['wain', wain], ['panel', pan], ['ceil', ceil]]) { const g = T.geo(); if (g) push(out, k, g); }
  return out;
}
/** A square bar from a to b, r thick (a frame's bar, a rail). */
export function bar(a, b, r = 0.05) {
  const d = b.clone().sub(a), L = d.length(), g = new THREE.BoxGeometry(r, r, L);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.normalize());
  return g.applyQuaternion(q).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
/**
 * The two rails from x0 to x1 at the rails' height, in pieces of `piece` m: a thin bar is widened to a pixel at each of
 * its ends' distance (src/thin.js), so one bar kilometres long grew metres wide at its far end and its long wedge
 * cut through everything near.
 */
export function railsGeo(x0, x1, { y = TR.rail - 0.03, gauge = TR.gauge, piece = 30 } = {}) {
  const out = [];
  for (const s of [-1, 1]) for (let x = x0; x < x1; x += piece) out.push(rodGeo(V(x, y, (s * gauge) / 2), V(Math.min(x1, x + piece), y, (s * gauge) / 2), 0.06));
  return out;
}
/** A round thin bar from a to b (a rail, a wire): drawn at least a pixel and a bit wide (src/thin.js). Keep it short. */
export function rodGeo(a, b, r = 0.04, radial = 4) { return thinBar(stick(a, b, r, radial), a, b); }

/** The outline of a profile, both sides (a THREE.Shape in z, y over the floor: an end wall's). */
function outline(pts, wall = 0) {
  const s = new THREE.Shape(), all = [...pts.map(([z, y]) => [z - wall, y]), ...[...pts].reverse().map(([z, y]) => [-(z - wall), y])];
  s.moveTo(all[0][0], all[0][1]);
  for (const [z, y] of all.slice(1)) s.lineTo(z, y);
  s.closePath();
  return s;
}
/** A door's outline (rounded at its top), w wide, h high, its middle at z. */
function doorPath(z, w, h) {
  const p = new THREE.Path(), r = w / 2;
  p.moveTo(z - r, 0.001); p.lineTo(z - r, h - r); p.absarc(z, h - r, r, Math.PI, 0, true); p.lineTo(z + r, 0.001); p.closePath();
  return p;
}
/**
 * A carriage's end wall at x (its face toward `dir`: +1 the front, -1 the back), a door through it (door: false, a
 * closed end). { hull: [geo] (outside, the skin's thickness), panel: [geo] (its inside face) }.
 */
export function endWall(x, dir, { y0 = TR.floor, P = profile(), door = true, dw = 1.3, dh = 3.0, inside = true } = {}) {
  const out = {}, s = outline(P.out);
  if (door) s.holes.push(doorPath(0, dw, dh));
  // (the shape in its plane: its x is the carriage's z; turned so it stands across the carriage, extruded inward)
  const g = new THREE.ExtrudeGeometry(s, { depth: TR.wall, bevelEnabled: false, curveSegments: 6 }).rotateY(-Math.PI / 2);
  // (after the turn the wall runs from x = -depth to 0: toward the inside on either end)
  if (dir > 0) g.translate(x, y0, 0); else g.rotateY(Math.PI).translate(x, y0, 0);
  push(out, 'hull', g);
  if (inside) {
    const si = outline(P.inn.map(([z, y]) => [z, y]).filter(([, y]) => y >= 0));
    if (door) si.holes.push(doorPath(0, dw, dh));
    const gi = new THREE.ShapeGeometry(si, 6);
    // (its face toward the inside: -dir)
    gi.rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2).translate(x - dir * (TR.wall + 0.01), y0, 0);
    push(out, 'panel', gi);
  }
  return out;
}

/**
 * The lead carriage's round prow at x (the body's end): its skin turned round the nose (stretched `k` along x), open
 * at the front between the floor and the window head (the observation lounge looks out over its balcony), the hood
 * over it; the balcony's floor out to `reach` m and its railing. { hull, roof, skirt, ceil, panel, frame, floor, rail: [geo] }.
 */
export function nose(x, { y0 = TR.floor, P = profile(), k = 1.3, open = 0.82, reach = 4.2, seg = 18 } = {}) {
  const out = {}, nO = normalsOf(P.out), nI = normalsOf(P.inn), H = Math.PI / 2;
  const T = { skirt: new Tris(), hull: new Tris(), roof: new Tris(), ceil: new Tris(), panel: new Tris(), frame: new Tris() };
  const at = (z, y, a) => [x + z * Math.cos(a) * k, y0 + y, z * Math.sin(a)];
  const nAt = ([nz, ny], a, flip) => { const v = V((nz * Math.cos(a)) / k, ny, nz * Math.sin(a)).normalize().multiplyScalar(flip); return [v.x, v.y, v.z]; };
  const ring = (pts, nrm, i0, i1, tr, a0, a1, flip = 1) => {
    const n = Math.max(1, Math.round((seg * (a1 - a0)) / Math.PI));
    for (let j = 0; j < n; j++) {
      const a = a0 + ((a1 - a0) * j) / n, b = a0 + ((a1 - a0) * (j + 1)) / n;
      for (let i = i0; i < i1; i++) tr.quad(at(...pts[i], a), at(...pts[i], b), at(...pts[i + 1], b), at(...pts[i + 1], a), nAt(nrm[i], a, flip), nAt(nrm[i], b, flip), nAt(nrm[i + 1], b, flip), nAt(nrm[i + 1], a, flip));
    }
  };
  // the skirt round the front below the floor; the side and the window band beside the opening; the hood over it
  // (out[2]: just under the floor, where the balcony's floor meets it)
  ring(P.out, nO, 0, 2, T.skirt, -H, H);
  ring(P.out, nO, 2, P.HEAD, T.hull, -H, -open);
  ring(P.out, nO, 2, P.HEAD, T.hull, open, H);
  ring(P.out, nO, P.HEAD, P.out.length - 1, T.roof, -H, H);
  ring(P.inn, nI, 0, P.IHEAD, T.panel, -H, -open, -1);
  ring(P.inn, nI, 0, P.IHEAD, T.panel, open, H, -1);
  ring(P.inn, nI, P.IHEAD, P.inn.length - 1, T.ceil, -H, H, -1);
  // the opening's jambs (each facing into it) and its lintel's underside
  const [zh, yh] = P.out[P.HEAD], [zih, yih] = P.inn[P.IHEAD], [z0, y2] = P.out[2], [zi0] = P.inn[0];
  for (const e of [-1, 1]) { const a = e * open; T.frame.quad(at(z0, y2, a), at(zh, yh, a), at(zih, yih, a), at(zi0, y2, a), [e * Math.sin(a) * k, 0, -e * Math.cos(a)]); }
  const nl = Math.max(2, Math.round((seg * 2 * open) / Math.PI));
  for (let j = 0; j < nl; j++) { const a = -open + (2 * open * j) / nl, b = -open + (2 * open * (j + 1)) / nl; T.frame.quad(at(zh, yh, a), at(zh, yh, b), at(zih, yih, b), at(zih, yih, a), [0, -1, 0]); }
  for (const [kk, t] of Object.entries(T)) { const g = t.geo(); if (g) push(out, kk, g); }
  // the balcony: its floor from the body's end out past the nose (a half ellipse), its railing round the front
  const fl = new THREE.Shape(), R = reach, n = 24, bz = P.half + 0.35;
  fl.moveTo(0, -bz);
  for (let i = 0; i <= n; i++) { const a = -H + (Math.PI * i) / n; fl.lineTo(Math.cos(a) * R, Math.sin(a) * bz); }
  fl.closePath();
  // (the shape's x along the carriage, its y across: laid flat, its top at the floor)
  push(out, 'floor', new THREE.ExtrudeGeometry(fl, { depth: 0.22, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(x, y0, 0));
  const rp = (a) => V(x + Math.cos(a) * (R - 0.12), y0, Math.sin(a) * (bz - 0.12));
  for (let i = 0; i < n; i++) {
    const a = -H + (Math.PI * i) / n, b = -H + (Math.PI * (i + 1)) / n, pa = rp(a), pb = rp(b);
    push(out, 'rail', rodGeo(pa.clone().setY(y0 + 1.05), pb.clone().setY(y0 + 1.05), 0.045));
    push(out, 'rail', rodGeo(pa.clone().setY(y0 + 0.55), pb.clone().setY(y0 + 0.55), 0.025));
    if (i % 2 === 0) push(out, 'rail', rodGeo(pa.clone().setY(y0), pa.clone().setY(y0 + 1.05), 0.035));
  }
  return out;
}

// ------------------------------------------------------------------ under the floor
/**
 * A bogie at x: two axles (or three, `axles`), their wheels on the rails, the frame, springs and a brake shoe;
 * spokes: true draws big spoked drive wheels (r) with a coupling rod between them. { iron: [geo], steel: [geo], wheels: [{ x, y, z, r }] }.
 */
export function bogie(x, { r = 0.55, axles = 2, base = 1.9, spokes = false, gauge = TR.gauge, rail = TR.rail, seg = 14 } = {}) {
  const out = { wheels: [] }, y = rail + r, span = base * (axles - 1);
  for (let k = 0; k < axles; k++) {
    const ax = x - span / 2 + base * k;
    for (const s of [-1, 1]) {
      const z = (s * gauge) / 2;
      push(out, 'iron', new THREE.CylinderGeometry(r, r, 0.16, seg).rotateX(Math.PI / 2).translate(ax, y, z + s * 0.06));
      push(out, 'steel', new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.04, seg).rotateX(Math.PI / 2).translate(ax, y, z + s * 0.15));
      if (spokes) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; push(out, 'spokes', new THREE.BoxGeometry(r * 1.7, 0.06, 0.05).rotateZ(a).translate(ax, y, z + s * 0.18)); }
      out.wheels.push({ x: ax, y, z: z + s * 0.06, r });
    }
    push(out, 'iron', new THREE.CylinderGeometry(0.08, 0.08, gauge + 0.4, 6).rotateX(Math.PI / 2).translate(ax, y, 0));
  }
  // the frame: side beams over the axle boxes, a bolster across, springs
  for (const s of [-1, 1]) {
    const z = s * (gauge / 2 + 0.32);
    push(out, 'iron', new THREE.BoxGeometry(span + r * 2 + 0.6, 0.32, 0.18).translate(x, y + 0.08, z));
    for (let k = 0; k < axles; k++) { const ax = x - span / 2 + base * k; push(out, 'steel', new THREE.BoxGeometry(0.42, 0.36, 0.26).translate(ax, y, z)); push(out, 'steel', new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6).translate(ax + 0.32, y + 0.38, z)); push(out, 'steel', new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6).translate(ax - 0.32, y + 0.38, z)); }
    if (spokes && axles > 1) push(out, 'steel', new THREE.BoxGeometry(span + 0.3, 0.12, 0.08).translate(x, y - r * 0.4, s * (gauge / 2 + 0.26)));
  }
  push(out, 'iron', new THREE.BoxGeometry(0.6, 0.3, gauge + 0.7).translate(x, y + 0.36, 0));
  return out;
}
/** The underframe of a carriage from x0 to x1: a deep dark sill, tanks and boxes hung between the bogies. { iron, steel, frame: [geo] }. */
export function underframe(x0, x1, { y0 = TR.floor, half = TR.half, seed = 1, bogies = [] } = {}) {
  const out = {}, rng = mulberry32(Math.floor(seed * 911) + 5), w = half * 2 - 0.9;
  // (between the bogies; over them only a shallow sill, so the wheels show under the skirt)
  const lo = bogies.length ? Math.min(...bogies) + 2.2 : x0 + 0.2, hi = bogies.length ? Math.max(...bogies) - 2.2 : x1 - 0.2;
  push(out, 'frame', new THREE.BoxGeometry(hi - lo, 0.42, w).translate((lo + hi) / 2, y0 - 0.45, 0));
  push(out, 'frame', new THREE.BoxGeometry(x1 - x0 - 0.4, 0.16, w).translate((x0 + x1) / 2, y0 - 0.32, 0));
  // between the bogies: tanks (cylinders along x) and boxes, at both sides
  const free = (x, r) => bogies.every((b) => Math.abs(x - b) > r + 2.4);
  for (let x = x0 + 2; x < x1 - 2; x += 1.6 + rng() * 2.2) {
    if (!free(x, 1)) continue;
    const s = rng() < 0.5 ? 1 : -1, z = s * (0.4 + rng() * 1.0);
    if (rng() < 0.45) { const L = 1.4 + rng() * 2.2, r = 0.25 + rng() * 0.2; if (free(x + L / 2, L / 2)) push(out, 'steel', new THREE.CylinderGeometry(r, r, L, 10).rotateZ(Math.PI / 2).translate(x + L / 2, y0 - 0.66 - r * 0.6, z)); x += L; }
    else { const b = 0.5 + rng() * 0.9; push(out, 'iron', new THREE.BoxGeometry(b, 0.4 + rng() * 0.3, 0.5 + rng() * 0.6).translate(x, y0 - 0.86, z)); }
  }
  return out;
}

// ------------------------------------------------------------------ the ends: porches, the plate across, the ladder
/**
 * The railed porch at a carriage's end x (dir: +1 it juts toward +x, -1 toward -x), `d` m deep, the plate halfway
 * across the gap, the side rails, a ladder up the end wall beside the door (ladder: the side, +1 / -1, or 0 none).
 * { floor: [geo], rail: [geo], iron: [geo], ladder: [{ x, z, y0, y1 }] }.
 */
export function porch(x, dir, { y0 = TR.floor, d = TR.gap / 2, half = TR.half, ladder = 1, gates = false } = {}) {
  const out = { ladder: [] }, xe = x + dir * d, xm = (x + xe) / 2, w = half * 2 - 1.0, zr = half - 0.55;
  push(out, 'floor', new THREE.BoxGeometry(d + 0.02, 0.2, w).translate(xm, y0 - 0.1, 0));
  // the railing on each open side of the porch (the walk across stays open in the middle)
  for (const s of [-1, 1]) {
    const z = s * zr;
    push(out, 'rail', rodGeo(V(x, y0 + 1.0, z), V(xe, y0 + 1.0, z), 0.04));
    push(out, 'rail', rodGeo(V(x, y0 + 0.5, z), V(xe, y0 + 0.5, z), 0.025));
    push(out, 'rail', rodGeo(V(xe, y0, z), V(xe, y0 + 1.0, z), 0.035));
    // (and round its outer corner, across to the plate's edge)
    push(out, 'rail', rodGeo(V(xe, y0 + 1.0, z), V(xe, y0 + 1.0, s * 0.62), 0.04));
    push(out, 'rail', rodGeo(V(xe, y0 + 0.5, z), V(xe, y0 + 0.5, s * 0.62), 0.025));
    push(out, 'rail', rodGeo(V(xe, y0, s * 0.62), V(xe, y0 + 1.0, s * 0.62), 0.03));
  }
  if (gates) for (const s of [-1, 1]) push(out, 'rail', rodGeo(V(xe, y0 + 1.0, s * 0.62), V(xe, y0 + 1.0, 0), 0.03));
  if (ladder) {
    const z = ladder * 0.92, y1 = y0 + TR.crown - 0.1;
    for (const e of [-1, 1]) push(out, 'iron', rodGeo(V(x + dir * 0.12, y0, z + e * 0.24), V(x + dir * 0.12, y1 + 0.5, z + e * 0.24), 0.035));
    for (let y = y0 + 0.3; y < y1 + 0.3; y += 0.32) push(out, 'iron', rodGeo(V(x + dir * 0.12, y, z - 0.24), V(x + dir * 0.12, y, z + 0.24), 0.022));
    out.ladder.push({ x: x + dir * 0.12, z, y0, y1 });
  }
  return out;
}

// ------------------------------------------------------------------ furniture
/** A round lamp hung flush under a ceiling at (x, y, z), r m across: a flattened glowing dome. */
export const ceilingLamp = (x, y, z, r = 0.22) => new THREE.SphereGeometry(r, 10, 5, 0, TAU, 0, Math.PI / 2).scale(1, -0.45, 1).translate(x, y - 0.01, z);

/** An armchair at (x, y, z) facing yaw (its front toward yaw's +z): seat, back, arms. { plush: [geo], wood: [geo] }. */
export function armchair(x, y, z, yaw = 0, { w = 0.8, back = 0.95 } = {}) {
  const out = {}, at = (g) => g.rotateY(yaw).translate(x, y, z);
  push(out, 'plush', at(new THREE.BoxGeometry(w, 0.22, 0.72).translate(0, 0.38, 0.04)));
  push(out, 'plush', at(new THREE.BoxGeometry(w, back, 0.2).translate(0, 0.45 + back / 2 - 0.05, -0.3).rotateX(-0.12)));
  for (const e of [-1, 1]) push(out, 'plush', at(new THREE.BoxGeometry(0.14, 0.32, 0.72).translate(e * (w / 2 - 0.02), 0.58, 0.04)));
  push(out, 'wood', at(new THREE.BoxGeometry(w - 0.1, 0.27, 0.6).translate(0, 0.135, 0.04)));
  return out;
}
/** A table at (x, y, z) w × d, its top h high, a cloth over it and a lamp with a glowing shade. { wood, linen, brass, glow: [geo], lamp: [x, y, z] }. */
export function table(x, y, z, { w = 0.9, d = 0.8, h = 0.74, cloth = true, lamp = true, round = false } = {}) {
  const out = {};
  if (round) push(out, cloth ? 'linen' : 'wood', new THREE.CylinderGeometry(w / 2, w / 2 + (cloth ? 0.04 : 0), cloth ? 0.2 : 0.05, 12).translate(x, y + h - (cloth ? 0.08 : 0.02), z));
  else push(out, cloth ? 'linen' : 'wood', new THREE.BoxGeometry(w + (cloth ? 0.08 : 0), cloth ? 0.16 : 0.05, d + (cloth ? 0.08 : 0)).translate(x, y + h - (cloth ? 0.06 : 0.02), z));
  push(out, 'wood', new THREE.CylinderGeometry(0.05, 0.12, h - 0.06, 6).translate(x, y + (h - 0.06) / 2, z));
  if (lamp) {
    push(out, 'brass', new THREE.CylinderGeometry(0.02, 0.07, 0.3, 6).translate(x, y + h + 0.15, z));
    push(out, 'glow', new THREE.CylinderGeometry(0.07, 0.15, 0.17, 8).translate(x, y + h + 0.36, z));
    out.lamp = [x, y + h + 0.36, z];
  }
  return out;
}
/** A bunk at (x, y, z) along x, L long: its frame, its mattress and blanket, a pillow. { wood, linen, plush: [geo] }. */
export function bunk(x, y, z, { L = 1.95, w = 0.8, h = 0.45, blanket = 'plush' } = {}) {
  const out = {};
  push(out, 'wood', new THREE.BoxGeometry(L, 0.12, w).translate(x, y + h - 0.06, z));
  push(out, 'linen', new THREE.BoxGeometry(L - 0.06, 0.14, w - 0.06).translate(x, y + h + 0.07, z));
  push(out, blanket, new THREE.BoxGeometry(L * 0.62, 0.06, w - 0.02).translate(x - L * 0.18, y + h + 0.16, z));
  push(out, 'linen', new THREE.BoxGeometry(0.4, 0.12, w * 0.7).translate(x + L / 2 - 0.3, y + h + 0.2, z));
  return out;
}
/** A shelf of books at (x, y, z) along x, L long, rows of them on `n` boards. { wood: [geo], books: [geo] }. */
export function bookshelf(x, y, z, yaw = 0, { L = 1.6, n = 4, h = 1.9, d = 0.32, seed = 1 } = {}) {
  const out = {}, rng = mulberry32(Math.floor(seed * 353) + 9), at = (g) => g.rotateY(yaw).translate(x, y, z);
  push(out, 'wood', at(new THREE.BoxGeometry(L, h, 0.04).translate(0, h / 2, -d / 2)));
  for (let i = 0; i <= n; i++) push(out, 'wood', at(new THREE.BoxGeometry(L, 0.04, d).translate(0, 0.08 + (i * (h - 0.16)) / n, 0)));
  for (let i = 0; i < n; i++) for (let u = -L / 2 + 0.06; u < L / 2 - 0.08;) {
    const bw = 0.05 + rng() * 0.07, bh = (h - 0.16) / n * (0.6 + rng() * 0.3);
    push(out, rng() < 0.5 ? 'books' : 'books2', at(new THREE.BoxGeometry(bw, bh, d * 0.8).translate(u + bw / 2, 0.1 + (i * (h - 0.16)) / n + bh / 2, 0)));
    u += bw + 0.005;
  }
  return out;
}

// ------------------------------------------------------------------ on the roofs
/**
 * A pennant from the top of a mast at (x, y, z): a long tapering streamer flying back along -x, L long, waving
 * (`phase`), its tail forked. { cloth: [geo] } (its points' rest shape kept for waving: pennantWave).
 */
export function pennant(x, y, z, { L = 6, w = 0.7, nu = 22, phase = 0, wave = 1, droop = 0.25 } = {}) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, half = (w / 2) * (1 - 0.75 * u), fork = u > 0.82 ? (u - 0.82) / 0.18 : 0;
    for (const e of [-1, 1]) {
      const px = x - u * L, py = y - droop * u * u * L * 0.2 + e * half * (1 - fork * 0.6) - (e > 0 ? 0 : fork * 0.15);
      const pz = z + Math.sin(u * 7 + phase) * 0.35 * u * wave;
      pos.push(px, py, pz);
    }
    if (i < nu) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.rest = { x, y, z, L, nu, phase };
  return g;
}
/** The pennant's cloth moving in the wind of the train's speed (k 0 still .. 1 at full speed), at time t (in place). */
export function pennantWave(g, t, k = 1) {
  const r = g.userData.rest, p = g.attributes.position;
  if (!r) return;
  for (let i = 0; i <= r.nu; i++) {
    const u = i / r.nu, z = r.z + Math.sin(u * 7 - t * (2 + 6 * k) + r.phase) * (0.12 + 0.3 * k) * u * (0.3 + 0.7 * k);
    const droop = (1 - k) * u * u * r.L * 0.55;
    for (let e = 0; e < 2; e++) { const j = i * 2 + e; p.setZ(j, z); p.setX(j, r.x - u * r.L * (0.75 + 0.25 * k)); p.setY(j, p.getY(j) - (g.userData.lastDroop?.[i] ?? 0) + droop * 0.4); }
    (g.userData.lastDroop ??= [])[i] = droop * 0.4;
  }
  p.needsUpdate = true;
}
/** A planter box along x from x0 to x1 at height y, its bushes (the roofs' gardens). { pot: [geo], shrub: [geo] }. */
export function planter(x0, x1, y, z, { w = 0.7, seed = 1, n = null, s = [0.32, 0.62], detail = 1 } = {}) {
  const out = {}, L = x1 - x0;
  push(out, 'pot', new THREE.BoxGeometry(L, 0.45, w).translate((x0 + x1) / 2, y + 0.22, z));
  for (const g of shrubs([x0 + 0.25, y + 0.32, z], [x1 - 0.25, y + 0.32, z], { n: n ?? Math.max(2, Math.round(L / 0.5)), s, seed, jitter: 0.15, detail: 1 })) push(out, 'shrub', g);
  return out;
}

// ------------------------------------------------------------------ the dust along the wheels
/**
 * The salmon cloud the wheels raise: puffs from the nose (x0) back past the tail (x1) along both sides at the wheels,
 * small and low at the front, heaped up and wider behind, trailing on past the tail as a long bank.
 * [{ x, y, z, s, sy, u }] (u: 0 at the nose .. 1 at its end).
 */
export function dustPuffs({ x0, x1, trail = 160, step = 1.1, seed = 1, sides = [1, -1], half = TR.half, rail = TR.rail, grow = 1, size = 1, n = null }) {
  const rng = mulberry32(Math.floor(seed * 4513) + 11), out = [], L = x0 - x1, end = x1 - trail;
  // (one puff every `step` m along each side at the wheels, bigger toward the tail; past it a plume heaping up)
  for (const side of sides) for (let x = x0; x > end; x -= step * (x < x1 ? 1 + ((x1 - x) / trail) * 4 : 1)) {
    const u = Math.min(1, (x0 - x) / L), past = Math.max(0, (x1 - x) / trail);
    const s = size * 0.55 * (0.9 + rng() * 0.7) * (1 + u * 1.6 * grow) * (1 + past * 6 * grow);
    const z = side * (half * 0.75 + s * (0.3 + rng() * 0.5) + past * trail * 0.05 * rng());
    out.push({ x: x + (rng() - 0.5) * step, y: rail * 0.2 + s * (0.45 + rng() * 0.25) + past * s * 0.5 * rng(), z, s, sy: 0.65 + rng() * 0.25, u });
    if (rng() < 0.5 + past * 0.4) out.push({ x: x + (rng() - 0.5) * step, y: rail * 0.2 + s * (0.9 + rng() * 0.4), z: z + side * s * 0.4, s: s * (0.5 + rng() * 0.3), sy: 0.8, u });
  }
  return n ? out.filter((_, i) => i % Math.max(1, Math.round(out.length / n)) === 0) : out;
}

// ------------------------------------------------------------------ the scenery that runs past
/** A telegraph pole at (x, z), h high, its crossarm and insulators. { pole: [geo], tops: [V…] (where its wires hang) }. */
export function telegraphPole(x, z, { h = 7.5, arm = 1.4, lean = 0 } = {}) {
  const out = { tops: [] };
  push(out, 'pole', rodGeo(V(x, 0, z), V(x + lean, h, z), 0.11, 5));
  push(out, 'pole', rodGeo(V(x + lean, h - 0.5, z - arm), V(x + lean, h - 0.5, z + arm), 0.06));
  for (const e of [-1, 0, 1]) { const t = V(x + lean, h - 0.38, z + e * arm * 0.85); out.tops.push(t); push(out, 'pole', new THREE.BoxGeometry(0.08, 0.16, 0.08).translate(t.x, t.y - 0.06, t.z)); }
  return out;
}
/** A wire sagging from a to b (a catenary of `n` straight pieces). [geo] */
export function wire(a, b, { sag = 0.6, n = 6, r = 0.018 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, p = a.clone().lerp(b, t0), q = a.clone().lerp(b, t1);
    p.y -= sag * 4 * t0 * (1 - t0); q.y -= sag * 4 * t1 * (1 - t1);
    out.push(rodGeo(p, q, r, 3));
  }
  return out;
}
/** A low butte far out on the plain: a flat-topped mass, its sides stepped (a lumpy box), w × h × d. */
export function butte(x, z, { w = 200, h = 40, d = 120, seed = 1, yaw = 0 } = {}) {
  const g = new THREE.CylinderGeometry(0.7, 1, 1, 9, 3).scale(w / 2, h, d / 2);
  const p = g.attributes.position, rng = mulberry32(Math.floor(seed * 97) + 1);
  const bumps = Array.from({ length: 9 }, () => 0.85 + rng() * 0.3);
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), k = bumps[Math.floor(((a / TAU + 1) % 1) * 9)];
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g.rotateY(yaw).translate(x, h / 2 - 1, z);
}
/** A scatter of stones on the plain (a lumpy ball each, flattened). */
export function stone(x, z, r, seed = 1, detail = 1) { return boulder(seed, r, 0.45, detail).translate(x, r * 0.12, z); }
/**
 * A lonely station beside the line, its platform along x from x0 to x1 on the +z side (z0 its edge by the train):
 * the platform, its edge stones, a station house with a rounded roof and lit windows, a water tower, lamp posts with
 * glowing lamps, benches, a name board, crates. { station, roofTile, plank, iron, glow, pane, lamp, wood, frame: [geo], lamps: [[x, y, z]], top }.
 */
export function station({ x0 = -60, x1 = 60, z0 = TR.half + 0.35, depth = 7, y = TR.floor - 0.35, seed = 1, house = 0.3 } = {}) {
  const out = { lamps: [] }, rng = mulberry32(Math.floor(seed * 271) + 3), L = x1 - x0, xm = (x0 + x1) / 2;
  push(out, 'station', new THREE.BoxGeometry(L, y, depth).translate(xm, y / 2, z0 + depth / 2));
  push(out, 'plank', new THREE.BoxGeometry(L, 0.08, 0.5).translate(xm, y + 0.04, z0 + 0.25));
  // the house: walls, a barrel roof, windows lit, a door, a clock over it
  const hx = x0 + L * house, hw = 16, hd = 6, hh = 4.2, hz = z0 + depth - 0.5 + hd / 2;
  push(out, 'station', new THREE.BoxGeometry(hw, hh, hd).translate(hx, y + hh / 2, hz));
  push(out, 'roofTile', new THREE.CylinderGeometry(hd / 2 + 0.5, hd / 2 + 0.5, hw + 1.2, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.5, 1).translate(hx, y + hh, hz));
  for (let i = 0; i < 5; i++) {
    const wx = hx - hw / 2 + 2 + i * 3, door = i === 2;
    push(out, door ? 'frame' : 'pane', new THREE.BoxGeometry(door ? 1.4 : 1.2, door ? 2.4 : 1.4, 0.1).translate(wx, y + (door ? 1.2 : 2.1), hz - hd / 2 - 0.02));
  }
  push(out, 'lamp', new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14).rotateX(Math.PI / 2).translate(hx, y + 3.4, hz - hd / 2 - 0.08));
  // the water tower at the far end
  const tx = x0 + L * 0.88, tz = z0 + depth + 4;
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) push(out, 'iron', rodGeo(V(tx + dx, 0, tz + dz), V(tx + dx * 0.7, 7, tz + dz * 0.7), 0.1));
  push(out, 'wood', new THREE.CylinderGeometry(2.2, 2.2, 3.4, 14).translate(tx, 8.7, tz));
  push(out, 'roofTile', new THREE.ConeGeometry(2.5, 1.4, 14).translate(tx, 11.1, tz));
  // lamp posts along the platform, benches between
  for (let x = x0 + 6; x < x1 - 3; x += 14) {
    const lz = z0 + 1.6;
    push(out, 'iron', rodGeo(V(x, y, lz), V(x, y + 3.6, lz), 0.06));
    push(out, 'iron', rodGeo(V(x, y + 3.6, lz), V(x, y + 3.6, lz - 0.6), 0.04));
    push(out, 'lamp', new THREE.SphereGeometry(0.22, 8, 6).translate(x, y + 3.35, lz - 0.6));
    out.lamps.push([x, y + 3.35, lz - 0.6]);
    if (rng() < 0.7) { const bx = x + 7; push(out, 'wood', new THREE.BoxGeometry(2, 0.1, 0.5).translate(bx, y + 0.45, z0 + depth - 1.2)); push(out, 'wood', new THREE.BoxGeometry(2, 0.5, 0.08).translate(bx, y + 0.75, z0 + depth - 0.95)); }
  }
  // the name board on two posts, crates and a cart
  const nb = x0 + L * 0.62;
  push(out, 'frame', new THREE.BoxGeometry(4.2, 0.9, 0.1).translate(nb, y + 2.6, z0 + 3.4));
  for (const e of [-1, 1]) push(out, 'iron', rodGeo(V(nb + e * 1.8, y, z0 + 3.4), V(nb + e * 1.8, y + 2.6, z0 + 3.4), 0.05));
  for (let i = 0; i < 6; i++) { const s = 0.5 + rng() * 0.5; push(out, 'wood', new THREE.BoxGeometry(s, s * 0.8, s).rotateY(rng()).translate(x0 + L * (0.5 + rng() * 0.08), y + s * 0.4, z0 + 2 + rng() * 2)); }
  out.top = y;
  return out;
}

// ------------------------------------------------------------------ people
/** A small figure (salt-harbour-kit's figure) added in one of the cloaks' colours. */
export function rider(kit, M, rng, x, y, z, { yaw = rng() * TAU, s = 1, bundle = rng() < 0.25 } = {}) {
  const F = figure(x, y, z, { s: s * (0.92 + rng() * 0.16), yaw, bundle, hood: rng() < 0.5 }), m = M.cloaks[Math.floor(rng() * M.cloaks.length)];
  const NC = { solid: false, shadow: false };
  for (const g of F.cloak) kit.add(m, g, NC); for (const g of F.skin) kit.add(M.skin, g, NC); for (const g of F.bundle) kit.add(M.pot, g, NC);
}

// ------------------------------------------------------------------ the moons
/** A moon: a glowing ball `d` m off along dir (from `from`), its radius for `deg` degrees across. */
export function moonGeo(from, dir, { d = 2800, deg = 2.4 } = {}) {
  const r = d * Math.tan((deg * Math.PI) / 360), p = from.clone().addScaledVector(dir.clone().normalize(), d);
  return new THREE.SphereGeometry(r, 20, 14).translate(p.x, p.y, p.z);
}

// ------------------------------------------------------------------ the whole train
const NC = { solid: false, shadow: false }, SH = { solid: false, shadow: true }, SOLID = { solid: true, shadow: true };
/** Window openings along [a, b] every `step` m, each `w` wide (centred in their bays). */
export function windowRow(a, b, step, w) {
  const out = [], n = Math.max(1, Math.floor((b - a) / step)), m = ((b - a) - n * step) / 2;
  for (let i = 0; i < n; i++) { const c = a + m + step * (i + 0.5); out.push([c - w / 2, c + w / 2]); }
  return out;
}
/**
 * A carriage's kind: its windows (both sides), the colour of its sides, what stands on its roof. The kinds:
 *   prow     the lead carriage: the observation lounge, open at its round nose onto the balcony; big drive wheels
 *   dining   tables along both rows of windows, a counter at its back
 *   sleeper  a corridor along its -z side, compartments with bunks along +z
 *   dome     the library lounge, a terrace on its roof and the little sky lounge on it
 *   coach    a closed carriage, its windows lit panes (the train's long tail)
 *   landing  the landing wagon: a broad railed deck where a ship sets down
 */
export const CAR_KINDS = {
  prow: { colour: 'plum', windows: (L) => ({ 1: windowRow(-L / 2 + 1, L / 2 - 2, 2.4, 1.6), [-1]: windowRow(-L / 2 + 1, L / 2 - 2, 2.4, 1.6) }) },
  dining: { colour: 'hull', windows: (L) => ({ 1: windowRow(-L / 2 + 3, L / 2 - 1, 2.2, 1.5), [-1]: windowRow(-L / 2 + 3, L / 2 - 1, 2.2, 1.5) }) },
  sleeper: { colour: 'plum', windows: (L) => ({ 1: windowRow(-L / 2 + 1, L / 2 - 1, 2.5, 1.1), [-1]: windowRow(-L / 2 + 1, L / 2 - 1, 1.8, 1.2) }) },
  dome: { colour: 'hull', windows: (L) => ({ 1: windowRow(-L / 2 + 1, L / 2 - 1, 2.4, 1.6), [-1]: windowRow(-L / 2 + 1, L / 2 - 1, 2.4, 1.6) }) },
  coach: { colour: 'hull', windows: (L) => ({ 1: windowRow(-L / 2 + 1, L / 2 - 1, 1.9, 1.15), [-1]: windowRow(-L / 2 + 1, L / 2 - 1, 1.9, 1.15) }) },
};

/**
 * Lay a train along x: carriages from the nose back (cars: [{ kind, L, roof: 'garden' | 'walk' | 'terrace' | 'chimney',
 * pennants }], the first is the nose), each with its shell, ends, porches, bogies and underframe; the roof walk and
 * the plates over the gaps between the roofs. o: { x (the nose's body end), detail, inside (furnish the carriages
 * that can be entered), solid (their shells, floors and rails are walked on), seed, at: (car, i, x0, x1) => {} }.
 * Returns { cars: [{ kind, x0, x1, xc, L }], wheels: [{ x, y, z, r, drive }], ladders: [...], pennants: [geo],
 * lamps: [[x, y, z]], xTail }.
 */
export function train(kit, M, cars, { x = 0, detail = 1, solid = true, seed = 1, furnish = null, turning = false } = {}) {
  const rng = mulberry32(Math.floor(seed * 1229) + 7), P = profile({ roof: detail >= 1 ? 7 : 5 });
  const S = solid ? SOLID : SH;
  const res = { cars: [], wheels: [], ladders: [], pennants: [], lamps: [], terraces: [] };
  let xr = x;
  for (const [i, c] of cars.entries()) {
    const L = c.L ?? TR.car;
    if (c.kind === 'landing') {
      const x1 = xr, x0 = xr - L;
      landingWagon(kit, M, x0, x1, { solid, res, w: c.w ?? 34 });
      res.cars.push({ kind: c.kind, x0, x1, xc: (x0 + x1) / 2, L, i });
      xr = x0 - TR.gap;
      continue;
    }
    const x1 = xr, x0 = xr - L, xc = (x0 + x1) / 2, K = CAR_KINDS[c.kind] ?? CAR_KINDS.coach;
    const closed = c.kind === 'coach' || c.closed;
    const win = K.windows(L), wins = { 1: win[1].map(([a, b]) => [a + xc, b + xc]), [-1]: win[-1].map(([a, b]) => [a + xc, b + xc]) };
    const lead = c.kind === 'prow';
    const body = shell({ x0, x1, P, windows: wins, panes: closed, inside: !closed });
    const side = M[c.colour ?? K.colour] ?? M.hull;
    for (const [k, m] of [['hull', side], ['roof', M.roof], ['skirt', M.skirt]]) for (const g of body[k] ?? []) kit.add(m, g, S);
    for (const g of body.frame ?? []) kit.add(M.frame, g, closed ? NC : S);
    for (const g of body.pane ?? []) kit.add(M.pane, g, NC);
    for (const [k, m] of [['wain', M.wood], ['panel', M.panel], ['ceil', M.ceil]]) for (const g of body[k] ?? []) kit.add(m, g, S);
    // the ends: the lead carriage's nose, a door through the others (the tail's last closed)
    const last = i === cars.length - 1;
    if (lead) { const N = nose(x1, { P }); for (const [k, m] of [['hull', side], ['roof', M.roof], ['skirt', M.skirt], ['ceil', M.ceil], ['panel', M.panel], ['frame', M.frame], ['floor', M.plank], ['rail', M.brass]]) for (const g of N[k] ?? []) kit.add(m, g, S); }
    else { const E = endWall(x1, 1, { P, door: !closed, inside: !closed }); for (const g of E.hull) kit.add(side, g, S); for (const g of E.panel ?? []) kit.add(M.panel, g, S); }
    { const E = endWall(x0, -1, { P, door: !closed && !last, inside: !closed }); for (const g of E.hull) kit.add(side, g, S); for (const g of E.panel ?? []) kit.add(M.panel, g, S); }
    // the floor inside (and the gaps' plates come with the porches)
    if (!closed) kit.add(M.floor, new THREE.BoxGeometry(L - 0.1, 0.26, (P.half - TR.wall) * 2).translate(xc, TR.floor - 0.13, 0), S);
    // the porches at its ends (none in front of the nose; the tail's back one railed shut)
    if (!lead) { const Pf = porch(x1, 1, { ladder: (i % 2 ? -1 : 1) }); addParts(kit, M, Pf, { floor: M.plank, rail: M.brass, iron: M.iron }, S); res.ladders.push(...Pf.ladder); }
    { const Pb = porch(x0, -1, { ladder: 0, gates: last }); addParts(kit, M, Pb, { floor: M.plank, rail: M.brass, iron: M.iron }, S); }
    // under it: the bogies (the lead's great drive wheels), the underframe
    const bx = lead ? [x1 - 4.2, x0 + 3.6] : [x1 - 3.3, x0 + 3.3];
    for (const [k, b] of bx.entries()) {
      const drive = lead && k === 0, B = bogie(b, drive ? { r: 0.85, axles: 3, base: 1.95, spokes: true } : { seg: detail >= 1 ? 14 : 10 });
      for (const g of B.iron ?? []) kit.add(M.iron, g, SH); for (const g of B.steel ?? []) kit.add(M.steel, g, SH);
      if (!turning) for (const g of B.spokes ?? []) kit.add(M.iron, g, SH);
      res.wheels.push(...B.wheels.map((w) => ({ ...w, drive })));
    }
    const U = underframe(x0, x1, { seed: seed + i, bogies: bx });
    for (const [k, m] of [['frame', M.frame], ['iron', M.iron], ['steel', M.steel]]) for (const g of U[k] ?? []) kit.add(m, g, SH);
    // the roof walk along its crown (the plates over the gaps join them all)
    kit.add(M.plank, new THREE.BoxGeometry(L - 0.2, 0.12, 0.9).translate(xc, TR.floor + TR.walk - 0.06, 0), S);
    if (!last && cars[i + 1].kind !== 'landing') kit.add(M.plank, new THREE.BoxGeometry(TR.gap + 0.6, 0.1, 0.8).translate(x0 - TR.gap / 2, TR.floor + TR.walk - 0.05, 0), S);
    roofTop(kit, M, rng, c, { x0, x1, xc, L, detail, res, S });
    furnish?.(kit, M, c, { x0, x1, xc, L, i, P, rng, res });
    res.cars.push({ kind: c.kind, x0, x1, xc, L, i });
    xr = x0 - TR.gap;
  }
  res.xTail = xr + TR.gap;
  return res;
}
/** Add a part list ({ role: [geo] }) to the kit with the materials named per role. */
export function addParts(kit, M, parts, mats, o = SOLID) { for (const [k, m] of Object.entries(mats)) for (const g of parts[k] ?? []) kit.add(m, g, o); }

/** What stands on a carriage's roof: a garden in planters along the walk, a kitchen's chimney, the dome's terrace, pennants on masts. */
function roofTop(kit, M, rng, c, { x0, x1, xc, L, detail, res, S }) {
  const yr = TR.floor + TR.walk;
  if (c.roof === 'garden') {
    // planters either side of the walk, sitting on the curve (their feet sunk into it)
    for (const s of [-1, 1]) for (let x = x0 + 1.5; x < x1 - 3; x += 3.6 + rng() * 2) {
      const len = 1.6 + rng() * 1.6, P = planter(x, Math.min(x1 - 1, x + len), yr - 0.32, s * 0.95, { seed: x * 3 + s, w: 0.6, detail });
      for (const g of P.pot) kit.add(M.pot, g, S);
      for (const g of P.shrub) kit.add(M.shrub[Math.floor(rng() * 2)], g, SH);
    }
  }
  if (c.roof === 'chimney') {
    for (const dx of [-L * 0.32, -L * 0.22]) { kit.add(M.iron, new THREE.CylinderGeometry(0.22, 0.26, 1.4, 8).translate(xc + dx, yr + 0.5, 0.9), SH); kit.add(M.iron, new THREE.CylinderGeometry(0.34, 0.34, 0.12, 8).translate(xc + dx, yr + 1.22, 0.9), SH); }
    for (const dx of [-3, 2, 6]) kit.add(M.steel, new THREE.BoxGeometry(1, 0.35, 0.6).translate(xc + dx, yr, -1.0), SH);
  }
  if (c.roof === 'terrace') skyLounge(kit, M, rng, { x0, x1, xc, L, detail, res, S });
  for (const p of c.pennants ?? []) {
    const px = xc + p[0] * L / 2, pz = p[1] ?? 0, h = p[2] ?? 3.2;
    kit.add(M.iron, rodGeo(V(px, yr - 0.1, pz), V(px, yr + h, pz), 0.05), SH);
    const g = pennant(px - 0.05, yr + h - 0.35, pz, { L: p[3] ?? 7, w: 0.6, phase: px * 0.3 });
    res.pennants.push({ g, mat: M.pennant[Math.floor(rng() * 2)] });
  }
}

/**
 * The dome carriage's roof: a broad deck over its curve from end to end (railed round), the sky lounge on it (a small
 * rounded cabin, its round front window lit, its door at the back onto the deck), planters and benches on the deck.
 */
function skyLounge(kit, M, rng, { x0, x1, xc, L, detail, res, S }) {
  const yd = TR.floor + TR.walk + 0.02, wd = 5.0, P2 = profile({ half: 2.1, sill: 0.9, head: 2.2, crown: 3.0, skirt: 0.12, tuck: 0.05, roof: detail >= 1 ? 6 : 4 });
  const dx0 = x0 + 0.4, dx1 = x1 - 0.4;
  kit.add(M.plank, new THREE.BoxGeometry(dx1 - dx0, 0.18, wd).translate((dx0 + dx1) / 2, yd - 0.09, 0), S);
  // (its brackets down onto the curve of the roof)
  // (each stands on the roof's curve where it is, never through it into the library's ceiling below)
  { const P = profile(), zb = wd / 2 - 0.3, f = Math.acos(Math.pow(Math.min(1, zb / (P.half - 0.06)), 1 / 0.9)), yr = TR.floor + P.head + (P.crown - P.head) * Math.sin(f), h = yd - 0.18 - yr;
    if (h > 0.05) for (let x = dx0 + 1; x < dx1; x += 3) for (const s of [-1, 1]) kit.add(M.iron, new THREE.BoxGeometry(0.1, h + 0.04, 0.1).translate(x, yr + h / 2, s * zb), SH); }
  // the railing round the deck (open where the walk comes on at each end)
  const rail = (a, b) => { kit.add(M.brass, rodGeo(a.clone().setY(yd + 1.0), b.clone().setY(yd + 1.0), 0.04), S); kit.add(M.brass, rodGeo(a.clone().setY(yd + 0.5), b.clone().setY(yd + 0.5), 0.025), S); };
  for (const s of [-1, 1]) { rail(V(dx0, 0, s * (wd / 2 - 0.06)), V(dx1, 0, s * (wd / 2 - 0.06))); for (let x = dx0; x <= dx1 + 0.01; x += 1.5) kit.add(M.brass, rodGeo(V(x, yd, s * (wd / 2 - 0.06)), V(x, yd + 1.0, s * (wd / 2 - 0.06)), 0.03), S); }
  for (const xe of [dx0, dx1]) for (const s of [-1, 1]) rail(V(xe, 0, s * (wd / 2 - 0.06)), V(xe, 0, s * 1.45));
  // the cabin: from lx0 to lx1, its round nose at the front (toward +x), a door through its back
  const lx0 = xc - 4, lx1 = xc + 5;
  const body = shell({ x0: lx0, x1: lx1, y0: yd, P: P2, windows: { 1: windowRow(lx0 + 0.5, lx1, 2.1, 1.4), [-1]: windowRow(lx0 + 0.5, lx1, 2.1, 1.4) } });
  for (const [k, m] of [['hull', M.plum], ['roof', M.roof], ['skirt', M.skirt], ['frame', M.frame], ['wain', M.wood], ['panel', M.panel], ['ceil', M.ceil]]) for (const g of body[k] ?? []) kit.add(m, g, S);
  const N = nose(lx1, { y0: yd, P: P2, k: 1.15, open: 1.0, reach: 2.8 });
  for (const [k, m] of [['hull', M.plum], ['roof', M.roof], ['skirt', M.skirt], ['ceil', M.ceil], ['panel', M.panel], ['frame', M.frame], ['floor', M.plank], ['rail', M.brass]]) for (const g of N[k] ?? []) kit.add(m, g, S);
  const E = endWall(lx0, -1, { y0: yd, P: P2, dw: 1.25, dh: 2.75 });
  for (const g of E.hull) kit.add(M.plum, g, S); for (const g of E.panel) kit.add(M.panel, g, S);
  kit.add(M.floor, new THREE.BoxGeometry(lx1 - lx0, 0.06, (P2.half - TR.wall) * 2).translate((lx0 + lx1) / 2, yd + 0.03, 0), S);
  // inside: two armchairs at the round window, a lamp
  for (const s of [-1, 1]) addParts(kit, M, armchair(lx1 - 0.6, yd + 0.06, s * 0.8, Math.PI / 2 - s * 0.25), { plush: M.plush, wood: M.wood }, S);
  const T = table(lx1 - 0.4, yd + 0.06, 0, { w: 0.6, round: true, cloth: false });
  addParts(kit, M, T, { wood: M.wood, brass: M.brass, glow: M.glow, linen: M.linen }, S);
  res.lamps.push(T.lamp);
  for (let x = lx0 + 1.2; x < lx1 - 0.5; x += 2.6) kit.add(M.lamp, ceilingLamp(x, yd + P2.crown - TR.wall, 0, 0.18), NC);
  res.lamps.push([(lx0 + lx1) / 2, yd + 2.2, 0]);
  // the deck's garden behind the cabin: planters along the rails, a bench
  for (const s of [-1, 1]) for (const g of [planter(dx0 + 0.6, lx0 - 1, yd, s * 1.6, { seed: s + 3, w: 0.7, detail })]) { for (const p of g.pot) kit.add(M.pot, p, S); for (const p of g.shrub) kit.add(M.shrub[Math.floor(rng() * 2)], p, SH); }
  kit.add(M.wood, new THREE.BoxGeometry(0.5, 0.45, 2.2).translate(dx0 + 2.6, yd + 0.22, 0.9), S);
  res.terraces.push({ x0: dx0, x1: dx1, y: yd, w: wd, cabin: [lx0, lx1] });
}

/** The landing wagon from x0 to x1: a broad deck (w m across) on a deep frame and four bogies, railed round, lamps on its corners. */
function landingWagon(kit, M, x0, x1, { solid, res, w = 34 }) {
  const S = solid ? SOLID : SH, xc = (x0 + x1) / 2, L = x1 - x0, y = TR.floor;
  kit.add(M.plank, new THREE.BoxGeometry(L, 0.3, w).translate(xc, y - 0.15, 0), S);
  kit.add(M.frame, new THREE.BoxGeometry(L - 1, 0.9, 4.6).translate(xc, y - 0.75, 0), SH);
  // the deck's underside trusses out to its edges
  for (let x = x0 + 2; x < x1 - 1; x += 4) for (const s of [-1, 1]) kit.add(M.iron, bar(V(x, y - 1.15, s * 2.2), V(x, y - 0.32, s * (w / 2 - 0.5)), 0.16), SH);
  kit.add(M.iron, new THREE.BoxGeometry(L, 0.3, 0.3).translate(xc, y - 0.42, w / 2 - 0.2), SH);
  kit.add(M.iron, new THREE.BoxGeometry(L, 0.3, 0.3).translate(xc, y - 0.42, -w / 2 + 0.2), SH);
  // the landing ring painted on the deck, the railing round, lamps on the corners
  kit.add(M.pennant[0], new THREE.RingGeometry(10, 10.6, 40).rotateX(-Math.PI / 2).translate(xc, y + 0.01, 0), NC);
  for (const s of [-1, 1]) {
    const z = s * (w / 2 - 0.15);
    kit.add(M.brass, rodGeo(V(x0, y + 1.0, z), V(x1, y + 1.0, z), 0.045), S);
    for (let x = x0; x <= x1 + 0.01; x += 2) kit.add(M.brass, rodGeo(V(x, y, z), V(x, y + 1.0, z), 0.03), S);
  }
  for (const xe of [x0, x1]) for (const s of [-1, 1]) {
    // the ends railed too, but open in the middle where the porches meet it
    kit.add(M.brass, rodGeo(V(xe, y + 1.0, s * (w / 2 - 0.15)), V(xe, y + 1.0, s * 1.2), 0.045), S);
    for (let z = 1.2; z < w / 2; z += 2) kit.add(M.brass, rodGeo(V(xe, y, s * z), V(xe, y + 1.0, s * z), 0.03), S);
    kit.add(M.iron, rodGeo(V(xe, y, s * (w / 2 - 0.4)), V(xe, y + 3.2, s * (w / 2 - 0.4)), 0.06), SH);
    kit.add(M.lamp, new THREE.SphereGeometry(0.25, 8, 6).translate(xe, y + 3.35, s * (w / 2 - 0.4)), NC);
    res.lamps.push([xe, y + 3.35, s * (w / 2 - 0.4)]);
  }
  for (const b of [x0 + 3, x0 + 8, x1 - 8, x1 - 3]) {
    const B = bogie(b, {});
    for (const g of B.iron ?? []) kit.add(M.iron, g, SH); for (const g of B.steel ?? []) kit.add(M.steel, g, SH);
    res.wheels.push(...B.wheels.map((wh) => ({ ...wh, drive: false })));
  }
  // its porches onto the carriages before and after it (the plate across the gap)
  for (const [xe, dir] of [[x1, 1], [x0, -1]]) kit.add(M.plank, new THREE.BoxGeometry(TR.gap / 2 + 0.02, 0.2, 2.4).translate(xe + dir * TR.gap / 4, y - 0.1, 0), S);
  res.landing = { x0, x1, xc, y, w };
}

/** The dust puffs as one instanced mesh per material (the views and the world's still cloud). */
export function dustMeshes(M, puffs, { detail = 2, seed = 1 } = {}) {
  const geo = puffGeo(detail, seed), dummy = new THREE.Object3D(), out = [];
  const lists = [puffs.filter((_, i) => i % 3), puffs.filter((_, i) => !(i % 3))];
  for (const [k, list] of lists.entries()) {
    const im = new THREE.InstancedMesh(geo, k ? M.dust2 : M.dust, list.length);
    list.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, i * 1.3, 0); dummy.scale.set(p.s * 1.3, p.s * p.sy, p.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.userData.noCollide = true; im.frustumCulled = false;
    out.push(im);
  }
  return out;
}

// ------------------------------------------------------------------ inside the carriages
/**
 * Furnish a carriage you can walk into (train()'s furnish): the lead's observation lounge, the dining car, a sleeping
 * car, the dome car's library. Solid as drawn where it stands on the floor (chairs, tables, bunks, walls); its lamps
 * become the kit's lights (r m) and res.lamps; seats where people can sit go to res.seats ([x, y, z, yaw]).
 */
export function furnishCar(kit, M, c, { x0, x1, xc, L, rng, res }, { solid = true, lights = true, detail = 1 } = {}) {
  const S = solid ? SOLID : SH, y = TR.floor, zi = TR.half - TR.wall - 0.04;
  const FURN = { plush: M.plush, wood: M.wood, linen: M.linen, brass: M.brass, glow: M.glow, books: M.plush2, books2: M.wood2 };
  const lamp = (p, r = 6) => { if (!p) return; res.lamps.push(p); if (lights) kit.light(p[0], p[1], p[2], r); };
  const seats = (res.seats ??= []);
  // round lamps along the ceiling's middle (seen as light through the windows from outside). (One long glowing strip
  // here drew, end on, a bright beam down the whole carriage: its bloom ran the length of it.)
  if (c.kind !== 'coach') {
    for (let x = x0 + 2; x < x1 - 1; x += 3.2) kit.add(M.lamp, ceilingLamp(x, y + TR.crown - TR.wall, 0), NC);
    for (let x = x0 + 4; x < x1 - 2; x += 8) if (lights) kit.light(x, y + 2.6, 0, 7.5);
  }
  if (c.kind === 'prow') {
    // a long rug, armchairs in pairs facing across the aisle at each window, round tables with lamps between
    kit.add(M.rug, new THREE.BoxGeometry(L - 3, 0.02, 2.0).translate(xc + 1, y + 0.01, 0), NC);
    for (let x = x0 + 3.2; x < x1 - 0.5; x += 2.4) for (const s of [-1, 1]) {
      const z = s * 2.15;
      addParts(kit, M, armchair(x - 0.5, y, z, s > 0 ? Math.PI : 0, {}), FURN, S);
      seats.push([x - 0.5, y, z, s > 0 ? Math.PI : 0]);
      if (((x - x0) / 2.4) % 2 < 1) { const T = table(x + 0.45, y, s * 2.35, { w: 0.55, round: true, cloth: false, h: 0.62 }); addParts(kit, M, T, FURN, S); lamp(T.lamp, 4); }
    }
    // the bar across the back, its bottles, a palm in a pot by the nose
    kit.add(M.wood, new THREE.BoxGeometry(0.7, 1.05, 1.6).translate(x0 + 1.4, y + 0.52, 1.85), S);
    kit.add(M.brass, new THREE.BoxGeometry(0.8, 0.05, 1.7).translate(x0 + 1.4, y + 1.07, 1.85), S);
    for (let i = 0; i < 7; i++) kit.add(i % 3 ? M.glow : M.plush2, new THREE.CylinderGeometry(0.04, 0.05, 0.28, 5).translate(x0 + 1.25 + (i % 2) * 0.2, y + 1.24, 1.2 + i * 0.2), NC);
    for (const s of [-1, 1]) { kit.add(M.pot, new THREE.CylinderGeometry(0.28, 0.22, 0.5, 8).translate(x1 + 0.6, y + 0.25, s * 2.4), S); for (const g of shrubs([x1 + 0.6, y + 0.6, s * 2.4], [x1 + 0.6, y + 1.4, s * 2.4], { n: 2, s: [0.4, 0.6], seed: s + 9, jitter: 0.1, detail })) kit.add(M.leaves, g, NC); }
  } else if (c.kind === 'dining') {
    // tables for four at each pair of windows, the aisle kept clear; the counter and its shelves at the back
    const win = CAR_KINDS.dining.windows(L)[1];
    for (const [a, b] of win) {
      const x = xc + (a + b) / 2;
      if (x < x0 + 3.4) continue;
      for (const s of [-1, 1]) {
        const T = table(x, y, s * 2.1, { w: 0.8, d: 1.1 }); addParts(kit, M, T, FURN, S); lamp(T.lamp, 3.5);
        for (const e of [-1, 1]) { addParts(kit, M, armchair(x + e * 0.75, y, s * 2.1, e > 0 ? -Math.PI / 2 : Math.PI / 2, { w: 0.62, back: 0.85 }), FURN, S); seats.push([x + e * 0.75, y, s * 2.1, e > 0 ? -Math.PI / 2 : Math.PI / 2]); }
      }
    }
    kit.add(M.wood, new THREE.BoxGeometry(2.4, 1.05, 0.6).translate(x0 + 1.6, y + 0.52, -2.3), S);
    kit.add(M.brass, new THREE.BoxGeometry(2.5, 0.05, 0.7).translate(x0 + 1.6, y + 1.07, -2.3), S);
    kit.add(M.wood2, new THREE.BoxGeometry(0.3, 1.6, 1.4).translate(x0 + 0.35, y + 1.6, -1.75), S);
    for (let i = 0; i < 12; i++) kit.add(i % 4 ? M.glow : M.linen, new THREE.CylinderGeometry(0.04, 0.05, 0.26, 5).translate(x0 + 0.42, y + 1.05 + Math.floor(i / 6) * 0.5, -2.35 + (i % 6) * 0.2), NC);
  } else if (c.kind === 'sleeper') {
    // the corridor along -z behind a partition, the compartments along +z (one per window), their doors open (or a few
    // shut); a vestibule at each end, where the end doors open, onto the corridor
    const zw = -1.35, H2 = 2.6, win = CAR_KINDS.sleeper.windows(L)[1].map(([a, b]) => [xc + a, xc + b]).filter(([a, b]) => a > x0 + 2.1 && b < x1 - 2.1);
    const cuts = [];
    for (let k = 0; k <= win.length; k++) {
      const xb = k === 0 ? win[0][0] - 0.6 : k === win.length ? win[k - 1][1] + 0.6 : (win[k - 1][1] + win[k][0]) / 2;
      cuts.push(xb);
      // the walls between compartments, and at the ends of their row (the vestibules beyond)
      kit.add(M.panel, new THREE.BoxGeometry(0.08, H2, zi - zw).translate(xb, y + H2 / 2, (zi + zw) / 2), S);
    }
    for (let k = 0; k < win.length; k++) {
      const a = cuts[k], b = cuts[k + 1], xm = (a + b) / 2, dw = 1.0, closed = rng() < 0.3;
      // the partition along the corridor, its door open (or a few shut)
      for (const [p, q] of [[a, xm - dw / 2], [xm + dw / 2, b]]) kit.add(M.panel, new THREE.BoxGeometry(q - p, H2, 0.08).translate((p + q) / 2, y + H2 / 2, zw), S);
      kit.add(M.panel, new THREE.BoxGeometry(dw, H2 - 2.1, 0.08).translate(xm, y + 2.1 + (H2 - 2.1) / 2, zw), S);
      if (closed) kit.add(M.wood2, new THREE.BoxGeometry(dw, 2.1, 0.05).translate(xm, y + 1.05, zw - 0.05), S);
      // two bunks along the window wall, a ladder, a small lamp, a case on the rack
      const bx = xm, bz = zi - 0.42;
      addParts(kit, M, bunk(bx, y, bz, { L: Math.min(1.95, b - a - 0.2), blanket: rng() < 0.5 ? 'plush' : 'plush2' }), { wood: M.wood, linen: M.linen, plush: M.plush, plush2: M.plush2 }, S);
      addParts(kit, M, bunk(bx, y + 1.25, bz, { L: Math.min(1.95, b - a - 0.2), blanket: 'plush2' }), { wood: M.wood, linen: M.linen, plush: M.plush, plush2: M.plush2 }, S);
      kit.add(M.brass, rodGeo(V(a + 0.25, y + 0.5, bz - 0.42), V(a + 0.25, y + 1.75, bz - 0.42), 0.02), NC);
      kit.add(M.glow, new THREE.SphereGeometry(0.08, 6, 4).translate(b - 0.25, y + 2.1, zi - 0.1), NC);
      if (lights && k % 2 === 0) kit.light(xm, y + 2.0, 0.8, 4.5);
      if (rng() < 0.7) kit.add(M.plush2, new THREE.BoxGeometry(0.6, 0.35, 0.3).translate(xm + (rng() - 0.5) * 0.5, y + 2.2, zw + 0.3), NC);
      seats.push([xm, y + 0.45, bz, Math.PI]);
    }
    // the corridor's runner, its window seats folded down here and there
    kit.add(M.rug, new THREE.BoxGeometry(L - 0.6, 0.02, 0.7).translate(xc, y + 0.01, (zw - zi) / 2), NC);
  } else if (c.kind === 'dome') {
    // the library: shelves along the -z side between the windows, sofas along +z, a writing desk, a globe of light
    const win = CAR_KINDS.dome.windows(L)[-1].map(([a, b]) => [xc + a, xc + b]);
    for (let k = 0; k < win.length - 1; k++) {
      const xm = (win[k][1] + win[k + 1][0]) / 2, w = win[k + 1][0] - win[k][1] - 0.1;
      if (w > 0.5) addParts(kit, M, bookshelf(xm, y, -zi + 0.2, 0, { L: w, n: 2, h: 0.95, seed: k }), FURN, S);
    }
    for (let x = x0 + 2.5; x < x1 - 2; x += 4.8) {
      addParts(kit, M, armchair(x, y, 2.25, Math.PI, { w: 1.8, back: 0.85 }), { plush: M.plush2, wood: M.wood }, S);
      seats.push([x, y, 2.25, Math.PI]);
      const T = table(x, y, 1.1, { w: 0.9, d: 0.5, h: 0.45, cloth: false }); addParts(kit, M, T, FURN, S); lamp(T.lamp, 4);
    }
    kit.add(M.rug, new THREE.BoxGeometry(L - 2, 0.02, 2.2).translate(xc, y + 0.01, 0.4), NC);
  }
}
