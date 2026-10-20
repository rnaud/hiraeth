import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// The fragments' landmarks (issue #550, its third pass: "in the Signal Market and on the City-Shaft rim the plinths
// mostly stand at the foot of tower walls"): the towers there are 60 to 300 m of sheer wall, so their roofs are no place
// to send anyone. Out among them, where a plinth stood, a small building of the world's own now stands with a way up
// the traveller's own moves manage (a stair of 0.43 m steps, under his 0.6 m step; a stack of crates 0.8 m a step, a
// jump each), and the fragment on its roof; or, where a fragment marks the middle of an open square, the square's
// centrepiece (a fountain, a statue, a bandstand) with the fragment on it. Each a place of interest of its own
// (tests/fragments-reach.js pointsOfInterest: `roof`, and onPlace counts a spot on its top), one fragment on each.
//
//   roofs:  a water tank (a cistern) on stilts, its deck up a stair; a two-storey stall block (a cab-wrights' shed), its
//           roof up a stack of crates; a signal platform (the lamplighters') on lattice legs, up a stair; a round kiosk
//           (a pavilion), its roof terrace up a stair
//   middles: a fountain (the fragment on its dry middle drum), a statue on a dais (at its feet), a bandstand (in it)
//
// Each landmark is { kind, at: [x, y, z] (the ground under its middle), yaw (its front, where the way up comes down,
// faces +z turned by yaw: a quarter turn at a time, so its stair lies along the walker's grid) }. Built by the levels
// (src/levels/bazaar.js, src/levels/incal.js) into the scene before their collision, one solid mesh, one drawn-only
// mesh and one glowing mesh a world (vertex colours: three draws), so on the web and in the engines alike.

/** How each world's landmarks are painted: its own plaster, trim, wood, metal and stone (the street's and the rim's). */
export const LANDMARK_STYLE = {
  bazaar: {
    walls: ['#f0a083', '#e4bd83', '#8dbbb9', '#94a9bd', '#ebce98'], trim: '#465c65', dark: '#3a535b', cream: '#f5dfab',
    wood: '#a07a58', metal: '#c99758', stone: '#d5c7a8', stone2: '#bdb4a2', water: '#7fc3c2', glow: '#fff0bd',
    figure: '#b9a9c5', crates: ['#c99758', '#f5dfab', '#88b4b5', '#f0a083'], awning: ['#f0a083', '#88b4b5', '#e4bd83'],
    // (the street's print: its walls' shade flat in the teal, src/levels/bazaar.js MARKET_FLAT)
    mat: { shadeFlat: 0.75, weathered: 0.6 },
  },
  incal: {
    walls: ['#f3ead8', '#e6875f', '#f2c54b', '#5fb7ad', '#f4f0e6'], trim: '#3d4f63', dark: '#34465a', cream: '#f3ead8',
    wood: '#8a5a3c', metal: '#c9d2dc', stone: '#e9dcc2', stone2: '#d8c8a8', water: '#8fd0d6', glow: '#fff2c8',
    figure: '#b07a4a', crates: ['#c8483a', '#f2c54b', '#5fb7ad', '#e6875f'], awning: ['#c8483a', '#f2c54b', '#5fb7ad'],
    mat: { weathered: 0.5 },
  },
};

