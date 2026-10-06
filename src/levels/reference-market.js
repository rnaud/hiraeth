import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { V, tube, sagPts, put, PERSON, CLEAN_SKY } from './reference-kit.js';
import { MARKET_LOOK, MARKET_FLAT } from './bazaar.js';

// ---------------------------------------------------------------------------
// The Signal Market's reference sheets (references/The Signal Market/IMG_3801 … 3808): a canyon of a
// street between towers of pink, teal and cream, painted billboards, skybridges and their trusses,
// flying cabs, cables, a crowd and market stalls at the foot of the walls. One scene builder
// (marketScene) does them all; each panel is a view (reference-views.js describes the fields).
//
// The sheets print the shade flat in a teal-blue whatever the wall's colour (a pink tower's turned
// side goes blue), hatch almost nothing, and fill the machinery and pipes under the bridges and up
// the teal walls with near-black pockets.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `The Signal Market / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/The Signal Market/${name}.JPG`, import.meta.url).href });
export const MARKET_SHEETS = Object.fromEntries(['IMG_3801', 'IMG_3802', 'IMG_3803', 'IMG_3804', 'IMG_3805', 'IMG_3806', 'IMG_3807', 'IMG_3808'].map((n) => [n, sheet(n)]));

/** The sheets' ink: the world's own look (bazaar.js MARKET_LOOK, the flat teal shade) and a clean sky. */
export const MARKET_VIEW_LOOK = { ...MARKET_LOOK, ...CLEAN_SKY, uShadowFlat: MARKET_FLAT };
/** sky top, horizon, shadow (the teal-blue), light, sun */
const TINT = '#78a8b4';
const SKY = {
  aqua: ['#9fd8d4', '#d6efe2', TINT, '#ffffff', '#fff6dc'],
  pale: ['#b9e3dc', '#eef2dc', TINT, '#ffffff', '#fff6dc'],
  peach: ['#a7dcd6', '#f4dcc0', TINT, '#ffffff', '#fff6dc'],
};
const WALLS = ['#f0a68e', '#ec9a7e', '#f4b89f', '#8fbcc0', '#a9cfcf', '#f4e2b0', '#f1d58f', '#c9bfe0'];

function materials(kit) {
  const DS = THREE.DoubleSide;
  return {
    walls: WALLS.map((c, i) => kit.mat({ color: c, flat: true, grid: i % 3 === 0 ? 4 : 0, windows: 0.25, weathered: 0.25, hatch: 0.3 })),
    facade: WALLS.slice(0, 5).map((c) => kit.mat({ color: c, flat: true, pattern: 'facade', windows: 0.35, hatch: 0.3 })),
    steel: kit.mat({ color: '#5f8f99', flat: true, metal: 'painted' }),
    pipe: kit.mat({ color: '#7fb0b5', metal: 'painted' }),
    dark: kit.mat({ color: '#2f4a52', flat: true }),
    rail: kit.mat({ color: '#3f5f66', flat: true }),
    cable: kit.mat({ color: '#2b3a40', flat: true }),
    paving: kit.mat({ color: '#a8c9c4', flat: true, grid: 3 }),
    walk: kit.mat({ color: '#d9cfae', flat: true, grid: 1.5 }),
    // (the painted signs: drawn in a lighter line of their own colour, not the walls' ink)
    screens: ['#f6c9a6', '#f3dca0', '#ef9f86', '#bfe0e0', '#e9c7e6'].map((c) => kit.mat({ color: c, flat: true, glow: 0.35, line: 0.7, lineTint: 0.67 })),
    ink: kit.mat({ color: '#c7604b', flat: true, glow: 0.3 }),
    awning: ['#d9573f', '#e38a52', '#4f8a8f', '#e9b25c'].map((c) => kit.mat({ color: c, flat: true, side: DS })),
    goods: ['#e86f4e', '#f2b84b', '#7db36a', '#c2493b', '#e8d8a8'].map((c) => kit.mat({ color: c, flat: true })),
    lamp: kit.mat({ color: '#fff0bd', glow: 0.85, flat: true }),
    cab: kit.mat({ color: '#e9b44c', metal: 'painted' }),
    cabDark: kit.mat({ color: '#3a3a3a', flat: true }),
    glass: kit.mat({ color: '#cfe8ea', glass: true }),
    crowd: ['#c46b4e', '#4f7f86', '#8a6e9e', '#d9a35e', '#6b8f5e', '#b5523e', '#e0c08a', '#5a6f8e'].map((c) => kit.mat({ color: c, flat: true, figure: true })),
    skin: kit.mat({ color: '#e0b08e', flat: true, figure: true }),
    suit: kit.mat({ color: '#c3b4e0', flat: true, figure: true }),
    pack: kit.mat({ color: '#f1e6b8', flat: true, figure: true }),
  };
}

