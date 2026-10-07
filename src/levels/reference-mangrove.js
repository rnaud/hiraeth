import * as THREE from 'three';
import { MODE_WATER } from '../materials.js';
import { mulberry32 } from '../noise.js';
import { V, CLEAN_SKY } from './reference-kit.js';
import { bankBush } from './wood-kit.js';
import { whiteTree, rootArch, podHouse, walkway, stairs, punt, glowSpots, farTree, lantern, stick, limb, MANGROVE_LOOK, MANGROVE_TONES } from './mangrove-kit.js';

// ---------------------------------------------------------------------------
// The White Mangrove's reference sheets (references/The White Mangrove/reference-1 … 4): a settlement
// in a mangrove of enormous smooth bone-white trees standing on arching roots in a black lake, small
// rounded houses in the forks and on decks, plank walks on stilts with lanterns, flat boats, the
// lake's blue and pink creatures glowing like a second sky, a violet twilight, the traveller on a
// landing stage in the foreground. Each sheet is one composition: one view each. One scene builder
// (mangroveScene) does them all (reference-views.js describes the fields).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The White Mangrove / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The White Mangrove/reference-${n}.jpeg`, import.meta.url).href });
export const MANGROVE_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`mangrove-${n}`, sheet(n)]));

/** The sheets' ink: the world's own look (mangrove-kit.js) and a clean sky. */
export const MANGROVE_VIEW_LOOK = { ...MANGROVE_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow (the lavender-blue), light (the lanterns' pink), sun */
const SKY = {
  violet: ['#1d2250', '#3c3c78', '#7d84c4', '#ffc6c6', '#ffc0b0'],
  starry: ['#1a1e4c', '#6a5a9c', '#8a8ed0', '#ffd0d8', '#ffd0c8'],
  teal: ['#16283e', '#2f4a68', '#7f94c8', '#ffc8c4', '#ffc4b4'],
  rose: ['#1c1f4a', '#9a6aa8', '#8d8ed2', '#ffe4ec', '#ffd0d4'],
};

function materials(kit) {
  const T = MANGROVE_TONES, DS = THREE.DoubleSide;
  return {
    // (the trees: bone-white, pale even in their own shade, the strokes wrapping round each root: form)
    bark: kit.mat({ color: T.bark, shade: 0.35, hatch: 0.45, detail: 'organic', detailDensity: 0.45, form: true }),
    barkPale: kit.mat({ color: T.barkPale, shade: 0.35, hatch: 0.45, detail: 'organic', detailDensity: 0.45, form: true }),
    shell: kit.mat({ color: T.shell, shade: 0.4, hatch: 0.35 }),
    wood: kit.mat({ color: T.wood, flat: true }),
    plank: kit.mat({ color: T.plank, flat: true, pattern: 'cracks' }),
    plank2: kit.mat({ color: T.plank2, flat: true, pattern: 'cracks' }),
    stone: kit.mat({ color: T.stone, flat: true, shade: 0.3, hatch: 0.4, side: DS }),
    lamp: kit.mat({ color: T.lamp, glow: 1, flat: true }),
    window: kit.mat({ color: T.window, glow: 0.95, flat: true }),
    dark: kit.mat({ color: T.dark, flat: true }),
    far: kit.mat({ color: T.far, flat: true, hatch: 0.2, line: 0.6, lineTint: 1 }),
    farDeep: kit.mat({ color: T.farDeep, flat: true, hatch: 0.2, line: 0.5, lineTint: 1 }),
    leaves: kit.mat({ color: T.leaves, shade: 0.5, hatch: 0.25, line: 0.6, lineTint: 0.8 }),   // (soft pale masses, a light line of their own)
    bush: [kit.mat({ color: T.bush, pattern: 'leaves', hatch: 1.6, shade: 0.5, spot: 0 }), kit.mat({ color: T.bush2, pattern: 'leaves', hatch: 1.6, shade: 0.5, spot: 0 })],
    boat: kit.mat({ color: T.boat, flat: true, pattern: 'cracks' }),
    boatIn: kit.mat({ color: T.boatIn, flat: true }),
    water: kit.mat({ color: T.water, color2: T.shallow, mode: MODE_WATER }),
    // the creatures: blue, pink and violet, drawn in a hairline of their own colour (no ink round them)
    spots: T.spots.map((c) => kit.mat({ color: c, glow: 1, flat: true, line: 0.25, lineTint: 1, side: DS })),
    figure: kit.mat({ color: '#5d5a86', flat: true, figure: true }),
    suit: kit.mat({ color: '#9aa6d6', flat: true, figure: true }),
    pack: kit.mat({ color: '#f2c6ee', glow: 0.9, flat: true }),
    pack2: kit.mat({ color: '#a8f0e6', glow: 0.9, flat: true }),
  };
}

const NC = { solid: false, shadow: false };
/** A great tree at (x, z) (wood-kit's roots, made smooth and white: mangrove-kit.js whiteTree), the houses perched in its forks. */
function tree(kit, M, o) {
  const T = whiteTree(o), at = (g) => g.translate(o.x, o.y ?? 0, o.z), m = o.pale ? M.barkPale : M.bark;
  for (const g of [...T.trunk, ...T.roots, ...T.limbs]) kit.add(m, at(g), NC);
  for (const g of T.canopy) kit.add(M.leaves, at(g), NC);
  for (const [k, h] of (o.houses ?? []).entries()) {
    const f = T.forks[h.fork ?? k] ?? T.forks[0];
    house(kit, M, { x: o.x + f.x + (h.dx ?? 0), y: (o.y ?? 0) + f.y + (h.dy ?? 0), z: o.z + f.z + (h.dz ?? 0), yaw: h.yaw ?? -f.az + Math.PI / 2, ...h });
  }
  return T;
}
/** A house on its deck at (x, y, z), its door turned by yaw. */
function house(kit, M, o) {
  const P = podHouse({ R: o.R ?? 3, tall: o.tall ?? 1.1, seed: o.seed ?? o.x * 3 + o.z, windows: o.windows ?? 5, lit: o.lit ?? 0.6, twin: o.twin, deck: o.deck ?? 1.15, struts: o.struts ?? 5 });
  const put = (g) => g.rotateY(o.yaw ?? 0).translate(o.x, o.y, o.z);
  for (const g of P.shell) kit.add(M.shell, put(g), NC);
  for (const g of P.wood) kit.add(M.wood, put(g), NC);
  for (const g of P.dark) kit.add(M.dark, put(g), NC);
  for (const g of P.glow) kit.add(M.window, put(g), NC);
  const c = Math.cos(o.yaw ?? 0), s = Math.sin(o.yaw ?? 0);
  for (const [x, y, z] of P.lamps) {
    const lx = o.x + x * c + z * s, lz = o.z - x * s + z * c, L = lantern(lx, o.y, lz, 1.3);
    for (const g of L.wood) kit.add(M.wood, g, NC);
    for (const g of L.glow) kit.add(M.lamp, g, NC);
  }
  kit.light(o.x + s * (o.R ?? 3) * 1.6, o.y + 1.5, o.z + c * (o.R ?? 3) * 1.6, (o.R ?? 3) * 3);
}
/** A plank walk (mangrove-kit.js walkway) and its lanterns' light. */
function walk(kit, M, pts, o = {}) {
  const W = walkway(pts, o);
  for (const [i, g] of W.planks.entries()) kit.add(i % 3 ? M.plank : M.plank2, g, NC);
  for (const g of W.wood) kit.add(M.wood, g, NC);
  for (const g of W.glow) kit.add(M.lamp, g, NC);
  for (const [x, y, z] of W.lamps) kit.light(x, y, z, o.glow ?? 7);
}
/** A flat boat at (x, z) heading yaw, with `people` standing in it (one with a pole). */
function boat(kit, M, rng, { x, z, yaw = 0, L = 7, W = 1.5, people = 1, lamp = false }) {
  const P = punt(L, W), put = (g) => g.rotateY(yaw).translate(x, 0, z);
  for (const g of P.hull) kit.add(M.boat, put(g), NC);
  for (const g of P.floor) kit.add(M.boatIn, put(g), NC);
  for (let i = 0; i < people; i++) {
    const t = (i / Math.max(people, 1) - 0.4) * L * 0.6, px = x + Math.sin(yaw) * t, pz = z + Math.cos(yaw) * t;
    figure(kit, M, px, 0.37, pz, 1 + (rng() - 0.5) * 0.15, i === 0);
  }
  if (lamp) { const lx = x + Math.sin(yaw) * L * 0.42, lz = z + Math.cos(yaw) * L * 0.42; kit.add(M.lamp, new THREE.SphereGeometry(0.22, 8, 6).translate(lx, 1.6, lz), NC); kit.add(M.wood, stick(V(lx, 0.4, lz), V(lx, 1.5, lz), 0.04), NC); kit.light(lx, 1.6, lz, 6); }
}
/** A small cloaked figure (a boatman, a walker on a deck): s its scale; pole: a punting pole. */
function figure(kit, M, x, y, z, s = 1, pole = false) {
  kit.add(M.figure, new THREE.ConeGeometry(0.32 * s, 1.35 * s, 8).translate(x, y + 0.67 * s, z), NC);
  kit.add(M.figure, new THREE.SphereGeometry(0.17 * s, 8, 6).translate(x, y + 1.45 * s, z), NC);
  if (pole) kit.add(M.wood, stick(V(x + 0.3, y - 2, z + 0.2), V(x + 0.5, y + 2.6 * s, z - 0.1), 0.03), NC);
}
/** The traveller on the landing stage, seen from behind, the luminous pack on the back (+z of yaw: toward the camera). */
function traveller(kit, M, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.2, 10).translate(0, 0.62, 0), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8).translate(0, 1.42, 0), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10).scale(1, 1.25, 0.75).translate(0, 1.05, 0.28), M.pack));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).scale(1, 1.2, 0.7).translate(0.1, 0.9, 0.44), M.pack2));
  g.position.set(x, y, z); g.rotation.y = yaw;
  g.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(g);
  kit.light(x, y + 1.1, z + 0.4, 3);
}
/** A dark bush at the frame's edge (the sheets' near foliage). */
function bush(kit, M, rng, x, y, z, r) {
  kit.add(M.bush[Math.floor(rng() * 2)], bankBush(x * 7 + z).scale(r, r * 0.9, r).translate(x, y + r * 0.3, z), NC);
}

