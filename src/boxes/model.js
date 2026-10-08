import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { TANK, FLUID_TONES, buildFlask } from '../fluid-tool.js';
import { ITEMS } from '../items.js';

// What an item box looks like, and what comes out of it. All of it is inked
// geometry through makeMaterial (the post pass draws the lines).
//
// The boxes are the makers' (docs/story-bible.md, "The boxes"): very old,
// handled by many, never broken. One smooth dark blue shell with no edges
// (a rounded box: no corner, no seam, no lid), the pale four-point star of the
// reference drawing painted on its top and a compass (a ring round a small star) on each side,
// and a thin ray of light forever travelling across its surface (materials.js
// MAKERS_BOX). The post pass draws its outline only: nothing inside it.
//
//   buildBox(key)    → { root, shell, mats: { body }, size }
//                      a box about knee high at BOX's size; index.js sets it down
//                      BOX_SCALE larger (about hip high). Local frame: +z is the front
//                      (where the traveller stands), y = 0 on the ground.
//                      mats.body.uniforms.uBoxA: x the ray's strength, y the marks' glow, w the ray's clock
//                      (one pass per unit: index.js and scene.js wind it)
//   roundedBox(hx, hy, hz, r, n) → the shell's geometry (smooth normals all round), centred
//   buildItemModel(id) → a small Group (≈ 0.3 m) for the hovering display
//   buildSparkles()  → twinkling specks round the hovering item
//   buildBeacon(key) → a thin pale column of light over an unopened box (seen from afar)

/** The box's size (unscaled, m): w across, h tall (lid: none, kept for the scene's arithmetic), d deep, r its corners' roundness. */
export const BOX = { w: 0.66, h: 0.54, d: 0.58, lid: 0, r: 0.15 };
/** The boxes are built at BOX's size and set down this much larger: big enough to notice from afar. */
export const BOX_SCALE = 1.9;
/** The item hovering where its box was. */
export const ITEM_SCALE = 1.8;
export const BOX_COLORS = { body: '#25386c', star: '#dcecf2', carve: '#9fbfdc', seam: '#fff4d6', light: '#fffbea' };
/** The ray's rhythm: seconds a pass takes far off, and close up (it quickens as you come near). */
export const RAY_PASS = { far: 4.2, near: 2.6 };

const one = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; }); return o; };

/** The pale star: four long points with concave sides (as on the reference lid). */
export function starShape(R = 1, r = 0.3, points = 4) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

/**
 * A box with no edges: a cube's subdivided faces pushed out onto a rounded box
 * (flat in the middle of each face, each corner and edge a quarter round of
 * radius r), its normals exact, so nothing on it reads as a crease. Centred on the origin.
 */
export function roundedBox(hx, hy, hz, r, n = 10) {
  r = Math.min(r, hx, hy, hz);
  const g = new THREE.BoxGeometry(2, 2, 2, n, n, n);
  const p = g.attributes.position, nr = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const ix = hx - r, iy = hy - r, iz = hz - r;
  for (let i = 0; i < p.count; i++) {
    // (a cube grid squeezed toward the corners first, so the rounds get as many rows as the flats)
    const q = (t) => Math.sign(t) * (1 - Math.pow(1 - Math.abs(t), 1.6));
    v.set(q(p.getX(i)) * hx, q(p.getY(i)) * hy, q(p.getZ(i)) * hz);
    c.set(THREE.MathUtils.clamp(v.x, -ix, ix), THREE.MathUtils.clamp(v.y, -iy, iy), THREE.MathUtils.clamp(v.z, -iz, iz));
    d.subVectors(v, c);
    if (d.lengthSq() < 1e-12) d.set(0, 1, 0);
    d.normalize();
    p.setXYZ(i, c.x + d.x * r, c.y + d.y * r, c.z + d.z * r);
    nr.setXYZ(i, d.x, d.y, d.z);
  }
  // (the six faces share their border vertices' positions and normals: one closed, smooth shell)
  g.deleteAttribute('uv');
  return mergeVertices(g);
}

