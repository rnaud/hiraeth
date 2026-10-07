import * as THREE from 'three';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { createNoise2D, mulberry32, smoothstep } from '../noise.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { SandDrifts, driftMaterial } from '../sand-drifts.js';
import { DUNE_HAZE } from '../desert-sites.js';
import { glassRidge, glassArch, awningCamp, boulders, glassOptions, glassBatch, glassPools, SAND } from './glass-dunes-kit.js';

// ---------------------------------------------------------------------------
// The Glass Dunes (?level=glassdunes; docs/systems/worlds.md "The Glass Dunes"): a world off the
// route, a detour on the galactic map (src/levels/names.js SIDE). A basin of amber sand walled in by
// dunes of fused green glass: high frozen waves, cliffs holding great dark silhouettes, billows, a
// wave breaking over its own hollow; sandy paths wind between them; the glassworkers keep two camps
// of fabric awnings at the walls' feet; archways glow in the walls' feet; low glass flows run over
// the sand. No quest: people, light, wind. Built from the References' kit (glass-dunes-kit.js), the
// plates in references/The Glass Dunes/.
//
// Layout (m; +z south): the ship lands on a flat in the south (0, 250), its hatch to the north. The
// valley runs north between the cliffs of the giants (west) and the billows (east), round a frozen
// wave in its middle, to the great breaking wave (north) and its camp; a ring of tall glass at
// ~600 m closes the world in.
// ---------------------------------------------------------------------------

export const GLASS_SIZE = 1500;
/** Where the ship stands, and the hatch's heading (north, up the valley). */
export const GLASS_SHIP = { x: 0, z: 250, heading: Math.PI };
/** The glassworkers' two camps: the west camp under its ramp of sand, the north camp in the breaking wave's hollow. */
export const GLASS_CAMPS = {
  west: { x: -126, z: 30, yaw: Math.PI / 2, w: 22, d: 5, n: 5, h: 2.8, ramp: [-150, 30, 26, 12, 9] },
  north: { x: 10, z: -192, yaw: 0, w: 28, d: 6, n: 6, h: 3.2, ramp: [10, -212, 40, 14, 8] },
};
/** The day's colours: the plates' sky, a teal-green shade (the light come through the glass), warm amber light. */
export const GLASS_DAY = ['#8fbcc8', '#f3dcb4', '#4f9a92', '#fff4e0', '#ffe6b8'];
// (the late day's shade an emerald, not the grey a teal turns when the sun's going lifts it toward the warm light)
export const GLASS_DUSK = ['#7f9fc0', '#f2b98e', '#3f9f86', '#ffe8c0', '#ffcf98'];
export const GLASS_NIGHT = ['#14243a', '#2c4a58', '#1f5450', '#7fb0a8', '#e8f2e6'];
/** How flat the glass's and the sand's shade is printed (makeMaterial shadeFlat): one luminous teal, as the plates. */
export const GLASS_FLAT = 0.8;
/** The glass's own: flatter than the hue's but keeping some of its colour, so its shade runs from a luminous mint foot to a deep teal top. */
export const GLASS_GLASS_FLAT = 0.45;
/** The world's ink: a clean sky (no cumulus bank, no flat clouds), the far sand in the desert's stepped warm bands, fewer strokes. */
export const GLASS_WORLD_LOOK = { uCumulus: 0, uClouds: 0, uHaze: [0.96, 0.92, 0.84, 0.5], ...DUNE_HAZE, uHatch: 0.6, uShadeKeep: 0 };

const n1 = createNoise2D(5101), n2 = createNoise2D(5102);
const ramp = (x, z, [cx, cz, rx, rz, h]) => h * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));

/** The ground: low ridged dunes, ramps of sand against the walls, a flat for the ship, sand piled at the ring. */
export function glassHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 1.6 * (1 - Math.abs(n1(x * 0.012, z * 0.02))) + 2.2 * n2(x * 0.004, z * 0.004);
  h += ramp(x, z, GLASS_CAMPS.west.ramp) + ramp(x, z, GLASS_CAMPS.north.ramp);
  h += 14 * smoothstep(470, 600, r);   // (sand banked up the ring's foot)
  const pad = smoothstep(55, 30, Math.hypot(x - GLASS_SHIP.x, z - GLASS_SHIP.z));
  return h * (1 - pad) + 0.4 * pad;
}

/**
 * The ridges (glass-dunes-kit.js glassRidge; the face looks to the right of the way the path runs).
 * shadow: false for the ring (its shadows would fall outside the basin or over all of it at dusk).
 */
