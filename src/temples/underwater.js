import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Glass, EchoEar, Dish, Mark, Pit } from './pieces.js';
import { listenerModel } from './guardian-listener.js';

// The Underwater City's temple: the Whale-House, the makers' sounding-house of shell and glass on the sea floor north
// of the Plaza, where the makers talked with the whales: a great whorled shell lying on the bed, brass horns curling
// out of it into the sea. The last glass tube runs from the Plaza to its door. The night the sky rang a light came
// down through the sea singing one note; the whales sang it back and went away, and since then something in the
// house has sung the light's note back at them whenever they come near, calling them off: the Listener, the makers'
// old shell-creature at its bottom, built to hear the whales from far off and answer them. It lives: you calm it.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: THE NOTE CROSSES WHAT YOU
// CANNOT. Your water stops at the glass; a note goes through glass and water, and the makers' dishes carry it on, but
// a dish only carries with a weight on its footstone, and a held note only rings a while. Before the horn the house
// is balls, plates and eyes, and you learn its glass from the wrong side; the whale-horn (src/items.js 'horn') sounds
// ONE fixed note, the deep one, and the house's ears that listen for it answer: the doors it holds only while it
// rings, the ear behind the tank's glass, the ear over the Listener's door that only hears the far dish.
//   the Porch             the first mark, the way out
//   the Sounding Hall     the hub, a long hall under a great hung shell: the west door's cradle (a ball for it); a stone
//                         ball whose groove runs out of the Pool Room across the whole hall to the east door's cradle,
//                         under the lidded eye over the Shell Room's door; the Horn Door on the north wall, two lamps on
//                         its lintel (one eye in each wing); the Listener's Door beside it, its ear high over it beside
//                         a dish's mouth (seen from the first step, opened at the end from elsewhere); the keepers' door
//                         in the north-east corner, shut from this side
//   the Pool Room         the west wing: a drawn pool of the sea behind a glass wall you can't climb; the pool's eye high
//                         on the far wall, splashed over the glass. The stone ball for the east door starts here
//   the Shell Room        the east wing: a great whorled shell; a ball rolled to its plate unlids the shell's eye
//   the Horn Chamber      the makers' chest on a shell pulpit (a riding disc beside it): the WHALE-HORN. A try by the
//                         pulpit: a little horn that answers the deep note, and nothing waits on it. Its way on is open
//   the Song Passage      a room on: the door into the tank hall at its far end stays open only while the horn by the
//                         chamber rings (`hold`): the horn's first lock, where a miss costs nothing (a short run)
//   the Tank Hall         the sea let in behind a wall of glass nine metres tall; the shelf over it, and the ear on the
//                         shelf, seen through the water and far out of the horn's reach. A stone ball rolled onto the
//                         footstone of a dish by the glass wakes it; the horn sounded into it comes out of its twin
//                         on the shelf, the shelf's ear rings, and while it rings brass rungs come out of the glass's
//                         frame and you can climb it (the horn with the push, and the timing: the twist)
//   the Gallery of Horns  over the shelf: the makers' speaking-horns along the wall; its stair goes down to a landing
//                         behind the keepers' door: its eye opens the door onto the hall (the shortcut back), and the
//                         landing's dish, woken by a ball on its footstone, carries the horn's note to its twin high over
//                         the Listener's Door, where the ear hears it (the key decoupled from its lock)
//   the Throat            down from the Listener's Door, a long stair under the house
//   the Listener's Hall   the guardian (organic: its meter is calm). When it stops and spreads its great ear, sound the
//                         horn close by. From its second phase it shuts its ear to anything near it, and only the hall's
//                         dishes reach it: a ball on a dish's footstone, the horn into the dish while its ear is open. As
//                         it shifts into its last it knocks the balls off the footstones: roll one back
// After: the Listener sings the whales' own song again; the lamps in the Whale-House's horns are lit, its seams glow,
// and the whales come back to the glass (src/story/underwater.js draws them in: level.whalesNear).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/**
 * In the Underwater City (src/levels/underwater.js WHALE_HOUSE): on the sea floor north of the Plaza, at the end of the
 * last tube (TUBES.temple), its door at (0, 0, -178) facing south, down the tube toward the Plaza.
 */
export const SITE = { x: 0, z: -192, r: 16, heading: 0, door: -178 };

/**
 * The Whale-House's colours: shell ivory in big smooth panels, a coral course under every frieze and at the foot, the
 * frames brass, a pale sand floor in plates, the fittings brass; the glyphs and the pieces' light the teal of the
 * water-light; a little whorled shell by every frieze glyph. Its shade a sea teal, its light the water's.
 */
export const PALETTE = {
  wall: '#e9dcc2', wall2: '#e2d3b6', wall3: '#efe4cd', floor: '#cdbf9f', floor2: '#c2b493', trim: '#b58a3e', fitting: '#c9973f',
  dark: '#24474f', stone: '#d8e6dc', accent: '#e0806a', glow: '#7fe0d6', glyph: '#5fc4bd', lamp: '#bff0e6', sand: '#d9cfb2', sand2: '#cbbf9f', void: '#163038',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.9, shade: 0.15, lampTint: ['#9fe6dc', 0.6] },
    wall: { mode: 0, grid: 3.2, plates: true },
    floor: { mode: 0, grid: 2.0, plates: true },
    trim: { metal: 'brass' },
    glyph: { glow: 0.55 },
  },
  bands: [{ at: 0.72, h: 0.8, color: '#e0806a' }, { y: 0.5, h: 0.6, color: '#3f8a8a' }],
  ornament: { kind: 'whorl', color: '#f4ead6', color2: '#e0806a' },
  light: { shadow: '#8fb3ac', light: '#f6f1e2', sun: '#e6f2ea' },
};

// the rooms' places (local metres): the hub's middle, the Horn Chamber's, the arena's floor and middle
const HZ = 30, HCX = -13.8, HCZ = 58, AY = -15, AZ = 106, AR = 18;
/** How long the horns hold their note (s): the passage's door, the tank's ear (the rungs). */
export const HOLD = { door: 10, rungs: 16 };
/** How much the horn calms it: close by in its first phase, through a dish in its second, in its last. */
export const CALM = { near: 0.12, dish: 0.11, last: 0.09 };
/** The dishes in the Listener's Hall (their near ends low on the wall, by the footstones). */
export const ARENA_DISHES = ['dishW', 'dishE'];
const LISTEN = 14;   // m: how close to its ear a horn has to be, sounded straight at it

