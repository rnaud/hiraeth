import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, sector } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Bridge, Vane, Mark, Pit, Updraft, WingAir, Key, HookBell, Coffer } from './pieces.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { sentinelModel } from './guardians.js';
import { items } from '../items.js';
import { t as tr } from '../i18n.js';
import { EN } from '../i18n/en.js';
import { registerTarget } from '../targets.js';
import { chestMound } from '../boxes/mound.js';
import { wardensWellSkin } from './skins/wardens-well.js';
import { Clock, GlyphFloor } from './trials.js';

// The City-Shaft's temple: the Warden's Well, the makers' tower on the rim,
// round from the ship. Nobody in the city goes in: the rim calls it a folly,
// the bottom says the makers built it to keep the shaft breathing. Inside it
// goes up, not down: a well of the makers turned on its end, room over room.
// Something still walks its top hall, round and round: the warden the makers
// left to keep the shaft's breath, broken since the night the sky rang. It is
// a machine: you may stop it for good.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: THE TOWER BREATHES
// THROUGH ITS VANES (reworked from the temple design audit, v1.19). The makers built it to keep the shaft breathing,
// and the breath turned the vanes of their bellows, and the vanes turned the tower's machines. The warden stopped the
// breath. A vane still drives its machine, but only while it turns: a splash spins a small one a while, slowing; a
// great one is too heavy for a splash, and turns only under a steady wind. With the makers' bellows on your back and
// your wings open, you are the wind (v1.42: the bellows replace the Warden's harness, the City-Shaft's own jets; the
// thin breath still rising through each great vane's frame bears open wings and holds you over it, and rising air
// holds you still enough to aim).
// Since v1.83 (issue #413, docs/design/temple-best-practices.md) THE HOUSE'S BREATH is its one state, set at a lever by
// every hub (the Climb's floor, the Well's gallery, loft and crown): it breathes OUT, the air rising through every vane,
// or IN, the air drawn down. Out, the draughts rise (the plinth's up the Well, through every floor it is let on to) and
// the Vane Room's breath-stones stand in its chasm; in, the draughts die, and the crown's ring hangs down on its chain
// within the hook's reach. A gauge in every room shows it: rings of light drifting up (out, cyan) or down (in, amber).
//   the Threshold          the first mark, the way back out
//   the Turning Floors     a drop crossed on two riding discs, each riding only while its own small vane turns: the
//                          one on the pillar by the island and the one high on a pillar by the far ledge. Splash both, and
//                          go before they slow (the vane, taught where failing costs a wait; and two at once)
//   the Climb              a round well, the hub: climb its wall to the balcony. The stone ball's groove there crosses a
//                          slot whose stones stand only while the vane in the well's floor, far below, turns: splash it,
//                          then roll the ball over the slot onto its plate, and the small key's cage beside it sinks.
//                          Two doors take a small key each (G3c, a choice: which first): the balcony's north door to the
//                          Bellows Chamber and the east way's door to the Vane Room; the other key is the Ash Store's
//   the Ash Store          (west, an arena) the tower's old ash banked by its walls; its door shuts behind you while its
//                          keepers stand; won, its small key and the bridge pen
//   the Vane Room          (east, behind its door) a chasm 17 m across, wider than the pen draws: while the house
//                          breathes out its breath-stones stand in the middle, and a plank drawn to them and one on to
//                          the far floor. There the great key's cage, and a great vane in the floor too heavy for a
//                          splash: with the fan, come back (the gust turns it, and while it turns, and the house
//                          breathes out, the cage sinks)
//   the Bellows Chamber    the makers' chest: the GUST FAN (src/gadgets/fan.js; issue #377: the Warden's bellows were here;
//                          room id 'jets', from when it held the jets). Lifting them out unstops the plinth: while the
//                          house breathes out, a draught rises up through the oculus in the ceiling, the only way on
//   the Well               (G4, the great hall: the gallery, the loft and the crown, one drum 36 m across, its floors rings
//                          round an open core, the plinth 57 m under the crown's rim) the gallery's eye over the west
//                          shelf, hidden from the floor, its stone lids shut: they lift only while the great vane in the
//                          floor turns, and that is too heavy for a splash. The fan's gust turns it; splash the eye from
//                          the air: the draught rises on to the loft (while the house breathes out)
//   the loft               a raised walk on piers round the core, its ball, a gap whose stones stand only while the loft's
//                          great vane turns: hover over the vane, and push the ball across from the air; on its plate the
//                          draught rises on to the crown and past it
//   the crown              its eye's lids lift only while two things at once (G2: the house's tool and an older one): the
//                          ring that hangs from the crown's wall only while the house breathes in, tugged with the hook
//                          (it holds one lid up a while), and the great vane in its floor, fanned. Then the house breathes
//                          out again, and the draught carries you to the high ledge and the high door (the great key)
//   the Flue               (the fast way back, G6) the tower's old breath-way, a round shaft outside the Well's west wall
//                          from the crown down to its foot at the Bellows Chamber's floor: step off the crown's doorway
//                          (or the gallery's) and its breath breaks the fall; the valve at its foot opens from the flue's
//                          side only, into the Bellows Chamber. Through the core, a drop from the crown or the loft lands
//                          soft on the gallery's floor
//   the Warden's Hall      the sentinel (a robot: its meter is damage). It beams and slams; its side vents open after
//                          a beam: shoot them. Then it guards its sides and only the hatch on its crown is open: get
//                          above it (the breath over the hall's four vanes holds open wings) and shoot down; over a
//                          turning vane the draught holds the hatch wide (a hit counts twice). In its last phase it
//                          keeps the hatch shut against still air: when it backs onto a vane, hover over the vane
//                          until its draught lifts the hatch, and shoot down into it
// After: the warden's hum stops, and the shaft's old breath comes back: a column of rising air from
// the bottom terrace to the rim, beside the Upward Shrine, that carries anyone up (the world change).
//
// Since v1.77 (issue #336, docs/design/temple-redesign.md) the rooms are shrines': the Turning Floors 30 m across, the
// Climb, the gallery's drum and the Flue round halls 34 to 36 m across, the wings 30 m square, the gallery and the loft
// 17 m high each (ROOMS, VANES), every door 7 by 9 (ROOMS.door). Each puzzle stands in the middle of its room: the
// Turning Floors' vanes on pillars in the drop, the Vane Room's great vane in its far floor, the two lidded eyes on pillars
// in the drum's floors, the loft's ball on a raised walk over its floor, the crown's ring over its floor. The rooms are
// tagged with their kind (LOGIC.rooms): the Ash Store is the house's one fight (its machines round its middle, four
// columns to fight round); none stand by a puzzle.
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The tower on the rim (world x, z), its door toward the ship. */
export const SITE = { x: 322, z: -80, r: 22 };
SITE.heading = Math.atan2(274 - SITE.x, 0 - SITE.z);
/** The shaft's breath once the warden is stopped: a rising column from the bottom terrace to the rim. */
export const BREATH = { a: 2.85, r: 197, bottom: -290, top: 200, R: 260, radius: 4.5 };

/**
 * The well's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/wardens-well):
 * cream stone in big smooth blocks, banded in the makers' steel blue (a course under every frieze, gold glyphs on it, and
 * at the foot), cream floors, lit slit windows over the friezes; its shade a soft lavender blue that keeps the cream
 * (the shaft's world prints its shade flat in blue, and turned the house blue with it), its light warm.
 */
export const PALETTE = {
  wall: '#efe4cc', wall2: '#e9dcc1', wall3: '#f5eddb', floor: '#e4d9bf', floor2: '#d6c9ac', trim: '#f3ead8',
  dark: '#34405e', stone: '#7d93c4', accent: '#3f5a9e', glow: '#9fdcef', glyph: '#e8c060', lamp: '#f6c84e', sand: '#cdb38e', sand2: '#c9b596',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.9, shade: 0.45 },
    wall: { mode: 0, grid: 4.4, plates: true },
    glyph: { glow: 0.45 },
  },
  bands: [{ at: 0.72, h: 1.4, color: '#7d93c4' }, { y: 0.4, h: 0.8, color: '#6f86ba' }],
  ornament: { kind: 'window', color: '#fff0c8', glow: 0.75 },
  light: { shadow: '#bdb6d6', light: '#fff2dc', sun: '#fff0d0' },
};

/**
 * The vanes: how long a splash spins a small one (s: the Turning Floors' across both discs, the Climb's over the
 * slot), how far over a great one the bellows' wash turns it (m); the gallery's ceiling over its floor, the loft's shelf
 * over the ceiling, the crown's floor over the gallery's (m) and the core's holes (issue #413: open for good, the loft's
 * wider than the crown's, so a drop from the crown's rim falls clear to the gallery's floor); `breath`: how high the thin
 * breath through a great vane rises (m: it bears open wings and holds you over the vane, within its reach); `ring`: how
 * long the crown's ring holds one of its eye's lids up once tugged (s).
 */
export const VANES = { floors: 15, climb: 14, reach: 9.5, ceil: 17, shelf: 6, iris: 7.2, crown: 34, iris2: 7, breath: 9, wing: 12, ring: 14 };
/**
 * The rooms (issue #336, docs/design/temple-redesign.md; local m): the Turning Floors' width (its depth 33.4 as it was,
 * so the discs ride as they did), the Climb's round well (its middle's z, radius, height), the wings' halls (30 m
 * square, 18 m high), the Bellows Chamber (a chest's round hall: 20 m across), the Well's drum of the gallery, the loft
 * and the crown (its radius; the floors over each other VANES.ceil and VANES.crown; since issue #413 tall enough for the
 * high door 16 m over the crown), the Flue's radius; every door between two rooms 7 by 9.
 */
export const ROOMS = { turning: { w: 30 }, climb: { z: 66.6, r: 17, h: 28 }, wing: { w: 30, d: 30, h: 18 }, chest: { z: 97.4, r: 10 }, drum: { r: 18, h: VANES.crown + 30 }, flue: { r: 17.5 }, door: { w: 7, h: 9 } };
/**
 * The Climb's block (issue #336, local m off the well's middle): its straight face's z (north of the middle, so the vane
 * at its foot is within 20 m of the door it opens), the balcony's groove's z.
 */
export const CLIMB = { face: 6, groove: 9.4 };
/**
 * The gallery's floor, the loft's and the crown's (over the gallery's), the high door's and the Warden's Hall's (local y:
 * since issue #413 16 m over the crown, out of reach of its great vane's breath: the Well's draught carries you up to it).
 */
export const FLOORS = { gallery: 34.6, loft: 34.6 + VANES.ceil, crown: 34.6 + VANES.crown, hall: 34.6 + VANES.crown + 16 };
/**
 * The Flue (issue #23's last round; since issue #413 the fast way back, local m): its middle (x, outside the drum's west
 * wall; z the gallery's), radius, its foot (y: the Bellows Chamber's floor), the doorways' width, the landing by the
 * crown's doorway (from x off the middle, half its depth).
 */
export const FLUE = { x: -(ROOMS.drum.r + ROOMS.flue.r + 2), r: ROOMS.flue.r, foot: 11, door: ROOMS.door.w, landing: { x0: 5, half: 4.5 } };
export const HALL = { vane: 10, reach: 13, near: 8, back: 5, drift: 2.2, hit: 0.125, washed: 0.25, open: [null, 5.5, 7], breath: 10 };

// ------------------------------------------------------------------ the house's breath (issue #413, G1)
/** The house breathes out (the air rising through every vane) or in (drawn down): LOGIC `breath`, a drum of two stops. */
export const OUT = { drumOn: ['breath', 'breathOut'] }, IN = { drumOn: ['breath', 'breathIn'] };
/** Its look: the gauges' rings and the levers' knobs, cyan while it breathes out, amber while it breathes in. */
export const BREATH_LOOK = { out: '#6fe9f6', in: '#f2a65a', glow: 0.8, rise: 0.9 };
/**
 * A lever by every hub (local: its foot, the way it faces): the Climb's floor, and the Well's gallery, loft and crown,
 * each by the room's way in or its mark.
 */
export const LEVERS = [
  { id: 'lever.climb', room: 'climb', at: [-7.5, 0, ROOMS.climb.z + 1.2], yaw: Math.PI },
  { id: 'lever.vane', room: 'vaneFar', at: [49, 0, 70], yaw: -Math.PI / 2 },   // (and on the Vane Room's far floor: no walk back for it)
  { id: 'lever.gallery', room: 'gallery', at: [5, FLOORS.gallery, ROOMS.chest.z - 12.5], yaw: Math.PI },
  { id: 'lever.loft', room: 'loft', at: [-3.5, FLOORS.loft, ROOMS.chest.z - 12.5], yaw: Math.PI },
  { id: 'lever.crown', room: 'crown', at: [3, FLOORS.crown, ROOMS.chest.z - 12.5], yaw: Math.PI },
];
/** The crown's ring (local): where it hangs while the house breathes in, the sleeve it is drawn up into, where it is hooked from. */
export const RING = { at: [-9.4, FLOORS.crown + 8, ROOMS.chest.z - 3], sleeve: FLOORS.crown + 15.5, from: [-5.5, FLOORS.crown, ROOMS.chest.z - 7.5] };
/**
 * The Vane Room since issue #413 (local x across the room, off the hub's way): the near floor's end and the far floor's
 * start (the chasm between, 17 m: wider than the pen's longest plank), the breath-stones' pier in its middle (x0, x1, its
 * width along z), the great vane in the far floor and the great key's cage (x, z off the room's middle).
 */