// ---------------------------------------------------------------- builders (the view's own frame)
/**
 * A tower standing at (x, z), w × d wide and h high (round: a drum), bands at its floors, pipes and
 * boxes clinging to it (greebles for the spot blacks), a billboard on its face toward the street.
 */
function tower(kit, M, rng, { x, z, w, d = w, h, round = false, face = 0, mat, poster = true, y0 = 0 }) {
  const m = mat ?? M.walls[Math.floor(rng() * M.walls.length)];
  if (round) kit.add(m, new THREE.CylinderGeometry(w / 2, w / 2, h, 28).translate(x, y0 + h / 2, z), { shadow: false });
  else kit.add(m, new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z), { shadow: false });
  // set-back crowns and bands
  for (let y = 12 + rng() * 10; y < h; y += 14 + rng() * 18) {
    const g = round ? new THREE.CylinderGeometry(w / 2 + 0.4, w / 2 + 0.4, 0.8, 28) : new THREE.BoxGeometry(w + 0.8, 0.8, d + 0.8);
    kit.add(M.steel, g.translate(x, y0 + y, z), { solid: false, shadow: false });
  }
  if (rng() < 0.5) kit.add(M.walls[Math.floor(rng() * M.walls.length)], (round ? new THREE.CylinderGeometry(w * 0.32, w * 0.4, h * 0.25, 20) : new THREE.BoxGeometry(w * 0.6, h * 0.25, d * 0.6)).translate(x, y0 + h * 1.12, z), { solid: false, shadow: false });
  // the face toward the street (face: +1 faces +x, -1 faces -x, 0 faces +z)
  const fx = face, fz = face ? 0 : 1, half = face ? w / 2 : d / 2;
  const at = (u, y, off = 0.3) => [x + fx * (half + off) + (face ? 0 : u), y0 + y, z + fz * (half + off) + (face ? u : 0)];
  const yaw = face ? fx * Math.PI / 2 : 0, span = face ? d : w;
  // pipes running up the face, boxes and machinery at their feet
  for (let i = 0; i < 3 + Math.floor(rng() * 4); i++) {
    const u = (rng() - 0.5) * span * 0.9, y1 = h * (0.3 + rng() * 0.6), [px, py, pz] = at(u, 0, 0.5 + rng() * 0.6);
    kit.add(M.pipe, tube([V(px, py, pz), V(px, py + y1, pz)], 0.25 + rng() * 0.35, 2, 6), { solid: false, shadow: false });
  }
  for (let i = 0; i < 6 + Math.floor(rng() * 8); i++) {
    const u = (rng() - 0.5) * span * 0.9, y = 4 + rng() * h * 0.6, s = 0.8 + rng() * 2.4, [bx, by, bz] = at(u, y, s * 0.4);
    kit.add(rng() < 0.4 ? M.dark : M.steel, put(new THREE.BoxGeometry(s, s * (0.6 + rng()), s * 0.8), bx, by, bz, yaw), { solid: false, shadow: false });
  }
  if (poster) {
    const pw = span * (0.5 + rng() * 0.35), ph = pw * (0.9 + rng() * 0.9), py = 10 + rng() * Math.max(h - ph - 20, 4);
    billboard(kit, M, rng, ...at((rng() - 0.5) * span * 0.2, py + ph / 2, 0.6), pw, ph, yaw);
  }
}
/** A painted billboard: a frame, a lit panel, a few big shapes on it (a face, a planet, a glyph). */
function billboard(kit, M, rng, x, y, z, w, h, yaw) {
  kit.add(M.rail, put(new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.5), x, y, z, yaw), { solid: false, shadow: false });
  const k = Math.floor(rng() * M.screens.length), c = Math.cos(yaw), s = Math.sin(yaw), f = (u, v, o) => [x + c * u + s * o, y + v, z - s * u + c * o];
  kit.add(M.screens[k], put(new THREE.BoxGeometry(w, h, 0.2), ...f(0, 0, 0.3), yaw), { solid: false, shadow: false });
  for (let i = 0; i < 3; i++) {
    const r = Math.min(w, h) * (0.12 + rng() * 0.18), [px, py, pz] = f((rng() - 0.5) * w * 0.6, (rng() - 0.5) * h * 0.6, 0.45);
    kit.add(rng() < 0.5 ? M.ink : M.screens[(k + 2) % M.screens.length], put(rng() < 0.5 ? new THREE.CircleGeometry(r, 20) : new THREE.PlaneGeometry(r * 2, r * 0.5), px, py, pz, yaw), { solid: false, shadow: false });
  }
}
/** A skybridge across the street at height y, from x0 to x1 at z: a deck, a truss under it, railings, pipes along it. */
function skybridge(kit, M, rng, { z, y, x0 = -30, x1 = 30, w = 4, drop = 0 }) {
  const L = x1 - x0, cx = (x0 + x1) / 2, yaw = Math.atan2(drop, L);
  kit.add(M.steel, put(new THREE.BoxGeometry(L, 1.2, w), cx, y, z, 0, 1, 0, -yaw), { solid: false, shadow: true });
  kit.add(M.dark, put(new THREE.BoxGeometry(L, 2.4, w * 0.7), cx, y - 1.8, z, 0, 1, 0, -yaw), { solid: false, shadow: false });
  for (let u = x0 + 2; u < x1; u += 3) kit.add(M.rail, put(new THREE.BoxGeometry(0.2, 3, 0.2), u, y - 1.8, z + w * 0.36, 0, 1, 0, 0.6), { solid: false, shadow: false });
  for (const e of [-1, 1]) kit.add(M.rail, tube([V(x0, y + 1.2, z + e * w / 2), V(x1, y + 1.2 - drop, z + e * w / 2)], 0.08, 1, 3), { solid: false, shadow: false });
  for (let i = 0; i < 3; i++) kit.add(M.pipe, tube([V(x0, y - 3.4 - i * 0.7, z + (rng() - 0.5) * w), V(x1, y - 3.4 - i * 0.7 - drop, z + (rng() - 0.5) * w)], 0.3, 2, 6), { solid: false, shadow: false });
  for (let i = 0; i < Math.floor(L / 3); i++) {
    const t = rng(), px = x0 + L * t;
    kit.add(M.crowd[Math.floor(rng() * M.crowd.length)], new THREE.CylinderGeometry(0.22, 0.28, 1.6, 6).translate(px, y + 1.4 - drop * t, z + (rng() - 0.5) * w * 0.6), { solid: false, shadow: false });
  }
}
/** A market stall at the foot of a wall: a counter, a slanted awning, heaps of goods, a sign, a lamp. */
function stall(kit, M, rng, { x, z, w = 4, face = 1 }) {
  const fx = face, a = M.awning[Math.floor(rng() * M.awning.length)];
  kit.add(M.walls[Math.floor(rng() * M.walls.length)], new THREE.BoxGeometry(2, 1.1, w).translate(x + fx * 0.5, 0.55, z), { shadow: false });
  kit.add(a, put(new THREE.BoxGeometry(2.6, 0.08, w * 1.05), x + fx * 1.2, 2.8, z, 0, 1, 0, -fx * 0.3), { solid: false, shadow: false });
  for (let i = 0; i < 8; i++) kit.add(M.goods[Math.floor(rng() * M.goods.length)], new THREE.SphereGeometry(0.18 + rng() * 0.15, 6, 5).translate(x + fx * (0.2 + rng() * 1.1), 1.25, z + (rng() - 0.5) * w * 0.9), { solid: false, shadow: false });
  kit.add(M.screens[Math.floor(rng() * M.screens.length)], put(new THREE.BoxGeometry(0.15, 0.9, w * 0.8), x - fx * 0.4, 3.6, z), { solid: false, shadow: false });
  kit.add(M.lamp, new THREE.SphereGeometry(0.18, 8, 6).translate(x + fx * 1.6, 2.4, z), { solid: false, shadow: false });
}
/** A flying cab: a yellow body, a dark canopy, s its scale. */
function cab(kit, M, [x, y, z], yaw = 0, s = 1) {
  kit.add(M.cab, put(new THREE.BoxGeometry(2.0 * s, 0.7 * s, 4.2 * s), x, y, z, yaw), { solid: false, shadow: false });
  kit.add(M.cabDark, put(new THREE.BoxGeometry(1.7 * s, 0.6 * s, 1.9 * s), x, y + 0.6 * s, z, yaw), { solid: false, shadow: false });
}
/** A crowd: n walkers in coloured coats over the street, between x0..x1 and z0..z1, heads, a few hats. */
function crowd(kit, M, rng, { n, x0, x1, z0, z1 }) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * (x1 - x0), z = z0 + rng() * (z1 - z0), h = 1.5 + rng() * 0.35;
    kit.add(M.crowd[Math.floor(rng() * M.crowd.length)], new THREE.CylinderGeometry(0.2, 0.32, h * 0.8, 7).translate(x, h * 0.4, z), { solid: false, shadow: false });
    kit.add(M.skin, new THREE.SphereGeometry(0.13, 7, 5).translate(x, h * 0.88, z), { solid: false, shadow: false });
  }
}
/** The traveller seen from behind (the sheets' lavender suit, the bubble helmet, the cream pack), s his scale. */
function traveller(kit, M, x, z, s = 1, yaw = 0) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.35, 10).translate(0, 0.7, 0), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).translate(0, 1.55, 0), M.skin));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12).translate(0, 1.58, 0), M.glass));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.26).translate(0, 1.0, 0.3), M.pack));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 4).translate(0.18, 1.7, 0.36), M.cable));
  g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(s);
  g.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(g);
}

