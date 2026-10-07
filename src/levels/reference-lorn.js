import * as THREE from 'three';
import { MODE_WATER } from '../materials.js';
import { createNoise2D, mulberry32 } from '../noise.js';
import { V, tube, put, smoothstep, PERSON, CLEAN_SKY } from './reference-kit.js';
import { lumpy } from './sky-stones-kit.js';
import { smooth } from './reference-vael2.js';
import { shroomParts, lathe, buildSkiff, DEEP_WOOD_LOOK, ROOT_INK, BUSH_INK } from './perdide2.js';
import { formAxis } from '../form.js';
import { braid, caveFrame, bankBush, nest as nestParts, taper } from './wood-kit.js';

// ---------------------------------------------------------------------------
// Lorn II's reference sheets (references/Lorn II The Deep Wood/IMG_3797 … 3800): a dusk forest of giant
// pale violet mushrooms among dark cathedral trunks, a coral sky glimpsed between them, a teal stream
// and shallows, glowing egg heaps and coral pools, moss domes, enormous root arches, a crashed saucer,
// a cave glowing coral and the teal skiff. One scene builder (woodScene) does them all; each panel is a
// view (reference-views.js describes the fields).
//
// The sheets are lit from behind: the low sun stands in the coral gaps ahead, so nearly everything
// faces the camera in shade (violet, teal), and the spot blacks fill the hollows of roots and trunks.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `Lorn II / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/Lorn II The Deep Wood/${name}.JPG`, import.meta.url).href });
export const LORN_SHEETS = Object.fromEntries(['IMG_3797', 'IMG_3798', 'IMG_3799', 'IMG_3800'].map((n) => [n, sheet(n)]));

/** The sheets' ink: the world's own look (perdide2.js DEEP_WOOD_LOOK) and a clean sky. */
export const LORN_LOOK = { ...DEEP_WOOD_LOOK, ...CLEAN_SKY, uCast: [0.85, 0.2] };   // (the panels: no long shadows across the paths)
/** sky top, horizon (the coral), shadow (violet), light, sun */
const SKY = {
  dusk: ['#7f7aa6', '#c9807f', '#5a5d8c', '#ece2f2', '#fff0e0'],
  coral: ['#8a7b9e', '#e58c7c', '#5a5d8c', '#ece2f2', '#fff0e0'],
  teal: ['#5d8fa0', '#86a9b6', '#4f6c8c', '#e2ecf2', '#fff0e0'],
  night: ['#0b2a33', '#173e48', '#3d4f7c', '#d8dff0', '#f2e8e0'],
};
const nL = createNoise2D(37971), nM = createNoise2D(37972);

function materials(kit) {
  return {
    // (form: the trunks' strokes wrap round them, the mushrooms' radiate from the stalk; src/form.js)
    trunk: [kit.mat({ color: '#2a4554', flat: true, pattern: 'cracks', detail: 'organic', form: true }), kit.mat({ color: '#334a60', flat: true, pattern: 'cracks', detail: 'organic', form: true }), kit.mat({ color: '#253c4c', flat: true, pattern: 'cracks', detail: 'organic', form: true })],
    farTrunk: kit.mat({ color: '#6e6a92', flat: true }),
    // (the giant mushrooms: pale even in their own shade, as the sheets draw them against the dark wood)
    stalk: [kit.mat({ color: '#b9b0d8', shade: 0.6, hatch: 0.4, detail: 'organic', detailDensity: 0.7, form: true }), kit.mat({ color: '#a79ec9', shade: 0.6, hatch: 0.4, detail: 'organic', detailDensity: 0.7, form: true })],
    cap: [kit.mat({ color: '#c6bde6', flat: true, shade: 0.7, hatch: 0.3, form: true }), kit.mat({ color: '#b8aedd', flat: true, shade: 0.7, hatch: 0.3, form: true })],
    under: kit.mat({ color: '#9b8fbf', flat: true, side: THREE.DoubleSide, shade: 0.4, form: true }),
    // (roots and bushes: dense hatched masses, as the sheets draw them: a hatch over 1 is a denser one)
    root: kit.mat({ color: '#4a6a78', side: THREE.DoubleSide, detail: 'organic', ...ROOT_INK }),
    rootPale: kit.mat({ color: '#6c809c', side: THREE.DoubleSide, detail: 'organic', ...ROOT_INK }),
    moss: kit.mat({ color: '#3f6a6a', flat: true, grid: 2.2 }),
    door: kit.mat({ color: '#9fe0d0', glow: 0.9 }),
    // (the reeds and crystals: pale blades drawn in a thin violet line of their own, not the ink)
    reed: kit.mat({ color: '#a69ccc', flat: true, glow: 0.6, line: 0.45, lineTint: 1 }),
    crystal: kit.mat({ color: '#e7c6d6', flat: true, glow: 0.4, line: 0.45, lineTint: 0.67 }),
    egg: kit.mat({ color: '#fce0b4', glow: 1 }),
    pool: kit.mat({ color: '#f39a86', glow: 1 }),
    coral: kit.mat({ color: '#ef8a72', glow: 0.75, side: THREE.DoubleSide }),
    pad: kit.mat({ color: '#486a68', flat: true }),
    bush: [kit.mat({ color: '#4d6f76', pattern: 'leaves', ...BUSH_INK }), kit.mat({ color: '#557a80', pattern: 'leaves', ...BUSH_INK })],
    glassRib: kit.mat({ color: '#6fb3ad', flat: true, glow: 0.3 }),
    teal: kit.mat({ color: '#4fbcb0', flat: true, metal: 'painted' }),
    tealDeep: kit.mat({ color: '#3a8f8a', flat: true, metal: 'painted' }),
    dark: kit.mat({ color: '#13232c', flat: true }),
    water: kit.mat({ color: '#4a6b6f', color2: '#5f8a8a', mode: MODE_WATER }),
    shard: kit.mat({ color: '#f6c6b6', flat: true, glow: 0.5 }),
  };
}

