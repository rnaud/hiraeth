import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { registerTarget } from '../targets.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, Jaw, Swing, Platform, Plate, Ball, Mark, Pit, Key, Coffer } from './pieces.js';
import { Catch } from './spheres.js';
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
// has snapped at every sound since.
//
// Inside (built far overhead, through its door). The temple's one idea: the makers sang from low to high;
// first with the fluid, then with the stilling mode. (Since v1.77, issue #336, the rooms are shrines: every hall 30 to 36
// m across under 18 m of stone or more, doors 7 by 9, each puzzle in the middle of its room: ROOMS, DOOR,
// docs/design/temple-redesign.md.) Since v1.83 (issue #409, docs/design/temple-best-practices.md) the house has no fight
// at all: the Choir is its great hall, the hub, the Mother's door off it; the small key is the pendulums' song; the
// Mother is outwitted, never fought.
//   the Threshold          the first mark, the way out, and the smallest crystal, out on its floor: splashed, the door into
//                          the Choir opens (the first note was sung at the door: v1.83, issue #409)
//   the Choir              (the great hall, 44 by 66 m under 30 m) three more crystals, each its own height: splash them low
//                          to high and the door north opens (out of turn, a crystal rings flat and fades: logic.js `after`).
//                          The lowest note is not in the Choir: it was sung at the door (the Threshold's crystal, a room
//                          back). Over its floor at once: the gallery 9 m up its west side with the great key's cage on it,
//                          the black pool under the gallery's sill, and on its east wall the great door to the Mother
//   the Bog Well           a riding disc that climbs over dark water, then a wall of roots to climb; the door
//                          at its top wants the eye on the root-wall's face, seen from the disc (not from the top).
//                          Beside it on the root-wall's top, a ledge along the well's west wall to a door of one keyhole,
//                          and past it a walk south outside the Choir's west wall at 9 m
//   the Stilling Chamber   the makers' chest: the STILLING MODE (src/items.js 'stun'). Its way on is open
//   the Snapping Passage   a room on (the chamber's room in the logic), crystals grown up through its floor: the door
//                          into the gallery is a gate of jaws that snaps, and snaps: a stilling glob stills it, and it
//                          rests open (the stilling mode's first lock, where failing costs a nip). Two more mouths, a
//                          crystal grown through each one's crown, small, middling, the gate's the biggest: they still only
//                          in the Choir's order, low to high, and the gate last. The smallest mouth keeps a coffer
//   the Pendulum Gallery   a narrow bridge over a chasm, three crystal pendulums swinging across it (still
//                          them, one by one, to cross); on the far landing the small key's cage wants their notes, and a
//                          pendulum's note only takes stilled in turn, low to high, smallest crystal first, as the Choir
//                          taught. They hang out of that order, so the walk across stills them wrong: still them again,
//                          in turn, from the far side. Sung, the cage sinks and the pendulums rest: the way back over is
//                          a walk (v1.83: the Nursery's fight gave the key before, and a keeper's gate the way back)
//   the Choir's gallery    along the walk and in through the Choir's west wall, 9 m over its floor: the great key, seen from
//                          the Choir's floor at the start, caged behind a wall across the gallery; a ball in a groove down
//                          its middle that runs through a snapper's mouth in it to the cage's footstone. Shut, the mouth
//                          spits the ball back; stilled, it opens, but here the frost thaws and it snaps shut again a few
//                          breaths on: still it, roll the ball through before it wakes, and still it again to walk through
//                          yourself. By the key, the sill: a marked drop into the black pool on the Choir's floor (SILL)
//   the Mother's Hall      off the Choir's east wall through the great door: the guardian, the Mother Snapper, rooted in the
//                          middle of a round hall. She is blind, and strikes at every sound (hush): three crystal
//                          pendulums jangle out of tune over her, and she lunges at each note; she hears you run, roll
//                          or land a jump, never walk. Still the three with the stilling mode and the hall falls silent.
//                          Then sing her the makers' lullaby, the Choir's lesson: splash the notes low to high. The first
//                          and smallest grows at her root, where she lays her head to listen: a splash there only wets
//                          her jaws until a sound elsewhere turns her head away (a crystal rung flat before the first
//                          note costs nothing). Sung through, she sleeps: lay a hand on her head
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
 * The house's doors (m: issue #336) and its rooms in the kit's local frame (z into the house): each hall's floor from
 * wall to wall (its walls stand outside it), its floor's height and its ceiling's; the round halls' middles and radii.
 * The upper floor (the root-wall's top, the chamber, the passage, the gallery's landings and the Choir's gallery) at `UP`.
 * The Bog Well stands on its water's floor (`y`), its near landing `near` m short of its middle, the root-wall's face
 * `face` m past it; the Pendulum Gallery on its chasm's floor, its landings at `floor` (`near` the near one's depth, `pit`
 * the chasm's). Since v1.83 (issue #409) the Choir is the house's great hall, 44 by 66 m under 30 m (36 by 54 under 27
 * before), so every room north of it stands 12 m further on, and the Mother's hall (`hall`) is off its east wall at its
 * floor, through the great door (it was past the Pendulum Gallery's far landing, up at UP).
 */
export const UP = 9;
export const DOOR = { w: 7, h: 9 };
const C2 = 118.4, C3 = C2 + 39.5, A0 = C3 + 21.2, G0 = A0 + 31.2;   // (the halls 1.2 m apart: one wall between them)
/** The Mother's hall: its antechamber's length off the Choir's east wall, its radius; its middle. */
const ANTE_L = 8.8, HR = 22, HX = 22 + 1.2 + ANTE_L + 0.4 + HR, HZ = 64.2;
export const ROOMS = {
  threshold: { x0: -15, x1: 15, z0: 0, z1: 30, y: 0, top: 18 },
  choir: { x0: -22, x1: 22, z0: 31.2, z1: 97.2, y: 0, top: 30 },
  well: { x: 0, z: C2, r: 18, y: -6, top: 28, near: 7.1, face: 3 },
  stilling: { x: 0, z: C3, r: 17, y: UP, top: 27 },
  snapping: { x0: -15, x1: 15, z0: A0, z1: A0 + 30, y: UP, top: 27 },
  gallery: { x0: -18, x1: 18, z0: G0, z1: G0 + 48, y: -3, floor: UP, top: 30, near: 14, pit: 20 },
  hall: { x: HX, z: HZ, r: HR, y: 0, top: 26 },
};
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

/**
 * The way to the great key: from the root-wall's top a ledge along the Bog Well's west wall at `UP` (LEDGE, x0..x1 by
 * z0..z1) to the well's west door (`dL`, one keyhole: the small key off the Pendulum Gallery's far landing) and the walk
 * south outside the Choir's west wall (WALK: its floor x0..x1 by z0..z1, `h` high; its way in from the well at z `from`,
 * its way out into the Choir at z `to`, its door at x `door`), in through the wall onto the Choir's gallery down its west
 * side (BALCONY: x0..x1 by z0..z1 at `y`), a wall across it at z `wall` with a snapper's mouth on the ball's groove (down
 * the gallery at x `groove`, from z `a` to `b`, the footstone at `b`); the ball rests at `start` along it, the jaws stilled
 * stand open `hold` s; the great key by the parapet at `key`, seen from the Choir's floor. The Snapping Passage's two side
 * mouths (`MOUTHS`: the smallest first), each in a shrine of stone out on its floor (SHRINE: its face `face` m from the
 * passage's middle, its back at `back`, `d` deep along z, `h` high; the niche behind the mouth `deep`).
 */
export const LEDGE = { x0: -18, x1: -10.5, z0: C2 - 4.5, z1: C2 + ROOMS.well.face, y: UP };
export const WALK = { x0: -36, x1: -27, z0: 74, z1: C2 + 5.5, y: UP, h: 11, from: C2, to: 79, door: -22.6 };
export const BALCONY = { x0: -22, x1: -8, z0: 50, z1: 97.2, y: UP, groove: -12.5, a: 72, b: 56, wall: 59.5, start: 0.6, hold: 10, key: [-9.6, 53.2] };
/**
 * The sill (G6, issue #409): a gap in the gallery's parapet by the great key, between two crystal posts, `z0` to `z1`; under
 * it on the Choir's floor the black pool (`pool`: its middle x, z, and radius) whose still water takes the 9 m fall
 * (spheres.js Catch). The quick way back from the great key to the Choir and the great door.
 */
export const SILL = { z0: 51, z1: 55.4, pool: [-4.4, 53.2, 2.6] };
export const MOUTHS = [{ id: 'dj1', still: 'j1', side: 'w', z: A0 + 19, crown: 0.7, deep: 4.4 }, { id: 'dj2', still: 'j2', side: 'e', z: A0 + 11, crown: 1.2, deep: 3.0 }];
export const SHRINE = { face: 4.5, back: 10, d: 6, h: 4.6 };
/** The small key's cage on the Pendulum Gallery's far landing (v1.83, issue #409: it was the Nursery's, behind a fight). */
export const FAR_KEY = [-8, G0 + 48 - 6.5];
/**
 * The Mother's hall (issue #409): the great door in the Choir's east wall at z HZ, an antechamber `ANTE_L` m long east of it,
 * the round hall (ROOMS.hall); she is rooted `from` m past its middle, facing the door. Her three pendulums: [rank, x, z,
 * size] round her (rank 1 the smallest of the three; the first note, rank 0, is the crystal at her root, `root` m in front
 * of her). HEAR: how far off she hears you (m from her root), and what she hears: running, a roll, a landing faster than
 * `land` m/s. CALM: what each crystal hushed and each true note gives her (a phase of her meter: hushed, 0.45; sung, 0.9).
 */
export const MOTHER_HALL = { door: HZ, from: 2, root: 3.6, swings: [[2, -6, 8, 0.95], [3, 7, -9.5, 1.2], [1, 8.5, 8, 0.75]] };
export const HEAR = { r: 16, land: 7, dy: 4 };
export const CALM = { hush: 0.15, note: 0.1125 };

export const LOGIC = {
  id: 'perdide', entry: 'threshold', gadget: 'stun',
  // (each room tagged with its kind, issue #336: since v1.83, issue #409, the house has no fight: src/foes.js places machines
  // only in a fight's room, scripts/temple-design/rules.mjs, tests/temple-rules.test.js)
  rooms: {
    threshold: { checkpoint: true, kind: 'puzzle' }, choir: { checkpoint: true, kind: 'puzzle' }, well: { checkpoint: true, kind: 'puzzle' },
    stilling: { checkpoint: true, kind: 'puzzle' }, gallery: { checkpoint: true, kind: 'puzzle' },
    galleryFar: { checkpoint: true, kind: 'passage' }, balcony: { checkpoint: true, kind: 'puzzle' },
    hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'choir', door: 'd0' },           // the first note, sung at the door, opens it onto the great hall
    { a: 'choir', b: 'well', door: 'd1' },
    { a: 'well', b: 'stilling', door: 'dw' },
    { a: 'well', b: 'balcony', door: 'dL' },             // the well's west door, along the walk to the Choir's gallery: the small key
    { a: 'stilling', b: 'gallery', door: 'd2' },         // the Snapping Passage's jaws, a room on from the chest (one room with it)
    { a: 'gallery', b: 'galleryFar', needs: ['stun'] },   // the pendulums: still them to cross
    { a: 'balcony', b: 'choir', oneWay: true },           // the sill: a drop into the black pool (v1.83, issue #409)
    { a: 'choir', b: 'hall', door: 'dG' },                // the great door, in the Choir's east wall
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the four crystals, sung low to high: the lowest by the door, three in the Choir
    c1: { type: 'switch', room: 'threshold' },
    d0: { type: 'door', opens: { lit: 'c1' }, latch: true },
    c2: { type: 'switch', room: 'choir', after: 'c1' },
    c3: { type: 'switch', room: 'choir', after: 'c2' },
    c4: { type: 'switch', room: 'choir', after: 'c3' },
    d1: { type: 'door', opens: { all: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] }, latch: true },
    sw: { type: 'switch', room: 'well' },                          // the eye on the root-wall's face
    dw: { type: 'door', opens: { lit: 'sw' }, latch: true },
    chest: { type: 'gadget', room: 'stilling', item: 'stun' },
    // the passage's three mouths, stilled in the Choir's order: the smallest crown, the middling, the gate's
    j1: { type: 'switch', room: 'stilling', needs: ['stun'] },
    j2: { type: 'switch', room: 'stilling', needs: ['stun'], after: 'j1' },
    j3: { type: 'switch', room: 'stilling', needs: ['stun'], after: 'j2' },
    dj1: { type: 'door', opens: { lit: 'j1' }, latch: true },      // (the side mouths: the smallest's keeps a coffer)
    dj2: { type: 'door', opens: { lit: 'j2' }, latch: true },
    d2: { type: 'door', opens: { all: [{ lit: 'j1' }, { lit: 'j2' }, { lit: 'j3' }] }, latch: true },
    // the pendulums' notes, stilled in turn from the far landing: smallest crystal (lowest) first. Sung, the small key's
    // cage sinks and the pendulums rest, the bridge a walk (v1.83, issue #409: the key was the Nursery's fight's, and a
    // keeper's ledge and gate the way back)
    w1: { type: 'switch', room: 'gallery', needs: ['stun'] },
    w2: { type: 'switch', room: 'gallery', needs: ['stun'], after: 'w1' },
    w3: { type: 'switch', room: 'gallery', needs: ['stun'], after: 'w2' },
    kS: { type: 'key', kind: 'small', room: 'galleryFar', when: { all: [{ lit: 'w1' }, { lit: 'w2' }, { lit: 'w3' }] } },
    dL: { type: 'door', lock: 'small' },                           // the well's west door, at the ledge's end
    // the Choir's gallery: a snapper's mouth across the ball's groove, stilled only a while (`hold`: the frost thaws);
    // shut, it spits the ball back. The ball on the cage's footstone lets the great key out. (The mouth a gate in the
    // gallery's middle, not a door between rooms: a `bridge`, as the Warden's Well's slots the balls cross)
    jB: { type: 'switch', room: 'balcony', needs: ['stun'], hold: BALCONY.hold },
    dJ: { type: 'bridge', opens: { lit: 'jB' } },
    oB: { type: 'drum', room: 'balcony', plate: 'pB', plateAt: 1, start: BALCONY.start, needs: ['stun'], gap: 'dJ' },
    pB: { type: 'plate', room: 'balcony' },
    kB: { type: 'key', kind: 'big', room: 'balcony', when: { drumOn: ['oB', 'pB'] } },
    // the great door, in the Choir's east wall (seen from the way in): the great key, and the Choir hushed. The three
    // crystals sung at the start hum on, and it will not open over them: still them with the stilling mode, high to low,
    // as the makers hushed (the hush the Mother's hall asks for, taught where it is safe: v1.83, issue #409)
    h4: { type: 'switch', room: 'choir', needs: ['stun'] },
    h3: { type: 'switch', room: 'choir', needs: ['stun'], after: 'h4' },
    h2: { type: 'switch', room: 'choir', needs: ['stun'], after: 'h3' },
    dG: { type: 'door', lock: 'big', opens: { all: [{ lit: 'h2' }, { lit: 'h3' }, { lit: 'h4' }] }, latch: true, room: 'hall' },
    mother: { type: 'boss', room: 'hall', needs: ['gun', 'stun'] },
    d5: { type: 'door', opens: { resolved: true }, room: 'hall' },
    cache: { type: 'cache', room: 'stilling' },                    // in the smallest mouth's niche
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'choir', at: [-20.8, 0, 33.2], yaw: Math.PI / 4 },
  },
};

