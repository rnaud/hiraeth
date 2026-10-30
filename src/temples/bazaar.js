import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, Pillars, EchoStone, EchoEar, Dish, Mark, Pit, Key, Updraft, NOTES } from './pieces.js';
import { signModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { undertowerSkin } from './skins/undertower.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { registerTarget } from '../targets.js';
import { registerCarryable } from '../carry.js';
import { Prop } from '../gadgets/world.js';

// The Signal Market's temple: the Undertower, the foundations of the silent
// tower, "here before the market". The makers built the first sign of all
// here: a machine to say one line into the dark, over and over, for whoever
// was listening. The market grew up round it and built its towers on top, and
// forgot it; only the silent tower stands right over it. The night the sky
// rang it stuck on one word of its line, and has said nothing else since:
// under the square at night you can hear it, if you put your ear to the stones.
//
// One idea runs through it (reworked from the temple design audit, docs/audits/temple-design-v1.12.md): a note
// travels. The makers' dishes carry it across a hall, the hourglass's sand carries it in your pocket, and the sand
// holds one note at a time, so what goes where first is the puzzle.
//
// Since v1.83 (issue #418, docs/design/temple-best-practices.md) it is the last house's exam of the whole game, round
// one great hall over three floors, the Great Well (G4). One step each for the wings, the hook, the lens and the bombs,
// each joined with the hourglass (G2); a house-wide state (G1), the LINE: the First Sign's one word let into the
// makers' cables (the house speaks: its lifts and its bellows run, and every horn on a cable hears only the word) or
// shut out (quiet: the horns hear), set at a relay lever by every hub and read on a lamp in every room; safe drops back
// to the hub (G6); and a guardian with two fights and a puzzle between them (G3d).
//
// Inside (built far overhead, through the old doorway in the tower's back), floors F0 (0), F1 (12) and F2 (24):
//   the Threshold        the first mark, the way out
//   the Hall of Dishes   (F0) no way over the cable pit: the makers' pillars rise only for a horn on the far landing
//                        that hears a stone's own song, too far for any note sung on this side. The singing ball rolled
//                        onto the footstone of a great dish wakes it; splashed there, its note comes out of the dish's
//                        twin over the horn (push + shot: a note travels, taught where failing is free). On the far
//                        landing the line's first relay lever, by the way into the hub, and the Choir gate's horn
//   the Great Well       the hub and the great hall (G4): 42 by 64 m under 42, its floor (F0), its gallery round three
//                        sides (F1, `landing`) and its high balcony over the north end (F2, `top`), all seen at once. The
//                        line's great horn hangs in its middle: while the house speaks it says the First Sign's word, and
//                        the sand can catch it. The great lift to the gallery wakes the first time the house speaks
//   the Cable Store      (F0, west, down a passage under the Choir: the house's one fight, an arena) its door a cable
//                        door, open only while the house speaks; it shuts behind you while its keepers stand
//   the Tuning Room      (F0, east) a pair of dishes across the room: the near one deaf until a ball is on its
//                        footstone, a low and a high stone by its mouth; the far horn, too far for either alone, wants
//                        the high one
//   the Shell Chamber    (F1, north through the two small keys' door) the makers' chest: the RECALL HOURGLASS
//                        (src/gadgets/recall.js; its sand keeps the last note sung near you and gives it back:
//                        src/echo-shell.js). Its way on is a walkway 12 m up on a pier: a counterweight sits on it.
//                        Knock it off (a shot or a push), stand on it, turn the hourglass on it: it rides back up its
//                        cable with you on it (the hourglass's ride, taught where failing is free)
//   the Listening Passage (F2) the door into the gallery listens for the low note through its horn, deaf until a ball is
//                        on its footstone and the house is quiet (a relay lever by its door); the low note is carried
//                        from the chamber's stone
//   the Gallery of Voices (F2, LENS + HOURGLASS) the listening pillars down in the chasm rise while the high note,
//                        played back near them, still rings; and they are there only through the seeing lens. Over
//                        them, the far landing and the great door: the great key, the ball on the near dish's
//                        footstone and the middle note sent over through the dishes
//   the Choir            (F1, west off the gallery) its gate listens through a horn back on the Hall of Dishes' far
//                        landing for the middle note played back. Inside (BOMBS + HOURGLASS), two horns and a small
//                        key's cage between them: the far one hears a stone's own low song through a pair of dishes,
//                        the near one, black, hears only a blast's boom played back (the house quiet for both)
//   the high balcony     (F2, HOOK + HOURGLASS) a second counterweight sits on the balcony's lip, too high for any
//                        hand: hook it down to you on the gallery, stand on it, turn the hourglass on it, and ride it
//                        back up. A drop off the lip into the old cable heaped on the floor is the way back (G6)
//   the Bellows          (F2, east, through a door that takes the Choir's small key, open while the house speaks;
//                        WINGS + HOURGLASS) the makers' bellows blow up their shaft while their horn rings: it wants
//                        the First Sign's word played back, caught from the great horn while the house speaks. Open
//                        your wings in the draught: the Crown, high on the shaft's wall, holds the great key; a drop
//                        off it onto the bellows' breath, and the balcony's drop, are the way back down
//   the First Sign's Hall the guardian (a robot: its meter is damage, which here is retuning). It cries its word; when
//                        it lowers its dish to listen, play its word back into it. Then a puzzle (G3d): it floods the
//                        cables with its one word (the house speaks), and hears nothing until you shut it out at the
//                        hall's relay; then it turns its dish to the stone that sings the next word of its line, and
//                        wants it played back, in order. Its last fight: it hears only through its cables, the low
//                        dishes on the wall
// After: the silent tower speaks, once a night, the whole line, in the First Sign's voice (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The old doorway in the silent tower's back (the side away from the square's front), looking south down the avenue's end. */
export const SITE = { x: 0, z: -267, r: 8, heading: Math.PI, tower: { x: 0, z: -255, top: 98 } };

/**
 * The Undertower's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/undertower):
 * blue-grey masonry in heavy blocks, its frames the same stone (no more brass frames: brass is for the horns and
 * fittings), grey flagstones, a darker course under every frieze and at the foot, slots of the market's coral and teal
 * light by turns under the friezes; its shade a deep blue, its light the lamps' warm.
 */
export const PALETTE = {
  wall: '#61748b', wall2: '#596c83', wall3: '#6a7d94', floor: '#9c998f', floor2: '#8e8b81', trim: '#71859b', fitting: '#c99758', strata: 1.8,
  dark: '#3a535b', stone: '#88b4b5', accent: '#f0a083', glow: '#fff0bd', glyph: '#ffd9a0', lamp: '#ffe3aa', sand: '#a4c1be', sand2: '#94b1ae', void: '#243e59',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.8, lampTint: ['#f0c890', 0.7] },
    wall: { mode: 0, grid: 1.5, plates: true },
    floor: { mode: 0, grid: 1.8, plates: true },
    glyph: { glow: 0.6 },
  },
  bands: [{ at: 0.72, h: 1.2, color: '#506279' }, { y: 0.4, h: 0.8, color: '#506279' }],
  ornament: { kind: 'slot', color: '#f0a083', color2: '#7fd6cf', glow: 0.85 },
  light: { shadow: '#46527c', light: '#ffe9cc', sun: '#ffd9a8' },
};

/** The First Sign's line, a word (or two) at a time; each is a note of its own (the hourglass's sand keeps one). */
export const LINE = ['SOMEBODY', 'OUT THERE', 'IS TALKING', 'TO YOU'];
const WORD_DEGREES = [1, 3, 5, 6];
const LISTEN = 14;   // m: how close to its dish a played-back word has to be
/** The low dishes on the First Sign's hall's wall: what is played into one reaches it down its cables, from anywhere. */
export const SIGN_DISHES = ['signDishW', 'signDishE'];
/** How long a gallery pillar stands after it last heard the high note (s), and how near it (m, across the floor). */
export const HOLD = { pillar: 6, reach: 6.5 };

/** The floors (m): the Great Well's floor, its gallery, its high balcony. */
export const F1 = 12, F2 = 24;

// ------------------------------------------------------------------ the line: the house's one state (issue #418, G1)
/**
 * The line's two stops, as conditions: the First Sign's word let into the makers' cables (SPEAK: the house speaks, its
 * lifts, doors and bellows on the cables run, and every horn on a cable hears only the word) or shut out (QUIET).
 */
export const SPEAK = { drumOn: ['line', 'lineSpeaking'] }, QUIET = { drumOn: ['line', 'lineQuiet'] };
/**
 * Its look in every room (one lamp material: the relay levers' knobs, the line lamps, the great horn's ring): coral while
 * the house speaks, a dark slate while it is quiet. `every`: s between the great horn's words while it speaks; `reach`:
 * m from it the sand catches its word.
 */
export const LINE_LOOK = { speaking: '#f0a083', quiet: '#3d5566', glow: [0.1, 0.9], every: 4.5, reach: 38 };
const lineLamp = () => makeMaterial({ color: LINE_LOOK.quiet, glow: LINE_LOOK.glow[0], flat: true, key: 'temple.bazaar.line' });
/** The counterweights (m, m/s, s): their size, the pace they go on their cables (down, hooked, and so back up under the
 * hourglass), how long one left off its ledge waits before its cable draws it home. */
export const WEIGHTS = { size: 1.6, pace: 6, slide: 3, back: 10 };

// ------------------------------------------------------------------ the rooms (v1.77, issue #336; v1.83, issue #418)
/**
 * The house's doors (m: issue #336, 5 by 6.4 before) and its rooms in the kit's local frame (z into the house): each
 * hall's floor from wall to wall (its walls stand outside it), its floor's height and its ceiling's; the round halls'
 * middles and radii. The Hall of Dishes and the Gallery of Voices stand on their pits' floors (`y`), their landings at
 * `floor` (`near` the near landing's depth, `pit` the pit's; the far landing the rest).
 */
export const DOOR = { w: 7, h: 9 };
/**
 * The great lock into the antechamber (d4): 6 by 9, the narrowest the rules allow. (The antechamber is the camera QC's
 * close room, scripts/camera-qc/sim-lock.mjs: the close camera reads the room through the doorway, and at 7 m it read the
 * room wide and was pulled in off its west wall in one frame, tests/camera-qc-lock.test.js.)
 */
export const LOCK = { w: 6, h: 9 };
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  dishes: { x0: -18, x1: 18, z0: 15.2, z1: 67.2, y: -8, floor: 0, top: 20, near: 18, pit: 16 },
  well: { x0: -21, x1: 21, z0: 70.4, z1: 134.4, y: 0, top: 42 },
  store: { x0: -89, x1: -59, z0: 73, z1: 103, y: 0, top: 18 },
  tune: { x0: 29, x1: 59, z0: 73, z1: 103, y: 0, top: 18 },
  shell: { x: 0, z: 160.4, r: 17, y: F1, top: F1 + 26 },
  choir: { x0: -55, x1: -25, z0: 92, z1: 138, y: F1, top: F1 + 18 },
  bellows: { x0: 27, x1: 57, z0: 113, z1: 143, y: F2, top: F2 + 34 },
  listen: { x0: -15, x1: 15, z0: 182, z1: 212, y: F2, top: F2 + 18 },
  gallery: { x0: -18, x1: 18, z0: 215.4, z1: 271.4, y: F2 - 18, floor: F2, top: F2 + 18, near: 18, pit: 20 },
};
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
/**
 * (issue #418, G4) The Great Well's floors: its gallery (F1) round the west, east and north sides, `arm` m wide, the arms
 * from `s` north to the north band (a block of stone from the floor up, `band` its south face); the high balcony (F2) over
 * the north end from its lip `lip` to the north wall. `store`: the z of the ways west and east off the floor; `gate`: the
 * Choir's gate off the west arm; `drop`: where the west arm has no parapet (a drop to the floor, 12 m, unhurt); `door`:
 * the balcony's way east to the Bellows (z); `lift`: the great lift beside the east arm ({ x, z, r }); `weight`: the
 * high counterweight's foot, hanging on its cable from a davit over the balcony's lip, its top level with the balcony (seen
 * whole from the gallery below); `heap`: the old cable on the floor under the lip's open stretch (`gap`, x).
 */
export const WELL = { arm: 6, s: 78, band: 126.4, lip: 118.4, store: 88, gate: 100, drop: [84, 96], door: 126.4,
  lift: { x: 12.4, z: 108, r: 2.2 }, weight: [-8, F2 - WEIGHTS.size, 117.6], gap: [-3, 3], heap: { x0: -5, x1: 5, z0: 111, z1: 118.4 },
  horn: [0, 27, 100] };
/**
 * (issue #418) The Shell Chamber's walkway: a pier `pier` across (x 0, z `z`), the walkway from its south face (z0) north
 * to `z1`, `w` wide, then a landing `landing` m either side to the chamber's high doorway at F2; the low counterweight on
 * the walkway (`weight`: its foot, local). Local m.
 */
const C3 = ROOMS.shell.z;
export const SHELF = { z: C3 + 6.7, pier: 2.6, z0: C3 + 5.2, z1: C3 + 11, w: 2.6, landing: 3.5, weight: [0, F2, C3 + 6.4] };
/**
 * (issue #418) The Bellows: the draught's foot (x, z), its radius and how high it blows; the horn by it; the Crown, a ledge
 * along the shaft's north wall at `crown.y` (z0 to the wall), the great key on it, the bellows' breath under its edge.
 */
const BW = ROOMS.bellows, [BWX, BWZ] = mid(BW);
export const BELLOWS = { x: BWX, z: BWZ + 2, r: 4.5, h: 24, horn: [BWX - 5, F2, BWZ - 5], crown: { y: F2 + 20, z0: BW.z1 - 6 }, key: [BWX, F2 + 20, BW.z1 - 3] };

/** The relay levers (one by every hub, G1: `room`, its foot, the way it faces) and the line lamps (a room each). */
export const LEVERS = [
  { room: 'dishesFar', at: [5.5, 0, 64.2], yaw: Math.PI },
  { room: 'landing', at: [-8, F1, 130.6], yaw: Math.PI },
  { room: 'top', at: [-13, F2, 131.6], yaw: Math.PI },
  { room: 'listen', at: [-4.2, F2, ROOMS.listen.z0 + 2.6], yaw: Math.PI / 2 },
  { room: 'hall', at: [-6.4, F2, 0], yaw: Math.PI * 0.85 },   // (z: set from its hall's place, layout)
];

