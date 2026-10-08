import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { put } from './lab-kit.js';
import { layeredCrown } from './garden-kit.js';
import { stick } from './salt-harbour-kit.js';
import { greebles } from './greeble-kit.js';
import { house, antennaPole, roofClutter, awning, laundry, poleCloth, resident, lantern } from './eclipse-kit.js';

// ---------------------------------------------------------------------------
// The City Floating in Space: its shapes and its look, shared by the world (space-city.js) and its reference
// views (reference-spacecity.js), after the pictures (references/The City Floating in Space/reference-1 … 4):
// a city of rounded adobe houses in cream, salmon and coral, heaped storey on storey on islands that float in the
// black of space, the islands joined by pale arched bridges, their undersides hung with dark machinery, tanks and
// pipes and long cables dangling into the void. Stars are printed all round, teal and white; a great pale planet
// hangs over the roofs as an ink-ringed disc (lit full, or a crescent). The traveller looks on from a dark teal
// balcony, a glowing bottle on his back.
//
//   spaceMats(kit)   the city's materials, with the keys eclipse-kit.js's builders read (so house, lantern,
//                    awning, laundry, resident … build here in the city's colours)
//   island           a floating island: a slab of its outline, a parapet round its edge (gaps where bridges land),
//                    under it the machinery: stepped masses, tanks, pipes, cables hanging into the void, lights
//   bridge           a pale arched bridge from one deck to another: the deck, its parapets, the arch under it
//   quarter          a heap of houses on a deck: blocks, drums and towers, a storey or two stacked on some, roofs
//                    with their trees, antennas, chimneys, washing and clutter
//   crownTree        a dark round tree on a roof or a terrace
//   railing          the balcony's dark teal railing along a line (posts, rails), or a solid parapet
//   pipeStack        a column of dark teal pipes with collars (the machinery at the pictures' edges)
//   spaceTraveller   the traveller from behind: the hooded cloak, the pack and its glowing bottle
// Builders add to the kit (RoomKit) with the city's materials (M). Solid as drawn: slabs, parapets, bridges,
// houses, the railing; what hangs under the islands and what is small (cables, lamps, trees, cloth) is drawn only.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;
const SOLID = { solid: true, shadow: true }, NC = { solid: false, shadow: false }, SH = { solid: false, shadow: true };

// ------------------------------------------------------------------ the look
/** The surfaces' tones, read off the pictures (lit patches; the light and the shade tint do the rest). */
export const SPACE_TONES = {
  // the walls: cream peach, salmon, coral, a pink cream (ref 1 #fae1bb #efa992, ref 3 #dc8b69, ref 4 #fc8b63)
  lime: ['#f8dcbc', '#f0ac94', '#f4946e', '#f6c4aa'],
  stone: '#f0cdb4', paving: '#f2d2b8', masonry: '#e8b8a0', bridge: '#f4d4b8',
  dark: '#1a2228', door: '#6a3e30', doorLit: '#ffb466', lit: '#ffb870', lamp: '#ffd48c', iron: '#24323a', wood: '#5a3a30',
  cloth: ['#5aa8a8', '#e8a088', '#f2d8c0', '#3e7e86'], table: ['#d89a80', '#5a8a8c'],
  flower: ['#e0786a', '#f0a07a', '#c8605a'], leaf: '#24344a', pot: '#8a5a4a', pale: '#fbe8d4',
  cloak: ['#c47a6a', '#8a5a52', '#d89a80', '#5a6a78', '#3a4a5a', '#b06a5a', '#e8c4a8'], skin: '#d8a088',
  // under the islands: dark slate machinery, teal pipes, black cables (ref 1 #393e53 #242d3c, ref 2 #295960 #153639)
  under: '#3a4250', under2: '#2a3644', pipe: '#2e5c64', cable: '#121a20', glowTeal: '#8ef0e4',
  // the balcony and the machinery in the foreground (ref 1 #153143, its shade #0b1923)
  rail: '#24485a', crown: ['#24344a', '#1e2c3e'], bark: '#3a2c30',
  traveller: '#0c161e', pack: '#4a3a34', bottle: '#c8fff4', packRim: '#141c24',
};
/**
 * The light (sky top, horizon, shadow tint, light tint, sun): space black with a trace of teal at every hour, the
 * walls' shade a deeper rose (ref 1: lit #fae1bb, shaded #c28070), a warm light.
 */
export const SPACE_DAY = ['#020a0e', '#030b10', '#b8868e', '#fff2e2', '#fff8ec'];
/** Space all round (post.js drawSpace): the stars dense, a third of them teal, a faint nebula in two flat steps. */
export const SPACE_SKY = { uSpace: [1, 0.55, 0.35, 0.35], uSpaceTone: [0.035, 0.085, 0.1, 1], uSpaceSun: [0, 1, 0, 0], uSpaceNight: [0, 0, 0, 0] };
/** The far islands go paler and pinker, not darker (the black sky would grey them): a rose haze in a few steps. */
export const SPACE_HAZE = { uHaze: [0.97, 0.8, 0.72, 0.85], uHazeLayers: [90, 1.8, 0.12, 4], uHazeTone: [0.98, 0.84, 0.76, 0.85] };
/**
 * The city's touches on the print preset: no clouds, a flat sky, no sun rays, the shade printed flat, little
 * hatching, spot blacks in the machinery under the islands, cast shadows kept (the sun is hard in space).
 */
