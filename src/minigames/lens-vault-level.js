// The Lens Vault's rooms (issue #382; the table in lens-vault-rules.js): a makers' vault of the temples' own kit
// (src/temples/kit.js: halls with doorways, a round hall under an oculus, columns, the shared glyph frieze), ancient
// high tech, never organic: pale panelled stone banded in the makers' steel blue, lit teal inlays. Three doors (movers:
// they rise into their lintels as they open), a lamp, the eye-lock beside the sealed door, a painted wall in the Press,
// the press blocks and the round hall's dais and posts to fight round. Everything a lens reads is listed with its point.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { Terrain } from '../world.js';
import { TempleKit, templeMaterials, box } from '../temples/kit.js';
import { arenaLevel } from './kit/world.js';
import { ROOMS, DOORS, PASSAGES, START, LENS } from './lens-vault-rules.js';

/** The vault's palette: the makers' cream panels, steel-blue courses, teal light (as the City-Shaft's Warden's Well). */
export const VAULT = {
  wall: '#ece3cf', wall2: '#e3d8c0', wall3: '#f3ecdc', floor: '#dcd2bb', floor2: '#cfc3a8', trim: '#eee6d3',
  dark: '#34405e', stone: '#7d93c4', accent: '#3f5a9e', glow: '#71d7cf', glyph: '#71d7cf', sand: '#cdb38e', sand2: '#c9b596',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.9, shade: 0.45 },
    wall: { mode: 0, grid: 3.6, plates: true },
    floor: { mode: 0, grid: 2.4, plates: true },
    glyph: { glow: 0.55 },
  },
  bands: [{ at: 0.7, h: 0.9, color: '#7d93c4' }, { y: 0.35, h: 0.5, color: '#6f86ba' }],
  ornament: { kind: 'slot', color: '#9fe8e0', color2: '#71d7cf', glow: 0.7 },
  light: { shadow: '#b9b8d6', light: '#fff2dc', sun: '#fff0d0' },
};
/** The doors' colours: their rings say what opens them (teal any shot, gold a charged one, coral read the lock). */
export const RING = { shot: '#71d7cf', charge: '#f2c54b', sealed: '#ef7e62' };

/** A door: a slab of the makers' dark stone across the doorway, a lit ring on each face, a bar over the sealed one. */
export function doorModel(D) {
  const g = new THREE.Group();
  const slab = makeMaterial({ color: VAULT.dark, color2: '#2c3650', flat: true, key: 'lensvault.door' });
  const ring = makeMaterial({ color: RING[D.kind], flat: true, glow: 0.85, key: `lensvault.ring.${D.kind}` });
  const trim = makeMaterial({ color: '#7d93c4', flat: true, key: 'lensvault.doortrim' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(D.w - 0.04, D.h - 0.02, 0.5).translate(0, (D.h - 0.02) / 2, 0), slab);
  g.add(body);
  const lit = [];
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(D.kind === 'charge' ? 0.95 : 0.8, 0.09, 6, 32), ring);
    r.position.set(0, D.h * 0.55, s * 0.27); g.add(r); lit.push(r);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), ring);
    core.position.set(0, D.h * 0.55, s * 0.265); if (s < 0) core.rotation.y = Math.PI; g.add(core); lit.push(core);
    if (D.kind === 'charge') { const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 5, 28), ring); r2.position.set(0, D.h * 0.55, s * 0.27); g.add(r2); lit.push(r2); }
    if (D.kind === 'sealed') { const bar = new THREE.Mesh(new THREE.BoxGeometry(D.w * 0.8, 0.24, 0.08), trim); bar.position.set(0, D.h * 0.55, s * 0.3); g.add(bar); lit.push(bar); }
    // (the panel lines: two steel-blue strips down each face)
    for (const x of [-D.w * 0.32, D.w * 0.32]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, D.h - 0.5, 0.03), trim); st.position.set(x, D.h / 2, s * 0.262); g.add(st); }
  }
  g.position.set(D.x, 0, D.z);
  g.traverse((o) => { o.userData.noCollide = true; });   // (out of the bake: the session adds it as a mover)
  g.userData.lit = lit;
  return g;
}

/** The standing lamp of the Lens Room: a column with a lit glass on it. */
function lampModel(K, x, z) {
  K.column(x, z, 0, 1.4, 0.18, { mat: K.M.stoneMat });
  const glass = makeMaterial({ color: '#e8fbf6', flat: true, glow: 0.9, key: 'lensvault.lamp' });
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glass);
  m.position.set(x, 1.85, z); m.scale.set(1, 1.4, 1); m.userData.noCollide = true;
  return m;
}

/** The eye-lock beside the sealed door: a short post, an iris of steel round a coral eye (teal once read). */
function lockModel(K, x, z) {
  K.both(K.M.stoneMat, box(0.9, 1.3, 0.7, x, 0.65, z));
  const g = new THREE.Group();
  const eye = makeMaterial({ color: RING.sealed, flat: true, glow: 0.9, key: 'lensvault.eye' });
  const steel = makeMaterial({ color: '#7d93c4', flat: true, key: 'lensvault.iris' });
  const iris = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 6, 24), steel);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), eye);
  g.add(iris, ball);
  g.position.set(x, 1.7, z - 0.1); g.rotation.y = Math.PI;
  g.traverse((o) => { o.userData.noCollide = true; });
  return Object.assign(g, { eye, ball });
}

