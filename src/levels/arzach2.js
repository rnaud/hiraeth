import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { formAxis, padForm } from '../form.js';
import { fbm, mulberry32, smoothstep, lerp } from '../noise.js';
import { TAU, nA, nB, nC, clean, place, lumpy, solid, table, needle, boulder, drips } from './sky-stones-kit.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { Bird, STAND } from '../bird.js';
import { attachTemple } from '../temples/index.js';
import { stepped } from '../load-steps.js';
import { placeShop } from '../shop-world.js';
import { SHOPS } from '../shop.js';
import { rockKnobs } from './greeble-kit.js';

// ---------------------------------------------------------------------------
// Vael II: The Sky Stones. Bone-white needle clusters, balanced stones and
// wide mushroom tables rise out of a sea of cloud. Cliff-top monasteries and
// ruined aqueducts link the plateaus; past them a peach plain runs to a lone
// tower. Rock is drawn flat cream in light and blue-grey in shade, with dense
// ink under every overhang.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------- the look (the reference sheets, docs/systems/references.md, "Vael II's sheets")
/** How flat the rock's, the plain's and the buildings' shade is printed (makeMaterial shadeFlat). */
export const SKY_STONES_FLAT = 0.85;
/**
 * The print preset's touches: a clean sky (no cumulus bank, no flat clouds: the sea of cloud is the
 * world's own), the undersides of caps and overhangs the darkest (no bounce), little half-tone.
 */
/** The plain's far stones and the tower in light pale bands of the sky's haze (post.js 4b). */
// (v0.95: the layers a pale lilac-blue, as the sheets' band of haze where the far plain meets the sky)
export const SKY_STONES_HAZE = { uHazeLayers: [200, 2, 0.11, 4], uHazeTone: [0.86, 0.86, 0.94, 0.6] };
/** The sheets draw the plain with hardly a cast shadow (post.js CAST): most of a shadow on open ground lifted, walls and stones keep theirs. */
// (v0.95: the shadow a cap throws on its own stalk lifted a third and its spot black a deep blue, not a grey-black: the sheets
//  shade the stalks a light blue-grey under dense blue strokes)
export const SKY_STONES_CAST = { uCast: [0.7, 0.3], uSpotTone: [0.2, 0.27, 0.36, 0.35] };
export const SKY_STONES_LOOK = { uCumulus: 0, uClouds: 0, uBounce: 0, uHalftone: 0.15, uShadeKeep: 0, ...SKY_STONES_HAZE, ...SKY_STONES_CAST };
/** The day's colours: sky top, horizon, the shadow's grey-blue, light, sun. */
/** The crevasses' and the plain's steep faces: a red-brown, lit and hatched as the sheets draw them, never spot black. */
export const CREVASSE = { wall: '#c0664a', strokes: 1 };   // (strokes: the lit walls' strokes, materials.js S_TERRAIN)
/** The sea of cloud's print: its shade a flat pale grey-blue (lifted, the look's own flat print), no strokes, no spot black. */
export const CLOUD_PRINT = { shade: 0.55, shadeFlat: 1, hatch: 0, spot: 0 };
export const SKY_STONES_DAY = ['#a6cccf', '#f4cdb0', '#8ea6b8', '#f8f0e6', '#fff2dc'];
/** Dusk's and night's colours, their shadow the day's grey-teal (warmer at dusk, deeper at night), not the old violet. */
export const SKY_STONES_DUSK = ['#f2ae8c', '#f6c4a0', '#9a9fae', '#ffd9bc', '#ffe2c0'];
export const SKY_STONES_NIGHT = ['#262a3c', '#4a4a5e', '#3a4752', '#a8a8c0', '#f2f0e6'];

// ---------------------------------------------------------------- layout
const CLOUD_Y = -36;          // the cloud deck; below UNSAFE_Y you are put back
const UNSAFE_Y = -44;
const PLAIN_Y = 38;
const PLAIN_EDGE = -900;
const START = { x: 0, z: 0, R: 88, top: 40, dome: 1.2 };
const MONASTERY = { x: -240, z: -215, R: 72, top: 76, dome: 1 };
const NEEDLES = { x: 215, z: -250, R: 95, top: 40, dome: 1 };
const TABLE = { x: -30, z: -450, R: 58, top: 64, dome: 5 };      // the great mushroom table
const ISLAND = { x: 240, z: -520, R: 32, top: 128, dome: 1.2 };  // floating monastery island
const DISC = { x: -128, z: -78, top: 70, R: 9.5 };               // column with a disc cap and an egg
const TOWER = { x: 70, z: -1500 };
const AQ1 = { a: [52, -58], b: [150, -178], y: 40 };              // start plateau -> needle plateau
const plainEdge = (x) => PLAIN_EDGE + nA(x * 0.004, 3.1) * 40 + nB(x * 0.013, 9) * 10;
const AQ2 = { a: [215, -325], b: [215, plainEdge(215) - 30], y: 40 };   // needle plateau -> the plain
// the story's places (src/story/arzach2.js)
const BELL = { x: -228, z: -239, w: 7.5, h: 30 };                 // the monastery's bell tower (its open belfry)
// sky stones climbing from the great table's east rim: each a boost-jump above the last
// (the first half a metre higher since the rim collides as drawn: it stood that much below its drawn edge)
const SKY = [[32, -446.3, 67.1, 2.7], [36.5, -439.5, 70.2, 2.4], [34, -433, 73.2, 2.8], [39.5, -429, 76.2, 2.4], [45, -432.5, 79.2, 2.4],
  [49, -437.5, 82.2, 2.8], [51.5, -444, 85.2, 2.4], [48.5, -450, 88.2, 2.4], [42.5, -452.5, 91.2, 3.4]];
const CAIRN = { x: -18, z: -438 };                                 // on the great table, toward the stones
const CLAPPER = { x: 251, z: -503 };                               // on the floating island, before the church door
const FACE = {};                                                   // filled in when the tower is built

const tableTop = (t, r = 0) => t.top + t.dome * (1 - Math.min((r / t.R) ** 2, 1));
const aq1Mid = [(AQ1.a[0] + AQ1.b[0]) / 2, (AQ1.a[1] + AQ1.b[1]) / 2];

export const ARZACH2_CONTENT = {
  weather: [],
  // the story is a quest (src/story/arzach2-data.js): this page closes when the bell has rung and Calix has given you its note
  story: {
    title: 'THE BELL UNDER THE CLOUD',
    intro: 'The stones float above a sea of cloud. On the rose cliff, a monastery bell has been silent for thirty years.',
    outro: 'The repaired bell rang, and the cloud dropped a little. Calix has resumed his rounds. Your tank carries the note with you.',
    label: 'the lone tower', goal: [TOWER.x, 'ground', TOWER.z], radius: 30, manual: true,
  },
  relics: {
    spots: [
      { at: [MONASTERY.x + 18, tableTop(MONASTERY, 20) + 1.1, MONASTERY.z + 6], snap: true },
      { at: [DISC.x + 5, DISC.top + 1.1, DISC.z], snap: true },
      { at: [TABLE.x, tableTop(TABLE) + 1.1, TABLE.z], snap: true },
      { at: [aq1Mid[0], AQ1.y + 1.1, aq1Mid[1]], snap: true },
      { at: [ISLAND.x - 12, tableTop(ISLAND, 12) + 1.1, ISLAND.z + 8], snap: true },
    ],
    names: ['Bell-rope tassel', 'Egg-stone pebble', 'Mushroom-cap seed', 'Aqueduct keystone', 'Island prayer bead'],
  },
  npcs: [
    { at: [-14, 30], y: START.top, radius: 5, palette: { cloak: '#b9a7d8', lining: '#2b211f', cloth: '#e2d3b4', legs: '#2b2f45' },
      lines: ['~solemn~ The stones fell up, long ago. Some of them never came down.', '~neutral~ Whistle and the bird will come. She does not like the cloud.', '~scared~ A hand’s width higher than last spring. I wrote it down.', '~playful~ If the cloud reaches my door, I’m moving in with Calix.'] },
    { at: [MONASTERY.x - 20, MONASTERY.z - 22], y: MONASTERY.top, radius: 4, palette: { cloak: '#f3ead8', lining: '#2b211f', cloth: '#6a3a4a', legs: '#4a3a2a' },
      lines: ['~sad~ The bell has not rung since the cloud rose.', '~sad~ From the tower roof you can see the plain. Only Ondine lives out there, and nobody goes to see her.', '~neutral~ The yoke is oiled. The yoke is always oiled.', '~sad~ Thirty years of dawns with nothing to ring at them.'] },
    { at: [195, -1010], radius: 6, palette: { cloak: '#e9a17f', lining: '#2b211f', cloth: '#343a56', legs: '#3a3a3a' },
      lines: ['~tired~ Walk toward the tower. It does not get closer for a long time.', '~solemn~ The cracks in the plain are older than the sky.', '~curious~ The face on the tower has a mark on its brow. Three dots and an arc. Look.', '~happy~ Some evenings a lamp burns on the rose cliff. I wave. My sister pretends not to see.'], shy: true },
  ],
};

