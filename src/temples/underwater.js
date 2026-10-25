import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import { pearl, metal } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, Z_GAP } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Glass, EchoEar, Dish, Mark, Pit, Key, Weight } from './pieces.js';
import { registerInteractable, PRIORITY } from '../interact.js';
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
// a dish only carries with a weight on its footstone, and a held note only rings a while. The SPRING BOOTS (src/gadgets/
// springs.js; issue #377: the whale-horn was here) bring you down hard in a stomp, and in this house of shell and water a
// stomp's boom is the deep note, the whales' own, that its ears listen for.
// Since v1.83 (issue #412, docs/design/temple-best-practices.md: G1) the house has a TIDE, its one state: the makers let
// the sea into their sounding-house and out again at a valve, and it rises and falls through every wing at once. High,
// it lifts you to ledges you could not climb and fills the tank behind the glass, so the note carries through it; low, it
// bares the Sounding Hall's deep floor and the doors in it, which hold the sea back while it is in. Set and set back
// four times on the way (TIDE: a valve by every hub; a gauge, a lamp's colour and the water's own line in every room).
//   the Porch             the first mark, the way out
//   the Sounding Hall     the great hall (G4), 48 by 76 m and 43 high: three floors seen at once. The quays (y 0) round its
//                         south, west and east sides; the deep floor 11 m under them, walked with the tide low (one room,
//                         the hub, its two floors joined by a stair); the Sound, a moat across the hall always deep enough
//                         to fall into; the dais beyond it (y 0), reached with the tide high, swum to, the second hub (the
//                         Horn Door, the drop back); over the dais the gallery (y 10), behind a screen of the great horn's
//                         pipes. On the deep floor: the stone ball for the pillar's eye
//                         (the west door, on the quay), the Shell Room's door, the Horn Store's, the Listener's door and the
//                         Listener's column before it, its ear and a dish's mouth on it
//   the Pool Room         the west wing (y 0): the sea behind a glass wall across its middle; the pool's eye on a pillar out
//                         in it, splashed over the glass; the stone ball across the dry half into its cradle opens the
//                         Shell Room's door, down on the deep floor
//   the Shell Room        the east wing, sunk to the deep floor: in at its floor door with the tide low; a ball rolled to
//                         its plate unlids the shell's eye. Its own valve: the tide raised, it floats you up to its ledge
//                         and out onto the east quay (the second way round)
//   the Horn Chamber      north of the dais, a round hall 34 m across: the makers' chest on a shell pulpit: the SPRING
//                         BOOTS. A try by the pulpit; by its north door the passage horn: the Song Passage's door at the
//                         passage's far end stays open only while it rings (`hold`), and with the Horn Store's small key
//   the Tank Hall         the sea let in behind a wall of glass ten metres tall: the tide fills the tank too. Its ear lies
//                         on the tank's floor; a stomp by the glass booms through the water to it only while the tank is
//                         full, and while it rings brass rungs come out of the glass's frame: the shelf over the tank
//   the gallery           from the shelf, the High Walk south to the gallery over the dais (room `gallery`): a dish on a
//                         footstone that looks down the hall at the Listener's column; the stone weight for it lies on a
//                         post's capital under a hanging horn's bell, where only the grappling hook (the Founders'
//                         Belfry's) brings it down (G2: the hook and the boots at once). Its note opens the Listener's
//                         door, down on the deep floor, which holds the sea back: the tide let down, and the Drop, a gap
//                         in the pipes, into the Sound (G6), the way back to the hub
//   the Horn Store        (the house's one fight, v1.53, issue #23) off the deep floor's south side: its door holds the sea
//                         back too. Won, the small key's cage sinks: the Song Passage's door takes it
//   the Throat            from the Listener's door west under the Pool Room, a long stair down to its hall
//   the Listener's Hall   the guardian (organic: its meter is calm). When it stops and spreads its great ear, stomp
//                         close by. From its second phase it shuts its ear to anything near it, and only the hall's
//                         dishes reach it: a ball on a dish's footstone, a stomp into the dish while its ear is open. As
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
/** (issue #412) The Sounding Hall's deep floor (local y): 11 m under the quays, the dais and the Porch. */
export const DEEP = -11;
/**
 * (issue #412, G4) The Sounding Hall, the great hall: 48 by 76 m (x0..x1, z0..z1) from the Sound's floor 43 m up to its
 * roof (`top`). The quays (y 0) round its south (to z `quayS`), west and east sides (`quay` m wide); the deep floor between
 * them (DEEP); the Sound across the hall (SOUND); the dais beyond it; the gallery over the dais (GALLERY).
 */
export const HALL = { x0: -24, x1: 24, z0: 14, z1: 90, top: 27, quay: 6, quayS: 24 };
/** The Sound: a moat across the hall between the deep floor and the dais (z0..z1), its floor 5 m under the deep floor: always water enough to fall into. */
export const SOUND = { z0: 54, z1: 66, floor: -16 };
/**
 * The gallery over the dais (y, from z0 to the north wall): the great horn's pipes along its lip but for the Drop (x
 * from..to), the way back down into the Sound; the stone weight on the capital of a post (x, z, its top y) under a horn's
 * bell hung from the roof, its rim `hood` m over it (no standing there: only the hook reaches it), the dish's footstone
 * (`stone`) and the dish beside it (`dish`).
 */
export const GALLERY = { y: 10, z0: 62, drop: [-2.5, 2.5], parapet: 1.1, post: { x: -12, z: 73, y: 15, hood: 1.25 }, stone: [-6, 68], dish: [-6, 65] };
/** The Listener's column on the deep floor before the Listener's door (x, z, its top y), the ear on its face toward the door (y). */
export const COLUMN = { x: -12.5, z: 47, top: 2, ear: -2.2 };
/**
 * (v1.77, issue #336: the house as shrines) The rooms (local metres): the wings (30 m square, the Pool Room at -x on the
 * quay, the Shell Room at +x on the deep floor, 22 m high to clear its ledge's door), the Pool Room's glass, the Horn
 * Chamber's round hall (34 m across, at x, z), the Tank Hall (40 by 30 under 22: the glass, the tank and the shelf down its
 * middle).
 */
export const ROOMS = {
  hall: HALL,
  wing: { w: 30, d: 30, h: 18, x: 43, z: 41, deep: 27, ledge: 6 },   // the Pool Room at -x, the Shell Room at +x (27 m from its floor: 16 over its ledge)
  glass: -46,                                    // the Pool Room's glass (x): the sea behind it, the pool's eye on a pillar in it
  horn: { r: 17, h: 18, x: -18, z: 111 },
  tank: { x0: -30, x1: 10, z0: 138, z1: 168, h: 22, gw: -6, ge: 0, shelf: 10 },
};
// the rooms' places (local metres): the Horn Chamber's middle, the High Walk's x, the Listener's door's z, and the
// arena's middle (its x, floor and z) and radius
const HCX = ROOMS.horn.x, HCZ = ROOMS.horn.z, WX = 5, LZ = 47, AY = -24, ACX = -82, ACZ = LZ, AR = 18;
/** How long the horns hold their note (s): the passage's door (the tank's ear keeps its note since issue #412). */
export const HOLD = { door: 10, rungs: 16 };
/** How much the horn calms it: close by in its first phase, through a dish in its second, in its last. */
export const CALM = { near: 0.12, dish: 0.11, last: 0.09 };
/** The dishes in the Listener's Hall (their near ends low on the wall, by the footstones). */
export const ARENA_DISHES = ['dishW', 'dishE'];
/** (in the skin) the great windows' glass, the deep sea blue behind it (src/temples/skins/whale-house.js) */
const SEA_GLASS = '#1d4f86';
/** (issue #377) The hatch at the top of the Tank Hall's glass, in the screen over it: its width and height (m). */
export const HATCH = [6, 5];
const LISTEN = 14;   // m: how close to its ear the deep note has to be (a stomp's boom; the whale-horn's, before issue #377)
/** The deep note a stomp booms in the house (the whales' own: src/boxes/effects.js HORN, src/temples/pieces.js NOTES.deep). */
export const STOMP_NOTE = { degree: -3, color: '#6f8fd8' };

/**
 * (issue #412, G1) The tide, the house's one state: the sea let in (high, t 1) or let out (low, t 0, the start). Set at a
 * valve by every hub (`valves`: the quays', the deep floor's, the dais's, the gallery's) and in the two rooms the tide
 * lifts you out of or strands you in without one (the Shell Room's, the Tank Hall's); the logic moves at once, the water
 * takes `run` s. Each water's two levels (local y: low, high): the Sounding Hall's and the Shell Room's (swum), the tank's
 * behind its glass. The colour every valve's and gauge's lamp shows: `high` the sea's blue, `low` the coral of the bare
 * floor.
 */
export const TIDE = {
  run: 13,   // (11 m in 13 s: slow enough that a swimmer afloat rides up on it, src/swim.js: its spring to the surface lags 0.3 m at 0.85 m/s)
  hall: [DEEP - 0.6, -0.6],
  tank: [0.4, ROOMS.tank.shelf - 0.6],
  valves: [
    { room: 'hall', name: 'quay', at: [-8, 0, 19.5], yaw: Math.PI },
    { room: 'hall', name: 'deep', at: [4, DEEP, 40], yaw: Math.PI },
    { room: 'shells', at: [38, DEEP, 44], yaw: -Math.PI / 2 },
    { room: 'dais', at: [8, 0, 78], yaw: Math.PI },
    { room: 'tank', at: [-22, 0, 160], yaw: Math.PI / 2 },
    { room: 'gallery', at: [14, GALLERY.y, 80], yaw: Math.PI },
  ],
  high: '#5fd2e6', low: '#f08a6a',
};
/** (issue #412) The tide's two stops, as conditions: the sea in, or the sea out. */
export const HIGH = { drumOn: ['tide', 'tHigh'] }, LOW = { drumOn: ['tide', 'tLow'] };

