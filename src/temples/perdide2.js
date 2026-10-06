import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, LightEar, Platform, Bridge, Mark, Pit } from './pieces.js';
import { mothModel } from './guardians.js';

// Lorn II's temple: the Lamp-House, a dark tower of the makers standing in the
// shallow water east of the root cave, a causeway of flat stones out to it from
// the end of the lit path. Its lamp lit the whole wood once; the night the sky
// rang it went out, and three of the pools with it. Hollin's people kept their
// pools lit for forty-one years without knowing there had been a greater lamp.
// Something with wings is still up in its lamp-room, in the dark.
//
// Inside (built far overhead, through its door; dark: the lantern charm glows in it):
//   the Threshold           the first mark, the way out
//   the Hall of Dark Pools  three pool-lamps: splash each, and the door opens (the pools take your colours)
//   the Root Stair          a riding disc over a dark pool, a root-wall to climb
//   the Lantern Chamber     the makers' chest: the LANTERN CHARM (src/items.js 'lantern'). The door on is a
//                           lamp that wakes when you stand by it with the lantern
//   the Dark Gallery        a chasm crossed by moss-stones that only the lantern's light shows; an eye only it
//                           shows; a second lamp-door
//   the Lamp-Room           the guardian (organic: you calm it): the Lampless, a great moth. When it hangs low,
//                           searching for light, stand still by it with the lantern lit, and let it drink
// After: the Lamp-House's lamp burns again, its beam turning over the wood at night (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** In the shallow water east of the root cave; its door looks west, down the causeway to the path's end. */
export const SITE = { x: 46, z: -424, r: 14, path: [6, -414] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

export const PALETTE = {
  wall: '#4a4f7a', wall2: '#3f4470', wall3: '#5a5f8a', floor: '#5a5068', floor2: '#4e4560', trim: '#c9b8d8',
  dark: '#1b1f3e', stone: '#7a7090', accent: '#f0927a', glow: '#8fe0d0', lamp: '#ffd6a0', sand: '#5a5068', sand2: '#4e4560', void: '#14162c',
};

export const LOGIC = {
  id: 'perdide2', entry: 'threshold', gadget: 'lantern',
  rooms: { threshold: { checkpoint: true }, pools: { checkpoint: true }, roots: { checkpoint: true }, lantern: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: {}, lamp: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'pools' },
    { a: 'pools', b: 'roots', door: 'd1' },
    { a: 'roots', b: 'lantern' },
    { a: 'lantern', b: 'gallery', door: 'd2' },
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'galleryFar', b: 'lamp', door: 'd4' },
    { a: 'lamp', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'pools' }, s2: { type: 'switch', room: 'pools' }, s3: { type: 'switch', room: 'pools' },
    d1: { type: 'door', opens: { all: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] }, latch: true },
    chest: { type: 'gadget', room: 'lantern', item: 'lantern' },
    l1: { type: 'switch', room: 'lantern', needs: ['lantern'] },     // a lamp that wakes to the lantern
    d2: { type: 'door', opens: { lit: 'l1' }, latch: true },
    br1: { type: 'bridge', opens: { item: 'lantern' } },             // moss-stones only its light shows
    s4: { type: 'switch', room: 'galleryFar', needs: ['lantern'] },  // an eye only its light shows
    l2: { type: 'switch', room: 'galleryFar', needs: ['lantern'] },
    d4: { type: 'door', opens: { all: [{ lit: 's4' }, { lit: 'l2' }] }, latch: true },
    moth: { type: 'boss', room: 'lamp', needs: ['backpack', 'lantern'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const LAMPLESS = {
  kind: 'organic', name: 'the Lampless', final: 'touch', touch: 'lay a hand on its back',
  speed: 3.4, wakeTime: 3,
  wake: 'Wings open in the dark of the lamp-room, wide as sails, and two great eyes of glyph on them. It is hungry, and it is afraid of how dark it is.',
  openHint: 'It hangs low over the floor, turning, searching for light.',
  weary: 'It folds its wings and settles, its glyphs lit with your light. Go to it.',
  resolved: 'The Lampless sighs, and climbs to the lamp, and the lamp catches from it: the whole room goes gold.',
  phases: [
    { to: 0.45, attacks: ['swoop', 'gust'], pause: 1.6, hint: 'When it hangs low, searching, stand still by it with your lantern: let it drink.' },
    { to: 0.9, attacks: ['dust', 'swoop', 'gust'], pause: 1.3, hint: 'Its glyphs glow with your light. Again: stand still with it when it searches.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    swoop: { shape: 'ring', at: 'player', radius: 4.2, telegraph: 1.6, track: 0.6, damage: 0.2, knock: 9, recover: 0.9, open: 4.0 },
    gust: { shape: 'cone', range: 14, angle: 0.6, telegraph: 1.4, damage: 0.18, knock: 12, recover: 0.8 },
    dust: { shape: 'ring', at: 'self', radius: 8.5, telegraph: 1.5, damage: 0.2, knock: 10, recover: 0.8, open: 3.4 },
  },
};

function mothHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.05, 'push'); g.rt.notice('It reels from the shove and flies higher, frightened.', 'moth.push'); return true; }
  g.rt.notice('The fluid beads on its fur. It does not want water: it wants light.', 'moth.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const root = (pts, r) => K.both(M.stone, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), 16, r, 7, false));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.both(M.voidM, box(3.6, 5, 1.25, 0, 2.5, -0.625));   // (drawn and solid as one: from the doorway's face back to the wall's inner face)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 13, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Hall of Dark Pools (z 12.6..44): three pool-lamps, dark; splash each
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 13, roof: true, columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }] });
  const poolM = makeMaterial({ color: '#2f3560', glow: 0.1, flat: true, key: 'temple.p2.pools' });
  for (const [i, [x, z]] of [[-5, 22], [5, 28], [-5, 35]].entries()) {
    K.both(M.trim, T(annulus(2.0, 2.6, 0.5, 32), [x, 0.5, z]));
    K.both(poolM, T(new THREE.CylinderGeometry(2.0, 2.0, 0.1, 28), [x, 0.3, z]));
    add(Switch, { id: `s${i + 1}`, at: [x, 0.9, z], yaw: 0, size: 0.9 });
  }
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.4, lamps: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] });
  add(Mark, { room: 'pools', at: [7.5, 0, 16], yaw: -Math.PI / 2 });
  root([[-11, 12, 14], [-9, 9, 20], [-10.5, 4, 26], [-10.8, 0, 30]], 0.8);
  root([[11, 12, 40], [9.5, 8, 36], [10.6, 3, 32], [10.8, 0, 26]], 0.7);

  // ---- the Root Stair (a rotunda, floor 0): a disc over a dark pool, then a root-wall to the landing at 9
  K.slab(-3.2, 44, 3.2, 46.6, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 46.6, 3.2, 44.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 45.6));
  const C2 = 57.2;
  K.rotunda({ x: 0, z: C2, y: -6, r: 10, h: 30, floor: false, gaps: [{ a: Math.PI, w: 5, h: 6.4, y0: 6 }, { a: 0, w: 5, h: 6, y0: 15 }], oculus: 0.3 });
  K.both(M.floor, box(20, 6, 3, 0, -3, C2 - 8.6));            // the near landing (its top at 0)
  K.both(M.wallGlyph, box(20, 15, 6, 0, 1.5, C2 + 6));        // the root-wall, its top at 9: climb it
  K.both(M.dark, T(new THREE.CylinderGeometry(10, 10, 1, 32), [0, -6.5, C2]));
  const pool2 = makeMaterial({ color: '#2a2f58', glow: 0.18, flat: true, key: 'temple.p2.deep' });
  K.add(pool2, T(new THREE.CylinderGeometry(9.8, 9.8, 0.2, 32), [0, -2.4, C2]));
  add(Pit, { room: 'roots', min: [-11, -8, C2 - 7], max: [11, -1.5, C2 + 3] });
  add(Platform, { path: [[0, 0, C2 - 4.8], [0, 0, C2 + 0.6]], r: 2.2, speed: 1.6, pause: 1.6 });
  root([[-6, 9, C2 + 3.2], [-5, 5, C2 + 3.1], [-6.2, 1, C2 + 3.15], [-6, -3, C2 + 3.1]], 0.45);
  root([[5, 9, C2 + 3.2], [6, 4, C2 + 3.1], [4.8, 0, C2 + 3.15], [5.4, -3, C2 + 3.1]], 0.45);
  K.slab(-6, C2 + 9, 6, C2 + 10.4, 9, 0.6);
  add(Mark, { room: 'roots', at: [-3.2, 0, C2 - 8.6], yaw: Math.PI / 2 });

  // ---- the corridor and the Lantern Chamber (floor 9, a dark rotunda): the chest; a lamp-door
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 9, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 9, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 15.8, C2 + 11.6));
  const C3 = C2 + 22.6;    // 79.8
  K.rotunda({ x: 0, z: C3, y: 9, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 9, C3));   // (its own lathe: a cylinder stand-in stood over its lower step)
  add(Door, { id: 'd2', at: [0, 9, C3 + 10.2], w: 5, h: 6.4, lamps: [{ lit: 'l1' }] });
  add(LightEar, { id: 'l1', at: [2.6, 9, C3 + 8.4], reach: 3.6 });
  add(Mark, { room: 'lantern', at: [6, 9, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Dark Gallery (z 91..125): a chasm, moss-stones only the lantern shows, an eye only it shows
  const G0 = C3 + 10.9;
  K.slab(-3.2, C3 + 10.1, 3.2, G0 + 0.6, 9, 0.8);
  K.hall({ x: 0, z: G0 + 17.2, w: 22, d: 34.4, y: -3, h: 24, floor: false, roof: true, doors: [{ side: 's', w: 5, h: 6.4, y0: 12 }, { side: 'n', w: 5, h: 6.4, y0: 12 }] });
  K.slab(-11, G0, 11, G0 + 6, 9, 12);
  K.slab(-11, G0 + 26, 11, G0 + 34.4, 9, 12);
  K.both(M.dark, box(22, 1, 20, 0, -3.5, G0 + 16));
  add(Pit, { room: 'gallery', min: [-12, -6, G0 + 6], max: [12, 4, G0 + 26] });
  add(Bridge, { id: 'br1', a: [0, 9, G0 + 5.9], b: [0, 9, G0 + 26.1], w: 3.4, n: 9, hidden: 'lantern' });
  add(Switch, { id: 's4', at: [10.8, 12, G0 + 30], yaw: -Math.PI / 2, size: 1.0, hidden: 'lantern' });
  add(LightEar, { id: 'l2', at: [-2.6, 9, G0 + 32.6], reach: 3.6 });
  add(Door, { id: 'd4', at: [0, 9, G0 + 35], w: 5, h: 6.4, lamps: [{ lit: 's4' }, { lit: 'l2' }] });
  add(Mark, { room: 'gallery', at: [-7, 9, G0 + 3], yaw: 0 });

  // ---- the corridor, and the Lamp-Room (floor 9): a round hall, the great lamp dark in its cradle overhead
  const H0 = G0 + 35;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 9, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 9, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 9, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 16.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 9, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 19, CL = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CL, y: 9, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0 });
  // the lamp's cradle: a ring of brass on chains, a great glass lamp in it, dark until the end
  K.add(M.trim, T(annulus(4.2, 5, 0.4, 40), [0, 9 + 20, CL]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; K.add(M.dark, box(0.12, 6, 0.12, Math.sin(a) * 4.6, 9 + 23, CL + Math.cos(a) * 4.6)); }
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'temple.p2.lamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), lampM);
  lamp.position.copy(K.world(0, 9 + 18.2, CL));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  rt.lampRoom = { lamp, lampM, light: null };
  add(Door, { id: 'd5', at: [0, 9, CL + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CL + HR + 0.6, 3.2, CL + HR + 10, 9, 0.8);
  K.wall(-3.2, CL + HR + 1.4, -3.2, CL + HR + 10, 9, 7, { t: 0.8 }); K.wall(3.2, CL + HR + 10, 3.2, CL + HR + 1.4, 9, 7, { t: 0.8 });
  K.wall(3.2, CL + HR + 10, -3.2, CL + HR + 10, 9, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 16.4, CL + HR + 5.7));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, 11.5, CL + HR + 10.35));

  const model = mothModel();
  model.pos.copy(K.world(0, 9, CL + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 9, CL + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CL), r: HR, y: K.world(0, 9, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -10, -3), V(24, 40, CL + HR + 12)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, CL + HR + 9.6), r: 1.5 }],
    // dim: the house is dark (the pools and the lantern light it)
    lights: [[0, 5, 6, 9], [0, 5, 28, 10], [0, 4, C2, 9], [0, 13, C3, 8], [0, 13, G0 + 16, 9], [0, 14, CL, 14]],
    guardian: { def: { ...LAMPLESS, onHit: mothHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Lamp-House in the shallows
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -2.5, R = 9;
  const K = new TempleKit(rt.root, 'The Lamp-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, door = 3.4;   // (the door's sill, above the water on a stone apron)
  const ink = { paint: new THREE.Color(PALETTE.dark), smooth: false, side: THREE.FrontSide };
  // a stone apron in the water, a tall tapering tower, a gallery, a glass lamp-room and a cap
  K.both(M.floor, new THREE.CylinderGeometry(R + 6, R + 7, door, 32).translate(0, door / 2, 0));
  // (the lathe itself collides: a straight cylinder inside it let a climber into its flared foot and crown, src/contact-audit.js)
  K.both(M.wall, lathe([[R + 1.2, door], [R, door + 4], [R - 2.2, door + 40], [R - 1.6, door + 41], [R - 1.6, door + 42]], 32));
  for (let y = door + 8; y < door + 40; y += 8) K.both(M.trim, new THREE.CylinderGeometry(R - 2.2 + (1 - (y - door) / 40) * 2.2 + 0.3, R - 2.2 + (1 - (y - door) / 40) * 2.2 + 0.3, 0.6, 32).translate(0, y, 0));
  K.both(M.floor, T(annulus(R - 3, R + 1.5, 0.6, 32), [0, door + 42.6, 0]));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.both(M.trim, T(new THREE.BoxGeometry(0.5, 7, 0.5), [Math.sin(a) * (R - 2.6), door + 46, Math.cos(a) * (R - 2.6)])); }
  K.both(ink, T(new THREE.ConeGeometry(R - 1.6, 5, 16), [0, door + 52, 0]));
  K.add(M.glyph, T(glyphGeometry(2.8, 0.15), [0, door + 30, R - 2.2 + 0.25 + 0.6], [0.05, 0, 0]));
  // the doorway on the apron, toward the causeway
  const z0 = R - 0.6, z1 = R + 3;
  for (const s of [-1, 1]) K.both(M.wall, box(3.4, 9, z1 - z0, s * 3.9, door + 4.5, (z0 + z1) / 2));
  K.both(M.wall, box(4.4, 2.4, z1 - z0, 0, door + 8.2, (z0 + z1) / 2));
  K.both({ paint: new THREE.Color(PALETTE.accent), smooth: false, side: THREE.FrontSide }, box(11, 1, 1.2, 0, door + 9.6, z1 + 0.1));
  K.both(M.voidM, box(4.3, 7, 0.9, 0, door + 3.5, R + 0.85));   // (drawn and solid as one: the dark of the doorway, back to the tower's wall)
  // the causeway: flat stones from the apron to the end of the lit path
  const pathL = K.local(V(SITE.path[0], 0, SITE.path[1]));
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, z = R + 7 + (pathL.z - (R + 7)) * k, x = pathL.x * k;
    const top = THREE.MathUtils.lerp(door, 0.6 - base, k);
    K.both(M.stone, T(new THREE.CylinderGeometry(2.2, 2.4, top + 1.2, 10), [x, (top - 1.2) / 2, z]));
  }
  K.flush();
  // the lamp up there, dark until the Lampless is calm (the world change lights it)
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'temple.p2.outlamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(R - 3.6, 20, 14), lampM);
  lamp.position.copy(K.world(0, door + 46, 0));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  const at = K.world(0, door, R + 2.2);
  return { door: { at, heading: yaw }, kit: K, base, doorY: base + door, R, lamp, lampM, top: base + door + 55, clear: [{ x: SITE.x, z: SITE.z, r: R + 9 }] };
}