/**
 * A panel's scene: a street down -z between two rows of towers. o: { width (the street's), rows: { z0,
 * z1, h: [min, max], gap }, towers: [extra…], bridges: [skybridge…], stalls (a share of the walls' feet),
 * cabs: [[x, y, z, yaw, s]…], cables, crowd: { n, z1 }, traveller: [x, z, s], far: a spire on the axis }
 */
function marketScene(kit, v, o) {
  const M = materials(kit), rng = mulberry32(o.seed ?? 1), W = o.width ?? 24;
  kit.add(M.paving, new THREE.PlaneGeometry(W + 80, 1400).rotateX(-Math.PI / 2).translate(0, 0.02, -600), { solid: false, shadow: false });
  for (const e of [-1, 1]) kit.add(M.walk, new THREE.BoxGeometry(5, 0.25, 1400).translate(e * (W / 2 - 2.5), 0.12, -600), { solid: false, shadow: false });
  const R = o.rows ?? {};
  for (const side of [-1, 1]) {
    for (let z = R.z0 ?? 10; z > (R.z1 ?? -700);) {
      const d = 10 + rng() * 22, w = 12 + rng() * 14, [h0, h1] = R.h ?? [40, 160], h = h0 + rng() * (h1 - h0) * Math.min(1, 0.5 + (-z) / 300);
      const round = rng() < 0.3;
      tower(kit, M, rng, { x: side * (W / 2 + w / 2 + (R.gap ?? 0) * rng()), z: z - d / 2, w: round ? Math.min(w, d) : w, d: round ? Math.min(w, d) : d, h, round, face: -side });
      if (rng() < (o.stalls ?? 0.7) && z > -260) for (let k = 0; k < 2; k++) stall(kit, M, rng, { x: side * (W / 2 - 4.6), z: z - 2 - k * 4.5, w: 4, face: -side });
      z -= d + rng() * 2;
    }
  }
  for (const t of o.towers ?? []) tower(kit, M, rng, t);
  for (const b of o.bridges ?? []) skybridge(kit, M, rng, { x0: -W / 2 - 4, x1: W / 2 + 4, ...b });
  for (const [x, y, z, yaw, s] of o.cabs ?? []) cab(kit, M, [x, y, z], yaw, s);
  for (let i = 0; i < (o.cables ?? 0); i++) {
    const z = -10 - rng() * 200, y = 8 + rng() * 30;
    kit.add(M.cable, tube(sagPts(V(-W / 2, y, z), V(W / 2, y + (rng() - 0.5) * 6, z - (rng() - 0.5) * 20), 1 + rng() * 3, 10), 0.05, 10, 3), { solid: false, shadow: false });
  }
  if (o.crowd) crowd(kit, M, rng, { n: o.crowd.n, x0: -W / 2 + 4, x1: W / 2 - 4, z0: -(o.crowd.z0 ?? 6), z1: -(o.crowd.z1 ?? 140) });
  if (o.traveller) traveller(kit, M, ...o.traveller);
  if (o.far) tower(kit, M, rng, { x: o.far[0], z: o.far[1], w: o.far[2], h: o.far[3], round: true, face: 0, mat: M.walls[4], poster: false });
  o.extra?.(kit, M, rng);
}

