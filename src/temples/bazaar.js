import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, EchoStone, EchoEar, NOTES, Mark, Pit } from './pieces.js';
import { signModel } from './guardians.js';

// The Signal Market's temple: the Undertower, the foundations of the silent
// tower, "here before the market". The makers built the first sign of all
// here: a machine to say one line into the dark, over and over, for whoever
// was listening. The market grew up round it and built its towers on top, and
// forgot it; only the silent tower stands right over it. The night the sky
// rang it stuck on one word of its line, and has said nothing else since:
// under the square at night you can hear it, if you put your ear to the stones.
//
// Inside (built far overhead, through the old doorway in the tower's back):
//   the Threshold        the first mark, the way out
//   the Hall of Dishes   a stone ball in a groove onto its plate; then a disc carries you over the cable pit
//   the Cable Well       two discs that ride up, a ledge between them
//   the Shell Chamber    the makers' chest: the ECHO SHELL (src/items.js 'echo', src/echo-shell.js). The door
//                        on listens for the low stone's note, played back close by: only the shell carries it
//   the Gallery of Voices a chasm: a horn at its edge raises the bridge for the high stone's note; the far door
//                        wants the middle one, whose stone is on this side (the shell holds one note at a time)
//   the First Sign's Hall the guardian (a robot: its meter is damage, which here is retuning). It cries its
//                        one word; when it lowers its dish to listen, play its word back into it, and it moves on
//                        to the next word of its line
// After: the silent tower speaks, once a night, the whole line, in the First Sign's voice (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The old doorway in the silent tower's back (the side away from the square's front), looking south down the avenue's end. */
export const SITE = { x: 0, z: -267, r: 8, heading: Math.PI, tower: { x: 0, z: -255, top: 98 } };

export const PALETTE = {
  wall: '#7d8f96', wall2: '#6f8189', wall3: '#8fa1a6', floor: '#c9b28a', floor2: '#b9a27a', trim: '#c99758', strata: 1.8,
  dark: '#3a535b', stone: '#88b4b5', accent: '#f0a083', glow: '#fff0bd', lamp: '#ffe3aa', sand: '#a4c1be', sand2: '#94b1ae', void: '#243e59',
};

/** The First Sign's line, a word (or two) at a time; each is a note of its own (the echo shell keeps one). */
export const LINE = ['SOMEBODY', 'OUT THERE', 'IS TALKING', 'TO YOU'];
const WORD_DEGREES = [1, 3, 5, 6];
const LISTEN = 14;   // m: how close to its dish a played-back word has to be

