import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { MODE_TERRAIN } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { stairs } from './mangrove-kit.js';
import { PEOPLE as DESERT_PEOPLE } from '../story/desert-data.js';
import { RIM as INCAL_RIM, PEOPLE as INCAL_PEOPLE } from '../story/incal-data.js';
import { HESPER_AFTER } from '../story/fellow-data.js';
import {
  hull, portholes, houseStack, superstructure, cloth, gangway, rope, stake, stall, archDoor, herbs, stick,
  SALT_LOOK, SALT_DAY, SALT_TONES,
} from './salt-harbour-kit.js';

// ---------------------------------------------------------------------------
// The Salt Harbour: huge weathered ships standing on their keels in a vast dry white salt basin, made
// into apartment buildings (references/levels/The Salt Harbour/; its views in the References,
// reference-saltharbour.js; the shapes in salt-harbour-kit.js). A street runs north between their
// curved hulls, white over terracotta: shops cut into their feet, wooden houses built out from the
// plating, herbs on the ledges, sailcloth stretched across overhead, gangways joining the decks, long
// mooring ropes staked into the salt. At the street's end a ship stands on its stern. Off the route: no
// story to follow, a few people to meet.
//
// The layout: the ship lands on the open salt in the south; the street runs north from there between
// two rows of hulls (two each side, a cross-street between them to the flats), to the upright ship. A
// timber stair tower climbs the first western hull to its deck, where houses stand round its upper
// works, and a gangway crosses the street from it to the terracotta hull's deck. Ships lie further out
// on the flats, the salt ridged round one of them.
// ---------------------------------------------------------------------------

const T = SALT_TONES;
/** The ships, in the world: hull options (salt-harbour-kit.js hull) and where (x, z), which way the bow points (yaw: 0 north, π south), how deep in the salt. */
export const SHIPS = [
  // the street's west side (their starboard flank, side 1, toward the street)
  { id: 'w1', x: -46, z: -40, yaw: Math.PI, L: 150, B: 52, D: 46, sink: 5, n: 2.4, tumble: 0.14, top: 14, rise: [0.3, 0.55] },
  { id: 'w2', x: -44, z: -215, yaw: Math.PI + 0.05, L: 140, B: 50, D: 56, sink: 6, n: 2.4, tumble: 0.16, band: 16, rise: [0.3, 0.6] },
  // the east side (side 1 toward the street too)
  { id: 'e1', x: 50, z: -66, yaw: 0.04, L: 160, B: 58, D: 52, sink: 5, n: 2.1, tumble: 0.24, red: true, top: 10, rise: [0.3, 0.6] },
  { id: 'e2', x: 46, z: -235, yaw: -0.05, L: 140, B: 50, D: 58, sink: 6, n: 2.4, tumble: 0.18, top: 20, rise: [0.3, 0.6] },
  // the street's end: a ship stood on its stern
  { id: 'up', x: 4, z: -372, yaw: 0.35 + Math.PI, L: 110, B: 34, D: 30, sink: 5, upright: true, band: 4 },
  // out on the flats
  { id: 'f1', x: 230, z: -60, yaw: 1.2, L: 130, B: 44, D: 50, sink: 8, n: 2.2, tumble: 0.2, band: 18 },
  { id: 'f2', x: -240, z: -120, yaw: -1.9, L: 120, B: 40, D: 46, sink: 8, n: 2.2, tumble: 0.18, top: 16 },
  { id: 'f3', x: 190, z: -330, yaw: 0.6, L: 120, B: 40, D: 48, sink: 14, n: 2.2, tumble: 0.2, red: true, top: 10 },
  { id: 'f4', x: -200, z: -330, yaw: 2.6, L: 100, B: 36, D: 40, sink: 6, upright: true, band: 4 },
  { id: 'f5', x: 160, z: 120, yaw: -0.7, L: 110, B: 38, D: 42, sink: 10, n: 2.2, tumble: 0.2, band: 14 },
];
const SHIP = Object.fromEntries(SHIPS.map((s) => [s.id, s]));
export const SHIP_SITE = { x: 0, z: 92 };
/** The stair tower up the first western hull to its deck: its foot on the street, its top at the deck's rail. */
export const TOWER = { x: -16.5, z: -40, flight: 3.6, run: 6.2, w: 1.8 };   // (w1's flank bulges to x -18.6 at its middle)