/** No fight in this house (v1.83, issue #409: G3a, docs/design/temple-best-practices.md): no arena. */
export const ARENAS = [];

/**
 * The Mother Snapper (issue #409: outwitted, never fought). She does not see: she hears, and strikes at the sound, her
 * one move the lunge (src/temples/boss.js `listen`: where she aims). Her phases have no moves of their own (her temple's
 * hush() calls them): hushed, the three pendulums frosted silent (0.45); sung, the four notes rung low to high (0.9);
 * weary, a hand on her head. Her other moves stay for the Arena's spar (MOTHER_SPAR).
 */
export const MOTHER = {
  kind: 'organic', name: 'the Mother Snapper', final: 'touch', touch: 'lay a hand on her head', outwit: true,
  speed: 0, wakeTime: 3.2, shiftTime: 2.4,
  wake: 'A head of jaws uncurls from its leaves and turns to every jangling note.',
  weary: 'Her head sinks over the smallest crystal, crown aglow. Go to her softly.',
  resolved: 'The Mother Snapper sleeps. Up in the dome the crystals hum in tune.',
  phases: [
    { to: 0.45, attacks: [], pause: 1.4, hint: 'She strikes at every sound: the crystals jangling over her. Still them.', openHint: 'Her head lies spent where the sound was. She hears; she does not see.' },
    { to: 0.9, attacks: [], pause: 1.4, hint: 'Silence. Now sing her the lullaby: splash the crystals, smallest first.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    // (her one move, a lunge at a sound: a little softer than in her fight before v1.83, a knock and half a heart)
    lunge: { shape: 'lane', range: 13.5, width: 3.4, wind: 1.4, track: 0.6, part: 'mouth', parts: ['mouth'], splash: 0.4, active: 0.35, damage: 0.5, knock: 10, recover: 0.6, open: 3.6 },
  },
};

/**
 * The Mother in the Arena's ring (a function: one temple, one guardian, tests/bosses.test.js) (src/arena-guardians.js): there is no hall of crystals to hush, so she spars as she
 * fought in her house before v1.83 (her moves, her second phase asking for the push), the sparring rule in place of
 * the crystals.
 */
export const motherSpar = () => ({
  ...MOTHER, outwit: false, wake: 'A head of jaws on a long neck uncurls from its leaves. The Mother.',
  openHint: 'Her head lies spent on the floor, jaws agape.', weary: 'Her head comes down by her leaves, her crown aglow. Go to her.',
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
  phases: [
    { to: 0.45, attacks: ['lunge', 'sweep'], pause: 1.5, hint: 'When her head lies spent after a lunge, still her: cold in her mouth.' },
    { to: 0.75, attacks: ['snap', 'seed', 'snap', 'sweep'], pause: 1.2, hint: 'She feints now. Still her as she strikes.',
      asks: { verb: 'push', moves: ['snap', 'snap2'], open: 3.6,
        hint: 'Push her head as she rears to snap: it slams down, spent.',
        said: 'Shoved aside, her head slams down spent, jaws agape. Still her.',
        lines: ['She rears back to snap.', 'Push her head as she rears to snap, and it slams down spent.', 'Switch to the push and fire it at her head as it draws back to snap; then still her open mouth.'] } },
    { to: 0.9, attacks: ['thrash', 'seed', 'snap'], pause: 1.0, hint: 'Once more: when she lies spent, water.' },
    { to: 1.0, weary: true },
  ],
});

/**
 * A glob or the push on the Mother herself (issue #409): nothing calms her but the house's crystals, so every one is dull
 * (the tool's splash as on a wall, src/targets.js hitTarget). A shove is a sound she hears: she strikes back at it.
 */
function motherHit(g, part, mode, info = {}) {
  const rt = g.rt;
  info.dull = true;
  if (mode === 'push') { strikeAt(rt, g, null, 'push'); rt.notice('She rears from the shove and strikes at where it came from.', 'mother.push'); return true; }
  if (mode === 'stun') { rt.notice('Cold on her leaves: she shakes it off. It is the crystals she hears.', 'mother.cold'); return true; }
  rt.notice('The splash runs off her leaves. It is the crystals she hears.', 'mother.leaves');
  return true;
}

/** She strikes at a sound at `at` (a world point on her floor; null: you, as she hears you). True if she could. */
function strikeAt(rt, G, at, why) {
  if (!G || G.state !== 'fight' || G.attack || G.closing || G.cool > 0 || !rt.player) return false;
  G.listen = at ? at.clone().setY(G.arena.y) : null;
  G.begin(rt.player, null, 'lunge');
  G.heardWhy = why;
  return true;
}

/**
 * The hush (issue #409), every frame (the temple's onUpdate): the pendulums jangle out of tune at the end of every swing
 * till they are frosted; she hears them, and you if you run, roll or land a jump within HEAR.r of her, and strikes at the
 * sound when she is free. Her calm follows what is hushed (CALM.hush a frosted pendulum, whenever it was frosted).
 */
export function hush(rt, dt) {
  const G = rt.guardian, C = rt.motherCrystals, P = rt.player, L = rt.logic;
  // (the Pendulum Gallery's three, once sung in turn, rest for good: the bridge a walk both ways)
  const GW = rt.galleryWings;
  if (GW?.length && !GW.rest && GW.every((s) => L.isLit(s.id))) {
    GW.rest = true;
    for (const s of GW) { s.stillFor = Infinity; s.still = Infinity; }
    if (rt.time > 1) rt.notice('The three notes ring true: the key’s cage sinks, the pendulums rest.', 'gallery.rest');
  }
  // (the great door, the key in it, over the Choir's humming crystals)
  const dG = rt.piece('dG');
  if (P && dG && !L.isOpen('dG') && L.keysIn('dG') > 0 && P.pos.distanceTo(dG.group.position) < 8) rt.notice('The great door will not open over the humming crystals: hush them.', 'hush.door');
  if (!G || !C) return;
  const H = (rt.hushState ??= { air: 0 });
  // the pendulums' jangle, and where she would hear it
  let jangle = null;
  for (const sw of C.swings) {
    const flip = sw.lastWay !== undefined && sw.way !== sw.lastWay;
    sw.lastWay = sw.way;
    if (sw.frost || !flip || G.state === 'resolved') continue;
    if (G.awake) rt.sound?.critter?.('blip', 0.35);
    jangle = sw;
  }
  if (!G.awake || G.state === 'weary') return;
  // (she heard the door: she turns to it as she wakes)
  if (G.listen === undefined) G.listen = C.door.clone();
  // after a strike at you, she keeps her head where she struck
  if (!G.attack && G.listen === null) G.listen = G.attackAt.clone();
  // hushed: her calm is the frosted pendulums' (frosted before she woke, they count as she wakes)
  if (G.phaseIndex === 0) {
    const want = CALM.hush * C.swings.filter((s) => s.frost).length;
    if (G.meter < want - 1e-9 && (G.state === 'fight' || G.state === 'open')) G.add(want - G.meter, 'hush');
  }
  // into the lullaby: she lays her head over her root's crystal to listen
  if (G.phaseIndex >= 1 && !C.sung) { C.sung = true; G.listen = C.root.center.clone().setY(G.arena.y); }
  // you: a run, a roll, a landing, within her hearing
  let loud = false;
  if (P && !P.dead && !P.down) {
    const d = Math.hypot(P.pos.x - G.model.pos.x, P.pos.z - G.model.pos.z), near = d < HEAR.r && Math.abs(P.pos.y - G.arena.y) < HEAR.dy;
    const landed = H.air > HEAR.land && P.onGround;
    H.air = P.onGround ? 0 : Math.max(H.air, -(P.vel?.y ?? 0));
    loud = near && (!!P.sprinting || P.combatMotion?.roll != null || landed);
  }
  if (loud && strikeAt(rt, G, null, 'you')) rt.notice('She hears you, and strikes at the sound. Walk: she cannot hear a walk.', 'hush.you');
  else if (jangle && G.phaseIndex === 0 && strikeAt(rt, G, jangle.center, 'jangle')) rt.notice('A crystal jangles out of tune over her, and she strikes at the note.', 'hush.jangle');
}

/**
 * A pendulum over the Mother stilled (its Swing's onStill): frosted silent for good (its jangle stops). Before her hall
 * is hushed it calms her (hush(): CALM.hush each); after, it is already still: ring it.
 */
function motherFrost(rt, sw) {
  if (sw.frost) { rt.notice('It hangs frosted and silent already. Ring it with a splash.', 'mc.frosted'); return false; }
  sw.frost = true; sw.stillFor = Infinity; sw.still = Infinity;
  rt.sound?.chime?.();
  const left = rt.motherCrystals.swings.filter((s) => !s.frost).length;
  rt.notice(left ? 'The crystal stops dead, frosted, and its jangle stops.' : 'The last crystal stops, frosted. The hall falls silent, and she listens.', left ? 'mc.frost' : 'mc.hushed');
  return true;
}

/**
 * A note of the lullaby splashed (a pendulum, frosted, or the crystal at her root): in turn, smallest first, it rings
 * true, stays lit, and calms her (CALM.note); out of turn it rings flat, the notes so far fade with their calm, and she
 * strikes at the flat note (before the first note that costs nothing: the decoy that turns her head off her root).
 * Her root's crystal does not ring while her head lies over it. Before her hall is hushed the jangle drowns them all.
 */
export function motherNote(rt, n, mode, info = {}) {
  const C = rt.motherCrystals, G = rt.guardian;
  if (mode !== 'shoot') {
    if (n === C.root) { info.dull = true; rt.notice('Cold does nothing to a note. Ring it: a splash.', 'mc.rootcold'); }
    return true;
  }
  if (!G?.awake || G.state === 'weary') { rt.sound?.chime?.(); rt.notice('The crystal rings its note into the hall.', 'mc.ring'); return true; }
  if (G.phaseIndex === 0) {
    info.dull = true;
    if (n === C.root) rt.notice('The jangle over her drowns its note. Hush the crystals first.', 'mc.drowned');
    else rt.notice('The crystal rings under the splash, and swings on, jangling.', 'swing.ring');
    return true;
  }
  if (n.taken) { info.dull = true; return true; }
  if (n === C.root) {
    const m = G.model.mouth;
    if (Math.hypot(m.x - n.center.x, m.z - n.center.z) < C.cover) {
      info.dull = true;
      rt.notice('Her head lies over the smallest crystal. Make a sound somewhere else.', 'mc.covered');
      return true;
    }
  }
  const restart = () => { for (const s of C.notes) s.taken = false; C.next = 0; C.from = null; };
  if (n.rank !== C.next) {
    n.flat = 0.8; rt.sound?.critter?.('blip', 0.5);
    if (C.from != null) G.add(C.from - G.meter, 'notes.flat');   // (the notes' calm fades with them)
    restart();
    if (G.state === 'open') G.enter('fight');
    G.cool = 0;
    strikeAt(rt, G, n.center, 'flat');
    rt.notice('It rings flat, and she strikes at the sour note. Smallest crystal first.', 'mc.flat');
    return true;
  }
  if (C.next === 0) C.from = G.meter;
  G.add(CALM.note + 1e-9, 'notes');
  n.taken = true; C.next++;
  rt.sound?.chime?.();
  if (n !== C.root && !G.attack) G.listen = n.center.clone().setY(G.arena.y);   // (she turns her head up to the note)
  rt.notice(C.next < C.notes.length ? 'The note rings true, and she turns her head to listen.' : 'Low to high, the lullaby rings true. Her jaws ease, and her head sinks.', C.next < C.notes.length ? 'mc.true' : 'mc.done');
  return true;
}

/**
 * The lullaby's first note (issue #409): the smallest crystal, grown up through the floor at the Mother's root, under
 * where she lays her head to listen. A splash rings it (motherNote). o: { at, size }
 */
class RootNote {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.rank = 0; this.flat = 0; this.taken = false;
    const K = rt.kit, s = o.size ?? 1;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    rt.root.add(this.group);
    this.mat = makeMaterial({ color: rt.P.glow ?? '#a8e6ee', glow: 0.25, flat: true, key: 'temple.lorn.rootnote' });
    const g = mergeGeometries([
      T(new THREE.OctahedronGeometry(1, 0), [0, 0.95 * s, 0], [0, 0.4, 0], [0.45 * s, 0.95 * s, 0.45 * s]),
      T(new THREE.OctahedronGeometry(1, 0), [0.45 * s, 0.5 * s, 0.1 * s], [0, 0, -0.4], [0.24 * s, 0.5 * s, 0.24 * s]),
      T(new THREE.OctahedronGeometry(1, 0), [-0.38 * s, 0.42 * s, -0.2 * s], [0, 0, 0.45], [0.2 * s, 0.42 * s, 0.2 * s]),
    ]);
    const m = new THREE.Mesh(g, this.mat);
    m.userData.noCollide = true;
    this.group.add(m);
    this.center = this.group.position.clone().add(V(0, 0.95 * s, 0));
    this.off = registerTarget({ kind: 'switch', radius: 0.9 * s, position: () => this.center, onHit: (mode, point, dir, info) => motherNote(rt, this, mode, info) });
  }
  hit(mode, info = {}) { return motherNote(this.rt, this, mode, info); }
  update(dt, t) {
    this.flat = Math.max(0, this.flat - dt);
    this.mat.uniforms.uGlow.value = (this.taken ? 0.9 : 0.22 + 0.06 * Math.sin(t * 2.2)) - this.flat * 0.2;
  }
  dispose() { this.off?.(); }
}

