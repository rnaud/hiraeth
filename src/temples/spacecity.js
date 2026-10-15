import { landmark } from './landmarks.js';
import { stone, ceramic, metal } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, paint } from './kit.js';
import { Door, Plate, Ball, Switch, Updraft, Platform, Bridge, Mark, Pit, Key, Weight, Coffer } from './pieces.js';
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
// the tether (the gun's new mode, src/fluid-kit.js MODES.tether) brings it home. Before it, the plain verbs: a ball
// pushed, an eye splashed, the wings in a column of the void's breath.
//   the Landing Stage    the first mark, the way out
//   the Capstan Hall     the hub: a tall round hall round the dead great capstan, its cables slack. Ways off it to
//                        the two wings, south-west and south-east, the great door north (its lamp waits on an eye
//                        nobody can see from the hall), and high up the moorers' gate, the way back at the end.
//                        (v1.76, issue #337) On its east side a coffer caged by the wall, a plate before it that sinks
//                        the cage while weighed down, and the moorers' weight high on a cleat where a cable from the
//                        capstan ends (v1.77: on a mast in the floor), out of reach: the grappling hook pulls it down into your hands; set on the plate, it
//                        holds the cage down (a reward, nothing waits on it)
//   the Winch Room       (south-west) the counterweight, a stone ball rolled along its groove down the middle of
//                        the floor into its socket at the winch's mouth: the Lamp Shaft's gate, across the hall, rises (its pawl holds it after)
//   the Lamp Shaft       (south-east) a tall well whose grating breathes the void's air up: open the wings over it
//                        and it lifts you to the top of the pier beside it and the lamp-eye there (v1.77: it was in a
//                        niche over a balcony; the top's edge hides it from the floor: seen only from up there),
//                        which opens the great door, back across the hall
//   the Cord Loft        the makers' chest: TETHER MODE (src/items.js 'tether'). Its try: a ring on a post that
//                        brings its lamp down. Its west side was the Mooring Passage (a room on, before v1.77): the
//                        door into the Drift is chained to a moorers' ring hung over the loft's floor, too high to
//                        reach, and only a pull wakes it (the tether's first lock, where a miss costs nothing)
//   the Drift            a void hall. The gangway to the high far landing rises only when the ball is home on the
//                        near landing's plate; the ball sits out on its cable-rail over the void, where nobody can
//                        stand behind it to push: pull it home
//   the Cable Walk       an open walkway over the stars to
//   the Balance          the twist: a void hall, one ball on a rail out over the void and two places for it. Pushed
//                        OUT to the far cup, its weight tips the balance and the pan rides between the landings, up
//                        to the Moorers' Gallery; pulled back HOME it frees the west door. Push, then pull
//   the Moorers' Gallery the south landing: the ring that holds the west door's chain hangs on a davit over it, seen from
//                        the door across the void, reached only here; and the moorers' gate back to the Capstan Hall
//                        (a balcony and a cradle down). (v1.53, issue #23) The gate takes a small key now (the ring
//                        opened it before; its chain holds the great key's cage instead): the key is in
//   the Rope Store       (v1.53, south off the Gallery, an arena) the moorers' spare cable on drums; its door shuts
//                        behind you while its keepers stand. Won, the small key's cage sinks: for the moorers' gate
//   the Capstan Hall's balcony (v1.53) inside the gate, high over the hub you began in: the great key's cage, and a
//                        ball out along a cable-rail from the balcony's lip over the floor eleven metres down. Pull it
//                        home onto the cage's footstone (the Drift's lesson, back where the house began); with the
//                        Gallery's ring pulled (the cage's chain runs up over the gate to it) the cage sinks, and the
//                        Capstan Floor's door takes the great key
//   the Capstan Floor    the guardian (a robot: its meter is damage): the Anchor-Warden. When it has thrown its
//                        anchor and its drum stalls, pull the anchor home with the tether and it jams. In its second
//                        phase it hooks them over the bollards; in its last it pays them out over the void, out of
//                        reach: push its capstan bars to wind them in, then pull (the Balance's twist)
// (v1.77, issue #336: redone to the temple redesign's rules, the plan below: rooms 34 m across and more, doors 7 by 9,
// every puzzle in the middle of its room, the Rope Store the one fight; docs/design/temple-redesign.md.)
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
export const SHAFT_PIER = { draught: 37, pier: 43.3, top: 13, eye: 44 };
/** The moorers' corridor from the Gallery east to the Capstan Hall's balcony, along x at `z`, its floor at the Gallery's. */
export const MOOR = { z: 26, gate: -43.6 };
export const MOOR_A = Math.atan2(-Math.sqrt(R1 * R1 - (MOOR.z - C1) ** 2), MOOR.z - C1);   // (where it meets the hall's wall)
/** The Balance: the north landing's floor, the south landing's (the Gallery), the ball's rail (x) and its two cups (z);
 * the hall round them (its middle, width, depth) and the two lips over the void. */
