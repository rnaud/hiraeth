import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, BellEar, Mark, Pit } from './pieces.js';
import { whaleModel } from './guardians.js';

// Vael II's temple: the Founders' Belfry, a tower of bone-white stone that
// rises straight out of the cloud beside the starting plateau, a bridge from
// the plateau's west rim to its door. The monks say the founders built it
// before the monastery, to keep the stones down: a bell in every room, and the
// stones stayed where they were put. The bells stopped; the stones fell up.
// Something swims in the top of the tower, and cries.
//
// Inside (built far overhead, through its door):
//   the Threshold          the first mark, the way out
//   the Hall of Stones     two stone balls in two grooves: roll both onto their plates (the push)
//   the Stone Stair        a round well with two discs that ride up and down: ride one to a ledge,
//                          the next to the top
//   the Bell Chamber       the makers' chest: the BELL-NOTE WHISTLE (src/items.js 'bell'). The door on is
//                          bell-tuned: sound the whistle by it
//   the Hall of Echoes     a chasm, the stones of its bridge hanging high over it (they fell up): sound the
//                          bell at its edge and they come down into place; a second bell door beyond
//   the Cloud-Mother's Hall the guardian (organic: you calm her). She swims high and fearful, gusts and dives;
//                          each time she cries, low, her mouth open, sound the bell near her; worn out, she
//                          lies down: lay a hand on her brow
// After: the stones that fell up come down, all over Vael II (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** Out of the cloud west of the starting plateau; its door looks east, to a bridge from the plateau's rim. */
export const SITE = { x: -128, z: -6, r: 18, rim: [-86, -6] };
SITE.heading = Math.PI / 2;   // (the door faces +x, the plateau)

export const PALETTE = {
  wall: '#f4efe2', wall2: '#e8dfcb', wall3: '#fbf7ee', floor: '#e6d6bd', floor2: '#d9c7aa', trim: '#fbf7ee',
  dark: '#383650', stone: '#efe2cc', accent: '#d99072', glow: '#a8e6ee', lamp: '#f6c84e', sand: '#e8dfcb', sand2: '#d9c7aa',
};