export const GLASS_RIDGES = [
  // the cliffs of the giants, west of the valley (reference-3), facing east
  { name: 'giants', path: [[-150, 210], [-170, 120], [-172, 30], [-185, -60], [-205, -150]], height: 52, depth: 70, profile: 'cliff', taper: [0.7, 1.2],
    folds: { width: 24, amp: 3, lean: 1.0, crest: 0.05 },
    silhouettes: [{ shape: 'giant', u: 120, y: 0, s: 28 }, { shape: 'head', u: 215, y: 6, s: 22 }, { shape: 'beast', u: 300, y: 10, s: 30 }] },
  // the billows, east (reference-2), facing west
  { name: 'billows', path: [[205, -150], [190, -60], [175, 30], [168, 120], [150, 205]], height: 58, depth: 150, profile: 'dome', taper: [1.2, 0.6],
    folds: { width: 26, amp: 10, lean: 0.25, crest: 0.05 }, colours: { mid: '#62c48c', top: '#3f9c7a' } },
  // the frozen wave in the valley's middle (reference-1), facing south
  { name: 'wave', path: [[-90, 70], [-40, 46], [20, 40], [80, 56]], height: 34, depth: 50, profile: 'wave',
    folds: { width: 20, amp: 4, lean: 0.8, crest: 0.15 },
    silhouettes: [{ shape: 'head', u: 90, y: 2, s: 16 }] },
  // the great breaking wave, north (reference-4), its hollow facing south over the north camp
  { name: 'breaker', path: [[-150, -232], [-80, -226], [0, -230], [80, -222], [170, -200]], height: 70, depth: 120, profile: 'curl', taper: [1.4, 0.4], ends: 70,
    folds: { width: 30, amp: 4, lean: 0.4, crest: 0.05 },
    silhouettes: [{ shape: 'tree', u: 90, y: 14, s: 40 }] },
  // the ring that closes the basin (counter-clockwise: faces in), its silhouettes printed large
  ...[[0.2, 1.9], [1.7, 3.4], [3.2, 4.9], [4.7, 6.4]].map(([a0, a1], k) => ({
    name: `ring ${k}`, ring: true, shadow: false, solid: false, step: 6, rows: 28,   // (beyond the edge: drawn only)
    path: Array.from({ length: 9 }, (_, i) => { const a = a0 + (a1 - a0) * (i / 8), R = 610 + 30 * Math.sin(a * 3 + k); return [Math.cos(a) * R, Math.sin(a) * R]; }),
    height: [210, 160, 240, 180][k], depth: 110, profile: 'cliff', ends: 40,
    folds: { width: 60, amp: 9, lean: 0.12, crest: 0.05 },
    silhouettes: [{ shape: ['tree', 'giant', 'head', 'tree'][k], u: 300, y: 20, s: 120 }, { shape: 'tree', u: 1000, y: 10, s: 90 }],
  })),
  // low mounds of glass near the paths, to climb and look from
  ...[[-60, 150, 12], [70, 140, 9], [-110, -60, 14], [100, -100, 11], [40, -40, 7]].map(([x, z, h], k) => ({
    name: `mound ${k}`, path: [[x - 10, z + 6], [x, z], [x + 12, z - 4]], height: h, depth: 22, profile: 'dome', ends: 6,
    folds: { width: 8, amp: 1.2, lean: 0.3, crest: 0 } })),
];
/** The green flows over the sand (low glass bands, walkable), east of the valley. */
export const GLASS_FLOWS = [
  [[30, 190], [80, 170], [130, 176]], [[20, 120], [70, 100], [140, 108]], [[60, 10], [110, -10], [150, 0]],
  [[-100, 180], [-60, 196], [-20, 186]],
];
/** Archways in the walls' feet: [x, z, yaw (the way out), width, height]. */
export const GLASS_ARCHES = [[-171, 70, Math.PI / 2, 7, 10], [177, -20, -Math.PI / 2, 9, 12], [-70, -222, 0, 10, 16], [60, -218, 0, 8, 12], [0, -600, 0, 30, 60]];

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildGlassDunes(scene) {
  const sandMat = { color: SAND[0], color2: SAND[1], color3: SAND[2], mode: MODE_TERRAIN, ripples: true, sandInk: true, shadeFlat: GLASS_FLAT, dunePool: true };
  const terrain = yield* Terrain.make({ size: GLASS_SIZE, seg: 375, height: glassHeight, material: sandMat });
  scene.add(terrain.mesh);
  yield;
  const group = new THREE.Group();
  group.name = 'The Glass Dunes';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 5100 });
  const M = {
    glass: kit.mat(glassOptions({ shadeFlat: GLASS_GLASS_FLAT })),
    glassFlow: kit.mat(glassOptions({ hatch: 0.1, glow: 0.2, shadeFlat: GLASS_FLAT })),
    light: kit.mat({ color: '#d4f8b4', glow: 0.95, flat: true, line: 0.25, lineTint: 1 }),
    dark: kit.mat({ color: '#2f5c4d', flat: true, spot: 0 }),
    pole: kit.mat({ color: '#4b3b30', flat: true }),
    cloth: ['#ead6b4', '#dcb98f', '#d2c6a8', '#c9a27e'].map((c) => kit.mat({ color: c, flat: true, side: THREE.DoubleSide, hatch: 0.5 })),
    rug: ['#b5523e', '#c98a4a', '#7f6aa0', '#4f8a7f'].map((c) => kit.mat({ color: c, flat: true })),
    crate: kit.mat({ color: '#9b7652', flat: true }),
    float: kit.mat({ color: '#a8f0bd', glow: 0.75, line: 0.45, lineTint: 1 }),
    kiln: kit.mat({ color: '#cf9f76', flat: true, weathered: 0.4 }),
    rock: kit.mat({ color: '#3c4d47', flat: true, hatch: 0.6 }),
  };
  // the glass: solid as drawn (you walk round it, climb it, stand on its mounds), never feeding the drifts;
  // merged per material in meshes of its own (the glass shader's attribute: glassBatch)
  const ridges = [], glass = glassBatch(kit);
  for (const [i, r] of GLASS_RIDGES.entries()) {
    yield;
    const ridge = glassRidge({ H: (x, z) => terrain.heightAt(x, z), seed: 51 + i, ...r });
    ridges.push({ ...r, ridge });
    glass.add(M.glass, ridge.geo, { shadow: r.shadow ?? true, solid: r.solid ?? true });
  }
  yield;
  for (const [i, path] of GLASS_FLOWS.entries()) {
    const flow = glassRidge({ H: (x, z) => terrain.heightAt(x, z), seed: 80 + i, path, height: 0.5, depth: 4, depthVary: 0.8, profile: 'flow', folds: { width: 30, amp: 0.6, lean: 0, crest: 0 }, sink: 0.4, ends: 6, thin: 0.9 });
    glass.add(M.glassFlow, flow.geo, { shadow: false });
  }
  glass.finish();
  yield;
  // the light come through the glass, pooled on the sand at the walls' feet (dune-glass-shader.js)
  glassPools(terrain.mesh.geometry, ridges.filter((r) => !r.ring).map((r) => r.ridge));
  yield;
  // sand banked against the camps, the kilns and the stones (sand-drifts.js)
  const sand = SandDrifts.open({ heightAt: (x, z) => terrain.heightAt(x, z), seed: 51 });
  const rng = mulberry32(5103);
  const camps = {};
  for (const [id, c] of Object.entries(GLASS_CAMPS)) camps[id] = awningCamp(kit, M, rng, c);
  for (const [x, z, yaw, w, h] of GLASS_ARCHES) glassArch(kit, M, { x, z, yaw, w, h });
  yield;
  boulders(kit, M.rock, rng, { x: -110, z: 110, r: 30, n: 14, s0: 0.4, s1: 2.0 });
  boulders(kit, M.rock, rng, { x: -130, z: -100, r: 24, n: 10, s0: 0.4, s1: 1.6 });
  boulders(kit, M.rock, rng, { x: 40, z: 200, r: 50, n: 10, s0: 0.3, s1: 1.0 });
  yield;
  kit.finish();
  const drifts = sand.close().build(driftMaterial(makeMaterial, terrain.materialOptions));
  if (drifts) scene.add(drifts);
  sand.raise(terrain);
  yield;
  // the arches' and the camps' glow at night
  const lights = [...kit.lights];
  for (const [x, z, yaw, w, h] of GLASS_ARCHES) lights.push(new THREE.Vector4(x + Math.sin(yaw) * 2, terrain.heightAt(x, z) + h * 0.4, z + Math.cos(yaw) * 2, Math.max(5, w * 0.8)));
  for (const c of Object.values(GLASS_CAMPS)) lights.push(new THREE.Vector4(c.x, terrain.heightAt(c.x, c.z) + 2, c.z, 12));

  const spawn = new THREE.Vector3(GLASS_SHIP.x, 0, GLASS_SHIP.z - 24);
  spawn.y = terrain.heightAt(spawn.x, spawn.z);
  return {
    id: 'glassdunes',
    ground: terrain,
    ridges,
    camps,
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    shipSite: { ...GLASS_SHIP },
    features: { mount: false, wind: true, jetpack: false, climb: true },
    defaults: { hour: 16.5, preset: 'Moebius print', look: GLASS_WORLD_LOOK },
    limit: 560,
    edgeHint: 'The glass closes the dunes in; the wind turns you back.',
    killY: -Infinity,
    lights,
    // the glassworkers at work and on the way between the camps (crowd.js; the desert's people, in its clothes)
    crowdSpots: () => glassCrowdSpots(terrain),
    crowdLines: CROWD_LINES,
    life: {
      flocks: [{ count: 9, color: '#3f5a50', size: 0.8, radius: 70, height: [26, 60], seed: 7 }],
      motes: { count: 150, color: '#bff2c8', size: 0.045, wind: [1.4, 0.5] },
      footprints: '#d9a77a',
    },
    sky: {
      script: { day: GLASS_DAY, dusk: GLASS_DUSK, night: GLASS_NIGHT },
      planets: [{ az: 120, el: 30, size: 4, color: '#d6f0d8' }],
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.3, name: 'The Glass Dunes' }),
    update() {},
  };
}
export const createGlassDunes = stepped(buildGlassDunes);