export const BALANCE = { north: 6, south: 11, x: -58, a: 44.5, b: 34.0, home: 43.0, out: 35.0, cx: -62, cz: 35, w: 32, d: 36, lipN: 40, lipS: 30 };
/** The Drift: the far landing's height (no glide climbs to it), the ball's rail (z, x from the plate out over the void),
 * the near lip, the far one, the gangway's z; the hall round them (x0..x1, z0..z1). */
export const DRIFT = { far: 6, z: 72, a: -31, b: -41.2, plate: -32, lip: -35.8, farLip: -53.4, gang: 84, x0: -69, x1: -21, z0: 64, z1: 94 };
/** The Cord Loft: its middle (z) and radius. */
export const LOFT = { z: 69, r: 17, h: 18 };
/** The Capstan Floor: its middle, radius, floor. */
export const FLOOR = { x: -107, z: 46.5, r: 19, y: 6 };
/** (issue #356) The bars across the Capstan Floor's four windows: a rail at `rail` m and `n` bars `gap` m apart over it (the window's gap is cut by whole stones: wider than its 9 m). */
export const WINDOW_BARS = { rail: 2.0, gap: 0.75, n: 17 };
/** (v1.53) The Rope Store, south off the Moorers' Gallery (an arena, the house's one fight since v1.77); its north side
 * the Balance's south wall. */
export const STORE = { x: -64, z: 0.8, w: 30, d: 30, h: 16.6 };   // (its roof over the Balance's wall's top: no face shared)
STORE.zone = { min: [STORE.x - STORE.w / 2, 10, STORE.z - STORE.d / 2], max: [STORE.x + STORE.w / 2, 28, STORE.z + STORE.d / 2] };
/** (v1.53) The balcony's cable-rail in the Capstan Hall (v1.77: out from the balcony's lip toward the middle, over the
 * floor, `side` m beside the moorers' radial): the footstone `home` m from the hall's middle, the rail `rail` m on
 * inward (as long as it was round the wall); the balcony's lip at `lip`; the cradle and the great key on it. */
export const PERCH = { home: 9.4, rail: 4.476, side: 2.5, lip: 8, cradle: [6.0, -4.0], key: [14, -4] };
/** (the footstone 0.9 m in from the rail's home end: its stop along the groove) */
PERCH.plateAt = +(0.9 / (PERCH.rail + 0.9)).toFixed(3);