export const LOGIC = {
  id: 'arzach2', entry: 'threshold', gadget: 'bell',
  rooms: { threshold: { checkpoint: true }, stones: { checkpoint: true }, stair: { checkpoint: true }, bell: { checkpoint: true }, echoes: { checkpoint: true }, echoesFar: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'stones' },
    { a: 'stones', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'bell' },
    { a: 'bell', b: 'echoes', door: 'd3' },
    { a: 'echoes', b: 'echoesFar', door: 'br1' },
    { a: 'echoesFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    p1: { type: 'plate', room: 'stones' },
    p2: { type: 'plate', room: 'stones' },
    ball1: { type: 'drum', room: 'stones', plate: 'p1', plateAt: 1, start: 0 },
    ball2: { type: 'drum', room: 'stones', plate: 'p2', plateAt: 1, start: 0 },
    d1: { type: 'door', opens: { all: [{ pressed: 'p1' }, { pressed: 'p2' }] }, latch: true },
    chest: { type: 'gadget', room: 'bell', item: 'bell' },
    e1: { type: 'bell', room: 'bell', needs: ['bell'] },
    d3: { type: 'door', opens: { lit: 'e1' }, latch: true },
    e2: { type: 'bell', room: 'echoes', needs: ['bell'] },
    br1: { type: 'bridge', opens: { lit: 'e2' }, latch: true },
    e3: { type: 'bell', room: 'echoesFar', needs: ['bell'] },
    d4: { type: 'door', opens: { lit: 'e3' }, latch: true },
    mother: { type: 'boss', room: 'hall', needs: ['backpack', 'bell'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const MOTHER = {
  kind: 'organic', name: 'the Cloud-Mother', final: 'touch', touch: 'lay a hand on her brow',
  speed: 3.2, wakeTime: 3.4,
  wake: 'Something huge and pale turns over in the top of the tower: a sky-whale, her flanks full of cloud. She is afraid of you.',
  openHint: 'She sinks low and cries, a long sound like a bell with no clapper.',
  weary: 'She settles on the floor of her hall, her fins still. She is listening. Go to her.',
  resolved: 'She sighs, and the cloud along her back thins away. Far below the tower, something heavy comes down to rest.',
  phases: [
    { to: 0.5, attacks: ['gust', 'dive'], pause: 1.8, hint: 'She cannot stay down, and she cannot stop crying. When she cries, sound the bell near her.' },
    { to: 0.9, attacks: ['wail', 'dive', 'gust'], pause: 1.4, hint: 'Her glyphs wake. Again: answer her crying with the bell.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    gust: { shape: 'cone', range: 14, angle: 0.55, telegraph: 1.4, damage: 0.18, knock: 12, recover: 0.9 },
    dive: { shape: 'ring', at: 'player', radius: 4.6, telegraph: 1.7, track: 0.55, damage: 0.22, knock: 9, recover: 1.0, open: 3.0 },
    wail: { shape: 'ring', at: 'self', radius: 9, telegraph: 1.5, damage: 0.2, knock: 11, recover: 0.8, open: 2.6 },
  },
};

/** The fluid does not calm her (it only frightens her): the bell does (onBell). */
function motherHit(g, part, mode) {
  const rt = g.rt;
  if (mode === 'push') { g.add(-0.05, 'push'); rt.notice('She shies from the shove, crying louder. Gently.', 'mother.push'); return true; }
  if (g.state === 'open') rt.notice('The fluid only frightens her. She wants a sound: the bell.', 'mother.fluid');
  else rt.notice('She flinches from the splash.', 'mother.splash');
  return true;
}
/** The bell-note whistle sounded near her while she cries: an eighth (then a tenth) of her calm. */
function motherBell(g, pos) {
  if (!pos || g.state !== 'open') { if (g.awake && pos) g.rt.notice('She hears the note, and turns her head. Sound it when she cries.', 'mother.wait'); return; }
  if (pos.distanceTo(g.model.pos) > 28) { g.rt.notice('She is too far to hear it. Get closer.', 'mother.far'); return; }
  g.add(g.phaseIndex === 0 ? 0.125 : 0.1, 'bell');
  if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const stone = (x, y, z, r, i) => K.add(M.stone, T(new THREE.IcosahedronGeometry(r, 1), [x, y, z], [i, i * 2, 0], [1, 0.7, 1]));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 13, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Hall of Stones (z 12.6..44): two balls, two grooves, two plates before the door
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 13, roof: 'oculus', oculus: 0.25, columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.6 }] });
  for (const [x, z0] of [[-5, 17], [5, 21]]) {
    K.add(M.dark, box(1.0, 0.04, 39 - z0, x, 0.02, (z0 + 39) / 2));
    for (const s of [-1, 1]) K.add(M.trim, box(0.25, 0.12, 39 - z0, x + s * 0.75, 0.06, (z0 + 39) / 2));
  }
  add(Ball, { id: 'ball1', a: [-5, 0.04, 17], b: [-5, 0.04, 39], r: 1.0 });
  add(Ball, { id: 'ball2', a: [5, 0.04, 21], b: [5, 0.04, 39], r: 1.3 });
  add(Plate, { id: 'p1', at: [-5, 0, 39], r: 1.2 });
  add(Plate, { id: 'p2', at: [5, 0, 39], r: 1.5 });
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.6, lamps: [{ pressed: 'p1' }, { pressed: 'p2' }] });
  add(Mark, { room: 'stones', at: [-7.5, 0, 15.5], yaw: Math.PI / 2 });
  // stones that once fell up, heaped in the corners where somebody brought them back down
  [[-9, 0.6, 42, 0.9], [-8.2, 0.5, 40.6, 0.7], [9.1, 0.6, 15, 0.8], [8.4, 1.4, 15.6, 0.6]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i));

  // ---- the corridor and the Stone Stair (a round well: two riding discs, a ledge between them)
  K.slab(-3.2, 44, 3.2, 46.4, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.4, 0, 6.6, { t: 0.8 }); K.wall(3.2, 46.4, 3.2, 44.6, 0, 6.6, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 7, 45.4));
  const C2 = 56.4;
  K.rotunda({ x: 0, z: C2, y: 0, r: 9, h: 25, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6, y0: 16.2 }], oculus: 0.35 });
  add(Platform, { path: [[0, 0.3, C2 - 4.6], [0, 8.25, C2 - 4.6]], r: 2.2, speed: 2.0, pause: 1.6 });
  K.both(M.floor, box(6.4, 8, 3.6, 0, 4, C2 - 0.6));                     // the ledge, its top at 8
  K.add(M.trim, box(6.6, 0.3, 3.8, 0, 8.05, C2 - 0.6));
  add(Platform, { path: [[0, 8.3, C2 + 3.4], [0, 16.25, C2 + 3.4]], r: 2.2, speed: 2.0, pause: 1.6 });
  K.both(M.floor, box(7.2, 16, 3.2, 0, 8, C2 + 7.2));                    // the top landing, by the high door
  K.add(M.trim, box(7.4, 0.3, 3.4, 0, 16.05, C2 + 7.2));
  add(Mark, { room: 'stair', at: [5, 0, C2 - 3], yaw: -Math.PI / 2 });

  // ---- the corridor and the Bell Chamber (floor 16): the chest, and the bell-tuned door
  K.slab(-3.2, C2 + 9.6, 3.2, C2 + 12.4, 16, 0.8);
  K.wall(-3.2, C2 + 10.3, -3.2, C2 + 12.4, 16, 6.6, { t: 0.8 }); K.wall(3.2, C2 + 12.4, 3.2, C2 + 10.3, 16, 6.6, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 23, C2 + 11.4));
  const C3 = C2 + 22.4;   // 78.8
  K.rotunda({ x: 0, z: C3, y: 16, r: 10, h: 15, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 16, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 16.31, C3));
  // a bell hangs in the oculus, without a clapper
  const bell = lathe([[0.02, 0], [1.4, 0.1], [1.5, 0.8], [1.05, 2.4], [0.85, 3.4], [0.02, 3.6]], 24);
  K.add(M.stone, T(bell, [0, 26, C3]));
  K.add(M.trim, box(0.2, 4, 0.2, 0, 31.5, C3));
  add(Door, { id: 'd3', at: [0, 16, C3 + 10.7], w: 5, h: 6.4, bell: true, lamps: [{ lit: 'e1' }] });
  add(BellEar, { id: 'e1', at: [0, 16, C3 + 7], reach: 26 });
  add(Mark, { room: 'bell', at: [6.2, 16, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Hall of Echoes (z 90..124): a chasm under a bridge of stones that fell up
  const E0 = C3 + 11.4;   // 90.2
  K.slab(-3.2, C3 + 10.6, 3.2, E0 + 0.6, 16, 0.8);
  K.hall({ x: 0, z: E0 + 17.2, w: 22, d: 34.4, y: 6, h: 22, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 10 }, { side: 'n', w: 5, h: 6.4, y0: 10 }] });
  K.slab(-11, E0, 11, E0 + 6, 16, 10);
  K.slab(-11, E0 + 26, 11, E0 + 34.4, 16, 10);
  K.both(M.dark, box(22, 1, 20, 0, 5.5, E0 + 16));
  add(Pit, { room: 'echoes', min: [-12, 2, E0 + 6], max: [12, 12.5, E0 + 26] });
  add(Bridge, { id: 'br1', a: [0, 16, E0 + 5.9], b: [0, 16, E0 + 26.1], w: 4, n: 8, from: 'above' });
  add(BellEar, { id: 'e2', at: [0, 16, E0 + 4], reach: 24 });
  add(Door, { id: 'd4', at: [0, 16, E0 + 35], w: 5, h: 6.4, bell: true, lamps: [{ lit: 'e3' }] });
  add(BellEar, { id: 'e3', at: [0, 16, E0 + 32], reach: 9 });
  add(Mark, { room: 'echoes', at: [-7, 16, E0 + 3], yaw: 0 });
  for (let i = 0; i < 4; i++) K.glyph([-10.95, 22 + (i % 2) * 2, E0 + 6 + i * 6], 1.3, Math.PI / 2);

  // ---- the corridor, and the Cloud-Mother's hall (a great rotunda, open to the sky)
  const H0 = E0 + 35;      // 125.2
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 16, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 16, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 16, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 23.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 16, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 21, CH = H0 + 3.2 + HR + 1.4;   // 150.8
  K.rotunda({ x: 0, z: CH, y: 16, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.5 });
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; K.column(Math.sin(a) * (HR - 2.2), CH + Math.cos(a) * (HR - 2.2), 16, 26, 0.9); }
  add(Door, { id: 'd5', at: [0, 16, CH + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CH + HR + 0.6, 3.2, CH + HR + 10, 16, 0.8);
  K.wall(-3.2, CH + HR + 1.4, -3.2, CH + HR + 10, 16, 7, { t: 0.8 }); K.wall(3.2, CH + HR + 10, 3.2, CH + HR + 1.4, 16, 7, { t: 0.8 });
  K.wall(3.2, CH + HR + 10, -3.2, CH + HR + 10, 16, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 23.4, CH + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 16, CH + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, 18.5, CH + HR + 10.9));

  const model = whaleModel();
  model.pos.copy(K.world(0, 16, CH + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(-4, 16, CH + 4);
  model.restHeading = K.heading(Math.PI * 0.85);
  const arena = { center: K.world(0, 16, CH), r: HR, y: K.world(0, 16, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -2, -3), V(24, 60, CH + HR + 12)),
    gadget: { at: W(0, 16.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 16.5, CH + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 7, 22, 18], [0, 7, 38, 18], [0, 8, C2, 16], [0, 20, C3, 16], [0, 22, E0 + 10, 20], [0, 22, E0 + 28, 18], [0, 22, CH, 30]],
    guardian: { def: { ...MOTHER, onHit: motherHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Founders' Belfry over the cloud
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -70, door = 40.3;
  const K = new TempleKit(rt.root, 'The Founders’ Belfry', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M, R = 15;
  const rose = { paint: new THREE.Color(PALETTE.accent), smooth: true };
  // a round tower out of the cloud: a fluted shaft, a gallery ring at the door, an open belfry on top
  K.both(M.wall, lathe([[R + 3, base], [R + 1, base + 30], [R, door - 6], [R, door + 34], [R + 2.4, door + 35], [R + 2.4, door + 36.5], [R - 0.5, door + 37]], 40),
    new THREE.CylinderGeometry(R, R + 2, door + 37 - base, 24).translate(0, (door + 37 + base) / 2, 0));
  K.both(M.floor, T(annulus(R - 0.5, R + 5, 1.2, 48), [0, door, 0]));                                 // the gallery round the door
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; K.both(M.trim, T(new THREE.BoxGeometry(0.4, 1.0, 0.4), [Math.sin(a) * (R + 4.7), door + 0.5, Math.cos(a) * (R + 4.7)])); }
  // the belfry: eight piers, a dome of rose stone, a great bell inside
  const B0 = door + 37;
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; K.both(M.wall, T(new THREE.BoxGeometry(3, 16, 3), [Math.sin(a) * (R - 2), B0 + 8, Math.cos(a) * (R - 2)], [0, a, 0])); }
  K.both(M.wall, T(annulus(4, R + 1, 1.4, 40), [0, B0 + 17.4, 0]));
  K.both(rose, new THREE.SphereGeometry(R, 32, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, B0 + 17, 0));
  K.add(M.trim, lathe([[2.6, 0], [2.6, 1], [1.8, 1.4], [0.01, 2.2]], 16).translate(0, B0 + 17 + R * 0.6 - 0.4, 0));
  K.add(M.stone, T(lathe([[0.02, 0], [5, 0.3], [5.4, 3], [3.8, 8.5], [3.1, 12], [0.02, 12.8]], 32), [0, B0 + 2, 0]));
  K.add(M.dark, box(0.6, 3.4, 0.6, 0, B0 + 15.5, 0));
  // glyphs round the shaft, between flutes
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; K.add(M.glyph, T(glyphGeometry(2.4, 0.14), [Math.sin(a) * (R + 0.06), door + 18, Math.cos(a) * (R + 0.06)], [0, a, 0])); }
  // the portico and the dark doorway on the gallery, toward the plateau
  const z0 = R - 0.6, z1 = R + 3.2;
  for (const s of [-1, 1]) K.both(M.wall, box(3.6, 11, z1 - z0, s * 4, door + 5.5, (z0 + z1) / 2));
  K.both(M.wall, box(4.4, 4, z1 - z0, 0, door + 9, (z0 + z1) / 2));
  K.add(rose, box(12, 1.2, 1.2, 0, door + 11.6, z1 + 0.1));
  K.glyph([0, door + 9.4, z1 + 0.05], 2.6, 0);
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.3, 7).translate(0, 3.5, 0), [0, door, R + 0.2]));
  K.solid(box(4.4, 7, 0.6, 0, door + 3.5, R - 0.2));
  // the bridge from the plateau's rim to the gallery (the rim is a little lower than the door)
  const rimL = K.local(V(SITE.rim[0], 0, SITE.rim[1]));
  const rimY = level.topAt?.(SITE.rim[0], SITE.rim[1]) ?? 40;
  K.bridge([0, door, R + 4.9], [0, rimY, rimL.z], 4.6, { parapet: 1.0 });
  for (const zz of [R + 12, R + 20]) K.both(M.wall, T(new THREE.CylinderGeometry(1.2, 2.2, door - base, 10), [0, (door + base) / 2 - 0.6, zz]));
  // stones that fell up, hanging round the belfry (they come down when the Cloud-Mother is calm)
  const hang = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.4, r = R + 9 + (i % 3) * 4, g = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + (i % 3) * 0.6, 1).scale(1, 0.7, 1), makeMaterial({ color: PALETTE.stone, flat: true }));
    g.position.copy(K.world(Math.sin(a) * r, B0 + 6 + (i % 4) * 5, Math.cos(a) * r));
    g.userData.noCollide = true; g.userData.dynamic = true;
    rt.root.add(g);
    hang.push({ g, y: g.position.y, i, rest: K.world(Math.sin(a) * (R + 3.4), door + 1.2 + (i % 2) * 0.5, Math.cos(a) * (R + 3.4)) });
  }
  K.flush();
  const at = K.world(0, door, R + 1.6);
  const front = K.world(0, door, R + 9);
  return { door: { at, heading: yaw }, kit: K, base, doorY: door, R, top: B0 + 30, hang, clear: [] , front };
}

