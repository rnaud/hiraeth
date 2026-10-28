import { UNDERWATER_TEMPLE } from '../temples/underwater.js';
import * as UNDERWATER_WORDS from '../temples/underwater-data.js';
import * as THREE from 'three';
import { buildCityLife } from './underwater-life.js';
import { attachPort } from './port-pad.js';
import { UNDERWATER_PORT } from './ports.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { MODE_TERRAIN, sharedUniforms } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { attachTempleDefinition } from '../temples/attachment.js';
import { placeShop } from '../shop-world.js';
import { SHOPS } from '../shop.js';
import { PEOPLE as UW_PEOPLE } from '../story/underwater-people.js';
import { KEEPERS_HATCH } from '../temples/underwater.js';
import { canyonBed, buildCanyonStreet, CAGE, TERRACES } from '../underwater-canyon.js';
import { buildSeabedWalk, HELMET } from '../underwater-seabed.js';
import { buildSingingCity } from '../underwater-song.js';
import { buildSeaPort, SHAFT, SEA_PORT, PORT_SHIP, STATIONS, doorSpot } from '../underwater-port.js';
import {
  UNDERWATER_LOOK, UNDERWATER_DAY, UNDERWATER_DUSK, UNDERWATER_NIGHT, SEA_DAY, UW_PAL, uwMats, seaSurface, tower, pod, podRing, glassColumns, cafeDome,
  lampPost, bush, kelp, rock, manta, farCity, bigDome, glassTube, whale,
} from './underwater-kit.js';

// ---------------------------------------------------------------------------
// The Underwater City (?level=underwater; on the route since v1.40, the fifth world: src/levels/names.js ORDER): a city
// under glass on the sea floor, after its reference sheets (references/levels/The Underwater City, docs/systems/worlds.md
// "The Underwater City"). The traveller is never out in the water: every place he walks is a dry hall under a dome of
// the makers' glass, and the halls are joined by sealed glass tubes and a lift; the sea, its towers of pods, the kelp,
// the fish, the mantas and the whales are all on the other side of the glass.
//
//   the sea port     a round coral deck on floats on the surface over the Dock, where the ship lands; the lift (the
//                    city's lock) down a glass shaft through the sea and the Dock's crown (src/underwater-port.js, #572)
//   the Dock         a great dome in the south: the lift comes down into its middle; the moon pool (railed: the lock's
//                    water, drawn only), the divers' rack, Bastien who keeps the lock
//   the long tube    north from the Dock to the Avenue, glass all round, the towers of pods outside it
//   the Avenue       the greatest dome: the city's street under glass, its cafés (Coralie's, glass, teal and pink
//                    domes inside the great one), lamps, benches; tubes west to the Garden and north to the Plaza
//   the Garden       a dome of glow-kelp beds and troughs (Brune, who grows it)
//   the Plaza        the round dome at the north, the great column of luminous water in its middle: the Breathing
//                    Tower, the city's air coming down from the surface. A lift in its foot to the Crown
//   the Crown        a glass bubble round the column's head, 64 m up, just under the surface's ripples (Fabre)
//   the Whale Gallery a dome down the slope to the east, its floor 16 m under the city's, over the drop into the
//                    deep where the whales pass (Maelle listens to them)
//   the Whale-House  the makers' sounding-house on the sea floor north of the Plaza (src/temples/underwater.js): the
//                    last tube runs from the Plaza to its door
//   the kelp tube    from the divers' court's south door to the garden's north door, through the kelp outside, past the
//                    sunken diving bell (v1.50, issue #132): the way home from the Whale-House's keepers' hatch
//
// The author's three picked explorations (issue #192), woven into one way through the city: out of the Dock by the
// divers' lock in a helmet, bell to bell over the seabed (src/underwater-seabed.js), a whale passing overhead at the lip
// of the canyon, down the canyon street's terraces to the Whale Gallery on its shelf (src/underwater-canyon.js), and the
// halls' great pipes to tune on the way north to the Whale-House (src/underwater-song.js). Out of the glass you walk the
// bed in the helmet (the sea's `helmet`: swim.js), never swimming; its air runs down and the bells give it back.
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
  // the divers' court (v1.48, issue #101): the makers' court under a dome of its own, west of the Plaza (src/finds/courts.js)
  court: { x: -90, y: 0, z: -108, r: 22, sy: 0.72 },
};
const D = DOMES;
/** The point on dome `d`'s foot facing dome `to`, and that door's yaw (a tube between them runs along the line of their middles). */
function domeDoor(d, to) { const a = Math.atan2(to.x - d.x, to.z - d.z); return [d.x + Math.sin(a) * d.r, 0, d.z + Math.cos(a) * d.r]; }
const doorYaw = (d, to) => Math.atan2(to.x - d.x, to.z - d.z);
/** Where the tubes run (their floors' ends), each from a dome's door to the next's. */
export const TUBES = {
  dock: { a: [0, 0, D.dock.z - D.dock.r], b: [0, 0, D.avenue.z + D.avenue.r], R: 5 },
  garden: { a: [D.avenue.x - D.avenue.r, 0, D.avenue.z], b: [D.garden.x + D.garden.r, 0, D.garden.z], R: 5 },
  plaza: { a: [0, 0, D.avenue.z - D.avenue.r], b: [0, 0, D.plaza.z + D.plaza.r], R: 5 },
  gallery: { a: [D.plaza.x + D.plaza.r, 0, D.plaza.z], b: [D.gallery.x - D.gallery.r, D.gallery.y, D.gallery.z], R: 5 },
  temple: { a: [0, 0, D.plaza.z - D.plaza.r], b: [0, 0, -178], R: 5 },
  court: { a: [D.plaza.x - D.plaza.r, 0, D.plaza.z], b: [D.court.x + D.court.r, 0, D.court.z], R: 5 },
  // (v1.50, issue #132: the way home from the keepers' hatch, the divers' court south to the garden, its doors on the line between them)
  kelp: { a: domeDoor(D.court, D.garden), b: domeDoor(D.garden, D.court), R: 5 },
};
/** The sloped tube's run on the ground (the bed is cut under it: seabed). */
const TUBES_AT = { gallery: { x0: TUBES.gallery.a[0], x1: TUBES.gallery.b[0], y0: TUBES.gallery.a[1], y1: TUBES.gallery.b[1], z: TUBES.gallery.a[2] } };
/** The makers' Whale-House (src/temples/underwater.js): its door at the north end of the last tube, facing south. */
export const WHALE_HOUSE = { x: 0, z: -192, door: -178 };
/** Where the ship stands: on the sea port's deck over the Dock, its hatch north toward the lift's house (issue #572). */
export const SHIP_SITE = PORT_SHIP;
/** The lift's foot in the Dock, its door north toward the long tube (src/underwater-port.js). */
export const LIFT_FOOT = doorSpot('foot');
/** The great column (the Breathing Tower) in the Plaza, its lift at its foot (south) and its head in the Crown. */
export const COLUMN = { x: D.plaza.x, z: D.plaza.z, r: 4.2 };
export const LIFT = { foot: [COLUMN.x, 0, COLUMN.z + COLUMN.r + 1.0], head: [COLUMN.x, D.crown.y, COLUMN.z + COLUMN.r + 1.6] };
/** The moon pool beside the ship (the lock's water: drawn only, railed). */
export const POOL = { x: -19, z: 118, r: 6 };
/** What the Dock's first view looks across, either side of the way to the long tube: the divers' rack, the cargo, the stripe ([from z, to z]). */
export const DOCK_DRESSING = { rack: [-9, 102], cargo: [9.5, 100.5], stripe: [121, 96] };
export const LIMIT = 300;
/** Odette's Air-Shop: under the Avenue's dome east of the street, its door turned to it (west). */
export const UW_SHOP = { x: 28, z: 24, heading: -Math.PI / 2 };

