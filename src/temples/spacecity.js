import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import { stone, ceramic, metal, glazing } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, paint, prep } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Door, Plate, Ball, Switch, Updraft, Platform, Bridge, Mark, Pit, Key, Weight, Coffer } from './pieces.js';
import { Cushion } from './arzach.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { anchorModel, anchorGeometry } from './guardian-anchor.js';
import { chestMound } from '../boxes/mound.js';
import { mooringHouseSkin } from './skins/mooring-house.js';

// The City Floating in Space's temple: the Mooring-House, the makers' round house on the Moorings, an island of its
// own north of the Towers, a rising bridge to it. The islands of the city are moored to each other by the moorers'
// cables, and the great capstan in the Mooring-House holds them all together, kept by the makers' Anchor-Warden. The
// night the singing light passed, its note ran down every cable at once; since then the Warden has been letting the
// cables out, the islands drift apart a hand's width a night and the bridges creak. It is a machine: you stop it.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: PULLING THINGS HOME
// ACROSS THE VOID. Its floors stop short over the stars; what you need is out on a cable where you can't walk, and
// the tether (the gun's new mode, src/fluid-kit.js MODES.tether) brings it home. Since v1.83 (issue #417, the temple best
// practices, docs/design/temple-best-practices.md) the house turns on ONE STATE: THE MOORED ROOM, a round room of the
// makers floating in the Mooring Hall, docked at the low dock (the east landing, y 0) or the high dock (the gallery, y 11).
// It is a lift and a key at once. On the one great cable it hangs on, every counterweight in the house: the room low,
// they rise; the room high, they sink. A lamp and a little gauge of the room in every room say which (MooringGauge).
//   the Landing Stage    the first mark, the way out
//   the Capstan Hall     the hub: a tall round hall round the dead great capstan. The capstan's lever (MooringLever)
//                        sends the room up or down from here, before the tether too. Ways off it to the two wings,
//                        south-west and south-east, the great door north, and high up the balcony (the perch). (#477)
//                        East, the Warden's gate: bars, and through them the Capstan Floor and the Anchor-Warden, seen
//                        from the first visit; opened from inside at the end. On its south-east side the caged coffer,
//                        its weight high on a mooring mast (the grappling hook): a reward
//   the Winch Room       (south-west) the counterweight ball rolled into its socket: the Lamp Shaft's gate rises
//   the Lamp Shaft       (south-east) the void breathes up its grating, but only with the shaft's counterweight hauled
//                        up off it (the room low: turn the capstan); the wings ride the breath to the pier's top and
//                        the lamp-eye, which opens the great door. (#561) From the great door the eye is seen through
//                        two glazed windows, one in the hub's wall and one in the shaft's, high over the shaft's gate
//   the Cord Loft        the makers' chest: TETHER MODE. Its try: a ring that brings a lamp down. The ring that holds
//                        the door into the Mooring Hall hangs on the house's cable: hauled up under the roof while the
//                        counterweights are up, down within the tether's reach once the room is sent high again
//   the Mooring Hall     the great hall (G4): 57 by 73 m, open to the stars, its floors seen at once: the east landing
//                        (y 0) from the loft, the gallery (y 11) along the south wall in two halves with the room's
//                        shaft between them, the west landings (y 0 and y 6) behind a moorers' screen of bars. The room
//                        docks low at the east landing or high between the gallery's halves (it bridges them); a
//                        moorers' ring on a post at each dock (DockRing) pulls it home with the tether; its own capstan
//                        sends it to the other dock after a breath (step off, and it goes without you). A gate at each
//                        dock opens while it is docked there. The gallery's east half drops onto the east landing over
//                        a cushion of the void's breath (G6)
//   the Rope Store       south off the gallery's west half (an arena): its shutter rises on a counterweight (the room
//                        low), so you send the room down and stay behind; won, its small key; the room's ring calls it
//                        home again, the only way back east
//   the moorers' gate    (two keyholes, #561: the Rope Store's small key and the Anchor Hold's)
//                        from the gallery's east half to the Capstan Hall's balcony: the great key's
//                        cage, a ball out on a cable-rail pulled home and (G2: the tether and an older tool at once) a
//                        ring hung over the hall only the seeing lens shows, pulled; the cradle down to the hub. (#477:
//                        the ring hangs on the house's cable the other way round from the loft's: down within reach with
//                        the room LOW, so you send the room down without you from the gallery and come back: the twist)
//   the gangway          the east landing's ball pulled home, and the room high (the gangway hangs on its cable):
//                        across to the west landing
//   the Cable Walk       up from the west landing to its upper part: slung from the counterweights, it hangs level only
//                        with the room low (a lever there). The west door, open, into the Chain Locker
//   the Chain Locker     (#561: north off the east landing until then, its ring three rooms from the door it opened) past
//                        the west door: push its ball OUT along its rail over the well, and its weight brings the ring
//                        of its far door's chain down within reach: pull it (push, then pull)
//   the Anchor Hold      (#477, where the Capstan Floor stood) a round hall over the void past the Chain Locker, a well in
//                        its middle: the Warden's spare anchor-ball out over it on a cable-rail, pulled home with the
//                        tether, lowers the cage of the moorers' second small key across the well
//   the Capstan Floor    (#477: east of the Capstan Hall, between it and the Cord Loft; its great door off the loft, a
//                        short antechamber, the way out its gate into the hub and a door east into the world)
//                        the guardian (a robot: its meter is damage): the Anchor-Warden. When it has thrown its
//                        anchor and its drum stalls, pull the anchor home with the tether and it jams. In its second
//                        phase it hooks them over the bollards; in its last it pays them out over the void, out of
//                        reach: push its capstan bars to wind them in, then pull
// (v1.77, issue #336: redone to the temple redesign's rules: rooms 34 m across and more, doors 7 by 9, every puzzle in the
// middle of its room, the Rope Store the one fight; docs/design/temple-redesign.md.)
// After: the cables over the city hum taut, lamps along them, and the Mooring-House's capstan turns (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the Moorings (src/levels/space-city.js ISLANDS.moorings): its door faces south, down the bridge to the Towers. */
export const SITE = { x: 96, y: 14, z: -180, r: 10 };
SITE.heading = Math.atan2(96 - SITE.x, -152 - SITE.z);

/**
 * The Mooring-House's colours: outside, the city's cream and salmon adobe; inside, pale stone in big smooth panels,
 * teal railings and frames, brass capstans and fittings, the glyphs and the pieces' light the starlight cyan; a
 * moorers' ring under every frieze glyph; its shade a cool blue-grey, its light the city's warm sun.
 */
export const PALETTE = {
  wall: '#efe9de', wall2: '#e7dfd0', wall3: '#f6f1e8', floor: '#e4dccd', floor2: '#d6ccb9', trim: '#4f9a98', fitting: '#d2a648',
  dark: '#2e3550', stone: '#e9dfcf', accent: '#e39a7f', glow: '#7fe3ec', glyph: '#7fe3ec', lamp: '#f2d48a', sand: '#e6d6bd', sand2: '#d9c7a8', void: '#0b0f1c',
  look: {
    all: { shadeFlat: 0.12, shadeHue: 0.8, shade: 0.5 },
    wall: { mode: 0, grid: 3.0, plates: true },
    glyph: { glow: 0.45 },
    fitting: { metal: 'brass' },
  },
  bands: [{ at: 0.72, h: 0.32, color: '#4f9a98' }, { y: 0.35, h: 0.5, color: '#e39a7f' }],
  ornament: { kind: 'mooring', color: '#d2a648', color2: '#7fe3ec', metal: 'brass', glow: 0.6 },
  light: { shadow: '#a7b6c9', light: '#fff3e2', sun: '#ffe7c4' },
};

// ------------------------------------------------------------------ the plan (the kit's local metres)
// (v1.77, issue #336: the house redone to the temple redesign's rules, docs/design/temple-redesign.md: every puzzle or
// fight room 30 m across or more under 16 m and more, every door between two rooms 7 by 9 (DOOR), each puzzle in the
// middle of its room, the Rope Store the house's one fight. The pieces, the grooves' lengths, the jumps and the timings
// as they were: what moved is where they stand.)
const C1 = 30, R1 = 18;                          // the Capstan Hall: its middle (z) and radius (36 m across)
const SW = -Math.PI * 3 / 4, SE = Math.PI * 3 / 4;  // its two wings
/** A door between two rooms (the rules: 6 to 10 m wide, 8 to 12 high). */
export const DOOR = { w: 7, h: 9 };
/** A passage between two rooms (the layout's own corridor): 8.6 m between its walls' middles, so a door and its frame fit. */
const PASS = { w: 8.6, h: 9.6 };
/** A doorway in a hall's wall (a little narrower than the passage between its walls' inner faces: no face shared). */
const HOLE = { w: 7.6, h: 9.4 };
/** A point along the hall's radial at angle a, d metres out: [x, z]. */
const hallAt = (a, d) => [Math.sin(a) * d, C1 + Math.cos(a) * d];
/** A point d metres out along the hall's radial at angle a, s metres to its side: [x, z]. */
const wingAt = (a, d, s = 0) => [Math.sin(a) * d + Math.cos(a) * s, C1 + Math.cos(a) * d - Math.sin(a) * s];
/** The Winch Room and the Lamp Shaft: round halls `r` m across their middle, `d` m out along the hall's radials. */
export const WING = { d: 40, r: 17, h: 18 };
const WINCH = hallAt(SW, WING.d), SHAFT = hallAt(SE, WING.d);
/** The Lamp Shaft's pier (out along its radial from the hall: the void's breath at `draught`, the pier's middle at `pier`, its top at `top`). */
export const SHAFT_PIER = { draught: 37, pier: 43.3, top: 13, eye: 44, side: -1.2, stone: 1.0 };
/**
 * (issue #561) The great door's lamp-eye, seen from the door: on the pier's top `side` m off its radial on a stone `stone`
 * m tall (the top still hides it from the shaft's floor), and two glazed windows on the line from the door to it, one in the
 * Capstan Hall's wall (`hall`: its angle round the hall, its foot and height), glazed, and one in the Lamp Shaft's (`shaft`:
 * round the shaft), open, high beside the shaft's gate. The glass stops a splash: the eye is woken from the pier's top.
 */
export const D1_WINDOWS = { hall: { a: 1.978, w: 3.0, y0: 6.0, h: 4.4 }, shaft: { a: -0.483, w: 3.0, y0: 7.6, h: 4.8 } };   // (each two stones of its wall)
/** The moorers' corridor from the gallery's east half to the Capstan Hall's balcony, along x at `z`, its floor at the
 * gallery's; its gate (the small key) in the short passage between the two halls' walls (v1.83). */
export const MOOR = { z: 26, gate: -19.1 };
export const MOOR_A = Math.atan2(-Math.sqrt(R1 * R1 - (MOOR.z - C1) ** 2), MOOR.z - C1);   // (where it meets the hall's wall)
/**
 * (v1.83, issue #417) The Mooring Hall, the great hall (G4): its inner faces (x0..x1, z0..z1), its walls from y to y + h,
 * open to the stars (it replaced the Drift, the Cable Walk and the Balance). Its floors: the gallery (`GALLERY`, y 11)
 * along the south wall, in a west half (x0..w) and an east half (e..x1) with the moored room's shaft between them, its
 * drop (x, half its width) off the east half's lip onto the cushion (`catch`: x, z, r) on the east landing below; the
 * east landing (`EAST`, y 0) from the loft, its apron under the gallery's east half out to the shaft; the west landings
 * (`WEST`): its lower part (y 0, zN) where the gangway lands and its upper part (y 6, zS) by the west door, the Cable Walk
 * between, behind the moorers' screen of bars along `lip`, `screen` m high (nothing glides in past it).
 */
export const MH = { x0: -78, x1: -21, z0: 21, z1: 94, y: -4, h: 34 };
export const GALLERY = { y: 11, z1: 34.6, w: -57.9, e: -44.3, drop: [-31, 2.2], catch: [-31, 38.8, 3.4] };
export const EAST = { lip: -36, apron: GALLERY.e, apronZ: 46 };
export const WEST = { lip: -56, yN: 0, yS: 6, zN: [70, MH.z1], zS: [44, 56], walk: -67, gang: 84, screen: 16, catch: [-63.6, 3.6, 68.8] };
/** The east landing's ball (the Drift's before v1.83): its cable-rail out over the void at z, home a, out b, its plate. */
export const DRIFT = { z: 72, a: -33.4, b: -41.4, plate: -34.4 };
/**
 * (v1.83, issue #417) The moored room: a round room of the makers (`r` its floor's radius, `wall` its ribs', `h` its roof)
 * hung on the house's great cable in the shaft between the gallery's halves, its middle at (x, z); docked low (its floor at
 * y `low`, the east landing's) or high (`high`, the gallery's). It rides `speed` m/s, `wait` s after its capstan is turned
 * (time to step off); its doorways east and west, `door` m wide.
 */
export const ROOM = { x: (GALLERY.w + GALLERY.e) / 2, z: 27.9, r: 6.6, wall: 6.2, h: 6.4, low: 0, high: GALLERY.y, speed: 2.6, wait: 2.2, door: 7.2 };
/** (v1.83) The moored room's two stops, as conditions: docked low (the counterweights up) or high (they sink). */
export const LOW = { drumOn: ['mooring', 'mLow'] }, HIGH = { drumOn: ['mooring', 'mHigh'] };
/** (v1.83) The house's state in its lamps: amber while the room is docked low, starlight blue while it rides high. */
export const STATE_LOOK = { low: '#ffb35a', high: '#8fd8ff', glow: [0.55, 0.8] };
/**
 * (v1.83; issue #561: north off the east landing until then, three rooms from the door its ring opened, out of sight) The
 * Chain Locker, through the Mooring Hall's west door off the upper west landing (its east side the hall's west wall), on
 * the way to the Anchor Hold: its middle (x, z) on the west door's axis, its floor at `y` (the upper landing's); its way on,
 * the far door gN, in its west wall. From its middle: its well (x0, z0, x1, z1) north of the way through, its ball's rail
 * across the way (x; home a, out b along z: the far cup over the well), the ring of the far door's chain (x, z) hung over
 * the well, and the ring's heights over the floor: up out of the tether's reach, down within it.
 */
export const LOCKER = { x: MH.x0 - 1.2 - 15, z: 46.5, y: WEST.yS, w: 30, d: 30, h: 18, well: [-6, 3, 6, 15], rail: 0, a: -6, b: 8, ring: [-4.6, 4.6], up: 14.2, down: 3.6 };
/** The Cord Loft: its middle (z) and radius; (v1.83) its ring's heights: down within the tether's reach, hauled up. */
export const LOFT = { z: 69, r: 17, h: 18, ring: [7.4, 15.6] };
/**
 * The Capstan Floor, the guardian's: its middle, radius, floor. (#477, the house reshaped: the guardian met early) east of
 * the Capstan Hall, between it and the Cord Loft: from the hub's first visit the Anchor-Warden is seen through the bars of
 * its gate (`WARDEN_GATE`), the way in is the great door off the loft (`a`: the floor's way to the loft, its gap's angle;
 * `hub`: its way to the hub), and the gate is opened from inside at the end. (West of the Mooring Hall until v1.85: the
 * Anchor Hold's place now, HOLD)
 */
export const FLOOR = { x: 40, z: 50.6, r: 19, y: 0, a: Math.atan2(-40, 18.4), hub: Math.atan2(-40, -20.6), windows: [-0.25, 0.6, 2.1, 2.95], out: 1.35 };
/** (#477) The Capstan Hall's side of the Warden's gate: the hall's angle toward the floor. */
export const WARDEN_GATE = { a: Math.atan2(FLOOR.x, FLOOR.z - 30) };
/**
 * (#477) The Anchor Hold, west of the Mooring Hall past the Chain Locker (#561), where the Capstan Floor stood: a round hall
 * over the void, a well in its middle (`well`: its radius), the Warden's spare anchor-ball out over it on a cable-rail
 * (`rail`: home a, out b, x from the hold's middle, along its z; its footstone's `plate`), pulled home with the tether: its
 * cable lowers the cage of the moorers' second small key across the well (`key`: x from the hold's middle; #561, where it
 * drew back the bar of the moorers' gate across the Mooring Hall, four rooms off).
 */
export const HOLD = { x: LOCKER.x - LOCKER.w / 2 - 1.2 - 8.2 - 19, z: LOCKER.z, r: 19, y: 6, well: 4.4, rail: { a: 7.5, b: 0.4, plate: 6.5 }, key: -10.8 };
HOLD.rail.plateAt = +((HOLD.rail.a - HOLD.rail.plate) / (HOLD.rail.a - HOLD.rail.b)).toFixed(3);
/** (issue #356) The bars across the Capstan Floor's four windows: a rail at `rail` m and `n` bars `gap` m apart over it (the window's gap is cut by whole stones: wider than its 9 m). */
export const WINDOW_BARS = { rail: 2.0, gap: 0.75, n: 17 };
/** (v1.53) The Rope Store, south off the gallery (an arena, the house's one fight since v1.77); its north side the Mooring
 * Hall's south wall (the Balance's before v1.83). */
