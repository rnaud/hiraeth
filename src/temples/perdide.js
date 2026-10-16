import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, Jaw, Swing, Platform, Plate, Ball, Mark, Pit, Key, Coffer } from './pieces.js';
import { snapperModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { hushHouseSkin } from './skins/hush-house.js';

// Lorn's temple: the Hush-House, a great low dome of violet stone on the cave
// island, crystals of the swamp's groves growing up through it, its door
// looking east over the channel. The makers taught the plants of Lorn not to
// eat in here (the Hush, the swamp people's glyph, three drops over a shut
// mouth, is theirs), and grew the first snapper of all to keep the house: the
// Mother, whom every snapping plant on Lorn is seeded from. The night the sky
// rang the house's crystals went out of tune, and she woke, frightened, and
// has snapped at everything since.
//
// Inside (built far overhead, through its door). The temple's one idea: the makers sang from low to high;
// first with the fluid, then with the stilling mode. (Since v1.77, issue #336, the rooms are shrines: every hall 30 to 36
// m across under 18 m of stone or more, doors 7 by 9, each puzzle in the middle of its room and the one fight in the
// Nursery: ROOMS, DOOR, docs/design/temple-redesign.md.)
//   the Threshold          the first mark, the way out, and the smallest crystal, out on its floor
//   the Choir              three more crystals, each its own height: splash them low to high and the door opens
//                          (out of turn, a crystal rings flat and fades: logic.js `after`). The lowest note is
//                          not in the Choir: it was sung at the door (the Threshold's crystal, a room back)
//   the Bog Well           a riding disc that climbs over dark water, then a wall of roots to climb; the door
//                          at its top wants the eye on the root-wall's face, seen from the disc (not from the top).
//                          (v1.52, issue #23) Beside it on the root-wall's top, a ledge along the well's west wall to a
//                          door of one keyhole, and past it a walk south outside the Choir's west wall at 9 m (v1.77:
//                          the ledge ran round the well over the water before, its door on it)
//   the Stilling Chamber   the makers' chest: the STILLING MODE (src/items.js 'stun'). Its way on is open
//   the Snapping Passage   a room on (the chamber's room in the logic), crystals grown up through its floor: the door
//                          into the gallery is a gate of jaws that snaps, and snaps: a stilling glob stills it, and it
//                          rests open (the stilling mode's first lock, where failing costs a nip). (v1.52) Two more
//                          mouths, a crystal grown through each one's crown, small, middling, the gate's the biggest:
//                          they still only in the Choir's order, low to high, and the gate last (the one you shoot
//                          first rings flat). The smallest mouth keeps a coffer. (v1.77: the two side mouths in two
//                          shrines of stone out on the floor, either side of the way to the gate; in its walls before)
//   the Pendulum Gallery   a narrow bridge over a chasm, three crystal pendulums swinging across it (still
//                          them, one by one, to cross); the far door wants their notes, and a pendulum's note
//                          only takes stilled in turn, low to high, smallest crystal first, as the Choir taught.
//                          They hang out of that order, so the walk across stills them wrong: still them again,
//                          in turn, from the far side (the gadget with the temple's first verb, the order).
//                          Along the east wall a keeper's ledge runs back over the chasm to a shut gate by the
//                          near landing: it opens once the Nursery is won (v1.52; a footstone behind it before),
//                          and then the way back over is a walk, not the pendulums again (a shortcut)
//   the Nursery            (v1.52, west off the far landing, an arena) where the Mother's seedlings were raised: its
//                          door shuts behind you while they snap round its middle among the old seed-beds (since
//                          v1.77 the house's one fight). Won, the small key's cage sinks: for the ledge's door by the
//                          Bog Well, back past the chest (the keeper's ledge is the way back over)
//   the Choir's balcony    (v1.52; along the walk and in through the Choir's west wall, 9 m over its floor: a gallery
//                          down its west side since v1.77, at its north end before) the great key, seen from the
//                          Choir's floor at the start, caged behind a wall across the balcony; a ball in a groove down
//                          the balcony's middle that runs through a snapper's mouth in it to the cage's footstone.
//                          Shut, the mouth spits the ball back; stilled, it opens, but here the frost thaws and it
//                          snaps shut again a few breaths on: still it, roll the ball through before it wakes, and
//                          still it again to walk through yourself. The far door takes the great key
//   the Mother's Hall      the guardian (organic: you calm her): the Mother Snapper, rooted in the middle of a
//                          round hall. Her head lunges, sweeps, spits seed; spent after a lunge it lies on the
//                          floor, agape: a stilling glob in her mouth calms her. Later, still her mid-strike.
//                          Three crystal pendulums swing high over her, out of tune and out of order: stilled in
//                          turn, smallest first, their notes calm her (taught in her second phase; in her last the
//                          cold no longer eases her, only the crystals sung low to high)
// After: the dome flowers, and every snapping plant on Lorn has a ring of the same flowers at its foot.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the cave island, clear of the cave; its door looks east, over the channel to the fireflies' isle. */
export const SITE = { x: -135, z: 105, r: 16, path: [-108, 107] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

/**
 * The Hush-House's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/hush-house):
 * violet stone in cracked beds, its frames and ribs a darker violet, violet-grey flags (no more green floors), olive moss at
 * the walls' foot, little crystals of teal and violet growing under every frieze; its shade a deep violet, its light the
 * dusk's rose.
 */
export const PALETTE = {
  wall: '#6b5b8e', wall2: '#605184', wall3: '#77689b', floor: '#5d5375', floor2: '#53496a', trim: '#554679', fitting: '#9a8cc0',
  dark: '#2a2448', stone: '#7b6d97', accent: '#e0708a', glow: '#a8e6ee', glyph: '#8fe6d6', lamp: '#d6ff9a', sand: '#4f6a5e', sand2: '#5a7a66', void: '#1a1630',
  look: {
    all: { shadeFlat: 0.15, shadeHue: 0.7, shade: 0.22 },
    wall: { cracks: 0.5 },
    floor: { mode: 0, grid: 2.2, plates: true },
    glyph: { glow: 0.6 },
  },
  bands: [{ at: 0.72, h: 1.0, color: '#57497b' }, { y: 0.25, h: 0.5, color: '#6b7340' }],
  ornament: { kind: 'crystal', color: '#9ee8dc', color2: '#b49ae8', glow: 0.6 },
  light: { shadow: '#51468a', light: '#f2dcea', sun: '#ffd0c8' },
};

/**
 * The house's doors (m: issue #336, 5 by 6.4 before, the ledge's 2.9 by 4.4 and the keeper's gate 2.2 by 4.4) and its
 * rooms in the kit's local frame (z into the house), since v1.77: each hall's floor from wall to wall (its walls stand
 * outside it), its floor's height and its ceiling's; the round halls' middles and radii. The upper floor (the root-wall's
 * top, the chamber, the passage, the gallery's landings, the Nursery, the balcony and the Mother's hall) at `UP`, as it
 * was. The Bog Well stands on its water's floor (`y`), its near landing `near` m short of its middle, the root-wall's face
 * `face` m past it; the Pendulum Gallery on its chasm's floor, its landings at `floor` (`near` the near one's depth, `pit`
 * the chasm's). The crystals, the disc's ride, the bridge, the pendulums and the balcony's groove as they were, so every
 * timing and every jump holds.
 */
export const UP = 9;
export const DOOR = { w: 7, h: 9 };
const C2 = 106.4, C3 = C2 + 39.5, A0 = C3 + 21.2, G0 = A0 + 31.2;   // (the halls 1.2 m apart: one wall between them)
export const ROOMS = {
  threshold: { x0: -15, x1: 15, z0: 0, z1: 30, y: 0, top: 18 },
  choir: { x0: -18, x1: 18, z0: 31.2, z1: 85.2, y: 0, top: 27 },
  well: { x: 0, z: C2, r: 18, y: -6, top: 28, near: 7.1, face: 3 },
  stilling: { x: 0, z: C3, r: 17, y: UP, top: 27 },
  snapping: { x0: -15, x1: 15, z0: A0, z1: A0 + 30, y: UP, top: 27 },
  gallery: { x0: -18, x1: 18, z0: G0, z1: G0 + 48, y: -3, floor: UP, top: 30, near: 14, pit: 20 },
  nursery: { x0: -54, x1: -24, z0: G0 + 26, z1: G0 + 56, y: UP, top: 27 },
};
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

/**
 * (v1.52, issue #23) The Nursery, west off the Pendulum Gallery's far landing (an arena; since v1.77 the house's one fight,
 * its keepers round its middle among the seed-beds), and the way to the great key: from the root-wall's top a ledge along
 * the Bog Well's west wall at `UP` (LEDGE, x0..x1 by z0..z1) to the well's west door (`dL`, one keyhole: the Nursery's small
 * key) and the walk south outside the Choir's west wall (WALK: its floor x0..x1 by z0..z1, `h` high; its way in from the
 * well at z `from`, its way out into the Choir at z `to`), in through the wall onto the Choir's balcony, a gallery down
 * its west side (BALCONY: x0..x1 by z0..z1 at `y`), a wall across it at z `wall` with a snapper's mouth on the ball's
 * groove (down the balcony at x `groove`, from z `a` to `b`, the footstone at `b`); the ball rests at `start` along it, the
 * jaws stilled stand open `hold` s; the great key by the parapet at `key`, seen from the Choir's floor. The Snapping
 * Passage's two side mouths (`MOUTHS`: the smallest first), each in a shrine of stone out on its floor (SHRINE: its face
 * `face` m from the passage's middle, its back at `back`, `d` deep along z, `h` high; the niche behind the mouth `deep`).
 */
export const NURSERY = { x: mid(ROOMS.nursery)[0], z: mid(ROOMS.nursery)[1], w: 30, d: 30, zone: { min: [ROOMS.nursery.x0, UP - 1, ROOMS.nursery.z0], max: [ROOMS.nursery.x1, ROOMS.nursery.top, ROOMS.nursery.z1] } };
export const LEDGE = { x0: -18, x1: -10.5, z0: C2 - 4.5, z1: C2 + ROOMS.well.face, y: UP };
export const WALK = { x0: -32, x1: -23, z0: 74, z1: C2 + 5.5, y: UP, h: 11, from: C2, to: 79, door: -20.6 };
export const BALCONY = { x0: -18, x1: -5, z0: 50, z1: 85.2, y: UP, groove: -10, a: 72, b: 56, wall: 59.5, start: 0.6, hold: 10, key: [-6.6, 53] };
export const MOUTHS = [{ id: 'dj1', still: 'j1', side: 'w', z: A0 + 19, crown: 0.7, deep: 4.4 }, { id: 'dj2', still: 'j2', side: 'e', z: A0 + 11, crown: 1.2, deep: 3.0 }];
export const SHRINE = { face: 4.5, back: 10, d: 6, h: 4.6 };
/** The keeper's ledge along the gallery's east wall (x0 to the wall), over the chasm from the far landing to its gate. */
export const KEEPER = { x0: 10.6 };

export const LOGIC = {
  id: 'perdide', entry: 'threshold', gadget: 'stun',
  // (v1.77, issue #336: each room tagged with its kind, and the one fight the Nursery's: src/foes.js places machines only in
  // a fight's room, scripts/temple-design/rules.mjs, tests/temple-rules.test.js)
  rooms: {
    threshold: { checkpoint: true, kind: 'puzzle' }, choir: { checkpoint: true, kind: 'puzzle' }, well: { checkpoint: true, kind: 'puzzle' },
    stilling: { checkpoint: true, kind: 'puzzle' }, gallery: { checkpoint: true, kind: 'puzzle' },
    galleryFar: { checkpoint: true, kind: 'passage' }, nursery: { checkpoint: true, kind: 'combat' }, balcony: { checkpoint: true, kind: 'puzzle' },
    hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'choir' },
    { a: 'choir', b: 'well', door: 'd1' },
    { a: 'well', b: 'stilling', door: 'dw' },
    { a: 'well', b: 'balcony', door: 'dL' },             // the well's west door, along the walk to the Choir's balcony (v1.52): the Nursery's small key
    { a: 'stilling', b: 'gallery', door: 'd2' },         // the Snapping Passage's jaws, a room on from the chest (one room with it)
    { a: 'gallery', b: 'galleryFar', needs: ['stun'] },   // the pendulums: still them to cross
    { a: 'galleryFar', b: 'nursery', door: 'dN' },        // the Nursery, west off the far landing (v1.52): an arena, the small key
    { a: 'galleryFar', b: 'hall', door: 'd3' },
    { a: 'galleryFar', b: 'gallery', door: 'ds' },        // the keeper's ledge back along the east wall: its gate opens once the Nursery is won
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the four crystals, sung low to high: the lowest by the door, three in the Choir
    c1: { type: 'switch', room: 'threshold' },
    c2: { type: 'switch', room: 'choir', after: 'c1' },
    c3: { type: 'switch', room: 'choir', after: 'c2' },
    c4: { type: 'switch', room: 'choir', after: 'c3' },
    d1: { type: 'door', opens: { all: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] }, latch: true },
    sw: { type: 'switch', room: 'well' },                          // the eye on the root-wall's face
    dw: { type: 'door', opens: { lit: 'sw' }, latch: true },
    chest: { type: 'gadget', room: 'stilling', item: 'stun' },
    // the passage's three mouths, stilled in the Choir's order (v1.52): the smallest crown, the middling, the gate's
    j1: { type: 'switch', room: 'stilling', needs: ['stun'] },
    j2: { type: 'switch', room: 'stilling', needs: ['stun'], after: 'j1' },
    j3: { type: 'switch', room: 'stilling', needs: ['stun'], after: 'j2' },
    dj1: { type: 'door', opens: { lit: 'j1' }, latch: true },      // (the side mouths: the smallest's keeps a coffer)
    dj2: { type: 'door', opens: { lit: 'j2' }, latch: true },
    d2: { type: 'door', opens: { all: [{ lit: 'j1' }, { lit: 'j2' }, { lit: 'j3' }] }, latch: true },
    // the pendulums' notes, stilled in turn: smallest crystal (lowest) first
    w1: { type: 'switch', room: 'gallery', needs: ['stun'] },
    w2: { type: 'switch', room: 'gallery', needs: ['stun'], after: 'w1' },
    w3: { type: 'switch', room: 'gallery', needs: ['stun'], after: 'w2' },
    // (and the great key, v1.52; `room`: the Mother's hall is measured by its two doors, v1.77)
    d3: { type: 'door', lock: 'big', opens: { all: [{ lit: 'w1' }, { lit: 'w2' }, { lit: 'w3' }] }, latch: true, room: 'hall' },
    ds: { type: 'door', opens: { lit: 'arN' }, latch: true },      // (v1.52: it opens once the Nursery is won; its footstone was a step of nothing)
    // the Nursery: its seedlings beaten, the small key's cage sinks
    arN: { type: 'arena', room: 'nursery' },
    kS: { type: 'key', kind: 'small', room: 'nursery', when: { lit: 'arN' } },
    dN: { type: 'door', opens: null },
    dL: { type: 'door', lock: 'small' },                           // the well's west door, at the ledge's end
    // the Choir's balcony: a snapper's mouth across the ball's groove, stilled only a while (`hold`: the frost thaws);
    // shut, it spits the ball back. The ball on the cage's footstone lets the great key out. (The mouth a gate in the
    // balcony's middle, not a door between rooms, since v1.77: a `bridge`, as the Warden's Well's slots the balls cross)
    jB: { type: 'switch', room: 'balcony', needs: ['stun'], hold: BALCONY.hold },
    dJ: { type: 'bridge', opens: { lit: 'jB' } },
    oB: { type: 'drum', room: 'balcony', plate: 'pB', plateAt: 1, start: BALCONY.start, needs: ['stun'], gap: 'dJ' },
    pB: { type: 'plate', room: 'balcony' },
    kB: { type: 'key', kind: 'big', room: 'balcony', when: { drumOn: ['oB', 'pB'] } },
    mother: { type: 'boss', room: 'hall', needs: ['gun', 'stun'] },
    d5: { type: 'door', opens: { resolved: true }, room: 'hall' },
    cache: { type: 'cache', room: 'stilling' },                    // in the smallest mouth's niche
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'choir', at: [-16.8, 0, 33.2], yaw: Math.PI / 4 },
  },
};

