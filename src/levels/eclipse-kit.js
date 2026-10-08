import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { put } from './lab-kit.js';
import { leafCrown } from './garden-kit.js';
import { limb } from './mangrove-kit.js';
import { cloth, curtain, stick } from './salt-harbour-kit.js';
import { greebles } from './greeble-kit.js';

// ---------------------------------------------------------------------------
// The City During the Eclipse: its shapes and its look, shared by the world (eclipse.js) and its
// reference views (reference-eclipse.js), after the pictures (references/The City During the
// Eclipse/reference-1 … 4): a city of limewashed houses, domes and round towers on terraces
// climbing round great stairs, at midday under a total eclipse. The moon's black disc and its
// corona hang over the roofs, the sky is a deep blue with a band of rose light all round the
// horizon, and the city has lit its lamps: lanterns on the tables where people eat outside, lit
// doors and windows, warm pools on the walls against the cold violet light. Pale figures lean out
// from the walls and hang over the parapets; washing and awnings on poles, boxes of violet flowers.
//
//   eclipseMats(kit)  the city's materials (one per option set, the kit shares them)
//   house             a limewashed house: a block with rounded corners, a drum, a tall tower;
//                     flat-roofed with a lip, or under a dome; arched doors (dark, wooden, lit)
//                     small windows some lit, flower boxes, antennas
//   terrace           a terrace of big masonry blocks: its paving on top, a parapet along its front
//   stairFlight       a broad stone stair, its low cheek walls each side
//   table             a table outside, its cloth, stools, a lantern on it, people eating round it
//   lantern           a lamp: a glowing globe on a table, on a post, or hung from a bracket
//   awning            a cloth sloped out from a wall on two poles
//   poleCloth         the rooftops' crossed poles with a sheet sagging between them
//   flowerBox         a box of violet flowers (on a ledge, a parapet, a roof)
//   paleFigure        the city's pale figures: leaning out from a wall, hung over a parapet, standing
//   laundry           a line of washing between two points
//   farQuarter        a field of small houses and domes far off (drawn only, few faces)
//   resident, diner   the city's people: standing in their cloaks, sat at the tables
//   traveller         the traveller seen from behind, the lantern pack glowing on his back
// Builders add to the kit (RoomKit) with the city's materials (M); `detail` (1 the views, under 1 the
// world) thins the segments. Solid as drawn: walls, terraces, stairs, tables; what is small or soft
// (openings, lamps, flowers, cloth, figures) is drawn only.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;
// The stain once laid round every door drew five of the town's numbers; it is gone (v0.89), but its draws are
// still made so that every house, table and lantern after it stays where it was.
export const STAIN_DRAWS = 5;
export const skip = (rng, n) => { for (let i = 0; i < n; i++) rng(); };
const SOLID = { solid: true, shadow: true }, NC = { solid: false, shadow: false }, SH = { solid: false, shadow: true };

// ------------------------------------------------------------------ the look
/** The lamps' light on the walls: a warm amber against the eclipse's violet (makeMaterial lampTint). */
export const LAMP_TINT = ['#ffa25a', 0.85];
/** The surfaces' tones: limewash white (the light makes it violet), the lamps amber, the cloths and cloaks muted. */
export const ECL_TONES = {
  lime: ['#f4f0f6', '#ece6f2', '#f2ecec', '#e6e4f4'], stone: '#d8d4ea', paving: '#cccce2', masonry: '#d4cee6',
  dark: '#181630', door: '#6e4a36', doorLit: '#ffb25c', lit: '#ffc26e', lamp: '#ffdc96', iron: '#2c2840', wood: '#5a4038',
  cloth: ['#e4def0', '#cfc6e4', '#a8acd8', '#8a92c8'], table: ['#8890c8', '#7a7cb4', '#a09ad0'],
  flower: ['#9a7ad8', '#c48ad6', '#7a6ac8'], leaf: '#3e4878', pot: '#8a6a6e', pale: '#f6f4fc',
  cloak: ['#5e5482', '#7a5248', '#464868', '#946e66', '#56688a', '#6e4458', '#3a3a58'], skin: '#d6a68e',
  traveller: '#2e3456', pack: '#ffb058', packRim: '#2a2238',
};
/**
 * The eclipse's light (sky top, horizon, shadow tint, light tint, sun): a deep blue sky, the limewash lit a cold
 * lavender, its shade a deep violet (read off the pictures: lit walls #9589e6 … #5c4e99, shade #3c3a68 … #312b52).
 */
