import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { stepped } from '../load-steps.js';
import { colourScript } from '../timeofday.js';
import { RoomKit } from './lab-kit.js';
import { PEOPLE as INCAL_PEOPLE } from '../story/incal-data.js';
import { PEOPLE as BAZAAR_PEOPLE } from '../story/bazaar-data.js';
import { table } from './eclipse-kit.js';
import {
  spaceMats, island, quarter, heap, bridge, railing, pipeStack, crownTree, lantern, resident, awning, laundry, poleCloth,
  SPACE_LOOK, SPACE_DAY, PLANET_TONE,
} from './space-city-kit.js';

// ---------------------------------------------------------------------------
// The City Floating in Space (references/The City Floating in Space/; its views in the References,
// reference-spacecity.js; the shapes and the look in space-city-kit.js): a city of rounded adobe houses in cream,
// salmon and coral heaped on islands that float in the black of space, joined by pale arched bridges, their
// undersides hung with dark machinery and cables dangling into the void. Stars all round, below as well as above
// (post.js drawSpace); a great pale planet hangs to the north over the roofs, lit by the city's own sun, so it is a
// crescent at midday and nearly full at night. Off the route: no story to follow, a few people to meet.
//
// The layout (north is -z): the ship lands on the Pier, a round dock at the south. A bridge north to the Gate
// Quarter, its lane between heaped houses; the broad Market Bridge, crowded, to the Market island, its plaza of
// stalls and tables in the middle of the city. From the market: east up to the Towers, west down to the Garden
// terrace with its trees, north to the Balcony island, whose dark teal railing looks out over the void at the far
// islands and the planet. Every island has a parapet round its edge, open where a bridge lands; climb over it and
// you fall into the void, and come back where you last stood (level.unsafe). Gravity is the game's own: the
// pictures' cables and washing hang straight down.
// ---------------------------------------------------------------------------

/** The islands you walk: their centre (x, z), deck height (y), outline (w × d, its corner radius cr). */
export const ISLANDS = {
  pier: { x: 0, y: 0, z: 122, w: 54, d: 54, cr: 27, deep: 22 },
  gate: { x: 0, y: 0, z: 32, w: 52, d: 52, cr: 14, deep: 26 },
  market: { x: 0, y: 0, z: -72, w: 76, d: 64, cr: 18, deep: 34 },
  towers: { x: 98, y: 6, z: -84, w: 46, d: 42, cr: 13, deep: 30 },
  garden: { x: -92, y: -4, z: -60, w: 42, d: 36, cr: 12, deep: 24 },
  balcony: { x: 0, y: 0, z: -164, w: 44, d: 40, cr: 13, deep: 30 },
};
const I0 = ISLANDS;
/** The bridges between them: [from, to] as deck points ([x, y, z]), their width; each starts 1.5 m in on its decks. */
export const BRIDGES = [
  { name: 'the Pier bridge', a: [0, 0, I0.pier.z - 25.5], b: [0, 0, I0.gate.z + 24.5], w: 5 },
  { name: 'the Market Bridge', a: [0, 0, I0.gate.z - 24.5], b: [0, 0, I0.market.z + 30.5], w: 7.5, hump: 0.9, end: 8, mid: 1.6 },
  { name: 'the Towers bridge', a: [I0.market.x + 36.5, 0, -74], b: [I0.towers.x - 21.5, 6, -80], w: 4.2 },
  { name: 'the Garden bridge', a: [I0.market.x - 36.5, 0, -66], b: [I0.garden.x + 19.5, -4, -62], w: 4.2 },
  { name: 'the Balcony bridge', a: [0, 0, I0.market.z - 30.5], b: [0, 0, I0.balcony.z + 18.5], w: 4.6 },
];
/** Where the ship lands (the Pier's middle, a little south of it: its ramp toward the bridge). */
export const SHIP_SITE = { x: 0, z: 128 };
/** Below this you have fallen into the void: you come back where you last stood. */
export const UNSAFE_Y = -40;
/** The Market's plaza (clear of houses): its middle and radius. */
export const PLAZA = { x: 0, z: -70, r: 19 };

