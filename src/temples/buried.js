import { landmark } from './landmarks.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bank, Platform, Bridge, Hammer, Mark, Pit, Key } from './pieces.js';
import { sentinelModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { engineHouseSkin } from './skins/engine-house.js';

// The Buried Machine's temple: the Engine-House, a drum of rust-red iron as
// tall as the oculus, standing out of the dunes west of the domes, pipe
// elbows round its foot and a ring window high up. The dome people say the
// wheel's engine is in there, and the Tooth-Warden that minds it: it has been
// jamming the engine since the night the sky rang, which is why the wheel
// turns one tooth a year and no more. It is a machine: you may stop it.
//
// Inside (built far overhead, through its oval door), one idea from the first room to the last: A BALL IN THE
// TEETH STOPS THE ENGINE THERE (reworked from the temple design audit, v1.19). The Tooth-Warden jams the whole
// engine; the makers' own jams are stone balls, rolled into a crank's teeth: what that crank drives stops where it
// stands, and stays stopped while the ball sits there. Where the engine is in your way, jam it; where it hides what
// you need, jam it showing.
//   the Threshold          the first mark, the way out
// (v1.77, issue #336: every room rebuilt to the redesign's rules, docs/design/temple-redesign.md: below, PH, CRANK…)
//   the Piston Hall        pistons that rise and fall out of step to the gantry, still: the valve (an eye on a post by
//                          the way in) hisses, but a stone ball sits in their crank's teeth. Roll it out, and they run
//                          (push it back, and they stop where they are)
//   the Crank Hall         a walkway over a pit, and the engine's great hammer slamming down on it, driven by a
//                          crank wheel in an iron casing west of the way. A ball's groove runs down the near landing
//                          into the crank's teeth: roll it in, and the hammer stops at the top of its stroke
//   the Fourth Chamber     the makers' chest: INK BOMBS (src/gadgets/bomb.js; issue #377: the fourth chamber, a fourth
//                          unit on the magic bar, was here, and went to the Garden of Spheres' makers' court). Its way on
//                          is open. Four eyes on posts round the chest wake only together, inside one breath: four hits,
//                          and the bar holds three shots, so one bomb's blast among two of them, the other two splashed
//                          (needs the bombs). Since v1.48 (issue #23) they are two by each of its shutters, west and east (v1.77: and north): woken,
//                          the shutters roll up (the bombs' first lock, where failing costs nothing). The hub:
//   the Boiler Room        (west, an arena) the engine's cold boilers; its doors shut behind you while its keepers
//                          stand. Won, the small key's cage sinks and its flue opens, a way on into the Crank Passage
//   the Governor Room      (east) the great key caged on an anvil, the hammer over the cage; one ball between two
//                          cranks, the hammer's and the one under four eyes on pistons behind a parapet. It starts in
//                          the hammer's: the hammer still, the pistons rising in turn. Roll it to the pistons' crank and
//                          they stand for four in a breath, but the hammer runs, down on the cage; roll it back (a woken
//                          eye stays awake) and the hammer stands still, and the cage sinks. The warden's door's key
//   the Crank Passage      a room on, behind the chamber's north shutter: its door wants four eyes in one breath too, but they
//                          stand on pistons behind a
//                          parapet that rise in turn, one crank for all four: jam it with the ball by it, all four
//                          up (a bomb over the parapet with the push, where failing costs a wait). And the Boiler Room's
//                          small key
//   the Furnace            a chasm over embers; the bridge rises on four eyes in one breath, but each eye stands on
//                          a piston behind the far parapet, and the pistons rise in turn with the stroke, never four
//                          up inside a breath. Two cranks on the near lip drive the two west pistons, a ball in a
//                          groove by each: jam those two up, then catch the other two as they rise one after the
//                          other, a bomb lobbed over the far parapet among two of them (the bombs with the push)
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
 * The engine's stroke in the Furnace: the four pistons rise in turn, each up for `up` s of every `period` (s), in
 * order west to east; jammed, one stays up. The hall's gear: in the warden's last phase, unjammed, one vent faces
 * out at a time, each for `turn` s (four inside a breath can't be done); jammed, all four. What a volley is worth in
 * its second phase, jammed and not.
 */
export const STROKE = { period: 8, up: 1.2 };
export const GEAR = { turn: 1.4, jammed: 0.25, free: 0.125 };

export const LOGIC = {
  id: 'buried', entry: 'threshold', gadget: 'bomb',
  // (v1.77, issue #336: every room tagged with its kind, the Boiler Room the one fight; the Crank Passage a room of its own)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, pistons: { checkpoint: true, kind: 'puzzle' }, weight: { checkpoint: true, kind: 'puzzle' },
    cell: { checkpoint: true, kind: 'puzzle' }, ways: { kind: 'passage' }, boiler: { checkpoint: true, kind: 'combat' }, gov: { checkpoint: true, kind: 'puzzle' },
    crank: { checkpoint: true, kind: 'puzzle' }, furnace: { checkpoint: true, kind: 'puzzle' }, furnaceFar: { kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'pistons' },
    { a: 'pistons', b: 'weight', door: 'pumps' },   // the pistons, while the valve is open and no ball sits in their crank
    { a: 'weight', b: 'cell', door: 'h1' },         // the hammer over the walkway, stopped: the near landing's ball in its crank
    // the Fourth Chamber is the hub (v1.48, issue #23), past the chest: its four eyes roll up the shutters over its ways
    // west and east (`ways`, one shutter each side, one element; v1.77, a third north into the Crank Passage); west the Boiler Room (an arena, its flue a way on into
    // the Crank Passage: the loop), east the Governor Room (one ball, two engines: the great key)
    { a: 'cell', b: 'ways', door: 'dS' },
    { a: 'ways', b: 'boiler', door: 'dB' },         // (open: it shuts behind you while its keepers stand)
    { a: 'boiler', b: 'crank', door: 'dBo' },       // the flue, won: out into the Crank Passage, by its west door
    { a: 'ways', b: 'gov' },
    { a: 'ways', b: 'crank' },                      // the Crank Passage, behind the chamber's north shutter (a room of its own since v1.77)
    { a: 'crank', b: 'furnace', door: 'd3' },       // its door, a room on from the chest: and the small key
    { a: 'furnace', b: 'furnaceFar', door: 'br1' },
    { a: 'furnaceFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Piston Hall: the valve's eye, and a ball sitting in the first piston's crank: out of the teeth (pY), they run
    s1: { type: 'switch', room: 'pistons' },
    ball0: { type: 'drum', room: 'pistons', plate: 'pY', plateAt: 0, stops: { pY: 0, pZ: 1 }, start: 1 },
    pY: { type: 'plate', room: 'pistons' },
    pZ: { type: 'plate', room: 'pistons' },
    pumps: { type: 'bridge', opens: { all: [{ lit: 's1' }, { drumOn: ['ball0', 'pY'] }] } },
    // the Crank Hall's ball, rolled down its groove across the near landing into the hammer's crank (pJ): the hammer stops
    // (v1.77, issue #336: it lay on the Piston Hall's gantry and was rolled through the corridor into this room)
    ballJ: { type: 'drum', room: 'weight', plate: 'pJ', plateAt: 1, start: 0.09 },   // (issue #275: it starts 1 m along its groove, off the wall it lay against: room behind it to push from)
    pJ: { type: 'plate', room: 'weight' },
    h1: { type: 'door', opens: { drumOn: ['ballJ', 'pJ'] } },
    // (issue #377: the chest held the fourth chamber, more magic; ink bombs now, the shots the bar can't hold)
    chest: { type: 'gadget', room: 'cell', item: 'bomb' },
    k0: { type: 'switch', room: 'cell', needs: ['bomb'] },          // the chamber's four still eyes, two by each shutter
    dS: { type: 'door', opens: { lit: 'k0' }, latch: true },        // its shutters west, east and (v1.77) north (three pieces, one element)
    // the Crank Passage: four eyes on pistons that rise in turn, one crank for all four: jammed, all stay up
    bK: { type: 'drum', room: 'crank', plate: 'pK', plateAt: 1, start: 0.22 },   // (issue #275: it starts 0.9 m along its groove, off the wall it lay against: room behind it to push from)
    pK: { type: 'plate', room: 'crank' },
    k1: { type: 'switch', room: 'crank', needs: ['bomb'], when: { drumOn: ['bK', 'pK'] } },   // four eyes in one breath
    d3: { type: 'door', lock: 'small', opens: { lit: 'k1' }, latch: true },
    // the Boiler Room: its keepers beaten, the small key's cage sinks and the flue opens on into the Crank Passage
    arB: { type: 'arena', room: 'boiler' },
    kS: { type: 'key', kind: 'small', room: 'boiler', when: { lit: 'arB' } },
    dB: { type: 'door', opens: null },
    dBo: { type: 'door', opens: { lit: 'arB' }, latch: true },
    // the Governor Room: one ball and two cranks, the hammer's (over the great key's cage, on its anvil) and the one
    // under four eyes on pistons. It starts in the hammer's: the hammer still, the pistons rising in turn. Rolled to the
    // pistons', they stand for four in a breath, but the hammer runs, down on the cage; rolled back (a woken eye stays
    // awake), the hammer stands still again and the cage sinks
    // (the eyes before the ball: once they can wake, the marker points at them, not at the ball's other stop)
    k3: { type: 'switch', room: 'gov', needs: ['bomb'], when: { drumOn: ['bQ', 'pQ'] } },
    bQ: { type: 'drum', room: 'gov', stops: { pH: 0, pQ: 1 }, start: 0 },
    pH: { type: 'plate', room: 'gov' },
    pQ: { type: 'plate', room: 'gov' },
    h2: { type: 'door', opens: { drumOn: ['bQ', 'pH'] } },          // the hammer stopped (no doorway: it guards the cage)
    kB: { type: 'key', kind: 'big', room: 'gov', when: { all: [{ lit: 'k3' }, { drumOn: ['bQ', 'pH'] }] } },
    // the Furnace: the two west pistons jammed up (a ball in each crank), then four in a breath
    bA: { type: 'drum', room: 'furnace', plate: 'pA', plateAt: 1, start: 0.43 },   // (issue #275: it starts 1.5 m along its groove, off the wall it lay against: room behind it to push from)
    pA: { type: 'plate', room: 'furnace' },
    bB: { type: 'drum', room: 'furnace', plate: 'pB', plateAt: 1, start: 0.43 },   // (issue #275: it starts 1.5 m along its groove, off the wall it lay against: room behind it to push from)
    pB: { type: 'plate', room: 'furnace' },
    k2: { type: 'switch', room: 'furnace', needs: ['bomb'], when: { all: [{ drumOn: ['bA', 'pA'] }, { drumOn: ['bB', 'pB'] }] } },
    br1: { type: 'bridge', opens: { lit: 'k2' }, latch: true },
    d4: { type: 'door', lock: 'big' },                            // the great key's door (and the arena's: shut while the warden fights)
    // the hall's great gear: a ball in its teeth stops the warden turning (its last phase wants it)
    bG: { type: 'drum', room: 'hall', plate: 'pG', plateAt: 1, start: 0.07 },   // (issue #275: it starts 0.5 m along its groove, off the wall it lay against: room behind it to push from)
    pG: { type: 'plate', room: 'hall' },
    warden: { type: 'boss', room: 'hall', needs: ['gun', 'bomb'], requires: { drumOn: ['bG', 'pG'] } },
    d5: { type: 'door', opens: { resolved: true } },
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

// ------------------------------------------------------------------ the rooms (v1.77, issue #336: as shrines)
/**
 * The house redone to the redesign's rules (docs/design/temple-redesign.md): every puzzle room 30 m across or more under
 * 18 m of iron, doors 7 by 9, each puzzle in the middle of its room, the Boiler Room the one fight. Local m, the
 * threshold's door at z 0, the floors at 0 (the Piston Hall's) and 7 (every room after its gantry).
 */
export const DOOR = { w: 7, h: 9 };
/** The Piston Hall: 32 by 36 under 20, the gantry (7 up) along its north wall from `gantry` (its face) to z1. */
export const PH = { x0: -16, x1: 16, z0: 12.6, z1: 48.6, h: 20, gantry: 42.6, pistons: [32.0, 36.2, 40.4], valve: [-6, 22] };
/**
 * The Crank Hall: 32 by 36 under 18, the pit across it (W0..W1, as long as it was: the walkway 6.4 m), the hammer over the
 * walkway; the ball's groove on the near landing (GZ0..GZ1, 11 m as it was: it ran in from the gantry), the hammer's crank
 * at its end in an iron casing that hides its notch from the walkway.
 */
export const CRANK = { x0: -16, x1: 16, z0: 53.4, z1: 89.4, h: 18, W0: 72.6, W1: 79.0, GX: -7, GZ0: 60.8, GZ1: 71.8 };
CRANK.casing = { x: -4.4, z0: 66, z1: 72.4, h: 3.4 };
/** The Fourth Chamber: a round hall 34 m across under 18, the chest in its middle, its four eyes on posts (r). */
export const CHAMBER = { z: 111, r: 17, h: 18, posts: 8.4 };
/**
 * The Crank Passage (a room of its own since v1.77, behind the chamber's north shutter): 30 m square under 18, the four pistons
 * and their parapet across its middle (QZ), the crank and its ball's groove beside them; the warden's way on (d3) north.
 */
export const PASSAGE = { x0: -15, x1: 15, z0: 132.6, z1: 162.6, h: 18, QZ: 152, QX: [-4.8, -1.6, 1.6, 4.8], CX: -6.6 };
/**
 * The Furnace: 34 by 58, its floor 12 m down; the near lip 18 m deep (the two cranks and their balls out on it), the chasm
 * 20 m (the bridge as long as it was), the far lip 20 m (the parapet and the four pistons 4.4 and 6.4 m past its edge).
 */
export const FURNACE = { w: 34, z0: 167, lip: 18, gap: 20, far: 20 };
FURNACE.d = FURNACE.lip + FURNACE.gap + FURNACE.far;
/** The Tooth-Warden's hall (a round hall as it was, r 20), past the antechamber (7.4 m) beyond the furnace's north door. */
export const HALL = { r: 20, ante: 7.4 };
HALL.z = FURNACE.z0 + FURNACE.d + 1.2 + HALL.ante + 0.6 + HALL.r;
// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/**
 * The Fourth Chamber's wings (local m, floor 7): the Boiler Room west (an arena), its flue north to the Crank Passage's
 * west door (the loop); the Governor Room east (the great key's anvil under the hammer, the hammer's crank and the
 * pistons' at the two ends of the ball's groove). Since v1.77 each 30 m square under 18, the governor's pieces round the
 * middle of its floor, the boilers round the middle of theirs.
 */
export const WING = {
  c: CHAMBER.z,                                // the Fourth Chamber's z
  boiler: { x: -36.6, w: 30, d: 30 },
  flue: { x: -30, z: 147.6, w: 10 },           // its way out: north up the flue to its landing, then east into the Crank Passage
  gov: { x: 36.6, w: 30, d: 30 },
};
WING.anvil = [WING.gov.x + 5.1, WING.c - 3.8]; WING.cage = 2.5;   // the great key's anvil, and the hammer's foot over its caged plinth (m)
WING.groove = { x: WING.gov.x - 2.1, z: [WING.c - 4.6, WING.c + 2.7] };   // the ball's: the hammer's crank at its south end, the pistons' at its north
WING.pistons = { x: [-6.3, -2.3, 2.3, 6.3].map((d) => WING.gov.x + d), z: WING.c + 6.6 };
WING.zone = { min: [WING.boiler.x - 15, 6, WING.c - 15], max: [WING.boiler.x + 15, 25, WING.c + 15] };

/** The Boiler Room's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's foes). */
export const ARENAS = [{
  el: 'arB', room: 'boiler', zone: WING.zone, doors: ['dB', 'dBo'], extra: 2,
  shut: 'The door clangs shut behind you. Among the cold boilers something gets up, ticking.',
  won: 'The last of them clatters down among the boilers. The key’s cage sinks, and the flue’s door opens.',
}];

/**
 * The Boiler Room (west of the Fourth Chamber, an arena among the engine's cold boilers: its doors shut behind you while
 * its keepers stand; won, the small key's cage sinks and the flue's door opens, a passage north and east into the Crank
 * Passage by its west door: the loop) and the Governor Room (east: the great key caged on an anvil, the hammer over the
 * cage; one ball in a groove between two cranks, the hammer's and the one under four eyes on pistons behind a parapet:
 * the cage sinks only once the four have woken and while the hammer stands still). The small key is for the Crank
 * Passage's door, the great key for the Tooth-Warden's.
 */
function wings(rt, K, M, { band, brass, rivets }) {
  const add = (P, o) => rt.add(P, o);
  const C = WING.c, B = WING.boiler, F = WING.flue, G = WING.gov, R = CHAMBER.r;
  // the Fourth Chamber's two shutters (one element: its four eyes in a breath roll both up)
  for (const s of [-1, 1]) add(Door, { id: 'dS', at: [s * (R + 0.7), 7, C], yaw: Math.PI / 2, w: DOOR.w, h: DOOR.h, lamps: [{ lit: 'k0' }] });
  add(Door, { id: 'dS', at: [0, 7, C + R + 0.7], w: DOOR.w, h: DOOR.h, lamps: [{ lit: 'k0' }] });   // (v1.77: and the north one, into the Crank Passage)
  // ---- the Boiler Room
  const bx1 = B.x + B.w / 2, bx0 = B.x - B.w / 2, bz1 = C + B.d / 2;
  K.corridor([bx1 + 0.6, C], [-(R + 0.7), C], 7, DOOR);
  K.hall({ x: B.x, z: C, w: B.w, d: B.d, y: 7, h: 18, roof: 'oculus', oculus: 0.25,
    doors: [{ side: 'e', at: 0, ...DOOR }, { side: 'n', at: F.x - B.x, ...DOOR }] });
  add(Door, { id: 'dB', at: [bx1 + 0.6, 7, C], yaw: Math.PI / 2, ...DOOR });   // (open: it shuts behind you while they stand)
  // four boilers round the middle, cold, their fireboxes dark, a gauge on each: the keepers come at you among them
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = B.x + sx * 7.5, z = C + sz * 7;
    K.both(M.stone, T(new THREE.CylinderGeometry(1.3, 1.3, 4.2, 18), [x, 8.9, z], [0, 0, Math.PI / 2]));
    for (const dx of [-1.7, 1.7]) K.add(band, T(new THREE.CylinderGeometry(1.45, 1.45, 0.3, 18), [x + dx, 8.9, z], [0, 0, Math.PI / 2]));
    K.both(M.dark, box(1.6, 1.0, 1.0, x, 7.5, z - sz * 0.9));
    K.add(brass, T(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14), [x, 10.6, z - sz * 0.6], [Math.PI / 2, 0, 0]));
    K.both(M.trim, new THREE.CylinderGeometry(0.22, 0.22, 14.6, 8).translate(x + 1.2, 17.5, z + sz * 0.4));   // (its flue pipe up into the roof)
  }
  add(Key, { id: 'kS', at: [bx0 + 1.8, 7, C], yaw: Math.PI / 2 });
  add(Mark, { room: 'boiler', at: [bx1 - 3.2, 7, C - 3.2], yaw: -Math.PI / 2, foes: [B.x, 7, C] });
  // the flue: won, its door opens; north to its landing, then east into the Crank Passage by its west door
  add(Door, { id: 'dBo', at: [F.x, 7, bz1 + 0.6], ...DOOR, lamps: [{ lit: 'arB' }] });
  const fz0 = F.z - F.w / 2;
  K.corridor([F.x, bz1 + 0.6], [F.x, fz0 - 0.6], 7, DOOR);
  K.hall({ x: F.x, z: F.z, w: F.w, d: F.w, y: 7, h: 11, roof: true, frieze: false, doors: [{ side: 's', ...DOOR }, { side: 'e', ...DOOR }] });
  K.add(band, box(0.12, 0.5, F.w - 1, F.x - F.w / 2 + 0.07, 12, F.z));
  K.corridor([F.x + F.w / 2 + 0.6, F.z], [PASSAGE.x0 - 0.6, F.z], 7, DOOR);

  // ---- the Governor Room: the great key on its anvil under the hammer, one ball between two cranks, round its middle
  K.corridor([R + 0.7, C], [G.x - G.w / 2 - 0.6, C], 7, DOOR);
  K.hall({ x: G.x, z: C, w: G.w, d: G.d, y: 7, h: 18, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, ...DOOR }] });
  const gx0 = G.x - G.w / 2, gx1 = G.x + G.w / 2, gz0 = C - G.d / 2;
  const [AX, AZ] = WING.anvil, [Z0, Z1] = WING.groove.z, GX = WING.groove.x;
  K.add(band, box(G.w, 0.5, 0.12, G.x, 15, gz0 + 0.06)); rivets(gx0 + 0.4, gx1 - 0.4, 15.5, gz0 + 0.1); rivets(gx0 + 0.4, gx1 - 0.4, 14.5, gz0 + 0.1);
  // the anvil, the great key caged on it, and the hammer over the cage: running, it comes down on the bars
  K.both(M.dark, box(3.4, 0.3, 3.0, AX, 7.15, AZ));
  K.add(band, box(3.6, 0.12, 3.2, AX, 7.3, AZ));
  add(Key, { id: 'kB', big: true, at: [AX, 7.3, AZ], yaw: -Math.PI / 2, cageH: WING.cage - 0.05 });   // (its cage up to the hammer's foot)
  add(Hammer, { id: 'h2', at: [AX, 7.3 + WING.cage, AZ], yaw: Math.PI / 2, w: 2.6, d: 2.4, top: 3.0, period: 2.6, crank: [GX, 8.6, Z0 - 0.4], r: 1.5 });
  // (the hammer's frame: two iron legs north and south of the anvil and a beam over them, the head's rod through it)
  for (const s of [-1, 1]) K.both(M.trim, box(0.6, 9.4, 0.6, AX, 11.7, AZ + s * 2.5));
  K.both(M.trim, box(0.8, 0.7, 5.6, AX, 16.75, AZ));
  // the ball's groove between the two cranks: the hammer's at its south end (where it starts), the pistons' at its north
  K.add(M.dark, box(1.0, 0.04, Z1 - Z0 + 0.6, GX, 7.02, (Z0 + Z1) / 2));
  add(Ball, { id: 'bQ', a: [GX, 7.04, Z0], b: [GX, 7.04, Z1], r: 0.9 });
  add(Plate, { id: 'pH', at: [GX, 7, Z0], r: 1.1 });
  add(Plate, { id: 'pQ', at: [GX, 7, Z1], r: 1.1 });
  // four eyes on pistons behind a parapet across the middle of the floor, one crank for all four at the groove's north end
  const PZ = WING.pistons.z, JAM = { drumOn: ['bQ', 'pQ'] }, PW = 14;
  K.both(M.wall, box(PW, 2.4, 0.6, G.x, 8.2, PZ - 1)); K.add(band, box(PW + 0.2, 0.3, 0.7, G.x, 9.3, PZ - 1)); rivets(G.x - PW / 2 + 0.4, G.x + PW / 2 - 0.4, 8.6, PZ - 1.32);
  for (const x of WING.pistons.x) K.both(M.dark, new THREE.CylinderGeometry(0.95, 1.05, 0.3, 16).translate(x, 7.15, PZ));
  K.add(M.stone, box(PW - 1, 0.36, 0.36, G.x, 7.4, PZ + 0.5));
  add(Bank, { id: 'k3', window: VOLLEY, stroke: STROKE,
    eyes: WING.pistons.x.map((x, i) => ({ at: [x, 12.0, PZ - 0.7], yaw: Math.PI, piston: { drop: 3.6, phase: i / 4, jam: JAM } })),
    unmet: 'All four woke, and went dark again: they never stand up together. Something has to hold their pistons up.',
    fade: 'They woke one by one as their pistons rose, and sank dark again. The pistons rise in turn: never four in one breath.' });
  add(Cranks, { at: [[GX, 8.4, Z1 + 0.6]], to: [[GX, 7.4, PZ + 0.5]], r: 1.3, jam: [JAM] });
  // the governor itself on the east wall: a spindle, two flyballs on their arms (still: the engine is jammed)
  K.both(M.trim, new THREE.CylinderGeometry(0.16, 0.16, 6, 8).translate(gx1 - 0.9, 11, C + 3.4));
  for (const s of [-1, 1]) {
    K.add(M.trim, T(new THREE.BoxGeometry(0.1, 2.4, 0.1), [gx1 - 0.9, 11.6, C + 3.4 + s * 0.85], [s * 0.78, 0, 0]));
    K.both(brass, new THREE.SphereGeometry(0.5, 12, 8).translate(gx1 - 0.9, 10.9, C + 3.4 + s * 1.7));
  }
  add(Mark, { room: 'gov', at: [gx0 + 2.2, 7, C - 4.6], yaw: Math.PI / 2 });
}

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

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 10, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(PH.x0 - 1.2, PH.z0, PH.x1 + 1.2, PH.z0, 0, PH.h, { t: 1.2, holes: [{ at: PH.x1 + 1.2, ...DOOR }] });

  // ---- the Piston Hall: pistons that rise and fall out of step up to the gantry (top at 7) along its north wall
  const PZ0 = PH.z0, PZ1 = PH.z1, PW = PH.x1 - PH.x0, GZ = (PH.gantry + PZ1) / 2, GD = PZ1 - PH.gantry;
  K.hall({ x: 0, z: (PZ0 + PZ1) / 2, w: PW, d: PZ1 - PZ0, y: 0, h: PH.h, roof: 'oculus', oculus: 0.22, omit: ['s'], doors: [{ side: 'n', ...DOOR, y0: 7 }] });
  K.both(M.wallGlyph, box(PW, 7, GD, 0, 3.5, GZ));                     // the gantry (its face not climbed, as no wall in the house is: the pistons are the way up, issue #115)
  K.both(M.trim, box(PW + 0.2, 0.3, GD + 0.2, 0, 7.05, GZ));
  // big pipes along the walls, gauges and valve wheels; the engine's own pistons standing in their cylinders
  const PL = PH.gantry - PZ0 - 1, PC = PZ0 + 0.5 + PL / 2;
  for (const s of [-1, 1]) {
    K.both(M.stone, T(new THREE.CylinderGeometry(0.9, 0.9, PL, 14), [s * (PH.x1 - 0.8), 3, PC], [Math.PI / 2, 0, 0]));
    K.both(M.stone, T(new THREE.CylinderGeometry(0.6, 0.6, PL, 12), [s * (PH.x1 - 0.6), 5.4, PC], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) K.both(M.trim, T(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), [s * (PH.x1 - 0.05), 9.5, 18 + i * 7], [0, 0, Math.PI / 2]));
    for (let i = 0; i < 3; i++) valve(s * (PH.x1 - 0.8), 4.6, 19 + i * 8, -s);
    K.add(band, box(0.12, 0.6, PZ1 - PZ0, s * (PH.x1 - 0.06), 11.5, (PZ0 + PZ1) / 2));
    rivets(PZ0 + 0.6, PZ1 - 0.6, 12.1, s * (PH.x1 - 0.1), true); rivets(PZ0 + 0.6, PZ1 - 0.6, 10.9, s * (PH.x1 - 0.1), true);
  }
  for (const z of [20, 36]) for (const s of [-1, 1]) cylinder(s * 12.4, z, 0, 8.2, 1.2);
  // three pistons in a row toward the gantry, each a riding disc that rises and falls, out of step
  const RUN = { all: [{ lit: 's1' }, { drumOn: ['ball0', 'pY'] }] };
  const [Q1, Q2, Q3] = PH.pistons;
  add(Platform, { path: [[0, 0.3, Q1], [0, 2.6, Q1]], r: 2, speed: 1.1, pause: 1.2, when: RUN });
  add(Platform, { path: [[0, 2.4, Q2], [0, 4.7, Q2]], r: 2, speed: 1.1, pause: 1.2, phase: 1, when: RUN });
  add(Platform, { path: [[0, 4.9, Q3], [0, 7.2, Q3]], r: 2, speed: 1.1, pause: 1.2, when: RUN });
  // their crank, by the first piston, a ball sitting in its teeth (pZ); its groove runs west to a cup (pY). Out of the
  // teeth, the crank turns and the pistons ride; rolled back in, they stop where they are
  add(Cranks, { at: [[-3.3, 1.6, Q1]], r: 1.3, jam: [{ not: RUN }], rods: false });
  K.add(M.stone, box(1.2, 0.3, 0.3, -2.65, 1.6, Q1));
  K.add(M.dark, box(5.6, 0.04, 1.0, -6.0, 0.02, Q1 - 1.6));
  add(Ball, { id: 'ball0', a: [-8.6, 0.04, Q1 - 1.6], b: [-3.6, 0.04, Q1 - 1.6], r: 0.9 });
  add(Plate, { id: 'pY', at: [-8.6, 0, Q1 - 1.6], r: 1.1 });
  add(Plate, { id: 'pZ', at: [-3.6, 0, Q1 - 1.6], r: 1.1 });
  for (const z of PH.pistons) K.both(M.dark, T(new THREE.CylinderGeometry(1.2, 1.4, 0.1, 18), [0, 0.05, z]));
  // the valve's eye, on a valve post out in the hall by the way in, facing you as you come in (it was on the south wall)
  const [VX, VZ] = PH.valve;
  K.both(M.stone, box(1.6, 4.4, 1.6, VX, 2.2, VZ));
  K.both(M.trim, box(1.9, 0.4, 1.9, VX, 4.6, VZ));
  for (const y of [0.6, 3.9]) K.add(band, box(1.72, 0.3, 1.72, VX, y, VZ));
  add(Switch, { id: 's1', at: [VX, 3.2, VZ - 0.85], yaw: Math.PI, size: 1.0 });
  add(Mark, { room: 'pistons', at: [-6.5, 0, 16], yaw: Math.PI / 2 });

  // ---- the corridor and the Crank Hall (floor 7): a walkway over a pit, the engine's hammer slamming down on it, its
  // crank wheel in an iron casing west of the way. The ball rolls down its groove across the near landing into the
  // crank's teeth (pJ): the hammer stops at the top of its stroke
  const { GX, GZ0, GZ1, W0, W1 } = CRANK, CZ = (CRANK.z0 + CRANK.z1) / 2, CW = CRANK.x1 - CRANK.x0;
  K.corridor([0, PZ1 + 0.6], [0, CRANK.z0 - 0.6], 7, DOOR);
  K.hall({ x: 0, z: CZ, w: CW, d: CRANK.z1 - CRANK.z0, y: 7, h: CRANK.h, floor: false, roof: 'oculus', oculus: 0.22, doors: [{ side: 's', ...DOOR }, { side: 'n', ...DOOR }] });
  K.slab(CRANK.x0 - 0.6, CRANK.z0 - 0.6, CRANK.x1 + 0.6, W0, 7, 0.8);
  K.slab(CRANK.x0 - 0.6, W1, CRANK.x1 + 0.6, CRANK.z1 + 0.6, 7, 0.8);
  K.slab(-1.3, W0, 1.3, W1, 7, 0.6);
  // (in the house's futuristic skin, amber light: skins/engine-house.js)
  const ember = rt.skin?.mats?.ember ?? makeMaterial({ color: '#e0644a', glow: 0.55, flat: true, key: 'temple.buried.embers' });
  K.both(ember, box(CW, 0.4, W1 - W0, 0, -2.6, (W0 + W1) / 2));
  K.both(M.dark, box(CW, 1, W1 - W0, 0, -3.4, (W0 + W1) / 2));
  // the pit's walls down to the embers (2 cm behind the landings' faces)
  for (const [z, s] of [[W0, -1], [W1, 1]]) K.both(M.wall, box(CW + 1.2, 9.58, 0.8, 0, 1.39, z + s * 0.42));
  for (const s of [-1, 1]) K.both(M.wall, box(0.8, 10.38, W1 - W0, s * (CRANK.x1 + 0.6), 1.79, (W0 + W1) / 2));
  add(Pit, { room: 'weight', min: [CRANK.x0 - 0.5, -6, W0], max: [CRANK.x1 + 0.5, 5.5, W1] });
  add(Hammer, { id: 'h1', at: [0, 7, (W0 + W1) / 2], w: 2.6, d: 2.4, top: 5.2, period: 2.6, crank: [GX, 8.6, GZ1 + 0.4], r: 1.5,
    hit: 'The hammer comes down and throws you off the walkway. Its crank wheel turns beside the way, a notch at its foot.' });
  // the ball's groove down the near landing, the crank's casing along its end, a beam from the casing over to the hammer
  K.add(M.dark, box(1.0, 0.04, GZ1 - GZ0 + 0.6, GX, 7.02, (GZ0 + GZ1) / 2));
  add(Ball, { id: 'ballJ', a: [GX, 7.04, GZ0], b: [GX, 7.04, GZ1], r: 1.0, lock: true });
  add(Plate, { id: 'pJ', at: [GX, 7, GZ1], r: 1.2 });
  const CA = CRANK.casing, CAZ = (CA.z0 + CA.z1) / 2;
  K.both(M.wall, box(2, CA.h, CA.z1 - CA.z0, CA.x, 7 + CA.h / 2, CAZ));
  K.both(M.trim, box(2.3, 0.3, CA.z1 - CA.z0 + 0.3, CA.x, 7 + CA.h + 0.15, CAZ));
  K.both(band, box(2.06, 0.4, CA.z1 - CA.z0 + 0.06, CA.x, 7.9, CAZ)); rivets(CA.z0 + 0.4, CA.z1 - 0.4, 9.4, CA.x + 1.05, true);
  K.add(M.stone, box(CA.x - GX - 0.4, 0.3, 0.3, (CA.x - 1 + GX + 0.3) / 2, 8.6, GZ1 + 0.4));   // (the wheel's axle into the casing)
  K.both(M.trim, box(0.8, CRANK.h - CA.h - 0.6, 0.8, CA.x, 7 + CA.h + (CRANK.h - CA.h) / 2, CA.z1 - 0.6));
  K.add(M.trim, box(-CA.x + 0.6, 0.7, 0.8, CA.x / 2, 7 + CRANK.h - 1.2, CA.z1 - 0.6));
  // (a strap along the north wall over its doorway's lintel)
  K.add(band, box(CW, 0.5, 0.12, 0, 18, CRANK.z1 - 0.06)); rivets(CRANK.x0 + 0.4, CRANK.x1 - 0.4, 18.5, CRANK.z1 - 0.1); rivets(CRANK.x0 + 0.4, CRANK.x1 - 0.4, 17.5, CRANK.z1 - 0.1);
  for (const x of [-9, 9]) cylinder(x, CRANK.z1 - 3.2, 7, 6.2, 0.9);
  for (const x of [-12, 12]) cylinder(x, CRANK.z0 + 3.2, 7, 6.2, 0.9);
  add(Mark, { room: 'weight', at: [6, 7, CRANK.z0 + 4.6], yaw: -Math.PI / 2 });

  // ---- the Fourth Chamber (a round hall, floor 7): the chest in its middle; four eyes on posts round it
  const C3 = CHAMBER.z, CR = CHAMBER.r;
  K.corridor([0, CRANK.z1 + 0.6], [0, C3 - CR - 0.7], 7, DOOR);
  // (the house's hub since v1.48: a way west into the Boiler Room, east into the Governor Room, north to the Crank Passage)
  K.rotunda({ x: 0, z: C3, y: 7, r: CR, h: CHAMBER.h, seg: 36, gaps: [Math.PI, 0, -Math.PI / 2, Math.PI / 2].map((a) => ({ a, ...DOOR })), oculus: 0.3 });
  K.both(M.trim, ...chestMound(0, 7, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  K.add(band, T(annulus(CR - 0.18, CR, 0.6, 64), [0, 7 + 12.5, C3]));
  // four still eyes on iron posts, two either side of the way to each shutter (west and east): four in one breath wake
  // them, and the shutters roll up (v1.48: before, a try that opened nothing; v1.77: on posts round the chest, off the wall)
  const K0 = [-Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42], PR = CHAMBER.posts;
  for (const a of K0) {
    const x = Math.sin(a) * PR, z = C3 + Math.cos(a) * PR;
    K.both(M.stone, new THREE.CylinderGeometry(0.8, 0.9, 4.6, 14).translate(x, 9.3, z));
    K.both(M.trim, new THREE.CylinderGeometry(1.05, 1.05, 0.4, 14).translate(x, 11.8, z));
    for (const y of [7.5, 10.9]) K.add(band, new THREE.CylinderGeometry(0.94, 0.94, 0.3, 14).translate(x, y, z));
  }
  add(Bank, { id: 'k0', window: VOLLEY, eyes: K0.map((a) => ({ at: [Math.sin(a) * (PR - 0.95), 10.6, C3 + Math.cos(a) * (PR - 0.95)], yaw: Math.PI + a })),
    full: 'All four woke, and went dark again: four in one breath, and the bar holds three shots.',
    fade: 'They woke one by one, and went dark again before the last: four in one breath. A bomb between two wakes both.' });
  add(Mark, { room: 'cell', at: [5, 7, C3 - 10], yaw: -Math.PI * 0.75 });

  // ---- the Crank Passage (floor 7), a room on: four eyes on pistons across its middle, one crank for all four
  const { QZ, QX, CX: KX } = PASSAGE, AZ = (PASSAGE.z0 + PASSAGE.z1) / 2;
  K.corridor([0, C3 + CR + 0.7], [0, PASSAGE.z0 - 0.6], 7, DOOR);
  K.hall({ x: 0, z: AZ, w: PASSAGE.x1 - PASSAGE.x0, d: PASSAGE.z1 - PASSAGE.z0, y: 7, h: PASSAGE.h, roof: 'oculus', oculus: 0.25,
    doors: [{ side: 's', ...DOOR }, { side: 'n', ...DOOR }, { side: 'w', at: WING.flue.z - AZ, ...DOOR }] });   // (and the Boiler Room's flue, in from the west)
  const DZ = PASSAGE.z1 + 0.6;
  add(Door, { id: 'd3', at: [0, 7, DZ], ...DOOR, lamps: [{ lit: 'k1' }] });
  const JAM = { drumOn: ['bK', 'pK'] }, QW = 11.6;
  K.both(M.wall, box(QW, 2.2, 0.5, 0, 8.1, QZ - 1.3)); K.add(band, box(QW + 0.2, 0.3, 0.6, 0, 9.1, QZ - 1.3)); rivets(-QW / 2 + 0.4, QW / 2 - 0.4, 8.4, QZ - 1.58);
  for (const x of QX) K.both(M.dark, new THREE.CylinderGeometry(0.85, 0.95, 0.3, 16).translate(x, 7.15, QZ));
  K.add(M.stone, box(-2 * KX + 0.4, 0.36, 0.36, 0, 7.4, QZ + 0.5));   // the crankshaft under them all
  add(Bank, { id: 'k1', window: VOLLEY, stroke: STROKE,
    eyes: QX.map((x, i) => ({ at: [x, 11.0, QZ - 0.6], yaw: Math.PI, piston: { drop: 3.4, phase: i / 4, jam: JAM } })),
    unmet: 'All four woke, and the door does not stir: they never stand up together. Something has to hold their pistons up.',
    fade: 'They woke one by one as their pistons rose, and sank dark again. The pistons rise in turn: never four in one breath.' });
  // one crank for all four, west of them, its rod to the shaft; a ball in a groove by it
  add(Cranks, { at: [[KX, 8.4, QZ - 5.1]], to: [[KX, 7.4, QZ + 0.5]], r: 1.3, jam: [JAM] });
  K.add(M.dark, box(1.0, 0.04, 4.6, KX, 7.02, QZ - 7.7));
  add(Ball, { id: 'bK', a: [KX, 7.04, QZ - 9.9], b: [KX, 7.04, QZ - 5.7], r: 0.9, lock: true });
  add(Plate, { id: 'pK', at: [KX, 7, QZ - 5.7], r: 1.1 });
  for (const x of [-10.5, 10.5]) cylinder(x, PASSAGE.z1 - 3, 7, 6.2, 0.9);

  // ---- the Furnace: a chasm over embers; the bridge rises on four eyes in one breath, each on a piston behind the far
  // parapet that rises in turn with the engine's stroke; the two west pistons' cranks out on the near lip, a ball in a
  // groove by each
  const F0 = FURNACE.z0, FL = F0 + FURNACE.lip, FG = FL + FURNACE.gap, FE = F0 + FURNACE.d, FW = FURNACE.w / 2;
  K.corridor([0, DZ], [0, F0 - 0.6], 7, DOOR);
  K.hall({ x: 0, z: (F0 + FE) / 2, w: FURNACE.w, d: FURNACE.d, y: -5, h: 30, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', ...DOOR, y0: 12 }, { side: 'n', ...DOOR, y0: 12 }] });
  K.slab(-FW, F0, FW, FL, 7, 12);
  K.slab(-FW, FG, FW, FE, 7, 12);
  K.both(ember, box(FURNACE.w, 0.4, FURNACE.gap, 0, -4.6, (FL + FG) / 2));
  K.both(M.dark, box(FURNACE.w, 1, FURNACE.gap, 0, -5.4, (FL + FG) / 2));
  for (const s of [-1, 1]) { K.add(band, box(0.12, 0.7, FURNACE.d - 0.4, s * (FW - 0.06), 18, (F0 + FE) / 2)); rivets(F0 + 0.4, FE - 0.4, 18.6, s * (FW - 0.1), true); rivets(F0 + 0.4, FE - 0.4, 17.4, s * (FW - 0.1), true); }
  add(Pit, { room: 'furnace', min: [-FW - 1, -8, FL], max: [FW + 1, 2, FG] });
  add(Bridge, { id: 'br1', a: [0, 7, FL - 0.1], b: [0, 7, FG + 0.1], w: 4, n: 8 });
  // the far parapet: iron, chest-high, the door's gap in it; the four pistons behind it
  for (const s of [-1, 1]) {
    K.both(M.wall, box(8.4, 2.4, 0.6, s * 6.8, 8.2, FG + 4.4));
    K.add(band, box(8.6, 0.3, 0.7, s * 6.8, 9.3, FG + 4.4));
    rivets(s * 6.8 - 4, s * 6.8 + 4, 8.6, FG + 4.08);
  }
  const PX = [-9.4, -5.6, 5.6, 9.4], PZ = FG + 6.4;
  for (const x of PX) K.both(M.dark, new THREE.CylinderGeometry(0.95, 1.05, 0.3, 16).translate(x, 7.15, PZ));
  add(Bank, { id: 'k2', window: VOLLEY, stroke: STROKE,
    eyes: PX.map((x, i) => ({ at: [x, 12.0, PZ - 0.7], yaw: Math.PI, piston: { drop: 3.6, phase: i / 4, jam: i === 0 ? { drumOn: ['bA', 'pA'] } : i === 1 ? { drumOn: ['bB', 'pB'] } : null } })),
    unmet: 'All four woke together, and the bridge does not stir: two of the pistons sank as the others rose. Never four up in one breath, unless something holds them up.',
    fade: 'They woke one by one as their pistons rose, and went dark again: the pistons rise in turn, never four in one breath.' });
  // the two west pistons' cranks, at the near lip, their rods across the chasm; a ball in a groove by each
  const CX = [-9.4, -5.6], CKZ = FL - 1.1, G0z = FL - 5.1;
  add(Cranks, { at: CX.map((x) => [x, 8.6, CKZ]), to: CX.map((x) => [x, 6.4, PZ]), r: 1.4, jam: [{ drumOn: ['bA', 'pA'] }, { drumOn: ['bB', 'pB'] }] });
  for (const [i, x] of CX.entries()) {
    const id = i ? 'bB' : 'bA', plate = i ? 'pB' : 'pA';
    K.add(M.dark, box(1.0, 0.04, CKZ - 0.5 - G0z + 0.6, x, 7.02, (G0z + CKZ - 0.5) / 2));
    add(Ball, { id, a: [x, 7.04, G0z], b: [x, 7.04, CKZ - 0.5], r: 0.9, lock: true });
    add(Plate, { id: plate, at: [x, 7, CKZ - 0.5], r: 1.1 });
  }
  add(Door, { id: 'd4', at: [0, 7, FE + 0.6], ...DOOR });
  add(Mark, { room: 'furnace', at: [-2.6, 7, F0 + 2.4], yaw: 0 });

  // ---- the antechamber and the Tooth-Warden's hall (floor 7)
  const H0 = FE + 1.2, AE = H0 + HALL.ante;
  K.corridor([0, FE + 0.6], [0, AE + 0.6], 7, DOOR);
  add(Mark, { room: 'ante', at: [DOOR.w / 2 - 0.6, 7, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = HALL.r, CWZ = HALL.z;
  K.rotunda({ x: 0, z: CWZ, y: 7, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, ...DOOR }, { a: 0, ...DOOR }], oculus: 0.3 });
  K.add(band, T(annulus(HR - 0.15, HR + 0.02, 0.8, 72), [0, 16, CWZ]));
  // the engine's great shaft through the middle of the hall's roof, the great gear on the floor (it turns with the
  // warden from its second phase; a ball in its teeth stops it), its groove from the west wall
  K.both(M.stone, T(new THREE.CylinderGeometry(1.4, 1.4, 14, 16), [0, 7 + 26 - 7, CWZ]));
  add(Gear, { at: [0, 7.04, CWZ], r: 9.6, jam: { drumOn: ['bG', 'pG'] } });
  K.both(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, 7.25, CWZ]));
  K.add(M.dark, box(7.2, 0.04, 1.0, -14, 7.02, CWZ));
  add(Ball, { id: 'bG', a: [-17.4, 7.04, CWZ], b: [-10.6, 7.04, CWZ], r: 1.0 });
  add(Plate, { id: 'pG', at: [-10.6, 7, CWZ], r: 1.2 });
  add(Door, { id: 'd5', at: [0, 7, CWZ + HR + 0.7], ...DOOR });
  const O1 = CWZ + HR + 10.4;
  K.corridor([0, CWZ + HR + 0.7], [0, O1], 7, DOOR);
  K.wall(4.6, O1 + 0.4, -4.6, O1 + 0.4, 7, DOOR.h, { t: 0.8, holes: [{ at: 4.6, w: 3.4, h: 5 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 7, O1 + 0.9]));
  K.solid(box(4, 5, 0.5, 0, 9.5, O1 + 1.3));

  // (in the futuristic skin, rust-red plates on navy: skin.warden)
  const model = sentinelModel({ hull: '#c4553a', hull2: '#8e3a2b', dark: '#33485a', brass: '#e2b552', eye: '#f6c84e', ...rt.skin?.warden, vents: 4, legs: 4, guarded: false });
  model.mouthR = 0.01; model.bodyR = 2.0;   // (its four vents are the targets: rt.volley)
  model.pos.copy(K.world(0, 7, CWZ + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 7, CWZ + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 7, CWZ), r: HR, y: K.world(0, 7, 0).y };

  // (the wings last: their marks after the others, so the machines' ids by mark stay as they were; the Crank Passage's
  // mark, new in v1.77, after them)
  wings(rt, K, M, { band, brass, rivets });
  add(Mark, { room: 'crank', at: [-9.5, 7, PASSAGE.z0 + 3.5], yaw: Math.PI * 0.75 });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-53, -10, -3), V(53, 40, O1 + 3)),
    gadget: { at: W(0, 7.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 7.5, O1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 8, 24, 24], [0, 11, 42, 20], [0, 12, CZ, 22], [0, 13, C3, 22], [WING.boiler.x, 13, C3, 20], [WING.gov.x, 13, C3, 20], [0, 13, AZ, 20], [WING.flue.x, 11, WING.flue.z, 9], [0, 4, (FL + FG) / 2, 30], [0, 12, FG + 8, 24], [0, 12, F0 + 6, 20], [0, 14, CWZ, 30]],
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
  const opening = new THREE.Shape();opening.moveTo(-2.2,0);opening.lineTo(-2.2,5.3);
  opening.quadraticCurveTo(-2,9,0,11);opening.quadraticCurveTo(2,9,2.2,5.3);opening.lineTo(2.2,0);opening.closePath();
  K.add(M.voidM,new THREE.ShapeGeometry(opening).translate(0,dy,R+.2));
  K.solid(box(4.4, 7, 0.6, 0, dy + 3.5, R - 0.2));
  K.both(M.floor, box(12, dy, 9, 0, dy / 2, R + 3.5));
  K.flush();
  const at = K.world(0, dy, R + 1.6);
  const front = K.world(0, dy, R + 10);
  return { door: { at, heading: yaw }, kit: K, base, doorY: base + dy, R, top: base + landmarkTop, clear: [{ x: SITE.x, z: SITE.z, r: 55 }, { x: front.x, z: front.z, r: 10 }] };
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
  onLit(rt, id) { if (id === 's1' && !rt.logic.drumOn('ball0', 'pY')) rt.notice('The valve hisses; the pistons don’t move. A stone ball jams their crank.', 'valve.jammed'); },
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
