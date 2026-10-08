import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import {
  spaceMats, island, heap, slab, bridge, quarter, crownTree, railing, pipeStack, spaceTraveller, walkers, resident, lantern, laundry, awning,
  SPACE_LOOK, SPACE_DAY, PLANET_TONE,
} from './space-city-kit.js';

// ---------------------------------------------------------------------------
// The City Floating in Space's reference pictures (references/The City Floating in Space/reference-1 … 4): a city of
// rounded adobe houses in cream, salmon and coral heaped on islands that float in the black of space, joined by pale
// arched bridges, their undersides hung with dark machinery and cables dangling into the void; stars printed all
// round, teal and white; a great pale planet over the roofs (full, or a crescent); the traveller on a dark teal
// balcony at the right, a glowing bottle on his back. Each picture is one composition: one view each, built by one
// scene builder (spaceScene) with the world's kit (space-city-kit.js).
//
// Placed off the pictures' pixels (as the Forest of Antennas' views): a point drawn at (px, py) of the 1456 × 816
// picture, d m away, is where the view's camera sees it there (sheetAt, sheetGround); the planet is given as its
// disc on the picture (centre and radius in pixels) and lit from a direction of its own (post.js uSpaceSun), turned
// into the world's directions for the view's sun (references.js sunTurn).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The City Floating in Space / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The City Floating in Space/reference-${n}.jpeg`, import.meta.url).href });
export const SPACE_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`spacecity-${n}`, sheet(n)]));

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
// ---------------------------------------------------------------- the sheets' pixels
const SW = 1456, SH = 816;
const camOf = (cam) => { const tf = Math.tan((cam.fov * Math.PI) / 360); return { f: SH / 2 / tf, p: Math.atan((cam.horizon - 0.5) * 2 * tf), e: cam.eye }; };
/** The point drawn at (px, py) on the sheet, d m away (horizontally) along the view, in the view's frame. */
export function sheetAt(cam, px, py, d) {
  const { f, p, e } = camOf(cam), u = (px - SW / 2) / f, v = (SH / 2 - py) / f, t = d / (Math.cos(p) - v * Math.sin(p));
  return [e[0] + t * u, e[1] + t * (Math.sin(p) + v * Math.cos(p)), e[2] - d];
}
/** Where the sheet's pixel (px, py) meets level ground at height g, in the view's frame. */
export function sheetGround(cam, px, py, g = 0) {
  const { f, p, e } = camOf(cam), u = (px - SW / 2) / f, v = (SH / 2 - py) / f, t = (g - e[1]) / (Math.sin(p) + v * Math.cos(p));
  return [e[0] + t * u, g, e[2] - t * (Math.cos(p) - v * Math.sin(p))];
}
/** The direction (view's frame) of the sheet's pixel (px, py). */
export function sheetDir(cam, px, py) {
  const { f, p } = camOf(cam), u = (px - SW / 2) / f, v = (SH / 2 - py) / f;
  return V(u, Math.sin(p) + v * Math.cos(p), -(Math.cos(p) - v * Math.sin(p))).normalize();
}

// (references.js's sun: up from 6 to 18, at most 62° high, from azimuth 30° round to 210°; the view's group turned for it)
const sunAz = (el) => 30 + (Math.asin(Math.min(el, 61.99) / 62) / Math.PI) * 180;
const turnOf = (view) => (sunAz(view.sun.el) + view.sun.side - 180 + (view.camera.yaw ?? 0)) * DEG;
/** A direction of the view's frame in the world (its group turned for the view's sun). */
const worldDir = (view, d) => d.clone().applyAxisAngle(V(0, 1, 0), turnOf(view));
/**
 * The planet of a view, from its disc on the picture: { at: [px, py], r: its radius in px, light: [right, up, toward
 * us] (where its sun is, seen from the planet, in the picture's terms: [0, 0, 1] lights it full, [1, 0, 0] lights its
 * right half), night: its dark side's colour, or null for the shadow tint's }. Returns the level's planet (az, el,
 * size in deg) and the look's uSpaceSun, uSpaceNight.
 */
