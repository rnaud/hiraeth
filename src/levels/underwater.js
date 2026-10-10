import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { MODE_TERRAIN, sharedUniforms } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { attachTemple } from '../temples/index.js';
import { placeShop } from '../shop-world.js';
import { SHOPS } from '../shop.js';
import { PEOPLE as UW_PEOPLE } from '../story/underwater-people.js';
import {
  UNDERWATER_LOOK, UNDERWATER_DAY, UNDERWATER_DUSK, UNDERWATER_NIGHT, SEA_DAY, UW_PAL, uwMats, seaSurface, tower, pod, podRing, glassColumns, cafeDome,
  lampPost, bush, kelp, rock, manta, fishSchool, farCity, bigDome, glassTube, whale,
} from './underwater-kit.js';

// ---------------------------------------------------------------------------
// The Underwater City (?level=underwater; on the route since v1.40, the fifth world: src/levels/names.js ORDER): a city
// under glass on the sea floor, after its reference sheets (references/levels/The Underwater City, docs/systems/worlds.md
// "The Underwater City"). The traveller is never out in the water: every place he walks is a dry hall under a dome of
// the makers' glass, and the halls are joined by sealed glass tubes and a lift; the sea, its towers of pods, the kelp,
// the fish, the mantas and the whales are all on the other side of the glass.
//
//   the Dock         a great dome in the south: the city's lock takes the ship down into it; the ship stands on its
//                    floor, the moon pool beside it (railed: the lock's water, drawn only), Bastien who keeps it
//   the long tube    north from the Dock to the Avenue, glass all round, the towers of pods outside it
//   the Avenue       the greatest dome: the city's street under glass, its cafés (Coralie's, glass, teal and pink
//                    domes inside the great one), lamps, benches; tubes west to the Garden and north to the Plaza
//   the Garden       a dome of glow-kelp beds and troughs (Mireille, who grows it)
//   the Plaza        the round dome at the north, the great column of luminous water in its middle: the Breathing
//                    Tower, the city's air coming down from the surface. A lift in its foot to the Crown
//   the Crown        a glass bubble round the column's head, 64 m up, just under the surface's ripples (Fabre)
//   the Whale Gallery a dome down the slope to the east, its floor 16 m under the city's, over the drop into the
//                    deep where the whales pass (Maelle listens to them)
//   the Whale-House  the makers' sounding-house on the sea floor north of the Plaza (src/temples/underwater.js): the
//                    last tube runs from the Plaza to its door
//
// The water is drawn as it was (water.js SEA_LOOK): the sea's surface far overhead, the flat banded haze, the shafts of
// light, the caustics; `sea.glass` keeps that look on the view from inside the glass (water.js keepCamera), and every
// dome and tube is an air pocket (sea.air), so nobody swims: there is no water to swim in where you can go.
// ---------------------------------------------------------------------------

export const SEA_Y = 78;
/** The halls: their middle, floor (y), radius and height over the radius. */
export const DOMES = {
  dock: { x: 0, y: 0, z: 128, r: 34, sy: 0.62 },
  avenue: { x: 0, y: 0, z: 22, r: 46, sy: 0.5 },
  garden: { x: -106, y: 0, z: 22, r: 26, sy: 0.7 },
  plaza: { x: 0, y: 0, z: -108, r: 38, sy: 0.62 },
  gallery: { x: 104, y: -16, z: -108, r: 22, sy: 0.78 },
  crown: { x: 0, y: 64, z: -108, r: 13, sy: 0.85 },
};
const D = DOMES;
/** Where the tubes run (their floors' ends), each from a dome's door to the next's. */
export const TUBES = {
  dock: { a: [0, 0, D.dock.z - D.dock.r], b: [0, 0, D.avenue.z + D.avenue.r], R: 5 },
  garden: { a: [D.avenue.x - D.avenue.r, 0, D.avenue.z], b: [D.garden.x + D.garden.r, 0, D.garden.z], R: 5 },
  plaza: { a: [0, 0, D.avenue.z - D.avenue.r], b: [0, 0, D.plaza.z + D.plaza.r], R: 5 },
  gallery: { a: [D.plaza.x + D.plaza.r, 0, D.plaza.z], b: [D.gallery.x - D.gallery.r, D.gallery.y, D.gallery.z], R: 5 },
  temple: { a: [0, 0, D.plaza.z - D.plaza.r], b: [0, 0, -178], R: 5 },
};
/** The sloped tube's run on the ground (the bed is cut under it: seabed). */
const TUBES_AT = { gallery: { x0: TUBES.gallery.a[0], x1: TUBES.gallery.b[0], y0: TUBES.gallery.a[1], y1: TUBES.gallery.b[1], z: TUBES.gallery.a[2] } };
/** The makers' Whale-House (src/temples/underwater.js): its door at the north end of the last tube, facing south. */
export const WHALE_HOUSE = { x: 0, z: -192, door: -178 };
export const SHIP_SITE = { x: 0, z: 134, heading: Math.PI };   // (on the Dock's floor, its hatch toward the long tube, north)
/** The great column (the Breathing Tower) in the Plaza, its lift at its foot (south) and its head in the Crown. */
export const COLUMN = { x: D.plaza.x, z: D.plaza.z, r: 4.2 };
export const LIFT = { foot: [COLUMN.x, 0, COLUMN.z + COLUMN.r + 1.0], head: [COLUMN.x, D.crown.y, COLUMN.z + COLUMN.r + 1.6] };
/** The moon pool beside the ship (the lock's water: drawn only, railed). */
export const POOL = { x: -19, z: 118, r: 6 };
export const LIMIT = 300;
/** Odette's Air-Shop: under the Avenue's dome east of the street, its door turned to it (west). */
export const UW_SHOP = { x: 28, z: 24, heading: -Math.PI / 2 };

