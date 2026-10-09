import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, createNoise2D } from '../noise.js';
import { MODE_STRATA } from '../materials.js';
import { lumpy } from './sky-stones-kit.js';
import { leafCrown } from './garden-kit.js';
import { curtain, houseStack, herbs, figure, stick, rope } from './salt-harbour-kit.js';

// ---------------------------------------------------------------------------
// The Underside's shapes, shared by the world (underside.js) and its reference views (reference-underside.js),
// after the pictures (references/levels/The Underside/environment/reference-1 … 4): an immense shelf of pale limestone jutting from a
// mountain far out over a sea of cloud, and a town hung from its underside: round white houses like swallows'
// nests stuck to the rock and hanging from it, timber decks, balconies and scaffolds slung under it on rods, lit
// windows, long rust-red banners falling from the decks toward the clouds, baskets let down on ropes. Grass and
// shrubs fringe the shelf's top; a stair is cut into the mountain's face beside it.
//   slab        a rounded block of limestone, its sides cut in ledges and cracked, its underside in lobes: the
//               shelf, the mountain's buttresses, the stair's cliff
//   pod         a house of white plaster round as a swallow's nest: a dome, an egg, or a drop hung from the rock
//   deck        a timber platform: planks, beams, a rail, rods up to the rock or struts back to a wall
//   banner      a long rust-red cloth falling from a bar, in folds
//   basket      a wicker basket on its rope; lamp, a lantern hung on a cord
//   stoneStair  a broad stair cut into a cliff, its parapet on the open side
//   shrubs      bushes and grass along an edge; cloudPuffs the sea of cloud's cauliflowers
//   traveller   the traveller from behind, his great pale pack
// Each returns plain geometries in the caller's frame, grouped by role, or adds to a RoomKit with the materials of
// underMats(kit). `detail` (1 the views, under 1 the world) thins the segments.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const push = (out, k, g) => { (out[k] ??= []).push(g); return g; };
const nA = createNoise2D(81301), nB = createNoise2D(81302), nC = createNoise2D(81303);
export { stick, rope, herbs, figure };

// ------------------------------------------------------------------ the look
/** The lamps' light on the walls and the decks: a warm amber in the shade under the shelf (makeMaterial lampTint). */
export const LAMP_TINT = ['#ffb070', 0.5];
/** The surfaces' tones, read off the pictures. */
export const UNDER_TONES = {
  rock: '#f1e2c6', rock2: '#ead8b8', rock3: '#e2cfae', rockShade: '#d8c8b0', rockUnder: '#c2ae92',
  plaster: '#f5ecdc', plaster2: '#efe2cc', plaster3: '#e8dccb',
  wood: '#74523a', wood2: '#8a6244', woodDark: '#46301f', plank: '#9a7552',
  banner: '#b8573a', banner2: '#a84a30', banner3: '#c46a44',
  dark: '#2e2a3a', glow: '#ffb466', lamp: '#ffd690', rope: '#3a302c', iron: '#3e3640',
  wicker: '#a8784a', grass: '#7a8a4e', meadow: '#b4ae78', meadow2: '#a6a36e', shrub: '#5a6e48', shrub2: '#6e7c50', pot: '#a65a3e', leaves: '#5f7e4e',
  cloud: '#fff6ec', cloudPink: '#fde4d4',
  cloak: ['#9a4a34', '#7a5a48', '#5e5068', '#a06a4a', '#6a4e40', '#b07a5a'], skin: '#d8a888',
  traveller: '#8a3c2a', travellerHood: '#6a2e24', pack: '#f2f0ea', packRim: '#c8c6c4',
};
/** The cloud's print: a warm white, its shade a pale grey-blue (lifted), no strokes (arzach2.js CLOUD_PRINT). */
export const CLOUD_PRINT = { shade: 0.12, shadeFlat: 0.6, hatch: 0, spot: 0 };
/** The day's colours (sky top, horizon, shadow, light, sun): a clear blue over the cloud, a low golden sun, the shade a cool blue-grey. */
export const UNDER_DAY = ['#4f86cc', '#d8e0e4', '#6e7184', '#fff0dc', '#ffe6bc'];
export const UNDER_DUSK = ['#7e8cc0', '#f6c4a6', '#7a70a6', '#ffd6b8', '#ffb888'];
export const UNDER_NIGHT = ['#0c1430', '#24345e', '#2e3a6a', '#aab4e0', '#f0e8e0'];
/** The haze: stepped pale bands over the cloud sea, warm, so the far shelf and the far cloud go pale. */
export const UNDER_HAZE = { uHazeLayers: [140, 1.8, 0.13, 4], uHazeTone: [0.93, 0.92, 0.94, 0.7] };
/**
 * The Underside's touches on the print preset: no drawn clouds in the sky (the cloud is below), the shade printed
 * nearly flat in one cool blue-grey (the pictures' undersides one tone, the lamps warm in it), light hatching, few
 * spot blacks but deep ones in the scaffolds' gaps, cast shadows kept (the shelf's great shadow on its own town).
 */
export const UNDER_LOOK = {
  uClouds: 0, uCumulus: 0, uSkyDots: 0.25, uShadowFlat: 0.72, uShadeKeep: 0.2, uHalftone: 0.18, uBounce: 0.08, uHatch: 0.3,
  uFogDensity: 0.00055, uSpot: [0.9, 3, 0.28, 0.3], uSpotTone: [0.16, 0.12, 0.12, 0.45], uCast: [0.25, 0.15], ...UNDER_HAZE,
};

