import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import { ceramic, metal, glazing, glaze } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bank, Platform, Bridge, Swing, Mark, Pit, Key, Coffer } from './pieces.js';
import { foremanModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { clockHouseSkin } from './skins/clock-house.js';

// The Glass Dunes' temple: the Clock-House, a round stair-house of the makers
// standing in the sand east of the valley, a great clock over its door, the
// makers' great cogs half sunk in the sand round it. The glassworkers found it
// standing there when the desert turned to glass (nobody is sure which came
// first), and keep their own clocks by it. Everything in the dunes took its beat
// from its clockwork, kept by the makers' Clockwork Foreman; the night the light
// passed it jumped its escapement, the camps' clocks stopped, and it has been
// wound wrong ever since. It is a machine: you may stop it, or set it right.
//
// (It was the Sealed Hangar's First Garage until October 2026, on the rim of Major Brask's plateau, his first
// garage in its porch. The Hangar left the route for the Glass Dunes (src/levels/names.js DISMISSED; its world is
// kept in src/levels/dismissed/hangar/) and the house moved with its rooms, its Foreman and its gadget; its ids
// stay 'garage' (the saves' temple.garage.*, the box garage.temple.coil).)
//
// Inside (built far overhead, through its door). The temple's one idea (reworked from the temple design audit,
// docs/audits/temple-design-v1.12.md): the makers' clock counts round from where its hand points, and every
// clock in the house stopped at the same hour the night the light passed (four, as the clock over the door).
// Since v1.48 (issue #23) a house to explore round its Winding Well, not a corridor of rooms in order
// (docs/systems/temples.md, "Hubs, keys and arenas"); since v1.77 (issue #336) its rooms shrines, every puzzle in the
// middle of its room and the Pendulum Hall the one fight (docs/design/temple-redesign.md):
//   the Threshold        an old workbench (the Major's, when the house stood in his Hangar), the first mark, the way out
//   the Escapement       a pit crossed by a disc that swings over it like a clock's escapement, still until the
//                        three eyes round the dial on its tower in the pit wake in turn: from the one its hand
//                        points at, round the way a clock goes (out of turn an eye only ticks)
//   the Cupboard         (off the far landing, west) the Clockmaker's: his clock standing on the landing has lost its
//                        hand, so its three eyes wake round from the house's hour (four, eight, twelve); a coffer.
//                        (v1.53, issue #23) Its clock has stopped, its eyes lidded, until the house's mainspring is
//                        wound again: then they wake, and the great key is in it (a loop back)
//   the Mainspring Room  (off the far landing, east, across from the Cupboard's door: since v1.74, round 6 of issue
//                        #23; it was off the Clock Gallery's landing, four rooms from the clock it starts) the
//                        mainspring hangs slack until its weight, a ball on the landing, is rolled home; then six eyes
//                        round it in one breath (the boomerang, past the chest: seen on the way in, wound on the way back),
//                        and out on the landing the Clockmaker's clock begins to tick
//   the Winding Well     the hub. A wall to climb, the door at its top; the door wants two small keys and the
//                        winding's counterweight home in its socket, and the counterweight is a stone ball still
//                        waiting at the foot of its groove on the Escapement's far landing, its socket there (a room
//                        away, out of sight from the door; v1.77: its groove ran on through the doorway into the well)
//   the Pendulum Hall    (west, an arena) its door shuts behind you while the pendulums' keepers stand; beaten, the
//                        small key's cage on the landing sinks and a door above opens onto the ledge over the climb
//   the Striking Room    (east) the hour track: a ball and three plates, at two, four and six; on the house's hour the
//                        striking eye's lids lift, and woken it lets the second small key out of its cage
//   the Coil Chamber     the makers' chest: the BOOMERANG (src/gadgets/boomerang.js; issue #377: the quick coil, a faster
//                        refill of the magic bar, was here, and went to Lorn II's makers' court). Its north door sinks
//                        for it in hand
//   the Winding Passage  a room of its own (v1.77): the makers' great escape wheel on a stele in its middle is ringed
//                        by six eyes that wake only together, inside one breath (4.6 s): a tank holds three shots, so
//                        three locked on and struck in one throw of the boomerang, three splashed (the boomerang's
//                        first lock, where failing costs a breath)
//   the Clock Gallery    the key hall, after its reference: a chasm with the makers' cogs turning in the dark,
//                        a great clock face hung over the bridge's far end that has lost its hands, six eyes round it. The bridge
//                        wants all six inside one breath (the boomerang) and in turn, counted round from the hour the
//                        clock stopped at, which it no longer shows: the little clock over the way in does (and
//                        the Winding Well's, and the one over the door outside). Out of turn they all go dark.
//                        Over the bridge the Foreman's door wants the house's great key. (v1.74) The gallery's great
//                        pendulum hangs over the bridge and swings along it: cross in its beat, or it knocks you back
//   the Foreman's Workshop the guardian (a robot: its meter is damage). When its face opens, hit all six
//                        numerals inside a breath (three on the boomerang's locks). Open, its hands come round to four; numerals hit in the clock's
//                        order counted from four ring in step (taught in its second phase, where any order still
//                        does); in its last phase only that order takes, and out of step they all go dark
// After: the clock over the Clock-House's door keeps the true time, and the makers' cogs in the sand round it
// turn in step, their lamps lit (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** In the Glass Dunes (src/levels/glass-dunes.js): on the sand east of the valley, south of the frozen wave's end; its door looks back down the valley toward the ship. */
export const SITE = { x: 118, z: 72, r: 9 };
SITE.heading = Math.atan2(0 - SITE.x, 200 - SITE.z);

/**
 * The First Garage's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/first-garage):
 * cream marble in big slabs, cream marble floors (the blue slate is gone), brass in the frames, inlaid in thin lines under
 * every frieze and at the foot, and in the fittings, a little brass clock under every frieze, the eyes lit the makers'
 * teal; its shade a cool grey-teal, its light warm sun.
 */
export const PALETTE = {
  wall: '#eee6d6', wall2: '#e7ddca', wall3: '#f4eee3', floor: '#e8dfcb', floor2: '#dcd1ba', trim: '#d2a648', fitting: '#d2a648',
  dark: '#34405e', stone: '#62c3c9', accent: '#e6875f', glow: '#5fd8cc', glyph: '#d2a648', lamp: '#f2c54b', sand: '#e9d7b0', sand2: '#cfe0a8', void: '#2b2f4a',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.8, shade: 0.45 },
    wall: { mode: 0, grid: 3.4, plates: true },
    floor: { mode: 0, grid: 2.4, plates: true },
    glyph: { glow: 0.3 },
    trim: { metal: 'brass' },
    fitting: { metal: 'brass' },
  },
  bands: [{ at: 0.72, h: 0.35, color: '#d2a648', look: { metal: 'brass' } }, { y: 0.55, h: 0.25, color: '#d2a648', look: { metal: 'brass' } }],
  ornament: { kind: 'clock', color: '#d2a648', color2: '#f6f0e4', metal: 'brass' },
  light: { shadow: '#b7bfc2', light: '#fff2d8', sun: '#ffe8c0' },
};

// ------------------------------------------------------------------ the house's measures (v1.77, issue #336)
// Redone as shrines (docs/design/temple-redesign.md): every puzzle and fight room 30 m across or more under 16 m of
// stone and more, every door between two rooms 7 by 9 (DOOR), each puzzle in the middle of its room, the Pendulum Hall
// the one fight. The props, the grooves, the disc's ride, the gallery's chasm and its pendulum's beat stay as they were.
/** The upper house's floor (local m): the ledge over the climb, the chest, the passage, the gallery, the Foreman's. */
export const UP = 10;
export const DOOR = { w: 7, h: 9 };
/** The Escapement and its far landing, one hall: the pit from `near` to `far`, the landing on to z1. */
export const ESC = { w: 32, z0: 12.6, z1: 72, y: -8, h: 30, near: 18, far: 40 };
/** The escapement's dial, on its tower out in the pit beside the disc's way: its centre, the eyes' ring. */
export const DIAL = { x: -5.8, y: 9.6, z: 29, r: 3.2 };
/** The landing: the counterweight's groove up its east side to its socket, the Clockmaker's clock on its west. */
export const LANDING = { ball: { x: 7, z0: 44, z1: 60 }, clock: { x: -5, z: 59 } };
/** The Winding Well (a round hall): its middle, its radius, the climb's face (m north of its middle). */
export const WELL = { z: 95.2, r: 18, h: 26, face: 8 };
/** (v1.74) The Clock Gallery's great pendulum over the bridge (local m, s): its pivot's height, its length, its swing. */
export const GALLERY_BEAT = { pivot: UP + 16, len: 14, amp: 0.55, period: 6 };
export const VOLLEY = 4.6;   // s: the six eyes (and the Foreman's six numerals) must all be hit inside this
/** The Foreman's numerals (its model's lamps, i at 2i o'clock as you face it) in the clock's order from four. */
export const FROM_FOUR = [2, 3, 4, 5, 0, 1];