const nS = createNoise2D(71011), nD = createNoise2D(71012);

/** The sea floor: under the city a little under its halls' floors; the drop into the deep east of the Plaza; low dunes round. */
export function seabed(x, z) {
  let h = -0.6 + fbm(nS, x * 0.02, z * 0.02, 2) * 0.3;
  // the deep to the east: the floor falls away under the Whale Gallery
  const east = smoothstep(46, 96, x) * smoothstep(-20, -60, z) * smoothstep(-200, -160, z);
  h -= east * 22;
  // the tube down to the Gallery runs in a cut under the slope (the bed kept a metre under its floor all the way)
  const g = TUBES_AT.gallery;
  if (x > g.x0 - 2 && x < g.x1 + 4 && Math.abs(z - g.z) < 9) h = Math.min(h, g.y0 + (g.y1 - g.y0) * Math.min(1, Math.max(0, (x - g.x0) / (g.x1 - g.x0))) - 1.4);
  // out of the city: dunes rising round it
  const out = Math.max(Math.hypot(x * 0.8, (z + 10) * 0.62) - 150, 0);
  h += smoothstep(0, 70, out) * (4 + fbm(nD, x * 0.012, z * 0.012, 3) * 5) + smoothstep(70, 220, out) * 22;
  return h;
}

/** The air: inside a dome or a tube (every place you can stand). */
export function airIn(halls, tubes) {
  return (x, y, z) => halls.some((d) => d.air(x, y, z)) || tubes.some((t) => t.air(x, y, z));
}

/** Which part of the city p is in (the location's name). */
export function placeAt(p) {
  const near = (d, pad = 0) => Math.hypot(p.x - d.x, p.z - d.z) < d.r + pad && Math.abs(p.y - d.y) < d.r * d.sy + 4;
  if (near(D.crown)) return 'The Crown';
  if (near(D.dock)) return 'The Dock';
  if (near(D.garden)) return 'The kelp garden';
  if (near(D.gallery)) return 'The Whale Gallery';
  if (near(D.plaza)) return 'The Plaza';
  if (near(D.avenue)) return 'The Avenue';
  if (p.z < D.plaza.z - D.plaza.r + 4) return 'The tube to the Whale-House';
  return 'A glass tube';
}