/**
 * Aqueduct / natural arch: a deck from a to b at deckY(u), with arches
 * opening below it and piers dropping into the cloud.
 */
export function bridge(o) {
  const { a, b, y0, y1 = y0, W = 9, bays = 4, pier = 0.28, rise = 1, thick = 4, bottom = -120, seed = 0, rough = 0.5, ends = 0.06, flare = 0, step = 1.1, bulge = 0 } = o;
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, px = -uz, pz = ux;
  const n = Math.ceil(L / step), sp = (L * (1 - 2 * ends)) / bays, half = (sp * (1 - pier)) / 2;
  const S = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * L, deck = lerp(y0, y1, s / L);
    const sl = s - L * ends;
    let yb = bottom, inPier = true;
    if (sl > 0 && sl < L * (1 - 2 * ends)) {
      const q = sl - Math.floor(sl / sp) * sp, xq = (q - sp / 2) / half;
      if (Math.abs(xq) < 1) { inPier = false; yb = deck - thick - half * rise * (1 - Math.sqrt(1 - xq * xq)); }
    }
    const nn = nA(s * 0.15 + seed, seed), nm = nB(s * 0.05 + seed, 3), nr = nC(s * 0.045 + seed, 7);
    if (!inPier) yb += (nr * 2.2 + nn * 0.4) * rough;
    const w = W * (inPier ? 1.14 : 1) * (1 + 0.06 * nm + flare * Math.pow(Math.abs(2 * s / L - 1), 3)) + nn * rough;
    S.push({ cx: a[0] + ux * s, cz: a[1] + uz * s, top: deck, yb: Math.min(yb, deck - thick * 0.6), w });
  }
  const pos = [];
  const v = (s, side, yy, k = 1) => [s.cx + px * side * s.w * 0.5 * k, yy, s.cz + pz * side * s.w * 0.5 * k];
  const quad = (p0, p1, p2, p3) => pos.push(...p0, ...p1, ...p2, ...p1, ...p3, ...p2);
  // natural arches bulge out along the middle of their flanks and narrow underneath
  const mid = (s) => s.top - Math.min(thick * 0.45, (s.top - s.yb) * 0.4);
  const kb = 1 - bulge * 0.5;
  for (let i = 0; i < n; i++) {
    const A = S[i], B = S[i + 1];
    quad(v(A, -1, A.top), v(A, 1, A.top), v(B, -1, B.top), v(B, 1, B.top));       // deck
    for (const sd of [1, -1]) {
      const top = [v(A, sd, A.top), v(B, sd, B.top)], md = [v(A, sd, mid(A), 1 + bulge), v(B, sd, mid(B), 1 + bulge)], bt = [v(A, sd, A.yb, kb), v(B, sd, B.yb, kb)];
      if (sd > 0) { quad(top[0], md[0], top[1], md[1]); quad(md[0], bt[0], md[1], bt[1]); }
      else { quad(md[0], top[0], md[1], top[1]); quad(bt[0], md[0], bt[1], md[1]); }
    }
    quad(v(A, 1, A.yb, kb), v(A, -1, A.yb, kb), v(B, 1, B.yb, kb), v(B, -1, B.yb, kb));   // underside / arch intrados
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return { g, S, ux, uz, px, pz, L };
}

// ---------------------------------------------------------------- terrain
function height(x, z) {
  const edge = plainEdge(x);
  const floor = -110 + fbm(nB, x * 0.003, z * 0.003, 3) * 12;
  let plain = PLAIN_Y + fbm(nA, x * 0.0016, z * 0.0016, 3) * 4 + nB(x * 0.02, z * 0.02) * 0.4;
  // the far plain rises a touch toward the horizon
  plain += smoothstep(-1900, -2500, z) * 18;
  const dl = Math.hypot((x - AQ2.b[0]) * 1.2, Math.min(z - AQ2.b[1], 0) * 0.8);
  plain = lerp(AQ2.y - 0.15, plain, smoothstep(26, 70, dl));
  // dark fissures cracking the plain
  const wx = x + nB(x * 0.003, z * 0.003) * 90, wz = z + nA(x * 0.003 + 5, z * 0.003) * 90;
  const f = 1 - Math.abs(nC(wx * 0.0024, wz * 0.0024));
  let crack = smoothstep(0.95, 0.985, f) * 16;
  crack *= smoothstep(edge - 50, edge - 130, z) * smoothstep(60, 110, Math.hypot(x - TOWER.x, z - TOWER.z)) * smoothstep(50, 90, dl);
  plain -= crack;
  const h = lerp(floor, plain, smoothstep(edge + 22, edge - 22, z));
  // low far mesas close the horizon
  const rim = Math.max(Math.abs(x), Math.abs(z));
  return h + smoothstep(2000, 2550, rim) * (55 + fbm(nA, x * 0.0015, z * 0.0015, 2) * 25);
}

