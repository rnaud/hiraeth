import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { TANK, FLUID_TONES, buildFlask } from '../fluid-tool.js';
import { ITEMS } from '../items.js';
import { chestGeometry, openEase, starShape, MAKERS_CHEST, CHEST_COLORS } from './chest.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export { starShape, chestKind } from './chest.js';

// What an item box looks like, and what comes out of it. All of it is inked
// geometry through makeMaterial (the post pass draws the lines).
//
// The boxes are the makers' chests (docs/story-bible.md, "The boxes"; references/Core Objects/Chests/): very old,
// handled by many, never broken, and the same in every world. Two kinds (src/boxes/chest.js builds them): the
// makers' chest, a hip-high rounded shell of pale cream ceramic like a river stone, the makers' four-point star on
// its top, a thin brass band round it and a round lens of glowing jade fluid in its front; and, at the heart of each
// temple, the temple chest, a bud of white stone and gold with jade glass in its seams. A thin ray of light travels
// across either (materials.js MAKERS_BOX). The post pass draws their outline only: nothing inside it.
//
//   buildBox(key, { kind }) → { root, body, shell, opened, petals, core, mats: { body }, size, kind, setOpen(k) }
//                      a chest at its unscaled size (chest.js); index.js sets it down BOX_SCALE larger (about hip
//                      high). Local frame: +z is the front (where the traveller stands), y = 0 on the ground.
//                      kind: 'makers' (default) or 'temple' (chest.js chestKind: by the placement, never the world).
//                      Closed it is one mesh (shell); setOpen(k) (0..1) swaps in its opening parts (opened: the part
//                      that stays put, the petals that part, the temple's rising heart), all in the same material.
//                      mats.body.uniforms.uBoxA: x the ray's strength, y the marks' glow, z the star's reach, w the
//                      ray's clock (one pass per unit: index.js and scene.js wind it)
//   buildItemModel(id) → a small Group (≈ 0.3 m) for the hovering display
//   buildSparkles()  → twinkling specks round the hovering item; buildMotes() → jade motes rising out of an opening chest
//   buildBeacon(key) → a thin pale column of light over an unopened box (seen from afar)

/** The makers' chest's size (unscaled, m): w across, h tall (lid: none, kept for the scene's arithmetic), d deep. */
export const BOX = { w: MAKERS_CHEST.w, h: MAKERS_CHEST.h, d: MAKERS_CHEST.d, lid: 0 };
/** The boxes are built at BOX's size and set down this much larger: big enough to notice from afar. */
export const BOX_SCALE = 1.9;
/** The item hovering where its box was. */
export const ITEM_SCALE = 1.8;
export const BOX_COLORS = { body: CHEST_COLORS.cream, star: '#dcecf2', mark: CHEST_COLORS.star, seam: '#e8fff2', light: CHEST_COLORS.light, jade: CHEST_COLORS.jade };
/** The ray's rhythm: seconds a pass takes far off, and close up (it quickens as you come near). */
export const RAY_PASS = { far: 4.2, near: 2.6 };

const one = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; }); return o; };

/**
 * A rounded box (the small items' slabs and cards): a cube's subdivided faces pushed out onto a box with every edge and
 * corner a quarter round of radius r, its normals exact. Centred on the origin.
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
  g.deleteAttribute('uv');
  return mergeVertices(g);
}

export function buildBox(key = 'box', { kind = 'makers' } = {}) {
  const G = chestGeometry(kind), C = BOX_COLORS, S = BOX_SCALE;
  // its own material (the key makes it unique, so each chest glows and sweeps on its own); one program for every
  // chest of either kind (the same options but the key and the sizes); it dissolves when it opens (scene.js sets uDissolve)
  const body = makeMaterial({
    color: '#ffffff', vertexColors: true, key: `box.body.${key}`, dissolve: C.seam,
    makersBox: { half: G.half.map((v) => v * S), center: G.center * S, mark: C.mark, light: C.light, ray: 0.6, glow: 0.35, star: G.star * S },
  });
  const root = new THREE.Group();
  root.name = `Item box ${key}`;
  const inner = new THREE.Group();   // (what the dissolve shows and hides: the closed shell, or the opening parts)
  root.add(inner);
  const shell = new THREE.Mesh(G.closed, body);
  shell.name = kind === 'temple' ? 'Temple chest' : 'Makers’ chest';
  inner.add(shell);
  const opened = new THREE.Group();
  opened.name = 'Chest opening';
  opened.visible = false;
  opened.add(new THREE.Mesh(G.base, body));
  const petals = G.petals.map((pt) => {
    const pivot = new THREE.Group(), m = new THREE.Mesh(pt.geo, body);
    pivot.position.copy(pt.hinge); m.position.copy(pt.hinge).negate();
    pivot.add(m); opened.add(pivot);
    return { pivot, axis: pt.axis, angle: pt.angle };
  });
  let core = null;
  if (G.core) { core = new THREE.Mesh(G.core.geo, body); core.position.copy(G.core.at); opened.add(core); }
  inner.add(opened);
  noCollide(root);
  const q = new THREE.Quaternion();
  /** How far it has opened (0 closed: the one shell; 1 its petals all the way out, the temple's heart risen and gone). */
  const setOpen = (k) => {
    const on = k > 0;
    shell.visible = !on; opened.visible = on;
    const e = openEase(Math.min(1, k));
    for (const p of petals) p.pivot.quaternion.copy(q.setFromAxisAngle(p.axis, p.angle * e));
    if (core) {
      core.position.set(G.core.at.x, G.core.at.y + G.core.rise * e, G.core.at.z);
      core.scale.setScalar(Math.max(1e-3, 1 - openEase((k - 0.45) / 0.55)));   // (it gives itself to what comes out)
    }
  };
  return { root, body: inner, shell, opened, petals, core, mats: { body }, size: { ...G.size }, kind: kind === 'temple' ? 'temple' : 'makers', setOpen };
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