const nS = createNoise2D(71011), nD = createNoise2D(71012);

/** The sea floor: under the city a little under its halls' floors; the drop into the deep east of the Plaza; low dunes round. */
export function seabed(x, z) {
  let h = -0.6 + fbm(nS, x * 0.02, z * 0.02, 2) * 0.3;
  // the deep to the east: the floor falls away under the Whale Gallery (north of the canyon street's plain since #192)
  const east = smoothstep(46, 96, x) * smoothstep(-86, -100, z) * smoothstep(-200, -160, z);
  h -= east * 22;
  // the tube down to the Gallery runs in a cut under the slope (the bed kept a metre under its floor all the way)
  const g = TUBES_AT.gallery;
  if (x > g.x0 - 2 && x < g.x1 + 4 && Math.abs(z - g.z) < 9) h = Math.min(h, g.y0 + (g.y1 - g.y0) * Math.min(1, Math.max(0, (x - g.x0) / (g.x1 - g.x0))) - 1.4);
  // out of the city: dunes rising round it
  const out = Math.max(Math.hypot(x * 0.8, (z + 10) * 0.62) - 150, 0);
  h += smoothstep(0, 70, out) * (4 + fbm(nD, x * 0.012, z * 0.012, 3) * 5) + smoothstep(70, 220, out) * 22;
  // (issue #192: the canyon street's ramp, the canyon down the drop and the Gallery's shelf: src/underwater-canyon.js)
  h = canyonBed(x, z, h);
  // (and the tube down to the Gallery kept in its cut through them)
  if (x > g.x0 - 2 && x < g.x1 + 4 && Math.abs(z - g.z) < 9) h = Math.min(h, g.y0 + (g.y1 - g.y0) * Math.min(1, Math.max(0, (x - g.x0) / (g.x1 - g.x0))) - 1.4);
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
  // (issue #572: the sea port on the surface and the lift's shaft down to the Dock)
  if (p.y > SEA_Y - 2 && Math.hypot(p.x - SEA_PORT.x, p.z - SEA_PORT.z) < SEA_PORT.r + 4) return 'The sea port';
  if (p.y > D.dock.r * D.dock.sy - 1 && Math.hypot(p.x - SHAFT.x, p.z - SHAFT.z) < SHAFT.r + 1) return 'The lift to the sea port';
  if (near(D.dock)) return 'The Dock';
  if (near(D.garden)) return 'The kelp garden';
  if (near(D.gallery)) return 'The Whale Gallery';
  if (near(D.court)) return 'The divers’ court';
  if (near(D.plaza)) return 'The Plaza';
  if (near(D.avenue)) return 'The Avenue';
  // (out of the glass, in the helmet: issue #192)
  if (p.x > 88 && p.x < 125 && p.z < -22 && p.z > -86 && p.y > -19) return 'The canyon street';
  if (p.x > 118 && p.x < 195 && p.z < -30 && p.y < -24) return 'The canyon';
  if (p.x > 170 && p.x < 192 && p.z < -40 && p.z > -62) return 'The far wall';
  if (p.z < D.plaza.z - D.plaza.r + 4) return 'The tube to the Whale-House';
  return 'A glass tube';
}

