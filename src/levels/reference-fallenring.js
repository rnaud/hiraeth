import * as THREE from 'three';
import { mulberry32, createNoise2D, fbm, smoothstep } from '../noise.js';
import { V, CLEAN_SKY, groundRibbon } from './reference-kit.js';
import { bankBush } from './wood-kit.js';
import { CLOUD_PRINT } from './arzach2.js';
import { greebles } from './greeble-kit.js';
import {
  ringThrough, tree, village, serviceStair, grazer, puff, cloudBank, moveParts, RING_LOOK, RING_TONES,
} from './fallen-ring-kit.js';

// ---------------------------------------------------------------------------
// The Fallen Ring's reference pictures (references/The Fallen Ring/reference-1 … 4): a broken orbital ring resting
// across a vast sage-green plain, its colossal curved segments rising into the sky as arches, lying in the grass as
// tubes, tilted on their broken ends; the cut sections showing the streets and parks inside; the lowest segment a
// village with awnings and warm windows; grazing beasts wandering through; trees growing from the hull's seams;
// weathered ivory and faded vermilion. Each picture is one composition: one view each. One scene builder (ringScene)
// does them all (reference-views.js describes the fields).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Fallen Ring / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Fallen Ring/reference-${n}.jpeg`, import.meta.url).href });
export const RING_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`fallenring-${n}`, sheet(n)]));

