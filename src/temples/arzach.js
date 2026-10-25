import { landmark, landmarkFrame } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, sector } from './kit.js';
import { Door, Ball, Plate, Gust, Updraft, WingAir, Platform, Mark, Pit, Key, Coffer } from './pieces.js';
import { elderGuardian } from './guardian-generated.js';
import { items } from '../items.js';
import { shiftAt } from '../levels/names.js';
import { chestMound } from '../boxes/mound.js';
import { aerieSkin } from './skins/aerie.js';

// Vael's temple: the Aerie, a great white house of the makers on the plain
// west of the landing, two drums of bone-white stone and a crown of stone
// wings on top. It is where the makers gave Vael's great birds their wings;
// the birds were raised in its roost. The oldest of them, the Elder, so old
// her feathers have gone to stone, kept the house. The night the light went
// over she stopped flying, and the others left, and she stayed.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: ONE WIND, AND IT COMES
// OUT WHEREVER NO STONE STOPS IT (reworked from the temple design audit, v1.16). The makers' wind comes up from
// under the house; a stone ball rolled into a vent's mouth stops it there, and it comes out of another. On foot
// the wind is in your way; with the wings it carries you.
//   the Threshold        the first mark, the way out
//   the Hall of Winds    gusts blow down it out of the vent in its far mouth and shove you back: wait them out
//                        behind the stone screens, screen to screen
//   the Long Passage     (v1.83, issue #407) a narrow way 38 m long from the hall to the well, a grate in its floor
//                        under a round shaft in its roof: the Fledgery's hole, straight above
//   the Wind Well        the hub, and the house's great hall (v1.83, issue #407: 62 m across, its three floors seen at
//                        once): a tall round shaft open to the sky through a crown of stone feathers, bands of
//                        ochre, glyph lines up its walls like the lines on a wing. Its air is still: the stone sits
//                        in the floor's vent. Roll it along its groove into the hall's vent (behind you: its throat a
//                        grate in the middle of the hall's floor since v1.77) and the hall falls calm, and the wind rises up the well, and the feather
//                        raft by the east wall rides up on it to the Feather Gallery, a ring round the well 16 m up
//                        (since v1.49, issue #23, the well is a stack, rooms off it at its foot and up its height:)
//   the Fledgery         (v1.83, issue #407: south off the gallery, over the Long Passage) where the young birds were
//                        let fall for their first flight. A stone in a groove that ends at a hole in its floor: rolled
//                        in, it drops down the shaft onto the passage's grate, and the wind that breathed out there
//                        lifts the Wing Chamber's shutter (dW) instead. The Fledging Sill, on the gallery: a marked
//                        drop back to the well's floor, onto the makers' breath (Cushion), which takes the fall
//   the Moult            (west off its floor, an arena) where the birds raised here shed their first stone feathers.
//                        Its door onto the well is shut from the other side: the way in is from above, down the
//                        Eyrie's vent (since issue #23's last round, below), a well 9 m across since v1.83 (#407): from
//                        the Eyrie's ledge you look down it onto the Moult's floor, its key's cage, before you go in.
//                        Won, the small key's cage sinks and the door onto the well lets go
//   the Wing Chamber     (east off the gallery, behind its shutter) the makers' chest: the FLUID WINGS (src/items.js
//                        'glider'). Step back out onto the gallery and into the column of wind: it lifts open wings, round and up, and lets them go
//                        just over the balcony (v1.74, issue #23 round 6: the catch). The well's floor has a second
//                        vent by the Moult's door, its stone beside it: while it is open, half the wind breathes out
//                        of it there. Glide down, roll its stone into its throat, and the whole wind rises up the
//                        well, to the high balcony over it, the great carved eye beside it (the wind you sent, a room
//                        away)
//   the Vent Hall        (v1.77, north off the high balcony) the gulf vent's throat, a grate in the middle of its
//                        floor, its stone in it; the way north off it wants the small key
//   the Eyrie            (west at the high balcony's height, along a ledge round the well's wall) two vents and one
//                        stone, both throats on its ledge: the stone starts in the throat of the vent at the foot of
//                        the gap, so the wind comes out of the ledge's own, a column beside a shelf with a coffer;
//                        the great key's perch six metres over the ledge across the gap, out of a glide's reach.
//                        Roll the stone into the other throat: the ledge's column dies, and the wind rises out of the
//                        gap's foot past the perch (the Roost's lesson, a house early). The Roost's door's key.
//                        The vent at the gap's foot is a shaft down into the Moult: while the stone stops it (as it
//                        starts) its air is still and you glide down it, into the arena; won, its door lets you out
//                        onto the well's floor, and the raft and the column take you up again. A circuit round the
//                        stack, flown down and ridden up, its way decided by where the one stone sits
//   the Gulf             two crossings, each on a wind you send. Forty-six metres of nothing to a stone perch
//                        four lower: on still air no glide carries so far. A vent's mouth over the door, its stone
//                        in the throat in the Vent Hall's floor: push it out and the wind pours out over the gulf in
//                        gusts; leap as one comes, and it carries your wings to the perch (the gust that shoved you
//                        back in the hall, with the wings and the push). Then a ledge six metres HIGHER than the
//                        perch: no glide climbs. A vent far below beside the perch, its throat on the perch with
//                        its stone in it: push it out and a column rises past the perch, and lifts you (the well's
//                        lesson, from a perch over nothing). Neither crossing comes back: a doorway in the higher
//                        ledge's east wall drops into a passage outside the gulf, back along it and up onto the near
//                        lip (since issue #275: over there without the great key, nothing took you back)
//   the Roost            the guardian (organic: you calm her): the Elder, under the open sky. Two vents in its floor
//                        and one stone: in one, the wind rises from the other. When she spreads her wings and looks
//                        up, afraid, ride the wind beside her; she will not fly alone. In the wind her wings lift
//                        twice as high (her second phase); in her last, only the wind will do: roll the stone so
//                        the wind rises by her, then ride it up beside her
// After: the Elder sits on the Aerie's crown with her wings open, and the great birds wheel over it again.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the plain west of the landing; its door looks east, back toward the landing (Vael's own coordinates, moved to where its plain lies now: names.js PART_OFFSET). */
const [SX, SZ] = shiftAt('arzach', [-220, -20]);
export const SITE = { x: SX, z: SZ, r: 18, path: shiftAt('arzach', [-180, -12]) };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

/**
 * The Aerie's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/aerie):
 * warm ivory in tall smooth panels, banded in ochre (a band under every frieze and one low), the frames ochre, a long
 * feather carved under every frieze, the glyphs ochre-gold; its shade a peach-rose that keeps the ivory warm, its light
 * warm.
 */
export const PALETTE = {
  wall: '#f3e7d3', wall2: '#eee0c8', wall3: '#f8efe0', floor: '#ecdcc2', floor2: '#e0cfb2', trim: '#dc9e44',
  dark: '#4a4a5e', stone: '#efe3d0', accent: '#b98f9a', glow: '#7cc1c4', glyph: '#d0903a', lamp: '#f6c84e', sand: '#f0dcc0', sand2: '#e3bf9c', void: '#34405e',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.85, shade: 0.55, hatch: 0.5 },
    wall: { mode: 0 },
    glyph: { glow: 0.25 },
  },
  bands: [{ at: 0.72, h: 0.9, color: '#e2a446' }, { at: 0.3, h: 0.45, color: '#e2a446' }],
  ornament: { kind: 'feather', color: '#eadcc4', color2: '#c98f3a' },
  light: { shadow: '#dcb4aa', light: '#fff3e0', sun: '#ffe2b8' },
};

