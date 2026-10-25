import { landmark, landmarkFrame } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import { glazing, glaze } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus, Z_GAP as Z } from './kit.js';
import { Door, Plate, Ball, Switch, Bridge, LensStones, Mark, Pit, Key, Iris, Platform, Coffer, printGeometry, lensUp, revealed } from './pieces.js';
import { echoModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { footprintSkin } from './skins/footprint.js';

// The Garden of Spheres' temple: the Footprint, the one Emrys speaks of. North
// of the umbrella grove the meadow carries an enormous three-toed print, its
// rim of white stone, as if something that walked through the sky putting the
// spheres down had stepped here; in its heel stands a great pale sphere with a
// door. Nobody goes in: the garden says the heel is where the walker waits.
//
// One idea (docs/audits/temple-design-v1.24.md): the lens shows where the walker set things down. What is real
// carries the walker's print, three toes like the Footprint itself; the look-alikes carry two or four, or nothing the
// lens can see. Taught at the chest (its mural, the prints on the floor), then asked of stones, plates and spheres.
//
// Inside (built far overhead, through its door). Since v1.82 (issue #401, docs/design/temple-best-practices.md part 4) the
// house goes DOWN: four floors 18 m apart round the Heel Well, a round shaft 40 m across with a balcony on every floor.
// From the rim you see the Echo's great door at the very bottom on the way in. Its rooms are shrines (issue #336): every
// hall 30 m across or more under 16 m and more, doors 7 by 9, each puzzle in the middle of its room.
//   F0 (0 m)    the Threshold, the RIM round the well. West, the Hall of Spheres: the sphere set down on the walker's
//               print and you on the walker's print beside it open the first drop, an iris in the rim's floor over a
//               pool on F1. East, the Keepers' Lodge (the house's one fight), its door wanting an eye only the lens
//               shows, under the rim's pier, and the great sphere up. In the middle the GREAT LIFT: a disc and its great
//               sphere riding between the rim and F2; stood on, it carries you; its plate on either pier calls it
//   F1 (-18 m)  the balcony, its east arc cut off by two gaps whose bridges stand while the great sphere is up. North,
//               the Still Pool (the floating sphere pushed over the stilled water: its berth raises the stones to the
//               far ledge, and on it the small key of the Lens Chamber, below and west, and a coffer). East, the Sounding Toe: a sphere in a groove
//               whose end is a hatch over a hole in the floor; from the walker's print, among two plain ones, the hatch
//               opens, and pushed from there the sphere drops through onto the plate below and opens the Hall of the
//               Unseen's door (the author's ruling: a hole is not a door, #336)
//   F2 (-36 m)  the balcony. West, the Lens Chamber: the makers' chest, the SEEING LENS (src/gadgets/lens.js), its
//               mural. Raised over the well, the lens shows a spiral of stones winding up the well to the rim: the
//               shortcut up, the way to the Lodge's eye, and it never moves the great sphere. East, the Hall of the
//               Unseen: the chasm of stones only the lens shows (the walker's hold), the far landing's sphere on the
//               walker's print and the eye across the chasm, and with the Lodge's small key and the great sphere down
//               on F2 the far door opens on the great key. South, the last lift down
//   F3 (-54 m)  the heel's floor round the heel's pool (a fall from anywhere above lands in it), and north the great
//               door into the Echo's Hall: the guardian, a being of sound (you calm it). It sings, and one of the three
//               resonant spheres on the galleries round its hall glows with the note: splash that one. Through the lens
//               the sphere that answers wears the walker's print (its second phase); in its last all three glow at once
//               Then the way out (v1.54, issue #178), up through the keepers' stone at the white hill's foot
// Drops: three, each into a shallow pool that breaks the fall (Catch): the iris in the rim onto F1's pool, the open hole
// through the rim and F1's balcony onto F2's, and the well itself onto the heel's pool.
// After: the toes and the heel of the Footprint fill with still water, and every sphere in the garden
// wears a ring of the glyph's light (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** North of the grove, behind the spawn; the heel's door looks south, toward the umbrella grove. */
export const SITE = { x: -250, z: 250, r: 26 };
SITE.heading = Math.atan2(0 - SITE.x, 0 - SITE.z);
/**
 * The keepers' way out (v1.54, issue #178: the walk home from the heel's door was 336 m back the way you came, past
 * nothing): once the Echo is calm, the hall's way out lets you up through the keepers' stone, a round white slab with
 * the walker's print by the white hill's stair, where the hill's path runs home east to the grove
 * (src/levels/spheres.js). `y`: the ground there; `heading`: toward the grove.
 */
export const KEEPERS_STONE = { x: -196, z: -50, y: 0.5, r: 1.7 };
KEEPERS_STONE.heading = Math.atan2(0 - KEEPERS_STONE.x, -30 - KEEPERS_STONE.z);

/**
 * The Footprint's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/footprint):
 * white plaster in big smooth panels, pale lavender in its shade (the Garden's world prints its shade in sage, and turned
 * the house green with it), warm cream light, the fittings (plate rims, door bands) the sage of its door, round
 * portholes under the friezes, the glyphs lit amber.
 */
export const PALETTE = {
  wall: '#f4f0f2', wall2: '#eee8ee', wall3: '#f9f6f6', floor: '#efe9e5', floor2: '#e3dbd7', trim: '#f7f3f4', fitting: '#93b29c',
  dark: '#4f5a80', stone: '#f2ece8', accent: '#e8b9c4', glow: '#a8e6ee', glyph: '#f0b450', lamp: '#f6c84e', sand: '#e9e1d0', sand2: '#ddd3c0',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.75, shade: 0.42, spot: 0.25 },
    wall: { mode: 0, grid: 4.5 },
    glyph: { glow: 0.6 },
  },
  bands: [{ at: 0.72, h: 0.6, color: '#e8e1ee' }],
  ornament: { kind: 'porthole', color: '#e6dfe8', color2: '#8794b8' },
  light: { shadow: '#c3b6da', light: '#fff4e2', sun: '#ffeccc' },
};

/**
 * The house's doors (m: issue #336) and the Heel Well (issue #401): its middle (x, z), its wall's inner radius `r` and
 * thickness `t`, the balconies' inner edge (`inner`: inside it the well is open), how far each balcony's floor runs into
 * the wall (`ring`) and the four floors' heights, F0 the rim to F3 the heel's floor, `step` apart.
 */
export const DOOR = { w: 7, h: 9 };
export const WELL = { x: 0, z: 42, r: 20, t: 1.4, inner: 14, ring: 20.3, step: 18, floors: [0, -18, -36, -54] };
const WZ = WELL.z, [F0, F1, F2, F3] = WELL.floors;
/** A point round the well: angle a (0 north, +z; π/2 east, +x), r m from its middle, local [x, z]. */
export const round = (a, r) => [WELL.x + Math.sin(a) * r, WZ + Math.cos(a) * r];
const DEG = Math.PI / 180;
/**
 * Where things stand round the well (angles): the three drops' holes and pools (A: the iris in the rim over F1's pool; B:
 * the open hole through the rim and F1's balcony onto F2's), the piers to the great lift (south: you come in facing it),
 * the spiral's two ends (north), the gaps cut in F1's balcony either side of its east arc (their bridges, bW).
 */
export const AT = { dropA: -82 * DEG, dropB: -60 * DEG, holeR: 2.2, poolR: 17, pier: Math.PI, spiral: 0, gaps: [45 * DEG, 135 * DEG], gapW: 10 * DEG };
/**
 * Each hall's floor from wall to wall (its walls stand outside it), its floor's height and its ceiling's; the round halls'
 * middles and radii. The Still Pool and the Hall of the Unseen stand on their pits' floors (`y`): their near ledges `near`
 * deep at `ledge`, their pits `pit` long, the far ledge the rest. Every groove, the pool and the chasm as long as they
 * were, so every push and every crossing holds. Stacked in the east (the Lodge over the Sounding Toe over the Hall of the
 * Unseen: the Toe's hole straight over the plate below); the Lens Chamber under the Hall of Spheres, the Still Pool north
 * over the Echo's Hall.
 */
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: F0, top: 12 },
  spheres: { x0: -66, x1: -26, z0: WZ - 16, z1: WZ + 16, y: F0, top: F0 + 18 },
  lodge: { x0: 26, x1: 56, z0: WZ - 15, z1: WZ + 15, y: F0, top: F0 + 18 },
  pool: { x0: -16, x1: 16, z0: WZ + 26, z1: WZ + 58, y: F1 - 6, top: F1 + 16, ledge: F1, near: 8, pit: 19.2 },
  sounding: { x0: 26, x1: 70, z0: WZ - 16, z1: WZ + 16, y: F1, top: F1 + 17 },
  lens: { x: -44, z: WZ, r: 17, y: F2, top: F2 + 17 },
  unseen: { x0: 26, x1: 70, z0: WZ - 16, z1: WZ + 16, y: F2 - 10, top: F2 + 17, ledge: F2, near: 6, pit: 20 },
  vault: { x0: 70, x1: 82, z: WZ, y: F2 },
};
/** (issue #401) The Sounding Toe: its sphere's groove (x along it), the hole at its end over the plate below (x, z), and the three prints behind it. */
export const SOUNDING = { a: 40, b: 55, z: WZ, hole: 1.7, prints: [[36.5, WZ - 3.6, 2], [36.5, WZ, 4], [36.5, WZ + 3.6, 3]] };
/** (issue #401) The great lift: its disc's radius, its sphere's, its two stops (the disc's top: the rim, F2) and speed (m/s). */
export const LIFT = { r: 4, ball: 2, top: F0, bottom: F2, speed: 3, pier: 6.6 };
/** (issue #401) The spiral only the lens shows: from F2 to the rim round the well's middle, two turns of `n` stones. */
export const SPIRAL = { r0: 10.5, r1: 13, turns: 2, n: 80, y0: F2, y1: F0 };
/**
 * (issue #401) A drop's pool: falling over it faster than `slow` m/s, its water takes the fall in the last metres (`over`
 * m, or the distance of `frames` of the fall at its speed): a landing at no more than a wade's speed, nothing hurt.
 */
export const CATCH = { slow: 12, over: 2.5, frames: 5 / 60 };

