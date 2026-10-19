import { landmark, LAMP_CROWN_LIFT } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import { glazing, glaze, metal } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { LightShaft } from '../veil.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, LightEar, LightFount, Bridge, Ball, Plate, Mark, Pit, Key, HookBell } from './pieces.js';
import { registerLight, registerDrinker, CARRY } from '../carried-light.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { mothModel } from './guardians.js';
import { offsetOf } from '../levels/names.js';
import { chestMound } from '../boxes/mound.js';
import { lampHouseSkin } from './skins/lamp-house.js';

// Lorn II's temple: the Lamp-House, a dark tower of the makers standing in the
// shallow water east of the root cave, a causeway of flat stones out to it from
// the end of the lit path. Its lamp lit the whole wood once; the night the sky
// rang it went out, and three of the pools with it. Hollin's people kept their
// pools lit for forty years without knowing there had been a greater lamp.
// Something with wings is still up in its lamp-room, in the dark.
//
// Inside (built far overhead, through its door; dark: the lantern charm glows in it). The temple's one idea:
// light wakes what waits for it, and light can be carried.
// Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms are shrines: every hall 30 to 36 m across under 17 m
// of stone or more, the chamber's round hall 34 m, doors 7 by 9 (ROOMS, DOOR), each puzzle in the middle of its own
// room, the one fight in the Kennel.
// Since v1.83 (issue #410, docs/design/temple-best-practices.md: G1, G2, G4, G6) the house turns on its GREAT LAMP, hung in
// the middle of the Lamp Hall: lit or dark, the house's one state (the drum `lamp`, saved), and the house's ways show
// in one or the other. Lit, the lamp's light runs out along the makers' pipes: the Lamp Passage's door opens to it (the
// Kennel's lamp-door did too until #477), a curtain of it bars the Wick Room, the moss-stones in the Dark Gallery shrink from it, and
// on the gallery's far floor it pours out of its pipe, a light a bubble may take. Dark, the curtain falls and the
// moss-stones rise. Kindled once with a bubble of light from its balcony, it is set at a lever by every hub (the Lamp
// Hall's floor and its gallery, the Lantern Chamber), and on the far floor with the hook at its pipe's ring (an older
// tool and the house's own at once). Read everywhere: one lamp colour for the house (warm lit, cold dark) on a lamp-post
// in every room, the levers' knobs, the doors' lintel lamps; the whole hall bright or dim.
//   the Threshold           the first mark, the way out
//   the Lamp Hall           (the Hall of Dark Pools until v1.83, its id `pools` kept) the house's great hall, 36 by 64 m
//                           under 34, its gallery along the west wall 9 m up and open over the floor (`hallUp`): both
//                           floors seen at once, the hub of both. The great lamp hangs in its middle, cold. Three
//                           pool-lamps for the Root Stair's door: two on the floor, the third up on a loft of roots out
//                           from the west wall, its pool far back from the edge: out of sight from the floor (climb to
//                           find it). (#477) A pool-orb rests by the nearer floor pool: lit by it and rolled up the
//                           floor to its socket, its lamp wakes the Kennel's lamp-door (the orb taught here, before the
//                           wand). East off it the Kennel and the Wick Room
//   the Kennel              (v1.49, issue #23: east off the hall, an arena, the house's one fight) where the keepers of
//                           the house's lamps were kept, dark; its lamp-door opens to the hall's pool-orb (#477; to the
//                           great lamp's light v1.83-v1.85), and shuts behind you while they stand round its middle.
//                           Won, before the wand, the small key's cage sinks: the Wick Room's grille, along the hall,
//                           takes it
//   the Root Stair          a dark pool across its middle, and no way over it: moss-stones lie sunk in it, dark until
//                           the lamp in their socket wakes, and only light wakes it. A pool-orb waits on the near floor
//                           beside a small pool, its groove across the floor to the socket. Light the pool, let the orb
//                           drink its light, then roll it to the socket before it fades: the lamp catches and the
//                           moss-stones rise glowing out of the pool (push + shot, before the chest); then a root-wall to
//                           climb. From its top a ledge runs back south along the west wall to the Lamp Hall's gallery,
//                           a lamp-door at its end (v1.83)
//   the Lantern Chamber     the makers' chest: the BUBBLE WAND (src/gadgets/bubble.js; issue #377: the lantern charm was
//                           here, and went to Lorn's makers' court), in the middle of a round hall. A bubble blown over
//                           a lit pool-lamp, or the chamber's fount of lamp-water, takes its light and glows, and where
//                           it bursts the light goes: a dark lamp's glass or a dark orb drinks it (src/carried-light.js).
//                           The lamp by the dais is the ledge door's (v1.83: a try before): a bubble of the fount's light
//                           wakes it, and down the ledge the gallery's door sinks. The Lamp Passage north, its door a
//                           lamp-door: it opens to the great lamp's light, for good. A lever by it
//   the Lamp Hall's gallery the great lamp's balcony out from it, a pool-lamp on its end: a bubble of its light sent to the
//                           lamp's glass kindles it, behind its shutters; the lever by it opens them. Its edge drops 9 m
//                           to the hall's floor (G6: the way back down to the hub)
//   the Dark Gallery        a chasm across its middle, moss-stones sunk in it that rise glowing in the dark, and take
//                           root: come into it in the great lamp's light and they lie sunk (the chamber's lever, a room
//                           back, darkens it). On the far floor the far door's lamp, on a post: it wakes to a bubble of
//                           the great lamp's light, which pours from its pipe into a basin there only while the lamp is
//                           lit; the pipe's ring high over the far door, hooked, opens or shuts the great lamp's
//                           shutters from there (the hook and the bubble at once: an older tool and the house's own)
//   the Wick Room           (v1.60, east of the Root Stair, its way in off the Lamp Hall's east wall, barred by a curtain of
//                           the great lamp's light while it is lit) the gallery's far door takes its great key. In the
//                           middle of its floor the wick-house: two niches in its face, a pool-orb in a groove before
//                           each, the great key behind a grille between them, a keyhole in the grille (the Kennel's small
//                           key). A niche's lamp burns only while its orb glows; the grille lifts, for good, only while
//                           both burn: light one orb with a bubble of the pool-lamp's light, roll it home, light the
//                           other and roll it home before the first fades (two lights carried at once). A stair up its
//                           north wall to a balcony, and a keepers' door that opens with the grille onto a ledge of roots
//                           along the Root Stair's wall to the root-wall's top: the way back up to the chamber, a loop
//   the Lamp-Room           the guardian (organic: you calm it): the Lampless, a great moth. When it hangs low,
//                           searching for light, send it a bubble of light (blown by a lit pool), and it drinks. Three
//                           dark pools lie round the room: lit earlier (a splash, or your lantern held by one), a
//                           pool lures it as it searches, and it drinks there (taught in its second phase; in its
//                           last it shies from you: a bubble from afar, or a pool while you stand back)

// After: the Lamp-House's lamp burns again, its beam turning over the wood at night (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** In the shallow water east of the root cave; its door looks west, down the causeway to the path's end. */
// (the Deep Wood's own coordinates, moved to where the wood lies in Lorn: src/levels/names.js PART_OFFSET)
const [OX, , OZ] = offsetOf('perdide2');
export const SITE = { x: 102 + OX, z: -452 + OZ, r: 14, path: [6 + OX, -414 + OZ] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

/**
 * The Lamp-House's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/lamp-house):
 * dark slate in blocks, grey flagstones, moss at the walls' foot and the frames mossy grey, hanging lamps under the friezes
 * and every lamp's pool on the stone warm amber (lampTint); its shade a deep blue-violet, its light a dim warm grey.
 */
export const PALETTE = {
  wall: '#504f5e', wall2: '#484756', wall3: '#5a5966', floor: '#504e58', floor2: '#47454f', trim: '#6c6b55', fitting: '#a07a3e',
  dark: '#1b1d33', stone: '#5e5c66', accent: '#f0927a', glow: '#8fe0d0', glyph: '#f0b450', lamp: '#ffd6a0', sand: '#5a5068', sand2: '#4e4560', void: '#14162c',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.7, shade: 0.15, lampTint: ['#f2b45a', 0.75] },
    wall: { mode: 0, grid: 1.8, plates: true },
    floor: { mode: 0, grid: 2.2, plates: true },
    glyph: { glow: 0.5 },
  },
  bands: [{ at: 0.72, h: 1.0, color: '#3f4254' }, { y: 0.3, h: 0.6, color: '#5a6139' }],
  ornament: { kind: 'lamp', color: '#f6c060', color2: '#3a3a40', glow: 0.85 },
  light: { shadow: '#383a5e', light: '#e8dcc4', sun: '#f0d8a8' },
};

/**
 * The house's doors (m: issue #336, 5 by 6.4 before; the Wick Room's grille 2.4 by 3) and its rooms in the kit's local
 * frame (z into the house): each hall's floor from wall to wall (its walls stand outside it), its floor's height and its
 * ceiling's; the round halls' middles and radii. The Root Stair and the Dark Gallery stand on their pits' floors (`y`),
 * their floors at `floor` (`near` the near floor's depth, `pit` the pit's; the Root Stair's root-wall the rest, its top
 * at `wall`). The props (the pools, the orbs, the niches, the moss-stones), the pits and every groove as long as they
 * were, so every timing and every climb holds.
 */
export const DOOR = { w: 7, h: 9 };
/**
 * (issue #410) The Lamp Hall, the house's great hall (G4): the Hall of Dark Pools grown 24 m north and 8 m up, so every
 * room past it (the Root Stair, the Lantern Chamber, the Dark Gallery, the Lamp-Room and the Wick Room) stands SHIFT m
 * further north than it did. The Kennel keeps its place.
 */
export const SHIFT = 24;
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  pools: { x0: -18, x1: 18, z0: 15.2, z1: 55.2 + SHIFT, y: 0, top: 34 },
  roots: { x0: -18.5, x1: 18.5, z0: 56.4 + SHIFT, z1: 102.4 + SHIFT, y: -6, floor: 0, top: 28, near: 20, pit: 10.1, wall: 9 },
  lantern: { x: 0, z: 125 + SHIFT, r: 17, y: 9, top: 25 },
  gallery: { x0: -18, x1: 18, z0: 146 + SHIFT, z1: 206 + SHIFT, y: -3, floor: 9, top: 27, near: 16, pit: 27 },
  kennel: { x0: 26, x1: 56, z0: 10, z1: 40, y: 0, top: 18 },
  wick: { x0: 26, x1: 56, z0: 45 + SHIFT, z1: 85 + SHIFT, y: 0, top: 20 },
};
/**
 * (issue #410) The Lamp Hall's gallery (`hallUp`): along its west wall at y, from x0 to x1 and z0 to the hall's north
 * wall, open over the floor, a parapet `parapet` high along its edge but where it drops (`drop`: [z0, z1] of its edge,
 * G6, the way back down to the hub); the great lamp's balcony out from it (`pier`: to x1, from z0 to z1), a pool-lamp on
 * its end (`pool`: [x, z]). The loft of roots (`loft`) south of it on the same wall, 12 m short of it, a metre lower.
 */
export const GALLERY = { x0: -18, x1: -11, z0: 52, y: 9, t: 0.8, parapet: 1.1, drop: [67, 77], pier: { x1: -5.5, z0: 56, z1: 64 }, pool: [-7.0, 60] };
export const LOFT = { x1: -6.2, z0: 26, z1: 40, top: 8 };
/**
 * (issue #410) The great lamp, the house's state: its glass's middle (local) and radius, its cage's, how far its light
 * reaches when its shutters are open (m), and its lamp-room-sized light's.
 */