// ------------------------------------------------------------------ content: the story page, the city's people
const pal = (cloak, extra = {}) => ({ cloak, lining: extra.lining ?? '#2b211f', ...extra });
export const UNDERWATER_CONTENT = {
  weather: [],
  // the world's page: opened on arrival, closed when the Whale-House's keeper is calmed (src/story/underwater.js)
  story: {
    title: 'THE SONG THROUGH THE GLASS',
    intro: 'A glass city on the sea floor. The whales no longer come to sing, and the glass hums one wrong note.',
    outro: 'The whales came back to the glass. Maelle says they sang the note the light sang, and then their own, and that the light went up, toward a city built down a well.',
    label: 'the Whale-House', goal: [WHALE_HOUSE.x, 0, WHALE_HOUSE.door + 6], radius: 10, verticalRadius: 6, manual: true,
  },
  // (one in each hall worth walking to: the Crown, the Gallery's rail, the Garden's trough, the café's dresser, the Dock's crane)
  npcs: [
    // Bastien keeps the Dock and its lock (the lift down from the sea port): he meets you at its foot, and points the way in
    // (v1.48, issue #101: the city's main quest is his, the wrong note in the glass: src/story/underwater-people.js)
    // (issue #572: by the lift's door, where it lets you out, turned to it)
    { ...UW_PEOPLE.bastien, at: [5.5, 118], y: 0, radius: 1.5, facing: -0.75, palette: pal('#3d6f78', { cloth: '#e3b06a' }), lang: 'underwater' },
    // (Coralie: the trace of the light that the world kept from its days as a detour, src/story/sightings-detours.js)
    { id: 'coralie', name: 'Coralie', title: 'who keeps the café', color: '#d97a5e', kind: 'f', at: [19, 37], y: 0, radius: 1, facing: -Math.PI / 2, palette: pal('#d97a5e', { cloth: '#efd2a6' }), lang: 'underwater',
      lines: ['~happy~ Come in, come in. It’s dry inside, it always is: the glass keeps the sea out.', '~playful~ Tea, or soup? Everything tastes a little of salt down here. We call it seasoning.'],
      talk: { listen: [
        { after: () => true, say: [
          '~neutral~ Years ago a woman from up top came in, too tired to take her coat off. She sat at that window all night, listening to the whales.',
          '~solemn~ One was singing something she knew, she said. She hummed it back to it. I didn’t know the tune. By lamp-up she was gone.',
        ], do: { set: { 'sight.underwater.coralie': true } } },
        '~happy~ Come in, come in. It’s dry inside, it always is: the glass keeps the sea out.',
        '~playful~ Tea, or soup? Everything tastes a little of salt down here. We call it seasoning.',
        '~neutral~ Her cup is still on the shelf. Nobody uses it. Nobody decided that; it just happened.',
        { after: { flag: 'temple.underwater.done' }, say: '~happy~ Listen. That’s them. The cups rattle when they sing close by. I had forgotten how much I liked it.' },
      ] } },
    // Brune grows glow-kelp in the Garden: her cutting goes up to Fabre in the Crown (src/story/underwater-people.js)
    { ...UW_PEOPLE.mireille, at: [D.garden.x + 8, D.garden.z - 6], y: 0, radius: 1.2, facing: Math.PI / 2, palette: pal('#5f8f7a', { cloth: '#efd2a6' }), lang: 'underwater' },
    // Fabre keeps the Crown's lamps, up the lift; he has never seen the sky
    { ...UW_PEOPLE.fabre, at: [-5, D.crown.z + 5], y: D.crown.y, radius: 1, facing: Math.PI, palette: pal('#e3b06a', { cloth: '#3a5f6a' }), lang: 'underwater' },
    // Maelle listens to the whales in the Gallery: the world's way into its temple (src/story/underwater-people.js)
    { ...UW_PEOPLE.maelle, at: [D.gallery.x + 4, D.gallery.z + 6], y: D.gallery.y, radius: 1, facing: Math.PI / 2, palette: pal('#2f8a8f', { cloth: '#f2c8a0' }), lang: 'underwater' },
    // the city's own, in passing
    { at: [-6, D.plaza.z + 16], y: 0, radius: 2, palette: pal('#e3b06a', { cloth: '#3a5f6a' }), lang: 'underwater', lines: ['~curious~ The column brings the air down from the top. Put your hand on it. You can feel the air moving inside.', '~playful~ I rode the lift to the Crown once. My ears went pop and I saw a fish the size of my house.'] },
    { at: [-8, 70], y: 0, radius: 2, palette: pal('#7a6e9e', { cloth: '#efd2a6' }), lang: 'underwater', lines: ['~neutral~ The Avenue’s the big dome. Cafés, lamps, people, the lot.', '~whisper~ Look up as you walk through the tube. Sometimes a manta goes over and the whole tube goes dark.'] },
    { at: [D.avenue.x - 30, D.avenue.z - 8], y: 0, radius: 2, palette: pal('#c4604a', { cloth: '#f2e6d0' }), lang: 'underwater', lines: ['~tired~ The kelp garden is through the west tube. Brune will put you to work.', '~happy~ Glow-kelp in the soup, glow-kelp on the lamps. It’s all glow-kelp down here.'] },
  ],
};

