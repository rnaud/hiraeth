import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { CLEAN_SKY, n1, n2 } from './reference-kit.js';
import { put } from './lab-kit.js';
import {
  eclipseMats, eclipseUniforms, house, terrace, stairFlight, table, lantern, resident, awning, poleCloth, flowerBox, paleFigure, laundry, farQuarter,
  traveller, antennaPole, roofClutter, ECLIPSE_LOOK, ECLIPSE_TOTAL, ECL_TONES,
} from './eclipse-kit.js';

// ---------------------------------------------------------------------------
// The City During the Eclipse's reference pictures (references/The City During the Eclipse/reference-1 … 4):
// a city of limewashed houses, domes and round towers on terraces round great stairs, at midday under a total
// eclipse: the moon's black disc ringed with light over the roofs, its corona in fine rays or a stipple, the sky a
// deep blue banded rose at the horizon; the walls a cold lavender, the lamps lit, people eating at tables outside
// in their warm pools, pale figures leaning out from the walls, washing and awnings, boxes of violet flowers, the
// traveller crossing the foreground with his lantern pack. Each picture is one composition: one view each. One
// scene builder (cityScene) does them all (reference-views.js describes the fields).
//
// The eclipse stands where the picture has it (look.uEclipseDir, eclipseAt: so many degrees beside and over the
// line of sight), apart from the view's sun, which lights the city from high up (the whole sky's glow).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The City During the Eclipse / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The City During the Eclipse/reference-${n}.jpeg`, import.meta.url).href });
export const ECLIPSE_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`eclipse-${n}`, sheet(n)]));

/** sky top, horizon, shadow (the deep violet of the shade), light (the cold lavender of the lit limewash), sun */
const SKY = {
  total: ECLIPSE_TOTAL,
  blue: ['#4a6cb2', '#6088cc', '#38386a', '#8c9cf0', '#fff2e0'],
  deep: ['#1a2c58', '#4a62a4', '#3a3670', '#9a90e2', '#fff2e0'],
  night: ['#06182c', '#3a4a7a', '#2e2c58', '#8a80c8', '#fff2e0'],
  steel: ['#2a4470', '#5c76b0', '#3c3a6c', '#a49ae0', '#fff2e0'],
};

// (references.js's sun: up from 6 to 18, at most 62° high, from azimuth 30° round to 210°; the view's group turned so it stands `side` of the line of sight)
const DEG = Math.PI / 180;
const sunAz = (el) => 30 + (Math.asin(Math.min(el, 61.99) / 62) / Math.PI) * 180;
/**
 * The world direction of a point of the sky `side` deg right of a view's line of sight and `el` deg up, once the view
 * is turned for its sun (references.js sunTurn): where its eclipse is drawn (post.js uEclipseDir).
 */
export function eclipseAt(view, side, el) {
  const yaw = view.camera.yaw ?? 0, a = (sunAz(view.sun.el) + view.sun.side - 180 + yaw) * DEG, th = (yaw + side) * DEG, e = el * DEG;
  const d = new THREE.Vector3(Math.sin(th) * Math.cos(e), Math.sin(e), -Math.cos(th) * Math.cos(e)).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
  return d.toArray().map((x) => +x.toFixed(5));
}

const NC = { solid: false, shadow: false };

/**
 * A picture's scene. o: { seed, paving: [[x0, x1, z0, z1, y]…] (flagstones), terraces: [terrace options…],
 * stairs: [stairFlight options…], houses: [house options…], tables: [[x, y, z, { yaw, seats }]…], lamps: [[x, y, z,
 * { kind, h, yaw }]…], figures: [[x, y, z, { pose, yaw, s }]…] (the pale figures), awnings: [[A, B, opts]…],
 * poles: [[P, Q, opts]…], flowers: [[x, y, z, { w, yaw }]…], washing: [[A, B, opts]…], people: [[x, y, z, opts]…],
 * crowd: { n, x0, x1, z0, z1, y }, far: [farQuarter options…], antennas: [[x, y, z, h]…], roofs: [[x0, x1, z0, z1, y]…]
 * (rooftop clutter), traveller: [x, z, yaw, y], extra(kit, M, rng) }
 */
