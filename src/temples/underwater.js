import { landmark } from './landmarks.js';
import { pearl, metal } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Glass, EchoEar, Dish, Mark, Pit, Key } from './pieces.js';
import { listenerModel } from './guardian-listener.js';
import { whaleHouseSkin } from './skins/whale-house.js';

// The Underwater City's temple: the Whale-House, the makers' sounding-house of shell and glass on the sea floor north
// of the Plaza, where the makers talked with the whales: a great whorled shell lying on the bed, brass horns curling
// out of it into the sea. The last glass tube runs from the Plaza to its door. The night the sky rang a light came
// down through the sea singing one note; the whales sang it back and went away, and since then something in the
// house has sung the light's note back at them whenever they come near, calling them off: the Listener, the makers'
// old shell-creature at its bottom, built to hear the whales from far off and answer them. It lives: you calm it.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: THE NOTE CROSSES WHAT YOU
// CANNOT. Your water stops at the glass; a note goes through glass and water, and the makers' dishes carry it on, but
// a dish only carries with a weight on its footstone, and a held note only rings a while. Before the horn the house
// is balls, plates and eyes, and you learn its glass from the wrong side; the whale-horn (src/items.js 'horn') sounds
// ONE fixed note, the deep one, and the house's ears that listen for it answer: the doors it holds only while it
// rings, the ear behind the tank's glass, the ear over the Listener's door that only hears the far dish.
//   the Porch             the first mark, the way out
//   the Sounding Hall     the hub, a hall 48 by 36 m under a great hung shell: a pillar in its west half, its eye lidded
//                         till the stone ball is rolled into the cradle at its foot (the west door); the east door's lamp
//                         that waits on the Pool Room's ball; the Horn Door on the north wall, two lamps on its lintel
//                         (one eye in each wing); the Listener's Door beside it and before it the Listener's column, its
//                         ear high on it beside a dish's mouth (seen from the first step, opened at the end from
//                         elsewhere); the keepers' door in the north wall's east end, shut from this side
//   the Pool Room         the west wing: a drawn pool of the sea behind a glass wall across its middle you can't climb;
//                         the pool's eye on a pillar out in the water, splashed over the glass; the stone ball rolled
//                         across the dry half into its cradle by the glass opens the east door, across the hall
//   the Shell Room        the east wing: a great whorled shell; a ball rolled to its plate unlids the shell's eye on the
//                         pillar before it
//   the Horn Chamber      a round hall 34 m across: the makers' chest on a shell pulpit (a riding disc beside it): the
//                         WHALE-HORN. A try by the pulpit: a little horn that answers the deep note, and nothing waits on
//                         it. By its north door the passage horn: the Song Passage's door at the passage's far end stays
//                         open only while it rings (`hold`): the horn's first lock, where a miss costs nothing
//   the Tank Hall         the sea let in behind a wall of glass nine metres tall down its middle; the shelf over it, and
//                         the ear on the shelf, seen through the water and far out of the horn's reach. A stone ball
//                         rolled onto the footstone of a dish in the middle of the floor wakes it; the horn sounded into
//                         it comes out of its twin on the shelf, the shelf's ear rings, and while it rings brass rungs
//                         come out of the glass's frame and you can climb it (the horn with the push, and the timing)
//   the Gallery of Horns  over the shelf: the makers' speaking-horns along the wall; its stair goes down to the keepers'
//                         landing behind the keepers' door: its horn opens the door onto the hall (the shortcut back), and
//                         the landing's dish, woken by a ball on its footstone, carries the horn's note to its twin on the
//                         Listener's column in the hall, where the ear hears it (the key decoupled from its lock)
//   the Horn Store        (v1.53, issue #23: off the Sounding Hall's south wall, the house's one fight) where the makers
//                         kept their spare horns, shells stacked in the corners; its door shuts behind you while its
//                         keepers stand among four columns. Won, the small key's cage sinks: the Song Passage's door takes
//                         it, a room past the chest, with its horn's note
//   the Throat            down from the Listener's Door, a long stair under the house
//   the Listener's Hall   the guardian (organic: its meter is calm). When it stops and spreads its great ear, sound the
//                         horn close by. From its second phase it shuts its ear to anything near it, and only the hall's
//                         dishes reach it: a ball on a dish's footstone, the horn into the dish while its ear is open. As
//                         it shifts into its last it knocks the balls off the footstones: roll one back
// (v1.77, issue #336: the house remade as shrines, docs/design/temple-redesign.md: every room 30 m across or more, every
// door 7 by 9 (DOOR), each puzzle in the middle of its room, the Horn Store the one fight; ROOMS.)
// After: the Listener sings the whales' own song again; the lamps in the Whale-House's horns are lit, its seams glow,
// and the whales come back to the glass (src/story/underwater.js draws them in: level.whalesNear).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/**
 * In the Underwater City (src/levels/underwater.js WHALE_HOUSE): on the sea floor north of the Plaza, at the end of the
 * last tube (TUBES.temple), its door at (0, 0, -178) facing south, down the tube toward the Plaza.
 */
export const SITE = { x: 0, z: -192, r: 16, heading: 0, door: -178 };
/**
 * The keepers' way out (v1.50, issue #132: the walk home from the door was the city's length back, 310 m the way you
 * came): once the Listener is calmed, the arena's way out lets you up through the keepers' hatch in the divers' court,
 * west of the Plaza, by its south door; the kelp tube runs on from there to the garden and home (src/levels/underwater.js).
 */
export const KEEPERS_HATCH = { x: -91, z: -95, heading: -0.19 };

/**
 * The Whale-House's colours: shell ivory in big smooth panels, a coral course under every frieze and at the foot, the
 * frames brass, a pale sand floor in plates, the fittings brass; the glyphs and the pieces' light the teal of the
 * water-light; a little whorled shell by every frieze glyph. Its shade a sea teal, its light the water's.
 */
export const PALETTE = {
  wall: '#e9dcc2', wall2: '#e2d3b6', wall3: '#efe4cd', floor: '#cdbf9f', floor2: '#c2b493', trim: '#b58a3e', fitting: '#c9973f',
  dark: '#24474f', stone: '#d8e6dc', accent: '#e0806a', glow: '#7fe0d6', glyph: '#5fc4bd', lamp: '#bff0e6', sand: '#d9cfb2', sand2: '#cbbf9f', void: '#163038',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.9, shade: 0.15, lampTint: ['#9fe6dc', 0.6] },
    wall: { mode: 0, grid: 3.2, plates: true },
    floor: { mode: 0, grid: 2.0, plates: true },
    trim: { metal: 'brass' },
    glyph: { glow: 0.55 },
  },
  bands: [{ at: 0.72, h: 0.8, color: '#e0806a' }, { y: 0.5, h: 0.6, color: '#3f8a8a' }],
  ornament: { kind: 'whorl', color: '#f4ead6', color2: '#e0806a' },
  light: { shadow: '#8fb3ac', light: '#f6f1e2', sun: '#e6f2ea' },
};

/** (v1.77, issue #336) Every door between two rooms, as the redesign's rules want them (docs/design/temple-redesign.md). */
export const DOOR = { w: 7, h: 9 };
/**
 * (v1.77, issue #336: the house as shrines) The rooms (local metres): the Sounding Hall (the hub, 48 by 36 m under 20),
 * its wings (30 m square under 18, the Pool Room's glass across its middle), the Horn Chamber's round hall (34 m across),
 * the Tank Hall (40 by 30 under 22: the glass, the tank and the shelf down its middle), the Gallery of Horns over the
 * shelf, the keepers' landing (30 m square under 20, behind the keepers' door: the gallery's room, its mark the first),
 * the Throat (from the Listener's Door down under the house) and the Listener's Hall.
 */