export const VANE_ROOM = { near: 25, far: 42, pier: [31, 36, 9], vane: [44.4, 5.5], key: [48, -6] };

/**
 * (issue #660, the test of the makers' clock and the teach of the glyph floor: docs/design/temple-puzzles.md) The Wind
 * Clock, east off the Well's gallery (local; z about the chest's middle, C3 = 97.4): four glyph tiles on its near floor and
 * a panel on its south wall showing three of them in turn; stepped in that order, the stone lids over the clock's eye lift.
 * Only the fan's gust wakes it (a ring of little vanes round it), and it runs `hold` s: while it runs a bridge of light
 * stands over the chasm (18 m: no running jump, double jump and glide in a house carries so far, tests/wings-reach.js) to the far ledge and its coffer. The gust reaches 9 m,
 * so you gust it from the lip and run. The bridge never sinks under you; once the coffer is had it stands for good.
 */
export const WIND_CLOCK = {
  hall: { x0: 24, x1: 62, z0: 97.4 - 17, z1: 97.4 + 17, pit: 8 }, lip: 40, far: 58, bridge: 88.5, hold: 6,
  eye: [34, 106.5], tiles: [[32, 93, 'tri'], [37, 95, 'ring'], [32, 101, 'square'], [37, 103, 'hex']], order: [2, 0, 3],
};
/** (issue #630) The map's display on the Vane Room's near ledge (local m): x the middle of the 1.6 m border band between
 *  the west wall (21) and the floor's inlay; z the middle of a row of the hall’s 3.2 m plates, 11.2 m north of the door, off the way to the pier. */
export const MAP_LEDGE = { x: 21.8, z: ROOMS.climb.z + Math.cos(Math.PI / 2 + 0.4) * ROOMS.climb.r + 3.5 * 3.2 };

export const LOGIC = {
  id: 'incal', entry: 'threshold', gadget: 'fan',
  // (each room's kind, issue #336: src/foes.js puts machines only in the combat room, the Ash Store)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, turning: { checkpoint: true, kind: 'puzzle' }, climb: { checkpoint: true, kind: 'puzzle' },
    store: { checkpoint: true, kind: 'combat' }, vane: { checkpoint: true, kind: 'passage' }, vaneFar: { kind: 'puzzle' }, jets: { checkpoint: true, kind: 'chest' },
    gallery: { checkpoint: true, kind: 'puzzle' }, loft: { checkpoint: true, kind: 'puzzle' }, crown: { checkpoint: true, kind: 'puzzle' },
    ledge: { checkpoint: true, kind: 'passage' }, flue: { checkpoint: true, kind: 'passage' }, warden: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
    // (issue #660) the Wind Clock off the gallery, and the far ledge over its chasm: a side room, for a reward
    clock: { checkpoint: true, kind: 'puzzle' }, clockFar: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'turning' },
    { a: 'turning', b: 'climb', door: 'discs' },    // the riding discs, each only while its own small vane turns
    // the Climb is the hub (v1.48): west the Ash Store (an arena); since issue #413 two doors that take a small key each,
    // the balcony's north door to the Bellows Chamber and the east way's to the Vane Room (G3c: a choice, which first)
    { a: 'climb', b: 'store', door: 'dW' },         // (open: it shuts behind you while its keepers stand)
    { a: 'climb', b: 'vane', door: 'dV' },
    // (issue #375: the bridge pen is earned in the Ash Store; issue #413: the chasm wider than one plank, the breath-stones
    // in its middle while the house breathes out: a plank to them, one on)
    { a: 'vane', b: 'vaneFar', door: 'stones', needs: ['bridge'] },
    { a: 'climb', b: 'jets', door: 'd1' },
    { a: 'jets', b: 'gallery', door: 'rise', needs: ['fan'] },   // up through the oculus, on the draught the chest unstops, while the house breathes out
    { a: 'gallery', b: 'clock' },                    // (issue #660) east off the gallery's floor: the Wind Clock
    { a: 'clock', b: 'clockFar', door: 'bW' },       // over its chasm on the bridge of light, while the clock runs
    { a: 'gallery', b: 'loft', door: 'iris', needs: ['fan'] },   // the draught on to the loft: the eye whose lids the great vane lifts
    { a: 'loft', b: 'crown', door: 'iris2', needs: ['fan'] },    // and on to the crown: the ball pushed over the gap from the air, over the loft's vane
    { a: 'crown', b: 'ledge', door: 'lift', needs: ['fan'] },    // and past it to the high ledge, while the house breathes out (16 m over the crown)
    { a: 'ledge', b: 'warden', door: 'd3' },         // the eye whose lids lift only while the ring and the great vane at once, and the great key
    // (G6, issue #413: the ways down. Through the core's open holes a drop lands soft on the gallery's floor; the Flue is the
    // fast way back, from the crown's doorway or the gallery's down to its foot and through its valve into the Bellows
    // Chamber, a door that opens from the flue's side only)
    { a: 'ledge', b: 'crown', oneWay: true },
    { a: 'crown', b: 'gallery', oneWay: true },
    { a: 'loft', b: 'gallery', oneWay: true },
    { a: 'crown', b: 'flue', oneWay: true },
    { a: 'gallery', b: 'flue', oneWay: true },
    { a: 'flue', b: 'jets', oneWay: true },
    { a: 'warden', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Turning Floors: two small vanes (a splash spins one a while), the near disc rides while the one on the island's
    // pillar turns, the far disc while the one on the far pillar does
    v1: { type: 'vane', room: 'turning' },
    v1b: { type: 'vane', room: 'turning' },
    discs: { type: 'bridge', opens: { all: [{ lit: 'v1' }, { lit: 'v1b' }] } },
    // the Climb: the vane in the well's floor stands the slot's stones; the ball over them onto its plate sinks the cage of
    // a small key beside it, while the vane still turns (the ball's weight: you alone are not enough)
    v2: { type: 'vane', room: 'climb' },
    slot: { type: 'bridge', opens: { lit: 'v2' } },
    ball1: { type: 'drum', room: 'climb', plate: 'p1', plateAt: 1, start: 0, gap: 'slot' },
    p1: { type: 'plate', room: 'climb' },
    kC: { type: 'key', kind: 'small', room: 'climb', when: { all: [{ drumOn: ['ball1', 'p1'] }, { lit: 'v2' }] } },
    dV: { type: 'door', lock: 'small' },
    d1: { type: 'door', lock: 'small', opens: OUT, latch: true },   // (its leaves the bellows' own: the out-breath opens them, and once open they stay)
    // the Ash Store: its keepers beaten, the small key's cage sinks
    arW: { type: 'arena', room: 'store' },
    kW: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arW' } },
    dW: { type: 'door', opens: null },
    // the Ash Store's prize, won: the bridge pen in its chest (issue #375: in the City-Shaft's makers' court before)
    pen: { type: 'find', room: 'store', item: 'bridge', box: 'incal.bridge', when: { lit: 'arW' } },
    // the Vane Room: the breath-stones in the chasm's middle stand while the house breathes out; on the far floor the great
    // key's cage sinks while the great vane by it turns (the fan) and the house breathes out
    stones: { type: 'bridge', opens: OUT },
    vR: { type: 'vane', room: 'vaneFar', needs: ['fan'] },
    kG: { type: 'key', kind: 'big', room: 'vaneFar', when: { all: [{ lit: 'vR' }, OUT] } },
    // (issue #377: the chest held the Warden's bellows, a wash off open wings for the great vanes only; the gust fan now, whose
    // gust turns them from the floor or the air, and lifts you over them; the bellows wait in Lorn's makers' court)
    chest: { type: 'gadget', room: 'jets', item: 'fan' },
    rise: { type: 'door', opens: OUT, latch: true },
    // the gallery: the great vane (only the fan's gust turns it) lifts the lids of the eye over the west shelf; woken, the
    // draught rises on to the loft while the house breathes out
    vG: { type: 'vane', room: 'gallery', needs: ['fan'] },
    s2: { type: 'switch', room: 'gallery', when: { lit: 'vG' } },
    iris: { type: 'door', opens: { all: [{ lit: 's2' }, OUT] }, latch: true },
    // the loft: the great vane stands the gap's stones; the ball pushed over them (from the air) onto its plate while it
    // turns, and the draught rises on to the crown (and stays let on: the Well's ways, once made, latch; a lever by every
    // floor lets the house breathe out again)
    vE: { type: 'vane', room: 'loft', needs: ['fan'] },
    span: { type: 'bridge', opens: { lit: 'vE' } },
    ball3: { type: 'drum', room: 'loft', plate: 'p3', plateAt: 1, start: 0, gap: 'span' },
    p3: { type: 'plate', room: 'loft' },
    iris2: { type: 'door', opens: { all: [{ drumOn: ['ball3', 'p3'] }, { lit: 'vE' }, OUT] }, latch: true },
    // the crown (G2, issue #413): the eye by the high ledge lifts its lids only while the ring is tugged (the hook: it hangs
    // in reach only while the house breathes in, and holds one lid up VANES.ring s) and the great vane in its floor turns (the
    // fan). Then the house breathes out again, and the draught carries you to the high ledge
    rS: { type: 'bell', room: 'crown', needs: ['hook'], hold: VANES.ring },
    vC: { type: 'vane', room: 'crown', needs: ['fan'] },
    s4: { type: 'switch', room: 'crown', when: { all: [{ lit: 'rS' }, { lit: 'vC' }, IN] } },
    lift: { type: 'door', opens: { all: [{ open: 'iris2' }, OUT] }, latch: true },
    d3: { type: 'door', lock: 'big', opens: { lit: 's4' }, latch: true },
    // the hall's four vanes: in its last phase its hatch opens only to one's draught (the fight's own steps)
    warden: { type: 'boss', room: 'warden', needs: ['gun', 'fan'], requires: { any: [0, 1, 2, 3].map((i) => ({ lit: `vh${i}` })) } },
    vh0: { type: 'vane', room: 'warden', needs: ['fan'] },
    vh1: { type: 'vane', room: 'warden', needs: ['fan'] },
    vh2: { type: 'vane', room: 'warden', needs: ['fan'] },
    vh3: { type: 'vane', room: 'warden', needs: ['fan'] },
    d5: { type: 'door', opens: { resolved: true } },
    // (issue #413) the house's breath, its one state: in (0) or out (1), saved. Set at the lever by every hub (the Climb's
    // floor, the Well's gallery, loft and crown). Its two stops are no plates anyone stands on. (Last of the things to do, so
    // the scout asks for it only once nothing nearer is left: logic.next)
    breath: { type: 'drum', room: 'climb', rooms: ['climb', 'vaneFar', 'gallery', 'loft', 'crown'], stops: { breathIn: 0, breathOut: 1 }, start: 0, roll: 'hand', verb: 'breath' },
    breathIn: { type: 'plate' }, breathOut: { type: 'plate' },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it). Raised on its
    // plinth (issue #630) on the Vane Room's near ledge, north of the door: its back to the west wall, its plinth filling
    // the floor's border band (from the wall to the cyan inlay 1.6 m in), centred on a row of the hall's 3.2 m plates
    // (WING.z + 3.5 plates), its opening toward the room, the 2.4 m of ledge between it and the chasm left clear
    map: { type: 'map', room: 'vane', at: [MAP_LEDGE.x, 0, MAP_LEDGE.z], yaw: Math.PI / 2, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
    // (issue #660, optional: the marker never points at them) the Wind Clock: its glyph tiles stepped in the panel's order
    // lift its eye's lids; the fan's gust wakes it; the bridge of light stands while it runs, and for good once the far
    // ledge's coffer is had
    gW: { type: 'glyphs', room: 'clock', optional: true },
    tW: { type: 'timer', room: 'clock', hold: WIND_CLOCK.hold, needs: ['fan'], when: { lit: 'gW' }, optional: true },
    bW: { type: 'bridge', opens: { any: [{ lit: 'tW' }, { found: 'cW' }] } },
    cW: { type: 'cache', room: 'clockFar' },
  },
};

