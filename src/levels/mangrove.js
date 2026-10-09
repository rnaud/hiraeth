import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { bankBush } from './wood-kit.js';
import { KEEPERS, PEOPLE as LORN_PEOPLE } from '../story/perdide2-data.js';
import { STREET as BAZAAR_STREET } from '../story/bazaar-data.js';
import {
  whiteTree, podHouse, walkway, stairs, ringDeck, punt, farTree, lantern, stick, limb,
  MANGROVE_LOOK, MANGROVE_DAY, MANGROVE_TONES,
} from './mangrove-kit.js';

// ---------------------------------------------------------------------------
// The White Mangrove: a settlement in a mangrove of enormous smooth bone-white trees standing on
// arching roots in a shallow black lake (references/levels/The White Mangrove/; its views in the References,
// reference-mangrove.js; the shapes in mangrove-kit.js). Small rounded houses sit on decks round the
// trunks and in the forks; plank walks on stilts, lit by lanterns, run between the trees, stairs climb
// to the decks and rope bridges cross between them; flat boats pass; the lake's creatures glow blue
// and pink like a second sky. Off the route: no story to follow, a few people to meet.
//
// The layout: the landing island in the south (the ship's site), a walk north to the great tree, a
// ring walk round it and spokes to five trees round it, each with a stair up to the deck round its
// trunk and its houses; bridges from the great tree's deck to three of them. The water is swum.
// ---------------------------------------------------------------------------

const WATER = 0;
const BED = -2.6;           // the lake's bed: deep enough to swim anywhere (you float at 1.3 m)
const WALK_Y = 1.2;         // the low walks' deck over the water
const SLOPE = 0.62;         // the stairs' rise over their run
export const ISLAND = { x: 0, z: 74, r: 26, y: 0.9 };
const GREAT = { x: 0, z: -40 };
/** The trees with a deck round their trunk (the first is the great tree): its stair's platform faces `face` (rad, from +x toward +z). */
export const DECKED = [
  { x: 0, z: -40, r: 4.5, h: 30, crown: 11, reach: 14, seed: 1, face: Math.PI / 2, houses: [0.4, 2.2, 3.5, 4.6] },
  ...[[-150, 3.2, 8, 10], [-100, 3.4, 8, 10], [-30, 3, 8, 10], [20, 3.4, 8, 11], [70, 3, 7, 9]].map(([deg, r, crown, reach], i) => {
    const a = (deg * Math.PI) / 180, R = 68;   // round the great tree, 68 m out (0°: east, -90°: north)
    return { x: GREAT.x + Math.cos(a) * R, z: GREAT.z + Math.sin(a) * R, r, h: 20 + (i % 3) * 2, crown, reach, seed: 10 + i, face: a + Math.PI + 0.9, houses: [a + 0.5, a + Math.PI - 1.2, a - 1.6] };
  }),
];
// each deck: its height (above its roots' springing), radii, the stair's platform out on the water
for (const T of DECKED) {
  T.deckY = T.crown + 0.3;
  T.inner = T.r * 1.4;
  T.outer = T.inner + 3.5;
  T.run = (T.deckY - WALK_Y) / SLOPE;
  const d = T.outer + T.run + 1.5;
  T.platform = { x: T.x + Math.cos(T.face) * d, z: T.z + Math.sin(T.face) * d };
}
/** The great tree's deck: where the page closes (the highest you reach without climbing). */
export const HIGH_DECK = DECKED[0];
const RING_R = 34;   // the ring walk round the great tree
/** The trees with no deck: big ones further out, lesser ones between. */
export const OTHERS = [
  { x: -112, z: 30, r: 3.2, h: 24, crown: 9, reach: 11, seed: 30, houses: 2 },
  { x: 118, z: 22, r: 3, h: 22, crown: 8, reach: 10, seed: 31, houses: 2 },
  { x: -60, z: -150, r: 3.6, h: 26, crown: 9, reach: 12, seed: 32, houses: 2 },
  { x: 70, z: -158, r: 3.4, h: 24, crown: 9, reach: 11, seed: 33, houses: 1 },
  { x: 0, z: -190, r: 4, h: 28, crown: 10, reach: 13, seed: 34, houses: 2, canopy: true },
  { x: -150, z: -80, r: 3, h: 22, crown: 8, reach: 10, seed: 35, houses: 1 },
  { x: 150, z: -90, r: 3, h: 22, crown: 8, reach: 10, seed: 36, houses: 1 },
  { x: -54, z: 52, r: 2.2, h: 16, crown: 6, reach: 7, seed: 37 },
  { x: 56, z: 48, r: 2.2, h: 16, crown: 6, reach: 7, seed: 38 },
  { x: -120, z: -20, r: 2, h: 15, crown: 5, reach: 7, seed: 39 },
  { x: 116, z: -36, r: 2, h: 15, crown: 5, reach: 7, seed: 40 },
  { x: -44, z: -124, r: 1.8, h: 14, crown: 5, reach: 6, seed: 41 },
  { x: 30, z: -124, r: 1.8, h: 14, crown: 5, reach: 6, seed: 42 },
];

