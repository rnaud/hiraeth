import { landmark } from './landmarks.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Brazier, Flame, Platform, Bridge, Hammer, Mark, Pit, Key } from './pieces.js';
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
// Inside (built far overhead, through its door), one idea from the first room to the last: WHERE A MOON RESTS, THE HOUSE
// LEANS. The Casting-House is the founders' balance: its doors, its hoist and its bridges are held by a moon's weight in
// a cradle. The stone moons (the test casts) a plain push rolls; the iron moons, the true ones, only roll for the
// founders' tongs; and an iron moon rolled through a pilot flame comes out hot, and a hot moon in a hooded mould lights
// what no ember reaches. (Before the tongs you are a weight too: the hoist's pan takes you, but you can't stand in two
// places at once.) Since v1.77 (issue #336) every room is a shrine's: 30 m across and more, 18 m high and more, its doors
// 7 by 9 (DOOR), each puzzle in the middle of its own room, and the Sand Room the house's one fight.
//   the Porch             the first mark, the way out (a passage)
//   the Pouring Floor     the hub, a round hall 36 m across under a cracked moon: the founders' iron moon on its rail
//                         down the middle through the house's pilot flame to the great hooded cradle, in the middle of
//                         the floor before the sealed Founders' Door (seen from the first step, rolled at the end); a
//                         little test scale (a stone moon in a small cradle: it tips, and nothing); the keepers' door,
//                         shut, on the east (it opens from the far side)
//   the Mould Room        a stone moon rolled across the room into the great mould wakes the seam-eye on its post beside
//                         it (lidded until a moon fills the mould): the door north to the Crucible Stair. On a dais in the
//                         middle of the room, up a stair, a second stone moon waits by the hoist's counterweight pan
//   the Sand Room         (v1.53, issue #23: south off the Mould Room, an arena; the house's one fight since v1.77) the
//                         founders' moulding sand in bins; its door shuts behind you while its keepers stand round its
//                         middle. Won, the small key's cage sinks: the Founders' Door takes it at the end, with the
//                         founders' moon hot in its cradle (a key carried from the first rooms to the last door)
//   the Crucible Stair    (a passage) the hoist up to the chest: it runs only while its pan in the Mould Room holds a
//                         weight (stand in it yourself and it rises without you; the stone moon stands in for you)
//   the Tong Chamber      the makers' chest: the FOUNDERS' TONGS (src/items.js 'tongs'). A try by the dais: an iron moon
//                         that rolls for the tongs into a little cradle, and nothing waits on it. Its east door into the
//                         furnace is held by an iron moon's cradle out on the chamber's floor, chained to the door's bar
//                         (the tongs' first lock, where a miss costs nothing; v1.77: it was the Pincer Passage, a room on)
//   the Casting Furnace   a channel of molten iron, the bridge over it raised by the hooded mould on the near lip: the
//                         lip's iron moon rolled through the pilot flame comes out hot, and a hot moon in the mould's
//                         mouth lights it (the tongs with the fire: the twist; v1.77: its rail ran from the passage under
//                         the door). The founders' press slams down on the bridge, out of step
//   the Weighing Hall     down from the furnace's far landing: the keepers' door's eye on a post in the hall wakes once an
//                         iron moon is in its pan, rolled out along the gallery's pier into the middle of the hall; the
//                         keepers' door opens onto the Pouring Floor, the shortcut back
//   back on the Floor     the founders' iron moon, rolled with the tongs through the pilot flame into the great cradle:
//                         the Founders' Door, and the cold passage under the furnace
//   the Last Casting      the guardian (a robot: its meter is damage). When it pours, its crucible doors swing open:
//                         splash its molten heart. From its second phase it casts moons and throws the cracked ones; an
//                         iron moon rolled into its casting cradle gives its pour a whole moon, and it stops to look
//                         (a splash then counts twice). In its last it tips the moon out as it shifts, and its heart is
//                         too hot for water unless the cradle holds a moon: roll it back in
// After: the Last Founder has cast one moon whole; it hangs from the jib over the Casting-House's door, turning slowly,
// and the chimney's glow is steady at night (the world change).

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
 * upper floor (the Crucible Stair's landing, the Tong Chamber, the furnace's lips, the Weighing Hall's gallery) 11 m up,
 * so the cold passage under the furnace is as tall as its doors (it was 9, over a passage 6.4 high).
 */
export const DOOR = { w: 7, h: 9 };
export const UP = 11;
// the rooms' places (local metres): the Pouring Floor's centre and radius, the Mould Room's centre and size, the Crucible
// Stair's and the Tong Chamber's x, the chamber's z and radius, the furnace's west and east walls and its channel, the
// Weighing Hall's, the Last Casting's centre and radius
const FZ = 32, FR = 18;
const MX = -37, MW = 34, MD = 34;
const SX = -30, TZ = 89, TR = 17;
const FX0 = -10.2, FX1 = 35.8, FD = 36, C0 = 7.8, C1 = 17.8;
const WX0 = 22, WX1 = 56, WZ0 = 26.3, WZ1 = 68.3, WX = (WX0 + WX1) / 2, WZ = (WZ0 + WZ1) / 2;
const CW = 130, HR = 20;
/** (v1.53) The Sand Room, south off the Mould Room (an arena, the house's one fight since v1.77): its north side the Mould Room's south wall. */
export const SAND = { x: MX, z: FZ - MD / 2 - 1.2 - 15, w: 30, d: 30, h: 18 };
SAND.zone = { min: [SAND.x - SAND.w / 2, -1, SAND.z - SAND.d / 2], max: [SAND.x + SAND.w / 2, 12, SAND.z + SAND.d / 2] };
/** The Sand Room's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's `foes`). */
export const ARENAS = [{
  el: 'arS', room: 'sand', zone: SAND.zone, doors: ['dR'], extra: 2,
  shut: 'The door grinds shut behind you. Out of the sand bins, something heavy climbs.',
  won: 'The last of them falls still in the sand. The key’s cage sinks, and the door lets go.',
}];

export const LOGIC = {
  id: 'moonfoundry', entry: 'threshold', gadget: 'tongs',
  // (v1.77, issue #336: each room tagged with its kind; the Sand Room the one fight)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, floor: { checkpoint: true, kind: 'puzzle' }, moulds: { checkpoint: true, kind: 'puzzle' },
    stair: { checkpoint: true, kind: 'passage' }, tongs: { checkpoint: true, kind: 'puzzle' }, furnace: { checkpoint: true, kind: 'puzzle' },
    furnaceFar: { kind: 'passage' }, scales: { checkpoint: true, kind: 'puzzle' }, sand: { checkpoint: true, kind: 'combat' },
    ante: { checkpoint: true, kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'floor' },
    { a: 'floor', b: 'moulds' },
    { a: 'moulds', b: 'stair', door: 'dM' },        // the seam-eye over the great mould
    { a: 'moulds', b: 'sand', door: 'dR' },         // the Sand Room, south off the Mould Room (v1.53): an arena, the small key
    { a: 'stair', b: 'tongs', door: 'hoist' },      // the hoist, while its pan in the Mould Room holds a weight
    { a: 'tongs', b: 'furnace', door: 'dP' },       // the chamber's east door (v1.77: the Pincer Passage's, a room on)
    { a: 'furnace', b: 'furnaceFar', door: 'brH' }, // the bridge over the molten channel: the hot moon in the hooded mould
    { a: 'furnaceFar', b: 'scales' },               // down onto the Weighing Hall's gallery
    { a: 'scales', b: 'floor', door: 'dS' },        // the keepers' door: the shortcut back, opened from the far side (its eye and its pan are the Weighing Hall's: v1.74, it is met to be opened from there)
    { a: 'floor', b: 'ante', door: 'dF' },          // the Founders' Door: the founders' moon hot in the great cradle
    { a: 'ante', b: 'hall', door: 'dA' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Mould Room's stone moon, rolled across the room into its great mould: the seam-eye beside it opens its lids
    // (v1.77: it lay on the Pouring Floor and was rolled through the doorway)
    m1: { type: 'drum', room: 'moulds', plate: 'pM', plateAt: 1, start: 0 },
    pM: { type: 'plate', room: 'moulds' },
    eM: { type: 'switch', room: 'moulds', when: { drumOn: ['m1', 'pM'] } },
    dM: { type: 'door', opens: { lit: 'eM' }, latch: true },
    // the hoist's counterweight pan, on the Mould Room's shelf: you in it, or the stone moon
    m2: { type: 'drum', room: 'moulds', plate: 'pK', plateAt: 1, start: 0.44 },   // (issue #275: it starts 1.9 m along its groove, off the wall it lay against: room behind it to push from)
    pK: { type: 'plate', room: 'moulds' },
    hoist: { type: 'bridge', opens: { pressed: 'pK' } },
    // the test scale on the Pouring Floor: a stone moon in a little cradle; it tips, and nothing waits on it
    m0: { type: 'drum', room: 'floor', plate: 'p0', plateAt: 1, start: 0 },
    p0: { type: 'plate', room: 'floor' },
    chest: { type: 'gadget', room: 'tongs', item: 'tongs' },
    // the try by the dais: an iron moon into a little cradle (nothing waits on it)
    mT: { type: 'drum', room: 'tongs', plate: 'pT', plateAt: 1, start: 0, needs: ['tongs'] },
    pT: { type: 'plate', room: 'tongs' },
    // the chamber's east door, held by an iron moon's cradle on its floor
    mP: { type: 'drum', room: 'tongs', plate: 'pP', plateAt: 1, start: 0, needs: ['tongs'] },
    pP: { type: 'plate', room: 'tongs' },
    dP: { type: 'door', opens: { drumOn: ['mP', 'pP'] }, latch: true },
    // the Casting Furnace: the near lip's iron moon through the pilot flame into the hooded mould (v1.77: it lay in the
    // passage and was rolled under its door)
    mH: { type: 'drum', room: 'furnace', plate: 'pH', plateAt: 1, start: 0, needs: ['tongs'] },
    pH: { type: 'plate', room: 'furnace' },
    bH: { type: 'brazier', room: 'furnace', when: { drumOn: ['mH', 'pH'] } },     // hooded: only the hot moon lights it
    brH: { type: 'bridge', opens: { lit: 'bH' }, latch: true },
    hm: { type: 'door', opens: { resolved: true } },                             // the press over the bridge: it slams until the founder is stopped
    // the Weighing Hall: the keepers' door's eye, lidded until an iron moon weighs its pan on the gallery
    mB: { type: 'drum', room: 'scales', plate: 'pB', plateAt: 1, start: 0, needs: ['tongs'] },
    pB: { type: 'plate', room: 'scales' },
    eS: { type: 'switch', room: 'scales', when: { drumOn: ['mB', 'pB'] } },
    dS: { type: 'door', opens: { lit: 'eS' }, latch: true },
    // back on the Pouring Floor: the founders' moon through the pilot flame into the great cradle
    mG: { type: 'drum', room: 'floor', plate: 'pG', plateAt: 1, start: 0, needs: ['tongs'] },
    pG: { type: 'plate', room: 'floor' },
    bG: { type: 'brazier', room: 'floor', when: { drumOn: ['mG', 'pG'] } },
    dF: { type: 'door', lock: 'small', opens: { lit: 'bG' }, latch: true },   // (and since v1.53 the Sand Room's small key)
    // the Sand Room: its keepers beaten, the small key's cage sinks (v1.53)
    arS: { type: 'arena', room: 'sand' },
    kS: { type: 'key', kind: 'small', room: 'sand', when: { lit: 'arS' } },
    dR: { type: 'door', opens: null },
    dA: { type: 'door', opens: null },                                          // the arena's door: shut while the founder fights
    // the casting cradle in the arena: an iron moon in it, and the founder stops to look (its last phase wants it)
    mA: { type: 'drum', room: 'hall', plate: 'pA', plateAt: 1, start: 0, needs: ['tongs'] },
    pA: { type: 'plate', room: 'hall' },
    founder: { type: 'boss', room: 'hall', needs: ['gun', 'tongs'], requires: { drumOn: ['mA', 'pA'] } },
    d5: { type: 'door', opens: { resolved: true } },
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
    { to: 0.7, attacks: ['cast', 'casts', 'ladle'], pause: 1.2, hint: 'Roll the iron moon into its cradle: as it looks, splashes count double.' },
    { to: 1.0, attacks: ['charge', 'casts', 'slam'], pause: 1.0, hint: 'Its heart is too hot now: roll the moon back in, splash while it looks.',
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

/**
 * (v1.53, issue #23) The Sand Room, south off the Mould Room: an arena among the founders' bins of moulding sand; won,
 * the small key's cage sinks (for the Founders' Door, at the end). (v1.77) 30 m square under 18, the house's one fight:
 * its keepers round its middle among the four bins.
 */
function sandRoom(rt, K, M, { iron }) {
  const add = (P, o) => rt.add(P, o);
  const S = SAND, z1 = S.z + S.d / 2;
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: 0, h: S.h, roof: true, omit: ['n'] });   // (its north wall the Mould Room's, the doorway in it)
  add(Door, { id: 'dR', at: [S.x, 0, z1 + 0.6], ...DOOR });   // (open: it shuts behind you while they stand)
  const sand = { paint: new THREE.Color('#b98b5a'), smooth: false, side: THREE.FrontSide };
  for (const [x, z] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
    K.both(iron, box(2.6, 1.0, 2.0, S.x + x, 0.5, S.z + z));
    K.both(sand, T(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.45, 0.85), [S.x + x, 1.0, S.z + z]));   // (solid as drawn: a heap you stand on)
  }
  add(Key, { id: 'kS', at: [S.x, 0, S.z - S.d / 2 + 2.6], yaw: 0 });
  add(Mark, { room: 'sand', at: [S.x + 8, 0, z1 - 4], yaw: Math.PI, foes: [S.x, 0, S.z] });
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
  const ember = makeMaterial({ color: '#f08a3c', glow: 0.6, flat: true, key: 'temple.moonfoundry.ember' });
  const HOT = { caught: 'The iron moon rolls through the pilot flame and comes out glowing. It won’t stay hot for long.', out: 'The iron moon’s glow dulls, and it is cold again.', back: 4 };
  const HEAVY = 'It rocks on its rail and settles back. Cast iron: far too heavy for a plain push. The founders moved these with something.';
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
  const FAR = FZ + FR, A0 = FAR + 0.7, A1 = CW - HR - 0.7, FXc = (FX0 + FX1) / 2;

  // ---- the Porch (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 10, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  // the founders' racks: a few small cracked moons on a shelf
  K.both(iron, box(1.2, 0.2, 6, 6.2, 1.4, 6));
  for (const z of [4, 6, 8]) crackedMoon(6.2, 1.9, z, 0.4);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, ...DOOR }] });
  K.corridor([0, 12.6], [0, FZ - FR - 0.7], 0, DOOR);

  // ---- the Pouring Floor (a round hall 36 m across round FZ): the founders' moon down the middle, the pilot flame, the
  // great cradle before the Founders' Door
  K.rotunda({ x: 0, z: FZ, y: 0, r: FR, h: 22, gaps: [{ a: Math.PI, ...DOOR }, { a: -Math.PI / 2, ...DOOR }, { a: Math.PI / 2, ...DOOR }, { a: 0, ...DOOR }], oculus: 0.3 });
  // a cracked moon hung under the oculus (drawn), on chains
  crackedMoon(0, 16, FZ, 2.6);
  for (const a of [0.3, 2.4, 4.5]) K.add(iron, T(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 4), [Math.sin(a) * 1.6, 20.3, FZ + Math.cos(a) * 1.6], [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]));
  // the founders' moon on its rail, through the pilot flame, into the great hooded cradle (the rail as long as it was)
  const GA = FZ - 9.4, GB = GA + 14.8;
  groove([0, 0, GA], [0, 0, GB], 1.3);
  add(Ball, { id: 'mG', a: [0, 0.04, GA], b: [0, 0.04, GB], r: 1.3, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 0.7, lock: true, tar: { ...HOT, burns: 14 } });
  add(Flame, { at: [0, 0, GA + 6.8], r: 0.9 });
  add(Brazier, { id: 'bG', at: [0, 0, GB + 2.4], scale: 1.3, hood: { ball: 'mG', yaw: Math.PI,
    said: 'The ember spatters on the cradle’s iron hood. Its mouth opens low, on the rail: only a moon hot from the fire would reach it.',
    cold: 'The moon rolls into the cradle’s mouth cold, and the cradle tips it back out. The founders cast hot.' } });
  cradle(K, iron, 0, 0, GB + 2.4, 2.2, 6);
  add(Door, { id: 'dF', at: [0, 0, FAR + 0.7], ...DOOR, frame: { side: 1.2 }, lamps: [{ lit: 'bG' }] });
  K.glyph([0, DOOR.h + 2.4, FAR - 0.05], 2.0, Math.PI);
  // the test scale: a stone moon and its little cradle (it tips, and nothing waits on it)
  groove([5, 0, FZ - 5], [9, 0, FZ - 5], 0.9);
  add(Ball, { id: 'm0', a: [5, 0.04, FZ - 5], b: [9, 0.04, FZ - 5], r: 0.9 });
  add(Plate, { id: 'p0', at: [9, 0, FZ - 5], r: 1.1 });
  add(Watch, { when: { drumOn: ['m0', 'p0'] }, say: 'The little scale tips under the stone moon, and rights itself. A test cast: whatever the founders weighed here was heavier.', key: 'm0.scale' });
  // the keepers' door on the east: shut from this side
  add(Door, { id: 'dS', at: [FR + 0.7, 0, FZ], yaw: Math.PI / 2, ...DOOR, frame: { side: 1.2 }, lamps: [{ lit: 'eS' }] });
  add(Mark, { room: 'floor', at: [-8, 0, FZ - 11], yaw: Math.PI * 0.25 });

  // ---- the Mould Room (34 m square, west of the floor): the stone moon across the room into the great mould, its
  // seam-eye on a post beside it; the dais in the middle with the hoist's pan
  K.corridor([-FR - 0.7, FZ], [MX + MW / 2 + 0.6, FZ], 0, DOOR);
  K.hall({ x: MX, z: FZ, w: MW, d: MD, y: 0, h: 18, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', ...DOOR }, { side: 'n', at: SX - MX, ...DOOR }, { side: 's', at: SAND.x - MX, ...DOOR }] });   // (and south into the Sand Room, v1.53)
  const PM = [MX - 2, 0, FZ - 4];
  groove([MX + 8, 0, PM[2]], PM);
  add(Ball, { id: 'm1', a: [MX + 8, 0.04, PM[2]], b: [PM[0], 0.04, PM[2]], r: 1.0, friction: 0.9 });
  add(Plate, { id: 'pM', at: PM, r: 1.2 });
  K.add(M.dark, T(annulus(1.7, 2.6, 0.06, 32), [PM[0], 0.05, PM[2]]));
  K.add(ember, T(annulus(2.6, 2.75, 0.04, 32), [PM[0], 0.06, PM[2]]));   // (the mould's seam)
  K.column(PM[0] - 4.4, PM[2], 0, 6.4, 0.5, { mat: iron });
  add(Switch, { id: 'eM', at: [PM[0] - 3.5, 4.6, PM[2]], yaw: Math.PI / 2, size: 1.1, lids: true, wrong: 'The seam-eye’s lids stay shut. The great mould under it is empty.' });
  // moulds sunk in the floor: dark dishes with a seam each
  for (const [x, z] of [[MX - 11, FZ - 11], [MX + 9, FZ - 12], [MX + 10, FZ + 11]]) { K.add(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 0.05, 20), [x, 0.03, z])); K.add(iron, T(annulus(1.4, 1.65, 0.08, 20), [x, 0.08, z])); }
  // the dais (top 4.5) up a stair from the east; the hoist's counterweight pan at its west end, its chains up to the roof
  // and away north to the hoist
  const DZ = FZ + 6;
  K.both(M.wall, box(8.8, 3.9, 5.8, MX - 5.5, 1.95, DZ));
  K.slab(MX - 10, DZ - 3, MX - 1, DZ + 3, 4.5, 0.8);
  K.stairs([MX + 4.6, 0, DZ], [MX - 1, 4.5, DZ], 2.6);
  groove([MX - 3, 4.5, DZ], [MX - 7.3, 4.5, DZ]);
  add(Ball, { id: 'm2', a: [MX - 3, 4.54, DZ], b: [MX - 7.3, 4.54, DZ], r: 1.0, lock: true });
  add(Plate, { id: 'pK', at: [MX - 7.3, 4.5, DZ], r: 1.2 });
  for (const s of [-1, 1]) K.add(iron, box(0.1, 12.6, 0.1, MX - 7.3 + s * 1.0, 11.1, DZ));
  K.add(iron, box(2.2, 0.12, 0.12, MX - 7.3, 17.4, DZ));
  bar(K, iron, [MX - 7.3, 17.4, DZ], [SX, 17.4, FZ + MD / 2 - 0.1]);
  K.add(iron, T(new THREE.TorusGeometry(0.7, 0.1, 5, 16), [MX - 7.3, 17.4, DZ + 0.2]));
  add(Watch, { test: (r) => !!r.logic.weights.get('pK')?.has('player') && !r.logic.drumOn('m2', 'pK'), say: 'The pan sinks under you, and behind the wall a chain runs and something rises. You are the weight; but you are here, not on it.', key: 'pK.you' });
  add(Door, { id: 'dM', at: [SX, 0, FZ + MD / 2 + 0.6], ...DOOR, lamps: [{ lit: 'eM' }] });
  add(Mark, { room: 'moulds', at: [MX + 11, 0, FZ - 10], yaw: Math.PI * 0.75 });

  // ---- the Crucible Stair (a passage north of the Mould Room): the hoist up to the chest's landing (UP)
  const S0 = FZ + MD / 2 + 1.2, S1 = S0 + 18, LZ = S0 + 9.8, HZ = LZ - 2.4;
  K.hall({ x: SX, z: (S0 + S1) / 2, w: 20, d: S1 - S0, y: 0, h: 24, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', ...DOOR, y0: UP }] });
  K.slab(SX - 10, LZ, SX + 10, S1, UP, 0.8);
  K.both(M.trim, box(20, 0.3, 0.3, SX, UP + 0.05, LZ + 0.13));   // (2 cm proud of the landing's edge)
  add(Platform, { path: [[SX, 0.3, HZ], [SX, UP, HZ]], r: 2.2, speed: 1.4, pause: 2.0, when: { pressed: 'pK' } });
  K.add(M.dark, T(new THREE.CylinderGeometry(2.4, 2.4, 0.1, 24), [SX, 0.05, HZ]));
  // the pulley over it, its chain going over the wall toward the pan
  K.add(iron, T(new THREE.TorusGeometry(1.4, 0.18, 6, 24), [SX, 22.4, HZ], [0, Math.PI / 2, 0]));
  K.add(iron, box(0.14, 10, 0.14, SX, 17.6, HZ - 1.3));
  K.add(iron, box(0.14, 0.14, HZ - 1.3 - S0, SX, 22.6, (HZ - 1.3 + S0) / 2));
  add(Mark, { room: 'stair', at: [SX - 6, 0, S0 + 3], yaw: Math.PI / 2 });

  // ---- the Tong Chamber (a round hall 34 m across, floor UP): the chest; the try by the dais; the east door's cradle
  K.corridor([SX, S1 + 0.6], [SX, TZ - TR - 0.7], UP, DOOR);
  K.rotunda({ x: SX, z: TZ, y: UP, r: TR, h: 18, gaps: [{ a: Math.PI, ...DOOR }, { a: Math.PI / 2, ...DOOR }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(SX, UP, TZ));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // racks of tongs on the walls (drawn)
  for (const a of [-0.9, -2.2, 2.6]) { const x = SX + Math.sin(a) * (TR - 0.2), z = TZ + Math.cos(a) * (TR - 0.2); for (const s of [-1, 1]) K.add(iron, T(new THREE.BoxGeometry(0.12, 2.4, 0.12), [x, UP + 2.6, z], [0, a, s * 0.12])); }
  groove([SX - 6.5, UP, TZ - 3.5], [SX - 6.5, UP, TZ + 3.5]);
  add(Ball, { id: 'mT', a: [SX - 6.5, UP + 0.04, TZ - 3.5], b: [SX - 6.5, UP + 0.04, TZ + 3.5], r: 1.1, heavy: 'tongs', iron: true, heavyLine: HEAVY, lock: true });
  add(Plate, { id: 'pT', at: [SX - 6.5, UP, TZ + 3.5], r: 1.3 });
  add(Watch, { when: { drumOn: ['mT', 'pT'] }, say: 'The iron moon rolls for the tongs, heavy as a cart, and settles in its cradle. The tongs take hold of the founders’ iron.', key: 'mT.cradle' });
  // the east door's cradle out on the floor, its chain up and over to the door's bar
  const PP = [SX + 8.7, UP, TZ - 5];
  groove([SX + 2.5, UP, PP[2]], PP);
  add(Ball, { id: 'mP', a: [SX + 2.5, UP + 0.04, PP[2]], b: [PP[0], UP + 0.04, PP[2]], r: 1.2, heavy: 'tongs', iron: true, heavyLine: HEAVY, lock: true });
  add(Plate, { id: 'pP', at: PP, r: 1.4 });
  cradle(K, iron, PP[0], UP, PP[2], 1.5, 5);
  K.add(iron, box(0.12, 9.4, 0.12, PP[0] + 1.7, UP + 4.7, PP[2]));
  bar(K, iron, [PP[0] + 1.7, UP + 9.4, PP[2]], [SX + TR - 0.3, UP + DOOR.h + 1.2, TZ - 2]);
  add(Door, { id: 'dP', at: [SX + TR + 0.7, UP, TZ], yaw: Math.PI / 2, ...DOOR, frame: { side: 1.2 }, lamps: [{ drumOn: ['mP', 'pP'] }] });
  add(Mark, { room: 'tongs', at: [SX + 5, UP, TZ - 11], yaw: -Math.PI * 0.75 });

  // ---- the Casting Furnace (46 by 36 m, floor UP): the molten channel down its middle, the bridge, the near lip's hooded
  // mould and pilot flame, the press
  K.corridor([SX + TR + 0.7, TZ], [FX0 - 0.6, TZ], UP, DOOR);
  K.hall({ x: FXc, z: TZ, w: FX1 - FX0, d: FD, y: UP, h: 20, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', ...DOOR }, { side: 's', at: 27 - FXc, ...DOOR }] });
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
  // the near lip's iron moon on its rail along the channel, through the pilot flame into the hooded mould (each as far
  // along it as they were)
  const HX = 3, HA = TZ - 8.3, HB = HA + 16.6;
  groove([HX, UP, HA], [HX, UP, HB]);
  add(Ball, { id: 'mH', a: [HX, UP + 0.04, HA], b: [HX, UP + 0.04, HB], r: 1.0, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 0.55, tar: { ...HOT, burns: 12 } });
  add(Flame, { at: [HX, UP, HA + 12.8], r: 0.9 });
  add(Brazier, { id: 'bH', at: [HX, UP, HA + 18.4], hood: { ball: 'mH', yaw: Math.PI,
    said: 'The ember spatters on the mould’s iron hood. Its mouth opens low, on the rail: only a moon hot from the fire would reach it.',
    cold: 'The iron moon rolls into the mould’s mouth cold, and the mould tips it back out. The founders cast hot.' } });
  // the founders' casting furnace in the north wall: a dark arch, the glow of the melt inside
  const NZ = TZ + FD / 2;
  K.both(M.dark, box(7, 7, 2, HX, UP + 3.5, NZ - 0.8));
  K.add(ember, T(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), [HX, UP + 3.5, NZ - 1.85]));
  K.add(ember, box(4.4, 3.2, 0.1, HX, UP + 1.9, NZ - 1.85));
  add(Mark, { room: 'furnace', at: [-5, UP, TZ - 10], yaw: Math.PI / 2 });
  add(Mark, { room: 'furnaceFar', at: [29, UP, TZ + 8], yaw: Math.PI });

  // ---- the Weighing Hall (34 by 42 m, floor 0, a gallery at UP along its north side and a pier from it out over the
  // middle of the hall): the keepers' door's pan at the pier's end, its eye on a post in the hall
  K.corridor([27, WZ1 + 0.6], [27, TZ - FD / 2 - 0.6], UP, DOOR);
  K.hall({ x: WX, z: WZ, w: WX1 - WX0, d: WZ1 - WZ0, y: 0, h: 22, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: FZ - WZ, ...DOOR }, { side: 'n', at: 27 - WX, ...DOOR, y0: UP }] });
  const GZ = WZ1 - 8.3, PX = 39, PB = [PX, UP, 45.5];
  K.slab(WX0, GZ, WX1, WZ1, UP, 0.8);
  K.slab(PX - 3, PB[2] - 1.6, PX + 3, GZ, UP, 0.8);
  for (const s of [-1, 1]) { K.column(PX + s * 2, PB[2] + 1, 0, UP - 0.8, 0.6, { mat: iron }); K.both(M.trim, box(0.3, 1.0, GZ - PB[2] - 3.4, PX + s * 2.85, UP + 0.5, (GZ + PB[2] + 3.4) / 2)); }
  // (the gallery's parapet, open at the pier and at the stair's head)
  K.both(M.trim, box(PX - 3 - WX0, 1.0, 0.3, (WX0 + PX - 3) / 2, UP + 0.5, GZ + 0.15));
  K.both(M.trim, box(51.2 - PX - 3, 1.0, 0.3, (PX + 3 + 51.2) / 2, UP + 0.5, GZ + 0.15));
  K.stairs([53, 0, 31], [53, UP, GZ - 0.4], 3);
  groove([PX, UP, GZ - 1.5], PB, 1.1);
  add(Ball, { id: 'mB', a: [PX, UP + 0.04, GZ - 1.5], b: [PX, UP + 0.04, PB[2]], r: 1.2, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 0.9, lock: true });
  add(Plate, { id: 'pB', at: PB, r: 1.4 });
  cradle(K, iron, PX, UP, PB[2], 1.5, 5);
  // its chain up over a pulley and across to the keepers' eye's post
  const EX = 32, EZ = 38;
  K.add(iron, T(new THREE.TorusGeometry(0.9, 0.12, 5, 18), [PX, 20, PB[2]], [0, Math.PI / 2, 0]));
  K.add(iron, box(0.12, 20 - UP - 2.6, 0.12, PX, (20 + UP + 2.6) / 2, PB[2]));
  bar(K, iron, [PX, 20.2, PB[2]], [EX - 0.6, 20.2, EZ]);
  K.add(iron, box(0.12, 20.2 - 9.6, 0.12, EX - 0.6, (20.2 + 9.6) / 2, EZ));
  K.column(EX - 0.6, EZ, 0, 9.6, 0.5, { mat: iron });
  add(Switch, { id: 'eS', at: [EX, 8.2, EZ], yaw: Math.PI / 2, size: 1.0, lids: true, wrong: 'The keepers’ eye stays lidded. Its chain runs up to an empty pan out on the gallery’s pier.' });
  // the founders' great scales: a post, a beam, two pans on chains
  const SCX = 46, SCZ = 33;
  K.column(SCX, SCZ, 0, UP, 0.6, { mat: iron });
  K.both(iron, box(0.6, 0.6, 14, SCX, UP + 0.3, SCZ));
  for (const s of [-1, 1]) {
    K.add(iron, box(0.08, 7, 0.08, SCX, 7.5, SCZ + s * 6.6));
    K.both(rust, T(new THREE.CylinderGeometry(1.6, 1.2, 0.4, 18), [SCX, 4, SCZ + s * 6.6]));
  }
  crackedMoon(SCX, 4.9, SCZ - 6.6, 0.7);
  add(Mark, { room: 'scales', at: [28, 0, 30], yaw: Math.PI * 0.25 });
  // the corridor between the keepers' door and the hall
  K.corridor([FR + 0.7, FZ], [WX0 - 0.6, FZ], 0, DOOR);

  // ---- the cold passage under the furnace (the ante), behind the Founders' Door
  K.corridor([0, A0], [0, A1], 0, DOOR);
  // shelves of cooled moons, cracked, along its walls
  for (let z = A0 + 5; z < A1 - 4; z += 7) for (const s of [-1, 1]) { K.both(iron, box(0.6, 0.15, 3, s * 3.4, 1.6, z)); crackedMoon(s * 3.35, 2.05, z - 0.8, 0.35); crackedMoon(s * 3.4, 2.0, z + 0.7, 0.28); }
  add(Mark, { room: 'ante', at: [2.0, 0, A0 + 3.5], yaw: -Math.PI / 2 });
  add(Door, { id: 'dA', at: [0, 0, A1], ...DOOR, frame: { side: 1.2 } });   // (frame: the gap it stands in is wider than the door, issue #356)

  // ---- the Last Casting (a rotunda): the founder's floor, its casting cradle and the iron moon by the west wall
  K.rotunda({ x: 0, z: CW, y: 0, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0.3 });
  K.add(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, 0.25, CW]));
  K.add(ember, T(annulus(9.2, 9.4, 0.06, 64), [0, 0.27, CW]));
  for (const a of [0.7, 2.0, 4.3, 5.6]) crackedMoon(Math.sin(a) * (HR - 2.2), 1.0, CW + Math.cos(a) * (HR - 2.2), 1.0, true);
  groove([-16.6, 0, CW], [-9.6, 0, CW], 1.3);
  add(Ball, { id: 'mA', a: [-16.6, 0.04, CW], b: [-9.6, 0.04, CW], r: 1.3, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 1.2 });
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
    bounds: new THREE.Box3(V(MX - MW / 2 - 2, -4, SAND.z - SAND.d / 2 - 2), V(WX1 + 2, UP + 24, CW + HR + 12)),
    gadget: { at: W(SX, UP + 0.62, TZ).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 0.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 10, FZ, 28], [MX, 9, FZ, 26], [SAND.x, 8, SAND.z, 24], [SX, 12, S0 + 9, 18], [SX, UP + 6, TZ, 24], [3, UP + 6, TZ, 22], [FXc, UP + 7, TZ, 30], [28, UP + 6, TZ, 22], [13, UP - 6, TZ, 18],
      [WX, 12, WZ, 32], [0, 4, 80, 30], [0, 12, CW, 30]],
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
  const opening = new THREE.Shape();
  opening.moveTo(-3.7, 0); opening.lineTo(3.7, 0); opening.lineTo(3.7, 8);
  opening.quadraticCurveTo(3.2, 14, 0, 16); opening.quadraticCurveTo(-3.2, 14, -3.7, 8); opening.closePath();
  K.add(M.voidM, new THREE.ShapeGeometry(opening, 24).translate(0, sill, R + .3));
  K.solid(box(7.4, 16, .1, 0, sill + 8, R + .25));
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
  return { door: { at, heading: yaw }, kit: K, R, sill, glowM, hook: K.world(hook.x, hook.y - 4.2, hook.z), foot: K.world(hook.x, sill, hook.z),
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
  gadget: 'tongs', gadgetBox: 'moonfoundry.temple.tongs', arenaDoor: 'dA', arenas: ARENAS,
  origin: [-50, 1600, -180], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (inside, its futuristic look, after the author's picks: src/temples/skins/casting-house.js; issue #342)
  skin: castingHouseSkin,
  local: { person: 'ilse', out: 8, side: 6 },
  enterLine: 'Inside the Casting-House the air is warm and smells of hot iron. Somewhere below, something heavy rolls, and stops, and rolls.',
  pitLine: 'You climb back out of the channel, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, a whole small moon is lifted out and hung from the jib.', 'resolved.out'); },
  onLit(rt, id) {
    if (id === 'eM') rt.notice('The seam-eye wakes over the full mould; the stair door grinds down.', 'eM.lit');
    if (id === 'bH') rt.notice('The hot moon fills the mould. The bridge’s stones rise from the iron.', 'bH.lit');
    if (id === 'bG') rt.notice('The founders’ moon rolls into its cradle. The Founders’ Door sinks.', 'bG.lit');
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