export const LOGIC = {
  id: 'underwater', entry: 'threshold', gadget: 'springs',
  // (each room's kind, issue #336: src/foes.js puts machines only in the combat room, the Horn Store. Since v1.83, issue
  // #412, `hall` is the Sounding Hall's quays and its deep floor, `dais` the dais across the Sound, `gallery` the shelf, the
  // High Walk and the gallery over the dais: the old ids kept, so a save's last mark holds)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, hall: { checkpoint: true, kind: 'puzzle' }, dais: { checkpoint: true, kind: 'passage' },
    pools: { checkpoint: true, kind: 'puzzle' }, shells: { checkpoint: true, kind: 'puzzle' }, horn: { checkpoint: true, kind: 'puzzle' }, tank: { checkpoint: true, kind: 'puzzle' },
    gallery: { checkpoint: true, kind: 'puzzle' }, store: { checkpoint: true, kind: 'combat' }, ante: { checkpoint: true, kind: 'passage' },
    arena: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'hall' },
    { a: 'hall', b: 'pools', door: 'd1' },        // the west door, on the quay: its eye on a pillar on the deep floor
    { a: 'hall', b: 'shells', door: 'd2' },       // the Shell Room's floor door: the Pool Room's ball in its cradle, the tide low
    { a: 'shells', b: 'hall', door: 'ledgeE' },   // its ledge, onto the east quay: the tide high lifts you to it, its door open
    { a: 'hall', b: 'dais', door: 'sound' },      // the Sound swum, the tide high
    { a: 'dais', b: 'hall', oneWay: true },       // off the dais into the Sound (it always has water enough)
    { a: 'dais', b: 'horn', door: 'dH' },         // the Horn Door: an eye in each wing
    { a: 'horn', b: 'tank', door: 'd4' },         // the Song Passage's door, held while its horn rings, and the small key
    { a: 'tank', b: 'gallery', door: 'rungs' },   // the glass climbed while the tank's ear rings
    { a: 'gallery', b: 'hall', oneWay: true },    // (G6) the Drop, off the gallery into the Sound
    { a: 'hall', b: 'store', door: 'dS' },        // the Horn Store, off the deep floor: an arena, the small key
    { a: 'hall', b: 'ante', door: 'dL' },         // the Listener's door: its ear hears only the gallery's dish, and the tide low
    { a: 'ante', b: 'arena', door: 'dA' },
    { a: 'arena', b: 'out', door: 'd5' },
  ],
  elements: {
    // the deep floor: the stone ball into the cradle at the pillar's foot, and the pillar's eye unlids: the west door, up on
    // the quay (the tide starts low)
    b1: { type: 'drum', room: 'hall', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'hall' },
    eD: { type: 'switch', room: 'hall', when: { drumOn: ['b1', 'p1'] } },
    d1: { type: 'door', opens: { lit: 'eD' }, latch: true },
    // the Pool Room's ball, rolled across its floor into its cradle by the glass: the Shell Room's floor door, which holds
    // the sea back (open only with the tide low)
    b2: { type: 'drum', room: 'pools', plate: 'p2', plateAt: 1, start: 0 },
    p2: { type: 'plate', room: 'pools' },
    d2: { type: 'door', opens: { all: [{ drumOn: ['b2', 'p2'] }, LOW] } },
    // the Horn Door: the pool's eye over the glass, and the shell's eye, unlidded by the Shell Room's ball
    eP: { type: 'switch', room: 'pools' },
    bS: { type: 'drum', room: 'shells', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'shells' },
    eS: { type: 'switch', room: 'shells', when: { drumOn: ['bS', 'pS'] } },
    dH: { type: 'door', opens: { all: [{ lit: 'eP' }, { lit: 'eS' }] }, latch: true },
    // the water itself: with the tide high the Shell Room's ledge is in reach of its water, and the Sound swum to the dais.
    // The ledge's door onto the east quay opens with the shell's eye, from inside: the way in is the floor door, the ledge a
    // way back (a loop)
    dE: { type: 'door', opens: { lit: 'eS' }, latch: true },
    ledgeE: { type: 'bridge', opens: { all: [{ open: 'dE' }, HIGH] } },
    sound: { type: 'bridge', opens: HIGH },
    // (issue #377: the chest held the whale-horn, one note to calm the Listener; the spring boots now, whose stomp booms the
    // deep note through shell and water: the house's onConnect)
    chest: { type: 'gadget', room: 'horn', item: 'springs' },
    // the try by the pulpit: a little horn that answers the deep note (nothing waits on it)
    eT: { type: 'switch', room: 'horn', needs: ['springs'], try: true },
    // the Song Passage: the door held while its horn rings (from the Tank Hall's side a dish carries a stomp's note to the
    // horn, the way back), and the Horn Store's small key
    e4: { type: 'switch', room: 'horn', needs: ['springs'], hold: HOLD.door },
    d4: { type: 'door', lock: 'small', opens: { lit: 'e4' } },
    // the Tank Hall: its ear on the tank's floor hears a stomp by the glass only through the tank's water (the tide high),
    // and keeps it: the glass's rungs out for good (issue #412: the dish and its ball were the way the note crossed the
    // water before, and the rungs held only while it rang; a held ear that wants the tide in would have the house ask for
    // the tide again each time it fell quiet)
    e5: { type: 'switch', room: 'tank', needs: ['springs'], hold: HOLD.rungs, when: HIGH },
    rungs: { type: 'bridge', opens: { lit: 'e5' } },
    // (issue #377) the hatch at the top of the glass, in the screen that runs up from it to the roof: open with the rungs, so
    // no bounce of the spring boots takes you over the glass, only its rungs while the ear rings
    hatch: { type: 'door', opens: { lit: 'e5' } },
    // the gallery (issue #412, G2): the stone weight on its bracket under the hood, only the grappling hook brings it down;
    // set on the footstone, the dish wakes, and a stomp into it comes out of its twin on the Listener's column, where the
    // ear hears it (heard there: its room the gallery's, where the note is made)
    wG: { type: 'weight', room: 'gallery', plate: 'pG', needs: ['hook'] },
    pG: { type: 'plate', room: 'gallery' },
    eL: { type: 'switch', room: 'gallery', needs: ['springs'], when: { weightOn: ['wG', 'pG'] } },
    // the Listener's door on the deep floor: the ear, and the tide low (it holds the sea back)
    dL: { type: 'door', opens: { all: [{ lit: 'eL' }, LOW] } },
    // the Horn Store: its keepers beaten, the small key's cage sinks (v1.53); its door holds the sea back too
    arH: { type: 'arena', room: 'store' },
    kS: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arH' } },
    // (its horn on the deep floor before it, a stomp by it: the door's, past the chest)
    eSt: { type: 'switch', room: 'hall', needs: ['springs'] },
    dS: { type: 'door', opens: { all: [{ lit: 'eSt' }, LOW] } },
    dA: { type: 'door', opens: null },                                   // the arena's door: shut while the Listener fights
    // the Listener's Hall: a ball on a dish's footstone (its last phase wants one there)
    bW: { type: 'drum', room: 'arena', plate: 'pW', plateAt: 1, start: 0 },
    pW: { type: 'plate', room: 'arena' },
    bE: { type: 'drum', room: 'arena', plate: 'pE', plateAt: 1, start: 0 },
    pE: { type: 'plate', room: 'arena' },
    listener: { type: 'boss', room: 'arena', needs: ['springs'], requires: { any: [{ drumOn: ['bW', 'pW'] }, { drumOn: ['bE', 'pE'] }] } },
    d5: { type: 'door', opens: { resolved: true } },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'pools', at: [-37.5, 0, 49], yaw: Math.PI, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
    // (issue #412) the tide, the house's state: the sea out (0, the start) or in (1), saved. Set at a valve on the quays,
    // the deep floor, the dais and the gallery, and in the Shell Room and the Tank Hall. Its stops are no plates anyone
    // stands on. (Last of the things to do, so the scout asks for it only once nothing nearer is left: logic.next)
    tide: { type: 'drum', room: 'hall', rooms: ['dais', 'shells', 'tank', 'gallery'], stops: { tLow: 0, tHigh: 1 }, start: 0, roll: 'hand', verb: 'tide' },
    tLow: { type: 'plate' }, tHigh: { type: 'plate' },
  },
};

/**
 * (v1.53) The Horn Store, off the deep floor's south side under the south quay (an arena; v1.77: 30 m square under 18, a
 * passage from its door at `door` (x); since v1.83, issue #412, on the deep floor, its door one that holds the sea back),
 * its keepers round its middle among four columns.
 */
