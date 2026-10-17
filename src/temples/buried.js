import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bank, Platform, Bridge, Hammer, Mark, Pit, Key, BellEar, HookBell } from './pieces.js';
import { sentinelModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { ARCHETYPES } from '../enemies/archetypes.js';
import { engineHouseSkin } from './skins/engine-house.js';

// The Buried Machine's temple: the Engine-House, a drum of rust-red iron as
// tall as the oculus, standing out of the dunes west of the domes, pipe
// elbows round its foot and a ring window high up. The dome people say the
// wheel's engine is in there, and the Tooth-Warden that minds it: it has been
// jamming the engine since the night the sky rang, which is why the wheel
// turns one tooth a year and no more. It is a machine: you may stop it.
//
// Inside (built far overhead, through its oval door), two ideas from the first room to the last. A BALL IN THE TEETH
// STOPS THE ENGINE THERE (the temple design audit, v1.19): the makers' own jams are stone balls, rolled into a crank's
// teeth, and what that crank drives stops where it stands. And (v1.83, issue #415, the approved best practices: G1)
// THE ENGINE DRIVES ONE SHAFT AT A TIME: the great engine in the middle of the Engine Hall sends its power up the upper
// shaft (the pistons and the hammer of the upper floor run) or down the lower one (the lower floor's: the boilers'
// firebox door, the Governor Room's pistons and hammer). A clutch lever by each of the hall's two floors moves it, and
// a gauge in every room shows where it is: the upper lamp amber, the lower lamp blue.
//   the Threshold          the first mark, the way out
//   the Engine Hall        (G4) the great hall, 44 by 70 m under 32: its floor and its gallery 7 m up round its north end
//                          and west side, seen at once. The engine in its middle, its valve's eye on a post by the way in
//                          and a stone ball in its crank's teeth: shot and rolled out, it wakes. Three pistons on its
//                          flywheel ride up to the gallery; from its west side a marked drop back to the floor (G6)
//   the Boiler Room        (east, the lower floor; G3b) its firebox door rises on the lower shaft. In it the Boiler
//                          Keeper, a furnace brute grown huge in the cold boilers' heat, the house's mini-boss: its doors
//                          shut behind you while it stands. Its slam sends a quake along the floor and leaves its fists
//                          stuck, open to the blade: the Tooth-Warden's slam and its open vents, taught a room early.
//                          Beaten, the small key's cage sinks and the door north opens
//   the Fourth Chamber     the makers' chest: INK BOMBS (src/gadgets/bomb.js). Four eyes on posts round the chest wake
//                          only together, inside one breath: four hits, and the bar holds three shots, so one bomb's blast
//                          among two of them. Woken, its shutter rolls up, a way back west into the hall's floor (a loop)
//   the Governor Room      (west, the lower floor) the great key caged on an anvil, the hammer over the cage; one ball
//                          between two cranks, the hammer's and the one under four eyes on pistons behind a parapet, both
//                          on the lower shaft. Rolled to the pistons', they stand for four in a breath, but the hammer
//                          runs, down on the cage; roll it back, or send the power upstairs, and the cage sinks
//   the Crank Hall         (north, the upper floor) a walkway over a pit and the engine's great hammer slamming down on
//                          it while the upper shaft turns. A ball's groove on the near landing runs into its crank's teeth
//   the Crank Passage      four eyes on pistons behind a parapet that rise in turn on the upper shaft, one crank for all
//                          four: jam it with the ball by it, all four up, a bomb over the parapet. And the small key
//   the Furnace            a chasm over embers; the bridge rises on four eyes in one breath, each on a piston of the upper
//                          shaft behind the far parapet, rising in turn. Two cranks on the near lip hold the two west ones
//                          up with a ball each; the two east ones stand only while their clutch is pulled in: its ring
//                          hangs over the far lip, and the grappling hook (the Founders' Belfry's) tugs it for a few
//                          breaths. In those breaths, a bomb lobbed among them (G2: the house's tool and an older one)
//   the Tooth-Warden's Hall the guardian (a robot: its meter is damage). When its four vents open, hit all four inside
//                          a breath: a bomb at its feet takes the vents its blast reaches, splash the rest. From its second phase it turns on the great gear in the floor; a ball in the
//                          gear's teeth jams its turning (a volley then counts twice). In its last it opens turning,
//                          one vent at a time facing out, and stamps the ball out of the teeth as it shifts: roll it
//                          back in, and all four stay open
// After: the engine runs, and the machine's old pipe-cart runs again: from the start hollow down the canyon
// to the oculus and back, a riding floor (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** West of the domes, on the dunes; its door looks east, toward the start hollow. */
export const SITE = { x: -122, z: 98, r: 22 };
SITE.heading = Math.atan2(0 - SITE.x, 60 - SITE.z);

/**
 * The engine's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/engine-house):
 * rust iron in riveted plates, strapped in steel blue (the frames, a strap under every frieze and at the foot, a strap
 * down the wall with a brass valve wheel), grey iron floor plates, brass fittings, the pipes and rods blue steel; its
 * shade a deep rust that keeps the iron's red, its light the furnace's warm.
 */
export const PALETTE = {
  wall: '#ad5a3e', wall2: '#a04f36', wall3: '#b96549', floor: '#8f8676', floor2: '#827a6b', trim: '#5f7592', fitting: '#c09a48',
  dark: '#2f3a48', stone: '#7d90a6', accent: '#4f9a98', glow: '#f6c84e', lamp: '#f6c84e', sand: '#e9dcc0', sand2: '#d6c8a6',
  look: {
    all: { shadeFlat: 0.05, shadeHue: 1, shade: 0.12 },
    wall: { mode: 0, grid: 1.8, plates: true, detail: 'built' },
    wallGlyph: { detail: 'built' },
    floor: { mode: 0, grid: 1.6, plates: true },
  },
  bands: [{ at: 0.72, h: 0.8, color: '#5f7592' }, { y: 1.1, h: 0.6, color: '#5f7592' }],
  ornament: { kind: 'valve', color: '#c09a48', color2: '#5f7592', metal: 'brass' },
  light: { shadow: '#86636a', light: '#ffe6c8', sun: '#ffd9a8' },
};

/**
 * The engine's stroke: the pistons of a bank rise in turn, each up for `up` s of every `period` (s), while their shaft
 * turns; jammed, one stays up. The hall's gear: in the warden's last phase, unjammed, one vent faces out at a time, each
 * for `turn` s (four inside a breath can't be done); jammed, all four. What a volley is worth in its second phase,
 * jammed and not.
 */
export const STROKE = { period: 8, up: 1.2 };
export const GEAR = { turn: 1.4, jammed: 0.25, free: 0.125 };

/** (issue #415) The engine runs: its valve's eye lit, and the stone ball rolled out of its crank's teeth. */
export const RUN = { all: [{ lit: 's1' }, { drumOn: ['ball0', 'pY'] }] };
/** Its power up the upper shaft (the upper floor's pistons and hammer run), or down the lower one (the floor's). */
export const UPPER = { all: [RUN, { drumOn: ['shaft', 'shaftUp'] }] }, LOWER = { all: [RUN, { drumOn: ['shaft', 'shaftLow'] }] };
/**
 * The clutch alone (the logic of the rooms past the engine: the engine is running by the time you reach any of them, the
 * hall's pistons and the firebox door want it, and its ball, once out of the teeth, stays out; the pieces that move show
 * UPPER and LOWER, the running engine with them).
 */
export const UP_SHAFT = { drumOn: ['shaft', 'shaftUp'] }, LOW_SHAFT = { drumOn: ['shaft', 'shaftLow'] };
/** The Furnace's east clutch: tugged with the hook, it holds for `hold` s (a held bell). */
export const CLUTCH = { hold: 14 };

export const LOGIC = {
  id: 'buried', entry: 'threshold', gadget: 'bomb',
  // (v1.77, issue #336: every room tagged with its kind; v1.83, issue #415: the Engine Hall's floor keeps the Piston
  // Hall's id, `pistons`, its gallery `gallery`; the Crank Hall `weight`, the Crank Passage `crank`; the Boiler Room the
  // one fight, its keeper the mini-boss)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, pistons: { checkpoint: true, kind: 'puzzle' }, gallery: { checkpoint: true, kind: 'passage' },
    boiler: { checkpoint: true, kind: 'combat' }, cell: { checkpoint: true, kind: 'puzzle' }, gov: { checkpoint: true, kind: 'puzzle' },
    weight: { checkpoint: true, kind: 'puzzle' }, crank: { checkpoint: true, kind: 'puzzle' }, furnace: { checkpoint: true, kind: 'puzzle' },
    furnaceFar: { checkpoint: true, kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'pistons' },
    { a: 'pistons', b: 'gallery', door: 'pumps' },    // the hall's three pistons, riding up to the gallery while the engine runs
    { a: 'gallery', b: 'pistons', oneWay: true },     // (G6) the gallery's west side, open over the floor for 10 m: a drop to the hub
    { a: 'pistons', b: 'boiler', door: 'dF' },        // the boilers' firebox door, risen on the lower shaft (it shuts behind you while the keeper stands)
    { a: 'boiler', b: 'cell', door: 'dC' },           // north, beaten: the Fourth Chamber and its chest (G3b: the keeper guards the tool)
    { a: 'cell', b: 'pistons', door: 'dS' },          // its shutter, its four eyes awake: west back into the hall's floor (the loop)
    { a: 'cell', b: 'gov', door: 'dG' },              // north: the Governor Room (the great key), its shutter wound up by the lower shaft and held by a ball
    { a: 'gallery', b: 'weight', door: 'dU' },        // north off the gallery: the Crank Hall, its bulkhead lifted by the upper shaft
    { a: 'weight', b: 'crank', door: 'h1' },          // its hammer over the walkway, its crank jammed (it runs while the upper shaft turns)
    { a: 'crank', b: 'furnace', door: 'd3' },         // its door: four eyes in a breath, and the small key
    { a: 'furnace', b: 'furnaceFar', door: 'br1' },
    { a: 'furnaceFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Engine Hall: the valve's eye, and a ball sitting in the engine's crank: shot and rolled out of the teeth (pY), it runs
    s1: { type: 'switch', room: 'pistons' },
    ball0: { type: 'drum', room: 'pistons', plate: 'pY', plateAt: 0, stops: { pY: 0, pZ: 1 }, start: 1 },
    pY: { type: 'plate', room: 'pistons' },
    pZ: { type: 'plate', room: 'pistons' },
    // (issue #415) the house's state: the engine's clutch, its power up the upper shaft (1, as it was left) or down the
    // lower (0), saved. Set at a clutch lever by each hub, the hall's floor and its gallery, the Fourth Chamber, and in the Crank Passage (the drum's rooms); its two
    // stops are no plates anyone stands on. (Last of the things to do, so the scout asks for it only once nothing nearer is left)
    pumps: { type: 'bridge', opens: RUN },          // (the hall's pistons ride the flywheel itself, whichever shaft has the power)
    dF: { type: 'door', opens: LOWER },
    // the Boiler Room: its keeper beaten, the small key's cage sinks and the door north opens onto the chest
    arB: { type: 'arena', room: 'boiler' },
    kS: { type: 'key', kind: 'small', room: 'boiler', when: { lit: 'arB' } },
    dC: { type: 'door', opens: { lit: 'arB' }, latch: true },
    // (issue #377: the chest held the fourth chamber, more magic; ink bombs now, the shots the bar can't hold)
    chest: { type: 'gadget', room: 'cell', item: 'bomb' },
    k0: { type: 'switch', room: 'cell', needs: ['bomb'] },          // the chamber's four still eyes round the chest
    dS: { type: 'door', opens: { lit: 'k0' }, latch: true },        // its shutter, west into the hall's floor
    // the Governor Room's shutter, north off the chamber: the lower shaft winds it up and up and lets it fall, unless a ball
    // holds its crank at the top (a ball in the teeth stops the engine there: here, with the way open); then its pawl
    // holds it
    bD: { type: 'drum', room: 'cell', plate: 'pD', plateAt: 1, start: 0.12 },
    pD: { type: 'plate', room: 'cell' },
    dG: { type: 'door', opens: { all: [{ lit: 'k0' }, { drumOn: ['bD', 'pD'] }, LOW_SHAFT] }, latch: true },   // (and, as the west one, the four eyes awake)
    // the Governor Room: one ball and two cranks on the lower shaft, the hammer's (over the great key's cage, on its anvil)
    // and the one under four eyes on pistons. It starts in the hammer's: the hammer still, the pistons rising in turn. Rolled
    // to the pistons', they stand for four in a breath, but the hammer runs, down on the cage; rolled back (a woken eye stays
    // awake), or the power sent upstairs, the hammer stands still and the cage sinks
    // (the eyes before the ball: once they can wake, the marker points at them, not at the ball's other stop)
    k3: { type: 'switch', room: 'gov', needs: ['bomb'], when: { all: [{ drumOn: ['bQ', 'pQ'] }, LOW_SHAFT] } },
    bQ: { type: 'drum', room: 'gov', stops: { pH: 0, pQ: 1 }, start: 0 },
    pH: { type: 'plate', room: 'gov' },
    pQ: { type: 'plate', room: 'gov' },
    h2: { type: 'door', opens: { any: [{ not: LOW_SHAFT }, { drumOn: ['bQ', 'pH'] }] } },   // the hammer stopped (no doorway: it guards the cage)
    kB: { type: 'key', kind: 'big', room: 'gov', when: { all: [{ lit: 'k3' }, { open: 'h2' }] } },
    // the Crank Hall: its ball rolled down its groove across the near landing into the hammer's crank (pJ): the hammer
    // stops. It runs while the upper shaft turns, and that is the only way in (the bulkhead)
    ballJ: { type: 'drum', room: 'weight', plate: 'pJ', plateAt: 1, start: 0.09 },   // (issue #275: it starts 1 m along its groove, off the wall it lay against: room behind it to push from)
    pJ: { type: 'plate', room: 'weight' },
    // (the Crank Hall's bulkhead off the gallery: lifted while the upper shaft turns, so the hammer runs whenever you come
    // in; it stands still on the lower shaft too, but then the bulkhead is down: PoweredHammer)
    dU: { type: 'door', opens: UP_SHAFT },
    h1: { type: 'door', opens: { drumOn: ['ballJ', 'pJ'] } },
    // the Crank Passage: four eyes on pistons that rise in turn on the upper shaft, one crank for all four: jammed, all stay up
    bK: { type: 'drum', room: 'crank', plate: 'pK', plateAt: 1, start: 0.22 },   // (issue #275: it starts 0.9 m along its groove, off the wall it lay against: room behind it to push from)
    pK: { type: 'plate', room: 'crank' },
    k1: { type: 'switch', room: 'crank', needs: ['bomb'], when: { all: [{ drumOn: ['bK', 'pK'] }, UP_SHAFT] } },   // four eyes in one breath
    d3: { type: 'door', lock: 'small', opens: { lit: 'k1' }, latch: true },
    // the Furnace: the two west pistons jammed up (a ball in each crank), the two east held up by their clutch (its ring
    // hooked from the near lip: a held bell, CLUTCH.hold s), all four on the upper shaft; then four in a breath
    bA: { type: 'drum', room: 'furnace', plate: 'pA', plateAt: 1, start: 0.43 },   // (issue #275: it starts 1.5 m along its groove, off the wall it lay against: room behind it to push from)
    pA: { type: 'plate', room: 'furnace' },
    bB: { type: 'drum', room: 'furnace', plate: 'pB', plateAt: 1, start: 0.43 },   // (issue #275: it starts 1.5 m along its groove, off the wall it lay against: room behind it to push from)
    pB: { type: 'plate', room: 'furnace' },
    cF: { type: 'bell', room: 'furnace', needs: ['hook'], hold: CLUTCH.hold },
    k2: { type: 'switch', room: 'furnace', needs: ['bomb'], when: { all: [{ drumOn: ['bA', 'pA'] }, { drumOn: ['bB', 'pB'] }, { lit: 'cF' }, UP_SHAFT] } },
    br1: { type: 'bridge', opens: { lit: 'k2' }, latch: true },
    d4: { type: 'door', lock: 'big' },                            // the great key's door (and the arena's: shut while the warden fights)
    // the hall's great gear: a ball in its teeth stops the warden turning (its last phase wants it)
    bG: { type: 'drum', room: 'hall', plate: 'pG', plateAt: 1, start: 0.07 },   // (issue #275: it starts 0.5 m along its groove, off the wall it lay against: room behind it to push from)
    pG: { type: 'plate', room: 'hall' },
    warden: { type: 'boss', room: 'hall', needs: ['gun', 'bomb'], requires: { drumOn: ['bG', 'pG'] } },
    d5: { type: 'door', opens: { resolved: true } },
    // (issue #415) the engine's clutch, the house's state (see above)
    shaft: { type: 'drum', room: 'pistons', rooms: ['gallery', 'cell', 'crank'], stops: { shaftLow: 0, shaftUp: 1 }, start: 1, roll: 'hand', verb: 'power' },
    shaftLow: { type: 'plate' }, shaftUp: { type: 'plate' },
    // the house's map, in a little chest on the gallery (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'gallery', at: [19.6, 7, 79.4], yaw: -Math.PI / 2 },
  },
};

export const TOOTH_WARDEN = {
  kind: 'robot', name: 'the Tooth-Warden', final: 'break', speed: 1.6, wakeTime: 2.8,
  wake: 'The machine in the hall stands up on four legs. Its lamp turns to you.',
  openHint: 'All four vents open, glowing. Bomb a vent, splash the rest, quickly.',
  resolved: 'The Tooth-Warden locks up and goes still. Below you, the engine runs.',
  missHint: 'It ploughs into the wall: all four vents open. Hit all four.',
  phases: [
    { to: 0.5, attacks: ['beam', 'mortar', 'stomp'], pause: 1.6, hint: 'Its four vents open: all four in a breath. A bomb on one takes three.' },
    { to: 0.75, attacks: ['grind', 'beam', 'stomp'], pause: 1.2, hint: 'Jam the floor gear with the ball: then its vents count twice.' },
    { to: 1.0, attacks: ['charge', 'mortars', 'grind'], pause: 1.0, hint: 'It stamped the ball out: roll it back into the gear’s teeth.',
      openHint: 'Its vents open one at a time. Jam the gear for all four.' },
  ],
  attacks: {
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'eye', rig: 'lean', blast: { kind: 'beam', r: 0.75 }, damage: 1, knock: 10, recover: 0.8, open: 3.2 },
    mortar: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    mortars: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', pose: 'mortar', damage: 0.5, knock: 6, recover: 0.6 },
    stomp: { shape: 'ring', at: 'self', ahead: 4, radius: 6, wind: 1.2, part: 'feet', rig: 'rear', blast: { kind: 'front', r0: 1, h: 0.6 }, active: 0.3, reach: 6, gap: 0.7, damage: 0.75, knock: 9, recover: 0.4, then: 'stomp2' },
    stomp2: { shape: 'ring', at: 'self', ahead: 4, radius: 6, wind: 0.7, part: 'feet', rig: 'rear', pose: 'stomp', link: true, blast: { kind: 'front', r0: 1, h: 0.6 }, active: 0.3, reach: 6, damage: 0.75, knock: 9, gap: 0.25, then: 'slam' },
    slam: { shape: 'ring', at: 'self', radius: 6.5, wind: 1.3, part: 'feet', rig: 'rear', link: true, wave: { speed: 9, reach: 18, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 1, h: 0.8 }, active: 0.3, damage: 1, knock: 13, recover: 1.0, open: 3.0 },
    grind: { shape: 'ring', at: 'self', radius: 6, wind: 1.3, part: 'core', rig: 'spin', blast: { kind: 'front', r0: 1, h: 0.8 }, active: 0.35, reach: 6, gap: 0.3, damage: 0.75, knock: 12, recover: 0.6, then: 'beamEnd' },
    beamEnd: { shape: 'lane', range: 28, width: 2.6, wind: 1.1, track: 0.6, part: 'eye', rig: 'lean', pose: 'beam', link: true, blast: { kind: 'beam', r: 0.75 }, damage: 1, knock: 10, recover: 0.8, open: 3.2 },
    charge: { shape: 'lane', range: 16, width: 4.4, wind: 1.3, track: 0.65, part: 'eye', rig: 'crouch', dash: 11, parts: ['body'], splash: 0.3, active: 0.45, damage: 1, knock: 12, recover: 1.0, open: 1.6, miss: 3.2 },
  },
};
export const VOLLEY = 2.6;   // s: the four vents must all be hit inside this

function wardenHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its hull.', 'tw.push'); return true; }
  if (g.state !== 'open') g.rt.notice('Its vents are shut. Wait for them to open.', 'tw.shut');
  return true;
}
/** In its last phase it stays open a little longer: four in a breath once the gear is jammed. */
function wardenOpenFor(g, a, s) { return s && g.phaseIndex >= 2 ? Math.max(s, 4.2) : s; }

/**
 * The great gear in the hall's floor: it turns with the warden (from its second phase) until a ball sits in its
 * teeth. A ring of iron teeth that turns (dynamic), its notch by the wall's groove.
 */
class Gear {
  constructor(rt, { at, r, jam }) {
    this.rt = rt; this.jam = jam;
    this.group = new THREE.Group();
    this.group.position.copy(rt.kit.world(...at));
    this.group.rotation.y = rt.kit.yaw;
    rt.root.add(this.group);
    const parts = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; parts.push(T(new THREE.BoxGeometry(1.2, 0.05, 1.6), [Math.sin(a) * r, 0.03, Math.cos(a) * r], [0, a, 0])); }
    const m = new THREE.Mesh(mergeGeometries(parts), makeMaterial({ color: PALETTE.dark, flat: true, key: 'temple.buried.gear' }));
    m.userData.noCollide = true; m.userData.dynamic = true;
    this.group.add(m);
    this.w = 0;
  }
  get jammed() { return this.rt.logic.check(this.jam); }
  update(dt) {
    const G = this.rt.guardian, turning = !this.jammed && G && G.phaseIndex >= 1 && G.state !== 'sleep' && G.state !== 'resolved';
    this.w += ((turning ? 0.5 : 0) - this.w) * Math.min(1, dt * 2);
    this.group.rotation.y += this.w * dt;
  }
}

/**
 * The furnace's two cranks on the near lip: wheels that turn with the engine's stroke, each driving a piston across
 * the chasm by its rod, until a ball sits in its teeth (`jam`, one per wheel): then it stops, and its piston stays up.
 */
class Cranks {
  constructor(rt, { at, to = [], r, jam, rods = true }) {
    this.rt = rt; this.jam = jam;
    const K = rt.kit, M = rt.M;
    const mat = makeMaterial({ color: PALETTE.trim, flat: true, key: 'temple.buried.crank' });
    this.wheels = at.map((p) => {
      const g = new THREE.Group();
      g.position.copy(K.world(...p)); g.rotation.y = K.yaw;
      rt.root.add(g);
      const parts = [new THREE.TorusGeometry(r, 0.18, 6, 28).rotateY(Math.PI / 2), new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12).rotateZ(Math.PI / 2)];
      for (let i = 0; i < 4; i++) parts.push(new THREE.BoxGeometry(0.14, r * 2, 0.14).rotateX((i / 4) * Math.PI));
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; parts.push(new THREE.BoxGeometry(0.28, 0.32, 0.3).rotateX(a).translate(0, Math.cos(a) * (r + 0.18), Math.sin(a) * (r + 0.18))); }
      const m = new THREE.Mesh(mergeGeometries(parts), mat);
      m.userData.noCollide = true; m.userData.dynamic = true;
      g.add(m);
      return m;
    });
    // the rods: iron bars from each wheel's hub across the chasm to its piston's foot
    if (rods) for (const [i, p] of at.entries()) {
      const q = to[i], len = Math.hypot(q[2] - p[2], q[1] - p[1]);
      K.add(M.stone, T(new THREE.BoxGeometry(0.3, 0.3, len), [p[0] + 0.45, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], [Math.atan2(p[1] - q[1], q[2] - p[2]), 0, 0]));
    }
  }
  update(dt) {
    for (const [i, w] of this.wheels.entries()) if (!this.rt.logic.check(this.jam[i])) w.rotation.x += dt * (TAU / STROKE.period);
  }
}