export const LOGIC = {
  id: 'spheres', entry: 'threshold', gadget: 'monocle',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a
  // fight; src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js.
  // The rim and F2's balcony are puzzle rooms: the great lift is worked there; so is the spiral, `helix`: the Lodge's eye
  // is seen from it, under the rim's pier)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, rim: { checkpoint: true, kind: 'puzzle' }, spheres: { checkpoint: true, kind: 'puzzle' },
    bal1: { checkpoint: true, kind: 'passage' }, bal1e: { kind: 'passage' }, pool: { checkpoint: true, kind: 'puzzle' }, poolFar: { kind: 'passage' },
    sounding: { checkpoint: true, kind: 'puzzle' }, bal2: { checkpoint: true, kind: 'puzzle' }, lens: { checkpoint: true, kind: 'puzzle' },
    unseen: { checkpoint: true, kind: 'puzzle' }, unseenFar: { kind: 'puzzle' }, vault: { kind: 'passage' }, lodge: { checkpoint: true, kind: 'combat' },
    bal3: { checkpoint: true, kind: 'passage' }, helix: { kind: 'puzzle' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'rim' },
    { a: 'rim', b: 'spheres' },
    { a: 'rim', b: 'bal2' },                                // the great lift, ridden either way (or called to your pier)
    { a: 'rim', b: 'bal1', door: 'd1', oneWay: true },      // the first drop: the iris in the rim, onto F1's pool
    { a: 'bal1', b: 'bal2', oneWay: true },                 // the second drop's hole through F1's balcony, onto F2's pool
    { a: 'bal1e', b: 'bal2', oneWay: true },                // (off the east arc: a hard landing on F2's balcony)
    { a: 'rim', b: 'bal3', oneWay: true }, { a: 'bal1', b: 'bal3', oneWay: true }, { a: 'bal1e', b: 'bal3', oneWay: true }, { a: 'bal2', b: 'bal3', oneWay: true },   // the heel's pool
    { a: 'bal2', b: 'bal3' },                               // the last lift
    { a: 'bal1', b: 'pool' },
    { a: 'pool', b: 'poolFar', door: 'stones' },
    { a: 'bal1', b: 'bal1e', door: 'bW' },                  // F1's east arc, over its gaps' bridges
    { a: 'bal1e', b: 'sounding' },
    { a: 'bal2', b: 'lens', door: 'dL' },
    { a: 'bal2', b: 'unseen', door: 'dT' },
    { a: 'unseen', b: 'unseenFar', door: 'br1' },
    { a: 'unseenFar', b: 'vault', door: 'd4' },
    { a: 'bal2', b: 'helix', door: 'spiral' },              // the stones only the lens shows: the shortcut up, F2 to the rim
    { a: 'helix', b: 'rim', door: 'spiral' },
    { a: 'rim', b: 'lodge', door: 'dR' },                   // the Keepers' Lodge (v1.53): an arena, the small key
    { a: 'bal3', b: 'hall', door: 'dG' },                   // the great door
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // F0, the Hall of Spheres: the sphere set down on the walker's print (among two- and four-toed ones), and you standing
    // on the walker's print by the wall: the first drop opens, the iris in the rim
    p1: { type: 'plate', room: 'spheres' },
    pa: { type: 'plate', room: 'spheres' },
    pb: { type: 'plate', room: 'spheres' },
    ball1: { type: 'drum', room: 'spheres', stops: { pa: 0.3, p1: 0.62, pb: 0.92 }, start: 0 },
    pW: { type: 'plate', room: 'spheres' },
    pX: { type: 'plate', room: 'spheres' },
    pY: { type: 'plate', room: 'spheres' },
    d1: { type: 'door', opens: { all: [{ drumOn: ['ball1', 'p1'] }, { pressed: 'pW' }] }, latch: true },
    // F1, the Sounding Toe: the hatch over the hole opens while you stand on the walker's print; the sphere pushed from
    // there drops through onto the plate in the Hall of the Unseen below, and its door opens
    pH: { type: 'plate', room: 'sounding' },
    pH2: { type: 'plate', room: 'sounding' },
    pH4: { type: 'plate', room: 'sounding' },
    hT: { type: 'door', opens: { pressed: 'pH' } },
    pT: { type: 'plate', room: 'unseen' },
    ballT: { type: 'drum', room: 'sounding', plate: 'pT', plateAt: 1, start: 0, through: 'hole', when: { open: 'hT' } },
    dT: { type: 'door', opens: { drumOn: ['ballT', 'pT'] }, latch: true },
    // F1, the Still Pool: the water stirs and draws the floating sphere back, unless you stand on the stone that stills it;
    // pushed across onto its berth meanwhile, it raises the stepping stones to the far ledge: a coffer, and the small key of
    // the Lens Chamber on F2 (issue #561: the chamber's door opened from the berth, two rooms off and out of sight; a
    // keyhole says what it wants from where you stand at it, and the key is seen from the pool's near side)
    pS: { type: 'plate', room: 'pool' },
    p3: { type: 'plate', room: 'pool' },
    ball3: { type: 'drum', room: 'pool', plate: 'p3', plateAt: 1, start: 0, when: { pressed: 'pS' } },
    stones: { type: 'bridge', opens: { drumOn: ['ball3', 'p3'] }, latch: true },
    cF: { type: 'cache', room: 'poolFar' },
    kP: { type: 'key', kind: 'small', room: 'poolFar' },
    dL: { type: 'door', lock: 'small', latch: true },
    // F2, the Lens Chamber (issue #377: the seeing lens, raised to see what the house hides: once it has looked at a hidden
    // stone, eye or door, it stays; a print shows only while it looks)
    chest: { type: 'gadget', room: 'lens', item: 'monocle' },
    mural: { type: 'clue', room: 'lens' },                                   // the walker's print on the wall, through the lens
    // (issue #477) the clues at the locks: the walker's trail from the Lens Chamber's door round F2's balcony to the
    // spiral's foot, and the print again by the chasm's near ledge, both through the lens
    trail: { type: 'clue', room: 'bal2' },
    hold: { type: 'clue', room: 'unseen' },
    spiral: { type: 'bridge', opens: { item: 'monocle' }, clue: 'trail' },   // the spiral up the well, only the lens shows
    // the Hall of the Unseen: the stones only the lens shows, the print's hold; on the far landing a sphere's groove past two
    // plain prints and the walker's, which only the lens shows; an eye only the lens shows on a pillar out of the chasm
    br1: { type: 'bridge', room: 'unseen', opens: { item: 'monocle' }, clue: 'hold' },
    s2: { type: 'switch', room: 'unseenFar', needs: ['monocle'] },
    pf1: { type: 'plate', room: 'unseenFar' },
    p4: { type: 'plate', room: 'unseenFar' },
    pf2: { type: 'plate', room: 'unseenFar' },
    ball4: { type: 'drum', room: 'unseenFar', stops: { pf1: 0.3, p4: 0.62, pf2: 0.9 }, start: 0 },
    // the Lodge's eye, under the rim's pier, only the lens shows: seen from the spiral (its room, `helix`), on the way up;
    // its door wants the eye and the great sphere up
    sL: { type: 'switch', room: 'helix', needs: ['monocle'] },
    dR: { type: 'door', opens: { all: [{ lit: 'sL' }, { drumOn: ['lift', 'pUp'] }] }, latch: true },
    // the Keepers' Lodge: its keepers beaten, the small key's cage sinks (v1.53)
    arL: { type: 'arena', room: 'lodge' },
    kS: { type: 'key', kind: 'small', room: 'lodge', when: { lit: 'arL' } },
    // the Unseen's far door: the Lodge's small key, the eye and the sphere on the walker's print, and the great sphere down
    d4: { type: 'door', lock: 'small', opens: { all: [{ lit: 's2' }, { drumOn: ['ball4', 'p4'] }, { drumOn: ['lift', 'pDown'] }] }, latch: true },
    kG: { type: 'key', kind: 'big', room: 'vault' },
    echo: { type: 'boss', room: 'hall', needs: ['gun', 'monocle'] },
    // (dG and d5 carry the Echo's Hall's room: the redesign's rules measure the hall by its two doors, it has no mark)
    dG: { type: 'door', lock: 'big', room: 'hall' },
    d5: { type: 'door', opens: { resolved: true }, room: 'hall' },
    // the great lift (issue #401): its sphere on the rim's plate (up, t 0) or on F2's (down, t 1), the house's one state,
    // seen from every balcony. Up: F1's bridges stand and the Lodge's bar is lifted; down: the Unseen's far door. (Late in
    // the list: the marker asks for it only when nothing else is left to do, never to and fro: logic.js next)
    pUp: { type: 'plate', room: 'rim' },
    pDown: { type: 'plate', room: 'bal2' },
    lift: { type: 'drum', room: 'rim', stops: { pUp: 0, pDown: 1 }, start: 0, roll: 'hand', through: 'well' },
    bW: { type: 'bridge', opens: { drumOn: ['lift', 'pUp'] } },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'pool', at: [13.5, -18, 70.5], yaw: -Math.PI / 2, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
  },
};

export const ECHO = {
  kind: 'organic', name: 'the Echo', final: 'touch', touch: 'hold out your hand to it',
  speed: 2.6, wakeTime: 3,
  wake: 'Rings of glass round a pale heart sing one loud note at you. It is lost.',
  openHint: 'It sings, and one sphere on the galleries glows. Splash that one.',
  weary: 'It sinks to the floor, humming, listening for you now.',
  resolved: 'The Echo hums with all three spheres at once, and stays quiet.',
  missHint: 'It lies on the floor ringing: splash the sphere that glows.',
  phases: [
    { to: 0.45, attacks: ['note', 'pulse', 'ripple'], pause: 1.7, hint: 'When it sings, answer it: splash the sphere that glows with its note.' },
    { to: 0.75, attacks: ['fall', 'chord', 'note'], pause: 1.3, hint: 'Keep answering it: through your lens, the right sphere shows the print.' },
    { to: 0.9, attacks: ['scale', 'ripple', 'fall'], pause: 1.1, hint: 'All three spheres glow now: splash the one with the walker’s print.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    note: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'core', rig: 'spin', damage: 0.75, knock: 8, recover: 0.8, open: 3.2 },
    pulse: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'core', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 1, knock: 12, recover: 0.8 },
    ripple: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'core', rig: 'swell', blast: { kind: 'front', r0: 2, h: 0.8 }, gap: 0.7, damage: 0.5, knock: 9, recover: 0.4, then: 'ripple2' },
    ripple2: { shape: 'ring', at: 'self', radius: 6, wind: 0.7, part: 'core', rig: 'swell', pose: 'ripple', link: true, blast: { kind: 'front', r0: 2, h: 0.8 }, damage: 0.5, knock: 9, gap: 0.25, then: 'pulseEnd' },
    pulseEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'core', rig: 'swell', pose: 'pulse', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 1, knock: 12, recover: 0.8, open: 3.2 },
    chord: { shape: 'lane', range: 26, width: 3, wind: 1.5, track: 0.7, part: 'core', rig: 'lean', blast: { kind: 'front', r0: 2, r1: 24, h: 1.6 }, active: 1.0, damage: 0.75, knock: 10, recover: 0.9, open: 2.8 },
    fall: { shape: 'ring', at: 'player', radius: 4, wind: 1.5, track: 0.6, over: true, part: 'core', rig: 'rise', parts: ['body'], splash: 0.5, active: 0.45, damage: 0.75, knock: 9, recover: 0.8, miss: 3.0 },
    scale: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'core', rig: 'spin', pose: 'note', damage: 0.5, knock: 6, recover: 0.5, then: 'chordEnd' },
    chordEnd: { shape: 'lane', range: 26, width: 3, wind: 1.2, track: 0.6, part: 'core', rig: 'lean', pose: 'chord', link: true, blast: { kind: 'front', r0: 2, r1: 24, h: 1.6 }, active: 1.0, damage: 0.75, knock: 10, recover: 0.9, open: 2.8 },
  },
};

