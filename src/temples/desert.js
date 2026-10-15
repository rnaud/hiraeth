import { landmark } from './landmarks.js';
import { stone } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { magicMaterial, magicPool, setMagic } from '../story/magic-water.js';
import { STORY, ROSE_SITE } from '../desert-sites.js';
import { TempleKit, T, box, lathe, annulus, Z_GAP } from './kit.js';
import { Door, Ball, Brazier, Flame, Bramble, Bridge, Mark, Pit, Sentry, Switch, Plate, Weight } from './pieces.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { keeperGuardian } from './guardian-generated.js';
import { chestMound } from '../boxes/mound.js';

// The desert's temple: the Rose House, the great drum of rose stone the
// people of Qanat call the house of the Givers, standing above the dunes east
// of the city. The Givers kept the water there: a cistern under a dome,
// fed by channels that once ran to Qanat's fields. The water stopped long
// ago; the fields went to sand; the beast the Givers left to keep the cistern
// is still down there in the dark, and it is afraid.
//
// One idea (docs/audits/temple-design-v1.24.md): the Givers carried their fire. A tar ball set burning lights what it
// rolls into (a hooded bowl no hand reaches, the thorns on its groove) until it burns out; rolled past a fire, it
// catches again. Since v1.44 the house is walked into with nothing in your hands (the progression: the backpack and
// the lift valve's double jump, docs/systems/progression.md): you lean on its first ball by hand, cross its sand on
// the double jump, and find the Givers' blade half-way, then their guard: a cut sends a ball rolling far faster than
// hands can, through a fire and on before it burns out; the guard sends their watcher's bolt back into its eye.
//
// Since issue #336 (docs/design/temple-redesign.md) the house keeps the redesign's rules: rooms 36 m across under 18 to
// 24 m of stone, doors 7 m by 9, every puzzle in the middle of its own room and never rolled through a door, and every
// room about a puzzle or a fight, never both: the machines stand only in their own hall, round its middle.
//
// Inside (built far overhead, through its door), in order (each room's kind in LOGIC.rooms):
//   the Threshold        (a passage) a stair hall under an oculus: the first mark, the way back out
//   the Hall of the Flame (a puzzle) the pilot flame that never went out, in the floor on a tar ball's groove down the
//                        middle of the hall: lean on the ball (it rolls ahead of you at your pace: Ball `shove`) through
//                        the flame and on into the hooded bowl at the groove's end before it burns out (pieces.js Ball
//                        `tar`, Brazier `hood`); the bowl lit, the door in the north wall sinks
//   the Dry Channel      (a puzzle) a sand pit across the hall, one pier of the old channel standing in its middle: too far
//                        for one jump either side, a double jump each (its side walls glazed smooth by the old water: no
//                        climbing round it); a plate on the pier's head holds the chamber's door at the top of the gallery
//                        open while it is weighed down: stood on, it opens, stepped off, it shuts; the Givers' weight at
//                        the pier's other end, carried onto it, holds it (issue #337: the house's first carry); a wall to
//                        climb
//   the Sword Chamber    (the chest) the makers' chest on a dais under the oculus: THE GIVERS' BLADE (src/items.js
//                        'sword'). Its north door sinks for the blade in your hand
//   the Machines' Hall   (a fight) the blade taken, the Givers' machines wake in the walls: step in and its doors hold
//                        until they are broken (an arena, `ARENAS`; they stand round the hall's middle, its mark's `foes`)
//   the Hall of Fires    (a puzzle) the near floor and a chasm: down the middle of the floor a tar ball's groove, a fire
//                        and thorns on it, to the hooded bowl on the chasm's lip (cut the thorns, the blade alone, where
//                        failure costs nothing; leaned on, the ball burns out on the way; cut, it is there in time); the
//                        bowl lit, the bridge rises over the chasm to the far ledge and the archway beyond
//   the Watcher's Hall   (a puzzle) the Givers' second chest by the west wall: THEIR GUARD (src/items.js 'shield', a
//                        `find`). The guard taken, the Givers' watcher in the middle of the hall wakes (a Sentry, issue
//                        #245): its eye holds a beam on you and fires a bolt down it; taken on the guard, the bolt flies
//                        back into its eye, it breaks, and the east door sinks open
//   the Hall of Channels (a puzzle) the Givers' old channels in its floor; down its middle a ball and a fire at the south
//                        end, the long groove to the hooded bowl at its north end: a ball cut down it burns out short,
//                        unless the relay's lid is off: the eye high on the obelisk beside the groove, struck from a
//                        double jump (a Switch `blade`), lifts it, and wakes the keepers' door back to the Hall of Fires'
//                        near floor (the shortcut, from the far side); the bowl lit, the north door sinks
//   the antechamber      (a passage)
//   the Cistern          (the guardian) the Keeper (an organic guardian: calm it, never hurt it). The dark round the
//                        walls frightens it: cut each spoke's ball out through its little fire into the hooded bowl on
//                        the rim. It charges: a guard against the charge jars it and it pants (it was thirsty): give it
//                        water from your tank. It turns to fire: a ball cut down a spoke from a lit bowl rolls burning to
//                        it and it pants in the light (taught in its second phase); in its last it pants only so. Then
//                        lay a hand on its brow.
// After: the water rises in the cistern and runs out of the house again, down the old channel;
// round Qanat the old fields turn green (the world change, `change` below).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/**
 * The house's doors (m: issue #336, 5 by 6 before) and its rooms in the kit's local frame (z into the house): each hall's
 * floor from wall to wall, its floor's height and its ceiling's, the Dry Channel's ledges and the Hall of Fires' lip.
 */
export const DOOR = { w: 7, h: 9 };
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  flame: { x0: -18, x1: 18, z0: 15.2, z1: 54, y: 0, top: 20 },
  channel: { x0: -18, x1: 18, z0: 55.2, z1: 98, y: -9.5, top: 24, ledge: 63.2, landing: 84.7, gallery: 90.7 },
  chest: { x: 0, z: 115.2, r: 13, y: 7, top: 23 },
  machines: { x0: -18, x1: 18, z0: 131.8, z1: 163.8, y: 7, top: 25 },
  fires: { x0: -18, x1: 18, z0: 165, z1: 207, y: -3.5, top: 25, lip: 191, far: 204 },
  watch: { x0: -18, x1: 18, z0: 208.2, z1: 240.2, y: 7, top: 25 },
  wing: { x0: 19.2, x1: 55.2, z0: 165, z1: 240.2, y: 7, top: 25 },
  cistern: { x: 37.2, z: 267.9, r: 18, y: 7, top: 29 },
};
/**
 * The Dry Channel's pier (the kit's x and z): its middle, width and depth, where the Givers' weight lies at its west end
 * (issue #337); 9 m of air either side of it (one jump is about 6 m, the double jump 13).
 */
export const PIER = { x: -0.5, w: 8.6, d: 3.4, z: 73.95, weight: -3.3 };

/** Where the house stands in the dunes (world x, z) and which way its door looks (toward Qanat). */
export const SITE = { ...ROSE_SITE };
SITE.heading = Math.atan2(STORY.city.x - SITE.x, STORY.city.z - SITE.z);

/**
 * The house's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/givers-house):
 * warm rose stone laid in ashlar courses, a darker course under the frieze and at the plinth, rose-tan flags, the frames in
 * the darker rose, the fittings (braziers, plate rims) old bronze gone green; its shade a deep rose, its light warm.
 */
export const PALETTE = {
  wall: '#dc9583', wall2: '#d38976', wall3: '#e3a491', floor: '#d9a691', floor2: '#cc9681', trim: '#c47b6b', fitting: '#9c8a5c',
  dark: '#5a3640', stone: '#e6ae9b', accent: '#dd8f86', glow: '#70e7df', glyph: '#8a4a4c', lamp: '#f6c84e', sand: '#e8cf9c', sand2: '#dcbd86',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.9, shade: 0.35, hatch: 0.6 },
    wall: { mode: 0, grid: 2.2, plates: true },
    wallGlyph: { grid: 2.2 },
    glyph: { glow: 0.1 },
  },
  bands: [{ at: 0.72, h: 1.7, color: '#c98071' }, { y: 0.45, h: 0.9, color: '#bb7161' }],
  ornament: { kind: 'mark', color: '#8a4a4c', color2: '#8a4a4c' },
  light: { shadow: '#c79aa3', light: '#fff0e0', sun: '#ffe6c4' },
};