export const SPACE_LOOK = {
  uClouds: 0, uCumulus: 0, uSkyDots: 0, uSkyFlat: 1, uSkyBands: 0, uRays: 0, uShadowFlat: 0.6, uShadeKeep: 0.35, uHalftone: 0.2,
  uHatch: 0.22, uFogDensity: 0.0009, uFogStart: 140, uAerial: 0.2, uSpot: [0.6, 3, 0.35, 0.15], uSpotTone: [0.05, 0.09, 0.12, 0.3], uCast: [0.2, 0.1],
  ...SPACE_SKY, ...SPACE_HAZE,
};
/** The great planet's colour (a pale cream: ref 2 #fee2bf, ref 4 #fde4c0). */
export const PLANET_TONE = '#fde2c0';

/** The city's materials, made by the kit (shared per option set): eclipse-kit.js's keys, in the city's colours. */
export function spaceMats(kit) {
  const T = SPACE_TONES, DS = THREE.DoubleSide;
  return {
    lime: T.lime.map((c) => kit.mat({ color: c, flat: true, patches: 0.45 })),
    stone: kit.mat({ color: T.stone, flat: true, weathered: 0.25 }),
    masonry: kit.mat({ color: T.masonry, flat: true, patches: 0.4 }),
    tower: kit.mat({ color: T.lime[0], flat: true, grid: 2.4, patches: 0.4 }),
    paving: kit.mat({ color: T.paving, flat: true, grid: 3 }),
    bridge: kit.mat({ color: T.bridge, flat: true, grid: 1.6 }),
    step: kit.mat({ color: T.stone, flat: true, hatch: 0.4 }),
    dark: kit.mat({ color: T.dark, flat: true }),
    door: kit.mat({ color: T.door, flat: true }),
    doorLit: kit.mat({ color: T.doorLit, glow: 0.85, flat: true, spot: 0 }),
    lit: kit.mat({ color: T.lit, glow: 0.9, flat: true, spot: 0 }),
    lamp: kit.mat({ color: T.lamp, glow: 1, flat: true, spot: 0, line: 0.5, lineTint: 0.6 }),
    iron: kit.mat({ color: T.iron, flat: true }),
    wood: kit.mat({ color: T.wood, flat: true }),
    cloth: T.cloth.map((c) => kit.mat({ color: c, side: DS, shade: 0.3, hatch: 0.2, line: 0.7, lineTint: 0.6 })),
    table: T.table.map((c) => kit.mat({ color: c, flat: true, side: DS })),
    flower: T.flower.map((c) => kit.mat({ color: c, pattern: 'leaves', hatch: 0.5, shade: 0.4, line: 0.6, lineTint: 0.7 })),
    leaf: kit.mat({ color: T.leaf, flat: true, line: 0.6, lineTint: 0.6 }),
    pot: kit.mat({ color: T.pot, flat: true }),
    pale: kit.mat({ color: T.pale, flat: true, side: DS }),
    cloaks: T.cloak.map((c) => kit.mat({ color: c, flat: true, figure: true })),
    skin: kit.mat({ color: T.skin, flat: true, figure: true }),
    // under the islands
    under: kit.mat({ color: T.under, shade: 0.2, hatch: 0.5, detail: 'built', detailDensity: 0.5 }),
    under2: kit.mat({ color: T.under2, flat: true, hatch: 0.4 }),
    pipe: kit.mat({ color: T.pipe, flat: true, hatch: 0.3 }),
    cable: kit.mat({ color: T.cable, flat: true, thin: 1.2 }),
    glowTeal: kit.mat({ color: T.glowTeal, glow: 1, flat: true, spot: 0 }),
    rail: kit.mat({ color: T.rail, flat: true, hatch: 0.3 }),
    crown: T.crown.map((c) => kit.mat({ color: c, pattern: 'leaves', hatch: 0.6, shade: 0.4, line: 0.6, lineTint: 0.5, spot: 0 })),
    bark: kit.mat({ color: T.bark, flat: true }),
    traveller: kit.mat({ color: T.traveller, flat: true, figure: true }),
    pack: kit.mat({ color: T.pack, flat: true, figure: true }),
    bottle: kit.mat({ color: T.bottle, glow: 0.55, flat: true, spot: 0, line: 0.5, lineTint: 0.5 }),
    packRim: kit.mat({ color: T.packRim, flat: true, figure: true }),
  };
}

// ------------------------------------------------------------------ islands
/**
 * An island's outline (local x, z round its centre): a rounded rectangle w × d (corner radius cr), its edge
 * wobbling `wob` m, `n` points round it. Returns [[x, z]…] counter-clockwise seen from above.
 */
