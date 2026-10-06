import * as THREE from 'three';
import { MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { createNoise2D, mulberry32 } from '../noise.js';
import { V, tube, lathe, put, smoothstep, PERSON, CLEAN_SKY, groundRibbon } from './reference-kit.js';
import { lumpy } from './sky-stones-kit.js';
import { cloudSea, smooth } from './reference-vael2.js';
import { SPHERES_LOOK } from './spheres.js';
import { formAxis } from '../form.js';

// ---------------------------------------------------------------------------
// The Garden of Spheres' reference sheets (references/The Garden of Spheres/IMG_3793 … 3796): a lime
// meadow under colossal umbrella trees (their undersides near-black green, fanned with branches),
// white pyramids, a white hill of sculpted rock, giant pale spheres half sunk in the grass, a still
// lake, olive and cypress avenues to a round stone plaza. One scene builder (gardenScene) does them
// all; each panel is a view (reference-views.js describes the fields).
//
// The sheets shade white stone in a pale blue-grey (albedo × a pale blue tint), and fill the canopies'
// undersides and the thickets with deep green masses: the spot-black tier in the world's green.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `The Garden of Spheres / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/The Garden of Spheres/${name}.JPG`, import.meta.url).href });
export const GARDEN_SHEETS = Object.fromEntries(['IMG_3793', 'IMG_3794', 'IMG_3795', 'IMG_3796'].map((n) => [n, sheet(n)]));

/** The sheets' ink: the world's own touches (spheres.js SPHERES_LOOK) and a clean sky. */
export const GARDEN_LOOK = { ...SPHERES_LOOK, ...CLEAN_SKY };
/** The shade's tint: the white stone's shade over its light (#a8c5c3 over #eee5cf). */
const TINT = '#b2d6e6';
const SKY = {
  blue: ['#b3cfe2', '#c9dce6', TINT, '#ffffff', '#fff8e0'],
  pink: ['#fbdcc8', '#fde4d3', TINT, '#ffffff', '#fff8e0'],
  mint: ['#c6dccd', '#d5e5d8', TINT, '#ffffff', '#fff8e0'],
};
const nG = createNoise2D(37931), nH = createNoise2D(37932);

function materials(kit) {
  const leaves = (c) => kit.mat({ color: c, pattern: 'leaves' });
  return {
    // (form: the trunk's strokes wrap round it, the canopy's radiate from it; src/form.js)
    trunk: kit.mat({ color: '#7ba381', detail: 'organic', form: true }),
    canopy: kit.mat({ color: '#a9b94f', form: true, line: 0.7, lineTint: 0.67 }),   // (foliage: its line a dark green, lighter)
    // (the canopy's underside: deep green, its strokes the radiating gills, the spot blacks in its pockets)
    under: kit.mat({ color: '#2f4d33', side: THREE.DoubleSide, form: true, veins: 1 }),
    branch: kit.mat({ color: '#486a50', form: true }),
    white: kit.mat({ color: '#f1ead7', flat: true, hatch: 0.15 }),
    whiteSmooth: kit.mat({ color: '#f3eddc', hatch: 0 }),
    rock: kit.mat({ color: '#eee6d2', pattern: 'cracks', hatch: 0.15 }),
    stair: kit.mat({ color: '#ece3cc', flat: true, grid: 0.6 }),
    sphere: kit.mat({ color: '#f6efd6', hatch: 0 }),
    yellow: kit.mat({ color: '#fde6a4', hatch: 0 }),
    cave: kit.mat({ color: '#35503f', flat: true }),
    dark: [leaves('#3f6b45'), leaves('#355e3c'), leaves('#4a7346')],
    olive: [leaves('#8a9a4c'), leaves('#7f9048'), leaves('#9aa65a')],
    oliveTrunk: kit.mat({ color: '#9a583a', detail: 'organic' }),
    cypress: leaves('#3c6447'),
    orange: kit.mat({ color: '#ec8f3a', flat: true }),
    path: kit.mat({ color: '#efe6cd', mode: MODE_TERRAIN }),
    plaza: kit.mat({ color: '#f6e8cf', flat: true }),
    water: kit.mat({ color: '#a9d2d8', color2: '#bfdcdc', mode: MODE_WATER }),
    pole: kit.mat({ color: '#f4efe4' }),
    roof: kit.mat({ color: '#e7dfc8', flat: true }),
    cloud: kit.mat({ color: '#fbe0cc', shade: 0.6, hatch: 0, spot: 0, line: 0.45, lineTint: 1 }),
    pinkCloud: kit.mat({ color: '#fbd6c0', shade: 0.6, hatch: 0, spot: 0, line: 0.45, lineTint: 1 }),
    cloak: kit.mat({ color: PERSON.cloak, flat: true }),
  };
}

// ---------------------------------------------------------------- builders (the view's own frame)
// (welded first: three's polyhedra are unindexed, their normals would stay faceted)
const smoothG = (g) => smooth(g);

/**
 * An umbrella tree: a pale trunk flaring at its roots and its crown, a flat lime canopy R wide at
 * height h, its underside deep green with branches fanning out to the rim (the recess the spot blacks fill).
 */
function umbrella(kit, M, { x, z, h, R, lean = 0, seed = 1, branches = 44 }) {
  const rng = mulberry32(seed * 7 + 1), y0 = kit.base(x, z, R * 0.12) - 0.5, r = R * 0.07;
  const tilt = (g) => g.rotateZ(lean).translate(x, y0, z);
  kit.add(M.trunk, tilt(formAxis(lathe([[r * 2.6, 0], [r * 1.5, h * 0.06], [r * 1.05, h * 0.2], [r, h * 0.6], [r * 1.4, h * 0.85], [r * 3.2, h * 0.97], [r * 4, h]], 28), 'wrap')));
  // the canopy: a lime dome on top, a shallow cone underneath up to the trunk's crown
  const top = new THREE.SphereGeometry(R, 48, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.14, 1);
  lumpy(top, 0.05, 0.08, seed);
  kit.add(M.canopy, tilt(formAxis(smoothG(top), 'cap').translate(0, h + R * 0.05, 0)), { solid: false });
  kit.add(M.under, tilt(formAxis(lathe([[R * 1.005, h + R * 0.05], [R * 0.7, h - R * 0.02], [R * 0.35, h - R * 0.05], [r * 4, h - R * 0.04]], 48), 'cap')), { solid: false });
  // branches fanning from the crown to the rim, a few forking (greebles under the canopy)
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + rng() * 0.2, rr = R * (0.75 + rng() * 0.2);
    const pts = [V(0, h * 0.86, 0), V(Math.cos(a) * rr * 0.35, h - R * 0.04, Math.sin(a) * rr * 0.35), V(Math.cos(a) * rr, h + R * 0.02, Math.sin(a) * rr)];
    kit.add(M.branch, tilt(formAxis(tube(pts, r * (0.12 + rng() * 0.12), 10, 4), 'cap')), { solid: false });
    if (rng() < 0.6) { const b = a + (rng() - 0.5) * 0.4; kit.add(M.branch, tilt(formAxis(tube([pts[1], V(Math.cos(b) * rr * 0.8, h, Math.sin(b) * rr * 0.8)], r * 0.08, 6, 3), 'cap')), { solid: false }); }
  }
}