/** The Underside's materials, made by the kit (shared per option set). */
export function underMats(kit, { lamps = true } = {}) {
  const T = UNDER_TONES, DS = THREE.DoubleSide, LT = lamps ? { lampTint: LAMP_TINT } : {};
  return {
    // the limestone: cracks run down it, its shade a little of its own warmth
    // (strata rock as Vael II's: bands along its beds, a few cracks running down; no built pen detail, it is not a wall)
    rock: kit.mat({ color: T.rock, color2: T.rock2, color3: T.rock3, mode: MODE_STRATA, strataSize: 6, flat: true, hatch: 0.35, cracks: 0.3, strataHatch: 0.12, ...LT }),
    rockDeep: kit.mat({ color: T.rockShade, color2: T.rock3, color3: T.rockShade, mode: MODE_STRATA, strataSize: 6, flat: true, hatch: 0.35, cracks: 0.3, ...LT }),
    // the shelf's underside: a warmer, deeper stone, hatched (it is only ever in shade, lit by the lamps and the cloud's glow)
    rockUnder: kit.mat({ color: T.rockUnder, color2: T.rockShade, color3: T.rockUnder, mode: MODE_STRATA, strataSize: 5, flat: true, hatch: 0.6, cracks: 0.4, shade: 0, ...LT }),
    plaster: [T.plaster, T.plaster2, T.plaster3].map((c) => kit.mat({ color: c, flat: true, patches: 0.35, hatch: 0.6, ...LT })),
    step: kit.mat({ color: T.rock2, flat: true, hatch: 0.4, ...LT }),
    wood: kit.mat({ color: T.wood, flat: true, pattern: 'cracks', ...LT }),
    wood2: kit.mat({ color: T.wood2, flat: true, ...LT }),
    woodDark: kit.mat({ color: T.woodDark, flat: true, ...LT }),
    plank: kit.mat({ color: T.plank, flat: true, line: 0.6, lineTint: 0.5, ...LT }),
    // the struts and rods: thin bars kept a pixel and a half wide (src/thin.js)
    rod: kit.mat({ color: T.woodDark, flat: true, thin: 1.4 }),
    rope: kit.mat({ color: T.rope, flat: true, thin: 1.2, line: 0.5, lineTint: 0.6 }),
    dark: kit.mat({ color: T.dark, flat: true }),
    glow: kit.mat({ color: T.glow, glow: 0.9, flat: true, spot: 0 }),
    lamp: kit.mat({ color: T.lamp, glow: 1, flat: true, spot: 0, line: 0.5, lineTint: 0.6 }),
    iron: kit.mat({ color: T.iron, flat: true }),
    // the banners: soft long masses, a light line of their own
    banner: [T.banner, T.banner2, T.banner3].map((c) => kit.mat({ color: c, side: DS, shade: 0.25, hatch: 0.3, line: 0.7, lineTint: 0.6, ...LT })),
    wicker: kit.mat({ color: T.wicker, flat: true, pattern: 'cracks', ...LT }),
    pot: kit.mat({ color: T.pot, flat: true, ...LT }),
    leaves: kit.mat({ color: T.leaves, pattern: 'leaves', hatch: 0.6, shade: 0.4, line: 0.7, lineTint: 0.7 }),
    shrub: [T.shrub, T.shrub2].map((c) => kit.mat({ color: c, pattern: 'leaves', hatch: 0.5, shade: 0.35, line: 0.6, lineTint: 0.7 })),
    grass: kit.mat({ color: T.grass, flat: true, line: 0.5, lineTint: 0.7 }),
    cloud: kit.mat({ color: T.cloud, ...CLOUD_PRINT, line: 0.35, lineTint: 1 }),
    cloudPink: kit.mat({ color: T.cloudPink, ...CLOUD_PRINT, line: 0.35, lineTint: 1 }),
    cloaks: T.cloak.map((c) => kit.mat({ color: c, flat: true, figure: true, ...LT })),
    skin: kit.mat({ color: T.skin, flat: true, figure: true, ...LT }),
    traveller: kit.mat({ color: T.traveller, flat: true, figure: true }),
    hood: kit.mat({ color: T.travellerHood, flat: true, figure: true }),
    pack: kit.mat({ color: T.pack, flat: true, shade: 0.3, figure: true }),
    packRim: kit.mat({ color: T.packRim, flat: true, figure: true }),
  };
}

// ------------------------------------------------------------------ rock
const spread = (s) => Math.sign(s) * (0.45 * Math.abs(s) + 0.55 * Math.sin((Math.abs(s) * Math.PI) / 2));   // (more vertices near the edges)
/**
 * A rounded block of limestone, sx × sy × sz, centred on x and z, from y = 0 to sy: the shelf over the cloud, a
 * buttress, a cliff. Its edges rounded (rTop over the top, rBot round the bottom: the pictures' bulging lips, rSide
 * the plan's corners), its sides cut into ledges (bands `band` m high, each jutting `ledge` m at its top, its own
 * depth), cracked down (`cracks` grooves on each side, `crack` m deep), lumpy (`lump` m), its underside hanging in
 * lobes ([x, z, r, h]…: rounded masses hanging under it), its plan pinched toward its +x end (`tip` 0..1: the free
 * end of a shelf, rounded like a nose over `tipLen` m), its sides bulging in pillows (`pillow` m: rounded masses
 * with creased valleys between). The top stays flat where `flatTop` (walked on).
 * One indexed geometry, smooth (its creases are the ledges').
 */
export function slab({ sx, sy, sz, rTop = 3, rBot = 8, rSide = 6, band = 7, ledge = 1.2, cracks = 6, crack = 0.8, lump = 1.2, lobes = [], tip = 0, tipLen = 40, seed = 1, seg = 4, flatTop = true, wobble = 2, pillow = 0, pinch = 0 }) {
  const rng = mulberry32(Math.floor(seed * 4021) + 7);
  const nx = Math.max(4, Math.ceil(sx / seg)), ny = Math.max(3, Math.ceil(sy / seg)), nz = Math.max(4, Math.ceil(sz / seg));
  let g = new THREE.BoxGeometry(1, 1, 1, nx, ny, nz);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-6);
  const p = g.attributes.position;
  // the cracks' places along each side (x for the ±z sides, z for the ±x sides), each its own depth and width
  const cut = (n, L) => Array.from({ length: n }, () => ({ u: (rng() - 0.5) * L * 0.92, w: 0.4 + rng() * 1.1, d: crack * (0.5 + rng()), y0: rng() * 0.4 }));
  const cutsZ = [cut(cracks, sx), cut(cracks, sx)], cutsX = [cut(Math.ceil(cracks * sz / sx), sz), cut(Math.ceil(cracks * sz / sx), sz)];
  const bands = Array.from({ length: Math.ceil(sy / band) + 2 }, () => 0.5 + rng() * 0.9);
  const R = V(rSide, 0, rSide), q = V(), d = V(), e = V(), n = V();
  for (let i = 0; i < p.count; i++) {
    let x = spread(p.getX(i) * 2) * sx / 2, y = (spread(p.getY(i) * 2) + 1) / 2 * sy, z = spread(p.getZ(i) * 2) * sz / 2;
    // the plan pinched toward the free end (on both sides, or only on the side `pinch` names: the face stays straight)
    const k = tip > 0 ? 1 - tip * Math.pow(sstep(sx / 2 - tipLen, sx / 2 + tipLen * 0.2, x), 1.6) : 1;
    const kz = (sgn) => (!pinch || sgn === pinch ? k : 1);
    z *= kz(Math.sign(z));
    const hzN = (sz / 2) * kz(-1), hzP = (sz / 2) * kz(1);
    const rs = Math.min(rSide, Math.min(hzN, hzP) - 0.1, sx / 2 - 0.1);
    q.set(THREE.MathUtils.clamp(x, -sx / 2 + rs, sx / 2 - rs), THREE.MathUtils.clamp(y, rBot, sy - rTop), THREE.MathUtils.clamp(z, -hzN + rs, hzP - rs));
    d.set(x - q.x, y - q.y, z - q.z);
    R.set(rs, d.y > 0 ? rTop : rBot, rs);
    e.set(d.x / R.x, d.y / R.y, d.z / R.z);
    const len = e.length();
    if (len > 1e-6) { x = q.x + d.x / len; y = q.y + d.y / len; z = q.z + d.z / len; n.set(e.x / R.x, e.y / R.y, e.z / R.z).normalize(); }
    else n.set(0, 1, 0);
    const side = 1 - Math.min(1, Math.abs(n.y) * 1.4);   // 1 on an upright face, 0 on the top and the underside
    let out = 0;
    if (side > 0) {
      // ledges: each band juts out at its top, its own depth; the plan wobbles
      const k = Math.floor(y / band), f = y / band - k;
      out += side * ledge * bands[k + 1] * (sstep(0.5, 0.92, f) - 0.5) * (y > sy - rTop ? 0.3 : 1);
      out += side * wobble * nA(x * 0.025 + seed, z * 0.025);
      if (pillow) { const q = nC((x + z) * 0.028 + seed * 0.37, y * 0.045); out += side * pillow * (Math.sqrt(Math.abs(q)) * 1.6 - 0.8); }
      // cracks down the sides
      const along = Math.abs(n.z) > Math.abs(n.x) ? x : z, list = Math.abs(n.z) > Math.abs(n.x) ? cutsZ[n.z > 0 ? 0 : 1] : cutsX[n.x > 0 ? 0 : 1];
      for (const c of list) {
        const t = (along - c.u) / c.w;
        if (Math.abs(t) < 3 && y / sy > c.y0) out -= side * c.d * Math.exp(-t * t) * (0.6 + 0.4 * nB(y * 0.08, c.u));
      }
    }
    // lumps all over (but the top, walked on)
    const top = n.y > 0.8 && flatTop;
    if (!top) out += lump * (nA(x * 0.06 - z * 0.04, y * 0.07 + seed) * 0.7 + nB(z * 0.13 + seed, y * 0.11 - x * 0.05) * 0.3);
    x += n.x * out; y += n.y * out; z += n.z * out;
    // the underside's lobes: rounded masses hanging under it
    if (n.y < -0.25) {
      let h = 0;
      for (const [lx, lz, lr, lh] of lobes) { const r2 = ((x - lx) ** 2 + (z - lz) ** 2) / (lr * lr); if (r2 < 4) h += lh * Math.max(0, 1 - r2) ** 1.5 * (r2 < 1 ? 1 : 0) + lh * 0.25 * Math.exp(-r2 * 2); }
      y -= h * Math.min(1, -n.y * 1.6) + 0.8 * nC(x * 0.05, z * 0.05) * -n.y;
    }
    if (top) y = sy + 0.12 * nC(x * 0.04, z * 0.04);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** A geometry's triangles split in two by a test on each one's normal: [those that pass, the rest] (non-indexed). */
export function splitFaces(g, test) {
  const src = g.index ? g.toNonIndexed() : g, p = src.attributes.position, nrm = src.attributes.normal, a = [], b = [], an = [], bn = [];
  const e1 = V(), e2 = V(), fn = V(), A = V(), B = V(), C = V();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    fn.crossVectors(e1.subVectors(B, A), e2.subVectors(C, A)).normalize();
    const [P, N] = test(fn, A) ? [a, an] : [b, bn];
    for (let k = 0; k < 3; k++) { P.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); if (nrm) N.push(nrm.getX(i + k), nrm.getY(i + k), nrm.getZ(i + k)); }
  }
  const make = (P, N) => { const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); if (nrm) o.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); else o.computeVertexNormals(); return o; };
  return [make(a, an), make(b, bn)];
}