export const LOGIC = {
  id: 'arzach', entry: 'threshold', gadget: 'glider',
  // (v1.77, issue #336: each room tagged with its kind, docs/design/temple-redesign.md; the Moult is the house's one fight)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, gusts: { checkpoint: true, kind: 'puzzle' }, well: { checkpoint: true, kind: 'puzzle' },
    // (v1.83, issue #407: the Feather Gallery round the well 16 m up, the great hall's middle floor; the Fledgery off it)
    gallery: { checkpoint: true, kind: 'passage' }, fledge: { checkpoint: true, kind: 'puzzle' },
    wings: { checkpoint: true, kind: 'chest' }, top: { checkpoint: true, kind: 'puzzle' }, moult: { checkpoint: true, kind: 'combat' },
    eyrie: { checkpoint: true, kind: 'puzzle' }, eyrieKey: { kind: 'passage' }, gulf: { checkpoint: true, kind: 'passage' }, perch: { checkpoint: true, kind: 'puzzle' },
    gulfFar: { checkpoint: true, kind: 'passage' }, gulfWay: { kind: 'passage' }, roost: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'gusts' },
    { a: 'gusts', b: 'well' },                                          // through the gusts, screen to screen
    // the well is a stack (v1.49, issue #23): a room off it at its foot, the chest's at 16 m, the high balcony at 32 m and a
    // room off that. The Moult, west off its floor, an arena: the small key; the Eyrie, west off the high balcony: two
    // winds and one stone, the great key
    { a: 'well', b: 'moult', door: 'dM' },                              // (shut till the Moult is won: its way out, onto the well's floor)
    { a: 'well', b: 'gallery', door: 'raft' },                          // the feather raft rides up on the well's wind
    // (v1.83, issue #407) the Fledging Sill: a marked drop off the gallery onto the makers' breath, back to the hub
    { a: 'gallery', b: 'well', oneWay: true },
    { a: 'gallery', b: 'fledge' },
    { a: 'gallery', b: 'wings', door: 'dW' },                           // the Wing Chamber's shutter, lifted by the wind
    // the column (the raft's wind) lifts only open wings, and up to the high balcony only once the floor's second vent is
    // stopped (v1.74, issue #23 round 6: until then it lets you go just over the chest's balcony, and you ride it again from
    // the floor, where its stone is; it was { a: 'wings', b: 'top', needs: ['glider'] }, the audit's most obvious step)
    { a: 'well', b: 'top', door: 'column', needs: ['glider'] },
    { a: 'top', b: 'eyrie' },                                           // along the ledge round the well's west wall
    { a: 'eyrie', b: 'eyrieKey', door: 'lift', needs: ['glider'] },     // over the gap and up to the great key's perch, on the column out of its foot
    // (issue #23, the last round: the Moult is entered from above, down the shaft of the vent at the gap's foot while its
    // stone stops it, and left by its door onto the well's floor: a circuit round the stack, its way the one stone's)
    { a: 'eyrie', b: 'moult', door: 'chute', needs: ['glider'], oneWay: true },
    { a: 'top', b: 'gulf', door: 'dG' },                                // the way north off the balcony: the small key
    // (the Gulf's crossings go one way: no glide comes back 46 m to a lip four metres higher, nor up to the higher ledge.
    // Issue #275: over there without the great key you were stranded; the way back is the passage outside its east wall,
    // tests/way-back.test.js)
    { a: 'gulf', b: 'perch', door: 'tail', needs: ['glider'], oneWay: true },   // the Gulf: too far on still air, carried by the vent's gusts
    { a: 'perch', b: 'gulfFar', door: 'rise', needs: ['glider'], oneWay: true },   // to a ledge higher than the perch: lifted by the column beside it
    // (v1.74: no link back down onto the perch from the higher ledge. A glide does it, but nothing is there to go back for,
    // and it is no way back: that is the passage. The audit counted it as a step, and the house's most obvious)
    { a: 'gulfFar', b: 'gulfWay', oneWay: true },                       // the way back: off the sill in the ledge's east doorway, down into the passage
    { a: 'gulfWay', b: 'gulf' },                                        // along it under the gulf's wall, and up its stairs onto the near lip
    { a: 'gulfFar', b: 'roost', door: 'd3' },
    { a: 'roost', b: 'out', door: 'd5' },
  ],
  elements: {
    // the hall's stone: pushed up the hall through the gusts into its vent (pH), the hall falls calm and the wind rises in the well
    ballW: { type: 'drum', room: 'gusts', plate: 'pH', plateAt: 1, start: 0 },
    pH: { type: 'plate', room: 'gusts' },
    raft: { type: 'door', opens: { drumOn: ['ballW', 'pH'] } },
    // (v1.83, issue #407) the Fledgery's stone: rolled into the hole at its groove's end, it drops down the shaft onto the
    // grate in the Long Passage's floor below (pD, under the room: `through` the floor, no door), and the wind that
    // breathed out there lifts the Wing Chamber's shutter instead
    bD: { type: 'drum', room: 'fledge', plate: 'pD', plateAt: 1, start: 0, through: 'hole' },
    pD: { type: 'plate', room: 'fledge' },
    dW: { type: 'door', opens: { drumOn: ['bD', 'pD'] } },
    // (v1.74) the well floor's second vent, by the Moult's door: its stone beside it; while its throat is open half the
    // wind breathes out there, and the column lets open wings go just over the chest's balcony
    bF: { type: 'drum', room: 'well', plate: 'pF', plateAt: 1, start: 0 },
    pF: { type: 'plate', room: 'well' },
    column: { type: 'door', opens: { drumOn: ['bF', 'pF'] } },
    chest: { type: 'gadget', room: 'wings', item: 'glider' },
    // the Gulf's vent: its throat a grate on the high balcony, its stone in it (pB); rolled out to the cup (pX), the wind pours over the gulf
    ballB: { type: 'drum', room: 'top', plate: 'pB', plateAt: 0, stops: { pB: 0, pX: 1 }, start: 0 },
    pB: { type: 'plate', room: 'top' },
    pX: { type: 'plate', room: 'top' },
    tail: { type: 'door', opens: { not: { drumOn: ['ballB', 'pB'] } } },
    // the perch: the column's stone in its throat (pP); rolled out to the cup (pQ), the wind rises beside the perch
    ballP: { type: 'drum', room: 'perch', plate: 'pP', plateAt: 0, stops: { pP: 0, pQ: 1 }, start: 0 },
    pP: { type: 'plate', room: 'perch' },
    pQ: { type: 'plate', room: 'perch' },
    rise: { type: 'door', opens: { not: { drumOn: ['ballP', 'pP'] } } },
    // the Moult: its keepers beaten, the small key's cage sinks, and its door onto the well lets go (shut from the other side
    // till then: the way in is down the Eyrie's vent)
    arM: { type: 'arena', room: 'moult' },
    kM: { type: 'key', kind: 'small', room: 'moult', when: { lit: 'arM' } },
    dM: { type: 'door', opens: { lit: 'arM' } },
    // the Eyrie: two vents and one stone, both throats on its ledge (the Roost's lesson, a house early). The stone starts in
    // the gap-vent's throat (pU): the wind comes out of the ledge's own vent, a column beside the coffer's shelf. Rolled into
    // that vent's throat (pC), the ledge's column dies and the wind comes out of the vent at the gap's foot instead, a
    // column past the great key's perch, six metres over the ledge
    bE: { type: 'drum', room: 'eyrie', stops: { pU: 0, pC: 1 }, start: 0 },
    pU: { type: 'plate', room: 'eyrie' },
    pC: { type: 'plate', room: 'eyrie' },
    // (v1.74, issue #23 round 6) and the wind comes up that vent's shaft out of the Moult: while the Moult's door onto the
    // well is shut, the shaft has nothing to breathe, and the column past the perch is still. So the Moult is won first:
    // down the still shaft, out by its door, up again, and the stone into the other throat
    lift: { type: 'door', opens: { all: [{ drumOn: ['bE', 'pC'] }, { open: 'dM' }] } },
    chute: { type: 'door', opens: { drumOn: ['bE', 'pU'] } },          // the vent's shaft, still while its stone stops it: a way down
    kE: { type: 'key', kind: 'big', room: 'eyrieKey' },
    dG: { type: 'door', lock: 'small' },
    d3: { type: 'door', lock: 'big' },                                   // the great key's door (and the arena's: it shuts behind you)
    // the Roost: two vents, one stone (the west, pRW, or the east, pRE): the wind rises from the other
    ballR: { type: 'drum', room: 'roost', plate: 'pRW', plateAt: 0, stops: { pRW: 0, pRE: 1 }, start: 0 },
    pRW: { type: 'plate', room: 'roost' },
    pRE: { type: 'plate', room: 'roost' },
    elder: { type: 'boss', room: 'roost', needs: ['gun', 'glider'] },
    d5: { type: 'door', opens: { resolved: true } },
    // (optional, so last: the marker never points at it) the coffer on the shelf over the Eyrie's door, beside the ledge's
    // own column, as its stone starts
    cache: { type: 'cache', room: 'eyrie' },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    // Optional map display beside the Fledgery approach, clear of its ball and shaft. Its `at` is set below.
    map: { type: 'map', room: 'fledge', yaw: Math.PI / 2, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
  },
};

export const ELDER = {
  kind: 'organic', name: 'the Elder', final: 'touch', touch: 'lay a hand on her neck',
  speed: 1.6, wakeTime: 3.2,
  wake: 'A great bird of stone-white feathers unfolds from the floor, hissing.',
  openHint: 'She looks up at the open sky, trembling: open your wings near her.',
  weary: 'She folds her wings and settles. Go to her.',
  resolved: 'The Elder opens her wings and rides the wind up out of the roost.',
  missHint: 'Her beak is caught in the floor: open your wings beside her.',
  // (v1.70, issue #319, made fair as the Keeper was: a longer breath between her moves, every move ending in an
  // opening, a combo's blows 1.4 s apart at least; each blow lands with her body or with what she draws of it: the peck
  // with her beak brought down to you (src/characters/elder-v3-creature.js ELDER_POSE), the stamp with her feet and the
  // shock round them, the dive with her body where it comes down, the buffet and the gale with the wind of her wings,
  // a front running out over the floor (boss.js Blast), never a floor 15 m off her that nothing drew)
  phases: [
    { to: 0.45, attacks: ['peck', 'stamp', 'buffet'], pause: 2.2, hint: 'When she looks up, afraid, open your wings beside her.' },
    { to: 0.75, attacks: ['buffet', 'dive', 'gale'], pause: 1.9, hint: 'When she hangs over a vent, ride its wind up beside her.' },
    // (aloft in her last phase she pecked from 3.5 m up, a blow that could only land 8 m off on the floor: now she
    // dives instead, beak first, where her body comes down)
    { to: 0.9, attacks: ['feathers', 'dive', 'gale'], pause: 1.7, hint: 'Push the stone into the vent away from her. Ride the wind up by her.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    peck: { shape: 'lane', range: 8, width: 2.4, wind: 1.2, track: 0.7, part: 'mouth', rig: 'lean', parts: ['mouth'], splash: 0.3, active: 0.35, reach: 4.6, damage: 0.5, knock: 8, recover: 0.6, gap: 0.75, then: 'peck2' },
    peck2: { shape: 'lane', range: 8, width: 2.4, wind: 0.65, track: 0.6, part: 'mouth', rig: 'lean', pose: 'peck', link: true, parts: ['mouth'], splash: 0.3, active: 0.35, reach: 4.6, damage: 0.5, knock: 8, gap: 0.3, then: 'buffetEnd' },
    buffet: { shape: 'cone', range: 9, angle: 0.8, wind: 1.3, track: 0.6, part: 'wings', rig: 'lean', blast: { kind: 'front', r0: 2, h: 2.2 }, reach: 8.5, damage: 0.5, knock: 13, recover: 0.7, open: 2.0 },
    buffetEnd: { shape: 'cone', range: 9, angle: 0.8, wind: 1.1, track: 0.5, part: 'wings', rig: 'lean', pose: 'buffet', link: true, blast: { kind: 'front', r0: 2, h: 2.2 }, reach: 8.5, damage: 0.5, knock: 13, recover: 0.8, open: 4.2 },
    stamp: { shape: 'ring', at: 'self', radius: 4.5, wind: 1.4, part: 'feet', rig: 'rear', parts: ['feet'], splash: 0.6, active: 0.4, blast: { kind: 'front', r0: 0.5, h: 0.6 }, reach: 4.2, damage: 0.75, knock: 10, recover: 0.8, open: 4.2 },
    // (a dive that misses you drives her beak into the floor: she is stuck there longer, missHint; ROOST.miss on top)
    dive: { shape: 'ring', at: 'player', radius: 4, wind: 1.6, track: 0.6, over: true, part: 'mouth', rig: 'rise', parts: ['body'], splash: 0.4, active: 0.45, damage: 0.75, knock: 9, recover: 0.9, open: 4.2, miss: 5.6 },
    gale: { shape: 'lane', range: 18, width: 4.5, wind: 1.3, track: 0.6, part: 'wings', rig: 'swell', pose: 'buffet', blast: { kind: 'front', r0: 2, h: 2.6 }, active: 0.9, damage: 0.5, knock: 16, recover: 0.7, then: 'diveEnd' },
    diveEnd: { shape: 'ring', at: 'player', radius: 4, wind: 1.2, track: 0.6, over: true, part: 'mouth', rig: 'rise', pose: 'dive', link: true, parts: ['body'], splash: 0.4, active: 0.45, damage: 0.75, knock: 9, recover: 0.9, open: 4.2, miss: 5.6 },
    feathers: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'wings', rig: 'swell', pose: 'buffet', damage: 0.5, knock: 6, recover: 0.7, open: 1.6 },
  },
};

