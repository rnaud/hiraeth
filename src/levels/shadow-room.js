import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { DESERT_WORLD_LOOK } from '../desert-sites.js';
import { registerInteractable, PRIORITY } from '../interact.js';

// ---------------------------------------------------------------------------
// The Shadow Room: a developer's world for looking at the sun's shadows (src/shadows.js, materials.js SHADOW_GLSL),
// reached only from the Debug menu's test rooms (?level=shadows). A flat pale yard with the hard cases laid out
// along one walk (SHADOW_ROOM.path): small props round the spawn, thin poles, a grate and a fence, a colonnade
// throwing stripes, a pergola of leaf cut-outs, an arch and a balcony over a wall, a stair up to a terrace and a
// ramp down, slopes the sun grazes, a closed house with a door (light to dark), things that move (a lift, a slider,
// a pendulum, a fan, a rolling ball) and a 82 m tower whose shadow runs across all three cascades.
// The sun is held where the boards at the spawn put it (lightAt): higher / lower, round, or back to the clock.
// The shadow QC (.claude/skills/shadow-qc) walks the path and measures it against ray-traced truth.
// ---------------------------------------------------------------------------

/** The sun's presets: elevations (deg) the first board steps through, azimuths (deg) the second, hours the third. */
export const SUN = { el: [35, 20, 12, 6, 62], az: [90, 135, 180, 225, 270, 315, 0, 45], hours: [7, 9.5, 12, 15.5, 17.5] };

