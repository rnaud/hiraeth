import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bank, Platform, Bridge, Mark, Pit } from './pieces.js';
import { foremanModel } from './guardians.js';

// The Sealed Hangar's temple: the First Garage, a round stair-house of the
// makers on the rim of Brask's plateau, a great clock over its door, the
// makers' clockwork set into the cliff below it. The Major found it when he
// made the place (or the place made itself round it: nobody is sure), set up
// his first garage in its porch, and copied the glyph off its door stone "for
// luck, or for somebody". Everything that turns in his pocket universe took
// its beat from the clockwork under the plateau, kept by the makers' Clockwork
// Foreman; the night the light passed it jumped its escapement, three machines
// stopped, and it has been wound wrong ever since. It is a machine: you may
// stop it, or set it right.
//
// Inside (built far overhead, through its door). The temple's one idea (reworked from the temple design audit,
// docs/audits/temple-design-v1.12.md): the makers' clock counts round from where its hand points, and every
// clock in the house stopped at the same hour the night the light passed (four, as the clock over the door).
//   the Threshold        the Major's old bench, the first mark, the way out
//   the Escapement       a pit crossed by a disc that swings over it like a clock's escapement, still until the
//                        three eyes round the dial over the far door wake in turn: from the one its hand points
//                        at, round the way a clock goes (out of turn an eye only ticks)
//   the Winding Well     a wall to climb, the door at its top; the door wants the winding's counterweight home in
//                        its socket at the wall's foot, and the counterweight is a stone ball still waiting on the
//                        Escapement's far landing, its groove running through into the well (a room away, out of
//                        sight from the door)
//   the Coil Chamber     the makers' chest: the QUICK COIL (src/items.js 'coil'). Its way on is open
//   the Winding Passage  a room on, its walls lined with the makers' springs: the door into the gallery is ringed by
//                        six eyes that wake only together, inside one breath (4.6 s): three shots, a refill, three
//                        more; the tank refills too slowly without the coil (the coil's first lock, where failing
//                        costs a breath)
//   the Clock Gallery    the key hall, after its reference: a chasm with the makers' cogs turning in the dark,
//                        a great clock face on the far wall that has lost its hands, six eyes round it. The bridge
//                        wants all six inside one breath (the coil) and in turn, counted round from the hour the
//                        clock stopped at, which it no longer shows: the little clock over the way in does (and
//                        the Winding Well's, and the one over the door outside). Out of turn they all go dark
//   the Foreman's Workshop the guardian (a robot: its meter is damage). When its face opens, hit all six
//                        numerals inside a breath. Open, its hands come round to four; numerals hit in the clock's
//                        order counted from four ring in step (taught in its second phase, where any order still
//                        does); in its last phase only that order takes, and out of step they all go dark
// After: the clock over the First Garage's door keeps the true time, and the makers' cogs in the cliff
// below turn in step, their lamps lit (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the plateau's rim, west of the keep, past the windmill; its door looks back across the plateau toward the start. */
export const SITE = { x: Math.cos(150 * Math.PI / 180) * 205, z: Math.sin(150 * Math.PI / 180) * 205, r: 9 };
SITE.heading = Math.atan2(0 - SITE.x, 120 - SITE.z);

export const PALETTE = {
  wall: '#d8c3a0', wall2: '#cdb38c', wall3: '#e4d3b2', floor: '#8aa0b8', floor2: '#7d93ab', trim: '#d8a24a',
  dark: '#34405e', stone: '#62c3c9', accent: '#e6875f', glow: '#f2c54b', lamp: '#f2c54b', sand: '#e9d7b0', sand2: '#cfe0a8', void: '#2b2f4a',
};

export const VOLLEY = 4.6;   // s: the six eyes (and the Foreman's six numerals) must all be hit inside this
/** The Foreman's numerals (its model's lamps, i at 2i o'clock as you face it) in the clock's order from four. */
export const FROM_FOUR = [2, 3, 4, 5, 0, 1];