function cityScene(kit, v, o) {
  const M = eclipseMats(kit), rng = mulberry32(o.seed ?? 1);
  for (const [x0, x1, z0, z1, y = 0] of o.paving ?? []) kit.add(M.paving, new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0).translate((x0 + x1) / 2, y - 0.13, (z0 + z1) / 2), { solid: true, shadow: true });
  for (const t of o.terraces ?? []) terrace(kit, M, t);
  for (const s of o.stairs ?? []) stairFlight(kit, M, s);
  for (const h of o.houses ?? []) house(kit, M, rng, h);
  for (const [x, y, z, op] of o.tables ?? []) table(kit, M, rng, x, y, z, op);
  for (const [x, y, z, op] of o.lamps ?? []) lantern(kit, M, x, y, z, op);
  for (const [x, y, z, op] of o.figures ?? []) paleFigure(kit, M, rng, x, y, z, op);
  for (const [A, B, op] of o.awnings ?? []) awning(kit, M, rng, A, B, op);
  for (const [P, Q, op] of o.poles ?? []) poleCloth(kit, M, rng, P, Q, op);
  for (const [x, y, z, op] of o.flowers ?? []) flowerBox(kit, M, rng, x, y, z, op);
  for (const [A, B, op] of o.washing ?? []) laundry(kit, M, rng, A, B, op);
  for (const [x, y, z, op] of o.people ?? []) resident(kit, M, rng, x, y, z, op);
  if (o.crowd) for (let i = 0; i < o.crowd.n; i++) {
    const c = o.crowd, x = c.x0 + rng() * (c.x1 - c.x0), z = c.z0 + rng() * (c.z1 - c.z0);
    resident(kit, M, rng, x, c.y ?? 0, z, {});
  }
  for (const f of o.far ?? []) farQuarter(kit, M, rng, f);
  for (const [x, y, z, h] of o.antennas ?? []) antennaPole(kit, M, rng, x, y, z, h);
  for (const [x0, x1, z0, z1, y, seed = x0 * 7 + z0] of o.roofs ?? []) roofClutter(kit, M, seed, x0, x1, z0, z1, y);
  if (o.traveller) traveller(kit, M, o.traveller[0], o.traveller[3] ?? 0, o.traveller[1], o.traveller[2] ?? 0);
  o.extra?.(kit, M, rng);
}

/** The ground: the plaza's level, the land falling away past `edge` (-z) to the far city's plain `low` m down. */
const cityGround = ({ edge = -400, low = -12, drop = 60 } = {}) => ({
  height: (x, z) => {
    const t = Math.min(1, Math.max(0, (edge - z) / drop));
    return low * t * t * (3 - 2 * t) + 0.04 * n1(x * 0.2, z * 0.2) + 0.02 * n2(x * 0.7, z * 0.7);
  },
  material: { color: ECL_TONES.paving, color2: '#dcdcf0', color3: '#d4d2ec' }, rings: { r1: 2400 },
});

/** A view held in totality: the eclipse (its disc, its corona) where the picture has it, the city's ink. */
const view = (o) => {
  const v = { sky: SKY.total, fog: 0.5, world: 'The City During the Eclipse', ground: cityGround(o.groundAt), ...o };
  v.look = { ...ECLIPSE_LOOK, ...CLEAN_SKY, ...eclipseUniforms({ ...o.eclipse, dir: eclipseAt(v, o.eclipse.side, o.eclipse.el) }), ...(o.look ?? {}) };
  return v;
};