export const LOGIC = {
  id: 'bazaar', entry: 'threshold', gadget: 'echo',
  rooms: { threshold: { checkpoint: true }, dishes: { checkpoint: true }, dishesFar: {}, well: { checkpoint: true }, shell: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: { checkpoint: true }, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'dishes' },
    { a: 'dishes', b: 'dishesFar', door: 'disc' },    // the disc over the cable pit, once the ball holds its plate
    { a: 'dishesFar', b: 'well' },
    { a: 'well', b: 'shell' },
    { a: 'shell', b: 'gallery', door: 'd3' },
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'galleryFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    ball1: { type: 'drum', room: 'dishes', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'dishes' },
    disc: { type: 'bridge', opens: { drumOn: ['ball1', 'p1'] }, latch: true },
    chest: { type: 'gadget', room: 'shell', item: 'echo' },
    e0: { type: 'switch', room: 'shell', needs: ['echo'] },          // the low note, played back by the door
    d3: { type: 'door', opens: { lit: 'e0' }, latch: true },
    e1: { type: 'switch', room: 'gallery', needs: ['echo'] },        // the high note, by the chasm's edge
    br1: { type: 'bridge', opens: { lit: 'e1' }, latch: true },
    e2: { type: 'switch', room: 'galleryFar', needs: ['echo'] },     // the middle note, by the far door
    d4: { type: 'door', opens: { lit: 'e2' }, latch: true },          // (the arena's door too: it shuts behind you)
    sign: { type: 'boss', room: 'hall', needs: ['backpack', 'echo'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const FIRST_SIGN = {
  kind: 'robot', name: 'the First Sign', final: 'break', speed: 1.4, wakeTime: 3.0,
  wake: 'At the heart of the Undertower a mast of the makers lifts its great dish off the floor, turns it to you, and cries one word, so loud the stones hum.',
  openHint: 'It lowers its dish to you and goes still, listening. It is waiting to hear its word.',
  resolved: 'The First Sign takes its whole line back, word by word, and says it once, quietly, to nobody in particular. Then it turns its dish up to the dark, and listens.',
  phases: [
    { to: 0.5, attacks: ['cry', 'beam', 'static'], pause: 1.6, hint: 'When it lowers its dish to listen, play its word back into it.' },
    { to: 0.75, attacks: ['beam', 'stutter', 'static'], pause: 1.2, hint: 'It has a new word now, and it stutters on it before it cries. Catch it, and give it back.' },
    { to: 1.0, attacks: ['statics', 'stutter', 'beam'], pause: 1.0, hint: 'Its lamps flicker and its dish sweeps the hall. Catch its word, and give it back.' },
  ],
  attacks: {
    cry: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'lean', wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'mouth', damage: 0.75, knock: 10, recover: 0.6, then: 'sweep' },
    sweep: { shape: 'cone', range: 22, angle: 0.8, wind: 1.0, track: 0.5, part: 'mouth', rig: 'coil', pose: 'beam', side: 1, link: true, damage: 0.75, knock: 10, recover: 0.8 },
    static: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.75, knock: 8, recover: 0.6 },
    statics: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.5, knock: 6, recover: 0.6 },
    stutter: { shape: 'ring', at: 'self', radius: 5.5, wind: 1.0, part: 'mouth', rig: 'swell', pose: 'cry', damage: 0.5, knock: 9, recover: 0.4, then: 'stutter2' },
    stutter2: { shape: 'ring', at: 'self', radius: 5.5, wind: 0.65, part: 'mouth', rig: 'swell', pose: 'cry', link: true, damage: 0.5, knock: 9, gap: 0.25, then: 'cryEnd' },
    cryEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'lean', pose: 'cry', link: true, wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
  },
};

function signHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its mast.', 'fs.push'); return true; }
  g.rt.notice('The fluid rattles off its dish. It is not listening for water: it is listening for its word.', 'fs.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const brass = { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const cream = { paint: new THREE.Color('#f5dfab'), smooth: true, side: THREE.DoubleSide };
  /** An old receiving dish on a wall, facing `yaw` (0 = +z). */
  const dish = (x, y, z, r, yaw, tilt = 0) => {
    const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * r; prof.push([Math.max(0.01, q), (q * q) / (4 * r * 0.7)]); }
    K.add(cream, T(lathe(prof, 20).rotateX(-Math.PI / 2), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
    K.add(brass, T(new THREE.TorusGeometry(r, 0.12, 4, 28).translate(0, 0, r * r / (4 * r * 0.7)), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
    K.add(M.dark, T(new THREE.ConeGeometry(0.25, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, r * 0.6), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
  };
  /** A run of old cable along the floor (from a to b, sagging a little). */
  const cable = (a, b, r = 0.18) => { const m = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) + 0.05, (a[2] + b[2]) / 2]; K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(...a), V(...m), V(...b)]), 16, r, 5)); };

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  cable([-6.4, 0.2, 1], [-5, 0.2, 12]); cable([6.2, 0.2, 2], [4.6, 0.2, 12.4], 0.24);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Hall of Dishes (z 12.6..48): the ball onto its plate on the near landing; a disc over the cable pit
  K.hall({ x: 0, z: 30.3, w: 22, d: 35.4, y: -8, h: 22, floor: false, roof: 'oculus', oculus: 0.25, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4, y0: 8 }] });
  K.slab(-11, 12.6, 11, 24, 0, 8);
  K.slab(-11, 40, 11, 48, 0, 8);
  K.both(M.dark, box(22, 1, 18, 0, -8.5, 32));
  for (let i = 0; i < 9; i++) cable([-10 + i * 2.4, -7.9, 25], [-9 + i * 2.2, -7.9, 39], 0.3);   // the pit full of the makers' old cable
  add(Pit, { room: 'dishes', min: [-12, -10, 24], max: [12, -2, 40] });
  K.add(M.dark, box(14.6, 0.04, 1.0, -1, 0.02, 18));
  add(Ball, { id: 'ball1', a: [-8, 0.04, 18], b: [6, 0.04, 18], r: 1.1 });
  add(Plate, { id: 'p1', at: [6, 0, 18], r: 1.3 });
  add(Platform, { path: [[0, 0, 26.2], [0, 0, 37.8]], r: 2.2, speed: 2.0, pause: 1.6, when: { drumOn: ['ball1', 'p1'] } });
  for (const [x, z, yaw] of [[-10.4, 20, Math.PI / 2], [10.4, 30, -Math.PI / 2], [-10.4, 40, Math.PI / 2]]) dish(x, 8, z, 2.6, yaw);
  add(Mark, { room: 'dishes', at: [-8.5, 0, 14.4], yaw: Math.PI / 2 });

  // ---- the Cable Well (a rotunda): a disc up to a ledge at 6, a second up to the landing at 12
  K.slab(-3.2, 48, 3.2, 50.6, 0, 0.8);
  K.wall(-3.2, 48.6, -3.2, 50.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 50.6, 3.2, 48.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 49.6));
  const C2 = 61.2;
  K.rotunda({ x: 0, z: C2, y: 0, r: 10, h: 26, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4, y0: 12 }], oculus: 0.3 });
  add(Platform, { path: [[-5, 0, C2 - 1], [-5, 6, C2 - 1]], r: 2.2, speed: 1.4, pause: 1.6 });
  K.slab(-9, C2 + 1.4, 1, C2 + 5.4, 6, 1.0);
  add(Platform, { path: [[3.4, 6, C2 + 3.4], [3.4, 12, C2 + 3.4]], r: 2.2, speed: 1.4, pause: 1.6, phase: 0.5 });
  K.slab(-3.2, C2 + 5.8, 6, C2 + 10.6, 12, 1.0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; cable([Math.sin(a) * 9.6, 24, C2 + Math.cos(a) * 9.6], [Math.sin(a) * 9.4, 0.2, C2 + Math.cos(a) * 9.4], 0.22); }
  add(Mark, { room: 'well', at: [-6, 0, C2 - 6.5], yaw: Math.PI * 0.75 });

  // ---- the corridor and the Shell Chamber (floor 12): the chest; the low stone; the door listens for its note
  K.slab(-3.2, C2 + 10, 3.2, C2 + 12.6, 12, 0.8);
  K.wall(-3.2, C2 + 10.6, -3.2, C2 + 12.6, 12, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.6, 12, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 18.8, C2 + 11.6));
  const C3 = C2 + 22.6;
  K.rotunda({ x: 0, z: C3, y: 12, r: 9.5, h: 14, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 12, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 12.31, C3));
  add(EchoStone, { note: 'low', at: [-6.6, 12, C3 - 4.6], yaw: Math.PI * 0.25 });
  add(Door, { id: 'd3', at: [0, 12, C3 + 10.2], w: 5, h: 6.4, lamps: [{ lit: 'e0' }] });
  add(EchoEar, { id: 'e0', note: 'low', at: [3.7, 12, C3 + 8.0], yaw: Math.PI });
  add(Mark, { room: 'shell', at: [6, 12, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Gallery of Voices: a chasm; the high stone's note raises the bridge; the far door wants the middle one
  const G0 = C3 + 10.9;
  K.slab(-3.2, C3 + 10.1, 3.2, G0 + 0.6, 12, 0.8);
  K.hall({ x: 0, z: G0 + 18.3, w: 22, d: 36.6, y: -6, h: 30, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 18 }, { side: 'n', w: 5, h: 6.4, y0: 18 }] });
  K.slab(-11, G0, 11, G0 + 8, 12, 18);
  K.slab(-11, G0 + 28, 11, G0 + 36.6, 12, 18);
  K.both(M.dark, box(22, 1, 20, 0, -6.4, G0 + 18));
  add(Pit, { room: 'gallery', min: [-12, -8, G0 + 8], max: [12, 8, G0 + 28] });
  add(Bridge, { id: 'br1', a: [0, 12, G0 + 7.9], b: [0, 12, G0 + 28.1], w: 4, n: 8 });
  add(EchoStone, { note: 'high', at: [-8, 12, G0 + 2.6], yaw: Math.PI / 2 });
  add(EchoStone, { note: 'mid', at: [8, 12, G0 + 2.6], yaw: -Math.PI / 2 });
  add(EchoEar, { id: 'e1', note: 'high', at: [-3.4, 12, G0 + 7.0], yaw: Math.PI });
  add(EchoStone, { note: 'low', at: [-7.6, 12, G0 + 33], yaw: Math.PI / 2 });
  add(EchoEar, { id: 'e2', note: 'mid', at: [3.7, 12, G0 + 35.4], yaw: Math.PI });
  add(Door, { id: 'd4', at: [0, 12, G0 + 37.2], w: 5, h: 6.4, lamps: [{ lit: 'e2' }] });
  for (const [x, z, yaw] of [[-10.4, G0 + 18, Math.PI / 2], [10.4, G0 + 18, -Math.PI / 2]]) dish(x, 20, z, 3.2, yaw, 0.2);
  add(Mark, { room: 'gallery', at: [0, 12, G0 + 1.6], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [7.6, 12, G0 + 30.6], yaw: -Math.PI / 2 });

  // ---- the corridor and the First Sign's Hall (floor 12)
  const H0 = G0 + 37.2;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 12, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 12, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 12, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 19.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 12, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CW = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CW, y: 12, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; dish(Math.sin(a) * (HR - 0.6), 26, CW + Math.cos(a) * (HR - 0.6), 2.8, a + Math.PI, 0.35); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.2; cable([Math.sin(a) * 4, 12.2, CW + Math.cos(a) * 4], [Math.sin(a) * (HR - 0.5), 12.2, CW + Math.cos(a) * (HR - 0.5)], 0.25); }
  K.add(M.dark, T(annulus(3.4, 4.4, 0.06, 40), [0, 12.06, CW]));
  add(Door, { id: 'd5', at: [0, 12, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 12, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 12, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 12, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 12, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 19.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 12, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.1, 0, 14.5, CW + HR + 10.5));

  const model = signModel();
  model.pos.copy(K.world(0, 12, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 12, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 12, CW), r: HR, y: K.world(0, 12, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -12, -3), V(24, 44, CW + HR + 12)),
    gadget: { at: W(0, 12.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 12.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 6, 18, 14], [0, 6, 42, 14], [0, 10, C2, 16], [0, 17, C3, 14], [0, 17, G0 + 6, 16], [0, 17, G0 + 32, 16], [0, 20, CW, 30]],
    guardian: { def: { ...FIRST_SIGN, onHit: signHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the old doorway in the silent tower's back
function exterior(scene, level, rt) {
  const yaw = SITE.heading, sill = 0.35;
  const K = new TempleKit(rt.root, 'The Undertower', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M;
  const old = makeMaterial({ color: PALETTE.wall, color2: PALETTE.wall2, color3: PALETTE.wall3, mode: MODE_STRATA, strataSize: 1.1, flat: true, glyphs: true, key: 'temple.bazaar.old' });
  const brass = { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const lampM = makeMaterial({ color: '#ffe3aa', glow: 0.1, flat: true, key: 'temple.bazaar.porch' });
  // the foundation course of the tower showing through the paving: great old blocks, older than the market
  for (const [x, w, h, d] of [[-10.2, 3.8, 3.2, 2.6], [-6.6, 3.2, 4.6, 3.0], [6.6, 3.2, 4.4, 3.0], [10.2, 3.8, 2.8, 2.4]]) K.both(old, box(w, h, d, x, h / 2 - 0.3, d / 2 - 0.2));
  // the doorway: two great jambs, a lintel stone, the glyph on it, a dark way down
  for (const s of [-1, 1]) K.both(old, box(2.2, 8.4, 3.4, s * 3.5, 4.2, 1.5));
  K.both(old, box(9.4, 2.0, 3.6, 0, 9.2, 1.6));
  K.add(M.glyph, T(glyphGeometry(2.0, 0.14), [0, 9.2, 3.42]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.8, 7.6).translate(0, 3.8, 0), [0, sill, 0.35]));
  K.solid(box(4.8, 7.6, 0.1, 0, sill + 3.8, 0.35));
  K.both(M.floor, box(9.6, sill, 5.4, 0, sill / 2, 2.7));
  // an old dish on the lintel, and two lamps that wake after
  const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * 1.8; prof.push([Math.max(0.01, q), q * q / 4]); }
  K.add({ paint: new THREE.Color('#f5dfab'), smooth: true, side: THREE.DoubleSide }, T(lathe(prof, 20), [0, 10.3, 1.6], [-0.5, 0, 0]));
  K.add(brass, box(0.3, 1.2, 0.3, 0, 10.6, 1.6));
  K.add(lampM, T(new THREE.SphereGeometry(0.35, 10, 8), [-3.5, 8.9, 3.3])); K.add(lampM, T(new THREE.SphereGeometry(0.35, 10, 8), [3.5, 8.9, 3.3]));
  // cables running from the doorway into the paving
  for (const x of [-2.2, 2.4]) K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, 0.15, 0.6), V(x * 1.4, 0.12, 4), V(x * 2.4, 0.05, 7.5)]), 12, 0.16, 5));
  K.flush();
  const at = K.world(0, sill, 1.4);
  const front = K.world(0, 0, 6);
  // the market's crowd keeps off the doorway (crowdSpots' clear circles, src/crowd.js)
  if (level.crowdSpots) { const spots = level.crowdSpots; level.crowdSpots = function (...a) { const r = spots.apply(this, a); (r.clear ??= []).push({ x: front.x, z: front.z, r: 6.5 }, { x: at.x, z: at.z, r: 5 }); return r; }; }
  return { door: { at, heading: yaw }, kit: K, sill, lampM, clear: [{ x: front.x, z: front.z, r: 7 }] };
}

