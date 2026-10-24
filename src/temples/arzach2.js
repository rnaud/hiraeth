import { landmark, LANDMARK_SCALE } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, sector } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, BellEar, HookBell, Switch, Mark, Pit, Key } from './pieces.js';
import { whaleModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { foundersBelfrySkin } from './skins/founders-belfry.js';
import { registerInteractable, PRIORITY } from '../interact.js';

// Vael II's temple: the Founders' Belfry, a tower of bone-white stone that
// rises straight out of the cloud beside the starting plateau, a bridge from
// the plateau's west rim to its door. The monks say the founders built it
// before the monastery, to keep the stones down: a bell in every room, and the
// stones stayed where they were put. The bells stopped; the stones fell up.
// Something swims in the top of the tower, and cries.
//
// Inside (built far overhead, through its door). The temple's one idea: a founders' bell holds things only
// while it rings; a stone's weight holds them for good. Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms
// are shrines: every hall 36 m across (or a round hall 34) under 18 m of stone or more, doors 7 by 9 (ROOMS, DOOR), each
// puzzle in the middle of its own room, the one fight in a room of its own, the upper house on a floor 8 m up (UP).
//   the Threshold          the first mark, the way out
//   the Hall of Stones     a hub (a passage): the door on has a lamp and a keyhole, and two archways open off the hall,
//                          west and east, into the two stone stores. The west store is the house's one fight (v1.49,
//                          issue #23): an arena, its archway shut behind you while its keepers stand round its middle,
//                          and won, the small key's cage sinks; in the middle of the east one a ball, a plate at its
//                          groove's end: roll it home (the push). The key and the ball, in your own order, and the door
//                          sinks.
//   the Stone Stair        a round well whose stair fell up: one great stone hangs at the top of it, by the landing and
//                          the high door. In the middle of the floor hangs a founders' bell with no clapper, and a stone
//                          ball lies in a groove that runs into its mouth: roll the ball in and it strikes the bell
//                          (a splash on it as it lies there strikes again). While the bell rings the great stone
//                          comes down to the floor; when it falls quiet the stone falls up again, and whoever
//                          stands on it goes up with it (the house's own bell, taught before the hook: what
//                          the bell holds, it holds only while it rings). The high door's eye is on the
//                          landing's face, under your feet once you are up: splash it on the way
//   the Bell Chamber       the makers' chest: the GRAPPLING HOOK (src/gadgets/hook.js; issue #377: the bell-note whistle
//                          was here, a charm, and went to Vael's makers' court). Its north door sinks for the hook in
//                          your hand. The clapperless bell in the oculus hangs a brass pull-ring (HookBell) out of any
//                          reach: hook it and the bell booms, three stones that fell up come down round the dais while it
//                          rings, and fall up again (a try where nothing is locked)
//   the Bell Porch         a room on: the door into the Hall of Echoes is held by the porch's own bell, hung in the
//                          middle of the room, open only while it rings (about eight seconds). Hook its ring, walk
//                          through; too slow, hook it again (the hook's first lock, where failing costs nothing)
//   the Hall of Echoes     a chasm across its middle, the stones of its bridge hanging high over it (they fell up), and
//                          a bell hung over the chasm's east side: hooked from the near lip it brings the stones down
//                          only while it rings, ten seconds, enough to run across. But the
//                          far door wants a ball on its plate too, and the ball waits at the near edge in a
//                          groove that runs over the bridge: ring, then roll the ball across while the
//                          stones are down (it stops at the lip while they hang, and drops if they rise
//                          under it). On its plate on the far lip its weight holds the stones down for good.
//                          Half-way over, a spur of the same stones runs off the bridge to a doorway in the west wall,
//                          and no ball holds it: ring, and run (since issue #23's last round)
//   the Ringers' Walk      through that doorway: a long passage back south outside the house, the ringers' way, and up
//                          a stair to a ledge high in the Stone Stair, over the landing. On it, the house's great key,
//                          seen from the stair at the start and out of reach from there, the founders' bell in sight
//                          below it: hook its ring from the ledge, and while it booms the cage sinks. Drop onto the
//                          landing, and climb the house again with the hook: the porch's bell, the stones held for
//                          good, the far door's bell over its lintel (it takes the great key). A ring through both
//                          halves of the house
//   the Cloud-Mother's Hall the guardian (organic: you calm her). She swims high and fearful, gusts and dives; four
//                          founders' bells hang round her hall, a pull-ring under each: each time she cries, low, her
//                          mouth open, hook the bell near her. Stones that fell
//                          up hang under the dome: a ring as she rises to dive brings one down where she will
//                          dive, held only while the note sounds, and she dives onto it and lies on it, crying
//                          (taught in her second phase; in her last she no longer sinks to cry by herself, so
//                          the stone is the way to her). Worn out, she lies down: lay a hand on her brow
// After: the stones that fell up come down, all over Vael II (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** Out of the cloud west of the starting plateau; its door looks east, to a bridge from the plateau's rim. */
export const SITE = { x: -128, z: -6, r: 18, rim: [-86, -6] };
SITE.heading = Math.PI / 2;   // (the door faces +x, the plateau)

/**
 * The belfry's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/founders-belfry):
 * bone-white stone in big smooth blocks, warm bone floors, the founders' bells in old bronze (BRONZE), little bronze bells
 * in niches under every frieze, the glyphs carved and bronze; its shade a warm rose-lavender over the white (Vael II's
 * sky prints its shade flat in grey-blue, and turned the tower blue with it), its light warm.
 */
export const PALETTE = {
  wall: '#f2e9dc', wall2: '#ece2d2', wall3: '#f7f0e6', floor: '#ece0cc', floor2: '#ded1bb', trim: '#f7f0e6', fitting: '#a8874a',
  dark: '#4a3a4c', stone: '#efe6d8', accent: '#d99072', glow: '#a8e6ee', glyph: '#a8874a', lamp: '#f6c84e', sand: '#e8dfcb', sand2: '#d9c7aa',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.85, shade: 0.45, spot: 0.4 },
    wall: { mode: 0, grid: 3.6, plates: true },
    glyph: { glow: 0.12 },
  },
  bands: [{ at: 0.72, h: 0.7, color: '#e6d8c4' }],
  ornament: { kind: 'bell', color: '#a8874a', color2: '#e6c690', metal: 'brass' },
  light: { shadow: '#d4bccb', light: '#fff4e6', sun: '#ffe8c8' },
};
/** The founders' bronze: the bells, old and warm, a little green. */
const BRONZE = () => makeMaterial({ color: '#9c7c46', flat: true, metal: 'brass', refl: 0.35, key: 'temple.arzach2.bronze' });

/**
 * The house's doors (m: issue #336, 4 to 5 by 5.5 to 6.6 before), the upper house's floor (the landing, the Bell
 * Chamber, the porch, the Hall of Echoes and her hall: 16 before; 8 now, so the Ringers' Walk's ledge stands 16 m over
 * the Stone Stair's floor and 8 over its landing, the founders' bell in sight below it), and the rooms in the kit's
 * local frame (z into the house): each hall's floor from wall to wall, its floor's height and its ceiling's; the round
 * halls' middles and radii. The Hall of Echoes' chasm runs from `lip` to `far` (m from its south wall).
 */
export const DOOR = { w: 7, h: 9 };
export const UP = 8;
/**
 * (issue #408) The Great Belfry, the house's great hall (G4: docs/design/temple-best-practices.md): `nave` its floor from
 * wall to wall, 40 by 66 m under 32; its gallery at UP round three sides (GALLERY: the north band's south edge `n`, the
 * arms' inner edges `w`, `e`, how far south they run `s`), open over the floor, and the great key's ledge high on its west
 * wall (RING). The rooms after it on the upper floor stand SHIFT m further north than they did round the Stone Stair.
 */
const SHIFT = 32.6;
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  stones: { x0: -18, x1: 18, z0: 15.2, z1: 51.2, y: 0, top: 18 },
  storeW: { x0: -49.2, x1: -19.2, z0: 15.2, z1: 51.2, y: 0, top: 18 },
  storeE: { x0: 19.2, x1: 49.2, z0: 15.2, z1: 51.2, y: 0, top: 18 },
  nave: { x0: -20, x1: 20, z0: 56, z1: 122, y: 0, top: 32 },
  bell: { x: 0, z: 110.8 + SHIFT, r: 17, y: UP, top: UP + 18 },
  porch: { x0: -18, x1: 18, z0: 132.8 + SHIFT, z1: 160.8 + SHIFT, y: UP, top: UP + 18 },
  echoes: { x0: -18, x1: 18, z0: 165.6 + SHIFT, z1: 215.6 + SHIFT, y: UP - 10, top: UP + 18, lip: 13.8, far: 34 },
  hall: { x: 0, z: 245.8 + SHIFT, r: 21, y: UP, top: UP + 26 },
};
export const GALLERY = { n: 108, w: -13, e: 13, s: 70, t: 0.8, parapet: 1.1 };
/**
 * (issue #408) The founders' bell, the house's one state: hung in the middle of the Great Belfry (`at`: its mouth, `s` its
 * size, `ring` its pull-ring's height), rung or still. Rung, the stones the founders set come down all through the house;
 * stilled, its hum fades for `fade` s and they fall up again. Set at a lever by every hub (`levers`: local [x, y, z], the
 * way each faces), with the hook at its ring, or at the Hall of Echoes' bell, which answers it (`rings`: the pull-rings
 * that set it).
 */
export const FOUNDERS = {
  at: [0, 12.5, 95], s: 1.8, ring: 10.1, fade: 10,
  levers: [{ room: 'stones', at: [7, 0, 47.5], yaw: Math.PI }, { room: 'stair', at: [-5, 0, 60.5], yaw: Math.PI }, { room: 'landing', at: [-8.5, UP, 119.5], yaw: Math.PI }],
  rings: ['hb.founders', 'hb.e1', 'hb.e2'],
};
/** (issue #408) The bell's two stops, as conditions: rung (its stones down) and still (fallen up). */
export const RUNG = { drumOn: ['bell', 'bellRung'] }, STILL = { drumOn: ['bell', 'bellStill'] };