export const ROOMS = {
  hall: { w: 48, d: 36, h: 20 },
  wing: { w: 30, d: 30, h: 18, x: 43 },          // the Pool Room at -x, the Shell Room at +x
  glass: -46,                                    // the Pool Room's glass (x): the sea behind it, the pool's eye on a pillar in it
  horn: { r: 17, h: 18 },
  tank: { x0: -36, x1: 4, z0: 98, z1: 128, h: 22, gw: -12, ge: -6, shelf: 9 },
  gallery: { x: 18, z: 114, w: 20, d: 24, h: 12 },
  landing: { x: 29, z: 68.4, w: 30, d: 30, h: 20 },
};
// the rooms' places (local metres): the hub's middle, the Horn Chamber's, the keepers' door's x, the Throat's and the
// arena's x, floor and middle
const HZ = 32, HCX = -16, HCZ = 71, KX = 19.5, AX = 8, AY = -24, AZ = 122, AR = 18;
/** How long the horns hold their note (s): the passage's door, the tank's ear (the rungs). */
export const HOLD = { door: 10, rungs: 16 };
/** How much the horn calms it: close by in its first phase, through a dish in its second, in its last. */
export const CALM = { near: 0.12, dish: 0.11, last: 0.09 };
/** The dishes in the Listener's Hall (their near ends low on the wall, by the footstones). */
export const ARENA_DISHES = ['dishW', 'dishE'];
/** (in the skin) the great windows' glass, the deep sea blue behind it (src/temples/skins/whale-house.js) */
const SEA_GLASS = '#1d4f86';
const LISTEN = 14;   // m: how close to its ear a horn has to be, sounded straight at it

