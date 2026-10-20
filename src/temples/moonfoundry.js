import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerHazard, HAZARD_DPS } from '../hazards.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Brazier, Flame, Platform, Bridge, Hammer, Mark, Pit, Key, Weight } from './pieces.js';
import { Catch } from './spheres.js';
import { founderModel } from './guardian-founder.js';
import { chestMound } from '../boxes/mound.js';
import { castingHouseSkin } from './skins/casting-house.js';

// The Moon Foundry's temple: the Casting-House, a round casting tower of the founders standing under the hangar's roof
// on its east side, between the moon in its cradle's claws and the moon on its pillar, its chimney going up to the
// girders. The first moons were poured in it. The night the singing light passed, every hung moon in the hangar turned
// on its hook toward where the light went, and since then, at night, the house pours by itself and the floor shakes:
// at its bottom the founders' casting machine, the Last Founder, keeps casting moons that crack. It is a machine: you
// may stop it.
//
// Inside (built far overhead, through its door), two ideas. WHERE A MOON RESTS, THE HOUSE LEANS: its doors, its hoist and
// its bridges are held by a moon's weight in a cradle; the stone moons (the test casts) a plain push rolls, the iron
// moons only the magnet glove draws, and an iron moon rolled through heat comes out hot and lights a hooded mould. And
// since v1.83 (issue #416, docs/design/temple-best-practices.md G1) THE POUR, the house's one state: the great crucible
// hung over the Pouring Hall tips its molten iron into the runnels cut in the floors, or stands upright and lets them
// drain. Set at a tap by every hub (POUR.taps), read everywhere (a gauge in every room, the taps' and the gates' lamps hot
// amber or cold slate, the runnels bright or dark). Poured, the runnels run bright and burn (a floor of light: step in and
// it throws you out), the heat-gates shut (they hold the iron back: a sheet of it pours down each), the pilot flames burn
// and the moulds fill. Cold, the gates open and the runnels are dry lanes. On the way it is set cold, poured, cold,
// poured, cold and poured again. Every room a shrine's (v1.77, issue #336): 30 m across and more, doors 7 by 9 (DOOR).
//   the Porch             the first mark, the way out (a passage)
//   the Pouring Hall      (G4, the great hall and the hub) 44 by 72 m under 34: the crucible hung over its north end,
//                         its stream falling into the runnels' basin; the Runner across the floor from the west gate to
//                         the east gate and its spine up to the basin; a gallery 11 m up round three sides (from the
//                         Crucible Stair's landing), the sill in its west arm a drop into a bed of moulding sand (G6);
//                         the founders' iron moon on its rail across the spine, the great hooded cradle and the Founders'
//                         Door in the north wall, all seen from the way in
//   the Mould Room        west, behind the west gate (cold): the stone moon rolled into the great mould, and the pour
//                         let in from the room's own tap: the iron runs round it, and the seam-eye unlids (the door north
//                         to the Crucible Stair). On a dais, the hoist's counterweight pan and a second stone moon
//   the Sand Room         south off the Mould Room behind its own heat-gate (cold): the house's one fight; won, the small
//                         key's cage sinks
//   the Crucible Stair    (a passage) the hoist up to the landing (UP), while its pan holds a weight; from the landing
//                         east onto the Pouring Hall's gallery, north to the Tong Chamber
//   the Tong Chamber      the makers' chest: the MAGNET GLOVE (issue #377). A try by the dais; its east door held by an
//                         iron moon's cradle out on its floor
//   the Casting Furnace   the molten channel down its middle, the bridge over it raised by the hooded mould: the near
//                         lip's iron moon drawn through the pilot flame, which burns only while the house pours. Its far
//                         gate (cold) in the far lip's south wall
//   the Weighing Hall     east, down the far gate's passage (the small key's door), onto its gallery: the iron moon
//                         drawn out along the pier into the keepers' pan (the keepers' eye: the door back to the hub);
//                         the stone weight on its column's capital, hooked down (G2: an older tool with the house's own)
//                         and set in the great scale's floor pan: with both pans weighed the beam levels and the great
//                         key's cage sinks. Out through the keepers' door and the east gate (cold) onto the Pouring Hall
//   back in the hall      the pour let in again: the founders' iron moon drawn over the spine's heat into the great
//                         cradle, hot; with the great key, the Founders' Door, and the cold passage under the furnace
//   the Last Casting      the guardian (a robot: its meter is damage). When it pours, its crucible doors swing open:
//                         splash its molten heart. From its second phase it casts moons and throws the cracked ones; an
//                         iron moon rolled into its casting cradle gives its pour a whole moon, and it stops to look
//                         (a splash then counts twice). In its last it tips the moon out as it shifts, and its heart is
//                         too hot for water unless the cradle holds a moon: roll it back in
// After: the Last Founder has cast one moon whole; it hangs from the jib over the Casting-House's door, turning slowly,
// and the chimney's glow is steady at night (the world change).

const HOT = new THREE.Color('#ffc27a');   // (the moon cast in the Last Casting's cradle, white-hot: onCalm)
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/**
 * In the Moon Foundry (src/levels/moon-foundry.js): on the hangar's floor east of the aisle, in the bay between four of
 * the roof's pillars ((100|150, -128|-206): 43 m and more from each), between the cradled moon (CRADLE) and the moon on
 * its pillar (PMOON); its door looks south-west, down the floor toward the aisle and the mouth.
 */
export const SITE = { x: 126, z: -164, r: 13 };
SITE.heading = Math.atan2(20 - SITE.x, -60 - SITE.z);

/**
 * The Casting-House's colours: cast iron in riveted plates, an ochre rust course under every frieze and at the foot, the
 * frames in dark iron, iron floor plates, the fittings old bronze; the glyphs and the pieces' light the ember of the
 * pour; a small moon of ivory in a ring by every frieze glyph. Its shade a warm umber, its light the furnace's.
 */
export const PALETTE = {
  wall: '#6f5f58', wall2: '#665650', wall3: '#7a6a61', floor: '#857a6e', floor2: '#7a6f63', trim: '#3f393a', fitting: '#a8824a',
  dark: '#2f2a2c', stone: '#d9cdb6', accent: '#d39a4a', glow: '#f2a057', glyph: '#f08a3c', lamp: '#f6c070', sand: '#e8d2a8', sand2: '#d9c09a', void: '#2a2224',
  look: {
    all: { shadeFlat: 0.08, shadeHue: 0.95, shade: 0.2 },
    wall: { mode: 0, grid: 2.0, plates: true, detail: 'built' },
    wallGlyph: { detail: 'built' },
    floor: { mode: 0, grid: 1.8, plates: true },
    glyph: { glow: 0.5 },
  },
  bands: [{ at: 0.72, h: 0.7, color: '#b5653a' }, { y: 0.8, h: 0.5, color: '#b5653a' }],
  ornament: { kind: 'moon', color: '#efe6d2', color2: '#3f393a' },
  light: { shadow: '#8a6f62', light: '#ffe4c4', sun: '#ffd6a0' },
};

/**
 * (v1.77, issue #336: the house as shrines, docs/design/temple-redesign.md) Every door between two rooms 7 by 9; the
 * upper floor (the Crucible Stair's landing, the Pouring Hall's gallery, the Tong Chamber, the furnace's lips, the
 * Weighing Hall's gallery) 11 m up, so the cold passage under the furnace is as tall as its doors.
 */
export const DOOR = { w: 7, h: 9 };
export const UP = 11;
/**
 * (issue #416, G4) The Pouring Hall, the house's great hall and its hub (local m): 44 by 72 m under 34 (its walls' inner
 * faces), the gallery `gallery` m deep round its west, north and east sides, UP over the floor, `galleryZ` where its arms
 * begin; the gallery's door west to the Crucible Stair's landing at `stairZ`.
 */
export const HALL = { x0: -22, x1: 22, z0: 18, z1: 90, h: 34, gallery: 7.6, galleryZ: 40, stairZ: 63 };
const HZ = (HALL.z0 + HALL.z1) / 2;
/**
 * (issue #416) The runnels cut in the Pouring Hall's floor (local m): the Runner across it at `z` from the west gate to
 * the east gate, the spine down the middle from the Runner to the basin under the crucible's lip (`spine`: its z from,
 * to), `w` wide and `depth` deep; the molten iron's top `metal` under the floor while it pours. `plates`: the iron plates
 * that cross them flush with the floor ([x0, z0, x1, z1]); the founders' moon's rail crosses the spine at `rail` on a
 * trestle of its own.
 */
export const RUN = { z: 30, w: 3, depth: 1.2, spine: [31.5, 63], basin: [-3, 63, 3, 69], metal: -0.15, rail: 50,
  plates: [[HALL.x0, 27.3, -16.5, 32.7], [16.5, 27.3, HALL.x1, 32.7], [-12, 27.3, -6, 32.7], [6, 27.3, 12, 32.7], [-2.7, 38, 2.7, 43], [-2.7, 56, 2.7, 61]],
  // (steps down into them: [x, z, the way they run down] at a runnel's wall)
  steps: [[2, 29.1, 'x'], [-15.4, 30.9, 'x'], [-0.9, 46, 'z']] };
/** The runnels' rectangles (local x0, z0, x1, z1) and the way each runs ('x' along x, 'z' along z, 'o' a basin). */
export const RUNS = [
  { r: [HALL.x0, RUN.z - RUN.w / 2, HALL.x1, RUN.z + RUN.w / 2], along: 'x' },
  { r: [-RUN.w / 2, RUN.spine[0], RUN.w / 2, RUN.spine[1]], along: 'z' },
  { r: RUN.basin, along: 'o' },
];
/** (issue #416) The great crucible, hung from a yoke over the hall's north end: its trunnions' middle, its radius, how far it tips (rad) to pour. */
export const CRUCIBLE = { x: 0, z: 70.5, y: 25, r: 4.2, tip: 0.6, yoke: 31 };
/** (G6) The sill: a gap in the gallery's west arm (its inner edge x, z from..to) over a bed of moulding sand on the floor that takes the fall. */
export const SILL = { x: HALL.x0 + HALL.gallery, z0: 73, z1: 79, bed: [-12.4, 76], r: 3.6 };
/**
 * (issue #416, G1) The pour, the house's state: let in (the crucible tipped, the runnels molten) or stopped (it stands
 * upright, they drain). `run`: s for the iron to run in or drain. `hot` and `cold`: the colour every tap's, gauge's and
 * gate's lamp shows (the pour's amber, the cold iron's slate), `glow` their glow cold and hot. `taps`: where it is set
 * (a tap by every hub: the hall's floor and its gallery, the Mould Room, the Sand Room, the furnace's near lip, the
 * Weighing Hall), local, each facing `yaw`.
 */
export const POUR = {
  run: 3.2, hot: '#ff9a3a', cold: '#6c7f94', glow: [0.12, 0.9], metal: '#ff8a2e',
  taps: [
    { room: 'floor', at: [-7.5, 0, 22.5], yaw: 0 },
    { room: 'gallery', at: [-18.8, UP, 58], yaw: Math.PI / 2 },
    { room: 'landing', at: [-33, UP, 67.5], yaw: -Math.PI / 2 },
    { room: 'moulds', at: [-33.5, 0, 37.5], yaw: -Math.PI / 2 },
    { room: 'sand', at: [-36.5, 0, 7.5], yaw: -Math.PI / 2 },
    { room: 'furnace', at: [-6.5, UP, 105.5], yaw: Math.PI / 2 },
    { room: 'scales', at: [31.5, 0, 23.5], yaw: Math.PI / 2 },
  ],
};
/** (issue #416) The pour's two stops, as conditions: the iron let in, or the house cold. */
export const POURED = { drumOn: ['pour', 'pourOn'] }, COLD = { drumOn: ['pour', 'pourCold'] };
// the rooms' places (local metres): the Mould Room's centre and size; the Crucible Stair's x, its two ends, its landing's
// edge and the hoist's z; the Tong Chamber's z and radius (at the stair's x); the furnace's west and east walls, its depth
// and its channel (at the chamber's z); the Weighing Hall's walls, its gallery's edge, its pier's x and pan's z; the Last
// Casting's centre and radius
const MX = -46, MZ = 30, MW = 34, MD = 34;
const SX = -44, S0 = MZ + MD / 2 + 1.2, S1 = S0 + 30, LZ = S0 + 10, HZH = LZ - 2.4;
const TZ = 112, TR = 17;
const FX0 = -10.2, FX1 = 35.8, FD = 36, C0 = 7.8, C1 = 17.8, FXc = (FX0 + FX1) / 2;
const WX0 = 28, WX1 = 62, WZ0 = 20, WZ1 = 62, WX = (WX0 + WX1) / 2, WZ = (WZ0 + WZ1) / 2, GZ = 54, PX = 45, PZ = 41.5, FAR = 31;
const CW = 154, HR = 20;
/** (issue #416) The Weighing Hall's great scale (its post's foot, the beam's height, the floor pan's z) and the stone weight's column (its foot, its capital's height). */
export const SCALE = { x: 52, z: 36, beam: 14.4, pan: 29.6, column: [44.5, 33], capital: 19 };
/** (v1.53) The Sand Room, south off the Mould Room (an arena, the house's one fight since v1.77): its north side the Mould Room's south wall. */
export const SAND = { x: MX, z: MZ - MD / 2 - 1.2 - 15, w: 30, d: 30, h: 18 };
SAND.zone = { min: [SAND.x - SAND.w / 2, -1, SAND.z - SAND.d / 2], max: [SAND.x + SAND.w / 2, 12, SAND.z + SAND.d / 2] };
/** The Sand Room's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's `foes`). */
export const ARENAS = [{
  el: 'arS', room: 'sand', zone: SAND.zone, doors: ['dR'], extra: 2,
  shut: 'The door grinds shut behind you. Out of the sand bins, something heavy climbs.',
  won: 'The last of them falls still in the sand. The key’s cage sinks, and the door lets go.',
}];