export const LOGIC = {
  id: 'arzach2', entry: 'threshold', gadget: 'hook',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js. The
  // Bell Chamber holds the hook and its try; the Bell Porch past its open way is a room of its own since v1.77. Since v1.83
  // (issue #408) `stair` is the Great Belfry's floor and `landing` its gallery: the ids kept, so a save's last mark holds)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, stones: { checkpoint: true, kind: 'passage' }, storeW: { kind: 'combat' }, storeE: { kind: 'puzzle' },
    stair: { checkpoint: true, kind: 'puzzle' }, landing: { kind: 'passage' }, bell: { checkpoint: true, kind: 'puzzle' }, porch: { checkpoint: true, kind: 'puzzle' },
    echoes: { checkpoint: true, kind: 'puzzle' }, echoesFar: { checkpoint: true, kind: 'puzzle' }, ringers: { checkpoint: true, kind: 'passage' },
    ante: { checkpoint: true, kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'stones' },
    { a: 'stones', b: 'storeW', door: 'dSW' },      // (open: it shuts behind you while its keepers stand)
    { a: 'stones', b: 'storeE' },
    { a: 'stones', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'landing', door: 'lift' },     // the great stone: rung down to the floor, stilled it falls up with you on it
    { a: 'landing', b: 'stair', oneWay: true },     // (G6, issue #408: the drop off the gallery, back to the hub's floor)
    { a: 'landing', b: 'bell', door: 'd2' },
    { a: 'bell', b: 'porch', door: 'dP' },          // the chamber's north door: it sinks for the hook in your hand
    { a: 'porch', b: 'echoes', door: 'd3' },        // the Bell Porch's held door, a room on from the chest
    // (issue #23's last round: a ring through both halves. Since v1.83, issue #408: the spur off the bridge's middle stands
    // while the founders' bell is still, to the Ringers' Walk back south and up to the great key's ledge high in the Great
    // Belfry, a drop onto its gallery)
    { a: 'echoes', b: 'ringers', door: 'spur' },
    { a: 'ringers', b: 'landing', oneWay: true },
    { a: 'echoes', b: 'echoesFar', door: 'br1' },
    { a: 'echoesFar', b: 'ante', door: 'd4' },
    { a: 'ante', b: 'hall' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the west store, an arena since v1.49: its keepers beaten among the stones brought back down, the small key's cage sinks
    arW: { type: 'arena', room: 'storeW' },
    kW: { type: 'key', kind: 'small', room: 'storeW', when: { lit: 'arW' } },
    dSW: { type: 'door', opens: null },
    p2: { type: 'plate', room: 'storeE' },
    ball2: { type: 'drum', room: 'storeE', plate: 'p2', plateAt: 1, start: 0 },
    d1: { type: 'door', lock: 'small', opens: { drumOn: ['ball2', 'p2'] }, latch: true },   // (the ball's weight: you alone are not enough)
    // the Great Belfry (issue #408): the great stone comes down to its floor while the founders' bell rings, and falls up
    // with you on it when it is stilled; the eye under the gallery's north band wakes the high door
    lift: { type: 'door', opens: RUNG, latch: true },
    s1: { type: 'switch', room: 'stair' },
    d2: { type: 'door', opens: { lit: 's1' }, latch: true },
    // (issue #377: the chest held the bell-note whistle, a charm that finds chests; the hook rings the founders' bells by
    // their pull-rings now, HookBell, and the whistle waits in Vael's makers' court)
    chest: { type: 'gadget', room: 'bell', item: 'hook' },
    dP: { type: 'door', opens: { item: 'hook' }, latch: true },
    // the Bell Porch (issue #408): its door's slab is one of the founders' stones; the first time the founders' bell rings
    // once the chamber's north door is open, it sinks into its socket and stays. The porch's own bell, in its middle,
    // answers that bell: hooked, it rings it or stills it (as the Hall of Echoes' does)
    d3: { type: 'door', opens: { all: [RUNG, { open: 'dP' }] }, latch: true },
    // the Hall of Echoes (issue #408): the bridge's stones come down while the founders' bell rings, and the ball's weight on
    // the far plate holds them for good. The spur off its middle, west to the Ringers' Walk, is other stones, lying on the
    // chasm's floor while the bell rings, that fall up level with the bridge while it is still. The walk ends on the great
    // key's ledge, high in the Great Belfry (since issue #408 the key lies free: the ledge is its lock, v1.74's cage cut)
    ball3: { type: 'drum', room: 'echoes', plate: 'p3', plateAt: 1, start: 0 },
    p3: { type: 'plate', room: 'echoes' },   // (on the far lip, in the same hall as its ball: nothing rolled through a door)
    br1: { type: 'bridge', opens: { any: [RUNG, { drumOn: ['ball3', 'p3'] }] } },
    spur: { type: 'bridge', opens: STILL },
    kB: { type: 'key', kind: 'big', room: 'ringers' },
    // the far door: the great key, the ball on its plate, and its slab one of the founders' stones, sunk while the bell rings
    // (from the far lip, the hook rings the Hall of Echoes' bell, which answers the founders' bell)
    d4: { type: 'door', lock: 'big', opens: { all: [{ drumOn: ['ball3', 'p3'] }, RUNG] }, latch: true },
    mother: { type: 'boss', room: 'hall', needs: ['gun', 'hook'] },
    d5: { type: 'door', opens: { resolved: true } },
    // (issue #408) the founders' bell, the house's state: still (0) or rung (1), saved. Set at the levers by the hubs (the
    // Hall of Stones, the Great Belfry's floor and its gallery), with the hook at its ring (from the gallery) or at the Hall
    // of Echoes' bell, which answers it (from either lip). Its two stops are no plates anyone stands on (no room: nothing
    // points at them). (Last of the things to do, so the scout asks for it only once nothing nearer is left: logic.next)
    bell: { type: 'drum', room: 'stair', rooms: ['stones', 'stair', 'landing', ...['porch', 'echoes', 'echoesFar'].map((room) => ({ room, needs: ['hook'] }))], stops: { bellStill: 0, bellRung: 1 }, start: 0, roll: 'hand', verb: 'bell' },
    bellStill: { type: 'plate' }, bellRung: { type: 'plate' },
    // the chamber's own bell in the oculus: stones come down round the dais while it rings (nothing is locked by it; last,
    // so the scout never asks for a try)
    eT: { type: 'bell', room: 'bell', needs: ['hook'], hold: 6 },
    heap: { type: 'bridge', opens: { lit: 'eT' } },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'stair', at: [-9, 0, 65], yaw: 0, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
  },
};

/** The west store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arW', room: 'storeW', zone: { min: [ROOMS.storeW.x0, -1, ROOMS.storeW.z0], max: [ROOMS.storeW.x1, 10, ROOMS.storeW.z1] }, doors: ['dSW'], extra: 2,
  shut: 'The archway grinds shut behind you. Among the stones brought back down, something gets up.',
  won: 'The last of them falls among the stones. The key’s cage sinks, and the archway lets go.',
}];

/**
 * (issue #377) The Hall of Echoes' bell (local: over the chasm's east side, by the bridge's middle, its mouth's height) and the
 * Cloud-Mother's four, [x, 0, z] from her hall's middle, high round its wall between the columns.
 */
export const BELL2 = [10, UP + 8, ROOMS.echoes.z0 + 24];
export const HALL_BELLS = [[12, 0, 12], [-12, 0, 12], [-12, 0, -12], [12, 0, -12]];

/** The held notes: how long the founders' bells hold their door and their stones (s). */
export const HOLD = { chamber: LOGIC.elements.eT.hold, fade: FOUNDERS.fade, stones: 10 };   // (stones: how long a note holds a stone under the Cloud-Mother, HallStones)
/**
 * The Ringers' Walk (issue #23's last round; since v1.83, issue #408, to the Great Belfry; local m): its doorway in the
 * Hall of Echoes' west wall half-way over (z, the spur's), the walk's middle (x) and half its width, its doorways' width
 * and height; its floor at UP to its stair (`stairs`: foot and head, z), then RING.y to its south end (`south`), where it
 * turns east (at `in`) through the Great Belfry's west wall onto the ledge high over its west gallery (`ledge`: x and z,
 * open along its edges: any way off it drops onto the gallery). The great key on it (`key`: x, z), free by its edge,
 * seen from the Great Belfry's floor; the founders' bell in sight from it and under 20 m (issue
 * #336: v1.74's edit 1, its cage at 1.0, cut). The great stone (`lift`: x, z, r) rides between the floor and the gallery's
 * north band.
 */
export const RING = {
  z: ROOMS.echoes.z0 + 24, x: -26, half: 3, w: 6, door: 8, y: 16, stairs: [150, 132], south: 94, in: 99,
  ledge: { x0: ROOMS.nave.x0, x1: -13.6, z0: 91, z1: 107 }, key: [-15, 101],
  lift: { x: -4, z: GALLERY.n - 2.2, r: 2.2 },
};
/** How long the Cloud-Mother lies on a held stone she dived onto, crying (s): a bell rung near her calms her then. */
export const GROUNDED = 4.5;