/** What the city's people say in passing (crowd.js), toned. */
export const CROWD_LINES = [
  '~neutral~ Mind the tube’s step. It’s wet when the glass sweats.',
  '~happy~ At midday the light comes all the way down through the domes. Look up!',
  '~curious~ You came down the lock? With just that little battery? Brave.',
  '~whisper~ If you sit still in the café you can hear the manta go over. A sort of hum.',
  '~playful~ My grandfather went up to the surface once. He said it was very bright and very dry and he did not care for it.',
  '~tired~ Hall to hall all day, carrying the post.',
  '~solemn~ The whales used to sing right against the glass. Now you only hear them far off.',
  // (issue #192: the seabed, the canyon street, the great pipes)
  '~curious~ You went out by the bells, in one of those helmets? My uncle did that. Once.',
  '~sad~ The great pipe in the Plaza used to play at noon. Now it only hums.',
  '~playful~ The canyon street has the best soup in the city. It’s a long way down for it.',
  '~neutral~ The cafés are dry inside. Wipe your feet, though.',
];

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildUnderwater(scene) {
  const rng = mulberry32(71001);
  // (the glass columns' bubbles: laid out once the frame's camera is final, those in view only, when the game says it
  // will call beforeDraw: underwater-kit.js glassColumns, issue #457)
  const bubbles = { later: false, sets: [] };
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
    // (its crown open round the lift's shaft from the sea port: src/underwater-port.js)
    dock: bigDome(kit, M, { ...D.dock, doors: [{ yaw: N, ...door }], floor: M.street, oculus: SHAFT.oculus }),
    avenue: bigDome(kit, M, { ...D.avenue, doors: [{ yaw: S, ...door }, { yaw: W, ...door }, { yaw: N, ...door }], ribs: 20, floor: M.street, seg: 64 }),
    garden: bigDome(kit, M, { ...D.garden, doors: [{ yaw: E, ...door }, { yaw: doorYaw(D.garden, D.court), ...door }], floor: M.pier }),
    plaza: bigDome(kit, M, { ...D.plaza, doors: [{ yaw: S, ...door }, { yaw: E, ...door }, { yaw: N, ...door }, { yaw: W, ...door }], ribs: 18, floor: M.streetPale, seg: 56 }),
    court: bigDome(kit, M, { ...D.court, doors: [{ yaw: E, ...door }, { yaw: doorYaw(D.court, D.garden), ...door }], ribs: 14, floor: M.pier, seg: 44 }),
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
    kit.add(M.streetPale, new THREE.RingGeometry(SHAFT.r + 2.2, SHAFT.r + 2.8, 48).rotateX(-Math.PI / 2).translate(SHAFT.x, 0.06, SHAFT.z), drawn);   // (a ring painted round the lift's foot)
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
    // what the Dock's first view looks across (the v1.46 game audit, issue #102: a bare tiled plaza between the ramp and the
    // long tube), either side of the way, none of it on it: DOCK_DRESSING
    const DR = DOCK_DRESSING;
    // a stripe painted from the lift's ring to the long tube's door, the way the lock-keepers walk a visitor in
    kit.add(M.streetPale, new THREE.PlaneGeometry(0.5, DR.stripe[0] - DR.stripe[1]).rotateX(-Math.PI / 2).translate(0, 0.07, (DR.stripe[0] + DR.stripe[1]) / 2), drawn);
    for (let z = DR.stripe[1] + 1.5; z < DR.stripe[0]; z += 4) kit.add(M.streetPale, new THREE.PlaneGeometry(1.6, 0.4).rotateX(-Math.PI / 2).translate(0, 0.07, z), drawn);
    // the divers' rack: two posts and a bar, three suits hung on it, helmets on a shelf, air tanks stood under it
    {
      const [x, z] = DR.rack;
      for (const e of [-1, 1]) kit.add(M.frame, new THREE.BoxGeometry(0.16, 2.6, 0.16).translate(x + e * 2.2, 1.3, z), solid);
      kit.add(M.frame, new THREE.BoxGeometry(4.6, 0.12, 0.12).translate(x, 2.45, z), drawn);
      kit.add(M.pier, new THREE.BoxGeometry(4.2, 0.08, 0.5).translate(x, 1.9, z - 0.2), drawn);
      for (const [i, dx] of [-1.4, 0, 1.4].entries()) {
        kit.add(M.suit, new THREE.CapsuleGeometry(0.26, 0.95, 3, 8).translate(x + dx, 1.62 - (i % 2) * 0.06, z + 0.12), drawn);   // (hung empty from the bar)
        kit.add(M.suit, new THREE.SphereGeometry(0.24, 10, 8).translate(x + dx + 0.3, 2.08, z - 0.2), drawn);   // (its helmet on the shelf)
        kit.add(M.bubble, new THREE.CircleGeometry(0.12, 10).translate(x + dx + 0.3, 2.08, z + 0.05), drawn);   // (the visor)
      }
      for (const dx of [-1.8, -1.2, 1.5]) kit.add(M.tank, new THREE.CylinderGeometry(0.17, 0.17, 0.9, 10).translate(x + dx, 0.45, z + 0.7), solid);
      kit.light(x, 2.4, z + 1, 5);
    }
    // the cargo off the last boat down: crates on a pallet, a drum, a coil of hose, a hand-cart stood by them
    {
      const [x, z] = DR.cargo;
      kit.add(M.pier, new THREE.BoxGeometry(3.4, 0.18, 2.4).translate(x, 0.09, z), solid);
      for (const [dx, dy, dz, s] of [[-0.8, 0.18, -0.4, 1.1], [0.6, 0.18, -0.3, 1.0], [-0.1, 0.18, 0.6, 0.9], [-0.5, 1.28, -0.35, 0.8]]) kit.add(M.rim, new THREE.BoxGeometry(s * 1.2, s, s).rotateY(dx * 0.4).translate(x + dx, dy + s / 2, z + dz), solid);
      kit.add(M.shell.pink, new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12).translate(x + 2.4, 0.55, z + 0.4), solid);
      kit.add(M.frame, new THREE.TorusGeometry(0.55, 0.12, 6, 16).rotateX(Math.PI / 2).translate(x - 2.3, 0.14, z + 0.9), drawn);
      kit.add(M.frame, new THREE.TorusGeometry(0.42, 0.12, 6, 16).rotateX(Math.PI / 2).translate(x - 2.3, 0.36, z + 0.9), drawn);
      // the hand-cart: a flat bed on two wheels, its handle up
      kit.add(M.frame, new THREE.BoxGeometry(1.2, 0.08, 0.8).translate(x + 1.2, 0.42, z + 2.0), drawn);
      for (const e of [-1, 1]) kit.add(M.post, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12).rotateZ(Math.PI / 2).translate(x + 1.2 + e * 0.62, 0.28, z + 2.0), drawn);
      kit.add(M.post, new THREE.BoxGeometry(0.06, 1.0, 0.06).rotateX(-0.5).translate(x + 1.2, 0.85, z + 2.55), drawn);
    }
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
    bubbles.sets.push(columns);
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
    kit.mover((t, at) => columns.update(t, at, bubbles.later));
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
    { x: -160, z: -208, h: 38, r: 6 }, { x: 170, z: -218, h: 34, r: 6 }, { x: 92, z: 40, h: 36, r: 5 }, { x: -92, z: 92, h: 34, r: 5 },
    { x: -136, z: -40, h: 40, r: 5 }, { x: 132, z: 24, h: 30, r: 4.5 }, { x: 148, z: -64, h: 52, r: 6.5 }, { x: -46, z: 170, h: 38, r: 5 },
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
  bubbles.sets.push(outCols);
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

  // ---------------------------------------------------------------- the way home from the Whale-House (v1.50, issue #132)
  // The keepers' hatch in the divers' court, where its way out comes up; the kelp tube south from the court's south door
  // to the garden's north door, a bed of tall kelp outside its glass and the old diving bell sunk in it: the divers'
  // last bell, its hose still running up toward the surface. Its own dice, built after the rest: the city keeps its own.
  const home = { hatch: [KEEPERS_HATCH.x, 0, KEEPERS_HATCH.z], bell: null };
  {
    const r2 = mulberry32(71077), [hx, , hz] = home.hatch;
    kit.add(M.frame, new THREE.TorusGeometry(1.15, 0.12, 6, 28).rotateX(Math.PI / 2).translate(hx, 0.06, hz), drawn);
    kit.add(M.rim, new THREE.CircleGeometry(1.05, 28).rotateX(-Math.PI / 2).translate(hx, 0.05, hz), drawn);
    for (let k = 0; k < 4; k++) kit.add(M.frame, new THREE.BoxGeometry(2.0, 0.05, 0.14).rotateY((k * Math.PI) / 4).translate(hx, 0.08, hz), drawn);
    kit.light(hx, 2.2, hz, 6);
    // the kelp bed either side of the tube, outside the glass
    const T = TUBES.kelp, A = new THREE.Vector3(...T.a), B = new THREE.Vector3(...T.b), side = new THREE.Vector3(B.z - A.z, 0, A.x - B.x).normalize();
    for (let i = 0; i < 16; i++) {
      const t = 0.08 + (i / 15) * 0.84, e = i % 2 ? 1 : -1, off = 9 + r2() * 9, p = A.clone().lerp(B, t).addScaledVector(side, e * off);
      kelp(kit, M, r2, [p.x, H(p.x, p.z), p.z], { n: 4 + Math.floor(r2() * 3), h: 8 + r2() * 7, spread: 2.2 });
    }
    // the diving bell, half sunk on the west side of the tube, two-fifths of the way down it, its portholes lit
    const b = A.clone().lerp(B, 0.42).addScaledVector(side, -14), by = H(b.x, b.z);
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.22, 0.6, -0.12)).setPosition(b.x, by + 1.0, b.z);
    kit.add(M.shell.pink, new THREE.CylinderGeometry(1.5, 2.1, 3.0, 18, 1, true).applyMatrix4(tilt), drawn);   // (out in the sea: nobody reaches it)
    kit.add(M.shell.pink, new THREE.SphereGeometry(1.5, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.5, 0).applyMatrix4(tilt), drawn);
    kit.add(M.frame, new THREE.TorusGeometry(2.1, 0.14, 6, 24).rotateX(Math.PI / 2).translate(0, -1.5, 0).applyMatrix4(tilt), drawn);
    kit.add(M.frame, new THREE.TorusGeometry(0.4, 0.1, 6, 12).rotateX(Math.PI / 2).translate(0, 3.05, 0).applyMatrix4(tilt), drawn);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; kit.add(M.windowLit, new THREE.CircleGeometry(0.32, 12).translate(0, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(a)).applyMatrix4(new THREE.Matrix4().makeTranslation(Math.sin(a) * 1.82, 0.4, Math.cos(a) * 1.82)).applyMatrix4(tilt), drawn); }
    // its hose, slack up toward the light
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.1, 0).applyMatrix4(tilt), new THREE.Vector3(b.x + 3, by + 9, b.z - 2), new THREE.Vector3(b.x + 1, by + 18, b.z - 6), new THREE.Vector3(b.x - 2, by + 26, b.z - 8)]);
    kit.add(M.post, new THREE.TubeGeometry(hose, 24, 0.12, 5), drawn);
    kit.light(b.x, by + 1.5, b.z, 7);
    home.bell = [b.x, by, b.z];
  }
  yield;

  // ---------------------------------------------------------------- the explorations (issue #192): the seabed, the canyon, the song
  // (each in a group and a kit of its own, sharing the city's materials, lights and movers; their own dice)
  const sub = (name) => {
    const g = new THREE.Group(); g.name = name; scene.add(g);
    const k = new RoomKit({ group: g, ground: terrain, centre: new THREE.Vector3(), seed: 1 });
    k.mats = kit.mats; k.lights = kit.lights; k.movers = kit.movers; k.noShadow = kit.noShadow;
    return k;
  };
  const kits = { canyon: sub('The canyon street'), seabed: sub('The walk on the seabed'), song: sub('The singing city'), port: sub('The sea port') };
  const canyon = buildCanyonStreet(kits.canyon, M, H);
  const ways = buildSeabedWalk(kits.seabed, M, H, { halls, galleryFloor: TERRACES.at(-1).y, rack: DOCK_DRESSING.rack });
  ways.bell(...[canyon.far.bell[0], canyon.far.bell[2]], canyon.far.bell[1]);   // (the far wall's terrace: a bell there too)
  const song = buildSingingCity(kits.song, M, halls);
  // the sea port on the surface over the Dock and the lift's shaft down into it (issue #572: src/underwater-port.js)
  const port = buildSeaPort(kits.port, M, { seaY: SEA_Y, dockTop: halls.dock.top });
  for (const k of Object.values(kits)) {
    k.finish();
    k.group.traverse((o) => { if (o.isMesh) { o.name ||= k.group.name; if (leavesOf(M).has(o.material)) o.userData.flora = true; } });
  }
  // the divers' cage: down from the bottom terrace to the canyon's floor and back (a doorway each way, as the lift is)
  const cage = [
    { at: new THREE.Vector3(CAGE.top[0], CAGE.top[1] + 0.6, CAGE.top[2]), r: 1.1, to: new THREE.Vector3(canyon.cage.foot[0] + 2.6, H(canyon.cage.foot[0] + 2.6, canyon.cage.foot[2]) + 0.1, canyon.cage.foot[2]), heading: Math.PI / 2, label: 'the divers’ cage down to the canyon’s floor' },
    { at: new THREE.Vector3(canyon.cage.foot[0], canyon.cage.foot[1] + 0.6, canyon.cage.foot[2]), r: 1.1, to: new THREE.Vector3(CAGE.top[0] - 2.6, CAGE.top[1] + 0.1, CAGE.top[2]), heading: -Math.PI / 2, label: 'the divers’ cage up to the street' },
  ];
  // the air: the halls and the tubes, the lift's shaft, and out in the sea the bells, the cafés down the street, the locks' drums
  const seaAir = (x, y, z) => air(x, y, z) || port.air(x, y, z) || ways.air(x, y, z) || canyon.cafes.some((c) => c.air(x, y, z));
  yield;

  // ---------------------------------------------------------------- the sea: its surface overhead; dry wherever you can go
  // (out of the glass you walk its bed in a helmet off the divers' rack, its air running down: swim.js `helmet`)
  // (open round the lift's shaft, so its surface is not drawn across the dry shaft: issue #572)
  const sea = seaSurface(kit, { y: SEA_Y, size: 1400, sea: { ...SEA_DAY, glass: true, helmet: { ...HELMET }, reach: 170, shafts: { ...SEA_DAY.shafts }, caustics: { ...SEA_DAY.caustics } }, air: seaAir, holes: [{ x: SHAFT.x, z: SHAFT.z, r: SHAFT.r }] });
  // life: mantas, schools of small fish, and the whales out in the deep (the Whale-House's change brings them to the glass)
  const near = { k: 0 };
  manta(kit, M, { at: [0, 34, 40], R: 70, w: 15, speed: 2.6, phase: 0.4, bank: 0.2 });
  manta(kit, M, { at: [40, 44, -60], R: 120, w: 19, speed: -3, phase: 2.2, bank: 0.15 });
  const cityLife = buildCityLife(kit, M);
  // (since #192 the two of the deep swim down in the canyon, long loops along it; calmed, they come up to the Gallery's
  // glass. A third passes overhead over the lip of the canyon and the end of the bells' walk, all the time: its shadow
  // goes over you)
  const whales = [
    // (calmed, the first comes right up to the glass, its flank a few metres off it: from 12 m off it was a shape in the
    //  dark water, and the climax's panels of it near empty: the cinematics QC v1.66, issue #295)
    whale(kit, M, { at: [153, -38, -120], R: 9, ez: 4.5, len: 22, speed: 2.2, phase: 0.3, near: () => near.k, come: 1, rise: 18, lift: 7, pull: [-10, 12], bob: 2 }),
    whale(kit, M, { at: [154, -48, -150], R: 8, ez: 5.5, len: 18, speed: -2.6, phase: 2.0, near: () => near.k, come: 1, rise: 22, pull: [-5, 24], bob: 2 }),
  ];
  const overhead = whale(kit, M, { at: [110, 32, -30], R: 28, ez: 2, len: 26, speed: 3, phase: 1.2, bob: 3, shadow: true });
  overhead.name = 'The whale overhead';
  yield;

  kit.finish();
  // (the plants on the decks and the kelp are walked through: flora, as the contact audit counts them)
  const leaves = leavesOf(M);
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

  // (in the Dock, the long tube ahead: where a load in the city puts you; the ship stands up on the sea port)
  const spawn = new THREE.Vector3(0, 0.05, 112);
  // over the side of the sea port into the sea: back on its deck by the lift's house (nobody swims here, and the sea
  // under the port is 80 m deep: issue #572)
  const deckSpot = new THREE.Vector3(...doorSpot('top', SHAFT.r + 3));
  deckSpot.y += 0.05;
  function rescue(p) {
    if (!p?.pos || p.down || !p.respawn) return;
    const q = p.pos;
    if (q.y > SEA_Y - 30 && q.y < SEA_PORT.y - 1.5 && Math.hypot(q.x - SEA_PORT.x, q.z - SEA_PORT.z) < SEA_PORT.r + 60 && !seaAir(q.x, q.y + 1, q.z)) {
      p.respawn(deckSpot);
      p.heading = 0;
    }
  }
  // Odette's Air-Shop under the Avenue's dome, east of the street, its door to it (src/shop-world.js 'bubble')
  const shop = placeShop(scene, { def: SHOPS.airshop, at: new THREE.Vector3(UW_SHOP.x, 0, UW_SHOP.z), heading: UW_SHOP.heading });
  kit.lights.push(...shop.lights);
  // the lift in the column: walked into at its foot in the Plaza, out at its head in the Crown, and back (src/passage.js)
  const up = new THREE.Vector3(0, 1, 0);
  const portals = [
    { at: new THREE.Vector3(LIFT.foot[0], 0.6, LIFT.foot[2]), r: 1.3, to: new THREE.Vector3(LIFT.head[0], D.crown.y + 0.1, LIFT.head[2] + 3.4), heading: 0, label: 'the lift up to the Crown', toUp: up, door: { at: new THREE.Vector3(LIFT.foot[0], 0, COLUMN.z + COLUMN.r + 0.45), yaw: 0, w: 2.2, h: 2.8 } },
    { at: new THREE.Vector3(LIFT.head[0], D.crown.y + 0.6, LIFT.head[2]), r: 1.3, to: new THREE.Vector3(LIFT.foot[0], 0.1, LIFT.foot[2] + 3.4), heading: 0, label: 'the lift down to the Plaza', toUp: up, door: { at: new THREE.Vector3(LIFT.head[0], D.crown.y, COLUMN.z + COLUMN.r + 1.1), yaw: 0, w: 2.2, h: 2.8 } },   // (on the booth's lit door, as the foot's: issue #391)
    // (issue #192: the locks out to the sea and back, and the divers' cage; the story says which want a helmet: src/story/underwater-ways.js)
    ...ways.locks.dock.portals, ...ways.locks.gallery.portals, ...cage,
  ];
  const level = {
    id: 'underwater',
    ground: terrain,
    spawn, spawnHeading: Math.PI, camYaw: 0, camPitch: 0.06,
    // (on the sea port's deck over the Dock, its hatch north toward the lift's house: issue #572. Until then it stood on the
    // Dock's dome outside the glass, and its ramp let you out into the sea with no way in)
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
    sea, halls, tubes, decks, cafes, air: seaAir, whales, cityLife, column: COLUMN, lift: LIFT,
    // (issue #572: the sea port and its lift; the cabin and its shut gates are moving solids)
    seaPort: port,
    dynamic: () => port.lift.solids(),
    // (the towers of pods out in the sea round the city: { x, z, h, r }; the fragments' places of interest, issue #250)
    podTowers: TOWERS,
    // (issue #192: the seabed walk, the canyon street, the singing city; the whale overhead)
    uw: { ways, canyon, song, overhead, cage },
    // the whales come to the glass once the Whale-House's keeper is calmed (src/temples/underwater.js change)
    whalesNear: (k) => { near.k = k; },
    // the first of them, the one that comes nearest the Gallery's glass, there (its loop's west end) `dt` s from now:
    // the climax films it passing (src/story/underwater-moments.js)
    whaleToGlass: (dt) => whales[0].userData.passAt?.(dt),
    // the great column over the Plaza and the towers of pods round the city, seen through the glass (the level design
    // audit's landmarks: the column's glass is see-through to the height grid; the Crown's bubble at its head)
    beacons: [{ name: 'the Breathing Tower', top: [COLUMN.x, D.crown.y + D.crown.r * D.crown.sy, COLUMN.z], height: 8 }, ...song.beacons, port.beacon],
    // the city's leading lines (the level design audit's `lines`; the audit sees through its glass since v1.43): the
    // sealed tubes, lamplit, hall to hall, and the street through the Avenue
    lines: [
      { name: 'the long tube and the west tube', points: [[0, 0, D.dock.z - 14], [0, 0, D.dock.z - D.dock.r], [0, 0, D.avenue.z + D.avenue.r], [0, 0, D.avenue.z], [D.avenue.x - D.avenue.r, 0, D.avenue.z], [D.garden.x + D.garden.r, 0, D.garden.z], [D.garden.x + 6, 0, D.garden.z]] },
      { name: 'the Avenue’s street to the Plaza', points: [[D.garden.x + 6, 0, D.garden.z], [D.avenue.x - D.avenue.r, 0, D.avenue.z], [0, 0, D.avenue.z], [0, 0, D.avenue.z - D.avenue.r], [0, 0, D.plaza.z + D.plaza.r], [0, 0, COLUMN.z + COLUMN.r + 2]] },
      { name: 'the tube down to the Whale Gallery', points: [[0, 0, COLUMN.z + COLUMN.r + 4], [D.plaza.x + D.plaza.r, 0, D.plaza.z], [D.gallery.x - D.gallery.r, D.gallery.y, D.gallery.z], [D.gallery.x, D.gallery.y, D.gallery.z]] },
      { name: 'the tube to the Whale-House', points: [[D.gallery.x, D.gallery.y, D.gallery.z], [D.gallery.x - D.gallery.r, D.gallery.y, D.gallery.z], [D.plaza.x + D.plaza.r, 0, D.plaza.z], [0, 0, D.plaza.z - D.plaza.r], [0, 0, WHALE_HOUSE.door + 2]] },
      { name: 'the city’s length, back to the Dock', points: [[0, 0, WHALE_HOUSE.door + 2], [0, 0, D.plaza.z - D.plaza.r], [0, 0, D.plaza.z + D.plaza.r], [0, 0, D.avenue.z - D.avenue.r], [0, 0, D.avenue.z + D.avenue.r], [0, 0, D.dock.z - D.dock.r], [LIFT_FOOT[0], 0, LIFT_FOOT[2]]] },
      // (v1.50, issue #132: home from the keepers' hatch, down the kelp tube to the garden and the west tube to the Avenue)
      // (issue #192: out by the divers' lock, bell to bell over the seabed, down the canyon street, in by the Gallery's lock)
      { name: 'the air bells', auto: false, points: [[DOCK_DRESSING.rack[0], 0, DOCK_DRESSING.rack[1] + 1.2], ...ways.line, canyon.line[0]] },
      { name: 'the canyon street', auto: false, points: [...canyon.line, ways.locks.gallery.portals[1].at.toArray(), ways.locks.gallery.portals[1].to.toArray(), [D.gallery.x + D.gallery.r - 4, D.gallery.y, D.gallery.z]] },
      { name: 'the kelp tube', auto: false, points: [home.hatch, TUBES.kelp.a, TUBES.kelp.b, [D.garden.x + 16, 0, D.garden.z - 12], [D.garden.x + D.garden.r, 0, D.garden.z], [D.avenue.x - D.avenue.r, 0, D.avenue.z], [0, 0, D.avenue.z], [0, 0, D.avenue.z + D.avenue.r], [0, 0, D.dock.z - D.dock.r], [LIFT_FOOT[0], 0, LIFT_FOOT[2]]] },
    ],
    sights: [
      { name: 'the moon pool', at: [POOL.x, 0, POOL.z] },
      { name: 'the window over the deep', at: [D.gallery.x + D.gallery.r - 4, D.gallery.y, D.gallery.z] },
      { name: 'the glow-kelp troughs', at: [D.garden.x - 2, 0, D.garden.z] },
      { name: 'the sunken diving bell', at: home.bell },
      { name: 'the keepers’ hatch', at: home.hatch },
      ...ways.sights, ...canyon.sights,
    ],
    atmo: (x, z, y) => { const n = placeAt({ x, y: y ?? 0, z }); return { tint: [1, 1, 1], fog: 0.6, name: n === 'A glass tube' && !seaAir(x, (y ?? 0) + 1, z) ? 'The seabed' : n }; },
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
        clear: [{ x: spawn.x, z: spawn.z, r: 6 }, { x: SHAFT.x, z: SHAFT.z, r: 9 }, { x: COLUMN.x, z: COLUMN.z + COLUMN.r + 2, r: 4 }] };
    },
    update(dt, t, ctx = {}) {
      bubbles.later = !!ctx.drawLater;
      for (const m of kit.movers) m(t, ctx.player?.pos ?? null);
      outCols.update(t, ctx.player?.pos ?? null, bubbles.later);
      ways.update(t); song.update(t, dt);
      port.update(dt, ctx.player ?? null);
      rescue(ctx.player);
      seaByHour();
    },
    /** The frame's camera final, before anything is drawn (main.js renderFrame, engine/game.js): the bubbles in view laid out. */
    beforeDraw(camera) { for (const b of bubbles.sets) b.draw(camera); },
  };
  // the Dock made a port: the pontoon ring on the dome's crown, pods round the city (issue #441, references/space-ports/underwater-city/sheet-1.jpg; src/levels/ports.js)
  attachPort(level, scene, UNDERWATER_PORT);
  return attachTempleDefinition('underwater', { def: UNDERWATER_TEMPLE, words: UNDERWATER_WORDS }, scene, level);
}
export const createUnderwater = stepped(buildUnderwater);

/** The materials walked through as plants (the contact audit's flora). */
const leavesOf = (M) => new Set(M.leaf);

/** How far (x, z) is from a tube's line, on the ground. */
function distToSeg(x, z, t) {
  const ax = t.a.x, az = t.a.z, dx = t.b.x - ax, dz = t.b.z - az, L2 = dx * dx + dz * dz || 1;
  const s = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
  return Math.hypot(x - ax - dx * s, z - az - dz * s);
}