export const LOGIC = {
  id: 'moonfoundry', entry: 'threshold', gadget: 'magnet',
  // (each room tagged with its kind, issue #336. Since v1.83, issue #416: `floor` is the Pouring Hall's floor, `gallery`
  // its gallery, `keepers` the short passage between the east gate and the keepers' door, `scalesWay` the far gate's
  // passage down to the Weighing Hall: the old ids kept, so a save's last mark holds)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, floor: { checkpoint: true, kind: 'puzzle' }, gallery: { checkpoint: true, kind: 'passage' },
    moulds: { checkpoint: true, kind: 'puzzle' }, sand: { checkpoint: true, kind: 'combat' },
    stair: { checkpoint: true, kind: 'passage' }, landing: { checkpoint: true, kind: 'puzzle' }, tongs: { checkpoint: true, kind: 'puzzle' }, furnace: { checkpoint: true, kind: 'puzzle' },
    furnaceFar: { kind: 'passage' }, scalesWay: { kind: 'passage' }, scales: { checkpoint: true, kind: 'puzzle' }, keepers: { kind: 'passage' },
    ante: { checkpoint: true, kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'floor' },
    { a: 'floor', b: 'moulds', door: 'gW' },          // the west gate: shut while the house pours
    { a: 'moulds', b: 'stair', door: 'dM' },          // the stone moon cast in the great mould
    { a: 'moulds', b: 'sand', door: 'dR' },           // the Sand Room's gate: shut while the house pours (and while its keepers stand)
    { a: 'stair', b: 'landing', door: 'hoist' },      // the hoist, while its pan in the Mould Room holds a weight
    { a: 'landing', b: 'tongs', door: 'gT' },         // the landing's north door: its counterweight cast round the stone moon
    { a: 'landing', b: 'gallery' },                   // the landing's east door onto the Pouring Hall's gallery
    { a: 'gallery', b: 'floor', oneWay: true },       // (G6) the sill: down into the bed of moulding sand
    { a: 'tongs', b: 'furnace', door: 'dP' },         // the chamber's east door
    { a: 'furnace', b: 'furnaceFar', door: 'brH' },   // the bridge over the molten channel: the hot moon in the hooded mould
    { a: 'furnaceFar', b: 'scalesWay', door: 'cF' },  // the furnace's far gate: shut while the house pours
    { a: 'scalesWay', b: 'scales', door: 'dW' },      // the small key's door, onto the Weighing Hall's gallery
    { a: 'scales', b: 'keepers', door: 'dS' },        // the keepers' door, opened from the hall's side by its eye
    { a: 'keepers', b: 'floor', door: 'gE' },         // the east gate: shut while the house pours
    { a: 'floor', b: 'ante', door: 'dF' },            // the Founders' Door: the great key, and the founders' moon hot in its cradle
    { a: 'ante', b: 'hall', door: 'dA' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // (issue #416) the pour, the house's one state: let in (t 1, the start: the house pours by itself) or stopped (t 0),
    // at a tap in any of these rooms
    pour: { type: 'drum', room: 'floor', rooms: ['gallery', 'landing', 'moulds', 'sand', 'furnace', 'scales'], stops: { pourCold: 0, pourOn: 1 }, start: 1, roll: 'hand', verb: 'pour' },
    pourCold: { type: 'plate' }, pourOn: { type: 'plate' },
    // the heat-gates: they hold the iron back while it runs
    gW: { type: 'door', opens: COLD },
    gE: { type: 'door', opens: COLD },
    // the Mould Room's stone moon, rolled across the room into its great mould, and the pour let in round it: cast, the
    // door north grinds down for good (wherever the pour was let in from)
    m1: { type: 'drum', room: 'moulds', plate: 'pM', plateAt: 1, start: 0 },
    pM: { type: 'plate', room: 'moulds' },
    dM: { type: 'door', opens: { all: [{ drumOn: ['m1', 'pM'] }, POURED] }, latch: true },
    // the hoist's counterweight pan, on the Mould Room's shelf: you in it, or the stone moon
    m2: { type: 'drum', room: 'moulds', plate: 'pK', plateAt: 1, start: 0.44 },   // (issue #275: it starts 1.9 m along its groove, off the wall it lay against: room behind it to push from)
    pK: { type: 'plate', room: 'moulds' },
    hoist: { type: 'bridge', opens: { pressed: 'pK' } },
    // the landing's stone moon, rolled into the north door's counterweight mould, and the pour let in round it: cast, the
    // door's counterweight is heavy, and the door stays up
    mL: { type: 'drum', room: 'landing', plate: 'pL', plateAt: 1, start: 0 },
    pL: { type: 'plate', room: 'landing' },
    gT: { type: 'door', opens: { all: [{ drumOn: ['mL', 'pL'] }, POURED] }, latch: true },
    // (issue #377: the chest held the founders' tongs, a push that took hold of iron; the magnet glove now, whose field
    // draws the iron moons along their rails, and throws them)
    chest: { type: 'gadget', room: 'tongs', item: 'magnet' },
    // the try by the dais: an iron moon into a little cradle (nothing waits on it)
    mT: { type: 'drum', room: 'tongs', plate: 'pT', plateAt: 1, start: 0, needs: ['magnet'], try: true },
    pT: { type: 'plate', room: 'tongs' },
    // the chamber's east door, held by an iron moon's cradle on its floor
    mP: { type: 'drum', room: 'tongs', plate: 'pP', plateAt: 1, start: 0, needs: ['magnet'] },
    pP: { type: 'plate', room: 'tongs' },
    dP: { type: 'door', opens: { drumOn: ['mP', 'pP'] }, latch: true },
    // the Casting Furnace: the near lip's iron moon drawn through the pilot flame into the hooded mould, which warms the
    // bridge's mould; the pour let in, the iron runs into it and the bridge is cast, for good
    mH: { type: 'drum', room: 'furnace', plate: 'pH', plateAt: 1, start: 0, needs: ['magnet'] },
    pH: { type: 'plate', room: 'furnace' },
    bH: { type: 'brazier', room: 'furnace', when: { drumOn: ['mH', 'pH'] } },   // hooded: only the hot moon lights it
    brH: { type: 'bridge', opens: { all: [{ lit: 'bH' }, POURED] }, latch: true },
    hm: { type: 'door', opens: { resolved: true } },                             // the press over the bridge: it slams until the founder is stopped
    cF: { type: 'door', opens: COLD },                                           // the far gate
    // (the Sand Room's small key, carried up: the door down to the Weighing Hall)
    dW: { type: 'door', lock: 'small' },
    // the Weighing Hall: the iron moon drawn out along the gallery's pier into the keepers' pan: the keepers' eye on its
    // post unlids, for the keepers' door back to the hub (a shortcut: the long way round is three rooms more)
    mB: { type: 'drum', room: 'scales', plate: 'pB', plateAt: 1, start: 0, needs: ['magnet'] },
    pB: { type: 'plate', room: 'scales' },
    eS: { type: 'switch', room: 'scales', when: { drumOn: ['mB', 'pB'] }, shortcut: true },
    dS: { type: 'door', opens: { lit: 'eS' }, latch: true },
    // (G2) the stone weight on its column's capital, hooked down and set in the great scale's floor pan: with the pier's
    // pan weighed too, the beam levels, and the great key's cage sinks
    wS: { type: 'weight', room: 'scales', plate: 'pS', needs: ['hook'] },
    pS: { type: 'plate', room: 'scales' },
    kG: { type: 'key', kind: 'big', room: 'scales', when: { all: [{ drumOn: ['mB', 'pB'] }, { weightOn: ['wS', 'pS'] }] } },
    // back in the Pouring Hall: the founders' moon drawn across the spine into the great cradle, and the pour let in round
    // it (the founders' last cast): with the great key, the Founders' Door
    mG: { type: 'drum', room: 'floor', plate: 'pG', plateAt: 1, start: 0, needs: ['magnet'] },
    pG: { type: 'plate', room: 'floor' },
    dF: { type: 'door', lock: 'big', opens: { all: [{ drumOn: ['mG', 'pG'] }, POURED] }, latch: true },
    // the Sand Room: its keepers beaten, the small key's cage sinks (v1.53); its gate shut while the house pours
    arS: { type: 'arena', room: 'sand' },
    kS: { type: 'key', kind: 'small', room: 'sand', when: { lit: 'arS' } },
    dR: { type: 'door', opens: COLD },
    dA: { type: 'door', opens: null },                                          // the arena's door: shut while the founder fights
    // the casting cradle in the arena: an iron moon in it, and the founder stops to look (its last phase wants it)
    mA: { type: 'drum', room: 'hall', plate: 'pA', plateAt: 1, start: 0, needs: ['magnet'] },
    pA: { type: 'plate', room: 'hall' },
    founder: { type: 'boss', room: 'hall', needs: ['gun', 'magnet'], requires: { drumOn: ['mA', 'pA'] } },
    d5: { type: 'door', opens: { resolved: true } },
    // the house's map, in a little chest by the hoist (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'stair', at: [SX + 7, 0, S0 + 3.4], yaw: -Math.PI / 4 },
  },
};

/** How much a splash on its open heart is worth: in its first phase, in its second (free, and with a moon in the cradle), in its last. */
export const QUENCH = { first: 0.175, free: 0.175, cradled: 0.35, last: 0.15 };

export const LAST_FOUNDER = {
  kind: 'robot', name: 'the Last Founder', final: 'break', speed: 1.3, wakeTime: 3.0,
  wake: 'A founder of cast iron rolls forward on its wheels, ladle raised.',
  openHint: 'Its crucible doors swing open on the molten heart. Splash it.',
  resolved: 'The Last Founder stops to look at one whole moon. Its heart goes dark.',
  missHint: 'It rolls into the wall, crucible doors open: splash its heart.',
  phases: [
    { to: 0.35, attacks: ['ladle', 'slam', 'cast'], pause: 1.6, hint: 'When it has poured, its doors swing open: splash the molten heart.' },
    { to: 0.7, attacks: ['cast', 'casts', 'ladle'], pause: 1.2, hint: 'Draw the iron moon into its cradle: as it looks, splashes count double.' },
    { to: 1.0, attacks: ['charge', 'casts', 'slam'], pause: 1.0, hint: 'Its heart is too hot now: draw the moon back in, splash while it looks.',
      openHint: 'Too hot for water: with a moon in its cradle it stops, and cools.' },
  ],
  attacks: {
    ladle: { shape: 'cone', range: 9, angle: 0.8, wind: 1.3, track: 0.6, part: 'arms', rig: 'coil', parts: ['arms'], splash: 0.5, active: 0.35, reach: 5.5, gap: 0.6, damage: 0.75, knock: 10, recover: 0.5, then: 'ladle2' },
    ladle2: { shape: 'cone', range: 9, angle: 0.8, wind: 0.8, track: 0.5, part: 'arms', rig: 'coil', side: -1, link: true, parts: ['arms'], splash: 0.5, active: 0.35, reach: 5.5, damage: 0.75, knock: 10, gap: 0.3, then: 'pour' },
    pour: { shape: 'ring', at: 'front', ahead: 4, radius: 3.6, wind: 1.1, part: 'core', rig: 'lean', link: true, wave: { speed: 8, reach: 14, width: 0.7, damage: 0.5 }, blast: { kind: 'front', h: 0.6 }, damage: 1, knock: 12, recover: 0.9, open: 4.6 },
    slam: { shape: 'ring', at: 'self', radius: 5.5, wind: 1.3, part: 'arms', rig: 'rear', parts: ['arms'], splash: 0.6, active: 0.35, blast: { kind: 'front', r0: 1, r1: 4.5, h: 0.6 }, reach: 5, damage: 0.75, knock: 11, recover: 0.8, open: 4.2 },
    cast: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    casts: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'arms', rig: 'swell', pose: 'cast', damage: 0.5, knock: 6, recover: 0.6 },
    charge: { shape: 'lane', range: 16, width: 4.4, wind: 1.3, track: 0.65, part: 'feet', rig: 'crouch', dash: 10, parts: ['body'], splash: 0.3, active: 0.45, damage: 1, knock: 12, recover: 1.0, open: 2.4, miss: 3.4 },
  },
};

function founderHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its iron.', 'lf.push'); return true; }
  if (g.state !== 'open') g.rt.notice('Its crucible doors are shut. Wait for it to pour, and open.', 'lf.shut');
  return true;
}
/** With a whole moon in its cradle it stands looking at it a little longer. */
function founderOpenFor(g, a, s) { return s && g.phaseIndex >= 1 && g.rt.logic.drumOn('mA', 'pA') ? Math.max(s, 5.2) : s; }