export const LOGIC = {
  id: 'bazaar', entry: 'threshold', gadget: 'recall',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js. Since
  // v1.83, issue #418: `well` the Great Well's floor, `landing` its gallery, `top` its high balcony; `gallery` and
  // `galleryFar` the Gallery of Voices' landings as before, so a save's last mark holds)
  rooms: {
    threshold: { kind: 'passage' }, dishes: { kind: 'puzzle' }, dishesFar: { kind: 'puzzle' }, well: { kind: 'passage' },
    store: { kind: 'combat' }, tune: { kind: 'puzzle' }, landing: { kind: 'passage' }, top: { kind: 'passage' },
    shell: { kind: 'puzzle' }, listen: { kind: 'puzzle' }, gallery: { kind: 'puzzle' }, galleryFar: { kind: 'puzzle' },
    choir: { kind: 'puzzle' }, bellows: { kind: 'puzzle' }, crown: { kind: 'passage' },
    hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'dishes' },
    { a: 'dishes', b: 'dishesFar', door: 'disc' },    // the pillars over the cable pit, once their horn has heard the ball
    { a: 'dishesFar', b: 'well' },
    // the Great Well (v1.83, issue #418): west the Cable Store (an arena, behind a cable door: open while the house speaks),
    // east the Tuning Room at its floor; the great lift to its gallery (the house speaking), a drop from the gallery's west
    // arm back to the floor (G6)
    { a: 'well', b: 'store', door: 'dS' },
    { a: 'well', b: 'tune' },
    { a: 'well', b: 'landing', door: 'lift' },
    { a: 'landing', b: 'well', oneWay: true },
    { a: 'landing', b: 'shell', door: 'dK' },         // two small keys
    // the Shell Chamber's walkway, 12 m up on its pier: its counterweight knocked off, ridden back up under the hourglass;
    // the walkway's lip a drop back into the chamber
    { a: 'shell', b: 'listen', door: 'knock', needs: ['recall'] },
    { a: 'listen', b: 'gallery', door: 'd3' },         // the Listening Passage's door
    { a: 'gallery', b: 'galleryFar', needs: ['recall', 'monocle'] },   // the listening pillars: the high note carried over, seen through the lens
    { a: 'galleryFar', b: 'hall', door: 'd4' },        // (and the great key)
    { a: 'hall', b: 'out', door: 'd5' },
    // the Choir off the gallery's west arm: its gate's horn back on the first hall's far landing
    { a: 'landing', b: 'choir', door: 'dG' },
    // the high balcony: its counterweight hooked down and ridden back up (the hook and the hourglass); its lip a drop into
    // the cable heaped on the floor (G6)
    { a: 'landing', b: 'top', needs: ['hook', 'recall'] },
    { a: 'top', b: 'well', oneWay: true },
    { a: 'top', b: 'bellows', door: 'dB' },            // the Choir's small key, the house speaking
    // up the draught on the wings to the Crown; off its edge onto the bellows' breath
    { a: 'bellows', b: 'crown', door: 'draught', needs: ['glider'], oneWay: true },
    { a: 'crown', b: 'bellows', oneWay: true },
  ],
  elements: {
    ball1: { type: 'drum', room: 'dishes', plate: 'p1', plateAt: 1, start: 0 },   // the singing ball, onto the dish's footstone
    p1: { type: 'plate', room: 'dishes' },
    eD: { type: 'switch', room: 'dishes' },                           // the horn across the pit: a stone's own song, through the dishes
    disc: { type: 'bridge', opens: { all: [{ drumOn: ['ball1', 'p1'] }, { lit: 'eD' }] }, latch: true },
    // the Cable Store: a cable door, open while the house speaks (and shut behind you while its keepers stand: ARENAS);
    // its keepers beaten, the small key's cage sinks
    dS: { type: 'door', opens: SPEAK },
    arW: { type: 'arena', room: 'store' },
    kW: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arW' } },
    // the Tuning Room: the ball on the near dish's footstone, the high stone sung by its mouth, the far horn hears it
    ballT: { type: 'drum', room: 'tune', plate: 'pT', plateAt: 1, start: 0 },
    pT: { type: 'plate', room: 'tune' },
    eT: { type: 'switch', room: 'tune' },
    kE: { type: 'key', kind: 'small', room: 'tune', when: { all: [{ drumOn: ['ballT', 'pT'] }, { lit: 'eT' }] } },
    // the great lift up to the gallery: it wakes the first time the word runs in its cable, and runs from then on (latched:
    // the house quiet again never strands anyone on either floor)
    lift: { type: 'bridge', opens: SPEAK, latch: true },
    dK: { type: 'door', lock: 'small', keys: 2, latch: true },
    // (issue #377: the chest held the echo shell, a tool for this house alone; the recall hourglass now, the market's own
    // tool, whose sand keeps the last note sung near you and gives it back, turned on the air or with Y / △: src/echo-shell.js)
    chest: { type: 'gadget', room: 'shell', item: 'recall' },
    // (issue #418) the chamber's counterweight knocked off its walkway: then the hourglass rides it back up
    knock: { type: 'switch', room: 'shell', noun: 'counterweight', act: 'Knock off' },   // (its words on the Temple maps page)
    // the passage's horn: the low note, carried from the chamber's stone; deaf until a ball's weight is on its footstone,
    // and while the house speaks
    ballP: { type: 'drum', room: 'listen', plate: 'pP', plateAt: 1, start: 0 },
    pP: { type: 'plate', room: 'listen' },
    e0: { type: 'switch', room: 'listen', needs: ['recall'], when: { all: [{ drumOn: ['ballP', 'pP'] }, QUIET] } },
    d3: { type: 'door', opens: { lit: 'e0' }, latch: true },
    ball2: { type: 'drum', room: 'gallery', plate: 'p2', plateAt: 1, start: 0 },  // onto the near dish's footstone
    p2: { type: 'plate', room: 'gallery' },
    e2: { type: 'switch', room: 'galleryFar', needs: ['recall'] },     // the middle note, said by the dish over the far door
    d4: { type: 'door', lock: 'big', opens: { all: [{ drumOn: ['ball2', 'p2'] }, { lit: 'e2' }] }, latch: true },   // (the arena's door too: it shuts behind you; and the great key)
    // the Choir: its gate off the gallery's west arm listens through a horn back on the Hall of Dishes' far landing, at its
    // cable's end, for the middle note played back (the singing ball sings it, across the pit)
    hG: { type: 'switch', room: 'dishesFar', needs: ['recall'] },
    dG: { type: 'door', opens: { lit: 'hG' }, latch: true },
    // inside (issue #418): the far horn hears the low stone's own song through a pair of dishes (a ball on the near dish's
    // footstone); the near one, black, a blast's boom played back (an ink bomb, and the hourglass); both on cables, deaf while
    // the house speaks. Both answered, the small key's cage sinks
    ballQ: { type: 'drum', room: 'choir', plate: 'pQ', plateAt: 1, start: 0 },
    pQ: { type: 'plate', room: 'choir' },
    hA: { type: 'switch', room: 'choir', when: { all: [{ drumOn: ['ballQ', 'pQ'] }, QUIET] } },
    hB: { type: 'switch', room: 'choir', needs: ['bomb', 'recall'], when: QUIET },
    kC: { type: 'key', kind: 'small', room: 'choir', when: { all: [{ lit: 'hA' }, { lit: 'hB' }] } },
    // the Bellows' door: the Choir's small key, and a cable door (open while the house speaks)
    dB: { type: 'door', lock: 'small', opens: SPEAK },
    // the bellows' horn wants the First Sign's word played back (caught from the great horn while the house speaks), and
    // the bellows blow while it rings and the house speaks: up the draught on the wings to the Crown and the great key
    hW: { type: 'switch', room: 'bellows', needs: ['recall'], hold: 12 },
    draught: { type: 'bridge', opens: { all: [SPEAK, { lit: 'hW' }] } },
    kB: { type: 'key', kind: 'big', room: 'crown' },
    sign: { type: 'boss', room: 'hall', needs: ['gun', 'recall'] },
    d5: { type: 'door', opens: { resolved: true } },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'tune', at: [33.6, 0, 78.1], yaw: Math.PI / 2, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
    // (issue #418, G1) the line, the house's state: quiet (0) or speaking (1), saved. Set at the relay levers by the hubs
    // (the Hall of Dishes' far landing by the way into the Great Well, its gallery, its high balcony, the Listening Passage by
    // its door, the First Sign's hall). Its two stops are no plates anyone stands on. (Last of the things to do, so the scout
    // asks for it only once nothing nearer is left: logic.next)
    line: { type: 'drum', room: 'dishesFar', rooms: ['landing', 'top', 'listen', 'hall'], stops: { lineQuiet: 0, lineSpeaking: 1 }, start: 0, roll: 'hand', verb: 'relay' },
    lineQuiet: { type: 'plate' }, lineSpeaking: { type: 'plate' },
  },
};

// ------------------------------------------------------------------ the guardian
/** Its fight's moves (the Arena's spar keeps them: signSpar). */
const SIGN_ATTACKS = {
  cry: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'lean', wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
  beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'mouth', blast: { kind: 'beam', r: 0.75 }, gap: 0.4, damage: 0.75, knock: 10, recover: 0.6, then: 'sweep' },
  sweep: { shape: 'cone', range: 22, angle: 0.8, wind: 1.0, track: 0.5, part: 'mouth', rig: 'coil', pose: 'beam', side: 1, link: true, blast: { kind: 'beam', r: 0.75, sweep: 0.8 }, damage: 0.75, knock: 10, recover: 0.8 },
  static: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.75, knock: 8, recover: 0.6 },
  statics: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.5, knock: 6, recover: 0.6 },
  stutter: { shape: 'ring', at: 'self', radius: 5.5, wind: 1.2, part: 'mouth', rig: 'swell', pose: 'cry', blast: { kind: 'front', r0: 1.5, h: 0.8 }, gap: 0.75, damage: 0.5, knock: 9, recover: 0.4, then: 'stutter2' },
  stutter2: { shape: 'ring', at: 'self', radius: 5.5, wind: 0.65, part: 'mouth', rig: 'swell', pose: 'cry', link: true, blast: { kind: 'front', r0: 1.5, h: 0.8 }, damage: 0.5, knock: 9, gap: 0.25, then: 'cryEnd' },
  cryEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'lean', pose: 'cry', link: true, wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
};
/** (v1.63, #257) Its second verb before the gadget, a dodge of its beam: in its last fight since issue #418. */
const SIGN_ASKS = { verb: 'dodge', moves: ['beam'], open: 4.4,
  hint: 'Hop clear of its beam as it fires: it overreaches and lowers its dish.',
  said: 'Its beam burns past you. It lowers its dish to listen: play its word back.',
  lines: ['Its beam searches for you.', 'Hop aside from its beam just as it fires: it lowers its dish.', 'When its dish glows to fire, flip back (stick back and A / ×) as the beam comes; then turn the hourglass ({key:fire}) to give its word back.'] };

/**
 * The First Sign (issue #418, G3d: two fights and a puzzle between them). Its first fight: it cries its word and lowers its
 * dish to listen; its word played back into it retunes it. Then the puzzle (`puzzle`: no moves of its own, its temple's
 * onUpdate keeps it): it turns its dish up and floods the cables with its one word, the house speaking, and hears nothing
 * until the word is shut out at its hall's relay; then it turns its dish to the stone that sings the next word of its line
 * (WordStone, round its hall's wall) and listens, and wants each word played back, in order. Its last fight: it hears
 * only through its cables, the low dishes on the wall.
 */
export const FIRST_SIGN = {
  kind: 'robot', name: 'the First Sign', final: 'break', speed: 1.4, wakeTime: 3.0,
  wake: 'A makers’ mast lifts its great dish, turns to you, and cries one word.',
  openHint: 'It lowers its dish, listening: play its word back into it.',
  resolved: 'The First Sign says its whole line once, quietly, and listens.',
  phases: [
    { to: 0.3, attacks: ['cry', 'beam', 'static'], pause: 1.6, hint: 'When it lowers its dish to listen, play its word back into it.' },
    { to: 0.7, attacks: [], pause: 1.4, puzzle: true, hint: 'Its word fills the cables. Pull the lever by the door, then answer it.',
      openHint: 'It turns its dish to a stone and listens: give it that word.' },
    { to: 1.0, attacks: ['statics', 'stutter', 'beam'], pause: 1.0, hint: 'Now it only hears through the wall dishes: play its word into one.', asks: SIGN_ASKS },
  ],
  attacks: SIGN_ATTACKS,
};
/**
 * The First Sign in the Arena's ring (src/arena-guardians.js): there is no hall of cables and stones, so it spars as it
 * fought in its house before v1.83, three fights (the sparring rule in place of its words).
 */
export const signSpar = () => ({
  ...FIRST_SIGN,
  phases: [
    { to: 0.5, attacks: ['cry', 'beam', 'static'], pause: 1.6, hint: 'When it lowers its dish to listen, play its word back into it.' },
    { to: 0.75, attacks: ['beam', 'stutter', 'static'], pause: 1.2, hint: 'A new word: catch it, then play it into its dish.', asks: SIGN_ASKS },
    { to: 1.0, attacks: ['statics', 'stutter', 'beam'], pause: 1.0, hint: 'Once more: when it lowers its dish, play its word back.' },
  ],
});

function signHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its mast.', 'fs.push'); return true; }
  g.rt.notice('The fluid rattles off its dish. It is listening for its word.', 'fs.fluid');
  return true;
}

/** The Cable Store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round the middle of the store). */
export const ARENAS = [{
  el: 'arW', room: 'store', zone: { min: [ROOMS.store.x0, -1, ROOMS.store.z0], max: [ROOMS.store.x1, 10, ROOMS.store.z1] }, doors: ['dS'], extra: 2,
  shut: 'The door grinds shut behind you. Among the coils of old cable, something lifts its head.',
  won: 'The last of them falls still among the cable. The key’s cage sinks, and the door lets go.',
}];

// ------------------------------------------------------------------ pieces of the house's own
/**
 * A piece of the First Sign's own (its element's id, 'sign'): the dark ring at its foot and the cables out from it to the
 * hall's wall (the redesign's rules measure the guardian's hall by its pieces, scripts/temple-design/rules.mjs: the hall
 * has no mark). o: { id, at: its foot (local), r: the hall's radius }
 */