/** A resonant sphere round the Echo's hall: when the Echo sings its note it glows; splash it then. */
class Resonator {
  constructor(rt, o) {
    this.rt = rt; this.i = o.i;
    const K = rt.kit;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    rt.root.add(this.group);
    this.glow = makeMaterial({ color: o.color, glow: 0.05, flat: true, key: `temple.spheres.res.${o.i}` });
    const plinth = new THREE.CylinderGeometry(1.4, 1.8, 1.2, 16).translate(0, 0.6, 0);
    const ball = new THREE.SphereGeometry(1.5, 20, 14).translate(0, 2.6, 0);
    this.group.add(new THREE.Mesh(plinth, rt.M.trimMat));
    this.group.add(new THREE.Mesh(ball, this.glow));
    // the walker's print on its face toward the hall's middle, that only the lens shows: on the one that answers
    this.printM = makeMaterial({ color: '#f6c84e', glow: 0.8, flat: true, key: `temple.spheres.print.${o.i}` });
    this.print = new THREE.Mesh(printGeometry(3, 1.6).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, 2.6, 1.53), this.printM);
    this.print.visible = false;
    this.group.add(this.print);
    if (o.face) this.group.rotation.y = K.heading(Math.atan2(o.face[0] - o.at[0], o.face[2] - o.at[2]));
    this.group.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; });
    // it never moves: it collides as drawn, the plinth and the round ball, not as a flat disc 1.8 m
    // wide at the ball's crown, whose floor hung 0.14 m over the drawn sphere (src/contact-audit.js)
    K.solid(plinth.clone().translate(o.at[0], o.at[1], o.at[2]));
    K.solid(ball.clone().translate(o.at[0], o.at[1], o.at[2]));
    this.center = this.pos.clone().add(V(0, 2.6, 0));
    this.onHit = o.onHit;
    this.off = registerTarget({ kind: 'resonator', radius: 1.6, position: () => this.center, onHit: (mode) => this.hit(mode) });
    this.k = 0;
  }
  hit(mode = 'shoot') { return this.onHit(this, mode); }
  update(dt, t) {
    // (its last phase: all three glow as it sings three notes at once; the print tells the one that answers)
    const sing = this.rt.sing === this.i || (this.rt.singAll && this.rt.sing >= 0);
    this.k += ((sing ? 1 : 0) - this.k) * Math.min(1, dt * 5);
    this.glow.uniforms.uGlow.value = 0.05 + 0.85 * this.k * (0.75 + 0.25 * Math.sin(t * 10));
    const g = this.rt.guardian;
    this.print.visible = this.rt.sing === this.i && (g?.phaseIndex ?? 0) >= 1 && lensUp(this.rt, this.center);   // (while the lens looks: issue #377)
    if (this.print.visible) this.printM.uniforms.uGlow.value = 0.6 + 0.3 * Math.sin(t * 6);
  }
  dispose() { this.off?.(); }
}

/**
 * What the lens shows in the Lens Chamber (o.id 'mural', the teaching of the house's idea): on the wall, the
 * walker's print, three toes, with a stepping stone under it carrying the same; over the floor, the walker's prints
 * from the dais toward the way on. Without the lens, plain wall and floor. (issue #477) The same kind, `wall: false`, is
 * the trail of prints on F2's balcony to the spiral's foot (o.id 'trail'); a small one by the chasm's near ledge
 * (o.id 'hold', `size`) says again at the lock which stones hold.
 */
class Mural {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit;
    this.mat = makeMaterial({ color: '#f6c84e', glow: 0.7, flat: true, key: 'temple.spheres.mural' });
    const parts = [];
    // (on the wall: facing yaw, standing up; the big print over a stone carrying the small one)
    const up = (g, x, y, z, yaw) => g.rotateX(-Math.PI / 2).rotateY(Math.PI).rotateY(yaw).translate(x, y, z);
    const [x, y, z] = o.at, yaw = o.yaw ?? 0, fx = Math.sin(yaw) * 0.04, fz = Math.cos(yaw) * 0.04, k = o.size ?? 1;
    if (o.wall !== false) {
      parts.push(up(printGeometry(3, 2.6 * k), x + fx, y + 1.2 * k, z + fz, yaw));
      parts.push(up(new THREE.PlaneGeometry(2.2 * k, 0.12).rotateX(Math.PI / 2), x + fx, y - 0.9 * k, z + fz, yaw));
      parts.push(up(printGeometry(3, 0.9 * k), x + fx, y - 0.4 * k, z + fz, yaw));
    }
    // the prints on the floor, from the dais toward the way on
    for (const [px, pz, a] of o.prints ?? []) parts.push(printGeometry(3, 0.9).rotateY(a).translate(px, (o.floor ?? 0) + 0.03, pz));
    this.mesh = new THREE.Mesh(mergeGeometries(parts.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.normal) g.deleteAttribute('normal'); return g.index ? g.toNonIndexed() : g; })), this.mat);
    this.mesh.applyMatrix4(K.frame);
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true;
    rt.root.add(this.mesh);
  }
  update(dt, t) {
    this.mesh.visible = lensUp(this.rt);   // (while the lens is up: issue #377)
    if (this.mesh.visible) this.mat.uniforms.uGlow.value = 0.55 + 0.2 * Math.sin(t * 1.3);
  }
}

/**
 * (issue #477) The walker's trail on F2's balcony, through the lens: [x, z, heading] local, from the Lens Chamber's
 * doorway round the well (r `TRAIL.r`) to the spiral's foot, a print every `stride` m, left and right `side` m apart,
 * none in the second drop's pool; the last two turned in toward the well's middle.
 */
export const TRAIL = { r: 16.8, stride: 1.7, side: 0.45, from: -88, to: -7 };
export function trailPrints() {
  const out = [], R = WELL.r, [px, pz] = round(AT.dropB, AT.poolR), clear = AT.holeR + 1.2;
  for (let x = -(R + 6.2), i = 0; x < -(R - 1.5); x += TRAIL.stride, i++) out.push([x, WZ + (i % 2 ? TRAIL.side : -TRAIL.side), Math.PI / 2]);
  const a0 = TRAIL.from * DEG, a1 = TRAIL.to * DEG, n = Math.round(((a1 - a0) * TRAIL.r) / TRAIL.stride);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, r = TRAIL.r + (i % 2 ? TRAIL.side : -TRAIL.side), [x, z] = round(a, r);
    if (Math.hypot(x - px, z - pz) < clear) continue;
    out.push([x, z, Math.atan2(Math.cos(a), -Math.sin(a))]);
  }
  for (const r of [15.6, 14.6]) { const a = (TRAIL.to + 3) * DEG, [x, z] = round(a, r); out.push([x, z, Math.atan2(WELL.x - x, WZ - z)]); }
  return out;
}

const NOTES = ['#f6c84e', '#a8e6ee', '#e8b9c4'];
/**
 * The Hall of the Unseen's stepping stones ([across, along from the hall's west wall, the toes of the print each
 * carries]): three across, six rows over the chasm. The walker's (three toes) make one way over, a step aside every row
 * or two; the rest carry two or four and crumble.
 */
export const STONES = (() => {
  const path = [1, 0, 0, 1, 2, 1], out = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) out.push([(c - 1) * 3.2, 7.6 + r * 3.35, c === path[r] ? 3 : (r + c) % 2 ? 2 : 4]);
  return out;
})();
/**
 * The Still Pool (z from its south wall): where the floating sphere starts (its groove's near end) and the stilling stone
 * at the ledge's edge (the ledge ends at 8). Stood on, the sphere is pushed from it: from its middle the push's line to
 * the sphere clears the ledge's edge (issue #311: with the stone 2 m short of the edge and the sphere 1.8 m past it only
 * its last 0.2 m did; from the rest the edge took the push).
 */
export const POOL = { ball: 10.6, still: 7.0 };
/** (v1.53) The Keepers' Lodge, off the rim (an arena; since v1.77 the house's one fight, 30 m square). */
export const LODGE = (() => {
  const L = ROOMS.lodge;
  return { x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2, w: L.x1 - L.x0, d: L.z1 - L.z0, zone: { min: [L.x0, L.y - 1, L.z0], max: [L.x1, L.y + 9, L.z1] } };
})();
/** The Lodge's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arL', room: 'lodge', zone: LODGE.zone, doors: ['dR'], extra: 2,
  shut: 'The door grinds shut behind you. In the dark of the lodge, the keepers wake.',
  won: 'The last of them goes still. The key’s cage sinks, and the door lets go.',
}];
function echoHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.05, 'push'); g.rt.notice('The shove scatters its rings. It sings louder, frightened.', 'echo.push'); return true; }
  g.rt.notice('The fluid passes through its light. It wants an answer, not water.', 'echo.fluid');
  return true;
}
/** A splash on a resonant sphere: the right one while it sings is an answer. */
function resonate(rt, res, mode) {
  const g = rt.guardian;
  if (mode === 'push' || !g) return true;
  rt.sound?.chime?.();
  if (g.state !== 'open') { rt.notice('The sphere rings, and nothing answers. Wait for it to sing.', 'echo.wait'); return true; }
  if (rt.sing !== res.i) { rt.notice('A different note. It flinches.', 'echo.wrong'); g.add(-0.03, 'wrong'); return true; }
  g.add(g.phaseIndex === 0 ? 0.15 : 0.15, 'answer');
  if (g.state === 'open') { g.enter('fight'); g.cool = 2; }
  return true;
}

// ------------------------------------------------------------------ the well's own pieces (issue #401)
/** A flat outline (local [x, z] points, or a THREE.Shape whose x, y are x, z) with round holes [{ x, z, r }], as a slab t thick, its top at 0. */
function slabOf(outline, holes = [], t = 0.8, seg = 24) {
  const s = outline instanceof THREE.Shape ? outline : new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) { const p = new THREE.Path(); p.absarc(h.x, h.z, h.r, 0, TAU, true); s.holes.push(p); }
  // (the shape's x, y are the floor's x, z: turned down into it, extruded down from 0)
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg }).rotateX(Math.PI / 2);
}
/** A ring's outline round (0, 0) from r0 to r1 (angles as `round`: 0 north), whole or from a0 to a1. */
function ringShape(r0, r1, a0 = 0, a1 = TAU, seg = 128) {
  const pt = (a, r) => new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r);
  if (a1 - a0 >= TAU - 1e-6) {
    const s = new THREE.Shape(Array.from({ length: seg }, (_, i) => pt((i / seg) * TAU, r1)));
    s.holes.push(new THREE.Path(Array.from({ length: seg }, (_, i) => pt(-(i / seg) * TAU, r0))));
    return s;
  }
  const n = Math.max(4, Math.ceil(((a1 - a0) / TAU) * seg)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(pt(a0 + ((a1 - a0) * i) / n, r1));
  for (let i = n; i >= 0; i--) pts.push(pt(a0 + ((a1 - a0) * i) / n, r0));
  return new THREE.Shape(pts);
}
/** Geometries merged into one mesh (their uvs left out: the house's flat materials need none). */
function merged(geos, mat) {
  return new THREE.Mesh(mergeGeometries(geos.map((g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; })), mat);
}
const own = (o, key) => makeMaterial({ ...o, key });