// ------------------------------------------------------------------ the puzzle, as logic (src/temples/logic.js)
// (a drum's `roll`: what moves it, `hand` a shove, `sword` a cut: logic.js solve; the bowls a cut ball reaches `need` the
// sword, the rooms past the watcher the shield)
export const SPOKES = ['kb1', 'kb2', 'kb3', 'kb4'], RIM = ['b6', 'b7', 'b8', 'b9'];
export const LOGIC = {
  id: 'desert', entry: 'threshold', gadget: 'sword',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, flame: { checkpoint: true, kind: 'puzzle' }, channel: { checkpoint: true, kind: 'puzzle' },
    landing: { kind: 'passage' }, chest: { checkpoint: true, kind: 'chest' }, machines: { checkpoint: true, kind: 'combat' },
    fires: { checkpoint: true, kind: 'puzzle' }, firesFar: { kind: 'puzzle' }, wing: { checkpoint: true, kind: 'puzzle' },
    ante: { checkpoint: true, kind: 'passage' }, cistern: { boss: true, kind: 'guardian' }, spring: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'flame' },
    { a: 'flame', b: 'channel', door: 'd1' },
    { a: 'channel', b: 'landing', needs: ['doublejump'] },   // over the pier on the double jump
    { a: 'landing', b: 'chest', door: 'dc' },     // up the gallery's wall, to the chamber's door the pier's plate wakes
    { a: 'chest', b: 'machines', door: 'dk' },    // the chamber's north door: it sinks for the blade in your hand
    { a: 'machines', b: 'fires', door: 'dm' },    // the Machines' Hall's way on: won, it opens
    { a: 'fires', b: 'firesFar', door: 'br1' },   // the bridge, to the archway into the Watcher's Hall
    { a: 'firesFar', b: 'wing', door: 'dw' },     // the Watcher's Hall's east door: shut until the watcher is broken
    { a: 'fires', b: 'wing', door: 'sc' },        // the keepers' door: the shortcut, woken from the wing's side
    { a: 'wing', b: 'ante', door: 'd3' },
    { a: 'ante', b: 'cistern', door: 'd4' },
    { a: 'cistern', b: 'spring', door: 'd5' },
  ],
  elements: {
    // the Hall of the Flame: the tar ball leaned on through the pilot flame into the hooded bowl at its groove's end
    pb0: { type: 'plate', room: 'flame' },                                            // (the bowl's mouth)
    ball1: { type: 'drum', room: 'flame', plate: 'pb0', plateAt: 1, start: 0, roll: 'hand' },
    b0: { type: 'brazier', room: 'flame', when: { drumOn: ['ball1', 'pb0'] } },     // hooded: only the ball lights it
    d1: { type: 'door', opens: { lit: 'b0' }, latch: true },
    // the Dry Channel's pier: a plate on its head holds the chamber's door at the top of the gallery open while weighed down,
    // across the pit; the Givers' weight at the pier's other end, carried onto it, holds it (issue #337)
    wP: { type: 'weight', room: 'channel', plate: 'pp' },
    pp: { type: 'plate', room: 'channel' },
    dc: { type: 'door', opens: { pressed: 'pp' } },
    // the Sword Chamber: the blade; its north door sinks for it in your hand
    chest: { type: 'gadget', room: 'chest', item: 'sword' },
    dk: { type: 'door', opens: { item: 'sword' }, latch: true },
    // the Machines' Hall: its doors hold while its machines stand and you are in it; won, its way on opens
    arM: { type: 'arena', room: 'machines' },
    dm: { type: 'door', opens: { lit: 'arM' }, latch: true },
    // the Hall of Fires: thorns over the tar ball's groove (cut them), a fire on it, the hooded bowl on the chasm's lip
    bw0: { type: 'bramble', room: 'fires', needs: ['sword'] },
    pb3: { type: 'plate', room: 'fires' },
    ball3: { type: 'drum', room: 'fires', plate: 'pb3', plateAt: 1, start: 0, roll: 'sword' },
    b3: { type: 'brazier', room: 'fires', needs: ['sword'], when: { drumOn: ['ball3', 'pb3'] } },
    br1: { type: 'bridge', opens: { lit: 'b3' }, latch: true },
    // the Watcher's Hall: the Givers' guard
    guard: { type: 'find', room: 'firesFar', item: 'shield', box: 'desert.temple.shield' },
    // the Givers' watcher in the middle of the hall: it wakes with the guard in hand; its bolt sent back breaks it, and the door opens
    sentry: { type: 'switch', room: 'firesFar', needs: ['shield'] },
    dw: { type: 'door', opens: { lit: 'sentry' }, latch: true },
    // the Hall of Channels: the eye that lifts the relay's lid (and wakes the keepers' door), the ball, the bowl at the groove's end
    e10: { type: 'switch', room: 'wing', needs: ['sword'] },
    sc: { type: 'door', opens: { lit: 'e10' }, latch: true },
    pb4: { type: 'plate', room: 'wing' },
    ball4: { type: 'drum', room: 'wing', plate: 'pb4', plateAt: 1, start: 0, roll: 'sword' },
    b4: { type: 'brazier', room: 'wing', needs: ['sword'], when: { all: [{ drumOn: ['ball4', 'pb4'] }, { lit: 'e10' }] } },
    d3: { type: 'door', opens: { lit: 'b4' }, latch: true },
    d4: { type: 'door', opens: null },                            // the arena's door: shut while the Keeper is awake
    // the cistern's spokes: each ball cut out through its fire into the hooded bowl on the rim
    ...Object.fromEntries(SPOKES.flatMap((b, i) => [[`pk${i + 1}`, { type: 'plate', room: 'cistern' }], [b, { type: 'drum', room: 'cistern', plate: `pk${i + 1}`, plateAt: 0, start: 1, roll: 'sword' }]])),
    ...Object.fromEntries(RIM.map((id, i) => [id, { type: 'brazier', room: 'cistern', needs: ['sword'], when: { drumOn: [SPOKES[i], `pk${i + 1}`] } }])),
    keeper: { type: 'boss', room: 'cistern', needs: ['sword', 'shield'], requires: { all: RIM.map((id) => ({ lit: id })) } },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

/**
 * The Machines' Hall (an arena: src/temples/runtime.js updateArenas): step in with its machines standing and its doors
 * hold behind you until they are broken; won, its way on opens for good. Its machines (src/foes.js, the blade in hand)
 * stand round the hall's middle (its mark's `foes`), never in a puzzle's room.
 */
export const ARENAS = [{
  el: 'arM', room: 'machines', zone: { min: [ROOMS.machines.x0, 6, ROOMS.machines.z0], max: [ROOMS.machines.x1, 16, ROOMS.machines.z1] }, doors: ['dk', 'dm'], extra: 1,
  shut: 'The hall’s doors grind shut. The Givers’ machines are waking in the walls.',
  won: 'The last of the machines falls still, and the doors sink open.',
}];

// ------------------------------------------------------------------ the guardian
export const KEEPER = {
  kind: 'organic', name: 'the Keeper of the cistern', final: 'touch', touch: 'lay a hand on its brow',
  speed: 2.2, wakeTime: 3.2,
  wake: 'Something vast unfolds in the dark of the cistern. It is afraid of you.',
  openHint: 'It pants, its mouth open: give it water from your tank.',
  weary: 'It lowers its head to the dry spout, worn out. Go to it.',
  resolved: 'It breathes out, and the stone under the spout begins to sweat.',
  missHint: 'Its forefeet are wedged in the stone, mouth open. Give it water.',
  // (v1.69, issues #314 and #316, the first guardian made fair: a longer breath between its moves, every move ending
  // in an opening, its three-blow sweep only in its last phase, lighter blows; in its last phase the dark no longer
  // shuts its mouth, it gasps a moment (keeperOpen), and a fire by it still makes it pant longer)
  // (v1.71, issue #320, "I need to hit him too many times … Ocarina of Time bosses, 3 phases": three phases of two
  // each: two braziers lit (KEEPER_LIGHT), then two drinks, then two more; an opening holds while it drinks (a gulp each
  // KEEPER_GUARD.gulp s), so one opening may end a phase: 10 calming acts over 6 openings before, 6 over 2 to 4 now)
  phases: [
    { to: 0.4, attacks: ['stamp', 'sweep'], pause: 2.4, hint: 'Light two braziers: cut a spoke’s ball out through its fire.' },
    { to: 0.6, attacks: ['sweep', 'charge', 'stamp'], pause: 2.0, hint: 'Guard its charge, then water it. Or cut a lit ball down a spoke.' },
    { to: 0.8, attacks: ['leap', 'spit', 'sweep2', 'charge'], pause: 1.8, hint: 'It leaps at you now. Water it as it gasps, or roll a lit ball to it.' },
    { to: 1.0, weary: true },
  ],
  // (its body's wind-ups are its tells, issue #320: no spark on the striking part, src/temples/boss.js tells)
  glow: false,
  // (in its cistern, the boss framing: src/player.js BOSS_CAM, the camera further back and higher, both of you in it)
  camera: {},
  // (between its moves it keeps its head on you as it circles, stepping sideways: boss.js walk; it turned its tail to you)
  faceYou: true,
  // (its shell and head kept inside its cistern's wall and off its spout: boss.js keepIn, issue #320)
  keepIn: true,
  // its moves (src/temples/boss.js): read from its body, never the floor, and landing with its body: each blow is its
  // posed bones (`parts`: the jaw and head, the forefeet, the shell) meeting you over its `active` s, so what you see
  // hit you is what hits you (the shapes are the procedural body's, and how far it comes for you first: `reach`).
  // The sweep swings its lowered head across and ends in a stamp (the punish to read, then it pants); in its last phase
  // the sweep swings back once first. A charge or a stamp that misses wedges it, panting; the charge and the stamp are
  // the guard's to take (`guard`: jarred, it pants, KEEPER_GUARD); a spit leaves its mouth open. Its leap (issue #320: it
  // burrowed, in a cistern of cut stone) crouches low, springs (`leap`: over its wind-up's last third, the spot fixed
  // when it springs: its shadow runs ahead to it) and lands on you with its shell and feet, then lies winded.
  attacks: {
    stamp: { shape: 'ring', at: 'front', ahead: 2.2, radius: 2.8, wind: 1.35, part: 'feet', rig: 'rear', parts: ['feet'], active: 0.15, reach: 4.6, damage: 0.75, knock: 7, recover: 1.1, open: 1.6, miss: 2.6, guard: true },
    sweep: { shape: 'cone', range: 6.5, angle: 0.75, wind: 1.3, track: 0.6, part: 'mouth', rig: 'coil', twist: 0.18, side: 1, parts: ['head'], active: 0.3, reach: 6.2, damage: 0.5, knock: 8, recover: 1.0, gap: 0.5, then: 'stampEnd' },
    sweep2: { shape: 'cone', range: 6.5, angle: 0.75, wind: 1.3, track: 0.6, part: 'mouth', rig: 'coil', twist: 0.18, pose: 'sweep', side: 1, parts: ['head'], active: 0.3, reach: 6.2, damage: 0.5, knock: 8, recover: 1.0, gap: 0.5, then: 'sweepBack' },
    sweepBack: { shape: 'cone', range: 6.5, angle: 0.75, wind: 0.9, track: 0.5, part: 'mouth', rig: 'coil', twist: 0.18, pose: 'sweep', side: -1, link: true, parts: ['head'], active: 0.3, reach: 6.2, damage: 0.5, knock: 8, gap: 0.5, then: 'stampEnd' },
    stampEnd: { shape: 'ring', at: 'front', ahead: 2.2, radius: 2.8, wind: 1.1, part: 'feet', rig: 'rear', pose: 'stamp', link: true, parts: ['feet'], active: 0.15, reach: 4.6, damage: 0.75, knock: 7, recover: 1.0, open: 2.6 },
    charge: { shape: 'lane', range: 13, width: 3.4, wind: 1.4, track: 0.6, part: 'head', rig: 'crouch', dash: 8, parts: ['head', 'feet', 'body'], active: 0.45, reach: 13, damage: 0.75, knock: 9, recover: 1.2, open: 2.0, miss: 2.8, guard: true },
    leap: { shape: 'ring', at: 'player', radius: 3.0, wind: 2.0, track: 0.55, over: true, leap: [0.6, 0.97], rig: 'crouch', part: 'core', parts: ['body'], late: 0.06, active: 0.35, damage: 0.75, knock: 9, recover: 1.4, open: 3.2 },
    spit: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.0, wind: 1.5, track: 0.6, part: 'mouth', rig: 'lean', damage: 0.5, knock: 5, recover: 0.8, open: 1.8 },
  },
};
/**
 * s: how long it pants after a charge (or a stamp) your guard took; a drink from your tank calms it this much (half a
 * phase); it drinks again `gulp` s after a drink, while it is open (v1.71: one drink and it shut its mouth).
 */