export const STORE = { x: -64, z: MH.z0 - 1.2 - 15, w: 30, d: 30, h: 16.6 };   // (its roof over the hall's wall's top: no face shared)
STORE.zone = { min: [STORE.x - STORE.w / 2, 10, STORE.z - STORE.d / 2], max: [STORE.x + STORE.w / 2, 28, STORE.z + STORE.d / 2] };
/** (v1.53) The balcony's cable-rail in the Capstan Hall (v1.77: out from the balcony's lip toward the middle, over the
 * floor, `side` m beside the moorers' radial): the footstone `home` m from the hall's middle, the rail `rail` m on
 * inward (as long as it was round the wall); the balcony's lip at `lip`; the cradle and the great key on it; (v1.83) the
 * ring only the lens shows, hung in the air past the lip (d, side, height; issue #477: its height with the room low, `ringUp`
 * hauled up under the roof while the room is high). */
export const PERCH = { home: 9.4, rail: 4.476, side: 2.5, lip: 8, cradle: [6.0, -4.0], key: [14, -4], ring: [5.6, -1.2, 15.2], ringUp: 25 };
/** (the footstone 0.9 m in from the rail's home end: its stop along the groove) */
PERCH.plateAt = +(0.9 / (PERCH.rail + 0.9)).toFixed(3);
/** (v1.83) Where the house's state is set by hand: the capstan's lever in the Capstan Hall, the lever on the west landing's
 * lower part (local [x, y, z] and the way each faces); the moorers' rings on their posts at the docks (the tether's), each
 * calling the room to its dock (0 low, 1 high). */
export const LEVERS = [{ id: 'lvH', room: 'hall', at: [-7.4, 0, 30.9], yaw: Math.PI / 2 }, { id: 'lvW', room: 'west', at: [-61.5, 0, 78.5], yaw: -Math.PI / 2 }];
export const DOCK_RINGS = [
  { id: 'rgL', room: 'drift', at: [GALLERY.e + 1.6, 0, ROOM.z + 5.4], yaw: -Math.PI / 2, dock: 0 },
  { id: 'rgH', room: 'moor', at: [GALLERY.e + 1.6, GALLERY.y, ROOM.z + 5.4], yaw: -Math.PI / 2, dock: 1 },
  { id: 'rgW', room: 'moorW', at: [GALLERY.w - 1.6, GALLERY.y, ROOM.z + 5.4], yaw: Math.PI / 2, dock: 1 },
];

/**
 * (issue #630) The map's display in the Lamp Shaft (local m). Its floor is laid in rings of 2.6 m plates round the room's
 * middle (skins/mooring-house.js 'floor'), the fifth ring (13 to 15.6 m out, inside the teal border at 15.5) cut into 34
 * plates, turned by the skin's hash of the ring, `phase` of a plate: 0.173 as this Mac's GPU draws it (the hash is a GPU
 * sin and differs on the CPU, 0.857). The chest stands on plate `plate` of that ring, in its middle, its back square to the
 * wall stone behind it (`stone` of the rotunda's 39), its opening toward the room's middle.
 */
export const MAP_PLATE = (() => {
  const ring = 2.6, k = 5, np = 34, phase = 0.173, plate = 2, stone = 26, r = (k + 0.5) * ring;
  const a = ((plate + 0.5 - phase) / np - 0.5) * Math.PI * 2;   // (the skin's angle: atan2 of z, x off the middle)
  return { ring, k, np, phase, plate, stone, r, at: [SHAFT[0] + Math.cos(a) * r, 0, SHAFT[1] + Math.sin(a) * r], yaw: (stone + 0.5) * (Math.PI * 2) / 39 - Math.PI };
})();

export const LOGIC = {
  id: 'spacecity', entry: 'stage', gadget: 'tether',
  // (v1.83, issue #417: the Mooring Hall's rooms: `drift` its east landing (the Drift's near landing's id kept, so a save's
  // last mark holds), `float` the moored room, `moor` the gallery's east half, `moorW` its west half, `west` and `westS` the
  // west landings, `locker` the Chain Locker; the Cable Walk, the Balance and the Drift's far landing gone into the hall)
  rooms: {
    stage: { checkpoint: true, kind: 'passage' }, hall: { checkpoint: true, kind: 'puzzle' }, winch: { checkpoint: true, kind: 'puzzle' },
    stair: { checkpoint: true, kind: 'passage' }, stairTop: { kind: 'puzzle' }, loft: { checkpoint: true, kind: 'puzzle' }, drift: { checkpoint: true, kind: 'puzzle' },
    moor: { checkpoint: true, kind: 'puzzle' }, moorW: { checkpoint: true, kind: 'puzzle' },
    store: { checkpoint: true, kind: 'combat' }, perch: { kind: 'puzzle' }, locker: { checkpoint: true, kind: 'puzzle' },
    west: { checkpoint: true, kind: 'puzzle' }, westS: { checkpoint: true, kind: 'passage' },
    hold: { checkpoint: true, kind: 'puzzle' },
    ante: { checkpoint: true, kind: 'passage' }, arena: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'stage', b: 'hall' },
    { a: 'hall', b: 'winch' },
    { a: 'hall', b: 'stair', door: 'g1' },          // the shaft's gate, while the counterweight sits on the winch's mouth
    { a: 'stair', b: 'stairTop', door: 'breath' },  // (v1.83) the void's breath up the shaft to the pier's top: the room low
    { a: 'hall', b: 'loft', door: 'd1' },           // the great door: the lamp-eye up the shaft lit
    { a: 'loft', b: 'drift', door: 'd2' },          // the ring on the house's cable over the loft's floor
    // the moored room: called home to the low dock with the tether and ridden up to the high one (latched for the logic:
    // from the east landing a moorers' ring calls it whenever you want it); docked high it bridges the gallery's halves.
    // (The gates at its docks, dockL / dockH / dockW, open only while it is docked there: their pieces')
    { a: 'drift', b: 'moor', door: 'ride' },
    { a: 'moor', b: 'moorW', door: 'rideW' },
    { a: 'moor', b: 'drift', oneWay: true },        // (G6) the drop off the gallery's east half onto the cushion below
    { a: 'moorW', b: 'store', door: 'dR' },         // the Rope Store: its shutter on a counterweight (the room low), an arena
    { a: 'moor', b: 'perch', door: 'sc' },          // the moorers' gate (its two small keys, #561) to the Capstan Hall's balcony
    { a: 'perch', b: 'hall', oneWay: true },        // and the cradle down
    { a: 'drift', b: 'west', door: 'br2' },         // the gangway: its ball pulled home, and the room high
    { a: 'west', b: 'westS', door: 'cw' },          // the Cable Walk: level only with the room low
    // (#561) the west door, open, into the Chain Locker; its far door the locker's ring pulled. (#477) The Anchor Hold
    { a: 'westS', b: 'locker' },
    { a: 'locker', b: 'hold', door: 'gN' },
    // (#477, the house reshaped: the guardian met early) the great door off the Cord Loft, and the Warden's gate into the
    // Capstan Hall: bars it is seen through from the first visit, opened from inside once it is stopped (the way out)
    { a: 'loft', b: 'ante' },
    { a: 'ante', b: 'arena', door: 'd6' },
    { a: 'arena', b: 'hall', door: 'd7' },
    { a: 'arena', b: 'out', door: 'd8' },           // (and the way out into the world, east off the floor, as every house's)
  ],
  elements: {
    // the winch's counterweight, rolled into its socket at the winch's mouth: the shaft's gate rises (its pawl holds it)
    ballW: { type: 'drum', room: 'winch', plate: 'pG', plateAt: 1, start: 0.12 },   // (issue #275: it starts 1.3 m along its groove: room behind it to push from)
    pG: { type: 'plate', room: 'winch' },
    g1: { type: 'door', opens: { drumOn: ['ballW', 'pG'] }, latch: true },
    // (v1.83) the void's breath up the shaft: it blows once the shaft's counterweight is hauled up off the grating (the room
    // low), and bears the wings to the pier's top (latched for the logic: the capstan's lever is a room away)
    breath: { type: 'door', opens: LOW, latch: true },
    s1: { type: 'switch', room: 'stairTop' },        // the lamp-eye on the pier's top
    d1: { type: 'door', opens: { lit: 's1' }, latch: true },
    chest: { type: 'gadget', room: 'loft', item: 'tether' },
    t0: { type: 'switch', room: 'loft', needs: ['tether'], try: true },   // the loft's try: its ring brings the lamp down (nothing waits on it)
    // the ring over the loft's floor, its chain to the door into the Mooring Hall: on the house's cable, down within the
    // tether's reach only with the counterweights down (the room high)
    r1: { type: 'switch', room: 'loft', needs: ['tether'], when: HIGH },
    d2: { type: 'door', opens: { lit: 'r1' }, latch: true },
    // the Chain Locker (#561: past the west door, where its ring is seen from its far door): its ball pushed OUT along the
    // rail over its well into the far cup brings the ring of the far door's chain down within reach (push, then pull)
    ballK: { type: 'drum', room: 'locker', plate: 'pK2', plateAt: 1, start: 0.06 },
    pK2: { type: 'plate', room: 'locker' },
    rK: { type: 'switch', room: 'locker', needs: ['tether'], when: { drumOn: ['ballK', 'pK2'] } },
    gN: { type: 'door', opens: { lit: 'rK' }, latch: true },
    // the moored room's rides (the links'), and the gates at its docks, each open while it is docked there (their pieces)
    ride: { type: 'door', opens: HIGH, latch: true },
    rideW: { type: 'door', opens: HIGH, latch: true },
    dockL: { type: 'door', opens: LOW },
    dockH: { type: 'door', opens: HIGH },
    dockW: { type: 'door', opens: HIGH },
    // the Rope Store: its shutter on a counterweight (the room low); its keepers beaten, the small key's cage sinks (v1.53)
    arR: { type: 'arena', room: 'store' },
    kS: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arR' } },
    dR: { type: 'door', opens: LOW },
    // (v1.53: the Rope Store's small key. #561: two keyholes, the gate's answer read at the gate: the Rope Store's key and
    // the Anchor Hold's. Its bar hung on the hold's anchor-ball's cable since #477, four rooms off and out of sight)
    sc: { type: 'door', lock: 'small', keys: 2, latch: true },
    // the Anchor Hold, past the Chain Locker: across the well the cage of the moorers' second small key, a lamp-eye on its
    // post under stone lids; the Warden's spare anchor-ball out over the well, pulled home with the tether, lifts the lids on
    // its cable, and the eye splashed awake sinks the cage (the tether and the gun's first mode at once)
    bA: { type: 'drum', room: 'hold', plate: 'pA', plateAt: HOLD.rail.plateAt, start: 1, needs: ['tether'] },
    pA: { type: 'plate', room: 'hold' },
    eH: { type: 'switch', room: 'hold', when: { drumOn: ['bA', 'pA'] } },
    kH: { type: 'key', kind: 'small', room: 'hold', when: { lit: 'eH' } },
    // the Capstan Hall's balcony: the great key's cage, a ball out along a cable-rail from its lip pulled home onto the
    // cage's footstone, and (v1.83, G2: the tether and an older tool at once) the cage's chain on a ring hung over the hall
    // that only the seeing lens shows (the Footprint's), pulled
    bK: { type: 'drum', room: 'perch', plate: 'pK', plateAt: PERCH.plateAt, start: 1, needs: ['tether'] },
    pK: { type: 'plate', room: 'perch' },
    // (issue #477, the house's last twist before its guardian: the ring hangs on the far side of the capstan's cable from
    // the loft's, so it comes down within the tether's reach with the room LOW, not high: send the room down without you
    // from the gallery, and come back)
    rL: { type: 'switch', room: 'perch', needs: ['tether', 'monocle'], when: LOW },
    kB: { type: 'key', kind: 'big', room: 'perch', when: { all: [{ drumOn: ['bK', 'pK'] }, { lit: 'rL' }] } },
    // the east landing's ball, out on its cable-rail over the void: pulled home, and the room high, the gangway hangs taut
    ballD: { type: 'drum', room: 'drift', plate: 'pD', plateAt: 0.125, start: 1, needs: ['tether'] },
    pD: { type: 'plate', room: 'drift' },
    br2: { type: 'bridge', opens: { all: [{ drumOn: ['ballD', 'pD'] }, HIGH] }, latch: true },
    // the Cable Walk, slung from the counterweights: let down level only with the room low, and its catch on a ring hung
    // over the gap at its foot, pulled
    rW: { type: 'switch', room: 'west', needs: ['tether'] },
    cw: { type: 'bridge', opens: { all: [LOW, { lit: 'rW' }] } },
    warden: { type: 'boss', room: 'arena', needs: ['gun', 'tether'] },
    // the Capstan Floor's doors (its great key, v1.53; shut while the Warden fights; the way out): the floor's own (v1.77:
    // the rules measure the guardian's hall by them, its two sides). (#477) The way out is the Warden's gate into the hub
    d6: { type: 'door', lock: 'big', room: 'arena' },
    d7: { type: 'door', opens: { resolved: true }, room: 'arena' },
    d8: { type: 'door', opens: { resolved: true }, room: 'arena' },
    // (v1.76, issue #337) the Capstan Hall's caged coffer: the plate before it sinks the cage while weighed down; the moorers'
    // weight on its cleat high on a mast, pulled down into your hands by the grappling hook (a reward: `optional`); (v1.83)
    // the cage hangs on the house's cable too: it sinks only with the counterweights down (the room high)
    wC: { type: 'weight', room: 'hall', plate: 'pC', needs: ['hook'], optional: true },
    pC: { type: 'plate', room: 'hall' },
    cC: { type: 'cache', room: 'hall', when: { all: [{ pressed: 'pC' }, HIGH] } },
    // (v1.83, issue #417) the moored room, the house's state: docked high (1, the start) or low (0), saved. Set at the
    // capstan's lever in the Capstan Hall, at its own capstan, at the west landing's lever, and with the tether at the
    // moorers' ring of any dock (it comes home to that dock). Its stops are no plates anyone stands on (no room). (Last of
    // the things to do, so the scout asks for it only once nothing nearer is left: logic.next)
    mooring: { type: 'drum', room: 'hall', rooms: ['west', ...['drift', 'moor', 'moorW'].map((room) => ({ room, needs: ['tether'] }))], stops: { mLow: 0, mHigh: 1 }, start: 1, roll: 'hand', verb: 'moor' },
    mLow: { type: 'plate' }, mHigh: { type: 'plate' },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it). Raised on its
    // plinth (issue #630) by the Lamp Shaft's wall, left of the way in (70° round from it), on a plate of its floor's fifth ring (MAP_PLATE)
    map: { type: 'map', room: 'stair', at: MAP_PLATE.at, yaw: MAP_PLATE.yaw, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
  },
};

/** (v1.76, issue #337) The Capstan Hall's coffer, east: the hall's angle and radius of the coffer, its plate, the cleat's
 * weight (its foot at `y`, `r` from the hall's middle: out of any jump's reach), the cleat under it (v1.77: on an iron
 * mast standing in the floor, `mast` from the middle: the weight in the hall's middle, off the wall). */
export const CLEAT = { coffer: [Math.PI / 2 + 0.42, 15.6], plate: [Math.PI / 2 + 0.12, 7.4], weight: [Math.PI / 2 + 0.12, 10.0], mast: 10.9, y: 8.6 };

/** The Rope Store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's `foes`). */
export const ARENAS = [{
  el: 'arR', room: 'store', zone: STORE.zone, doors: ['dR'], extra: 2,
  shut: 'The door grinds shut behind you. Among the drums of cable, something winds itself up.',
  won: 'The last of them runs down among the drums. The key’s cage sinks, and the door lets go.',
}];

/** The fight's numbers: what one anchor pulled home is worth, phase by phase; how long it stays open; how far out over
 * the void it pays them in its last phase (m past the floor's rim) and how much one push on its bars winds in; how near
 * a thrown anchor must be for the tether (m). */
export const WARDEN = { pull: [0.2, 0.175, 0.125], open: [5.5, 6.5, 8.5], out: 8, wind: 3.2, reach: 7.2 };


export const ANCHOR_WARDEN = {
  kind: 'robot', name: 'the Anchor-Warden', final: 'break', speed: 1.4, wakeTime: 3,
  wake: 'A great capstan turns itself round with a groan. Its anchors lift.',
  openHint: 'Its anchor bites the floor and its drum stalls: tether it home.',
  resolved: 'The Anchor-Warden takes up its last cable, and locks.',
  missHint: 'It overreaches, its anchor out on the floor: tether it home.',
  phases: [
    { to: 0.4, attacks: ['bars', 'cast', 'drop'], pause: 1.6, hint: 'When its drum stalls, pull the anchor home with the tether.' },
    { to: 0.75, attacks: ['cast', 'spin', 'bars'], pause: 1.3, hint: 'It hauls on the edge bollards now: when it stalls, tether one home.' },
    { to: 1.0, attacks: ['casts', 'spin', 'drop'], pause: 1.1, hint: 'Its anchors are out over the void: push the capstan round, then pull.' },
  ],
  attacks: {
    bars: { shape: 'cone', range: 8.5, angle: 1.1, wind: 1.2, track: 0.6, part: 'arms', rig: 'coil', parts: ['arms'], splash: 0.6, active: 0.35, reach: 4.2, gap: 0.6, damage: 0.5, knock: 10, recover: 0.6, then: 'bars2' },
    bars2: { shape: 'cone', range: 8.5, angle: 1.1, wind: 0.8, track: 0.5, part: 'arms', rig: 'coil', side: -1, pose: 'bars', link: true, parts: ['arms'], splash: 0.6, active: 0.35, reach: 4.2, damage: 0.5, knock: 10, gap: 0.25, then: 'castEnd' },
    castEnd: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 2.6, wind: 1.3, track: 0.6, part: 'arms', rig: 'lean', pose: 'cast', link: true, damage: 0.75, knock: 8, recover: 0.8, open: 5.5 },
    cast: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 2.6, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', damage: 0.75, knock: 8, recover: 0.8, open: 5.5 },
    drop: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'core', rig: 'rear', wave: { speed: 9, reach: 15, width: 0.7, damage: 0.5 }, parts: ['body'], splash: 0.6, active: 0.35, blast: { kind: 'front', r0: 1, r1: 5, h: 0.6 }, reach: 5, damage: 1, knock: 12, recover: 1.0, open: 5.5 },
    spin: { shape: 'ring', at: 'self', radius: 7, wind: 1.3, part: 'arms', rig: 'spin', parts: ['arms'], splash: 0.6, active: 0.4, reach: 4.5, damage: 0.75, knock: 12, recover: 0.6, miss: 5 },
    casts: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', pose: 'cast', damage: 0.5, knock: 6, recover: 0.8, open: 6.5 },
  },
};

