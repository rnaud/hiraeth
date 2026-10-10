import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { bankBush } from './wood-kit.js';
import { walkway } from './mangrove-kit.js';
import { groundRibbon } from './reference-kit.js';
import { mergeWithMaterials, restKey } from '../vertex-material.js';
import { PEOPLE as HANGAR_PEOPLE } from './dismissed/hangar/story-data.js';
import { STREET as BAZAAR_STREET } from '../story/bazaar-data.js';
import {
  latticeTower, dish, saucer, aimAt, dirOf, column, dome, egg, vineCable, cable, trussStair, deck, bird, rimSpots, bar, moveParts, tipToward,
  unitPole, unitSaucer, unitDish, FAR_MIN_R, ANTENNAS_LOOK, ANTENNAS_DAY, ANTENNAS_TONES,
} from './antennas-kit.js';

// ---------------------------------------------------------------------------
// The Forest of Antennas: abandoned radio masts by the thousand on a rolling plain of violet grass, great
// dishes tilted like flowers, lattice towers joined by vine-grown cables, birds nesting in the dishes, and a
// small settlement of rounded repair workshops under one immense receiver (references/levels/The Forest of Antennas/;
// its views in the References, reference-antennas.js; the shapes in antennas-kit.js). Off the route: no story
// to follow, a few people to meet.
//
// The layout: the ship lands on a low rise in the south; a path winds north through the masts to the
// workshops on their mound, round a plaza under the receiver (its dish 24 m round on a column, its face
// turned to the path); beside them the observation tower, two flights of stairs to its deck 20 m up and a
// maintenance bridge from there to the balcony round the receiver's turret; west, a second hamlet under a
// great nest saucer on its egg; a fallen dish in the grass by the path, walked into. The masts and dishes
// stand all round, thinning out into the forest beyond (instanced, toned paler with distance).
//
// Collision only where walkable: the terrain, the workshops, the egg, the decks, stairs and bridge, the
// receiver's column, turret and dish, the fallen dish. A mast or a dish's lattice is drawn only; an invisible
// cone round its foot (too steep to stand on or climb: the contact audit samples neither) keeps you out of it.
// ---------------------------------------------------------------------------

const T = ANTENNAS_TONES;
export const SHIP = { x: 0, z: 150 };
export const SETTLEMENT = { x: 40, z: -66, r: 40, h: 3.2 };
export const RECEIVER = { x: 62, z: -98, R: 24, turret: 14 };
export const OBS = { x: 18, z: -104, top: 12 };                    // the observation tower: its deck's height
export const HAMLET = { x: -78, z: -28 };                           // the second hamlet, under the great saucer
export const FALLEN = { x: -26, z: 62, R: 9 };                      // the fallen dish by the path
/** The path from the ship to the plaza, [x, z] points. */
export const PATH = [[0, 122], [-7, 106], [-2, 86], [10, 58], [8, 30], [15, 4], [24, -22], [32, -42], [38, -54]];
/** The branch to the hamlet under the great saucer. */
export const BRANCH = [[13, 14], [-6, 2], [-30, -8], [-52, -18], [-66, -24]];
const LIMIT = 300;