/**
 * A drop's pool (issue #401): fall into it from any height and its water takes the fall in the last metres over it
 * (CATCH: slowed to a wade's speed, as the makers' still water would), a splash, nothing hurt. Robust to whichever runs
 * first, the house or the traveller: the slowing starts a few frames of the fall before the water. o: { at: [x, y, z] its
 * floor (local), r, follow: () => world point (a moving one: the great lift's disc), said }
 */
export class Catch {
  constructor(rt, o) { this.rt = rt; this.o = o; this.at = rt.kit.world(...(o.at ?? [0, 0, 0])); this.on = false; }
  update() {
    const P = this.rt.player;
    if (!P?.pos) return;
    const c = this.o.follow?.() ?? this.at;
    const over = Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < this.o.r + 0.5 && P.pos.y > c.y - 1.5 && P.pos.y < c.y + 80;
    if (over && !P.onGround && !P.dead && P.vel.y < -CATCH.slow) {
      this.on = true;
      if (P.pos.y - c.y < Math.max(CATCH.over, -P.vel.y * CATCH.frames)) P.vel.y = -CATCH.slow;
      return;
    }
    if (this.on && (P.onGround || !over || P.dead)) {
      this.on = false;
      if (P.onGround && over) { this.rt.sound?.splash?.(1.2); this.rt.notice?.(this.o.said ?? 'The water breaks your fall.', 'spheres.caught'); }
    }
  }
}

/**
 * The great lift (issue #401): a disc in the middle of the Heel Well and the great sphere on it, between the rim (its
 * element at t 0, the sphere on the rim's plate) and F2 (t 1). Stepped on, after a breath it carries you to the other
 * floor (stay on and it stays: step off and on to go back); its plate on the other floor's pier, stood on, calls it.
 * Leaving, its sphere is off both plates (t 0.1 or 0.9: what waits for it shuts at once). It is the house's one state,
 * seen from every balcony. o: { id, x, z, top, bottom, r, speed, up, down (the piers' plates) }
 */
class GreatLift {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, L = rt.logic;
    this.topP = K.world(o.x, o.top, o.z); this.bottomP = K.world(o.x, o.bottom, o.z);
    const t = L.drumT(o.id);
    this.at = t >= 0.5 ? 1 : 0;   // (left half-way, it finishes the trip)
    if (Math.abs(t - this.at) > 1e-3) L.moveDrum(o.id, this.at);
    this.s = this.at; this.dest = null; this.wait = 0; this.onT = 0; this.rode = false;
    // (the rules' and the audits' points: its two stops)
    o.a = [o.x, o.top, o.z]; o.b = [o.x, o.bottom, o.z];
    this.group = new THREE.Group();
    rt.root.add(this.group);
    const r = o.r;
    this.glow = own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.5, flat: true }, 'temple.spheres.lift');
    this.group.add(merged([new THREE.CylinderGeometry(r, r * 0.86, 1.0, 40).translate(0, -0.5, 0)], M.floor));
    this.group.add(merged([new THREE.TorusGeometry(r * 0.94, 0.09, 4, 48).rotateX(Math.PI / 2).translate(0, -1.03, 0), glyphGeometry(r * 0.9, 0.04).rotateX(Math.PI / 2).translate(0, -1.06, 0), new THREE.TorusGeometry(r - 0.12, 0.06, 4, 48).rotateX(Math.PI / 2).translate(0, -0.05, 0)], this.glow));
    this.group.add(merged([new THREE.TorusGeometry(o.ball * 0.78, 0.2, 6, 40).rotateX(Math.PI / 2).translate(0, 0.2, 0)], M.trimMat));   // the cradle
    this.group.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; });
    // its rails of light, from under F2 to over the rim (they stay)
    const rails = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; rails.push(new THREE.CylinderGeometry(0.07, 0.07, o.top - o.bottom + 8, 6).translate(o.x + Math.sin(a) * (r + 0.45), (o.top + o.bottom) / 2 + 2, o.z + Math.cos(a) * (r + 0.45))); }
    this.rails = merged(rails, this.glow);
    this.rails.applyMatrix4(K.frame);
    this.rails.userData.noCollide = true;
    rt.root.add(this.rails);
    this.solid = { pos: V(), r, top: 0, bottom: 0, vel: V(), flat: true };
    this.place(0);
  }
  y() { return THREE.MathUtils.lerp(this.topP.y, this.bottomP.y, this.s); }
  /** Where to go to work it (the marker's spot): its plate on the pier where it rests, a step from its disc. */
  get pos() { return this.rt.piece(this.at ? this.o.down : this.o.up)?.pos ?? this.group.position; }
  place(dt) {
    const y = this.y(), prev = this.group.position.y;
    this.group.position.set(this.topP.x, y, this.topP.z);
    this.solid.pos.copy(this.group.position);
    this.solid.top = y; this.solid.bottom = y - 1.4;
    this.solid.vel.set(0, dt > 0 ? (y - prev) / dt : 0, 0);
  }
  /** The traveller stands on its disc. */
  carries(P) { return !!P?.pos && !P.dead && P.onGround && Math.hypot(P.pos.x - this.topP.x, P.pos.z - this.topP.z) < this.o.r && Math.abs(P.pos.y - this.y()) < 0.5; }
  /** Off to the other floor (1: down to F2, 0: up to the rim). */
  go(dest) {
    if (this.dest != null || dest === this.at) return false;
    this.dest = dest; this.wait = 0.6;
    this.rt.logic.moveDrum(this.id, dest ? 0.9 : 0.1);   // (its sphere off the plate it leaves)
    this.rt.rumble?.(1.4, 0.35); this.rt.sound?.whoosh?.(0.6);
    return true;
  }
  update(dt, t) {
    const P = this.rt.player, L = this.rt.logic;
    if (this.dest == null) {
      const on = this.carries(P);
      if (on) { this.onT += dt; if (this.onT > 0.9 && !this.rode) { this.rode = true; this.go(1 - this.at); } }
      else { this.onT = 0; this.rode = false; }
      if (this.dest == null && P) {
        if (this.at === 1 && this.rt.piece(this.o.up)?.weighed?.(P)) this.go(0);
        else if (this.at === 0 && this.rt.piece(this.o.down)?.weighed?.(P)) this.go(1);
      }
      this.solid.vel.set(0, 0, 0);
    } else if (this.wait > 0) { this.wait -= dt; this.solid.vel.set(0, 0, 0); }
    else {
      const total = Math.abs(this.topP.y - this.bottomP.y), dir = Math.sign(this.dest - this.s);
      const left = Math.abs(this.dest - this.s) * total, gone = total - left;
      const sp = this.o.speed * (0.3 + 0.7 * Math.min(1, Math.min(left, gone) / 3));
      this.s = THREE.MathUtils.clamp(this.s + (dir * sp * dt) / total, 0, 1);
      if (Math.abs(this.s - this.dest) < 1e-3) this.s = this.dest;
      this.place(dt);
      // going down with someone on it: they go down with it (as a Platform's riders)
      if (P && this.solid.vel.y < 0 && !P.climbing && Math.hypot(P.pos.x - this.solid.pos.x, P.pos.z - this.solid.pos.z) < this.o.r && Math.abs(P.pos.y - this.solid.top) < 0.4 && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
      if (this.s === this.dest) {
        this.at = this.dest; this.dest = null; this.solid.vel.set(0, 0, 0);
        L.moveDrum(this.id, this.at);
        this.rt.sound?.chime?.(); this.rt.rumble?.(0.8, 0.3);
        this.rt.notice?.(this.at ? 'The great sphere settles on the low plate. Up the well, bridges sink.' : 'The great sphere settles on the rim’s plate. Below, bridges rise.', `${this.id}.${this.at}`);
        this.rode = this.carries(P);   // (come with you on it: it stays until you step off and on again)
      }
    }
    this.glow.uniforms.uGlow.value = this.dest != null ? 0.85 : 0.45 + 0.12 * Math.sin(t * 1.4);
  }
  dispose() { this.rails.removeFromParent(); }
}
/** The great lift's sphere, riding its disc: round to the feet (as a Ball). o: { lift, r } */
class LiftSphere {
  constructor(rt, o) {
    this.rt = rt; this.lift = o.lift; this.r = o.r;
    this.group = new THREE.Group();
    rt.root.add(this.group);
    this.glow = own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.4, flat: true }, 'temple.spheres.liftBall');
    this.group.add(merged([new THREE.SphereGeometry(this.r, 28, 18)], rt.M.stoneMat));
    this.group.add(merged([new THREE.TorusGeometry(this.r * 1.004, 0.08, 4, 48), new THREE.TorusGeometry(this.r * 1.004, 0.08, 4, 48).rotateY(Math.PI / 2), printGeometry(3, 1.6).rotateX(-Math.PI / 2).translate(0, 0, this.r + 0.02)], this.glow));
    this.group.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; });
    this.center = V();
    this.solid = {
      pos: V(), r: this.r, top: 0, bottom: 0, vel: V(),
      topAt: (x, z) => { const R = this.r + 0.03, d2 = (x - this.center.x) ** 2 + (z - this.center.z) ** 2; return d2 < (0.92 * R) ** 2 ? this.center.y + Math.sqrt(R * R - d2) : -Infinity; },
      pushOut: (p, rc) => {
        const dx = p.x - this.center.x, dz = p.z - this.center.z, d = Math.hypot(dx, dz), R = this.r + rc;
        if (d >= R || d < 1e-4 || p.y > this.center.y + Math.sqrt(Math.max(0, this.r * this.r - Math.min(d, this.r) ** 2)) - 0.5) return false;
        p.x = this.center.x + (dx / d) * R; p.z = this.center.z + (dz / d) * R;
        return true;
      },
    };
    this.update(0, 0);
  }
  update(dt, t) {
    const L = this.lift;
    this.center.set(L.topP.x, L.y() + this.r + 0.15, L.topP.z);
    this.group.position.copy(this.center);
    this.group.rotation.y = L.s * Math.PI * 1.5;
    this.solid.pos.copy(this.center).setY(this.center.y - this.r);
    this.solid.bottom = this.center.y - this.r; this.solid.top = this.center.y + this.r;
    this.solid.vel.copy(L.solid.vel);
    this.glow.uniforms.uGlow.value = L.dest != null ? 0.9 : 0.4 + 0.1 * Math.sin(t * 1.4);
  }
}