/**
 * A panel's scene. o: { seed, trees: [whiteTree opts + { x, z, houses }], arches: [[A, B, opts]…], houses: [house…],
 * walks: [[pts, opts]…], stairs: [[A, B, opts]…], boats, deck: { x0, x1, z0, z1, y }, stage (a pale stone causeway:
 * pts, w), spots: { n, … }, far: { n, z0, z1 }, bushes: [[x, y, z, r]…], traveller: [x, z, yaw], extra }
 */
function mangroveScene(kit, v, o) {
  const M = materials(kit), rng = mulberry32(o.seed ?? 1);
  kit.mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2).translate(0, 0, -800), M.water, NC);
  // the wood behind: thin grey trunks in the haze, rank on rank
  const F = o.far ?? {};
  for (let i = 0; i < (F.n ?? 80); i++) {
    const x = (rng() - 0.5) * (F.w ?? 500), z = -(F.z0 ?? 90) - rng() * ((F.z1 ?? 400) - (F.z0 ?? 90)), [h0, h1] = F.h ?? [40, 90], h = h0 + rng() * (h1 - h0);
    for (const g of farTree(i + (o.seed ?? 1), h, (F.r ?? 1) * (0.6 + rng() * 0.9))) kit.add(-z > (F.deep ?? 200) ? M.farDeep : M.far, g.translate(x, 0, z), NC);
  }
  for (const t of o.trees ?? []) tree(kit, M, t);
  for (const [A, B, op] of o.arches ?? []) for (const g of rootArch(A, B, op)) kit.add(op?.pale ? M.barkPale : M.bark, g, NC);
  for (const h of o.houses ?? []) house(kit, M, h);
  for (const [pts, op] of o.walks ?? []) walk(kit, M, pts, op);
  for (const [A, B, op] of o.stairs ?? []) { const S = stairs(A, B, op); for (const g of S.planks) kit.add(M.plank, g, NC); for (const g of S.wood) kit.add(M.wood, g, NC); }
  for (const b of o.boats ?? []) boat(kit, M, rng, b);
  // the landing stage under the camera: planks on a frame, posts at its edge
  if (o.deck) {
    const { x0, x1, z0, z1, y = 0.5 } = o.deck, n = Math.round((x1 - x0) / 0.55);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * ((x1 - x0) / n), l = (z0 - z1) * (0.85 + rng() * 0.15);
      kit.add(i % 4 ? M.plank : M.plank2, new THREE.BoxGeometry((x1 - x0) / n * 0.94, 0.14, l).translate(x, y - 0.07, z0 - l / 2 + (rng() - 0.5) * 0.3));
    }
    for (let i = 0; i <= 6; i++) { const x = x0 + ((x1 - x0) * i) / 6; kit.add(M.wood, new THREE.CylinderGeometry(0.16, 0.18, y + 3 + rng() * 0.6, 6).translate(x, (y + 3) / 2 - 2.6 + rng() * 0.5, z1 + 0.3), NC); }
    kit.add(M.wood, new THREE.BoxGeometry(x1 - x0, 0.3, 0.3).translate((x0 + x1) / 2, y - 0.25, z1 + 0.15), NC);
  }
  if (o.stage) {
    // a pale causeway of stone (reference-4): a slab along a curve, its edge a darker band
    const { pts, w = 6, y = 0.6 } = o.stage, c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, y, z))), n = 60, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = c.getPointAt(i / n), t = c.getTangentAt(i / n), s = V(-t.z, 0, t.x).normalize().multiplyScalar(w / 2);
      for (const q of [p.clone().sub(s), p.clone().add(s)]) pos.push(q.x, y, q.z);
      for (const q of [p.clone().sub(s), p.clone().add(s)]) pos.push(q.x, y - 2.5, q.z);
      if (i < n) { const a = i * 4; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5, a + 2, a, a + 6, a, a + 4, a + 6, a + 1, a + 3, a + 5, a + 3, a + 7, a + 5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    kit.add(M.stone, g);
  }
  if (o.spots) for (const [k, list] of glowSpots(o.spots.n ?? 900, { x0: -60, x1: 60, z0: -3, z1: -160, seed: o.seed, ...o.spots }).entries()) for (const g of list) kit.add(M.spots[k % M.spots.length], g, NC);
  for (const [x, y, z, r] of o.bushes ?? []) bush(kit, M, rng, x, y, z, r);
  if (o.traveller) traveller(kit, M, o.traveller[0], o.deck?.y ?? o.stage?.y ?? 0.5, o.traveller[1], o.traveller[2] ?? 0);
  o.extra?.(kit, M, rng);
}