// (v0.94: the light a step darker and bluer, the shade a deeper indigo: put next to the pictures, the city read a pale
//  violet-pink where the pictures' walls are a blue lavender and their shade near the night's own blue)
export const ECLIPSE_TOTAL = ['#24386c', '#5a78ba', '#2e3064', '#8486d0', '#fff2e0'];
/** The eclipse in the sky: the corona and the rose band round the horizon (src/eclipse.js cfg). */
export const ECLIPSE_SKY = { mid: 12, total: 0.75, partial: 2, el: 15, az: 180, size: 4.4, reach: 0.7, style: 0.45, corona: '#ffe2c8', glow: '#d89ad0', glowH: 0.05, stars: 0.35, lift: 0.6, night: 0.5 };
/** Its uniforms for a view held in totality (post.js uEclipse, uCorona, uEclipseGlow): a disc of `size` deg, its corona `style`. */
export function eclipseUniforms({ size = ECLIPSE_SKY.size, reach = ECLIPSE_SKY.reach, style = ECLIPSE_SKY.style, corona = ECLIPSE_SKY.corona, glow = ECLIPSE_SKY.glow, glowH = ECLIPSE_SKY.glowH, stars = ECLIPSE_SKY.stars, dir = null } = {}) {
  const c = new THREE.Color(corona), g = new THREE.Color(glow);
  return { uEclipse: [1, (size * Math.PI) / 180, reach, style], uCorona: [c.r, c.g, c.b, stars], uEclipseGlow: [g.r, g.g, g.b, glowH], uEclipseDir: dir ?? [0, 0, 0] };
}
/** The city's haze: stepped bands of a rose lavender down the long views, a little deeper low in the streets. */
export const ECLIPSE_HAZE = { uHazeLayers: [70, 1.7, 0.2, 4], uHazeTone: [0.6, 0.56, 0.8, 0.8], uHaze: [0.66, 0.6, 0.84, 0.65] };
/**
 * The city's touches on the print preset: no clouds, a flat sky, the shade printed flat in one violet (the pictures'
 * every shadow the same deep tone), little hatching, few spot blacks (the pictures' night is soft), cast shadows
 * lifted on open ground (the eclipse's light comes from the whole sky), the lamps' halos.
 */
export const ECLIPSE_LOOK = {
  uClouds: 0, uCumulus: 0, uSkyDots: 0.25, uSkyFlat: 0.55, uSkyBands: 0.6, uShadowFlat: 0.85, uShadeKeep: 0.1, uHalftone: 0.2, uBounce: 0.15,
  uHatch: 0.32, uFogDensity: 0.0011, uSpot: [0.9, 3, 0.3, 0.3], uSpotTone: [0.08, 0.08, 0.18, 0.3], uCast: [0.35, 0.15], ...ECLIPSE_HAZE,
};

/** The city's materials, made by the kit (shared per option set). */
export function eclipseMats(kit) {
  const T = ECL_TONES, DS = THREE.DoubleSide, LT = { lampTint: LAMP_TINT };
  return {
    lime: T.lime.map((c) => kit.mat({ color: c, flat: true, patches: 0.5, ...LT })),
    stone: kit.mat({ color: T.stone, flat: true, weathered: 0.3, ...LT }),
    masonry: kit.mat({ color: T.masonry, flat: true, grid: 1.7, ...LT }),
    tower: kit.mat({ color: T.lime[0], flat: true, grid: 2.2, patches: 0.4, ...LT }),
    paving: kit.mat({ color: T.paving, flat: true, grid: 2.6, ...LT }),
    step: kit.mat({ color: T.stone, flat: true, hatch: 0.4, ...LT }),
    dark: kit.mat({ color: T.dark, flat: true }),
    door: kit.mat({ color: T.door, flat: true, ...LT }),
    doorLit: kit.mat({ color: T.doorLit, glow: 0.85, flat: true, spot: 0 }),
    lit: kit.mat({ color: T.lit, glow: 0.9, flat: true, spot: 0 }),
    lamp: kit.mat({ color: T.lamp, glow: 1, flat: true, spot: 0, line: 0.5, lineTint: 0.6 }),
    iron: kit.mat({ color: T.iron, flat: true }),
    wood: kit.mat({ color: T.wood, flat: true, ...LT }),
    cloth: T.cloth.map((c) => kit.mat({ color: c, side: DS, shade: 0.3, hatch: 0.2, line: 0.7, lineTint: 0.6, ...LT })),
    table: T.table.map((c) => kit.mat({ color: c, flat: true, side: DS, ...LT })),
    flower: T.flower.map((c) => kit.mat({ color: c, pattern: 'leaves', hatch: 0.5, shade: 0.4, line: 0.6, lineTint: 0.7 })),
    leaf: kit.mat({ color: T.leaf, flat: true, line: 0.6, lineTint: 0.6 }),
    pot: kit.mat({ color: T.pot, flat: true, ...LT }),
    // the pale figures: whiter than the walls, a little of their own light, a soft line
    pale: kit.mat({ color: T.pale, glow: 0.22, flat: true, side: DS, line: 0.6, lineTint: 0.5 }),
    cloaks: T.cloak.map((c) => kit.mat({ color: c, flat: true, figure: true, ...LT })),
    skin: kit.mat({ color: T.skin, flat: true, figure: true, ...LT }),
    traveller: kit.mat({ color: T.traveller, flat: true, figure: true }),
    pack: kit.mat({ color: T.pack, glow: 0.95, flat: true, spot: 0 }),
    packRim: kit.mat({ color: T.packRim, flat: true, figure: true }),
  };
}

// ------------------------------------------------------------------ houses
/** A rounded rectangle w × d (corner radius cr) extruded h high, standing on y = 0 (position and normal only). */
function roundedBlock(w, d, h, cr, seg = 4) {
  cr = Math.min(cr, w / 2 - 0.01, d / 2 - 0.01);
  const sh = new THREE.Shape(), hw = w / 2 - cr, hd = d / 2 - cr;
  sh.moveTo(-hw, -d / 2); sh.lineTo(hw, -d / 2); sh.absarc(hw, -hd, cr, -Math.PI / 2, 0, false); sh.lineTo(w / 2, hd); sh.absarc(hw, hd, cr, 0, Math.PI / 2, false);
  sh.lineTo(-hw, d / 2); sh.absarc(-hw, hd, cr, Math.PI / 2, Math.PI, false); sh.lineTo(-w / 2, -hd); sh.absarc(-hw, -hd, cr, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: seg }).rotateX(-Math.PI / 2);
  for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
  return g;
}
/** A doorway's outline: straight sides, a round head (w wide, h high), on z = 0. */
function archShape(w, h, seg = 6) {
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return new THREE.ShapeGeometry(s, seg);
}