export const GREAT_LAMP = { at: [0, 13, 60], r: 2.1, cage: 3.0, reach: 48 };
/** (issue #410) The ledge from the Root Stair's root-wall top back south along its west wall, at y, to the gallery's door. */
export const LEDGE = { x0: -18.5, x1: -11.5, y: 9, door: { x: -14.75, w: 6.4 } };
/**
 * (issue #410) The great lamp's levers (local, the way each faces): by every hub, the Lamp Hall's floor and its gallery,
 * and the Lantern Chamber (by the Lamp Passage); the pipe's ring on the Dark Gallery's far floor (the hook's).
 */
export const LEVERS = [
  { room: 'pools', at: [12.5, 0, 50], yaw: -Math.PI / 2 },
  { room: 'hallUp', at: [-16.2, 9, 66.5], yaw: Math.PI / 2 },
  { room: 'lantern', at: [4.6, 9, 125 + SHIFT + 8.6], yaw: Math.PI },
];
/** The great lamp's two stops, as conditions: lit (kindled, its shutters open) and dark. */
export const LIT = { all: [{ lit: 'lG' }, { drumOn: ['lamp', 'lampLit'] }] }, DARK = { drumOn: ['lamp', 'lampDark'] };
/** Its look in every room: the house's lamps warm while it is lit, cold and dim while it is dark. */
export const LAMP_LOOK = { lit: '#ffc46a', dark: '#566aa0', glow: [0.12, 0.9], cold: '#30344a' };
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
/**
 * The Kennel (v1.49, east off the Hall of Dark Pools: an arena in the dark; since v1.77 the house's one fight, its keepers
 * round its middle) and the Wick Room (v1.60: east of the Root Stair, its way in off the Hall of Dark Pools' east wall at z
 * `door`; v1.49 it stood off the Dark Gallery's far side), local m: the room round x, z (w by d, h high); its balcony along
 * the west wall at the root-wall's height ([z0, z1, its depth]) and the stair up the north wall to it ([x at its foot, x
 * at its head, z], stairW wide). Since v1.77 the niches, the orbs and the great key stand in the middle of the room, in
 * the wick-house: a block of stone whose south face is at z `face`, its two niches' x (`niches`), the orbs' grooves along z
 * ([from, to]: to the niches' mouths), the great key behind its grille in the block at z `keyZ`; the orbs' glow (s).
 */
const [KX, KZ] = mid(ROOMS.kennel), [WX, WZ] = mid(ROOMS.wick);
export const KENNEL = { x: KX, z: KZ, w: 30, d: 30, zone: { min: [ROOMS.kennel.x0, -1, ROOMS.kennel.z0], max: [ROOMS.kennel.x1, 9, ROOMS.kennel.z1] } };
const S = SHIFT;
export const WICK = { x: WX, z: WZ, w: 30, d: 40, h: 20, door: 50 + S, balcony: [72 + S, 85 + S, 5], stair: [44, 31, 82.6 + S], stairW: 4.4,
  face: 64 + S, niches: [34.7, 47.3], groove: [53.2 + S, 61.2 + S], keyZ: 68.5 + S, lasts: 25, pool: 55.5 + S };
/**
 * The keepers' way between the Wick Room's balcony and the Root Stair's root-wall top (v1.60): a ledge of roots along the
 * stair's east wall at the root-wall's height, [x0, z0, x1, z1] (over the pool, out of any jump's reach from the floor),
 * and a passage east through the wall at z.
 */
export const ROOT_WAY = { x0: 14, z: 81 + S, y: 9, ledge: [14, 77 + S, 18.5, 86.5 + S] };
/**
 * (issue #377: the bubble wand is the house's tool, its bubbles carrying a lamp's light, src/carried-light.js) How far a lit
 * pool-lamp's light reaches a bubble (m); the Lantern Chamber's fount (local: its foot).
 */
export const POOL_LIGHT = 3.5;
/** (issue #477) The Kennel's pool-orb on the Lamp Hall's floor: its groove's x, and its z from the orb's rest by the pool s1 to the socket. */
export const KENNEL_ORB = [3.7, 31.5, 43.5];
export const FOUNT = [-2.4, 9, 132 + S];
/**
 * (issue #410) The Dark Gallery's far floor ([x, z from the far lip]): the far door's lamp on its post, the basin the great
 * lamp's light pours into from its pipe while it is lit, and the pipe's ring high over it (y over the floor), out of the
 * hook's reach from the near lip.
 */
export const FAR = { lamp: [-5.2, 4], basin: [-1.2, 4.5], ring: 7.5, light: 2.6 };
/** (issue #410) The pipe's valve: how long its ring, hooked, holds it open (s). */
export const PIPE = { hold: 9 };

export const LOGIC = {
  id: 'perdide2', entry: 'threshold', gadget: 'bubble',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js. The
  // Lantern Chamber a puzzle room: the chest in its middle, the ledge door's lamp beside it. Since v1.83 (issue #410)
  // `pools` is the Lamp Hall's floor and `hallUp` its gallery)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, pools: { checkpoint: true, kind: 'puzzle' }, loft: { kind: 'puzzle' }, hallUp: { checkpoint: true, kind: 'puzzle' },
    roots: { checkpoint: true, kind: 'puzzle' }, lantern: { checkpoint: true, kind: 'puzzle' }, kennel: { checkpoint: true, kind: 'combat' },
    gallery: { checkpoint: true, kind: 'passage' }, galleryFar: { checkpoint: true, kind: 'puzzle' }, wick: { checkpoint: true, kind: 'puzzle' }, wickKey: { kind: 'passage' },
    lamp: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'pools' },
    { a: 'pools', b: 'loft' },                                        // up the loft of roots
    { a: 'pools', b: 'kennel', door: 'dK' },                         // the Kennel, east off the hall (v1.49): an arena, the small key; its lamp-door lit (v1.83)
    { a: 'pools', b: 'wick', door: 'cur' },                          // the Wick Room, east off the hall too (v1.60): a curtain of the great lamp's light while it is lit (v1.83)
    { a: 'pools', b: 'roots', door: 'd1' },
    { a: 'roots', b: 'lantern', door: 'disc' },                      // the moss-stones over the dark pool, once their lamp is lit
    { a: 'lantern', b: 'hallUp', door: 'dC' },                       // (v1.83) the ledge from the root-wall's top back along the Root Stair, its lamp-door into the gallery
    { a: 'hallUp', b: 'pools', oneWay: true },                       // (G6, issue #410: the gallery's edge, a drop to the hall's floor, the hub)
    { a: 'wick', b: 'lantern', door: 'dU' },                         // its keepers' door onto the ledge round the stair to the root-wall's top, with its grille: a loop
    { a: 'lantern', b: 'gallery', door: 'd2' },                      // the Lamp Passage's door, past the chamber (one room with it)
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'wick', b: 'wickKey', door: 'cW' },                         // its grille: both its lamps lit at once
    { a: 'galleryFar', b: 'lamp', door: 'd4' },
    { a: 'lamp', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'pools' }, s2: { type: 'switch', room: 'pools' }, s3: { type: 'switch', room: 'loft' },
    d1: { type: 'door', opens: { all: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] }, latch: true },
    // (issue #477, the house reshaped: the Kennel before the wand, the great key straight after it, the great lamp on the way
    // back) the Kennel's lamp-door wakes to a pool-orb: on the hall's floor, the orb drinks the near pool's light (s1, one of
    // the Root Stair door's three) and is rolled to its socket before it fades; the socket's lamp catches, and the door opens
    // for good. The orb taught here, before the Root Stair's (the test) and the Wick Room's two at once (the twist). Its
    // keepers beaten, the small key's cage sinks: for the Wick Room's grille
    oK: { type: 'drum', room: 'pools', plate: 'pK', plateAt: 1, start: 0 },   // the Kennel's pool-orb, rolled to its socket
    pK: { type: 'plate', room: 'pools' },                            // its socket
    lK: { type: 'switch', room: 'pools' },                            // the socket's lamp: it wakes to a glowing orb
    dK: { type: 'door', opens: { all: [{ lit: 's1' }, { drumOn: ['oK', 'pK'] }, { lit: 'lK' }] }, latch: true },
    arK: { type: 'arena', room: 'kennel' },
    kS: { type: 'key', kind: 'small', room: 'kennel', when: { lit: 'arK' } },
    // (v1.77) the small pool, the pool-orb and its socket in the middle of the Root Stair's floor
    s5: { type: 'switch', room: 'roots' },                            // the small pool by the orb: its light for the orb
    orb5: { type: 'drum', room: 'roots', plate: 'p5', plateAt: 1, start: 0 },   // a pool-orb, rolled to the socket
    p5: { type: 'plate', room: 'roots' },                             // the disc's socket
    l5: { type: 'switch', room: 'roots' },                            // the socket's lamp: it wakes to a glowing orb
    disc: { type: 'bridge', opens: { all: [{ lit: 's5' }, { drumOn: ['orb5', 'p5'] }, { lit: 'l5' }] }, latch: true },
    // (issue #377: the chest held the lantern charm, a light round you; the bubble wand now, whose bubbles carry a lamp's
    // light where you can't, src/carried-light.js; the lantern waits in Lorn's makers' court)
    chest: { type: 'gadget', room: 'lantern', item: 'bubble' },
    // (issue #410) the lamp by the dais, a bubble of the fount's light: down the ledge along the Root Stair, the gallery's
    // door sinks (the lamp was a try before, and the Lamp Passage's door had a lamp of its own by the fount)
    l0: { type: 'switch', room: 'lantern', needs: ['bubble'] },
    dC: { type: 'door', opens: { lit: 'l0' }, latch: true },
    // (issue #410) the great lamp, kindled from its balcony: a bubble of the balcony's pool-lamp's light burst on its glass.
    // It catches behind its shutters; a lever opens them (the state, `lamp`, below)
    s8: { type: 'switch', room: 'hallUp' },
    lG: { type: 'switch', room: 'hallUp', needs: ['bubble'], when: { lit: 's8' } },
    // (issue #410) the Wick Room's way in: barred by a curtain of the great lamp's light while it is lit
    cur: { type: 'door', opens: DARK },
    // the Lamp Passage's door: a lamp-door, open for good once the great lamp has lit it
    d2: { type: 'door', opens: LIT, latch: true },
    // the moss-stones sunk in the chasm rise in the dark, and take root (lit, they lie sunk: issue #410; their lamp
    // hanging over the chasm woke them before, the lantern's light showed them before issue #377). They first knew the
    // light when the Lamp Passage's door let it in: until then they keep still
    br1: { type: 'bridge', opens: { all: [DARK, { open: 'd2' }] }, latch: true },
    // the Wick Room (v1.60: off the first hall): the gallery's far door wants its great key, behind a grille with a keyhole
    // (the Kennel's small key) that lifts only while both niches burn. Up a stair on its balcony, a keepers' door that opens
    // with the grille, onto the ledge round the Root Stair: the way back up
    dU: { type: 'door', opens: { open: 'cW' }, latch: true },   // (the keepers' door goes with the grille)
    // two niches, two pool-orbs, one pool-lamp. The grille over the great key lifts (for good) only while both niches'
    // lamps burn, and a niche's lamp burns only while its orb glows (`hold`: the orb's own time, its piece puts it out),
    // and the orbs glow with the pool-lamp's light (a bubble of it each): light one, roll it home, light the other and roll
    // it home before the first goes dark
    sW: { type: 'switch', room: 'wick' },                            // the wick-house's pool-lamp: the light the bubbles carry to the orbs
    lW1: { type: 'switch', room: 'wick', needs: ['bubble'], hold: WICK.lasts, when: { all: [{ drumOn: ['oW1', 'pW1'] }, { lit: 'sW' }] } },
    lW2: { type: 'switch', room: 'wick', needs: ['bubble'], hold: WICK.lasts, when: { all: [{ drumOn: ['oW2', 'pW2'] }, { lit: 'sW' }] } },
    oW1: { type: 'drum', room: 'wick', plate: 'pW1', plateAt: 1, start: 0 },
    pW1: { type: 'plate', room: 'wick' },
    oW2: { type: 'drum', room: 'wick', plate: 'pW2', plateAt: 1, start: 0 },
    pW2: { type: 'plate', room: 'wick' },
    cW: { type: 'door', lock: 'small', opens: { all: [{ lit: 'lW1' }, { lit: 'lW2' }] }, latch: true },   // (and the Kennel's small key: it goes in on the way in, and waits)
    kB: { type: 'key', kind: 'big', room: 'wickKey' },
    // (issue #410) the far door: the great key, and its lamp on a post on the far floor, woken by a bubble of the great
    // lamp's light, which pours from its pipe into a basin there while the pipe's valve is open (`pv`, below: its ring hooked
    // from the far floor, the chasm wider than the hook's reach, it opens for a few breaths, a held bell, PIPE.hold s; and
    // it opens the great lamp's shutters with it, kindled long before: the Kennel and the Lamp Passage wanted it)
    l2: { type: 'switch', room: 'galleryFar', needs: ['bubble'], when: { lit: 'pv' } },
    d4: { type: 'door', lock: 'big', opens: { lit: 'l2' }, latch: true },
    pv: { type: 'bell', room: 'galleryFar', needs: ['hook'], hold: PIPE.hold },
    moth: { type: 'boss', room: 'lamp', needs: ['gun', 'bubble'] },
    d5: { type: 'door', opens: { resolved: true } },
    // (issue #410) the great lamp's shutters, the house's state: dark (0) or open (1), saved; their light only once it is
    // kindled (lG: LIT, DARK). Set at the levers by the hubs (the Lamp Hall's floor and gallery, the Lantern Chamber), and
    // on the Dark Gallery's far floor with the hook at its pipe's ring. Its two stops are no plates anyone stands on (no
    // room: nothing points at them). (Last of the things to do, so the scout asks for it only once nothing nearer is left)
    lamp: { type: 'drum', room: 'hallUp', rooms: ['pools', 'lantern', { room: 'galleryFar', needs: ['hook'] }], stops: { lampDark: 0, lampLit: 1 }, start: 0, roll: 'hand', verb: 'lamp' },
    lampDark: { type: 'plate' }, lampLit: { type: 'plate' },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'roots', at: [-17.5, 0, 63 + S], yaw: Math.PI / 2 },
  },
};