/** Motes of jade light rising out of an opening chest (the sheets' column of light): long specks, scene.js lifts them. */
export function buildMotes(n = 18) {
  const g = new THREE.Group();
  const mat = makeMaterial({ color: CHEST_COLORS.jadePale, flat: true, glow: 1 });
  const geo = new THREE.OctahedronGeometry(0.02, 0);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.userData = { a: i * 2.39996, r: 0.04 + ((i * 7) % 5) * 0.045, ph: ((i * 37) % 17) / 17, sp: 0.7 + (i % 4) * 0.18 };
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
  const { group: g, glass } = buildFlask(makeMaterial({ color: '#ffffff', fluid: 'tank', glow: 0.6, fluidBox: [0, TANK.full, R, TANK.highlight], fluidTones: FLUID_TONES, fluidBase: TANK.base, key: 'box.item.tank' }), { worn: false, stage: 0 });
  glass.userData.fluid = true;
  g.position.y = -0.22;
  g.rotation.y = Math.PI + 0.3;   // (its dome to the eye (item-icons.js ICON_VIEW), a little turned: the round backpack's glass is half a sphere, open behind)
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

/** The Warden's bellows: a pair of leather bellows between brass-bound boards, a nozzle at the narrow end, on a strap. */
function wardenbellowsModel() {
  const g = new THREE.Group();
  const board = flatM('#8a5a3a'), leather = flatM('#c9a36a'), brass = flatM(BRASS), dark = flatM(BRASS_DARK), cool = flatM('#cfeef0', { glow: 0.5 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Group();
    // the two boards, a wedge apart, the pleated leather between them (four folds), a brass nozzle at the point
    const shape = new THREE.Shape(); shape.moveTo(-0.05, 0); shape.lineTo(0.05, 0); shape.lineTo(0.035, 0.2); shape.lineTo(-0.035, 0.2); shape.closePath();
    for (const dz of [-1, 1]) b.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }).translate(0, -0.1, dz * 0.034 - 0.006).rotateX(dz * 0.12), board));
    for (let i = 0; i < 4; i++) b.add(new THREE.Mesh(new THREE.BoxGeometry(0.1 - i * 0.008, 0.012, 0.06 - i * 0.008).translate(0, -0.07 + i * 0.045, 0), leather));
    b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.06, 10).translate(0, -0.13, 0), brass));
    b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10).translate(0, -0.163, 0), cool));
    b.position.x = sx * 0.075;
    b.rotation.z = sx * 0.12;
    g.add(b);
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.05).translate(0, 0.12, 0), flatM(STEEL)));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 14).translate(0, 0.15, 0), dark));
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

/** The lift valve (the double jump, v1.38): the backpack's brass valve, its wheel, a jade bead of fluid under it and the pair of small fins it adds to the ring (the round backpack's second stage). */
function liftModel() {
  const g = new THREE.Group();
  const brass = flatM(BRASS), dark = flatM(BRASS_DARK), jade = flatM(FLUID_TONES[0], { glow: 0.7 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 16), brass));                                    // the body
  for (const y of [-0.03, 0, 0.03]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 3, 16).rotateX(Math.PI / 2).translate(0, y, 0), dark));   // its thread
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8).translate(0, 0.085, 0), dark));            // the stem
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 5, 20).rotateX(Math.PI / 2).translate(0, 0.12, 0), brass));   // the wheel
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.008).rotateY((i * Math.PI) / 3).translate(0, 0.12, 0), brass));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10).translate(0, -0.07, 0), jade));                       // a bead of the fluid
  for (const sx of [-1, 1]) {
    const fin = new THREE.Shape(); fin.moveTo(0, -0.03); fin.lineTo(0.11, -0.005); fin.lineTo(0.1, 0.02); fin.lineTo(0, 0.03); fin.lineTo(0, -0.03);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.008, bevelEnabled: false }).translate(0, 0, -0.004), flatM(BRASS, { side: THREE.DoubleSide }));
    m.position.set(sx * 0.045, -0.01, 0); m.rotation.y = sx < 0 ? Math.PI : 0;
    g.add(m);
  }
  g.rotation.set(0.25, 0.5, 0);
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