/**
 * A limewashed house at (x, y, z), its front toward yaw (0: +z). kind: 'block' (rounded corners), 'drum' (round, w its
 * diameter), 'tower' (a tall drum). roof: 'flat' (a lip round it), 'dome' (a dome on a short drum, k its rise), 'none'.
 * doors: how many on the front (lit: the share lit from inside, wood: the share closed in wood), windows: how many
 * small windows on the front (lit share `lit`), sides: windows on the sides too. Returns { top, front } (the roof's
 * height, the front's distance from the centre) and adds the lights of its lit doors (kit.light).
 */
export function house(kit, M, rng, { x, y = 0, z, w = 7, d = w, h = 6, yaw = 0, kind = 'block', roof = 'flat', k = 0.75, doors = 1, windows = 3, lit = 0.4, wood = 0.3, sides = 1, flowers = 0.3, antenna = 0.2, mat = null, cr = 0.9, detail = 1, solid = true, light = true }) {
  const wall = typeof mat === 'string' ? M[mat] : mat ?? kit.pick(M.lime);
  const how = solid ? SOLID : SH, seg = Math.max(10, Math.round(22 * detail));
  const round = kind !== 'block', R = w / 2;
  if (round) kit.add(wall, put(new THREE.CylinderGeometry(R, R * 1.02, h, seg, 1, true), x, y + h / 2, z, yaw), how);
  else kit.add(wall, put(roundedBlock(w, d, h, cr, Math.max(2, Math.round(4 * detail))), x, y, z, yaw), how);
  let top = y + h;
  // the roof: a flat top with a lip round it, or a dome on a short drum
  if (roof === 'dome') {
    const dr = round ? R * 0.98 : Math.min(w, d) * 0.46, dk = dr * k;
    if (!round) kit.add(wall, put(new THREE.BoxGeometry(w - 0.1, 0.3, d - 0.1), x, y + h + 0.15, z, yaw), how);
    if (!round) kit.add(wall, put(new THREE.CylinderGeometry(dr, dr, 0.8, seg, 1, false), x, y + h + 0.7, z, yaw), how);
    kit.add(wall === M.tower ? M.lime[0] : wall, put(new THREE.SphereGeometry(dr, seg, Math.max(5, Math.round(9 * detail)), 0, TAU, 0, Math.PI / 2).scale(1, k, 1), x, y + h + (round ? 0 : 1.1), z, yaw), how);
    top = y + h + (round ? 0 : 1.1) + dk;
  } else if (roof === 'flat') {
    if (round) {
      kit.add(wall, put(new THREE.CylinderGeometry(R * 0.99, R * 0.99, 0.2, seg), x, y + h - 0.1, z, yaw), how);
      kit.add(wall, put(new THREE.TorusGeometry(R * 0.97, 0.22, 4, seg).rotateX(Math.PI / 2).scale(1, 2.2, 1), x, y + h + 0.3, z, yaw), how);
    } else {
      kit.add(wall, put(new THREE.BoxGeometry(w - 0.2, 0.2, d - 0.2), x, y + h - 0.1, z, yaw), how);
      for (const [lw, ld, lx, lz] of [[w, 0.35, 0, d / 2 - 0.17], [w, 0.35, 0, -d / 2 + 0.17], [0.35, d, w / 2 - 0.17, 0], [0.35, d, -w / 2 + 0.17, 0]]) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        kit.add(wall, put(new THREE.BoxGeometry(lw - (lw > 1 ? cr * 1.4 : 0), 0.7, ld - (ld > 1 ? cr * 1.4 : 0)), x + c * lx + s * lz, y + h + 0.35, z - s * lx + c * lz, yaw), how);
      }
    }
  }
  // what is on the front (local +z) and the sides: doors and windows a hair proud of the wall
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const onFace = (g, u, v, face = 0) => {
    // face: 0 the front, 1 the right side, -1 the left side; u across it, v up from the foot
    if (round) {
      const a = (face * Math.PI) / 2 + u / R, px = Math.sin(a) * (R + 0.04), pz = Math.cos(a) * (R + 0.04);
      return put(g, x + c * px + s * pz, y + v, z - s * px + c * pz, yaw + a);
    }
    const fz = face === 0 ? d / 2 + 0.04 : w / 2 + 0.04, ry = yaw + (face * Math.PI) / 2, cc = Math.cos(ry), ss = Math.sin(ry);
    return put(g, x + cc * u + ss * fz, y + v, z - ss * u + cc * fz, ry);
  };
  const span = round ? R * 1.1 : w - 2 * cr - 0.4;
  const dw = Math.min(1.7, Math.max(1.1, w * 0.2)), dh = Math.min(2.8, h * 0.7);
  for (let i = 0; i < doors; i++) {
    const u = doors === 1 ? (rng() - 0.5) * Math.max(0, span - dw - 1) * 0.5 : (-span / 2 + dw) + (i * (span - 2 * dw)) / Math.max(1, doors - 1);
    const r = rng(), m = r < lit ? M.doorLit : r < lit + wood ? M.door : M.dark;
    skip(rng, STAIN_DRAWS);   // (where the stain round the door drew its numbers: the town keeps its layout)
    kit.add(m, onFace(archShape(dw, dh).translate(0, 0, 0.02), u, 0, 0), NC);
    if (m === M.doorLit && light) {
      // (its pool on the ground and the wall round it: a little out from the door)
      const a = round ? u / R : 0, px = round ? Math.sin(a) * (R + 1.2) : u, pz = round ? Math.cos(a) * (R + 1.2) : d / 2 + 1.2;
      kit.light(x + c * px + s * pz, y + 1.4, z - s * px + c * pz, 6.5);
    }
  }
  const win = (face, n) => {
    for (let i = 0; i < n; i++) {
      const u = (rng() - 0.5) * (face === 0 ? span : (round ? R : d - 2 * cr - 0.4)) * 0.8, v = Math.min(h - 1, 2.8 + rng() * Math.max(0.1, h - 3.6));
      if (face === 0 && v < dh + 0.4 && doors > 0) continue;
      const m = rng() < lit ? M.lit : M.dark, round2 = rng() < 0.4;
      const g = round2 ? new THREE.CircleGeometry(0.26 + rng() * 0.12, 10) : new THREE.PlaneGeometry(0.5 + rng() * 0.25, 0.75 + rng() * 0.4);
      kit.add(m, onFace(g, u, v, face), NC);
    }
  };
  win(0, windows);
  if (sides) { win(1, Math.round(windows * 0.6 * sides)); win(-1, Math.round(windows * 0.6 * sides)); }
  // a box of flowers on the roof's edge, now and then; an antenna
  if (roof === 'flat' && rng() < flowers) flowerBox(kit, M, rng, round ? x + s * R * 0.5 : x + s * (d / 2 - 0.6), top + 0.65, round ? z + c * R * 0.5 : z + c * (d / 2 - 0.6), { w: Math.min(w * 0.6, 4), yaw, detail });
  if (rng() < antenna) { const ax = x + (rng() - 0.5) * w * 0.5, az = z + (rng() - 0.5) * d * 0.5; antennaPole(kit, M, rng, ax, top, az, 2.5 + rng() * 4); }
  return { top, front: round ? R : d / 2 };
}

