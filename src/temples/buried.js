import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bank, Platform, Bridge, Hammer, Mark, Pit } from './pieces.js';
import { sentinelModel } from './guardians.js';

// The Buried Machine's temple: the Engine-House, a drum of rust-red iron as
// tall as the oculus, standing out of the dunes west of the domes, pipe
// elbows round its foot and a ring window high up. The dome people say the
// wheel's engine is in there, and the Tooth-Warden that minds it: it has been
// jamming the engine since the night the sky rang, which is why the wheel
// turns one tooth a year and no more. It is a machine: you may stop it.
//
// Inside (built far overhead, through its oval door), one idea from the first room to the last: A BALL IN THE
// TEETH STOPS THE ENGINE THERE (reworked from the temple design audit, v1.17). The Tooth-Warden jams the whole
// engine; the makers' own jams are stone balls, rolled into a crank's teeth: what that crank drives stops where it
// stands, and stays stopped while the ball sits there. Where the engine is in your way, jam it; where it hides what
// you need, jam it showing.
//   the Threshold          the first mark, the way out
//   the Piston Hall        pistons that rise and fall out of step to the gantry, still: the valve (an eye high by the
//                          way in) hisses, but a stone ball sits in their crank's teeth. Roll it out, and they run
//                          (push it back, and they stop where they are). On the gantry another ball waits at the head
//                          of a groove
//   the Crank Hall         a walkway over a pit, and the engine's great hammer slamming down on it, driven by a
//                          crank wheel beside the way. The ball's groove runs from the gantry, through the corridor,
//                          into the crank's teeth: roll it in, and the hammer stops at the top of its stroke
//   the Fourth Chamber     the makers' chest: the FOURTH CHAMBER (src/items.js 'cell'): a fourth unit on the magic
//                          bar. The door on wants four eyes that wake only together, inside one breath: four shots,
//                          and the starting bar only holds three (needs 'magic:4', src/resources.js meets). They stand
//                          on pistons behind a parapet that rise in turn, one crank for all four: jam it, all four up
//   the Furnace            a chasm over embers; the bridge rises on four eyes in one breath, but each eye stands on
//                          a piston behind the far parapet, and the pistons rise in turn with the stroke, never four
//                          up inside a breath. Two cranks on the near lip drive the two west pistons, a ball in a
//                          groove by each: jam those two up, then catch the other two as they rise one after the
//                          other (the fourth chamber with the push)
//   the Tooth-Warden's Hall the guardian (a robot: its meter is damage). When its four vents open, hit all four inside
//                          a breath. From its second phase it turns on the great gear in the floor; a ball in the
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

