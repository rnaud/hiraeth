import * as THREE from 'three';
import { MODE_WATER } from '../materials.js';
import { mulberry32 } from '../noise.js';
import { V, tube, sagPts, put, smoothstep, PERSON, CLEAN_SKY } from './reference-kit.js';

// ---------------------------------------------------------------------------
// The City-Shaft's reference sheets (references/The City-Shaft/IMG_3778 … 3782): a city of
// stacked blocks down the walls of a shaft, pink and cream in the sun, flat blue in shade, bridges
// and cables across, flying cabs, turquoise water far below. One scene builder (shaftScene) does
// them all, from a few walls of houses, free-standing stacks, bridges, cables and cabs; each panel
// is a view (reference-views.js describes the fields) framed on it, many of them steeply up or
// down (camera.pitch, roll).
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `The City-Shaft / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/The City-Shaft/${name}.JPG`, import.meta.url).href });
export const SHAFT_SHEETS = { IMG_3778: sheet('IMG_3778'), IMG_3779: sheet('IMG_3779'), IMG_3780: sheet('IMG_3780'), IMG_3781: sheet('IMG_3781'), IMG_3782: sheet('IMG_3782') };

/**
 * The sheets' ink: shadows printed flat in their own blue (uShadowFlat), barely hatched, no
 * half-tone lifting the overhangs' undersides (they are the deepest blue), a clean sky.
 */
/** Down the shaft the houses fade into a pale blue haze toward the water (post.js 4b: a fog thickening under -40 m). */
export const SHAFT_VIEW_FOG = { uHeightFog: [-40, 60, 0.003, 0.75], uHeightFogTone: [0.74, 0.83, 0.88, 0.9] };
export const SHAFT_LOOK = { ...CLEAN_SKY, uShadowFlat: 0.8, uShadeKeep: 0, uHalftone: 0.1, uBounce: 0, uHatch: 0.1, ...SHAFT_VIEW_FOG };
/** sky top, sky horizon, shadow (the flat blue), light, sun */
const SKY = ['#8fbcd8', '#c6dbe2', '#6d97b8', '#ffffff', '#fff6dc'];
const PAL = {
  pink: ['#ec9a86', '#f1ad98', '#e58872', '#f3b9a4', '#e9a08a'],
  cream: ['#f4e4cc', '#f7eedf', '#efd9bd', '#f2e6d6'],
  awn: ['#c95a45', '#d9775f', '#b84e3e'],
};

function materials(kit, cream) {
  const walls = [];
  // (the sheets' windows are few and small: a share of the façade's cells)
  for (const c of PAL.pink) walls.push(kit.mat({ color: c, flat: true, pattern: 'facade', windows: 0.2 }));
  for (let i = 0; i < Math.round(cream * 6); i++) walls.push(kit.mat({ color: PAL.cream[i % PAL.cream.length], flat: true, pattern: 'facade', windows: 0.16 }));
  return {
    walls,
    back: kit.mat({ color: '#e7a28f', flat: true }),
    slab: kit.mat({ color: '#e9b4a2', flat: true }),
    awn: PAL.awn.map((c) => kit.mat({ color: c, flat: true, side: THREE.DoubleSide, shade: 0.2 })),
    dark: kit.mat({ color: '#5a3c38', flat: true }),
    rail: kit.mat({ color: '#7b5a52', flat: true }),
    cable: kit.mat({ color: '#4a3a3a', flat: true }),
    cab: kit.mat({ color: '#d9874f', metal: 'painted' }),
    glass: kit.mat({ color: '#4f6f86', flat: true }),
    ground: kit.mat({ color: '#e8a693', flat: true, weathered: 0.6 }),
  };
}

/**
 * The blocks themselves cast no shadow (NO_CAST): as on the sheets, a wall in the sun stays in the
 * sun however deep the street, and a stack isn't mottled by its own boxes; their shade is the faces
 * turned from the sun and what the slabs, awnings and walkways throw under them.
 */
const NO_CAST = { shadow: false };

/**
 * A wall of houses along z (from z0 to z1) whose face stands at x, looking toward +side·x: columns of
 * stacked blocks (each jutting out by its own amount), slabs overhanging under some, awnings, little
 * boxes, a backing behind so no sky shows between them.
 */