class SignFoot {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, r = o.r;
    K.add(M.dark, T(annulus(3.4, 4.4, 0.06, 40), [x, y + 0.06, z]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2, p = [x + Math.sin(a) * 4, y + 0.2, z + Math.cos(a) * 4], q = [x + Math.sin(a) * (r - 0.5), y + 0.2, z + Math.cos(a) * (r - 0.5)];
      K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(...p), V((p[0] + q[0]) / 2, y + 0.25, (p[2] + q[2]) / 2), V(...q)]), 16, 0.25, 5));
    }
  }
  update() {}
}

const _lc = new THREE.Color();
/**
 * The line (issue #418, G1): the house's one state, its element `line` a drum of two stops (quiet 0, speaking 1). This
 * piece keeps it: the great horn hung in the Great Well's middle (`horn`: local, its mouth's height), its ring and every
 * lamp of the line (lineLamp) coral while the house speaks and dark while it is quiet. While it speaks the horn says the
 * First Sign's word every LINE_LOOK.every s (the game's 'note' event: the hourglass's sand catches it within
 * LINE_LOOK.reach m), and the cables from it up the walls glow. Set at a RelayLever (toggle), or by the First Sign (set).
 * Its `center` is the scout's: the nearest lever. (It has no `at`: the rules' and the maps' place for the line is its
 * levers', `sets: 'line'`.)
 */
export class LineRelay {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.horn;
    this.mouth = K.world(x, y - 2.4, z);
    this.lamp = lineLamp();
    this.k = this.speaking ? 1 : 0;
    this.wordT = 1.2;
    this.setters = [];
    // the great horn: a brass bell 5 m across turned down over the floor, ringed in the line's lamp, its throat the lamp too,
    // hung on a rod from the roof
    const brass = makeMaterial({ color: '#c99758', flat: true, metal: 'brass', refl: 0.3, side: THREE.DoubleSide, key: 'temple.bazaar.hornBrass' });
    K.add(brass, T(lathe([[0.4, 0], [0.6, 1.3], [1.2, 2.5], [2.4, 3.2], [2.55, 3.4]], 28), [x, y + 1.0, z], [Math.PI, 0, 0]));
    K.add(this.lamp, T(new THREE.TorusGeometry(2.5, 0.16, 6, 40).rotateX(Math.PI / 2), [x, y - 2.36, z]));
    K.add(this.lamp, T(new THREE.CircleGeometry(1.15, 24).rotateX(Math.PI / 2), [x, y - 0.6, z]));
    K.add(M.trim, T(new THREE.CylinderGeometry(0.2, 0.2, o.roof - y, 8), [x, (o.roof + y) / 2, z]));
    // (the word going out of it while the house speaks: a ring of the lamp's light, widening and fading, each time it says it)
    this.ringM = makeMaterial({ color: LINE_LOOK.speaking, glow: 0.8, flat: true, key: 'temple.bazaar.lineRing' });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 4, 48).rotateX(Math.PI / 2), this.ringM);
    this.ring.position.copy(this.mouth); this.ring.visible = false;
    this.ring.userData.noCollide = true; this.ring.userData.dynamic = true;
    rt.root.add(this.ring);
    this.wave = -1;
    // its cables, out to the four walls and down them (lit with the line)
    for (const [wx, wz] of o.walls ?? []) {
      const mid = V((x + wx) / 2, y + 2.5, (z + wz) / 2);
      K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, y + 0.6, z), mid, V(wx, y + 4, wz)]), 18, 0.2, 5));
      K.add(this.lamp, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, y + 0.9, z), mid.clone().setY(mid.y + 0.3), V(wx, y + 4.3, wz)]), 18, 0.12, 4));
      K.add(M.dark, T(new THREE.CylinderGeometry(0.2, 0.2, y + 4, 5), [wx, (y + 4) / 2, wz]));
      K.add(this.lamp, T(new THREE.CylinderGeometry(0.09, 0.09, y + 4, 4), [wx + (wx > 0 ? -0.22 : 0.22), (y + 4) / 2, wz]));   // (lit down the wall)
    }
    rt.line = this;
  }
  get speaking() { return this.rt.logic.drumOn('line', 'lineSpeaking'); }
  /** Speaking (true) or quiet; `by`: who set it (a lever's id, or 'sign'). Returns whether it changed. */
  set(on, by = null) {
    if (!!on === this.speaking) return false;
    const rt = this.rt;
    rt.logic.moveDrum('line', on ? 1 : 0); rt.applyDoors?.();
    rt.rumble?.(on ? 1.0 : 0.6, 0.4);
    rt.sound?.critter?.('whirr', on ? 1.3 : 0.8);
    if (by !== 'sign') rt.notice?.(on ? 'The relay throws over. The First Sign’s word runs in every cable.' : 'The relay falls back. The cables go quiet.', on ? 'line.speak' : 'line.quiet');
    if (on) this.wordT = 0.6;
    rt.game?.emit?.('temple:lit', { id: rt.id, el: 'line' });
    return true;
  }
  toggle(by = null) { this.set(!this.speaking, by); return this.speaking ? 'speaking' : 'quiet'; }
  /** The word, said through the great horn (and caught by the sand within reach). */
  say() {
    const rt = this.rt;
    this.wave = 0;
    rt.sound?.orbNote?.(WORD_DEGREES[0], this.mouth, { size: 1.4 });
    rt.game?.emit?.('note', { pos: this.mouth.clone(), note: 'sign.0', degree: WORD_DEGREES[0], color: '#fff0bd', label: `the First Sign’s word, “${LINE[0]}”`, reach: LINE_LOOK.reach });
  }
  update(dt, t) {
    const on = this.speaking;
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 3);
    const u = this.lamp.uniforms, pulse = on ? Math.max(0, 1 - (LINE_LOOK.every - this.wordT) * 1.5) : 0;
    u.uColor.value.set(LINE_LOOK.quiet).lerp(_lc.set(LINE_LOOK.speaking), this.k);
    u.uGlow.value = LINE_LOOK.glow[0] + this.k * (LINE_LOOK.glow[1] - LINE_LOOK.glow[0]) * (0.75 + 0.25 * Math.sin(t * 3)) + pulse * 0.3;
    if (this.wave >= 0) {
      this.wave += dt;
      const k = Math.min(1, this.wave / 2.2);
      this.ring.visible = k < 1;
      this.ring.scale.setScalar(2.6 + k * 16);
      this.ringM.uniforms.uGlow.value = 0.85 * (1 - k);
      if (k >= 1) this.wave = -1;
    }
    if (!on) return;
    if ((this.wordT -= dt) <= 0) { this.wordT = LINE_LOOK.every; this.say(); }
  }
  /** Where to set it from (the scout's): the nearest lever (`setters`: [{ at, lever }], as the Founders' Belfry's bell's). */
  get center() {
    const P = this.rt.player?.pos, list = this.setters.map((s) => s.at);
    if (!P || !list.length) return this.mouth;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
}

/**
 * A relay lever of the line, by a hub (LEVERS, G1: cheap to change): a dark post, a brass arm, its knob the line's lamp.
 * Pulled (A / ×) it lets the First Sign's word into the cables or shuts it out (LineRelay.set); the arm stands up while the
 * house speaks. o: { id, room, at (its foot, local), yaw, sets: 'line' }
 */
export class RelayLever {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.05;
    this.pos = K.world(x, y, z);
    K.both(M.dark, T(new THREE.CylinderGeometry(0.3, 0.42, H, 8), [x, y + H / 2, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.33, 0.05, 6, 20), [x, y + H, z], [Math.PI / 2, 0, 0]));
    K.add(lineLamp(), T(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), [x, y + H + 0.02, z]));
    this.top = K.world(x, y + H + 0.1, z);
    this.at = this.top;
    this.arm = new THREE.Group();
    this.arm.position.copy(this.top);
    this.arm.rotation.y = K.heading(o.yaw ?? 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6).translate(0, 0.5, 0), makeMaterial({ color: '#a8874a', flat: true, metal: 'brass', refl: 0.3, key: 'temple.bazaar.lever' }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.02, 0), lineLamp());
    this.pivot = new THREE.Group(); this.pivot.add(bar, knob);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.a = 0;
    const line = () => rt.line;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (line()?.speaking ? 'shut the word out of the cables' : 'let the word into the cables'),
      enabled: () => !!line(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { const r = line()?.toggle(this.id); this.kick = 1; return r; },
    });
    this.later = true;   // (it joins the relay's list on its first frame: the relay may be placed after it)
  }
  update(dt) {
    const R = this.rt.line;
    if (this.later && R) { this.later = false; R.setters.push({ at: this.top, lever: this.id }); }
    const want = (R?.speaking ? 1 : -1) * 0.75;
    this.a += (want - this.a) * Math.min(1, dt * 6);
    this.kick = Math.max(0, (this.kick ?? 0) - dt * 3);
    this.pivot.rotation.x = this.a + Math.sin(this.kick * 9) * 0.1 * this.kick;
  }
  dispose() { this.off?.(); }
}

/**
 * A line lamp: the line's state in a room (issue #418, G1: readable everywhere). A slender post by the room's way in, a
 * small brass horn on it turned up, its mouth the line's lamp: coral while the house speaks, dark while it is quiet. Drawn
 * in the kit's batches. o: { room, at (its foot, local), shows: 'line' }
 */
export class LineLamp {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at;
    K.both(M.trim, T(new THREE.CylinderGeometry(0.08, 0.14, 2.3, 8), [x, y + 1.15, z]));
    K.add(makeMaterial({ color: '#c99758', flat: true, metal: 'brass', refl: 0.3, side: THREE.DoubleSide, key: 'temple.bazaar.hornBrass' }), T(lathe([[0.1, 0], [0.16, 0.25], [0.42, 0.6], [0.62, 0.75]], 16), [x, y + 2.3, z]));
    K.add(lineLamp(), T(new THREE.TorusGeometry(0.62, 0.09, 6, 24).rotateX(Math.PI / 2), [x, y + 3.06, z]));
    K.add(lineLamp(), T(new THREE.CircleGeometry(0.55, 18).rotateX(-Math.PI / 2), [x, y + 2.98, z]));
  }
  update() {}
}

/**
 * A heap of the makers' old cable under a drop (issue #418, G6): fall onto it from any height and it takes the fall in the
 * last metres (slowed to `slow` m/s, from `over` m up or a few frames of the fall, whichever is more), a soft thud,
 * nothing hurt; the Footprint's pools (spheres.js Catch) done with old cable. o: { id, box: { x0, x1, z0, z1 } (local), y
 * (its floor), said, coils (false: no coils drawn) }
 */
export const HEAP = { slow: 12, over: 2.5 };
export class CableHeap {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.on = false;
    const K = rt.kit, M = rt.M, b = o.box;
    this.a = K.world(b.x0, o.y, b.z0); this.b = K.world(b.x1, o.y, b.z1);
    this.y = K.world(0, o.y, 0).y;
    // coils of cable lying heaped (drawn only: it is floor)
    if (o.coils !== false) {
      for (let i = 0; i < 7; i++) {
        const cx = b.x0 + 1 + ((i * 3.7) % Math.max(1, b.x1 - b.x0 - 2)), cz = b.z0 + 1 + ((i * 2.3) % Math.max(1, b.z1 - b.z0 - 2));
        K.add(M.dark, T(new THREE.TorusGeometry(0.9 + (i % 3) * 0.25, 0.22, 5, 18).rotateX(Math.PI / 2), [cx, o.y + 0.2 + (i % 2) * 0.3, cz], [0, i, (i % 3) * 0.12]));
      }
    }
  }
  over(p) {
    const lo = new THREE.Vector3().copy(this.a).min(this.b), hi = new THREE.Vector3().copy(this.a).max(this.b);
    return p.x > lo.x - 0.5 && p.x < hi.x + 0.5 && p.z > lo.z - 0.5 && p.z < hi.z + 0.5 && p.y > this.y - 1.5 && p.y < this.y + 80;
  }
  update() {
    const P = this.rt.player;
    if (!P?.pos) return;
    const over = this.over(P.pos);
    if (over && !P.onGround && !P.dead && P.vel.y < -HEAP.slow) {
      this.on = true;
      if (P.pos.y - this.y < Math.max(HEAP.over, -P.vel.y * 5 / 60)) P.vel.y = -HEAP.slow;
      return;
    }
    if (this.on && (P.onGround || !over || P.dead)) {
      this.on = false;
      if (P.onGround && over) { this.rt.sound?.critter?.('clack', 0.5); this.rt.notice?.(this.o.said ?? 'The old cable heaped below takes your fall.', `bazaar.${this.o.id ?? 'heap'}`); }
    }
  }
}

const _cw = new THREE.Vector3();
/**
 * A makers' counterweight on its cable (issue #418): a block of the house's stone resting on a ledge (`at`: its foot,
 * local), `size` m across. Knocked off it (a shot, a push, a blast: `slide` the way it tips, local [x, z]) it slides off the
 * edge and goes down on its cable at WEIGHTS.pace to the floor below; the grappling hook drags it to you (hookable, a
 * loose weight: issue #432's rule), at the same pace. Then the recall hourglass sends it back along its path (an adapter
 * of its own, the level's `recallables`, src/gadgets/recall.js), and what stands on it rides along (a moving collider):
 * back up onto its ledge. Left off its ledge WEIGHTS.back s with nobody on it, its cable draws it home. `knock`: the
 * element lit the first time it leaves its ledge.
 * o: { id, at, size, yaw, slide, knock, said }
 */