/** The Nursery's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round the Nursery's middle). */
export const ARENAS = [{
  el: 'arN', room: 'nursery', zone: NURSERY.zone, doors: ['dN'], extra: 2,
  shut: 'The door grinds shut behind you. Among the old seed-beds, something snaps awake.',
  won: 'The last of them goes still among the beds. The key’s cage sinks, the door lets go, and out over the chasm the keeper’s gate grinds open.',
}];

export const MOTHER = {
  kind: 'organic', name: 'the Mother Snapper', final: 'touch', touch: 'lay a hand on her head',
  speed: 0, wakeTime: 3.2,
  wake: 'A head of jaws on a long neck uncurls from its leaves. The Mother.',
  openHint: 'Her head lies spent on the floor, jaws agape.',
  weary: 'Her head comes down by her leaves, her crown aglow. Go to her.',
  resolved: 'The Mother Snapper sleeps. Up in the dome the crystals hum in tune.',
  phases: [
    { to: 0.45, attacks: ['lunge', 'sweep'], pause: 1.5, hint: 'When her head lies spent after a lunge, still her: cold in her mouth.' },
    // (v1.79, #373: the snap, the move her phase asks the push for, every other move, not every third; its second snap
    // answers the push too, its rear the same; and as she rears to snap her head looms out over you, so a push from
    // anywhere in her reach meets it: src/temples/guardians.js snapperModel. From the middle of her hall her head had
    // stayed 9 m off and the push, 6 m long, never reached it: her second phase never opened)
    { to: 0.75, attacks: ['snap', 'seed', 'snap', 'sweep'], pause: 1.2, hint: 'She feints now. Still her, or still the three crystals, smallest first.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'push', moves: ['snap', 'snap2'], open: 3.6,
        hint: 'Push her head as she rears to snap: it slams down, spent.',
        said: 'Shoved aside, her head slams down spent, jaws agape. Still her.',
        lines: ['She rears back to snap.', 'Push her head as she rears to snap, and it slams down spent.', 'Switch to the push and fire it at her head as it draws back to snap; then still her open mouth.'] } },
    { to: 0.9, attacks: ['thrash', 'seed', 'snap'], pause: 1.0, hint: 'The cold no longer eases her: still the crystals, smallest first.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    lunge: { shape: 'lane', range: 13.5, width: 3.4, wind: 1.4, track: 0.6, part: 'mouth', parts: ['mouth'], splash: 0.4, active: 0.35, damage: 1, knock: 11, recover: 0.6, open: 3.6 },
    sweep: { shape: 'cone', range: 9.5, angle: 0.95, wind: 1.2, track: 0.6, part: 'mouth', side: 1, parts: ['mouth'], splash: 0.4, active: 0.35, gap: 0.65, damage: 0.75, knock: 12, recover: 0.7, then: 'sweepBack' },
    sweepBack: { shape: 'cone', range: 9.5, angle: 0.95, wind: 0.75, track: 0.5, part: 'mouth', pose: 'sweep', side: -1, link: true, parts: ['mouth'], splash: 0.4, active: 0.35, damage: 0.75, knock: 12, recover: 0.8 },
    seed: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.0, wind: 1.5, track: 0.55, part: 'mouth', open: 1.6, damage: 0.75, knock: 8, recover: 0.8 },
    snap: { shape: 'lane', range: 7.5, width: 3, wind: 1.2, track: 0.7, part: 'mouth', parts: ['mouth'], splash: 0.4, active: 0.3, gap: 0.75, damage: 0.5, knock: 8, recover: 0.4, then: 'snap2' },
    snap2: { shape: 'lane', range: 7.5, width: 3, wind: 0.65, track: 0.6, part: 'mouth', pose: 'snap', link: true, parts: ['mouth'], splash: 0.4, active: 0.3, damage: 0.5, knock: 8, gap: 0.2, then: 'lungeEnd' },
    lungeEnd: { shape: 'lane', range: 13.5, width: 3.4, wind: 1.2, track: 0.5, part: 'mouth', pose: 'lunge', link: true, parts: ['mouth'], splash: 0.4, active: 0.35, damage: 1, knock: 11, recover: 0.6, open: 3.6 },
    thrash: { shape: 'ring', at: 'self', radius: 7, wind: 1.3, part: 'core', rig: 'swell', parts: ['body'], splash: 0.4, active: 0.4, gap: 0.3, damage: 0.75, knock: 12, recover: 0.6, then: 'seedVolley' },
    seedVolley: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.1, track: 0.55, part: 'mouth', pose: 'seed', link: true, open: 2.0, damage: 0.5, knock: 6, recover: 0.8 },
  },
};