/** The sun's direction (towards it) from elevation and azimuth in degrees, as timeofday.js dirFrom (az 0: +z, 90: +x). */
export function sunDir(elDeg, azDeg, out = new THREE.Vector3()) {
  const el = THREE.MathUtils.degToRad(elDeg), az = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

/** The mound's height (the grazing slopes' smooth one), m. */
export const MOUND = { x: 28, z: -100, sigma: 6, h: 5 };
export const groundHeight = (x, z) => {
  const d2 = (x - MOUND.x) ** 2 + (z - MOUND.z) ** 2;
  const r = Math.hypot(x, z + 50);
  return MOUND.h * Math.exp(-d2 / (2 * MOUND.sigma ** 2)) + Math.max(0, r - 170) * 0.08;
};

/**
 * The room's plan (pure: the tests and the QC read it).
 *  - spots: the stations, each a rectangle on the ground ([x0, z0, x1, z1]) the frames and probes are counted in
 *    (the first that holds a point owns it)
 *  - path: the walk through all of them ([x, z] waypoints; `look` a stop where the camera turns round once)
 *  - receivers: the patches the QC's probes lie on: a grid of rays (from `from`, stepping `u` × nu and `v` × nv,
 *    cast along `dir`) whose first hits are the probe points
 */
export const SHADOW_ROOM = {
  spawn: [0, 0, 4],
  tower: { x: 48, z: -6, w: 4, h: 60, crown: 72, spire: 82 },
  spots: [
    { id: 'props', what: 'small props round the traveller', rect: [-4.5, -4.5, 4.5, 6.5] },
    { id: 'poles', what: 'thin poles, a grate overhead, a fence', rect: [-4.5, -8, 9, -29] },
    { id: 'colonnade', what: 'a colonnade casting stripes', rect: [-1.5, -29, 7.5, -60] },
    { id: 'foliage', what: 'a pergola of leaf cut-outs', rect: [-7.5, -60, 1.5, -70.5] },
    { id: 'arch', what: 'an arch, a balcony over a wall', rect: [-11, -70.5, 0, -87] },
    { id: 'stairs', what: 'a stair, a terrace with balusters, a ramp', rect: [-11, -87, 15, -105] },
    { id: 'slopes', what: 'slopes the sun grazes, a mound', rect: [15, -90, 44, -124] },
    { id: 'interior', what: 'a house: through the door, light to dark', rect: [23, -70.5, 37, -90] },
    { id: 'movers', what: 'a lift, a slider, a pendulum, a fan, a ball', rect: [19, -24, 42, -70.5] },
    { id: 'tower', what: 'a tower whose shadow spans the cascades', rect: [-4.5, 2, 54, -24] },
  ],
  path: [
    [0, 2], [0.5, -2, 'look'], [0.5, -9], [0, -16, 'look'], [0.8, -22], [2.3, -30], [2.3, -44, 'look'], [2.3, -59],
    [-3, -63], [-3, -66, 'look'], [-3, -70], [-3, -77], [-5.5, -79], [-5.5, -84, 'look'], [-6, -86.5],
    [-6, -91], [-6, -97.6, 'look'], [-3, -100], [-1.2, -100], [6, -100], [15, -100], [21, -100], [28, -100, 'look'], [36, -100],
    [38, -90], [30, -85], [30, -81.4], [30, -78], [30, -74.5, 'look'], [30, -78.5], [30, -82], [38, -84],
    [38, -60], [30, -56], [30, -48, 'look'], [30, -34], [36, -26], [43, -12], [43, -6, 'look'], [30, -6], [16, -6, 'look'], [6, -6], [1, 0], [0, 3],
  ],
};

// the receivers (probe patches): ground grids cast down, walls cast across. Spacing in metres.
const down = (spot, x0, z0, x1, z1, step, from = 2.2) => ({
  spot, from: [x0, from, z0], u: [step, 0, 0], v: [0, 0, -step], nu: Math.round((x1 - x0) / step), nv: Math.round((z0 - z1) / step), dir: [0, -1, 0], max: from + 2, step,
});
const across = (spot, from, u, v, nu, nv, dir, step, max = 6) => ({ spot, from, u, v, nu, nv, dir, max, step });
SHADOW_ROOM.receivers = [
  down('props', -3.5, 5, 3.5, -3.5, 0.05),
  down('poles', -2, -8.5, 8, -12, 0.05),
  down('poles', -2.5, -13.5, 2.5, -18.5, 0.05),
  down('poles', -1.5, -19.5, 2.4, -28.5, 0.06),
  down('colonnade', -1, -30, 6.5, -59, 0.08, 3.6),
  down('foliage', -6.5, -62.5, 0.5, -69.5, 0.05),
  down('arch', -5.5, -71.5, -0.5, -76.5, 0.05),
  down('arch', -9.1, -71, -4, -86, 0.07),
  across('arch', [-5, 0.15, -70.5], [0, 0, -0.1], [0, 0.1, 0], 155, 58, [-1, 0, 0], 0.1),   // the wall under the balcony, from the east
  down('stairs', -7.6, -86.5, -4.4, -95, 0.05, 5),
  across('stairs', [-7.4, 0.02, -86], [0.05, 0, 0], [0, 0.03, 0], 58, 101, [0, 0, -1], 0.04, 12),   // the risers, from the south
  down('stairs', -9.8, -95, -2, -103.8, 0.08, 5),
  down('stairs', -2, -98.4, 14.5, -101.6, 0.08, 5),
  down('slopes', 15, -92, 42, -108, 0.12, 9),
  down('slopes', 15, -109, 30, -123, 0.08, 6),
  down('interior', 25.4, -72.4, 34.6, -79.6, 0.07, 4),
  down('interior', 26, -80.2, 34, -88, 0.1),
  across('interior', [35.5, 0.2, -72.2], [0, 0, -0.1], [0, 0.1, 0], 78, 42, [-1, 0, 0], 0.1),   // the house's east wall, outside
  down('movers', 20, -28, 40, -60, 0.12),
  down('tower', -2, -1, 46, -11, 0.12),
  across('tower', [55, 0.5, -3.9], [0, 0, -0.2], [0, 0.25, 0], 21, 236, [-1, 0, 0], 0.2, 8),   // the tower's sunlit east face
];

/** The spot that holds a ground point (x, z): the first rectangle it lies in, or null. */
export function spotAt(x, z, spots = SHADOW_ROOM.spots) {
  for (const s of spots) {
    const [x0, z0, x1, z1] = s.rect;
    if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && z >= Math.min(z0, z1) && z <= Math.max(z0, z1)) return s.id;
  }
  return null;
}

// ------------------------------------------------------------------ geometry helpers (non-indexed, no uv, own normals)
const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); if (n.attributes.uv1) n.deleteAttribute('uv1'); n.computeVertexNormals(); return n; };
const box = (w, h, d, x, y, z, ry = 0, rz = 0) => clean(new THREE.BoxGeometry(w, h, d).rotateZ(rz).rotateY(ry).translate(x, y, z));
const cyl = (r, h, x, y, z, seg = 10, r2 = r) => clean(new THREE.CylinderGeometry(r, r2, h, seg).translate(x, y, z));
const ball = (r, x, y, z) => clean(new THREE.SphereGeometry(r, 16, 10).translate(x, y, z));