// ------------------------------------------------------------------ the engine's power (v1.83, issue #415: G1)
/** The power's lamps: the upper shaft's amber, the lower's blue; dark while the engine is still (or the other shaft turns). */
export const POWER_LOOK = { up: '#f6b84e', low: '#58c4d8', off: '#33394a', glow: [0.05, 0.95] };
const upLamp = () => makeMaterial({ color: POWER_LOOK.off, glow: POWER_LOOK.glow[0], flat: true, key: 'temple.buried.power.up' });
const lowLamp = () => makeMaterial({ color: POWER_LOOK.off, glow: POWER_LOOK.glow[0], flat: true, key: 'temple.buried.power.low' });
const _pc = new THREE.Color();
const smooth = (k) => k * k * (3 - 2 * k);

/**
 * The great engine in the middle of the Engine Hall (issue #415), the house's state: its flywheel turns while it runs (RUN),
 * and its clutch sends the power up the upper shaft, a column of iron to the roof and along it north over the upper
 * floor, or down the lower one into the floor (a ring of grating round it); the shaft with the power turns, the other
 * stands. Its clutch arm points up or down, and it lights the house's lamps (upLamp, lowLamp: every gauge's and lever's).
 * A clutch lever (PowerLever) sets it; it points the scout at the nearest one (`center`).
 * o: { id: 'shaft', at: [x, y, z] the gearbox's foot (local), roof (the shaft's top, local y), north (local z it runs to) }
 */
export class GreatEngine {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at;
    this.up = upLamp(); this.low = lowLamp();
    this.foot = K.world(x, y, z);
    // the gearbox on four legs over the floor's ring (solid), its two lamps on its south face: the upper over the lower
    for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) K.both(M.trim, box(0.5, 2.2, 0.5, x + dx, y + 1.1, z + dz));
    K.both(M.dark, box(4.2, 2.6, 4.2, x, y + 3.5, z));
    K.add(M.trim, box(4.5, 0.3, 4.5, x, y + 2.3, z)); K.add(M.trim, box(4.5, 0.3, 4.5, x, y + 4.75, z));
    K.add(this.up, T(new THREE.SphereGeometry(0.42, 14, 10), [x, y + 4.25, z - 2.18]));
    K.add(this.low, T(new THREE.SphereGeometry(0.42, 14, 10), [x, y + 2.85, z - 2.18]));
    K.add(this.low, T(annulus(1.0, 1.5, 0.06, 32), [x, y + 0.03, z]));   // (the floor's ring round the lower shaft)
    K.both(M.dark, T(annulus(1.5, 2.1, 0.12, 32), [x, y + 0.06, z]));
    // the shafts: drawn turning (dynamic), a still proxy for each to collide with
    const iron = makeMaterial({ color: PALETTE.trim, flat: true, key: 'temple.buried.shaft' });
    const shaftGeo = (len, r = 0.55) => {
      const parts = [new THREE.CylinderGeometry(r, r, len, 12)];
      for (let i = 0; i < Math.floor(len / 2.4); i++) parts.push(new THREE.BoxGeometry(r * 2.6, 0.3, 0.3).translate(0, -len / 2 + 1.2 + i * 2.4, 0));   // (its collars, so you see it turn)
      return mergeGeometries(parts);
    };
    // (each turns about its own length: `spin` the axis it turns round, in its own frame)
    const mk = (geo, at, spin = 'y') => { const m = new THREE.Mesh(geo, iron); m.position.copy(K.world(...at)); m.rotation.set(0, K.heading(0), 0, 'YXZ'); m.userData.noCollide = true; m.userData.dynamic = true; m.userData.spin = spin; rt.root.add(m); return m; };
    const top = o.roof, hi = top - (y + 4.8);
    this.upV = mk(shaftGeo(hi), [x, y + 4.8 + hi / 2, z]);
    K.solid(new THREE.CylinderGeometry(0.55, 0.55, hi, 10).translate(x, y + 4.8 + hi / 2, z));
    const run = o.north - z;
    this.upH = mk(shaftGeo(run, 0.5).rotateX(Math.PI / 2), [x, top, z + run / 2], 'z');
    K.add(M.dark, box(1.6, 1.6, 1.6, x, top, z));   // (the bevel box where it turns north)
    for (let i = 1; i < 6; i++) K.add(M.trim, box(1.4, 1.2, 0.3, x, top + 0.8, z + (run * i) / 6));   // (its hangers from the roof)
    this.lowV = mk(shaftGeo(2.0), [x, y + 1.0, z]);
    K.solid(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 10).translate(x, y + 1.0, z));
    // the flywheel east of the gearbox (turning while it runs), on its axle
    const fw = [], R = o.r ?? 3.6;
    fw.push(new THREE.TorusGeometry(R, 0.42, 8, 40).rotateY(Math.PI / 2));
    for (let i = 0; i < 6; i++) fw.push(new THREE.BoxGeometry(0.3, R * 2, 0.36).rotateX((i / 6) * Math.PI));
    fw.push(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 14).rotateZ(Math.PI / 2));
    this.wheel = mk(mergeGeometries(fw), [x + 3.0, y + R + 0.9, z], 'x');
    K.both(M.trim, T(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 10), [x + 2.4, y + R + 0.9, z], [0, 0, Math.PI / 2]));
    K.both(M.dark, box(0.9, R + 0.6, 1.2, x + 4.1, y + (R + 0.6) / 2, z));   // (its bearing's standard)
    // the clutch arm on the gearbox's south face: up toward the upper shaft, or down toward the lower
    this.arm = new THREE.Group();
    this.arm.position.copy(K.world(x + 1.3, y + 3.55, z - 2.25));
    this.arm.rotation.y = K.heading(0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.22).translate(0, 0.95, 0), makeMaterial({ color: '#c09a48', flat: true, metal: 'brass', refl: 0.3, key: 'temple.buried.clutch' }));
    this.pivot = new THREE.Group(); this.pivot.add(bar);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.center0 = K.world(x, y + 3.5, z - 2.4);
    this.kUp = this.upper ? 1 : 0; this.kRun = this.running ? 1 : 0; this.was = this.running;
    this.setters = [];   // (the clutch levers: the scout's, and the play-through's)
    rt.greatEngine = this;
  }
  get running() { return this.rt.logic.check(RUN); }
  /** The clutch up (the upper shaft's), whether the engine runs or not. */
  get upper() { return this.rt.logic.drumOn(this.id, 'shaftUp'); }
  /** A lever pulled: the clutch thrown to the other shaft. Returns where it went ('upper' or 'lower'). */
  toggle(by = null) { return this.set(!this.upper, by); }
  set(up, by = null) {
    const rt = this.rt;
    if (this.upper === up) return up ? 'upper' : 'lower';
    rt.logic.moveDrum(this.id, up ? 1 : 0); rt.applyDoors?.();
    rt.sound?.critter?.('clank', 1.0); rt.rumble?.(0.8, 0.35);
    const run = this.running;
    rt.notice?.(up ? (run ? 'The clutch climbs: the upper shaft turns, and the pistons upstairs run.' : 'The clutch climbs to the upper shaft. The engine is still.')
      : (run ? 'The clutch drops: the lower shaft turns, and the pistons below run.' : 'The clutch drops to the lower shaft. The engine is still.'), up ? 'shaft.up' : 'shaft.low');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id, by });
    return up ? 'upper' : 'lower';
  }
  update(dt, t) {
    const run = this.running;
    if (run && !this.was) this.rt.notice?.(this.upper ? 'The engine wakes. Its power runs up the upper shaft.' : 'The engine wakes. Its power runs down the lower shaft.', 'engine.run');
    this.was = run;
    this.kRun += ((run ? 1 : 0) - this.kRun) * Math.min(1, dt * 1.5);
    this.kUp += ((this.upper ? 1 : 0) - this.kUp) * Math.min(1, dt * 4);
    const w = this.kRun * 2.4;
    // (in their own frame: the yaw outermost, the turn about their length innermost)
    const turn = (m, d) => { const a = m.userData.spin; if (a === 'y') m.rotation.y += d; else m.rotation[a] += d; };
    turn(this.wheel, w * dt);
    turn(this.upV, w * 1.6 * this.kUp * dt);
    turn(this.upH, w * 1.6 * this.kUp * dt);
    turn(this.lowV, w * 1.6 * (1 - this.kUp) * dt);
    this.pivot.rotation.x = THREE.MathUtils.lerp(Math.PI - 0.5, 0.5, smooth(this.kUp));   // (down: hanging toward the floor; up: toward the roof)
    // every lamp of the house at once: the shaft with the power lit, the other dark
    const pulse = 0.05 * Math.sin(t * 3.1);
    const U = this.up.uniforms, L = this.low.uniforms, kOn = smooth(this.kRun);
    U.uColor.value.set(POWER_LOOK.off).lerp(_pc.set(POWER_LOOK.up), this.kUp * kOn);
    U.uGlow.value = POWER_LOOK.glow[0] + this.kUp * kOn * (POWER_LOOK.glow[1] - POWER_LOOK.glow[0] + pulse);
    L.uColor.value.set(POWER_LOOK.off).lerp(_pc.set(POWER_LOOK.low), (1 - this.kUp) * kOn);
    L.uGlow.value = POWER_LOOK.glow[0] + (1 - this.kUp) * kOn * (POWER_LOOK.glow[1] - POWER_LOOK.glow[0] + pulse);
  }
  /** Where to set it from (the scout's): the nearest clutch lever. */
  get center() {
    const P = this.rt.player?.pos, list = this.setters.map((s) => s.at);
    if (!P || !list.length) return this.center0;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
}

/**
 * A clutch lever of the great engine, by a hub (LEVERS): an iron arm on a slate post, the upper lamp over the lower on its
 * head. Pulled (A / ×) it throws the clutch to the other shaft (GreatEngine.toggle); the arm stands up while the power
 * is the upper shaft's, down while it is the lower's. o: { id, room, at (its foot, local), yaw (the way it faces) }
 */