// ---------------------------------------------------------------- the level
// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildArzach2(scene) {
  const rng = mulberry32(2026);
  const R = (a, b) => a + rng() * (b - a);
  // the sheets print every shade of the rock, the plain and the buildings flat in one grey-blue at the
  // surface's value (makeMaterial shadeFlat), whatever its colour; the people, the bird and the flowers keep theirs
  const PRINT = { shadeFlat: SKY_STONES_FLAT };
  const terrain = yield* Terrain.make({
    size: 5200, seg: 320, height,
    material: { color: '#eda584', color2: '#f2b48f', color3: CREVASSE.wall, mode: MODE_TERRAIN, ripples: true, spot: 0, strataHatch: CREVASSE.strokes, ...PRINT },
  });
  scene.add(terrain.mesh);

  const DS = THREE.DoubleSide;
  const M = {
    // (the needles' shade a flat tone with few strokes and no beds in the light, as the sheets draw them)
    // (form: a table's strokes radiate from its stalk under the cap and run down the stalk, src/form.js)
    bone: makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', mode: MODE_STRATA, strataSize: 7, flat: true, side: DS, hatch: 0.4, strataHatch: 0, form: true, ...PRINT }),
    // the needles: the bone, its shade by the stalk's own round form (sky-stones-kit.js needle: smooth normals without the
    // flutes), so the terminator runs down a needle in one clean band as on the sheets, not facets lit in islands
    needle: makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', mode: MODE_STRATA, strataSize: 7, side: DS, hatch: 0.4, strataHatch: 0, form: true, ...PRINT }),
    cap: makeMaterial({ color: '#f5e5d1', color2: '#f3e0cb', color3: '#f6e9d8', mode: MODE_STRATA, strataSize: 5, side: DS, form: true, ...PRINT }),   // smooth: clean terminator under the caps
    rose: makeMaterial({ color: '#d9a59a', color2: '#c98f86', color3: '#e3b5a8', mode: MODE_STRATA, strataSize: 9, flat: true, side: DS, form: true, ...PRINT }),
    aq: makeMaterial({ color: '#ece3d3', color2: '#e0d5c4', color3: '#f2ebde', mode: MODE_STRATA, strataSize: 2.6, flat: true, side: DS, ...PRINT }),
    wall: makeMaterial({ color: '#f8f3ea', flat: true, pattern: 'facade', ...PRINT }),
    plainWall: makeMaterial({ color: '#f6efe2', flat: true, ...PRINT }),
    roof: makeMaterial({ color: '#c9765c', flat: true, pattern: 'tiles', ...PRINT }),
    dome: makeMaterial({ color: '#cf8164', flat: true, ...PRINT }),
    dark: makeMaterial({ color: '#3c4660', flat: true }),
    tree: makeMaterial({ color: '#5d7562', flat: true }),
    tower: makeMaterial({ color: '#f4ecdc', color2: '#ebdfc8', color3: '#f8f2e6', mode: MODE_STRATA, strataSize: 9, flat: true, ...PRINT }),
  };
  const vis = new Map();
  const col = [];
  // what you stand on and climb is the drawn rock itself (solid: false for what you pass through). The
  // coarse copies the builders also make (a table's every-other ring at 18 sides, a needle's hexagon, a
  // boulder's bare icosahedron, a low mound) lay up to metres inside the drawn surface: feet sank into the
  // drawn caps and boulders and the traveller climbed half inside the needles (docs/systems/movement.md, "Contact")
  const add = (mat, g, solid = true) => {
    if (!vis.has(mat)) vis.set(mat, []);
    const c = clean(g, true);
    // (a needle's and a cap table's own smooth shading normals, by their round form without the flutes: sky-stones-kit.js)
    if ((mat === M.needle || mat === M.cap) && g.attributes.normal) c.setAttribute('normal', g.getAttribute('normal').clone());
    vis.get(mat).push(c);
    if (solid) col.push(clean(g));
  };
  const movers = [];
  const noShadow = [];

  // ---------------------------------------------------------- plateaus and mushroom tables
  yield;
  const shadowGeos = [];
  // (a table: its axis, for the strokes radiating from its stalk)
  const tableOf = (o) => { const t = table(o); formAxis(t.vis, 'cap', { centre: [o.x, 0, o.z] }); return t; };
  // the stalactites hang in their own mesh per material: drawn, never collided and never reachable
  // (nothing stands under a cap), so the contact audit leaves them alone as it leaves the floaters
  const dripGeos = new Map();
  const addTable = (mat, o) => {
    const t = tableOf(o); add(mat, t.vis);
    if (t.drip) { if (!dripGeos.has(mat)) dripGeos.set(mat, []); dripGeos.get(mat).push(t.drip); }   // (with their own normals: sky-stones-kit.js drips)
    // the knobs and ribs of rock under a cap's overhang (greeble-kit.js rockKnobs): the sheets draw the undersides lumpy
    // and pocketed, the spot blacks' pockets; drawn only, with the drips (nothing stands under a cap)
    if (mat === M.cap && o.R > 12) {
      const kr = mulberry32(Math.floor(o.seed * 991) + 3), spots = [];
      for (let i = 0, n = Math.round(o.R * 3); i < n; i++) {
        const u = 0.15 + kr() * 0.72, { p, n: nn } = t.underAt(u, kr() * TAU);
        spots.push({ p, n: nn, s: o.R * (0.02 + kr() * 0.028) * (0.6 + u) });
      }
      const g = rockKnobs(spots, o.seed);
      if (g) { if (!dripGeos.has(mat)) dripGeos.set(mat, []); dripGeos.get(mat).push(t.lean(g)); }
    }
    if (mat === M.cap) shadowGeos.push(clean(t.shadow));
    return t;
  };
  // the start plateau: a wide table with an overhanging lip
  addTable(M.bone, { ...START, stalk: 70, capT: 6, under: 11, seed: 1.3, rib: 1.3, ribK: 44, seg: 176, colSeg: 24, outline: 0.15, foot: 0.92, neckR: 0.97, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 23,
    drips: { n: 44, len: [0.031, 0.087], r: 0.0238, band: [0.5, 0.97] } });
  // the monastery cliff: rose rock, the lip leaning out toward the start
  addTable(M.rose, { ...MONASTERY, stalk: 62, capT: 6, under: 9, seed: 4.1, rib: 1.6, ribK: 40, seg: 160, colSeg: 22, off: [20, 12], foot: 0.95, neckR: 0.97, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 21,
    drips: { n: 38, len: [0.031, 0.0928], r: 0.0255, band: [0.5, 0.97] } });
  // the needle plateau
  addTable(M.bone, { ...NEEDLES, stalk: 78, capT: 6, under: 10, seed: 7.7, rib: 1.2, ribK: 44, seg: 176, colSeg: 24, off: [-10, 0], foot: 0.92, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 25,
    drips: { n: 44, len: [0.031, 0.087], r: 0.0238, band: [0.5, 0.97] } });
  // the great mushroom table
  addTable(M.cap, { ...TABLE, stalk: 17, capT: 7, under: 20, seed: 2.2, rib: 2.4, ribK: 36, seg: 160, colSeg: 26, outline: 0.1, flute: 0.12, fluteK: 13, foot: 1.5, neckR: 1.25, waist: 0.22,
    drips: { n: 40, len: [0.0434, 0.1102], r: 0.0272, band: [0.35, 0.95] } });
  // smaller tables rising from the cloud sea, and some on the plain
  const HOODOOS = [
    [-120, -330, 26, 30], [95, -410, 22, 50], [-170, -545, 34, 22], [340, -110, 30, 56], [-330, 30, 24, 36],
    [160, 95, 20, 26], [390, -430, 28, 32], [-70, 170, 30, 46], [-370, -390, 22, 58], [110, -560, 16, 70],
    [470, -260, 18, 24], [-460, -40, 26, 20], [-60, -720, 30, 44], [120, -800, 24, 30], [-260, -760, 36, 52], [380, -720, 26, 40],
  ];
  const tables = [START, MONASTERY, NEEDLES, TABLE].map((t) => ({ x: t.x, z: t.z, R: t.R }));
  // (the lean: each tips about its own neck, so its cap's plane goes off the horizontal and its stalk
  //  slants under it, as the sheets draw them; from the noise, so the rest of the world keeps its seeds)
  const hoodooLean = (i, k = 0.1) => [nA(i * 2.7 + 0.3, 11) * k, nB(i * 2.7 + 0.3, 11) * k];
  HOODOOS.forEach(([x, z, r, top], i) => {
    addTable(M.cap, { x, z, R: r, top, dome: r * 0.07, stalk: r * R(0.28, 0.38), capT: r * R(0.1, 0.15), under: r * R(0.26, 0.36),
      seed: i * 3.7 + 0.4, rib: r * 0.04, ribK: 30, seg: 112, colSeg: 18, flute: 0.1, fluteK: 9 + (i % 5), foot: 1.6, neckR: 1.3, waist: 0.24,
      lean: hoodooLean(i), drips: { n: 9, len: [0.0372, 0.0928], r: 0.0306, band: [0.45, 0.92] },
      off: [R(-0.12, 0.12) * r, R(-0.12, 0.12) * r] });
    tables.push({ x, z, R: r });
  });
  // tables standing on the peach plain, framing the tower
  const PLAIN_HOODOOS = [[150, -1060, 46, 58], [80, -1020, 18, 17], [-140, -1090, 30, 30], [330, -1210, 24, 22], [-330, -1260, 36, 34]];
  PLAIN_HOODOOS.forEach(([x, z, r, h], i) => {
    const base = terrain.baseAt(x, z, r * 0.4);
    addTable(M.cap, { x, z, R: r, top: base + h, base: base - 4, dome: r * 0.08, stalk: r * R(0.32, 0.42), capT: r * 0.13, under: r * 0.3,
      seed: 30 + i * 2.9, rib: r * 0.045, ribK: 32, seg: 128, colSeg: 18, flute: 0.11, fluteK: 10 + i, foot: 1.5, neckR: 1.25, waist: 0.2,
      lean: hoodooLean(i + 20, 0.07), drips: { n: 10, len: [0.031, 0.0754], r: 0.0272, band: [0.5, 0.94] }, off: [r * 0.1, 0] });
  });
  // rose cliff walls on the west and east of the chasm
  const ROSE = [[-480, -320, 44, 96], [-520, -140, 36, 82], [-430, -520, 40, 60], [540, -180, 48, 72], [520, -420, 34, 90], [-540, 120, 40, 50]];
  ROSE.forEach(([x, z, r, top], i) => {
    addTable(M.rose, { x, z, R: r, top, dome: 0.8, stalk: r * 0.82, capT: r * 0.2, under: r * 0.2, seed: 50 + i * 1.7, rib: 0.8, ribK: 30, seg: 96, colSeg: 18,
      flute: 0.1, fluteK: 14, foot: 0.9, neckR: 0.95, waist: 0.04, outline: 0.18, drips: { n: 20, len: [0.031, 0.0812], r: 0.0272, band: [0.55, 0.97] } });
    tables.push({ x, z, R: r });
  });

  // ---------------------------------------------------------- the floating island
  yield;
  {
    const { x, z, R: r, top } = ISLAND;
    const rs = [[-50, 0.06], [-47, 0.2], [-41, 0.38], [-32, 0.57], [-22, 0.74], [-12, 0.88], [-5, 0.97], [-1.6, 1.02], [-0.3, 0.975]].map(([y, s]) => ({ y: top + y, r: r * s, ox: 0, oz: 0 }));
    for (const k of [0.9, 0.7, 0.45, 0.2]) rs.push({ y: top + ISLAND.dome * (1 - k * k), r: r * k, ox: 0, oz: 0 });
    const shape = (detail) => (a, rg) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      let m = 1 + 0.16 * nA(ca * 1.3 + 9, sa * 1.3 + rg.y * 0.02);
      if (detail && rg.y < top - 3) m *= 1 - 0.1 * Math.pow(0.5 + 0.5 * Math.sin(13 * a + 2 * nB(ca, sa + rg.y * 0.05)), 3);
      return [m, 0];
    };
    add(M.bone, place(solid(rs, 96, shape(true), { top: [0, top + ISLAND.dome, 0], bottom: [3, top - 53, 2] }), x, 0, z));
  }

  // ---------------------------------------------------------- needle clusters
  yield;
  const cluster = (cx, cy, cz, H, Rr, n, seed, rubble = true, mat = M.bone) => {
    const r2 = mulberry32(seed * 97 + 3);
    const nd = needle({ x: cx, y: cy, z: cz, H, R: Rr, seed: seed + 0.1, seg: 18, rings: 28, lean: (r2() - 0.5) * 0.08 });
    const nm = mat === M.bone ? M.needle : mat;
    add(nm, nd.vis);
    for (let i = 0; i < n; i++) {
      // the first few lean on the main needle like wax drips, the rest stand apart
      const fused = i < Math.ceil(n / 2), a = r2() * TAU, d = Rr * (fused ? 0.55 + r2() * 0.4 : 1.3 + r2() * 1.5);
      const h = H * (fused ? 0.22 + r2() * 0.4 : 0.15 + Math.pow(r2(), 1.3) * 0.5), rr = Rr * (fused ? 0.4 + r2() * 0.25 : 0.3 + r2() * 0.35);
      const s = needle({ x: cx + Math.cos(a) * d, y: cy - 1, z: cz + Math.sin(a) * d, H: h, R: rr, seed: seed + i * 1.37 + 0.5, seg: 14, rings: 20, lean: (r2() - 0.5) * 0.25 });
      add(nm, s.vis);
    }
    if (!rubble) return nd;
    // rounded boulder piles at the foot
    for (let i = 0; i < 9 + n; i++) {
      const a = r2() * TAU, d = Rr * (0.6 + r2() * 2.2), br = Rr * (0.18 + r2() * 0.32);
      const bx = cx + Math.cos(a) * d, bz = cz + Math.sin(a) * d;
      const sx = 1 + r2() * 0.4, sy = 0.65 + r2() * 0.3, sz = 0.9 + r2() * 0.3, ry = r2() * TAU;
      add(mat, place(boulder(br, sx, sy, sz, 0.1, seed + i), bx, cy + br * sy * 0.35, bz, ry));
    }
    // a low rubble mound round the base
    const mound = new THREE.SphereGeometry(1, 22, 6, 0, TAU, 0, Math.PI / 2);
    lumpy(mound, 0.18, 1.6, seed);
    const mr = Rr * 2.6, mh = Rr * 0.7;
    add(mat, place(mound, cx, cy - 0.5, cz, 0, mr, mh, mr));
    return nd;
  };
  // on the start plateau
  cluster(-48, START.top, -30, 74, 7.5, 5, 1);
  // the great needle forest on the needle plateau
  cluster(NEEDLES.x + 10, NEEDLES.top, NEEDLES.z - 8, 175, 15, 7, 2);
  cluster(NEEDLES.x - 42, NEEDLES.top, NEEDLES.z + 40, 96, 9, 5, 3);
  cluster(NEEDLES.x + 55, NEEDLES.top, NEEDLES.z + 30, 70, 7, 4, 4);
  // rising straight out of the cloud
  const CLOUD_NEEDLES = [[-95, -215, 170, 13, 6], [420, -300, 210, 16, 7], [40, -640, 140, 12, 5], [0, 330, 190, 15, 6], [310, 220, 150, 12, 5],
    [-260, 260, 170, 13, 6], [-330, -190, 130, 10, 4], [330, -620, 160, 12, 5], [-620, -300, 240, 18, 7], [640, -60, 220, 16, 6],
    [-180, -840, 170, 13, 6], [60, -860, 120, 10, 4], [-420, -700, 200, 15, 6]];
  CLOUD_NEEDLES.forEach(([x, z, h, r, n], i) => { if (h) cluster(x, -70, z, h + 70, r, n, 10 + i, false); });
  // needle clusters on the plain
  [[-280, -1030, 120, 10, 6], [380, -1140, 150, 12, 6], [-60, -1650, 110, 9, 5], [260, -1700, 90, 8, 4], [-420, -1410, 170, 14, 6]].forEach(([x, z, h, r, n], i) => {
    cluster(x, terrain.baseAt(x, z, r * 2) + 0.5, z, h, r, n, 30 + i);
  });

  // ---------------------------------------------------------- balanced stones
  yield;
  const stack = (x, y, z, stones, seed, mat = M.bone) => {
    const r2 = mulberry32(seed * 31 + 1);
    let yy = y;
    let ox = 0, oz = 0;
    for (const [r, sy, egg, crack = 0] of stones) {
      const sx = 1 + r2() * 0.25, sz = 0.85 + r2() * 0.3, ry = r2() * TAU, tilt = (r2() - 0.5) * 0.25;
      yy += r * sy * 0.92;
      add(mat, place(boulder(r, sx, sy, sz, egg, seed + yy, true, crack), x + ox, yy, z + oz, ry, 1, 1, 1, tilt, -tilt));
      yy += r * sy * 0.92;
      ox += (r2() - 0.5) * r * 0.35; oz += (r2() - 0.5) * r * 0.35;
    }
    return yy;
  };
  // on the start plateau: a teetering column of pebbles
  stack(36, START.top - 0.5, -42, [[5.5, 0.62, 0.05, 0.2], [4.6, 0.72, 0.1], [3.8, 0.8, 0.15, 0.24], [3.2, 0.68, 0.05], [2.4, 0.9, 0.2, 0.18]], 1);
  stack(58, START.top - 0.5, 20, [[3.2, 0.6, 0], [2.6, 0.8, 0.1], [1.8, 0.85, 0.2]], 2);
  // on the needle plateau
  stack(NEEDLES.x - 40, NEEDLES.top - 0.5, NEEDLES.z - 50, [[7, 0.6, 0, 0.22], [6, 0.75, 0.1], [4.6, 0.85, 0.1, 0.26], [3.2, 0.95, 0.25, 0.2]], 3);
  // on the plain
  stack(30, terrain.heightAt(30, -1140) - 0.5, -1140, [[6, 0.55, 0, 0.2], [5, 0.8, 0.1], [4.2, 0.7, 0, 0.24], [3.4, 0.9, 0.2], [2.2, 1, 0.25, 0.2]], 4);
  stack(-200, terrain.heightAt(-200, -1190) - 0.5, -1190, [[4, 0.6, 0], [3.4, 0.8, 0.1], [2.4, 1.1, 0.25]], 5);
  // a tall stone column out of the cloud, with mushroom discs and stacked stones (page 2)
  yield;
  {
    const x = 128, z = -92;
    const col0 = needle({ x, y: -80, z, H: 120, R: 7, seed: 41, seg: 14, rings: 18, flute: 0.1, lean: 0 });
    add(M.needle, col0.vis);
    const disc = (dx, y, dz, rr, th, lean = null) => {
      const t = tableOf({ x: x + dx, z: z + dz, R: rr, stalk: rr * 0.18, top: y, base: y - th * 2.5, capT: th, under: th * 0.6, dome: th * 0.3, seed: y * 0.1, rib: 0.4, ribK: 20, seg: 64, colSeg: 14, foot: 1, neckR: 1, waist: 0, lean });
      add(M.cap, t.vis);
    };
    disc(0, 30, 0, 8, 1.4, [0.05, -0.07]);
    const y1 = stack(x, 31, z, [[3.8, 0.75, 0.1, 0.24], [3.4, 0.9, 0.15], [2.6, 0.7, 0.05, 0.2]], 6);
    disc(0.5, y1 + 2.5, 0.3, 11, 1.6, [-0.06, 0.05]);
    stack(x + 0.5, y1 + 3.5, z + 0.3, [[2.8, 0.8, 0.2, 0.26], [2, 0.9, 0.2]], 7);
  }
  // the disc column with an egg resting above it (page 1)
  yield;
  {
    const { x, z, top, R: r } = DISC;
    const shaft = tableOf({ x, z, R: r, stalk: 3.6, top, base: -95, capT: 1.8, under: 2.4, dome: 0.35, seed: 61, rib: 0.35, ribK: 22, seg: 96, colSeg: 16,
      flute: 0.14, fluteK: 7, foot: 2.1, neckR: 0.85, waist: 0.05 });
    add(M.bone, shaft.vis);
    add(M.bone, place(boulder(0.9, 1, 0.8, 1, 0, 3), x, top + 1.6, z), false);   // the pebble it balances on
    add(M.bone, place(boulder(3.6, 1, 2, 0.95, 0.12, 62, true, 0.26), x, top + 9.6, z, 0.3));
  }

  // ---------------------------------------------------------- aqueducts and arches
  yield;
  const aqueduct = (o, mat = M.aq, parapets = true) => {
    const br = bridge(o);
    add(mat, br.g);
    if (!parapets) return br;
    // broken parapet blocks along both edges
    for (let i = 4; i < br.S.length - 4; i += 3) {
      const s = br.S[i];
      for (const side of [-1, 1]) {
        if (nA(i * 0.21 + side * 7, o.seed ?? 0) < -0.05) continue;
        const h = 0.7 + nB(i * 0.5, side) * 0.35;
        const g = place(new THREE.BoxGeometry(0.8, h, 3.3), s.cx + br.px * side * (s.w * 0.5 - 0.4), s.top + h / 2, s.cz + br.pz * side * (s.w * 0.5 - 0.4), Math.atan2(br.ux, br.uz));
        add(mat, g);
      }
    }
    return br;
  };
  aqueduct({ a: AQ1.a, b: AQ1.b, y0: AQ1.y, W: 8, bays: 4, pier: 0.3, thick: 3.5, seed: 1 });
  aqueduct({ a: AQ2.a, b: AQ2.b, y0: AQ2.y, W: 8, bays: 10, pier: 0.32, thick: 3.5, seed: 2 });
  // a ruined, broken aqueduct below the monastery cliff (decoration)
  aqueduct({ a: [-360, -40], b: [-262, -74], y0: 2, W: 6, bays: 3, pier: 0.3, thick: 3, seed: 3, ends: 0 }, M.aq, false);
  aqueduct({ a: [-238, -82], b: [-150, -112], y0: 2, W: 6, bays: 3, pier: 0.3, thick: 3, seed: 4, ends: 0 }, M.aq, false);
  // natural arches: monastery cliff -> the great table, and between the west rose cliffs
  aqueduct({ a: [MONASTERY.x + 27, MONASTERY.z - 30], b: [TABLE.x - 20, TABLE.z + 22], y0: MONASTERY.top - 3, y1: TABLE.top - 2,
    W: 13, bays: 1, pier: 0.04, rise: 0.32, thick: 8, rough: 2.4, seed: 5, ends: 0, flare: 0.6, bulge: 0.35, bottom: MONASTERY.top - 52 }, M.bone, false);
  aqueduct({ a: [-486, -296], b: [-516, -162], y0: 90, y1: 76, W: 14, bays: 1, pier: 0.04, rise: 0.6, thick: 10, rough: 2.4, seed: 6, ends: 0, flare: 0.6, bulge: 0.35, bottom: 20 }, M.rose, false);

  // ---------------------------------------------------------- monasteries
  yield;
  const building = { walls: [], plain: [], roofs: [], domes: [], dark: [], trees: [] };
  const box = (list, x, y, z, w, h, d, ry = 0) => list.push(place(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry));
  // (the sheets' roofs are shallow red tile with a course of eaves overhanging the wall head)
  const gable = (x, y, z, w, d, ry = 0) => {
    const g = new THREE.BoxGeometry(w * 0.7071 * 1.08, w * 0.7071 * 1.08, d * 1.06).rotateZ(Math.PI / 4).scale(1, 0.42, 1);
    building.roofs.push(place(g, x, y, z, ry));
    building.roofs.push(place(new THREE.BoxGeometry(w * 1.18, 0.4, d * 1.22), x, y - 0.15, z, ry));
  };
  /** A loggia: a shaded recess behind a row of piers under round arches (the sheets' monastery ranges). */
  const arcade = (x, y, z, n, w, h, d, ry = 0) => {
    const ux = Math.cos(ry), uz = -Math.sin(ry), sp = w * 1.75;
    box(building.dark, x, y, z, n * sp, h + w * 0.8, d * 0.4, ry);
    for (let i = 0; i <= n; i++) box(building.walls, x + (i - n / 2) * sp * ux, y, z + (i - n / 2) * sp * uz, w * 0.52, h, d, ry);
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * sp;
      building.walls.push(place(new THREE.TorusGeometry(w * 0.74, w * 0.17, 4, 8, Math.PI), x + t * ux, y + h, z + t * uz, ry));
    }
    box(building.walls, x, y + h + w * 0.8, z, n * sp + w, 0.8, d * 1.15, ry);
  };
  /** An arched door or window, sunk into a wall face. */
  const arch = (x, y, z, w, h, ry = 0) => {
    box(building.dark, x, y, z, w, h, 0.4, ry);
    building.dark.push(place(new THREE.CylinderGeometry(w / 2, w / 2, 0.4, 9).rotateX(Math.PI / 2), x, y + h, z, ry, 1, 0.9, 1));
  };
  /** The ball and spike every dome carries on the sheets. */
  const finial = (x, y, z, r) => {
    building.walls.push(place(new THREE.SphereGeometry(r * 0.42, 7, 5), x, y + r * 0.5, z));
    building.walls.push(place(new THREE.ConeGeometry(r * 0.2, r * 0.9, 6), x, y + r * 1.05, z));
  };
  const house = (x, y, z, w, h, d, ry = 0) => {
    box(building.walls, x, y - 2, z, w, h + 2, d, ry);
    gable(x, y + h, z, w, d, ry);
  };
  const domed = (x, y, z, r, drum) => {
    building.plain.push(place(new THREE.CylinderGeometry(r, r, drum, 16), x, y + drum / 2, z));
    building.domes.push(place(new THREE.SphereGeometry(r * 1.06, 16, 8, 0, TAU, 0, Math.PI / 2), x, y + drum, z, 0, 1, 0.9, 1));
    building.walls.push(place(new THREE.CylinderGeometry(r * 0.12, r * 0.16, r * 0.6, 6), x, y + drum + r * 0.95 + r * 0.3, z));
    // the drum's little columns and the dome's finial (IMG_3787 panel 3)
    if (r >= 4.5) for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      building.walls.push(place(new THREE.CylinderGeometry(r * 0.075, r * 0.075, drum * 0.74, 5), x + Math.cos(a) * r * 1.03, y + drum * 0.37, z + Math.sin(a) * r * 1.03));
    }
    finial(x, y + drum + r * 0.95 + r * 0.6, z, r * 0.36);
  };
  const belltower = (x, y, z, w, h, round = false) => {
    if (round) building.plain.push(place(new THREE.CylinderGeometry(w / 2, w / 2 * 1.06, h + 2, 14), x, y - 2 + (h + 2) / 2, z));
    else box(building.plain, x, y - 2, z, w, h + 2, w);
    box(building.dark, x + w * 0.5, y + h * 0.45, z, 0.3, w * 0.4, w * 0.22);   // one slit window
    // the belfry: openings, a ledge and a little dome
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      box(building.dark, x + dx * w * 0.47, y + h - w * 1.05, z + dz * w * 0.47, dz ? w * 0.36 : 0.4, w * 0.62, dx ? w * 0.36 : 0.4);
    }
    building.walls.push(place(round ? new THREE.CylinderGeometry(w * 0.6, w * 0.6, 0.5, 14) : new THREE.BoxGeometry(w * 1.15, 0.5, w * 1.15), x, y + h + 0.25, z));
    building.domes.push(place(new THREE.SphereGeometry(w * 0.52, 14, 7, 0, TAU, 0, Math.PI / 2), x, y + h + 0.5, z, 0, 1, round ? 0.9 : 0.75, 1));
  };
  // the monastery's tower: an open belfry on four piers, so the bell shows (and swings)
  const openBelfry = (x, y, z, w, h) => {
    const b = y + h - w * 1.25;
    box(building.plain, x, y - 2, z, w, b - y + 2, w);
    box(building.walls, x, b - 0.4, z, w * 1.12, 0.8, w * 1.12);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(building.plain, x + dx * w * 0.4, b, z + dz * w * 0.4, w * 0.2, h - (b - y), w * 0.2);
    box(building.walls, x, y + h - 0.6, z, w * 1.05, 0.9, w * 1.05);
    box(building.dark, x + w * 0.5, y + h * 0.4, z, 0.3, w * 0.4, w * 0.22);
    building.walls.push(place(new THREE.BoxGeometry(w * 1.15, 0.5, w * 1.15), x, y + h + 0.25, z));
    building.domes.push(place(new THREE.SphereGeometry(w * 0.52, 14, 7, 0, TAU, 0, Math.PI / 2), x, y + h + 0.5, z, 0, 1, 0.75, 1));
    return b;
  };
  const cypress = (x, y, z, h) => building.trees.push(place(new THREE.ConeGeometry(h * 0.16, h, 7), x, y + h / 2, z));
  yield;
  {
    // the white monastery on the rose cliff, facing the start
    const y = MONASTERY.top + 0.3, x = MONASTERY.x - 10, z = MONASTERY.z - 6;
    BELL.y = y; BELL.floor = openBelfry(BELL.x, y, BELL.z, BELL.w, BELL.h);
    house(x, y, z, 16, 9, 26, 0.35);
    domed(x - 16, y, z + 8, 7, 9);
    building.walls.push(place(new THREE.BoxGeometry(16, 10, 16), x - 16, y - 2 + 5, z + 8));
    house(x + 4, y, z + 22, 10, 6, 12, 0.35 + Math.PI / 2);
    house(x - 30, y, z - 14, 9, 6, 10, 0.2);
    house(x + 14, y, z - 2, 8, 7, 9, 0.35);
    box(building.walls, x - 5, y - 1, z - 30, 28, 3.2, 1.2, 0.35);   // a low courtyard wall
    arcade(x + 2.6, y, z - 14.5, 5, 2.2, 4.4, 1.6, 0.35);             // the cloister along its south range
    arch(x - 7.2, y, z - 15.5, 2, 3.4, 0.35); arch(x - 16, y + 0.1, z - 0.2, 2.2, 3.6, 0);
    cypress(x - 32, y, z + 6, 11); cypress(x - 35, y, z + 2, 9); cypress(x + 30, y, z - 4, 10);
    cypress(x - 26, y, z - 22, 12); cypress(x - 22, y, z - 26, 9.5); cypress(x + 20, y, z + 16, 10.5);
  }
  yield;
  {
    // the floating island's church: a domed church between two towers (page 6)
    const y = ISLAND.top + 0.4, x = ISLAND.x + 2, z = ISLAND.z - 4;
    box(building.walls, x, y - 2, z, 14, 12, 14);
    domed(x, y + 10, z, 6, 4.5);
    house(x, y, z + 11, 10, 8, 10, Math.PI / 2);
    belltower(x - 11, y, z - 6, 4.5, 22, true);
    belltower(x + 11, y, z - 6, 4.5, 18, true);
    building.walls.push(place(new THREE.BoxGeometry(0.5, 3, 0.5), x, y + 10 + 4.5 + 6.6, z));      // a cross
    building.walls.push(place(new THREE.BoxGeometry(2, 0.5, 0.5), x, y + 10 + 4.5 + 7.2, z));
    arcade(x, y, z + 17.4, 4, 1.6, 3.4, 1.4, 0);                                                   // the porch before its door
    arch(x, y, z + 7.2, 2, 3.2, 0);
    cypress(x - 9, y, z + 12, 8); cypress(x + 9.5, y, z + 9, 7);
  }
  yield;
  {
    // a little hermitage on the start plateau's edge, like the panel with the domed chapel
    const x = -40, y = START.top + 0.2, z = 44;
    box(building.walls, x, y - 2, z, 8, 8, 8);
    domed(x, y + 6, z, 3.3, 2.5);
    house(x + 7, y, z + 1, 5, 4, 7, Math.PI / 2);
    arcade(x - 0.2, y, z + 5.1, 3, 1.3, 2.8, 1.2, 0);
    arch(x + 4.2, y, z - 2.4, 1.5, 2.4, Math.PI / 2);
    cypress(x - 6, y, z + 3, 7.5); cypress(x - 7.5, y, z - 1, 6);
  }
  yield;
  for (const [k, list] of Object.entries(building)) {
    yield;
    const mat = { walls: M.wall, plain: M.plainWall, roofs: M.roof, domes: M.dome, dark: M.dark, trees: M.tree }[k];
    for (const g of list) add(mat, g);
  }

  // ---------------------------------------------------------- the lone tower
  yield;
  {
    const x = TOWER.x, z = TOWER.z, base = terrain.baseAt(x, z, 12), H = 150;
    const parts = [
      place(new THREE.CylinderGeometry(5.5, 9, H, 14, 1), x, base - 2 + H / 2, z),
      place(new THREE.CylinderGeometry(15, 13, 2, 18), x, base + H - 10, z),             // the lower balcony
      place(new THREE.CylinderGeometry(8, 8, 9, 14), x, base + H - 4.5, z),              // the top room
      place(new THREE.CylinderGeometry(11, 9, 1.5, 18), x, base + H + 0.5, z),          // its flat roof
      place(new THREE.CylinderGeometry(3, 3, 5, 10), x, base + H + 3.5, z),
      place(new THREE.CylinderGeometry(6.5, 6.5, 0.8, 14), x, base + H + 6.2, z),        // a second, smaller disc
      place(new THREE.ConeGeometry(1.8, 26, 8), x, base + H + 19, z),                    // the spike
      place(new THREE.CylinderGeometry(14, 16, 3, 16), x, base, z),                     // plinth
    ];
    for (const p of parts) add(M.tower, p);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + 0.4;
      add(M.dark, place(new THREE.BoxGeometry(2.2, 4, 1), x + Math.cos(a) * 7.9, base + H - 6, z + Math.sin(a) * 7.9, -a + Math.PI / 2));
    }
    // a masked face carved into the plinth's north side, eyes shut, the glyph on its brow
    // (the same calm face sleeps in the desert's southern dunes)
    {
      const fz = z + 15.4, fy = base + 6.5;
      add(M.tower, place(new THREE.BoxGeometry(9, 9.5, 7), x, fy - 0.25, fz - 3.5));                      // a slab against the shaft
      add(M.tower, place(new THREE.SphereGeometry(3.6, 14, 10), x, fy, fz, 0, 1, 1.25, 0.55));
      add(M.tower, place(new THREE.BoxGeometry(5.6, 0.7, 1.2), x, fy + 1.6, fz + 1.4));                    // the brow
      add(M.tower, place(new THREE.ConeGeometry(0.75, 2.6, 4), x, fy - 0.2, fz + 1.9, 0, 1, 1, 1, Math.PI / 2 + 0.25)); // the nose
      for (const sx of [-1, 1]) add(M.dark, place(new THREE.BoxGeometry(1.5, 0.22, 0.3), x + sx * 1.35, fy + 0.85, fz + 1.95), false); // shut eyes
      add(M.dark, place(new THREE.BoxGeometry(1.8, 0.2, 0.3), x, fy - 1.9, fz + 1.7), false);                // the mouth
      for (const dx of [-0.9, 0, 0.9]) add(M.dark, place(new THREE.SphereGeometry(0.26, 8, 6), x + dx, fy + 2.85 + (dx ? 0 : 0.25), fz + 1.75), false);
      add(M.dark, place(new THREE.TorusGeometry(1.2, 0.12, 4, 12, Math.PI), x, fy + 2.0, fz + 1.75, 0, 1, 0.5, 1), false);
      FACE.x = x; FACE.y = base; FACE.z = fz + 4;
    }
    // low ruins at its foot
    add(M.plainWall, place(new THREE.BoxGeometry(14, 4, 8), x + 22, base - 1 + 2, z + 6, 0.3));
    add(M.plainWall, place(new THREE.BoxGeometry(6, 2.5, 6), x - 20, base - 1 + 1.25, z - 4, 0.8));
  }

  // ---------------------------------------------------------- the bell in its open belfry, and its rope
  yield;
  const bell = new THREE.Group();
  bell.userData.noCollide = true;
  yield;
  {
    const prof = [[0.12, 0], [0.5, 0.04], [0.62, 0.3], [0.7, 0.62], [0.86, 0.86], [1.0, 0.98], [0.96, 1.02], [0, 1.02]].map(([r, y]) => new THREE.Vector2(r * 2.1, -y * 3.0));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), makeMaterial({ color: '#c99a52', metal: 'brass', side: DS }));   // bronze
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(BELL.w * 0.86, 0.5, 0.6), M.dark);
    yoke.position.y = 0.35;
    // the three notes over the bell's rim: the glyph, in bronze relief
    const glyph = mergeGeometries([-0.62, 0, 0.62].map((dx) => new THREE.SphereGeometry(0.16, 6, 4).translate(dx, -1.35 + (dx ? 0 : 0.12), 1.48)).concat([new THREE.TorusGeometry(0.85, 0.07, 4, 12, Math.PI).translate(0, -2.05, 1.62)]));
    bell.add(body, yoke, new THREE.Mesh(glyph, M.dark));
    bell.position.set(BELL.x, BELL.y + BELL.h - 1.4, BELL.z);
    scene.add(bell);
  }
  // the rope comes over the belfry's ledge on a little pulley at the end of an iron arm, clear of
  // the ledge (it sticks out w * 0.06 past the wall) and of the wall below, and swings only outward
  // (src/story/arzach2.js), so it never passes through the tower
  const ropeTop = new THREE.Vector3(BELL.x, BELL.floor + 0.3, BELL.z + BELL.w * 0.56 + 0.22);
  const ropeFoot = new THREE.Vector3(BELL.x, BELL.y + 0.9, ropeTop.z);
  yield;
  {
    const arm = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(0.12, 0.12, 0.5).translate(0, 0.06, -0.18),                              // the arm, out over the ledge's lip
      new THREE.TorusGeometry(0.16, 0.05, 4, 10).rotateY(Math.PI / 2).translate(0, 0.16, 0),            // the pulley
    ]), M.dark);
    arm.position.set(ropeTop.x, BELL.floor, ropeTop.z);
    arm.userData.noCollide = true;
    scene.add(arm);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, ropeTop.y - ropeFoot.y, 5).translate(0, -(ropeTop.y - ropeFoot.y) / 2, 0), makeMaterial({ color: '#8a5a3a', flat: true }));
  rope.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5).scale(1, 1.6, 1).translate(0, -(ropeTop.y - ropeFoot.y), 0), makeMaterial({ color: '#c8483a', flat: true })));
  rope.position.copy(ropeTop);
  rope.userData.noCollide = true;
  scene.add(rope);

  // ---------------------------------------------------------- floating stones (gently bobbing, not collidable)
  yield;
  const floaters = new THREE.Group();
  floaters.userData.noCollide = true;
  floaters.userData.floats = true;   // (the clipping audit: meant to hang in the air)
  scene.add(floaters);
  const floatGeo = [];
  const floater = (x, y, z, r, sy, egg, seed, pebbles = 3, mushroom = false) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const parts = [];
    if (mushroom) {
      parts.push(table({ x: 0, z: 0, R: r, stalk: r * 0.2, top: 0, base: -r * 0.7, capT: r * 0.25, under: r * 0.2, dome: r * 0.18, seed, rib: r * 0.05, ribK: 20, seg: 64, colSeg: 8, lean: [nA(seed, 4) * 0.12, nB(seed, 4) * 0.12] }).vis);
    } else parts.push(boulder(r, 1, sy, 0.9, egg, seed, true, egg > 0.08 ? 0.22 : 0.12));
    for (let i = 0; i < pebbles; i++) parts.push(place(boulder(r * (0.08 + 0.06 * (pebbles - i) / pebbles), 1, 1.3, 1, 0.1, seed + i), (i % 2 ? 1 : -1) * r * 0.1, -r * sy - r * (0.6 + i * 0.9), 0));
    const m = new THREE.Mesh(mergeGeometries(parts.map((p) => clean(p))), M.bone);
    m.geometry.computeVertexNormals();
    g.add(m);
    floaters.add(g);
    const ph = seed * 1.7;
    movers.push((t) => { g.position.y = y + Math.sin(t * 0.35 + ph) * 1.6; g.rotation.y = Math.sin(t * 0.05 + ph) * 0.3; });
    floatGeo.push(m);
  };
  floater(-60, 112, -150, 6, 3.4, 0.1, 1, 3);        // the long floating stone (page 1)
  floater(150, 88, -40, 4, 2.6, 0.15, 2, 2);
  floater(300, 150, -380, 7, 2.2, 0.05, 3, 4);
  floater(-190, 128, -300, 5, 1.6, 0.2, 4, 2);
  floater(270, 160, -470, 8, 0.45, 0, 5, 1, true);    // a little mushroom-shaped island (page 6)
  floater(-110, 92, -480, 3.5, 2.4, 0.1, 6, 3);
  floater(20, 120, -1020, 5, 2.8, 0.1, 7, 3);
  floater(-40, 100, -760, 4.5, 2.2, 0.1, 8, 3);
  floater(160, 140, -820, 6, 0.5, 0, 9, 1, true);

  // ---------------------------------------------------------- the sky stones by the great table (they fell up)
  // little flat-topped stones hanging over the cloud, each with a pebble or two below it
  yield;
  SKY.forEach(([x, z, top, r], i) => {
    const t = tableOf({ x, z, R: r, stalk: r * 0.3, top, base: top - r * 1.5, capT: r * 0.32, under: r * 0.3, dome: r * 0.06, seed: 80 + i * 1.3,
      rib: r * 0.05, ribK: 16, seg: 40, colSeg: 10, flute: 0.1, fluteK: 7, foot: 0.8, neckR: 1.1, waist: 0.1 });
    add(M.bone, t.vis);
    add(M.bone, place(boulder(r * 0.22, 1, 1.3, 1, 0.1, 90 + i), 0.3, top - r * 1.5 - r * 0.5, 0.2).translate(x, 0, z), false);
  });
  // the cairn's footing stone on the great table
  yield;
  {
    const y = tableTop(TABLE, Math.hypot(CAIRN.x - TABLE.x, CAIRN.z - TABLE.z));
    add(M.bone, place(boulder(1.5, 1.2, 0.5, 1.1, 0, 95), CAIRN.x, y + 0.35, CAIRN.z));
    CAIRN.y = y + 1.05;
  }

  // ---------------------------------------------------------- merge everything per material
  yield;
  for (const [mat, geos] of vis) {
    yield;
    const own = (mat === M.needle || mat === M.cap) && geos.every((x) => x.attributes.normal);
    if (!own) for (const x of geos) x.deleteAttribute('normal');
    let g = mergeGeometries(padForm(geos));
    if (mat === M.cap && !own) g = mergeVertices(g, 1e-3);
    if (!own) g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.userData.noCollide = true;
    scene.add(m);
    if (mat === M.cap) noShadow.push(m);
  }
  for (const [mat, geos] of dripGeos) {
    const g = mergeGeometries(geos);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.userData.noCollide = true;
    m.userData.floats = true;   // (hung under an overhang: no one can stand on one, so the audits pass it by)
    scene.add(m);
  }
  // shadow casters for the smooth caps: depth-only in the shadow pass, invisible in the frame
  if (shadowGeos.length) {
    const sm = new THREE.Mesh(mergeGeometries(shadowGeos), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    sm.userData.noCollide = true;
    scene.add(sm);
  }
  // one invisible, coarse collision body for everything above
  const colMesh = new THREE.Mesh(mergeGeometries(col), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  colMesh.visible = false;
  scene.add(colMesh);
  const ray = new THREE.Raycaster();
  const topAt = (x, z, from = 400) => {
    ray.set(new THREE.Vector3(x + 1e-3, from, z + 2e-3), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(colMesh, false)[0];
    return hit ? Math.max(hit.point.y, terrain.heightAt(x, z)) : terrain.heightAt(x, z);
  };

  // ---------------------------------------------------------- scattered pebbles (instanced, not collidable)
  yield;
  const smallProps = [];
  yield;
  {
    const spots = [];
    const onTable = (t, n) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = Math.sqrt(rng()) * t.R * 0.8;
        spots.push([t.x + Math.cos(a) * r, tableTop(t, r) - 0.15, t.z + Math.sin(a) * r]);
      }
    };
    onTable(START, 220); onTable(NEEDLES, 260); onTable(MONASTERY, 120); onTable(TABLE, 60);
    for (let i = 0; i < 900; i++) {
      const x = (rng() * 2 - 1) * 1300, z = PLAIN_EDGE - 60 - rng() * 1100;
      spots.push([x, terrain.heightAt(x, z) - 0.1, z]);
    }
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const rocks = new THREE.InstancedMesh(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.12, 1.4, 5), makeMaterial({ color: '#ffffff', flat: true, pattern: 'cracks' }), spots.length);
    spots.forEach(([x, y, z], i) => {
      const s = 0.25 + Math.pow(rng(), 3) * 1.7;
      dummy.position.set(x, y + s * 0.2, z);
      dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      dummy.scale.set(s, s * 0.6, s * 0.9);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      rocks.setColorAt(i, color.set(z < PLAIN_EDGE - 30 ? ['#e9b090', '#e2a585', '#f1e4d0'][i % 3] : ['#efe4cf', '#e2d4b8', '#f4ecdc'][i % 3]));
    });
    rocks.userData.noCollide = true;
    rocks.frustumCulled = false;
    scene.add(rocks);
    smallProps.push(rocks);
  }

  // ---------------------------------------------------------- the sea of cloud
  yield;
  const cloud = [];
  yield;
  {
    // (printed flat as the sheets print cloud: a warm white in light, one pale grey-blue in its shade, by the real
    //  sun, no strokes; the puffs were pre-shaded in three fixed vertex tones, lit from one side whatever the hour)
    const puffGeo = (detail) => {
      const g = new THREE.IcosahedronGeometry(1, detail);
      lumpy(g, 0.17, 2.3, detail);   // (knobbly, not a ball: the sheets' cloud is cauliflower at every scale)
      g.computeVertexNormals();
      return g;
    };
    // (a thin line in its own shade's blue, not the ink: materials.js LINE)
    const cloudMat = makeMaterial({ color: '#fffbf4', ...CLOUD_PRINT, line: 0.45, lineTint: 1 });
    const near = [], far = [];
    const inPlain = (x, z) => z < PLAIN_EDGE - 50 + nA(x * 0.004, 3.1) * 40;
    // cauliflower clusters: a big central puff, smaller lobes round it and on top
    for (let i = 0; i < 12000 && (near.length < 3600 || far.length < 2400); i++) {
      const x = (rng() * 2 - 1) * 1800, z = 1600 - rng() * 2650;
      if (inPlain(x, z)) continue;
      let blocked = false;
      for (const t of tables) if (Math.hypot(x - t.x, z - t.z) < t.R * 0.6) { blocked = true; break; }
      if (blocked) continue;
      const d = Math.hypot(x - 20, (z + 420) * 0.8);
      const big = rng() < 0.15;
      const s = big ? R(26, 44) : R(12, 26);
      const list = d < 760 ? near : far;
      const y0 = CLOUD_Y + R(-6, 4) + (big ? s * 0.2 : 0);
      list.push({ x, y: y0, z, s, sy: R(0.6, 0.8), main: true });
      const lobes = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < lobes; k++) {
        const a = rng() * TAU, rr = s * R(0.6, 1.05), ls = s * R(0.4, 0.7);
        const lx = x + Math.cos(a) * rr, ly = y0 - ls * 0.2, lz = z + Math.sin(a) * rr;
        list.push({ x: lx, y: ly, z: lz, s: ls, sy: R(0.65, 0.85) });
        // a second growth of bumps on the near clusters' lobes (the far ones sit under the haze)
        if (list === near && rng() < 0.6) {
          const b = a + R(-0.6, 0.6), bs = ls * R(0.4, 0.62);
          list.push({ x: lx + Math.cos(b) * ls * 0.62, y: ly + ls * 0.45, z: lz + Math.sin(b) * ls * 0.62, s: bs, sy: 0.78 });
        }
      }
      if (rng() < 0.6) list.push({ x: x + R(-0.2, 0.2) * s, y: y0 + s * 0.45, z: z + R(-0.2, 0.2) * s, s: s * R(0.45, 0.6), sy: 0.8 });
    }
    const dummy = new THREE.Object3D();
    // distant puffs sit under fog and haze: the coarsest shape is enough there
    for (const [list, detail] of [[near.filter((p) => p.main), 2], [near.filter((p) => !p.main), 1], [far, 0]]) {
      const im = new THREE.InstancedMesh(puffGeo(detail), cloudMat, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s, p.s * p.sy, p.s * R(0.8, 1.1));
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.userData.noCollide = true;
      im.userData.floats = true;   // (a cloud: the clipping audit leaves it be)
      im.frustumCulled = false;
      scene.add(im);
      noShadow.push(im);
      cloud.push(im);
    }
    // a flat cloud deck between the puffs, hiding the floor of the chasm
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200).rotateX(-Math.PI / 2), makeMaterial({ color: '#e6e2ef', glow: 0.5 }));
    deck.position.y = CLOUD_Y - 4;
    deck.userData.noCollide = true;
    scene.add(deck);
    noShadow.push(deck);
    cloud.push(deck);
  }

  const spawn = new THREE.Vector3(0, 0, 22);
  spawn.y = topAt(spawn.x, spawn.z);

  // Sister Perpetue's Almonry (src/shop-world.js, src/shop-fronts.js 'almonry'): the monastery's gatehouse with its
  // hatch, on the cliff-top in front of the white monastery, facing the start plateau the bird comes in from
  const shop = placeShop(scene, { def: SHOPS.almonry, at: new THREE.Vector3(-224, topAt(-224, -197), -197), heading: 0.85 });

  // the Founders' Belfry out of the cloud west of the plateau, and its rooms far overhead (src/temples/arzach2.js)
  yield;
  return attachTemple('arzach2', scene, {
    id: 'arzach2',
    portals: [...shop.portals],
    lights: [...shop.lights],
    shops: [shop],   // (src/story/shops.js: the keeper behind the counter; main.js: the shop panel)
    floraAvoid: shop.avoid(),
    ground: terrain,
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => {
      const b = new Bird(physics);
      b.pos.set(10, physics.groundAt(10, START.top + 30, 6) + STAND, 6);
      return b;
    },
    mountName: 'bird',
    defaults: { hour: 9, preset: 'Moebius print', look: SKY_STONES_LOOK },
    life: {
      flocks: [{ count: 5, color: '#f4efe2', size: 3.2, radius: 180, height: [70, 150], speed: 0.05, seed: 3 },
               { count: 4, color: '#efe2cc', size: 2.6, radius: 110, height: [50, 100], speed: -0.07, seed: 8 }],
      motes: { count: 100, color: '#f6eadb', size: 0.05, wind: [0.6, 0.25] },
      footprints: '#d99072',
    },
    sky: {
      // aqua sky over a peach horizon; shadows go one grey-blue, as in the sheets (printed flat: PRINT)
      script: {
        day: SKY_STONES_DAY,
        // (the shadow the day's grey-teal at every hour, as the sheets print it, a touch warmer at dusk and deeper at
        //  night: the old violet-blue of the print preset stayed in these two: SKY_STONES_DUSK, SKY_STONES_NIGHT)
        dusk: SKY_STONES_DUSK,
        night: SKY_STONES_NIGHT,
      },
      planets: [{ az: 200, el: 26, size: 6.5, color: '#f3ead8', craters: false }, { az: 222, el: 18, size: 2.2, color: '#e9c8b4', craters: false }],
    },
    killY: -Infinity,
    unsafe: (p) => p.y < UNSAFE_Y,
    smallProps,
    noShadow,
    topAt,
    // the story's handles (src/story/arzach2.js): the bell and its rope, the cloud sea (it settles when the
    // bell rings), the floating stones, the sky stones and the cairn, the clapper's island, the tower's face
    arzach2: {
      bell, bellTower: { ...BELL }, rope, ropeTop, ropeFoot,
      cloud, cloudY: CLOUD_Y, floaters,
      sky: SKY.map(([x, z, top, r]) => ({ pos: new THREE.Vector3(x, top, z), r })),
      cairn: new THREE.Vector3(CAIRN.x, CAIRN.y, CAIRN.z),
      table: new THREE.Vector3(TABLE.x, tableTop(TABLE), TABLE.z),
      clapper: new THREE.Vector3(CLAPPER.x, topAt(CLAPPER.x, CLAPPER.z, ISLAND.top + 20), CLAPPER.z),
      island: new THREE.Vector3(ISLAND.x, ISLAND.top, ISLAND.z),
      monastery: new THREE.Vector3(MONASTERY.x, MONASTERY.top, MONASTERY.z),
      face: new THREE.Vector3(FACE.x, FACE.y, FACE.z),
      tower: new THREE.Vector3(TOWER.x, terrain.heightAt(TOWER.x, TOWER.z), TOWER.z),
      plainEdge: PLAIN_EDGE,
    },
    atmo: (x, z) => ({ tint: [1.02, 0.99, 0.96], fog: 0.65, name: z < PLAIN_EDGE - 40 ? 'Vael II · the peach plain' : 'Vael II · the sky stones' }),
    update(dt, t) { for (const m of movers) m(t); },
  });
}
export const createArzach2 = stepped(buildArzach2);