// ---------------------------------------------------------------- builders (the view's own frame)
/** The sheets' dusk light throws no cast shadows: the wood's masses cast none (their own shade is the light's). */
const NO_CAST = { solid: false, shadow: false };
/** A cathedral trunk: very tall, straight, flaring at its foot (r its radius; far: pale and plain in the haze). */
function trunk(kit, M, rng, x, z, r, { far = false, h = 160 } = {}) {
  const y = kit.base(x, z, r) - 0.5, m = far ? M.farTrunk : M.trunk[Math.floor(rng() * M.trunk.length)];
  kit.add(m, formAxis(new THREE.CylinderGeometry(r * 0.82, r, h, 10, 1, true), 'wrap').translate(x, y + h / 2, z), NO_CAST);
  if (!far) kit.add(m, formAxis(lathe([[r * 2.2, -1.5], [r * 1.6, 0.6], [r * 1.2, 2.6], [r, 5.5]], 10), 'wrap').translate(x, y, z), NO_CAST);
}
/** A giant pale mushroom (perdide2.js's profile): H tall, its cap capR wide, dome how round its top. */
function mushroom(kit, M, rng, { x, z, H, capR, sr = capR * 0.16, dome = 0.16, tilt = 0 }) {
  const y = kit.base(x, z, sr * 2) - 0.4, P = shroomParts({ sr, capR, H, dome }), k = Math.floor(rng() * 2);
  const at = (g) => g.rotateZ(tilt).translate(x, y, z);
  kit.add(M.stalk[k], at(formAxis(lathe(P.stalk, 24), 'cap')), NO_CAST);
  kit.add(M.under, at(formAxis(lathe(P.under, 40), 'cap')), NO_CAST);
  kit.add(M.cap[k], at(formAxis(lathe(P.top, 40), 'cap')), NO_CAST);
  // the gills under the cap: thin ribs from the stalk to the rim (greebles in the cap's dark recess)
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, top = 0.9 * H;
    kit.add(M.under, at(formAxis(tube([V(Math.cos(a) * sr * 1.3, top - 0.01 * H, Math.sin(a) * sr * 1.3), V(Math.cos(a) * capR * 0.96, top - 0.048 * H, Math.sin(a) * capR * 0.96)], capR * 0.01, 2, 3), 'cap')), { solid: false });
  }
}
/** A heap of glowing eggs at (x, z) on the water or the bank, n of them, s their size; a light over it. */
function eggs(kit, M, rng, x, z, n = 12, s = 0.6, spread = 2.5) {
  const y = Math.max(kit.H(x, z), 0);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * spread, e = s * (0.6 + rng() * 0.8);
    kit.add(M.egg, new THREE.SphereGeometry(e, 12, 9).scale(1, 1.35, 1).translate(x + Math.cos(a) * r, y + e * 0.9, z + Math.sin(a) * r), { solid: false, shadow: false });
  }
  kit.light(x, y + 1.2, z, 6 + spread * 1.5);
}
/** A glowing coral pool on the ground or the water. */
function pool(kit, M, x, z, r) {
  kit.add(M.pool, new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2).scale(1, 1, 0.8).translate(x, Math.max(kit.H(x, z), 0) + 0.05, z), { solid: false, shadow: false });
  kit.light(x, 1, z, r * 3 + 3);
}
/** Reeds or crystals: a thicket of thin violet blades (or pale glowing shards) round (x, z). */
function reeds(kit, M, rng, x, z, { n = 60, r = 6, h = 3, crystal = false } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r, hh = h * (0.5 + rng() * 0.8), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const g = new THREE.ConeGeometry(crystal ? hh * 0.08 : hh * 0.03, hh, crystal ? 5 : 3).translate(0, hh / 2, 0);
    kit.add(crystal ? M.crystal : M.reed, put(g, px, Math.max(kit.H(px, pz), 0) - 0.1, pz, rng() * 6, 1, (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.25), { solid: false, shadow: false });
  }
}
/** A moss dome (a hut): a ribbed half-sphere, a lit round door toward +z (turned by yaw). */
function mossDome(kit, M, { x, z, R, yaw = 0, lit = true }) {
  const y = kit.base(x, z, R) - 0.3;
  kit.add(M.moss, put(new THREE.SphereGeometry(R, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), x, y, z, yaw));
  for (let i = 0; i < 8; i++) kit.add(M.root, put(new THREE.TorusGeometry(R * 1.01, R * 0.03, 4, 24, Math.PI).rotateY(Math.PI / 2).scale(1, 0.7, 1), x, y, z, yaw + (i / 8) * Math.PI), { solid: false });
  kit.add(lit ? M.door : M.dark, put(new THREE.CircleGeometry(R * 0.28, 16, 0, Math.PI).scale(1, 1.3, 1), x + Math.sin(yaw) * R * 0.98, y, z + Math.cos(yaw) * R * 0.98, yaw), { solid: false });
  if (lit) kit.light(x + Math.sin(yaw) * (R + 1.5), y + 1.2, z + Math.cos(yaw) * (R + 1.5), 7);
}
/**
 * A root arch over the way: a thick gnarled band from (x0, z0) up over and down to (x1, z1), roots
 * trailing from its feet and hanging under its span (greebles for the spot blacks).
 */