/** How long it stays open: its phase's at least (the last wants pushes and a pull). */
export function wardenOpenFor(g, a, s) { return s ? Math.max(s, WARDEN.open[Math.min(g.phaseIndex, 2)]) : s; }

/** A push on it winds in an anchor paid out over the void (its last phase); anything else rings off its brass. */
function wardenHit(g, part, mode) {
  const rt = g.rt, an = rt.anchor;
  if (mode === 'push') {
    if (g.state === 'open' && an?.out && an.far > 0) { rt.windAnchor?.(); return true; }
    rt.notice('The shove rings off its bars. It turns when its drum is slack.', 'aw.push');
    return true;
  }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  rt.notice('The fluid runs off its brass. Pull the anchors home.', 'aw.fluid');
  return true;
}


// ------------------------------------------------------------------ the moored room, the house's state (v1.83, issue #417)
/** The one lamp material every lever, gauge, ring and the room's capstan share (its colour set once a frame: MooredRoom). */
const stateLamp = () => makeMaterial({ color: STATE_LOOK.high, glow: STATE_LOOK.glow[0], flat: true, key: 'temple.spacecity.state' });
const roomBrass = () => makeMaterial({ color: '#b8904e', flat: true, metal: 'brass', refl: 0.3, key: 'temple.spacecity.roombrass' });
const roomIron = () => makeMaterial({ color: '#2c2d36', flat: true, metal: 'iron', refl: 0.2, key: 'temple.spacecity.roomiron' });
const _sc = new THREE.Color(), _mq = new THREE.Quaternion(), _mu = V(0, 1, 0), _md = V();
const ease3 = (k) => k * k * (3 - 2 * k);
/** A thin line (a cylinder 1 m tall, its foot at the origin) to stretch between two points each frame (stretch()). */
function line(rt, mat, r = 0.06) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 5).translate(0, 0.5, 0), mat);
  m.userData.noCollide = true; m.userData.dynamic = true;
  rt.root.add(m);
  return m;
}
// (issue #477: its own scratch vector: called with _md as `a` (the moored room's cable, the rings' chains, the shaft's
// counterweight's), it took a - a's difference for the cable's foot and drew every one of them off by the house's middle)
const _ms = V();
function stretch(m, a, b) {
  _ms.subVectors(b, a);
  const L = _ms.length();
  m.position.copy(a);
  m.quaternion.copy(_mq.setFromUnitVectors(_mu, _ms.divideScalar(Math.max(L, 1e-4))));
  m.scale.set(1, Math.max(0.01, L), 1);
}
/** The angle (rad) between two headings, -π..π. */
const angleTo = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * (v1.83, issue #417) The moored room (LOGIC `mooring`, a drum of two stops: low 0, high 1): this piece keeps the house's
 * state. A round room of the makers hung on the house's great cable in the shaft between the gallery's halves: its floor a
 * riding disc (a moving solid, as the Footprint's great lift, src/temples/spheres.js), its ribs, roof and doorways drawn and
 * its walls kept by hand (keep(): nobody walks through its ribs, in or out, but at a doorway that faces a dock it is docked
 * at: east at either dock, west at the high one, where it bridges the gallery's halves). Its own capstan in its middle
 * (A / ×) sends it to the other dock after a breath (ROOM.wait: time to step off); the moorers' ring at a dock (DockRing),
 * pulled with the tether, calls it home there; a lever (MooringLever) sends it either way. Leaving, it is at neither stop
 * (everything that waits on it shuts); docked, the logic's drum is at that stop. It lights the house's lamps (stateLamp:
 * amber low, starlight blue high) and its counterweights follow it (`s`: 0 low, 1 high).
 * o: { id: 'mooring', x, z, low, high, r, wall, h, door }
 */
export class MooredRoom {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, L = rt.logic;
    this.lowP = K.world(o.x, o.low, o.z); this.highP = K.world(o.x, o.high, o.z);
    const t = L.drumT(o.id);
    this.at = t >= 0.5 ? 1 : 0;   // (left half-way, saved on its way: it finishes the trip)
    if (Math.abs(t - this.at) > 1e-3) L.moveDrum(o.id, this.at);
    this.s = this.at; this.dest = null; this.wait = 0;
    // (the audits' point: where it is set first, the hub's lever; its shaft is charted as a lift for the maps, the layout's)
    o.at ??= LEVERS[0].at;
    this.lamp = stateLamp();
    this.setters = [];   // (the levers and the docks' rings: the scout's)
    rt.mooring = this;
    // ---- the room, in a group that rides (its floor's top at the group's origin)
    const M = rt.M, r = o.r, W = o.wall, H = o.h, half = Math.asin(Math.min(0.95, (o.door / 2) / W));
    this.half = half;
    // (its floor, the riding disc, in `group`; its ribs, roof, capstan and bars, all that stands on the floor, in `body`:
    // the contact audit measures a carrier's drawn top by its group, src/contact-audit.js)
    this.group = new THREE.Group();
    this.group.name = 'The Mooring-House: the moored room';
    this.body = new THREE.Group();
    this.body.name = 'The Mooring-House: the moored room’s ribs';
    rt.root.add(this.group, this.body);
    this.glow = makeMaterial({ color: rt.P.glow ?? '#7fe3ec', glow: 0.5, flat: true, key: 'temple.spacecity.roomglow' });
    const brass = roomBrass(), iron = roomIron();
    const add = (geos, mat, to = this.body) => { const m = new THREE.Mesh(mergeAll(geos), mat); to.add(m); return m; };
    add([new THREE.CylinderGeometry(r, r * 0.9, 0.8, 48).translate(0, -0.4, 0)], M.floor, this.group);
    add([new THREE.TorusGeometry(r * 0.94, 0.08, 4, 56).rotateX(Math.PI / 2).translate(0, -0.84, 0), glyphGeometry(r * 0.6, 0.05).rotateX(Math.PI / 2).translate(0, -0.86, 0)], this.glow, this.group);
    add([new THREE.TorusGeometry(r - 0.12, 0.06, 4, 56).rotateX(Math.PI / 2).translate(0, -0.05, 0)], this.glow, this.group);
    // its ribs, round but for its two doorways (east +x, west -x), a band at hand height and one under its roof
    const ribs = [], bands = [];
    const inDoor = (a) => Math.abs(angleTo(a, Math.PI / 2)) < half || Math.abs(angleTo(a, -Math.PI / 2)) < half;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + TAU / 48;
      if (inDoor(a)) continue;
      ribs.push(new THREE.BoxGeometry(0.24, H, 0.36).translate(0, H / 2, 0).rotateY(a).translate(Math.sin(a) * W, 0, Math.cos(a) * W));
    }
    for (const [a0, a1] of [[Math.PI / 2 + half, Math.PI * 1.5 - half], [-Math.PI / 2 + half, Math.PI / 2 - half]]) {
      bands.push(new THREE.TorusGeometry(W, 0.07, 4, 24, a1 - a0).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - a1).translate(0, 1.05, 0));
    }
    // the doorways' frames: posts and a lintel each
    for (const c of [Math.PI / 2, -Math.PI / 2]) {
      for (const sd of [-1, 1]) { const a = c + sd * half; ribs.push(new THREE.BoxGeometry(0.5, H, 0.5).translate(0, H / 2, 0).rotateY(a).translate(Math.sin(a) * W, 0, Math.cos(a) * W)); }
      ribs.push(new THREE.BoxGeometry(o.door + 0.6, 0.6, 0.5).translate(0, H - 0.3, 0).rotateY(c + Math.PI / 2).translate(Math.sin(c) * W * Math.cos(half), 0, Math.cos(c) * W * Math.cos(half)));
    }
    add(ribs, iron);
    add(bands, this.glow);
    // its roof: a disc of dark metal, a ring of light round it, the great cable's shackle on top
    add([new THREE.CylinderGeometry(W + 0.5, W + 0.3, 0.5, 48).translate(0, H + 0.25, 0), new THREE.CylinderGeometry(0.9, 1.2, 0.8, 16).translate(0, H + 0.9, 0)], iron);
    add([new THREE.TorusGeometry(W + 0.35, 0.07, 4, 56).rotateX(Math.PI / 2).translate(0, H + 0.02, 0)], this.glow);
    add([new THREE.TorusGeometry(0.6, 0.14, 6, 16).translate(0, H + 1.7, 0)], brass);
    // moorers' rings on its hull, east and west (drawn: the docks' rings are the ones the tether pulls)
    for (const c of [Math.PI / 2 + half + 0.25, -Math.PI / 2 - half - 0.25]) add([new THREE.TorusGeometry(0.42, 0.09, 6, 18).rotateY(c).translate(Math.sin(c) * (W + 0.35), 2.6, Math.cos(c) * (W + 0.35))], brass);
    // its capstan in its middle: an iron drum, four brass bars, the house's lamp on its lid
    this.cap = new THREE.Group();
    this.cap.add(new THREE.Mesh(mergeAll([new THREE.CylinderGeometry(0.5, 0.62, 1.1, 16).translate(0, 0.55, 0)]), iron));
    const bars = [];
    for (let i = 0; i < 4; i++) bars.push(new THREE.BoxGeometry(0.12, 0.12, 2.2).translate(0, 0.95, 0).rotateY((i / 4) * Math.PI));
    this.cap.add(new THREE.Mesh(mergeAll(bars), brass));
    this.cap.add(new THREE.Mesh(mergeAll([new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16).translate(0, 1.16, 0)]), this.lamp));
    this.body.add(this.cap);
    // the bars across its doorways, lifted while a doorway faces a dock it is docked at (drawn: keep() is the wall)
    this.gateBars = [Math.PI / 2, -Math.PI / 2].map((c) => {
      const g = new THREE.Mesh(mergeAll([new THREE.BoxGeometry(o.door, 0.14, 0.14).translate(0, 1.05, 0), new THREE.BoxGeometry(o.door, 0.1, 0.1).translate(0, 0.55, 0)]), brass);
      g.rotation.y = c + Math.PI / 2; g.position.set(Math.sin(c) * W * Math.cos(half), 0, Math.cos(c) * W * Math.cos(half));
      this.body.add(g);
      return { g, c, k: 0 };
    });
    for (const o of [this.group, this.body]) o.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    // the great cable, from its shackle up out of the hall
    this.cable = line(rt, roomIron(), 0.12);
    this.top = K.world(o.x, MH.y + MH.h + 6, o.z);
    this.solid = { pos: V(), r, top: 0, bottom: 0, vel: V(), flat: true };
    this.capAt = V();
    const P = () => rt.player;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.6, at: () => this.capAt,
      prompt: () => (this.at ? 'send the room down' : 'send the room up'),
      enabled: () => this.dest == null && this.carries(P()),
      distance: (p) => Math.hypot(p.pos.x - this.capAt.x, p.pos.z - this.capAt.z) + Math.max(0, Math.abs(p.pos.y - this.solid.top) - 1.2) * 4,
      use: () => (this.go(1 - this.at, 'capstan') ? (this.at ? 'down' : 'up') : null),
    });
    this.place(0);
    this.update(0, 0);
  }
  y() { const e = ease3(this.s); return THREE.MathUtils.lerp(this.lowP.y, this.highP.y, e); }
  /** Docked low (false while under way). */
  get low() { return this.dest == null && this.at === 0; }
  get high() { return this.dest == null && this.at === 1; }
  place(dt) {
    const y = this.y(), prev = this.group.position.y;
    this.group.position.set(this.lowP.x, y, this.lowP.z);
    this.group.rotation.y = this.rt.kit.heading(0);
    this.body.position.copy(this.group.position); this.body.rotation.copy(this.group.rotation);
    this.solid.pos.copy(this.group.position);
    this.solid.top = y; this.solid.bottom = y - 1.2;
    this.solid.vel.set(0, dt > 0 ? (y - prev) / dt : 0, 0);
    this.capAt.copy(this.group.position).add(_md.set(0, 1.2, 0));
    stretch(this.cable, _md.copy(this.group.position).setY(y + this.o.h + 1.7), this.top);
  }
  /** The traveller stands on its floor. */
  carries(P) { return !!P?.pos && !P.dead && Math.hypot(P.pos.x - this.lowP.x, P.pos.z - this.lowP.z) < this.o.wall && Math.abs(P.pos.y - this.y()) < 0.6; }
  /** Off to the other dock (1: up to the high dock, 0: down to the low); `by`: what sent it (its capstan waits a breath). */
  go(dest, by = null) {
    const rt = this.rt;
    if (this.dest != null) { rt.notice?.('The room is under way on its cable.', 'moor.busy'); return false; }
    if (dest === this.at) { rt.notice?.(dest ? 'The room is moored at the high dock already.' : 'The room is moored at the low dock already.', `moor.there.${dest}`); return false; }
    this.dest = dest; this.wait = by === 'capstan' ? ROOM.wait : 0.9;
    rt.sound?.critter?.('creak', 0.7);
    if (by === 'capstan') rt.notice?.('The capstan turns. The room will cast off in a breath.', 'moor.capstan');
    return true;
  }
  /** Its breath over: it casts off (at neither stop while it goes: what waits on it shuts, the gates at its docks first). */
  castOff() {
    const rt = this.rt, dest = this.dest;
    rt.logic.moveDrum(this.id, dest ? 0.55 : 0.45); rt.applyDoors?.();
    rt.rumble?.(1.2, 0.35); rt.sound?.critter?.('creak', 0.9);
    rt.notice?.(dest ? 'The room casts off and climbs its cable. Counterweights sink.' : 'The room casts off and sinks on its cable. Counterweights rise.', dest ? 'moor.up' : 'moor.down');
  }
  update(dt, t) {
    const P = this.rt.player, L = this.rt.logic;
    if (this.dest == null) this.solid.vel.set(0, 0, 0);
    else if (this.wait > 0) { this.wait -= dt; this.solid.vel.set(0, 0, 0); if (this.wait <= 0) this.castOff(); }
    else {
      const total = this.highP.y - this.lowP.y, dir = Math.sign(this.dest - this.s);
      this.s = THREE.MathUtils.clamp(this.s + (dir * this.o.speed * dt) / total, 0, 1);
      if (Math.abs(this.s - this.dest) < 1e-3) this.s = this.dest;
      this.place(dt);
      // going down with someone on it: they go down with it (as a Platform's riders)
      if (P && this.solid.vel.y < 0 && !P.climbing && this.carries(P) && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
      if (this.s === this.dest) {
        this.at = this.dest; this.dest = null; this.solid.vel.set(0, 0, 0);
        L.moveDrum(this.id, this.at); this.rt.applyDoors?.();
        this.rt.sound?.chime?.(); this.rt.rumble?.(0.8, 0.3);
        this.rt.notice?.(this.at ? 'The room docks high, between the gallery’s halves.' : 'The room docks low, by the east landing.', `moor.docked.${this.at}`);
        this.rt.game?.emit?.('temple:lit', { id: this.rt.id, el: this.id });
      }
    }
    if (P?.pos) this.keep(P);
    // the house's lamps: amber low, starlight blue high, between them under way
    const u = this.lamp.uniforms;
    u.uColor.value.set(STATE_LOOK.low).lerp(_sc.set(STATE_LOOK.high), this.s);
    u.uGlow.value = STATE_LOOK.glow[0] + (this.dest != null ? 0.25 * (0.5 + 0.5 * Math.sin(t * 9)) : 0.1 * Math.sin(t * 1.6));
    this.glow.uniforms.uGlow.value = this.dest != null ? 0.85 : 0.45 + 0.1 * Math.sin(t * 1.4);
    // its capstan turns as it rides; the bars across its doorways lift where it is docked
    this.cap.rotation.y = this.s * Math.PI * 4;
    for (const b of this.gateBars) {
      const want = this.open(b.c > 0 ? 'e' : 'w') ? 1 : 0;
      b.k = THREE.MathUtils.clamp(b.k + (want ? dt / 0.6 : -dt / 0.4), 0, 1);
      b.g.position.y = ease3(b.k) * (this.o.h - 1.8);
    }
  }
  /** A doorway (e: east, w: west) faces a dock it is docked at. */
  open(side) { return (this.dest == null || this.wait > 0) && (side === 'e' || this.at === 1); }
  /**
   * Its walls, kept by hand: from inside, nobody passes its ribs but at an open doorway; from outside, nobody walks into
   * them; nobody stands in its capstan.
   */
  keep(P) {
    const c = this.group.position, y = c.y;
    if (P.pos.y < y - 0.7 || P.pos.y > y + this.o.h - 0.4) return;
    const dx = P.pos.x - c.x, dz = P.pos.z - c.z, d = Math.hypot(dx, dz), W = this.o.wall, R = 0.45;
    if (d > W + R + 0.4 || d < 1e-4) return;
    const push = (to) => { P.pos.x = c.x + (dx / d) * to; P.pos.z = c.z + (dz / d) * to; const vr = (P.vel.x * dx + P.vel.z * dz) / d; if ((to < d && vr > 0) || (to > d && vr < 0)) { P.vel.x -= (dx / d) * vr; P.vel.z -= (dz / d) * vr; } };
    if (d < 0.62 + R) { push(0.62 + R); return; }   // (its capstan)
    const a = Math.atan2(dx, dz) - this.rt.kit.heading(0);
    const fit = Math.asin(Math.min(0.95, (this.o.door / 2 - R) / W));
    const side = Math.abs(angleTo(a, Math.PI / 2)) < fit ? 'e' : Math.abs(angleTo(a, -Math.PI / 2)) < fit ? 'w' : null;
    if (side && this.open(side)) return;
    if (d < W) { if (d > W - R) push(W - R); }
    else if (d < W + R) push(W + R);
  }
  /** Where to set it from (the scout's): the nearest lever, or ring once the tether is carried. */
  get center() {
    const P = this.rt.player?.pos, tether = this.rt.logic.has?.('tether');
    const list = this.setters.filter((s) => !s.ring || tether).map((s) => s.at);
    if (!P || !list.length) return this.capAt;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
  get pos() { return this.center; }
  dispose() { this.off?.(); this.cable.removeFromParent(); this.body.removeFromParent(); }
}

/**
 * (v1.83) A moorers' ring on a post at a dock (DOCK_RINGS): its line runs out to the moored room. Pulled with the tether
 * (from anywhere the tether's cone reaches it) the room comes home to this dock; anything else only rings it. Its line to
 * the room is drawn, short while the room is moored here, long while it is away.
 * o: { id, room, at (its post's foot, local), yaw (the way the ring faces), dock: 0 low | 1 high, sets: 'mooring' }
 */
export class DockRing {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, yaw = o.yaw ?? 0;
    K.both(roomIron(), T(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 10), [x, y + 1.2, z]));
    K.add(stateLamp(), T(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14), [x, y + 2.45, z]));
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.center = K.world(x + fx * 0.55, y + 1.9, z + fz * 0.55);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 22), roomBrass());
    this.ring.position.copy(this.center); this.ring.rotation.y = K.heading(yaw);
    this.ring.userData.noCollide = true; this.ring.userData.dynamic = true;
    rt.root.add(this.ring);
    this.glow = makeMaterial({ color: rt.P.glow ?? '#7fe3ec', glow: 0.1, flat: true, key: `temple.spacecity.ring.${o.id}` });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.glow);
    eye.position.copy(this.center); eye.userData.noCollide = true; eye.userData.dynamic = true;
    rt.root.add(eye); this.eye = eye;
    this.line = line(rt, roomIron(), 0.05);
    this.flash = 0;
    this.offT = registerTarget({ kind: 'switch', radius: 0.7, position: () => this.center, accepts: ['tether'], onHit: (mode) => this.hit(mode) });
    rt.mooring?.setters.push({ at: this.center, ring: this.id });
    this.later = !rt.mooring;
  }
  hit(mode) {
    const rt = this.rt;
    if (mode !== 'tether') { this.flash = 0.6; rt.sound?.critter?.('clank', 0.5); rt.notice?.('The ring clanks on its post. Its line runs to the room: pull it.', 'moor.ring.wrong'); return true; }
    if (rt.mooring?.go(this.o.dock, 'ring')) { this.flash = 1; rt.sound?.chime?.(); }
    return true;
  }
  update(dt, t) {
    const R = this.rt.mooring;
    if (this.later && R) { this.later = false; R.setters.push({ at: this.center, ring: this.id }); }
    this.flash = Math.max(0, this.flash - dt);
    this.glow.uniforms.uGlow.value = 0.25 + 0.15 * Math.sin(t * 2) + this.flash * 0.7;
    if (!R) return;
    // its line to the room's hull, at the ring's own side, a metre over its floor
    const c = R.group.position, sx = Math.sign(this.center.x - c.x) || 1;
    stretch(this.line, this.center, _md.set(c.x + sx * (ROOM.wall + 0.3), R.y() + 2.6, c.z + 2.2));
  }
  dispose() { this.offT?.(); this.line.removeFromParent(); }
}