/** A doorway in a flat wall at (x, y, z) (its foot), the wall facing yaw: the door (lit, wooden or dark); a lit one lights the ground before it. */
export function doorway(kit, M, rng, x, y, z, { yaw = 0, w = 1.6, h = 2.6, lit = 0.5, wood = 0.3 } = {}) {
  const r = rng(), m = r < lit ? M.doorLit : r < lit + wood ? M.door : M.dark, c = Math.cos(yaw), s = Math.sin(yaw);
  skip(rng, STAIN_DRAWS);   // (the stain's numbers, as in house)
  kit.add(m, put(archShape(w, h), x + s * 0.05, y, z + c * 0.05, yaw), NC);
  if (m === M.doorLit) kit.light(x + s * 1.2, y + 1.4, z + c * 1.2, 6.5);
}

/** A thin pole on a roof, a crossbar or two, a wire off it (the pictures' rooftop antennas). */
export function antennaPole(kit, M, rng, x, y, z, h = 4) {
  kit.add(M.iron, stick(V(x, y, z), V(x, y + h, z), 0.04), NC);
  for (let i = 0, n = 1 + Math.floor(rng() * 2); i < n; i++) { const yy = y + h * (0.55 + i * 0.3), a = rng() * Math.PI; kit.add(M.iron, stick(V(x - Math.cos(a) * 0.5, yy, z - Math.sin(a) * 0.5), V(x + Math.cos(a) * 0.5, yy, z + Math.sin(a) * 0.5), 0.025), NC); }
}

/** Rooftop clutter on a flat roof (the greeble kit's boxes and pipes, sparse and large): x0..x1 × z0..z1 at height y. */
export function roofClutter(kit, M, seed, x0, x1, z0, z1, y) {
  const g = greebles(seed);
  g.patch(V(x0, y, z1), V(1, 0, 0), V(0, 0, -1), V(0, 1, 0), x1 - x0, z1 - z0, { density: 0.25, scale: 1.6, depth: 0.6 });
  const m = g.merged();
  for (const [k, mat] of [['metal', M.iron], ['dark', M.dark], ['pale', M.lime[1]]]) if (m[k]) kit.add(mat, m[k], NC);
}

// ------------------------------------------------------------------ terraces and stairs
/**
 * A terrace of big masonry blocks: its paving x0..x1 × z0..z1 at height y (z1 its front), its block down to `below`,
 * a parapet along the front (gaps: [[x0, x1]…] open for stairs), along the sides too (sides: true). Solid as drawn.
 */