// ------------------------------------------------------------------ the world change: the silent tower speaks, once a night
/**
 * Once the First Sign has its line again, the silent tower wears a lamp on its crown, the Undertower's porch
 * lamps are lit, and once a night (when you are in or near the square) the tower says the whole line in the
 * First Sign's voice: a ring of light goes out from its crown, and everyone in the square looks up.
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The silent tower speaks (the world change)';
  rt.root.add(root);
  root.visible = false;
  const top = V(SITE.tower.x, SITE.tower.top - 4, SITE.tower.z);
  const beaconM = makeMaterial({ color: '#fff0bd', glow: 0.9, flat: true, key: 'temple.bazaar.beacon' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10), beaconM);
  beacon.position.copy(top);
  const ringM = makeMaterial({ color: '#fff0bd', glow: 0.9, flat: true, key: 'temple.bazaar.ring' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 4, 48).rotateX(Math.PI / 2), ringM);
  ring.position.copy(top); ring.visible = false;
  for (const m of [beacon, ring]) { m.userData.noCollide = true; m.userData.dynamic = true; root.add(m); }
  let k = 0, want = 0, spoke = false, wave = -1;
  const api = {
    root, beacon, ring, line: `${LINE.join(' ')}.`, spoken: 0,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; root.visible = k > 0.01; } },
    /** It speaks now (once a night; the tests call it directly). */
    speak() {
      spoke = true; wave = 0; api.spoken++;
      rt.notice?.(`From the top of the silent tower, in a voice older than the market: “${LINE.join(' ')}.”`);
      LINE.forEach((_, i) => setTimeout(() => rt.sound?.orbNote?.(WORD_DEGREES[i], top, { size: 1 }), i * 600)?.unref?.());
    },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); root.visible = k > 0.01; }
      if (rt.outside) rt.outside.lampM.uniforms.uGlow.value = 0.1 + 0.8 * k;
      if (!want) return;
      beaconM.uniforms.uGlow.value = 0.6 + 0.3 * Math.sin(t * 1.2);
      // once a night, when you are about the square
      const night = !!rt.isNight?.(), P = rt.player;
      if (!night) spoke = false;
      else if (!spoke && P && Math.hypot(P.pos.x - SITE.tower.x, P.pos.z - SITE.tower.z) < 220 && !rt.inside(P.pos)) api.speak();
      if (wave >= 0) {
        wave += dt;
        ring.visible = wave < 4;
        ring.scale.set(1 + wave * 40, 1, 1 + wave * 40);
        ringM.uniforms.uGlow.value = 0.9 * Math.max(0, 1 - wave / 4);
        if (wave >= 4) wave = -1;
      }
    },
  };
  return api;
}