export const KEEPER_GUARD = { open: 2.8, water: 0.1, gulp: 0.6 };
/** Its first phase: each rim brazier lit calms it this much (two of the four end it; a tenth each before v1.71). */
export const KEEPER_LIGHT = 0.2;
/**
 * Its last phase in the dark (v1.69, issue #316: "none in the third phase?"): its own openings (and your guard's jar)
 * come as a gasp of `open` s at most, and a drink then calms it `water` of a full one (a sip, half, before v1.71: four
 * gasps it took); a fire rolled to it still makes it pant (HEARTH_FIRE.open), long enough for both its drinks.
 */
export const KEEPER_DARK = { open: 1.8, water: 1 };

// where the Hall of Fires' ball stops against the thorns on its groove (t along it: 14.6 m, its front at the tangle's
// face); its groove (x, and z from start to end) and the bowl on the chasm's lip past its end; the keepers' door in the
// Hall of Fires' east wall and the Watcher's Hall's east door into the Hall of Channels (z); the Hall of Channels' groove
// (x, and z from its start at the south end to its end), and its ball: how freely it rolls, how long it burns (cut at the
// start it goes out about 2 m short of the bowl, 1.5 s before it settles there; caught again at the relay it gets there
// with 2 s to spare, issue #311: it had a fifth of a second), and where its relay fire lies (m along the groove: burning
// there, it carries the ball on to the bowl); the eye's obelisk beside the groove (x, z)
const CHEST_THORNS = 7.35 / 14.6;
export const FIRES = { x: 5, z0: 174.2, z1: 188.8, bowl: 190.2, bridge: -5 };
const SC_Z = 171, WING_Z = 232;
export const WING = { friction: 0.2, burns: 6, relay: 20.5, x: 37.2, z0: 186.5, z1: 215.4, bowl: 216.8, eye: [44, 203] };
/** The Givers' watcher (issue #245): its foot in the middle of the Watcher's Hall, east of its way in. */
export const SENTRY_AT = [5, 7, 226];
/** The Hall of Fires' ball: rolls freely, burns briefly (leaned on, at a walk, it goes out before the bowl; cut, it is there). */
export const CHEST_BALL = { friction: 0.25, burns: 3.8, flame: FIRES.z0 + 2.6 };
/**
 * The cistern's spokes: a tar ball in a groove from the basin's edge (`to`, where it starts) out to the hooded bowl on
 * the rim (`from`, its mouth), a little fire beside each groove half-way (`fire`). Cut out, a ball catches and lights its
 * bowl; lying in the lit bowl's mouth it burns on. Cut back in, it rolls burning to the basin: at rest within `near` m of
 * the Keeper it makes it pant (`open` s): in its second phase as well as its own openings, in its last only so
 * (Keeper.openFor). The ball burns `burns` s away from a fire.
 */
export const HEARTH_FIRE = { near: 8.5, open: 3.4, burns: 12, from: 15.4, to: 7.4, bowl: 16.7, fire: 11.4, off: 0.13 };
/** A spoke ball burning, at rest, near the Keeper now (and not spent on it yet): the ball, or null. */
export function fireNear(g) {
  const m = g.model;
  for (const b of g.rt.spokes ?? []) if (b.burn > 0 && b.rest && !b.drop && b.t > 0.5 && Math.hypot(b.center.x - m.pos.x, b.center.z - m.pos.z) < HEARTH_FIRE.near) return b;
  return null;
}
/** Its leap lands where it sprang for (its shadow there before it). */
export function keeperLands(g, a) { if (a.id === 'leap') { g.model.pos.x = g.attackAt.x; g.model.pos.z = g.attackAt.z; } }
/** Its own openings: in its last phase none in the dark, only by a fire rolled to it. */
function keeperOpen(g, a, s) {
  if (g.phaseIndex >= 2 && s && !fireNear(g)) { g.rt.notice('It gasps in the dark, mouth open a moment. A fire by it holds it open.', 'keeper.dark2'); return Math.min(s, KEEPER_DARK.open); }
  return s;
}
/** In its first phase the Keeper's calm is the light round the walls: a tenth for each rim brazier burning. */
function syncLight(g) {
  if (!g || g.phaseIndex !== 0 || !g.awake) return;
  const lit = RIM.filter((id) => g.rt.logic.isLit(id)).length;
  if (lit * KEEPER_LIGHT > g.meter + 1e-6) { g.add(lit * KEEPER_LIGHT - g.meter, 'light'); if (g.phaseIndex === 0) g.rt.notice(['', 'It turns its head to the light, and stills a moment. One more fire.'][lit] ?? null); }
}
/** A charge (or a stamp) your guard took: it reels, and from its second phase it pants (in its last only by a fire). */
function keeperBlocked(g) {
  g.dashing = 0;
  if (g.phaseIndex === 0) { g.rt.notice('It slams into your guard and backs off into the dark, trembling.', 'keeper.guard0'); return; }
  const dark = g.phaseIndex >= 2 && !fireNear(g);
  g.stop(); g.cool = 1.2;
  g.enter('open'); g.openFor = dark ? KEEPER_DARK.open : KEEPER_GUARD.open;
  if (dark) { g.rt.notice('It reels from your guard and gasps, mouth open a moment.', 'keeper.guard2'); return; }
  g.rt.notice('It slams into your guard and reels back, panting, its mouth open.', `keeper.guard.${g.phaseIndex}`);
}
/**
 * Water from your tank in its open mouth: from its second phase, it calms it. It goes on drinking while it is open (a
 * gulp each KEEPER_GUARD.gulp s: issue #320, the Ocarina-like opening a few good hits end), until the phase is done.
 */