/** The landmarks, world by world (a fragment on each: src/fragments-data.js, its place `landmarkName`). */
export const FRAGMENT_LANDMARKS = {
  bazaar: [
    { kind: 'fountain', at: [-109.5, 0.0, -51.5], yaw: 0 },   // slot 2: the fountain (1)
    { kind: 'tank', at: [-231.5, 0.0, -493.5], yaw: 0 },   // slot 3: the water tank on stilts (1)
    { kind: 'block', at: [208.5, 0.0, 164.5], yaw: -Math.PI / 2 },   // slot 5: the stall block (1)
    { kind: 'mast', at: [-277.5, 0.0, -239.5], yaw: 0 },   // slot 7: the signal platform (1)
    { kind: 'statue', at: [-235.5, 0.0, 184.5], yaw: Math.PI / 2 },   // slot 8: the statue of a quiet one (1)
    { kind: 'kiosk', at: [286.5, 0.0, -493.5], yaw: 0 },   // slot 11: the round kiosk (1)
    { kind: 'tank', at: [288.5, 0.0, -219.5], yaw: 0 },   // slot 12: the water tank on stilts (2)
    { kind: 'bandstand', at: [4.5, 0.0, 194.5], yaw: Math.PI },   // slot 13: the bandstand (1)
    { kind: 'mast', at: [-15.5, 0.0, -465.5], yaw: 0 },   // slot 14: the signal platform (2)
    { kind: 'fountain', at: [-153.5, 0.0, -343.5], yaw: 0 },   // slot 15: the fountain (2)
    { kind: 'block', at: [176.5, 0.0, -1.5], yaw: -Math.PI / 2 },   // slot 16: the stall block (2)
    { kind: 'statue', at: [-235.5, 0.0, 12.5], yaw: Math.PI / 2 },   // slot 17: the statue of a quiet one (2)
    { kind: 'kiosk', at: [-287.5, 0.0, -371.5], yaw: 0 },   // slot 18: the round kiosk (2)
    { kind: 'bandstand', at: [246.5, 0.0, -373.5], yaw: 0 },   // slot 19: the bandstand (2)
    { kind: 'fountain', at: [158.5, 0.0, -213.5], yaw: 0 },   // slot 20: the fountain (3)
    { kind: 'statue', at: [62.5, 0.0, 74.5], yaw: -Math.PI / 2 },   // slot 21: the statue of a quiet one (3)
    { kind: 'bandstand', at: [-171.5, 0.0, -203.5], yaw: 0 },   // slot 22: the bandstand (3)
    { kind: 'fountain', at: [-89.5, 0.0, 94.5], yaw: Math.PI },   // slot 23: the fountain (4)
  ],
  incal: [
    { kind: 'tank', at: [746.5, 200.0, -7.5], yaw: -Math.PI / 2 },   // slot 7: the cistern on stilts (1)
    { kind: 'block', at: [264.5, 200.0, -519.5], yaw: 0 },   // slot 8: the cab-wrights’ shed (1)
    { kind: 'mast', at: [218.5, 200.0, 690.5], yaw: Math.PI },   // slot 9: the lamplighters’ platform (1)
    { kind: 'kiosk', at: [724.5, 200.0, 472.5], yaw: Math.PI },   // slot 10: the round pavilion (1)
    { kind: 'fountain', at: [-389.5, 200.0, -221.5], yaw: Math.PI / 2 },   // slot 11: the fountain (1)
    { kind: 'block', at: [612.5, 200.0, -391.5], yaw: 0 },   // slot 13: the cab-wrights’ shed (2)
    { kind: 'statue', at: [-115.5, 200.0, 548.5], yaw: Math.PI },   // slot 16: the statue of a lamplighter (1)
    { kind: 'tank', at: [408.5, 200.0, 440.5], yaw: Math.PI },   // slot 17: the cistern on stilts (2)
    { kind: 'bandstand', at: [480.5, 200.0, -669.5], yaw: 0 },   // slot 18: the bandstand (1)
    { kind: 'fountain', at: [46.5, 200.0, -285.5], yaw: 0 },   // slot 19: the fountain (2)
    { kind: 'fountain', at: [-253.5, 150.0, -7.5], yaw: Math.PI / 2 },   // slot 20: the fountain (3)
    { kind: 'mast', at: [938.5, 200.0, 84.5], yaw: -Math.PI / 2 },   // slot 21: the lamplighters’ platform (2)
    { kind: 'bandstand', at: [608.5, 200.0, 138.5], yaw: -Math.PI / 2 },   // slot 22: the bandstand (2)
    { kind: 'statue', at: [-133.5, 150.0, -191.5], yaw: Math.PI / 2 },   // slot 23: the statue of a lamplighter (2)
  ],
};