export function outline(w, d, { cr = Math.min(w, d) * 0.3, wob = 0, n = 48, seed = 1 } = {}) {
  const rng = mulberry32(seed), pts = [], hw = w / 2 - cr, hd = d / 2 - cr;
  // a superellipse-like walk round the rounded rectangle: per angle, the point of the shape in that direction
  const ph = rng() * 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a);
    // the ray from the centre to the rounded rectangle (|x| <= hw + cr, |z| <= hd + cr, corners round)
    let lo = 0, hi = Math.hypot(w, d);
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2, x = Math.abs(c * m), z = Math.abs(s * m);
      const dx = Math.max(0, x - hw), dz = Math.max(0, z - hd);
      if (Math.hypot(dx, dz) <= cr && x <= hw + cr && z <= hd + cr) lo = m; else hi = m;
    }
    const r = lo + wob * (Math.sin(a * 3 + ph) * 0.6 + Math.sin(a * 7 + ph * 2) * 0.4);
    pts.push([c * r, -s * r]);
  }
  return pts;
}
const shapeOf = (pts, sc = 1) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x * sc, -z * sc) : s.moveTo(x * sc, -z * sc))); return s; };
const extruded = (pts, h, sc = 1) => {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts, sc), { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
  for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
  return g;
};
/** Is (x, z) inside a polygon [[x, z]…]? */
export function inPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A floating island at (x, y, z) (y: its deck), turned yaw: its outline (pts: local [[x, z]…], or w × d with cr, wob),
 * a slab `thick` m deep, a parapet `rim` m high round its edge (gaps: [[x, z, r]…] local, where it is open: the
 * bridges' landings, stairs), and under it the machinery `deep` m down: stepped masses of its outline shrinking,
 * tanks and pipes hung from them, cables dangling far into the void (cables: how many), lamps (lights). detail
 * (1 the views, under 1 the world) thins the hanging things. Returns { pts (local), y, x, z, yaw, inside(x, z, m) }
 * (inside: a world point m in from the edge).
 */
export function island(kit, M, rng, { x = 0, y = 0, z = 0, yaw = 0, pts = null, w = 30, d = 24, cr, wob = 0.8, thick = 3.2, rim = 0.95, gaps = [], deep = 18, cables = 14, lights = 4, detail = 1, deck = true, seed = 1 }) {
  pts ??= outline(w, d, { cr, wob, n: Math.max(24, Math.round((w + d) * 1.1 * Math.min(1, detail + 0.2))), seed });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const W = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];   // local → world (x, z)
  const place = (g) => put(g, x, 0, z, yaw);
  // the slab, its deck a paving plate over it
  kit.add(M.masonry, place(extruded(pts, thick).translate(0, y - thick - 0.02, 0)), SOLID);
  if (deck) kit.add(M.paving, place(extruded(pts, 0.06, 0.995).translate(0, y - 0.06, 0)), SOLID);
  // the parapet round the edge, a box per stretch of the outline, open at the gaps
  if (rim > 0) for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (gaps.some(([gx, gz, gr]) => Math.hypot(mx - gx, mz - gz) < gr)) continue;
    const L = Math.hypot(bx - ax, bz - az), a = Math.atan2(-(bz - az), bx - ax), nl = Math.hypot(mx, mz) || 1;
    kit.add(M.stone, put(new THREE.BoxGeometry(L + 0.12, rim, 0.42), x + c * (mx - (mx / nl) * 0.2) + s * (mz - (mz / nl) * 0.2), y + rim / 2, z - s * (mx - (mx / nl) * 0.2) + c * (mz - (mz / nl) * 0.2), yaw + a), SOLID);
  }
  // ---- under it: the machinery, drawn only (nothing walks there)
  const bottom = y - thick;
  const tiers = [[0.86, 2.4], [0.66, 3], [0.42, 3.6], [0.22, 4.2]].slice(0, deep > 22 ? 4 : deep > 12 ? 3 : 2);
  let yy = bottom;
  for (const [k, h] of tiers) {
    kit.add(M.under, place(extruded(pts, h, k).translate(0, yy - h, 0)), SH);   // (drawn only, as all that hangs under: you fall past it into the void and come back where you stood)
    yy -= h;
  }
  // a bulb or drum at the very bottom
  const R0 = Math.min(w, d) * 0.12;
  kit.add(M.under2, put(new THREE.CylinderGeometry(R0, R0 * 0.5, 3, 10), x, yy - 1.5, z), NC);
  // greebles under the slab (the pipes run along it, rods and drops hanging), and on the tiers' sides
  {
    const g = greebles(seed * 3 + 1), hw = w * 0.38, hd = d * 0.38;
    g.patch(V(-hw, bottom - 0.02, -hd), V(1, 0, 0), V(0, 0, 1), V(0, -1, 0), hw * 2, hd * 2, { density: 0.5 * detail, scale: 1.4, depth: 0.8, hang: true });
    const m = g.merged();
    for (const [k, mat] of [['metal', M.pipe], ['dark', M.under2], ['pale', M.under]]) if (m[k]) kit.add(mat, place(m[k]), NC);
  }
  // tanks and pipes hung from the tiers, cables far down
  const inner = (k) => { for (let t = 0; t < 30; t++) { const lx = (rng() - 0.5) * w * k, lz = (rng() - 0.5) * d * k; if (inPoly(pts, lx / 0.9, lz / 0.9)) return [lx, lz]; } return [0, 0]; };
  const nT = Math.round((4 + (w * d) / 120) * detail);
  for (let i = 0; i < nT; i++) {
    const [lx, lz] = inner(0.75), [wx, wz] = W(lx, lz), r = 0.5 + rng() * 1.3, h = 2 + rng() * 7, top = bottom - 0.5 - rng() * 3;
    kit.add(rng() < 0.5 ? M.under2 : M.pipe, put(new THREE.CylinderGeometry(r, r, h, 8), wx, top - h / 2, wz), NC);
    kit.add(M.iron, put(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.25, 8), wx, top - h * (0.2 + rng() * 0.5), wz), NC);
    if (rng() < 0.6) kit.add(M.under2, put(new THREE.SphereGeometry(r, 8, 4, 0, TAU, Math.PI / 2, Math.PI / 2), wx, top - h, wz), NC);
  }
  const nP = Math.round((6 + (w * d) / 90) * detail);
  for (let i = 0; i < nP; i++) {
    const [lx, lz] = inner(0.85), [wx, wz] = W(lx, lz), r = 0.1 + rng() * 0.2, h = 4 + rng() * deep * 0.9;
    kit.add(M.pipe, put(new THREE.CylinderGeometry(r, r, h, 5), wx, bottom - h / 2, wz), NC);
    if (rng() < 0.5) kit.add(M.iron, put(new THREE.CylinderGeometry(r * 1.8, r * 1.8, 0.3, 6), wx, bottom - h + 0.15, wz), NC);
  }
  const nC = Math.round(cables * detail);
  for (let i = 0; i < nC; i++) {
    const [lx, lz] = inner(0.95), [wx, wz] = W(lx, lz), len = deep * (0.8 + rng() * 2.4);
    if (rng() < 0.3 && i + 1 < nC) {
      // a loop: a cable sagging between two points under the island
      const [mx, mz] = inner(0.95), [vx, vz] = W(mx, mz), sag = 4 + rng() * 10;
      const pts3 = Array.from({ length: 9 }, (_, k) => { const t = k / 8; return V(wx + (vx - wx) * t, bottom - 1 - Math.sin(Math.PI * t) * sag, wz + (vz - wz) * t); });
      kit.add(M.cable, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3), 8, 0.06, 3, false), NC);
      i++;
    } else kit.add(M.cable, stick(V(wx, bottom - 0.5, wz), V(wx + (rng() - 0.5) * 0.6, bottom - len, wz + (rng() - 0.5) * 0.6), 0.04 + rng() * 0.04, 3), NC);
  }
  // lamps under it: small teal and amber glows
  for (let i = 0; i < lights; i++) {
    const [lx, lz] = inner(0.8), [wx, wz] = W(lx, lz), ly = bottom - 1 - rng() * deep * 0.5, teal = rng() < 0.6;
    kit.add(teal ? M.glowTeal : M.lamp, new THREE.SphereGeometry(0.28, 8, 6).translate(wx, ly, wz), NC);
    kit.light(wx, ly, wz, 7);
  }
  const ci = Math.cos(-yaw), si = Math.sin(-yaw);
  const toLocal = (px, pz) => { const dx = px - x, dz = pz - z; return [ci * dx + si * dz, -si * dx + ci * dz]; };
  return {
    pts, y, x, z, yaw, W, toLocal,
    /** Is the world point (px, pz) on the deck, m in from its edge? */
    inside(px, pz, m = 0) {
      const [lx, lz] = toLocal(px, pz);
      if (!inPoly(pts, lx, lz)) return false;
      if (m <= 0) return true;
      for (let k = 0; k < 8; k++) if (!inPoly(pts, lx + Math.cos(k * 0.785) * m, lz + Math.sin(k * 0.785) * m)) return false;
      return true;
    },
  };
}