function keeperDrinks(g) {
  if (g.state !== 'open' || g.phaseIndex < 1) return false;
  if (g.gulpOf === g.opened && g.t - g.gulpAt < KEEPER_GUARD.gulp) return true;   // (still swallowing the last)
  g.gulpOf = g.opened; g.gulpAt = g.t;
  // (in its last phase, a gasp in the dark the same drink as by a fire: the fire's long pant is room for both)
  g.add(KEEPER_GUARD.water * (g.phaseIndex >= 2 && !fireNear(g) ? KEEPER_DARK.water : 1), 'water');
  g.rt.sound?.critter?.('splash', 1);
  g.rt.notice('It drinks from your cupped hands. Its glyphs glow a little brighter.', null);
  return true;
}

/** What the fluid does to the Keeper (the gun, for whoever carries one in): water in its open mouth calms it; a push frightens it; ember only startles. */
function keeperHit(g, part, mode) {
  const rt = g.rt;
  if (mode === 'blade') { rt.notice('You lower the blade. It is frightened, not wicked: it keeps the water.', 'keeper.blade'); return true; }
  if (mode === 'push') { g.add(-0.05, 'push'); rt.notice('It flinches back from the shove, more frightened than before. Gently.', 'keeper.push'); if (g.state === 'fight' && !g.attack) g.cool = 0; return true; }
  if (g.phaseIndex === 0) { if (mode !== 'fire' && (part === 'mouth' || part === 'body')) rt.notice('It snaps at the fluid, frightened. It is the dark it fears.', 'keeper.dark'); return true; }
  if (g.phaseIndex >= 1) {
    if (part === 'mouth' && g.state === 'open' && (mode === 'shoot' || mode === 'stun')) return keeperDrinks(g) || true;
    if (mode === 'fire') { rt.notice('It flinches from the ember on its shell.', 'keeper.fire'); return true; }
    if (part === 'mouth') rt.notice('Its jaws are shut tight.', 'keeper.wait');
    return true;
  }
  return true;
}

/** The Dry Channel's side walls, glazed smooth by the water that ran there: no hold to climb round the pit by. */
class Glazed {
  constructor(rt, o) { this.rt = rt; this.o = o; this.box = new THREE.Box3(V(...o.min), V(...o.max)); }
  update() {
    const P = this.rt.player;
    if (!P?.climbing || !this.box.containsPoint(this.rt.kit.local(P.pos))) return;
    P.climbing = false; P._climbCooldown = 1.2;
    P.vel.set(0, -1, 0);
    this.rt.notice(this.o.said, 'glazed');
  }
}