// What each kind is called, world by world: its place's name (numbered, one a landmark) and, in the people's words,
// where on it the fragment lies (src/story/rumour-places.js: the place, then which way it lies from a landmark).
export const LANDMARK_NAMES = {
  bazaar: {
    tank: ['the water tank on stilts', 'on a water tank’s deck+'],
    block: ['the stall block', 'on the roof of a stall block+'],
    mast: ['the signal platform', 'up on a signal platform+'],
    kiosk: ['the round kiosk', 'on the roof of a round kiosk+'],
    fountain: ['the fountain', 'on the fountain in a little square+'],
    statue: ['the statue of a quiet one', 'at the feet of a quiet one’s statue+'],
    bandstand: ['the bandstand', 'in a bandstand+'],
  },
  incal: {
    tank: ['the cistern on stilts', 'on a cistern’s deck on the rim+'],
    block: ['the cab-wrights’ shed', 'on the roof of a cab-wrights’ shed+'],
    mast: ['the lamplighters’ platform', 'up on a lamplighters’ platform+'],
    kiosk: ['the round pavilion', 'on the roof of a round pavilion+'],
    fountain: ['the fountain', 'on the fountain in a little square+'],
    statue: ['the statue of a lamplighter', 'at the feet of a lamplighter’s statue+'],
    bandstand: ['the bandstand', 'in a bandstand+'],
  },
};

/** A landmark's place name: its kind's, numbered among the world's of that kind. */
export function landmarkName(levelId, i) {
  const list = FRAGMENT_LANDMARKS[levelId] ?? [], L = list[i];
  const n = list.slice(0, i + 1).filter((o) => o.kind === L.kind).length;
  return `${LANDMARK_NAMES[levelId]?.[L.kind]?.[0] ?? L.kind} (${n})`;
}

// ---------------------------------------------------------------------------------------------------- the kinds
// Each kind in its own frame (its middle at the origin on the ground, its front toward +z): `top`, the surface the
// fragment stands on ({ y, x0, x1, z0, z1 } or a round one { y, r }), `spot` where on it, `foot` the ground it takes
// (stair and all, for placing it), `build(P, S, v)` its parts (P.solid / P.detail / P.glow (geometry, colour); P.collider
// (geometry): walked on, never drawn, under what is drawn only).
const STAIR = { rise: 0.43, going: 0.8, width: 2.2 };
const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const cyl = (r0, r1, y0, y1, x = 0, z = 0, seg = 12) => new THREE.CylinderGeometry(r1, r0, y1 - y0, seg).translate(x, (y0 + y1) / 2, z);
function strut(a, b, t) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  return new THREE.BoxGeometry(t, d.length(), t).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
    .translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
}
/** One step of a stair, solid to the ground: its tread at y over z a..b, its riser from y0 up at b, its two sides (8 triangles). */
function stepGeometry(x0, x1, y0, y, za, zb) {
  const p = [], n = [];
  const quad = (a, b, c, d, nx, ny, nz) => { p.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) n.push(nx, ny, nz); };
  quad([x0, y, zb], [x1, y, zb], [x1, y, za], [x0, y, za], 0, 1, 0);       // (the tread)
  quad([x0, y0, zb], [x1, y0, zb], [x1, y, zb], [x0, y, zb], 0, 0, 1);     // (the riser)
  quad([x1, 0, zb], [x1, 0, za], [x1, y, za], [x1, y, zb], 1, 0, 0);       // (its sides)
  quad([x0, 0, za], [x0, 0, zb], [x0, y, zb], [x0, y, za], -1, 0, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}