export class Counterweight {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = (this.size = o.size ?? WEIGHTS.size), h = s / 2;
    this.home = K.world(o.at[0], o.at[1] + h, o.at[2]);
    this.slideDir = o.slide ? K.world(o.at[0] + o.slide[0], o.at[1], o.at[2] + o.slide[1]).sub(K.world(...o.at)).setY(0).normalize() : null;
    this.object = new THREE.Group();
    this.object.name = `Counterweight ${o.id}`;
    this.glow = makeMaterial({ color: rt.P.glow ?? '#fff0bd', glow: 0.3, flat: true, key: `temple.bazaar.cw.${o.id}` });
    this.object.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), M.stoneMat));
    for (const y of [-h + 0.2, h - 0.2]) this.object.add(new THREE.Mesh(new THREE.BoxGeometry(s + 0.06, 0.12, s + 0.06).translate(0, y, 0), M.trimMat));
    this.object.add(new THREE.Mesh(glyphGeometry(s * 0.6, 0.03).rotateX(-Math.PI / 2).translate(0, h + 0.012, 0), this.glow));
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) this.object.add(new THREE.Mesh(glyphGeometry(s * 0.45, 0.03).translate(0, 0, h + 0.012).rotateY(yaw), this.glow));
    // its ring, where the cable takes hold, on its top
    this.object.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 14).translate(0, h + 0.2, 0), M.trimMat));
    this.object.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    this.object.position.copy(this.home);
    this.object.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.object);
    // the cable, from its ring up to a pulley over its ledge (drawn: a thin rod stretched each frame)
    this.pulley = K.world(o.at[0], o.at[1] + (o.pulley ?? 9), o.at[2]);
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5).translate(0, 0.5, 0), makeMaterial({ color: rt.P.dark ?? '#3a535b', flat: true, key: 'temple.bazaar.cwCable' }));
    this.cable.userData.noCollide = true; this.cable.userData.dynamic = true;
    rt.root.add(this.cable);
    K.add(M.trim, T(new THREE.TorusGeometry(0.5, 0.12, 6, 18), [o.at[0], o.at[1] + (o.pulley ?? 9), o.at[2]]));
    this.prop = new Prop({ object: this.object, r: h, h, mass: 1.2, kind: 'weight', name: 'counterweight', carry: false });
    Object.assign(this.prop, { id: `temple.${rt.id}.${o.id}`, hookable: true, weightOf: this });
    this.state = 'home'; this.downT = 0;
    const self = this;
    // (the hourglass's view of it: src/gadgets/recall.js adapters)
    this.adapter = {
      key: this.prop, kind: 'weight', pos: this.prop.pos, radius: s * 0.8, object: this.object,
      yaw: () => self.object.rotation.y,
      moving: () => ['slide', 'lower', 'hooked'].includes(self.state),
      alive: () => self.object.visible !== false,
      can: () => !self.prop.held || self.prop.held === 'recall',
      begin() { self.prop.held = 'recall'; self.state = 'recall'; self.prop.vel.set(0, 0, 0); self.rt.notice?.(self.o.riding ?? 'The sand runs back. The counterweight climbs its cable.', `bazaar.cw.ride.${self.id}`); },
      place(pos) { self.prop.pos.copy(pos); self.sync(); },
      end() { self.prop.held = null; if (self.prop.pos.distanceTo(self.home) < 0.6) self.atHome(); else self.state = 'lower'; },
    };
    // (the level's recallables, src/gadgets/recall.js: the hourglass finds it among the world's loose things)
    const lv = rt.level;
    if (lv) {
      if (!lv.templeRecallables) { const base = lv.recallables; lv.templeRecallables = []; lv.recallables = function () { return [...(base?.call(this) ?? []), ...this.templeRecallables]; }; }
      lv.templeRecallables.push(this.adapter);
    }
  }
  get center() { return this.prop.pos; }
  init(physics) {
    this.physics = physics;
    this.object.updateMatrixWorld(true);
    this.collider = physics?.addMover?.(this.object, { all: true }) ?? null;
    this.offs = [registerCarryable(this.prop)];   // (the hook's aim finds loose things among the carryables; it is never carried: carry false)
    this.offs.push(registerTarget({ kind: 'prop', prop: this.prop, radius: this.size * 0.85, position: () => this.prop.pos, enabled: () => this.object.visible && !this.prop.held,
      onHit: (mode, point, dir) => { if (this.state === 'home' && this.o.slide) { this.knock(); return true; } return false; } }));
    this.sync();
  }
  /** Knocked off its ledge (a shot, a push, a blast): it tips the way it was set to, then goes down its cable. */
  knock() { if (this.state !== 'home') return; this.leave(); this.state = 'slide'; this.rt.sound?.critter?.('clack', 0.8); }
  leave() {
    const L = this.rt.logic;
    if (this.o.knock && L.light(this.o.knock)) { this.rt.applyDoors?.(); }
    this.rt.notice?.(this.o.said ?? 'The counterweight tips off its ledge and goes down on its cable.', `bazaar.cw.off.${this.id}`);
  }
  atHome() { this.prop.held = null; this.prop.pos.copy(this.home); this.prop.vel.set(0, 0, 0); this.state = 'home'; this.downT = 0; this.sync(); }
  /** Someone stands on it. */
  ridden(p = this.rt.player) {
    if (!p?.pos) return false;
    const c = this.prop.pos, h = this.size / 2;
    return Math.abs(p.pos.x - c.x) < h + 0.4 && Math.abs(p.pos.z - c.z) < h + 0.4 && p.pos.y > c.y + h - 0.4 && p.pos.y < c.y + h + 0.8;
  }
  /** The floor under it (its own collider set aside), or -Infinity; `back` m behind its middle along its slide. */
  floorUnder(back = 0) {
    const ph = this.physics, ex = ph?.extras, i = ex && this.collider ? ex.indexOf(this.collider) : -1, p = this.prop.pos, d = this.slideDir;
    if (i >= 0) ex.splice(i, 1);
    try { const g = ph?.groundAt?.(p.x - (d?.x ?? 0) * back, p.y - this.size / 2 + 0.4, p.z - (d?.z ?? 0) * back, 80); return Number.isFinite(g) ? g : -Infinity; } finally { if (i >= 0) ex.splice(i, 0, this.collider); }
  }
  sync() {
    this.object.updateMatrixWorld(true);
    // the cable: from its ring to the pulley
    const top = _cw.copy(this.prop.pos).setY(this.prop.pos.y + this.size / 2 + 0.25), d = this.pulley.clone().sub(top), L = d.length();
    this.cable.position.copy(top);
    this.cable.scale.set(1, Math.max(0.01, L), 1);
    this.cable.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    this.cable.updateMatrixWorld();
  }
  update(dt) {
    const P = this.prop, h = this.size / 2;
    if (P.held === 'recall') { this.state = 'recall'; return; }
    if (P.held) {
      // the hook drags it (its velocity the hook's, held to its cable's pace)
      if (this.state === 'home') this.leave();
      this.state = 'hooked';
      if (P.vel.length() > WEIGHTS.pace) P.vel.setLength(WEIGHTS.pace);
      P.pos.addScaledVector(P.vel, dt);
      const g = this.floorUnder();
      if (P.pos.y - h < g) P.pos.y = g + h;
      this.sync();
      return;
    }
    if (this.state === 'hooked') this.state = 'lower';   // (the hook let go: down its cable to the floor under it)
    if (this.state === 'slide') {
      P.pos.addScaledVector(this.slideDir, WEIGHTS.slide * dt);
      // (off the ledge once nothing is under its inner edge: it goes down clear of whatever held it)
      if (this.floorUnder(h + 0.15) < P.pos.y - h - 0.3) this.state = 'lower';
      this.sync();
      return;
    }
    if (this.state === 'lower') {
      const g = this.floorUnder(), foot = P.pos.y - h, to = Math.max(g, foot - WEIGHTS.pace * dt);
      P.pos.y = to + h;
      if (to <= g + 1e-3) { this.state = 'down'; this.downT = 0; this.rt.sound?.critter?.('clack', 0.6); }
      this.sync();
      return;
    }
    if (this.state === 'down') {
      this.downT = this.ridden() ? 0 : this.downT + dt;
      if (this.downT > WEIGHTS.back) { this.atHome(); this.rt.notice?.(this.o.back ?? 'Its cable draws the counterweight back up onto its ledge.', `bazaar.cw.back.${this.id}`); }
    }
  }
  dispose() {
    for (const f of this.offs ?? []) f();
    if (this.collider) this.physics?.removeCollider?.(this.collider);
    const list = this.rt.level?.templeRecallables, i = list ? list.indexOf(this.adapter) : -1;
    if (i >= 0) list.splice(i, 1);
  }
}

/**
 * A stone of the First Sign's hall that sings one word of its line (issue #418, its puzzle: G3d): an egg in a brass cup
 * on a plinth round the hall's wall; splashed, it sings its word (the game's 'note' sign.<i>, the sand keeps it), a warm
 * ring pulsing out. o: { i (the word's place in LINE), at, yaw, h }
 */
export class WordStone extends EchoStone {
  constructor(rt, o) {
    super(rt, { ...o, note: `sign.${o.i}`, shape: 'egg' });
    this.i = o.i;
    this.N = { degree: WORD_DEGREES[o.i], color: '#fff0bd', name: 'word' };
    for (const m of [this.glow, this.ringM]) m.uniforms?.uColor?.value.set('#fff0bd');
  }
  sing() {
    this.flash = 1.6;
    this.rt.sound?.orbNote?.(this.N.degree, this.center, { size: 1.0 });
    this.rt.game?.emit?.('note', { pos: this.center.clone(), note: this.note, degree: this.N.degree, color: this.N.color, label: `the First Sign’s word, “${LINE[this.i]}”` });
    return true;
  }
}

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23; v1.83, issue #418)
/**
 * The Cable Store (west of the Great Well's floor, at the end of a long passage under the Choir: the house's one fight, an
 * arena: the makers' spare cable on drums round its walls; its door a cable door at the passage's far end, open while the
 * house speaks, shut behind you while its keepers stand round its middle; won, the small key's cage sinks) and the Tuning
 * Room (east: a pair of dishes across the middle of the room, the near one deaf until a ball's weight is on its footstone,
 * the ball's groove down the room; a low and a high stone by its mouth, and a horn at the far end too far for either to
 * reach it on their own; it listens for the high one, its ring the high note's colour).
 * Each holds one of the two small keys the door to the Shell Chamber takes.
 */
function wings(rt, K, M, { cable, dish, stand }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, W = ROOMS.well, S = ROOMS.store, U = ROOMS.tune, [sx, sz] = mid(S), [ux, uz] = mid(U), WZ = WELL.store;
  // ---- the Cable Store, its passage west under the Choir's floor; its cable door at the passage's far end
  K.corridor([W.x0 - 0.6, WZ], [S.x1 + 0.6, WZ], 0, { w: D.w, h: D.h });
  K.hall({ x: sx, z: sz, w: S.x1 - S.x0, d: S.z1 - S.z0, y: S.y, h: S.top - S.y, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', at: WZ - sz, w: D.w, h: D.h }] });
  add(Door, { id: 'dS', at: [S.x1 + 0.6, 0, WZ], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [SPEAK] });
  // the passage's cable along its floor to the door's lintel (the door is on the line)
  cable([W.x0 - 1, 0.2, WZ + 3.2], [S.x1 + 1.4, 0.2, WZ + 3.2], 0.16);
  add(LineLamp, { room: 'store', at: [S.x1 - 2.4, 0, WZ + 6], shows: 'line' });
  // drums of spare cable round the walls, the middle clear for the fight, two columns to fight round
  for (const [x, z] of [[S.x0 + 4.5, S.z0 + 4], [S.x0 + 4.5, S.z1 - 4], [S.x1 - 6, S.z1 - 4], [S.x1 - 6, S.z0 + 4]]) {
    K.both(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 14).rotateZ(Math.PI / 2), [x, 1.4, z]));
    for (let i = 0; i < 4; i++) K.add(M.trim, T(new THREE.TorusGeometry(1.42, 0.08, 4, 18).rotateY(Math.PI / 2), [x - 0.7 + i * 0.47, 1.4, z]));
  }
  for (const [x, z] of [[sx - 6, sz - 6], [sx + 6, sz + 6]]) K.column(x, z, 0, S.top, 0.9);
  for (let i = 0; i < 3; i++) cable([S.x0 + 0.6 + i * 1.4, S.top - 1, S.z0 + 0.7], [S.x0 + 0.6 + i * 1.4, 0.3, S.z0 + 0.7], 0.16);   // (hung down the south-west corner, off the floor)
  add(Key, { id: 'kW', at: [S.x0 + 5, 0, sz], yaw: Math.PI / 2 });
  add(Mark, { room: 'store', at: [S.x1 - 3, 0, WZ - 4], yaw: -Math.PI / 2, foes: [sx, 0, sz] });

  // ---- the Tuning Room: the ball's groove down the room to the near dish's footstone, two stones by the dish's mouth;
  // its twin across the room over the far horn
  K.corridor([W.x1 + 0.6, WZ], [U.x0 - 0.6, WZ], 0, { w: D.w, h: D.h });
  K.hall({ x: ux, z: uz, w: U.x1 - U.x0, d: U.z1 - U.z0, y: U.y, h: U.top - U.y, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: WZ - uz, w: D.w, h: D.h }] });
  const TZ = uz + 4, PX = ux + 3.6;   // (the groove 11.6 m long, as it was)
  K.add(M.dark, box(12.6, 0.04, 1.0, PX - 5.8, 0.02, TZ));
  add(Ball, { id: 'ballT', a: [PX - 11.6, 0.04, TZ], b: [PX, 0.04, TZ], r: 1.0 });
  add(Plate, { id: 'pT', at: [PX, 0, TZ], r: 1.2 });
  stand(PX - 0.8, TZ + 5.4, 0, 2.2);
  add(Dish, { id: 'dishT', at: [PX - 0.8, 3.2, TZ + 5], yaw: Math.PI, tilt: 0.15, r: 2.0, when: { drumOn: ['ballT', 'pT'] },
    to: { at: [PX + 5.2, 3.4, uz - 7], yaw: -Math.PI / 2 - 0.3, tilt: 0.3, r: 1.8 },
    dark: 'The dish is dark and deaf: its footstone is bare.' });
  stand(PX + 5.6, uz - 7, 0, 2.4);
  add(EchoStone, { note: 'low', at: [PX - 3.6, 0, TZ + 4.6], yaw: Math.PI * 0.8, h: 2.6 });
  add(EchoStone, { note: 'high', at: [PX + 2.2, 0, TZ + 4.6], yaw: -Math.PI * 0.8, h: 3.0 });
  add(EchoEar, { id: 'eT', note: 'high', hears: 'note', at: [PX + 3, 0, uz - 8], yaw: -Math.PI * 0.75, reach: 5,
    heard: 'The far dish says the high stone’s note, and the horn under it answers. The key’s cage sinks.',
    wrong: 'The horn hears the note, and stays still. Its ring is the colour of the high one.',
  });
  dish(U.x1 - 0.4, 7.4, uz + 4, 1.6, -Math.PI / 2);
  // a drum of spare cable lying across the room between the key's cage and the stones: from the cage the high stone is
  // out of sight (the temple design audit: the far horn's stone is found, not seen from the key)
  K.both(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 14).rotateZ(Math.PI / 2), [PX - 1.4, 1.4, uz + 0.5]));
  for (let i = 0; i < 6; i++) K.add(M.trim, T(new THREE.TorusGeometry(1.42, 0.08, 4, 18).rotateY(Math.PI / 2), [PX - 2.9 + i * 0.6, 1.4, uz + 0.5]));
  add(Key, { id: 'kE', at: [PX - 2, 0, uz - 8], yaw: -Math.PI / 2 });
  add(LineLamp, { room: 'tune', at: [U.x0 + 2.4, 0, WZ + 6], shows: 'line' });
  add(Mark, { room: 'tune', at: [U.x0 + 5, 0, WZ - 4], yaw: Math.PI / 2 });
}

