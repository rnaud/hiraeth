import { SPHERES_TEMPLE } from '../temples/spheres.js';
import * as SPHERES_WORDS from '../temples/spheres-data.js';
import { templeVista } from '../temples/vistas.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FORM_ATTRS, formAxis, padForm } from '../form.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { Terrain, jitter, soften } from '../world.js';
import { PEOPLE } from '../story/spheres-data.js';
import { attachTempleDefinition } from '../temples/attachment.js';
import { placeShop } from '../shop-world.js';
import { SHOPS } from '../shop.js';
import { stepped } from '../load-steps.js';
import { pavedMask } from '../paved.js';
import { leafCrown, layeredCrown, crescentSphere as printedSphere, pillowRock, arcade, robotParts, hedge, paintPaving, pavingSegments } from './garden-kit.js';
import { SITE as FOOTPRINT, KEEPERS_STONE } from '../temples/spheres.js';
import { printGeometry } from '../temples/pieces.js';
import { Z_GAP } from '../temples/kit.js';
import { furrowsAt, fallsGround, buildExplorations, inCrater, CRATERS, PILLARS, SPIRAL } from './spheres-explorations.js';
import { buildDetours } from './spheres-detours.js';

const footprintVista = templeVista(FOOTPRINT, { width: 150, front: 260, back: 190 });

// ---------------------------------------------------------------------------
// The Garden of Spheres: a calm meadow under
// colossal umbrella trees, white pyramids, a white hill of sculpted rock, giant
// pale spheres half sunk in the grass, a still mirror lake, and an avenue of
// olives and cypresses through a sphere-arch to a round stone plaza.
//
// Journey: spawn in the umbrella grove -> walk the pale path through the
// sphere-arch -> along the avenue -> the ringed plaza (story goal). Side trips:
// the lake (reflections), the white hill (stairs, a canopy you can step onto,
// the stepped pyramid on top), the sphere field with its pillars, the android
// ruins in the wood.
// ---------------------------------------------------------------------------

const noise = createNoise2D(1986);
const noiseB = createNoise2D(311);
const lerp = THREE.MathUtils.lerp;

const W = -0.8;   // lake level
export const LAYOUT = {
  lake: { x: 190, z: -120, rx: 92, rz: 60 },
  view: { x: 190, z: -50 },                       // the south shore by Nell, kept open (the clumps keep off it)
  hill: { x: -215, z: -140, r: [66, 48, 34], top: [8, 18, 27] },
  hillTree: { x: -145, z: -140, R: 26 },           // its canopy touches the hill's middle terrace
  hillPyr: { half: 23, height: 27, tiers: 12, top: 5.5 },
  meadowPyr: { x: -62, z: -165, half: 30, height: 30, top: 4 },
  arch: { x: 0, z: -300, R: 36 },
  avenue: { z0: -342, z1: -590 },
  plaza: { x: 0, z: -622, r: 26 },
  pearl: { x: 96, z: -52, R: 12 },                 // a half-sunk sphere you can climb
  ruin: { x: -186, z: -418 },                      // a climbable white block in the android wood
};

/** The belvedere on the white hill's summit: its deck this many metres over the summit (one climb up its face: src/player.js). */
export const BELVEDERE = { h: 27 };

function lakeE(x, z) {
  const L = LAYOUT.lake;
  return Math.hypot((x - L.x) / L.rx, (z - L.z) / L.rz);
}

function baseHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = fbm(noise, x * 0.0021, z * 0.0021, 4) * lerp(3, 13, smoothstep(180, 900, r));
  h += fbm(noiseB, x * 0.011, z * 0.011, 2) * 0.9;
  // (issue #190: the furrows the fallen spheres ploughed, all pointing back to the great sphere: spheres-explorations.js)
  h += furrowsAt(x, z);
  // calm, flat ground: the spawn grove, the path to the arch, the avenue and plaza
  let flat = smoothstep(70, 30, r);
  flat = Math.max(flat, smoothstep(48, 26, Math.abs(x)) * smoothstep(-40, -70, z) * smoothstep(-720, -680, z));
  flat = Math.max(flat, smoothstep(90, 60, Math.hypot(x - LAYOUT.plaza.x, z - LAYOUT.plaza.z)));
  h = lerp(h, 0, flat);
  // the hill sits on a low rise
  const hd = Math.hypot(x - LAYOUT.hill.x, z - LAYOUT.hill.z);
  h = lerp(h, 1.5, smoothstep(110, 70, hd));
  // the lake basin with a pale gently sloping shore
  const e = lakeE(x, z);
  h = lerp(h, W + 0.45, smoothstep(1.9, 1.12, e));
  h = lerp(h, W - 3.2, smoothstep(1.0, 0.62, e));
  // far hills close the horizon
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1350, 1950, edge) * (120 + fbm(noise, x * 0.004, z * 0.004, 3) * 90);
  return h;
}
/** The ground, with the two craters of ringed terraces cut into it (their meshes are the ground inside: spheres-explorations.js). */
const FALLS = fallsGround(baseHeight);
const height = FALLS.height;

/**
 * The world's touches on the print preset (its reference sheets): thin even lines, little hatching,
 * no dots; the white stone's shade the world's pale blue (no warm grey kept); the umbrella canopies' undersides and the thickets the darkest places (no bounce lifting
 * them), their spot blacks a deep green.
 */
/** The day's colours: sky top, horizon, shadow, light, sun. */
export const SPHERES_DAY = ['#9cc4dc', '#f1d9cb', '#9cbcb8', '#fffdf4', '#fff8e0'];   // (the shade a sea-green grey, as the sheets' white stone)
export const SPHERES_LOOK = { uLineWidth: 1.0, uLineVary: 0.1, uWobble: 0.12, uHatch: 0.5, uDots: 0, uSkyDots: 0.3, uBounce: 0, uShadeKeep: 0, uSpotTone: [0.1, 0.17, 0.11, 0.5], uCast: [0.4, 0] };   // (uCast: the lawns' shadows lighter, as the sheets: post.js CAST)

/** The white stone's shade: flat, in the day's pale blue, and almost no strokes (the sheets). */
export const WHITE_SHADE = { shadeFlat: 1, hatch: 0.08 };
/**
 * The grass tufts' line (issue #504): a soft thing's, in a dark shade of their own green, a hairline past 20-35 m
 * (materials.js LINE, lineFar). In the world's black ink, each thin blade's outline came and went as the camera moved
 * a third of a pixel: the motion check's pan flickered 21 pixels in 10 000, 15 of them on the tufts.
 */
export const TUFT_LINE = { line: 0.45, lineTint: 1, lineFar: { line: 0.25, lineTint: 1, from: 20, to: 35 } };

// light direction the spheres' printed crescents are drawn for (morning sun from +x)
export const CRESCENT = new THREE.Vector3(0.75, 0.42, 0.5).normalize();


export const SPHERES_CONTENT = {
  weather: [],
  // the story is a quest (src/story/spheres-data.js): this page opens on the first visit
  // and closes when the pole has sung the spheres' three sounds back together
  story: {
    title: 'WHAT THE SPHERES REMEMBER',
    intro: 'Three fallen spheres hold three old sounds. The pole in the plaza plays them.',
    outro: 'Bell, voices, procession drum: three old sounds, brought together. The great sphere answered from the horizon.',
    label: 'the round plaza', goal: [LAYOUT.plaza.x, 'ground', LAYOUT.plaza.z], radius: 14, manual: true,
  },
  relics: {
    spots: [
      [LAYOUT.hillTree.x + 3, LAYOUT.hillTree.z - 4],                     // canopy top, stepped onto from the hill terrace
      [LAYOUT.hill.x + 4, LAYOUT.hill.z + 4],                             // stepped pyramid summit platform
      [LAYOUT.pearl.x, LAYOUT.pearl.z],                                   // top of the half-sunk sphere
      [LAYOUT.meadowPyr.x + 3, LAYOUT.meadowPyr.z - 2.8],                 // meadow pyramid summit
      [LAYOUT.ruin.x, LAYOUT.ruin.z],                                     // white ruin block in the android wood
    ],
    names: ['Canopy seed', 'Pyramid key', 'Sphere pearl', 'White step stone', 'Android eye'],
  },
  // the level's people (talk: src/story/spheres-data.js); Ume at the plaza is the story's
  npcs: [
    { at: [12, 14], radius: 3, ...PEOPLE.aube },
    { at: [178, -44], radius: 4, ...PEOPLE.nell },
    // (Emrys, who climbs everything: on the meadow pyramid's summit by its stair's head, in sight of the path, 60 m off it;
    //  he stood alone by the white hill, 160 m from anything: the level design audit's fifth round)
    { at: [LAYOUT.meadowPyr.x - 2.6, LAYOUT.meadowPyr.z + 3.4], y: 29, radius: 0.4, ...PEOPLE.ivo, shy: true },   // (y: the summit, 29 m up)
    { at: [7, -350], radius: 3, ...PEOPLE.cael },
  ],
};

// ------------------------------------------------------------------ helpers

export function prep(g, keepColor, keepForm = false) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) {
    if (k !== 'position' && k !== 'normal' && !(keepColor && k === 'color') && !(keepForm && FORM_ATTRS.includes(k))) geo.deleteAttribute(k);
  }
  return geo;
}