export const SPACECITY_CONTENT = {
  weather: [],
  // no story to follow: the page names the place and closes at the Balcony's railing
  story: {
    title: 'THE CITY FLOATING IN SPACE',
    intro: 'A city of heaped houses on islands floating in the dark, joined by bridges, a great pale planet over its roofs. The Market Bridge leads north from the Gate Quarter into the middle of it.',
    outro: 'From the Balcony the whole city shows against the stars: the islands and their lamps, the cables hanging under them into nothing, and the planet turning its lit face toward you.',
    label: 'the Balcony’s railing', goal: [0, 0.2, I0.balcony.z - 15], radius: 8, verticalRadius: 4, manual: true,
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere, and the city's own folk
  npcs: [
    { ...BAZAAR_PEOPLE.kip, at: [2.4, (I0.gate.z - 24.5 + I0.market.z + 30.5) / 2], y: 0.9, radius: 2, world: 'bazaar', lang: 'bazaar',
      lines: ['~playful~ Bridges! A city of nothing but bridges! I could run messages here for ever.', '~shout~ Don’t look down. Or do, it’s great.'],
      talk: { listen: [
        '~happy~ Kip, courier of the skybridges. The Market’s skybridges were the best in the world. Then I came here.',
        '~curious~ They don’t pay in fruit. They pay in lamp oil. I have nine lamps now and nowhere to put them.',
        '~playful~ The Market Bridge is the fast way. The Garden bridge goes down, so it’s faster coming back up. That’s not how it works, they say. It is for me.',
        { after: 'met.kip', say: '~neutral~ If you drop something off the edge, it doesn’t land. I tried with a pebble. Then with a better pebble.' },
      ] } },
    { ...INCAL_PEOPLE.nima, at: [-6, I0.gate.z - 4], y: 0, radius: 2, world: 'incal', lang: 'incal',
      lines: ['~playful~ Up the shaft I swept the high terrace. Here every terrace is the high one.', '~neutral~ Mind the dust. It goes over the edge and just… floats.'],
      talk: { listen: [
        '~neutral~ Nima. I sweep. I came to see a city that has no bottom, and I found I still have a broom.',
        '~curious~ The dust doesn’t fall here. You sweep it over the parapet and it hangs there in the dark, a little cloud of it, for days.',
        '~happy~ The people here sweep toward the planet. For luck, they say. I sweep toward the planet now too.',
      ] } },
    { ...BAZAAR_PEOPLE.sel, at: [8, I0.balcony.z - 12], y: 0, radius: 2, world: 'bazaar', lang: 'bazaar',
      lines: ['~solemn~ Listen. The planet hums. Very low. You need the old tower’s ears to hear it.', '~happy~ Mind the railing, love. There’s nothing under it for a long way.'],
      talk: { listen: [
        '~neutral~ Madame Sel. Forty years I listened to the sky from a tower. Here the sky is all round, even under your feet.',
        '~curious~ The cables under the islands aren’t tied to anything. They’re antennas. The whole city is listening to the planet.',
        '~solemn~ At night it turns its lit face to us. That’s when it speaks loudest. I write it down. I don’t know the language yet.',
        { after: 'met.sel', say: '~whisper~ Come back at night. Stand here. Don’t say anything for a while.' },
      ] } },
    // the city's own folk
    { at: [-5, I0.pier.z - 10], y: 0, radius: 3, lang: 'incal', lines: ['~curious~ A ship! Did you come across the dark? Nobody comes across the dark.', '~neutral~ The bridge goes north. Everything goes north from here.'] },
    { at: [6, I0.gate.z + 12], y: 0, radius: 3, lang: 'incal', lines: ['~happy~ Welcome to the Gate. We sweep the lane every morning, so mind your boots.', '~whisper~ Don’t lean on the parapet at the corner. It leans back.'] },
    { at: [PLAZA.x + 10, PLAZA.z + 6], y: 0, radius: 3, lang: 'incal', lines: ['~happy~ Lamp oil, cloth, bread from the garden! Everything grows up here, even bread.', '~playful~ Sit, eat. Nothing falls off a table here. Things fall off the island.'] },
    { at: [I0.towers.x - 6, I0.towers.z + 10], y: 6, radius: 3, lang: 'incal', lines: ['~solemn~ My grandmother hung the first cable under this island. It still hums when she visits.', '~neutral~ The Towers are older than the Market. We were here first. We say that a lot.'] },
    { at: [I0.garden.x + 4, I0.garden.z - 6], y: -4, radius: 3, lang: 'incal', lines: ['~tired~ Every tree here was carried over a bridge in a pot. Every one.', '~happy~ Sit under the dark ones. They grow toward the planet, not the sun.'] },
  ],
};

/** What the city's crowd says (crowd.js), toned. */
export const CROWD_LINES = [
  '~happy~ Mind the edge! Mind the edge, it’s market day!',
  '~curious~ Is that a ship on the Pier? A real one?',
  '~neutral~ Look, the planet’s turning its face. It’ll be night soon.',
  '~playful~ I dropped my hat off the Garden bridge once. It’s still there, under us somewhere.',
  '~whisper~ Don’t whistle near the cables. They whistle back.',
  '~solemn~ My uncle walked off the edge to see what was under. He came back. He won’t say.',
];

/** The colours by the hour: space black at every hour; the light warm by day, rose at dusk, the planet's cool light at night. */
export const SPACECITY_SCRIPT = {
  day: SPACE_DAY,
  dusk: ['#020a0e', '#040a10', '#a8707e', '#ffd8c0', '#ffc8a0'],
  night: ['#01060a', '#02080c', '#3e4a6c', '#b4c0e4', '#f0ece0'],
};
/** The great planet over the city: north, low, its disc 44° across, plain (sky.planets). */
const SPACECITY_KEYS = colourScript(SPACECITY_SCRIPT);
export const PLANET = { az: 180, el: 17, size: 22, color: PLANET_TONE, craters: false };

// ------------------------------------------------------------------ building
const NC = { solid: false, shadow: false };
/** The distance from (x, z) to the segment [x0, z0, x1, z1]. */
function segDist(x, z, [x0, z0, x1, z1]) {
  const dx = x1 - x0, dz = z1 - z0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
}
/** The point of the segment nearest (x, z). */
function segNear(x, z, [x0, z0, x1, z1]) {
  const dx = x1 - x0, dz = z1 - z0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
  return [x0 + dx * t, z0 + dz * t];
}

/**
 * The lanes and squares kept clear on each island ([x0, z0, x1, z1, half-width] world, and circles [x, z, r]): the
 * way from bridge to bridge, the plaza, the overlooks. The houses face the nearest lane; the farther from it, the
 * more storeys they carry.
 */
export const LANES = {
  pier: { lanes: [], circles: [[0, 122, 40]] },
  gate: { lanes: [[0, 60, 0, 4, 3.4], [-26, 30, 26, 30, 2.6]], circles: [[0, 30, 7]] },
  market: { lanes: [[0, -38, 0, -106, 4], [-40, -66, 40, -74, 3]], circles: [[PLAZA.x, PLAZA.z, PLAZA.r]] },
  towers: { lanes: [[74, -80, 104, -84, 3], [98, -84, 98, -60, 2.6]], circles: [[98, -84, 6]] },
  garden: { lanes: [[-70, -62, -96, -58, 3]], circles: [[-98, -58, 12]] },
  balcony: { lanes: [[0, -144, 0, -178, 3.4]], circles: [[0, -176, 10], [0, -158, 6]] },
};

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildSpaceCity(scene) {
  const root = new THREE.Group();
  root.name = 'The City Floating in Space';
  scene.add(root);
  const kits = [], lights = [], noShadow = [];
  const kitFor = (name, seed) => { const group = new THREE.Group(); group.name = name; root.add(group); const k = new RoomKit({ group, centre: new THREE.Vector3(), seed }); kits.push(k); return k; };
  const rng = mulberry32(71500);
  const decks = {};
  const gapsOf = (I) => BRIDGES.flatMap((B) => [B.a, B.b].filter(([x, , z]) => Math.hypot(x - I.x, z - I.z) < Math.max(I.w, I.d) * 0.6).map(([x, , z]) => [x - I.x, z - I.z, B.w / 2 + 1.6]));

  // ---------------------------------------------------------- the islands you walk, one kit each (each culled on its own)
  for (const [key, I] of Object.entries(ISLANDS)) {
    yield;
    const kit = kitFor(`the ${key}`, 71500 + kits.length * 13), M = spaceMats(kit);
    const extra = key === 'balcony' ? [[0, -20, 17]] : [];   // (the balcony's north edge: its railing instead of the parapet)
    const D = island(kit, M, rng, { ...I, gaps: [...gapsOf(I), ...extra], cables: Math.round((I.w * I.d) / 70), lights: 6, seed: kits.length * 31 + 7, rim: 1.0 });
    decks[key] = { ...D, kit, M };
    const L = LANES[key], clearOf = (x, z, m) => L.lanes.every((s) => segDist(x, z, s) > s[4] + m * 0.9) && L.circles.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r + m * 0.85);
    const nearestLane = (x, z) => {
      let best = null, bd = Infinity;
      for (const s of L.lanes) { const d = segDist(x, z, s); if (d < bd) { bd = d; best = segNear(x, z, s); } }
      for (const [cx, cz, r] of L.circles) { const d = Math.hypot(x - cx, z - cz) - r; if (d < bd) { bd = d; best = [cx, cz]; } }
      return { p: best ?? [I.x, I.z], d: bd };
    };
    if (key === 'pier') continue;
    const peak = { gate: 4, market: 4, towers: 7, garden: 1, balcony: 3 }[key];
    quarter(kit, M, rng, {
      x0: I.x - I.w / 2, x1: I.x + I.w / 2, z0: I.z - I.d / 2, z1: I.z + I.d / 2, y: I.y, n: { gate: 30, market: 44, towers: 30, garden: 10, balcony: 18 }[key], gap: 0,
      size: key === 'towers' ? [5, 8] : [5, 9], tall: [3.6, 5.6], domes: key === 'garden' ? 0.4 : 0.15, round: key === 'towers' ? 0.35 : 0.25, towers: key === 'towers' ? 0.3 : 0.05,
      trees: key === 'garden' ? 0.6 : 0.35, lit: 0.55, awnings: 0.2, wash: 0.15, detail: 0.75,
      inside: (x, z, m) => D.inside(x, z, m * 0.55 + 0.8) && clearOf(x, z, m),
      face: (x, z) => { const { p } = nearestLane(x, z); return Math.atan2(p[0] - x, p[1] - z); },
      levels: (x, z, r) => Math.max(0, Math.min(peak, Math.round(nearestLane(x, z).d / 7 + (r() - 0.4) * 1.6))),
      light: false,
    });
  }

  // ---------------------------------------------------------- the bridges
  yield;
  {
    const kit = kitFor('the bridges', 71590), M = spaceMats(kit);
    for (const B of BRIDGES) {
      const br = bridge(kit, M, B.a, B.b, { w: B.w, hump: B.hump ?? 0.5, end: B.end ?? 6, mid: B.mid ?? 1.2 });
      B.at = br.at; B.L = br.L;
      // lamps on posts along the parapets, every 12 m
      const c = Math.cos(br.yaw), n = Math.max(1, Math.floor(br.L / 12));
      for (let i = 1; i < n; i++) for (const e of [-1, 1]) {
        const [x, y, z] = br.at(i / n);
        lantern(kit, M, x + c * e * (B.w / 2 - 0.2), y + 0.95, z - Math.sin(br.yaw) * e * (B.w / 2 - 0.2), { kind: 'post', h: 1.6, r: 7, light: e > 0 });
      }
    }
  }

  // ---------------------------------------------------------- the Pier: the landing, its bollards and lamps
  yield;
  {
    const { kit, M } = decks.pier, P = I0.pier;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26, r = P.w / 2 - 2.2, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
      if (Math.abs(x) < 5 && z < P.z) continue;   // (the bridge's mouth)
      lantern(kit, M, x, P.y, z, { kind: 'post', h: 3, r: 9, light: i % 3 === 0 });
    }
    for (const [x, z] of [[-14, 104], [15, 106], [-18, 136], [17, 140]]) {
      kit.add(M.iron, new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8).translate(x, P.y + 0.45, z), { solid: true, shadow: true });
    }
    // crates by the bridge's mouth, a mooring post with its cable down into the void
    for (const [x, z, s] of [[-7, 100, 1.1], [-8.4, 101.6, 0.9], [8, 99, 1.2]]) kit.add(M.wood, new THREE.BoxGeometry(s, s, s).translate(x, P.y + s / 2, z), { solid: true, shadow: true });
  }

  // ---------------------------------------------------------- the Gate Quarter: its lane, its lamps, washing over it
  yield;
  {
    const { kit, M } = decks.gate, G = I0.gate;
    for (let z = G.z + 20; z > G.z - 22; z -= 9) for (const e of [-1, 1]) lantern(kit, M, e * 3.6, G.y, z, { kind: 'post', h: 2.8, r: 8, light: e > 0 });
    for (let z = G.z + 16; z > G.z - 18; z -= 11) laundry(kit, M, rng, [-4.2, G.y + 5.5, z], [4.2, G.y + 5.8, z - 1.5], { n: 4 });
    for (const [x, z] of [[-2, G.z + 2], [2, G.z - 3]]) table(kit, M, rng, x, G.y, z, { seats: 2, light: false });
  }

  // ---------------------------------------------------------- the Market: the plaza's stalls and tables, its lamps
  yield;
  {
    const { kit, M } = decks.market, P = PLAZA, Y = I0.market.y;
    // the stalls round the plaza: an awning on poles over a table, facing the middle
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2, x = P.x + Math.sin(a) * (P.r - 4), z = P.z + Math.cos(a) * (P.r - 4);
      if ((Math.abs(x) < 6 && Math.abs(z - P.z) > P.r - 8) || (Math.abs(z - P.z) < 6 && Math.abs(x) > 8)) continue;   // (the lanes through)
      const yaw = Math.atan2(P.x - x, P.z - z), c = Math.cos(yaw), s = Math.sin(yaw);
      table(kit, M, rng, x, Y, z, { yaw: yaw + Math.PI / 2, seats: 0, w: 2.6, light: i % 3 === 0 });
      awning(kit, M, rng, [x - c * 1.8 - s * 1.2, Y + 2.7, z + s * 1.8 - c * 1.2], [x + c * 1.8 - s * 1.2, Y + 2.7, z - s * 1.8 - c * 1.2], { out: 2.6, drop: 0.5, n: [s, c] });
    }
    // tables in the middle, people eating at them; the lamps
    for (const [x, z] of [[-9, -62], [9, -61.5], [-9, -80], [9, -79]]) table(kit, M, rng, x, Y, z, { yaw: rng() * 3, seats: 2 + Math.floor(rng() * 3), light: false });
    for (const [x, z] of [[-12, -58], [12, -60], [-12, -82], [12, -82]]) lantern(kit, M, x, Y, z, { kind: 'big', s: 1.1, r: 10 });
    for (let z = -40; z > -52; z -= 6) for (const e of [-1, 1]) lantern(kit, M, e * 4.6, Y, z, { kind: 'post', h: 2.8, r: 8, light: e > 0 });
    for (let z = -88; z > -104; z -= 7) for (const e of [-1, 1]) lantern(kit, M, e * 4.4, Y, z, { kind: 'post', h: 2.8, r: 8, light: e < 0 });
    poleCloth(kit, M, rng, [-16, Y, -60], [-10, Y, -54], { h: 3.6, sag: 1 });
    poleCloth(kit, M, rng, [14, Y, -84], [18, Y, -78], { h: 3.6, sag: 1 });
  }

  // ---------------------------------------------------------- the Towers, the Garden terrace
  yield;
  {
    const { kit, M } = decks.towers, T = I0.towers;
    for (const [x, z] of [[84, -82], [94, -84], [102, -84]]) lantern(kit, M, x, T.y, z + 3.4, { kind: 'post', h: 2.8, r: 8 });
    pipeStack(kit, M, rng, T.x + 16, T.y, T.z - 12, 26, { R: 1.2, n: 5 });
  }
  {
    const { kit, M } = decks.garden, G = I0.garden;
    // the trees, their benches, the overlook at the west edge
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2, r = 4 + rng() * 9, x = G.x - 6 + Math.cos(a) * r, z = G.z + Math.sin(a) * r;
      if (segDist(x, z, LANES.garden.lanes[0]) < 4.5) continue;
      crownTree(kit, M, rng, x, G.y, z, 1.4 + rng() * 1.2, { trunk: 2 + rng() * 1.5 });
    }
    for (const [x, z, a] of [[-104, -54, 1.6], [-104, -62, 1.5], [-96, -70, 0.2]]) kit.add(M.wood, new THREE.BoxGeometry(2, 0.45, 0.6).rotateY(a).translate(x, G.y + 0.45, z), { solid: true, shadow: true });
    for (const [x, z] of [[-88, -56], [-100, -66]]) lantern(kit, M, x, G.y, z, { kind: 'post', h: 2.8, r: 8 });
  }

  // ---------------------------------------------------------- the Balcony: its dark teal railing over the void, the tower of pipes
  yield;
  {
    const { kit, M } = decks.balcony, B = I0.balcony, pts = [];
    // the railing round the north edge (where the parapet is open), at the deck's edge
    const D = decks.balcony;
    for (let a = -0.75; a <= 0.751; a += 0.075) {
      // the edge along a ray from the island's middle toward the north, pulled in 0.4 m
      let lo = 0, hi = 40;
      for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (D.inside(B.x + Math.sin(a) * m, B.z - Math.cos(a) * m)) lo = m; else hi = m; }
      pts.push([B.x + Math.sin(a) * (lo - 0.4), B.y, B.z - Math.cos(a) * (lo - 0.4)]);
    }
    railing(kit, M, pts, { h: 1.15 });
    // (the tower of pipes runs on down through the island into the void: drawn only under the deck, solid over it)
    pipeStack(kit, M, rng, B.x + 15, B.y - 24, B.z - 12, 24, { R: 1.4, n: 6, solid: false });
    pipeStack(kit, M, rng, B.x + 15, B.y, B.z - 12, 26, { R: 1.4, n: 6 });
    pipeStack(kit, M, rng, B.x - 14, B.y, B.z - 14, 12, { R: 0.8, n: 4 });
    for (const x of [-6, 6]) lantern(kit, M, x, B.y, B.z - 14, { kind: 'big', s: 1, r: 9 });
    for (const [x, z, a] of [[-4, -174, 0], [4, -174, 0]]) kit.add(M.wood, new THREE.BoxGeometry(2.2, 0.45, 0.6).rotateY(a).translate(x, B.y + 0.45, z), { solid: true, shadow: true });
  }

  // ---------------------------------------------------------- the far islands: drawn only, no shadows (the city all round in the void)
  yield;
  const far = kitFor('the far islands', 71700), FM = spaceMats(far);
  const FAR = [
    [-70, 24, -300, 90, 54, 4], [80, 36, -330, 80, 50, 4], [0, 60, -470, 140, 70, 5], [-210, 10, -200, 70, 50, 4], [230, 16, -170, 70, 54, 4],
    [210, -46, 40, 60, 46, 3], [-220, -30, 60, 64, 46, 3], [-150, 40, -420, 80, 50, 4], [170, 70, -420, 70, 40, 4], [40, -70, -260, 60, 40, 3],
    [-60, -90, 200, 50, 40, 3], [120, 30, 230, 56, 40, 3],
  ];
  for (const [i, [x, y, z, w, d, peak]] of FAR.entries()) {
    yield;
    const I = island(far, FM, rng, { x, y, z, w, d, cr: Math.min(w, d) * 0.3, deep: 26, cables: 10, lights: 0, detail: 0.35, rim: 0, deck: false, seed: 900 + i });
    heap(far, FM, rng, I, { peak, mound: [(rng() - 0.5) * 0.6, -0.1], q: { n: Math.round((w * d) / 150), gap: 0, size: [7, 12], tall: [4.5, 7], detail: 0.3, domes: 0.2, trees: 0.25, awnings: 0, wash: 0, lit: 0.5, antenna: 0.1, light: false } });
  }
  for (const [a, b] of [[[-30, 24, -310], [40, 36, -322]], [[-40, 24, -322], [-10, 60, -436]], [[60, 36, -352], [40, 60, -436]], [[-180, 10, -210], [-110, 24, -296]], [[200, 16, -190], [118, 36, -318]], [[-120, 40, -404], [-70, 60, -452]]]) {
    bridge(far, FM, a, b, { w: 4, end: 8, mid: 1.5, seg: 10 });
  }

  // ---------------------------------------------------------- finishing
  yield;
  for (const k of kits) {
    k.finish();
    lights.push(...k.lights);
    noShadow.push(...k.noShadow);
    yield;
  }
  for (const m of far.group.children) { m.userData.noCollide = true; noShadow.push(m); }
  // (the trees are plants: walked through, like the rest of the flora; the audits pass them by)
  for (const k of kits) for (const m of k.group.children) if (m.material && spaceMats(k).crown.includes(m.material)) m.userData.flora = true;
  yield;

  const spawn = new THREE.Vector3(SHIP_SITE.x + 4, I0.pier.y + 0.05, SHIP_SITE.z - 18);
  return {
    id: 'spacecity',
    // no ground: only the islands' decks, the bridges and the houses (physics finds them as meshes)
    ground: { heightAt: () => -Infinity },
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 300,
    shipSite: { x: SHIP_SITE.x, z: SHIP_SITE.z, heading: Math.PI },   // (its ramp toward the bridge)
    features: { mount: false, wind: false, jetpack: false, climb: true },
    // (the morning: the sun low in the east, the planet two-thirds lit over the roofs to the north)
    // (the planet's dark side a dim mauve, a disc against the stars: post.js uSpaceNight)
    defaults: { hour: 8.5, preset: 'Moebius print', cloudShadows: 0, look: { ...SPACE_LOOK, uSpaceNight: [0.2, 0.17, 0.2, 1] } },
    sky: { script: SPACECITY_SCRIPT, planets: [PLANET] },
    killY: -Infinity,
    // fallen into the void: back where you last stood
    unsafe: (p) => p.y < UNSAFE_Y,
    lights,
    noShadow,
    reactions: false,   // (nothing grows out of the paving: reactive-world.js)
    bridges: BRIDGES,
    islands: decks,
    life: {
      // no birds in space: the dust that hangs in the light, a little of it glowing
      motes: { count: 140, color: '#ffe8c8', size: 0.04, glow: 0.6, rise: 0.01, wind: [0.02, 0.01] },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.6, name: 'The City Floating in Space', script: SPACECITY_KEYS }),
    crowdLines: CROWD_LINES,
    // The city's crowd (crowd.js): walkers over the bridges and along the lanes, people in twos and threes round the
    // plaza, others at the parapets looking out. Candidates only: the crowd keeps those on clear, walkable ground.
    crowdSpots() {
      const r = mulberry32(7151), V = (x, y, z) => new THREE.Vector3(x, y, z), groups = [], walks = [], edges = [];
      for (const B of BRIDGES) walks.push({ path: [V(...B.a), V(...B.b)], n: B.w > 6 ? 6 : 2, pair: 0.4 });
      walks.push({ path: [V(0, 0, 54), V(0, 0, 8)], n: 3, pair: 0.3 });
      walks.push({ path: [V(-34, 0, -67), V(34, 0, -73)], n: 4, pair: 0.3 });
      for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 5 + r() * (PLAZA.r - 7); groups.push({ at: V(PLAZA.x + Math.sin(a) * d, 0, PLAZA.z + Math.cos(a) * d), n: 2 + Math.floor(r() * 2.4) }); }
      for (const [x, z] of [[0, 34], [0, 24], [96, -84], [-98, -56], [0, -160]]) groups.push({ at: V(x, x > 50 ? 6 : x < -50 ? -4 : 0, z), n: 2 });
      for (let a = -0.7; a <= 0.7; a += 0.35) edges.push({ at: V(Math.sin(a) * 17, 0, I0.balcony.z - Math.cos(a) * 17), heading: Math.PI + a, pose: 'rail' });
      return { groups, walks, edges, avoid: [], farMax: 200, costume: 'spacecity', clear: [{ x: SHIP_SITE.x, z: SHIP_SITE.z, r: 16 }] };
    },
    update() {},
  };
}
export const createSpaceCity = stepped(buildSpaceCity);