/** A solid slab of the outline pts (local, round (x, z) turned yaw) from y0 up to y1 (a deck, a terrace, a balcony's floor). */
export function slab(kit, mat, pts, x, z, yaw, y0, y1, how = SOLID) {
  kit.add(mat, put(extruded(pts, y1 - y0).translate(0, y0, 0), x, 0, z, yaw), how);
}

/**
 * A heaped quarter on an island (I: what island() returned): terraces of its outline stepping up and back, `steps`
 * of them `rise` m each (the first the deck itself), each scaled `k` smaller than the one under it and set back
 * toward local -z by `back` of the island's depth; houses round each terrace's edge, facing local +z (and turned a
 * little round the hill), the top terrace full of them. q: quarter's options for every step (n: houses a step).
 * Returns the steps ([{ pts, y, inside }…]).
 */
export function heap(kit, M, rng, I, { steps = 1, rise = 4, k = 0.24, back = 0.12, d = 30, q = {}, clear = [], parapet = 0.9, fore = 1.2, peak = 0, mound = [0, -0.15], spread = 1.2 } = {}) {
  // the mound: storeys heaped up toward a point of the island (mound: where, as shares of its half-width and depth), `peak` more there
  const R = Math.max(...I.pts.map(([a, b]) => Math.hypot(a, b))), [mwx, mwz] = I.W(mound[0] * R, mound[1] * R);
  const levels = peak > 0 ? (px, pz, r) => Math.max(0, Math.round(peak * Math.max(0, 1 - Math.hypot(px - mwx, pz - mwz) / (R * spread)) + (r() - 0.5) * 1.6)) : null;
  const out = [];
  for (let s = 0; s < steps; s++) {
    const sc = 1 - s * k, oz = -s * back * d, y = I.y + s * rise;
    const pts = I.pts.map(([px, pz]) => [px * sc, pz * sc + oz]);
    if (s > 0) {
      slab(kit, M.masonry, pts, I.x, I.z, I.yaw, I.y - 0.5, y);
      // its parapet along the front half (the step's edge over the terrace below)
      if (parapet > 0) for (let i = 0; i < pts.length; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
        if ((az + bz) / 2 < oz + 1) continue;
        const L = Math.hypot(bx - ax, bz - az), a = Math.atan2(-(bz - az), bx - ax), [wx, wz] = I.W((ax + bx) / 2, (az + bz) / 2);
        kit.add(M.stone, put(new THREE.BoxGeometry(L + 0.1, parapet, 0.36), wx, y + parapet / 2, wz, I.yaw + a), SOLID);
      }
    }
    const inStep = (px, pz, m = 0) => {
      const [lx, lz] = I.toLocal(px, pz);
      const ok = (u, v) => inPoly(pts, u, v);
      if (!ok(lx, lz)) return false;
      for (let j = 0; j < 8 && m > 0; j++) if (!ok(lx + Math.cos(j * 0.785) * m, lz + Math.sin(j * 0.785) * m)) return false;
      return true;
    };
    out.push({ pts, y, inside: inStep, sc, oz });
  }
  for (let s = 0; s < steps; s++) {
    const st = out[s], next = out[s + 1];
    // houses on this step, off the next one up (and a little clear of its foot: the walk round it)
    // (the centre off the next step up by `fore` m: a house's back may run into the terrace behind it, built into it)
    const inside = (px, pz, m) => st.inside(px, pz, m * 0.55 + 0.4) && !(next && near(next, px, pz, fore));
    const near = (n2, px, pz, r) => { for (let j = 0; j < 8; j++) if (n2.inside(px + Math.cos(j * 0.785) * r, pz + Math.sin(j * 0.785) * r)) return true; return false; };
    const ext = Math.max(...I.pts.map(([a, b]) => Math.hypot(a, b))) * st.sc;
    quarter(kit, M, rng, { x0: I.x - ext, x1: I.x + ext, z0: I.z - ext, z1: I.z + ext, y: st.y, yaw: I.yaw, inside, clear, levels, ...q });
  }
  return out;
}