export const LOGIC = {
  id: 'spacecity', entry: 'stage', gadget: 'tether',
  rooms: {
    stage: { checkpoint: true, kind: 'passage' }, hall: { checkpoint: true, kind: 'puzzle' }, winch: { checkpoint: true, kind: 'puzzle' },
    stair: { checkpoint: true, kind: 'puzzle' }, loft: { checkpoint: true, kind: 'puzzle' }, drift: { checkpoint: true, kind: 'puzzle' },
    driftFar: { checkpoint: true, kind: 'passage' }, scale: { checkpoint: true, kind: 'puzzle' }, moor: { checkpoint: true, kind: 'puzzle' },
    store: { checkpoint: true, kind: 'combat' }, perch: { kind: 'puzzle' }, ante: { kind: 'passage' }, arena: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'stage', b: 'hall' },
    { a: 'hall', b: 'winch' },
    { a: 'hall', b: 'stair', door: 'g1' },          // the shaft's gate, while the counterweight sits on the winch's mouth
    { a: 'hall', b: 'loft', door: 'd1' },           // the great door: the lamp-eye up the shaft lit
    { a: 'loft', b: 'drift', door: 'd2' },          // the ring hung over the loft's floor (v1.77: the Mooring Passage is the loft's west side)
    { a: 'drift', b: 'driftFar', door: 'br2' },     // the gangway: the ball pulled home off its cable-rail
    { a: 'driftFar', b: 'scale' },                  // the Cable Walk
    { a: 'scale', b: 'moor', door: 'gW' },          // the balance's pan: the ball pushed out to the far cup
    { a: 'moor', b: 'store', door: 'dR' },          // the Rope Store, south off the Gallery (v1.53): an arena, the small key
    { a: 'moor', b: 'perch', door: 'sc' },          // the moorers' gate (its small key, v1.53) to the Capstan Hall's balcony
    { a: 'perch', b: 'hall', oneWay: true },        // and the cradle down
    { a: 'scale', b: 'ante', door: 'gN' },          // the west door: the ball pulled home, and the Gallery's ring
    { a: 'ante', b: 'arena', door: 'd6' },
    { a: 'arena', b: 'out', door: 'd7' },
  ],
  elements: {
    // the winch's counterweight, rolled into its socket at the winch's mouth: the shaft's gate rises (its pawl holds it)
    ballW: { type: 'drum', room: 'winch', plate: 'pG', plateAt: 1, start: 0.12 },   // (issue #275: it starts 1.3 m along its groove: room behind it to push from)
    pG: { type: 'plate', room: 'winch' },
    g1: { type: 'door', opens: { drumOn: ['ballW', 'pG'] }, latch: true },
    s1: { type: 'switch', room: 'stair' },                          // the lamp-eye, seen only from the pier's top
    d1: { type: 'door', opens: { lit: 's1' }, latch: true },
    chest: { type: 'gadget', room: 'loft', item: 'tether' },
    t0: { type: 'switch', room: 'loft', needs: ['tether'] },       // the loft's try: its ring brings the lamp down
    r1: { type: 'switch', room: 'loft', needs: ['tether'] },       // the ring hung over the loft's floor, its chain to the door into the Drift
    d2: { type: 'door', opens: { lit: 'r1' }, latch: true },
    // the Drift's ball, out on its cable-rail over the void: only a pull brings it home
    ballD: { type: 'drum', room: 'drift', plate: 'pD', plateAt: 0.098, start: 1, needs: ['tether'] },
    pD: { type: 'plate', room: 'drift' },
    br2: { type: 'bridge', opens: { drumOn: ['ballD', 'pD'] }, latch: true },
    // the Gallery's ring first (logic.next goes in this order: once the pan has carried you up, the ring is the thing to
    // do there, before the ball is pulled home again)
    r5: { type: 'switch', room: 'moor', needs: ['tether'] },       // the Gallery's ring: the west door's chain, and the great key's cage's (v1.53)
    sc: { type: 'door', lock: 'small', latch: true },              // (v1.53: the Rope Store's small key; the ring was its)
    // the Balance: one ball, home on the north landing or out in the far cup over the void
    ballS: { type: 'drum', room: 'scale', plate: 'pHome', stops: { pHome: 0.143, pOut: 0.905 }, start: 0.143, needs: ['tether'] },
    pHome: { type: 'plate', room: 'scale' },
    pOut: { type: 'plate', room: 'scale' },
    gW: { type: 'bridge', opens: { drumOn: ['ballS', 'pOut'] } },  // (the balance's pan, a Platform: it rides while this holds)
    gN: { type: 'door', opens: { all: [{ drumOn: ['ballS', 'pHome'] }, { lit: 'r5' }] }, latch: true },
    // the Capstan Floor's doors (its great key, v1.53; shut while the Warden fights; the way out): the floor's own (v1.77:
    // the rules measure the guardian's hall by them, its two sides)
    d6: { type: 'door', lock: 'big', room: 'arena' },
    // the Rope Store: its keepers beaten, the small key's cage sinks (v1.53)
    arR: { type: 'arena', room: 'store' },
    kS: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arR' } },
    dR: { type: 'door', opens: null },
    // the Capstan Hall's balcony: the great key's cage, and a ball out along a cable-rail from its lip; pulled home onto
    // the cage's footstone, the cage sinks
    bK: { type: 'drum', room: 'perch', plate: 'pK', plateAt: PERCH.plateAt, start: 1, needs: ['tether'] },
    pK: { type: 'plate', room: 'perch' },
    // (and the cage's chain runs up over the gate to the Gallery's ring, with the west door's: pulled, it lets the cage go)
    kB: { type: 'key', kind: 'big', room: 'perch', when: { all: [{ drumOn: ['bK', 'pK'] }, { lit: 'r5' }] } },
    warden: { type: 'boss', room: 'arena', needs: ['gun', 'tether'] },
    d7: { type: 'door', opens: { resolved: true }, room: 'arena' },
    // (v1.76, issue #337) the Capstan Hall's caged coffer: the plate before it sinks the cage while weighed down; the moorers'
    // weight on its cleat high on a mast, pulled down into your hands by the grappling hook (a reward: `optional`)
    wC: { type: 'weight', room: 'hall', plate: 'pC', needs: ['hook'], optional: true },
    pC: { type: 'plate', room: 'hall' },
    cC: { type: 'cache', room: 'hall', when: { pressed: 'pC' } },
  },
};

/** (v1.76, issue #337) The Capstan Hall's coffer, east: the hall's angle and radius of the coffer, its plate, the cleat's
 * weight (its foot at `y`, `r` from the hall's middle: out of any jump's reach), the cleat under it (v1.77: on an iron
 * mast standing in the floor, `mast` from the middle: the weight in the hall's middle, off the wall). */