/**
 * A Choir crystal's hush (v1.83, issue #409): once the crystal is sung (its Switch `of` lit) it hums on, and the great
 * door will not open over it; a stilling glob frosts it quiet (element `id`). Its target stands in for the Switch's: a
 * plain splash, or any glob before it is sung, goes to the Switch as before. o: { id, of }
 */
class HushNote {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const sw = this.sw = rt.piece(o.of);
    sw.off?.();
    this.off = sw.off = registerTarget({ kind: 'switch', radius: Math.max(sw.o.size ?? 1.4, (sw.o.crystal ?? 0) * 0.45), accepts: ['stun'], position: () => sw.center, onHit: (mode, point, dir, info) => this.hit(mode, info) });
    this.k = rt.logic.isLit(o.id) ? 1 : 0;
    this.pos = sw.center;
  }
  hit(mode, info = {}) {
    const L = this.rt.logic;
    if (mode !== 'stun' || !L.isLit(this.o.of)) return this.sw.hit(mode === 'stun' ? 'shoot' : mode);
    if (L.isLit(this.id)) { info.dull = true; return true; }
    if (L.light(this.id)) {
      this.rt.sound?.chime?.(); this.rt.onLit?.(this.id);
      const left = ['h2', 'h3', 'h4'].filter((h) => !L.isLit(h)).length;
      this.rt.notice(left ? 'The crystal stops humming, frosted, and a lamp wakes on the great door.' : 'The Choir falls silent, and the great door’s three lamps burn.', left ? 'hush.choir' : 'hush.choir.done');
    } else {
      this.flat = 0.8; this.rt.sound?.critter?.('blip', 0.5);
      this.rt.notice('It hums on. The makers hushed from high to low: the tallest first.', 'hush.flat');
    }
    return true;
  }
  update(dt) {
    this.flat = Math.max(0, (this.flat ?? 0) - dt);
    this.k = THREE.MathUtils.clamp(this.k + (this.rt.logic.isLit(this.id) ? dt : -dt), 0, 1);
    if (this.k > 0) { this.sw.glow.uniforms.uColor.value.set(this.rt.P.glow ?? '#a8e6ee').lerp(_frost, this.k); this.sw.glow.uniforms.uGlow.value = THREE.MathUtils.lerp(this.sw.glow.uniforms.uGlow.value, 0.35, this.k); }
  }
  dispose() {}
}
const _frost = new THREE.Color('#e8f4ff');