/**
 * The Choir (v1.60, issue #23; since v1.83, issue #418, west off the Great Well's gallery, over the Cable Store's passage),
 * local m: the room round x, z (w by d, its floor at y, h high); its gate off the gallery's west arm at z `gate`; the
 * gate's horn on the Hall of Dishes' far landing at `hornG`, its cable from there along the Great Well's floor and up its
 * west wall to the gate; the near dish on a stand over its footstone, the ball's groove (z from, to) down the room to it;
 * the low stone by its mouth, its twin at the far end over the far horn; the near horn (black: a blast's boom played back),
 * the small key between them. All in the middle of the room (issue #336).
 */
const CR = ROOMS.choir, [CRX, CRZ] = mid(CR);
export const CHOIR = { x: CRX, z: CRZ, w: CR.x1 - CR.x0, d: CR.z1 - CR.z0, y: CR.y, h: CR.top - CR.y, gate: WELL.gate,
  hornG: [4.2, 55.6], dish: [CRX - 5.4, CR.y + 2.6, CRZ + 11.9], twin: [CRX - 7, CR.y + 3.4, CRZ - 11.4], footstone: [CRX - 5.4, CRZ + 9.6],
  groove: [CRZ + 1.6, CRZ + 9.6], low: [CRX - 2.6, CRZ + 10.6], hornA: [CRX - 5.8, CRZ - 10.6], hornB: [CRX + 5.4, CRZ + 5.7], key: [CRX, CRZ - 3.3] };
/** The gate's cable (local m): from its horn on the far landing, through the way into the Great Well, along its floor and
 * up its west wall to the gate's south jamb. */
const GATE_CABLE = [[3.8, 0.2, 56.2], [3.0, 0.18, 61], [2.4, 0.18, 66], [1.6, 0.18, 70.4], [-4, 0.2, 74], [-12, 0.2, 78], [-18.6, 0.3, 83],
  [-20.4, 2, 88], [-20.5, 8, 93], [-20.5, 16, 95.6], [-20.5, F1 + 9.6, 96]];

function choir(rt, K, M, { cable, dish, stand }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, Cr = CHOIR, Y = Cr.y, x0 = CR.x0, z0 = CR.z0, W = ROOMS.well;
  // the gate's way through the Great Well's west wall, at the gallery's floor
  K.corridor([W.x0 - 0.6, Cr.gate], [CR.x1 + 0.6, Cr.gate], Y, { w: D.w, h: D.h });
  K.hall({ x: Cr.x, z: Cr.z, w: Cr.w, d: Cr.d, y: Y, h: Cr.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', at: Cr.gate - Cr.z, w: D.w, h: D.h }] });
  add(Door, { id: 'dG', at: [CR.x1 + 0.6, Y, Cr.gate], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'hG' }] });
  // the gate's horn on the first hall's far landing, and its cable all the way to the gate
  add(EchoEar, { id: 'hG', note: 'mid', at: [Cr.hornG[0], 0, Cr.hornG[1]], yaw: -Math.PI * 0.7,
    heard: 'The horn at the cable’s end hears the middle note. Far off in the Great Well, a gate grinds open.',
    wrong: 'The horn at the cable’s end hears the note, and stays still: it listens for the middle one, the colour of its ring.' });
  K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(GATE_CABLE.map((p) => V(...p))), 72, 0.16, 5));
  // the near dish on its stand over its footstone, the ball's groove down the room to it; its twin at the far end
  const [gz0, gz1] = Cr.groove;
  K.add(M.dark, box(1.0, 0.04, gz1 - gz0 + 0.6, Cr.footstone[0], Y + 0.02, (gz0 + gz1) / 2));
  add(Ball, { id: 'ballQ', a: [Cr.footstone[0], Y + 0.04, gz0], b: [Cr.footstone[0], Y + 0.04, gz1], r: 1.0 });
  add(Plate, { id: 'pQ', at: [Cr.footstone[0], Y, Cr.footstone[1]], r: 1.2 });
  stand(Cr.dish[0], Cr.dish[2] + 0.4, Y, 1.6);
  add(Dish, { id: 'dishQ', at: Cr.dish, yaw: Math.PI, tilt: 0.15, r: 2.0, when: { drumOn: ['ballQ', 'pQ'] },
    to: { at: Cr.twin, yaw: Math.PI / 2 - 0.5, tilt: 0.3, r: 1.8 },
    dark: 'The dish is dark and deaf: its footstone is bare.' });
  stand(Cr.twin[0] - 0.3, Cr.twin[2] - 0.2, Y, 2.4);
  add(EchoStone, { note: 'low', at: [Cr.low[0], Y, Cr.low[1]], yaw: Math.PI * 0.85, h: 2.6 });
  add(EchoEar, { id: 'hA', note: 'low', hears: 'note', at: [Cr.hornA[0], Y, Cr.hornA[1]], yaw: Math.PI * 0.75, reach: 5,
    heard: 'The far dish says the low stone’s note, and the horn under it answers.',
    wrong: 'The far horn hears the note, and stays still. Its ring is the low one’s colour, and it hears only a stone’s own song.',
    deaf: 'The far horn hears only the word in its cable: the house is speaking.' });
  // (issue #418) the near horn, black: a blast's boom, and only played back (an ink bomb, and the hourglass)
  add(EchoEar, { id: 'hB', note: 'boom', at: [Cr.hornB[0], Y, Cr.hornB[1]], yaw: -Math.PI * 0.75, reach: 4.5, size: 1.4, body: '#3b3646',
    heard: 'The black horn hears the boom played back, and answers.',
    wrong: 'The black horn hears the note, and stays still. Its ring is black: it wants a blast’s boom.',
    deaf: 'The black horn hears only the word in its cable: the house is speaking.' });
  for (const [hx, hz] of [Cr.hornA, Cr.hornB]) cable([hx, Y + 0.2, hz + (hz > Cr.z ? 0.6 : -0.6)], [x0 + 0.6, Y + 0.2, hz + (hz > Cr.z ? 0.6 : -0.6)], 0.16);   // (on the line)
  add(Key, { id: 'kC', at: [Cr.key[0], Y, Cr.key[1]], yaw: 0 });
  // cable down the walls, and an old dish on the west wall
  for (let k = 0; k < 3; k++) cable([x0 + 0.6, Y + Cr.h - 2 - k * 0.5, z0 + 16 + k * 0.6], [x0 + 0.9, Y + 0.3, z0 + 19 + k * 0.5], 0.18);
  dish(x0 + 0.4, Y + 9, Cr.z + 4, 2.4, Math.PI / 2, 0.2);
  add(LineLamp, { room: 'choir', at: [CR.x1 - 2.2, Y, Cr.gate + 6], shows: 'line' });
  add(Mark, { room: 'choir', at: [Cr.x + 4.6, Y, Cr.z + 1.4], yaw: -Math.PI / 2 });
}

/**
 * (issue #418) The Bellows, east of the high balcony (WINGS + HOURGLASS): its door at the end of a passage from the balcony
 * takes the Choir's small key and stays open only while the house speaks. In the middle of its floor the bellows' vent, its
 * horn by it wanting the First Sign's word played back: while the horn rings (and the house speaks) the bellows blow a
 * draught up the shaft, and the wings ride it to the Crown, a ledge high on its north wall, with the great key on it. Off
 * the Crown's edge, the bellows' breath takes the fall.
 */
function bellows(rt, K, M, { cable }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, B = ROOMS.bellows, W = ROOMS.well, BB = BELLOWS, CY = BB.crown.y;
  K.corridor([W.x1 + 0.6, WELL.door], [B.x0 - 0.6, WELL.door], F2, { w: D.w, h: D.h });
  add(Door, { id: 'dB', at: [B.x0 - 0.6, F2, WELL.door], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [SPEAK] });
  hallOf(K, B, { oculus: 0.22, doors: [{ side: 'w', at: WELL.door - BWZ, w: D.w, h: D.h }] });
  // the vent in the floor: a ring of brass round a grille, its throat dark
  K.add(M.dark, T(new THREE.CylinderGeometry(BB.r - 0.4, BB.r - 0.4, 0.05, 32), [BB.x, F2 + 0.03, BB.z]));
  K.both(M.trim, T(annulus(BB.r - 0.4, BB.r + 0.5, 0.25, 40), [BB.x, F2 + 0.12, BB.z]));
  for (let i = -3; i <= 3; i++) K.add(M.trim, box(0.18, 0.08, 2 * Math.sqrt(Math.max(0, (BB.r - 0.5) ** 2 - (i * 1.1) ** 2)), BB.x + i * 1.1, F2 + 0.08, BB.z));
  add(Updraft, { id: 'draught', at: [BB.x, F2, BB.z], r: BB.r, h: BB.h, when: { open: 'draught' },
    still: [[QUIET, 'The bellows hang still: no word runs in the cables.'], [{}, 'The bellows hang still. Their horn wants the First Sign’s word.']],
    ride: 'The bellows breathe out under you. Your wings fill, and you rise up the shaft.' });
  add(EchoEar, { id: 'hW', note: 'sign.0', at: BB.horn, yaw: Math.PI * 0.25, reach: 5, size: 1.2,
    heard: 'The bellows’ horn hears the First Sign’s word, and the bellows breathe: a wind rises up the shaft.',
    fading: 'The bellows are slowing.',
    wrong: 'The bellows’ horn hears the note, and stays still: it wants the First Sign’s own word.' });
  cable([BB.horn[0], F2 + 0.2, BB.horn[2] - 0.6], [B.x0 + 0.6, F2 + 0.2, BB.horn[2] - 0.6], 0.16);
  // the Crown: a ledge along the shaft's north wall, high up, the great key free on it; the bellows' breath under its edge
  K.slab(B.x0, BB.crown.z0, B.x1, B.z1, CY, 1.2);
  K.both(M.trim, box(B.x1 - B.x0, 0.6, 0.4, BWX, CY + 0.3, BB.crown.z0 + 0.2));   // (a lip of trim along its edge, a hand high: no parapet)
  for (const x of [B.x0 + 4, B.x1 - 4]) K.column(x, BB.crown.z0 + 1.2, F2, CY - F2 - 1.2, 0.8);
  add(Key, { id: 'kB', big: true, at: BB.key, yaw: Math.PI });
  add(Mark, { room: 'crown', at: [B.x1 - 4, CY, B.z1 - 2.6], yaw: Math.PI * 1.25 });
  add(CableHeap, { id: 'heap.bellows', box: { x0: B.x0 + 1, x1: B.x1 - 1, z0: BB.crown.z0 - 6, z1: BB.crown.z0 - 0.2 }, y: F2, coils: false, said: 'The bellows’ breath takes your fall.' });
  // the shaft's cables, and the market's light far above
  for (const x of [B.x0 + 0.6, B.x1 - 0.6]) for (let k = 0; k < 3; k++) cable([x, B.top - 2 - k * 0.6, B.z0 + 4 + k * 0.8], [x * 0.995, F2 + 0.3, B.z0 + 7 + k * 0.8], 0.2);
  add(LineLamp, { room: 'bellows', at: [B.x0 + 2.4, F2, WELL.door + 5], shows: 'line' });
  add(Mark, { room: 'bellows', at: [B.x0 + 4.5, F2, WELL.door - 5], yaw: Math.PI / 2 });
}
/** A rectangular hall of the house over room r (its doors), roofed with an oculus. */
function hallOf(K, r, o = {}) { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, roof: 'oculus', ...o }); }