/**
 * (v1.83) A lever of the moored room, by a hub (LEVERS): an iron arm on a post, the house's lamp on its knob (stateLamp).
 * Pulled (A / ×) it sends the room to the other dock (MooredRoom.go); the arm stands up while the room is high, down
 * while it is low. o: { id, room, at (its foot, local), yaw, sets: 'mooring' }
 */
export class MooringLever {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, [x, y, z] = o.at, H = 1.05;
    this.pos = K.world(x, y, z);
    K.both(roomIron(), T(new THREE.CylinderGeometry(0.3, 0.42, H, 8), [x, y + H / 2, z]));
    K.add(roomBrass(), T(new THREE.TorusGeometry(0.33, 0.05, 6, 20), [x, y + H, z], [Math.PI / 2, 0, 0]));
    K.add(stateLamp(), T(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), [x, y + H + 0.02, z]));
    this.top = K.world(x, y + H + 0.1, z);
    this.at = this.top;
    this.arm = new THREE.Group();
    this.arm.position.copy(this.top);
    this.arm.rotation.y = K.heading(o.yaw ?? 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6).translate(0, 0.5, 0), roomBrass());
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.02, 0), stateLamp());
    this.pivot = new THREE.Group(); this.pivot.add(bar, knob);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.a = 0;
    const R = () => rt.mooring;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (R()?.at ? 'send the moored room down' : 'send the moored room up'),
      enabled: () => !!R() && R().dest == null,
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { this.kick = 1; return R()?.go(1 - R().at, this.id) ? 'sent' : null; },
    });
    rt.mooring?.setters.push({ at: this.top, lever: this.id });
    this.later = !rt.mooring;
  }
  update(dt) {
    const R = this.rt.mooring;
    if (this.later && R) { this.later = false; R.setters.push({ at: this.top, lever: this.id }); }
    const want = ((R?.s ?? 1) * 2 - 1) * 0.75;
    this.a += (want - this.a) * Math.min(1, dt * 6);
    this.kick = Math.max(0, (this.kick ?? 0) - dt * 3);
    this.pivot.rotation.x = this.a + Math.sin(this.kick * 9) * 0.1 * this.kick;
  }
  dispose() { this.off?.(); }
}

/**
 * (v1.83) A gauge of the moored room (G1, readable everywhere): an iron post, two brass collars on it (the docks), a little
 * room between them that rides up and down with the real one, and the house's lamp over it (stateLamp). In every room but
 * the guardian's. o: { room, at (its foot, local), shows: 'mooring' }
 */
export class MooringGauge {
  constructor(rt, o) {
    const K = rt.kit, [x, y, z] = o.at;
    this.rt = rt; this.o = o;
    K.both(roomIron(), T(new THREE.CylinderGeometry(0.09, 0.15, 2.9, 8), [x, y + 1.45, z]));
    for (const h of [1.0, 2.4]) K.add(roomBrass(), T(new THREE.TorusGeometry(0.26, 0.05, 6, 18), [x, y + h, z], [Math.PI / 2, 0, 0]));
    K.add(stateLamp(), T(new THREE.SphereGeometry(0.22, 12, 8), [x, y + 3.05, z]));
    this.lo = K.world(x, y + 1.0, z); this.hi = K.world(x, y + 2.4, z);
    this.car = new THREE.Mesh(mergeAll([new THREE.CylinderGeometry(0.3, 0.3, 0.32, 14), new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14).translate(0, 0.18, 0)]), stateLamp());
    this.car.userData.noCollide = true; this.car.userData.dynamic = true;
    rt.root.add(this.car);
    this.update();
  }
  update() { this.car.position.lerpVectors(this.lo, this.hi, ease3(this.rt.mooring?.s ?? (this.rt.logic.check(HIGH) ? 1 : 0))); }
}

/**
 * (v1.83) A piece hung on the house's cable (the loft's ring, the Chain Locker's): it hangs `down` (local y) while its
 * condition holds (`when`: the room high, a ball in its cup), hauled `up` while it does not, a chain from it up to `top`.
 * o: { piece (the id of the piece it moves), when, up, down, top }
 */
export class Hoist {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    this.k = rt.logic.check(o.when) ? 1 : 0;
    this.chain = line(rt, roomIron(), 0.06);
    this.y0 = null;
  }
  update(dt) {
    const p = this.rt.piece(this.o.piece);
    if (!p?.group) return;
    const K = this.rt.kit;
    if (this.y0 == null) { this.base = K.local(p.group.position).y; this.y0 = p.group.position.y; this.c0 = p.center.y - p.group.position.y; }
    const want = this.rt.logic.check(this.o.when) ? 1 : 0;
    this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 2.2 : -dt / 2.2), 0, 1);
    const y = this.y0 + (THREE.MathUtils.lerp(this.o.up, this.o.down, ease3(this.k)) - this.base);
    p.group.position.y = y; p.center.y = y + this.c0;
    const top = K.world(0, this.o.top, 0).y;
    stretch(this.chain, _md.copy(p.group.position).setY(y + 0.8), p.group.position.clone().setY(top));
  }
  dispose() { this.chain.removeFromParent(); }
}

/**
 * (v1.83) The Lamp Shaft's counterweight on the house's cable: it rests on the grating, stopping the void's breath, while
 * the room is high; hauled up the shaft (`up`, local y of its foot) while the room is low. Solid only resting there.
 * o: { at: [x, y, z] its foot on the grating (local), r, h, up }
 */
export class ShaftWeight {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, [x, y, z] = o.at, r = o.r, h = o.h;
    this.foot = K.world(x, y, z); this.upY = K.world(x, o.up, z).y;
    this.group = new THREE.Group();
    this.group.add(new THREE.Mesh(mergeAll([new THREE.CylinderGeometry(r, r * 1.05, h, 24).translate(0, h / 2, 0)]), roomIron()));
    this.group.add(new THREE.Mesh(mergeAll([new THREE.TorusGeometry(r + 0.05, 0.1, 4, 32).rotateX(Math.PI / 2).translate(0, h * 0.25, 0), new THREE.TorusGeometry(r + 0.05, 0.1, 4, 32).rotateX(Math.PI / 2).translate(0, h * 0.75, 0)]), roomBrass()));
    // (its shackle and the cable's eye on top, apart from its group: a carrier's drawn top is its own, src/contact-audit.js)
    this.shackle = new THREE.Mesh(mergeAll([new THREE.CylinderGeometry(r * 0.4, r * 0.5, 0.8, 12).translate(0, h + 0.4, 0), new THREE.TorusGeometry(0.5, 0.12, 6, 16).translate(0, h + 1.2, 0)]), roomBrass());
    for (const o of [this.group, this.shackle]) o.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.group, this.shackle);
    this.cable = line(rt, roomIron(), 0.1);
    this.solid = { pos: V(), r, top: 0, bottom: 0, vel: V(), flat: true };
    this.update(0);
  }
  update(dt) {
    const s = this.rt.mooring?.s ?? (this.rt.logic.check(HIGH) ? 1 : 0);
    const y = THREE.MathUtils.lerp(this.upY, this.foot.y, ease3(s));
    this.group.position.set(this.foot.x, y, this.foot.z);
    this.shackle.position.copy(this.group.position);
    const resting = s > 0.995;
    this.solid.pos.copy(this.group.position);
    this.solid.r = resting ? this.o.r : 0.01;
    this.solid.top = y + this.o.h; this.solid.bottom = y;
    stretch(this.cable, _md.copy(this.group.position).setY(y + this.o.h + 1.3), this.group.position.clone().setY(this.upY + this.o.h + 12));
  }
  dispose() { this.cable.removeFromParent(); }
}

/** (v1.83, issue #417) A gate at a dock (`dockH`, `dockW`), a Door whose slab rises to let you by (the gallery's docks: the
 * one below at the east landing sinks, as doors do). */
export class DockGate extends Door {
  apply() {
    this.slab.position.y = ease3(this.k) * (this.h + 0.3);
    this.slab.visible = this.k < 0.999;
  }
}

/**
 * (#477) The Warden's gate between the Capstan Hall and the Capstan Floor: iron bars from the floor to the lintel on two
 * brass rails, too close to pass and open to the eye, so the Anchor-Warden is seen from the hall's first visit; it rises
 * into its lintel, as the docks' gates do, once the Warden is stopped (opened from inside: its logic `resolved`).
 */
/**
 * (issue #561) A pane of the makers' clear glass in a round hall's window (`at` its middle, `yaw` the hall's angle there, `w`
 * by `h`): seen through (its mesh `seeThrough`: scripts/temple-design/audit.mjs), and solid to a splash and to you (a block
 * of its own in the physics, as a shut door's).
 */
export class Pane {
  constructor(rt, o) {
    const K = rt.kit, { w, h } = o;
    this.id = o.id ?? null;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), glazing('#cfeff2'));
    glass.userData.noCollide = true; glass.userData.seeThrough = true;
    const frame = new THREE.Mesh(mergeGeometries([box(w + 0.3, 0.22, 0.3, 0, h / 2 + 0.05, 0), box(w + 0.3, 0.22, 0.3, 0, -h / 2 - 0.05, 0)].map(prep)), rt.M.trimMat);
    frame.userData.noCollide = true;
    this.group.add(glass, frame);
    rt.root.add(this.group);
    this.block = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
  }
  init(physics) { this.physics = physics; this.handle = physics.addCollider?.(this.block, { noClimb: true }) ?? null; }
  update() {}
  dispose() { if (this.handle != null) this.physics?.removeCollider?.(this.handle); this.handle = null; }
}

export class BarGate extends DockGate {
  constructor(rt, o) {
    super(rt, o);
    const { w = 4.4, h = 6 } = o, n = Math.round(w / 0.42);
    this.slab.clear();
    const bars = [], rails = [];
    for (let i = 0; i <= n; i++) bars.push(new THREE.CylinderGeometry(0.07, 0.07, h, 6).translate(-w / 2 + (i / n) * w, h / 2, 0));
    for (const y of [0.25, h * 0.55, h - 0.3]) rails.push(box(w + 0.1, 0.24, 0.3, 0, y, 0));
    const iron = makeMaterial({ color: '#3d3f4c', flat: true, key: 'temple.spacecity.gatebars' });
    const bm = new THREE.Mesh(mergeGeometries(bars.map(prep)), iron), rm = new THREE.Mesh(mergeGeometries(rails.map(prep)), rt.M.trimMat);
    for (const m of [bm, rm]) { m.userData.noCollide = true; this.slab.add(m); }
    this.apply();
  }
}

/**
 * (v1.53, issue #23) The Rope Store south off the Moorers' Gallery (an arena: drums of the moorers' spare cable), and on
 * the Capstan Hall's balcony inside the moorers' gate the great key's cage and a ball out along a cable-rail, pulled home
 * onto its footstone. (v1.77, issue #336: the store 30 m square under 17 m, its keepers round its middle among the drums;
 * the cable-rail out from the balcony's lip over the hall's floor, in the hall's middle.)
 */