export const STORE = { x: 24, z: -5, w: 30, d: 30, h: 18, y: DEEP, door: 13, zone: { min: [9, DEEP - 1, -20], max: [39, DEEP + 18, 10] } };

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
    { to: 0.35, attacks: ['sweep', 'slam', 'pearl'], pause: 1.6, hint: 'When it spreads its ear, stomp close to it: the boom is the deep note.' },
    { to: 0.65, attacks: ['song', 'pearls', 'sweep'], pause: 1.3, hint: 'Its ear shuts now. Roll a ball onto a dish’s footstone, stomp by it.' },
    { to: 0.9, attacks: ['roll', 'pearls', 'slam'], pause: 1.1, hint: 'Roll a ball back onto a footstone, then stomp by its dish.' },
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

// ------------------------------------------------------------------ the tide, the house's state (issue #412)
/** The tide's eased level: 0 out, 1 in (the logic's own when nothing keeps it: tests, the first frame). */
const levelOf = (rt) => rt.tide?.k ?? (rt.logic.check(HIGH) ? 1 : 0);
/** The tide's colour now: the coral of the bare floor (out) to the sea's blue (in), as it runs. */
const tideColour = (k, out = new THREE.Color()) => out.set(TIDE.low).lerp(_tc.set(TIDE.high), k);
const _tc = new THREE.Color();
/**
 * The house's sea, swum: drawn as the house draws its water (flat, lit from within, seen from under it too), a body water.js
 * swims in (`userData.water`: a mesh it finds in the scene, src/water.js) but not the world's water shader: the same in the
 * Unity build, where the shader's passes are not (docs/systems/bridge-gaps.md).
 */
const seaMat = () => makeMaterial({ color: '#2f8aa0', glow: 0.32, flat: true, side: THREE.DoubleSide, key: 'temple.underwater.tide' });
/** The tank's sea behind the glass and the channels' water (drawn only). */
const drawnSea = () => makeMaterial({ color: '#3f9aa6', glow: 0.35, flat: true, key: 'temple.underwater.tidewater' });

/**
 * The tide (LOGIC `tide`, a drum of two stops: out 0, in 1): this piece keeps the house's state. A valve turned (TideValve)
 * lets the sea in or out at once, for the logic; the water itself runs for TIDE.run s (`k`: 0 out, 1 in, eased), and every
 * water, gauge and lamp follows it. It points the scout at the nearest valve (`center`). o: { id: 'tide', at (local: where
 * it is said to be, the deep floor's valve) }
 */
export class Tide {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    this.at = rt.kit.world(...(o.at ?? TIDE.valves[1].at));
    this.setters = [];   // (the valves: the scout's, and the play-through's)
    this.k = this.high ? 1 : 0;
    rt.tide = this;
  }
  get high() { return this.rt.logic.drumOn(this.id, 'tHigh'); }
  /** In, or out: at once for the logic, the water running after. Returns which. */
  toggle() {
    const rt = this.rt, up = !this.high;
    rt.logic.moveDrum(this.id, up ? 1 : 0); rt.applyDoors?.();
    rt.sound?.splash?.(1.4); rt.rumble?.(TIDE.run * 0.7, 0.4);
    rt.notice?.(up ? 'The valve turns. The sea comes in through the house.' : 'The valve turns. The sea runs out of the house.', up ? 'tide.up' : 'tide.down');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id });
    return up ? 'up' : 'down';
  }
  /** Is the water still on its way (the bed maps wait for it). */
  get running() { return this.k !== (this.high ? 1 : 0); }
  update(dt) {
    const want = this.high ? 1 : 0, s = dt / TIDE.run;
    this.k = want > this.k ? Math.min(want, this.k + s) : Math.max(want, this.k - s);
  }
  /**
   * Where to set it from (the scout's): the nearest valve. Once the Listener is calmed, the way out instead: the house has
   * nothing left that wants the sea in or out, though its logic still sees the Sound and the Listener's door wait on it.
   */
  get center() {
    if (this.rt.logic.resolved && this.rt.doorOut) return this.rt.doorOut;
    const P = this.rt.player?.pos, list = this.setters.map((s) => s.at);
    if (!P || !list.length) return list[0] ?? this.at;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
}

/**
 * A tide valve (TIDE.valves): a post of the house's shell-stone, a great brass valve wheel on its face that turns as the
 * water runs, a lamp of the tide's colour on its cap. Turned (A / ×) it lets the sea in or out (Tide.toggle).
 * o: { id, room, at (its foot, local), yaw (the way it faces), sets: 'tide' }
 */
export class TideValve {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.2, yaw = o.yaw ?? 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.pos = K.world(x, y, z);
    K.both(M.wall, T(new THREE.BoxGeometry(1.0, H, 1.0), [x, y + H / 2, z], [0, yaw, 0]));
    K.add(M.trim, T(new THREE.BoxGeometry(1.2, 0.14, 1.2), [x, y + H + 0.07, z], [0, yaw, 0]));
    this.top = K.world(x + fx * 0.55, y + H * 0.7, z + fz * 0.55);
    this.at = this.top;
    const brass = makeMaterial({ color: '#c9973f', flat: true, metal: 'brass', refl: 0.3, key: 'temple.underwater.brass' });
    this.wheel = new THREE.Group();
    this.wheel.position.copy(K.world(x + fx * 0.58, y + H * 0.6, z + fz * 0.58));
    this.wheel.rotation.y = K.heading(yaw);
    const spokes = [new THREE.TorusGeometry(0.5, 0.06, 6, 24)];
    for (let i = 0; i < 4; i++) spokes.push(new THREE.BoxGeometry(0.07, 1.0, 0.07).rotateZ((i / 4) * Math.PI));
    spokes.push(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 10).rotateX(Math.PI / 2));
    for (const g of spokes) this.wheel.add(new THREE.Mesh(g, brass));
    rt.root.add(this.wheel);
    // its lamp: a glass bulb on the cap, the tide's colour
    this.lampM = makeMaterial({ color: TIDE.low, glow: 0.7, flat: true });
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.lampM);
    this.lamp.position.copy(K.world(x, y + H + 0.36, z));
    rt.root.add(this.lamp);
    for (const m of [this.wheel, this.lamp]) m.traverse((q) => { q.userData.noCollide = true; q.userData.dynamic = true; });
    const S = () => rt.tide;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (S()?.high ? 'let the sea out' : 'let the sea in'),
      enabled: () => !!S(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => S()?.toggle(this.id),
    });
    rt.tide?.setters.push({ at: this.top, lever: this.id });
    this.later = !rt.tide;   // (a valve placed before the tide: it joins its list on its first frame)
  }
  update() {
    const S = this.rt.tide;
    if (this.later && S) { this.later = false; S.setters.push({ at: this.top, lever: this.id }); }
    const k = levelOf(this.rt);
    this.wheel.rotation.z = k * Math.PI * 4;
    tideColour(k, this.lampM.uniforms.uColor?.value ?? this.lampM.color ?? new THREE.Color());
  }
  dispose() { this.off?.(); }
}

/**
 * A gauge of the tide (G1, readable everywhere): a slender cage of brass round a column of the sea, its two marks coral
 * rings; the water stands at the upper mark while the tide is in, at the lower while it is out, and its lamp on top shows
 * the tide's colour. In every room but the guardian's. o: { room, at (its foot, local), h, shows: 'tide' }
 */
export class TideGauge {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, h = this.h = o.h ?? 3.0, r = 0.3;
    this.rt = rt; this.o = o;
    K.both(M.wall, T(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 10), [x, y + 0.25, z]));
    const y0 = y + 0.5;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; K.add(M.trim, T(new THREE.BoxGeometry(0.06, h, 0.06), [x + Math.sin(a) * (r + 0.06), y0 + h / 2, z + Math.cos(a) * (r + 0.06)])); }
    const coral = pearl('#fa7356');
    for (const f of [0.08, 0.92]) K.add(coral, T(new THREE.TorusGeometry(r + 0.08, 0.045, 5, 16), [x, y0 + f * h, z], [Math.PI / 2, 0, 0]));
    K.add(M.trim, T(new THREE.CylinderGeometry(r + 0.14, r + 0.14, 0.12, 12), [x, y0 + h + 0.06, z]));
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12).translate(0, 0.5, 0), drawnSea());
    this.lampM = makeMaterial({ color: TIDE.low, glow: 0.7, flat: true });
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.lampM);
    this.lamp.position.copy(K.world(x, y0 + h + 0.3, z));
    for (const m of [this.water, this.lamp]) { m.userData.noCollide = true; m.userData.dynamic = true; rt.root.add(m); }
    this.foot = K.world(x, y0, z);
    this.update();
  }
  update() {
    const k = levelOf(this.rt), h = this.h;
    this.water.position.copy(this.foot);
    this.water.scale.set(1, Math.max(0.02, h * (0.08 + 0.84 * k)), 1);
    tideColour(k, this.lampM.uniforms.uColor?.value ?? new THREE.Color());
  }
}

/**
 * The tide's water where it is swum (the Sounding Hall's, the Shell Room's): a body water.js finds in the scene and moves
 * with it (`userData.water`, `waterMoves`: you swim in it, dive under it, fall into it), a sheet over [x0, z0]-[x1, z1]
 * standing at `low` with the tide out and `high` with it in (local y), between as it runs.
 * o: { box: [x0, z0, x1, z1], low, high, name }
 */