// ------------------------------------------------------------------ bridges
/**
 * A pale arched bridge from A to B ([x, y, z]: the deck's top at each end), w wide: the deck (rising `hump` m in
 * the middle), its parapets `rail` m high, the arch under it (end: how deep the bridge is at its ends, mid: in the
 * middle), run on `ext` m past each end into the decks. Solid as drawn. Returns { at(t): the deck's top at t (0 … 1) }.
 */
export function bridge(kit, M, A, B, { w = 3.4, rail = 0.95, end = 5, mid = 1.1, hump = 0.5, ext = 1.5, seg = 0, mat = null } = {}) {
  const a = V(...A), b = V(...B), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  const n = seg || Math.max(10, Math.round(L / 1.6));
  const top = (u) => a.y + (b.y - a.y) * THREE.MathUtils.clamp(u / L, 0, 1) + hump * Math.sin(Math.PI * THREE.MathUtils.clamp(u / L, 0, 1));
  const under = (u) => { const t = THREE.MathUtils.clamp(u / L, 0, 1) * 2 - 1; return top(u) - mid - (end - mid) * (1 - Math.sqrt(Math.max(0, 1 - t * t))); };
  // the side profile (u along, v up) extruded across, then stood along A → B
  const sh = new THREE.Shape(), us = Array.from({ length: n + 1 }, (_, i) => -ext + (i / n) * (L + 2 * ext));
  us.forEach((u, i) => (i ? sh.lineTo(u, top(u)) : sh.moveTo(u, top(u))));
  for (let i = n; i >= 0; i--) sh.lineTo(us[i], under(us[i]));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -w / 2).rotateY(-Math.PI / 2);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  // (after rotateY(-π/2) the profile's u runs along +z: turn it to A → B)
  kit.add(mat ?? M.bridge, put(g, a.x, 0, a.z, yaw), SOLID);
  // the parapets: a box per stretch along each edge
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const e of [-1, 1]) for (let i = 0; i < n; i++) {
    const u0 = (i / n) * L, u1 = ((i + 1) / n) * L, y0 = top(u0), y1 = top(u1), um = (u0 + u1) / 2, ym = (y0 + y1) / 2;
    const off = e * (w / 2 - 0.2), px = a.x + s * um + c * off, pz = a.z + c * um - s * off;
    kit.add(M.stone, put(new THREE.BoxGeometry(0.38, rail, Math.hypot(u1 - u0, y1 - y0) + 0.05), px, ym + rail / 2, pz, yaw, 1, -Math.atan2(y1 - y0, u1 - u0)), SOLID);
  }
  return { at: (t) => { const u = t * L; return [a.x + s * u, top(u), a.z + c * u]; }, L, yaw };
}