export const LOGIC = {
  id: 'garage', entry: 'threshold', gadget: 'boomerang',
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, esc: { checkpoint: true, kind: 'puzzle' }, escFar: { kind: 'puzzle' },
    well: { checkpoint: true, kind: 'puzzle' }, pend: { checkpoint: true, kind: 'combat' }, springs: { checkpoint: true, kind: 'puzzle' },
    coil: { checkpoint: true, kind: 'chest' }, wind: { checkpoint: true, kind: 'puzzle' }, gallery: { checkpoint: true, kind: 'puzzle' },
    mainspring: { checkpoint: true, kind: 'puzzle' }, cupboard: { kind: 'passage' }, galleryFar: { kind: 'passage' },
    hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'esc' },
    { a: 'esc', b: 'escFar', door: 'discs' },     // the escapement's disc, once the eye is splashed
    { a: 'escFar', b: 'well' },
    { a: 'escFar', b: 'cupboard', door: 'dC' },   // the Clockmaker's Cupboard (the great key since v1.53; a coffer)
    { a: 'escFar', b: 'mainspring' },             // (v1.74) the Mainspring Room, across the landing from the Cupboard's door
    // the Winding Well is the hub (v1.48): west the Pendulum Hall (an arena), east the Striking Room, up the climb the
    // door to the chest (the ledge over the climb is the well's: the block's face is the house's one climb)
    { a: 'well', b: 'pend', door: 'dW' },         // (open: it shuts behind you while the machines stand)
    { a: 'pend', b: 'well', door: 'dWo' },        // the Pendulum Hall's way out, onto the ledge over the climb (the loop)
    { a: 'well', b: 'springs' },
    { a: 'well', b: 'coil', door: 'd2' },         // at the top of the climb: the counterweight home, and two small keys
    { a: 'coil', b: 'wind', door: 'dP' },         // (v1.77) the chamber's north door, for the coil in your hand
    { a: 'wind', b: 'gallery', door: 'd3' },      // the Winding Passage's door, a room of its own since v1.77
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'galleryFar', b: 'hall', door: 'd4' },   // the great key's door (and the arena's: shut while the Foreman fights)
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the escapement's three eyes, in turn from where its hand points (eight), round the way a clock goes
    s1: { type: 'switch', room: 'esc' },
    s2: { type: 'switch', room: 'esc', after: 's1' },
    s3: { type: 'switch', room: 'esc', after: 's2' },
    discs: { type: 'bridge', opens: { all: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] }, latch: true },
    // the counterweight, on the escapement's far landing (issue #275: 1.2 m along its groove, room behind it to push
    // from), and its socket at the groove's end on the landing (v1.77: it was in the well, the groove through its doorway)
    ball1: { type: 'drum', room: 'escFar', plate: 'p1', plateAt: 1, start: 0.07 },
    p1: { type: 'plate', room: 'escFar' },
    // the Pendulum Hall: its keepers beaten, the key's cage sinks and the way out onto the ledge opens
    arW: { type: 'arena', room: 'pend' },
    kW: { type: 'key', kind: 'small', room: 'pend', when: { lit: 'arW' } },
    dW: { type: 'door', opens: null },
    dWo: { type: 'door', opens: { lit: 'arW' }, latch: true },
    // the Striking Room: the ball on the hour track, on the house's hour (four: every clock in the house stopped there)
    ballS: { type: 'drum', room: 'springs', stops: { pS2: 1 / 3, pS4: 2 / 3, pS6: 1 }, start: 0 },
    pS2: { type: 'plate', room: 'springs' }, pS4: { type: 'plate', room: 'springs' }, pS6: { type: 'plate', room: 'springs' },
    sS: { type: 'switch', room: 'springs', when: { drumOn: ['ballS', 'pS4'] } },
    kE: { type: 'key', kind: 'small', room: 'springs', when: { lit: 'sS' }, clue: 'hour' },
    hour: { type: 'clue', room: 'well' },   // (the house's hour: the well's clock, stopped at four, as the one over the door outside)
    d2: { type: 'door', lock: 'small', keys: 2, opens: { drumOn: ['ball1', 'p1'] }, latch: true },   // (the ball's weight: the winding's counterweight)
    // (issue #377: the chest held the quick coil, a faster refill: "more mana"; the boomerang now, whose locks strike three
    // eyes in one throw, in turn; the coil waits in Lorn II's makers' court)
    chest: { type: 'gadget', room: 'coil', item: 'boomerang' },
    dP: { type: 'door', opens: { item: 'boomerang' }, latch: true },
    k1: { type: 'switch', room: 'wind', needs: ['boomerang'] },   // the passage's six eyes in one breath: three thrown, three splashed
    d3: { type: 'door', opens: { lit: 'k1' }, latch: true },
    k2: { type: 'switch', room: 'gallery', needs: ['boomerang'], order: true },   // six in one breath, in turn from four
    br1: { type: 'bridge', opens: { lit: 'k2' }, latch: true },
    d4: { type: 'door', lock: 'big', room: 'hall' },              // the great key; and shut while the Foreman fights
    foreman: { type: 'boss', room: 'hall', needs: ['gun', 'boomerang'] },
    d5: { type: 'door', opens: { resolved: true }, room: 'hall' },   // (d4 and d5 carry the hall's room: the rules measure it by them)
    // the Mainspring Room (v1.74: off the Escapement's far landing, east; it was off the gallery's landing): its weight
    // rolled home, then six eyes in a breath, and the Clockmaker's clock across the landing ticks again.
    // (After the gallery's elements: the marker sends you over the bridge to the great lock first, and back for its key)
    ballM: { type: 'drum', room: 'mainspring', plate: 'pM', plateAt: 1, start: 0 },   // (at the way in)
    pM: { type: 'plate', room: 'mainspring' },
    k3: { type: 'switch', room: 'mainspring', needs: ['boomerang'], when: { drumOn: ['ballM', 'pM'] } },
    // the Clockmaker's Cupboard (optional, so last: the marker never points at it): the Clockmaker's clock on the landing
    // woken round from four (four, eight, twelve)
    // (v1.53) its clock stopped, the eyes lidded, until the mainspring is wound: the great key inside
    c1: { type: 'switch', room: 'escFar', when: { lit: 'k3' } },
    c2: { type: 'switch', room: 'escFar', after: 'c1', when: { lit: 'k3' } },
    c3: { type: 'switch', room: 'escFar', after: 'c2', when: { lit: 'k3' } },
    dC: { type: 'door', opens: { all: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }] }, latch: true },   // (all three: in turn, the last lights after the others)
    kB: { type: 'key', kind: 'big', room: 'cupboard' },
    cache: { type: 'cache', room: 'cupboard' },
  },
};

export const FOREMAN = {
  kind: 'robot', name: 'the Clockwork Foreman', final: 'break', speed: 1.5, wakeTime: 2.8,
  wake: 'A machine with a clock for a chest winds itself up, its hands racing.',
  openHint: 'Its face opens on six numerals: lock three, splash three, in a breath.',
  resolved: 'The Foreman’s hands come round to the right time, and stop there.',
  missHint: 'It spins on, dizzy, its face open: hit the six numerals now.',
  phases: [
    { to: 0.5, attacks: ['jab', 'chime', 'hammer'], pause: 1.6, hint: 'Its face opens: six numerals in a breath, three on the boomerang.' },
    { to: 0.75, attacks: ['cog', 'spin', 'hammer'], pause: 1.2, hint: 'Its hands stop at four: hit the numerals round from four, in step.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'parry', moves: ['hammer'], open: 5.6, perfect: 6.4,
        hint: 'Guard its hammer: jarred, its face swings open.',
        said: 'The hammer rings off your guard and its face swings open: the six numerals.',
        lines: ['Its hammer comes down hard.', 'Take its hammer on your guard: jarred, its face opens.', 'When it rears its hammer, hold the guard (LB / L1) toward it; then six numerals in a breath, three on the boomerang.'] } },
    { to: 1.0, attacks: ['jab', 'cogs', 'spin'], pause: 1.0, hint: 'Only numerals hit in step count now: six, clockwise from four.' },
  ],
  attacks: {
    // (the hammer's reach 3.8 m, v1.77 #361: at 4.5 it came for you only to 4 m, its arms landed 3.7 m out, and a guard held
    // with your back to the wall never met it, twelve hammers in a row: its second phase asks for that guard)
    hammer: { shape: 'cone', range: 10, angle: 0.7, wind: 1.3, track: 0.6, part: 'arms', rig: 'rear', parts: ['arms'], splash: 0.4, active: 0.35, reach: 3.8, damage: 0.75, knock: 11, recover: 0.8, open: 5.6 },
    jab: { shape: 'cone', range: 7, angle: 0.6, wind: 1.2, track: 0.7, part: 'arms', rig: 'lean', pose: 'cog', parts: ['arms'], splash: 0.4, active: 0.3, reach: 4.5, gap: 0.75, damage: 0.5, knock: 8, recover: 0.5, then: 'jab2' },
    jab2: { shape: 'cone', range: 7, angle: 0.6, wind: 0.65, track: 0.6, part: 'arms', rig: 'lean', pose: 'cog', link: true, parts: ['arms'], splash: 0.4, active: 0.3, reach: 4.5, damage: 0.5, knock: 8, gap: 0.3, then: 'hammerEnd' },
    hammerEnd: { shape: 'cone', range: 10, angle: 0.7, wind: 1.1, track: 0.5, part: 'arms', rig: 'rear', pose: 'hammer', link: true, parts: ['arms'], splash: 0.4, active: 0.35, reach: 3.8, damage: 0.75, knock: 11, recover: 0.8, open: 5.6 },
    chime: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'head', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 1.5, h: 1.2 }, damage: 1, knock: 12, recover: 1.0, open: 5.6 },
    cog: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', damage: 0.75, knock: 8, recover: 0.6 },
    cogs: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', pose: 'cog', damage: 0.5, knock: 6, recover: 0.6 },
    spin: { shape: 'ring', at: 'self', radius: 6.5, wind: 1.3, part: 'arms', rig: 'spin', parts: ['arms'], splash: 0.5, active: 0.4, reach: 4.5, damage: 0.75, knock: 12, recover: 0.6, miss: 4.0 },
  },
};

function foremanHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its brass.', 'cf.push'); return true; }
  if (g.state !== 'open') g.rt.notice('The glass is down over its face. Wait for it to strike, and open.', 'cf.shut');
  return true;
}

/** Six eyes round a centre (an hour each, two hours apart): [{ at, yaw }]. */
const ring6 = (cx, cy, z, r, yaw) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * TAU; return { at: [cx + Math.sin(a) * r, cy + Math.cos(a) * r, z], yaw }; });

/** Moving clockwork that answers to nothing (the Clock Gallery's cogs and pendulums): each part a function of time. */
class Clockwork {
  constructor(rt, o) { this.parts = o.parts; }
  update(dt, t) { for (const f of this.parts) f(t); }
}

/** A cog of brass: a rim, teeth and spokes, merged (radius r, facing local +z). */
function cogGeometry(r, depth = 1.0) {
  const parts = [new THREE.TorusGeometry(r, 0.45, 6, 40).toNonIndexed()];
  const n = Math.round(r * 3);
  for (let k = 0; k < n; k++) parts.push(new THREE.BoxGeometry(0.9, 0.9, depth).translate(0, r + 0.55, 0).rotateZ((k / n) * TAU).toNonIndexed());
  for (let k = 0; k < 3; k++) parts.push(new THREE.BoxGeometry(0.5, r * 2, 0.4).rotateZ((k / 3) * Math.PI).toNonIndexed());
  parts.push(new THREE.CylinderGeometry(r * 0.2, r * 0.2, depth * 1.4, 14).rotateX(Math.PI / 2).toNonIndexed());
  for (const q of parts) q.deleteAttribute('uv');
  return mergeAll(parts);
}

/**
 * The Clock Gallery after its reference: the makers' cogs turning slowly in the dark of the chasm, arched niches
 * with brass pendulums on the walls of both landings, and high round windows of warm light.
 */
function galleryClockwork(rt, K, F0, brass) {
  const cogM = makeMaterial({ color: '#c99a4a', flat: true, metal: 'brass', key: 'temple.garage.gallerycogs' });
  const windowM = makeMaterial({ color: '#ffe9b8', glow: 0.8, flat: true, key: 'temple.garage.windows' });
  const parts = [], X = GALLERY.w / 2;
  const place = (obj, x, y, z, ry = 0) => { obj.position.copy(K.world(x, y, z)); obj.rotation.y = K.heading(ry); obj.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; }); rt.root.add(obj); return obj; };
  // cogs in the chasm: two great wheels along the walls, an escapement wheel lying under the bridge
  for (const [x, y, z, r, ry, rate] of [[-(X - 3.4), UP - 10.5, F0 + 12, 5.2, Math.PI / 2, 0.12], [X - 3.4, UP - 11.5, F0 + 21, 6, Math.PI / 2, -0.09], [-1.5, UP - 12.6, F0 + 17, 4.2, 0, 0.16]]) {
    const g = new THREE.Group(), m = new THREE.Mesh(cogGeometry(r), cogM);
    if (ry === 0) m.rotation.x = -Math.PI / 2;   // (lying flat)
    g.add(m);
    place(g, x, y, z, ry);
    parts.push((t) => { m.rotation.z = t * rate; });
  }
  // arched niches on the side walls of both landings, each with a pendulum swinging in it
  for (const [x, z, s] of [[-(X - 0.05), F0 + 2.6, 1], [X - 0.05, F0 + 2.6, -1], [-(X - 0.05), F0 + 31, 1], [X - 0.05, F0 + 31, -1]]) {
    K.add(rt.M.dark, box(0.12, 5.6, 2.4, x + s * 0.06, UP + 3, z));
    K.add(rt.M.dark, T(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), [x + s * 0.06, UP + 5.8, z], [0, 0, 0]));
    K.add(brass, box(0.2, 0.25, 2.8, x + s * 0.12, UP + 0.15, z));
    const bob = new THREE.Group();
    bob.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6).translate(0, -1.8, 0), cogM), new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8).scale(1, 1.3, 0.6).translate(0, -3.9, 0), cogM));
    const pv = place(bob, x + s * 0.4, UP + 6.2, z, 0);
    const ph = z * 0.7;
    parts.push((t) => { pv.rotation.x = Math.sin(t * 1.9 + ph) * 0.28; });
  }
  // round windows high on the walls, warm light coming in
  for (const [x, z] of [[-(X - 0.1), F0 + 9], [-(X - 0.1), F0 + 24], [X - 0.1, F0 + 9], [X - 0.1, F0 + 24]]) {
    K.add(windowM, T(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 24).rotateZ(Math.PI / 2), [x, UP + 12.5, z]));
    K.add(brass, T(new THREE.TorusGeometry(1.55, 0.14, 5, 28).rotateY(Math.PI / 2), [x - Math.sign(x) * 0.05, UP + 12.5, z]));
  }
  rt.add(Clockwork, { parts });
}

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/** Where the wings stand (local m): the Pendulum Hall west of the well, the Striking Room east, the way up onto the ledge. */
export const WING = {
  stairZ: WELL.z + 12.4,                         // the Pendulum Hall's stair, up its north wall to the landing by its way out
  upY: UP,                                       // its way out, over the way in: onto the well's balcony and the ledge over the climb
  pend: { x: -38, z: WELL.z, w: 30, d: 30, h: 22 },    // the arena
  strike: { x: 38, z: WELL.z, w: 30, d: 30, h: 18 },   // the hour track
  zone: { min: [-53, -1, WELL.z - 15], max: [-23, UP + 11, WELL.z + 15] },
  hours: { pS2: 2, pS4: 4, pS6: 6 },             // the hour track's plates, south to north
  track: { x: 40, z0: WELL.z - 5.6, z1: WELL.z + 5.6 },   // (v1.77: down the middle of the room; it ran along the east wall)
};
/** The Clockmaker's Cupboard, off the Escapement's far landing (west): its doors' z, its middle, the Clockmaker's clock's dial's height. */
export const CUPBOARD = { z: 56, x: -26.8, dialY: 6 };
/** The Mainspring Room, east off the landing across from the Cupboard: its middle, the spring's stele (its west face). */
export const MAINSPRING = { x: 35.8, z: CUPBOARD.z, stele: 39.8 };
/** The upper house, north of the well (floor UP): the Coil Chamber's middle and radius, the Winding Passage's middle. */
export const COIL = { z: WELL.z + WELL.r + 5.2 + 13, r: 13 };
export const WIND = { z: COIL.z + COIL.r + 5 + 15, w: 30, d: 30 };
/** The Clock Gallery: its near end (F0), its width; the great clock hung over the bridge's far end. */
export const GALLERY = { z0: WIND.z + WIND.d / 2 + 1.2, w: 36, d: 34.4, clock: { y: UP + 10, z: 27.2 } };

