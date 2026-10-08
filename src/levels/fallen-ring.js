import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { groundRibbon } from './reference-kit.js';
import { bankBush } from './wood-kit.js';
import { CLOUD_PRINT } from './arzach2.js';
import { greebles } from './greeble-kit.js';
import { mergeWithMaterials, restKey } from '../vertex-material.js';
import { PEOPLE as EDENA_PEOPLE } from '../story/edena-data.js';
import { PEOPLE as SPHERES_PEOPLE } from '../story/spheres-data.js';
import { ringThrough, tree, village, serviceStair, grazer, puff, cloudBank, moveParts, merged, RING_LOOK, RING_DAY, RING_TONES } from './fallen-ring-kit.js';

// ---------------------------------------------------------------------------
// The Fallen Ring: a broken orbital ring resting across a vast sage-green plain (references/The Fallen Ring/; its
// views in the References, reference-fallenring.js; the shapes in fallen-ring-kit.js). Off the route: no story to
// follow, a few people to meet, the grazing beasts, the scale of the thing.
//
// The layout: the ship lands on the open plain in the south; a path runs north to the long tube lying across the
// grass, its village along its south foot (houses built into the cut-away bottom of its hull, awnings out in front),
// service stairs up its flank to the crest, its east end broken open on a street inside. Behind it the great arch
// stands, its legs 540 m apart, its top 200 m up, the storeys inside its legs bared; east of the tube's end the
// tilted segment leans on its crushed vermilion foot. West, a low segment lies round a village on timber posts (a
// stair up onto its top and its grove); east, the vault half-sunk in the grass with its village, and behind it a
// great tube broken open end-on. Far off all round, the rest of the ring: arches and tubes paling in the haze.
//
// Solid as drawn where walked: the hulls (their skins are a few thousand faces each), the houses, posts, stairs,
// the floor inside the tube's broken end. Drawn only: the trees' crowns, awnings, the interiors behind the openings,
// the far ring and the cumulus. The beasts wander in herds and shy from you (one instanced draw for their fleece,
// one for their legs and heads).
// ---------------------------------------------------------------------------

const T = RING_TONES;
export const SHIP = { x: 0, z: 230 };
/** The long tube lying across the plain: three points of its centre line ([x, z]), its radius, sunk 2 m. */
export const TUBE = { A: [-210, -40], M: [-60, -26], B: [90, -44], r: 11 };
export const TILTED = { x: 160, z: -66 };
/** The burned mark on the tilted piece's foot (the detour's trace): where, which way it faces, how high. */
export const RING_MARK = { at: [139.6, 0, -51.85], yaw: -0.9, lift: 1.5 };   // (on the vermilion foot's face, 0.3 m out from it)
export const ARCH = { A: [-330, -320], M: [-60, 200, -345], B: [210, -305] };   // (its top leaning back: it fell)
export const BAND = { x: -190, z: 110, R: 80, y: 17 };              // the low segment round the village on posts
export const VAULT = { A: [118, 112], M: [170, 96], B: [226, 86], r: 12 };
export const BIG = { A: [196, 52], M: [255, 36], B: [324, 20], r: 22 };
/** The path from the ship to the tube's village, [x, z] points; the branches west to the band and east to the vault. */
export const PATH = [[0, 205], [-8, 160], [-28, 100], [-46, 50], [-58, 14]];
export const WEST = [[-20, 130], [-60, 142], [-100, 140]];
export const EAST = [[-14, 118], [50, 116], [100, 120]];
const LIMIT = 420;

const noise = createNoise2D(62101), noiseB = createNoise2D(62102);
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
const TUBE_LINE = [TUBE.A, TUBE.M, TUBE.B];
/** The plain: long low swells, laid level round the hulls, the villages and the ship, hills far off. */
export function height(x, z) {
  let h = fbm(noise, x * 0.004, z * 0.004, 3) * 4 + noiseB(x * 0.02, z * 0.02) * 0.3;
  // (level pads: what lies on the plain lies on level ground)
  let flat = 0;
  flat = Math.max(flat, smoothstep(40, 18, nearLine(TUBE_LINE, x, z)));
  flat = Math.max(flat, smoothstep(BAND.R + 40, BAND.R + 22, Math.hypot(x - BAND.x, z - BAND.z)));
  flat = Math.max(flat, smoothstep(50, 26, nearLine([VAULT.A, VAULT.M, VAULT.B], x, z)), smoothstep(60, 34, nearLine([BIG.A, BIG.M, BIG.B], x, z)));
  flat = Math.max(flat, smoothstep(40, 16, Math.hypot(x - SHIP.x, z - SHIP.z)), smoothstep(40, 22, Math.hypot(x - TILTED.x, z - TILTED.z)));
  h *= 1 - flat;
  const e = Math.hypot(x, z);
  h += smoothstep(1500, 2100, e) * (40 + fbm(noiseB, x * 0.002, z * 0.002, 3) * 30);
  return h;
}

// ------------------------------------------------------------------ the herds (pure layout: the tests read it)
/** The herds' grounds: [x, z, r, n]. */
export const HERDS = [[-80, 40, 34, 11], [-150, 190, 30, 9], [150, 160, 34, 10], [-30, 120, 26, 7], [60, 20, 30, 8]];