/**
 * How long she lies spent when a stilling glob stops her mid-strike in her first phase (s): the strike never lands, her
 * head drops agape, and the cold in her mouth then calms her (v1.79, issue #373: "she almost never opens her mouth":
 * a glob into the jaws she gapes as she winds up stopped the strike and she shook it off, so a player who shot at the
 * open jaws he saw never had her open at all).
 */
export const MOTHER_STILLED = 2.8;

/**
 * Only the stilling mode calms her: plain fluid startles her, a shove frightens her. Every glob that calms her rings
 * the chime and moves her bar; one that does not is said to the tool (info.dull: its splash sounds as on a wall) and,
 * where a player would think it should, rings flat (issue #373: "I hear the success sound but the health bar doesn't
 * change").
 */
function motherHit(g, part, mode, info = {}) {
  const rt = g.rt;
  const flat = () => { info.dull = true; rt.sound?.critter?.('blip', 0.5); };
  if (mode === 'stun') {
    if (g.phaseIndex >= 2 && (part === 'mouth' && g.state === 'open')) {
      flat();
      rt.notice('The cold settles, but she shakes her crown at the crystals out of tune.', 'mother.tune');
      return true;
    }
    if (part === 'mouth' && g.state === 'open') {
      // (while her phase still asks for the push, add() takes nothing and says so)
      if (!g.add(0.15, 'still')) { flat(); return true; }
      rt.notice('The cold settles in her mouth. Her jaws ease, and her head comes up.', 'mother.still');
      rt.sound?.chime?.();
      if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
      return true;
    }
    if (g.attack && g.state === 'fight' && !g.struck) {
      // stilled mid-strike: it never lands. At first her head drops spent, agape (a way in: still her mouth); once she
      // has begun to calm, it calms her more; in her last phase she shakes it off
      g.stop(); g.cool = 2.4;
      if (g.phaseIndex >= 2) { flat(); rt.notice('She stops, frosted, and shakes it off: the cold no longer eases her.', 'mother.mid2'); }
      else if (g.phaseIndex >= 1) {
        if (g.add(0.15, 'still')) { rt.sound?.chime?.(); rt.notice('She stops mid-strike, frosted, and sways. Her crown glows brighter.', 'mother.mid'); }
        else flat();
      } else {
        info.dull = true;   // (no calm yet: the opening is the reward)
        g.cool = g.phase.pause ?? 1.5;
        g.enter('open'); g.openFor = MOTHER_STILLED;
        rt.notice('Frosted mid-strike, her head drops spent, agape. Still her mouth.', 'mother.mid0');
      }
      return true;
    }
    info.dull = true;
    return true;
  }
  if (mode === 'push') { g.add(-0.04, 'push'); rt.notice('She rears from the shove and snaps the air, more frightened than before.', 'mother.push'); return true; }
  info.dull = true;
  if (part === 'mouth' && g.state === 'open') {
    g.enter('fight'); g.cool = 1.2;
    rt.notice('She snaps at the splash and rears up: it only startles her.', 'mother.fluid');
    return true;
  }
  rt.notice('The fluid runs off her leaves. It does not calm her.', 'mother.leaves');
  return true;
}