/** A stepped white pyramid: tiers, a staircase up its front (toward +z of its yaw), a small temple on top. */
function steppedPyramid(kit, M, { x, z, half, height, tiers = 10, yaw = 0, temple = true, y = null }) {
  const y0 = y ?? kit.base(x, z, half * 0.6) - 0.3, th = height / tiers;
  for (let i = 0; i < tiers; i++) {
    const s = half * (1 - (i / tiers) * 0.85) * 2;
    kit.add(M.white, put(new THREE.BoxGeometry(s, th, s), x, y0 + th * (i + 0.5), z, yaw));
  }
  const sw = half * 0.28, run = half * 0.85, steps = tiers * 3;
  for (let k = 0; k < steps; k++) {
    const t = k / steps, d = half * (1 - t * 0.85) + 0.2;
    kit.add(M.stair, put(new THREE.BoxGeometry(sw, height / steps, half * 0.85 / steps * 2), x + Math.sin(yaw) * d, y0 + (k + 0.5) * height / steps, z + Math.cos(yaw) * d, yaw));
  }
  void run;
  if (temple) {
    const tw = half * 0.3;
    kit.add(M.white, put(new THREE.BoxGeometry(tw, tw * 0.8, tw), x, y0 + height + tw * 0.4, z, yaw));
    kit.add(M.cave, put(new THREE.BoxGeometry(tw * 0.3, tw * 0.5, 0.2), x + Math.sin(yaw) * tw * 0.5, y0 + height + tw * 0.25, z + Math.cos(yaw) * tw * 0.5, yaw), { solid: false });
    kit.add(M.pole, new THREE.CylinderGeometry(0.15, 0.2, tw * 1.6, 5).translate(x, y0 + height + tw * 1.6, z), { solid: false });
  }
}

/** A smooth white pyramid (four faces, truncated), a staircase up its front face. */
function smoothPyramid(kit, M, { x, z, half, height, yaw = 0, top = 0.12 }) {
  const y0 = kit.base(x, z, half * 0.6) - 0.3, R = half * Math.SQRT2;
  kit.add(M.white, put(new THREE.CylinderGeometry(R * top, R, height, 4, 1).rotateY(Math.PI / 4).translate(0, height / 2, 0), x, y0, z, yaw));
  const sw = half * 0.3, steps = 40, slope = Math.atan2(height, half * (1 - top));
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) / steps, d = half * (1 - t * (1 - top)) + 0.15;
    kit.add(M.stair, put(new THREE.BoxGeometry(sw, height / steps * 1.2, 0.4), x + Math.sin(yaw) * d, y0 + t * height, z + Math.cos(yaw) * d, yaw, 1, -(Math.PI / 2 - slope) * 0, 0));
  }
}

/** A giant sphere R wide, sunk by `sink` × R into the grass (yellow: the golden ones). */
function sphere(kit, M, { x, z, R, sink = 0.3, yellow = false, y = null }) {
  const cy = y ?? kit.base(x, z, R * 0.5) + R * (1 - 2 * sink);
  kit.add(yellow ? M.yellow : M.sphere, new THREE.SphereGeometry(R, 64, 40).translate(x, cy, z), { shadow: true });
}

/** A sphere-arch: a great ring standing on the ground (a sphere with a round tunnel, seen side on). */
function sphereArch(kit, M, { x, z, R, yaw = 0, yellow = false, depth = 0.5 }) {
  const y = kit.base(x, z, R) - R * 0.15;
  const g = new THREE.TorusGeometry(R * 0.72, R * 0.28, 24, 64, Math.PI).scale(1, 1, depth / 0.28);
  kit.add(yellow ? M.yellow : M.sphere, put(g, x, y, z, yaw));
}