// ------------------------------------------------------------------ content: the story page, relics, the city's people
const pal = (cloak, extra = {}) => ({ cloak, lining: extra.lining ?? '#2b211f', ...extra });
export const UNDERWATER_CONTENT = {
  weather: [],
  // the world's page: opened on arrival, closed when the Whale-House's keeper is calmed (src/story/underwater.js)
  story: {
    title: 'THE SONG THROUGH THE GLASS',
    intro: 'A city under glass at the bottom of the sea, its halls joined by tubes. Outside, the whales used to come to the glass and sing. Since the night the sky rang, they keep away, and the glass hums one wrong note.',
    outro: 'The whales came back to the glass. Maelle says they sang the note the light sang, and then their own, and that the light went up, toward a city built down a well.',
    label: 'the Whale-House', goal: [WHALE_HOUSE.x, 0, WHALE_HOUSE.door + 6], radius: 10, verticalRadius: 6, manual: true,
  },
  // (one in each hall worth walking to: the Crown, the Gallery's rail, the Garden's trough, the café's dresser, the Dock's crane)
  relics: {
    spots: [{ at: [6, D.crown.y + 0.1, D.crown.z - 6] }, { at: [D.gallery.x + 14, D.gallery.y + 0.1, D.gallery.z - 6] }, { at: [D.garden.x - 12, 0.95, D.garden.z + 8] }, { at: [-26, 0.1, 50] }, { at: [24, 0.1, 140] }],
    names: ['Barnacle bead', 'Diver’s tag', 'Glow-kelp seed', 'Café token', 'Lock key'],
  },
  npcs: [
    // Bastien keeps the Dock and its lock: he meets the ship, and points the way in
    { id: 'bastien', name: 'Bastien', title: 'who keeps the lock', color: '#3d6f78', kind: 'm', at: [10, 112], y: 0, radius: 1.5, facing: Math.PI * 0.85, palette: pal('#3d6f78', { cloth: '#e3b06a' }), lang: 'underwater',
      lines: ['~happy~ Welcome down. Mind the pool, it’s the lock’s and it’s colder than it looks.', '~neutral~ The long tube goes north to the Avenue. Everything’s north of here.'],
      talk: { listen: [
        '~neutral~ Bastien. I keep the lock. Your ship came down it like a stone down a well. A polite stone.',
        '~curious~ Nobody walks outside here. There’s nothing outside but the sea and the things that live in it. We go hall to hall, through the tubes.',
        { after: { not: { flag: 'temple.underwater.done' } }, say: '~sad~ The whales used to come up to the glass and sing. Since the night the sky rang, they keep away. Maelle in the Whale Gallery will tell you. It’s down the slope, east of the Plaza.' },
        { after: { flag: 'temple.underwater.done' }, say: '~happy~ They’re back. One came right up to the lock this morning and looked in at your ship. I think it approved.' },
      ] } },
    // (Coralie: the trace of the light that the world kept from its days as a detour, src/story/sightings-detours.js)
    { id: 'coralie', name: 'Coralie', title: 'who keeps the café', color: '#d97a5e', kind: 'f', at: [19, 37], y: 0, radius: 1, facing: -Math.PI / 2, palette: pal('#d97a5e', { cloth: '#efd2a6' }), lang: 'underwater',
      lines: ['~happy~ Come in, come in. It’s dry inside, it always is: the glass keeps the sea out.', '~playful~ Tea, or soup? Everything tastes a little of salt down here. We call it seasoning.'],
      talk: { listen: [
        { after: () => true, say: [
          '~neutral~ Years ago a woman from up top came in alone, very tired. She sat at that window all night, listening to the whales.',
          '~solemn~ One was singing something she knew, she said. She hummed it back to it. I didn’t know the tune. By lamp-up she was gone.',
        ], do: { set: { 'sight.underwater.coralie': true } } },
        '~happy~ Come in, come in. It’s dry inside, it always is: the glass keeps the sea out.',
        '~playful~ Tea, or soup? Everything tastes a little of salt down here. We call it seasoning.',
        '~neutral~ Her cup is still on the shelf. Nobody uses it. Nobody decided that; it just happened.',
        { after: { flag: 'temple.underwater.done' }, say: '~happy~ Listen. That’s them. The cups rattle when they sing close by. I had forgotten how much I liked it.' },
      ] } },
    // Mireille grows glow-kelp in the Garden: her cutting goes up to Fabre in the Crown (src/story/underwater-people.js)
    { ...UW_PEOPLE.mireille, at: [D.garden.x + 8, D.garden.z - 6], y: 0, radius: 1.2, facing: Math.PI / 2, palette: pal('#5f8f7a', { cloth: '#efd2a6' }), lang: 'underwater' },
    // Fabre keeps the Crown's lamps, up the lift; he has never seen the sky
    { ...UW_PEOPLE.fabre, at: [-5, D.crown.z + 5], y: D.crown.y, radius: 1, facing: Math.PI, palette: pal('#e3b06a', { cloth: '#3a5f6a' }), lang: 'underwater' },
    // Maelle listens to the whales in the Gallery: the world's way into its temple (src/story/underwater-people.js)
    { ...UW_PEOPLE.maelle, at: [D.gallery.x + 4, D.gallery.z + 6], y: D.gallery.y, radius: 1, facing: Math.PI / 2, palette: pal('#2f8a8f', { cloth: '#f2c8a0' }), lang: 'underwater' },
    // the city's own, in passing
    { at: [-6, D.plaza.z + 16], y: 0, radius: 2, palette: pal('#e3b06a', { cloth: '#3a5f6a' }), lang: 'underwater', lines: ['~curious~ The column brings the air down from the top. Put your hand on it. It breathes.', '~playful~ I rode the lift to the Crown once. My ears went pop and I saw a fish the size of my house.'] },
    { at: [-8, 70], y: 0, radius: 2, palette: pal('#7a6e9e', { cloth: '#efd2a6' }), lang: 'underwater', lines: ['~neutral~ The Avenue’s the big dome. Cafés, lamps, people, the lot.', '~whisper~ Look up as you walk through the tube. Sometimes a manta goes over and the whole tube goes dark.'] },
    { at: [D.avenue.x - 30, D.avenue.z - 8], y: 0, radius: 2, palette: pal('#c4604a', { cloth: '#f2e6d0' }), lang: 'underwater', lines: ['~tired~ The kelp garden is through the west tube. Mireille will put you to work.', '~happy~ Glow-kelp in the soup, glow-kelp on the lamps. It’s all glow-kelp down here.'] },
  ],
};