/** The Pendulum Hall's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arW', room: 'pend', zone: WING.zone, doors: ['dW', 'dWo'], extra: 2,
  shut: 'The door grinds shut behind you, and the pendulums’ keepers stir.',
  won: 'The last keeper falls still. The key’s cage sinks, and a way opens above.',
}];

/**
 * The Pendulum Hall (west, an arena: its doors shut behind you while the house's machines stand; won, the key's cage
 * sinks and its way out onto the ledge over the climb opens) and the Striking Room (east: the hour track down the middle
 * of the floor, a ball and three plates, each with its little clock on a post; on the house's hour the eye on its
 * obelisk opens its lids, and woken it lets the key out of its cage). Each holds one of the two small keys the door over
 * the climb takes.
 */
function wings(rt, K, M, { C2, dial, brass }) {
  const add = (P, o) => rt.add(P, o);
  const Pn = WING.pend, S = WING.strike, D = DOOR, R = WELL.r;
  const PX1 = Pn.x + Pn.w / 2, SX0 = S.x - S.w / 2;   // (the halls' inner faces toward the well)
  // ---- the Pendulum Hall
  K.corridor([PX1 + 0.6, C2], [-(R - 0.2), C2], 0, { w: D.w, h: D.h + 0.3, roof: false });   // (the way out's floor is its roof)
  K.hall({ x: Pn.x, z: Pn.z, w: Pn.w, d: Pn.d, y: 0, h: Pn.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', at: 0, ...D }, { side: 'e', at: 0, ...D, y0: WING.upY }] });
  add(Door, { id: 'dW', at: [PX1 + 1.8, 0, C2], yaw: Math.PI / 2, ...D });   // (open: it shuts behind you while they stand)
  // the stair up the north wall to the landing along the east wall by the way out, the key caged on it
  K.stairs([PX1 - 23, 0, WING.stairZ], [PX1 - 7, WING.upY, WING.stairZ], 3.6);
  K.slab(PX1 - 7, C2 - 4.6, PX1, WING.stairZ + 1.8, WING.upY, 1.2);
  add(Key, { id: 'kW', at: [PX1 - 3, WING.upY, C2 + 8], yaw: Math.PI / 2 });
  // the way out, over the way in: a passage to a balcony inside the well, beside the ledge over the climb
  add(Door, { id: 'dWo', at: [PX1 + 1.8, WING.upY, C2], yaw: Math.PI / 2, ...D, lamps: [{ lit: 'arW' }] });
  K.corridor([PX1 + 0.6, C2], [-(R - 0.2), C2], WING.upY, D);
  K.slab(-(R + 0.2), C2 - 4.6, -(R - 6), C2 + WELL.face, WING.upY, 1.2);   // (the balcony, up to the climb's block)
  // four columns to fight round, and great pendulums hung still along the south wall (the hall's name)
  for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) K.column(Pn.x + dx, Pn.z + dz, 0, Pn.h, 0.9);
  for (const x of [Pn.x - 10, Pn.x, Pn.x + 10]) {
    K.add(brass, box(0.14, 13, 0.14, x, 12.5, Pn.z - Pn.d / 2 + 0.8));
    K.add(brass, T(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 20).rotateX(Math.PI / 2), [x, 5.6, Pn.z - Pn.d / 2 + 0.8]));
  }
  // (beside the ways in and out, not over them: hung in the way out's doorway, it was climbed over, issue #115)
  dial(PX1 - 0.1, 6, C2 - 7, 1.4, -Math.PI / 2, [TAU * 4 / 12, 0.4]);
  add(Mark, { room: 'pend', at: [PX1 - 4, 0, C2 - 6], yaw: -Math.PI / 2, foes: [Pn.x, 0, Pn.z] });

  // ---- the Striking Room: the hour track down the middle of the floor, three plates on it, each with its clock on a post
  K.corridor([R - 0.2, C2], [SX0 - 0.6, C2], 0, D);
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: 0, h: S.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 'w', at: 0, ...D }] });
  const { x: TX, z0: Z0, z1: Z1 } = WING.track;
  K.add(M.dark, box(1.0, 0.04, Z1 - Z0 + 2.2, TX, 0.02, (Z0 + Z1) / 2));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.22, 0.12, Z1 - Z0 + 2.2, TX + sd * 0.8, 0.06, (Z0 + Z1) / 2));
  Object.entries(WING.hours).forEach(([id, hr], i) => {
    const z = Z0 + (Z1 - Z0) * (i + 1) / 3;
    add(Plate, { id, at: [TX, 0, z], r: 1.2 });
    K.both(M.wall, box(0.5, 4.2, 0.5, TX + 3.05, 2.1, z));
    dial(TX + 2.72, 3.2, z, 0.9, -Math.PI / 2, [TAU * hr / 12, TAU * hr / 12]);   // (its hour, both hands on it)
  });
  add(Ball, { id: 'ballS', a: [TX, 0.04, Z0], b: [TX, 0.04, Z1], r: 1.0, friction: 2.2 });
  // the striking eye on its obelisk past the track, lidded until the ball sits on the house's hour
  const OX = TX + 5.6;
  K.both(M.wallGlyph, box(1.4, 9.4, 1.4, OX + 0.7, 4.7, S.z));
  K.both(M.trim, box(1.8, 0.4, 1.8, OX + 0.7, 9.5, S.z));
  add(Switch, { id: 'sS', at: [OX - 0.15, 7.6, S.z], yaw: -Math.PI / 2, size: 1.1, lids: true, wrong: 'Its lids stay shut. The ball on the hour track is not at the house’s hour.' });
  K.add(brass, T(new THREE.TorusGeometry(1.6, 0.16, 6, 28), [OX - 0.05, 7.6, S.z], [0, Math.PI / 2, 0]));
  add(Key, { id: 'kE', at: [TX - 5, 0, S.z + 5], yaw: -Math.PI / 2 });
  add(Mark, { room: 'springs', at: [SX0 + 4, 0, S.z - 6], yaw: Math.PI / 2 });
}

/**
 * The Mainspring Room (east off the Escapement's far landing, its doorway facing the Cupboard's across the landing: v1.74,
 * issue #23 round 6): the house's mainspring coiled on a stele in the middle of the room, slack until its weight is home
 * (a ball rolled from the way in onto its plate at the stele's foot); then its six eyes wake, inside one breath (the coil),
 * and the Clockmaker's clock, out on the landing, ticks again: its lids lift. Seen on the way in, wound on the way back.
 */
function mainspring(rt, K, M, { brass }) {
  const add = (P, o) => rt.add(P, o);
  const copper = { paint: new THREE.Color('#d9643a'), smooth: false, side: THREE.FrontSide };
  const { x: X, z: Z, stele: SX } = MAINSPRING, Y = 0, X0 = X - 15;
  K.corridor([ESC.w / 2 + 0.6, Z], [X0 - 0.6, Z], Y, DOOR);
  K.hall({ x: X, z: Z, w: 30, d: 30, y: Y, h: 18, roof: 'oculus', oculus: 0.3, doors: [{ side: 'w', at: 0, ...DOOR }] });
  // the weight's groove, from the way in (where the weight waits) east to its plate at the stele's foot
  const GZ = Z - 1.2, GA = X0 + 6.7, GB = SX - 4.8;
  K.add(M.dark, box(GB - GA + 2.2, 0.04, 1.0, (GA + GB) / 2, Y + 0.02, GZ));
  for (const sd of [-1, 1]) K.both(M.trim, box(GB - GA + 2.2, 0.12, 0.22, (GA + GB) / 2, Y + 0.06, GZ + sd * 0.8));
  add(Ball, { id: 'ballM', a: [GA, Y + 0.04, GZ], b: [GB, Y + 0.04, GZ], r: 1.0, friction: 1.2 });
  add(Plate, { id: 'pM', at: [GB, Y, GZ], r: 1.25 });
  // the mainspring: a great flat coil of copper on the stele's west face, its drum in the middle, six eyes round it
  K.both(M.wallGlyph, box(1.2, 12.4, 11, SX + 0.6, Y + 6.2, Z));
  K.both(M.trim, box(1.6, 0.5, 11.4, SX + 0.6, Y + 12.4, Z));
  for (let i = 0; i < 5; i++) K.both(copper, T(new THREE.TorusGeometry(1.2 + i * 0.55, 0.16, 6, 36), [SX - 0.15, Y + 6, Z], [0, Math.PI / 2, 0]));
  K.both(brass, T(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 18).rotateZ(Math.PI / 2), [SX - 0.25, Y + 6, Z]));
  add(Bank, { id: 'k3', eyes: Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * TAU; return { at: [SX - 0.4, Y + 6 + Math.cos(a) * 4.1, Z + Math.sin(a) * 4.1], yaw: -Math.PI / 2 }; }), window: VOLLEY,
    unmet: 'The six eyes stay dull. The mainspring hangs slack: its weight isn’t home.',
    full: 'All six woke round the spring, and went dark again: six in a breath, more than a tank of shots.',
    fade: 'They woke, and went dark again before the rest.',
    woke: 'The mainspring takes up with a groan, and out on the landing the Clockmaker’s clock begins to tick.' });
  add(Mark, { room: 'mainspring', at: [X0 + 5, Y, Z + 4], yaw: Math.PI / 2 });
}

