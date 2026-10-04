import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { TANK, FLUID_TONES } from '../fluid-tool.js';

// What an item box looks like, and what comes out of it. All of it is inked
// geometry through makeMaterial (the post pass draws the lines).
//
//   buildBox(key)    → { root, body, lid, hinge, star, seam, glowFloor, rays, mats, size }
//                      a dark blue chest about knee high with the pale four-point
//                      star of the reference drawing on its lid. Local frame: +z is
//                      the front (where the traveller kneels), the lid hinges on the
//                      left edge (-x; lid.rotation.z opens it), y = 0 on the ground.
//   buildItemModel(id) → a small Group (≈ 0.3 m) for the hovering display
//   buildRays(key)   → the fan of flat bright wedges that bursts out of the box
//   buildSparkles()  → twinkling specks round the hovering item
//   buildBeacon(key) → a thin pale column of light over an unopened box (seen from afar)
//   buildDebris(from, to, groundAt) → the crash's trail of hull bits and a dropped crate

export const BOX = { w: 0.8, h: 0.4, d: 0.55, lid: 0.085, wall: 0.045 };
export const BOX_COLORS = { body: '#25386c', band: '#18254b', inside: '#0e1730', star: '#dcecf2', seam: '#fff4d6', light: '#fffbea' };

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

export function buildBox(key = 'box') {
  const { w, h, d, lid: lh, wall } = BOX, C = BOX_COLORS;
  // per-box materials (the key makes them unique, so each box can glow on its own)
  const mats = {
    body: makeMaterial({ color: C.body, flat: true, key: `box.body.${key}` }),
    band: makeMaterial({ color: C.band, flat: true }),
    inside: makeMaterial({ color: C.inside, flat: true, side: THREE.DoubleSide }),
    star: makeMaterial({ color: C.star, flat: true, glow: 0.35, key: `box.star.${key}` }),
    seam: makeMaterial({ color: C.band, flat: true, glow: 0, key: `box.seam.${key}` }),
    light: makeMaterial({ color: C.light, flat: true, glow: 1, key: `box.light.${key}` }),
  };
  const root = new THREE.Group();
  root.name = `Item box ${key}`;
  // the body: an open-topped chest with walls (so the opened box shows its inside)
  const walls = [
    new THREE.BoxGeometry(w, wall, d).translate(0, wall / 2, 0),                         // floor
    new THREE.BoxGeometry(w, h, wall).translate(0, h / 2, d / 2 - wall / 2),             // front
    new THREE.BoxGeometry(w, h, wall).translate(0, h / 2, -d / 2 + wall / 2),            // back
    new THREE.BoxGeometry(wall, h, d - wall * 2).translate(w / 2 - wall / 2, h / 2, 0),  // sides
    new THREE.BoxGeometry(wall, h, d - wall * 2).translate(-w / 2 + wall / 2, h / 2, 0),
  ];
  const body = new THREE.Mesh(one(walls), mats.body);
  // the inside, darker (a slightly smaller open box, faces turned inward)
  const inner = new THREE.Mesh(new THREE.BoxGeometry(w - wall * 2 - 0.01, h - wall, d - wall * 2 - 0.01).translate(0, wall + (h - wall) / 2 + 0.001, 0), mats.inside);
  inner.geometry.groups = inner.geometry.groups.filter((g) => g.materialIndex !== 2);   // no top face: it's open
  inner.material = [mats.inside, mats.inside, mats.inside, mats.inside, mats.inside, mats.inside];
  // corner bands and a plinth, in a darker blue
  const bands = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bands.push(new THREE.BoxGeometry(0.06, h + 0.01, 0.06).translate(sx * (w / 2 - 0.022), h / 2, sz * (d / 2 - 0.022)));
  bands.push(new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04).translate(0, 0.025, 0));
  // a little clasp on the free side (the lid hinges on the other)
  bands.push(new THREE.BoxGeometry(0.03, 0.09, 0.1).translate(w / 2 + 0.012, h - 0.06, 0));
  const band = new THREE.Mesh(one(bands), mats.band);
  // the seam: a thin line of light where the lid meets the body
  const sw = 0.012, seamGeo = one([
    new THREE.BoxGeometry(w + 0.012, sw, sw).translate(0, h + sw / 2, d / 2 + 0.002),
    new THREE.BoxGeometry(w + 0.012, sw, sw).translate(0, h + sw / 2, -d / 2 - 0.002),
    new THREE.BoxGeometry(sw, sw, d + 0.012).translate(w / 2 + 0.002, h + sw / 2, 0),
    new THREE.BoxGeometry(sw, sw, d + 0.012).translate(-w / 2 - 0.002, h + sw / 2, 0),
  ]);
  const seam = new THREE.Mesh(seamGeo, mats.seam);
  // the glow inside, a bright floor seen once the lid lifts
  const glowFloor = new THREE.Mesh(new THREE.BoxGeometry(w - wall * 2.4, 0.02, d - wall * 2.4).translate(0, h * 0.55, 0), mats.light);
  // the lid, hinged on the left edge (local -x; the kneeling traveller's left): it swings up and
  // over to the side, so nothing stands between the light and a camera in front of the traveller.
  // hinge.rotation.z = angle (0 shut .. ~1.95 past upright)
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, h, 0);
  const lidMesh = new THREE.Mesh(one([
    new THREE.BoxGeometry(w + 0.03, lh, d + 0.03).translate(w / 2, lh / 2 + 0.006, 0),
  ]), mats.body);
  const lidBand = new THREE.Mesh(one([
    new THREE.BoxGeometry(w + 0.05, 0.03, 0.05).translate(w / 2, 0.02, d / 2 + 0.01),
    new THREE.BoxGeometry(w + 0.05, 0.03, 0.05).translate(w / 2, 0.02, -d / 2 - 0.01),
  ]), mats.band);
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.21, 0.065), { depth: 0.012, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(w / 2, lh + 0.006, 0), mats.star);
  hinge.add(lidMesh, lidBand, star);
  root.add(body, inner, band, seam, glowFloor, hinge);
  const rays = buildRays(key);
  rays.position.set(0, h * 0.97, 0);
  // (the wrapper stays visible: it goes in the level's noShadow list, which re-shows its members every frame)
  const raysWrap = new THREE.Group();
  raysWrap.add(rays);
  root.add(raysWrap);
  noCollide(root);
  return { root, body, lid: hinge, hinge, star, seam, glowFloor, rays, raysWrap, mats, size: { w, h: h + lh, d } };
}