const noise = createNoise2D(41101), noiseB = createNoise2D(41102);
/** The lake bed, the landing island, the banks closing the world. */
function height(x, z) {
  let h = BED + fbm(noise, x * 0.01, z * 0.01, 2) * 0.35;
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  h = Math.max(h, THREE.MathUtils.lerp(BED, ISLAND.y + noiseB(x * 0.05, z * 0.05) * 0.12, smoothstep(ISLAND.r + 12, ISLAND.r - 2, di)));
  const edge = Math.hypot(x - GREAT.x, (z - GREAT.z) * 0.92);
  h += smoothstep(230, 300, edge) * (7 + fbm(noiseB, x * 0.008, z * 0.008, 3) * 5) + smoothstep(300, 420, edge) * 30;
  return h;
}

/** The walks' courses ([x, z] points at WALK_Y): the way from the landing, the ring, the spokes. */
export function walkCourses() {
  const out = [];
  const P0 = DECKED[0].platform;
  out.push([[0, ISLAND.z - ISLAND.r + 4], [0, 20], [P0.x, P0.z + 2.5]]);
  const ring = [];
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; ring.push([GREAT.x + Math.cos(a) * RING_R, GREAT.z + Math.sin(a) * RING_R]); }
  out.push(ring);
  for (const T of DECKED.slice(1)) {
    const a = Math.atan2(T.z - GREAT.z, T.x - GREAT.x), from = [GREAT.x + Math.cos(a) * RING_R, GREAT.z + Math.sin(a) * RING_R];
    const dx = T.platform.x - from[0], dz = T.platform.z - from[1], L = Math.hypot(dx, dz);
    out.push([from, [T.platform.x - (dx / L) * 2.2, T.platform.z - (dz / L) * 2.2]]);   // (to the platform's edge)
  }
  return out;
}