const noise = createNoise2D(52101), noiseB = createNoise2D(52102);
/** A ship's footprint on the salt: the ellipse of its hull where the salt meets it (in its own frame), and the way to it. */
function footprint(S) {
  const c = Math.cos(S.yaw), s = Math.sin(S.yaw);
  if (S.upright) return { a: S.B * 0.45, b: S.D * 0.55, c, s, S };
  // (the hull's half-width where the salt cuts it, a little in from its widest)
  const k = Math.min(1, S.sink / S.D * 3.2);
  return { a: S.L * 0.47, b: (S.B / 2) * (0.35 + 0.55 * k), c, s, S };
}
const FEET = SHIPS.map(footprint);
/** The salt: a flat white basin, barely rolling; salt banked up each hull's foot, ridges round one far ship, the basin's rim far out. */
function height(x, z) {
  let h = 0.18 * fbm(noise, x * 0.012, z * 0.012, 2) + 0.05 * noiseB(x * 0.11, z * 0.11);
  for (const F of FEET) {
    const dx = x - F.S.x, dz = z - F.S.z, u = dx * F.s + dz * F.c, v = dx * F.c - dz * F.s;   // (along the ship, across it)
    const e = Math.hypot(u / F.a, v / F.b);
    if (e > 3) continue;
    // a bank of salt up its plating: highest at the hull, out a few metres
    const out = (e - 1) * Math.min(F.a, F.b);
    h += (F.S.upright ? 3.5 : 4.2) * Math.exp(-Math.max(0, out) / 5) * smoothstep(-6, 0, out) - (out < -6 ? 0 : 0);
  }
  // the rounded ridges in the crust round the far ship f3 (the pictures' "something under the salt")
  const d3 = Math.hypot(x - SHIP.f3.x, z - SHIP.f3.z);
  h += 2.4 * Math.max(0, Math.sin(d3 * 0.11)) * Math.exp(-((d3 - 70) ** 2) / 1800);
  // the basin's rim, far out
  const r = Math.hypot(x, z + 120);
  h += smoothstep(440, 520, r) * (6 + fbm(noiseB, x * 0.006, z * 0.006, 3) * 4) + smoothstep(520, 640, r) * 24;
  return h;
}

/** Points along the street (the middle), where the traveller walks. */
export const STREET = { x: 0, z0: 50, z1: -330, w: 30 };