export const LAMPLESS = {
  kind: 'organic', name: 'the Lampless', final: 'touch', touch: 'lay a hand on its back',
  speed: 3.4, wakeTime: 3,
  wake: 'Wings wide as sails open in the dark lamp-room. It is hungry for light.',
  openHint: 'It hangs low, searching for light. Send it a bubble of light.',
  missHint: 'Its swoop went wide: it hangs low. Send it a bubble of light.',
  weary: 'It folds its wings and settles, lit with your light. Go to it.',
  resolved: 'The Lampless climbs to the lamp, and the whole room goes gold.',
  phases: [
    { to: 0.45, attacks: ['swoop', 'gust', 'dust'], pause: 1.6, hint: 'When it hangs low, send it a bubble blown by a lit pool.' },
    { to: 0.75, attacks: ['flutter', 'scales', 'swoop'], pause: 1.3, hint: 'Send it a bubble of light, or leave it a lit pool to drink.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'dodge', moves: ['flutter'], open: 4.0,
        hint: 'Hop clear as its wings beat down: overreached, it hangs low.',
        said: 'Its wings beat empty air. It hangs low, searching: send it a bubble of light.',
        lines: ['Its wings beat at you.', 'Hop back from its fluttering wings just as they come down.', 'When it flutters at you, flip back (stick back and A / ×) as the wings fall; then send it a bubble of light ({key:aim}, {key:fire}).'] } },
    { to: 0.9, attacks: ['spiral', 'scales', 'gust'], pause: 1.1, hint: 'It shies from you: send light from afar, or leave it a lit pool.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    // (a swoop that misses you catches its wings on the floor: it hangs low longer, missHint; its dust beaten down runs
    // out along the floor in a ring you jump, as the Cloud-Mother's wail does: combat-v1.6)
    swoop: { shape: 'ring', at: 'player', radius: 4.2, wind: 1.5, track: 0.6, over: true, part: 'core', rig: 'rise', parts: ['body'], splash: 0.5, active: 0.45, damage: 0.75, knock: 9, recover: 0.9, open: 4.0, miss: 5.4 },
    gust: { shape: 'cone', range: 14, angle: 0.6, wind: 1.3, track: 0.6, part: 'wings', rig: 'lean', blast: { kind: 'front', r0: 2.5, h: 2.4 }, damage: 0.75, knock: 12, recover: 0.8 },
    dust: { shape: 'ring', at: 'self', radius: 8.5, wind: 1.4, part: 'wings', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.5 }, damage: 0.75, knock: 10, recover: 0.8, open: 3.4 },
    flutter: { shape: 'cone', range: 8, angle: 0.8, wind: 1.2, track: 0.7, part: 'wings', rig: 'lean', blast: { kind: 'front', r0: 2, h: 2.2 }, active: 0.3, gap: 0.75, damage: 0.5, knock: 9, recover: 0.5, then: 'flutter2' },
    flutter2: { shape: 'cone', range: 8, angle: 0.8, wind: 0.65, track: 0.6, part: 'wings', rig: 'lean', pose: 'flutter', link: true, blast: { kind: 'front', r0: 2, h: 2.2 }, active: 0.3, damage: 0.5, knock: 9, gap: 0.2, then: 'dustEnd' },
    dustEnd: { shape: 'ring', at: 'self', radius: 8.5, wind: 1.2, part: 'wings', rig: 'swell', pose: 'dust', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.5 }, damage: 0.75, knock: 10, recover: 0.8, open: 3.4 },
    scales: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'wings', rig: 'swell', damage: 0.5, knock: 6, recover: 0.7 },
    spiral: { shape: 'ring', at: 'player', radius: 4.2, wind: 1.4, track: 0.6, over: true, part: 'core', rig: 'rise', pose: 'swoop', parts: ['body'], splash: 0.5, active: 0.4, gap: 0.4, damage: 0.75, knock: 9, recover: 0.4, then: 'spiral2' },
    spiral2: { shape: 'ring', at: 'player', radius: 4.2, wind: 1.0, track: 0.6, over: true, part: 'core', rig: 'rise', pose: 'swoop', link: true, parts: ['body'], splash: 0.5, active: 0.45, damage: 0.75, knock: 9, recover: 0.9, open: 4.0, miss: 5.4 },
  },
};

/** How close it lets you be to a pool it goes down to (m), and how long it drinks there (s). */
export const LURE = { back: 5, drink: 1.2, speed: 8, reach: 1.2 };

/**
 * The Lamp-Room's three pools: dark until lit, by a splash (as the Hall of Dark Pools taught) or by your lantern held
 * by one a moment (its light carried there). A lit pool stays lit until the Lampless drinks it dark. o: { at: [[x, z]], y }
 */
class LurePools {
  constructor(rt, o) {
    this.rt = rt;
    const K = rt.kit, M = rt.M;
    this.list = o.at.map(([x, z], i) => {
      K.add(M.trim, T(annulus(1.6, 2.1, 0.16, 32), [x, o.y + 0.08, z]));
      const mat = makeMaterial({ color: PALETTE.glow, glow: 0.05, flat: true, key: `temple.p2.lure.${i}` });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 28), mat);
      m.position.copy(K.world(x, o.y + 0.1, z));
      m.userData.noCollide = true; m.userData.dynamic = true;
      rt.root.add(m);
      const light = new THREE.Vector4(0, -1e5, 0, 0);
      rt.lights.push(light);
      const pool = { i, at: m.position.clone(), m, mat, light, lit: false, held: 0 };
      pool.offLight = registerLight({ position: () => pool.at, radius: POOL_LIGHT, enabled: () => pool.lit });   // (issue #377: a bubble takes its light)
      pool.off = registerTarget({ kind: 'switch', radius: 1.7, position: () => pool.at, onHit: (mode) => { if (mode !== 'push') this.light(pool); return true; } });
      return pool;
    });
    rt.lurePools = this;
  }
  light(p) {
    if (p.lit) return;
    p.lit = true;
    this.rt.sound?.chime?.();
    this.rt.notice?.('The pool takes the light and holds it, glowing.', 'lure.lit');
  }
  /** Drunk dark. */
  drain(p) { p.lit = false; }
  get lit() { return this.list.filter((p) => p.lit); }
  update(dt, t) {
    const P = this.rt.player, lantern = this.rt.logic.has('lantern');
    for (const p of this.list) {
      // your lantern held by a dark pool a moment: its light carried into it
      const near = P && lantern && !p.lit && Math.hypot(P.pos.x - p.at.x, P.pos.z - p.at.z) < 2.6 && Math.abs(P.pos.y - p.at.y) < 2;
      p.held = near ? p.held + dt : 0;
      if (p.held > 1.2) { p.held = 0; this.light(p); }
      p.mat.uniforms.uGlow.value = p.lit ? 0.8 + 0.12 * Math.sin(t * 3 + p.i) : 0.05 + 0.6 * Math.min(1, p.held / 1.2);
      if (p.lit) p.light.set(p.at.x, p.at.y + 1.5, p.at.z, 9); else p.light.set(0, -1e5, 0, 0);
    }
  }
  dispose() { for (const p of this.list) { p.off(); p.offLight?.(); } }
}

// ------------------------------------------------------------------ the great lamp: the house's state (issue #410)
/** The one lamp material every lever's knob, lamp-post and pipe's basin shares (its colour set once a frame: GreatLamp). */
const stateLamp = () => makeMaterial({ color: LAMP_LOOK.dark, glow: LAMP_LOOK.glow[0], flat: true, key: 'temple.perdide2.state' });
const _lc = new THREE.Color();
const smooth = (k) => k * k * (3 - 2 * k);

/**
 * The great lamp (LOGIC `lamp`, a drum of two stops: dark 0, open 1; `lG` its kindling): this piece keeps the house's
 * state. It hangs in the middle of the Lamp Hall in a brass cage, a ring of shutters round its glass. Cold until a
 * glowing bubble bursts on its glass (a bubble of its balcony's pool-lamp's light: `lG`, which wants `s8` lit); then it
 * burns behind its shutters, gold at their seams, and a lever (LampLever) or the pipe's ring (PipeLight) opens them:
 * its light floods the hall and runs out along the makers' pipes (LIT), or they shut and the house goes dark (DARK). It
 * lights the house's lamps (stateLamp), the hall, and points the scout at the nearest place to set it from (`center`).
 * o: { id: 'lamp', at: [x, y, z] its glass's middle (local), r, cage, top: the roof's height over it }
 */
