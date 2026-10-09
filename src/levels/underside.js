import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { sharedUniforms, makeMaterial, MODE_TERRAIN } from '../materials.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { stairs } from './mangrove-kit.js';
import { stall, herbs } from './salt-harbour-kit.js';
import { PEOPLE as GARAGE_PEOPLE } from '../story/garage-data.js';
import { PEOPLE as SKY_STONES_PEOPLE } from '../story/arzach2-data.js';
import { PEOPLE as BAZAAR_PEOPLE } from '../story/bazaar-data.js';
import {
  underMats, slab, splitFaces, lobesFor, podAt, deckAt, bannerAt, basket, lampAt, stoneStair, shrubs, grassTufts, cloudPuffs, puffGeo,
  shacksAt, framed, town, stick, post, UNDER_LOOK, UNDER_DAY, UNDER_DUSK, UNDER_NIGHT, UNDER_TONES,
} from './underside-kit.js';

// ---------------------------------------------------------------------------
// The Underside: an immense shelf of pale limestone jutting east from a mountain far out over a sea of cloud, and a
// town hung from its underside (references/levels/The Underside/; its views in the References, reference-underside.js; the
// shapes and the look in underside-kit.js). Round white houses like swallows' nests cling to the rock and hang
// from it, timber decks and galleries are slung under it on rods, long rust-red banners fall from their edges
// toward the cloud, baskets go up and down on ropes. Off the route: no story to follow, a few people to meet.
//
// The layout (north is -z, east +x): the mountain's face runs north-south at x ≈ 2; the shelf juts east from it,
// its top (y 40) from z -60 (its south face) to -230 (its north face), out to its tip at x ≈ 170, its underside at
// y ≈ 12. The ship lands on the top. The great stair is cut into the mountain's face south of the shelf, from the
// top's south-west corner down to a landing (y 2); the rope walk runs back north from there, along the stair's rock,
// in under the shelf to the south gallery. Under the shelf the town's decks (y 2): the south gallery along the
// south face, three cross decks north to the north gallery, the Bell Deck in the middle, the tip deck out past the
// tip; the basket deck below the south gallery (y -6), out over the cloud. A timber stair climbs the north face
// back to the top. Below the decks the town goes on down in scaffolds and banners, out of reach.
// ---------------------------------------------------------------------------

/** The shelf: its top (y), its thickness, its faces (z), its root in the mountain (x0) and its tip (x1). */
export const SHELF = { x0: -30, x1: 172, zS: -60, zN: -230, top: 40, T: 28 };
export const BASE = SHELF.top - SHELF.T;   // the underside's level (its lobes hang a few metres lower)
/** The meadow laid on the shelf's top stands this far over the rock (the rock's own bumps stay under it). */
export const MEADOW = 0.25;
/** The town's main level and the lower one. */
export const DECK = 2, LOW = -6;
/** The great stair: down the mountain's face from the top's south-west corner (head, z) to its foot (z), x its middle. */
export const STAIR = { x: 6, w: 3.6, head: -56, rise: 0.2, run: 0.44 };
STAIR.n = Math.round((SHELF.top - DECK) / STAIR.rise);
STAIR.foot = STAIR.head + STAIR.n * STAIR.run;
/** The landing at its foot, and the rope walk back north from it along the stair's rock to the south gallery. */
export const LANDING = { x0: 0.5, x1: 16, z0: STAIR.foot - 0.5, z1: STAIR.foot + 13 };
export const WALK = { x0: 9, x1: 13, z0: -64, z1: STAIR.foot + 1 };
/** The decks under the shelf (y DECK): the galleries along its faces, the cross decks (lane: the clear way along them), the Bell Deck, the tip deck. */
export const GALLERY_S = { x0: 9, x1: 142, z0: -72, z1: -56 };
export const GALLERY_N = { x0: 30, x1: 142, z0: -236, z1: -224 };
export const CROSS = [{ x0: 32, x1: 48, lane: [36, 44] }, { x0: 82, x1: 98, lane: [86, 94] }, { x0: 124, x1: 140, lane: [128, 136] }].map((c) => ({ ...c, z0: GALLERY_N.z1, z1: GALLERY_S.z0 }));
export const PLAZA = { x0: 64, x1: 116, z0: -164, z1: -126 };
export const TIP = { x0: 140, x1: 186, z0: -168, z1: -124 };
/** The basket deck below the south gallery, out over the cloud (y LOW), and its stair down from a landing on the gallery's edge. */
export const BASKET = { x0: 67, x1: 92, z0: -56, z1: -40 };
export const BASKET_STAIR = { landing: { x0: 45, x1: 49, z0: -56, z1: -53 }, from: [49, DECK, -54.5], to: [67, LOW, -54.5] };
/** The timber stair up the north face: switchback flights in two lanes (z), between x0 and x1, from the north gallery to the top. */
export const NORTH_STAIR = { x0: 60, x1: 68.55, laneA: [-238.4, -236.1], laneB: [-241, -238.7], flights: 10, landing: 2.4 };
/** The ship on the top, its hatch toward the south edge (the cloud and the far rocks out past it, the stair's head on the right). */
export const SHIP_SITE = { x: 82, z: -150, heading: -0.3 };
/** The cloud far below. */
export const CLOUD_Y = -110;

/** The ground: nothing but the cloud, far below (everything walkable is real geometry). */
export const groundHeight = () => -600;