// ------------------------------------------------------------------ inside
// (issue #336: every room 36 m across under 18 to 24 m of stone, doors 7 by 9 m, each puzzle in the middle of its room;
// the props stay at a body's scale: the balls, the bowls, the plates, the weight, the chests, the eye, the jumps)
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, R0 = ROOMS;
  // (on the floor at y: the Dry Channel's on its sunk sand, the upper halls' on their floors at 7; solid as drawn: you walk
  // up over them)
  const sandDrift = (x, z, w, d, h, ry = 0, y = 0) => K.both(M.sand, T(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), [x, y - 0.05, z], [0, ry, 0], [w, h, d]));
  /** A tar ball's groove on a floor at y, from (ax, az) to (bx, bz): a dark channel between two trim lips. */
  const groove = (ax, az, bx, bz, y, over = 1) => {
    const L = Math.hypot(bx - ax, bz - az) + over, ry = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    K.add(M.dark, box(1.0, 0.04, L, cx, y + 0.02, cz, ry));
    for (const s of [-1, 1]) K.add(M.trim, box(0.25, 0.12, L, cx + Math.cos(ry) * 0.75 * s, y + 0.06, cz - Math.sin(ry) * 0.75 * s, ry));
  };
  const TAR = { caught: 'The tar ball catches, and burns. It will not burn for long.', out: 'The tar ball’s flame gutters, and goes out.' };
  const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

  // ---- the Threshold (z 0..14): a stair hall, the way back out behind you
  const TH = R0.threshold;
  K.hall({ x: 0, z: 7, w: TH.x1 - TH.x0, d: TH.z1 - TH.z0, y: 0, h: TH.top, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 6, h: 8 }], omit: ['n'] });
  // the wall between the Threshold and the taller hall beyond, with the archway through it
  K.wall(-18.6, 14.6, 18.6, 14.6, 0, 20, { t: 1.2, holes: [{ at: 18.6, w: 8, h: 10 }] });
  // the way out: a dark doorway in the south wall
  K.add(M.voidM, T(new THREE.PlaneGeometry(6, 8).translate(0, 4, 0), [0, 0, -1.25]));
  K.solid(box(6.4, 8, 0.5, 0, 4, -1.4));
  K.glyph([0, 9.4, 0.05], 1.8, 0);
  add(Mark, { room: 'threshold', at: [-6, 0, 6.5], yaw: Math.PI / 2 });
  sandDrift(6.5, 3, 2.4, 3, 0.5); sandDrift(-7, 11.5, 1.8, 2, 0.35);

  // ---- the Hall of the Flame: the pilot flame on the tar ball's groove down the hall's middle, the hooded bowl at its end
  const FL = R0.flame, [, flz] = mid(FL);
  K.hall({ x: 0, z: flz, w: FL.x1 - FL.x0, d: FL.z1 - FL.z0, y: 0, h: FL.top, roof: 'oculus', oculus: 0.22, columns: 4, omit: ['s', 'n'] });
  // the wall between the Hall of the Flame and the deeper, taller Dry Channel, with the door through it
  K.wall(-18.6, 54.6, 18.6, 54.6, R0.channel.y, R0.channel.top - R0.channel.y, { t: 1.2, holes: [{ at: 18.6, w: D.w, h: D.h, y0: -R0.channel.y }] });
  add(Door, { id: 'd1', at: [0, 0, 54.6], w: D.w, h: D.h, lamps: [{ lit: 'b0' }] });
  groove(0, 23.2, 0, 43.2, 0);
  add(Flame, { at: [0, 0, 29.7], r: 0.9 });
  add(Ball, { id: 'ball1', a: [0, 0.04, 23.2], b: [0, 0.04, 43.2], r: 1.0, friction: 0.6, shove: true, blade: true,
    shoveLine: 'You lean on the tar ball, and it rolls ahead of you along its groove.',
    tar: { ...TAR, burns: 14, caught: 'The tar ball rolls through the Givers’ flame and catches. It will not burn for long.' } });
  add(Brazier, { id: 'b0', at: [0, 0, 45.1], hood: { ball: 'ball1', yaw: Math.PI, said: 'The bowl is hooded in stone, its mouth low on the groove: only something burning rolled into it would reach the coals.' } });
  // a mural on the west wall: the giants carrying water, in glyph rows, and carrying fire
  for (let i = 0; i < 4; i++) K.glyph([-17.95, 3.6 + (i % 2) * 1.8, 22 + i * 8], 1.5, Math.PI / 2);
  add(Mark, { room: 'flame', at: [-8, 0, 18], yaw: Math.PI / 2 });
  sandDrift(-13, 30, 2, 5, 0.6, 0.2); sandDrift(-12.6, 50, 1.6, 2.4, 0.4); sandDrift(12.4, 21, 2.2, 3, 0.5, 0.6);

  // ---- the Dry Channel: a sand pit across the hall, one pier of the old channel in its middle, a wall to climb
  const CH = R0.channel, [, chz] = mid(CH);
  K.hall({ x: 0, z: chz, w: CH.x1 - CH.x0, d: CH.z1 - CH.z0, y: CH.y, h: CH.top - CH.y, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'n', w: D.w, h: D.h, y0: 7 - CH.y }], omit: ['s'] });
  K.slab(-18, 54.6, 18, CH.ledge, 0, 9.5);              // the near ledge
  K.slab(-18, CH.landing, 18, CH.gallery, 0, 9.5);      // the far landing
  // the gallery: a block you climb, under its own top slab (the block stops under the slab: one face, not two)
  K.climbable('the gallery: the Dry Channel\'s climb from the far landing up to the Sword Chamber', () => {
    K.both(M.wallGlyph, box(36, 16.1, CH.z1 - CH.gallery, 0, -1.45, (CH.gallery + CH.z1) / 2));
    K.slab(-18, CH.gallery, 18, CH.z1, 7, 0.4);
  });
  K.both(M.sand, box(36, 1, CH.landing - CH.ledge + 0.1, 0, -9.5, (CH.ledge + CH.landing) / 2));  // the pit's sand
  for (let i = 0; i < 7; i++) if (i !== 3) sandDrift(-14 + i * 4.6, 66.5 + (i % 3) * 6.5, 2.6, 3.4, 0.8 + (i % 2) * 0.5, i, -9);
  add(Pit, { room: 'channel', min: [-19, -14, CH.ledge], max: [19, -2.5, CH.landing] });
  // the pier: 9 m of air either side (one jump is 6; the double jump 13), its head a step under the ledges'; long enough
  // east to west for the plate and, at its west end, the Givers' weight that holds it down (issue #337)
  K.both(M.wallGlyph, box(PIER.w, 9.2, PIER.d, PIER.x, -4.9, PIER.z));
  K.both(M.trim, box(PIER.w + 0.4, 0.3, PIER.d + 0.4, PIER.x, -0.15, PIER.z));
  add(Plate, { id: 'pp', at: [1.5, 0, PIER.z], r: 1.2 });
  add(Weight, { id: 'wP', at: [PIER.weight, 0, PIER.z], name: 'Givers’ weight',
    zone: { min: [PIER.x - PIER.w / 2 - 0.4, -1, PIER.z - 2.05], max: [PIER.x + PIER.w / 2 + 0.4, 6, PIER.z + 2.05] },
    hint: 'Off the plate, the door at the top of the gallery sinks shut again. Something heavier must hold it down.',
    back: 'The weight tumbles into the sand, and is back on the pier where it lay.' });
  // (its side walls glazed: no climbing round the pit; the gallery's face, past it, is the climb)
  add(Glazed, { min: [-18.5, -10, CH.ledge - 0.1], max: [18.5, 18, CH.landing + 0.1], said: 'The channel’s walls are glazed smooth by the water that once ran here. Nothing to hold.' });
  // handholds: a row of glyph ledges up the gallery's face (the house's one climb: its other walls are not, issue #115)
  for (let i = 0; i < 3; i++) K.add(M.trim, box(5, 0.25, 0.4, 0, 1.8 + i * 1.8, CH.gallery - 0.22));
  K.frieze([-17.9, 58], [-17.9, 95], 11, 'e', 6);
  K.frieze([17.9, 58], [17.9, 95], 11, 'w', 6);
  add(Mark, { room: 'channel', at: [-6.5, 0, 58.5], yaw: Math.PI / 2 });   // (off the wall: the camera has room behind you when you come back here, issue #195)

  // ---- the Sword Chamber (a rotunda, floor at 7), through a short passage in the Dry Channel's north wall
  K.corridor([0, 99.2], [0, 101.6], 7, { w: D.w, h: D.h });
  const SW = R0.chest;
  K.rotunda({ x: SW.x, z: SW.z, y: SW.y, r: SW.r, h: SW.top - SW.y, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.32 });
  // the dais under the oculus, and the chest on it (the box system builds the chest: src/boxes/)
  K.both(M.trim, ...chestMound(SW.x, 7, SW.z));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  K.add(M.glyph, T(new THREE.TorusGeometry(1.2, 0.05, 4, 48), [SW.x, 7.635, SW.z], [Math.PI / 2, 0, 0]));   // (the ring on the mound's top)
  // the frieze of the Givers' blade round the chamber: their hands carrying it, in glyphs
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.25 + i * 0.3); K.glyph([SW.x + Math.sin(a) * (SW.r - 0.05), 10.5, SW.z + Math.cos(a) * (SW.r - 0.05)], 1.4, a + Math.PI); }
  add(Door, { id: 'dc', at: [0, 7, 98.6], w: D.w, h: D.h, lamps: [{ pressed: 'pp' }] });
  add(Door, { id: 'dk', at: [0, 7, SW.z + SW.r + 0.7], w: D.w, h: D.h, lamps: [{ item: 'sword' }] });
  add(Mark, { room: 'chest', at: [6.5, 7, SW.z - 6.5], yaw: -Math.PI * 0.25 });   // (its spot toward the dais, not the wall: issue #195)

  // ---- the Machines' Hall (an arena): nothing in it but the Givers' machines, round its middle, and four columns to
  // fight round
  K.corridor([0, SW.z + SW.r + 0.6], [0, 131.2], 7, { w: D.w, h: D.h });
  const MH = R0.machines, [, mhz] = mid(MH);
  K.hall({ x: 0, z: mhz, w: MH.x1 - MH.x0, d: MH.z1 - MH.z0, y: 7, h: MH.top - 7, roof: 'oculus', oculus: 0.3, columns: 0, omit: ['e'], doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }] });
  for (const [x, z] of [[-9.5, mhz - 8], [9.5, mhz - 8], [-9.5, mhz + 8], [9.5, mhz + 8]]) K.column(x, z, 7, MH.top - 7, 0.9);
  for (const [x, z, a] of [[-15.5, 136, 0.4], [15.2, 158, 2.1], [-14.6, 159, 4]]) sandDrift(x, z, 2, 2.8, 0.45, a, 7);
  add(Door, { id: 'dm', at: [0, 7, MH.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'arM' }] });

  // ---- the Hall of Fires (a puzzle): the near floor and a chasm; down the floor's middle the tar ball's groove, its fire
  // and thorns, to the hooded bowl on the lip; the bridge that rises over the chasm to the far ledge and the archway beyond
  const FI = R0.fires, [, fiz] = mid(FI);
  K.hall({ x: 0, z: fiz, w: FI.x1 - FI.x0, d: FI.z1 - FI.z0, y: FI.y, h: FI.top - FI.y, floor: false, roof: 'oculus', oculus: 0.2, columns: 0, omit: ['s', 'e'],
    doors: [{ side: 'n', at: FIRES.bridge, w: D.w, h: D.h, y0: 7 - FI.y }] });
  // (its east wall, the Machines' Hall's and the Watcher's Hall's are one, the Hall of Channels' west wall: the keepers'
  // door and the east door in it; walls meeting there drew their faces in one plane)
  const WA = R0.watch, [, waz] = mid(WA);
  K.wall(18.6, WA.z1 + 1.2, 18.6, MH.z0 - 1.2, FI.y, FI.top - FI.y, { t: 1.2, holes: [{ at: WA.z1 + 1.2 - SC_Z, w: D.w, h: D.h, y0: 7 - FI.y }, { at: WA.z1 + 1.2 - WING_Z, w: D.w, h: D.h, y0: 7 - FI.y }] });
  K.slab(-18, MH.z1 + 0.6, 18, FI.lip, 7, 7 - FI.y);       // the near floor
  K.slab(-18, FI.far, 18, FI.z1 + 0.6, 7, 7 - FI.y);       // the far ledge
  K.both(M.dark, box(36, 1, FI.far - FI.lip, 0, FI.y, (FI.lip + FI.far) / 2)); // the chasm's floor, far below
  add(Pit, { room: 'fires', min: [-19, -8, FI.lip], max: [19, 3.5, FI.far] });
  add(Bridge, { id: 'br1', a: [FIRES.bridge, 7, FI.lip - 0.1], b: [FIRES.bridge, 7, FI.far + 0.1], w: 6, n: 8 });
  groove(FIRES.x, FIRES.z0, FIRES.x, FIRES.z1, 7);
  add(Flame, { at: [FIRES.x, 7, CHEST_BALL.flame], r: 0.6 });
  add(Ball, { id: 'ball3', a: [FIRES.x, 7.04, FIRES.z0], b: [FIRES.x, 7.04, FIRES.z1], r: 0.85, friction: CHEST_BALL.friction, shove: true, blade: true, thorns: { id: 'bw0', at: CHEST_THORNS, stopped: 'The cold ball stops against the thorns.' }, tar: { ...TAR, burns: CHEST_BALL.burns, out: 'The tar ball’s flame gutters and goes out on the way. Hands are too slow for it.' } });
  // (the thorns over the ball's groove alone: you walk round them, the ball can't)
  add(Bramble, { id: 'bw0', at: [FIRES.x + 0.3, 7, FIRES.z0 + 8.8], w: 2.4, h: 1.8, seed: 7, cut: true });
  add(Brazier, { id: 'b3', at: [FIRES.x, 7, FIRES.bowl], scale: 1.1, hood: { ball: 'ball3', yaw: Math.PI } });
  add(Door, { id: 'sc', at: [18.6, 7, SC_Z], yaw: Math.PI / 2, w: D.w, h: D.h, t: 1.3, lamps: [{ lit: 'e10' }] });
  K.column(-12, FI.far + 1.8, 7, FI.top - 7, 0.9); K.column(12, FI.far + 1.8, 7, FI.top - 7, 0.9);
  add(Mark, { room: 'fires', at: [-9, 7, MH.z1 + 4.4], yaw: 0.3 });

  // ---- the Watcher's Hall (a puzzle): through the archway past the bridge; the Givers' guard on its mound by the west
  // wall, their watcher in the middle; its east door into the Hall of Channels
  K.hall({ x: 0, z: waz, w: WA.x1 - WA.x0, d: WA.z1 - WA.z0, y: 7, h: WA.top - 7, roof: 'oculus', oculus: 0.3, columns: 0, omit: ['s', 'e'] });
  // the Givers' guard: a second chest on a low plinth (src/boxes/placements.js)
  K.both(M.trim, ...chestMound(-9, 7, 222, { h: 0.3, top: 1.3, foot: 2.1, seg: 24 }));   // (the guard's: a low ramped mound, issue #162)
  add(Door, { id: 'dw', at: [18.6, 7, WING_Z], yaw: Math.PI / 2, w: D.w, h: D.h, t: 1.3, lamps: [{ lit: 'sentry' }] });
  add(Sentry, { id: 'sentry', at: SENTRY_AT, yaw: -2.6, zone: { min: [WA.x0, 6, WA.z0], max: [WA.x1, 13, WA.z1] },
    woke: 'The watcher in the middle of the hall wakes. Hold up your guard ({key:guard}) as it fires.',
    reflected: 'The bolt glances off your guard, back down its beam.',
    broken: 'Its own bolt cracks its eye. The east door sinks open.',
    hit: 'The bolt burns. Guard ({key:guard}) when the beam narrows.',
    shrug: 'The bronze rings and holds. Only its own bolt could crack that eye.' });
  for (const [x, z, a] of [[-15.5, 212, 0.3], [14.8, 238, 1.7]]) sandDrift(x, z, 1.8, 2.6, 0.4, a, 7);

  // ---- the Hall of Channels (east of the Hall of Fires and the Watcher's Hall, floor 7): the Givers' old water channels in
  // its floor; down its middle the ball and its fire at the south end, the long groove to the hooded bowl at its north end,
  // a fire under a lid half-way (the relay) that the eye high on the obelisk beside it lifts
  const WI = R0.wing, [wix, wiz] = mid(WI);
  K.hall({ x: wix, z: wiz, w: WI.x1 - WI.x0, d: WI.z1 - WI.z0, y: 7, h: WI.top - 7, roof: 'oculus', oculus: 0.25, columns: 0, omit: ['w'], doors: [{ side: 'n', w: D.w, h: D.h }] });
  groove(WING.x, WING.z0, WING.x, WING.z1, 7);
  for (const x of [WI.x0 + 7, WI.x1 - 7]) K.add(M.dark, box(1.2, 0.04, 52, x, 7.02, wiz));   // the dry channels
  add(Flame, { at: [WING.x + 1.1, 7, WING.z0 + 1.5], r: 0.6 });
  add(Flame, { at: [WING.x + 1.2, 7, WING.z0 + WING.relay], r: 0.6, when: { lit: 'e10' }, lid: true });
  add(Ball, { id: 'ball4', a: [WING.x, 7.04, WING.z0], b: [WING.x, 7.04, WING.z1], r: 0.85, friction: WING.friction, shove: true, blade: true,
    tar: { ...TAR, burns: WING.burns, short: { unless: { lit: 'e10' }, said: 'The tar ball’s flame gutters, and goes out. Half-way down its groove, a fire waits under a stone lid.' } } });
  add(Brazier, { id: 'b4', at: [WING.x, 7, WING.bowl], scale: 1.1, hood: { ball: 'ball4', yaw: Math.PI } });
  // the obelisk beside the groove, the eye high on its west face (struck from a double jump)
  const [ex, ez] = WING.eye;
  K.both(M.wallGlyph, box(2.4, 10, 2.4, ex, 12, ez));
  K.both(M.trim, box(3, 0.6, 3, ex, 17.3, ez));
  K.both(M.trim, box(3.2, 0.5, 3.2, ex, 7.25, ez));
  add(Switch, { id: 'e10', at: [ex - 1.25, 13.6, ez], yaw: -Math.PI / 2, size: 1.2, blade: true, wrong: 'The eye is cut in hard stone, high on the obelisk. It rings when you knock on it: it wants striking.' });
  add(Door, { id: 'd3', at: [wix, 7, WI.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'e10' }, { lit: 'b4' }] });
  add(Mark, { room: 'wing', at: [24.5, 7, 236.5], yaw: Math.PI * 0.75 });

  // ---- the antechamber and the Cistern (a great rotunda, floor at 7)
  const CI = R0.cistern, C = V(CI.x, 7, CI.z), R = CI.r;
  K.corridor([CI.x, WI.z1 + 1.2], [CI.x, C.z - R - 0.6], 7, { w: D.w, h: D.h });
  add(Mark, { room: 'ante', at: [CI.x + 2.2, 7, WI.z1 + 4.4], yaw: -Math.PI / 2 });
  K.rotunda({ x: C.x, z: C.z, y: 7, r: R, h: CI.top - 7, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.3, floor: false });
  // the floor round a shallow dry basin, and the spout in the middle
  K.both(M.floor, T(annulus(6.6, R + 1.6, 0.8, 48), [C.x, 7, C.z]));
  K.both(M.stone, lathe([[6.65, 7], [6.2, 6.9], [4.2, 5.9], [0.01, 5.85]], 40).translate(C.x, 0, C.z));
  K.both(M.trim, lathe([[0.9, 0], [0.9, 0.4], [0.6, 0.6], [0.55, 2.2], [0.8, 2.5], [0.3, 2.7], [0.01, 2.7]], 14).translate(C.x, 5.85, C.z), new THREE.CylinderGeometry(0.8, 0.9, 2.7, 12).translate(C.x, 5.85 + 1.35, C.z));
  K.add(M.glyph, T(glyphGeometry(0.8, 0.06), [C.x, 7.9, C.z + 0.6]));
  add(Door, { id: 'd4', at: [C.x, 7, C.z - R - 0.7], w: D.w, h: D.h });
  add(Door, { id: 'd5', at: [C.x, 7, C.z + R + 0.7], w: D.w, h: D.h });
  const rim = [0.25, 0.75, 1.25, 1.75].map((f) => f * Math.PI);
  // the spokes: a tar ball's groove from the basin's edge out to a hooded bronze bowl on its tripod at the rim (after the
  // picked reference), a little fire beside each groove half-way: a ball cut out passes it, catches, and lights its bowl
  const F = HEARTH_FIRE;
  rt.spokes = rim.map((a0, i) => {
    const a = a0 + F.off, at = (r, y = 7.04, side = 0) => [C.x + Math.sin(a) * r + Math.cos(a) * side, y, C.z + Math.cos(a) * r - Math.sin(a) * side];
    groove(at(F.from)[0], at(F.from)[2], at(F.to)[0], at(F.to)[2], 7);
    add(Brazier, { id: RIM[i], at: at(F.bowl, 7), scale: 1.15, tripod: true, hood: { ball: SPOKES[i], yaw: a + Math.PI } });
    add(Flame, { at: at(F.fire, 7, 1.1), r: 0.6 });
    return add(Ball, { id: SPOKES[i], a: at(F.from), b: at(F.to), r: 0.8, friction: 0.5, blade: true, shove: true, tar: { burns: F.burns, caught: 'The ball rolls past the fire and catches.', out: 'The ball’s flame gutters, and goes out.' } });
  });
  // the Givers' muzzle over the basin on the east wall, dry, the stone under it damp; the channels' mouths at the floor
  K.add(M.stone, T(new THREE.SphereGeometry(1, 12, 8).scale(3.2, 1.1, 1.3), [C.x + R - 1.6, 14.2, C.z]));
  K.add(M.trim, T(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 10), [C.x + R - 4.7, 14.2, C.z], [0, 0, Math.PI / 2]));
  for (const a of [Math.PI * 0.5 - 0.5, Math.PI * 0.5 + 0.5, Math.PI * 1.5 - 0.5, Math.PI * 1.5 + 0.5]) K.add(M.voidM, T(new THREE.CircleGeometry(1.1, 12, 0, Math.PI), [C.x + Math.sin(a) * (R - 0.15), 7.01, C.z + Math.cos(a) * (R - 0.15)], [0, a + Math.PI, 0]));
  // the water that rises once the Keeper is calm (hidden until then)
  const poolMat = magicMaterial(7);
  const pool = magicPool(6.2, poolMat);
  pool.position.set(...K.world(C.x, 5.9, C.z).toArray());
  rt.root.add(pool);
  rt.spring = { pool, poolMat, k: rt.logic.resolved ? 1 : 0 };

  // ---- the spring (behind the far door): the way back out
  const S0 = C.z + R + 0.6, S1 = S0 + 9.8;
  K.corridor([C.x, S0], [C.x, S1], 7, { w: D.w, h: D.h });
  K.wall(C.x + 4.6, S1 + 0.4, C.x - 4.6, S1 + 0.4, 7, D.h, { t: 0.8, holes: [{ at: 4.6, w: 5, h: 7 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(5, 7).translate(0, 3.5, 0), [C.x, 7, S1 + 0.9]));
  K.solid(box(5.4, 7, 0.5, C.x, 10.5, S1 + 1.3));
  K.glyph([C.x, 15, S1 - 0.05], 1.6, Math.PI);

  // the machines' mark: the Machines' Hall's, its foes round the hall's middle (the last mark: its machines' ids are new)
  add(Mark, { room: 'machines', at: [-12, 7, MH.z0 + 3.5], yaw: 0.7, foes: [0, 7, mhz + 1] });

  // the Keeper, asleep curled at the far side of the basin (its fitted Tripo body, the procedural one until it loads)
  const model = keeperGuardian();
  model.pos.copy(K.world(C.x, 7, C.z + 9));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(C.x + 3.5, 7, C.z + 7.5);
  model.restHeading = K.heading(Math.PI + 0.6);
  // (its spout, a post in the basin's middle the Keeper's body is kept off: boss.js keepIn; 1.55 m over the floor)
  const centre = K.world(C.x, 7, C.z);
  const arena = { center: centre, r: R, y: K.world(0, 7, 0).y, posts: [{ x: centre.x, z: centre.z, r: 0.9, h: 1.55 }] };
  // (the basin is lower: the Keeper walks its rim and floor alike, at the arena's height)

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 4), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-20, -14, -3), V(58, 34, S1 + 3)),
    gadget: { at: W(SW.x, 7.62, SW.z).toArray(), face: K.heading(Math.PI) },
    finds: { guard: { at: W(-9, 7.3, 222).toArray(), face: K.heading(Math.PI / 2) } },
    exits: [
      { at: W(0, 0.5, 0.4), r: 1.5 },
      { at: W(C.x, 7.5, S1 - 0.4), r: 1.5 },
    ],
    lights: [[0, 7, 7, 18], [0, 10, 25, 26], [0, 10, 45, 26], [0, 8, 64, 28], [0, 10, 90, 28], [0, 12, 115, 20], [0, 13, 140, 26], [0, 13, 156, 26],
      [0, 13, 176, 28], [0, 13, 200, 28], [0, 13, 224, 28], [37, 13, 180, 28], [37, 13, 205, 28], [37, 13, 230, 28], [37, 11, 245, 11], [37, 15, 268, 32], [37, 11, S0 + 5, 11]],
    guardian: { def: { ...KEEPER, onHit: keeperHit, openFor: keeperOpen, onBlock: keeperBlocked, onStrike: keeperLands }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Rose House in the dunes
/** The Givers' channel from the door toward Qanat: world points every 3 m, winding a little, level down the steps, then on the sand. */
function channelPath(from, doorY, H) {
  const toward = V(STORY.city.x - from.x, 0, STORY.city.z - from.z).normalize();
  const pts = [from.clone().setY(doorY + 0.05)];
  for (let i = 1; i <= 60; i++) {
    const b = from.clone().addScaledVector(toward, i * 3);
    b.x += Math.sin(i * 0.37) * 1.6; b.z += Math.cos(i * 0.29) * 1.6;
    b.y = Math.max(H(b.x, b.z) + 0.3, i * 3 < 16 ? doorY + 0.06 : -1e9);
    pts.push(b);
  }
  return pts;
}
function exterior(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const yaw = SITE.heading;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw));
  let lo = Infinity;
  for (let a = 0; a < 16; a++) for (const r of [0, 12, 24, 30, 36]) {
    const x = SITE.x + Math.sin(a / 16 * Math.PI * 2) * r, z = SITE.z + Math.cos(a / 16 * Math.PI * 2) * r;
    lo = Math.min(lo, H(x, z));
  }
  const R = 30;
  const foot = V(SITE.x, 0, SITE.z).addScaledVector(f, R + 6);
  const doorY = Math.max(H(foot.x, foot.z), H(SITE.x + f.x * (R + 1), SITE.z + f.z * (R + 1))) + 6.3;
  const base = lo - 7;
  const K = new TempleKit(rt.root, 'The Rose House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, dy = doorY - base;
  const landmarkTop = landmark(K, 'desert', { y: dy, R });
  // Low dark pointed entrance between the red feet, as in the selected drawing.
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-3.4, 0); doorShape.lineTo(3.4, 0); doorShape.lineTo(3.4, 4.5);
  doorShape.quadraticCurveTo(3, 8.8, 0, 10); doorShape.quadraticCurveTo(-3, 8.8, -3.4, 4.5); doorShape.closePath();
  K.add(M.voidM, new THREE.ShapeGeometry(doorShape, 20).translate(0, dy, R + 2));
  K.solid(box(6.8, 10, .3, 0, dy + 5, R + 1.8));
  // the forecourt and its steps down into the sand
  const red = stone('#ef5845',{course:5.5,width:10,wear:.65});
  K.both(red, box(12, dy, 6, 0, dy / 2, R + 3));
  const end = K.world(0,0,R+38), sand = H(end.x,end.z)-base+.12;
  K.stairs([0,dy,R+6],[0,sand,R+38],10.4,{rise:.32,mat:red,sides:false});
  for(const side of [-1,1])K.ramp([side*5.7,dy+.25,R+6],[side*5.7,sand+.25,R+38],.7,{t:.5,mat:red});
  // (the Givers' dry channel out from the door toward Qanat is the world's: src/levels/desert.js, the same path)
  K.flush();
  // the door: its threshold (world), looking out toward Qanat
  const at = K.world(0, dy, R + 2.4);
  const front = K.world(0, dy, R + 14);
  return { door: { at, heading: yaw }, kit: K, base, top: base + landmarkTop, doorY, R, front, clear: [{ x: SITE.x, z: SITE.z, r: 76 }, { x: end.x, z: end.z, r: 14 }] };
}