export const MOTHER = {
  kind: 'organic', name: 'the Cloud-Mother', final: 'touch', touch: 'lay a hand on her brow',
  speed: 3.2, wakeTime: 3.4,
  wake: 'A sky-whale turns over at the top of the tower. She is afraid of you.',
  openHint: 'She sinks low and cries. Hook the bell nearest her.',
  missHint: 'Her dive went wide: she lies caught, crying. Hook the bell nearest her.',
  weary: 'She settles on the floor of her hall, listening. Go to her.',
  resolved: 'She sighs, and the cloud along her back thins away.',
  phases: [
    { to: 0.5, attacks: ['gust', 'dive', 'wail'], pause: 1.8, hint: 'When she cries, hook the ring of the bell nearest her.' },
    { to: 0.7, attacks: ['roll', 'dive', 'gust'], pause: 1.4, hint: 'Hook a bell as she rises to dive: a stone drops where she dives.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'parry', moves: ['roll'], open: 3.6, perfect: 4.6,
        hint: 'Guard her wing as it rolls at you: jarred, she sinks and cries.',
        said: 'Her wing rings off your guard. She sinks low, crying: hook a bell.',
        lines: ['She rolls her wing at you.', 'Raise your guard as her wing rolls in: jarred, she sinks and cries.', 'When she tips onto one wing, hold the guard (LB / L1) toward her, then hook the bell nearest her ({key:aim}, {key:fire}).'] } },
    { to: 0.9, attacks: ['dive', 'rain', 'roll'], pause: 1.2, hint: 'Hook a bell as she rises: a stone drops under her. Again as she cries.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    gust: { shape: 'cone', range: 14, angle: 0.55, wind: 1.3, track: 0.6, part: 'mouth', rig: 'swell', blast: { kind: 'front', r0: 3, h: 2.5 }, damage: 0.75, knock: 12, recover: 0.9 },
    // (a dive that misses you wedges her on the floor a while longer: missHint. In her last phase only a held stone
    // opens her, missed or not: motherOpen)
    dive: { shape: 'ring', at: 'player', radius: 4.6, wind: 1.6, track: 0.55, over: true, part: 'core', rig: 'rise', parts: ['body'], splash: 0.5, active: 0.45, damage: 1, knock: 9, recover: 1.0, open: 3.0, miss: 4.4 },
    wail: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 11, recover: 0.8, open: 2.6 },
    roll: { shape: 'cone', range: 10, angle: 1.0, wind: 1.2, track: 0.6, part: 'wings', rig: 'coil', side: 1, blast: { kind: 'front', r0: 3, h: 1.6 }, gap: 0.65, damage: 0.75, knock: 11, recover: 0.6, then: 'tail' },
    tail: { shape: 'ring', at: 'self', radius: 7, wind: 0.75, part: 'tail', rig: 'coil', side: -1, link: true, blast: { kind: 'front', r0: 3, h: 1.4 }, damage: 0.5, knock: 9, gap: 0.25, then: 'wailEnd' },
    wailEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'swell', pose: 'wail', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 11, recover: 0.8, open: 2.6 },
    rain: { shape: 'ring', at: 'player', lob: true, volley: 4, radius: 2, wind: 1.5, track: 0.6, part: 'core', rig: 'swell', damage: 0.5, knock: 6, recover: 0.6, then: 'diveEnd' },
    diveEnd: { shape: 'ring', at: 'player', radius: 4.6, wind: 1.3, track: 0.55, over: true, part: 'core', rig: 'rise', pose: 'dive', link: true, parts: ['body'], splash: 0.5, active: 0.45, damage: 1, knock: 9, recover: 1.0, open: 3.0, miss: 4.4 },
  },
};

/** The fluid does not calm her (it only frightens her), nor the hook on her: a bell does (motherBell). */
function motherHit(g, part, mode, info) {
  const rt = g.rt;
  if (info?.mode === 'hook') { rt.notice('She shies from the hook, crying louder. Hook a bell, not her.', 'mother.hook'); return true; }
  if (mode === 'push') { g.add(-0.05, 'push'); rt.notice('She shies from the shove, crying louder. Gently.', 'mother.push'); return true; }
  if (g.state === 'open') rt.notice('The fluid only frightens her. She wants a sound: a bell.', 'mother.fluid');
  else rt.notice('She flinches from the splash.', 'mother.splash');
  return true;
}
/**
 * A founders' bell rung (its ring hooked: HookBell, issue #377; the bell-note whistle before). Rung near her while she
 * cries: an eighth (then a tenth) of her calm. Rung as she rises to dive (a dive's wind-up): a stone that fell up comes
 * down where she will dive, held while the note sounds.
 */
export function motherBell(g, pos) {
  if (!pos || !g.awake) return;
  const rt = g.rt, a = g.attack;
  if (g.state === 'fight' && a?.over && !g.struck && rt.hallStones) {
    if (rt.hallStones.drop(g, a)) rt.notice('The note brings a hanging stone down under her, and holds it there.', 'mother.stone');
    return;
  }
  if (g.state !== 'open') {
    rt.notice(g.phaseIndex >= 2 ? 'She hears the note, and rises out of its reach.' : 'She hears the note, and turns her head. Sound it when she cries.', g.phaseIndex >= 2 ? 'mother.wait2' : 'mother.wait');
    return;
  }
  if (pos.distanceTo(g.model.pos) > 28) { rt.notice('That bell is too far from her. Hook the one nearest her.', 'mother.far'); return; }
  g.add((g.phaseIndex === 0 ? 0.125 : 0.1) * (g.gasp ? MOTHER_GASP.bell : 1), 'bell');
  if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
}
/** A dive struck: onto a stone the bell holds under her, it takes her weight, and she lies on it. */
function motherStrike(g, a) {
  if (!a.over) return;
  const s = g.rt.hallStones?.landed(g, a);
  if (!s) return;
  g.grounded = true;
  g.rt.rumble?.(1.0, 0.5);
  g.rt.notice('She dives onto the held stone and lies on it, dazed, crying.', 'mother.grounded');
}
/**
 * Her last phase off a held stone (v1.70, issue #319: "an opening after every move", and her last phase had none but the
 * stone): her cry is a gasp of `open` s, and a note then calms her `bell` of a full ring; on a held stone she lies a while
 * (GROUNDED) and a note calms her fully.
 */
export const MOTHER_GASP = { open: 1.6, bell: 0.3 };
/** How long a combo's end leaves her open: on a held stone, a while; in her last phase off one, a gasp. */
function motherOpen(g, a, s) {
  if (g.grounded) { g.grounded = false; g.gasp = false; return Math.max(s, GROUNDED); }
  g.gasp = g.phaseIndex >= 2 && !!s;
  if (g.gasp) { g.rt.notice('She cries a moment, and rises again, out of the bell’s reach.', 'mother.rises'); return Math.min(s, MOTHER_GASP.open); }
  return s;
}

/**
 * The stones that fell up into the Cloud-Mother's hall, hanging under its dome. A ring of the bell as she rises to
 * dive brings the nearest one down onto the spot she has picked (it follows the spot until she strikes) and holds it
 * there while the note sounds (HOLD.stones); then it falls up again. Calm, she lets them down for good.
 */
class HallStones {
  /**
   * o: { id, y: her hall's floor, at: [[x, z]], hang: [[height over the floor, r]] } (local). (Its id is her element's, the
   * guardian's own pieces: the redesign's rules measure her hall by them, scripts/temple-design/rules.mjs.)
   */
  constructor(rt, o) {
    this.rt = rt; this.hold = o.hold ?? HOLD.stones;
    this.floorY = rt.kit.world(0, o.y, 0).y;
    this.mat = makeMaterial({ color: PALETTE.stone, glow: 0.05, flat: true, key: 'temple.arzach2.hallstones' });
    this.list = o.at.map(([x, z], i) => {
      const [h, r] = o.hang[i], y = o.y + h;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.7, 1), this.mat);
      const home = rt.kit.world(x, y, z);
      m.position.copy(home); m.rotation.set(i, i * 2, 0);
      m.userData.noCollide = true; m.userData.dynamic = true;
      rt.root.add(m);
      return { m, home, r, i, to: home.clone(), held: 0, k: 0, g: null, a: null };
    });
    rt.hallStones = this;
  }
  /** A ring as guardian g winds up dive a: the nearest stone still hanging comes down where it will strike. */
  drop(g, a) {
    if (this.list.some((s) => s.a === a && s.held > 0)) return null;
    const free = this.list.filter((s) => s.held <= 0).sort((p, q) => p.home.distanceToSquared(g.attackAt) - q.home.distanceToSquared(g.attackAt))[0];
    if (!free) return null;
    Object.assign(free, { held: this.hold, g, a });
    free.to.set(g.attackAt.x, this.floorY + free.r * 0.6, g.attackAt.z);
    this.rt.sound?.chime?.();
    return free;
  }
  /** Dive a has struck: the stone brought down for it, if the note still holds it (it lands at once under her). */
  landed(g, a) {
    const s = this.list.find((q) => q.a === a && q.held > 0) ?? null;
    if (s) { s.to.set(g.attackAt.x, this.floorY + s.r * 0.6, g.attackAt.z); s.k = 1; }
    for (const q of this.list) if (q.a === a) q.a = null;
    return s;
  }
  /** Knocked out: the note is gone, they all fall up again. */
  reset() { for (const s of this.list) { s.held = 0; s.a = null; } }
  update(dt, t) {
    const calm = this.rt.logic.resolved;
    let held = 0;
    for (const s of this.list) {
      s.held = Math.max(0, s.held - dt);
      // while she winds up, the falling stone follows the spot she has picked
      if (s.held > 0 && s.a && s.g?.attack === s.a && !s.g.struck) s.to.set(s.g.attackAt.x, this.floorY + s.r * 0.6, s.g.attackAt.z);
      if (calm) s.to.set(s.home.x, this.floorY + s.r * 0.6, s.home.z);
      const down = calm || s.held > 0;
      s.k = down ? Math.min(1, s.k + dt / (calm ? 4 : 0.35)) : Math.max(0, s.k - dt / 2.5);
      // (calm: its ending brings them down in its own panel, issue #562: held up until then, rt.calmK)
      if (calm && this.rt.finaleK != null) s.k = this.rt.finaleK;
      const bob = (1 - s.k) * Math.sin(t * 0.5 + s.i * 2.1) * 0.6;
      s.m.position.lerpVectors(s.home, s.to, s.k * s.k).y += bob;
      if (s.held > 0) held++;
    }
    this.mat.uniforms.uGlow.value = held ? 0.4 + 0.15 * Math.sin(t * 9) : 0.05;
  }
}

/**
 * The Stone Stair's great stone, one of the stones that fell up: it hangs at the top of the well, level with the
 * landing, and comes down to the floor only while its condition holds (`held`: the founders' bell ringing); when it
 * falls quiet the stone falls up again, carrying whoever stands on it (a moving floor, as a riding disc is).
 * o: { path: [[bottom], [top]], r, held: condition, down (m/s coming down), up (m/s falling up) }
 */
export class FallUpStone extends Platform {
  constructor(rt, o) {
    super(rt, { ...o, phase: 1 });
    // a rough stone, not a disc: an eight-sided slab with a worn top, the glyph faint on its underside
    this.group.clear();
    const th = this.thick, r = this.r;
    const g = new THREE.CylinderGeometry(r, r * 0.8, th, 8).translate(0, -th / 2, 0);
    const m = new THREE.Mesh(g, rt.M.stoneMat);
    const under = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.75, 1).scale(1, 0.35, 1).translate(0, -th - 0.1, 0), rt.M.stoneMat);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, 0.06, 4, 32).rotateX(Math.PI / 2).translate(0, -th * 0.5, 0), this.glow);
    for (const q of [m, under, rim]) { q.userData.noCollide = true; q.userData.dynamic = true; this.group.add(q); }
    this.s = this.rt.logic.check(o.held) ? 0 : this.total;
    this.place(0);
  }
  update(dt, t) {
    const down = this.rt.logic.check(this.o.held), want = down ? 0 : this.total;
    this.glow.uniforms.uGlow.value = down ? 0.6 + 0.25 * Math.sin(t * 9) : 0.12;
    if (Math.abs(want - this.s) < 1e-3) { this.solid.vel.set(0, 0, 0); return; }
    const sp = (down ? this.o.down ?? 3.2 : this.o.up ?? 1.7) * (0.35 + 0.65 * Math.min(1, Math.abs(want - this.s) / 2));
    this.s += Math.sign(want - this.s) * Math.min(Math.abs(want - this.s), sp * dt);
    this.place(dt);
    const P = this.rt.player;
    if (P && this.solid.vel.y < 0 && !P.climbing && Math.hypot(P.pos.x - this.solid.pos.x, P.pos.z - this.solid.pos.z) < this.r && Math.abs(P.pos.y - this.solid.top) < 0.4 && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
  }
}

