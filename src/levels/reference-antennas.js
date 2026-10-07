import * as THREE from 'three';
import { mulberry32, createNoise2D, fbm, smoothstep } from '../noise.js';
import { V, CLEAN_SKY, groundRibbon } from './reference-kit.js';
import { bankBush } from './wood-kit.js';
import {
  latticeTower, dish, saucer, aimAt, dirOf, column, dome, egg, vineCable, cable, trussStair, deck, bird, rimSpots, bar, tipToward,
  unitPole, unitSaucer, unitDish, moveParts, FAR_MIN_R, ANTENNAS_LOOK, ANTENNAS_TONES,
} from './antennas-kit.js';

// ---------------------------------------------------------------------------
// The Forest of Antennas' reference sheets (references/The Forest of Antennas/reference-1 … 4): thousands of
// abandoned radio masts on a rolling plain of violet grass, great parabolic dishes tilted like flowers, thin
// lattice towers joined by vine-grown cables and maintenance bridges, birds nesting in the dishes, a small
// settlement of rounded repair workshops under one immense receiver, a path winding to them, a pale yellow
// sky. Each sheet is one composition: one view each. One scene builder (antennaScene) does them all
// (reference-views.js describes the fields).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Forest of Antennas / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Forest of Antennas/reference-${n}.jpeg`, import.meta.url).href });
export const ANTENNAS_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`antennas-${n}`, sheet(n)]));