export const SALT_CONTENT = {
  weather: [],
  // no story to follow: the page names the place and closes on the terracotta hull's deck
  story: {
    title: 'THE SALT HARBOUR',
    intro: 'Ships stand in the dry salt, and people live in them. The street runs north between their hulls. The stair on the first hull goes up to its deck.',
    outro: 'From the deck of the terracotta hull the whole harbour shows: the street of ships, the sailcloth over it, the ship stood on its stern, and the salt going on white to the edge of the sky.',
    label: 'the terracotta hull’s deck', goal: [SHIP.e1.x - 17, SHIP.e1.D - SHIP.e1.sink, SHIP.e1.z - 13], radius: 8, verticalRadius: 4, manual: true,   // (no beacon: nothing to do here but look)
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere who came to the harbour, and its own folk in the street and up on the decks
  npcs: [
    { ...DESERT_PEOPLE.marrow, at: [8, 62], radius: 2, world: 'desert', lang: 'desert',
      lines: ['~shout~ Sky-person! A whole street of hulls, and not one of them for sale!', '~playful~ I came to salvage. They invited me to dinner instead. Suspicious.'],
      talk: { listen: [
        '~happy~ Marrow, salvager, at your service, as ever. I heard there was a harbour with no sea. I had to see the ships nobody can sail.',
        '~curious~ They ran aground on nothing. The water went and the salt came up round them. Now they’re streets.',
        '~playful~ I offered to buy a porthole. They offered me the whole cabin behind it. For rent. I had no answer.',
        '~whisper~ Up the stair on the first hull, the decks join across the street. Mind the gangway. It sways when it laughs.',
        { after: 'met.marrow', say: '~neutral~ Still here? The street runs north to the one that stands on its tail. Go and look up at it.' },
      ] } },
    { ...INCAL_RIM.corvin, at: [SHIP.e1.x - 16, SHIP.e1.z - 8], y: SHIP.e1.D - SHIP.e1.sink - 0.3, radius: 1.5, kind: 'm', world: 'incal', lang: 'incal',
      lines: ['~playful~ An address with a view of the sky on every side. They don’t even charge for it.', '~neutral~ Mind the rail. The salt is a long way down.'],
      talk: { listen: [
        '~neutral~ Corvin Sale. Of the rim. On holiday, if anybody asks, which they don’t.',
        '~curious~ At home the expensive addresses are at the top. Here every deck is a top. It confuses me.',
        '~playful~ The neighbours across the street come over the gangway to borrow salt. Out of politeness, I assume.',
        '~solemn~ I looked down at the street from here and it looked back up. Nobody does that in the shaft.',
      ] } },
    { ...INCAL_PEOPLE.pip, at: [SHIP.up.x + 8, SHIP.up.z + 30], radius: 1.5, world: 'incal', lang: 'incal',
      lines: ['~surprised~ It goes all the way up! Like the shaft, but outside!', '~happy~ The sky here doesn’t stop anywhere.'],
      talk: { listen: [
        '~happy~ Pip. From the bottom of the shaft. I saw the sky once, and then I came to see all of it.',
        '~curious~ This ship stands up like a tower. They say it got tired of lying down.',
        '~playful~ I counted the ropes on the big red one. Then I lost count, and started again, and lost it again.',
      ] } },
    // the harbour's own folk
    // (Hesper and the harbour book: the detour's trace, src/story/sightings-detours.js)
    { id: 'hesper', name: 'Hesper', title: 'who keeps the harbour book', color: '#c98a5a', kind: 'f', at: [-9, -10], radius: 3, lang: 'desert',
      lines: ['~happy~ Morning. The awnings are up.', '~neutral~ The street runs north to the standing ship. Everything else is salt.'],
      talk: { listen: [
        { after: () => true, say: [
          '~curious~ Everyone signs the harbour book. The one before you came alone, a woman. She wrote in letters none of us read.',
          '~solemn~ (Home letters: your own. The salt has eaten most of the line: *…where the singing goes. If anyone from home…* Where the name was, the page is white.)',
        ], do: { set: { 'sight.saltharbour.book': true } } },
        '~happy~ Morning. The awnings are up.',
        '~neutral~ The street runs north to the standing ship. Everything else is salt.',
        '~playful~ Sign the book before you go. The salt gets to every page in the end, but it takes its time.',
        // (her niece Tansy, the fellow traveller: her letter carried home, or Tansy home herself; src/story/fellow-data.js)
        ...HESPER_AFTER,
      ] } },
    { at: [9, -60], radius: 3, lang: 'desert', lines: ['~curious~ You came by the sky? We came by sea, a long time ago. The sea left first.', '~playful~ Don’t pull the ropes. The ship pulls back.'] },
    { at: [-8, -150], radius: 3, lang: 'desert', lines: ['~neutral~ The cross-street goes out to the flats. Take water.', '~whisper~ Out past the red ship the crust has ridges. Something under it, they say. Nobody digs.'] },
    { at: [TOWER.x + 3, TOWER.z - 6], radius: 2, lang: 'desert', lines: ['~tired~ Ninety steps to the deck. I count them every morning.', '~happy~ Up top you can see three ships further than from down here.'] },
    { at: [SHIP.w1.x + 19, SHIP.w1.z - 18], y: SHIP.w1.D - SHIP.w1.sink - 0.3, radius: 3, lang: 'desert', lines: ['~solemn~ My grandmother’s grandmother steered this ship. Now we grow basil on it.', '~neutral~ The gangway crosses to the red hull. Walk in the middle.'] },
    { at: [5, -300], radius: 3, lang: 'desert', lines: ['~curious~ The standing ship? It was like that when the salt came. Nobody climbs it.', '~playful~ We hang the washing off its keel. It dries in an hour.'] },
  ],
};

/** What the harbour's crowd says (crowd.js), toned. */
export const CROWD_LINES = [
  '~neutral~ The awnings come down at dusk. The hulls keep the heat all night.',
  '~playful~ Mind the ropes. They’ve been holding these ships still since before the salt.',
  '~curious~ A sky-ship? It looks very small next to ours.',
  '~happy~ Basil, mint, salt-thyme! Grown on the deck, sold at the keel!',
  '~whisper~ They say one of the ships out on the flats is still sinking. Very slowly. Into the salt.',
  '~tired~ Ninety steps up the tower, every morning. Good for the legs.',
];

/** The level's colours: a deep clear noon over the salt, a rose and terracotta dusk, an indigo night. */
export const SALT_SKY = {
  day: SALT_DAY,
  dusk: ['#46589a', '#f0b890', '#9a8ab8', '#ffe2c8', '#ffc890'],
  night: ['#0d1430', '#22325a', '#3a4878', '#c8d0f0', '#f0e8e0'],
};

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildSaltHarbour(scene) {
  const rng = mulberry32(52100);
  const terrain = yield* Terrain.make({
    size: 1200, seg: 200, height,   // (6 m: the salt is flat, the banks against the hulls wide)
    material: { color: T.salt, color2: T.salt2, color3: T.salt3, mode: MODE_TERRAIN, pattern: 'cracks', sandInk: true, shadeHue: -1 },   // (the world's cerulean shade, not sand's warm grey)
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'The Salt Harbour';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 52100 });
  const DS = THREE.DoubleSide;
  const M = {
    hull: kit.mat({ color: T.hull, plates: 9, hatch: 0.25, shade: 0.15 }),
    hull2: kit.mat({ color: T.hull2, plates: 10, hatch: 0.25, shade: 0.15 }),
    red: kit.mat({ color: T.red, plates: 9, hatch: 0.25, shade: 0.1, shadeHue: 1 }),   // (its shade a deep rust, as the pictures')
    deck: kit.mat({ color: T.deck, flat: true, pattern: 'cracks' }),
    wood: kit.mat({ color: T.wood, flat: true, pattern: 'cracks' }),
    wood2: kit.mat({ color: T.wood2, flat: true }),
    woodDark: kit.mat({ color: T.woodDark, flat: true }),
    plaster: kit.mat({ color: T.plaster, flat: true, weathered: 0.4 }),
    dark: kit.mat({ color: T.dark, flat: true }),
    glow: kit.mat({ color: T.glow, glow: 0.9, flat: true }),
    cloth: kit.mat({ color: T.cloth, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    cloth2: kit.mat({ color: T.cloth2, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    rope: kit.mat({ color: T.rope, flat: true }),
    iron: kit.mat({ color: T.iron, flat: true }),
    pot: kit.mat({ color: T.pot, flat: true }),
    leaves: kit.mat({ color: T.leaves, pattern: 'leaves', hatch: 0.6, shade: 0.4, line: 0.7, lineTint: 0.7 }),
    goods: T.goods.map((c) => kit.mat({ color: c, flat: true })),
  };
  const lights = [];
  const lamp = (x, y, z, r = 6) => lights.push(new THREE.Vector4(x, y, z, r));
  const SOLID = { solid: true, shadow: true }, LOOSE = { solid: false, shadow: false }, FLAT = { solid: true, shadow: false };
  const add = (m, g, o = SOLID) => kit.add(m, g, o);
  const turn = (g, yaw, x, y, z) => g.rotateY(yaw).translate(x, y, z);

  // ---------------------------------------------------------- the ships (solid as drawn: you walk round their feet, climb their houses, cross their decks)
  const ships = {};
  const placeShip = (S) => {
    const far = S.id.startsWith('f'), yaw = S.yaw + Math.PI, Hh = hull({ ...S, detail: far ? 0.45 : 0.7 }), c = Math.cos(yaw), s = Math.sin(yaw);
    const put = (p) => new THREE.Vector3(S.x + p.x * c + p.z * s, p.y - S.sink, S.z - p.x * s + p.z * c);
    const dir = (n) => new THREE.Vector3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
    const on = (t, y, side = 1) => { const a = Hh.at(t, y + S.sink); if (side < 0) { a.p.x = -a.p.x; a.n.x = -a.n.x; } return { p: put(a.p), n: dir(a.n) }; };
    const white = S.red ? M.red : far ? M.hull2 : M.hull, red = S.red ? M.hull : M.red;
    for (const g of Hh.white) add(white, turn(g, yaw, S.x, -S.sink, S.z));
    for (const g of Hh.red) add(red, turn(g, yaw, S.x, -S.sink, S.z));
    // the deck (a little under the gunwale: the bulwark a lip you step over)
    // (an upright ship's deck stands as a wall, turned away from the street: plated like its hull)
    for (const g of Hh.deck) add(S.upright ? white : M.deck, turn(g.translate(0, 0.25, 0), yaw, S.x, -S.sink, S.z), FLAT);
    const P = portholes(Hh, { rows: S.upright ? [S.D * 0.4, S.D * 0.75] : [S.D * 0.52, S.D * 0.66, S.D * 0.8], step: far ? 11 : 8, r: 0.7, seed: S.x + S.z, lit: 0.12, t0: 0.08, t1: 0.92 });
    for (const g of P.dark) add(M.dark, turn(g, yaw, S.x, -S.sink, S.z), LOOSE);
    for (const g of P.glow) add(M.glow, turn(g, yaw, S.x, -S.sink, S.z), LOOSE);
    if (!far) for (const g of P.rim) add(M.iron, turn(g, yaw, S.x, -S.sink, S.z), LOOSE);
    ships[S.id] = { S, H: Hh, put, on, yaw, deckY: S.D - S.sink - 0.35 };
    return ships[S.id];
  };
  for (const S of SHIPS) { yield; placeShip(S); }

  // ---------------------------------------------------------- what is built onto them along the street
  /** A stack of houses out from a ship's flank (side 1) at t, its foot on the salt: the cabins solid, their balconies stood on. */
  const stackOn = (sh, t, { w = 14, floors = 5, y0 = 0, seed = 1, depth = [2, 4] } = {}) => {
    // (its wall where the plating is widest over the stack's storeys, so no cabin is swallowed by the bulge)
    let best = null;
    for (let y = y0 + 1; y < y0 + floors * 3.4; y += 2) { const a = sh.on(t, y); const d = a.p.x * a.n.x + a.p.z * a.n.z; if (!best || d > best.d) best = { ...a, d }; }
    const a = Math.atan2(best.n.x, best.n.z), base = sh.on(t, y0 + 0.5).p, foot = H(base.x, base.z);
    const S = houseStack({ x0: -w / 2, x1: w / 2, y0: 0, floors, fh: 3.4, depth, seed, lit: 0.15, detail: 0.7 });
    // (its back pushed into the plating, its foot on the salt bank)
    const at = (g) => g.translate(0, 0, -1.2).rotateY(a).translate(best.p.x, foot + y0, best.p.z);
    for (const [k, m, o] of [['wood', M.wood, SOLID], ['plaster', M.plaster, SOLID], ['dark', M.dark, LOOSE], ['glow', M.glow, LOOSE], ['cloth', M.cloth, LOOSE], ['pot', M.pot, SOLID], ['leaves', M.leaves, LOOSE]]) for (const g of S[k]) add(m, at(g), o);
    for (const d of S.decks) if (rng() < 0.4) { const p = new THREE.Vector3((d.x0 + d.x1) / 2, d.y + 1.6, d.z - 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), a); lamp(best.p.x + p.x, foot + y0 + p.y, best.p.z + p.z, 6); }
  };
  /** A shop at a ship's foot (side 1), its awning out over the street; a lantern by it. */
  const shopOn = (sh, t, { w = 4.5, seed = 1 } = {}) => {
    const { p, n } = sh.on(t, 1.2), a = Math.atan2(n.x, n.z), y = H(p.x + n.x * 2, p.z + n.z * 2);
    const S = stall({ w, seed, goods: M.goods.length, deep: 3.4 });
    const at = (g) => turn(g, a, p.x - n.x * 0.4, y - 0.05, p.z - n.z * 0.4);
    for (const g of S.wood) add(M.wood2, at(g));
    for (const g of S.cloth) add(M.cloth, at(g), FLAT);
    for (const [k, list] of S.goods.entries()) for (const g of list) add(M.goods[k], at(g), FLAT);
    lamp(p.x + n.x * 3, y + 2.6, p.z + n.z * 3, 6);
    kit.add(M.glow, new THREE.SphereGeometry(0.16, 8, 6).translate(p.x + n.x * 2.6, y + 2.4, p.z + n.z * 2.6), LOOSE);
  };
  /** An arched door at a ship's foot (side 1). */
  const doorOn = (sh, t, { w = 3.4, h = 5.2, lit = false } = {}) => {
    const { p, n } = sh.on(t, 0.6), nn = new THREE.Vector3(n.x, 0, n.z).normalize(), D = archDoor(p.x, H(p.x, p.z) - 0.3, p.z, nn, { w, h, lit });
    for (const g of D.dark) add(M.dark, g, LOOSE); for (const g of D.glow) add(M.glow, g, LOOSE); for (const g of D.wood) add(M.woodDark, g);
    lamp(p.x + nn.x * 2, H(p.x, p.z) + 3, p.z + nn.z * 2, 7);
  };
  /** A ledge of herbs at a porthole (side 1), y over the salt. */
  const herbsOn = (sh, t, y, w = 2.2) => {
    const { p, n } = sh.on(t, y), a = Math.atan2(n.x, n.z), Hb = herbs(0, 0.12, 0.45, 0, { w, seed: t * 97 + y, detail: 0.7 });
    const at = (g) => g.rotateY(a).translate(p.x, p.y, p.z);
    add(M.woodDark, at(new THREE.BoxGeometry(w + 0.4, 0.14, 1.1).translate(0, 0.05, 0.35)));
    for (const g of Hb.pot) add(M.pot, at(g)); for (const g of Hb.leaves) add(M.leaves, at(g), LOOSE);
  };
  /** Mooring ropes from a ship's flank down to stakes in the salt, out toward `out` [dx, dz]. */
  const moor = (sh, { n, t0, t1, y0, y1, out, side = 1 }) => {
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * (i + rng() * 0.6) / n, a = sh.on(t, y0 + (y1 - y0) * rng(), side).p, f = sh.on(t, 1, side).p;
      const bx = f.x + out[0] * (0.6 + rng() * 0.8), bz = f.z + out[1] * (0.6 + rng() * 0.8), by = H(bx, bz);
      add(M.rope, rope([a.x, a.y, a.z], [bx, by + 0.3, bz], { sag: 0.4, r: 0.06 }), LOOSE);
      for (const g of stake(bx, by, bz, { az: Math.atan2(a.z - bz, a.x - bx), h: 0.6, lean: 0.2 })) add(M.woodDark, g);
    }
  };
  yield;
  const W1 = ships.w1, W2 = ships.w2, E1 = ships.e1, E2 = ships.e2;
  // the west side: houses stacked out of w1's flank, shops under them, a door; w2 the same further up
  // (the stair tower stands at w1's middle, t 0.46 … 0.54: the houses and shops either side of it)
  for (const [t, f] of [[0.24, 6], [0.35, 8], [0.64, 7], [0.75, 5]]) { yield; stackOn(W1, t, { w: 13, floors: f, y0: 4, seed: t * 31 }); }
  for (const t of [0.2, 0.3, 0.4, 0.6, 0.7]) shopOn(W1, t, { seed: t * 13 });
  doorOn(W1, 0.78, { lit: true }); doorOn(W1, 0.12);
  for (const [t, y] of [[0.74, 12], [0.8, 14], [0.17, 13]]) herbsOn(W1, t, y);
  yield;
  for (const [t, f] of [[0.3, 6], [0.44, 7], [0.58, 5]]) { yield; stackOn(W2, t, { w: 12, floors: f, y0: 4, seed: t * 37 + 3 }); }
  for (const t of [0.26, 0.37, 0.5, 0.64]) shopOn(W2, t, { seed: t * 17 + 2 });
  doorOn(W2, 0.72, { lit: true });
  // the east side: e1's terracotta flank, its ropes fanned to the street; e2 with its houses
  yield;
  for (const t of [0.3, 0.4, 0.5]) shopOn(E1, t, { seed: t * 19 + 5 });
  doorOn(E1, 0.58, { lit: true }); doorOn(E1, 0.2);
  for (const [t, y] of [[0.34, 13], [0.45, 14], [0.26, 16]]) herbsOn(E1, t, y);
  moor(E1, { n: 14, t0: 0.66, t1: 0.86, y0: 14, y1: 38, out: [-9, 3] });
  yield;
  for (const [t, f] of [[0.35, 7], [0.5, 6]]) { yield; stackOn(E2, t, { w: 13, floors: f, y0: 4, seed: t * 41 + 7 }); }
  for (const t of [0.28, 0.42, 0.58, 0.66]) shopOn(E2, t, { seed: t * 23 + 1 });
  doorOn(E2, 0.74, { lit: true });
  moor(W2, { n: 8, t0: 0.8, t1: 0.95, y0: 12, y1: 30, out: [8, 2] });
  moor(E2, { n: 8, t0: 0.12, t1: 0.25, y0: 12, y1: 30, out: [-8, -2] });
  // the upright ship's ropes, all round it, and the far ships' (fewer, longer)
  yield;
  { const U = ships.up; for (const side of [1, -1]) moor(U, { n: 6, t0: 0.3, t1: 0.7, y0: 20, y1: 50, out: [side * 10, 6], side }); }
  for (const id of ['f1', 'f3', 'f5']) moor(ships[id], { n: 6, t0: 0.3, t1: 0.7, y0: 10, y1: 26, out: [0, 0].map(() => (rng() - 0.5) * 24) });

  // ---------------------------------------------------------- up on the decks: houses round the upper works, railings; the gangways between
  yield;
  /** Upper works on a ship's deck at t (along it), w across, d along. */
  const supOn = (sh, t, o) => {
    const p = sh.put(new THREE.Vector3(0, sh.S.D - 0.35, (t * 2 - 1) * (sh.H.L / 2)));
    const S = superstructure({ x: 0, y: 0, z: 0, seed: sh.S.x + t, red: 0.35, ...o });
    const white = sh.S.red ? M.red : M.hull, red = sh.S.red ? M.hull : M.red, at = (g) => g.rotateY(sh.yaw).translate(p.x, p.y, p.z);
    for (const g of S.white) add(white, at(g)); for (const g of S.red) add(red, at(g));
    for (const g of S.dark) add(M.dark, at(g), LOOSE); for (const g of S.glow) add(M.glow, at(g), LOOSE); for (const g of S.rail) add(M.iron, at(g));
  };
  supOn(W1, 0.42, { w: 20, d: 34, tiers: 3 }); supOn(W1, 0.78, { w: 14, d: 16, tiers: 2, mast: false });
  supOn(E1, 0.35, { w: 22, d: 30, tiers: 3 }); supOn(E1, 0.75, { w: 14, d: 18, tiers: 2, mast: false });
  supOn(W2, 0.5, { w: 20, d: 30, tiers: 4 }); supOn(E2, 0.55, { w: 20, d: 32, tiers: 4 });
  for (const id of ['f1', 'f2', 'f3', 'f5']) supOn(ships[id], 0.5, { w: ships[id].S.B * 0.45, d: 24, tiers: 3 });
  // houses on w1's deck, round its upper works (the deck's own street), herbs and washing
  yield;
  {
    const sh = W1, y = sh.deckY;
    for (const [u, t, yaw] of [[-1, 0.3, Math.PI / 2], [1, 0.3, -Math.PI / 2], [-1, 0.6, Math.PI / 2], [1, 0.62, -Math.PI / 2]]) {
      const p = sh.put(new THREE.Vector3(u * sh.S.B * 0.3, sh.S.D - 0.35, (t * 2 - 1) * (sh.H.L / 2)));
      const S = houseStack({ x0: -6, x1: 6, y0: 0, floors: 2, fh: 3.2, depth: [2, 3], seed: t * 7 + u, lit: 0.2, detail: 0.7 });
      const at = (g) => g.rotateY(sh.yaw + yaw).translate(p.x, y + 0.02, p.z);
      for (const [k, m, o] of [['wood', M.wood, SOLID], ['plaster', M.plaster, SOLID], ['dark', M.dark, LOOSE], ['glow', M.glow, LOOSE], ['cloth', M.cloth, LOOSE], ['pot', M.pot, SOLID], ['leaves', M.leaves, LOOSE]]) for (const g of S[k]) add(m, at(g), o);
    }
  }
  // the deck's rails along the gunwales of the walked decks (w1, e1): posts and a top rail, solid (you lean on them)
  for (const sh of [W1, E1]) {
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 30; i++) { const t = 0.08 + (i / 30) * 0.84, z = (t * 2 - 1) * (sh.H.L / 2), x = side * sh.H.halfB(t) * 0.97 * (1 - (sh.S.tumble ?? 0) * 0.98); pts.push(sh.put(new THREE.Vector3(x, sh.S.D, z))); }
      for (let i = 0; i < pts.length; i++) { if (i % 2 === 0) add(M.iron, new THREE.BoxGeometry(0.1, 1.05, 0.1).translate(pts[i].x, pts[i].y + 0.5, pts[i].z)); }
      add(M.iron, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(new THREE.Vector3(0, 1.05, 0)))), 60, 0.06, 4, false));
    }
  }
  // the gangways: one walked, from w1's deck across the street to e1's (its ends over the gunwales), and others overhead, drawn
  yield;
  const edge = (sh, t, side) => { const z = (t * 2 - 1) * (sh.H.L / 2), x = side * sh.H.halfB(t) * (1 - (sh.S.tumble ?? 0) * 0.98); return sh.put(new THREE.Vector3(x, sh.S.D + 0.05, z)); };
  const WALKED = [edge(W1, 0.2, 1), edge(E1, 0.58, 1)];
  {
    // (from inside one gunwale to inside the other: its first and last planks lie over the decks)
    const A = WALKED[0].clone().add(new THREE.Vector3(-3, 0, 0)), B = WALKED[1].clone().add(new THREE.Vector3(3, 0, 0));
    const G = gangway([A.x, A.y, A.z], [B.x, B.y, B.z], { w: 3, sag: 0.6, truss: 2 });
    for (const g of G.deck) add(M.wood, g); for (const g of G.wood) add(M.woodDark, g); for (const g of G.dark) add(M.woodDark, g, LOOSE);
    for (let i = 1; i < 6; i++) { const p = A.clone().lerp(B, i / 6); lamp(p.x, p.y + 2, p.z, 7); }
  }
  for (const [a, b] of [[edge(W1, 0.62, 1), edge(E1, 0.2, 1)], [edge(W2, 0.62, 1), edge(E2, 0.4, 1)]]) {
    const G = gangway([a.x, a.y, a.z], [b.x, b.y, b.z], { w: 2.6, sag: 1, truss: 1.6 });
    for (const g of G.deck) add(M.wood, g); for (const g of G.wood) add(M.woodDark, g); for (const g of G.dark) add(M.woodDark, g, LOOSE);
  }

  // ---------------------------------------------------------- the stair tower up w1's flank to its deck
  yield;
  {
    // switchback flights against the hull, a landing at each turn, posts down to the salt; its top a bridge over the gunwale
    const top = W1.deckY + 0.35, foot = H(TOWER.x, TOWER.z), n = Math.ceil((top - foot) / TOWER.flight), { x, z, run, w } = TOWER;
    let y = foot;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, y1 = Math.min(top, y + TOWER.flight);
      const z0 = z + (dir > 0 ? -run / 2 : run / 2), z1 = z - (dir > 0 ? -run / 2 : run / 2), sx = x + (i % 2 ? 0 : 0);
      const S = stairs([sx, y, z0], [sx, y1, z1], { w, rise: 0.22 });
      for (const g of S.planks) add(M.wood, g); for (const g of S.wood) add(M.woodDark, g);
      // the landing at its top
      add(M.wood, new THREE.BoxGeometry(w + 0.4, 0.16, 2.4).translate(sx, y1 - 0.08, z1 + dir * 1.2));
      y = y1;
    }
    for (const [dx, dz] of [[-w / 2 - 0.2, -run / 2 - 2.4], [w / 2 + 0.2, -run / 2 - 2.4], [-w / 2 - 0.2, run / 2 + 2.4], [w / 2 + 0.2, run / 2 + 2.4]]) add(M.woodDark, stick(new THREE.Vector3(x + dx, foot - 0.5, z + dz), new THREE.Vector3(x + dx, top + 1, z + dz), 0.16));
    for (let yy = foot + 4; yy < top; yy += 4) add(M.woodDark, new THREE.BoxGeometry(0.12, 0.12, run + 5).translate(x - w / 2 - 0.2, yy, z));
    // the bridge from the top landing over the gunwale onto the deck
    const ez = n % 2 ? z - run / 2 - 1.2 : z + run / 2 + 1.2, inner = edge(W1, 0.5 + (ez - W1.S.z) / W1.H.L, 1);
    const G = gangway([x, top, ez], [inner.x - 4, top, ez], { w: 2, sag: 0, truss: 0.6 });
    for (const g of G.deck) add(M.wood, g); for (const g of G.wood) add(M.woodDark, g); for (const g of G.dark) add(M.woodDark, g, LOOSE);
    TOWER.top = top; TOWER.flights = n; TOWER.exit = ez;
    lamp(x, foot + 3, z, 7); lamp(x, top + 2, ez, 7);
  }

  // ---------------------------------------------------------- the sailcloth over the street
  yield;
  {
    const across = [[-12, 26, 18], [-38, 30, 14], [-70, 22, 20], [-104, 34, 16], [-180, 28, 18], [-212, 24, 14], [-250, 32, 18], [-282, 26, 12]];
    for (const [k, [z, y, d]] of across.entries()) {
      const xw = -17 - rng() * 4, xe = 17 + rng() * 4, y2 = y + (rng() - 0.5) * 4;
      add(k % 2 ? M.cloth2 : M.cloth, cloth([xw, y, z - d / 2], [xw, y + 2, z + d / 2], [xe, y2 + 2, z + d / 2], [xe, y2, z - d / 2], { sag: 4.5 + rng() * 3, folds: 3, fold: 1.4, droop: 3, seed: k + 1, nu: 18, nv: 9 }), { solid: false, shadow: true });
      // its ties to the hulls
      for (const [x0, x1] of [[xw, xw - 3], [xe, xe + 3]]) add(M.rope, stick(new THREE.Vector3(x0, y + 1, z), new THREE.Vector3(x1, y + 4, z), 0.04), LOOSE);
    }
  }

  // ---------------------------------------------------------- the decks' clutter: crates, planters, washing on lines
  yield;
  for (const sh of [W1, E1]) {
    for (let i = 0; i < 26; i++) {
      const t = 0.12 + rng() * 0.76, u = (rng() - 0.5) * 1.3, z = (t * 2 - 1) * (sh.H.L / 2), x = u * sh.H.halfB(t) * (1 - (sh.S.tumble ?? 0));
      const p = sh.put(new THREE.Vector3(x, sh.S.D - 0.35, z));
      // (clear of the upper works, the deck houses and the gangways' landings: those stand at the deck's middle and its ends)
      if (Math.abs(u) < 0.5 || [...WALKED, ...(TOWER.exit ? [new THREE.Vector3(TOWER.x - 6, 0, TOWER.exit)] : [])].some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 7)) continue;
      if (rng() < 0.5) { const s = 0.7 + rng() * 0.5; add(M.wood2, new THREE.BoxGeometry(s, s * 0.8, s).rotateY(rng() * 3).translate(p.x, p.y + s * 0.4, p.z)); }
      else { const Hb = herbs(p.x, p.y, p.z, rng() * 3, { w: 1.4 + rng(), seed: i + sh.S.x, detail: 0.7 }); for (const g of Hb.pot) add(M.pot, g); for (const g of Hb.leaves) add(M.leaves, g, LOOSE); }
    }
    // washing on lines between posts along the deck
    for (let k = 0; k < 3; k++) {
      const t = 0.15 + k * 0.28 + rng() * 0.05, z = (t * 2 - 1) * (sh.H.L / 2), side = k % 2 ? 1 : -1, x = side * sh.H.halfB(t) * (1 - (sh.S.tumble ?? 0)) * 0.6;
      const a = sh.put(new THREE.Vector3(x, sh.S.D - 0.35, z - 5)), b = sh.put(new THREE.Vector3(x, sh.S.D - 0.35, z + 5));
      for (const q of [a, b]) add(M.woodDark, new THREE.BoxGeometry(0.12, 2.6, 0.12).translate(q.x, q.y + 1.3, q.z));
      add(M.rope, stick(a.clone().setY(a.y + 2.4), b.clone().setY(b.y + 2.4), 0.02), LOOSE);
      for (let i = 0; i < 6; i++) { const q = a.clone().lerp(b, 0.12 + i * 0.15), s = 0.5 + rng() * 0.4; add(rng() < 0.5 ? M.cloth : M.goods[Math.floor(rng() * 5)], new THREE.PlaneGeometry(s, s * 1.3).rotateY(sh.yaw + Math.PI / 2).translate(q.x, q.y + 2.3 - s * 0.65, q.z), LOOSE); }
    }
  }

  // ---------------------------------------------------------- the landing: stakes and coiled ropes, a few crates by the ship
  yield;
  for (let i = 0; i < 10; i++) {
    const x = (rng() - 0.5) * 50, z = SHIP_SITE.z - 30 + rng() * 40;
    if (Math.hypot(x - SHIP_SITE.x, z - SHIP_SITE.z) < 16) continue;
    const s = 0.6 + rng() * 0.5;
    add(M.wood2, new THREE.BoxGeometry(s, s * 0.8, s).rotateY(rng() * 3).translate(x, H(x, z) + s * 0.4 - 0.05, z));
  }

  yield;
  kit.finish();
  // (the herbs are plants: walked through, like the rest of the flora; the audits pass them by)
  for (const o of group.children) if (o.material === M.leaves) o.userData.flora = true;
  lights.push(...kit.lights);
  yield;

  const spawn = new THREE.Vector3(SHIP_SITE.x + 4, H(SHIP_SITE.x + 4, SHIP_SITE.z - 16) + 0.05, SHIP_SITE.z - 16);
  return {
    id: 'saltharbour',
    ground: terrain,
    // (the hulls are long curved shells and the houses many small boxes: a BVH split by area, as the mangrove's)
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 430,
    shipSite: { x: SHIP_SITE.x, z: SHIP_SITE.z, heading: Math.PI },   // (its ramp toward the street)
    features: { mount: false, wind: false, jetpack: false, climb: true },
    defaults: { hour: 10.5, preset: 'Moebius print', cloudShadows: 0, look: SALT_LOOK },
    sky: { script: SALT_SKY, planets: [{ az: 40, el: 30, size: 1.1, color: '#f4ecdc', craters: true }] },
    killY: -Infinity,
    lights,
    noShadow: kit.noShadow,
    reactions: false,   // (nothing grows out of the salt: reactive-world.js)
    ships,
    life: {
      flocks: [{ count: 14, color: '#f4f0ea', size: 0.9, radius: 90, height: [30, 70], speed: 0.35, seed: 52 }],
      motes: { count: 160, color: '#ffffff', size: 0.04, glow: 0.4, rise: 0.01, wind: [0.2, 0.05] },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.6, name: 'The Salt Harbour' }),
    crowdLines: CROWD_LINES,
    // The harbour's crowd (crowd.js): strollers down the street and its pavements under the hulls, people
    // talking in twos and threes at the shops, others at the decks' rails looking down into the street.
    // Candidates only: the crowd keeps those on clear, walkable ground.
    crowdSpots() {
      const r = mulberry32(5213), V = (x, y, z) => new THREE.Vector3(x, y, z), groups = [], walks = [], edges = [];
      for (const x of [-8, -2.5, 3, 8.5]) walks.push({ path: [V(x, 0, 40), V(x, 0, -320)], n: 6, pair: 0.4 });
      walks.push({ path: [V(-30, 0, -130), V(30, 0, -130)], n: 3, pair: 0.3 });
      for (let z = 30; z > -300; z -= 9 + r() * 10) for (const x of [-10.5, 10.5, 0]) if (r() < (x ? 0.45 : 0.2)) groups.push({ at: V(x + (r() - 0.5) * 2, 0, z + (r() - 0.5) * 3), n: 2 + Math.floor(r() * 2.4) });
      for (const sh of [W1, E1]) for (let t = 0.12; t < 0.9; t += 0.06) if (r() < 0.45) {
        const z = (t * 2 - 1) * (sh.H.L / 2), x = sh.H.halfB(t) * (1 - (sh.S.tumble ?? 0)) * 0.97 - 0.7, p = sh.put(V(x, sh.S.D - 0.35, z)), q = sh.put(V(x + 5, sh.S.D, z));
        edges.push({ at: p, heading: Math.atan2(q.x - p.x, q.z - p.z), pose: 'rail' });
      }
      return { groups, walks, edges, avoid: [], farMax: 420, costume: 'saltharbour', clear: [{ x: SHIP_SITE.x, z: SHIP_SITE.z, r: 14 }, { x: TOWER.x, z: TOWER.z, r: 6 }] };
    },
    update() {},
  };
}
export const createSaltHarbour = stepped(buildSaltHarbour);