/** Lobes for a slab's underside: n rounded masses hanging under it, inside its plan (x ±sx/2·k, z ±sz/2·k), r and h their size. */
export function lobesFor({ sx, sz, n = 12, r = [8, 18], h = [3, 9], k = 0.8, seed = 1 }) {
  const rng = mulberry32(Math.floor(seed * 613) + 1);
  return Array.from({ length: n }, () => [(rng() - 0.5) * sx * k, (rng() - 0.5) * sz * k, r[0] + rng() * (r[1] - r[0]), h[0] + rng() * (h[1] - h[0])]);
}

/** A lumpy boulder of the same rock, r across, flattened by sy (position + normal). */
export function boulder(seed, r, sy = 0.7, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail >= 1 ? 2 : 1);
  lumpy(g, 0.22, 1.7, seed);
  g.scale(r, r * sy, r);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ the houses
const PROFILES = {
  // [r share of its widest, y share of its height], foot to crown
  dome: [[0.001, 0], [0.9, 0.001], [1, 0.22], [0.99, 0.46], [0.88, 0.68], [0.64, 0.86], [0.34, 0.97], [0.001, 1]],
  egg: [[0.001, 0], [0.72, 0.001], [0.95, 0.14], [1, 0.36], [0.93, 0.58], [0.74, 0.78], [0.44, 0.93], [0.001, 1]],
  // hung from the rock: its crown buried in the underside (over y = h), its body swelling to a rounded foot on a deck
  drop: [[0.001, 0], [0.5, 0.01], [0.82, 0.08], [1, 0.26], [0.97, 0.46], [0.8, 0.66], [0.62, 0.84], [0.56, 0.98], [0.66, 1.12], [0.001, 1.13]],
  // a nest under the rock with no foot: a hanging bulb, rounded under (it hangs free over the void)
  bulb: [[0.001, 0], [0.42, 0.03], [0.76, 0.14], [0.96, 0.36], [1, 0.6], [0.92, 0.84], [0.88, 1.12], [0.001, 1.13]],
};
const profR = (prof, t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][1] || i === prof.length - 1) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * Math.min(1, Math.max(0, (t - y0) / Math.max(1e-6, y1 - y0))); } return 0; };

/**
 * A house of white plaster round as a swallow's nest, its foot at y = 0, its crown at h, r its widest; the door
 * toward +z. kind 'dome' (a round body under a dome, a cupola or a chimney on top: on the shelf's top and its
 * ledges), 'egg' (taller, an egg on its foot: along the face), 'drop' (hung from the rock: its crown buried in the
 * underside over y = h, its body swelling down to a foot on a deck), 'bulb' (a nest hanging free under the rock).
 * windows: small openings (dark, some lit) with deep frames; door: an arched door at the foot (lit or dark).
 * { plaster: [geo], dark: [geo], glow: [geo], wood: [geo], lamps: [[x, y, z]] }.
 */
export function pod({ r = 5, h = 9, kind = 'dome', seed = 1, windows = 4, lit = 0.35, door = true, doorLit = 0.5, cupola = kind === 'dome' || kind === 'egg', detail = 1, squash = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 911) + 9), out = { plaster: [], dark: [], glow: [], wood: [], lamps: [] };
  const prof = PROFILES[kind] ?? PROFILES.dome, seg = Math.max(10, Math.round(22 * detail));
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a * r, b * h)), seg);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4), pp = m.attributes.position, ph = rng() * 10;
  // (not a perfect lathe: the plaster bulges and sags, the body squashed along z)
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * nA(Math.cos(a) * 1.3 + ph, y / h * 2.2) + 0.03 * nB(Math.sin(a) * 2.7, y / h * 4 + ph);
    pp.setXYZ(i, x * k, y, z * k * squash);
  }
  m.computeVertexNormals();
  out.plaster.push(m);
  const surf = (a, t, off = 0.06) => { const rr = profR(prof, t) * r, nn = V(Math.cos(a), 0, Math.sin(a) * squash); return { p: V(Math.cos(a) * rr, t * h, Math.sin(a) * rr * squash).addScaledVector(nn.normalize(), off), n: nn }; };
  // windows: deep-framed openings, some lit, standing a hair off the plaster
  const tw = kind === 'drop' || kind === 'bulb' ? [0.3, 0.75] : [0.25, 0.6];
  for (let i = 0; i < windows; i++) {
    const a = Math.PI / 2 + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 2.2), t = tw[0] + rng() * (tw[1] - tw[0]), { p, n } = surf(a, t);
    const ww = Math.min(r * 0.22, 0.6 + rng() * 0.6), wh = ww * (1.1 + rng() * 0.6), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n);
    const pane = rng() < 0.45 ? new THREE.CircleGeometry(ww * 0.55, 10).scale(1, wh / ww, 1) : new THREE.PlaneGeometry(ww, wh);
    push(out, rng() < lit ? 'glow' : 'dark', pane.applyQuaternion(q).translate(p.x, p.y, p.z));
    // its sill and lintel: little timber bars
    if (rng() < 0.6) for (const s of [-1, 1]) out.wood.push(new THREE.BoxGeometry(ww * 1.3, 0.12, 0.25).applyQuaternion(q).translate(p.x + n.x * 0.08, p.y + s * wh * 0.55, p.z + n.z * 0.08));
  }
  // the door: an arch at the foot toward +z, its timber frame
  if (door) {
    const dw = Math.min(1.5, r * 0.32), dh = Math.min(2.5, h * 0.4), t0 = kind === 'drop' ? 0.02 : 0.01, { p } = surf(Math.PI / 2, t0 + 0.12);
    const s = new THREE.Shape(), rr = dw / 2;
    s.moveTo(-rr, 0); s.lineTo(-rr, dh - rr); s.absarc(0, dh - rr, rr, Math.PI, 0, true); s.lineTo(rr, 0); s.lineTo(-rr, 0);
    const z = Math.max(p.z, profR(prof, 0.05) * r * squash) + 0.08;
    push(out, rng() < doorLit ? 'glow' : 'dark', new THREE.ShapeGeometry(s, 6).translate(0, 0.02, z));
    for (const e of [-1, 1]) out.wood.push(new THREE.BoxGeometry(0.18, dh - rr, 0.3).translate(e * (rr + 0.06), (dh - rr) / 2, z));
    out.wood.push(new THREE.TorusGeometry(rr + 0.06, 0.1, 3, 8, Math.PI).translate(0, dh - rr, z));
    out.lamps.push([rr + 0.6, dh + 0.2, z + 0.4]);
  }
  // a cupola or a chimney on its crown
  if (cupola && rng() < 0.85) {
    const cr = r * (0.12 + rng() * 0.06), ch = h * (0.08 + rng() * 0.08), ox = (rng() - 0.5) * r * 0.25;
    out.plaster.push(new THREE.CylinderGeometry(cr, cr * 1.1, ch, 8).translate(ox, h * 0.97 + ch / 2, 0));
    out.plaster.push(new THREE.SphereGeometry(cr * 1.05, 8, 4, 0, TAU, 0, Math.PI / 2).translate(ox, h * 0.97 + ch, 0));
    out.dark.push(new THREE.PlaneGeometry(cr * 0.7, ch * 0.5).translate(ox, h * 0.97 + ch * 0.5, cr * 1.02));
  }
  return out;
}