/** A straight stair down the front from height h at z = z0 outward (+z), x0 to x1 across: each step solid to the ground. */
function stair(P, x0, x1, z0, h, colors, { rise = STAIR.rise, going = STAIR.going, edge = null } = {}) {
  const n = Math.round(h / rise), r = h / n;
  for (let k = 1; k <= n; k++) {
    const za = z0 + (n - k) * going, zb = za + going;
    P.solid(stepGeometry(x0, x1, (k - 1) * r, k * r, za, zb), colors[k % colors.length]);
    if (edge) P.detail(box(x0 - 0.012, x1 + 0.012, k * r - 0.06, k * r + 0.012, zb - 0.06, zb + 0.012), edge);   // (a nosing on each tread)
  }
  P.detail(box(x0 + 0.02, x1 - 0.02, 0, h - 0.4, z0 + 0.012, z0 + 0.03), colors[0]);   // (its back, under what it climbs to)
  return n * going;
}
/** A stair's open side rails, drawn only (you walk past them, not into them). */
function stairRail(P, x, z0, h, run, color, side = 1) {
  const top = (z) => h * (1 - (z - z0) / run) + 1.0;
  for (let z = z0 + 0.4; z < z0 + run; z += 1.6) P.detail(box(x - 0.05, x + 0.05, 0, top(z), z - 0.05, z + 0.05), color);
  P.detail(strut([x, h + 1.0, z0], [x, 1.0, z0 + run], 0.08), color);
}
/** A run of rail along x0..x1 at z (or along z0..z1 at x), 1 m high, drawn only. */
function railX(P, x0, x1, z, y, color) { P.detail(box(x0, x1, y + 0.95, y + 1.05, z - 0.05, z + 0.05), color); for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 1.5))) P.detail(box(x - 0.05, x + 0.05, y, y + 1, z - 0.05, z + 0.05), color); }
function railZ(P, z0, z1, x, y, color) { P.detail(box(x - 0.05, x + 0.05, y + 0.95, y + 1.05, z0, z1), color); for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / Math.max(1, Math.round((z1 - z0) / 1.5))) P.detail(box(x - 0.05, x + 0.05, y, y + 1, z - 0.05, z + 0.05), color); }