/**
 * The burst: flat bright wedges fanning out of the box mouth (the reference
 * drawing's rays). A low fan spreads out all round, close over the ground,
 * so the rays light the kneeling traveller from below without hiding the
 * face; a few tall ones rise either side of the traveller.
 * Few and short toward the scene's two cameras (local yaw about 77 and 165 deg). Each wedge is a thin triangle from the mouth;
 * ray.userData.len is its full length (the scene grows and shimmers it).
 */
export function buildRays(key = 'rays') {
  const g = new THREE.Group();
  g.name = 'Box rays';
  const mat = makeMaterial({ color: BOX_COLORS.light, flat: true, glow: 1, side: THREE.DoubleSide, key: `box.rays.${key}` });
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const D = Math.PI / 180;
  const spec = [];
  // the low fan (tilt from vertical 64-80 deg), shorter toward the camera's side
  for (let i = 0; i < 14; i++) {
    const yaw = (i / 14) * 360 * D + (rnd() - 0.5) * 0.2;
    const deg = (((yaw / D) % 360) + 360) % 360;
    const toCam = (deg > 55 && deg < 100) || (deg > 140 && deg < 195);   // toward the two cameras
    spec.push({ yaw, tilt: (64 + rnd() * 16) * D, len: toCam ? 0.5 + rnd() * 0.35 : 1.3 + rnd() * 1.3, wid: 0.12 + rnd() * 0.16 });
  }
  // tall rays leaning out either side of the traveller (yaw 72-108 and 248-290 deg): a V that frames them
  for (let i = 0; i < 7; i++) {
    const deg = i < 3 ? 72 + i * 18 : 248 + (i - 3) * 14;
    spec.push({ yaw: (deg + (rnd() - 0.5) * 8) * D, tilt: (36 + rnd() * 20) * D, len: 1.4 + rnd() * 1.0, wid: 0.1 + rnd() * 0.14 });
  }
  for (const { yaw, tilt, len, wid } of spec) {
    // a triangle in the ray's own frame: apex at the origin, base across x at +y
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.02, 0, 0, 0.02, 0, 0, wid / 2, 1, 0, -0.02, 0, 0, wid / 2, 1, 0, -wid / 2, 1, 0], 3));
    geo.computeVertexNormals();
    const ray = new THREE.Mesh(geo, mat);
    ray.rotation.set(0, yaw, 0, 'YXZ');
    ray.rotateX(tilt);
    ray.userData = { len, phase: rnd() * 6.28, yaw };
    ray.scale.set(1, 0.001, 1);
    g.add(ray);
  }
  g.visible = false;
  noCollide(g);
  return g;
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
const flatM = (color, o = {}) => makeMaterial({ color, flat: true, ...o });

function tankModel() {
  const g = new THREE.Group();
  const pts = TANK.profile.map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.SplineCurve(pts);
  const R = TANK.profile.reduce((m, [r]) => Math.max(m, r), 0);
  // its own fluid material (not the worn tank's): the box animates its time
  const glass = new THREE.Mesh(new THREE.LatheGeometry(curve.getPoints(20), 24),
    makeMaterial({ color: '#ffffff', fluid: 'tank', glow: 0.6, fluidBox: [0, TANK.full, R, TANK.highlight], fluidTones: FLUID_TONES, key: 'box.item.tank' }));
  glass.scale.x = TANK.squash;
  glass.userData.fluid = true;
  g.add(glass);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.136, 0.16, 0.075, 24).translate(0, -0.03, 0).scale(TANK.squash, 1, 1), flatM(BRASS)));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.103, 0.06, 20).translate(0, TANK.height + 0.024, 0).scale(TANK.squash, 1, 1), flatM(BRASS)));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 7).translate(0, TANK.height + 0.07, 0), flatM(BRASS_DARK)));
  for (const k of [1, 2]) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.01, 5, 24).rotateX(Math.PI / 2).translate(0, (TANK.full * k) / 3, 0).scale(TANK.squash, 1, 1), flatM(INK)));
  // the straps' back plate
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.022).translate(0, TANK.height / 2, -0.17), flatM(STEEL)));
  g.position.y = -0.28;
  const w = new THREE.Group(); w.add(g); w.scale.setScalar(0.6);
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