// ------------------------------------------------------------------ the world change: the lamp burns again
/**
 * Once the Lampless is calm the Lamp-House's lamp burns again: gold in its
 * glass room, a light on the water round the tower, and a long beam turning
 * slowly over the wood. Inside, the lamp-room's great lamp glows.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const beamM = makeMaterial({ color: '#ffe2b0', glow: 0.5, flat: true, side: THREE.DoubleSide, key: 'temple.p2.beam' });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 9, 140, 16, 1, true).translate(0, 70, 0).rotateZ(Math.PI / 2 - 0.08), beamM);
  beam.userData.noCollide = true; beam.userData.dynamic = true;
  beam.visible = false;
  if (O) { beam.position.copy(O.lamp.position); rt.root.add(beam); }
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  rt.lights.push(light);
  let k = 0, want = 0;
  return {
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 4);
      const on = k > 0.02;
      if (O) {
        O.lampM.uniforms.uGlow.value = 0.04 + 0.96 * k * (0.92 + 0.08 * Math.sin(t * 3));
        beam.visible = on;
        beam.rotation.y = t * 0.25;
        beamM.uniforms.uGlow.value = 0.45 * k;
        if (on) light.set(O.lamp.position.x, O.lamp.position.y, O.lamp.position.z, 60 * k); else light.set(0, -1e5, 0, 0);
      }
      const L = rt.lampRoom;
      if (L) {
        L.lampM.uniforms.uGlow.value = 0.04 + 0.96 * k;
        if (on && !L.light) { L.light = new THREE.Vector4(L.lamp.position.x, L.lamp.position.y, L.lamp.position.z, 40); rt.lights.push(L.light); }
      }
    },
  };
}

export const PERDIDE2_TEMPLE = {
  id: 'perdide2', levelId: 'perdide2', name: 'The Lamp-House', doorLabel: 'door of the Lamp-House',
  gadget: 'lantern', gadgetBox: 'perdide2.temple.lantern', arenaDoor: 'd4', dark: true,
  origin: [-140, 1800, -300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'tamsy', out: 33, side: 2 },
  enterLine: 'Inside the Lamp-House it is very dark, and it smells of moss and old oil. Somewhere above, wings.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out over the wood the Lamp-House’s lamp catches, and its beam begins to turn.', 'resolved.out'); },
  // the Lampless drinks the lantern's light: stand still by it while it hangs low, searching
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    let still = 0;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      const P = rt.player;
      if (!P || G.state !== 'open') { still = 0; return; }
      const near = Math.hypot(P.pos.x - G.model.pos.x, P.pos.z - G.model.pos.z) < 8;
      const quiet = Math.hypot(P.vel.x, P.vel.z) < 0.4 && !P.down;
      if (near && quiet && rt.logic.has('lantern')) {
        if ((still += dt) > 1.4) {
          still = 0;
          G.add(G.phaseIndex === 0 ? 0.15 : 0.15, 'light');
          rt.sound?.chime?.();
          if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
        }
      } else {
        if (near && !quiet) rt.notice('It flinches from your movement. Be still.', 'moth.still');
        still = 0;
      }
    };
  },
};