export function terrace(kit, M, { x0, x1, z0, z1, y, below = 0, parapet = 0.9, gaps = [], sides = false, front = true }) {
  const w = x1 - x0, cx = (x0 + x1) / 2, dz = z1 - z0, cz = (z0 + z1) / 2;
  kit.add(M.paving, new THREE.BoxGeometry(w, 0.4, dz).translate(cx, y - 0.2, cz), SOLID);
  if (y - 0.4 > below) kit.add(M.masonry, new THREE.BoxGeometry(w, y - 0.4 - below, dz).translate(cx, (y - 0.4 + below) / 2, cz), SOLID);
  if (parapet > 0 && front) {
    const cuts = [[x0, x0], ...gaps.slice().sort((a, b) => a[0] - b[0]), [x1, x1]];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i][1], b = cuts[i + 1][0];
      if (b - a > 0.5) kit.add(M.stone, new THREE.BoxGeometry(b - a, parapet, 0.5).translate((a + b) / 2, y + parapet / 2, z1 - 0.25), SOLID);
    }
  }
  if (parapet > 0 && sides) for (const xe of [x0 + 0.25, x1 - 0.25]) kit.add(M.stone, new THREE.BoxGeometry(0.5, parapet, dz).translate(xe, y + parapet / 2, cz), SOLID);
}

/**
 * A broad stone stair from its foot at (x, y0, z) climbing to y1 toward yaw's -z (yaw 0: up toward -z), w wide: steps of
 * about `rise`, `run` deep, its cheek walls each side (cheek: their height over the steps). Solid as drawn.
 * Returns { top: [x, y1, z] at its head, len: its run }.
 */
export function stairFlight(kit, M, { x, z, y0, y1, w = 6, yaw = 0, rise = 0.24, run = 0.42, cheek = 0.8, cheeks = [true, true], base = y0 }) {
  const n = Math.max(1, Math.round((y1 - y0) / rise)), dr = (y1 - y0) / n, c = Math.cos(yaw), s = Math.sin(yaw), L = n * run;
  for (let i = 0; i < n; i++) {
    const f = -(i + 0.5) * run, tp = y0 + (i + 1) * dr;
    kit.add(M.step, put(new THREE.BoxGeometry(w, tp - base + 0.02, run + 0.02).translate(0, (tp - base) / 2, 0), x + s * f, base, z + c * f, yaw), SOLID);
  }
  for (const [k, e] of [[0, -1], [1, 1]]) if (cheeks[k]) {
    // a low wall along each side, its top following the steps `cheek` over them, down to the stair's base
    const H = y1 - y0, sh = new THREE.Shape(), drop = y0 - base;
    sh.moveTo(0, -drop); sh.lineTo(L, -drop); sh.lineTo(L, H + cheek); sh.lineTo(0, cheek); sh.lineTo(0, -drop);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }).translate(0, 0, -0.3).rotateY(Math.PI / 2).translate(e * (w / 2 + 0.3), 0, 0);
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    kit.add(M.stone, put(g, x, y0, z, yaw), SOLID);
  }
  return { top: [x - s * L, y1, z - c * L], len: L };
}

// ------------------------------------------------------------------ lamps, tables, people
/**
 * A lamp at (x, y, z): 'globe' (a round glowing lantern on a short stand: on a table, a step), 'post' (a lantern on a
 * pole, h high), 'hang' (hung from a bracket out of a wall facing yaw), 'big' (a tall oval lantern stood on the
 * ground, the pictures' great paper lamps). Adds its light pool (r m).
 */
export function lantern(kit, M, x, y, z, { kind = 'globe', h = 2.6, yaw = 0, r = 7, s = 1, light = true } = {}) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  let ly = y;
  if (kind === 'globe') {
    kit.add(M.lamp, new THREE.SphereGeometry(0.2 * s, 10, 7).scale(1, 1.15, 1).translate(x, y + 0.26 * s, z), NC);
    kit.add(M.iron, new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.06 * s, 6).translate(x, y + 0.03 * s, z), NC);
    ly = y + 0.3 * s;
  } else if (kind === 'big') {
    kit.add(M.lamp, new THREE.SphereGeometry(0.42 * s, 12, 8).scale(1, 1.45, 1).translate(x, y + 0.7 * s, z), NC);
    kit.add(M.iron, new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 0.1 * s, 8).translate(x, y + 0.05 * s, z), NC);
    kit.add(M.iron, new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.08 * s, 8).translate(x, y + 1.33 * s, z), NC);
    ly = y + 0.8 * s;
  } else if (kind === 'post') {
    kit.add(M.iron, new THREE.CylinderGeometry(0.05, 0.07, h, 5).translate(x, y + h / 2, z), NC);
    kit.add(M.lamp, new THREE.SphereGeometry(0.22, 10, 7).scale(1, 1.2, 1).translate(x, y + h + 0.22, z), NC);
    kit.add(M.iron, new THREE.ConeGeometry(0.2, 0.16, 6).translate(x, y + h + 0.52, z), NC);
    ly = y + h + 0.2;
  } else {
    kit.add(M.iron, put(new THREE.BoxGeometry(0.05, 0.05, 0.7), x - sn * 0.35, y + 0.45, z - c * 0.35, yaw), NC);
    kit.add(M.iron, new THREE.CylinderGeometry(0.012, 0.012, 0.25, 3).translate(x, y + 0.32, z), NC);
    kit.add(M.lamp, new THREE.SphereGeometry(0.2, 10, 7).scale(1, 1.2, 1).translate(x, y, z), NC);
  }
  if (light) kit.light(x, ly, z, r);
}