/**
 * A crystal over the Mother stilled (a Swing's onStill): in turn, smallest first, its note rings true, stays, and
 * calms her by its share (the three of them a tenth, in her last phase the whole of it), so every note that rings true
 * moves her bar (v1.79, issue #373: the first two chimed and the bar stood still). Out of turn it rings flat, the notes
 * stilled so far fade and take their calm with them, and she snaps up startled: begin again from the smallest.
 */
export function motherCrystal(rt, sw) {
  const C = rt.motherCrystals, G = rt.guardian;
  if (!C || !G?.awake || G.state === 'weary') { rt.sound?.chime?.(); rt.notice('The crystal stops, frosted over, and hums its note into the hall.', 'mc.still'); return true; }
  if (sw.taken) return false;
  const restart = () => { for (const s of C.list) s.taken = false; C.next = 0; C.from = null; };
  if (sw.o.rank !== C.next) {
    sw.flat = 0.8; rt.sound?.critter?.('blip', 0.5);
    if (C.from != null) G.add(C.from - G.meter, 'crystals.flat');   // (the notes' calm fades with them)
    restart();
    if (G.state === 'fight' && !G.attack) G.cool = Math.min(G.cool, 0.4);
    rt.notice('It rings flat, and she snaps up, startled. Smallest crystal first.', 'mc.flat');
    return false;
  }
  const from = G.meter, phase = G.phaseIndex;
  // (while her second phase still asks for the push, add() takes nothing and says so: the note only hums, flat)
  if (!G.add((phase >= 2 ? 0.15 : 0.1) / C.list.length + 1e-9, 'crystals')) { sw.flat = 0.8; rt.sound?.critter?.('blip', 0.5); return false; }
  if (C.next === 0) C.from = from;
  sw.taken = true; C.next++;
  rt.sound?.chime?.();
  // (a note that ended her phase ends the turn too: the next phase's notes begin from the smallest)
  if (G.phaseIndex !== phase) { restart(); return true; }
  if (C.next < C.list.length) { rt.notice('The crystal rings true over her, and she turns her head up to listen.', 'mc.true'); return true; }
  restart();
  rt.notice('Low to high, the three notes ring true: her jaws ease, her crown glows.', `mc.done.${Math.min(phase, 2)}`);
  if (G.state === 'open') { G.enter('fight'); G.cool = 2.2; }
  return true;
}

const MOUTH_WRONG = 'Its crystal rings flat in the cold, and the jaws snap on. The makers sang from low to high: the smallest crystal first.';

/**
 * (v1.52, issue #23) The Snapping Passage's two side mouths (the gate's is in the layout), the Nursery west off the
 * gallery's far landing, and the way to the great key: the ledge along the Bog Well's west wall from the root-wall's top
 * to the well's west door (one keyhole), the walk south outside the Choir's west wall and in onto its balcony. (v1.77,
 * issue #336: each side mouth in a shrine of stone out on the passage's floor, the Nursery 30 m square, the balcony a
 * gallery down the Choir's west side, the ball's groove down its middle.)
 */