export const LANDMARK_KINDS = {
  // a water tank on four legs, its deck 6 m up, the tank on its back half, a stair down the front's right
  tank: {
    top: { y: 6, x0: -3, x1: 3, z0: -3, z1: 3 }, spot: [-1.2, 2.0], foot: { x0: -3.5, x1: 3.5, z0: -3.5, z1: 14.6 }, roof: true,
    build(P, S, v) {
      const H = 6;
      P.solid(box(-3, 3, H - 0.4, H, -3, 3), S.wood);
      P.detail(box(-3.05, 3.05, H - 0.42, H - 0.3, -3.05, 3.05), S.trim);
      for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]]) P.solid(box(x - 0.2, x + 0.2, 0, H - 0.4, z - 0.2, z + 0.2), S.trim);
      for (const [a, b] of [[[-2.6, -2.6], [2.6, -2.6]], [[2.6, -2.6], [2.6, 2.6]], [[-2.6, -2.6], [-2.6, 2.6]]]) {
        P.detail(strut([a[0], 0.6, a[1]], [b[0], H - 0.8, b[1]], 0.12), S.trim);
        P.detail(strut([b[0], 0.6, b[1]], [a[0], H - 0.8, a[1]], 0.12), S.trim);
      }
      const c = S.walls[v % S.walls.length];
      P.solid(cyl(1.55, 1.55, H, H + 3.2, 0, -1.3, 12), c);
      for (const y of [H + 0.8, H + 1.9, H + 3.0]) P.detail(cyl(1.6, 1.6, y - 0.08, y + 0.08, 0, -1.3, 16), S.trim);
      P.detail(new THREE.ConeGeometry(1.75, 0.9, 16).translate(0, H + 3.65, -1.3), S.metal);
      P.detail(cyl(0.12, 0.12, H + 4.1, H + 4.6, 0, -1.3, 6), S.trim);
      P.detail(cyl(0.12, 0.12, 0.3, H, 1.1, -2.2, 6), S.metal);   // (its pipe down)
      railX(P, -3, 3, -2.95, H, S.trim); railZ(P, -3, 3, -2.95, H, S.trim);
      railZ(P, -3, 0.2, 2.95, H, S.trim);
      const run = stair(P, 0.6, 2.8, 3, H, [S.stone, S.stone2], { edge: S.trim });
      stairRail(P, 2.85, 3, H, run, S.trim);
    },
  },
  // a two-storey stall block, its awning over the shop, its flat roof up a stack of crates at its right side
  block: {
    top: { y: 4.8, x0: -4, x1: 4, z0: -3, z1: 3 }, spot: [-0.6, 2.0], foot: { x0: -4.5, x1: 6.7, z0: -3.5, z1: 5.2 }, roof: true,
    build(P, S, v) {
      const H = 4.8, c = S.walls[(v + 1) % S.walls.length], aw = S.awning[v % S.awning.length];
      P.solid(box(-4, 4, 0, H, -3, 3), c);
      P.solid(box(-4, 4, H, H + 0.15, 2.75, 3.0), S.cream);   // (a low lip round the roof's front and left: under the fragment's line from the street)
      P.solid(box(-4, -3.75, H, H + 0.15, -3.0, 2.75), S.cream);
      P.detail(box(-4.08, 4.08, 2.3, 2.45, -3.08, 3.08), S.trim);   // (the floor's band)
      P.detail(box(-3.2, 3.2, 0.05, 2.0, 3.0, 3.06), S.dark);       // (the shop's opening, shuttered)
      for (let x = -3; x < 3.1; x += 0.5) P.detail(box(x - 0.02, x + 0.02, 0.05, 2.0, 3.06, 3.09), S.trim);
      for (const x of [-2.4, 0, 2.4]) P.detail(box(x - 0.6, x + 0.6, 2.9, 3.9, 3.0, 3.06), S.dark);   // (the upper windows)
      for (let k = 0; k < 6; k++) P.detail(new THREE.BoxGeometry(8.4 / 6, 0.1, 1.7).rotateX(0.35).translate(-3.5 + k * 1.4, 2.35, 3.75), k % 2 ? S.cream : aw);
      P.detail(box(-1.6, 1.6, 4.0, 4.6, 3.0, 3.12), aw);   // (its sign)
      // the crates up its right side, toward the back: six steps of 0.8 m, each a column of crates
      const n = 6;
      for (let k = 1; k <= n; k++) {
        const z0 = 3 - k * 1.0, z1 = z0 + 1.0;
        P.collider(box(4.0, 6.2, 0, k * 0.8, z0, z1));   // (a step: one box to walk on, the crates drawn over it)
        for (let j = 0; j < k; j++) {
          const col = S.crates[(k + j + v) % S.crates.length];
          for (const [xa, xb] of [[4.0, 5.1], [5.1, 6.2]]) {
            P.detail(box(xa, xb, j * 0.8, (j + 1) * 0.8, z0, z1), col);
            if (j === k - 1) P.detail(box(xa + 0.08, xb - 0.08, j * 0.8 + 0.35, j * 0.8 + 0.45, z1, z1 + 0.03), S.trim);   // (a slat on the face you see)
          }
        }
      }
      railZ(P, -3, 2.7, -3.85, H, S.trim);
    },
  },
  // a signal platform on four lattice legs, 6.4 m up, a mast and a dish off its back, a stair down the front
  mast: {
    top: { y: 6.4, x0: -2.6, x1: 2.6, z0: -2.6, z1: 2.6 }, spot: [-1.0, 1.5], foot: { x0: -3.1, x1: 3.1, z0: -3.1, z1: 15 }, roof: true,
    build(P, S, v) {
      const H = 6.4;
      P.solid(box(-2.6, 2.6, H - 0.35, H, -2.6, 2.6), S.metal);
      P.detail(box(-2.65, 2.65, H - 0.4, H - 0.25, -2.65, 2.65), S.trim);
      const legs = [[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]];
      for (const [x, z] of legs) P.solid(box(x - 0.15, x + 0.15, 0, H - 0.35, z - 0.15, z + 0.15), S.trim);
      for (let i = 0; i < 4; i++) {
        const a = legs[i], b = legs[(i + 1) % 4];
        if (i === 2) continue;   // (the front left open under the stair's head)
        for (let y = 0.4; y < H - 1; y += 2.2) { P.detail(strut([a[0], y, a[1]], [b[0], y + 2.2, b[1]], 0.08), S.trim); P.detail(strut([b[0], y, b[1]], [a[0], y + 2.2, a[1]], 0.08), S.trim); }
      }
      // the mast off the back corner, a dish on it, a lamp at its top
      const mx = 1.8, mz = -1.8, top = H + 10;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.detail(strut([mx + sx * 0.5, H, mz + sz * 0.5], [mx + sx * 0.12, top, mz + sz * 0.12], 0.1), (v % 2 ? S.walls[0] : S.cream));
      for (let y = H + 1.5; y < top; y += 2) P.detail(box(mx - 0.45 * (1 - (y - H) / 12), mx + 0.45 * (1 - (y - H) / 12), y - 0.05, y + 0.05, mz - 0.45 * (1 - (y - H) / 12), mz + 0.45 * (1 - (y - H) / 12)), S.trim);
      P.detail(new THREE.SphereGeometry(1.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(-Math.PI / 2 - 0.4).translate(mx - 0.3, H + 6, mz + 0.4), S.cream);
      P.detail(cyl(0.05, 0.05, H + 5.4, H + 6.6, mx - 0.3, mz + 0.4, 5), S.trim);
      P.glow(new THREE.SphereGeometry(0.45, 10, 7).translate(mx, top + 0.4, mz), S.glow);
      railX(P, -2.6, 2.6, -2.55, H, S.trim); railZ(P, -2.6, 2.6, -2.55, H, S.trim); railZ(P, -2.6, 2.6, 2.55, H, S.trim);
      const run = stair(P, -1.1, 1.1, 2.6, H, [S.metal, S.stone2], { edge: S.trim });
      stairRail(P, -1.15, 2.6, H, run, S.trim); stairRail(P, 1.15, 2.6, H, run, S.trim);
    },
  },
  // a round (octagonal) kiosk, its roof terrace 3.6 m up, a stair down the middle of its front
  kiosk: {
    top: { y: 3.6, r: 2.75 }, spot: [0, 1.0], foot: { x0: -3.6, x1: 3.6, z0: -3.6, z1: 10 }, roof: true,
    build(P, S, v) {
      const H = 3.6, a = 2.8, R = a / Math.cos(Math.PI / 8), c = S.walls[(v + 3) % S.walls.length];
      const oct = (r, y0, y1) => new THREE.CylinderGeometry(r, r, y1 - y0, 8).rotateY(Math.PI / 8).translate(0, (y0 + y1) / 2, 0);
      P.solid(oct(R, 0, H), c);
      P.detail(oct(R + 0.25, H - 1.3, H - 1.15), S.trim);
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        if (k === 0) continue;   // (the front: the stair)
        P.detail(new THREE.BoxGeometry(1.7, 1.2, 0.06).translate(0, H - 2.4, a + 0.03).rotateY(ang), k % 2 ? S.dark : S.cream);   // (its windows and posters round it)
        P.detail(new THREE.BoxGeometry(2.2, 0.08, 0.9).rotateX(0.35).translate(0, H - 1.05, a + 0.42).rotateY(ang), S.awning[(k + v) % S.awning.length]);
      }
      // a lamp on a post at the roof's back
      P.detail(cyl(0.06, 0.06, H, H + 2.2, 0, -2.0, 6), S.trim);
      P.glow(new THREE.SphereGeometry(0.3, 10, 7).translate(0, H + 2.4, -2.0), S.glow);
      const run = stair(P, -1.1, 1.1, a, H, [S.stone, S.stone2], { edge: S.trim });
      stairRail(P, -1.15, a, H, run, S.trim); stairRail(P, 1.15, a, H, run, S.trim);
    },
  },
  // a fountain: a round basin, its water, a dry drum in its middle where the fragment rests
  fountain: {
    top: { y: 1.0, r: 1.0 }, spot: [0, 0], foot: { x0: -4, x1: 4, z0: -4, z1: 4 },
    build(P, S, v) {
      P.detail(cyl(3.3, 3.3, 0, 0.15, 0, 0, 20), S.stone2);   // (its floor, under the water)
      P.solid(new THREE.LatheGeometry([[3.5, 0], [3.5, 0.65], [3.0, 0.65], [3.0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y)), 16), S.stone);   // (its wall: out, over, in)
      P.detail(cyl(3.05, 3.05, 0.4, 0.42, 0, 0, 20), S.water);   // (its water: drawn only, not a body of water)
      P.solid(cyl(1.05, 1.0, 0.15, 1.0, 0, 0, 10), S.cream);
      P.detail(cyl(1.12, 1.12, 0.82, 0.96, 0, 0, 14), S.metal);   // (a brass band under its lip)
      for (let k = 0; k < 4; k++) P.detail(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6).rotateX(Math.PI / 2).translate(0, 0.7, 1.25).rotateY((k / 4) * Math.PI * 2 + Math.PI / 4), S.metal);   // (its spouts)
    },
  },
  // a statue on a round dais: a figure on a pedestal at its back, the fragment at its feet
  statue: {
    top: { y: 0.55, r: 2.8 }, spot: [0, 1.3], foot: { x0: -3.6, x1: 3.6, z0: -3.6, z1: 3.6 },
    build(P, S, v) {
      P.solid(cyl(3.5, 3.5, 0, 0.25, 0, 0, 12), S.stone2);
      P.solid(cyl(2.85, 2.8, 0.25, 0.55, 0, 0, 12), S.stone);
      P.solid(box(-0.8, 0.8, 0.55, 1.9, -2.0, -0.4), S.cream);
      P.detail(box(-0.88, 0.88, 1.75, 1.92, -2.08, -0.32), S.trim);
      const f = S.figure, y = 1.9, z = -1.2;
      if (S.quiet) {
        // one of the market's quiet ones: a broad body, a broad head
        P.detail(new THREE.SphereGeometry(1, 12, 9).scale(0.62, 1.1, 0.45).translate(0, y + 1.1, z), f);
        P.detail(new THREE.SphereGeometry(1, 14, 9).scale(0.86, 0.44, 0.46).translate(0, y + 2.15, z), f);
        P.detail(new THREE.SphereGeometry(1, 8, 6).scale(0.18, 0.5, 0.18).rotateX(-0.9).translate(0.55, y + 1.5, z + 0.35), f);
      } else {
        // a lamplighter: a long coat, a round hat, a lamp held out on a pole
        P.detail(new THREE.ConeGeometry(0.7, 2.0, 10).translate(0, y + 1.0, z), f);
        P.detail(new THREE.SphereGeometry(0.32, 10, 8).translate(0, y + 2.25, z), f);
        P.detail(cyl(0.5, 0.5, y + 2.45, y + 2.53, 0, z, 12), f);
        P.detail(strut([0.3, y + 1.6, z], [0.9, y + 3.2, z + 0.6], 0.07), f);
      }
      P.glow(new THREE.SphereGeometry(0.2, 8, 6).translate(S.quiet ? 0 : 0.9, S.quiet ? y + 2.75 : y + 3.0, S.quiet ? z : z + 0.6), S.glow);
    },
  },
  // a bandstand: a round floor two steps up, six posts, a dome over it
  bandstand: {
    top: { y: 0.9, r: 3.0 }, spot: [0, 0], foot: { x0: -4.2, x1: 4.2, z0: -4.2, z1: 4.2 },
    build(P, S, v) {
      P.solid(cyl(3.8, 3.8, 0, 0.45, 0, 0, 12), S.stone2);
      P.solid(cyl(3.15, 3.15, 0.45, 0.9, 0, 0, 12), S.stone);
      P.detail(cyl(3.2, 3.2, 0.82, 0.92, 0, 0, 16), S.trim);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6, x = Math.sin(a) * 2.8, z = Math.cos(a) * 2.8;
        P.solid(box(x - 0.11, x + 0.11, 0.9, 4.3, z - 0.11, z + 0.11), S.metal);
      }
      P.detail(cyl(3.4, 3.4, 4.3, 4.55, 0, 0, 16), S.walls[v % S.walls.length]);   // (its roof drawn only: the way in is under it)
      P.detail(new THREE.SphereGeometry(3.2, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 4.55, 0), S.awning[v % S.awning.length]);
      P.detail(cyl(0.05, 0.05, 5.9, 6.8, 0, 0, 5), S.trim);
      P.glow(new THREE.SphereGeometry(0.25, 8, 6).translate(0, 6.9, 0), S.glow);
    },
  },
};