export const LOGIC = {
  id: 'garage', entry: 'threshold', gadget: 'coil',
  rooms: { threshold: { checkpoint: true }, esc: { checkpoint: true }, escFar: {}, well: { checkpoint: true }, coil: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'esc' },
    { a: 'esc', b: 'escFar', door: 'discs' },     // the escapement's disc, once the eye is splashed
    { a: 'escFar', b: 'well' },
    { a: 'well', b: 'coil', door: 'd2' },
    { a: 'coil', b: 'gallery', door: 'd3' },       // the Winding Passage's door, a room on from the chest (one room with it)
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'galleryFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the escapement's three eyes, in turn from where its hand points (eight), round the way a clock goes
    s1: { type: 'switch', room: 'esc' },
    s2: { type: 'switch', room: 'esc', after: 's1' },
    s3: { type: 'switch', room: 'esc', after: 's2' },
    discs: { type: 'bridge', opens: { all: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] }, latch: true },
    ball1: { type: 'drum', room: 'escFar', plate: 'p1', plateAt: 1, start: 0 },   // the counterweight, on the escapement's landing
    p1: { type: 'plate', room: 'well' },
    d2: { type: 'door', opens: { drumOn: ['ball1', 'p1'] }, latch: true },   // (the ball's weight: the winding's counterweight)
    chest: { type: 'gadget', room: 'coil', item: 'coil' },
    k1: { type: 'switch', room: 'coil', needs: ['coil'] },        // the passage's six eyes in one breath: two tanks
    d3: { type: 'door', opens: { lit: 'k1' }, latch: true },
    k2: { type: 'switch', room: 'gallery', needs: ['coil'], order: true },   // six in one breath, in turn from four
    br1: { type: 'bridge', opens: { lit: 'k2' }, latch: true },
    d4: { type: 'door', opens: null },                            // the arena's door: shut while the Foreman fights
    foreman: { type: 'boss', room: 'hall', needs: ['backpack', 'coil'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const FOREMAN = {
  kind: 'robot', name: 'the Clockwork Foreman', final: 'break', speed: 1.5, wakeTime: 2.8,
  wake: 'In the workshop something winds itself up with a long clatter of springs. A machine with a clock for a chest turns its face to you. Its hands are racing.',
  openHint: 'The glass over its face swings up and its six numerals glow. Hit all six, inside one breath.',
  resolved: 'The Clockwork Foreman shudders, and its hands come round, slowly, to the right time, and stop there. Under your feet something begins to tick, in step.',
  missHint: 'It spins on, dizzy, its hands whirling; the glass over its face swings up. Six numerals: now.',
  phases: [
    { to: 0.5, attacks: ['jab', 'chime', 'hammer'], pause: 1.6, hint: 'When it has struck, its face opens: six numerals, one breath. One tank will not do it.' },
    { to: 0.75, attacks: ['cog', 'spin', 'hammer'], pause: 1.2, hint: 'Its bell cracks and it winds itself up to spin, throwing cogs. Six numerals, one breath. When its face opens its hands stop at four, as every clock in the house: numerals hit round from there ring in step.' },
    { to: 1.0, attacks: ['jab', 'cogs', 'spin'], pause: 1.0, hint: 'It strikes faster, out of step, sparks from every seam, and now its numerals take only in step: six in one breath, round the way a clock goes from four, where its hands point.' },
  ],
  attacks: {
    hammer: { shape: 'cone', range: 10, angle: 0.7, wind: 1.3, track: 0.6, part: 'arms', rig: 'rear', damage: 0.75, knock: 11, recover: 0.8, open: 5.6 },
    jab: { shape: 'cone', range: 7, angle: 0.6, wind: 1.0, track: 0.7, part: 'arms', rig: 'lean', pose: 'cog', damage: 0.5, knock: 8, recover: 0.5, then: 'jab2' },
    jab2: { shape: 'cone', range: 7, angle: 0.6, wind: 0.65, track: 0.6, part: 'arms', rig: 'lean', pose: 'cog', link: true, damage: 0.5, knock: 8, gap: 0.2, then: 'hammerEnd' },
    hammerEnd: { shape: 'cone', range: 10, angle: 0.7, wind: 1.1, track: 0.5, part: 'arms', rig: 'rear', pose: 'hammer', link: true, damage: 0.75, knock: 11, recover: 0.8, open: 5.6 },
    chime: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'head', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, damage: 1, knock: 12, recover: 1.0, open: 5.6 },
    cog: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', damage: 0.75, knock: 8, recover: 0.6 },
    cogs: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', pose: 'cog', damage: 0.5, knock: 6, recover: 0.6 },
    spin: { shape: 'ring', at: 'self', radius: 6.5, wind: 1.3, part: 'arms', rig: 'spin', damage: 0.75, knock: 12, recover: 0.6, miss: 4.0 },
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
  const parts = [];
  const place = (obj, x, y, z, ry = 0) => { obj.position.copy(K.world(x, y, z)); obj.rotation.y = K.heading(ry); obj.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; }); rt.root.add(obj); return obj; };
  // cogs in the chasm: two great wheels along the walls, an escapement wheel lying under the bridge
  for (const [x, y, z, r, ry, rate] of [[-8.6, -1.5, F0 + 12, 5.2, Math.PI / 2, 0.12], [8.6, -2.5, F0 + 21, 6, Math.PI / 2, -0.09], [-1.5, -3.6, F0 + 17, 4.2, 0, 0.16]]) {
    const g = new THREE.Group(), m = new THREE.Mesh(cogGeometry(r), cogM);
    if (ry === 0) m.rotation.x = -Math.PI / 2;   // (lying flat)
    g.add(m);
    place(g, x, y, z, ry);
    parts.push(ry === 0 ? (t) => { m.rotation.z = t * rate; } : (t) => { m.rotation.z = t * rate; });
  }
  // arched niches on the side walls of both landings, each with a pendulum swinging in it
  for (const [x, z, s] of [[-10.95, F0 + 2.6, 1], [10.95, F0 + 2.6, -1], [-10.95, F0 + 31, 1], [10.95, F0 + 31, -1]]) {
    K.add(rt.M.dark, box(0.12, 5.6, 2.4, x + s * 0.06, 12.0, z));
    K.add(rt.M.dark, T(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), [x + s * 0.06, 14.8, z], [0, 0, 0]));
    K.add(brass, box(0.2, 0.25, 2.8, x + s * 0.12, 9.15, z));
    const bob = new THREE.Group();
    bob.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6).translate(0, -1.8, 0), cogM), new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8).scale(1, 1.3, 0.6).translate(0, -3.9, 0), cogM));
    const pv = place(bob, x + s * 0.4, 15.2, z, 0);
    const ph = z * 0.7;
    parts.push((t) => { pv.rotation.x = Math.sin(t * 1.9 + ph) * 0.28; });
  }
  // round windows high on the walls, warm light coming in
  for (const [x, z] of [[-10.9, F0 + 9], [-10.9, F0 + 24], [10.9, F0 + 9], [10.9, F0 + 24]]) {
    K.add(windowM, T(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 24).rotateZ(Math.PI / 2), [x, 21.5, z]));
    K.add(brass, T(new THREE.TorusGeometry(1.55, 0.14, 5, 28).rotateY(Math.PI / 2), [x - Math.sign(x) * 0.05, 21.5, z]));
  }
  rt.add(Clockwork, { parts });
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const brass = { paint: new THREE.Color('#d8a24a'), smooth: false, side: THREE.FrontSide };
  const cream = { paint: new THREE.Color('#f3ead8'), smooth: false, side: THREE.FrontSide };
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
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Escapement (z 12.6..48): a pit, a disc that swings across it once the eye over the far door is splashed
  K.hall({ x: 0, z: 30.3, w: 22, d: 35.4, y: -8, h: 22, floor: false, roof: 'oculus', oculus: 0.25, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4, y0: 8 }] });
  K.slab(-11, 12.6, 11, 18, 0, 8);
  K.slab(-11, 40, 11, 48, 0, 8);
  K.both(M.dark, box(22, 1, 22, 0, -8.5, 29));
  add(Pit, { room: 'esc', min: [-12, -10, 18], max: [12, -2, 40] });
  add(Platform, { path: [[0, 0, 20.4], [0, 0, 37.6]], r: 2.2, speed: 2.0, pause: 1.6, when: { open: 'discs' } });
  // the escapement's anchor overhead, and a great stopped wheel on each wall
  K.both(M.dark, T(new THREE.TorusGeometry(6, 0.5, 6, 40), [-10.4, 6, 29], [0, Math.PI / 2, 0]));
  K.both(M.dark, T(new THREE.TorusGeometry(6, 0.5, 6, 40), [10.4, 6, 29], [0, Math.PI / 2, 0]));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; for (const s of [-1, 1]) K.both(brass, T(new THREE.BoxGeometry(0.4, 1.2, 1.2), [s * 10.4, 6 + Math.cos(a) * 6.6, 29 + Math.sin(a) * 6.6], [a, 0, 0])); }
  K.both(brass, T(new THREE.BoxGeometry(14, 0.6, 0.6), [0, 12.4, 29]));
  // the dial over the far door, its one hand at eight, and three eyes round it at twelve, four and eight (as you
  // face it, a clock's way round goes right to left over the top: x = -sin)
  dial(0, 9.6, 47.7, 2.3, Math.PI, [TAU * 8 / 12, TAU * 8 / 12]);
  const tick = 'It ticks once, and goes still: the makers’ clock counts round from where its hand points, the way a clock goes.';
  for (const [id, hr] of [['s1', 8], ['s2', 12], ['s3', 4]]) { const a = TAU * hr / 12; add(Switch, { id, at: [-Math.sin(a) * 3.6, 9.6 + Math.cos(a) * 3.6, 47.4], yaw: Math.PI, size: 0.8, wrong: tick }); }
  add(Mark, { room: 'esc', at: [-6.5, 0, 15.4], yaw: Math.PI / 2 });

  // ---- the Winding Well (a rotunda): a wall to climb (its top at 9), the door at its top; the counterweight's
  // groove comes in from the Escapement's far landing to its socket at the wall's foot
  K.slab(-3.2, 48, 3.2, 50.6, 0, 0.8);
  K.wall(-3.2, 48.6, -3.2, 50.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 50.6, 3.2, 48.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 49.6));
  const C2 = 61.2;
  K.rotunda({ x: 0, z: C2, y: 0, r: 10, h: 22, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4, y0: 9 }], oculus: 0.3 });
  K.both(M.wallGlyph, box(20, 9, 7.2, 0, 4.5, C2 + 6.4));
  K.both(M.trim, box(20.2, 0.3, 7.4, 0, 9.05, C2 + 6.4));
  K.add(M.dark, box(1.0, 0.04, 21.6, 1.2, 0.02, 51.7));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.22, 0.12, 21.6, 1.2 + sd * 0.8, 0.06, 51.7));
  add(Ball, { id: 'ball1', a: [1.2, 0.04, 41.4], b: [1.2, 0.04, C2 + 1.2], r: 1.1, friction: 1.0 });
  add(Plate, { id: 'p1', at: [1.2, 0, C2 + 1.2], r: 1.3 });
  K.both(brass, box(3.2, 0.5, 0.6, 1.2, 0.25, C2 + 2.6));   // (the socket's brass stop at the wall's foot)
  add(Door, { id: 'd2', at: [0, 9, C2 + 10.3], w: 5, h: 6.4, lamps: [{ drumOn: ['ball1', 'p1'] }] });
  dial(-9.4, 14, C2, 2.6, Math.PI / 2, [TAU * 4 / 12, 0.4]);   // (stopped at four, as every clock in the house)
  add(Mark, { room: 'well', at: [-6, 0, C2 - 6], yaw: Math.PI * 0.75 });

  // ---- the corridor and the Coil Chamber (floor 9): the chest; six eyes round the far door
  K.slab(-3.2, C2 + 10, 3.2, C2 + 12.6, 9, 0.8);
  K.wall(-3.2, C2 + 10.6, -3.2, C2 + 12.6, 9, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.6, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 15.8, C2 + 11.6));
  const C3 = C2 + 22.6;
  K.rotunda({ x: 0, z: C3, y: 9, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 9, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 9.31, C3));
  // copper coils round the walls, warm
  const copper = { paint: new THREE.Color('#d9643a'), smooth: false, side: THREE.FrontSide };
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.add(copper, T(new THREE.TorusGeometry(0.9, 0.18, 6, 18), [s * 8.6, 11 + i * 0.6, C3 + 2], [0, Math.PI / 2, 0]));
  add(Mark, { room: 'coil', at: [6, 9, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Winding Passage (floor 9), a room on: six eyes round the door into the gallery
  const A0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, A0 + 0.6, 9, 0.8);
  K.hall({ x: 0, z: A0 + 6, w: 12, d: 12, y: 9, h: 10, roof: true, omit: ['n'], doors: [{ side: 's', w: 5, h: 6.4 }] });
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) K.add(copper, T(new THREE.TorusGeometry(0.7, 0.14, 6, 16), [s * 5.6, 10.4 + i * 0.5, A0 + 4], [0, Math.PI / 2, 0]));
  const F0 = A0 + 12 + 1.2;
  add(Door, { id: 'd3', at: [0, 9, F0 - 0.6], w: 5, h: 6.4, lamps: [{ lit: 'k1' }] });
  add(Bank, { id: 'k1', eyes: [[-3.6, 10.6], [-3.6, 13.6], [3.6, 10.6], [3.6, 13.6], [-1.5, 16.6], [1.5, 16.6]].map(([x, y]) => ({ at: [x, y, F0 - 1.5], yaw: Math.PI })), window: VOLLEY,
    full: 'All six woke, and went dark again: the bank wants two tanks inside one breath, and this one fills too slowly.',
    fade: 'They woke, and went dark again before the rest. Six eyes, one breath: more than one tank can do.' });

  // ---- the Clock Gallery: a chasm, a bridge a second bank of six raises (round a stopped clock face on the far wall)
  K.slab(-3.2, F0 - 1.6, 3.2, F0 + 0.6, 9, 0.8);
  K.hall({ x: 0, z: F0 + 17.2, w: 22, d: 34.4, y: -6, h: 32, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 15 }, { side: 'n', w: 5, h: 6.4, y0: 15 }] });
  K.slab(-11, F0, 11, F0 + 6, 9, 15);
  K.slab(-11, F0 + 26, 11, F0 + 34.4, 9, 15);
  K.both(M.dark, box(22, 1, 20, 0, -6.4, F0 + 16));
  add(Pit, { room: 'gallery', min: [-12, -8, F0 + 6], max: [12, 4, F0 + 26] });
  add(Bridge, { id: 'br1', a: [0, 9, F0 + 5.9], b: [0, 9, F0 + 26.1], w: 4, n: 8 });
  // the great clock face, its hands gone; six eyes round it (ring6 goes round toward +x: as you face it, that is
  // twelve, ten, eight, six, four, two), to wake in turn from four: four, six, eight, ten, twelve, two
  dial(0, 20.6, F0 + 34.1, 3.8, Math.PI, null);
  K.both(brass, T(new THREE.TorusGeometry(6.3, 0.22, 6, 48), [0, 20.6, F0 + 34.0], [0, Math.PI, 0]));
  K.add(M.glyph, T(glyphGeometry(2.6, 0.12), [0, 27.2, F0 + 34.2], [0, Math.PI, 0]));
  add(Bank, { id: 'k2', eyes: ring6(0, 20.6, F0 + 33.6, 4.9, Math.PI), size: 1.0, window: VOLLEY, order: [4, 3, 2, 1, 0, 5],
    full: 'All six woke round the clock, and went dark again: the bank wants two tanks inside one breath, and this one fills too slowly.',
    fade: 'They woke round the clock, and went dark again before the rest.',
    wrong: 'The eyes ring out of step and all go dark. The great clock has lost its hands: count round from the hour every clock in this house stopped at.' });
  dial(0, 18.9, F0 + 0.3, 1.3, 0, [TAU * 4 / 12, 0.4]);   // the little clock over the way in, behind you: stopped at four
  galleryClockwork(rt, K, F0, brass);
  add(Door, { id: 'd4', at: [0, 9, F0 + 35], w: 5, h: 6.4 });
  add(Mark, { room: 'gallery', at: [-7, 9, F0 + 3], yaw: 0 });

  // ---- the corridor and the Foreman's Workshop (floor 9)
  const H0 = F0 + 35;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 9, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 9, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 9, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 16.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 9, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CW = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CW, y: 9, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  // a great dial inlaid in the floor, a gear's teeth round it, a pendulum's rod down from the oculus
  K.both(cream, T(annulus(8.2, 9.2, 0.25, 64), [0, 9.25, CW]));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.both(M.dark, T(new THREE.BoxGeometry(0.35, 0.06, 1.4), [Math.sin(a) * 7.4, 9.03, CW + Math.cos(a) * 7.4], [0, a, 0])); }
  K.add(brass, T(annulus(12.0, 12.8, 0.08, 72), [0, 9.06, CW]));
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; K.add(brass, T(new THREE.BoxGeometry(0.7, 0.08, 0.7), [Math.sin(a) * 13.1, 9.04, CW + Math.cos(a) * 13.1], [0, a, 0])); }
  for (const a of [0.9, 2.2, 4.0, 5.3]) dial(Math.sin(a) * (HR - 0.2), 21, CW + Math.cos(a) * (HR - 0.2), 2.4, a + Math.PI, [a * 2, a * 5]);
  add(Door, { id: 'd5', at: [0, 9, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 9, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 9, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 9, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 9, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 16.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 9, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.1, 0, 11.5, CW + HR + 10.5));

  const model = foremanModel();
  model.pos.copy(K.world(0, 9, CW + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 9, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CW), r: HR, y: K.world(0, 9, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -12, -3), V(24, 40, CW + HR + 12)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 6, 22, 16], [0, 6, 40, 14], [0, 12, C2, 16], [0, 14, C3, 16], [0, 14, F0 + 16, 22], [0, 16, F0 + 30, 16], [0, 16, CW, 30]],
    guardian: { def: { ...FOREMAN, onHit: foremanHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the First Garage on the rim
/** The plateau's cliff along `dir` at height y (its jitter makes the rim wander): the radius where the rock is. */
function cliffAt(scene, dir, y) {
  const rock = scene.children.find((o) => o.isMesh && o.geometry?.parameters?.radiusTop === 210);
  if (!rock) return 210;
  const ray = new THREE.Raycaster(V(dir.x * 400, y, dir.z * 400), V(-dir.x, 0, -dir.z), 0, 400);
  const hit = ray.intersectObject(rock, false)[0];
  return hit ? Math.hypot(hit.point.x, hit.point.z) : 210;
}

function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 7, sill = 0.4;
  const K = new TempleKit(rt.root, 'The First Garage', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M;
  const brass = { paint: new THREE.Color('#d8a24a'), smooth: false, side: THREE.FrontSide };
  const teal = { paint: new THREE.Color('#62c3c9'), smooth: true, side: THREE.FrontSide };
  const tin = { paint: new THREE.Color('#62c3c9'), smooth: false, side: THREE.DoubleSide };
  const cream = { paint: new THREE.Color('#f3ead8'), smooth: false, side: THREE.FrontSide };
  // a broad flagged apron round it, a round stair-house of pale stone, bands of brass, a teal cap
  K.both(M.floor, new THREE.CylinderGeometry(R + 5, R + 5, 1.0, 32).translate(0, sill - 0.5, 0));
  K.both(M.wall, new THREE.CylinderGeometry(R, R + 0.4, 15, 28).translate(0, sill + 7.5, 0));
  for (const y of [5, 10.5]) K.both(brass, new THREE.CylinderGeometry(R + 0.2, R + 0.2, 0.6, 28).translate(0, sill + y, 0));
  K.both(teal, new THREE.SphereGeometry(R + 0.3, 28, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, sill + 15, 0));
  K.both(brass, new THREE.CylinderGeometry(0.4, 0.6, 3.2, 8).translate(0, sill + 19.4, 0));
  for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue; K.add(M.glyph, T(glyphGeometry(1.4, 0.12), [Math.sin(a) * (R + 0.42), sill + 13, Math.cos(a) * (R + 0.42)], [0, a, 0])); }
  // the great clock over the door: a cream dial in a brass ring, twelve ticks, two hands (the change turns them)
  const cy = sill + 11.4, cz = R + 0.55, cr = 2.6;
  K.both(cream, T(new THREE.CylinderGeometry(cr, cr, 0.3, 40).rotateX(Math.PI / 2), [0, cy, cz]));
  K.both(brass, T(new THREE.TorusGeometry(cr + 0.1, 0.28, 6, 40), [0, cy, cz + 0.1]));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.both(M.dark, T(new THREE.BoxGeometry(0.2, 0.5, 0.1).translate(0, cr * 0.8, 0).rotateZ(-a), [0, cy, cz + 0.2])); }
  // the doorway: a porch of two pillars and a lintel, the glyph over it (the stone the Major copied)
  const z0 = R - 1.2, z1 = R + 2.6;
  for (const s of [-1, 1]) K.both(M.wall, box(2.4, 8, z1 - z0, s * 3.6, sill + 4, (z0 + z1) / 2));
  K.both(M.wall, box(9.6, 1.6, z1 - z0, 0, sill + 7.6, (z0 + z1) / 2));
  K.add(M.glyph, T(glyphGeometry(2.0, 0.14), [0, sill + 7.6, z1 + 0.06]));
  // the arched doorway of its reference: a round arch of pale stone ringed in brass over the dark
  K.both(M.wall, T(new THREE.TorusGeometry(2.75, 0.35, 6, 24, Math.PI), [0, sill + 4.2, z1 - 0.2]));
  K.add(brass, T(new THREE.TorusGeometry(2.4, 0.12, 5, 24, Math.PI), [0, sill + 4.2, z1 + 0.18]));
  // and round the great clock, a second ring of brass and four bosses (the clock's frame, as drawn)
  K.add(brass, T(new THREE.TorusGeometry(cr + 0.7, 0.12, 5, 40), [0, cy, cz + 0.05]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; K.add(brass, T(new THREE.SphereGeometry(0.28, 8, 6), [Math.sin(a) * (cr + 0.7), cy + Math.cos(a) * (cr + 0.7), cz + 0.15])); }
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.8, 6.8).translate(0, 3.4, 0), [0, sill, R + 0.25]));
  K.solid(box(4.8, 6.8, 0.1, 0, sill + 3.4, R + 0.25));
  // the Major's lean-to against the drum: a tin roof on posts, a bench, a painted board (his first garage)
  const sx = -(R + 3.4), sz = 1.4;
  for (const [x, z] of [[sx - 2.4, sz - 2.6], [sx - 2.4, sz + 2.6]]) K.both(M.trim, box(0.3, 3.6, 0.3, x, sill + 1.8, z));
  K.add(tin, T(new THREE.BoxGeometry(5.6, 0.12, 6.4), [sx, sill + 3.8, sz], [0, 0, -0.18]));
  K.both({ paint: new THREE.Color('#8a5a3a'), smooth: false, side: THREE.FrontSide }, box(3.2, 0.16, 1.1, sx + 0.4, sill + 1.0, sz - 1.8));
  K.add({ paint: new THREE.Color('#e88fa6'), smooth: false, side: THREE.FrontSide }, box(2.6, 1.0, 0.1, sx, sill + 3.1, sz + 3.25));
  K.add(cream, box(2.0, 0.18, 0.12, sx, sill + 3.2, sz + 3.32)); K.add(cream, box(1.4, 0.18, 0.12, sx - 0.2, sill + 2.9, sz + 3.32));
  K.flush();

  // the makers' clockwork in the cliff below: great cogs half out of the rock, facing out (they turn after)
  const dir = V(Math.sin(Math.atan2(SITE.x, SITE.z)), 0, Math.cos(Math.atan2(SITE.x, SITE.z)));
  const side = V(dir.z, 0, -dir.x);
  const cogM = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass', key: 'temple.garage.cogs' });
  const lampM = makeMaterial({ color: '#f2c54b', glow: 0.05, flat: true, key: 'temple.garage.lamps' });
  const cogs = [];
  for (const [i, [off, y, r]] of [[-14, -14, 9], [2, -24, 12], [15, -11, 7], [-4, -40, 8]].entries()) {
    const c = cliffAt(scene, dir, y) + 1.0;
    const g = new THREE.Group();
    g.position.copy(dir).multiplyScalar(c).addScaledVector(side, off).setY(y);
    g.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
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
  const handsM = makeMaterial({ color: '#34405e', flat: true, key: 'temple.garage.hands' });
  const hands = new THREE.Group();
  hands.position.copy(K.world(0, cy, cz + 0.35));
  hands.rotation.y = yaw;
  const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.5, 0.12).translate(0, 0.65, 0), handsM);
  const minH = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.12).translate(0, 1.0, 0.08), handsM);
  hands.add(hourH, minH);
  hands.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  rt.root.add(hands);
  const at = K.world(0, sill, R + 1.4);
  const front = K.world(0, sill, R + 9);
  return { door: { at, heading: yaw }, kit: K, R, sill, cogs, hands, hourH, minH, lampM, clear: [{ x: SITE.x, z: SITE.z, r: R + 7 }, { x: front.x, z: front.z, r: 6 }] };
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