/** A seeded random (mulberry32): the cut-outs are the same every visit. */
function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A panel of leaf cut-outs: a w × d plate (4 cm thick) with `n` leaf-shaped holes, laid flat at y. */
export function leafPanel(w, d, n, seed, y) {
  const R = rand(seed), s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.lineTo(-w / 2, -d / 2);
  const placed = [];
  for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
    const L = 0.18 + R() * 0.5, W = L * (0.3 + R() * 0.25), a = R() * Math.PI;
    const cx = (R() - 0.5) * (w - 2 * L - 0.1), cy = (R() - 0.5) * (d - 2 * L - 0.1);
    if (placed.some((p) => Math.hypot(p[0] - cx, p[1] - cy) < (p[2] + L) * 0.62)) continue;
    placed.push([cx, cy, L]); i++;
    const h = new THREE.Path(), c = Math.cos(a), sn = Math.sin(a);
    // a leaf: two arcs meeting at its tips
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12, x = (t - 0.5) * L * 2, yy = Math.sin(t * Math.PI) * W; pts.push([x, yy]); }
    for (let k = 11; k >= 1; k--) { const t = k / 12, x = (t - 0.5) * L * 2, yy = -Math.sin(t * Math.PI) * W; pts.push([x, yy]); }
    pts.forEach(([x, yy], k) => { const X = cx + x * c - yy * sn, Y = cy + x * sn + yy * c; if (k) h.lineTo(X, Y); else h.moveTo(X, Y); });
    h.closePath();
    s.holes.push(h);
  }
  return clean(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y, 0));
}

/** A round arch over an opening: outer and inner radius, depth along z, its foot at y (the springing line). */
function archGeometry(ro, ri, depth, x, y, z) {
  const s = new THREE.Shape();
  s.moveTo(ro, 0); s.absarc(0, 0, ro, 0, Math.PI, false); s.lineTo(-ri, 0); s.absarc(0, 0, ri, Math.PI, 0, true); s.lineTo(ro, 0);
  return clean(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 }).translate(x, y, z - depth / 2));
}

/** A wedge (triangular prism): its slope rising `angle` deg toward +x over `run` m, `width` m along z, its low edge at x0. */
function wedge(angle, run, width, x0, z) {
  const H = Math.tan(THREE.MathUtils.degToRad(angle)) * run, s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(run, 0); s.lineTo(run, H); s.lineTo(0, 0);
  return clean(new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false }).translate(x0, 0, z - width / 2));
}

/**
 * The static build, by station and material: { [spot]: { stone, pale, wood, metal, leaf, tower, dark } } lists of
 * geometries (pure; the tests count them). A mesh per station and material, so each has bounds of its own: the shadow
 * passes' culler (shadows.js ShadowCuller) judges the tower, the colonnade or the poles on their own, as it would a
 * world's buildings.
 */