export class PowerLever {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.05;
    this.pos = K.world(x, y, z);
    K.both(M.dark, T(new THREE.CylinderGeometry(0.3, 0.42, H, 8), [x, y + H / 2, z]));
    K.add(M.trim, T(new THREE.TorusGeometry(0.33, 0.05, 6, 20), [x, y + H, z], [Math.PI / 2, 0, 0]));
    const s = Math.sin(o.yaw ?? 0), c = Math.cos(o.yaw ?? 0);
    K.add(upLamp(), T(new THREE.SphereGeometry(0.13, 10, 8), [x - c * 0.36, y + 0.82, z + s * 0.36]));
    K.add(lowLamp(), T(new THREE.SphereGeometry(0.13, 10, 8), [x - c * 0.36, y + 0.5, z + s * 0.36]));
    this.top = K.world(x, y + H + 0.1, z);
    this.at = this.top;
    this.arm = new THREE.Group();
    this.arm.position.copy(this.top);
    this.arm.rotation.y = K.heading(o.yaw ?? 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6).translate(0, 0.5, 0), makeMaterial({ color: '#c09a48', flat: true, metal: 'brass', refl: 0.3, key: 'temple.buried.lever' }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.02, 0), makeMaterial({ color: PALETTE.dark, flat: true, key: 'temple.buried.knob' }));
    this.pivot = new THREE.Group(); this.pivot.add(bar, knob);
    this.arm.add(this.pivot);
    this.arm.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    rt.root.add(this.arm);
    this.a = 0;
    const eng = () => rt.greatEngine;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (eng()?.upper ? 'send the power to the lower pistons' : 'send the power to the upper pistons'),
      enabled: () => !!eng(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { const r = eng()?.toggle(this.id); this.kick = 1; return r; },
    });
    this.joined = false;
  }
  update(dt) {
    const E = this.rt.greatEngine;
    if (!this.joined && E) { this.joined = true; E.setters.push({ at: this.top, lever: this.id }); }
    const want = (E?.upper ? 1 : -1) * 0.75;
    this.a += (want - this.a) * Math.min(1, dt * 6);
    this.kick = Math.max(0, (this.kick ?? 0) - dt * 3);
    this.pivot.rotation.x = this.a + Math.sin(this.kick * 9) * 0.1 * this.kick;
  }
  dispose() { this.off?.(); }
}

/**
 * The engine's power in a room (issue #415, G1: readable everywhere): an iron post by the room's way in, two lamps on it,
 * the upper shaft's over the lower's: the one with the power lit (amber up, blue down), both dark while the engine is
 * still. Drawn in the kit's batches: their colours are the shared materials'. o: { room, at (its foot, local), shows }
 */
export class PowerGauge {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at;
    this.rt = rt; this.o = o;
    K.both(M.trim, T(new THREE.CylinderGeometry(0.1, 0.16, 2.0, 8), [x, y + 1.0, z]));
    K.add(M.dark, box(0.7, 1.7, 0.7, x, y + 2.75, z));
    K.add(M.trim, box(0.82, 0.12, 0.82, x, y + 3.66, z)); K.add(M.trim, box(0.82, 0.12, 0.82, x, y + 1.84, z));
    K.add(upLamp(), T(new THREE.SphereGeometry(0.3, 12, 8), [x, y + 3.18, z]));
    K.add(lowLamp(), T(new THREE.SphereGeometry(0.3, 12, 8), [x, y + 2.32, z]));
  }
  update() {}
}

/** The Crank Hall's hammer: a Hammer that runs only while the upper shaft turns (its door's logic is its jam's alone). */
class PoweredHammer extends Hammer {
  update(dt) {
    if (this.rt.logic.check(UPPER)) return super.update(dt);
    const o = this.open; this.open = true; super.update(dt); this.open = o;   // (still: it finishes its rise and stands)
  }
}

// ------------------------------------------------------------------ the rooms (v1.83, issue #415: round the Engine Hall)
/**
 * The house reworked to the approved best practices (docs/design/temple-best-practices.md: G1, G2, G3b, G4, G6), still to
 * the redesign's rules (docs/design/temple-redesign.md): every puzzle room 30 m across or more under 18 m of iron, doors 7
 * by 9, each puzzle in the middle of its room. Local m, the threshold's door at z 0, two floors: 0 (the Engine Hall's floor
 * and the lower rooms) and UP (its gallery and the upper rooms).
 */
export const DOOR = { w: 7, h: 9 };
export const UP = 7;
/**
 * The Engine Hall (G4): 44 by 70 under 32, its gallery UP high round the north end (from `north`) and along the west wall
 * (x0 to `x1`, from `z0`), open over the floor, a parapet `parapet` high on its edges but where it drops (`drop`: [z0, z1]
 * of the west arm's edge, G6) and where the third piston arrives (`gap`: half its width, at x 0). The engine in its
 * middle (`engine`), its jam's groove west of it; the pistons in a row toward the north arm's face; the valve's post by the
 * way in. Its doors: east the Boiler Room's (z `boiler`) and the Fourth Chamber's shutter (z `cell`); north, at UP, the
 * upper floor's bulkhead.
 */
export const EH = { x0: -22, x1: 22, z0: 12.6, z1: 82.6, h: 32, boiler: 28, cell: 64 };
export const GALLERY = { x0: -22, x1: -15, z0: 36, north: 75.6, parapet: 1.1, drop: [44, 54], gap: 2.4 };
export const ENGINE = { at: [0, 0, 40], r: 3.6, valve: [-7, 29] };
export const PISTONS = [65.0, 69.2, 73.4];
/**
 * The clutch levers (local, the way each faces): by every hub, the hall's floor (by the engine), its gallery (by the drop),
 * the Fourth Chamber (the lower floor's), and the Crank Passage, a room past the hammer (the upper floor's far end). Their
 * rooms are the clutch's (LOGIC shaft.rooms); CHAMBER and PASSAGE are below.
 */
export const LEVERS = [
  { room: 'pistons', at: [5.8, 0, 33.6], yaw: 0 },
  { room: 'gallery', at: [-20.4, UP, 57.5], yaw: Math.PI / 2 },
  { room: 'cell', at: [43 - 11.2, 0, 64 + 4.5], yaw: Math.PI / 2 },
  { room: 'crank', at: [11.6, UP, 130.4 + 25], yaw: -Math.PI / 2 },
];
/**
 * The lower floor's rooms (y 0), east of the hall: the Boiler Room, the Fourth Chamber north of it (its shutter's ball:
 * `shutter`, the crank's [x, z] from the chamber's middle and its groove's length west of it), the Governor Room north of
 * the chamber.
 */
export const BOILER = { x: 43, z: EH.boiler, w: 30, d: 30, h: 18 };
BOILER.zone = { min: [BOILER.x - 15, -1, BOILER.z - 15], max: [BOILER.x + 15, 12, BOILER.z + 15] };
export const CHAMBER = { x: 43, z: EH.cell, r: 17, h: 18, posts: 8.4, shutter: { at: [0, 9.8], groove: 5 } };
export const WING = { gov: { x: CHAMBER.x, z: CHAMBER.z + CHAMBER.r + 0.7 + 3 + 15, w: 30, d: 30 } };
WING.anvil = [WING.gov.x - 5.1, WING.gov.z - 3.8]; WING.cage = 2.5;   // the great key's anvil, and the hammer's foot over its caged plinth (m)
WING.groove = { x: WING.gov.x + 2.1, z: [WING.gov.z - 4.6, WING.gov.z + 2.7] };   // the ball's: the hammer's crank at its south end, the pistons' at its north
WING.pistons = { x: [-6.3, -2.3, 2.3, 6.3].map((d) => WING.gov.x + d), z: WING.gov.z + 6.6 };
/**
 * The Crank Hall (the upper floor, north of the gallery): 32 by 36 under 18, the pit across it (W0..W1: the walkway 6.4 m),
 * the hammer over the walkway; the ball's groove on the near landing (GZ0..GZ1), the hammer's crank at its end in an iron
 * casing that hides its notch from the walkway.
 */
export const CRANK = { x0: -16, x1: 16, z0: 88.4, h: 18 };
Object.assign(CRANK, { z1: CRANK.z0 + 36, W0: CRANK.z0 + 19.2, W1: CRANK.z0 + 25.6, GX: -7, GZ0: CRANK.z0 + 7.4, GZ1: CRANK.z0 + 18.4 });
CRANK.casing = { x: -4.4, z0: CRANK.z0 + 12.6, z1: CRANK.z0 + 19, h: 3.4 };
/**
 * The Crank Passage: 30 m square under 18, the four pistons and their parapet across its middle (QZ), the crank and its
 * ball's groove beside them; the Furnace's way on (d3) north.
 */
export const PASSAGE = { x0: -15, x1: 15, z0: CRANK.z1 + 6, h: 18, QX: [-4.8, -1.6, 1.6, 4.8], CX: -6.6 };
Object.assign(PASSAGE, { z1: PASSAGE.z0 + 30, QZ: PASSAGE.z0 + 19.4 });
/**
 * The Furnace: 34 by 58, its floor 12 m down; the near lip 18 m deep (the two cranks and their balls out on it), the chasm
 * 20 m, the far lip 20 m (the parapet and the four pistons 4.4 and 6.4 m past its edge); the east pistons' clutch ring over
 * the far lip's edge (`ring`: [x, height over the lip, m past the edge]).
 */
export const FURNACE = { w: 34, z0: PASSAGE.z1 + 4.4, lip: 18, gap: 20, far: 20, ring: [7.5, 5.6, 0.6] };
FURNACE.d = FURNACE.lip + FURNACE.gap + FURNACE.far;
/** The Tooth-Warden's hall (a round hall as it was, r 20), past the antechamber (7.4 m) beyond the furnace's north door. */
export const HALL = { r: 20, ante: 7.4 };
HALL.z = FURNACE.z0 + FURNACE.d + 1.2 + HALL.ante + 0.6 + HALL.r;

/**
 * The Boiler Keeper (G3b, the house's mini-boss): a furnace brute (src/enemies/archetypes.js) grown huge in the cold
 * boilers, alone in the Boiler Room before the chest. Its slam is the one to learn: both fists high (1.5 s), down, a
 * quake running out along the floor (jump it), and its fists stuck in the floor for 2.4 s, the blade landing double: the
 * Tooth-Warden's stomps and slam, its wave and its vents open after, taught a room early, with the blade before the bombs.
 * Its hurl and its sweep as a brute's. src/foes.js places it at the Boiler Room's mark (an arena's `keeper`).
 */
const BRUTE = ARCHETYPES.brute.def;
export const KEEPER = {
  kind: 'brute@perdide2', size: 1.3,   // (in its own skin, the Lamp-House's furnace iron: the same materials the engines carry)
  def: {
    name: 'the Boiler Keeper', hp: 16, radius: 1.5, height: 3.1, speed: 1.5, sight: 30, giveUp: 60, reach: 14, calm: null, cool: [1.8, 2.8],
    attacks: BRUTE.attacks.map((a) => (a.id === 'slam' ? {
      ...a, radius: 2.6, ahead: 2.4, wind: 1.5, wave: { ...a.wave, reach: 12 }, weight: 2.6, opens: 2.4, stuck: true, cue: 'quake',
      tell: 'both fists rise high over its head, its cracks blazing, and the floor rumbles', counter: 'jump the quake it sends along the floor, then cut it while its fists are stuck',
    } : a)),
  },
};