/** The sheets' ink: the world's own look (antennas-kit.js) and a clean sky. */
export const ANTENNAS_VIEW_LOOK = { ...ANTENNAS_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow (lavender), light, sun: read off each sheet */
const SKY = {
  pale: ['#f2e8a6', '#f6f1cc', '#8a7ab8', '#fff6dc', '#fff4c8'],
  rose: ['#f4eab0', '#f7efd2', '#a08ac0', '#fff2e2', '#fff2d0'],
  lilac: ['#f5ecb2', '#f5ebc6', '#9a84b8', '#fff4dc', '#fff0c8'],
  amber: ['#f1d68e', '#f6e4ae', '#7f8ea8', '#fff0d4', '#ffe8b8'],
};
const T = ANTENNAS_TONES;

function materials(kit, o = {}) {
  const DS = THREE.DoubleSide;
  const dishMat = (c) => kit.mat({ color: c, shade: 0.45, hatch: 0.35, side: DS, form: true, line: 0.7, lineTint: 0.35 });
  return {
    iron: kit.mat({ color: o.iron ?? T.iron, shade: 0.3, hatch: 0.4, thin: 1.5 }),
    // (the lattices further off: a lighter rust, a thinner line of its own colour, as the sheets draw them in the haze)
    ironMid: kit.mat({ color: o.ironMid ?? '#7a6458', shade: 0.3, hatch: 0.3, line: 0.7, lineTint: 0.6, thin: 1.5 }),
    vine: kit.mat({ color: T.vine, shade: 0.4, hatch: 0.6, thin: 1.5 }),
    leaf: kit.mat({ color: T.leaf, pattern: 'leaves', hatch: 1.2, shade: 0.5, spot: 0 }),
    frame: kit.mat({ color: T.frame, flat: true, thin: 1.5 }),
    dish: Object.fromEntries(['dish', 'dishPink', 'dishBlue', 'dishNavy', 'dishRose', 'under', 'shell', 'shell3'].map((k) => [k, dishMat(o[k] ?? T[k])])),
    shell: kit.mat({ color: o.shell ?? T.shell, shade: 0.45, hatch: 0.4, form: true, detail: 'built', detailDensity: 0.4 }),
    shell2: kit.mat({ color: o.shell2 ?? T.shell2, shade: 0.45, hatch: 0.4, form: true, detail: 'built', detailDensity: 0.4 }),
    trim: kit.mat({ color: T.trim, flat: true }),
    glow: kit.mat({ color: T.window, glow: 0.95, flat: true }),
    plank: kit.mat({ color: T.plank, flat: true }),
    path: kit.mat({ color: o.path ?? T.path, shade: 0.2, hatch: 0.2, side: DS }),
    bush: [kit.mat({ color: o.bush ?? T.bush, pattern: 'leaves', hatch: 1.6, shade: 0.5, spot: 0 }), kit.mat({ color: o.bush2 ?? T.bush2, pattern: 'leaves', hatch: 1.6, shade: 0.5, spot: 0 })],
    bird: kit.mat({ color: T.bird, flat: true }),
    // far masts and dishes: instanced, each its own tone (paler with distance), a hairline of their own colour (no ink round them)
    far: kit.mat({ color: '#ffffff', flat: true, hatch: 0.15, line: 0.25, lineTint: 1, side: DS, thin: 1.5 }),
    tuft: kit.mat({ color: '#ffffff', side: DS, line: 0.25, lineTint: 1, hatch: 0.3 }),
    figure: kit.mat({ color: '#5d5478', flat: true, figure: true }),
    suit: kit.mat({ color: '#4c5a88', flat: true, figure: true }),
    pack: kit.mat({ color: '#f3a6e8', glow: 0.9, flat: true }),
    pack2: kit.mat({ color: '#9ff0d8', glow: 0.9, flat: true }),
  };
}

const NC = { solid: false, shadow: false };
/** Every role of a builder's parts added under its material (M: by role; dish: the dish tone for dish/under). */
function addParts(kit, M, parts, { dishTone = 'dish', underTone = 'under', shell = M.shell } = {}) {
  const by = { iron: M.iron, vine: M.vine, leaf: M.leaf, frame: M.frame, trim: M.trim, glow: M.glow, plank: M.plank, shell, dish: M.dish[dishTone], under: M.dish[underTone] };
  for (const [k, list] of Object.entries(parts)) if (Array.isArray(list) && by[k]) for (const g of list) kit.add(by[k], g, NC);
}

/**
 * A saucer's parts (about its own centre) tipped toward the eye by k × the angle the eye sees it up at: the sheets draw
 * the high saucers nearly edge-on (a flattened perspective), so they show a thin rim, not their whole underside.
 */
function tipEye(parts, eye, at, k) {
  const dx = eye[0] - at.x, dz = eye[2] - at.z, th = Math.atan2(at.y - eye[1], Math.hypot(dx, dz));
  return tipToward(parts, Math.atan2(dx, dz), k * th);
}
/** A lattice mast at (x, z) on the ground, its top a nest saucer, a dish, a spike or nothing; birds on the saucer. */
function tower(kit, M, rng, o) {
  const y0 = kit.base(o.x, o.z, o.w0 ?? 2) - 0.2;
  const L = latticeTower({ seed: o.seed ?? o.x * 3 + o.z, legs: 3, ...o });
  addParts(kit, M, moveParts(L, (g) => g.translate(o.x, y0, o.z)));
  const top = V(o.x, y0 + L.top.y, o.z);
  if (o.saucer) {
    const S = o.saucer, P = saucer({ R: S.R, h: S.h ?? S.R * 0.1, under: S.under ?? 0.3, stem: Math.max(L.top.w * 1.2, 0.3), hang: S.hang ?? 0.5, seed: o.seed });
    const B = { bird: rimSpots(S.R, 0.02, S.birds ?? 0, o.seed).map((b) => bird(0.32 * b.s).rotateY(b.yaw).translate(b.x, b.y, b.z)) };
    if (S.tilt) for (const Q of [P, B]) moveParts(Q, (g) => g.rotateX(S.tilt[0] ?? 0).rotateZ(S.tilt[1] ?? 0));
    if (o.eye) for (const Q of [P, B]) tipEye(Q, o.eye, top, S.face ?? 0.4);
    const lift = (S.under ?? 0.3) * S.R;
    addParts(kit, M, moveParts(P, (g) => g.translate(top.x, top.y + lift, top.z)), { dishTone: S.tone ?? 'dishPink', underTone: S.underTone ?? S.tone ?? 'dishPink' });
    for (const g of B.bird) kit.add(M.bird, g.translate(top.x, top.y + lift, top.z), NC);
  }
  if (o.spike) kit.add(M.iron, bar(top.clone(), top.clone().add(V(0, o.spike, 0)), 0.12, 0.05, 5), NC);
  if (o.dishTop) { const D = o.dishTop, P = dish({ R: D.R, depth: D.depth ?? 0.25, feed: D.feed ?? 'tripod', back: true, seed: o.seed }); addParts(kit, M, aimAt(P, dirOf(D.az ?? 0, D.el ?? 0.6), top.clone().add(V(0, 0.4, 0))), { dishTone: D.tone ?? 'dish', underTone: D.back ?? 'under' }); }
  return top;
}
/** A parabolic dish (kit dish) at its pivot, facing az/el, on a mount: 'lattice' legs to the ground, a 'pedestal' column, a 'block', or none. */
function bigDish(kit, M, o) {
  const P = dish({ R: o.R, depth: o.depth ?? 0.28, feed: o.feed ?? 'tripod', back: true, seams: o.seams ?? 0, ribs: o.ribs ?? 10, seed: o.seed ?? o.R });
  const dir = o.dir ? V(...o.dir) : dirOf(o.az ?? 0, o.el ?? 0.5), pivot = V(o.x, o.y, o.z);
  addParts(kit, { ...M, frame: o.frame?.(M) ?? M.ironMid }, aimAt(P, dir, pivot, o.spin ?? 0), { dishTone: o.tone ?? 'dish', underTone: o.back ?? 'under' });
  const g0 = kit.base(o.x, o.z, 2) - 0.3, back = pivot.clone().addScaledVector(dir.clone().normalize(), -o.R * 0.12);
  if (o.mount === 'lattice') {
    const h = back.y - g0, L = latticeTower({ h, w0: o.R * 0.35, w1: o.R * 0.12, legs: 4, bay: 2.6, r: 0.14, s: 0.06, vines: o.vines ?? 0.3, hang: 0.4, seed: o.seed ?? 3 });
    addParts(kit, { ...M, iron: M.ironMid }, moveParts(L, (g) => g.translate(back.x, g0, back.z)));
  } else if (o.mount === 'pedestal') {
    const h = back.y - g0 - o.R * 0.1, C = column({ h, r0: o.R * 0.16, r1: o.R * 0.1, bulge: o.R * 0.02 });
    const PM = o.pedestal?.(M) ?? M.iron;
    for (const g of C.iron) kit.add(PM, g.translate(back.x, g0, back.z), NC);
    for (const g of C.frame) kit.add(M.frame, g.translate(back.x, g0, back.z), NC);
    kit.add(PM, bar(V(back.x, g0 + h, back.z), back, o.R * 0.09, o.R * 0.07, 10, true), NC);
  } else if (o.mount === 'block') {
    // a block of machinery under the dish's back, a stout arm up to it, braces
    const w = Math.min(o.R * 0.32, 7), h = Math.max(2, (back.y - g0) * 0.45), b0 = V(back.x, g0, back.z).addScaledVector(V(dir.x, 0, dir.z).normalize(), -o.R * 0.15);
    kit.add(o.blockMat ?? M.shell2, new THREE.BoxGeometry(w, h, w * 0.85).translate(b0.x, g0 + h / 2, b0.z));
    kit.add(M.iron, bar(V(b0.x, g0 + h, b0.z), back, w * 0.16, w * 0.12, 8, true), NC);
    for (let i = 0; i < 3; i++) kit.add(M.frame, bar(V(b0.x - w * 0.4 + i * w * 0.4, g0 + h, b0.z + w * 0.3), back.clone().add(V(0, -o.R * 0.05, 0)), 0.09, 0.07, 4), NC);
  }
  return { pivot, dir };
}
/** The great nest saucer on its mast, the egg and the domes under it (the settlement's receiver: sheets 2 and 4). */
function bigSaucer(kit, M, o) {
  const g0 = kit.base(o.x, o.z, 4);
  const P = saucer({ R: o.R, h: o.R * 0.05, under: o.under ?? 0.32, stem: o.stem ?? o.R * 0.08, hang: o.hang ?? 0.35, seed: o.seed ?? 7 });
  const B = { bird: rimSpots(o.R, 0.02, o.birds ?? 0, o.seed ?? 7).map((b) => bird(0.4 * b.s).rotateY(b.yaw).translate(b.x, b.y, b.z)) };
  if (o.eye) for (const Q of [P, B]) tipEye(Q, o.eye, V(o.x, o.y, o.z), o.face ?? 0.85);
  addParts(kit, M, moveParts(P, (g) => g.translate(o.x, o.y, o.z)), { dishTone: o.tone ?? 'dish', underTone: o.underTone ?? o.tone ?? 'dish' });
  for (const g of B.bird) kit.add(M.bird, g.translate(o.x, o.y, o.z), NC);
  // its mast up through it, and down to the ground inside the egg
  if (o.mast) {
    const L = latticeTower({ h: o.mast, w0: o.R * 0.05, w1: o.R * 0.02, legs: 4, bay: 2.4, r: 0.18, s: 0.07, vines: 0, hang: 0, seed: 9 });
    addParts(kit, M, moveParts(L, (g) => g.translate(o.x, o.y - 1, o.z)));
  }
  const collar = o.y - (o.under ?? 0.32) * o.R;
  if (o.trunk) {
    // the receiver's trunk under the collar: struts and hanging cables down to the egg
    const t = o.trunk;
    kit.add(M.iron, bar(V(o.x, t.y0, o.z), V(o.x, collar, o.z), t.r ?? 1.6, t.r1 ?? 1.2, 10, true), NC);
    for (let i = 0; i < 8; i++) { const a = i * 0.785; kit.add(M.frame, bar(V(o.x + Math.cos(a) * (t.r ?? 1.6) * 2.2, t.y0 + 0.5, o.z + Math.sin(a) * (t.r ?? 1.6) * 2.2), V(o.x + Math.cos(a) * o.stem * 1.4, collar - 0.3, o.z + Math.sin(a) * o.stem * 1.4), 0.12, 0.1, 4), NC); }
  }
  void g0;
}
/** A workshop dome at (x, z), its door turned by rot (0: toward +z, the camera). */
function workshop(kit, M, o) {
  const g = kit.base(o.x, o.z, o.R * 0.8) - 0.1, y = Math.max(o.y ?? g, g);
  // (placed off the sheet over the ground: it stands on a terrace of earth)
  if (y > g + 0.3) kit.add(M.path, new THREE.CylinderGeometry(o.R * 1.18, o.R * 1.3, y - g + 0.6, 18).translate(o.x, (y + g - 0.6) / 2, o.z), NC);
  const D = dome({ R: o.R, tall: o.tall ?? 0.85, windows: o.windows ?? 4, lit: o.lit ?? 0.8, seed: o.seed ?? o.x + o.z * 3, rot: o.rot ?? 0, door: o.door ?? true, mast: o.mast ?? true });
  addParts(kit, M, moveParts(D, (g) => g.translate(o.x, y, o.z)), { shell: o.pale ? M.shell2 : M.shell });
  for (const [x, wy, z] of D.windows.slice(0, 3)) kit.light(o.x + x, y + wy, o.z + z, o.R * 1.2);
  return y;
}
/** The traveller seen from behind, the luminous pack on the back (+z of yaw: toward the camera). */
function traveller(kit, M, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 1.15, 10).translate(0, 0.6, 0), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8).translate(0, 1.4, 0), M.figure));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.26).translate(0, 1.08, 0.26), M.pack));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.06).translate(0.03, 1.02, 0.41), M.pack2));
  g.position.set(x, y, z); g.rotation.y = yaw;
  g.traverse((q) => { q.userData.noCollide = true; });
  kit.group.add(g);
  kit.light(x, y + 1.1, z + 0.5, 2.5);
}
/** A dark bush (the sheets' foreground shrubs), r round, at (x, z) on the ground. */
function bush(kit, M, rng, x, z, r, k = null) {
  kit.add(M.bush[k ?? Math.floor(rng() * 2)], bankBush(x * 7 + z).scale(r, r * 0.85, r).translate(x, kit.H(x, z) + r * 0.5, z), NC);
}
/** Instanced, with a tone each: [{ m: Matrix4, c: Color }…] as one draw (the far masts, the grass). */
function instanced(kit, geo, mat, list, name) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => { m.setMatrixAt(i, it.m); m.setColorAt(i, it.c); });
  m.userData.noCollide = true; m.name = name;
  kit.group.add(m);
  kit.noShadow.push(m);
  return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const mat4 = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz)).clone();