export const WARDEN = {
  kind: 'robot', name: 'the warden', final: 'break', speed: 1.8, wakeTime: 2.6,
  wake: 'The machine in the hall unfolds on three legs. Its lamp-eye turns red.',
  openHint: 'Its vents open, glowing. Hit them.',
  resolved: 'The warden sags, its eye dark. Far below, a sound like breathing.',
  missHint: 'Its slam went wide: its vents open, glowing. Shoot them.',
  // (v1.70, issue #319, made fair as the Keeper was: a longer breath between its moves, every move ending with its
  // vents open, a combo's blows 1.4 s apart at least; each blow lands where it is drawn: the beam a ray out of its eye
  // aimed down at you (swept across the floor in its second phase), the stomps and the slam a shock running out round
  // its feet, the flare a column of fire round it; never a lane of floor 28 m long that nothing drew (boss.js Blast))
  phases: [
    { to: 0.5, attacks: ['beam', 'mortar', 'stomp'], pause: 2.2, hint: 'Keep out of its eye’s line. When its side vents open, shoot them.' },
    { to: 0.75, attacks: ['stomp', 'sweepBeam', 'mortar'], pause: 1.9, hint: 'Only its crown hatch opens now: get above it and shoot down.',
      openHint: 'Its crown hatch opens: ride the vane’s breath above it, shoot down.' },
    { to: 1.0, attacks: ['flare', 'beam', 'mortars'], pause: 1.7, hint: 'Fan the vane by it till the hatch lifts, then shoot down.',
      openHint: 'Hatch shut: fan the vane beside it until the hatch lifts.' },
  ],
  attacks: {
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'eye', rig: 'lean', blast: { kind: 'beam', r: 0.75 }, damage: 0.75, knock: 10, recover: 0.8, open: 2.8 },
    sweepBeam: { shape: 'cone', range: 24, angle: 0.9, wind: 1.5, track: 0.6, part: 'eye', rig: 'coil', side: 1, blast: { kind: 'beam', r: 0.75, sweep: 0.9 }, damage: 0.75, knock: 10, recover: 0.8, open: 2.8 },
    mortar: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6, open: 1.6 },
    mortars: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', pose: 'mortar', damage: 0.5, knock: 6, recover: 0.6, open: 1.6 },
    stomp: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'feet', rig: 'rear', blast: { kind: 'front', r0: 1, h: 0.6 }, active: 0.3, reach: 6, damage: 0.5, knock: 9, recover: 0.4, gap: 0.7, then: 'stomp2' },
    stomp2: { shape: 'ring', at: 'self', radius: 6, wind: 0.7, part: 'feet', rig: 'rear', pose: 'stomp', link: true, blast: { kind: 'front', r0: 1, h: 0.6 }, active: 0.3, reach: 6, damage: 0.5, knock: 9, gap: 0.25, then: 'slam' },
    slam: { shape: 'ring', at: 'self', radius: 6.5, wind: 1.3, part: 'feet', rig: 'rear', link: true, blast: { kind: 'front', r0: 1, h: 0.8 }, active: 0.3, wave: { speed: 9, reach: 18, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 13, recover: 1.0, open: 3.0 },
    flare: { shape: 'ring', at: 'self', radius: 5, wind: 1.2, part: 'head', rig: 'swell', blast: { kind: 'front', r0: 1, h: 10 }, active: 0.35, reach: 5, damage: 0.75, knock: 10, recover: 0.6, gap: 0.4, then: 'slam' },
  },
};

/** The hall vane whose draught reaches the warden's hatch now (turning, near it), or null. */
export function draught(rt, g = rt.guardian) {
  if (!g || !rt.hallVanes) return null;
  return rt.hallVanes.find((v) => v.turning && Math.hypot(v.center.x - g.model.pos.x, v.center.z - g.model.pos.z) < HALL.near) ?? null;
}

/**
 * The warden's vents: open, they take a shot; guarded (its second phase on), only the crown hatch, from above, and
 * over a turning vane its draught holds the hatch wide (twice as much); in its last phase only then.
 */
function wardenHit(g, part, mode) {
  const rt = g.rt, P = rt.player;
  if (mode === 'push') { rt.notice('The shove only rings off its hull.', 'warden.push'); return true; }
  if (part !== 'mouth') { if (g.state === 'fight') rt.notice('The fluid splashes off its hull. Wait for its vents to open.', 'warden.hull'); return true; }
  if (g.state !== 'open') { rt.notice('Its vents are shut. Wait for them to open.', 'warden.shut'); return true; }
  if (g.phaseIndex >= 1 && P && P.pos.y < g.model.mouth.y - 1.2) { rt.notice('From down here you only hit its shut sides.', 'warden.above'); return true; }
  const wind = g.phaseIndex >= 1 && !!draught(rt, g);
  if (g.phaseIndex >= 2 && !wind) { rt.sound?.critter?.('clack', 0.8); rt.notice('Its hatch slams shut as the shot comes: in still air it will not open.', 'warden.still'); return true; }
  g.add(wind && g.phaseIndex === 1 ? HALL.washed : HALL.hit, wind ? 'draught' : 'vent');
  if (wind) rt.notice('The vane’s draught holds its hatch wide: the shot goes deep.', `warden.draught.${g.phaseIndex}`);
  rt.sound?.critter?.('clank', 1);
  rt.rumble?.(0.4, 0.35);
  return true;
}
/** In its last two phases its hatch stays up a little longer: time to fly to the vane and hover. */
function wardenOpenFor(g, a, s) { const o = HALL.open[Math.min(g.phaseIndex, 2)]; return s && o ? Math.max(s, o) : s; }
/** What the bellows are for, said a moment after the box's card closes in the Bellows Chamber. */
export const BELLOWS_NEXT = EN['teach.bellowsNext'];   // (said in the player's language: src/i18n.js)
/** What the bellows are for, while the house breathes in (issue #413): where to let it breathe out. */
export const BREATHE_OUT = 'The plinth is still: the house is breathing in. A lever by the hub lets it breathe out.';

/** Are you past the oculus? (in the gallery or beyond: its mark, an eye lit, the warden met, or simply up there) */
export function upUsed(rt) {
  const cp = rt.game.flag(`temple.${rt.id}.checkpoint`);
  if (cp === 'gallery' || cp === 'hall' || rt.logic.resolved || ['s2', 's3', 's4'].some((id) => rt.logic.isLit(id))) return true;
  const P = rt.player;
  return !!P?.pos && rt.inside(P.pos) && rt.kit.local(P.pos).y > 34;
}

/**
 * After the bellows: the way on, said. The chest's plinth unstopped, the draught rises up through the oculus (its own
 * pale rings: the Updraft over the plinth); a moment after the box's card a line says what to do, and the drone flies
 * up and points (main.js 'scout:ping').
 */
class UpGuide {
  constructor(rt) { this.rt = rt; this.since = 0; this.told = false; this.toldIn = false; }
  get wanted() { return this.rt.logic.gadget && !upUsed(this.rt); }
  update(dt) {
    const rt = this.rt;
    // a moment after the chest (its card closes first): what the bellows are for, and the drone shows where. (Issue #413:
    // the plinth's draught rises only while the house breathes out; breathing in, first where to let it breathe out)
    if (!this.wanted || !rt.player?.pos || !rt.inside(rt.player.pos) || (this.since += dt) <= 1.2) return;
    const out = rt.logic.check(OUT);
    if (out ? this.told : this.toldIn) return;
    if (out) { this.told = true; rt.notice(tr('teach.bellowsNext'), 'bellows.next'); }
    else { this.toldIn = true; rt.notice(BREATHE_OUT, 'bellows.in'); }
    rt.quests?.track?.(`temple.${rt.id}`);
    rt.game.emit('scout:ping', { why: 'bellows' });
  }
  dispose() {}
}

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/** The Climb's wings (local m): the Ash Store west (an arena), the Vane Room east (a gap the vane across it stands). */
export const WING = {
  a: Math.PI / 2 + 0.4,                     // the ways west and east out of the well, south of its block (rotunda angles ±a)
  z: ROOMS.climb.z + Math.cos(Math.PI / 2 + 0.4) * ROOMS.climb.r, // their z (60.0)
  // (issue #336: each hall 30 m square, its east or west wall's outer face where the way out of the well ends)
  store: { x: -36, w: ROOMS.wing.w, d: ROOMS.wing.d },
  vane: { x: 36, w: ROOMS.wing.w, d: ROOMS.wing.d },
  gap: [VANE_ROOM.near, VANE_ROOM.far],     // the Vane Room's chasm, x (across its middle; issue #413: 17 m)
};
WING.zone = { min: [WING.store.x - WING.store.w / 2, -1, WING.z - WING.store.d / 2], max: [WING.store.x + WING.store.w / 2, 12, WING.z + WING.store.d / 2] };

/** The Ash Store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arW', room: 'store', zone: WING.zone, doors: ['dW'], extra: 2,
  shut: 'The door grinds shut behind you. In the ash the tower once breathed out, something stirs.',
  won: 'The last of them falls still in the ash. The key’s cage sinks, and the door lets go.',
}];

/**
 * The Ash Store (west of the Climb, an arena: where the tower's breath left its ash, banked against the walls; its door
 * shuts behind you while its keepers stand, and won, the small key's cage sinks) and the Vane Room (east, behind a door that
 * takes a small key, issue #413: a chasm across the room wider than the pen's longest plank, the breath-stones standing in
 * its middle while the house breathes out; on the far floor the great key's cage, and a great vane that sinks it while it
 * turns and the house breathes out).
 */
/** The Ash Store's pen chest (issue #375), local to the store's middle: [x, z]. */
const PEN_AT = [3.5, 11.5];
function wings(rt, K, M, { blue, ring }) {
  const add = (P, o) => rt.add(P, o);
  const Z = WING.z, S = WING.store, R = WING.vane, [G0, G1] = WING.gap, D = ROOMS.door, H = ROOMS.wing.h;
  // (the ways out of the well: from inside its wall to the hall's wall's outer face)
  const inner = Math.sin(WING.a) * ROOMS.climb.r + 0.3, outer = S.w / 2 + 0.6;
  // ---- the Ash Store (issue #336: the house's one fight, 30 m square, its machines round its middle, four columns)
  K.corridor([S.x + outer, Z], [-inner, Z], 0, { w: D.w, h: D.h + 0.4 });
  K.hall({ x: S.x, z: Z, w: S.w, d: S.d, y: 0, h: H, roof: 'oculus', oculus: 0.25, doors: [{ side: 'e', at: 0, w: D.w, h: D.h }] });
  add(Door, { id: 'dW', at: [S.x + outer + 1, 0, Z], yaw: Math.PI / 2, w: D.w, h: D.h });   // (open: it shuts behind you while they stand)
  for (const [x, z, s] of [[-11.5, -11, 1.8], [-12, 10.4, 2.4], [-1, 12.4, 1.5], [9.5, -12, 1.6], [-12.4, -5.6, 1.2], [11.6, 11.4, 1.4]]) K.both(M.dark, T(new THREE.SphereGeometry(s, 9, 6, 0, TAU, 0, Math.PI / 2).scale(1.4, 0.5, 1), [S.x + x, 0, Z + z]));   // (ash banked by the walls)
  for (const [x, z] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) K.column(S.x + x, Z + z, 0, H - 4, 0.9);
  add(Key, { id: 'kW', at: [S.x - S.w / 2 + 1.6, 0, Z], yaw: Math.PI / 2 });
  // (issue #375) the pen's chest by the wall, on a low ramped mound (issue #162), facing the store's middle
  K.both(M.trim, ...chestMound(S.x + PEN_AT[0], 0, Z + PEN_AT[1], { h: 0.3, top: 1.3, foot: 2.1, seg: 24 }));
  add(Mark, { room: 'store', at: [S.x + S.w / 2 - 3.5, 0, Z - 4.5], yaw: Math.PI / 2, foes: [S.x, 0, Z] });

  add(BreathGauge, { shows: 'breath', room: 'store', at: [S.x + S.w / 2 - 3, 0, Z + 9] });

  // ---- the Vane Room (issue #413): behind its door, a chasm 17 m across its middle (wider than the pen draws); the
  // breath-stones' pier in the chasm's middle while the house breathes out; on the far floor the great key and its vane
  K.corridor([inner, Z], [R.x - outer, Z], 0, { w: D.w, h: D.h + 0.4 });
  add(Door, { id: 'dV', at: [R.x - outer - 1, 0, Z], yaw: Math.PI / 2, w: D.w, h: D.h });
  K.hall({ x: R.x, z: Z, w: R.w, d: R.d, y: -9, h: H + 9, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h, y0: 9 }] });
  K.slab(R.x - R.w / 2, Z - R.d / 2, G0, Z + R.d / 2, 0, 9);
  K.slab(G1, Z - R.d / 2, R.x + R.w / 2, Z + R.d / 2, 0, 9);
  K.both(M.dark, box(G1 - G0, 1, R.d, (G0 + G1) / 2, -9, Z));
  add(Pit, { room: 'vane', min: [G0, -10, Z - R.d / 2], max: [G1, -1.5, Z + R.d / 2] });
  // the breath-stones: they rise out of the chasm's dark on the out-breath and stand level with the floors, a pier
  const [p0, p1, pw] = VANE_ROOM.pier;
  add(Bridge, { id: 'stones', a: [p0, 0, Z], b: [p1, 0, Z], w: pw, n: 3 });
  // the breath's grates under them, in the chasm's floor (the air rises through them while the house breathes out)
  for (let i = 0; i < 3; i++) K.add(ring, T(annulus(1.2, 1.5, 0.05, 24), [p0 + (i + 0.5) * (p1 - p0) / 3, -8.45, Z]));
  // on the far floor: the great vane in the floor (too heavy for a splash: the fan's gust turns it) and the great key's cage
  const [vx, vz] = VANE_ROOM.vane, [kx, kz] = VANE_ROOM.key;
  add(Vane, { id: 'vR', at: [vx, 0, Z + vz], r: 2.0, great: true, reach: VANES.reach,
    heavy: 'The splash rocks the great vane a hand’s breadth. It is too heavy for a splash: it wants a steady wind.',
    washed: 'The fan’s gust catches the great vane, and it turns. Beside it, the great key’s cage stirs.' });
  add(Key, { id: 'kG', big: true, at: [kx, 0, Z + kz], yaw: -Math.PI / 2 });
  add(BreathGauge, { shows: 'breath', room: 'vaneFar', at: [R.x + R.w / 2 - 2.5, 0, Z + 11] });
  add(BreathGauge, { shows: 'breath', room: 'vane', at: [R.x - R.w / 2 + 2, 0, Z - 9] });
  add(Mark, { room: 'vane', at: [R.x - 13.2, 0, Z - 7.5], yaw: 0 });
}