export function buildBox(key = 'box') {
  const { w, h, d, r } = BOX, C = BOX_COLORS, S = BOX_SCALE;
  // its own material (the key makes it unique, so each box glows and sweeps on its own); it
  // dissolves when it opens (src/boxes/scene.js sets uDissolve)
  const body = makeMaterial({
    color: C.body, key: `box.body.${key}`, dissolve: C.seam,
    makersBox: { half: [(w / 2) * S, (h / 2) * S, (d / 2) * S], center: (h / 2) * S, mark: C.star, light: C.light, ray: 0.6, glow: 0.35 },
  });
  const root = new THREE.Group();
  root.name = `Item box ${key}`;
  const shell = new THREE.Mesh(roundedBox(w / 2, h / 2, d / 2, r).translate(0, h / 2, 0), body);
  shell.name = 'Makers’ box';
  root.add(shell);
  noCollide(root);
  return { root, shell, mats: { body }, size: { w, h, d } };
}

export function buildSparkles(n = 14) {
  const g = new THREE.Group();
  const mat = makeMaterial({ color: '#fff8e0', flat: true, glow: 1 });
  const geo = new THREE.OctahedronGeometry(0.018, 0);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.userData = { a: (i / n) * Math.PI * 2, r: 0.2 + (i % 3) * 0.06, y: ((i * 37) % 11) / 11 - 0.5, sp: 0.6 + (i % 4) * 0.25, ph: i * 1.7 };
    g.add(m);
  }
  noCollide(g);
  return g;
}

export function buildBeacon(key = 'beacon') {
  const mat = makeMaterial({ color: '#f4f8ff', flat: true, glow: 1, key: `box.beacon.${key}` });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1, 6, 1, true).translate(0, 0.5, 0), mat);
  m.scale.set(1, 36, 1);
  m.position.y = 0.6;
  m.name = 'Box beacon';
  noCollide(m);
  return m;
}

// ------------------------------------------------------------------ the items, small
const BRASS = '#d6a94a', BRASS_DARK = '#9c7330', STEEL = '#6f7a86', INK = '#2b211f', IVORY = '#efe6cf', COPPER = '#c56a3c';
// the brass, steel and copper parts are metal (materials.js METALS); lit parts stay lights
const METAL_OF = { [BRASS]: 'brass', [BRASS_DARK]: 'brass', [STEEL]: 'steel', [COPPER]: 'copper' };
const flatM = (color, o = {}) => makeMaterial({ color, flat: true, ...(METAL_OF[color] && !o.glow ? { metal: METAL_OF[color] } : {}), ...o });

function tankModel() {
  // the flask as it is worn (fluid-tool.js buildFlask), in its own fluid material (not the worn tank's: the box animates its time)
  const R = TANK.profile.reduce((m, [r]) => Math.max(m, r), 0);
  const { group: g, glass } = buildFlask(makeMaterial({ color: '#ffffff', fluid: 'tank', glow: 0.6, fluidBox: [0, TANK.full, R, TANK.highlight], fluidTones: FLUID_TONES, fluidBase: TANK.base, key: 'box.item.tank' }), { worn: false });
  glass.userData.fluid = true;
  g.position.y = -0.22;
  const w = new THREE.Group(); w.add(g); w.scale.setScalar(0.7);
  return w;
}

function jetsModel() {
  const g = new THREE.Group();
  const brass = flatM(BRASS), dark = flatM(BRASS_DARK), hot = flatM('#ff9a4a', { glow: 0.9 });
  for (const sx of [-1, 1]) {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 14).translate(sx * 0.09, 0.04, 0), brass));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.09, 14, 1, true).translate(sx * 0.09, -0.08, 0), flatM(BRASS_DARK, { side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 12).translate(sx * 0.09, -0.11, 0), hot));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 14).rotateX(Math.PI / 2).translate(sx * 0.09, 0.1, 0), dark));
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.06).translate(0, 0.13, 0), flatM(STEEL)));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.04).translate(0, 0.17, -0.02), dark));
  return g;
}

function wingsModel() {
  const g = new THREE.Group();
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0); leaf.bezierCurveTo(0.06, 0.1, 0.1, 0.26, 0.03, 0.36); leaf.bezierCurveTo(-0.02, 0.24, -0.03, 0.1, 0, 0);
  const tones = [FLUID_TONES[0], FLUID_TONES[1], '#cfeef0'];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(leaf, { depth: 0.012, bevelEnabled: false }), flatM(tones[i], { glow: 0.45, side: THREE.DoubleSide }));
      m.position.set(sx * 0.02, -0.16, -0.01 + i * 0.016);
      m.rotation.set(0, sx < 0 ? Math.PI : 0, -sx * (0.25 + i * 0.28));
      g.add(m);
    }
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10).rotateZ(Math.PI / 2).translate(0, -0.16, 0), flatM(BRASS)));
  return g;
}