/** Local → world for a landmark: turned by its yaw (a quarter turn at a time), set at its spot. */
function toWorld(L, lx, ly, lz) {
  const c = Math.round(Math.cos(L.yaw ?? 0)), s = Math.round(Math.sin(L.yaw ?? 0));
  return [L.at[0] + lx * c + lz * s, L.at[1] + ly, L.at[2] - lx * s + lz * c];
}
/** Where a landmark's fragment stands (the ground there: its top). */
export function landmarkSpot(L) {
  const K = LANDMARK_KINDS[L.kind];
  return toWorld(L, K.spot[0], K.top.y, K.spot[1]).map((v) => +v.toFixed(2));
}
/** Is (x, y, z) on a landmark's top (the fragment's surface, within `pad` m of its edge, `dy` of its height)? */
export function onLandmarkTop(L, x, y, z, pad = 0.05, dy = 0.3) {
  const K = LANDMARK_KINDS[L.kind], t = K.top;
  if (Math.abs(y - (L.at[1] + t.y)) > dy) return false;
  const c = Math.round(Math.cos(L.yaw ?? 0)), s = Math.round(Math.sin(L.yaw ?? 0));
  const dx = x - L.at[0], dz = z - L.at[2], lx = dx * c - dz * s, lz = dx * s + dz * c;
  return t.r ? Math.hypot(lx, lz) <= t.r - pad : lx >= t.x0 + pad && lx <= t.x1 - pad && lz >= t.z0 + pad && lz <= t.z1 - pad;
}
/** The ground a landmark takes, stair and all, as a box in the world: [x0, x1, z0, z1]. */
export function landmarkFoot(L) {
  const f = LANDMARK_KINDS[L.kind].foot, a = toWorld(L, f.x0, 0, f.z0), b = toWorld(L, f.x1, 0, f.z1);
  return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[2], b[2])];
}