// ------------------------------------------------------------------ the Flue (issue #23's last round; issue #413 the way back)
/**
 * The Flue: a round shaft outside the Well's west wall, from the Bellows Chamber's floor to over the crown's, a doorway into
 * the gallery and the crown (a landing under it), and at its foot a passage east to the chamber, shut by a valve that opens
 * from the flue's side only (Valve). Stepped off the crown's landing or the gallery's doorway, its breath breaks the fall
 * at its foot (SoftFloor): the fast way back down.
 */
function flue(rt, K, M, { C3, G0, GK }) {
  const add = (P, o) => rt.add(P, o);
  const F = FLUE, X = F.x, D = ROOMS.door, Y = F.foot, H = GK - Y + D.h + 2;
  K.rotunda({ x: X, z: C3, y: Y, r: F.r, h: H, seg: 40, gaps: [{ a: Math.PI / 2, w: F.door, h: D.h }, { a: Math.PI / 2, w: F.door, h: D.h, y0: G0 - Y }, { a: Math.PI / 2, w: F.door, h: D.h, y0: GK - Y - 0.15 }], oculus: 0.3 });
  // (the way into the crown: the two walls' sills under their doorways, which meet between them: the flue's a step under
  // the crown's floor, so the two never lie in one plane; issue #336: a landing in the flue under the doorway, the flue
  // 35 m across, too far to glide from its middle)
  K.slab(X + F.landing.x0, C3 - F.landing.half, X + F.r + 0.3, C3 + F.landing.half, GK - 0.3, 0.7);
  K.add(M.trim, box(0.3, 0.2, 2 * F.landing.half, X + F.landing.x0 + 0.15, GK - 0.2, C3));
  for (const z of [-F.landing.half + 1.2, F.landing.half - 1.2]) K.both(M.wall, T(new THREE.ConeGeometry(1.6, 3, 4, 1, true).rotateY(Math.PI / 4), [X + F.r - 1.4, GK - 2.5, C3 + z], [Math.PI, 0, 0]));   // (its corbels)
  // its breath's grate at its foot, round its middle: what breaks a fall down it
  for (const r of [3, 6.5, 10]) K.add(M.trim, T(annulus(r, r + 0.14, 0.03, 48), [X, Y + 0.02, C3]));
  // the passage at its foot, east to the Bellows Chamber's west wall, and the valve at its end
  K.corridor([X + F.r + 0.3, C3], [-(ROOMS.chest.r + 0.3), C3], Y, { w: D.w, h: D.h + 0.4 });
  add(Valve, { id: 'valve', at: [-(ROOMS.chest.r + 0.7), Y, C3], yaw: Math.PI / 2, w: D.w, h: D.h, side: [X - F.r - 1, -(ROOMS.chest.r + 1.6)] });
  add(BreathGauge, { shows: 'breath', room: 'flue', at: [X + F.r - 3.2, Y, C3 + 6] });
}

// ------------------------------------------------------------------ the house's breath (issue #413, G1)
/** The one material every lever's knob and every gauge's rings share (its colour set once a frame: Breath). */
const breathLamp = () => makeMaterial({ color: BREATH_LOOK.in, glow: BREATH_LOOK.glow, flat: true, key: 'temple.incal.breath' });
const _bc = new THREE.Color();

/**
 * The house's breath (LOGIC `breath`, a drum of two stops: in 0, out 1): this piece keeps the state. Set at a lever
 * (BreathLever), it says so, colours the house's gauges and knobs (cyan out, amber in), and points the scout at the nearest
 * lever (`center`). o: { id: 'breath' }
 */
export class Breath {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    this.lamp = breathLamp();
    this.setters = [];   // (the levers: the scout's, and the play-through's)
    this.k = this.out ? 1 : 0; this.t = 0;
    rt.breath = this;
  }
  get out() { return this.rt.logic.check(OUT); }
  /** A lever pulled: the house breathes out, or in. Returns 'out' or 'in'. */
  toggle(by = null) { return this.set(!this.out, by); }
  set(out, by = null) {
    const rt = this.rt;
    if (this.out === out) return out ? 'out' : 'in';
    rt.logic.moveDrum(this.id, out ? 1 : 0); rt.applyDoors?.();
    rt.sound?.whoosh?.(); rt.rumble?.(out ? 1.0 : 0.7, 0.35);
    rt.notice?.(out ? 'The house breathes out. Air rises through every vane.' : 'The house breathes in. The draughts die away.', out ? 'breath.out' : 'breath.in');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id, by });
    return out ? 'out' : 'in';
  }
  update(dt) {
    this.t += dt;
    this.k += ((this.out ? 1 : 0) - this.k) * Math.min(1, dt * 2.5);
    const u = this.lamp.uniforms;
    u.uColor.value.set(BREATH_LOOK.in).lerp(_bc.set(BREATH_LOOK.out), this.k);
    u.uGlow.value = BREATH_LOOK.glow + 0.08 * Math.sin(this.t * 2.2);
  }
  /** Where to set it from (the scout's): the nearest lever. */
  get center() {
    const P = this.rt.player?.pos, list = this.setters.map((s) => s.at);
    if (!list.length) return null;
    if (!P) return list[0];
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
}

/**
 * A breath lever by a hub (LEVERS): a steel arm on a slate post, the breath's lamp on its knob. Pulled (A / ×) it lets the
 * house breathe out, or in (Breath.toggle); the arm stands up while it breathes out, down while it breathes in.
 * o: { id, room, at (its foot, local), yaw (the way it faces) }
 */
export class BreathLever {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.05;
    this.pos = K.world(x, y, z);
    K.both(M.dark, T(new THREE.CylinderGeometry(0.3, 0.42, H, 8), [x, y + H / 2, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.33, 0.05, 6, 20), [x, y + H, z], [Math.PI / 2, 0, 0]));
    K.add(breathLamp(), T(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), [x, y + H + 0.02, z]));
    this.top = K.world(x, y + H + 0.1, z);
    this.at = this.top;
    this.arm = new THREE.Group();
    this.arm.position.copy(this.top);
    this.arm.rotation.y = K.heading(o.yaw ?? 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6).translate(0, 0.5, 0), makeMaterial({ color: '#8d97b3', flat: true, metal: 'steel', refl: 0.3, key: 'temple.incal.lever' }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.02, 0), breathLamp());
    this.pivot = new THREE.Group(); this.pivot.add(bar, knob);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.a = 0; this.kick = 0;
    const B = () => rt.breath;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (B()?.out ? 'let the house breathe in' : 'let the house breathe out'),
      enabled: () => !!B(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { const r = B()?.toggle(this.id); this.kick = 1; return r; },
    });
    this.joined = false;
  }
  update(dt) {
    const B = this.rt.breath;
    if (!this.joined && B) { this.joined = true; B.setters.push({ at: this.top, lever: this.id }); }
    const want = (B?.out ? 1 : -1) * 0.75;
    this.a += (want - this.a) * Math.min(1, dt * 6);
    this.kick = Math.max(0, this.kick - dt * 3);
    this.pivot.rotation.x = this.a + Math.sin(this.kick * 9) * 0.1 * this.kick;
  }
  dispose() { this.off?.(); }
}

/**
 * A breath gauge: the house's breath in a room (issue #413, G1: readable everywhere). A slender steel post, a glass tube
 * on it, and in the tube three rings of the breath's light drifting up while the house breathes out and down while it
 * breathes in (cyan, amber: the shared lamp). o: { room, at (its foot, local) }
 */
export class BreathGauge {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at;
    this.rt = rt; this.o = o;
    K.both(M.trim, T(new THREE.CylinderGeometry(0.09, 0.15, 1.2, 8), [x, y + 0.6, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.32, 0.05, 6, 20), [x, y + 1.25, z], [Math.PI / 2, 0, 0]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.32, 0.05, 6, 20), [x, y + 3.25, z], [Math.PI / 2, 0, 0]));
    K.add(M.dark, T(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), [x + 0.3, y + 2.25, z]));
    K.add(M.dark, T(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 6), [x - 0.3, y + 2.25, z]));
    // the rings: one mesh, three rings 0.6 m apart, slid up or down the tube a ring's spacing at a time
    const rings = [0, 1, 2].map((i) => new THREE.TorusGeometry(0.22, 0.045, 5, 18).rotateX(Math.PI / 2).translate(0, i * 0.6, 0));
    this.mesh = new THREE.Mesh(mergeGeometries(rings), breathLamp());
    this.base = K.world(x, y + 1.45, z);
    this.mesh.position.copy(this.base);
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true;
    rt.root.add(this.mesh);
    this.s = 0;
  }
  update(dt) {
    const k = this.rt.breath?.k ?? 0;
    this.s = (this.s + dt * BREATH_LOOK.rise * (2 * k - 1) + 0.6) % 0.6;
    this.mesh.position.y = this.base.y + this.s;
  }
}

/**
 * Where a fall lands soft (issue #413, G6: the drops down the Well's core and the Flue): zones of the house's floors, each
 * a round (or a ring: `rin`) over a floor at y (local); falling fast over the highest one under you, its breath slows you
 * to CATCH.slow over its last metres, as the Footprint's pools do. o: { zones: [{ x, z, y, r, rin?, said }] }
 */
export const CATCH = { slow: 12, over: 2.5, frames: 5 / 60 };
export class SoftFloor {
  constructor(rt, o) { this.rt = rt; this.o = o; this.zones = o.zones.map((q) => ({ ...q, c: rt.kit.world(q.x, q.y, q.z) })); this.on = null; }
  under(p) {
    let best = null;
    for (const q of this.zones) {
      const d = Math.hypot(p.x - q.c.x, p.z - q.c.z);
      if (d > q.r + 0.5 || d < (q.rin ?? -1) - 0.3 || p.y < q.c.y - 1.5 || p.y > q.c.y + 90) continue;
      if (!best || q.c.y > best.c.y) best = q;
    }
    return best;
  }
  update() {
    const P = this.rt.player;
    if (!P?.pos) return;
    const q = this.under(P.pos);
    if (q && !P.onGround && !P.dead && P.vel.y < -CATCH.slow) {
      this.on = q;
      if (P.pos.y - q.c.y < Math.max(CATCH.over, -P.vel.y * CATCH.frames)) P.vel.y = -CATCH.slow;
      return;
    }
    if (this.on && (P.onGround || !q || P.dead)) {
      if (P.onGround && q) { this.rt.sound?.whoosh?.(); this.rt.notice?.(this.on.said ?? 'The house’s breath breaks your fall.', 'incal.caught'); }
      this.on = null;
    }
  }
}

/**
 * The Flue's valve (issue #413): a door at the passage's end into the Bellows Chamber that opens only from the flue's side
 * (the traveller in the flue or its passage: local x within `side`, under the gallery's floor) and shuts behind him; from
 * the chamber it stays shut and says so. A Door drawn as the house's doors, worked by where you are, not by the logic.
 * o: as a Door's, and side: [x0, x1] (local x of the flue's side)
 */
export class Valve extends Door {
  constructor(rt, o) {
    super(rt, o);
    this.k = 0; this.open = false; this.apply();
  }
  update(dt, t) {
    const P = this.rt.player;
    const l = P?.pos ? this.rt.kit.local(P.pos) : null;
    const inFlue = !!l && l.x > this.o.side[0] && l.x < this.o.side[1] && l.y > FLUE.foot - 2 && l.y < FLOORS.gallery - 4 && Math.abs(l.z - this.o.at[2]) < FLUE.r + 1;
    if (inFlue !== this.open) this.setOpen(inFlue);
    if (!this.open && l && l.x > this.o.at[0] && l.x < this.o.at[0] + 4 && Math.abs(l.z - this.o.at[2]) < 3 && Math.abs(l.y - this.o.at[1]) < 3) this.rt.notice?.('The valve opens only from the Flue’s side.', 'incal.valve');
    super.update(dt, t);
  }
}

/**
 * The crown's ring (LOGIC `rS`, a held bell, issue #413): a pull-ring on a chain from a steel sleeve high on the crown's
 * wall. While the house breathes in it hangs down within the hook's reach; while it breathes out the chain draws it up into
 * its sleeve, out of sight. Tugged with the hook (its HookBell `ringId`), it holds one of the crown eye's lids up
 * VANES.ring s. o: { id: 'rS', ringId, at (where it hangs, local), sleeve (the sleeve's height), from (where it is hooked
 * from, local) }
 */