/**
 * The Clockmaker's Cupboard (off the Escapement's far landing, west: optional). Its door wants the Clockmaker's clock
 * on the landing woken round from the house's hour (it has no hand, as the gallery's great clock): four, eight, twelve.
 * Inside, a coffer of chimes and the great key.
 */
function cupboard(rt, K, M, { dial, brass }) {
  const add = (P, o) => rt.add(P, o);
  const { z: Z, x: X } = CUPBOARD, Y = 0, X1 = X + 6;
  K.corridor([X1 + 0.6, Z], [-(ESC.w / 2 + 0.6), Z], Y, DOOR);
  K.hall({ x: X, z: Z, w: 12, d: 12, y: Y, h: 10, roof: true, doors: [{ side: 'e', at: 0, ...DOOR }] });
  add(Door, { id: 'dC', at: [-(ESC.w / 2 + 0.6), Y, Z], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }] });
  // (v1.77) the Clockmaker's clock out on the landing, a tall case standing on the floor, its hand gone; three eyes round
  // its dial at four, eight and twelve (facing the way in, -z: as you face it, a clock's way round goes over the top toward -x)
  const C = LANDING.clock;
  K.both(M.wallGlyph, box(4.6, 8.6, 1.2, C.x, 4.3, C.z + 0.8));
  K.both(M.trim, box(5.0, 0.4, 1.6, C.x, 8.7, C.z + 0.8));
  K.both(brass, box(1.2, 2.6, 0.12, C.x, 2.4, C.z + 0.17));   // (its pendulum's window, still)
  dial(C.x, CUPBOARD.dialY, C.z + 0.12, 1.1, Math.PI, null);
  const tick = 'It ticks once and goes still. This little clock has lost its hand: count round from the house’s hour.';
  const stopped = 'Its lids stay shut. The little clock has stopped: whatever drives the house’s clocks hangs slack.';
  for (const [id, hr] of [['c1', 4], ['c2', 8], ['c3', 12]]) { const a = TAU * hr / 12; add(Switch, { id, at: [C.x - Math.sin(a) * 1.9, CUPBOARD.dialY + Math.cos(a) * 1.9, C.z - 0.1], yaw: Math.PI, size: 0.5, wrong: tick, lids: true, unmet: stopped }); }
  add(Coffer, { id: 'cache', at: [X - 2.2, Y, Z - 1.8], yaw: Math.PI / 2 });
  add(Key, { id: 'kB', big: true, at: [X - 2.2, Y, Z + 1.8], yaw: Math.PI / 2 });   // (v1.53: the great key, here since the mainspring moved off the gallery)
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const brass = metal('#d8a24a');
  const cream = { paint: new THREE.Color('#f3ead8'), smooth: false, side: THREE.FrontSide };
  const D = DOOR;
  /** A clock face on a wall: a cream dial, twelve ticks, two stopped hands (facing `yaw`). */
  const dial = (x, y, z, r, yaw, hands = [-0.6, 2.3]) => {
    K.both(cream, T(new THREE.CylinderGeometry(r, r, 0.2, 40).rotateX(Math.PI / 2), [x, y, z], [0, yaw, 0]));
    K.both(brass, T(new THREE.TorusGeometry(r + 0.1, 0.25, 6, 40), [x, y, z], [0, yaw, 0]));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.both(M.dark, T(new THREE.BoxGeometry(0.22, r * 0.18, 0.12).translate(Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82, 0.12).rotateZ(0), [x, y, z], [0, yaw, -a])); }
    if (hands) for (const [a, L, w] of [[hands[0], r * 0.55, 0.32], [hands[1], r * 0.8, 0.2]]) K.both(M.dark, T(new THREE.BoxGeometry(w, L, 0.1).translate(0, L / 2, 0.2).rotateZ(-a), [x, y, z], [0, yaw, 0]));
  };

  // ---- the Threshold (z 0..12): the Major's old bench, where his first garage was
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 6.2, 0.05], 1.5, 0);   // the stone he copied it from
  const wood = { paint: new THREE.Color('#8a5a3a'), smooth: false, side: THREE.FrontSide };
  K.both(wood, box(4.4, 0.18, 1.4, 4.4, 1.0, 9.6));
  for (const [x, z] of [[2.4, 9.1], [6.4, 9.1], [2.4, 10.1], [6.4, 10.1]]) K.add(wood, box(0.16, 1.0, 0.16, x, 0.5, z));
  K.add(M.dark, box(0.9, 0.5, 0.6, 3.4, 1.35, 9.6)); K.add(brass, T(new THREE.TorusGeometry(0.3, 0.06, 5, 14), [5.2, 1.3, 9.6], [Math.PI / 2, 0, 0]));
  K.add(M.accent, box(1.2, 0.08, 0.9, 5.6, 1.13, 9.4));   // a sheet of his pencilled plans
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  // (the Escapement's south wall, the Threshold's north: its middle on the hall's z0 less half its thickness)
  const EW = ESC.w / 2, EZ = (ESC.z0 + ESC.z1) / 2;
  K.wall(-(EW + 0.6), ESC.z0 - 0.6, EW + 0.6, ESC.z0 - 0.6, 0, ESC.y + ESC.h, { t: 1.2, holes: [{ at: EW + 0.6, w: D.w, h: 8 }] });

  // ---- the Escapement (z 12.6..40): a pit, a disc that swings across it once the eyes round the dial on its tower are
  // splashed; and its far landing (z 40..72), the Clockmaker's clock and the counterweight's groove on it
  K.hall({ x: 0, z: EZ, w: ESC.w, d: ESC.z1 - ESC.z0, y: ESC.y, h: ESC.h, floor: false, roof: 'oculus', oculus: 0.25, omit: ['s'],
    doors: [{ side: 'n', ...D, y0: -ESC.y }, { side: 'w', at: CUPBOARD.z - EZ, ...D, y0: -ESC.y }, { side: 'e', at: CUPBOARD.z - EZ, ...D, y0: -ESC.y }] });
  K.slab(-EW, ESC.z0, EW, ESC.near, 0, 8);
  K.slab(-EW, ESC.far, EW, ESC.z1, 0, 8);
  K.both(M.dark, box(ESC.w, 1, ESC.far - ESC.near, 0, -8.5, (ESC.near + ESC.far) / 2));
  add(Pit, { room: 'esc', min: [-(EW + 1), -10, ESC.near], max: [EW + 1, -2, ESC.far] });
  add(Platform, { path: [[0, 0, 20.4], [0, 0, 37.6]], r: 2.2, speed: 2.0, pause: 1.6, when: { open: 'discs' } });
  // the escapement's anchor overhead, and a great stopped wheel on each wall
  K.both(M.dark, T(new THREE.TorusGeometry(6, 0.5, 6, 40), [-(EW - 0.6), 6, 29], [0, Math.PI / 2, 0]));
  K.both(M.dark, T(new THREE.TorusGeometry(6, 0.5, 6, 40), [EW - 0.6, 6, 29], [0, Math.PI / 2, 0]));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; for (const s of [-1, 1]) K.both(brass, T(new THREE.BoxGeometry(0.4, 1.2, 1.2), [s * (EW - 0.6), 6 + Math.cos(a) * 6.6, 29 + Math.sin(a) * 6.6], [a, 0, 0])); }
  K.both(brass, T(new THREE.BoxGeometry(ESC.w, 0.6, 0.6), [0, 17, 29]));
  // (v1.77) the dial on its tower out in the pit, beside the disc's way (it hung over the far door), its one hand at eight,
  // and three eyes round it at twelve, four and eight (as you face it, a clock's way round goes right to left over the
  // top: x = -sin)
  K.both(M.wallGlyph, box(7, DIAL.y + 3.8 - ESC.y, 1.6, DIAL.x, (DIAL.y + 3.8 + ESC.y) / 2, DIAL.z + 1.0));
  K.both(M.trim, box(7.4, 0.4, 2.0, DIAL.x, DIAL.y + 3.9, DIAL.z + 1.0));
  dial(DIAL.x, DIAL.y, DIAL.z + 0.12, 2.0, Math.PI, [TAU * 8 / 12, TAU * 8 / 12]);
  const tick = 'It ticks once, and goes still: the makers’ clock counts round from where its hand points, the way a clock goes.';
  for (const [id, hr] of [['s1', 8], ['s2', 12], ['s3', 4]]) { const a = TAU * hr / 12; add(Switch, { id, at: [DIAL.x - Math.sin(a) * DIAL.r, DIAL.y + Math.cos(a) * DIAL.r, DIAL.z - 0.2], yaw: Math.PI, size: 0.8, wrong: tick }); }
  add(Mark, { room: 'esc', at: [-6.5, 0, 15.4], yaw: Math.PI / 2 });
  cupboard(rt, K, M, { dial, brass });
  mainspring(rt, K, M, { brass });   // (v1.74: east off the far landing, across from the Cupboard)
  // the winding's counterweight on the landing (v1.77: its groove up the landing's east side to its socket; it ran on
  // through the doorway into the well)
  const B = LANDING.ball;
  K.add(M.dark, box(1.0, 0.04, B.z1 - B.z0 + 1.8, B.x, 0.02, (B.z0 + B.z1) / 2));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.22, 0.12, B.z1 - B.z0 + 1.8, B.x + sd * 0.8, 0.06, (B.z0 + B.z1) / 2));
  add(Ball, { id: 'ball1', a: [B.x, 0.04, B.z0], b: [B.x, 0.04, B.z1], r: 1.1, friction: 1.0 });
  add(Plate, { id: 'p1', at: [B.x, 0, B.z1], r: 1.3 });
  K.both(brass, box(3.2, 0.5, 0.6, B.x, 0.25, B.z1 + 1.6));   // (the socket's brass stop)
  // its chain, up the stop's post and over to the well's doorway: what the socket winds
  K.both(M.wall, box(0.8, 9, 0.8, B.x, 4.5, B.z1 + 2.4));
  K.add(brass, box(0.18, 0.18, ESC.z1 - B.z1 - 2.4, B.x, 8.6, (ESC.z1 + B.z1 + 2.4) / 2));

  // ---- the Winding Well (a round hall): a wall to climb (its top at UP), the door at its top; the ways west and east
  const C2 = WELL.z, R = WELL.r;
  K.corridor([0, ESC.z1 + 0.6], [0, C2 - (R - 0.2)], 0, D);
  // (the house's hub since v1.48: a way west to the Pendulum Hall and east to the Striking Room at its floor, and over
  // the way west the Pendulum Hall's way out, onto a balcony beside the ledge over the climb)
  K.rotunda({ x: 0, z: C2, y: 0, r: R, h: WELL.h, seg: 40, gaps: [{ a: Math.PI, ...D }, { a: 0, ...D, y0: UP }, { a: -Math.PI / 2, ...D }, { a: Math.PI / 2, ...D }, { a: -Math.PI / 2, ...D, y0: WING.upY }], oculus: 0.3 });
  // (the house's one climb: its other walls are not climbed, issue #115)
  const FZ = C2 + WELL.face, BZ = C2 + R - 0.05;
  K.climbable('the Winding Well\'s climb: the block\'s face, from the hub\'s floor to the ledge and the door of two keyholes', () => {
    K.both(M.wallGlyph, box(2 * R + 0.4, UP, BZ - FZ, 0, UP / 2, (FZ + BZ) / 2));
    K.both(M.trim, box(2 * R + 0.6, 0.3, 0.6, 0, UP - 0.1, FZ + 0.25));
  });
  add(Door, { id: 'd2', at: [0, UP, C2 + R + 0.3], ...D, lamps: [{ drumOn: ['ball1', 'p1'] }] });   // (and two keyholes: logic `lock`)
  dial(R - 0.6, 14.2, C2, 2.6, -Math.PI / 2, [TAU * 4 / 12, 0.4]);   // (stopped at four, as every clock in the house: over the way east)
  add(Mark, { room: 'well', at: [-8, 0, C2 - 8], yaw: Math.PI * 0.75 });
  wings(rt, K, M, { C2, dial, brass });

  // ---- the corridor and the Coil Chamber (floor UP): the chest; its north door sinks for the coil in hand
  const C3 = COIL.z, RC = COIL.r;
  K.corridor([0, C2 + R], [0, C3 - (RC - 0.2)], UP, D);
  K.rotunda({ x: 0, z: C3, y: UP, r: RC, h: 16, seg: 32, gaps: [{ a: Math.PI, ...D }, { a: 0, ...D }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(0, UP, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // copper coils round the walls, warm
  const copper = { paint: new THREE.Color('#d9643a'), smooth: false, side: THREE.FrontSide };
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.add(copper, T(new THREE.TorusGeometry(0.9, 0.18, 6, 18), [s * (RC - 0.4), UP + 2 + i * 0.6, C3 + 2], [0, Math.PI / 2, 0]));
  add(Mark, { room: 'coil', at: [8, UP, C3 - 7], yaw: -Math.PI * 0.75 });
  add(Door, { id: 'dP', at: [0, UP, C3 + RC + 0.3], ...D, lamps: [{ item: 'boomerang' }] });   // (v1.77: the coil in hand; the boomerang since issue #377)

  // ---- the Winding Passage (floor UP), a room of its own (v1.77): six eyes round the makers’ great escape wheel on its stele
  // in the middle of the floor, to wake in one breath
  const A = WIND.z, AZ0 = A - WIND.d / 2, F0 = GALLERY.z0;
  K.corridor([0, C3 + RC], [0, AZ0 - 0.6], UP, D);
  K.hall({ x: 0, z: A, w: WIND.w, d: WIND.d, y: UP, h: 18, roof: 'oculus', oculus: 0.3, omit: ['n'], doors: [{ side: 's', ...D }] });
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) K.add(copper, T(new THREE.TorusGeometry(0.7, 0.14, 6, 16), [s * (WIND.w / 2 - 0.4), UP + 1.4 + i * 0.5, A - 4], [0, Math.PI / 2, 0]));
  K.both(M.wallGlyph, box(10.4, 12, 1.2, 0, UP + 6, A + 0.6));
  K.both(M.trim, box(10.8, 0.5, 1.6, 0, UP + 12, A + 0.6));
  K.both(brass, T(cogGeometry(2.0, 0.5).rotateZ(Math.PI / 6), [0, UP + 6, A - 0.4]));   // (the makers’ great escape wheel, stopped: its six teeth between the eyes)
  K.both(brass, T(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 18).rotateX(Math.PI / 2), [0, UP + 6, A - 0.2]));
  add(Bank, { id: 'k1', eyes: ring6(0, UP + 6, A - 0.4, 4.1, Math.PI), window: VOLLEY,
    full: 'All six woke, and went dark again: six in a breath, more than a tank of shots.',
    fade: 'They woke, and went dark again before the rest. Six eyes, one breath: three on the boomerang, three splashed.' });
  add(Mark, { room: 'wind', at: [-8, UP, AZ0 + 5], yaw: Math.PI / 2 });
  add(Door, { id: 'd3', at: [0, UP, F0 - 0.6], ...D, lamps: [{ lit: 'k1' }] });

  // ---- the Clock Gallery: a chasm, a bridge a second bank of six raises (round the great clock hung over its far end)
  const GW = GALLERY.w / 2, GD = GALLERY.d, GY = UP - 15;
  K.hall({ x: 0, z: F0 + GD / 2, w: GALLERY.w, d: GD, y: GY, h: 33, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', ...D, y0: UP - GY }, { side: 'n', ...D, y0: UP - GY }] });
  K.slab(-GW, F0, GW, F0 + 6, UP, 15);
  K.slab(-GW, F0 + 26, GW, F0 + GD, UP, 15);
  K.both(M.dark, box(GALLERY.w, 1, 20, 0, GY - 0.4, F0 + 16));
  add(Pit, { room: 'gallery', min: [-(GW + 1), GY - 2, F0 + 6], max: [GW + 1, UP - 5, F0 + 26] });
  add(Bridge, { id: 'br1', a: [0, UP, F0 + 5.9], b: [0, UP, F0 + 26.1], w: 4, n: 8 });
  // (v1.74, issue #23 round 6) the gallery's great pendulum, hung from a beam under the roof over the bridge's middle,
  // swinging along it: its bob sweeps low over the middle of the bridge and rises at either end of its swing. Cross under
  // it as it swings away, in its beat; met, it knocks you back along the bridge (it does not hurt)
  K.both(brass, box(GALLERY.w + 0.2, 0.7, 0.9, 0, GALLERY_BEAT.pivot + 0.55, F0 + 16));   // (wall to wall, across the oculus)
  add(Swing, { at: [0, GALLERY_BEAT.pivot, F0 + 16], len: GALLERY_BEAT.len, amp: GALLERY_BEAT.amp, period: GALLERY_BEAT.period, phase: 0.25, yaw: -Math.PI / 2,
    bob: 'disc', size: 1.1, gentle: true, knock: 7, room: 'gallery',
    rings: 'The brass bob rings under the splash and swings on. The great pendulum keeps the gallery’s beat: cross under it as it swings away.' });
  // (v1.77) the great clock face, its hands gone, hung on rods from the roof over the bridge's far end (it was on the far
  // wall); six eyes round it (ring6 goes round toward +x: as you face it, that is twelve, ten, eight, six, four, two), to
  // wake in turn from four: four, six, eight, ten, twelve, two
  const GC = GALLERY.clock, GZ = F0 + GC.z;
  dial(0, GC.y, GZ, 3.8, Math.PI, null);
  K.both(brass, T(new THREE.TorusGeometry(6.3, 0.22, 6, 48), [0, GC.y, GZ - 0.1], [0, Math.PI, 0]));
  for (const s of [-1, 1]) K.both(brass, box(0.3, GY + 33 - (GC.y + 5.8), 0.3, s * 2.2, (GY + 33 + GC.y + 5.8) / 2, GZ + 0.05));
  K.add(M.glyph, T(glyphGeometry(1.4, 0.12), [0, GC.y + 7.1, GZ - 0.15], [0, Math.PI, 0]));
  add(Bank, { id: 'k2', eyes: ring6(0, GC.y, GZ - 0.5, 4.9, Math.PI), size: 1.0, window: VOLLEY, order: [4, 3, 2, 1, 0, 5],
    full: 'All six woke round the clock, and went dark again: six in a breath, more than a tank of shots.',
    fade: 'They woke round the clock, and went dark again before the rest.',
    wrong: 'The eyes ring out of step and all go dark. The great clock has lost its hands: count round from the hour every clock in this house stopped at.' });
  dial(0, UP + 11.4, F0 + 0.3, 1.3, 0, [TAU * 4 / 12, 0.4]);   // the little clock over the way in, behind you: stopped at four
  galleryClockwork(rt, K, F0, brass);
  add(Door, { id: 'd4', at: [0, UP, F0 + GD + 0.6], ...D });
  add(Mark, { room: 'gallery', at: [-7, UP, F0 + 3], yaw: 0 });

  // ---- the corridor and the Foreman's Workshop (floor UP)
  const H0 = F0 + GD + 0.6;
  const AE = K.vestibule(H0, UP);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, UP, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 20, CW = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CW, y: UP, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, ...D }], oculus: 0.3 });
  // a great dial inlaid in the floor, a gear's teeth round it, a pendulum's rod down from the oculus
  K.both(cream, T(annulus(8.2, 9.2, 0.25, 64), [0, UP + 0.25, CW]));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.both(M.dark, T(new THREE.BoxGeometry(0.35, 0.06, 1.4), [Math.sin(a) * 7.4, UP + 0.03, CW + Math.cos(a) * 7.4], [0, a, 0])); }
  K.add(brass, T(annulus(12.0, 12.8, 0.08, 72), [0, UP + 0.06, CW]));
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; K.add(brass, T(new THREE.BoxGeometry(0.7, 0.08, 0.7), [Math.sin(a) * 13.1, UP + 0.04, CW + Math.cos(a) * 13.1], [0, a, 0])); }
  for (const a of [0.9, 2.2, 4.0, 5.3]) dial(Math.sin(a) * (HR - 0.2), UP + 12, CW + Math.cos(a) * (HR - 0.2), 2.4, a + Math.PI, [a * 2, a * 5]);
  // the way out, past the far door
  const X0 = CW + HR + 0.7, X1 = CW + HR + 10;
  add(Door, { id: 'd5', at: [0, UP, X0], ...D });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, UP, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, UP, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, UP, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, UP, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, UP + 10.4, (X0 + X1) / 2));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, UP, X1 + 0.5]));
  K.solid(box(4, 5, 0.1, 0, UP + 2.5, X1 + 0.5));

  const model = foremanModel(rt.skin?.foreman);   // (in the house's skin, its colours: skins/clock-house.js)
  model.pos.copy(K.world(0, UP, CW + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, UP, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, UP, CW), r: HR, y: K.world(0, UP, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-56, -12, -3), V(56, UP + 32, X1 + 2)),
    gadget: { at: W(0, UP + 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, UP + 0.5, X1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 8, 26, 22], [0, 8, 56, 22], [CUPBOARD.x, 5, CUPBOARD.z, 10], [MAINSPRING.x, 9, MAINSPRING.z, 20], [0, 14, C2, 24], [WING.pend.x, 10, C2, 22], [WING.strike.x, 9, C2, 20],
      [0, UP + 8, C3, 18], [0, UP + 9, A, 22], [0, UP + 7, F0 + 16, 26], [0, UP + 7, F0 + 30, 18], [0, UP + 7, CW, 30]],
    guardian: { def: { ...FOREMAN, onHit: foremanHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Clock-House in the sand
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 7, sill = 0.4;
  // (on the sand, its apron sunk to the lowest of it)
  const base = level.ground?.baseAt ? level.ground.baseAt(SITE.x, SITE.z, R + 5) - 0.3 : 0;
  const K = new TempleKit(rt.root, 'The Clock-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M;
  const brass = metal('#d8a24a');
  const teal = { paint: new THREE.Color('#62c3c9'), smooth: true, side: THREE.FrontSide };
  const tin = { paint: new THREE.Color('#62c3c9'), smooth: false, side: THREE.DoubleSide };
  const cream = { paint: new THREE.Color('#f3ead8'), smooth: false, side: THREE.FrontSide };
  landmark(K, 'garage', { y: sill, R });
  // the great clock over the door: a cream dial in a brass ring, twelve ticks, two hands (the change turns them)
  const cy = sill + 37, cz = 5.2, cr = 8;
  K.both(ceramic('#245c68'), T(new THREE.CylinderGeometry(cr, cr, 0.3, 40).rotateX(Math.PI / 2), [0, cy, cz]));
  K.both(brass, T(new THREE.TorusGeometry(cr + 0.1, 0.28, 6, 40), [0, cy, cz + 0.1]));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.both(brass, T(new THREE.BoxGeometry(0.24, 1.1, 0.1).translate(0, cr * 0.8, 0).rotateZ(-a), [0, cy, cz + 0.2])); }
  // and round the great clock, a second ring of brass and four bosses (the clock's frame, as drawn)
  K.add(brass, T(new THREE.TorusGeometry(cr + 0.7, 0.12, 5, 40), [0, cy, cz + 0.05]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; K.add(brass, T(new THREE.SphereGeometry(0.28, 8, 6), [Math.sin(a) * (cr + 0.7), cy + Math.cos(a) * (cr + 0.7), cz + 0.15])); }
  // The reference's brass-edged doorway: two machined brass frames stepping back into the tower's foot, teal light
  // (src/temples/portal.js), and in it the recessed bronze leaves with their narrow centre seam.
  const P = portal(K, { y: sill, z: R + 0.25, w: 3.4, h: 6.6, shape: 'rect', layers: 2, step: 0.55, recess: 0.5, back: 1.4, into: 3,
    frame: brass, inlay: '#6fe3dc' });
  for(const sign of [-1,1]){
    K.add(brass,box(1.35,6.3,.18,sign*.74,sill+3.15,R+.48));
    K.add(metal('#a66f2e'),box(.9,4.8,.1,sign*.74,sill+3.3,R+.59));
  }
  // a lean-to against the drum: a tin roof on posts, a bench, a painted board (the glassworkers' clock-bench)
  const sx = -(R + 3.4), sz = 1.4;
  for (const [x, z] of [[sx - 2.4, sz - 2.6], [sx - 2.4, sz + 2.6]]) K.both(M.trim, box(0.3, 3.6, 0.3, x, sill + 1.8, z));
  K.add(tin, T(new THREE.BoxGeometry(5.6, 0.12, 6.4), [sx, sill + 3.8, sz], [0, 0, -0.18]));
  K.both({ paint: new THREE.Color('#8a5a3a'), smooth: false, side: THREE.FrontSide }, box(3.2, 0.16, 1.1, sx + 0.4, sill + 1.0, sz - 1.8));
  K.add({ paint: new THREE.Color('#e88fa6'), smooth: false, side: THREE.FrontSide }, box(2.6, 1.0, 0.1, sx, sill + 3.1, sz + 3.25));
  K.add(cream, box(2.0, 0.18, 0.12, sx, sill + 3.2, sz + 3.32)); K.add(cream, box(1.4, 0.18, 0.12, sx - 0.2, sill + 2.9, sz + 3.32));
  const dialGlass = glazing('#c5e3df', K.world(0,cy,cz+.8));
  K.both(dialGlass,new THREE.SphereGeometry(1,48,16,0,TAU,0,Math.PI/2).scale(cr,.55,cr).rotateX(Math.PI/2).translate(0,cy,cz+.8));
  K.flush();
  glaze(K, rt.veils, dialGlass, {color:'#9bcbd0',alpha:.10});

  // the makers' clockwork: great cogs half sunk in the sand round the house, standing on edge, facing out (they turn after)
  const cogM = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass', key: 'temple.garage.cogs' });
  const lampM = makeMaterial({ color: '#f2c54b', glow: 0.05, flat: true, key: 'temple.garage.lamps' });
  const cogs = [];
  for (const [i, [a, r]] of [[-2.0, 9], [-2.75, 12], [2.1, 7], [2.9, 8]].entries()) {
    // (round from the door: behind and to the sides of the house, clear of its porch and the way in)
    const dir = V(Math.sin(yaw + a), 0, Math.cos(yaw + a)), d = R + 7 + r * 0.5;
    const x = SITE.x + dir.x * d, z = SITE.z + dir.z * d;
    const gy = level.ground?.baseAt ? level.ground.baseAt(x, z, r * 0.5) : base;
    const g = new THREE.Group();
    g.position.set(x, gy + r * 0.25, z);
    g.quaternion.setFromUnitVectors(V(0, 0, 1), V(-dir.z, 0, dir.x));   // (its face to the way round the house: you see it walking past)
    const teeth = [new THREE.TorusGeometry(r, 0.9, 6, 36).toNonIndexed()];
    for (let k = 0; k < Math.round(r * 2.4); k++) { const a = (k / Math.round(r * 2.4)) * TAU; teeth.push(new THREE.BoxGeometry(1.6, 1.6, 1.2).translate(0, r + 1.0, 0).rotateZ(a).toNonIndexed()); }
    for (let k = 0; k < 4; k++) teeth.push(new THREE.BoxGeometry(0.7, r * 2, 0.6).rotateZ((k / 4) * Math.PI).toNonIndexed());
    for (const q of teeth) q.deleteAttribute('uv');
    const m = new THREE.Mesh(mergeAll(teeth), cogM);
    m.userData.dynamic = true; m.userData.noCollide = true;
    g.add(m);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 12, 8), lampM);
    hub.userData.noCollide = true; hub.userData.dynamic = true;
    g.add(hub);
    rt.root.add(g);
    cogs.push({ g, m, dir: i % 2 ? -1 : 1, rate: 3.2 / r });
  }
  // the clock's hands (separate: they turn)
  const handsM = metal('#efd29a');
  const hands = new THREE.Group();
  hands.position.copy(K.world(0, cy, cz + 0.35));
  hands.rotation.y = yaw;
  const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.5, 0.12).translate(0, 0.65, 0), handsM);
  const minH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.12).translate(0, 1.0, 0.08), handsM);
  hourH.scale.set(1.7, 3.1, 1); minH.scale.set(1.7, 3.1, 1);
  hands.add(hourH, minH);
  hands.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  rt.root.add(hands);
  const at = K.world(0, sill, R + 1.4);
  const front = K.world(0, sill, R + 9);
  return { door: { at, heading: yaw, ...P.door }, kit: K, R, sill, cogs, hands, hourH, minH, lampM, clear: [{ x: SITE.x, z: SITE.z, r: R + 7 }, { x: front.x, z: front.z, r: 6 }] };
}