export const PALETTE = {
  wall: '#c4553a', wall2: '#b04a33', wall3: '#d2694c', floor: '#c9b896', floor2: '#b9a684', trim: '#e9dcc0',
  dark: '#33485a', stone: '#8e9fb2', accent: '#5fa6a0', glow: '#f6c84e', lamp: '#f6c84e', sand: '#e9dcc0', sand2: '#d6c8a6',
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
  id: 'buried', entry: 'threshold', gadget: 'cell',
  rooms: { threshold: { checkpoint: true }, pistons: { checkpoint: true }, weight: { checkpoint: true }, cell: { checkpoint: true }, furnace: { checkpoint: true }, furnaceFar: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'pistons' },
    { a: 'pistons', b: 'weight', door: 'pumps' },   // the pistons, while the valve is open and no ball sits in their crank
    { a: 'weight', b: 'cell', door: 'h1' },         // the hammer over the walkway, stopped: the gantry's ball in its crank
    { a: 'cell', b: 'furnace', door: 'd3' },
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
    // the gantry's ball, rolled down its groove through the corridor into the hammer's crank (pJ): the hammer stops
    ballJ: { type: 'drum', room: 'pistons', plate: 'pJ', plateAt: 1, start: 0 },
    pJ: { type: 'plate', room: 'weight' },
    h1: { type: 'door', opens: { drumOn: ['ballJ', 'pJ'] } },
    chest: { type: 'gadget', room: 'cell', item: 'cell' },
    // the Fourth Chamber: four eyes on pistons that rise in turn, one crank for all four: jammed, all stay up
    bK: { type: 'drum', room: 'cell', plate: 'pK', plateAt: 1, start: 0 },
    pK: { type: 'plate', room: 'cell' },
    k1: { type: 'switch', room: 'cell', needs: ['magic:4'], when: { drumOn: ['bK', 'pK'] } },   // four eyes in one breath
    d3: { type: 'door', opens: { lit: 'k1' }, latch: true },
    // the Furnace: the two west pistons jammed up (a ball in each crank), then four in a breath
    bA: { type: 'drum', room: 'furnace', plate: 'pA', plateAt: 1, start: 0 },
    pA: { type: 'plate', room: 'furnace' },
    bB: { type: 'drum', room: 'furnace', plate: 'pB', plateAt: 1, start: 0 },
    pB: { type: 'plate', room: 'furnace' },
    k2: { type: 'switch', room: 'furnace', needs: ['magic:4'], when: { all: [{ drumOn: ['bA', 'pA'] }, { drumOn: ['bB', 'pB'] }] } },
    br1: { type: 'bridge', opens: { lit: 'k2' }, latch: true },
    d4: { type: 'door', opens: null },                            // the arena's door: shut while the warden fights
    // the hall's great gear: a ball in its teeth stops the warden turning (its last phase wants it)
    bG: { type: 'drum', room: 'hall', plate: 'pG', plateAt: 1, start: 0 },
    pG: { type: 'plate', room: 'hall' },
    warden: { type: 'boss', room: 'hall', needs: ['backpack', 'magic:4'], requires: { drumOn: ['bG', 'pG'] } },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const TOOTH_WARDEN = {
  kind: 'robot', name: 'the Tooth-Warden', final: 'break', speed: 1.6, wakeTime: 2.8,
  wake: 'The machine in the hall straightens on its four legs with a noise like a dropped toolbox. Its lamp turns to you.',
  openHint: 'All four of its vents open at once, glowing. Hit all four, quickly.',
  resolved: 'The Tooth-Warden locks up, every joint at once, and goes still. Somewhere under your feet the engine catches, and runs.',
  missHint: 'It ploughs into the wall and stands there shuddering: all four of its vents open at once.',
  phases: [
    { to: 0.5, attacks: ['beam', 'mortar', 'stomp'], pause: 1.6, hint: 'When its four vents open, hit all four inside one breath.' },
    { to: 0.75, attacks: ['grind', 'beam', 'stomp'], pause: 1.2, hint: 'It grinds round on the great gear in the floor now. Roll the ball by the wall into the gear’s teeth and it cannot turn: four vents in one breath then count twice.' },
    { to: 1.0, attacks: ['charge', 'mortars', 'grind'], pause: 1.0, hint: 'Its plates are cracked and glowing. It stamped the ball out of the gear: now it opens turning, one vent at a time. Roll the ball back into the teeth, and all four stay open.',
      openHint: 'Its vents open as it turns on the gear, one at a time facing out. Jam the gear with the ball and all four stay open.' },
  ],
  attacks: {
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'eye', rig: 'lean', damage: 1, knock: 10, recover: 0.8, open: 3.2 },
    mortar: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    mortars: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', pose: 'mortar', damage: 0.5, knock: 6, recover: 0.6 },
    stomp: { shape: 'ring', at: 'front', ahead: 4, radius: 4, wind: 1.0, part: 'feet', rig: 'rear', damage: 0.75, knock: 9, recover: 0.4, then: 'stomp2' },
    stomp2: { shape: 'ring', at: 'front', ahead: 4, radius: 4, wind: 0.7, part: 'feet', rig: 'rear', pose: 'stomp', link: true, damage: 0.75, knock: 9, gap: 0.25, then: 'slam' },
    slam: { shape: 'ring', at: 'self', radius: 6, wind: 1.3, part: 'feet', rig: 'rear', link: true, wave: { speed: 9, reach: 18, width: 0.7, damage: 0.5 }, damage: 1, knock: 13, recover: 1.0, open: 3.0 },
    grind: { shape: 'ring', at: 'self', radius: 6, wind: 1.3, part: 'core', rig: 'spin', damage: 0.75, knock: 12, recover: 0.6, then: 'beamEnd' },
    beamEnd: { shape: 'lane', range: 28, width: 2.6, wind: 1.1, track: 0.6, part: 'eye', rig: 'lean', pose: 'beam', link: true, damage: 1, knock: 10, recover: 0.8, open: 3.2 },
    charge: { shape: 'lane', range: 16, width: 4.4, wind: 1.3, track: 0.65, part: 'eye', rig: 'crouch', dash: 11, damage: 1, knock: 12, recover: 1.0, open: 1.6, miss: 3.2 },
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
  /** A piston standing in its cylinder against a wall (decoration: the engine's own, still). */
  const cylinder = (x, z, y, h, r = 1.1) => {
    K.both(M.stone, new THREE.CylinderGeometry(r, r, h, 16).translate(x, y + h / 2, z));
    for (const yy of [y + 0.4, y + h - 0.4]) K.add(band, new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.35, 16).translate(x, yy, z));
    K.add(M.trim, new THREE.CylinderGeometry(r * 0.45, r * 0.45, 2.4, 10).translate(x, y + h + 1.2, z));
    K.add(M.dark, new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.5, 14).translate(x, y + h + 2.6, z));
  };
  /** A valve wheel on a pipe, facing along +x or -x (s). */
  const valve = (x, y, z, s = 1) => {
    K.add(brass, T(new THREE.TorusGeometry(0.55, 0.07, 5, 18), [x + s * 0.4, y, z], [0, Math.PI / 2, 0]));
    for (let i = 0; i < 3; i++) K.add(brass, T(new THREE.BoxGeometry(0.06, 1.05, 0.06), [x + s * 0.4, y, z], [(i / 3) * Math.PI, 0, 0]));
  };

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 16, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Piston Hall (z 12.6..44): pistons that rise and fall out of step to the gantry (top at 7)
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 16, roof: 'oculus', oculus: 0.22, omit: ['s'], doors: [{ side: 'n', w: 8.8, h: 6.4, y0: 7 }] });
  K.both(M.wallGlyph, box(22, 7, 6, 0, 3.5, 41));                     // the gantry (you could climb its face too; the pistons are the makers' way)
  K.both(M.trim, box(22.2, 0.3, 6.2, 0, 7.05, 41));
  // big pipes along the walls, gauges and valve wheels; the engine's own pistons standing in their cylinders
  for (const s of [-1, 1]) {
    K.both(M.stone, T(new THREE.CylinderGeometry(0.9, 0.9, 30, 14), [s * 10.2, 3, 28], [Math.PI / 2, 0, 0]));
    K.both(M.stone, T(new THREE.CylinderGeometry(0.6, 0.6, 30, 12), [s * 10.4, 5.4, 28], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) K.both(M.trim, T(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), [s * 10.95, 7.5, 18 + i * 8], [0, 0, Math.PI / 2]));
    for (let i = 0; i < 2; i++) valve(s * 10.2, 4.6, 22 + i * 12, -s);
    K.add(band, box(0.12, 0.6, 31, s * 10.94, 9, 28.3));
    rivets(13.2, 43.4, 9.6, s * 10.9, true); rivets(13.2, 43.4, 8.4, s * 10.9, true);
  }
  for (const z of [19, 34]) cylinder(-7.6, z, 0, 8.2, 1.2);
  // three pistons in a row toward the gantry, each a riding disc that rises and falls, out of step
  const RUN = { all: [{ lit: 's1' }, { drumOn: ['ball0', 'pY'] }] };
  add(Platform, { path: [[0, 0.3, 27.4], [0, 2.6, 27.4]], r: 2, speed: 1.1, pause: 1.2, when: RUN });
  add(Platform, { path: [[0, 2.4, 31.6], [0, 4.7, 31.6]], r: 2, speed: 1.1, pause: 1.2, phase: 1, when: RUN });
  add(Platform, { path: [[0, 4.9, 35.8], [0, 7.2, 35.8]], r: 2, speed: 1.1, pause: 1.2, when: RUN });
  // their crank, by the first piston, a ball sitting in its teeth (pZ); its groove runs west to a cup (pY). Out of the
  // teeth, the crank turns and the pistons ride; rolled back in, they stop where they are
  add(Cranks, { at: [[-3.3, 1.6, 27.4]], r: 1.3, jam: [{ not: RUN }], rods: false });
  K.add(M.stone, box(1.2, 0.3, 0.3, -2.65, 1.6, 27.4));
  K.add(M.dark, box(5.6, 0.04, 1.0, -6.0, 0.02, 27.4 - 1.6));
  add(Ball, { id: 'ball0', a: [-8.6, 0.04, 27.4 - 1.6], b: [-3.6, 0.04, 27.4 - 1.6], r: 0.9 });
  add(Plate, { id: 'pY', at: [-8.6, 0, 27.4 - 1.6], r: 1.1 });
  add(Plate, { id: 'pZ', at: [-3.6, 0, 27.4 - 1.6], r: 1.1 });
  for (const z of [27.4, 31.6, 35.8]) K.both(M.dark, T(new THREE.CylinderGeometry(1.2, 1.4, 0.1, 18), [0, 0.05, z]));
  add(Switch, { id: 's1', at: [-6, 3.2, 12.0], yaw: 0, size: 1.0 });   // the valve's eye, high on the south wall by the way in
  add(Mark, { room: 'pistons', at: [-6.5, 0, 16], yaw: Math.PI / 2 });

  // ---- the corridor (wide enough for the ball) and the Crank Hall (floor 7): a walkway over a pit, the engine's
  // hammer slamming down on it, its crank wheel beside the way. The gantry's ball rolls down its groove, through the
  // corridor, into the crank's teeth (pJ): the hammer stops at the top of its stroke
  const GX = -2.6, GZ0 = 39.6, GZ1 = 50.6;
  K.slab(-4.4, 44, 4.4, 46.6, 7, 0.8);
  K.wall(-4.4, 44.6, -4.4, 46.6, 7, 6.4, { t: 0.8 }); K.wall(4.4, 46.6, 4.4, 44.6, 7, 6.4, { t: 0.8 });
  K.both(M.wall, box(9.6, 0.8, 2.6, 0, 13.8, 45.6));
  K.add(M.dark, box(1.0, 0.04, GZ1 - GZ0 + 0.6, GX, 7.02, (GZ0 + GZ1) / 2));
  add(Ball, { id: 'ballJ', a: [GX, 7.04, GZ0], b: [GX, 7.04, GZ1], r: 1.0, lock: true });
  add(Plate, { id: 'pJ', at: [GX, 7, GZ1], r: 1.2 });
  K.hall({ x: 0, z: 54.6, w: 16, d: 16, y: 7, h: 10, floor: false, roof: true, doors: [{ side: 's', w: 8.8, h: 6.4 }, { side: 'n', w: 5, h: 6.4 }] });
  const W0 = 51.4, W1 = 57.8;
  K.slab(-8, 46.6, 8, W0, 7, 0.8);
  K.slab(-8, W1, 8, 62.6, 7, 0.8);
  K.slab(-1.3, W0, 1.3, W1, 7, 0.6);
  const ember = makeMaterial({ color: '#e0644a', glow: 0.55, flat: true, key: 'temple.buried.embers' });
  K.both(ember, box(16, 0.4, W1 - W0, 0, -2.6, (W0 + W1) / 2));
  K.both(M.dark, box(16, 1, W1 - W0, 0, -3.4, (W0 + W1) / 2));
  add(Pit, { room: 'weight', min: [-8.5, -6, W0], max: [8.5, 5.5, W1] });
  add(Hammer, { id: 'h1', at: [0, 7, (W0 + W1) / 2], w: 2.6, d: 2.4, top: 5.2, period: 2.6, crank: [GX, 8.6, GZ1 + 0.4], r: 1.5,
    hit: 'The hammer comes down and throws you off the walkway. Its crank wheel turns beside the way, a notch at its foot.' });
  K.add(band, box(16, 0.5, 0.12, 0, 13, 62.5)); rivets(-7.6, 7.6, 13.5, 62.45); rivets(-7.6, 7.6, 12.5, 62.45);
  for (const x of [-6.4, 6.4]) cylinder(x, 61.2, 7, 6.2, 0.9);
  add(Mark, { room: 'weight', at: [5, 7, 48.8], yaw: -Math.PI / 2 });

  // ---- the Fourth Chamber (a rotunda, floor 7): the chest; four eyes round the far door
  K.slab(-3.2, 63, 3.2, 65.6, 7, 0.8);
  const C3 = 75.2;
  K.rotunda({ x: 0, z: C3, y: 7, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 7, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 7.31, C3));
  K.add(band, T(annulus(9.32, 9.5, 0.6, 48), [0, 13.2, C3]));
  add(Door, { id: 'd3', at: [0, 7, C3 + 10.2], w: 5, h: 6.4, lamps: [{ lit: 'k1' }] });
  const QX = [-5.0, -3.4, 3.4, 5.0], QZ = C3 + 7.3, JAM = { drumOn: ['bK', 'pK'] };
  for (const sd of [-1, 1]) { K.both(M.wall, box(3.6, 2.2, 0.5, sd * 4.3, 8.1, C3 + 6.0)); K.add(band, box(3.8, 0.3, 0.6, sd * 4.3, 9.1, C3 + 6.0)); rivets(sd * 4.3 - 1.6, sd * 4.3 + 1.6, 8.4, C3 + 5.72); }
  for (const x of QX) K.both(M.dark, new THREE.CylinderGeometry(0.85, 0.95, 0.3, 16).translate(x, 7.15, QZ));
  K.add(M.stone, box(10.6, 0.36, 0.36, 0, 7.4, QZ + 0.5));   // the crankshaft under them all
  add(Bank, { id: 'k1', window: VOLLEY, stroke: STROKE,
    eyes: QX.map((x, i) => ({ at: [x, 11.0, QZ - 0.6], yaw: Math.PI, piston: { drop: 3.4, phase: i / 4, jam: JAM } })),
    unmet: 'All four woke, and the door does not stir: they never stand up together. Something has to hold their pistons up.',
    fade: 'They woke one by one as their pistons rose, and sank dark again. The pistons rise in turn: never four in one breath.' });
  // one crank for all four, on the chamber's west side, its rod to the shaft; a ball in a groove by it
  add(Cranks, { at: [[-6.6, 8.4, C3 + 2.2]], to: [[-6.6, 7.4, QZ + 0.5]], r: 1.3, jam: [JAM] });
  K.add(M.dark, box(1.0, 0.04, 4.6, -6.6, 7.02, C3 - 0.4));
  add(Ball, { id: 'bK', a: [-6.6, 7.04, C3 - 2.6], b: [-6.6, 7.04, C3 + 1.6], r: 0.9, lock: true });
  add(Plate, { id: 'pK', at: [-6.6, 7, C3 + 1.6], r: 1.1 });
  add(Mark, { room: 'cell', at: [6, 7, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Furnace (z 86..120): a chasm over embers; the bridge rises on four eyes in one breath, each on a piston
  // behind the far parapet that rises in turn with the engine's stroke; the two west pistons' cranks on the near lip,
  // a ball in a groove by each
  const F0 = C3 + 10.9;
  K.slab(-3.2, C3 + 10.1, 3.2, F0 + 0.6, 7, 0.8);
  K.hall({ x: 0, z: F0 + 17.2, w: 22, d: 34.4, y: -5, h: 24, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 12 }, { side: 'n', w: 5, h: 6.4, y0: 12 }] });
  K.slab(-11, F0, 11, F0 + 6, 7, 12);
  K.slab(-11, F0 + 26, 11, F0 + 34.4, 7, 12);
  K.both(ember, box(22, 0.4, 20, 0, -4.6, F0 + 16));
  K.both(M.dark, box(22, 1, 20, 0, -5.4, F0 + 16));
  for (const s of [-1, 1]) { K.add(band, box(0.12, 0.7, 34, s * 10.94, 15.5, F0 + 17.2)); rivets(F0 + 0.4, F0 + 34, 16.1, s * 10.9, true); rivets(F0 + 0.4, F0 + 34, 14.9, s * 10.9, true); }
  add(Pit, { room: 'furnace', min: [-12, -8, F0 + 6], max: [12, 2, F0 + 26] });
  add(Bridge, { id: 'br1', a: [0, 7, F0 + 5.9], b: [0, 7, F0 + 26.1], w: 4, n: 8 });
  // the far parapet: iron, chest-high, the door's gap in it; the four pistons behind it
  for (const s of [-1, 1]) {
    K.both(M.wall, box(8.4, 2.4, 0.6, s * 6.8, 8.2, F0 + 30.4));
    K.add(band, box(8.6, 0.3, 0.7, s * 6.8, 9.3, F0 + 30.4));
    rivets(s * 6.8 - 4, s * 6.8 + 4, 8.6, F0 + 30.08);
  }
  const PX = [-9.4, -5.6, 5.6, 9.4], PZ = F0 + 32.4;
  for (const x of PX) K.both(M.dark, new THREE.CylinderGeometry(0.95, 1.05, 0.3, 16).translate(x, 7.15, PZ));
  add(Bank, { id: 'k2', window: VOLLEY, stroke: STROKE,
    eyes: PX.map((x, i) => ({ at: [x, 12.0, PZ - 0.7], yaw: Math.PI, piston: { drop: 3.6, phase: i / 4, jam: i === 0 ? { drumOn: ['bA', 'pA'] } : i === 1 ? { drumOn: ['bB', 'pB'] } : null } })),
    unmet: 'All four woke together, and the bridge does not stir: two of the pistons sank as the others rose. Never four up in one breath, unless something holds them up.',
    fade: 'They woke one by one as their pistons rose, and went dark again: the pistons rise in turn, never four in one breath.' });
  // the two west pistons' cranks, at the near lip, their rods across the chasm; a ball in a groove by each
  const CX = [-9.4, -5.6], CZ = F0 + 4.9, G0z = F0 + 0.9;
  add(Cranks, { at: CX.map((x) => [x, 8.6, CZ]), to: CX.map((x) => [x, 6.4, PZ]), r: 1.4, jam: [{ drumOn: ['bA', 'pA'] }, { drumOn: ['bB', 'pB'] }] });
  for (const [i, x] of CX.entries()) {
    const id = i ? 'bB' : 'bA', plate = i ? 'pB' : 'pA';
    K.add(M.dark, box(1.0, 0.04, CZ - 0.5 - G0z + 0.6, x, 7.02, (G0z + CZ - 0.5) / 2));
    add(Ball, { id, a: [x, 7.04, G0z], b: [x, 7.04, CZ - 0.5], r: 0.9, lock: true });
    add(Plate, { id: plate, at: [x, 7, CZ - 0.5], r: 1.1 });
  }
  add(Door, { id: 'd4', at: [0, 7, F0 + 35], w: 5, h: 6.4 });
  add(Mark, { room: 'furnace', at: [-2.6, 7, F0 + 2.4], yaw: 0 });

  // ---- the corridor and the Tooth-Warden's hall (floor 7)
  const H0 = F0 + 35;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 7, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 7, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 7, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 14.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 7, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CW = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CW, y: 7, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  K.add(band, T(annulus(HR - 0.15, HR + 0.02, 0.8, 72), [0, 16, CW]));
  // the engine's great shaft through the middle of the hall's roof, the great gear on the floor (it turns with the
  // warden from its second phase; a ball in its teeth stops it), its groove from the west wall
  K.both(M.stone, T(new THREE.CylinderGeometry(1.4, 1.4, 14, 16), [0, 7 + 26 - 7, CW]));
  add(Gear, { at: [0, 7.04, CW], r: 9.6, jam: { drumOn: ['bG', 'pG'] } });
  K.both(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, 7.25, CW]));
  K.add(M.dark, box(7.2, 0.04, 1.0, -14, 7.02, CW));
  add(Ball, { id: 'bG', a: [-17.4, 7.04, CW], b: [-10.6, 7.04, CW], r: 1.0 });
  add(Plate, { id: 'pG', at: [-10.6, 7, CW], r: 1.2 });
  add(Door, { id: 'd5', at: [0, 7, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 7, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 7, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 7, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 7, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 14.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 7, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, 9.5, CW + HR + 10.9));

  const model = sentinelModel({ hull: '#c4553a', hull2: '#8e3a2b', dark: '#33485a', brass: '#e2b552', eye: '#f6c84e', vents: 4, legs: 4, guarded: false });
  model.mouthR = 0.01; model.bodyR = 2.0;   // (its four vents are the targets: rt.volley)
  model.pos.copy(K.world(0, 7, CW + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 7, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 7, CW), r: HR, y: K.world(0, 7, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -10, -3), V(24, 40, CW + HR + 12)),
    gadget: { at: W(0, 7.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 7.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 7, 20, 18], [0, 9, 36, 16], [0, 11, 54.6, 12], [0, 12, C3, 16], [0, 4, F0 + 16, 24], [0, 12, F0 + 28, 18], [0, 14, CW, 30]],
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
  const M = rt.M, top = dy + 52;
  const blue = { paint: new THREE.Color(PALETTE.stone), smooth: false, side: THREE.FrontSide };
  const teal = { paint: new THREE.Color(PALETTE.accent), smooth: true, side: THREE.FrontSide };
  // a riveted drum of rust iron in bands, a teal cap, a ring window high on its face
  // (the lathe itself collides: a straight cylinder inside it let a climber into its flared foot and crown, src/contact-audit.js)
  K.both(M.wall, lathe([[R + 2, 0], [R + 2, 4], [R, 5], [R, top - 2], [R + 1.2, top - 1.6], [R + 1.2, top], [R - 2, top + 0.6]], 40));
  for (let y = 12; y < top - 4; y += 9) K.both(blue, new THREE.CylinderGeometry(R + 0.3, R + 0.3, 1.0, 40).translate(0, y, 0));
  K.both(teal, new THREE.SphereGeometry(R - 1.5, 32, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, top + 0.4, 0));
  K.both(M.trim, T(new THREE.TorusGeometry(7, 0.7, 8, 40), [0, top - 14, R + 0.3]));
  K.both({ paint: new THREE.Color('#f3c39a'), smooth: true }, T(new THREE.CircleGeometry(6.4, 36), [0, top - 14, R + 0.35]));
  for (let i = 0; i < 18; i++) { const a = (i + 0.5) / 18 * TAU; K.add(M.glyph, T(glyphGeometry(2.0, 0.14), [Math.sin(a) * (R + 0.35), top - 4, Math.cos(a) * (R + 0.35)], [0, a, 0])); }
  // pipe elbows round its foot, going into the sand
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.9;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
    const g = new THREE.TorusGeometry(5, 1.4, 10, 20, Math.PI / 2).rotateY(a + Math.PI / 2);
    K.both(blue, g.translate(Math.sin(a) * (R + 4.6), dy + 1, Math.cos(a) * (R + 4.6)));
  }
  // the oval door on the face toward the start hollow, in a teal frame, a lintel with the glyph
  const z0 = R - 0.5, z1 = R + 4.2;
  for (const s of [-1, 1]) K.both(M.wall, box(3.8, 11, z1 - z0, s * 4.1, dy + 5.5, (z0 + z1) / 2));
  K.both(M.wall, box(4.4, 4, z1 - z0, 0, dy + 9, (z0 + z1) / 2));
  K.both(teal, T(new THREE.TorusGeometry(3.4, 0.5, 8, 32), [0, dy + 4.0, z1 + 0.2], [0, 0, 0], [0.75, 1.15, 1]));   // (4.1 x 6.8 m clear: the way in stays open)
  K.glyph([0, dy + 9.4, z1 + 0.05], 2.6, 0);
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.3, 7).translate(0, 3.5, 0), [0, dy, R + 0.2]));
  // after the picked entrance (references/temples/engine-house/sheet-2.jpg): the doorway an oval in an iron plate,
  // rivets round it, and the door itself swung back against the face on two great greased hinges
  const iron = { paint: new THREE.Color(PALETTE.wall2), smooth: false, side: THREE.FrontSide };
  const rivet = { paint: new THREE.Color('#d9a441'), smooth: false, side: THREE.FrontSide };
  const ow = 2.15, oh = 3.35, oy = dy + 4.0;
  {
    const f = new THREE.Shape();
    f.moveTo(-2.2, 0); f.lineTo(2.2, 0); f.lineTo(2.2, 7); f.lineTo(-2.2, 7); f.closePath();
    const hole = new THREE.Path(); hole.absellipse(0, oy - dy, ow, oh, 0, Math.PI * 2, true);
    f.holes.push(hole);
    K.add(iron, new THREE.ExtrudeGeometry(f, { depth: 0.3, bevelEnabled: false, curveSegments: 24 }).translate(0, dy, z1 - 0.32));
    for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; K.add(rivet, T(new THREE.SphereGeometry(0.09, 6, 4), [Math.cos(a) * (ow + 0.32), oy + Math.sin(a) * (oh + 0.32), z1 + 0.62])); }
    // the leaf: an oval of riveted iron, hinged at the doorway's left, swung back almost flat against the face
    const leaf = new THREE.Shape(); leaf.absellipse(ow, 0, ow, oh, 0, Math.PI * 2, false);
    const g = new THREE.ExtrudeGeometry(leaf, { depth: 0.22, bevelEnabled: false, curveSegments: 24 });
    K.both(iron, T(g, [-ow - 0.1, oy, z1 + 0.75], [0, Math.PI - 0.22, 0]));
    for (const y of [oy - 2, oy + 2]) {
      K.add(M.dark, T(new THREE.BoxGeometry(2.4, 0.34, 0.12), [-ow - 1.2, y, z1 + 1.02], [0, -0.22, 0]));
      K.add(M.dark, new THREE.CylinderGeometry(0.2, 0.2, 0.8, 10).translate(-ow - 0.1, y, z1 + 0.75));
    }
  }
  K.solid(box(4.4, 7, 0.6, 0, dy + 3.5, R - 0.2));
  K.both(M.floor, box(12, dy, 9, 0, dy / 2, R + 3.5));
  K.flush();
  const at = K.world(0, dy, R + 1.6);
  const front = K.world(0, dy, R + 10);
  return { door: { at, heading: yaw }, kit: K, base, doorY: base + dy, R, top: base + top, clear: [{ x: SITE.x, z: SITE.z, r: R + 10 }, { x: front.x, z: front.z, r: 10 }] };
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
  gadget: 'cell', gadgetBox: 'buried.temple.cell', arenaDoor: 'd4',
  origin: [-150, 2200, -280], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'brann', out: 8, side: 5 },
  enterLine: 'Inside the Engine-House it is warm, and everything smells of oil. Something far ahead is grinding, stuck.',
  pitLine: 'You climb back out of the furnace pit, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the machine’s old pipe-cart has begun to ride the canyon again.', 'resolved.out'); },
  onLit(rt, id) { if (id === 's1' && !rt.logic.drumOn('ball0', 'pY')) rt.notice('The valve hisses, and the pistons shudder and stay where they are. By the first one a stone ball sits in the teeth of their crank.', 'valve.jammed'); },
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
      if (!facing(i)) { rt.notice('That vent has turned away: it opens them one at a time as it turns on the gear. Jam the gear.', 'tw.turned'); return; }
      hits[i] = clock;
      rt.sound?.critter?.('clank', 0.9);
      if (hits.every((h) => clock - h <= VOLLEY)) {
        hits.fill(-1e9);
        G.add(G.phaseIndex === 1 ? (jammed() ? GEAR.jammed : GEAR.free) : 0.25, 'volley');
        if (G.phaseIndex >= 1 && jammed()) rt.notice('The gear holds it, and all four take it at once. It reels.', `tw.jammed.${G.phaseIndex}`);
        rt.rumble(0.6, 0.45);
        if (G.state === 'open') { G.enter('fight'); G.cool = 1.6; }
      } else if (hits.filter((h) => clock - h <= VOLLEY).length === 3 && !rt.logic.has('magic:4')) rt.notice('Three vents, and the magic bar is spent. A fourth shot would need a longer bar.', 'tw.three');
    };
    for (let i = 0; i < 4; i++) {
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.9, position: () => G.model.vent(i, at[i]), enabled: () => facing(i), onHit: (mode) => { if (mode !== 'push') rt.volley(i); return true; } }));
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
          rt.notice('It stamps on the great gear as it shifts, and the ball jumps out of its teeth.', 'tw.stamp');
          rt.rumble?.(0.8, 0.5);
        }
      }
      openT = G.state === 'open' ? openT + dt : 0;
      G.model.only = G.state === 'open' && G.phaseIndex >= 2 && !jammed() ? Math.floor(openT / GEAR.turn) % 4 : null;
    };
  },
};