export const LOGIC = {
  id: 'underwater', entry: 'threshold', gadget: 'horn',
  rooms: {
    threshold: { checkpoint: true }, hall: { checkpoint: true }, pools: { checkpoint: true }, shells: { checkpoint: true }, horn: { checkpoint: true },
    tank: { checkpoint: true }, gallery: { checkpoint: true }, ante: { checkpoint: true }, arena: { boss: true }, out: {},
  },
  links: [
    { a: 'threshold', b: 'hall' },
    { a: 'hall', b: 'pools', door: 'd1' },        // the west door: the stone ball in its cradle
    { a: 'hall', b: 'shells', door: 'd2' },       // the east door: its eye, lidded until the pool's ball is in its cradle
    { a: 'hall', b: 'horn', door: 'dH' },         // the Horn Door: an eye in each wing
    { a: 'horn', b: 'tank', door: 'd4' },         // the Song Passage's door, held while its horn rings (a room on from the chest)
    { a: 'hall', b: 'gallery', door: 'dK' },      // the keepers' door: the shortcut back, opened from the landing
    { a: 'tank', b: 'gallery', door: 'rungs' },   // the glass climbed while the shelf's ear rings
    { a: 'hall', b: 'ante', door: 'dL' },         // the Listener's Door: its ear hears only the landing's dish
    { a: 'ante', b: 'arena', door: 'dA' },
    { a: 'arena', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Sounding Hall: the stone ball into the west door's cradle
    b1: { type: 'drum', room: 'hall', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'hall' },
    d1: { type: 'door', opens: { drumOn: ['b1', 'p1'] }, latch: true },
    // the Pool Room's ball, rolled out across the hall into the east door's cradle: the eye over the door unlids
    b2: { type: 'drum', room: 'pools', plate: 'p2', plateAt: 1, start: 0 },
    p2: { type: 'plate', room: 'hall' },
    eD: { type: 'switch', room: 'hall', when: { drumOn: ['b2', 'p2'] } },
    d2: { type: 'door', opens: { lit: 'eD' }, latch: true },
    // the Horn Door: the pool's eye over the glass, and the shell's eye, unlidded by the Shell Room's ball
    eP: { type: 'switch', room: 'pools' },
    bS: { type: 'drum', room: 'shells', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'shells' },
    eS: { type: 'switch', room: 'shells', when: { drumOn: ['bS', 'pS'] } },
    dH: { type: 'door', opens: { all: [{ lit: 'eP' }, { lit: 'eS' }] }, latch: true },
    chest: { type: 'gadget', room: 'horn', item: 'horn' },
    // the try by the pulpit: a little horn that answers the deep note (nothing waits on it)
    eT: { type: 'switch', room: 'horn', needs: ['horn'] },
    // the Song Passage: the door held while its horn rings; the ball whose groove runs under it, to the tank's dish
    e4: { type: 'switch', room: 'horn', needs: ['horn'], hold: HOLD.door },
    d4: { type: 'door', opens: { lit: 'e4' } },
    b5: { type: 'drum', room: 'tank', plate: 'p5', plateAt: 1, start: 0 },
    p5: { type: 'plate', room: 'tank' },
    // the Tank Hall: the shelf's ear, through the dish (awake with the ball on its footstone), held: the glass's rungs
    e5: { type: 'switch', room: 'tank', needs: ['horn'], hold: HOLD.rungs, when: { drumOn: ['b5', 'p5'] } },
    rungs: { type: 'bridge', opens: { lit: 'e5' } },
    // the landing behind the keepers' door: its eye (the way back); its dish, woken by the ball, to the Listener's Door
    eK: { type: 'switch', room: 'gallery' },
    dK: { type: 'door', opens: { lit: 'eK' }, latch: true },
    bL: { type: 'drum', room: 'gallery', plate: 'pL', plateAt: 1, start: 0 },
    pL: { type: 'plate', room: 'gallery' },
    eL: { type: 'switch', room: 'gallery', needs: ['horn'], when: { drumOn: ['bL', 'pL'] } },
    dL: { type: 'door', opens: { lit: 'eL' }, latch: true },
    dA: { type: 'door', opens: null },                                   // the arena's door: shut while the Listener fights
    // the Listener's Hall: a ball on a dish's footstone (its last phase wants one there)
    bW: { type: 'drum', room: 'arena', plate: 'pW', plateAt: 1, start: 0 },
    pW: { type: 'plate', room: 'arena' },
    bE: { type: 'drum', room: 'arena', plate: 'pE', plateAt: 1, start: 0 },
    pE: { type: 'plate', room: 'arena' },
    listener: { type: 'boss', room: 'arena', needs: ['horn'], requires: { any: [{ drumOn: ['bW', 'pW'] }, { drumOn: ['bE', 'pE'] }] } },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const LISTENER = {
  kind: 'organic', name: 'the Listener', final: 'touch', touch: 'lay a hand on its shell', speed: 1.4, wakeTime: 3.2,
  wake: 'At the bottom of the house a great shell heaves up off the floor. A vast ear unfolds from its front, turns to you, and sings one high clear note: the light’s. The walls hum it back.',
  openHint: 'It stops, and the lips of its great ear spread wide. It is listening.',
  weary: 'It sinks down on its foot, its ear wide and slack, humming low. Go to it.',
  resolved: 'The Listener hums the deep note back, long and low, and then a song of its own under it. Out past the glass, far off, something enormous answers.',
  missHint: 'It rolls past you into the wall and lies there uncurling, its ear opening.',
  phases: [
    { to: 0.35, attacks: ['sweep', 'slam', 'pearl'], pause: 1.6, hint: 'When it stops and spreads its ear, sound the whale-horn close to it.' },
    { to: 0.65, attacks: ['song', 'pearls', 'sweep'], pause: 1.3, hint: 'It shuts its ear to anything near it now. Roll a stone onto a dish’s footstone, and sound the horn into the dish while its ear is open.' },
    { to: 0.9, attacks: ['roll', 'pearls', 'slam'], pause: 1.1, hint: 'It knocked the stones off the footstones as it shook. Roll one back, and sound the horn into its dish while the ear is open.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    sweep: { shape: 'cone', range: 9, angle: 0.8, wind: 1.2, track: 0.6, part: 'arms', rig: 'coil', side: 1, damage: 0.75, knock: 10, recover: 0.5, then: 'sweep2' },
    sweep2: { shape: 'cone', range: 9, angle: 0.8, wind: 0.8, track: 0.5, part: 'arms', rig: 'coil', side: -1, link: true, damage: 0.75, knock: 10, gap: 0.2, then: 'call' },
    call: { shape: 'ring', at: 'self', radius: 5, wind: 1.1, part: 'mouth', rig: 'lean', pose: 'song', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 11, recover: 0.9, open: 4.4 },
    slam: { shape: 'ring', at: 'self', radius: 6, wind: 1.3, part: 'core', rig: 'rear', damage: 0.75, knock: 11, recover: 0.8, open: 3.8 },
    pearl: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3, wind: 1.4, track: 0.6, part: 'mouth', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    pearls: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'mouth', rig: 'swell', pose: 'pearl', damage: 0.5, knock: 6, recover: 0.6 },
    song: { shape: 'ring', at: 'self', radius: 5, wind: 1.3, part: 'mouth', rig: 'lean', wave: { speed: 9, reach: 17, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 11, recover: 0.9, open: 4.6 },
    roll: { shape: 'lane', range: 16, width: 4.4, wind: 1.3, track: 0.65, part: 'feet', rig: 'crouch', dash: 10, damage: 1, knock: 12, recover: 1.0, open: 2.6, miss: 3.4 },
  },
};

function listenerHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rocks it on its foot. It isn’t a thing to be pushed: it is a thing to be sung to.', 'ls.push'); return true; }
  g.rt.notice('The water runs off its shell. It isn’t listening for water: it is listening for a note.', 'ls.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const ivory = { paint: new THREE.Color('#f4ead6'), smooth: true, side: THREE.FrontSide };
  const coral = { paint: new THREE.Color('#e0806a'), smooth: true, side: THREE.FrontSide };
  const brass = { paint: new THREE.Color('#c9973f'), smooth: false, side: THREE.FrontSide };
  const water = makeMaterial({ color: '#3f9aa6', glow: 0.35, flat: true, key: 'temple.underwater.water' });
  const deepM = makeMaterial({ color: '#2a6f86', glow: 0.25, flat: true, key: 'temple.underwater.deep' });
  /** A groove: a dark strip with brass rails (drawn). */
  const groove = (a, b, w = 1.0) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2, y = Math.min(a[1], b[1]);
    K.add(M.dark, T(new THREE.BoxGeometry(w, 0.04, L), [cx, y + 0.02, cz], [0, yaw, 0]));
    for (const s of [-1, 1]) K.add(brass, T(new THREE.BoxGeometry(0.14, 0.08, L), [cx + Math.cos(yaw) * s * (w / 2 + 0.1), y + 0.04, cz - Math.sin(yaw) * s * (w / 2 + 0.1)], [0, yaw, 0]));
  };
  /** A whorled shell (drawn, or solid): chambers of ivory along a rising helix, coral bands. */
  const whorl = (x, y, z, s, solid = false, n = 9) => {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), a = i * 1.2, r = s * (1 - k * 0.8), rad = s * 0.55 * (1 - k * 0.7);
      const g = new THREE.SphereGeometry(r, 12, 8).scale(1, 0.82, 1).translate(x + Math.sin(a) * rad, y + r * 0.7 + k * s * 2.4, z + Math.cos(a) * rad);
      if (solid && i < 3) K.both(i % 2 ? ivory : M.wall, g); else K.add(i % 2 ? ivory : M.wall, g);
      if (i % 2 === 0 && i < n - 2) K.add(coral, T(new THREE.TorusGeometry(r * 0.99, 0.06 * s, 3, 20), [x + Math.sin(a) * rad, y + r * 0.7 + k * s * 2.4, z + Math.cos(a) * rad], [Math.PI / 2 + 0.25, 0, a * 0.2]));
    }
  };
  /** A corridor's sides and lintel between two walls (along z at x, from z0 to z1, floor y). */
  const throughZ = (x, z0, z1, y = 0, w = 5, h = 6.4) => {
    K.slab(x - w / 2 - 0.7, z0, x + w / 2 + 0.7, z1, y, 0.8);
    K.wall(x - w / 2 - 0.4, z0, x - w / 2 - 0.4, z1, y, h, { t: 0.8 }); K.wall(x + w / 2 + 0.4, z1, x + w / 2 + 0.4, z0, y, h, { t: 0.8 });
    K.both(M.wall, box(w + 1.6, 0.8, z1 - z0, x, y + h + 0.4, (z0 + z1) / 2));
  };
  const throughX = (z, x0, x1, y = 0, w = 5, h = 6.4) => {
    K.slab(x0, z - w / 2 - 0.7, x1, z + w / 2 + 0.7, y, 0.8);
    K.wall(x0, z - w / 2 - 0.4, x1, z - w / 2 - 0.4, y, h, { t: 0.8 }); K.wall(x1, z + w / 2 + 0.4, x0, z + w / 2 + 0.4, y, h, { t: 0.8 });
    K.both(M.wall, box(x1 - x0, 0.8, w + 1.6, (x0 + x1) / 2, y + h + 0.4, z));
  };

  // ---- the Porch (z 0..12.8)
  K.hall({ x: 0, z: 6.4, w: 14, d: 12.8, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  for (const s of [-1, 1]) whorl(s * 5.2, 0, 8.5, 0.7, true, 6);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 4], yaw: Math.PI / 2 });

  // ---- the Sounding Hall (x -18..18, z 14..46): the hub
  K.hall({ x: 0, z: HZ, w: 36, d: 32, y: 0, h: 20, roof: true, doors: [
    { side: 's', w: 6, h: 7 }, { side: 'w', w: 5, h: 6.4 }, { side: 'e', w: 5, h: 6.4 },
    { side: 'n', at: HCX, w: 5, h: 6.4 }, { side: 'n', at: 0, w: 5, h: 6.4 }, { side: 'n', at: 13, w: 5, h: 6.4 },
  ] });
  // the great shell hung from the roof (drawn), on brass chains; a whale's spiral inlaid in the floor under it
  whorl(0, 11.5, HZ - 1, 2.6, false, 9);
  for (const a of [0.4, 2.5, 4.6]) K.add(brass, T(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), [Math.sin(a) * 2.0, 17.4, HZ - 1 + Math.cos(a) * 2.0]));
  K.add(M.dark, T(annulus(5.2, 5.6, 0.04, 48), [0, 0.03, HZ]));
  K.add(coral, T(annulus(6.6, 6.8, 0.04, 48), [0, 0.035, HZ]));
  // the west door's cradle and its ball
  groove([-5, 0, 22], [-14, 0, 22]);
  add(Ball, { id: 'b1', a: [-5, 0.04, 22], b: [-14, 0.04, 22], r: 1.0, lock: true });
  add(Plate, { id: 'p1', at: [-14, 0, 22], r: 1.2 });
  add(Door, { id: 'd1', at: [-18.6, 0, HZ], yaw: Math.PI / 2, w: 5, h: 6.4, lamps: [{ drumOn: ['b1', 'p1'] }] });
  // the long groove: from the Pool Room across the whole hall to the east door's cradle; the lidded eye over that door
  groove([-28, 0, HZ], [14, 0, HZ]);
  add(Ball, { id: 'b2', a: [-28, 0.04, HZ], b: [14, 0.04, HZ], r: 1.0, friction: 0.9, lock: true });
  add(Plate, { id: 'p2', at: [14, 0, HZ], r: 1.2 });
  add(Switch, { id: 'eD', at: [17.95, 8.0, HZ], yaw: -Math.PI / 2, size: 1.1, lids: true, wrong: 'The eye over the east door stays lidded. Its cradle below it is empty.' });
  add(Door, { id: 'd2', at: [18.6, 0, HZ], yaw: Math.PI / 2, w: 5, h: 6.4, lamps: [{ lit: 'eD' }] });
  // the Horn Door: a lamp for each wing's eye
  add(Door, { id: 'dH', at: [HCX, 0, 46.6], w: 5, h: 6.4, lamps: [{ lit: 'eP' }, { lit: 'eS' }] });
  // the Listener's Door, and over it its ear beside the mouth of a dish (the landing's twin)
  add(Door, { id: 'dL', at: [0, 0, 46.6], w: 5, h: 6.4, lamps: [{ lit: 'eL' }] });
  K.both(brass, box(3.2, 0.3, 1.0, 0, 9.0, 45.5));   // (the ear's bracket)
  // the keepers' door, shut from this side
  add(Door, { id: 'dK', at: [13, 0, 46.6], w: 5, h: 6.4, lamps: [{ lit: 'eK' }] });
  K.glyph([0, 14, 45.95], 2.0, Math.PI);
  add(Mark, { room: 'hall', at: [-8, 0, 17.5], yaw: Math.PI * 0.25 });

  // ---- the Pool Room (the west wing, x -43.2..-22): the sea behind a glass wall; the pool's eye over it
  throughX(HZ, -21.4, -18.6);
  K.hall({ x: -32.6, z: HZ, w: 21.2, d: 20, y: 0, h: 12, roof: true, doors: [{ side: 'e', w: 5, h: 6.4 }] });
  K.add(water, box(9.4, 0.1, 19.6, -38.5, 0.08, HZ));
  K.add(deepM, box(9.4, 3.6, 0.1, -38.5, 1.9, HZ - 9.75));
  K.solid(box(0.3, 4.2, 20, -33.8, 2.1, HZ));
  add(Glass, { at: [-33.75, 0, HZ], yaw: Math.PI / 2, w: 19.6, h: 4.2, color: '#bfe4e6', slip: 'The glass is too smooth to hold, and the sea is on the other side of it.' });
  add(Switch, { id: 'eP', at: [-43.1, 6.6, HZ], yaw: Math.PI / 2, size: 1.2 });
  // shelves of shells along the north wall (drawn)
  for (let i = 0; i < 4; i++) { K.both(brass, box(1.6, 0.15, 0.6, -30 + i * 2.2, 2.2, HZ + 9.6)); whorl(-30 + i * 2.2, 2.3, HZ + 9.6, 0.32, false, 5); }
  add(Mark, { room: 'pools', at: [-26, 0, HZ - 6.5], yaw: Math.PI / 2 });

  // ---- the Shell Room (the east wing, x 22..43.2): a great whorled shell; a ball to its plate unlids the shell's eye
  throughX(HZ, 18.6, 21.4);
  K.hall({ x: 32.6, z: HZ, w: 21.2, d: 20, y: 0, h: 14, roof: true, doors: [{ side: 'w', w: 5, h: 6.4 }] });
  whorl(34, 0, HZ - 3.5, 2.4, true, 9);
  groove([25.5, 0, HZ + 6.5], [39.5, 0, HZ + 6.5]);
  add(Ball, { id: 'bS', a: [25.5, 0.04, HZ + 6.5], b: [39.5, 0.04, HZ + 6.5], r: 1.0, lock: true });
  add(Plate, { id: 'pS', at: [39.5, 0, HZ + 6.5], r: 1.2 });
  add(Switch, { id: 'eS', at: [43.1, 5.6, HZ], yaw: -Math.PI / 2, size: 1.2, lids: true, wrong: 'The shell’s eye stays lidded. Its plate by the wall is bare.' });
  add(Mark, { room: 'shells', at: [25.5, 0, HZ - 6], yaw: -Math.PI / 2 });

  // ---- the Horn Chamber (a rotunda round (HCX, HCZ)): the chest on a shell pulpit, a riding disc beside it; the try
  throughZ(HCX, 47.2, 49.8);
  K.rotunda({ x: HCX, z: HCZ, y: 0, r: 8.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0 });
  const PT = 3.0;   // the pulpit's top
  K.both(M.wall, lathe([[2.4, 0], [2.0, 0.6], [1.5, PT - 0.6], [2.3, PT - 0.15], [2.3, PT], [0.01, PT]], 20).translate(HCX, 0, HCZ), new THREE.CylinderGeometry(2.2, 2.3, PT, 20).translate(HCX, PT / 2, HCZ));
  K.add(coral, T(new THREE.TorusGeometry(2.25, 0.1, 4, 28), [HCX, PT - 0.1, HCZ], [Math.PI / 2, 0, 0]));
  add(Platform, { path: [[HCX + 4.4, 0.3, HCZ], [HCX + 4.4, PT, HCZ]], r: 1.7, speed: 1.2, pause: 1.6 });
  K.add(M.dark, T(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 24), [HCX + 4.4, 0.04, HCZ]));
  add(EchoEar, { id: 'eT', note: 'deep', at: [HCX - 5.2, 0, HCZ + 2.2], yaw: Math.PI / 2 + 0.4, stand: 1.8, size: 0.8, reach: 6,
    heard: 'The little horn by the pulpit takes the deep note and hums it back. The whorls round the chamber’s wall glow a moment. Nothing opens: it only answers.' });
  for (const a of [0.9, 2.2, 4.1, 5.4]) whorl(HCX + Math.sin(a) * 7.4, 0, HCZ + Math.cos(a) * 7.4, 0.55, false, 6);
  add(Mark, { room: 'horn', at: [HCX + 5, 0, HCZ - 4.5], yaw: -Math.PI * 0.75 });

  // ---- the Song Passage (x HCX ± 5, z 66..76.4), a room on: the door held while its horn rings; the ball under it
  K.hall({ x: HCX, z: 71.2, w: 10, d: 10.4, y: 0, h: 8, roof: true, omit: ['n', 's'] });
  add(EchoEar, { id: 'e4', note: 'deep', at: [HCX - 3.6, 0, 67.8], yaw: 0.35, stand: 2.2, reach: 6,
    heard: 'The horn by the passage takes the deep note and holds it, and at the far end the door sinks, as long as it rings.',
    fading: 'The passage horn’s note is fading: the door will rise.' });
  add(Door, { id: 'd4', at: [HCX, 0, 76.6], w: 5, h: 6.4, lamps: [{ lit: 'e4' }] });
  for (const s of [-1, 1]) whorl(HCX + s * 4.0, 0, 73.5, 0.45, false, 5);

  // ---- the Tank Hall (x -30..3, z 77.2..101.2): the sea let in behind nine metres of glass; the shelf over it
  const TX0 = -30, TX1 = 3, TZ = 89.2, GW = -8, GE = -2, SH = 9;
  K.hall({ x: (TX0 + TX1) / 2, z: TZ, w: TX1 - TX0, d: 24, y: 0, h: 22, roof: true, doors: [{ side: 's', at: HCX - (TX0 + TX1) / 2, w: 5, h: 6.4 }, { side: 'e', at: 3.8, y0: SH, w: 5, h: 6.4 }] });
  K.add(water, box(GE - GW - 0.2, SH - 0.4, 23.8, (GW + GE) / 2, (SH - 0.4) / 2, TZ));
  K.solid(box(0.3, SH, 24, GW, SH / 2, TZ));
  add(Glass, { id: 'rungs', at: [GW - 0.05, 0, TZ], yaw: -Math.PI / 2, w: 23.6, h: SH, color: '#bfe4e6', rungs: true, when: { lit: 'e5' },
    slip: 'The tank’s glass is too smooth to hold. Its brass frame has slots all the way up, empty.' });
  K.both(brass, box(GE - GW + 0.2, 0.3, 24, (GW + GE) / 2, SH - 0.15, TZ));   // (the tank's lid: a brass grating)
  K.both(M.wall, box(TX1 - GE, SH - 0.8, 24, (GE + TX1) / 2, (SH - 0.8) / 2, TZ));   // (under the shelf: solid)
  K.slab(GE, 77.2, TX1, 101.2, SH, 0.8);
  // a whale drawn in the tank's water, in the makers' brass line (the house's sign)
  K.add(deepM, T(new THREE.SphereGeometry(1, 14, 8).scale(0.6, 1.4, 6), [(GW + GE) / 2, 4.2, TZ + 1]));
  K.add(deepM, T(new THREE.BoxGeometry(0.3, 0.5, 3.2), [(GW + GE) / 2, 4.2, TZ - 6.6], [0, 0, 0]));
  // the ball, its footstone and the near dish by the glass; its twin on the shelf beside the shelf's ear
  groove([-26, 0, 84], [-13, 0, 84]);
  add(Ball, { id: 'b5', a: [-26, 0.04, 84], b: [-13, 0.04, 84], r: 1.0, lock: true });
  add(Plate, { id: 'p5', at: [-13, 0, 84], r: 1.2 });
  add(Dish, { id: 'dishT', at: [-15.6, 3.0, 87.2], yaw: Math.PI / 2, tilt: 0.1, r: 2.2, when: { drumOn: ['b5', 'p5'] },
    to: { at: [0.6, SH + 2.6, 86], yaw: -Math.PI / 2, tilt: 0.1, r: 2.2 },
    dark: 'The dish by the glass is dark and deaf: its footstone is bare. Something heavy has to stand on it.' });
  add(EchoEar, { id: 'e5', note: 'deep', at: [1.4, SH, 90.4], yaw: -Math.PI / 2, stand: 2.4, size: 1.2, reach: 7,
    heard: 'Across the water the far dish says the deep note, and the shelf’s ear takes it and holds it. Brass rungs slide out of the glass’s frame, as long as it rings.',
    fading: 'The shelf’s ear is fading: the rungs will slide back.' });
  add(Mark, { room: 'tank', at: [-22, 0, 79.6], yaw: Math.PI / 2 });
  for (const [x, z] of [[-28.5, 84], [-28.5, 95]]) whorl(x, 0, z, 0.8, true, 6);

  // ---- the Gallery of Horns (x 4.8..20.8, z 78..98, floor 9): the makers' speaking-horns
  K.slab(2.5, 90.5, 5.5, 95.5, SH, 0.8);
  K.hall({ x: 12.8, z: 88, w: 16, d: 20, y: SH, h: 9, roof: true, doors: [{ side: 'w', at: 5, w: 5, h: 6.4 }, { side: 's', at: 0.2, w: 5, h: 6.4 }] });
  for (let i = 0; i < 4; i++) {
    const z = 81.5 + i * 4.4;
    K.both(brass, T(new THREE.CylinderGeometry(0.18, 0.24, 2.4, 8), [19.6, SH + 1.2, z]));
    K.add(brass, T(lathe([[0.15, 0], [0.3, 0.7], [0.7, 1.3], [1.3, 1.6], [1.35, 1.65]], 14).rotateZ(Math.PI / 2), [19.9, SH + 2.9, z]));
  }
  K.add(deepM, box(8, 4, 0.1, 12.8, SH + 4, 97.35));   // (a window of the sea in the north wall)
  for (let i = 0; i <= 4; i++) K.add(M.trim, box(0.14, 4.2, 0.2, 8.8 + i * 2, SH + 4, 97.3));
  add(Mark, { room: 'gallery', at: [8, SH, 84], yaw: Math.PI / 2 });

  // ---- the keepers' stair and landing (x 10.4..15.6): down to the keepers' door; the eye; the landing's dish and ball
  K.stairs([13, 0, 58], [13, SH, 77.2], 4.6, { sides: false });
  K.slab(10.4, 47.2, 15.6, 58, 0, 0.8);
  K.wall(10.2, 47.2, 10.2, 77.6, 0, 17.4, { t: 0.8 }); K.wall(15.8, 77.6, 15.8, 47.2, 0, 17.4, { t: 0.8 });
  K.slab(10.2, 47.2, 15.8, 58, 7.8, 0.8);
  K.ramp([13, 7.8, 58], [13, 17.4, 77.2], 6.4, { t: 0.8 });
  add(Switch, { id: 'eK', at: [15.35, 3.4, 49.6], yaw: -Math.PI / 2, size: 1.0 });
  groove([11.8, 0, 56.6], [11.8, 0, 50.6]);
  add(Ball, { id: 'bL', a: [11.8, 0.04, 56.6], b: [11.8, 0.04, 50.6], r: 0.9, lock: true });
  add(Plate, { id: 'pL', at: [11.8, 0, 50.6], r: 1.1 });
  add(Dish, { id: 'dishL', at: [10.75, 3.0, 53.2], yaw: Math.PI / 2, tilt: 0.15, r: 1.8, when: { drumOn: ['bL', 'pL'] },
    to: { at: [4.2, 10.4, 45.1], yaw: Math.PI, tilt: 0.35, r: 2.0 },
    dark: 'The landing’s dish is dark and deaf: its footstone is bare.' });
  add(EchoEar, { id: 'eL', note: 'deep', lintel: true, at: [0, 9.6, 45.6], yaw: Math.PI, size: 1.3, reach: 6,
    heard: 'Over the Listener’s Door the far dish says the deep note, and the ear beside it answers. The door sinks.' });
  add(Mark, { room: 'gallery', at: [13, 0, 55.5], yaw: Math.PI });

  // ---- the Throat: from the Listener's Door down a long stair under the house to its hall
  K.slab(-3.2, 47.2, 3.2, 50, 0, 0.8);
  K.stairs([0, 0, 50], [0, AY, 76], 5, { sides: false });
  K.slab(-3.2, 76, 3.2, 87.4, AY, 0.8);
  for (const [z0, z1, y0, y1] of [[47.2, 50, 0, 7.4], [50, 63, -7.6, 7.4], [63, 75.5, AY, 0], [75.5, 87.4, AY, -7.0]]) {
    K.wall(-3.6, z0, -3.6, z1, y0, y1 - y0, { t: 0.8 }); K.wall(3.6, z1, 3.6, z0, y0, y1 - y0, { t: 0.8 });
  }
  K.slab(-4, 47.2, 4, 50, 7.8, 0.8);
  K.ramp([0, 7.8, 50], [0, -7.2, 76], 8, { t: 0.8 });
  K.slab(-4, 75.5, 4, 87.4, -6.6, 0.8);
  for (let z = 54; z < 74; z += 6) for (const s of [-1, 1]) whorl(s * 2.6, AY + (76 - z) / 26 * 15 + 0.3 - 0.3, z, 0.3, false, 5);
  add(Mark, { room: 'ante', at: [1.8, AY, 80], yaw: -Math.PI / 2 });
  add(Door, { id: 'dA', at: [0, AY, AZ - AR - 0.7], w: 5, h: 6 });

  // ---- the Listener's Hall (a rotunda round (0, AY, AZ)): its pool, the dishes on the wall, their footstones and balls
  K.rotunda({ x: 0, z: AZ, y: AY, r: AR, h: 12, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0 });
  K.add(water, T(new THREE.CylinderGeometry(6.5, 6.5, 0.06, 40), [0, AY + 0.04, AZ + 4]));
  K.add(coral, T(annulus(6.5, 7.0, 0.08, 48), [0, AY + 0.06, AZ + 4]));
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'W' : 'E';
    groove([s * 8.5, AY, AZ + 4], [s * 14.6, AY, AZ + 4]);
    add(Ball, { id: `b${id}`, a: [s * 8.5, AY + 0.04, AZ + 4], b: [s * 14.6, AY + 0.04, AZ + 4], r: 1.0, friction: 1.2 });
    add(Plate, { id: `p${id}`, at: [s * 14.6, AY, AZ + 4], r: 1.2 });
    add(Dish, { id: `dish${id}`, at: [s * 16.9, AY + 2.8, AZ + 4], yaw: s < 0 ? Math.PI / 2 : -Math.PI / 2, tilt: 0.1, r: 1.8, when: { drumOn: [`b${id}`, `p${id}`] },
      to: { at: [s * 6, AY + 8.6, AZ + AR - 1.4], yaw: Math.PI, tilt: 0.45, r: 2.2 },
      dark: 'The dish on the wall is dark and deaf: its footstone is bare.' });
  }
  for (const a of [0.6, 2.3, 3.9, 5.6]) whorl(Math.sin(a) * (AR - 2), AY, AZ + Math.cos(a) * (AR - 2), 1.0, true, 6);
  add(Door, { id: 'd5', at: [0, AY, AZ + AR + 0.7], w: 5, h: 6 });
  const E0 = AZ + AR + 0.6, E1 = AZ + AR + 10;
  K.slab(-3.2, E0, 3.2, E1, AY, 0.8);
  K.wall(-3.2, E0 + 0.8, -3.2, E1, AY, 7, { t: 0.8 }); K.wall(3.2, E1, 3.2, E0 + 0.8, AY, 7, { t: 0.8 });
  K.wall(3.2, E1, -3.2, E1, AY, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, AY + 7.4, E0 + 5.1));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, AY, E1 + 0.5]));
  K.solid(box(4, 5, 0.1, 0, AY + 2.5, E1 + 0.5));

  const model = listenerModel();
  model.pos.copy(K.world(0, AY, AZ + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, AY, AZ + 8);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, AY, AZ), r: AR, y: K.world(0, AY, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-46, AY - 4, -3), V(46, 30, E1 + 2)),
    gadget: { at: W(HCX, PT, HCZ).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, AY + 0.5, E1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 12, HZ, 26], [0, 4, 40, 14], [-32, 7, HZ, 16], [32, 8, HZ, 16], [HCX, 8, HCZ, 14], [HCX, 5, 71, 10], [-18, 10, TZ, 22], [-1, 13, TZ, 14],
      [12.8, 14, 88, 16], [13, 6, 60, 14], [0, -4, 64, 14], [0, AY + 4, 82, 12], [0, AY + 7, AZ, 28]],
    guardian: { def: { ...LISTENER, onHit: listenerHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the sounding-house on the sea floor
function exterior(scene, level, rt) {
  const K = new TempleKit(rt.root, 'The Whale-House', V(SITE.x, 0, SITE.z), 0, rt.M);
  const M = rt.M;
  const ivory = { paint: new THREE.Color('#efe2c8'), smooth: true, side: THREE.FrontSide };
  const pale = { paint: new THREE.Color('#f7eedc'), smooth: true, side: THREE.FrontSide };
  const coral = { paint: new THREE.Color('#e0806a'), smooth: true, side: THREE.FrontSide };
  const teal = { paint: new THREE.Color('#3f8a8a'), smooth: false, side: THREE.FrontSide };
  const brass = { paint: new THREE.Color('#c9973f'), smooth: false, side: THREE.FrontSide };
  const dark = { paint: new THREE.Color('#1f3d44'), smooth: false, side: THREE.DoubleSide };
  const DZ = SITE.door - SITE.z, FZ = DZ - 0.3;   // the door (local z 14) and the facade's face (13.7: it seals the tube's end)
  // the facade: a flat wall of shell across the tube's end, 20 m wide and 11 tall, the doorway in it; a coral arch round
  // the doorway, brass studs, the glyph over it; a teal course at its foot
  K.wall(-10, FZ - 0.6, 10, FZ - 0.6, -0.8, 10.4, { t: 1.2, holes: [{ at: 10, w: 4.4, h: 7.0, y0: 0.8 }] });
  K.both(teal, box(20.4, 1.0, 1.5, 0, -0.3, FZ - 0.6));
  K.add(coral, T(new THREE.TorusGeometry(2.9, 0.42, 6, 28, Math.PI), [0, 4.6, FZ + 0.1]));
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; K.add(brass, T(new THREE.SphereGeometry(0.13, 6, 4), [Math.cos(a) * 2.9, 4.6 + Math.sin(a) * 2.9, FZ + 0.45])); }
  K.add(M.glyph, T(glyphGeometry(1.6, 0.14), [0, 8.4, FZ + 0.06]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.4, 6.6).translate(0, 3.3, 0), [0, 0, FZ - 0.9]));
  K.solid(box(4.4, 6.6, 0.1, 0, 3.3, FZ - 0.9));
  // the shell itself: a great body of ivory lying on the bed behind the facade, its whorl rising to a spire 30 m up
  K.both(ivory, new THREE.SphereGeometry(1, 28, 16).scale(14, 11, 15).translate(0, 5, -3));
  K.add(coral, new THREE.TorusGeometry(1, 0.02, 4, 48).rotateX(Math.PI / 2).scale(14.1, 1, 15.1).translate(0, 7, -3));
  K.add(coral, new THREE.TorusGeometry(1, 0.02, 4, 48).rotateX(Math.PI / 2).scale(12.0, 1, 12.9).translate(0, 11, -3));
  for (let i = 0; i < 12; i++) {
    const k = i / 11, a = i * 1.1, r = 9 * (1 - k * 0.82), rad = 5.5 * (1 - k * 0.75);
    const p = [Math.sin(a) * rad, 12 + k * 20, -5 + Math.cos(a) * rad - k * 3];
    K.add(i % 2 ? ivory : pale, new THREE.SphereGeometry(r, 18, 10).scale(1, 0.8, 1).translate(...p));
    if (i % 2 === 0 && i < 10) K.add(coral, T(new THREE.TorusGeometry(r * 0.99, 0.12 + 0.2 * (1 - k), 4, 28), p, [Math.PI / 2 + 0.25, 0, a * 0.2]));
  }
  K.add(coral, new THREE.ConeGeometry(1.0, 4.0, 10).translate(0, 34.5, -8));
  // the ear to the deep: a conch's mouth at its back, facing north, dark inside, ringed in coral
  K.add(ivory, T(lathe([[1.5, 0], [2.4, 1.6], [4.2, 3.0], [6.0, 3.7], [6.3, 3.9]], 24).rotateX(-Math.PI / 2), [0, 6, -17]));
  K.add(dark, T(new THREE.CircleGeometry(5.6, 24), [0, 6, -20.2], [0, Math.PI, 0]));
  K.add(coral, T(new THREE.TorusGeometry(6.2, 0.35, 5, 32), [0, 6, -20.9]));
  // two great brass horns curling out of its sides, up and out into the sea: lamps in their mouths (the change lights them)
  const mouths = [];
  for (const s of [-1, 1]) {
    const pts = [V(s * 9, 8, -3), V(s * 14, 11, -2), V(s * 17.5, 16, 1), V(s * 19, 21, 3)];
    K.add(brass, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.9, 10));
    const end = pts[3], dir = end.clone().sub(pts[2]).normalize();
    const bell = lathe([[0.9, 0], [1.3, 1.0], [2.2, 2.0], [3.4, 2.6], [3.6, 2.7]], 20);
    bell.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir)).translate(end.x, end.y, end.z);
    K.add(brass, bell);
    const m = end.clone().addScaledVector(dir, 2.3);
    mouths.push({ at: m, dir });
  }
  // a row of round windows along the shell's lowest seam (lit by the change too)
  const ports = [];
  for (let i = 0; i < 10; i++) { const s = i < 5 ? -1 : 1, a = 1.0 + (i % 5) * 0.4; ports.push(V(s * Math.sin(a) * 13.95, 7, -3 + Math.cos(a) * 14.95)); }
  // coral rocks and kelp-coloured knobs round its foot (drawn)
  for (const [x, z, r] of [[-12, 8, 1.6], [12.5, 7, 1.3], [-15, -6, 2.0], [15.5, -9, 1.7], [-6, -17, 1.4], [8, -16, 1.9]]) K.add(coral, new THREE.SphereGeometry(r, 9, 6).scale(1, 0.6, 1).translate(x, -0.4, z));
  // Anselme's bench, inside the tube by the door
  K.both(teal, box(0.6, 0.45, 1.8, 3.9, 0.22, DZ + 4.5));
  K.flush();

  // the lamps: in the horns' mouths, at the windows along the seam, and two over the door (the change lights them)
  const glowM = makeMaterial({ color: '#ffd98a', glow: 0.12, flat: true, key: 'temple.underwater.lamps' });
  const lamps = [];
  for (const m of mouths) lamps.push(new THREE.CircleGeometry(3.0, 20).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), m.dir.clone().negate())).translate(m.at.x, m.at.y, m.at.z));
  for (const p of ports) lamps.push(new THREE.SphereGeometry(0.55, 8, 6).translate(p.x, p.y, p.z));
  for (const s of [-1, 1]) lamps.push(new THREE.SphereGeometry(0.4, 8, 6).translate(s * 4.6, 7.6, FZ + 0.4));
  const lm = new THREE.Mesh(mergeAll(lamps), glowM);
  lm.position.copy(K.world(0, 0, 0));
  lm.userData.noCollide = true; lm.userData.dynamic = true;
  rt.root.add(lm);
  return { door: { at: K.world(0, 0, DZ), heading: 0 }, kit: K, glowM, clear: [{ x: SITE.x, z: SITE.z - 2, r: 24 }] };
}