const _c = new THREE.Color();
/** Per-triangle colours (non-indexed): fn(centroid, faceNormal, triIndex) -> colour. */
export function paintFaces(geo, fn) {
  const p = geo.attributes.position, n = p.count;
  const col = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cen = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    nn.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    _c.set(fn(cen, nn, i / 3));
    for (let k = 0; k < 3; k++) col.set([_c.r, _c.g, _c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** Per-vertex colours: fn(position) -> colour. */
function paintVerts(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { _c.set(fn(v.fromBufferAttribute(p, i))); col.set([_c.r, _c.g, _c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildSpheres(scene) {
  const rng = mulberry32(1986);
  const R = (a, b) => a + rng() * (b - a);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const R2 = (r, a, b) => a + r() * (b - a);   // (with an rng of its own)
  const terrain = yield* Terrain.make({
    size: 4000, seg: 440, height,
    material: { color: '#d2d058', color2: '#c2c650', color3: '#98b056', mode: MODE_TERRAIN, ticks: true },   // (v0.95: the sheets' warm yellow lawn, less lime)
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);

  // ---------------------------------------------------------- batching
  // Render geometry is merged per material; collision uses one invisible
  // low-poly proxy mesh (physics bakes every mesh, visible or not).
  yield;
  const batches = new Map();
  const add = (mat, geo, collide = false) => {
    const key = mat.uuid + (collide ? ':c' : ':n');
    if (!batches.has(key)) batches.set(key, { mat, collide, list: [] });
    batches.get(key).list.push(prep(geo, mat.vertexColors, true));   // (and a part's axis: src/form.js)
  };
  const proxies = [];
  const proxy = (geo) => proxies.push(prep(geo, false));
  const reflect = [];   // far-shore geometry mirrored onto the lake
  const shrubs = [];    // {x, y, z, s, sy, color}
  const orbs = [];      // every sphere: { x, z, R, y (centre), yellow } (the story listens at three)
  const avoid = [];     // [x, z, r] keep scatter away
  const ways = [];      // the paths as drawn ({ points, w }): paved ground (src/paved.js)

  const M = {
    // (form: the umbrellas' trunks hatched round, their canopies' strokes radiating from the trunk; src/form.js)
    trunk: makeMaterial({ color: '#98aeb0', detail: 'organic', form: true }),   // (bark: grain strokes, materials.js DETAIL)
    branch: makeMaterial({ color: '#7a9496', form: true }),
    canopy: makeMaterial({ color: '#ffffff', vertexColors: true, form: true, line: 0.7, lineTint: 0.67 }),   // (foliage: a dark green line, lighter)
    // the umbrellas' undersides: a deep green, their veins drawn lighter as branches forking out to the rim (FORM.veins)
    under: makeMaterial({ color: '#2b4535', form: true, veins: 1 }),
    // (the white stone prints its shade flat in the day's pale blue, with almost no strokes, as the sheets)
    white: makeMaterial({ color: '#f3efe2', flat: true, ...WHITE_SHADE }),
    whiteSmooth: makeMaterial({ color: '#f5f2e8', ...WHITE_SHADE }),
    rock: makeMaterial({ color: '#f1ede2', ...WHITE_SHADE }),
    boulder: makeMaterial({ color: '#f3f0e6', ...WHITE_SHADE }),
    cave: makeMaterial({ color: '#3a5246', flat: true }),
    cream: makeMaterial({ color: '#ffffff', vertexColors: true, palette: ['#f6efd0', '#a9c9c4'], glow: 0.6 }),
    yellow: makeMaterial({ color: '#ffffff', vertexColors: true, palette: ['#f3e3a0', '#a9c9c4'], glow: 0.6 }),
    lining: makeMaterial({ color: '#b3d0c9', side: THREE.BackSide, glow: 0.55 }),
    stone: makeMaterial({ color: '#efe7d4' }),
    stone2: makeMaterial({ color: '#e0d4bc' }),
    path: makeMaterial({ color: '#efe8cc', paving: { size: 0.9, wear: 0.7 } }),
    pole: makeMaterial({ color: '#f6f3ea', ...WHITE_SHADE }),
    paving: makeMaterial({ color: '#ffffff', vertexColors: true }),
    water: makeMaterial({ color: '#a8d0d6', color2: '#9fd0c8', mode: MODE_WATER }),
  };

  // ---------------------------------------------------------- umbrella trees
  // Pale grey-green trunks under huge flat canopies: lime on top, dark green
  // underneath with radiating gill lines and branches fanning out to the rim.
  yield;
  const lump = (geo, seed, R0) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < R0 * 0.6) continue;
      const a = Math.atan2(z, x);
      const k = 1 + 0.05 * noise(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2 - seed) * smoothstep(0.6, 1, r / R0);
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    return geo;
  };
  function umbrella(x, z, Rc, Ht, o = {}) {
    const seed = rng() * 50, base = o.base ?? terrain.baseAt(x, z, Rc * 0.15) - 0.5;
    if (o.base === undefined && footprintVista(x, z, Rc)) {
      for (let b = 0; b < 30; b++) rng(); // preserve the branch draws and the rest of the meadow
      avoid.push([x, z, Rc * .14 * 2.2]);
      return { base, top: base + Ht + 2.3 + Rc * (o.dome ?? .09) };
    }
    const dome = Rc * (o.dome ?? 0.09);
    const rT = Rc * 0.085, rB = Rc * 0.14, yJ = Ht - Rc * 0.2;
    const prof = [
      [0.01, yJ + 0.6], [rT * 1.3, yJ], [Rc * 0.25, yJ + Rc * 0.09], [Rc * 0.55, yJ + Rc * 0.16], [Rc * 0.85, Ht - 0.25], [Rc, Ht],
      [Rc * 1.02, Ht + 0.8], [Rc * 0.99, Ht + 1.7], [Rc * 0.88, Ht + 2.3], [Rc * 0.6, Ht + 2.3 + dome * 0.55],
      [Rc * 0.25, Ht + 2.3 + dome * 0.92], [0.01, Ht + 2.3 + dome],
    ];
    const canopy = lump(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96), seed, Rc);
    canopy.computeVertexNormals();
    const g = formAxis(canopy.toNonIndexed(), 'cap');
    const top = o.top ?? '#b7c46a';
    paintFaces(g, (c, n) => {
      const r = Math.hypot(c.x, c.z);
      if (n.y < -0.05) {
        const s = Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / (Math.PI * 2)) * 96);
        return s % 2 === 0 ? '#2b4636' : '#3f5f4a';
      }
      if (r > Rc * 0.95 && c.y < Ht + 1.9) return '#9fb860';
      return noise(c.x * 0.06 + seed, c.z * 0.06) > 0.35 ? '#c6d07c' : top;
    });
    g.translate(x, base, z);
    // drawn in two: the lime top (its painted faces) and the deep green underside, veined (M.under)
    {
      const p = g.attributes.position, top = [], under = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        (b.sub(a).cross(c.sub(a)).normalize().y < -0.05 ? under : top).push(i);
      }
      const pick = (list) => {
        const o = new THREE.BufferGeometry();
        for (const [k, attr] of Object.entries(g.attributes)) {
          const n = attr.itemSize, arr = new Float32Array(list.length * 3 * n);
          list.forEach((i, j) => { for (let v = 0; v < 3; v++) for (let q = 0; q < n; q++) arr[(j * 3 + v) * n + q] = attr.array[(i + v) * n + q]; });
          o.setAttribute(k, new THREE.BufferAttribute(arr, n));
        }
        return o;
      };
      add(M.canopy, pick(top));
      const u = pick(under); u.deleteAttribute('color');
      add(M.under, u);
    }
    // trunk: pinched waist, flaring roots and crown
    const tl = yJ + 1.5;
    const trunk = formAxis(new THREE.CylinderGeometry(rT, rB, tl, 14, 8, true), 'wrap').translate(0, tl / 2, 0);
    jitter(trunk, 0.12, 0.08, seed);
    soften(trunk, -0.14);
    add(M.trunk, trunk.translate(x, base, z));
    const flare = formAxis(new THREE.CylinderGeometry(rB * 0.95, rB * 1.9, Ht * 0.1, 14, 2, true), 'wrap').translate(0, Ht * 0.05, 0);
    jitter(flare, 0.2, 0.3, seed + 3);
    add(M.trunk, flare.translate(x, base, z));
    // branches fanning out under the canopy
    const nb = 15;
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * Math.PI * 2 + rng() * 0.4, ca = Math.cos(a), sa = Math.sin(a);
      const r1 = Rc * R(0.62, 0.8), y1 = yJ + Rc * 0.16 * (r1 / Rc) / 0.55 - 0.6;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ca * rT * 0.6, yJ - Rc * 0.08, sa * rT * 0.6),
        new THREE.Vector3(ca * r1 * 0.4, yJ + Rc * 0.02, sa * r1 * 0.4),
        new THREE.Vector3(ca * r1, Math.min(y1, Ht - 0.6), sa * r1));
      add(M.branch, formAxis(new THREE.TubeGeometry(curve, 6, Rc * (b % 3 ? 0.011 : 0.017), 5), 'cap').translate(x, base, z));
    }
    if (o.collide !== false) {
      // (the trunk and the canopy collide as drawn: a 20-sided canopy of half the profile lay metres inside the
      // drawn one, where you land on it: src/contact-audit.js)
      proxy(trunk.clone()); proxy(g.clone()); proxy(flare.clone());   // (the flaring roots are drawn up to 4 m outside the trunk: they are solid too)
    }
    avoid.push([x, z, rB * 2.2]);
    return { top: base + Ht + 2.3 + dome, base };
  }

  // ---------------------------------------------------------- stairs
  // A straight flight from (x0, y0, z0) climbing `rise` along (dx, dz).
  // Drawn as steps; walked on as one smooth ramp hidden beneath them.
  function flight(x0, y0, z0, dx, dz, rise, w, mat, { tread = 0.5, stepH = 0.4, rails = true, landing = 0 } = {}) {
    const n = Math.max(2, Math.ceil(rise / stepH)), h = rise / n, run = n * tread;
    const rot = Math.atan2(dx, dz), parts = [];
    for (let k = 0; k < n; k++) {
      const hy = (k + 1) * h;
      parts.push(new THREE.BoxGeometry(w, hy, tread).translate(0, hy / 2, (k + 0.5) * tread));
    }
    const len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    if (landing) {
      const slab = new THREE.BoxGeometry(w, 0.6, landing).translate(0, rise - 0.3, run + landing / 2);
      // (drawn Z_GAP under the terrace it lands on, walked on its proxy: its top and the hill's were one plane; issue #286)
      parts.push(slab.clone().translate(0, -Z_GAP, 0));
      proxy(slab.rotateY(rot).translate(x0, y0, z0));
    }
    if (rails) {
      for (const sx of [-1, 1]) {
        parts.push(new THREE.BoxGeometry(0.7, 1.1, len).rotateX(-ang).translate(sx * (w / 2 + 0.35), rise / 2 + 0.55, run / 2));
      }
    }
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    g.rotateY(rot).translate(x0, y0, z0);
    add(mat, g);
    // ramp: from half a step above the foot to the landing
    const y0r = h * 0.5, slope = Math.atan2(rise - y0r, run), L = Math.hypot(run, rise - y0r);
    const ramp = new THREE.BoxGeometry(w, 0.3, L).rotateX(-slope).translate(0, (y0r + rise) / 2 - 0.15 / Math.cos(slope), run / 2);
    proxy(ramp.rotateY(rot).translate(x0, y0, z0));
    if (rails) {
      for (const sx of [-1, 1]) {
        proxy(new THREE.BoxGeometry(0.7, 1.1, len, 1, 1, 1).rotateX(-ang).translate(sx * (w / 2 + 0.35), rise / 2 + 0.55, run / 2)
          .rotateY(rot).translate(x0, y0, z0));
      }
    }
    return run;
  }

  // ---------------------------------------------------------- pyramids
  // Stepped: white tiers with a central staircase over the tier corners and a
  // small temple with an antenna on the summit platform.
  // (`belvedere`: the summit temple's top rises into a square white tower that many metres over the summit, rungs up
  // its face, a railed deck on top: the white hill's, v1.46, the level design audit's verticality, issue #40)
  function stepPyramid(cx, cy, cz, { half, height: ht, tiers, top }, facing = [0, 1], reflectIt = false, { belvedere = 0 } = {}) {
    const th = ht / tiers, parts = [];
    for (let i = 0; i < tiers; i++) {
      const hw = half - (i * (half - top)) / (tiers - 1);
      parts.push(new THREE.BoxGeometry(hw * 2, th, hw * 2).translate(cx, cy + th * (i + 0.5), cz));
    }
    const temple = [
      new THREE.BoxGeometry(top * 0.9, 3.4, top * 0.9).translate(cx, cy + ht + 1.7, cz),
      new THREE.BoxGeometry(top * 1.05, 0.5, top * 1.05).translate(cx, cy + ht + 3.65, cz),
      ...(belvedere ? [] : [new THREE.BoxGeometry(top * 0.6, 1.4, top * 0.6).translate(cx, cy + ht + 4.6, cz)]),
    ];
    let mast = cy + ht + 9.8;
    if (belvedere) {
      // the tower on the temple's roof (its cap 3.9 m over the summit: climbed onto from the summit, then the tower's face)
      const w = top * 0.6, y0 = cy + ht + 3.9, y1 = cy + ht + belvedere, d = w + 0.8, [fx, fz] = facing;
      temple.push(new THREE.BoxGeometry(w, y1 - y0, w).translate(cx, (y0 + y1) / 2, cz), new THREE.BoxGeometry(d, 0.25, d).translate(cx, y1 + 0.12, cz));
      const iron = [];
      for (let r = y0 + 0.6; r < y1 - 0.4; r += 0.45) iron.push(new THREE.BoxGeometry(0.9, 0.07, 0.12).translate(cx + fx * (w / 2 + 0.12), r, cz + fz * (w / 2 + 0.12)));
      for (const [dx, dz, a, b] of [[0, -d / 2, d, 0.06], [d / 2, 0, 0.06, d], [-d / 2, 0, 0.06, d]]) iron.push(new THREE.BoxGeometry(a, 0.06, b).translate(cx + dx, y1 + 1.15, cz + dz));
      for (const [dx, dz] of [[d / 2, d / 2], [-d / 2, d / 2], [d / 2, -d / 2], [-d / 2, -d / 2]]) iron.push(new THREE.BoxGeometry(0.06, 1, 0.06).translate(cx + dx, y1 + 0.65, cz + dz));
      for (const g of iron) add(M.pole, g);
      mast = y1 + 4.6;
    }
    for (const p of parts) { add(M.white, p, true); if (reflectIt) reflect.push({ geo: p.clone(), key: 'white' }); }
    for (const p of temple) { add(M.white, p, true); if (reflectIt) reflect.push({ geo: p.clone(), key: 'white' }); }
    add(M.pole, new THREE.CylinderGeometry(0.12, 0.18, 9, 6).translate(cx, mast, cz));
    add(M.cave, new THREE.PlaneGeometry(top * 0.32, 2.1).translate(0, 1.05, top * 0.452)
      .rotateY(Math.atan2(facing[0], facing[1])).translate(cx, cy + ht, cz));
    // stairs over the tier corners
    const slope = ((tiers - 1) * th) / (half - top), foot = half + th / slope;
    const [fx, fz] = facing;
    flight(cx + fx * foot, cy, cz + fz * foot, -fx, -fz, ht, Math.max(4, top * 0.7), M.white, { tread: 0.4 / slope });
  }
  // Smooth: a truncated four-sided pyramid with a staircase up one face.
  function smoothPyramid(cx, cz, { half, height: ht, top }, facing = [0, 1], reflectIt = false) {
    const cy = terrain.baseAt(cx, cz, half) - 0.6;
    const body = new THREE.CylinderGeometry(top * Math.SQRT2, half * Math.SQRT2, ht, 4, 1).rotateY(Math.PI / 4).translate(cx, cy + ht / 2, cz);
    const plinth = new THREE.BoxGeometry(half * 2 + 3, 1.6, half * 2 + 3).translate(cx, cy + 0.8, cz);
    const temple = [
      new THREE.BoxGeometry(top * 1.1, 3, top * 1.1).translate(cx, cy + ht + 1.5, cz),
      new THREE.CylinderGeometry(top * 0.3, top * 0.55, 2.4, 4).rotateY(Math.PI / 4).translate(cx, cy + ht + 4.2, cz),
    ];
    for (const p of [body, plinth, ...temple]) { add(M.white, p, true); if (reflectIt) reflect.push({ geo: p.clone(), key: 'white' }); }
    add(M.pole, new THREE.CylinderGeometry(0.1, 0.15, 8, 6).translate(cx, cy + ht + 9, cz));
    const slope = ht / (half - top), [fx, fz] = facing;
    if (!reflectIt) flight(cx + fx * (half + 0.4), cy + 0.2, cz + fz * (half + 0.4), -fx, -fz, ht - 0.2, 6, M.white, { tread: 0.4 / slope });
    avoid.push([cx, cz, half * 1.45]);
    return cy + ht;
  }

  // ---------------------------------------------------------- spheres
  // poles along the light: the terminator is then exactly one ring of vertices,
  // so the printed crescent has a clean round edge
  yield;
  const crescentSphere = (Rs, w, h, lit) => printedSphere(Rs, w, h, lit, '#a9c9c4', CRESCENT);
  function sphere(x, z, Rs, lift, { yellow = false, collide = true, reflectIt = false, y, seg: segs } = {}) {
    const cy = y ?? terrain.baseAt(x, z, Rs * 0.6) + Rs * lift;
    const seg = segs ?? (Rs > 60 ? 96 : 64);
    const g = crescentSphere(Rs, seg, Math.round(seg * 0.6), yellow ? '#f3e3a0' : '#f6efd0');
    add(yellow ? M.yellow : M.cream, g.translate(x, cy, z));
    // (collides as drawn: a 20-sided stand-in lay up to metres inside a big sphere's top, where you stand: src/contact-audit.js)
    if (collide) proxy(g.clone());
    if (reflectIt) reflect.push({ geo: new THREE.SphereGeometry(Rs, 32, 20).translate(x, cy, z), key: 'sphere' });
    avoid.push([x, z, Rs * 1.05]);
    orbs.push({ x, z, R: Rs, y: cy, yellow });
    return cy;
  }
  // a sphere with a round tunnel through it; the ground cuts the tunnel into a horseshoe arch
  function sphereArch(x, z, Rs) {
    const cy = H(x, z) + Rs * 0.42, rt = Rs * 0.56, th0 = Math.asin(rt / Rs), len = 2 * Rs * Math.cos(th0);
    // shaded along meridians of the tunnel axis, so the edge follows a vertex column
    const sh = new THREE.Vector3(Math.cos(0.65), Math.sin(0.65), 0);
    const outer = paintFaces(new THREE.SphereGeometry(Rs, 96, 48, 0, Math.PI * 2, th0, Math.PI - 2 * th0).toNonIndexed().rotateX(Math.PI / 2),
      (c) => (c.dot(sh) > 0 ? '#f3e3a0' : '#a9c9c4'));
    add(M.yellow, outer.translate(x, cy, z));
    const lining = new THREE.CylinderGeometry(rt, rt, len, 96, 1, true).rotateX(Math.PI / 2).translate(x, cy, z);
    add(M.lining, lining);
    proxy(outer.clone()); proxy(lining.clone());   // (as drawn)
    avoid.push([x, z, Rs * 1.1]);
  }
  function pillar(x, z, ht, r = 0.9) {
    const b = terrain.baseAt(x, z, r) - 0.5;
    const shaft = new THREE.CylinderGeometry(r * 0.85, r, ht, 12, 1).translate(x, b + ht / 2, z);
    const foot = new THREE.CylinderGeometry(r * 1.6, r * 1.8, 1.2, 12, 1).translate(x, b + 0.6, z);
    proxy(shaft.clone()); proxy(foot.clone());   // (as drawn: a 6-sided stand-in cut the corners off, and the foot had no collision at all)
    add(M.pole, shaft); add(M.pole, foot);
    avoid.push([x, z, 2.5]);
  }
  function monolith(x, z, ht, w, rot) {
    const b = terrain.baseAt(x, z, w) - 0.5;
    const g = new RoundedBoxGeometry(w, ht, w * 0.5, 3, w * 0.24).translate(0, ht / 2, 0).rotateY(rot).translate(x, b, z);
    proxy(g.clone());   // (as drawn: a square box stood proud of the rounded edges)
    add(M.whiteSmooth, g);
    avoid.push([x, z, w]);
  }

  // ---------------------------------------------------------- paths
  function path(points, w = 3.2) {
    ways.push({ points, w: w * 1.12 });   // (paved: the flowers keep off it, src/paved.js; 1.12 its widest wobble)
    const pts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
      for (let k = 0; k < n; k++) pts.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]);
    }
    pts.push(points[points.length - 1]);
    const pos = [];
    const edge = (i, s) => {
      const [x, z] = pts[i], [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      const tx = nx - px, tz = nz - pz, tl = Math.hypot(tx, tz) || 1;
      const wob = w * (1 + 0.12 * noise(x * 0.05, z * 0.05));
      const ex = x + (-tz / tl) * s * wob / 2, ez = z + (tx / tl) * s * wob / 2;
      return [ex, H(ex, ez) + 0.12, ez];
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = edge(i, -1), b = edge(i, 1), c = edge(i + 1, -1), d = edge(i + 1, 1);
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    add(M.path, g);
  }

  // ==========================================================================
  // the lake
  // ==========================================================================
  yield;
  const Lk = LAYOUT.lake;
  yield;
  {
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2).scale(Lk.rx * 1.3, 1, Lk.rz * 1.3),
      M.water);
    water.position.set(Lk.x, W, Lk.z);
    water.userData.noCollide = true;
    scene.add(water);
    // the white buildings, a pyramid and a sphere on the far shore
    const fz = Lk.z - Lk.rz - 6;
    smoothPyramid(Lk.x - 58, fz - 6, { half: 14, height: 22, top: 2.4 }, [0, 1], true);
    sphere(Lk.x + 52, fz - 14, 20, 0.45, { reflectIt: true });
    const blocks = [
      [Lk.x - 10, fz - 4, 30, 9, 13], [Lk.x - 10, fz - 6, 20, 15, 9], [Lk.x - 10, fz - 7, 10, 20, 6],
      [Lk.x + 18, fz - 2, 14, 7, 10], [Lk.x + 18, fz - 3, 8, 12, 7],
    ];   // (the little block west of the temple gave way to the causeway's landing, issue #190)
    for (const [x, z, w, h, d] of blocks) {
      const g = new THREE.BoxGeometry(w, h, d).translate(x, terrain.baseAt(x, z, w * 0.5) - 0.5 + h / 2, z);
      add(M.white, g, true);
      reflect.push({ geo: g.clone(), key: 'white' });
    }
    // pagoda roof and a dome on the main temple
    const ty = terrain.baseAt(Lk.x - 10, fz - 7, 10) - 0.5 + 20;
    const roof = new THREE.ConeGeometry(7, 4.5, 4).rotateY(Math.PI / 4).translate(Lk.x - 10, ty + 2.25, fz - 7);
    const dome = new THREE.SphereGeometry(4.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(Lk.x + 18, terrain.baseAt(Lk.x + 18, fz - 3, 7) - 0.5 + 12, fz - 3);
    add(M.white, roof, true); add(M.whiteSmooth, dome, true);
    reflect.push({ geo: roof.clone(), key: 'white' }, { geo: dome.clone(), key: 'white' });
    add(M.pole, new THREE.CylinderGeometry(0.12, 0.12, 10, 6).translate(Lk.x - 10, ty + 9, fz - 7));
    // dark cypresses framing the far shore
    for (const [x, z, h] of [[Lk.x - 82, fz + 8, 22], [Lk.x - 76, fz + 2, 17], [Lk.x + 82, fz + 6, 24], [Lk.x + 90, fz + 12, 18], [Lk.x + 35, fz + 2, 14]]) {
      const b = H(x, z) - 0.3;
      const g = new THREE.LatheGeometry([[0.01, 0], [1.6, 1], [2.2, h * 0.3], [1.8, h * 0.7], [0.01, h]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
      jitter(g, 0.12, 0.3, x);
      g.translate(x, b, z);
      add(makeMaterial({ color: '#4f6b3a' }), g);
      reflect.push({ geo: g.clone(), key: 'tree' });
    }
  }
  // the half-sunk sphere by the west shore: climb it for the pearl
  sphere(LAYOUT.pearl.x, LAYOUT.pearl.z, LAYOUT.pearl.R, -0.15);

  // ==========================================================================
  // the white hill: sculpted rock terraces, round shrubs, cave doors, stairs,
  // and the stepped pyramid on top
  // ==========================================================================
  yield;
  const Hl = LAYOUT.hill;
  const hillBase = terrain.baseAt(Hl.x, Hl.z, Hl.r[0]) - 0.8;
  let belvedereTop = null;
  yield;
  {
    let prev = 0;
    for (let i = 0; i < 3; i++) {
      const r = Hl.r[i], top = Hl.top[i], h = top - prev + (i === 0 ? 0.8 : 1);
      const g = new THREE.CylinderGeometry(r, r * 1.03, h, 44, 3);
      jitter(g, 0.025, 0.05, i * 7 + 2);
      g.translate(Hl.x, hillBase + top - h / 2, Hl.z);
      add(M.rock, g, true);
      prev = top;
    }
    // the sculpted rock: each terrace's wall a row of rounded pillows of white stone bulging from it (the sheets'
    // hill is carved lobes, not a drum), a few smaller ones stacked on them; clear of the stairs, the canopy step and
    // the cave doors. Solid as drawn (src/contact-audit.js). (Their own rng: the world's scatter stays where it was.)
    {
      const rs = mulberry32(19861), doors = [[0.9, 0], [1.25, 0], [0.4, 0], [2.0, 1], [2.4, 1], [-0.4, 1]];
      const off = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      let lo = 0;
      for (let i = 0; i < 3; i++) {
        const r = Hl.r[i], top = Hl.top[i], h = top - lo;
        for (let a = rs() * 0.2; a < Math.PI * 2; ) {
          const sx = R2(rs, 5, 10), da = sx * 0.62 / r;
          const clearOf = (b, w) => off(a, b) > w + sx * 0.5 / r;
          if (clearOf(Math.PI / 2, 4.5 / r) && (i !== 1 || clearOf(0, 0.3)) && doors.every(([b, t]) => t !== i || clearOf(b, 2.6 / r))) {
            const sy = h * R2(rs, 0.62, 0.86), sz = R2(rs, 3, 5.5), rr = r + sz * R2(rs, 0.05, 0.3);
            const g = pillowRock(rs() * 100, sx * 0.5, sy * 0.5, sz * 0.5, { detail: 1 }).rotateY(-a + Math.PI / 2)
              .translate(Hl.x + Math.cos(a) * rr, hillBase + lo - 0.6, Hl.z + Math.sin(a) * rr);
            add(M.rock, g); proxy(g.clone());
            if (rs() < 0.35) {
              const s2 = sx * R2(rs, 0.4, 0.6), sy2 = h * R2(rs, 0.3, 0.45), r2 = r + sz * 0.1;
              const u = pillowRock(rs() * 100, s2 * 0.5, sy2 * 0.5, sz * 0.4, { detail: 1 }).rotateY(-a + Math.PI / 2)
                .translate(Hl.x + Math.cos(a + (rs() - 0.5) * da) * r2, hillBase + lo + sy * 0.55, Hl.z + Math.sin(a + (rs() - 0.5) * da) * r2);
              add(M.rock, u); proxy(u.clone());
            }
          }
          a += da * R2(rs, 0.9, 1.25);
        }
        lo = top;
      }
    }
    // boulders tumbling down the terrace edges
    for (let i = 0; i < 70; i++) {
      const tier = i % 3, r0 = Hl.r[tier], a = rng() * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.22) continue;   // the stair line
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3 && tier === 1) continue;                  // the canopy step
      const s = R(3, 7.5), rr = r0 + R(-1, 2.5);
      const x = Hl.x + Math.cos(a) * rr, z = Hl.z + Math.sin(a) * rr;
      const y = hillBase + (tier === 0 ? 0 : Hl.top[tier - 1]) + s * 0.4;
      const g = new THREE.IcosahedronGeometry(1, 1);
      jitter(g, 0.22, 0.6, i);
      const sx = s * R(0.9, 1.4), sy = s * R(0.7, 1), sz = s * R(0.9, 1.3), ry = rng() * 3;
      g.scale(sx, sy, sz).rotateY(ry).translate(x, y, z);
      proxy(g.clone());   // (as drawn: a bare 20-sided stand-in at 0.95 lay up to 2 m inside the lumpy rock you stand on)
      add(M.boulder, g);
    }
    // round-arched cave doors in the lowest terrace
    const arch = new THREE.Shape();
    arch.moveTo(-1.6, 0); arch.lineTo(1.6, 0); arch.lineTo(1.6, 2.6); arch.absarc(0, 2.6, 1.6, 0, Math.PI, false); arch.lineTo(-1.6, 0);
    for (const a of [0.9, 1.25, 2.0, 2.4, -0.4, 0.4]) {
      const r = Hl.r[0] - 0.4, tier = a > 1.9 || a < 0 ? 1 : 0, rr = Hl.r[tier] - 0.35;
      const g = new THREE.ShapeGeometry(arch, 8).scale(1.3, 1.3, 1).translate(0, 0, rr)
        .rotateY(Math.PI / 2 - a).translate(Hl.x, hillBase + (tier ? Hl.top[0] : 0.4), Hl.z);
      void r;
      add(M.cave, g);
    }
    // stairs up the south face, one flight per terrace
    let prevTop = 0;
    for (let i = 0; i < 3; i++) {
      const rise = Hl.top[i] - prevTop, run = Math.ceil(rise / 0.4) * 0.42;
      flight(Hl.x, hillBase + prevTop, Hl.z + Hl.r[i] * 1.06 + run, 0, -1, rise, 5, M.white, { tread: 0.42, landing: Hl.r[i] * 0.06 + 3 });
      prevTop = Hl.top[i];
    }
    stepPyramid(Hl.x, hillBase + Hl.top[2], Hl.z, LAYOUT.hillPyr, [0, 1], false, { belvedere: BELVEDERE.h });
    belvedereTop = new THREE.Vector3(Hl.x, hillBase + Hl.top[2] + LAYOUT.hillPyr.height + BELVEDERE.h + 0.25, Hl.z);
    // round dark shrubs crowding the terraces
    for (let i = 0; i < 260; i++) {
      const tier = Math.floor(rng() * 3), rin = tier === 2 ? 27 : Hl.r[tier + 1] + 1, rout = Hl.r[tier] - 1.5;
      const a = rng() * Math.PI * 2, rr = R(rin, rout);
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.16) continue;
      if (tier === 1 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
      shrubs.push({ x: Hl.x + Math.cos(a) * rr, y: hillBase + Hl.top[tier] - 0.3, z: Hl.z + Math.sin(a) * rr, s: R(1.6, 3.6), dark: true });
    }
    // the umbrella tree whose canopy you can step onto from the middle terrace
    const T = LAYOUT.hillTree, top = hillBase + Hl.top[1] - 0.6, dome = 0.04;
    umbrella(T.x, T.z, T.R, top - hillBase - 2.3 - T.R * dome, { base: hillBase, dome });
  }
  // a big pale sphere rising behind the hill
  sphere(Hl.x - 95, Hl.z - 120, 46, 0.3, { yellow: true });

  // ==========================================================================
  // the meadow: umbrella grove at spawn, the smooth pyramid, scattered spheres
  // ==========================================================================
  yield;
  for (const [x, z, Rc, Ht, dome] of [
    [-36, -30, 30, 32, 0.08], [34, -66, 24, 26, 0.1], [-66, 16, 32, 40, 0.06], [56, 2, 19, 21, 0.12],
    [-22, 58, 22, 25, 0.09], [70, -118, 17, 18, 0.14], [-118, -42, 27, 35, 0.07], [-12, -110, 14, 16, 0.16],
    [118, 30, 24, 30, 0.08], [-150, 40, 20, 24, 0.1],
  ]) umbrella(x, z, Rc, Ht, { dome });
  const MP = LAYOUT.meadowPyr;
  smoothPyramid(MP.x, MP.z, MP, [0, 1]);
  // distant umbrella trees all round
  yield;
  for (let i = 0, n = 0; i < 200 && n < 34; i++) {
    yield;
    const a = rng() * Math.PI * 2, r = R(260, 1150), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (lakeE(x, z) < 1.5 || Math.abs(x) < 70 && z < -200 && z > -720 || Math.hypot(x - Hl.x, z - Hl.z) < 120) continue;
    if (Math.hypot(x - 380, z + 330) < 150) continue;
    umbrella(x, z, R(16, 34), R(18, 44), { dome: R(0.05, 0.18), collide: r < 700 });
    n++;
  }

  // ---------------------------------------------------------- the sphere field: giant spheres among thin white pillars
  yield;
  sphere(380, -320, 36, 0.5);
  sphere(450, -440, 24, 0.15, { yellow: true });
  sphere(300, -450, 15, 1);
  // (issue #190: on the floor of its crater of ringed terraces, sunk as it was)
  sphere(CRATERS.chant.x, CRATERS.chant.z, 18, 0, { y: FALLS.levels.chant - CRATERS.chant.drop * 3 + 18 * CRATERS.chant.sink });
  sphere(250, 60, 22, 0.05, { yellow: true });
  sphere(-330, 80, 30, 0.4);
  yield;
  for (const [x, z, h] of [[330, -260, 70], [345, -385, 88], [415, -350, 62], [470, -300, 75], [280, -360, 55], [400, -500, 80],
    [120, -250, 60], [140, -265, 48], [-95, -230, 66], [250, -180, 40], [520, -400, 90], [-260, 40, 58]]) {
    const r = R(0.7, 1.1);
    if (!inCrater(x, z)) pillar(x, z, h, r);   // (two stood where the cracked moon's crater is now: their draw kept, issue #190)
  }
  monolith(205, -300, 24, 4.2, 0.3);
  monolith(-60, -420, 18, 3.4, -0.4);
  monolith(60, 120, 20, 3.8, 1.1);

  // ==========================================================================
  // the sphere-arch, the avenue and the round plaza
  // ==========================================================================
  yield;
  const A = LAYOUT.arch, Av = LAYOUT.avenue, Pz = LAYOUT.plaza;
  const plaza = { x: Pz.x, z: Pz.z, r: Pz.r };
  sphereArch(A.x, A.z, A.R);
  const WAY = [[0, 8], [0, -60], [3, -150], [0, -250], [0, -350]], AVENUE = [[0, -335], [0, Av.z1 + 4]], LAKE_PATH = [[2, -40], [60, -60], [130, -52], [178, -46]];
  path(WAY, 3.4);
  path(AVENUE, 6);
  path(LAKE_PATH, 2.6);
  const HILL_WAY = [[-2, -30], [-60, -60], [-140, -55], [-215, -58], [Hl.x, Hl.z + Hl.r[0] + 12]];   // (the grove to the white hill's stair: since v1.54 the way home from the keepers' stone)
  path(HILL_WAY, 2.8);
  path([[-24, -64], [MP.x, -110], [MP.x, MP.z + MP.half + 12]], 2.4);
  path([[-8, -395], [-60, -405], [-120, -420], [-170, -430]], 2.2);
  yield;
  {
    // the plaza: concentric stone rings around a thin pole
    const by = H(Pz.x, Pz.z);
    const rings = [[Pz.r, 0.32, M.stone], [Pz.r * 0.8, 0.46, M.stone2], [Pz.r * 0.74, 0.5, M.stone], [Pz.r * 0.46, 0.62, M.stone2], [Pz.r * 0.4, 0.66, M.stone], [4, 0.8, M.stone2]];
    // (paved: each ring's slabs a hair apart in tone, so the ink draws their joints; garden-kit.js paintPaving)
    // (the joints a light line, not a full ink one, and wide slabs: seen at a person's height across the rings,
    // many full-ink joints crowded into dark bands; the sheets draw the plaza pale)
    const TONES = new Map([[M.stone, ['#efe7d4', '#e7ddc8']], [M.stone2, ['#e0d4bc', '#d8cbb1']]]);
    rings.forEach(([r, h, m], i) => {
      const g = new THREE.CylinderGeometry(r, r, h + 0.5, pavingSegments(r, 4.5), 1).toNonIndexed().translate(Pz.x, by + h / 2 - 0.25, Pz.z);
      add(M.paving, paintPaving(g, Pz.x, Pz.z, r, i, { tones: TONES.get(m), side: TONES.get(m)[0], slab: 4.5 }), true);
    });
    add(M.pole, new THREE.CylinderGeometry(0.18, 0.3, 16, 8).translate(Pz.x, by + 8.8, Pz.z), true);
    plaza.ground = by; plaza.top = by + 17.2; plaza.inner = by + 0.8;
    add(M.cream, crescentSphere(0.7, 16, 10, '#f6efd0').translate(Pz.x, by + 17.2, Pz.z));
    avoid.push([Pz.x, Pz.z, Pz.r + 4]);
    // the great sphere setting on the horizon behind the plaza
    sphere(0, -1320, 300, 0, { yellow: true, y: -70 });
  }

  // olive trees and cypresses along the avenue and round the plaza
  const olives = [], cypresses = [];
  yield;
  for (let z = Av.z0; z >= Av.z1; z -= 12) {
    yield;
    for (const s of [-1, 1]) {
      olives.push([s * R(9.5, 10.5), z + R(-1, 1), R(0.9, 1.15)]);
      cypresses.push([s * 17, z - 6, R(0.9, 1.2)]);
      if (rng() < 0.7) cypresses.push([s * R(24, 30), z - R(0, 12), R(1.0, 1.5)]);
    }
  }
  yield;
  for (let i = 0; i < 70; i++) {
    yield;
    const a = rng() * Math.PI * 2, r = R(36, 90), x = Pz.x + Math.cos(a) * r, z = Pz.z + Math.sin(a) * r;
    if (Math.abs(x) < 8 && z > Pz.z) continue;
    olives.push([x, z, R(0.9, 1.3)]);
  }
  yield;
  for (let i = 0; i < 40; i++) {
    yield;
    const a = rng() * Math.PI * 2, r = R(95, 140), x = Pz.x + Math.cos(a) * r, z = Pz.z + Math.sin(a) * r;
    cypresses.push([x, z, R(1.1, 1.7)]);
  }
  // orange-fruit hedges round the plaza
  const fruit = [], hedges = [];
  yield;
  for (let i = 0; i < 64; i++) {
    yield;
    const a = (i / 64) * Math.PI * 2, r = Pz.r + 6;
    if (Math.abs(Math.sin(a)) > 0.97) continue;   // openings north and south (z axis)
    const x = Pz.x + Math.cos(a) * r, z = Pz.z + Math.sin(a) * r;
    if (Math.abs(x) < 5) continue;
    // a clipped hedge along the ring, its fruit on its top and faces (the sheets'; garden-kit.js hedge)
    const ry = Math.PI / 2 - a, y = H(x, z) - 0.15, c = Math.cos(ry), sn = Math.sin(ry);
    hedges.push({ x, y, z, ry, s: 1 });
    for (const [fx, fy, fz] of hedge(i + 1, 3.4, 1.6, 1.9, 9).fruit) fruit.push([x + fx * c + fz * sn, y + fy, z - fx * sn + fz * c]);
    for (let k = 0; k < 12; k++) rng();   // (the draws the old shrubs took: the world's scatter stays where it was)
  }

  // ==========================================================================
  // the android wood: white blocky ruins and a robot statue under dark trees
  // ==========================================================================
  yield;
  {
    const cx = -175, cz = -450;
    const ru = LAYOUT.ruin, rb = terrain.baseAt(ru.x, ru.z, 4) - 0.5;
    const block = new RoundedBoxGeometry(7, 9.5, 6, 2, 0.8).translate(ru.x, rb + 4.75, ru.z);
    proxy(block.clone());   // (as drawn)
    add(M.whiteSmooth, block);
    avoid.push([ru.x, ru.z, 7]);
    for (let i = 0; i < 16; i++) {
      const x = cx + R(-45, 45), z = cz + R(-40, 40);
      if (Math.hypot(x - ru.x, z - ru.z) < 10) continue;
      const w = R(3, 9), h = R(3, 18) * (rng() < 0.4 ? 1.6 : 1), d = R(2, 7), ry = rng() * Math.PI;
      const b = terrain.baseAt(x, z, w * 0.5) - 1;
      const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, d) * 0.12).rotateZ(R(-0.08, 0.08)).rotateY(ry).translate(x, b + h / 2, z);
      proxy(g.clone());   // (as drawn: the upright square stand-in leant the other way, up to 1.4 m off at the top of a tall one)
      add(M.whiteSmooth, g);
      avoid.push([x, z, Math.max(w, d) * 0.7]);
    }
    // the white robot statue, leaning a little
    const sx = -150, sz = -478, sb = terrain.baseAt(sx, sz, 6) - 0.5;
    // (garden-kit.js robotParts: legs and feet, hips, a chest with its plate, shoulder pads, arms to the hands, a domed head)
    const { parts, slots } = robotParts();
    const tilt = new THREE.Matrix4().makeRotationZ(0.06).premultiply(new THREE.Matrix4().makeRotationY(0.5)).premultiply(new THREE.Matrix4().makeTranslation(sx, sb, sz));
    for (const g of parts) {
      g.applyMatrix4(tilt);
      proxy(g.clone());   // (as drawn: each part's bounding box stood outside its rounded sides)
      add(M.whiteSmooth, g);
    }
    for (const g of slots) add(M.cave, g.applyMatrix4(tilt));
    // the ruins' arcades: white walls pierced by round arches, their tops broken (solid as drawn)
    for (const [x, z, ry, bays, span, h, ruin] of [[-205, -428, 0.35, 5, 6.5, 11, 0.5], [-158, -505, -0.7, 3, 7, 13, 0.3], [-122, -455, 1.2, 4, 5.5, 9, 0.6]]) {
      const g = arcade({ bays, span, h, depth: 1.8, pier: 1.6, ruin, seed: x }).rotateY(ry).translate(x, terrain.baseAt(x, z, bays * span * 0.5) - 0.6, z);
      add(M.white, g); proxy(g.clone());
      avoid.push([x, z, bays * span * 0.5 + 2]);
    }
    avoid.push([sx, sz, 9]);
    // white archways through the wood
    for (const [x, z, ry] of [[-110, -412, 1.4], [-205, -470, 0.3]]) {
      const b = H(x, z) - 0.4;
      for (const s of [-1, 1]) {
        const post = new THREE.BoxGeometry(1.6, 9, 1.6).translate(s * 5, 4.5, 0).rotateY(ry).translate(x, b, z);
        add(M.white, post, true);
      }
      add(M.whiteSmooth, new THREE.TorusGeometry(5, 0.8, 8, 24, Math.PI).rotateY(ry).translate(x, b + 9, z), true);
      avoid.push([x, z, 7]);
    }
    // dark round-crowned trees of the wood
    for (let i = 0; i < 70; i++) {
      const x = cx + R(-90, 90), z = cz + R(-80, 80);
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + 4)) continue;
      olives.push([x, z, R(1.6, 2.6), true]);
    }
    for (let i = 0; i < 160; i++) {
      const x = cx + R(-90, 90), z = cz + R(-80, 80);
      shrubs.push({ x, y: H(x, z) - 0.4, z, s: R(1.5, 3.8), dark: true });
    }
  }

  // ==========================================================================
  // shrubs and trees scattered over the meadow
  // ==========================================================================
  yield;
  const clear = (x, z, pad = 2) => !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + pad)
    && lakeE(x, z) > 1.08 && !(Math.abs(x) < 7 && z < 10 && z > -600) && Math.hypot(x - 24, z - 30) > 9 && Math.hypot(x, z) > 7;
  // clumps round the lake shore and in the meadow
  for (let i = 0; i < 650; i++) {
    yield;
    let x, z;
    if (i < 300) { const a = rng() * Math.PI * 2, e = R(1.1, 1.5); x = Lk.x + Math.cos(a) * Lk.rx * e; z = Lk.z + Math.sin(a) * Lk.rz * e; if (z > Lk.z + Lk.rz * 0.6 && Math.abs(x - LAYOUT.view.x) < 40) continue; }
    else { const a = rng() * Math.PI * 2, r = R(30, 700); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    if (!clear(x, z, 3)) continue;
    const n = 1 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const px = x + R(-4, 4), pz = z + R(-4, 4);
      if (!clear(px, pz, 1)) continue;
      shrubs.push({ x: px, y: H(px, pz) - 0.35, z: pz, s: R(1.2, 3.4), dark: rng() < 0.6 });
    }
  }
  // shrubs round the trunks of the umbrella trees
  yield;
  for (const [x, z, r] of avoid.slice()) {
    yield;
    if (r > 6 || rng() < 0.4) continue;
    for (let k = 0; k < 4; k++) {
      const a = rng() * Math.PI * 2, d = r + R(1, 4), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      shrubs.push({ x: px, y: H(px, pz) - 0.3, z: pz, s: R(1.4, 2.8), dark: true });
    }
  }
  // olive groves out in the meadow
  yield;
  for (let i = 0; i < 90; i++) {
    yield;
    const a = rng() * Math.PI * 2, r = R(150, 650), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!clear(x, z, 6) || Math.hypot(x - Hl.x, z - Hl.z) < 80) continue;
    olives.push([x, z, R(1, 1.6)]);
  }

  // ---------------------------------------------------------- the explorations (issue #190, spheres-explorations.js)
  // The author's three picks, one way from the lake to the plaza: the causeway across the mirror lake and the garden it
  // remembers; past its far shore the cracked moon in its crater, at the head of the furrow it ploughed (every great
  // sphere lies at the end of its own, all pointing back to the great sphere), and the sphere west of the arch in a
  // crater of its own; out of the crater, up the pillar forest and along its tops toward the plaza. Built after the
  // meadow's scatter has drawn from the world's rng, so all of that stands where it stood; what it would put in the
  // craters, on the stair's turns or under the pillars is left out where it is drawn (cleared).
  yield;
  const segDist = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0; return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  const onWay = (x, z, pad = 0) => ways.some(({ points, w }) => points.some((p, i) => i && segDist(x, z, points[i - 1], p) < w / 2 + pad));
  const nearPillars = (x, z, pad = 0) => PILLARS.some((p) => Math.hypot(x - p.x, z - p.z) < (p.i === 0 || p.i === PILLARS.length - 1 ? SPIRAL.r + SPIRAL.w : p.plat) + 1 + pad);
  let newWays = [];
  const onNew = (x, z, pad = 0) => newWays.some((points) => points.some((p, i) => i && segDist(x, z, points[i - 1], p) < 1.6 + pad));
  /** Where the meadow's scatter is left out: in the craters, round the pillars and their stairs, on the new ways. */
  const cleared = (x, z, pad = 0) => inCrater(x, z, pad) || nearPillars(x, z, pad) || onNew(x, z, pad);
  const keep = (x, z, pad = 0) => !cleared(x, z, pad) && lakeE(x, z) > 1.12 && !onWay(x, z, pad) && !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + pad)
    && !olives.some(([ox, oz, os]) => Math.hypot(x - ox, z - oz) < 2.5 * os + pad) && !cypresses.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 2 + pad);
  const open = (x, z) => !inCrater(x, z) && lakeE(x, z) > 1.1 && !onWay(x, z, 1);
  const EX = buildExplorations({ add, proxy, sphere, lake: LAYOUT.lake, M, H, terrain, reflect, orbs, W, scene, keep, open, makeMaterial, CRESCENT, WHITE_SHADE, MODE_WATER,
    levels: FALLS.levels, grass: terrain.mesh.material, shellInside: makeMaterial({ color: '#f1e8cc', glow: 0.45 }) });
  // (v1.60, issue #233: four places off the way out in the meadow, each a thing to look at: src/levels/spheres-detours.js)
  const DT = buildDetours({ add, proxy, M, H, makeMaterial });
  // the ways on: from the causeway's landing to the crater's stair; from its other stair to the first pillar's; and from
  // the last pillar's foot to the plaza's north mouth
  const CR = EX.craters.cracked, rimAt = (a, r) => [CR.x + Math.cos(a) * r, CR.z + Math.sin(a) * r];
  const STONES_WAY = [[EX.stones.at(-1).x, EX.stones.at(-1).z], [150, -196], rimAt(CR.stairs[0], CR.rings[3] + 6)];
  path(STONES_WAY, 2.6);
  path([LAKE_PATH.at(-1), [EX.stones[0].x, EX.stones[0].z + 2]], 2.6);   // (from Nell's shore to the first stone)
  const upFoot = EX.spirals.up[0], downFoot = EX.spirals.down[0];
  // (round the stair's outside, under its turns, to come onto its foot along its own line)
  const P1 = PILLARS[0], back = EX.spirals.up[0].clone().sub(EX.spirals.up[1]).setY(0).normalize(), behind = EX.spirals.up[1].clone().addScaledVector(back, 10);
  const PILLAR_WAY = [rimAt(CR.stairs[1], CR.rings[3] + 4), (() => {
    const ar = Math.atan2(CR.z + Math.sin(CR.stairs[1]) * (CR.rings[3] + 4) - P1.z, CR.x + Math.cos(CR.stairs[1]) * (CR.rings[3] + 4) - P1.x), ab = Math.atan2(behind.z - P1.z, behind.x - P1.x);
    const a = ar + Math.atan2(Math.sin(ab - ar), Math.cos(ab - ar)) / 2, r = SPIRAL.r + SPIRAL.w + 3;
    return [P1.x + Math.cos(a) * r, P1.z + Math.sin(a) * r];
  })(), [behind.x, behind.z], [upFoot.x, upFoot.z]];
  path(PILLAR_WAY, 2.6);
  const PLAZA_WAY = [[downFoot.x, downFoot.z], [26, -575], [3, -594]];
  path(PLAZA_WAY, 2.6);
  newWays = [STONES_WAY, PILLAR_WAY, PLAZA_WAY];

  // ---------------------------------------------------------- instanced flora
  yield;
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  // (solid: the drawn instances collide as drawn; otherwise walk-through, or a collideGeo stand-in per instance)
  function instanced(geo, mat, items, { collideGeo = null, solid = false } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const cm = collideGeo ? new THREE.InstancedMesh(collideGeo, new THREE.MeshBasicMaterial(), items.length) : null;
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
      dummy.scale.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (it.color) mesh.setColorAt(i, col.set(it.color));
      if (cm) {
        dummy.scale.set(it.s, it.s, it.s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        cm.setMatrixAt(i, dummy.matrix);
      }
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (!solid) mesh.userData.noCollide = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    if (cm) { cm.visible = false; scene.add(cm); }
    return mesh;
  }
  const lumpy = (detail, amt, seed) => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + amt * noise(x * 1.7 + seed, z * 1.7 + y * 1.3 - seed);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  };
  // round shrubs
  yield;
  {
    // (foliage as clusters of small inked leaf masses: garden-kit.js leafCrown)
    const g = leafCrown(4, { lobes: 3, core: 0.74, size: [0.36, 0.5] });   // (320 faces, a lump's 180: the shrubs are many)
    const DARK = ['#3f6b45', '#355f3c', '#2f5a3a', '#4a7346'], MID = ['#5f8a4f', '#6f9a52', '#7f9a4a'];
    instanced(g, makeMaterial({ color: '#ffffff', pattern: 'leaves' }), shrubs.map((s) => ({
      x: s.x, y: s.y + s.s * 0.45 * (s.sy ?? 1), z: s.z, s: s.s, sy: s.s * (s.sy ?? 0.85), ry: rng() * 6,
      color: s.color ?? (s.dark ? pick(DARK) : pick(MID)),
    })).filter((it) => !cleared(it.x, it.z, it.s) && !footprintVista(it.x, it.z, it.s)));
    instanced(hedge(0, 3.4, 1.6, 1.9).hedge, makeMaterial({ color: '#ffffff', pattern: 'leaves' }), hedges.map((h) => ({ ...h, color: pick(['#4f6f38', '#55763c', '#4a6a36']) })));
    instanced(new THREE.IcosahedronGeometry(0.2, 0), makeMaterial({ color: '#ffffff', glow: 0.3 }), fruit.map(([x, y, z]) => ({ x, y, z, s: 1, color: pick(['#e8872f', '#f0a040', '#e27428']) })));
  }
  // olive trees: reddish twisting trunks under round lumpy crowns
  yield;
  {
    // (one that grew where a crater or a pillar's stair is now steps out of its way, its draws and its place in the list
    // kept: issue #190)
    const stepOut = (it) => {
      for (const C of Object.values(CRATERS)) { const r = Math.hypot(it.x - C.x, it.z - C.z), need = C.rings[3] + 17; if (r < need) { const k = need / Math.max(r, 0.1); it.x = C.x + (it.x - C.x) * k; it.z = C.z + (it.z - C.z) * k; } }
      for (const p of PILLARS) { const r = Math.hypot(it.x - p.x, it.z - p.z), need = (p.i === 0 || p.i === PILLARS.length - 1 ? SPIRAL.r + SPIRAL.w : p.plat) + 5; if (r < need) { const k = need / Math.max(r, 0.1); it.x = p.x + (it.x - p.x) * k; it.z = p.z + (it.z - p.z) * k; } }
      it.y = H(it.x, it.z) - 0.2;
      return it;
    };
    const items = olives.map(([x, z, s, dark]) => ({ x, y: H(x, z) - 0.2, z, s, ry: rng() * 6, dark })).map(stepOut);
    // Keep each surviving tree's instance number as well as its random draws: clearing the
    // Footprint's view must not reshuffle the grove's persistent collision samples.
    const clearOlive = (it) => footprintVista(it.x, it.z, it.s * 3) ? { ...it, s: 0 } : it;
    const trunk = mergeGeometries([
      new THREE.CylinderGeometry(0.22, 0.4, 3.4, 6).rotateZ(0.12).translate(0.1, 1.7, 0).toNonIndexed(),
      new THREE.CylinderGeometry(0.12, 0.2, 1.8, 5).rotateZ(-0.7).translate(0.7, 3.4, 0).toNonIndexed(),
      new THREE.CylinderGeometry(0.12, 0.2, 1.8, 5).rotateX(0.7).translate(0, 3.4, -0.6).toNonIndexed(),
    ].map((g) => prep(g)));
    // (a crown of small leaf masses, each with its own outline, as the sheets draw olives: garden-kit.js leafCrown)
    const crown = mergeGeometries([
      layeredCrown(1).scale(2.3, 2.0, 2.3).translate(0, 5.0, 0),
    ]);   // (round and layered, as the sheets' olives: 800 faces, the four lumps' 720)
    // (the trunk and its two boughs collide as drawn, leaning and turned as each is: an upright 0.4 m post stood
    // in for them, out of the drawn bark at the top and turned the other way; the crown stays walk-through)
    instanced(trunk, makeMaterial({ color: '#ffffff', detail: 'organic' }), items.map((it) => ({ ...it, color: it.dark ? '#6a5a4a' : pick(['#a0593a', '#94523a', '#8a5a40']) })).map(clearOlive),
      { solid: true }).name = 'olive trunks';
    // (the crown is leaves, brushed past; but climbed up its trunk you came out inside it: a convex blob of its
    // core, 20 faces, inside the drawn leaves, is a ceiling the climb stops under (Player.updateClimb) and
    // holds you on top; the whole crown as drawn would be ~640 faces a tree, 155 k for the 243)
    const blob = new THREE.IcosahedronGeometry(1, 0).scale(2.0, 1.3, 2.0).translate(0, 5, 0);
    const cm = instanced(crown, makeMaterial({ color: '#ffffff', pattern: 'leaves' }), items.map((it) => ({ ...it, color: it.dark ? pick(['#3f6b45', '#345e3c', '#4a7346']) : pick(['#7f9a4a', '#8fa85a', '#6f8a44', '#869e4c']) })).map(clearOlive),
      { collideGeo: blob });
    cm.name = 'olive crowns';
    cm.userData.standIn = true;   // (drawn, with a collider standing in for it: src/contact-audit.js)
  }
  // cypresses: tall dark green flames
  yield;
  {
    const g = new THREE.LatheGeometry([[0.01, 0], [0.9, 0.6], [1.5, 3], [1.55, 6], [1.1, 10], [0.5, 13], [0.01, 14.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    jitter(g, 0.14, 0.4, 7);
    // (and the rows along the fallen spheres' furrows, drawn from their own rng: issue #190)
    const own = mulberry32(19071), O = (a, b) => a + own() * (b - a);
    instanced(g, makeMaterial({ color: '#ffffff', pattern: 'leaves' }), cypresses.map(([x, z, s]) => ({
      x, y: H(x, z) - 0.3, z, s, sx: s * R(0.85, 1.1), sz: s * R(0.85, 1.1), sy: s * R(0.9, 1.25), ry: rng() * 6, color: pick(['#4f6b3a', '#43603a', '#587542']),
    })).filter((it) => !cleared(it.x, it.z, 2) && !footprintVista(it.x, it.z, 3)).concat(EX.cypresses.map(([x, z, s]) => ({
      x, y: H(x, z) - 0.3, z, s, sx: s * O(0.85, 1.1), sz: s * O(0.85, 1.1), sy: s * O(1.0, 1.4), ry: own() * 6, color: ['#4f6b3a', '#43603a', '#587542'][Math.floor(own() * 3)],
    }))), { solid: true }).name = 'cypresses';   // (a dense flame of a tree: it collides as drawn, where a 0.9 m post 6 m tall stood inside it)
  }
  // grass tufts (drawn as the sheets draw soft things: a line in a dark shade of their own green, a hairline from afar,
  // and lit as the ground they stand in, so the blades crossing in a tuft draw no creases; in black, every thin blade's
  // outline came and went as the camera moved a third of a pixel: the motion check's pan 21 flickering pixels per
  // 10 000, two thirds of them the tufts; visual-v1.85 finding 3, issue #504)
  yield;
  {
    const blades = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2, t = new THREE.BufferGeometry();
      const lean = 0.25 + 0.15 * k % 2;
      t.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, lean, 0.9 + k * 0.08, 0.05], 3));
      t.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      blades.push(t.rotateY(a));
    }
    const g = mergeGeometries(blades);
    const items = [];
    for (let i = 0; i < 5000; i++) {
      const near = i < 2200, a = rng() * Math.PI * 2, r = near ? Math.sqrt(rng()) * 160 : R(160, 650);
      const x = Math.cos(a) * r + (near ? 0 : 0), z = Math.sin(a) * r - (near ? 40 : 200);
      if (lakeE(x, z) < 1.05 || Math.abs(x) < 4 && z < 0 && z > -600) continue;
      items.push({ x, y: H(x, z) - 0.05, z, s: R(0.35, 0.7), ry: rng() * 6, color: pick(['#a9c04f', '#b5c94f', '#9fb84a']) });
    }
    instanced(g, makeMaterial({ color: '#ffffff', side: THREE.DoubleSide, ...TUFT_LINE }), items.filter((it) => !cleared(it.x, it.z))).name = 'grass tufts';
  }

  // ==========================================================================
  // mirror lake: the far shore (and the garden it remembers, issue #190) in the water. Each piece is drawn as its
  // reflection from wherever the eye is (makeMaterial({ mirror }): mirrored in the water's plane in the vertex
  // shader and laid on the water along the line of sight), lit as the thing itself is; one mesh a colour.
  // ==========================================================================
  yield;
  {
    // (memory: the garden before the fall, only in the water, issue #190: spheres-explorations.js)
    const COLS = { white: ['#e4f0ec', '#d6ebe6'], sphere: ['#eef0d8', '#e2eadb'], tree: ['#5f8a74', '#587f6c'], memory: ['#f6edd3', '#efe4c6'], memoryTree: ['#86a37c', '#7d9a74'] };   // (warmer than the shore's: a garden that isn't there)
    const byKey = {};
    for (const r of reflect) {
      const g = r.geo.index ? r.geo.toNonIndexed() : r.geo.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      // (mirrored, the image is inside out: its winding flipped, so the faces turned to the eye are its front ones)
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]]; [n[i + 3 + k], n[i + 6 + k]] = [n[i + 6 + k], n[i + 3 + k]]; }
      (byKey[r.key] ??= []).push(g);
    }
    for (const [key, list] of Object.entries(byKey)) {
      const m = new THREE.Mesh(mergeGeometries(list), makeMaterial({ color: COLS[key][0], color2: COLS[key][1], mode: MODE_WATER, waterPrint: true, mirror: { y: W, lake: [Lk.x, Lk.z, Lk.rx * 1.08, Lk.rz * 1.08] } }));
      m.name = `the lake’s reflection: ${key}`;
      m.userData.noCollide = true; m.userData.castShadow = false; m.userData.reflection = key;
      m.frustumCulled = false;   // (drawn on the water, away from where its vertices stand)
      scene.add(m);
    }
  }

  // ---------------------------------------------------------- the fifth round of the level design audit
  // The meadow path home: from the sphere-arch's north mouth west round the meadow pyramid's east face to the foot of
  // its stair, where the old pyramid path runs on to the grove. Ume sends you home by it (the 'ume' stage's home), past
  // the pyramid where Emrys stands shouting about the view and the little sphere at its stair's foot he practises on,
  // its side printed with his hands all the way up. And halfway down the avenue, where it ran 170 m with nothing on
  // it, two small spheres face each other across the road: splash one and both ring, a fifth apart.
  yield;
  const MEADOW_PATH = [[-2, -258], [-14, -232], [-22, -195], [-25, -150], [-36, -128], [MP.x, MP.z + MP.half + 12]];
  path(MEADOW_PATH, 2.4);
  const MEADOW_LINE = [...AVENUE].reverse().concat(MEADOW_PATH, [[MP.x, -110], [-24, -64], [-2, -30], [0, 8]]);   // (Ume's way home: the audit's line)
  const CHALKED = { x: -40, z: -116, R: 2.6 };
  const chalkY = sphere(CHALKED.x, CHALKED.z, CHALKED.R, 0.45, { seg: 28 });   // (small: fewer facets, the collision budget)
  {
    // his hands: small dark prints in pairs, climbing the side that faces the stair, then over the top
    const prints = [];
    const toStair = Math.atan2(MP.x - CHALKED.x, MP.z + MP.half - CHALKED.z);
    for (let k = 0; k < 9; k++) {
      const el = -0.15 + k * 0.2, side = k % 2 ? 0.16 : -0.16;
      const n = new THREE.Vector3(Math.sin(toStair + side) * Math.cos(el), Math.sin(el), Math.cos(toStair + side) * Math.cos(el));
      const g = new THREE.CylinderGeometry(0.11, 0.13, 0.02, 7).scale(1, 1, 1.35);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
      prints.push(g.translate(CHALKED.x + n.x * (CHALKED.R + 0.005), chalkY + n.y * (CHALKED.R + 0.005), CHALKED.z + n.z * (CHALKED.R + 0.005)).toNonIndexed());
    }
    const m = new THREE.Mesh(mergeGeometries(prints), makeMaterial({ color: '#5f7a6c', flat: true }));
    m.userData.noCollide = true;
    scene.add(m);
  }
  const ANSWERING = [[-6.4, -480, 1.5], [6.4, -480, 1.25]];   // (between two pairs of the avenue's olives, z -474 and -486)
  for (const [x, z, Rs] of ANSWERING) sphere(x, z, Rs, 0.5, { seg: 24 });

  // ---------------------------------------------------------- the hill path and the belvedere's bell
  // (level design audit v1.49, issue #134: the belvedere stood 154 m off the path and 161 m from anything, a lone climb
  // with nothing at the top.) A white path branches off the meadow path's end, west past the hill tree's north to the
  // foot of the white hill's stair, where a little sphere sits beside it; splash it and the bell on the belvedere's deck
  // answers from 80 m up. Up there, ring the bell and the garden's spheres answer it one after another, outward from the
  // hill (src/story/spheres.js).
  yield;
  const stairFoot = Hl.z + Hl.r[0] * 1.06 + Math.ceil(Hl.top[0] / 0.4) * 0.42;   // (the first flight's foot: the stairs above)
  const HILL_PATH = [[MP.x, MP.z + MP.half + 12], [-100, -112], [-150, -96], [-192, -72], [Hl.x + 3, stairFoot + 4]];
  path(HILL_PATH, 2.2);
  const HILL_SPHERE = { x: Hl.x + 9, z: stairFoot + 7, R: 1.7 };
  const hillSphereY = sphere(HILL_SPHERE.x, HILL_SPHERE.z, HILL_SPHERE.R, 0.5, { seg: 24 });
  const deckY = hillBase + Hl.top[2] + LAYOUT.hillPyr.height + BELVEDERE.h;
  const BELL = { x: Hl.x + 0.75, z: Hl.z - 0.75, R: 0.42 };
  const bellY = deckY + 2.5;
  sphere(BELL.x, BELL.z, BELL.R, 0, { y: bellY, yellow: true, collide: false, seg: 16 });
  // (its arm off the belvedere's mast)
  add(M.pole, new THREE.BoxGeometry(0.06, 0.06, 1.1).rotateY(Math.PI / 4).translate(Hl.x + 0.38, bellY + BELL.R + 0.05, Hl.z - 0.38));
  add(M.pole, new THREE.CylinderGeometry(0.015, 0.015, 0.1, 3).translate(BELL.x, bellY + BELL.R + 0.02, BELL.z));
  // and a long yellow streamer off the mast's top, broadside to the meadow path: what moves up there, seen from below
  const streamer = (() => {
    const L = 20, tail = new THREE.PlaneGeometry(L, 2, 24, 1).translate(L / 2, 0, 0), p = tail.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) * (1 - 0.85 * u) - 1.4 * u); p.setZ(i, Math.sin(u * 6) * 0.8 * u); }
    tail.computeVertexNormals();
    const mat = makeMaterial({ color: '#f1cc5c', flat: true });
    mat.side = THREE.DoubleSide;
    const m = new THREE.Mesh(tail, mat);
    m.position.set(Hl.x, deckY + 8.7, Hl.z); m.rotation.y = -Math.PI / 2 + 0.25;
    m.userData.noCollide = true;
    m.name = 'The belvedere’s streamer';
    scene.add(m);
    return m;
  })();

  // ---------------------------------------------------------- the heel path and the keepers' stone
  // (level design audit v1.53, issue #178: the route went on to the Footprint across 680 m with nothing near, and came
  // home from its door the same 336 m, past nothing.) A pale path from the landing, behind the ship, north-west to the
  // Footprint's porch, past a little Footprint pressed in the grass (its toes point the way, a small sphere in its heel:
  // the shape you are going to, seen small first) and a tall white stone. And the way home is another: past the Echo,
  // the hall's way out comes up through the keepers' stone by the white hill's stair (src/temples/spheres.js
  // KEEPERS_STONE), and the hill's path runs east from it to the grove.
  yield;
  const FP = { x: FOOTPRINT.x + Math.sin(FOOTPRINT.heading) * 27, z: FOOTPRINT.z + Math.cos(FOOTPRINT.heading) * 27 };   // (the porch's front)
  const HEEL_PATH = [[0, 8], [-10, 30], [-44, 62], [-92, 100], [-140, 140], [-188, 184], [FP.x, FP.z]];
  path(HEEL_PATH, 2.4);
  const toesDir = [Math.sin(FOOTPRINT.heading + Math.PI), Math.cos(FOOTPRINT.heading + Math.PI)];   // (away from the grove, as the big print's toes)
  const LITTLE = { x: -86, z: 78, R: 2.2 };
  const littleY = sphere(LITTLE.x, LITTLE.z, LITTLE.R, 0.5, { seg: 24 });
  {
    // its rim: low white stones round the heel and the three toes (as the Footprint's, src/temples/spheres.js exterior)
    const [dx, dz] = toesDir, sx = dz, sz = -dx;
    const at = (lx, lz) => [LITTLE.x + sx * lx + dx * lz, LITTLE.z + sz * lx + dz * lz];
    const rim = [];
    const outline = (pts) => {
      for (let i = 0; i < pts.length; i++) {
        const [ax, az] = at(...pts[i]), [bx, bz] = at(...pts[(i + 1) % pts.length]);
        const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        rim.push(new THREE.BoxGeometry(0.45, 0.35, L + 0.12).rotateY(Math.atan2(bx - ax, bz - az)).translate(mx, H(mx, mz) + 0.1, mz));
      }
    };
    outline(Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [Math.sin(a) * 3.6, Math.cos(a) * 3.2 - 0.4]; }));
    for (const [a, len, w] of [[-0.55, 8.5, 1.4], [0, 10, 1.6], [0.55, 8.5, 1.4]]) {
      const d = [Math.sin(a), Math.cos(a)], side = [d[1], -d[0]], base = [d[0] * 3.9, d[1] * 3.9 - 0.4], pts = [];
      for (let i = 0; i <= 6; i++) { const k = i / 6, ww = w * (1 - k * 0.55); pts.push([base[0] + d[0] * len * k + side[0] * ww, base[1] + d[1] * len * k + side[1] * ww]); }
      for (let i = 6; i >= 0; i--) { const k = i / 6, ww = w * (1 - k * 0.55); pts.push([base[0] + d[0] * len * k - side[0] * ww, base[1] + d[1] * len * k - side[1] * ww]); }
      outline(pts);
    }
    for (const g of rim) add(M.white, g);   // (drawn only: a step you walk over)
  }
  const TALL = { x: -158, z: 166 };
  monolith(TALL.x, TALL.z, 16, 3.4, 0.6);
  // the keepers' stone: a round white slab flush with the grass, ringed in the Footprint's sage, the walker's print on it
  // pointing back to the Footprint (drawn only: you come up onto it)
  const KS = KEEPERS_STONE, ksY = H(KS.x, KS.z);
  const onFloor = ([x, z]) => [x, H(x, z), z];
  // (home from it: onto the hill's path beside it, east along it to the grove and the ship)
  const HOME_WAY = [[KS.x, KS.z], [KS.x, -57], ...HILL_WAY.slice(0, 3).reverse(), [0, 8]];
  // the way the explorations make (issue #190): from the pearl by the lake along the lake path to the south shore, over
  // the causeway, to the cracked moon's crater, down its terraces, in through the crack and round the moon, up the other
  // stair, up the first pillar's spiral, along the walkways over the tops, down the last one's spiral and on to the plaza
  const HIGH_WAY = (() => {
    const C = EX.craters.cracked, [rf, r1, r2, rr] = C.rings, lv = C.levels, at = (a, r, y) => [C.x + Math.cos(a) * r, y, C.z + Math.sin(a) * r];
    const [a0, a1] = C.stairs, sweep = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
    const down = [at(a0, rr + 6, lv[3]), at(a0, r2 + 0.5, lv[3]), at(a0, r2 - 3.8, lv[2]), at(a0, r1 - 3.8, lv[1]), at(a0, rf - 3.8, lv[0])];
    // (past the crack's threshold: in and out again is the moon's own, 30 m the audit's slack has no room for)
    const inside = [at(C.face, C.R + 1.5, lv[0])];
    const round = Array.from({ length: 6 }, (_, i) => at(a0 + (sweep * (i + 1)) / 7, rf - 3.5, lv[0]));
    const up = [at(a1, rf - 3.8, lv[0]), at(a1, rf + 0.5, lv[1]), at(a1, r1 + 0.5, lv[2]), at(a1, r2 + 0.5, lv[3]), at(a1, rr + 4, lv[3]), ...PILLAR_WAY.slice(1, -1).map(onFloor)];
    const every = (pts, n) => pts.filter((_, i) => i % n === 0 || i === pts.length - 1).map((p) => p.toArray());
    return [[LAYOUT.pearl.x, H(LAYOUT.pearl.x, LAYOUT.pearl.z + LAYOUT.pearl.R + 4), LAYOUT.pearl.z + LAYOUT.pearl.R + 4], onFloor(LAKE_PATH[2]), onFloor([EX.stones[0].x - 3, EX.stones[0].z + 7]),
      ...EX.stones.map((q) => [q.x, q.top, q.z]), onFloor(STONES_WAY[1]), ...down, ...inside, ...round, ...up,
      ...every(EX.spirals.up, 4), ...EX.pillars.map((q) => [q.x, q.top, q.z]), ...every(EX.spirals.down.slice().reverse(), 4),
      ...PLAZA_WAY.slice(1).map(onFloor), [plaza.x, plaza.ground, plaza.z + plaza.r - 4]];
  })();
  {
    const sage = makeMaterial({ color: '#8fb39c', flat: true });
    const toFp = Math.atan2(FOOTPRINT.x - KS.x, FOOTPRINT.z - KS.z);
    add(M.white, new THREE.CylinderGeometry(KS.r, KS.r + 0.1, 0.3, 28).translate(KS.x, ksY + 0.02, KS.z));
    add(sage, new THREE.TorusGeometry(KS.r + 0.02, 0.08, 4, 28).rotateX(Math.PI / 2).translate(KS.x, ksY + 0.17, KS.z));
    add(sage, printGeometry(3, 2.1).rotateY(toFp).translate(KS.x, ksY + 0.18, KS.z));
  }

  // ---------------------------------------------------------- flush batches
  yield;
  for (const { mat, collide, list } of batches.values()) {
    yield;
    const m = new THREE.Mesh(mergeGeometries(padForm(list)), mat);
    if (!collide) m.userData.noCollide = true;
    scene.add(m);
  }
  const col3 = new THREE.Mesh(mergeGeometries(proxies), new THREE.MeshBasicMaterial());
  col3.visible = false;
  col3.name = 'collision proxies';
  scene.add(col3);

  // (the lake's deep water; not the craters, whose ground under the terraces lies as low: issue #190)
  const unsafe = (p) => lakeE(p.x, p.z) < 1.3 && terrain.heightAt(p.x, p.z) < W - 1.1 && p.y < W + 0.4;

  const orb = (x, z) => orbs.find((o) => Math.hypot(o.x - x, o.z - z) < 1);
  // Hale's Listening Stall (src/shop-world.js, src/shop-fronts.js 'pavilion'): a round white pavilion beside the
  // path from the grove to the sphere-arch and the cypress avenue (its long empty middle, docs/audits/level-design-v1.9.md),
  // 11 m off it, its door turned to the path
  const shop = placeShop(scene, { def: SHOPS.listening, at: new THREE.Vector3(13, terrain.heightAt(13, -175), -175), heading: -Math.PI / 2 + 0.25 });
  // the Footprint north of the grove, and its rooms far overhead (src/temples/spheres.js)
  yield;
  return attachTempleDefinition('spheres', { def: SPHERES_TEMPLE, words: SPHERES_WORDS }, scene, {
    id: 'spheres',
    portals: [...shop.portals],
    lights: [...shop.lights],
    shops: [shop],   // (src/story/shops.js: the keeper behind the counter; main.js: the shop panel)
    paved: pavedMask({ discs: [{ x: plaza.x, z: plaza.z, r: plaza.r + 1 }], ways }),   // the white paths, the avenue and the plaza: no flowers on them (src/paved.js)
    floraAvoid: shop.avoid((x, z, r) => !clear(x, z, r + 1) || cleared(x, z, r) || footprintVista(x, z, r)),   // the flora keeps off the lake, the paths, the stones and the shop (src/flora.js)
    // what the level design audit reads (scripts/level-design/audit.mjs): the white paths, leading lines: from the lake
    // (the spheres that remember) to the grove's path, through the sphere-arch and down the avenue to the plaza
    lines: [{ name: 'the white path and the avenue', points: [...LAKE_PATH].reverse().concat(WAY.slice(1), AVENUE.slice(1)) },
      // (fifth round: the meadow path home, from the plaza back up the avenue, through the arch, round the meadow pyramid and
      //  up the pyramid path to the grove; followed only where Ume sends you along it)
      { name: 'the meadow path', points: MEADOW_LINE, auto: false },
      // (v1.50, issue #134: the hill path, from the meadow path's end to the white hill's stair)
      { name: 'the hill path', points: HILL_PATH },
      // (v1.54, issue #178: the heel path, from the landing to the Footprint's porch; walked on from Ume's way home, the
      //  meadow path, from the plaza to the Footprint: the route's way in; and home from the keepers' stone by the white
      //  hill's path, as the route's last way out names it, tests/playthrough-worlds.js ROUTE)
      //  (on the ground: [x, y, z], not the canopies over them)
      { name: 'the heel path', points: HEEL_PATH.map(onFloor) },
      { name: 'the meadow path and the heel path', points: [[plaza.x, plaza.z + plaza.r], ...MEADOW_LINE, ...HEEL_PATH.slice(1)].map(onFloor) },
      { name: 'the white hill path', points: HOME_WAY.map(onFloor), auto: false },
      // (v1.56, issue #190: over the lake's stones, through the cracked moon's crater and over the pillar forest's tops to
      //  the plaza, the way the main quest's words send you now)
      { name: 'the lake’s stones and the high walk', points: HIGH_WAY }],
    // (v1.56, issue #190: the pillars of the forest, thin to the audit's height grid)
    beacons: EX.beacons,
    sights: [{ name: 'the chalked sphere', at: new THREE.Vector3(CHALKED.x, chalkY + CHALKED.R, CHALKED.z) }, { name: 'the answering spheres', at: new THREE.Vector3(0, H(0, -480) + 1, -480) },
      // (v1.46: the belvedere on the white hill's summit, the garden's highest place, 80 m up)
      { name: 'the belvedere on the white hill', at: belvedereTop },
      // (v1.50: the little sphere at the hill's foot, answered by the bell on the belvedere: issue #134)
      { name: 'the sphere at the white hill’s foot', at: new THREE.Vector3(HILL_SPHERE.x, hillSphereY - HILL_SPHERE.R * 0.5 + 0.5, HILL_SPHERE.z + HILL_SPHERE.R + 1) },
      // (v1.54, issue #178: on the heel path, and the way out by the white hill)
      { name: 'the little Footprint', at: new THREE.Vector3(LITTLE.x, H(LITTLE.x, LITTLE.z) + 1, LITTLE.z) },
      { name: 'the tall white stone', at: new THREE.Vector3(TALL.x, H(TALL.x, TALL.z) + 1, TALL.z) },
      { name: 'the keepers’ stone', at: new THREE.Vector3(KS.x, ksY + 0.3, KS.z) },
      // (v1.56, issue #190: the explorations)
      { name: 'the first stepping stone', at: new THREE.Vector3(EX.stones[0].x, EX.stones[0].top, EX.stones[0].z) },
      { name: 'the middle of the lake’s stones', at: EX.lake.look.stand.clone() },
      { name: 'the cracked moon', at: new THREE.Vector3(EX.cracked.x + Math.cos(EX.cracked.face) * (EX.cracked.R + 1.5), EX.cracked.floor, EX.cracked.z + Math.sin(EX.cracked.face) * (EX.cracked.R + 1.5)) },
      { name: 'the founders’ mark', at: EX.cracked.mark.stand.clone() },
      { name: 'the terraces round the sphere west of the arch', at: new THREE.Vector3(...(() => { const C = EX.craters.chant, a = C.stairs[0]; return [C.x + Math.cos(a) * (C.rings[2] + 1), C.y0, C.z + Math.sin(a) * (C.rings[2] + 1)]; })()) },
      ...EX.sights, ...DT.sights],
    detours: DT.detours,
    // the story's handles (src/story/spheres.js): the spheres that remember, the plaza and its pole,
    // the great sphere on the horizon, the lake, the avenue
    spheres: {
      orbs, plaza, lake: { ...LAYOUT.lake, level: W }, avenue: { ...LAYOUT.avenue }, arch: { ...LAYOUT.arch },
      listen: { bell: orb(LAYOUT.pearl.x, LAYOUT.pearl.z), chant: orb(-120, -262), drum: orb(380, -320) },
      answering: ANSWERING.map(([x, z]) => orb(x, z)),   // (the avenue's pair: splash one and the other answers, src/story/spheres.js)
      // (the white hill's: the little sphere at its foot and the bell on the belvedere, which answer each other)
      hill: { foot: orb(HILL_SPHERE.x, HILL_SPHERE.z), bell: orbs.find((o) => o.y === bellY && Math.hypot(o.x - BELL.x, o.z - BELL.z) < 0.1) },
      great: orb(0, -1320),
      // (v1.54, issue #178: the heel path to the Footprint, what stands on it, and the keepers' stone it lets you out by)
      heel: { path: HEEL_PATH, little: { ...LITTLE, y: littleY }, tall: { ...TALL, h: 16 }, stone: { ...KS, y: ksY }, home: HOME_WAY },
      // (v1.56, issue #190: the explorations, src/story/spheres-explorations.js)
      explore: { ...EX, belvedere: belvedereTop, way: HIGH_WAY, chant: orb(CRATERS.chant.x, CRATERS.chant.z), high: EX.pillars.map((q) => orb(q.sphere.x, q.sphere.z)), moon: orbs.find((o) => o.cracked) },
    },
    ground: terrain,
    spawn: new THREE.Vector3(0, H(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: false, climb: true },
    defaults: {
      hour: 8.5, preset: 'Moebius print', cloudShadows: 0,
      look: SPHERES_LOOK,
    },
    sky: {
      script: {
        day: SPHERES_DAY,     // pale blue over a blush horizon
        dusk: ['#a9b4d8', '#f6c4ae', '#9b9cc8', '#ffe6d0', '#fff0d6'],
        night: ['#1c2a50', '#3c4f80', '#34407a', '#9ab0d8', '#f2f0e6'],
      },
      planets: [{ az: 95, el: 24, size: 7, color: '#f6efd0', craters: false }, { az: 40, el: 12, size: 3, color: '#f3e3a0', craters: false }],
    },
    killY: -Infinity,
    unsafe,
    life: {
      flocks: [{ count: 14, color: '#f6efd0', size: 1.3, radius: 80, height: [18, 50], seed: 3 },
               { count: 10, color: '#2b211f', size: 1.0, radius: 130, height: [30, 70], speed: -0.12, seed: 9 }],
      motes: { count: 180, color: '#fffbe8', size: 0.045, rise: 0.12, wind: [0.4, 0.15] },
      footprints: '#9fb04a',
    },
    // (up on the pillar forest's tops, its own name: issue #190)
    atmo: (x, z, y = -Infinity) => ({ tint: [1.0, 0.99, 1.0], fog: 0.55, name: y > 18 && nearPillars(x, z, 40) && x > 20 ? 'Garden of Spheres · the pillar forest' : 'Garden of Spheres' }),
    update(dt, t) { streamer.rotation.y = -Math.PI / 2 + 0.25 + Math.sin((t ?? 0) * 0.8) * 0.2; streamer.rotation.x = Math.sin((t ?? 0) * 1.3) * 0.18; },
  });
}
export const createSpheres = stepped(buildSpheres);