function lensModel(color = '#bfe8f2', { glyph = false, ice = false } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 28).rotateX(Math.PI / 2), flatM(color, { glow: 0.55 })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 6, 28), flatM(BRASS)));
  if (ice) {
    // frost ticks across the glass
    const ticks = [];
    for (let i = 0; i < 6; i++) ticks.push(new THREE.BoxGeometry(0.17, 0.008, 0.004).rotateZ((i / 6) * Math.PI).translate(0, 0, 0.015));
    g.add(new THREE.Mesh(one(ticks), flatM('#f6fdff', { glow: 0.8 })));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03).translate(0, -0.14, 0), flatM(BRASS_DARK)));   // the clip for the nozzle
  }
  if (glyph) {
    // the recurring glyph: three dots over an arc
    for (const x of [-0.04, 0, 0.04]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6).translate(x, 0.035, 0.016), flatM(INK)));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 4, 16, Math.PI).rotateZ(Math.PI).translate(0, 0.0, 0.016), flatM(INK)));
  }
  return g;
}

function flintModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 24), flatM(BRASS)));
  g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.045, 0).scale(1, 0.8, 0.7).translate(0, 0.11, 0), flatM('#3b3633')));
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0).scale(1, 1.5, 1).translate(0, 0.18, 0), flatM('#ff8a3a', { glow: 1 })));
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0).scale(1, 1.5, 1).translate(0.02, 0.215, 0), flatM('#ffd27a', { glow: 1 })));
  return g;
}

function cellModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 26, 1, true), flatM(FLUID_TONES[2], { glow: 0.6, side: THREE.DoubleSide })));
  for (const y of [-0.05, 0.05]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.012, 5, 26).rotateX(Math.PI / 2).translate(0, y, 0), flatM(BRASS)));
  g.rotation.x = 0.5;
  return g;
}

function coilModel() {
  const pts = [];
  for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 9; pts.push(new THREE.Vector3(Math.cos(a) * 0.07, -0.12 + (i / 80) * 0.24, Math.sin(a) * 0.07)); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.012, 6), flatM(COPPER)));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), flatM(STEEL)));
  return g;
}

function lanternModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10).scale(1, 1.25, 1), flatM('#e0503a', { glow: 0.75 })));
  for (const y of [-0.105, 0.105]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 12).translate(0, y, 0), flatM(INK)));
  for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.004, 3, 16).rotateX(Math.PI / 2).translate(0, -0.06 + i * 0.04, 0).scale(1, 1, 1), flatM('#8a2a20')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 3, 10).translate(0, 0.14, 0), flatM('#c8483a')));
  return g;
}

function whistleModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.26, 12).rotateZ(Math.PI / 2), flatM(IVORY)));
  for (const x of [-0.05, 0, 0.05]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5).translate(x, 0.025, 0), flatM(INK)));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).translate(0.15, -0.05, 0), flatM(BRASS, { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 3, 10).translate(0.15, -0.005, 0), flatM(BRASS_DARK)));
  return g;
}

function starModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.15, 0.05), { depth: 0.025, bevelEnabled: false }).translate(0, 0, -0.012), flatM(BOX_COLORS.star, { glow: 0.7 })));
  return g;
}

function bloomModel() {
  // a seed of green glass with a curl of root in it, on a brass clip for the nozzle
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 1.3, 1), flatM('#7fcf72', { glow: 0.55 })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 14, Math.PI * 1.5).translate(0, -0.02, 0.02), flatM('#9a7448')));
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6).scale(1, 0.35, 0.6).translate(Math.sin(i * 2.1) * 0.05, 0.14, Math.cos(i * 2.1) * 0.05), flatM('#f2a7b8', { glow: 0.4 })));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03).translate(0, -0.15, 0), flatM(BRASS_DARK)));
  return g;
}