// ------------------------------------------------------------------ the founders' bell, the house's state (issue #408)
/** Its look in every room: the lamps warm while it rings, cold and dim while it is still. */
export const STATE_LOOK = { rung: '#ffc764', still: '#5b6c9c', glow: [0.12, 0.85] };
/** The one lamp material every lever, bell-lamp and the bell's heart share (its colour set once a frame: FoundersBell). */
const stateLamp = () => makeMaterial({ color: STATE_LOOK.still, glow: STATE_LOOK.glow[0], flat: true, key: 'temple.arzach2.state' });
const _sc = new THREE.Color(), _sv = new THREE.Vector3();

/**
 * The founders' bell (LOGIC `bell`, a drum of two stops: still 0, rung 1): this piece keeps the house's state. A lever
 * pulled (BellLever) or a ring hooked (FOUNDERS.rings: its own, and the Hall of Echoes' bell that answers it) rings it at
 * once, its stones come down all through the house; or stills it: its hum fades for FOUNDERS.fade s, and then they fall
 * up. A pull while it fades rings it on. It lights the house's lamps (stateLamp), sends the skin's note out from it and
 * from the bell that answers it, and points the scout at the nearest place to set it from (`center`).
 * o: { id: 'bell', at: [x, y, z] its heart (local), s: its size }
 */
export class FoundersBell {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    this.at = rt.kit.world(...o.at);
    this.fading = 0; this.time = 0;
    this.k = this.rung ? 1 : 0;
    this.lamp = stateLamp();
    // its clapper under its mouth, lit in the house's state's colour: it swings while the bell rings, hangs still when it
    // is still (`mouth`: local, the bell's mouth)
    const s = o.s ?? 1;
    this.clapper = new THREE.Group();
    this.clapper.position.copy(rt.kit.world(...o.mouth));
    this.clapper.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.5 * s, 6).translate(0, -0.25 * s, 0), makeMaterial({ color: '#a8874a', flat: true, metal: 'brass', refl: 0.3, key: 'temple.arzach2.lever' })));
    this.clapper.add(new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 14, 10).translate(0, -0.5 * s - 0.2 * s, 0), this.lamp));
    this.clapper.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    this.clapper.name = 'The founders’ bell’s clapper';
    rt.root.add(this.clapper);
    this.setters = [];   // (the levers, and the rings once the hook is carried: the scout's)
    this.off = rt.game?.on?.('bell', ({ by, struck } = {}) => { if (struck && FOUNDERS.rings.includes(by)) this.toggle(by); });
    rt.foundersBell = this;
  }
  get rung() { return this.rt.logic.drumOn(this.id, 'bellRung'); }
  /** Rung (now), or stilled (once its hum fades); a pull while it fades rings it on. Returns what it does. */
  toggle(by = null) {
    const rt = this.rt;
    if (this.fading > 0) {
      this.fading = 0;
      rt.sound?.bell?.(); rt.notice?.('The bell swells again. Its stones stay down.', 'founders.again');
      return 'rung';
    }
    if (this.rung) {
      this.fading = FOUNDERS.fade;
      rt.rumble?.(0.4, 0.3); rt.notice?.('The founders’ bell’s hum begins to fade. Its stones stir.', 'founders.fading');
      return 'stilling';
    }
    rt.logic.moveDrum(this.id, 1); rt.applyDoors?.();
    rt.sound?.bell?.(); rt.rumble?.(1.2, 0.5);
    rt.notice?.('The founders’ bell rings out, and its stones come down.', 'founders.rung');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id });
    return 'rung';
  }
  update(dt, t) {
    this.time += dt;
    if (this.fading > 0) {
      this.fading -= dt;
      if (this.fading <= 0) {
        this.fading = 0;
        this.rt.logic.moveDrum(this.id, 0); this.rt.applyDoors?.();
        this.rt.rumble?.(1.0, 0.4); this.rt.notice?.('The hum dies away. The founders’ stones fall up.', 'founders.stilled');
      }
    }
    const want = this.rung ? (this.fading > 0 ? 0.35 + 0.65 * (this.fading / FOUNDERS.fade) : 1) : 0;
    this.k += (want - this.k) * Math.min(1, dt * 3);
    // every lamp of the house at once: warm and breathing with its swing while it rings, flickering as it fades
    const u = this.lamp.uniforms, flick = this.fading > 0 ? 0.25 * Math.sin(t * 17) : 0;
    u.uColor.value.set(STATE_LOOK.still).lerp(_sc.set(STATE_LOOK.rung), this.k);
    u.uGlow.value = STATE_LOOK.glow[0] + this.k * (STATE_LOOK.glow[1] - STATE_LOOK.glow[0] + 0.12 * Math.sin(t * 4.2) + flick);
    this.clapper.rotation.z = this.k * Math.sin(t * 2.4) * 0.3;
    this.clapper.rotation.x = this.k * Math.sin(t * 2.4 + 1.1) * 0.12;
    // the skin's note: pale rings out over the floors from it, and from the Hall of Echoes' bell that answers it
    const B = this.rt.skin?.U?.bells?.value;
    if (B && B.length > 4) { B[4].set(this.o.at[0], this.o.at[1], this.o.at[2], this.k); B[3].set(BELL2[0], BELL2[1] + 1.8, BELL2[2], this.k); }
  }
  /** Where to set it from (the scout's): the nearest lever, or ring once the hook is carried. */
  get center() {
    const P = this.rt.player?.pos, hook = this.rt.logic.has?.('hook');
    const list = this.setters.filter((s) => !s.ring || hook).map((s) => s.at);
    if (!P || !list.length) return this.at;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
  dispose() { this.off?.(); }
}

/**
 * A lever of the founders' bell, by a hub (FOUNDERS.levers): a bronze arm on a slate post, a lamp on its knob (stateLamp).
 * Pulled (A / ×) it rings the bell, or stills it (FoundersBell.toggle); the arm stands up while it rings, down while it is
 * still. o: { id, room, at (its foot, local), yaw (the way it faces) }
 */
export class BellLever {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.05;
    this.pos = K.world(x, y, z);
    K.both(M.dark, T(new THREE.CylinderGeometry(0.3, 0.42, H, 8), [x, y + H / 2, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.33, 0.05, 6, 20), [x, y + H, z], [Math.PI / 2, 0, 0]));
    K.add(stateLamp(), T(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), [x, y + H + 0.02, z]));
    this.top = K.world(x, y + H + 0.1, z);
    this.at = this.top;
    // the arm: pivoting on the post's top, across the way it faces; its knob the lamp's colour
    this.arm = new THREE.Group();
    this.arm.position.copy(this.top);
    this.arm.rotation.y = K.heading(o.yaw ?? 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6).translate(0, 0.5, 0), makeMaterial({ color: '#a8874a', flat: true, metal: 'brass', refl: 0.3, key: 'temple.arzach2.lever' }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.02, 0), stateLamp());
    this.pivot = new THREE.Group(); this.pivot.add(bar, knob);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.a = 0;
    const bell = () => rt.foundersBell;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (bell()?.rung && !(bell()?.fading > 0) ? 'still the founders’ bell' : 'ring the founders’ bell'),
      enabled: () => !!bell(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { const r = bell()?.toggle(this.id); this.kick = 1; return r; },
    });
    rt.foundersBell?.setters.push({ at: this.top, lever: this.id });
    this.later = !rt.foundersBell;   // (a lever placed before the bell: it joins the bell's list on its first frame)
  }
  update(dt) {
    const B = this.rt.foundersBell;
    if (this.later && B) { this.later = false; B.setters.push({ at: this.top, lever: this.id }); }
    const want = (B?.rung && !(B.fading > 0) ? 1 : -1) * 0.75;
    this.a += (want - this.a) * Math.min(1, dt * 6);
    this.kick = Math.max(0, (this.kick ?? 0) - dt * 3);
    this.pivot.rotation.x = this.a + Math.sin(this.kick * 9) * 0.1 * this.kick;
  }
  dispose() { this.off?.(); }
}

/**
 * A bell-lamp: the founders' bell's state in a room (issue #408, G1: readable everywhere). A slender bronze post by the
 * room's way in, a lamp in a ring on it, warm while the bell rings and cold while it is still (stateLamp). Drawn in the
 * kit's batches: its colour is the shared material's. o: { room, at (its foot, local) }
 */
export class BellGauge {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at;
    this.rt = rt; this.o = o;
    K.both(M.trim, T(new THREE.CylinderGeometry(0.08, 0.14, 2.3, 8), [x, y + 1.15, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.48, 0.06, 6, 24), [x, y + 2.75, z], [Math.PI / 2, 0, 0]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.48, 0.05, 6, 24), [x, y + 2.75, z]));
    K.add(stateLamp(), T(new THREE.SphereGeometry(0.34, 14, 10).scale(1, 1.25, 1), [x, y + 2.75, z]));
  }
  update() {}
}

/**
 * Stones that fell up (issue #408): hanging under a hall's roof while the founders' bell is still, bobbing; down on the
 * floor, where somebody set them, while it rings. Drawn only. o: { id, list: [[x, z, r]], y: the floor, up: [lo, hi] }
 */