// ------------------------------------------------------------------ inside
// (issue #336: every hall 30 to 36 m across under 18 m of stone or more, the round halls 28 and 40 m across, doors 7 by 9 m,
// each puzzle in the middle of its own room, the one fight in the Cable Store; issue #418: the Great Well 42 by 64 m over
// three floors, the house's great hall)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  // (in the house's futuristic skin, src/temples/skins/undertower.js: the dishes on the walls polished brass)
  const brass = rt.skin?.mats.brass ?? { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const cream = rt.skin?.mats.brass ?? { paint: new THREE.Color('#f5dfab'), smooth: true, side: THREE.DoubleSide };
  // the market's signs, far overhead, their light through slots in the gallery's roof
  const signCoral = makeMaterial({ color: '#f0a083', glow: 0.85, flat: true, key: 'temple.bazaar.slotCoral' });
  const signTeal = makeMaterial({ color: '#7fd6cf', glow: 0.85, flat: true, key: 'temple.bazaar.slotTeal' });
  /** An old receiving dish on a wall, facing `yaw` (0 = +z). */
  const dish = (x, y, z, r, yaw, tilt = 0) => {
    const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * r; prof.push([Math.max(0.01, q), (q * q) / (4 * r * 0.7)]); }
    K.add(cream, T(lathe(prof, 20).rotateX(-Math.PI / 2), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
    K.add(brass, T(new THREE.TorusGeometry(r, 0.12, 4, 28).translate(0, 0, r * r / (4 * r * 0.7)), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
    K.add(M.dark, T(new THREE.ConeGeometry(0.25, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, r * 0.6), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
  };
  /** A run of old cable along the floor (from a to b, sagging a little). */
  const cable = (a, b, r = 0.18) => { const m = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) + 0.05, (a[2] + b[2]) / 2]; K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(...a), V(...m), V(...b)]), 16, r, 5)); };
  /** A stone stand for a dish in the middle of a floor (they hung on the walls before issue #336): from y, h high. */
  const stand = (x, z, y, h) => { K.both(M.trim, box(1.1, 0.4, 1.1, x, y + 0.2, z)); K.both(M.wall, box(0.6, h - 0.4, 0.6, x, y + 0.4 + (h - 0.4) / 2, z)); rt.skinStands?.push({ x, z, y, h }); };   // (the skin dresses it: rt.skinStands)
  /** A square pier of stone under a floor in the air (or a horn's), from y up h, w across. */
  const pier = (x, z, y, h, w = 1.1) => K.both(M.wall, box(w, h, w, x, y + h / 2, z));
  const hall = (r, o = {}) => hallOf(K, r, o);
  /** A parapet a hand over a floor at y, from (ax, az) to (bx, bz). */
  const rail = (ax, az, bx, bz, y, hgt = 1.1) => { const L = Math.hypot(bx - ax, bz - az); if (L > 0.05) K.both(M.trim, box(0.4, hgt, L, (ax + bx) / 2, y + hgt / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az))); };

  // ---- the Threshold: the way back out behind you
  const TH = R0.threshold;
  hall(TH, { roof: true, doors: [{ side: 's', w: 6, h: 8 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(6, 8).translate(0, 4, 0), [0, 0, -1.25]));
  K.solid(box(6.4, 8, 0.1, 0, 4, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 9.4, 0.05], 1.8, 0);
  cable([-8.4, 0.2, 1], [-6.6, 0.2, 14]); cable([8.2, 0.2, 2], [6.2, 0.2, 14.4], 0.24);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });
  // the wall between the Threshold and the taller hall beyond, from the pit's floor, with the archway through it
  const DI = R0.dishes, [, diz] = mid(DI);
  K.wall(DI.x0 - 0.6, TH.z1 + 0.6, DI.x1 + 0.6, TH.z1 + 0.6, DI.y, DI.top - DI.y, { t: 1.2, holes: [{ at: DI.x1 + 0.6, w: 8, h: 10, y0: DI.floor - DI.y }] });

  // ---- the Hall of Dishes: a singing ball, a pair of the makers' dishes, the pillars over the cable pit across its
  // middle. The pillars wait for their horn on the far landing, which hears a stone's own song (no sand): too far for
  // any note sung on this side, unless the near dish carries it. The dish is dark until the ball's weight is on its
  // footstone; roll the ball home, splash it, and its note comes out of the far dish over the horn.
  const P0 = DI.z0 + DI.near, P1 = P0 + DI.pit;   // (the pit's near and far edges)
  hall(DI, { floor: false, oculus: 0.25, omit: ['s'], doors: [{ side: 'n', w: D.w, h: D.h, y0: DI.floor - DI.y }] });
  K.slab(DI.x0, DI.z0, DI.x1, P0, 0, 8);
  K.slab(DI.x0, P1, DI.x1, DI.z1, 0, 8);
  K.both(M.dark, box(DI.x1 - DI.x0, 1, DI.pit, 0, DI.y - 0.5, (P0 + P1) / 2));
  for (let i = 0; i < 9; i++) cable([-14 + i * 3.4, DI.y + 0.1, P0 + 1.2], [-13 + i * 3.2, DI.y + 0.1, P1 - 1.2], 0.3);   // the pit full of the makers' old cable
  add(Pit, { room: 'dishes', min: [DI.x0 - 1, -10, P0], max: [DI.x1 + 1, -2, P1] });
  rt.skinPits?.push({ x0: DI.x0, x1: DI.x1, hz0: DI.z0, hz1: DI.z1, z0: P0, z1: P1, y: DI.y, floor: DI.floor });   // (the skin fills it with cable)
  const BZ = P0 - 4.2;   // (the ball's groove 13 m long across the near landing, 4 m back from the pit)
  K.add(M.dark, box(13.6, 0.04, 1.0, 0, 0.02, BZ));
  add(Ball, { id: 'ball1', a: [6.5, 0.04, BZ], b: [-6.5, 0.04, BZ], r: 1.1, sings: 'mid' });
  add(Plate, { id: 'p1', at: [-6.5, 0, BZ], r: 1.3 });
  stand(-10.1, BZ, 0, 1.6);
  stand(-9.9, P1 + 6.2, 0, 4.4);
  add(Dish, { id: 'dishA', at: [-9.8, 3.0, BZ], yaw: Math.PI / 2, tilt: 0.12, r: 2.4, when: { drumOn: ['ball1', 'p1'] },
    to: { at: [-9.6, 6.2, P1 + 6.2], yaw: Math.PI / 2 + 0.1, tilt: 0.6, r: 2.4 },
    dark: 'The great dish is dark and deaf: its footstone is bare. Something heavy has to stand on it.' });
  add(EchoEar, { id: 'eD', note: 'mid', hears: 'both', at: [-5.5, 0, P1 + 5.8], yaw: -Math.PI * 0.6, reach: 6,
    heard: 'Across the pit the far dish says the ball’s note, and the horn under it answers. Something wakes in the pit.',
    wrong: 'The horn across the pit hears the note, and stays still: it listens for the middle one.' });
  add(Bridge, { id: 'disc', a: [0, 0, P0 - 0.1], b: [0, 0, P1 + 0.1], w: 4, n: 6, pillar: 9 });   // the pillars, down in the cable
  dish(DI.x1 - 0.6, 8, diz, 2.6, -Math.PI / 2);
  add(Mark, { room: 'dishes', at: [-8, 0, DI.z0 + 3.8], yaw: Math.PI / 2 });
  // (issue #418) on the far landing, by the way into the Great Well: the line's first relay lever, and its lamp
  const lv = (room) => ({ ...LEVERS.find((l) => l.room === room), id: `lever.${room}`, sets: 'line' });
  add(RelayLever, lv('dishesFar'));
  add(LineLamp, { room: 'dishesFar', at: [-5.5, 0, 64.2], shows: 'line' });

  // ---- the Great Well (issue #418, G4: the house's great hall and its hub): its floor, its gallery round three sides at
  // F1 and its high balcony over the north end at F2, open over the floor, all seen at once. The line's great horn hangs
  // in its middle; the great lift beside the east arm; the high counterweight on the balcony's lip
  const WL = R0.well, WZ = (WL.z0 + WL.z1) / 2, G = WELL, AW = WL.x0 + G.arm, AE = WL.x1 - G.arm;
  K.corridor([0, DI.z1 + 0.6], [0, WL.z0 - 0.6], 0, { w: D.w, h: D.h });
  hall(WL, { oculus: 0.2, frieze: false, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'w', at: G.store - WZ, w: D.w, h: D.h }, { side: 'e', at: G.store - WZ, w: D.w, h: D.h },
    { side: 'w', at: G.gate - WZ, w: D.w, h: D.h, y0: F1 }, { side: 'n', w: D.w, h: D.h, y0: F1 }, { side: 'e', at: G.door - WZ, w: D.w, h: D.h, y0: F2 }] });
  const FY = WL.y + (WL.top - WL.y) * 0.84;
  K.frieze([WL.x1 - 0.02, WL.z0 + 2], [WL.x1 - 0.02, WL.z1 - 2], FY, 'w');
  K.frieze([WL.x0 + 0.02, WL.z0 + 2], [WL.x0 + 0.02, WL.z1 - 2], FY, 'e');
  // the gallery (F1): the north band a block of stone from the floor up, the arms down the long walls on columns, open
  // over the floor; parapets along their edges but where the lift docks and where the west arm drops to the floor (G6)
  K.both(M.floor, box(WL.x1 - WL.x0, F1, WL.z1 - G.band, 0, F1 / 2, (G.band + WL.z1) / 2));
  K.chart.push({ kind: 'slab', x0: WL.x0, x1: WL.x1, z0: G.band, z1: WL.z1, y: F1 });
  K.slab(WL.x0, G.s, AW, G.band, F1, 0.8);
  K.slab(AE, G.s, WL.x1, G.band, F1, 0.8);
  for (const x of [AW - 0.9, AE + 0.9]) for (let z = G.s + 3; z < G.band - 2; z += 10.5) K.column(x, z, 0, F1 - 0.8, 0.7);
  const LF = G.lift, dock = [LF.z - LF.r - 0.6, LF.z + LF.r + 0.6];
  rail(AW + 0.2, G.s + 0.2, AW + 0.2, G.drop[0], F1); rail(AW + 0.2, G.drop[1], AW + 0.2, G.band - 0.2, F1);
  rail(AE - 0.2, G.s + 0.2, AE - 0.2, dock[0], F1); rail(AE - 0.2, dock[1], AE - 0.2, G.band - 0.2, F1);
  rail(WL.x0 + 0.1, G.s + 0.2, AW + 0.2, G.s + 0.2, F1); rail(AE - 0.2, G.s + 0.2, WL.x1 - 0.1, G.s + 0.2, F1);
  rail(AW, G.band + 0.2, AE, G.band + 0.2, F1);
  K.add(M.trim, box(0.5, 0.12, G.drop[1] - G.drop[0], AW + 0.25, F1 + 0.06, (G.drop[0] + G.drop[1]) / 2));   // (a lip where it drops)
  // the high balcony (F2) over the north end: on the band's wall and two piers to the floor at its lip
  K.slab(WL.x0, G.lip, WL.x1, WL.z1, F2, 1.0);
  for (const x of [WL.x0 + 2, WL.x1 - 2]) pier(x, G.lip + 1.2, 0, F2 - 1, 1.6);
  const [wx] = G.weight;
  rail(WL.x0 + 0.1, G.lip + 0.2, wx - 1.4, G.lip + 0.2, F2); rail(wx + 1.4, G.lip + 0.2, G.gap[0], G.lip + 0.2, F2); rail(G.gap[1], G.lip + 0.2, WL.x1 - 0.1, G.lip + 0.2, F2);
  K.add(M.trim, box(G.gap[1] - G.gap[0], 0.12, 0.5, (G.gap[0] + G.gap[1]) / 2, F2 + 0.06, G.lip + 0.25));   // (a lip where it drops)
  // the old cable heaped on the floor under the balcony's open stretch: the drop's landing (G6)
  add(CableHeap, { id: 'heap.well', box: G.heap, y: 0 });
  // the great lift: up to the east arm, woken the first time the house speaks (a cable machine: the line)
  add(Platform, { id: 'lift', path: [[LF.x, 0, LF.z], [LF.x, F1, LF.z]], r: LF.r, speed: 1.6, pause: 1.6, when: { open: 'lift' } });
  K.both(M.dark, T(new THREE.CylinderGeometry(LF.r + 0.2, LF.r + 0.4, 0.08, 24), [LF.x, 0.04, LF.z]));
  cable([LF.x, 0.2, LF.z + LF.r + 0.4], [WL.x1 - 0.6, 0.2, LF.z + LF.r + 0.4], 0.16);
  // the line's great horn in the middle, its cables out to the walls (LineRelay: the house's state)
  const [hx, hy, hz] = G.horn;
  add(LineRelay, { id: 'line', horn: G.horn, roof: WL.top, walls: [[WL.x0 + 0.6, hz - 12], [WL.x1 - 0.6, hz + 12], [WL.x0 + 0.6, hz + 14], [WL.x1 - 0.6, hz - 14]] });
  // the high counterweight on the balcony's lip (HOOK + HOURGLASS: hooked down to the gallery, ridden back up)
  // (it hangs from a davit over the lip: an arm of trim out from a post on the balcony, its pulley over the block)
  K.both(M.trim, box(0.7, 4.0, 0.7, wx + 1.6, F2 + 2.0, G.lip + 0.9));
  K.both(M.trim, box(1.9, 0.5, 0.5, wx + 0.8, F2 + 3.75, G.lip + 0.9)); K.both(M.trim, box(0.5, 0.5, 2.4, wx, F2 + 3.75, G.lip - 0.1));
  add(Counterweight, { id: 'cwTop', at: G.weight, yaw: 0, pulley: WEIGHTS.size + 3.4, said: 'The hook drags the counterweight off the lip, down on its cable.',
    riding: 'The sand runs back. The counterweight climbs its cable, and you with it.', back: 'Its cable draws the counterweight back up onto the balcony’s lip.' });
  // its levers and lamps: the gallery's on the north band, the balcony's at its west end by the davit
  add(RelayLever, lv('landing')); add(RelayLever, lv('top'));
  add(LineLamp, { room: 'well', at: [-7, 0, WL.z0 + 3], shows: 'line' });
  add(LineLamp, { room: 'landing', at: [8, F1, 130.6], shows: 'line' });
  add(LineLamp, { room: 'top', at: [-15, F2, 131], shows: 'line' });
  // cable up the long walls, and the market's light through slots high in the roof
  for (const [x, z] of [[WL.x0 + 0.5, 80], [WL.x1 - 0.5, 92], [WL.x0 + 0.5, 116], [WL.x1 - 0.5, 120]]) for (let k = 0; k < 2; k++) cable([x, WL.top - 2 - k * 0.6, z + k * 0.7], [x * 0.99, 0.3, z + 3 + k * 0.7], 0.2);
  for (const [x, z, c] of [[-10, 84, signCoral], [10, 96, signTeal], [-10, 108, signTeal], [10, 120, signCoral]]) K.add(c, box(1.4, 0.2, 5.2, x, WL.top - 0.08, z));
  dish(WL.x0 + 0.6, F2 + 8, 90, 3.0, Math.PI / 2, 0.2); dish(WL.x1 - 0.6, F2 + 8, 104, 3.0, -Math.PI / 2, 0.2);
  add(Mark, { room: 'well', at: [-6, 0, WL.z0 + 6], yaw: Math.PI * 0.75 });
  add(Mark, { room: 'landing', at: [-4, F1, 131.4], yaw: Math.PI });
  add(Mark, { room: 'top', at: [6, F2, 131.4], yaw: Math.PI });
  wings(rt, K, M, { cable, dish, stand });
  bellows(rt, K, M, { cable });

  // ---- the way up and the Shell Chamber (F1): the chest; its way on a walkway 12 m up on a pier, its counterweight on it
  const SH = R0.shell, SF = SHELF;
  K.corridor([0, WL.z1 + 0.6], [0, C3 - SH.r - 0.4], F1, { w: D.w, h: D.h });
  add(Door, { id: 'dK', at: [0, F1, (WL.z1 + C3 - SH.r) / 2], w: D.w, h: D.h });   // (two keyholes: logic `lock`, a small key from each wing)
  K.rotunda({ x: 0, z: C3, y: F1, r: SH.r, h: SH.top - SH.y, seg: 24, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h, y0: F2 - F1 }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(0, F1, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  add(EchoStone, { note: 'low', at: [-5.6, F1, C3 + 3.2], yaw: Math.PI * 0.6, h: 2.6 });
  // the pier and the walkway (F2), from its south face north to the chamber's high doorway; its counterweight on it
  pier(0, SF.z, F1, F2 - F1 - 1, SF.pier);
  K.slab(-SF.w / 2, SF.z0, SF.w / 2, SF.z1, F2, 1.0);
  K.slab(-SF.landing, SF.z1, SF.landing, C3 + SH.r + 0.6, F2, 1.0);   // (a landing by the high doorway)
  add(Counterweight, { id: 'cwShell', at: SF.weight, yaw: 0, slide: [1, 0], knock: 'knock', pulley: 9,
    said: 'The counterweight tips off the walkway and goes down on its cable.', riding: 'The sand runs back. The counterweight climbs its cable, and you with it.',
    back: 'Its cable draws the counterweight back up onto the walkway.' });
  add(LineLamp, { room: 'shell', at: [-9, F1, C3 - 6], shows: 'line' });
  add(Mark, { room: 'shell', at: [6, F1, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Listening Passage (F2), a room on from the chamber's high doorway: the door into the gallery listens for the
  // low note through its horn in the middle of the room, and nothing sings it here. Its horn is deaf until a ball's weight
  // is on its footstone, a groove's length from it, and while the house speaks
  const LI = R0.listen, [, lz] = mid(LI);
  K.corridor([0, C3 + SH.r + 0.4], [0, LI.z0 - 0.6], F2, { w: D.w, h: D.h });
  hall(LI, { oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }] });
  for (const s of [-1, 1]) cable([s * (LI.x1 - 0.6), LI.top - 1.4, LI.z0 + 2], [s * (LI.x1 - 0.8), F2 + 0.2, LI.z0 + 12], 0.2);
  K.add(M.dark, box(1.0, 0.04, 7.2, 3.7, F2 + 0.02, lz));
  add(Ball, { id: 'ballP', a: [3.7, F2 + 0.04, lz - 3.2], b: [3.7, F2 + 0.04, lz + 3.2], r: 1.0 });
  add(Plate, { id: 'pP', at: [3.7, F2, lz + 3.2], r: 1.2 });
  add(EchoEar, { id: 'e0', note: 'low', at: [3.7, F2, lz + 5], yaw: Math.PI, deaf: 'The horn by the door hears nothing: its footstone is bare, or the house speaks.',
    heard: 'The door’s horn hears the low note, and the door sinks.',
    wrong: 'The door’s horn hears the note, and stays still: it listens for the low one, the colour of its ring.' });
  cable([3.7, F2 + 0.2, lz + 5.4], [2.6, F2 + 0.2, LI.z1 - 0.4], 0.16);   // (from the horn to its door)
  add(RelayLever, lv('listen'));   // (just inside its door: the house set quiet for its horn, or the First Sign's hall)
  add(LineLamp, { room: 'listen', at: [-LI.x1 + 2.4, F2, LI.z0 + 2.6], shows: 'line' });

  // ---- the Gallery of Voices (the key hall, after its reference: blue-grey blocks, cable down into the chasm, the
  // market's coloured light through slots far above). Near side: three singing eggs of three sizes on stepped plinths; the
  // pillars down in the chasm rise while the high note, played back near them, still rings, and since issue #418 they are
  // there only through the seeing lens (LENS + HOURGLASS). The far door listens through a dish on a pillar in the middle of
  // the far landing: its near dish, on a stand by the near edge, wakes with a ball on its footstone, and carries what is
  // played into it. One note at a time: send the middle note over first, then carry the high
  const GA = R0.gallery, G0 = GA.z0, Q0 = G0 + GA.near, Q1 = Q0 + GA.pit;   // (the chasm's near and far edges)
  K.corridor([0, LI.z1 + 0.6], [0, G0 - 0.6], F2, { w: D.w, h: D.h });
  add(Door, { id: 'd3', at: [0, F2, G0 - 0.6], w: D.w, h: D.h, lamps: [{ lit: 'e0' }] });
  hall(GA, { floor: false, oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: GA.floor - GA.y }, { side: 'n', w: LOCK.w, h: LOCK.h, y0: GA.floor - GA.y }] });
  K.slab(GA.x0, G0, GA.x1, Q0, F2, F2 - GA.y);
  K.slab(GA.x0, Q1, GA.x1, GA.z1, F2, F2 - GA.y);
  K.both(M.dark, box(GA.x1 - GA.x0, 1, GA.pit, 0, GA.y - 0.4, (Q0 + Q1) / 2));
  add(Pit, { room: 'gallery', min: [GA.x0 - 1, GA.y - 2, Q0], max: [GA.x1 + 1, F2 - 4, Q1] });
  rt.skinPits?.push({ x0: GA.x0, x1: GA.x1, hz0: GA.z0, hz1: GA.z1, z0: Q0, z1: Q1, y: GA.y, floor: GA.floor });
  add(Pillars, { id: 'pillars', a: [0, F2, Q0 - 0.1], b: [0, F2, Q1 + 0.1], w: 4, n: 8, pillar: 12, note: 'high', hold: HOLD.pillar, reach: HOLD.reach, hidden: true,
    heard: 'The pillars nearest you hear the high note and rise out of the dark. Further on, they wait to hear it too: play it again as you go.',
    unseen: 'Something rises out of the dark over the chasm, and nothing is there. Look through the lens.' });
  /** A stepped plinth (two blocks) with a singing egg on it. */
  const egg = (note, x, z, h, yaw) => {
    K.both(M.wall, box(2.4, 0.6, 2.4, x, F2 + 0.3, z)); K.both(M.trim, box(1.9, 0.6, 1.9, x, F2 + 0.9, z));
    for (const s of [-1, 1]) K.add(brass, box(0.12, 0.5, 0.5, x + s * 0.96, F2 + 0.95, z));
    return add(EchoStone, { note, at: [x, F2 + 1.2, z], yaw, h, shape: 'egg' });
  };
  egg('low', -8.9, Q0 - 6.5, 2.2, Math.PI / 2);
  egg('high', -8.9, Q0 - 3.9, 4.0, Math.PI / 2);
  egg('mid', -8.7, Q0 - 1.4, 3.0, Math.PI / 2 + 0.3);
  // the far door's dish pair: the near one on its stand by the near edge, its footstone, the ball's groove
  const BZ2 = Q0 - 3.6;
  K.add(M.dark, box(5.6, 0.04, 1.0, 5.8, F2 + 0.02, BZ2));
  add(Ball, { id: 'ball2', a: [3.2, F2 + 0.04, BZ2], b: [8.2, F2 + 0.04, BZ2], r: 1.1 });
  add(Plate, { id: 'p2', at: [8.2, F2, BZ2], r: 1.3 });
  stand(10.7, BZ2, F2, 2.6);
  add(Dish, { id: 'dishC', at: [10.4, F2 + 2.6, BZ2], yaw: -Math.PI / 2, tilt: 0.1, r: 2.4, when: { drumOn: ['ball2', 'p2'] },
    to: { at: [-4.4, F2 + 7.4, Q1 + 6.8], yaw: Math.PI, tilt: 0.25, r: 2.2 },
    dark: 'The dish on its stand is dark and deaf: its footstone is bare.' });
  // the door's horn and the far dish high on a pillar in the middle of the far landing, out of the sand's reach from the floor
  pier(-3.6, Q1 + 6.6, F2, 5.6, 1.4);
  add(EchoEar, { id: 'e2', note: 'mid', lintel: true, at: [-2.9, F2 + 6.6, Q1 + 6], yaw: Math.PI, reach: 2.6,
    heard: 'On its pillar the dish says the middle note, and the door’s horn answers.' });
  add(Door, { id: 'd4', at: [0, F2, GA.z1 + 0.6], w: LOCK.w, h: LOCK.h, lamps: [{ drumOn: ['ball2', 'p2'] }, { lit: 'e2' }] });
  // the far side: a high stone, the way back over (no one is left stranded)
  egg('high', 8.4, Q1 + 3.6, 4.0, -Math.PI / 2);
  // cable in bundles down the walls into the chasm, and the market's light through slots far overhead
  for (const [x, z0, z1] of [[GA.x0 + 0.4, Q0 - 9, Q0 + 2], [GA.x1 - 0.4, Q0 - 4, Q0 + 2], [GA.x0 + 0.4, Q1 - 2, Q1 + 6], [GA.x1 - 0.4, Q1 - 4, Q1 + 5]]) {
    for (let k = 0; k < 3; k++) cable([x, GA.top - 2 - k * 0.5, z0 + k * 0.6], [x * 0.97, F2 + 0.3, (z0 + z1) / 2 + k * 0.5], 0.2);
    for (let k = 0; k < 3; k++) cable([x * 0.97, F2 + 0.3, (z0 + z1) / 2 + k * 0.5], [x * 0.9, GA.y + 1, z1 + k * 0.4], 0.2);
  }
  for (const [x, z, c] of [[-8, Q0 - 4, signCoral], [8.5, Q0 + 4, signTeal], [-7.5, Q1 - 4, signTeal], [8, Q1 + 4, signCoral]]) K.add(c, box(1.4, 0.2, 5.2, x, GA.top - 0.08, z));
  dish(GA.x1 - 0.6, F2 + 8, (Q0 + Q1) / 2, 3.2, -Math.PI / 2, 0.2);
  add(LineLamp, { room: 'gallery', at: [GA.x0 + 2.4, F2, G0 + 2.6], shows: 'line' });
  add(Mark, { room: 'gallery', at: [0, F2, G0 + 3], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [7.6, F2, GA.z1 - 3], yaw: -Math.PI / 2 });

  // ---- the antechamber and the First Sign's Hall (F2)
  const H0 = GA.z1 + 0.6;
  const AE2 = K.vestibule(H0, F2);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, F2, (H0 + AE2) / 2], yaw: -Math.PI / 2 });
  const HR = 20, CW = AE2 + 1.2 + HR;
  K.rotunda({ x: 0, z: CW, y: F2, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.3 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; dish(Math.sin(a) * (HR - 0.6), F2 + 14, CW + Math.cos(a) * (HR - 0.6), 2.8, a + Math.PI, 0.35); }
  add(SignFoot, { id: 'sign', at: [0, F2, CW], r: HR });
  // two low dishes on the wall, east and west, each with its twin high over it and a cable from them to the First
  // Sign's foot: a word played into the low one reaches it down the cable, from anywhere in the hall
  for (const [id, a] of [[SIGN_DISHES[0], -Math.PI / 2], [SIGN_DISHES[1], Math.PI / 2]]) {
    const sx = Math.sin(a), sz = Math.cos(a);
    add(Dish, { id, at: [sx * (HR - 1.5), F2 + 2.0, CW + sz * (HR - 1.5)], yaw: a + Math.PI, tilt: 0.15, r: 1.7,
      to: { at: [sx * (HR - 0.9), F2 + 9.5, CW + sz * (HR - 0.9)], yaw: a + Math.PI, tilt: 0.45, r: 2.2 } });
    cable([sx * (HR - 0.7), F2 + 9, CW + sz * (HR - 0.7)], [sx * (HR - 0.6), F2 + 0.2, CW + sz * (HR - 0.6)], 0.22);
    cable([sx * (HR - 0.6), F2 + 0.2, CW + sz * (HR - 0.6)], [sx * 4.2, F2 + 0.2, CW + sz * 4.2], 0.25);
  }
  // (issue #418, its puzzle) three stones round the wall that sing the rest of its line, a word each; its hall's relay
  // lever and lamp by the way in
  for (const [i, a] of [[1, -2.25], [2, 2.25], [3, 0.55]]) {
    const x = Math.sin(a) * (HR - 4.5), z = CW + Math.cos(a) * (HR - 4.5);
    K.both(M.wall, box(2.4, 0.6, 2.4, x, F2 + 0.3, z)); K.both(M.trim, box(1.9, 0.6, 1.9, x, F2 + 0.9, z));
    add(WordStone, { i, at: [x, F2 + 1.2, z], yaw: a + Math.PI, h: 3.2 });
  }
  const hl = LEVERS.find((l) => l.room === 'hall');
  add(RelayLever, { ...hl, at: [hl.at[0], F2, CW - HR + 3.4], id: 'lever.hall', sets: 'line' });
  add(LineLamp, { room: 'hall', at: [6.4, F2, CW - HR + 3.4], shows: 'line' });
  // the way out, past the far door
  const X0 = CW + HR + 0.7, X1 = CW + HR + 10;
  add(Door, { id: 'd5', at: [0, F2, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, F2, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, F2, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, F2, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, F2, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, F2 + 10.4, (X0 + X1) / 2));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, F2, X1 + 0.5]));
  K.solid(box(4, 5, 0.1, 0, F2 + 2.5, X1 + 0.5));

  const model = signModel(rt.skin?.sign);   // (its colours the skin's: a brass mast, a brass dish, coral lamps)
  model.pos.copy(K.world(0, F2, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, F2, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, F2, CW), r: HR, y: K.world(0, F2, 0).y };

  // (the Choir and the Listening Passage's stones last: their marks after the others)
  choir(rt, K, M, { cable, dish, stand });
  add(Mark, { room: 'listen', at: [-LI.x1 + 5, F2, LI.z0 + 4], yaw: Math.PI / 2 });
  const W = (x, y, z) => K.world(x, y, z), [sx, sz] = mid(R0.store), [ux] = mid(R0.tune), [, cz] = mid(R0.choir);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(R0.store.x0 - 4, -12, -3), V(Math.max(R0.tune.x1, R0.bellows.x1) + 4, R0.bellows.top + 4, X1 + 2)),
    gadget: { at: W(0, F1 + 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, F2 + 0.5, X1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 7, 14], [0, 6, DI.z0 + 9, 20], [0, 6, P1 + 9, 20], [0, 10, 84, 24], [0, 10, 112, 24], [0, F1 + 8, 130, 20], [0, F2 + 8, 126, 22], [sx, 7, sz, 20],
      [(WL.x0 + R0.store.x1) / 2, 5, WELL.store, 16], [ux, 7, WELL.store, 20], [0, F1 + 6, C3, 18], [0, F2 + 6, lz, 20], [0, F2 + 6, G0 + 9, 20], [0, F2 + 6, Q1 + 9, 20], [0, F2 + 8, CW, 30],
      [CHOIR.x, F1 + 6, cz, 26], [BWX, F2 + 8, BWZ, 24], [BWX, BELLOWS.crown.y + 4, BELLOWS.key[2], 16]],
    guardian: { def: { ...FIRST_SIGN, onHit: signHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the old doorway in the silent tower's back
function exterior(scene, level, rt) {
  const yaw = SITE.heading, sill = 0.35;
  const K = new TempleKit(rt.root, 'The Undertower', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M;
  const old = makeMaterial({ color: PALETTE.wall, color2: PALETTE.wall2, color3: PALETTE.wall3, mode: MODE_STRATA, strataSize: 1.1, flat: true, glyphs: true, key: 'temple.bazaar.old' });
  const brass = { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const lampM = makeMaterial({ color: '#ffe3aa', glow: 0.1, flat: true, key: 'temple.bazaar.porch' });
  // the doorway, after its reference: one great monolith of blue-grey blocks, older than any sign, stepping down
  // at its sides; a deep doorway framed three times, each frame set back from the last; a round dish-face over
  // the door; a dark way down, and the old cables coming out from under its foot into the paving
  // (the doorway framed three times, each round frame a step nearer, the outer two standing out of the landmark's
  // pylons: a deep way in, as drawn; src/temples/portal.js)
  const P = portal(K, { y: sill, z: 0.35, w: 4.8, h: 8.6, shape: 'round', layers: 3, step: 1.1, recess: 0.9, back: 5.2, into: 1.2,
    frame: lmStone('#8298a6', { course: 1.8, width: 3.6, wear: .3 }), inlay: '#ff9a7a' });
  // stepping down at the sides, more on the west, as drawn
  for (const [x, w, h, d] of [[-7.6, 2.6, 7.4, 4.2], [-9.9, 2.0, 4.6, 3.8], [-11.5, 1.4, 2.2, 3.2], [7.6, 2.6, 5.4, 4.2], [9.7, 1.6, 2.6, 3.6]]) K.both(old, box(w, h, d, x, h / 2, d / 2 - 0.1));
  K.both(M.floor, box(9.6, sill, 5.4, 0, sill / 2, 2.7));
  landmark(K, 'bazaar', { y: sill });
  // cables coming out from under the monolith's foot, through dark slots, into the paving
  for (const x of [-4.6, 4.8]) K.add(M.dark, box(1.4, 0.4, 0.6, x, 0.2, 9.4));
  for (const [x, k] of [[-4.9, 1.4], [-4.4, 1.9], [4.6, 1.5], [5.1, 2.2]]) K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, 0.18, 9.2), V(x * k * 0.8, 0.12, 11.7), V(x * k, 0.05, 14.7)]), 12, 0.15, 5));
  K.flush();
  const at = K.world(0, sill, 1.4);
  const front = K.world(0, 0, 9);
  // the market's crowd keeps off the doorway (crowdSpots' clear circles, src/crowd.js)
  if (level.crowdSpots) { const spots = level.crowdSpots; level.crowdSpots = function (...a) { const r = spots.apply(this, a); (r.clear ??= []).push({ x: front.x, z: front.z, r: 6.5 }, { x: at.x, z: at.z, r: 5 }); return r; }; }
  return { door: { at, heading: yaw, ...P.door }, kit: K, sill, lampM, clear: [{ x: front.x, z: front.z, r: 7 }] };
}