// ------------------------------------------------------------------ timber
/**
 * A timber platform from x0 to x1, z0 to z1, its planks' top at y: planks across its long side, two beams under,
 * a rail along the sides named in `rail` ('n' -z, 's' +z, 'w' -x, 'e' +x) but where `gaps` open them ([side, from,
 * to]…: m along that side), rods up to the rock at `up` (the underside's height: y of each rod's top, a number or
 * (x, z) => y) every `every` m round its edge, or struts back to a wall at `wall` ('n' | 's' | 'w' | 'e').
 * { planks: [geo], wood: [geo], rods: [geo] }.
 */
export function deck({ x0, x1, z0, z1, y, rail = 'nswe', gaps = [], up = null, every = 6, wall = null, seed = 1, plank: plankW, thick = 0.16 }) {
  const plank = plankW ?? 0.6;
  const rng = mulberry32(Math.floor(seed * 3313) + 5), out = { planks: [], wood: [], rods: [] };
  const w = x1 - x0, d = z1 - z0, alongX = w >= d, L = alongX ? w : d, B = alongX ? d : w;
  const n = Math.max(1, Math.round(L / plank));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, len = B, dy = 0;
    const g = alongX ? new THREE.BoxGeometry((L / n) * 1.02, thick, len).translate(x0 + u * w, y - thick / 2 + dy, (z0 + z1) / 2 + (rng() - 0.5) * 0.1)
      : new THREE.BoxGeometry(len, thick, (L / n) * 1.02).translate((x0 + x1) / 2 + (rng() - 0.5) * 0.1, y - thick / 2 + dy, z0 + u * d);
    out.planks.push(g);
  }
  // the beams under it, along its long side
  for (const e of [0.18, 0.82]) out.wood.push(alongX ? new THREE.BoxGeometry(w, 0.3, 0.26).translate((x0 + x1) / 2, y - thick - 0.15, z0 + d * e) : new THREE.BoxGeometry(0.26, 0.3, d).translate(x0 + w * e, y - thick - 0.15, (z0 + z1) / 2));
  // cross beams
  for (let u = 0; u <= L + 1e-6; u += Math.min(L, 3.2)) out.wood.push(alongX ? new THREE.BoxGeometry(0.22, 0.26, d).translate(x0 + u, y - thick - 0.42, (z0 + z1) / 2) : new THREE.BoxGeometry(w, 0.26, 0.22).translate((x0 + x1) / 2, y - thick - 0.42, z0 + u));
  // the rails
  const sides = { n: [[x0, z0], [x1, z0]], s: [[x0, z1], [x1, z1]], w: [[x0, z0], [x0, z1]], e: [[x1, z0], [x1, z1]] };
  for (const k of rail) {
    const [[ax, az], [bx, bz]] = sides[k], len = Math.hypot(bx - ax, bz - az), cuts = gaps.filter((g) => g[0] === k).map((g) => [g[1], g[2]]).sort((a, b) => a[0] - b[0]);
    const runs = []; let at = 0;
    for (const [a, b] of cuts) { if (a > at) runs.push([at, a]); at = Math.max(at, b); }
    if (at < len) runs.push([at, len]);
    for (const [a, b] of runs) {
      if (b - a < 0.3) continue;
      const A = V(ax + (bx - ax) * a / len, y, az + (bz - az) * a / len), Bp = V(ax + (bx - ax) * b / len, y, az + (bz - az) * b / len), m = Math.max(1, Math.round((b - a) / 1.5));
      for (let i = 0; i <= m; i++) { const P = A.clone().lerp(Bp, i / m); out.wood.push(new THREE.BoxGeometry(0.1, 1.05, 0.1).translate(P.x, y + 0.52, P.z)); }
      out.wood.push(stick(A.clone().setY(y + 1.05), Bp.clone().setY(y + 1.05), 0.06));
      out.wood.push(stick(A.clone().setY(y + 0.55), Bp.clone().setY(y + 0.55), 0.035));
    }
  }
  // rods up to the rock round its edge
  if (up !== null) {
    const top = typeof up === 'function' ? up : () => up, per = [];
    // (along its outer edge every `every` m, its inner one every other, a few across it: hung, not a forest of sticks)
    for (const [k, step] of [['s', every], ['n', every * 2]]) { const [[ax, az], [bx, bz]] = sides[k], len = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(len / step)); for (let i = 0; i <= m; i++) per.push([ax + (bx - ax) * i / m, az + (bz - az) * i / m]); }
    for (let zz = z0 + every * 1.5; zz < z1 - every; zz += every * 1.5) for (let xx = x0 + every; xx < x1 - 1; xx += every * 2) per.push([xx, zz]);
    for (const [x, z] of per) { const t = top(x, z); if (t > y + 0.5) out.rods.push(stick(V(x, y - thick - 0.3, z), V(x, t + 0.5, z), 0.07)); }
  }
  // struts back to a wall
  if (wall) {
    const [[ax, az], [bx, bz]] = sides[wall], far = { n: [0, d], s: [0, -d], w: [w, 0], e: [-w, 0] }[wall], len = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= m; i++) {
      const x = ax + (bx - ax) * i / m, z = az + (bz - az) * i / m;
      out.wood.push(stick(V(x + far[0] * 0.85, y - thick - 0.2, z + far[1] * 0.85), V(x, y - Math.max(w, d) * 0.9 - 0.6, z), 0.1));
    }
  }
  return out;
}