export const MANGROVE_CONTENT = {
  weather: ['fog'],
  // no story to follow: the page names the place and closes on the great tree's deck
  story: {
    title: 'THE WHITE MANGROVE',
    intro: 'White trees stand in a black lake, and people live in them. The lanterns are lit along the walks. The great tree’s deck is the place to see it from.',
    outro: 'From the great tree’s deck the whole village shows: the lanterns, the boats, and under the water the creatures, lit like a second sky.',
    label: 'the great tree’s deck', goal: [HIGH_DECK.x + HIGH_DECK.outer - 1.5, HIGH_DECK.deckY, HIGH_DECK.z], radius: 6, verticalRadius: 3, manual: true,   // (no beacon: nothing to do here but look)
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere who came to the lake, and its own folk on the walks and decks
  npcs: [
    { ...BAZAAR_STREET.oyo, at: [HIGH_DECK.x - 7, HIGH_DECK.z + 6], y: HIGH_DECK.deckY + 0.2, radius: 1, kind: 'm', world: 'bazaar', lang: 'bazaar',
      palette: { cloak: '#84bab3', lining: '#2b211f' },
      lines: ['~happy~ Lanterns go further here. The water lights them from underneath.', '~playful~ Nobody haggles on a deck this high. Too much to look at.'],
      talk: { listen: [
        '~happy~ Oyo, lanterns! The market had too many already, so I followed the light out here. Every walk wants one, every evening.',
        '~curious~ Look down off the rail when the lanterns are lit. The lake answers them in blue and pink. I’ve stopped trying to sell that part.',
        '~playful~ They pay in fish and good advice. I am very well advised now.',
        { after: 'met.oyo', say: '~neutral~ Back again? The ring walk goes all the way round. Every spoke ends at a stair.' },
      ] } },
    { ...LORN_PEOPLE.fen, at: [DECKED[3].platform.x + 2, DECKED[3].platform.z], y: WALK_Y + 0.2, radius: 1.5, world: 'perdide2', lang: 'perdide2',
      lines: ['~surprised~ The water’s black here, but it isn’t deep.', '~neutral~ Mind the roots under the planks.'],
      talk: { listen: [
        '~curious~ Fen. From the far dome, in the Deep Wood. I came to see how other people live on water. Better than me, it turns out.',
        '~neutral~ The white roots don’t rot. They just keep growing out and down, and the people build along them.',
        '~whisper~ At night the creatures come up under the walks. Stand still and they gather round your feet.',
      ] } },
    { ...KEEPERS[2], at: [3, ISLAND.z - ISLAND.r + 6], radius: 2, kind: 'm', world: 'perdide2', lang: 'perdide2',
      lines: ['~tired~ Different water. Same sitting.', '~playful~ The roots here are white. I disapprove on principle.'],
      talk: { listen: [
        '~tired~ Bram. I mind a cave mouth in the Deep Wood. I came here for the quiet, and it is very quiet.',
        '~neutral~ Walk north along the planks. The great tree has a deck round it, and the stair is on this side.',
        '~playful~ I counted the lanterns. Then a boat went by and I lost count.',
      ] } },
    // the lake's own folk
    { at: [RING_R - 2, GREAT.z], y: WALK_Y + 0.2, radius: 3, lang: 'perdide2', lines: ['~happy~ Evening. The lanterns are lit.', '~neutral~ The ring walk takes you round to every stair.'] },
    // (Liss: the detour's trace, src/story/sightings-detours.js)
    { id: 'liss', name: 'Liss', title: 'who poles the boats', color: '#b8a8d8', kind: 'f', at: [-RING_R + 0.2, GREAT.z - 4], y: WALK_Y + 0.2, radius: 0.8, lang: 'perdide2',   // (on the ring walk: further in is the lake)
      lines: ['~curious~ You came by the sky? We came by boat, a long time ago.', '~whisper~ Don’t lean on the lantern posts. They lean back.'],
      talk: { listen: [
        { after: () => true, say: [
          '~curious~ Another one from the sky. Long ago a woman came down alone, in a ship no bigger than my boat.',
          '~neutral~ She asked about the {glyph} on the great tree’s roots. I showed her how it goes: dots, then arc.',
          '~solemn~ She drew it on her knee until her hand knew it, thanked me in words that didn’t come through, and went up.',
        ], do: { set: { 'sight.mangrove.liss': true } } },
        '~whisper~ Don’t lean on the lantern posts. They lean back.',
        '~neutral~ The roots grow out and down, and the mark on them grows too. A little wider every year.',
        '~playful~ We came by boat, a long time ago. Nobody remembers from where. The boats might.',
      ] } },
    { at: [DECKED[1].x + DECKED[1].outer - 1.2, DECKED[1].z], y: DECKED[1].deckY + 0.2, radius: 1, lang: 'perdide2', lines: ['~solemn~ My mother planted this deck. It has grown three planks since.', '~neutral~ The roots take a year to reach the water.'] },
    { at: [DECKED[4].x - DECKED[4].outer + 1.2, DECKED[4].z], y: DECKED[4].deckY + 0.2, radius: 1, lang: 'perdide2', lines: ['~playful~ From up here the boats look like spoons.', '~happy~ The creatures are brightest when there’s no moon.'] },
    { at: [-4, 34], y: WALK_Y + 0.2, radius: 2, lang: 'perdide2', lines: ['~neutral~ Welcome to the lake. Stay on the planks, or swim. Both work.', '~curious~ Your ship is very loud. The boats went quiet when it landed.'] },
  ],
};

/** The level's look and colours: a violet dusk, a lilac day, an indigo night. */
export const MANGROVE_SKY = {
  day: ['#9ea6d8', '#e6cfe0', '#8a8ed0', '#fff2f2', '#fff0e6'],
  dusk: MANGROVE_DAY,
  night: ['#18163e', '#382c66', '#4a4890', '#c8c8f0', '#f0e8e0'],
};

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildMangrove(scene) {
  const rng = mulberry32(41100);
  const terrain = yield* Terrain.make({
    size: 900, seg: 200, height,   // (4.5 m: the island is round enough, the rest is under the water or far)
    material: { color: '#34445a', color2: '#3a4c60', color3: '#2e3a52', mode: MODE_TERRAIN, ticks: true },   // (the island's dark moss; the bed under the black water)
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'The White Mangrove';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 41100 });
  const T = MANGROVE_TONES, DS = THREE.DoubleSide;
  const M = {
    bark: kit.mat({ color: T.bark, shade: 0.35, hatch: 0.45, detail: 'organic', detailDensity: 0.45, form: true }),
    barkPale: kit.mat({ color: T.barkPale, shade: 0.35, hatch: 0.45, detail: 'organic', detailDensity: 0.45, form: true }),
    shell: kit.mat({ color: T.shell, shade: 0.4, hatch: 0.35 }),
    wood: kit.mat({ color: T.wood, flat: true }),
    plank: kit.mat({ color: T.plank, flat: true, pattern: 'cracks' }),
    lamp: kit.mat({ color: T.lamp, glow: 1, flat: true }),
    window: kit.mat({ color: T.window, glow: 0.95, flat: true }),
    dark: kit.mat({ color: T.dark, flat: true }),
    far: kit.mat({ color: T.far, flat: true, hatch: 0.2, line: 0.6, lineTint: 1 }),
    leaves: kit.mat({ color: T.leaves, shade: 0.5, hatch: 0.25, line: 0.6, lineTint: 0.8 }),
    bush: kit.mat({ color: T.bush, pattern: 'leaves', hatch: 1.6, shade: 0.5, spot: 0 }),
    boat: kit.mat({ color: T.boat, flat: true, pattern: 'cracks' }),
    boatIn: kit.mat({ color: T.boatIn, flat: true }),
    figure: kit.mat({ color: '#5d5a86', flat: true }),
  };
  const lights = [];
  const lamp = (x, y, z, r = 6) => lights.push(new THREE.Vector4(x, y, z, r));
  const SOLID = { solid: true, shadow: false }, LOOSE = { solid: false, shadow: false };
  const add = (m, g, o = SOLID) => kit.add(m, g, o);

  // ---------------------------------------------------------- water
  yield;
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1).rotateX(-Math.PI / 2), makeMaterial({ color: T.water, color2: T.shallow, mode: MODE_WATER }));
    water.position.y = WATER;
    water.userData.noCollide = true;
    scene.add(water);
  }

  // ---------------------------------------------------------- the great white trees (solid as drawn: you swim among their roots, climb their trunks)
  const houseAt = [];   // { x, y, z, R, yaw, deck: true when on a walkable deck }
  const tree = (o, decked) => {
    const W = whiteTree({ ...o, detail: 0.72, fingers: 2, upperRoots: !decked, top: 1, canopy: true, canopyDetail: decked ? 1 : 0.7 });   // (the near ones' leaves round, the rest a few facets)
    for (const g of [...W.trunk, ...W.roots, ...W.limbs]) add(o.pale ? M.barkPale : M.bark, g.translate(o.x, 0, o.z));
    for (const g of W.canopy) add(M.leaves, g.translate(o.x, 0, o.z));   // (solid: a climber can sit up in the leaves)
    // houses in the forks (up the limbs: climbed to, not walked)
    const n = typeof o.houses === 'number' ? o.houses : 1;
    for (let k = 0; k < Math.min(n, W.forks.length); k++) {
      const f = W.forks[k];
      houseAt.push({ x: o.x + f.x, y: f.y, z: o.z + f.z, R: 2.2 + rng() * 0.8, yaw: -f.az + Math.PI / 2 + Math.PI, deck: false });
    }
    return W;
  };
  for (const D of DECKED) { yield; tree(D, true); }
  for (const O of OTHERS) { yield; tree(O, false); }

  // ---------------------------------------------------------- the decks round the trunks, their stairs and houses
  yield;
  for (const D of DECKED) {
    const gaps = [[D.face, 2.2]];
    // the houses on the deck: just outside its rim, their doors to the trunk; a gap in the railing to each
    for (const a of D.houses) {
      const R = 2.4 + rng() * 0.6, d = D.outer + R * 1.15 - 0.6;
      houseAt.push({ x: D.x + Math.cos(a) * d, y: D.deckY + 0.02, z: D.z + Math.sin(a) * d, R, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), deck: true });
      gaps.push([a, 2.2]);
    }
    D.gaps = gaps;
  }
  // the bridges from the great tree's deck to three of the others (rope bridges, sagging)
  const BRIDGES = [2, 3, 4].map((k) => [0, k]);
  for (const [i, j] of BRIDGES) {
    const A = DECKED[i], B = DECKED[j], a = Math.atan2(B.z - A.z, B.x - A.x), b = a + Math.PI;
    A.gaps.push([a, 2.4]); B.gaps.push([b, 2.4]);
    const p = [A.x + Math.cos(a) * (A.outer - 0.3), A.deckY, A.z + Math.sin(a) * (A.outer - 0.3)], q = [B.x + Math.cos(b) * (B.outer - 0.3), B.deckY, B.z + Math.sin(b) * (B.outer - 0.3)];
    const W = walkway([p, q], { w: 1.6, rail: true, stilt: 0, lamp: 9, sag: 2.4, seed: i * 7 + j });
    for (const g of W.planks) add(M.plank, g);
    for (const g of W.wood) add(M.wood, g);
    for (const g of W.glow) add(M.lamp, g, LOOSE);
    for (const [x, y, z] of W.lamps) lamp(x, y, z, 7);
  }
  for (const D of DECKED) {
    yield;
    const R = ringDeck({ inner: D.inner, outer: D.outer, y: D.deckY, gaps: D.gaps });
    for (const g of R.planks) add(M.plank, g.translate(D.x, 0, D.z));
    for (const g of R.wood) add(M.wood, g.translate(D.x, 0, D.z));
    for (let k = 0; k < 4; k++) {
      const a = D.face + 0.8 + k * 1.4, L = lantern(D.x + Math.cos(a) * (D.outer - 0.35), D.deckY, D.z + Math.sin(a) * (D.outer - 0.35), 1.5);
      for (const g of L.wood) add(M.wood, g); for (const g of L.glow) add(M.lamp, g, LOOSE); lamp(...L.at, 8);
    }
    // the stair: from the platform out on the water straight up to the deck's rim
    const c = Math.cos(D.face), s = Math.sin(D.face);
    const top = [D.x + c * (D.outer - 0.2), D.deckY, D.z + s * (D.outer - 0.2)], foot = [D.x + c * (D.outer + D.run), WALK_Y, D.z + s * (D.outer + D.run)];
    const S = stairs(foot, top, { w: 1.6, rise: 0.22 });
    for (const g of S.planks) add(M.plank, g); for (const g of S.wood) add(M.wood, g);
    // its posts down into the water
    for (let k = 1; k < 4; k++) { const t = k / 4, x = foot[0] + (top[0] - foot[0]) * t, z = foot[2] + (top[2] - foot[2]) * t, y = WALK_Y + (D.deckY - WALK_Y) * t; add(M.wood, stick(new THREE.Vector3(x, BED, z), new THREE.Vector3(x, y - 0.3, z), 0.14), LOOSE); }
    // the platform at its foot
    const P = D.platform;
    for (let i = 0; i < 9; i++) add(M.plank, new THREE.BoxGeometry(4.6, 0.14, 0.55).translate(0, WALK_Y - 0.07, -2.1 + i * 0.52).rotateY(-D.face + Math.PI / 2).translate(P.x, 0, P.z));
    for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) add(M.wood, stick(new THREE.Vector3(P.x + dx, BED, P.z + dz), new THREE.Vector3(P.x + dx, WALK_Y - 0.1, P.z + dz), 0.13), LOOSE);
    const L = lantern(P.x + c * 2, WALK_Y, P.z + s * 2, 1.4);   // (on its far edge, out of the way of the walk and the stair) for (const g of L.wood) add(M.wood, g); for (const g of L.glow) add(M.lamp, g, LOOSE); lamp(...L.at, 7);
  }

  // ---------------------------------------------------------- the houses
  yield;
  for (const h of houseAt) {
    const P = podHouse({ R: h.R, tall: 1 + rng() * 0.35, seed: h.x * 3 + h.z, windows: 5, lit: 0.6, twin: rng() < 0.25, deck: 1.15, struts: 5, fringe: 12, detail: 0.7 });
    const put = (g) => g.rotateY(h.yaw).translate(h.x, h.y, h.z);
    for (const g of P.shell) add(M.shell, put(g));
    for (const g of P.wood) add(M.wood, put(g));
    for (const g of P.dark) add(M.dark, put(g), LOOSE);
    for (const g of P.glow) add(M.window, put(g), LOOSE);
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    lamp(h.x + s * h.R * 1.4, h.y + 1.5, h.z + c * h.R * 1.4, h.R * 3);
  }

  // ---------------------------------------------------------- the low walks on stilts, lanterns along them
  yield;
  for (const [k, course] of walkCourses().entries()) {
    yield;
    const W = walkway(course.map(([x, z]) => [x, WALK_Y, z]), { w: 2, rail: false, stilt: 4, lamp: 9, seed: k + 1, bed: BED });
    for (const g of W.planks) add(M.plank, g);
    for (const g of W.wood) add(M.wood, g, LOOSE);
    for (const g of W.glow) add(M.lamp, g, LOOSE);
    for (const [x, y, z] of W.lamps) lamp(x, y, z, 7);
  }
  // the landing stage on the island's north shore, where the walk begins
  {
    const z0 = ISLAND.z - ISLAND.r + 9, z1 = ISLAND.z - ISLAND.r + 2;
    for (let i = 0; i < 18; i++) add(M.plank, new THREE.BoxGeometry(0.55, 0.16, z0 - z1).translate(-4.4 + i * 0.52, WALK_Y - 0.08, (z0 + z1) / 2));
    for (const [x, z] of [[-4.6, z1], [4.6, z1], [-4.6, z0], [4.6, z0]]) add(M.wood, stick(new THREE.Vector3(x, BED, z), new THREE.Vector3(x, WALK_Y + 0.8, z), 0.16));
    for (const x of [-4, 4]) { const L = lantern(x, WALK_Y, z1 + 0.5, 1.8); for (const g of L.wood) add(M.wood, g); for (const g of L.glow) add(M.lamp, g, LOOSE); lamp(...L.at, 8); }
  }

  // ---------------------------------------------------------- the island's bushes, the dark bank, the wood behind
  yield;
  const bushes = [], dummy = new THREE.Object3D();
  const bushAt = (x, y, z, r) => { dummy.position.set(x, y, z); dummy.rotation.set(0, rng() * 6.3, 0); dummy.scale.set(r, r * 0.9, r); dummy.updateMatrix(); bushes.push(dummy.matrix.clone()); };
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = ISLAND.r * (0.55 + rng() * 0.45), x = ISLAND.x + Math.cos(a) * d, z = ISLAND.z + Math.sin(a) * d;
    if (z < ISLAND.z - ISLAND.r + 12 && Math.abs(x) < 8) continue;   // (clear of the landing stage)
    if (Math.hypot(x - ISLAND.x, z - (ISLAND.z + 6)) < 13) continue;   // (and of the ship)
    const r = 1.4 + rng() * 1.8;
    bushAt(x, H(x, z) + r * 0.3, z, r);
  }
  yield;
  {
    for (let i = 0; i < 150; i++) {
      const a = rng() * Math.PI * 2, d = 250 + rng() * 120, x = GREAT.x + Math.cos(a) * d, z = GREAT.z + Math.sin(a) * d * 1.05, hh = 30 + rng() * 30;
      for (const g of farTree(i + 4100, hh, 1.2 + rng() * 1.4, 0.5)) add(M.far, g.translate(x, H(x, z) - 0.5, z), LOOSE);
    }
    for (let i = 0; i < 80; i++) {
      const a = rng() * Math.PI * 2, d = 228 + rng() * 40, x = GREAT.x + Math.cos(a) * d, z = GREAT.z + Math.sin(a) * d, r = 3 + rng() * 4;
      bushAt(x, H(x, z) + r * 0.2, z, r);
    }
    // the bushes: one instanced draw, walked through
    const bm = new THREE.InstancedMesh(bankBush(7.1, 0), M.bush, bushes.length);
    bushes.forEach((m, i) => bm.setMatrixAt(i, m));
    bm.userData.noCollide = true;
    bm.name = 'bushes';
    scene.add(bm);
    kit.noShadow.push(bm);
  }

  // ---------------------------------------------------------- the lake's creatures: blue and pink, one instanced draw
  yield;
  let spots;
  {
    const list = [], C = T.spots.map((c) => new THREE.Color(c)), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < 12000 && list.length < 8000; i++) {
      // denser round the trees' feet and under the walks, thinning out to the banks
      const near = rng() < 0.45 ? DECKED[Math.floor(rng() * DECKED.length)] : null;
      const a = rng() * Math.PI * 2, d = near ? near.reach * (0.6 + rng() * 1.6) : Math.sqrt(rng()) * 210;
      const x = (near ? near.x : GREAT.x) + Math.cos(a) * d, z = (near ? near.z : GREAT.z) + Math.sin(a) * d;
      if (H(x, z) > -0.6) continue;
      const s = 0.1 + rng() ** 2 * 0.5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.3);
      m.compose(p.set(x, WATER + 0.035, z), q, sc.set(s * (0.8 + rng() * 0.8), 1, s * (0.6 + rng() * 0.5)));
      list.push([m.clone(), C[Math.floor(rng() * C.length)]]);
    }
    spots = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2), makeMaterial({ color: '#ffffff', glow: 1, flat: true, line: 0.25, lineTint: 1, side: DS }), list.length);
    list.forEach(([mx, c], i) => { spots.setMatrixAt(i, mx); spots.setColorAt(i, c); });
    spots.userData.noCollide = true;
    spots.name = 'the lake’s creatures';
    scene.add(spots);
  }

  // ---------------------------------------------------------- boats going round the lake, a boatman poling each
  yield;
  const movers = [];
  for (let k = 0; k < 4; k++) {
    const L = 7 + rng() * 2, P = punt(L, 1.5), boat = new THREE.Group(), R0 = 96 + k * 9, w = (k % 2 ? -1 : 1) * (0.012 + rng() * 0.006), ph = rng() * 6.3;
    const hull = new THREE.Mesh(P.hull[0], M.boat), floor = new THREE.Mesh(P.floor[0], M.boatIn);
    const man = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.35, 8).translate(0, 1.04, -L * 0.3), M.figure);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.82, -L * 0.3), M.figure);
    const pole = new THREE.Mesh(stick(new THREE.Vector3(0.35, -1.8, -L * 0.3 - 0.4), new THREE.Vector3(0.5, 3, -L * 0.3 + 0.2), 0.03), M.wood);
    boat.add(hull, floor, man, head, pole);
    boat.traverse((o) => { o.userData.noCollide = true; });
    scene.add(boat);
    movers.push((t) => {
      const a = ph + t * w;
      boat.position.set(GREAT.x + Math.cos(a) * R0, WATER + Math.sin(t * 1.3 + k) * 0.03, GREAT.z + Math.sin(a) * R0 * 0.95);
      boat.rotation.y = -a + (w > 0 ? 0 : Math.PI);
      pole.rotation.x = Math.sin(t * 0.9 + k) * 0.25;
    });
  }

  yield;
  kit.finish();
  lights.push(...kit.lights);
  yield;

  const spawn = new THREE.Vector3(0, H(0, ISLAND.z - 12) + 0.05, ISLAND.z - 12);
  return {
    id: 'mangrove',
    ground: terrain,
    // (the roots and the walks are long thin tubes and rows of planks: a BVH split by area, as Lorn II's: movement.md)
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 330,
    shipSite: { x: ISLAND.x, z: ISLAND.z + 6, heading: Math.PI },   // (its ramp toward the landing stage and the village)
    features: { mount: false, wind: false, jetpack: false, climb: true },
    defaults: { hour: 17.8, preset: 'Moebius print', cloudShadows: 0, look: MANGROVE_LOOK },
    sky: { script: MANGROVE_SKY, planets: [{ az: 200, el: 24, size: 1.4, color: '#f6e6f0', craters: false }] },
    killY: -Infinity,
    lights,
    noShadow: kit.noShadow,
    reactions: false,   // (nothing grows out of the planks: reactive-world.js)
    spots,
    life: {
      flocks: [{ count: 10, color: '#1c2040', size: 0.8, radius: 70, height: [18, 40], speed: 0.25, seed: 41 }],
      motes: { count: 260, color: '#ffd8a0', size: 0.06, glow: 1, rise: 0.03, wind: [0.06, 0.04] },
    },
    atmo: () => ({ tint: [1, 0.98, 1], fog: 1.3, name: 'The White Mangrove' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}
export const createMangrove = stepped(buildMangrove);