const MOUTH_WRONG = 'Its crystal rings flat in the cold, and the jaws snap on. The makers sang from low to high: the smallest crystal first.';

/**
 * The Snapping Passage's two side mouths (the gate's is in the layout), the small key's cage on the Pendulum Gallery's far
 * landing, and the way to the great key: the ledge along the Bog Well's west wall from the root-wall's top to the well's
 * west door (one keyhole), the walk south outside the Choir's west wall and in onto its gallery; the sill and its pool.
 * (v1.77, issue #336: each side mouth in a shrine of stone out on the passage's floor, the gallery down the Choir's west
 * side, the ball's groove down its middle. v1.83, issue #409: the Nursery and its fight gone.)
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

  // ---- the small key's cage on the Pendulum Gallery's far landing: it sinks once the pendulums are sung in turn
  // (v1.83, issue #409: the Nursery's fight gave the key before); a ring of stone and two crystals round it
  const [kx, kz] = FAR_KEY;
  add(Key, { id: 'kS', at: [kx, UP, kz], yaw: Math.PI / 2 });
  K.both(M.trim, T(annulus(1.4, 1.9, 0.2, 24), [kx, UP + 0.1, kz]));
  spike(kx - 2.6, UP, kz + 1.4, 2.2, 0.4, 0.2, 1); spike(kx - 2.2, UP, kz - 1.8, 1.4, 0.3, 0.25, 2);

  // ---- the ledge along the Bog Well's west wall at UP (from the root-wall's top over the water), to the well's west door
  const WE = ROOMS.well, C2 = WE.z, Lg = LEDGE;
  K.slab(Lg.x0, Lg.z0, Lg.x1, Lg.z1, Lg.y, 0.8);
  K.both(M.trim, box(0.25, 0.3, Lg.z1 - Lg.z0, Lg.x1 - 0.12, Lg.y + 0.15, (Lg.z0 + Lg.z1) / 2));   // (a lip on its edge)
  K.both(M.trim, box(Lg.x1 - Lg.x0, 0.3, 0.25, (Lg.x0 + Lg.x1) / 2, Lg.y + 0.15, Lg.z0 + 0.12));
  for (const z of [Lg.z0 + 1.2, (Lg.z0 + Lg.z1) / 2]) K.both(M.trim, box(0.8, 1.8, 0.5, Lg.x1 - 0.6, Lg.y - 1.7, z));   // (corbels under it)
  root([[-17.2, 16, C2 - 1], [-17.4, 12, C2 - 2.6], [-17, 9.4, C2 - 4]], 0.3);
  // the well's west door (the small key), in a short passage out to the walk
  const Wk = WALK, wz = (Wk.z0 + Wk.z1) / 2;
  K.corridor([-WE.r - 0.4, Wk.from], [Wk.x1 + 0.6, Wk.from], UP, { w: D.w, h: D.h });
  add(Door, { id: 'dL', at: [Wk.door, UP, Wk.from], yaw: Math.PI / 2, w: D.w, h: D.h });
  // the walk south, outside the Choir's west wall, and in through it onto the gallery
  K.hall({ x: (Wk.x0 + Wk.x1) / 2, z: wz, w: Wk.x1 - Wk.x0, d: Wk.z1 - Wk.z0, y: UP, h: Wk.h, roof: true, frieze: false, doors: [{ side: 'e', at: Wk.from - wz, w: D.w, h: D.h }, { side: 'e', at: Wk.to - wz, w: D.w, h: D.h }] });
  K.corridor([Wk.x1 + 1.2, Wk.to], [ROOMS.choir.x0 - 0.6, Wk.to], UP, { w: D.w, h: D.h });
  spike(Wk.x0 + 1.6, UP, wz + 6, 3.4, 0.6, 0.2, 1); spike(Wk.x0 + 1.4, UP, wz - 9, 2.2, 0.45, 0.25, 2);
  root([[Wk.x0 + 0.5, UP + Wk.h - 0.5, wz - 2], [Wk.x0 + 1.2, UP + 6, wz - 1], [Wk.x0 + 0.6, UP, wz - 2.6]], 0.4);

  // ---- the Choir's gallery, down its west side 9 m over its floor (a parapet along its two open edges, piers under it,
  // the sill a gap in the parapet by the key); a wall across it with a snapper's mouth on the ball's groove, the great
  // key's cage beyond
  const B = BALCONY, gz = (B.a + B.b) / 2, gl = B.a - B.b + 1.2, L = SILL;
  K.slab(B.x0, B.z0, B.x1, B.z1, B.y, 0.8);
  K.both(M.trim, box(0.4, 1.0, B.z1 - L.z1, B.x1 - 0.2, B.y + 0.5, (L.z1 + B.z1) / 2));
  K.both(M.trim, box(0.4, 1.0, L.z0 - B.z0, B.x1 - 0.2, B.y + 0.5, (B.z0 + L.z0) / 2));
  K.both(M.trim, box(B.x1 - B.x0 - 0.4, 1.0, 0.4, (B.x0 + B.x1 - 0.4) / 2, B.y + 0.5, B.z0 + 0.2));
  for (const z of [B.z0 + 8, B.z0 + 20, B.z0 + 32, B.z0 + 44]) K.column(B.x1 - 1.2, z, 0, B.y - 0.8, 0.6);
  // the sill: two posts with a crystal on each either side of the gap, a lit edge along it; below, the black pool
  for (const z of [L.z0 - 0.3, L.z1 + 0.3]) { K.both(M.trim, box(0.7, 2.2, 0.7, B.x1 - 0.35, B.y + 1.1, z)); spike(B.x1 - 0.35, B.y + 2.2, z, 1.3, 0.3, 0, z); }
  K.add(M.glyph, box(0.12, 0.05, L.z1 - L.z0, B.x1 - 0.1, B.y + 0.03, (L.z0 + L.z1) / 2));
  const [px, pz, pr] = L.pool;
  K.both(M.trim, T(annulus(pr, pr + 0.5, 0.35, 32), [px, 0.17, pz]));
  K.add(rt.poolM ??= makeMaterial({ color: '#1d2a38', glow: 0.1, flat: true, key: 'temple.lorn.pool' }), T(new THREE.CylinderGeometry(pr, pr, 0.06, 32), [px, 0.05, pz]));
  add(Catch, { at: [px, 0, pz], r: pr, said: 'The black pool takes your fall without a sound.' });
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
  add(Mark, { room: 'balcony', at: [-19.5, B.y, 70], yaw: Math.PI / 2 });
}

// ------------------------------------------------------------------ inside
// (since v1.77, issue #336, docs/design/temple-redesign.md: every hall 30 to 36 m across under 18 m of stone or more, the
// round halls 28 to 38 m, doors 7 by 9; each puzzle in the middle of its room. Since v1.83, issue #409, the Choir is the
// great hall, 44 by 66 m, and the house has no fight)
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

  // ---- the Choir, the house's great hall: three crystals, each its own height, out on its floor; splash them low to high
  // (after the door's). Down its west side the gallery, 9 m up (wings), its way in through the west wall from the walk;
  // in its east wall the great door to the Mother
  const CH = R0.choir, [, cz] = mid(CH);
  hall(CH, { roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }, { side: 'w', at: WALK.to - cz, w: D.w, h: D.h, y0: UP }, { side: 'e', at: HZ - cz, w: D.w, h: D.h }] });
  for (const [id, x, z, h] of [['c3', -8, 46, 4.4], ['c4', -1.5, 70, 5.6], ['c2', 9, 73, 3.1]])
    add(Switch, { id, at: [x, 0, z], crystal: h, size: 0.9, wrong });
  // where the fourth stood: an empty ring of stone
  K.both(M.trim, T(annulus(1.0, 1.5, 0.25, 24), [9, 0.12, 50]));
  K.both(M.trim, T(annulus(1.8, 2.4, 0.3, 28), [0, 0.15, 59]));
  K.add(M.glyph, T(glyphGeometry(2.6, 0.05).rotateX(-Math.PI / 2), [0, 0.32, 59]));
  for (const z of [cz - 24, cz - 12, cz + 12, cz + 24]) K.column(CH.x1 - 2.5, z, 0, CH.top, 0.9);
  add(Door, { id: 'd1', at: [0, 0, CH.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] });
  // (the way in from the Threshold: the first note, sung at the door, opens it, and the great hall is there)
  add(Door, { id: 'd0', at: [0, 0, CH.z0 - 0.6], w: D.w, h: D.h, lamps: [{ lit: 'c1' }] });
  add(Mark, { room: 'choir', at: [CH.x1 - 6, 0, CH.z0 + 5], yaw: -Math.PI / 2 });
  spike(-19, 0, 35, 6, 0.9, 0.15); spike(18.6, 0, 94, 7.5, 1.0, -0.2, 2); spike(16.4, 0, 35.5, 4, 0.7, -0.1, 1);
  root([[CH.x1 - 0.5, 26, 92], [CH.x1 - 1.6, 17, 88], [CH.x1 - 0.8, 7, 83], [CH.x1 - 1, 0, 80]], 0.7);

  // ---- the Bog Well (a round hall on its water's floor): a disc that climbs over the dark water, then a wall of roots to UP
  const WE = R0.well, C2 = WE.z, R = WE.r, N0 = C2 - WE.near, F0 = C2 + WE.face;
  K.corridor([0, CH.z1 + 1.2], [0, C2 - R - 0.4], 0, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C2, y: WE.y, r: R, h: WE.top - WE.y, seg: 36, floor: false, gaps: [{ a: Math.PI, w: D.w, h: D.h, y0: -WE.y }, { a: 0, w: D.w, h: D.h, y0: UP - WE.y }, { a: -Math.PI / 2, w: D.w, h: D.h, y0: UP - WE.y }], oculus: 0.3 });   // (and west at UP, the ledge's door: the way to the gallery)
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

  // ---- the Pendulum Gallery: a narrow bridge over a chasm, three crystal pendulums across it; on its far landing the
  // small key's cage (wings), the house's north end since v1.83
  const GA = R0.gallery, G0 = GA.z0, Q0 = G0 + GA.near, Q1 = Q0 + GA.pit, gy = GA.floor - GA.y;
  K.slab(-D.w / 2, G0 - 1.6, D.w / 2, G0 + 0.6, UP, 0.8);
  add(Jaw, { id: 'd2', still: 'j3', at: [0, UP, G0 - 0.6], w: D.w, h: D.h, seed: 1, wrong: MOUTH_WRONG,
    stilled: 'The gate’s great crystal rings true, last and highest, and the jaws stop dead, frosted, and ease open. They forget to close.' });
  // (its crown, the biggest of the three: over the gate, on the passage's side)
  K.both(M.trim, box(1.4, 0.3, 0.8, 0, UP + D.h + 0.95, G0 - 1.5));
  spike(0, UP + D.h + 1.1, G0 - 1.5, 1.8, 0.45, 0, 0.4);
  hall(GA, { floor: false, roof: true, doors: [{ side: 's', w: D.w, h: D.h, y0: gy }] });
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
    add(Swing, { id, at: [0, 21, z], len: 10, amp: 0.95, period: 2.6 + i * 0.3, phase: i * 0.31, size, wrong: flat, heard: 'The stilled crystal’s note rings true, and a lamp wakes over the key’s cage.' });
  }
  rt.galleryWings = rt.pieces.filter((p) => p instanceof Swing && /^w\d$/.test(p.id ?? ''));
  add(Mark, { room: 'gallery', at: [-9, UP, G0 + 5], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [8, UP, Q1 + 7], yaw: Math.PI });
  spike(13, UP, GA.z1 - 3, 4.2, 0.7, -0.2, 1); spike(-14, UP, GA.z1 - 2.5, 3, 0.55, 0.2, 2);

  // ---- the great door in the Choir's east wall, the antechamber, and the Mother's Hall (floor 0): a round hall, the
  // Mother rooted past its middle facing the door, the smallest crystal at her root, three pendulums jangling over her
  const MH = MOTHER_HALL, A0x = CH.x1 + 1.2, A1x = HX - HR - 0.4;
  for (const c of ['c2', 'c3', 'c4']) add(HushNote, { id: `h${c[1]}`, of: c });
  add(Door, { id: 'dG', at: [CH.x1 + 0.6, 0, HZ], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'h2' }, { lit: 'h3' }, { lit: 'h4' }],
    locked: 'The great lock. Its key is up on the gallery, behind the jaws.' });
  K.corridor([A0x, HZ], [A1x, HZ], 0, { w: D.w, h: D.h });
  add(Mark, { room: 'ante', at: [(A0x + A1x) / 2, 0, HZ - ANTE.half + 1], yaw: 0 });
  K.rotunda({ x: HX, z: HZ, y: 0, r: HR, h: R0.hall.top, seg: 40, gaps: [{ a: -Math.PI / 2, w: D.w, h: D.h }, { a: Math.PI / 2, w: D.w, h: D.h }], oculus: 0.25 });
  const MX = HX + MH.from;
  // her bed: a ring of dark soil and moss round her root
  K.both(M.floor, T(new THREE.CylinderGeometry(6.5, 7, 0.3, 32), [MX, 0.12, HZ]));
  K.both(M.trim, T(annulus(6.5, 7.2, 0.4, 36), [MX, 0.2, HZ]));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.2;
    if (Math.abs(Math.cos(a)) < 0.4) continue;   // (clear of the two doorways, west and east)
    spike(HX + Math.sin(a) * (HR - 1.6), 0, HZ + Math.cos(a) * (HR - 1.6), 5 + (i % 3) * 2, 0.9, Math.cos(a) * 0.25, a);
  }
  // the way out, past the far door
  const X0 = HX + HR + 0.7, X1 = HX + HR + 10;
  add(Door, { id: 'd5', at: [X0, 0, HZ], yaw: Math.PI / 2, w: D.w, h: D.h });
  K.slab(X0 - 0.1, HZ - 4.6, X1, HZ + 4.6, 0, 0.8);
  K.wall(X0 + 0.7, HZ - 4.2, X1, HZ - 4.2, 0, 10, { t: 0.8 }); K.wall(X1, HZ + 4.2, X0 + 0.7, HZ + 4.2, 0, 10, { t: 0.8 });
  K.wall(X1, HZ - 4.2, X1, HZ + 4.2, 0, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(X1 - X0 + 0.4, 0.8, 9.2, (X0 + X1) / 2, 10.4, HZ));
  K.both(M.voidM, box(0.9, 5, 3.4, X1 + 0.35, 2.5, HZ));

  // the lullaby: the smallest crystal at her root (its first note), three crystal pendulums out of order round her
  // (by size: rank 1 the smallest of them), out of tune and jangling till frosted (hush, motherFrost, motherNote)
  const C = rt.motherCrystals = { next: 0, from: null, swings: [], notes: [], cover: 4.5, door: K.world(HX - HR + 1, 0, HZ) };
  C.root = add(RootNote, { at: [MX - MH.root, 0, HZ], size: 1 });
  K.both(M.trim, T(annulus(1.2, 1.6, 0.2, 24), [MX - MH.root, 0.1, HZ]));
  const resolved = rt.logic.resolved;
  for (const [i, [rank, dx, dz, size]] of MH.swings.entries()) {
    const x = MX + dx, z = HZ + dz;
    K.add(M.trim, box(2.4, 0.5, 0.6, x, 21.3, z));
    const sw = add(Swing, { at: [x, 21, z], len: 12, amp: 0.38, period: 3.0 + i * 0.35, phase: i * 0.27, size, yaw: Math.atan2(dx, dz), gentle: true, knock: 6, onStill: (s) => motherFrost(rt, s) });
    sw.rank = rank;
    const base = sw.hit.bind(sw);
    sw.hit = (mode, info = {}) => (mode === 'shoot' ? motherNote(rt, sw, mode, info) : base(mode, info));
    if (resolved) { sw.frost = true; sw.stillFor = Infinity; sw.still = Infinity; }
    C.swings.push(sw);
  }
  C.notes = [C.root, ...C.swings].sort((a, b) => a.rank - b.rank);
  if (resolved) for (const n of C.notes) n.taken = true;

  const model = snapperModel({ reach: 12 });
  model.pos.copy(K.world(MX, 0, HZ));
  model.home = model.pos.clone();
  model.heading = K.heading(-Math.PI / 2);
  model.rest = model.pos.clone();
  model.restHeading = K.heading(-Math.PI / 2);
  const arena = { center: K.world(HX, 0, HZ), r: HR, y: K.world(0, 0, 0).y };

  // (the wings last: their marks after the others, so the machines' ids by mark stay as they were)
  wings(rt, K, M, { spike, root });
  const W = (x, y, z) => K.world(x, y, z), Wk = WALK, [fx, fz] = FAR_KEY;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(Wk.x0 - 6, -10, -3), V(X1 + 2, 40, GA.z1 + 6)),
    gadget: { at: W(0, UP + 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(X1 - 0.4, 0.5, HZ), r: 1.5 }],
    lights: [[0, 5, 14, 16], [2, 8, 46, 24], [4, 8, 76, 24], [-15, UP + 5, 70, 16], [-4, 4, 53, 10], [0, 4, C2, 18], [(Wk.x0 + Wk.x1) / 2, UP + 4, (Wk.z0 + Wk.z1) / 2, 14],
      [0, UP + 5, C3, 14], [0, UP + 5, SP.z0 + 15, 18], [0, UP + 5, G0 + 7, 16], [0, 14, (Q0 + Q1) / 2, 18], [0, UP + 5, Q1 + 7, 16], [fx, UP + 4, fz, 10], [(A0x + A1x) / 2, 5, HZ, 10], [HX, 9, HZ, 22]],
    guardian: { def: { ...MOTHER, onHit: motherHit, onReset: (g) => motherReset(rt, g) }, model, arena },
  };
}

/**
 * Knocked out in her hall (Guardian.reset: her meter back where her phase began): the lullaby's notes fade; knocked out
 * before her hall was hushed, the frost falls off the pendulums and they jangle again.
 */
function motherReset(rt, g) {
  const C = rt.motherCrystals;
  if (!C) return;
  for (const n of C.notes) n.taken = false;
  C.next = 0; C.from = null; C.sung = false;
  if (g.floor < CALM.hush * 3 - 1e-6) for (const s of C.swings) { s.frost = false; s.stillFor = 6; s.still = 0; }
  g.listen = undefined;
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
  gadget: 'stun', gadgetBox: 'perdide.temple.stun', arenaDoor: 'dG', arenas: ARENAS,
  origin: [-100, 1700, 300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (the hush, every frame: the pendulums' jangle, and what the Mother hears: issue #409)
  onUpdate: (rt, dt) => hush(rt, dt),
  // (its futuristic skin, issue #342: src/temples/skins/hush-house.js; look only)
  skin: hushHouseSkin,
  local: { person: 'teasel', out: 9, side: 6 },
  enterLine: 'Inside the Hush-House it is green and cool, and the crystals hum, each its own note. Somewhere ahead, something snaps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out on the swamp, at the foot of every snapping plant, flowers open.', 'resolved.out'); },
};