/** A timber post from (x, y0, z) up to y1, r thick (square). */
export const post = (x, y0, z, y1, r = 0.12) => new THREE.BoxGeometry(r * 2, y1 - y0, r * 2).translate(x, (y0 + y1) / 2, z);

/** A ladder from A to B ([x, y, z]), w wide: two rails and rungs. */
export function ladder(A, B, { w = 0.6, step = 0.32 } = {}) {
  const a = V(...A), b = V(...B), dir = b.clone().sub(a), L = dir.length(), side = V(-dir.z, 0, dir.x).normalize().multiplyScalar(w / 2), out = [];
  if (side.lengthSq() < 1e-9) side.set(w / 2, 0, 0);
  for (const e of [-1, 1]) out.push(stick(a.clone().addScaledVector(side, e), b.clone().addScaledVector(side, e), 0.05));
  for (let s = step; s < L; s += step) { const p = a.clone().lerp(b, s / L); out.push(stick(p.clone().addScaledVector(side, -1), p.clone().addScaledVector(side, 1), 0.03)); }
  return out;
}

/**
 * A long rust-red cloth from a bar A→B ([x, y, z]), falling `drop` m in folds, its hem a little scalloped, drawn
 * aside by `pull` [dx, dz] at its foot (the wind under the shelf). { cloth: geo, bar: geo }.
 */
export function banner(A, B, drop, { folds = 2, fold = 0.35, pull = [0, 0], seed = 1, nu = 14, nv = 14 } = {}) {
  const w = Math.hypot(B[0] - A[0], B[2] - A[2]);
  const cloth = curtain(A, B, drop, { sag: Math.min(0.15, w * 0.02), folds: Math.max(1, folds), fold, pull, nu, nv, hem: 0.12, seed });
  const a = V(...A), b = V(...B), dir = b.clone().sub(a).normalize();
  return { cloth, bar: stick(a.clone().addScaledVector(dir, -0.3).add(V(0, 0.05, 0)), b.clone().addScaledVector(dir, 0.3).add(V(0, 0.05, 0)), 0.08) };
}

/** A wicker basket, its rim at y, r across: a bowl, its rim, the cords up to a ring over it. { wicker: [geo], rope: [geo] }. */
export function basket(x, y, z, { r = 0.7, h = 0.8, cords = 4, ring = 1.4 } = {}) {
  const out = { wicker: [], rope: [] };
  out.wicker.push(new THREE.LatheGeometry([[0.001, -h], [r * 0.7, -h], [r * 0.92, -h * 0.7], [r, -h * 0.25], [r * 1.02, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 10).translate(x, y, z));
  out.wicker.push(new THREE.TorusGeometry(r * 1.02, 0.06, 3, 10).rotateX(Math.PI / 2).translate(x, y, z));
  for (let i = 0; i < cords; i++) { const a = (i / cords) * TAU + 0.4; out.rope.push(stick(V(x + Math.cos(a) * r, y, z + Math.sin(a) * r), V(x, y + ring, z), 0.025, 3)); }
  return out;
}

/** A lantern hung on a cord from (x, top, z) down to y: a dark cap, its glowing glass. { iron: [geo], glow: [geo], rope: [geo], at: [x, y, z] }. */
export function lamp(x, y, z, top = y + 1, { s = 1 } = {}) {
  return {
    iron: [new THREE.ConeGeometry(0.22 * s, 0.18 * s, 6).translate(x, y + 0.26 * s, z), new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.05 * s, 6).translate(x, y - 0.2 * s, z)],
    glow: [new THREE.CylinderGeometry(0.15 * s, 0.12 * s, 0.36 * s, 6).translate(x, y, z)],
    rope: top > y + 0.3 ? [stick(V(x, y + 0.34 * s, z), V(x, top, z), 0.015, 3)] : [],
    at: [x, y, z],
  };
}

/**
 * A broad stair cut into a cliff, climbing from (x, y0, z) toward -z (before yaw) to y1, w wide: its steps, the rock
 * under them down to `base`, a parapet along its open side (`wall`: +1 the +x side, -1 the -x side, 0 none).
 * { step: [geo], rock: [geo], wall: [geo], top: [x, y, z] (in its own frame, before yaw) }.
 */
export function stoneStair({ y0, y1, w = 3.2, rise = 0.2, run = 0.42, wall = 1, base = y0 - 2, parapet = 0.95, seed = 1 }) {
  const rng = mulberry32(Math.floor(seed * 577) + 3), n = Math.max(1, Math.round((y1 - y0) / rise)), dr = (y1 - y0) / n, out = { step: [], rock: [], wall: [] };
  for (let i = 0; i < n; i++) {
    const zc = -(i + 0.5) * run, top = y0 + (i + 1) * dr, wob = (rng() - 0.5) * 0.04;
    // (each step a block down to the one under it: no gap a foot or a ray could find)
    out.step.push(new THREE.BoxGeometry(w, dr + 0.3, run + 0.02).translate(0, top - (dr + 0.3) / 2 + wob, zc));
  }
  const L = n * run, H = y1 - y0;
  // the rock under the flight: a wedge down to base
  const sh = new THREE.Shape();
  sh.moveTo(0, y0 - 0.25); sh.lineTo(-L, y1 - 0.25); sh.lineTo(-L, base); sh.lineTo(0, base); sh.lineTo(0, y0 - 0.25);
  out.rock.push(new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(w / 2, 0, 0));   // (shape x along -z: under the flight)
  if (wall) {
    // the parapet: a sloped block along the open side, its top a hand over the steps
    const g = new THREE.BoxGeometry(0.5, parapet + 0.4, Math.hypot(L, H) + 0.4).rotateX(Math.atan2(H, L)).translate(wall * (w / 2 + 0.25), H / 2 + parapet / 2 - 0.1 + y0, -L / 2);
    out.wall.push(g);
  }
  out.top = [0, y1, -L];
  return out;
}

// ------------------------------------------------------------------ the shelf's top: grass and shrubs
/** Shrubs along a line A→B ([x, y, z]), n of them, s their size: leafy crowns (position + normal). */
export function shrubs(A, B, { n = 12, s = [0.8, 2], seed = 1, jitter = 1.5, detail = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 1777) + 3), out = [];
  const a = V(...A), b = V(...B);
  for (let i = 0; i < n; i++) {
    const p = a.clone().lerp(b, (i + rng()) / n), k = s[0] + rng() * (s[1] - s[0]);
    const g = leafCrown(seed * 37 + i, { lobes: detail >= 1 ? 5 : 3, detail: 0, core: 0.65, flat: 0.8 }).scale(k, k * (0.7 + rng() * 0.5), k);
    out.push(g.translate(p.x + (rng() - 0.5) * jitter, p.y + k * 0.3, p.z + (rng() - 0.5) * jitter));
  }
  return out;
}
/** Tufts of grass on a patch: thin blades in fans (position only). */
export function grassTufts(pts, { h = 0.6, seed = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 211) + 1), out = [];
  for (const [x, y, z] of pts) {
    const k = h * (0.6 + rng() * 0.8);
    for (let i = 0; i < 3; i++) { const a = rng() * TAU, l = 0.15; out.push(new THREE.ConeGeometry(0.06, k, 3).translate(0, k / 2, 0).rotateZ(Math.cos(a) * 0.4).rotateX(Math.sin(a) * 0.4).translate(x + Math.cos(a) * l, y, z + Math.sin(a) * l)); }
  }
  return out;
}