export const LOGIC = {
  id: 'underwater', entry: 'threshold', gadget: 'horn',
  // (each room's kind, issue #336: src/foes.js puts machines only in the combat room, the Horn Store)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, hall: { checkpoint: true, kind: 'puzzle' }, pools: { checkpoint: true, kind: 'puzzle' },
    shells: { checkpoint: true, kind: 'puzzle' }, horn: { checkpoint: true, kind: 'puzzle' }, tank: { checkpoint: true, kind: 'puzzle' },
    gallery: { checkpoint: true, kind: 'puzzle' }, store: { checkpoint: true, kind: 'combat' }, ante: { checkpoint: true, kind: 'passage' },
    arena: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'hall' },
    { a: 'hall', b: 'pools', door: 'd1' },        // the west door: its eye on a pillar, lidded until the hall's ball is in its cradle
    { a: 'hall', b: 'shells', door: 'd2' },       // the east door: the Pool Room's ball in its cradle
    { a: 'hall', b: 'horn', door: 'dH' },         // the Horn Door: an eye in each wing
    { a: 'horn', b: 'tank', door: 'd4' },         // the Song Passage's door, held while its horn rings (a room on from the chest)
    { a: 'hall', b: 'gallery', door: 'dK' },      // the keepers' door: the shortcut back, opened from the landing
    { a: 'tank', b: 'gallery', door: 'rungs' },   // the glass climbed while the shelf's ear rings
    { a: 'hall', b: 'store', door: 'dS' },        // the Horn Store, off the hall's south wall (v1.53): an arena, the small key
    { a: 'hall', b: 'ante', door: 'dL' },         // the Listener's Door: its ear hears only the landing's dish
    { a: 'ante', b: 'arena', door: 'dA' },
    { a: 'arena', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Sounding Hall: the stone ball into the cradle at the pillar's foot, and the pillar's eye unlids: the west door
    // (v1.77, issue #336: the west door once opened for the ball alone, and the east door's eye waited on the Pool
    // Room's ball, rolled out through its door and across the hall)
    b1: { type: 'drum', room: 'hall', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'hall' },
    eD: { type: 'switch', room: 'hall', when: { drumOn: ['b1', 'p1'] } },
    d1: { type: 'door', opens: { lit: 'eD' }, latch: true },
    // the Pool Room's ball, rolled across its floor into its cradle by the glass: the east door, across the hall
    b2: { type: 'drum', room: 'pools', plate: 'p2', plateAt: 1, start: 0 },
    p2: { type: 'plate', room: 'pools' },
    d2: { type: 'door', opens: { drumOn: ['b2', 'p2'] }, latch: true },
    // the Horn Door: the pool's eye over the glass, and the shell's eye, unlidded by the Shell Room's ball
    eP: { type: 'switch', room: 'pools' },
    bS: { type: 'drum', room: 'shells', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'shells' },
    eS: { type: 'switch', room: 'shells', when: { drumOn: ['bS', 'pS'] } },
    dH: { type: 'door', opens: { all: [{ lit: 'eP' }, { lit: 'eS' }] }, latch: true },
    chest: { type: 'gadget', room: 'horn', item: 'horn' },
    // the try by the pulpit: a little horn that answers the deep note (nothing waits on it)
    eT: { type: 'switch', room: 'horn', needs: ['horn'] },
    // the Song Passage: the door held while its horn rings; the ball whose groove runs under it, to the tank's dish
    e4: { type: 'switch', room: 'horn', needs: ['horn'], hold: HOLD.door },
    d4: { type: 'door', lock: 'small', opens: { lit: 'e4' } },     // (and since v1.53 the Horn Store's small key)
    b5: { type: 'drum', room: 'tank', plate: 'p5', plateAt: 1, start: 0 },
    p5: { type: 'plate', room: 'tank' },
    // the Tank Hall: the shelf's ear, through the dish (awake with the ball on its footstone), held: the glass's rungs
    e5: { type: 'switch', room: 'tank', needs: ['horn'], hold: HOLD.rungs, when: { drumOn: ['b5', 'p5'] } },
    rungs: { type: 'bridge', opens: { lit: 'e5' } },
    // the landing behind the keepers' door: its horn (the way back, v1.77: an eye shot once); its dish, woken by the
    // ball, to the ear on the Listener's column in the hall (heard there: its room the hall's, issue #336)
    eK: { type: 'switch', room: 'gallery', needs: ['horn'] },
    dK: { type: 'door', opens: { lit: 'eK' }, latch: true },
    bL: { type: 'drum', room: 'gallery', plate: 'pL', plateAt: 1, start: 0 },
    pL: { type: 'plate', room: 'gallery' },
    eL: { type: 'switch', room: 'hall', needs: ['horn'], when: { drumOn: ['bL', 'pL'] } },
    dL: { type: 'door', opens: { lit: 'eL' }, latch: true },
    // the Horn Store: its keepers beaten, the small key's cage sinks (v1.53)
    arH: { type: 'arena', room: 'store' },
    kS: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arH' } },
    dS: { type: 'door', opens: null },
    dA: { type: 'door', opens: null },                                   // the arena's door: shut while the Listener fights
    // the Listener's Hall: a ball on a dish's footstone (its last phase wants one there)
    bW: { type: 'drum', room: 'arena', plate: 'pW', plateAt: 1, start: 0 },
    pW: { type: 'plate', room: 'arena' },
    bE: { type: 'drum', room: 'arena', plate: 'pE', plateAt: 1, start: 0 },
    pE: { type: 'plate', room: 'arena' },
    listener: { type: 'boss', room: 'arena', needs: ['horn'], requires: { any: [{ drumOn: ['bW', 'pW'] }, { drumOn: ['bE', 'pE'] }] } },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

/**
 * (v1.53) The Horn Store, off the Sounding Hall's south wall east of the porch (an arena; v1.77: 30 m square under 18, a
 * short passage from the hall's door at `door`, its keepers round its middle among four columns).
 */
export const STORE = { x: 25, z: -5, w: 30, d: 30, h: 18, door: 16, zone: { min: [10, -1, -20], max: [40, 18, 10] } };

/** The Horn Store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arH', room: 'store', zone: STORE.zone, doors: ['dS'], extra: 2,
  shut: 'The door grinds shut behind you. Among the stacked shells, something stirs and sings.',
  won: 'The last of them falls quiet among the shells. The key’s cage sinks, and the door lets go.',
}];

export const LISTENER = {
  kind: 'organic', name: 'the Listener', final: 'touch', touch: 'lay a hand on its shell', speed: 1.4, wakeTime: 3.2,
  wake: 'A great shell heaves up, opens a vast ear, and sings the light’s note.',
  openHint: 'It stops, and its great ear spreads wide. It is listening.',
  weary: 'It sinks on its foot, its ear slack, humming low. Go to it.',
  resolved: 'The Listener hums the whales’ note back. Far off, something answers.',
  missHint: 'It rolls into the wall and lies there, its ear opening.',
  phases: [
    { to: 0.35, attacks: ['sweep', 'slam', 'pearl'], pause: 1.6, hint: 'When it stops and spreads its ear, sound the whale-horn close to it.' },
    { to: 0.65, attacks: ['song', 'pearls', 'sweep'], pause: 1.3, hint: 'It shuts its ear to you: weight a dish’s footstone, horn into the dish.' },
    { to: 0.9, attacks: ['roll', 'pearls', 'slam'], pause: 1.1, hint: 'Roll a stone back onto a footstone, then sound the horn into its dish.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    sweep: { shape: 'cone', range: 9, angle: 0.8, wind: 1.2, track: 0.6, part: 'arms', rig: 'coil', side: 1, parts: ['arms'], splash: 0.5, active: 0.35, reach: 5.5, gap: 0.6, damage: 0.75, knock: 10, recover: 0.5, then: 'sweep2' },
    sweep2: { shape: 'cone', range: 9, angle: 0.8, wind: 0.8, track: 0.5, part: 'arms', rig: 'coil', side: -1, link: true, parts: ['arms'], splash: 0.5, active: 0.35, reach: 5.5, damage: 0.75, knock: 10, gap: 0.3, then: 'call' },
    call: { shape: 'ring', at: 'self', radius: 5, wind: 1.1, part: 'mouth', rig: 'lean', pose: 'song', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 11, recover: 0.9, open: 4.4 },
    slam: { shape: 'ring', at: 'self', radius: 6, wind: 1.3, part: 'core', rig: 'rear', parts: ['body'], splash: 0.6, active: 0.35, blast: { kind: 'front', r0: 1, r1: 5.5, h: 0.6 }, reach: 5.5, damage: 0.75, knock: 11, recover: 0.8, open: 3.8 },
    pearl: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3, wind: 1.4, track: 0.6, part: 'mouth', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    pearls: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'mouth', rig: 'swell', pose: 'pearl', damage: 0.5, knock: 6, recover: 0.6 },
    song: { shape: 'ring', at: 'self', radius: 5, wind: 1.3, part: 'mouth', rig: 'lean', wave: { speed: 9, reach: 17, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 11, recover: 0.9, open: 4.6 },
    roll: { shape: 'lane', range: 16, width: 4.4, wind: 1.3, track: 0.65, part: 'feet', rig: 'crouch', dash: 10, parts: ['body'], splash: 0.3, active: 0.45, damage: 1, knock: 12, recover: 1.0, open: 2.6, miss: 3.4 },
  },
};

function listenerHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rocks it. It isn’t a thing to push: it is one to sing to.', 'ls.push'); return true; }
  g.rt.notice('The water runs off its shell. It is listening for a note.', 'ls.fluid');
  return true;
}

/**
 * (v1.53, issue #23) The Horn Store, off the Sounding Hall's south wall: an arena among the makers' spare horns and their
 * shells; won, the small key's cage sinks (for the Song Passage's door, past the chest, with its horn's note). (v1.77,
 * issue #336: the house's one fight, 30 m square, its keepers round its middle among four columns.)
 */
function store(rt, K, M, { brass, whorl }) {
  const add = (P, o) => rt.add(P, o);
  const S = STORE, x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, z0 = S.z - S.d / 2, z1 = S.z + S.d / 2;
  K.corridor([S.door, z1 + 0.6], [S.door, 13.4], 0, DOOR);   // (from its north wall to the hall's)
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: 0, h: S.h, roof: true, doors: [{ side: 'n', at: S.door - S.x, ...DOOR }] });
  add(Door, { id: 'dS', at: [S.door, 0, z1 + 0.6], ...DOOR });   // (open: it shuts behind you while they stand)
  // four columns to fight round; spare horns on racks along the east wall, shells stacked in the corners
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.column(S.x + sx * 8, S.z + sz * 8, 0, S.h, 0.9);
  for (const z of [S.z - 8, S.z - 3, S.z + 2, S.z + 7]) {
    K.both(brass, box(0.3, 2.6, 0.3, x1 - 1.2, 1.3, z));
    K.add(brass, T(lathe([[0.12, 0], [0.25, 0.6], [0.6, 1.1], [1.1, 1.4], [1.15, 1.45]], 14).rotateZ(-Math.PI / 2), [x1 - 1.6, 2.6, z]));
  }
  for (const [x, z] of [[x0 + 2.4, z0 + 2.4], [x0 + 2.6, z1 - 2.6], [x1 - 2.6, z0 + 2.4]]) whorl(x, 0, z, 0.9, 'all', 6);
  add(Key, { id: 'kS', at: [S.x, 0, z0 + 1.6], yaw: 0 });
  add(Mark, { room: 'store', at: [S.door, 0, z1 - 3], yaw: Math.PI, foes: [S.x, 0, S.z] });
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  // (in its futuristic skin, src/temples/skins/whale-house.js: the shells' chambers dark metal and brass orbs, the coral
  // rings and courses glowing aquamarine, the sea a deep blue; the same shapes, solids and places)
  const S = rt.skin?.mats;
  const ivory = S?.orb ?? { paint: new THREE.Color('#f4ead6'), smooth: true, side: THREE.FrontSide };
  const shellM = S?.orb ?? M.wall;
  const coral = S?.ring ?? pearl('#fa7356');
  const whorlBand = S?.orb2 ?? coral;   // (the shells' bands: brass in the skin)
  const brass = metal('#c9973f');
  const water = S?.sea ?? makeMaterial({ color: '#3f9aa6', glow: 0.35, flat: true, key: 'temple.underwater.water' });
  const deepM = S?.deep ?? makeMaterial({ color: '#2a6f86', glow: 0.25, flat: true, key: 'temple.underwater.deep' });
  /** A groove: a dark strip with brass rails (drawn). */
  const groove = (a, b, w = 1.0) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2, y = Math.min(a[1], b[1]);
    K.add(M.dark, T(new THREE.BoxGeometry(w, 0.04, L), [cx, y + 0.02, cz], [0, yaw, 0]));
    for (const s of [-1, 1]) K.add(brass, T(new THREE.BoxGeometry(0.14, 0.08, L), [cx + Math.cos(yaw) * s * (w / 2 + 0.1), y + 0.04, cz - Math.sin(yaw) * s * (w / 2 + 0.1)], [0, yaw, 0]));
  };
  /** A whorled shell (drawn, or solid: its three lowest chambers, or 'all' of them): chambers of ivory along a rising helix, coral bands. */
  const whorl = (x, y, z, s, solid = false, n = 9) => {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), a = i * 1.2, r = s * (1 - k * 0.8), rad = s * 0.55 * (1 - k * 0.7);
      const g = new THREE.SphereGeometry(r, 12, 8).scale(1, 0.82, 1).translate(x + Math.sin(a) * rad, y + r * 0.7 + k * s * 2.4, z + Math.cos(a) * rad);
      if (solid === 'all' || (solid && i < 3)) K.both(i % 2 ? ivory : shellM, g); else K.add(i % 2 ? ivory : shellM, g);
      if (i % 2 === 0 && i < n - 2) K.add(whorlBand, T(new THREE.TorusGeometry(r * 0.99, 0.06 * s, 3, 20), [x + Math.sin(a) * rad, y + r * 0.7 + k * s * 2.4, z + Math.cos(a) * rad], [Math.PI / 2 + 0.25, 0, a * 0.2]));
    }
  };
  /**
   * (v1.77) A pillar of shell-stone standing out in a room, a coral band at its top, an eye on its face toward `yaw`:
   * returns where the eye goes (on its face, at y).
   */
  const pillar = (x, z, h, y, yaw, base = 0) => {
    K.both(M.wall, box(1.6, h, 1.6, x, base + h / 2, z));
    K.both(M.trim, box(2.0, 0.4, 2.0, x, base + h + 0.2, z));
    K.add(coral, box(1.64, 0.5, 1.64, x, base + h - 0.9, z));
    return [x + Math.sin(yaw) * 0.82, y, z + Math.cos(yaw) * 0.82];
  };
  /** (v1.77) A dish standing out on the floor is solid as drawn: a disc as wide and as deep as its bowl (pieces.js Dish). */
  const dishSolid = ({ at, yaw = 0, tilt = 0, r }) => K.solid(T(new THREE.CylinderGeometry(r, r, r * 0.4, 16).rotateX(Math.PI / 2).translate(0, 0, r * 0.2), at, [tilt, yaw, 0], 1, 'YXZ'));
  /** (v1.77) A horn standing out on the floor (an EchoEar): its foot and its post solid as drawn. */
  const earSolid = ({ at, stand = 2.4, size = 1 }) => {
    K.solid(T(new THREE.CylinderGeometry(0.5 * size, 0.6 * size, 0.25, 12), [at[0], at[1] + 0.12, at[2]]));
    K.solid(T(new THREE.CylinderGeometry(0.16 * Math.sqrt(size), 0.22 * Math.sqrt(size), stand, 8), [at[0], at[1] + stand / 2, at[2]]));
  };
  /** An ear on its own post, solid. */
  const ear = (o) => { earSolid(o); return add(EchoEar, o); };
  /** A dish whose near end stands out on the floor, solid. */
  const dish = (o) => { dishSolid(o); return add(Dish, o); };
  const H = ROOMS.hall, Wg = ROOMS.wing, HX = H.w / 2, HZ0 = HZ - H.d / 2, HZ1 = HZ + H.d / 2;

  // ---- the Porch (z 0..12.8)
  K.hall({ x: 0, z: 6.4, w: 14, d: 12.8, y: 0, h: 11, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 7.2, 0.05], 1.5, 0);
  for (const s of [-1, 1]) whorl(s * 5.2, 0, 8.5, 0.7, true, 6);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 4], yaw: Math.PI / 2 });

  // ---- the Sounding Hall (x -24..24, z 14..50): the hub
  K.hall({ x: 0, z: HZ, w: H.w, d: H.d, y: 0, h: H.h, roof: true, doors: [
    { side: 's', ...DOOR }, { side: 'w', ...DOOR }, { side: 'e', ...DOOR }, { side: 's', at: STORE.door, ...DOOR },   // (and the Horn Store's, v1.53)
    { side: 'n', at: HCX, ...DOOR }, { side: 'n', at: AX, ...DOOR }, { side: 'n', at: KX, ...DOOR },
  ] });
  // the great shell hung from the roof (drawn), on brass chains; a whale's spiral inlaid in the floor under it
  whorl(0, 11.5, HZ - 1, 2.6, false, 9);
  for (const a of [0.4, 2.5, 4.6]) K.add(brass, T(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), [Math.sin(a) * 2.0, 17.4, HZ - 1 + Math.cos(a) * 2.0]));
  K.add(M.dark, T(annulus(5.2, 5.6, 0.04, 48), [0, 0.03, HZ]));
  K.add(coral, T(annulus(6.6, 6.8, 0.04, 48), [0, 0.035, HZ]));
  // the west door's eye, lidded, on a pillar in the hall's west half facing the door; the cradle at its foot and the ball
  add(Switch, { id: 'eD', at: pillar(-12, HZ - 2, 7.4, 6.5, -Math.PI / 2), yaw: -Math.PI / 2, size: 1.1, lids: true, wrong: 'The eye on the pillar stays lidded. The cradle at its foot is empty.' });
  groove([-3, 0, HZ - 6], [-12, 0, HZ - 6]);
  add(Ball, { id: 'b1', a: [-3, 0.04, HZ - 6], b: [-12, 0.04, HZ - 6], r: 1.0, lock: true });
  add(Plate, { id: 'p1', at: [-12, 0, HZ - 6], r: 1.2 });
  add(Door, { id: 'd1', at: [-HX - 0.6, 0, HZ], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'eD' }] });
  // the east door: its lamp waits on the Pool Room's ball
  add(Door, { id: 'd2', at: [HX + 0.6, 0, HZ], yaw: Math.PI / 2, ...DOOR, lamps: [{ drumOn: ['b2', 'p2'] }] });
  // the Horn Door: a lamp for each wing's eye
  add(Door, { id: 'dH', at: [HCX, 0, HZ1 + 0.6], ...DOOR, lamps: [{ lit: 'eP' }, { lit: 'eS' }] });
  // the Listener's Door, and before it the Listener's column: its ear high on it beside the mouth of a dish (the
  // landing's twin), seen from the first step
  add(Door, { id: 'dL', at: [AX, 0, HZ1 + 0.6], ...DOOR, lamps: [{ lit: 'eL' }] });
  const LC = [AX + 1.7, 41.6];   // (the column)
  K.column(LC[0], LC[1], 0, 10.1, 0.9);
  K.both(brass, box(6.0, 0.4, 1.8, LC[0], 10.3, LC[1]));   // (the bracket across its top: the ear at its west end, the dish at its east)
  K.add(coral, T(new THREE.TorusGeometry(1.0, 0.12, 4, 20), [LC[0], 9.4, LC[1]], [Math.PI / 2, 0, 0]));
  add(EchoEar, { id: 'eL', note: 'deep', lintel: true, at: [AX, 10.9, 41], yaw: Math.PI, size: 1.3, reach: 6,
    heard: 'High on the Listener’s column the far dish says the deep note, and the ear beside it answers. The door behind it sinks.' });
  // the keepers' door, shut from this side
  add(Door, { id: 'dK', at: [KX, 0, HZ1 + 0.6], ...DOOR, lamps: [{ lit: 'eK' }] });
  K.glyph([0, 14, HZ1 - 0.05], 2.0, Math.PI);
  add(Mark, { room: 'hall', at: [-8, 0, 17.5], yaw: Math.PI * 0.25 });

  // ---- the Pool Room (the west wing, x -58..-28): the sea behind a glass wall across its middle; the pool's eye on a
  // pillar out in the water; the ball for the east door's eye rolled down the dry half to its cradle
  const PX = -Wg.x, GX = ROOMS.glass, px0 = PX - Wg.w / 2;
  K.corridor([-HX - 0.6, HZ], [PX + Wg.w / 2 + 0.6, HZ], 0, DOOR);
  K.hall({ x: PX, z: HZ, w: Wg.w, d: Wg.d, y: 0, h: Wg.h, roof: true, doors: [{ side: 'e', ...DOOR }] });
  K.add(water, box(GX - px0 - 0.4, 0.1, Wg.d - 0.4, (px0 + GX) / 2, 0.08, HZ));
  K.add(deepM, box(GX - px0 - 0.4, 3.6, 0.1, (px0 + GX) / 2, 1.9, HZ - Wg.d / 2 + 0.25));
  K.solid(box(0.3, 4.2, Wg.d, GX, 2.1, HZ));
  const poolGlass = add(Glass, { at: [GX + 0.05, 0, HZ], yaw: Math.PI / 2, w: Wg.d - 0.4, h: 4.2, color: S ? SEA_GLASS : '#bfe4e6', slip: 'The glass is too smooth to hold, and the sea is on the other side of it.' });
  add(Switch, { id: 'eP', at: pillar(PX - 8, HZ, 7.6, 6.6, Math.PI / 2), yaw: Math.PI / 2, size: 1.2 });
  // (its cradle by the glass: the east door's)
  const B2 = [[PX + 9, 0, HZ - 8], [PX - 1, 0, HZ + 2]];
  groove(...B2);
  add(Ball, { id: 'b2', a: [B2[0][0], 0.04, B2[0][2]], b: [B2[1][0], 0.04, B2[1][2]], r: 1.0, friction: 0.9, lock: true });
  add(Plate, { id: 'p2', at: B2[1], r: 1.2 });
  // shelves of shells along the north wall (drawn)
  for (let i = 0; i < 5; i++) { K.both(brass, box(1.6, 0.15, 0.6, GX + 2.4 + i * 2.4, 2.2, HZ + Wg.d / 2 - 0.4)); whorl(GX + 2.4 + i * 2.4, 2.3, HZ + Wg.d / 2 - 0.4, 0.32, false, 5); }
  add(Mark, { room: 'pools', at: [PX + 12, 0, HZ - 7], yaw: Math.PI / 2 });

  // ---- the Shell Room (the east wing, x 28..58): a great whorled shell; a ball to its plate unlids the shell's eye on
  // the pillar before it
  const SX = Wg.x;
  K.corridor([HX + 0.6, HZ], [SX - Wg.w / 2 - 0.6, HZ], 0, DOOR);
  K.hall({ x: SX, z: HZ, w: Wg.w, d: Wg.d, y: 0, h: Wg.h, roof: true, doors: [{ side: 'w', ...DOOR }] });
  whorl(SX + 5, 0, HZ - 4, 2.4, 'all', 9);
  add(Switch, { id: 'eS', at: pillar(SX - 0.5, HZ - 6.5, 6.4, 5.6, -Math.PI / 2), yaw: -Math.PI / 2, size: 1.2, lids: true, wrong: 'The shell’s eye stays lidded. Its plate is bare.' });
  groove([SX - 8, 0, HZ + 7], [SX + 8, 0, HZ + 7]);
  add(Ball, { id: 'bS', a: [SX - 8, 0.04, HZ + 7], b: [SX + 8, 0.04, HZ + 7], r: 1.0, lock: true });
  add(Plate, { id: 'pS', at: [SX + 8, 0, HZ + 7], r: 1.2 });
  add(Mark, { room: 'shells', at: [SX - 12, 0, HZ - 7], yaw: -Math.PI / 2 });

  // ---- the Horn Chamber (a round hall 34 m across round (HCX, HCZ)): the chest on a shell pulpit, a riding disc beside
  // it; the try; the passage horn by the north door, which holds the Song Passage's door while it rings
  const HR = ROOMS.horn.r;
  K.corridor([HCX, HZ1 + 0.6], [HCX, HCZ - HR - 1.0], 0, DOOR);
  K.rotunda({ x: HCX, z: HCZ, y: 0, r: HR, h: ROOMS.horn.h, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0 });
  const PT = 3.0;   // the pulpit's top
  K.both(M.wall, lathe([[2.4, 0], [2.0, 0.6], [1.5, PT - 0.6], [2.3, PT - 0.15], [2.3, PT], [0.01, PT]], 20).translate(HCX, 0, HCZ), new THREE.CylinderGeometry(2.2, 2.3, PT, 20).translate(HCX, PT / 2, HCZ));
  K.add(coral, T(new THREE.TorusGeometry(2.25, 0.1, 4, 28), [HCX, PT - 0.1, HCZ], [Math.PI / 2, 0, 0]));
  add(Platform, { path: [[HCX + 4.4, 0.3, HCZ], [HCX + 4.4, PT, HCZ]], r: 1.7, speed: 1.2, pause: 1.6 });
  K.add(M.dark, T(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 24), [HCX + 4.4, 0.04, HCZ]));
  ear({ id: 'eT', note: 'deep', at: [HCX - 5.2, 0, HCZ + 2.2], yaw: Math.PI / 2 + 0.4, stand: 1.8, size: 0.8, reach: 6,
    heard: 'The little horn by the pulpit takes the deep note and hums it back. The whorls round the chamber’s wall glow a moment. Nothing opens: it only answers.' });
  for (const a of [0.9, 2.2, 4.1, 5.4]) whorl(HCX + Math.sin(a) * (HR - 2), 0, HCZ + Math.cos(a) * (HR - 2), 0.8, 'all', 6);
  ear({ id: 'e4', note: 'deep', at: [HCX + 1.5, 0, HCZ + 9.5], yaw: Math.PI + 0.3, stand: 2.2, reach: 6,
    heard: 'The horn by the north door takes the deep note and holds it, and down the passage the door sinks, as long as it rings.',
    fading: 'The passage horn’s note is fading: the door will rise.' });
  add(Mark, { room: 'horn', at: [HCX + 5, 0, HCZ - 9], yaw: -Math.PI * 0.75 });

  // ---- the Song Passage (from the chamber's north door to the tank hall's): its door at the far end, held while the
  // horn by the north door rings
  const TK = ROOMS.tank, TZ = (TK.z0 + TK.z1) / 2, TX = (TK.x0 + TK.x1) / 2, GW = TK.gw, GE = TK.ge, SH = TK.shelf;
  K.corridor([HCX, HCZ + HR + 1.0], [HCX, TK.z0 - 0.6], 0, DOOR);
  add(Door, { id: 'd4', at: [HCX, 0, TK.z0 - 0.6], ...DOOR, lamps: [{ lit: 'e4' }] });
  for (const s of [-1, 1]) whorl(HCX + s * 3.0, 0, HCZ + HR + 4.6, 0.45, 'all', 5);

  // ---- the Tank Hall (x -36..4, z 98..128): the sea let in behind nine metres of glass down its middle; the shelf over it
  K.hall({ x: TX, z: TZ, w: TK.x1 - TK.x0, d: TK.z1 - TK.z0, y: 0, h: TK.h, roof: true, doors: [{ side: 's', at: HCX - TX, ...DOOR }, { side: 'e', at: 5, y0: SH, ...DOOR }] });
  K.add(water, box(GE - GW - 0.2, SH - 0.4, TK.z1 - TK.z0 - 0.2, (GW + GE) / 2, (SH - 0.4) / 2, TZ));
  // (the glass: the house's one climb, held only while its rungs are out, the Glass piece slipping you off it till then;
  // its other walls are not climbed, issue #115)
  K.climbable('the Tank Hall\'s glass: its brass rungs, out while the shelf\'s ear rings, up to the shelf', () => K.solid(box(0.3, SH, TK.z1 - TK.z0, GW, SH / 2, TZ)));
  const tankGlass = add(Glass, { id: 'rungs', at: [GW - 0.05, 0, TZ], yaw: -Math.PI / 2, w: TK.z1 - TK.z0 - 0.4, h: SH, color: S ? SEA_GLASS : '#bfe4e6', rungs: true, when: { lit: 'e5' },
    slip: 'The tank’s glass is too smooth to hold. Its brass frame has slots all the way up, empty.' });
  K.both(brass, box(GE - GW + 0.2, 0.3, TK.z1 - TK.z0, (GW + GE) / 2, SH - 0.15, TZ));   // (the tank's lid: a brass grating)
  K.both(M.wall, box(TK.x1 - GE, SH - 0.8, TK.z1 - TK.z0, (GE + TK.x1) / 2, (SH - 0.8) / 2, TZ));   // (under the shelf: solid)
  K.slab(GE, TK.z0, TK.x1, TK.z1, SH, 0.8);
  // a whale drawn in the tank's water, in the makers' brass line (the house's sign)
  K.add(deepM, T(new THREE.SphereGeometry(1, 14, 8).scale(0.6, 1.4, 6), [(GW + GE) / 2, 4.2, TZ + 1]));
  K.add(deepM, T(new THREE.BoxGeometry(0.3, 0.5, 3.2), [(GW + GE) / 2, 4.2, TZ - 6.6], [0, 0, 0]));
  // the ball, its footstone and the near dish in the middle of the floor; its twin on the shelf beside the shelf's ear
  groove([GW - 15, 0, TZ - 7], [GW - 3, 0, TZ - 7]);
  add(Ball, { id: 'b5', a: [GW - 15, 0.04, TZ - 7], b: [GW - 3, 0.04, TZ - 7], r: 1.0, lock: true });
  add(Plate, { id: 'p5', at: [GW - 3, 0, TZ - 7], r: 1.2 });
  dish({ id: 'dishT', at: [GW - 5.6, 3.0, TZ - 3.8], yaw: Math.PI / 2, tilt: 0.1, r: 2.2, when: { drumOn: ['b5', 'p5'] },
    to: { at: [GE + 2.6, SH + 2.6, TZ - 5.4], yaw: -Math.PI / 2, tilt: 0.1, r: 2.2 },
    dark: 'The dish by the glass is dark and deaf: its footstone is bare. Something heavy has to stand on it.' });
  K.both(brass, T(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), [GW - 5.6 - 0.3, 0.7, TZ - 3.8]));   // (the dish's post)
  ear({ id: 'e5', note: 'deep', at: [GE + 1.4, SH, TZ - 1], yaw: -Math.PI / 2, stand: 2.4, size: 1.2, reach: 7,
    heard: 'Across the water the far dish says the deep note, and the shelf’s ear takes it and holds it. Brass rungs slide out of the glass’s frame, as long as it rings.',
    fading: 'The shelf’s ear is fading: the rungs will slide back.' });
  add(Mark, { room: 'tank', at: [HCX - 6, 0, TK.z0 + 3], yaw: Math.PI / 2 });
  // (the skin's lit edges along the foot and the head of the two great windows, on their dry side: its middle, along, out)
  // (the skin's great windows: their frames, their sea; each its foot's middle, along, length, height, into the room)
  if (rt.skin) rt.skinGlass = [
    { a: [GW, 0, TZ], along: [0, 0, 1], L: TK.z1 - TK.z0 - 0.4, h: SH, out: [-1, 0, 0], glass: tankGlass, header: false },
    { a: [GX, 0, HZ], along: [0, 0, 1], L: Wg.d - 0.4, h: 4.2, out: [1, 0, 0], glass: poolGlass },
  ];
  for (const [x, z] of [[TK.x0 + 2.5, TK.z0 + 8], [TK.x0 + 2.5, TK.z1 - 8]]) whorl(x, 0, z, 0.8, 'all', 6);

  // ---- the keepers' landing (x 14..44, z 53.4..83.4, behind the keepers' door): its horn (the way back), its ball and
  // dish in the middle of the floor, the dish's twin on the Listener's column in the hall
  const LD = ROOMS.landing, LZ0 = LD.z - LD.d / 2, LZ1 = LD.z + LD.d / 2, GY = ROOMS.gallery;
  const stairX = 20;
  K.corridor([KX, HZ1 + 0.6], [KX, LZ0 - 0.6], 0, DOOR);
  K.hall({ x: LD.x, z: LD.z, w: LD.w, d: LD.d, y: 0, h: LD.h, roof: true, doors: [{ side: 's', at: KX - LD.x, ...DOOR }, { side: 'n', at: stairX - LD.x, ...DOOR }] });
  add(Mark, { room: 'gallery', at: [KX - 1, 0, LZ0 + 4], yaw: 0 });
  ear({ id: 'eK', note: 'deep', at: [LD.x + 4, 0, LZ0 + 11], yaw: -Math.PI * 0.7, stand: 2.2, reach: 6,
    heard: 'The landing’s horn takes the deep note, and across the landing the keepers’ door sinks into the floor.' });
  // (its footstone in the landing's south-west quarter: under 20 m from the Listener's Door, through the wall)
  const BL = [[LD.x, 0, LZ0 + 7], [KX + 1, 0, LZ0 + 7]];
  groove(...BL);
  add(Ball, { id: 'bL', a: [BL[0][0], 0.04, BL[0][2]], b: [BL[1][0], 0.04, BL[1][2]], r: 0.9, lock: true });
  add(Plate, { id: 'pL', at: BL[1], r: 1.1 });
  const DL = [KX + 5.1, 3.0, LZ0 + 4.4];
  dish({ id: 'dishL', at: DL, yaw: -Math.PI / 2, tilt: 0.15, r: 1.8, when: { drumOn: ['bL', 'pL'] },
    to: { at: [LC[0] + 1.7, 11.2, LC[1]], yaw: Math.PI, tilt: 0.35, r: 2.0 },
    dark: 'The landing’s dish is dark and deaf: its footstone is bare.' });
  K.both(brass, T(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 8), [DL[0] + 0.3, 0.8, DL[2]]));   // (the dish's post)
  for (const [x, z] of [[LD.x - 12.4, LZ1 - 2.6], [LD.x + 12.4, LZ0 + 2.6]]) whorl(x, 0, z, 0.9, 'all', 6);

  // ---- the keepers' stair: up from the landing's north door to the Gallery of Horns over the shelf
  const S0 = LZ1 + 0.6, S1 = GY.z - GY.d / 2 - 0.6;
  K.slab(stairX - 3.8, S0, stairX + 3.8, S0 + 1, 0, 0.8);
  K.stairs([stairX, 0, S0 + 1], [stairX, SH, S1 - 1], DOOR.w, { sides: false });
  K.slab(stairX - 3.8, S1 - 1, stairX + 3.8, S1, SH, 0.8);
  K.wall(stairX - 4.2, S0, stairX - 4.2, S1, 0, SH + 10.6, { t: 0.8 }); K.wall(stairX + 4.2, S1, stairX + 4.2, S0, 0, SH + 10.6, { t: 0.8 });
  K.slab(stairX - 4.6, S0, stairX + 4.6, S0 + 1, 10.6, 0.8);
  K.ramp([stairX, 10.6, S0 + 1], [stairX, SH + 10.6, S1 - 1], 9.2, { t: 0.8 });
  K.slab(stairX - 4.6, S1 - 1, stairX + 4.6, S1, SH + 10.6, 0.8);

  // ---- the Gallery of Horns (x 8..28, z 102..126, floor 9): the makers' speaking-horns, over the shelf
  K.corridor([TK.x1 + 0.6, TZ + 5], [GY.x - GY.w / 2 - 0.6, TZ + 5], SH, DOOR);
  K.hall({ x: GY.x, z: GY.z, w: GY.w, d: GY.d, y: SH, h: GY.h, roof: true, doors: [{ side: 'w', at: TZ + 5 - GY.z, ...DOOR }, { side: 's', at: stairX - GY.x, ...DOOR }] });
  const gx1 = GY.x + GY.w / 2, gz1 = GY.z + GY.d / 2;
  for (let i = 0; i < 5; i++) {
    const z = GY.z - 9 + i * 4.5;
    K.both(brass, T(new THREE.CylinderGeometry(0.18, 0.24, 2.4, 8), [gx1 - 1.2, SH + 1.2, z]));
    K.add(brass, T(lathe([[0.15, 0], [0.3, 0.7], [0.7, 1.3], [1.3, 1.6], [1.35, 1.65]], 14).rotateZ(Math.PI / 2), [gx1 - 0.9, SH + 2.9, z]));
  }
  K.add(deepM, box(10, 5, 0.1, GY.x, SH + 5, gz1 - 0.05));   // (a window of the sea in the north wall)
  for (let i = 0; i <= 5; i++) K.add(M.trim, box(0.14, 5.2, 0.2, GY.x - 5 + i * 2, SH + 5, gz1 - 0.1));
  add(Mark, { room: 'gallery', at: [GY.x - 7, SH, TZ + 1], yaw: Math.PI / 2 });

  // ---- the Throat: from the Listener's Door down a long stair under the house to its hall (7 m wide, 10 m high)
  const T0 = HZ1 + 0.6, T1 = 53, T2 = 95, fy = (z) => (z <= T1 ? 0 : AY * Math.min(1, (z - T1) / (T2 - T1)));
  K.slab(AX - 4.2, T0, AX + 4.2, T1, 0, 0.8);
  K.stairs([AX, 0, T1], [AX, AY, T2], DOOR.w, { sides: false });
  for (let i = 0; i < 8; i++) {
    const za = T0 + ((T2 - T0) * i) / 8, zb = T0 + ((T2 - T0) * (i + 1)) / 8, y0 = fy(zb) - 0.8, y1 = fy(za) + 11;
    K.wall(AX - 4.2, za, AX - 4.2, zb, y0, y1 - y0, { t: 0.8 }); K.wall(AX + 4.2, zb, AX + 4.2, za, y0, y1 - y0, { t: 0.8 });
  }
  K.slab(AX - 4.6, T0, AX + 4.6, T1, 11, 0.8);
  K.ramp([AX, 11, T1], [AX, AY + 11, T2], 9.2, { t: 0.8 });
  for (let z = 58; z < 92; z += 6) for (const s of [-1, 1]) whorl(AX + s * 3.0, fy(z), z, 0.3, 'all', 5);
  // the antechamber: the stair's foot, to the Listener's door
  K.corridor([AX, T2], [AX, AZ - AR - 0.6], AY, { ...DOOR, h: 9.6 });
  add(Mark, { room: 'ante', at: [AX + 1.8, AY, T2 + 3], yaw: -Math.PI / 2 });
  add(Door, { id: 'dA', at: [AX, AY, AZ - AR - 0.7], ...DOOR });

  // ---- the Listener's Hall (a rotunda round (AX, AY, AZ)): its pool, the dishes on the wall, their footstones and balls
  K.rotunda({ x: AX, z: AZ, y: AY, r: AR, h: 18, seg: 36, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0 });
  K.add(water, T(new THREE.CylinderGeometry(6.5, 6.5, 0.06, 40), [AX, AY + 0.04, AZ + 4]));
  K.add(coral, T(annulus(6.5, 7.0, 0.08, 48), [AX, AY + 0.06, AZ + 4]));
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'W' : 'E';
    groove([AX + s * 8.5, AY, AZ + 4], [AX + s * 14.6, AY, AZ + 4]);
    add(Ball, { id: `b${id}`, a: [AX + s * 8.5, AY + 0.04, AZ + 4], b: [AX + s * 14.6, AY + 0.04, AZ + 4], r: 1.0, friction: 1.2 });
    add(Plate, { id: `p${id}`, at: [AX + s * 14.6, AY, AZ + 4], r: 1.2 });
    add(Dish, { id: `dish${id}`, at: [AX + s * 16.9, AY + 2.8, AZ + 4], yaw: s < 0 ? Math.PI / 2 : -Math.PI / 2, tilt: 0.1, r: 1.8, when: { drumOn: [`b${id}`, `p${id}`] },
      to: { at: [AX + s * 6, AY + 8.6, AZ + AR - 1.4], yaw: Math.PI, tilt: 0.45, r: 2.2 },
      dark: 'The dish on the wall is dark and deaf: its footstone is bare.' });
  }
  for (const a of [0.6, 2.3, 3.9, 5.6]) whorl(AX + Math.sin(a) * (AR - 2), AY, AZ + Math.cos(a) * (AR - 2), 1.0, 'all', 6);
  add(Door, { id: 'd5', at: [AX, AY, AZ + AR + 0.7], ...DOOR, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door, issue #356)
  const E0 = AZ + AR + 0.6, E1 = AZ + AR + 10;
  K.slab(AX - 4.2, E0, AX + 4.2, E1, AY, 0.8);
  K.wall(AX - 4.2, E0 + 0.8, AX - 4.2, E1, AY, 10, { t: 0.8 }); K.wall(AX + 4.2, E1, AX + 4.2, E0 + 0.8, AY, 10, { t: 0.8 });
  K.wall(AX + 4.2, E1, AX - 4.2, E1, AY, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, 9.4, AX, AY + 10.4, E0 + 5.1));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [AX, AY, E1 + 0.5]));
  K.solid(box(4, 5, 0.1, AX, AY + 2.5, E1 + 0.5));

  const model = listenerModel();
  model.pos.copy(K.world(AX, AY, AZ + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(AX, AY, AZ + 8);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(AX, AY, AZ), r: AR, y: K.world(0, AY, 0).y };

  // (the wing last: its mark after the others)
  store(rt, K, M, { brass, whorl });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-62, AY - 4, STORE.z - STORE.d / 2 - 3), V(62, 32, E1 + 2)),
    gadget: { at: W(HCX, PT, HCZ).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(AX, AY + 0.5, E1 - 0.4), r: 1.5, to: V(KEEPERS_HATCH.x, 0.1, KEEPERS_HATCH.z), heading: KEEPERS_HATCH.heading }],
    lights: [[0, 6, 6, 12], [0, 13, HZ, 30], [AX, 6, 42, 14], [-Wg.x, 9, HZ, 22], [Wg.x, 9, HZ, 22], [HCX, 9, HCZ, 20], [HCX, 5, 93, 10], [-24, 11, TZ, 24], [-1, 14, TZ, 16],
      [GY.x, 15, GY.z, 18], [STORE.x, 9, STORE.z, 22], [LD.x, 10, LD.z, 22], [AX, -8, 72, 16], [AX, AY + 5, T2 + 3, 12], [AX, AY + 9, AZ, 30]],
    guardian: { def: { ...LISTENER, onHit: listenerHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the sounding-house on the sea floor
function exterior(scene, level, rt) {
  const K = new TempleKit(rt.root, 'The Whale-House', V(SITE.x, 0, SITE.z), 0, rt.M);
  const M = rt.M;
  const ivory = pearl('#fff2d3');
  const coral = pearl('#fa7356');
  const teal = { paint: new THREE.Color('#3f8a8a'), smooth: false, side: THREE.FrontSide };
  const brass = metal('#c9973f');
  const dark = { paint: new THREE.Color('#1f3d44'), smooth: false, side: THREE.DoubleSide };
  const DZ = SITE.door - SITE.z, FZ = DZ - 0.3;   // the door (local z 14) and the facade's face (13.7: it seals the tube's end)
  // The approach tube enters a small coral throat at the foot of the immense open mouth.
  for (const sign of [-1,1]) K.both(coral,new THREE.SphereGeometry(1,20,16).scale(2.8,5.8,3.1).translate(sign*4.8,4.2,FZ-.8));
  K.both(coral,new THREE.SphereGeometry(1,24,12).scale(5.8,2.5,3.1).translate(0,8.4,FZ-.8));
  K.add(M.glyph,T(glyphGeometry(1.1,.14),[0,9.1,FZ+2.2]));
  K.add(M.voidM,T(new THREE.PlaneGeometry(4.4,6.6).translate(0,3.3,0),[0,0,FZ-.9]));
  K.solid(box(4.4,6.6,.1,0,3.3,FZ-.9));
  landmark(K, 'underwater', { R: 14 });
  // the ear to the deep: a conch's mouth at its back, facing north, dark inside, ringed in coral
  K.add(ivory, T(lathe([[1.5, 0], [2.4, 1.6], [4.2, 3.0], [6.0, 3.7], [6.3, 3.9]], 24).rotateX(-Math.PI / 2), [0, 6, -17]));
  K.add(dark, T(new THREE.CircleGeometry(5.6, 24), [0, 6, -20.2], [0, Math.PI, 0]));
  K.add(coral, T(new THREE.TorusGeometry(6.2, 0.35, 5, 32), [0, 6, -20.9]));
  // two great brass horns curling out of its sides, up and out into the sea: lamps in their mouths (the change lights them)
  const mouths = [];
  for (const s of [-1, 1]) {
    const pts = [V(s * 29, 11, 16), V(s * 29, 11, 19), V(s * 29, 11, 22), V(s * 29, 11, 25)];
    K.add(brass, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.9, 10));
    const end = pts[3], dir = end.clone().sub(pts[2]).normalize();
    const bell = lathe([[0.9, 0], [1.3, 1.0], [2.2, 2.0], [3.4, 2.6], [3.6, 2.7]], 20);
    bell.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir)).translate(end.x, end.y, end.z);
    K.add(brass, bell);
    const m = end.clone().addScaledVector(dir, 2.3);
    mouths.push({ at: m, dir });
  }
  // a row of round windows along the shell's lowest seam (lit by the change too)
  const ports = [];
  for (let i = 0; i < 10; i++) { const s = i < 5 ? -1 : 1, a = 1.0 + (i % 5) * 0.4; ports.push(V(s * Math.sin(a) * 13.95, 7, -3 + Math.cos(a) * 14.95)); }
  // coral rocks and kelp-coloured knobs round its foot (drawn)
  for (const [x, z, r] of [[-12, 8, 1.6], [12.5, 7, 1.3], [-15, -6, 2.0], [15.5, -9, 1.7], [-6, -17, 1.4], [8, -16, 1.9]]) K.add(coral, new THREE.SphereGeometry(r, 9, 6).scale(1, 0.6, 1).translate(x, -0.4, z));
  // Achille's bench, inside the tube by the door
  K.both(teal, box(0.6, 0.45, 1.8, 3.9, 0.22, DZ + 4.5));
  K.flush();

  // the lamps: in the horns' mouths, at the windows along the seam, and two over the door (the change lights them)
  const glowM = makeMaterial({ color: '#ffd98a', glow: 0.12, flat: true, key: 'temple.underwater.lamps' });
  const lamps = [];
  for (const m of mouths) lamps.push(new THREE.CircleGeometry(3.0, 20).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), m.dir.clone().negate())).translate(m.at.x, m.at.y, m.at.z));
  for (const p of ports) lamps.push(new THREE.SphereGeometry(0.55, 8, 6).translate(p.x, p.y, p.z));
  for (const s of [-1, 1]) lamps.push(new THREE.SphereGeometry(0.4, 8, 6).translate(s * 4.6, 7.6, FZ + 0.4));
  const lm = new THREE.Mesh(mergeAll(lamps), glowM);
  lm.position.copy(K.world(0, 0, 0));
  lm.userData.noCollide = true; lm.userData.dynamic = true;
  rt.root.add(lm);
  return { door: { at: K.world(0, 0, DZ), heading: 0 }, kit: K, glowM, clear: [{ x: SITE.x, z: SITE.z - 2, r: 68 }] };
}