/** The Boiler Room's fight (src/temples/runtime.js updateArenas; src/foes.js places its keeper at its mark). */
export const ARENAS = [{
  el: 'arB', room: 'boiler', zone: BOILER.zone, doors: ['dF', 'dC'], keeper: KEEPER,
  shut: 'The firebox door clangs shut behind you. Among the cold boilers something huge gets up.',
  won: 'The Boiler Keeper crashes down among the boilers. The key’s cage sinks, and the north door opens.',
}];

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  // after the picked reference (references/temples/engine-house/sheet-1.jpg): the walls are machinery, riveted
  // plates banded in blue-grey, pistons standing in their cylinders, pipes and valve wheels
  const band = { paint: new THREE.Color('#7f93a6'), smooth: false, side: THREE.FrontSide };
  const brass = { paint: new THREE.Color('#d9a441'), smooth: false, side: THREE.FrontSide };
  /** A row of rivets along x (or z) at height y on a wall's face. */
  const rivets = (x0, x1, y, z, alongZ = false) => { for (let s = x0; s <= x1; s += 0.9) K.add(brass, T(new THREE.SphereGeometry(0.07, 6, 4), alongZ ? [z, y, s] : [s, y, z])); };
  /** A piston standing in its cylinder (decoration: the engine's own, still). */
  const cylinder = (x, z, y, h, r = 1.1) => {
    K.both(M.stone, new THREE.CylinderGeometry(r, r, h, 16).translate(x, y + h / 2, z));
    for (const yy of [y + 0.4, y + h - 0.4]) K.add(band, new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.35, 16).translate(x, yy, z));
    K.both(M.trim, new THREE.CylinderGeometry(r * 0.45, r * 0.45, 2.4, 10).translate(x, y + h + 1.2, z));
    K.both(M.dark, new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.5, 14).translate(x, y + h + 2.6, z));
  };
  /** A valve wheel on a pipe, facing along +x or -x (s). */
  const valve = (x, y, z, s = 1) => {
    K.add(brass, T(new THREE.TorusGeometry(0.55, 0.07, 5, 18), [x + s * 0.4, y, z], [0, Math.PI / 2, 0]));
    for (let i = 0; i < 3; i++) K.add(brass, T(new THREE.BoxGeometry(0.06, 1.05, 0.06), [x + s * 0.4, y, z], [(i / 3) * Math.PI, 0, 0]));
  };
  // (in the house's futuristic skin, amber light: skins/engine-house.js)
  const ember = rt.skin?.mats?.ember ?? makeMaterial({ color: '#e0644a', glow: 0.55, flat: true, key: 'temple.buried.embers' });

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 10, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(EH.x0 - 1.2, EH.z0, EH.x1 + 1.2, EH.z0, 0, EH.h, { t: 1.2, holes: [{ at: EH.x1 + 1.2, ...DOOR }] });

  // ---- the Engine Hall (G4): its floor and its gallery round the north end and the west side, the engine in its middle
  const EW = EH.x1 - EH.x0, ED = EH.z1 - EH.z0, EZ = (EH.z0 + EH.z1) / 2, G = GALLERY, GN = G.north;
  K.hall({ x: 0, z: EZ, w: EW, d: ED, y: 0, h: EH.h, roof: 'oculus', oculus: 0.22, omit: ['s'], columns: 0,
    doors: [{ side: 'n', ...DOOR, y0: UP }, { side: 'e', at: EH.boiler - EZ, ...DOOR }, { side: 'e', at: EH.cell - EZ, ...DOOR }] });
  // the gallery: iron on iron, its top at UP (its faces not climbed, as no wall in the house is: the pistons are the way up)
  K.both(M.wallGlyph, box(EW, UP - 0.3, EH.z1 - GN, 0, (UP - 0.3) / 2, (GN + EH.z1) / 2));
  K.both(M.wallGlyph, box(G.x1 - G.x0, UP - 0.3, GN - G.z0, (G.x0 + G.x1) / 2, (UP - 0.3) / 2, (G.z0 + GN) / 2));
  K.both(M.trim, box(EW, 0.3, EH.z1 - GN + 0.2, 0, UP - 0.15, (GN + EH.z1) / 2 - 0.1));
  K.both(M.trim, box(G.x1 - G.x0 + 0.2, 0.3, GN - G.z0 + 0.2, (G.x0 + G.x1) / 2 + 0.1, UP - 0.15, (G.z0 + GN) / 2 - 0.1));
  // its parapets, but for the third piston's landing and the drop (G6: 10 m of the west arm's edge open over the floor)
  const PH = G.parapet, pp = (w, d, x, z) => { K.both(M.trim, box(w, PH, d, x, UP + PH / 2, z)); K.add(band, box(w + (d < w ? 0.06 : 0.1), 0.18, d + (d < w ? 0.1 : 0.06), x, UP + PH + 0.02, z)); };
  pp(-G.gap - G.x1, 0.4, (G.x1 - G.gap) / 2, GN + 0.2);
  pp(EH.x1 - G.gap, 0.4, (EH.x1 + G.gap) / 2, GN + 0.2);
  pp(0.4, G.drop[0] - G.z0, G.x1 + 0.2, (G.z0 + G.drop[0]) / 2);
  pp(0.4, GN - G.drop[1], G.x1 + 0.2, (G.drop[1] + GN) / 2);
  pp(G.x1 - G.x0, 0.4, (G.x0 + G.x1) / 2, G.z0 + 0.2);
  // the drop's edge: a lit strip along it and two posts at its ends, so it reads as the way down
  K.add(rt.skin?.mats?.glow ?? band, box(0.3, 0.06, G.drop[1] - G.drop[0], G.x1 - 0.18, UP + 0.03, (G.drop[0] + G.drop[1]) / 2));
  for (const z of G.drop) K.both(M.trim, new THREE.CylinderGeometry(0.22, 0.26, 2.6, 10).translate(G.x1 - 0.3, UP + 1.3, z));
  // big pipes along the east wall, gauges and valve wheels; the engine's own pistons standing in their cylinders
  K.both(M.stone, T(new THREE.CylinderGeometry(0.9, 0.9, 20, 14), [EH.x1 - 0.8, 3, 43], [Math.PI / 2, 0, 0]));
  K.both(M.stone, T(new THREE.CylinderGeometry(0.6, 0.6, 20, 12), [EH.x1 - 0.6, 5.4, 43], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) valve(EH.x1 - 0.8, 4.6, 36 + i * 7, -1);
  for (const s of [-1, 1]) { K.add(band, box(0.12, 0.6, ED, s * (EH.x1 - 0.06), 13.5, EZ)); rivets(EH.z0 + 0.6, EH.z1 - 0.6, 14.1, s * (EH.x1 - 0.1), true); rivets(EH.z0 + 0.6, EH.z1 - 0.6, 12.9, s * (EH.x1 - 0.1), true); }
  for (const z of [18.5, 52]) cylinder(EH.x1 - 3.4, z, 0, 8.2, 1.2);
  cylinder(EH.x0 + 3.4, 18.5, 0, 8.2, 1.2);
  // the great engine, the house's state (GreatEngine): its gearbox, its flywheel, the upper shaft to the roof and north,
  // the lower into the floor
  add(GreatEngine, { id: 'shaft', at: ENGINE.at, r: ENGINE.r, roof: EH.h - 3, north: EH.z1 + 0.6 });
  // its crank west of the gearbox, a stone ball sitting in its teeth (pZ); its groove runs west to a cup (pY). Out of the
  // teeth (and its valve open), the engine turns; rolled back in, it stops where it is
  const [EX, , EZ0] = ENGINE.at;
  add(Cranks, { at: [[EX - 4.4, 1.6, EZ0]], r: 1.3, jam: [{ not: RUN }], rods: false });
  K.add(M.stone, box(2.0, 0.3, 0.3, EX - 3.0, 1.6, EZ0));
  K.add(M.dark, box(5.6, 0.04, 1.0, EX - 7.2, 0.02, EZ0 - 1.6));
  add(Ball, { id: 'ball0', a: [EX - 9.7, 0.04, EZ0 - 1.6], b: [EX - 4.7, 0.04, EZ0 - 1.6], r: 0.9, lock: true });   // (out of the teeth, it stays out: the engine runs on)
  add(Plate, { id: 'pY', at: [EX - 9.7, 0, EZ0 - 1.6], r: 1.1 });
  add(Plate, { id: 'pZ', at: [EX - 4.7, 0, EZ0 - 1.6], r: 1.1 });
  // the valve's eye, on a valve post out in the hall by the way in, facing you as you come in
  const [VX, VZ] = ENGINE.valve;
  K.both(M.stone, box(1.6, 4.4, 1.6, VX, 2.2, VZ));
  K.both(M.trim, box(1.9, 0.4, 1.9, VX, 4.6, VZ));
  for (const y of [0.6, 3.9]) K.add(band, box(1.72, 0.3, 1.72, VX, y, VZ));
  add(Switch, { id: 's1', at: [VX, 3.2, VZ - 0.85], yaw: Math.PI, size: 1.0 });
  // three pistons in a row toward the gallery's north arm, each a riding disc that rises and falls with the flywheel
  const [Q1, Q2, Q3] = PISTONS;
  add(Platform, { path: [[0, 0.3, Q1], [0, 2.6, Q1]], r: 2, speed: 1.1, pause: 1.2, when: RUN });
  add(Platform, { path: [[0, 2.4, Q2], [0, 4.7, Q2]], r: 2, speed: 1.1, pause: 1.2, phase: 1, when: RUN });
  add(Platform, { path: [[0, 4.9, Q3], [0, 7.2, Q3]], r: 2, speed: 1.1, pause: 1.2, when: RUN });
  for (const z of PISTONS) K.both(M.dark, T(new THREE.CylinderGeometry(1.2, 1.4, 0.1, 18), [0, 0.05, z]));
  // the clutch levers (the hall's floor's and the gallery's), the gauges
  for (const lv of LEVERS) if (lv.room === 'pistons' || lv.room === 'gallery') add(PowerLever, { ...lv, id: `lever.${lv.room}`, sets: 'shaft' });
  add(PowerGauge, { shows: 'shaft', room: 'pistons', at: [-5.5, 0, 16.2] });
  add(PowerGauge, { shows: 'shaft', room: 'gallery', at: [-19.6, UP, 79.6] });
  add(Mark, { room: 'pistons', at: [6.5, 0, 17], yaw: -Math.PI / 2 });
  add(Mark, { room: 'gallery', at: [-18.5, UP, 64], yaw: Math.PI / 2 });

  // ---- the Boiler Room (east, the lower floor; G3b): the firebox door rises on the lower shaft; the Boiler Keeper among
  // the cold boilers, alone; beaten, the small key and the door north to the chest
  const B = BOILER, bx0 = B.x - B.w / 2, bx1 = B.x + B.w / 2, bz1 = B.z + B.d / 2;
  K.corridor([EH.x1 + 0.6, B.z], [bx0 - 0.6, B.z], 0, DOOR);
  K.hall({ x: B.x, z: B.z, w: B.w, d: B.d, y: 0, h: B.h, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, ...DOOR }, { side: 'n', at: 0, ...DOOR }] });
  add(Door, { id: 'dF', at: [EH.x1 + 0.6, 0, B.z], yaw: Math.PI / 2, ...DOOR, lamps: [{ ...LOWER }] });
  // four boilers round the middle, cold, their fireboxes dark, a gauge on each: the keeper comes at you among them
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = B.x + sx * 8.5, z = B.z + sz * 8;
    K.both(M.stone, T(new THREE.CylinderGeometry(1.3, 1.3, 4.2, 18), [x, 1.9, z], [0, 0, Math.PI / 2]));
    for (const dx of [-1.7, 1.7]) K.add(band, T(new THREE.CylinderGeometry(1.45, 1.45, 0.3, 18), [x + dx, 1.9, z], [0, 0, Math.PI / 2]));
    K.both(M.dark, box(1.6, 1.0, 1.0, x, 0.5, z - sz * 0.9));
    K.add(brass, T(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14), [x, 3.6, z - sz * 0.6], [Math.PI / 2, 0, 0]));
    K.both(M.trim, new THREE.CylinderGeometry(0.22, 0.22, 14.6, 8).translate(x + 1.2, 10.5, z + sz * 0.4));   // (its flue pipe up into the roof)
  }
  add(Key, { id: 'kS', at: [bx1 - 1.8, 0, B.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'boiler', at: [bx0 + 3.2, 0, B.z - 3.2], yaw: Math.PI / 2, foes: [B.x + 2, 0, B.z] });
  add(PowerGauge, { shows: 'shaft', room: 'boiler', at: [bx0 + 2.4, 0, B.z + 5.2] });
  add(Door, { id: 'dC', at: [B.x, 0, bz1 + 0.6], ...DOOR, lamps: [{ lit: 'arB' }] });

  // ---- the Fourth Chamber (a round hall, the lower floor, north of the Boiler Room): the chest in its middle; four eyes
  // on posts round it; its shutter west into the hall's floor
  const CX0 = CHAMBER.x, C3 = CHAMBER.z, CR = CHAMBER.r;
  K.corridor([B.x, bz1 + 0.6], [CX0, C3 - CR - 0.7], 0, DOOR);
  K.rotunda({ x: CX0, z: C3, y: 0, r: CR, h: CHAMBER.h, seg: 36, gaps: [Math.PI, -Math.PI / 2, 0].map((a) => ({ a, ...DOOR })), oculus: 0.3 });
  K.both(M.trim, ...chestMound(CX0, 0, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  K.add(band, T(annulus(CR - 0.18, CR, 0.6, 64), [CX0, 12.5, C3]));
  const K0 = [-Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42], PR = CHAMBER.posts;
  for (const a of K0) {
    const x = CX0 + Math.sin(a) * PR, z = C3 + Math.cos(a) * PR;
    K.both(M.stone, new THREE.CylinderGeometry(0.8, 0.9, 4.6, 14).translate(x, 2.3, z));
    K.both(M.trim, new THREE.CylinderGeometry(1.05, 1.05, 0.4, 14).translate(x, 4.8, z));
    for (const y of [0.5, 3.9]) K.add(band, new THREE.CylinderGeometry(0.94, 0.94, 0.3, 14).translate(x, y, z));
  }
  add(Bank, { id: 'k0', window: VOLLEY, eyes: K0.map((a) => ({ at: [CX0 + Math.sin(a) * (PR - 0.95), 3.6, C3 + Math.cos(a) * (PR - 0.95)], yaw: Math.PI + a })),
    full: 'All four woke, and went dark again: four in one breath, and the bar holds three shots.',
    fade: 'They woke one by one, and went dark again before the last: four in one breath. A bomb between two wakes both.' });
  add(Door, { id: 'dS', at: [CX0 - (CR + 0.7), 0, C3], yaw: Math.PI / 2, w: DOOR.w, h: DOOR.h, lamps: [{ lit: 'k0' }] });
  K.corridor([EH.x1 + 0.6, C3], [CX0 - (CR + 0.7), C3], 0, DOOR);
  // the Governor Room's shutter in the north gap, wound up by the lower shaft: its crank by the chest, a ball in a groove
  // beside it (rolled into the teeth while the shaft turns, it holds the shutter up)
  const SH = CHAMBER.shutter, [SX, SZ] = [CX0 + SH.at[0], C3 + SH.at[1]], DJ = { drumOn: ['bD', 'pD'] };
  add(Cranks, { at: [[SX, 1.6, SZ]], r: 1.3, jam: [{ any: [DJ, { not: LOWER }] }], rods: false });
  K.add(M.stone, box(0.3, 0.3, CR + 0.7 - SH.at[1] - 1.4, SX, 1.6, (SZ + 1.4 + C3 + CR + 0.7) / 2));   // (its rod to the shutter's drum)
  K.add(M.dark, box(SH.groove + 0.6, 0.04, 1.0, SX - 0.3 - SH.groove / 2, 0.02, SZ - 1.6));
  add(Ball, { id: 'bD', a: [SX - 0.3 - SH.groove, 0.04, SZ - 1.6], b: [SX - 0.3, 0.04, SZ - 1.6], r: 0.9 });
  add(Plate, { id: 'pD', at: [SX - 0.3, 0, SZ - 1.6], r: 1.1 });
  add(Door, { id: 'dG', at: [CX0, 0, C3 + CR + 0.7], ...DOOR, lamps: [{ lit: 'k0' }, { all: [DJ, LOWER] }] });
  for (const lv of LEVERS) if (lv.room === 'cell') add(PowerLever, { ...lv, id: `lever.${lv.room}`, sets: 'shaft' });
  add(Mark, { room: 'cell', at: [CX0 + 5, 0, C3 - 10], yaw: -Math.PI * 0.75 });
  add(PowerGauge, { shows: 'shaft', room: 'cell', at: [CX0 + 7, 0, C3 + 12] });

  // ---- the Governor Room (west, the lower floor): the great key on its anvil under the hammer, one ball between two
  // cranks on the lower shaft, round its middle
  const GV = WING.gov, gx0 = GV.x - GV.w / 2, gx1 = GV.x + GV.w / 2, gz0 = GV.z - GV.d / 2, C = GV.z;
  K.corridor([CX0, C3 + CR + 0.7], [GV.x, gz0 - 0.6], 0, DOOR);
  K.hall({ x: GV.x, z: C, w: GV.w, d: GV.d, y: 0, h: 18, roof: 'oculus', oculus: 0.25, doors: [{ side: 's', at: 0, ...DOOR }] });
  const [AX, ANZ] = WING.anvil, [Z0, Z1] = WING.groove.z, GX = WING.groove.x;
  K.add(band, box(GV.w, 0.5, 0.12, GV.x, 12, gz0 + 0.06)); rivets(gx0 + 0.4, gx1 - 0.4, 12.5, gz0 + 0.1); rivets(gx0 + 0.4, gx1 - 0.4, 11.5, gz0 + 0.1);
  K.both(M.dark, box(3.4, 0.3, 3.0, AX, 0.15, ANZ));
  K.add(band, box(3.6, 0.12, 3.2, AX, 0.3, ANZ));
  add(Key, { id: 'kB', big: true, at: [AX, 0.3, ANZ], yaw: Math.PI / 2, cageH: WING.cage - 0.05 });   // (its cage up to the hammer's foot)
  add(Hammer, { id: 'h2', at: [AX, 0.3 + WING.cage, ANZ], yaw: Math.PI / 2, w: 2.6, d: 2.4, top: 3.0, period: 2.6, crank: [GX, 1.6, Z0 - 0.4], r: 1.5 });
  for (const s of [-1, 1]) K.both(M.trim, box(0.6, 9.4, 0.6, AX, 4.7, ANZ + s * 2.5));
  K.both(M.trim, box(0.8, 0.7, 5.6, AX, 9.75, ANZ));
  K.add(M.dark, box(1.0, 0.04, Z1 - Z0 + 0.6, GX, 0.02, (Z0 + Z1) / 2));
  add(Ball, { id: 'bQ', a: [GX, 0.04, Z0], b: [GX, 0.04, Z1], r: 0.9 });
  add(Plate, { id: 'pH', at: [GX, 0, Z0], r: 1.1 });
  add(Plate, { id: 'pQ', at: [GX, 0, Z1], r: 1.1 });
  const PZ = WING.pistons.z, GJAM = { all: [{ drumOn: ['bQ', 'pQ'] }, LOWER] }, PW = 14;
  K.both(M.wall, box(PW, 2.4, 0.6, GV.x, 1.2, PZ - 1)); K.add(band, box(PW + 0.2, 0.3, 0.7, GV.x, 2.3, PZ - 1)); rivets(GV.x - PW / 2 + 0.4, GV.x + PW / 2 - 0.4, 1.6, PZ - 1.32);
  for (const x of WING.pistons.x) K.both(M.dark, new THREE.CylinderGeometry(0.95, 1.05, 0.3, 16).translate(x, 0.15, PZ));
  K.add(M.stone, box(PW - 1, 0.36, 0.36, GV.x, 0.4, PZ + 0.5));
  add(Bank, { id: 'k3', window: VOLLEY, stroke: STROKE, drive: LOWER,
    eyes: WING.pistons.x.map((x, i) => ({ at: [x, 5.0, PZ - 0.7], yaw: Math.PI, piston: { drop: 3.6, phase: i / 4, jam: GJAM } })),
    unmet: 'All four woke, and went dark again: they never stand up together. Something has to hold their pistons up.',
    fade: 'They woke one by one as their pistons rose, and sank dark again. The pistons rise in turn: never four in one breath.' });
  add(Cranks, { at: [[GX, 1.4, Z1 + 0.6]], to: [[GX, 0.4, PZ + 0.5]], r: 1.3, jam: [{ any: [{ drumOn: ['bQ', 'pQ'] }, { not: LOWER }] }] });
  // the governor itself on the west wall: a spindle, two flyballs on their arms (turning with the lower shaft)
  K.both(M.trim, new THREE.CylinderGeometry(0.16, 0.16, 6, 8).translate(gx0 + 0.9, 4, C + 3.4));
  for (const s of [-1, 1]) {
    K.add(M.trim, T(new THREE.BoxGeometry(0.1, 2.4, 0.1), [gx0 + 0.9, 4.6, C + 3.4 + s * 0.85], [s * 0.78, 0, 0]));
    K.both(brass, new THREE.SphereGeometry(0.5, 12, 8).translate(gx0 + 0.9, 3.9, C + 3.4 + s * 1.7));
  }
  add(Mark, { room: 'gov', at: [gx1 - 2.2, 0, C - 4.6], yaw: -Math.PI / 2 });
  add(PowerGauge, { shows: 'shaft', room: 'gov', at: [gx1 - 2.4, 0, C + 5.4] });

  // ---- the upper floor: the corridor north off the gallery and the Crank Hall (UP): a walkway over a pit, the engine's
  // hammer slamming down on it while the upper shaft turns, its crank wheel in an iron casing west of the way. The ball
  // rolls down its groove across the near landing into the crank's teeth (pJ): the hammer stops at the top of its stroke
  const { GX: KGX, GZ0, GZ1, W0, W1 } = CRANK, CZ = (CRANK.z0 + CRANK.z1) / 2, CW = CRANK.x1 - CRANK.x0;
  K.corridor([0, EH.z1 + 0.6], [0, CRANK.z0 - 0.6], UP, DOOR);
  add(Door, { id: 'dU', at: [0, UP, EH.z1 + 0.6], ...DOOR, lamps: [{ ...UPPER }] });   // (the bulkhead: lifted while the upper shaft turns)
  K.hall({ x: 0, z: CZ, w: CW, d: CRANK.z1 - CRANK.z0, y: UP, h: CRANK.h, floor: false, roof: 'oculus', oculus: 0.22, doors: [{ side: 's', ...DOOR }, { side: 'n', ...DOOR }] });
  K.slab(CRANK.x0 - 0.6, CRANK.z0 - 0.6, CRANK.x1 + 0.6, W0, UP, 0.8);
  K.slab(CRANK.x0 - 0.6, W1, CRANK.x1 + 0.6, CRANK.z1 + 0.6, UP, 0.8);
  K.slab(-1.3, W0, 1.3, W1, UP, 0.6);
  K.both(ember, box(CW, 0.4, W1 - W0, 0, UP - 9.6, (W0 + W1) / 2));
  K.both(M.dark, box(CW, 1, W1 - W0, 0, UP - 10.4, (W0 + W1) / 2));
  for (const [z, s] of [[W0, -1], [W1, 1]]) K.both(M.wall, box(CW + 1.2, 9.58, 0.8, 0, UP - 5.61, z + s * 0.42));
  for (const s of [-1, 1]) K.both(M.wall, box(0.8, 10.38, W1 - W0, s * (CRANK.x1 + 0.6), UP - 5.21, (W0 + W1) / 2));
  add(Pit, { room: 'weight', min: [CRANK.x0 - 0.5, UP - 13, W0], max: [CRANK.x1 + 0.5, UP - 1.5, W1] });
  add(PoweredHammer, { id: 'h1', at: [0, UP, (W0 + W1) / 2], w: 2.6, d: 2.4, top: 5.2, period: 2.6, crank: [KGX, UP + 1.6, GZ1 + 0.4], r: 1.5,
    hit: 'The hammer comes down and throws you off the walkway. Its crank wheel turns beside the way, a notch at its foot.' });
  K.add(M.dark, box(1.0, 0.04, GZ1 - GZ0 + 0.6, KGX, UP + 0.02, (GZ0 + GZ1) / 2));
  add(Ball, { id: 'ballJ', a: [KGX, UP + 0.04, GZ0], b: [KGX, UP + 0.04, GZ1], r: 1.0, lock: true });
  add(Plate, { id: 'pJ', at: [KGX, UP, GZ1], r: 1.2 });
  const CA = CRANK.casing, CAZ = (CA.z0 + CA.z1) / 2;
  K.both(M.wall, box(2, CA.h, CA.z1 - CA.z0, CA.x, UP + CA.h / 2, CAZ));
  K.both(M.trim, box(2.3, 0.3, CA.z1 - CA.z0 + 0.3, CA.x, UP + CA.h + 0.15, CAZ));
  K.both(band, box(2.06, 0.4, CA.z1 - CA.z0 + 0.06, CA.x, UP + 0.9, CAZ)); rivets(CA.z0 + 0.4, CA.z1 - 0.4, UP + 2.4, CA.x + 1.05, true);
  K.add(M.stone, box(CA.x - KGX - 0.4, 0.3, 0.3, (CA.x - 1 + KGX + 0.3) / 2, UP + 1.6, GZ1 + 0.4));   // (the wheel's axle into the casing)
  K.both(M.trim, box(0.8, CRANK.h - CA.h - 0.6, 0.8, CA.x, UP + CA.h + (CRANK.h - CA.h) / 2, CA.z1 - 0.6));
  K.add(M.trim, box(-CA.x + 0.6, 0.7, 0.8, CA.x / 2, UP + CRANK.h - 1.2, CA.z1 - 0.6));
  K.add(band, box(CW, 0.5, 0.12, 0, UP + 11, CRANK.z1 - 0.06)); rivets(CRANK.x0 + 0.4, CRANK.x1 - 0.4, UP + 11.5, CRANK.z1 - 0.1); rivets(CRANK.x0 + 0.4, CRANK.x1 - 0.4, UP + 10.5, CRANK.z1 - 0.1);
  for (const x of [-9, 9]) cylinder(x, CRANK.z1 - 3.2, UP, 6.2, 0.9);
  for (const x of [-12, 12]) cylinder(x, CRANK.z0 + 3.2, UP, 6.2, 0.9);
  add(Mark, { room: 'weight', at: [6, UP, CRANK.z0 + 4.6], yaw: -Math.PI / 2 });
  add(PowerGauge, { shows: 'shaft', room: 'weight', at: [12.5, UP, CRANK.z0 + 2.6] });

  // ---- the Crank Passage (UP), a room on: four eyes on pistons across its middle on the upper shaft, one crank for all four
  const { QZ, QX, CX: KX } = PASSAGE, AZ = (PASSAGE.z0 + PASSAGE.z1) / 2;
  K.corridor([0, CRANK.z1 + 0.6], [0, PASSAGE.z0 - 0.6], UP, DOOR);
  K.hall({ x: 0, z: AZ, w: PASSAGE.x1 - PASSAGE.x0, d: PASSAGE.z1 - PASSAGE.z0, y: UP, h: PASSAGE.h, roof: 'oculus', oculus: 0.25,
    doors: [{ side: 's', ...DOOR }, { side: 'n', ...DOOR }] });
  const DZ = PASSAGE.z1 + 0.6;
  add(Door, { id: 'd3', at: [0, UP, DZ], ...DOOR, lamps: [{ lit: 'k1' }] });
  const JAM = { all: [{ drumOn: ['bK', 'pK'] }, UPPER] }, QW = 11.6;
  K.both(M.wall, box(QW, 2.2, 0.5, 0, UP + 1.1, QZ - 1.3)); K.add(band, box(QW + 0.2, 0.3, 0.6, 0, UP + 2.1, QZ - 1.3)); rivets(-QW / 2 + 0.4, QW / 2 - 0.4, UP + 1.4, QZ - 1.58);
  for (const x of QX) K.both(M.dark, new THREE.CylinderGeometry(0.85, 0.95, 0.3, 16).translate(x, UP + 0.15, QZ));
  K.add(M.stone, box(-2 * KX + 0.4, 0.36, 0.36, 0, UP + 0.4, QZ + 0.5));   // the crankshaft under them all
  add(Bank, { id: 'k1', window: VOLLEY, stroke: STROKE, drive: UPPER,
    eyes: QX.map((x, i) => ({ at: [x, UP + 4.0, QZ - 0.6], yaw: Math.PI, piston: { drop: 3.4, phase: i / 4, jam: JAM } })),
    unmet: 'All four woke, and the door does not stir: they never stand up together. Something has to hold their pistons up.',
    fade: 'They woke one by one as their pistons rose, and sank dark again. The pistons rise in turn: never four in one breath.' });
  // (v1.83: on the pistons' far side, in sight of the door it opens; its groove runs west along the crankshaft to it)
  const KZ = QZ + 3.6;
  add(Cranks, { at: [[KX, UP + 1.4, KZ]], to: [[KX, UP + 0.4, QZ + 0.5]], r: 1.3, jam: [{ any: [{ drumOn: ['bK', 'pK'] }, { not: UPPER }] }] });
  K.add(M.dark, box(5.6, 0.04, 1.0, KX + 2.8, UP + 0.02, KZ - 1.6));
  add(Ball, { id: 'bK', a: [KX + 5.3, UP + 0.04, KZ - 1.6], b: [KX + 0.3, UP + 0.04, KZ - 1.6], r: 0.9, lock: true });
  add(Plate, { id: 'pK', at: [KX + 0.3, UP, KZ - 1.6], r: 1.1 });
  for (const x of [-10.5, 10.5]) cylinder(x, PASSAGE.z1 - 3, UP, 6.2, 0.9);
  for (const lv of LEVERS) if (lv.room === 'crank') add(PowerLever, { ...lv, id: `lever.${lv.room}`, sets: 'shaft' });
  add(PowerGauge, { shows: 'shaft', room: 'crank', at: [11.4, UP, PASSAGE.z0 + 2.4] });

  // ---- the Furnace: a chasm over embers; the bridge rises on four eyes in one breath, each on a piston of the upper shaft
  // behind the far parapet, rising in turn; the two west pistons' cranks out on the near lip, a ball in a groove by each;
  // the two east ones' clutch, its ring over the far lip's edge (the hook's)
  const F0 = FURNACE.z0, FL = F0 + FURNACE.lip, FG = FL + FURNACE.gap, FE = F0 + FURNACE.d, FW = FURNACE.w / 2;
  K.corridor([0, DZ], [0, F0 - 0.6], UP, DOOR);
  K.hall({ x: 0, z: (F0 + FE) / 2, w: FURNACE.w, d: FURNACE.d, y: UP - 12, h: 30, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', ...DOOR, y0: 12 }, { side: 'n', ...DOOR, y0: 12 }] });
  K.slab(-FW, F0, FW, FL, UP, 12);
  K.slab(-FW, FG, FW, FE, UP, 12);
  K.both(ember, box(FURNACE.w, 0.4, FURNACE.gap, 0, UP - 11.6, (FL + FG) / 2));
  K.both(M.dark, box(FURNACE.w, 1, FURNACE.gap, 0, UP - 12.4, (FL + FG) / 2));
  for (const s of [-1, 1]) { K.add(band, box(0.12, 0.7, FURNACE.d - 0.4, s * (FW - 0.06), UP + 11, (F0 + FE) / 2)); rivets(F0 + 0.4, FE - 0.4, UP + 11.6, s * (FW - 0.1), true); rivets(F0 + 0.4, FE - 0.4, UP + 10.4, s * (FW - 0.1), true); }
  add(Pit, { room: 'furnace', min: [-FW - 1, UP - 15, FL], max: [FW + 1, UP - 5, FG] });
  add(Bridge, { id: 'br1', a: [0, UP, FL - 0.1], b: [0, UP, FG + 0.1], w: 4, n: 8 });
  for (const s of [-1, 1]) {
    K.both(M.wall, box(8.4, 2.4, 0.6, s * 6.8, UP + 1.2, FG + 4.4));
    K.add(band, box(8.6, 0.3, 0.7, s * 6.8, UP + 2.3, FG + 4.4));
    rivets(s * 6.8 - 4, s * 6.8 + 4, UP + 1.6, FG + 4.08);
  }
  const PX = [-9.4, -5.6, 5.6, 9.4], FPZ = FG + 6.4;
  const FJAM = [{ all: [{ drumOn: ['bA', 'pA'] }, UPPER] }, { all: [{ drumOn: ['bB', 'pB'] }, UPPER] }, { all: [{ lit: 'cF' }, UPPER] }, { all: [{ lit: 'cF' }, UPPER] }];
  for (const x of PX) K.both(M.dark, new THREE.CylinderGeometry(0.95, 1.05, 0.3, 16).translate(x, UP + 0.15, FPZ));
  add(Bank, { id: 'k2', window: VOLLEY, stroke: STROKE, drive: UPPER,
    eyes: PX.map((x, i) => ({ at: [x, UP + 5.0, FPZ - 0.7], yaw: Math.PI, piston: { drop: 3.6, phase: i / 4, jam: FJAM[i] } })),
    unmet: 'All four woke together, and the bridge does not stir: two of the pistons sank as the others rose. Never four up in one breath, unless something holds them up.',
    fade: 'They woke one by one as their pistons rose, and went dark again: the pistons rise in turn, never four in one breath.' });
  const CXs = [-9.4, -5.6], CKZ = FL - 1.1, G0z = FL - 5.1;
  add(Cranks, { at: CXs.map((x) => [x, UP + 1.6, CKZ]), to: CXs.map((x) => [x, UP - 0.6, FPZ]), r: 1.4, jam: [{ any: [{ drumOn: ['bA', 'pA'] }, { not: UPPER }] }, { any: [{ drumOn: ['bB', 'pB'] }, { not: UPPER }] }] });
  for (const [i, x] of CXs.entries()) {
    const id = i ? 'bB' : 'bA', plate = i ? 'pB' : 'pA';
    K.add(M.dark, box(1.0, 0.04, CKZ - 0.5 - G0z + 0.6, x, UP + 0.02, (G0z + CKZ - 0.5) / 2));
    add(Ball, { id, a: [x, UP + 0.04, G0z], b: [x, UP + 0.04, CKZ - 0.5], r: 0.9, lock: true });
    add(Plate, { id: plate, at: [x, UP, CKZ - 0.5], r: 1.1 });
  }
  // (G2) the east pistons' clutch: a gearbox high over them, its pull ring on a chain down over the far lip's edge, in the
  // hook's reach from the near lip; tugged, it bites for CLUTCH.hold s and the two east pistons stand up
  const [RX, RY, RZ] = FURNACE.ring, ringAt = [RX, UP + RY, FG + RZ];
  K.both(M.dark, box(6.4, 1.8, 2.2, 7.5, UP + 12.5, FPZ));
  K.add(M.trim, box(0.3, UP + 12.5 - 0.9 - (UP + RY + 0.6), 0.3, RX, (UP + 12.5 - 0.9 + UP + RY + 0.6) / 2, FG + RZ));
  K.add(M.trim, box(0.3, 0.3, FPZ - FG - RZ, RX, UP + 11.7, (FPZ + FG + RZ) / 2));
  add(HookBell, { id: 'hb.clutch', at: ringAt, chain: 0.6, yaw: Math.PI, size: 0.6, room: 'furnace', from: [RX, UP, FL - 1.5] });
  add(BellEar, { id: 'cF', at: ringAt, reach: 2.5, struck: true, ringId: 'hb.clutch',
    heard: 'The clutch bites: the two east pistons stand up. Not for long.', heardKey: 'cF.bite', fading: 'The clutch is slipping.' });
  add(Door, { id: 'd4', at: [0, UP, FE + 0.6], ...DOOR });
  add(Mark, { room: 'furnace', at: [-2.6, UP, F0 + 2.4], yaw: 0 });
  add(Mark, { room: 'furnaceFar', at: [-4.5, UP, FG + 2.2], yaw: 0 });
  add(PowerGauge, { shows: 'shaft', room: 'furnace', at: [-13.5, UP, F0 + 3] });
  add(PowerGauge, { shows: 'shaft', room: 'furnaceFar', at: [-13.5, UP, FG + 2.4] });

  // ---- the antechamber and the Tooth-Warden's hall (UP)
  const H0 = FE + 1.2, AE = H0 + HALL.ante;
  K.corridor([0, FE + 0.6], [0, AE + 0.6], UP, DOOR);
  add(Mark, { room: 'ante', at: [DOOR.w / 2 - 0.6, UP, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = HALL.r, CWZ = HALL.z;
  K.rotunda({ x: 0, z: CWZ, y: UP, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0.3 });
  K.add(band, T(annulus(HR - 0.15, HR + 0.02, 0.8, 72), [0, UP + 9, CWZ]));
  // the engine's great shaft through the middle of the hall's roof, the great gear on the floor (it turns with the
  // warden from its second phase; a ball in its teeth stops it), its groove from the west wall
  K.both(M.stone, T(new THREE.CylinderGeometry(1.4, 1.4, 14, 16), [0, UP + 26 - 7, CWZ]));
  add(Gear, { at: [0, UP + 0.04, CWZ], r: 9.6, jam: { drumOn: ['bG', 'pG'] } });
  K.both(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, UP + 0.25, CWZ]));
  K.add(M.dark, box(7.2, 0.04, 1.0, -14, UP + 0.02, CWZ));
  add(Ball, { id: 'bG', a: [-17.4, UP + 0.04, CWZ], b: [-10.6, UP + 0.04, CWZ], r: 1.0 });
  add(Plate, { id: 'pG', at: [-10.6, UP, CWZ], r: 1.2 });
  add(Door, { id: 'd5', at: [0, UP, CWZ + HR + 0.7], ...DOOR });
  const O1 = CWZ + HR + 10.4;
  K.corridor([0, CWZ + HR + 0.7], [0, O1], UP, DOOR);
  K.wall(4.6, O1 + 0.4, -4.6, O1 + 0.4, UP, DOOR.h, { t: 0.8, holes: [{ at: 4.6, w: 3.4, h: 5 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, UP, O1 + 0.9]));
  K.solid(box(4, 5, 0.5, 0, UP + 2.5, O1 + 1.3));

  // (in the futuristic skin, rust-red plates on navy: skin.warden)
  const model = sentinelModel({ hull: '#c4553a', hull2: '#8e3a2b', dark: '#33485a', brass: '#e2b552', eye: '#f6c84e', ...rt.skin?.warden, vents: 4, legs: 4, guarded: false });
  model.mouthR = 0.01; model.bodyR = 2.0;   // (its four vents are the targets: rt.volley)
  model.pos.copy(K.world(0, UP, CWZ + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, UP, CWZ + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, UP, CWZ), r: HR, y: K.world(0, UP, 0).y };

  add(Mark, { room: 'crank', at: [-9.5, UP, PASSAGE.z0 + 3.5], yaw: Math.PI * 0.75 });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-58, -10, -3), V(62, 40, O1 + 3)),
    gadget: { at: W(CX0, 0.62, C3).toArray(), face: K.heading(-Math.PI / 2) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, UP + 0.5, O1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 14, 26, 30], [0, 14, 56, 30], [-18, 13, 58, 18], [0, 13, 79, 20], [B.x, 10, B.z, 20], [CX0, 10, C3, 22], [GV.x, 10, GV.z, 20],
      [0, UP + 5, CZ, 22], [0, UP + 6, AZ, 20], [0, UP - 3, (FL + FG) / 2, 30], [0, UP + 5, FG + 8, 24], [0, UP + 5, F0 + 6, 20], [0, UP + 7, CWZ, 30]],
    guardian: { def: { ...TOOTH_WARDEN, onHit: wardenHit, openFor: wardenOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Engine-House on the dunes
function exterior(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const yaw = SITE.heading;
  let lo = Infinity;
  for (let a = 0; a < 12; a++) for (const r of [0, 10, 20]) lo = Math.min(lo, H(SITE.x + Math.sin(a / 12 * TAU) * r, SITE.z + Math.cos(a / 12 * TAU) * r));
  const base = lo - 4, R = 20;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw));
  const foot = V(SITE.x, 0, SITE.z).addScaledVector(f, R + 6);
  const dy = Math.max(H(foot.x, foot.z), H(SITE.x + f.x * (R + 1), SITE.z + f.z * (R + 1))) + 0.3 - base;
  const K = new TempleKit(rt.root, 'The Engine-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M;
  const landmarkTop = landmark(K, 'buried', { y: dy, R, ground: H });
  // A dark furnace arch grows out of the riveted red plinth.
  // (the drawing's tall oval door, framed three times in riveted iron inside the plinth's arch, amber light:
  // src/temples/portal.js)
  const P = portal(K, { y: dy, z: R + .2, w: 5.2, h: 9.6, shape: 'oval', layers: 3, step: .6, recess: .6, back: 1.7, into: 1.5,
    frame: lmMetal('#c94d32', 'iron'), inlay: '#ffb04a' });
  K.both(M.floor, box(12, dy, 9, 0, dy / 2, R + 3.5));
  K.flush();
  const at = K.world(0, dy, R + 1.6);
  const front = K.world(0, dy, R + 10);
  return { door: { at, heading: yaw, ...P.door }, kit: K, base, doorY: base + dy, R, top: base + landmarkTop, clear: [{ x: SITE.x, z: SITE.z, r: 55 }, { x: front.x, z: front.z, r: 10 }] };
}

// ------------------------------------------------------------------ the world change: the engine runs, the pipe-cart rides again
/**
 * Once the Tooth-Warden is stopped the engine runs, and the machine's old
 * pipe-cart rides again: a round iron floor with a rail, from the start
 * hollow down the sand ramp and the canyon to the oculus, a pause at each end.
 * Chimneys of the Engine-House smoke (its cap's ring glows).
 */
function change(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const canyonX = level.buried?.canyonX ?? (() => 0), floorAt = level.buried?.floorAt ?? (() => 0);
  // the cart's path: down the canyon's middle, a metre over what is under it (built once the physics is there)
  const worldKit = new TempleKit(rt.root, 'The pipe-cart', V(0, 0, 0), 0, rt.M);
  const cartRt = Object.create(rt, { kit: { value: worldKit } });   // (the temple's runtime, in the world's frame: the player, the logic as they are)
  let cart = null, on = false;
  const stops = [];
  const build = (physics) => {
    const path = [];
    for (let z = -18; z >= -446; z -= 6) {
      const x = canyonX(z), guess = Math.max(floorAt(z), z > -40 ? H(x, z) : -Infinity);
      // (the highest ground under the cart's whole round floor)
      let g = -Infinity;
      for (const [dx, dz] of [[0, 0], [2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4]]) g = Math.max(g, physics?.groundAt?.(x + dx, guess + 40, z + dz, 80) ?? guess);
      path.push([x, (Number.isFinite(g) ? g : guess) + 1.0, z]);
    }
    cart = new Platform(cartRt, { path, r: 2.6, speed: 6, pause: 6, when: { resolved: true } });
    // a rail round its rim, and a lamp on a post
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.08, 4, 40).rotateX(Math.PI / 2).translate(0, 1.0, 0), makeMaterial({ color: '#e2b552', flat: true }));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6).translate(0, 0.8, -2.4), makeMaterial({ color: '#33485a', flat: true }));
    for (const m of [rail, post]) { m.userData.noCollide = true; m.userData.dynamic = true; cart.group.add(m); }
    // the two stops: a ring of iron set in the ground at each end
    for (const p of [path[0], path.at(-1)]) {
      const g = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 6, 40).rotateX(Math.PI / 2).translate(p[0], p[1] - 0.9, p[2]), makeMaterial({ color: '#e2b552', glow: 0.3, flat: true }));
      g.userData.noCollide = true;
      rt.root.add(g); stops.push(g);
    }
    api.cart = cart;
    api.set(on);
  };
  const api = {
    cart: null,
    init(physics) { if (!cart) build(physics); },
    set(v) { on = !!v; if (cart) cart.group.visible = on; for (const g of stops) g.visible = on; },
    update(dt, t) { if (on && cart) cart.update(dt, t); },
    solids: () => (on && cart ? [cart] : []),
  };
  return api;
}