function rootArch(kit, M, rng, { x0, z0, x1, z1, h, r, pale = false }) {
  const A = V(x0, kit.H(x0, z0) - 1, z0), B = V(x1, kit.H(x1, z1) - 1, z1), mid = A.clone().lerp(B, 0.5);
  const pts = [A, A.clone().lerp(mid, 0.3).setY(A.y + h * 0.75), mid.clone().setY(mid.y + h), B.clone().lerp(mid, 0.3).setY(B.y + h * 0.75), B];
  // a core and the strands tangled round it (wood-kit.js braid): the sheets' roots are bundles, not one tube
  const g = tube(pts, r * 0.72, 32, 10);
  lumpy(g, 0.06, 0.15, x0);
  kit.add(pale ? M.rootPale : M.root, g, NO_CAST);
  for (const b of braid(pts, r, { n: 6, seed: x0 + z0, turns: 2 })) kit.add(pale ? M.rootPale : M.root, b, NO_CAST);
  const curve = new THREE.CatmullRomCurve3(pts);
  for (let i = 0; i < 10; i++) {
    const t = 0.2 + rng() * 0.6, p = curve.getPoint(t), l = h * (0.15 + rng() * 0.35);
    kit.add(M.root, tube([p, p.clone().add(V((rng() - 0.5) * 2, -l * 0.5, (rng() - 0.5) * 2)), p.clone().add(V((rng() - 0.5) * 3, -l, (rng() - 0.5) * 3))], r * 0.08, 6, 4), { solid: false, shadow: false });
  }
  for (const F of [A, B]) for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2, d = r * (1.5 + rng() * 2.5);
    kit.add(M.root, tube([F.clone().add(V(0, r * 0.8, 0)), F.clone().add(V(Math.cos(a) * d * 0.6, r * 0.2, Math.sin(a) * d * 0.6)), F.clone().add(V(Math.cos(a) * d, -0.5, Math.sin(a) * d))], r * 0.18, 6, 5), { solid: false });
  }
}
/** A cave mouth framed in roots (wood-kit.js caveFrame): a dark hollow r wide, arches of tangled roots over it, roots hanging in it, coral glowing at its back. */
function cave(kit, M, rng, { x, z, r, glow = true, yaw = 0, arches = 7 }) {
  const y = kit.H(x, z) - 0.3, F = caveFrame({ r, glow, arches, seed: x * 3 + z });
  for (const g of F.roots) kit.add(M.root, put(g, x, y, z, yaw), NO_CAST);
  for (const g of F.hang) kit.add(M.root, put(g, x, y, z, yaw), NO_CAST);
  for (const g of F.dark) kit.add(M.dark, put(g, x, y, z, yaw), NO_CAST);
  for (const g of F.glow) kit.add(M.coral, put(g, x, y, z, yaw), NO_CAST);
  if (glow) kit.light(x - Math.sin(yaw) * r * 1.8, y + 2, z - Math.cos(yaw) * r * 1.8, r * 2.5);
  void rng;
}
/** The crashed saucer, half sunk and tilted, its dark slot, a light on its rim. */
function saucer(kit, M, { x, z, r, tilt = 0.18, yaw = 0 }) {
  const y = kit.H(x, z);
  kit.add(M.teal, put(new THREE.SphereGeometry(r, 32, 12).scale(1, 0.32, 1), x, y + r * 0.08, z, yaw, 1, tilt, 0));
  kit.add(M.tealDeep, put(new THREE.TorusGeometry(r * 0.98, r * 0.06, 6, 32).rotateX(Math.PI / 2), x, y + r * 0.08, z, yaw, 1, tilt, 0), { solid: false });
  kit.add(M.dark, put(new THREE.SphereGeometry(r * 0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.45, 0.8), x, y + r * 0.3, z, yaw, 1, tilt, 0), { solid: false });
}
/** The teal skiff on the water (perdide2.js's), heading yaw, s its scale; riders on it. */
function skiff(kit, M, { x, z, yaw = 0, s = 1, riders = 0 }) {
  const b = buildSkiff();
  b.root.position.set(x, 0.25, z);
  b.root.rotation.y = yaw;
  b.root.scale.setScalar(s);
  b.root.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(b.root);
  for (let i = 0; i < riders; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 8).translate(0, 0.75, 0), kit.mat({ color: PERSON.cloak, flat: true }));
    f.position.set(x + Math.sin(yaw) * (i ? -1 : 1.2) * s, 0.5, z + Math.cos(yaw) * (i ? -1 : 1.2) * s);
    kit.group.add(f);
  }
}
/** A dark bush on the bank. */
function bush(kit, M, rng, x, z, r) {
  const g = bankBush(x + z).scale(r, r, r);   // (a mass of small leaf clumps, densely hatched: wood-kit.js)
  kit.add(M.bush[Math.floor(rng() * 2)], g.translate(x, Math.max(kit.H(x, z), 0) + r * 0.3, z), { solid: false });
}