export class CrownRing {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, top = o.sleeve;
    this.center = K.world(x, y, z);
    // the sleeve: a steel tube on an arm out from the wall, the chain hanging out of it
    const out = Math.hypot(x, z - ROOMS.chest.z), ux = x / out, uz = (z - ROOMS.chest.z) / out, wall = ROOMS.drum.r;
    K.add(M.dark, T(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 12), [x, top + 0.6, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.5, 0.08, 6, 16), [x, top - 0.5, z], [Math.PI / 2, 0, 0]));
    const arm = wall - out;
    K.add(M.dark, T(new THREE.BoxGeometry(0.5, 0.5, arm), [x + ux * arm / 2, top + 1.4, z + uz * arm / 2], [0, Math.atan2(ux, uz), 0]));
    this.chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6).translate(0, -0.5, 0), M.trimMat);
    this.chain.position.copy(K.world(x, top - 0.5, z));
    this.chain.userData.noCollide = true; this.chain.userData.dynamic = true;
    rt.root.add(this.chain);
    this.top = top; this.y = y;
    this.left = 0;
    this.k = rt.logic.check(IN) ? 1 : 0;
    this.offBell = rt.game?.on?.('bell', ({ by, struck } = {}) => { if (struck && by === o.ringId) this.tug(); });
  }
  get ring() { return this.rt.piece?.(this.o.ringId) ?? null; }
  /** Tugged: one of the eye's lids up a while (the house breathing in, the ring down). */
  tug() {
    const rt = this.rt, L = rt.logic;
    if (!L.canUse(this.id) || !L.check(IN)) return;
    L.quiet(this.id); L.light(this.id);
    this.left = VANES.ring;
    rt.onLit?.(this.id);
    rt.notice?.('The chain runs, and one of the eye’s lids lifts. Not for long.', 'rS.tug');
  }
  update(dt) {
    const L = this.rt.logic;
    if (this.left > 0) {
      this.left -= dt;
      if (this.left <= 0 || !L.check(IN)) { this.left = 0; L.quiet(this.id); this.rt.notice?.('The chain draws back. The lid sinks.', 'rS.quiet'); }
    }
    // down while the house breathes in, drawn up into its sleeve while it breathes out
    this.k += ((L.check(IN) ? 1 : 0) - this.k) * Math.min(1, dt * 1.6);
    const R = this.ring;
    if (!R) return;
    const yy = this.top - 0.5 - (this.top - 0.5 - this.y) * this.k;
    const at = this.rt.kit.world(this.o.at[0], yy, this.o.at[2]);
    R.at.copy(at); R.group.position.copy(at);
    R.group.visible = this.k > 0.15;
    this.chain.scale.y = Math.max(0.01, this.top - 0.5 - yy - (R.o.size ?? 0.5) * 2 - (R.o.chain ?? 0.8) + 0.2);
    this.chain.visible = R.group.visible;
  }
  dispose() { this.offBell?.(); }
}

/**
 * A rim of light round one of the core's holes (issue #413: the irises gone, open for good): it glows while the draught is
 * let on through it (its logic door `id`). o: { id, at (the hole's middle, local), r }
 */
export class Rim {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    this.m = makeMaterial({ color: BREATH_LOOK.out, glow: 0.05, flat: true, key: `temple.incal.rim.${o.id}` });
    const g = new THREE.Mesh(new THREE.TorusGeometry(o.r + 0.3, 0.09, 5, 64).rotateX(Math.PI / 2), this.m);
    g.position.copy(rt.kit.world(o.at[0], o.at[1] + 0.05, o.at[2]));
    g.userData.noCollide = true; g.userData.dynamic = true;
    rt.root.add(g);
  }
  update(dt, t) {
    const on = this.rt.logic.isOpen(this.o.id);
    const u = this.m.uniforms.uGlow;
    u.value += ((on ? 0.75 + 0.08 * Math.sin(t * 3) : 0.05) - u.value) * Math.min(1, dt * 4);
  }
}

// ------------------------------------------------------------------ inside
/**
 * (issue #660) The Wind Clock, east off the Well's gallery (WIND_CLOCK): its corridor from the drum, its hall (the floor a
 * near floor and a far ledge over a chasm, the hall's walls down to the chasm's foot), the glyph tiles and their panel, the
 * clock's eye on its pedestal by the north wall, the lamps from it along the lip to the bridge's foot, the bridge of light,
 * the far ledge's coffer, the room's mark.
 */
function windClock(rt, K, M, { C3, G0, GR, D, blue }) {
  const add = (P, o) => rt.add(P, o), W = WIND_CLOCK, H = W.hall, PIT = H.pit, cx = (H.x0 + H.x1) / 2;
  K.corridor([GR + 0.4, C3], [H.x0 - 1.2, C3], G0, { w: D.w, h: D.h + 0.4 });
  K.hall({ x: cx, z: C3, w: H.x1 - H.x0, d: H.z1 - H.z0, y: G0 - PIT, h: 18 + PIT, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h, y0: PIT }] });
  K.slab(H.x0 - 0.6, H.z0 - 0.6, W.lip, H.z1 + 0.6, G0, PIT);          // the near floor, solid down to the chasm's foot
  K.slab(W.far, H.z0 - 0.6, H.x1 + 0.6, H.z1 + 0.6, G0, PIT);          // the far ledge
  K.both(M.dark, box(W.far - W.lip, 1, H.z1 - H.z0, (W.lip + W.far) / 2, G0 - PIT - 0.5, C3));
  K.add(blue, box(0.5, 0.3, H.z1 - H.z0, W.lip + 0.25, G0 + 0.02, C3));   // (the lips' edges, the house's blue)
  K.add(blue, box(0.5, 0.3, H.z1 - H.z0, W.far - 0.25, G0 + 0.02, C3));
  add(Pit, { room: 'clock', min: [W.lip, G0 - PIT - 2, H.z0], max: [W.far, G0 - 1.5, H.z1] });
  add(GlyphFloor, { id: 'gW', at: W.tiles.map(([x, z]) => [x, G0, z]), glyphs: W.tiles.map((t) => t[2]), order: W.order,
    mural: { at: [33, G0, H.z0 + 0.25], yaw: 0 },
    wrong: 'The tiles go dark: out of turn. The panel on the south wall shows the order.',
    done: 'The last tile takes, and by the north wall the clock’s stone lids lift.' });
  add(Clock, { id: 'tW', at: [W.eye[0], G0, W.eye[1]], yaw: Math.PI * 0.75, by: 'gust', lids: true, n: 18,
    strip: [[W.eye[0] + 1.3, G0, W.eye[1]], [W.lip - 1.1, G0, W.eye[1]], [W.lip - 1.1, G0, W.bridge], [W.lip, G0, W.bridge]],
    bars: [-1, 1].map((sd) => ({ at: [W.lip - 1.2, G0, W.bridge + sd * 3.4], yaw: Math.PI / 2, h: 5 })),
    wrong: 'The splash runs off the clock’s eye. Its little vanes want wind.',
    unmet: 'Stone lids cover the clock’s eye. The glyph tiles on the floor lift them.',
    heard: 'The vanes spin and the clock runs: a bridge of light over the chasm, while the lamps last.',
    faded: 'The lamps are out, and the bridge of light sinks. Gust the clock again.' });
  add(Bridge, { id: 'bW', a: [W.lip, G0, W.bridge], b: [W.far, G0, W.bridge], w: 3.6, n: 11, glow: { color: '#8fe6ff', k: 0.6 } });
  add(Mark, { room: 'clock', at: [H.x0 + 3.5, G0, C3 - 7], yaw: Math.PI / 2 });
  add(Coffer, { id: 'cW', at: [H.x1 - 2.6, G0, W.bridge + 4], yaw: -Math.PI / 2 });
}