/** A resident standing at (x, y, z) facing yaw: a cloak to the ground, a hood or a bare head, now and then a staff. */
export function resident(kit, M, rng, x, y, z, { yaw = rng() * TAU, s = 0.95 + rng() * 0.12, hood = rng() < 0.6 } = {}) {
  const m = kit.pick(M.cloaks), cc = Math.cos(yaw), sn = Math.sin(yaw);
  kit.add(m, new THREE.CylinderGeometry(0.16 * s, 0.34 * s, 1.36 * s, 8).translate(x, y + 0.68 * s, z), NC);
  kit.add(m, new THREE.SphereGeometry(0.2 * s, 8, 5).scale(1.15, 0.7, 0.9).translate(x, y + 1.37 * s, z), NC);
  kit.add(hood ? m : M.skin, new THREE.SphereGeometry(0.14 * s, 8, 6).translate(x, y + 1.57 * s, z), NC);
  if (hood) kit.add(m, new THREE.ConeGeometry(0.15 * s, 0.25 * s, 7).translate(x - sn * 0.05, y + 1.72 * s, z - cc * 0.05), NC);
  else kit.add(M.skin, new THREE.SphereGeometry(0.09 * s, 6, 4).translate(x + sn * 0.08 * s, y + 1.56 * s, z + cc * 0.08 * s), NC);
}
/** Someone sat at a table at (x, y, z) facing yaw (toward the table): a stool, the body leaning in, the head, an arm on the table. */
export function diner(kit, M, rng, x, y, z, yaw, { s = 0.92 + rng() * 0.1 } = {}) {
  const m = kit.pick(M.cloaks), cc = Math.cos(yaw), sn = Math.sin(yaw), f = (d) => [x + sn * d, z + cc * d];
  kit.add(M.wood, new THREE.CylinderGeometry(0.18, 0.16, 0.45, 6).translate(x, y + 0.22, z), NC);
  // the body: a cloak hunched toward the table, the shoulders, a hood or a bare head; the knees under the table
  const body = new THREE.LatheGeometry([[0.02, 0], [0.3, 0.02], [0.28, 0.25], [0.21, 0.55], [0.17, 0.68], [0.06, 0.74], [0.02, 0.75]].map(([r, h]) => new THREE.Vector2(r * s, h * s)), 9);
  const [bx, bz] = f(0.02);
  kit.add(m, put(body, bx, y + 0.42, bz, yaw, 1, 0.22), NC);
  const [kx, kz] = f(0.3);
  kit.add(m, put(new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.42 * s, 6).rotateX(Math.PI / 2), kx, y + 0.5, kz, yaw), NC);
  const [hx, hz] = f(0.2), hood = rng() < 0.55;
  kit.add(hood ? m : M.skin, new THREE.SphereGeometry(0.13 * s, 8, 6).scale(1, 1.1, 1).translate(hx, y + 1.3 * s, hz), NC);
  if (hood) kit.add(m, put(new THREE.ConeGeometry(0.14 * s, 0.2 * s, 7), hx - sn * 0.05, y + 1.44 * s, hz - cc * 0.05, yaw, 1, -0.4), NC);
}
/**
 * A table outside at (x, y, z), its long side across yaw: a cloth over it to near the ground, stools, people sat at it
 * (seats: how many of its places are taken), a globe lantern on it (lamp), a cup or two. Solid as drawn (the table).
 */
export function table(kit, M, rng, x, y, z, { yaw = 0, w = 2.2, d = 1.1, seats = 4, lamp = true, r = 6.5, light = true } = {}) {
  const tm = kit.pick(M.table), c = Math.cos(yaw), s = Math.sin(yaw), h = 0.78;
  kit.add(tm, put(new THREE.BoxGeometry(w, 0.06, d), x, y + h, z, yaw), SOLID);
  // the cloth's skirt, a little flared
  kit.add(tm, put(new THREE.CylinderGeometry(1, 1.08, h - 0.12, 4, 1, true).rotateY(Math.PI / 4).scale(w / Math.SQRT2, 1, d / Math.SQRT2), x, y + (h - 0.12) / 2 + 0.1, z, yaw), SOLID);
  if (lamp) lantern(kit, M, x + c * (rng() - 0.5) * w * 0.4, y + h + 0.03, z - s * (rng() - 0.5) * w * 0.4, { kind: 'globe', r, light });
  for (let i = 0, n = 1 + Math.floor(rng() * 3); i < n; i++) {
    const u = (rng() - 0.5) * w * 0.8, v = (rng() - 0.5) * d * 0.6;
    kit.add(M.pot, new THREE.CylinderGeometry(0.05, 0.04, 0.1, 6).translate(x + c * u + s * v, y + h + 0.08, z - s * u + c * v), NC);
  }
  // the places: along both long sides, one at each end
  const places = [];
  for (const e of [-1, 1]) for (const u of w > 1.8 ? [-w * 0.27, w * 0.27] : [0]) places.push([u, e * (d / 2 + 0.42), e > 0 ? Math.PI : 0]);
  places.push([-(w / 2 + 0.42), 0, Math.PI / 2], [w / 2 + 0.42, 0, -Math.PI / 2]);
  for (let i = places.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [places[i], places[j]] = [places[j], places[i]]; }
  for (const [u, v, a] of places.slice(0, seats)) diner(kit, M, rng, x + c * u + s * v, y, z - s * u + c * v, yaw + a);
}