function wings(rt, K, M, { BS, rail, cable, iron, brass, cableM }) {
  const add = (P, o) => rt.add(P, o);
  // ---- the Rope Store
  const S = STORE;
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: BS, h: S.h, roof: true, omit: ['n'] });   // (its north wall the Mooring Hall's, the doorway in it)
  // (v1.83) its shutter rides on a counterweight of the house's cable: up with the room low (and shut behind you while its
  // keepers stand); its lamp the state's
  add(Door, { id: 'dR', at: [S.x, BS, S.z + S.d / 2 + 0.6], ...DOOR, lamps: [LOW] });
  for (const [x, z] of [[-8, -7], [8, -6.4], [-8.6, 6.2], [8.4, 6.8]]) {
    K.both(brass, T(new THREE.CylinderGeometry(1.5, 1.5, 3.8, 18), [S.x + x, BS + 2.0, S.z + z], [0, 0, Math.PI / 2]));
    K.both(cableM, T(new THREE.CylinderGeometry(1.74, 1.74, 3.0, 18, 1, true), [S.x + x, BS + 2.0, S.z + z], [0, 0, Math.PI / 2]));   // (the cable wound on it, clear of the drum: solid, as you stand on it)
    K.both(iron, [box(0.4, 1.6, 2.4, S.x + x - 2.1, BS + 0.8, S.z + z), box(0.4, 1.6, 2.4, S.x + x + 2.1, BS + 0.8, S.z + z)]);
  }
  add(Key, { id: 'kS', at: [S.x, BS, S.z - S.d / 2 + 2.4], yaw: 0 });
  add(Mark, { room: 'store', at: [S.x + 7, BS, S.z + S.d / 2 - 3.6], yaw: Math.PI, foes: [S.x, BS, S.z] });
  add(MooringGauge, { room: 'store', at: [S.x - 9, BS, S.z + S.d / 2 - 2.4], shows: 'mooring' });

  // ---- the balcony's cable-rail, out from its lip over the hall's floor, the ball at its far end; the great key's cage
  const P = PERCH, Y = BS;
  const at = (d, s = P.side) => wingAt(MOOR_A, d, s);
  const [hx, hz] = at(P.home), [fx, fz] = at(P.home - P.rail);
  const L = Math.hypot(fx - hx, fz - hz), ry = Math.atan2(fx - hx, fz - hz), cx = (hx + fx) / 2, cz = (hz + fz) / 2;
  const rx = Math.cos(ry), rz = -Math.sin(ry);
  for (const sd of [-0.55, 0.55]) K.add(M.trim, box(0.12, 0.12, L + 1.2, cx + rx * sd, Y + 0.02, cz + rz * sd, ry));
  K.add(iron, box(1.6, 1.8, 0.4, fx + Math.sin(ry) * 1.2, Y - 0.6, fz + Math.cos(ry) * 1.2, ry));   // (the stop post)
  for (let k = 1; k < 4; k++) { const t = k / 4; K.add(iron, box(1.3, 0.5, 0.14, hx + (fx - hx) * t, Y - 0.27, hz + (fz - hz) * t, ry)); }   // (their tops under the balcony's floor)
  cable([fx + Math.sin(ry) * 1.2, Y - 0.2, fz + Math.cos(ry) * 1.2], [fx + Math.sin(ry) * 1.2, 28, fz + Math.cos(ry) * 1.2], 0, 0.06);   // (hung from the roof)
  add(Ball, { id: 'bK', a: [hx - Math.sin(ry) * 0.9, Y + 0.04, hz - Math.cos(ry) * 0.9], b: [fx, Y + 0.04, fz], r: 1.0, friction: 1.0 });
  add(Plate, { id: 'pK', at: [hx, Y, hz], r: 1.2 });
  { const [ux, uz] = at(16, 5.5); add(MooringGauge, { room: 'perch', at: [ux, Y, uz], shows: 'mooring' }); }
  const [kx, kz] = at(P.key[0], P.key[1]);
  add(Key, { id: 'kB', big: true, at: [kx, Y, kz], yaw: MOOR_A + Math.PI });
  // (v1.83, G2) the cage's chain runs up to the roof and back down to a moorers' ring hung in the air past the lip, that only
  // the seeing lens shows (the chain is there for anyone to see, ending in nothing): pulled with the tether, it lets the
  // cage go (with the ball home)
  const [gx, gz] = at(P.ring[0], P.ring[1]);
  add(Switch, { id: 'rL', at: [gx, P.ring[2], gz], yaw: MOOR_A, size: 0.85, pull: true, hidden: true, wrong: 'The ring swings on its chain. It wants pulling, not wetting.' });
  // (issue #477) on the house's cable: hauled up under the roof while the room is high, down within the tether's reach
  // with the room low (the loft's ring the other way round)
  add(Hoist, { piece: 'rL', when: LOW, up: P.ringUp, down: P.ring[2], top: 27.6 });
  cable([gx, 27.6, gz], [kx, 27.6, kz], 1.4, 0.06);
  cable([kx, 27.6, kz], [kx, Y + 3.2, kz], 0, 0.06);
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  // (in its futuristic skin, issue #342: the skin's paints, its capstan drum and its teal lines: skins/mooring-house.js)
  const SK = rt.skin?.house;
  const brass = SK?.brass ?? { paint: new THREE.Color('#d2a648'), smooth: false, side: THREE.FrontSide };
  const iron = SK?.iron ?? { paint: new THREE.Color('#3d3f4c'), smooth: false, side: THREE.FrontSide };
  const cableM = SK?.cable ?? { paint: new THREE.Color('#6a5844'), smooth: false, side: THREE.DoubleSide };
  const starM = SK?.star ?? makeMaterial({ color: PALETTE.glow, glow: 0.55, flat: true, key: 'temple.spacecity.starlines' });
  /** A straight corridor from (x0, z0) to (x1, z1), floor at y: a floor, two walls, a roof. */
  const corridor = (x0, z0, x1, z1, y, { w = PASS.w, h = PASS.h, roof = true } = {}) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sx = Math.cos(ry), sz = -Math.sin(ry);
    K.both(M.floor, box(w + 0.8, 0.8, L, cx, y - 0.4, cz, ry));
    for (const s of [-1, 1]) K.wall(x0 + sx * s * w / 2, z0 + sz * s * w / 2, x1 + sx * s * w / 2, z1 + sz * s * w / 2, y, h, { t: 0.8 });
    if (roof) K.both(M.wall, box(w + 1.6, 0.8, L, cx, y + h + 0.4, cz, ry));
  };
  /** A cable hanging in a curve from a to b, sagging `sag` (drawn only). */
  const cable = (a, b, sag, r = 0.07) => {
    const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return V(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t); });
    K.add(cableM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r, 4, false));
  };
  /** A teal railing along a void's edge from a to b ([x, z]) at y (solid). */
  const rail = (a, b, y, h = 1.0) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    K.both(M.trim, box(0.25, 0.2, L, (a[0] + b[0]) / 2, y + h, (a[1] + b[1]) / 2, ry));
    const n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i <= n; i++) { const t = i / n; K.both(M.trim, box(0.18, h, 0.18, a[0] + (b[0] - a[0]) * t, y + h / 2, a[1] + (b[1] - a[1]) * t)); }
  };
  /** A coil of cable lying on the floor at [x, y, z]. */
  const coil = (x, y, z, n = 3, r = 0.8) => { for (let i = 0; i < n; i++) K.add(cableM, T(new THREE.TorusGeometry(r - i * 0.18, 0.1, 4, 16), [x, y + 0.12 + i * 0.16, z], [Math.PI / 2, 0, 0])); };

  // ---- the Landing Stage (z -8..4): coils of rope, a bollard, the first mark
  K.hall({ x: 0, z: -2, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -9.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -9.25));
  K.glyph([0, 6.2, -7.95], 1.5, 0);
  for (const [x, z] of [[4.6, 1.2], [-4.4, -5.4]]) { K.both(iron, T(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 10), [x, 0.5, z])); K.both(brass, T(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 10), [x, 1.02, z])); }
  coil(5.2, 0, -3.6);
  K.solid(T(new THREE.CylinderGeometry(0.85, 0.85, 0.6, 12), [5.2, 0.3, -3.6]));   // (the coil stood on, not walked through)
  add(Mark, { room: 'stage', at: [-4.6, 0, -2], yaw: Math.PI / 2 });
  add(MooringGauge, { room: 'stage', at: [4.4, 0, 2.6], shows: 'mooring' });
  K.wall(-8.6, 4.6, 8.6, 4.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: HOLE.w, h: 9 }] });
  corridor(0, 5.2, 0, C1 - R1 - 0.6, 0);

  // ---- the Capstan Hall (the hub): the dead great capstan in the middle, its cables slack to the walls
  K.rotunda({ x: 0, z: C1, y: 0, r: R1, h: 28, seg: 54, oculus: 0.3, gaps: [
    { a: Math.PI, w: 6.6, h: PASS.h }, { a: SW, w: 7.8, h: PASS.h }, { a: SE, w: 7.8, h: PASS.h }, { a: 0, w: 6.6, h: PASS.h }, { a: MOOR_A, w: 8.4, h: PASS.h, y0: GALLERY.y },
    { a: WARDEN_GATE.a, w: 7.8, h: PASS.h },   // (#477: the Warden's gate, east)
    { ...D1_WINDOWS.hall },                     // (#561: the window toward the lamp-eye, beside the shaft's gate)
  ] });
  // (in the skin a bare drum of dark metal banded with teal circuits, its lid the same, its bars iron)
  K.both(SK?.drum ?? brass, T(new THREE.CylinderGeometry(2.6, 2.9, 4.2, 20), [0, 2.1, C1]));
  K.both(iron, T(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 20), [0, 0.25, C1]));
  if (SK?.wrap !== false) K.add(cableM, T(new THREE.CylinderGeometry(2.68, 2.68, 2.2, 20, 1, true), [0, 2.2, C1]));
  K.both(SK?.drum ?? M.trim, T(new THREE.SphereGeometry(2.7, 18, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.45, 1), [0, 4.2, C1]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; K.both(SK ? iron : brass, T(new THREE.BoxGeometry(0.4, 0.4, 2.6), [Math.sin(a) * 3.9, 3.6, C1 + Math.cos(a) * 3.9], [0, a, 0])); }
  // (clear of the doorways and of the balcony)
  for (const a of [0.55, 1.95, 2.75, -2.75, -0.95, -0.4]) { cable([Math.sin(a) * 2.8, 3, C1 + Math.cos(a) * 2.8], [Math.sin(a) * 17.9, 12, C1 + Math.cos(a) * 17.9], 4.6); }
  // the balcony inside the moorers' gate (the shortcut back), 10 m deep from the wall to its lip, and its cradle down
  const BS = GALLERY.y;
  {
    const [bx, bz] = wingAt(MOOR_A, (R1 + PERCH.lip) / 2, 0);
    K.both(M.floor, box(14, 0.8, R1 - PERCH.lip, bx, BS - 0.4, bz, MOOR_A));
    const lip = (s) => wingAt(MOOR_A, PERCH.lip + 0.3, s), side = (d, s) => wingAt(MOOR_A, d, s);
    // (open where the cable-rail runs out and where the cradle rides)
    rail(lip(-6.8), lip(PERCH.cradle[1] - 2.1), BS); rail(lip(PERCH.cradle[1] + 2.1), lip(PERCH.side - 1.0), BS); rail(lip(PERCH.side + 1.0), lip(6.8), BS);
    for (const s of [-6.8, 6.8]) rail(side(PERCH.lip + 0.3, s), side(R1 - 1.2, s), BS);
    const [px, pz] = side(PERCH.cradle[0], PERCH.cradle[1]);
    add(Platform, { id: 'cradle', room: 'moor', path: [[px, BS, pz], [px, 0.2, pz]], r: 1.8, speed: 2.2, pause: 2.6, when: { open: 'sc' } });   // (the Gallery's way back)
  }
  add(Mark, { room: 'hall', at: [6.5, 0, C1 - 7], yaw: -Math.PI * 0.75 });
  add(MooringGauge, { room: 'hall', at: [-5.4, 0, 16.5], shows: 'mooring' });
  // the caged coffer on the hall's east side, the plate before it, and the moorers' weight up on its cleat (issue #337)
  {
    const [ca, cr] = CLEAT.coffer, [pa, pr] = CLEAT.plate, [wa, wr] = CLEAT.weight;
    const [cx, cz] = hallAt(ca, cr), [px, pz] = hallAt(pa, pr), [wx, wz] = hallAt(wa, wr);
    add(Coffer, { id: 'cC', at: [cx, 0, cz], yaw: ca + Math.PI, cage: true, line: 'The cage sinks under the weight, and the coffer’s lid swings back. The moorers’ chimes.' });
    add(Plate, { id: 'pC', at: [px, 0, pz], r: 1.2 });
    // the cleat: a stone shelf on an iron mooring mast standing in the floor, where a slack cable from the capstan ends
    const [sx, sz] = hallAt(wa, CLEAT.mast - 0.4), [mx, mz] = hallAt(wa, CLEAT.mast);
    K.both(M.trim, box(1.5, 0.3, 1.5, sx, CLEAT.y - 0.15, sz, wa));
    K.both(iron, T(new THREE.CylinderGeometry(0.32, 0.45, CLEAT.y - 0.3, 10), [mx, (CLEAT.y - 0.3) / 2, mz]));
    K.add(brass, T(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 10), [mx, 1.2, mz]));
    cable([Math.sin(wa) * 2.8, 3, C1 + Math.cos(wa) * 2.8], [Math.sin(wa) * (CLEAT.mast - 0.6), CLEAT.y + 0.05, C1 + Math.cos(wa) * (CLEAT.mast - 0.6)], 2.6);
    add(Weight, { id: 'wC', at: [wx, CLEAT.y, wz], yaw: wa, name: 'moorers’ weight', fall: 20, zone: { min: [-R1, -1, C1 - R1], max: [R1, 12, C1 + R1] },
      hint: 'Off the plate, the cage rises round the coffer again. It wants a weight.', back: 'The moorers’ weight is back on its cleat.' });
  }

  // ---- the Winch Room (south-west): the counterweight's groove down the middle of its floor to its socket at the winch's mouth
  corridor(...hallAt(SW, R1 + 0.7), ...hallAt(SW, WING.d - WING.r - 0.7), 0);
  K.rotunda({ x: WINCH[0], z: WINCH[1], y: 0, r: WING.r, h: WING.h, seg: 39, gaps: [{ a: Math.PI / 4, w: 8, h: PASS.h }], oculus: 0.3 });
  {
    const [g0x, g0z] = hallAt(SW, WING.d + 7.3), [g1x, g1z] = hallAt(SW, WING.d - 6.5), L = Math.hypot(g1x - g0x, g1z - g0z);
    K.add(M.dark, box(1.0, 0.04, L, (g0x + g1x) / 2, 0.02, (g0z + g1z) / 2, SW));
    for (const s of [-0.8, 0.8]) K.add(M.trim, box(0.22, 0.12, L, (g0x + g1x) / 2 + Math.cos(SW) * s, 0.06, (g0z + g1z) / 2 - Math.sin(SW) * s, SW));
  }
  const bA = hallAt(SW, WING.d + 5.5), bB = hallAt(SW, WING.d - 5.5);
  add(Ball, { id: 'ballW', a: [bA[0], 0.04, bA[1]], b: [bB[0], 0.04, bB[1]], r: 1.1, friction: 1.2 });
  add(Plate, { id: 'pG', at: [bB[0], 0, bB[1]], r: 1.3 });
  // the winch itself behind the groove's far end: a great drum on a frame, its cable run out along the groove
  {
    const [wx, wz] = hallAt(SW, WING.d + 9.5);
    K.both(iron, box(6.2, 3.6, 0.8, wx, 1.8, wz, SW));
    K.both(brass, T(new THREE.CylinderGeometry(1.2, 1.2, 4.6, 16), [wx, 3.2, wz], [0, SW, Math.PI / 2], 1, 'YXZ'));
    for (const s of [-1, 1]) K.both(iron, box(0.8, 4.4, 1.6, wx + Math.cos(SW) * s * 2.7, 2.2, wz - Math.sin(SW) * s * 2.7, SW));
  }
  { const [x, z] = wingAt(SW, 28, 5); add(Mark, { room: 'winch', at: [x, 0, z], yaw: SW + Math.PI }); }
  { const [x, z] = wingAt(SW, 25.5, -4.5); add(MooringGauge, { room: 'winch', at: [x, 0, z], shows: 'mooring' }); }

  // ---- the Lamp Shaft (south-east): the gate in the corridor; a tall well breathing the void's air up its grating, and
  // beside it a pier, the lamp-eye on its top (hidden from the floor by the top's own edge)
  corridor(...hallAt(SE, R1 + 0.7), ...hallAt(SE, WING.d - WING.r - 0.7), 0);
  const [gx, gz] = hallAt(SE, (R1 + 1.4 + WING.d - WING.r - 1.4) / 2);
  add(Door, { id: 'g1', at: [gx, 0, gz], yaw: SE, ...DOOR, lamps: [{ drumOn: ['ballW', 'pG'] }] });
  K.rotunda({ x: SHAFT[0], z: SHAFT[1], y: 0, r: WING.r, h: 30, seg: 39, gaps: [{ a: -Math.PI / 4, w: 8, h: PASS.h }, { ...D1_WINDOWS.shaft }], oculus: 0.45 });
  // (#561) the glass in the hub's window (two of its wall's stones): the lamp-eye seen from the great door, never splashed
  // from the hub (every line from it to the eye passes the glass; the shaft's window, open over its gate's last stone and
  // the next, opens on the void outside)
  {
    const H = D1_WINDOWS.hall, rr = R1 + 0.7;
    add(Pane, { at: [Math.sin(H.a) * rr, H.y0 + H.h / 2, C1 + Math.cos(H.a) * rr], yaw: H.a, w: 2 * rr * Math.sin(Math.PI / 54) * 2 - 0.2, h: H.h - 0.1 });
  }
  {
    const SP = SHAFT_PIER, [ux, uz] = hallAt(SE, SP.draught);
    K.add(M.trim, T(annulus(3.2, 3.6, 0.05, 32), [ux, 0.02, uz]));
    for (let i = 0; i < 5; i++) K.add(M.dark, box(6.2, 0.05, 0.3, ux, 0.04, uz - 2.4 + i * 1.2, Math.PI / 4));
    add(Updraft, { at: [ux, 0, uz], r: 3.4, h: 17, lift: 7, when: LOW, hint: 'The void’s breath rises up the shaft. Open your wings in it.', still: 'The counterweight sits on the grating. No breath gets past it.' });
    // (v1.83) its counterweight on the house's cable: on the grating while the moored room is high, hauled up the shaft while it is low
    add(ShaftWeight, { at: [ux, 0.05, uz], r: 2.8, h: 3.4, up: 23.6 });
    // the pier: its top 6 by 7.6 m, its lip 2.5 m from the draught's middle (as the balcony's was)
    const [px, pz] = hallAt(SE, SP.pier), [qx, qz] = hallAt(SE, SP.pier + 1.2);
    K.both(M.floor, box(6, 0.8, 7.6, px, SP.top - 0.4, pz, SE));
    K.both(M.wall, box(3.4, SP.top - 0.8, 3.4, qx, (SP.top - 0.8) / 2, qz, SE));
    const [l0x, l0z] = hallAt(SE, SP.pier - 3.5);
    rail([l0x + Math.cos(SE) * 2.8, l0z - Math.sin(SE) * 2.8], [l0x - Math.cos(SE) * 2.8, l0z + Math.sin(SE) * 2.8], SP.top, 0.7);
    // the lamp-eye on a stone in the top's middle, 1.8 m and more from every edge: the top hides it from the floor (#561: a
    // little off the radial and up, so the great door sees it through the two windows)
    const [ex, ez] = wingAt(SE, SP.eye, SP.side);
    K.both(M.trim, box(0.9, SP.stone, 0.9, ex, SP.top + SP.stone / 2, ez, SE));
    add(Switch, { id: 's1', at: [ex, SP.top + SP.stone + 0.4, ez], yaw: SE + Math.PI, size: 0.8 });
  }
  { const [x, z] = wingAt(SE, 28, -5); add(Mark, { room: 'stair', at: [x, 0, z], yaw: SE + Math.PI }); }
  { const [x, z] = wingAt(SE, SHAFT_PIER.pier + 3.1, 1.8); add(Mark, { room: 'stairTop', at: [x, SHAFT_PIER.top, z], yaw: SE + Math.PI }); }   // (beside the eye's stone)
  { const [x, z] = wingAt(SE, 25.5, 4.5); add(MooringGauge, { room: 'stair', at: [x, 0, z], shows: 'mooring' }); }

  // ---- the great door and the Cord Loft (the chest): coils of the makers' cord round its walls; its try, a ring on a
  // mooring post; and over its west side, where the Mooring Passage was, the ring that holds the door into the Drift
  const C3 = LOFT.z;
  add(Door, { id: 'd1', at: [0, 0, C1 + R1 + 2.0], ...DOOR, lamps: [{ lit: 's1' }] });
  corridor(0, C1 + R1 + 0.7, 0, C3 - LOFT.r - 0.7, 0);
  K.rotunda({ x: 0, z: C3, y: 0, r: LOFT.r, h: LOFT.h, seg: 39, gaps: [{ a: Math.PI, w: 6, h: PASS.h }, { a: -Math.PI / 2, w: 7.2, h: PASS.h }, { a: Math.atan2(FLOOR.x, FLOOR.z - C3), w: 7.6, h: PASS.h }], oculus: 0.35 });   // (and, #477, east-south-east to the great door)
  K.both(M.trim, ...chestMound(0, 0, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  for (const a of [0.6, 1.25, -2.4, -0.4]) for (let i = 0; i < 4; i++) K.add(cableM, T(new THREE.TorusGeometry(0.9 - (i % 2) * 0.15, 0.13, 4, 18), [Math.sin(a) * (LOFT.r - 1.4), 1.6 + i * 0.32, C3 + Math.cos(a) * (LOFT.r - 1.4)], [0, a, 0]));
  // the try: a moorers' ring on a post east of the chest, its lamp hung over it
  K.both(iron, box(0.6, 3.4, 0.6, 6.9, 1.7, C3 + 5));
  add(Switch, { id: 't0', at: [6.4, 2.6, C3 + 5], yaw: -Math.PI / 2, size: 0.8, pull: true });
  rt.loftLamp = { at: [6.4, 9, C3 + 5] };
  // the ring over the floor: its chain up to a pulley under the roof and along it to the door's head. (v1.83) It hangs on
  // the house's cable: down within the tether's reach with the counterweights down (the moored room high), hauled up under
  // the roof with them up (low)
  const R1x = -8;
  add(Switch, { id: 'r1', at: [R1x, LOFT.ring[0], C3], yaw: Math.PI / 2, size: 0.85, pull: true });
  add(Hoist, { piece: 'r1', when: HIGH, up: LOFT.ring[1], down: LOFT.ring[0], top: LOFT.h - 0.6 });
  K.both(brass, T(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), [R1x, LOFT.h - 0.6, C3], [Math.PI / 2, 0, 0]));
  cable([R1x, LOFT.h - 0.6, C3], [-LOFT.r + 0.3, PASS.h + 0.6, C3], 1.2, 0.06);
  add(Mark, { room: 'loft', at: [5.6, 0, C3 - 8], yaw: Math.PI * 0.25 });
  add(MooringGauge, { room: 'loft', at: [4.5, 0, C3 - LOFT.r + 2.4], shows: 'mooring' });

  // ---- (v1.83, issue #417) the Mooring Hall: the great hall, open to the stars over its void; its floors seen at once
  const G = GALLERY, MX = (MH.x0 + MH.x1) / 2, MZ = (MH.z0 + MH.z1) / 2, DZ = MZ;
  corridor(-LOFT.r - 0.7, C3, MH.x1 + 0.6, C3, 0);
  add(Door, { id: 'd2', at: [(-LOFT.r - 1.4 + MH.x1 + 1.2) / 2, 0, C3], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'r1' }] });
  K.hall({ x: MX, z: MZ, w: MH.x1 - MH.x0, d: MH.z1 - MH.z0, y: MH.y, h: MH.h, floor: false, roof: false, doors: [
    { side: 'e', at: C3 - MZ, ...HOLE, y0: -MH.y },                     // from the loft
    { side: 'e', at: MOOR.z - MZ, ...HOLE, y0: G.y - MH.y },             // the moorers' passage to the Capstan Hall's balcony
    { side: 's', at: STORE.x - MX, ...HOLE, y0: G.y - MH.y },            // the Rope Store
    { side: 'w', at: LOCKER.z - MZ, ...HOLE, y0: WEST.yS - MH.y },       // the west door, into the Chain Locker (#561) and on to the Anchor Hold
  ] });
  // its floors: the gallery's halves (y 11), the east landing and its apron out to the room's shaft (y 0), the west landing's
  // lower part (y 0) and upper part (y 6)
  K.slab(MH.x0, MH.z0, G.w, G.z1, G.y, 2);
  K.slab(G.e, MH.z0, MH.x1, G.z1, G.y, 2);
  K.slab(EAST.lip, MH.z0, MH.x1, MH.z1, 0, 0.8);
  K.slab(EAST.apron, MH.z0, EAST.lip, EAST.apronZ, 0, 0.8);
  K.slab(MH.x0, WEST.zN[0], WEST.lip, WEST.zN[1], WEST.yN, 0.8);
  K.slab(MH.x0, WEST.zS[0], WEST.lip, WEST.zS[1], WEST.yS, 2);
  add(Pit, { room: 'drift', min: [MH.x0, -24, MH.z0], max: [MH.x1, -8, MH.z1] });
  // the void's breath under the east landing: fall off with your wings open and it bears you back up beside it
  add(Updraft, { at: [EAST.lip - 7.6, -8, WEST.gang + 3], r: 3.6, h: 10.5, lift: 6.5, hint: 'The void breathes up under the hall. It bears your wings back up beside the landing.' });
  // the docks: a wall across each floor's lip at the room's shaft, a gate in it (open while the room is docked there), a
  // moorers' ring on a post beside it
  // (posts either side of the gate and a lintel over it, 2 cm in from the floor's edge: no face shared with the slab's end,
  // and no doorway frame standing out over the shaft, scripts/zfight)
  {
    const d0 = ROOM.z - HOLE.w / 2, d1 = ROOM.z + HOLE.w / 2;
    for (const [x, y, h, lintel] of [[G.e + 0.62, 0, G.y - 2, false], [G.e + 0.62, G.y, 10, true], [G.w - 0.62, G.y, 10, true]]) {
      K.wall(x, MH.z0, x, d0, y, h, { t: 1.2, cap: false }); K.wall(x, d1, x, G.z1, y, h, { t: 1.2, cap: false });
      if (lintel) K.both(M.wall, box(1.2, h - DOOR.h, d1 - d0, x, y + (h + DOOR.h) / 2, ROOM.z));
    }
  }
  add(Door, { id: 'dockL', at: [G.e + 0.62, 0, ROOM.z], yaw: Math.PI / 2, ...DOOR, lamps: [LOW] });
  add(DockGate, { id: 'dockH', at: [G.e + 0.62, G.y, ROOM.z], yaw: Math.PI / 2, ...DOOR, lamps: [HIGH] });
  add(DockGate, { id: 'dockW', at: [G.w - 0.62, G.y, ROOM.z], yaw: Math.PI / 2, ...DOOR, lamps: [HIGH] });
  // the moored room itself, and the moorers' rings at its docks
  K.chartNote({ kind: 'lift', id: 'mooring', path: [[ROOM.x, ROOM.low, ROOM.z], [ROOM.x, ROOM.high, ROOM.z]], r: ROOM.r });   // (the house's map: issue #405)
  add(MooredRoom, { id: 'mooring', room: 'float', x: ROOM.x, z: ROOM.z, low: ROOM.low, high: ROOM.high, r: ROOM.r, wall: ROOM.wall, h: ROOM.h, door: ROOM.door, speed: ROOM.speed });
  for (const R of DOCK_RINGS) add(DockRing, { ...R, sets: 'mooring' });
  // railings along the lips over the void: the gallery's halves (the east half's open at its drop), the apron's, the east
  // landing's (open at its ball's cable-rail and at the gangway)
  rail([MH.x0 + 0.4, G.z1 - 0.3], [G.w - 1.4, G.z1 - 0.3], G.y);
  rail([G.e + 1.4, G.z1 - 0.3], [G.drop[0] - G.drop[1], G.z1 - 0.3], G.y);
  rail([G.drop[0] + G.drop[1], G.z1 - 0.3], [MH.x1 - 0.4, G.z1 - 0.3], G.y);
  rail([EAST.apron + 0.3, G.z1 + 0.4], [EAST.apron + 0.3, EAST.apronZ - 0.3], 0);
  rail([EAST.apron + 0.3, EAST.apronZ - 0.3], [EAST.lip + 0.3, EAST.apronZ - 0.3], 0);
  rail([EAST.lip + 0.3, EAST.apronZ - 0.3], [EAST.lip + 0.3, DRIFT.z - 1.5], 0);
  rail([EAST.lip + 0.3, DRIFT.z + 1.5], [EAST.lip + 0.3, WEST.gang - 2.4], 0);
  rail([EAST.lip + 0.3, WEST.gang + 2.4], [EAST.lip + 0.3, MH.z1 - 0.4], 0);
  // (G6) the drop off the gallery's east half: a lit sill in the railing's gap, and under it on the east landing a ring of
  // the void's breath that takes the fall
  {
    const [dx, dw] = G.drop, [cx, cz, cr] = G.catch;
    K.add(M.trim, box(2 * dw, 0.06, 0.6, dx, G.y + 0.03, G.z1 - 0.3));
    K.add(starM, box(2 * dw, 0.04, 0.12, dx, G.y + 0.07, G.z1 - 0.15));
    K.add(M.trim, T(annulus(cr - 0.4, cr, 0.05, 40), [cx, 0.02, cz]));
    K.add(starM, T(annulus(cr - 0.65, cr - 0.5, 0.04, 40), [cx, 0.03, cz]));
    for (let i = 0; i < 5; i++) K.add(M.dark, box(2 * (cr - 0.9), 0.04, 0.25, cx, 0.035, cz - 1.6 + i * 0.8));
    add(Cushion, { at: [cx, 0, cz], r: cr, said: 'The void’s breath billows up under the gallery and sets you down.' });
  }
  // the east landing's ball, out on its cable-rail over the void: pulled home, and the room high, the gangway hangs taut
  {
    const D = DRIFT, y = 0.02, L = D.a - D.b + 1.4, cx = (D.a + D.b) / 2 - 0.4;
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(L, 0.12, 0.12, cx, y, D.z + s));
    K.add(iron, box(0.4, 1.8, 1.6, D.b - 1.5, -0.6, D.z));
    for (let x = EAST.lip - 2; x > D.b; x -= 2.6) K.add(iron, box(0.14, 0.5, 1.3, x, -0.25, D.z));
    cable([D.b - 1.5, -1.4, D.z], [D.b - 2, -18, D.z + 1], 0, 0.06);
    add(Ball, { id: 'ballD', a: [D.a, 0.04, D.z], b: [D.b, 0.04, D.z], r: 1.1, friction: 1.0 });
    add(Plate, { id: 'pD', at: [D.plate, 0, D.z], r: 1.3 });
  }
  add(Bridge, { id: 'br2', a: [EAST.lip + 0.1, 0, WEST.gang], b: [WEST.lip - 0.1, WEST.yN, WEST.gang], w: 4, n: 16 });
  // the gangway's gate in the moorers' screen (its twin: it opens with the gangway), and the screen: bars from the void up
  // to `screen` along the west landings' lip and the upper part's south edge, an invisible wall behind them, so nothing
  // glides in past it
  add(Door, { id: 'br2', at: [WEST.lip + 0.2, WEST.yN, WEST.gang], yaw: Math.PI / 2, ...DOOR });
  {
    const X = WEST.lip + 0.2, top = WEST.screen, bot = MH.y + 1, g0 = WEST.gang - HOLE.w / 2, g1 = WEST.gang + HOLE.w / 2;
    const bars = (a, b, y0, y1, along) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.1)); for (let i = 0; i <= n; i++) { const t = i / n; K.add(iron, T(new THREE.CylinderGeometry(0.07, 0.07, y1 - y0, 6), [a[0] + (b[0] - a[0]) * t, (y0 + y1) / 2, a[1] + (b[1] - a[1]) * t])); } };
    // (along the lip: below the upper part from the void, beside the gate from its floor, over the gate from its lintel)
    bars([X, WEST.zS[0]], [X, g0 - 0.6], bot, top); bars([X, g1 + 0.6], [X, MH.z1 - 0.3], bot, top);
    bars([X, g0 + 0.4], [X, g1 - 0.4], WEST.yN + DOOR.h + 0.6, top);
    K.solid(box(0.3, top - bot, g0 - WEST.zS[0], X, (top + bot) / 2, (WEST.zS[0] + g0) / 2));
    K.solid(box(0.3, top - bot, MH.z1 - g1, X, (top + bot) / 2, (g1 + MH.z1) / 2));
    K.both(iron, box(0.6, DOOR.h + 0.6, 0.6, X, WEST.yN + (DOOR.h + 0.6) / 2, g0 - 0.3));
    K.both(iron, box(0.6, DOOR.h + 0.6, 0.6, X, WEST.yN + (DOOR.h + 0.6) / 2, g1 + 0.3));
    K.both(iron, box(0.6, 0.6, g1 - g0 + 1.2, X, WEST.yN + DOOR.h + 0.3, WEST.gang));
    K.solid(box(0.3, top - WEST.yN - DOOR.h, g1 - g0, X, (top + WEST.yN + DOOR.h) / 2, WEST.gang));
    // (the upper part's south edge, over the gallery's west half's gap)
    const Z = WEST.zS[0] - 0.2;
    bars([MH.x0 + 0.3, Z], [WEST.lip, Z], WEST.yS - 2, top);
    K.solid(box(WEST.lip - MH.x0, top - WEST.yS + 2, 0.3, (MH.x0 + WEST.lip) / 2, (top + WEST.yS - 2) / 2, Z));
    // the rails along the screen's foot and its top
    for (const y of [top - 0.2]) { K.add(M.trim, box(0.3, 0.3, MH.z1 - WEST.zS[0], X, y, (MH.z1 + WEST.zS[0]) / 2)); K.add(M.trim, box(WEST.lip - MH.x0, 0.3, 0.3, (MH.x0 + WEST.lip) / 2, y, Z)); }
  }
  // the Cable Walk, slung from the counterweights: up from the lower part to the upper, level only with the room low
  add(Bridge, { id: 'cw', a: [WEST.walk, WEST.yN, WEST.zN[0] + 0.1], b: [WEST.walk, WEST.yS, WEST.zS[1] - 0.1], w: 4.4, n: 10 });
  for (const z of [WEST.zN[0] + 0.6, WEST.zS[1] - 0.6]) for (const s of [-2.6, 2.6]) K.both(M.trim, box(0.4, 3.2, 0.4, WEST.walk + s, (z > MZ ? WEST.yN : WEST.yS) + 1.6, z));
  rail([MH.x0 + 0.4, WEST.zN[0] + 0.3], [WEST.walk - 2.4, WEST.zN[0] + 0.3], WEST.yN); rail([WEST.walk + 2.4, WEST.zN[0] + 0.3], [WEST.lip - 0.3, WEST.zN[0] + 0.3], WEST.yN);
  rail([MH.x0 + 0.4, WEST.zS[1] - 0.3], [WEST.walk - 2.4, WEST.zS[1] - 0.3], WEST.yS); rail([WEST.walk + 2.4, WEST.zS[1] - 0.3], [WEST.lip - 0.3, WEST.zS[1] - 0.3], WEST.yS);
  // its catch: a moorers' ring on a davit over the gap at the walk's foot, in the tether's reach from the lower part's lip
  {
    const [x, y, z] = WEST.catch;
    K.both(iron, box(0.5, y + 1.6, 0.5, x + 1.6, WEST.yN + (y + 1.6) / 2, WEST.zN[0] + 0.5));
    K.add(iron, box(0.3, 0.3, 2.2, x + 1.6, WEST.yN + y + 1.45, WEST.zN[0] - 0.6));
    add(Switch, { id: 'rW', at: [x, WEST.yN + y, z], yaw: 0, size: 0.8, pull: true });
    cable([x, WEST.yN + y + 0.7, z], [x + 1.6, WEST.yN + y + 1.4, WEST.zN[0] - 1.6], 0, 0.05);
  }
  // the levers, the gauges (one in every room), the marks
  for (const lv of LEVERS) add(MooringLever, { ...lv, sets: 'mooring' });
  for (const [room, at] of [['drift', [-23.2, 0, 64.2]], ['moor', [-23.2, G.y, 31.8]], ['moorW', [MH.x0 + 2.2, G.y, 31.8]], ['west', [MH.x0 + 2.2, WEST.yN, 91.8]], ['westS', [MH.x0 + 2.2, WEST.yS, 53.8]]]) add(MooringGauge, { room, at, shows: 'mooring' });
  for (const z of [44, 58, 88]) K.add(starM, box(0.06, 16, 0.14, MH.x1 - 0.02, 4, z));
  for (const x of [-70, -62, -30, -26]) K.add(starM, box(0.14, 14, 0.06, x, 18, MH.z1 - 0.02));
  for (const [x, z] of [[-44, 91], [-48, 62], [-52, 89], [-40, 54]]) cable([x, 26, z], [x + 0.5, -20, z + 0.4], 0, 0.06);
  add(Mark, { room: 'drift', at: [-24, 0, 88], yaw: -Math.PI / 2 });
  add(Mark, { room: 'moor', at: [-25, G.y, 24.5], yaw: -Math.PI / 2 });
  add(Mark, { room: 'moorW', at: [MH.x0 + 4.5, G.y, 24.5], yaw: Math.PI / 2 });
  add(Mark, { room: 'west', at: [-66, WEST.yN, 90], yaw: Math.PI / 2 });
  add(Mark, { room: 'westS', at: [-62, WEST.yS, 47.5], yaw: Math.PI });
  // the moorers' gate (its small key), in the short passage east to the Capstan Hall's balcony
  corridor(MH.x1 + 0.6, MOOR.z, -Math.sqrt(R1 * R1 - (MOOR.z - C1) ** 2) - 0.8, MOOR.z, BS);
  add(Door, { id: 'sc', at: [MOOR.gate, BS, MOOR.z], yaw: Math.PI / 2, ...DOOR });   // (#561: its two keyholes, the Rope Store's key and the Anchor Hold's)

  // ---- (v1.83; #561 moved) the Chain Locker, through the west door: a well in its floor north of the way through, its
  // ball's rail across the way and out over the well to the far cup, the ring of its far door's chain hung over the well
  {
    const Lk = LOCKER, Y = Lk.y, x0 = Lk.x - Lk.w / 2, x1 = Lk.x + Lk.w / 2, z0 = Lk.z - Lk.d / 2, z1 = Lk.z + Lk.d / 2;
    const L = (x, z) => [Lk.x + x, Lk.z + z], [wx0, wz0] = L(Lk.well[0], Lk.well[1]), [wx1, wz1] = L(Lk.well[2], Lk.well[3]);
    const rx = Lk.x + Lk.rail, za = Lk.z + Lk.a, zb = Lk.z + Lk.b;
    // (its east side the Mooring Hall's west wall, the west door in it; its far door west, on to the Anchor Hold)
    K.hall({ x: Lk.x, z: Lk.z, w: Lk.w, d: Lk.d, y: Y, h: Lk.h, roof: 'oculus', oculus: 0.3, floor: false, omit: ['e'], doors: [{ side: 'w', at: 0, ...HOLE, y0: 0 }] });
    K.slab(x0, z0, x1, wz0, Y, 0.8); K.slab(x0, wz0, wx0, z1, Y, 0.8); K.slab(wx1, wz0, x1, z1, Y, 0.8);
    add(Pit, { room: 'locker', min: [wx0, Y - 24, wz0], max: [wx1, Y - 8, wz1] });
    // the well's railings, open where the ball's rail runs out over it
    rail([wx0 + 0.3, wz0 - 0.3], [rx - 1.6, wz0 - 0.3], Y); rail([rx + 1.6, wz0 - 0.3], [wx1 - 0.3, wz0 - 0.3], Y);
    rail([wx0 - 0.3, wz0 - 0.3], [wx0 - 0.3, wz1 - 0.4], Y); rail([wx1 + 0.3, wz0 - 0.3], [wx1 + 0.3, wz1 - 0.4], Y);
    // the groove on the floor, its cables on over the well, the far cup on its stop post
    K.add(M.dark, box(1.0, 0.04, wz0 - za + 1.6, rx, Y + 0.02, (za - 1.2 + wz0) / 2));
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(0.12, 0.12, zb - za + 1.8, rx + s, Y + 0.02, (za + zb) / 2 + 0.3));
    for (let z = wz0 + 2; z < zb; z += 2.6) K.add(iron, box(1.3, 0.5, 0.14, rx, Y - 0.25, z));
    K.add(iron, box(1.6, 1.8, 0.4, rx, Y - 0.6, zb + 1.5));
    K.add(brass, T(annulus(1.3, 1.8, 0.08, 24), [rx, Y + 0.03, zb]));
    cable([rx, Y - 1.4, zb + 1.5], [rx + 1, Y - 18, zb + 2], 0, 0.06);
    add(Ball, { id: 'ballK', a: [rx, Y + 0.04, za], b: [rx, Y + 0.04, zb], r: 1.1, friction: 1.0 });
    add(Plate, { id: 'pK2', at: [rx, Y, zb], r: 1.3 });
    // the ring, its chain up to a pulley under the roof and across to the cup's post (drawn); hoisted by the cup's weight;
    // and on from the pulley along the roof to the far door, whose lamp it lights
    const [kx, kz] = L(...Lk.ring);
    add(Switch, { id: 'rK', at: [kx, Y + Lk.down, kz], yaw: Math.PI, size: 0.85, pull: true });
    add(Hoist, { piece: 'rK', when: { drumOn: ['ballK', 'pK2'] }, up: Y + Lk.up, down: Y + Lk.down, top: Y + Lk.h - 0.8 });
    K.both(brass, T(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), [kx, Y + Lk.h - 0.8, kz], [Math.PI / 2, 0, 0]));
    cable([kx, Y + Lk.h - 0.8, kz], [rx, Y + Lk.h - 0.8, zb + 1.5], 0.8, 0.06);
    cable([rx, Y + Lk.h - 0.8, zb + 1.5], [rx, Y + 1.2, zb + 1.5], 0, 0.06);
    cable([kx, Y + Lk.h - 0.8, kz], [x0 + 0.6, Y + DOOR.h + 1.2, Lk.z], 1.4, 0.06);
    for (const a of [0.6, 2.2]) for (let i = 0; i < 4; i++) K.add(cableM, T(new THREE.TorusGeometry(0.9 - (i % 2) * 0.15, 0.13, 4, 18), [x1 - 3 - a * 4, Y + 1.6 + i * 0.32, z0 + 2.4], [0, 0, 0]));
    add(Door, { id: 'gN', at: [x0 - 0.6, Y, Lk.z], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'rK' }] });
    add(MooringGauge, { room: 'locker', at: [x1 - 2.4, Y, z0 + 6], shows: 'mooring' });
    add(Mark, { room: 'locker', at: [x1 - 4, Y, Lk.z - 5], yaw: -Math.PI / 2 });
  }

  // ---- (#477) the Anchor Hold, west past the Chain Locker (#561) where the Capstan Floor stood: a round hall over the void,
  // open to it at four barred windows, a well in its middle; the Warden's spare anchor-ball out over the well on a
  // cable-rail, pulled home with the tether onto its footstone: its cable lowers the cage of the moorers' second small key,
  // across the well
  const HD = HOLD, HX = HD.x, HZ = HD.z, HY = HD.y, HRr = HD.r;
  K.corridor([LOCKER.x - LOCKER.w / 2 - 1.2, HZ], [HX + HRr + 0.6, HZ], HY, { w: 8.2, h: 10 });   // (wide and tall since issue #195: the close camera fought its walls)
  const windowBars = (cx, cz, fy, r, a) => {
    // the window's rail across the gap, and (issue #356) a second rail at 2 m and bars over it to the window's head, too
    // close to pass: open, the wings took you out over the void and round, and back in past a great lock
    const ox = cx + Math.sin(a) * (r + 0.5), oz = cz + Math.cos(a) * (r + 0.5);
    K.both(M.trim, T(new THREE.BoxGeometry(9.6, 0.25, 0.3), [ox, fy + 1.0, oz], [0, a, 0]));
    for (const s of [-1, 0, 1]) K.both(M.trim, T(new THREE.BoxGeometry(0.2, 1.0, 0.2), [ox + Math.cos(a) * s * 4.4, fy + 0.5, oz - Math.sin(a) * s * 4.4]));
    K.both(M.trim, T(new THREE.BoxGeometry((WINDOW_BARS.n - 1) * WINDOW_BARS.gap + 0.4, 0.25, 0.3), [ox, fy + WINDOW_BARS.rail, oz], [0, a, 0]));
    for (let i = 0; i < WINDOW_BARS.n; i++) {
      const s = (i - (WINDOW_BARS.n - 1) / 2) * WINDOW_BARS.gap, h = 7 - WINDOW_BARS.rail;
      K.both(iron, T(new THREE.CylinderGeometry(0.07, 0.07, h + 0.1, 6), [ox + Math.cos(a) * s, fy + WINDOW_BARS.rail + h / 2, oz - Math.sin(a) * s]));
    }
  };
  {
    const holdWindows = [Math.PI / 4, -Math.PI / 4, Math.PI * 3 / 4, -Math.PI * 3 / 4];
    K.rotunda({ x: HX, z: HZ, y: HY, r: HRr, h: 20, seg: 36, oculus: 0.62, floor: false, gaps: [{ a: Math.PI / 2, w: 6, h: 9.2 }, ...holdWindows.map((a) => ({ a, w: 9, h: 7 }))] });
    for (const a of holdWindows) windowBars(HX, HZ, HY, HRr, a);
    // its floor round the well, and the well open to the stars
    K.both(M.floor, T(annulus(HD.well, HRr + 1.4, 0.8, 72), [HX, HY, HZ]));
    K.add(brass, T(annulus(HD.well, HD.well + 0.5, 0.06, 48), [HX, HY + 0.03, HZ]));
    add(Pit, { room: 'hold', min: [HX - HD.well, HY - 24, HZ - HD.well], max: [HX + HD.well, HY - 8, HZ + HD.well] });
    // a railing round the well, open where the cable-rail crosses it (east, toward the door)
    const R0 = HD.well + 0.35, gap = 0.3, n = 14;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI / 2 + gap + (i / n) * (Math.PI * 2 - 2 * gap), a1 = Math.PI / 2 + gap + ((i + 1) / n) * (Math.PI * 2 - 2 * gap);
      rail([HX + Math.sin(a0) * R0, HZ + Math.cos(a0) * R0], [HX + Math.sin(a1) * R0, HZ + Math.cos(a1) * R0], HY);
    }
    // the cable-rail along the floor and on out over the well, its stop post hung under the far end, a cable down into the void
    const { a: ra, b: rb, plate } = HD.rail, L = ra - rb + 1.4, cx = HX + (ra + rb) / 2;
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(L, 0.12, 0.12, cx, HY + 0.02, HZ + s));
    K.add(iron, box(0.4, 1.8, 1.6, HX + rb - 1.5, HY - 0.6, HZ));
    for (let x = HD.well - 2; x > rb; x -= 2.6) K.add(iron, box(0.14, 0.5, 1.3, HX + x, HY - 0.25, HZ));
    cable([HX + rb - 1.5, HY - 1.4, HZ], [HX + rb - 2, HY - 20, HZ + 1], 0, 0.06);
    add(Ball, { id: 'bA', a: [HX + ra, HY + 0.04, HZ], b: [HX + rb, HY + 0.04, HZ], r: 1.1, friction: 1.0 });
    add(Plate, { id: 'pA', at: [HX + plate, HY, HZ], r: 1.3 });
    // (#561) across the well, the moorers' second small key in its cage: on a post beside it its lamp-eye under stone lids,
    // their chain over a pulley and down into the well, where the anchor-ball's cable runs
    add(Key, { id: 'kH', at: [HX + HD.key, HY, HZ], yaw: Math.PI / 2 });
    K.both(iron, box(0.5, 6.4, 0.5, HX + HD.key - 0.4, HY + 3.2, HZ + 2.2));
    add(Switch, { id: 'eH', at: [HX + HD.key + 0.05, HY + 3.4, HZ + 2.2], yaw: Math.PI / 2, size: 0.7, lids: true, wrong: 'Stone lids hold the eye shut. They hang on a chain down into the well.' });
    K.add(brass, T(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), [HX + HD.key, HY + 6.2, HZ + 1.9]));
    cable([HX + HD.key, HY + 6.0, HZ + 1.6], [HX + HD.key, HY + 1.4, HZ + 0.3], 0, 0.04);
    cable([HX + HD.key, HY + 6.4, HZ + 2.2], [HX - HD.well - 0.1, HY + 1.8, HZ + 2.2], 0.6, 0.05);
    cable([HX - HD.well - 0.1, HY + 1.8, HZ + 2.2], [HX - HD.well + 0.8, HY - 4, HZ + 2.2], 0, 0.05);
    // a spare anchor or two of the Warden's on the floor, chained to the wall
    for (const [x, z, a] of [[-12, -7, 0.4], [-11, 8.5, 2.6]]) K.both(iron, T(anchorGeometry({ s: 0.55 }), [HX + x, HY, HZ + z], [0, a, Math.PI / 2]));
    add(Mark, { room: 'hold', at: [HX + 12.5, HY, HZ - 4.5], yaw: -Math.PI / 2 });
    add(MooringGauge, { room: 'hold', at: [HX + 12.5, HY, HZ + 5], shows: 'mooring' });
  }

  // ---- (#477) the Capstan Floor, east of the Capstan Hall between it and the Cord Loft: a round floor open to the void at
  // four great windows, a bollard before each; the great door off the loft (a short passage, the antechamber), and the
  // Warden's gate into the hub, bars it is seen through from the first visit, opened from inside once it is stopped
  const HR = FLOOR.r, CX = FLOOR.x, CZ = FLOOR.z, FY = FLOOR.y;
  const rim = (cx0, cz0, r, a) => [cx0 + Math.sin(a) * r, cz0 + Math.cos(a) * r];
  {
    const aL = Math.atan2(CX, CZ - C3), [lx, lz] = rim(0, C3, LOFT.r + 1.45, aL), [fx, fz] = rim(CX, CZ, HR + 1.45, FLOOR.a);   // (from wall face to wall face: no face shared with their stones, scripts/zfight)
    corridor(lx, lz, fx, fz, 0);
    const [mx, mz] = [(lx + fx) / 2, (lz + fz) / 2], px = Math.cos(aL), pz = -Math.sin(aL);
    add(Mark, { room: 'ante', at: [mx + px * 2.6, FY, mz + pz * 2.6], yaw: aL + Math.PI / 2 });
    add(MooringGauge, { room: 'ante', at: [mx - px * 3.2, FY, mz - pz * 3.2], shows: 'mooring' });
    const [hx, hz] = rim(0, C1, R1 + 1.45, WARDEN_GATE.a), [gx, gz] = rim(CX, CZ, HR + 1.45, FLOOR.hub);
    corridor(hx, hz, gx, gz, 0);
  }
  const windows = FLOOR.windows;
  K.rotunda({ x: CX, z: CZ, y: FY, r: HR, h: 20, seg: 36, oculus: 0.62, gaps: [{ a: FLOOR.a, w: 6, h: 9.2 }, { a: FLOOR.hub, w: 6, h: 9.2 }, { a: FLOOR.out, w: 6, h: 9.2 }, ...windows.map((a) => ({ a, w: 9, h: 7 }))] });
  rt.bollards = [];
  for (const a of windows) {
    windowBars(CX, CZ, FY, HR, a);
    // under the bars the anchors still go out over the void and your aim reaches them
    const bx = CX + Math.sin(a) * (HR - 3.2), bz = CZ + Math.cos(a) * (HR - 3.2);
    K.both(iron, T(new THREE.CylinderGeometry(0.6, 0.75, 1.5, 12), [bx, FY + 0.75, bz]));
    K.add(brass, T(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 12), [bx, FY + 1.55, bz]));
    rt.bollards.push(K.world(bx, FY + 1.6, bz));
  }
  rt.windows = windows.map((a) => ({ a: K.heading(a), at: K.world(CX + Math.sin(a) * HR, FY, CZ + Math.cos(a) * HR) }));
  K.add(brass, T(annulus(8.0, 8.6, 0.06, 64), [CX, FY + 0.03, CZ]));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.add(M.dark, T(new THREE.BoxGeometry(0.3, 0.05, 1.6), [CX + Math.sin(a) * 11, FY + 0.03, CZ + Math.cos(a) * 11], [0, a, 0])); }
  add(Pit, { room: 'arena', min: [CX - HR - 12, -18, CZ - HR - 12], max: [CX + HR + 12, FY - 4, CZ + HR + 12] });
  {
    const [dx, dz] = rim(CX, CZ, HR + 0.7, FLOOR.a), [wx, wz] = rim(CX, CZ, HR + 0.7, FLOOR.hub);
    add(Door, { id: 'd6', at: [dx, FY, dz], yaw: FLOOR.a, ...DOOR, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door: you jumped through beside it, issue #356)
    add(BarGate, { id: 'd7', at: [wx, FY, wz], yaw: FLOOR.hub, ...DOOR, frame: { side: 1.2 } });
    // the way out: a door east, a short passage to the door into the world
    const [ox, oz] = rim(CX, CZ, HR + 0.7, FLOOR.out), [ex, ez] = rim(CX, CZ, HR + 10.6, FLOOR.out);
    add(Door, { id: 'd8', at: [ox, FY, oz], yaw: FLOOR.out, ...DOOR, frame: { side: 1.2 } });
    corridor(...rim(CX, CZ, HR + 1.45, FLOOR.out), ex, ez, FY, { w: 8.6, h: 10 });
    const [vx, vz] = rim(CX, CZ, HR + 10.2, FLOOR.out);
    K.both(M.wall, T(new THREE.BoxGeometry(9.4, 10, 0.8), [vx + Math.sin(FLOOR.out) * 0.8, FY + 5, vz + Math.cos(FLOOR.out) * 0.8], [0, FLOOR.out, 0]));
    K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [vx, FY, vz], [0, FLOOR.out + Math.PI, 0]));
    K.solid(T(new THREE.BoxGeometry(4, 5, 0.1), [vx, FY + 2.5, vz], [0, FLOOR.out, 0]));
    rt.wayOut = K.world(...(([x, z]) => [x, FY + 0.5, z])(rim(CX, CZ, HR + 9.8, FLOOR.out)));
  }

  const model = anchorModel(SK?.warden);
  // (#477: it stands facing the great door it waits for, its back to the gate the hub sees it through)
  model.pos.copy(K.world(CX + Math.sin(FLOOR.a) * 4, FY, CZ + Math.cos(FLOOR.a) * 4));
  model.home = model.pos.clone();
  model.heading = K.heading(FLOOR.a);
  model.rest = K.world(CX - Math.sin(FLOOR.a), FY, CZ - Math.cos(FLOOR.a));
  model.restHeading = K.heading(FLOOR.a);
  const arena = { center: K.world(CX, FY, CZ), r: HR, y: K.world(0, FY, 0).y };

  // (the wings last: their marks after the others, as they were)
  wings(rt, K, M, { BS, rail, cable, iron, brass, cableM });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, -4.4), heading: K.heading(0) },
    bounds: new THREE.Box3(V(HOLD.x - HOLD.r - 14, -26, STORE.z - STORE.d / 2 - 6), V(CX + HR + 6, 34, MH.z1 + 6)),
    gadget: { at: W(0, 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, -7.6), r: 1.5 }, { at: rt.wayOut, r: 1.5 }],
    lights: [[0, 5, -2, 10], [0, 14, C1, 26], [WINCH[0], 9, WINCH[1], 20], [SHAFT[0], 13, SHAFT[1], 20], [0, 10, C3, 20],
      [-28, 6, 70, 18], [-50, 15, 28, 22], [-66, 9, 82, 18], [-66, 12, 50, 16], [-40, 10, 60, 24], [-30, 16, 30, 16], [LOCKER.x, LOCKER.y + 9, LOCKER.z, 20], [STORE.x, BS + 6, STORE.z, 18], [CX, FY + 8, CZ, 24], [HOLD.x, HOLD.y + 8, HOLD.z, 22]],
    guardian: { def: { ...ANCHOR_WARDEN, onHit: wardenHit, openFor: wardenOpenFor }, model, arena },
  };
}