// ------------------------------------------------------------------ the sea of cloud
/**
 * The sea of cloud's cauliflowers: puffs from `near` to `far` m out from `at` ([x, z]), within `arc` [a0, a1] (rad,
 * from -z toward +x; the whole round by default), on a deck at y: each a big puff, lobes round it and smaller bumps on
 * their shoulders. [{ x, y, z, s, sy, main }…], for a kit's merge or an InstancedMesh.
 */
export function cloudPuffs({ y, near = 60, far = 2400, at = [0, 0], arc = [-Math.PI, Math.PI], n = 260, size = [14, 34], seed = 1, avoid = () => false }) {
  const rng = mulberry32(Math.floor(seed * 13) + 5), out = [];
  for (let i = 0; i < n; i++) {
    const u = rng(), d = near * Math.pow(far / near, u), a = arc[0] + rng() * (arc[1] - arc[0]);
    const x = at[0] + Math.sin(a) * d, z = at[1] - Math.cos(a) * d;
    if (avoid(x, z)) continue;
    const s = (size[0] + rng() * (size[1] - size[0])) * (0.6 + 0.9 * u) * (rng() < 0.1 ? 1.4 : 1), y0 = y + (rng() - 0.5) * s * 0.3;
    out.push({ x, y: y0, z, s, sy: 0.85 + rng() * 0.25, main: true, d });
    const lobes = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < lobes; k++) {
      const b = rng() * TAU, rr = s * (0.6 + rng() * 0.45), ls = s * (0.4 + rng() * 0.3), lx = x + Math.cos(b) * rr, lz = z + Math.sin(b) * rr, ly = y0 - ls * 0.2;
      out.push({ x: lx, y: ly, z: lz, s: ls, sy: 0.65 + rng() * 0.2, d });
      if (rng() < 0.7) { const c = b + (rng() - 0.5), bs = ls * (0.42 + rng() * 0.24); out.push({ x: lx + Math.cos(c) * ls * 0.6, y: ly + ls * 0.45, z: lz + Math.sin(c) * ls * 0.6, s: bs, sy: 0.75, d }); }
    }
    if (rng() < 0.55) out.push({ x: x + (rng() - 0.5) * 0.4 * s, y: y0 + s * 0.42, z: z + (rng() - 0.5) * 0.4 * s, s: s * (0.45 + rng() * 0.15), sy: 0.8, d });
  }
  return out;
}
/** A cloud puff's shape: knobbly, not a ball (the pictures' cloud is cauliflower at every scale). */
export function puffGeo(detail = 2, seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  lumpy(g, [0.03, 0.05, 0.09, 0.09][Math.min(3, detail)], 1.6, detail + seed);
  const m = mergeVertices(g, 1e-4); m.computeVertexNormals();
  return m;
}

// ------------------------------------------------------------------ people
/**
 * The traveller from behind: a rust cloak to the ankles, its hood up, and on his back the great pale pack (a rounded
 * shell taller than his head, as the pictures draw it), its dark straps. Adds a group to the kit (drawn only).
 */
export function traveller(kit, M, x, y, z, { yaw = 0, s = 1, pack = 'shell' } = {}) {
  const g = new THREE.Group(), m = M.traveller;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.52, 1.4, 12).translate(0, 0.78, 0), m));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 6, 0, TAU, 0, Math.PI / 2).scale(1.05, 0.55, 0.9).translate(0, 1.46, 0), m));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.18, 1.08).translate(0, 1.72, 0.02), M.hood));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 6).translate(e * 0.12, 0.1, 0.02), M.hood));
  // the pack: a pale rounded shell on the back, higher than the head
  const shell = pack === 'shell'
    ? new THREE.SphereGeometry(0.62, 14, 10).scale(0.85, 1.25, 0.55).translate(0, 1.5, 0.48)
    : new THREE.SphereGeometry(0.42, 12, 8).scale(1, 1.2, 0.8).translate(0, 1.25, 0.4);
  g.add(new THREE.Mesh(shell, M.pack));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 4, 16).scale(0.88, 1.3, 1).translate(0, 1.5, 0.52), M.packRim));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06).rotateZ(e * 0.15).translate(e * 0.17, 1.25, 0.24), M.hood));
  g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s);
  g.traverse((q) => { q.userData.noCollide = true; });
  kit.group.add(g);
  return g;
}
/** A resident in a cloak, standing at (x, y, z), now and then hauling a bundle (salt-harbour-kit.js figure). */
export function resident(kit, M, rng, x, y, z, { yaw = rng() * TAU, s = 1, bundle = rng() < 0.3 } = {}) {
  const F = figure(x, y, z, { s: s * (0.92 + rng() * 0.16), yaw, bundle }), m = M.cloaks[Math.floor(rng() * M.cloaks.length)];
  const NC = { solid: false, shadow: false };
  for (const g of F.cloak) kit.add(m, g, NC); for (const g of F.skin) kit.add(M.skin, g, NC); for (const g of F.bundle) kit.add(M.wicker, g, NC);
}

// ------------------------------------------------------------------ assembled: what the views and the world share
const NC = { solid: false, shadow: false }, SH = { solid: false, shadow: true }, SOLID = { solid: true, shadow: true };
const wrap = (i, n) => ((Math.floor(i) % n) + n) % n;
/**
 * A pod added to a kit at (x, y, z) turned by yaw (its door toward yaw's +z), its parts in the materials of
 * underMats; solid (its plaster) unless told. Lamps by its door become the kit's lights (r m). Returns the pod.
 */
export function podAt(kit, M, x, y, z, o = {}) {
  const P = pod(o), yaw = o.yaw ?? 0, at = (g) => g.rotateY(yaw).translate(x, y, z), plaster = M.plaster[wrap(o.tone ?? Math.floor((o.seed ?? 1) * 7), M.plaster.length)];
  for (const g of P.plaster) kit.add(plaster, at(g), o.solid === false ? SH : SOLID);
  for (const g of P.dark) kit.add(M.dark, at(g), NC);
  for (const g of P.glow) kit.add(M.glow, at(g), NC);
  for (const g of P.wood) kit.add(M.woodDark, at(g), NC);
  if (o.lights !== false) for (const [lx, ly, lz] of P.lamps) { const c = Math.cos(yaw), s = Math.sin(yaw); kit.light(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, o.lampR ?? 6); }
  return P;
}
/** A deck added to a kit (deck()'s options): planks and rails solid, rods and struts drawn only. */
export function deckAt(kit, M, o) {
  const D = deck(o);
  for (const g of D.planks) kit.add(M.plank, g, o.solid === false ? SH : SOLID);
  for (const g of D.wood) kit.add(M.wood, g, o.solid === false ? NC : SOLID);
  for (const g of D.rods) kit.add(M.rod, g, NC);
  return D;
}
/** A banner added to a kit: its cloth (one of the three reds) and its bar. */
export function bannerAt(kit, M, A, B, drop, o = {}) {
  const Bn = banner(A, B, drop, o);
  kit.add(M.banner[wrap(o.tone ?? Math.floor((o.seed ?? 1) * 3), M.banner.length)], Bn.cloth, SH);
  kit.add(M.woodDark, Bn.bar, NC);
  return Bn;
}
/** A basket let down on its rope from (x, top, z) to y. */
export function basketAt(kit, M, x, y, z, top, o = {}) {
  const B = basket(x, y, z, o);
  for (const g of B.wicker) kit.add(M.wicker, g, NC);
  for (const g of B.rope) kit.add(M.rope, g, NC);
  kit.add(M.rope, stick(V(x, y + (o.ring ?? 1.4), z), V(x, top, z), 0.03, 3), NC);
}
/** A lantern hung on its cord, its light. */
export function lampAt(kit, M, x, y, z, top, { r = 6, s = 1, light = true } = {}) {
  const L = lamp(x, y, z, top, { s });
  for (const g of L.iron) kit.add(M.iron, g, NC); for (const g of L.glow) kit.add(M.lamp, g, NC); for (const g of L.rope) kit.add(M.rope, g, NC);
  if (light) kit.light(x, y, z, r);
}
/** Wooden houses built out from a wall (salt-harbour-kit.js houseStack), at (x, y, z) turned by yaw (their fronts toward its +z). */
export function shacksAt(kit, M, x, y, z, { yaw = 0, w = 10, floors = 2, fh = 3, depth = [1.6, 3.2], seed = 1, lit = 0.35, detail = 1, solid = true } = {}) {
  const S = houseStack({ x0: -w / 2, x1: w / 2, y0: 0, floors, fh, depth, seed, lit, detail, plaster: 0.3, herbs: 0.6 });
  const at = (g) => g.rotateY(yaw).translate(x, y, z), o = solid ? SOLID : NC;
  for (const [k, m, so] of [['wood', M.wood2, o], ['plaster', M.plaster[1], o], ['dark', M.dark, NC], ['glow', M.glow, NC], ['cloth', M.banner[2], NC], ['pot', M.pot, NC], ['leaves', M.leaves, NC]]) for (const g of S[k]) kit.add(m, at(g), so);
  return S;
}

