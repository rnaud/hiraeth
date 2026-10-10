import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Brazier, Flame, Platform, Bridge, Hammer, Mark, Pit } from './pieces.js';
import { founderModel } from './guardian-founder.js';

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
// places at once.)
//   the Porch             the first mark, the way out
//   the Pouring Floor     the hub, a round hall under a cracked moon: the founders' iron moon on its rail through the
//                         house's pilot flame to the great hooded cradle under the sealed Founders' Door (seen from the
//                         first step, rolled at the end); a stone moon whose groove runs west through the doorway into
//                         the Mould Room; a little test scale (a stone moon in a small cradle: it tips, and nothing);
//                         the keepers' door, shut, on the east (it opens from the far side)
//   the Mould Room        the stone moon from the Pouring Floor rolled into the great mould wakes the seam-eye over it
//                         (lidded until a moon fills the mould): the door north to the Crucible Stair. On a shelf up a
//                         stair a second stone moon waits by the hoist's counterweight pan
//   the Crucible Stair    the hoist up to the chest: it runs only while its pan in the Mould Room holds a weight (stand
//                         in it yourself and it rises without you; the stone moon stands in for you)
//   the Tong Chamber      the makers' chest: the FOUNDERS' TONGS (src/items.js 'tongs'). A try by the dais: an iron moon
//                         that rolls for the tongs into a little cradle, and nothing waits on it. Its way on is open
//   the Pincer Passage    a room on: the door into the furnace is held by an iron moon's cradle (the tongs' first lock,
//                         where a miss costs nothing); a second iron moon waits on a rail that runs under the door
//   the Casting Furnace   a channel of molten iron, the bridge over it raised by the hooded mould on the near lip: the
//                         passage's iron moon rolled through the pilot flame comes out hot, and a hot moon in the mould's
//                         mouth lights it (the tongs with the fire: the twist). The founders' press slams down on the
//                         bridge, out of step
//   the Weighing Hall     down from the furnace's far landing: the keepers' door's eye wakes once an iron moon is in its
//                         pan on the gallery (rolled in from the far landing); the keepers' door opens onto the Pouring
//                         Floor, the shortcut back
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

// the rooms' places (local metres): the hub's centre, the chest's chamber, the arena's centre
const FZ = 28, FR = 14, TZ = 66.9, CW = 108.7, HR = 20;