// ------------------------------------------------------------------ outside: the Mooring-House on the Moorings
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 8, sill = 0.4, HW = 24;
  const K = new TempleKit(rt.root, 'The Mooring-House', V(SITE.x, SITE.y, SITE.z), yaw, rt.M);
  const M = rt.M;
  const adobe = stone('#efe2cc'), coral = ceramic('#d9776a'), teal = ceramic('#4f9a98'), brass = metal('#d2a648'), iron = metal('#3d3f4c','iron');
  const lit = makeMaterial({ color: '#ffe2a8', glow: 0.7, flat: true, key: 'temple.spacecity.windows' });
  // Set the broad apron just under the island deck, so their shared surface cannot flicker.
  K.both(M.floor, new THREE.CylinderGeometry(R + 18, R + 18, 1, 48).translate(0, -0.54, 0));
  K.both(M.floor, new THREE.CylinderGeometry(R + 5, R + 5, sill, 48).translate(0, sill / 2, 0));
  K.both(adobe, new THREE.CylinderGeometry(R, R + 0.5, 9, 32).translate(0, sill + 4.5, 0));
  K.both(coral, new THREE.CylinderGeometry(R + 18, R + 18, 1.2, 48).translate(0, sill + 9.4, 0));
  landmark(K, 'spacecity', { y: sill, R });
  // The capstan hangs from the tripod's central spindle at its original cable height.
  K.both(brass, new THREE.CylinderGeometry(5.4, 5.4, 0.3, 24).translate(0, sill + HW + 2.3, 0));
  // the porch: a rounded adobe arch over the door, teal-framed, the glyph over it; lamps on posts either side
  const z0 = R - 1.2, z1 = R + 2.6;
  // (the drawing's cream pointed porch: two frames stepping back to the dark, teal light: src/temples/portal.js)
  const P = portal(K, { y: sill, z: R + 0.25, w: 4.6, h: 7.4, shape: 'pointed', layers: 2, step: 1.0, recess: 0.8, back: 1.3, into: 1.6,
    frame: adobe, inlay: '#5fd0c8' });
  for (const s of [-1, 1]) {
    K.both(iron, box(0.2, 3.2, 0.2, s * 6.4, sill + 1.6, z1 + 1.2));
    K.add(lit, T(new THREE.SphereGeometry(0.4, 10, 6), [s * 6.4, sill + 3.5, z1 + 1.2]));
  }
  // mooring bollards round the apron, a coil of cable by the door
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.8) continue; K.both(iron, T(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 10), [Math.sin(a) * (R + 4.6), sill + 0.5, Math.cos(a) * (R + 4.6)])); }
  K.flush();
  // the great capstan on the roof (it turns after): a brass drum wound with cable, eight bars, a crown
  const capM = makeMaterial({ color: '#d2a648', flat: true, metal: 'brass', key: 'temple.spacecity.capstan' });
  const capstan = new THREE.Group();
  capstan.position.copy(K.world(0, sill + HW + 2.45, 0));
  capstan.rotation.y = yaw;
  const parts = [new THREE.TorusGeometry(5.6, .4, 8, 48).rotateX(Math.PI / 2).translate(0, 2.1, 0),
    new THREE.CylinderGeometry(.7, .8, 7.2, 12).translate(0, 3.6, 0)];
  for (let i = 0; i < 6; i++) parts.push(new THREE.BoxGeometry(.35, .3, 5.6).translate(0, 2.1, 2.8).rotateY(i * TAU / 6));
  const capstanMesh = new THREE.Mesh(mergeAll(parts), capM);
  capstan.add(capstanMesh);
  capstan.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  rt.root.add(capstan);
  const at = K.world(0, sill, R + 1.4);
  const front = K.world(0, sill, R + 9);
  return { door: { at, heading: yaw, ...P.door }, kit: K, R, sill, HW, capstan, top: K.world(0, sill + HW + 4.6, 0), clear: [{ x: SITE.x, z: SITE.z, r: R + 12 }, { x: front.x, z: front.z, r: 5 }] };
}

