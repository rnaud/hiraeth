import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, Gust, Updraft, Platform, Mark, Pit } from './pieces.js';
import { elderModel } from './guardians.js';
import { items } from '../items.js';

// Vael's temple: the Aerie, a great white house of the makers on the plain
// west of the landing, two drums of bone-white stone and a crown of stone
// wings on top. It is where the makers gave Vael's great birds their wings;
// the birds were raised in its roost. The oldest of them, the Elder, so old
// her feathers have gone to stone, kept the house. The night the light went
// over she stopped flying, and the others left, and she stayed.
//
// Inside (built far overhead, through its door):
//   the Threshold        the first mark, the way out
//   the Hall of Winds    gusts blow down it from the far end and shove you back: wait them out behind the
//                        stone screens, screen to screen; an eye by the far door opens it
//   the Feather Stair    a wall to climb, then a disc that rides straight up to the landing
//   the Wing Chamber     the makers' chest: the FLUID WINGS (src/items.js 'glider'). Its far side opens
//                        on nothing:
//   the Gulf             a chasm thirty-four metres across, the far ledge lower down: glide it
//   the Wind Well        a round well with a column of rising wind: open your wings in it and it lifts you,
//                        round and up, to an eye and a balcony at the top
//   the Roost            the guardian (organic: you calm her): the Elder, in the roost under the open sky,
//                        a column of wind in its middle. When she spreads her wings and looks up, afraid,
//                        ride the wind beside her; she will not fly alone
// After: the Elder sits on the Aerie's crown with her wings open, and the great birds wheel over it again.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the plain west of the landing; its door looks east, back toward the landing. */
export const SITE = { x: -220, z: -20, r: 18, path: [-180, -12] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

export const PALETTE = {
  wall: '#efe6d2', wall2: '#e6dcc6', wall3: '#f4efe2', floor: '#e2cfae', floor2: '#d6c7a8', trim: '#d8a24a',
  dark: '#4a4a5e', stone: '#d9cfc0', accent: '#b98f9a', glow: '#7cc1c4', lamp: '#f6c84e', sand: '#f0dcc0', sand2: '#e3bf9c', void: '#34405e',
};

export const LOGIC = {
  id: 'arzach', entry: 'threshold', gadget: 'glider',
  rooms: { threshold: { checkpoint: true }, gusts: { checkpoint: true }, stair: { checkpoint: true }, wings: { checkpoint: true }, gulfFar: { checkpoint: true }, well: { checkpoint: true }, roost: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'gusts' },
    { a: 'gusts', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'wings' },
    { a: 'wings', b: 'gulfFar', needs: ['glider'] },        // the Gulf: thirty-four metres of nothing from the chamber's far side; glide it
    { a: 'gulfFar', b: 'well' },
    { a: 'well', b: 'roost', door: 'd3', needs: ['glider'] },   // the wind lifts only open wings
    { a: 'roost', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'gusts' },
    d1: { type: 'door', opens: { lit: 's1' }, latch: true },
    chest: { type: 'gadget', room: 'wings', item: 'glider' },
    s3: { type: 'switch', room: 'well', needs: ['glider'] },   // high in the well, over its balcony
    d3: { type: 'door', opens: { lit: 's3' }, latch: true },
    elder: { type: 'boss', room: 'roost', needs: ['backpack', 'glider'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const ELDER = {
  kind: 'organic', name: 'the Elder', final: 'touch', touch: 'lay a hand on her neck',
  speed: 1.6, wakeTime: 3.2,
  wake: 'In the roost something heavy shifts: a great bird of stone-white feathers unfolds from the floor, and sees you, and hisses.',
  openHint: 'She spreads her wings and looks up at the open sky, trembling, and does not go.',
  weary: 'She folds her wings and settles, the glyphs on them bright with the wind. Go to her.',
  resolved: 'The Elder stretches her neck to you, then opens her wings wide, and rides the wind up out of the roost.',
  phases: [
    { to: 0.45, attacks: ['buffet', 'stamp'], pause: 1.5, hint: 'When she spreads her wings and looks up, afraid, ride the wind beside her: open your wings near her.' },
    { to: 0.9, attacks: ['dive', 'buffet'], pause: 1.3, hint: 'She has left the floor, beating hard. When she hangs in the air, fly with her again.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    buffet: { shape: 'cone', range: 11, angle: 0.8, telegraph: 1.4, damage: 0.18, knock: 13, recover: 0.7 },
    stamp: { shape: 'ring', at: 'self', radius: 7, telegraph: 1.5, damage: 0.2, knock: 10, recover: 0.8, open: 4.2 },
    dive: { shape: 'ring', at: 'player', radius: 4, telegraph: 1.7, track: 0.55, damage: 0.2, knock: 9, recover: 0.9, open: 4.2 },
  },
};

function elderHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.04, 'push'); g.rt.notice('She flinches from the shove and hisses, more frightened.', 'elder.push'); return true; }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  g.rt.notice('The fluid beads on her stone feathers. It is not water she wants: it is the wind.', 'elder.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  /** A stone feather: a long flat blade, its quill at p, leaning out. */
  const feather = (mat, x, y, z, len, yaw, tilt) => K.add(mat, T(new THREE.SphereGeometry(1, 10, 6).scale(0.9, len / 2, 0.22).translate(0, len / 2, 0), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Hall of Winds (z 12.6..52): gusts down it; stone screens to wait behind
  K.hall({ x: 0, z: 32.3, w: 16, d: 39.4, y: 0, h: 12, roof: true, columns: 0, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }] });
  const shelters = [];
  for (const [i, z] of [22, 31, 40].entries()) {
    for (const x of [-4.2, 4.2]) {
      K.both(M.wallGlyph, box(3.4, 7, 1.0, x, 3.5, z));
      K.add(M.trim, box(3.6, 0.4, 1.2, x, 7.2, z));
      shelters.push([[x - 1.5, -1, z - 2.6], [x + 1.5, 9, z - 0.45]]);
    }
    if (i < 2) for (const x of [-7.2, 7.2]) feather(M.trim, x, 0, z + 4.5, 7, 0, 0);
  }
  add(Gust, { min: [-8, -1, 13], max: [8, 12, 51.6], dir: [0, 0, -1], shelters, calm: 3.2, blow: 2.2, warn: 0.8, push: 7.5 });
  add(Switch, { id: 's1', at: [6.9, 2.6, 49.8], yaw: -Math.PI / 2, size: 0.9 });
  add(Door, { id: 'd1', at: [0, 0, 52.6], w: 5, h: 6.4, lamps: [{ lit: 's1' }] });
  add(Mark, { room: 'gusts', at: [-6, 0, 16], yaw: Math.PI / 2 });

  // ---- the Feather Stair (a rotunda, floor 0): a wall to climb, then a disc that rides up to the landing at 18
  K.slab(-3.2, 52, 3.2, 54.6, 0, 0.8);
  K.wall(-3.2, 52.6, -3.2, 54.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 54.6, 3.2, 52.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 53.6));
  const C2 = 65.2;
  K.rotunda({ x: 0, z: C2, y: 0, r: 10, h: 30, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6, y0: 18 }], oculus: 0.3 });
  K.both(M.wallGlyph, box(20, 9, 6.4, 0, 4.5, C2 + 6.2));     // the wall to climb, its top at 9
  add(Platform, { path: [[0, 9, C2 + 6], [0, 18, C2 + 6]], r: 2.2, speed: 1.5, pause: 2 });
  K.slab(-3.2, C2 + 8.3, 3.2, C2 + 10.6, 18, 0.6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; if (Math.abs(Math.sin(a)) > 0.3) feather(M.trim, Math.sin(a) * 9.2, 0, C2 + Math.cos(a) * 9.2, 9 + (i % 2) * 3, a + Math.PI, 0.15); }
  add(Mark, { room: 'stair', at: [-6, 0, C2 - 6], yaw: Math.PI * 0.75 });

  // ---- the corridor and the Wing Chamber (floor 18): the chest; its far side opens on the Gulf
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 18, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 18, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 18, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 24.8, C2 + 11.6));
  const C3 = C2 + 22.6;    // 87.8
  K.rotunda({ x: 0, z: C3, y: 18, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 6, h: 7 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 18, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 18.31, C3));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) feather(M.wall, s * (6.5 - i * 0.4), 18, C3 - 2 + i * 2.2, 6 + i, s * 0.4, s * 0.25);
  add(Mark, { room: 'wings', at: [6, 18, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Gulf (z 98.7..150.7): from the ledge at 18 across thirty-four metres of nothing to a ledge at 9
  const G0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, G0 + 0.6, 18, 0.8);
  K.hall({ x: 0, z: G0 + 26, w: 22, d: 52, y: -12, h: 44, floor: false, roof: true, doors: [{ side: 's', w: 6, h: 7, y0: 30 }, { side: 'n', w: 5, h: 6.4, y0: 21 }] });
  K.slab(-11, G0, 11, G0 + 6, 18, 30);
  K.slab(-11, G0 + 40, 11, G0 + 52, 9, 21);
  K.both(M.dark, box(22, 1, 34, 0, -12.5, G0 + 23));
  add(Pit, { room: 'gulf', min: [-12, -14, G0 + 6], max: [12, 6, G0 + 40] });
  K.add(M.trim, box(22, 0.5, 1.4, 0, 17.8, G0 + 6.4));
  for (let i = 0; i < 5; i++) feather(M.trim, (i - 2) * 4.2, 30, G0 + 23, 10, 0, Math.PI);   // stone feathers hanging over the gulf
  add(Mark, { room: 'gulf', at: [-7, 18, G0 + 3], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [7, 9, G0 + 47], yaw: Math.PI });

  // ---- the Wind Well (floor 9): a column of rising wind to a balcony at 30
  const W0 = G0 + 52;
  K.slab(-3.2, W0 - 0.6, 3.2, W0 + 3.4, 9, 0.8);
  K.wall(-3.2, W0 + 0.2, -3.2, W0 + 3.4, 9, 6.4, { t: 0.8 }); K.wall(3.2, W0 + 3.4, 3.2, W0 + 0.2, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 15.8, W0 + 1.6));
  const C4 = W0 + 12.5;
  K.rotunda({ x: 0, z: C4, y: 9, r: 9.5, h: 31, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4, y0: 21 }], oculus: 0.4 });
  add(Updraft, { at: [0, 9, C4], r: 4.5, h: 25, lift: 7 });
  K.slab(-4, C4 + 4.7, 4, C4 + 10, 30, 0.8);                    // the balcony
  K.add(M.trim, box(8.2, 0.4, 0.4, 0, 30.2, C4 + 4.8));
  add(Switch, { id: 's3', at: [0, 38, C4 + 9.0], yaw: Math.PI, size: 1.0 });
  add(Door, { id: 'd3', at: [0, 30, C4 + 10.2], w: 5, h: 6.4, lamps: [{ lit: 's3' }] });
  add(Mark, { room: 'well', at: [6, 9, C4 - 5], yaw: -Math.PI * 0.75 });
  add(Mark, { room: 'ante', at: [-2.6, 30, C4 + 7.4], yaw: Math.PI / 2 });

  // ---- the corridor, and the Roost (floor 30): a round hall under the open sky, a column of wind in it
  K.slab(-3.2, C4 + 9.6, 3.2, C4 + 13.4, 30, 0.8);
  K.wall(-3.2, C4 + 10.6, -3.2, C4 + 13.4, 30, 7, { t: 0.8 }); K.wall(3.2, C4 + 13.4, 3.2, C4 + 10.6, 30, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 37.4, C4 + 11.6));
  const HR = 19, CL = C4 + 13.2 + HR + 0.2;
  K.rotunda({ x: 0, z: CL, y: 30, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.6 });
  add(Updraft, { at: [0, 30, CL], r: 4.5, h: 16, lift: 6, hint: 'The wind rushes up the roost’s middle. Open your wings in it.' });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > Math.PI - 0.4) continue; feather(M.trim, Math.sin(a) * (HR - 0.8), 30, CL + Math.cos(a) * (HR - 0.8), 14, a + Math.PI, 0.2); }
  add(Door, { id: 'd5', at: [0, 30, CL + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CL + HR + 0.6, 3.2, CL + HR + 10, 30, 0.8);
  K.wall(-3.2, CL + HR + 1.4, -3.2, CL + HR + 10, 30, 7, { t: 0.8 }); K.wall(3.2, CL + HR + 10, 3.2, CL + HR + 1.4, 30, 7, { t: 0.8 });
  K.wall(3.2, CL + HR + 10, -3.2, CL + HR + 10, 30, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 37.4, CL + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 30, CL + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, 32.5, CL + HR + 10.9));

  const model = elderModel();
  model.pos.copy(K.world(0, 30, CL + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 30, CL + 5);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 30, CL), r: HR, y: K.world(0, 30, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -16, -3), V(24, 62, CL + HR + 12)),
    gadget: { at: W(0, 18.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 30.5, CL + HR + 9.6), r: 1.5 }],
    lights: [[0, 5, 6, 10], [0, 6, 32, 14], [0, 10, C2, 12], [0, 22, C3, 10], [0, 16, G0 + 26, 16], [0, 20, C4, 14], [0, 36, CL, 18]],
    guardian: { def: { ...ELDER, onHit: elderHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Aerie on the plain
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 14;
  const base = level.ground.baseAt(SITE.x, SITE.z, SITE.r + 6) - 0.6;
  const K = new TempleKit(rt.root, 'The Aerie', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 4;
  const glyphM = makeMaterial({ color: PALETTE.glow, glow: 0.2, flat: true, key: 'temple.vael.glyph' });
  // a broad plinth, a great drum, a narrower drum on it, bands of ochre between
  K.both(M.floor, new THREE.CylinderGeometry(R + 7, R + 8, sill, 40).translate(0, sill / 2, 0));
  K.both(M.wall, new THREE.CylinderGeometry(R, R + 0.6, 18, 32).translate(0, sill + 9, 0));
  K.add(M.trim, new THREE.CylinderGeometry(R + 0.35, R + 0.35, 0.8, 32).translate(0, sill + 18, 0));
  K.both(M.wall, new THREE.CylinderGeometry(R - 4.5, R - 4, 12, 28).translate(0, sill + 24.4, 0));
  K.both(M.floor, T(annulus(R - 4.5, R + 0.3, 0.6, 32), [0, sill + 18.6, 0]));
  K.add(M.trim, new THREE.CylinderGeometry(R - 4.2, R - 4.2, 0.7, 28).translate(0, sill + 30.4, 0));
  K.both(M.floor, new THREE.CylinderGeometry(R - 4.5, R - 4.5, 0.6, 28).translate(0, sill + 30.7, 0));
  // the crown: tall stone feathers round the top, leaning out, and the perch in its middle
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, len = 16 + (i % 3) * 3;
    K.add(i % 3 === 1 ? M.trim : M.wall, T(new THREE.SphereGeometry(1, 10, 6).scale(1.5, len / 2, 0.35).translate(0, len / 2, 0), [Math.sin(a) * (R - 5.5), sill + 30.6, Math.cos(a) * (R - 5.5)], [0.42, a, 0], 1, 'YXZ'));
  }
  K.both(M.trim, new THREE.CylinderGeometry(1.2, 1.6, 6, 10).translate(0, sill + 34, 0));
  K.both(M.floor, new THREE.CylinderGeometry(3.4, 3, 0.8, 16).translate(0, sill + 37.4, 0));
  // glyph lines on the drum, like the lines on a wing
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; K.add(glyphM, T(new THREE.BoxGeometry(0.25, 12, 0.2), [Math.sin(a) * (R + 0.35), sill + 9, Math.cos(a) * (R + 0.35)], [0, a, 0])); }
  // the doorway: a tall porch out of the drum, the glyph over it
  const z0 = R - 1.5, z1 = R + 3.4;
  for (const s of [-1, 1]) K.both(M.wall, box(3.2, 10, z1 - z0, s * 4.1, sill + 5, (z0 + z1) / 2));
  K.both(M.wall, box(11.4, 3, z1 - z0, 0, sill + 8.6, (z0 + z1) / 2));
  K.add({ paint: new THREE.Color(PALETTE.accent), smooth: false, side: THREE.FrontSide }, box(12, 0.8, 1.2, 0, sill + 10.5, z1 + 0.1));
  K.add(M.glyph, T(glyphGeometry(2.4, 0.15), [0, sill + 8.6, z1 + 0.06]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(5, 7).translate(0, 3.5, 0), [0, sill, R + 0.4]));
  K.solid(box(5, 7, 0.6, 0, sill + 3.5, R + 0.1));
  // the great steps down to the plain
  const foot = level.ground.heightAt(...(() => { const p = K.world(0, 0, R + 16); return [p.x, p.z]; })()) - base;
  K.stairs([0, sill, R + 7.2], [0, Math.max(0.2, foot), R + 16], 9, { rise: 0.4 });
  K.flush();
  const at = K.world(0, sill, R + 1.4);
  return { door: { at, heading: yaw }, kit: K, base, R, sill, glyphM, perch: K.world(0, sill + 37.8, 0), clear: [{ x: SITE.x, z: SITE.z, r: R + 12 }] };
}