// ---------------------------------------------------------------- grounds
const BED = { color: '#1a1f3a', color2: '#1d2340', color3: '#222848' };
/** The lake's bed under the black water, the landing stage's footing (dry: the camera's traveller stands on it). */
const lake = (dry = null) => ({
  height: (x, z) => (dry && x > dry[0] && x < dry[1] && z < dry[2] && z > dry[3] ? dry[4] - 0.15 : -3),
  material: BED, rings: { r1: 2200 },
});

const view = (o) => ({ sky: SKY.violet, look: MANGROVE_VIEW_LOOK, fog: 1.2, ...o });
// the twilight's light: low, from behind the camera a little to one side, so the trees' faces toward you are lit pink
const DUSK = { side: 150, el: 8 };

export const MANGROVE_VIEWS = [
  view({
    id: 'mangrove-1-landing', title: 'The landing stage, the lit roots and the long walk', sheet: 'mangrove-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 3.5, 0], yaw: 0, fov: 52, horizon: 0.62 },
    sun: { side: -125, el: 7 },
    ground: lake([-14, 9, 2, -10.3, 0.5]),
    build(kit, v) {
      mangroveScene(kit, v, {
        seed: 41001,
        deck: { x0: -14, x1: 9, z0: 2, z1: -10.3, y: 0.5 },
        traveller: [1.2, -8.7, 0.1],
        trees: [
          // the left tree: its roots' mass lit by a doorway, a great limb sweeping up across the frame
          { x: -16, z: -30, h: 15, r: 2.2, crown: 6.5, reach: 8, roots: 13, small: 14, seed: 1, lean: [2, 0],
            limbs: [{ az: -0.35, len: 26, rise: 22, r: 0.7 }, { az: -2.6, len: 10, rise: 14, r: 0.6 }] },
          // the right tree: its crown of roots wide over the water, its trunk sweeping up to the left
          { x: 20, z: -40, h: 20, r: 2.8, crown: 8, reach: 10, roots: 14, small: 16, seed: 2, lean: [-9, -2],
            limbs: [{ az: -2.9, len: 18, rise: 14, r: 0.6 }, { az: -0.3, len: 16, rise: 22, r: 0.65 }],
            houses: [{ R: 2.8, fork: 1, dx: 4, yaw: -0.4 }] },
          // the ones behind, lesser, a house or two each
          { x: -1, z: -62, h: 12, r: 1.8, crown: 5, reach: 6, roots: 7, seed: 3, houses: [{ R: 2.6, yaw: 0.2 }, { R: 2.2, yaw: -0.5 }] },
          { x: 13, z: -70, h: 13, r: 1.8, crown: 5, reach: 6, roots: 7, seed: 4, houses: [{ R: 2.6, yaw: -0.4 }] },
          { x: -22, z: -66, h: 13, r: 1.8, crown: 5, reach: 6, roots: 7, seed: 5, houses: [{ R: 2.4, yaw: 0.6 }] },
          { x: 30, z: -60, h: 16, r: 2.2, crown: 6, reach: 7, roots: 7, seed: 6, houses: [{ R: 2.8, yaw: -0.8 }] },
          { x: 8, z: -100, h: 14, r: 1.8, crown: 5, reach: 6, roots: 6, seed: 7, pale: true, houses: [{ R: 2.4 }] },
        ],
        houses: [
          { x: -18, y: 11, z: -30, R: 3.4, yaw: 0.5, deck: 1.4 }, { x: -6, y: 15, z: -38, R: 3, yaw: 0.2, tall: 1.2 },
          { x: 9, y: 14, z: -46, R: 3, yaw: -0.2 }, { x: 18, y: 16, z: -52, R: 2.8, yaw: -0.5 }, { x: 25, y: 9, z: -40, R: 2.6, yaw: -0.8 },
          { x: 2, y: 8, z: -50, R: 2.2, yaw: 0 },
        ],
        arches: [
          [[-9, 0, -44], [-1, 0, -48], { h: 3, r: 0.8, seed: 1 }], [[2, 0, -46], [8, 0, -50], { h: 3.4, r: 0.8, seed: 2 }],
          [[-26, 0, -44], [-18, 0, -40], { h: 4, r: 1, seed: 4 }], [[26, 0, -44], [34, 0, -48], { h: 4, r: 1, seed: 5 }],
        ],
        walks: [
          [[[-14, 2.8, -45], [-2, 3.1, -47], [10, 2.9, -46], [22, 3.2, -44]], { lamp: 2.6, stilt: 2.5, seed: 1, w: 2 }],
          [[[9, 14, -46], [14, 15, -50], [18, 16, -52]], { lamp: 2.5, sag: 0.4, stilt: 0 }],
          [[[-18, 11, -30], [-12, 13, -34], [-6, 15, -38]], { lamp: 2.5, sag: 0.3, stilt: 0 }],
          [[[26, 9, -40], [30, 8.5, -32], [33, 8, -24]], { lamp: 2.5, stilt: 0, sag: 0.3 }],
        ],
        stairs: [[[-9, 3, -43], [-14, 10.6, -31], { w: 1 }]],
        boats: [{ x: -3.6, z: -22, yaw: 1.35, L: 8, W: 1.4, people: 2 }, { x: 6.5, z: -13.5, yaw: 1.5, L: 8, W: 1.8, people: 1 }, { x: 0.5, z: -32, yaw: 1.6, L: 6, people: 1, lamp: true }],
        spots: { n: 9000, z0: -9, z1: -60, s0: 0.05, s1: 0.3, x0: -30, x1: 40, near: 0.7 },
        far: { n: 320, z0: 60, z1: 260, w: 300, deep: 120, h: [28, 50], r: 2.2 },
        bushes: [[-8.6, 0.5, -5, 1.6], [-9.4, 0.5, -8, 1.8], [-8.5, 0.5, -2.5, 1.2]],
        extra(k, M) {
          // the dark tree at the left edge, near
          k.add(M.dark, limb([V(-8.4, -1, -9), V(-8.6, 8, -9.2), V(-8.2, 30, -9)], 0.9, 0.7, 10, 10), NC);
          // the lit doorways in the roots
          k.add(M.window, new THREE.CircleGeometry(1.2, 14).scale(1, 1.6, 1).translate(-19.5, 2.2, -24), NC); k.light(-19, 2.4, -22, 9);
          k.add(M.window, new THREE.CircleGeometry(0.9, 14).scale(1, 1.5, 1).translate(14, 2, -26), NC); k.light(14, 2, -24, 8);
          // posts along the deck's front
          for (let i = 0; i < 6; i++) k.add(M.wood, new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6).translate(-11 + i * 1.6, 0.6, -10.4), NC);
        },
      });
    },
  }),
  view({
    id: 'mangrove-2-colonnade', title: 'The colonnade of roots under the starry canopy', sheet: 'mangrove-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 4.2, 0], yaw: 0, fov: 52, horizon: 0.62 },
    sun: { side: -110, el: 9 }, sky: SKY.starry,
    ground: lake([-26, 6, 2, -14, 0.6]),
    build(kit, v) {
      mangroveScene(kit, v, {
        seed: 41002,
        deck: { x0: -26, x1: 6, z0: 2, z1: -14, y: 0.6 },
        traveller: [-4.2, -12.6, -0.2],
        trees: [
          { x: -7, z: -44, h: 22, r: 3.6, crown: 9, reach: 12, roots: 13, seed: 11, canopy: true, lean: [2, 0],
            limbs: [{ az: -0.4, len: 18, rise: 14, r: 0.6 }, { az: -2.4, len: 16, rise: 16, r: 0.6 }, { az: -1.4, len: 8, rise: 20, r: 0.6 }] },
          { x: 13, z: -62, h: 20, r: 2.8, crown: 8, reach: 10, roots: 12, seed: 12, canopy: true },
          { x: 31, z: -56, h: 20, r: 3.2, crown: 9, reach: 11, roots: 12, seed: 13, canopy: true },
          { x: -30, z: -40, h: 24, r: 3.8, crown: 10, reach: 12, roots: 13, seed: 14, canopy: true },
          { x: 52, z: -70, h: 22, r: 3, crown: 8, reach: 10, roots: 11, seed: 15, canopy: true },
          { x: -2, z: -100, h: 18, r: 2.4, crown: 7, reach: 8, roots: 10, seed: 16, canopy: true, pale: true },
          { x: 30, z: -110, h: 18, r: 2.4, crown: 7, reach: 8, roots: 10, seed: 17, canopy: true, pale: true },
        ],
        houses: [
          { x: -11, y: 17, z: -40, R: 4, yaw: 0.3 }, { x: -22, y: 28, z: -48, R: 4, yaw: 0.6 }, { x: -10, y: 24, z: -62, R: 3, yaw: 0.2 },
          { x: 28, y: 20, z: -54, R: 3.6, yaw: -0.5 }, { x: 14, y: 18, z: -64, R: 3, yaw: -0.2, tall: 1.3 }, { x: 4, y: 13, z: -56, R: 2.4, yaw: 0 },
          { x: -34, y: 12, z: -34, R: 3, yaw: 0.8 }, { x: 33, y: 9, z: -48, R: 2, yaw: -0.4 },
        ],
        arches: [
          [[-1, 0, -48], [9, 0, -60], { h: 6, r: 1.6, seed: 21 }], [[18, 0, -60], [26, 0, -56], { h: 6, r: 1.5, seed: 22 }],
          [[-24, 0, -42], [-14, 0, -44], { h: 7, r: 1.6, seed: 24 }], [[38, 0, -60], [46, 0, -66], { h: 6, r: 1.4, seed: 23 }],
          [[4, 0, -88], [14, 0, -92], { h: 5, r: 1.1, seed: 25, pale: true }],
        ],
        walks: [
          [[[-34, 4.5, -36], [-22, 4.8, -34], [-10, 4.6, -36]], { lamp: 2.6, stilt: 3, seed: 2 }],
          [[[-6, 14, -50], [6, 14.5, -54], [16, 14, -58], [26, 13, -54]], { lamp: 2.6, stilt: 0, sag: 0.6, seed: 3 }],
        ],
        stairs: [[[14, 0.4, -36], [24, 8.6, -46], { w: 1.3 }]],
        boats: [{ x: -16, z: -20, yaw: 1.5, L: 7, people: 0 }, { x: 14, z: -24, yaw: 1.6, L: 9, W: 1.6, people: 0 }, { x: 24, z: -18, yaw: 1.5, L: 9, W: 1.6, people: 0 }],
        spots: { n: 2200, z0: -10, z1: -60, s0: 0.2, s1: 0.6, x0: -20, x1: 40, near: 0.8 },
        far: { n: 200, z0: 70, z1: 260, w: 300, deep: 130, h: [24, 40], r: 1.8 },
        extra(k, M) {
          for (const [x, z] of [[-7, -36], [-30, -32], [31, -49]]) { k.add(M.dark, new THREE.CircleGeometry(1.2, 12).scale(1, 1.4, 1).translate(x, 0.8, z), NC); }
        },
      });
    },
  }),
  view({
    id: 'mangrove-3-gate', title: 'Between the two great trees, the stair down to the boat', sheet: 'mangrove-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 5.4, 0], yaw: 0, fov: 52, horizon: 0.62 },
    sun: { side: -105, el: 8 }, sky: SKY.teal,
    ground: lake([-24, 6, 2, -18, 0.4]),
    build(kit, v) {
      mangroveScene(kit, v, {
        seed: 41003,
        deck: { x0: -24, x1: 6, z0: 2, z1: -18, y: 0.4 },
        traveller: [-2.6, -16.7, 0.2],
        trees: [
          { x: -18, z: -52, h: 30, r: 4.4, crown: 12, reach: 15, roots: 14, small: 16, seed: 31, lean: [6, 0], limbs: [{ az: -0.3, len: 16, rise: 26, r: 0.6 }, { az: -2.8, len: 10, rise: 18, r: 0.5 }] },
          { x: 22, z: -58, h: 26, r: 4.4, crown: 12, reach: 15, roots: 14, small: 16, seed: 32, lean: [4, -4], limbs: [{ az: -2.9, len: 34, rise: 22, r: 0.6 }, { az: -0.8, len: 10, rise: 26, r: 0.6 }] },
          { x: 8, z: -120, h: 22, r: 2.6, crown: 8, reach: 9, roots: 10, seed: 33, pale: true, canopy: true },
          { x: -8, z: -150, h: 22, r: 2.6, crown: 8, reach: 9, roots: 10, seed: 34, pale: true },
        ],
        houses: [
          { x: -26, y: 22, z: -56, R: 3, yaw: 0.6, tall: 1.4 }, { x: -22, y: 30, z: -60, R: 2.6, yaw: 0.4, tall: 1.4 }, { x: -12, y: 34, z: -62, R: 2.4, yaw: 0.2 },
          { x: 8, y: 26, z: -76, R: 2.6, yaw: 0 }, { x: 20, y: 30, z: -82, R: 3, yaw: -0.2 }, { x: 30, y: 20, z: -64, R: 3.4, yaw: -0.6 },
          { x: 36, y: 12, z: -56, R: 3, yaw: -0.8 }, { x: 14, y: 22, z: -110, R: 3.4, yaw: 0, tall: 1.2 },
        ],
        walks: [
          [[[0, 20, -80], [8, 21, -78], [18, 20, -80], [28, 19, -70]], { lamp: 2.5, stilt: 0, sag: 0.8, seed: 4 }],
          [[[-30, 12, -46], [-24, 14, -50]], { lamp: 2.4, stilt: 0 }],
        ],
        stairs: [[[-1, 0.8, -38], [-10, 12.6, -48], { w: 1.4 }]],
        boats: [{ x: -11, z: -30, yaw: 1.55, L: 9, people: 1 }, { x: 1, z: -36, yaw: 1.5, L: 8, people: 1, lamp: true }, { x: 16, z: -28, yaw: 1.6, L: 10, W: 1.8, people: 1 }, { x: 8, z: -62, yaw: 1.5, L: 6, people: 1 }],
        spots: { n: 8000, z0: -17, z1: -70, s0: 0.05, s1: 0.3, x0: -30, x1: 40, near: 0.8 },
        far: { n: 280, z0: 80, z1: 260, w: 300, deep: 140, h: [30, 60], r: 2.2 },
        bushes: [[-13, 0.4, -10, 3], [-14, 0.4, -15, 3.4], [-12, 0.4, -5, 2.4], [14, 0, -16, 4], [16, 0, -22, 4.5], [12, 0, -10, 3]],
        extra(k, M) {
          // the dark tower of poles at the left edge, its lamp
          for (const [x, z] of [[-14, -14], [-11.5, -14.5], [-14, -17], [-11.5, -17.5]]) k.add(M.dark, stick(V(x, -2, z), V(x, 22, z), 0.18), NC);
          for (let y = 3; y < 22; y += 4) k.add(M.dark, new THREE.BoxGeometry(3.6, 0.25, 4).translate(-12.8, y, -15.8), NC);
          const L = lantern(-9.6, 0.4, -12, 3.4); for (const g of L.wood) k.add(M.dark, g, NC); for (const g of L.glow) k.add(M.lamp, g, NC); k.light(...L.at, 6);
        },
      });
    },
  }),
  view({
    id: 'mangrove-4-causeway', title: 'The pale causeway, the tree towers in the rose haze', sheet: 'mangrove-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 4.4, 0], yaw: 0, fov: 52, horizon: 0.6 },
    sun: { side: 105, el: 10 }, sky: SKY.rose,
    look: { ...MANGROVE_VIEW_LOOK, uHazeTone: [0.62, 0.42, 0.66, 0.8] },
    ground: lake([-3, 3, 2, -3, 0.6]),
    build(kit, v) {
      mangroveScene(kit, v, {
        seed: 41004,
        stage: { pts: [[6, 4], [5, -6], [1, -14], [-6, -22], [-14, -27], [-26, -30], [-40, -31]], w: 8, y: 0.6 },
        traveller: [2.6, -11.8, -0.3],
        trees: [
          { x: -20, z: -40, h: 28, r: 4.2, crown: 10, reach: 13, roots: 14, small: 14, seed: 41, lean: [3, 0], limbs: [{ az: -0.3, len: 22, rise: 22, r: 0.6 }, { az: -2.2, len: 16, rise: 26, r: 0.6 }] },
          { x: 30, z: -26, h: 26, r: 4, crown: 11, reach: 13, roots: 14, small: 16, seed: 42, pale: true, lean: [2, 0] },
          { x: 3, z: -62, h: 14, r: 2.2, crown: 7, reach: 9, roots: 11, seed: 43 },
        ],
        houses: [
          { x: 14, y: 26, z: -56, R: 5, tall: 1.2, yaw: 0.2 }, { x: -6, y: 18, z: -70, R: 4, yaw: 0.3 },
          { x: 24, y: 16, z: -60, R: 4, yaw: -0.5, tall: 1.3 }, { x: -30, y: 22, z: -64, R: 3.4, yaw: 0.5 },
          { x: 2, y: 12, z: -64, R: 3, yaw: 0 }, { x: 10, y: 10, z: -110, R: 3, yaw: -0.2 }, { x: -14, y: 14, z: -110, R: 3, yaw: 0.2 },
        ],
        walks: [[[[-6, 18, -70], [4, 20, -62], [12, 26, -56]], { lamp: 2.5, stilt: 0, sag: 0, seed: 5 }], [[[-12, 5, -60], [8, 5, -64]], { lamp: 3, stilt: 3, seed: 6 }]],
        arches: [[[-8, 0, -46], [6, 0, -52], { h: 6, r: 1.6, seed: 31 }], [[8, 0, -52], [18, 0, -50], { h: 5, r: 1.4, seed: 32 }]],
        boats: [{ x: -16, z: -22, yaw: 1.2, L: 7, people: 1 }, { x: 12, z: -30, yaw: 1.5, L: 8, people: 1 }, { x: 22, z: -40, yaw: 1.6, L: 7, people: 1 }],
        spots: { n: 5000, z0: -6, z1: -80, s0: 0.05, s1: 0.28, x0: -40, x1: 40, near: 0.8 },
        far: { n: 340, z0: 70, z1: 260, w: 300, deep: 140, h: [40, 70], r: 1.6 },
        extra(k, M) {
          // the tree towers: pale columns flaring into the decks of the houses
          for (const [x, y, z, r] of [[14, 26, -56, 2.4], [-6, 18, -70, 2], [24, 16, -60, 2], [-30, 22, -64, 1.8], [10, 10, -110, 1.4], [-14, 14, -110, 1.4]]) {
            k.add(M.bark, limb([V(x, -1, z), V(x + 0.4, y * 0.5, z), V(x, y - 2, z)], r, 0.7, 12, 12), NC);
            k.add(M.bark, new THREE.LatheGeometry([[r * 0.7, y - 5], [r * 1.5, y - 1.6], [r * 3, y - 0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 16).translate(x, 0, z), NC);
            for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3; k.add(M.bark, limb([V(x + Math.cos(a) * r * 0.8, 4, z + Math.sin(a) * r * 0.8), V(x + Math.cos(a) * r * 1.6, 1.5, z + Math.sin(a) * r * 1.6), V(x + Math.cos(a) * r * 2.4, -1, z + Math.sin(a) * r * 2.4)], r * 0.25, 0.6, 8, 8), NC); }
          }
          // hanging vines
          for (let i = 0; i < 30; i++) { const x = -40 + i * 3, z = -50 - (i % 5) * 12; k.add(M.far, stick(V(x, 60, z), V(x + 0.4, 18 + (i % 7) * 4, z), 0.06), NC); }
        },
      });
    },
  }),
];
export { MANGROVE_SHEETS as SHEETS, MANGROVE_VIEWS as VIEWS };