export class StateStones {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, [lo, hi] = o.up ?? [18, 24];
    this.list = o.list.map(([x, z, r], i) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.7, 1), rt.M.stoneMat);
      m.userData.noCollide = true; m.userData.dynamic = true;
      rt.root.add(m);
      const low = K.world(x, o.y + r * 0.6, z), high = K.world(x, o.y + lo + ((i * 5) % 7) / 6 * (hi - lo), z);
      return { m, low, high, i, k: 0 };
    });
    const down = rt.logic.check(RUNG) ? 1 : 0;
    for (const s of this.list) { s.k = down; this.place(s, 0); }
  }
  place(s, t) {
    const e = s.k * s.k * (3 - 2 * s.k), bob = (1 - e) * Math.sin(t * 0.5 + s.i * 2.1) * 0.6;
    s.m.position.lerpVectors(s.high, s.low, e).y += bob;
    s.m.rotation.set(s.i + (1 - e) * t * 0.05, s.i * 2, 0);
  }
  update(dt, t) {
    const B = this.rt.foundersBell, down = this.rt.logic.check(RUNG), stir = B?.fading > 0;
    for (const s of this.list) {
      s.k = down ? Math.min(1, s.k + dt / (1.2 + s.i * 0.15)) : Math.max(0, s.k - dt / (3 + s.i * 0.2));
      this.place(s, t);
      if (stir) s.m.position.y += Math.sin(t * 23 + s.i) * 0.04;
    }
  }
}

