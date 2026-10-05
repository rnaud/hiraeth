import * as THREE from 'three';
import { MODE_STRATA, MODE_WATER, MODE_TERRAIN } from '../materials.js';
import { createNoise2D } from '../noise.js';
import {
  TAU, V, tube, lathe, ridged, gauss, r2, smoothstep, put, dome, PERSON, CLEAN_SKY, n2, n3,
  ribcage, stemDish, gorgeWall, bridge, machineHead, tableCliff, petals, cage, strataMat, radioDish, groundRibbon,
} from './reference-kit.js';

// ---------------------------------------------------------------------------
// The other desert environment sheets (references/The Desert/environement/IMG_3772, 3773, 3774):
// the same places drawn again (the ribcage in the dunes, the dish city, the gorge and its bridges,
// the petal station, the turquoise lake under violet cliffs, the buried machines), each panel a view
// as in reference-views.js (its fields are described there). Crops are inside each panel's inked
// border, found on the sheet; colours read off the panel.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `The Desert / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/The Desert/environement/${name}.JPG`, import.meta.url).href });
export const DESERT_SHEETS = { IMG_3772: sheet('IMG_3772'), IMG_3773: sheet('IMG_3773'), IMG_3774: sheet('IMG_3774') };

const n4 = createNoise2D(37754);
/** IMG_3774 prints its cast shadows as near-black ink masses (post.js uSpot.w: cast shadows most of the way to the spot tone). */
const INK_SHADOWS = { ...CLEAN_SKY, uSpot: [1, 3, 0.3, 0.75], uSpotTone: [0.2, 0.15, 0.13, 0.35] };
const sand = (c1, c2, c3, o = {}) => ({ color: c1, color2: c2, color3: c3, ripples: true, sandInk: true, ...o });
/** Dunes: rolling ridged crests whose height grows with the distance (a horizon of dunes). */
const dunes = (x, z, amp = 4, f = 0.012, seed = 0) => amp * ridged(x * 0.6 + seed, z, f, seed) + 0.4 * amp * n2(x * f * 0.5 + seed, z * f * 0.5);
const far = (x, z, at = 300, h = 6) => smoothstep(at, at * 3, r2(x, z)) * h;
const bones = (kit, tone = '#ede2ca', shade = '#d9c6a6') => ({
  bone: kit.mat({ color: tone, shadeHue: 0.9, hatch: 0 }), shade: kit.mat({ color: shade, shadeHue: 0.9, hatch: 0 }), dark: kit.mat({ color: '#6e5442', flat: true }),
});