// ------------------------------------------------------------------ a frame, a town
/**
 * The kit seen through a frame: what is added to it is turned by yaw and moved to (x, y, z) first (geometry, lights,
 * groups), so a town can be built along a face in its own frame and set against any face.
 */
export function framed(kit, x, y, z, yaw = 0) {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z), c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    get group() { return kit.group; },
    mat: (o) => kit.mat(o),
    add: (mat, geo, o) => kit.add(mat, geo.applyMatrix4(m), o),
    mesh: (geo, mat, o) => kit.mesh(geo.applyMatrix4(m), mat, o),
    light: (lx, ly, lz, r) => kit.light(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, r),
    mover: (fn) => kit.mover(fn),
    /** a point of the frame in the kit's own */
    at: (lx, ly, lz) => V(x + lx * c + lz * s, y + ly, z - lx * s + lz * c),
    yaw, matrix: m,
  };
}

/**
 * The town hung under a shelf, along one of its faces, in the face's frame: x along the face (x0 … x1), z out from
 * it (0 the face, + out over the void, - in under the shelf), y as the world's. yU: the underside's height there
 * ((x, z) => y, or a number); faceTop: the face's top. Built:
 *   decks     at each of `levels` (y), in runs along the face with gaps, from `under` m in under the shelf to `out` m
 *             out in front of it, railed on their outer edge, rods up to the rock, stilts down to the deck below
 *   pods      white houses: on the face's ledges (eggs and domes stuck to it, their doors out), and hung from the
 *             underside down to a deck (drops) or free over the void (bulbs)
 *   shacks    timber houses on the decks, their backs to the rock
 *   banners   long red cloths from the outer edges of the decks, falling toward the cloud
 *   baskets   on ropes from the deck edges; lamps on cords under the decks; herbs on the rails; people on the decks
 * fill(x): how dense the town is along the face (0 bare rock … 1 crowded). solid: decks, rails, pods and shacks
 * collide (the world); the views draw them only. Returns { decks: [{ x0, x1, z0, z1, y, level }], pods: [{ x, y, z, r, h, kind }] }.
 */