export class TideWater {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, [x0, z0, x1, z1] = o.box;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), seaMat());
    this.mesh.name = `The Whale-House’s tide (${o.name ?? 'water'})`;
    this.mesh.userData.noCollide = true; this.mesh.userData.water = true; this.mesh.userData.waterMoves = true; this.mesh.userData.dynamic = true;
    this.base = K.world((x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.mesh.position.copy(this.base);
    this.mesh.rotation.y = K.heading(0);
    rt.root.add(this.mesh);
    this.update();
  }
  /** Its surface now (local y). */
  get level() { return THREE.MathUtils.lerp(this.o.low, this.o.high, levelOf(this.rt)); }
  update() { this.mesh.position.y = this.base.y + this.level; }
}

/**
 * The tide's water where it is only seen (the tank behind its glass, a channel along a wall, the ring round the Horn
 * Chamber's pulpit): a box (or a ring) of the house's sea from `y0` up to its level (local y: `low` with the tide out,
 * `high` with it in), gone when there is none. o: { box: [x0, z0, x1, z1] | ring: [x, z, r0, r1], y0, low, high, mat }
 */
export class TideColumn {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit;
    // (a ring: the kit's annulus, extruded 1 m down from its top, lifted to stand on y0)
    const g = o.ring ? annulus(o.ring[2], o.ring[3], 1, 48).translate(0, 1, 0) : new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(g, o.mat ?? drawnSea());
    const [cx, cz] = o.ring ? [o.ring[0], o.ring[1]] : [(o.box[0] + o.box[2]) / 2, (o.box[1] + o.box[3]) / 2];
    this.mesh.position.copy(K.world(cx, o.y0, cz));
    this.mesh.rotation.y = K.heading(0);
    if (!o.ring) this.mesh.scale.set(o.box[2] - o.box[0], 1, o.box[3] - o.box[1]);
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true; this.mesh.userData.water = false;
    rt.root.add(this.mesh);
    this.update();
  }
  update() {
    const h = THREE.MathUtils.lerp(this.o.low, this.o.high, levelOf(this.rt)) - this.o.y0;
    this.mesh.visible = h > 0.02;
    this.mesh.scale.y = Math.max(0.001, h);
  }
}

/**
 * The tank's water seen through its glass: the pane shows the sea (the skin draws it there), and over the part of the pane
 * the tide has left, the tank's empty dark; at the water's top a lit line across the glass. Both on the pane's room side,
 * in its own frame (x along, y up from its foot, z out of the pane). o: { glass (its Glass piece), low, high (the water's
 * height over the glass's foot) }
 */
export class TideGlass {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const g = o.glass, w = g.w - 0.1;
    this.air = new THREE.Mesh(new THREE.BoxGeometry(w, 1, 0.02).translate(0, 0.5, 0.155), makeMaterial({ color: '#163640', glow: 0.05, flat: true }));
    this.line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.03).translate(0, 0, 0.16), makeMaterial({ color: '#a6f2ea', glow: 0.9, flat: true }));
    this.air.name = 'The tank’s glass: the tide gone from it'; this.line.name = 'The tank’s glass: the water’s line';
    for (const m of [this.air, this.line]) { m.userData.noCollide = true; m.userData.dynamic = true; g.group.add(m); }
    this.update();
  }
  update() {
    const h = this.o.glass.h, y = THREE.MathUtils.lerp(this.o.low, this.o.high, levelOf(this.rt));
    this.air.position.y = y; this.air.scale.y = Math.max(0.001, h - y); this.air.visible = h - y > 0.02;
    this.line.position.y = y;
  }
}

/**
 * (v1.53, issue #23) The Horn Store, off the deep floor's south side: an arena among the makers' spare horns and their
 * shells; won, the small key's cage sinks (for the Song Passage's door, past the chest, with its horn's note). (v1.77,
 * issue #336: the house's one fight, 30 m square, its keepers round its middle among four columns. v1.83, issue #412: down
 * on the deep floor's level, its door holding the sea back.)
 */