export class GreatLamp {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, r = o.r, c = o.cage, top = o.top;
    this.at = K.world(x, y, z); this.glass = this.at;
    this.lamp = stateLamp();
    // the cage (drawn only: it hangs in the air, nothing stands on it): two brass rings, its ribs, a cap, four chains up
    const hi = y + r + 0.9, lo = y - r - 0.7;
    for (const yy of [hi, lo]) K.add(M.trim, T(new THREE.TorusGeometry(c, 0.16, 6, 40), [x, yy, z], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.add(M.trim, box(0.14, hi - lo, 0.14, x + Math.sin(a) * c, (hi + lo) / 2, z + Math.cos(a) * c)); }
    K.add(M.trim, T(new THREE.ConeGeometry(c + 0.3, 1.4, 16), [x, hi + 0.7, z]));
    K.add(M.trim, T(new THREE.ConeGeometry(0.9, 1.3, 12), [x, lo - 0.6, z], [Math.PI, 0, 0]));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + TAU / 8, cx = x + Math.sin(a) * (c - 0.3), cz = z + Math.cos(a) * (c - 0.3); K.add(M.dark, box(0.12, top - hi - 0.6, 0.12, cx, (top + hi + 0.6) / 2, cz)); }
    // its glass, and the shutters round it: eight leaves, each hinged at its outer edge, shut a ring round the glass
    this.glassM = makeMaterial({ color: LAMP_LOOK.lit, glow: 0.04, flat: true, key: 'temple.perdide2.glass' });
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), this.glassM);
    g.position.copy(this.at);
    this.leaves = [];
    const n = 8, lw = 2 * (r + 0.35) * Math.tan(Math.PI / n) * 1.04, lh = 2 * r + 0.9;
    this.cage = new THREE.Group();
    this.cage.position.copy(this.at);
    this.cage.rotation.y = K.heading(0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, hinge = new THREE.Group();
      // (each leaf's hinge on the ring at its edge; the leaf swings out round it)
      hinge.position.set(Math.sin(a + Math.PI / n) * (r + 0.35) / Math.cos(Math.PI / n), 0, Math.cos(a + Math.PI / n) * (r + 0.35) / Math.cos(Math.PI / n));
      hinge.rotation.y = a + (2 * Math.PI) / n;   // (its +x along the ring's edge to the next hinge, its +z out)
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.1).translate(lw / 2, 0, 0), rt.M.trimMat);
      hinge.add(leaf);
      this.cage.add(hinge);
      this.leaves.push(hinge);
    }
    for (const m of [g, this.cage]) { m.traverse((q) => { q.userData.noCollide = true; q.userData.dynamic = true; }); rt.root.add(m); }
    g.name = 'The great lamp’s glass'; this.cage.name = 'The great lamp’s shutters';
    this.glassMesh = g;
    this.light = new THREE.Vector4(0, -1e5, 0, 0);
    rt.lights.push(this.light);
    this.k = this.isLit ? 1 : 0; this.time = 0;
    this.setters = [];   // (the levers, and the pipe's ring once the hook is carried: the scout's)
    this.offs = [
      rt.game?.on?.('bubble:light', ({ pos } = {}) => this.kindle(pos)),
      registerDrinker({ position: () => this.glass, radius: r + 0.4, enabled: () => !this.kindled }),
    ].filter(Boolean);
    rt.greatLamp = this;
  }
  get kindled() { return this.rt.logic.isLit('lG'); }
  get open() { return this.rt.logic.drumOn(this.id, 'lampLit'); }
  get isLit() { return this.rt.logic.check(LIT); }
  /** A glowing bubble burst at `pos`: on its glass, it catches (behind its shutters). */
  kindle(pos) {
    const rt = this.rt;
    if (!pos || this.kindled || pos.distanceTo(this.glass) > this.o.r + CARRY.reach) return;
    if (!rt.logic.light('lG')) return;
    rt.sound?.chime?.(); rt.rumble?.(0.8, 0.3); rt.onLit?.('lG'); rt.applyDoors?.();
    rt.notice?.('The great lamp catches behind its shutters. A lever opens them.', 'lG.lit');
  }
  /** A lever pulled: its shutters opened, or shut. Cold, it says so. Returns what it did ('lit', 'dark', 'cold'). */
  toggle(by = null) {
    if (!this.kindled) {
      this.rt.notice?.('The great lamp hangs cold. Its shutters open on nothing.', 'lamp.cold');
      return 'cold';
    }
    return this.set(!this.open, by);
  }
  /** Its shutters open (true) or shut. */
  set(open, by = null) {
    const rt = this.rt;
    if (!this.kindled) return 'cold';
    if (this.open === open) return open ? 'lit' : 'dark';
    rt.logic.moveDrum(this.id, open ? 1 : 0); rt.applyDoors?.();
    rt.sound?.whoosh?.(); rt.rumble?.(open ? 1.0 : 0.6, 0.35);
    rt.notice?.(open ? 'The great lamp’s shutters open. Its light runs out through the house.' : 'The great lamp’s shutters close. The house goes dark.', open ? 'lamp.lit' : 'lamp.dark');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id, by });
    return open ? 'lit' : 'dark';
  }
  update(dt, t) {
    this.time += dt;
    const want = this.isLit ? 1 : 0;
    this.k += (want - this.k) * Math.min(1, dt * 2.2);
    const e = smooth(this.k);
    // the shutters swing out round the glass; the glass burns behind them once kindled (gold at the seams)
    for (const h of this.leaves) h.children[0].rotation.y = -e * 1.4;
    this.glassM.uniforms.uGlow.value = this.kindled ? 0.32 + 0.6 * e + 0.04 * Math.sin(t * 3) : 0.04 + 0.02 * Math.sin(t * 1.1);
    this.glassM.uniforms.uColor.value.set(this.kindled ? LAMP_LOOK.lit : LAMP_LOOK.cold);   // (cold: dark glass)
    // every lamp of the house at once: warm while it is lit, cold while it is dark
    const u = this.lamp.uniforms;
    u.uColor.value.set(LAMP_LOOK.dark).lerp(_lc.set(LAMP_LOOK.lit), e);
    u.uGlow.value = LAMP_LOOK.glow[0] + e * (LAMP_LOOK.glow[1] - LAMP_LOOK.glow[0] + 0.05 * Math.sin(t * 2.6));
    if (e > 0.02) this.light.set(this.glass.x, this.glass.y, this.glass.z, 6 + (GREAT_LAMP.reach - 6) * e);
    else if (this.kindled) this.light.set(this.glass.x, this.glass.y, this.glass.z, 5);
    else this.light.set(0, -1e5, 0, 0);
  }
  /** Where to set it from (the scout's): its glass until it is kindled; then the nearest lever, or the ring with the hook. */
  get center() {
    if (!this.kindled) return this.glass;
    const P = this.rt.player?.pos, hook = this.rt.logic.has?.('hook');
    const list = this.setters.filter((s) => !s.ring || hook).map((s) => s.at);
    if (!P || !list.length) return this.glass;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
  dispose() { for (const f of this.offs) f?.(); }
}

/**
 * (issue #410) Where the great lamp is kindled (LOGIC `lG`): its glass and its shutters (the great lamp's, made first), for
 * the scout and the audit (what it looks at is the glass itself, never hidden by it). o: { id, at }
 */
export class LampGlass {
  constructor(rt, o) { this.rt = rt; this.id = o.id; this.o = o; this.center = rt.kit.world(...o.at); this.glass = rt.greatLamp?.glassMesh ?? null; this.shutters = rt.greatLamp?.cage ?? null; }
  update() {}
}

/**
 * A lever of the great lamp, by a hub (LEVERS): a bronze arm on a slate post, a lamp on its knob (stateLamp). Pulled
 * (A / ×) it opens the great lamp's shutters, or shuts them (GreatLamp.toggle); the arm stands up while it is lit, down
 * while it is dark. o: { id, room, at (its foot, local), yaw (the way it faces) }
 */
export class LampLever {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.05;
    this.pos = K.world(x, y, z);
    K.both(M.dark, T(new THREE.CylinderGeometry(0.3, 0.42, H, 8), [x, y + H / 2, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.33, 0.05, 6, 20), [x, y + H, z], [Math.PI / 2, 0, 0]));
    K.add(stateLamp(), T(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), [x, y + H + 0.02, z]));
    this.top = K.world(x, y + H + 0.1, z);
    this.at = this.top;
    this.arm = new THREE.Group();
    this.arm.position.copy(this.top);
    this.arm.rotation.y = K.heading(o.yaw ?? 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6).translate(0, 0.5, 0), makeMaterial({ color: '#a8874a', flat: true, metal: 'brass', refl: 0.3, key: 'temple.perdide2.lever' }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.02, 0), stateLamp());
    this.pivot = new THREE.Group(); this.pivot.add(bar, knob);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.a = 0;
    const lamp = () => rt.greatLamp;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (lamp()?.open ? 'shut the great lamp’s shutters' : 'open the great lamp’s shutters'),
      enabled: () => !!lamp(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { const r = lamp()?.toggle(this.id); this.kick = 1; return r; },
    });
    this.joined = false;
  }
  update(dt) {
    const B = this.rt.greatLamp;
    if (!this.joined && B) { this.joined = true; B.setters.push({ at: this.top, lever: this.id }); }
    const want = (B?.open ? 1 : -1) * 0.75;
    this.a += (want - this.a) * Math.min(1, dt * 6);
    this.kick = Math.max(0, (this.kick ?? 0) - dt * 3);
    this.pivot.rotation.x = this.a + Math.sin(this.kick * 9) * 0.1 * this.kick;
  }
  dispose() { this.off?.(); }
}

/**
 * A lamp-post: the great lamp's state in a room (issue #410, G1: readable everywhere). A slender bronze post by the room's
 * way in, a lamp in a ring on it, warm while the great lamp is lit and cold while it is dark (stateLamp). Drawn in the
 * kit's batches: its colour is the shared material's. o: { room, at (its foot, local) }
 */
export class LampGauge {
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
 * A curtain of the great lamp's light across a doorway (issue #410: the Wick Room's way in): it bars the way, solid, while
 * its door's condition fails (the lamp lit), and fades down into its sill when it holds (dark). A Door, drawn as a sheet of
 * light in a bronze frame. o: as a Door's, and `said`: what it says when you come up to it barred.
 */
export class LightCurtain extends Door {
  constructor(rt, o) {
    super(rt, o);
    const w = this.w, h = this.h;
    this.slab.clear();
    this.sheet = makeMaterial({ color: LAMP_LOOK.lit, glow: 0.8, flat: true, key: `temple.perdide2.curtain.${o.id}` });
    const threads = [box(w - 0.3, h - 0.2, 0.06, 0, (h - 0.2) / 2, 0)];
    for (let i = 1; i < 7; i++) threads.push(box(0.05, h - 0.2, 0.14, -w / 2 + (i / 7) * w, (h - 0.2) / 2, 0));
    const m = new THREE.Mesh(mergeGeometries(threads.map((q) => (q.index ? q.toNonIndexed() : q))), this.sheet);
    this.slab.add(m);
    this.slab.traverse((q) => { q.userData.noCollide = true; q.userData.dynamic = true; });
    // its frame: a bronze sill and lintel the curtain runs between
    rt.kit.add(rt.M.trim, T(new THREE.BoxGeometry(w + 0.4, 0.2, 0.5), [o.at[0], o.at[1] + 0.1, o.at[2]], [0, o.yaw ?? 0, 0]));
    this.apply();
  }
  apply() {
    if (!this.sheet) return;
    const e = 1 - smooth(this.k);
    this.slab.position.y = 0;
    this.slab.scale.y = Math.max(0.001, e);
    this.slab.visible = this.k < 0.999;
  }
  update(dt, t) {
    super.update(dt, t);
    if (this.sheet) this.sheet.uniforms.uGlow.value = 0.62 + 0.12 * Math.sin(t * 5.3) + 0.05 * Math.sin(t * 13.1);
    const P = this.rt.player;
    if (!this.open && P?.pos && this.inDoorway(P, 3.2)) this.rt.notice?.(this.o.said ?? 'A curtain of the great lamp’s light bars the way. In the dark it falls.', `${this.id}.barred`);
  }
}

/**
 * What a shut way says when you come up to it (issue #410: a lamp-door that waits for the great lamp's light, the
 * moss-stones that wait for the dark): within `r` of `at` (local) while `when` (a logic condition) holds, once a visit.
 * o: { at, r, when, said, key }
 */
export class LampWord {
  constructor(rt, o) { this.rt = rt; this.o = o; this.at = rt.kit.world(...o.at); this.near = false; }
  update() {
    const P = this.rt.player, near = !!P?.pos && P.pos.distanceTo(this.at) < (this.o.r ?? 4);
    if (near && !this.near && this.rt.logic.check(this.o.when)) this.rt.notice?.(this.o.said, null);
    this.near = near;
  }
}