const MODELS = {
  backpack: tankModel, jetpack: jetsModel, glider: wingsModel, stun: () => lensModel('#bfe8f2', { ice: true }), fire: flintModel,
  cell: cellModel, coil: coilModel, lantern: lanternModel, lens: () => lensModel('#d8d4c8', { glyph: true }), bell: whistleModel, star: starModel,
};

/** A small model of an item for the hovering display (a generic gem for anything unknown). */
export function buildItemModel(id) {
  const g = (MODELS[id] ?? (() => { const x = new THREE.Group(); x.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), flatM('#f2c54b', { glow: 0.6 }))); return x; }))();
  g.name = `Item ${id}`;
  return noCollide(g);
}

/** The item model's fluid glass, if it has one (its time uniform is animated). */
export function fluidMaterials(model) {
  const out = [];
  model.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uFluidA) out.push(o.material); });
  return out;
}

// ------------------------------------------------------------------ the crash's debris
/**
 * Hull fragments strewn on the sand from `from` to `to` (world, the box at the end),
 * a few glinting, and the crate the box was packed in, split open beside it.
 * groundAt(x, z) → y. Returns a Group.
 */
export function buildDebris(from, to, groundAt, { n = 16, seed = 3 } = {}) {
  const g = new THREE.Group();
  g.name = 'Crash debris';
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const hull = flatM('#d9d1c2'), metal = flatM('#7e8590'), dark = flatM('#4a4440'), glint = flatM('#fff1c8', { glow: 0.85 }), wood = flatM('#a8743f'), woodDark = flatM('#7a5230');
  const dir = new THREE.Vector3().subVectors(to, from).setY(0);
  const L = dir.length(); dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i < n; i++) {
    const k = 0.25 + (i / n) * 0.7;
    const p = from.clone().addScaledVector(dir, L * k).addScaledVector(side, (rnd() - 0.5) * 7 * (1 - k * 0.5));
    p.y = groundAt(p.x, p.z);
    let m;
    const r = rnd();
    if (r < 0.45) m = new THREE.Mesh(new THREE.BoxGeometry(0.4 + rnd() * 0.8, 0.03, 0.3 + rnd() * 0.5), rnd() < 0.6 ? hull : metal);   // a hull plate
    else if (r < 0.7) m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5 + rnd() * 0.7, 6), dark);                           // a strut
    else if (r < 0.85) m = new THREE.Mesh(new THREE.TorusGeometry(0.12 + rnd() * 0.1, 0.025, 4, 10, Math.PI * (0.8 + rnd())), metal);  // a bent hoop
    else m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), glint);                                                            // a glinting bolt
    m.position.copy(p).add(new THREE.Vector3(0, 0.03, 0));
    m.rotation.set((rnd() - 0.5) * 1.2, rnd() * 6.28, (rnd() - 0.5) * 1.2);
    g.add(m);
    if (rnd() < 0.5) {   // a glint beside it, catching the sun
      const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), glint);
      b.position.copy(p).add(new THREE.Vector3((rnd() - 0.5) * 0.8, 0.04, (rnd() - 0.5) * 0.8));
      b.position.y = groundAt(b.position.x, b.position.z) + 0.03;
      g.add(b);
    }
  }
  // the crate it was packed in, split open a little beyond the box (the box tumbled out)
  const c = to.clone().addScaledVector(dir, 2.4).addScaledVector(side, -1.8);
  c.y = groundAt(c.x, c.z);
  const crate = new THREE.Group();
  crate.add(new THREE.Mesh(one([
    new THREE.BoxGeometry(1.0, 0.05, 0.75).translate(0, 0.025, 0),
    new THREE.BoxGeometry(1.0, 0.55, 0.05).translate(0, 0.3, -0.35),
    new THREE.BoxGeometry(0.05, 0.55, 0.75).translate(0.48, 0.3, 0),
  ]), wood));
  crate.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.6).translate(0, 0.05, 0.65).rotateX(0.25), woodDark));   // its side, fallen out
  crate.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.7).translate(-0.75, 0.05, 0.1).rotateZ(1.35), wood));
  crate.position.copy(c);
  crate.rotation.set(0.08, Math.atan2(dir.x, dir.z) + 0.6, -0.12);
  g.add(crate);
  return noCollide(g);
}