/** What the camps' people say as you pass (toned: src/story/tone.js). */
export const CROWD_LINES = [
  '~neutral~ Mind the flows. They are warm at noon.',
  '~happy~ The kiln is lit. Come back when it is dark and see the walls.',
  '~whisper~ Do not knock on the cliffs. Something knocks back.',
  '~tired~ Sand in, glass out. That is the whole trade.',
];

/** The crowd: a few people round each camp, a file of them walking the valley between the camps. */
export function glassCrowdSpots(terrain) {
  const V3 = (x, z) => new THREE.Vector3(x, terrain.heightAt(x, z), z);
  const groups = [], walks = [], edges = [];
  for (const [x, z] of [[-116, 22], [-114, 40], [24, -180], [-8, -178], [40, -176]]) groups.push({ at: V3(x, z), n: 2 + (Math.abs(x + z) % 2), lines: CROWD_LINES, id: 'camp' });
  const path = [[-118, 32], [-90, 90], [-30, 110], [10, 20], [-20, -60], [-10, -150], [10, -178]].map(([x, z]) => V3(x, z));
  walks.push({ id: 'carriers', path, loop: false, n: 6, lanes: 1, gap: 6, spread: [0, 0.05], speed: 0.9, lateral: 0.3, keepRight: 0, lines: CROWD_LINES });
  return {
    groups, walks, edges, farMax: 360, costume: 'desert',
    palette: { cloaks: ['#d9b48a', '#5fb7ad', '#c98a4a', '#e6d3b8', '#4f8a7f', '#b5523e'], hats: ['#ead6b4', '#c98a4a', '#f3ead8'] },
  };
}