function mergeAll(list) {
  const g = new THREE.BufferGeometry(), pos = [], nor = [];
  for (const q0 of list) { const q = q0.index ? q0.toNonIndexed() : q0; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ the world change: the cables hum taut
/** Where the Mooring-House's great cables run (world): the Towers' pipe stack, the Balcony's tower of pipes, the far island to the north. */
export const CABLES = [[114, 32, -96], [15, 26, -176], [80, 44, -330]];

/**
 * Before: the great cables from the capstan on the Mooring-House's roof hang slack, sagging deep into the void between
 * the islands, and the capstan is still. After: they are taut, a row of lamps lit along each, and the capstan turns
 * slowly, holding the city together. Three tubes each way and one instanced pool of lamps.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Mooring-House holds the city (the world change)';
  rt.root.add(root);
  root.visible = false;
  const slack = new THREE.Group();
  slack.name = 'The slack cables';
  rt.root.add(slack);
  const cableM = makeMaterial({ color: '#4a3e34', flat: true, key: 'temple.spacecity.cable' });
  const lampM = makeMaterial({ color: '#ffe2a8', glow: 0.85, flat: true, key: 'temple.spacecity.cablelamps' });
  const N = 9;
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 5), lampM, CABLES.length * N);
  const m4 = new THREE.Matrix4(), at = [];
  if (O) {
    const from = O.top;
    const tube = (to, sag) => {
      const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return V(from.x + (to[0] - from.x) * t, from.y + (to[1] - from.y) * t - Math.sin(Math.PI * t) * sag, from.z + (to[2] - from.z) * t); });
      return { mesh: new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 4, false), cableM), pts };
    };
    CABLES.forEach((to, c) => {
      slack.add(tube(to, 34).mesh);
      const taut = tube(to, 2.5);
      root.add(taut.mesh);
      const curve = new THREE.CatmullRomCurve3(taut.pts);
      for (let i = 0; i < N; i++) { const p = curve.getPoint((i + 1) / (N + 1)); at.push(V(p.x, p.y - 0.5, p.z)); }
    });
  }
  root.add(lamps);
  for (const g of [root, slack]) g.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  let k = 0, want = 0, turn = 0, run = 0, running = false, waited = 0;
  const apply = () => { root.visible = k > 0.01; slack.visible = k < 0.99; };
  // the lamps light one by one out along every cable from the roof (LAMP_RUN.each s apart), each swelling in over
  // LAMP_RUN.on s: the climax films the run (run()); unfilmed, it goes after LAMP_RUN.wait s (issue #295)
  const scale = new THREE.Vector3(), q = new THREE.Quaternion();
  const placeLamps = () => {
    for (let c = 0, j = 0; c < CABLES.length; c++) for (let i = 0; i < N; i++, j++) {
      if (!at[j]) continue;
      const u = THREE.MathUtils.clamp((run - i * LAMP_RUN.each) / LAMP_RUN.on, 0, 1);
      m4.compose(at[j], q, scale.setScalar(Math.max(1e-4, u * u * (3 - 2 * u))));
      lamps.setMatrixAt(j, m4);
    }
    lamps.instanceMatrix.needsUpdate = true;
  };
  placeLamps();
  return {
    root, slack, lamps, lampAt: at,
    get on() { return want === 1; },
    /** How far the lamps' run is (0 none lit .. 1 all). */
    get lit() { return Math.min(1, run / LAMP_RUN.end); },
    set(on, { instant = false } = {}) {
      want = on ? 1 : 0;
      if (instant) { k = want; run = want ? LAMP_RUN.end : 0; running = false; apply(); placeLamps(); }
      if (!on) { run = 0; running = false; waited = 0; placeLamps(); }
    },
    /** The climax's film: the lamps' run out along the cables starts now (true if it still had to). */
    run() { if (!want || running || run >= LAMP_RUN.end) return false; running = true; return true; },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); apply(); }
      if (want && (waited += dt) > LAMP_RUN.wait) running = true;
      if (running && run < LAMP_RUN.end) { run = Math.min(LAMP_RUN.end, run + dt); placeLamps(); }
      turn += dt * 0.18 * k;
      if (O) O.capstan.rotation.y = SITE.heading + turn;
      lampM.uniforms.uGlow.value = 0.85 * k * (0.85 + 0.15 * Math.sin(t * 1.7));
    },
  };
}
/** The cable lamps' run (s): one lamp `each` s after the one before it along its cable, each swelling in over `on`. */
export const LAMP_RUN = { each: 0.28, on: 0.3, wait: 40, get end() { return 8 * this.each + this.on; } };