function mergeAll(list) {
  // (a few dozen boxes and a torus: merged once at build)
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const q of list) { pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ the world change: the dunes keep time again
/**
 * Once the Foreman is set right, the Clock-House's clock keeps the true time (until then its hands stutter
 * back and forth, stuck where they jumped the night the light passed), the makers' cogs in the sand turn in
 * step, their hub lamps lit, and a pendulum swings in the porch.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Clock-House keeps time (the world change)';
  rt.root.add(root);
  root.visible = false;
  // the pendulum in the porch, a brass bob on a rod
  let bob = null;
  if (O) {
    bob = new THREE.Group();
    bob.position.copy(O.kit.world(0, O.sill + 6.6, O.R + 1.8));
    bob.rotation.y = SITE.heading;
    const m = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass', key: 'temple.garage.bob' });
    bob.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6).translate(0, -1.7, 0), m), new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 18).rotateX(Math.PI / 2).translate(0, -3.5, 0), m));
    bob.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    root.add(bob);
  }
  let k = 0, want = 0, spin = 0;
  const apply = () => { root.visible = k > 0.01; };
  return {
    root,
    get on() { return want === 1; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); apply(); }
      if (!O) return;
      // the clock: the true time once it is set right; until then its minute hand stutters where it jumped
      if (want) {
        const now = new Date(), h = (now.getHours() % 12) + now.getMinutes() / 60, mn = now.getMinutes() + now.getSeconds() / 60;
        O.hourH.rotation.z += (-(h / 12) * TAU - O.hourH.rotation.z) * Math.min(1, dt * 0.8);
        O.minH.rotation.z += (-(mn / 60) * TAU - O.minH.rotation.z) * Math.min(1, dt * 0.8);
      } else { O.hourH.rotation.z = -2.1; O.minH.rotation.z = -0.4 + (Math.sin(t * 7) > 0.6 ? 0.08 : 0); }
      spin += dt * k;
      for (const c of O.cogs) c.m.rotation.z = c.dir * spin * c.rate;
      O.lampM.uniforms.uGlow.value = 0.05 + 0.8 * k * (0.85 + 0.15 * Math.sin(t * 2));
      if (bob) bob.rotation.z = Math.sin(t * Math.PI) * 0.35 * k;
    },
  };
}

export const GARAGE_TEMPLE = {
  id: 'garage', levelId: 'glassdunes', name: 'The Clock-House', doorLabel: 'door of the Clock-House',
  gadget: 'boomerang', gadgetBox: 'garage.temple.coil', arenaDoor: 'd4', arenas: ARENAS,   // (the box's id from when it held the coil: the saves' flag)
  origin: [-300, 1800, -420], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  skin: clockHouseSkin,   // (issue #342: its futuristic look inside, src/temples/skins/clock-house.js)
  local: { person: 'wim', out: 7, side: 6 },
  enterLine: 'Inside the Clock-House everything ticks, but out of step, like a room full of clocks that have quarrelled.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out in the dunes, the clock over the Clock-House’s door keeps time.', 'resolved.out'); },
  // the Foreman's six numerals: each a target while its face is open; all six inside a breath is a hit. In step (the
  // clock's order counted from four, where its hands come round to as it opens) each rings and its ring lights; in
  // its last phase only in step takes, and a numeral out of step puts them all out
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const N = G.model.numbers ?? 6, hits = new Array(N).fill(-1e9), at = Array.from({ length: N }, () => V());
    let step = 0, openT = 0;   // numerals hit in step so far, counted from four; the time into this opening
    const dark = () => { step = 0; for (let k = 0; k < N; k++) G.model.step?.(k, false); };
    rt.volley = (i) => {
      const clock = rt.time;
      if (G.state !== 'open') { rt.notice('The glass is down over its face. Wait for it to strike, and open.', 'cf.shut'); return; }
      const last = G.phaseIndex >= 2;
      // a new opening, or the turn so far faded (its first more than a breath ago): begin again
      if (G.t < openT) dark();
      openT = G.t;
      if (step && clock - hits[FROM_FOUR[0]] > VOLLEY) { dark(); rt.notice('The numerals you rang have gone dark again: six, inside one breath.', 'cf.fade'); }
      if (step && i === FROM_FOUR[step - 1]) return;   // (the one just rung, again: nothing)
      if (i === FROM_FOUR[step]) {
        step++;
        G.model.step?.(i, true);
        rt.sound?.orbNote?.(step, G.model.vent(i, at[i]), { size: 0.8 });
      } else {
        if (last) {
          hits.fill(-1e9); dark();
          rt.sound?.critter?.('blip', 0.7);
          rt.notice('The numerals ring out of step and all go dark. Its hands point at four.', 'cf.wrong');
          return;
        }
        dark();
        if (i === FROM_FOUR[0]) { step = 1; G.model.step?.(i, true); }
      }
      hits[i] = clock;
      rt.sound?.critter?.('clank', 0.9);
      const lit = hits.filter((h) => clock - h <= VOLLEY).length;
      const inStep = step === N;
      if (inStep || (lit === N && !last)) {
        const phase = G.phaseIndex;
        hits.fill(-1e9); dark();
        if (inStep && phase === 1) rt.notice('All six in step, round from four: for a moment it keeps time.', 'cf.step');
        rt.notice('All six numerals at once: its hands stagger, and slow.', `cf.volley.${phase}`);
        G.add(0.25, 'volley');
        rt.rumble(0.6, 0.45);
        if (G.state === 'open') { G.enter('fight'); G.cool = 1.6; }
      } else if (lit === 3 && !rt.logic.has('coil')) rt.notice('Three numerals, and the tank is dry: three more on the boomerang.', 'cf.three');
    };
    for (let i = 0; i < N; i++) {
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.6, position: () => G.model.vent(i, at[i]), enabled: () => G.state === 'open', onHit: (mode) => { if (mode !== 'push') rt.volley(i); return true; } }));
    }
  },
};