export const DESERT_VIEWS = [
  // ===================================================================== IMG_3772
  {
    id: '3772-ribs', title: 'Ribs on the dune crest', sheet: 'IMG_3772', panel: 1, where: 'top left', crop: [34, 32, 470, 259],
    camera: { eye: [0, 3.2, 0], yaw: 0, fov: 34, horizon: 0.42 },
    sun: { side: 70, el: 40 },
    sky: ['#a9c3d0', '#b9cfd5', '#a39488', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the long dune rising to its crest ~45 m out, where the ribs lie, then away; far dunes low
        return 5.5 * smoothstep(-5, 34, d) * (1 - smoothstep(40, 80, d)) + 0.8 * n2(x * 0.02, z * 0.02) + 2 * smoothstep(80, 200, d) * ridged(x, z, 0.008, 3) + far(x, z, 300, 5);
      },
      material: sand('#f3b56a', '#efab5c', '#e4994e'),
    },
    people: [{ at: [8.5, -22], facing: 0.3, palette: PERSON, head: 'hood' }],
    build(kit) {
      ribcage(kit, bones(kit, '#efdcbc', '#dcc29d'), { x: -5, z: -34, yaw: -0.18, len: 26, rise: 4.6, ribs: 15, sink: 0.6, skull: -1 });
    },
  },
  {
    id: '3772-saucers', title: 'Blue saucers over the spired city', sheet: 'IMG_3772', panel: 2, where: 'top right', crop: [521, 32, 469, 296],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.74 },
    sun: { side: -125, el: 32 },
    sky: ['#a6c3d6', '#b6cfdc', '#8e99a8', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.3,
    ground: { height: (x, z) => 0.3 * n2(x * 0.02, z * 0.02) + far(x, z, 250, 4), material: sand('#f3d6b6', '#f0cfac', '#e6c19c') },
    people: [{ at: [-4.2, -11], facing: 0.2, palette: PERSON, head: 'hood' }],
    build(kit) {
      const blue = kit.mat({ color: '#93aec8', side: THREE.DoubleSide }), stem = kit.mat({ color: '#9fb6cc' }), rim = kit.mat({ color: '#5e6f84', flat: true });
      const domeM = [kit.mat({ color: '#dde3ea' }), kit.mat({ color: '#c9d4df' }), kit.mat({ color: '#b2c2d4', weathered: 0.5 })];
      const spire = kit.mat({ color: '#c4d1df', weathered: 0.5 }), dark = kit.mat({ color: '#56637a', flat: true });
      // the saucers: two huge ones framing the city, smaller ones behind
      for (const [x, z, h, R, tilt, az] of [[-36, -56, 22, 24, 0.55, -0.5], [44, -66, 26, 27, 0.5, 0.45], [-16, -112, 16, 13, 0.45, -0.2], [22, -130, 18, 14, 0.45, 0.2], [-54, -140, 12, 10, 0.4, -0.4]])
        stemDish(kit, { cap: blue, stem, rim }, { x, z, h, R, r: R * 0.16, tilt, az, bowl: 0.3 });
      // the city: domes crowding low, a cluster of spires in the middle
      const rng = kit.rng;
      for (let i = 0; i < 46; i++) {
        const x = -70 + rng() * 140, z = -95 - rng() * 60, r = 2.5 + rng() * 4;
        kit.add(domeM[i % 3], dome(r, 0.8 + rng() * 0.4).translate(x, kit.base(x, z, r) - 0.3, z));
      }
      for (const [x, z, h, r] of [[2, -125, 44, 3.2], [-6, -118, 30, 2.6], [10, -120, 34, 2.4], [-14, -128, 24, 2.2], [16, -132, 26, 2], [-2, -110, 18, 3.5], [6, -112, 22, 2.8]]) {
        const y = kit.H(x, z);
        kit.add(spire, new THREE.CylinderGeometry(r * 0.7, r, h, 10).translate(x, y + h / 2, z));
        kit.add(spire, new THREE.ConeGeometry(r * 0.75, h * 0.35, 10).translate(x, y + h + h * 0.17, z));
        kit.add(dark, put(new THREE.BoxGeometry(r * 0.5, r * 0.9, 0.2), x, y + h * 0.4, z + r * 0.8), { solid: false });
      }
    },
  },
  {
    id: '3772-gorge', title: 'The rope bridge over the ochre gorge', sheet: 'IMG_3772', panel: 3, where: 'middle left', crop: [34, 312, 469, 333],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 54, horizon: 0.5 },
    sun: { side: 40, el: 50 },
    sky: ['#a8c5da', '#b9d0dc', '#a79583', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.3,
    ground: {
      height: (x, z) => 0.4 * n2(x * 0.04, z * 0.04) + 1.4 * smoothstep(14, 40, Math.abs(x + 4)) * smoothstep(10, 60, -z) + smoothstep(140, 260, -z) * (4 + 4 * ridged(x, z, 0.02, 2)),
      material: sand('#f2c88e', '#efc186', '#dfae70', { pattern: 'cracks' }),
    },
    people: [{ at: [1.5, -58], facing: 0.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      const wall = strataMat(kit, '#efb15f', '#e7a552', '#f4c27a', 4.5), shaded = strataMat(kit, '#e6a95d', '#dc9a4f', '#eebc77', 5);
      gorgeWall(kit, shaded, { side: -1, x0: -58, slope: -0.18, z0: 30, z1: -170, top: 40, tiers: [[0, 0.4, 0], [0.4, 0.75, 5], [0.75, 1, 10]], seed: 3 });
      gorgeWall(kit, wall, { side: 1, x0: 40, slope: -0.14, z0: 20, z1: -170, top: 44, tiers: [[0, 0.3, -2], [0.3, 0.65, 3], [0.65, 1, 7]], seed: 7 });
      const rope = kit.mat({ color: '#5a4c40', flat: true }), plank = kit.mat({ color: '#8f7458', flat: true });
      bridge(kit, { rope, plank }, [-50, 40, -80], [30, 42, -92], { sag: 9, deckSag: 12, width: 1.8 });
      bridge(kit, { rope, plank }, [-42, 38, -112], [28, 40, -118], { sag: 5, deckSag: 7, width: 1.4 });
      for (const [x, z, s] of [[-20, -40, 3], [16, -50, 4], [22, -90, 5], [-18, -100, 3.5]]) kit.add(wall, put(new THREE.DodecahedronGeometry(s, 0), x, kit.H(x, z) + s * 0.25, z, x, [1.4, 0.55, 1]));
    },
  },
  {
    id: '3772-petals', title: 'The petal station on the salt', sheet: 'IMG_3772', panel: 4, where: 'middle right', crop: [522, 348, 468, 288],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 40, horizon: 0.7 },
    sun: { side: -100, el: 38 },
    sky: ['#a9c3d1', '#b9cfd7', '#a0948c', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.3,
    ground: { height: (x, z) => 0.2 * n2(x * 0.03, z * 0.03) + far(x, z, 200, 3) + 1.5 * smoothstep(60, 140, -z) * ridged(x, z, 0.01, 4), material: sand('#f3d3ae', '#f0caa2', '#e6bd94', { pattern: 'cracks' }) },
    people: [{ at: [-4.5, -33], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const petal = kit.mat({ color: '#e6b994', side: THREE.DoubleSide, shade: 0.25, hatch: 0.3 }), petal2 = kit.mat({ color: '#f0d4b6', side: THREE.DoubleSide, shade: 0.3, hatch: 0.3 });
      const rope = kit.mat({ color: '#5d4a3e', flat: true }), base = kit.mat({ color: '#d8b494' });
      const x = 4, z = -42;
      petals(kit, [petal, petal2], { x, z, n: 7, len: 11, w: 4.2, lean: 0.32, lift: 1.2, az: 0.3, cup: 0.3 });
      kit.add(base, dome(4, 0.45).translate(x, kit.H(x, z) - 0.2, z));
      cage(kit, rope, { x, y: kit.H(x, z) + 1.4, z, r: 3.8, h: 9, meridians: 9, rings: 3 });
      for (const [rx, rz, s] of [[10, -38, 1.2], [-3, -40, 0.9], [13, -46, 1.4]]) kit.add(base, put(new THREE.DodecahedronGeometry(s, 0), rx, kit.H(rx, rz) + s * 0.2, rz, rx, [1.5, 0.5, 1]));
    },
  },
  {
    id: '3772-salt-lake', title: 'The salt lake under the violet table', sheet: 'IMG_3772', panel: 5, where: 'bottom left', crop: [31, 668, 472, 321],
    camera: { eye: [0, 4, 0], yaw: 0, fov: 42, horizon: 0.38 },
    sun: { side: -60, el: 42 },
    sky: ['#b1c8d3', '#bfd2d8', '#9a9aab', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the white shore under you, down into the lake ~22 m out; the far shore rises to the cliff's foot
        const shore = 1.2 - 1.6 * smoothstep(12, 28, d - 0.08 * x) + 0.15 * n2(x * 0.05, z * 0.05);
        return Math.max(shore, -1.8 + 0.6 * n3(x * 0.03, z * 0.03) + 2.8 * smoothstep(205, 232, d));
      },
      material: { color: '#f4eff4', color2: '#ebe3ee', color3: '#d9cde0', pattern: 'cracks' },
      rings: { r1: 1500 },
    },
    people: [{ at: [-4, -17], facing: 0.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(500, 200, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -110), kit.mat({ color: '#45c4c8', color2: '#8fdcd8', mode: MODE_WATER }), { solid: false, shadow: false });
      // the floating salt plates: flat white slabs, many small ones near, fewer far
      const plate = kit.mat({ color: '#eef3f3', flat: true }), rng = kit.rng;
      for (let i = 0; i < 90; i++) {
        const z = -26 - Math.pow(rng(), 1.4) * 120, x = (rng() - 0.5) * (60 + (-z) * 1.6), r = 0.8 + rng() * 3.2 * (1 + -z / 60);
        const g = new THREE.CylinderGeometry(r, r, 0.12, 6 + Math.floor(rng() * 4)).scale(1 + rng(), 1, 0.6 + rng() * 0.6).rotateY(rng() * 3);
        kit.add(plate, g.translate(x, 0.05, z), { solid: false, shadow: false });
      }
      const cliff = strataMat(kit, '#a99bd6', '#a294d1', '#b2a5dc', 6);
      tableCliff(kit, cliff, (t, inset) => [-300 + 600 * t, -235 + inset + 4 * Math.sin(t * 23) + 2 * n4(t * 30, 1)], [[-2, 21, 0], [21, 25, -4]]);
    },
  },
  {
    id: '3772-station', title: 'The station of domes and masts', sheet: 'IMG_3772', panel: 6, where: 'bottom right', crop: [522, 658, 468, 332],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 40, horizon: 0.53 },
    sun: { side: -110, el: 40 },
    sky: ['#b3c7d1', '#c0d1d6', '#a39a91', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.3,
    ground: { height: (x, z) => 0.6 * n2(x * 0.02, z * 0.02) - 0.03 * Math.max(0, -z - 10) + far(x, z, 300, 3), material: sand('#f2d0a8', '#efc79c', '#e3b98b', { pattern: 'cracks' }) },
    build(kit) {
      const pale = kit.mat({ color: '#efe2d2', weathered: 0.6 }), pale2 = kit.mat({ color: '#e2d0bc', flat: true, weathered: 0.7 }), dark = kit.mat({ color: '#5a4a40', flat: true });
      const mast = kit.mat({ color: '#8c7a6a', flat: true });
      // a quonset with a dark mouth, two domes, a long barrel hut, masts
      // (the panel's centre a little right of the frame's: a quonset with a dark mouth, a long barrel hut)
      const qx = 6, qz = -40, qy = kit.base(qx, qz, 6) - 0.3;
      kit.add(pale, new THREE.CylinderGeometry(5, 5, 9, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(0.25).translate(qx, qy, qz));
      kit.add(dark, put(new THREE.CircleGeometry(2.4, 14, 0, Math.PI), qx - 1.1, qy, qz + 4.6, 0.25), { solid: false });
      kit.add(pale2, new THREE.CylinderGeometry(3.6, 3.6, 12, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(20, kit.base(20, -44, 5) + 1.5, -44));
      for (let i = 0; i < 5; i++) kit.add(dark, put(new THREE.BoxGeometry(0.6, 1.4, 0.2), 16 + i * 1.6, kit.H(20, -44) + 3.2, -40.3), { solid: false });
      for (const [x, z, r] of [[-4, -38, 3], [0, -47, 2.4], [12, -50, 2.8], [-10, -44, 2]]) kit.add(pale, dome(r, 1.05).translate(x, kit.base(x, z, r) - 0.2, z));
      for (const [x, z, h] of [[3, -50, 30], [-8, -48, 15], [10, -54, 18], [-16, -42, 8]]) kit.add(mast, new THREE.CylinderGeometry(0.15, 0.25, h, 5).translate(x, kit.H(x, z) + h / 2, z));
      // a gantry arch and its little dome, off to the left
      kit.add(mast, put(new THREE.TorusGeometry(3, 0.16, 5, 24, Math.PI), -24, kit.H(-24, -44) - 0.2, -44, 0.6));
      kit.add(pale, dome(1.4, 1).translate(-21, kit.H(-21, -42) - 0.1, -42));
    },
  },

  // ===================================================================== IMG_3773
  {
    id: '3773-ribs', title: 'The ribcage between the dunes', sheet: 'IMG_3773', panel: 1, where: 'row 1, left', crop: [38, 41, 465, 226],
    camera: { eye: [0, 6, 0], yaw: 0, fov: 34, horizon: 0.26 },
    sun: { side: -60, el: 40 },
    sky: ['#a7c0cc', '#b8ccd1', '#a8917a', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.22,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a hollow ~40 m out where the bones lie; dunes rising on both sides, the left one sharp-crested
        return 4.5 * smoothstep(45, 85, d) * ridged(x, z, 0.01, 2) + 9 * gauss(x, z, -42, -42, 18) + 7 * gauss(x, z, 40, -55, 20) - 1.2 * gauss(x, z, 0, -30, 12) + 2.5 * smoothstep(-5, 12, d) * (1 - smoothstep(12, 24, d)) + far(x, z, 250, 8);
      },
      material: sand('#f3b46a', '#efaa5d', '#e2964f'),
    },
    build(kit) {
      ribcage(kit, bones(kit, '#e8d3b2', '#cfb48e'), { x: 1, z: -31, yaw: -0.2, len: 20, rise: 3.4, ribs: 16, sink: 0.7, skull: 1, lean: 0.6 });
    },
  },
  {
    id: '3773-umbrellas', title: 'The pink umbrella city', sheet: 'IMG_3773', panel: 2, where: 'row 1, right', crop: [524, 41, 463, 226],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 40, horizon: 0.86 },
    sun: { side: 110, el: 34 },
    sky: ['#a6c6d4', '#b7d2da', '#a08d84', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.3,
    ground: { height: (x, z) => 0.2 * n2(x * 0.03, z * 0.03), material: sand('#f2c79f', '#efbf94', '#e3af84') },
    people: [{ at: [6, -52], facing: 0, palette: PERSON, head: 'hood' }],
    build(kit) {
      const cap = kit.mat({ color: '#e7a07f', side: THREE.DoubleSide, shade: 0.25, hatch: 0.4 }), cap2 = kit.mat({ color: '#efb59c', side: THREE.DoubleSide, shade: 0.25, hatch: 0.4 });
      const stem = kit.mat({ color: '#e0a080' }), rim = kit.mat({ color: '#9c6a58', flat: true });
      for (const [x, z, h, R, tilt, k] of [[30, -92, 34, 19, 0.1, 0], [-8, -96, 30, 16, -0.08, 1], [-30, -104, 24, 12, 0.12, 0], [-52, -118, 20, 10, -0.1, 1], [48, -130, 26, 14, 0.05, 1], [12, -130, 22, 11, 0.15, 0], [-70, -140, 16, 9, 0, 0], [66, -110, 18, 10, -0.2, 0]])
        stemDish(kit, { cap: k ? cap2 : cap, stem, rim }, { x, z, h: h * 0.8, R: R * 1.25, r: R * 0.12, tilt: 0.35 + tilt, bowl: 0.28 });
      const adobe = [kit.mat({ color: '#e9b28e', weathered: 0.8 }), kit.mat({ color: '#d99c78', flat: true, weathered: 0.8 }), kit.mat({ color: '#f2c6a6', weathered: 0.6 })], dark = kit.mat({ color: '#6a4636', flat: true });
      const rng = kit.rng;
      for (let i = 0; i < 70; i++) {
        const x = -80 + rng() * 160, z = -72 - rng() * 70, r = 1.8 + rng() * 3.4, y = kit.base(x, z, r) - 0.2;
        if (rng() < 0.4) { const h = r * (1 + rng()); kit.add(adobe[1], new THREE.CylinderGeometry(r, r * 1.05, h, 12).translate(x, y + h / 2, z)); kit.add(adobe[2], dome(r * 1.02, 0.7).translate(x, y + h, z)); }
        else kit.add(adobe[i % 3], dome(r, 0.9 + rng() * 0.4).translate(x, y, z));
        if (rng() < 0.5) kit.add(dark, put(new THREE.BoxGeometry(r * 0.4, r * 0.55, 0.2), x, y + r * 0.27, z + r * 0.95), { solid: false });
      }
    },
  },
  {
    id: '3773-canyon-bridge', title: 'The bridge over the shaded canyon', sheet: 'IMG_3773', panel: 3, where: 'row 2, left', crop: [38, 281, 465, 224],
    camera: { eye: [0, 26, 0], yaw: 0, fov: 44, horizon: 0.42 },
    sun: { side: 150, el: 34 },
    sky: ['#9fc2d4', '#b0cfdb', '#9a7c62', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.25,
    ground: {
      height: (x, z) => {
        // a V of a canyon down to a stream ~30 m below the eye, its floor rising away to a far mesa line
        const d = -z, v = Math.abs(x + 0.06 * d + 2 * n3(z * 0.02, 1)) - 4;
        return 2 + Math.min(34, 1.4 * Math.max(0, v) + 0.4 * Math.max(0, v - 10)) + 0.6 * n2(x * 0.05, z * 0.05) + smoothstep(150, 240, d) * 10;
      },
      material: sand('#eeb877', '#e8ad69', '#cf9559'),
    },
    build(kit) {
      // (the canyon is the ground's: its steep sides take the rock tone; ledges of strata on the rims)
      const wall = strataMat(kit, '#dba268', '#cc9157', '#e8b47a', 5);
      for (const [x, z, w, d, h] of [[-34, -40, 10, 30, 6], [32, -60, 12, 40, 5], [-30, -110, 14, 40, 8], [30, -130, 10, 30, 6]]) kit.add(wall, new THREE.BoxGeometry(w, h, d).translate(x, kit.H(x, z) + h / 2 - 1, z));
      kit.mesh(new THREE.PlaneGeometry(14, 240, 1, 1).rotateX(-Math.PI / 2).rotateY(0.06).translate(-6, 2.15, -120), kit.mat({ color: '#78c3c0', color2: '#a8dad2', mode: MODE_WATER }), { solid: false, shadow: false });
      const rope = kit.mat({ color: '#4c4038', flat: true }), plank = kit.mat({ color: '#7d6550', flat: true });
      bridge(kit, { rope, plank }, [-24, 26, -66], [22, 26, -70], { sag: 7, deckSag: 0.6, width: 2.4, hang: 0.4, towers: 9 });
    },
  },
  {
    id: '3773-poles', title: 'The poles and cables on the pink plain', sheet: 'IMG_3773', panel: 4, where: 'row 2, right', crop: [524, 281, 463, 224],
    camera: { eye: [0, 2.4, 0], yaw: 0, fov: 40, horizon: 0.6 },
    sun: { side: -120, el: 36 },
    sky: ['#a2c5d4', '#b3d0d9', '#a6857b', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.3,
    ground: {
      height: (x, z) => 0.5 * n2(x * 0.02, z * 0.02) + 1.6 * smoothstep(80, 200, -z) * ridged(x, z, 0.008, 6) + far(x, z, 300, 4) - 0.8 * gauss(x, z, -9, -11, 3.5),
      material: sand('#f1b49a', '#eeab90', '#e19a80', { pattern: 'cracks' }),
    },
    people: [{ at: [-6, -50], facing: 0.3, palette: PERSON, head: 'hood' }],
    build(kit) {
      const pole = kit.mat({ color: '#a07e6a', flat: true }), cable = kit.mat({ color: '#5c4a42', flat: true });
      kit.mesh(new THREE.CircleGeometry(3, 24).scale(1.8, 1, 0.5).rotateX(-Math.PI / 2).translate(-9, -0.25, -11), kit.mat({ color: '#7cc6c2', color2: '#a9dad4', mode: MODE_WATER }), { solid: false, shadow: false });
      // the tall mast on the right with its stays fanned to the ground, and its line of poles
      const mx = 16, mz = -40, my = kit.H(mx, mz), mh = 30;
      kit.add(pole, new THREE.CylinderGeometry(0.18, 0.3, mh, 6).translate(mx, my + mh / 2, mz));
      kit.add(pole, new THREE.CylinderGeometry(0.12, 0.2, mh * 0.95, 6).translate(mx + 1.2, my + mh * 0.475, mz - 0.6));
      for (const [ax, az] of [[-22, -60], [36, -36], [10, -10]]) kit.add(cable, tube([V(mx, my + mh, mz), V(ax, kit.H(ax, az) + 0.1, az)], 0.05, 1, 3), { solid: false });
      const line = [[mx, mz], [2, -90], [-8, -130], [-16, -160], [-22, -188]];
      for (let i = 1; i < line.length; i++) {
        const [x, z] = line[i], h = 9 - i;
        kit.add(pole, new THREE.CylinderGeometry(0.1, 0.14, h, 5).translate(x, kit.H(x, z) + h / 2, z));
        const [px, pz] = line[i - 1], ph = i === 1 ? mh * 0.8 : 9 - (i - 1);
        kit.add(cable, tube([V(px, kit.H(px, pz) + ph, pz), V((px + x) / 2, (kit.H(px, pz) + ph + kit.H(x, z) + h) / 2 - 2, (pz + z) / 2), V(x, kit.H(x, z) + h, z)], 0.04, 10, 3), { solid: false });
      }
      for (const [x, z] of [[-12, -70], [-18, -76], [-26, -90], [6, -110]]) kit.add(pole, new THREE.CylinderGeometry(0.08, 0.1, 4, 4).translate(x, kit.H(x, z) + 2, z));
    },
  },
  {
    id: '3773-fallen-pod', title: 'The fallen pod with its petals', sheet: 'IMG_3773', panel: 5, where: 'row 3, left', crop: [38, 522, 465, 222],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 40, horizon: 0.36 },
    sun: { side: -70, el: 40 },
    sky: ['#a7c7d6', '#b8d3dc', '#a8877c', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.28,
    ground: {
      height: (x, z) => 0.8 * n2(x * 0.02, z * 0.02) + 0.03 * Math.max(0, -z - 10) + 1.2 * smoothstep(60, 160, -z) * ridged(x, z, 0.01, 8) + far(x, z, 300, 5) - 1.4 * smoothstep(-6, -24, x) * smoothstep(0, -14, z),
      material: sand('#f1b8a2', '#eeae97', '#e09e88', { pattern: 'cracks' }),
    },
    people: [{ at: [6, -30], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const shell = kit.mat({ color: '#efc7a7', shade: 0.2 }), shell2 = kit.mat({ color: '#e1ae8e', shade: 0.2 }), dark = kit.mat({ color: '#6c4c42', flat: true }), metal = kit.mat({ color: '#d79a85', flat: true });
      const x = -6, z = -62, y = kit.H(x, z);
      // a bulb of a pod nose-up, its petals open, the body lying behind it in the sand
      kit.add(shell, put(new THREE.SphereGeometry(1, 24, 16), x, y + 9, z, 0.2, [5.5, 7, 5.5]));
      petals(kit, [shell2, shell], { x, z: z + 0.5, n: 4, len: 11, w: 4.2, lean: 0.7, lift: 7.5, az: 0.4, cup: 0.3 });
      kit.add(metal, put(new THREE.CylinderGeometry(2.6, 3, 16, 14).rotateZ(Math.PI / 2), x + 11, y + 1.4, z + 2, -0.25));
      kit.add(dark, put(new THREE.SphereGeometry(1, 12, 8), x + 1.5, y + 2.4, z + 4.5, 0, [3.5, 1.6, 1]), { solid: false });
      for (let i = 0; i < 9; i++) { const rx = x - 4 + i * 1.8, rz = z + 3 + (i % 3); kit.add(dark, put(new THREE.DodecahedronGeometry(0.7 + (i % 3) * 0.3, 0), rx, kit.H(rx, rz) + 0.2, rz, i, [1.5, 0.6, 1])); }
      // a trickle of grey-blue water and rocks in the bottom left
      kit.mesh(new THREE.PlaneGeometry(14, 6, 1, 1).rotateX(-Math.PI / 2).rotateY(0.5).translate(-16, -1.1, -9), kit.mat({ color: '#8fb8bc', color2: '#b8d6d4', mode: MODE_WATER }), { solid: false, shadow: false });
      const rock = kit.mat({ color: '#c9947c', flat: true });
      for (const [rx, rz, s] of [[-19, -12, 1.5], [-14, -8, 1], [-22, -6, 1.2], [-11, -13, 0.8], [-25, -14, 1.6]]) kit.add(rock, put(new THREE.DodecahedronGeometry(s, 0), rx, kit.H(rx, rz) + s * 0.2, rz, rx, [1.6, 0.5, 1.1]));
    },
  },
  {
    id: '3773-lagoons', title: 'The lagoons under the violet mesas', sheet: 'IMG_3773', panel: 6, where: 'row 3, right', crop: [524, 522, 463, 222],
    camera: { eye: [0, 3.5, 0], yaw: 0, fov: 40, horizon: 0.27 },
    sun: { side: 120, el: 40 },
    sky: ['#a5c9d6', '#b5d3dc', '#9c94ac', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a lilac sand spit curving from the left foreground away to the right; lagoons on both sides of it
        const spit = Math.exp(-(((x + 18 - 0.0045 * d * d) / (6 + 0.08 * d)) ** 2)) * 1.4;
        const shelf = 0.9 * smoothstep(22, 8, d - 0.2 * x) + 1.0 * smoothstep(90, 120, d - 0.1 * x);
        return -1.4 + Math.max(spit, shelf) * 2 + 0.2 * n2(x * 0.04, z * 0.04);
      },
      material: { color: '#d7b8dc', color2: '#cfafd6', color3: '#c3a2cb' },
      rings: { r1: 1500 },
    },
    people: [{ at: [-8, -12], facing: 0.2, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(600, 260, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -120), kit.mat({ color: '#56cdc0', color2: '#94e0d4', mode: MODE_WATER }), { solid: false, shadow: false });
      const mesa = strataMat(kit, '#9787c4', '#8f7fbd', '#a294cd', 5);
      tableCliff(kit, mesa, (t, inset) => [-400 + 380 * t, -330 + inset + (t < 0.1 || t > 0.9 ? 40 : 0)], [[-2, 26, 0], [26, 34, -6]]);
      tableCliff(kit, mesa, (t, inset) => [40 + 380 * t, -300 + inset + 12 * Math.sin(t * 9)], [[-2, 14, 0], [14, 22, -10]]);
      const plate = kit.mat({ color: '#f0f4f2', flat: true });
      for (const [x, z, r] of [[14, -40, 0.8], [30, -60, 1.1], [-2, -70, 0.6], [44, -46, 0.7], [56, -90, 1.0], [60, -30, 0.5]]) kit.add(plate, new THREE.CylinderGeometry(r, r * 1.3, 0.3, 5).translate(x, 0.12, z), { solid: false, shadow: false });
    },
  },
  {
    id: '3773-red-canyon', title: 'The stream in the red canyon', sheet: 'IMG_3773', panel: 7, where: 'row 4, left', crop: [38, 764, 465, 222],
    camera: { eye: [0, 5, 0], yaw: 0, fov: 40, horizon: 0.42 },
    sun: { side: 75, el: 40 },
    sky: ['#a6c6d2', '#bcd2d8', '#ad8d76', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.22,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a plain falling gently to a stream that winds in from the right; low pale mesas far off
        const stream = Math.exp(-(((x - 46 + 1.2 * d - 0.012 * d * d) / 6) ** 2));
        return 0.6 * n2(x * 0.02, z * 0.02) - 1.6 * stream + 1.2 * smoothstep(60, 110, d) + smoothstep(160, 260, d) * 4;
      },
      material: sand('#f0ba7e', '#ecb072', '#dc9d63'),
      rings: { r1: 1800 },
    },
    people: [{ at: [-11, -40], facing: 0.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(260, 160, 1, 1).rotateX(-Math.PI / 2).translate(30, -0.6, -60), kit.mat({ color: '#6fc4bf', color2: '#9fd8d0', mode: MODE_WATER }), { solid: false, shadow: false });
      const red = strataMat(kit, '#d98a5e', '#c97a50', '#e49a6c', 4), pale = strataMat(kit, '#f0c7a8', '#e9bd9c', '#f5d2b6', 6);
      // the pillar at the left edge, the mesa at the right
      const sh = new THREE.Shape(); [[-30, -18], [-20, -16], [-18, -26], [-26, -32]].forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
      kit.add(red, new THREE.ExtrudeGeometry(sh, { depth: 40, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -2, 0));
      for (const [inset, y0, y1] of [[0, -2, 12], [3, 12, 22], [6, 22, 28]]) {
        const m = new THREE.Shape(); [[34 + inset, -116 - inset], [70, -112 - inset], [82, -150], [40 + inset, -162]].forEach(([x, z], i) => (i ? m.lineTo(x, -z) : m.moveTo(x, -z)));
        kit.add(red, new THREE.ExtrudeGeometry(m, { depth: y1 - y0, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0));
      }
      tableCliff(kit, pale, (t, inset) => [-500 + 700 * t, -620 + inset + 30 * Math.sin(t * 7)], [[-2, 18, 0]], 900);
      for (const [x, z, s] of [[-22, -22, 1.6], [-12, -28, 1.1], [24, -110, 3]]) kit.add(red, put(new THREE.DodecahedronGeometry(s, 0), x, kit.H(x, z) + s * 0.3, z, x, [1.4, 0.6, 1]));
    },
  },
  {
    id: '3773-helmets', title: 'The two buried helmets', sheet: 'IMG_3773', panel: 8, where: 'row 4, right', crop: [524, 764, 463, 222],
    camera: { eye: [0, 12, 0], yaw: 0, fov: 40, horizon: 0.02 },
    sun: { side: -90, el: 40 },
    sky: ['#e9b07a', '#eeb98a', '#a88570', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY, fog: 0.2,
    ground: {
      height: (x, z) => {
        // a dune face rising steeply away up out of the frame
        const d = -z;
        return 0.12 * Math.max(0, d - 4) + 0.03 * x + 0.6 * n2(x * 0.03, z * 0.03) + 1.4 * ridged(x * 0.3, z, 0.02, 9) * smoothstep(10, 30, d);
      },
      material: sand('#f4b878', '#f0ae6c', '#e4a060'),
    },
    people: [{ at: [-1, -14], facing: 3.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      const shell = kit.mat({ color: '#b5b1a4', metal: 'steel', refl: 0.25 }), dark = kit.mat({ color: '#3f3a38', flat: true }), trim = kit.mat({ color: '#8d877c', flat: true });
      machineHead(kit, { shell, dark, trim }, { x: -9, z: -28, r: 3.2, yaw: 2.6, sink: 0.4 });
      machineHead(kit, { shell, dark, trim }, { x: 7, z: -30, r: 5, yaw: 2.8, sink: 0.35 });
    },
  },

  // ===================================================================== IMG_3774
  {
    id: '3774-ribs', title: 'The ribcage in the dune\'s hollow', sheet: 'IMG_3774', panel: 1, where: 'row 1, left', crop: [35, 58, 373, 281],
    camera: { eye: [0, 8, 0], yaw: 0, fov: 42, horizon: 0.2 },
    sun: { side: -110, el: 42 },
    sky: ['#a8c8db', '#bad4e0', '#b08a63', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.22,
    ground: {
      height: (x, z) => {
        const d = -z;
        return -1.2 * gauss(x, z, -3, -24, 9) + 3 * smoothstep(40, 80, d) + 2 * dunes(x, z, 2, 0.02, 4) * smoothstep(10, 40, d) + far(x, z, 200, 10);
      },
      material: sand('#f6c16d', '#f2b661', '#e6a555'),
    },
    build(kit) {
      const B = bones(kit, '#8c96a8', '#77819a');
      ribcage(kit, B, { x: -3, z: -24, yaw: 0.25, len: 13, rise: 3.4, ribs: 11, sink: 0.5, skull: 1, lean: 0.8 });
      const shell = kit.mat({ color: '#56637e', metal: 'steel', refl: 0.2 }), dark = kit.mat({ color: '#22232c', flat: true }), trim = kit.mat({ color: '#9ba6ba', flat: true });
      machineHead(kit, { shell, dark, trim }, { x: -1.5, z: -18, r: 0.8, yaw: 1.4, sink: 0.4 });
    },
  },
  {
    id: '3774-dish-city', title: 'Pink dishes over the blue domes', sheet: 'IMG_3774', panel: 2, where: 'row 1, right', crop: [414, 58, 576, 281],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 40, horizon: 0.66 },
    sun: { side: 80, el: 34 },
    sky: ['#9fc4dd', '#b2d1e2', '#a4877a', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.3,
    ground: { height: (x, z) => 0.3 * n2(x * 0.03, z * 0.03) + far(x, z, 200, 6) + 4 * gauss(x, z, -120, -200, 50), material: sand('#f2c27a', '#efb86f', '#e0a660') },
    people: [{ at: [-12, -46], facing: 0.1, palette: PERSON, head: 'hood' }, { at: [-2, -40], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const pink = kit.mat({ color: '#f0a87e', side: THREE.DoubleSide, shade: 0.25, hatch: 0.4 }), white = kit.mat({ color: '#f6ebe2', side: THREE.DoubleSide, shade: 0.35, hatch: 0.2 });
      const stem = kit.mat({ color: '#e6b48e', weathered: 0.6 }), rim = kit.mat({ color: '#8c6a5a', flat: true });
      stemDish(kit, { cap: pink, stem, rim }, { x: 8, z: -62, h: 20, R: 20, r: 5.2, tilt: 0.25, bowl: 0.55 });
      stemDish(kit, { cap: white, stem, rim }, { x: -26, z: -92, h: 18, R: 13, r: 2.2, tilt: 0.55, az: 0.5, bowl: 0.3 });
      stemDish(kit, { cap: white, stem, rim }, { x: 46, z: -38, h: 16, R: 22, r: 2.6, tilt: 1.1, az: -1.2, bowl: 0.3 });
      stemDish(kit, { cap: pink, stem, rim }, { x: 30, z: -120, h: 16, R: 9, r: 1.6, tilt: -0.1, bowl: 0.3 });
      const blue = [kit.mat({ color: '#8fa3c8' }), kit.mat({ color: '#a5b5d4' }), kit.mat({ color: '#7d93bd' })], dark = kit.mat({ color: '#3d4660', flat: true });
      const rng = kit.rng;
      for (let i = 0; i < 40; i++) {
        const x = -60 + rng() * 120, z = -42 - rng() * 50, r = 2 + rng() * 3.4, y = kit.base(x, z, r) - 0.2;
        kit.add(blue[i % 3], dome(r, 0.8 + rng() * 0.3).translate(x, y, z));
        if (rng() < 0.5) kit.add(dark, put(new THREE.BoxGeometry(r * 0.35, r * 0.5, 0.2), x, y + r * 0.25, z + r * 0.95), { solid: false });
      }
      const tower = kit.mat({ color: '#a5b0c6', weathered: 0.5 });
      for (const [x, z, h] of [[-44, -88, 22], [-38, -96, 16], [-52, -84, 12]]) kit.add(tower, new THREE.CylinderGeometry(0.8, 1, h, 8).translate(x, kit.H(x, z) + h / 2, z));
    },
  },
  {
    id: '3774-dune-bridge', title: 'The bridge over the dunes', sheet: 'IMG_3774', panel: 3, where: 'row 2, left', crop: [35, 356, 333, 281],
    camera: { eye: [0, 4, 0], yaw: 0, fov: 46, horizon: 0.45 },
    sun: { side: 15, el: 24 },
    sky: ['#a4c6dc', '#b6d2e0', '#b3875a', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a big dune slope in front falling away to the left, a sharp crest across the middle distance
        // the near slope falling to the left, a valley, then a steep slip face rising to a long crest
        const crest = 46 + 0.25 * x;
        return 4 * smoothstep(-30, 40, x) * (1 - smoothstep(8, 30, d)) + 7 * smoothstep(crest - 7, crest, d) + 2 * smoothstep(crest + 10, crest + 80, d) * n2(x * 0.01, z * 0.01) + far(x, z, 250, 6);
      },
      material: sand('#f6c172', '#f2b665', '#e6a457'),
    },
    people: [{ at: [26, -24], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const rope = kit.mat({ color: '#4c4440', flat: true }), plank = kit.mat({ color: '#6c5a4a', flat: true });
      bridge(kit, { rope, plank }, [-130, 30, -120], [130, 30, -140], { sag: 26, deckSag: 1, width: 2, hang: 0.5, towers: 30 });
    },
  },
  {
    id: '3774-dish-station', title: 'The dish station on its legs', sheet: 'IMG_3774', panel: 4, where: 'row 2, middle', crop: [382, 356, 304, 281],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 44, horizon: 0.6 },
    sun: { side: 140, el: 34 },
    sky: ['#a5c9e0', '#b7d4e4', '#a58468', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.3,
    ground: { height: (x, z) => 0.4 * n2(x * 0.03, z * 0.03) + far(x, z, 200, 4), material: sand('#f5c47c', '#f1b970', '#e3a862') },
    people: [{ at: [-7, -30], facing: 0.2, palette: PERSON, head: 'hood' }],
    build(kit) {
      const blue = kit.mat({ color: '#9aa7c6', side: THREE.DoubleSide, metal: 'painted' }), pink = kit.mat({ color: '#f0b39a', side: THREE.DoubleSide, shade: 0.3, hatch: 0.3 });
      const leg = kit.mat({ color: '#c7a48e' }), rope = kit.mat({ color: '#4c4440', flat: true }), domeM = kit.mat({ color: '#8fa3c4' });
      const x = 4, z = -46, y = kit.H(x, z);
      kit.add(domeM, dome(4, 0.7).translate(x, y - 0.2, z));
      // two pink shallow dishes on drums either side, the blue dish rising behind them, its feed on a mast
      for (const [dx, az] of [[-6.5, -0.5], [6.5, 0.5]]) stemDish(kit, { cap: pink, stem: leg, rim: rope }, { x: x + dx, z: z + 1, h: 5, R: 7, r: 1.4, tilt: 0.35, az, bowl: 0.3 });
      radioDish(kit, blue, rope, x, y + 6, z - 3, 8, 0.9, 0.2);
      kit.add(rope, tube([V(x, y + 6, z - 3), V(x, y + 18, z - 1)], 0.15, 1, 4), { solid: false });
      kit.add(rope, new THREE.SphereGeometry(0.7, 10, 8).translate(x, y + 18.5, z - 1), { solid: false });
    },
  },
  {
    id: '3774-slot-canyon', title: 'The slot canyon under the bridge', sheet: 'IMG_3774', panel: 5, where: 'row 2, right', crop: [700, 356, 291, 281],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 54, horizon: 0.45 },
    sun: { side: -12, el: 58 },
    sky: ['#a8cde2', '#bad6e4', '#93623e', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.25,
    ground: {
      height: (x, z) => 0.3 * n2(x * 0.05, z * 0.05) + 0.9 * smoothstep(4, 14, Math.abs(x - 2 - 0.08 * z)) + smoothstep(90, 160, -z) * 5,
      material: sand('#f4be72', '#f0b466', '#e2a258'),
    },
    people: [{ at: [0.5, -14], facing: 0.1, palette: PERSON, head: 'hood' }, { at: [3, -46], facing: 0, palette: PERSON, head: 'hood' }],
    build(kit) {
      const red = strataMat(kit, '#d47d4a', '#c56f40', '#e08d58', 6), shade = strataMat(kit, '#c27a52', '#b26c46', '#cf8a5e', 6);
      gorgeWall(kit, red, { side: -1, x0: -11, slope: 0.06, z0: 10, z1: -140, top: 44, tiers: [[0, 0.5, 0], [0.5, 0.8, 3], [0.8, 1, 6]], seed: 21, rag: 2 });
      gorgeWall(kit, shade, { side: 1, x0: 13, slope: 0.05, z0: 10, z1: -140, top: 40, tiers: [[0, 0.45, 0], [0.45, 0.8, 4], [0.8, 1, 8]], seed: 23, rag: 2.4 });
      const rope = kit.mat({ color: '#4c4440', flat: true }), plank = kit.mat({ color: '#6c5a4a', flat: true });
      bridge(kit, { rope, plank }, [-17, 34, -48], [21, 34, -54], { sag: 3, deckSag: 0.4, width: 2.4, hang: 4, towers: 0 });
      // the truss under the deck: a few diagonals
      for (let i = 0; i < 9; i++) kit.add(rope, tube([V(-15 + i * 4, 34, -48.5 - i * 0.7), V(-13 + i * 4, 29, -49 - i * 0.7)], 0.08, 1, 3), { solid: false });
    },
  },
  {
    id: '3774-violet-pool', title: 'The turquoise pool in the violet cliffs', sheet: 'IMG_3774', panel: 6, where: 'row 3, left', crop: [35, 657, 377, 280],
    camera: { eye: [0, 75, 30], yaw: 0, fov: 46, horizon: 0.06 },
    sun: { side: 160, el: 55 },
    sky: ['#b8c8e0', '#c6d3e6', '#8f86b0', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.2,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the pool's bed with pale shallows, the cliff's foot rising round it
        const e = r2((x - 6) / 46, (d - 92) / 40);
        const bed = -1.8 + 1.9 * smoothstep(-0.2, 0.45, n2(x * 0.03, z * 0.03)) + 0.4 * n3(x * 0.08, z * 0.08);
        return e < 1 ? bed : bed + 6 * smoothstep(1, 1.25, e);
      },
      material: { color: '#c9b4dc', color2: '#c0a9d6', color3: '#b39ccb', pattern: 'cracks' },
    },
    people: [{ at: [26, -66], facing: 2.5, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(140, 120, 1, 1).rotateX(-Math.PI / 2).translate(6, 0, -92), kit.mat({ color: '#33c3d0', color2: '#8fe3e0', mode: MODE_WATER }), { solid: false, shadow: false });
      const cliff = strataMat(kit, '#b3a2d8', '#a897d0', '#c1b1e0', 6), cliffShade = strataMat(kit, '#8e7fbd', '#8576b5', '#9a8bc6', 6);
      // the cliffs round the pool: blocks of stepped table rock on the left, the far side and the right
      const block = (pts, h, m) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); kit.add(m, new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -3, 0)); };
      block([[-90, -40], [-38, -48], [-34, -110], [-90, -120]], 38, cliff);
      block([[-60, -110], [40, -128], [44, -200], [-60, -200]], 46, cliff);
      block([[30, -60], [70, -54], [74, -140], [36, -130]], 54, cliffShade);
      block([[-28, -64], [-12, -66], [-14, -86], [-30, -84]], 16, cliff);
    },
  },
  {
    id: '3774-blue-heads', title: 'The buried blue heads', sheet: 'IMG_3774', panel: 7, where: 'row 3, right', crop: [426, 657, 565, 280],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 40, horizon: 0.42 },
    sun: { side: -130, el: 38 },
    sky: ['#a9c9dd', '#bcd4e0', '#a78a62', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a dune swelling to the right where the big head lies; rolling dunes far off
        return 5 * gauss(x, z, 18, -30, 14) + 2.5 * gauss(x, z, -14, -40, 10) + 1.8 * dunes(x, z, 1.6, 0.015, 2) * smoothstep(30, 80, d) + far(x, z, 250, 4);
      },
      material: sand('#f5c173', '#f1b667', '#e3a459'),
    },
    people: [{ at: [-16, -30], facing: 0.2, palette: PERSON, head: 'hood' }, { at: [-4, -36], facing: 0, palette: PERSON, head: 'hood' }, { at: [6, -22], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const shell = kit.mat({ color: '#93a8cf', metal: 'painted' }), dark = kit.mat({ color: '#2c3044', flat: true }), trim = kit.mat({ color: '#6c7fa8', flat: true, metal: 'painted' });
      machineHead(kit, { shell, dark, trim }, { x: 16, z: -34, r: 9, yaw: 2.4, sink: 0.35, tilt: 0.4 });
      machineHead(kit, { shell, dark, trim }, { x: -14, z: -42, r: 3.6, yaw: 2.8, sink: 0.45 });
      // far shapes on the horizon: low blocks of other buried things
      const far = kit.mat({ color: '#b4b8c6', flat: true });
      for (let i = 0; i < 7; i++) { const x = -80 + i * 28, z = -260 - (i % 3) * 30; kit.add(far, new THREE.BoxGeometry(8, 3 + (i % 2) * 2, 6).translate(x, kit.H(x, z) + 1, z)); }
    },
  },
];