/** The Press's painted wall: a panel of teal and cream, two figures whose arms are water, inked by the post pass. */
function muralModel(x, y, z) {
  const g = new THREE.Group();
  const paint = (c, glow = 0) => makeMaterial({ color: c, flat: true, ...(glow ? { glow } : {}), key: `lensvault.mural.${c}` });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 4.2), paint('#f3e6c8'));
  g.add(panel);
  const ink = paint('#3f5a9e'), water = paint('#71d7cf', 0.4);
  for (const s of [-1, 1]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.3, 0.5), ink); body.position.set(0.03, -0.35, s * 1.0); g.add(body);
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.24, 14), ink); head.rotation.y = Math.PI / 2; head.position.set(0.05, 0.55, s * 1.0); g.add(head);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 1.3), water); arm.position.set(0.05, 0.05, s * 0.4); arm.rotation.x = s * 0.35; g.add(arm);
  }
  const drop = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), water); drop.rotation.y = Math.PI / 2; drop.position.set(0.06, 0.25, 0); g.add(drop);
  g.position.set(x, y, z);
  g.traverse((o) => { o.userData.noCollide = true; });
  return g;
}

/**
 * The vault's level (a minigame's build: yield between the big steps). `level.vault`: { doors: [{ def, group }],
 * lock (the eye-lock's model), points (each lens thing's point), rooms }.
 */
export function* buildVault(scene) {
  // (the ground far under the floors: nothing of it is seen, the floors are the kit's slabs)
  const terrain = yield* Terrain.make({ size: 220, seg: 22, height: () => -3, material: { color: '#cdb38e', color2: '#c9b596', color3: '#b89f7c' } });
  scene.add(terrain.mesh);
  yield;
  const root = new THREE.Group(); root.name = 'The Lens Vault';
  const M = templeMaterials(VAULT);
  const K = new TempleKit(root, 'The Lens Vault', new THREE.Vector3(0, 0, 0), 0, M);
  K.noClimb = true;
  const doorOn = (ri, side) => DOORS.filter((d) => (side === 'n' ? d.from === ri : d.to === ri)).map((d) => ({ side, at: d.x, w: d.w, h: d.h }));
  for (const [i, R] of ROOMS.entries()) {
    if (R.round) {
      K.rotunda({ x: R.x, z: R.z, r: R.r, h: R.h, gaps: [{ a: Math.PI, w: 4.4, h: 4.6 }], oculus: 0.34 });
      continue;
    }
    // (the side 'n' of a hall is its +z wall: deeper in; its 's' the way it is entered)
    K.hall({ x: R.x, z: R.z, w: R.w, d: R.d, h: R.h, doors: [...doorOn(i, 'n'), ...doorOn(i, 's')], roof: 'oculus', oculus: 0.3, columns: R.id === 'gallery' ? 3 : 0 });
  }
  for (const [z0, z1] of PASSAGES) K.corridor([0, z0], [0, z1], 0, { w: 4.4, h: 5.2 });
  yield;
  // the Lens Room: the lamp, the makers' mark over the ringed door, a low bench of panels to look round
  const lamp = lampModel(K, LENS.lamp.at[0], LENS.lamp.at[2]);
  K.glyph([LENS.mark.at[0], LENS.mark.at[1], 12 - 0.03], 1.4, Math.PI);
  K.both(M.stoneMat, box(3.2, 0.5, 1.0, 3.6, 0.25, 6));
  // the Long Gallery: the eye-lock beside the sealed door, low plinths between the columns
  const lock = lockModel(K, LENS.lock.at[0], LENS.lock.at[2] + 0.2);
  for (const [x, z] of [[-3.5, 24], [3.5, 31]]) K.both(M.stoneMat, box(1.6, 1.1, 1.6, x, 0.55, z));
  // the Press: two great press blocks to hide behind, the painted wall
  for (const [x, z] of [[-3.6, 54.5], [3.6, 54.5]]) { K.both(M.stoneMat, box(2.4, 2.2, 2.4, x, 1.1, z)); K.both(M.trim, box(2.8, 0.3, 2.8, x, 2.35, z)); }
  const mural = muralModel(LENS.mural.at[0], LENS.mural.at[1], LENS.mural.at[2]);
  // the Round Hall: a low dais in the middle, four short posts to fight round
  const RH = ROOMS[3];
  K.both(M.stoneMat, new THREE.CylinderGeometry(3.4, 3.6, 0.4, 24).translate(RH.x, 0.2, RH.z));
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; K.column(RH.x + Math.sin(a) * 7.5, RH.z + Math.cos(a) * 7.5, 0, 2.4, 0.55, { mat: M.stoneMat }); }
  K.flush();
  root.add(lamp, lock, mural);
  const doors = DOORS.map((def) => { const group = doorModel(def); root.add(group); return { def, group }; });
  scene.add(root);
  yield;
  return arenaLevel({
    ground: terrain, name: 'The Lens Vault', hour: 12.4, spawn: new THREE.Vector3(START.x, 0, START.z),
    features: { mount: false, wind: false, jetpack: false, climb: false },
    foes: { own: true, wild: false, noInk: true, chimes: false },   // (src/foes.js: the game's own, no ink for the blade, no chimes)
    vault: { doors, lock, rooms: ROOMS },
  });
}