/** A cypress: a tall dark green flame. */
function cypress(kit, M, x, z, h, w = h * 0.12) {
  const y = kit.H(x, z) - 0.3;
  const g = lathe([[w * 0.6, 0], [w, h * 0.15], [w * 0.95, h * 0.5], [w * 0.55, h * 0.85], [0.05, h]], 10);
  kit.add(M.cypress, g.translate(x, y, z), { solid: false });
}
/** An olive: a reddish twisting trunk under a round lumpy crown. */
function olive(kit, M, rng, x, z, s = 1) {
  const y = kit.H(x, z) - 0.2, lean = (rng() - 0.5) * 0.8;
  kit.add(M.oliveTrunk, tube([V(x, y, z), V(x + lean * s, y + 1.4 * s, z), V(x + lean * 0.5 * s, y + 2.6 * s, z + 0.3 * s)], 0.22 * s, 6, 5), { solid: false });
  const g = lumpy(new THREE.IcosahedronGeometry(1, 2), 0.18, 1.6, x + z).scale(2.2 * s, 1.5 * s, 2.2 * s);
  kit.add(M.olive[Math.floor(rng() * M.olive.length)], smoothG(g).translate(x + lean * 0.5 * s, y + 3.3 * s, z + 0.3 * s), { solid: false });
}
/** A round dark shrub (or a thicket of them). */
function shrub(kit, M, rng, x, z, r) {
  const g = lumpy(new THREE.IcosahedronGeometry(1, 2), 0.2, 1.4, x * 3 + z).scale(r, r * 0.85, r);
  kit.add(M.dark[Math.floor(rng() * M.dark.length)], smoothG(g).translate(x, kit.H(x, z) + r * 0.55, z), { solid: false });
}
/** A rounded tree: a short trunk and a cluster of dark crowns (the woods, the lake's far shore). */
function roundTree(kit, M, rng, x, z, h) {
  const y = kit.H(x, z) - 0.2;
  kit.add(M.oliveTrunk, tube([V(x, y, z), V(x, y + h * 0.5, z)], h * 0.04, 2, 5), { solid: false });
  for (let k = 0; k < 4; k++) {
    const g = lumpy(new THREE.IcosahedronGeometry(1, 2), 0.15, 1.6, x + k).scale(h * 0.3, h * 0.26, h * 0.3);
    kit.add(M.dark[Math.floor(rng() * M.dark.length)], smoothG(g).translate(x + (rng() - 0.5) * h * 0.35, y + h * (0.55 + rng() * 0.3), z + (rng() - 0.5) * h * 0.35), { solid: false });
  }
}

/** The round plaza: concentric stone rings, a thin pole in the middle. */
function plaza(kit, M, { x, z, r, pole = 9 }) {
  const y = kit.H(x, z) + 0.05;
  kit.add(M.plaza, new THREE.CylinderGeometry(r, r, 0.25, 64).translate(x, y, z));
  for (const [i, k] of [0.75, 0.5, 0.25].entries()) kit.add(M.plaza, new THREE.CylinderGeometry(r * k, r * k, 0.25 + 0.06 * (i + 1), 64).translate(x, y + 0.03 * (i + 1), z));
  if (pole) kit.add(M.pole, new THREE.CylinderGeometry(0.12, 0.18, pole, 6).translate(x, y + pole / 2, z));
}

/** White ruins: blocks of every size along a line (x0, z0 → x1, z1), a few on top of others; rooms cut in them (cave doors). */
function ruins(kit, M, rng, { x0, z0, x1, z1, n = 14, h = 8, doors = 0.3 }) {
  for (let i = 0; i < n; i++) {
    const t = rng(), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, w = 2 + rng() * h * 0.6, d = 2 + rng() * h * 0.5, hh = 1 + rng() * h, yaw = (rng() - 0.5) * 0.3;
    const y = kit.base(x, z, w * 0.5) - 0.3;
    kit.add(M.white, put(new THREE.BoxGeometry(w, hh, d), x, y + hh / 2, z, yaw));
    if (rng() < doors) kit.add(M.cave, put(new THREE.BoxGeometry(w * 0.3, hh * 0.45, 0.2), x, y + hh * 0.22, z + d / 2 + 0.05, yaw), { solid: false });
    if (rng() < 0.3) kit.add(M.white, put(new THREE.BoxGeometry(w * 0.6, hh * 0.5, d * 0.6), x + (rng() - 0.5) * w * 0.3, y + hh * 1.25, z, yaw));
  }
}

/** The white hill: terraces of sculpted rock, boulders, cave doors, round dark shrubs. */
function whiteHill(kit, M, rng, { x, z, r, tiers = [[1, 0.35], [0.72, 0.65], [0.46, 0.9]], h }) {
  const y0 = kit.base(x, z, r * 0.5) - 1;
  tiers.forEach(([k, t], i) => {
    const g = lumpy(new THREE.CylinderGeometry(r * k * 0.92, r * k, h * t, 40, 4), 0.08, 0.05, i + x);
    kit.add(M.rock, smoothG(g).translate(x, y0 + h * t / 2, z));
    for (let j = 0; j < 12; j++) {
      const a = rng() * Math.PI * 2, br = r * 0.06 * (0.6 + rng());
      kit.add(M.rock, smoothG(lumpy(new THREE.IcosahedronGeometry(br, 1), 0.15, 0.4, j)).translate(x + Math.cos(a) * r * k, y0 + h * t * (0.4 + rng() * 0.6), z + Math.sin(a) * r * k));
      if (rng() < 0.6) shrub(kit, M, rng, x + Math.cos(a + 0.2) * r * k * 0.95, z + Math.sin(a + 0.2) * r * k * 0.95, r * 0.05 * (0.8 + rng()));
    }
    for (let j = 0; j < 3; j++) {
      const a = Math.PI / 2 + (j - 1) * 0.35;
      kit.add(M.cave, put(new THREE.CylinderGeometry(r * 0.04, r * 0.04, 0.3, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).scale(1, 1.4, 1), x + Math.cos(a) * r * k * 0.99, y0 + h * t * 0.35, z + Math.sin(a) * r * k * 0.99, -a + Math.PI / 2), { solid: false });
    }
  });
}

/** A lake: a flat water plane at y over a rect (local). */
function lake(kit, M, { x0, x1, z0, z1, y = -0.4 }) {
  kit.mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), M.water, { solid: false, shadow: false });
}