export const CLEAT = { coffer: [Math.PI / 2 - 0.35, 15.6], plate: [Math.PI / 2 + 0.12, 7.4], weight: [Math.PI / 2 + 0.12, 10.0], mast: 10.9, y: 8.6 };

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
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: BS, h: S.h, roof: true, omit: ['n'] });   // (its north wall the Balance's, the doorway in it)
  add(Door, { id: 'dR', at: [S.x, BS, S.z + S.d / 2 + 0.6], ...DOOR });   // (open: it shuts behind you while they stand)
  for (const [x, z] of [[-8, -7], [8, -6.4], [-8.6, 6.2], [8.4, 6.8]]) {
    K.both(brass, T(new THREE.CylinderGeometry(1.5, 1.5, 3.8, 18), [S.x + x, BS + 2.0, S.z + z], [0, 0, Math.PI / 2]));
    K.both(cableM, T(new THREE.CylinderGeometry(1.74, 1.74, 3.0, 18, 1, true), [S.x + x, BS + 2.0, S.z + z], [0, 0, Math.PI / 2]));   // (the cable wound on it, clear of the drum: solid, as you stand on it)
    K.both(iron, [box(0.4, 1.6, 2.4, S.x + x - 2.1, BS + 0.8, S.z + z), box(0.4, 1.6, 2.4, S.x + x + 2.1, BS + 0.8, S.z + z)]);
  }
  add(Key, { id: 'kS', at: [S.x, BS, S.z - S.d / 2 + 2.4], yaw: 0 });
  add(Mark, { room: 'store', at: [S.x + 7, BS, S.z + S.d / 2 - 3.6], yaw: Math.PI, foes: [S.x, BS, S.z] });

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
  const [kx, kz] = at(P.key[0], P.key[1]);
  add(Key, { id: 'kB', big: true, at: [kx, Y, kz], yaw: MOOR_A + Math.PI });
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
  K.wall(-8.6, 4.6, 8.6, 4.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: HOLE.w, h: 9 }] });
  corridor(0, 5.2, 0, C1 - R1 - 0.6, 0);

  // ---- the Capstan Hall (the hub): the dead great capstan in the middle, its cables slack to the walls
  K.rotunda({ x: 0, z: C1, y: 0, r: R1, h: 28, seg: 54, oculus: 0.3, gaps: [
    { a: Math.PI, w: 6.6, h: PASS.h }, { a: SW, w: 7.8, h: PASS.h }, { a: SE, w: 7.8, h: PASS.h }, { a: 0, w: 6.6, h: PASS.h }, { a: MOOR_A, w: 8.4, h: PASS.h, y0: BALANCE.south },
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
  const BS = BALANCE.south;
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

  // ---- the Lamp Shaft (south-east): the gate in the corridor; a tall well breathing the void's air up its grating, and
  // beside it a pier, the lamp-eye on its top (hidden from the floor by the top's own edge)
  corridor(...hallAt(SE, R1 + 0.7), ...hallAt(SE, WING.d - WING.r - 0.7), 0);
  const [gx, gz] = hallAt(SE, (R1 + 1.4 + WING.d - WING.r - 1.4) / 2);
  add(Door, { id: 'g1', at: [gx, 0, gz], yaw: SE, ...DOOR, lamps: [{ drumOn: ['ballW', 'pG'] }] });
  K.rotunda({ x: SHAFT[0], z: SHAFT[1], y: 0, r: WING.r, h: 24, seg: 39, gaps: [{ a: -Math.PI / 4, w: 8, h: PASS.h }], oculus: 0.45 });
  {
    const SP = SHAFT_PIER, [ux, uz] = hallAt(SE, SP.draught);
    K.add(M.trim, T(annulus(3.2, 3.6, 0.05, 32), [ux, 0.02, uz]));
    for (let i = 0; i < 5; i++) K.add(M.dark, box(6.2, 0.05, 0.3, ux, 0.04, uz - 2.4 + i * 1.2, Math.PI / 4));
    add(Updraft, { at: [ux, 0, uz], r: 3.4, h: 17, lift: 7, hint: 'The void’s breath rises up the shaft. Open your wings in it.' });
    // the pier: its top 6 by 7.6 m, its lip 2.5 m from the draught's middle (as the balcony's was)
    const [px, pz] = hallAt(SE, SP.pier), [qx, qz] = hallAt(SE, SP.pier + 1.2);
    K.both(M.floor, box(6, 0.8, 7.6, px, SP.top - 0.4, pz, SE));
    K.both(M.wall, box(3.4, SP.top - 0.8, 3.4, qx, (SP.top - 0.8) / 2, qz, SE));
    const [l0x, l0z] = hallAt(SE, SP.pier - 3.5);
    rail([l0x + Math.cos(SE) * 2.8, l0z - Math.sin(SE) * 2.8], [l0x - Math.cos(SE) * 2.8, l0z + Math.sin(SE) * 2.8], SP.top, 0.7);
    // the lamp-eye on a low stone in the top's middle, 3 m from every edge: the top hides it from the floor
    const [ex, ez] = hallAt(SE, SP.eye);
    K.both(M.trim, box(0.9, 0.5, 0.9, ex, SP.top + 0.25, ez, SE));
    add(Switch, { id: 's1', at: [ex, SP.top + 0.9, ez], yaw: SE + Math.PI, size: 0.8 });
  }
  { const [x, z] = wingAt(SE, 28, -5); add(Mark, { room: 'stair', at: [x, 0, z], yaw: SE + Math.PI }); }

  // ---- the great door and the Cord Loft (the chest): coils of the makers' cord round its walls; its try, a ring on a
  // mooring post; and over its west side, where the Mooring Passage was, the ring that holds the door into the Drift
  const C3 = LOFT.z;
  add(Door, { id: 'd1', at: [0, 0, C1 + R1 + 2.0], ...DOOR, lamps: [{ lit: 's1' }] });
  corridor(0, C1 + R1 + 0.7, 0, C3 - LOFT.r - 0.7, 0);
  K.rotunda({ x: 0, z: C3, y: 0, r: LOFT.r, h: LOFT.h, seg: 39, gaps: [{ a: Math.PI, w: 6, h: PASS.h }, { a: -Math.PI / 2, w: 7.2, h: PASS.h }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(0, 0, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  for (const a of [0.6, 2.2, -2.4, -0.4]) for (let i = 0; i < 4; i++) K.add(cableM, T(new THREE.TorusGeometry(0.9 - (i % 2) * 0.15, 0.13, 4, 18), [Math.sin(a) * (LOFT.r - 1.4), 1.6 + i * 0.32, C3 + Math.cos(a) * (LOFT.r - 1.4)], [0, a, 0]));
  // the try: a moorers' ring on a post east of the chest, its lamp hung over it
  K.both(iron, box(0.6, 3.4, 0.6, 6.9, 1.7, C3 + 5));
  add(Switch, { id: 't0', at: [6.4, 2.6, C3 + 5], yaw: -Math.PI / 2, size: 0.8, pull: true });
  rt.loftLamp = { at: [6.4, 9, C3 + 5] };
  // the ring over the floor, too high to reach: its chain up to a pulley under the roof and along it to the door's head
  const R1x = -8;
  add(Switch, { id: 'r1', at: [R1x, 7.4, C3], yaw: Math.PI / 2, size: 0.85, pull: true });
  cable([R1x, 8.2, C3], [R1x, LOFT.h - 0.6, C3], 0, 0.06);
  K.both(brass, T(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), [R1x, LOFT.h - 0.6, C3], [Math.PI / 2, 0, 0]));
  cable([R1x, LOFT.h - 0.6, C3], [-LOFT.r + 0.3, PASS.h + 0.6, C3], 1.2, 0.06);
  add(Mark, { room: 'loft', at: [5.6, 0, C3 - 8], yaw: Math.PI * 0.25 });

  // ---- the Drift: a void hall open to the stars. The near landing (east), the far one six metres higher (west)
  const D = DRIFT, DX = (D.x0 + D.x1) / 2, DZ = (D.z0 + D.z1) / 2;
  corridor(-LOFT.r - 0.7, C3, D.x1 + 0.6, C3, 0);
  add(Door, { id: 'd2', at: [(-LOFT.r - 1.4 + D.x1 + 1.2) / 2, 0, C3], yaw: Math.PI / 2, ...DOOR, lamps: [{ lit: 'r1' }] });
  K.hall({ x: DX, z: DZ, w: D.x1 - D.x0, d: D.z1 - D.z0, y: -4, h: 24, floor: false, roof: false, doors: [{ side: 'e', at: C3 - DZ, ...HOLE, y0: 4 }, { side: 's', at: -61 - DX, ...HOLE, y0: 10 }] });
  K.slab(D.lip, D.z0, D.x1, D.z1, 0, 0.8);
  K.slab(D.x0, D.z0, D.farLip, D.z1, D.far, 2);
  add(Pit, { room: 'drift', min: [D.x0, -24, D.z0], max: [D.lip, -8, D.z1] });
  // the void's breath under the Drift: fall off with your wings open and it bears you back up to the near landing (no
  // higher: the far landing is out of its reach)
  add(Updraft, { at: [D.lip - 7.6, -8, D.gang + 3], r: 3.6, h: 10.5, lift: 6.5, hint: 'The void breathes up under the Drift. It bears your wings, but not as high as the far landing.' });
  add(Bridge, { id: 'br2', a: [D.lip + 0.1, 0, D.gang], b: [D.farLip - 0.1, D.far, D.gang], w: 4, n: 16 });
  // the ball's cable-rail: two cables from the near landing out over the void, a stop post at their end
  {
    const y = 0.02, L = D.a - D.b + 1.4, cx = (D.a + D.b) / 2 - 0.4;
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(L, 0.12, 0.12, cx, y, D.z + s));
    K.add(iron, box(0.4, 1.8, 1.6, D.b - 1.5, -0.6, D.z));
    for (let x = D.lip - 2; x > D.b; x -= 2.6) K.add(iron, box(0.14, 0.5, 1.3, x, -0.25, D.z));
    cable([D.b - 1.5, -1.4, D.z], [D.b - 2, -18, D.z + 1], 0, 0.06);
  }
  add(Ball, { id: 'ballD', a: [D.a, 0.04, D.z], b: [D.b, 0.04, D.z], r: 1.1, friction: 1.0 });
  add(Plate, { id: 'pD', at: [D.plate, 0, D.z], r: 1.3 });
  // railings along the near lip, open at the rail and the gangway; along the far lip, open at the gangway
  rail([D.lip + 0.3, D.z0 + 0.4], [D.lip + 0.3, D.z - 1.5], 0);
  rail([D.lip + 0.3, D.z + 1.5], [D.lip + 0.3, D.gang - 2.4], 0);
  rail([D.lip + 0.3, D.gang + 2.4], [D.lip + 0.3, D.z1 - 0.4], 0);
  rail([D.farLip - 0.3, D.z0 + 0.4], [D.farLip - 0.3, D.gang - 2.4], D.far);
  rail([D.farLip - 0.3, D.gang + 2.4], [D.farLip - 0.3, D.z1 - 0.4], D.far);
  // starlight lines down the walls, cables hanging in the void
  for (const x of [-64, -56, -46, -38, -28]) { K.add(starM, box(0.14, 16, 0.06, x, 4, D.z1 - 0.02)); }
  for (const [x, z] of [[-42, 91], [-48, 68], [-51, 89], [-39, 77]]) cable([x, 20, z], [x + 0.5, -20, z + 0.4], 0, 0.06);
  add(Mark, { room: 'drift', at: [-24, 0, 88], yaw: -Math.PI / 2 });
  add(Mark, { room: 'driftFar', at: [-66, D.far, 90], yaw: Math.PI / 2 });

  // ---- the Cable Walk: an open walkway over the stars from the Drift's far landing south to the Balance
  const B = BALANCE, BN = B.north, BZ1 = B.cz + B.d / 2, BX0 = B.cx - B.w / 2, BX1 = B.cx + B.w / 2, BZ0 = B.cz - B.d / 2;
  K.bridge([-61, D.far, D.z0 - 0.6], [-61, D.far, BZ1 + 1.2], 4.4, { parapet: 1.0 });
  for (const z of [D.z0 - 3, BZ1 + 3.6]) K.both(M.trim, box(0.4, 3.2, 0.4, -63.6, D.far + 1.6, z)), K.both(M.trim, box(0.4, 3.2, 0.4, -58.4, D.far + 1.6, z));
  add(Pit, { room: 'driftFar', min: [-75, -18, BZ1 + 1.2], max: [-47, 2, D.z0 - 0.6] });

  // ---- the Balance: a void hall; the north landing (y 6), the Moorers' Gallery to the south (y 11)
  K.hall({ x: B.cx, z: B.cz, w: B.w, d: B.d, y: -2, h: 30, floor: false, roof: false, doors: [
    { side: 'n', at: -61 - B.cx, ...HOLE, y0: BN + 2 }, { side: 'w', at: FLOOR.z - B.cz, ...HOLE, y0: BN + 2 }, { side: 'e', at: MOOR.z - B.cz, ...HOLE, y0: BS + 2 },
    { side: 's', at: STORE.x - B.cx, ...HOLE, y0: BS + 2 },   // (and south off the Gallery into the Rope Store, v1.53)
  ] });
  K.slab(BX0, B.lipN, BX1, BZ1, BN, 2);
  K.slab(BX0, BZ0, BX1, B.lipS, BS, 2);
  add(Pit, { room: 'scale', min: [BX0, -18, BZ0], max: [BX1, 3.5, BZ1] });
  // the balance's pan: while the ball's weight sits in the far cup it rides between the landings, up to the Gallery
  add(Platform, { id: 'gW', room: 'scale', path: [[-68, BN, B.lipN - 2], [-68, BS, B.lipS + 2]], r: 2.2, speed: 1.6, pause: 2.4, when: { open: 'gW' } });
  // the balance itself: a great beam over the void on a post, tipped by the ball's weight (drawn), the ball's rail out to the far cup
  const MZ = (B.lipN + B.lipS) / 2;
  K.both(iron, box(1.2, 14, 1.2, -54, 4, MZ));
  K.both(brass, box(0.6, 0.6, 16, -54, 11.4, MZ));   // (solid: its ends reach over the landings)
  for (const z of [MZ - 7.6, MZ + 7.6]) K.both(brass, T(new THREE.CylinderGeometry(1.6, 1.2, 0.6, 14), [-54, 10.6, z]));
  {
    const L = B.a - B.b + 1.6, cz = (B.a + B.b) / 2 - 0.4;
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(0.12, 0.12, L, B.x + s, BN + 0.02, cz));
    K.add(iron, box(1.6, 1.8, 0.4, B.x, BN - 0.6, B.b - 1.4));
    for (let z = B.lipN - 2; z > B.b; z -= 2.6) K.add(iron, box(1.3, 0.5, 0.14, B.x, BN - 0.25, z));
    K.add(brass, T(annulus(1.3, 1.8, 0.08, 24), [B.x, BN + 0.03, B.out]));
  }
  add(Ball, { id: 'ballS', a: [B.x, BN + 0.04, B.a], b: [B.x, BN + 0.04, B.b], r: 1.1, friction: 0.7 });
  add(Plate, { id: 'pHome', at: [B.x, BN, B.home], r: 1.3 });
  add(Plate, { id: 'pOut', at: [B.x, BN, B.out], r: 1.3 });
  rail([BX0 + 0.4, B.lipN + 0.3], [-69.9, B.lipN + 0.3], BN);
  rail([-66.1, B.lipN + 0.3], [B.x - 1.6, B.lipN + 0.3], BN);
  rail([B.x + 1.6, B.lipN + 0.3], [BX1 - 0.4, B.lipN + 0.3], BN);
  rail([BX0 + 0.4, B.lipS - 0.3], [-69.9, B.lipS - 0.3], BS);
  rail([-66.1, B.lipS - 0.3], [BX1 - 0.4, B.lipS - 0.3], BS);
  // the west door and its chain up to the Gallery's ring (drawn), the Gallery's ring on its davit
  add(Door, { id: 'gN', at: [BX0 - 0.6, BN, FLOOR.z], yaw: Math.PI / 2, ...DOOR, lamps: [{ drumOn: ['ballS', 'pHome'] }, { lit: 'r5' }] });
  // (on a davit over the Gallery, in the hall's middle: high over the landing, out of the tether's reach from the north landing)
  const RZ = B.lipS - 4;
  K.both(iron, box(0.5, 5.2, 0.5, -68.2, BS + 2.6, RZ));
  K.add(iron, box(2.6, 0.3, 0.3, -67.1, BS + 5.1, RZ));
  add(Switch, { id: 'r5', at: [-66, BS + 3.4, RZ], yaw: 0, size: 0.9, pull: true });
  cable([BX0 + 1.6, BN + 6.6, FLOOR.z - 1], [-66.6, BS + 5.1, RZ + 0.2], 1.2, 0.06);
  for (const x of [-74, -50]) K.add(starM, box(0.14, 14, 0.06, x, 10, BZ0 + 0.02));
  add(Mark, { room: 'scale', at: [-49, BN, BZ1 - 4], yaw: Math.PI });
  add(Mark, { room: 'moor', at: [-50, BS, BZ0 + 6], yaw: -Math.PI / 2 });
  // the moorers' gate (its small key) and the corridor back east to the Capstan Hall's balcony
  corridor(BX1 + 0.6, MOOR.z, -Math.sqrt(R1 * R1 - (MOOR.z - C1) ** 2) - 0.8, MOOR.z, BS);
  add(Door, { id: 'sc', at: [MOOR.gate, BS, MOOR.z], yaw: Math.PI / 2, ...DOOR });   // (v1.53: its small key; the ring holds the cage's chain now)

  // ---- the ante and the Capstan Floor: a round floor open to the void at four great windows, a bollard before each
  K.corridor([BX0 - 1.2, FLOOR.z], [FLOOR.x + FLOOR.r + 0.6, FLOOR.z], FLOOR.y, { w: 8.2, h: 10 });   // (wide and tall since issue #195: the close camera fought its walls)
  add(Mark, { room: 'ante', at: [BX0 - 5.3, FLOOR.y, FLOOR.z + 3.2], yaw: Math.PI });
  const HR = FLOOR.r, CX = FLOOR.x, CZ = FLOOR.z, FY = FLOOR.y;
  const windows = [Math.PI / 4, -Math.PI / 4, Math.PI * 3 / 4, -Math.PI * 3 / 4];
  K.rotunda({ x: CX, z: CZ, y: FY, r: HR, h: 20, seg: 36, oculus: 0.62, gaps: [{ a: Math.PI / 2, w: 6, h: 9.2 }, { a: -Math.PI / 2, w: 6, h: 9.2 }, ...windows.map((a) => ({ a, w: 9, h: 7 }))] });
  rt.bollards = [];
  for (const a of windows) {
    // the window's rail across the gap, a bollard inside it
    const ox = CX + Math.sin(a) * (HR + 0.5), oz = CZ + Math.cos(a) * (HR + 0.5);
    K.both(M.trim, T(new THREE.BoxGeometry(9.6, 0.25, 0.3), [ox, FY + 1.0, oz], [0, a, 0]));
    for (const s of [-1, 0, 1]) K.both(M.trim, T(new THREE.BoxGeometry(0.2, 1.0, 0.2), [ox + Math.cos(a) * s * 4.4, FY + 0.5, oz - Math.sin(a) * s * 4.4]));
    // (issue #356) a second rail at 2 m and bars over it to the window's head, too close to pass: open, the wings took you
    // out over the void and round to the Capstan Floor's walkways, and back in past its great lock (tests/door-bypass.test.js);
    // under the bars the anchors still go out over the void and your aim reaches them
    K.both(M.trim, T(new THREE.BoxGeometry((WINDOW_BARS.n - 1) * WINDOW_BARS.gap + 0.4, 0.25, 0.3), [ox, FY + WINDOW_BARS.rail, oz], [0, a, 0]));
    for (let i = 0; i < WINDOW_BARS.n; i++) {
      const s = (i - (WINDOW_BARS.n - 1) / 2) * WINDOW_BARS.gap, h = 7 - WINDOW_BARS.rail;
      K.both(iron, T(new THREE.CylinderGeometry(0.07, 0.07, h + 0.1, 6), [ox + Math.cos(a) * s, FY + WINDOW_BARS.rail + h / 2, oz - Math.sin(a) * s]));
    }
    const bx = CX + Math.sin(a) * (HR - 3.2), bz = CZ + Math.cos(a) * (HR - 3.2);
    K.both(iron, T(new THREE.CylinderGeometry(0.6, 0.75, 1.5, 12), [bx, FY + 0.75, bz]));
    K.add(brass, T(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 12), [bx, FY + 1.55, bz]));
    rt.bollards.push(K.world(bx, FY + 1.6, bz));
  }
  rt.windows = windows.map((a) => ({ a: K.heading(a), at: K.world(CX + Math.sin(a) * HR, FY, CZ + Math.cos(a) * HR) }));
  K.add(brass, T(annulus(8.0, 8.6, 0.06, 64), [CX, FY + 0.03, CZ]));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.add(M.dark, T(new THREE.BoxGeometry(0.3, 0.05, 1.6), [CX + Math.sin(a) * 11, FY + 0.03, CZ + Math.cos(a) * 11], [0, a, 0])); }
  add(Pit, { room: 'arena', min: [CX - HR - 30, -18, CZ - HR - 30], max: [CX + HR + 8, FY - 4, CZ + HR + 30] });
  add(Door, { id: 'd6', at: [CX + HR + 0.7, FY, CZ], yaw: Math.PI / 2, ...DOOR, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door: you jumped through beside it, issue #356)
  add(Door, { id: 'd7', at: [CX - HR - 0.7, FY, CZ], yaw: Math.PI / 2, ...DOOR, frame: { side: 1.2 } });
  // the way out: a short passage west to the door into the world
  const X0 = CX - HR - 0.6, XH = 10, XW = 4.6;
  K.slab(X0 - 9.4, CZ - XW, X0, CZ + XW, FY, 0.8);
  K.wall(X0 - 0.8, CZ + XW, X0 - 9.4, CZ + XW, FY, XH, { t: 0.8 }); K.wall(X0 - 9.4, CZ - XW, X0 - 0.8, CZ - XW, FY, XH, { t: 0.8 });
  K.wall(X0 - 9.4, CZ + XW, X0 - 9.4, CZ - XW, FY, XH, { t: 0.8, holes: [{ at: XW, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.4, 0.8, 2 * XW + 0.8, X0 - 4.7, FY + XH + 0.4, CZ));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [X0 - 9.9, FY, CZ], [0, Math.PI / 2, 0]));
  K.solid(box(0.1, 5, 4, X0 - 9.9, FY + 2.5, CZ));

  const model = anchorModel(SK?.warden);
  model.pos.copy(K.world(CX + 4, FY, CZ));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI / 2);
  model.rest = K.world(CX - 1, FY, CZ);
  model.restHeading = K.heading(Math.PI / 2);
  const arena = { center: K.world(CX, FY, CZ), r: HR, y: K.world(0, FY, 0).y };

  // (the wings last: their marks after the others, as they were)
  wings(rt, K, M, { BS, rail, cable, iron, brass, cableM });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, -4.4), heading: K.heading(0) },
    bounds: new THREE.Box3(V(CX - HR - 14, -26, STORE.z - STORE.d / 2 - 6), V(SHAFT[0] + WING.r + 4, 34, D.z1 + 6)),
    gadget: { at: W(0, 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, -7.6), r: 1.5 }, { at: W(X0 - 9.4, FY + 0.5, CZ), r: 1.5 }],
    lights: [[0, 5, -2, 10], [0, 14, C1, 26], [WINCH[0], 9, WINCH[1], 20], [SHAFT[0], 13, SHAFT[1], 20], [0, 10, C3, 20],
      [-28, 6, DZ, 18], [-58, 10, DZ, 18], [-61, 9, 58, 12], [B.cx, 13, B.cz, 24], [STORE.x, BS + 6, STORE.z, 18], [CX, FY + 8, CZ, 24]],
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
  for (const s of [-1, 1]) K.both(adobe, box(2.4, 7.6, z1 - z0, s * 3.6, sill + 3.8, (z0 + z1) / 2));
  K.both(adobe, box(9.6, 1.8, z1 - z0, 0, sill + 7.5, (z0 + z1) / 2));
  K.both(adobe, T(new THREE.TorusGeometry(2.75, 0.4, 6, 24, Math.PI), [0, sill + 4.2, z1 - 0.2]));
  K.add(teal, T(new THREE.TorusGeometry(2.35, 0.13, 5, 24, Math.PI), [0, sill + 4.2, z1 + 0.2]));
  for (const s of [-1, 1]) K.add(teal, box(0.26, 4.2, 0.2, s * 2.35, sill + 2.1, z1 + 0.2));
  K.add(M.glyph, T(glyphGeometry(1.8, 0.14), [0, sill + 7.6, z1 + 0.06]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.8, 6.8).translate(0, 3.4, 0), [0, sill, R + 0.25]));
  K.solid(box(4.8, 6.8, 0.1, 0, sill + 3.4, R + 0.25));
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
  return { door: { at, heading: yaw }, kit: K, R, sill, HW, capstan, top: K.world(0, sill + HW + 4.6, 0), clear: [{ x: SITE.x, z: SITE.z, r: R + 12 }, { x: front.x, z: front.z, r: 5 }] };
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
  enterLine: 'Inside the Mooring-House the floors stop short over nothing, and under them the stars go on. Somewhere overhead, cable pays out with a long creak.',
  pitLine: 'You catch a hanging cable and haul yourself back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Over the city every cable draws taut, and its lamps light one by one.', 'resolved.out'); },
  // the loft's try: its ring brings a lamp down on its cord (and nothing else)
  onLit(rt, id) {
    if (id === 't0') rt.notice('The ring comes home with a clack, and a lamp drops from the loft’s roof.', 'sc.t0');
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