// ---- the three worlds that joined the route in v1.40
function tongsModel() {
  // a pair of black iron tongs, shrunk to fit a cuff, their jaws worn bright round a tiny moon
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 0.02).translate(-0.02, 0, 0).rotateZ(s * 0.12), flatM('#3d3a40')));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 4, 12, Math.PI).rotateZ(s > 0 ? 0 : Math.PI).translate(0.12, s * 0.025, 0), flatM('#c9c4bc')));
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).rotateX(Math.PI / 2).translate(-0.04, 0, 0), flatM('#d6a13e')));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8).translate(0.14, 0, 0), flatM('#efe4cc')));
  g.rotation.set(0.3, 0.2, 0.25);
  return g;
}
function tetherModel() {
  // a coil of pale cord with a brass hook on its end
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 5, 24).translate(0, 0, i * 0.018 - 0.027), flatM('#f4e9c8')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 12, Math.PI * 1.4).translate(0.11, -0.04, 0), flatM('#d6a13e')));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6).rotateZ(0.9).translate(0.085, -0.01, 0), flatM('#f4e9c8')));
  g.rotation.set(1.0, 0.3, 0);
  return g;
}
function hornModel() {
  // a curled horn of grey shell, its mouth ringed in the whales' blue
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20, a = t * Math.PI * 1.3; pts.push(new THREE.Vector3(Math.cos(a) * (0.11 - t * 0.05), Math.sin(a) * (0.11 - t * 0.05), t * 0.04)); }
  const curve = new THREE.CatmullRomCurve3(pts.reverse());
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.012, 8), flatM('#a9b4b8')));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.06, 14, 1, true).rotateZ(Math.PI / 2).translate(0.12, 0.0, 0), flatM('#c9d2d6', { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 4, 16).rotateY(Math.PI / 2).translate(0.15, 0, 0), flatM('#6f8fd8', { glow: 0.5 })));
  g.rotation.set(0.4, -0.3, 0);
  return g;
}
function pearlModel() {
  // a grey pearl on a cord
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), flatM('#d8dde0', { glow: 0.15 })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.005, 3, 30, Math.PI * 1.6).rotateZ(-Math.PI * 0.3).translate(0, 0.1, 0), flatM('#5a4a3a')));
  return g;
}
function bellowsModel() {
  // a pocket bellows: two boards, cracked leather pleats between, a brass nozzle
  const g = new THREE.Group();
  for (const y of [-0.035, 0.035]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 3, 1).rotateY(Math.PI / 6).scale(1.2, 1, 1).translate(0, y, 0), flatM('#8a5a3a')));
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07 - i * 0.004, 0.07 - i * 0.004, 0.018, 3, 1, true).rotateY(Math.PI / 6).scale(1.2, 1, 1).translate(0, -0.02 + i * 0.02, 0), flatM('#c98a5a', { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 8).rotateZ(-Math.PI / 2).translate(0.13, 0, 0), flatM('#d6a13e')));
  g.rotation.set(0.5, 0.3, 0);
  return g;
}
function starthreadModel() {
  // a twist of pale thread that shines a little, looped round a peg
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 6; pts.push(new THREE.Vector3(Math.cos(a) * 0.05, -0.1 + t * 0.2, Math.sin(a) * 0.05)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.006, 4), flatM('#eef1fa', { glow: 0.45 })));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 8), flatM('#8a6a4a')));
  g.rotation.z = 0.3;
  return g;
}
function capModel() {
  // the divers' close knitted cap, teal, a brass ring over one ear
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), flatM('#3f8f96')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 24).rotateX(Math.PI / 2), flatM('#2f6f78')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 12).rotateY(Math.PI / 2).translate(0.088, 0.02, 0), flatM('#d6a13e')));
  g.rotation.x = -0.3;
  return g;
}
function pinModel() {
  // a pin like a tiny moon, its seam showing
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), flatM('#efe4cc')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 3, 24), flatM('#c9a888')));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5).rotateZ(Math.PI / 2).translate(0, -0.06, -0.01), flatM(STEEL)));
  return g;
}
function ribbonModel() {
  // a strip of salmon cloth tied in a loop
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 3, 24).scale(1, 1, 0.25), flatM('#e89a7e')));
  for (const s of [-1, 1]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.004).rotateZ(s * 0.3).translate(s * 0.02, -0.1, 0), flatM('#e89a7e')));
  return g;
}

const MODELS = {
  backpack: tankModel, doublejump: liftModel, jetpack: jetsModel, wardenbellows: wardenbellowsModel, glider: wingsModel, stun: () => lensModel('#bfe8f2', { ice: true }), fire: flintModel,
  cell: cellModel, coil: coilModel, lantern: lanternModel, lens: () => lensModel('#d8d4c8', { glyph: true }), bell: whistleModel, star: starModel,
  bloom: bloomModel, echo: echoModel, level: levelModel,
  soles: solesModel, hush: hushModel, shell: shellModel, moss: mossModel, pouch: pouchModel, scarf: scarfModel, reed: reedModel, resin: resinModel, cabpass: passModel,
  tongs: tongsModel, tether: tetherModel, horn: hornModel, pearl: pearlModel, bellows: bellowsModel, starthread: starthreadModel,
  divercap: capModel, founderspin: pinModel, courierribbon: ribbonModel,
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