function houseWall(kit, M, rng, { x, side, z0, z1, y0, y1, depth = 10, jut = 3.5, over = 0.35, awn = 0.2, casts = true }) {
  const C = { solid: true, shadow: casts }, CS = { solid: false, shadow: casts };
  const dz = Math.sign(z1 - z0);
  kit.add(M.back, put(new THREE.BoxGeometry(60, y1 - y0, Math.abs(z1 - z0) + 20), x - side * (depth + 30), (y0 + y1) / 2, (z0 + z1) / 2), NO_CAST);
  for (let z = z0; dz * (z1 - z) > 0;) {
    const cw = 6 + rng() * 9;
    let y = y0 + rng() * 6;
    while (y < y1) {
      const h = 5 + rng() * 9, j = rng() < 0.15 ? jut * (1.4 + rng()) : jut * rng();
      const sx = depth + j, cx = x + side * (j - depth) / 2, zc = z + dz * cw / 2 + (rng() - 0.5) * 1.5, w = cw * (0.82 + rng() * 0.2);
      kit.add(M.walls[Math.floor(rng() * M.walls.length)], put(new THREE.BoxGeometry(sx, h, w), cx, y + h / 2, zc), NO_CAST);
      if (rng() < over) {   // a slab overhanging under the block: its underside the deepest blue
        const o = 1.5 + rng() * 2.5;
        kit.add(M.slab, put(new THREE.BoxGeometry(sx + o, 0.7, w * 1.12), cx + side * o / 2, y + 0.35, zc), C);
        if (rng() < 0.5) kit.add(M.rail, put(new THREE.BoxGeometry(0.12, 1.0, w * 1.1), x + side * (j + o), y + 1.2, zc), CS);
      }
      if (rng() < awn) {    // an awning, slanted out over the street
        const a = M.awn[Math.floor(rng() * M.awn.length)];
        kit.add(a, put(new THREE.BoxGeometry(2.8, 0.08, w * 0.8), x + side * (j + 1.3), y + h * 0.55, zc, 0, 1, 0, side * 0.35), CS);
      }
      if (rng() < 0.3) kit.add(M.dark, put(new THREE.BoxGeometry(0.9, 0.7, 1.1), x + side * (j + 0.4), y + h * (0.2 + 0.6 * rng()), zc + (rng() - 0.5) * w * 0.6), CS);
      y += h;
    }
    z += dz * cw;
  }
}

/** A free-standing stack of blocks round (x, z): a tower of houses, from y0 up to y1. */
function stack(kit, M, rng, { x, z, w, y0, y1, jitter = 0.18, over = 0.22 }) {
  let y = y0;
  const wall = () => M.walls[Math.floor(rng() * M.walls.length)];
  while (y < y1) {
    const h = 4 + rng() * 11, bw = w * (0.6 + rng() * 0.55), bd = w * (0.6 + rng() * 0.55);
    const bx = x + (rng() - 0.5) * w * jitter * 2, bz = z + (rng() - 0.5) * w * jitter * 2, yaw = (rng() - 0.5) * 0.08;
    kit.add(wall(), put(new THREE.BoxGeometry(bw, h, bd), bx, y + h / 2, bz, yaw), NO_CAST);
    if (rng() < over) kit.add(M.slab, put(new THREE.BoxGeometry(bw + 1.5 + rng() * 2, 0.7, bd + 1.5 + rng() * 2), bx, y + 0.35, bz, yaw));
    // houses of their own clinging to the storey: boxes of every size jutting off its faces
    const n = Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const s = w * (0.12 + rng() * 0.3), sh = Math.min(h, s * (0.6 + rng() * 0.8)), face = Math.floor(rng() * 4);
      const fx = face === 0 ? 1 : face === 1 ? -1 : 0, fz = face === 2 ? 1 : face === 3 ? -1 : 0;
      const px = bx + fx * (bw / 2 + s / 2 - 0.6) + (fz ? (rng() - 0.5) * bw * 0.7 : 0), pz = bz + fz * (bd / 2 + s / 2 - 0.6) + (fx ? (rng() - 0.5) * bd * 0.7 : 0);
      kit.add(wall(), put(new THREE.BoxGeometry(s, sh, s), px, y + sh / 2 + rng() * (h - sh), pz, yaw), NO_CAST);
    }
    if (rng() < 0.25) { const a = M.awn[Math.floor(rng() * M.awn.length)]; kit.add(a, put(new THREE.BoxGeometry(bw * 0.6, 0.08, 2.6), bx, y + h * 0.5, bz + bd / 2 + 1.2, 0, 1, -0.35, 0), { solid: false }); }
    if (rng() < 0.3) kit.add(M.dark, put(new THREE.BoxGeometry(0.9, 0.7, 1.1), bx + bw / 2 + 0.3, y + h * rng(), bz + (rng() - 0.5) * bd * 0.6), { solid: false });
    y += h;
  }
}