export const UNDERSIDE_CONTENT = {
  weather: [],
  // no story to follow: the page names the place and closes on the tip deck
  story: {
    title: 'THE UNDERSIDE',
    intro: 'A shelf of white rock sticks out over the cloud, and a town hangs under it. The stair at the shelf’s south-west corner goes down the cliff to the town.',
    outro: 'From the deck at the tip of the shelf the whole town shows, hanging over the cloud: the white houses under the rock, the decks and their lamps, the long red cloths falling toward the sea of cloud.',
    label: 'the tip deck', goal: [(TIP.x0 + TIP.x1) / 2 + 12, DECK, (TIP.z0 + TIP.z1) / 2], radius: 9, verticalRadius: 4, manual: true,
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere who came to see the town hung under the rock, and its own folk
  npcs: [
    { ...GARAGE_PEOPLE.pip, at: [20, -60], y: DECK, radius: 2, world: 'garage', lang: 'garage',
      lines: ['~surprised~ Don’t look down. I looked down. There’s nothing down there but more down.', '~playful~ Everything here hangs off something. I keep checking what I hang off.'],
      talk: { listen: [
        '~neutral~ Zazie. From the Hangar, where the floor goes round and up is wherever you stand. I don’t trust down. Here down is all there is.',
        '~curious~ They built the town under the rock so the rain can’t find it. The rain comes up out of the cloud anyway, they say. Sideways.',
        '~playful~ I asked how they mend a deck. They lower a man on a rope with a hammer. He whistles the whole way.',
        '~whisper~ The red cloths are for whoever lives under the cloud. So they know which way is up.',
        '~neutral~ Walk east under the rock to the tip. The deck there looks at nothing at all. I didn’t go.',
      ] } },
    { ...SKY_STONES_PEOPLE.tiv, at: [180, -150], y: DECK, radius: 2, world: 'arzach2', lang: 'arzach2',
      lines: ['~solemn~ On the stones we balance things on the ground. Here the whole town balances on nothing.', '~curious~ Come and look. The rock just stops.'],
      talk: { listen: [
        '~neutral~ Tiv, a novice of the Sky Stones. Mother Ysolde sent me to learn how they hang things here.',
        '~curious~ Every house is tied to the rock with three ropes. If one breaks, they say, the other two argue about it.',
        '~playful~ I put a stone on the rail and it stayed. Then the wind came up out of the cloud and I caught it. Nobody saw.',
        '~solemn~ The cloud goes on to the edge of the sky. Maybe the stones were shelves like this once, and the cloud took the rest.',
      ] } },
    { ...BAZAAR_PEOPLE.kip, at: [80, -46], y: LOW, radius: 2, world: 'bazaar', lang: 'bazaar',
      lines: ['~happy~ Baskets! The best couriers there are. They never argue about the way.', '~neutral~ Up, down, up, down. That’s the whole map here.'],
      talk: { listen: [
        '~neutral~ Kip, courier of the skybridges, at the Signal Market. Here they don’t need me. They have ropes.',
        '~curious~ Bread goes down in the morning, the washing comes up at night. What goes down at night, nobody says.',
        '~playful~ I rode a basket once. Halfway down I learned their word for stop. It is the same word as sorry.',
        '~whisper~ Some of the ropes go right down into the cloud. Nobody hauls those up.',
      ] } },
    // the town's own folk
    { at: [64, -128], y: SHELF.top, radius: 3, lang: 'arzach2', lines: ['~curious~ A ship on the top! We only get birds up here, and the wind.', '~neutral~ The town is under your feet. The stair at the south-west corner goes down to it.'] },
    { at: [11, STAIR.foot + 6], y: DECK, radius: 3, lang: 'arzach2', lines: ['~tired~ Two hundred steps down, two hundred up. The baskets are quicker, but they don’t take people.', '~happy~ Mind the rope walk. It sways, but it has never let anyone go.'] },
    { at: [78, -138], y: DECK, radius: 3, lang: 'arzach2', lines: ['~happy~ This is the Bell Deck. The middle of everything, under the middle of the rock.', '~whisper~ Listen. You can hear the rock creak when the sun warms it.'] },
    // (Maudie: the detour's trace, src/story/sightings-detours.js)
    { id: 'maudie', name: 'Maudie', title: 'who dries the fish', color: '#a8b8c8', kind: 'f', at: [104, -230], y: DECK, radius: 3, lang: 'arzach2',
      lines: ['~neutral~ The north side gets the cold light. We dry the fish here.', '~curious~ The timber stair goes up the north face to the top. Ten turns. Count them.'],
      talk: { listen: [
        { after: () => true, say: [
          '~neutral~ A woman wintered here once, alone, in the empty house at the end of this gallery. Never said from where.',
          '~sad~ Every night she turned on a little receiver, low, and listened to the hiss. Through the wall it sounded like waiting.',
          '~solemn~ She always switched it off before morning. In spring she went up the north stair.',
        ], do: { set: { 'sight.underside.maudie': true } } },
        '~neutral~ The north side gets the cold light. We dry the fish here.',
        '~curious~ The timber stair goes up the north face to the top. Ten turns. Count them.',
      ] } },
    { at: [110, -60], y: DECK, radius: 3, lang: 'arzach2', lines: ['~solemn~ My grandmother was born in a house on the face. She never once stood on the top.', '~playful~ We hang the banners so the birds know where the doors are.'] },
    { at: [120, -96], y: SHELF.top, radius: 3, lang: 'arzach2', lines: ['~happy~ We keep the gardens up here. Everything else hangs below.', '~neutral~ The tip of the shelf? Go down and walk east under the rock. The deck at the end looks at nothing at all.'] },
  ],
};

/** What the town's crowd says (crowd.js), toned. */
export const CROWD_LINES = [
  '~neutral~ Mind the gaps between the planks. The cloud is a long way down.',
  '~happy~ Fresh bread on the morning basket!',
  '~curious~ You came down the stair? From the top? Nobody comes from the top.',
  '~whisper~ When the wind comes up out of the cloud the whole town hums.',
  '~playful~ My cousin dropped a spoon into the cloud. We say it is still falling.',
  '~solemn~ We tie every house to the rock three times. Once for the house, once for the people, once for luck.',
];

/** The level's colours: a golden morning over the cloud, a rose dusk, an indigo night with the windows lit. */
export const UNDERSIDE_SKY = { day: UNDER_DAY, dusk: UNDER_DUSK, night: UNDER_NIGHT };

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildUnderside(scene) {
  const rng = mulberry32(81100), R = (a, b) => a + rng() * (b - a);
  const group = new THREE.Group();
  group.name = 'The Underside';
  scene.add(group);
  const kit = new RoomKit({ group, centre: new THREE.Vector3(), seed: 81100 });
  const M = underMats(kit);
  const SOLID = { solid: true, shadow: true }, LOOSE = { solid: false, shadow: false }, DRAWN = { solid: false, shadow: true };
  const add = (m, g, o = SOLID) => kit.add(m, g, o);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const noShadow = [];

  // ---------------------------------------------------------- the shelf (solid: its top walked on, the ship on it)
  const SX = SHELF.x1 - SHELF.x0, SZ = SHELF.zS - SHELF.zN, cx = (SHELF.x0 + SHELF.x1) / 2, cz = (SHELF.zS + SHELF.zN) / 2;
  // (its lobes kept a few metres over the decks, its faces' bulges inside 5 m: the galleries and the north stair pass them)
  const lobes = lobesFor({ sx: SX, sz: SZ, n: 16, r: [10, 22], h: [2, 4.5], seed: 7 }).filter(([x]) => x + cx > 4);
  {
    // (its underside in its own deeper stone: the faces turned well down)
    const [under, rest] = splitFaces(slab({ sx: SX, sy: SHELF.T, sz: SZ, rTop: 3, rBot: 7, rSide: 12, band: 7, ledge: 1.2, cracks: 12, crack: 1, lump: 0.8, wobble: 1, pillow: 1.6, lobes, tip: 0.4, tipLen: 60, seed: 11, seg: 3 }).translate(cx, BASE, cz), (n) => n.y < -0.55);
    add(M.rock, rest); add(M.rockUnder, under);
  }
  yield;

  // ---------------------------------------------------------- the mountain: its face north and south of the shelf, its bulk behind
  const rockAt = (o, x, y, z, yaw = 0, mat = M.rock, opt = SOLID) => add(mat, slab({ rTop: 6, rBot: 4, rSide: 8, band: 11, ledge: 0.8, cracks: 5, crack: 1, lump: 1, wobble: 0.6, flatTop: false, seg: 6, ...o }).rotateY(yaw).translate(x, y, z), opt);
  // (the face beside the stair kept smooth, so its steps never meet a bulge: its east side at x ≈ 2.5)
  rockAt({ sx: 60, sy: 280, sz: 150, seed: 21, lump: 0.4, wobble: 0.3, cracks: 3 }, -27.5, -210, 0);
  rockAt({ sx: 70, sy: 300, sz: 200, seed: 22 }, -34, -210, -150);
  rockAt({ sx: 60, sy: 290, sz: 140, seed: 23 }, -28, -210, -312);
  rockAt({ sx: 80, sy: 330, sz: 160, seed: 24 }, -40, -210, 140, 0.15);
  // its bulk climbing behind (west), its skyline over the shelf (solid too: what overlaps the face is the same rock)
  rockAt({ sx: 120, sy: 360, sz: 260, seed: 25, band: 16 }, -120, -210, -60, 0.1);
  rockAt({ sx: 140, sy: 400, sz: 220, seed: 26, band: 16 }, -150, -210, -280, -0.2);
  rockAt({ sx: 120, sy: 330, sz: 200, seed: 27, band: 16 }, -130, -210, 170, 0.3);
  yield;

  // ---------------------------------------------------------- the great stair down the face, its landings
  {
    const S = stoneStair({ y0: DECK, y1: SHELF.top, w: STAIR.w, rise: STAIR.rise, run: STAIR.run, wall: 1, base: -60, parapet: 1, seed: 3 });
    const at = (g) => g.translate(STAIR.x, 0, STAIR.foot);
    for (const g of S.step) add(M.step, at(g));
    for (const g of S.rock) add(M.rock, at(g));
    for (const g of S.wall) add(M.step, at(g));
    // the head's landing onto the shelf's top, the foot's landing jutting from the face
    add(M.step, new THREE.BoxGeometry(8, 4, 12).translate(6.5, SHELF.top - 2, STAIR.head - 5.4));
    add(M.rock, new THREE.BoxGeometry(LANDING.x1 - LANDING.x0, 40, LANDING.z1 - LANDING.z0).translate((LANDING.x0 + LANDING.x1) / 2, DECK - 20, (LANDING.z0 + LANDING.z1) / 2));
    // its parapet round the landing's open sides
    add(M.step, new THREE.BoxGeometry(0.6, 1, LANDING.z1 - LANDING.z0).translate(LANDING.x1 - 0.3, DECK + 0.5, (LANDING.z0 + LANDING.z1) / 2));
    add(M.step, new THREE.BoxGeometry(LANDING.x1 - LANDING.x0, 1, 0.6).translate((LANDING.x0 + LANDING.x1) / 2, DECK + 0.5, LANDING.z1 - 0.3));
    // lamps up the stair, on the parapet
    for (let i = 10; i < STAIR.n; i += 24) { const z = STAIR.foot - i * STAIR.run, y = DECK + i * STAIR.rise; lampAt(kit, M, STAIR.x + STAIR.w / 2 + 0.3, y + 2.2, z, y + 1.1, { r: 8 }); add(M.woodDark, post(STAIR.x + STAIR.w / 2 + 0.3, y + 0.9, z, y + 2.6, 0.06), LOOSE); }
  }
  yield;

  // ---------------------------------------------------------- the town's decks (y DECK): solid as drawn, railed on every open edge
  const yU = () => BASE;
  const overhead = (x, z) => (x > 2 && x < SHELF.x1 - 6 && z < SHELF.zS - 1 && z > SHELF.zN + 1 ? BASE : -Infinity);
  const deckW = (o) => deckAt(kit, M, { y: DECK, up: overhead, every: 6, plank: 0.9, ...o });
  // the rope walk, along the stair's rock from the landing into the south gallery
  deckW({ ...WALK, z1: WALK.z1, rail: 'ew', gaps: [], seed: 1 });
  for (let z = WALK.z1 - 3; z > WALK.z0 + 6; z -= 6) add(M.wood, stick(V(WALK.x0 + 0.2, DECK - 0.5, z), V(STAIR.x + STAIR.w / 2 + 0.4, DECK - 3.5, z), 0.1), LOOSE);
  // the south gallery: open to the rope walk, the cross decks and the basket stair's landing
  deckW({ ...GALLERY_S, rail: 'nse', gaps: [['s', WALK.x0 - GALLERY_S.x0, WALK.x1 - GALLERY_S.x0], ['s', BASKET_STAIR.landing.x0 - GALLERY_S.x0, BASKET_STAIR.landing.x1 - GALLERY_S.x0], ...CROSS.map((c) => ['n', c.lane[0] - GALLERY_S.x0 - 0.5, c.lane[1] - GALLERY_S.x0 + 0.5])], seed: 2 });
  // the north gallery: open to the cross decks and to the north stair's foot (its landing just north of it)
  const NS0 = NORTH_STAIR.x0 - NORTH_STAIR.landing;
  deckW({ ...GALLERY_N, rail: 'nswe', gaps: [['n', NS0 - GALLERY_N.x0 + 0.2, NORTH_STAIR.x0 - GALLERY_N.x0 - 0.2], ...CROSS.map((c) => ['s', c.lane[0] - GALLERY_N.x0 - 0.5, c.lane[1] - GALLERY_N.x0 + 0.5])], seed: 3 });
  // the cross decks (their lanes kept clear, houses along their sides), the Bell Deck across the middle one (which
  // stops at its edges: no two decks on the same spot), the tip deck off the east one's side
  for (const [i, c] of CROSS.entries()) {
    const parts = c.x0 < PLAZA.x1 && c.x1 > PLAZA.x0 ? [[c.z0, PLAZA.z0], [PLAZA.z1, c.z1]] : [[c.z0, c.z1]];
    for (const [z0, z1] of parts) {
      const gaps = c.x1 >= TIP.x0 && TIP.z0 < z1 && TIP.z1 > z0 ? [['e', TIP.z0 - z0, TIP.z1 - z0]] : [];
      deckW({ x0: c.x0, x1: c.x1, z0, z1, rail: 'we', gaps, seed: 4 + i + z0 * 0.01 });
    }
  }
  deckW({ ...PLAZA, rail: 'nswe', gaps: [['n', CROSS[1].x0 - PLAZA.x0, CROSS[1].x1 - PLAZA.x0], ['s', CROSS[1].x0 - PLAZA.x0, CROSS[1].x1 - PLAZA.x0]], seed: 8 });
  deckW({ ...TIP, rail: 'nse', seed: 9 });
  // the basket deck below, and its stair down from its landing on the gallery's edge
  deckAt(kit, M, { ...BASKET, y: LOW, rail: 'swe', gaps: [['w', 0, 2.6]], up: null, seed: 10 });
  deckW({ ...BASKET_STAIR.landing, rail: 'we', seed: 11 });
  { const S = stairs(BASKET_STAIR.from, BASKET_STAIR.to, { w: 2, rise: 0.2 }); for (const g of S.planks) add(M.plank, g); for (const g of S.wood) add(M.wood, g); }
  // the basket deck hangs from the south gallery's edge on slanted rods, posts under its outer edge
  for (let x = BASKET.x0 + 1; x < BASKET.x1; x += 4) { add(M.rod, stick(V(x, LOW + 1.05, BASKET.z1 - 0.2), V(x, DECK - 0.3, GALLERY_S.z1 - 0.3), 0.06), LOOSE); add(M.rod, stick(V(x, LOW + 1.05, BASKET.z0 + 0.3), V(x, DECK - 0.3, GALLERY_S.z1 - 0.3), 0.06), LOOSE); }
  yield;

  // ---------------------------------------------------------- the north stair: timber flights up the north face to the top
  {
    const NS = NORTH_STAIR, rise = (SHELF.top - DECK) / NS.flights;
    const lane = (k) => (k % 2 ? NS.laneB : NS.laneA), mid = (l) => (l[0] + l[1]) / 2, wl = (l) => l[1] - l[0];
    // its foot: a landing off the gallery's edge (through the gap in its rail), lane A's west end
    deckAt(kit, M, { x0: NS.x0 - NS.landing, x1: NS.x0, z0: NS.laneA[0], z1: GALLERY_N.z0, y: DECK, rail: 'nw', up: null, seed: 19 });
    for (let k = 0; k < NS.flights; k++) {
      const y0 = DECK + k * rise, y1 = y0 + rise, l = lane(k), east = k % 2 === 0;
      const S = stairs([east ? NS.x0 : NS.x1, y0, mid(l)], [east ? NS.x1 : NS.x0, y1, mid(l)], { w: wl(l), rise: 0.2 });
      for (const g of S.planks) add(M.plank, g); for (const g of S.wood) add(M.wood, g);
      // the landing at its top, across both lanes, railed round (the last one open to the bridge onto the top)
      const lx0 = east ? NS.x1 : NS.x0 - NS.landing, lx1 = east ? NS.x1 + NS.landing : NS.x0, last = k === NS.flights - 1;
      deckAt(kit, M, { x0: lx0, x1: lx1, z0: NS.laneB[0], z1: NS.laneA[1], y: y1, rail: (east ? 'nse' : 'nsw').replace(last ? 's' : '#', ''), up: null, seed: 20 + k });
    }
    // posts down the face from the flights, braces back to the rock
    for (const x of [NS.x0 - NS.landing + 0.3, NS.x1 + NS.landing - 0.3, (NS.x0 + NS.x1) / 2]) for (const z of [NS.laneB[0] + 0.2, NS.laneA[1] - 0.2]) add(M.woodDark, post(x, DECK - 2, z, SHELF.top, 0.12));
    for (let y = DECK + 4; y < SHELF.top; y += 7) for (const x of [NS.x0 - 1, NS.x1 + 1]) add(M.rod, stick(V(x, y, NS.laneA[1]), V(x, y + 3, SHELF.zN + 1.5), 0.08), LOOSE);
    // its top: a bridge from the last landing over the face's top edge onto the shelf
    deckAt(kit, M, { x0: NS.x0 - NS.landing, x1: NS.x0, z0: NS.laneA[1], z1: SHELF.zN + 6, y: SHELF.top, rail: 'we', up: null, seed: 31 });
    NS.top = [NS.x0 - NS.landing / 2, SHELF.top, SHELF.zN + 4];
  }
  yield;

  // ---------------------------------------------------------- the houses on the decks: rows along the galleries' backs and the cross decks' sides
  /** A row of timber houses from u0 to u1 along a deck's edge (along x, or along z: alongZ), their backs on the line `at`, turned by yaw (their fronts toward its +z). */
  const shacks = (u0, u1, at, yaw, o = {}) => {
    for (let u = u0 + R(0, 2); u < u1 - 4;) {
      const w = Math.min(u1 - u, R(5, 10));
      if (w < 4) break;
      if (rng() < (o.fill ?? 0.85)) {
        const c = u + w / 2, px = o.alongZ ? at : c, pz = o.alongZ ? c : at;
        shacksAt(kit, M, px, DECK, pz, { yaw, w, floors: o.floors ?? (rng() < 0.6 ? 2 : 1), fh: 3.2, depth: o.depth ?? [1.6, 3.4], seed: c * 7 + at, lit: 0.45, detail: 0.7 });
      }
      u += w + R(1, 3);
    }
  };
  // the stretches of an edge between cuts ([from, to]…), each at least 4 m
  const between = (u0, u1, cuts) => { const out = []; let a = u0; for (const [p, q] of [...cuts].sort((m, n) => m[0] - n[0])) { if (p > a + 4) out.push([a, p]); a = Math.max(a, q); } if (u1 > a + 4) out.push([a, u1]); return out; };
  // the white houses hung down to the galleries' backs (the rows of timber ones stop short of them)
  const DROPS_S = [26, 64, 112], DROPS_N = [50, 110];   // (x; set at the backs, the walk along the rail kept clear)
  // the south gallery's back (its fronts to the south), between the cross decks' mouths and the hung houses
  for (const [a, b] of between(GALLERY_S.x0 + 6, GALLERY_S.x1 - 1, [...CROSS.map((c) => [c.x0 - 1, c.x1 + 1]), ...DROPS_S.map((x) => [x - 5.5, x + 5.5])])) { yield; shacks(a, b, GALLERY_S.z0 + 0.3, 0); }
  // the north gallery's back (fronts to the north)
  for (const [a, b] of between(GALLERY_N.x0 + 2, GALLERY_N.x1 - 1, [...CROSS.map((c) => [c.x0 - 1, c.x1 + 1]), ...DROPS_N.map((x) => [x - 5.5, x + 5.5])])) shacks(a, b, GALLERY_N.z1 - 0.3, Math.PI);
  yield;
  // the cross decks' sides, their fronts to the lane (rows along z)
  for (const c of CROSS) {
    yield;
    const cuts = [[PLAZA.z0 - 2, PLAZA.z1 + 2], ...(c.x1 >= TIP.x0 ? [[TIP.z0 - 2, TIP.z1 + 2]] : [])];
    for (const [a, b] of between(c.z0 + 2, c.z1 - 2, cuts)) {
      // the west side: fronts toward +x (yaw π/2); the east side: toward -x (one storey: their balconies stay low)
      shacks(a, b, c.x0 + 0.3, Math.PI / 2, { alongZ: true, depth: [1.4, c.lane[0] - c.x0 - 0.6], floors: 1 });
      if (!(c.x1 >= TIP.x0)) shacks(a, b, c.x1 - 0.3, -Math.PI / 2, { alongZ: true, depth: [1.4, c.x1 - c.lane[1] - 0.6], floors: 1 });
      else for (const [p, q] of between(a, b, [[TIP.z0 - 2, TIP.z1 + 2]])) shacks(p, q, c.x1 - 0.3, -Math.PI / 2, { alongZ: true, depth: [1.4, c.x1 - c.lane[1] - 0.6], floors: 1 });
    }
  }
  yield;

  // ---------------------------------------------------------- the white houses: hung from the underside down to the decks, on the face's ledges
  const drop = (x, z, r, o = {}) => podAt(kit, M, x, DECK, z, { r, h: (BASE + 1.2 - DECK) / 1.12, kind: 'drop', seed: x * 3 + z, windows: 4, lit: 0.5, yaw: o.yaw ?? R(-0.5, 0.5), detail: 0.7, lampR: 7, ...o });
  // round the Bell Deck, its corners and its middle's sides
  for (const [x, z, r, yaw] of [[PLAZA.x0 + 6, PLAZA.z0 + 6, 5, -Math.PI / 4], [PLAZA.x1 - 6, PLAZA.z0 + 6, 5.5, Math.PI / 4], [PLAZA.x0 + 6, PLAZA.z1 - 6, 4.5, -3 * Math.PI / 4], [PLAZA.x1 - 6, PLAZA.z1 - 6, 5, 3 * Math.PI / 4], [PLAZA.x0 + 5, (PLAZA.z0 + PLAZA.z1) / 2, 4, -Math.PI / 2], [PLAZA.x1 - 5, (PLAZA.z0 + PLAZA.z1) / 2, 4, Math.PI / 2]]) drop(x, z, r, { yaw: yaw + Math.PI });
  // along the galleries' backs, between the rows of houses, and at the tip deck's back
  for (const x of DROPS_S) drop(x, GALLERY_S.z0 + 3.4, 3.2, { yaw: 0 });
  for (const x of DROPS_N) drop(x, GALLERY_N.z1 - 3.6, 3.4, { yaw: Math.PI });
  drop(TIP.x0 + 10, TIP.z0 + 6, 4.5, { yaw: Math.PI * 0.75 });
  yield;
  // on the south face's ledges over the gallery (their doors out), and the north face's
  for (let i = 0; i < 9; i++) { const x = 16 + i * 14 + R(-3, 3), r = R(4, 7.5); podAt(kit, M, x, BASE + R(1, 10), SHELF.zS + r * 0.25, { r, h: r * R(1.3, 1.8), kind: rng() < 0.6 ? 'egg' : 'dome', seed: x, windows: 5, lit: 0.4, detail: 0.7, squash: 0.85, lampR: 6 }); }
  for (let i = 0; i < 6; i++) { const x = 40 + i * 16 + R(-3, 3), r = R(4, 6.5); if (Math.abs(x - 64) < 10) continue; podAt(kit, M, x, BASE + R(2, 10), SHELF.zN - r * 0.25, { r, h: r * R(1.3, 1.8), kind: 'egg', seed: x + 5, windows: 4, lit: 0.4, detail: 0.7, squash: 0.85, yaw: Math.PI, lampR: 6 }); }
  // bulbs hung free under the rock between the decks (seen from the galleries)
  for (let i = 0; i < 14; i++) {
    const x = R(14, 150), z = R(SHELF.zN + 20, SHELF.zS - 20);
    if (CROSS.some((c) => x > c.x0 - 6 && x < c.x1 + 6) || (x > PLAZA.x0 - 6 && x < PLAZA.x1 + 6 && z > PLAZA.z0 - 6 && z < PLAZA.z1 + 6) || (x > TIP.x0 - 6 && z > TIP.z0 - 6 && z < TIP.z1 + 6)) continue;
    const r = R(3, 6), h = r * R(1.5, 2.4) / 1.13;
    podAt(kit, M, x, BASE + 1.2 - h * 1.12, z, { r, h, kind: 'bulb', seed: x + z, windows: 3, lit: 0.5, door: false, cupola: false, detail: 0.6, lights: false, solid: false });
  }
  yield;

  // ---------------------------------------------------------- the shelf's top: domes along its south edge, gardens, shrubs and grass round its edges
  for (const [x, z, r, h, yaw] of [[28, -76, 7, 12, 0.3], [50, -73, 5, 9, 0.1], [116, -78, 8, 14, -0.2], [138, -88, 6, 10, -0.5], [154, -116, 5.5, 9, -1.2], [100, -208, 6, 10, 2.8], [128, -198, 5, 8, 2.4], [22, -200, 7, 11, 3.3]]) {
    podAt(kit, M, x, SHELF.top - 0.3, z, { r, h, kind: 'dome', seed: x * 0.7, windows: 5, lit: 0.35, yaw, detail: 0.8, lampR: 6 });
  }
  {
    // shrubs along the edges (in from the rounded rim), grass in tufts on the top
    const edge = [[[10, -66], [150, -66]], [[150, -66], [166, -110]], [[166, -180], [150, -222]], [[150, -222], [10, -222]]];
    for (const [a, b] of edge) for (const g of shrubs([a[0], SHELF.top - 0.2, a[1]], [b[0], SHELF.top - 0.2, b[1]], { n: Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5), s: [0.8, 2.2], seed: a[0] + a[1], jitter: 2, detail: 0.6 })) add(M.shrub[Math.floor(rng() * 2)], g, LOOSE);
    // the top's meadow: a sheet of grass laid on the rock, its outline wandering a few metres in from the rim (the
    // pictures' green fringe), its ticks drawn by the ground's own ink
    {
      const pts = [], n = 64, c = [(SHELF.x0 + SHELF.x1) / 2 + 12, (SHELF.zS + SHELF.zN) / 2];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, ex = (SHELF.x1 - 18 - c[0]), ez = (SHELF.zS - SHELF.zN) / 2 - 7, k = 0.9 + 0.08 * Math.sin(a * 5 + 1) + 0.04 * Math.sin(a * 13);
        // (a rounded rectangle: |cos|^0.3 and |sin|^0.3 square it off)
        pts.push(new THREE.Vector2(c[0] + Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.3) * ex * k, -(c[1] + Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.3) * ez * k)));
      }
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1).rotateX(-Math.PI / 2).translate(0, SHELF.top + MEADOW, 0);
      const meadow = kit.mesh(g, makeMaterial({ mode: MODE_TERRAIN, color: UNDER_TONES.meadow, color2: UNDER_TONES.meadow2, color3: UNDER_TONES.rock2, ticks: true }), { solid: true, shadow: false });   // (walked on: the feet on the grass, not in it)
      meadow.name = 'The meadow on the top';
    }
    // bushes in clumps over the top, away from the ship and the ways to the stairs
    for (let i = 0; i < 46; i++) {
      const x = R(14, 156), z = R(SHELF.zN + 12, SHELF.zS - 10);
      if (Math.hypot(x - SHIP_SITE.x, z - SHIP_SITE.z) < 22 || Math.hypot(x - 40, z + 100) < 10) continue;
      for (const g of shrubs([x, SHELF.top - 0.2, z], [x + R(-6, 6), SHELF.top - 0.2, z + R(-6, 6)], { n: 2 + Math.floor(rng() * 4), s: [0.7, 1.8], seed: x * z, jitter: 2.5, detail: 0.6 })) add(M.shrub[Math.floor(rng() * 2)], g, LOOSE);
    }
    // a garden of herbs in boxes by the domes, crates by the stair's head
    for (let i = 0; i < 8; i++) add(M.wood2, new THREE.BoxGeometry(1, 0.8, 1).rotateY(R(0, 3)).translate(R(12, 22), SHELF.top + 0.35, R(-64, -72)));
  }
  yield;

  // ---------------------------------------------------------- banners from the decks' outer edges, baskets, lamps
  const bannerAlong = (x0, x1, z, y, dir, n, drop) => {
    for (let i = 0; i < n; i++) {
      const w = R(2.4, 7), u = R(x0 + w / 2, x1 - w / 2), zb = z + dir * 0.25;
      bannerAt(kit, M, [u - w / 2, y - 0.3, zb], [u + w / 2, y - 0.3, zb], R(...drop), { folds: Math.max(1, Math.round(w / 2.5)), fold: 0.12 + w * 0.04, pull: [R(-0.6, 0.6), dir * R(0, 1.2)], seed: u + y, tone: Math.floor(rng() * 3) });
    }
  };
  bannerAlong(GALLERY_S.x0 + 6, BASKET.x0 - 2, GALLERY_S.z1, DECK, 1, 4, [20, 40]);
  bannerAlong(BASKET.x1 + 2, GALLERY_S.x1, GALLERY_S.z1, DECK, 1, 6, [20, 44]);
  bannerAlong(BASKET.x0 + 1, BASKET.x1 - 1, BASKET.z1, LOW, 1, 4, [16, 36]);
  bannerAlong(GALLERY_N.x0 + 4, NORTH_STAIR.x0 - 4, GALLERY_N.z0, DECK, -1, 2, [16, 34]);
  bannerAlong(NORTH_STAIR.x1 + 6, GALLERY_N.x1, GALLERY_N.z0, DECK, -1, 5, [16, 38]);
  // the tip deck's three open sides (its east edge's cloths across x)
  bannerAlong(TIP.x0 + 14, TIP.x1 - 2, TIP.z1, DECK, 1, 3, [18, 40]);
  bannerAlong(TIP.x0 + 14, TIP.x1 - 2, TIP.z0, DECK, -1, 3, [18, 40]);
  for (let i = 0; i < 3; i++) { const w = R(3, 6), z = R(TIP.z0 + w, TIP.z1 - w); bannerAt(kit, M, [TIP.x1 + 0.25, DECK - 0.3, z - w / 2], [TIP.x1 + 0.25, DECK - 0.3, z + w / 2], R(20, 42), { folds: 2, fold: 0.3, pull: [R(0, 1), 0], seed: z, tone: i }); }
  // lamps under the galleries' eaves and along the decks
  const lampsAlong = (x0, x1, z, step) => { for (let x = x0 + 2; x < x1 - 1; x += step) lampAt(kit, M, x, DECK + 3.4, z, BASE, { r: 6.5 }); };
  lampsAlong(GALLERY_S.x0, GALLERY_S.x1, GALLERY_S.z1 - 1.4, 12);
  lampsAlong(GALLERY_N.x0, GALLERY_N.x1, GALLERY_N.z0 + 1.4, 14);
  for (const c of CROSS) for (let z = c.z0 + 6; z < c.z1 - 3; z += 14) lampAt(kit, M, (c.lane[0] + c.lane[1]) / 2, DECK + 3.4, z, BASE, { r: 6.5 });
  for (const [x, z] of [[PLAZA.x0 + 14, PLAZA.z0 + 12], [PLAZA.x1 - 14, PLAZA.z0 + 12], [PLAZA.x0 + 14, PLAZA.z1 - 12], [PLAZA.x1 - 14, PLAZA.z1 - 12], [(TIP.x0 + TIP.x1) / 2 + 10, (TIP.z0 + TIP.z1) / 2]]) lampAt(kit, M, x, DECK + 3, z, BASE, { r: 7, s: 1.6 });
  lampAt(kit, M, (BASKET.x0 + BASKET.x1) / 2, LOW + 3, BASKET.z1 - 2, DECK - 0.4, { r: 9 });
  for (let x = WALK.x1 - 0.3, z = WALK.z1 - 6; z > WALK.z0 + 4; z -= 12) lampAt(kit, M, x, DECK + 2.2, z, DECK + 3.4, { r: 8 });
  // the Bell Deck's stalls in a ring round the bell, their counters toward it
  {
    const goods = [M.banner[2], M.pot, M.wicker, M.leaves], bx = (CROSS[1].lane[0] + CROSS[1].lane[1]) / 2, bz = (PLAZA.z0 + PLAZA.z1) / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5, x = bx + Math.cos(a) * 14, z = bz + Math.sin(a) * 11;
      if (Math.abs(x - bx) < 6) continue;   // (the middle lane through it kept clear)
      const S = stall({ w: 4, seed: i + 3, goods: goods.length, deep: 2.8 }), yaw = Math.atan2(bx - x, bz - z), at = (g) => g.rotateY(yaw).translate(x, DECK, z);
      for (const g of S.wood) add(M.wood2, at(g)); for (const g of S.cloth) add(M.banner[i % 3], at(g), DRAWN); for (const g of S.dark) add(M.dark, at(g), LOOSE);
      for (const [k, list] of S.goods.entries()) for (const g of list) add(goods[k], at(g), LOOSE);
    }
  }
  // the tip deck: benches facing out, pots of herbs on the rails, crates, a cluster of lamps over its end
  {
    const ex = TIP.x1 - 3.5;
    for (const z of [-158, -150, -142, -134]) { add(M.wood2, new THREE.BoxGeometry(0.6, 0.45, 2.2).translate(ex - 1.5, DECK + 0.22, z)); add(M.wood, new THREE.BoxGeometry(0.12, 0.6, 2.2).translate(ex - 1.85, DECK + 0.6, z)); }
    for (let z = TIP.z0 + 2; z < TIP.z1 - 1; z += 5) { const Hb = herbs(TIP.x1 - 0.5, DECK, z, Math.PI / 2, { w: 1.2, seed: z, detail: 0.7 }); for (const g of Hb.pot) add(M.pot, g); for (const g of Hb.leaves) add(M.leaves, g, LOOSE); }
    for (let i = 0; i < 9; i++) { const s = R(0.6, 1.1); add(M.wood2, new THREE.BoxGeometry(s, s * 0.8, s).rotateY(R(0, 3)).translate(R(TIP.x0 + 4, TIP.x0 + 12), DECK + s * 0.4, R(TIP.z0 + 2, TIP.z0 + 8))); }
    for (const [dz, dy] of [[-3, 0], [0, 1.2], [3, 0.4], [-1.5, 2.2], [1.5, 2.6]]) lampAt(kit, M, ex - 4, DECK + 3.6 + dy, -146 + dz, BASE, { r: 8, light: dz === 0 });
  }
  // the Bell Deck's bell, hung from the rock over its middle
  {
    const bx = (CROSS[1].lane[0] + CROSS[1].lane[1]) / 2, bz = (PLAZA.z0 + PLAZA.z1) / 2;
    add(M.iron, new THREE.LatheGeometry([[0.001, 0], [1.3, 0.05], [1.2, 0.5], [0.8, 1.6], [0.55, 2.1], [0.001, 2.2]].map(([a, b]) => new THREE.Vector2(a, b)), 14).translate(bx, DECK + 4.6, bz), DRAWN);
    add(M.rope, stick(V(bx, DECK + 6.8, bz), V(bx, BASE + 0.5, bz), 0.05), LOOSE);
  }
  yield;

  // ---------------------------------------------------------- the town below the decks, out of reach: scaffolds, houses and banners hanging on down
  {
    // (in each face's frame: x along it, z out from it; drawn only)
    const below = (fk, x0, x1, o = {}) => town(fk, M, rng, { x0, x1, yU: DECK - 0.6, faceTop: DECK, levels: [DECK - 9, DECK - 15], out: [5, 7], under: [6, 3], fill: o.fill, facePods: 0, underPods: Math.round((x1 - x0) / 20), banners: Math.round((x1 - x0) / 8), baskets: 2, bannerDrop: [12, 30], back: false, lamps: false, people: false, shackFill: 0.6, detail: 0.6, crown: -0.5, plank: 1.2, ...o });
    below(framed(kit, 0, 0, GALLERY_S.z1 - 1, 0), GALLERY_S.x0 + 4, BASKET.x0 - 4);
    below(framed(kit, 0, 0, GALLERY_S.z1 - 1, 0), BASKET.x1 + 4, GALLERY_S.x1 - 4);
    yield;
    below(framed(kit, 0, 0, GALLERY_N.z0 + 1, Math.PI), -GALLERY_N.x1 + 4, -NORTH_STAIR.x1 - 6);
    below(framed(kit, TIP.x1 - 1, 0, 0, Math.PI / 2), -TIP.z1 + 2, -TIP.z0 - 2, { banners: 4 });
  }
  yield;

  // ---------------------------------------------------------- baskets going up and down on their ropes (the town's life)
  const lifts = [];
  {
    const geoB = basket(0, 0, 0, { r: 0.8, h: 0.9 });
    // [x, z: the rope's point; ax, az: the arm's foot on the rail; top: the pulley's height; lo: how low it goes]
    for (const [x, z, ax, az, top, lo] of [[71, BASKET.z1 + 1.4, 71, BASKET.z1 - 0.3, LOW + 1.8, -40], [86, BASKET.z1 + 1.4, 86, BASKET.z1 - 0.3, LOW + 1.8, -30], [30, GALLERY_S.z1 + 1.4, 30, GALLERY_S.z1 - 0.3, DECK + 1.8, -26], [120, GALLERY_S.z1 + 1.4, 120, GALLERY_S.z1 - 0.3, DECK + 1.8, -34], [TIP.x1 + 1.4, -150, TIP.x1 - 0.3, -150, DECK + 1.8, -44]]) {
      add(M.wood, stick(V(ax, top - 0.7, az), V(x, top, z), 0.08), LOOSE);
      const b = new THREE.Group();
      for (const g of geoB.wicker) b.add(new THREE.Mesh(g, M.wicker));
      for (const g of geoB.rope) b.add(new THREE.Mesh(g, M.rope));
      const cord = new THREE.Mesh(stick(V(0, 0, 0), V(0, 1, 0), 0.03, 3), M.rope);
      b.position.set(x, top - 6, z); cord.position.set(x, top, z);
      b.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
      cord.userData.noCollide = true; cord.userData.dynamic = true;
      group.add(b, cord);
      noShadow.push(cord);
      lifts.push({ b, cord, top, lo, phase: R(0, 6), speed: R(0.05, 0.09) });
    }
  }

  // ---------------------------------------------------------- far off: other rocks over the cloud, a lone tower, another shelf's town
  {
    const far = (x, y, z, s, yaw, o = {}) => add(M.rock, slab({ sx: 34 * s, sy: 220 * s, sz: 30 * s, rTop: 12 * s, rBot: 6 * s, rSide: 14 * s, band: 14 * s, ledge: 2.5 * s, cracks: 5, crack: 2 * s, lump: 3 * s, wobble: 3 * s, pillow: 4 * s, flatTop: true, seg: 8 * s, seed: x, ...o }).rotateY(yaw).translate(x, y, z), DRAWN);
    far(520, -220, 140, 1.2, 0.4);
    far(640, -220, -380, 1.6, -0.3);
    far(300, -200, -620, 1, 0.8);
    podAt(kit, M, 520, -220 + 220 * 1.2, 140, { r: 8, h: 20, kind: 'egg', seed: 7, windows: 4, lit: 0.5, solid: false, lights: false, detail: 0.5 });
    // another shelf far to the east-north-east, its side toward the tip deck, its own town hung under that side
    {
      const fx = 800, fz = -300, yaw = Math.PI * 0.7, u = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), n = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      add(M.rock, slab({ sx: 220, sy: 30, sz: 140, rTop: 4, rBot: 9, rSide: 14, band: 8, ledge: 1.6, cracks: 8, crack: 1.5, lump: 1.5, pillow: 3, tip: 0.4, tipLen: 60, seed: 51, seg: 10 }).rotateY(yaw).translate(fx, 10, fz), DRAWN);
      // (its root in a mountain of its own: past the root end, -u)
      add(M.rock, slab({ sx: 170, sy: 330, sz: 300, rTop: 60, rBot: 6, rSide: 50, band: 22, ledge: 3, cracks: 6, crack: 3, lump: 6, wobble: 8, pillow: 8, seed: 52, seg: 16, flatTop: false }).rotateY(yaw).translate(fx - u.x * 160, -220, fz - u.z * 160), DRAWN);
      // (the face toward the tip deck is the slab's -z side: n; the town's frame: x from the tip toward the root, z out along n)
      const fk = framed(kit, fx + n.x * 70, 0, fz + n.z * 70, Math.atan2(n.x, n.z));
      town(fk, M, rng, { x0: -100, x1: 90, yU: 10, faceTop: 40, levels: [4, -3, -10], out: [5, 6, 7], under: [10, 6, 3], fill: (x) => 0.3 + (x + 100) / 270, facePods: 8, underPods: 8, banners: 16, baskets: 2, back: 10, lamps: false, people: false, shackFill: 0.5, detail: 0.4, plank: 2.5 });
    }
  }
  yield;

  // ---------------------------------------------------------- the sea of cloud far below (instanced puffs, three levels of detail; a deck under them)
  {
    const cloudMat = M.cloud, near = [], mid = [], farL = [];
    // (the finest shape only where a puff is big on screen: the near ones under the decks)
    for (const p of cloudPuffs({ y: CLOUD_Y, near: 60, far: 2600, at: [80, -140], n: 400, size: [26, 64], seed: 3 })) ((p.main ? p.d < 420 : p.d < 170) ? near : p.d < 900 ? mid : farL).push(p);
    const dummy = new THREE.Object3D();
    for (const [list, detail] of [[near, 2], [mid, 1], [farL, 0]]) {
      const im = new THREE.InstancedMesh(puffGeo(detail, 3), cloudMat, list.length);
      list.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, i * 1.7, 0); dummy.scale.set(p.s, p.s * p.sy, p.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.userData.noCollide = true; im.userData.floats = true; im.frustumCulled = false;
      group.add(im); noShadow.push(im);
    }
    const deckG = new THREE.Mesh(new THREE.CircleGeometry(4600, 48).rotateX(-Math.PI / 2).translate(80, CLOUD_Y - 6, -140), cloudMat);
    deckG.userData.noCollide = true; deckG.userData.floats = true;
    group.add(deckG); noShadow.push(deckG);
  }
  yield;

  kit.finish();
  // (the shrubs, grass and herbs are plants: walked through, like the rest of the flora; the audits pass them by)
  for (const o of group.children) if (M.shrub.includes(o.material) || o.material === M.leaves || o.material === M.grass) o.userData.flora = true;
  noShadow.push(...kit.noShadow);
  const lights = [...kit.lights];
  yield;

  const spawn = new THREE.Vector3(SHIP_SITE.x + Math.sin(SHIP_SITE.heading) * 16, SHELF.top + MEADOW + 0.05, SHIP_SITE.z + Math.cos(SHIP_SITE.heading) * 16);
  return {
    id: 'underside',
    ground: { heightAt: groundHeight },
    envGround: UNDER_TONES.cloud,
    // (the shelf is one long slab and the town many small boxes: a BVH split by area)
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: SHIP_SITE.heading,
    camYaw: SHIP_SITE.heading + Math.PI,
    limit: 330, killY: -70,
    shipSite: { ...SHIP_SITE, y: SHELF.top },
    features: { mount: false, wind: false, jetpack: false, climb: true },
    // (a golden morning: the low sun from the east-south-east lights the south face and the tip, and in under the shelf)
    defaults: { hour: 7.6, preset: 'Moebius print', cloudShadows: 0, look: UNDER_LOOK },
    sky: { script: UNDERSIDE_SKY, planets: [{ az: 250, el: 24, size: 1.2, color: '#f4ecdc', craters: true }] },
    lights,
    noShadow,
    reactions: false,   // (nothing grows out of the rock: reactive-world.js)
    life: {
      flocks: [{ count: 16, color: '#f4f0ea', size: 0.8, radius: 110, height: [-30, 30], speed: 0.35, seed: 81 }, { count: 9, color: '#3a3448', size: 0.6, radius: 60, height: [44, 70], speed: 0.4, seed: 82 }],
      motes: { count: 140, color: '#fff4e0', size: 0.04, glow: 0.4, rise: 0.06, wind: [0.15, 0.04] },
    },
    atmo: (x, z, y) => ({ tint: [1, 1, 1], fog: 0.55, name: y > SHELF.top - 3 ? 'The top of the shelf' : x < 12 && z > SHELF.zS ? 'The great stair' : y < DECK - 3 ? 'The basket deck' : x > TIP.x0 + 10 ? 'The tip' : 'The Underside' }),
    crowdLines: CROWD_LINES,
    // The town's crowd (crowd.js): strollers along the galleries and the cross decks, people in twos and threes on
    // the Bell Deck and the tip deck, others at the rails looking out over the cloud. Candidates only: the crowd keeps
    // those on clear, walkable ground.
    crowdSpots() {
      const r = mulberry32(8121), groups = [], walks = [], edges = [];
      walks.push({ path: [V(GALLERY_S.x0 + 3, DECK, -60), V(GALLERY_S.x1 - 3, DECK, -60)], n: 8, pair: 0.4 });
      walks.push({ path: [V(GALLERY_N.x0 + 3, DECK, -229), V(GALLERY_N.x1 - 3, DECK, -229)], n: 5, pair: 0.3 });
      for (const c of CROSS) walks.push({ path: [V((c.lane[0] + c.lane[1]) / 2, DECK, c.z1 - 2), V((c.lane[0] + c.lane[1]) / 2, DECK, c.z0 + 2)], n: 3, pair: 0.3 });
      walks.push({ path: [V(11, DECK, WALK.z1 - 2), V(11, DECK, WALK.z0 + 2)], n: 2, pair: 0.2 });
      for (let x = PLAZA.x0 + 8; x < PLAZA.x1 - 6; x += 9) for (const z of [PLAZA.z0 + 8, (PLAZA.z0 + PLAZA.z1) / 2, PLAZA.z1 - 8]) if (r() < 0.45) groups.push({ at: V(x + (r() - 0.5) * 3, DECK, z + (r() - 0.5) * 3), n: 2 + Math.floor(r() * 2.4) });
      for (let x = TIP.x0 + 14; x < TIP.x1 - 4; x += 8) if (r() < 0.5) groups.push({ at: V(x, DECK, (TIP.z0 + TIP.z1) / 2 + (r() - 0.5) * 20), n: 2 });
      for (let x = GALLERY_S.x0 + 4; x < GALLERY_S.x1 - 3; x += 6) if (r() < 0.35 && !(x > BASKET_STAIR.landing.x0 - 2 && x < BASKET_STAIR.landing.x1 + 2) && !(x < WALK.x1 + 2)) edges.push({ at: V(x, DECK, GALLERY_S.z1 - 0.7), heading: 0, pose: 'rail' });
      for (let x = BASKET.x0 + 3; x < BASKET.x1 - 2; x += 5) if (r() < 0.5) edges.push({ at: V(x, LOW, BASKET.z1 - 0.7), heading: 0, pose: 'rail' });
      for (let z = TIP.z0 + 4; z < TIP.z1 - 3; z += 6) if (r() < 0.5) edges.push({ at: V(TIP.x1 - 0.7, DECK, z), heading: Math.PI / 2, pose: 'rail' });
      return { groups, walks, edges, avoid: [], farMax: 260, costume: 'underside', clear: [{ x: SHIP_SITE.x, z: SHIP_SITE.z, r: 16 }, { x: STAIR.x, z: STAIR.foot, r: 4 }] };
    },
    update(dt, t) {
      for (const m of kit.movers) m(t);
      // (the lamps' warm pools: faint in the day, full from dusk to dawn: the eclipse's own uLampsOn, by the sun's height)
      sharedUniforms.uLampsOn.value = 0.15 + 0.85 * (1 - THREE.MathUtils.smoothstep(sharedUniforms.uSunDir.value.y, -0.02, 0.14));
      // the baskets go down to the cloud's edge and up again, slowly, each at its own pace
      for (const L of lifts) {
        const k = 0.5 - 0.5 * Math.cos(t * L.speed + L.phase), y = L.top - 3 - k * (L.top - 3 - L.lo);
        L.b.position.y = y;
        L.cord.position.y = y + 1.4; L.cord.scale.y = Math.max(0.1, L.top - y - 1.4);
      }
    },
  };
}
export const createUnderside = stepped(buildUnderside);
