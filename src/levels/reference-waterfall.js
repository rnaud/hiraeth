import * as THREE from 'three';
import { mulberry32, createNoise2D } from '../noise.js';
import { MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { put, CLEAN_SKY } from './reference-kit.js';
import {
  WATERFALL_HAZE, waterfall, cityMats, rockMass, roundHouse, stair, archBridge, copperPipe, lamp, pottedPlant, resident, travellerFigure, framed, quarter,
} from './waterfall-kit.js';

// ---------------------------------------------------------------------------
// The City Behind the Waterfall's reference sheets (references/levels/The City Behind the Waterfall/
// reference-1 … 4: four 16:9 plates). A long cavern city behind a towering curtain of water:
// terraces of rounded houses in warm pale stone, lit amber in the deep, copper pipes on the walls,
// short bridges out to openings in the water with the sunlit valley beyond; the cavern's rock in a
// deep teal shade, the falls in flat turquoise bands. One scene builder (fallScene) does the four
// plates; each is a view (reference-views.js describes the fields) framed on it.
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The City Behind the Waterfall / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/levels/The City Behind the Waterfall/environment/reference-${n}.jpeg`, import.meta.url).href });
export const WATERFALL_SHEETS = { 'waterfall-1': sheet(1), 'waterfall-2': sheet(2), 'waterfall-3': sheet(3), 'waterfall-4': sheet(4) };

/**
 * The sheets' ink: the shade printed flat in the cavern's teal (a cream house's turned side goes blue-green),
 * barely hatched, no bounce lifting the rock's undersides, a clean sky; the deep cavern fades into a teal haze in
 * stepped bands (post.js 4b).
 */
export const WATERFALL_LOOK = { ...CLEAN_SKY, uShadowFlat: 0.85, uShadeKeep: 0.15, uHalftone: 0.06, uBounce: 0, uHatch: 0.12, uLineWidth: 0.9, ...WATERFALL_HAZE };
/** sky top, sky horizon, shadow (the cavern's teal), light (warm), sun */
const SKY = {
  teal: ['#a9dcd6', '#f2ead0', '#2e6a72', '#fff2dc', '#fff3d6'],
  warm: ['#bfe3d9', '#f6e3c0', '#367078', '#fff0d8', '#ffe9c4'],
  pink: ['#e9c9c2', '#f7d9c4', '#5f7480', '#ffe2d2', '#ffd9c2'],
};
const nV = createNoise2D(4281);

/**
 * The cavern floor (y 0, its colour `floor`) and, past `edge` (-z: the falls' line), nothing: the ring ground sinks
 * out of sight under the valley's own mesh (valley()).
 */
const cavernGround = (edge = -120, floor = ['#4e7c7e', '#4a7678', '#446e72']) => ({
  height: (x, z) => (z > edge ? 0 : -500),
  material: { color: floor[0], color2: floor[1], color3: floor[2] }, rings: { r1: 2400 },
});

/** The sunlit valley seen through the falls: a plain far below with low rounded hills, in warm pale fields. */
function valley(kit, { y = -120, z0 = -200, yaw = 0, tones = ['#ecdcab', '#e2cf98', '#c9b98a'], hills = 0.6 } = {}) {
  const g = new THREE.PlaneGeometry(5000, 4000, 120, 90).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), far = Math.max(0, -z) / 2000;
    p.setY(i, (nV(x * 0.002, z * 0.002) * 60 + nV(x * 0.009, z * 0.009) * 10) * hills * far * far);
  }
  g.computeVertexNormals();
  kit.add(kit.mat({ mode: MODE_TERRAIN, color: tones[0], color2: tones[1], color3: tones[2] }), put(g.translate(0, 0, -2000), 0, y, z0, yaw), { solid: false, shadow: false });
}

/**
 * A panel's scene. o: { falls: [waterfall options…], rock: [[x, y, z, w, h, d, seed, yaw, lump]…] (the cavern's
 * masses), quarters: [{ at: [x, y, z], yaw, ...quarter options }…] (terraced slopes of houses, waterfall-kit.js
 * quarter), houses: [[x, y, z, w, h, yaw, kind, d]…], bridges: [[a, b, { w, rise }]…], stairs: [stair options…],
 * pipes: [[pts, { r, n }]…], lamps: [[x, y, z, { post, yaw }]…], plants: [[x, y, z, s]…], people: [[x, y, z, yaw,
 * basket]…], traveller: [x, z, yaw, y], valley: valley options, pools: [[x0, x1, z0, z1, y]…] }
 */
function fallScene(kit, v, o) {
  const rng = mulberry32(o.seed ?? 1), M = cityMats(kit, { shadeFlat: 0 });
  for (const f of o.falls ?? []) waterfall(kit, { ...f, seed: f.seed ?? rng() * 50 });
  for (const [x, y, z, w, h, d, seed = rng() * 99, yaw = 0, lump = 0.12] of o.rock ?? []) kit.add(M.rock, put(rockMass(seed, w, h, d, { lump }), x, y, z, yaw), { solid: true, shadow: true });
  for (const { at, yaw = 0, ...q } of o.quarters ?? []) quarter(framed(kit, at[0], at[1], at[2], yaw), M, rng, q);
  for (const [x, y, z, w, h, yaw = 0, kind = 'drum', d] of o.houses ?? []) roundHouse(kit, M, rng, { x, y, z, w, d: d ?? w, h, yaw, kind, lit: 0.4, awning: 0.4 });
  for (const [a, b, opt] of o.bridges ?? []) archBridge(kit, M, a, b, opt);
  for (const s of o.stairs ?? []) stair(kit, M, s);
  for (const [pts, opt] of o.pipes ?? []) copperPipe(kit, M, pts, opt);
  for (const [x, y, z, opt] of o.lamps ?? []) lamp(kit, M, x, y, z, opt);
  for (const [x, y, z, s = 1] of o.plants ?? []) pottedPlant(kit, M, rng, x, y, z, s);
  for (const [x, y, z, yaw = 0, basket] of o.people ?? []) resident(kit, M, rng, x, y, z, { yaw, basket });
  if (o.traveller) travellerFigure(kit, o.traveller[0], o.traveller[3] ?? 0, o.traveller[1], { yaw: o.traveller[2] ?? 0 });
  if (o.valley) valley(kit, o.valley);
  for (const [x0, x1, z0, z1, y] of o.pools ?? []) {
    kit.mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2),
      kit.mat({ color: '#4fb3b0', color2: '#8fdcd2', mode: MODE_WATER }), { solid: false, shadow: false });
  }
  o.extra?.(kit, M, rng);
}

const view = (o) => ({ sky: SKY.teal, look: WATERFALL_LOOK, fog: 0.3, ground: cavernGround(o.edge, o.floor), world: 'The City Behind the Waterfall', ...o });
const DARK_TEAL = { deep: '#2f6f78', mid: '#4f9ea4', pale: '#86cbc8' };

export const WATERFALL_VIEWS = [
  // ===================================================================== reference-1: the arch bridge, the falls beyond
  view({
    id: 'waterfall-1-arch', title: 'The arched bridge, the falls and the valley through them', sheet: 'waterfall-1', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.84 },
    sun: { side: 115, el: 17 },
    edge: -170,
    build(kit, v) {
      fallScene(kit, v, {
        seed: 1001,
        falls: [
          { at: [44, -2, -120], w: 26, h: 230, bow: 1.5, lean: 2, column: 2.2, gaps: 0.04, mist: 12 },
          { at: [78, -2, -112], w: 44, h: 230, bow: 2, lean: 2, column: 3.0, gaps: 0.03, mist: 12, tones: { deep: '#3a8590', mid: '#5fb9bf', pale: '#9ad8d4' } },
          { at: [24, -60, -250], w: 22, h: 300, column: 2.0, gaps: 0.03, mist: 0 },
          { at: [-14, -60, -270], w: 26, h: 300, column: 2.0, gaps: 0.05, mist: 0, tones: { deep: '#5aa0a8', mid: '#8ccfd0', pale: '#bfe9e4' } },
        ],
        valley: { y: -140, z0: -280 },
        rock: [
          // the roof, its blocks hanging lower toward the middle
          [0, 128, -140, 320, 60, 320, 3, 0, 0.1], [-6, 88, -150, 70, 50, 60, 5], [30, 84, -80, 50, 50, 50, 9], [4, 80, -200, 50, 50, 40, 7], [-40, 92, -60, 60, 40, 60, 8],
          // the wall on the right, near, and its stepped base
          [74, 50, -36, 40, 130, 70, 11], [56, 2, -22, 22, 6, 40, 13, 0, 0.04], [62, 7, -6, 16, 8, 30, 17, 0, 0.04],
          // behind the city on the left, and the far wall
          [-150, 50, -120, 120, 200, 300, 19], [10, 40, -330, 400, 200, 40, 21],
        ],
        quarters: [
          // the city climbing the left wall, its fronts toward the falls
          { at: [-24, 0, -26], yaw: Math.PI / 2 - 0.3, x0: 0, x1: 110, n: 10, rise: 6, step: 7, shrink: 3, lit: 0.5, people: 0.06, pipes: 0.4, lamps: 0.6 },
          // beyond the arch: the low quarter by the falls
          { at: [-6, 0, -150], yaw: 0, x0: 0, x1: 40, n: 3, rise: 9, step: 10, shrink: 4, lit: 0.4, people: 0.05, h: [5, 10] },
        ],
        houses: [[2, 30, -112, 12, 9, 0.3, 'drum'], [-8, 30, -106, 9, 7, 0, 'drum'], [-2, 40, -114, 8, 6, 0, 'drum'], [14, 0, -122, 14, 12, 0.3, 'drum']],
        bridges: [[[-44, 30, -98], [14, 30, -108], { w: 7, rise: 24, thick: 2.4 }], [[24, 14, -118], [36, 15, -118], { w: 2.2 }], [[24, 30, -126], [38, 31, -126], { w: 2.2 }]],
        stairs: [{ x: 40, z: -8, y0: 0, y1: 7, w: 12, yaw: 1.35 }, { x: -12, z: -2, y0: 0, y1: 2.4, w: 10, yaw: -1.2 }],
        pipes: [
          [[[50, 70, -18], [42, 60, -8], [24, 60, 4]], { r: 1.0, n: 1 }],
          [[[60, 6, -40], [60, 40, -40], [54, 52, -40]], { r: 0.45, n: 2, side: [0, 0, 1] }],
        ],
        lamps: [[44, 8.5, -14, { yaw: -1.57 }]],
        plants: [[44, 6.8, -8, 1.8], [48, 6.8, -16, 1.6], [-10, 2.4, -4, 1.3]],
        people: [[-4, 0, -22, 0.4, true], [3, 0, -30, 2], [-8, 0, -40, 1]],
        traveller: [11, -7, Math.PI + 0.3, 0],
      });
    },
  }),
  // ===================================================================== reference-2: the terraces of domes by the great fall
  view({
    id: 'waterfall-2-terraces', title: 'The terraces of domes beside the great fall', sheet: 'waterfall-2', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 58, horizon: 0.86 },
    sun: { side: 75, el: 16 },
    sky: SKY.warm,
    edge: -200,
    floor: ['#4f7f82', '#4a7a7d', '#456f72'],
    build(kit, v) {
      fallScene(kit, v, {
        seed: 2002,
        falls: [
          { at: [40, -2, -96], w: 46, h: 240, bow: 3, lean: 3, column: 2.2, gaps: 0.03, mist: 14 },
          { at: [-8, -2, -190], w: 14, h: 110, column: 1.6, gaps: 0.06, mist: 6, tones: DARK_TEAL },
          { at: [8, -2, -196], w: 9, h: 110, column: 1.6, gaps: 0.06, mist: 6, tones: DARK_TEAL },
        ],
        valley: { y: -100, z0: -400 },
        rock: [
          [-10, 130, -100, 320, 70, 210, 21, 0, 0.1], [-46, 70, -205, 110, 150, 30, 25], [36, 70, -205, 44, 150, 30, 27],
          [-6, 116, -205, 40, 50, 30, 23], [-4, 28, -205, 20, 40, 30, 24], [-10, 90, -150, 40, 40, 60, 22],
          [70, 50, -30, 44, 140, 70, 29], [54, 6, -46, 16, 12, 30, 31, 0, 0.04],
        ],
        quarters: [
          { at: [-30, 0, -40], yaw: 0.85, x0: -40, x1: 110, n: 11, rise: 6, step: 8, shrink: 2, lit: 0.55, people: 0.07, awning: 0.55, lamps: 0.6, pipes: 0.2 },
          { at: [-34, 0, -176], yaw: 0, x0: 0, x1: 30, n: 1, lit: 0.5, h: [3, 5] },
        ],
        bridges: [[[-18, 12, -170], [22, 12, -172], { w: 4, rise: 8 }]],
        stairs: [{ x: 50, z: -26, y0: 0, y1: 16, w: 6, yaw: 1.2 }],
        pipes: [[[[50, 80, -18], [50, 40, -18], [58, 30, -18], [58, 8, -28]], { r: 1.0, n: 3, side: [0, 0, 1] }]],
        lamps: [[54, 10, -24, { yaw: -1.57 }], [50, 16, -34, { yaw: -1.57 }]],
        plants: [[46, 0, -12, 1.6]],
        people: [[42, 4, -30, 1.2], [45, 7, -31, 1.2, true], [48, 10, -32, 1.2], [-8, 0, -24, 0.4, true]],
        pools: [[-60, -6, -30, -14, 0.06]],
        traveller: [5, -9, Math.PI - 0.2, 0],
      });
    },
  }),
  // ===================================================================== reference-3: the sunlit street, the falls on the left
  view({
    id: 'waterfall-3-street', title: 'The sunlit street along the falls, the arch to the valley', sheet: 'waterfall-3', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 58, horizon: 0.88 },
    sun: { side: -80, el: 24 },
    edge: -400,
    floor: ['#b7d6d0', '#b2d2cc', '#a8c8c2'],
    build(kit, v) {
      fallScene(kit, v, {
        seed: 3003,
        falls: [
          { at: [-74, -6, -96], w: 60, h: 220, yaw: 0.8, bow: 3, lean: 3, column: 2.6, gaps: 0.12, mist: 8 },
          { at: [-26, -6, -150], w: 50, h: 240, yaw: 0.5, column: 2.2, gaps: 0.1, mist: 8, tones: { deep: '#4a96a0', mid: '#77c8ca', pale: '#ace6de' } },
        ],
        valley: { y: -110, z0: -120, yaw: 0.9, tones: ['#f2e4b0', '#ead79c', '#d5c592'] },
        rock: [[40, 118, -90, 220, 60, 220, 41, 0, 0.12], [64, 60, -50, 40, 120, 70, 43]],
        quarters: [
          { at: [-18, 0, -130], yaw: -1.28, x0: 0, x1: 130, n: 7, rise: 7, step: 8, shrink: 0, lit: 0.35, people: 0.06, lamps: 0.7, awning: 0.5, pipes: 0.3, front0: false },
        ],
        bridges: [[[-46, 2, -96], [-14, 2, -84], { w: 2.4 }]],
        pipes: [[[[60, 84, -40], [34, 74, -40], [30, 40, -46]], { r: 0.7, n: 2, side: [0, 0, 1] }]],
        lamps: [[6, 4.2, -26, { post: true }], [4, 4.2, -48, { post: true }], [2, 4.2, -70, { post: true }]],
        people: [[6, 0, -14, 0.2], [2, 0, -24, 2.5, true], [-2, 0, -36, 0.8]],
        traveller: [7, -5, -0.7, 0],
      });
    },
  }),
  // ===================================================================== reference-4: the pink hour, the falls and the city's slope
  view({
    id: 'waterfall-4-pink', title: 'The city’s slope at the pink hour, the arch in the falls', sheet: 'waterfall-4', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.88 },
    sun: { side: -110, el: 20 },
    sky: SKY.pink,
    edge: -400,
    floor: ['#e8c4b4', '#e2beae', '#d6b2a4'],
    build(kit, v) {
      fallScene(kit, v, {
        seed: 4004,
        falls: [
          { at: [-62, -6, -76], w: 50, h: 220, yaw: 0.45, bow: 3, column: 3.0, gaps: 0.04, mist: 8 },
          { at: [-6, -6, -170], w: 46, h: 260, column: 2.6, gaps: 0.04, mist: 8, tones: DARK_TEAL },
          { at: [40, -6, -230], w: 60, h: 260, column: 2.6, gaps: 0.04, mist: 8, tones: { deep: '#4f9ea4', mid: '#7cc6c8', pale: '#ace0dc' } },
        ],
        valley: { y: -90, z0: -160, tones: ['#f2c8b4', '#ecc0ae', '#dcb0a2'] },
        rock: [[20, 120, -120, 260, 60, 260, 51, 0, 0.12], [42, 40, -16, 16, 140, 26, 53, 0, 0.06], [70, 40, -60, 30, 140, 40, 55]],
        quarters: [
          { at: [-8, 0, -34], yaw: -0.52, x0: 0, x1: 80, n: 9, rise: 7, step: 7.5, shrink: 3, lit: 0.5, people: 0.05, lamps: 0.6, pipes: 0.3 },
        ],
        bridges: [[[-60, -1, -70], [-28, -1, -60], { w: 2.2 }]],
        pipes: [[[[36, 70, -10], [36, 20, -10], [32, 8, -6]], { r: 0.7, n: 2, side: [1, 0, 0] }]],
        lamps: [[34, 6, -6, { yaw: -1.57 }], [12, 3.8, -30, { post: true }]],
        people: [[30, 0, -6, -1.2, true]],
        pools: [[-90, -26, -80, -36, -1.6]],
        traveller: [11, -6, 0.3, 0],
      });
    },
  }),
];

export { WATERFALL_SHEETS as SHEETS, WATERFALL_VIEWS as VIEWS };