// ------------------------------------------------------------------ houses
/** A dark round tree at (x, y, z) (its foot), s its crown's half-width. */
export function crownTree(kit, M, rng, x, y, z, s = 1.6, { trunk = s * 0.9, detail = 1 } = {}) {
  kit.add(M.bark, new THREE.CylinderGeometry(0.08 * s, 0.13 * s, trunk, 5).translate(x, y + trunk / 2, z), NC);
  // (far off, under detail 0.6: one lumpy ball of a few faces, not the layered masses)
  const g = (detail < 0.6 ? new THREE.IcosahedronGeometry(1, 0).scale(1, 0.85, 1) : layeredCrown(Math.floor(rng() * 1e4), { lobes: detail < 0.9 ? [4, 2, 1] : [5, 3, 1] })).scale(s, s * 0.8, s).translate(x, y + trunk + s * 0.45, z);
  kit.add(kit.pick(M.crown), g, NC);
}
/** A chimney or a vent pipe on a roof at (x, y, z), h high. */
export function chimney(kit, M, rng, x, y, z, h = 2.5) {
  const r = 0.25 + rng() * 0.3;
  kit.add(rng() < 0.5 ? M.lime[0] : M.stone, new THREE.CylinderGeometry(r, r * 1.05, h, 8).translate(x, y + h / 2, z), { solid: true, shadow: true });
  kit.add(M.iron, new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.18, 8).translate(x, y + h, z), { solid: true, shadow: true });
}

/**
 * A heap of houses over a deck: n houses scattered over x0..x1 × z0..z1 (in a frame turned yaw about (x0+x1)/2,
 * (z0+z1)/2: their fronts toward local +z), each at the deck's height y (or yAt(x, z)), kept off `clear` ([[x, z, r]…]
 * world) and inside `inside(x, z)` if given; some carry a storey or two more, set back; their roofs trees, antennas,
 * chimneys, washing, awnings and clutter. size: [min, max] footprint, tall: [min, max] storey height. Returns the
 * houses placed ([{ x, z, r, top }…]).
 */