// ------------------------------------------------------------------ inside
// (issue #336: every hall 36 m across (the stores 30 by 36, the round halls 34 and 42 across) under 18 m of stone or more,
// doors 7 by 9 m, each puzzle in the middle of its room; the props at a body's scale as they were (the balls, the bells, the
// plates, the great stone, the chests, the eye) and the chasm and every groove as long as they were, so every timing holds)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const stone = (x, y, z, r, i) => K.both(M.stone, T(new THREE.IcosahedronGeometry(r, 1), [x, y, z], [i, i * 2, 0], [1, 0.7, 1]));
  const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, roof: 'oculus', ...o }); };
  /** A point of a round hall R: rotunda angle a (0 north, -π/2 west), radius r, height y. */
  const round = (R, a, r, y = R.y) => [R.x + Math.sin(a) * r, y, R.z + Math.cos(a) * r];
  // a dark line inlaid in the floor from a to b ([x, z]) at y
  const inlay = (a, b, w, y, mat = M.dark) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    K.add(mat, T(new THREE.BoxGeometry(w, 0.04, L), [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [0, yaw, 0]));
    return { L, yaw, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };
  // a ball's groove on the floor at y: a dark channel between two trim lips
  const groove = (a, b, y = 0) => {
    const { L, yaw, c } = inlay(a, b, 1.0, y + 0.02);
    for (const sd of [-1, 1]) K.both(M.trim, T(new THREE.BoxGeometry(0.25, 0.12, L), [c[0] + Math.cos(yaw) * sd * 0.75, y + 0.06, c[1] - Math.sin(yaw) * sd * 0.75], [0, yaw, 0]));
  };
  /** A founders' bell, clapperless, its crown at `top` over its mouth at y; hung from `from` (the ceiling). */
  const bellShape = (s) => lathe([[0.02, 0], [1.4 * s, 0.1 * s], [1.5 * s, 0.8 * s], [1.05 * s, 2.4 * s], [0.85 * s, 3.4 * s], [0.02, 3.6 * s]], 24);
  // (in the house's futuristic skin, a stack of floating bronze rings round a dark core, held by nothing: skins/founders-belfry.js)
  const hang = (x, y, z, s, from, ear, face = 0) => {
    if (rt.skin?.bell?.([x, y, z], s, ear, face)) return;
    K.add(BRONZE(), T(bellShape(s), [x, y, z]));
    const top = y + 3.6 * s;
    if (from > top) K.add(M.trim, box(0.2, from - top + 0.4, 0.2, x, (from + top) / 2, z));
  };

  // ---- the Threshold (z 0..14): the way back out behind you
  const TH = R0.threshold;
  hall(TH, { oculus: 0.3, doors: [{ side: 's', w: 6, h: 8 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(6, 8).translate(0, 4, 0), [0, 0, -1.25]));
  K.solid(box(6.4, 8, 0.5, 0, 4, -1.4));
  K.glyph([0, 9.4, 0.05], 1.8, 0);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });
  // the wall between the Threshold and the taller hall beyond, with the archway through it
  K.wall(-18.6, 14.6, 18.6, 14.6, 0, R0.stones.top, { t: 1.2, holes: [{ at: 18.6, w: 8, h: 10 }] });

  // ---- the Hall of Stones (a hub, a passage): the door on in its north wall has a lamp and a keyhole; two archways, west
  // and east, open into the stone stores (out of sight of the door: you go and find them)
  const ST = R0.stones, [, stz] = mid(ST), AZ = stz - 5.2;   // (the archways' middle)
  hall(ST, { oculus: 0.25, columns: 3, omit: ['s'], doors: [{ side: 'n', w: D.w, h: D.h }, { side: 'w', at: AZ - stz, w: D.w, h: D.h }, { side: 'e', at: AZ - stz, w: D.w, h: D.h }] });
  add(Door, { id: 'd1', at: [0, 0, ST.z1 + 0.6], w: D.w, h: D.h, lamps: [{ drumOn: ['ball2', 'p2'] }] });   // (and a keyhole: logic `lock`)
  add(Mark, { room: 'stones', at: [-8, 0, 19], yaw: Math.PI / 2 });
  // (issue #408) the founders' bell's lever by the hub's door on (it rings in the Great Belfry beyond)
  for (const lv of FOUNDERS.levers) if (lv.room === 'stones') add(BellLever, { ...lv, id: `lever.${lv.room}`, sets: 'bell' });
  // stones that once fell up, heaped in the corners where somebody brought them back down
  [[-15, 0.8, 48.2, 1.2], [-13.4, 0.6, 46.4, 0.9], [15.2, 0.8, 18.6, 1.1], [13.8, 1.7, 19.6, 0.8]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i));
  // a dark line inlaid from each archway to the door's foot: the two lamps' two ways
  for (const sx of [-1, 1]) inlay([sx * (ST.x1 - 0.8), AZ], [sx * 2.6, ST.z1 - 1], 0.5, 0.02);

  // ---- the stone stores, off the hall's sides. The west one is the house's fight (an arena since v1.49: its archway shuts
  // behind you while its keepers stand round its middle; the small key at its far end); in the middle of the east one a
  // groove, a ball and a plate
  const SW = R0.storeW, [swx, swz] = mid(SW);
  hall(SW, { oculus: 0.3, omit: ['e'], frieze: false });
  add(Door, { id: 'dSW', at: [ST.x0 - 0.6, 0, AZ], yaw: Math.PI / 2, w: D.w, h: D.h });
  add(Key, { id: 'kW', at: [SW.x0 + 5, 0, swz], yaw: Math.PI / 2 });
  K.glyph([SW.x0 + 0.05, 6.2, swz + 5], 1.8, Math.PI / 2);
  // (the stones brought back down: round the walls, the floor's middle clear for the fight)
  [[-46, 0.8, 18.8, 1.1], [-44.6, 0.6, 20.6, 0.8], [-23.4, 0.8, 48.4, 1.2], [-46, 0.9, 48, 1.3], [-32, 0.7, 18.6, 0.9]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 4));
  for (const [x, z] of [[swx - 8, swz - 8], [swx + 8, swz + 8]]) K.column(x, z, 0, SW.top, 0.9);   // (two to fight round)
  const SE = R0.storeE, [sex, sez] = mid(SE), G2 = [sex - 5.2, sex + 5.2];
  hall(SE, { oculus: 0.3, omit: ['w'], frieze: false });
  groove([G2[0], sez], [G2[1], sez]);
  add(Ball, { id: 'ball2', a: [G2[0], 0.04, sez], b: [G2[1], 0.04, sez], r: 1.3 });
  add(Plate, { id: 'p2', at: [G2[1], 0, sez], r: 1.5 });
  K.glyph([SE.x1 - 0.05, 6.2, sez - 5], 1.8, -Math.PI / 2);
  [[45.6, 0.8, 47.6, 1.2], [44, 0.6, 48.6, 0.8], [46, 0.7, 18.8, 0.9]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 9));

  // ---- the corridor and the Great Belfry (issue #408: the house's great hall, its floor and its gallery the hub of both
  // floors). The founders' bell hangs in its middle; the great stone rides between its floor and the gallery's north band;
  // the great key's ledge high on its west wall
  const NV = R0.nave, GA = GALLERY, NZ = (NV.z0 + NV.z1) / 2, C2 = NZ;
  K.corridor([0, ST.z1 + 1.2], [0, NV.z0 - 0.6], 0, { w: D.w, h: D.h });
  hall(NV, { oculus: 0.22, frieze: false, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h, y0: UP }, { side: 'w', at: RING.in - NZ, w: RING.w, h: RING.door, y0: RING.y }] });
  // (its frieze high on the long walls, kept off the ledge's doorway)
  const FY = NV.y + (NV.top - NV.y) * 0.72;
  K.frieze([NV.x1 - 0.02, NV.z0 + 2], [NV.x1 - 0.02, NV.z1 - 2], FY, 'w');
  K.frieze([NV.x0 + 0.02, NV.z0 + 2], [NV.x0 + 0.02, RING.in - RING.w / 2 - 2], FY, 'e');
  K.frieze([NV.x0 + 0.02, RING.in + RING.w / 2 + 2], [NV.x0 + 0.02, NV.z1 - 2], FY, 'e');
  // the gallery: the north band a block of stone from the floor up (its face the great stone's dock, the eye on it), the
  // arms down the long walls on columns, open over the floor; a parapet along their edges but where the great stone docks
  // and where the west arm drops to the floor (G6: the way back down to the hub)
  K.both(M.floor, box(NV.x1 - NV.x0, UP, NV.z1 - GA.n, 0, UP / 2, (GA.n + NV.z1) / 2));
  K.chart.push({ kind: 'slab', x0: NV.x0, x1: NV.x1, z0: GA.n, z1: NV.z1, y: UP });
  K.slab(NV.x0, GA.s, GA.w, GA.n, UP, GA.t);
  K.slab(GA.e, GA.s, NV.x1, GA.n, UP, GA.t);
  for (const x of [GA.w + 0.9, GA.e - 0.9]) for (let z = GA.s + 3; z < GA.n - 2; z += 10.5) K.column(x, z, 0, UP - GA.t, 0.7);
  const rail = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az); if (L > 0.05) K.both(M.trim, box(0.4, GA.parapet, L, (ax + bx) / 2, UP + GA.parapet / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az))); };
  const LF = RING.lift, dock = [LF.x - LF.r - 0.4, LF.x + LF.r + 0.4], DROP = [GA.s + 8, GA.s + 22];
  rail(GA.w - 0.2, GA.n + 0.2, dock[0], GA.n + 0.2); rail(dock[1], GA.n + 0.2, GA.e + 0.2, GA.n + 0.2);
  rail(GA.w - 0.2, GA.s + 0.2, GA.w - 0.2, DROP[0]); rail(GA.w - 0.2, DROP[1], GA.w - 0.2, GA.n);
  rail(GA.e + 0.2, GA.s + 0.2, GA.e + 0.2, GA.n);
  rail(NV.x0 + 0.1, GA.s + 0.2, GA.w - 0.2, GA.s + 0.2); rail(GA.e + 0.2, GA.s + 0.2, NV.x1 - 0.1, GA.s + 0.2);
  K.add(M.trim, box(0.5, 0.12, DROP[1] - DROP[0], GA.w - 0.25, UP + 0.06, (DROP[0] + DROP[1]) / 2));   // (a lip where it drops)
  // the stones the founders set down where the drop lands: a soft heap's look (it is only floor)
  [[GA.w - 3.6, 0.5, DROP[0] + 4, 0.9], [GA.w - 2.2, 0.4, DROP[1] - 3, 0.7]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 14));
  // the great stone: down while the bell rings, up again (with you) when it is stilled
  add(FallUpStone, { id: 'lift', path: [[LF.x, 0.3, LF.z], [LF.x, UP + 0.25, LF.z]], r: LF.r, held: RUNG, down: 3.2, up: 1.7 });
  K.both(M.dark, T(new THREE.CylinderGeometry(LF.r + 0.2, LF.r + 0.4, 0.08, 8), [LF.x, 0.04, LF.z]));   // where it comes to rest
  // the founders' bell in the middle, from the roof, its pull-ring under its mouth; its heart and its note (FoundersBell)
  const FB = FOUNDERS, [BX, BY, BZ] = FB.at;
  hang(BX, BY, BZ, FB.s, NV.top + 4, 'bell', Math.PI);
  add(FoundersBell, { id: 'bell', at: [BX, BY + 2 * FB.s, BZ], mouth: [BX, BY - 0.2 * FB.s, BZ], s: FB.s });
  add(HookBell, { id: 'hb.founders', at: [BX, FB.ring, BZ], chain: 0.45, yaw: Math.PI, size: 0.6, sets: 'bell', room: 'landing', from: [-10, UP, GALLERY.n + 2] });
  rt.foundersBell.setters.push({ at: K.world(BX, FB.ring, BZ), ring: 'hb.founders' });
  // the levers by the hubs (the Hall of Stones' is placed with its hall), and the founders' bell's keeper
  for (const lv of FB.levers) if (lv.room !== 'stones') add(BellLever, { ...lv, id: `lever.${lv.room}`, sets: 'bell' });
  add(Mark, { room: 'stair', at: [7, 0, NV.z0 + 5], yaw: -Math.PI * 0.8 });
  // the high door, and its eye on the north band's face: under your feet once you are up, seen from the floor and on the ride
  add(Door, { id: 'd2', at: [0, UP, NV.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 's1' }] });
  add(Switch, { id: 's1', at: [3.5, UP - 3, GA.n - 0.1], yaw: Math.PI, size: 1.0 });
  // stones that fell up, hanging under the roof while the bell is still, down on the floor along the walls while it rings
  add(StateStones, { id: 'stones.nave', list: [[-15, 63, 1.3], [15, 64, 1.1], [-8, 74, 0.9], [9, 77, 1.2], [-16.5, 80, 1], [16, 92, 1.4], [6, 104, 0.8], [-10, 106, 1.1]], y: 0, up: [20, 27] });
  // ---- the corridor and the Bell Chamber (floor UP): the chest; its north door sinks for the hook in hand
  const S3 = R0.bell, C3 = S3.z;
  K.corridor([0, NV.z1 + 1.2], [0, C3 - S3.r - 0.6], UP, { w: D.w, h: D.h });
  add(BellGauge, { room: 'bell', at: [9.5, UP, C3 - 11.5] });
  K.rotunda({ x: 0, z: C3, y: UP, r: S3.r, h: S3.top - UP, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.35 });
  // (in the futuristic skin a hexagonal slate pedestal with lit panels, drawn over the same collider)
  const [moundD, moundS] = chestMound(0, UP, C3);
  if (!rt.skin?.pedestal?.(moundD, moundS)) K.both(M.trim, moundD, moundS);   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // a bell hangs high in the oculus, without a clapper, its pull-ring out of any reach: the hook rings it, and three stones
  // that fell up come down round the dais while it sounds (a try: nothing is locked by it)
  hang(0, UP + 12, C3, 1, S3.top + 4, 'eT', Math.PI);   // (up through the oculus)
  add(HookBell, { id: 'hb.eT', at: [0, UP + 11.1, C3], chain: 0.4, yaw: Math.PI });
  add(BellEar, { id: 'eT', at: [0, UP + 12, C3], reach: 16, struck: true, heard: 'The bell in the oculus booms as the hook tugs it, and three of the stones that fell up come down round the dais. They stay only while it sounds.', heardKey: 'eT.heard', fading: 'The hum is fading: the stones tremble.' });
  add(Bridge, { id: 'heap', a: [-6.4, UP + 0.6, C3 - 3.2], b: [-6.4, UP + 0.6, C3 + 3.2], w: 2.4, n: 3, from: 'above' });
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.3 + i * 0.28); K.glyph(round(S3, a, S3.r - 0.05, UP + 6), 1.6, a + Math.PI); }
  add(Mark, { room: 'bell', at: [6.5, UP, C3 - 9], yaw: -Math.PI * 0.75 });
  add(Door, { id: 'dP', at: [0, UP, C3 + S3.r + 0.7], w: D.w, h: D.h, lamps: [{ item: 'hook' }] });   // (the hook in hand)

  // ---- the Bell Porch (floor UP), a room on: the door into the Hall of Echoes is held by the porch's own bell, hung in
  // the middle of the room
  const PO = R0.porch, [, poz] = mid(PO);
  K.corridor([0, C3 + S3.r + 0.6], [0, PO.z0 - 1.2], UP, { w: D.w, h: D.h });
  hall(PO, { oculus: 0.3, columns: 2, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }] });
  // (issue #408) its bell answers the founders' bell: hooked, it rings it or stills it, and the door's slab with it
  hang(0, UP + 6.6, poz, 0.8, PO.top + 4, 'porch', Math.PI);
  add(HookBell, { id: 'hb.e1', at: [0, UP + 5.7, poz], chain: 0.4, yaw: Math.PI, sets: 'bell', room: 'porch', from: [0, UP, poz - 6] });
  rt.foundersBell.setters.push({ at: K.world(0, UP + 5.7, poz), ring: 'hb.e1' });
  add(Mark, { room: 'porch', at: [-6, UP, PO.z0 + 5], yaw: Math.PI / 2 });
  add(Door, { id: 'd3', at: [0, UP, PO.z1 + 0.6], w: D.w, h: D.h, bell: true, lamps: [RUNG] });

  // ---- the Hall of Echoes: a chasm across its middle under a bridge of the founders' stones
  const EC = R0.echoes, [, ecz] = mid(EC), E0 = EC.z0, LIP = E0 + EC.lip, FAR = E0 + EC.far;
  K.corridor([0, PO.z1 + 1.2], [0, E0 - 1.2], UP, { w: D.w, h: D.h });
  hall(EC, { floor: false, oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: UP - EC.y }, { side: 'n', w: D.w, h: D.h, y0: UP - EC.y }, { side: 'w', at: RING.z - ecz, w: RING.w, h: RING.door, y0: UP - EC.y }] });
  K.slab(EC.x0, E0, EC.x1, LIP, UP, UP - EC.y);
  K.slab(EC.x0, FAR, EC.x1, EC.z1, UP, UP - EC.y);
  K.both(M.dark, box(EC.x1 - EC.x0, 1, FAR - LIP, 0, EC.y - 0.5, (LIP + FAR) / 2));
  add(Pit, { room: 'echoes', min: [EC.x0 - 1, EC.y - 4, LIP], max: [EC.x1 + 1, UP - 3.5, FAR] });
  // (issue #408) the bridge's stones come down while the founders' bell rings, and fall up again when it is stilled; a
  // ball's weight on the far plate holds them down for good. The ball's groove runs from the near edge over the bridge.
  add(Bridge, { id: 'br1', a: [0, UP, LIP - 0.1], b: [0, UP, FAR + 0.1], w: 6, n: 8, from: 'above' });
  // the spur off its middle, west to the Ringers' Walk's doorway: other stones, that fall up out of the chasm level with the
  // bridge while the bell is still, and lie in it while it rings
  add(Bridge, { id: 'spur', a: [-3.05, UP, RING.z], b: [EC.x0 + 0.05, UP, RING.z], w: RING.w - 0.4, n: 5, from: 'below' });
  // the hall's bell, hung over the chasm's east side by the bridge's middle: it answers the founders' bell (it swings and
  // hums while that one rings), and hooked from either lip or the bridge it rings or stills it (FoundersBell)
  hang(BELL2[0], BELL2[1], BELL2[2], 0.9, EC.top + 4, 'echo', Math.PI);
  add(HookBell, { id: 'hb.e2', at: [BELL2[0], BELL2[1] - 0.9, BELL2[2]], chain: 0.4, yaw: -Math.PI / 2, sets: 'bell', room: 'echoes', rooms: ['echoesFar'], from: [5, UP, E0 + 8] });
  rt.foundersBell.setters.push({ at: K.world(BELL2[0], BELL2[1] - 0.9, BELL2[2]), ring: 'hb.e2' });
  const BA = [1.6, UP + 0.04, E0 + 10.5], BB = [1.6, UP + 0.04, E0 + 38.2], BL = BB[2] - BA[2];
  add(Ball, { id: 'ball3', a: BA, b: BB, r: 1.0, friction: 0.2, lock: true, gap: { bridge: 'br1', from: (LIP - 0.1 - BA[2]) / BL, to: (FAR + 0.1 - BA[2]) / BL } });
  add(Plate, { id: 'p3', at: [1.6, UP, BB[2]], r: 1.2 });
  for (const [z0, z1] of [[BA[2] - 1.2, LIP - 0.1], [FAR + 0.1, BB[2]]]) {
    K.add(M.dark, box(1.0, 0.04, z1 - z0, 1.6, UP + 0.02, (z0 + z1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, z1 - z0, 1.6 + sd * 0.75, UP + 0.06, (z0 + z1) / 2));
  }
  // the far door: its ball home, and its slab one of the founders' stones, sunk while the bell rings (and the great key)
  add(Door, { id: 'd4', at: [0, UP, EC.z1 + 0.6], w: D.w, h: D.h, bell: true, lamps: [{ drumOn: ['ball3', 'p3'] }, RUNG] });
  add(Mark, { room: 'echoes', at: [-3.6, UP, E0 + 4.5], yaw: Math.PI / 2 });
  add(BellGauge, { room: 'echoes', at: [7.5, UP, E0 + 3] });
  add(BellGauge, { room: 'echoesFar', at: [-7.5, UP, EC.z1 - 3] });
  for (let i = 0; i < 4; i++) K.glyph([EC.x0 + 0.05, UP + 6 + (i % 2) * 2.4, LIP + 1.5 + i * 5.6], 1.6, Math.PI / 2);
  for (const z of [E0 + 6, EC.z1 - 6]) for (const x of [EC.x0 + 6, EC.x1 - 6]) K.column(x, z, UP, EC.top - UP, 0.9);

  ringersWalk(rt, K, M);

  // ---- the antechamber, and the Cloud-Mother's hall (a great rotunda, open to the sky)
  const HA = R0.hall, CH = HA.z, HR = HA.r;
  K.corridor([0, EC.z1 + 1.2], [0, CH - HR - 0.6], UP, { w: D.w, h: D.h });
  add(Mark, { room: 'ante', at: [D.w / 2 - 0.6, UP, (EC.z1 + CH - HR) / 2], yaw: -Math.PI / 2 });
  K.rotunda({ x: 0, z: CH, y: UP, r: HR, h: HA.top - UP, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.5 });
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; K.column(Math.sin(a) * (HR - 2.2), CH + Math.cos(a) * (HR - 2.2), UP, HA.top - UP, 0.9); }
  add(Door, { id: 'd5', at: [0, UP, CH + HR + 0.7], w: D.w, h: D.h });
  // the way out behind her hall: a passage to the dark doorway
  const O0 = CH + HR + 1.4, O1 = O0 + 9;
  K.corridor([0, O0], [0, O1], UP, { w: D.w, h: D.h });
  K.wall(4.6, O1 + 0.4, -4.6, O1 + 0.4, UP, D.h, { t: 0.8, holes: [{ at: 4.6, w: 5, h: 7 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(5, 7).translate(0, 3.5, 0), [0, UP, O1 + 0.9]));
  K.solid(box(5.4, 7, 0.5, 0, UP + 3.5, O1 + 1.3));

  // her hall's four bells, high round its wall between the columns, a pull-ring under each: hooked near her, they calm her
  for (const [x, , z] of HALL_BELLS) {
    hang(x, UP + 10.5, CH + z, 0.8, HA.top + 4, 'mother', Math.PI);
    add(HookBell, { id: `hb.hall.${x > 0 ? 'e' : 'w'}${z > 0 ? 'n' : 's'}`, at: [x, UP + 9.6, CH + z], chain: 0.4, yaw: Math.atan2(-x, -z) });
  }
  // stones that fell up, hanging under the dome: a ring as she rises to dive brings one down (HallStones)
  add(HallStones, { id: 'mother', y: UP, at: [[-9, CH - 4], [8, CH + 3], [-2, CH + 10], [6, CH - 9]], hang: [[17, 1.5], [19, 1.7], [21, 1.4], [18, 1.3]] });

  const model = whaleModel();
  model.pos.copy(K.world(0, UP, CH + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(-4, UP, CH + 4);
  model.restHeading = K.heading(Math.PI * 0.85);
  const arena = { center: K.world(0, UP, CH), r: HR, y: K.world(0, UP, 0).y };

  // (the west store's mark last but one: after the others, so the machines' ids by mark stay as they were; its keepers
  // round the store's middle)
  add(Mark, { room: 'storeW', at: [SW.x1 - 4, 0, SW.z0 + 5], yaw: -Math.PI * 0.75, foes: [swx, 0, swz] });
  // (and the Ringers' Walk's: at its end, in its doorway onto the ledge, the great key and the founders' bell below it in sight)
  add(Mark, { room: 'ringers', at: [RING.x - 1.2, RING.y, RING.in + 5], yaw: Math.PI / 2 });
  // (issue #408: and the far lip's, before the far door, the Hall of Echoes' bell in the hook's reach from it)
  add(Mark, { room: 'echoesFar', at: [5.5, UP, EC.z1 - 6.5], yaw: Math.PI });
  // (issue #408) the founders' bell's state in every room: a bell-lamp, warm while it rings, cold and dim while it is still
  for (const [room, at] of [['threshold', [6, 0, 9]], ['stones', [-7, 0, ST.z1 - 3.5]], ['storeW', [SW.x1 - 3, 0, SW.z1 - 3]], ['storeE', [SE.x0 + 3, 0, SE.z1 - 3]],
    ['porch', [7, UP, PO.z0 + 4]], ['ringers', [RING.x + 1.6, UP, RING.z - 9]], ['ringers', [RING.x + 1.6, RING.y, RING.stairs[1] - 4]], ['ante', [-(D.w / 2 - 0.7), UP, EC.z1 + 3.2]]]) add(BellGauge, { room, at });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-52, -8, -3), V(52, 40, O1 + 3)),
    gadget: { at: W(0, UP + 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, UP + 0.5, O1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 7, 16], [0, 9, 22, 24], [0, 9, 44, 24], [swx, 8, swz, 24], [sex, 8, sez, 24], [0, 10, NV.z0 + 12, 26], [0, 14, C2 + 4, 30], [0, UP + 7, NV.z1 - 5, 20], [-16, RING.y + 5, RING.in, 14],
      [0, UP + 9, C3, 22], [0, UP + 9, poz, 24], [0, UP + 9, E0 + 10, 24], [0, UP + 9, E0 + 30, 24], [0, UP + 9, EC.z1 - 6, 20],
      [RING.x, UP + 5, RING.z - 12, 16], [RING.x, UP + 5, RING.z - 40, 16], [RING.x, UP + 5, RING.stairs[0] + 4, 16], [RING.x, RING.y + 5, RING.stairs[1] - 2, 16], [RING.x, RING.y + 5, RING.south + 10, 16],
      [0, UP + 5, (EC.z1 + CH - HR) / 2, 10], [0, UP + 14, CH, 32]],
    guardian: { def: { ...MOTHER, onHit: motherHit, onStrike: motherStrike, openFor: motherOpen, onReset: (g) => { g.grounded = false; rt.hallStones?.reset(); } }, model, arena },
  };
}