export function roomParts() {
  const all = {};
  const at = (spot) => (all[spot] ??= { stone: [], pale: [], wood: [], metal: [], leaf: [], tower: [], dark: [] });
  let P = at('props');
  // -- props round the spawn: crates, a bucket, a stool, bollards, a lamp post, a ball, a bench
  P.wood.push(box(0.5, 0.5, 0.5, 1.2, 0.25, 1.5), box(0.36, 0.36, 0.36, 1.25, 0.68, 1.5, 0.4), box(0.4, 0.3, 0.6, 1.9, 0.15, 0.6, 0.7));
  P.metal.push(cyl(0.18, 0.32, -1, 0.16, 1.8, 14, 0.15));
  for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) P.wood.push(cyl(0.015, 0.45, -1.6 + dx, 0.225, 0.4 + dz, 6));
  P.wood.push(box(0.38, 0.04, 0.38, -1.6, 0.47, 0.4));
  for (const x of [-2.5, 2.5]) P.stone.push(cyl(0.12, 0.9, x, 0.45, -1, 12));
  P.metal.push(cyl(0.04, 3.2, 1.5, 1.6, -2.5, 8), box(0.5, 0.06, 0.06, 1.72, 3.15, -2.5), box(0.18, 0.22, 0.18, 1.95, 3.0, -2.5));
  P.pale.push(ball(0.25, 1.1, 0.25, -0.4));
  P.wood.push(box(1.4, 0.06, 0.36, -2.2, 0.45, 2.8), box(0.06, 0.42, 0.3, -2.8, 0.21, 2.8), box(0.06, 0.42, 0.3, -1.6, 0.21, 2.8));
  P = at('poles');
  // -- thin poles (20 cm down to 6 mm), a grate overhead on four posts, a fence of 2 cm bars
  [0.1, 0.05, 0.025, 0.0125, 0.006, 0.003].forEach((r, i) => P.metal.push(cyl(r, 3, 2 + i, 1.5, -10, 8)));
  for (const [x, z] of [[-2, -14], [2, -14], [-2, -18], [2, -18]]) P.metal.push(cyl(0.05, 2.6, x, 1.3, z, 8));
  for (let i = 0; i <= 20; i++) { P.metal.push(box(4.1, 0.03, 0.03, 0, 2.62, -14 - i * 0.2)); P.metal.push(box(0.03, 0.03, 4.1, -2 + i * 0.2, 2.65, -16)); }
  for (let i = 0; i <= 66; i++) P.metal.push(box(0.02, 1.6, 0.02, 2.5, 0.8, -20 - i * 0.12));
  P.metal.push(box(0.04, 0.04, 8, 2.5, 1.6, -24), box(0.04, 0.04, 8, 2.5, 0.1, -24));
  P = at('colonnade');
  // -- the colonnade: ten columns and the beam over them (stripes across the walk west of it)
  for (let i = 0; i < 10; i++) P.stone.push(cyl(0.3, 4, 5, 2, -31 - i * 3, 16), box(0.8, 0.2, 0.8, 5, 0.1, -31 - i * 3));
  P.stone.push(box(1.1, 0.5, 28.6, 5, 4.25, -44.5));
  P = at('foliage');
  // -- the pergola: four posts and two layers of leaf cut-outs
  for (const [x, z] of [[-5.8, -63.2], [-0.2, -63.2], [-5.8, -68.8], [-0.2, -68.8]]) P.wood.push(cyl(0.08, 3.3, x, 1.65, z, 8));
  P.leaf.push(leafPanel(6, 6, 60, 7, 3.0).translate(-3, 0, -66), leafPanel(6, 6, 45, 19, 3.28).translate(-3, 0, -66));
  P = at('arch');
  // -- the arch (two piers and a round arch, walked through north) and the balcony over the wall west of it
  P.stone.push(box(0.8, 3, 1.2, -4.6, 1.5, -74), box(0.8, 3, 1.2, -1.4, 1.5, -74), archGeometry(2.0, 1.2, 1.2, -3, 3, -74));
  P.pale.push(box(0.6, 6, 16, -9.5, 3, -78), box(2.5, 0.25, 8, -7.95, 3, -78), box(1.2, 0.18, 16, -8.6, 5.9, -78));
  for (let i = 0; i <= 16; i++) P.metal.push(cyl(0.02, 0.9, -6.8, 3.55, -74.1 - i * 0.49, 6));
  P.metal.push(box(0.05, 0.05, 8, -6.8, 4.02, -78));
  P = at('stairs');
  // -- the stair (17 steps of 18 cm), the terrace with its balusters, the ramp down east
  for (let k = 0; k < 17; k++) P.stone.push(box(3, 0.18 * (k + 1), 0.5, -6, 0.09 * (k + 1), -86.75 - k * 0.5));
  P.stone.push(box(8, 3.06, 9, -6, 1.53, -99.5));
  const bal = (x, z) => P.metal.push(cyl(0.025, 1, x, 3.56, z, 6));
  for (let z = -95.1; z >= -104; z -= 0.25) if (z > -98.3 || z < -101.7) bal(-2.15, z);
  for (let x = -9.85; x <= -2.15; x += 0.25) bal(x, -103.85);
  P.metal.push(box(0.05, 0.05, 8.8, -2.15, 4.07, -99.5), box(7.7, 0.05, 0.05, -6, 4.07, -103.85));
  const ramp = Math.atan2(3.06, 16), rl = Math.hypot(3.06, 16);
  P.stone.push(box(rl, 0.3, 3.2, 6 - 0.15 * Math.sin(ramp), 1.53 - 0.15 * Math.cos(ramp), -100, 0, -ramp));
  P = at('slopes');
  // -- the slopes the sun grazes: three wedges rising east (25, 30, 33 deg; the mound is in the ground)
  [[25, -112], [30, -116.5], [33, -121]].forEach(([a, z]) => P.pale.push(wedge(a, 6, 3.4, 18, z)));
  P = at('interior');
  // -- the house: four walls (a door north, a slit window east), a roof
  const H = 4.5;
  P.pale.push(box(10, H, 0.4, 30, H / 2, -72), box(0.4, H, 8, 25, H / 2, -76));
  P.pale.push(box(4.2, H, 0.4, 27.1, H / 2, -80), box(4.2, H, 0.4, 32.9, H / 2, -80), box(1.6, H - 2.6, 0.4, 30, 2.6 + (H - 2.6) / 2, -80));
  P.pale.push(box(0.4, 3, 8, 35, 1.5, -76), box(0.4, H - 3.6, 8, 35, 3.6 + (H - 3.6) / 2, -76), box(0.4, 0.6, 2.9, 35, 3.3, -73.55), box(0.4, 0.6, 3.1, 35, 3.3, -78.45));
  P.dark.push(box(10.6, 0.4, 8.6, 30, H + 0.2, -76));
  P = at('movers');
  // -- the movers' frames: the pendulum's posts and beam
  P.metal.push(cyl(0.12, 7.4, 26.5, 3.7, -40, 10), cyl(0.12, 7.4, 33.5, 3.7, -40, 10), box(7.4, 0.3, 0.3, 30, 7.35, -40));
  P = at('tower');
  // -- the tower: a shaft, balconies up it, a lattice crown and a spire (its shadow runs west across the yard)
  const T = SHADOW_ROOM.tower;
  P.tower.push(box(T.w, T.h, T.w, T.x, T.h / 2, T.z));
  for (const y of [12, 24, 36, 48, 60]) P.tower.push(box(T.w + 2, 0.3, T.w + 2, T.x, y, T.z));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.metal.push(box(0.15, T.crown - T.h, 0.15, T.x + dx * 2.6, (T.h + T.crown) / 2, T.z + dz * 2.6));
  for (let y = T.h + 2; y <= T.crown; y += 2) for (const [w, d, dx, dz] of [[5.2, 0.1, 0, -2.6], [5.2, 0.1, 0, 2.6], [0.1, 5.2, -2.6, 0], [0.1, 5.2, 2.6, 0]]) P.metal.push(box(w, 0.1, d, T.x + dx, y, T.z + dz));
  P.tower.push(clean(new THREE.ConeGeometry(2.2, T.spire - T.crown, 8).translate(T.x, (T.crown + T.spire) / 2, T.z)));
  return all;
}