// ------------------------------------------------------------------ the world change: the Hangar keeps time again
/**
 * Once the Foreman is set right, the First Garage's clock keeps the true time (until then its hands stutter
 * back and forth, stuck where they jumped the night the light passed), the makers' cogs in the cliff turn in
 * step, their hub lamps lit, and a pendulum swings in the porch.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The First Garage keeps time (the world change)';
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
  id: 'garage', levelId: 'garage', name: 'The First Garage', doorLabel: 'door of the First Garage',
  gadget: 'coil', gadgetBox: 'garage.temple.coil', arenaDoor: 'd4',
  origin: [-300, 1800, -420], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'wim', out: 7, side: 6 },
  enterLine: 'Inside the First Garage everything ticks, but out of step, like a room full of clocks that have quarrelled.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out on the rim, the clock over the First Garage’s door has begun to keep time.', 'resolved.out'); },
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
          rt.notice('The numerals ring out of step and all go dark. Its hands point at four: count round from there, the way a clock goes.', 'cf.wrong');
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
        if (inStep && phase === 1) rt.notice('All six in step, round from four: its hands catch, and for a moment it keeps time.', 'cf.step');
        rt.notice('All six numerals at once: its hands stagger, and slow.', `cf.volley.${phase}`);
        G.add(0.25, 'volley');
        rt.rumble(0.6, 0.45);
        if (G.state === 'open') { G.enter('fight'); G.cool = 1.6; }
      } else if (lit === 3 && !rt.logic.has('coil')) rt.notice('Three numerals, and the tank is dry. It would take a tank that fills again faster.', 'cf.three');
    };
    for (let i = 0; i < N; i++) {
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.6, position: () => G.model.vent(i, at[i]), enabled: () => G.state === 'open', onHit: (mode) => { if (mode !== 'push') rt.volley(i); return true; } }));
    }
  },
};