/** Says something once when a condition first holds (a moon in a cradle nothing waits on, you in the hoist's pan). */
class Watch {
  constructor(rt, o) { this.rt = rt; this.o = o; this.was = this.now(); }
  now() { return this.o.test ? !!this.o.test(this.rt) : this.rt.logic.check(this.o.when); }
  update() { const now = this.now(); if (now && !this.was) this.rt.notice(this.o.say, this.o.key); this.was = now; }
}

/** An iron cradle round a moon's resting place: claws standing up round a ring (drawn, and solid where it stands). */
function cradle(K, mat, x, y, z, r, n = 5) {
  K.add(mat, T(annulus(r, r + 0.35, 0.3, 28), [x, y + 0.3, z]));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3;
    K.add(mat, T(new THREE.BoxGeometry(0.28, 1.5, 0.4), [x + Math.sin(a) * (r + 0.2), y + 0.75, z + Math.cos(a) * (r + 0.2)], [0, a, Math.sin(a) * 0.25]));
  }
}


// ------------------------------------------------------------------ the pour, the house's state (issue #416)
/** The pour's eased level: 0 cold, 1 poured (the logic's own when nothing keeps it: tests, the first frame). */
export const pourLevel = (rt) => rt.pour?.k ?? (rt.logic.check(POURED) ? 1 : 0);
/** The one lamp every tap, gauge and gate lamp shares (its colour set once a frame: Pour). */
const pourLamp = () => makeMaterial({ color: POUR.hot, glow: POUR.glow[1], flat: true, key: 'temple.moonfoundry.pourlamp' });
/** The molten iron: drawn as the night pour outside draws it (flat, lit from within; no light of its own). */
const molten = () => makeMaterial({ color: POUR.metal, glow: 0.8, flat: true, side: THREE.DoubleSide, key: 'temple.moonfoundry.molten' });
const _pc = new THREE.Color(), _po = new THREE.Vector3();

/**
 * The pour (LOGIC `pour`, a drum of two stops: cold 0, poured 1, the start): this piece keeps the house's state. A tap
 * turned (PourTap) lets the iron in or stops it at once, for the logic; the iron itself runs in or drains over POUR.run s
 * (`k`), and the crucible, its stream, the runnels, the gates' sheets, the gauges and every lamp follow it. Poured, the
 * runnels burn whoever steps in and throw him out to the nearer side (the night pour's rule outside, src/foundry-pour.js),
 * and the sheets before the shut gates burn too. It points the scout at the nearest tap (`center`).
 * o: { id: 'pour', at (local: the hall's middle) }
 */
export class Pour {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    this.at = rt.kit.world(...o.at);
    this.setters = [];   // (the taps: the scout's, and the play-through's)
    this.k = this.poured ? 1 : 0;
    this.lamp = pourLamp();
    this.sheets = [];    // { mesh, y0, y1 }: molten sheets that rise with the iron (the runnels, the basin, the moulds)
    this.burns = [];     // hot volumes while it pours: { box: [x0, y0, z0, x1, y1, z1] local, push(p local, out) }
    this.light = new THREE.Vector4(0, 0, 0, 0);
    const c = rt.kit.world(CRUCIBLE.x, 2, CRUCIBLE.z - 4.5);
    this.light.set(c.x, c.y, c.z, 0);
    rt.lights.push(this.light);
    rt.pour = this;
    this.off = registerHazard({ kind: 'fire', dps: HAZARD_DPS.fire, test: (p) => this.burning(p), push: (p, out) => this.pushOut(p, out) });
    this.paint();
  }
  get poured() { return this.rt.logic.drumOn(this.id, 'pourOn'); }
  /** A gauge's column of iron (PourGauge): its foot (world), radius and full height, all of them in one mesh. */
  gauge(foot, r, h) {
    const g = new THREE.CylinderGeometry(r, r, 1, 12).translate(0, 0.5, 0).toNonIndexed();
    (this.columns ??= []).push({ foot: foot.clone(), h, g });
    this.irons?.removeFromParent(); this.irons = null; this.ironK = -1;
  }
  /** The gauges' iron at the pour's level (rebuilt only when it moves). */
  gauges() {
    if (!this.columns?.length) return;
    if (!this.irons) {
      const geo = mergeGeos(this.columns.map((c) => c.g.clone().translate(c.foot.x, c.foot.y, c.foot.z)));
      this.unit = this.columns.flatMap((c) => Array.from({ length: c.g.attributes.position.count }, (_, i) => [c.foot.y, c.h, c.g.attributes.position.getY(i)]));
      this.irons = new THREE.Mesh(geo, molten());
      this.irons.name = 'The Casting-House: the gauges’ iron';
      this.irons.userData.noCollide = true; this.irons.userData.dynamic = true;
      this.rt.root.add(this.irons);
    }
    if (this.ironK === this.k) return;
    this.ironK = this.k;
    const P = this.irons.geometry.attributes.position, k = Math.max(0.02, this.k);
    this.unit.forEach(([y0, h, u], i) => P.setY(i, y0 + u * h * k));
    P.needsUpdate = true;
    this.irons.geometry.computeBoundingSphere();
    this.irons.visible = this.k > 0.02;
  }
  /** Let the iron in, or stop it: at once for the logic, the iron running after. Returns which. */
  toggle() {
    const rt = this.rt, on = !this.poured;
    rt.logic.moveDrum(this.id, on ? 1 : 0); rt.applyDoors?.();
    rt.sound?.whoosh?.(); rt.rumble?.(POUR.run * 0.6, 0.45);
    rt.notice?.(on ? 'The tap turns. The crucible tips, and the runnels fill with iron.' : 'The tap turns. The crucible rights itself, and the runnels drain.', on ? 'pour.on' : 'pour.off');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id });
    return on ? 'poured' : 'cold';
  }
  /** Is the iron still on its way (the play-through waits for it). */
  get running() { return this.k !== (this.poured ? 1 : 0); }
  /** Where the iron burns now: in a runnel or a sheet before a shut gate, while it pours (p: world, the feet). */
  burning(p) {
    if (this.k < 0.5) return false;
    const q = this.rt.kit.local(_po.copy(p));
    return this.burns.some((b) => q.x > b.box[0] && q.x < b.box[3] && q.y > b.box[1] && q.y < b.box[4] && q.z > b.box[2] && q.z < b.box[5]);
  }
  /** Out of the iron: the nearer side of a runnel, away from a gate's sheet (world). */
  pushOut(p, out) {
    const q = this.rt.kit.local(_po.copy(p));
    const b = this.burns.find((x) => q.x > x.box[0] && q.x < x.box[3] && q.z > x.box[2] && q.z < x.box[5]);
    if (!b) return null;
    const l = b.out(q);
    // (local to world: the house turns by its yaw)
    return out.copy(l).applyQuaternion(this.rt.kit.frameQ ?? _noTurn(this.rt)).setY(0).normalize();
  }
  paint() {
    const u = this.lamp.uniforms;
    u.uColor.value.set(POUR.cold).lerp(_pc.set(POUR.hot), this.k);
    u.uGlow.value = POUR.glow[0] + (POUR.glow[1] - POUR.glow[0]) * this.k;
  }
  update(dt, t) {
    const want = this.poured ? 1 : 0, s = dt / POUR.run;
    this.k = want > this.k ? Math.min(want, this.k + s) : Math.max(want, this.k - s);
    this.paint();
    this.gauges();
    const M = molten();
    M.uniforms.uGlow.value = 0.78 + 0.05 * Math.sin(t * 5.3) * Math.sin(t * 2.1);
    for (const S of this.sheets) {
      S.mesh.visible = this.k > 0.02 && (!S.when || this.rt.logic.check(S.when));
      if (S.grow) S.mesh.scale.y = Math.max(0.01, this.k);
      else S.mesh.position.y = S.base + THREE.MathUtils.lerp(S.y0, S.y1, this.k);
    }
    this.light.w = 30 * this.k;
    // in a runnel while it burns, on the ground: thrown up and out to its nearer side (as the night pour outside)
    const P = this.rt.player;
    if (P?.pos && P.onGround && !P.dead && this.burning(P.pos)) {
      const o = this.pushOut(P.pos, _out);
      if (o) { P.vel.y = Math.max(P.vel.y, 9.5); P.vel.x = o.x * 4.5; P.vel.z = o.z * 4.5; }
    }
  }
  /** Where to set it from (the scout's): the nearest tap; once the founder is stopped, the way out. */
  get center() {
    if (this.rt.logic.resolved && this.rt.doorOut) return this.rt.doorOut;
    const P = this.rt.player?.pos, list = this.setters.map((s) => s.at);
    if (!P || !list.length) return list[0] ?? this.at;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
  dispose() { this.off?.(); }
}
const _out = new THREE.Vector3();
/** Several geometries as one (position and normal only). */
function mergeGeos(list) {
  const g = new THREE.BufferGeometry(), pos = [], nor = [];
  for (const q0 of list) { const q = q0.index ? q0.toNonIndexed() : q0; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
/** The house's turn (its kit's frame without the move), for a push's way. */
function _noTurn(rt) { return (rt.kit.frameQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(rt.kit.frame))); }

/**
 * A tap of the pour (POUR.taps), by every hub: an iron post, a great iron wheel on its face that turns as the iron runs,
 * the pour's lamp on its cap. Turned (A / ×) it lets the iron in or stops it (Pour.toggle).
 * o: { id, room, at (its foot, local), yaw (the way it faces), sets: 'pour' }
 */
export class PourTap {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.25, yaw = o.yaw ?? 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.pos = K.world(x, y, z);
    K.both(M.dark, T(new THREE.BoxGeometry(1.0, H, 1.0), [x, y + H / 2, z], [0, yaw, 0]));
    K.add(M.trim, T(new THREE.BoxGeometry(1.25, 0.16, 1.25), [x, y + H + 0.08, z], [0, yaw, 0]));
    K.add(pourLamp(), T(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), [x, y + H + 0.21, z]));
    this.top = K.world(x + fx * 0.55, y + H * 0.7, z + fz * 0.55);
    this.at = this.top;
    const iron = makeMaterial({ color: '#4a3d34', flat: true, metal: 'iron', refl: 0.2, key: 'temple.moonfoundry.tap' });
    this.wheel = new THREE.Group();
    this.wheel.position.copy(K.world(x + fx * 0.6, y + H * 0.62, z + fz * 0.6));
    this.wheel.rotation.y = K.heading(yaw);
    const parts = [new THREE.TorusGeometry(0.55, 0.07, 6, 24)];
    for (let i = 0; i < 3; i++) parts.push(new THREE.BoxGeometry(0.08, 1.1, 0.08).rotateZ((i / 3) * Math.PI));
    parts.push(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 10).rotateX(Math.PI / 2));
    this.wheel.add(new THREE.Mesh(mergeGeos(parts), iron));   // (one mesh: the house's draws, tests/moonfoundry.test.js)
    rt.root.add(this.wheel);
    this.wheel.traverse((q) => { q.userData.noCollide = true; q.userData.dynamic = true; });
    const S = () => rt.pour;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (S()?.poured ? 'stop the pour' : 'let the pour in'),
      enabled: () => !!S(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => S()?.toggle(this.id),
    });
    rt.pour?.setters.push({ at: this.top, lever: this.id });
    this.later = !rt.pour;   // (a tap placed before the pour: it joins its list on its first frame)
  }
  update() {
    const S = this.rt.pour;
    if (this.later && S) { this.later = false; S.setters.push({ at: this.top, lever: this.id }); }
    this.wheel.rotation.z = pourLevel(this.rt) * Math.PI * 3;
  }
  dispose() { this.off?.(); }
}

/**
 * A gauge of the pour (G1, readable everywhere): a slender iron frame round a glass column, the iron in it standing high
 * and bright while the house pours, a dull stub when it is cold; the pour's lamp on top. In every room but the guardian's.
 * o: { room, at (its foot, local), h, shows: 'pour' }
 */
export class PourGauge {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, h = this.h = o.h ?? 2.6, r = 0.26;
    this.rt = rt; this.o = o;
    K.both(M.dark, T(new THREE.CylinderGeometry(0.42, 0.52, 0.5, 10), [x, y + 0.25, z]));
    const y0 = y + 0.5;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; K.add(M.trim, T(new THREE.BoxGeometry(0.06, h, 0.06), [x + Math.sin(a) * (r + 0.07), y0 + h / 2, z + Math.cos(a) * (r + 0.07)])); }
    K.add(M.trim, T(new THREE.CylinderGeometry(r + 0.14, r + 0.14, 0.12, 12), [x, y0 + h + 0.06, z]));
    K.add(pourLamp(), T(new THREE.SphereGeometry(0.22, 12, 8), [x, y0 + h + 0.36, z]));
    // the cold stub at its foot, always there; the iron over it, rising while it pours
    K.add(M.dark, T(new THREE.CylinderGeometry(r, r, 0.3, 12), [x, y0 + 0.15, z]));
    // (every gauge's iron is one mesh the pour keeps: Pour.gauge)
    rt.pour?.gauge(K.world(x, y0 + 0.3, z), r * 0.96, h - 0.4);
  }
  update() {}
}