/** What the city's people say in passing (crowd.js), toned. */
export const CROWD_LINES = [
  '~neutral~ Mind the tube’s step. It’s wet when the glass sweats.',
  '~happy~ At midday the light comes all the way down through the domes. Look up!',
  '~curious~ You came down the lock? With that little pack? Brave.',
  '~whisper~ If you sit still in the café you can hear the manta go over. A sort of hum.',
  '~playful~ My grandfather went up to the surface once. He said it was very bright and very dry and he did not care for it.',
  '~tired~ Hall to hall all day, carrying the post.',
  '~solemn~ The whales used to sing right against the glass. Now you only hear them far off.',
  '~neutral~ The cafés are dry inside. Wipe your feet, though.',
];

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildUnderwater(scene) {
  const rng = mulberry32(71001);
  const terrain = yield* Terrain.make({
    size: 1000, seg: 200, height: seabed,   // (5 m: the halls stand on their own floors over it)
    material: { color: UW_PAL.sand[0], color2: UW_PAL.sand[1], color3: UW_PAL.sand[2], mode: MODE_TERRAIN, ripples: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'The Underwater City';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 71001 });
  const M = uwMats(kit);
  const solid = { solid: true, shadow: true }, drawn = { solid: false, shadow: false };
  const decks = [], cafes = [];

  // ---------------------------------------------------------------- the halls and the tubes between them
  const N = Math.PI, S = 0, E = Math.PI / 2, W = -Math.PI / 2;
  const door = { w: 6, h: 3.9 };   // (inside a tube's arch of 5 m: 3² + 3.9² < 5²)
  const halls = {
    dock: bigDome(kit, M, { ...D.dock, doors: [{ yaw: N, ...door }], floor: M.street }),
    avenue: bigDome(kit, M, { ...D.avenue, doors: [{ yaw: S, ...door }, { yaw: W, ...door }, { yaw: N, ...door }], ribs: 20, floor: M.street, seg: 64 }),
    garden: bigDome(kit, M, { ...D.garden, doors: [{ yaw: E, ...door }], floor: M.pier }),
    plaza: bigDome(kit, M, { ...D.plaza, doors: [{ yaw: S, ...door }, { yaw: E, ...door }, { yaw: N, ...door }], ribs: 18, floor: M.streetPale, seg: 56 }),
    gallery: bigDome(kit, M, { ...D.gallery, doors: [{ yaw: W, ...door }], floor: M.street }),
    crown: bigDome(kit, M, { ...D.crown, doors: [], ribs: 10, floor: M.streetPale, seg: 36 }),
  };
  yield;
  const tubes = {};
  for (const [id, t] of Object.entries(TUBES)) tubes[id] = glassTube(kit, M, { ...t, floor: id === 'temple' ? M.pier : M.street });
  const air = airIn(Object.values(halls), Object.values(tubes));
  yield;

  // ---------------------------------------------------------------- the Dock: the ship's floor, the moon pool, cranes and crates
  {
    const dk = D.dock;
    kit.add(M.streetPale, new THREE.RingGeometry(14, 16, 48).rotateX(-Math.PI / 2).translate(SHIP_SITE.x, 0.06, SHIP_SITE.z), drawn);   // (the landing ring painted on the floor)
    // the moon pool: the lock's water, drawn (a still sheet, lit from below), its rail
    kit.add(M.column, new THREE.CircleGeometry(POOL.r, 32).rotateX(-Math.PI / 2).translate(POOL.x, 0.08, POOL.z), drawn);
    kit.add(M.frame, new THREE.TorusGeometry(POOL.r + 0.3, 0.12, 4, 40).rotateX(Math.PI / 2).translate(POOL.x, 1.05, POOL.z), solid);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; kit.add(M.post, new THREE.CylinderGeometry(0.06, 0.06, 1.05, 4).translate(POOL.x + Math.cos(a) * (POOL.r + 0.3), 0.52, POOL.z + Math.sin(a) * (POOL.r + 0.3)), solid); }
    kit.add(M.pier, new THREE.CylinderGeometry(POOL.r + 0.2, POOL.r + 0.2, 1.0, 32, 1, true).translate(POOL.x, 0.5, POOL.z), solid);   // (the rail's wall: nobody steps into the lock)
    kit.light(POOL.x, 1.2, POOL.z, 9);
    // a crane over the pool, crates and drums along the wall
    kit.add(M.frame, new THREE.BoxGeometry(0.6, 9, 0.6).translate(POOL.x - 8, 4.5, POOL.z - 4), solid);
    kit.add(M.frame, new THREE.BoxGeometry(0.5, 0.5, 12).rotateY(0.9).translate(POOL.x - 3.5, 9, POOL.z - 0.5), drawn);
    for (const [x, z, s] of [[22, 140, 1.4], [24, 137.5, 1.1], [21, 112, 1.2], [-24, 140, 1.3], [-26, 136, 1.0], [26, 124, 1.0]]) kit.add(M.rim, new THREE.BoxGeometry(s * 1.6, s, s * 1.2).translate(x, s / 2, z), solid);
    for (let a = 0.5; a < Math.PI * 2; a += 0.95) lampPost(kit, M, dk.x + Math.sin(a) * (dk.r - 4), 0, dk.z + Math.cos(a) * (dk.r - 4), { h: 4 });
  }
  yield;

  // ---------------------------------------------------------------- the Avenue: the street under the great dome, its cafés
  {
    const av = D.avenue;
    // the street north-south through it, paved darker, lamps both sides
    kit.add(M.streetPale, new THREE.PlaneGeometry(10, av.r * 2 - 4).rotateX(-Math.PI / 2).translate(0, 0.06, av.z), drawn);
    kit.add(M.streetPale, new THREE.PlaneGeometry(av.r - 4, 7).rotateX(-Math.PI / 2).translate(-av.r / 2 - 1, 0.06, av.z), drawn);
    for (let z = av.z + av.r - 10; z > av.z - av.r + 6; z -= 12) for (const s of [-1, 1]) lampPost(kit, M, s * 5.6, 0, z + (s > 0 ? 6 : 0), { h: 3.6 });
    // the cafés: domes inside the great dome
    const cs = [
      { x: 19, z: 40, r: 8.5, sy: 0.8, shell: 'glass', doorYaw: W, tables: 8 },   // Coralie's
      { x: -19, z: 40, r: 7, sy: 0.9, shell: 'teal', doorYaw: E, windows: [{ yaw: E + 0.75, w: 5, y0: 0.7, y1: 4.8 }, { yaw: E - 0.75, w: 5, y0: 0.7, y1: 4.8 }], porthole: 1.5, tables: 5 },
      { x: -22, z: 4, r: 8, sy: 0.82, shell: 'glass', doorYaw: E, tables: 7 },
      { x: 20, z: 0, r: 6.5, sy: 0.95, shell: 'pink', doorYaw: W, windows: [{ yaw: W + 0.8, w: 4, y0: 0.6, y1: 4 }, { yaw: W - 0.8, w: 4, y0: 0.6, y1: 4 }], tables: 4 },
      { x: 26, z: -14, r: 4.6, sy: 0.95, shell: 'pink', doorYaw: W - 0.3, windows: [{ yaw: N, w: 3, y0: 0.5, y1: 3 }], tables: 2 },
    ];
    for (const c of cs) { const d = cafeDome(kit, M, rng, { y: 0, people: 0, ...c }); for (const t of d.tables) cafes.push({ x: t[0], z: t[1], y: 0 }); }
    // a tower of pods inside the great dome, its open decks to climb to (the Avenue's height)
    const pods = podRing(rng, { h: 18, n: 3, rr: 3.2, from: 5, a0: 0.4, spread: 2.2, kinds: ['open'] });
    const tops = tower(kit, M, rng, { x: -24, z: -16, y0: -0.3, h: 18, r: 3.6, top: 'flat', pods });
    for (const p of tops) decks.push(p);
    // benches and bushes in planters along the street
    for (const [x, z, a] of [[8, 30, 0], [-8, 14, 0], [8, -6, 0], [-8, -12, 0], [-30, 22, Math.PI / 2], [-38, 26, Math.PI / 2]]) {
      kit.add(M.rim, new THREE.BoxGeometry(2.4, 0.45, 0.6).rotateY(a).translate(x, 0.22, z), solid);
      kit.add(M.pier, new THREE.BoxGeometry(1.2, 0.7, 1.2).translate(x + (a ? 0 : 2.2), 0.35, z + (a ? 2.2 : 0)), solid);
      bush(kit, M, rng, x + (a ? 0 : 2.2), 0.7, z + (a ? 2.2 : 0), 1.1);
    }
  }
  yield;

  // ---------------------------------------------------------------- the Garden: glow-kelp in beds and troughs
  {
    const g = D.garden;
    for (let i = -2; i <= 2; i++) {
      const z = g.z + i * 7;
      kit.add(M.pier, new THREE.BoxGeometry(26 - Math.abs(i) * 4, 0.9, 2.6).translate(g.x - 2, 0.45, z), solid);
      kit.add(M.column, new THREE.BoxGeometry(25 - Math.abs(i) * 4, 0.05, 2.0).translate(g.x - 2, 0.92, z), drawn);   // (the troughs' water, glowing)
      for (let k = 0; k < 4 - Math.abs(i); k++) kelp(kit, M, rng, [g.x - 10 + k * 6 + rng() * 2, 0.9, z], { n: 3, h: 3 + rng() * 2.5, spread: 1.2 });
      kit.light(g.x - 2, 2, z, 6);
    }
    for (let a = 0.3; a < Math.PI * 2; a += 1.1) lampPost(kit, M, g.x + Math.sin(a) * (g.r - 3), 0, g.z + Math.cos(a) * (g.r - 3), { h: 3.4 });
  }
  yield;

  // ---------------------------------------------------------------- the Plaza: the great column, the lift, benches, two pink houses
  {
    const p = D.plaza;
    // the column of luminous water from the floor up through the dome to the Crown's floor, and on to the surface
    const COLS = [{ x: COLUMN.x, z: COLUMN.z, r: COLUMN.r, y0: -0.2, y1: D.crown.y - 0.2 }];
    const columns = glassColumns(kit, M, COLS, { mover: false, near: 90 });
    kit.add(M.column, new THREE.CylinderGeometry(COLUMN.r * 0.7, COLUMN.r * 0.7, SEA_Y - D.crown.y - D.crown.r * D.crown.sy + 2, 14, 1, true).translate(COLUMN.x, D.crown.y + D.crown.r * D.crown.sy + (SEA_Y - D.crown.y - D.crown.r * D.crown.sy) / 2, COLUMN.z), drawn);
    // the lift's booth at the column's foot: a door of brass in the glass (walked into: level.portals)
    kit.add(M.frame, new THREE.BoxGeometry(3.4, 3.6, 0.5).translate(LIFT.foot[0], 1.8, COLUMN.z + COLUMN.r + 0.1), drawn);
    kit.add(M.windowLit, new THREE.PlaneGeometry(2.2, 2.8).translate(LIFT.foot[0], 1.4, COLUMN.z + COLUMN.r + 0.37), drawn);
    kit.light(LIFT.foot[0], 3.2, LIFT.foot[2] + 1, 6);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.4) continue;   // (the lift's side clear)
      kit.add(M.rim, new THREE.BoxGeometry(2.2, 0.45, 0.6).rotateY(-a + Math.PI / 2).translate(p.x + Math.cos(a) * 10, 0.22, p.z + Math.sin(a) * 10), solid);
      lampPost(kit, M, p.x + Math.cos(a + 0.26) * 20, 0, p.z + Math.sin(a + 0.26) * 20, { h: 3.8 });
    }
    cafeDome(kit, M, rng, { x: 22, y: 0, z: p.z - 14, r: 5.5, sy: 0.9, shell: 'pink', doorYaw: -2.2, windows: [{ yaw: -1.6, w: 3.5, y0: 0.5, y1: 3.4 }], tables: 3, people: 0 });
    cafeDome(kit, M, rng, { x: -22, y: 0, z: p.z - 12, r: 4.8, sy: 0.95, shell: 'pink', doorYaw: 2.2, windows: [{ yaw: 1.6, w: 3, y0: 0.5, y1: 3.2 }], tables: 2, people: 0 });
    // the Crown: the column's head as a round pedestal in the middle of its floor, the lift's door in it, lamps round the glass
    const c = D.crown;
    kit.add(M.frame, new THREE.CylinderGeometry(COLUMN.r + 0.4, COLUMN.r + 0.6, 1.2, 24).translate(c.x, c.y + 0.6, c.z), solid);
    kit.add(M.frame, new THREE.BoxGeometry(3.4, 3.6, 0.5).translate(LIFT.head[0], c.y + 1.8, c.z + COLUMN.r + 0.75), drawn);
    kit.add(M.windowLit, new THREE.PlaneGeometry(2.2, 2.8).translate(LIFT.head[0], c.y + 1.4, c.z + COLUMN.r + 1.02), drawn);
    kit.add(M.column, new THREE.CylinderGeometry(COLUMN.r * 0.9, COLUMN.r * 0.9, c.r * c.sy, 14, 1, true).translate(c.x, c.y + (c.r * c.sy) / 2, c.z), drawn);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) lampPost(kit, M, c.x + Math.sin(a) * (c.r - 2), c.y, c.z + Math.cos(a) * (c.r - 2), { h: 3.2 });
    for (const a of [0.8, 2.4, 4.0, 5.6]) kit.add(M.rim, new THREE.BoxGeometry(2.0, 0.45, 0.55).rotateY(a).translate(c.x + Math.sin(a) * (c.r - 4.5), c.y + 0.22, c.z + Math.cos(a) * (c.r - 4.5)), solid);
    kit.mover((t, at) => columns.update(t, at));
  }
  yield;

  // ---------------------------------------------------------------- the Whale Gallery: a bench round the glass over the deep
  {
    const g = D.gallery;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.25 + (i / 6) * Math.PI * 1.1;
      kit.add(M.rim, new THREE.BoxGeometry(3.2, 0.45, 0.7).rotateY(-a + Math.PI / 2).translate(g.x + Math.cos(a) * (g.r - 4), g.y + 0.22, g.z + Math.sin(a) * (g.r - 4)), solid);
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) lampPost(kit, M, g.x + Math.sin(a) * (g.r - 2), g.y, g.z + Math.cos(a) * (g.r - 2), { h: 3.2, r: 6 });
    // a great brass listening horn on a stand, turned to the deep
    kit.add(M.frame, new THREE.CylinderGeometry(0.2, 0.3, 2.6, 8).translate(g.x + 8, g.y + 1.3, g.z), solid);
    kit.add(M.frame, new THREE.CylinderGeometry(1.6, 0.25, 3.2, 16, 1, true).rotateZ(-Math.PI / 2).translate(g.x + 9.6, g.y + 2.8, g.z), drawn);
  }
  yield;

  // ---------------------------------------------------------------- the sea outside: towers of pods, columns, kelp, rocks
  const TOWERS = [
    { x: -44, z: 84, h: 44, r: 6 }, { x: 44, z: 80, h: 40, r: 5.5 }, { x: 62, z: -22, h: 54, r: 7 }, { x: -62, z: -44, h: 58, r: 7.5 },
    { x: -52, z: -156, h: 48, r: 6 }, { x: 52, z: -164, h: 46, r: 6 }, { x: 92, z: 40, h: 36, r: 5 }, { x: -92, z: 92, h: 34, r: 5 },
    { x: -136, z: -40, h: 40, r: 5 }, { x: 132, z: 24, h: 30, r: 4.5 }, { x: 46, z: -64, h: 52, r: 6.5 }, { x: -46, z: 170, h: 38, r: 5 },
    { x: 54, z: 176, h: 42, r: 5.5 }, { x: -150, z: 70, h: 32, r: 4.5 },
  ];
  for (const [i, t] of TOWERS.entries()) {
    const y0 = H(t.x, t.z) - 0.3;
    const pods = podRing(rng, { h: t.h, n: Math.round(t.h / 10), rr: t.r * 0.75, from: 4, a0: Math.atan2(-t.z, -t.x) + (rng() - 0.5), spread: 2.1 });
    tower(kit, M, rng, { x: t.x, z: t.z, y0, h: t.h, r: t.r, top: ['dome', 'spire', 'flat'][i % 3], pods });
    if (i % 3 === 2) yield;
  }
  const OUT_COLS = [[-30, 72, 1.3], [30, -40, 1.5], [-34, -70, 1.4], [70, 60, 1.1], [-70, -10, 1.2], [80, -150, 1.3], [-80, -130, 1.2]].map(([x, z, r]) => ({ x, z, r, y0: H(x, z) - 0.2, y1: SEA_Y - 3 }));
  const outCols = glassColumns(kit, M, OUT_COLS, { mover: false, near: 120 });
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2, d = 50 + rng() * 120, x = Math.cos(a) * d * 0.9, z = -10 + Math.sin(a) * d * 1.2;
    if (air(x, H(x, z) + 1, z) || Object.values(D).some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 4) || Object.values(tubes).some((t) => distToSeg(x, z, t) < t.R + 3)) continue;
    if (i % 3 === 0) rock(kit, M, x, H(x, z), z, 1.6 + rng() * 3, i);
    else if (i % 3 === 1) kelp(kit, M, rng, [x, H(x, z), z], { n: 4 + Math.floor(rng() * 4), h: 6 + rng() * 8 });
    else bush(kit, M, rng, x, H(x, z), z, 1.4 + rng() * 1.6);
  }
  yield;

  // ---------------------------------------------------------------- the city far off, all round (drawn only: the haze takes it)
  const far = new THREE.Group();
  far.name = 'The city far off';
  scene.add(far);
  const farKit = new RoomKit({ group: far, centre: new THREE.Vector3(), seed: 71002 });
  farCity(farKit, M, rng, { x: 0, z: -30, rMin: 300, rMax: 520, n: 110, arc: [0, Math.PI * 2], hMin: 24, hMax: 90, outside: 300, ground: H });
  farKit.finish();
  far.traverse((o) => { if (o.isMesh) o.userData.floats = true; });
  yield;

  // ---------------------------------------------------------------- the sea: its surface overhead; dry wherever you can go
  const sea = seaSurface(kit, { y: SEA_Y, size: 1400, sea: { ...SEA_DAY, glass: true, shafts: { ...SEA_DAY.shafts }, caustics: { ...SEA_DAY.caustics } }, air });
  // life: mantas, schools of small fish, and the whales out in the deep (the Whale-House's change brings them to the glass)
  const near = { k: 0 };
  manta(kit, M, { at: [0, 34, 40], R: 70, w: 15, speed: 2.6, phase: 0.4, bank: 0.2 });
  manta(kit, M, { at: [40, 44, -60], R: 120, w: 19, speed: -3, phase: 2.2, bank: 0.15 });
  for (const [x, y, z, n, R] of [[28, 10, 92, 30, 6], [-30, 18, -30, 30, 5], [50, 12, -110, 36, 7], [-70, 8, 50, 26, 5], [-20, 6, 160, 24, 6]]) fishSchool(kit, M, { at: [x, y, z], n, R, seed: x * 7 + z });
  const whales = [
    whale(kit, M, { at: [150, -6, -108], R: 70, len: 24, speed: 2.2, phase: 0.3, near: () => near.k, come: 38, bob: 3 }),
    whale(kit, M, { at: [150, 6, -60], R: 110, len: 18, speed: -2.6, phase: 2.0, near: () => near.k, come: 50, bob: 4 }),
  ];
  yield;

  kit.finish();
  // (the plants on the decks and the kelp are walked through: flora, as the contact audit counts them)
  const leaves = new Set(M.leaf);
  group.traverse((o) => { if (o.isMesh && leaves.has(o.material)) o.userData.flora = true; });
  const noShadow = [...kit.noShadow, sea];
  yield;

  // the sea's colour by the hour: the shafts and the caustics only while the sun is up
  const Sx = sea.userData.sea, cDay = new THREE.Color(SEA_DAY.tint), cDeep = new THREE.Color(SEA_DAY.deep);
  const cNight = new THREE.Color('#0d2c44'), cNightDeep = new THREE.Color('#06182a'), _c = new THREE.Color();
  function seaByHour() {
    const k = 1 - sharedUniforms.uNight.value;
    Sx.tint = '#' + _c.copy(cNight).lerp(cDay, k).getHexString();
    Sx.deep = '#' + _c.copy(cNightDeep).lerp(cDeep, k).getHexString();
    Sx.shafts.strength = SEA_DAY.shafts.strength * k;
    Sx.caustics.strength = SEA_DAY.caustics.strength * k;
    Sx.max = THREE.MathUtils.lerp(0.75, SEA_DAY.max, k);
  }

  const spawn = new THREE.Vector3(SHIP_SITE.x, 0.05, SHIP_SITE.z - 22);
  // Odette's Air-Shop under the Avenue's dome, east of the street, its door to it (src/shop-world.js 'bubble')
  const shop = placeShop(scene, { def: SHOPS.airshop, at: new THREE.Vector3(UW_SHOP.x, 0, UW_SHOP.z), heading: UW_SHOP.heading });
  kit.lights.push(...shop.lights);
  // the lift in the column: walked into at its foot in the Plaza, out at its head in the Crown, and back (src/passage.js)
  const up = new THREE.Vector3(0, 1, 0);
  const portals = [
    { at: new THREE.Vector3(LIFT.foot[0], 0.6, LIFT.foot[2]), r: 1.3, to: new THREE.Vector3(LIFT.head[0], D.crown.y + 0.1, LIFT.head[2] + 3.4), heading: 0, label: 'the lift up to the Crown', toUp: up },
    { at: new THREE.Vector3(LIFT.head[0], D.crown.y + 0.6, LIFT.head[2]), r: 1.3, to: new THREE.Vector3(LIFT.foot[0], 0.1, LIFT.foot[2] + 3.4), heading: 0, label: 'the lift down to the Plaza', toUp: up },
  ];
  const level = {
    id: 'underwater',
    ground: terrain,
    spawn, spawnHeading: Math.PI, camYaw: 0, camPitch: 0.06,
    shipSite: { ...SHIP_SITE },
    features: { mount: false, wind: false, jetpack: false, climb: true },
    limit: LIMIT, killY: -80,
    edgeHint: 'The glass holds the sea back; there is nowhere further to go.',
    defaults: { hour: 11, preset: 'Moebius print', cloudShadows: 0, look: UNDERWATER_LOOK },
    sky: { script: { day: UNDERWATER_DAY, dusk: UNDERWATER_DUSK, night: UNDERWATER_NIGHT } },
    lights: kit.lights, noShadow,
    reactions: false,   // (nothing grows on the halls' floors: reactive-world.js)
    portals: [...portals, ...shop.portals],
    shops: [shop],
    floraAvoid: shop.avoid(),
    sea, halls, tubes, decks, cafes, air, whales, column: COLUMN, lift: LIFT,
    // the whales come to the glass once the Whale-House's keeper is calmed (src/temples/underwater.js change)
    whalesNear: (k) => { near.k = k; },
    // the great column over the Plaza and the towers of pods round the city, seen through the glass (the level design
    // audit's landmarks: the column's glass is see-through to the height grid; the Crown's bubble at its head)
    beacons: [{ name: 'the Breathing Tower', top: [COLUMN.x, D.crown.y + D.crown.r * D.crown.sy, COLUMN.z], height: 8 }],
    // the city's leading lines (the level design audit's `lines`; its glass blocks the audit's sight rays though it hides
    // nothing): the sealed tubes, lamplit, hall to hall, and the street through the Avenue
    lines: [
      { name: 'the long tube and the west tube', points: [[0, 0, D.dock.z - 14], [0, 0, D.dock.z - D.dock.r], [0, 0, D.avenue.z + D.avenue.r], [0, 0, D.avenue.z], [D.avenue.x - D.avenue.r, 0, D.avenue.z], [D.garden.x + D.garden.r, 0, D.garden.z], [D.garden.x + 6, 0, D.garden.z]] },
      { name: 'the Avenue’s street to the Plaza', points: [[D.garden.x + 6, 0, D.garden.z], [D.avenue.x - D.avenue.r, 0, D.avenue.z], [0, 0, D.avenue.z], [0, 0, D.avenue.z - D.avenue.r], [0, 0, D.plaza.z + D.plaza.r], [0, 0, COLUMN.z + COLUMN.r + 2]] },
      { name: 'the tube down to the Whale Gallery', points: [[0, 0, COLUMN.z + COLUMN.r + 4], [D.plaza.x + D.plaza.r, 0, D.plaza.z], [D.gallery.x - D.gallery.r, D.gallery.y, D.gallery.z], [D.gallery.x, D.gallery.y, D.gallery.z]] },
      { name: 'the tube to the Whale-House', points: [[D.gallery.x, D.gallery.y, D.gallery.z], [D.gallery.x - D.gallery.r, D.gallery.y, D.gallery.z], [D.plaza.x + D.plaza.r, 0, D.plaza.z], [0, 0, D.plaza.z - D.plaza.r], [0, 0, WHALE_HOUSE.door + 2]] },
      { name: 'the city’s length, back to the Dock', points: [[0, 0, WHALE_HOUSE.door + 2], [0, 0, D.plaza.z - D.plaza.r], [0, 0, D.plaza.z + D.plaza.r], [0, 0, D.avenue.z - D.avenue.r], [0, 0, D.avenue.z + D.avenue.r], [0, 0, D.dock.z - D.dock.r], [0, 0, SHIP_SITE.z - 12]] },
    ],
    sights: [
      { name: 'the moon pool', at: [POOL.x, 0, POOL.z] },
      { name: 'the window over the deep', at: [D.gallery.x + D.gallery.r - 4, D.gallery.y, D.gallery.z] },
      { name: 'the glow-kelp troughs', at: [D.garden.x - 2, 0, D.garden.z] },
    ],
    atmo: (x, z, y) => ({ tint: [1, 1, 1], fog: 0.6, name: placeAt({ x, y: y ?? 0, z }) }),
    life: { motes: { count: 220, color: '#d8f2ee', size: 0.05, rise: 0.06, wind: [0.08, 0.03] } },
    crowdLines: CROWD_LINES,
    crowdSpots() {
      const r = mulberry32(7171), V = (x, y, z) => new THREE.Vector3(x, y, z), size = () => 2 + Math.floor(r() * 3);
      const groups = [], walks = [], edges = [];
      // along the tubes and through the halls, hall to hall
      for (const [id, t] of Object.entries(tubes)) if (id !== 'temple') walks.push({ path: [V(...t.at(0.02)), V(...t.at(0.98))], n: 3, pair: 0.4 });
      for (const x of [-3.5, 3.5]) walks.push({ path: [V(x, 0, D.avenue.z + D.avenue.r - 4), V(x, 0, D.avenue.z - D.avenue.r + 4)], n: 6, pair: 0.4 });
      walks.push({ path: Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return V(D.plaza.x + Math.cos(a) * 16, 0, D.plaza.z + Math.sin(a) * 16); }), n: 6, pair: 0.4, loop: true });
      for (let i = 0; i < 5; i++) { const a = r() * 6.28; groups.push({ at: V(D.plaza.x + Math.cos(a) * 26, 0, D.plaza.z + Math.sin(a) * 26), n: size() }); }
      for (let i = 0; i < 4; i++) { const a = r() * 6.28; groups.push({ at: V(D.avenue.x + Math.cos(a) * 32, 0, D.avenue.z + Math.sin(a) * 32), n: size() }); }
      groups.push({ at: V(D.garden.x - 10, 0, D.garden.z - 16), n: 2 }, { at: V(D.dock.x + 20, 0, D.dock.z - 6), n: 2 });
      for (const c of cafes) if (r() < 0.6) groups.push({ at: V(c.x + 0.9, c.y, c.z - 0.9), n: 2 });
      for (let i = 0; i < 4; i++) { const a = Math.PI * 0.3 + i * 0.35; edges.push({ at: V(D.gallery.x + Math.cos(a) * (D.gallery.r - 1.6), D.gallery.y, D.gallery.z + Math.sin(a) * (D.gallery.r - 1.6)), heading: Math.PI / 2 - a, pose: 'rail' }); }
      for (const sp of [...groups, ...walks, ...edges]) sp.lines = CROWD_LINES;
      return { groups, walks, edges, avoid: [], farMax: 220, costume: 'underwater', palette: { cloaks: UW_PAL.people },
        clear: [{ x: spawn.x, z: spawn.z, r: 6 }, { x: SHIP_SITE.x, z: SHIP_SITE.z, r: 18 }, { x: COLUMN.x, z: COLUMN.z + COLUMN.r + 2, r: 4 }] };
    },
    update(dt, t, ctx = {}) {
      for (const m of kit.movers) m(t, ctx.player?.pos ?? null);
      outCols.update(t, ctx.player?.pos ?? null);
      seaByHour();
    },
  };
  return attachTemple('underwater', scene, level);
}
export const createUnderwater = stepped(buildUnderwater);

/** How far (x, z) is from a tube's line, on the ground. */
function distToSeg(x, z, t) {
  const ax = t.a.x, az = t.a.z, dx = t.b.x - ax, dz = t.b.z - az, L2 = dx * dx + dz * dz || 1;
  const s = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
  return Math.hypot(x - ax - dx * s, z - az - dz * s);
}