/**
 * The Roost's vents: x of each from the middle (m); flying beside her: how near (m, level) and how long (s) a ride
 * takes; what one ride is worth in the wind and out of it, phase by phase (in her last, out of the wind: nothing);
 * how long she hangs there, looking up, in her last two phases (s: time to roll the stone and ride up); aloft, how near
 * the nearer vent she drifts (m) and how fast (m/s).
 */
/**
 * The Gulf: the first leg (m, lip to perch) too far for a glide on still air and short enough with the tailwind
 * (carry, m/s, while it blows); the perch's radius and height; the second leg up to a ledge higher than the perch;
 * the column beside the perch (its x and top).
 */
export const GULF = { leg1: 46, perchR: 5.2, perchY: 28, leg2: 16, farY: 34, carry: 10, column: 8, top: 46, stone: [-1.4, 2.6], half: 15,
  // the way back (issue #275: over on the higher ledge without the great key, nothing took you back across): a doorway in
  // the gulf's east wall off the higher ledge (`far` m along it), onto a sill over a passage outside the wall, `drop` m
  // down (no jump climbs it: a way back only); the passage runs back along the wall, `y` its floor, `x` its width, and
  // stairs at its end climb to a doorway onto the near lip (`near` m along it), beside the door you came in by
  // (v1.77: the gulf 30 m across, `half` each side of its middle; it was 22)
  way: { door: 3, near: 3, far: 6, y: 27, x: [16.2, 20.2], stairs: 11.6 } };
/**
 * The high balcony over the well: how far it reaches out from the wall (m); the gulf vent's stone's groove (x: its throat,
 * pB, and its cup, pX), on the balcony until v1.77 and in the middle of the Vent Hall beyond it since. The perch's stone's
 * groove across the perch is GULF.stone. (Issue #275: both grooves ran from near an edge, with a stride of floor behind
 * the stone, over the dark: tests/ball-room.test.js.)
 */
export const BALCONY = { depth: 21, groove: [-3.6, 3.6] };   // (v1.83: 21 m out over the 62 m well, to 10 m from its middle)
/** (v1.74) The Wind Well floor's second vent (local m off the well's middle, its groove along z) and how high the column rises while it breathes. */
export const WELL_VENT = { x: -16, z0: -2, z1: 4.5, low: 17.5 };
export const ROOST = { vent: 8, near: 12, ride: 0.7, wind: [0.15, 0.3, 0.075], still: [0.15, 0.15, 0], open: [null, 5.2, 6.6], miss: 1.4, over: 4.5, drift: 3 };
/** Is p (the traveller) in the wind out of one of the roost's vents? */
const inWind = (rt, p) => !!rt.roostWinds?.some((w) => w.contains(p));
/** How long she hangs open: her phase's hang aloft at least; a dive that missed (her beak stuck) ROOST.miss longer. */
export function elderOpenFor(g, a, s, missed = false) {
  const o = ROOST.open[Math.min(g.phaseIndex, 2)];
  const base = s && o ? Math.max(s, o) : s;
  return missed && base ? Math.max(base, (o ?? 0) + ROOST.miss) : base;
}

/**
 * (v1.83, issue #407) The makers' breath under the Fledging Sill: fall over it from any height and it takes the fall in the
 * last metres (SILL: slowed to `slow` m/s, from `over` m up or a few frames of the fall, whichever is more), a rush of
 * wind, nothing hurt; the Footprint's pools (spheres.js Catch) done with the Aerie's wind. o: { at: [x, y, z] its foot
 * (local), r, said }
 */
export class Cushion {
  constructor(rt, o) { this.rt = rt; this.o = o; this.at = rt.kit.world(...(o.at ?? [0, 0, 0])); this.on = false; }
  update() {
    const P = this.rt.player;
    if (!P?.pos) return;
    const c = this.at;
    const over = Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < this.o.r + 0.5 && P.pos.y > c.y - 1.5 && P.pos.y < c.y + 60;
    if (over && !P.onGround && !P.dead && P.vel.y < -SILL.slow) {
      this.on = true;
      if (P.pos.y - c.y < Math.max(SILL.over, -P.vel.y * 5 / 60)) P.vel.y = -SILL.slow;
      return;
    }
    if (this.on && (P.onGround || !over || P.dead)) {
      this.on = false;
      if (P.onGround && over) { this.rt.sound?.whoosh?.(); this.rt.notice?.(this.o.said, 'arzach.sill'); }
    }
  }
}

function elderHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.04, 'push'); g.rt.notice('She flinches from the shove and hisses, more frightened.', 'elder.push'); return true; }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  g.rt.notice('The fluid beads on her feathers. It is the wind she wants.', 'elder.fluid');
  return true;
}

// ------------------------------------------------------------------ the rooms as shrines (v1.77, issue #336)
/**
 * The house's rooms (local m) since it was redone to the redesign's rules (docs/design/temple-redesign.md): every puzzle
 * room 30 m across or more under 16 m and more, every door between two rooms 7 by 9 (DOOR), each puzzle in the middle of
 * its room. The Hall of Winds 30 by 66 (its stone's groove as long as it was, down its middle, the vent's throat at its
 * end and its mouth over the far door); the Wind Well a round hall 36 m across and 50 high (the hub, its rooms off it at
 * its foot and up its height); the Wing Chamber's round hall 26 m (the chest's); the Vent Hall north of the high balcony
 * 30 m square under 18 (the gulf vent's stone in its middle: it was on the balcony, against the well's wall); the Moult
 * and the Eyrie 30 m square, one over the other west of the well.
 */
export const DOOR = { w: 7, h: 9 };
export const HALL = { z0: 12.6, d: 66, w: 30, h: 18, groove: [26.8, 64.6], screens: [22, 31.4, 40.8, 50.2, 59.6, 69] };
/**
 * (v1.83, issue #407, the temple best practices' G4: one great hall, 60 m or more, several floors seen at once, with narrower
 * passages between) The Long Passage from the Hall of Winds to the well (m), and the Wind Well 62 m across (it was 36): its
 * floor, the Feather Gallery round it 16 m up (`gallery`: its floor's height and its width from the wall), the high balcony
 * at 32; the raft rises beside the gallery's inner edge. SHIFT: how far west the stack's rooms moved with the well's wall.
 */
export const PASSAGE = { len: 38 };
export const WELL = { z: HALL.z0 + HALL.d + PASSAGE.len + 31, r: 31, h: 50, gallery: { y: 16, w: 7 } };
WELL.raft = WELL.r - WELL.gallery.w - 2.5;
const SHIFT = WELL.r - 18;
export const WING = { r: 13, h: 16 };
export const TOP = { z0: WELL.z + WELL.r + 4, w: 30, d: 30, h: 18 };
TOP.z = TOP.z0 + TOP.d / 2;
/**
 * (v1.83, issue #407) The Fledgery, south off the gallery over the Long Passage: its room (z0..z1 at the gallery's height),
 * its stone's groove (x, from a to b, b over the hole) and the hole (half its side), straight over the grate in the
 * passage's floor. The Fledging Sill: where on the gallery (the angle round the well, 0 north) the marked drop is, and the
 * makers' breath under it on the well's floor (its distance from the well's middle, its radius).
 */
export const FLEDGE = { z1: WELL.z - WELL.r - 4, w: 30, d: 30, h: 18, x: -1.8, a: 8.6, b: -5.6, hole: 1.6 };
FLEDGE.z0 = FLEDGE.z1 - FLEDGE.d; FLEDGE.z = FLEDGE.z0 + FLEDGE.d / 2;
LOGIC.elements.map.at = [-7.5, WELL.gallery.y, FLEDGE.z + 7.5];   // tile centre; west/north walls tie, back faces west; ball lane stays clear
export const SILL = { a: -2.35, r: 20, catch: 3.4, slow: 9, over: 2.5 };

// ------------------------------------------------------------------ the stack's rooms (v1.49, issue #23)
/**
 * The Wind Well's rooms off it (local m): the Moult west off its floor (an arena); a ledge round the well's west wall
 * from the high balcony's west end (32 m up) to the Eyrie west at that height. The Eyrie: its ledge (the floor you come
 * in on), a gap over the dark, the great key's perch six metres higher on the far side, on a pillar out of the dark; one
 * stone in a groove on the ledge between two throats, in the middle of the hall (v1.77: the ledge reaches out to it). In
 * the up-throat (where it starts) the wind comes out of the ledge's own vent, a column to the coffer's shelf by the door;
 * in the ledge vent's throat, out of the vent at the gap's foot, a column past the perch.
 */
export const STACK = {
  // (the Moult under the Eyrie's gap since issue #23's last round: its middle under the vent at the gap's foot, its roof's
  // opening the foot of that vent's shaft, `chute`; v1.77 30 m square under 18, four columns to fight round)
  // (v1.83, issue #407: every x SHIFT further west, with the well's wall)
  moult: { x: -38.8 - SHIFT, w: 30, d: 30, h: 18 },
  eyrie: { x: -38 - SHIFT, w: 30, d: 30, y: 32, floor: 20, h: 30 },
  ledge: [-34 - SHIFT, -23 - SHIFT],          // the Eyrie's ledge (x), level with the high balcony
  perch: { x: [-53 - SHIFT, -43 - SHIFT], z: [WELL.z - 4.5, WELL.z + 4.5], y: 38 },   // (against the west wall, as it was: a glide to it stops there)
  column: { x: -38.8 - SHIFT, r: 2.6, h: 22 },   // out of the vent at the gap's foot, past the perch
  // the vent's shaft down from the gap's foot through the Moult's roof (r inside, t its wall; `hole` the square cut for it
  // in the gap's floor and the Moult's roof, half its side): still while the stone stops the vent, a way down. (v1.83,
  // issue #407: a well 9.2 m across, where it was 6.8, its rim at the ledge's foot: from the ledge you look down it onto
  // the Moult before you go in; its wall thick enough to close the square's corners)
  chute: { r: 4.6, t: 2.0, hole: 4.6, top: 21.6, foot: 17.95 },
  shelf: { x: [-26.6 - SHIFT, -23 - SHIFT], z: [WELL.z + 7, WELL.z + 10.2], y: 39.5 },
  vent: { x: -25.2 - SHIFT, z: WELL.z + 5.4, r: 1.2, h: 9.5 }, // the ledge's own: a column beside the coffer's shelf
  // the stone's: the gap-vent's throat at its south end (pU), the ledge vent's at its north (pC). (Since issue #275 off the
  // gap's lip and off the south wall; v1.77 in the middle of the hall, 6.8 m in from the ledge's edge as it was)
  groove: { x: -31.2 - SHIFT, z: [WELL.z - 4.4, WELL.z] },
};
STACK.zone = { min: [STACK.moult.x - STACK.moult.w / 2, -1, WELL.z - STACK.moult.d / 2], max: [STACK.moult.x + STACK.moult.w / 2, STACK.moult.h - 1, WELL.z + STACK.moult.d / 2] };