const noise = createNoise2D(52101), noiseB = createNoise2D(52102);
const sq = (x) => x * x;
/** The plain: low rolling swells, the settlement's mound and the ship's rise, the land closing in hills past the forest. */
export function height(x, z) {
  let h = fbm(noise, x * 0.006, z * 0.006, 3) * 3.2 + noiseB(x * 0.03, z * 0.03) * 0.25;
  h += SETTLEMENT.h * smoothstep(SETTLEMENT.r, SETTLEMENT.r * 0.55, Math.hypot(x - SETTLEMENT.x, z - SETTLEMENT.z));
  h += 1.2 * smoothstep(34, 14, Math.hypot(x - SHIP.x, z - SHIP.z));
  h += 1.4 * smoothstep(30, 16, Math.hypot(x - HAMLET.x, z - HAMLET.z));
  const e = Math.hypot(x, z * 0.95);
  h += smoothstep(560, 760, e) * (16 + fbm(noiseB, x * 0.004, z * 0.004, 3) * 14);
  return h;
}
/** How near (m) a point is to a polyline of [x, z] points. */
function nearLine(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
/** The open ground kept clear of the forest: the paths, the settlement, the hamlet, the ship, the fallen dish. */
export function clear(x, z, r = 0) {
  return nearLine(PATH, x, z) < 7 + r || nearLine(BRANCH, x, z) < 6 + r
    || Math.hypot(x - SETTLEMENT.x, z - SETTLEMENT.z) < 46 + r || Math.hypot(x - RECEIVER.x, z - RECEIVER.z) < 30 + r
    || Math.hypot(x - OBS.x, z - OBS.z) < 14 + r || Math.hypot(x - HAMLET.x, z - HAMLET.z) < 34 + r
    || Math.hypot(x - SHIP.x, z - SHIP.z) < 28 + r || Math.hypot(x - FALLEN.x, z - FALLEN.z) < FALLEN.R + 6 + r;
}

// ------------------------------------------------------------------ the forest, laid out (pure: the tests read it)
/**
 * The masts and dishes standing in the walked land (within LIMIT): [{ kind: 'mast' | 'dish', x, z, ... }]. Masts
 * carry a nest saucer, a dish, a spike or nothing; dishes stand on lattice legs, tilted every way.
 */
export function forestLayout(seed = 52110) {
  const rng = mulberry32(seed), out = [], R = (a, b) => a + rng() * (b - a);
  const room = (x, z, r) => out.every((o) => Math.hypot(o.x - x, o.z - z) > r + o.r);
  for (let tries = 0; tries < 4000 && out.length < 92; tries++) {
    const a = rng() * Math.PI * 2, d = 24 + Math.sqrt(rng()) * (LIMIT - 10), x = Math.cos(a) * d, z = Math.sin(a) * d - 10;
    const dishy = rng() < 0.32, r = dishy ? R(5, 11) : R(1.4, 2.4);
    if (clear(x, z, r + 2) || !room(x, z, r + 9)) continue;
    if (dishy) out.push({ kind: 'dish', x, z, r, R: r, up: R(0.25, 1.2), az: rng() * Math.PI * 2, y: R(0.9, 1.5) * r + 3, seed: tries });
    else {
      const u = rng(), h = R(14, 26) + (u > 0.85 ? R(14, 26) : 0);
      out.push({ kind: 'mast', x, z, r, h, w0: r, w1: R(0.35, 0.6), legs: rng() < 0.55 ? 4 : 3, vines: R(0.2, 1), seed: tries,
        top: u < 0.55 ? 'saucer' : u < 0.72 ? 'dish' : u < 0.88 ? 'spike' : 'none', R: R(2.2, 5.5), birds: Math.floor(R(0, 9)) });
    }
  }
  return out;
}

export const ANTENNAS_CONTENT = {
  weather: ['fog'],
  // no story to follow: the page names the place and closes on the observation tower's deck
  story: {
    title: 'THE FOREST OF ANTENNAS',
    intro: 'Masts by the thousand, dishes turned up like flowers, and nobody sending. The workshops under the great receiver still keep the lamps lit.',
    outro: 'From the deck the whole forest shows, mast after mast to the haze. Every dish still listening, the birds in them, and the hum of it all.',
    label: 'the observation deck', goal: [OBS.x, OBS.top, OBS.z], radius: 4, verticalRadius: 3, manual: true,   // (no beacon: nothing to do here but look)
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere who came to hear the forest, and its own folk at the workshops and along the path
  npcs: [
    { ...HANGAR_PEOPLE.lune, at: [OBS.x - 1.5, OBS.z + 1.2], y: OBS.top + 0.15, radius: 1, kind: 'f', world: 'garage', lang: 'garage',
      lines: ['~curious~ Listen. Every one of them is still turned to something.', '~happy~ From up here you can hear the whole forest humming.'],
      talk: { listen: [
        '~curious~ Lune. I read the signal in the Sealed Hangar, the one nobody could read. I came to find where signals go when nobody answers.',
        '~neutral~ They come here. Every dish in this forest is still turned to something, a star, a ship, a voice from before.',
        '~whisper~ At night the receiver hums louder. Put your hand on the rail and you can feel it.',
        { after: 'met.lune', say: '~playful~ Still here. The bridge goes over to the receiver’s balcony. Mind the birds, they think it’s theirs.' },
      ] } },
    { ...HANGAR_PEOPLE.ottla, at: [SETTLEMENT.x - 6, SETTLEMENT.z + 9], radius: 1.5, kind: 'f', world: 'garage', lang: 'garage',
      lines: ['~neutral~ That one’s not broken. It’s listening.', '~angry~ Who rewired the plaza lamp to a dish? Nobody? Again?'],
      talk: { listen: [
        '~happy~ Ottla, mechanic of everything. Everything here is a lot of things. I may never leave.',
        '~curious~ They keep the masts standing out of habit, the folk here. One falls, they put a new one up. Nobody asks what it’s for.',
        '~playful~ The birds nest in the dishes. I asked them to move. They asked me to move. We’re negotiating.',
      ] } },
    { ...BAZAAR_STREET.teb, at: [SHIP.x - 7, SHIP.z - 32], radius: 2, kind: 'm', world: 'bazaar', lang: 'bazaar',
      lines: ['~shout~ Cab! Cab! No cabs. Nothing to wave at but masts.', '~playful~ The quiet here is the loudest thing I ever heard.'],
      talk: { listen: [
        '~neutral~ Teb. I tout cabs in the Signal Market. A man needs a holiday from shouting.',
        '~curious~ Follow the path north. The workshops are under the big dish. You can’t miss it, it’s been trying to get your attention since you landed.',
        '~whisper~ The masts out here hum. Same note as our broadcast tower, before it went quiet. I don’t like to think about that.',
      ] } },
    // the forest's own folk
    { at: [SETTLEMENT.x + 6, SETTLEMENT.z + 4], radius: 3, lang: 'garage', lines: ['~happy~ The lamps are lit. Somebody’s always mending something.', '~neutral~ The receiver turns a little every night. Nobody turns it.'] },
    // (Grete: the detour's trace, src/story/sightings-detours.js)
    { id: 'grete', name: 'Grete', title: 'whose grandmother kept the dish', color: '#8fae7a', kind: 'f', at: [SETTLEMENT.x - 7, SETTLEMENT.z - 2], radius: 2, lang: 'garage',
      lines: ['~curious~ You came by the sky? Did you hear us on the way down?', '~solemn~ My grandmother kept that dish. Now the birds do.'],
      talk: { listen: [
        { after: () => true, say: [
          '~solemn~ My grandmother’s dish once caught a man’s voice from very far. She wrote down what came through: *…older when you hear it…*',
          '~whisper~ Then hiss, and under it something faint, singing his words back. Not the words: their shape, as if it was learning them.',
        ], do: { set: { 'sight.antennas.grete': true } } },
        '~curious~ You came by the sky? Did you hear us on the way down?',
        '~solemn~ My grandmother kept that dish. Now the birds do.',
        '~neutral~ She kept the dish turned that way all her life. The birds in it sit facing the same way. Nobody taught them.',
      ] } },
    { at: [FALLEN.x + 6, FALLEN.z - 8], radius: 2, lang: 'garage', lines: ['~playful~ It fell in a storm. Now it collects rain and children.', '~neutral~ Walk in, the inside is smooth. Mind the nests on the rim.'] },
    { at: [HAMLET.x + 14, HAMLET.z + 6], radius: 3, lang: 'garage', lines: ['~whisper~ The great saucer listens to the far side of the sky.', '~happy~ The egg is warm inside. The machines keep it warm.'] },
    { at: [6, 40], radius: 2, lang: 'garage', lines: ['~neutral~ Keep to the path. The masts drop rust.', '~curious~ Hear that crackle? That’s the forest clearing its throat.'] },
  ],
};

/** The level's colours: a pale yellow day, an amber dusk, an indigo night where the windows and beacons glow. */
export const ANTENNAS_SKY = {
  day: ANTENNAS_DAY,
  dusk: ['#a886b8', '#f4cc98', '#7a6aa8', '#ffe0c0', '#ffc080'],   // (a violet top: going to the night's indigo it stays violet, never brown)
  night: ['#141638', '#2c2a5c', '#3c3c78', '#c8c0e8', '#f0e8d8'],
};

// ------------------------------------------------------------------ building
const SOLID = { solid: true, shadow: true }, SOLID_NS = { solid: true, shadow: false }, LOOSE = { solid: false, shadow: true }, LOOSE_NS = { solid: false, shadow: false };
/** The world in cells, each its own kit (its own meshes, so the camera's frustum culls them). */
const CELL = 170;
/** A mast's legs: the stand-in cone round each foot (m), and the bottom bay left open under its first struts (m). */
const LEG = 0.8, OPEN = 3.6;
/** The least width (px) a thin bar is drawn (materials.js S_THIN). */
export const THIN = 1.5;

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildAntennas(scene) {
  const rng = mulberry32(52100), R = (a, b) => a + rng() * (b - a);
  const terrain = yield* Terrain.make({
    size: 1500, seg: 240, height,   // (6.25 m: the plain is gentle; the forest beyond stands on it out to 750 m)
    material: { color: T.grass, color2: T.grass2, color3: T.grass3, mode: MODE_TERRAIN, ticks: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const base = (x, z, r) => { let m = H(x, z); for (let k = 0; k < 8; k++) m = Math.min(m, H(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r)); return m; };
  const spread = (x, z, r) => { let lo = H(x, z), hi = lo; for (let k = 0; k < 12; k++) for (const f of [0.5, 1, 1.3]) { const h = H(x + Math.cos(k * 0.5236) * r * f, z + Math.sin(k * 0.5236) * r * f); lo = Math.min(lo, h); hi = Math.max(hi, h); } return { lo, hi }; };
  const root = new THREE.Group();
  root.name = 'The Forest of Antennas';
  scene.add(root);

  // ---- the kits by cell, and the materials
  const kits = new Map(), opts = new Map(), lights = [], noShadow = [];
  const kitAt = (x, z) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!kits.has(k)) {
      const group = new THREE.Group(); group.name = `cell ${k}`; root.add(group);
      kits.set(k, { kit: new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 52100 + kits.size }), vm: new Map() });
    }
    return kits.get(k);
  };
  const first = kitAt(0, 0).kit;
  const mat = (o) => { const m = first.mat(o); opts.set(m, o); return m; };
  const DS = THREE.DoubleSide;
  const M = {
    // (the lattices, vines and wires: thin bars kept THIN px wide however far, src/thin.js; no crawl of pixels at distance)
    iron: mat({ color: T.iron, shade: 0.3, hatch: 0.4, thin: THIN }),
    ironMid: mat({ color: '#7a6458', shade: 0.3, hatch: 0.3, line: 0.7, lineTint: 0.6, thin: THIN }),
    vine: mat({ color: T.vine, shade: 0.4, hatch: 0.6, thin: THIN }),
    leaf: mat({ color: T.leaf, pattern: 'leaves', hatch: 1.2, shade: 0.5, spot: 0 }),
    frame: mat({ color: T.frame, flat: true, thin: THIN }),
    trim: mat({ color: T.trim, flat: true }),
    glow: mat({ color: T.window, glow: 0.95, flat: true }),
    beacon: mat({ color: '#ff8a6a', glow: 1, flat: true }),
    plank: mat({ color: T.plank, flat: true }),
    path: mat({ color: '#dcb49a', shade: 0.25, hatch: 0.35, side: THREE.DoubleSide }),
    bird: mat({ color: T.bird, flat: true }),
    // the dishes and the workshops: one surface each, every tone of it drawn in one mesh (vertex-material.js)
    dish: Object.fromEntries(['dish', 'dishPink', 'dishBlue', 'dishNavy', 'dishRose', 'under'].map((k) => [k, mat({ color: T[k], shade: 0.45, hatch: 0.35, side: DS, line: 0.7, lineTint: 0.35 })])),
    shell: Object.fromEntries(['shell', 'shell2', 'shell3'].map((k) => [k, mat({ color: T[k], shade: 0.45, hatch: 0.4 })])),
  };
  const FLORA = new Set([M.vine, M.leaf]);
  const NAMES = new Map([[M.iron, 'lattices'], [M.ironMid, 'dish lattices'], [M.vine, 'vines'], [M.leaf, 'leaves'], [M.frame, 'frames and rails'], [M.trim, 'window frames'], [M.glow, 'windows'], [M.beacon, 'beacons'], [M.plank, 'planks'], [M.path, 'the path'], [M.bird, 'birds']]);
  // a merged-by-tone surface: kept per cell and solid flag, merged at the end with its material values per vertex
  const addVM = (cell, m, g, solid, shadow = true) => {
    const k = `${restKey(m)}|${solid ? 1 : 0}|${shadow ? 1 : 0}`;
    if (!cell.vm.has(k)) cell.vm.set(k, { solid, shadow, items: [] });
    if (!g.attributes.normal) g.computeVertexNormals();
    cell.vm.get(k).items.push({ geometry: g.index ? g.toNonIndexed() : g, x: 0, y: 0, z: 0, rotY: 0, material: m });
  };
  /** A builder's parts (in world space) added by role. dishTone / underTone / shellTone: the tones of the surfaces. */
  const put = (x, z, parts, { solid = false, frameSolid = solid, dishTone = 'dish', underTone = 'under', shellTone = 'shell', iron = M.iron, shadow = true } = {}) => {
    const C = kitAt(x, z), k = C.kit, flag = (s, sh = shadow) => ({ solid: s, shadow: sh });
    for (const [role, list] of Object.entries(parts)) {
      if (!Array.isArray(list) || !list[0]?.isBufferGeometry) continue;
      for (const g of list) {
        if (role === 'dish') addVM(C, M.dish[dishTone], g, solid, shadow);
        else if (role === 'under') addVM(C, M.dish[underTone], g, solid, shadow);
        else if (role === 'shell') addVM(C, M.shell[shellTone], g, solid, shadow);
        else if (role === 'iron') k.add(iron, g, flag(solid));
        else if (role === 'vine') k.add(M.vine, g, flag(false));
        else if (role === 'leaf') k.add(M.leaf, g, flag(false, false));
        else if (role === 'frame') k.add(M.frame, g, flag(frameSolid, false));
        else if (role === 'trim') k.add(M.trim, g, flag(solid, false));
        else if (role === 'glow') k.add(M.glow, g, flag(solid, false));
        else if (role === 'plank') k.add(M.plank, g, flag(true, false));
      }
    }
  };
  // the stand-ins round the masts' feet: invisible cones, too steep to stand on or climb (contact-audit.js samples neither)
  const cones = [];
  // (a cone round a leg's foot: its sides 65° steep, neither stood on, ny < 0.7, nor climbed, ny > 0.35; low, so the
  // mast's first struts stay well over it: OPEN, the bottom bay left unbraced, is walked in under between the legs)
  const coneAt = (x, z, r) => { const rise = r * 2.2; cones.push(new THREE.ConeGeometry(r, rise, 8, 1).translate(x, base(x, z, r) + rise / 2 - 0.3, z)); };
  const lamp = (x, y, z, r) => lights.push(new THREE.Vector4(x, y, z, r));
  const birdsOn = (C, list, flag = LOOSE_NS) => { for (const g of list) C.kit.add(M.bird, g, flag); };

  // ---------------------------------------------------------- the path and the branch
  yield;
  for (const [pts, w] of [[PATH, 2.2], [BRANCH, 1.8]]) kitAt(0, 0).kit.add(M.path, groundRibbon(H, pts, w, 0.05), LOOSE_NS);

  // ---------------------------------------------------------- the masts and dishes of the walked land
  const layout = forestLayout();
  const tops = [];   // where cables can hang from: [x, y, z]
  for (const [i, o] of layout.entries()) {
    if (i % 4 === 0) yield;
    // (on a slope a mast stands on the highest ground under its legs, its legs reaching down to the lowest: its
    // first bay's struts then stay over a man's height everywhere round it)
    const C = kitAt(o.x, o.z), sp = spread(o.x, o.z, o.kind === 'mast' ? o.w0 : o.R * 0.3), y0 = sp.hi - 0.1, foot = sp.hi - sp.lo + 0.6;
    if (o.kind === 'mast') {
      const L = latticeTower({ h: o.h, w0: o.w0, w1: o.w1, legs: o.legs, bay: 2.6, r: 0.16, s: 0.07, vines: o.vines, hang: o.vines, seed: o.seed, detail: 0.8, foot, open: OPEN + (y0 - sp.lo) });
      put(o.x, o.z, moveParts(L, (g) => g.translate(o.x, y0, o.z)));
      const top = new THREE.Vector3(o.x, y0 + o.h, o.z);
      tops.push([top.x, top.y - 0.5, top.z]);
      if (o.top === 'saucer') {
        const P = saucer({ R: o.R, h: o.R * 0.1, under: 0.3, stem: Math.max(o.w1 * 1.2, 0.3), hang: 0.5, seed: o.seed, detail: 0.7 }), lift = 0.3 * o.R;
        const B = { bird: rimSpots(o.R, 0.02, o.birds, o.seed).map((b) => bird(0.32 * b.s).rotateY(b.yaw).translate(b.x, b.y, b.z)) };
        const tilt = (rng() - 0.5) * 0.3, az = rng() * 6.3;
        for (const Q of [P, B]) tipToward(Q, az, tilt);
        put(o.x, o.z, moveParts(P, (g) => g.translate(top.x, top.y + lift, top.z)), { dishTone: ['dish', 'dishPink', 'dishBlue', 'dishRose'][o.seed % 4], underTone: 'under' });
        birdsOn(C, moveParts(B, (g) => g.translate(top.x, top.y + lift, top.z)).bird);
      } else if (o.top === 'dish') {
        const P = dish({ R: o.R, depth: 0.25, feed: 'tripod', back: true, seed: o.seed, detail: 0.6, ribs: 6 });
        put(o.x, o.z, aimAt(P, dirOf(rng() * 6.3, R(0.4, 1.2)), top.clone().add(new THREE.Vector3(0, 0.4, 0))), { dishTone: ['dish', 'dishPink', 'dishBlue'][o.seed % 3] });
      } else if (o.top === 'spike') C.kit.add(M.iron, bar(top, top.clone().add(new THREE.Vector3(0, R(6, 16), 0)), 0.12, 0.05, 5), LOOSE);
      if (o.h > 30) { C.kit.add(M.beacon, new THREE.SphereGeometry(0.35, 8, 6).translate(top.x, top.y + 0.6, top.z), LOOSE_NS); lamp(top.x, top.y + 0.6, top.z, 4); }
      for (const [fx, fz] of L.feet) coneAt(o.x + fx, o.z + fz, LEG);
    } else {
      const P = dish({ R: o.R, depth: 0.3, feed: rng() < 0.6 ? 'tripod' : 'quad', back: true, seed: o.seed, detail: 0.7, ribs: 8 });
      const dir = dirOf(o.az, o.up), pivot = new THREE.Vector3(o.x, y0 + o.y, o.z), back = pivot.clone().addScaledVector(dir, -o.R * 0.12);
      put(o.x, o.z, aimAt(P, dir, pivot), { dishTone: ['dish', 'dishPink', 'dishBlue', 'dishRose'][o.seed % 4], underTone: o.seed % 3 ? 'under' : 'dishRose' });
      const L = latticeTower({ h: back.y - y0, w0: o.R * 0.3, w1: o.R * 0.1, legs: 4, bay: 2.6, r: 0.14, s: 0.06, vines: 0.4, hang: 0.4, seed: o.seed, detail: 0.7, foot, open: OPEN + (y0 - sp.lo) });
      put(o.x, o.z, moveParts(L, (g) => g.translate(back.x, y0, back.z)), { iron: M.ironMid });
      tops.push([back.x, back.y, back.z]);
      for (const [fx, fz] of L.feet) coneAt(back.x + fx, back.z + fz, LEG);
    }
  }

  // ---------------------------------------------------------- the settlement: the workshops on their mound round a plaza
  yield;
  const S = SETTLEMENT, domes = [
    [S.x - 14, S.z - 10, 5.5, 0.95, 0.9], [S.x - 4, S.z - 20, 6.5, 1, 0.2], [S.x + 10, S.z - 18, 5, 0.9, -0.4], [S.x + 18, S.z - 4, 4.6, 0.85, -1.2],
    [S.x - 18, S.z + 6, 4.2, 0.85, 1.6], [S.x + 14, S.z + 14, 4, 0.8, -2.2], [S.x + 5, S.z + 21, 3.8, 0.85, 2.8],
  ];
  for (const [i, [x, z, Rr, tall, face]] of domes.entries()) {
    yield;
    // (its door turned to the plaza: rot is the door's heading, 0 toward +z)
    const rot = Math.atan2(S.x - x, S.z - z);
    void face;
    const D = dome({ R: Rr, tall, windows: 4, lit: 0.8, seed: 70 + i, rot, detail: 0.85 });
    const y = base(x, z, Rr * 0.8) - 0.1;
    put(x, z, moveParts(D, (g) => g.translate(x, y, z)), { solid: true, shellTone: ['shell', 'shell2', 'shell3'][i % 3] });
    for (const [wx, wy, wz] of D.windows.slice(0, 3)) lamp(x + wx, y + wy, z + wz, Rr * 1.3);
  }
  // a lamp on a post in the plaza's middle, and crates, a workbench
  {
    const k = kitAt(S.x, S.z).kit, y = H(S.x, S.z);
    k.add(M.iron, bar(new THREE.Vector3(S.x, y - 0.3, S.z), new THREE.Vector3(S.x, y + 3.4, S.z), 0.09, 0.07, 6), SOLID_NS);
    k.add(M.glow, new THREE.SphereGeometry(0.32, 10, 8).translate(S.x, y + 3.6, S.z), SOLID_NS);
    lamp(S.x, y + 3.6, S.z, 9);
    for (const [dx, dz, s] of [[4, -6, 0.9], [4.8, -5.2, 0.7], [-5, 4, 0.8], [7, 3, 1.1]]) k.add(M.plank, new THREE.BoxGeometry(s, s * 0.8, s).translate(S.x + dx, H(S.x + dx, S.z + dz) + s * 0.4 - 0.02, S.z + dz), SOLID_NS);
    k.add(M.plank, new THREE.BoxGeometry(2.4, 0.12, 1).translate(S.x - 3, H(S.x - 3, S.z - 3) + 0.95, S.z - 3), SOLID_NS);
    for (const [dx, dz] of [[-1.9, -0.4], [-1.9, 0.4], [-4.1, -0.4], [-4.1, 0.4]]) k.add(M.frame, bar(new THREE.Vector3(S.x + dx, H(S.x + dx, S.z - 3 + dz) - 0.1, S.z - 3 + dz), new THREE.Vector3(S.x + dx, H(S.x + dx, S.z - 3 + dz) + 0.9, S.z - 3 + dz), 0.05, 0.05, 4), SOLID_NS);
  }

  // ---------------------------------------------------------- the immense receiver: its column, turret, balcony and dish
  yield;
  const Rc = RECEIVER, ry = base(Rc.x, Rc.z, 5) - 0.3, turretY = ry + Rc.turret;
  {
    const C = column({ h: Rc.turret - 2, r0: 4.2, r1: 2.8, bulge: 0.4, seg: 22, collar: false });
    put(Rc.x, Rc.z, moveParts(C, (g) => g.translate(Rc.x, ry, Rc.z)), { solid: true, iron: M.dish.dishNavy });
    // the turret drum on top, the balcony round it (the bridge comes in from the west)
    const k = kitAt(Rc.x, Rc.z).kit;
    addVM(kitAt(Rc.x, Rc.z), M.dish.dishNavy, new THREE.CylinderGeometry(4.6, 4.6, 5, 22).translate(Rc.x, turretY + 0.5, Rc.z), true);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.add(M.glow, new THREE.CircleGeometry(0.45, 10).rotateY(Math.PI / 2 - a).translate(Rc.x + Math.cos(a) * 4.65, turretY + 1.6, Rc.z + Math.sin(a) * 4.65), SOLID_NS); }
    lamp(Rc.x, turretY + 1.6, Rc.z, 10);
    const bal = balconyRing(Rc.x, turretY - 2, Rc.z, 4.6, 7.4, Math.PI);
    put(Rc.x, Rc.z, bal, { solid: true });
  }
  // the dish: its face turned to the path and up, its vertex over the turret
  {
    const pivot = new THREE.Vector3(Rc.x, turretY + 10 + Rc.R * 0.3, Rc.z), dir = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();
    const P = dish({ R: Rc.R, depth: 0.3, feed: 'quad', back: true, ribs: 12, seed: 11, detail: 1 });
    put(Rc.x, Rc.z, aimAt(P, dir, pivot), { solid: true, frameSolid: true, dishTone: 'dishNavy', underTone: 'dishNavy' });   // (its rim, ribs and feed too: they stand on the solid bowl)
    const k = kitAt(Rc.x, Rc.z).kit, back = pivot.clone().addScaledVector(dir, -Rc.R * 0.1);
    // the yoke: a stout arm from the turret to the dish's back, braces round it
    k.add(M.dish.dishNavy, bar(new THREE.Vector3(Rc.x, turretY + 2.5, Rc.z), back, 2.2, 1.6, 12, true), SOLID);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.add(M.frame, bar(new THREE.Vector3(Rc.x + Math.cos(a) * 3.8, turretY + 3, Rc.z + Math.sin(a) * 3.8), back.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3)), 0.14, 0.12, 4), SOLID_NS); }
    const B = rimSpots(Rc.R, 0, 14, 11).map((b) => bird(0.4 * b.s).rotateY(b.yaw).translate(b.x, Rc.R * 0.3 + 0.05, b.z));
    birdsOn(kitAt(Rc.x, Rc.z), aimAt({ bird: B }, dir, pivot).bird, SOLID_NS);   // (perched on the solid rim: as solid as it)
    k.add(M.beacon, new THREE.SphereGeometry(0.5, 8, 6).translate(pivot.x + dir.x * Rc.R * 0.85, pivot.y + dir.y * Rc.R * 0.85, pivot.z + dir.z * Rc.R * 0.85), LOOSE_NS);
  }

  // ---------------------------------------------------------- the observation tower: a long stair up to its deck, the bridge to the receiver
  yield;
  {
    const O = OBS, oy = base(O.x, O.z, 3) - 0.2, top = oy + O.top;
    const L = latticeTower({ h: O.top, w0: 3.4, w1: 3, legs: 4, bay: 2.4, r: 0.2, s: 0.08, vines: 0.4, hang: 0.5, seed: 81, rot: Math.PI / 4, open: OPEN });
    put(O.x, O.z, moveParts(L, (g) => g.translate(O.x, oy, O.z)));
    // (its legs' feet kept clear by the stand-ins, the bracing drawn only)
    for (const [fx, fz] of L.feet) coneAt(O.x + fx, O.z + fz, LEG);
    // the deck, railed, open where the stair comes up (south) and the bridge leaves (east)
    put(O.x, O.z, deck(O.x, top, O.z, 6, 6, { gaps: [[0, -1.4, 1.7], [1, 0, 2.1]] }), { solid: true });
    // the stair: one long flight on its truss from the grass south of the tower, legs under it
    const run = O.top / 0.68, foot = [O.x - 1.4, 0, O.z + 3 + run];
    foot[1] = H(foot[0], foot[2]) + 0.02;
    put(O.x, O.z, trussStair(foot, [O.x - 1.4, top, O.z + 3.05], { w: 1.4 }), { solid: true });
    for (let k = 1; k <= 3; k++) {
      const t = k / 4, z = foot[2] + (O.z + 3 - foot[2]) * t, y = foot[1] + (top - foot[1]) * t;
      for (const e of [-0.75, 0.75]) kitAt(O.x, O.z).kit.add(M.iron, bar(new THREE.Vector3(O.x - 1.4 + e, H(O.x - 1.4 + e, z) - 0.3, z), new THREE.Vector3(O.x - 1.4 + e, y - 1.1, z), 0.1, 0.08, 5), LOOSE);
    }
    // two tall masts over the deck, a beacon on each
    for (const [dx, h] of [[1.8, 30], [-1.6, 36]]) {
      const Lm = latticeTower({ h, w0: 0.3, w1: 0.12, legs: 3, bay: 3, r: 0.08, s: 0.035, vines: 0, hang: 0, seed: 90 + dx * 10, detail: 0.6, foot: 0.05 });
      put(O.x, O.z, moveParts(Lm, (g) => g.translate(O.x + dx, top, O.z - 2.2)), { solid: true });   // (they stand on the deck: you bump into them)
      kitAt(O.x, O.z).kit.add(M.beacon, new THREE.SphereGeometry(0.3, 8, 6).translate(O.x + dx, top + h + 0.5, O.z - 2.2), LOOSE_NS); lamp(O.x + dx, top + h + 0.5, O.z - 2.2, 4);
    }
    // the maintenance bridge from the deck's east edge to the receiver's balcony (its west side), a lattice leg under its middle
    const a = [O.x + 2.9, top, O.z], b = [Rc.x - 7.3, turretY - 2, Rc.z];
    const W = walkway([a, b], { w: 1.8, rail: true, stilt: 0, lamp: 9, sag: 0.3, seed: 7 });
    put(O.x, O.z, { plank: W.planks, frame: W.wood }, { solid: true });
    for (const g of W.glow) kitAt(O.x, O.z).kit.add(M.glow, g, LOOSE_NS);
    for (const [x, y, z] of W.lamps) lamp(x, y, z, 6);
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), mid = A.clone().lerp(B, 0.5), my = base(mid.x, mid.z, 1.5) - 0.2;
    const Lb = latticeTower({ h: mid.y - 0.6 - my, w0: 1.5, w1: 1.1, legs: 4, bay: 2.4, r: 0.14, s: 0.06, vines: 0.6, hang: 0.6, seed: 83, rot: Math.PI / 4, open: OPEN });
    put(mid.x, mid.z, moveParts(Lb, (g) => g.translate(mid.x, my, mid.z)));
    for (const [fx, fz] of Lb.feet) coneAt(mid.x + fx, mid.z + fz, LEG);
    const n = Math.max(4, Math.round(A.distanceTo(B) / 2.2)), side = new THREE.Vector3(B.z - A.z, 0, A.x - B.x).normalize().multiplyScalar(0.85);
    for (let i = 0; i < n; i++) {
      const p = A.clone().lerp(B, i / n), q = A.clone().lerp(B, (i + 1) / n), m = p.clone().lerp(q, 0.5).add(new THREE.Vector3(0, -1.3, 0));
      p.y -= 0.3 * Math.sin(Math.PI * (i / n)); q.y -= 0.3 * Math.sin(Math.PI * ((i + 1) / n)); m.y -= 0.3 * Math.sin(Math.PI * ((i + 0.5) / n));
      for (const e of [1, -1]) { const o = side.clone().multiplyScalar(e); kitAt(O.x, O.z).kit.add(M.frame, bar(p.clone().add(o).add(new THREE.Vector3(0, -0.2, 0)), m.clone().add(o), 0.05, 0.05, 3), LOOSE_NS); kitAt(O.x, O.z).kit.add(M.frame, bar(m.clone().add(o), q.clone().add(o).add(new THREE.Vector3(0, -0.2, 0)), 0.05, 0.05, 3), LOOSE_NS); }
    }
    put(O.x, O.z, vineCable(A.clone().add(new THREE.Vector3(0, -1.2, 0.9)), B.clone().add(new THREE.Vector3(0, -1.2, 0.9)), { sag: 1.2, r: 0.1, leaves: 0.6, hang: 1, seed: 3, detail: 0.7 }));
    tops.push([O.x, top + 30, O.z - 2.2]);
  }

  // ---------------------------------------------------------- the hamlet under the great nest saucer, on its egg
  yield;
  {
    const Hm = HAMLET, hy = base(Hm.x, Hm.z, 6) - 0.2;
    for (const [i, [dx, dz, Rr, rot]] of [[-9, 4, 4.5, -1.2], [7, 6, 4.8, 1.1], [0, -9, 5, Math.PI], [9, -5, 3.8, 2.2]].entries()) {
      const D = dome({ R: Rr, tall: 1, windows: 3, lit: 0.8, seed: 90 + i, rot, detail: 0.85 }), y = base(Hm.x + dx, Hm.z + dz, Rr * 0.8) - 0.1;
      put(Hm.x, Hm.z, moveParts(D, (g) => g.translate(Hm.x + dx, y, Hm.z + dz)), { solid: true, shellTone: 'shell3' });
      for (const [wx, wy, wz] of D.windows.slice(0, 2)) lamp(Hm.x + dx + wx, y + wy, Hm.z + dz + wz, Rr * 1.3);
    }
    const E = egg({ R: 6.4, H: 14, windows: 4, seed: 7, detail: 0.9 });
    put(Hm.x, Hm.z, moveParts(E, (g) => g.translate(Hm.x, hy, Hm.z)), { solid: true, shellTone: 'shell' });
    for (const [wx, wy, wz] of E.windows) lamp(Hm.x + wx, hy + wy, Hm.z + wz, 6);
    const k = kitAt(Hm.x, Hm.z).kit, sy = hy + 30, SR = 22;
    k.add(M.iron, bar(new THREE.Vector3(Hm.x, hy + 13.4, Hm.z), new THREE.Vector3(Hm.x, sy - SR * 0.38, Hm.z), 1.5, 1.1, 10, true), SOLID);
    for (let i = 0; i < 8; i++) { const a = i * 0.785; k.add(M.frame, bar(new THREE.Vector3(Hm.x + Math.cos(a) * 1.7, hy + 14.6, Hm.z + Math.sin(a) * 1.7), new THREE.Vector3(Hm.x + Math.cos(a) * 2.6, sy - SR * 0.38, Hm.z + Math.sin(a) * 2.6), 0.12, 0.1, 4), SOLID_NS); }   // (round the solid trunk: solid as it)
    const P = saucer({ R: SR, h: SR * 0.05, under: 0.4, stem: 2.8, hang: 0.6, seed: 9 });
    put(Hm.x, Hm.z, moveParts(P, (g) => g.translate(Hm.x, sy, Hm.z)), { dishTone: 'dishBlue', underTone: 'dishBlue' });
    birdsOn(kitAt(Hm.x, Hm.z), rimSpots(SR, 0.02, 16, 9).map((b) => bird(0.4 * b.s).rotateY(b.yaw).translate(Hm.x + b.x, sy + b.y, Hm.z + b.z)));
    const Lm = latticeTower({ h: 34, w0: 1.2, w1: 0.4, legs: 4, bay: 2.4, r: 0.16, s: 0.07, vines: 0, hang: 0, seed: 95, detail: 0.7 });
    put(Hm.x, Hm.z, moveParts(Lm, (g) => g.translate(Hm.x, sy - 1, Hm.z)));
    k.add(M.beacon, new THREE.SphereGeometry(0.4, 8, 6).translate(Hm.x, sy + 34.5, Hm.z), LOOSE_NS); lamp(Hm.x, sy + 34.5, Hm.z, 5);
    tops.push([Hm.x + SR * 0.9, sy, Hm.z]);
  }

  // ---------------------------------------------------------- the fallen dish in the grass, walked into (solid as drawn), birds on its rim
  yield;
  {
    const F = FALLEN, P = dish({ R: F.R, depth: 0.28, feed: 'tripod', back: true, ribs: 8, seams: 10, seed: 21 });   // (its feed still on its legs, the seams of its panels: it reads as a dish)
    const dir = dirOf(Math.PI * 0.55, 0.95), at = new THREE.Vector3(F.x - 1, H(F.x, F.z) + 0.6, F.z);   // (tipped over toward the path: its bowl open to it and the sky)
    put(F.x, F.z, aimAt(P, dir, at), { solid: true, dishTone: 'dishPink', underTone: 'under' });
    birdsOn(kitAt(F.x, F.z), aimAt({ bird: rimSpots(F.R, 0, 7, 21).map((b) => bird(0.32 * b.s).rotateY(b.yaw).translate(b.x, F.R * 0.28 + 0.05, b.z)) }, dir, at).bird);
    // its broken feed leg in the grass beside it
    kitAt(F.x, F.z).kit.add(M.frame, bar(new THREE.Vector3(F.x - 9, H(F.x - 9, F.z + 6) + 0.08, F.z + 6), new THREE.Vector3(F.x - 13, H(F.x - 13, F.z + 8) + 0.12, F.z + 8), 0.08, 0.07, 4), SOLID_NS);
  }

  // ---------------------------------------------------------- vine-grown cables and plain wires between the masts
  yield;
  {
    const crng = mulberry32(52130), used = new Set();
    for (const [i, a] of tops.entries()) {
      // each to one or two of its nearest neighbours not too far
      const near = tops.map((b, j) => [j, Math.hypot(b[0] - a[0], b[2] - a[2])]).filter(([j, d]) => j !== i && d > 12 && d < 70).sort((p, q) => p[1] - q[1]).slice(0, 2);
      for (const [j, d] of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (used.has(key)) continue;
        used.add(key);
        const A = new THREE.Vector3(...a), B = new THREE.Vector3(...tops[j]);
        // (its lowest point well over the grass: nobody walks through a hanging cable)
        const gm = H((A.x + B.x) / 2, (A.z + B.z) / 2), sag = Math.min(d * 0.1, Math.min(A.y, B.y) - gm - 4);
        if (sag < 0.5) continue;
        if (crng() < 0.55) put(a[0], a[2], vineCable(A, B, { sag, r: 0.12 + crng() * 0.08, leaves: 0.7, hang: 0.8, seed: i * 31 + j, detail: 0.6 }));
        else kitAt(a[0], a[2]).kit.add(M.frame, cable(A, B, sag * 0.6, 0.05, 8), LOOSE_NS);
      }
      if (i % 6 === 0) yield;
    }
  }

  // ---------------------------------------------------------- the forest beyond: the masts by the thousand, toned paler with distance
  yield;
  const far = [];
  {
    const poles = [], sauc = [], dishes = [], flowers = [], frng = mulberry32(52140);
    const cN = new THREE.Color(T.far), cF = new THREE.Color(T.farDeep), tones = [T.dish, T.dishPink, T.dishBlue].map((c) => new THREE.Color(c));
    const m4 = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    for (let i = 0; i < 2600; i++) {
      const a = frng() * Math.PI * 2, d = LIMIT + 20 + Math.pow(frng(), 0.8) * 520, x = Math.cos(a) * d, z = Math.sin(a) * d - 10;
      const y = H(x, z) - 0.5, hh = 14 + frng() * 46, k = smoothstep(LIMIT, LIMIT + 520, d);
      // (never thinner than ~1.5 px on the handheld seen from the walked land, where you mostly are: no crawl of
      // pixels at distance; from its edge, a mast 80 m off is a stout one, as the sheets' near masts are)
      const rr = Math.max(0.3, FAR_MIN_R * d * 0.85);
      const c = cN.clone().lerp(cF, k * 0.8).lerp(tones[i % 3], 0.35 * (1 - k));
      const u = frng(), kind = u < 0.5 ? 0 : u < 0.82 ? 1 : 2;
      poles.push([m4(x, y, z, rr * (kind === 2 ? 1.6 : 1), hh, rr * (kind === 2 ? 1.6 : 1)), c]);
      const Rr = (kind === 0 ? 2 + frng() * 5 : kind === 1 ? 3 + frng() * 7 : 2 + frng() * 3) * (0.9 + k * 0.5);
      if (kind === 0) sauc.push([m4(x, y + hh + Rr * 0.35, z, Rr, Rr, Rr, frng() * 6, (frng() - 0.5) * 0.25, (frng() - 0.5) * 0.25), c]);
      else if (kind === 1) dishes.push([m4(x, y + hh * 0.98, z, Rr, Rr, Rr, frng() * 6, 0.6 + frng() * 0.9, 0), c]);
      else flowers.push([m4(x, y + hh, z, Rr, Rr, Rr, frng() * 6, 0.3 + frng() * 0.8, 0), c]);
      if (i % 400 === 0) yield;
    }
    const farMat = makeMaterial({ color: '#ffffff', flat: true, hatch: 0.15, line: 0.25, lineTint: 1, side: DS, thin: THIN });
    for (const [geo, list, name] of [[unitPole(), poles, 'far masts'], [unitSaucer(10), sauc, 'far saucers'], [unitDish(10, 0.32, 3), dishes, 'far dishes'], [unitDish(9, 0.5, 3), flowers, 'far flowers']]) {
      const m = new THREE.InstancedMesh(geo, farMat, list.length);
      list.forEach(([mx, c], i) => { m.setMatrixAt(i, mx); m.setColorAt(i, c); });
      m.userData.noCollide = true; m.name = name;
      m.computeBoundingSphere();
      scene.add(m); noShadow.push(m); far.push(m);
    }
  }

  // ---------------------------------------------------------- dark bushes along the path and round the settlement (one instanced draw, walked through)
  yield;
  {
    const list = [], dm = new THREE.Object3D(), brng = mulberry32(52150);
    for (let i = 0; i < 1600 && list.length < 420; i++) {
      const a = brng() * Math.PI * 2, d = 10 + Math.sqrt(brng()) * 260, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const np = nearLine(PATH, x, z);
      if (np < 2.6 || nearLine(BRANCH, x, z) < 2.4 || Math.hypot(x - SHIP.x, z - SHIP.z) < 16 || Math.hypot(x - SETTLEMENT.x, z - SETTLEMENT.z) < 26) continue;
      if (np > 30 && brng() < 0.7) continue;   // (thicker along the path, as the sheets have them)
      if (layout.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5)) continue;
      const r = 0.45 + brng() ** 2 * 1.1;
      dm.position.set(x, H(x, z) + r * 0.45, z); dm.rotation.set(0, brng() * 6.3, 0); dm.scale.set(r, r * 0.85, r); dm.updateMatrix();
      list.push(dm.matrix.clone());
    }
    const bm = new THREE.InstancedMesh(bankBush(7.1, 1, { fronds: 14 }), makeMaterial({ color: T.bush, pattern: 'leaves', hatch: 2.2, shade: 0.45, spot: 0 }), list.length);
    list.forEach((m, i) => bm.setMatrixAt(i, m));
    bm.userData.noCollide = true; bm.name = 'bushes';
    scene.add(bm); noShadow.push(bm);
  }

  // ---------------------------------------------------------- finishing: each cell's meshes, the tones merged per vertex, the stand-ins
  yield;
  for (const C of kits.values()) {
    C.kit.finish();
    for (const m of C.kit.group.children) { m.name = NAMES.get(m.material) ?? ''; if (FLORA.has(m.material)) m.userData.flora = true; }   // (vines: walked through, as the flora is; contact-audit.js)
    noShadow.push(...C.kit.noShadow);
    lights.push(...C.kit.lights);
    for (const g of C.vm.values()) {
      const m = new THREE.Mesh(mergeWithMaterials(g.items), makeMaterial({ ...opts.get(g.items[0].material), perVertex: true }));
      if (!g.solid) m.userData.noCollide = true;
      if (!g.shadow) noShadow.push(m);
      m.name = `${g.items[0].material === M.dish[g.items[0].material.__tone] ? 'dishes' : 'surfaces'}${g.solid ? ' (solid)' : ''}`;
      C.kit.group.add(m);
    }
    yield;
  }
  {
    const merged = new THREE.Mesh(mergeCones(cones), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    merged.visible = false; merged.name = 'mast stand-ins';
    scene.add(merged);
  }
  yield;

  const spawn = new THREE.Vector3(0, H(0, SHIP.z - 26) + 0.05, SHIP.z - 26);   // (clear of the ship's hull and ramp, the camera too)
  // the hum: 0 out on the plain, rising near any mast or dish, strongest under the receiver
  const humAt = (p) => {
    let best = 0.25 * smoothstep(LIMIT + 200, 40, Math.hypot(p.x, p.z));
    for (const o of layout) { const d = Math.hypot(p.x - o.x, p.z - o.z); if (d < 30) best = Math.max(best, 0.55 * (1 - d / 30)); }
    const dr = Math.hypot(p.x - RECEIVER.x, p.z - RECEIVER.z, (p.y - turretY) * 0.5);
    return Math.min(1, Math.max(best, smoothstep(90, 8, dr)));
  };
  return {
    id: 'antennas',
    ground: terrain,
    // (the lattices are long thin bars: a BVH split by area, as Lorn II's and the Mangrove's)
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: LIMIT,
    shipSite: { x: SHIP.x, z: SHIP.z, heading: Math.PI },   // (its ramp toward the path and the masts)
    features: { mount: false, wind: true, jetpack: false, climb: true },
    defaults: { hour: 15.5, preset: 'Moebius print', cloudShadows: 0, look: ANTENNAS_LOOK },
    sky: { script: ANTENNAS_SKY, planets: [{ az: 140, el: 30, size: 2.2, color: '#f4e0c8', craters: true }, { az: 230, el: 18, size: 0.9, color: '#e0d0e8', craters: false }] },
    killY: -Infinity,
    lights,
    noShadow,
    reactions: false,   // (the masts grow vines of their own: reactive-world.js)
    floraAvoid: (x, z, r) => nearLine(PATH, x, z) < 1.4 + r || nearLine(BRANCH, x, z) < 1.2 + r,
    far,
    layout,
    life: {
      flocks: [{ count: 14, color: '#2d2834', size: 0.7, radius: 90, height: [26, 60], speed: 0.35, seed: 52 }, { count: 9, color: '#2d2834', size: 0.6, radius: 50, height: [18, 40], speed: 0.4, seed: 53 }],
      motes: { count: 160, color: '#fff2c0', size: 0.05, glow: 0.6, rise: 0.02, wind: [0.08, 0.03] },
    },
    atmo: () => ({ tint: [1, 1, 0.98], fog: 1, name: 'The Forest of Antennas' }),
    hum: humAt,
    update() {},
  };
}
export const createAntennas = stepped(buildAntennas);