/** The pagoda temple on the far shore: a block, a tiered roof, a dome beside. */
function temple(kit, M, { x, z, s = 1 }) {
  const y = kit.base(x, z, 4 * s);
  kit.add(M.white, new THREE.BoxGeometry(10 * s, 6 * s, 8 * s).translate(x, y + 3 * s, z));
  for (let k = 0; k < 3; k++) kit.add(M.roof, new THREE.ConeGeometry((6 - k * 1.6) * s, 2 * s, 4).rotateY(Math.PI / 4).translate(x, y + (7 + k * 2.2) * s, z));
  kit.add(M.white, new THREE.BoxGeometry(6 * s, 4 * s, 6 * s).translate(x - 9 * s, y + 2 * s, z + 1 * s));
}

/** A thin white pillar standing h high. */
const pillar = (kit, M, x, z, h, r = 0.6) => kit.add(M.pole, new THREE.CylinderGeometry(r, r * 1.1, h, 10).translate(x, kit.H(x, z) + h / 2 - 0.5, z));

/**
 * A panel's scene. o: { umbrellas, stepped, smooth, spheres, arches, hills, ruins, temples, pillars: [[x, z, h, r]…],
 * cypresses: [[x, z, h]…], olives: [[x, z, s]…], shrubs: [[x, z, r]…], trees: [[x, z, h]…], plaza, lake, paths: [[pts, w]…],
 * clouds, extra }
 */
function gardenScene(kit, v, o) {
  const M = materials(kit), rng = mulberry32(o.seed ?? 1);
  for (const u of o.umbrellas ?? []) umbrella(kit, M, { seed: (o.seed ?? 1) + u.x, ...u });
  for (const p of o.stepped ?? []) steppedPyramid(kit, M, p);
  for (const p of o.smooth ?? []) smoothPyramid(kit, M, p);
  for (const s of o.spheres ?? []) sphere(kit, M, s);
  for (const a of o.arches ?? []) sphereArch(kit, M, a);
  for (const h of o.hills ?? []) whiteHill(kit, M, rng, h);
  for (const r of o.ruins ?? []) ruins(kit, M, rng, r);
  for (const t of o.temples ?? []) temple(kit, M, t);
  for (const [x, z, h, r] of o.pillars ?? []) pillar(kit, M, x, z, h, r);
  for (const [x, z, h] of o.cypresses ?? []) cypress(kit, M, x, z, h);
  for (const [x, z, s] of o.olives ?? []) olive(kit, M, rng, x, z, s);
  for (const [x, z, r] of o.shrubs ?? []) shrub(kit, M, rng, x, z, r);
  for (const [x, z, h] of o.trees ?? []) roundTree(kit, M, rng, x, z, h);
  if (o.plaza) plaza(kit, M, o.plaza);
  if (o.lake) lake(kit, M, o.lake);
  for (const [pts, w] of o.paths ?? []) kit.add(M.path, groundRibbon(kit.H.bind(kit), pts, w, 0.04), { solid: false });
  for (const c of [o.clouds ?? []].flat()) cloudSea(kit, M, { at: [v.camera.eye[0], v.camera.eye[2]], yaw: v.camera.yaw ?? 0, deck: false, seed: o.seed ?? 1, pink: true, ...c });
  o.extra?.(kit, M, rng);
}

/** Rows of a kind along an avenue: from z0 to z1, at x = ±off, every `step` m (with a little jitter). */
const avenue = (z0, z1, off, step, f) => { const out = []; for (let z = z0; z > z1; z -= step) for (const s of [-1, 1]) out.push(f(s * off + Math.sin(z * 1.7) * 0.6, z)); return out; };
/** Scatter n things in a ring band round (cx, cz) between r0 and r1 (an arc a0..a1, deg from -z). */
const scatter = (n, seed, cx, cz, r0, r1, a0 = -180, a1 = 180, f) => {
  const rng = mulberry32(seed), out = [];
  for (let i = 0; i < n; i++) { const a = (a0 + rng() * (a1 - a0)) * Math.PI / 180, r = r0 + rng() * (r1 - r0); out.push(f(cx + Math.sin(a) * r, cz - Math.cos(a) * r, rng)); }
  return out;
};

// ---------------------------------------------------------------- grounds
const MEADOW = { color: '#d8cf56', color2: '#cdd25a', color3: '#bcc254', ticks: true };
/** The meadow: flat near, low swells beyond, a lake hollow ([cx, cz, rx, rz]) and far wooded hills. */
const meadow = (o = {}) => ({
  height: (x, z) => {
    const d = Math.hypot(x, z);
    let h = 0.25 * nG(x * 0.03, z * 0.03) + smoothstep(120, 1400, d) * (8 + 6 * nH(x * 0.003, z * 0.003));
    if (o.lake) { const [cx, cz, rx, rz] = o.lake, e = Math.hypot((x - cx) / rx, (z - cz) / rz); h = h * smoothstep(0.9, 1.3, e) - 1.4 * (1 - smoothstep(0.85, 1.0, e)); }
    if (o.rise) h += o.rise(x, z);
    return h;
  },
  material: MEADOW, rings: { r1: 2600 },
});

const view = (o) => ({ sky: SKY.blue, look: GARDEN_LOOK, fog: 0.45, ...o });
const CLOAKED = { palette: PERSON, head: 'hood' };