// ------------------------------------------------------------------ the world change: water runs, fields grow
/**
 * Once the Keeper is calm: the water rises in the cistern (inside), runs out
 * of the house's door and down the old channel, the house grows green
 * creepers, and round Qanat the old fields sprout (rows of young crops,
 * irrigation channels of living water between them).
 */
function change(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const root = new THREE.Group();
  root.name = 'The Givers’ water (the world change)';
  scene.add(root);
  root.visible = false;
  // ---- the fields round Qanat
  const C = STORY.city;
  // (the last, out on the dunes toward the House: the field the Givers' field-stone bounds, src/desert-road.js FIELD_STONE)
  const plots = [[92, 92, 30, 20], [118, 96, 26, 18], [62, 98, 24, 18], [250, 90, 32, 20], [282, 96, 24, 16], [148, 94, 22, 16], [154, 130, 26, 18]];   // [angle (deg from +z, toward +x), distance, length, width]
  // a young crop: four broad blades leaning out of the soil, and on some an ear of ochre grain
  const blade = (a, lean) => new THREE.ConeGeometry(0.16, 1.15, 3).scale(1, 1, 0.35).translate(0, 0.55, 0).rotateZ(lean).rotateY(a).toNonIndexed();
  const leaf = mergeGeometries([0, 1, 2, 3].map((i) => blade(i * 1.6 + 0.3, 0.32 + (i % 2) * 0.16)));
  const head = new THREE.SphereGeometry(0.11, 6, 4).scale(1, 2.2, 1).translate(0.1, 1.15, 0);
  const spots = [];
  const chans = [], soils = [];
  for (const [deg, d, L, W] of plots) {
    const a = THREE.MathUtils.degToRad(deg), cx = C.x + Math.sin(a) * d, cz = C.z + Math.cos(a) * d;
    const along = V(Math.cos(a), 0, -Math.sin(a)), across = V(Math.sin(a), 0, Math.cos(a));
    for (let r = -W / 2; r <= W / 2; r += 1.25) {
      for (let s = -L / 2; s <= L / 2; s += 0.75) {
        const x = cx + along.x * s + across.x * r + Math.sin(s * 7.3 + r) * 0.12, z = cz + along.z * s + across.z * r + Math.cos(s * 5.1 - r) * 0.12;
        spots.push([x, H(x, z), z, Math.abs((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1)]);
      }
    }
    soils.push([cx, cz, along, across, L + 1.5, W + 1.5]);
    // a channel of living water along each plot's inner edge
    const p0 = V(cx - across.x * (W / 2 + 1.2) - along.x * L / 2, 0, cz - across.z * (W / 2 + 1.2) - along.z * L / 2);
    chans.push([p0, along.clone(), L]);
  }
  const green = makeMaterial({ color: '#82b85e', flat: true }), ochre = makeMaterial({ color: '#e6b86f', flat: true });
  const leaves = new THREE.InstancedMesh(leaf, green, spots.length), heads = new THREE.InstancedMesh(head, ochre, spots.length);
  // (they grow: never tiled or merged away as static props, src/perf.js)
  for (const m of [leaves, heads]) { m.userData.noCollide = true; m.userData.dynamic = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
  root.add(leaves, heads);
  const dummy = new THREE.Object3D(), mats = [], ears = [];
  spots.forEach(([x, y, z, rnd]) => {
    dummy.position.set(x, y - 0.05, z); dummy.rotation.set(0, rnd * 6.28, 0);
    dummy.scale.setScalar(0.85 + rnd * 0.5); dummy.updateMatrix();
    mats.push(dummy.matrix.clone());
    ears.push(rnd > 0.55);
  });
  // the soil of each field, dark and damp, laid over the sand (a grid of quads that follows the dunes)
  const soilG = [];
  for (const [cx, cz, along, across, L, W] of soils) {
    const nx = Math.ceil(L / 2), nz = Math.ceil(W / 2), pts = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const s = -L / 2 + (i / nx) * L, r = -W / 2 + (j / nz) * W;
      const x = cx + along.x * s + across.x * r, z = cz + along.z * s + across.z * r;
      pts.push([x, H(x, z) + 0.12, z]);
    }
    const P = [], at = (i, j) => pts[i * (nz + 1) + j];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (const q of [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]) P.push(...q);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    soilG.push(g);
  }
  const soil = new THREE.Mesh(mergeGeometries(soilG), makeMaterial({ color: '#9c7a52', flat: true, side: THREE.DoubleSide }));
  soil.userData.noCollide = true;
  root.add(soil);
  const water = makeMaterial({ color: '#62c3c9', glow: 0.35, flat: true, side: THREE.DoubleSide, key: 'temple.desert.channel' });
  const strip = [];
  for (const [p0, dir, L] of chans) {
    const n = Math.ceil(L / 2), side = V(-dir.z, 0, dir.x).multiplyScalar(0.45);
    for (let i = 0; i < n; i++) {
      const a = p0.clone().addScaledVector(dir, (i / n) * L), b = p0.clone().addScaledVector(dir, ((i + 1) / n) * L);
      a.y = H(a.x, a.z) + 0.3; b.y = H(b.x, b.z) + 0.3;
      const g = new THREE.BufferGeometry();
      const P = [a.x - side.x, a.y, a.z - side.z, a.x + side.x, a.y, a.z + side.z, b.x - side.x, b.y, b.z - side.z, b.x + side.x, b.y, b.z + side.z];
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      strip.push(g.toNonIndexed());
    }
  }
  // ---- the water running out of the house's door, down its steps and away toward the city
  const O = rt.outside;
  if (O) {
    const path = channelPath(O.door.at, O.doorY, H), toward = path[1].clone().sub(path[0]).setY(0).normalize();
    const side = V(-toward.z, 0, toward.x).multiplyScalar(0.8);
    let a = path[0];
    for (let i = 1; i < path.length; i++) {
      const b = path[i];
      const g = new THREE.BufferGeometry();
      const P = [a.x - side.x, a.y, a.z - side.z, a.x + side.x, a.y, a.z + side.z, b.x - side.x, b.y, b.z - side.z, b.x + side.x, b.y, b.z + side.z];
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      strip.push(g.toNonIndexed());
      a = b;
    }
  }
  const channel = new THREE.Mesh(mergeGeometries(strip), water);
  channel.userData.noCollide = true;
  root.add(channel);
  // ---- creepers on the house: green vines up the drum and the fins, leaves along them
  if (O) {
    const K = O.kit, vines = [], leafG = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + 0.13, r = O.R + 0.3, h0 = O.doorY - O.base - 2, h1 = h0 + 10 + (i * 7.3) % 14;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const y = THREE.MathUtils.lerp(h0, h1, k / 8), w = Math.sin(k * 1.3 + i) * 0.12; pts.push(K.world(Math.sin(a + w) * r, y, Math.cos(a + w) * r)); }
      vines.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.12, 4).toNonIndexed());
      for (let k = 1; k < 8; k++) { const p = pts[k]; leafG.push(new THREE.SphereGeometry(0.45, 5, 3).scale(1, 0.3, 0.7).rotateY(i + k).translate(p.x, p.y, p.z).toNonIndexed()); }
    }
    const vm = new THREE.Mesh(mergeGeometries(vines.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#4f7a4a', flat: true }));
    const lm = new THREE.Mesh(mergeGeometries(leafG.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#7fb36e', flat: true }));
    vm.userData.noCollide = lm.userData.noCollide = true;
    root.add(vm, lm);
  }
  let k = 0, want = 0;
  const _m = new THREE.Matrix4(), _s = new THREE.Matrix4(), NONE = new THREE.Matrix4().makeScale(0, 0, 0);
  const apply = () => {
    root.visible = k > 0.001;
    const g = Math.min(1, k * 1.2);
    for (let i = 0; i < mats.length; i++) {
      // the crops come up in waves across each field
      const w = THREE.MathUtils.clamp(g * 1.6 - (i % 37) / 37 * 0.6, 0, 1);
      _m.copy(mats[i]).multiply(_s.makeScale(Math.max(0.001, w), Math.max(0.001, w), Math.max(0.001, w)));
      leaves.setMatrixAt(i, _m);
      heads.setMatrixAt(i, w > 0.85 && ears[i] ? _m : NONE);
    }
    leaves.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  };
  return {
    root,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 25 : -dt), 0, 1); apply(); }
      if (root.visible) water.uniforms.uGlow.value = 0.3 + 0.12 * Math.sin(t * 1.7);
      // inside: the cistern fills
      const S = rt.spring;
      if (S) {
        S.k = rt.logic.resolved ? Math.min(1, S.k + dt / 6) : 0;
        S.pool.visible = S.k > 0.01;
        S.pool.position.y = rt.kit.world(0, 5.95 + S.k * 0.9, 0).y;
        S.pool.scale.set(4.2 + S.k * 2.3, 1e-3, 4.2 + S.k * 2.3);
        if (S.pool.visible) setMagic(S.poolMat, t, { bright: S.k, tones: 6 });
      }
    },
  };
}