export const ECLIPSE_VIEWS = [
  view({
    id: 'eclipse-1-stair', title: 'The square under the eclipse: the tables by the walls, the great stair, the round tower', sheet: 'eclipse-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.1, 0], yaw: 0, fov: 56, horizon: 0.68 }, sky: SKY.blue,
    sun: { side: -35, el: 52 },
    eclipse: { side: -3.4, el: 26, size: 5.4, reach: 0.32, style: 0, corona: '#e8eeff', stars: 0, glowH: 0 },
    build(kit, v) {
      cityScene(kit, v, {
        seed: 61001,
        traveller: [5.2, -9.6, 0.15],
        paving: [[-30, 30, -40, 6]],
        // the left: the great wall of the lower city, a door at its foot, the tables along it, the pale figures over them
        terraces: [
          { x0: -40, x1: -8.5, z0: -60, z1: 4, y: 6.4, below: 0, parapet: 0.9 },
          { x0: -40, x1: -13, z0: -60, z1: -6, y: 11, below: 6.4, parapet: 0.9 },
          // behind the stair: the upper city's terrace, its wall with doors and lamps
          { x0: -9.5, x1: 9, z0: -70, z1: -29.8, y: 4.8, below: 0, parapet: 0.9, gaps: [[-9.6, -4]] },
          { x0: -9.5, x1: 9, z0: -70, z1: -46, y: 8.4, below: 4.8, parapet: 0.9 },
          { x0: 9, x1: 40, z0: -70, z1: -18, y: 4.4, below: 0, parapet: 0.9 },
        ],
        stairs: [{ x: -3.4, z: -17, y0: 0, y1: 4.8, w: 4.8, yaw: 0.22, rise: 0.22, run: 0.55, cheek: 0.7 }],
        houses: [
          // the door at the near left
          { x: -11, y: 0, z: 1, w: 6, d: 6, h: 6.4, kind: 'block', roof: 'none', doors: 1, windows: 0, lit: 0, wood: 1, yaw: Math.PI / 2, cr: 0.3 },
          // up on the left: a dome-topped round tower, a drum, houses along the terraces
          { x: -19, y: 11, z: -14, w: 9, h: 5, kind: 'drum', roof: 'dome', k: 0.75, doors: 0, windows: 2, sides: 1 },
          { x: -12, y: 6.4, z: -1, w: 5, d: 5, h: 3.4, kind: 'block', roof: 'flat', doors: 1, windows: 1, flowers: 1 },
          { x: -12.5, y: 6.4, z: -22, w: 6, d: 6, h: 3.6, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.6 },
          { x: -18, y: 11, z: -28, w: 7, d: 7, h: 4, kind: 'block', roof: 'dome', doors: 1, windows: 2 },
          { x: -16, y: 11, z: -38, w: 6, h: 6, kind: 'drum', roof: 'dome', k: 0.8, doors: 1, windows: 1 },
          { x: -22, y: 11, z: 0, w: 8, h: 6, kind: 'drum', roof: 'dome', k: 0.7, doors: 0, windows: 1 },
          // the middle: the upper city over the stair
          { x: -6, y: 8.4, z: -52, w: 8, d: 7, h: 5, kind: 'block', roof: 'dome', k: 0.6, doors: 1, windows: 3 },
          { x: 5, y: 4.8, z: -34, w: 6, d: 5, h: 3.4, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.6, flowers: 1 },
          { x: -1, y: 4.8, z: -36, w: 5, d: 5, h: 3.6, kind: 'block', roof: 'flat', doors: 1, windows: 1, lit: 0.6 },
          { x: 3, y: 8.4, z: -50, w: 6, h: 5, kind: 'drum', roof: 'dome', doors: 1, windows: 2 },
          { x: 13, y: 4.4, z: -50, w: 7, h: 10, kind: 'tower', roof: 'dome', k: 0.9, doors: 1, windows: 3, mat: 'tower' },
          { x: -2, y: 8.4, z: -62, w: 10, d: 8, h: 5, kind: 'block', roof: 'flat', doors: 1, windows: 4 },
          // the right: the great round tower over the street, the domed house behind it
          { x: 16.5, y: 0, z: -24, w: 12.5, h: 9, kind: 'tower', roof: 'flat', doors: 0, windows: 3, lit: 0.7, flowers: 1, mat: 'tower' },
          { x: 25, y: 4.4, z: -32, w: 13, d: 12, h: 9, kind: 'block', roof: 'dome', k: 0.75, doors: 0, windows: 3 },
          { x: 12.6, y: 0, z: -9, w: 8, d: 4, h: 4.4, kind: 'block', roof: 'flat', doors: 2, windows: 1, lit: 0.7, yaw: -Math.PI / 2 },
        ],
        tables: [
          [-6.8, 0, -4, { yaw: Math.PI / 2, seats: 3 }], [-6.6, 0, -8.5, { yaw: Math.PI / 2, seats: 4 }], [-5.8, 0, -13, { yaw: Math.PI / 2, seats: 3 }],
          [7.6, 0, -12.5, { yaw: -Math.PI / 2, seats: 3 }], [8, 0, -16.5, { yaw: -Math.PI / 2, seats: 4 }], [7.2, 0, -21, { yaw: -Math.PI / 2, seats: 2 }],
          [3.5, 0, -25, { yaw: 0, seats: 3 }],
        ],
        lamps: [[-8.2, 2.2, -2, { kind: 'hang', yaw: Math.PI / 2 }], [-8.2, 2.2, -11, { kind: 'hang', yaw: Math.PI / 2 }], [1.5, 0, -27.6, { kind: 'big', s: 0.8 }], [5, 2.3, -28.4, { kind: 'hang' }],
          [-6.5, 0, -27, { kind: 'big', s: 0.7 }], [10.2, 2.4, -14, { kind: 'hang', yaw: -Math.PI / 2 }], [-12, 7.6, -14, { kind: 'globe' }], [2, 5.7, -31, { kind: 'globe' }]],
        figures: [[-8.7, 3.6, -3.6, { pose: 'lean', yaw: Math.PI / 2, s: 1.2 }], [-8.7, 4, -7.4, { pose: 'lean', yaw: Math.PI / 2, s: 1.3 }], [-8.7, 3.4, -11.5, { pose: 'lean', yaw: Math.PI / 2, s: 1.1 }],
          [-8.7, 6.4, -16, { pose: 'hang', yaw: Math.PI / 2 }], [-8.7, 6.4, -19.5, { pose: 'hang', yaw: Math.PI / 2, s: 0.9 }], [-13, 11, -9, { pose: 'hang', yaw: Math.PI / 2, s: 0.9 }],
          [-4.8, 0, -11, { pose: 'stand', yaw: 0.5, s: 0.85 }], [-1, 4.8, -32, { pose: 'stand', yaw: 0.2, s: 0.8 }], [2.4, 5.7, -29.9, { pose: 'hang', yaw: 0, s: 0.7 }]],
        awnings: [[[10.4, 3.4, -11], [10.4, 3.4, -20], { out: 2.8, drop: 0.8, n: [-1, 0] }], [[-8.6, 3.2, -1], [-8.6, 3.2, -7], { out: 2.2, drop: 0.7, n: [1, 0] }]],
        poles: [[[-16, 6.4, -4], [-12, 6.4, -18], { h: 4, sag: 1.4 }], [[-22, 11, -20], [-14, 11, -32], { h: 4, sag: 1.2 }], [[0, 4.8, -40], [8, 4.8, -32], { h: 4, sag: 1.2 }], [[-6, 4.8, -44], [-12, 4.8, -40], { h: 4, sag: 1 }], [[10, 4.4, -40], [22, 4.4, -46], { h: 4, sag: 1.2 }]],
        flowers: [[-10.2, 7.3, -3, { w: 3, yaw: Math.PI / 2 }], [-10.2, 7.3, -9, { w: 4, yaw: Math.PI / 2 }], [-14.5, 11.9, -12, { w: 4, yaw: Math.PI / 2 }], [-14.5, 11.9, -22, { w: 4, yaw: Math.PI / 2 }], [8, 5.7, -30.6, { w: 3 }], [-6.5, 5.7, -30.6, { w: 2.5 }], [20, 5.3, -18.5, { w: 4 }]],
        washing: [[[-8.4, 4, -12], [-8.4, 4.6, -18], { n: 4 }], [[8.6, 4.6, -19], [10, 5, -26], { n: 4 }]],
        people: [[-0.6, 0, -12, { yaw: 0.2, s: 0.75 }], [-0.4, 0, -21, { yaw: 0 }], [-3.6, 2.2, -22, { yaw: 0.3 }], [-5.5, 4, -28, {}], [6, 0, -18, {}], [-12, 6.4, -6, {}], [-15, 11, -20, {}]],
        antennas: [[-6, 13.4, -52, 5], [5, 8.2, -34, 3], [-12.5, 10, -22, 4], [-2, 13.9, -62, 6], [12, 7.4, -42, 5], [-24, 11, -10, 6]],
        roofs: [[-6, 2, -66, -58, 13.9]],
        far: [{ x0: -60, x1: 60, z0: -150, z1: -80, n: 40, y: 8.4, size: [6, 12] }],
      });
    },
  }),
  view({
    id: 'eclipse-2-terraces', title: 'From the top of the steps: the stair down to the far city, the terraces climbing on the left', sheet: 'eclipse-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 4.2, 0], yaw: 0, fov: 50, horizon: 0.5 }, sky: SKY.deep,
    sun: { side: 20, el: 55 },
    eclipse: { side: 0.5, el: 14, size: 5.7, reach: 0.55, style: 1, corona: '#ffd2b8', stars: 0.15 }, look: { uHaze: [0.82, 0.64, 0.82, 0.75], uHazeTone: [0.8, 0.62, 0.8, 0.85] },
    groundAt: { edge: -52, low: -5, drop: 40 },
    build(kit, v) {
      cityScene(kit, v, {
        seed: 61002,
        traveller: [2.6, -10.5, 0.05, 0],
        paving: [[-12, 18, -34, 6]],
        terraces: [
          // the left: terraces stepping up and back, their stairs, the tower at the top
          { x0: -40, x1: -9, z0: -40, z1: 4, y: 3.2, below: 0, parapet: 0.9 },
          { x0: -40, x1: -14, z0: -50, z1: -8, y: 8.5, below: 3.2, parapet: 0.9 },
          { x0: -46, x1: -20, z0: -60, z1: -24, y: 15, below: 8.5, parapet: 0.9 },
          // the right: the terrace of the dining houses, its wall
          { x0: 12, x1: 50, z0: -60, z1: -10, y: 2.4, below: 0, parapet: 0.9 },
          // the landing at the stair's head, its parapet over the drop
          { x0: -9, x1: 13, z0: -50, z1: -36, y: 3.2, below: -6, parapet: 0 },
        ],
        stairs: [
          { x: 2, z: -22, y0: 0, y1: 3.2, w: 8, rise: 0.16, run: 0.7, cheek: 0.5 },
          { x: -8, z: -8, y0: 0, y1: 3.2, w: 3, yaw: Math.PI / 2.4, rise: 0.25, run: 0.42 },
          { x: -14.5, z: -14, y0: 3.2, y1: 8.5, w: 3, yaw: Math.PI / 2.6, rise: 0.25, run: 0.42 },
          // the right foreground: steps going down off the square
          { x: 16, z: 3, y0: -3, y1: 0, w: 8, yaw: Math.PI * 0.8, rise: 0.3, run: 0.5, cheeks: [false, false], base: -3 },
        ],
        houses: [
          { x: -16, y: 3.2, z: -4, w: 6, d: 6, h: 4.5, kind: 'block', roof: 'flat', doors: 1, windows: 1, lit: 0.6, flowers: 1 },
          { x: -14, y: 3.2, z: -20, w: 5, d: 5, h: 4, kind: 'block', roof: 'flat', doors: 1, windows: 1, lit: 0.7 },
          { x: -22, y: 8.5, z: -16, w: 7, d: 6, h: 5, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.5, flowers: 1 },
          { x: -26, y: 15, z: -32, w: 7, h: 18, kind: 'tower', roof: 'flat', doors: 0, windows: 4 },
          { x: -18, y: 8.5, z: -36, w: 6, d: 6, h: 5, kind: 'block', roof: 'dome', doors: 1, windows: 1 },
          { x: 22, y: 2.4, z: -24, w: 7, d: 6, h: 4.5, kind: 'block', roof: 'flat', doors: 2, windows: 2, lit: 0.7, yaw: -Math.PI / 2 },
          { x: 28, y: 2.4, z: -38, w: 16, h: 9, kind: 'drum', roof: 'dome', k: 0.75, doors: 1, windows: 4 },
          { x: 24, y: 2.4, z: -12, w: 7, d: 6, h: 5, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.6, yaw: -Math.PI / 2 },
          { x: 16, y: -5, z: -150, w: 7, h: 22, kind: 'tower', roof: 'dome', k: 1.1, doors: 0, windows: 2 },
        ],
        tables: [[-6.5, 0, -6, { yaw: 0.3, seats: 3 }], [9.5, 2.4, -18, { yaw: -Math.PI / 2, seats: 4 }], [10, 2.4, -22.5, { yaw: -Math.PI / 2, seats: 3 }], [-11, 3.2, -12, { yaw: 1, seats: 2 }]],
        lamps: [[-8.6, 0, -4, { kind: 'big', s: 0.8 }], [-9.2, 3.2, -14, { kind: 'big', s: 0.6 }], [-12.4, 5.5, -2, { kind: 'hang', yaw: Math.PI / 2 }], [12.6, 2.4, -16, { kind: 'big', s: 0.7 }], [13.5, 2.4, -21, { kind: 'big', s: 0.7 }],
          [-1, 0, -24, { kind: 'big', s: 0.6 }], [-7.4, 2.4, -16, { kind: 'globe' }], [16, 2.4, -26, { kind: 'big', s: 0.6 }]],
        figures: [[-9, 0.6, -3, { pose: 'stand', yaw: 0.6, s: 1 }], [-11.2, 4.2, -8, { pose: 'lean', yaw: Math.PI / 2 }], [-14.2, 9.4, -6, { pose: 'hang', yaw: Math.PI / 2 }], [1.5, 3.2, -42, { pose: 'stand', yaw: 0, s: 0.8 }]],
        awnings: [[[13, 5.5, -14], [13, 5.5, -24], { out: 3, drop: 1, n: [-1, 0], mat: null }]],
        flowers: [[-11, 4.1, 0, { w: 3, yaw: Math.PI / 2 }], [-15, 9.4, -2, { w: 4, yaw: Math.PI / 2 }], [-21, 15.9, -12, { w: 5, yaw: Math.PI / 2 }], [-18, 9.4, -26, { w: 3 }]],
        washing: [[[-12.6, 6.5, -4], [-12.6, 7, -10], { n: 3 }]],
        people: [[-6, 0, -14, { yaw: 0.3 }], [-4, 1.2, -18, {}], [-14, 3.2, -10, {}], [-1, 3.2, -42, {}], [6, 3.2, -44, {}]],
        crowd: { n: 6, x0: -6, x1: 10, z0: -38, z1: -48, y: 3.2 },
        // the far city past the stair, low on the plain to the horizon
        far: [{ x0: -200, x1: 200, z0: -420, z1: -80, n: 420, H: (x, z) => v.ground.height(x, z), size: [6, 14], tall: [4, 14], lit: 0.2, domes: 0.45, towers: 0.05 }],
      });
    },
  }),
  view({
    id: 'eclipse-3-bowl', title: 'The terraces round the bowl, the tables in the square, the stars out at midday', sheet: 'eclipse-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 55, horizon: 0.58 }, sky: SKY.night,
    sun: { side: 150, el: 48 },
    eclipse: { side: 1, el: 24, size: 8.2, reach: 0.5, style: 1, corona: '#e4ecff', stars: 1, glow: '#dab0c8', glowH: 0.08 },
    build(kit, v) {
      const tiers = [];
      // the bowl: rows of terraces climbing away round the square, the central stair up the middle
      for (let i = 0; i < 7; i++) tiers.push({ x0: -60 + i * 2, x1: 60 - i * 2, z0: -36 - (i + 1) * 5.5, z1: -36 - i * 5.5, y: 1.8 * (i + 1), below: 1.8 * i, parapet: 0.6, gaps: [[-4, 2]] });
      cityScene(kit, v, {
        seed: 61003,
        traveller: [4.4, -3.6, 0.2],
        paving: [[-30, 30, -36, 4]],
        terraces: tiers,
        stairs: [{ x: -1, z: -36, y0: 0, y1: 12.6, w: 5.5, rise: 0.3, run: 0.62, cheek: 0.5 }],
        houses: [
          { x: -15, y: 0, z: -4, w: 9, d: 7, h: 8, kind: 'block', roof: 'flat', doors: 1, windows: 1, lit: 0.9, yaw: Math.PI / 2 },
          { x: 40, y: 0, z: -58, w: 30, h: 13, kind: 'drum', roof: 'dome', k: 0.85, doors: 3, windows: 7, lit: 0.6 },
          { x: 16, y: 0, z: -12, w: 8, d: 6, h: 5, kind: 'block', roof: 'flat', doors: 1, windows: 1, lit: 0.8, yaw: -Math.PI / 2 },
          { x: -32, y: 12.6, z: -86, w: 22, d: 14, h: 6, kind: 'block', roof: 'flat', doors: 2, windows: 3 },
          { x: -48, y: 12.6, z: -84, w: 14, h: 6, kind: 'drum', roof: 'flat', doors: 1, windows: 2 },
          { x: 4, y: 12.6, z: -90, w: 16, d: 10, h: 4, kind: 'block', roof: 'flat', doors: 2, windows: 3 },
        ],
        tables: [[-7, 0, -12, { yaw: 0.1, seats: 5, w: 2.8 }], [-3, 0, -17, { yaw: 0, seats: 4 }], [5, 0, -22, { yaw: 0, seats: 4 }], [12, 0, -24, { yaw: -0.3, seats: 4 }], [-12, 0, -24, { yaw: 0.2, seats: 3 }], [20, 0, -30, { seats: 3 }]],
        lamps: [[-10.6, 0, -10.6, { kind: 'big', s: 1.1 }], [-4.8, 0, -15, { kind: 'big', s: 1 }], [9, 0, -8, { kind: 'big', s: 1.1 }], [-1, 1.8, -42, { kind: 'globe' }], [14, 1.8, -42, { kind: 'globe' }], [-20, 3.6, -47, { kind: 'globe' }],
          [26, 5.4, -52, { kind: 'globe' }], [-30, 7.2, -58, { kind: 'globe' }], [4, 9, -64, { kind: 'globe' }], [-10, 10.8, -69, { kind: 'globe' }]],
        figures: [[-24, 3.6, -41.6, { pose: 'hang', yaw: 0 }], [-14, 5.4, -47, { pose: 'hang', yaw: 0 }], [10, 7.2, -52.5, { pose: 'hang', yaw: 0 }], [22, 5.4, -47, { pose: 'hang', yaw: 0 }], [30, 9, -58, { pose: 'hang', yaw: 0 }],
          [-36, 7.2, -52.5, { pose: 'hang', yaw: 0 }], [6, 3.6, -41.6, { pose: 'hang', yaw: 0 }], [-6, 9, -58, { pose: 'hang', yaw: 0 }], [16, 10.8, -63.5, { pose: 'hang', yaw: 0 }], [-20, 10.8, -63.5, { pose: 'hang', yaw: 0 }],
          [-13, 0, -30, { pose: 'stand', yaw: 0.4, s: 0.9 }], [8, 0, -32, { pose: 'stand', yaw: -0.3, s: 0.9 }]],
        flowers: [[-12, 8.4, 0, { w: 4, yaw: Math.PI / 2 }], [-11, 0, -2, { w: 2.5, yaw: Math.PI / 2 }]],
        people: [[-9.5, 0, -14, { yaw: 0.4 }], [-8, 0, -15, { yaw: 0.2 }], [-1, 0, -24, {}], [0, 3.6, -45, {}], [-3, 7.2, -55, {}], [12, 3.6, -45, {}], [-18, 5.4, -50, {}], [20, 7.2, -55, {}]],
        crowd: { n: 18, x0: -26, x1: 26, z0: -14, z1: -34 },
        far: [{ x0: -90, x1: 90, z0: -170, z1: -100, n: 50, y: 12.6, size: [6, 14] }],
      });
    },
  }),
  view({
    id: 'eclipse-4-street', title: 'Down the street of steps, the washing on the lines, the city to the horizon', sheet: 'eclipse-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 4.4, 0], yaw: 0, fov: 50, horizon: 0.56 }, sky: SKY.steel,
    sun: { side: -60, el: 50 },
    eclipse: { side: 15, el: 18, size: 7.4, reach: 0.75, style: 0, corona: '#ffd2a8', stars: 0, glowH: 0.03 },
    groundAt: { edge: -6, low: -30, drop: 80 },
    build(kit, v) {
      const H = (x, z) => v.ground.height(x, z);
      cityScene(kit, v, {
        seed: 61004,
        traveller: [-1.6, -9, -0.15, H(-1.6, -9)],
        stairs: [
          { x: -1, z: -2, y0: -1.5, y1: 0, w: 12, rise: 0.25, run: 0.6, yaw: Math.PI, cheeks: [false, false], base: -3 },
        ],
        terraces: [
          // the left: the houses stacked up the hill, terrace over terrace
          { x0: -60, x1: -9, z0: -60, z1: 6, y: 2, below: -30, parapet: 0.8 },
          { x0: -60, x1: -15, z0: -60, z1: -6, y: 7, below: 2, parapet: 0 },
          { x0: -60, x1: -20, z0: -70, z1: -20, y: 13, below: 7, parapet: 0 },
        ],
        houses: [
          { x: -14, y: 2, z: -3, w: 7, d: 6, h: 6, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.7, yaw: Math.PI / 2, flowers: 1 },
          { x: -16, y: 2, z: -14, w: 6, d: 6, h: 5, kind: 'block', roof: 'flat', doors: 1, windows: 1, lit: 0.8, yaw: Math.PI / 2 },
          { x: -22, y: 7, z: -8, w: 8, h: 7, kind: 'drum', roof: 'dome', k: 0.9, doors: 0, windows: 2 },
          { x: -26, y: 13, z: -24, w: 10, h: 6, kind: 'drum', roof: 'dome', k: 0.8, doors: 1, windows: 2 },
          { x: -19, y: 7, z: -26, w: 7, d: 6, h: 5, kind: 'block', roof: 'flat', doors: 1, windows: 2, flowers: 1 },
          { x: -14, y: 2, z: -30, w: 7, d: 6, h: 5, kind: 'block', roof: 'dome', doors: 1, windows: 2, lit: 0.6 },
          { x: -12, y: 2, z: -44, w: 6, h: 5, kind: 'drum', roof: 'dome', doors: 1, windows: 1 },
          // the right: close, its washing, its tables
          { x: 16, y: H(16, -6), z: -6, w: 8, d: 8, h: 9, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.7, yaw: -Math.PI / 2 },
          { x: 19, y: H(19, -18), z: -18, w: 9, d: 7, h: 13, kind: 'block', roof: 'flat', doors: 1, windows: 3, lit: 0.6, yaw: -Math.PI / 2 },
          { x: 14, y: H(14, -34), z: -34, w: 7, d: 6, h: 6, kind: 'block', roof: 'flat', doors: 1, windows: 2, lit: 0.6, yaw: -Math.PI / 2 },
        ],
        tables: [[-7, 2, -8, { yaw: Math.PI / 2, seats: 3 }], [-6.6, 2, -14, { yaw: Math.PI / 2, seats: 3 }], [-6.8, 2, -20, { yaw: Math.PI / 2, seats: 2 }], [9, H(9, -14), -14, { yaw: -Math.PI / 2, seats: 4 }], [7, H(7, -26), -26, { yaw: -0.2, seats: 3 }]],
        lamps: [[-8.6, 2, -5.6, { kind: 'globe' }], [-9.6, 4.2, -10, { kind: 'hang', yaw: Math.PI / 2 }], [11.5, H(11.5, -10) + 2.4, -10, { kind: 'hang', yaw: -Math.PI / 2 }], [4, H(4, -30), -30, { kind: 'post', h: 2.4 }], [-4, H(-4, -40), -40, { kind: 'post', h: 2.4 }],
          [5, H(5, -48), -48, { kind: 'post', h: 2.4 }], [-3, H(-3, -60), -60, { kind: 'post', h: 2.4 }]],
        figures: [[-4.6, 2, -12, { pose: 'stand', yaw: 0.8, s: 1.1 }], [-9.2, 6, -16, { pose: 'lean', yaw: Math.PI / 2 }]],
        washing: [[[-10.4, 8, -2], [-12, 9, -26], { n: 7, drop: [1.4, 2.6] }], [[-10, 6, -4], [-4, 8.5, 6], { n: 4, drop: [1.2, 2] }], [[12, H(12, -4) + 7, -4], [15, H(15, -22) + 9, -22], { n: 6, drop: [1.6, 3] }]],
        flowers: [[-11.6, 8.8, -1, { w: 3.5, yaw: Math.PI / 2 }], [-14, 7.9, -18, { w: 4, yaw: Math.PI / 2 }], [12, H(12, -12) + 9.6, -12, { w: 4, yaw: -Math.PI / 2 }]],
        people: [[2, H(2, -40), -40, {}], [-1, H(-1, -52), -52, {}], [3, H(3, -64), -64, {}], [10, H(10, -20), -20, {}]],
        // the city falling away down the hill to the horizon on the right
        far: [{ x0: 4, x1: 220, z0: -300, z1: -55, n: 460, H, size: [5, 11], tall: [4, 10], lit: 0.25, domes: 0.4, towers: 0.02 }, { x0: -60, x1: 10, z0: -160, z1: -60, n: 90, H, size: [5, 9], domes: 0.5 }],
        extra(kit, M) {
          // the street itself: stepped paving down the hill, a low wall on its left
          for (let z = -4; z > -90; z -= 2.2) {
            const y = H(0, z);
            kit.add(M.paving, new THREE.BoxGeometry(13, 0.4, 2.3).translate(0, y - 0.18, z), { solid: true, shadow: true });
          }
          kit.add(M.stone, put(new THREE.BoxGeometry(18, 2.5, 3), 4, H(4, 5) - 0.6, 6, 0.2), NC);
        },
      });
    },
  }),
];
export { ECLIPSE_SHEETS as SHEETS, ECLIPSE_VIEWS as VIEWS };