function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const rotA = (a) => Math.PI / 2 - a;    // rotunda angle (0 = +z, toward +x) -> sector angle (0 = +x, toward +z)

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 11, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });

  // the makers' steel blue, banding the drums (after the picked reference: references/temples/wardens-well/sheet-1.jpg)
  // (in its futuristic skin, issue #342: the drums' bands dark slate, their friezes and the vanes' rings lit cyan, the
  // caps cream, the slit windows cyan light panels: src/temples/skins/wardens-well.js; drawn only, the same shapes)
  const SK = rt.skin?.paints;
  const blue = SK?.cap ?? { paint: new THREE.Color('#7d93c4'), smooth: false, side: THREE.FrontSide };
  const ring = SK?.ring ?? blue, bandM = SK?.band ?? blue, markM = SK?.mark ?? M.trim;
  const slitM = SK?.slit ?? makeMaterial({ color: '#fff0c8', glow: 0.75, flat: true, key: 'incal.temple.slit' });
  /** A band round a drum's inside wall (r, at y), with the makers' frieze on it: an open corner beside a shorter upright. */
  const band = (x, z, r, y, h = 1.3, every = 0.26, skip = [], cut = []) => {
    // (cut: [angle, half-width] where the band stops, a doorway it would cross: drawn as sectors round the rest)
    if (!cut.length) K.add(bandM, T(annulus(r - 0.14, r + 0.04, h, 72), [x, y + h / 2, z]));
    else {
      const ends = cut.map(([c, w]) => [rotA(c) - w, rotA(c) + w]).sort((p, q) => p[0] - q[0]);
      ends.forEach(([, a1], i) => { const b0 = i + 1 < ends.length ? ends[i + 1][0] : ends[0][0] + TAU; K.add(bandM, T(sector(r - 0.14, r + 0.04, a1, b0, h), [x, y + h / 2, z])); });
    }
    for (let a = 0; a < TAU - 0.01; a += every) {
      if (skip.some(([c, w]) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < w)) continue;
      const px = x + Math.sin(a) * (r - 0.16), pz = z + Math.cos(a) * (r - 0.16);
      K.add(markM, T(glyphGeometry(SK?.flatArc ? 0.48 : 0.7, 0.05), [px, y + 0.04, pz], [0, a, 0]));
    }
  };
  /** A tall slit window of warm light on a drum's inside wall, pointed at the top. */
  const slit = (x, z, r, a, y, h) => {
    const px = x + Math.sin(a) * (r - 0.05), pz = z + Math.cos(a) * (r - 0.05);
    K.add(slitM, T(new THREE.BoxGeometry(0.6, h, 0.06), [px, y + h / 2, pz], [0, a, 0]));
    K.add(slitM, T(new THREE.BoxGeometry(0.43, 0.43, 0.06), [px, y + h, pz], [0, a, Math.PI / 4], 1, 'YXZ'));
  };

  // ---- the Turning Floors (z 12.6..46, 30 m across): a drop, an island, two riding discs that ride while the vane on
  // the pillar beside the island turns (a splash spins it; it slows, and stops). Issue #336: the vane was over the far
  // door; it stands in the middle of the drop now, on a pillar of its own out of the dark
  const D = ROOMS.door, TW = ROOMS.turning.w / 2;
  K.wall(-TW - 1.2, 12.6, TW + 1.2, 12.6, -14, 32, { t: 1.2, holes: [{ at: TW + 1.2, w: D.w, h: D.h, y0: 14 }] });
  K.hall({ x: 0, z: 29.3, w: 2 * TW, d: 33.4, y: -14, h: 32, floor: false, roof: 'oculus', oculus: 0.22, omit: ['s'], doors: [{ side: 'n', w: D.w, h: D.h, y0: 14 }] });
  K.slab(-TW, 12.6, TW, 18, 0, 14);
  K.slab(-TW, 40, TW, 46, 0, 14);
  K.both(M.stone, lathe([[2.4, -14], [2.4, -0.6], [2.8, -0.3], [2.8, 0.01], [0.01, 0.01]], 20).translate(0, 0, 29), new THREE.CylinderGeometry(2.6, 2.6, 14, 14).translate(0, -7, 29));
  K.both(M.dark, box(2 * TW, 1, 22, 0, -14.5, 29));
  add(Pit, { room: 'turning', min: [-TW - 1, -16, 18], max: [TW + 1, -4, 40] });
  // (the far disc starts at the far side: two splashes, and the two meet you at the island together. Issue #413: each
  // disc rides on its own vane, the far one's on a pillar by the far ledge, high, 30 m from the near one)
  add(Platform, { path: [[0, 0, 20.3], [0, 0, 24.3]], r: 2.2, speed: 1.6, pause: 1.4, when: { lit: 'v1' } });
  add(Platform, { path: [[0, 0, 33.6], [0, 0, 37.8]], r: 2.2, speed: 1.6, pause: 1.4, phase: 1, when: { lit: 'v1b' } });
  const WX = -7, WZ = 37.6;
  K.both(M.wall, box(1.8, 31, 1.8, WX, 1.5, WZ));
  K.add(blue, box(2.1, 0.6, 2.1, WX, 17.2, WZ));
  add(Vane, { id: 'v1b', at: [WX, 14.4, WZ - 0.92], wall: true, yaw: Math.PI, r: 1.7, coast: VANES.floors,
    turning: 'The high vane on the far pillar spins, and the far disc wakes and rides. Already it is slowing.',
    fading: 'The high vane is slowing: the far disc will stop with it.' });
  K.add(ring, T(annulus(2.1, 2.5, 0.3, 32).rotateX(Math.PI / 2), [WX, 14.4, WZ - 0.8]));
  add(BreathGauge, { shows: 'breath', room: 'turning', at: [-11.5, 0, 16] });
  // the vane's pillar, out of the drop's dark east of the island, the vane on its west face (toward the island and the discs: in sight from both ledges)
  const VX = 6.5, VZ = 29;
  K.both(M.wall, box(1.8, 27, 1.8, VX, -1.5, VZ));
  K.add(blue, box(2.1, 0.6, 2.1, VX, 12.2, VZ));
  add(Vane, { id: 'v1', at: [VX - 0.92, 9.5, VZ], wall: true, yaw: -Math.PI / 2, r: 1.9, coast: VANES.floors,
    turning: 'The vane on the pillar spins, and below it the near disc wakes and rides. Already it is slowing.',
    fading: 'The vane is slowing: the near disc will stop with it.' });
  K.add(ring, T(annulus(2.3, 2.75, 0.3, 32).rotateZ(Math.PI / 2), [VX - 0.8, 9.5, VZ]));
  add(Mark, { room: 'turning', at: [-4.8, 0, 15.2], yaw: Math.PI / 2 });
  for (let i = 0; i < 4; i++) K.glyph([-TW + 0.05, 4 + i * 2.6, 22 + i * 5], 1.2, Math.PI / 2);
  for (let i = 0; i < 3; i++) { K.add(slitM, box(0.06, 7, 0.6, TW - 0.1, 6.5, 20 + i * 9)); K.add(slitM, T(new THREE.BoxGeometry(0.06, 0.43, 0.43), [TW - 0.1, 10, 20 + i * 9], [Math.PI / 4, 0, 0])); }

  // ---- the corridor and the Climb (a round well 34 m across, floor at 0, the balcony at 11)
  const C2 = ROOMS.climb.z, R2 = ROOMS.climb.r, CS = C2 - R2 - 1.2;   // (CS: the corridor's end, in the well's wall)
  const cw = D.w / 2 + 0.7, ch = D.h + 0.5;
  K.slab(-cw, 46, cw, CS, 0, 0.8);
  K.wall(-cw, 46.6, -cw, CS, 0, ch, { t: 0.8 }); K.wall(cw, CS, cw, 46.6, 0, ch, { t: 0.8 });
  K.both(M.wall, box(2 * cw + 0.8, 0.8, CS - 45.8, 0, ch + 0.4, (45.8 + CS) / 2));
  // (the house's hub since v1.48: a way west into the Ash Store and east into the Vane Room, south of the block)
  K.rotunda({ x: 0, z: C2, y: 0, r: R2, h: ROOMS.climb.h, seg: 40, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h, y0: 11 }, { a: -WING.a, w: D.w, h: D.h }, { a: WING.a, w: D.w, h: D.h }], oculus: 0.3 });
  band(0, C2, R2, 19.5, 1.1, 0.3, [[0, 0.3]]);
  // the north of the well is a block of stone eleven metres high, its straight face CLIMB.face north of the middle (issue
  // #336: the well 34 m across; the face north of the middle keeps the vane at its foot near the door it opens): climb
  // the face to the top (the house's one climb: its other walls are not climbed, issue #115)
  const F = CLIMB.face, RB = R2 + 0.2, half = Math.sqrt(RB * RB - F * F), fa = Math.asin(F / RB);
  const seg = new THREE.Shape();
  seg.moveTo(half, -F); seg.absarc(0, 0, RB, -fa, -Math.PI + fa, true); seg.closePath();
  K.climbable('the Climb: the block\'s straight face, from the well\'s floor to the balcony', () => K.both(M.wallGlyph, T(new THREE.ExtrudeGeometry(seg, { depth: 11, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2), [0, 0, C2])));
  K.add(M.trim, box(2 * half - 0.4, 0.3, 0.5, 0, 11.05, C2 + F + 0.1));   // its lip
  for (let i = 0; i < 4; i++) K.add(M.trim, box(3.2, 0.22, 0.3, (i % 2 ? 1.6 : -1.6), 2.4 + i * 2.2, C2 + F - 0.12));   // handholds up the face
  // the ball's groove along the balcony, the plate at its end; a slot across it near its start, whose stones stand only
  // while the vane in the well's floor at the face's foot turns (splash it from up here, or before you climb)
  const GZ = C2 + CLIMB.groove, S0 = -3.2, S1 = 3.2, SL = [-2.15, -0.25];
  K.add(M.dark, box(SL[0] - S0 + 0.45, 0.04, 0.9, (S0 - 0.45 + SL[0]) / 2, 11.03, GZ));
  K.add(M.dark, box(S1 + 0.45 - SL[1], 0.04, 0.9, (SL[1] + S1 + 0.45) / 2, 11.03, GZ));
  K.add(M.voidM, box(SL[1] - SL[0], 0.02, 1.5, (SL[0] + SL[1]) / 2, 11.02, GZ));
  add(Bridge, { id: 'slot', a: [SL[0], 11.06, GZ], b: [SL[1], 11.06, GZ], w: 1.5, n: 2 });
  add(Ball, { id: 'ball1', a: [S0, 11.04, GZ], b: [S1, 11.04, GZ], r: 0.9,
    gap: { bridge: 'slot', from: (SL[0] - S0) / (S1 - S0), to: (SL[1] - S0) / (S1 - S0), lip: 'The ball stops at the slot’s lip: its stones are down. Something below drives them.' },
    dropped: 'The slot’s stones sink from under the ball, and it drops. Another rolls out of the wall where the groove begins.' });
  add(Plate, { id: 'p1', at: [S1, 11, GZ], r: 1.1 });
  // (issue #413) the ball's weight on its plate sinks the cage of a small key beside it; the door at the balcony's end takes
  // one small key, as the east way's does (G3c: two keys, two doors, either first)
  add(Key, { id: 'kC', at: [S1 + 3.4, 11, GZ - 0.4], yaw: -Math.PI / 2 });
  add(Door, { id: 'd1', at: [0, 11, C2 + R2 + 0.7], w: D.w, h: D.h, lamps: [OUT] });   // (its keyhole: logic `lock`; its lamp, the out-breath)
  add(Vane, { id: 'v2', at: [0, 0, C2 + F - 3.4], r: 1.8, coast: VANES.climb,
    turning: 'The vane in the floor spins, and up on the balcony stones grind up into the slot across the groove.',
    fading: 'The vane below is slowing.' });
  add(Mark, { room: 'climb', at: [5.5, 0, C2 - 4.5], yaw: -Math.PI * 0.8 });
  wings(rt, K, M, { blue, ring });
  // (issue #413) the house's breath: its keeper, a lever by every hub, a gauge in every room
  add(Breath, { id: 'breath' });
  for (const l of LEVERS) add(BreathLever, l);
  add(BreathGauge, { shows: 'breath', room: 'climb', at: [-10.5, 0, C2 + 1.2] });

  // ---- the corridor and the Bellows Chamber (floor 11, an oculus in its ceiling at 33)
  const E2 = C2 + R2;   // (the well's north wall)
  K.slab(-cw, E2 + 0.6, cw, E2 + 3.4, 11, 0.8);
  K.wall(-cw, E2 + 1.3, -cw, E2 + 3.4, 11, ch, { t: 0.8 }); K.wall(cw, E2 + 3.4, cw, E2 + 1.3, 11, ch, { t: 0.8 });
  K.both(M.wall, box(2 * cw + 0.8, 0.8, 2.6, 0, 11 + ch + 0.4, E2 + 2.4));
  const C3 = ROOMS.chest.z;   // 97.4 (E2 + 13.8)
  // (issue #413: and west, the Flue's valve: the fast way back comes in here)
  K.rotunda({ x: 0, z: C3, y: 11, r: ROOMS.chest.r, h: 22, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: -Math.PI / 2, w: D.w, h: D.h }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(0, 11, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  K.add(M.glyph, T(new THREE.TorusGeometry(2.75, 0.06, 4, 48), [0, 11.33, C3], [Math.PI / 2, 0, 0]));
  // the light falls down the oculus: a ring of glyphs round it on the floor
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.add(M.glyph, T(glyphGeometry(0.9, 0.04).rotateX(-Math.PI / 2), [Math.sin(a) * 5.2, 11.03, C3 + Math.cos(a) * 5.2], [0, a + Math.PI, 0])); }
  band(0, C3, 10, 19, 1.1, 0.4, [[Math.PI, 0.4], [-Math.PI / 2, 0.4]]);
  add(Mark, { room: 'jets', at: [6.2, 11, C3 - 5], yaw: -Math.PI * 0.75 });
  add(BreathGauge, { shows: 'breath', room: 'jets', at: [6.4, 11, C3 + 5.4] });
  // once the bellows are yours: the way on, said (a line, the drone); the draught itself rises over the plinth (below)
  add(UpGuide, {});

  // ---- the Well (issue #413, G4: the great hall; the Lamp Gallery before): a tall drum over the chamber, its floors rings
  // round an open core (the gallery's floor at 34.6 round the oculus below, the loft's 17 m up, the crown's 34 m up, the
  // high ledge 16 m over that), after the picked reference: cream stone banded in steel blue, slit windows, stone shelves
  // jutting from the wall with carved eyes over them. From the crown's rim the eye falls 57 m down the core to the plinth.
  // (issue #336: the drum 36 m across, each floor 17 m high)
  const G0 = FLOORS.gallery, GR = ROOMS.drum.r, GC = FLOORS.loft, GK = FLOORS.crown, H0 = FLOORS.hall;
  // (and since issue #23's last round two ways west into the Flue: at the floor, and into the crown at its floor; since
  // issue #413 both drops down it)
  K.rotunda({ x: 0, z: C3, y: G0, r: GR, h: ROOMS.drum.h, floor: false, seg: 40, gaps: [{ a: 0, w: D.w, h: D.h, y0: H0 - G0 }, { a: -Math.PI / 2, w: FLUE.door, h: D.h }, { a: -Math.PI / 2, w: FLUE.door, h: D.h, y0: VANES.crown }, { a: Math.PI / 2, w: D.w, h: D.h }], oculus: 0.25 });
  K.both(M.floor, T(annulus(3.9, GR + 1.4, 0.6, 56), [0, G0, C3]));
  K.add(M.trim, T(annulus(3.6, 4.2, 0.8, 32), [0, G0 + 0.25, C3]));
  for (const r of [5.6, 9.4, 13.2]) K.add(SK ? ring : blue, T(annulus(r, r + (SK ? 0.12 : 0.3), 0.02, 56), [0, G0 + 0.012, C3]));
  const W0 = [[-Math.PI / 2, 0.3]], N0 = [[0, 0.3]], E0 = [[Math.PI / 2, 0.3]];   // (the bands and windows stop short of the doorways west and north; and east, the Wind Clock's, issue #660)
  band(0, C3, GR, G0 + 4.2, 1.3, 0.22, [...W0, ...E0], E0);
  band(0, C3, GR, GC - 2.6, 1.0, 0.22);
  band(0, C3, GR, GC + 3.4, 1.3, 0.22);
  band(0, C3, GR, GK + 3.4, 1.3, 0.22, W0);
  band(0, C3, GR, GK + 13.2, 1.3, 0.22);
  band(0, C3, GR, H0 + 12.4, 1.3, 0.22, N0);
  const skip = (a, list) => list.some(([c, w]) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < w + 0.25);
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; if (skip(a, [...W0, ...E0])) continue; slit(0, C3, GR, a, G0 + 6.8, 4.6); }
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; slit(0, C3, GR, a, GC + 6.4, 4.8); }
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; if (skip(a, [...W0, ...N0])) continue; slit(0, C3, GR, a, GK + 6.6, 5.2); }
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; if (skip(a, N0)) continue; slit(0, C3, GR, a, GK + 17.5, 5.2); }
  /** A stone shelf jutting from the wall at angle a, its top at y, and a carved eye over it (blind: a carving). */
  const shelf = (a, y, deep = 2.6, wide = 0.16) => {
    K.both(M.floor, T(sector(GR - deep, GR + 0.2, rotA(a) - wide, rotA(a) + wide, 0.6), [0, y, C3]));
    K.both(M.wall, T(new THREE.ConeGeometry(deep * 0.42, 1.6, 4, 1, true).rotateY(Math.PI / 4), [Math.sin(a) * (GR - deep * 0.35), y - 1.4, C3 + Math.cos(a) * (GR - deep * 0.35)], [Math.PI, 0, 0]));
  };
  const carved = (a, y) => {
    const px = Math.sin(a) * (GR - 0.1), pz = C3 + Math.cos(a) * (GR - 0.1);
    K.add(M.trim, T(new THREE.TorusGeometry(0.72, 0.12, 5, 20).scale(1.35, 0.8, 1), [px, y, pz], [0, a, 0]));
    K.add(M.stone, T(new THREE.SphereGeometry(0.42, 10, 8).scale(1, 1, 0.3), [px, y, pz], [0, a, 0]));
  };
  // the blind ones: shelves at other heights, eyes carved over them that wake to nothing
  for (const [a, y] of [[0.9, G0 + 6.5], [2.3, G0 + 10.5], [-2.4, G0 + 5.5]]) { shelf(a, y); carved(a, y + 1.25); }
  /**
   * A lidded eye on a pillar in the floor (issue #336: the eyes were on the drum's wall): the eye at `at` looking along
   * `yaw`, the pillar behind it from the floor y0 to over the eye, a shelf under the eye jutting toward where it looks
   * (it hides the eye from the floor), a corbel under the shelf.
   */
  const eyePillar = (at, yaw, y0) => {
    const f = [Math.sin(yaw), Math.cos(yaw)], back = 1.05, [ex, ey, ez] = at;
    const px = ex - f[0] * back, pz = ez - f[1] * back, top = ey + 1.7;
    K.both(M.wall, T(new THREE.BoxGeometry(1.8, top - y0 + 0.3, 1.8), [px, (y0 - 0.3 + top) / 2, pz], [0, yaw, 0]));
    K.add(blue, T(new THREE.BoxGeometry(2.1, 0.5, 2.1), [px, top + 0.15, pz], [0, yaw, 0]));
    K.add(blue, T(new THREE.BoxGeometry(2.1, 0.6, 2.1), [px, y0 + 0.2, pz], [0, yaw, 0]));
    const sx = ex + f[0] * 1.0, sz = ez + f[1] * 1.0;
    K.both(M.floor, T(new THREE.BoxGeometry(4, 0.6, 2.9), [sx, ey - 1.25 - 0.3, sz], [0, yaw, 0]));
    K.both(M.wall, T(new THREE.ConeGeometry(1.1, 1.6, 4, 1, true).rotateY(Math.PI / 4), [ex + f[0] * 0.5, ey - 2.35, ez + f[1] * 0.5], [Math.PI, 0, 0]));
  };
  // the eye on the west pillar: hidden from the floor by its shelf, stone lids shut over it until the great vane in the
  // floor beside it turns; and that is too heavy for a splash
  const EG = [-9.3, G0 + 9.5, C3 + 5.2], vGat = [-8.2, G0, C3], yG = Math.atan2(vGat[0] - EG[0], vGat[2] - EG[2]);
  eyePillar(EG, yG, G0);
  add(Switch, { id: 's2', at: EG, yaw: yG, size: 1.0, lids: true,
    wrong: 'The splash patters on the eye’s stone lids. They are shut: they lift only while the great vane in the floor turns.' });
  add(Vane, { id: 'vG', at: vGat, r: 2.3, great: true, reach: VANES.reach,
    washed: 'The fan’s gust catches the great vane, and it turns; on the pillar beside it an eye’s stone lids lift. Its rising air holds you: aim from there.' });
  // the thin breath through its frame: it bears open wings, and holds you over the vane (too thin to turn it)
  add(Updraft, { at: vGat, r: 2.6, h: VANES.breath, lift: 8, hint: 'A thin breath rises through the great vane’s frame. Open your wings in it.', ride: 'The breath through the vane’s frame bears your wings, and holds you over it.' });
  // the loft's floor, a ring round the core (issue #413: the iris there before, the hole open for good; a rim of light round
  // it while the draught is let on through it)
  K.both(M.floor, T(annulus(VANES.iris + 0.1, GR + 0.4, 0.6, 56), [0, GC, C3]));
  K.add(M.trim, T(annulus(VANES.iris + 0.1, VANES.iris + 0.7, 0.04, 40), [0, GC + 0.02, C3]));
  add(Rim, { id: 'iris', at: [0, GC, C3], r: VANES.iris });
  add(Mark, { room: 'gallery', at: [0, G0, C3 - 11.5], yaw: 0 });
  add(BreathGauge, { shows: 'breath', room: 'gallery', at: [-11.5, G0, C3 - 10.5] });

  // ---- the loft: a raised walk on two piers east of the core (issue #336: it was a shelf high on the east wall), its
  // ball, a gap in it whose stones stand only while the loft's great vane turns
  add(Mark, { room: 'loft', at: [-7, GC, C3 - 8.5], yaw: Math.PI * 0.75 });
  const SX = 6, SY = GC + VANES.shelf, B0 = C3 - 3.4, B1 = C3 + 6.6, GA = C3 - 0.6, GB = C3 + 2.6;
  K.slab(SX - 1.7, B0 - 1.9, SX + 1.7, GA, SY, 0.8);
  K.slab(SX - 1.7, GB, SX + 1.7, B1 + 1, SY, 0.8);
  // (its piers on the floor's ring, clear of the core: issue #413)
  for (const z of [B0 - 1.4, B1 - 1.2]) K.column(SX, z, GC, VANES.shelf - 0.5, 0.55, { mat: M.wall });
  K.add(M.dark, box(1.0, 0.04, GA - B0 + 0.5, SX, SY + 0.02, (B0 - 0.5 + GA) / 2));
  K.add(M.dark, box(1.0, 0.04, B1 + 0.5 - GB, SX, SY + 0.02, (GB + B1 + 0.5) / 2));
  add(Bridge, { id: 'span', a: [SX, SY, GA], b: [SX, SY, GB], w: 2.2, n: 3 });
  add(Ball, { id: 'ball3', a: [SX, SY + 0.04, B0], b: [SX, SY + 0.04, B1], r: 1.0, friction: 0.9, lock: true,
    gap: { bridge: 'span', from: (GA - B0) / (B1 - B0), to: (GB - B0) / (B1 - B0), lip: 'The ball stops at the gap: the stones that bridge it are down, and something in the floor below drives them.' },
    dropped: 'The stones sink from under the ball, and it drops. Another rolls out where the groove begins.' });
  add(Plate, { id: 'p3', at: [SX, SY, B1], r: 1.2 });
  const vEat = [SX, GC, C3 - 8.6];   // (issue #413: its breath clear of the core)
  add(Vane, { id: 'vE', at: vEat, r: 2.1, great: true, reach: VANES.reach,
    washed: 'The great vane turns in the fan’s gust, and up on the raised walk stones grind up into the gap.' });
  add(Updraft, { at: vEat, r: 2.5, h: VANES.breath - 1, lift: 8, hint: 'A thin breath rises through the great vane’s frame. Open your wings in it.' });
  add(BreathGauge, { shows: 'breath', room: 'loft', at: [-11, GC, C3 + 9] });
  // the crown's floor, a ring round the core (the second iris there before)
  K.both(M.floor, T(annulus(VANES.iris2 + 0.1, GR + 0.4, 0.6, 56), [0, GK, C3]));
  K.add(M.trim, T(annulus(VANES.iris2 + 0.1, VANES.iris2 + 0.7, 0.04, 40), [0, GK + 0.02, C3]));
  add(Rim, { id: 'iris2', at: [0, GK, C3], r: VANES.iris2 });

  // ---- the crown: the eye on its pillar east of the middle, whose lids lift only while the ring and the great vane at once
  // (G2, issue #413: the hook and the fan); the high ledge by the north door 16 m over its floor
  add(Mark, { room: 'crown', at: [-8, GK, C3 - 7.5], yaw: Math.PI * 0.7 });
  K.both(M.floor, T(sector(GR - 8, GR + 0.2, rotA(0) - 0.42, rotA(0) + 0.42, 0.8), [0, H0, C3]));
  K.both(M.wall, T(new THREE.ConeGeometry(3.2, 4, 4, 1, true).rotateY(Math.PI / 4), [0, H0 - 2.8, C3 + GR - 2.6], [Math.PI, 0, 0]));   // (its corbel)
  const EC = [9.8, GK + 6.8, C3 + 3.5], vCat = [5, GK, C3 + 8.6], yC = Math.atan2(vCat[0] - EC[0], vCat[2] - EC[2]);
  eyePillar(EC, yC, GK);
  add(Switch, { id: 's4', at: EC, yaw: yC, size: 1.0, lids: true,
    wrong: 'The splash patters on the eye’s lids. They lift only while two things at once: the great vane in the floor turns, and the ring on its chain is pulled.' });
  add(Vane, { id: 'vC', at: vCat, r: 2.2, great: true, reach: VANES.reach,
    washed: 'The great vane turns in the fan’s gust. On the pillar, the eye’s lids stir.' });
  add(Updraft, { at: vCat, r: 2.5, h: VANES.breath, lift: 8, hint: 'A thin breath rises through the great vane’s frame. Open your wings in it.' });
  // the ring on its chain from a sleeve high on the wall: down while the house breathes in, the hook's to tug
  add(HookBell, { id: 'ringS', at: RING.at, chain: 0.8, yaw: Math.atan2(RING.from[0] - RING.at[0], RING.from[2] - RING.at[2]), size: 0.55, from: RING.from });
  add(CrownRing, { id: 'rS', ringId: 'ringS', at: RING.at, sleeve: RING.sleeve, from: RING.from });
  add(BreathGauge, { shows: 'breath', room: 'crown', at: [-12.5, GK, C3 + 7] });
  // the draught the chest unstops, while the house breathes out: from the plinth up through the oculus, on up through each
  // floor of the core as it is let on (the eye woken, the ball on its plate), past the crown to the high ledge
  add(Updraft, { at: [0, 11.62, C3], r: 2.5, h: G0 + 3 - 11.62, heights: [[{ open: 'iris2' }, H0 + 3 - 11.62], [{ open: 'iris' }, GC + 3 - 11.62]], lift: 12, when: { all: [{ gadget: true }, OUT] },
    hint: 'The draught rushes up past you. Open your wings in it.', ride: 'The draught off the plinth fills your wings and carries you straight up.' });
  // (issue #436) and its breath spread under the drum's roof at the high ledge's height, while it rises that far: off its
  // top the wings glide on to the ledge as out in the world (a house's still air glides them steeper: player.js HOUSE_GLIDE)
  add(WingAir, { min: [-GR, H0 - 1, C3 - GR], max: [GR, H0 + 6, C3 + GR], when: { all: [{ gadget: true }, OUT, { open: 'iris2' }] } });
  add(Door, { id: 'd3', at: [0, H0, C3 + GR + 0.7], w: D.w, h: D.h, lamps: [{ lit: 's4' }] });
  // (G6) a fall down the core or the Flue lands soft: the house's breath under its floors
  add(SoftFloor, { zones: [
    { x: 0, z: C3, y: 11.6, r: 3.9, said: 'The plinth’s breath breaks your fall.' },
    { x: 0, z: C3, y: G0, r: GR, rin: 3.9, said: 'The Well’s breath breaks your fall.' },
    { x: 0, z: C3, y: GC, r: GR, rin: VANES.iris, said: 'The Well’s breath breaks your fall.' },
    { x: 0, z: C3, y: GK, r: GR, rin: VANES.iris2, said: 'The Well’s breath breaks your fall.' },
    { x: FLUE.x, z: C3, y: FLUE.foot, r: FLUE.r, said: 'The Flue’s breath breaks your fall.' },
  ] });

  flue(rt, K, M, { C3, G0, GK });
  windClock(rt, K, M, { C3, G0, GR, D: ROOMS.door, blue });

  // ---- the Warden's Hall (floor 84.6, a great drum), its corridor from the high door
  const CW = C3 + GR + 1.4 + 3 + 21.4;   // 141.2
  K.slab(-cw, C3 + GR + 0.6, cw, CW - 20.6, H0, 0.8);
  K.wall(-cw, C3 + GR + 1.4, -cw, CW - 20.6, H0, ch, { t: 0.8 }); K.wall(cw, CW - 20.6, cw, C3 + GR + 1.4, H0, ch, { t: 0.8 });
  K.both(M.wall, box(2 * cw + 0.8, 0.8, CW - 20.6 - C3 - GR - 0.6, 0, H0 + ch + 0.4, (C3 + GR + 0.6 + CW - 20.6) / 2));
  add(Mark, { room: 'hall', at: [2.2, H0, C3 + GR + 2.6], yaw: -Math.PI / 2 });
  const HR = 20;
  K.rotunda({ x: 0, z: CW, y: H0, r: HR, h: 30, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.3 });
  K.both(M.stone, lathe([[6.5, 0], [6.5, 0.6], [5.8, 0.8], [0.01, 0.8]], 32).translate(0, H0, CW), new THREE.CylinderGeometry(6.3, 6.5, 0.8, 24).translate(0, H0 + 0.4, CW));
  K.add(M.glyph, T(new THREE.TorusGeometry(6.1, 0.08, 4, 56), [0, H0 + 0.83, CW], [Math.PI / 2, 0, 0]));
  band(0, CW, HR, H0 + 11, 1.4, 0.22, [[0, 0.25], [Math.PI, 0.25]]);
  // four stone discs on columns round the hall, eight metres up: somewhere to stand over it
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) / 4 * TAU, x = Math.sin(a) * 13, z = CW + Math.cos(a) * 13;
    K.column(x, z, H0, 8, 0.8);
    K.both(M.floor, T(new THREE.CylinderGeometry(2.6, 2.3, 0.7, 20), [x, H0 + 8.35, z]));
  }
  // and four great vanes in the floor between them: the warden backs onto one when its hatch opens, and over a
  // turning one the draught holds the hatch wide
  rt.hallVanes = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    rt.hallVanes.push(add(Vane, { id: `vh${i}`, at: [Math.sin(a) * HALL.vane, H0, CW + Math.cos(a) * HALL.vane], r: 2.2, great: true, reach: HALL.reach, linger: 1.2 }));
    // (the breath through each: open wings ride it up over the warden's crown, and hover there to shoot down)
    add(Updraft, { at: [Math.sin(a) * HALL.vane, H0, CW + Math.cos(a) * HALL.vane], r: 2.5, h: HALL.breath, lift: 9, hint: 'A breath rises through the vane’s frame. Open your wings in it.' });
  }
  add(Door, { id: 'd5', at: [0, H0, CW + HR + 0.7], w: D.w, h: D.h });
  // the way out: a corridor to a dark doorway
  K.slab(-cw, CW + HR + 0.6, cw, CW + HR + 10, H0, 0.8);
  K.wall(-cw, CW + HR + 1.4, -cw, CW + HR + 10, H0, ch, { t: 0.8 }); K.wall(cw, CW + HR + 10, cw, CW + HR + 1.4, H0, ch, { t: 0.8 });
  K.wall(cw, CW + HR + 10, -cw, CW + HR + 10, H0, ch, { t: 0.8, holes: [{ at: cw, w: 3.4, h: 5 }] });
  K.both(M.wall, box(2 * cw + 0.8, 0.8, 9.4, 0, H0 + ch + 0.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, H0, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, H0 + 2.5, CW + HR + 10.9));
  // the warden, standing still on its plinth
  const model = sentinelModel();
  model.pos.copy(K.world(0, H0 + 0.8, CW + 2));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, H0 + 0.8, CW);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, H0, CW), r: HR, y: K.world(0, H0, 0).y };

  // (the Flue's mark last: after the others, so the machines' ids by mark stay as they were)
  add(Mark, { room: 'flue', at: [FLUE.x + 8, FLUE.foot, C3 - 6], yaw: Math.PI / 2 });
  // (issue #413: and the high ledge's, by the high door: the guardian's a short walk on)
  add(Mark, { room: 'ledge', at: [-4, H0, C3 + GR - 4.5], yaw: Math.PI });
  const W = (x, y, z) => K.world(x, y, z), FX = FLUE.x;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(FX - FLUE.r - 3, -17, -3), V(Math.max(WING.vane.x + WING.vane.w / 2, WIND_CLOCK.hall.x1) + 3, H0 + 34, CW + HR + 12)),   // (issue #660: the Wind Clock, east)
    gadget: { at: W(0, 11.62, C3).toArray(), face: K.heading(Math.PI) },
    // (issue #375) the Ash Store's prize, the bridge pen: its chest on a mound by the store's wall, shut till the fight is won
    finds: { pen: { at: W(WING.store.x + PEN_AT[0], 0.3, WING.z + PEN_AT[1]).toArray(), face: K.heading(Math.PI) } },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, H0 + 0.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[FX, FLUE.foot + 6, C3, 22], [FX, G0 + 8, C3, 20], [FX, GK + 3, C3, 18], [-15, FLUE.foot + 5, C3, 9], [0, H0 + 6, C3, 24], [0, 6, 6, 14], [0, 6, 18, 24], [0, 6, 40, 24], [0, 8, C2, 26], [WING.store.x, 8, WING.z, 24], [WING.vane.x, 8, WING.z, 24], [0, 16, C2, 22], [0, 18, C3, 18], [0, G0 + 8, C3, 28], [0, GC + 8, C3, 26], [0, GK + 8, C3, 26], [0, H0 + 4, C3 + GR + 3, 9], [0, H0 + 12, CW, 30], [(WIND_CLOCK.hall.x0 + WIND_CLOCK.hall.x1) / 2, G0 + 8, C3, 26]],
    guardian: { def: { ...WARDEN, onHit: wardenHit, openFor: wardenOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the makers' tower on the rim
function exterior(scene, level, rt) {
  const TOP = 200, yaw = SITE.heading;
  const K = new TempleKit(rt.root, 'The Warden’s Well', V(SITE.x, TOP, SITE.z), yaw, rt.M);
  const M = rt.M, R = 16;
  const pale = makeMaterial({ color: '#9fbfdc', flat: true, glow: 0.25, key: 'incal.temple.carve' });
  landmark(K, 'incal', { R });
  // the doorway, after the picked entrance (references/temples/wardens-well/sheet-2.jpg): a porch of the drum's
  // stone out past the plinth, a tall pointed arch cut through it at the top of a short flight of steps, banded in
  // steel blue at its foot, an unlit lamp on a post beside the steps
  const P0 = R + 4, z0 = P0 - 0.4, z1 = P0 + 3.2, sill = 1.8, dw = 4.6;
  const steel = { paint: new THREE.Color(PALETTE.stone), smooth: false, side: THREE.FrontSide };
  // (the pointed door framed twice in the terraces' cream inside the landmark's arch, cyan light: src/temples/portal.js)
  const P = portal(K, { y: sill, z: P0 + 1.1, w: 5.5, h: 15, shape: 'pointed', layers: 2, step: .9, recess: .7, back: 1.0, into: 1.5, foot: 1.6,
    frame: lmStone('#f2dfbf', { course: 3.5, width: 9, wear: .2 }), inlay: '#86e8ff', sill: { w: 5.7, d: 2.0 } });
  K.add(pale,T(glyphGeometry(1.6,.1),[0,sill+21,P0+3.6]));
  K.both(M.floor, box(dw + 0.4, sill, z1 - z0, 0, sill / 2, (z0 + z1) / 2));
  K.both(M.floor, box(16, 0.3, 14, 0, 0.15, P0 + 8));
  K.stairs([0, sill, z1], [0, 0.3, z1 + 5.4], 7, { rise: 0.3 });
  for (const s of [-1, 1]) K.both(M.wall, box(1.1, 1.2, 5.6, s * 4.05, 0.9, z1 + 2.7));   // the steps' cheeks
  // the lamp on its post, not lit (nobody comes here to light it)
  K.both(steel, new THREE.CylinderGeometry(0.11, 0.14, 3.6, 8).translate(5.6, 2.1, z1 + 4.2));
  K.add(steel, new THREE.CylinderGeometry(0.42, 0.3, 0.2, 8).translate(5.6, 4.0, z1 + 4.2));
  // (its glass a mesh of its own: once the warden is still, Vell keeps its doorway lit, the world change)
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'incal.temple.doorlamp' });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 6).translate(5.6, 4.5, z1 + 4.2), lampM);
  lamp.position.copy(K.world(0, 0, 0)); lamp.rotation.y = yaw; lamp.userData.noCollide = true;
  rt.root.add(lamp);
  K.add(steel, new THREE.ConeGeometry(0.46, 0.5, 6).translate(5.6, 5.15, z1 + 4.2));
  K.flush();
  const at = K.world(0, sill, P0 + 1.6);
  const f = V(Math.sin(yaw), 0, Math.cos(yaw)), front = at.clone().addScaledVector(f, 9);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base: TOP, doorY: TOP + sill, R, top: TOP + 134, lampM,
    clear: [{ x: SITE.x, z: SITE.z, r: 58 }, { x: front.x, z: front.z, r: 48 }] };
}