function mergeAll(list) {
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const q0 of list) { const q = q0.index ? q0.toNonIndexed() : q0; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ the world change: the house sings the whales' song
/**
 * Once the Listener is calmed the lamps in the Whale-House's horns and along its seam are lit, warm and steady (until
 * then they only pulse, faintly, with the light's note); the whales come back to the glass (src/story/underwater.js:
 * level.whalesNear).
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The Whale-House’s lamps (the world change)';
  rt.root.add(root);
  root.visible = false;
  let k = 0, want = 0;
  return {
    root,
    get on() { return want === 1; },
    get k() { return k; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; root.visible = k > 0.01; } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); root.visible = k > 0.01; }
      const O = rt.outside;
      if (!O) return;
      const before = 0.08 + 0.12 * Math.max(0, Math.sin(t * 2.3));   // (the light's note, pulsing in the glass)
      O.glowM.uniforms.uGlow.value = before * (1 - k) + k * (0.75 + 0.08 * Math.sin(t * 0.9));
    },
  };
}

export const UNDERWATER_TEMPLE = {
  id: 'underwater', levelId: 'underwater', name: 'The Whale-House', doorLabel: 'door of the Whale-House',
  gadget: 'horn', gadgetBox: 'underwater.temple.horn', arenaDoor: 'dA',
  origin: [0, 1600, -150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'anselme', out: 7, side: 1.2 },
  enterLine: 'Inside the Whale-House it is dry and cool and smells of brass and salt. The walls hum one high note, very softly: not a whale’s.',
  pitLine: 'You climb back up, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the lamps in the Whale-House’s horns are lit, and through the glass the whales are coming back.', 'resolved.out'); },
  onLit(rt, id) {
    if (id === 'eD') rt.notice('The eye over the east door wakes, and the door to the Shell Room sinks.', 'eD.lit');
    if (id === 'eP' || id === 'eS') rt.notice(rt.logic.isLit('eP') && rt.logic.isLit('eS') ? 'Both lamps on the Horn Door are lit, and it sinks.' : 'One lamp on the Horn Door lights. One to go.', `dH.${id}`);
  },
  // the Listener's ear: in its first phase it hears the horn close by while it listens; from its second it shuts its
  // ear to anything near it and only the hall's dishes reach it (a ball on a footstone wakes a dish); shifting into its
  // last it knocks the balls off the footstones
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const homed = () => ['W', 'E'].some((s) => rt.logic.drumOn(`b${s}`, `p${s}`));
    rt.listenerHomed = homed;
    const byDish = (pos) => ARENA_DISHES.some((id) => { const d = rt.piece(id); return d && pos.distanceTo(d.ends[0].mouth) <= d.reach; });
    rt.offs.push(rt.game.on('echo', ({ pos, note, relayed, via } = {}) => {
      if (!pos || !G.awake || G.state === 'weary') return;
      const dished = !!relayed && ARENA_DISHES.includes(via);
      if (!dished && pos.distanceTo(G.model.mouth) > LISTEN) return;
      if (note !== 'deep') { rt.notice('It hears the note and shakes its shell. That isn’t the whales’ note.', 'ls.wrong'); return; }
      if (!dished && G.phaseIndex >= 1) {
        if (!byDish(pos)) rt.notice('Its lips fold shut over its ear as the note reaches it: it won’t hear anything close now. It listens to the house’s dishes.', 'ls.near');
        return;
      }
      if (G.state !== 'open') { rt.notice(G.phaseIndex >= 1 ? 'The dish carries the note to it, but its ear is folded shut. Wait for it to stop and listen.' : 'It hears you, but its ear is folded shut. Wait for it to stop and listen.', G.phaseIndex >= 1 ? 'ls.shut2' : 'ls.shut'); return; }
      const k = G.phaseIndex === 0 ? CALM.near : G.phaseIndex === 1 ? CALM.dish : CALM.last;
      G.add(k, 'horn');
      rt.rumble?.(0.5, 0.4);
      if (dished) rt.notice('The note comes down out of the high dish into its open ear, and it goes still, listening.', `ls.dish.${G.phaseIndex}`);
      else rt.notice('The deep note goes into its open ear. It shivers, and for a moment it hums the note back.', 'ls.near.ok');
      if (G.state === 'open') { G.enter('fight'); G.cool = 1.8; }
    }));
    let lastPhase = G.phaseIndex;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.phaseIndex !== lastPhase) {
        lastPhase = G.phaseIndex;
        if (G.phaseIndex === 2 && homed()) {
          for (const s of ['W', 'E']) {
            const b = rt.piece(`b${s}`);
            if (b && rt.logic.drumOn(`b${s}`, `p${s}`)) { b.t = 0.15; b.v = 0; b.rest = true; b.place(); rt.logic.moveDrum(`b${s}`, 0.15); }
          }
          rt.notice('It shakes as it shifts, and the stones roll off the dishes’ footstones.', 'ls.knock');
          rt.rumble?.(0.8, 0.5);
        }
      }
    };
  },
};