/**
 * The spiral only the lens shows (issue #401): stones winding up round the well's middle from F2 to the rim, each a step
 * up from the last (never more than the traveller steps), a landing at each end onto the balcony. Plain air until the
 * lens has looked at the well's middle (`mid`, local), then there for good (pieces.js revealed). It never moves the great
 * sphere: the way up that leaves the house as it is. o: { id, x, z, r0, r1, y0, y1, a0, turns, n, mid, reach }
 */
class Spiral {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, n = o.n, rm = (o.r0 + o.r1) / 2, sweep = o.turns * TAU, arc = (sweep * rm) / n, dy = (o.y1 - o.y0) / n;
    const stones = [], prints = [];
    const stone = (a, top, r0, r1, len) => {
      const r = (r0 + r1) / 2;
      stones.push(box(len, 0.5, r1 - r0, o.x + Math.sin(a) * r, top - 0.25, o.z + Math.cos(a) * r, a));
    };
    this.steps = [];
    for (let k = 0; k < n; k++) {
      const a = o.a0 + ((k + 0.5) / n) * sweep, top = o.y0 + (k + 1) * dy;
      stone(a, top, o.r0, o.r1, arc - 0.12);
      prints.push(printGeometry(3, 0.8).rotateY(a + Math.PI / 2).translate(o.x + Math.sin(a) * rm, top + 0.02, o.z + Math.cos(a) * rm));
      this.steps.push({ a, top, x: o.x + Math.sin(a) * rm, z: o.z + Math.cos(a) * rm });
    }
    // the landings, onto the balconies (2 cm under them: no face shared with their floors)
    const half = sweep / n / 2;   // (a landing a stone's width before the first and after the last)
    stone(o.a0 - half, o.y0 - Z, o.r0, o.reach, arc - 0.12);
    stone(o.a0 + sweep + half, o.y1 - Z, o.r0, o.reach, arc - 0.12);
    this.ends = [round(o.a0 - half, (o.r0 + o.reach) / 2), round(o.a0 + sweep + half, (o.r0 + o.reach) / 2)];
    this.mat = own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.4, flat: true }, 'temple.spheres.spiral');
    this.markM = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.7, flat: true }, 'temple.spheres.spiralPrints');
    this.root = new THREE.Group();
    const m1 = merged(stones.map((g) => g.clone()), this.mat), m2 = merged(prints, this.markM);
    for (const m of [m1, m2]) { m.applyMatrix4(K.frame); this.root.add(m); }
    this.root.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; });
    rt.root.add(this.root);
    this.block = merged(stones, new THREE.MeshBasicMaterial());
    this.block.applyMatrix4(K.frame);
    this.mid = K.world(...o.mid);
    this.root.visible = false;
  }
  init(physics) { this.physics = physics; }
  // (issue #477: its middle over the well, and its two landings and the stones a quarter and three quarters up: the lens
  // raised where the walker's trail ends at its foot, or looking down from the rim, shows it, not only looking up into
  // the well's middle)
  seen() { return (this.at ??= this.lookAt()).some((p) => revealed(this.rt, this.id, p)); }
  lookAt() {
    const K = this.rt.kit, S = this.steps, q = (i) => K.world(S[i].x, S[i].top + 1, S[i].z);
    return [this.mid, ...this.ends.map(([x, z], i) => K.world(x, (i ? this.o.y1 : this.o.y0) + 1, z)), q(Math.floor(S.length / 4)), q(Math.floor((S.length * 3) / 4))];
  }
  update(dt, t) {
    const seen = this.seen();
    this.root.visible = seen;
    if (seen && !this.handle && this.physics) this.handle = this.physics.addCollider?.(this.block, { noClimb: true }) ?? null;
    if (seen) this.mat.uniforms.uGlow.value = 0.38 + 0.08 * Math.sin(t * 1.2);
  }
  dispose() { if (this.handle) this.physics?.removeCollider?.(this.handle); }
}