// ------------------------------------------------------------------ the world change: the shaft breathes again
/**
 * Once the warden is stopped, the shaft's old breath comes back: beside the
 * Upward Shrine a column of rising air (pale rings drifting up it, the
 * fluid's colours in its motes) carries anyone who steps into it from the
 * bottom terrace up past every level to the rim, and sets them down on it.
 * The tower's crown burns bright.
 */
function change(scene, level, rt) {
  const B = BREATH;
  const root = new THREE.Group();
  root.name = 'The shaft’s breath (the world change)';
  scene.add(root);
  root.visible = false;
  const ax = Math.cos(B.a), az = Math.sin(B.a);
  const foot = V(ax * B.r, B.bottom, az * B.r), crest = V(ax * B.r, B.top + 6, az * B.r), land = V(ax * (B.R + 9), B.top + 2.5, az * (B.R + 9));
  // the rings: pale, inked, drifting up the column (and along its crest to the rim)
  const ringM = makeMaterial({ color: '#e8f4f2', glow: 0.35, flat: true, key: 'incal.breath' });
  const rings = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(B.radius * 0.8, 0.09, 4, 32).rotateX(Math.PI / 2), ringM);
    m.userData.noCollide = true; m.userData.dynamic = true;
    root.add(m); rings.push({ m, s: i / N });
  }
  const pathAt = (s, out) => {
    // up the column (most of the way), then out over the rim
    const up = 0.88;
    if (s < up) return out.lerpVectors(foot, crest, s / up);
    return out.lerpVectors(crest, land, (s - up) / (1 - up));
  };
  // a stone ring on the bottom terrace where it rises, carved with the glyph, and one on the rim where it sets you down
  const stone = makeMaterial({ color: '#d6c6a8', flat: true });
  for (const [p, r] of [[foot, B.radius + 0.6], [land, 2.6]]) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 6, 40).rotateX(Math.PI / 2).translate(p.x, p.y + 0.12, p.z), stone);
    g.userData.noCollide = true;
    root.add(g);
  }
  const sign = new THREE.Mesh(glyphGeometry(2.2, 0.12).rotateX(-Math.PI / 2).translate(land.x, land.y - 2.35, land.z), makeMaterial({ color: '#9fdcef', glow: 0.8, flat: true }));
  sign.userData.noCollide = true;
  root.add(sign);
  const crown = rt.outside?.kit ? rt.outside : null;
  let k = 0, want = 0, rideT = 0;
  const _p = V(), _d = V();
  return {
    root, foot, crest, land,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; root.visible = k > 0.001 || want > 0; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 3);
      root.visible = k > 0.01;
      if (!root.visible) return;
      for (const r of rings) {
        r.s = (r.s + dt * 0.012) % 1;
        pathAt(r.s, r.m.position);
        const fade = Math.min(1, r.s * 12, (1 - r.s) * 12);
        r.m.scale.setScalar(Math.max(0.01, fade * k * (1 + 0.08 * Math.sin(t * 2 + r.s * 30))));
      }
      ringM.uniforms.uGlow.value = 0.25 + 0.15 * Math.sin(t * 1.3);
      if (rt.outside?.lampM?.uniforms?.uGlow) rt.outside.lampM.uniforms.uGlow.value = 0.04 + 0.85 * k;
      // the ride: in the column you are lifted, steadied toward its middle; over the crest, carried out to the rim
      const P = rt.player;
      if (!P || P.riding || P.dead || k < 0.9) return;
      const flat = Math.hypot(P.pos.x - foot.x, P.pos.z - foot.z);
      const inColumn = flat < B.radius && P.pos.y > B.bottom - 1 && P.pos.y < crest.y;
      const toRim = _d.subVectors(land, crest).setY(0), along = Math.hypot(toRim.x, toRim.z);
      _p.subVectors(P.pos, crest).setY(0);
      const u = (_p.x * toRim.x + _p.z * toRim.z) / (along * along);
      const offLine = Math.hypot(_p.x - toRim.x * u, _p.z - toRim.z * u);
      const lineY = crest.y + (land.y - crest.y) * Math.max(0, u);
      const onCrest = u > -0.05 && u < 1 && offLine < B.radius && Math.abs(P.pos.y - lineY) < 5;
      if (inColumn) {
        P.vel.y = Math.max(P.vel.y, 12) + (14 - P.vel.y) * Math.min(1, dt * 2);
        P.vel.x += (foot.x - P.pos.x) * dt * 2.5; P.vel.z += (foot.z - P.pos.z) * dt * 2.5;
        P.onGround = false; P.gliding = false;
        if ((rideT += dt) > 0.4) rt.notice('The shaft’s breath lifts you, up past every level.', 'breath');
      } else if (onCrest && !P.onGround) {
        _d.normalize();
        // (held near the crest's line all the way: a steady sink of its own left you short of the rim, falling)
        P.vel.x = _d.x * 9; P.vel.z = _d.z * 9; P.vel.y = Math.max(P.vel.y, THREE.MathUtils.clamp((lineY + 0.6 - P.pos.y) * 1.5, -1.5, 2));
      } else rideT = 0;
      if (crown) void crown;
    },
  };
}