/**
 * A save from before issue #336's house, standing inside the old rooms (src/temples/migrate.js LAYOUTS.desert v4 sets
 * temple.desert.relaid): its first frame inside, the traveller is taken to the last mark, in the new rooms (src/temples/
 * runtime.js update: every house's `temple.<id>.relaid`, since the Warden's Well was remade too).
 */
export const RELAID = 'temple.desert.relaid';

export const DESERT_TEMPLE = {
  id: 'desert', levelId: 'desert', name: 'The Rose House', doorLabel: 'door of the Rose House',
  gadget: 'sword', gadgetBox: 'desert.temple.sword', arenaDoor: 'd4',
  // (the blade taken, the Givers' machines wake in the Machines' Hall past the chamber's north door: an arena, its doors
  // held while they stand and you are in it; issue #336, a fight's room of its own)
  arenas: ARENAS,
  origin: [150, 2400, -250], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  // (inside, the alien skin the author picked: pleated cactus ribs, crackle, turquoise pores, seed capsules; issue #342)
  skin: 'cactus',
  layout, exterior, change,
  enterLine: 'Cool air, and the smell of old water. The Rose House is dark inside, and very large.',
  pitLine: 'You climb back out of the sand, to the last glyph stone.',
  onResolved(rt) { rt.notice('Water. Above, it is already running out of the house toward Qanat.', 'resolved.out'); },
  // the braziers round the cistern calm it, a fifth each (two end its first phase): lit before it woke, or before a knockout, they still count
  onLit(rt, id) { if (RIM.includes(id)) syncLight(rt.guardian); },
  onWake(rt) { syncLight(rt.guardian); },
  // (a save that stood in the old rooms: to the last mark, once: src/temples/runtime.js, RELAID)
  onConnect(rt) {
    // the blade taken from its chest here: the Givers' machines wake in the hall beyond (src/foes.js places them the moment he is armed)
    rt.offs.push(rt.game.on('temple:gadget', ({ id } = {}) => { if (id === 'desert' && !rt.logic.isLit('arM')) rt.notice('Beyond the chamber’s north door, something in the walls is waking.', 'machines.wake'); }));
    const G = rt.guardian;
    if (!G) return;
    // water from your tank, while it pants (its second phase on): at its mouth, as the hand on its brow at the end
    const m = G.model;
    rt.offs.push(registerInteractable({
      id: 'temple.desert.water', priority: PRIORITY.use + 3, range: 3.4, prompt: 'give it water from your tank',
      at: () => (rt._wa ??= V()).copy(m.mouth).addScaledVector(UP, 0.8),
      enabled: () => G.state === 'open' && G.phaseIndex >= 1 && G.awake,
      distance: (p) => Math.max(0, Math.hypot(p.pos.x - m.mouth.x, p.pos.z - m.mouth.z) - (m.touchR ?? 0)),
      use: () => keeperDrinks(G),
    }));
    // from its second phase: a burning ball rolled to rest by it makes it pant (once a lighting), in the light
    const spent = new Map();
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.phaseIndex < 1 || G.state !== 'fight' || G.attack || G.closing) return;
      const b = fireNear(G);
      if (!b || b.burn <= (spent.get(b) ?? -1)) return;
      spent.set(b, b.burn);
      G.enter('open'); G.openFor = HEARTH_FIRE.open;
      rt.notice('It turns to the fire by it and pants, its mouth open.', `keeper.firelit.${G.phaseIndex}`);
    };
  },
};