// ------------------------------------------------------------------ the world change: the silent tower speaks, once a night
/**
 * Once the First Sign has its line again, the silent tower wears a lamp on its crown, the Undertower's porch
 * lamps are lit, and once a night (when you are in or near the square) the tower says the whole line in the
 * First Sign's voice: a ring of light goes out from its crown, and everyone in the square looks up.
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The silent tower speaks (the world change)';
  rt.root.add(root);
  root.visible = false;
  const top = V(SITE.tower.x, SITE.tower.top - 4, SITE.tower.z);
  const beaconM = makeMaterial({ color: '#fff0bd', glow: 0.9, flat: true, key: 'temple.bazaar.beacon' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10), beaconM);
  beacon.position.copy(top);
  const ringM = makeMaterial({ color: '#fff0bd', glow: 0.9, flat: true, key: 'temple.bazaar.ring' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 4, 48).rotateX(Math.PI / 2), ringM);
  ring.position.copy(top); ring.visible = false;
  for (const m of [beacon, ring]) { m.userData.noCollide = true; m.userData.dynamic = true; root.add(m); }
  let k = 0, want = 0, spoke = false, wave = -1;
  const api = {
    root, beacon, ring, line: `${LINE.join(' ')}.`, spoken: 0,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; root.visible = k > 0.01; } },
    /** It speaks now (once a night; the tests call it directly). */
    speak() {
      spoke = true; wave = 0; api.spoken++;
      rt.notice?.(`The silent tower speaks: “${LINE.join(' ')}.”`);
      LINE.forEach((_, i) => setTimeout(() => rt.sound?.orbNote?.(WORD_DEGREES[i], top, { size: 1 }), i * 600)?.unref?.());
    },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); root.visible = k > 0.01; }
      if (rt.outside) rt.outside.lampM.uniforms.uGlow.value = 0.1 + 0.8 * k;
      if (!want) return;
      beaconM.uniforms.uGlow.value = 0.6 + 0.3 * Math.sin(t * 1.2);
      // once a night, when you are about the square
      const night = !!rt.isNight?.(), P = rt.player;
      if (!night) spoke = false;
      else if (!spoke && P && Math.hypot(P.pos.x - SITE.tower.x, P.pos.z - SITE.tower.z) < 220 && !rt.inside(P.pos)) api.speak();
      if (wave >= 0) {
        wave += dt;
        ring.visible = wave < 4;
        ring.scale.set(1 + wave * 40, 1, 1 + wave * 40);
        ringM.uniforms.uGlow.value = 0.9 * Math.max(0, 1 - wave / 4);
        if (wave >= 4) wave = -1;
      }
    },
  };
  return api;
}