// ------------------------------------------------------------------ inside
// (since v1.82, issue #401: four floors round the Heel Well; since v1.77, issue #336, docs/design/temple-redesign.md:
// every hall 30 m across and more under 16 m and more, doors 7 by 9; each puzzle in the middle of its room)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, ...o }); };
  /** A sphere's groove on the floor from (ax, az) to (bx, bz): a dark channel between two trim lips (solid: stood on). */
  const groove = (ax, az, bx, bz, y = 0) => {
    const L = Math.hypot(bx - ax, bz - az) + 1, ry = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    K.add(M.dark, box(1.0, 0.04, L, cx, y + 0.02, cz, ry));
    for (const s of [-1, 1]) K.both(M.trim, box(0.25, 0.12, L, cx + Math.cos(ry) * 0.75 * s, y + 0.06, cz - Math.sin(ry) * 0.75 * s, ry));
  };
  const waterM = makeMaterial({ color: '#a8d0d6', glow: 0.15, flat: true, key: 'temple.spheres.pool' });
  const toCentre = (x, z) => Math.atan2(WELL.x - x, WZ - z);
  const R = WELL.r, IN = WELL.inner;

  // ---- the Threshold, and the way onto the rim
  const TH = R0.threshold;
  hall(TH, { roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }, { side: 'n', w: D.w, h: D.h }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-5, F0, 6.5], yaw: Math.PI / 2 });
  // (a passage's floor 4 cm under the balcony it runs out onto, and 2 cm under the well wall's sill: no two share a face)
  K.corridor([0, TH.z1 + 0.6], [0, WZ - R + 0.1], F0 - 2 * Z, { w: D.w, h: D.h + 2 * Z });

  // ---- the Heel Well: one round wall from the heel's floor to over the rim, its doorways floor by floor, open to the sky
  const gap = (a, y) => ({ a, w: D.w, h: D.h, y0: y - F3 });
  K.rotunda({ x: WELL.x, z: WZ, y: F3, r: R, h: F0 + 18 - F3, seg: 40, t: WELL.t, oculus: 0.55, floor: false, frieze: false, well: true,
    gaps: [gap(Math.PI, F0), gap(-Math.PI / 2, F0), gap(Math.PI / 2, F0), gap(0, F1), gap(Math.PI / 2, F1), gap(-Math.PI / 2, F2), gap(Math.PI / 2, F2), gap(Math.PI, F2), gap(0, F3), gap(Math.PI, F3)] });
  // a frieze of glyphs round every floor, clear of its doorways
  const doorsAt = { [F0]: [Math.PI, -Math.PI / 2, Math.PI / 2], [F1]: [0, Math.PI / 2], [F2]: [-Math.PI / 2, Math.PI / 2, Math.PI], [F3]: [0, Math.PI] };
  for (const y of WELL.floors) for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU;
    if (doorsAt[y].some((d) => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d))) < 0.3)) continue;
    const [gx, gz] = round(a, R - 0.08);
    K.glyph([gx, y + 12.6, gz], 1.1, a + Math.PI);
    K.ornament([gx, y + 12.6, gz], a + Math.PI);
  }
  // the balconies: the rim with its two holes, F1's with its east arc cut off by two gaps and the second drop's hole,
  // F2's whole, F3's round the heel's pool
  const [hAx, hAz] = round(AT.dropA, AT.poolR), [hBx, hBz] = round(AT.dropB, AT.poolR);
  const hole = (x, z) => ({ x: x - WELL.x, z: z - WZ, r: AT.holeR });
  // (drawn round, 128 sides; solid with 48, its holes 12: the collision's budget, tests/spheres.test.js)
  const ring = (y, a0, a1, holes = []) => (K.chartNote({ kind: 'ring', x: WELL.x, z: WZ, y, r0: IN, r1: WELL.ring, a0, a1, holes: holes.map((h) => ({ x: h.x + WELL.x, z: h.z + WZ, r: h.r })) }), K.both(M.floor, T(slabOf(ringShape(IN, WELL.ring, a0, a1), holes), [WELL.x, y, WZ]), T(slabOf(ringShape(IN, WELL.ring, a0, a1, 48), holes, 0.8, 12), [WELL.x, y, WZ])));
  ring(F0, 0, TAU, [hole(hAx, hAz), hole(hBx, hBz)]);
  const [g1, g2] = AT.gaps, gw = AT.gapW / 2;
  ring(F1, g1 + gw, g2 - gw);
  ring(F1, g2 + gw, g1 - gw + TAU, [hole(hBx, hBz)]);
  ring(F2, 0, TAU);
  ring(F3, 0, TAU);
  // the holes' lit collars (the way down), the pools under them (a lip, still water, a soft landing)
  // (in a light of their own: the makers' glyph material is the mark's alone, tests/makers-mark.test.js)
  const lineM = makeMaterial({ color: rt.P.glow ?? '#a8e6ee', glow: 0.55, flat: true, key: 'temple.spheres.lines' });
  for (const [x, z, y] of [[hAx, hAz, F0], [hBx, hBz, F0], [hBx, hBz, F1]]) K.add(lineM, T(annulus(AT.holeR + 0.02, AT.holeR + 0.3, 0.06, 40), [x, y + 0.02, z]));
  const pool = (x, z, y, said) => {
    K.both(M.trim, T(annulus(AT.holeR + 0.1, AT.holeR + 0.5, 0.34, 40), [x, y + 0.3, z]));
    K.add(waterM, T(new THREE.CircleGeometry(AT.holeR + 0.1, 40).rotateX(-Math.PI / 2), [x, y + 0.1, z]));
    add(Catch, { at: [x, y, z], r: AT.holeR + 0.3, said });
  };
  pool(hAx, hAz, F1, 'The pool breaks your fall.');
  pool(hBx, hBz, F2, 'The pool breaks your fall.');
  // the first drop: an iris in the rim's floor, shut until the Hall of Spheres is answered (its two lamps: the sphere on
  // the walker's print, you on the walker's print)
  add(Iris, { id: 'd1', at: [hAx, F0, hAz], r: AT.holeR, t: 0.6, up: true, lamps: [{ drumOn: ['ball1', 'p1'] }, { pressed: 'pW' }] });
  // F1's east arc: the gaps either side of it, bridged while the great sphere is up (bW: two bridges, one element)
  for (const g of AT.gaps) {
    const [px, pz] = round(g, 17.4), tx = Math.cos(g) * 2.1, tz = -Math.sin(g) * 2.1;
    add(Bridge, { id: 'bW', a: [px - tx, F1 - Z, pz - tz], b: [px + tx, F1 - Z, pz + tz], w: 6.4, n: 3 });
  }
  // the heel's floor: a round pool of still water in the middle of F3, the walker's print lit on it; a fall from any
  // floor above lands in it
  K.both(M.dark, T(new THREE.CylinderGeometry(IN + 0.05, IN + 0.05, 0.8, 64), [WELL.x, F3 - 0.9, WZ]), T(new THREE.CylinderGeometry(IN + 0.05, IN + 0.05, 0.8, 24), [WELL.x, F3 - 0.9, WZ]));
  K.add(waterM, T(new THREE.CircleGeometry(IN, 64).rotateX(-Math.PI / 2), [WELL.x, F3 - 0.15, WZ]));
  K.add(lineM, T(printGeometry(3, 16), [WELL.x, F3 - 0.13, WZ]));
  add(Catch, { at: [WELL.x, F3 - 0.5, WZ], r: IN, said: 'The heel’s pool breaks your fall.' });
  // marks on the balconies
  const markOn = (room, a, y) => { const [x, z] = round(a, 17); add(Mark, { room, at: [x, y, z], yaw: toCentre(x, z) }); };
  markOn('rim', 172 * DEG, F0); markOn('bal1', -100 * DEG, F1); markOn('bal2', -35 * DEG, F2); markOn('bal3', 150 * DEG, F3);

  // ---- the great lift, its piers (south: you come in facing it) and their plates; the Lodge's eye under the rim's pier
  const lift = add(GreatLift, { id: 'lift', x: WELL.x, z: WZ, top: LIFT.top, bottom: LIFT.bottom, r: LIFT.r, ball: LIFT.ball, speed: LIFT.speed, up: 'pUp', down: 'pDown' });
  add(LiftSphere, { lift, r: LIFT.ball });
  K.chartNote({ kind: 'lift', id: 'lift', path: [[WELL.x, LIFT.top, WZ], [WELL.x, LIFT.bottom, WZ]], r: LIFT.r });   // (the house's map: issue #405)
  add(Catch, { r: LIFT.r - 0.2, follow: () => lift.solid.pos, said: 'The disc’s glass gives under you, and holds.' });
  const pz0 = WZ - IN - 0.4, pz1 = WZ - LIFT.r - 0.15;
  for (const [y, id] of [[F0, 'pUp'], [F2, 'pDown']]) {
    K.both(M.floor, box(3.6, 0.8, pz1 - pz0, WELL.x, y - Z - 0.4, (pz0 + pz1) / 2));
    K.chartNote({ kind: 'slab', x0: WELL.x - 1.8, x1: WELL.x + 1.8, z0: pz0, z1: pz1, y: y - Z });
    for (const s of [-1, 1]) K.both(M.trim, box(0.3, 0.55, IN - LIFT.r - 1.2, WELL.x + s * 1.6, y - Z + 0.2, WZ - (IN + LIFT.r) / 2 - 0.4));
    add(Plate, { id, at: [WELL.x, y - Z, WZ - LIFT.pier], r: 1.2 });
  }
  K.both(M.wall, box(1.2, 1.8, 1.2, WELL.x, F0 - 0.62 - 0.9, WZ - 8.6));
  add(Switch, { id: 'sL', at: [WELL.x, F0 - 1.7, WZ - 8.6 - 0.62], yaw: Math.PI, size: 0.8, hidden: true });
  // ---- the spiral only the lens shows, F2 to the rim
  add(Spiral, { id: 'spiral', x: WELL.x, z: WZ, ...SPIRAL, a0: AT.spiral, reach: IN + 0.15, mid: [WELL.x, (F0 + F2) / 2, WZ] });

  // ---- the Hall of Spheres (F0, west): one white sphere in a groove past three carved prints; three prints in a row
  // beside it; the walker's print (three toes) carved over the far wall
  const SP = R0.spheres;
  hall(SP, { roof: 'oculus', oculus: 0.25, doors: [{ side: 'e', w: D.w, h: D.h }] });
  for (const [x, z] of [[SP.x0 + 4, WZ - 11], [SP.x0 + 4, WZ + 11], [SP.x1 - 4, WZ - 11], [SP.x1 - 4, WZ + 11]]) K.column(x, z, F0, SP.top - F0, 0.8);
  K.corridor([-(R - 0.1), WZ], [SP.x1 + 0.6, WZ], F0 - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  const SX0 = -35, SX1 = -57.4, SL = SX0 - SX1, GZ = WZ - 5;   // (the groove as long as it was: 22.4 m)
  K.add(M.dark, box(SL, 0.04, 1.0, (SX0 + SX1) / 2, F0 + 0.02, GZ));
  for (const s of [-1, 1]) K.both(M.trim, box(SL, 0.12, 0.25, (SX0 + SX1) / 2, F0 + 0.06, GZ + s * 0.75));
  add(Ball, { id: 'ball1', a: [SX0, F0 + 0.04, GZ], b: [SX1, F0 + 0.04, GZ], r: 1.2 });
  for (const [id, t, toes] of [['pa', 0.3, 2], ['p1', 0.62, 3], ['pb', 0.92, 4]]) add(Plate, { id, at: [SX0 - SL * t, F0, GZ], r: 1.4, print: toes, yaw: -Math.PI / 2 });
  for (const [id, x, toes] of [['pX', SX0 - 4, 4], ['pW', SX0 - 11, 3], ['pY', SX0 - 18, 2]]) add(Plate, { id, at: [x, F0, WZ + 6], r: 1.3, print: toes, yaw: -Math.PI / 2 });
  K.add(M.glyph, T(printGeometry(3, 2.4).rotateX(-Math.PI / 2), [SP.x0 + 0.05, 11.6, WZ], [0, -Math.PI / 2, 0]));   // the walker's print on the far wall
  add(Mark, { room: 'spheres', at: [SP.x1 - 3.3, F0, WZ - 9], yaw: -Math.PI / 2 });

  // ---- the Still Pool (F1, north): a sunken pool across the middle, a sphere floating in it, stepping stones that rise
  const PL = R0.pool, E = PL.z0 + PL.near, Fz = E + PL.pit, dy = PL.ledge - PL.y;
  hall(PL, { floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: dy }] });
  K.corridor([0, WZ + R - 0.1], [0, PL.z0 - 1.2], F1 - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  K.slab(PL.x0, PL.z0, PL.x1, E, F1, dy);
  K.slab(PL.x0, Fz, PL.x1, PL.z1, F1, dy);
  K.add(waterM, box(PL.x1 - PL.x0, 0.2, PL.pit, 0, F1 - 2.6, (E + Fz) / 2));
  K.both(M.dark, box(PL.x1 - PL.x0, 1, PL.pit, 0, PL.y - 0.5, (E + Fz) / 2));
  add(Pit, { room: 'pool', min: [PL.x0 - 1, PL.y - 2, E], max: [PL.x1 + 1, F1 - 1.8, Fz] });
  // the floating sphere (half sunk in the still water): pushed across, it settles in the berth at the far ledge's foot;
  // the water stirs and draws it back to the near side unless you stand on the stilling stone at the ledge's edge
  add(Ball, { id: 'ball3', a: [-4.5, F1 - 3.3, PL.z0 + POOL.ball], b: [-4.5, F1 - 3.3, PL.z0 + POOL.ball + 14.8], r: 1.5, friction: 0.45,
    current: { pull: 0.7, still: { pressed: 'pS' }, stirs: 'The water stirs, and draws the sphere back to you.', stilled: 'Under your feet the stone hums, and the pool goes glassy still.' } });
  add(Plate, { id: 'pS', at: [-4.5, F1, PL.z0 + POOL.still], r: 1.0 });
  K.add(M.trim, T(new THREE.TorusGeometry(1.8, 0.18, 5, 20, Math.PI), [-4.5, F1 - 2.45, Fz - 0.6], [Math.PI / 2, 0, Math.PI]));   // the berth's lip
  add(Bridge, { id: 'stones', a: [3.5, F1, E - 0.1], b: [3.5, F1, Fz + 0.1], w: 3.4, n: 7 });
  add(Coffer, { id: 'cF', at: [3.5, F1, Fz + 2.4], yaw: Math.PI });
  add(Key, { id: 'kP', at: [-2.5, F1, Fz + 2.8], yaw: Math.PI });   // (issue #561: the Lens Chamber's small key, seen across the pool)
  add(Mark, { room: 'pool', at: [-9, F1, PL.z0 + 3.1], yaw: Math.PI / 2 });

  // ---- the Sounding Toe (F1, east): a sphere in a groove whose end is a hatch over a hole in the floor, straight over
  // the plate in the Hall of the Unseen below; three prints behind it, the walker's opens the hatch while you stand on it
  const ST = R0.sounding, S = SOUNDING;
  hall(ST, { floor: false, roof: true, doors: [{ side: 'w', w: D.w, h: D.h }] });
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  K.both(M.floor, T(slabOf(rect(ST.x0 - 0.6, ST.z0 - 0.6, ST.x1 + 0.6, ST.z1 + 0.6), [{ x: S.b, z: S.z, r: S.hole }]), [0, F1, 0]));
  K.corridor([R - 0.1, WZ], [ST.x0 - 0.6, WZ], F1 - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  groove(S.a - 0.5, S.z, S.b - S.hole - 0.6, S.z, F1);
  add(Iris, { id: 'hT', at: [S.b, F1, S.z], r: S.hole, t: 0.6, up: true, lamps: [{ pressed: 'pH' }] });
  add(Ball, { id: 'ballT', a: [S.a, F1 + 0.04, S.z], b: [S.b, F1 + 0.04, S.z], r: 1.2, friction: 0.25,
    hole: { gate: 'hT', stand: 'pH', to: [S.b, F2 + 0.04, S.z], fell: 'The sphere drops through the floor. Far below, something settles on its plate.' } });
  for (const [x, z, toes] of S.prints) add(Plate, { id: toes === 3 ? 'pH' : `pH${toes}`, at: [x, F1, z], r: 1.3, print: toes, yaw: Math.PI / 2 });
  add(Mark, { room: 'sounding', at: [ST.x0 + 3, F1, WZ - 9], yaw: Math.PI / 2 });

  // ---- the Lens Chamber (F2, west; a round hall 34 m across under the Hall of Spheres): the chest in the middle, the
  // mural on a stele beside it
  const LE = R0.lens;
  K.rotunda({ x: LE.x, z: LE.z, y: F2, r: LE.r, h: LE.top - F2, seg: 32, gaps: [{ a: Math.PI / 2, w: D.w, h: D.h }], oculus: 0 });
  K.corridor([-(R - 0.1), WZ], [LE.x + LE.r + 1.4, WZ], F2 - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  K.both(M.trim, ...chestMound(LE.x, F2, LE.z));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // the lens shows the walker's print on the stele west of the chest, over a stone carrying the same, and its prints from
  // the dais toward the way out (the clue of the stones only the lens shows). The stele solid, as drawn
  K.both(M.wall, box(0.8, 6.4, 4.8, LE.x - 7.4, F2 + 3.2, LE.z));
  K.both(M.trim, box(1.2, 0.4, 5.2, LE.x - 7.4, F2 + 6.6, LE.z));
  add(Mural, { id: 'mural', at: [LE.x - 6.98, F2 + 3.6, LE.z], yaw: Math.PI / 2, floor: F2, prints: [[LE.x + 4.2, LE.z + 0.9, Math.PI / 2 + 0.15], [LE.x + 5.8, LE.z - 0.7, Math.PI / 2 - 0.1], [LE.x + 7.4, LE.z + 0.8, Math.PI / 2 + 0.1], [LE.x + 9.0, LE.z - 0.6, Math.PI / 2 - 0.05], [LE.x + 10.6, LE.z + 0.7, Math.PI / 2 + 0.1], [LE.x + 12.2, LE.z - 0.5, Math.PI / 2]] });
  // (issue #477) and on out: the walker's trail through the doorway and round F2's balcony to the spiral's foot, stepping
  // over the second drop's pool, its last two prints turned to the well where the first stone waits: through the lens,
  // where to raise it again (the spiral was shown only to a lens raised into the well's middle, seen from nowhere)
  add(Mural, { id: 'trail', at: [-(R - 0.6), F2, WZ], wall: false, floor: F2, prints: trailPrints() });
  add(Door, { id: 'dL', at: [-(R + 0.7), F2, WZ], yaw: Math.PI / 2, w: D.w, h: D.h });   // (issue #561: its keyhole, the Still Pool's key)
  add(Mark, { room: 'lens', at: [LE.x + 8, F2, LE.z - 8], yaw: -Math.PI * 0.75 });

  // ---- the Hall of the Unseen (F2, east): a chasm across its middle under stones only the lens shows, the walker's
  // holding; an eye only the lens shows on a pillar out of the chasm, facing the far landing; on the far landing the
  // plate the Sounding Toe's sphere drops onto, and a sphere's groove past two plain prints and the walker's
  const UN = R0.unseen, U0 = UN.x0, Q0 = U0 + UN.near, Q1 = Q0 + UN.pit, uy = UN.ledge - UN.y;
  hall(UN, { floor: false, roof: false, doors: [{ side: 'w', w: D.w, h: D.h, y0: uy }, { side: 'e', w: D.w, h: D.h, y0: uy }] });
  // its roof, the hole in it under the Sounding Toe's (a little wider: their edges apart)
  K.both(M.wall, T(slabOf(rect(UN.x0 - 1.2 + Z, UN.z0 - 1.2 + Z, UN.x1 + 1.2 - Z, UN.z1 + 1.2 - Z), [{ x: S.b, z: S.z, r: S.hole + 0.15 }]), [0, UN.top + 0.8, 0]));
  K.corridor([R - 0.1, WZ], [UN.x0 - 1.2, WZ], F2 - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  K.slab(UN.x0, UN.z0, Q0, UN.z1, F2, uy);
  K.slab(Q1, UN.z0, UN.x1, UN.z1, F2, uy);
  K.both(M.dark, box(UN.pit, 1, UN.z1 - UN.z0, (Q0 + Q1) / 2, UN.y - 0.5, WZ));
  // the chasm's lips, broken rock hanging under the ledges' edges
  for (let i = 0; i < 12; i++) for (const [x, s] of [[Q0, 1], [Q1, -1]]) K.add(M.stone, T(new THREE.IcosahedronGeometry(0.9 + (i % 3) * 0.35, 0).scale(0.8, 1.6, 1.2), [x + s * 0.35, F2 - 1.4 - (i % 2) * 0.8, UN.z0 + 1.15 + i * 2.7], [0.3 * i, i, 0]));
  add(Pit, { room: 'unseen', min: [Q0, UN.y - 2, UN.z0 - 1], max: [Q1, F2 - 3, UN.z1 + 1] });
  // (issue #477) by the near ledge, the walker's print again through the lens, small, over a stone carrying the same:
  // the rule said where the chasm is, not only two rooms back in the Lens Chamber
  add(Mural, { id: 'hold', at: [U0 + 0.06, F2 + 3.2, WZ + 6.5], yaw: Math.PI / 2, size: 0.6 });
  add(LensStones, { id: 'br1', cells: STONES.map(([c, along, toes]) => ({ x: U0 + along, z: WZ + c, toes, real: toes === 3 })), y: F2, size: 3, a: [Q0, F2, WZ], b: [Q1, F2, WZ] });
  const EX = Q0 + 3, EZ = WZ - 8;
  K.both(M.wall, box(2.4, 7.6 + uy, 2.4, EX, F2 + (7.6 - uy) / 2, EZ));
  K.both(M.trim, box(2.8, 0.4, 2.8, EX, F2 + 7.8, EZ));
  add(Switch, { id: 's2', at: [EX + 1.85, F2 + 6.0, EZ], yaw: Math.PI / 2, size: 1.1, hidden: true });
  const FL = Q1 + 7;
  groove(FL, WZ - 8.6, FL, WZ + 8.6, F2);
  add(Ball, { id: 'ball4', a: [FL, F2 + 0.04, WZ - 8.6], b: [FL, F2 + 0.04, WZ + 8.6], r: 0.9 });
  for (const [id, t, toes, hidden] of [['pf1', 0.3, 2, false], ['p4', 0.62, 3, true], ['pf2', 0.9, 4, false]]) add(Plate, { id, at: [FL, F2, WZ - 8.6 + 17.2 * t], r: 1.0, print: toes, hidden, yaw: 0 });
  add(Plate, { id: 'pT', at: [S.b, F2, S.z], r: 1.4, print: 3, yaw: Math.PI / 2 });
  add(Door, { id: 'd4', at: [UN.x1 + 0.6, F2, WZ], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 's2' }, { drumOn: ['ball4', 'p4'] }, { drumOn: ['lift', 'pDown'] }] });
  for (const s of [-1, 1]) { K.column(UN.x1 - 1.4, WZ + s * 6.4, F2, 8, 0.6); K.both(M.stone, new THREE.SphereGeometry(0.85, 16, 10).translate(UN.x1 - 1.4, F2 + 8.85, WZ + s * 6.4)); }
  add(Mark, { room: 'unseen', at: [U0 + 3, F2, WZ - 9], yaw: Math.PI / 2 });
  for (let i = 0; i < 4; i++) K.glyph([Q0 + i * 6, F2 + 7 + (i % 2) * 2.5, UN.z1 - 0.05], 1.3, Math.PI);
  // the vault past the far door: the great key
  const VA = R0.vault;
  K.corridor([UN.x1 + 1.2, WZ], [VA.x1, WZ], F2 - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  K.wall(VA.x1 + 0.4, WZ + 4.6, VA.x1 + 0.4, WZ - 4.6, F2 - Z, 9.6, { t: 0.8 });
  K.glyph([VA.x1 - 0.05, F2 + 6.4, WZ], 1.2, -Math.PI / 2);
  add(Key, { id: 'kG', at: [VA.x1 - 3, F2, WZ], yaw: -Math.PI / 2, big: true });

  // ---- the last lift (south, F2 to F3): a landing on each floor, the disc riding up and down between them
  const LZ0 = WZ - R + 0.1, LZ1 = WZ - R - 4.4, LZ2 = WZ - R - 12;
  K.slab(-4.6, LZ1, 4.6, LZ0, F2 - 2 * Z, 0.8);
  K.slab(-4.6, LZ2, 4.6, LZ0, F3 - 2 * Z, 0.8);
  K.both(M.trim, box(9.2, 0.34, 0.3, 0, F2 - 2 * Z + 0.13, LZ1 + 0.15));   // (a kerb at the landing's edge)
  for (const s of [-1, 1]) K.wall(s * 4.6, WZ - R - 1.4, s * 4.6, LZ2, F3, F2 + 10 - F3, { t: 0.8 });
  K.wall(-4.6, LZ2 - 0.4, 4.6, LZ2 - 0.4, F3, F2 + 10 - F3, { t: 0.8 });
  K.both(M.wall, box(10, 0.8, LZ0 - LZ2 + 0.8, 0, F2 + 10.4, (LZ0 + LZ2) / 2));
  add(Platform, { path: [[0, F3, (LZ1 + LZ2) / 2], [0, F2, (LZ1 + LZ2) / 2]], r: 3.2, speed: 2.6, pause: 2 });

  // ---- F3: the great door, the antechamber, and the Echo's Hall (a round hall 40 m across); its three resonant spheres
  // on galleries round its wall, over the floor
  add(Door, { id: 'dG', at: [0, F3, WZ + R + 0.7], w: D.w, h: D.h });
  const H0 = WZ + R + 0.7;
  const AE = K.vestibule(H0, F3 - 2 * Z);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, F3, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 20, CH = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CH, y: F3, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0 });
  K.add(M.glyph, T(glyphGeometry(9, 0.05).rotateX(-Math.PI / 2), [0, F3 + 0.03, CH]));
  const GH = 6;   // (the galleries' floor over the hall's)
  const res = [0, 1, 2].map((i) => {
    const a = (i / 3) * TAU + Math.PI / 3, w = 0.24;
    K.both(M.floor, T(slabOf(ringShape(HR - 5.6, HR + 0.3, a - w, a + w, 72)), [0, F3 + GH, CH]));
    K.both(M.trim, T(slabOf(ringShape(HR - 5.9, HR - 5.6, a - w, a + w, 72), [], 0.5), [0, F3 + GH + 0.5, CH]));
    return add(Resonator, { i, at: [Math.sin(a) * (HR - 3.4), F3 + GH, CH + Math.cos(a) * (HR - 3.4)], face: [0, F3, CH], color: NOTES[i], onHit: (r, mode) => resonate(rt, r, mode) });
  });
  // the way out, past the far door
  const X0 = CH + HR + 0.7, X1 = CH + HR + 10;
  add(Door, { id: 'd5', at: [0, F3, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, F3, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, F3, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, F3, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, F3, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, F3 + 10.4, (X0 + X1) / 2));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, F3, X1 + 0.5]));
  K.solid(box(4, 5, 0.5, 0, F3 + 2.5, X1 + 0.9));

  const model = echoModel();
  model.pos.copy(K.world(0, F3, CH + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, F3, CH + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, F3, CH), r: HR, y: K.world(0, F3, 0).y };
  rt.resonators = res;

  // (the wing last: its mark after the others)
  lodge(rt, K, M);
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, F0 + 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-70, F3 - 12, -3), V(VA.x1 + 3, F0 + 24, X1 + 2)),
    gadget: { at: W(LE.x, F2 + 0.62, LE.z).toArray(), face: K.heading(Math.PI / 2) },
    // (the last way out, past the Echo, comes up at the keepers' stone by the white hill: KEEPERS_STONE)
    exits: [{ at: W(0, F0 + 0.5, 0.4), r: 1.5 }, { at: W(0, F3 + 0.5, X1 - 0.4), r: 1.5, to: V(KEEPERS_STONE.x, KEEPERS_STONE.y + 0.05, KEEPERS_STONE.z), heading: KEEPERS_STONE.heading }],
    lights: [[0, 7, 7, 16], [0, F0 + 9, WZ, 30], [-46, 9, WZ, 26], [LODGE.x, 8, LODGE.z, 22], [0, F1 + 6, WZ, 28], [0, F1 + 4, (PL.z0 + PL.z1) / 2, 26],
      [48, F1 + 8, WZ, 26], [0, F2 + 6, WZ, 28], [LE.x, F2 + 9, LE.z, 22], [40, F2 + 9, WZ, 24], [62, F2 + 9, WZ, 22], [VA.x1 - 4, F2 + 6, WZ, 12],
      [0, F3 + 6, WZ, 26], [0, F3 + 3, WZ + R - 1, 12], [0, F3 + 10, CH, 30]],
    guardian: { def: { ...ECHO, onHit: echoHit, onStrike: () => {} }, model, arena },
  };
}