/**
 * A panel's scene. o: { trunks: [[x, z, r, far]…] or { n, x0, x1, z0, z1, r }, mushrooms, eggs: [[x, z, n, s, spread]…], pools: [[x, z, r]…],
 * reeds: [[x, z, opts]…], domes, arches, caves, saucers, skiffs, bushes: [[x, z, r]…], extra }
 */
function woodScene(kit, v, o) {
  const M = materials(kit), rng = mulberry32(o.seed ?? 1);
  kit.mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2).translate(0, 0, -800), M.water, { solid: false, shadow: false });
  const T = o.trunks ?? { n: 60 };
  if (Array.isArray(T)) for (const [x, z, r, far] of T) trunk(kit, M, rng, x, z, r, { far });
  else for (let i = 0; i < T.n; i++) {
    const x = (T.x0 ?? -160) + rng() * ((T.x1 ?? 160) - (T.x0 ?? -160)), z = (T.z0 ?? -30) - rng() * ((T.z0 ?? -30) - (T.z1 ?? -400));
    if (Math.abs(x) < (T.clear ?? 6) * (1 - z / 400)) continue;
    trunk(kit, M, rng, x, z, (T.r ?? 2.6) * (0.6 + rng() * 0.8), { far: -z > (T.far ?? 160) });
  }
  for (const m of o.mushrooms ?? []) mushroom(kit, M, rng, m);
  for (const [x, z, n, s, sp] of o.eggs ?? []) eggs(kit, M, rng, x, z, n, s, sp);
  for (const [x, z, r] of o.pools ?? []) pool(kit, M, x, z, r);
  for (const [x, z, op] of o.reeds ?? []) reeds(kit, M, rng, x, z, op);
  for (const d of o.domes ?? []) mossDome(kit, M, d);
  for (const a of o.arches ?? []) rootArch(kit, M, rng, a);
  for (const c of o.caves ?? []) cave(kit, M, rng, c);
  for (const s of o.saucers ?? []) saucer(kit, M, s);
  for (const s of o.skiffs ?? []) skiff(kit, M, s);
  for (const [x, z, r] of o.bushes ?? []) bush(kit, M, rng, x, z, r);
  o.extra?.(kit, M, rng);
}

/** Scatter n things in a band in front of the camera (x0..x1, z0..z1). */
const strew = (n, seed, x0, x1, z0, z1, f) => { const r = mulberry32(seed), out = []; for (let i = 0; i < n; i++) out.push(f(x0 + r() * (x1 - x0), z0 + r() * (z1 - z0), r)); return out; };

// ---------------------------------------------------------------- grounds
const BANK = { color: '#3e5f60', color2: '#46686a', color3: '#35575a' };
/** The swamp: a low bank (above the water at 0) along a path from the camera, shallows either side, hummocks. */
const swamp = (o = {}) => ({
  height: (x, z) => {
    const pw = o.path ?? 5, px = (o.bend ?? 0) * z * z * 0.0005 + (o.drift ?? 0) * z;
    let h = -0.4 + 0.5 * nL(x * 0.05, z * 0.05) + 0.25 * nM(x * 0.2, z * 0.2);
    if (pw > 0) h = Math.max(h, 0.35 * (1 - smoothstep(pw * 0.6, pw * 1.4, Math.abs(x - px))));   // the path's bank (0: none, all shallows)
    if (o.dry) h = Math.max(h, o.dry);
    return h + smoothstep(300, 1500, Math.hypot(x, z)) * 6;
  },
  material: BANK, rings: { r1: 2200 },
});

const view = (o) => ({ sky: SKY.dusk, look: LORN_LOOK, fog: 1.6, ...o });
const CLOAKED = { palette: PERSON, head: 'hood' };
// the low sun ahead, in the coral gaps: nearly everything the camera sees is in its own shade
const BACKLIT = { side: 8, el: 9 };