function store(rt, K, M, { brass, whorl }) {
  const add = (P, o) => rt.add(P, o);
  const S = STORE, y = S.y, x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, z0 = S.z - S.d / 2, z1 = S.z + S.d / 2;
  K.corridor([S.door, z1 + 0.6], [S.door, HALL.quayS - 0.4], y, { ...DOOR, h: 9.6 });   // (from its north wall under the south quay to the deep floor's face)
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y, h: S.h, roof: true, doors: [{ side: 'n', at: S.door - S.x, ...DOOR }] });
  add(Door, { id: 'dS', at: [S.door, y, HALL.quayS], ...DOOR, lamps: [{ lit: 'eSt' }, LOW] });   // (it holds the sea back; open, it shuts behind you while they stand)
  // four columns to fight round; spare horns on racks along the east wall, shells stacked in the corners
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.column(S.x + sx * 8, S.z + sz * 8, y, S.h, 0.9);
  for (const z of [S.z - 8, S.z - 3, S.z + 2, S.z + 7]) {
    K.both(brass, box(0.3, 2.6, 0.3, x1 - 1.2, y + 1.3, z));
    K.add(brass, T(lathe([[0.12, 0], [0.25, 0.6], [0.6, 1.1], [1.1, 1.4], [1.15, 1.45]], 14).rotateZ(-Math.PI / 2), [x1 - 1.6, y + 2.6, z]));
  }
  for (const [x, z] of [[x0 + 2.4, z0 + 2.4], [x0 + 2.6, z1 - 2.6], [x1 - 2.6, z0 + 2.4]]) whorl(x, y, z, 0.9, 'all', 6);
  add(Key, { id: 'kS', at: [S.x, y, z0 + 1.6], yaw: 0 });
  add(TideGauge, { shows: 'tide', room: 'store', at: [x1 - 2.6, y, z1 - 2.6] });
  add(Mark, { room: 'store', at: [S.door, y, z1 - 3], yaw: Math.PI, foes: [S.x, y, S.z] });
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
  /** (issue #412) The high-water line: a coral band along a wall's face, at y (local), from a to b ([x, z]), `out` off the wall. */
  const tideLine = (a, b, y, h = 0.22) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    K.add(coral, T(new THREE.BoxGeometry(L, h, 0.06), [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [0, Math.atan2(-dz, dx), 0]));
  };
  const H = HALL, Wg = ROOMS.wing, WZ = Wg.z, HI = TIDE.hall[1], LO = TIDE.hall[0];
  const Q = H.x1 - H.quay, G = GALLERY, SF = SOUND.floor;

  // the tide, its valves and the water swum in the Sounding Hall and the Shell Room (first: every gauge and water reads it)
  add(Tide, { id: 'tide', at: TIDE.valves[1].at });
  for (const v of TIDE.valves) add(TideValve, { ...v, id: `valve.${v.name ?? v.room}`, sets: 'tide' });

  // ---- the Porch (z 0..12.8)
  K.hall({ x: 0, z: 6.4, w: 14, d: 12.8, y: 0, h: 11, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 7.2, 0.05], 1.5, 0);
  for (const s of [-1, 1]) whorl(s * 5.2, 0, 8.5, 0.7, true, 6);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 4], yaw: Math.PI / 2 });

  // ---- the Sounding Hall (x -24..24, z 14..80, from the Sound's floor at -16 up to 27): the great hall (G4)
  const up = (y) => y - SF, HM = (H.z0 + H.z1) / 2;   // (a door's foot over the hall's floor, the Sound's; the hall's middle)
  K.hall({ x: 0, z: (H.z0 + H.z1) / 2, w: H.x1 - H.x0, d: H.z1 - H.z0, y: SF, h: H.top - SF, roof: true, doors: [
    { side: 's', ...DOOR, y0: up(0) }, { side: 's', at: STORE.door, ...DOOR, y0: up(DEEP) },
    { side: 'w', at: WZ - HM, ...DOOR, y0: up(0) }, { side: 'w', at: LZ - HM, ...DOOR, y0: up(DEEP) },
    { side: 'e', at: WZ - HM, ...DOOR, y0: up(0) }, { side: 'e', at: WZ - HM, ...DOOR, y0: up(DEEP) },
    { side: 'n', at: HCX, ...DOOR, y0: up(0) }, { side: 'n', at: WX, ...DOOR, y0: up(G.y) },
  ] });
  // the quays (y 0): south, west and east; the dais beyond the Sound; the deep floor between the quays
  K.slab(H.x0 - 0.6, H.z0 - 0.6, H.x1 + 0.6, H.quayS, 0);
  K.slab(H.x0 - 0.6, H.quayS, -Q, SOUND.z0, 0); K.slab(Q, H.quayS, H.x1 + 0.6, SOUND.z0, 0);
  K.slab(H.x0 - 0.6, SOUND.z1, H.x1 + 0.6, H.z1 + 0.6, 0);
  K.slab(-Q, H.quayS, Q, SOUND.z0, DEEP);
  // the quays' faces, down to the Sound's floor: the deep floor's three sides (its doors in them: the Throat's west, the
  // Shell Room's east, the Horn Store's south), the Sound's sides and the dais's face
  // (flush with the quays, no curb: the deep floor seen over their lip from the doors on them; their tops Z_GAP under the
  // quays' floors, which lie on them: two faces in one plane flicker, scripts/zfight)
  K.wall(-Q, H.quayS, -Q, SOUND.z0, SF, -SF - Z_GAP, { t: 0.8, cap: false, holes: [{ at: LZ - H.quayS, ...DOOR, y0: up(DEEP) }] });
  K.wall(Q, SOUND.z0, Q, H.quayS, SF, -SF - Z_GAP, { t: 0.8, cap: false, holes: [{ at: SOUND.z0 - WZ, ...DOOR, y0: up(DEEP) }] });
  K.wall(Q, H.quayS, -Q, H.quayS, SF, -SF - Z_GAP, { t: 0.8, cap: false, holes: [{ at: Q - STORE.door, ...DOOR, y0: up(DEEP) }] });
  K.wall(-Q, SOUND.z0, Q, SOUND.z0, SF, DEEP - SF, { t: 0.8 });
  K.wall(H.x0 - 0.6, SOUND.z0, -Q, SOUND.z0, SF, -SF, { t: 0.8 }); K.wall(Q, SOUND.z0, H.x1 + 0.6, SOUND.z0, SF, -SF, { t: 0.8 });
  K.wall(H.x1 + 0.6, SOUND.z1, H.x0 - 0.6, SOUND.z1, SF, -SF, { t: 0.8 });
  // the stair down from the south quay to the deep floor, along its west face
  K.stairs([-Q + 3, DEEP, 42], [-Q + 3, 0, H.quayS + 0.4], 5, { sides: false });
  // the high-water line round the deep floor and the Sound, and the low one on the Sound's walls
  for (const [a, b] of [[[-Q + 0.42, H.quayS], [-Q + 0.42, SOUND.z0]], [[Q - 0.42, SOUND.z0], [Q - 0.42, H.quayS]], [[Q, H.quayS + 0.42], [-Q, H.quayS + 0.42]], [[H.x1, SOUND.z1 - 0.42], [H.x0, SOUND.z1 - 0.42]]]) tideLine(a, b, HI - 0.1);
  for (const [a, b] of [[[H.x1, SOUND.z1 - 0.42], [H.x0, SOUND.z1 - 0.42]], [[H.x0 + 0.02, SOUND.z0], [H.x0 + 0.02, SOUND.z1]], [[H.x1 - 0.02, SOUND.z1], [H.x1 - 0.02, SOUND.z0]]]) tideLine(a, b, LO - 0.1);
  // the tide staff in the Sound: a brass pole ringed every metre, coral at the two marks (seen from the Porch)
  { const sx = -14, sz = (SOUND.z0 + SOUND.z1) / 2;
    K.both(brass, T(new THREE.CylinderGeometry(0.22, 0.3, 3 - SF, 10), [sx, (SF + 3) / 2, sz]));
    for (let y = SF + 1; y < 3; y += 1) K.add(M.trim, T(new THREE.TorusGeometry(0.34, 0.05, 4, 14), [sx, y, sz], [Math.PI / 2, 0, 0]));
    for (const y of [LO, HI]) K.add(coral, T(new THREE.TorusGeometry(0.42, 0.1, 5, 16), [sx, y, sz], [Math.PI / 2, 0, 0])); }
  // the great shell hung from the roof (drawn), on brass chains; a whale's spiral inlaid in the deep floor under it
  whorl(0, 16.5, 38, 2.6, false, 9);
  for (const a of [0.4, 2.5, 4.6]) K.add(brass, T(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), [Math.sin(a) * 2.0, 22.4, 38 + Math.cos(a) * 2.0]));
  K.add(M.dark, T(annulus(5.2, 5.6, 0.04, 48), [0, DEEP + 0.03, 38]));
  K.add(coral, T(annulus(6.6, 6.8, 0.04, 48), [0, DEEP + 0.035, 38]));
  // the hall's water, swum: the Sound always, the whole hall up to under the quays with the tide in
  add(TideWater, { box: [H.x0, H.z0, H.x1, H.z1], low: LO, high: HI, name: 'the Sounding Hall' });
  // the deep floor: the west door's eye, lidded, on a pillar facing the west quay; the cradle at its foot and the ball
  // (the cradle in the deep floor's east half, in sight from the west door over the quay's lip)
  add(Switch, { id: 'eD', at: pillar(14, 34, 7.4, DEEP + 6.5, -Math.PI / 2, DEEP), yaw: -Math.PI / 2, size: 1.1, lids: true, wrong: 'The eye on the pillar stays lidded. The cradle at its foot is empty.' });
  groove([4, DEEP, 30], [14, DEEP, 30]);
  add(Ball, { id: 'b1', a: [4, DEEP + 0.04, 30], b: [14, DEEP + 0.04, 30], r: 1.0, lock: true });
  add(Plate, { id: 'p1', at: [14, DEEP, 30], r: 1.2 });
  add(Door, { id: 'd1', at: [H.x0 - 0.6, 0, WZ], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'eD' }] });
  // the Shell Room's floor door, east (the Pool Room's ball, the tide out), and the Throat's, west, the Listener's
  add(Door, { id: 'd2', at: [Q, DEEP, WZ], yaw: Math.PI / 2, ...DOOR, lamps: [{ drumOn: ['b2', 'p2'] }, LOW] });
  add(Door, { id: 'dL', at: [-Q, DEEP, LZ], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'eL' }, LOW] });
  // the Listener's column before its door: its ear on its north face beside the mouth of a dish (the gallery's twin),
  // standing out of the water even with the tide in, seen from the first step
  const C = COLUMN;
  K.column(C.x, C.z, DEEP, C.top - DEEP, 0.9);
  K.add(coral, T(new THREE.TorusGeometry(1.0, 0.12, 4, 20), [C.x, C.top - 0.9, C.z], [Math.PI / 2, 0, 0]));
  add(EchoEar, { id: 'eL', note: 'deep', lintel: true, at: [C.x - 1.0, C.ear, C.z], yaw: -Math.PI / 2, size: 1.3, reach: 3.5,
    heard: 'Down on the Listener’s column the far dish says the deep note, and the ear beside it answers.',
    deaf: 'The ear on the column hears nothing from here. Only the dish beside it reaches it.' });
  add(TideGauge, { shows: 'tide', room: 'hall', at: [8, 0, 19.5] });
  // the Horn Store's horn, before its door: a stomp by it, and the door (holding the sea back) sinks with the tide out
  ear({ id: 'eSt', note: 'deep', at: [0, DEEP, 30.5], yaw: Math.PI + 0.5, stand: 2.2, reach: 6,
    heard: 'The horn by the Horn Store’s door takes the deep note, and the door’s first lamp lights.' });
  add(TideGauge, { shows: 'tide', room: 'hall', at: [-2, DEEP, 46] });
  add(Mark, { room: 'hall', at: [-8, 0, 16.5], yaw: Math.PI * 0.25 });

  // ---- the dais (y 0, z 66..80, under the gallery): the Horn Door, two lamps on its lintel (one eye in each wing)
  add(Door, { id: 'dH', at: [HCX, 0, H.z1 + 0.6], ...DOOR, lamps: [{ lit: 'eP' }, { lit: 'eS' }] });
  add(TideGauge, { shows: 'tide', room: 'dais', at: [-6, 0, 84] });
  add(Mark, { room: 'dais', at: [2, 0, 82], yaw: Math.PI });
  K.glyph([0, 7.2, H.z1 - 0.05], 2.0, Math.PI);

  // ---- the gallery over the dais (y 10): the great horn's pipes along its lip but for the Drop; the dish and its
  // footstone; the stone weight on a post's capital under a horn's bell hung from the roof
  K.slab(H.x0 - 0.6, G.z0, H.x1 + 0.6, H.z1 + 0.6, G.y);
  { const [d0, d1] = G.drop, py = G.y + G.parapet, pz = G.z0 + 0.3;
    for (const [a, b] of [[H.x0, d0], [d1, H.x1]]) {
      K.both(M.trim, box(b - a, G.parapet, 0.5, (a + b) / 2, G.y + G.parapet / 2, pz));
      // (a pipe every 0.9 m up to the roof: you see through them, you can't pass them)
      for (let x = a + 0.45; x < b - 0.2; x += 0.9) K.both(brass, T(new THREE.CylinderGeometry(0.11, 0.13, H.top - py, 8), [x, (py + H.top) / 2, pz]));
      K.both(brass, box(b - a, 0.4, 0.5, (a + b) / 2, H.top - 1.2, pz));
    }
    // the Drop: a coral lip, a ring on the water below
    K.add(coral, box(d1 - d0 - 2 * Z_GAP, 0.12, 0.6, (d0 + d1) / 2, G.y + 0.07, G.z0 + 0.3)); }
  // (the post: a column of shell-stone, its capital the weight's ledge; over it a great horn's bell hung on chains from the
  // roof, its rim too low over the capital to stand under: the hook alone brings the weight down)
  const B = G.post;
  K.column(B.x, B.z, G.y, B.y - G.y - 0.3, 0.7);
  K.both(M.trim, box(1.2, 0.3, 1.2, B.x, B.y - 0.15, B.z));   // (the capital no wider than the weight wants: the hook's line clears its edge)
  K.both(brass, lathe([[1.6, 0], [1.45, 0.25], [1.0, 0.8], [0.7, 1.6], [0.5, 2.6], [0.01, 2.8]], 18).translate(B.x, B.y + B.hood, B.z));
  K.add(coral, T(new THREE.TorusGeometry(1.6, 0.08, 4, 24), [B.x, B.y + B.hood + 0.04, B.z], [Math.PI / 2, 0, 0]));
  for (const a of [0.5, 2.6, 4.7]) K.add(brass, T(new THREE.CylinderGeometry(0.05, 0.05, H.top - B.y - B.hood - 2.6, 4), [B.x + Math.sin(a) * 0.3, (H.top + B.y + B.hood + 2.6) / 2, B.z + Math.cos(a) * 0.3]));
  add(Weight, { id: 'wG', at: [B.x, B.y, B.z], yaw: 0, name: 'stone weight', fall: 8, zone: { min: [H.x0, G.y - 1, G.z0], max: [H.x1, B.y + 3, H.z1] },
    back: 'The weight is back on its post.' });
  add(Plate, { id: 'pG', at: [G.stone[0], G.y, G.stone[1]], r: 1.2 });
  const DG = [G.dish[0], G.y + 3.0, G.dish[1]];
  dish({ id: 'dishG', at: DG, yaw: Math.atan2(C.x - DG[0], C.z - DG[2]), tilt: -0.35, r: 1.9, when: { weightOn: ['wG', 'pG'] },
    to: { at: [C.x - 1.2, C.ear + 1.5, C.z + 1.3], yaw: -0.6, tilt: 0.3, r: 1.5 },
    dark: 'The dish on the gallery is dark and deaf: its footstone is bare. Something heavy has to stand on it.' });
  K.both(brass, T(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), [DG[0], G.y + 0.7, DG[2] + 0.3]));   // (the dish's post)
  // the makers' speaking-horns along the north wall
  for (let i = 0; i < 6; i++) {
    const x = 9 + i * 2.6;
    if (Math.abs(x - WX) < 4.5) continue;
    K.both(brass, T(new THREE.CylinderGeometry(0.18, 0.24, 2.4, 8), [x, G.y + 1.2, H.z1 - 1.2]));
    K.add(brass, T(lathe([[0.15, 0], [0.3, 0.7], [0.7, 1.3], [1.3, 1.6], [1.35, 1.65]], 14).rotateX(-Math.PI / 2), [x, G.y + 2.9, H.z1 - 0.9]));
  }
  add(TideGauge, { shows: 'tide', room: 'gallery', at: [-18, G.y, 82] });
  add(Mark, { room: 'gallery', at: [10, G.y, 84], yaw: Math.PI });

  // ---- the Pool Room (the west wing, x -58..-28, on the quay): the sea behind a glass wall across its middle; the pool's
  // eye on a pillar out in the water; the ball for the Shell Room's floor door rolled down the dry half to its cradle
  const PX = -Wg.x, GX = ROOMS.glass, px0 = PX - Wg.w / 2;
  K.corridor([H.x0 - 0.6, WZ], [PX + Wg.w / 2 + 0.6, WZ], 0, DOOR);
  K.hall({ x: PX, z: WZ, w: Wg.w, d: Wg.d, y: 0, h: Wg.h, roof: true, doors: [{ side: 'e', ...DOOR }] });
  K.add(water, box(GX - px0 - 0.4, 0.1, Wg.d - 0.4, (px0 + GX) / 2, 0.08, WZ));
  K.add(deepM, box(GX - px0 - 0.4, 3.6, 0.1, (px0 + GX) / 2, 1.9, WZ - Wg.d / 2 + 0.25));
  K.solid(box(0.3, 4.2, Wg.d, GX, 2.1, WZ));
  const poolGlass = add(Glass, { at: [GX + 0.05, 0, WZ], yaw: Math.PI / 2, w: Wg.d - 0.4, h: 4.2, color: S ? SEA_GLASS : '#bfe4e6', slip: 'The glass is too smooth to hold, and the sea is on the other side of it.' });
  add(Switch, { id: 'eP', at: pillar(PX - 8, WZ, 7.6, 6.6, Math.PI / 2), yaw: Math.PI / 2, size: 1.2 });
  // (its cradle by the glass: the Shell Room's floor door's)
  const B2 = [[PX + 9, 0, WZ - 8], [PX - 1, 0, WZ + 2]];
  groove(...B2);
  add(Ball, { id: 'b2', a: [B2[0][0], 0.04, B2[0][2]], b: [B2[1][0], 0.04, B2[1][2]], r: 1.0, friction: 0.9, lock: true });
  add(Plate, { id: 'p2', at: B2[1], r: 1.2 });
  // shelves of shells along the north wall (drawn); the tide's channel along the south wall, full with the tide in
  for (let i = 0; i < 5; i++) { K.both(brass, box(1.6, 0.15, 0.6, GX + 2.4 + i * 2.4, 2.2, WZ + Wg.d / 2 - 0.4)); whorl(GX + 2.4 + i * 2.4, 2.3, WZ + Wg.d / 2 - 0.4, 0.32, false, 5); }
  { const c0 = GX + 2, c1 = PX + Wg.w / 2 - 3, cz0 = WZ - Wg.d / 2 + 0.4, cz1 = cz0 + 1.4;
    K.add(M.dark, box(c1 - c0, 0.04, cz1 - cz0, (c0 + c1) / 2, 0.02, (cz0 + cz1) / 2));
    K.add(M.trim, box(c1 - c0 + 0.3, 0.32, 0.15, (c0 + c1) / 2, 0.16, cz1 + 0.07));
    add(TideColumn, { box: [c0, cz0, c1, cz1], y0: 0.04, low: 0.04, high: 0.3 }); }
  add(TideGauge, { shows: 'tide', room: 'pools', at: [PX + Wg.w / 2 - 2.6, 0, WZ + Wg.d / 2 - 2.6] });
  add(Mark, { room: 'pools', at: [PX + 12, 0, WZ - 7], yaw: Math.PI / 2 });

  // ---- the Shell Room (the east wing, x 28..58, on the deep floor): a great whorled shell; a ball to its plate unlids the
  // shell's eye on the pillar before it. In at its floor door with the tide out; its valve lets the sea in, and the water
  // lifts you to its ledge along its west wall and out onto the east quay
  const SX = Wg.x, sx0 = SX - Wg.w / 2, LG = sx0 + Wg.ledge;
  K.corridor([Q + 0.4, WZ], [sx0 - 0.6, WZ], DEEP, { ...DOOR, h: 9.6 });
  K.corridor([H.x1 + 0.6, WZ], [sx0 - 0.6, WZ], 0, DOOR);
  add(Door, { id: 'dE', at: [H.x1 + 0.6, 0, WZ], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'eS' }] });   // (the ledge's door onto the quay: the shell's eye, from inside)
  K.hall({ x: SX, z: WZ, w: Wg.w, d: Wg.d, y: DEEP, h: Wg.deep, roof: true, doors: [{ side: 'w', ...DOOR }, { side: 'w', ...DOOR, y0: -DEEP }] });
  K.slab(sx0 - 0.6, WZ - Wg.d / 2, LG, WZ + Wg.d / 2, 0);
  // (its parapet, but for the stage where the water lifts you out)
  for (const [a, b] of [[WZ - Wg.d / 2, WZ - 3], [WZ + 3, WZ + Wg.d / 2]]) K.both(M.trim, box(0.4, 1.1, b - a, LG - 0.2, 0.55, (a + b) / 2));
  add(TideWater, { box: [H.x1 + 0.6, WZ - Wg.d / 2, SX + Wg.w / 2, WZ + Wg.d / 2], low: LO, high: HI, name: 'the Shell Room' });
  for (const [a, b] of [[[SX + Wg.w / 2 - 0.02, WZ - Wg.d / 2], [SX + Wg.w / 2 - 0.02, WZ + Wg.d / 2]], [[LG + 0.02, WZ + Wg.d / 2], [LG + 0.02, WZ - Wg.d / 2]]]) tideLine(a, b, HI - 0.1);
  whorl(SX + 5, DEEP, WZ - 4, 2.4, 'all', 9);
  add(Switch, { id: 'eS', at: pillar(SX - 0.5, WZ - 6.5, 6.4, DEEP + 5.6, -Math.PI / 2, DEEP), yaw: -Math.PI / 2, size: 1.2, lids: true, wrong: 'The shell’s eye stays lidded. Its plate is bare.' });
  groove([SX - 8, DEEP, WZ + 7], [SX + 8, DEEP, WZ + 7]);
  add(Ball, { id: 'bS', a: [SX - 8, DEEP + 0.04, WZ + 7], b: [SX + 8, DEEP + 0.04, WZ + 7], r: 1.0, lock: true });
  add(Plate, { id: 'pS', at: [SX + 8, DEEP, WZ + 7], r: 1.2 });
  add(TideGauge, { shows: 'tide', room: 'shells', at: [SX + 11, DEEP, WZ + 11] });
  add(Mark, { room: 'shells', at: [sx0 + 3, 0, WZ - 10], yaw: Math.PI / 2 });

  // ---- the Horn Chamber (a round hall 34 m across round (HCX, HCZ)): the chest on a shell pulpit, a riding disc beside
  // it; the try; the passage horn by the north door, which holds the Song Passage's door while it rings
  const HR = ROOMS.horn.r;
  K.corridor([HCX, H.z1 + 0.6], [HCX, HCZ - HR - 1.0], 0, DOOR);
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
  // the tide's ring round the chamber's foot (full with the tide in)
  K.add(M.trim, T(annulus(HR - 0.9, HR - 0.75, 0.3, 64), [HCX, 0.3, HCZ]));
  add(TideColumn, { ring: [HCX, HCZ, HR - 0.75, HR - 0.05], y0: 0.03, low: 0.03, high: 0.26 });
  add(TideGauge, { shows: 'tide', room: 'horn', at: [HCX + 9, 0, HCZ - 9] });
  add(Mark, { room: 'horn', at: [HCX + 5, 0, HCZ - 9], yaw: -Math.PI * 0.75 });

  // ---- the Song Passage (from the chamber's north door to the tank hall's): its door at the far end, held while the
  // horn by the north door rings (or the horn on the tank hall's side, the way back)
  const TK = ROOMS.tank, TZ = (TK.z0 + TK.z1) / 2, TX = (TK.x0 + TK.x1) / 2, GW = TK.gw, GE = TK.ge, SH = TK.shelf;
  K.corridor([HCX, HCZ + HR + 1.0], [HCX, TK.z0 - 0.6], 0, DOOR);
  add(Door, { id: 'd4', at: [HCX, 0, TK.z0 - 0.6], ...DOOR, lamps: [{ lit: 'e4' }] });
  for (const s of [-1, 1]) whorl(HCX + s * 3.0, 0, HCZ + HR + 4.6, 0.45, 'all', 5);

  // ---- the Tank Hall (x -30..10, z 128..158): the sea let in behind ten metres of glass down its middle, the tide's; the
  // shelf over it, and the High Walk south from the shelf to the gallery
  K.hall({ x: TX, z: TZ, w: TK.x1 - TK.x0, d: TK.z1 - TK.z0, y: 0, h: TK.h, roof: true, doors: [{ side: 's', at: HCX - TX, ...DOOR }, { side: 's', at: WX - TX, y0: SH, ...DOOR }] });
  // (the glass: the house's one climb, held only while its rungs are out, the Glass piece slipping you off it till then;
  // its other walls are not climbed, issue #115)
  K.climbable('the Tank Hall\'s glass: its brass rungs, out while the tank\'s ear rings, up to the shelf', () => K.solid(box(0.3, SH, TK.z1 - TK.z0, GW, SH / 2, TZ)));
  const tankGlass = add(Glass, { id: 'rungs', at: [GW - 0.05, 0, TZ], yaw: -Math.PI / 2, w: TK.z1 - TK.z0 - 0.4, h: SH, color: S ? SEA_GLASS : '#bfe4e6', rungs: true, when: { lit: 'e5' },
    slip: 'The tank’s glass is too smooth to hold. Its brass frame has slots all the way up, empty.' });
  K.both(brass, box(GE - GW + 0.2, 0.3, TK.z1 - TK.z0, (GW + GE) / 2, SH - 0.15 - Z_GAP, TZ));   // (the tank's lid: a brass grating, its top Z_GAP under the shelf's)
  add(TideGlass, { glass: tankGlass, low: TIDE.tank[0], high: TIDE.tank[1] });
  // (issue #377) over the glass a screen of the house's shell up to the roof, so no bounce of the spring boots clears it, and
  // in it at the top of the rungs a hatch that opens with them (the tank's ear ringing): HATCH
  { const [hw, hh] = HATCH, z0 = TK.z0, z1 = TK.z1, top = TK.h, sx = GW + 0.02;
    K.both(M.wall, box(0.4, top - SH, TZ - hw / 2 - z0, sx, (SH + top) / 2, (z0 + TZ - hw / 2) / 2));
    K.both(M.wall, box(0.4, top - SH, z1 - (TZ + hw / 2), sx, (SH + top) / 2, (TZ + hw / 2 + z1) / 2));
    K.both(M.wall, box(0.4, top - SH - hh, hw, sx, (SH + hh + top) / 2, TZ));
    K.both(M.wall, box(0.4, 0.45, hw, sx, SH + 0.225, TZ));   // (its sill, over the glass's lit head)
    add(Door, { id: 'hatch', at: [sx, SH + 0.45, TZ], yaw: Math.PI / 2, w: hw, h: hh - 0.45, t: 0.4, lamps: [{ lit: 'e5' }] }); }
  K.both(M.wall, box(TK.x1 - GE, SH - 0.8, TK.z1 - TK.z0, (GE + TK.x1) / 2, (SH - 0.8) / 2, TZ));   // (under the shelf: solid)
  K.slab(GE, TK.z0, TK.x1, TK.z1, SH, 0.8);
  // the high-water line on the glass's frame, and a whale drawn in the tank, in the makers' brass line (the house's sign)
  tideLine([GW - 0.12, TK.z1 - 0.3], [GW - 0.12, TK.z0 + 0.3], TIDE.tank[1]);
  K.add(deepM, T(new THREE.SphereGeometry(1, 14, 8).scale(0.6, 1.4, 6), [(GW + GE) / 2 + 0.6, 5.2, TZ + 3]));
  K.add(deepM, T(new THREE.BoxGeometry(0.3, 0.5, 3.2), [(GW + GE) / 2 + 0.6, 5.2, TZ - 3.6], [0, 0, 0]));
  // its ear on the tank's floor, by the glass: it hears a stomp by the glass through the water, the tank full
  add(EchoEar, { id: 'e5', note: 'deep', at: [GW + 1.4, 0, TZ - 4], yaw: -Math.PI / 2, stand: 1.6, size: 1.1, reach: 7,
    heard: 'The boom goes through the glass and the water to the ear on the tank’s floor, and it takes the note and holds it. Brass rungs slide out of the glass’s frame, as long as it rings.',
    fading: 'The tank’s ear is fading: the rungs will slide back.',
    deaf: 'The ear on the tank’s floor lies dry. With the tank empty, nothing carries the note to it.' });
  // the way back: a dish by the Song Passage's door, its twin over the passage horn in the Horn Chamber (a stomp by it is
  // heard there, and the door sinks while the horn rings)
  { const DP = [HCX + 4, 3.0, TK.z0 + 6];
    dish({ at: DP, yaw: Math.PI - 0.3, tilt: 0.1, r: 1.8, to: { at: [HCX + 3.6, 3.2, HCZ + 11.5], yaw: Math.PI + 0.4, tilt: 0.2, r: 1.6 } });
    K.both(brass, T(new THREE.CylinderGeometry(0.2, 0.28, 1.4, 8), [DP[0], 0.7, DP[2] + 0.3])); }
  if (rt.skin) rt.skinGlass = [
    { a: [GW, 0, TZ], along: [0, 0, 1], L: TK.z1 - TK.z0 - 0.4, h: SH, out: [-1, 0, 0], glass: tankGlass, header: false },
    { a: [GX, 0, WZ], along: [0, 0, 1], L: Wg.d - 0.4, h: 4.2, out: [1, 0, 0], glass: poolGlass },
  ];
  for (const [x, z] of [[TK.x0 + 2.5, TK.z0 + 8], [TK.x0 + 2.5, TK.z1 - 8]]) whorl(x, 0, z, 0.8, 'all', 6);
  add(TideGauge, { shows: 'tide', room: 'tank', at: [TK.x0 + 3, 0, TK.z1 - 4] });
  add(Mark, { room: 'tank', at: [TK.x0 + 5, 0, TK.z0 + 3], yaw: Math.PI / 2 });
  // the shelf (the gallery's room): a window of the sea in the north wall, and its speaking-horns
  K.add(deepM, box(8, 5, 0.1, (GE + TK.x1) / 2, SH + 5, TK.z1 - 0.05));
  for (let i = 0; i <= 4; i++) K.add(M.trim, box(0.14, 5.2, 0.2, (GE + TK.x1) / 2 - 4 + i * 2, SH + 5, TK.z1 - 0.1));

  // ---- the High Walk: from the shelf's south door to the gallery, 47 m along the Horn Chamber's side
  K.corridor([WX, H.z1 + 0.6], [WX, TK.z0 - 0.6], G.y, DOOR);
  for (let z = H.z1 + 6; z < TK.z0 - 4; z += 8) for (const s of [-1, 1]) whorl(WX + s * 3.0, G.y, z, 0.35, 'all', 5);

  // ---- the Throat: from the Listener's door west under the Pool Room, a long stair down to its hall (7 m wide)
  const T0 = -Q - 0.4, T1 = -30, T2 = -54, fy = (x) => (x >= T1 ? DEEP : DEEP + (AY - DEEP) * Math.min(1, (T1 - x) / (T1 - T2)));
  K.corridor([T0, LZ], [T1, LZ], DEEP, { ...DOOR, h: 9.6 });
  K.stairs([T2, AY, LZ], [T1, DEEP, LZ], DOOR.w, { sides: false });
  for (let i = 0; i < 8; i++) {
    const xa = T1 + ((T2 - T1) * i) / 8, xb = T1 + ((T2 - T1) * (i + 1)) / 8, y0 = fy(xb) - 0.8, y1 = fy(xa) + 10;
    K.wall(xa, LZ - 4.2, xb, LZ - 4.2, y0, y1 - y0, { t: 0.8 }); K.wall(xb, LZ + 4.2, xa, LZ + 4.2, y0, y1 - y0, { t: 0.8 });
  }
  K.ramp([T1, DEEP + 10, LZ], [T2, AY + 10, LZ], 9.2, { t: 0.8 });
  for (let x = T1 - 4; x > T2 + 2; x -= 6) for (const s of [-1, 1]) whorl(x, fy(x), LZ + s * 3.0, 0.3, 'all', 5);
  // the antechamber: the stair's foot, to the Listener's door
  K.corridor([T2, LZ], [ACX + AR + 0.6, LZ], AY, { ...DOOR, h: 9.6 });
  add(Mark, { room: 'ante', at: [T2 - 3, AY, LZ - 1.8], yaw: Math.PI });
  add(TideGauge, { shows: 'tide', room: 'ante', at: [T2 - 6, AY, LZ + 2.6] });
  add(Door, { id: 'dA', at: [ACX + AR + 0.7, AY, LZ], yaw: Math.PI / 2, ...DOOR });

  // ---- the Listener's Hall (a rotunda round (ACX, AY, ACZ), its way in from the east): its pool, the dishes on the
  // wall, their footstones and balls. (A: the hall's own frame, `s` across its way in, `f` along it, to the house's)
  const A = (s, y, f) => [ACX - f, y, ACZ + s], AYAW = -Math.PI / 2;
  K.rotunda({ x: ACX, z: ACZ, y: AY, r: AR, h: 18, seg: 36, gaps: [{ a: Math.PI / 2, ...DOOR }, { a: -Math.PI / 2, ...DOOR }], oculus: 0 });
  K.add(water, T(new THREE.CylinderGeometry(6.5, 6.5, 0.06, 40), A(0, AY + 0.04, 4)));
  K.add(coral, T(annulus(6.5, 7.0, 0.08, 48), A(0, AY + 0.06, 4)));
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'W' : 'E';
    groove(A(s * 8.5, AY, 4), A(s * 14.6, AY, 4));
    add(Ball, { id: `b${id}`, a: A(s * 8.5, AY + 0.04, 4), b: A(s * 14.6, AY + 0.04, 4), r: 1.0, friction: 1.2 });
    add(Plate, { id: `p${id}`, at: A(s * 14.6, AY, 4), r: 1.2 });
    add(Dish, { id: `dish${id}`, at: A(s * 16.9, AY + 2.8, 4), yaw: (s < 0 ? Math.PI / 2 : -Math.PI / 2) + AYAW, tilt: 0.1, r: 1.8, when: { drumOn: [`b${id}`, `p${id}`] },
      to: { at: A(s * 6, AY + 8.6, AR - 1.4), yaw: Math.PI + AYAW, tilt: 0.45, r: 2.2 },
      dark: 'The dish on the wall is dark and deaf: its footstone is bare.' });
  }
  for (const a of [0.6, 2.3, 3.9, 5.6]) whorl(...A(Math.sin(a) * (AR - 2), AY, Math.cos(a) * (AR - 2)), 1.0, 'all', 6);
  // (issue #562) the tide the hall was built dry against: once the Listener sings again the sea wells up out of its pool
  // and over the floor, a hand deep (underwater onCalm; its ending lets it in over its own panel). Drawn only: nothing
  // swims in it, as in the pool
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 48), drawnSea());
    m.position.copy(K.world(...A(0, AY + 0.1, 4))); m.visible = false;   // (its top over the coral rim's: no face shared)
    m.userData.noCollide = true; m.userData.dynamic = true;
    rt.root.add(m);
    rt.hallTide = { m, y: m.position.y, edges: [-1, 1].map((sd) => K.world(...A(sd * 9.5, AY + 0.4, 4))) };
  }
  add(Door, { id: 'd5', at: A(0, AY, AR + 0.7), yaw: Math.PI / 2, ...DOOR, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door, issue #356)
  const E0 = AR + 0.6, E1 = AR + 10;
  K.slab(ACX - E1, ACZ - 4.2, ACX - E0, ACZ + 4.2, AY, 0.8);
  K.wall(ACX - E0 - 0.8, ACZ + 4.2, ACX - E1, ACZ + 4.2, AY, 10, { t: 0.8 }); K.wall(ACX - E1, ACZ - 4.2, ACX - E0 - 0.8, ACZ - 4.2, AY, 10, { t: 0.8 });
  K.wall(ACX - E1, ACZ + 4.2, ACX - E1, ACZ - 4.2, AY, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.4, 0.8, 9.2, ACX - E0 - 5.1, AY + 10.4, ACZ));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [ACX - E1 - 0.5, AY, ACZ], [0, Math.PI / 2, 0]));
  K.solid(box(0.1, 5, 4, ACX - E1 - 0.5, AY + 2.5, ACZ));

  const model = listenerModel();
  model.pos.copy(K.world(...A(0, AY, 6)));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI + AYAW);
  model.rest = K.world(...A(0, AY, 8));
  model.restHeading = K.heading(Math.PI + AYAW);
  const arena = { center: K.world(ACX, AY, ACZ), r: AR, y: K.world(0, AY, 0).y };

  // (the wing last: its mark after the others)
  store(rt, K, M, { brass, whorl });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(ACX - E1 - 4, AY - 4, STORE.z - STORE.d / 2 - 3), V(62, H.top + 5, TK.z1 + 2)),
    gadget: { at: W(HCX, PT, HCZ).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(...A(0, AY + 0.5, E1 - 0.4)), r: 1.5, to: V(KEEPERS_HATCH.x, 0.1, KEEPERS_HATCH.z), heading: KEEPERS_HATCH.heading }],
    lights: [[0, 6, 6, 12], [0, 12, 26, 30], [0, 2, 42, 26], [0, 5, 78, 22], [0, 16, 76, 24], [-Wg.x, 9, WZ, 22], [Wg.x, 1, WZ, 24], [HCX, 9, HCZ, 20], [HCX, 5, TK.z0 - 4, 10],
      [-18, 11, TZ, 24], [5, 15, TZ, 16], [WX, 15, (H.z1 + TK.z0) / 2, 14], [STORE.x, DEEP + 9, STORE.z, 22], [-42, -12, LZ, 16], [T2 - 4, AY + 5, LZ, 12], [ACX, AY + 9, ACZ, 30]],
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
  // (the drawing's coral-framed round door: three frames stepping back, sealing the tube's end, to the dark, aquamarine light: src/temples/portal.js)
  const P = portal(K, { y: 0, z: FZ - .9, w: 4.4, h: 6.6, shape: 'round', layers: 3, step: .9, recess: .5, back: 1.3, into: 1.5,
    frame: coral, inlay: '#7ff5e0', sill: false });
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
  return { door: { at: K.world(0, 0, DZ), heading: 0, ...P.door }, kit: K, glowM, clear: [{ x: SITE.x, z: SITE.z - 2, r: 68 }] };
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
  gadget: 'springs', arenas: ARENAS, gadgetBox: 'underwater.temple.horn', arenaDoor: 'dA',   // (the box's id from when it held the horn: the saves' flag)
  origin: [0, 1600, -150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  skin: whaleHouseSkin,   // (its look inside: src/temples/skins/whale-house.js, issue #342)
  local: { person: 'achille', out: 7, side: 1.2 },
  enterLine: 'Inside the Whale-House it is dry and cool and smells of brass and salt. The walls hum one high note, very softly: not a whale’s.',
  pitLine: 'You climb back up, to the last glyph stone.',
  onResolved(rt) { rt.notice('The whales are coming back. The way out comes up in the divers’ court.', 'resolved.out'); },
  /** (issue #562) The tide in: the sea wells up out of the Listener's pool and spreads over its hall's floor (rt.calmK: its ending lets it in over its own panel). */
  onCalm(rt, k) {
    const T = rt.hallTide;
    if (!T) return;
    const e = k * k * (3 - 2 * k), r = 6.4 + 5.6 * e;
    T.m.visible = k > 0.01;
    T.m.scale.set(r, 1, r);
    T.m.position.y = T.y + 0.12 * e;
  },
  // (v1.77) the Pool Room's ball in its cradle by the glass: the Shell Room's floor door, across the hall, sinks if the sea
  // is out (said once, as it lands; out of sight of it)
  onUpdate(rt) {
    const on = rt.logic.drumOn('b2', 'p2');
    if (on && rt.poolBall === false) rt.notice(rt.logic.check(LOW) ? 'The ball settles in its cradle. On the deep floor, the east door sinks.' : 'The ball settles. Under the water, the east door’s lamp lights.', 'p2.on');
    rt.poolBall = on;
  },
  onLit(rt, id) {
    if (id === 'eD') rt.notice('The eye on the pillar wakes, and up on the quay the west door sinks.', 'eD.lit');
    if (id === 'eP' || id === 'eS') rt.notice(rt.logic.isLit('eP') && rt.logic.isLit('eS') ? 'Both lamps on the Horn Door are lit, and it sinks.' : 'One lamp on the Horn Door lights. One to go.', `dH.${id}`);
    if (id === 'eS') rt.notice('Up on the ledge, the door to the quay sinks.', 'dE.lit');
    if (id === 'eL') rt.notice(rt.logic.check(LOW) ? 'Down on the deep floor, the Listener’s door sinks.' : 'Under the water, the Listener’s door stays shut. It holds the sea back.', 'eL.door');
  },
  // the Listener's ear: in its first phase it hears the horn close by while it listens; from its second it shuts its
  // ear to anything near it and only the hall's dishes reach it (a ball on a footstone wakes a dish); shifting into its
  // last it knocks the balls off the footstones
  onConnect(rt) {
    // (issue #377) a stomp of the spring boots in the house is the deep note: shell and water carry its boom, and the house's
    // ears and dishes take it as they took the whale-horn's
    rt.offs.push(rt.game.on('gadget:stomp', ({ at } = {}) => {
      if (!at || !rt.logic.has('springs') || !(rt.inside(at) || rt.below(at))) return;
      rt.game.emit('echo', { pos: at.clone().add(V(0, 1.2, 0)), note: 'deep', degree: STOMP_NOTE.degree, color: STOMP_NOTE.color, stomp: true });
    }));
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