export const BAZAAR_TEMPLE = {
  id: 'bazaar', levelId: 'bazaar', name: 'The Undertower', doorLabel: 'old doorway under the silent tower',
  gadget: 'echo', gadgetBox: 'bazaar.temple.echo', arenaDoor: 'd4',
  origin: [-200, 1600, -520], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'pell', out: 6, side: 6 },
  enterLine: 'Under the silent tower it is cold and dry and very old. Somewhere far down, a voice says one word, and waits, and says it again.',
  pitLine: 'You climb back up out of the cables, to the last glyph stone.',
  onResolved(rt) { rt.notice('Up in the square, the silent tower has a lamp on its crown. At night it will speak.', 'resolved.out'); },
  // it cries its word (a note the echo shell keeps); when it listens, its word played back retunes it, and it moves on
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const word = () => Math.min(LINE.length - 1, Math.round(G.meter / 0.25));
    const say = () => {
      const i = word();
      rt.game.emit('note', { pos: G.model.mouth.clone(), note: `sign.${i}`, degree: WORD_DEGREES[i], color: '#fff0bd', label: `the First Sign’s word, “${LINE[i]}”`, reach: 22 });
      rt.sound?.orbNote?.(WORD_DEGREES[i], G.model.mouth, { size: 1.2 });
    };
    G.say = say;
    const strike = G.def.onStrike;
    G.def = { ...G.def, onStrike: (g, a) => { strike?.(g, a); if (a.id === 'cry') { say(); rt.notice(`It cries its one word: “${LINE[word()]}”.`, `fs.word.${word()}`); } } };
    // (it says it again as it lowers its dish to listen: you can always catch it then)
    const enter = G.enter.bind(G);
    G.enter = (state) => { const was = G.state; enter(state); if (state === 'open' && was !== 'open') say(); };
    rt.offs.push(rt.game.on('echo', ({ pos, note } = {}) => {
      if (!pos || !G.awake) return;
      if (pos.distanceTo(G.model.mouth) > LISTEN) return;
      if (G.state !== 'open') { rt.notice('It hears you, but it is not listening yet. Wait for it to lower its dish.', 'fs.notyet'); return; }
      if (note !== `sign.${word()}`) {
        rt.notice(note?.startsWith?.('sign.') ? 'It hears its own old word, and shakes its dish. It has moved on: catch the new one.' : 'It hears the note, and shakes its dish. That is not its word.', `fs.wrong.${note}`);
        return;
      }
      G.add(0.25, 'echo');
      rt.rumble(0.6, 0.4);
      const next = word();
      if (G.state !== 'resolved') rt.notice(`It hears its word come back, and stops, and says the next: “${LINE[next]}”.`, `fs.next.${next}`);
      if (G.state === 'open') { G.enter('fight'); G.cool = 2.0; }
    }));
  },
};