/** One landmark's parts in the world: { solid: [geo], detail: [geo], glow: [geo], collider: [geo] (walked on, not drawn) }, each coloured (a `color` attribute). */
export function landmarkParts(levelId, L, v = 0) {
  const S = { ...LANDMARK_STYLE[levelId], quiet: levelId === 'bazaar' }, out = { solid: [], detail: [], glow: [], collider: [] }, col = new THREE.Color();
  const yaw = Math.round((L.yaw ?? 0) / (Math.PI / 2)) * (Math.PI / 2);
  const put = (layer) => (g, color) => {
    let q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    q.rotateY(yaw).translate(L.at[0], L.at[1], L.at[2]);
    col.set(color);
    const n = q.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(c, i * 3);
    q.setAttribute('color', new THREE.BufferAttribute(c, 3));
    out[layer].push(q);
  };
  LANDMARK_KINDS[L.kind].build({ solid: put('solid'), detail: put('detail'), glow: put('glow'), collider: (g) => put('collider')(g, '#000000') }, S, v);
  return out;
}

/** The world's landmarks built into the scene (three meshes: solid, drawn only, glowing), or null where it has none. */
export function buildFragmentLandmarks(scene, levelId) {
  const list = FRAGMENT_LANDMARKS[levelId] ?? [], S = LANDMARK_STYLE[levelId];
  if (!list.length || !S) return null;
  const all = { solid: [], detail: [], glow: [], collider: [] };
  list.forEach((L, i) => { const p = landmarkParts(levelId, L, i); for (const k of Object.keys(all)) all[k].push(...p[k]); });
  const group = new THREE.Group();
  group.name = 'The fragments’ landmarks';
  const mk = (geos, o, solid) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, ...o, key: `fragment.landmarks.${levelId}.${solid ? 'solid' : o.glow ? 'glow' : 'detail'}` }));
    m.name = `The fragments’ landmarks (${solid ? 'solid' : o.glow ? 'glow' : 'drawn'})`;
    m.userData.noCollide = !solid;
    m.geometry.computeBoundingSphere();
    group.add(m);
  };
  mk(all.solid, { grid: 3, ...S.mat }, true);
  mk(all.detail, { ...S.mat }, false);
  mk(all.glow, { glow: 0.85 }, false);
  // (what is walked on where something drawn only stands over it, a stack of crates: one box a step, never drawn)
  if (all.collider.length) {
    const c = new THREE.Mesh(mergeGeometries(all.collider), group.children[0].material);
    c.name = 'The fragments’ landmarks (walked on)'; c.visible = false;
    group.add(c);
  }
  scene?.add(group);
  return group;
}