/**
 * A heat-gate's sheet of iron (issue #416): while the house pours, iron spills over the gate's lintel from a spout and
 * falls down its face into a gutter at its foot, burning whoever stands in it (Pour.burns); cold, the spout is dry and
 * the gutter dark. Its door is the gate's own Door (opens COLD). o: { at (the doorway's foot, local), yaw (0: the slab
 * faces ±z), side (+1 / -1: the face the iron falls down), w, h }
 */
export class PourFall {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, yaw = o.yaw ?? 0, s = o.side ?? 1, w = o.w ?? DOOR.w, h = o.h ?? DOOR.h;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (dx, dy, dz) => [x + c * dx + sn * dz, y + dy, z - sn * dx + c * dz];
    // the spout over the lintel and the gutter at the foot (drawn; the gutter's lip solid: it is a kerb you step over)
    K.add(M.dark, T(new THREE.BoxGeometry(w + 0.6, 0.5, 1.1), at(0, h + 1.15, s * 1.0), [0, yaw, 0]));
    K.add(M.trim, T(new THREE.BoxGeometry(w + 0.8, 0.14, 1.3), at(0, h + 1.45, s * 1.0), [0, yaw, 0]));
    K.both(M.dark, T(new THREE.BoxGeometry(w + 0.4, 0.22, 0.18), at(0, 0.11, s * 1.55), [0, yaw, 0]));
    // three streams falling from the spout's lips down the gate's face, and the iron in the gutter (one mesh, shown while
    // it pours: the slab seen between them, so it reads as iron spilling, not a lit way through)
    const fall = [], top = h + 0.9;
    for (const dx of [-w * 0.3, 0, w * 0.3]) fall.push(new THREE.PlaneGeometry(0.7, top).translate(dx, top / 2, 0));
    fall.push(new THREE.PlaneGeometry(w - 0.2, 0.7).rotateX(-Math.PI / 2).translate(0, 0.16, 0.7));
    this.sheet = new THREE.Mesh(mergeGeos(fall), molten());
    this.sheet.position.copy(K.world(...at(0, 0.02, s * 0.85)));
    this.sheet.rotation.y = K.heading(yaw) + (s < 0 ? Math.PI : 0);
    this.sheet.userData.noCollide = true; this.sheet.userData.dynamic = true;
    this.sheet.name = 'The Casting-House: a heat-gate’s sheet of iron';
    rt.root.add(this.sheet);
    // (its burn: the sheet and the gutter in front of the gate, 1.5 m out from its face)
    const a = at(-w / 2, 0, s * 0.45), b = at(w / 2, 0, s * 1.65);
    const out = new THREE.Vector3(sn * s, 0, c * s);
    rt.pour?.burns.push({ box: [Math.min(a[0], b[0]), y - 0.5, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y + h, Math.max(a[2], b[2])], out: () => out });
    this.update();
  }
  update() {
    const k = pourLevel(this.rt);
    this.sheet.visible = k > 0.05;
    this.sheet.scale.set(1, Math.max(0.01, k), 1);
    this.sheet.position.y = this.rt.kit.world(0, this.o.at[1] + 0.02 + (DOOR.h + 0.9) * (1 - k), 0).y;
  }
}

/**
 * The great crucible hung over the Pouring Hall's north end (CRUCIBLE): an iron bowl on two trunnions under a yoke across
 * the hall, the iron glowing in it; it tips toward the basin while the house pours and its stream falls into the basin,
 * and stands upright while the house is cold. Drawn only (31 m up and 25 m: out of reach). o: {}
 */
export class Crucible {
  constructor(rt) {
    this.rt = rt;
    const K = rt.kit, C = CRUCIBLE, M = rt.M;
    const iron = makeMaterial({ color: '#3a2f27', flat: true, metal: 'iron', refl: 0.15, key: 'temple.moonfoundry.crucible' });
    // the yoke across the hall and the two hangers down to the trunnions (in the kit's batches: they don't move)
    K.add(M.dark, box(HALL.x1 - HALL.x0, 1.2, 1.6, 0, C.yoke, C.z));
    for (const s of [-1, 1]) { K.add(M.dark, box(0.5, C.yoke - C.y, 0.5, s * (C.r + 0.9), (C.yoke + C.y) / 2, C.z)); K.add(M.trim, T(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 12).rotateZ(Math.PI / 2), [s * (C.r + 0.6), C.y, C.z])); }
    this.group = new THREE.Group();
    this.group.position.copy(K.world(C.x, C.y, C.z));
    this.group.rotation.y = K.heading(0);
    this.bowl = new THREE.Group();
    this.group.add(this.bowl);
    const r = C.r;
    // (a deep bowl with a lip toward the basin: the lathe from its foot up, a band, the iron's top)
    this.bowl.add(new THREE.Mesh(lathe([[0.4, -4.4], [r * 0.7, -4.2], [r * 0.95, -2.8], [r, -0.6], [r * 1.06, 0.6], [r * 1.02, 0.7], [r * 0.9, 0.2], [r * 0.6, -3.8], [0.4, -3.9]], 28), iron));
    this.bowl.add(new THREE.Mesh(T(new THREE.TorusGeometry(r * 1.0, 0.16, 6, 28), [0, -1.2, 0], [Math.PI / 2, 0, 0]), iron));
    this.bowl.add(new THREE.Mesh(T(new THREE.BoxGeometry(1.6, 0.3, 1.4), [0, 0.55, -r - 0.4]), iron));   // (the lip)
    this.top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 24).rotateX(-Math.PI / 2).translate(0, 0.1, 0), molten());
    this.bowl.add(this.top);
    // the stream: from the lip down into the basin
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1, 10, 1, true).translate(0, -0.5, 0), molten());
    rt.root.add(this.group, this.stream);
    for (const m of [this.group, this.stream]) m.traverse((q) => { q.userData.noCollide = true; q.userData.dynamic = true; });
    this.group.name = 'The Casting-House’s great crucible'; this.stream.name = 'The great crucible’s stream';
    this.lipLocal = new THREE.Vector3(0, 0.55, -r - 1.0);
    this.basin = K.world((RUN.basin[0] + RUN.basin[2]) / 2, -RUN.depth, (RUN.basin[1] + RUN.basin[3]) / 2);
    this.update();
  }
  update(dt, t = 0) {
    const k = pourLevel(this.rt);
    this.bowl.rotation.x = -k * CRUCIBLE.tip;
    this.group.updateMatrixWorld(true);
    const lip = this.bowl.localToWorld(this.lipLocal.clone());
    const L = Math.max(0.1, lip.y - this.basin.y);
    this.stream.visible = k > 0.15;
    this.stream.position.set(lip.x, lip.y, lip.z);
    this.stream.scale.set(0.4 + 0.6 * k + 0.04 * Math.sin(t * 9), L, 0.4 + 0.6 * k);
  }
}

/**
 * The house's iron as a sheet that rises with the pour (a runnel's, the basin's, a mould's): from `y0` (cold: gone) to
 * `y1` (poured), over [x0, z0, x1, z1] (local). Kept by the pour (Pour.sheets); `burns` adds its volume to the pour's burns.
 */
function moltenSheet(rt, [x0, z0, x1, z1], y0, y1, { burns = null, name = 'molten iron', round = false, when = null } = {}) {
  const K = rt.kit;
  const g = round ? new THREE.RingGeometry(round, (x1 - x0) / 2, 32) : new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(g.rotateX(-Math.PI / 2), molten());
  m.position.copy(K.world((x0 + x1) / 2, 0, (z0 + z1) / 2));
  m.rotation.y = K.heading(0);
  m.userData.noCollide = true; m.userData.dynamic = true; m.name = `The Casting-House: ${name}`;
  rt.root.add(m);
  rt.pour.sheets.push({ mesh: m, base: K.world(0, 0, 0).y, y0, y1, when });
  if (burns) rt.pour.burns.push(burns);
}

/**
 * (v1.53, issue #23) The Sand Room, south off the Mould Room: an arena among the founders' bins of moulding sand; won,
 * the small key's cage sinks (since v1.83, issue #416, for the door down to the Weighing Hall). (v1.77) 30 m square under
 * 18, the house's one fight: its keepers round its middle among the four bins. (v1.83) Its door a heat-gate, shut while
 * the house pours, the iron spilling down its Mould Room face; a tap and a gauge inside, so the fight never shuts you in.
 */
function sandRoom(rt, K, M, { iron }) {
  const add = (P, o) => rt.add(P, o);
  const S = SAND, z1 = S.z + S.d / 2;
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: 0, h: S.h, roof: true, omit: ['n'] });   // (its north wall the Mould Room's, the doorway in it)
  add(Door, { id: 'dR', at: [S.x, 0, z1 + 0.6], ...DOOR, lamps: [COLD] });   // (cold: open; it shuts behind you while they stand)
  add(PourFall, { at: [S.x, 0, z1 + 0.6], side: 1 });
  const sand = { paint: new THREE.Color('#b98b5a'), smooth: false, side: THREE.FrontSide };
  for (const [x, z] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
    K.both(iron, box(2.6, 1.0, 2.0, S.x + x, 0.5, S.z + z));
    K.both(sand, T(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.45, 0.85), [S.x + x, 1.0, S.z + z]));   // (solid as drawn: a heap you stand on)
  }
  add(Key, { id: 'kS', at: [S.x, 0, S.z - S.d / 2 + 2.6], yaw: 0 });
  add(Mark, { room: 'sand', at: [S.x + 8, 0, z1 - 4], yaw: Math.PI, foes: [S.x, 0, S.z] });
  const tap = POUR.taps.find((t) => t.room === 'sand');
  add(PourTap, { id: 'tap.sand', ...tap, sets: 'pour' });
  add(PourGauge, { room: 'sand', at: [S.x - 12, 0, z1 - 3], shows: 'pour' });
}

/** Is the traveller inside [x0, z0, x1, z1] (local), his feet between y0 and y1? */
function inRoom(rt, [x0, z0, x1, z1], y0, y1) {
  const p = rt.player?.pos;
  if (!p) return false;
  const q = rt.kit.local(p.clone());
  return q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1 && q.y > y0 && q.y < y1;
}