export function quarter(kit, M, rng, { x0, x1, z0, z1, y = 0, yAt = null, yaw = 0, n = 20, size = [4, 8], tall = [3.2, 6], stack = 0.5, stack2 = 0.2, clear = [], inside = null, round = 0.25, towers = 0.06, domes = 0.25, trees = 0.3, detail = 1, lit = 0.45, solid = true, antenna = 0.25, awnings = 0.25, wash = 0.15, gap = 0.4, placed = [], levels = null, face = null, light = true }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, c = Math.cos(yaw), s = Math.sin(yaw), out = [];
  for (let tries = 0; tries < n * 12 && out.length < n; tries++) {
    const lx = x0 + rng() * (x1 - x0) - cx, lz = z0 + rng() * (z1 - z0) - cz, px = cx + c * lx + s * lz, pz = cz - s * lx + c * lz;
    const w = size[0] + rng() * (size[1] - size[0]), d = w * (0.75 + rng() * 0.5), r = Math.hypot(w, d) / 2;
    if (inside && !inside(px, pz, r * 0.8)) continue;
    if (clear.some(([qx, qz, qr]) => Math.hypot(px - qx, pz - qz) < qr + r * 0.9)) continue;
    if ([...placed, ...out].some((h) => Math.hypot(px - h.x, pz - h.z) < (h.r + r) * 0.72 + gap)) continue;
    const gy = yAt ? yAt(px, pz) : y, kr = rng(), kind = kr < towers ? 'tower' : kr < towers + round ? 'drum' : 'block';
    const h = kind === 'tower' ? tall[1] * (1.6 + rng()) : tall[0] + rng() * (tall[1] - tall[0]);
    const a = face ? face(px, pz) + (rng() - 0.5) * 0.2 : yaw + (rng() - 0.5) * 0.3;
    const roof = rng() < domes ? 'dome' : 'flat';
    const H1 = house(kit, M, rng, { x: px, y: gy, z: pz, w, d, h, yaw: a, kind, roof, k: 0.55 + rng() * 0.3, doors: 1, windows: 2 + Math.floor(rng() * 3), lit, wood: 0.3, flowers: detail < 0.6 ? 0 : 0.15, antenna: 0, detail, cr: 0.8 + rng() * 1.2, solid, light });
    let topY = H1.top;
    const tops = [[px, pz, w, d, topY, roof]];
    if (levels) {
      // storeys heaped on it (levels(x, z): how many more here), each a little smaller and set back toward its back
      let cw = w, cd = d, sx = px, sz = pz, ty = topY;
      const L = roof === 'flat' && kind !== 'tower' ? levels(px, pz, rng) : 0;
      for (let j = 0; j < L; j++) {
        const sw = cw * (0.7 + rng() * 0.24), sd = cd * (0.7 + rng() * 0.24), ox = (rng() - 0.5) * (cw - sw), oz = -(cd - sd) * (0.2 + rng() * 0.5);
        sx += Math.cos(a) * ox + Math.sin(a) * oz; sz += -Math.sin(a) * ox + Math.cos(a) * oz;
        const rf = j === L - 1 && rng() < domes * 1.5 ? 'dome' : 'flat';
        const Hn = house(kit, M, rng, { x: sx, y: ty, z: sz, w: sw, d: sd, h: tall[0] * (0.85 + rng() * 0.45), yaw: a, kind: rng() < round * 0.5 ? 'drum' : 'block', roof: rf, doors: rng() < 0.2 ? 1 : 0, windows: 1 + Math.floor(rng() * 3), lit, flowers: detail < 0.6 ? 0 : 0.2, antenna: 0, detail, cr: 0.5 + rng() * 0.7, solid, light: false });
        tops.push([sx, sz, sw, sd, Hn.top, rf]);
        ty = Hn.top; cw = sw; cd = sd;
        if (rf !== 'flat' || cw < 2.6) break;
      }
      topY = ty;
    } else if (roof === 'flat' && kind !== 'tower' && rng() < stack) {
      // a storey or two more, set back toward the back
      const w2 = w * (0.55 + rng() * 0.3), d2 = d * (0.55 + rng() * 0.3), back = (d - d2) * 0.4, sx = px - Math.sin(a) * back, sz = pz - Math.cos(a) * back;
      const roof2 = rng() < domes * 1.4 ? 'dome' : 'flat';
      const H2 = house(kit, M, rng, { x: sx, y: topY, z: sz, w: w2, d: d2, h: tall[0] * (0.8 + rng() * 0.5), yaw: a, kind: rng() < round ? 'drum' : 'block', roof: roof2, doors: rng() < 0.6 ? 1 : 0, windows: 2, lit, flowers: 0.2, antenna: 0, detail, cr: 0.7, solid, light: false });
      tops.push([sx, sz, w2, d2, H2.top, roof2]);
      topY = H2.top;
      if (roof2 === 'flat' && rng() < stack2) {
        const H3 = house(kit, M, rng, { x: sx, y: H2.top, z: sz, w: w2 * 0.6, d: d2 * 0.6, h: tall[0] * 0.8, yaw: a, kind: 'block', roof: rng() < 0.5 ? 'dome' : 'flat', doors: 0, windows: 1, lit, antenna: 0, detail, cr: 0.5, solid, light: false });
        tops.push([sx, sz, w2 * 0.6, d2 * 0.6, H3.top, 'dome']);
        topY = H3.top;
      }
    }
    // on the roofs: a tree, antennas, a chimney, clutter, a sheet on poles
    for (const [tx, tz, tw, td, ty, tr] of tops) {
      if (tr !== 'flat') continue;
      const ox = (rng() - 0.5) * tw * 0.4, oz = (rng() - 0.5) * td * 0.4;
      const q = rng();
      if (q < trees) crownTree(kit, M, rng, tx + ox, ty + 0.4, tz + oz, 0.9 + rng() * 0.9, { detail });
      else if (q < trees + 0.25) chimney(kit, M, rng, tx + ox, ty, tz + oz, 1.5 + rng() * 3);
      else if (q < trees + 0.4 && detail >= 0.8) roofClutter(kit, M, Math.floor(rng() * 1e4), tx - tw * 0.3, tx + tw * 0.3, tz - td * 0.3, tz + td * 0.3, ty);
      if (rng() < antenna) antennaPole(kit, M, rng, tx - ox, ty, tz - oz, 2.5 + rng() * 5);
    }
    // an awning over the door, washing across the front
    if (rng() < awnings && kind === 'block') {
      const fx = px + Math.sin(a) * (d / 2 + 0.05), fz = pz + Math.cos(a) * (d / 2 + 0.05), ux = Math.cos(a) * w * 0.3, uz = -Math.sin(a) * w * 0.3;
      awning(kit, M, rng, [fx - ux, gy + 2.9, fz - uz], [fx + ux, gy + 2.9, fz + uz], { out: 1.6, drop: 0.6, n: [Math.sin(a), Math.cos(a)], poles: false });
    }
    if (rng() < wash && kind === 'block') {
      const fx = px + Math.sin(a) * (d / 2 + 0.25), fz = pz + Math.cos(a) * (d / 2 + 0.25), ux = Math.cos(a) * w * 0.4, uz = -Math.sin(a) * w * 0.4;
      laundry(kit, M, rng, [fx - ux, gy + h - 0.6, fz - uz], [fx + ux, gy + h - 0.4, fz + uz], { n: 3, drop: [0.6, 1.1], sag: 0.25 });
    }
    out.push({ x: px, z: pz, r, top: topY, y: gy, w, d, yaw: a });
  }
  return out;
}

// ------------------------------------------------------------------ the balcony, the machinery near
/**
 * The dark teal railing along the line pts ([[x, y, z]…]: its foot), h high: a thick top rail, a rail under it,
 * square posts every `step` m; or (solid) a parapet wall. Solid as drawn.
 */