export const LORN_VIEWS = [
  // ===================================================================== IMG_3797
  view({
    id: '3797-mushrooms-domes', title: 'Giant mushrooms over the moss domes', sheet: 'IMG_3797', panel: 1, where: 'top left', crop: [14, 14, 490, 376],
    camera: { eye: [0, 1.8, 0], yaw: 0, fov: 56, horizon: 0.62 },
    sun: BACKLIT,
    ground: swamp({ path: 3 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37971, trunks: { n: 70, z0: -60, z1: -300, r: 2.4, far: 120 },
        mushrooms: [{ x: -22, z: -40, H: 26, capR: 12, dome: 0.3 }, { x: 24, z: -44, H: 28, capR: 12, dome: 0.25 }, { x: -6, z: -60, H: 22, capR: 10, dome: 0.4 }, { x: -50, z: -90, H: 30, capR: 14 }, { x: 4, z: -110, H: 8, capR: 3.5 }, { x: 12, z: -104, H: 9, capR: 4 }],
        domes: [{ x: -8, z: -24, R: 5, yaw: 0.6 }, { x: 13, z: -26, R: 4, yaw: -0.4 }],
        reeds: [[-12, -19, { n: 220, r: 8, h: 4 }], [13, -21, { n: 220, r: 8, h: 4 }], [0, -60, { n: 120, r: 20, h: 3 }]],
      });
    },
  }),
  view({
    id: '3797-egg-heaps', title: 'Egg heaps along the stream to the coral sun', sheet: 'IMG_3797', panel: 2, where: 'top right', crop: [519, 14, 490, 375],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.52 },
    sun: { side: 4, el: 6 }, sky: SKY.coral,
    ground: swamp({ path: 2.5 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37972, trunks: [[-9, -10, 2.4], [-40, -100, 6], [-20, -140, 5], [14, -160, 5], [36, -120, 6], [-60, -200, 7, true], [60, -220, 7, true], [0, -260, 6, true]],
        mushrooms: [{ x: 18, z: -60, H: 20, capR: 9, dome: 0.15 }],
        eggs: [[9, -14, 40, 0.6, 3.5], [3, -30, 30, 0.5, 2.6], [-2, -42, 20, 0.4, 2], [4, -55, 14, 0.4, 1.6]],
        reeds: [[-12, -26, { n: 260, r: 10, h: 4.5 }], [14, -36, { n: 240, r: 12, h: 4.5 }]],
      });
    },
  }),
  view({
    id: '3797-nest-shroom', title: 'The nest of eggs in the great mushroom', sheet: 'IMG_3797', panel: 3, where: 'middle left', crop: [15, 403, 490, 348],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 54, horizon: 0.6 },
    sun: BACKLIT, sky: ['#6f6a94', '#8a87b0', '#4f5a86', '#e2e4f2', '#fff0e0'],
    ground: swamp({ path: 4 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37973, trunks: { n: 60, z0: -40, z1: -260, r: 2.2, far: 100 },
        mushrooms: [{ x: -16, z: -16, H: 10, capR: 7, dome: 0.4, tilt: 0.15 }, { x: 10, z: -24, H: 10, capR: 10, dome: 0.2 }, { x: -6, z: -60, H: 8, capR: 5, dome: 0.3 }, { x: 18, z: -70, H: 7, capR: 4 }],
        domes: [{ x: -10, z: -30, R: 4, yaw: 0.3 }],
        arches: [{ x0: -2, z0: -20, x1: 22, z1: -14, h: 11, r: 1.6 }],
        // the nest in the great cap: a woven bowl heaped with eggs under a ribbed glass dome (wood-kit.js nest)
        extra(k, M) {
          const P = shroomParts({ sr: 1.6, capR: 10, H: 10, dome: 0.2 }), y = k.base(10, -24, 3.2) - 0.4 + P.topY - 0.6, N = nestParts(4.2, { seed: 3797, eggs: 30 });
          for (const g of N.bowl) k.add(M.root, g.translate(10, y, -24), NO_CAST);
          for (const g of N.ribs) k.add(M.glassRib, g.translate(10, y, -24), NO_CAST);
          for (const [x, ey, z, sz] of N.eggs) k.add(M.egg, new THREE.SphereGeometry(sz, 10, 8).scale(1, 1.3, 1).translate(10 + x, y + ey, -24 + z), NO_CAST);
          k.light(10, y + 2, -24, 10);
        },
      });
    },
  }),
  view({
    id: '3797-root-arches', title: 'Under the root arches, the stream', sheet: 'IMG_3797', panel: 4, where: 'middle right', crop: [517, 403, 494, 347],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 54, horizon: 0.62 },
    sun: BACKLIT, sky: SKY.coral,
    ground: swamp({ path: 3, drift: -0.05 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37974, trunks: { n: 40, z0: -60, z1: -260, r: 2.4, far: 90 },
        arches: [{ x0: -26, z0: -12, x1: 30, z1: -18, h: 14, r: 5 }, { x0: -18, z0: -40, x1: 22, z1: -44, h: 10, r: 2.6 }],
        bushes: [[-7, -9, 3], [9, -11, 3.6], [12, -19, 3], [-11, -21, 2.6], [-4, -14, 1.6], [6, -16, 1.8]],
      });
    },
  }),
  view({
    id: '3797-saucer', title: 'The saucer in the shallows', sheet: 'IMG_3797', panel: 5, where: 'bottom left', crop: [16, 763, 488, 248],
    camera: { eye: [0, 1.4, 0], yaw: 0, fov: 40, horizon: 0.55 },
    sun: { side: -14, el: 10 }, sky: SKY.coral,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37975, trunks: { n: 30, z0: -40, z1: -200, r: 2.6, far: 80, x0: -80, x1: 80 },
        saucers: [{ x: 2, z: -30, r: 7, tilt: 0.06 }],
        bushes: [[-8, -9, 3.4], [-12, -16, 3.4], [-15, -24, 4], [8, -8, 3.2], [11, -15, 3], [16, -26, 4.4], [-22, -40, 6], [24, -44, 6]],
      });
    },
  }),
  view({
    id: '3797-cave-traveller', title: 'The traveller before the root cave', sheet: 'IMG_3797', panel: 6, where: 'bottom right', crop: [521, 763, 488, 248],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 40, horizon: 0.3 },
    sun: BACKLIT,
    ground: swamp({ path: 4, dry: 0.2 }),
    people: [{ at: [0.5, -10], facing: 0, ...CLOAKED }],
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37976, trunks: [],
        caves: [{ x: 0, z: -12, r: 5.5, glow: false, arches: 9 }],
        arches: [{ x0: -10, z0: -8, x1: -4, z1: -18, h: 10, r: 2, pale: true }, { x0: 10, z0: -8, x1: 5, z1: -18, h: 10, r: 2, pale: true }],
      });
    },
  }),
  // ===================================================================== IMG_3798
  view({
    id: '3798-mushroom-pools', title: 'Pale mushrooms over the glowing shallows', sheet: 'IMG_3798', panel: 1, where: 'top left, tall', crop: [25, 21, 310, 431],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 58, horizon: 0.55 },
    sun: BACKLIT, sky: ['#6c6898', '#7f7aa6', '#4f5a86', '#e2e4f2', '#fff0e0'],
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37981, trunks: { n: 80, z0: -50, z1: -260, r: 2.4, far: 90 },
        mushrooms: [{ x: 0, z: -40, H: 26, capR: 12, dome: 0.4 }, { x: -12, z: -36, H: 16, capR: 5, dome: 0.7 }, { x: 14, z: -34, H: 16, capR: 6, dome: 0.5 }, { x: -16, z: -50, H: 12, capR: 4, dome: 0.6 }, { x: 8, z: -60, H: 12, capR: 4, dome: 0.6 }],
        eggs: strew(16, 37981, -14, 14, -40, -8, (x, z, r) => [x, z, 3, 0.25, 0.8]),
      });
    },
  }),
  view({
    id: '3798-teal-stems', title: 'The teal stems and the little lights', sheet: 'IMG_3798', panel: 2, where: 'top middle', crop: [351, 21, 306, 259],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 50, horizon: 0.6 },
    sun: BACKLIT, sky: SKY.teal,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37982,
        trunks: strew(70, 37982, -30, 30, -60, -12, (x, z, r) => [x, z, 0.4 + r() * 0.7]),
        eggs: strew(14, 37983, -10, 10, -30, -6, (x, z, r) => [x, z, 3, 0.18, 0.6]),
      });
    },
  }),
  view({
    id: '3798-light-stalks', title: 'Lit stalks in the dark water', sheet: 'IMG_3798', panel: 3, where: 'top right', crop: [673, 21, 324, 259],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 50, horizon: 0.45 },
    sun: { side: -20, el: 6 },
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37984, trunks: [[-10, -14, 1.6], [12, -18, 2.2], [-30, -50, 3], [30, -60, 3], [0, -90, 4, true]],
        eggs: strew(10, 37984, -6, 6, -24, -6, (x, z, r) => [x, z, 1, 0.35, 0.2]),
        reeds: [[0, -36, { n: 40, r: 8, h: 4, crystal: true }]],
        extra(k, M) { k.add(M.coral, new THREE.CircleGeometry(16, 24).translate(-6, 12, -120), { solid: false, shadow: false }); },
      });
    },
  }),
  view({
    id: '3798-arch-domes', title: 'The moss domes under the great root arch', sheet: 'IMG_3798', panel: 4, where: 'right, middle, wide', crop: [351, 295, 648, 256],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 34, horizon: 0.6 },
    sun: BACKLIT, sky: SKY.coral,
    ground: swamp({ path: 2 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37985, trunks: { n: 50, z0: -80, z1: -300, r: 2.4, far: 100, x0: -120, x1: 120 },
        arches: [{ x0: -12, z0: -40, x1: 30, z1: -46, h: 20, r: 4.5 }],
        domes: [{ x: -26, z: -48, R: 7, yaw: 0.4 }, { x: 22, z: -70, R: 6, yaw: -0.2 }],
        extra(k, M) { k.add(M.pool, new THREE.SphereGeometry(1.4, 12, 8).scale(1, 1.6, 1).translate(30, k.H(30, -36) + 1.2, -36), { solid: false }); k.light(30, 1.5, -36, 6); },
      });
    },
  }),
  view({
    id: '3798-stream-trunks', title: 'Down the stream between the trunks', sheet: 'IMG_3798', panel: 5, where: 'bottom left, tall', crop: [25, 469, 310, 534],
    camera: { eye: [0, 1.5, 0], yaw: 0, fov: 64, horizon: 0.45 },
    sun: BACKLIT, sky: SKY.dusk,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37986, trunks: [[-9, -14, 1.8], [-4, -22, 1.3], [8, -20, 2], [-16, -40, 2.4], [16, -44, 2.6], [-30, -80, 3, true], [30, -90, 3, true], [0, -120, 4, true]],
        mushrooms: [{ x: 0, z: -70, H: 26, capR: 14, dome: 0.25 }],
        bushes: [[-3, -6, 2.2], [-4, -11, 2], [3, -8, 2], [-6, -18, 2.4], [6, -20, 2.4]],
        extra(k, M) { k.add(M.root, new THREE.SphereGeometry(1.2, 10, 6).scale(1.4, 0.6, 1).translate(-1, 0, -5)); },
      });
    },
  }),
  view({
    id: '3798-skiff-cave', title: 'The skiff at the root cave, the traveller in its mouth', sheet: 'IMG_3798', panel: 6, where: 'bottom right, wide', crop: [351, 566, 648, 436],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 50, horizon: 0.5 },
    sun: BACKLIT, sky: SKY.dusk,
    ground: swamp({ path: 0 }),
    people: [{ at: [9, -20], facing: 0, ...CLOAKED }],
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37987, trunks: { n: 30, z0: -40, z1: -200, r: 2.6, far: 80, x0: -60, x1: 0 },
        arches: [{ x0: -30, z0: -6, x1: 34, z1: -26, h: 26, r: 4 }],
        caves: [{ x: 11, z: -24, r: 3.4, glow: false }],
        skiffs: [{ x: 4, z: -18, yaw: 1.2, s: 1.2 }],
        extra(k, M) { for (const [x, z] of [[-14, -8], [-12, -10]]) k.add(M.pool, new THREE.SphereGeometry(1.2, 12, 8).scale(1, 1.7, 1).translate(x, 0.8, z), { solid: false }); k.light(-13, 1.4, -9, 6); },
      });
    },
  }),
  // ===================================================================== IMG_3799
  view({
    id: '3799-dome-reeds', title: 'The dome among the reeds, eggs in the water', sheet: 'IMG_3799', panel: 1, where: 'top left', crop: [21, 21, 316, 480],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.62 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37991, trunks: { n: 50, z0: -40, z1: -200, r: 2, far: 80 },
        mushrooms: [{ x: -6, z: -36, H: 26, capR: 12, dome: 0.15 }, { x: 10, z: -50, H: 18, capR: 5, dome: 0.3 }, { x: 18, z: -60, H: 14, capR: 3 }, { x: 4, z: -70, H: 10, capR: 2.6 }],
        domes: [{ x: -1, z: -16, R: 4, yaw: 0.5 }],
        eggs: [[-6, -8, 6, 0.4, 1.2], [5, -12, 3, 0.3, 0.6]],
        pools: [[4, -10, 1], [-2, -22, 1.2]],
        reeds: [[-10, -22, { n: 200, r: 8, h: 3.5 }], [12, -24, { n: 160, r: 8, h: 3.5 }]],
      });
    },
  }),
  view({
    id: '3799-dark-trunk', title: 'The dark trunk, the dome and the eggs', sheet: 'IMG_3799', panel: 2, where: 'top middle', crop: [353, 21, 316, 480],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.62 },
    sun: { side: 25, el: 8 }, sky: SKY.night,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37992, trunks: [[6, -14, 5], [-20, -60, 3], [24, -70, 3], [-40, -110, 4, true]],
        mushrooms: [{ x: -12, z: -40, H: 22, capR: 10, dome: 0.45 }, { x: 6, z: -46, H: 24, capR: 9, dome: 0.4 }],
        domes: [{ x: -4, z: -18, R: 3.6, yaw: 0.6 }],
        eggs: [[2, -8, 6, 0.45, 1], [-2, -10, 2, 0.3, 0.4]],
        pools: [[-5, -9, 1.4]],
        reeds: [[-10, -20, { n: 120, r: 8, h: 3 }]],
      });
    },
  }),
  view({
    id: '3799-crystals', title: 'Crystals under the mushroom', sheet: 'IMG_3799', panel: 3, where: 'top right', crop: [687, 21, 316, 480],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.62 },
    sun: BACKLIT, sky: SKY.coral,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37993, trunks: [[-8, -30, 2.4], [-20, -40, 3], [10, -60, 3], [-40, -100, 4, true]],
        mushrooms: [{ x: 4, z: -30, H: 22, capR: 10, dome: 0.35 }],
        domes: [{ x: -2, z: -22, R: 3.4, yaw: 0.2, lit: false }],
        reeds: [[6, -10, { n: 30, r: 4, h: 6, crystal: true }], [-6, -18, { n: 90, r: 7, h: 3 }]],
        pools: [[0, -14, 1.2]],
        bushes: [[2.5, -6, 2.2], [1.5, -4.5, 1.6]],
      });
    },
  }),
  view({
    id: '3799-path-arch', title: 'The traveller on the path under the arch', sheet: 'IMG_3799', panel: 4, where: 'bottom left', crop: [21, 521, 484, 482],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 54, horizon: 0.5 },
    sun: BACKLIT, sky: SKY.coral,
    ground: swamp({ path: 3, bend: 1 }),
    people: [{ at: [1.4, -8], facing: 0, ...CLOAKED }],
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37994, trunks: { n: 40, z0: -40, z1: -200, r: 2.6, far: 90 },
        arches: [{ x0: -20, z0: -10, x1: 24, z1: -36, h: 18, r: 4 }],
        pools: [[-3, -14, 1.6], [1, -24, 1.2], [-1, -34, 1]],
        bushes: [[-4, -5, 2.6], [4.5, -9, 2.4], [-6, -12, 2.4], [7, -16, 2.6], [-8, -20, 2.8]],
      });
    },
  }),
  view({
    id: '3799-skiff-hollow', title: 'The skiff in the hollow of the roots', sheet: 'IMG_3799', panel: 5, where: 'bottom right', crop: [523, 521, 482, 482],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 54, horizon: 0.55 },
    sun: BACKLIT, sky: SKY.coral,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 37995, trunks: [[20, -40, 3], [-30, -60, 4, true]],
        arches: [{ x0: -24, z0: -14, x1: 30, z1: -40, h: 22, r: 5, pale: true }],
        caves: [{ x: 2, z: -26, r: 6, glow: false }],
        skiffs: [{ x: 4, z: -18, yaw: 1.5, s: 1.2 }],
      });
    },
  }),
  // ===================================================================== IMG_3800
  view({
    id: '3800-night-mushrooms', title: 'Glass mushrooms in the night wood', sheet: 'IMG_3800', panel: 1, where: 'top left', crop: [18, 18, 487, 344],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.7 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 38001, trunks: [[-16, -20, 4], [4, -30, 3.4], [-40, -60, 4], [30, -70, 4]],
        mushrooms: [{ x: 14, z: -24, H: 14, capR: 5, dome: 0.7 }, { x: -6, z: -26, H: 10, capR: 3.6, dome: 0.7 }, { x: -2, z: -40, H: 6, capR: 2, dome: 0.7 }],
        pools: strew(12, 38001, -16, 16, -30, -6, (x, z, r) => [x, z, 0.6 + r() * 0.6]),
      });
    },
  }),
  view({
    id: '3800-crystal-eggs', title: 'Crystal spires and the egg heap', sheet: 'IMG_3800', panel: 2, where: 'top right', crop: [521, 17, 486, 345],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.6 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 38002, trunks: [[-24, -40, 3], [20, -60, 4], [0, -80, 5]],
        reeds: [[-6, -24, { n: 20, r: 6, h: 14, crystal: true }], [10, -30, { n: 16, r: 6, h: 12, crystal: true }]],
        eggs: [[8, -14, 16, 0.9, 2.6]],
        bushes: [[-12, -6, 4], [16, -20, 4]],
      });
    },
  }),
  view({
    id: '3800-dome-row', title: 'Domes in the dark between the trunks', sheet: 'IMG_3800', panel: 3, where: 'middle left, a strip', crop: [18, 379, 486, 127],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 22, horizon: 0.6 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 38003, trunks: strew(14, 38003, -30, 30, -70, -30, (x, z, r) => [x, z, 0.8 + r() * 0.8]),
        domes: [{ x: -6, z: -60, R: 5, lit: false }, { x: 8, z: -64, R: 5 }],
        pools: [[0, -40, 1.6], [-10, -50, 1.4], [10, -46, 1.2]],
      });
    },
  }),
  view({
    id: '3800-dome-pools', title: 'The path of coral pools by the great dome', sheet: 'IMG_3800', panel: 4, where: 'middle right', crop: [521, 378, 486, 263],
    camera: { eye: [0, 2.4, 0], yaw: 0, fov: 50, horizon: 0.42 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 2, drift: 0.1 }),
    people: [{ at: [3, -26], facing: 0, ...CLOAKED }],
    build(kit, v) {
      woodScene(kit, v, {
        seed: 38004, trunks: [[16, -40, 3], [24, -30, 3.6]],
        domes: [{ x: -6, z: -30, R: 9, yaw: 0.6 }],
        arches: [{ x0: -30, z0: -16, x1: 30, z1: -40, h: 20, r: 4 }],
        pools: [[-1, -8, 3], [2, -16, 2], [3, -22, 1.4], [5, -30, 1]],
        bushes: [[-6, -6, 3.4], [-8, -11, 3], [9, -10, 3], [11, -18, 3.4]],
      });
    },
  }),
  view({
    id: '3800-root-tunnel', title: 'The root tunnel to the coral glow', sheet: 'IMG_3800', panel: 5, where: 'bottom left, tall', crop: [17, 523, 488, 469],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.55 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 2 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 38005, trunks: [],
        arches: [{ x0: -14, z0: -4, x1: 14, z1: -8, h: 18, r: 3 }, { x0: -12, z0: -14, x1: 12, z1: -18, h: 14, r: 2.6 }, { x0: -10, z0: -24, x1: 10, z1: -28, h: 11, r: 2.2 }],
        caves: [{ x: 0, z: -34, r: 5 }],
        pools: [[0, -6, 2.2]],
      });
    },
  }),
  view({
    id: '3800-skiff-cave', title: 'Two on the skiff at the coral cave', sheet: 'IMG_3800', panel: 6, where: 'bottom right', crop: [521, 658, 486, 334],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 50, horizon: 0.42 },
    sun: BACKLIT, sky: SKY.night,
    ground: swamp({ path: 0 }),
    build(kit, v) {
      woodScene(kit, v, {
        seed: 38006, trunks: [[-24, -40, 3], [-34, -60, 4]],
        caves: [{ x: 7, z: -26, r: 7, arches: 8 }],
        skiffs: [{ x: -4, z: -18, yaw: 1.4, s: 1.4, riders: 2 }],
        reeds: [[6, -10, { n: 20, r: 4, h: 1.5 }]],
      });
    },
  }),
];