/** A thin iron bar (a chain) from a to b, drawn. */
function bar(K, mat, a, b, r = 0.12) {
  const A = V(...a), B = V(...b), L = A.distanceTo(B);
  const g = new THREE.BoxGeometry(r, r, L);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), B.clone().sub(A).normalize()));
  K.add(mat, g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2));
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const iron = { paint: new THREE.Color('#3f393a'), smooth: false, side: THREE.FrontSide };
  const rust = { paint: new THREE.Color('#b5653a'), smooth: false, side: THREE.FrontSide };
  const ivory = { paint: new THREE.Color('#efe6d2'), smooth: true, side: THREE.FrontSide };
  const sandM = { paint: new THREE.Color('#c99b66'), smooth: false, side: THREE.FrontSide };
  const ember = makeMaterial({ color: '#f08a3c', glow: 0.6, flat: true, key: 'temple.moonfoundry.ember' });
  const HOT = { caught: 'The iron moon rolls through the heat and comes out glowing. It won’t stay hot for long.', out: 'The iron moon’s glow dulls, and it is cold again.', back: 4 };
  const HEAVY = 'It rocks on its rail and settles back. Cast iron: far too heavy for a push. The founders drew these with something.';
  /** A groove: a dark strip and two iron rails along it (drawn). */
  const groove = (a, b, w = 1.0) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2, y = Math.min(a[1], b[1]);
    K.add(M.dark, T(new THREE.BoxGeometry(w, 0.04, L), [cx, y + 0.02, cz], [0, yaw, 0]));
    for (const s of [-1, 1]) K.add(iron, T(new THREE.BoxGeometry(0.16, 0.1, L), [cx + Math.cos(yaw) * s * (w / 2 + 0.1), y + 0.05, cz - Math.sin(yaw) * s * (w / 2 + 0.1)], [0, yaw, 0]));
  };
  /** A cracked moon of ivory (decoration): a sphere and a dark seam round it. */
  const crackedMoon = (x, y, z, r, solid = false) => {
    const g = new THREE.SphereGeometry(r, 14, 10).translate(x, y, z);
    if (solid) K.both(ivory, g); else K.add(ivory, g);
    K.add(M.dark, T(new THREE.TorusGeometry(r * 1.002, 0.05, 3, 24), [x, y, z], [0.5, 0.3, 0.2]));
  };
  const tapIn = (room) => add(PourTap, { id: `tap.${room}`, ...POUR.taps.find((t) => t.room === room), sets: 'pour' });
  const gauge = (room, at, h) => add(PourGauge, { room, at, h, shows: 'pour' });
  const A0 = HALL.z1 + 1.2, A1 = CW - HR - 0.7;

  // ---- the pour first: the gates, sheets and gauges after it join its lists
  add(Pour, { id: 'pour', at: [0, 0, HZ] });

  // ---- the Porch (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 10, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  // the founders' racks: a few small cracked moons on a shelf
  K.both(iron, box(1.2, 0.2, 6, 6.2, 1.4, 6));
  for (const z of [4, 6, 8]) crackedMoon(6.2, 1.9, z, 0.4);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  gauge('threshold', [-5.2, 0, 10.4]);
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, ...DOOR }] });
  K.corridor([0, 12.6], [0, HALL.z0 - 0.6], 0, DOOR);

  // ---- the Pouring Hall (G4: 44 by 72 m under 34, the hub): its floor cut by the runnels, the gallery round three sides,
  // the crucible over its north end
  K.hall({ x: 0, z: HZ, w: HALL.x1 - HALL.x0, d: HALL.z1 - HALL.z0, y: 0, h: HALL.h, floor: false, roof: 'oculus', oculus: 0.22, doors: [
    { side: 's', ...DOOR }, { side: 'w', at: RUN.z - HZ, ...DOOR }, { side: 'e', at: RUN.z - HZ, ...DOOR }, { side: 'n', ...DOOR },
    { side: 'w', at: HALL.stairZ - HZ, ...DOOR, y0: UP }] });
  {
    // the floor, round the runnels: slabs 1.4 m thick (their edges the runnels' walls), the runnels' beds 1.2 m down
    const X0 = HALL.x0 - 0.6, X1 = HALL.x1 + 0.6, Z0 = HALL.z0 - 0.6, Z1 = HALL.z1 + 0.6, r0 = RUN.z - RUN.w / 2, r1 = RUN.z + RUN.w / 2, h = RUN.w / 2;
    const [bx0, bz0, bx1, bz1] = RUN.basin, sp = RUN.spine;
    for (const [x0, z0, x1, z1] of [[X0, Z0, X1, r0], [X0, r1, -h, bz0], [h, r1, X1, bz0], [X0, bz0, bx0, bz1], [bx1, bz0, X1, bz1], [X0, bz1, X1, Z1]]) K.slab(x0, z0, x1, z1, 0, 1.4);
    // (the Runner's ends, under the gates' doorways: the doorways' floor)
    for (const s of [-1, 1]) K.both(M.floor, box(0.6, 1.4, RUN.w, s * (HALL.x1 + 0.3), -0.7, RUN.z));
    // the beds: dark scorched iron
    for (const [x0, z0, x1, z1] of [[HALL.x0, r0, HALL.x1, r1], [-h, sp[0], h, sp[1]], [bx0, bz0, bx1, bz1]]) K.both(M.dark, box(x1 - x0, 0.8, z1 - z0, (x0 + x1) / 2, -RUN.depth - 0.4, (z0 + z1) / 2));
    // the iron over them while it pours: rising from the beds to brim RUN.metal under the floor, and burning
    const out = { x: (q, R) => V(0, 0, q.z < (R[1] + R[3]) / 2 ? -1 : 1), z: (q, R) => V(q.x < (R[0] + R[2]) / 2 ? -1 : 1, 0, 0), o: (q, R) => V(q.x - (R[0] + R[2]) / 2, 0, q.z - (R[1] + R[3]) / 2).normalize() };
    for (const R of RUNS) moltenSheet(rt, R.r, -RUN.depth + 0.05, RUN.metal, { name: 'the runnels’ iron', burns: { box: [R.r[0], -RUN.depth - 0.6, R.r[1], R.r[2], -0.25, R.r[3]], out: (q) => out[R.along](q, R.r) } });
    // the plates over them, flush (their tops 6 cm proud of the floor), and the rail's trestle over the spine
    for (const [x0, z0, x1, z1] of RUN.plates) { K.both(rust, box(x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2)); K.add(M.dark, box(x1 - x0 - 0.6, 0.02, 0.12, (x0 + x1) / 2, 0.07, (z0 + z1) / 2)); }
    K.both(rust, box(RUN.w + 2.4, 0.12, 2.6, 0, 0, RUN.rail));
    // steps down into the runnels along a wall here and there (cold, they are lanes you walk in): three treads
    for (const [x, z, ax] of RUN.steps) for (let i = 0; i < 3; i++) {
      const top = -0.3 * (i + 1), u = (i + 0.5) * 0.7;
      K.both(M.dark, ax === 'x' ? box(0.7, top + RUN.depth + 0.2, 1.2, x + u, (top - RUN.depth - 0.2) / 2, z) : box(1.2, top + RUN.depth + 0.2, 0.7, x, (top - RUN.depth - 0.2) / 2, z + u));
    }
    // the basin's kerb round three sides (the stream falls into it), and a low iron rail on it
    K.both(M.trim, box(bx1 - bx0 + 1.2, 0.5, 0.6, 0, 0.25, bz1 + 0.3));
    for (const s of [-1, 1]) K.both(M.trim, box(0.6, 0.5, bz1 - bz0, s * (bx1 + 0.3), 0.25, (bz0 + bz1) / 2));
  }
  // the gallery 11 m up round the west, north and east sides, open over the floor; its parapet, open at the sill
  {
    const G = HALL.gallery, gx0 = HALL.x0 + G, gx1 = HALL.x1 - G, gn = HALL.z1 - G, gz = HALL.galleryZ;
    K.slab(HALL.x0 - 0.6, gz, gx0, HALL.z1 + 0.6, UP, 0.8); K.slab(gx1, gz, HALL.x1 + 0.6, HALL.z1 + 0.6, UP, 0.8); K.slab(gx0, gn, gx1, HALL.z1 + 0.6, UP, 0.8);
    const par = (x0, z0, x1, z1) => K.both(M.trim, box(Math.max(0.3, x1 - x0), 1.1, Math.max(0.3, z1 - z0), (x0 + x1) / 2, UP + 0.55, (z0 + z1) / 2));
    par(gx0 - 0.3, gz, gx0, SILL.z0); par(gx0 - 0.3, SILL.z1, gx0, gn); par(gx1, gz, gx1 + 0.3, gn); par(gx0, gn - 0.3, gx1, gn);
    par(HALL.x0, gz, gx0, gz + 0.3); par(gx1, gz, HALL.x1, gz + 0.3);
    // (the sill's edge lit, between two posts with the pour's lamp: the way down)
    K.add(ember, box(0.12, 0.06, SILL.z1 - SILL.z0 - 0.4, gx0 - 0.08, UP + 0.03, (SILL.z0 + SILL.z1) / 2));
    for (const z of [SILL.z0, SILL.z1]) { K.both(M.trim, box(0.4, 1.6, 0.4, gx0 - 0.2, UP + 0.8, z)); K.add(pourLamp(), T(new THREE.SphereGeometry(0.2, 10, 8), [gx0 - 0.2, UP + 1.8, z])); }
    // iron columns under the gallery's arms
    for (const z of [46, 58, 82]) for (const x of [gx0 - 0.9, gx1 + 0.9]) K.column(x, z, 0, UP - 0.8, 0.5, { mat: iron });
    // the bed of moulding sand under the sill (G6): a kerb round it, the sand heaped soft
    const [sx, sz] = SILL.bed;
    K.both(M.trim, T(annulus(SILL.r, SILL.r + 0.5, 0.35, 32), [sx, 0.35, sz]));
    K.add(sandM, T(new THREE.SphereGeometry(1, 20, 8, 0, TAU, 0, Math.PI / 2).scale(SILL.r, 0.45, SILL.r), [sx, 0, sz]));
    add(Catch, { at: [sx, 0, sz], r: SILL.r + 0.6, said: 'The moulding sand takes your fall.' });
    add(Mark, { room: 'gallery', at: [gx0 - 3.6, UP, 50], yaw: Math.PI / 2 });
    tapIn('gallery');
    gauge('gallery', [gx1 + 3.6, UP, 86]);
  }
  // the crucible and its stream; a great cracked moon hung over the south floor
  add(Crucible, {});
  crackedMoon(0, 20, 38, 2.6);
  for (const a of [0.3, 2.4, 4.5]) K.add(iron, T(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 4), [Math.sin(a) * 1.6, 24.3, 38 + Math.cos(a) * 1.6], [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]));
  // the founders' moon on its rail across the spine (over its trestle) into the great cradle on the west floor, a mould
  // the pour fills round it, before the Founders' Door
  const GA = 7.4, GB = -8.6, GZ0 = RUN.rail;
  groove([GA, 0, GZ0], [GB, 0, GZ0], 1.3);
  add(Ball, { id: 'mG', a: [GA, 0.04, GZ0], b: [GB, 0.04, GZ0], r: 1.3, heavy: 'magnet', iron: true, heavyLine: HEAVY, friction: 0.7, lock: true });
  add(Plate, { id: 'pG', at: [GB, 0, GZ0], r: 1.5 });
  K.add(M.dark, T(annulus(1.9, 2.9, 0.06, 32), [GB, 0.05, GZ0]));
  K.add(ember, T(annulus(2.9, 3.05, 0.04, 32), [GB, 0.06, GZ0]));
  moltenSheet(rt, [GB - 2.9, GZ0 - 2.9, GB + 2.9, GZ0 + 2.9], -0.5, 0.11, { name: 'the great cradle’s iron', round: 1.4, when: { drumOn: ['mG', 'pG'] } });
  cradle(K, iron, GB, 0, GZ0, 2.9, 6);
  add(Watch, { when: { all: [{ drumOn: ['mG', 'pG'] }, POURED] }, say: 'The iron runs round the founders’ moon in its cradle. The Founders’ Door’s lamps light.', key: 'pG.cast' });
  add(Door, { id: 'dF', at: [0, 0, HALL.z1 + 0.6], ...DOOR, lamps: [{ drumOn: ['mG', 'pG'] }, POURED] });
  K.glyph([0, DOOR.h + 2.4, HALL.z1 - 0.05], 2.0, Math.PI);
  // the west and east heat-gates in the hall's walls, the iron spilling down their hall faces
  add(Door, { id: 'gW', at: [HALL.x0 - 0.6, 0, RUN.z], yaw: Math.PI / 2, ...DOOR, lamps: [COLD] });
  add(PourFall, { at: [HALL.x0 - 0.6, 0, RUN.z], yaw: Math.PI / 2, side: 1 });
  add(Door, { id: 'gE', at: [HALL.x1 + 0.6, 0, RUN.z], yaw: Math.PI / 2, ...DOOR, lamps: [COLD] });
  add(PourFall, { at: [HALL.x1 + 0.6, 0, RUN.z], yaw: Math.PI / 2, side: -1 });
  add(Mark, { room: 'floor', at: [7.5, 0, 22.5], yaw: Math.PI });
  tapIn('floor');
  gauge('floor', [-17, 0, 22.5], 3.4);
  gauge('floor', [16, 0, 84], 3.4);

  // ---- the Mould Room (34 m square, west of the hall, behind the west gate): the stone moon into the great mould, the
  // founders' spout over it from the pour; its seam-eye on a post beside it; the dais with the hoist's pan
  K.corridor([HALL.x0 - 0.6, MZ], [MX + MW / 2 + 0.6, MZ], 0, DOOR);
  K.hall({ x: MX, z: MZ, w: MW, d: MD, y: 0, h: 18, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', ...DOOR }, { side: 'n', at: SX - MX, ...DOOR }, { side: 's', at: SAND.x - MX, ...DOOR }] });
  const PM = [MX - 2, 0, MZ - 4];
  groove([MX + 8, 0, PM[2]], PM);
  add(Ball, { id: 'm1', a: [MX + 8, 0.04, PM[2]], b: [PM[0], 0.04, PM[2]], r: 1.0, friction: 0.9 });
  add(Plate, { id: 'pM', at: PM, r: 1.2 });
  K.add(M.dark, T(annulus(1.7, 2.6, 0.06, 32), [PM[0], 0.05, PM[2]]));
  K.add(ember, T(annulus(2.6, 2.75, 0.04, 32), [PM[0], 0.06, PM[2]]));   // (the mould's seam)
  // the iron in the mould while it pours (round the stone moon, if it is there), and the founders' spout over it: an iron
  // trough under the roof from the east wall, its stream falling into the mould
  moltenSheet(rt, [PM[0] - 2.6, PM[2] - 2.6, PM[0] + 2.6, PM[2] + 2.6], -0.5, 0.11, { name: 'the great mould’s iron', round: 1.0, when: { drumOn: ['m1', 'pM'] } });
  {
    const ty = 12.5, x0 = MX + MW / 2 - 0.2, x1 = PM[0] + 1.6;
    K.add(M.dark, box(x0 - x1, 0.5, 1.4, (x0 + x1) / 2, ty, PM[2]));
    for (const s of [-1, 1]) K.add(M.trim, box(x0 - x1, 0.5, 0.16, (x0 + x1) / 2, ty + 0.45, PM[2] + s * 0.7));
    for (const x of [x0 - 6, x1 + 3]) bar(K, iron, [x, ty, PM[2]], [x, 17.6, PM[2]], 0.1);
    moltenSheet(rt, [x1, PM[2] - 0.5, x0, PM[2] + 0.5], ty - 0.5, ty + 0.2, { name: 'the spout’s iron' });
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, ty - 0.3, 8, 1, true).translate(0, -(ty - 0.3) / 2, 0), molten());
    st.position.copy(K.world(PM[0] + 0.9, ty - 0.2, PM[2])); st.userData.noCollide = true; st.userData.dynamic = true; st.name = 'The founders’ spout’s stream';
    rt.root.add(st);
    rt.pour.sheets.push({ mesh: st, grow: true });   // (it falls from the spout down as it pours)
  }
  add(Watch, { when: { all: [{ drumOn: ['m1', 'pM'] }, POURED] }, say: 'The iron runs round the stone moon in the mould. Cast: the north door grinds down.', key: 'pM.cast' });
  add(Watch, { test: (r) => r.logic.check(POURED) && !r.logic.drumOn('m1', 'pM') && inRoom(r, [MX - MW / 2, MZ - MD / 2, MX + MW / 2, MZ + MD / 2], -1, 8), say: 'The pour runs into the empty mould and out through its seam. Nothing to cast round.', key: 'pM.empty' });
  // the founders' rack of test casts by the north wall: cracked moons on a shelf
  K.both(iron, box(6, 0.2, 1.2, MX + 8, 1.4, MZ + MD / 2 - 1.2));
  for (const x of [-2, 0, 2]) crackedMoon(MX + 8 + x, 1.9, MZ + MD / 2 - 1.2, 0.4);
  // moulds sunk in the floor: dark dishes with a seam each
  for (const [x, z] of [[MX - 11, MZ - 11], [MX + 9, MZ - 12], [MX + 10, MZ + 11]]) { K.add(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 0.05, 20), [x, 0.03, z])); K.add(iron, T(annulus(1.4, 1.65, 0.08, 20), [x, 0.08, z])); }
  // the dais (top 4.5) up a stair from the east; the hoist's counterweight pan at its west end, its chains up to the roof
  // and away north to the hoist
  const DZ = MZ + 6;
  K.both(M.wall, box(8.8, 3.9, 5.8, MX - 5.5, 1.95, DZ));
  K.slab(MX - 10, DZ - 3, MX - 1, DZ + 3, 4.5, 0.8);
  K.stairs([MX + 4.6, 0, DZ], [MX - 1, 4.5, DZ], 2.6);
  groove([MX - 3, 4.5, DZ], [MX - 7.3, 4.5, DZ]);
  add(Ball, { id: 'm2', a: [MX - 3, 4.54, DZ], b: [MX - 7.3, 4.54, DZ], r: 1.0, lock: true });
  add(Plate, { id: 'pK', at: [MX - 7.3, 4.5, DZ], r: 1.2 });
  for (const s of [-1, 1]) K.add(iron, box(0.1, 12.6, 0.1, MX - 7.3 + s * 1.0, 11.1, DZ));
  K.add(iron, box(2.2, 0.12, 0.12, MX - 7.3, 17.4, DZ));
  bar(K, iron, [MX - 7.3, 17.4, DZ], [SX, 17.4, MZ + MD / 2 - 0.1]);
  K.add(iron, T(new THREE.TorusGeometry(0.7, 0.1, 5, 16), [MX - 7.3, 17.4, DZ + 0.2]));
  add(Watch, { test: (r) => !!r.logic.weights.get('pK')?.has('player') && !r.logic.drumOn('m2', 'pK'), say: 'The pan sinks under you, and behind the wall a chain runs and something rises. You are the weight; but you are here, not on it.', key: 'pK.you' });
  add(Door, { id: 'dM', at: [SX, 0, MZ + MD / 2 + 0.6], ...DOOR, lamps: [{ drumOn: ['m1', 'pM'] }, POURED] });
  add(Mark, { room: 'moulds', at: [MX + 11, 0, MZ - 10], yaw: Math.PI * 0.75 });
  tapIn('moulds');
  gauge('moulds', [MX + 13, 0, MZ + 13]);

  // ---- the Crucible Stair (north of the Mould Room, 30 m square under 28): the hoist up to the landing (UP), the landing
  // the upper floor's hub: its stone moon into the north door's counterweight mould (a cast, as the Mould Room's), its
  // door east onto the Pouring Hall's gallery, its north door to the Tong Chamber
  K.hall({ x: SX, z: (S0 + S1) / 2, w: 30, d: S1 - S0, y: 0, h: 28, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', ...DOOR, y0: UP }, { side: 'e', at: HALL.stairZ - (S0 + S1) / 2, ...DOOR, y0: UP }] });
  K.slab(SX - 15, LZ, SX + 15, S1, UP, 0.8);
  K.both(M.trim, box(30, 0.3, 0.3, SX, UP + 0.05, LZ + 0.13));   // (2 cm proud of the landing's edge)
  add(Platform, { path: [[SX, 0.3, HZH], [SX, UP, HZH]], r: 2.2, speed: 1.4, pause: 2.0, when: { pressed: 'pK' } });
  K.add(M.dark, T(new THREE.CylinderGeometry(2.4, 2.4, 0.1, 24), [SX, 0.05, HZH]));
  // the pulley over it, its chain going over the wall toward the pan
  K.add(iron, T(new THREE.TorusGeometry(1.4, 0.18, 6, 24), [SX, 26.4, HZH], [0, Math.PI / 2, 0]));
  K.add(iron, box(0.14, 14, 0.14, SX, 19.6, HZH - 1.3));
  K.add(iron, box(0.14, 0.14, HZH - 1.3 - S0, SX, 26.6, (HZH - 1.3 + S0) / 2));
  add(Mark, { room: 'stair', at: [SX - 6, 0, S0 + 3], yaw: Math.PI / 2 });
  gauge('stair', [SX - 9.5, 0, S0 + 7]);
  // the landing's stone moon on its groove into the counterweight mould by the north door; the pour's feed to the mould
  // from the hall's wall, under the landing's roof
  const LM = [SX + 3, UP, 70], LA = [SX - 8, UP, 70];
  groove(LA, LM);
  add(Ball, { id: 'mL', a: [LA[0], UP + 0.04, LA[2]], b: [LM[0], UP + 0.04, LM[2]], r: 1.0, friction: 0.9 });
  add(Plate, { id: 'pL', at: LM, r: 1.2 });
  K.add(M.dark, T(annulus(1.7, 2.6, 0.06, 32), [LM[0], UP + 0.05, LM[2]]));
  K.add(ember, T(annulus(2.6, 2.75, 0.04, 32), [LM[0], UP + 0.06, LM[2]]));
  moltenSheet(rt, [LM[0] - 2.6, LM[2] - 2.6, LM[0] + 2.6, LM[2] + 2.6], UP - 0.5, UP + 0.11, { name: 'the counterweight mould’s iron', round: 1.0, when: { drumOn: ['mL', 'pL'] } });
  {
    const ty = UP + 9, x0 = SX + 15 - 0.2, x1 = LM[0] + 1.6;
    K.add(M.dark, box(x0 - x1, 0.5, 1.4, (x0 + x1) / 2, ty, LM[2]));
    for (const s of [-1, 1]) K.add(M.trim, box(x0 - x1, 0.5, 0.16, (x0 + x1) / 2, ty + 0.45, LM[2] + s * 0.7));
    bar(K, iron, [x1 + 2, ty, LM[2]], [x1 + 2, 27.4, LM[2]], 0.1);
    moltenSheet(rt, [x1, LM[2] - 0.5, x0, LM[2] + 0.5], ty - 0.5, ty + 0.2, { name: 'the landing spout’s iron' });
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, ty - UP - 0.3, 8, 1, true).translate(0, -(ty - UP - 0.3) / 2, 0), molten());
    st.position.copy(K.world(LM[0] + 0.9, ty - 0.2, LM[2])); st.userData.noCollide = true; st.userData.dynamic = true; st.name = 'The landing spout’s stream';
    rt.root.add(st);
    rt.pour.sheets.push({ mesh: st, grow: true });
    // (the counterweight's chain from the mould up the wall and over to the door's lintel)
    bar(K, iron, [LM[0] - 1.8, UP, LM[2] + 1.8], [LM[0] - 1.8, UP + DOOR.h + 1.6, LM[2] + 1.8], 0.12);
    bar(K, iron, [LM[0] - 1.8, UP + DOOR.h + 1.6, LM[2] + 1.8], [SX + 2.2, UP + DOOR.h + 1.6, S1 - 0.3], 0.12);
  }
  add(Watch, { when: { all: [{ drumOn: ['mL', 'pL'] }, POURED] }, say: 'The iron runs round the stone moon in the counterweight’s mould. Cast: the north door rises.', key: 'pL.cast' });
  add(Door, { id: 'gT', at: [SX, UP, S1 + 0.6], ...DOOR, lamps: [{ drumOn: ['mL', 'pL'] }, POURED] });
  add(Mark, { room: 'landing', at: [SX - 11, UP, 75], yaw: Math.PI * 0.75 });
  tapIn('landing');
  gauge('landing', [SX - 12.5, UP, LZ + 3]);
  K.corridor([SX + 15.6, HALL.stairZ], [HALL.x0 - 0.6, HALL.stairZ], UP, DOOR);

  // ---- the Tong Chamber (a round hall 34 m across, floor UP): the chest; the try by the dais; the east door's cradle
  K.corridor([SX, S1 + 0.6], [SX, TZ - TR - 0.7], UP, DOOR);
  K.rotunda({ x: SX, z: TZ, y: UP, r: TR, h: 18, gaps: [{ a: Math.PI, ...DOOR }, { a: Math.PI / 2, ...DOOR }], oculus: 0.35 });
  // (a cap round its rim, 2 cm over the trim's top: the Pouring Hall's roof, 6 m higher, looks down on it, and the rim's
  // stones and its trim lie in one plane there)
  K.both(M.trim, T(annulus(TR + 0.6, TR + 2.3, 0.3, 56), [SX, UP + 18 + 0.32, TZ]));
  K.both(M.trim, ...chestMound(SX, UP, TZ));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // racks of tongs on the walls (drawn)
  for (const a of [-0.9, -2.2, 2.6]) { const x = SX + Math.sin(a) * (TR - 0.2), z = TZ + Math.cos(a) * (TR - 0.2); for (const s of [-1, 1]) K.add(iron, T(new THREE.BoxGeometry(0.12, 2.4, 0.12), [x, UP + 2.6, z], [0, a, s * 0.12])); }
  groove([SX - 6.5, UP, TZ - 3.5], [SX - 6.5, UP, TZ + 3.5]);
  add(Ball, { id: 'mT', a: [SX - 6.5, UP + 0.04, TZ - 3.5], b: [SX - 6.5, UP + 0.04, TZ + 3.5], r: 1.1, heavy: 'magnet', iron: true, heavyLine: HEAVY, lock: true });
  add(Plate, { id: 'pT', at: [SX - 6.5, UP, TZ + 3.5], r: 1.3 });
  add(Watch, { when: { drumOn: ['mT', 'pT'] }, say: 'The iron moon rolls in the glove’s field, heavy as a cart, and settles in its cradle.', key: 'mT.cradle' });
  // the east door's cradle out on the floor, its chain up and over to the door's bar
  const PP = [SX + 8.7, UP, TZ - 5];
  groove([SX + 2.5, UP, PP[2]], PP);
  add(Ball, { id: 'mP', a: [SX + 2.5, UP + 0.04, PP[2]], b: [PP[0], UP + 0.04, PP[2]], r: 1.2, heavy: 'magnet', iron: true, heavyLine: HEAVY, lock: true });
  add(Plate, { id: 'pP', at: PP, r: 1.4 });
  cradle(K, iron, PP[0], UP, PP[2], 1.5, 5);
  K.add(iron, box(0.12, 9.4, 0.12, PP[0] + 1.7, UP + 4.7, PP[2]));
  bar(K, iron, [PP[0] + 1.7, UP + 9.4, PP[2]], [SX + TR - 0.3, UP + DOOR.h + 1.2, TZ - 2]);
  add(Door, { id: 'dP', at: [SX + TR + 0.7, UP, TZ], yaw: Math.PI / 2, ...DOOR, frame: { side: 1.2 }, lamps: [{ drumOn: ['mP', 'pP'] }] });
  add(Mark, { room: 'tongs', at: [SX + 5, UP, TZ - 11], yaw: -Math.PI * 0.75 });
  gauge('tongs', [SX - 9, UP, TZ - 9]);

  // ---- the Casting Furnace (46 by 36 m, floor UP): the molten channel down its middle, the bridge, the near lip's hooded
  // mould and the pilot flame the pour feeds, the press; the far gate in the far lip's south wall
  K.corridor([SX + TR + 0.7, TZ], [FX0 - 0.6, TZ], UP, DOOR);
  K.hall({ x: FXc, z: TZ, w: FX1 - FX0, d: FD, y: UP, h: 20, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', ...DOOR }, { side: 's', at: FAR - FXc, ...DOOR }] });
  K.slab(FX0, TZ - FD / 2, C0, TZ + FD / 2, UP, 0.8);
  K.slab(C1, TZ - FD / 2, FX1, TZ + FD / 2, UP, 0.8);
  // the channel: its faces down to the molten iron, the iron glowing at the bottom
  // (each face 2 cm proud of its lip's end: no two faces in one plane)
  K.both(M.wall, box(0.8, 6, FD, C0 - 0.38, UP - 3.4, TZ)); K.both(M.wall, box(0.8, 6, FD, C1 + 0.38, UP - 3.4, TZ));
  for (const s of [-1, 1]) K.both(M.wall, box(C1 - C0, 6, 0.8, (C0 + C1) / 2, UP - 3.4, TZ + s * (FD / 2 + 0.4)));
  K.both(ember, box(C1 - C0, 0.4, FD, (C0 + C1) / 2, UP - 6, TZ));
  K.both(M.dark, box(C1 - C0, 1, FD, (C0 + C1) / 2, UP - 6.7, TZ));
  add(Pit, { room: 'furnace', min: [C0, UP - 11, TZ - FD / 2], max: [C1, UP - 1.6, TZ + FD / 2], own: 'the molten iron glowing at its bottom' });   // (deadly by its own look: no dark of its own, issue #312)
  add(Bridge, { id: 'brH', a: [C0 - 0.1, UP, TZ - 5], b: [C1 + 0.1, UP, TZ - 5], w: 4, n: 7 });
  add(Hammer, { id: 'hm', at: [(C0 + C1) / 2, UP, TZ - 5], yaw: Math.PI / 2, w: 4.6, d: 2.4, top: 5.2, period: 3.0, knock: 9,
    hit: 'The founders’ press comes down and throws you off the bridge. It slams out of step: wait for it to rise.' });
  // the near lip's iron moon on its rail along the channel, through the pilot flame (lidded while the house is cold: the
  // pour feeds it) into the hooded mould
  const HX = 3, HA = TZ - 8.3, HB = HA + 16.6;
  groove([HX, UP, HA], [HX, UP, HB]);
  add(Ball, { id: 'mH', a: [HX, UP + 0.04, HA], b: [HX, UP + 0.04, HB], r: 1.0, heavy: 'magnet', iron: true, heavyLine: HEAVY, friction: 0.55, tar: { ...HOT, burns: 12 } });
  add(Flame, { at: [HX, UP, HA + 12.8], r: 0.9 });
  add(Brazier, { id: 'bH', at: [HX, UP, HA + 18.4], hood: { ball: 'mH', yaw: Math.PI,
    said: 'The ember spatters on the mould’s iron hood. Its mouth opens low, on the rail: only a moon hot from the fire would reach it.',
    cold: 'The iron moon rolls into the mould’s mouth cold, and the mould tips it back out. The founders cast hot.' } });
  add(Watch, { test: (r) => r.logic.isOpen('brH'), say: 'The pour runs into the bridge’s mould. Its stones rise from the iron.', key: 'brH.cast' });
  // the founders' casting furnace in the north wall: a dark arch, the glow of the melt inside; the pour's feed from it
  // along the near lip to the bridge's mould at the bridge's foot, bright while the house pours
  const NZ = TZ + FD / 2;
  K.both(M.dark, box(7, 7, 2, HX, UP + 3.5, NZ - 0.8));
  K.add(ember, T(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), [HX, UP + 3.5, NZ - 1.85]));
  K.add(ember, box(4.4, 3.2, 0.1, HX, UP + 1.9, NZ - 1.85));
  {
    const fx = C0 - 1.3, z0 = TZ - 2.6, z1 = NZ - 1.8;
    K.both(M.dark, box(1.0, 0.5, z1 - z0, fx, UP + 0.25, (z0 + z1) / 2));
    moltenSheet(rt, [fx - 0.35, z0, fx + 0.35, z1], UP + 0.1, UP + 0.52, { name: 'the bridge’s feed' });
  }
  add(Door, { id: 'cF', at: [FAR, UP, TZ - FD / 2 - 0.6], ...DOOR, lamps: [COLD] });
  add(PourFall, { at: [FAR, UP, TZ - FD / 2 - 0.6], side: 1 });
  add(Mark, { room: 'furnace', at: [-5, UP, TZ - 10], yaw: Math.PI / 2 });
  add(Mark, { room: 'furnaceFar', at: [29, UP, TZ + 8], yaw: Math.PI });
  tapIn('furnace');
  gauge('furnace', [-8, UP, TZ + 14]);
  gauge('furnaceFar', [33.4, UP, TZ - 12]);

  // ---- the far gate's passage down to the Weighing Hall's gallery, the small key's door at its end
  K.corridor([FAR, TZ - FD / 2 - 0.6], [FAR, WZ1 + 0.6], UP, DOOR);
  add(Door, { id: 'dW', at: [FAR, UP, WZ1 + 0.6], ...DOOR });

  // ---- the Weighing Hall (34 by 42 m, floor 0, a gallery at UP along its north side and a pier from it out over the
  // middle of the hall): the keepers' pan at the pier's end, its eye on a post; the great scale, the stone weight on its
  // column's capital, the great key's cage at the scale's foot
  K.hall({ x: WX, z: WZ, w: WX1 - WX0, d: WZ1 - WZ0, y: 0, h: 24, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: RUN.z - WZ, ...DOOR }, { side: 'n', at: FAR - WX, ...DOOR, y0: UP }] });
  const PB = [PX, UP, PZ];
  K.slab(WX0, GZ, WX1, WZ1, UP, 0.8);
  K.slab(PX - 3, PB[2] - 1.6, PX + 3, GZ, UP, 0.8);
  for (const s of [-1, 1]) { K.column(PX + s * 2, PB[2] + 1, 0, UP - 0.8, 0.6, { mat: iron }); K.both(M.trim, box(0.3, 1.0, GZ - PB[2] - 3.4, PX + s * 2.85, UP + 0.5, (GZ + PB[2] + 3.4) / 2)); }
  // (the gallery's parapet, open at the pier and at the stair's head)
  K.both(M.trim, box(PX - 3 - WX0, 1.0, 0.3, (WX0 + PX - 3) / 2, UP + 0.5, GZ + 0.15));
  K.both(M.trim, box(WX1 - 4.2 - PX - 3, 1.0, 0.3, (PX + 3 + WX1 - 4.2) / 2, UP + 0.5, GZ + 0.15));
  K.stairs([WX1 - 3, 0, WZ0 + 7], [WX1 - 3, UP, GZ - 0.4], 3);
  groove([PX, UP, GZ - 1.5], PB, 1.1);
  add(Ball, { id: 'mB', a: [PX, UP + 0.04, GZ - 1.5], b: [PX, UP + 0.04, PB[2]], r: 1.2, heavy: 'magnet', iron: true, heavyLine: HEAVY, friction: 0.9, lock: true });
  add(Plate, { id: 'pB', at: PB, r: 1.4 });
  cradle(K, iron, PX, UP, PB[2], 1.5, 5);
  // its chain up over a pulley and across to the keepers' eye's post
  const EX = 36.5, EZ = 33;
  K.add(iron, T(new THREE.TorusGeometry(0.9, 0.12, 5, 18), [PX, 20, PB[2]], [0, Math.PI / 2, 0]));
  K.add(iron, box(0.12, 20 - UP - 2.6, 0.12, PX, (20 + UP + 2.6) / 2, PB[2]));
  bar(K, iron, [PX, 20.2, PB[2]], [EX - 0.6, 20.2, EZ]);
  K.add(iron, box(0.12, 20.2 - 9.6, 0.12, EX - 0.6, (20.2 + 9.6) / 2, EZ));
  K.column(EX - 0.6, EZ, 0, 9.6, 0.5, { mat: iron });
  add(Switch, { id: 'eS', at: [EX, 8.2, EZ], yaw: Math.PI / 2, size: 1.0, lids: true, wrong: 'The keepers’ eye stays lidded. Its chain runs up to an empty pan out on the gallery’s pier.' });
  // the great scale: a post, a beam along it, its two pans on chains; the floor pan's plate under the south one, the great
  // key's cage at the post's foot
  const SC = SCALE;
  K.column(SC.x, SC.z, 0, SC.beam - 0.3, 0.6, { mat: iron });
  K.both(iron, box(0.6, 0.6, 2 * (SC.z - SC.pan) + 1.2, SC.x, SC.beam, SC.z));
  for (const s of [-1, 1]) {
    const pz = SC.z + s * (SC.z - SC.pan);
    K.add(iron, box(0.08, SC.beam - (s < 0 ? 1.2 : 6.5), 0.08, SC.x, (SC.beam + (s < 0 ? 1.2 : 6.5)) / 2, pz));
    if (s > 0) K.both(rust, T(new THREE.CylinderGeometry(1.6, 1.2, 0.4, 18), [SC.x, 6.3, pz]));
  }
  add(Plate, { id: 'pS', at: [SC.x, 0, SC.pan], r: 1.4 });
  K.add(rust, T(annulus(1.5, 1.9, 0.06, 24), [SC.x, 0.07, SC.pan]));
  add(Key, { id: 'kG', big: true, at: [SC.x - 3.2, 0, SC.z], yaw: -Math.PI / 2 });
  // the stone weight on its column's capital, out of reach but for the hook
  const [cx, cz] = SC.column;
  K.column(cx, cz, 0, SC.capital, 0.32, { mat: iron });
  K.both(M.trim, box(0.9, 0.3, 0.9, cx, SC.capital + 0.15, cz));
  add(Weight, { id: 'wS', at: [cx, SC.capital + 0.3, cz], yaw: 0, name: 'stone weight', fall: SC.capital + 2, zone: { min: [WX0, -1, WZ0], max: [WX1, SC.capital + 2, WZ1] },
    hint: 'The scale’s floor pan wants a weight. One sits high on the column’s capital.', back: 'The weight is back on its capital.' });
  crackedMoon(SC.x, 6.9, SC.z + (SC.z - SC.pan), 0.7);
  add(Watch, { test: (r) => r.logic.drumOn('mB', 'pB') && !r.logic.weightOn('wS'), say: 'The beam tips toward the pier. Its other pan, on the floor, wants a weight as heavy.', key: 'kG.tip' });
  add(Mark, { room: 'scales', at: [33, 0, WZ0 + 7], yaw: Math.PI * 0.25 });
  tapIn('scales');
  gauge('scales', [WX1 - 6.5, 0, WZ0 + 3.5]);
  // the keepers' door, and the short passage from it to the hall's east gate
  K.corridor([HALL.x1 + 0.6, RUN.z], [WX0 - 0.6, RUN.z], 0, DOOR);
  add(Door, { id: 'dS', at: [WX0 - 0.6, 0, RUN.z], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'eS' }] });

  // ---- the cold passage under the furnace (the ante), behind the Founders' Door: its mark by the founder's door
  K.corridor([0, A0 - 0.6], [0, A1], 0, DOOR);
  // shelves of cooled moons, cracked, along its walls
  for (let z = A0 + 5; z < A1 - 8; z += 7) for (const s of [-1, 1]) { K.both(iron, box(0.6, 0.15, 3, s * 3.4, 1.6, z)); crackedMoon(s * 3.35, 2.05, z - 0.8, 0.35); crackedMoon(s * 3.4, 2.0, z + 0.7, 0.28); }
  add(Mark, { room: 'ante', at: [2.0, 0, A1 - 6], yaw: -Math.PI / 2 });
  gauge('ante', [-2.6, 0, A0 + 3]);
  add(Door, { id: 'dA', at: [0, 0, A1], ...DOOR, frame: { side: 1.2 } });   // (frame: the gap it stands in is wider than the door, issue #356)

  // ---- the Last Casting (a rotunda): the founder's floor, its casting cradle and the iron moon by the west wall
  K.rotunda({ x: 0, z: CW, y: 0, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0.3 });
  K.add(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, 0.25, CW]));
  K.add(ember, T(annulus(9.2, 9.4, 0.06, 64), [0, 0.27, CW]));
  for (const a of [0.7, 2.0, 4.3, 5.6]) crackedMoon(Math.sin(a) * (HR - 2.2), 1.0, CW + Math.cos(a) * (HR - 2.2), 1.0, true);
  groove([-16.6, 0, CW], [-9.6, 0, CW], 1.3);
  add(Ball, { id: 'mA', a: [-16.6, 0.04, CW], b: [-9.6, 0.04, CW], r: 1.3, heavy: 'magnet', iron: true, heavyLine: HEAVY, friction: 1.2 });
  add(Plate, { id: 'pA', at: [-9.6, 0, CW], r: 1.5 });
  cradle(K, iron, -9.6, 0, CW, 1.6, 6);
  const XZ = CW + HR + 10;
  add(Door, { id: 'd5', at: [0, 0, CW + HR + 0.7], ...DOOR, frame: { side: 1.2 } });
  K.corridor([0, CW + HR + 0.6], [0, XZ], 0, DOOR);
  K.wall(4.6, XZ, -4.6, XZ, 0, DOOR.h, { t: 0.8, holes: [{ at: 4.6, w: 3.4, h: 5 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 0, XZ + 0.5]));
  K.solid(box(4, 5, 0.1, 0, 2.5, XZ + 0.5));

  const model = founderModel();
  model.pos.copy(K.world(0, 0, CW + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 0, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 0, CW), r: HR, y: K.world(0, 0, 0).y };

  // (the wing last: its mark after the others, so the machines' ids by mark stay as they were)
  sandRoom(rt, K, M, { iron });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(MX - MW / 2 - 2, -4, SAND.z - SAND.d / 2 - 2), V(WX1 + 2, HALL.h + 2, CW + HR + 12)),
    gadget: { at: W(SX, UP + 0.62, TZ).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 0.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 12, 28, 30], [0, 14, 56, 30], [0, 18, 82, 26], [-18, UP + 5, 66, 20], [18, UP + 5, 66, 20], [MX, 9, MZ, 26], [SAND.x, 8, SAND.z, 24],
      [SX, 12, S0 + 9, 18], [SX, UP + 6, TZ, 24], [3, UP + 6, TZ, 22], [FXc, UP + 7, TZ, 30], [28, UP + 6, TZ, 22], [13, UP - 6, TZ, 18], [FAR, UP + 4, 78, 16],
      [WX, 12, WZ, 32], [0, 4, (A0 + A1) / 2, 30], [0, 12, CW, 30]],
    guardian: { def: { ...LAST_FOUNDER, onHit: founderHit, openFor: founderOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Casting-House under the hangar's roof
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 9, sill = 0.3;
  const base = level.ground?.heightAt ? level.ground.heightAt(SITE.x, SITE.z) : 0;
  const K = new TempleKit(rt.root, 'The Casting-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M;
  const iron = { paint: new THREE.Color('#3f393a'), smooth: false, side: THREE.FrontSide };
  const rust = { paint: new THREE.Color('#b5653a'), smooth: false, side: THREE.FrontSide };
  const ivory = { paint: new THREE.Color('#efe6d2'), smooth: true, side: THREE.FrontSide };
  K.both(M.floor, new THREE.CylinderGeometry(R + 9, R + 9.4, .6, 40).scale(1, 1, .75).translate(0, sill - .3, 0));
  landmark(K, 'moonfoundry', { y: sill, R });
  // The broad right-hand jib carries the same story hook and its rising moon.
  const hook = V(38, sill + 36, -1);
  K.add(iron, box(.16,4,.16,hook.x,hook.y-2,hook.z));
  K.add(iron,T(new THREE.TorusGeometry(.6,.12,6,18,Math.PI*1.4),[hook.x,hook.y-4.2,hook.z],[0,0,2.4]));
  const z1 = R + 2.6;
  // (the drawing's great round dark door, framed twice in the drum's blue iron, ivory light: src/temples/portal.js)
  const P = portal(K, { y: sill, z: R + .3, w: 7.4, h: 11, shape: 'round', layers: 2, step: .8, recess: .6, back: 1.5, into: 2,
    frame: lmMetal('#3b4969', 'iron'), inlay: '#fff1cf' });
  // Petra's ledger desk by the door, under a little tin roof; two cracked moons lying on the apron
  const dx = -(R + 3.0), dz = 3.2;
  K.both({ paint: new THREE.Color('#8a5a3a'), smooth: false, side: THREE.FrontSide }, box(2.2, 0.15, 1.0, dx, sill + 1.0, dz));
  for (const [x, z] of [[dx - 0.9, dz - 0.35], [dx + 0.9, dz - 0.35], [dx - 0.9, dz + 0.35], [dx + 0.9, dz + 0.35]]) K.add(iron, box(0.1, 1.0, 0.1, x, sill + 0.5, z));
  K.add(ivory, T(new THREE.BoxGeometry(0.9, 0.12, 0.65), [dx, sill + 1.14, dz], [0, 0.2, 0]));
  K.add(M.dark, T(new THREE.BoxGeometry(0.06, 0.13, 0.64), [dx, sill + 1.15, dz], [0, 0.2, 0]));
  for (const [x, z] of [[dx - 1.4, dz + 1.5], [dx + 1.4, dz + 1.5]]) K.both(iron, box(0.14, 2.8, 0.14, x, sill + 1.4, z));
  K.add({ paint: new THREE.Color('#7f93a3'), smooth: false, side: THREE.DoubleSide }, T(new THREE.BoxGeometry(3.6, 0.1, 3.4), [dx, sill + 2.85, dz + 0.4], [0.18, 0, 0]));
  for (const [a, d, r] of [[2.3, R + 5.5, 1.3], [-2.6, R + 6.2, 1.0]]) {
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    K.both(ivory, new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI * 0.6).translate(x, sill - r * 0.3, z));
    K.add(M.dark, T(new THREE.TorusGeometry(r * 0.95, 0.05, 3, 20), [x, sill + r * 0.2, z], [0.4, a, 0.3]));
  }
  K.flush();

  // the lit slits round the tower's top course, and the chimney's mouth: a pour's glow (the change makes it steady)
  const glowM = makeMaterial({ color: '#f08a3c', glow: 0.4, flat: true, key: 'temple.moonfoundry.slits' });
  const slits = [];
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; slits.push(T(new THREE.BoxGeometry(0.5, 1.6, 0.1), [Math.sin(a) * (R + 0.06), sill + 18, Math.cos(a) * (R + 0.06)], [0, a, 0])); }
  slits.push(box(1.1, 16, 0.12, 0, sill + 35, 4.6));
  const sm = new THREE.Mesh(mergeAll(slits), glowM);
  sm.position.copy(K.world(0, 0, 0)); sm.rotation.y = yaw;
  sm.userData.noCollide = true; sm.userData.dynamic = true;
  rt.root.add(sm);
  const at = K.world(0, sill, R + 1.4);
  const front = K.world(0, sill, R + 10);
  return { door: { at, heading: yaw, ...P.door }, kit: K, R, sill, glowM, hook: K.world(hook.x, hook.y - 4.2, hook.z), foot: K.world(hook.x, sill, hook.z),
    clear: [{ x: SITE.x, z: SITE.z, r: R + 8 }, { x: front.x, z: front.z, r: 7 }] };
}