/**
 * The great lamp's pipe on the Dark Gallery's far floor (issue #410): a bronze pipe down from the roof over a basin, and
 * high on it the valve's ring (a HookBell, `ring`: the hook's bite tugs it). Tugged, the valve opens for PIPE.hold s
 * (LOGIC `pv`, a held bell) and the great lamp's shutters with it; while the lamp is lit and the valve open its light pours
 * into the basin: a light a bubble may take (src/carried-light.js), for the far door's lamp.
 * o: { id: 'pv', at: the basin's foot (local), r, top (the roof), ring: its height, ringId }
 */
export class PipeLight {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, r = o.r ?? 1.2;
    K.both(M.trim, T(annulus(r, r + 0.5, 0.6, 32), [x, y + 0.6, z]));
    K.add(M.trim, T(new THREE.CylinderGeometry(0.42, 0.42, o.top - (y + 3.4), 12), [x, (o.top + y + 3.4) / 2, z]));
    K.add(M.trim, T(new THREE.CylinderGeometry(0.62, 0.42, 0.6, 12), [x, y + 3.1, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.55, 0.1, 6, 16), [x, o.ring + 0.9, z], [Math.PI / 2, 0, 0]));
    this.water = makeMaterial({ color: LAMP_LOOK.lit, glow: 0.04, flat: true, key: 'temple.perdide2.basin' });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 28), this.water);
    m.position.copy(K.world(x, y + 0.5, z));
    m.userData.noCollide = true; m.userData.dynamic = true;
    rt.root.add(m);
    this.basin = m.position.clone().add(V(0, 0.6, 0));
    this.center = this.basin;   // (the scout's: by the basin, the ring over it in the hook's reach)
    this.offLight = registerLight({ position: () => this.basin, radius: r + 1.4, enabled: () => this.pouring });
    this.shine = new THREE.Vector4(0, -1e5, 0, 0);
    rt.lights.push(this.shine);
    this.mouth = K.world(x, y + 3.0, z);
    this.shaft = undefined;   // (its shaft of light made the first time it pours)
    this.left = 0;
    this.offBell = rt.game?.on?.('bell', ({ by, struck } = {}) => { if (struck && by === o.ringId) this.tug(); });
  }
  get pouring() { return this.left > 0 && this.rt.logic.isLit(this.id) && this.rt.logic.check(LIT); }   // (and the lamp lit: the tug opens its shutters)
  /** The ring tugged: the valve opens a while, and the great lamp's shutters with it. */
  tug() {
    const rt = this.rt, L = rt.logic;
    const B = rt.greatLamp;
    if (B?.kindled && !B.open) B.set(true, this.o.ringId);
    this.left = PIPE.hold;
    L.quiet(this.id); L.light(this.id);
    rt.notice?.(B?.kindled ? 'The valve opens: the great lamp’s light pours into the basin.' : 'The valve opens on a cold pipe: the great lamp is not lit.', B?.kindled ? 'pv.open' : 'pv.cold');
  }
  update(dt, t) {
    if (this.left > 0) {
      this.left -= dt;
      if (this.left <= 0) { this.left = 0; this.rt.logic.quiet(this.id); this.rt.notice?.('The valve shuts. The basin goes dark.', 'pv.shut'); }
    }
    const on = this.pouring;
    this.water.uniforms.uGlow.value += ((on ? 0.85 + 0.08 * Math.sin(t * 6) : 0.04) - this.water.uniforms.uGlow.value) * Math.min(1, dt * 6);
    if (on && this.shaft === undefined) {
      this.shaft = this.rt.veils ? new LightShaft(this.rt.veils, this.rt.root, { color: '#ffd38a', alpha: [0.16], near: 2 }) : null;
      this.shaft?.set(this.mouth, 0.4, this.basin.clone(), 1.0);
    }
    if (this.shaft) this.shaft.visible = on;
    if (on) this.shine.set(this.basin.x, this.basin.y + 1, this.basin.z, 8); else this.shine.set(0, -1e5, 0, 0);
  }
  dispose() { this.offLight?.(); this.offBell?.(); }
}

function mothHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.05, 'push'); g.rt.notice('It reels from the shove and flies higher, frightened.', 'moth.push'); return true; }
  g.rt.notice('The fluid beads on its fur. It does not want water: it wants light.', 'moth.fluid');
  return true;
}

/** The Kennel's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round the middle of the Kennel). */
export const ARENAS = [{
  el: 'arK', room: 'kennel', zone: KENNEL.zone, doors: ['dK'], extra: 2,
  shut: 'The door grinds shut behind you, and something in the dark of the kennel gets up.',
  won: 'The last of them goes still in the dark. The key’s cage sinks, and the door lets go.',
}];

/** A stone post under a lamp that stands in a floor (a LightEar's glass hangs 2.8 m over its foot): from y, solid. */
function lampPost(K, M, x, y, z) {
  K.both(M.trim, box(0.9, 0.3, 0.9, x, y + 0.15, z));
  K.both(M.wall, box(0.5, 1.9, 0.5, x, y + 1.25, z));
  K.both(M.trim, box(0.8, 0.2, 0.8, x, y + 2.3, z));
}

/**
 * The Kennel (east off the Hall of Dark Pools, an arena: where the keepers of the house's lamps were kept, dark; its door
 * shuts behind you while they stand round its middle among four columns, and won, the small key's cage sinks: for the
 * Wick Room's grille) and the Wick Room (v1.60: east off the hall too, north of the Kennel, beside the Root Stair; since
 * v1.77 the wick-house in its middle, a block of stone with two niches in its south face, a pool-orb in a groove before
 * each, and the great key behind a grille between them that lifts once both niches burn at once; a balcony high on its
 * west wall, at the end of the ledge of roots from the root-wall's top).
 */
function wings(rt, K, M, { root, pool }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, Kn = KENNEL, Wk = WICK, KR = ROOMS.kennel, WR = ROOMS.wick, PO = ROOMS.pools;
  // ---- the Kennel
  K.corridor([PO.x1 + 1.2, Kn.z], [KR.x0 - 0.6, Kn.z], 0, { w: D.w, h: D.h });
  K.hall({ x: Kn.x, z: Kn.z, w: Kn.w, d: Kn.d, y: 0, h: KR.top, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h }] });
  // a lamp-door: (issue #477) it opens to the lamp of the pool-orb's socket on the hall's floor, for good (and shuts behind
  // you while they stand)
  add(Door, { id: 'dK', at: [PO.x1 + 0.6, 0, Kn.z], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'lK' }] });
  add(LampWord, { at: [PO.x1 - 2, 0, Kn.z], r: 5, when: { not: { open: 'dK' } }, said: 'The Kennel’s lamp-door is cold. It wakes with the lamp by the orb’s socket, out on the floor.' });
  add(LampGauge, { room: 'kennel', at: [KR.x0 + 3, 0, Kn.z + 7] });
  // the keepers' old stalls along the north and south walls, a bar over each front; four columns round the middle to
  // fight round
  for (const zs of [KR.z0, KR.z1]) {
    const sg = zs === KR.z0 ? 1 : -1;
    for (const x of [29, 35, 41, 47, 53]) K.both(M.wall, box(0.4, 2.6, 3.6, x, 1.3, zs + sg * 1.8));
    for (const x of [32, 38, 44, 50]) K.both(M.trim, box(5.6, 0.3, 0.3, x, 2.45, zs + sg * 3.45));
  }
  for (const [x, z] of [[Kn.x - 6, Kn.z - 6], [Kn.x + 6, Kn.z - 6], [Kn.x - 6, Kn.z + 6], [Kn.x + 6, Kn.z + 6]]) K.column(x, z, 0, KR.top, 0.9);
  add(Key, { id: 'kS', at: [KR.x1 - 2.4, 0, Kn.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'kennel', at: [KR.x0 + 3, 0, Kn.z - 7], yaw: Math.PI / 2, foes: [Kn.x, 0, Kn.z] });

  // ---- the Wick Room (v1.60: east of the Root Stair, off the Hall of Dark Pools; v1.49 off the gallery's far side). Its
  // floor at the hall's, its way in from the hall's east wall; a stair up its north wall to a balcony on its west wall,
  // and from it a keepers' door through to a ledge of roots along the Root Stair's east wall, onto the root-wall's top: it
  // opens with the grille over the great key, the shortcut back up to the chamber
  const x0 = WR.x0, B = Wk.balcony, R = ROOT_WAY, F = Wk.face;
  K.corridor([PO.x1 + 1.2, Wk.door], [x0 - 0.6, Wk.door], 0, { w: D.w, h: D.h });
  // (issue #410) a curtain of the great lamp's light across its way in from the hall, while the lamp is lit
  add(LightCurtain, { id: 'cur', at: [PO.x1 + 0.6, 0, Wk.door], yaw: Math.PI / 2, w: D.w, h: D.h, said: 'A curtain of the great lamp’s light bars the way. In the dark it falls.' });
  K.corridor([ROOMS.roots.x1 + 1.2, R.z], [x0 - 0.6, R.z], R.y, { w: D.w, h: D.h });
  add(Door, { id: 'dU', at: [ROOMS.roots.x1 + 0.6, R.y, R.z], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'lW1' }, { lit: 'lW2' }] });
  K.hall({ x: Wk.x, z: Wk.z, w: Wk.w, d: Wk.d, y: 0, h: Wk.h, roof: 'oculus', oculus: 0.2, doors: [{ side: 'w', at: Wk.door - Wk.z, w: D.w, h: D.h }, { side: 'w', at: R.z - Wk.z, w: D.w, h: D.h, y0: R.y }] });
  // the balcony under the way through from the roots, and the stair up the north wall to it; roots down the wall under it
  K.slab(x0, B[0], x0 + B[2], B[1], R.y, 0.8);
  const [sx0, sx1, sz] = Wk.stair;
  K.stairs([sx0, 0, sz], [sx1, R.y, sz], Wk.stairW);
  for (const [z, r] of [[B[0] + 1.6, 0.45], [B[0] + 6.4, 0.4]]) root([[x0 + 0.5, R.y - 0.9, z], [x0 + 0.9, R.y - 3, z + 0.6], [x0 + 0.4, R.y - 6, z - 0.4], [x0 + 0.8, 0, z + 0.3]], r);
  // the wick-house in the middle of the floor: two blocks of stone either side of the great key's alcove (its back wall,
  // its roof over the grille's 9 m), a niche in each block's south face with its lamp at the back; a pool-orb's groove
  // before each niche, down the middle of the room
  const [n0, n1] = Wk.niches, [g0, g1] = Wk.groove, cx = Wk.x, back = F + 8, HH = 11;
  for (const s of [-1, 1]) K.both(M.wall, box(5.5, HH, 8, cx + s * 6.25, HH / 2, F + 4));
  K.both(M.wall, box(7, 9, 0.8, cx, 4.5, back - 0.4));
  K.both(M.wall, box(7, HH - 9, 8, cx, 9 + (HH - 9) / 2, F + 4));
  K.both(M.trim, box(18.4, 0.5, 8.4, cx, HH + 0.25, F + 4));
  for (const [i, nx] of [n0, n1].entries()) {
    const id = `lW${i + 1}`, orb = `oW${i + 1}`, plate = `pW${i + 1}`;
    K.both(M.wall, [box(0.6, 3.2, 3.5, nx - 1.9, 1.6, F - 1.65), box(0.6, 3.2, 3.5, nx + 1.9, 1.6, F - 1.65), box(4.4, 0.8, 3.6, nx, 3.6, F - 1.7)]);
    add(LightEar, { id, at: [nx, -0.3, F - 0.7], reach: 0 });   // (reach 0: your lantern can't wake it; its orb does, while it glows)
    K.add(M.dark, box(1.0, 0.04, g1 - g0 + 0.6, nx, 0.02, (g0 + g1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, g1 - g0 + 0.6, nx + sd * 0.75, 0.06, (g0 + g1) / 2));
    add(Ball, { id: orb, a: [nx, 0.04, g0], b: [nx, 0.04, g1], r: 0.9, lock: true, lamp: { id, carried: true, lasts: Wk.lasts,
      woke: 'The glowing orb settles in the niche, and its lamp catches: for as long as the orb glows.',
      faded: 'The orb’s glow has gone out, and its niche’s lamp with it.' } });
    add(Plate, { id: plate, at: [nx, 0, g1], r: 1.0 });
  }
  // (issue #377) the wick-house's pool-lamp before it: the light two bubbles carry to the two orbs
  pool('sW', Wk.x, 0, Wk.pool, 1.3);
  // the great key in its alcove, behind the grille between the niches (a keyhole too: logic `lock`)
  add(Door, { id: 'cW', at: [cx, 0, F], w: D.w, h: D.h, lamps: [{ lit: 'lW1' }, { lit: 'lW2' }] });
  add(Key, { id: 'kB', big: true, at: [cx, 0, Wk.keyZ], yaw: Math.PI });
  // roots down the walls, and the old wick-stands along the south wall
  root([[WR.x1 - 0.5, Wk.h, Wk.z + 9], [WR.x1 - 0.9, 13, Wk.z + 10.5], [WR.x1 - 0.4, 6, Wk.z + 9.4], [WR.x1 - 0.8, 0, Wk.z + 10.2]], 0.55);
  for (const x of [x0 + 8, x0 + 15, x0 + 22]) { K.both(M.trim, box(0.5, 2.6, 0.5, x, 1.3, WR.z0 + 1.2)); K.both(M.wall, box(1.1, 0.25, 1.1, x, 2.725, WR.z0 + 1.2)); }
  add(Mark, { room: 'wick', at: [x0 + 3.5, 0, Wk.door + 4], yaw: Math.PI / 2 });
  add(LampGauge, { room: 'wick', at: [x0 + 3.5, 0, Wk.door - 4] });
}