export function railing(kit, M, pts, { h = 1.1, step = 1.5, solidWall = false, t = 0.32, mat = M.rail } = {}) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = V(...pts[i]), b = V(...pts[i + 1]), L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z), m = a.clone().lerp(b, 0.5);
    if (solidWall) { kit.add(mat, put(new THREE.BoxGeometry(t * 1.6, h, L + t), m.x, m.y + h / 2, m.z, yaw), SOLID); kit.add(mat, put(new THREE.BoxGeometry(t * 2.2, 0.22, L + t * 1.4), m.x, m.y + h + 0.06, m.z, yaw), SOLID); continue; }
    kit.add(mat, put(new THREE.BoxGeometry(t * 1.3, t * 0.75, L + t), m.x, m.y + h - t * 0.37, m.z, yaw), SOLID);
    kit.add(mat, put(new THREE.BoxGeometry(t * 0.6, t * 0.4, L), m.x, m.y + h * 0.32, m.z, yaw), SOLID);
    const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); kit.add(mat, put(new THREE.BoxGeometry(t * 0.75, h - t * 0.5, t * 0.75), p.x, p.y + (h - t * 0.5) / 2, p.z, yaw), SOLID); }
  }
}
/** A column of dark teal pipes from y0 up h m at (x, z): n pipes round a core, collars, brackets, a box or two. */
export function pipeStack(kit, M, rng, x, y0, z, h = 12, { n = 4, R = 0.9, solid = true } = {}) {
  const how = solid ? SOLID : NC;
  kit.add(M.rail, new THREE.CylinderGeometry(R, R, h, 10).translate(x, y0 + h / 2, z), how);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng() * 0.4, r = 0.18 + rng() * 0.2, px = x + Math.cos(a) * (R + r + 0.05), pz = z + Math.sin(a) * (R + r + 0.05);
    kit.add(M.rail, new THREE.CylinderGeometry(r, r, h, 6).translate(px, y0 + h / 2, pz), how);
  }
  for (let yy = y0 + 1.5 + rng() * 2; yy < y0 + h; yy += 2.5 + rng() * 3) kit.add(M.iron, new THREE.CylinderGeometry(R * 1.5, R * 1.5, 0.35, 10).translate(x, yy, z), how);
  if (rng() < 0.8) kit.add(M.iron, put(new THREE.BoxGeometry(R * 2.4, R * 2, R * 1.6), x + R * 0.6, y0 + h * (0.3 + rng() * 0.4), z, rng()), how);
}

/**
 * The traveller from behind at (x, y, z) facing yaw (0: toward -z, away from the camera): a long dark hooded cloak,
 * the pack on his back and the bottle strapped to it glowing (bottle: its colour, a material of the kit's).
 */
export function spaceTraveller(kit, M, x, y, z, yaw = 0, { bottle = M.bottle, s = 1 } = {}) {
  const g = new THREE.Group();
  const cloak = new THREE.LatheGeometry([[0.02, 0.02], [0.32, 0.04], [0.3, 0.4], [0.23, 1.05], [0.22, 1.32], [0.13, 1.46], [0.02, 1.5]].map(([r, h]) => new THREE.Vector2(r, h)), 16);
  g.add(new THREE.Mesh(cloak, M.traveller));
  // the hood: round, a little peaked, hung forward
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 9).scale(1, 1.18, 1.12).translate(0, 1.6, -0.02), M.traveller));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 9).rotateX(0.6).translate(0, 1.79, 0.05), M.traveller));
  // the pack (toward +z: the camera) and its straps; the bottle strapped on it, glowing
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2).translate(0, 1.08, 0.25), M.pack));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.24).translate(e * 0.17, 1.08, 0.26), M.packRim));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 14).translate(0.06, 1.0, 0.43), bottle));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 6, 0, TAU, 0, Math.PI / 2).translate(0.06, 1.21, 0.43), bottle));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.1, 8).translate(0.06, 1.33, 0.43), M.packRim));
  for (const yy of [0.86, 1.14]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.035, 14).translate(0.06, yy, 0.43), M.packRim));
  g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s);
  g.traverse((q) => { q.userData.noCollide = true; });
  kit.group.add(g);
  kit.light(x + Math.sin(yaw) * 0.6, y + 1.05, z + Math.cos(yaw) * 0.6, 3.5);
  return g;
}

/** Walkers on a bridge or a deck: n residents along A → B ([x, y, z]), yAt(x, z) the deck's height. */
export function walkers(kit, M, rng, A, B, n, yAt) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.2 + rng() * 0.6) / n, x = A[0] + (B[0] - A[0]) * t + (rng() - 0.5) * 1.2, z = A[2] + (B[2] - A[2]) * t + (rng() - 0.5) * 1.2;
    resident(kit, M, rng, x, yAt ? yAt(x, z) : A[1] + (B[1] - A[1]) * t, z, { yaw: Math.atan2(B[0] - A[0], B[2] - A[2]) + (rng() < 0.5 ? 0 : Math.PI) });
  }
}
export { lantern, resident, house, awning, laundry, poleCloth, antennaPole };

/** A seeded rng (for a builder that wants its own numbers). */
export const rngOf = (seed) => mulberry32(Math.floor(seed * 7919) + 11);