/** The railed balcony ring round the receiver's turret: planks between r0 and r1 at y, a gap toward `gapAz` for the bridge. */
function balconyRing(x, y, z, r0, r1, gapAz) {
  const out = { plank: [], frame: [] }, n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, mid = (a + a1) / 2, w = r1 - r0, L = ((r0 + r1) / 2) * (a1 - a) * 1.08;
    out.plank.push(new THREE.BoxGeometry(w, 0.12, L).rotateY(-mid).translate(x + Math.cos(mid) * (r0 + w / 2), y - 0.06 + (i % 2) * 0.004, z + Math.sin(mid) * (r0 + w / 2)));
    const gap = Math.abs(Math.atan2(Math.sin(mid - gapAz), Math.cos(mid - gapAz))) < 0.16;
    if (!gap) {
      const p = new THREE.Vector3(x + Math.cos(a) * (r1 - 0.1), y, z + Math.sin(a) * (r1 - 0.1)), q = new THREE.Vector3(x + Math.cos(a1) * (r1 - 0.1), y, z + Math.sin(a1) * (r1 - 0.1));
      out.frame.push(bar(p.clone().setY(y + 1), q.clone().setY(y + 1), 0.04, 0.04, 4), bar(p, p.clone().setY(y + 1), 0.035, 0.035, 4));
    }
    if (i % 5 === 0) out.frame.push(bar(new THREE.Vector3(x + Math.cos(mid) * r1, y - 0.1, z + Math.sin(mid) * r1), new THREE.Vector3(x + Math.cos(mid) * r0, y - 2.2, z + Math.sin(mid) * r0), 0.1, 0.1, 4));
  }
  return out;
}
/** The cones (and posts) as one geometry, positions only. */
function mergeCones(list) {
  const pos = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}