export const LOGIC = {
  id: 'moonfoundry', entry: 'threshold', gadget: 'tongs',
  rooms: {
    threshold: { checkpoint: true }, floor: { checkpoint: true }, moulds: { checkpoint: true }, stair: { checkpoint: true }, tongs: { checkpoint: true },
    furnace: { checkpoint: true }, furnaceFar: {}, scales: { checkpoint: true }, ante: { checkpoint: true }, hall: { boss: true }, out: {},
  },
  links: [
    { a: 'threshold', b: 'floor' },
    { a: 'floor', b: 'moulds' },
    { a: 'moulds', b: 'stair', door: 'dM' },        // the seam-eye over the great mould
    { a: 'stair', b: 'tongs', door: 'hoist' },      // the hoist, while its pan in the Mould Room holds a weight
    { a: 'tongs', b: 'furnace', door: 'dP' },       // the Pincer Passage's door, a room on from the chest (one room with it)
    { a: 'furnace', b: 'furnaceFar', door: 'brH' }, // the bridge over the molten channel: the hot moon in the hooded mould
    { a: 'furnaceFar', b: 'scales' },               // down onto the Weighing Hall's gallery
    { a: 'floor', b: 'scales', door: 'dS' },        // the keepers' door: the shortcut back, opened from the far side
    { a: 'floor', b: 'ante', door: 'dF' },          // the Founders' Door: the founders' moon hot in the great cradle
    { a: 'ante', b: 'hall', door: 'dA' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Pouring Floor's stone moon, rolled west into the Mould Room's great mould: the seam-eye over it opens its lids
    m1: { type: 'drum', room: 'floor', plate: 'pM', plateAt: 1, start: 0 },
    pM: { type: 'plate', room: 'moulds' },
    eM: { type: 'switch', room: 'moulds', when: { drumOn: ['m1', 'pM'] } },
    dM: { type: 'door', opens: { lit: 'eM' }, latch: true },
    // the hoist's counterweight pan, on the Mould Room's shelf: you in it, or the stone moon
    m2: { type: 'drum', room: 'moulds', plate: 'pK', plateAt: 1, start: 0 },
    pK: { type: 'plate', room: 'moulds' },
    hoist: { type: 'bridge', opens: { pressed: 'pK' } },
    // the test scale on the Pouring Floor: a stone moon in a little cradle; it tips, and nothing waits on it
    m0: { type: 'drum', room: 'floor', plate: 'p0', plateAt: 1, start: 0 },
    p0: { type: 'plate', room: 'floor' },
    chest: { type: 'gadget', room: 'tongs', item: 'tongs' },
    // the try by the dais: an iron moon into a little cradle (nothing waits on it)
    mT: { type: 'drum', room: 'tongs', plate: 'pT', plateAt: 1, start: 0, needs: ['tongs'] },
    pT: { type: 'plate', room: 'tongs' },
    // the Pincer Passage: its door held by an iron moon's cradle
    mP: { type: 'drum', room: 'tongs', plate: 'pP', plateAt: 1, start: 0, needs: ['tongs'] },
    pP: { type: 'plate', room: 'tongs' },
    dP: { type: 'door', opens: { drumOn: ['mP', 'pP'] }, latch: true },
    // the Casting Furnace: the passage's second iron moon, under the door and through the pilot flame into the hooded mould
    mH: { type: 'drum', room: 'tongs', plate: 'pH', plateAt: 1, start: 0, needs: ['tongs'] },
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
    dF: { type: 'door', opens: { lit: 'bG' }, latch: true },
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
  wake: 'At the bottom of the house something heavy rolls forward on iron wheels. A founder of cast iron lifts its ladle; a cracked moon drops from its tongs and rolls away.',
  openHint: 'It pours, and the doors of its crucible chest swing open on the molten heart. Splash the heart with water.',
  resolved: 'The Last Founder stops with its ladle raised. The moon in its cradle has come out whole, and it stands looking at it, its heart going dark. Overhead, something is lifted out through the chimney.',
  missHint: 'It rolls past you into the wall and stands there, rocking on its wheels, its crucible doors open.',
  phases: [
    { to: 0.35, attacks: ['ladle', 'slam', 'cast'], pause: 1.6, hint: 'When it has poured, its crucible doors swing open: splash the molten heart.' },
    { to: 0.7, attacks: ['cast', 'casts', 'ladle'], pause: 1.2, hint: 'It casts moons now, and throws the cracked ones. The iron moon by the wall: roll it into the casting cradle before it, and its next pour finds a whole moon. It stops to look, and a splash counts twice.' },
    { to: 1.0, attacks: ['charge', 'casts', 'slam'], pause: 1.0, hint: 'It tipped the moon out of its cradle as it shook. Now its heart is too hot for water unless the cradle holds a moon: roll the iron moon back in, and splash the heart while it looks.',
      openHint: 'Its doors open on a heart too hot for water. With a whole moon in its cradle it stops to look, and cools.' },
  ],
  attacks: {
    ladle: { shape: 'cone', range: 9, angle: 0.8, wind: 1.3, track: 0.6, part: 'arms', rig: 'coil', damage: 0.75, knock: 10, recover: 0.5, then: 'ladle2' },
    ladle2: { shape: 'cone', range: 9, angle: 0.8, wind: 0.8, track: 0.5, part: 'arms', rig: 'coil', side: -1, link: true, damage: 0.75, knock: 10, gap: 0.2, then: 'pour' },
    pour: { shape: 'ring', at: 'front', ahead: 4, radius: 3.6, wind: 1.1, part: 'core', rig: 'lean', link: true, wave: { speed: 8, reach: 14, width: 0.7, damage: 0.5 }, damage: 1, knock: 12, recover: 0.9, open: 4.6 },
    slam: { shape: 'ring', at: 'self', radius: 5.5, wind: 1.3, part: 'arms', rig: 'rear', damage: 0.75, knock: 11, recover: 0.8, open: 4.2 },
    cast: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    casts: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'arms', rig: 'swell', pose: 'cast', damage: 0.5, knock: 6, recover: 0.6 },
    charge: { shape: 'lane', range: 16, width: 4.4, wind: 1.3, track: 0.65, part: 'feet', rig: 'crouch', dash: 10, damage: 1, knock: 12, recover: 1.0, open: 2.4, miss: 3.4 },
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

  // ---- the Porch (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  // the founders' racks: a few small cracked moons on a shelf
  K.both(iron, box(1.2, 0.2, 6, 6.2, 1.4, 6));
  for (const z of [4, 6, 8]) crackedMoon(6.2, 1.9, z, 0.4);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Pouring Floor (a rotunda round FZ): the founders' moon, the pilot flame, the great cradle under the Founders' Door
  K.rotunda({ x: 0, z: FZ, y: 0, r: FR, h: 18, gaps: [{ a: Math.PI, w: 6, h: 7 }, { a: -Math.PI / 2, w: 5, h: 6.4 }, { a: Math.PI / 2, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.3 });
  // a cracked moon hung under the oculus (drawn), on chains
  crackedMoon(0, 13.2, FZ, 2.6);
  for (const a of [0.3, 2.4, 4.5]) K.add(iron, T(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 4), [Math.sin(a) * 1.6, 17.3, FZ + Math.cos(a) * 1.6], [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]));
  // the founders' moon on its rail, through the pilot flame, into the great hooded cradle
  groove([0, 0, 18.4], [0, 0, 33.2], 1.3);
  add(Ball, { id: 'mG', a: [0, 0.04, 18.4], b: [0, 0.04, 33.2], r: 1.3, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 0.7, lock: true, tar: { ...HOT, burns: 14 } });
  add(Flame, { at: [0, 0, 25.2], r: 0.9 });
  add(Brazier, { id: 'bG', at: [0, 0, 35.6], scale: 1.3, hood: { ball: 'mG', yaw: Math.PI,
    said: 'The ember spatters on the cradle’s iron hood. Its mouth opens low, on the rail: only a moon hot from the fire would reach it.',
    cold: 'The moon rolls into the cradle’s mouth cold, and the cradle tips it back out. The founders cast hot.' } });
  cradle(K, iron, 0, 0, 35.6, 2.2, 6);
  add(Door, { id: 'dF', at: [0, 0, FZ + FR + 0.7], w: 5, h: 6.4, lamps: [{ lit: 'bG' }] });
  K.glyph([0, 9.4, FZ + FR - 0.05], 2.0, Math.PI);
  // the stone moon whose groove runs west through the doorway into the Mould Room's great mould
  groove([-7, 0, FZ], [-27, 0, FZ]);
  add(Ball, { id: 'm1', a: [-7, 0.04, FZ], b: [-27, 0.04, FZ], r: 1.0, friction: 0.9 });
  // the test scale: a stone moon and its little cradle (it tips, and nothing waits on it)
  groove([6, 0, 21], [10, 0, 21], 0.9);
  add(Ball, { id: 'm0', a: [6, 0.04, 21], b: [10, 0.04, 21], r: 0.9 });
  add(Plate, { id: 'p0', at: [10, 0, 21], r: 1.1 });
  add(Watch, { when: { drumOn: ['m0', 'p0'] }, say: 'The little scale tips under the stone moon, and rights itself. A test cast: whatever the founders weighed here was heavier.', key: 'm0.scale' });
  // the keepers' door on the east: shut from this side
  add(Door, { id: 'dS', at: [FR + 0.7, 0, FZ], yaw: Math.PI / 2, w: 5, h: 6.4, lamps: [{ lit: 'eS' }] });
  add(Mark, { room: 'floor', at: [-8, 0, 19.5], yaw: Math.PI * 0.25 });

  // ---- the Mould Room (x -38..-16): the great mould and its seam-eye; the shelf with the hoist's pan
  const MX = -27;
  K.hall({ x: MX, z: FZ, w: 22, d: 18, y: 0, h: 14, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', w: 5, h: 6.4 }, { side: 'n', at: 6, w: 5, h: 6.4 }] });
  add(Plate, { id: 'pM', at: [MX, 0, FZ], r: 1.2 });
  K.add(M.dark, T(annulus(1.7, 2.6, 0.06, 32), [MX, 0.05, FZ]));
  K.add(ember, T(annulus(2.6, 2.75, 0.04, 32), [MX, 0.06, FZ]));   // (the mould's seam)
  add(Switch, { id: 'eM', at: [-37.7, 4.6, FZ], yaw: Math.PI / 2, size: 1.1, lids: true, wrong: 'The seam-eye’s lids stay shut. The great mould under it is empty.' });
  // moulds sunk in the floor: dark dishes with a seam each
  for (const [x, z] of [[-33, 22], [-21, 22.5], [-33, 32]]) { K.add(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 0.05, 20), [x, 0.03, z])); K.add(iron, T(annulus(1.4, 1.65, 0.08, 20), [x, 0.08, z])); }
  // the shelf (top 4.5) up a stair along the north wall; the hoist's counterweight pan in its corner, chains up through the wall
  K.slab(-38, 33, -30, 37, 4.5, 0.8);
  K.both(M.trim, box(0.3, 0.6, 4, -30.15, 4.3, 35));
  K.stairs([-24.4, 0, 35.2], [-30, 4.5, 35.2], 2.6);
  groove([-32, 4.5, 35], [-36.3, 4.5, 35]);
  add(Ball, { id: 'm2', a: [-32, 4.54, 35], b: [-36.3, 4.54, 35], r: 1.0, lock: true });
  add(Plate, { id: 'pK', at: [-36.3, 4.5, 35], r: 1.2 });
  for (const s of [-1, 1]) K.add(iron, box(0.1, 9, 0.1, -36.3 + s * 1.0, 9.2, 35));
  K.add(iron, box(9.4, 0.12, 0.12, -32.6, 13.7, 36.6));
  K.add(iron, T(new THREE.TorusGeometry(0.7, 0.1, 5, 16), [-36.3, 13.7, 36.4]));
  add(Watch, { test: (r) => !!r.logic.weights.get('pK')?.has('player') && !r.logic.drumOn('m2', 'pK'), say: 'The pan sinks under you, and behind the wall a chain runs and something rises. You are the weight; but you are here, not on it.', key: 'pK.you' });
  add(Door, { id: 'dM', at: [MX + 6, 0, FZ + 9.6], w: 5, h: 6.4, lamps: [{ lit: 'eM' }] });
  add(Mark, { room: 'moulds', at: [-21, 0, 21.5], yaw: Math.PI * 0.75 });

  // ---- the Crucible Stair (x -27..-15): the hoist up to the chest's landing (9 up)
  const SX = -21;
  K.hall({ x: SX, z: 46, w: 12, d: 16, y: 0, h: 22, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4, y0: 9 }] });
  K.slab(-27, 49.8, -15, 54, 9, 0.8);
  K.both(M.trim, box(12, 0.3, 0.3, SX, 9.05, 49.95));
  add(Platform, { path: [[SX, 0.3, 47.4], [SX, 9, 47.4]], r: 2.2, speed: 1.4, pause: 2.0, when: { pressed: 'pK' } });
  K.add(M.dark, T(new THREE.CylinderGeometry(2.4, 2.4, 0.1, 24), [SX, 0.05, 47.4]));
  // the pulley over it, its chain going over the wall toward the pan
  K.add(iron, T(new THREE.TorusGeometry(1.4, 0.18, 6, 24), [SX, 20.4, 47.4], [0, Math.PI / 2, 0]));
  K.add(iron, box(0.14, 11, 0.14, SX, 14.6, 46.1));
  K.add(iron, box(0.14, 0.14, 8, SX, 20.6, 42.6));
  add(Mark, { room: 'stair', at: [-25, 0, 41], yaw: Math.PI / 2 });

  // ---- the corridor and the Tong Chamber (a rotunda, floor 9): the chest; the try by the dais
  K.slab(SX - 3.2, 54, SX + 3.2, 57.2, 9, 0.8);
  K.wall(SX - 3.2, 54.6, SX - 3.2, 56.6, 9, 6.4, { t: 0.8 }); K.wall(SX + 3.2, 56.6, SX + 3.2, 54.6, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, SX, 15.8, 55.6));
  K.rotunda({ x: SX, z: TZ, y: 9, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: Math.PI / 2, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(SX, 9, TZ), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(SX, 9.31, TZ));
  // racks of tongs on the walls (drawn)
  for (const a of [-0.9, -2.2, 2.6]) { const x = SX + Math.sin(a) * 9.3, z = TZ + Math.cos(a) * 9.3; for (const s of [-1, 1]) K.add(iron, T(new THREE.BoxGeometry(0.12, 2.4, 0.12), [x, 11.6, z], [0, a, s * 0.12])); }
  groove([SX - 6.5, 9, TZ - 3.5], [SX - 6.5, 9, TZ + 3.5]);
  add(Ball, { id: 'mT', a: [SX - 6.5, 9.04, TZ - 3.5], b: [SX - 6.5, 9.04, TZ + 3.5], r: 1.1, heavy: 'tongs', iron: true, heavyLine: HEAVY, lock: true });
  add(Plate, { id: 'pT', at: [SX - 6.5, 9, TZ + 3.5], r: 1.3 });
  add(Watch, { when: { drumOn: ['mT', 'pT'] }, say: 'The iron moon rolls for the tongs, heavy as a cart, and settles in its cradle. The tongs take hold of the founders’ iron.', key: 'mT.cradle' });
  add(Mark, { room: 'tongs', at: [SX + 4.5, 9, TZ - 5.5], yaw: -Math.PI * 0.75 });

  // ---- the Pincer Passage (floor 9), a room on: the door into the furnace held by an iron moon's cradle; a second iron
  // moon on a rail that runs under the door
  const PX0 = -9.4, PX1 = 2;
  K.hall({ x: (PX0 + PX1) / 2, z: TZ, w: PX1 - PX0, d: 12, y: 9, h: 10, roof: true, omit: ['e'], doors: [{ side: 'w', w: 5, h: 6.4 }] });
  groove([-6.8, 9, TZ - 3.6], [-0.6, 9, TZ - 3.6]);
  add(Ball, { id: 'mP', a: [-6.8, 9.04, TZ - 3.6], b: [-0.6, 9.04, TZ - 3.6], r: 1.2, heavy: 'tongs', iron: true, heavyLine: HEAVY, lock: true });
  add(Plate, { id: 'pP', at: [-0.6, 9, TZ - 3.6], r: 1.4 });
  for (const y of [11.5, 13.5]) K.add(iron, box(0.14, 0.14, 4.2, 1.2, y, TZ - 3.6 + 1.6));   // (its chains up to the door's bar)
  const HA = -6.8, HB = 9.8, DX = PX1;   // the hot moon's groove, from the passage under the door to the mould
  groove([HA, 9, TZ + 1.3], [HB, 9, TZ + 1.3]);
  add(Ball, { id: 'mH', a: [HA, 9.04, TZ + 1.3], b: [HB, 9.04, TZ + 1.3], r: 1.0, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 0.55, tar: { ...HOT, burns: 12 },
    gap: { bridge: 'dP', from: (DX - 0.45 - 1.05 - HA) / (HB - HA), to: (DX + 0.45 + 1.05 - HA) / (HB - HA), lip: 'The iron moon rolls up against the shut door and stops. Its rail runs on under it.' } });
  add(Door, { id: 'dP', at: [DX, 9, TZ], yaw: Math.PI / 2, w: 5, h: 6.4, lamps: [{ drumOn: ['mP', 'pP'] }] });

  // ---- the Casting Furnace (x 2..34, floor 9): the molten channel, the bridge, the hooded mould, the pilot flame, the press
  const FX0 = 2, FX1 = 34, C0 = 13, C1 = 23;
  K.hall({ x: (FX0 + FX1) / 2, z: TZ, w: FX1 - FX0, d: 26, y: 9, h: 20, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', w: 5, h: 6.4 }, { side: 's', at: 10, w: 5, h: 6.4 }] });
  K.slab(PX0 - 0.6, TZ - 6.6, FX0, TZ + 6.6, 9, 0.8);   // (the passage's floor, up to the door)
  K.slab(FX0, TZ - 13, C0, TZ + 13, 9, 0.8);
  K.slab(C1, TZ - 13, FX1, TZ + 13, 9, 0.8);
  // the channel: its faces down to the molten iron, the iron glowing at the bottom
  K.both(M.wall, box(0.8, 6, 26, C0 - 0.4, 5.6, TZ)); K.both(M.wall, box(0.8, 6, 26, C1 + 0.4, 5.6, TZ));
  for (const s of [-1, 1]) K.both(M.wall, box(C1 - C0, 6, 0.8, (C0 + C1) / 2, 5.6, TZ + s * 13.4));
  K.both(ember, box(C1 - C0, 0.4, 26, (C0 + C1) / 2, 3.0, TZ));
  K.both(M.dark, box(C1 - C0, 1, 26, (C0 + C1) / 2, 2.3, TZ));
  add(Pit, { room: 'furnace', min: [C0, -2, TZ - 13], max: [C1, 7.4, TZ + 13] });
  add(Bridge, { id: 'brH', a: [C0 - 0.1, 9, TZ - 5], b: [C1 + 0.1, 9, TZ - 5], w: 4, n: 7 });
  add(Hammer, { id: 'hm', at: [(C0 + C1) / 2, 9, TZ - 5], yaw: Math.PI / 2, w: 4.6, d: 2.4, top: 5.2, period: 3.0, knock: 9,
    hit: 'The founders’ press comes down and throws you off the bridge. It slams out of step: wait for it to rise.' });
  // the pilot flame on the hot moon's rail, the hooded mould at its end on the near lip
  add(Flame, { at: [6.0, 9, TZ + 1.3], r: 0.9 });
  add(Brazier, { id: 'bH', at: [11.6, 9, TZ + 1.3], hood: { ball: 'mH', yaw: -Math.PI / 2,
    said: 'The ember spatters on the mould’s iron hood. Its mouth opens low, on the rail: only a moon hot from the fire would reach it.',
    cold: 'The iron moon rolls into the mould’s mouth cold, and the mould tips it back out. The founders cast hot.' } });
  // the founders' casting furnace in the north wall: a dark arch, the glow of the melt inside
  K.both(M.dark, box(7, 7, 2, 6.0, 12.5, TZ + 12.2));
  K.add(ember, T(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), [6.0, 12.5, TZ + 11.15]));
  K.add(ember, box(4.4, 3.2, 0.1, 6.0, 10.9, TZ + 11.15));
  add(Mark, { room: 'furnace', at: [5, 9, TZ - 9], yaw: Math.PI / 2 });
  // the far landing: the third iron moon, its rail south through the doorway onto the Weighing Hall's gallery and its pan
  groove([28, 9, TZ - 4], [28, 9, 47.6], 1.1);
  add(Ball, { id: 'mB', a: [28, 9.04, TZ - 4], b: [28, 9.04, 47.6], r: 1.2, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 0.9, lock: true });
  add(Mark, { room: 'furnaceFar', at: [31, 9, TZ + 8], yaw: Math.PI });
  K.slab(25.4, 51.8, 30.6, 54.6, 9, 0.8);
  K.both(M.wall, box(6.2, 0.8, 2.6, 28, 16.2, 53.2));

  // ---- the Weighing Hall (x 17..41, floor 0, a gallery at 9 along its north side): the keepers' door's pan and eye
  const WX = 29, WZ = 33.7;
  K.hall({ x: WX, z: WZ, w: 24, d: 37.4, y: 0, h: 20, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: FZ - WZ, w: 5, h: 6.4 }, { side: 'n', at: 28 - WX, w: 5, h: 6.4, y0: 9 }] });
  K.slab(17, 44, 41, 52.4, 9, 0.8);
  K.both(M.trim, box(18.5, 1.0, 0.3, 26.25, 9.5, 44.15));   // (the gallery's parapet, open at the stair's head)
  K.stairs([38.6, 0, 18.5], [38.6, 9, 43.8], 3);
  add(Plate, { id: 'pB', at: [28, 9, 47.6], r: 1.4 });
  cradle(K, iron, 28, 9, 47.6, 1.5, 5);
  // its chain up over a pulley and down to the keepers' door's bar
  K.add(iron, T(new THREE.TorusGeometry(0.9, 0.12, 5, 18), [28, 19, 47.6], [0, Math.PI / 2, 0]));
  K.add(iron, box(0.12, 9.6, 0.12, 28, 14.2, 47.6));
  K.add(iron, T(new THREE.BoxGeometry(0.12, 0.12, 22), [22.6, 19.2, 37.5], [0, -0.48, 0]));
  K.add(iron, box(0.12, 11, 0.12, 17.4, 13.6, FZ));
  add(Switch, { id: 'eS', at: [17.3, 8.2, FZ], yaw: Math.PI / 2, size: 1.0, lids: true, wrong: 'The keepers’ eye stays lidded. Its chain runs up to an empty pan on the gallery.' });
  // the founders' great scales: a post, a beam, two pans on chains (the middle of the hall)
  K.column(WX, 26, 0, 9, 0.6, { mat: iron });
  K.both(iron, box(14, 0.6, 0.6, WX, 9.3, 26));
  for (const s of [-1, 1]) {
    K.add(iron, box(0.08, 5, 0.08, WX + s * 6.6, 6.6, 26));
    K.both(rust, T(new THREE.CylinderGeometry(1.6, 1.2, 0.4, 18), [WX + s * 6.6, 4, 26]));
  }
  crackedMoon(WX - 6.6, 4.9, 26, 0.7);
  add(Mark, { room: 'scales', at: [24, 0, 20], yaw: Math.PI * 0.25 });
  // the corridor between the keepers' door and the hall
  K.slab(FR + 0.6, FZ - 2.6, 17.4, FZ + 2.6, 0, 0.8);
  for (const s of [-1, 1]) K.both(M.wall, box(1.4, 6.4, 0.6, 16.0, 3.2, FZ + s * 2.9));
  K.both(M.wall, box(2.6, 0.8, 6.4, 16.0, 6.8, FZ));

  // ---- the cold passage under the furnace (the ante), behind the Founders' Door
  const A0 = FZ + FR + 1.4, A1 = CW - HR - 0.7;
  K.slab(-3.2, A0, 3.2, A1, 0, 0.8);
  K.wall(-3.2, A0, -3.2, A1, 0, 6.4, { t: 0.8 }); K.wall(3.2, A1, 3.2, A0, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, A1 - A0, 0, 6.8, (A0 + A1) / 2));
  // shelves of cooled moons, cracked, along its walls
  for (let z = A0 + 5; z < A1 - 4; z += 7) for (const s of [-1, 1]) { K.both(iron, box(0.6, 0.15, 3, s * 2.45, 1.6, z)); crackedMoon(s * 2.45, 2.05, z - 0.8, 0.35); crackedMoon(s * 2.45, 2.0, z + 0.7, 0.28); }
  add(Mark, { room: 'ante', at: [2.0, 0, A0 + 3.5], yaw: -Math.PI / 2 });
  add(Door, { id: 'dA', at: [0, 0, A1], w: 5, h: 6 });

  // ---- the Last Casting (a rotunda): the founder's floor, its casting cradle and the iron moon by the west wall
  K.rotunda({ x: 0, z: CW, y: 0, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  K.add(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, 0.25, CW]));
  K.add(ember, T(annulus(9.2, 9.4, 0.06, 64), [0, 0.27, CW]));
  for (const a of [0.7, 2.0, 4.3, 5.6]) crackedMoon(Math.sin(a) * (HR - 2.2), 1.0, CW + Math.cos(a) * (HR - 2.2), 1.0, true);
  groove([-16.6, 0, CW], [-9.6, 0, CW], 1.3);
  add(Ball, { id: 'mA', a: [-16.6, 0.04, CW], b: [-9.6, 0.04, CW], r: 1.3, heavy: 'tongs', iron: true, heavyLine: HEAVY, friction: 1.2 });
  add(Plate, { id: 'pA', at: [-9.6, 0, CW], r: 1.5 });
  cradle(K, iron, -9.6, 0, CW, 1.6, 6);
  add(Door, { id: 'd5', at: [0, 0, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 0, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 0, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 0, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 0, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 7.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 0, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.1, 0, 2.5, CW + HR + 10.5));

  const model = founderModel();
  model.pos.copy(K.world(0, 0, CW + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 0, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 0, CW), r: HR, y: K.world(0, 0, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-41, -4, -3), V(44, 34, CW + HR + 12)),
    gadget: { at: W(SX, 9.62, TZ).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 0.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 8, FZ, 20], [MX, 7, FZ, 16], [SX, 10, 46, 16], [SX, 14, TZ, 16], [-3.7, 13, TZ, 12], [8, 14, TZ, 20], [28, 14, TZ, 18], [18, 4, TZ, 14],
      [WX, 10, WZ, 24], [0, 4, 65, 18], [0, 12, CW, 30]],
    guardian: { def: { ...LAST_FOUNDER, onHit: founderHit, openFor: founderOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Casting-House under the hangar's roof
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 9, sill = 0.3;
  const base = level.ground?.heightAt ? level.ground.heightAt(SITE.x, SITE.z) : 0;
  const K = new TempleKit(rt.root, 'The Casting-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M;
  const ironW = { paint: new THREE.Color('#5b524c'), smooth: false, side: THREE.FrontSide };
  const iron = { paint: new THREE.Color('#3f393a'), smooth: false, side: THREE.FrontSide };
  const rust = { paint: new THREE.Color('#b5653a'), smooth: false, side: THREE.FrontSide };
  const ochre = { paint: new THREE.Color('#d39a4a'), smooth: false, side: THREE.FrontSide };
  const ivory = { paint: new THREE.Color('#efe6d2'), smooth: true, side: THREE.FrontSide };
  // a round casting tower of riveted iron on a flared foot, ochre courses round it, a shoulder and a cap, and the
  // chimney going up out of it toward the girders (the hangar's roof at 88): a landmark down the floor from the aisle
  const HT = 30;
  K.both(M.floor, new THREE.CylinderGeometry(R + 4, R + 4.4, 0.6, 32).translate(0, sill - 0.3, 0));
  K.both(M.wall, lathe([[R + 1.6, 0], [R + 1.6, 2.4], [R, 3.6], [R, HT], [R + 1.0, HT + 0.6], [R + 1.0, HT + 1.6], [R - 2.6, HT + 4], [3.2, HT + 5]], 32).translate(0, sill, 0));
  for (const y of [8, 15, 22]) K.both(rust, new THREE.CylinderGeometry(R + 0.25, R + 0.25, 0.9, 32).translate(0, sill + y, 0));
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; for (const y of [7.4, 8.6, 21.4, 22.6]) K.add(ochre, T(new THREE.SphereGeometry(0.12, 5, 3), [Math.sin(a) * (R + 0.3), sill + y, Math.cos(a) * (R + 0.3)])); }
  for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue; K.add(M.glyph, T(glyphGeometry(1.5, 0.12), [Math.sin(a) * (R + 0.32), sill + 18.5, Math.cos(a) * (R + 0.32)], [0, a, 0])); }
  // the chimney: an iron stack banded in rust, its mouth ringed (the change lights it steady)
  const CH = 47;
  K.both(iron, new THREE.CylinderGeometry(2.2, 2.7, CH, 16).translate(0, sill + HT + 4 + CH / 2, 0));
  for (const y of [12, 24, 36]) K.add(rust, new THREE.CylinderGeometry(2.55 - y * 0.008, 2.55 - y * 0.008, 0.6, 16).translate(0, sill + HT + 4 + y, 0));
  K.add(rust, new THREE.CylinderGeometry(2.6, 2.6, 0.9, 16).translate(0, sill + HT + 4 + CH - 0.4, 0));
  // the jib at the shoulder, out over the door's left, its hook (the change hangs a new moon on it)
  const JA = -0.7, JL = 13, jy = sill + HT + 3;
  const jx = Math.sin(JA) * (R + JL / 2 - 1), jz = Math.cos(JA) * (R + JL / 2 - 1);
  K.both(iron, T(new THREE.BoxGeometry(0.8, 1.0, JL), [jx, jy, jz], [0, JA, 0]));
  K.add(iron, T(new THREE.BoxGeometry(0.1, 0.1, JL * 0.75), [Math.sin(JA) * (R + JL * 0.35), jy + 2.2, Math.cos(JA) * (R + JL * 0.35)], [0.28, JA, 0]));
  const hook = V(Math.sin(JA) * (R + JL - 1.6), jy - 0.5, Math.cos(JA) * (R + JL - 1.6));
  K.add(iron, box(0.08, 3.2, 0.08, hook.x, hook.y - 1.6, hook.z));
  K.add(iron, T(new THREE.TorusGeometry(0.35, 0.08, 4, 10, Math.PI * 1.4), [hook.x, hook.y - 3.4, hook.z], [0, 0, 2.4]));
  // the doorway: a porch of two iron piers and a lintel, the glyph over it, an arch of rust iron round the dark
  const z0 = R - 1.2, z1 = R + 2.6;
  for (const s of [-1, 1]) K.both(ironW, box(2.4, 8, z1 - z0, s * 3.6, sill + 4, (z0 + z1) / 2));
  K.both(ironW, box(9.6, 1.6, z1 - z0, 0, sill + 7.6, (z0 + z1) / 2));
  K.add(M.glyph, T(glyphGeometry(2.0, 0.14), [0, sill + 7.6, z1 + 0.06]));
  K.both(rust, T(new THREE.TorusGeometry(2.75, 0.35, 6, 24, Math.PI), [0, sill + 4.2, z1 - 0.2]));
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; K.add(ochre, T(new THREE.SphereGeometry(0.11, 5, 3), [Math.cos(a) * 2.75, sill + 4.2 + Math.sin(a) * 2.75, z1 + 0.2])); }
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.8, 6.8).translate(0, 3.4, 0), [0, sill, R + 0.25]));
  K.solid(box(4.8, 6.8, 0.1, 0, sill + 3.4, R + 0.25));
  // Ilse's ledger desk by the door, under a little tin roof; two cracked moons lying on the apron
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
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; slits.push(T(new THREE.BoxGeometry(0.5, 1.6, 0.1), [Math.sin(a) * (R + 0.06), sill + 26, Math.cos(a) * (R + 0.06)], [0, a, 0])); }
  slits.push(T(annulus(1.6, 2.15, 0.1, 18), [0, sill + HT + 4 + CH + 0.06, 0]));
  const sm = new THREE.Mesh(mergeAll(slits), glowM);
  sm.position.copy(K.world(0, 0, 0)); sm.rotation.y = yaw;
  sm.userData.noCollide = true; sm.userData.dynamic = true;
  rt.root.add(sm);
  const at = K.world(0, sill, R + 1.4);
  const front = K.world(0, sill, R + 10);
  return { door: { at, heading: yaw }, kit: K, R, sill, glowM, hook: K.world(hook.x, hook.y - 3.4, hook.z), foot: K.world(Math.sin(JA) * (R + JL - 1.6), sill, Math.cos(JA) * (R + JL - 1.6)),
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
/**
 * Once the Last Founder is stopped, the one moon it cast whole is lifted out of the Casting-House and hangs from the
 * jib over the door, turning slowly; the slits round the tower's top and the chimney's mouth glow steady (until then
 * they flicker, and at night they flare as the house pours by itself).
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
  let k = 0, want = 0, lift = 0;
  const from = V(), to = V();
  const apply = () => { root.visible = k > 0.01; };
  return {
    root,
    get on() { return want === 1; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; lift = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 2 : -dt), 0, 1); apply(); }
      if (!O) return;
      // the moon rises from the door's foot to the hook (8 s), then hangs there turning
      if (want && lift < 1) lift = Math.min(1, lift + dt / 8);
      if (moon) {
        const e = lift * lift * (3 - 2 * lift);
        moon.position.lerpVectors(from.copy(O.foot).setY(O.foot.y + 1.8), to.copy(O.hook).setY(O.hook.y - 2.3), e);
        moon.rotation.y = t * 0.15;
      }
      // the glow: flickering, flaring at night as it pours; steady once the founder is stopped
      const night = rt.isNight?.() ?? false;
      const g = want ? 0.55 + 0.05 * Math.sin(t * 0.8) : (night ? 0.5 : 0.25) + (night ? 0.4 : 0.15) * Math.max(0, Math.sin(t * 3.1) * Math.sin(t * 7.7));
      O.glowM.uniforms.uGlow.value = g;
    },
  };
}

export const MOONFOUNDRY_TEMPLE = {
  id: 'moonfoundry', levelId: 'moonfoundry', name: 'The Casting-House', doorLabel: 'door of the Casting-House',
  gadget: 'tongs', gadgetBox: 'moonfoundry.temple.tongs', arenaDoor: 'dA',
  origin: [-50, 1600, -180], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'ilse', out: 8, side: 6 },
  enterLine: 'Inside the Casting-House the air is warm and smells of hot iron. Somewhere below, something heavy rolls, and stops, and rolls.',
  pitLine: 'You climb back out of the channel, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, a small moon is lifted out of the Casting-House and hung from its jib, whole.', 'resolved.out'); },
  onLit(rt, id) {
    if (id === 'eM') rt.notice('The seam-eye wakes over the full mould, and the door to the stair grinds down.', 'eM.lit');
    if (id === 'bH') rt.notice('The hot moon settles in the mould’s mouth and the mould takes its heat. Over the channel the bridge’s stones come up out of the iron.', 'bH.lit');
    if (id === 'bG') rt.notice('The founders’ moon rolls into the great cradle glowing, and the cradle takes it. The Founders’ Door sinks.', 'bG.lit');
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
        rt.notice('The water hisses off its heart: too hot. It won’t stop to look unless its cradle holds a whole moon.', 'lf.hot');
        return false;
      }
      const k = p === 0 ? QUENCH.first : p === 1 ? (cradled() ? QUENCH.cradled : QUENCH.free) : QUENCH.last;
      if (p >= 1 && cradled()) rt.notice('Its pour finds a whole moon in the cradle, and it stops to look. The water takes it full in the heart.', `lf.cradled.${p}`);
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