// ------------------------------------------------------------------ cloth, flowers, pale figures
/** A cloth sloped out from a wall: its top edge A→B (on the wall), out `out` m toward n̂ (the wall's outward [x, z]) and `drop` m down, on two poles. */
export function awning(kit, M, rng, A, B, { out = 2.6, drop = 0.9, n = [0, 1], sag = 0.3, poles = true, mat = null, seed = rng() * 99 } = {}) {
  const m = mat ?? kit.pick(M.cloth), C = [B[0] + n[0] * out, B[1] - drop, B[2] + n[1] * out], D = [A[0] + n[0] * out, A[1] - drop, A[2] + n[1] * out];
  kit.add(m, cloth(A, B, C, D, { sag, folds: 2, fold: 0.12, nu: 10, nv: 5, droop: 0.35, seed }), SH);
  if (poles) for (const P of [C, D]) kit.add(M.wood, stick(V(P[0], P[1] + 0.2, P[2]), V(P[0], P[1] - 3.2, P[2]), 0.05), NC);
}
/** Two crossed poles at P and Q (their feet), h high, a sheet sagging between their tops (the pictures' rooftop frames). */
export function poleCloth(kit, M, rng, P, Q, { h = 4, sag = 1.4, spread = 1.4, mat = null } = {}) {
  const tops = [];
  for (const F of [P, Q]) {
    const f = V(...F), t = f.clone().add(V(0, h, 0));
    kit.add(M.wood, stick(f, t.clone().add(V(0, 0.6, 0)), 0.07), NC);
    kit.add(M.wood, stick(t.clone().add(V(-spread * 0.6, 0, 0)), t.clone().add(V(spread * 0.6, 0, 0)), 0.05), NC);
    tops.push(t);
  }
  const [a, b] = tops, dir = b.clone().sub(a).normalize(), side = V(-dir.z, 0, dir.x).multiplyScalar(spread * 0.55);
  const m = mat ?? kit.pick(M.cloth);
  kit.add(m, cloth(a.clone().add(side).toArray(), b.clone().add(side).toArray(), b.clone().sub(side).add(V(0, -0.4, 0)).toArray(), a.clone().sub(side).add(V(0, -0.4, 0)).toArray(), { sag, folds: 3, fold: 0.15, nu: 12, nv: 4, droop: 0.5, seed: rng() * 99 }), SH);
}
/** A box of violet flowers at (x, y, z) (its foot), w long across yaw, the blooms heaped over its rim and hanging. */
export function flowerBox(kit, M, rng, x, y, z, { w = 2.4, yaw = 0, detail = 1, box = true } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  if (box) kit.add(M.pot, put(new THREE.BoxGeometry(w, 0.45, 0.6), x, y + 0.22, z, yaw), NC);
  const n = Math.max(2, Math.round(w / 0.7));
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (i + 0.5) * (w / n) + (rng() - 0.5) * 0.2, sc = 0.45 + rng() * 0.3;
    const g = leafCrown(Math.floor(rng() * 1e4), { lobes: 5, detail: detail < 0.8 ? 0 : 1 }).scale(sc, sc * 0.8, sc);
    kit.add(kit.pick(M.flower), g.translate(x + c * u, y + 0.5 + sc * 0.2, z - s * u), NC);
  }
}
/**
 * One of the city's pale figures at (x, y, z), facing yaw: 'lean' (out from a wall at its back, arms reaching down),
 * 'hang' (draped over a parapet's edge: the body hung down its front, the head and arms dangling), 'stand' (a tall
 * figure on the ground, a cloth falling from its shoulders). Long limbs, a small head; drawn only.
 */