/** The Moult's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's `foes`). */
export const ARENAS = [{
  el: 'arM', room: 'moult', zone: STACK.zone, doors: ['dM'], extra: 2,
  shut: 'You come down among the moulted feathers, and something stirs in them that is not a bird.',
  won: 'The last of them falls among the stone feathers. The key’s cage sinks, and the door onto the well lets go.',
}];

/**
 * The Moult (west off the Wind Well's floor, an arena: where the birds raised here shed their first feathers, stone ones
 * heaped by the walls; its door shuts behind you while its keepers stand, and won, the small key's cage sinks) and the
 * Eyrie (west at the high balcony's height, along a ledge round the well's wall: two winds and one stone, the great key).
 * The small key is for the way north off the Vent Hall, the great key for the Roost's door.
 */
function stack(rt, K, M, { C2, WR, feather }) {
  const add = (P, o) => rt.add(P, o);
  const Mo = STACK.moult, E = STACK.eyrie, [L0, L1] = STACK.ledge, Pp = STACK.perch, Cl0 = STACK.column;
  // ---- the Moult (under the Eyrie's gap: its roof's opening is the foot of the vent's shaft, the way in)
  const Ch = STACK.chute, mx = Mo.x;
  K.corridor([mx + Mo.w / 2 + 0.6, C2], [-WR, C2], 0, DOOR);
  K.hall({ x: mx, z: C2, w: Mo.w, d: Mo.d, y: 0, h: Mo.h, roof: 'oculus', oculus: (2 * Ch.hole) / Mo.w, doors: [{ side: 'e', at: 0, ...DOOR }] });
  // (shut till its keepers are beaten: then the way out onto the well's floor. Its lamp shows it from the well)
  add(Door, { id: 'dM', at: [mx + Mo.w / 2 + 0.6, 0, C2], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'arM' }] });
  // four columns to fight round, and stone feathers moulted and heaped by the walls, a nest of them in the far corner
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.column(mx + sx * 8, C2 + sz * 8, 0, Mo.h, 0.9);
  for (const [x, z, a, len] of [[-10, -13.2, 0.3, 4.4], [-7, -13.4, -0.2, 3.6], [6, 13.3, 1.4, 4], [9.4, 13.1, 1.9, 3.2], [-13.3, 10, 2.6, 3.8], [13.2, -9, 0.8, 4.2]]) {
    K.both(M.wall, T(new THREE.SphereGeometry(1, 10, 6).scale(0.9, len / 2, 0.22), [mx + x, 0.25, C2 + z], [Math.PI / 2, a, 0], 1, 'YXZ'));
  }
  K.both(M.trim, T(annulus(1.6, 2.4, 0.5, 20), [mx - 11, 0.5, C2 - 11]));
  // the vent's shaft, from the Moult's roof up to the gap's foot (its rim a kerb round the vent there, standing proud of the
  // gap's dark floor: no face of it in that floor's plane)
  K.shaft(Cl0.x, C2, Ch.r, Ch.foot, Ch.top, { t: Ch.t, seg: 24 });
  // (v1.83, issue #407) its rim lit, so the well down onto the Moult reads from the Eyrie's ledge
  K.add(M.glyph, T(annulus(Ch.r + 0.15, Ch.r + 0.5, 0.06, 40), [Cl0.x, Ch.top + 0.06, C2]));
  // (v1.83, issue #407: the key's cage under the well down from the Eyrie, seen from its ledge before you go in; it stood
  // by the far wall)
  add(Key, { id: 'kM', at: [Mo.x + 3.4, 0, C2 - 2.6], yaw: Math.PI / 2 });
  add(Mark, { room: 'moult', at: [Mo.x + 11, 0, C2 - 6], yaw: Math.PI / 2, foes: [Mo.x + 3, 0, C2 + 3] });

  // ---- the ledge round the well's west wall, from the high balcony's west end to the Eyrie's way in
  // (from under the balcony's west end: v1.83, the well 62 m across, that end at a smaller angle)
  const rotA = (a) => Math.PI / 2 - a, a0 = -Math.asin(6.6 / (WR - 1.7));
  K.both(M.floor, T(sector(WR - 2.8, WR - 0.6, rotA(a0), rotA(-Math.PI / 2 - 0.3), 0.7), [0, E.y, C2]));
  K.both(M.trim, T(sector(WR - 2.85, WR - 2.6, rotA(a0 - 0.04), rotA(-Math.PI / 2 - 0.3), 0.25), [0, E.y + 0.25, C2]));   // (a kerb along its edge)
  // ---- the Eyrie: its ledge, the gap, the perch higher on the far side
  K.corridor([E.x + E.w / 2 + 0.6, C2], [-WR, C2], E.y, DOOR);
  K.hall({ x: E.x, z: C2, w: E.w, d: E.d, y: E.floor, h: E.h, floor: false, roof: 'oculus', oculus: 0.35, doors: [{ side: 'e', at: 0, ...DOOR, y0: E.y - E.floor }] });
  const ez0 = C2 - E.d / 2, ez1 = C2 + E.d / 2, ex0 = E.x - E.w / 2;
  K.slab(L0, ez0, L1, ez1, E.y, E.y - E.floor);
  K.slab(Pp.x[0], Pp.z[0], Pp.x[1], Pp.z[1], Pp.y, 1.2);
  // (its pillar out of the dark: the perch stood on a corbel down the west wall, and is five metres out from it now)
  // (its buttress, straight up out of the dark from the west wall: a glide short of the perch meets its face and falls)
  K.both(M.wall, box(Pp.x[1] - 1.2 - ex0, Pp.y - 1.2 - E.floor, 7.2, (ex0 + Pp.x[1] - 1.2) / 2, (Pp.y - 1.2 + E.floor) / 2, C2));
  for (const s of [-1, 1]) feather(M.trim, Pp.x[1] - 0.2, Pp.y, C2 + s * 4.2, 3.4, -Math.PI / 2 + s * 0.5, 0.35);
  // the gap's dark floor, and the pit over it, round the vent's mouth at its foot (a square cut for the shaft: the shaft's
  // rim stands in it), so a fall into the vent goes on down into the Moult and a fall anywhere else is the pit's
  const hx0 = Cl0.x - Ch.hole, hx1 = Cl0.x + Ch.hole, hz0 = C2 - Ch.hole, hz1 = C2 + Ch.hole;
  for (const [x0, x1, z0, z1] of [[ex0, hx0, ez0, ez1], [hx1, L0, ez0, ez1], [hx0, hx1, ez0, hz0], [hx0, hx1, hz1, ez1]]) {
    K.both(M.dark, box(x1 - x0, 1, z1 - z0, (x0 + x1) / 2, E.floor + 0.5, (z0 + z1) / 2));
    add(Pit, { room: 'eyrie', min: [x0, E.floor - 1, z0], max: [x1, E.y - 3, z1] });
  }
  // the coffer's shelf by the door, and the ledge's own vent under it
  const Sh = STACK.shelf, Vt = STACK.vent;
  K.slab(Sh.x[0], Sh.z[0], Sh.x[1], Sh.z[1], Sh.y, 0.6);
  add(Coffer, { id: 'cache', at: [(Sh.x[0] + Sh.x[1]) / 2 + 0.3, Sh.y, (Sh.z[0] + Sh.z[1]) / 2 + 0.2], yaw: -Math.PI / 2 });
  add(Updraft, { at: [Vt.x, E.y, Vt.z], r: Vt.r, h: Vt.h, lift: 7, when: { drumOn: ['bE', 'pU'] }, still: 'Still air over the grate: its stone has gone from the other throat, and the wind out of the dark beyond.' });
  // the column out of the vent at the gap's foot, past the perch (while the stone stops the ledge's vent)
  const Cl = STACK.column;
  // (v1.74: and only while the Moult's door onto the well is open, the shaft's air coming up out of the Moult)
  add(Updraft, { at: [Cl.x, E.floor + 1, C2], r: Cl.r, h: Cl.h, lift: 7.5, when: { all: [{ drumOn: ['bE', 'pC'] }, { open: 'dM' }] },
    still: [[{ drumOn: ['bE', 'pU'] }, 'Still air: the stone sits in the throat of the vent down there, and its shaft goes on down into the dark.'],
      [{ not: { open: 'dM' } }, 'Barely a breath out of the vent down there: its shaft goes down into the Moult, and the Moult’s door onto the well is shut. Nothing comes up a shaft that no wind goes into.']] });
  // (issue #436) and its breath across the gap while it rises, spilling over the ledge's lip: open wings off the ledge glide
  // on into it as out in the world
  add(WingAir, { min: [Cl.x - 8, E.floor, C2 - E.d / 2], max: [STACK.ledge[0] + 3, E.y + E.h, C2 + E.d / 2], when: { all: [{ drumOn: ['bE', 'pC'] }, { open: 'dM' }] } });
  // the stone's groove on the ledge between its two throats
  const [Z0, Z1] = STACK.groove.z, GX = STACK.groove.x;
  K.add(M.dark, box(1.0, 0.04, Z1 - Z0 + 0.6, GX, E.y + 0.02, (Z0 + Z1) / 2));
  add(Ball, { id: 'bE', a: [GX, E.y + 0.04, Z0], b: [GX, E.y + 0.04, Z1], r: 1.1 });
  add(Plate, { id: 'pU', at: [GX, E.y, Z0], r: 1.3 });
  add(Plate, { id: 'pC', at: [GX, E.y, Z1], r: 1.3 });
  for (const z of [Z0, Z1]) K.add(M.trim, T(annulus(1.5, 2.0, 0.05, 28), [GX, E.y + 0.02, z]));
  add(Key, { id: 'kE', big: true, at: [Pp.x[0] + 1.8, Pp.y, C2], yaw: Math.PI / 2 });
  // (by the way in: taken as you come, its spot south of the door, clear of the stone)
  add(Mark, { room: 'eyrie', at: [L1 - 1.5, E.y, C2 - 6], yaw: 0 });
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  /** A stone feather: a long flat blade, its quill at p, leaning out. */
  const feather = (mat, x, y, z, len, yaw, tilt, solid = false) => K[solid ? 'both' : 'add'](mat, T(new THREE.SphereGeometry(1, 10, 6).scale(0.9, len / 2, 0.22).translate(0, len / 2, 0), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
  /** A vent's mouth in a wall facing +z (or -z, back): a dark round, a ring of trim, stone feathers round it. */
  const mouth = (x, y, z, back = false) => {
    const yaw = back ? Math.PI : 0, s = back ? -1 : 1;
    K.add(M.voidM, T(new THREE.CircleGeometry(2.4, 24), [x, y, z + s * 0.05], [0, yaw, 0]));
    K.both(M.trim, T(new THREE.TorusGeometry(2.6, 0.3, 6, 28), [x, y, z + s * 0.1]));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; feather(M.wall, x + Math.sin(a) * 3.2, y + Math.cos(a) * 3.2, z + s * 0.3, 2.2, 0, 0, true); }
  };

  // ---- the Threshold (z 0..12)
  const H = HALL, HZ1 = H.z0 + H.d, HX = H.w / 2;
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 10, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-HX - 0.6, H.z0, HX + 0.6, H.z0, 0, H.h, { t: 1.2, holes: [{ at: HX + 0.6, ...DOOR }] });

  // ---- the Hall of Winds (30 by 66): gusts down it out of the vent's mouth over its far door; stone screens to wait behind
  K.hall({ x: 0, z: H.z0 + H.d / 2, w: H.w, d: H.d, y: 0, h: H.h, roof: true, columns: 0, omit: ['s'], doors: [{ side: 'n', ...DOOR }] });
  const shelters = [];
  for (const [i, z] of H.screens.entries()) {
    for (const x of [-4.2, 4.2]) {
      K.both(M.wallGlyph, box(3.4, 7, 1.0, x, 3.5, z));
      K.both(M.trim, box(3.6, 0.4, 1.2, x, 7.2, z));   // (solid: its top is what you stand on up there, v1.77)
      shelters.push([[x - 1.5, -1, z - 2.6], [x + 1.5, 9, z - 0.45]]);
    }
    if (i < H.screens.length - 2) for (const x of [-9.6, 9.6]) feather(M.trim, x, 0, z + 4.5, 9, 0, 0);
  }
  // (the hall's wind comes out of the vent's mouth over the far door; its throat is the grate at the groove's end, in the
  // hall's middle: it blows while no stone sits in it)
  // (lee: behind a screen or any wall the wind can't reach you, and its streaks stop there: issue #216)
  mouth(0, DOOR.h + 4, HZ1, true);
  add(Gust, { min: [-HX, -1, H.z0 + 0.4], max: [HX, H.h, HZ1 - 0.4], dir: [0, 0, -1], shelters, lee: 3.5, floor: 0, streaks: 80, calm: 3.2, blow: 2.2, warn: 0.8, push: 7.5, when: { not: { drumOn: ['ballW', 'pH'] } } });
  // the stone, too heavy for the gusts: up its groove down the hall's middle into the vent's throat (pH), a push at a time
  // in the calms. Seated, it stops the hall's wind, and the wind rises in the well instead
  const [GA, GB] = H.groove;
  K.add(M.dark, box(1.0, 0.04, GB - GA + 0.6, 0, 0.02, (GA + GB) / 2));
  K.add(M.trim, T(annulus(1.5, 2.1, 0.05, 32), [0, 0.02, GB]));
  for (let i = 0; i < 3; i++) K.add(M.dark, box(2.6, 0.05, 0.3, 0, 0.04, GB - 0.9 + i * 0.9));
  add(Ball, { id: 'ballW', a: [0, 0.04, GA], b: [0, 0.04, GB], r: 1.1, friction: 0.6 });
  add(Plate, { id: 'pH', at: [0, 0, GB], r: 1.3 });
  add(Mark, { room: 'gusts', at: [-6, 0, 16], yaw: Math.PI / 2 });

  // ---- the corridor and the Wind Well (the hub: a tall round shaft open to the sky through a crown of stone feathers)
  const C2 = WELL.z, WR = WELL.r, WH = WELL.h, GY = WELL.gallery.y, GW = WELL.gallery.w;
  // (v1.83, issue #407) the Long Passage: 38 m, narrow after the hall and before the great well. Its roof is laid by hand
  // round the hole under the Fledgery's (a round shaft between them), its grate straight below: the Fledgery's stone's plate
  const FL = FLEDGE, HZ = FL.z + FL.b, HH = FL.hole, PZ0 = HZ1 + 0.6, PZ1 = C2 - WR;
  K.corridor([0, PZ0], [0, PZ1], 0, { ...DOOR, roof: false });
  {
    const s = DOOR.w / 2 + 0.3 + 0.4, xw = s + 0.4, ry = DOOR.h + 0.42;
    K.both(M.wall, box(2 * xw, 0.8, HZ - HH - PZ0, 0, ry, (PZ0 + HZ - HH) / 2));
    K.both(M.wall, box(2 * xw, 0.8, PZ1 - HZ - HH, 0, ry, (HZ + HH + PZ1) / 2));
    K.both(M.wall, box(FL.x - HH + xw, 0.8, 2 * HH, (FL.x - HH - xw) / 2, ry, HZ));
    K.both(M.wall, box(xw - FL.x - HH, 0.8, 2 * HH, (FL.x + HH + xw) / 2, ry, HZ));
    // (a tube, its foot inside the roof's slab: no face in its underside's plane; not the kit's shaft, which the house's map
    // would draw as a floor of its own)
    K.both(M.wall, T(annulus(HH, HH + 0.7, GY - 0.1 - DOOR.h - 0.3, 20), [FL.x, GY - 0.1, HZ]));
    // the grate (the vent's throat), its lit ring, and the breath up the shaft while no stone stops it
    K.add(M.trim, T(annulus(1.5, 2.1, 0.05, 32), [FL.x, 0.02, HZ]));
    for (let i = 0; i < 3; i++) K.add(M.dark, box(2.6, 0.05, 0.3, FL.x, 0.04, HZ - 0.9 + i * 0.9));
    add(Plate, { id: 'pD', at: [FL.x, 0, HZ], r: 1.3 });
    add(Updraft, { at: [FL.x, 0, HZ], r: 1.2, h: DOOR.h - 0.4, lift: 3, when: { all: [{ drumOn: ['ballW', 'pH'] }, { not: { drumOn: ['bD', 'pD'] } }] }, hint: 'A breath of wind rises through the grate, up the shaft in the roof.' });
    // (a fall down the shaft from the Fledgery: back to its mark)
    add(Pit, { room: 'fledge', min: [FL.x - HH - 0.2, DOOR.h + 1, HZ - HH - 0.2], max: [FL.x + HH + 0.2, GY - 1.5, HZ + HH + 0.2] });
  }
  // (since v1.49 a way west off its floor into the Moult, and another at the high balcony's height into the Eyrie; v1.83 a
  // way south off the gallery into the Fledgery, over the passage's)
  K.rotunda({ x: 0, z: C2, y: 0, r: WR, h: WH, seg: 48, gaps: [{ a: Math.PI, ...DOOR }, { a: Math.PI, ...DOOR, y0: GY }, { a: Math.PI / 2, ...DOOR, y0: GY }, { a: 0, ...DOOR, y0: 32 }, { a: -Math.PI / 2, ...DOOR }, { a: -Math.PI / 2, ...DOOR, y0: 32 }], oculus: 0.66 });
  // the Feather Gallery: a ring round the well at the Wing Chamber's height (the great hall's middle floor), its edge in
  // ochre (and in the house's map: issue #405)
  K.chartNote({ kind: 'ring', x: 0, z: C2, y: GY, r0: WR - GW, r1: WR, a0: 0, a1: TAU, holes: [] });
  K.both(M.floor, T(annulus(WR - GW, WR - 0.05, 0.8, 144), [0, GY, C2]));
  K.both(M.trim, T(annulus(WR - GW - 0.06, WR - GW + 0.2, 0.9, 144), [0, GY - 0.06, C2]));
  // bands of ochre round it, glyph lines up its walls like the lines on a wing, carved ledges low down, the crown
  for (const y of [10, 26, 42]) K.both(M.trim, T(annulus(WR - 0.35, WR + 0.1, 0.7, 80), [0, y, C2]));
  const wingLines = makeMaterial({ color: PALETTE.glow, glow: 0.35, flat: true, key: 'temple.vael.winglines' });
  const off = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  // (v1.83: more of them round the 62 m well, broken by the gallery)
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + 0.11;
    if (off(a, Math.PI) < 0.25) continue;
    for (const [y0, y1] of [[1.5, 9.4], [10.6, 15], [17, 25.4], [26.6, 41.4], [42.6, 48]]) {
      if ((off(a, Math.PI / 2) < 0.25 && y1 > 15 && y0 < 25.5) || (off(a, 0) < 0.25 && y1 > 31 && y0 < 41.5) || (off(a, -Math.PI / 2) < 0.25 && (y0 < 9.5 || (y1 > 31 && y0 < 41.5)))) continue;
      K.add(wingLines, T(new THREE.BoxGeometry(0.16, y1 - y0, 0.08), [Math.sin(a) * (WR - 0.05), (y0 + y1) / 2, C2 + Math.cos(a) * (WR - 0.05)], [0, a, Math.sin(i * 1.7) * 0.05]));
    }
  }
  for (let i = 0; i < 44; i++) { const a = (i / 44) * TAU; if (off(a, Math.PI) < 0.25 || off(a, Math.PI / 2) < 0.3 || off(a, -Math.PI / 2) < 0.3) continue; K.both(M.floor, T(new THREE.BoxGeometry(1.6, 0.5, 1.2), [Math.sin(a) * (WR - 0.6), 3.2 + (i % 3) * 1.4, C2 + Math.cos(a) * (WR - 0.6)], [0, a, 0])); }
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU + 0.2, len = 14 + (i % 3) * 4; feather(i % 4 === 1 ? M.trim : M.wall, Math.sin(a) * (WR + 0.6), WH + 0.9, C2 + Math.cos(a) * (WR + 0.6), len, a, 0.45, true); }   // (solid: a climber up the well meets them as drawn)
  // the vent in the well's floor: the wind rises out of it while the hall's vent is stopped (its grate, still till then)
  K.add(M.trim, T(annulus(4.4, 5, 0.05, 40), [0, 0.02, C2]));
  for (let i = 0; i < 6; i++) K.add(M.dark, box(8.6, 0.05, 0.3, 0, 0.04, C2 - 3.75 + i * 1.5));
  // (v1.74, issue #23 round 6) up to the high balcony only once the floor's second vent is stopped: until then it lets
  // open wings go just over the chest's balcony (the gate of the way up: its id)
  add(Updraft, { id: 'column', at: [0, 0, C2], r: 4.5, h: WELL_VENT.low, heights: [[{ drumOn: ['bF', 'pF'] }, 36]], lift: 7, when: { drumOn: ['ballW', 'pH'] }, still: 'Still air over the grate: the wind goes down the hall. Nothing rises here.',
    low: 'The wind thins out over the balcony and lets your wings go. Down on the floor, by the Moult’s door, the other vent is breathing half of it away.' });
  // (issue #436) while the column rises, the whole well breathes: open wings glide in it as out in the world, off the
  // gallery into the column, down to the floor, round to the Eyrie's ledge (the houses' steeper glide is for still air)
  add(WingAir, { min: [-WR, 0, C2 - WR], max: [WR, WELL.h, C2 + WR], when: { drumOn: ['ballW', 'pH'] } });
  // the floor's second vent, toward the Moult's door, and its stone beside it on a short groove; open, the wind breathes
  // out of it in a low column
  {
    const [vx, vz0, vz1] = [WELL_VENT.x, C2 + WELL_VENT.z0, C2 + WELL_VENT.z1];
    K.add(M.trim, T(annulus(1.5, 2.1, 0.05, 32), [vx, 0.02, vz1]));
    for (let i = 0; i < 3; i++) K.add(M.dark, box(2.6, 0.05, 0.3, vx, 0.04, vz1 - 0.9 + i * 0.9));
    K.add(M.dark, box(1.0, 0.04, vz1 - vz0, vx, 0.02, (vz0 + vz1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.22, 0.12, vz1 - vz0, vx + sd * 0.8, 0.06, (vz0 + vz1) / 2));
    add(Ball, { id: 'bF', a: [vx, 0.04, vz0], b: [vx, 0.04, vz1], r: 1.1, friction: 0.8 });
    add(Plate, { id: 'pF', at: [vx, 0, vz1], r: 1.3 });
    add(Updraft, { at: [vx, 0, vz1], r: 1.4, h: 6, lift: 5, when: { all: [{ drumOn: ['ballW', 'pH'] }, { not: { drumOn: ['bF', 'pF'] } }] }, hint: 'Wind rises out of the little vent by the Moult’s door.' });
  }
  // the feather raft by the east wall: the well's wind lifts it to the gallery, beside the Wing Chamber's shutter
  const RX = WELL.raft;
  add(Platform, { id: 'raft', path: [[RX, 0.3, C2], [RX, GY, C2]], r: 2.2, speed: 1.6, pause: 2.2, when: { drumOn: ['ballW', 'pH'] } });
  K.add(M.trim, T(annulus(2.4, 2.9, 0.05, 32), [RX, 0.02, C2]));
  for (const s of [-1, 1]) feather(M.trim, WR - GW + 0.6, GY, C2 + s * 3.3, 4, Math.PI / 2, s * 0.3);
  add(Mark, { room: 'well', at: [-6.5, 0, C2 - 10], yaw: Math.PI * 0.75 });
  // (v1.83, issue #407) the Fledging Sill: on the gallery between two tall stone feathers, a drop to the well's floor onto
  // the makers' breath, a ring of still wind that takes any fall over it (G6: a safe way down from an upper floor to the hub)
  {
    const at = (r, da = 0) => [Math.sin(SILL.a + da) * r, C2 + Math.cos(SILL.a + da) * r];
    for (const s of [-1, 1]) { const [x, z] = at(WR - GW / 2, s * 0.09); feather(M.trim, x, GY, z, 7, SILL.a + Math.PI + s * 0.25, 0.12, true); }
    const [lx, lz] = at(WR - GW + 0.1);
    K.add(wingLines, T(new THREE.BoxGeometry(4.4, 0.06, 0.5), [lx, GY + 0.03, lz], [0, SILL.a + Math.PI / 2, 0]));
    const [cx, cz] = at(SILL.r);
    K.both(M.trim, T(annulus(SILL.catch - 0.2, SILL.catch + 0.4, 0.06, 40), [cx, 0.06, cz]));
    for (let i = 0; i < 5; i++) K.add(M.dark, box(2 * SILL.catch - 1.4, 0.05, 0.3, cx, 0.04, cz - 2.4 + i * 1.2));
    add(Updraft, { at: [cx, 0, cz], r: SILL.catch - 0.6, h: 11, lift: 4, hint: 'Wind rises here, soft and steady: enough to break a fall.' });
    add(Cushion, { at: [cx, 0, cz], r: SILL.catch, said: 'The makers’ breath takes your fall.' });
  }

  // ---- the Wing Chamber (east, floor 16): the chest
  const C3x = WR + 4 + WING.r;
  K.corridor([WR, C2], [WR + 4 - 1.4, C2], 16, DOOR);
  K.rotunda({ x: C3x, z: C2, y: 16, r: WING.r, h: WING.h, seg: 24, gaps: [{ a: -Math.PI / 2, ...DOOR }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(C3x, 16, C2));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) feather(M.wall, C3x - 3 + i * 3, 16, C2 + s * (8.4 - i * 0.6), 7 + i * 1.5, Math.PI / 2 + s * 0.4, s * 0.25);
  add(Mark, { room: 'wings', at: [C3x + 5, 16, C2 - 6], yaw: -Math.PI * 0.75 });
  // (v1.83, issue #407) its shutter, between the gallery and the chamber: it lifts on the wind once the Fledgery's stone
  // stops the passage's grate (its lamp)
  add(Door, { id: 'dW', at: [WR + 2, GY, C2], yaw: Math.PI / 2, ...DOOR, lamps: [{ drumOn: ['bD', 'pD'] }] });

  // ---- the Fledgery (v1.83, issue #407; south off the gallery, over the Long Passage): a stone in a groove whose end is a
  // hole in the floor, straight over the passage's grate; stone feathers on the walls like the young birds' first ones, and
  // the hole's lit collar
  K.corridor([0, C2 - WR], [0, FL.z1 + 0.6], GY, DOOR);
  K.hall({ x: 0, z: FL.z, w: FL.w, d: FL.d, y: GY, h: FL.h, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 'n', ...DOOR }] });
  {
    const x0 = -FL.w / 2 - 0.6, x1 = FL.w / 2 + 0.6, z0 = FL.z0 - 0.6, z1 = FL.z1 + 0.6, hx0 = FL.x - HH, hx1 = FL.x + HH;
    K.slab(x0, z0, x1, HZ - HH, GY);
    K.slab(x0, HZ + HH, x1, z1, GY);
    K.slab(x0, HZ - HH, hx0, HZ + HH, GY);
    K.slab(hx1, HZ - HH, x1, HZ + HH, GY);
  }
  const FA = FL.z + FL.a, FB = HZ;
  K.add(M.dark, box(1.0, 0.04, FA - FB - HH + 0.4, FL.x, GY + 0.02, (FA + FB + HH) / 2 + 0.2));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.22, 0.12, FA - FB - HH + 0.4, FL.x + sd * 0.8, GY + 0.06, (FA + FB + HH) / 2 + 0.2));
  K.both(M.trim, T(annulus(HH + 0.05, HH + 0.75, 0.06, 40), [FL.x, GY + 0.06, HZ]));
  K.add(wingLines, T(annulus(HH + 0.75, HH + 0.95, 0.07, 40), [FL.x, GY + 0.07, HZ]));
  add(Ball, { id: 'bD', a: [FL.x, GY + 0.04, FA], b: [FL.x, GY + 0.04, FB], r: 1.1, friction: 1.2,
    hole: { gate: 'hD', to: [FL.x, 0.04, HZ], fell: 'The stone drops through the floor. Below, the wind stops with a thud.' } });
  for (const [x, z, a] of [[-12.6, FL.z - 9, 0.4], [12.6, FL.z - 9, -0.4], [-12.6, FL.z + 3, 0.2], [12.6, FL.z + 3, -0.2]]) feather(M.wall, x, GY, z, 9, x < 0 ? Math.PI / 2 : -Math.PI / 2, a);

  // ---- the high balcony over the well (floor 32): the great carved eye beside it, the way north to the Vent Hall
  // (issue #275: deep enough for room behind a stone and before it; v1.77 its stone in the Vent Hall beyond, and the
  // balcony reaches out over the well to two metres from the column's edge)
  const BE = C2 + WR - BALCONY.depth;
  K.slab(-7, BE, 7, C2 + WR, 32, 0.7);
  K.add(M.trim, box(14, 0.35, 0.35, 0, 33.1, BE + 0.05));
  for (const s of [-1, 1]) K.add(M.trim, box(0.35, 1.1, 0.35, s * 6.9, 32.55, BE + 0.05));
  // its corbel, down the wall (v1.83: a long wedge under the pier, 21 m out over the 62 m well)
  {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(BALCONY.depth - 1, 0), new THREE.Vector2(0, -12)]);
    K.both(M.wall, T(new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false }).translate(0, 0, -2.5), [0, 31.3, C2 + WR + 0.2], [0, Math.PI / 2, 0]));
  }
  {
    // the eye: a great carved lid and iris in the wall to the balcony's left, as the makers carved their birds
    const a = -0.42, ex = Math.sin(a) * (WR - 0.2), ez = C2 + Math.cos(a) * (WR - 0.2);
    // (solid as drawn: a climber up the well meets it)
    K.both(M.trim, T(new THREE.TorusGeometry(2.2, 0.28, 6, 28).scale(1.4, 0.8, 1), [ex, 37, ez], [0, a, 0]));
    K.both(M.stone, T(new THREE.SphereGeometry(1.3, 16, 10).scale(1, 1, 0.35), [ex, 37, ez], [0, a, 0]));
    K.add(M.dark, T(new THREE.SphereGeometry(0.55, 12, 8).scale(1, 1, 0.3), [ex - Math.sin(a) * 0.35, 37, ez - Math.cos(a) * 0.35], [0, a, 0]));
    K.both(M.trim, T(new THREE.TorusGeometry(2.6, 0.18, 4, 24, Math.PI).scale(1.5, 0.9, 1), [ex, 37.7, ez], [0, a, 0]));
  }

  // ---- the Vent Hall (v1.77; the gulf vent's stone was on the balcony against the well's wall): 30 m square at the
  // balcony's height, the vent's throat a grate in its middle, its stone in it (pB), its cup at the groove's end (pX); a
  // pipe from the hood over the grate along the roof to the vent's mouth over the gulf's door; the way north wants the
  // small key
  const TZ = TOP.z, T1 = TOP.z0 + TOP.d, [BX0, BX1] = BALCONY.groove;
  K.corridor([0, C2 + WR], [0, TOP.z0 - 0.6], 32, DOOR);
  K.hall({ x: 0, z: TZ, w: TOP.w, d: TOP.d, y: 32, h: TOP.h, roof: true, doors: [{ side: 's', ...DOOR }, { side: 'n', ...DOOR }] });
  K.add(M.dark, box(BX1 - BX0 + 0.8, 0.04, 1.0, (BX0 + BX1) / 2, 32.02, TZ));
  K.add(M.trim, T(annulus(1.5, 2.1, 0.05, 32), [BX0, 32.02, TZ]));
  K.add(M.trim, T(annulus(1.5, 2.1, 0.05, 32), [BX1, 32.02, TZ]));
  add(Ball, { id: 'ballB', a: [BX0, 32.04, TZ], b: [BX1, 32.04, TZ], r: 1.1 });
  add(Plate, { id: 'pB', at: [BX0, 32, TZ], r: 1.3 });
  add(Plate, { id: 'pX', at: [BX1, 32, TZ], r: 1.3 });
  K.add(M.trim, T(new THREE.ConeGeometry(2.2, 2.6, 16, 1, true), [BX0, 43.3, TZ]));
  K.add(M.trim, T(new THREE.CylinderGeometry(0.7, 0.7, 4.6, 12), [BX0, 46.8, TZ]));
  K.add(M.trim, T(new THREE.CylinderGeometry(0.7, 0.7, T1 - TZ + 0.6, 12), [BX0, 48.4, (TZ + T1) / 2 + 0.3], [Math.PI / 2, 0, 0]));
  for (const [x, z] of [[-11, TOP.z0 + 4], [11, TOP.z0 + 4], [-11, T1 - 4], [11, T1 - 4]]) feather(M.trim, x, 32, z, 8, Math.atan2(-x, TZ - z), 0.15, true);
  add(Mark, { room: 'top', at: [6, 32, TOP.z0 + 3], yaw: -Math.PI / 2 });

  // ---- the corridor and the Gulf: two crossings, each on a wind you send. First, forty-six metres of nothing to
  // a stone perch four lower: on still air no glide carries so far; the vent over the door does, its stone rolled out
  // of its throat (a tailwind, in gusts). Then from the perch to a ledge six HIGHER: no glide climbs; the vent far
  // below beside the perch does, its throat on the perch, its stone in it (a column, as in the well)
  const G0 = T1 + 5, GX = GULF.half, { leg1, perchR, leg2, perchY, farY } = GULF;
  K.corridor([0, T1 + 0.6], [0, G0 - 0.6], 32, DOOR);
  // the way north off the Vent Hall, toward the Gulf: the small key's door
  add(Door, { id: 'dG', at: [0, 32, T1 + 0.6], ...DOOR });
  const PZ = G0 + 6 + leg1 + perchR, FZ = PZ + perchR + leg2, GD = FZ + 12 - G0;
  const WB = GULF.way, wayDoor = (z, y) => ({ side: 'e', at: z - (G0 + GD / 2), w: WB.door, h: 4.4, y0: y - 2 });
  K.hall({ x: 0, z: G0 + GD / 2, w: 2 * GX, d: GD, y: 2, h: 52, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', ...DOOR, y0: 30 }, { side: 'n', ...DOOR, y0: farY - 2 }, wayDoor(G0 + WB.near, 32), wayDoor(FZ + WB.far, farY)] });
  K.slab(-GX, G0, GX, G0 + 6, 32, 30);
  K.slab(-GX, FZ, GX, FZ + 12, farY, farY - 2);
  K.both(M.dark, box(2 * GX, 1, FZ - G0 - 6, 0, 1.5, (G0 + 6 + FZ) / 2));
  add(Pit, { room: 'gulf', min: [-GX - 1, -2, G0 + 6], max: [GX + 1, 24, FZ] });
  K.add(M.trim, box(2 * GX, 0.5, 1.4, 0, 31.8, G0 + 6.4));
  for (let i = 0; i < 8; i++) feather(M.trim, (i % 2 ? -1 : 1) * (4 + (i % 3) * 3.4), 53.4, G0 + 10 + i * 7.5, 9, 0, Math.PI);   // stone feathers hanging over the gulf
  // the tail vent: its mouth high over the door, feathers round it (its throat is the grate in the Vent Hall behind you,
  // the pipe along its roof between them)
  mouth(0, 32 + DOOR.h + 4.5, G0);
  add(Gust, { min: [-GX, 16, G0 + 6.6], max: [GX, 48, PZ - perchR], dir: [0, 0, 1], calm: 1.8, warn: 0.6, blow: 3.6, push: 6, carry: GULF.carry,
    when: { not: { drumOn: ['ballB', 'pB'] } },
    notice: 'The gust shoves you out toward the gulf.', carried: 'The wind out of the vent fills your wings and carries you out over the gulf.' });
  add(Mark, { room: 'gulf', at: [7, 32, G0 + 3], yaw: 0 });
  // the perch: a feathered round of stone on a tall pillar out of the dark; the column's throat on it, and its stone
  K.both(M.wall, new THREE.CylinderGeometry(perchR * 0.55, perchR * 0.7, perchY - 2, 16).translate(0, (perchY + 2) / 2 - 0.4, PZ));
  K.both(M.floor, new THREE.CylinderGeometry(perchR, perchR * 0.8, 1.4, 24).translate(0, perchY - 0.7, PZ));
  K.add(M.trim, T(annulus(perchR - 0.2, perchR + 0.15, 0.3, 40), [0, perchY - 0.1, PZ]));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.4; if (Math.abs(Math.sin(a)) > 0.75 && Math.cos(a) > -0.2) continue; feather(i % 3 ? M.wall : M.trim, Math.sin(a) * (perchR + 0.3), perchY - 1.4, PZ + Math.cos(a) * (perchR + 0.3), 3.4 + (i % 2), a, 0.9); }
  const [S0, S1] = GULF.stone;
  K.add(M.dark, box(S1 - S0 + 1, 0.04, 1.0, (S0 + S1) / 2, perchY + 0.02, PZ));
  add(Ball, { id: 'ballP', a: [S0, perchY + 0.04, PZ], b: [S1, perchY + 0.04, PZ], r: 1.1 });
  add(Plate, { id: 'pP', at: [S0, perchY, PZ], r: 1.3 });
  add(Plate, { id: 'pQ', at: [S1, perchY, PZ], r: 1.3 });
  add(Updraft, { at: [GULF.column, 2, PZ], r: 3, h: GULF.top - 2, lift: 7.5, when: { not: { drumOn: ['ballP', 'pP'] } }, still: 'Still air: the column’s stone sits in its throat, up on the perch.' });
  // (issue #436) its breath over the second leg while it rises: off its top the wings glide on to the higher ledge as out in the world
  add(WingAir, { min: [-GX, farY - 4, PZ], max: [GX, GULF.top + 2, FZ + 1], when: { not: { drumOn: ['ballP', 'pP'] } } });
  K.add(M.trim, T(annulus(2.9, 3.4, 0.2, 32), [GULF.column, 2.1, PZ]));
  add(Mark, { room: 'perch', at: [-2.4, perchY, PZ - 3.2], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [7, farY, FZ + 6], yaw: Math.PI });
  // the way back: off the higher ledge through its east doorway onto a sill, down into the passage outside the gulf's wall
  // (a drop no jump climbs back), along it, and up its stairs through the doorway onto the near lip
  {
    const [X0, X1] = WB.x, xm = (X0 + X1) / 2, Y = WB.y, zN = G0 + WB.near, zF = FZ + WB.far, zS = zN + 2.2 + WB.stairs, top = farY + 7;
    K.slab(GX, zN - 2.2, X1, zN + 2.2, 32, 0.8);                 // the near landing, through its doorway
    K.stairs([xm, Y, zS], [xm, 32, zN + 2.2], X1 - X0, { sides: false });
    K.slab(X0, zS - 0.4, X1, zF + 2.4, Y, 0.8);                  // the passage's floor
    K.slab(GX, zF - 1.6, X0 + 2, zF + 1.6, farY, 0.8);           // the sill off the higher ledge, over the drop
    K.wall(X1 + 0.4, zN - 2.6, X1 + 0.4, zF + 2.8, Y - 0.8, top - Y + 0.8, { t: 0.8 });
    K.wall(X0, zF + 2.8, X1 + 0.8, zF + 2.8, Y - 0.8, top - Y + 0.8, { t: 0.8 });
    K.wall(X1 + 0.8, zN - 2.6, X0, zN - 2.6, 31.2, top - 31.2, { t: 0.8 });
    K.both(M.wall, box(X1 - X0 + 1.2, 0.8, zF - zN + 6.2, xm + 0.2, top + 0.4, (zN + zF) / 2 + 0.1));
    // a stone feather over each doorway, as over the house's other ways (the way back reads as a way)
    for (const [z, y] of [[zN, 32], [zF, farY]]) feather(M.trim, GX - 0.3, y + 4.9, z, 2.2, Math.PI / 2, 0.15);
  }

  // ---- the corridor, and the Roost (floor farY): a round hall under the open sky; two vents in its floor, one stone
  const RY = farY, F0 = FZ + 12;
  K.corridor([0, F0 + 0.6], [0, F0 + 3.4], RY, DOOR);
  add(Door, { id: 'd3', at: [0, RY, F0 + 0.6], ...DOOR, locked: 'A great lock. It wants the house’s great key. The doorway in the ledge’s east wall goes back to the near side.' });
  add(Mark, { room: 'ante', at: [2.2, RY, F0 - 0.2], yaw: -Math.PI / 2 });
  const HR = 19, CL = F0 + 3.4 + HR;
  K.rotunda({ x: 0, z: CL, y: RY, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0.6 });
  // the roost's stone: in the west vent the wind rises from the east one, and the other way round
  K.add(M.dark, box(ROOST.vent * 2 + 1.6, 0.04, 1.0, 0, RY + 0.02, CL));
  add(Ball, { id: 'ballR', a: [-ROOST.vent, RY + 0.04, CL], b: [ROOST.vent, RY + 0.04, CL], r: 1.1, friction: 0.3 });   // (one push carries it across)
  add(Plate, { id: 'pRW', at: [-ROOST.vent, RY, CL], r: 1.3 });
  add(Plate, { id: 'pRE', at: [ROOST.vent, RY, CL], r: 1.3 });
  rt.roostWinds = [
    add(Updraft, { at: [ROOST.vent, RY, CL], r: 4.5, h: 16, lift: 6, when: { drumOn: ['ballR', 'pRW'] }, hint: 'The wind rushes up out of the vent. Open your wings in it.' }),
    add(Updraft, { at: [-ROOST.vent, RY, CL], r: 4.5, h: 16, lift: 6, when: { drumOn: ['ballR', 'pRE'] }, hint: 'The wind rushes up out of the vent. Open your wings in it.' }),
  ];
  // (issue #436) the Roost is the wings' own hall: its breath holds open wings up all round her, as out in the world
  add(WingAir, { min: [-HR, RY - 1, CL - HR], max: [HR, RY + 24, CL + HR] });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3; if (off(a, 0) < 0.4 || off(a, Math.PI) < 0.4) continue; feather(M.trim, Math.sin(a) * (HR - 0.8), RY, CL + Math.cos(a) * (HR - 0.8), 14, a + Math.PI, 0.2); }
  add(Door, { id: 'd5', at: [0, RY, CL + HR + 0.7], ...DOOR, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door, issue #356)
  const XZ = CL + HR + 10;
  K.corridor([0, CL + HR + 0.6], [0, XZ], RY, DOOR);
  K.wall(4.2, XZ, -4.2, XZ, RY, DOOR.h, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, RY, XZ + 0.5]));
  K.solid(box(4, 5, 0.5, 0, RY + 2.5, XZ + 0.9));

  const model = elderGuardian();
  model.pos.copy(K.world(0, RY, CL + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, RY, CL + 5);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, RY, CL), r: HR, y: K.world(0, RY, 0).y };

  // (the stack's rooms last: their marks after the others, so the machines' ids by mark stay as they were)
  stack(rt, K, M, { C2, WR, feather });
  // (v1.83, issue #407: the Fledgery's mark last of all, the machines' ids by mark as they were)
  add(Mark, { room: 'fledge', at: [7, GY, FL.z1 - 3.5], yaw: Math.PI });
  add(Mark, { room: 'gallery', at: [Math.sin(2.1) * (WR - GW / 2), GY, C2 + Math.cos(2.1) * (WR - GW / 2)], yaw: -2.1 });
  const W = (x, y, z) => K.world(x, y, z);
  const Mo = STACK.moult, E = STACK.eyrie;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(Mo.x - Mo.w / 2 - 4, -6, -3), V(C3x + WING.r + 4, Math.max(WH, GULF.top, RY + 24) + 22, XZ + 2)),
    gadget: { at: W(C3x, 16.62, C2).toArray(), face: K.heading(-Math.PI / 2) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, RY + 0.5, XZ - 0.4), r: 1.5 }],
    lights: [[0, 5, 6, 10], [0, 8, H.z0 + 16, 24], [0, 8, HZ1 - 16, 24], [0, 10, C2, 22], [-24, 8, C2 - 12, 20], [24, 8, C2 + 10, 20], [-8, 8, C2 + 26, 20], [12, 7, C2 - 25, 18], [16, 22, C2 + 4, 24], [0, 6, (PZ0 + PZ1) / 2, 18], [0, GY + 8, FL.z, 20], [Mo.x, 8, C2, 22], [0, 36, C2, 22], [E.x, 38, C2, 22], [C3x, 22, C2, 16], [0, 40, TZ, 22], [0, 36, G0 + 20, 24], [0, 36, PZ + 10, 24], [0, RY + 6, CL, 18], [GX + 3.2, 31, G0 + 30, 20], [GX + 3.2, 31, FZ - 16, 20]],
    guardian: { def: { ...ELDER, helper: 'elderflight', resolved: 'The Elder is safe at the Old Roost. The Aerie’s wind returns.', onHit: elderHit, openFor: elderOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Aerie on the plain
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 14;
  const base = level.ground.baseAt(SITE.x, SITE.z, SITE.r + 6) - 0.6;
  const K = new TempleKit(rt.root, 'The Aerie', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 10;
  const glyphM = makeMaterial({ color: PALETTE.glow, glow: 0.2, flat: true, key: 'temple.vael.glyph' });
  landmark(K, 'arzach', { y: sill, R, accent: glyphM });
  // The tall blue pointed arch is part of the swept shell. Its dark recess stays
  // behind the retained portal, so approaching the new door takes the same route in.
  // (the teal frames, two, stepping back into the ochre arch; their light pale peach: src/temples/portal.js)
  const P = portal(K, { y: sill, z: R + .9, w: 6, h: 17.8, shape: 'pointed', layers: 2, step: 3.6, recess: .6, back: .9, into: 4, foot: .08,
    frame: lmCeramic('#409aa8'), inlay: '#ffd9b8' });
  // the great steps down to the plain
  const foot = level.ground.heightAt(...(() => { const p = K.world(0, 0, R + 34); return [p.x, p.z]; })()) - base;
  K.stairs([0, sill, R + 10], [0, Math.max(0.2, foot), R + 34], 22, { rise: 0.4, sides: false, mat: { paint: new THREE.Color('#ebb083'), smooth: false } });
  K.flush();
  const at = K.world(0, sill, R + 1.4);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base, R, sill, glyphM, perch: landmarkFrame(K, 'arzach', sill).world(0, sill + 37.8, -4), clear: [{ x: SITE.x, z: SITE.z, r: 82 }] };
}

// ------------------------------------------------------------------ the world change: the birds come back
/**
 * Once the Elder flies again the Aerie is a roost once more: she sits on its crown with her wings open,
 * the glyph lines on its drum glow, and a flock of the great birds wheels over it, high and slow.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Aerie’s birds (the world change)';
  rt.root.add(root);
  root.visible = false;
  // the Elder on the crown
  const perched = O ? elderGuardian() : null;
  if (perched) {
    perched.pos.copy(O.perch);
    perched.heading = SITE.heading;
    perched.group.position.copy(perched.pos);
    perched.group.rotation.y = perched.heading;
    root.add(perched.group);
  }
  // the flock: great white birds, soaring (a body, two long wings, a beak)
  const birdM = makeMaterial({ color: '#f4efe2', flat: true, key: 'temple.vael.bird' });
  const g = mergeGeometries([
    new THREE.SphereGeometry(1, 8, 6).scale(0.9, 0.7, 2.2),
    new THREE.SphereGeometry(1, 8, 4).scale(5.2, 0.12, 1.3).translate(4.6, 0.25, -0.2).rotateZ(0.12),
    new THREE.SphereGeometry(1, 8, 4).scale(5.2, 0.12, 1.3).translate(-4.6, 0.25, -0.2).rotateZ(-0.12),
    new THREE.ConeGeometry(0.25, 2.2, 6).rotateX(Math.PI / 2).translate(0, 0.2, 3.1),
  ].map((x) => x.toNonIndexed()));
  const flock = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(g, birdM);
    m.userData.noCollide = true; m.userData.dynamic = true;
    root.add(m);
    flock.push({ m, r: 38 + (i % 4) * 11, y: 58 + (i % 3) * 12, w: (0.11 + (i % 3) * 0.025) * (i % 2 ? 1 : -1), a: (i / 8) * TAU });
  }
  let k = 0, want = 0;
  const apply = () => { root.visible = k > 0.01; };
  return {
    root, flock, perched,
    dispose() { perched?.dispose?.(); },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 4 : -dt / 2), 0, 1); apply(); }
      if (O) O.glyphM.uniforms.uGlow.value = 0.2 + 0.7 * k;
      if (!root.visible) return;
      const base = O ? O.base : 0;
      for (const b of flock) {
        b.a += b.w * dt;
        const x = SITE.x + Math.sin(b.a) * b.r, z = SITE.z + Math.cos(b.a) * b.r, y = base + b.y + Math.sin(t * 0.3 + b.a * 2) * 4;
        b.m.position.set(x, y, z);
        b.m.rotation.set(0, b.a + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2), (b.w > 0 ? -0.35 : 0.35), 'YXZ');
      }
      perched?.animate(dt, t, { state: 'resolved', attack: null, k: 0, meter: 1, phase: 0 });
    },
  };
}

export const ARZACH_TEMPLE = {
  id: 'arzach', levelId: 'arzach', name: 'The Aerie', doorLabel: 'door of the Aerie',
  // The Wind Well and Gulf need readable landings, not the open sky's 13.4 m chase.
  glideCamera: { arm: 6.4, keepTight: true },
  gadget: 'glider', gadgetBox: 'arzach.temple.glider', arenaDoor: 'd3', arenas: ARENAS,
  origin: shiftAt('arzach', [-200, 1600, 300]), yaw: 0,   // (its rooms over Vael's plain, where they always were from it: names.js PART_OFFSET)
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (inside, its futuristic look, after the author's picks: src/temples/skins/aerie.js; issue #342)
  skin: aerieSkin,
  local: { person: 'lark', out: 16, side: 7 },
  enterLine: 'Inside the Aerie it is bright and white and the wind never stops. Far overhead, something heavy shifts its feathers.',
  pitLine: 'You climb back up to the last glyph stone.',
  // the wings come first: Vael's tower is climbed on the wind with them, so the quest starts when you land without them
  startsOnArrival: () => !items.has('glider'),
  arrivalLine: 'The makers left a pair of wings in Vael: in the Aerie, the white house on the plain west of the landing.',
  onResolved(rt) { rt.notice('Out over the plain the great birds are coming back to the Aerie.', 'resolved.out'); },
  /** (issue #562) The wind back: once the Elder is calm both of the roost's vents breathe, stone or no stone (rt.calmK: its ending raises the still one in its own panel). */
  onCalm(rt, k) { for (const w of rt.roostWinds ?? []) w.forced = k > 0.02; },
  // she will not fly alone: ride the wind beside her while she looks up, afraid (in her second phase the wind out of
  // a vent lifts her twice as high; in her last only the wind will do: roll the stone so it rises by her)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G || G.def.helper) return;
    let flown = 0;
    const upd = G.update.bind(G), _c = V();
    G.update = (dt, t) => {
      upd(dt, t);
      const P = rt.player;
      if (!P || G.state !== 'open') { flown = 0; return; }
      const i = Math.min(G.phaseIndex, 2);
      // aloft (her second phase on), she drifts over the nearer of the two vents and hangs there, looking up: the wind
      // has to come out of that one (the stone in the other)
      if (i >= 1 && rt.roostWinds?.length) {
        const m = G.model, w = rt.roostWinds.reduce((b, x) => (Math.hypot(x.foot.x - m.pos.x, x.foot.z - m.pos.z) < Math.hypot(b.foot.x - m.pos.x, b.foot.z - m.pos.z) ? x : b));
        const dx = w.foot.x - m.pos.x, dz = w.foot.z - m.pos.z, d = Math.hypot(dx, dz);
        if (d > ROOST.over) { const step = Math.min(d - ROOST.over, ROOST.drift * dt); m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step; G.keepIn(); }
      }
      _c.copy(G.model.pos).add(V(0, 4.4, 0));
      const near = Math.hypot(P.pos.x - _c.x, P.pos.z - _c.z) < ROOST.near && Math.abs(P.pos.y - _c.y) < ROOST.near;
      const wind = inWind(rt, P.pos);
      if (near && P.gliding) {
        if (!wind && !ROOST.still[i]) { flown = 0; rt.notice('She watches you sink past her on still air, and does not follow.', `elder.still.${G.phaseIndex}`); return; }
        if ((flown += dt) > ROOST.ride) {
          flown = 0;
          G.add(wind ? ROOST.wind[i] : ROOST.still[i], wind ? 'wind' : 'flown');
          rt.sound?.chime?.();
          if (wind && i >= 1) rt.notice('You ride the wind up beside her, and it lifts her high, unafraid.', `elder.wind.${G.phaseIndex}`);
          else rt.notice('She watches you ride the wind beside her, and her wings lift.', `elder.flown.${G.phaseIndex}`);
          if (G.state === 'open') { G.enter('fight'); G.cool = 2.2; }
        }
      } else {
        if (near && P.onGround) rt.notice('She will not go alone.', 'elder.alone');
        flown = Math.max(0, flown - dt);
      }
    };
  },
};