// ------------------------------------------------------------------ the world change: the birds come back
/**
 * Once the Elder flies again the Aerie is a roost once more: she sits on its crown with her wings open,
 * the glyph lines on its drum glow, and a flock of the great birds wheels over it, high and slow.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Aerie’s birds (the world change)';
  rt.root.add(root);
  root.visible = false;
  // the Elder on the crown
  const perched = O ? elderModel() : null;
  if (perched) {
    perched.pos.copy(O.perch);
    perched.heading = SITE.heading;
    perched.group.position.copy(perched.pos);
    perched.group.rotation.y = perched.heading;
    root.add(perched.group);
  }
  // the flock: great white birds, soaring (a body, two long wings, a beak)
  const birdM = makeMaterial({ color: '#f4efe2', flat: true, key: 'temple.vael.bird' });
  const g = mergeGeometries([
    new THREE.SphereGeometry(1, 8, 6).scale(0.9, 0.7, 2.2),
    new THREE.SphereGeometry(1, 8, 4).scale(5.2, 0.12, 1.3).translate(4.6, 0.25, -0.2).rotateZ(0.12),
    new THREE.SphereGeometry(1, 8, 4).scale(5.2, 0.12, 1.3).translate(-4.6, 0.25, -0.2).rotateZ(-0.12),
    new THREE.ConeGeometry(0.25, 2.2, 6).rotateX(Math.PI / 2).translate(0, 0.2, 3.1),
  ].map((x) => x.toNonIndexed()));
  const flock = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(g, birdM);
    m.userData.noCollide = true; m.userData.dynamic = true;
    root.add(m);
    flock.push({ m, r: 38 + (i % 4) * 11, y: 58 + (i % 3) * 12, w: (0.11 + (i % 3) * 0.025) * (i % 2 ? 1 : -1), a: (i / 8) * TAU });
  }
  let k = 0, want = 0;
  const apply = () => { root.visible = k > 0.01; };
  return {
    root, flock, perched,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 4 : -dt / 2), 0, 1); apply(); }
      if (O) O.glyphM.uniforms.uGlow.value = 0.2 + 0.7 * k;
      if (!root.visible) return;
      const base = O ? O.base : 0;
      for (const b of flock) {
        b.a += b.w * dt;
        const x = SITE.x + Math.sin(b.a) * b.r, z = SITE.z + Math.cos(b.a) * b.r, y = base + b.y + Math.sin(t * 0.3 + b.a * 2) * 4;
        b.m.position.set(x, y, z);
        b.m.rotation.set(0, b.a + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2), (b.w > 0 ? -0.35 : 0.35), 'YXZ');
      }
      perched?.animate(dt, t, { state: 'resolved', attack: null, k: 0, meter: 1, phase: 0 });
    },
  };
}

export const ARZACH_TEMPLE = {
  id: 'arzach', levelId: 'arzach', name: 'The Aerie', doorLabel: 'door of the Aerie',
  gadget: 'glider', gadgetBox: 'arzach.temple.glider', arenaDoor: 'd3',
  origin: [-200, 1600, 300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'lark', out: 16, side: 7 },
  enterLine: 'Inside the Aerie it is bright and white and the wind never stops. Far overhead, something heavy shifts its feathers.',
  pitLine: 'You climb back up to the last glyph stone.',
  // the wings come first: Vael's tower is climbed on the wind with them, so the quest starts when you land without them
  startsOnArrival: () => !items.has('glider'),
  arrivalLine: 'The makers left a pair of wings in Vael: in the Aerie, the white house on the plain west of the landing.',
  onResolved(rt) { rt.notice('Out over the plain the great birds are coming back to the Aerie.', 'resolved.out'); },
  // she will not fly alone: ride the wind beside her while she looks up, afraid
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    let flown = 0;
    const upd = G.update.bind(G), _c = V();
    G.update = (dt, t) => {
      upd(dt, t);
      const P = rt.player;
      if (!P || G.state !== 'open') { flown = 0; return; }
      _c.copy(G.model.pos).add(V(0, 4.4, 0));
      const near = P.pos.distanceTo(_c) < 10;
      if (near && P.gliding) {
        if ((flown += dt) > 0.7) {
          flown = 0;
          G.add(0.15, 'wind');
          rt.sound?.chime?.();
          rt.notice('She watches you ride the wind beside her, and her wings lift.', `elder.flown.${G.phaseIndex}`);
          if (G.state === 'open') { G.enter('fight'); G.cool = 2.2; }
        }
      } else {
        if (near && P.onGround) rt.notice('She will not go alone. Take to the air beside her.', 'elder.alone');
        flown = Math.max(0, flown - dt);
      }
    };
  },
};