/** A walkway across: a deck on hangers and a railing each side. */
function walkway(kit, M, a, b, w = 2.6) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A), L = d.length(), yaw = Math.atan2(d.x, d.z);
  const c = A.clone().add(B).multiplyScalar(0.5);
  kit.add(M.slab, put(new THREE.BoxGeometry(w, 0.9, L), c.x, c.y, c.z, yaw, 1, -Math.asin(d.y / L), 0));
  for (const e of [-1, 1]) {
    const off = V(Math.cos(yaw) * e * w / 2, 1.0, -Math.sin(yaw) * e * w / 2);
    kit.add(M.rail, tube([A.clone().add(off), B.clone().add(off)], 0.06, 1, 3), { solid: false });
  }
  // a truss under the longer ones
  if (L > 30) kit.add(M.rail, put(new THREE.BoxGeometry(0.4, 2.4, L * 0.98), c.x, c.y - 1.6, c.z, yaw, 1, -Math.asin(d.y / L), 0), { solid: false });
}

/** A flying cab: an orange capsule, a dark canopy. */
function cab(kit, M, [x, y, z], yaw = 0, s = 1) {
  kit.add(M.cab, put(new THREE.SphereGeometry(1, 14, 8), x, y, z, yaw, [2.2 * s, 0.7 * s, 1.1 * s]), { solid: false });
  kit.add(M.glass, put(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), x + 0.3 * s, y + 0.35 * s, z, yaw, [0.9 * s, 0.6 * s, 0.7 * s]), { solid: false });
}

/**
 * A panel's scene. o: { walls: [houseWall options…], stacks: [stack options…], walkways: [[a, b]…],
 * cables: n (sagging between the walls at random heights), cabs: [[x, y, z]…], water: y (the
 * shaft's water, or null), sea: true (a sea reaching to the horizon), terrace: [x0, x1, z0, z1, y]
 * (the paving where a figure stands), cream: 0..1 (the share of cream blocks), seed }
 */
function shaftScene(kit, v, o) {
  const rng = mulberry32(o.seed ?? 1), M = materials(kit, o.cream ?? 0.3);
  // a wall whose face is turned from the sun stands between it and the street: what juts off it
  // (slabs, awnings, rails) casts no shadow, or the street and the wall across, which the sheets keep in
  // the sun, would be in its shade from top to bottom
  for (const w of o.walls ?? []) houseWall(kit, M, rng, { ...w, casts: w.side * Math.sign(v.sun.side) > 0 || Math.abs(v.sun.side) > 172 });
  for (const s of o.stacks ?? []) stack(kit, M, rng, s);
  for (const [a, b, w] of o.walkways ?? []) walkway(kit, M, a, b, w);
  for (const [x, y, z, yaw, s] of (v.omitCabs ? [] : o.cabs ?? [])) cab(kit, M, [x, y, z], yaw, s);
  // cables across the gap: from one wall's face to the other's, sagging
  const W = o.walls ?? [];
  if (W.length >= 2) for (let i = 0; i < (o.cables ?? 0); i++) {
    const a = W[0], b = W[1], t = rng(), u = t + (rng() - 0.5) * 0.2;
    const ya = a.y0 + (a.y1 - a.y0) * (0.2 + 0.7 * rng()), yb = ya + (rng() - 0.5) * 20;
    const za = a.z0 + (a.z1 - a.z0) * t, zb = b.z0 + (b.z1 - b.z0) * Math.min(Math.max(u, 0), 1);
    kit.add(M.cable, tube(sagPts(V(a.x + a.side * 2, ya, za), V(b.x + b.side * 2, yb, zb), 3 + rng() * 6, 12), 0.07, 12, 3), { solid: false });
  }
  if (o.terrace) {
    const [x0, x1, z0, z1, y] = o.terrace;
    kit.add(M.ground, put(new THREE.BoxGeometry(x1 - x0, 2, z1 - z0), (x0 + x1) / 2, y - 0.96, (z0 + z1) / 2));   // (a hair over the ground, which is the terrace there too)
  }
  if (o.water !== null && o.water !== undefined) {
    const size = o.sea ? 6000 : 900;
    kit.mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2).translate(0, o.water, o.sea ? -size / 2 + 200 : 0),
      kit.mat({ color: '#3fb8b4', color2: '#8fdcd2', mode: MODE_WATER }), { solid: false, shadow: false });
  }
}

