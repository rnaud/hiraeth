import * as THREE from 'three';
import { MODE_TERRAIN, makeMaterial } from '../materials.js';
import { mulberry32 } from '../noise.js';
import { gauss, n2, smoothstep, CLEAN_SKY } from './reference-kit.js';
import { DUNE_HAZE } from '../desert-sites.js';
import { glassRidge, glassArch, awningCamp, boulders, glassOptions, painted, withoutDrifts, SAND } from './glass-dunes-kit.js';

// ---------------------------------------------------------------------------
// The Glass Dunes' reference sheets (references/The Glass Dunes/reference-1 … 4.jpeg, one plate each):
// translucent green dunes of fused sand, high frozen waves and walls of glass holding great dark
// silhouettes, a camp of fabric awnings at a ridge's foot, the low evening sun through the glass on
// the amber sand, archways at the walls' feet, the traveller small in the foreground. One scene
// builder (dunesScene) with the Glass Dunes' kit (glass-dunes-kit.js, the world's too); each plate is a
// view (reference-views.js describes the fields).
//
// The plates print the glass flat: a lime foot, mint faces, a teal top, the shade a luminous teal (not
// dark), thin lines in the glass's own green; the sand's shade is the same teal-green (the light come
// through the glass), its light a warm amber.
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Glass Dunes / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Glass Dunes/reference-${n}.jpeg`, import.meta.url).href });
export const GLASS_SHEETS = { 'glassdunes-1': sheet(1), 'glassdunes-2': sheet(2), 'glassdunes-3': sheet(3), 'glassdunes-4': sheet(4) };

/** The plates' ink: a clean sky, the far sand in the desert's stepped warm bands, few strokes. */
export const GLASS_VIEW_LOOK = { ...CLEAN_SKY, ...DUNE_HAZE, uHazeLayers: [160, 1.9, 0.1, 4], uShadowFlat: 0.85, uHatch: 0.5 };
/** sky top, horizon, shadow (the teal-green of the light through the glass), light, sun */
const SKY = {
  peach: ['#93bccb', '#f3cfa6', '#4f9a98', '#fff3df', '#ffe2b4'],
  cream: ['#8fbcb2', '#f5e2ad', '#4f9c86', '#fff6e0', '#ffe9b8'],
  dusk: ['#9aab9f', '#eebd95', '#5f9690', '#fff0dc', '#ffd9a6'],
  blue: ['#86b9d4', '#d8e8bf', '#3f8f7a', '#fff8e6', '#fff0c6'],
};
const sand = (o = {}) => ({ color: SAND[0], color2: SAND[1], color3: SAND[2], ripples: true, sandInk: true, ...o });

function materials(kit) {
  const DS = THREE.DoubleSide;
  return {
    glass: kit.mat(glassOptions()),
    glassFlow: kit.mat(glassOptions({ hatch: 0.1, glow: 0.2 })),
    light: kit.mat({ color: '#d4f8b4', glow: 0.95, flat: true, line: 0.25, lineTint: 1 }),
    dark: kit.mat({ color: '#2f5c4d', flat: true, spot: 0 }),
    pole: kit.mat({ color: '#4b3b30', flat: true }),
    cloth: ['#ead6b4', '#dcb98f', '#d2c6a8', '#c9a27e'].map((c) => kit.mat({ color: c, flat: true, side: DS, hatch: 0.5 })),
    rug: ['#b5523e', '#c98a4a', '#7f6aa0', '#4f8a7f'].map((c) => kit.mat({ color: c, flat: true })),
    crate: kit.mat({ color: '#9b7652', flat: true }),
    float: kit.mat({ color: '#a8f0bd', glow: 0.75, line: 0.45, lineTint: 1 }),
    kiln: kit.mat({ color: '#cf9f76', flat: true, weathered: 0.4 }),
    rock: kit.mat({ color: '#3c4d47', flat: true, hatch: 0.6 }),
    suit: kit.mat({ color: '#c3b4e0', flat: true, figure: true }),
    skin: kit.mat({ color: '#e0b08e', flat: true, figure: true }),
    pack: kit.mat({ color: '#9ff2c4', glow: 0.8, figure: true }),
    helmet: kit.mat({ color: '#cfe8ea', glass: true }),
    folk: ['#6a5a4e', '#4f6460', '#7a5f52'].map((c) => kit.mat({ color: c, flat: true, figure: true })),
  };
}

/** The traveller seen small (the lavender suit, the bubble helmet, the luminous fluid pack), s his scale. */
function traveller(kit, M, x, z, yaw = 0, s = 1) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.3, 10).translate(0, 0.68, 0), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).translate(0, 1.5, 0), M.skin));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12).translate(0, 1.52, 0), M.helmet));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.35, 6, 12).translate(0, 1.1, 0.3), M.pack));
  g.position.set(x, kit.H(x, z), z); g.rotation.y = yaw; g.scale.setScalar(s);
  g.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(g);
}
/** A glassworker, small and dark against the sand (merged). */
function worker(kit, M, rng, x, z) {
  const m = M.folk[Math.floor(rng() * M.folk.length)], y = kit.H(x, z), nd = { solid: false, shadow: false };
  kit.add(m, new THREE.CylinderGeometry(0.16, 0.26, 1.2, 7).translate(x, y + 0.6, z), nd);
  kit.add(m, new THREE.SphereGeometry(0.14, 8, 6).translate(x, y + 1.32, z), nd);
  kit.add(m, new THREE.CylinderGeometry(0.28, 0.28, 0.03, 10).translate(x, y + 1.42, z), nd);
}

/**
 * The ground's paint: the sand's colour times fn(x, z) (rgb), as vertex colours on the view's ground
 * (the level built it before the view: it is the group's first mesh). The light through the glass.
 */
function paintGround(kit, def, fn) {
  const ground = kit.group.children.find((m) => m.isMesh && m.material?.uniforms?.uMode?.value === MODE_TERRAIN);
  if (!ground) return;
  const p = ground.geometry.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const [r, g, b] = fn(p.getX(i), p.getZ(i)); c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
  ground.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
  ground.material = makeMaterial({ mode: MODE_TERRAIN, ...def.ground.material, vertexColors: true });
}
/** A paint: mint-green pools (cx, cz, rx, rz, amount) on the amber sand. */
const pools = (list) => (x, z) => {
  let k = 0;
  for (const [cx, cz, rx, rz, a = 1] of list) k = Math.max(k, a * smoothstep(1, 0.35, Math.hypot((x - cx) / rx, (z - cz) / rz)));
  return [1 - 0.22 * k, 1 + 0.06 * k, 1 - 0.1 * k];
};

/**
 * A plate's scene. o: { ridges: [glassRidge options…] (H filled in), arches: [{ x, z, yaw, w, h }],
 * camps: [{ x, z, yaw, w, d, n }], rocks: [{ x, z, r, n, s0, s1 }], traveller: [x, z, yaw, s],
 * workers: [[x, z]…], paint: [[cx, cz, rx, rz, a]…] }
 */
function dunesScene(kit, v, o) {
  const M = materials(kit), rng = mulberry32(o.seed ?? 1), H = (x, z) => kit.H(x, z);
  for (const [i, r] of (o.ridges ?? []).entries()) {
    const ridge = glassRidge({ H, seed: (o.seed ?? 1) * 7 + i, ...r });
    withoutDrifts(() => kit.add(r.profile === 'flow' ? M.glassFlow : M.glass, ridge.geo, { shadow: r.shadow ?? true, solid: r.solid ?? true }));
  }
  for (const a of o.arches ?? []) glassArch(kit, M, a);
  for (const c of o.camps ?? []) awningCamp(kit, M, rng, c);
  for (const r of o.rocks ?? []) boulders(kit, M.rock, rng, r);
  for (const [x, z] of o.workers ?? []) worker(kit, M, rng, x, z);
  if (o.traveller) traveller(kit, M, ...o.traveller);
  if (o.paint) paintGround(kit, v, pools(o.paint));
  o.extra?.(kit, M, rng);
}
void painted;

const view = (o) => ({ look: GLASS_VIEW_LOOK, fog: 0.3, ...o });
const wave = (x, z, cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
/** A ramp of sand against a wall behind it: rising from the front (+z) to its top at (cx, cz), dropping off behind; skew leans its top to +x. */
const ramp = (x, z, cx, cz, rx, rz, h, skew = 0) => {
  const dz = z - cz, dx = x - cx - skew * dz;
  const front = dz > 0 ? (dz / (rz * 2.2)) ** 2 : (dz / (rz * 0.6)) ** 2;
  return h * Math.exp(-((dx / rx) ** 2 + front));
};

export const GLASS_VIEWS = [
  // ======================================================== reference-1: the great wall, the camp under its ramp
  // (measured off the plate: the traveller 20 m out, so the eye 9 m over his sand; the camp 30 m out, the wall's foot 45–75 m)
  view({
    id: 'glass-1-wall-camp', title: 'The green wall, the camp at the foot of its ramp', sheet: 'glassdunes-1', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 9, 0], yaw: 0, fov: 50, horizon: 0.45 },
    sun: { side: -75, el: 16 }, sky: SKY.peach,
    ground: {
      height: (x, z) => 0.4 * n2(x * 0.03, z * 0.03) + ramp(x, z, 12, -52, 8, 7, 7, 1.1) + wave(x, z, -26, 6, 22, 10, 3) + smoothstep(150, 500, -z) * 3,
      material: sand(), rings: { r1: 2400 },
    },
    build(kit, v) {
      dunesScene(kit, v, {
        seed: 1,
        ridges: [
          { path: [[-260, -330], [-150, -200], [-70, -110], [-10, -62], [40, -52], [90, -55], [140, -45]], height: 70, depth: 90, profile: 'wave', taper: [0.55, 1.15],
            folds: { width: 34, amp: 7, lean: 0.8, crest: 0.15 },
            silhouettes: [{ shape: 'giant', u: 300, y: 2, s: 36 }, { shape: 'head', u: 370, y: 12, s: 30 }, { shape: 'head', u: 210, y: 4, s: 22 }] },
          { path: [[70, -95], [120, -100], [170, -80]], height: 50, depth: 60, profile: 'cliff', folds: { width: 16, amp: 3, lean: 0.4 } },
          { path: [[-760, -840], [-560, -760], [-420, -740]], height: 26, depth: 120, profile: 'dome', folds: { width: 60, amp: 4, lean: 0.2, crest: 0 } },
          // off the frame, behind on the left: its long shadow over the foreground, as the plate's
          { path: [[-45, -30], [-36, -18], [-28, -8]], height: 14, depth: 12, ends: 5, profile: 'dome', folds: { width: 6, amp: 1, lean: 0.2 } },
        ],
        arches: [{ x: 74, z: -70, yaw: -0.5, w: 14, h: 22 }],
        camps: [{ x: 2, z: -33, yaw: 0, w: 14, d: 4, n: 5, h: 2.2 }],
        workers: [[-3, -27.5], [5, -27.8], [9, -28.4]],
        traveller: [11, -18, 0.2],
        paint: [[30, -36, 40, 10, 0.8], [-40, -60, 50, 18, 0.6]],
      });
    },
  }),
  // ======================================================== reference-2: the billowing glass, the camp on its shelf
  // (the traveller 24 m out, the eye 11 m over him; the great billow's foot 37–40 m, its camp 70 m on a shelf)
  view({
    id: 'glass-2-billows', title: 'The billowing glass, the camp on its shelf', sheet: 'glassdunes-2', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 11, 0], yaw: 0, fov: 46, horizon: 0.37 },
    sun: { side: -60, el: 24 }, sky: SKY.cream,
    ground: {
      height: (x, z) => 0.4 * n2(x * 0.03, z * 0.03) + ramp(x, z, 34, -60, 18, 7, 4.5, 0) + smoothstep(150, 500, -z) * 3,
      material: sand(), rings: { r1: 2400 },
    },
    build(kit, v) {
      dunesScene(kit, v, {
        seed: 2,
        ridges: [
          { path: [[-22, -48], [0, -44], [30, -60], [60, -68], [100, -64], [140, -52]], height: 60, depth: 140, profile: 'dome', taper: [0.3, 1.25],
            folds: { width: 24, amp: 10, lean: 0.25, crest: 0.05 }, colours: { mid: '#62c48c', top: '#3f9c7a' } },
          { path: [[-420, -520], [-250, -470], [-80, -420], [40, -380]], height: 55, depth: 200, profile: 'dome', folds: { width: 90, amp: 3, lean: 0.15, crest: 0 } },
          { path: [[-420, -260], [-300, -230], [-200, -215]], height: 30, depth: 140, profile: 'dome', folds: { width: 80, amp: 3, lean: 0.2, crest: 0 } },
          // the green flows across the sand
          { path: [[-90, -30], [-30, -33], [30, -30], [90, -36]], height: 0.5, depth: 4, depthVary: 0.8, profile: 'flow', folds: { width: 30, amp: 0.6, lean: 0 }, shadow: false },
          { path: [[-80, -40], [-20, -38], [40, -41]], height: 0.4, depth: 2.5, depthVary: 0.8, profile: 'flow', folds: { width: 30, amp: 0.6, lean: 0 }, shadow: false },
          { path: [[-60, -18], [0, -21], [60, -17], [110, -22]], height: 0.4, depth: 2, depthVary: 0.8, profile: 'flow', folds: { width: 30, amp: 0.6, lean: 0 }, shadow: false },
        ],
        arches: [{ x: -8.5, z: -45, yaw: 0.1, w: 4, h: 5 }],
        camps: [{ x: 34, z: -54, yaw: -0.15, w: 20, d: 4.5, n: 5, h: 2.8 }],
        workers: [[28, -51.5], [40, -52]],
        traveller: [4.8, -24, 0.1],
        paint: [[0, -36, 60, 12, 0.6]],
      });
    },
  }),
  // ======================================================== reference-3: the silhouettes in the cliffs, the low sun's streaks
  // (the traveller 30 m out, the eye 7 m; the cliffs' feet 55–60 m, 35 m high; the camp at the dune's foot, 55 m)
  view({
    id: 'glass-3-silhouettes', title: 'Giants held in the glass cliffs, the camp under the dune', sheet: 'glassdunes-3', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 7, 0], yaw: 0, fov: 46, horizon: 0.55 },
    sun: { side: -80, el: 12 }, sky: SKY.dusk,
    ground: {
      height: (x, z) => 0.4 * n2(x * 0.03, z * 0.03) + ramp(x, z, 28, -70, 15, 9, 11, 1.2) + smoothstep(150, 500, -z) * 3,
      material: sand(), rings: { r1: 2400 },
    },
    build(kit, v) {
      dunesScene(kit, v, {
        seed: 3,
        ridges: [
          { path: [[-160, -110], [-80, -84], [-20, -74], [40, -72], [90, -62], [140, -40]], height: 40, depth: 60, profile: 'cliff', taper: [0.8, 1.35],
            folds: { width: 26, amp: 2.5, lean: 1.0, crest: 0.04 },
            silhouettes: [{ shape: 'giant', u: 92, y: 0, s: 26 }, { shape: 'beast', u: 250, y: 12, s: 30 }, { shape: 'head', u: 175, y: 2, s: 22 }] },
          { path: [[-75, -22], [-62, -32], [-48, -44]], height: 9, depth: 18, profile: 'dome', folds: { width: 6, amp: 1, lean: 0.3 } },
          // off the frame on the left: the low sun through the gaps between them streaks the sand, as the plate's
          ...[[-95, -8, 16], [-100, -24, 22], [-92, -40, 18], [-110, -58, 26]].map(([x, z, h]) => ({ path: [[x, z + 4], [x - 3, z], [x, z - 4]], height: h, depth: 10, ends: 2.5, profile: 'dome', folds: { width: 5, amp: 0.5, lean: 0 } })),
        ],
        camps: [{ x: 14, z: -54, yaw: 0, w: 12, d: 4, n: 3, h: 2.4 }],
        workers: [[8, -52], [20, -52.5]],
        rocks: [{ x: -14, z: -9, r: 6, n: 7, s0: 0.3, s1: 1.1 }, { x: 16, z: -11, r: 6, n: 5, s0: 0.3, s1: 0.9 }, { x: 0, z: -24, r: 20, n: 10, s0: 0.2, s1: 0.5 }],
        traveller: [-4, -30, 0.1],
        paint: [[-10, -60, 50, 14, 0.7]],
      });
    },
  }),
  // ======================================================== reference-4: the breaking wave over the camp
  // (an eye a metre up; the traveller 26 m out; the dune and its camp 110 m, the wave cresting 85 m over it, the walls 300 m)
  view({
    id: 'glass-4-wave', title: 'The breaking wave over the camp, arches in the walls', sheet: 'glassdunes-4', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.35, 0], yaw: 0, fov: 56, horizon: 0.78 },
    sun: { side: 40, el: 20 }, sky: SKY.blue,
    ground: {
      height: (x, z) => 0.2 * n2(x * 0.03, z * 0.03) + ramp(x, z, -40, -120, 70, 22, 12, 0.3) + smoothstep(200, 600, -z) * 3,
      material: sand(), rings: { r1: 2400 },
    },
    build(kit, v) {
      dunesScene(kit, v, {
        seed: 4,
        ridges: [
          { path: [[-75, -150], [-30, -142], [20, -136], [90, -122], [170, -96]], height: 70, depth: 130, ends: 70,
            profile: 'curl', taper: [1.6, 0.1],
            folds: { width: 30, amp: 4, lean: 0.4, crest: 0.05 },
            silhouettes: [{ shape: 'tree', u: 40, y: 18, s: 40 }] },
          { path: [[-300, -320], [-150, -290], [0, -280], [150, -270], [300, -240]], height: 300, depth: 120, profile: 'cliff', folds: { width: 60, amp: 10, lean: 0.08, crest: 0.05 },
            silhouettes: [{ shape: 'tree', u: 340, y: 20, s: 90 }, { shape: 'tree', u: 430, y: 10, s: 80 }, { shape: 'tree', u: 140, y: 30, s: 100 }] },
          { path: [[-200, -60], [-190, -160], [-200, -270]], height: 260, depth: 80, profile: 'cliff', folds: { width: 30, amp: 6, lean: 0.1 } },
        ],
        arches: [{ x: 180, z: -258, yaw: -0.25, w: 22, h: 34 }, { x: 40, z: -278, yaw: 0, w: 26, h: 90 }],
        camps: [{ x: -40, z: -104, yaw: 0, w: 40, d: 7, n: 7, h: 4 }],
        workers: [[-66, -100]],
        traveller: [5.5, -26, 0.2],
      });
    },
  }),
];
export { GLASS_SHEETS as SHEETS, GLASS_VIEWS as VIEWS };