export function town(fk, M, rng, o) {
  const { x0, x1, faceTop } = o, yUf = typeof o.yU === 'function' ? o.yU : () => o.yU;
  const y0 = yUf((x0 + x1) / 2, 0), levels = o.levels ?? [y0 - 4, y0 - 10, y0 - 16];
  const out = o.out ?? [4, 6, 8], under = o.under ?? [10, 6, 3], fill = o.fill ?? (() => 1), detail = o.detail ?? 1;
  const solid = !!o.solid, N = NC, decks = (o.decks ?? []).map((d) => ({ ...d })), pods = [], crown = o.crown ?? 1.2;   // (crown: how far the hung houses go up into what they hang from)
  const R = (a, b) => a + rng() * (b - a);
  // ---- the decks, level by level: runs along the face (or the ones given)
  const overhead = (px, pz) => (pz < -1 ? yUf(px, pz) : -Infinity);
  for (const d of decks) deckAt(fk, M, { rail: 'swe', up: overhead, every: 6, seed: d.x0 * 3 + d.y, solid, plank: o.plank, ...d });
  if (!o.decks) levels.forEach((y, li) => {
    let x = x0 + R(0, 4);
    while (x < x1 - 4) {
      const f = fill(x), len = R(6, 18) * (0.6 + f * 0.6);
      if (rng() < f * [1.1, 0.95, 0.8, 0.65, 0.5][Math.min(4, li)]) {
        const a = x, b = Math.min(x1, x + len), zo = out[li] * R(0.6, 1.2), zi = -under[li] * R(0.5, 1);
        deckAt(fk, M, { x0: a, x1: b, z0: zi, z1: zo, y, rail: 'swe', up: overhead, every: 6, seed: a * 3 + li, solid, plank: o.plank });
        decks.push({ x0: a, x1: b, z0: zi, z1: zo, y, level: li });
      }
      x += len + (rng() < 0.6 ? R(1, 6) : 0);
    }
  });
  // stilts from each deck's outer corners down to the deck under it (or a little way), braces, ladders between them;
  // the part out in front of the face hung on slanted rods from the rock's edge
  for (const d of decks) {
    if (d.z1 > 1) for (let x = d.x0 + 0.5; x < d.x1; x += Math.max(4, (d.x1 - d.x0) / Math.ceil((d.x1 - d.x0) / 7))) { const t = yUf(x, -2); if (t > d.y + 1) fk.add(M.rod, stick(V(x, d.y + 1.05, d.z1 - 0.1), V(x, t + 0.6, -2.5), 0.05), N); }
    const below = decks.find((e) => e.y < d.y - 2 && e.y > d.y - 9 && e.x0 < d.x1 && e.x1 > d.x0);
    const yb = below ? below.y : d.y - R(3, 6);
    for (const x of [d.x0 + 0.3, d.x1 - 0.3]) fk.add(M.woodDark, post(x, yb - 0.3, d.z1 - 0.3, d.y - 0.2, 0.1), N);
    fk.add(M.rod, stick(V(d.x0 + 0.3, d.y - 0.5, d.z1 - 0.3), V(Math.min(d.x1, d.x0 + 4), yb + 0.2, d.z1 - 0.3), 0.06), N);
    if (below && !solid && rng() < 0.6) { const lx = THREE.MathUtils.clamp(R(d.x0, d.x1), Math.max(d.x0, below.x0) + 1, Math.min(d.x1, below.x1) - 1); for (const g of ladder([lx, below.y, Math.min(d.z1, below.z1) - 1.2], [lx, d.y + 0.9, Math.min(d.z1, below.z1) - 1.2])) fk.add(M.rod, g, N); }
  }
  // ---- the pods: on the face's ledges, hung from the underside
  const nFace = o.facePods ?? Math.round((x1 - x0) / 16);
  for (let i = 0; i < nFace; i++) {
    const x = R(x0, x1);
    if (rng() > fill(x) + 0.15) continue;
    const r = R(...(o.faceR ?? [4, 9])), h = r * R(1.3, 1.9), yU = yUf(x, 0), y = R(yU - 2, Math.max(yU, faceTop - h * 0.8));
    podAt(fk, M, x, y, r * 0.35, { r, h, kind: rng() < 0.6 ? 'egg' : 'dome', seed: x + i, windows: 3 + Math.floor(rng() * 4), lit: o.lit ?? 0.35, detail, solid, squash: 0.85, lampR: 6 });
    pods.push({ x, y, z: r * 0.35, r, h, kind: 'face' });
    // its little balcony out in front
    if (rng() < 0.7) deckAt(fk, M, { x0: x - r * 0.6, x1: x + r * 0.6, z0: r * 0.8, z1: r * 0.8 + R(1.6, 2.6), y: y + 0.05, rail: 'swe', wall: 'n', seed: x, solid });
  }
  const nUnder = o.underPods ?? Math.round((x1 - x0) / 12);
  for (let i = 0; i < nUnder; i++) {
    const x = R(x0, x1), z = R(-under[0] * 0.9, out[0] * 0.3);
    if (rng() > fill(x) + 0.1) continue;
    const yU = yUf(x, z), deckUnder = decks.find((d) => x > d.x0 + 2 && x < d.x1 - 2 && z > d.z0 + 2 && z < d.z1 - 2 && d.y < yU - 4);
    const kind = deckUnder && rng() < 0.8 ? 'drop' : 'bulb', r = R(...(o.podR ?? [3.5, 8]));
    const h = kind === 'drop' ? (yU + crown - deckUnder.y) / 1.12 : r * R(1.4, 2.2) / 1.13;
    if (h < 3) continue;
    const y = kind === 'drop' ? deckUnder.y : yU + crown - h * 1.12;
    podAt(fk, M, x, y, z, { r, h, kind, seed: x * 3 + i, windows: 3 + Math.floor(rng() * 3), lit: o.lit ?? 0.4, door: kind === 'drop', cupola: false, detail, solid, yaw: R(-0.4, 0.4), lampR: 6 });
    pods.push({ x, y, z, r, h, kind });
  }
  if (o.back !== false) {
    const zb = -(o.back ?? under[0]), low = Math.min(...levels) - 2;
    for (let x = x0 + R(0, 4); x < x1 - 3;) {
      const w = R(6, 12), f = fill(x + w / 2);
      if (rng() < f + 0.2) {
        const top = yUf(x + w / 2, zb), floors = Math.max(1, Math.floor((top - low) / 3.4));
        shacksAt(fk, M, x + w / 2, top - floors * 3.4, zb, { w, floors, fh: 3.4, depth: [2, 5], seed: x * 7 + zb, lit: (o.lit ?? 0.4) * 0.8, detail, solid: false });
        if (rng() < 0.5) { const r = R(4, 8), h = Math.min(top - low, r * R(1.4, 2.4)) / 1.13; podAt(fk, M, x + R(0, w), top + 1.2 - h * 1.12, zb + R(2, 6), { r, h, kind: 'bulb', seed: x * 5, windows: 4, lit: o.lit ?? 0.4, door: false, cupola: false, detail, solid: false, lights: false }); }
      }
      x += w + R(0, 3);
    }
  }
  // ---- shacks on the decks: rows of them, their backs to the rock or to the row behind, alleys between, a walk
  //      kept clear along the outer rail
  for (const d of decks) {
    if (rng() > (o.shacks ?? 0.85)) continue;
    const zFront = d.z1 - (o.walk ?? 2.6);
    for (let zr = d.z0 + 0.4; zr < zFront - 3; zr += R(7, 10)) {
      for (let x = d.x0 + R(0.5, 3); x < d.x1 - 4;) {
        const w = Math.min(d.x1 - x - 0.5, R(4, 10));
        if (w < 3.5) break;
        if (rng() < (o.shackFill ?? 0.85)) {
          const top = yUf(x + w / 2, zr + 1) - d.y, floors = top > 6.8 ? 2 : 1;
          if (top >= 3.4) shacksAt(fk, M, x + w / 2, d.y, zr, { w, floors, fh: Math.min(3.2, (top - 0.4) / floors), depth: [1.4, Math.max(1.5, Math.min(3.2, zFront - zr - 0.5))], seed: x + d.y + zr, lit: o.lit ?? 0.4, detail, solid });
        }
        x += w + R(1.5, 4);
      }
    }
  }
  // ---- banners from the outer edges, baskets on ropes, lamps under the decks, herbs, people
  const nBan = o.banners ?? Math.round((x1 - x0) / 9);
  const outer = decks.filter((d) => d.z1 > 1.5);
  for (let i = 0; i < nBan && outer.length; i++) {
    const d = outer[Math.floor(rng() * outer.length)], w = R(...(o.bannerW ?? [2.4, 8])) * (rng() < 0.2 ? 1.5 : 1), x = R(d.x0 + w / 2, Math.max(d.x0 + w / 2, d.x1 - w / 2));
    const drop = R(...(o.bannerDrop ?? [14, 40])) * (1 + (2 - (d.level ?? 0)) * 0.15), zb = d.z1 + 0.25;
    bannerAt(fk, M, [x - w / 2, d.y - 0.3, zb], [x + w / 2, d.y - 0.3, zb], drop, { folds: Math.max(1, Math.round(w / 2.5)), fold: 0.12 + w * 0.04, pull: [R(-0.6, 0.6), R(0, 1.2)], seed: x + i, tone: Math.floor(rng() * 3) });
  }
  const nBask = o.baskets ?? Math.round((x1 - x0) / 25);
  for (let i = 0; i < nBask && outer.length; i++) {
    const d = outer[Math.floor(rng() * outer.length)], x = R(d.x0 + 1, d.x1 - 1), z = d.z1 + 1.4, drop = R(4, 22);
    // the arm out from the rail, its pulley; the rope down to the basket
    fk.add(M.wood, stick(V(x, d.y + 1.1, d.z1 - 0.3), V(x, d.y + 1.8, z), 0.08), N);
    basketAt(fk, M, x, d.y - drop, z, d.y + 1.8, { r: R(0.5, 0.9), h: R(0.6, 1) });
  }
  if (o.lamps !== false) for (const d of decks) for (let x = d.x0 + R(1, 4); x < d.x1 - 1; x += R(5, 10)) lampAt(fk, M, x, d.y - 1.4, d.z1 - R(0.5, 2), d.y - 0.6, { r: 7 });
  for (const d of decks) {
    for (let x = d.x0 + R(0.5, 3); x < d.x1 - 1; x += R(3, 9)) if (rng() < 0.45) { const Hb = herbs(x, d.y, d.z1 - 0.4, 0, { w: R(0.8, 1.6), seed: x + d.y, detail }); for (const g of Hb.pot) fk.add(M.pot, g, N); for (const g of Hb.leaves) fk.add(M.leaves, g, N); }
    if (o.people !== false) for (let x = d.x0 + R(1, 5); x < d.x1 - 1; x += R(5, 14)) resident(fk, M, rng, x, d.y, R(Math.max(d.z0, -1), d.z1 - 0.8), { yaw: R(-0.8, 0.8) });
  }
  return { decks, pods };
}