function wings(rt, K, M, { spike, root }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, S = SHRINE;
  // ---- the side mouths, each in a shrine of stone out on the passage's floor, either side of the way to the gate: a
  // niche in the face it turns to the way, the mouth in the niche's mouth and a crystal through the shrine's crown over
  // it (the smallest keeps a coffer in its niche)
  for (const m of MOUTHS) {
    const s = m.side === 'w' ? -1 : 1, y = UP, hw = 1.3, mh = 3.4, z0 = m.z - S.d / 2, z1 = m.z + S.d / 2;
    const f = s * S.face, n = s * (S.face + m.deep), b = s * S.back, cx = (p, q) => (p + q) / 2, wx = (p, q) => Math.abs(q - p);
    // (drawn and solid as one: the block behind the niche, its two sides and the lintel over the mouth)
    K.both(M.wall, [
      box(wx(n, b), S.h, S.d, cx(n, b), y + S.h / 2, m.z),
      box(m.deep, S.h, z1 - (m.z + hw), cx(f, n), y + S.h / 2, (m.z + hw + z1) / 2),
      box(m.deep, S.h, m.z - hw - z0, cx(f, n), y + S.h / 2, (z0 + m.z - hw) / 2),
      box(m.deep, S.h - mh, 2 * hw, cx(f, n), y + mh + (S.h - mh) / 2, m.z),
    ]);
    K.both(M.trim, box(wx(f, b) + 0.4, 0.4, S.d + 0.4, cx(f, b), y + S.h + 0.2, m.z));   // (its cap)
    add(Jaw, { id: m.id, still: m.still, at: [s * (S.face + 0.6), y, m.z], yaw: Math.PI / 2, w: 2 * hw, h: mh, seed: m.id === 'dj1' ? 3 : 5, wrong: MOUTH_WRONG,
      stilled: m.id === 'dj1' ? 'The smallest crystal rings true, low, and the little jaws stop dead, frosted, and ease open.' : 'The middling crystal rings true, a note higher, and its jaws stop dead, frosted, and ease open.' });
    spike(s * (S.face + 0.8), y + S.h + 0.4, m.z, m.crown, 0.18 + m.crown * 0.1, -s * 0.15, 0.6);
    if (m.id === 'dj1') add(Coffer, { id: 'cache', at: [s * (S.face + m.deep - 1.0), y, m.z], yaw: -s * Math.PI / 2 });
    else { spike(s * (S.face + 2.0), y, m.z - 0.5, 1.6, 0.35, s * 0.2, 1); spike(s * (S.face + 1.8), y, m.z + 0.7, 1.1, 0.3, -s * 0.2, 2); }
  }

  // ---- the Nursery (an arena, the house's one fight): old seed-beds in rings of stone round its middle, where the
  // Mother's seedlings were raised; its keepers stand among them
  const N = NURSERY, NR = ROOMS.nursery, GA = ROOMS.gallery;
  K.corridor([GA.x0 - 1.2, N.z], [NR.x1 + 0.6, N.z], UP, { w: D.w, h: D.h });
  K.hall({ x: N.x, z: N.z, w: N.w, d: N.d, y: UP, h: NR.top - UP, roof: 'oculus', oculus: 0.25, doors: [{ side: 'e', at: 0, w: D.w, h: D.h }] });
  add(Door, { id: 'dN', at: [NR.x1 + 0.6, UP, N.z], yaw: Math.PI / 2, w: D.w, h: D.h });   // (open: it shuts behind you while they stand)
  for (const [bx, bz] of [[-7.5, -7.5], [7, -7.2], [-7.2, 7.6], [7.6, 7]]) {
    K.both(M.trim, T(annulus(2.3, 2.9, 0.4, 28), [N.x + bx, UP + 0.2, N.z + bz]));
    K.both(M.dark, T(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 28), [N.x + bx, UP + 0.08, N.z + bz]));   // (its soil solid as drawn, a hand over the floor)
  }
  spike(N.x - 12, UP, N.z + 12, 3.2, 0.6, 0.2, 1); spike(N.x + 12, UP, N.z - 12, 2.4, 0.5, -0.25, 2); spike(N.x - 1, UP, N.z + 7.4, 1.8, 0.4, 0.1, 3);
  add(Key, { id: 'kS', at: [NR.x0 + 2.4, UP, N.z], yaw: Math.PI / 2 });
  add(Mark, { room: 'nursery', at: [NR.x1 - 3.5, UP, N.z - 6], yaw: -Math.PI / 2, foes: [N.x, UP, N.z] });

  // ---- the ledge along the Bog Well's west wall at UP (from the root-wall's top over the water), to the well's west door
  const WE = ROOMS.well, C2 = WE.z, Lg = LEDGE;
  K.slab(Lg.x0, Lg.z0, Lg.x1, Lg.z1, Lg.y, 0.8);
  K.both(M.trim, box(0.25, 0.3, Lg.z1 - Lg.z0, Lg.x1 - 0.12, Lg.y + 0.15, (Lg.z0 + Lg.z1) / 2));   // (a lip on its edge)
  K.both(M.trim, box(Lg.x1 - Lg.x0, 0.3, 0.25, (Lg.x0 + Lg.x1) / 2, Lg.y + 0.15, Lg.z0 + 0.12));
  for (const z of [Lg.z0 + 1.2, (Lg.z0 + Lg.z1) / 2]) K.both(M.trim, box(0.8, 1.8, 0.5, Lg.x1 - 0.6, Lg.y - 1.7, z));   // (corbels under it)
  root([[-17.2, 16, C2 - 1], [-17.4, 12, C2 - 2.6], [-17, 9.4, C2 - 4]], 0.3);
  // the well's west door (the Nursery's small key), in a short passage out to the walk
  const Wk = WALK, wz = (Wk.z0 + Wk.z1) / 2;
  K.corridor([-WE.r - 0.4, Wk.from], [Wk.x1 + 0.6, Wk.from], UP, { w: D.w, h: D.h });
  add(Door, { id: 'dL', at: [Wk.door, UP, Wk.from], yaw: Math.PI / 2, w: D.w, h: D.h });
  // the walk south, outside the Choir's west wall, and in through it onto the balcony
  K.hall({ x: (Wk.x0 + Wk.x1) / 2, z: wz, w: Wk.x1 - Wk.x0, d: Wk.z1 - Wk.z0, y: UP, h: Wk.h, roof: true, frieze: false, doors: [{ side: 'e', at: Wk.from - wz, w: D.w, h: D.h }, { side: 'e', at: Wk.to - wz, w: D.w, h: D.h }] });
  K.corridor([Wk.x1 + 1.2, Wk.to], [ROOMS.choir.x0 - 0.6, Wk.to], UP, { w: D.w, h: D.h });
  spike(Wk.x0 + 1.6, UP, wz + 6, 3.4, 0.6, 0.2, 1); spike(Wk.x0 + 1.4, UP, wz - 9, 2.2, 0.45, 0.25, 2);
  root([[Wk.x0 + 0.5, UP + Wk.h - 0.5, wz - 2], [Wk.x0 + 1.2, UP + 6, wz - 1], [Wk.x0 + 0.6, UP, wz - 2.6]], 0.4);

  // ---- the Choir's balcony, a gallery down its west side 9 m over its floor (a parapet along its two open edges, piers
  // under it); a wall across it with a snapper's mouth on the ball's groove, the great key's cage beyond
  const B = BALCONY, gz = (B.a + B.b) / 2, gl = B.a - B.b + 1.2;
  K.slab(B.x0, B.z0, B.x1, B.z1, B.y, 0.8);
  K.both(M.trim, box(0.4, 1.0, B.z1 - B.z0, B.x1 - 0.2, B.y + 0.5, (B.z0 + B.z1) / 2));
  K.both(M.trim, box(B.x1 - B.x0 - 0.4, 1.0, 0.4, (B.x0 + B.x1 - 0.4) / 2, B.y + 0.5, B.z0 + 0.2));
  for (const z of [B.z0 + 4, B.z0 + 16, B.z0 + 28]) K.column(B.x1 - 1.2, z, 0, B.y - 0.8, 0.6);
  K.wall(B.x0 - 0.3, B.wall, B.x1 + 0.8, B.wall, B.y, 9, { t: 0.8, holes: [{ at: B.groove - (B.x0 - 0.3), w: 2.8, h: 3.0 }] });
  add(Jaw, { id: 'dJ', still: 'jB', at: [B.groove, B.y, B.wall], yaw: 0, w: 2.6, h: 2.8, seed: 7,
    stilled: 'The jaws stop dead, frosted, and ease open. Here the frost does not hold long.',
    thawing: 'The frost on the jaws is cracking.' });
  K.add(M.dark, box(1.0, 0.04, gl, B.groove, B.y + 0.02, gz));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, gl, B.groove + sd * 0.75, B.y + 0.06, gz));
  add(Ball, { id: 'oB', a: [B.groove, B.y + 0.04, B.a], b: [B.groove, B.y + 0.04, B.b], r: 0.85, lock: true,
    jaws: { id: 'dJ', at: (B.a - B.wall) / (B.a - B.b), spat: 'The jaws snap at the ball and spit it back down its groove.' } });
  add(Plate, { id: 'pB', at: [B.groove, B.y, B.b], r: 1.0 });
  add(Key, { id: 'kB', big: true, at: [B.key[0], B.y, B.key[1]], yaw: Math.PI / 2 });
  add(Mark, { room: 'balcony', at: [-15.5, B.y, 70], yaw: Math.PI / 2 });
}