const flat = { height: () => 0, material: { color: '#a8c9c4', color2: '#a2c3be', color3: '#b0cfca' }, rings: { r1: 2400 } };
const view = (o) => ({ sky: SKY.aqua, look: MARKET_VIEW_LOOK, fog: 0.5, ground: flat, ...o });

export const MARKET_VIEWS = [
  // ===================================================================== IMG_3801 … 3804: single plates
  view({
    id: '3801-street-bridge', title: 'The street under the skybridge, the tall spire', sheet: 'IMG_3801', panel: 1, where: 'the whole plate', crop: [0, 0, 1024, 1024],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 70, pitch: 22 },
    sun: { side: -150, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38011, width: 30, rows: { z0: 10, z1: -400, h: [60, 200] },
        bridges: [{ z: -90, y: 36, w: 6 }, { z: -150, y: 60, w: 4 }],
        cabs: [[-2, 26, -70, 0.3, 1.6], [6, 30, -100, -0.4, 1.2], [8, 62, -130, 0.6, 1.4], [-10, 120, -160, 0.2, 2]],
        cables: 14, crowd: { n: 220, z0: 6, z1: 140 }, traveller: [-6, -5, 1, 0.3],
        far: [6, -320, 16, 420],
      });
    },
  }),
  view({
    id: '3802-street-tower', title: 'Down the street to the great tower and its sign', sheet: 'IMG_3802', panel: 1, where: 'the whole plate', crop: [0, 0, 1024, 1024],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 70, pitch: 18 },
    sun: { side: 150, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38021, width: 28, rows: { z0: 10, z1: -400, h: [60, 180] },
        bridges: [{ z: -120, y: 44, w: 5 }, { z: -170, y: 28, w: 4 }],
        towers: [{ x: 4, z: -260, w: 22, h: 300, face: 0 }],
        cabs: [[-4, 60, -60, 0.6, 1.8], [10, 50, -90, -0.3, 1.2]],
        cables: 10, crowd: { n: 220, z0: 4, z1: 160 }, traveller: [2.6, -4.5, 1, 0],
        far: [-10, -360, 18, 460],
      });
    },
  }),
  view({
    id: '3803-pink-tower', title: 'The pink tower, its signs and its bridges', sheet: 'IMG_3803', panel: 1, where: 'the whole plate', crop: [0, 0, 1024, 1024],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 70, pitch: 20 },
    sun: { side: -160, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38031, width: 26, rows: { z0: 10, z1: -400, h: [50, 160] },
        towers: [{ x: -8, z: -170, w: 30, h: 280, face: 0, mat: null }],
        bridges: [{ z: -60, y: 70, w: 5, drop: 20 }, { z: -110, y: 24, w: 4 }],
        cabs: [[-12, 40, -60, 0.4, 1.4], [-6, 26, -80, -0.2, 1.4], [8, 34, -70, 0.8, 1]],
        cables: 10, crowd: { n: 200, z0: 6, z1: 150 }, traveller: [0.4, -4, 1, 0],
        far: [12, -320, 14, 480],
      });
    },
  }),
  view({
    id: '3804-crowded-bridge', title: 'The crowded skybridge and the round towers', sheet: 'IMG_3804', panel: 1, where: 'the whole plate', crop: [0, 0, 1024, 1024],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 72, pitch: 20 },
    sun: { side: 140, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38041, width: 32, rows: { z0: 10, z1: -400, h: [80, 200] },
        bridges: [{ z: -55, y: 26, w: 5, drop: -6 }],
        cabs: [[0, 60, -50, 0.3, 1.6], [-4, 48, -40, -0.5, 1.4], [6, 80, -80, 0.1, 1.2]],
        cables: 8, crowd: { n: 260, z0: 4, z1: 140 }, traveller: [3.2, -3, 1.05, 0],
        far: [4, -300, 14, 420],
      });
    },
  }),
  // ===================================================================== IMG_3805
  view({
    id: '3805-up-bridges', title: 'Up between the towers, a bridge and a cab', sheet: 'IMG_3805', panel: 1, where: 'top left', crop: [18, 18, 358, 485],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 66, pitch: 52 },
    sun: { side: 160, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38051, width: 18, rows: { z0: 10, z1: -200, h: [140, 240] }, stalls: 0,
        bridges: [{ z: -30, y: 70, w: 6 }, { z: -60, y: 50, w: 3 }],
        cabs: [[-2, 130, -40, 0.4, 2.2]],
      });
    },
  }),
  view({
    id: '3805-bridge-overhead', title: 'The bridges overhead between the cream walls', sheet: 'IMG_3805', panel: 2, where: 'top middle', crop: [387, 18, 318, 428],
    camera: { eye: [0, 1.7, 0], yaw: 20, fov: 64, pitch: 46 },
    sun: { side: -150, el: 55 }, sky: SKY.pale,
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38052, width: 20, rows: { z0: 10, z1: -200, h: [140, 240] }, stalls: 0,
        bridges: [{ z: -24, y: 40, w: 8 }, { z: -30, y: 20, w: 8 }],
      });
    },
  }),
  view({
    id: '3805-billboard-up', title: 'Straight up the face of the billboard', sheet: 'IMG_3805', panel: 3, where: 'top right', crop: [718, 18, 290, 488],
    camera: { eye: [0, 1.7, 0], yaw: 30, fov: 62, pitch: 64, roll: 10 },
    sun: { side: 150, el: 55 }, sky: SKY.peach,
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38053, width: 16, rows: { z0: 10, z1: -120, h: [160, 260] }, stalls: 0,
        bridges: [{ z: -40, y: 60, w: 3 }],
      });
    },
  }),
  view({
    id: '3805-stalls', title: 'The stalls under the teal towers', sheet: 'IMG_3805', panel: 4, where: 'bottom left', crop: [18, 520, 286, 488],
    camera: { eye: [0, 1.7, 0], yaw: -28, fov: 62, horizon: 0.72 },
    sun: { side: -120, el: 50 }, sky: SKY.peach,
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38054, width: 20, rows: { z0: 10, z1: -300, h: [80, 200] }, stalls: 1,
        crowd: { n: 30, z0: 6, z1: 40 }, cables: 8,
      });
    },
  }),
  view({
    id: '3805-signal-tower', title: 'Down the avenue to the tower of signs', sheet: 'IMG_3805', panel: 5, where: 'bottom middle, tall', crop: [390, 462, 315, 546],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 74, horizon: 0.8 },
    sun: { side: 150, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38055, width: 34, rows: { z0: 10, z1: -400, h: [30, 110] },
        towers: [{ x: 4, z: -220, w: 34, h: 200, face: 0, mat: null }],
        cabs: [[-4, 30, -70, 0.6, 2]], cables: 10, crowd: { n: 160, z0: 10, z1: 160 }, traveller: [1, -9, 1, 0],
        extra(k, M, rng) { for (let i = 0; i < 14; i++) billboard(k, M, rng, 4 + (rng() - 0.5) * 30, 40 + i * 11, -202, 9 + rng() * 6, 7 + rng() * 4, 0); },
      });
    },
  }),
  view({
    id: '3805-companions', title: 'The traveller and two companions under the sign', sheet: 'IMG_3805', panel: 6, where: 'bottom right', crop: [718, 520, 290, 488],
    camera: { eye: [0, 1.6, 0], yaw: 20, fov: 54, horizon: 0.52 },
    sun: { side: 160, el: 55 },
    build(kit, v) {
      marketScene(kit, v, { seed: 38056, width: 14, rows: { z0: 10, z1: -120, h: [40, 120] }, traveller: [0.4, -3.2, 1, 0] });
    },
  }),
  // ===================================================================== IMG_3806: three tall panels
  view({
    id: '3806-left-wall', title: 'The teal machine wall and its stalls', sheet: 'IMG_3806', panel: 1, where: 'left, tall', crop: [26, 26, 317, 972],
    camera: { eye: [0, 1.7, 0], yaw: -24, fov: 84, horizon: 0.84 },
    sun: { side: -140, el: 55 }, sky: SKY.pale,
    build(kit, v) {
      marketScene(kit, v, { seed: 38061, width: 22, rows: { z0: 20, z1: -300, h: [120, 220] }, stalls: 1, crowd: { n: 40, z0: 4, z1: 60 }, cables: 6 });
    },
  }),
  view({
    id: '3806-avenue', title: 'Down the avenue to the tower of signs, the traveller', sheet: 'IMG_3806', panel: 2, where: 'middle, tall', crop: [354, 26, 318, 972],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 84, horizon: 0.84 },
    sun: { side: 170, el: 55 }, sky: SKY.pale,
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38062, width: 30, rows: { z0: 10, z1: -400, h: [100, 220] },
        towers: [{ x: 0, z: -200, w: 20, h: 160, face: 0 }],
        bridges: [{ z: -40, y: 90, w: 6 }, { z: -100, y: 24, w: 5 }],
        cabs: [[-2, 60, -60, 0.4, 1.6], [2, 36, -80, -0.3, 1.2]],
        crowd: { n: 80, z0: 10, z1: 120 }, traveller: [0, -4, 1, 0], far: [2, -320, 10, 480],
      });
    },
  }),
  view({
    id: '3806-right-wall', title: 'The pink column and the pipes of the right wall', sheet: 'IMG_3806', panel: 3, where: 'right, tall', crop: [684, 26, 316, 972],
    camera: { eye: [0, 1.7, 0], yaw: 24, fov: 84, horizon: 0.84 },
    sun: { side: 140, el: 55 }, sky: SKY.pale,
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38063, width: 22, rows: { z0: 20, z1: -300, h: [120, 220] }, stalls: 1, crowd: { n: 30, z0: 4, z1: 60 },
        towers: [{ x: 8, z: -14, w: 6, h: 200, round: true, face: -1, poster: false, mat: null }],
      });
    },
  }),
  // ===================================================================== IMG_3807
  view({
    id: '3807-bridge-cabs', title: 'The bridge between the towers, cabs under it', sheet: 'IMG_3807', panel: 1, where: 'top left', crop: [18, 17, 486, 487],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 64, pitch: 36 },
    sun: { side: -150, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38071, width: 24, rows: { z0: 10, z1: -300, h: [120, 220] }, stalls: 0,
        bridges: [{ z: -60, y: 44, w: 6, drop: -14 }],
        cabs: [[-4, 18, -40, 0.4, 1.6], [6, 16, -46, -0.3, 1.4]],
      });
    },
  }),
  view({
    id: '3807-tower-of-signs', title: 'The tower of signs, a cab in the foreground', sheet: 'IMG_3807', panel: 2, where: 'top right', crop: [520, 17, 486, 487],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.85 },
    sun: { side: 150, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38072, width: 40, rows: { z0: -30, z1: -400, h: [60, 180] }, stalls: 0,
        towers: [{ x: -6, z: -110, w: 24, h: 140, face: 0 }],
        bridges: [{ z: -120, y: 16, w: 4 }],
        cabs: [[-9, 1.2, -9, 0.3, 1.2]], crowd: { n: 30, z0: 30, z1: 160 },
        extra(k, M, rng) { for (let i = 0; i < 6; i++) billboard(k, M, rng, -6, 30 + i * 18, -97.5, 20, 14, 0); },
      });
    },
  }),
  view({
    id: '3807-arcade-bridge', title: 'The arcade under the truss bridge', sheet: 'IMG_3807', panel: 3, where: 'bottom left', crop: [18, 518, 486, 487],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 62, horizon: 0.7 },
    sun: { side: 160, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38073, width: 18, rows: { z0: 10, z1: -300, h: [60, 160] }, stalls: 1,
        bridges: [{ z: -40, y: 18, w: 5 }], cabs: [[2, 12, -50, 0.4, 1.2]], cables: 18, crowd: { n: 60, z0: 6, z1: 80 },
      });
    },
  }),
  view({
    id: '3807-traveller-alien', title: 'The traveller walking the street', sheet: 'IMG_3807', panel: 4, where: 'bottom right', crop: [520, 518, 486, 487],
    camera: { eye: [0, 1.7, 0], yaw: 10, fov: 56, horizon: 0.62 },
    sun: { side: 170, el: 55 }, sky: SKY.pale,
    build(kit, v) {
      marketScene(kit, v, { seed: 38074, width: 20, rows: { z0: 10, z1: -400, h: [40, 160] }, stalls: 1, crowd: { n: 30, z0: 10, z1: 60 }, traveller: [-0.5, -3, 1, 0], far: [-4, -260, 8, 300] });
    },
  }),
  // ===================================================================== IMG_3808
  view({
    id: '3808-up-pink', title: 'Up the pink and teal towers', sheet: 'IMG_3808', panel: 1, where: 'top left', crop: [16, 14, 489, 488],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 62, pitch: 48 },
    sun: { side: -160, el: 55 },
    build(kit, v) {
      marketScene(kit, v, { seed: 38081, width: 20, rows: { z0: 10, z1: -200, h: [140, 240] }, stalls: 0, bridges: [{ z: -40, y: 40, w: 6, drop: 10 }], cabs: [[-2, 30, -30, 0.6, 1.4]] });
    },
  }),
  view({
    id: '3808-bridge-spire', title: 'The bridge before the spire, cables everywhere', sheet: 'IMG_3808', panel: 2, where: 'top right', crop: [521, 14, 485, 488],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 62, pitch: 38 },
    sun: { side: 150, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38082, width: 26, rows: { z0: 10, z1: -200, h: [120, 200] }, stalls: 0,
        bridges: [{ z: -60, y: 70, w: 8 }], cables: 24, far: [0, -140, 12, 400],
        towers: [{ x: -8, z: -100, w: 14, h: 90, face: 0 }],
      });
    },
  }),
  view({
    id: '3808-long-street', title: 'The long street of stalls', sheet: 'IMG_3808', panel: 3, where: 'bottom left', crop: [16, 521, 488, 489],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.78 },
    sun: { side: -160, el: 55 },
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38083, width: 22, rows: { z0: 10, z1: -400, h: [60, 160] }, stalls: 1,
        bridges: [{ z: -120, y: 30, w: 4 }, { z: -160, y: 50, w: 4 }], cabs: [[-2, 40, -60, 0.4, 1.6], [4, 46, -70, -0.2, 0.8]], crowd: { n: 30, z0: 10, z1: 200 },
      });
    },
  }),
  view({
    id: '3808-cream-walls', title: 'The traveller between the cream walls', sheet: 'IMG_3808', panel: 4, where: 'bottom right', crop: [521, 521, 485, 489],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 56, horizon: 0.62 },
    sun: { side: 160, el: 55 }, sky: SKY.pale,
    build(kit, v) {
      marketScene(kit, v, {
        seed: 38084, width: 30, rows: { z0: 10, z1: -300, h: [60, 160] }, stalls: 0,
        bridges: [{ z: -60, y: 20, w: 5 }], crowd: { n: 20, z0: 20, z1: 60 }, traveller: [1.8, -3, 1, 0],
        towers: [{ x: 18, z: -10, w: 10, h: 120, face: -1, mat: null, poster: false }],
      });
    },
  }),
];