/** The pictures' ink: the world's own look (fallen-ring-kit.js); its cumulus are geometry. */
export const RING_VIEW_LOOK = { ...RING_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow (blue-green), light, sun: read off each picture */
const SKY = {
  noon: ['#5d9fb6', '#a8c8cc', '#7d9aa4', '#fff8ea', '#fff3dc'],
  deep: ['#5a98ae', '#9dd0cc', '#6f8c96', '#fff6e4', '#fff0d4'],
  pale: ['#68a8c0', '#bcd4d6', '#8aa2aa', '#fff8ee', '#fff4e0'],
  warm: ['#6aa0b4', '#b0ccd0', '#82989c', '#fff4e0', '#ffeccc'],
};
const T = RING_TONES;

function materials(kit, o = {}) {
  const DS = THREE.DoubleSide;
  return {
    // the hull: ivory plates, pen seams, its shade wrapping round the tube (form)
    hull: kit.mat({ color: o.hull ?? T.hull, shade: 0.12, hatch: 0.3, form: true, detail: 'built', detailDensity: 0.55, patches: 0.35 }),
    red: kit.mat({ color: o.red ?? T.red, shade: 0.12, hatch: 0.3, form: true, detail: 'built', detailDensity: 0.5, patches: 0.35 }),
    cut: kit.mat({ color: o.cut ?? T.cut, shade: 0.4, hatch: 0.4, side: DS }),
    inner: kit.mat({ color: o.inner ?? T.inner, shade: 0.6, hatch: 0.6, side: DS }),
    floor: kit.mat({ color: o.floor ?? T.floor, flat: true, side: DS }),
    joint: kit.mat({ color: o.joint ?? T.joint, shade: 0.12, hatch: 0.3 }),
    frame: kit.mat({ color: T.frame, flat: true, thin: 1.5 }),
    green: kit.mat({ color: o.green ?? T.green, pattern: 'leaves', hatch: 1.4, shade: 0.5, spot: 0 }),
    green2: kit.mat({ color: o.green2 ?? T.green2, pattern: 'leaves', hatch: 1.4, shade: 0.5, spot: 0 }),
    bark: kit.mat({ color: T.bark, flat: true }),
    plaster: kit.mat({ color: T.plaster, flat: true, weathered: 0.3 }),
    wood: kit.mat({ color: T.wood, flat: true }),
    dark: kit.mat({ color: T.dark, flat: true }),
    glow: kit.mat({ color: T.glow, glow: 0.95, flat: true }),
    cloth: kit.mat({ color: T.cloth, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    cloth2: kit.mat({ color: T.cloth2, side: DS, shade: 0.35, hatch: 0.2, line: 0.7, lineTint: 0.6 }),
    goods: kit.mat({ color: T.goods, flat: true }),
    wool: kit.mat({ color: T.wool, shade: 0.4, hatch: 0.3 }),
    woolDark: kit.mat({ color: T.woolDark, flat: true }),
    metal: kit.mat({ color: '#5c6a64', flat: true }),
    path: kit.mat({ color: o.path ?? T.path, shade: 0.2, hatch: 0.2, side: DS }),
    // far segments: no pen detail, a thin line of their own colour (the haze pales them)
    far: kit.mat({ color: o.far ?? T.hull, shade: 0.3, hatch: 0.15, line: 0.5, lineTint: 0.7, side: DS }),
    farRed: kit.mat({ color: o.red ?? T.red, shade: 0.3, hatch: 0.15, line: 0.5, lineTint: 0.7, side: DS }),
    cloud: kit.mat({ color: '#fffcf4', ...CLOUD_PRINT, shade: 0.78, line: 1, lineTint: 0.3, glow: 0.12 }),
    tuft: kit.mat({ color: '#ffffff', side: DS, line: 0.25, lineTint: 1, hatch: 0.3 }),
    figure: kit.mat({ color: '#5d5478', flat: true, figure: true }),
    suit: kit.mat({ color: '#6a4a3a', flat: true, figure: true }),
    pack: kit.mat({ color: '#f3a6e8', glow: 0.9, flat: true }),
    pack2: kit.mat({ color: '#9ff0d8', glow: 0.9, flat: true }),
  };
}

const NC = { solid: false, shadow: true }, NCS = { solid: false, shadow: false };
/** Every role of a builder's parts added under its material. */
function addParts(kit, M, parts, { far = false, shadow = true } = {}) {
  const by = far ? { hull: M.far, red: M.farRed, cut: M.far, inner: M.inner, floor: M.inner, joint: M.far, frame: M.frame, green: M.green }
    : { hull: M.hull, red: M.red, cut: M.cut, inner: M.inner, floor: M.floor, joint: M.joint, frame: M.frame, green: M.green, bark: M.bark, plaster: M.plaster, wood: M.wood, dark: M.dark, glow: M.glow, cloth: M.cloth, cloth2: M.cloth2, goods: M.goods, wool: M.wool };
  for (const [k, list] of Object.entries(parts)) if (Array.isArray(list) && by[k]) for (const g of list) if (g?.isBufferGeometry) kit.add(by[k], g, { solid: false, shadow: shadow && k !== 'glow' });
}

// ---------------------------------------------------------------- the sheets' pixels
// A point drawn at pixel (px, py) of the 1456 × 816 picture and standing d m down the line of sight is where the view's
// camera (its fov, its horizon, so its pitch) sees it there (as the Forest of Antennas' views are placed).
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

// ---------------------------------------------------------------- the pieces of a scene
/**
 * A segment of the ring through three points (A, M, B: [x, y, z] in the view's frame, along its centre line), run on
 * past its ends by `ext` [m, m] (an arch's legs into the ground), its section, bands, openings and ends as
 * ringSegment's; trees grown from its skin ([t, s, h, r]: the arc's share, the section's), greebles in its openings.
 */
function segment(kit, M, rng, o) {
  const P = ringThrough(o), C = P.circle;
  addParts(kit, M, P, { far: o.far });
  for (const [t, s, h, r, sd] of o.trees ?? []) {
    const q = P.at(t, s, -0.5), Tr = tree({ h, r, seed: sd ?? t * 100 + s * 10, up: q.n.clone().lerp(V(0, 1, 0), 0.7).normalize() });
    moveParts(Tr, (g) => g.translate(q.p.x, q.p.y, q.p.z));
    addParts(kit, M, { bark: Tr.bark }); for (const g of Tr.green) kit.add(rng() < 0.5 ? M.green : M.green2, g, NC);
  }
  // machinery in the openings (the greeble kit), on the inside wall
  for (const [t0, t1, s0, s1, dens, sc] of o.greebles ?? []) {
    const G = greebles(o.seed ?? 3);
    const n = Math.max(2, Math.round((t1 - t0) * P.length / 10));
    for (let k = 0; k < n; k++) {
      const t = t0 + ((t1 - t0) * (k + 0.5)) / n, q = P.at(t, (s0 + s1) / 2, -(o.wall ?? 1.8) - 0.05), q2 = P.at(t + 0.3 / n, (s0 + s1) / 2, -(o.wall ?? 1.8)), along = q2.p.clone().sub(q.p).normalize();
      const nIn = q.n.clone().negate(), side = new THREE.Vector3().crossVectors(nIn, along).normalize();
      G.patch(q.p.clone().addScaledVector(along, -4 * (sc ?? 1)).addScaledVector(side, -4 * (sc ?? 1)), along, side, nIn, 8 * (sc ?? 1), 8 * (sc ?? 1), { density: dens ?? 1, scale: 1.4 * (sc ?? 1) });
    }
    const g = G.merged();
    if (g.metal) kit.add(M.metal, g.metal, NCS); if (g.dark) kit.add(M.dark, g.dark, NCS); if (g.pale) kit.add(M.cut, g.pale, NCS);
  }
  return { P, C };
}
/** A village at a wall's foot: `at` [x, y, z] the row's middle on the ground, `yaw` its street's heading (0: toward +z). */
function villageAt(kit, M, o) {
  const Vg = village({ x0: -o.len / 2, x1: o.len / 2, seed: o.seed ?? 1, plaster: o.plaster ?? 0.6, upper: o.upper ?? 0.45, awnings: o.awnings ?? 0.75, deep: o.deep ?? [3, 5.5], high: o.high ?? [2.8, 3.6], stalls: o.stalls ?? 0.25 });
  const m = new THREE.Matrix4().makeRotationY(o.yaw ?? 0).setPosition(...o.at);
  moveParts(Vg, (g) => g.applyMatrix4(m));
  addParts(kit, M, Vg);
  for (const p of Vg.lights.slice(0, 8)) { const q = V(...p).applyMatrix4(m); kit.light(q.x, q.y, q.z, 4); }
}
/** The traveller seen from behind, the luminous pack on the back (+z of yaw: toward the camera). */
function traveller(kit, M, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 1.15, 10).translate(0, 0.6, 0), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8).translate(0, 1.4, 0), M.figure));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.45, 4, 10).translate(0, 1.15, 0.3), M.pack));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.06).translate(0.03, 1.05, 0.62), M.pack2));
  g.position.set(x, y, z); g.rotation.y = yaw;
  g.traverse((q) => { q.userData.noCollide = true; });
  kit.group.add(g);
  kit.light(x, y + 1.1, z + 0.5, 2.5);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const mat4 = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz)).clone();