export const INCAL_TEMPLE = {
  id: 'incal', levelId: 'incal', name: 'The Warden’s Well', doorLabel: 'door of the makers’ tower',
  gadget: 'fan', gadgetBox: 'incal.temple.jetpack', arenaDoor: 'd3', arenas: ARENAS,   // (the box's id from when it held the jets: the saves' flag)
  origin: [420, 1400, 140], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  // (inside, the futuristic skin the author picked: dark slate rings of chamfered slabs, cyan circuits, lens terminals,
  // turning vanes, an iris round each oculus; issue #342, src/temples/skins/wardens-well.js)
  skin: wardensWellSkin,
  layout, exterior, change,
  local: { person: 'vell', out: 7, side: 6 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the tower it is cool and very tall, and something far overhead hums, round and round.',
  // the makers left the city its bellows in here: the quest starts when you land (the shaft itself is the wings' and its
  // air pillars': src/shaft-pillars.js)
  startsOnArrival: () => !items.has('fan'),
  arrivalLine: 'The makers left something for this city in their tower on the rim, round from the ship: the fan that kept the shaft breathing.',
  used: upUsed,   // (the temple quest's 'use' stage: src/temples/index.js)
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below, by the Upward Shrine, the shaft begins to breathe again.', 'resolved.out'); },
  /** (issue #562) The breath back: the hall's four great vanes turn for good once the warden is stopped (rt.calmK: its ending spins them up in its own panel). */
  onCalm(rt, k) { if (k > 0) for (const v of rt.hallVanes ?? []) { v.left = Math.max(v.left, 0.4 + 2.6 * k); v.warned = true; } },
  // its side vents: each a target while they are open in the first phase (the guardian's own weak point is
  // the one at its front: a shot into one round its side or back counts the same). From its second phase, its hatch
  // open, it backs toward the nearest of the hall's vanes and stands by it: the draught off that vane is the way in
  onConnect(rt) {
    const G = rt.guardian;
    if (!G?.model.vent) return;
    for (let i = 0; i < 3; i++) {
      const at = V();
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.8, position: () => G.model.vent(i, at), enabled: () => G.state === 'open' && G.phaseIndex === 0,
        onHit: (mode, point, dir, info) => G.hit('mouth', mode, dir, info) }));
    }
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.state !== 'open' || G.phaseIndex < 1 || !rt.hallVanes?.length) return;
      const m = G.model;
      const v = rt.hallVanes.reduce((b, x) => (Math.hypot(x.center.x - m.pos.x, x.center.z - m.pos.z) < Math.hypot(b.center.x - m.pos.x, b.center.z - m.pos.z) ? x : b));
      const dx = v.center.x - m.pos.x, dz = v.center.z - m.pos.z, d = Math.hypot(dx, dz);
      if (d > HALL.back) { const step = Math.min(d - HALL.back, HALL.drift * dt); m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step; G.keepIn?.(); }
    };
  },
};