export const BURIED_TEMPLE = {
  id: 'buried', levelId: 'buried', name: 'The Engine-House', doorLabel: 'door of the Engine-House',
  gadget: 'bomb', gadgetBox: 'buried.temple.cell', arenaDoor: 'd4', arenas: ARENAS,   // (the box's id from when it held the fourth chamber: the saves' flag)
  origin: [-150, 2200, -280], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its futuristic skin, issue #342: the look of the author's picks over the same rooms, src/temples/skins/engine-house.js)
  skin: engineHouseSkin,
  local: { person: 'brann', out: 8, side: 5 },
  enterLine: 'Inside the Engine-House it is warm, and everything smells of oil. Something far ahead is grinding, stuck.',
  pitLine: 'You climb back out of the furnace pit, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the machine’s old pipe-cart has begun to ride the canyon again.', 'resolved.out'); },
  onLit(rt, id) { if (id === 's1' && !rt.logic.drumOn('ball0', 'pY')) rt.notice('The valve hisses; the engine doesn’t turn. A stone ball jams its crank.', 'valve.jammed'); },
  // the warden's four vents: each a target while it faces out, open; all four inside a breath is a hit. From its second
  // phase it turns on the great gear; jammed (a ball in its teeth), a volley counts twice. In its last, the gear free,
  // it opens turning, one vent at a time facing out; and as it shifts into that phase it stamps the ball out
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const hits = [-1e9, -1e9, -1e9, -1e9], at = [V(), V(), V(), V()];
    const jammed = () => rt.logic.drumOn('bG', 'pG');
    const facing = (i) => G.state === 'open' && (G.phaseIndex < 2 || jammed() || G.model.only === i);
    rt.gearJammed = jammed;
    rt.volley = (i) => {
      const clock = rt.time;
      if (G.state !== 'open') { rt.notice('Its vents are shut. Wait for them to open.', 'tw.shut'); return; }
      if (!facing(i)) { rt.notice('That vent has turned away: they open one at a time as it turns.', 'tw.turned'); return; }
      hits[i] = clock;
      rt.sound?.critter?.('clank', 0.9);
      if (hits.every((h) => clock - h <= VOLLEY)) {
        hits.fill(-1e9);
        G.add(G.phaseIndex === 1 ? (jammed() ? GEAR.jammed : GEAR.free) : 0.25, 'volley');
        if (G.phaseIndex >= 1 && jammed()) rt.notice('The gear holds it, and all four take it at once. It reels.', `tw.jammed.${G.phaseIndex}`);
        rt.rumble(0.6, 0.45);
        if (G.state === 'open') { G.enter('fight'); G.cool = 1.6; }
      } else if (hits.filter((h) => clock - h <= VOLLEY).length === 3 && !rt.logic.has('magic:4')) rt.notice('Three vents, and the bar is spent. A bomb on a vent takes three.', 'tw.three');
    };
    for (let i = 0; i < 4; i++) {
      // (a splash on it, or a bomb's blast reaching it: issue #377, the bombs are the house's tool; a shove rings off)
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.9, position: () => G.model.vent(i, at[i]), enabled: () => facing(i), onHit: (mode, point, dir, info) => { if (mode !== 'push' || info?.mode === 'bomb') rt.volley(i); return true; } }));
    }
    let lastPhase = G.phaseIndex, openT = 0;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.phaseIndex !== lastPhase) {
        lastPhase = G.phaseIndex;
        const b = rt.piece('bG');
        if (G.phaseIndex === 2 && b && jammed()) {
          b.t = 0.35; b.v = 0; b.rest = true; b.place(); rt.logic.moveDrum('bG', 0.35);
          rt.notice('It stamps on the great gear, and the ball jumps out of its teeth.', 'tw.stamp');
          rt.rumble?.(0.8, 0.5);
        }
      }
      openT = G.state === 'open' ? openT + dt : 0;
      G.model.only = G.state === 'open' && G.phaseIndex >= 2 && !jammed() ? Math.floor(openT / GEAR.turn) % 4 : null;
    };
  },
};