export const GARDEN_VIEWS = [
  // ===================================================================== IMG_3793
  view({
    id: '3793-grove-pyramid', title: 'The umbrella grove and the smooth pyramid', sheet: 'IMG_3793', panel: 1, where: 'top left', crop: [33, 33, 463, 468],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 56, horizon: 0.72 },
    sun: { side: -60, el: 40 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37931,
        umbrellas: [{ x: -26, z: -32, h: 30, R: 22 }, { x: -16, z: -75, h: 24, R: 18 }, { x: 34, z: -95, h: 20, R: 16 }, { x: -40, z: -150, h: 18, R: 14 }, { x: -20, z: -190, h: 14, R: 12 }, { x: 40, z: -180, h: 12, R: 12 }],
        smooth: [{ x: 4, z: -120, half: 26, height: 26, yaw: 0.35 }],
        shrubs: [[30, -60, 4], [36, -64, 3], [26, -56, 2.6], [-30, -40, 2], [-24, -36, 1.6]],
        paths: [[[[-40, -24], [-10, -22], [20, -30], [60, -34]], 1.2]],
      });
    },
  }),
  view({
    id: '3793-white-hill', title: 'The white hill and the stepped pyramid on top', sheet: 'IMG_3793', panel: 2, where: 'top right', crop: [526, 33, 463, 467],
    camera: { eye: [0, 8, 0], yaw: 0, fov: 54, horizon: 0.72 },
    sun: { side: -110, el: 40 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37932,
        hills: [{ x: 14, z: -150, r: 64, h: 62 }],
        stepped: [{ x: 14, z: -165, half: 15, height: 24, tiers: 10, yaw: -0.2, temple: true, y: 60 }],
        spheres: [{ x: -50, z: -320, R: 60, sink: 0.05, y: 95 }],
        shrubs: scatter(40, 3793, 0, -60, 12, 70, -60, 60, (x, z, r) => [x, z, 2 + r() * 4]),
        trees: scatter(24, 37932, 14, -150, 30, 70, -120, 120, (x, z, r) => [x, z, 10 + r() * 8]),
        extra(k, M) { k.add(M.pole, tube([V(-90, 60, -260), V(60, 140, -220)], 0.3, 2, 4), { solid: false }); },
      });
    },
  }),
  view({
    id: '3793-arch-lake', title: 'The sphere-arch over the lake', sheet: 'IMG_3793', panel: 3, where: 'bottom left', crop: [33, 526, 466, 467],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 54, horizon: 0.6 },
    sun: { side: 130, el: 40 },
    ground: meadow({ lake: [0, -70, 90, 50] }),
    people: [{ at: [8, -6], facing: 3.1, ...CLOAKED }],
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37933,
        lake: { x0: -120, x1: 120, z0: -125, z1: -15, y: -0.6 },
        arches: [{ x: -48, z: -150, R: 72, yaw: 0.4 }],
        ruins: [{ x0: -8, z0: -150, x1: 40, z1: -158, n: 12, h: 10 }],
        cypresses: [[-70, -140, 22], [-62, -148, 26], [-24, -140, 18], [-30, -150, 20], [64, -140, 30], [70, -146, 34], [56, -150, 24]],
        shrubs: [[-20, -12, 2], [-26, -10, 1.6], [24, -14, 2.4], [-60, -8, 3]],
        pillars: [[18, -150, 20, 0.3]],
        clouds: { y: 30, near: 200, far: 500, n: 16, size: [24, 40], spread: 30, yaw: 25 },
      });
    },
  }),
  view({
    id: '3793-olive-plaza', title: 'The olive grove round the plaza', sheet: 'IMG_3793', panel: 4, where: 'bottom right', crop: [515, 525, 475, 467],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 54, horizon: 0.55 },
    sun: { side: 150, el: 35 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37934,
        plaza: { x: 2, z: -42, r: 18, pole: 14 },
        olives: [...scatter(40, 3793, 2, -42, 22, 70, -110, 110, (x, z, r) => [x, z, 1.2 + r() * 0.8]), [-12, -14, 1.8], [-6, -10, 2], [14, -14, 1.6], [-18, -20, 1.4]],
        trees: [[-24, -16, 22], [-28, -26, 26], [26, -22, 24]],
        spheres: [{ x: 120, z: -420, R: 22, sink: 0.4 }],
        paths: [[[[0, -2], [1, -30]], 2.6]],
        clouds: { y: 30, near: 300, far: 700, n: 20, size: [26, 44], spread: 25, yaw: -30 },
      });
    },
  }),
  // ===================================================================== IMG_3794
  view({
    id: '3794-canopies-pyramids', title: 'Under the canopies, the pyramids beyond', sheet: 'IMG_3794', panel: 1, where: 'top, wide', crop: [35, 37, 627, 327],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 40, horizon: 0.85 },
    sun: { side: 140, el: 40 },
    ground: meadow(),
    people: [{ at: [-12, -60], facing: 0, ...CLOAKED }],
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37941,
        umbrellas: [{ x: -12, z: -55, h: 26, R: 46 }, { x: -70, z: -90, h: 22, R: 30 }, { x: 22, z: -110, h: 17, R: 30 }, { x: -50, z: -170, h: 12, R: 20 }],
        stepped: [{ x: 90, z: -230, half: 40, height: 45, tiers: 14, temple: false }, { x: 20, z: -280, half: 26, height: 30, tiers: 12, temple: false }],
        ruins: [{ x0: -120, z0: -200, x1: -80, z1: -210, n: 10, h: 8 }],
      });
    },
  }),
  view({
    id: '3794-pillars-spheres', title: 'Pillars and spheres under a pink sky', sheet: 'IMG_3794', panel: 2, where: 'top right', crop: [686, 37, 304, 327],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.88 },
    sun: { side: 120, el: 30 }, sky: SKY.pink,
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37942,
        pillars: [[-13, -40, 80, 1.6], [-4, -60, 80, 0.5], [12, -45, 80, 1.3]],
        spheres: [{ x: 18, z: -160, R: 40, sink: 0.35 }, { x: -8, z: -260, R: 14, sink: 0.4 }],
        trees: [[-16, -22, 14], [26, -26, 16], [30, -36, 12]],
        shrubs: [[-14, -12, 3], [18, -10, 3], [22, -14, 2.4]],
        paths: [[[[-20, -6], [-4, -20], [10, -60]], 1.4]],
      });
    },
  }),
  view({
    id: '3794-wood-ruins', title: 'The white ruins in the wood', sheet: 'IMG_3794', panel: 3, where: 'middle left', crop: [36, 387, 464, 239],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 40, horizon: 0.7 },
    sun: { side: -60, el: 45 }, sky: SKY.mint,
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37943,
        ruins: [{ x0: -30, z0: -70, x1: 30, z1: -80, n: 24, h: 10, doors: 0.5 }],
        trees: [...scatter(40, 3794, 0, -70, 18, 80, -90, 90, (x, z, r) => [x, z, 14 + r() * 14]), [-40, -40, 18], [36, -40, 16]],
        shrubs: scatter(30, 37943, 0, -40, 8, 40, -80, 80, (x, z, r) => [x, z, 1.5 + r() * 2.5]),
        extra(k, M) {
          // the robot statue: blocks and a round head, leaning a little
          const y = k.H(-12, -72);
          for (const [dx, dy, w, h] of [[0, 0, 4, 8], [0, 8, 6, 6], [-3.6, 8, 1.8, 6], [3.6, 8, 1.8, 6], [-1.2, -8, 1.6, 8], [1.2, -8, 1.6, 8]]) k.add(M.white, put(new THREE.BoxGeometry(w, h, 3), -12 + dx, y + 8 + dy + h / 2, -72, 0, 1, 0, 0.08));
          k.add(M.whiteSmooth, new THREE.SphereGeometry(2.4, 24, 16).translate(-11, y + 24, -72));
        },
      });
    },
  }),
  view({
    id: '3794-sphere-field', title: 'The giant spheres among the pillars', sheet: 'IMG_3794', panel: 4, where: 'middle right', crop: [524, 388, 466, 238],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 34, horizon: 0.75 },
    sun: { side: 150, el: 30 }, sky: SKY.pink,
    ground: meadow({ lake: [10, -40, 40, 10] }),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37944,
        spheres: [{ x: -95, z: -150, R: 60, sink: 0.3 }, { x: 90, z: -170, R: 60, sink: 0.25 }, { x: 18, z: -260, R: 12, sink: 0.4 }],
        pillars: [[-30, -150, 60, 0.6], [6, -170, 60, 0.6], [30, -150, 60, 0.6], [52, -160, 60, 0.6]],
        lake: { x0: -40, x1: 60, z0: -50, z1: -30, y: -0.3 },
        shrubs: [[50, -60, 6], [60, -70, 5], [-40, -80, 4]],
      });
    },
  }),
  view({
    id: '3794-lake-buildings', title: 'The white buildings and their sphere over the lake', sheet: 'IMG_3794', panel: 5, where: 'bottom left', crop: [35, 649, 309, 339],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 54, horizon: 0.55 },
    sun: { side: -80, el: 45 },
    ground: meadow({ lake: [-10, -45, 40, 30] }),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37945,
        lake: { x0: -60, x1: 40, z0: -75, z1: -15, y: -0.6 },
        ruins: [{ x0: -50, z0: -90, x1: 0, z1: -95, n: 16, h: 10, doors: 0 }],
        spheres: [{ x: -26, z: -110, R: 26, sink: 0.15 }],
        pillars: [[-50, -90, 50, 1.8]],
        trees: [[22, -40, 26], [18, -24, 18]],
        shrubs: [[-30, -10, 2], [10, -8, 2.4]],
      });
    },
  }),
  view({
    id: '3794-avenue-sphere', title: 'The avenue to the plaza, the great sphere setting', sheet: 'IMG_3794', panel: 6, where: 'bottom right, wide', crop: [366, 649, 624, 340],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 36, horizon: 0.62 },
    sun: { side: 170, el: 25 },
    ground: meadow(),
    people: [{ at: [0.3, -9], facing: 3.1, ...CLOAKED }],
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37946,
        plaza: { x: 0, z: -40, r: 15, pole: 0 },
        olives: [...avenue(-14, -150, 8, 8, (x, z) => [x, z, 1.3]), ...scatter(30, 3794, 0, -40, 18, 40, -100, 100, (x, z, r) => [x, z, 1 + r() * 0.6])],
        cypresses: [...avenue(-30, -200, 14, 14, (x, z) => [x, z, 16]), [-28, -10, 30], [30, -12, 34]],
        spheres: [{ x: 10, z: -700, R: 90, sink: 0.45 }],
        paths: [[[[0, 0], [0, -26]], 2], [[[0, -54], [0, -240]], 2]],
      });
    },
  }),
  // ===================================================================== IMG_3795
  view({
    id: '3795-tree-pyramid', title: 'The traveller on the path to the pyramid', sheet: 'IMG_3795', panel: 1, where: 'top left', crop: [44, 45, 442, 531],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 60, horizon: 0.78 },
    sun: { side: 120, el: 45 }, sky: SKY.mint,
    ground: meadow({ lake: [26, -24, 10, 4] }),
    people: [{ at: [2, -14], facing: 0, ...CLOAKED }],
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37951,
        umbrellas: [{ x: -10, z: -36, h: 30, R: 26 }, { x: -36, z: -70, h: 18, R: 14 }, { x: -50, z: -110, h: 14, R: 14 }],
        smooth: [{ x: 18, z: -80, half: 22, height: 34, yaw: -0.15, top: 0.08 }],
        shrubs: [[6, -50, 2.6], [10, -46, 2], [26, -55, 2.4], [-14, -30, 2]],
        paths: [[[[-6, 0], [2, -12], [-2, -30], [10, -50]], 1.6]],
        pillars: [[24, -60, 6, 1.6]],
      });
    },
  }),
  view({
    id: '3795-sphere-ruins', title: 'The great sphere over the ruins and cypresses', sheet: 'IMG_3795', panel: 2, where: 'top middle', crop: [507, 45, 227, 531],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 66, horizon: 0.9 },
    sun: { side: 160, el: 40 }, sky: SKY.mint,
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37952,
        spheres: [{ x: 10, z: -260, R: 120, sink: 0.05 }],
        cypresses: [[-14, -50, 30], [-6, -60, 34], [10, -55, 38], [16, -45, 30], [-10, -90, 40]],
        ruins: [{ x0: -6, z0: -40, x1: 10, z1: -42, n: 6, h: 6, doors: 0.8 }],
        pillars: [[-20, -60, 30, 1.2]],
        shrubs: [[-10, -14, 2], [12, -12, 2.6], [-14, -20, 2.2]],
        paths: [[[[0, 0], [2, -38]], 1.6]],
      });
    },
  }),
  view({
    id: '3795-towers-spheres', title: 'White towers and spheres on the hill', sheet: 'IMG_3795', panel: 3, where: 'top right', crop: [754, 46, 226, 259],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 56, horizon: 0.9 },
    sun: { side: -60, el: 45 },
    ground: meadow({ rise: (x, z) => 4 * smoothstep(-30, -50, z) }),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37953,
        ruins: [{ x0: -20, z0: -60, x1: 30, z1: -64, n: 12, h: 8, doors: 0.5 }],
        spheres: [{ x: 20, z: -70, R: 9, sink: 0.1, y: 16 }, { x: 14, z: -62, R: 4, sink: 0.1, y: 8 }, { x: -2, z: -58, R: 3, sink: 0.1, y: 8 }],
        extra(k, M) { k.add(M.white, new THREE.BoxGeometry(10, 60, 8).translate(-12, 30, -70)); k.add(M.white, new THREE.BoxGeometry(4, 60, 4).translate(-4, 30, -66)); },
        shrubs: [[-14, -50, 2.4], [-6, -52, 1.8], [24, -54, 2]],
      });
    },
  }),
  view({
    id: '3795-arches-spheres', title: 'Arches and spheres in the white ruin', sheet: 'IMG_3795', panel: 4, where: 'middle right', crop: [754, 321, 226, 255],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 56, horizon: 0.85 },
    sun: { side: 150, el: 40 }, sky: SKY.mint,
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37954,
        extra(k, M) {
          // a vaulted gallery: piers and round arches, a half-dome
          for (const x of [-14, 4, 22]) k.add(M.white, new THREE.BoxGeometry(4, 50, 6).translate(x, 25, -40));
          for (const x of [-5, 13]) k.add(M.white, put(new THREE.TorusGeometry(7, 2, 8, 24, Math.PI), x, 30, -40, 0, [1, 1.6, 1.5]));
          k.add(M.white, new THREE.BoxGeometry(46, 6, 6).translate(4, 50, -40));
        },
        spheres: [{ x: -6, z: -60, R: 6, sink: 0.2 }, { x: 8, z: -58, R: 4.5, sink: 0.2 }],
        ruins: [{ x0: -10, z0: -55, x1: 16, z1: -58, n: 10, h: 3, doors: 0 }],
        trees: [[24, -30, 20], [-22, -26, 16]],
      });
    },
  }),
  view({
    id: '3795-lake-temple', title: 'The temple, the pagoda and the sphere over the lake', sheet: 'IMG_3795', panel: 5, where: 'bottom left', crop: [44, 597, 442, 383],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 50, horizon: 0.55 },
    sun: { side: -130, el: 40 }, sky: SKY.mint,
    ground: meadow({ lake: [0, -48, 90, 30] }),
    people: [{ at: [-12, -10], facing: 0.4, ...CLOAKED }],
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37955,
        lake: { x0: -120, x1: 120, z0: -80, z1: -16, y: -0.6 },
        temples: [{ x: -4, z: -110, s: 1.4 }],
        ruins: [{ x0: -50, z0: -110, x1: -30, z1: -112, n: 5, h: 12, doors: 0.6 }, { x0: 20, z0: -115, x1: 60, z1: -118, n: 8, h: 5, doors: 0 }],
        spheres: [{ x: 32, z: -125, R: 14, sink: 0.2 }],
        trees: [[-56, -40, 30], [-60, -60, 26], [-46, -25, 22], [50, -30, 24], [56, -14, 20]],
        shrubs: [[30, -8, 4], [38, -12, 3.4], [-36, -14, 3]],
      });
    },
  }),
  view({
    id: '3795-plaza-hedges', title: 'The round plaza between the fruit hedges', sheet: 'IMG_3795', panel: 6, where: 'bottom right', crop: [507, 597, 473, 383],
    camera: { eye: [0, 2.6, 0], yaw: 0, fov: 50, horizon: 0.52 },
    sun: { side: 170, el: 20 }, sky: SKY.pink,
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37956,
        plaza: { x: 0, z: -26, r: 14, pole: 0 },
        olives: scatter(40, 3795, 0, -40, 22, 60, -90, 90, (x, z, r) => [x, z, 1.2 + r() * 0.8]),
        trees: [[-24, -12, 18], [-28, -24, 22]],
        extra(k, M, rng) {
          for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) {
            const x = sx * (13 + i * 1.4), z = -10 - i * 0.8;
            k.add(M.dark[i % 3], new THREE.BoxGeometry(2.2, 1.6, 2.2).translate(x, k.H(x, z) + 0.8, z), { solid: false });
            for (let j = 0; j < 4; j++) k.add(M.orange, new THREE.IcosahedronGeometry(0.16, 0).translate(x + (rng() - 0.5) * 2, k.H(x, z) + 0.6 + rng(), z + 1.15), { solid: false });
          }
          k.add(M.white, new THREE.BoxGeometry(14, 90, 10).translate(32, 45, -80));
          k.add(M.white, new THREE.CylinderGeometry(1.2, 2.4, 18, 8).translate(14, k.H(14, -150) + 9, -150));
          k.add(M.white, new THREE.CylinderGeometry(0.5, 1.2, 8, 8).translate(14, k.H(14, -150) + 22, -150));
        },
      });
    },
  }),
  // ===================================================================== IMG_3796
  view({
    id: '3796-trunk-pyramid', title: 'The great trunk, the terrace and the pyramid', sheet: 'IMG_3796', panel: 1, where: 'top left', crop: [51, 50, 297, 462],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 58, horizon: 0.83 },
    sun: { side: -60, el: 45 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37961,
        umbrellas: [{ x: -14, z: -50, h: 32, R: 36, branches: 24 }],
        stepped: [{ x: 26, z: -90, half: 14, height: 32, tiers: 16, temple: false }],
        extra(k, M) { k.add(M.white, new THREE.BoxGeometry(24, 4, 14).translate(-14, 2, -36)); for (let i = 0; i < 8; i++) k.add(M.stair, new THREE.BoxGeometry(3, 0.5, 0.6).translate(-6, 0.25 + i * 0.5, -28 - i * 0.6)); },
      });
    },
  }),
  view({
    id: '3796-mushroom-ruins', title: 'The mushroom tree, the ruins, the pink cloud', sheet: 'IMG_3796', panel: 2, where: 'top middle', crop: [364, 50, 297, 461],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 58, horizon: 0.88 },
    sun: { side: 140, el: 45 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37962,
        umbrellas: [{ x: -22, z: -60, h: 22, R: 20 }],
        ruins: [{ x0: 4, z0: -80, x1: 24, z1: -82, n: 6, h: 18, doors: 0.4 }],
        shrubs: scatter(30, 3796, 0, -50, 6, 40, -60, 60, (x, z, r) => [x, z, 1.5 + r() * 2.5]),
        paths: [[[[-4, 0], [6, -20], [0, -50]], 1.6]],
        clouds: { y: 30, near: 140, far: 300, n: 14, size: [20, 36], spread: 20, yaw: 15 },
      });
    },
  }),
  view({
    id: '3796-golden-arch', title: 'The golden sphere-arch over the ruins', sheet: 'IMG_3796', panel: 3, where: 'top right', crop: [678, 49, 298, 462],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 58, horizon: 0.95 },
    sun: { side: -150, el: 40 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37963,
        arches: [{ x: 2, z: -110, R: 60, yaw: 0, yellow: true, depth: 0.6 }],
        ruins: [{ x0: -20, z0: -100, x1: 26, z1: -104, n: 10, h: 14, doors: 0.3 }],
        pillars: [[10, -90, 18, 1.2], [-4, -95, 22, 1.4]],
        shrubs: [[-22, -40, 4], [26, -36, 5], [20, -40, 3]],
        clouds: { y: 10, near: 160, far: 400, n: 16, size: [18, 30], spread: 30 },
      });
    },
  }),
  view({
    id: '3796-pyramid-pond', title: 'The green pyramid by the pond', sheet: 'IMG_3796', panel: 4, where: 'bottom left', crop: [49, 534, 299, 426],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.68 },
    sun: { side: 150, el: 40 }, sky: SKY.blue,
    ground: meadow({ lake: [0, -40, 50, 24] }),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37964,
        lake: { x0: -60, x1: 60, z0: -64, z1: -14, y: -0.6 },
        smooth: [{ x: -16, z: -110, half: 20, height: 34, top: 0.15 }],
        ruins: [{ x0: 4, z0: -100, x1: 30, z1: -104, n: 8, h: 10, doors: 0.4 }],
        trees: [[34, -96, 22], [-40, -100, 16]],
        clouds: { y: 20, near: 200, far: 500, n: 20, size: [26, 40], spread: 30 },
      });
    },
  }),
  view({
    id: '3796-monolith-wood', title: 'The white monolith over the olive wood', sheet: 'IMG_3796', panel: 5, where: 'bottom middle', crop: [363, 534, 297, 426],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.72 },
    sun: { side: 160, el: 30 }, sky: SKY.pink,
    ground: meadow(),
    people: [{ at: [-1, -10], facing: 0.2, ...CLOAKED }],
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37965,
        trees: [...scatter(20, 37965, 0, -30, 14, 60, -70, 70, (x, z, r) => [x, z, 10 + r() * 10]), [20, -16, 26]],
        olives: scatter(16, 3796, 0, -20, 12, 30, -60, 60, (x, z, r) => [x, z, 1 + r() * 0.5]),
        extra(k, M) { k.add(M.whiteSmooth, new THREE.CapsuleGeometry(4, 40, 6, 16).translate(-6, 22, -140)); },
      });
    },
  }),
  view({
    id: '3796-golden-sphere-plaza', title: 'The golden sphere setting behind the plaza', sheet: 'IMG_3796', panel: 6, where: 'bottom right', crop: [674, 533, 301, 426],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 54, horizon: 0.6 },
    sun: { side: 175, el: 30 },
    ground: meadow(),
    build(kit, v) {
      gardenScene(kit, v, {
        seed: 37966,
        plaza: { x: 0, z: -30, r: 12, pole: 2.4 },
        olives: scatter(60, 3797, 0, -70, 26, 90, -80, 80, (x, z, r) => [x, z, 1.6 + r() * 0.8]),
        spheres: [{ x: 0, z: -420, R: 150, sink: 0.5, yellow: true }],
      });
    },
  }),
];