function planetOf(view, { at, r, light, night = null, color = PLANET_TONE }) {
  // (its angular radius: the mean of its centre's angle to the limb above, below and to each side, since the
  //  camera's projection stretches a disc off the axis; the picture's is a circle on the page)
  const cam = view.camera, c = sheetDir(cam, at[0], at[1]);
  const size = [[0, -r], [0, r], [-r, 0], [r, 0]].reduce((s, [dx, dy]) => s + Math.acos(THREE.MathUtils.clamp(c.dot(sheetDir(cam, at[0] + dx, at[1] + dy)), -1, 1)), 0) / 4 / DEG;
  const right = V(0, 1, 0).cross(c).negate().normalize(), up = c.clone().cross(right).negate().normalize();
  const l = right.multiplyScalar(light[0]).add(up.multiplyScalar(light[1])).addScaledVector(c, -light[2]).normalize();
  const w = worldDir(view, c), L = worldDir(view, l);
  const nc = night ? new THREE.Color(night) : null;
  return {
    planets: [{ az: Math.atan2(w.x, w.z) / DEG, el: Math.asin(w.y) / DEG, size, color, craters: false }],
    look: { uSpaceSun: [L.x, L.y, L.z, 1], uSpaceNight: nc ? [nc.r, nc.g, nc.b, 1] : [0, 0, 0, 0] },
  };
}

const NC = { solid: false, shadow: false };

/**
 * A picture's scene. o: { seed, islands: [island options + { quarter: [quarter options…] }…], bridges: [[A, B, opts]…],
 * balcony: { floor: [x0, x1, z0, z1, y], rail: [[x, y, z]…], solid }, stacks: [[x, y, z, h, opts]…], walkers: [[A, B, n]…],
 * people: [[x, y, z, opts]…], trees: [[x, y, z, s]…], lamps: [[x, y, z, opts]…], traveller: [x, y, z, yaw, bottle?],
 * extra(kit, M, rng) }
 */
function spaceScene(kit, v, o) {
  const M = spaceMats(kit), rng = mulberry32(o.seed ?? 1);
  const decks = [];
  for (const isl of o.islands ?? []) {
    const I = island(kit, M, rng, { seed: o.seed + decks.length * 7, ...isl });
    decks.push(I);
    for (const q of isl.quarter ?? []) quarter(kit, M, rng, { y: I.y, inside: (x, z, m) => I.inside(x, z, m + 0.6), ...q });
    if (isl.heap) heap(kit, M, rng, I, { d: isl.d ?? 30, ...isl.heap });
  }
  for (const [A, B, op] of o.bridges ?? []) bridge(kit, M, A, B, op);
  if (o.balcony) {
    // its floor: the railing's line closed round the camera's side (floor: more points of it, [[x, z]…]), at the rail's foot
    const y = o.balcony.rail[0][1], pts = [...o.balcony.rail.map(([x, , z]) => [x, z]), ...(o.balcony.floor ?? [])];
    const bm = o.balcony.mat ? M[o.balcony.mat] : M.rail;
    slab(kit, bm, pts, 0, 0, 0, y - 0.6, y);
    railing(kit, M, o.balcony.rail, { solidWall: !!o.balcony.solid, h: o.balcony.h ?? 1.1, mat: bm });
  }
  for (const [x, y, z, h, op] of o.stacks ?? []) pipeStack(kit, M, rng, x, y, z, h, op);
  for (const [A, B, n, y] of o.walkers ?? []) walkers(kit, M, rng, A, B, n, y !== undefined ? () => y : null);
  for (const [x, y, z, op] of o.people ?? []) resident(kit, M, rng, x, y, z, op ?? {});
  for (const [x, y, z, s] of o.trees ?? []) crownTree(kit, M, rng, x, y, z, s);
  for (const [x, y, z, op] of o.lamps ?? []) lantern(kit, M, x, y, z, op ?? {});
  for (const [A, B, op] of o.washing ?? []) laundry(kit, M, rng, A, B, op ?? {});
  for (const [A, B, op] of o.awnings ?? []) awning(kit, M, rng, A, B, op ?? {});
  if (o.traveller) { const [x, y, z, yaw = 0, bottle] = o.traveller; spaceTraveller(kit, M, x, y, z, yaw, bottle ? { bottle: kit.mat({ color: bottle, glow: 0.55, flat: true, spot: 0, line: 0.5, lineTint: 0.5 }) } : {}); }
  o.extra?.(kit, M, rng, decks);
}