export const RING_CONTENT = {
  weather: ['rain'],
  // no story to follow: the page names the place and closes on the tube's crest
  story: {
    title: 'THE FALLEN RING',
    intro: 'A ring that once turned round the sky lies broken across the grass. Its pieces stand as arches higher than clouds, and people have moved into the low ones.',
    outro: 'From the tube’s crest the whole fall shows: the arch over everything, the tilted piece, the far arcs pale in the haze. The beasts graze where it landed.',
    label: 'the long tube’s crest', goal: [TUBE.M[0], 2 * TUBE.r - 2, TUBE.M[1]], radius: 6, verticalRadius: 4, manual: true,   // (no beacon: nothing to do here but look)
  },
  relics: { spots: [], names: [] },
  // two people from elsewhere who came to see it, and the ring's own folk
  npcs: [
    { ...EDENA_PEOPLE.oro, at: [TUBE.B[0] - 14, TUBE.B[1] + 1], radius: 1.5, kind: 'm', world: 'edena', lang: 'edena',
      lines: ['~curious~ Pyramids grow slowly. This fell quickly. Both took a long time.', '~happy~ Look, they planted a garden in its street.'],
      talk: { listen: [
        '~neutral~ Oro, from Viridel. I grow pyramids. I came to see a thing that was built, for once, and then fell down.',
        '~curious~ It was a street, this. Up was the middle of the ring. Now up is the sky, and the lamps hang sideways.',
        '~playful~ The folk here grow beans along the old floor. Very straight rows. The ring was good at straight.',
        { after: 'met.oro', say: '~solemn~ Something that big falls, and the grass just goes on. I find that a comfort.' },
      ] } },
    { ...SPHERES_PEOPLE.ivo, at: [TUBE.M[0] + 4, TUBE.M[1] - 1], y: 2 * TUBE.r - 2.2, radius: 1.2, kind: 'm', world: 'spheres', lang: 'spheres',
      lines: ['~shout~ The view! The arch goes right into the cloud!', '~happy~ I climbed the tube. Next, the tilted one. Then the arch. Then lunch.'],
      talk: { listen: [
        '~happy~ Emrys. I climb things. The Garden of Spheres ran out of things.',
        '~curious~ Look at the arch’s legs, the cut-open floors in them. People lived in there, sideways, and they kept their gardens.',
        '~whisper~ The far pieces go all the way round the horizon. If you squint, you can see where the circle was.',
        '~tired~ The tilted one is steeper than it looks. Everything here is bigger than it looks.',
      ] } },
    // the ring's own folk
    { at: [TUBE.M[0] - 20, TUBE.M[1] + 18], radius: 3, lang: 'edena', lines: ['~happy~ We live in the low end. The high ends we leave to the birds.', '~neutral~ The hull keeps the rain off and the wind out. Better than any roof we could build.'] },
    { at: [BAND.x + 60, BAND.z + 26], radius: 3, lang: 'edena', lines: ['~curious~ The band was lying on the grass when my grandmother came. We put it up on posts and moved in under.', '~playful~ Go up the stair. The grove on top was planted by the first ones under it.'] },
    { at: [HERDS[0][0] + 10, HERDS[0][1] - 6], radius: 4, lang: 'edena', lines: ['~neutral~ They graze where it’s green, and it’s green everywhere. Easy beasts.', '~whisper~ Don’t run at them. They spook and then they sulk for a day.'] },
    { at: [VAULT.A[0] - 4, VAULT.A[1] + 12], radius: 2, lang: 'edena', lines: ['~solemn~ The vault was a hall of something once. Machines, my father said. Now it’s a hall of us.', '~happy~ The big broken one behind it has a park inside. Mind the ledge.'] },
    { at: [TILTED.x - 26, TILTED.z + 18], radius: 2, lang: 'edena', lines: ['~scared~ Nobody goes up the tilted one. It still creaks in the heat.', '~curious~ When it fell, they say it rang. All of it. For a whole day.'] },
  ],
  // the detour's trace (src/story/sightings-detours.js): the makers' sign, burned into the tilted piece's foot by a hand that learned it
  traces: [{
    id: 'fallenring.mark', at: RING_MARK.at, label: 'the burned mark', range: 3.4, height: 5,
    look: [RING_MARK.at[0], RING_MARK.lift + 1.3, RING_MARK.at[2]],   // (the prompt over it, not on it)
    glyph: { size: 1.6, yaw: RING_MARK.yaw, lift: RING_MARK.lift, color: '#70e7df' },
    person: { id: 'trace.fallenring', name: 'A mark on the fallen ring', title: '', color: '#70e7df',
      talk: { nodes: { look: { say: [
        '~solemn~ (Burned into the plating at the tilted piece’s foot. Years old, by the moss in the scorch, but burned deeper than any weather has reached since. Three dots over an arc, {glyph}.)',
        '~whisper~ (But the arc wavers, stops, and starts again where the hand lifted. Whoever drew this did not make it. They learned it, and drew it carefully, the way you write a word in a language that isn’t yours.)',
      ], do: { set: { 'sight.fallenring.mark': true } } } } } },
  }],
};

/** The level's colours: a teal-blue day, a rose dusk, a deep green-blue night where the windows glow. */
export const RING_SKY = {
  day: RING_DAY,
  dusk: ['#8a90b8', '#f2c8a0', '#7a7aa4', '#ffe0c4', '#ffc488'],
  night: ['#102434', '#22404c', '#2c4a5c', '#c4d4e0', '#f0e8d8'],
};