/**
 * The Ringers' Walk: off the Hall of Echoes through its west wall half-way over (the spur, whose stones stand while the
 * founders' bell is still), back south outside the house past the porch, the Bell Chamber and the Great Belfry, up a
 * stair, and east through the Great Belfry's west wall onto a ledge high over its west gallery (issue #408): the great
 * key's, seen from the floor below. A parapet along the ledge's inner edge but at its south end: the drop onto the gallery.
 */
function ringersWalk(rt, K, M) {
  const { x: X, half, w, y: Y, z: Z, south: S, door: DH, in: IN } = RING, [s0, s1] = RING.stairs, NV = ROOMS.nave;
  const xe = X + half + 0.4, xw = X - half - 0.4, fx0 = xw - 0.4, fx1 = xe + 0.4, low = UP, lowTop = UP + DH + 1.5, highTop = Y + DH + 1.5;
  const hallIn = ROOMS.echoes.x0 + 0.02;   // (the sill 2 cm proud of the hall's wall: no face in another's plane)
  // the doorway's sill through the hall's west wall, and the walk's floors and stair
  // (the floors end inside the walls)
  K.slab(xe, Z - w / 2 - 0.2, hallIn, Z + w / 2 + 0.2, low, 0.8);
  K.slab(xw, s0, xe, Z + w / 2 + 1.2, low, 0.8);
  K.stairs([X, low, s0], [X, Y, s1], 2 * half, { sides: false });
  K.slab(xw, S, xe, s1, Y, 0.8);
  // its walls: low over the floor at UP, high over the stair and the upper floor; the gable between the two roofs
  const zN = Z + w / 2 + 1.2, wt = { t: 0.8 };
  K.wall(xw, s0, xw, zN, low - 0.8, lowTop - low + 0.8, wt);
  K.wall(xw, S - 0.4, xw, s0, low - 0.8, highTop - low + 0.8, wt);
  K.wall(xe, zN, xe, s0, low - 0.8, lowTop - low + 0.8, { ...wt, holes: [{ at: zN - Z, w, y0: 0.8, h: DH }] });
  K.wall(xe, s0, xe, S - 0.4, low - 0.8, highTop - low + 0.8, { ...wt, holes: [{ at: s0 - IN, w, y0: Y - low + 0.8, h: DH }] });
  K.wall(fx0, zN, fx1, zN, low - 0.8, lowTop - low + 0.8, wt);
  K.wall(fx1, S - 0.4, fx0, S - 0.4, Y - 0.8, highTop - Y + 0.8, wt);
  K.wall(fx0 + 0.4, s0, fx1 - 0.4, s0, lowTop, highTop - lowTop, wt);
  K.both(M.wall, box(fx1 - fx0, 0.8, zN - s0, X, lowTop + 0.42, (zN + s0) / 2));
  K.both(M.wall, box(fx1 - fx0, 0.8, s0 - S + 0.4, X, highTop + 0.42, (s0 + S - 0.4) / 2));
  // the way east into the Great Belfry, through its west wall at Y (its walls end at the hall's wall's outer face)
  const pz = w / 2 + 0.7, outer = NV.x0 - 1.2;
  K.slab(NV.x0, IN - w / 2 - 0.2, xe, IN + w / 2 + 0.2, Y, 0.8);
  K.wall(xe, IN - pz, outer, IN - pz, Y, DH + 0.6, { ...wt, cap: false });
  K.wall(outer, IN + pz, xe, IN + pz, Y, DH + 0.6, { ...wt, cap: false });
  K.both(M.wall, box(outer - xe, 0.8, 2 * pz + 0.8, (xe + outer) / 2, Y + DH + 0.62 + 0.4, IN));
  // the ledge high over the west gallery, open along its edges (a lip): every way off it drops onto the gallery
  const Lg = RING.ledge;
  K.slab(Lg.x0, Lg.z0, Lg.x1, Lg.z1, Y, 0.8);
  K.add(M.trim, box(0.3, 0.2, Lg.z1 - Lg.z0, Lg.x1 - 0.15, Y + 0.1, (Lg.z0 + Lg.z1) / 2));
  // the great key on it, free (issue #408: the ledge is its lock; the cage of v1.74 cut), by the edge, seen from the floor
  // below (its front toward the wall: room to stand before it); the founders' bell in sight from it
  rt.add(Key, { id: 'kB', big: true, at: [RING.key[0], Y, RING.key[1]], yaw: -Math.PI / 2 });
}