/** Instanced, with a tone each (or none): [{ m, c }…] as one draw. */
function instanced(kit, geo, mat, list, name) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((it, i) => { m.setMatrixAt(i, it.m); if (it.c) m.setColorAt(i, it.c); });
  m.userData.noCollide = true; m.userData.floats = true; m.name = name;
  m.frustumCulled = false;
  kit.group.add(m);
  kit.noShadow.push(m);
  return m;
}
/** The great cumulus (cloudBank's puffs, instanced in three sizes of detail). */
function clouds(kit, M, rng, banks, eye) {
  const all = banks.flatMap((b) => cloudBank(rng, { eye: [eye[0], eye[2]], ...b }));
  for (const [list, det] of [[all.filter((p) => p.s > 75), 3], [all.filter((p) => p.s <= 75), 2]]) instanced(kit, puff(det, 3), M.cloud, list.map((p) => ({ m: mat4(p.x, p.y, p.z, p.s, p.s * p.sy, p.s * 0.8) })), 'cumulus');
}
/** Grass tufts near the camera: thin blades in the ground's tones (one draw). */
function grassTufts(kit, M, rng, { n = 2200, r0 = 1.5, r1 = 18, eye = [0, 0], tones = [T.grass, T.grass2, T.grass3], h = [0.14, 0.3], spread = 2.2 } = {}) {
  const pos = [], r2 = mulberry32(77);
  for (let k = 0; k < 5; k++) {
    const a = r2() * Math.PI * 2, o = 0.02 + r2() * 0.04, x = Math.cos(a) * o, z = Math.sin(a) * o, lx = x * 3 + (r2() - 0.5) * 0.12, lz = z * 3 + (r2() - 0.5) * 0.12, w = 0.014, hh = 0.7 + r2() * 0.3;
    pos.push(x - w, 0, z, x + w, 0, z, lx, hh, lz, x, 0, z - w, x, 0, z + w, lx, hh, lz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const C = tones.map((c) => new THREE.Color(c).multiplyScalar(0.95)), list = [];
  for (let i = 0; i < n; i++) {
    const d = r0 + Math.pow(rng(), 1.6) * (r1 - r0), a = (rng() - 0.5) * spread, x = eye[0] + Math.sin(a) * d, z = eye[1] - Math.cos(a) * d, s = h[0] + rng() * (h[1] - h[0]);
    list.push({ m: mat4(x, kit.H(x, z) - 0.03, z, s, s, s, rng() * 6), c: C[Math.floor(rng() * C.length)].clone().multiplyScalar(0.9 + rng() * 0.15) });
  }
  instanced(kit, geo, M.tuft, list, 'grass');
}
/** Grazing beasts at [x, z, yaw, s, head] on the ground (merged: the views stand still). */
function herd(kit, M, list) {
  for (const [i, [x, z, yaw = 0, s = 1, head = 'down']] of list.entries()) {
    const G = grazer(s, { head, seed: i });
    const y = kit.H(x, z) - 0.05;
    for (const g of G.wool) kit.add(M.wool, g.rotateY(yaw).translate(x, y, z), NC);
    for (const g of G.dark) kit.add(M.woolDark, g.rotateY(yaw).translate(x, y, z), NC);
  }
}

/**
 * A picture's scene. o: { seed, tones, segs: [segment opts], villages: [villageAt opts], stairs: [[A, B, opts]], trees:
 * [[x, z, h, r]], herd: [[x, z, yaw, s, head]], clouds: [cloudBank opts], path: { pts, w }, grass, bushes: [[x, z, r]],
 * traveller: [x, z, yaw], shade: [x, y, z, w, h, d] (a mass behind the camera casting the foreground's shadow), extra }
 */
function ringScene(kit, v, o) {
  const M = materials(kit, o.tones ?? {}), rng = mulberry32(o.seed ?? 1), eye = v.camera.eye;
  if (o.path) kit.add(M.path, groundRibbon((x, z) => kit.H(x, z), o.path.pts, o.path.w ?? 1.6, 0.04), NCS);
  const segs = (o.segs ?? []).map((s, i) => segment(kit, M, rng, { seed: i + 1, ...s }));
  for (const vg of o.villages ?? []) {
    if (vg.on === undefined) { villageAt(kit, M, vg); continue; }
    // (along a hull's foot: from its share t[0] to t[1], `under` m in under its side, the street toward its outside)
    const P = segs[vg.on].P, a = P.at(vg.t[0], vg.s ?? 0), b = P.at(vg.t[1], vg.s ?? 0), n = a.n.clone().add(b.n).setY(0).normalize();
    const mid = a.p.clone().lerp(b.p, 0.5).addScaledVector(n, -(vg.under ?? 0));
    villageAt(kit, M, { ...vg, at: [mid.x, kit.H(mid.x, mid.z) - 0.1, mid.z], yaw: Math.atan2(n.x, n.z), len: Math.hypot(b.p.x - a.p.x, b.p.z - a.p.z) });
  }
  for (const [A, B, op] of o.stairs ?? []) addParts(kit, M, serviceStair(A, B, op));
  for (const [x, z, h, r, y] of o.trees ?? []) { const Tr = tree({ h, r, seed: x * 3 + z }); moveParts(Tr, (g) => g.translate(x, y ?? kit.H(x, z), z)); addParts(kit, M, Tr); }
  if (o.herd) herd(kit, M, o.herd);
  if (o.clouds) clouds(kit, M, rng, o.clouds, eye);
  if (o.grass) grassTufts(kit, M, rng, { eye: [eye[0], eye[2]], ...o.grass });
  for (const [x, z, r] of o.bushes ?? []) kit.add(rng() < 0.5 ? M.green : M.green2, bankBush(x * 7 + z).scale(r, r * 0.8, r).translate(x, kit.H(x, z) + r * 0.4, z), NC);
  if (o.traveller) traveller(kit, M, o.traveller[0], kit.H(o.traveller[0], o.traveller[1]), o.traveller[1], o.traveller[2] ?? 0);
  if (o.shade) { const [x, y, z, w, h, d] = o.shade; kit.add(M.hull, new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), NC); }
  o.extra?.(kit, M, rng, segs);
}

// ---------------------------------------------------------------- grounds
const nG = createNoise2D(61101), nG2 = createNoise2D(61102);
/**
 * The plain: level near the eye, falling (or rising) to `dip` [d, y] m (the ground under the far hulls drawn where the
 * picture has their feet), mounds [x, z, r, h], gentle swells beyond.
 */
const plain = ({ dip = [120, 0], mounds = [], roll = 1, near = [16, 60], tones = {} } = {}) => ({
  height: (x, z) => {
    const d = Math.max(0, -z);
    let h = dip[1] * smoothstep(near[0], dip[0], d);
    h += (fbm(nG, x * 0.006, z * 0.006, 3) * roll * 3 + nG2(x * 0.05, z * 0.05) * 0.1 * roll) * smoothstep(near[0], near[1], Math.hypot(x, z));
    for (const [mx, mz, r, mh, flat = 0.5] of mounds) { const q = Math.hypot(x - mx, z - mz); h += mh * smoothstep(r, r * flat, q); }
    return h;
  },
  material: { color: tones.grass ?? T.grass, color2: tones.grass2 ?? T.grass2, color3: tones.grass3 ?? T.grass3, ticks: true },
  rings: { r1: 3200 },
});

const view = (o) => ({ sky: SKY.noon, look: RING_VIEW_LOOK, fog: 1, ...o });
const CAM = {
  1: { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.75 },
  2: { eye: [0, 2.2, 0], yaw: 0, fov: 50, horizon: 0.8 },
  3: { eye: [0, 2.1, 0], yaw: 0, fov: 50, horizon: 0.8 },
  4: { eye: [0, 2.0, 0], yaw: 0, fov: 50, horizon: 0.76 },
};
const helpers = (c) => ({ A: (px, py, d) => sheetAt(c, px, py, d).toArray(), G: (px, py, g = 0) => sheetGround(c, px, py, g), S: (n, d) => sheetSpan(c, n, d) });

// 1: the long tube in the grass and its village, the arch's leg rising behind it, the tilted segment on its broken foot
function view1(kit, v) {
  const c = CAM[1], { A, G, S } = helpers(c);
  const tv = G(1285, 785);
  const D = 95, top = A(500, 470, D), foot = A(500, 650, D), Rt = (foot[1] - top[1]) / -2 + 0;
  void Rt;
  const tubeR = S(95, D), cy = foot[1] + tubeR - 2;
  ringScene(kit, v, {
    seed: 61201,
    traveller: [tv.x, tv.z, -0.2],
    shade: [-30, 0, 30, 90, 14, 20],
    segs: [
      // the tube lying across the picture, its village along its foot (its outer face toward us)
      { lie: true, A: [S(-80 - 728, D), cy, -D - 2], M: [S(450 - 728, D), cy, -D + 3], B: [S(985 - 728, D), cy, -D - 4], w: tubeR * 2, h: tubeR * 2, round: 2.3, seg: 4, sseg: 36, joints: 26,
        bands: [{ t: [0.9, 1], s: [0, 1] }], ends: { 1: { rag: 3, deep: 10 } },
        // (its lower front cut away on the village built into it)
        open: [{ t: [0.03, 0.8], s: [0.86, 0.99], ribs: 18, floors: 2 }],
        trees: [[0.16, 0.22, 14, 9, 1], [0.27, 0.22, 9, 6, 2], [0.48, 0.24, 9, 5.5, 3], [0.55, 0.25, 7, 4, 4], [0.93, 0.15, 7, 4, 5]] },
      // the arch's left leg behind it, its inner face open on the terraces inside
      { A: A(360, 760, 280), M: A(500, -200, 300), B: A(1600, -900, 520), ext: [40, 0], w: 60, h: 75, round: 3.2, seg: 8, sseg: 32, joints: 60,
        open: [{ t: [0.04, 0.5], s: [0.58, 0.74], ribs: 14, mode: 'x', step: 13, scale: 2.4 }], greebles: [[0.05, 0.4, 0.6, 0.72, 1, 2.5]] },
      // the tilted segment on its crushed foot, its vermilion band, trees on it
      { A: A(1020, 700, 125), M: A(1150, 200, 135), B: A(1300, -400, 150), ext: [12, 0], w: 38, h: 36, round: 2.6, seg: 4, sseg: 36, joints: 18,
        bands: [{ t: [0, 0.22], s: [0, 1] }, { t: [0.3, 0.34], s: [0.1, 0.4] }], ends: { 0: { rag: 5, deep: 12 } }, holes: 0.25,
        trees: [[0.22, 0.42, 7, 4, 7], [0.4, 0.45, 8, 4.5, 8], [0.55, 0.4, 7, 4, 9], [0.12, 0.6, 5, 3, 10]] },
    ],
    villages: [
      { on: 0, t: [0.04, 0.78], under: 0.5, seed: 1, high: [3.4, 4.4], deep: [3, 5], upper: 0.7, plaster: 0.4 },
    ],
    stairs: [
      [[S(130 - 728, D), foot[1], -D + tubeR * 0.55 + 7], [S(230 - 728, D), foot[1] + 8, -D + tubeR * 0.55 + 1], { w: 2 }],
      [[S(560 - 728, D), foot[1], -D + tubeR * 0.55 + 7], [S(650 - 728, D), foot[1] + 7, -D + tubeR * 0.55 + 1], { w: 2 }],
      [[S(830 - 728, D), foot[1], -D + tubeR * 0.55 + 6], [S(900 - 728, D), foot[1] + 6, -D + tubeR * 0.55], { w: 1.8 }],
    ],
    trees: [[S(-60 - 728, 70), -70, 6, 4]],
    herd: [[600, 690, 0.4], [680, 678, -0.6], [700, 690, 1.2, 1.1], [790, 675, -0.2, 1.2, 'up'], [810, 680, 0.8], [925, 668, -1], [960, 676, 0.3], [1020, 678, 1.5], [1075, 668, -0.5], [650, 682, 2], [500, 662, 0.4, 0.8]].map(([px, py, yaw, s, h]) => { const g = G(px, py); return [g.x, g.z, yaw, s ?? 1, h]; }),
    clouds: [
      { n: 6, az0: 0.05, az1: 0.85, d0: 454, d1: 682, base: 42, size: [67, 118], tall: 1.3 },
      { n: 3, az0: -0.95, az1: -0.6, d0: 500, d1: 682, base: 28, size: [40, 72], tall: 0.7 },
    ],
    path: { pts: [[tv.x + 2, 4], [tv.x, tv.z], [tv.x - 8, tv.z - 8], [-6, -40], [-18, -70]], w: 1.2 },
    grass: {},
  });
}

// 2: the tubes broken open end-on, the vault and its village, the great arch overhead, a far arch on the horizon
function view2(kit, v) {
  const c = CAM[2], { A, G, S } = helpers(c);
  const tv = G(1170, 782);
  ringScene(kit, v, {
    seed: 61202, tones: { red: '#e98e74' },
    traveller: [tv.x, tv.z, 0.4],
    shade: [10, 0, 26, 120, 12, 18],
    segs: [
      // the vault lying half sunk in the grass, its village along it
      { lie: true, A: A(300, 668, 52), M: A(620, 666, 78), B: A(950, 668, 110), ext: [0, 0], w: 23, h: 23, round: 2.2, seg: 4, sseg: 36, joints: 22,
        ends: { 0: { rag: 1.5, deep: 14, floors: 2 }, 1: false }, bands: [{ t: [0.6, 0.85], s: [0.85, 0.95] }] },
      // the great tube broken open, end-on, resting on the vault: its streets and gardens inside
      { lie: true, A: A(330, 300, 92), M: A(560, 318, 150), B: A(780, 335, 215), ext: [0, 60], w: 46, h: 46, round: 2.1, seg: 5, sseg: 40, joints: 30,
        ends: { 0: { rag: 4, deep: 30, floors: 4 } }, bands: [{ t: [0.25, 0.4], s: [0.05, 0.2] }], trees: [[0.3, 0.25, 8, 5, 21]] },
      // the vermilion one cut by the picture's corner
      { lie: true, A: A(110, 160, 62), M: A(-200, 140, 90), B: A(-500, 120, 130), w: 40, h: 40, round: 2.4, seg: 5, sseg: 36, joints: 9,
        bands: [{ t: [0, 1], s: [0.05, 0.45] }], ends: { 0: { rag: 2, deep: 12, floors: 3 } } },
      // the smaller tube behind, open at its end, trees inside
      { lie: true, A: A(820, 525, 150), M: A(960, 545, 220), B: A(1100, 590, 300), ext: [0, 30], w: 30, h: 30, round: 2.2, seg: 5, sseg: 32, joints: 24,
        ends: { 0: { rag: 2, deep: 12, floors: 2 } }, holes: 0.2 },
      // the great arch overhead
      { A: A(560, 900, 520), M: A(1050, -150, 560), B: A(1800, -500, 700), ext: [80, 0], w: 60, h: 52, round: 3.5, seg: 10, sseg: 28, joints: 50, far: false },
      // the far arch on the horizon
      { A: A(990, 660, 2300), M: A(1110, 380, 2350), B: A(1235, 660, 2400), ext: [60, 60], w: 60, h: 50, round: 3, seg: 20, sseg: 14, far: true },
    ],
    villages: [{ on: 0, t: [0.04, 0.7], under: 3, seed: 2, high: [3, 4], upper: 0.3 }],
    stairs: [[G(745, 700).toArray(), A(770, 620, 82), { w: 1.6 }]],
    trees: [[S(470 - 728, 105), -105, 12, 7], [S(120 - 728, 55), -55, 9, 6], [S(60 - 728, 50), -48, 10, 5]],
    herd: [[45, 720, 0.6, 1.2], [230, 715, -0.4, 1.3], [440, 715, 1.4], [480, 712, -1.2, 0.9], [560, 700, 0.2], [330, 690, 1], [280, 670, -0.6, 0.8]].map(([px, py, yaw, s, h]) => { const g = G(px, py); return [g.x, g.z, yaw, s ?? 1, h]; }),
    clouds: [
      { n: 5, az0: 0.45, az1: 0.95, d0: 431, d1: 659, base: 21, size: [72, 118], tall: 1.4 },
      { n: 3, az0: -0.7, az1: -0.3, d0: 500, d1: 682, base: 266, size: [67, 109], tall: 1 },
    ],
    grass: {},
  });
}

// 3: the arch swooping over to its broken vermilion end, the slanted segment over the village, the stair onto it
function view3(kit, v) {
  const c = CAM[3], { A, G, S } = helpers(c);
  const tv = G(230, 782);
  ringScene(kit, v, {
    seed: 61203,
    traveller: [tv.x, tv.z, -0.3],
    shade: [0, 0, 24, 120, 10, 16],
    segs: [
      // the great arch: its foot far on the left, its broken end high on the right, its underside open on the city inside
      { A: A(40, 640, 480), M: A(640, 268, 290), B: A(1150, 262, 185), ext: [60, 0], w: 44, h: 46, round: 3.4, seg: 6, sseg: 32, joints: 60,
        bands: [{ t: [0.86, 1], s: [0.6, 0.15] }, { t: [0.0, 0.1], s: [0.6, 0.1] }],
        open: [{ t: [0.12, 0.34], s: [0.42, 0.66], ribs: 8, floors: 4 }, { t: [0.55, 0.95], s: [0.42, 0.68], ribs: 10, floors: 4 }],
        ends: { 1: { rag: 6, deep: 18, floors: 4 } }, greebles: [[0.6, 0.9, 0.45, 0.6, 1]] },
      // the slanted segment over the village, its top vermilion, its high end broken open
      { lie: true, A: A(560, 720, 70), M: A(900, 565, 95), B: A(1290, 470, 120), w: 15, h: 30, round: 3, seg: 3, sseg: 32, joints: 30,
        bands: [{ t: [0, 1], s: [0.1, 0.4] }], ends: { 0: false, 1: { rag: 3, deep: 10, floors: 2 } },
        trees: [[0.82, 0.25, 10, 7, 31], [0.6, 0.3, 5, 3, 32]] },
    ],
    villages: [{ on: 1, t: [0.45, 0.95], under: 6, seed: 3, high: [4, 5.5], upper: 0.8 }],
    trees: [[S(745 - 728, 160), -160, 14, 8], [S(600 - 728, 120), -120, 6, 4]],
    extra(k, M, rng, segs) {
      // the stair up the slanted segment's flank from the grass to its top
      const P = segs[1].P, sTop = [0.1, 0.15, 0.2, 0.3, 0.35, 0.4].map((s2) => [s2, P.at(0.3, s2)]).sort((u, w) => w[1].n.z - u[1].n.z)[0][0];
      const q = P.at(0.3, sTop, 0.1), n = q.n.clone().setY(0).normalize(), foot = q.p.clone().addScaledVector(n, Math.max(4, q.p.y * 0.9));
      addParts(k, M, serviceStair([foot.x, k.H(foot.x, foot.z), foot.z], [q.p.x, q.p.y, q.p.z], { w: 1.8 }));
    },
    herd: [[810, 680, 0.4], [870, 685, -0.4], [945, 683, 1], [1010, 682, 0.3], [1070, 683, -1], [1110, 686, 0.5, 1.1], [1260, 684, 0.2], [940, 668, 1.2, 0.8], [1060, 668, -0.3, 0.8]].map(([px, py, yaw, s, h]) => { const g = G(px, py); return [g.x, g.z, yaw, s ?? 1, h]; }),
    clouds: [
      { n: 5, az0: 0.5, az1: 0.9, d0: 431, d1: 659, base: 28, size: [67, 118], tall: 1.4 },
      { n: 2, az0: -0.2, az1: 0.1, d0: 546, d1: 682, base: 35, size: [54, 91], tall: 0.6 },
      { n: 2, az0: -0.3, az1: 0.2, d0: 500, d1: 637, base: 489, size: [63, 100], tall: 0.5 },
    ],
    path: { pts: [[tv.x - 2, 4], [tv.x, tv.z], [tv.x + 10, tv.z - 14], [24, -50], [40, -80]], w: 1.6 },
    grass: {},
  });
}

// 4: the low ring segment lying round the village, the great arch rising out of it and down behind
function view4(kit, v) {
  const c = CAM[4], { A, G, S } = helpers(c);
  const tv = G(1145, 785);
  ringScene(kit, v, {
    seed: 61204, tones: { red: '#c97650' },
    traveller: [tv.x, tv.z, 0.1],
    shade: [-40, 0, 24, 80, 10, 16],
    segs: [
      // the low band lying in its curve, its lower front cut open on the village inside
      { lie: true, A: A(90, 520, 170), M: A(700, 497, 110), B: A(1320, 590, 190), ext: [60, 60], w: 12, h: 30, round: 4, seg: 4, sseg: 36, joints: 30,
        bands: [{ t: [0, 1], s: [0.965, 0.025] }],
        trees: [[0.1, 0.25, 18, 15, 41], [0.2, 0.25, 22, 18, 42], [0.31, 0.25, 16, 13, 43], [0.6, 0.25, 8, 5, 44], [0.85, 0.25, 9, 6, 45]] },
      // the great arch rising out of it and down behind on the right, its left leg's side open on its frame
      { A: A(500, 420, 280), M: A(800, -450, 300), B: A(1100, 470, 330), ext: [80, 80], w: 50, h: 75, round: 3.2, seg: 6, sseg: 32, joints: 60,
        open: [{ t: [0.02, 0.4], s: [0.62, 0.86], ribs: 16, mode: 'x', step: 12, scale: 2.2 }], greebles: [[0.05, 0.35, 0.65, 0.85, 1.2, 2.5]] },
    ],
    villages: [{ at: [S(700 - 728, 110), 0, -110 + 8], len: S(1100, 110), seed: 4, high: [4.5, 5.5], upper: 0.9, awnings: 0.85, plaster: 0.25 }],
    stairs: [[G(880, 655).toArray(), A(930, 540, 88), { w: 1.8 }]],
    herd: [[190, 650, 0.5, 1.2], [255, 655, -0.6], [350, 655, 1.4], [690, 668, 0.2, 1.2], [800, 665, -0.4, 1.3], [840, 655, 1], [600, 660, -0.6, 0.8]].map(([px, py, yaw, s, h]) => { const g = G(px, py); return [g.x, g.z, yaw, s ?? 1, h]; }),
    clouds: [
      { n: 4, az0: 0.62, az1: 0.95, d0: 431, d1: 659, base: 42, size: [67, 109], tall: 1.3 },
      { n: 3, az0: -0.95, az1: -0.75, d0: 454, d1: 659, base: 42, size: [63, 100], tall: 1.4 },
    ],
    path: { pts: [[tv.x + 1, 4], [tv.x, tv.z], [tv.x - 6, tv.z - 10], [-8, -40], [-14, -70]], w: 1.2 },
    bushes: [[...[G(80, 740)].map((g) => [g.x, g.z])[0], 1.8]],
    extra(k, M, rng, segs) {
      // the band rests on the village: timber posts and braces up to its underside
      const P = segs[0].P;
      for (let t = 0.05; t < 0.96; t += 0.012) for (const s of [0.7, 0.8]) {
        const q = P.at(t, s, -0.3), y0 = k.H(q.p.x, q.p.z) - 0.3;
        if (q.p.y - y0 < 2) continue;
        k.add(M.wood, new THREE.CylinderGeometry(0.28, 0.32, q.p.y - y0, 5).translate(q.p.x, (q.p.y + y0) / 2, q.p.z), NC);
      }
    },
    grass: {},
  });
}

export const RING_VIEWS = [
  view({
    id: 'fallenring-1-tube', title: 'The long tube in the grass and its village, the arch’s leg behind it, the tilted segment', sheet: 'fallenring-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[1], sun: { side: -125, el: 42 },
    ground: plain({ dip: [95, -1.9] }),
    build: view1,
  }),
  view({
    id: 'fallenring-2-ends', title: 'The tubes broken open end-on, the vault and its village, the great arch overhead', sheet: 'fallenring-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[2], sun: { side: -140, el: 50 }, sky: SKY.deep,
    ground: plain({ dip: [80, 0] }),
    build: view2,
  }),
  view({
    id: 'fallenring-3-arch', title: 'The arch swooping to its broken end, the slanted segment over the village', sheet: 'fallenring-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[3], sun: { side: -160, el: 55 }, sky: SKY.pale,
    ground: plain({ dip: [80, 0] }),
    build: view3,
  }),
  view({
    id: 'fallenring-4-band', title: 'The low segment round the village, the great arch rising out of it', sheet: 'fallenring-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[4], sun: { side: 140, el: 48 }, sky: SKY.warm,
    ground: plain({ dip: [90, 0] }),
    build: view4,
  }),
];
export { RING_SHEETS as SHEETS, RING_VIEWS as VIEWS };