export const SPACECITY_TEMPLE = {
  id: 'spacecity', levelId: 'spacecity', name: 'The Mooring-House', doorLabel: 'door of the Mooring-House',
  gadget: 'tether', gadgetBox: 'spacecity.temple.tether', arenas: ARENAS, arenaDoor: 'd6',
  origin: [-130, 1500, -120], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its futuristic skin, issue #342: the look of the author's picks over the same rooms, src/temples/skins/mooring-house.js)
  skin: mooringHouseSkin,
  local: { person: 'joss', out: 7, side: 6 },
  enterLine: 'Inside the Mooring-House the floors stop short over nothing, and under them the stars go on. Somewhere behind iron bars, cable pays out with a long creak.',
  pitLine: 'You catch a hanging cable and haul yourself back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Over the city every cable draws taut, and its lamps light one by one.', 'resolved.out'); },
  // the loft's try: its ring brings a lamp down on its cord (and nothing else)
  onLit(rt, id) {
    if (id === 't0') rt.notice('The ring comes home with a clack, and a lamp drops from the loft’s roof.', 'sc.t0');
    // (#561) the Anchor Hold's key-cage eye
    if (id === 'eH') rt.notice('The eye wakes. Across the well the key’s cage sinks into the floor.', 'sc.eH');
  },
  // the thrown anchor: pull it home while its drum is slack and it jams (in its last phase, out over the void, wind
  // it in first: a push on its bars)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const m = G.model, A = G.arena;
    const mat = makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: 'temple.spacecity.anchor' });
    const cableM = makeMaterial({ color: '#6a5844', flat: true, key: 'temple.spacecity.anchorcable' });
    const mesh = new THREE.Mesh(anchorGeometry({ s: 0.8 }), mat), line = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 4).translate(0, 0.5, 0), cableM);
    for (const o of [mesh, line]) { o.userData.noCollide = true; o.userData.dynamic = true; o.visible = false; rt.root.add(o); }
    const an = rt.anchor = { at: V(), out: false, far: 0, a: 0, back: 0, from: V() };
    const _d = V(), _u = V(0, 1, 0), _q = new THREE.Quaternion();
    const place = () => {
      mesh.position.copy(an.at).add(V(0, 2.2, 0));
      m.drumAt(an.from);
      _d.subVectors(mesh.position, an.from);
      const L = _d.length();
      line.position.copy(an.from);
      line.quaternion.copy(_q.setFromUnitVectors(_u, _d.normalize()));
      line.scale.set(1, Math.max(0.01, L), 1);
    };
    /** Where it lies in its last phase: out over the void past the nearest window, `far` m beyond the floor's rim. */
    const overVoid = () => an.at.set(A.center.x + Math.sin(an.a) * (A.r + 0.5 + an.far), A.y - 1.2, A.center.z + Math.cos(an.a) * (A.r + 0.5 + an.far));
    const throwAnchor = () => {
      const P = rt.player, i = Math.min(G.phaseIndex, 2);
      const toP = P ? Math.atan2(P.pos.x - A.center.x, P.pos.z - A.center.z) : 0;
      if (i === 0) {
        // on the floor, between it and you
        const d = P ? Math.min(6, Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z) * 0.6) : 4, h = P ? Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z) : m.heading;
        an.at.set(m.pos.x + Math.sin(h) * d, A.y, m.pos.z + Math.cos(h) * d); an.far = 0;
      } else if (i === 1 && rt.bollards?.length) {
        // hooked over the bollard nearest you
        const b = rt.bollards.reduce((x, y) => (P && y.distanceTo(P.pos) < x.distanceTo(P.pos) ? y : x));
        an.at.copy(b).setY(A.y + 0.2); an.far = 0;
      } else {
        // paid out over the void, past the window nearest you
        const w = (rt.windows ?? [{ a: toP }]).reduce((x, y) => (Math.abs(Math.atan2(Math.sin(y.a - toP), Math.cos(y.a - toP))) < Math.abs(Math.atan2(Math.sin(x.a - toP), Math.cos(x.a - toP))) ? y : x));
        an.a = w.a; an.far = WARDEN.out; overVoid();
      }
      an.out = true; an.back = 0; m.hang(0, false);
      rt.sound?.critter?.('clank', 0.9);
    };
    /** A push on its bars, its last phase: the drum turns a notch and winds the anchor in toward the rim. */
    rt.windAnchor = () => {
      if (!an.out || an.far <= 0) return false;
      an.far = Math.max(0, an.far - WARDEN.wind);
      overVoid();
      if (an.far <= 0) an.at.set(A.center.x + Math.sin(an.a) * (A.r - 0.6), A.y, A.center.z + Math.cos(an.a) * (A.r - 0.6));
      rt.sound?.critter?.('creak', 0.9);
      rt.notice('The bars give: the drum turns a notch and winds the anchor in.', 'aw.wind');
      return true;
    };
    /** The tether on a thrown anchor: home it comes, and the drum jams. */
    rt.anchorPull = () => {
      if (!an.out || G.state !== 'open') return false;
      const P = rt.player;
      if (an.far > WARDEN.out - WARDEN.wind * 1.5 || (P && P.pos.distanceTo(an.at) > WARDEN.reach + 2.5)) {
        rt.notice('Too far over the void to tether. Push the capstan’s bars round.', 'aw.far');
        return false;
      }
      an.out = false; an.back = 0.7; an.far = 0;
      m.jam(1);
      G.add(WARDEN.pull[Math.min(G.phaseIndex, 2)], 'anchor');
      rt.rumble(0.7, 0.45);
      rt.sound?.chime?.();
      rt.notice('The anchor slams home into its drum. The capstan jams, shuddering.', `aw.pull.${G.phaseIndex}`);
      if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
      return true;
    };
    rt.offs.push(registerTarget({
      kind: 'sentinel', radius: 1.1, accepts: ['tether'], position: () => mesh.position, enabled: () => an.out && G.state === 'open',
      onHit: (mode) => { if (mode === 'tether') rt.anchorPull(); else rt.notice('It is hooked fast. Pulled, it would come; nothing else moves it.', 'aw.hooked'); return true; },
    }));
    const upd = G.update.bind(G);
    let was = G.state;
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.state === 'open' && was !== 'open') throwAnchor();
      if (G.state !== 'open' && an.out) { an.out = false; an.back = 0.7; }   // (it winds it back in itself)
      was = G.state;
      if (an.back > 0) {
        an.back = Math.max(0, an.back - dt);
        an.at.lerp(m.pos, Math.min(1, dt * 6));
        if (an.back === 0) m.hang(0, true);
      }
      mesh.visible = line.visible = an.out || an.back > 0;
      if (mesh.visible) place();
    };
  },
};