// ------------------------------------------------------------------ outside: the Founders' Belfry over the cloud
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -70, door = 40.3;
  const K = new TempleKit(rt.root, 'The Founders’ Belfry', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M, R = 15;
  landmark(K, 'arzach2', { y: door, R, bottom: base });
  // Keep the gallery and the arrival bridge on the same walking plane.
  K.both(M.floor, T(annulus(R - 0.5, R + 5, 1.2), [0, door + .04, 0]));
  const B0 = door + 37;
  // the dark doorway on the gallery, toward the plateau
  // (the drawing's small round door in the gallery wall, framed twice in its ivory stone, cobalt light: src/temples/portal.js)
  const P = portal(K, { y: door, z: R + 0.2, w: 4.4, h: 7.6, shape: 'round', layers: 2, step: 0.9, recess: 0.7, back: 1.7, into: 2.8,
    frame: lmStone('#f4ecd9', { course: 3.8, width: 8, wear: .18 }), inlay: '#7ea6ff' });
  // the bridge from the plateau's rim to the gallery (the rim is a little lower than the door)
  const rimL = K.local(V(SITE.rim[0], 0, SITE.rim[1]));
  const rimY = level.topAt?.(SITE.rim[0], SITE.rim[1]) ?? 40;
  K.bridge([0, door, R + 4.9], [0, rimY, rimL.z], 4.6, { parapet: 1.0 });
  for (const zz of [R + 12, R + 20]) K.both(M.wall, T(new THREE.CylinderGeometry(1.2, 2.2, door - base, 10), [0, (door + base) / 2 - 0.6, zz]));
  // stones that fell up, hanging round the belfry (they come down when the Cloud-Mother is calm)
  const hang = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.4, r = R + 9 + (i % 3) * 4, g = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + (i % 3) * 0.6, 1).scale(1, 0.7, 1), makeMaterial({ color: PALETTE.stone, flat: true }));
    g.position.copy(K.world(Math.sin(a) * r, B0 + 6 + (i % 4) * 5, Math.cos(a) * r));
    g.userData.noCollide = true; g.userData.dynamic = true;
    rt.root.add(g);
    hang.push({ g, y: g.position.y, i, rest: K.world(Math.sin(a) * (R + 3.4), door + 1.2 + (i % 2) * 0.5, Math.cos(a) * (R + 3.4)) });
  }
  // the founders' lamp (level design audit v1.49, issue #133: from Calix by the monastery's bell the walk to this door had
  // nothing to steer by): the dome's finial carried on as a bronze needle with a glass lamp on it, over the monastery's
  // roofs from the foot of its bell tower; cold until the bell rings, then lit (src/story/arzach2.js)
  const F0 = door + 77 * LANDMARK_SCALE.arzach2[1], bronze = BRONZE();
  K.add(bronze, new THREE.CylinderGeometry(0.28, 0.5, 9.4, 8).translate(-19.8, F0 + 4.5, 0));
  for (const y of [2.5, 5.5]) K.add(bronze, T(new THREE.TorusGeometry(0.62, 0.1, 4, 14), [-19.8, F0 + y, 0], [Math.PI / 2, 0, 0]));
  K.add(bronze, new THREE.CylinderGeometry(1.2, 0.6, 0.5, 10).translate(-19.8, F0 + 9.3, 0));
  K.add(bronze, new THREE.ConeGeometry(0.9, 2.6, 10).translate(-19.8, F0 + 12.9, 0));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; K.add(bronze, box(0.14, 2.2, 0.14, -19.8 + Math.sin(a) * 1.05, F0 + 10.6, Math.cos(a) * 1.05)); }
  const lampGeo = new THREE.SphereGeometry(1.0, 14, 10).scale(1, 1.2, 1).translate(0, 0, 0);
  const lampAt = K.world(-19.8, F0 + 10.6, 0);
  const cold = new THREE.Mesh(lampGeo, makeMaterial({ color: '#8a7a62', flat: true, key: 'temple.arzach2.lamp.cold' }));
  const warm = new THREE.Mesh(lampGeo, makeMaterial({ color: '#ffd9a0', glow: 1, key: 'temple.arzach2.lamp.lit' }));
  for (const m of [cold, warm]) { m.position.copy(lampAt); m.userData.noCollide = true; m.userData.dynamic = true; m.name = 'The founders’ lamp'; rt.root.add(m); }
  warm.visible = false;
  const lamp = { at: lampAt, top: K.world(-19.8, F0 + 14.2, 0), height: 14.2, lit: (on) => { warm.visible = !!on; cold.visible = !on; }, isLit: () => warm.visible };
  // Banks of cloud lap against the plinth, below the bridge's walking plane.
  // They leave the doorway and the complete bridge visible from its approach.
  const cloudM=makeMaterial({color:'#fff4eb',shadeFlat:.75,shade:.15,line:.3,lineTint:1,hatch:0});
  for(let i=0;i<44;i++){
    const a=i*2.39996,r=28+(i%5)*6,x=Math.sin(a)*r,z=Math.cos(a)*r*.62-9;
    if(z>0 && Math.abs(x)<13)continue;
    const size=7+(i%4)*2.1;
    const puff=new THREE.SphereGeometry(1,24,16),p=puff.attributes.position;
    for(let j=0;j<p.count;j++){
      const x=p.getX(j),y=p.getY(j),z=p.getZ(j),k=1+.07*Math.sin(x*7+y*4)*Math.cos(z*9+y*3);
      p.setXYZ(j,x*k,y*k,z*k);
    }
    puff.computeVertexNormals();
    K.add(cloudM,puff.scale(size,size*.55,size*.8).translate(x,door+2-(i%3)*2,z));
  }
  K.flush();
  // The cloud bank shares the kit's batching, but remains vapour, like the
  // world's cloud sea. Contact audits must not mistake it for a stone ledge.
  for (const mesh of K.group.children) if (mesh.material === cloudM) mesh.userData.floats = true;
  const at = K.world(0, door, R + 1.6);
  const front = K.world(0, door, R + 9);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base, doorY: door, R, top: door + 77 * LANDMARK_SCALE.arzach2[1] + 14.2, hang, clear: [] , front, lamp };
}

// ------------------------------------------------------------------ the world change: the stones come down
/**
 * Once the Cloud-Mother is calm, the stones that fell up come down, all over
 * Vael II: the floating stones settle onto what lies under them (or sink into
 * the cloud), and the stones hanging round the belfry come down onto its
 * gallery. (The level's own movers bob them every frame: this runs after them,
 * level.update's late step.)
 */
function change(scene, level, rt) {
  const A = level.arzach2;
  const stones = [];
  let physics = null;
  const rest = (g) => {
    const w = g.getWorldPosition(new THREE.Vector3());
    const gy = physics?.groundAt?.(w.x, w.y - 3, w.z, 400) ?? -Infinity;
    const floor = Number.isFinite(gy) && gy > (A?.cloudY ?? -36) ? gy + 2.5 : (A?.cloudY ?? -36) - 8;
    return floor - w.y;   // (world metres to drop)
  };
  let k = 0, want = 0;
  return {
    root: null,
    init(ph) { physics = ph; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt) { k += (want - k) * Math.min(1, dt / 8); },
    /** After the level's movers have bobbed the stones: bring them down by k (and bob the belfry's own). */
    late(dt, t) {
      for (const h of rt.outside?.hang ?? []) h.g.position.y = THREE.MathUtils.lerp(h.y + Math.sin(t * 0.4 + h.i) * 1.2, h.rest.y, k);
      if (k < 1e-3) return;
      if (!stones.length && A?.floaters) for (const g of A.floaters.children) stones.push({ g, drop: null });
      for (const s of stones) {
        s.drop ??= rest(s.g);
        s.g.position.y += s.drop * k;
        s.g.rotation.y *= 1 - k;
      }
      for (const h of rt.outside?.hang ?? []) { h.g.position.x = THREE.MathUtils.lerp(h.x0 ??= h.g.position.x, h.rest.x, k); h.g.position.z = THREE.MathUtils.lerp(h.z0 ??= h.g.position.z, h.rest.z, k); }
    },
  };
}

/**
 * A save from before issue #336's house, standing inside the old rooms (src/temples/migrate.js LAYOUTS.arzach2 v4 sets
 * temple.arzach2.relaid): its first frame inside, the traveller is taken to the last mark, in the new rooms.
 */
export const RELAID = 'temple.arzach2.relaid';

export const ARZACH2_TEMPLE = {
  id: 'arzach2', levelId: 'arzach2', name: 'The Founders’ Belfry', doorLabel: 'door of the Founders’ Belfry',
  gadget: 'hook', gadgetBox: 'arzach2.temple.bell', arenaDoor: 'd4', arenas: ARENAS,   // (the box's id from when it held the whistle: the saves' flag)
  origin: [80, 1600, 150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its look inside since v1.77, issue #342: an ancient high-tech test chamber of slate, bronze and cobalt light)
  skin: foundersBelfrySkin,
  local: { person: 'ysel', out: 29, side: 3.5 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the belfry the air is still and white, and somewhere above, something huge is crying.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below, the stones that fell up round the belfry begin to come down.', 'resolved.out'); },
  onUpdate(rt) {
    // (a save that stood in the old rooms: to the last mark, once)
    const P = rt.player;
    if (P?.pos && rt.game.flag(RELAID)) {
      rt.game.set(RELAID, null);
      if (rt.inside(P.pos) || rt.below(P.pos)) rt.toCheckpoint();
    }
  },
  // her calm comes from the bells: every founders' bell rung (struck: a pull-ring hooked, not the whistle), she hears
  onConnect(rt) { rt.offs.push(rt.game.on('bell', ({ pos, soft, struck } = {}) => { if (!soft && struck && rt.guardian?.awake) motherBell(rt.guardian, pos); })); },
};