/**
 * The shaft's ground: the water's bed far below, and the terraces the figures stand on ([x0, x1, z0, z1, y],
 * the same as the scene's: its paving slab is drawn over it). The views stand in the air or on a terrace.
 */
const pit = (bed, terraces = []) => ({
  height: (x, z) => {
    for (const [x0, x1, z0, z1, y] of terraces) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return y;
    return bed + 1.5 * Math.sin(x * 0.05) * Math.cos(z * 0.04);
  },
  material: { color: '#6fa7a8', color2: '#8fbdb8', color3: '#5d8f94' }, rings: { r1: 2600 },
});
const view = (o) => ({ sky: SKY, look: SHAFT_LOOK, fog: 1.4, ...o });

export const SHAFT_VIEWS = [
  // ===================================================================== IMG_3778 (one plate)
  view({
    id: '3778-shaft', title: 'Across the shaft to the sea', sheet: 'IMG_3778', panel: 1, where: 'the whole plate', crop: [0, 0, 1024, 1024],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 64, horizon: 0.7 },
    sun: { side: 140, el: 58 },
    ground: pit(-420, [[-36, -16, -50, -8, -36]]),
    people: [{ at: [-26, -26], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 3778, cream: 0.5, water: -400, sea: true,
        walls: [
          { x: -24, side: 1, z0: 10, z1: -60, y0: -60, y1: 70, depth: 8, jut: 2, over: 0.5, awn: 0.5 },
          { x: 40, side: -1, z0: 10, z1: -110, y0: -300, y1: 90, depth: 10, jut: 3, over: 0.3, awn: 0.1 },
        ],
        stacks: [
          { x: -40, z: -200, w: 46, y0: -380, y1: 170 }, { x: -10, z: -220, w: 30, y0: -380, y1: 140 }, { x: -70, z: -260, w: 34, y0: -380, y1: 200 },
          { x: 150, z: -420, w: 40, y0: -380, y1: 120 },
        ],
        walkways: [[[2, 30, -215], [34, 32, -90], 3.5], [[0, -260, -220], [60, -262, -300], 3]],
        cabs: [[12, 0, -120, 0.3, 1.4], [8, -18, -110, -0.4, 1], [40, 20, -160, 0.2, 0.8]],
        terrace: [-36, -16, -50, -8, -36],
        cables: 4,
      });
    },
  }),
  // ===================================================================== IMG_3779
  view({
    id: '3779-stair-street', title: 'The pink houses over the walkway', sheet: 'IMG_3779', panel: 1, where: 'left, tall', crop: [20, 18, 317, 984],
    camera: { eye: [0, 1.7, 0], yaw: -12, fov: 80, horizon: 0.82 },
    sun: { side: 150, el: 58 },
    ground: pit(-320, [[-16, 14, -34, 6, 0]]),
    people: [{ at: [-2, -24], facing: 3.1, palette: PERSON, head: 'hood' }],
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 3779, cream: 0.4, water: -300,
        walls: [{ x: -14, side: 1, z0: 6, z1: -90, y0: -40, y1: 140, depth: 10, jut: 3, over: 0.45, awn: 0.3 }],
        stacks: [{ x: 60, z: -260, w: 26, y0: -300, y1: 120 }],
        walkways: [[[-10, 18, -60], [40, 18, -64], 2.4]],
        terrace: [-16, 14, -34, 6, 0],
      });
    },
  }),
  view({
    id: '3779-down-to-water', title: 'Down the shaft to its water', sheet: 'IMG_3779', panel: 2, where: 'middle, tall', crop: [346, 20, 330, 983],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 82, pitch: -22 },
    sun: { side: 130, el: 58 },
    ground: pit(-140),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37792, cream: 0.6, water: -120,
        walls: [
          { x: -22, side: 1, z0: 10, z1: -260, y0: -130, y1: 80, depth: 10, jut: 5, over: 0.5, awn: 0.25 },
          { x: 24, side: -1, z0: 10, z1: -260, y0: -130, y1: 80, depth: 10, jut: 4, over: 0.4, awn: 0.25 },
        ],
        stacks: [{ x: -10, z: -200, w: 22, y0: -130, y1: 40 }, { x: 14, z: -260, w: 18, y0: -130, y1: 30 }],
        walkways: [[[-20, -60, -120], [22, -60, -126], 4]],
        cabs: [[2, -40, -90, 0.3, 1], [-6, -70, -150, 1.2, 0.9], [8, -20, -60, -0.5, 1.1]],
        cables: 8,
      });
    },
  }),
  view({
    id: '3779-cab-overhead', title: 'A cab in the slit of sky', sheet: 'IMG_3779', panel: 3, where: 'right, top', crop: [688, 19, 314, 306],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 62, pitch: 58 },
    sun: { side: 100, el: 58 },
    ground: pit(-200),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37793, cream: 0.1,
        walls: [
          { x: -10, side: 1, z0: 30, z1: -40, y0: -20, y1: 140, depth: 8, jut: 2, over: 0.35, awn: 0.1 },
          { x: 12, side: -1, z0: 30, z1: -40, y0: -20, y1: 150, depth: 8, jut: 3, over: 0.5, awn: 0.05 },
        ],
        cabs: [[2, 60, -26, 0.8, 1.2]],
        cables: 10,
      });
    },
  }),
  view({
    id: '3779-floating-tower', title: 'The tower standing in the sea', sheet: 'IMG_3779', panel: 4, where: 'right, middle', crop: [687, 337, 316, 308],
    camera: { eye: [0, 30, 0], yaw: 0, fov: 44, horizon: 0.8 },
    sun: { side: -140, el: 58 },
    ground: { height: (x, z) => -3 + 0.5 * Math.sin(x * 0.03), material: { color: '#6fa7a8', color2: '#8fbdb8', color3: '#5d8f94' }, rings: { r1: 4000 } },
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37794, cream: 0.6, water: 0, sea: true,
        stacks: [{ x: 6, z: -230, w: 40, y0: -2, y1: 120 }],
        walls: [{ x: 70, side: -1, z0: -60, z1: -200, y0: -2, y1: 160, depth: 10, jut: 1, over: 0.1, awn: 0 }],
        walkways: [[[-60, 70, -240], [-14, 70, -232], 2]],
      });
    },
  }),
  view({
    id: '3779-awning-street', title: 'The street of awnings', sheet: 'IMG_3779', panel: 5, where: 'right, bottom', crop: [688, 656, 317, 347],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 56, horizon: 0.74 },
    sun: { side: 120, el: 58 },
    ground: pit(-200, [[-6, 8, -160, 6, 0]]),
    people: [{ at: [3, -14], facing: 3, palette: PERSON, head: 'hood' }],
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37795, cream: 0.5, water: -180,
        walls: [
          { x: -5, side: 1, z0: 6, z1: -160, y0: -2, y1: 60, depth: 8, jut: 2, over: 0.3, awn: 0.3 },
          { x: 7, side: -1, z0: 6, z1: -160, y0: -2, y1: 50, depth: 8, jut: 3, over: 0.4, awn: 0.7 },
        ],
        terrace: [-6, 8, -160, 6, 0],
        cables: 5,
      });
    },
  }),
  // ===================================================================== IMG_3780
  view({
    id: '3780-overhangs', title: 'The pink block over the void', sheet: 'IMG_3780', panel: 1, where: 'top left', crop: [20, 17, 323, 539],
    camera: { eye: [0, 0, 0], yaw: 8, fov: 70, pitch: 30, roll: -4 },
    sun: { side: 160, el: 58 },
    ground: pit(-300),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37801, cream: 0.1,
        walls: [{ x: -14, side: 1, z0: 0, z1: -90, y0: -60, y1: 160, depth: 10, jut: 6, over: 0.6, awn: 0.25 }],
        stacks: [{ x: 30, z: -110, w: 24, y0: -200, y1: 160 }],
        walkways: [[[-6, 70, -40], [24, 76, -100], 2.6]],
        cabs: [[10, 50, -60, 0.4, 1], [18, 30, -70, -0.3, 0.8]],
      });
    },
  }),
  view({
    id: '3780-gap', title: 'Between the pink and the pale', sheet: 'IMG_3780', panel: 2, where: 'top middle', crop: [350, 18, 318, 538],
    camera: { eye: [0, 0, 0], yaw: 6, fov: 74, horizon: 0.5 },
    sun: { side: 170, el: 58 },
    ground: pit(-160),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37802, cream: 0.2, water: -140,
        walls: [{ x: -10, side: 1, z0: 10, z1: -70, y0: -140, y1: 120, depth: 10, jut: 6, over: 0.55, awn: 0.3 }],
        stacks: [{ x: 26, z: -110, w: 26, y0: -140, y1: 170 }, { x: 4, z: -220, w: 18, y0: -140, y1: 130 }],
        walkways: [[[-6, 30, -60], [16, 34, -104], 2]],
      });
    },
  }),
  view({
    id: '3780-cream-tower', title: 'The cream tower and its blue undersides', sheet: 'IMG_3780', panel: 3, where: 'top right', crop: [678, 17, 324, 539],
    camera: { eye: [0, 0, 0], yaw: -6, fov: 72, pitch: 34 },
    sun: { side: -150, el: 58 },
    ground: pit(-300),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37803, cream: 1.2,
        stacks: [{ x: -4, z: -50, w: 30, y0: -120, y1: 200 }, { x: 50, z: -120, w: 22, y0: -200, y1: 220 }],
        walkways: [[[10, 40, -50], [44, 44, -118], 2.4]],
        cabs: [[20, 120, -80, 0.4, 1]],
      });
    },
  }),
  view({
    id: '3780-blimps', title: 'Towers and blimps overhead', sheet: 'IMG_3780', panel: 4, where: 'bottom left', crop: [21, 569, 492, 437],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 60, pitch: 26 },
    sun: { side: 150, el: 58 },
    ground: pit(-300),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37804, cream: 0.3,
        walls: [{ x: -16, side: 1, z0: 10, z1: -60, y0: -80, y1: 120, depth: 10, jut: 5, over: 0.5, awn: 0.3 }],
        stacks: [{ x: 18, z: -70, w: 20, y0: -150, y1: 110 }, { x: -2, z: -140, w: 14, y0: -150, y1: 70 }, { x: 40, z: -100, w: 16, y0: -150, y1: 140 }],
        walkways: [[[-10, 20, -40], [10, 22, -66], 2], [[-10, 50, -40], [8, 54, -70], 2]],
        cabs: [[0, 70, -60, 0.2, 1.8], [24, 60, -90, -0.4, 1.2]],
      });
    },
  }),
  view({
    id: '3780-red-stair', title: 'On the red stair under the bridge', sheet: 'IMG_3780', panel: 5, where: 'bottom right', crop: [520, 569, 484, 437],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.72 },
    sun: { side: -160, el: 58 },
    ground: pit(-160, [[-2, 12, -14, 4, 0]]),
    people: [{ at: [5, -6], facing: 2.6, palette: PERSON, head: 'hood' }],
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37805, cream: 0.8, water: -140,
        walls: [{ x: 9, side: -1, z0: 6, z1: -30, y0: -10, y1: 60, depth: 8, jut: 1, over: 0.2, awn: 0.2 }],
        stacks: [{ x: -18, z: -60, w: 22, y0: -140, y1: 110 }, { x: 0, z: -40, w: 16, y0: -140, y1: 90 }],
        walkways: [[[-10, 40, -56], [6, 42, -24], 4]],
        terrace: [-2, 12, -14, 4, 0],
        cabs: [[-6, 60, -80, 0.2, 1.4]],
        cables: 6,
      });
    },
  }),
  // ===================================================================== IMG_3781
  view({
    id: '3781-awning-cliff', title: 'Awnings down the cliff of houses', sheet: 'IMG_3781', panel: 1, where: 'left, top', crop: [17, 14, 320, 638],
    camera: { eye: [0, 0, 0], yaw: -18, fov: 70, pitch: -46 },
    sun: { side: -130, el: 58 },
    ground: pit(-260),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37811, cream: 0.3, water: -240,
        walls: [{ x: 14, side: -1, z0: 20, z1: -80, y0: -240, y1: 30, depth: 10, jut: 5, over: 0.4, awn: 0.45 },
                { x: -30, side: 1, z0: 20, z1: -80, y0: -240, y1: 20, depth: 10, jut: 2, over: 0.2, awn: 0.05 }],
      });
    },
  }),
  view({
    id: '3781-canyon-boats', title: 'Down the canyon to the boats', sheet: 'IMG_3781', panel: 2, where: 'middle, tall', crop: [350, 14, 324, 994],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 84, pitch: -62 },
    sun: { side: -150, el: 58 },
    ground: pit(-300),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37812, cream: 0.2, water: -280,
        walls: [{ x: -20, side: 1, z0: 30, z1: -300, y0: -280, y1: 10, depth: 10, jut: 4, over: 0.35, awn: 0.2 },
                { x: 22, side: -1, z0: 30, z1: -300, y0: -280, y1: 10, depth: 10, jut: 5, over: 0.4, awn: 0.2 }],
        walkways: [[[-18, -150, -110], [20, -150, -112], 3], [[-18, -220, -60], [20, -222, -66], 3]],
        cabs: [[0, -276, -100, 0.1, 1.5], [-6, -277, -130, 0.4, 1], [6, -277, -70, -0.2, 1], [-2, -277, -160, 0.6, 0.9]],
        cables: 6,
      });
    },
  }),
  view({
    id: '3781-narrowing', title: 'The slot narrowing to the water', sheet: 'IMG_3781', panel: 3, where: 'right, top', crop: [687, 14, 320, 466],
    camera: { eye: [0, 0, 0], yaw: 4, fov: 70, pitch: -42 },
    sun: { side: 130, el: 58 },
    ground: pit(-260),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37813, cream: 0.2, water: -240,
        walls: [{ x: -16, side: 1, z0: 10, z1: -220, y0: -240, y1: 20, depth: 10, jut: 6, over: 0.5, awn: 0.15 },
                { x: 14, side: -1, z0: 10, z1: -220, y0: -240, y1: 40, depth: 10, jut: 2, over: 0.1, awn: 0 }],
      });
    },
  }),
  view({
    id: '3781-cable-arch', title: 'Cables over the arched canyon', sheet: 'IMG_3781', panel: 4, where: 'right, bottom', crop: [687, 491, 320, 517],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 70, pitch: -28 },
    sun: { side: 160, el: 58 },
    ground: pit(-220),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37814, cream: 0.2, water: -200,
        walls: [{ x: -22, side: 1, z0: 0, z1: -260, y0: -200, y1: 40, depth: 10, jut: 4, over: 0.3, awn: 0.1 },
                { x: 24, side: -1, z0: 0, z1: -260, y0: -200, y1: 40, depth: 10, jut: 4, over: 0.3, awn: 0.1 }],
        walkways: [[[-20, -90, -120], [22, -92, -124], 4]],
        cabs: [[0, -196, -140, 0.2, 1.2], [6, -196, -170, 0.5, 1]],
        cables: 26,
      });
    },
  }),
  view({
    id: '3781-terrace-walk', title: 'Walking along the terrace', sheet: 'IMG_3781', panel: 5, where: 'left, bottom', crop: [17, 663, 320, 345],
    camera: { eye: [0, 1.7, 0], yaw: 20, fov: 54, horizon: 0.62 },
    sun: { side: -140, el: 58 },
    ground: pit(-200, [[-10, 12, -60, 6, 0]]),
    people: [{ at: [-2, -6], facing: 0.8, palette: PERSON, head: 'hood' }],
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37815, cream: 0.4,
        walls: [{ x: 12, side: -1, z0: 6, z1: -60, y0: -2, y1: 50, depth: 8, jut: 1.5, over: 0.2, awn: 0.15 }],
        stacks: [{ x: -30, z: -60, w: 30, y0: -120, y1: 60 }],
        terrace: [-10, 12, -60, 6, 0],
      });
    },
  }),
  // ===================================================================== IMG_3782
  view({
    id: '3782-balcony', title: 'The balcony over the slot', sheet: 'IMG_3782', panel: 1, where: 'left, tall', crop: [30, 27, 314, 651],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 76, horizon: 0.52 },
    sun: { side: 150, el: 58 },
    ground: pit(-260, [[-12, -2, -20, -8, 8]]),
    people: [{ at: [-7, -14], facing: 1.6, palette: PERSON, head: 'hood' }],
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37821, cream: 0.3, water: -240,
        walls: [{ x: -8, side: 1, z0: 10, z1: -60, y0: -200, y1: 60, depth: 10, jut: 4, over: 0.5, awn: 0.2 }],
        stacks: [{ x: 22, z: -60, w: 18, y0: -240, y1: 110 }, { x: 4, z: -180, w: 20, y0: -240, y1: 30 }],
        walkways: [[[-6, 18, -40], [16, 18, -56], 2]],
        cabs: [[2, 0, -40, 0.5, 1.1], [4, -14, -50, -0.3, 1]],
        terrace: [-12, -2, -20, -8, 8],
      });
    },
  }),
  view({
    id: '3782-tilted-base', title: 'The tower falling away to the water', sheet: 'IMG_3782', panel: 2, where: 'middle, tall', crop: [356, 27, 311, 651],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 76, pitch: -40, roll: 8 },
    sun: { side: -150, el: 58 },
    ground: pit(-280),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37822, cream: 0.6, water: -260,
        stacks: [{ x: -4, z: -50, w: 34, y0: -260, y1: 40 }],
        walls: [{ x: 30, side: -1, z0: 10, z1: -120, y0: -260, y1: 40, depth: 10, jut: 2, over: 0.2, awn: 0.05 }],
        walkways: [[[-20, -40, -40], [-60, -46, -70], 2.4], [[10, -90, -44], [26, -94, -60], 2.4]],
        cabs: [[6, -256, -70, 0.6, 1.2]],
      });
    },
  }),
  view({
    id: '3782-walkways-up', title: 'Walkways between the houses, overhead', sheet: 'IMG_3782', panel: 3, where: 'right, top', crop: [680, 27, 316, 335],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 64, pitch: 32 },
    sun: { side: 150, el: 58 },
    ground: pit(-200),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37823, cream: 0.6,
        walls: [{ x: -10, side: 1, z0: 10, z1: -60, y0: -40, y1: 90, depth: 8, jut: 3, over: 0.4, awn: 0.3 },
                { x: 12, side: -1, z0: 10, z1: -60, y0: -40, y1: 100, depth: 8, jut: 4, over: 0.4, awn: 0.2 }],
        walkways: [[[-8, 20, -30], [10, 21, -30], 3], [[-8, 34, -36], [10, 32, -40], 2.4], [[-8, 12, -20], [10, 12, -22], 2]],
        cables: 4,
      });
    },
  }),
  view({
    id: '3782-slot-up', title: 'Up the slot past the walkways', sheet: 'IMG_3782', panel: 4, where: 'right, middle', crop: [680, 374, 316, 304],
    camera: { eye: [0, 0, 0], yaw: -10, fov: 60, pitch: 18 },
    sun: { side: 179, el: 58 },
    ground: pit(-200),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37824, cream: 0.7, water: -180,
        walls: [{ x: -8, side: 1, z0: 10, z1: -160, y0: -180, y1: 80, depth: 8, jut: 3, over: 0.4, awn: 0.1 },
                { x: 4, side: -1, z0: 4, z1: -40, y0: -180, y1: 120, depth: 8, jut: 0.5, over: 0, awn: 0 }],
        walkways: [[[-6, 10, -60], [8, 10, -66], 2], [[-6, -8, -80], [10, -8, -90], 2], [[-6, -24, -100], [10, -26, -110], 2]],
      });
    },
  }),
  view({
    id: '3782-cream-face', title: 'Up the cream face', sheet: 'IMG_3782', panel: 5, where: 'bottom, left', crop: [30, 690, 314, 304],
    camera: { eye: [0, 0, 0], yaw: 20, fov: 64, pitch: 48, roll: -10 },
    sun: { side: 170, el: 58 },
    ground: pit(-200),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37825, cream: 2.0,
        stacks: [{ x: 0, z: -24, w: 26, y0: -40, y1: 160, over: 0.5 }],
      });
    },
  }),
  view({
    id: '3782-slot-blimp', title: 'The slot under the blimp', sheet: 'IMG_3782', panel: 6, where: 'bottom, middle', crop: [357, 690, 309, 304],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 66, horizon: 0.62 },
    sun: { side: 130, el: 58 },
    ground: pit(-220),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37826, cream: 0.3, water: -200,
        walls: [{ x: -12, side: 1, z0: 10, z1: -180, y0: -200, y1: 90, depth: 10, jut: 4, over: 0.5, awn: 0.3 },
                { x: 12, side: -1, z0: 10, z1: -180, y0: -200, y1: 90, depth: 10, jut: 4, over: 0.5, awn: 0.3 }],
        walkways: [[[-10, 2, -100], [10, 2, -104], 3]],
        cabs: [[0, 40, -110, 0.3, 2.6], [-3, 18, -80, -0.5, 1], [4, 14, -90, 0.6, 1]],
        cables: 6,
      });
    },
  }),
  view({
    id: '3782-pink-wall', title: 'The pink wall, close', sheet: 'IMG_3782', panel: 7, where: 'bottom, right', crop: [678, 690, 318, 304],
    camera: { eye: [0, 0, 0], yaw: -38, fov: 60, pitch: 36, roll: 12 },
    sun: { side: 150, el: 58 },
    ground: pit(-200),
    build(kit, v) {
      shaftScene(kit, v, {
        seed: 37827, cream: 0,
        walls: [{ x: -6, side: 1, z0: 20, z1: -40, y0: -30, y1: 80, depth: 10, jut: 0.6, over: 0.15, awn: 0 }],
      });
    },
  }),
];