// ------------------------------------------------------------------ the world change: the stones come down
/**
 * Once the Cloud-Mother is calm, the stones that fell up come down, all over
 * Vael II: the floating stones settle onto what lies under them (or sink into
 * the cloud), and the stones hanging round the belfry come down onto its
 * gallery. (The level's own movers bob them every frame: this runs after them,
 * level.update's late step.)
 */
function change(scene, level, rt) {
  const A = level.arzach2;
  const stones = [];
  let physics = null;
  const rest = (g) => {
    const w = g.getWorldPosition(new THREE.Vector3());
    const gy = physics?.groundAt?.(w.x, w.y - 3, w.z, 400) ?? -Infinity;
    const floor = Number.isFinite(gy) && gy > (A?.cloudY ?? -36) ? gy + 2.5 : (A?.cloudY ?? -36) - 8;
    return floor - w.y;   // (world metres to drop)
  };
  let k = 0, want = 0;
  return {
    root: null,
    init(ph) { physics = ph; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt) { k += (want - k) * Math.min(1, dt / 8); },
    /** After the level's movers have bobbed the stones: bring them down by k (and bob the belfry's own). */
    late(dt, t) {
      for (const h of rt.outside?.hang ?? []) h.g.position.y = THREE.MathUtils.lerp(h.y + Math.sin(t * 0.4 + h.i) * 1.2, h.rest.y, k);
      if (k < 1e-3) return;
      if (!stones.length && A?.floaters) for (const g of A.floaters.children) stones.push({ g, drop: null });
      for (const s of stones) {
        s.drop ??= rest(s.g);
        s.g.position.y += s.drop * k;
        s.g.rotation.y *= 1 - k;
      }
      for (const h of rt.outside?.hang ?? []) { h.g.position.x = THREE.MathUtils.lerp(h.x0 ??= h.g.position.x, h.rest.x, k); h.g.position.z = THREE.MathUtils.lerp(h.z0 ??= h.g.position.z, h.rest.z, k); }
    },
  };
}

export const ARZACH2_TEMPLE = {
  id: 'arzach2', levelId: 'arzach2', name: 'The Founders’ Belfry', doorLabel: 'door of the Founders’ Belfry',
  gadget: 'bell', gadgetBox: 'arzach2.temple.bell', arenaDoor: 'd4',
  origin: [80, 1600, 150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  enterLine: 'Inside the belfry the air is still and white, and somewhere above, something huge is crying.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below the tower, all over Vael II, the stones that fell up begin to come down.', 'resolved.out'); },
  // her calm comes from the bell: every 'bell' the whistle sounds, she hears
  onConnect(rt) { rt.offs.push(rt.game.on('bell', ({ pos } = {}) => { if (rt.guardian?.awake) motherBell(rt.guardian, pos); })); },
};