// ------------------------------------------------------------------ the First Sign's words (its fight and its puzzle)
const PH = FIRST_SIGN.phases;
/** The word of its line it wants now: its first fight, SOMEBODY; its puzzle, the rest in order; its last fight, round its line. */
export function signWord(G) {
  const i = G.phaseIndex, m = G.meter;
  if (i <= 0) return 0;
  if (i === 1) return Math.min(LINE.length - 1, 1 + Math.round((m - PH[0].to) / ((PH[1].to - PH[0].to) / 3)));
  return Math.round((m - PH[1].to) / ((PH[2].to - PH[1].to) / 3)) % LINE.length;
}
/** s it listens for the word it wants in its puzzle before it swings its dish round to that stone again. */
export const SIGN_WAIT = 8;
/** What a word played back is worth in each phase: two in its first fight, three in its puzzle, three in its last. */
const signStep = (G) => (G.phaseIndex <= 0 ? PH[0].to / 2 : G.phaseIndex === 1 ? (PH[1].to - PH[0].to) / 3 : (PH[2].to - PH[1].to) / 3);

export const BAZAAR_TEMPLE = {
  id: 'bazaar', levelId: 'bazaar', name: 'The Undertower', doorLabel: 'old doorway under the silent tower',
  gadget: 'recall', gadgetBox: 'bazaar.temple.echo', arenas: ARENAS, arenaDoor: 'd4',   // (the box's id from when it held the shell: the saves' flag)
  origin: [-200, 1600, -520], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // its futuristic look inside (issue #342): src/temples/skins/undertower.js
  skin: undertowerSkin,
  local: { person: 'hobb', out: 6, side: 6 },
  enterLine: 'Under the silent tower it is cold and dry and very old. Somewhere far overhead, a voice says one word, and waits, and says it again.',
  pitLine: 'You climb back up out of the cables, at the doorway you came in by.',
  onResolved(rt) { rt.notice('Up in the square, the silent tower’s crown is lit. At night it speaks.', 'resolved.out'); },
  // (issue #418) a blast in the house is a sound: its boom, a note the hourglass's sand keeps (and the Choir's black horn
  // wants played back). The First Sign cries its word (a note the sand keeps); when it listens, its word played back
  // retunes it, and it moves on. Its puzzle between its fights: onUpdate
  onConnect(rt) {
    rt.offs.push(rt.game.on('gadget:blast', ({ at } = {}) => {
      if (!at || !rt.inside(at)) return;
      const N = NOTES.boom;
      rt.game.emit('note', { pos: at.clone(), note: 'boom', degree: N.degree, color: N.color, label: 'a blast’s boom' });
      // (by the black horn, not played back: it says what it wants)
      const hB = rt.piece('hB');
      if (hB && !rt.logic.isLit('hB') && at.distanceTo(hB.at) < 12) rt.notice('The black horn shivers. It wants the boom played back from the sand.', 'bazaar.hB.live');
    }));
    const G = rt.guardian;
    if (!G) return;
    const word = () => signWord(G);
    const say = () => {
      const i = word();
      rt.game.emit('note', { pos: G.model.mouth.clone(), note: `sign.${i}`, degree: WORD_DEGREES[i], color: '#fff0bd', label: `the First Sign’s word, “${LINE[i]}”`, reach: 22 });
      rt.sound?.orbNote?.(WORD_DEGREES[i], G.model.mouth, { size: 1.2 });
    };
    G.say = say;
    const strike = G.def.onStrike;
    G.def = { ...G.def, onStrike: (g, a) => { strike?.(g, a); if (a.id === 'cry') { say(); rt.notice(`It cries its one word: “${LINE[word()]}”.`, `fs.word.${word()}`); } } };
    // (it says it again as it lowers its dish to listen: you can always catch it then; not in its puzzle, where the stones sing)
    const enter = G.enter.bind(G);
    G.enter = (state) => { const was = G.state; enter(state); if (state === 'open' && was !== 'open' && G.phaseIndex !== 1) say(); };
    // (a low dish on the wall carries a word down its cable from anywhere: in the last fight only that)
    const byDish = (pos) => SIGN_DISHES.some((id) => { const d = rt.piece(id); return d && pos.distanceTo(d.ends[0].mouth) <= d.reach; });
    rt.offs.push(rt.game.on('echo', ({ pos, note, relayed, via } = {}) => {
      if (!pos || !G.awake) return;
      const cabled = !!relayed && SIGN_DISHES.includes(via);
      if (!cabled && pos.distanceTo(G.model.mouth) > LISTEN) return;
      // its puzzle: shut its word out of the cables, then give it its line, a word at a time, in order
      if (G.phaseIndex === 1) {
        if (G.state === 'shift') return;
        if (rt.line?.speaking) { rt.notice('Its old word roars in the cables. It hears nothing else: shut it out.', 'fs.flooded'); return; }
        if (G.state !== 'open') return;
        if (note !== `sign.${word()}`) { rt.notice(note?.startsWith?.('sign.') ? 'It shakes its dish: not that word, not yet.' : 'It hears the note, and shakes its dish. That is not its word.', `fs.p.wrong.${note}`); return; }
        const was = word();
        G.add(signStep(G), 'echo');
        rt.rumble(0.6, 0.4);
        if (G.phaseIndex === 1) rt.notice(`It hears “${LINE[was]}”, and turns its dish to the next stone.`, `fs.p.${was}`);
        return;
      }
      if (!cabled && G.phaseIndex >= 2) {
        // (played into a low dish, the dish carries it a moment later: say nothing yet)
        if (!byDish(pos)) rt.notice('Its dish is turned up: it hears only what its cables bring it.', 'fs.cables');
        return;
      }
      if (G.state !== 'open') { rt.notice(G.phaseIndex >= 2 ? 'Its cables hum with the word, but it isn’t listening yet. Wait.' : 'It hears you, but isn’t listening yet. Wait for it to lower its dish.', G.phaseIndex >= 2 ? 'fs.notyet2' : 'fs.notyet'); return; }
      if (note !== `sign.${word()}`) {
        rt.notice(note?.startsWith?.('sign.') ? 'It shakes its dish at its old word. Catch the new one.' : 'It hears the note, and shakes its dish. That is not its word.', `fs.wrong.${note}`);
        return;
      }
      G.add(signStep(G), 'echo');
      rt.rumble(0.6, 0.4);
      if (cabled) rt.notice('The word runs down the cable from the wall dish, and its lamps answer.', 'fs.cabled');
      const next = word();
      if (G.state !== 'resolved' && G.phaseIndex !== 1) rt.notice(`It hears its word back, stops, and says the next: “${LINE[next]}”.`, `fs.next.${next}`);
      if (G.state === 'open') { G.enter('fight'); G.cool = 2.0; }
    }));
    rt.wordStones = rt.pieces.filter((p) => p instanceof WordStone);
  },
  /**
   * (issue #418, G3d) The First Sign's puzzle, its second phase: as it begins it floods the cables with its one word (the
   * house speaks, LineRelay.set); while the word runs it hears nothing, its dish turned up; shut out at its hall's relay, it
   * turns its dish to the stone that sings the word it wants next and listens (open, as long as it takes).
   */
  onUpdate(rt) {
    const G = rt.guardian;
    if (!G?.awake || G.state === 'weary' || G.state === 'resolved') return;
    if (G.phaseIndex !== 1) { if (G.listen && rt.signListen) { G.listen = null; rt.signListen = false; } return; }
    if (G.state === 'shift') return;
    if (!rt.signFlooded) { rt.signFlooded = true; if (rt.line?.set(true, 'sign')) rt.notice('Its dish turns up. Its one word floods every cable: SOMEBODY, SOMEBODY.', 'fs.flood'); }
    const stone = rt.wordStones?.find((s) => s.i === signWord(G));
    if (stone) { G.listen = stone.center; rt.signListen = true; }
    if (rt.line?.speaking) { if (G.state === 'open') G.enter('fight'); }
    else if (G.state !== 'open') { G.enter('open'); G.openFor = Infinity; rt.notice(PH[1].openHint, 'fs.p.open'); }
    // (waiting long for its word, it swings its dish round to the stone again, and listens anew)
    else if (G.t > SIGN_WAIT) G.enter('fight');
    else G.openFor = Infinity;
  },
  /**
   * The hand the guardians' fight-through tests lend a puzzle phase (tests/guardian-completable.test.js: they only take its
   * openings): what a player does first to let it listen, the word shut out at its hall's relay. Its own play-through, the
   * words in order, is tests/undertower-line.test.js's.
   */
  puzzleHand(rt) { rt.line?.set(false, 'sign'); },
};