// ------------------------------------------------------------------ inside
// (since v1.77, issue #336, docs/design/temple-redesign.md: every hall 30 to 36 m across under 17 m of stone or more, the
// chamber's round hall 34 m, doors 7 by 9; each puzzle in the middle of its room, the one fight in the Kennel)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const root = (pts, r) => K.both(M.stone, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), 16, r, 7, false));
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, ...o }); };

  // ---- the Threshold
  const TH = R0.threshold;
  hall(TH, { roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.both(M.voidM, box(3.6, 5, 1.25, 0, 2.5, -0.625));   // (drawn and solid as one: from the doorway's face back to the wall's inner face)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });

  // ---- the Lamp Hall (the Hall of Dark Pools until v1.83; issue #410, G4: the house's great hall, 36 by 64 m under 34, the
  // hub of both floors): three pool-lamps, dark; splash each. Two on the floor, the third up on the loft of roots, a block
  // out from the west wall, its pool far enough back from the edge that the floor never sees it. Its gallery along the
  // west wall further north, 9 m up and open over the floor; the great lamp in the middle, cold
  const PO = R0.pools, [, pz] = mid(PO), GY = GALLERY, GL = GREAT_LAMP;
  hall(PO, { roof: 'oculus', oculus: 0.16, omit: ['n'], doors: [{ side: 's', w: D.w, h: D.h }, { side: 'e', at: KENNEL.z - pz, w: D.w, h: D.h }, { side: 'e', at: WICK.door - pz, w: D.w, h: D.h }] });   // (and east into the Kennel, v1.49, and the Wick Room, v1.60)
  for (const [x, z] of [[15, 44], [15, 62], [-13, 20], [-13, 46]]) K.column(x, z, 0, PO.top, 0.9);
  const poolM = makeMaterial({ color: '#2f3560', glow: 0.1, flat: true, key: 'temple.p2.pools' });
  const pool = (id, x, y, z, r = 2.0) => {
    K.both(M.trim, T(annulus(r, r + 0.6, 0.5, 32), [x, y + 0.5, z]));
    K.both(poolM, T(new THREE.CylinderGeometry(r, r, 0.1, 28), [x, y + 0.3, z]));
    add(Switch, { id, at: [x, y + 0.9, z], yaw: 0, size: 0.9, light: POOL_LIGHT });   // (lit, a light a bubble takes: issue #377)
  };
  pool('s1', 7, 0, 30); pool('s2', -1, 0, 45);
  // (issue #477) the Kennel's pool-orb: at rest by the near pool (s1), its groove north up the floor to its socket and the
  // socket's lamp on a post, whose light opens the Kennel's lamp-door (in sight of it, across the floor)
  {
    const [ox, z0, z1] = KENNEL_ORB;
    K.add(M.dark, box(1.0, 0.04, z1 - z0 + 0.6, ox, 0.02, (z0 + z1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, z1 - z0 + 0.6, ox + sd * 0.75, 0.06, (z0 + z1) / 2));
    add(Ball, { id: 'oK', a: [ox, 0.04, z0], b: [ox, 0.04, z1], r: 0.9, lock: true,
      lamp: { id: 'lK', reach: 0, pool: { id: 's1', at: [7, 0.9, 30], reach: 4.6 }, hold: 2, lasts: 25,
        caught: 'The orb drinks the pool’s light and glows, for a while.',
        dark: 'The orb settles in the socket, dark, and the socket tips it back out. Its lamp wants light.',
        woke: 'The glowing orb settles in the socket, and its lamp catches. Across the floor, the Kennel’s lamp-door wakes.' } });
    add(Plate, { id: 'pK', at: [ox, 0, z1], r: 1.0 });
    lampPost(K, M, ox, 0, z1 + 1.6);
    add(LightEar, { id: 'lK', at: [ox, 0, z1 + 1.6], reach: 0 });   // (only the glowing orb wakes it)
  }
  const LO = { x0: PO.x0 - 0.1, ...LOFT }, [lox, loz] = mid(LO);
  K.climbable('the loft of roots: climbed from the Lamp Hall\'s floor to the third pool', () => {
    K.both(M.wallGlyph, box(LO.x1 - LO.x0, LO.top, LO.z1 - LO.z0, lox, LO.top / 2, loz));
    K.both(M.trim, box(LO.x1 - LO.x0 + 0.2, 0.3, LO.z1 - LO.z0 + 0.2, lox, LO.top + 0.05, loz));
    root([[LO.x1 + 0.1, 8, loz - 4.5], [LO.x1 + 0.4, 5, loz - 5.4], [LO.x1, 2, loz - 4.4], [LO.x1 + 0.3, 0, loz - 5.2]], 0.4);
    root([[LO.x1 + 0.1, 8, loz + 4.2], [LO.x1 + 0.5, 4, loz + 5.4], [LO.x1 + 0.1, 0, loz + 4.6]], 0.35);
  });
  pool('s3', -10.5, 8.2, loz, 1.5);
  add(Door, { id: 'd1', at: [0, 0, PO.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] });
  add(Mark, { room: 'pools', at: [11.5, 0, 18.5], yaw: -Math.PI / 2 });
  root([[PO.x0 + 0.4, PO.top - 0.5, 17], [PO.x0 + 1.4, 22, 18.5], [PO.x0 + 0.8, 12, 21]], 0.8);
  root([[PO.x1 - 0.4, PO.top - 1, 42], [PO.x1 - 1.9, 20, 38], [PO.x1 - 0.8, 8, 34], [PO.x1 - 0.6, 0, 33]], 0.7);
  // the gallery: a slab along the west wall at 9, on columns, its edge open over the floor (a parapet but where it drops:
  // G6, the way back down to the hub); the great lamp's balcony out from it, a pool-lamp on its end
  const PR = GY.pier, [d0, d1] = GY.drop, GZ1 = PO.z1, UP9 = GY.y;
  K.slab(GY.x0, GY.z0, GY.x1, GZ1, UP9, GY.t);
  K.slab(GY.x1, PR.z0, PR.x1, PR.z1, UP9, GY.t);
  for (const [x, z] of [[GY.x1 - 0.9, GY.z0 + 1.2], [GY.x1 - 0.9, 72], [PR.x1 - 0.8, PR.z0 + 0.9], [PR.x1 - 0.8, PR.z1 - 0.9]]) K.column(x, z, 0, UP9 - GY.t, 0.6);
  const rail = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az); if (L > 0.05) K.both(M.trim, box(0.4, GY.parapet, L, (ax + bx) / 2, UP9 + GY.parapet / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az))); };
  rail(GY.x0 + 0.1, GY.z0 + 0.2, GY.x1 + 0.2, GY.z0 + 0.2);
  rail(GY.x1 + 0.2, GY.z0 + 0.2, GY.x1 + 0.2, PR.z0);
  // (the balcony's end open: its pool-lamp seen from the floor, the great lamp before it; a lip there, a drop too)
  rail(GY.x1, PR.z0 + 0.2, PR.x1 - 0.2, PR.z0 + 0.2); rail(PR.x1 - 0.2, PR.z1 - 0.2, GY.x1, PR.z1 - 0.2);
  K.add(M.trim, box(0.5, 0.12, PR.z1 - PR.z0, PR.x1 - 0.25, UP9 + 0.06, (PR.z0 + PR.z1) / 2));
  rail(GY.x1 + 0.2, PR.z1, GY.x1 + 0.2, d0); rail(GY.x1 + 0.2, d1, GY.x1 + 0.2, GZ1 - 0.2);
  K.add(M.trim, box(0.5, 0.12, d1 - d0, GY.x1 + 0.25, UP9 + 0.06, (d0 + d1) / 2));   // (a lip where it drops)
  pool('s8', GY.pool[0], UP9, GY.pool[1], 1.2);
  add(Mark, { room: 'hallUp', at: [GY.x0 + 2.5, UP9, GZ1 - 4], yaw: Math.PI / 2 });
  // the great lamp hangs from the roof in the middle of the hall, its glass level with the balcony's end: a bubble of the
  // pool-lamp's light sent out to it kindles it, behind its shutters (the state: GreatLamp)
  add(GreatLamp, { id: 'lamp', at: GL.at, r: GL.r, cage: GL.cage, top: PO.top + 0.4 });
  add(LampGlass, { id: 'lG', at: GL.at });
  // the levers by the hubs: the hall's floor (between the Kennel's way and the Wick Room's), the gallery's, the chamber's
  // (placed with it); a lamp-post on the floor by the way in, and on the gallery
  for (const lv of LEVERS) if (lv.room !== 'lantern') add(LampLever, { ...lv, id: `lever.${lv.room}`, sets: 'lamp' });
  add(LampGauge, { room: 'pools', at: [-6, 0, 18.5] });
  add(LampGauge, { room: 'hallUp', at: [GY.x0 + 1.2, UP9, GY.z0 + 2] });

  // ---- the Root Stair (a hall over a dark pool across its middle): the small pool and its pool-orb on the near floor,
  // the orb's groove to the socket whose lamp wakes the moss-stones sunk in the pool; then a root-wall to climb, its top
  // the landing at 9 under the chamber's door. (issue #410) From the root-wall's top a ledge runs back south along the west
  // wall, at 9, to a lamp-door through the south wall into the Lamp Hall's gallery
  const RS = R0.roots, P0 = RS.z0 + RS.near, P1 = P0 + RS.pit, [, rz] = mid(RS), dy = RS.floor - RS.y, LG = LEDGE;
  hall(RS, { floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 's', w: D.w, h: D.h, y0: dy }, { side: 's', at: LG.door.x, w: LG.door.w, h: D.h, y0: LG.y - RS.y }, { side: 'n', w: D.w, h: D.h, y0: RS.wall - RS.y }, { side: 'e', at: ROOT_WAY.z - rz, w: D.w, h: D.h, y0: RS.wall - RS.y }] });   // (and east at 9 to the Wick Room's balcony, v1.60)
  K.slab(RS.x0, RS.z0, RS.x1, P0, RS.floor, dy);            // the near floor (its top at 0)
  K.both(M.dark, box(RS.x1 - RS.x0, 1, RS.pit, 0, RS.y - 0.5, (P0 + P1) / 2));
  const pool2 = makeMaterial({ color: '#2a2f58', glow: 0.18, flat: true, key: 'temple.p2.deep' });
  K.add(pool2, box(RS.x1 - RS.x0, 0.2, RS.pit, 0, -2.4, (P0 + P1) / 2));
  add(Pit, { room: 'roots', min: [RS.x0 - 1, RS.y - 2, P0], max: [RS.x1 + 1, -1.5, P1] });
  add(Bridge, { id: 'disc', a: [0, 0, P0 - 0.05], b: [0, 0, P1 + 0.05], w: 3.0, n: 6, glow: { color: '#8fd6a8', k: 0.5 } });   // moss-stones, sunk in the pool
  // the small pool beside the groove's start, the orb at rest by it, the socket and its lamp at the groove's end
  const OZ = RS.z0 + 11.6;
  pool('s5', -4.5, 0, OZ + 2.8, 1.3);
  K.add(M.dark, box(12.6, 0.04, 1.0, 0, 0.02, OZ));
  for (const sd of [-1, 1]) K.both(M.trim, box(12.6, 0.12, 0.25, 0, 0.06, OZ + sd * 0.75));
  add(Ball, { id: 'orb5', a: [-6, 0.04, OZ], b: [6, 0.04, OZ], r: 0.9, lock: true,
    lamp: { id: 'l5', reach: 0, pool: { id: 's5', at: [-4.5, 0.9, OZ + 2.8], reach: 4.6 }, hold: 2, lasts: 25,
      caught: 'The orb drinks the pool’s light and glows, for a while.',
      dark: 'The orb settles in the socket, dark, and the socket tips it back out. The disc’s lamp wants light.',
      woke: 'The glowing orb settles in the socket, and the disc’s lamp catches. The disc wakes.' } });
  add(Plate, { id: 'p5', at: [6, 0, OZ], r: 1.0 });
  lampPost(K, M, 7.6, 0, OZ);
  add(LightEar, { id: 'l5', at: [7.6, 0, OZ], reach: 0 });   // (the disc's lamp: only the glowing orb wakes it)
  // the root-wall across the far side, its top at 9: climb it (with the roots down its face: the house's climbs, its other
  // walls are not climbed, issue #115)
  K.climbable('the Root Stair\'s root-wall: climbed from the moss-stones to the landing at 9', () => {
    K.both(M.wallGlyph, box(RS.x1 - RS.x0, RS.wall - RS.y, RS.z1 - P1, 0, (RS.wall + RS.y) / 2, (P1 + RS.z1) / 2));
    root([[-6, 9, P1 - 0.2], [-5, 5, P1 - 0.3], [-6.2, 1, P1 - 0.25], [-6, -3, P1 - 0.3]], 0.45);
    root([[5, 9, P1 - 0.2], [6, 4, P1 - 0.3], [4.8, 0, P1 - 0.25], [5.4, -3, P1 - 0.3]], 0.45);
  });
  add(Mark, { room: 'roots', at: [-12, 0, RS.z0 + 4], yaw: Math.PI / 2 });
  add(LampGauge, { room: 'roots', at: [10, 0, RS.z0 + 3] });
  // (v1.60) a ledge of roots along the east wall at the root-wall's height, to the keepers' door through it into the Wick Room
  { const [lx0, lz0, lx1, lz1] = ROOT_WAY.ledge;
    K.slab(lx0, lz0, lx1, lz1, ROOT_WAY.y, 0.6);
    root([[lx0 + 0.4, ROOT_WAY.y - 0.9, lz0 + 1.2], [lx0 + 1.1, ROOT_WAY.y - 3, lz0 + 0.6], [lx0 + 1.8, ROOT_WAY.y - 6.5, lz0 + 1.0]], 0.32); }
  // (issue #410) the ledge back to the Lamp Hall along the west wall, from the root-wall's top over the pool and the near
  // floor, and its lamp-door through the walls into the gallery: its lamp the one by the chamber's dais
  K.slab(LG.x0, RS.z0, LG.x1, P1, LG.y, 0.6);
  K.both(M.trim, box(0.3, 0.9, P1 - RS.z0, LG.x1 - 0.15, LG.y + 0.45, (RS.z0 + P1) / 2));   // (a low kerb along its edge)
  root([[LG.x1 - 0.3, LG.y - 0.8, RS.z0 + 8], [LG.x1 - 0.9, LG.y - 3.5, RS.z0 + 9.5], [LG.x1 - 0.5, LG.y - 6, RS.z0 + 8.6]], 0.32);
  K.slab(LG.door.x - LG.door.w / 2, PO.z1, LG.door.x + LG.door.w / 2, RS.z0, LG.y, 0.6);   // (the floor through the doorway)
  add(Door, { id: 'dC', at: [LG.door.x, LG.y, PO.z1 + 0.6], w: LG.door.w, h: D.h, lamps: [{ lit: 'l0' }] });
  root([[RS.x1 - 0.5, RS.top - 1, RS.z0 + 8], [RS.x1 - 1.4, 14, RS.z0 + 10], [RS.x1 - 0.7, 4, RS.z0 + 9], [RS.x1 - 1, 0, RS.z0 + 11]], 0.7);

  // ---- the corridor and the Lantern Chamber (floor 9, a dark round hall 34 m across): the chest in the middle; the lamp by
  // the dais (issue #410: the ledge door's), the fount beside it, and the Lamp Passage north, its door a lamp-door that
  // opens to the great lamp's light, the lever by it
  const LA = R0.lantern, C3 = LA.z;
  K.corridor([0, RS.z1 + 1.2], [0, C3 - LA.r - 0.4], 9, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C3, y: LA.y, r: LA.r, h: LA.top - LA.y, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0 });
  K.both(M.trim, ...chestMound(0, 9, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // (issue #377) the fount of lamp-water by the dais, that never goes dark: a bubble blown over it takes its light, and a
  // glowing bubble that bursts on a dark lamp's glass lights it (the lantern charm stood by them, before)
  add(LightFount, { at: FOUNT });
  lampPost(K, M, -5.4, 9, C3 + 3.4);
  add(LightEar, { id: 'l0', at: [-5.4, 9, C3 + 3.4], carried: true, heard: 'The bubble bursts on the lamp’s glass and it catches. Back down the ledge along the Root Stair, a door sinks.' });
  for (const lv of LEVERS) if (lv.room === 'lantern') add(LampLever, { ...lv, id: `lever.${lv.room}`, sets: 'lamp' });
  root([[-LA.r + 0.6, LA.top - 0.5, C3 - 6], [-LA.r + 1, 18, C3 - 4], [-LA.r + 0.5, 9, C3 - 5]], 0.45);
  root([[LA.r - 0.6, LA.top - 0.5, C3 + 3], [LA.r - 1, 17, C3 + 4.5], [LA.r - 0.5, 9, C3 + 3.6]], 0.4);
  add(Mark, { room: 'lantern', at: [8, 9, C3 - 6], yaw: -Math.PI * 0.75 });
  add(LampGauge, { room: 'lantern', at: [-9, 9, C3 - 9] });
  K.corridor([0, C3 + LA.r + 0.4], [0, R0.gallery.z0 - 0.6], 9, { w: D.w, h: D.h });   // (the Lamp Passage)

  // ---- the Dark Gallery: a chasm across its middle, wider than the hook reaches, crossed by moss-stones that rise in the
  // dark and take root (issue #410); on the far floor the far door's lamp on a post, and the great lamp's pipe over a basin
  // beside it, its valve's ring high on the pipe: tugged, the valve opens a while (and the great lamp's shutters with it)
  // and the great lamp's light pours into the basin, a light a bubble takes to the far door's lamp
  const GA = R0.gallery, Q0 = GA.z0 + GA.near, Q1 = Q0 + GA.pit, [, gz] = mid(GA), gy = GA.floor - GA.y;
  add(Door, { id: 'd2', at: [0, 9, GA.z0 - 0.6], w: D.w, h: D.h, lamps: [LIT] });
  add(LampWord, { at: [0, 9, GA.z0 - 5], r: 5, when: { not: { open: 'd2' } }, said: 'A cold lamp-door. It opens to the great lamp’s light.' });
  hall(GA, { floor: false, roof: 'oculus', oculus: 0.2, doors: [{ side: 's', w: D.w, h: D.h, y0: gy }, { side: 'n', w: D.w, h: D.h, y0: gy }] });
  K.slab(GA.x0, GA.z0, GA.x1, Q0, GA.floor, gy);
  K.slab(GA.x0, Q1, GA.x1, GA.z1, GA.floor, gy);
  K.both(M.dark, box(GA.x1 - GA.x0, 1, GA.pit, 0, GA.y - 0.5, (Q0 + Q1) / 2));
  add(Pit, { room: 'gallery', min: [GA.x0 - 1, GA.y - 3, Q0], max: [GA.x1 + 1, 4, Q1] });
  add(Bridge, { id: 'br1', a: [0, 9, Q0 - 0.1], b: [0, 9, Q1 + 0.1], w: 3.4, n: 11, glow: { color: '#8fd6a8', k: 0.5 } });
  add(LampWord, { at: [0, 9, Q0 - 2], r: 4, when: { not: { open: 'br1' } }, said: 'The moss-stones lie sunk in the lamp’s light. In the dark they rise.' });
  add(Mark, { room: 'gallery', at: [-7, 9, GA.z0 + 4], yaw: 0 });
  add(LampGauge, { room: 'gallery', at: [7.5, 9, GA.z0 + 3] });
  // the far floor
  const FL = FAR, lx = FL.lamp[0], lz = Q1 + FL.lamp[1], bx = FL.basin[0], bz = Q1 + FL.basin[1];
  lampPost(K, M, lx, 9, lz);
  add(LightEar, { id: 'l2', at: [lx, 9, lz], carried: true, heard: 'The bubble bursts on the far door’s lamp, and it catches.' });
  add(PipeLight, { id: 'pv', at: [bx, 9, bz], r: 1.2, top: GA.top + 0.4, ring: 9 + FL.ring, ringId: 'hb.pipe' });
  add(HookBell, { id: 'hb.pipe', at: [bx, 9 + FL.ring, bz + 0.62], chain: 0.5, yaw: Math.PI, size: 0.6, sets: 'lamp', room: 'galleryFar', from: [bx + 4, 9, bz - 3] });
  rt.greatLamp.setters.push({ at: K.world(bx, 9 + FL.ring, bz + 0.62), ring: 'hb.pipe' });
  add(Door, { id: 'd4', at: [0, 9, GA.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'l2' }] });
  add(Mark, { room: 'galleryFar', at: [7, 9, Q1 + 3], yaw: Math.PI });
  add(LampGauge, { room: 'galleryFar', at: [-9, 9, Q1 + 2.5] });

  // ---- the antechamber, and the Lamp-Room (floor 9): a round hall, the tower's own lamp dark in its cradle overhead (the
  // one the Lampless drank: lit again at the end, change())
  const H0 = GA.z1 + 0.6;
  const AE = K.vestibule(H0, 9);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 9, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  add(LampGauge, { room: 'ante', at: [-(ANTE.half - 1), 9, (H0 + AE) / 2] });
  const HR = 19, CL = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CL, y: 9, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0 });
  // the lamp's cradle: a ring of brass on chains, a great glass lamp in it, dark until the end
  K.add(M.trim, T(annulus(4.2, 5, 0.4, 40), [0, 9 + 20, CL]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; K.add(M.dark, box(0.12, 6, 0.12, Math.sin(a) * 4.6, 9 + 23, CL + Math.cos(a) * 4.6)); }
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'temple.p2.lamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), lampM);
  lamp.position.copy(K.world(0, 9 + 18.2, CL));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  rt.lampRoom = { lamp, lampM, light: null };
  // the way out, past the far door
  const X0 = CL + HR + 0.7, X1 = CL + HR + 10;
  add(Door, { id: 'd5', at: [0, 9, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, 9, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, 9, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, 9, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, 9, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, 19.4, (X0 + X1) / 2));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, 11.5, X1 + 0.35));

  // three dark pools round the room: lit earlier, each lures the Lampless down to drink (LurePools; its id the guardian's:
  // the redesign's rules measure the Lamp-Room by them, scripts/temple-design/rules.mjs, the room has no mark)
  add(LurePools, { id: 'moth', y: 9, at: [[-10.5, CL - 6], [10.5, CL - 6], [0, CL + 12]] });

  const model = mothModel();
  model.pos.copy(K.world(0, 9, CL + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 9, CL + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CL), r: HR, y: K.world(0, 9, 0).y };

  // (the wings last: their marks after the others)
  wings(rt, K, M, { root, pool });
  const W = (x, y, z) => K.world(x, y, z), KR = R0.kennel, WR = R0.wick;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(R0.pools.x0 - 6, -10, -3), V(WR.x1 + 6, 40, X1 + 2)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, X1 - 0.4), r: 1.5 }],
    // dim: the house is dark (the pools and the lantern light it)
    // (lower and wider since the visual pass: each a warm pool on the flags, lampTint, as the picked hall's lamps lay them)
    lights: [[0, 3.5, 7, 12], [4, 4, 28, 16], [-2, 4, 46, 16], [3, 4, 66, 16], [-14, 12.5, 70, 10], [0, 4, RS.z0 + 9, 16], [0, 12, RS.z1 - 6, 14], [0, 12, C3, 16], [0, 12, GA.z0 + 9, 15], [0, 12, GA.z1 - 9, 15],
      [KENNEL.x, 4, KENNEL.z, 18], [WICK.x, 4, WICK.groove[0], 16], [WICK.x, 4, WICK.keyZ, 10], [WR.x0 + 4, 12, WICK.balcony[0] + 6, 10], [0, 12.5, CL, 17]],
    guardian: { def: { ...LAMPLESS, onHit: mothHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Lamp-House in the shallows
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -2.5, R = 9;
  const K = new TempleKit(rt.root, 'The Lamp-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, door = 3.4;   // (the door's sill, above the water on a stone apron)
  landmark(K, 'perdide2', { y: door, R });
  const crown = door + LAMP_CROWN_LIFT;
  const glassM = glazing('#ffd18b', K.world(0, crown + 46, 0));
  K.both(glassM, lathe([[6.15,crown+39],[6.15,crown+49.8],[5.7,crown+51.5],[4.6,crown+53.3]],64));
  const brass = metal('#b18346');
  K.both(brass, lathe([[.01,crown+39],[4.6,crown+39],[3.3,crown+40],[2,crown+41]],40));
  K.both(brass, lathe([[3.5,crown+51],[4.6,crown+52],[.01,crown+52]],40));
  // the doorway on the apron, toward the causeway
  // (the drawing's small round door at the tower's foot, framed twice in its slate down to the water, warm light:
  // src/temples/portal.js)
  const P = portal(K, { y: door, z: R + 1.3, w: 4.3, h: 7.4, shape: 'round', layers: 2, step: 0.9, recess: 0.7, back: 1.2, into: 3.6, foot: door + 1,
    frame: lmStone('#465a78', { course: 2.4, width: 4.8, wear: .55 }), inlay: '#ffc979', sill: { w: 5.6 } });
  K.both(M.stone, box(5.8,door+1,11,0,(door-1)/2,R+4));
  // the causeway: flat stones from the apron to the end of the lit path
  const pathL = K.local(V(SITE.path[0], 0, SITE.path[1]));
  const n = Math.ceil(Math.hypot(pathL.x, pathL.z - R - 7) / 3.8);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, z = R + 7 + (pathL.z - (R + 7)) * k, x = pathL.x * k;
    const top = THREE.MathUtils.lerp(door, 0.6 - base, k);
    K.both(M.stone, T(new THREE.CylinderGeometry(2.2, 2.4, top + 1.2, 10), [x, (top - 1.2) / 2, z]));
  }
  K.flush();
  const glassWashes = glaze(K, rt.veils, glassM, { color: '#ffae52', alpha: .26, glow: .45 });
  // A small pilot burns within a glass chimney. Restoring the house feeds the
  // full lamp and its sweeping beam, rather than turning a solid ball yellow.
  const lampM = makeMaterial({ color: '#ffb34f', glow: .72, hatch: 0, key: 'temple.p2.outlamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1,32,24).scale(3.3,5.2,3.3), lampM);
  lamp.position.copy(K.world(0, crown + 45.6, 0));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  const at = K.world(0, door, R + 2.2);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base, doorY: base + door, R, lamp, lampM, glassM, glassWashes, top: base + door + 56 + LAMP_CROWN_LIFT, clear: [{ x: SITE.x, z: SITE.z, r: 44 }] };
}

// ------------------------------------------------------------------ the world change: the lamp burns again
/**
 * Once the Lampless is calm the Lamp-House's lamp burns again: gold in its
 * glass room, a light on the water round the tower, and a long beam turning
 * slowly over the wood. Inside, the lamp-room's great lamp glows.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  // the beam: a soft shaft of light from the lamp out over the wood, washes over the finished picture (src/veil.js
  // LightShaft, the skull cave's way: issue #116; it was a solid glowing cone, inked)
  const beam = O ? new LightShaft(rt.veils, rt.root, { color: '#ffe2b0', alpha: [0.14, 0.17], near: 4 }) : null;
  if (beam) beam.visible = false;
  const tip = new THREE.Vector3(), pilotColor = new THREE.Color('#ffb34f'), fullColor = new THREE.Color('#fff1bb');
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  rt.lights.push(light);
  let k = 0, want = 0;
  return {
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 4);
      const on = k > 0.02;
      if (O) {
        O.lampM.uniforms.uGlow.value = .72 + .28 * k * (.96 + .04 * Math.sin(t * 3));
        O.lampM.uniforms.uColor.value.copy(pilotColor).lerp(fullColor, k);
        for (const wash of O.glassWashes) wash.material.uniforms.uWash.value.y = .45 + .5 * k;
        beam.visible = on;
        // (turning slowly, a little over the level: 140 m out, 9 m across at its end)
        const a = t * 0.25;
        tip.set(-Math.cos(0.08) * Math.cos(a), Math.sin(0.08), Math.cos(0.08) * Math.sin(a)).multiplyScalar(140).add(O.lamp.position);
        if (on) beam.set(O.lamp.position, 0.4, tip, 9).fade(k);
        light.set(O.lamp.position.x, O.lamp.position.y, O.lamp.position.z, 18 + 82 * k);
      }
      const L = rt.lampRoom;
      if (L) {
        L.lampM.uniforms.uGlow.value = 0.04 + 0.96 * k;
        if (on && !L.light) { L.light = new THREE.Vector4(L.lamp.position.x, L.lamp.position.y, L.lamp.position.z, 40); rt.lights.push(L.light); }
      }
    },
  };
}

export const PERDIDE2_TEMPLE = {
  id: 'perdide2', levelId: 'perdide2', name: 'The Lamp-House', doorLabel: 'door of the Lamp-House',
  gadget: 'bubble', gadgetBox: 'perdide2.temple.lantern', arenaDoor: 'd4', arenas: ARENAS, dark: true,   // (the box's id from when it held the lantern: the saves' flag)
  origin: [-140 + OX, 1800, -300 + OZ], yaw: 0,   // (its rooms over the wood, where they always were from it: names.js PART_OFFSET)
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its futuristic skin, issue #342: the look of the author's pick over the same rooms, src/temples/skins/lamp-house.js)
  skin: (rt) => lampHouseSkin(rt, { rooms: ROOMS }),
  local: { person: 'briony', out: 33, side: 2 },
  enterLine: 'Inside the Lamp-House it is very dark, and it smells of moss and old oil. Somewhere above, wings.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out over the wood, the Lamp-House’s lamp catches and its beam turns.', 'resolved.out'); },
  // the Lampless drinks light: a bubble's carried to it while it hangs low, searching (below); or a pool lit earlier lures
  // it down to drink there (its last phase: a bubble from afar, or a pool while you stand back)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    let still = 0, drink = 0, lured = null, luredFor = 0;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      const P = rt.player;
      if (!P || G.state !== 'open') { still = 0; drink = 0; lured = null; luredFor = 0; return; }
      const last = G.phaseIndex >= 2, m = G.model;
      // a lit pool lures it as it searches: it drifts down to the nearest and drinks (in its last phase, if you stand back)
      const pools = rt.lurePools?.lit ?? [];
      if (!lured && pools.length) lured = pools.slice().sort((a, b) => a.at.distanceToSquared(m.pos) - b.at.distanceToSquared(m.pos))[0];
      if (lured && !lured.lit) lured = null;
      if (lured) {
        luredFor += dt;
        if (luredFor < 7) G.openFor = Math.max(G.openFor ?? 0, G.t + 0.6);   // (it searches on while it drifts there)
        const over = Math.hypot(m.pos.x - lured.at.x, m.pos.z - lured.at.z) < LURE.reach;
        if (!over) {
          // (straight there: in the open it would turn back to you)
          const dx = lured.at.x - m.pos.x, dz = lured.at.z - m.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, LURE.speed * dt);
          m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step;
          m.heading = Math.atan2(dx, dz);
          G.keepIn();
        }
        rt.notice('It turns from you to the lit pool, and drifts down to it.', 'moth.lured');
        const close = Math.hypot(P.pos.x - lured.at.x, P.pos.z - lured.at.z) < LURE.back;
        if (over && close && last) { drink = 0; rt.notice('It hangs over the pool, but won’t drink while you stand by it.', 'moth.back'); return; }
        if (over && (drink += dt) > LURE.drink) {
          drink = 0;
          rt.lurePools.drain(lured); lured = null;
          G.add(0.15, 'pool');
          rt.sound?.chime?.();
          rt.notice('It drinks the pool dark, and its glyphs glow with the light.', 'moth.drank');
          if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
        }
        return;
      }
      const near = Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z) < 8;
      if (last && near) rt.notice('It shies from you: it takes light only from afar, or a pool.', 'moth.shy');
    };
    // (issue #377) a bubble that took a lamp's light, sent to it as it hangs low searching, bursts on it, and it drinks the
    // light (the lantern charm stood by it, before): src/carried-light.js. In its last phase it shies from you: from afar.
    const body = (out) => out.copy(G.model.pos).add(V(0, 2, 0));
    const at = V();
    rt.offs.push(registerDrinker({ position: () => body(at), radius: 2.6, enabled: () => G.state === 'open' }));
    rt.offs.push(rt.game.on('bubble:light', ({ pos } = {}) => {
      if (!pos || G.state !== 'open' || pos.distanceTo(body(at)) > 4.2) return;
      const P = rt.player;
      if (G.phaseIndex >= 2 && P && Math.hypot(P.pos.x - G.model.pos.x, P.pos.z - G.model.pos.z) < LURE.back) { rt.notice('The light reaches it, but it won’t drink while you stand so near.', 'moth.near'); return; }
      G.add(0.15, 'light');
      rt.sound?.chime?.();
      rt.notice('The bubble bursts on its fur, and it drinks the light, glowing.', 'moth.bubble');
      if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
    }));
  },
};