function mergeAll(list) {
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const q0 of list) { const q = q0.index ? q0.toNonIndexed() : q0; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ the world change: one moon, whole
/** The change's timing (s): the whole moon's lift to the hook (on its own, and filmed), the hung moons' turn, and how long
 *  it waits for the climax to film them (src/story/moonfoundry-moments.js calls show()) before it goes on unfilmed. */
export const CHANGE = { lift: 8, liftFilmed: 5, turn: 14, wait: 40 };
/**
 * Once the Last Founder is stopped, the one moon it cast whole is lifted out of the Casting-House and hangs from the
 * jib over the door, turning slowly; every hung moon over the floor turns once round on its crown, slowly, and comes to
 * rest facing the house again (issue #295: "every hung moon turns to it", told and never shown); the slits round the
 * tower's top and the chimney's mouth glow steady (until then they flicker, and at night they flare as the house pours
 * by itself). The lift and the turn wait for the climax's film (show(), turn()), or CHANGE.wait s.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Casting-House’s whole moon (the world change)';
  rt.root.add(root);
  root.visible = false;
  let moon = null;
  if (O) {
    moon = new THREE.Group();
    const shell = makeMaterial({ color: '#efe6d2', flat: true, key: 'temple.moonfoundry.newmoon' });
    const seam = makeMaterial({ color: '#f2a057', glow: 0.5, flat: true, key: 'temple.moonfoundry.newseam' });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 14), shell);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.06, 4, 32).rotateX(Math.PI / 2), seam);
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 4, 12), makeMaterial({ color: '#3f393a', flat: true, key: 'temple.moonfoundry.bail' }));
    bail.position.y = 1.9;
    moon.add(m, ring, bail);
    moon.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    root.add(moon);
  }
  // the hung moons (src/levels/moon-foundry.js hungMoons), each facing the house; the turn is one round on top of that
  const hung = (level?.hungMoons ?? []).map((h) => {
    const toHouse = O ? Math.atan2(O.door.at.x - h.at.x, O.door.at.z - h.at.z) : 0;
    h.group.rotation.y = toHouse;
    return { ...h, yaw: toHouse };
  });
  let k = 0, want = 0, lift = 0, liftDur = CHANGE.lift, lifting = false, turn = 0, turning = false, waited = 0;
  const from = V(), to = V();
  const apply = () => { root.visible = k > 0.01; };
  const place = (t) => {
    if (moon && O) {
      const e = lift * lift * (3 - 2 * lift);
      moon.position.lerpVectors(from.copy(O.foot).setY(O.foot.y + 1.8), to.copy(O.hook).setY(O.hook.y - 2.3), e);
      moon.rotation.y = t * 0.15;
    }
    const e = turn * turn * (3 - 2 * turn);
    for (const h of hung) h.group.rotation.y = h.yaw + e * Math.PI * 2;
  };
  return {
    root, moon, hung,
    get on() { return want === 1; },
    set(on, { instant = false } = {}) {
      want = on ? 1 : 0;
      if (instant) { k = want; lift = turn = want; lifting = turning = false; apply(); place(0); }
      if (!on) { lift = turn = 0; lifting = turning = false; waited = 0; place(0); }
    },
    /** The climax's film: the whole moon lifted to the hook now, over CHANGE.liftFilmed s (true if it still had to be). */
    show() { if (!want || lift >= 1 || lifting) return false; lifting = true; liftDur = CHANGE.liftFilmed; return true; },
    /** ...and the hung moons' turn, now. */
    turn() { if (!want || turn >= 1 || turning) return false; turning = true; return true; },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 2 : -dt), 0, 1); apply(); }
      if (want && (waited += dt) > CHANGE.wait) { if (lift < 1) lifting = true; if (turn < 1) turning = true; }
      if (lifting && lift < 1) lift = Math.min(1, lift + dt / liftDur);
      if (turning && turn < 1) turn = Math.min(1, turn + dt / CHANGE.turn);
      place(t);
      if (!O) return;
      // the glow: flickering, flaring at night as it pours; steady once the founder is stopped
      const night = rt.isNight?.() ?? false;
      const g = want ? 0.55 + 0.05 * Math.sin(t * 0.8) : (night ? 0.5 : 0.25) + (night ? 0.4 : 0.15) * Math.max(0, Math.sin(t * 3.1) * Math.sin(t * 7.7));
      O.glowM.uniforms.uGlow.value = g;
    },
  };
}