/**
 * (v1.53, issue #23) The Keepers' Lodge, off the rim (F0, east, since v1.82: issue #401): an arena where the walker's
 * keepers rested, their stone benches by the walls; won, the small key's cage sinks (for the Hall of the Unseen's far
 * door). The house's one fight, 30 m square, its keepers round its middle among four columns. Its door, in the well's
 * wall, wants the eye under the rim's pier and the great sphere up.
 */
function lodge(rt, K, M) {
  const add = (P, o) => rt.add(P, o);
  const Lg = LODGE, LR = ROOMS.lodge, D = DOOR;
  K.hall({ x: Lg.x, z: Lg.z, w: Lg.w, d: Lg.d, y: LR.y, h: LR.top - LR.y, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h }] });
  K.corridor([WELL.r - 0.1, Lg.z], [LR.x0 - 0.6, Lg.z], LR.y - 2 * Z, { w: D.w, h: D.h + 2 * Z });
  add(Door, { id: 'dR', at: [WELL.r + 0.7, LR.y, Lg.z], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'sL' }, { drumOn: ['lift', 'pUp'] }] });
  for (const z of [LR.z0 + 0.9, LR.z1 - 0.9]) K.both(M.stone, box(12, 0.6, 1.0, Lg.x + 1, LR.y + 0.3, z));   // (benches)
  for (const s of [-1, 1]) K.both(M.stone, new THREE.SphereGeometry(0.7, 14, 8).translate(LR.x1 - 1.6, LR.y + 0.7, Lg.z + s * 4.6));
  for (const [x, z] of [[Lg.x - 7, Lg.z - 7], [Lg.x + 7, Lg.z - 7], [Lg.x - 7, Lg.z + 7], [Lg.x + 7, Lg.z + 7]]) K.column(x, z, LR.y, LR.top - LR.y, 0.9);
  add(Key, { id: 'kS', at: [Lg.x + 10, LR.y, Lg.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'lodge', at: [LR.x0 + 3, LR.y, Lg.z - 4], yaw: Math.PI / 2, foes: [Lg.x, LR.y, Lg.z] });
}
// ------------------------------------------------------------------ outside: the Footprint in the meadow
function exterior(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const yaw = SITE.heading;
  const y0 = H(SITE.x, SITE.z);
  const K = new TempleKit(rt.root, 'The Footprint', V(SITE.x, y0, SITE.z), yaw, rt.M);
  const M = rt.M;
  // the print: a heel round the sphere and three long toes reaching back (local -z), each outlined by a low white rim
  const R = 18;   // the heel-sphere's radius
  const toes = [[-0.55, 54, 9], [0, 64, 10], [0.55, 54, 9]];   // [angle off -z, length, width]
  const rim = [], pads = [];
  const ringPts = (cx, cz, rx, rz, n = 40) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return [cx + Math.sin(a) * rx, cz + Math.cos(a) * rz]; });
  const outline = (pts) => {
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const gy = H(...K.world(mx, 0, mz).toArray().filter((_, k) => k !== 1)) - y0;
      rim.push(T(new THREE.BoxGeometry(1.4, 1.6, L + 0.3), [mx, gy + 0.5, mz], [0, Math.atan2(bx - ax, bz - az), 0]));
    }
  };
  outline(ringPts(0, -4, R + 9, R + 7));
  for (const [a, len, w] of toes) {
    const pts = [];
    const dir = [Math.sin(a + Math.PI), Math.cos(a + Math.PI)], side = [dir[1], -dir[0]];
    const base = [dir[0] * (R + 4), dir[1] * (R + 4) - 4];
    for (let i = 0; i <= 10; i++) { const k = i / 10, ww = w * (1 - k * 0.55); pts.push([base[0] + dir[0] * len * k + side[0] * ww, base[1] + dir[1] * len * k + side[1] * ww]); }
    for (let i = 10; i >= 0; i--) { const k = i / 10, ww = w * (1 - k * 0.55); pts.push([base[0] + dir[0] * len * k - side[0] * ww, base[1] + dir[1] * len * k - side[1] * ww]); }
    outline(pts);
    pads.push({ a, len, w, base, dir });
  }
  for (const g of rim) K.both(M.stone, g);
  // The broad rounded heel and lobed roots are built with the landmark. Keep
  // the same human doorway, without the old small porch protruding through it.
  // (the drawing's framed doorway in the heel: three teal frames stepping out of the heel, pale light: src/temples/portal.js)
  const P = portal(K, { y: 0.6, z: 16.4, w: 4.6, h: 8.4, shape: 'rect', layers: 3, step: .9, recess: .8, back: 2.3, into: 2.5,
    frame: lmCeramic('#73c7b8'), inlay: '#d8f3ff', sill: { d: 5.2 } });
  for (let i = 0; i < 9; i++) {
    const a = 0.2 + i * 0.075, r = R + 7.5 + i * 0.9, x = Math.sin(a) * r * 0.6 + 2 + i * 1.4, z = R + 8.4 + i * 2.6;
    const gy = H(...K.world(x, 0, z).toArray().filter((_, k) => k !== 1)) - y0;
    K.add(M.floor, box(2.6, 0.25, 2.2, x, gy + 0.1, z, a));
  }
  K.both(M.floor, box(12, 1.2, 9, 0, 0, R + 3));
  const foot=K.world(0,0,R+14);
  K.stairs([0,.6,R+7.5],[0,H(foot.x,foot.z)-y0+.08,R+14],16,{rise:.24,sides:false});
  const lens = glazing('#edc478', landmarkFrame(K,'spheres',.6).world(0,35.6,2));
  const landmarkTop = landmark(K, 'spheres', { y: 0.6, R, glass: lens });
  K.flush();
  glaze(K, rt.veils, lens, {color:'#efa72f',alpha:.64,glow:.25});
  const at = K.world(0, 0.6, 17.4);
  const front = K.world(0, 0, R + 9);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base: y0, doorY: y0 + 0.6, R, pads, top: y0 + landmarkTop,
    clear: [{ x: SITE.x, z: SITE.z, r: 80 }, ...pads.map((p) => { const c = K.world(p.base[0] + p.dir[0] * p.len * 0.5, 0, p.base[1] + p.dir[1] * p.len * 0.5); return { x: c.x, z: c.z, r: p.len * 0.55 }; }), { x: front.x, z: front.z, r: 38 }] };
}