function mergeAll(list) {
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const q0 of list) { const q = q0.index ? q0.toNonIndexed() : q0; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ the world change: the house sings the whales' song
/**
 * Once the Listener is calmed the lamps in the Whale-House's horns and along its seam are lit, warm and steady (until
 * then they only pulse, faintly, with the light's note); the whales come back to the glass (src/story/underwater.js:
 * level.whalesNear).
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The Whale-House’s lamps (the world change)';
  rt.root.add(root);
  root.visible = false;
  let k = 0, want = 0;
  return {
    root,
    get on() { return want === 1; },
    get k() { return k; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; root.visible = k > 0.01; } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); root.visible = k > 0.01; }
      const O = rt.outside;
      if (!O) return;
      const before = 0.08 + 0.12 * Math.max(0, Math.sin(t * 2.3));   // (the light's note, pulsing in the glass)
      O.glowM.uniforms.uGlow.value = before * (1 - k) + k * (0.75 + 0.08 * Math.sin(t * 0.9));
    },
  };
}

export const UNDERWATER_TEMPLE = {
  id: 'underwater', levelId: 'underwater', name: 'The Whale-House', doorLabel: 'door of the Whale-House',
  gadget: 'horn', arenas: ARENAS, gadgetBox: 'underwater.temple.horn', arenaDoor: 'dA',
  origin: [0, 1600, -150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  skin: whaleHouseSkin,   // (its look inside: src/temples/skins/whale-house.js, issue #342)
  local: { person: 'achille', out: 7, side: 1.2 },
  enterLine: 'Inside the Whale-House it is dry and cool and smells of brass and salt. The walls hum one high note, very softly: not a whale’s.',
  pitLine: 'You climb back up, to the last glyph stone.',
  onResolved(rt) { rt.notice('The whales are coming back. The way out comes up in the divers’ court.', 'resolved.out'); },
  // (v1.77) the Pool Room's ball in its cradle by the glass: the east door, across the hall, sinks (said once, as it
  // lands; out of sight of it)
  onUpdate(rt) {
    const on = rt.logic.drumOn('b2', 'p2');
    if (on && rt.poolBall === false) rt.notice('The ball settles in its cradle. Across the hall, the east door sinks.', 'p2.on');
    rt.poolBall = on;
  },
  onLit(rt, id) {
    if (id === 'eD') rt.notice('The eye on the pillar wakes, and the west door, to the Pool Room, sinks.', 'eD.lit');
    if (id === 'eP' || id === 'eS') rt.notice(rt.logic.isLit('eP') && rt.logic.isLit('eS') ? 'Both lamps on the Horn Door are lit, and it sinks.' : 'One lamp on the Horn Door lights. One to go.', `dH.${id}`);
  },
  // the Listener's ear: in its first phase it hears the horn close by while it listens; from its second it shuts its
  // ear to anything near it and only the hall's dishes reach it (a ball on a footstone wakes a dish); shifting into its
  // last it knocks the balls off the footstones
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const homed = () => ['W', 'E'].some((s) => rt.logic.drumOn(`b${s}`, `p${s}`));
    rt.listenerHomed = homed;
    const byDish = (pos) => ARENA_DISHES.some((id) => { const d = rt.piece(id); return d && pos.distanceTo(d.ends[0].mouth) <= d.reach; });
    rt.offs.push(rt.game.on('echo', ({ pos, note, relayed, via } = {}) => {
      if (!pos || !G.awake || G.state === 'weary') return;
      const dished = !!relayed && ARENA_DISHES.includes(via);
      if (!dished && pos.distanceTo(G.model.mouth) > LISTEN) return;
      if (note !== 'deep') { rt.notice('It hears the note and shakes its shell. That isn’t the whales’ note.', 'ls.wrong'); return; }
      if (!dished && G.phaseIndex >= 1) {
        if (!byDish(pos)) rt.notice('Its ear folds shut at the note. It hears only the house’s dishes now.', 'ls.near');
        return;
      }
      if (G.state !== 'open') { rt.notice(G.phaseIndex >= 1 ? 'The dish carries the note, but its ear is shut. Wait for it to listen.' : 'It hears you, but its ear is shut. Wait for it to stop and listen.', G.phaseIndex >= 1 ? 'ls.shut2' : 'ls.shut'); return; }
      const k = G.phaseIndex === 0 ? CALM.near : G.phaseIndex === 1 ? CALM.dish : CALM.last;
      G.add(k, 'horn');
      rt.rumble?.(0.5, 0.4);
      if (dished) rt.notice('The note comes down from the high dish into its ear. It goes still.', `ls.dish.${G.phaseIndex}`);
      else rt.notice('The deep note goes into its ear. It shivers, and hums the note back.', 'ls.near.ok');
      if (G.state === 'open') { G.enter('fight'); G.cool = 1.8; }
    }));
    let lastPhase = G.phaseIndex;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.phaseIndex !== lastPhase) {
        lastPhase = G.phaseIndex;
        if (G.phaseIndex === 2 && homed()) {
          for (const s of ['W', 'E']) {
            const b = rt.piece(`b${s}`);
            if (b && rt.logic.drumOn(`b${s}`, `p${s}`)) { b.t = 0.15; b.v = 0; b.rest = true; b.place(); rt.logic.moveDrum(`b${s}`, 0.15); }
          }
          rt.notice('It shakes as it shifts, and the stones roll off the dishes’ footstones.', 'ls.knock');
          rt.rumble?.(0.8, 0.5);
        }
      }
    };
  },
};