/**
 * The things that move, and where they are at time t (s): { lift, slider, pendulum, fan, ball } each { pos, rot }
 * (pure). The lift rises 3 m and back in 8 s, the slider runs 8 m and back in 10 s, the pendulum swings 0.6 rad in 4 s,
 * the fan turns 0.8 rad/s, the ball rolls 6 m and back in 7 s.
 */
export function moverPoses(t) {
  const lift = 1.5 - 1.5 * Math.cos((2 * Math.PI * t) / 8);
  const sx = 37 + 4 * Math.sin((2 * Math.PI * t) / 10);
  const sw = 0.6 * Math.sin((2 * Math.PI * t) / 4);
  const bz = -33 + 3 * Math.sin((2 * Math.PI * t) / 7);
  return {
    lift: { pos: [24, lift + 0.2, -52], rot: [0, 0, 0] },
    slider: { pos: [sx, 0.8, -45], rot: [0, 0, 0] },
    pendulum: { pos: [30, 7.2, -40], rot: [0, 0, sw] },
    fan: { pos: [24, 1.6, -38], rot: [0, t * 0.8, 0] },
    ball: { pos: [36, 0.6, bz], rot: [-(bz + 33) / 0.6, 0, 0] },
  };
}

/** A board by the spawn: a post with a slate and a glowing glyph; the interact button does `use`. */
function board(scene, at, heading, glyphColor, id, prompt, use) {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: '#b9a88e', flat: true, key: 'shadows.board' });
  const slate = makeMaterial({ color: '#2f2a33', flat: true, key: 'shadows.slate' });
  const glow = makeMaterial({ color: glyphColor, glow: 1, flat: true, key: `shadows.glyph.${id}` });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 8), stone); post.position.y = 0.8;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.08), slate); face.position.set(0, 1.75, 0); face.rotation.x = -0.2;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), glow); disc.position.set(0, 1.78, 0.05); disc.rotation.x = -0.2;
  g.add(post, face, disc);
  g.position.copy(at); g.rotation.y = heading;
  scene.add(g);
  return registerInteractable({
    id: `shadows.${id}`, priority: PRIORITY.use, range: 2.6,
    at: () => g.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
    prompt, distance: (p) => p.pos.distanceTo(g.position), use,
  });
}