export const MOONFOUNDRY_TEMPLE = {
  id: 'moonfoundry', levelId: 'moonfoundry', name: 'The Casting-House', doorLabel: 'door of the Casting-House',
  gadget: 'magnet', gadgetBox: 'moonfoundry.temple.tongs', arenaDoor: 'dA', arenas: ARENAS,   // (the box's id from when it held the tongs: the saves' flag)
  origin: [-50, 1600, -180], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (inside, its futuristic look, after the author's picks: src/temples/skins/casting-house.js; issue #342)
  skin: castingHouseSkin,
  local: { person: 'ilse', out: 8, side: 6 },
  enterLine: 'Inside the Casting-House the air is hot and smells of iron. Ahead, a great crucible pours into the floor.',
  pitLine: 'You climb back out of the channel, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, a whole small moon is lifted out and hung from the jib.', 'resolved.out'); },
  /**
   * (issue #562) One moon cast: the iron moon in the cradle takes the Founder's last pour, glows white-hot from within and
   * cools back to iron (rt.calmK: its ending pours it in its own panel; at rest it is iron again).
   */
  onCalm(rt, k) {
    const M = rt.piece('mA')?.ironM?.uniforms;
    if (!M?.uColor || (k >= 1 && rt.moonCooled)) return;   // (cooled once: the moon's own heat after that is its own)
    rt.moonCooled = k >= 1;
    const h = k >= 1 ? 0 : Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.1)), 0.7);
    M.uColor.value.set('#3d3a40').lerp(HOT, h);
    if (M.uGlow) M.uGlow.value = 0.95 * h;
  },
  onLit(rt, id) {
    if (id === 'bH') rt.notice(rt.logic.check(POURED) ? 'The hot moon fills the mould.' : 'The hot moon fills the mould. The bridge waits for the pour.', 'bH.lit');
  },
  // the founder's heart: a target while its crucible doors are open; a splash there quenches it. From its second phase a
  // whole moon in its casting cradle makes it stop to look (a splash counts twice); in its last only then does the water
  // take, and as it shifts into that phase it tips the moon out of the cradle
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const cradled = () => rt.logic.drumOn('mA', 'pA');
    rt.founderCradled = cradled;
    const at = V();
    rt.quench = () => {
      if (G.state !== 'open') { rt.notice('Its crucible doors are shut. Wait for it to pour, and open.', 'lf.shut'); return false; }
      const p = G.phaseIndex;
      if (p >= 2 && !cradled()) {
        rt.sound?.critter?.('clank', 0.6);
        rt.notice('The water hisses off its heart: too hot. Put a whole moon in its cradle.', 'lf.hot');
        return false;
      }
      const k = p === 0 ? QUENCH.first : p === 1 ? (cradled() ? QUENCH.cradled : QUENCH.free) : QUENCH.last;
      if (p >= 1 && cradled()) rt.notice('It stops to look at the whole moon. The water takes it in the heart.', `lf.cradled.${p}`);
      rt.sound?.critter?.('clank', 0.9);
      G.add(k, 'quench');
      rt.rumble(0.6, 0.45);
      if (G.state === 'open') { G.enter('fight'); G.cool = 1.6; }
      return true;
    };
    rt.offs.push(registerTarget({ kind: 'sentinel', radius: 1.1, position: () => G.model.vent(0, at), enabled: () => G.state === 'open', onHit: (mode) => { if (mode !== 'push') rt.quench(); return true; } }));
    let lastPhase = G.phaseIndex;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.phaseIndex !== lastPhase) {
        lastPhase = G.phaseIndex;
        const b = rt.piece('mA');
        if (G.phaseIndex === 2 && b && cradled()) {
          b.t = 0.3; b.v = 0; b.rest = true; b.place(); rt.logic.moveDrum('mA', 0.3);
          rt.notice('It shakes as it shifts, and its tongs tip the moon out of the cradle.', 'lf.tip');
          rt.rumble?.(0.8, 0.5);
        }
      }
    };
  },
};