// ------------------------------------------------------------------ building
const SOLID = { solid: true, shadow: true }, SOLID_NS = { solid: true, shadow: false }, LOOSE = { solid: false, shadow: true }, LOOSE_NS = { solid: false, shadow: false };
const CELL = 220;
/** Where the tube's service stairs land on its flank (the section's share: 32° from level there), and their run over their rise. */
export const STAIR_S = 0.16, STAIR_RUN = 1.75;

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildFallenRing(scene) {
  const terrain = yield* Terrain.make({
    size: 3400, seg: 220, height,   // (15 m: the plain is gentle; the ring's far pieces stand on it out to 1.6 km)
    material: { color: T.grass, color2: T.grass2, color3: T.grass3, mode: MODE_TERRAIN, ticks: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const root = new THREE.Group();
  root.name = 'The Fallen Ring';
  scene.add(root);

  // ---- the kits by cell, and the materials
  const kits = new Map(), lights = [], noShadow = [];
  const kitAt = (x, z) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!kits.has(k)) { const group = new THREE.Group(); group.name = `cell ${k}`; root.add(group); kits.set(k, new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 62100 + kits.size })); }
    return kits.get(k);
  };
  const first = kitAt(0, 0), DS = THREE.DoubleSide, opts = new Map();
  const mat = (o) => { const m = first.mat(o); opts.set(m, o); return m; };
  const M = {
    hull: mat({ color: T.hull, shade: 0.12, hatch: 0.3, form: true, detail: 'built', detailDensity: 0.55, patches: 0.35 }),
    red: mat({ color: T.red, shade: 0.12, hatch: 0.3, form: true, detail: 'built', detailDensity: 0.5, patches: 0.35 }),
    cut: mat({ color: T.cut, shade: 0.4, hatch: 0.4, side: DS }),
    inner: mat({ color: T.inner, shade: 0.6, hatch: 0.6, side: DS }),
    floor: mat({ color: T.floor, flat: true, side: DS }),
    joint: mat({ color: T.joint, shade: 0.12, hatch: 0.3 }),
    frame: mat({ color: T.frame, flat: true, thin: 1.5 }),
    green: mat({ color: T.green, pattern: 'leaves', hatch: 1.4, shade: 0.5, spot: 0 }),
    green2: mat({ color: T.green2, pattern: 'leaves', hatch: 1.4, shade: 0.5, spot: 0 }),
    bark: mat({ color: T.bark, flat: true }),
    plaster: mat({ color: T.plaster, flat: true, weathered: 0.3 }),
    wood: mat({ color: T.wood, flat: true }),
    dark: mat({ color: T.dark, flat: true }),
    glow: mat({ color: T.glow, glow: 0.7, flat: true }),
    cloth: mat({ color: T.cloth, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    cloth2: mat({ color: T.cloth2, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    goods: mat({ color: T.goods, flat: true }),
    metal: mat({ color: '#5c6a64', flat: true }),
    path: mat({ color: T.path, shade: 0.25, hatch: 0.3, side: DS }),
  };
  const NAMES = new Map([[M.hull, 'the hull'], [M.red, 'the vermilion'], [M.cut, 'broken edges'], [M.inner, 'the inside wall'], [M.floor, 'floors inside'], [M.joint, 'collars'], [M.frame, 'ribs and rails'], [M.green, 'foliage'], [M.green2, 'foliage'], [M.bark, 'trunks'], [M.plaster, 'houses'], [M.wood, 'timber'], [M.dark, 'doors'], [M.glow, 'windows'], [M.cloth, 'awnings'], [M.cloth2, 'awnings'], [M.goods, 'goods'], [M.metal, 'machinery'], [M.path, 'the path']]);
  const FLORA = new Set([M.green, M.green2]);
  // roles a part comes in -> its material and whether it is solid where walked
  const by = { hull: M.hull, red: M.red, cut: M.cut, inner: M.inner, floor: M.floor, joint: M.joint, frame: M.frame, green: M.green, bark: M.bark, plaster: M.plaster, wood: M.wood, dark: M.dark, glow: M.glow, cloth: M.cloth, cloth2: M.cloth2, goods: M.goods };
  /** A builder's parts (world space) added by role into the cell at (x, z). solid: which roles collide. */
  // the flat-coloured surfaces (timber, doors, goods, trunks), the foliage and the awnings: every tone of one surface in
  // one mesh a cell (vertex-material.js, S_VMAT), so a cell is a handful of draws, twice with the shadows
  const VM = new Set([M.wood, M.dark, M.goods, M.bark, M.green, M.green2, M.cloth, M.cloth2]);
  const vms = new Map();
  const addVM = (k, m, g, solid, shadow) => {
    const key = `${restKey(m)}|${solid ? 1 : 0}|${shadow ? 1 : 0}`;
    if (!vms.has(k)) vms.set(k, new Map());
    const cell = vms.get(k);
    if (!cell.has(key)) cell.set(key, { solid, shadow, items: [] });
    if (!g.attributes.normal) g.computeVertexNormals();
    cell.get(key).items.push({ geometry: g, x: 0, y: 0, z: 0, rotY: 0, material: m });
  };
  // (small things and what is inside or on the hull cast no shadow: a shadow draw saved per cell)
  const NO_SHADOW = new Set(['glow', 'frame', 'dark', 'goods', 'joint', 'cut', 'inner', 'floor']);
  /** A builder's parts (world space) added by role into the cell at (x, z). solid: which roles collide. */
  const put = (x, z, parts, solid = [], shadow = true) => {
    const k = kitAt(x, z);
    for (const [role, list] of Object.entries(parts)) {
      if (!Array.isArray(list) || !by[role]) continue;
      for (const g of list) {
        if (!g?.isBufferGeometry) continue;
        const m = role === 'green' && (g.id & 1) ? M.green2 : by[role], o = { solid: solid.includes(role), shadow: shadow && !NO_SHADOW.has(role) };
        if (VM.has(m)) addVM(k, m, g, o.solid, o.shadow); else k.add(m, g, o);
      }
    }
  };
  const lamp = (x, y, z, r) => lights.push(new THREE.Vector4(x, y, z, r));
  const HULL = ['hull', 'red', 'joint', 'cut', 'inner', 'floor', 'frame', 'plaster', 'wood', 'dark', 'glow', 'goods'];   // (the skin, its edges, the inside wall, floors, ribs and the houses inside: solid as drawn)
  const yAt = (pts, k = 0) => pts.map(([x, z]) => H(x, z) + k);

  // ---------------------------------------------------------- the paths
  yield;
  for (const [pts, w] of [[PATH, 2.4], [WEST, 1.8], [EAST, 1.8]]) first.add(M.path, groundRibbon(H, pts, w, 0.05), LOOSE_NS);

  // ---------------------------------------------------------- the long tube, its village, its stairs, its broken end
  yield;
  const tubeY = Math.min(...yAt(TUBE_LINE)) + TUBE.r - 2;
  const tube = ringThrough({ lie: true, A: [TUBE.A[0], tubeY, TUBE.A[1]], M: [TUBE.M[0], tubeY, TUBE.M[1]], B: [TUBE.B[0], tubeY, TUBE.B[1]], w: TUBE.r * 2, h: TUBE.r * 2, round: 2.3, seg: 4, sseg: 36, joints: 26,
    bands: [{ t: [0.9, 1], s: [0, 1] }], ends: { 0: false, 1: { rag: 3, deep: 18, floors: 2 } }, open: [{ t: [0.04, 0.78], s: [0.86, 0.99], ribs: 18, floors: 2 }], seed: 1, detail: 0.9 });
  put(TUBE.M[0], TUBE.M[1], tube, HULL);
  const outward = (q) => q.n.clone().setY(0).normalize();
  {
    // the village along its foot, under the overhang, in rows of 30 m
    for (let t = 0.05; t < 0.76; t += 0.115) {
      const a = tube.at(t, 0), b = tube.at(Math.min(0.77, t + 0.11), 0), n = outward(a).add(outward(b)).normalize(), mid = a.p.clone().lerp(b.p, 0.5).addScaledVector(n, -0.5);
      const Vg = village({ x0: -a.p.distanceTo(b.p) / 2, x1: a.p.distanceTo(b.p) / 2, seed: 10 + t * 50, high: [3.4, 4.4], deep: [3, 5], upper: 0.7, plaster: 0.4, detail: 0.8 });
      const m = new THREE.Matrix4().makeRotationY(Math.atan2(n.x, n.z)).setPosition(mid.x, H(mid.x, mid.z) - 0.1, mid.z);
      moveParts(Vg, (g) => g.applyMatrix4(m));
      put(mid.x, mid.z, Vg, ['plaster', 'wood', 'dark', 'goods']);
      for (const p of Vg.lights.slice(0, 5)) { const q = new THREE.Vector3(...p).applyMatrix4(m); lamp(q.x, q.y, q.z, 4); }
    }
    // the service stairs up its flank to the crest
    // (each lands on the flank where it is gentle enough to walk up, and runs out far enough to clear the bulge below)
    for (const t of [0.2, 0.47, 0.72]) {
      const top = tube.at(t, STAIR_S, 0.05), n = outward(top), foot = top.p.clone().addScaledVector(n, (top.p.y - H(top.p.x, top.p.z)) * STAIR_RUN);
      put(foot.x, foot.z, serviceStair([foot.x, H(foot.x, foot.z) + 0.02, foot.z], [top.p.x, top.p.y, top.p.z], { w: 1.8 }), ['wood', 'frame']);
    }
    // trees from its seams on the crest
    for (const [t, s, h, r, sd] of [[0.14, 0.24, 14, 9, 1], [0.27, 0.23, 9, 6, 2], [0.4, 0.27, 9, 5.5, 3], [0.62, 0.25, 7, 4, 4], [0.95, 0.18, 7, 4, 5]]) {
      const q = tube.at(t, s, -0.4), Tr = tree({ h, r, seed: sd, up: q.n.clone().lerp(new THREE.Vector3(0, 1, 0), 0.75).normalize() });
      moveParts(Tr, (g) => g.translate(q.p.x, q.p.y, q.p.z));
      put(q.p.x, q.p.z, Tr, ['bark']);
    }
    // inside the broken end: a floor along the old street, lamps, a garden and benches
    const e0 = tube.at(0.9, 0.75), e1 = tube.at(1, 0.75), dir = e1.p.clone().sub(e0.p).setY(0), len = dir.length() - 2;
    dir.normalize();
    const fy = Math.max(e0.p.y, e1.p.y) + 3, mid = e0.p.clone().lerp(e1.p, 0.5), yaw = Math.atan2(dir.x, dir.z);   // (a metre over the grass: the hull lies 2 m sunk)
    kitAt(mid.x, mid.z).add(M.wood, new THREE.BoxGeometry(12, 0.4, len).rotateY(yaw).translate(mid.x, fy - 0.2, mid.z), SOLID_NS);
    for (let k = 0; k < 4; k++) {
      const p = e0.p.clone().addScaledVector(dir, 3 + (k * len) / 4);
      kitAt(p.x, p.z).add(M.glow, new THREE.SphereGeometry(0.25, 8, 6).translate(p.x, fy + 5, p.z), LOOSE_NS); lamp(p.x, fy + 5, p.z, 7);
      kitAt(p.x, p.z).add(k % 2 ? M.green : M.green2, bankBush(k * 3 + 1).scale(1.6, 1.2, 1.6).translate(p.x + Math.cos(yaw) * 4, fy + 0.5, p.z - Math.sin(yaw) * 4), LOOSE);
    }
    // (a ramp up onto it from the grass at the broken end)
    const r0 = e1.p.clone().addScaledVector(dir, 6);
    put(r0.x, r0.z, serviceStair([r0.x, H(r0.x, r0.z) + 0.02, r0.z], [e1.p.x - dir.x * 1.5, fy, e1.p.z - dir.z * 1.5], { w: 3, rise: 0.2 }), ['wood', 'frame']);
  }

  // ---------------------------------------------------------- the tilted segment on its crushed foot
  yield;
  const tilted = ringThrough({ A: [TILTED.x - 10, -10, TILTED.z + 4], M: [TILTED.x + 18, 80, TILTED.z - 16], B: [TILTED.x + 54, 170, TILTED.z - 38], w: 34, h: 32, round: 2.6, seg: 5, sseg: 32, joints: 22,
    bands: [{ t: [0, 0.22], s: [0, 1] }, { t: [0.3, 0.34], s: [0.1, 0.4] }], ends: { 1: { rag: 8, deep: 14, floors: 3 } }, holes: 0.2, seed: 2, detail: 0.9 });
  put(TILTED.x, TILTED.z, tilted, HULL);
  for (const [t, s, h, r, sd] of [[0.22, 0.42, 9, 5, 7], [0.4, 0.45, 10, 5.5, 8], [0.55, 0.4, 9, 5, 9], [0.12, 0.6, 7, 4, 10]]) {
    const q = tilted.at(t, s, -0.4), Tr = tree({ h, r, seed: sd, up: q.n.clone().lerp(new THREE.Vector3(0, 1, 0), 0.6).normalize() });
    moveParts(Tr, (g) => g.translate(q.p.x, q.p.y, q.p.z)); put(TILTED.x, TILTED.z, Tr, []);
  }

  // ---------------------------------------------------------- the great arch, its legs' storeys bared
  yield;
  const arch = ringThrough({ A: [ARCH.A[0], 0, ARCH.A[1]], M: ARCH.M, B: [ARCH.B[0], 0, ARCH.B[1]], ext: [40, 40], w: 56, h: 64, round: 3.2, seg: 9, sseg: 28, joints: 60,
    open: [{ t: [0.83, 0.97], s: [0.4, 0.62], ribs: 10, mode: 'x', step: 12, scale: 2.2, up: -1 }, { t: [0.03, 0.17], s: [0.38, 0.6], ribs: 10, mode: 'x', step: 12, scale: 2.2 }], seed: 3, detail: 0.8 });
  put(ARCH.M[0], ARCH.M[2], arch, HULL);
  for (const [t0, t1] of [[0.85, 0.96], [0.04, 0.16]]) {
    const G = greebles(5 + t0 * 10), n = 6;
    for (let k = 0; k < n; k++) {
      const t = t0 + ((t1 - t0) * (k + 0.5)) / n, q = arch.at(t, 0.5, -1.9), q2 = arch.at(t + 0.004, 0.5, -1.9), along = q2.p.clone().sub(q.p).normalize(), nIn = q.n.clone().negate(), side = new THREE.Vector3().crossVectors(nIn, along).normalize();
      G.patch(q.p.clone().addScaledVector(along, -10).addScaledVector(side, -10), along, side, nIn, 20, 20, { density: 1, scale: 3 });
    }
    const g = G.merged(), at = arch.at((t0 + t1) / 2, 0.5).p, k = kitAt(at.x, at.z);
    if (g.metal) k.add(M.metal, g.metal, SOLID_NS); if (g.dark) k.add(M.dark, g.dark, SOLID_NS); if (g.pale) k.add(M.cut, g.pale, SOLID_NS);   // (on the solid inside wall: solid as it)
  }

  // ---------------------------------------------------------- the vault and its village, the great tube broken open behind it
  yield;
  const vy = Math.min(...yAt([VAULT.A, VAULT.M, VAULT.B])) + 1;
  const vault = ringThrough({ lie: true, A: [VAULT.A[0], vy, VAULT.A[1]], M: [VAULT.M[0], vy, VAULT.M[1]], B: [VAULT.B[0], vy, VAULT.B[1]], w: VAULT.r * 2, h: VAULT.r * 2, round: 2.2, seg: 4, sseg: 36, joints: 22,
    ends: { 0: { rag: 1.5, deep: 14, floors: 2 }, 1: false }, bands: [{ t: [0.6, 0.85], s: [0.85, 0.95] }], seed: 4, detail: 0.9 });
  put(VAULT.M[0], VAULT.M[1], vault, HULL);
  for (let t = 0.06; t < 0.7; t += 0.2) {
    const a = vault.at(t, 0), b = vault.at(t + 0.18, 0), n = outward(a).add(outward(b)).normalize(), mid = a.p.clone().lerp(b.p, 0.5).addScaledVector(n, -2.5);
    const Vg = village({ x0: -a.p.distanceTo(b.p) / 2, x1: a.p.distanceTo(b.p) / 2, seed: 30 + t * 40, high: [3, 4], upper: 0.3, detail: 0.8 });
    const m = new THREE.Matrix4().makeRotationY(Math.atan2(n.x, n.z)).setPosition(mid.x, H(mid.x, mid.z) - 0.1, mid.z);
    moveParts(Vg, (g) => g.applyMatrix4(m)); put(mid.x, mid.z, Vg, ['plaster', 'wood', 'dark', 'goods']);
    for (const p of Vg.lights.slice(0, 4)) { const q = new THREE.Vector3(...p).applyMatrix4(m); lamp(q.x, q.y, q.z, 4); }
  }
  const by2 = Math.min(...yAt([BIG.A, BIG.M, BIG.B])) + BIG.r - 2;
  const big = ringThrough({ lie: true, A: [BIG.A[0], by2, BIG.A[1]], M: [BIG.M[0], by2, BIG.M[1]], B: [BIG.B[0], by2, BIG.B[1]], ext: [0, 60], w: BIG.r * 2, h: BIG.r * 2, round: 2.1, seg: 5, sseg: 40, joints: 30,
    ends: { 0: { rag: 4, deep: 30, floors: 4 } }, bands: [{ t: [0.25, 0.4], s: [0.05, 0.2] }], seed: 5, detail: 0.9 });
  put(BIG.M[0], BIG.M[1], big, HULL);
  { const q = big.at(0.3, 0.25, -0.4), Tr = tree({ h: 9, r: 6, seed: 21 }); moveParts(Tr, (g) => g.translate(q.p.x, q.p.y, q.p.z)); put(q.p.x, q.p.z, Tr, []); }

  // ---------------------------------------------------------- the low band round the village on its posts
  yield;
  const bandAt = (deg, y = BAND.y) => { const a = (deg * Math.PI) / 180; return [BAND.x + Math.cos(a) * BAND.R, y, BAND.z - Math.sin(a) * BAND.R]; };
  const band = ringThrough({ lie: true, A: bandAt(-40), M: bandAt(60), B: bandAt(160), w: 12, h: 26, round: 4, seg: 4, sseg: 36, joints: 30,
    bands: [{ t: [0, 1], s: [0.965, 0.025] }], ends: { 0: { rag: 3, deep: 10, floors: 1 }, 1: { rag: 4, deep: 10, floors: 1 } }, seed: 6, detail: 0.9 });
  put(BAND.x, BAND.z, band, HULL);
  {
    // posts under it, both edges; the houses in two rings beneath it, a street between them
    for (let t = 0.02; t < 0.99; t += 0.018) for (const s of [0.69, 0.81]) {
      const q = band.at(t, s, -0.2), y0 = H(q.p.x, q.p.z) - 0.3;
      kitAt(q.p.x, q.p.z).add(M.wood, new THREE.CylinderGeometry(0.32, 0.38, q.p.y - y0, 6).translate(q.p.x, (q.p.y + y0) / 2, q.p.z), SOLID);
    }
    for (let t = 0.03; t < 0.95; t += 0.075) for (const side of [1, -1]) {
      const a = band.at(t, 0), b = band.at(t + 0.065, 0), n = outward(a).add(outward(b)).normalize();
      // (the outer ring faces out from under the band's edge; the inner faces in, toward the band's heart)
      const c = a.p.clone().lerp(b.p, 0.5).addScaledVector(n, side > 0 ? -7.5 : -18.5).setY(0), facing = side > 0 ? n : n.clone().negate();
      const len = a.p.distanceTo(b.p) * (side > 0 ? 0.95 : 0.7);
      const Vg = village({ x0: -len / 2, x1: len / 2, seed: 50 + t * 80 + side, high: [4.2, 5.2], upper: 0.6, awnings: 0.8, plaster: 0.25, detail: 0.8 });
      const m = new THREE.Matrix4().makeRotationY(Math.atan2(facing.x, facing.z)).setPosition(c.x, H(c.x, c.z) - 0.1, c.z);
      moveParts(Vg, (g) => g.applyMatrix4(m)); put(c.x, c.z, Vg, ['plaster', 'wood', 'dark', 'goods']);
      for (const p of Vg.lights.slice(0, 3)) { const q = new THREE.Vector3(...p).applyMatrix4(m); lamp(q.x, q.y, q.z, 4); }
    }
    // the stair up onto its top at its east end, the grove on top
    const top = band.at(0.06, 0.2, 0.05), n = outward(top), foot = top.p.clone().addScaledVector(n, (top.p.y - H(top.p.x, top.p.z)) * 1.2);
    put(foot.x, foot.z, serviceStair([foot.x, H(foot.x, foot.z) + 0.02, foot.z], [top.p.x, top.p.y, top.p.z], { w: 2 }), ['wood', 'frame']);
    for (const [t, h, r, sd] of [[0.55, 16, 12, 41], [0.66, 20, 14, 42], [0.77, 15, 11, 43], [0.3, 8, 5, 44], [0.15, 9, 6, 45]]) {
      const q = band.at(t, 0.25, -0.3), Tr = tree({ h, r, seed: sd });
      moveParts(Tr, (g) => g.translate(q.p.x, q.p.y, q.p.z)); put(q.p.x, q.p.z, Tr, ['bark']);
    }
  }

  // ---------------------------------------------------------- trees in groves on the plain
  yield;
  {
    const rng = mulberry32(62160);
    for (const [gx, gz, n, rr] of [[-120, 80, 5, 14], [40, 160, 3, 10], [-260, -20, 6, 18], [90, -140, 4, 14], [-40, -160, 4, 16], [260, 160, 4, 14]]) {
      for (let i = 0; i < n; i++) {
        const x = gx + (rng() - 0.5) * rr * 2, z = gz + (rng() - 0.5) * rr * 2;
        if (nearLine(PATH, x, z) < 6 || nearLine(WEST, x, z) < 5 || nearLine(EAST, x, z) < 5) continue;
        const h = 7 + rng() * 6, Tr = tree({ h, r: h * 0.5, seed: i + gx, lean: [(rng() - 0.5) * 0.15, (rng() - 0.5) * 0.15] });
        moveParts(Tr, (g) => g.translate(x, H(x, z), z)); put(x, z, Tr, ['bark']);
      }
    }
  }

  // ---------------------------------------------------------- the rest of the ring, far off: one draw, no ink of its own
  yield;
  const far = [];
  {
    const parts = { hull: [], red: [] };
    for (const [i, o] of [
      { A: [700, -60, -1300], M: [1000, 340, -1350], B: [1300, -60, -1400], w: 60, h: 60 },
      { lie: true, A: [-1500, 25, -500], M: [-1450, 25, 100], B: [-1500, 25, 700], w: 46, h: 46 },
      { A: [1100, -20, 800], M: [1150, 200, 750], B: [1180, 380, 720], w: 50, h: 50, ends: { 1: false } },
      { A: [-1300, -80, 1100], M: [-1000, 200, 1200], B: [-700, -80, 1300], w: 46, h: 46 },
      { A: [-900, -40, -1250], M: [-800, 160, -1180], B: [-650, 300, -1100], w: 50, h: 50, ends: { 1: false } },
      { lie: true, A: [600, 18, 1500], M: [900, 18, 1350], B: [1200, 18, 1300], w: 36, h: 36 },
    ].entries()) {
      const P = ringThrough({ ...o, seg: 30, sseg: 12, round: 3, joints: 0, bands: i % 2 ? [] : [{ t: [0, 0.18], s: [0, 1] }], seed: 20 + i, wrap: false });
      parts.hull.push(...P.hull, ...P.cut); parts.red.push(...P.red);
      if (i % 2 === 0) yield;
    }
    for (const [role, color] of [['hull', T.far], ['red', '#e6b8a0']]) {
      const g = merged(parts[role]);
      if (!g) continue;
      const m = new THREE.Mesh(g, makeMaterial({ color, shade: 0.4, hatch: 0.1, line: 0.5, lineTint: 0.7, side: DS }));
      m.userData.noCollide = true; m.name = `the far ring (${role})`;
      scene.add(m); noShadow.push(m); far.push(m);
    }
  }

  // ---------------------------------------------------------- the great cumulus round the horizon (instanced)
  yield;
  {
    const rng = mulberry32(62170), list = cloudBank(rng, { n: 18, az0: -Math.PI, az1: Math.PI, d0: 950, d1: 1400, base: 70, size: [70, 130], tall: 1.3, eye: [0, 0] });
    const cm = makeMaterial({ color: '#fffcf4', ...CLOUD_PRINT, shade: 0.45, line: 0.45, lineTint: 0.8, glow: 0.4 });
    for (const [sub, det] of [[list.filter((p) => p.s > 100), 2], [list.filter((p) => p.s <= 100), 1]]) {
      const im = new THREE.InstancedMesh(puff(det, 3), cm, sub.length), dm = new THREE.Object3D();
      sub.forEach((p, i) => { dm.position.set(p.x, p.y, p.z); dm.scale.set(p.s, p.s * p.sy, p.s * 0.8); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
      im.userData.noCollide = true; im.userData.floats = true; im.name = 'cumulus'; im.frustumCulled = false;
      scene.add(im); noShadow.push(im); far.push(im);
    }
  }

  // ---------------------------------------------------------- the herds
  yield;
  const herds = new Herds(scene, H, HERDS, noShadow);

  // ---------------------------------------------------------- finishing: each cell's meshes
  yield;
  for (const k of kits.values()) {
    k.finish();
    for (const g of (vms.get(k) ?? new Map()).values()) {
      const m = new THREE.Mesh(mergeWithMaterials(g.items), makeMaterial({ ...opts.get(g.items[0].material), perVertex: true }));
      if (!g.solid) m.userData.noCollide = true;
      if (!g.shadow) noShadow.push(m);
      m.name = `${NAMES.get(g.items[0].material) ?? 'surfaces'}${g.solid ? ' (solid)' : ''}`;
      if (FLORA.has(g.items[0].material)) m.userData.flora = true;
      k.group.add(m);
    }
    for (const m of k.group.children) { if (!m.name) m.name = NAMES.get(m.material) ?? ''; if (FLORA.has(m.material)) m.userData.flora = true; }
    noShadow.push(...k.noShadow);
    lights.push(...k.lights);
    yield;
  }

  const spawn = new THREE.Vector3(0, H(0, SHIP.z - 26) + 0.05, SHIP.z - 26);   // (clear of the ship's hull and ramp)
  return {
    id: 'fallenring',
    ground: terrain,
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: LIMIT,
    shipSite: { x: SHIP.x, z: SHIP.z, heading: Math.PI },   // (its ramp toward the path and the tube)
    features: { mount: false, wind: true, jetpack: false, climb: true },
    defaults: { hour: 10.5, preset: 'Moebius print', cloudShadows: 0, look: RING_LOOK },
    sky: { script: RING_SKY, planets: [{ az: 60, el: 22, size: 1.8, color: '#f4ece0', craters: true }] },
    killY: -Infinity,
    lights,
    noShadow,
    reactions: false,   // (nothing grows into the pictures' grass: reactive-world.js)
    floraAvoid: (x, z, r) => nearLine(PATH, x, z) < 1.4 + r || nearLine(WEST, x, z) < 1.2 + r || nearLine(EAST, x, z) < 1.2 + r,
    far,
    herds,
    parts: { tube, tilted, arch, vault, big, band },
    life: {
      flocks: [{ count: 16, color: '#2e3a34', size: 0.8, radius: 120, height: [40, 90], speed: 0.3, seed: 62 }, { count: 10, color: '#2e3a34', size: 0.6, radius: 60, height: [20, 50], speed: 0.4, seed: 63 }],
      motes: { count: 120, color: '#fff6d0', size: 0.05, glow: 0.5, rise: 0.02, wind: [0.1, 0.02] },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 1, name: 'The Fallen Ring' }),
    update(dt, t, ctx = {}) { herds.update(dt, ctx.player?.pos); },
  };
}
export const createFallenRing = stepped(buildFallenRing);

// ------------------------------------------------------------------ the grazing beasts
/**
 * Herds of woolly beasts grazing on their grounds: each walks slowly to a spot near its herd, grazes there a while
 * (its head down, a slow nod), and shies from the traveller (trots off past 7 m, settles again). Two instanced draws
 * for all of them (the fleece, the dark legs and heads); far from the eye they stand still.
 */
export class Herds {
  constructor(scene, H, grounds, noShadow = []) {
    this.H = H;
    const rng = mulberry32(62180), G = grazer(1);
    this.beasts = [];
    for (const [gx, gz, r, n] of grounds) for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
      this.beasts.push({ home: [gx, gz, r], x: gx + Math.cos(a) * d, z: gz + Math.sin(a) * d, yaw: rng() * 6.3, s: 0.85 + rng() * 0.35, tx: 0, tz: 0, wait: rng() * 8, speed: 0, phase: rng() * 6 });
    }
    for (const b of this.beasts) { b.tx = b.x; b.tz = b.z; }
    const make = (geo, color, flat) => {
      const m = new THREE.InstancedMesh(geo, makeMaterial(flat ? { color, flat: true } : { color, shade: 0.4, hatch: 0.3 }), this.beasts.length);
      m.userData.noCollide = true; m.userData.dynamic = true; m.name = 'grazers'; m.frustumCulled = false;
      scene.add(m); noShadow.push(m);
      return m;
    };
    this.wool = make(G.wool[0], RING_TONES.wool, false);
    this.dark = make(G.dark[0], RING_TONES.woolDark, true);
    this.rng = rng;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this.t = 0;
    this.update(0.016, null, true);
  }
  /** Where beast b stands now (for the tests). */
  at(i) { const b = this.beasts[i]; return [b.x, b.z]; }
  update(dt, eye, force = false) {
    this.t += dt;
    const rng = this.rng;
    let moved = force;
    for (const [i, b] of this.beasts.entries()) {
      const far = eye && Math.hypot(b.x - eye.x, b.z - eye.z) > 160;
      if (far && !force) continue;
      // shy: the traveller near, trot away from them
      const near = eye ? Math.hypot(b.x - eye.x, b.z - eye.z) : Infinity;
      if (near < 7) { const ax = b.x - eye.x, az = b.z - eye.z, k = 12 / Math.max(near, 0.1); b.tx = b.x + ax * k; b.tz = b.z + az * k; b.wait = 0; b.speed = 2.6; }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const sp = (b.speed || 0.7) * dt, want = Math.atan2(dx, dz);
        let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        b.yaw += dy * Math.min(1, dt * 2.5);
        b.x += Math.sin(b.yaw) * Math.min(sp, d); b.z += Math.cos(b.yaw) * Math.min(sp, d);
        moved = true;
      } else if ((b.wait -= dt) <= 0) {
        // another spot to graze, near its herd's ground
        const [gx, gz, r] = b.home, a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * r;
        b.tx = gx + Math.cos(a) * rr; b.tz = gz + Math.sin(a) * rr; b.wait = 6 + rng() * 14; b.speed = 0.5 + rng() * 0.4;
      }
      const walking = d > 0.3, nod = walking ? 0 : Math.sin(this.t * 1.3 + b.phase) * 0.04;
      this._m.compose(this._p.set(b.x, this.H(b.x, b.z) - 0.05 + (walking ? Math.abs(Math.sin(this.t * 6 + b.phase)) * 0.04 : 0), b.z), this._q.setFromEuler(this._e.set(nod, b.yaw, 0, 'YXZ')), this._s.setScalar(b.s));
      this.wool.setMatrixAt(i, this._m); this.dark.setMatrixAt(i, this._m);
    }
    if (moved) { this.wool.instanceMatrix.needsUpdate = true; this.dark.instanceMatrix.needsUpdate = true; }
  }
}