/** The ground: the balcony's floor near the camera (the traveller stands there), the void below everywhere else (drawn: nothing). */
const voidGround = (floor = [-2, 12, -12, 3, 0]) => ({
  height: (x, z) => (x > floor[0] && x < floor[1] && z > floor[2] && z < floor[3] ? floor[4] : -900),
  material: { color: '#020a0e' }, rings: { r1: 1200 }, hidden: true,
});

/** A view of the city: space all round, the planet where its picture has it, the city's ink. */
const view = (o) => {
  const v = { sky: SPACE_DAY, fog: 0.6, world: 'The City Floating in Space', ground: voidGround(o.floor), ...o };
  const P = planetOf(v, o.planet);
  v.planets = P.planets;
  v.look = { ...SPACE_LOOK, ...P.look, ...(o.look ?? {}) };
  return v;
};

// ---------------------------------------------------------------- the views
const CAM = { eye: [0, 1.8, 0], yaw: 0, fov: 55, horizon: 0.5 };
const CAM2 = { ...CAM, eye: [0, 2.1, 0] }, CAM3 = { ...CAM, eye: [0, 2.2, 0] }, CAM4 = { ...CAM, eye: [0, 2.2, 0], horizon: 0.42 };

export const SPACE_VIEWS = [
  view({
    id: 'spacecity-1-bridge', title: 'From the balcony: the arched bridge over the void, the heaped city, the planet’s edge', sheet: 'spacecity-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM, sun: { side: -120, el: 40 }, floor: [-1, 16, -14, 2, 0],
    planet: { at: [2150, 520], r: 1250, light: [-0.8, 0.35, 0.5], color: '#fdf8d6' }, look: { uSpace: [1, 0.15, 0.7, 0.3] },
    build(kit, v) {
      const D = -8.3;   // the bridge's deck, under the balcony
      spaceScene(kit, v, {
        seed: 71001,
        traveller: [3.2, 0, -4.4, 0.1],
        balcony: { rail: [[0.5, 0, 1.5], [0.5, 0, -1.34], [1.25, 0, -3.73], [8.2, 0, -8.8], [15, 0, -12.5]], floor: [[15, 1.5]] },
        stacks: [[13.4, -24, -10.5, 46, { R: 1.3, n: 6 }], [10.5, -14, -12.5, 12, { R: 0.6, n: 3, solid: false }]],
        islands: [
          // the left: the heaped quarter over the plaza where the bridge lands, stepping up and back to the stars
          { x: -27, y: D, z: -52, w: 38, d: 34, cr: 10, deep: 30, cables: 30, lights: 6, gaps: [[18, 12, 4]],
            heap: { peak: 5, mound: [-0.2, -0.3], q: { domes: 0.12, n: 26, gap: 0, size: [5, 9], tall: [3.6, 5.6], trees: 0.35, lit: 0.5, awnings: 0.4, wash: 0.3 }, clear: [[-12, -40, 6], [-20, -38, 5]] } },
          // the left near: terraces at the frame's edge, their machinery down to its foot
          { x: -21, y: -16, z: -22, w: 18, d: 22, cr: 5, deep: 22, cables: 14, rim: 0.9,
            heap: { peak: 4, mound: [-0.4, -0.2], q: { domes: 0.12, n: 7, gap: 0, size: [4.5, 7], tall: [3.6, 5.2], trees: 0.3, lit: 0.5, awnings: 0.5 } } },
          // the right: the quarter the bridge lands on, heaped up to the planet's edge
          { x: 22, y: D, z: -46, w: 38, d: 40, cr: 10, deep: 26, cables: 22, lights: 6, gaps: [[-19, 20, 4.5]],
            heap: { peak: 4, mound: [0.3, -0.3], q: { domes: 0.12, n: 22, gap: 0, size: [6, 10], tall: [4, 6.5], trees: 0.4, lit: 0.55, awnings: 0.3, wash: 0.25 }, clear: [[4, -27, 6]] } },
          // the middle: the island under the arches, its machinery hanging in the gap
          { x: -6, y: 0, z: -102, w: 40, d: 26, cr: 8, deep: 26, cables: 20, detail: 0.7,
            heap: { peak: 2, q: { domes: 0.12, n: 16, gap: 0, size: [5, 9], tall: [3.5, 6], detail: 0.7 } } },
          // the far city, higher, heaped to its towers
          { x: -32, y: 21, z: -200, w: 100, d: 60, cr: 16, deep: 30, cables: 16, detail: 0.45,
            heap: { peak: 5, q: { domes: 0.12, n: 46, gap: 0, size: [6, 12], tall: [4, 7], detail: 0.45, trees: 0.3 } } },
          { x: 30, y: 30, z: -300, w: 60, d: 40, cr: 12, deep: 22, cables: 8, detail: 0.35,
            heap: { peak: 4, q: { domes: 0.12, n: 26, gap: 0, size: [6, 12], tall: [4, 7], detail: 0.35 } } },
        ],
        bridges: [
          [[-9, D, -40], [3, D, -26], { w: 3.4, end: 6, mid: 1.1, hump: 0.7 }],
          [[-22, 0, -95], [-30, D, -64], { w: 3.4, end: 5, mid: 1, hump: 0.4 }],
          [[10, 0, -95], [18, 4, -66], { w: 3.4, end: 5, mid: 1, hump: 0.4 }],
          [[-30, 21, -172], [-18, 0, -113], { w: 3.6, end: 7, mid: 1.4 }],
          [[-60, 21, -172], [-46, 25, -125], { w: 3.6, end: 6, mid: 1.2 }],
        ],
        walkers: [[[-7, D, -38.5], [1.5, D, -27.5], 3, D], [[-28, D, -38], [-14, D, -42], 6, D]],
        extra(kit, M, rng) {
          // the second bridge's landing on the far left: a short tower of steps under it (the far quarter's arm)
          void rng;
          kit.add(M.masonry, new THREE.CylinderGeometry(3, 3, 26, 10).translate(-46, 12, -125), { solid: true, shadow: true });
        },
      });
    },
  }),
  view({
    id: 'spacecity-2-crescent', title: 'Under the crescent: the market bridge crowded between the heaps, the far arches', sheet: 'spacecity-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM2, sun: { side: 120, el: 35 }, floor: [-2, 8, -4, 2, 0],
    sky: ['#010e0d', '#020f0e', '#8e8a84', '#f6ece0', '#fff8ec'],
    planet: { at: [864, 92], r: 217, light: [0.8, -0.5, -0.25], color: '#fee4c2', night: '#020e0d' },
    look: { uSpace: [1, 0.15, 0.25, 0.3], uSpaceTone: [0.02, 0.09, 0.085, 1] },
    build(kit, v) {
      const D = -8;
      spaceScene(kit, v, {
        seed: 72001,
        traveller: [2.3, 0, -3.3, -0.15, '#d8fff4'],
        balcony: { rail: [[-2, 0, -2.8], [5.4, 0, -5.0]], floor: [[5.4, 2], [-2, 2]], solid: true, h: 0.63, mat: 'stone' },
        stacks: [[-7, -30, -8, 44, { R: 0.45, n: 4 }]],
        islands: [
          // the left heap at ninety metres, its machinery hung over the void
          { x: -58, y: D, z: -98, w: 62, d: 42, cr: 14, deep: 36, cables: 40, lights: 8, gaps: [[30, 10, 6]],
            heap: { peak: 9, mound: [-0.15, -0.2], q: { domes: 0.35, round: 0.4, n: 50, gap: 0, size: [6, 11], tall: [4, 6], trees: 0.4, lit: 0.55, awnings: 0.4, wash: 0.25 }, clear: [[-28, -88, 7]] } },
          // the right: the near quarter of round houses, the bridge's landing
          { x: 22, y: D, z: -42, w: 42, d: 44, cr: 12, deep: 26, cables: 20, lights: 5, gaps: [[-20, 0, 7]],
            heap: { peak: 4, mound: [0.3, -0.1], q: { domes: 0.4, round: 0.45, n: 26, gap: 0, size: [6, 11], tall: [4, 6], trees: 0.35, lit: 0.6, awnings: 0.5, wash: 0.3 }, clear: [[3, -42, 8]] } },
          // the middle, far: the quarter under the crescent; over it, its upper terrace and the arches
          { x: -10, y: 0, z: -175, w: 64, d: 32, cr: 10, deep: 30, cables: 20, detail: 0.6,
            heap: { peak: 3, q: { domes: 0.35, round: 0.4, n: 30, gap: 0, size: [6, 11], tall: [4, 6], detail: 0.6 } } },
          { x: -26, y: 20, z: -205, w: 40, d: 22, cr: 8, deep: 14, cables: 8, detail: 0.5,
            heap: { peak: 2, q: { domes: 0.35, round: 0.4, n: 14, gap: 0, size: [6, 10], tall: [4, 6], detail: 0.5 } } },
          { x: 44, y: 10, z: -160, w: 40, d: 30, cr: 10, deep: 22, cables: 12, detail: 0.5,
            heap: { peak: 3, q: { domes: 0.35, round: 0.4, n: 18, gap: 0, size: [6, 10], tall: [4, 6], detail: 0.5 } } },
        ],
        bridges: [
          // the market bridge: broad, crowded, from the left heap out to the near quarter
          [[-28, D, -88], [2, D, -42], { w: 7, end: 8, mid: 1.6, hump: 0.8 }],
          [[-56, 22, -120], [-34, 20, -196], { w: 3.6, end: 6, mid: 1.2 }],
          [[24, 10, -146], [30, 6, -64], { w: 3.6, end: 7, mid: 1.3, hump: 0.4 }],
        ],
        walkers: [[[-26, D, -85], [0, D, -45], 34, D], [[-50, D, -82], [-32, D, -86], 8, D], [[6, D, -36], [16, D, -28], 8, D]],
      });
    },
  }),
  view({
    id: 'spacecity-3-arches', title: 'The two arches under the towers, the city running on under the great planet', sheet: 'spacecity-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM3, sun: { side: 110, el: 30 }, floor: [-1, 12, -8, 2, 0],
    sky: ['#010a0c', '#020b0d', '#c07e72', '#ffe2d0', '#fff4e4'],
    planet: { at: [1181, 509], r: 457, light: [0.62, 0.15, 0.78], color: '#fed4b0', night: '#7c6b66' },
    look: { uSpace: [1, 0.15, 0.4, 0.25] },
    build(kit, v) {
      const D = -10;
      spaceScene(kit, v, {
        seed: 73001,
        traveller: [3.1, 0, -4.1, 0.2],
        balcony: { rail: [[0.2, 0, 1.5], [0.29, 0, -2.5], [0.77, 0, -3.5], [5.2, 0, -5.6], [9, 0, -6.3]], floor: [[9, 1.5]], solid: true, h: 0.68 },
        stacks: [[7.5, -14, -7, 30, { R: 1.4, n: 5 }]],
        islands: [
          // the left: the towers' heap, their machinery a long column down into the void
          { x: -80, y: -2, z: -112, w: 42, d: 36, cr: 10, deep: 50, cables: 34, lights: 8, gaps: [[19, 4, 5]],
            heap: { peak: 12, mound: [-0.1, -0.1], spread: 1.1, q: { domes: 0.1, towers: 0.3, round: 0.3, n: 34, gap: 0, size: [5, 9], tall: [5, 7], trees: 0.3, lit: 0.6, awnings: 0.3, wash: 0.3 } } },
          // the middle: the tall stack the arches reach
          { x: -12, y: D, z: -96, w: 16, d: 16, cr: 5, deep: 28, cables: 16, gaps: [[-8, 0, 5]],
            heap: { peak: 8, spread: 1.6, q: { domes: 0.1, n: 5, gap: 0, size: [5, 8], tall: [4, 6], trees: 0.3, lit: 0.6, awnings: 0.4, wash: 0.4 } } },
          // the near plaza under the balcony, its crowd
          { x: -6, y: D - 4, z: -44, w: 32, d: 16, cr: 6, deep: 18, cables: 12, lights: 4, rim: 0.8,
            heap: { peak: 1, q: { domes: 0.1, n: 4, gap: 1, size: [5, 8], tall: [3.6, 5], lit: 0.6, awnings: 0.6 } } },
          // the right: the city running on under the planet
          { x: 30, y: -6, z: -84, w: 50, d: 40, cr: 12, deep: 24, cables: 16, detail: 0.7,
            heap: { peak: 3, mound: [-0.2, 0], q: { domes: 0.15, n: 30, gap: 0, size: [5, 10], tall: [3.6, 6], trees: 0.4, lit: 0.6, detail: 0.7, awnings: 0.4, wash: 0.3 } } },
          { x: 80, y: 0, z: -190, w: 90, d: 50, cr: 16, deep: 24, cables: 10, detail: 0.45,
            heap: { peak: 3, q: { domes: 0.15, towers: 0.08, n: 44, gap: 0, size: [6, 12], tall: [4, 7], trees: 0.4, detail: 0.45 } } },
        ],
        bridges: [
          // the two arches, one over the other, from the towers to the middle stack
          [[-60, -1.8, -108], [-22, -1.8, -97], { w: 3.6, end: 6, mid: 1.3, hump: 0.3 }],
          [[-60, 11.6, -107], [-20, 11.6, -96], { w: 3.6, end: 5, mid: 1.2, hump: 0.3 }],
          [[0, D, -96], [8, -6, -78], { w: 3.4, end: 4, mid: 1 }],
        ],
        walkers: [[[-18, D - 4, -42], [6, D - 4, -46], 18, D - 4]],
      });
    },
  }),
  view({
    id: 'spacecity-4-market', title: 'The market on the middle island, the bridges round it, the full planet behind the houses', sheet: 'spacecity-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM4, sun: { side: -100, el: 32 }, floor: [-1, 12, -8, 2, 0],
    sky: ['#010e12', '#021014', '#b86a5a', '#ffd2b4', '#fff0dc'],
    planet: { at: [1165, 247], r: 369, light: [-0.15, 0.1, 1], color: '#fdeacc' },
    look: { uSpace: [1, 0.12, 0.6, 0.2] },
    build(kit, v) {
      const G = (px, py, g) => sheetGround(CAM4, px, py, g), A = (px, py, d) => sheetAt(CAM4, px, py, d), foot = (p) => [p[0], 0, p[2]];
      const D = -6;   // the market's deck, the near walkway's
      const rail = [foot(G(560, 816, 1.1)), foot(G(640, 750, 1.1)), foot(G(1390, 500, 1.1)), [14, 0, -16]];
      const W0 = G(150, 610, D), W1 = G(600, 515, D), MK = G(700, 470, D), LH = G(20, 700, D);
      const H0 = A(110, 410, 64), H1 = A(520, 380, 76);   // the high bridge's ends
      spaceScene(kit, v, {
        seed: 74001,
        traveller: [...foot(G(1220, 740, 0)), 0.25, '#ffc888'],
        balcony: { rail, floor: [[14, 2], [rail[0][0], 2]] },
        stacks: [[13, -16, -15, 36, { R: 1.4, n: 5 }]],
        islands: [
          // the left heap, close, the walkway leaving it
          { x: LH[0] - 9, y: D, z: LH[2] - 4, w: 20, d: 28, cr: 7, deep: 24, cables: 20, lights: 4, gaps: [[W0[0] - LH[0] + 9, W0[2] - LH[2] + 4, 5]],
            heap: { peak: 3, mound: [-0.4, -0.1], q: { domes: 0.2, round: 0.2, n: 14, gap: 0, size: [4.5, 7], tall: [3.4, 4.6], trees: 0.3, lit: 0.6, awnings: 0.5, wash: 0.3 } } },
          // the middle island: the market, its stalls and its crowd, a few houses heaped behind
          { x: MK[0], y: D, z: MK[2] - 6, w: 42, d: 34, cr: 10, deep: 28, cables: 24, lights: 6, gaps: [[W1[0] - MK[0], W1[2] - MK[2] + 6, 6], [H1[0] - MK[0], H1[2] - MK[2] + 6, 6]],
            heap: { peak: 3, mound: [0.1, -0.6], spread: 0.7, q: { domes: 0.2, round: 0.35, n: 16, gap: 0.6, size: [5, 8], tall: [3.6, 5.2], trees: 0.3, lit: 0.6, awnings: 0.8, wash: 0.3 }, clear: [[MK[0] - 2, MK[2] + 2, 10]] } },
          // the right: the big houses, close, the planet behind them
          { x: 24, y: D - 6, z: -36, w: 26, d: 40, cr: 8, deep: 24, cables: 18,
            heap: { peak: 6, mound: [0.3, -0.2], q: { domes: 0.15, n: 18, gap: 0, size: [6, 10], tall: [4, 6.4], trees: 0.4, lit: 0.65, awnings: 0.4, wash: 0.3 } } },
          // far left, past the high bridge
          { x: H0[0] - 16, y: H0[1], z: H0[2] - 4, w: 34, d: 30, cr: 10, deep: 24, cables: 14, detail: 0.6,
            heap: { peak: 3, q: { domes: 0.2, n: 16, gap: 0, size: [5, 9], tall: [3.6, 6], detail: 0.6 } } },
        ],
        bridges: [
          // the near walkway: from the left heap round to the market, its arch below; the high bridge to the far quarter
          [W0, W1, { w: 3.6, end: 6, mid: 1.1, hump: 0.4 }],
          [H0, [H1[0], D, H1[2]], { w: 3.6, end: 6, mid: 1.2, hump: 0.4 }],
        ],
        walkers: [[W0, W1, 6, D], [[MK[0] - 10, D, MK[2] + 4], [MK[0] + 8, D, MK[2] - 2], 22, D]],
        awnings: [[[MK[0] - 9, D + 2.6, MK[2] - 2], [MK[0] - 2, D + 2.6, MK[2] - 4], { out: 2.4, drop: 0.6, n: [0.2, 1] }], [[MK[0] + 1, D + 2.6, MK[2] - 4], [MK[0] + 8, D + 2.6, MK[2] - 2], { out: 2.4, drop: 0.6, n: [-0.2, 1] }],
          [[MK[0] - 6, D + 2.6, MK[2] + 6], [MK[0] + 2, D + 2.6, MK[2] + 6], { out: 2.4, drop: 0.6, n: [0, 1] }]],
      });
    },
  }),
];
export { SPACE_SHEETS as SHEETS, SPACE_VIEWS as VIEWS };