const pal = (cloak, extra = {}) => ({ cloak, lining: extra.lining ?? '#2b211f', ...extra });
/** The world's content (src/levels/content.js): no quest, no relics; a page for the sketchbook, the glassworkers. */
export const GLASS_CONTENT = {
  weather: ['storm'],
  story: {
    title: 'THE GLASS DUNES',
    intro: 'A desert that turned to glass. Something stands inside the dunes; the glassworkers camp at their feet and do not ask what.',
    outro: 'You walked the glass.',
    label: 'the west camp', goal: [GLASS_CAMPS.west.x, 'ground', GLASS_CAMPS.west.z], radius: 12, manual: true,
  },
  relics: { spots: [], names: [] },
  npcs: [
    { at: [-118, 26], radius: 2, palette: pal('#d9b48a', { cloth: '#5a4a3a' }), lines: ['~neutral~ We blow floats from the drifts. The dunes give the sand; the kiln does the rest.', '~curious~ Have you looked into the cliffs at dusk? The big ones are clearer then.'] },
    { at: [-112, 38], radius: 2, palette: pal('#4f8a7f'), lines: ['~whisper~ My grandmother said they were asleep in there. My mother said they were only shapes.', '~playful~ I say they are good company. They never want the last float.'] },
    { at: [16, -186], radius: 3, palette: pal('#c98a4a', { cloth: '#3f4b44' }), lines: ['~solemn~ The wave has been breaking over this camp for longer than we have names.', '~happy~ It has not finished yet. We are in no hurry.'] },
    { at: [-66, -214], radius: 2, palette: pal('#e6d3b8'), lines: ['~curious~ The archways only open to the light. Stand here when the sun is low.', '~neutral~ Beyond? More glass. It is always more glass.'], shy: true },
  ],
};