function echoModel() {
  // a spiral shell of pale brass
  const pts = [];
  for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 4, r = 0.02 + (i / 60) * 0.1; pts.push(new THREE.Vector3(Math.cos(a) * r, (i / 60) * 0.12 - 0.06, Math.sin(a) * r)); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.03, 8), flatM(BRASS)));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 5, 22).rotateX(Math.PI / 2).translate(0, 0.07, 0), flatM(IVORY, { glow: 0.3 })));
  g.rotation.x = 0.6;
  return g;
}

function levelModel() {
  // the Major's spirit level: a brass bar, a green glass vial with a bubble
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), flatM(BRASS)));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12).rotateZ(Math.PI / 2).translate(0, 0.04, 0), flatM('#a9cf8e', { glow: 0.45 })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6).translate(0.01, 0.055, 0), flatM('#fbf7e8', { glow: 0.6 })));
  return g;
}

// ---- the charms and the pass (October 2026: until then a gold gem; the game menu shows every item's model)

function solesModel() {
  // two thin grey soles, a small glyph under each heel
  const g = new THREE.Group();
  const sole = new THREE.Shape();
  sole.moveTo(0, -0.12); sole.bezierCurveTo(0.045, -0.12, 0.05, -0.06, 0.04, 0); sole.bezierCurveTo(0.06, 0.07, 0.05, 0.13, 0, 0.13);
  sole.bezierCurveTo(-0.05, 0.13, -0.06, 0.07, -0.04, 0); sole.bezierCurveTo(-0.05, -0.06, -0.045, -0.12, 0, -0.12);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sole, { depth: 0.018, bevelEnabled: false }), flatM('#8f949a'));
    m.position.set(sx * 0.065, 0, sx * 0.01); m.rotation.z = sx * 0.12;
    g.add(m);
    for (const x of [-0.016, 0, 0.016]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5).translate(sx * 0.065 + x + sx * 0.012, -0.075, 0.02), flatM('#dcecf2', { glow: 0.7 })));
  }
  g.rotation.x = -0.35;
  return g;
}

function hushModel() {
  // a soft grey cloth, folded twice, tied with a thread
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(roundedBox(0.13 - i * 0.008, 0.018, 0.09 - i * 0.006, 0.016, 4).translate(0, i * 0.034, 0), flatM(i % 2 ? '#a9a7a2' : '#bebcb5')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.005, 4, 20).scale(1, 1.4, 1).translate(0, 0.035, 0), flatM('#c8483a')));
  g.rotation.set(0.5, 0.3, 0);
  return g;
}

function shellModel() {
  // a small white spiral shell: a lathe of a cone that winds in
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.09 * Math.sin(t * Math.PI * 0.95) * (1 - t * 0.55), -0.1 + t * 0.22)); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 18), flatM('#f3eee2')));
  for (let k = 0; k < 4; k++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.075 - k * 0.016, 0.006, 4, 18).rotateX(Math.PI / 2).translate(0, -0.05 + k * 0.04, 0), flatM('#d9c9a8')));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8).scale(1, 1.4, 0.5).translate(0, -0.06, 0.07), flatM('#e7a9a0')));
  g.rotation.z = 0.5;
  return g;
}

function mossModel() {
  // a bead of glass on a brass pin, a sprig of glowing moss inside
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), flatM('#d9f2ea', { glow: 0.35 })));
  for (let i = 0; i < 5; i++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6).translate(Math.sin(i * 1.3) * 0.025, -0.02 + (i % 3) * 0.018, Math.cos(i * 1.3) * 0.02), flatM('#9fe07a', { glow: 0.9 })));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.2, 8).translate(0, -0.15, 0), flatM(BRASS)));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14).translate(0, -0.07, 0), flatM(BRASS_DARK)));
  return g;
}

function pouchModel() {
  // a linen pouch, its neck tied, a few seeds spilt
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 0.85, 0.9), flatM('#d8c8a2')));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.06, 12).translate(0, 0.1, 0), flatM('#cdbb92')));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.05, 10, 1, true).rotateX(Math.PI).translate(0, 0.15, 0), flatM('#d8c8a2', { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.008, 4, 16).rotateX(Math.PI / 2).translate(0, 0.11, 0), flatM('#7a5a3a')));
  for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5).scale(1, 0.7, 1).translate(0.07 + i * 0.03, -0.085, 0.06 - i * 0.02), flatM('#8a6a3a')));
  return g;
}