// ------------------------------------------------------------------ the world change: the Footprint fills, the spheres ring
/**
 * Once the Echo is calm: the Footprint's toes and heel fill with still water
 * (pale, glowing a little at night), and every sphere in the garden wears a
 * ring of the glyph's light at its foot, breathing slowly, in step.
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The Footprint’s water, the spheres’ rings (the world change)';
  scene.add(root);
  root.visible = false;
  const O = rt.outside, H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const water = makeMaterial({ color: '#bfe0e2', glow: 0.25, flat: true, side: THREE.DoubleSide, key: 'temple.spheres.water' });
  if (O) {
    const K = O.kit, geos = [];
    for (const p of O.pads) {
      // each toe's floor of water: a strip of quads following the ground
      for (let i = 0; i < 10; i++) {
        const k0 = i / 10, k1 = (i + 1) / 10, w0 = p.w * (1 - k0 * 0.55) - 1.2, w1 = p.w * (1 - k1 * 0.55) - 1.2;
        const side = [p.dir[1], -p.dir[0]];
        const pts = [[k0, -w0], [k0, w0], [k1, -w1], [k1, w1]].map(([k, w]) => {
          const lx = p.base[0] + p.dir[0] * p.len * k + side[0] * w, lz = p.base[1] + p.dir[1] * p.len * k + side[1] * w;
          const wp = K.world(lx, 0, lz);
          return [wp.x, H(wp.x, wp.z) + 0.35, wp.z];
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0], ...pts[2], ...pts[1], ...pts[1], ...pts[2], ...pts[3]], 3));
        g.computeVertexNormals();
        geos.push(g);
      }
    }
    const pools = new THREE.Mesh(mergeGeometries(geos), water);
    pools.userData.noCollide = true;
    root.add(pools);
  }
  // a ring of light round the foot of every sphere in the garden
  const ringM = makeMaterial({ color: '#a8e6ee', glow: 0.6, flat: true, key: 'temple.spheres.rings' });
  const rings = [];
  for (const o of level.spheres?.orbs ?? []) {
    const gy = H(o.x, o.z);
    const r = Math.sqrt(Math.max(0.5, o.R * o.R - (gy - o.y) ** 2)) + 0.6;
    rings.push(new THREE.TorusGeometry(r, 0.14, 4, Math.max(16, Math.round(r * 4))).rotateX(Math.PI / 2).translate(o.x, gy + 0.2, o.z).toNonIndexed());
  }
  if (rings.length) {
    const m = new THREE.Mesh(mergeGeometries(rings.map((g) => { g.deleteAttribute('uv'); return g; })), ringM);
    m.userData.noCollide = true;
    root.add(m);
  }
  let k = 0, want = 0;
  return {
    root,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; root.visible = k > 0.01; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 6);
      root.visible = k > 0.01;
      if (!root.visible) return;
      ringM.uniforms.uGlow.value = (0.35 + 0.35 * Math.sin(t * 0.6)) * k;
      water.uniforms.uGlow.value = 0.2 * k;
      // the Echo's own resonators, inside, hum in turn
      if (rt.resonators && rt.logic.resolved) rt.sing = Math.floor(t * 0.5) % 3;
    },
  };
}

export const SPHERES_TEMPLE = {
  id: 'spheres', levelId: 'spheres', name: 'The Footprint', doorLabel: 'door in the Footprint’s heel',
  gadget: 'monocle', gadgetBox: 'spheres.temple.lens', arenaDoor: 'dG', arenas: ARENAS,   // (the box's id from when it held the glyph lens: the saves' flag)
  origin: [-120, 2000, -260], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  skin: footprintSkin,   // (its look inside: src/temples/skins/footprint.js, issue #342)
  local: { person: 'tessa', out: 12, side: 7 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the heel it is white and round and very quiet, the kind of quiet a sphere keeps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the Footprint fills, and every sphere wears a ring of light.', 'resolved.out'); },
  // the Echo sings a note (one of the three spheres) whenever it opens
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const enter = G.enter.bind(G);
    // (its last phase: three notes at once, all three spheres glow; the walker's print, through the lens, on the one)
    G.enter = (state) => { enter(state); if (state === 'open') { rt.sing = Math.floor(Math.random() * 3); rt.singAll = G.phaseIndex >= 2; } else if (!rt.logic.resolved) { rt.sing = -1; rt.singAll = false; } };
    rt.sing = -1; rt.singAll = false;
  },
};
