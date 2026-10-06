import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bank, Platform, Bridge, Mark, Pit } from './pieces.js';
import { sentinelModel } from './guardians.js';

// The Buried Machine's temple: the Engine-House, a drum of rust-red iron as
// tall as the oculus, standing out of the dunes west of the domes, pipe
// elbows round its foot and a ring window high up. The dome people say the
// wheel's engine is in there, and the Tooth-Warden that minds it: it has been
// jamming the engine since the night the sky rang, which is why the wheel
// turns one tooth a year and no more. It is a machine: you may stop it.
//
// Inside (built far overhead, through its oval door):
//   the Threshold          the first mark, the way out
//   the Piston Hall        pistons that rise and fall out of step, still until you open the valve (an eye):
//                          ride them up to the gantry
//   the Counterweight      a stone ball in a groove onto its plate: the door
//   the Fourth Chamber     the makers' chest: the FOURTH CHAMBER (src/items.js 'cell'). The door on is
//                          ringed by four eyes that wake only together, inside one breath: four shots, and
//                          the tank only holds three without it
//   the Furnace            a chasm under a bridge that a second bank of four raises
//   the Tooth-Warden's Hall the guardian (a robot: its meter is damage). When its four vents open, hit all
//                          four inside a breath
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

export const LOGIC = {
  id: 'buried', entry: 'threshold', gadget: 'cell',
  rooms: { threshold: { checkpoint: true }, pistons: { checkpoint: true }, weight: { checkpoint: true }, cell: { checkpoint: true }, furnace: { checkpoint: true }, furnaceFar: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'pistons' },
    { a: 'pistons', b: 'weight', door: 'pumps' },   // the pistons, once the valve is open
    { a: 'weight', b: 'cell', door: 'd2' },
    { a: 'cell', b: 'furnace', door: 'd3' },
    { a: 'furnace', b: 'furnaceFar', door: 'br1' },
    { a: 'furnaceFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'pistons' },
    pumps: { type: 'bridge', opens: { lit: 's1' }, latch: true },
    ball1: { type: 'drum', room: 'weight', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'weight' },
    d2: { type: 'door', opens: { pressed: 'p1' }, latch: true },
    chest: { type: 'gadget', room: 'cell', item: 'cell' },
    k1: { type: 'switch', room: 'cell', needs: ['cell'] },        // four eyes in one breath
    d3: { type: 'door', opens: { lit: 'k1' }, latch: true },
    k2: { type: 'switch', room: 'furnace', needs: ['cell'] },
    br1: { type: 'bridge', opens: { lit: 'k2' }, latch: true },
    d4: { type: 'door', opens: null },                            // the arena's door: shut while the warden fights
    warden: { type: 'boss', room: 'hall', needs: ['backpack', 'cell'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const TOOTH_WARDEN = {
  kind: 'robot', name: 'the Tooth-Warden', final: 'break', speed: 1.6, wakeTime: 2.8,
  wake: 'The machine in the hall straightens on its four legs with a noise like a dropped toolbox. Its lamp turns to you.',
  openHint: 'All four of its vents open at once, glowing. Hit all four, quickly.',
  resolved: 'The Tooth-Warden locks up, every joint at once, and goes still. Somewhere under your feet the engine catches, and runs.',
  phases: [
    { to: 0.5, attacks: ['beam', 'mortar'], pause: 1.6, hint: 'When its four vents open, hit all four inside one breath.' },
    { to: 1.0, attacks: ['slam', 'beam', 'mortar'], pause: 1.2, hint: 'It is faster now, and it slams. Four vents, one breath.' },
  ],
  attacks: {
    beam: { shape: 'lane', range: 28, width: 2.6, telegraph: 1.5, damage: 0.22, knock: 10, recover: 0.8, open: 3.2 },
    mortar: { shape: 'ring', at: 'player', radius: 3.6, telegraph: 1.6, track: 0.6, damage: 0.2, knock: 8, recover: 0.6 },
    slam: { shape: 'ring', at: 'self', radius: 8.5, telegraph: 1.4, damage: 0.25, knock: 13, recover: 1.0, open: 3.0 },
  },
};
const VOLLEY = 2.6;   // s: the four vents must all be hit inside this

function wardenHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its hull.', 'tw.push'); return true; }
  if (g.state !== 'open') g.rt.notice('Its vents are shut. Wait for them to open.', 'tw.shut');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 16, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Piston Hall (z 12.6..44): pistons that rise and fall out of step to the gantry (top at 7)
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 16, roof: 'oculus', oculus: 0.22, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4, y0: 7 }] });
  K.both(M.wallGlyph, box(22, 7, 6, 0, 3.5, 41));                     // the gantry (you could climb its face too; the pistons are the makers' way)
  K.both(M.trim, box(22.2, 0.3, 6.2, 0, 7.05, 41));
  // big pipes along the walls, and gauges
  for (const s of [-1, 1]) {
    K.both(M.stone, T(new THREE.CylinderGeometry(0.9, 0.9, 30, 14), [s * 10.2, 3, 28], [Math.PI / 2, 0, 0]));
    K.both(M.stone, T(new THREE.CylinderGeometry(0.6, 0.6, 30, 12), [s * 10.4, 5.4, 28], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) K.both(M.trim, T(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), [s * 10.95, 7.5, 18 + i * 8], [0, 0, Math.PI / 2]));
  }
  // three pistons in a row toward the gantry, each a riding disc that rises and falls, out of step
  add(Platform, { path: [[0, 0.3, 27.4], [0, 2.6, 27.4]], r: 2, speed: 1.1, pause: 1.2, when: { lit: 's1' } });
  add(Platform, { path: [[0, 2.4, 31.6], [0, 4.7, 31.6]], r: 2, speed: 1.1, pause: 1.2, phase: 1, when: { lit: 's1' } });
  add(Platform, { path: [[0, 4.9, 35.8], [0, 7.2, 35.8]], r: 2, speed: 1.1, pause: 1.2, when: { lit: 's1' } });
  for (const z of [27.4, 31.6, 35.8]) K.both(M.dark, T(new THREE.CylinderGeometry(1.2, 1.4, 0.1, 18), [0, 0.05, z]));
  add(Switch, { id: 's1', at: [-6, 3.2, 12.0], yaw: 0, size: 1.0 });   // the valve's eye, high on the south wall by the way in
  add(Mark, { room: 'pistons', at: [-6.5, 0, 16], yaw: Math.PI / 2 });

  // ---- the Counterweight (a short hall on the gantry's level, floor 7)
  K.slab(-3.2, 44, 3.2, 46.6, 7, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.6, 7, 6.4, { t: 0.8 }); K.wall(3.2, 46.6, 3.2, 44.6, 7, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 13.8, 45.6));
  K.hall({ x: 0, z: 54.6, w: 16, d: 16, y: 7, h: 10, roof: true, doors: [{ side: 's', w: 5, h: 6.4 }, { side: 'n', w: 5, h: 6.4 }] });
  K.add(M.dark, box(1.0, 0.04, 12, -4, 7.02, 54.6));
  add(Ball, { id: 'ball1', a: [-4, 7.04, 49.8], b: [-4, 7.04, 60.4], r: 1.1 });
  add(Plate, { id: 'p1', at: [-4, 7, 60.4], r: 1.3 });
  add(Door, { id: 'd2', at: [0, 7, 63.2], w: 5, h: 6.4, lamps: [{ pressed: 'p1' }] });
  add(Mark, { room: 'weight', at: [5, 7, 49.5], yaw: -Math.PI / 2 });

  // ---- the Fourth Chamber (a rotunda, floor 7): the chest; four eyes round the far door
  K.slab(-3.2, 63, 3.2, 65.6, 7, 0.8);
  const C3 = 75.2;
  K.rotunda({ x: 0, z: C3, y: 7, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 7, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 7.31, C3));
  add(Door, { id: 'd3', at: [0, 7, C3 + 10.2], w: 5, h: 6.4, lamps: [{ lit: 'k1' }] });
  add(Bank, { id: 'k1', eyes: [[-3.4, 9.2], [-3.4, 12.6], [3.4, 9.2], [3.4, 12.6]].map(([x, y]) => ({ at: [x, y, C3 + 9.3], yaw: Math.PI })), window: VOLLEY });
  add(Mark, { room: 'cell', at: [6, 7, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Furnace (z 86..120): a chasm, a bridge a second bank raises, embers far below
  const F0 = C3 + 10.9;
  K.slab(-3.2, C3 + 10.1, 3.2, F0 + 0.6, 7, 0.8);
  K.hall({ x: 0, z: F0 + 17.2, w: 22, d: 34.4, y: -5, h: 24, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 12 }, { side: 'n', w: 5, h: 6.4, y0: 12 }] });
  K.slab(-11, F0, 11, F0 + 6, 7, 12);
  K.slab(-11, F0 + 26, 11, F0 + 34.4, 7, 12);
  const ember = makeMaterial({ color: '#e0644a', glow: 0.55, flat: true, key: 'temple.buried.embers' });
  K.both(ember, box(22, 0.4, 20, 0, -4.6, F0 + 16));
  K.both(M.dark, box(22, 1, 20, 0, -5.4, F0 + 16));
  add(Pit, { room: 'furnace', min: [-12, -8, F0 + 6], max: [12, 2, F0 + 26] });
  add(Bridge, { id: 'br1', a: [0, 7, F0 + 5.9], b: [0, 7, F0 + 26.1], w: 4, n: 8 });
  add(Bank, { id: 'k2', eyes: [[-7, 10], [-2.4, 13], [2.4, 13], [7, 10]].map(([x, y]) => ({ at: [x, y, F0 + 34.0], yaw: Math.PI })), window: VOLLEY });
  add(Door, { id: 'd4', at: [0, 7, F0 + 35], w: 5, h: 6.4 });
  add(Mark, { room: 'furnace', at: [-7, 7, F0 + 3], yaw: 0 });

  // ---- the corridor and the Tooth-Warden's hall (floor 7)
  const H0 = F0 + 35;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 7, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 7, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 7, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 14.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 7, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CW = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CW, y: 7, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  // the engine's great shaft through the middle of the hall's roof, a gear on the floor
  K.both(M.stone, T(new THREE.CylinderGeometry(1.4, 1.4, 14, 16), [0, 7 + 26 - 7, CW]));
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; K.both(M.dark, T(new THREE.BoxGeometry(1.2, 0.25, 1.6), [Math.sin(a) * 9.6, 7.12, CW + Math.cos(a) * 9.6], [0, a, 0])); }
  K.both(M.dark, T(annulus(8.2, 9.2, 0.25, 64), [0, 7.25, CW]));
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
    guardian: { def: { ...TOOTH_WARDEN, onHit: wardenHit }, model, arena },
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
  // the warden's four vents: each a target while they are open; all four inside a breath is a hit
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const hits = [-1e9, -1e9, -1e9, -1e9], at = [V(), V(), V(), V()];
    rt.volley = (i) => {
      const clock = rt.time;
      if (G.state !== 'open') { rt.notice('Its vents are shut. Wait for them to open.', 'tw.shut'); return; }
      hits[i] = clock;
      rt.sound?.critter?.('clank', 0.9);
      if (hits.every((h) => clock - h <= VOLLEY)) {
        hits.fill(-1e9);
        G.add(0.25, 'volley');
        rt.rumble(0.6, 0.45);
        if (G.state === 'open') { G.enter('fight'); G.cool = 1.6; }
      } else if (hits.filter((h) => clock - h <= VOLLEY).length === 3 && !rt.logic.has('cell')) rt.notice('Three vents, and the tank is dry. A fourth shot would need a fourth chamber.', 'tw.three');
    };
    for (let i = 0; i < 4; i++) {
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.9, position: () => G.model.vent(i, at[i]), enabled: () => G.state === 'open', onHit: (mode) => { if (mode !== 'push') rt.volley(i); return true; } }));
    }
  },
};