function scarfModel() {
  // a fine white scarf in a lifting curl, the glyph woven at its end
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(-0.14 + t * 0.28, Math.sin(t * Math.PI * 1.6) * 0.06, Math.cos(t * Math.PI) * 0.04)); }
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.03, 6).scale(1, 1, 0.3), flatM('#f6f2e8'));
  band.rotation.x = 0.4;
  g.add(band);
  for (const x of [-0.02, 0, 0.02]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5).translate(0.125 + x, 0.03, 0.02), flatM(INK)));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 3, 10, Math.PI).rotateZ(Math.PI).translate(0.125, 0.012, 0.02), flatM(INK)));
  return g;
}

function reedModel() {
  // a reed, crystal-tipped, to hold between your teeth
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.26, 10).rotateZ(Math.PI / 2), flatM('#c9b27a')));
  for (const x of [-0.06, 0.02]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 3, 10).rotateY(Math.PI / 2).translate(x, 0, 0), flatM('#8a7448')));
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0).scale(1.6, 1, 1).translate(0.16, 0, 0), flatM('#bfe8f2', { glow: 0.6 })));
  g.rotation.z = 0.35;
  return g;
}

function resinModel() {
  // a small round tin, its lid off to one side, the amber resin inside
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24, 1, true), flatM(STEEL, { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.03, 24).translate(0, 0.005, 0), flatM('#e09a3a', { glow: 0.35 })));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.094, 0.016, 24).rotateX(1.1).translate(0.07, 0.06, -0.07), flatM(STEEL)));
  g.rotation.x = 0.45;
  return g;
}

function passModel() {
  // a stiff card, the palace seal in red, a name punched along it
  const g = new THREE.Group();
  g.add(new THREE.Mesh(roundedBox(0.15, 0.095, 0.006, 0.004, 3), flatM('#f1e3bf')));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 18).rotateX(Math.PI / 2).translate(-0.085, 0.02, 0.008), flatM('#c8483a')));
  for (let i = 0; i < 7; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 6).rotateX(Math.PI / 2).translate(-0.02 + i * 0.022, -0.045, 0.007), flatM(INK)));
  for (const y of [0.04, 0.012]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.008, 0.003).translate(0.05, y, 0.007), flatM('#7a6a55')));
  g.rotation.set(-0.25, 0.2, 0.12);
  return g;
}

const MODELS = {
  backpack: tankModel, jetpack: jetsModel, glider: wingsModel, stun: () => lensModel('#bfe8f2', { ice: true }), fire: flintModel,
  cell: cellModel, coil: coilModel, lantern: lanternModel, lens: () => lensModel('#d8d4c8', { glyph: true }), bell: whistleModel, star: starModel,
  bloom: bloomModel, echo: echoModel, level: levelModel,
  soles: solesModel, hush: hushModel, shell: shellModel, moss: mossModel, pouch: pouchModel, scarf: scarfModel, reed: reedModel, resin: resinModel, cabpass: passModel,
};

/** An item's model from elsewhere (the gadgets bring their own: src/gadgets/registry.js). */
export function registerItemModel(id, build) { MODELS[id] = build; }

/** A trial's upgrade (src/items.js `trial`): the gadget it improves, with a small gold star pinned on it. */
function upgradeModel(of) {
  const g = new THREE.Group();
  g.add(MODELS[of]());
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0).scale(1, 1, 0.4), flatM('#f2c54b', { glow: 0.7 }));
  star.position.set(0.12, 0.14, 0.06);
  g.add(star);
  return g;
}

/** A small model of an item for the hovering display (a generic gem for anything unknown). */
export function buildItemModel(id) {
  const g = (MODELS[id] ?? (ITEMS[id]?.trial && MODELS[ITEMS[id].needs] ? () => upgradeModel(ITEMS[id].needs) : null) ?? (() => { const x = new THREE.Group(); x.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), flatM('#f2c54b', { glow: 0.6 }))); return x; }))();
  g.name = `Item ${id}`;
  return noCollide(g);
}

/** The item model's fluid glass, if it has one (its time uniform is animated). */
export function fluidMaterials(model) {
  const out = [];
  model.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uFluidA) out.push(o.material); });
  return out;
}