export function* buildShadowRoom(scene) {
  const terrain = yield* Terrain.make({
    size: 420, seg: 210, height: groundHeight,
    material: { color: '#e7dcc6', color2: '#ece3d0', color3: '#d9cbb0', mode: MODE_TERRAIN, ripples: false, sandInk: false },
  });
  scene.add(terrain.mesh);
  yield;
  const mats = {
    stone: makeMaterial({ color: '#cbbfa8', flat: true, key: 'shadows.stone' }),
    pale: makeMaterial({ color: '#efe6d6', flat: true, key: 'shadows.pale' }),
    wood: makeMaterial({ color: '#8a6a4a', flat: true, key: 'shadows.wood' }),
    metal: makeMaterial({ color: '#5d6470', flat: true, key: 'shadows.metal' }),
    leaf: makeMaterial({ color: '#6f9a5a', flat: true, side: THREE.DoubleSide, key: 'shadows.leaf' }),
    tower: makeMaterial({ color: '#d9b49a', flat: true, key: 'shadows.tower' }),
    dark: makeMaterial({ color: '#7a6658', flat: true, key: 'shadows.roof' }),
    mover: makeMaterial({ color: '#3f9a92', flat: true, key: 'shadows.mover' }),
  };
  const statics = [];
  for (const [spot, byMat] of Object.entries(roomParts())) for (const [k, list] of Object.entries(byMat)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeGeometries(list), mats[k]);
    m.name = `Shadow room ${spot} ${k}`;
    if (k === 'leaf') m.userData.noCollide = true;
    statics.push(m);
  }
  scene.add(...statics);
  yield;
  // the movers: shapes of their own, moved every frame (moverPoses); the lift and the slider stand you on them
  const movers = {
    lift: new THREE.Mesh(clean(new THREE.BoxGeometry(3, 0.4, 3)), mats.mover),
    slider: new THREE.Mesh(clean(new THREE.BoxGeometry(3, 0.4, 3)), mats.mover),
    pendulum: new THREE.Mesh(mergeGeometries([cyl(0.04, 4.2, 0, -2.1, 0, 6), ball(0.5, 0, -4.6, 0)]), mats.metal),
    fan: new THREE.Mesh(mergeGeometries([cyl(0.12, 0.3, 0, 0, 0, 10), box(3.2, 0.05, 0.36, 1.7, 0, 0), box(3.2, 0.05, 0.36, -1.7, 0, 0), box(0.36, 0.05, 3.2, 0, 0, 1.7), box(0.36, 0.05, 3.2, 0, 0, -1.7)]), mats.mover),
    ball: new THREE.Mesh(ball(0.6, 0, 0, 0), mats.pale),
  };
  const fanPost = new THREE.Mesh(cyl(0.08, 1.5, 24, 0.75, -38, 8), mats.metal);
  scene.add(fanPost);
  for (const [k, m] of Object.entries(movers)) { m.name = `Shadow room ${k}`; m.userData.noCollide = true; m.userData.dynamic = true; m.matrixAutoUpdate = true; scene.add(m); }
  const solids = [
    { solid: { pos: new THREE.Vector3(), r: 1.5, top: 0, bottom: 0, vel: new THREE.Vector3() }, mesh: movers.lift },
    { solid: { pos: new THREE.Vector3(), r: 1.5, top: 0, bottom: 0, vel: new THREE.Vector3() }, mesh: movers.slider },
  ];
  let frozen = false, moverT = 0;
  const pose = (dt) => {
    const P = moverPoses(moverT);
    for (const [k, m] of Object.entries(movers)) { m.position.fromArray(P[k].pos); m.rotation.set(...P[k].rot); }
    for (const s of solids) {
      const d = s.solid, prev = d.pos.clone();
      d.pos.copy(s.mesh.position); d.top = s.mesh.position.y + 0.2; d.bottom = s.mesh.position.y - 0.2;
      if (dt > 0) d.vel.copy(d.pos).sub(prev).divideScalar(dt); else d.vel.set(0, 0, 0);
    }
  };
  pose(0);
  yield;

  // the sun: held by the boards (manual: elevation and azimuth), or the clock's
  const sun = { manual: true, el: SUN.el[0], az: SUN.az[0], hour: 10 };
  const sky = () => (typeof window !== 'undefined' ? window : {});
  const setHour = (h) => { const w = sky(); if (w.sky) { w.sky.hour = h; w.updateSky?.(); } };
  const offs = [];
  const at = (x, z) => new THREE.Vector3(x, groundHeight(x, z), z);
  // (by the spawn, west of it, facing east: the sun's height, its bearing, the clock, the movers)
  offs.push(board(scene, at(-3.2, 4.6), Math.PI / 2, '#ffd36b', 'sun-height',
    () => `sun lower (now ${sun.manual ? `${sun.el}°` : 'the clock'})`,
    () => { const i = SUN.el.indexOf(sun.el); sun.el = SUN.el[(i + 1) % SUN.el.length]; sun.manual = true; }));
  offs.push(board(scene, at(-3.2, 3.2), Math.PI / 2, '#ff9b5e', 'sun-bearing',
    () => `turn the sun (now from ${sun.az}°)`,
    () => { const i = SUN.az.indexOf(sun.az); sun.az = SUN.az[(i + 1) % SUN.az.length]; sun.manual = true; }));
  offs.push(board(scene, at(-3.2, 1.8), Math.PI / 2, '#8ecbff', 'clock',
    () => (sun.manual ? 'follow the clock' : `time of day (now ${sun.hour}:00)`),
    () => { if (sun.manual) sun.manual = false; else { const i = SUN.hours.indexOf(sun.hour); sun.hour = SUN.hours[(i + 1) % SUN.hours.length]; } setHour(sun.hour); }));
  offs.push(board(scene, at(-3.2, 6.0), Math.PI / 2, '#71d7cf', 'movers',
    () => (frozen ? 'start the movers' : 'stop the movers'),
    () => { frozen = !frozen; }));

  const api = {
    sun,
    /** The sun held at elevation / azimuth (deg). */
    setSun(el, az) { sun.manual = true; sun.el = el; sun.az = az; },
    /** The sun given back to the clock, at `hour`. */
    useClock(hour) { sun.manual = false; sun.hour = hour; setHour(hour); },
    freeze(on = true) { frozen = on; },
    get frozen() { return frozen; },
    movers: Object.values(movers),
    plan: SHADOW_ROOM,
  };

  return {
    id: 'shadows',
    ground: terrain,
    spawn: new THREE.Vector3(...SHADOW_ROOM.spawn),
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 190,
    shipSite: { x: -40, z: 30, heading: 0 },   // (out of the way, south-west of the yard)
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 10, preset: 'Moebius print', cloudShadows: 0, look: DESERT_WORLD_LOOK },
    killY: -Infinity,
    keepClear: () => true,   // (no flowers, plants or wildlife anywhere: nothing but what is measured)
    reactions: false,
    foes: { wild: false },
    shadowRoom: api,   // (the shadow QC drives the sun and reads the plan and the movers through this)
    lightAt(p, dir) { if (sun.manual) sunDir(sun.el, sun.az, dir); },
    dynamic: () => solids,
    sky: {
      script: {
        day: ['#9fbcc6', '#dfe3d6', '#9fb0cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.6, name: 'The Shadow Room' }),
    update(dt) {
      if (!frozen) moverT += dt;
      pose(frozen ? 0 : dt);
    },
    dispose() { for (const f of offs) f(); },
  };
}
export const createShadowRoom = stepped(buildShadowRoom);