// ------------------------------------------------------------------ inside
// (since v1.77, issue #336, docs/design/temple-redesign.md: every hall 30 to 36 m across under 18 m of stone or more, the
// round halls 28 to 38 m, doors 7 by 9; each puzzle in the middle of its room, the one fight in the Nursery)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const root = (pts, r) => K.both(M.floor, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), 16, r, 7, false));
  const crystalM = makeMaterial({ color: PALETTE.glow, glow: 0.45, flat: true, key: 'temple.lorn.crystal' });
  const spike = (x, y, z, h, r, tilt = 0, yaw = 0) => K.both(crystalM, T(new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0), [x, y, z], [tilt, yaw, 0]));
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, ...o }); };

  // ---- the Threshold: the first mark, and the smallest crystal out on its floor
  const TH = R0.threshold;
  hall(TH, { roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.both(M.voidM, box(3.6, 5, 1.25, 0, 2.5, -0.625));   // (drawn and solid as one: from the doorway's face back to the wall's inner face)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-6, 0, 8], yaw: Math.PI / 2 });
  spike(-11, 0, 25, 3.5, 0.6, 0.2); spike(11.5, 0, 26, 2.6, 0.5, -0.25, 1); spike(-12, 0, 4, 2.2, 0.45, 0.2, 2);
  // the first note, sung at the door: the smallest crystal, by the way in
  const wrong = 'It rings flat, and fades. The makers sang from low to high, and the first note at the door.';
  add(Switch, { id: 'c1', at: [5, 0, 14], crystal: 1.8, size: 0.9, wrong });
  K.both(M.trim, T(annulus(1.5, 1.9, 0.2, 24), [5, 0.1, 14]));

  // ---- the Choir: three crystals, each its own height, out on its floor; splash them low to high (after the door's).
  // Down its west side the balcony, 9 m up (wings), its way in through the west wall from the walk
  const CH = R0.choir, [, cz] = mid(CH);
  hall(CH, { roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }, { side: 'w', at: WALK.to - cz, w: D.w, h: D.h, y0: UP }] });
  for (const [id, x, z, h] of [['c3', -8, 45, 4.4], ['c4', -1.5, 66, 5.6], ['c2', 9, 69, 3.1]])
    add(Switch, { id, at: [x, 0, z], crystal: h, size: 0.9, wrong });
  // where the fourth stood: an empty ring of stone
  K.both(M.trim, T(annulus(1.0, 1.5, 0.25, 24), [9, 0.12, 48]));
  K.both(M.trim, T(annulus(1.8, 2.4, 0.3, 28), [0, 0.15, 56]));
  K.add(M.glyph, T(glyphGeometry(2.6, 0.05).rotateX(-Math.PI / 2), [0, 0.32, 56]));
  for (const z of [cz - 18, cz, cz + 18]) K.column(CH.x1 - 2.5, z, 0, CH.top, 0.9);
  add(Door, { id: 'd1', at: [0, 0, CH.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] });
  add(Mark, { room: 'choir', at: [CH.x1 - 6, 0, CH.z0 + 5], yaw: -Math.PI / 2 });
  spike(-15, 0, 35, 6, 0.9, 0.15); spike(14.6, 0, 82, 7.5, 1.0, -0.2, 2); spike(12.4, 0, 35.5, 4, 0.7, -0.1, 1);
  root([[CH.x1 - 0.5, 22, 72], [CH.x1 - 1.6, 13, 68], [CH.x1 - 0.8, 5, 63], [CH.x1 - 1, 0, 59]], 0.7);

  // ---- the Bog Well (a round hall on its water's floor): a disc that climbs over the dark water, then a wall of roots to UP
  const WE = R0.well, C2 = WE.z, R = WE.r, N0 = C2 - WE.near, F0 = C2 + WE.face;
  K.corridor([0, CH.z1 + 1.2], [0, C2 - R - 0.4], 0, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C2, y: WE.y, r: R, h: WE.top - WE.y, seg: 36, floor: false, gaps: [{ a: Math.PI, w: D.w, h: D.h, y0: -WE.y }, { a: 0, w: D.w, h: D.h, y0: UP - WE.y }, { a: -Math.PI / 2, w: D.w, h: D.h, y0: UP - WE.y }], oculus: 0.3 });   // (and west at UP, the ledge's door: v1.52, the way to the balcony)
  K.both(M.floor, box(2 * R, 6, N0 - (C2 - R) + 0.4, 0, -3, (C2 - R - 0.4 + N0) / 2));   // the near landing (its top at 0)
  K.both(M.dark, T(new THREE.CylinderGeometry(R, R, 1, 40), [0, -6.5, C2]));
  const bog = makeMaterial({ color: '#2f4a48', glow: 0.12, flat: true, key: 'temple.lorn.bog' });
  K.add(bog, T(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 0.2, 40), [0, -2.4, C2]));
  add(Pit, { room: 'well', min: [-R - 1, -8, N0], max: [R + 1, -1.5, F0] });
  add(Platform, { path: [[0, 0, C2 - 4.8], [0, 3, C2 + 0.6]], r: 2.2, speed: 1.4, pause: 1.8 });
  // the root-wall, its top at UP: climb it (with the roots down its face and the landing on top: the house's
  // climbs, its other walls are not climbed, issue #115)
  K.climbable('the Bog Well\'s root-wall: climbed from the riding disc to the door at its top', () => {
    K.both(M.wallGlyph, box(2 * R, UP - WE.y, C2 + R - F0 + 0.4, 0, (UP + WE.y) / 2, (F0 + C2 + R + 0.4) / 2));
    root([[-6, UP, F0 + 0.2], [-5, 5, F0 + 0.1], [-6.2, 1, F0 + 0.15], [-6, -3, F0 + 0.1]], 0.45);
    root([[5, UP, F0 + 0.2], [6, 4, F0 + 0.1], [4.8, 0, F0 + 0.15], [5.4, -3, F0 + 0.1]], 0.45);
  });
  add(Mark, { room: 'well', at: [-6, 0, N0 - 3], yaw: Math.PI / 2 });
  // the door at the root-wall's top, and its eye on the wall's face: at eye height on the disc, out of sight above
  add(Door, { id: 'dw', at: [0, UP, C2 + R + 0.7], w: D.w, h: D.h, lamps: [{ lit: 'sw' }] });
  add(Switch, { id: 'sw', at: [-2.6, 4.5, F0 - 0.2], yaw: Math.PI, size: 1.0 });
  spike(13, -2.4, C2 - 3, 5, 0.8, -0.3); spike(-12.5, -2.4, C2 - 1, 4, 0.7, 0.3, 1);

  // ---- the corridor and the Stilling Chamber (floor UP, a round hall 34 m across): the chest; its way on open
  const ST = R0.stilling, C3 = ST.z;
  K.corridor([0, C2 + R + 0.4], [0, C3 - ST.r - 0.4], UP, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C3, y: UP, r: ST.r, h: ST.top - UP, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.3 });
  K.both(M.trim, ...chestMound(0, UP, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  add(Mark, { room: 'stilling', at: [8, UP, C3 - 7], yaw: -Math.PI * 0.75 });
  spike(-9, UP, C3 + 4, 4.5, 0.7, 0.25); spike(8.6, UP, C3 + 5.5, 3.2, 0.6, -0.2, 2);

  // ---- the Snapping Passage (floor UP), a room on: its two side mouths in shrines out on its floor (wings); the door
  // into the gallery a gate of jaws
  const SP = R0.snapping;
  K.corridor([0, C3 + ST.r + 0.4], [0, SP.z0 - 1.2], UP, { w: D.w, h: D.h });
  hall(SP, { roof: 'oculus', oculus: 0.3, omit: ['n'], doors: [{ side: 's', w: D.w, h: D.h }] });
  spike(-12, UP, SP.z0 + 4, 3.6, 0.6, 0.2, 3); spike(12.4, UP, SP.z0 + 26, 2.8, 0.5, -0.25, 4); spike(-11.5, UP, SP.z0 + 27, 2.2, 0.45, 0.2, 5);

  // ---- the Pendulum Gallery: a narrow bridge over a chasm, three crystal pendulums across it
  const GA = R0.gallery, G0 = GA.z0, Q0 = G0 + GA.near, Q1 = Q0 + GA.pit, [, gz] = mid(GA), gy = GA.floor - GA.y;
  K.slab(-D.w / 2, G0 - 1.6, D.w / 2, G0 + 0.6, UP, 0.8);
  add(Jaw, { id: 'd2', still: 'j3', at: [0, UP, G0 - 0.6], w: D.w, h: D.h, seed: 1, wrong: MOUTH_WRONG,
    stilled: 'The gate’s great crystal rings true, last and highest, and the jaws stop dead, frosted, and ease open. They forget to close.' });
  // (its crown, the biggest of the three: over the gate, on the passage's side)
  K.both(M.trim, box(1.4, 0.3, 0.8, 0, UP + D.h + 0.95, G0 - 1.5));
  spike(0, UP + D.h + 1.1, G0 - 1.5, 1.8, 0.45, 0, 0.4);
  hall(GA, { floor: false, roof: true, doors: [{ side: 's', w: D.w, h: D.h, y0: gy }, { side: 'n', w: D.w, h: D.h, y0: gy }, { side: 'w', at: NURSERY.z - gz, w: D.w, h: D.h, y0: gy }] });   // (and west into the Nursery, v1.52)
  K.slab(GA.x0, G0, GA.x1, Q0, UP, gy);
  K.slab(GA.x0, Q1, GA.x1, GA.z1, UP, gy);
  K.both(M.floor, box(3, 1, GA.pit + 0.4, 0, UP - 0.5, (Q0 + Q1) / 2));        // the bridge
  K.add(M.trim, box(3.3, 0.25, GA.pit + 0.4, 0, UP - 1.1, (Q0 + Q1) / 2));
  K.both(M.dark, box(GA.x1 - GA.x0, 1, GA.pit, 0, GA.y - 0.5, (Q0 + Q1) / 2));
  add(Pit, { room: 'gallery', min: [GA.x0 - 1, -6, Q0], max: [GA.x1 + 1, 4, Q1] });
  // their notes: smallest crystal lowest; they hang middle-sized, biggest, smallest (so the walk across stills
  // them out of turn: from the far side, still them again in turn)
  const SW = [['w2', Q0 + 4, 0.85], ['w3', Q0 + 10, 1.15], ['w1', Q0 + 16, 0.6]];
  const flat = 'Its crystal stops, but its note rings flat. The makers sang from low to high: the smallest crystal first.';
  for (const [i, [id, z, size]] of SW.entries()) {
    K.both(M.trim, box(GA.x1 - GA.x0, 0.8, 1.2, 0, 21.6, z));            // the beam it hangs from (solid, wall to wall)
    add(Swing, { id, at: [0, 21, z], len: 10, amp: 0.95, period: 2.6 + i * 0.3, phase: i * 0.31, size, wrong: flat, heard: 'The stilled crystal’s note rings true, and a lamp wakes over the far door.' });
  }
  // the keeper's ledge along the east wall, back from the far landing to a gate by the near one; the gate opens once
  // the Nursery is won (v1.52), then stays open (a shortcut back, toward the ledge by the Bog Well)
  const KX = KEEPER.x0;
  K.slab(KX, Q0, GA.x1, Q1, UP, 0.8);
  K.both(M.trim, box(0.25, 0.3, GA.pit, KX + 0.12, UP + 0.15, (Q0 + Q1) / 2));   // (its lip)
  for (let i = 0; i < 4; i++) K.both(M.trim, box(0.5, 1.8, 0.5, KX + 0.3, UP - 1.7, Q0 + 3 + i * 4.7));   // (corbels under it)
  K.both(M.wall, box(0.6, D.h + 1.2, 0.9, KX - 0.3, UP + (D.h + 1.2) / 2, Q0 + 0.6));       // the gate's post on the chasm side
  add(Door, { id: 'ds', at: [(KX + GA.x1) / 2, UP, Q0 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'arN' }] });
  add(Mark, { room: 'gallery', at: [-9, UP, G0 + 5], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [8, UP, Q1 + 7], yaw: Math.PI });
  add(Door, { id: 'd3', at: [0, UP, GA.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'w1' }, { lit: 'w2' }, { lit: 'w3' }] });

  // (and west off the far landing, the Nursery's doorway, v1.52)
  // ---- the antechamber, and the Mother's Hall (floor UP): a round hall, the Mother rooted in its middle
  const H0 = GA.z1 + 0.6;
  const AE = K.vestibule(H0, UP);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, UP, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 19, CL = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CL, y: UP, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.25 });
  // her bed: a ring of dark soil and moss round her root, and the crystals of the dome over her
  K.both(M.floor, T(new THREE.CylinderGeometry(6.5, 7, 0.3, 32), [0, UP + 0.12, CL + 3]));
  K.both(M.trim, T(annulus(6.5, 7.2, 0.4, 36), [0, UP + 0.2, CL + 3]));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; spike(Math.sin(a) * (HR - 1.6), UP, CL + Math.cos(a) * (HR - 1.6), 5 + (i % 3) * 2, 0.9, Math.cos(a) * 0.25, a); }
  // the way out, past the far door
  const X0 = CL + HR + 0.7, X1 = CL + HR + 10;
  add(Door, { id: 'd5', at: [0, UP, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, UP, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, UP, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, UP, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, UP, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, UP + 10.4, (X0 + X1) / 2));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, UP + 2.5, X1 + 0.35));

  // three crystal pendulums high over her, out of order round the hall (by size: rank 0 the smallest): stilled
  // in turn, smallest first, they calm her (motherCrystal). Hung well over your head: they knock nobody down
  rt.motherCrystals = { next: 0, list: [] };
  for (const [rank, x, z, size, yaw, i] of [[1, -12.5, CL - 1, 0.85, 0.1, 0], [2, 9, CL - 9.5, 1.15, 0.8, 1], [0, 10.5, CL + 8.5, 0.6, -0.7, 2]]) {
    K.add(M.trim, box(2.4, 0.5, 0.6, x, UP + 21.3, z));
    rt.motherCrystals.list.push(add(Swing, { at: [x, UP + 21, z], len: 12, amp: 0.38, period: 3.0 + i * 0.35, phase: i * 0.27, size, yaw, rank, onStill: (sw) => motherCrystal(rt, sw) }));
  }

  const model = snapperModel({ reach: 12 });
  model.pos.copy(K.world(0, UP, CL + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = model.pos.clone();
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, UP, CL), r: HR, y: K.world(0, UP, 0).y };

  // (the wings last: their marks after the others, so the machines' ids by mark stay as they were)
  wings(rt, K, M, { spike, root });
  const W = (x, y, z) => K.world(x, y, z), N = NURSERY, Wk = WALK;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(R0.nursery.x0 - 6, -10, -3), V(GA.x1 + 6, 40, X1 + 2)),
    gadget: { at: W(0, UP + 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, UP + 0.5, X1 - 0.4), r: 1.5 }],
    lights: [[0, 5, 14, 16], [2, 7, 45, 22], [4, 7, 68, 20], [-11, UP + 5, 66, 14], [0, 4, C2, 18], [(Wk.x0 + Wk.x1) / 2, UP + 4, (Wk.z0 + Wk.z1) / 2, 14],
      [0, UP + 5, C3, 14], [0, UP + 5, SP.z0 + 15, 18], [0, UP + 5, G0 + 7, 16], [0, 14, (Q0 + Q1) / 2, 18], [0, UP + 5, Q1 + 7, 16], [N.x, UP + 5, N.z, 18], [0, 15, CL, 18]],
    guardian: { def: { ...MOTHER, onHit: motherHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Hush-House on the cave island
function exterior(scene, level, rt) {
  const g0 = level.ground.heightAt(SITE.x, SITE.z), yaw = SITE.heading, R = 15;
  const base = g0 - 1.2;
  const K = new TempleKit(rt.root, 'The Hush-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 1.8;
  const crystalM = makeMaterial({ color: PALETTE.glow, glow: 0.5, flat: true, key: 'temple.lorn.spire' });
  const landmarkTop = landmark(K, 'perdide', { y: sill, R, accent: crystalM });
  // A small recess under the broad canopy leaves the organ facade uninterrupted.
  const z1 = R + 3.2;
  // (a low round door framed three times in the fins' lavender, lit by the crystal's colour: src/temples/portal.js)
  const P = portal(K, { y: sill, z: R + .3, w: 4.4, h: 5.6, shape: 'round', layers: 3, step: .5, recess: .5, back: 1.1, into: 2.4,
    frame: lmCeramic('#c9b8de'), inlay: crystalM });
  // steps down from the porch to the island's moss
  K.both(M.floor, box(6.4, sill * 0.5, 2, 0, sill * 0.25, z1 + 1));
  K.flush();
  const at = K.world(0, sill, R + 1.2);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base, R, sill, crystalM, top: base + landmarkTop, clear: [{ x: SITE.x, z: SITE.z, r: 54 }] };
}

// ------------------------------------------------------------------ the world change: the swamp flowers
/**
 * Once the Mother sleeps the house is in tune again, and the swamp answers it: the dome flowers all over
 * (vines and pale bells, glowing at dusk), and every snapping plant on Lorn has a ring of the same flowers
 * round its foot. The crown crystal on the dome burns bright.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Hush-House in flower (the world change)';
  rt.root.add(root);
  root.visible = false;
  const petalM = makeMaterial({ color: '#eef2ff', glow: 0.35, flat: true, key: 'temple.lorn.petal' });
  const bellM = makeMaterial({ color: '#9fc6f0', glow: 0.4, flat: true, key: 'temple.lorn.bell' });
  const vineM = makeMaterial({ color: '#4c7d5c', flat: true, key: 'temple.lorn.vine' });
  /** A flower: five petals round a point, flat. */
  const flower = (s = 1) => {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(new THREE.SphereGeometry(1, 6, 4).scale(0.22 * s, 0.05 * s, 0.12 * s).translate(0.2 * s, 0, 0).rotateY((i / 5) * TAU).toNonIndexed());
    return mergeGeometries(parts);
  };
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // the dome's vines, in flower, and pale bells round its plinth (the porch side left clear)
  if (O) {
    const K = new TempleKit(root, 'The Hush-House’s flowers', V(SITE.x, O.base, SITE.z), SITE.heading, rt.M);
    const clear = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU + rnd() * 0.25, pts = [];
      if (clear(a0)) continue;
      for (let k = 0; k <= 7; k++) { const e = (k / 7) * 1.25, a = a0 + Math.sin(k * 1.3 + i) * 0.1; pts.push(V(Math.sin(a) * Math.cos(e) * (O.R + 0.3), O.sill + Math.sin(e) * O.R * 0.78 + 0.3, Math.cos(a) * Math.cos(e) * (O.R + 0.3))); }
      K.add(vineM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.16, 4, false));
      for (let k = 1; k < pts.length; k++) for (let j = 0; j < 2; j++) K.add(petalM, flower(1.5 + rnd()).translate(pts[k].x + (rnd() - 0.5) * 1.2, pts[k].y + 0.12, pts[k].z + (rnd() - 0.5) * 1.2));
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU + rnd() * 0.08, d = O.R + 3.8 + rnd() * 2.4;
      if (clear(a)) continue;
      const x = Math.sin(a) * d, z = Math.cos(a) * d, y = O.sill * 0.55;
      K.add(vineM, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 3).translate(x, y + 0.75, z));
      K.add(bellM, new THREE.ConeGeometry(0.55, 0.8, 6, 1, true).rotateX(Math.PI).translate(x, y + 1.55, z));
    }
    K.flush();
  }
  // a ring of flowers round the foot of every snapping plant on Lorn
  const plants = level.plants ?? [];
  const ring = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, d = 1.3 + (i % 3) * 0.55; ring.push(flower(2.6 + (i % 2) * 0.8).translate(Math.sin(a) * d, 0.2, Math.cos(a) * d)); }
  const foot = plants.length ? new THREE.InstancedMesh(mergeGeometries(ring), petalM, plants.length) : null;
  if (foot) {
    foot.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    foot.userData.noCollide = true; foot.userData.dynamic = true;
    foot.frustumCulled = false;
    foot.visible = false;
    scene.add(foot);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _y = V(0, 1, 0);
  const placeFoot = (k) => {
    if (!foot) return;
    for (const [i, p] of plants.entries()) { _q.setFromAxisAngle(_y, i * 1.7); _m.compose(p.base, _q, _s.setScalar(Math.max(1e-4, k))); foot.setMatrixAt(i, _m); }
    foot.instanceMatrix.needsUpdate = true;
  };
  const crown = O ? V(SITE.x, O.base + O.sill + O.R * 0.78 + 3, SITE.z) : null;
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  rt.lights.push(light);
  let k = 0, want = 0;
  const apply = () => {
    const on = k > 0.01;
    root.visible = on;
    if (foot) { foot.visible = on; placeFoot(k); }
    root.scale.setScalar(1);
  };
  apply();
  return {
    root, foot,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 5 : -dt / 2), 0, 1); apply(); }
      if (O) O.crystalM.uniforms.uGlow.value = 0.5 + 0.45 * k * (0.85 + 0.15 * Math.sin(t * 1.4));
      if (crown && k > 0.02) light.set(crown.x, crown.y, crown.z, 45 * k); else light.set(0, -1e5, 0, 0);
      if (k > 0.01) petalM.uniforms.uGlow.value = 0.3 + 0.25 * Math.max(0, Math.sin(t * 0.9));
    },
  };
}

export const PERDIDE_TEMPLE = {
  id: 'perdide', levelId: 'perdide', name: 'The Hush-House', doorLabel: 'door of the Hush-House',
  gadget: 'stun', gadgetBox: 'perdide.temple.stun', arenaDoor: 'd3', arenas: ARENAS,
  origin: [-100, 1700, 300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its futuristic skin, issue #342: src/temples/skins/hush-house.js; look only)
  skin: hushHouseSkin,
  local: { person: 'teasel', out: 9, side: 6 },
  enterLine: 'Inside the Hush-House it is green and cool, and the crystals hum, each its own note. Somewhere ahead, something snaps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out on the swamp, at the foot of every snapping plant, flowers open.', 'resolved.out'); },
};