export function paleFigure(kit, M, rng, x, y, z, { yaw = 0, s = 1, pose = 'lean', detail = 1 } = {}) {
  const seg = Math.max(7, Math.round(12 * detail)), tub = Math.max(6, Math.round(10 * detail)), rad = Math.max(4, Math.round(6 * detail));
  // in the figure's frame: its foot at the origin, up +y, its face toward +z; then tipped (lean: out from a wall at
  // its back; hang: head down over an edge) and set at (x, y, z) turned by yaw
  const parts = [];
  const robe = new THREE.LatheGeometry([[0.02, 0], [0.34, 0.04], [0.38, 0.5], [0.3, 1.1], [0.24, 1.45], [0.13, 1.62], [0.02, 1.66]].map(([r, h]) => new THREE.Vector2(r * s, h * s)), seg);
  parts.push(robe);
  parts.push(new THREE.SphereGeometry(0.17 * s, 9, 7).scale(0.9, 1.25, 1).translate(0, 1.84 * s, 0.04 * s));
  const reach = pose === 'stand' ? [[0.3, 1.4, 0.15], [0.55, 1.75, 0.3], [0.62, 2.2, 0.25]] : [[0.28, 1.4, 0.15], [0.5, 1.0, 0.45], [0.42, 0.3, 0.7]];
  for (const e of [-1, 1]) {
    const pts = reach.map(([a, b, c], i) => V(e * a * s * (i === 2 ? 0.8 + rng() * 0.4 : 1), b * s * (i === 2 ? 0.85 + rng() * 0.3 : 1), c * s));
    parts.push(limb([V(e * 0.18 * s, 1.45 * s, 0.05 * s), ...pts], 0.06 * s, 0.55, tub, rad));
  }
  // its cloth: a drape from the shoulders down the back, longer than the robe
  parts.push(curtain([-0.32 * s, 1.5 * s, -0.12 * s], [0.32 * s, 1.5 * s, -0.12 * s], 1.9 * s, { sag: 0.04, folds: 3, fold: 0.07 * s, nu: 9, nv: 5, seed: rng() * 99, pull: [0, -0.25 * s] }));
  const m = new THREE.Matrix4(), q = new THREE.Matrix4();
  if (pose === 'lean') q.makeRotationX(0.55 + rng() * 0.35).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0.3 * s));
  else if (pose === 'hang') q.makeRotationX(Math.PI * 0.82).premultiply(new THREE.Matrix4().makeTranslation(0, 0.25 * s, 0.35 * s));
  m.makeRotationY(yaw).setPosition(x, y, z).multiply(q);
  for (const g of parts) kit.add(M.pale, g.applyMatrix4(m), NC);
}
/** A line of washing from A to B ([x, y, z]), sagging, n cloths hung from it. */
export function laundry(kit, M, rng, A, B, { n = 5, drop = [0.7, 1.4], sag = 0.4 } = {}) {
  const a = V(...A), b = V(...B), at = (t) => a.clone().lerp(b, t).add(V(0, -sag * Math.sin(Math.PI * t), 0));
  const pts = Array.from({ length: 9 }, (_, i) => at(i / 8));
  kit.add(M.iron, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.015, 3, false), NC);
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.15 + rng() * 0.2) / n, t1 = t0 + (0.45 + rng() * 0.3) / n, p = at(t0), q = at(Math.min(0.98, t1));
    kit.add(kit.pick(M.cloth), curtain(p.toArray(), q.toArray(), drop[0] + rng() * (drop[1] - drop[0]), { sag: 0.02, folds: 2, fold: 0.06, nu: 6, nv: 3, seed: rng() * 99 }), NC);
  }
}

// ------------------------------------------------------------------ far off
/**
 * A field of small limewashed houses far off (drawn only, few faces each): n houses over x0..x1 × z0..z1 on the
 * ground H(x, z) (or y), blocks and domes, some windows lit. For the distant city past the parapets (solid: inside the
 * walked city, the roofs behind the streets).
 */
export function farQuarter(kit, M, rng, { x0, x1, z0, z1, n = 60, y = 0, H = null, size = [4, 9], lit = 0.25, domes = 0.3, towers = 0.06, tall = [3, 10], solid = false }) {
  const how = solid ? SOLID : NC;
  const wall = M.lime[1], wall2 = M.lime[3];
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * (x1 - x0), z = z0 + rng() * (z1 - z0), gy = H ? H(x, z) : y, tower = rng() < towers;
    const w = tower ? size[0] * 0.8 : size[0] + rng() * (size[1] - size[0]), d = tower ? w : w * (0.7 + rng() * 0.6), h = tower ? tall[1] * (1.3 + rng() * 0.6) : tall[0] + rng() * (tall[1] - tall[0]);
    const m = rng() < 0.5 ? wall : wall2, a = (rng() - 0.5) * 0.4;
    kit.add(m, put(new THREE.BoxGeometry(w, h, d), x, gy + h / 2 - 0.5, z, a), how);
    if (rng() < domes) kit.add(m, put(new THREE.SphereGeometry(Math.min(w, d) * 0.42, 8, 3, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1), x, gy + h - 0.5, z, a), how);
    if (rng() < lit) kit.add(M.lit, put(new THREE.PlaneGeometry(0.8, 1.1), x + Math.sin(a) * (d / 2 + 0.05), gy + 1.5 + rng() * (h - 2.5), z + Math.cos(a) * (d / 2 + 0.05), a), NC);
  }
}

/** The traveller seen from behind at (x, y, z) facing yaw (away from the camera: 0 toward -z): a long dark cloak, the hood, the glowing lantern pack. */
export function traveller(kit, M, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  // the cloak: wide at the hem, the shoulders, the hood with its point; the pack on his back (toward +z: the camera)
  const cloak = new THREE.LatheGeometry([[0.02, 0.02], [0.34, 0.04], [0.32, 0.35], [0.25, 1.05], [0.23, 1.38], [0.14, 1.52], [0.02, 1.56]].map(([r, h]) => new THREE.Vector2(r, h)), 16);
  g.add(new THREE.Mesh(cloak, M.traveller));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 9).scale(1, 1.15, 1.1).translate(0, 1.68, 0.02), M.traveller));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 9).rotateX(0.5).translate(0, 1.84, 0.08), M.traveller));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 6).translate(e * 0.13, 0.08, -0.04), M.packRim));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.24).translate(0, 1.1, 0.32), M.pack));
  for (const yy of [0.84, 1.36]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.28).translate(0, yy, 0.32), M.packRim));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 0.28).translate(e * 0.2, 1.1, 0.32), M.packRim));
  g.position.set(x, y, z); g.rotation.y = yaw;
  g.traverse((q) => { q.userData.noCollide = true; });
  kit.group.add(g);
  kit.light(x + Math.sin(yaw) * 0.7, y + 1.1, z + Math.cos(yaw) * 0.7, 4.5);
  return g;
}

/** A seeded rng (for a builder that wants its own numbers). */
export const rngOf = (seed) => mulberry32(Math.floor(seed * 7919) + 11);