export { FAR_MIN_R };
/**
 * The forest beyond: n masts between r0 and r1 m from the eye in a wedge of the view, each a pole and its cap (a nest
 * saucer, a tilted dish or a flower dish on a stalk), toned from `near` to `far` with distance, drawn at least
 * FAR_MIN_R × d thick. One draw for the poles, one per cap kind.
 */
function farForest(kit, M, rng, { n = 600, r0 = 120, r1 = 900, spread = 1.2, h = [16, 60], caps = [0.5, 0.3, 0.2], near = T.far, far = T.farDeep, eye = [0, 0], tone = null, skip = () => false } = {}) {
  const poles = [], sauc = [], dishes = [], flowers = [], cN = new THREE.Color(near), cF = new THREE.Color(far), cT = tone ? new THREE.Color(tone) : null;
  for (let i = 0; i < n; i++) {
    const d = r0 + Math.pow(rng(), 0.7) * (r1 - r0), a = (rng() - 0.5) * spread, x = eye[0] + Math.sin(a) * d, z = eye[1] - Math.cos(a) * d;
    if (skip(x, z)) continue;
    const y = kit.H(x, z) - 0.5, hh = h[0] + rng() * (h[1] - h[0]), rr = Math.max(0.25, FAR_MIN_R * d), k = smoothstep(r0, r1, d);
    const c = cN.clone().lerp(cF, k * 0.85);
    if (cT && rng() < 0.4) c.lerp(cT, 0.5 * (1 - k));
    const u = rng(), kind = u < caps[0] ? 0 : u < caps[0] + caps[1] ? 1 : 2;
    poles.push({ m: mat4(x, y, z, rr * (kind === 2 ? 1.6 : 1), hh, rr * (kind === 2 ? 1.6 : 1)), c });
    const R = (kind === 0 ? 2 + rng() * 5 : kind === 1 ? 3 + rng() * 7 : 2 + rng() * 3) * (0.8 + k * 0.6);
    if (kind === 0) sauc.push({ m: mat4(x, y + hh + R * 0.35, z, R, R, R, rng() * 6, (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.25), c });
    else if (kind === 1) dishes.push({ m: mat4(x, y + hh * 0.98, z, R, R, R, rng() * 6, 0.6 + rng() * 0.9, 0), c });
    else flowers.push({ m: mat4(x, y + hh, z, R, R, R, rng() * 6, 0.3 + rng() * 0.8, 0), c });
  }
  instanced(kit, unitPole(), M.far, poles, 'far masts');
  instanced(kit, unitSaucer(14), M.far, sauc, 'far saucers');
  instanced(kit, unitDish(14, 0.32), M.far, dishes, 'far dishes');
  instanced(kit, unitDish(12, 0.5), M.far, flowers, 'far flowers');
}
/** Grass tufts near the camera: tapered blades in the ground's tones, leaning (one draw). */
function grassTufts(kit, M, rng, { n = 3000, r0 = 1.5, r1 = 30, eye = [0, 0], tones = [T.grass, T.grass2, T.grass3], h = [0.22, 0.5], skip = () => false } = {}) {
  // a tuft: five thin blades from nearly one root, nearly upright, leaning a little each way (the sheets' grass strokes)
  const pos = [], r2 = mulberry32(77);
  for (let k = 0; k < 5; k++) {
    const a = r2() * Math.PI * 2, o = 0.02 + r2() * 0.04, x = Math.cos(a) * o, z = Math.sin(a) * o, lx = x * 3 + (r2() - 0.5) * 0.12, lz = z * 3 + (r2() - 0.5) * 0.12, w = 0.012, hh = 0.7 + r2() * 0.3;
    pos.push(x - w, 0, z, x + w, 0, z, lx, hh, lz, x, 0, z - w, x, 0, z + w, lx, hh, lz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const C = tones.map((c) => new THREE.Color(c).multiplyScalar(0.82)), list = [];
  for (let i = 0; i < n; i++) {
    const d = r0 + Math.pow(rng(), 1.6) * (r1 - r0), a = (rng() - 0.5) * 2.2, x = eye[0] + Math.sin(a) * d, z = eye[1] - Math.cos(a) * d;
    if (skip(x, z)) continue;
    const s = h[0] + rng() * (h[1] - h[0]);
    list.push({ m: mat4(x, kit.H(x, z) - 0.03, z, s, s, s, rng() * 6), c: C[Math.floor(rng() * C.length)].clone().multiplyScalar(0.9 + rng() * 0.15) });
  }
  instanced(kit, geo, M.tuft, list, 'grass');
}
/** The path: a pale ribbon on the ground along [x, z] points, w wide. */
function path(kit, M, pts, w = 1.6) { kit.add(M.path, groundRibbon((x, z) => kit.H(x, z), pts, w, 0.04), NC); }
const nearPath = (pts, w) => {
  const P = pts.map(([x, z]) => V(x, 0, z)), c = new THREE.CatmullRomCurve3(P), S = c.getPoints(Math.max(20, pts.length * 12));
  return (x, z) => S.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < w * w);
};

/**
 * A panel's scene. o: { seed, towers: [tower opts], dishes: [bigDish opts], saucers: [bigSaucer opts], domes:
 * [workshop opts], eggs: [{ x, z, y, R, H }], cables: [[A, B, opts]] (vine-grown), wires: [[A, B, sag]], stairs: [[A, B, opts]],
 * decks: [[x, y, z, w, d, opts]], path: { pts, w }, far: farForest opts, grass: grassTufts opts, bushes: [[x, z, r]…],
 * traveller: [x, z, yaw], extra(kit, M, rng) }
 */
function antennaScene(kit, v, o) {
  const M = materials(kit, o.tones ?? {}), rng = mulberry32(o.seed ?? 1);
  const pathAt = o.path ? nearPath(o.path.pts, (o.path.w ?? 1.6) * 0.7) : () => false;
  if (o.path) path(kit, M, o.path.pts, o.path.w);
  for (const t of o.towers ?? []) tower(kit, M, rng, { eye: v.camera.eye, ...t });
  for (const d of o.dishes ?? []) bigDish(kit, M, d);
  for (const s of o.saucers ?? []) bigSaucer(kit, M, { eye: v.camera.eye, ...s });
  for (const e of o.eggs ?? []) { const E = egg({ R: e.R, H: e.H, windows: e.windows ?? 5, seed: e.seed ?? 5 }); addParts(kit, M, moveParts(E, (g) => g.rotateY(e.rot ?? 0).translate(e.x, e.y, e.z)), { shell: e.pale ? M.shell2 : M.shell }); kit.light(e.x, e.y + e.H * 0.5, e.z + e.R * 1.4, e.R * 2); }
  for (const d of o.domes ?? []) workshop(kit, M, d);
  for (const [A, B, op] of o.cables ?? []) addParts(kit, M, vineCable(V(...A), V(...B), op));
  for (const [A, B, sag, r] of o.wires ?? []) kit.add(M.frame, cable(V(...A), V(...B), sag ?? 1, r ?? 0.05), NC);
  for (const [A, B, op] of o.stairs ?? []) addParts(kit, M, trussStair(A, B, op));
  for (const [x, y, z, w, d, op] of o.decks ?? []) addParts(kit, M, deck(x, y, z, w, d, op));
  if (o.far) farForest(kit, M, rng, o.far);
  for (const f of o.fars ?? []) farForest(kit, M, rng, f);
  if (o.grass) grassTufts(kit, M, rng, { skip: pathAt, ...o.grass });
  for (const [x, z, r, k] of o.bushes ?? []) bush(kit, M, rng, x, z, r, k);
  if (o.traveller) traveller(kit, M, o.traveller[0], kit.H(o.traveller[0], o.traveller[1]), o.traveller[1], o.traveller[2] ?? 0);
  o.extra?.(kit, M, rng);
}

// ---------------------------------------------------------------- the sheets' pixels
// The views are placed from the sheets themselves: a point drawn at pixel (px, py) of the 1456 × 816 picture and
// standing d m down the line of sight is where the view's camera (its fov, its horizon, so its pitch) sees it there.
const SW = 1456, SH = 816;
const camOf = (cam) => { const tf = Math.tan((cam.fov * Math.PI) / 360); return { f: SH / 2 / tf, p: Math.atan((cam.horizon - 0.5) * 2 * tf), e: cam.eye }; };
/** The point drawn at (px, py) on the sheet, d m away (horizontally) along the view, in the view's frame. */
export function sheetAt(cam, px, py, d) {
  const { f, p, e } = camOf(cam), u = (px - SW / 2) / f, v = (SH / 2 - py) / f, t = d / (Math.cos(p) - v * Math.sin(p));
  return V(e[0] + t * u, e[1] + t * (Math.sin(p) + v * Math.cos(p)), e[2] - d);
}
/** Where the sheet's pixel (px, py) meets level ground at height g, in the view's frame. */
export function sheetGround(cam, px, py, g = 0) {
  const { f, p, e } = camOf(cam), u = (px - SW / 2) / f, v = (SH / 2 - py) / f, t = (g - e[1]) / (Math.sin(p) + v * Math.cos(p));
  return V(e[0] + t * u, g, e[2] - t * (Math.cos(p) - v * Math.sin(p)));
}
/** How many metres n pixels of the sheet span at distance d. */
export const sheetSpan = (cam, n, d) => (n / camOf(cam).f) * d;
/** The direction from a point toward the eye, turned up by `up` and to the side by `side` (rad): how a dish faces. */
const facing = (cam, p, up = 0, side = 0) => {
  const d = V(cam.eye[0] - p.x, 0, cam.eye[2] - p.z).normalize().applyAxisAngle(V(0, 1, 0), side);
  return d.multiplyScalar(Math.cos(up)).add(V(0, Math.sin(up), 0));
};

// ---------------------------------------------------------------- grounds
const nG = createNoise2D(51001), nG2 = createNoise2D(51002);
/** A rolling plain of violet grass, level near the eye, a mound (x, z, r, h) or two where the settlement stands. */
const plain = ({ mounds = [], roll = 1.2, tones = {}, near = [14, 45] } = {}) => ({
  height: (x, z) => {
    let h = (fbm(nG, x * 0.012, z * 0.012, 3) * roll * 2 + nG2(x * 0.05, z * 0.05) * 0.12 * roll) * smoothstep(near[0], near[1], Math.hypot(x, z));
    for (const [mx, mz, r, mh, flat = 0.5] of mounds) { const d = Math.hypot(x - mx, z - mz); h += mh * smoothstep(r, r * flat, d); }
    return h;
  },
  material: { color: tones.grass ?? T.grass, color2: tones.grass2 ?? T.grass2, color3: tones.grass3 ?? T.grass3, ticks: true },
  rings: { r1: 2200 },
});

const view = (o) => ({ sky: SKY.pale, look: ANTENNAS_VIEW_LOOK, fog: 1, ...o });
/** A mast whose foot is at the sheet's (px, pyFoot) on the ground and whose nest saucer's rim is drawn at pyTop, rw px round. */
const mastAt = (cam, px, pyFoot, pyTop, rw, o = {}) => {
  const g = sheetGround(cam, px, pyFoot, o.g ?? 0), d = -g.z, top = sheetAt(cam, px, pyTop, d), R = sheetSpan(cam, rw, d);
  return { x: g.x, z: g.z, h: Math.max(4, top.y - g.y - (o.saucer === false ? 0 : R * 0.3)), ...o, saucer: o.saucer === false ? null : { R, ...(o.saucer ?? {}) } };
};

const CAM = {
  1: { eye: [0, 2.2, 0], yaw: 0, fov: 50, horizon: 0.71 },
  2: { eye: [0, 2.0, 0], yaw: 0, fov: 50, horizon: 0.725 },
  3: { eye: [0, 2.0, 0], yaw: 0, fov: 50, horizon: 0.78 },
  4: { eye: [0, 2.0, 0], yaw: 0, fov: 50, horizon: 0.785 },
};

function view1(kit, v) {
  const c = CAM[1], A = (px, py, d) => sheetAt(c, px, py, d), G = (px, py, g = 0) => sheetGround(c, px, py, g), S = (n, d) => sheetSpan(c, n, d);
  const tv = G(515, 770);
  const dishC = A(1100, 195, 100), dishR = S(255, 100);
  const nearMast = mastAt(c, 368, 655, 168, 92, { w0: 2, w1: 0.6, legs: 4, bay: 2.2, r: 0.18, s: 0.08, vines: 0.9, hang: 0.9, seed: 1, saucer: { h: 0.25, under: 0.3, tone: 'dish', underTone: 'under', birds: 11 }, spike: 22 });
  const mound = A(1010, 600, 80);
  antennaScene(kit, v, {
    seed: 51101,
    tones: { dish: '#b0a4c6', dishNavy: '#28324f', shell: '#5c5a8c', shell2: '#6a6298' },
    traveller: [tv.x, tv.z, 0.05],
    path: { pts: [[0.5, 2], [tv.x + 0.4, tv.z + 2], [tv.x + 1.4, tv.z - 8], [5, -32], [9, -44], [12, -52]], w: 1.8 },
    towers: [
      nearMast,
      mastAt(c, 95, 610, 268, 0, { saucer: false, w0: 2.4, w1: 0.6, vines: 0.4, seed: 2, dishTop: { R: S(95, 62), depth: 0.22, az: 0.6, el: 0.95, tone: 'dish' } }),
      mastAt(c, 88, 612, 30, 0, { saucer: false, w0: 0.5, w1: 0.15, legs: 3, bay: 3, r: 0.1, s: 0.04, vines: 0, hang: 0, seed: 3 }),
      mastAt(c, 28, 600, 425, 22, { w0: 1.2, w1: 0.35, vines: 0.3, seed: 4, saucer: { tone: 'dish', underTone: 'under' } }),
      mastAt(c, 258, 598, 400, 28, { w0: 1.2, w1: 0.35, vines: 0.3, seed: 5, saucer: { tone: 'dish', underTone: 'under' } }),
      mastAt(c, 655, 596, 285, 20, { w0: 0.8, w1: 0.3, vines: 0.1, seed: 7, saucer: { tone: 'dish', underTone: 'under' } }),
      mastAt(c, 925, 590, 450, 12, { w0: 0.5, w1: 0.2, vines: 0, seed: 8, saucer: { tone: 'dish', underTone: 'under' } }),
    ],
    dishes: [
      // the immense receiver: its face to us and up a little, its feed on four legs, on its column behind the workshops
      { x: dishC.x, y: dishC.y, z: dishC.z, R: dishR, depth: 0.3, dir: facing(c, dishC, 0.32, -0.32).toArray(), feed: 'quad', tone: 'dishNavy', back: 'dishNavy', mount: 'pedestal', pedestal: M => M.dish.dishNavy, ribs: 12, seed: 11 },
      // the middle dishes on lattice legs, tilted every way, lilac grey
      ...[[600, 420, 92, 82, 1.0, 0.3], [452, 418, 110, 42, 1.1, 0.2], [738, 478, 125, 60, 0.4, -1.2], [160, 470, 85, 58, 0.5, 0.9], [1300, 425, 115, 118, 0.45, -0.9], [300, 470, 140, 40, 0.8, 0.5]].map(([px, py, d, rw, up, side], i) => {
        const p = A(px, py, d);
        return { x: p.x, y: p.y, z: p.z, R: S(rw, d), dir: facing(c, p, up, side).toArray(), mount: 'lattice', tone: 'dish', seed: 12 + i };
      }),
    ],
    domes: [[905, 600, 70, 92, 0.15], [1015, 600, 80, 100, -0.05], [1185, 600, 76, 70, -0.3], [1110, 590, 92, 100, 0, true]].map(([px, py, d, rw, rot, pale], i) => {
      const p = A(px, py, d);
      return { x: p.x, z: p.z, y: p.y, R: S(rw, d) * 0.95, tall: 0.95, rot, seed: i + 1, pale, door: !pale };
    }),
    cables: [[A(398, 238, -nearMast.z).toArray(), A(905, 330, 92).toArray(), { sag: 6, r: 0.2, leaves: 0.9, hang: 0.9, seed: 1 }]],
    wires: [[A(372, 230, -nearMast.z).toArray(), A(820, 300, 95).toArray(), 5, 0.05]],
    stairs: [
      [G(830, 652).toArray(), A(900, 604, 62).toArray(), { w: 1.6 }],
      [A(1330, 588, 76).toArray(), A(1165, 395, 96).toArray(), { w: 1.2 }],
    ],
    far: { n: 900, r0: 140, r1: 1100, spread: 1.7, h: [14, 55], caps: [0.45, 0.35, 0.2], tone: T.dish },
    grass: { n: 7000, r0: 1.5, r1: 22 },
    bushes: [...[[118, 700, 2], [205, 655, 1.5], [258, 722, 1.2], [42, 650, 1.6], [565, 655, 0.9], [610, 640, 0.8], [690, 690, 0.8], [790, 705, 1], [870, 690, 0.8], [1080, 760, 1.2], [950, 720, 0.9], [1200, 690, 0.8], [1050, 640, 0.7]].map(([px, py, r]) => { const g = G(px, py); return [g.x, g.z, r]; })],
    extra(k, M) {
      // the dark tree at the right edge, near
      const t = G(1355, 700);
      k.add(M.bush[0], bankBush(7).scale(3.4, 2.4, 3.2).translate(t.x, 2.7, t.z), NC);
      k.add(M.vine, bar(V(t.x - 0.3, -0.5, t.z), V(t.x + 0.1, 2.4, t.z - 0.2), 0.18, 0.12, 5), NC);
      k.add(M.vine, bar(V(t.x - 1.1, -0.5, t.z + 0.4), V(t.x - 0.6, 2.1, t.z + 0.1), 0.12, 0.08, 5), NC);
      void mound;
    },
  });
}

function view2(kit, v) {
  const c = CAM[2], A = (px, py, d) => sheetAt(c, px, py, d), G = (px, py, g = 0) => sheetGround(c, px, py, g), S = (n, d) => sheetSpan(c, n, d);
  const tv = G(450, 745), sc = A(1045, 158, 82), sR = S(415, 82);
  const left = mastAt(c, 365, 600, 270, 0, { saucer: false, w0: 1.1, w1: 0.5, legs: 4, bay: 2, vines: 0.6, hang: 0.9, seed: 22, spike: 8 });
  const right = mastAt(c, 466, 598, 300, 0, { saucer: false, w0: 1, w1: 0.45, legs: 4, bay: 2, vines: 0.5, hang: 0.9, seed: 23 });
  const bridgeY = A(400, 378, -left.z).y;
  const mid = mastAt(c, 662, 625, 88, 95, { w0: 1.6, w1: 0.45, legs: 3, bay: 2.6, vines: 0.7, hang: 0.8, seed: 21, saucer: { h: 0.4, under: 0.28, tone: 'dishPink', underTone: 'dishPink', birds: 9 } });
  antennaScene(kit, v, {
    seed: 51102,
    tones: { dish: '#c6b4d4', dishPink: '#e6bcc8', under: '#b4a2c8', path: '#e0b088', shell: '#c6b2c8', shell2: '#d8c0cc' },
    traveller: [tv.x, tv.z, -0.35],
    path: { pts: [[-14, -6], [tv.x - 1, tv.z - 0.5], [tv.x + 8, tv.z - 6], [16, -34], [24, -48], [26, -58]], w: 1.6 },
    saucers: [
      // the great nest saucer, its underside over the workshops, birds along its rim; its mast up through it
      { x: sc.x, y: sc.y, z: sc.z, R: sR, under: 0.3, stem: 3, tone: 'dish', underTone: 'under', birds: 30, mast: 70, trunk: { y0: 12, r: 1.6, r1: 1.2 } },
    ],
    towers: [
      mid, left, right,
      mastAt(c, 1288, 600, 470, 0, { saucer: false, w0: 0.6, w1: 0.25, legs: 3, vines: 0.3, seed: 26 }),
      mastAt(c, 1395, 598, 280, 70, { w0: 1, w1: 0.3, vines: 0.2, seed: 25, saucer: { tone: 'dishPink', underTone: 'dishPink' } }),
    ],
    dishes: [
      // the great pink dish on the left, turned to the right, on lattice legs, vines on it
      ...[[228, 362, 34, 150, 0.2, 1.05, 'dishPink'], [1240, 420, 95, 60, 0.3, -0.6, 'dish'], [770, 450, 110, 55, 0.5, 0.2, 'dishPink']].map(([px, py, d, rw, up, side, tone], i) => {
        const p = A(px, py, d);
        return { x: p.x, y: p.y, z: p.z, R: S(rw, d), depth: 0.32, dir: facing(c, p, up, side).toArray(), mount: 'lattice', tone, back: 'dish', vines: 0.5, seed: 31 + i };
      }),
    ],
    domes: [[880, 612, 66, 95, 0.2], [985, 600, 72, 115, 0], [1110, 598, 78, 140, -0.1, true], [1225, 602, 74, 105, -0.3], [1310, 612, 70, 80, -0.4, true], [1020, 500, 86, 100, 0, false, true], [1170, 495, 86, 100, 0, true, true]].map(([px, py, d, rw, rot, pale, up], i) => {
      const p = A(px, py, d);
      return { x: p.x, z: p.z, y: p.y, R: S(rw, d) * 0.95, tall: up ? 1.1 : 0.95, rot, seed: 11 + i, pale, door: !up, mast: !up };
    }),
    decks: [[...A(870, 602, 62).toArray(), 9, 3.5, { gaps: [[0, 2, 1.6]] }], [...A(1290, 598, 70).toArray(), 7, 3, {}],
      [(left.x + right.x) / 2, bridgeY, (left.z + right.z) / 2, Math.abs(right.x - left.x) + 2, 1.4, {}]],
    stairs: [[A(990, 612, 70).toArray(), A(1045, 540, 75).toArray(), { w: 1.2 }]],
    cables: [
      [A(366, 278, -left.z).toArray(), A(662, 120, -mid.z).toArray(), { sag: 3, r: 0.14, leaves: 0.7, hang: 1, seed: 2 }],
      [A(662, 120, -mid.z).toArray(), A(860, 230, 80).toArray(), { sag: 4, r: 0.14, leaves: 0.7, hang: 1, seed: 3 }],
    ],
    wires: [[A(80, 200, 48).toArray(), A(366, 290, -left.z).toArray(), 2, 0.04], [A(466, 310, -right.z).toArray(), A(662, 160, -mid.z).toArray(), 2, 0.04]],
    far: { n: 800, r0: 70, r1: 900, spread: 1.6, h: [10, 40], caps: [0.2, 0.2, 0.6], near: '#e4bccc', far: '#efdcc8', tone: '#d8b0d8' },
    grass: { n: 7000, r0: 1.5, r1: 22, tones: ['#c79ad8', '#b68ad0', '#a888c8'] },
    bushes: [[60, 790, 1.3], [140, 760, 1.6], [220, 800, 1.1], [870, 712, 0.7], [960, 712, 0.6], [1040, 718, 0.8], [1140, 712, 0.6], [1230, 718, 0.9], [1320, 710, 0.7], [1410, 720, 0.8]].map(([px, py, r]) => { const g = G(px, py); return [g.x, g.z, r, 1]; }),
    extra(k, M) {
      // the far-left flower dish on its stalk
      const f = A(80, 192, 48), R = S(70, 48);
      k.add(M.iron, bar(V(f.x, -0.5, f.z), V(f.x, f.y - R * 0.4, f.z), 0.28, 0.2, 6), NC);
      const P = saucer({ R, h: R * 0.5, under: 0.55, stem: 0.3, hang: 0.3, seed: 5 });
      addParts(k, M, moveParts(P, (g) => g.rotateX(0.25).translate(f.x, f.y, f.z)), { dishTone: 'dishPink', underTone: 'dishPink' });
      // the bridge's truss under its deck
      const x0 = Math.min(left.x, right.x), x1 = Math.max(left.x, right.x), z = (left.z + right.z) / 2, n = Math.max(4, Math.round((x1 - x0) / 1.3));
      for (let i = 0; i < n; i++) { const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n; for (const e of [-0.7, 0.7]) { k.add(M.frame, bar(V(a, bridgeY, z + e), V((a + b) / 2, bridgeY - 1, z + e), 0.04, 0.04, 3), NC); k.add(M.frame, bar(V((a + b) / 2, bridgeY - 1, z + e), V(b, bridgeY, z + e), 0.04, 0.04, 3), NC); } }
      for (const e of [-0.7, 0.7]) k.add(M.frame, bar(V(x0, bridgeY - 1, z + e), V(x1, bridgeY - 1, z + e), 0.05, 0.05, 4), NC);
    },
  });
}

function view3(kit, v) {
  const c = CAM[3], A = (px, py, d) => sheetAt(c, px, py, d), G = (px, py, g = 0) => sheetGround(c, px, py, g), S = (n, d) => sheetSpan(c, n, d);
  const tv = G(1200, 790), dc = A(1112, 232, 88), dR = S(255, 88);
  const T1 = mastAt(c, 148, 700, 92, 125, { w0: 1.4, w1: 0.7, legs: 4, bay: 2.2, r: 0.2, s: 0.09, vines: 1, hang: 1, leaves: 1.4, seed: 41, saucer: { h: 0.35, under: 0.3, tone: 'dishPink', underTone: 'under', birds: 8 }, spike: 4 });
  const T3 = mastAt(c, 562, 660, 288, 78, { w0: 1.4, w1: 0.6, legs: 4, bay: 2.4, vines: 0.9, hang: 0.8, seed: 43, saucer: { h: 0.5, under: 0.3, tone: 'dishPink', underTone: 'under', birds: 7 }, spike: 4 });
  antennaScene(kit, v, {
    seed: 51103,
    tones: { dishPink: '#e0b2b0', under: '#c49cac', iron: '#4e4434', path: '#e6b890', shell: '#c89280', shell2: '#b88a82' },
    traveller: [tv.x, tv.z, -0.25],
    path: { pts: [[12, 2], [tv.x + 0.3, tv.z + 1], [tv.x - 2, tv.z - 10], [6, -34], [14, -46], [20, -58]], w: 1.8 },
    towers: [
      T1, T3,
      mastAt(c, 432, 668, 102, 44, { w0: 0.9, w1: 0.45, legs: 4, bay: 2.4, vines: 1, hang: 0.8, seed: 42, saucer: { h: 0.3, under: 0.4, tone: 'dishPink', underTone: 'under', birds: 3 }, spike: 3 }),
      mastAt(c, 800, 642, 212, 28, { w0: 0.9, w1: 0.25, legs: 3, vines: 0.3, seed: 44, saucer: { tone: 'dishPink', underTone: 'under', birds: 2 } }),
      mastAt(c, 22, 645, 252, 32, { w0: 0.9, w1: 0.3, legs: 3, vines: 0.3, seed: 45, saucer: { tone: 'dishPink', underTone: 'under' } }),
      mastAt(c, 208, 648, 370, 28, { w0: 0.8, w1: 0.3, legs: 3, vines: 0.2, seed: 46, saucer: { tone: 'dishPink', underTone: 'under' } }),
      mastAt(c, 385, 646, 345, 22, { w0: 0.7, w1: 0.3, legs: 3, vines: 0.3, seed: 47, saucer: { tone: 'dishPink', underTone: 'under' } }),
      mastAt(c, 630, 644, 432, 32, { w0: 0.7, w1: 0.3, legs: 3, vines: 0.2, seed: 48, saucer: { tone: 'dishPink', underTone: 'under' } }),
      mastAt(c, 880, 642, 440, 22, { w0: 0.7, w1: 0.3, legs: 3, vines: 0.2, seed: 49, saucer: { tone: 'dishPink', underTone: 'under' } }),
    ],
    dishes: [
      // the pink receiver: tilted to the upper left, its feed on one long boom, on its block over the domes
      { x: dc.x, y: dc.y, z: dc.z, R: dR, depth: 0.22, dir: facing(c, dc, 0.7, -0.75).toArray(), feed: 'arm', tone: 'dishPink', back: 'under', mount: 'block', ribs: 10, seed: 51 },
      // the near tilted dish on its block and stair, left
      ...[[252, 462, 52, 140, 0.3, 1.0, 'block'], [740, 560, 150, 50, 0.4, -0.5, 'lattice'], [1080, 590, 200, 40, 0.3, 0.6, 'lattice']].map(([px, py, d, rw, up, side, mount], i) => {
        const p = A(px, py, d);
        return { x: p.x, y: p.y, z: p.z, R: S(rw, d), depth: 0.3, dir: facing(c, p, up, side).toArray(), feed: 'tripod', tone: 'dishPink', back: 'under', mount, seed: 52 + i };
      }),
    ],
    domes: [[965, 588, 64, 50, 0.1], [1045, 584, 70, 62, 0], [1135, 590, 66, 70, -0.1], [1230, 586, 68, 64, -0.2], [1332, 582, 72, 68, -0.3], [1425, 588, 68, 60, -0.4], [1180, 545, 82, 90, 0, true]].map(([px, py, d, rw, rot, back], i) => {
      const p = A(px, py, d);
      return { x: p.x, z: p.z, y: p.y, R: S(rw, d) * 0.95, tall: back ? 0.9 : 0.78, rot, seed: 21 + i, door: !back };
    }),
    stairs: [[A(955, 606, 58).toArray(), A(1000, 566, 62).toArray(), { w: 1.5 }], [G(330, 690).toArray(), A(318, 520, 50).toArray(), { w: 1 }]],
    cables: [
      [A(190, 168, -T1.z).toArray(), A(880, 412, 88).toArray(), { sag: 7, r: 0.22, leaves: 0.8, hang: 0.9, seed: 4 }],
    ],
    wires: [[A(150, 160, -T1.z).toArray(), A(432, 140, 51).toArray(), 3, 0.04], [A(170, 200, -T1.z).toArray(), A(20, 270, 120).toArray(), 6, 0.05], [A(560, 300, -T3.z).toArray(), A(800, 230, 130).toArray(), 3, 0.04]],
    far: { n: 1100, r0: 130, r1: 1100, spread: 1.8, h: [14, 60], caps: [0.65, 0.25, 0.1], near: '#d8b4c8', far: '#ecdcd0', tone: '#e4b4b8' },
    grass: { n: 7000, r0: 1.5, r1: 22, tones: ['#b08ad0', '#a07cc4', '#9478bc'] },
    bushes: [[690, 700, 0.8], [600, 720, 0.7], [520, 690, 0.9], [1250, 700, 0.9], [1330, 715, 1.2], [1420, 700, 0.8]].map(([px, py, r]) => { const g = G(px, py); return [g.x, g.z, r]; }),
  });
}

function view4(kit, v) {
  const c = CAM[4], A = (px, py, d) => sheetAt(c, px, py, d), G = (px, py, g = 0) => sheetGround(c, px, py, g), S = (n, d) => sheetSpan(c, n, d);
  const tv = G(435, 805), sc = A(915, 178, 80), sR = S(333, 80), eb = A(920, 522, 78), et = A(920, 340, 78);
  const T1 = mastAt(c, 320, 690, 125, 135, { w0: 1.4, w1: 0.5, legs: 4, bay: 2.4, vines: 0.6, hang: 0.8, seed: 61, saucer: { h: 0.45, under: 0.3, tone: 'dishBlue', underTone: 'dishBlue', birds: 5 }, spike: 12 });
  const plat = A(1282, 505, 46), stairFoot = G(1180, 715);
  antennaScene(kit, v, {
    seed: 51104,
    tones: { dishBlue: '#8aa2ae', under: '#e2a088', iron: '#5a4436', shell: '#d88e72', path: '#eaa878' },
    traveller: [tv.x, tv.z, 0.1],
    path: { pts: [[tv.x + 1, 2], [tv.x + 0.4, tv.z - 1], [tv.x + 4, tv.z - 10], [6, -36], [8, -50], [10, -62]], w: 1.6 },
    saucers: [{ x: sc.x, y: sc.y, z: sc.z, R: sR, under: 0.42, stem: 3.6, tone: 'dishBlue', underTone: 'dishBlue', birds: 6, mast: 62, trunk: { y0: et.y - 1, r: 2, r1: 1.6 }, hang: 0.6 }],
    eggs: [{ x: eb.x, z: eb.z, y: eb.y, R: S(92, 78), H: et.y - eb.y + 1, windows: 3, seed: 7 }],
    domes: [[742, 642, 70, 70, 0.35], [830, 625, 74, 80, 0.1], [1010, 620, 76, 90, -0.15], [1112, 632, 72, 70, -0.35], [925, 600, 82, 110, 0, true]].map(([px, py, d, rw, rot, back], i) => {
      const p = A(px, py, d);
      return { x: p.x, z: p.z, y: p.y, R: S(rw, d) * 0.95, tall: 1.05, rot, seed: 31 + i, door: !back };
    }),
    towers: [
      T1,
      mastAt(c, 200, 640, 385, 66, { w0: 1.6, w1: 0.5, legs: 4, vines: 0.4, seed: 62, saucer: { h: 0.5, tone: 'dishBlue', underTone: 'under' } }),
      mastAt(c, 1222, 636, 418, 86, { w0: 1.6, w1: 0.5, legs: 4, vines: 0.3, seed: 63, saucer: { h: 0.8, tone: 'dishBlue', underTone: 'under' } }),
      mastAt(c, 1420, 634, 352, 76, { w0: 1.6, w1: 0.5, legs: 4, vines: 0.3, seed: 64, saucer: { h: 0.8, tone: 'dishBlue', underTone: 'under' } }),
      // the observation platform's frame on the right, two tall masts above it
      { x: plat.x, z: plat.z, h: plat.y, w0: 2.6, w1: 2.2, legs: 4, bay: 3, vines: 0.2, hang: 0.4, seed: 65, rot: Math.PI / 4 },
      mastAt(c, 1262, 668, 0, 0, { saucer: false, w0: 0.22, w1: 0.1, legs: 3, bay: 3, r: 0.09, s: 0.035, vines: 0, hang: 0, seed: 66 }),
      mastAt(c, 1286, 668, 0, 0, { saucer: false, w0: 0.22, w1: 0.1, legs: 3, bay: 3, r: 0.09, s: 0.035, vines: 0, hang: 0, seed: 67 }),
    ],
    dishes: [[552, 500, 62, 104, 0.25, 0.25], [500, 362, 82, 66, 0.55, 0.35], [80, 452, 72, 95, 0.4, 0.8], [290, 520, 130, 60, 0.4, 0.5]].map(([px, py, d, rw, up, side], i) => {
      const p = A(px, py, d);
      return { x: p.x, y: p.y, z: p.z, R: S(rw, d), depth: 0.3, dir: facing(c, p, up, side).toArray(), mount: 'lattice', tone: 'dishBlue', back: 'under', seed: 71 + i };
    }),
    decks: [[plat.x, plat.y, plat.z, 5.6, 5.6, { gaps: [[3, 0, 1.4]] }]],
    stairs: [[stairFoot.toArray(), [plat.x - 2.8, plat.y, plat.z], { w: 1.2 }]],
    cables: [[A(368, 238, -T1.z).toArray(), A(790, 336, 78).toArray(), { sag: 5, r: 0.25, leaves: 1, hang: 1, seed: 6 }]],
    wires: [[A(1262, 60, 46).toArray(), A(1040, 140, 80).toArray(), 3, 0.04], [A(1286, 200, 46).toArray(), A(1420, 352, 140).toArray(), 5, 0.05], [A(330, 60, -T1.z).toArray(), A(200, 385, 90).toArray(), 4, 0.04]],
    far: { n: 1000, r0: 120, r1: 1100, spread: 1.7, h: [12, 50], caps: [0.5, 0.4, 0.1], near: '#9ab0b6', far: '#e6d8b8', tone: '#e8a888' },
    grass: { n: 7000, r0: 1.5, r1: 22, tones: ['#a086c8', '#9078bc', '#8670b4'] },
    bushes: [[22, 700, 0.9], [300, 760, 0.6], [1220, 735, 0.8], [1280, 745, 0.6], [1350, 730, 1], [1420, 760, 0.8]].map(([px, py, r]) => { const g = G(px, py); return [g.x, g.z, r, 1]; }),
  });
}

export const ANTENNAS_VIEWS = [
  view({
    id: 'antennas-1-receiver', title: 'The path to the workshops under the immense receiver', sheet: 'antennas-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[1], sun: { side: -165, el: 28 },
    ground: plain({ mounds: [[24, -78, 42, 3.2, 0.55]], tones: { grass: '#9c80d2', grass2: '#8c70c6', grass3: '#7660b0' } }),
    build: view1,
  }),
  view({
    id: 'antennas-2-saucer', title: 'Under the great nest saucer, the workshops on their decks', sheet: 'antennas-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[2], sun: { side: 30, el: 48 }, sky: SKY.rose,
    ground: plain({ mounds: [[30, -76, 40, 2.5, 0.6]], tones: { grass: '#c79ad8', grass2: '#b68ad0', grass3: '#9a78c0' } }),
    build: view2,
  }),
  view({
    id: 'antennas-3-nests', title: 'The vine-grown masts and their nests, the pink receiver over the domes', sheet: 'antennas-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[3], sun: { side: -55, el: 40 }, sky: SKY.lilac,
    ground: plain({ mounds: [[40, -72, 34, 2.6, 0.6]], tones: { grass: '#b08ad0', grass2: '#a07cc4', grass3: '#8a6ab4' } }),
    build: view3,
  }),
  view({
    id: 'antennas-4-egg', title: 'The great saucer, the egg and the domes, the stair to the platform', sheet: 'antennas-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[4], sun: { side: 45, el: 34 }, sky: SKY.amber,
    look: { ...ANTENNAS_VIEW_LOOK, uHazeTone: [0.96, 0.88, 0.66, 0.8] },
    ground: plain({ mounds: [[14, -76, 30, 1.6, 0.6]], tones: { grass: '#a086c8', grass2: '#9078bc', grass3: '#7a66aa' } }),
    build: view4,
  }),
];
export { ANTENNAS_SHEETS as SHEETS, ANTENNAS_VIEWS as VIEWS };
