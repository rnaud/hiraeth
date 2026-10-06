import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODE_STRATA, MODE_TERRAIN } from '../materials.js';
import { createNoise2D, mulberry32 } from '../noise.js';
import { table, needle, boulder, lumpy, place, TAU } from './sky-stones-kit.js';
import { bridge, SKY_STONES_HAZE } from './arzach2.js';
import { buildBird } from '../bird.js';
import { smoothstep, PERSON, CLEAN_SKY } from './reference-kit.js';

// ---------------------------------------------------------------------------
// Vael II's reference sheets (references/Vael II- The Sky Stones/IMG_3783 … 3788): bone-white needle
// spires against a peach or aqua sky, mushroom tables and balanced eggs over a sea of cloud, cliff-top
// monasteries and aqueducts, and the peach plain running to a lone tower. One scene builder
// (vaelScene) does them all; each panel is a view (reference-views.js describes the fields).
//
// The sheets print every shade, whatever the surface's colour (cream, peach, rose), in one flat
// grey-blue at the surface's value (uShadowFlat), barely hatched on the spires and the walls, and
// hatch densely only under the caps, the overhangs and the cliffs' faces.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `Vael II, the Sky Stones / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/Vael II- The Sky Stones/${name}.JPG`, import.meta.url).href });
export const VAEL2_SHEETS = Object.fromEntries(['IMG_3783', 'IMG_3784', 'IMG_3785', 'IMG_3786', 'IMG_3787', 'IMG_3788'].map((n) => [n, sheet(n)]));

/**
 * The sheets' ink: shadows printed flat in their grey-blue, the undersides of caps and overhangs the
 * darkest (no bounce lifting them), little half-tone, a clean sky.
 */
export const VAEL2_LOOK = { ...CLEAN_SKY, uShadowFlat: 0.85, uShadeKeep: 0, uHalftone: 0.15, uBounce: 0, ...SKY_STONES_HAZE };
/** sky top, sky horizon, shadow (the flat grey-blue), light, sun */
const TINT = '#93a5a8';
const SKY = {
  aqua: ['#9fc6c8', '#b3cfcc', TINT, '#ffffff', '#fff6dc'],
  peach: ['#fbbf99', '#fcc8a6', TINT, '#ffffff', '#fff6dc'],
  salmon: ['#f4a184', '#f6ae91', TINT, '#ffffff', '#fff2dc'],
  lilac: ['#aec7d9', '#bed2dc', TINT, '#ffffff', '#fff6dc'],
};
const nV = createNoise2D(37831), nW = createNoise2D(37832);

function materials(kit) {
  const DS = THREE.DoubleSide;
  const strata = (c1, c2, c3, o = {}) => kit.mat({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: 6, flat: true, side: DS, ...o });
  return {
    // (the spires' and the stones' shade: flat tone, few strokes)
    bone: strata('#fbe3ca', '#f8dcc2', '#fde9d4', { hatch: 0.35, strataHatch: 0 }),
    pink: strata('#f6d3c2', '#f2c8b6', '#f9dccd', { hatch: 0.35, strataHatch: 0 }),
    // (smooth: the caps' and the overhangs' undersides, densely hatched)
    cap: kit.mat({ color: '#fbe0c6', color2: '#f8d9bf', color3: '#fde8d3', mode: MODE_STRATA, strataSize: 5, side: DS }),
    peach: kit.mat({ color: '#f9bea0', color2: '#f6b596', color3: '#fbc8ad', mode: MODE_STRATA, strataSize: 5, side: DS }),
    rose: strata('#d99582', '#d08a78', '#e2a48f', { strataSize: 9 }),
    aq: strata('#efd2c2', '#e8c6b6', '#f3dccd', { strataSize: 2.6 }),
    wall: kit.mat({ color: '#fbf1e2', flat: true, pattern: 'facade', windows: 0.25, weathered: 0.5 }),
    plain: kit.mat({ color: '#f8ecdc', flat: true }),
    roof: kit.mat({ color: '#d0705a', flat: true, pattern: 'tiles' }),
    dome: kit.mat({ color: '#d77f62', flat: true }),
    dark: kit.mat({ color: '#3c4660', flat: true }),
    tree: kit.mat({ color: '#4f6a58', flat: true }),
    tower: strata('#f9ecda', '#f2e1cb', '#fcf3e6', { strataSize: 9, side: THREE.FrontSide }),
    // the cloud: a warm white, its shade a pale grey-blue (lifted), no strokes, a thin line in its own shade's blue
    cloud: kit.mat({ color: '#fff4ea', shade: 0.55, hatch: 0, spot: 0, line: 0.45, lineTint: 1 }),
    pinkCloud: kit.mat({ color: '#fbdccd', shade: 0.55, hatch: 0, spot: 0, line: 0.45, lineTint: 1 }),
    cloak: kit.mat({ color: PERSON.cloak, flat: true }),
    hidden: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  };
}

// ---------------------------------------------------------------- builders (the view's own frame)
/** A smooth surface (the caps): weld, then smooth normals. */
export const smooth = (g) => { const m = mergeVertices(g, 1e-3); m.computeVertexNormals(); return m; };

/** A cluster of needles round (x, z) from y: the main one H high, n round it (fused ones lean on it). */
function spires(kit, M, { x, z, y, H, R, n = 5, seed = 1, rubble = true, mat = 'bone' }) {
  const r2 = mulberry32(seed * 97 + 3), m = M[mat];
  kit.add(m, needle({ x, y, z, H, R, seed: seed + 0.1, seg: 18, rings: 28, lean: (r2() - 0.5) * 0.08 }).vis);
  for (let i = 0; i < n; i++) {
    const fused = i < Math.ceil(n / 2), a = r2() * TAU, d = R * (fused ? 0.55 + r2() * 0.4 : 1.3 + r2() * 1.8);
    const h = H * (fused ? 0.22 + r2() * 0.4 : 0.15 + Math.pow(r2(), 1.3) * 0.55), rr = R * (fused ? 0.4 + r2() * 0.25 : 0.3 + r2() * 0.35);
    kit.add(m, needle({ x: x + Math.cos(a) * d, y: y - 1, z: z + Math.sin(a) * d, H: h, R: rr, seed: seed + i * 1.37 + 0.5, seg: 14, rings: 20, lean: (r2() - 0.5) * 0.25 }).vis);
  }
  if (!rubble) return;
  for (let i = 0; i < 8 + n; i++) {
    const a = r2() * TAU, d = R * (0.6 + r2() * 2.2), br = R * (0.18 + r2() * 0.3);
    kit.add(M[rubble === true ? mat : rubble], place(boulder(br, 1 + r2() * 0.4, 0.65 + r2() * 0.3, 0.9 + r2() * 0.3, 0.1, seed + i), x + Math.cos(a) * d, y + br * 0.3, z + Math.sin(a) * d, r2() * TAU));
  }
}

/**
 * A mushroom table (or a cliff, a plateau: a table with a wide stalk): sky-stones-kit's table, its cap
 * smooth for the caps' clean terminator; a shrunken copy casts the shadow, so the cap never shadows its rim.
 */
function mushroom(kit, M, o) {
  const mat = M[o.mat ?? 'cap'];
  const t = table({ seg: 128, colSeg: 18, rib: o.R * 0.04, ribK: 30, flute: 0.1, fluteK: 11, foot: 1.5, neckR: 1.25, waist: 0.22, dome: o.R * 0.07,
    capT: o.R * 0.13, under: o.R * 0.3, stalk: o.R * 0.32, outline: 0.08, base: (o.top ?? 0) - 160, ...o });
  // squash: [sx, sz] about its axis (a cliff's overhang wider than it is deep)
  const fit = (g) => (o.squash ? g.translate(-o.x, 0, -o.z).scale(o.squash[0], 1, o.squash[1]).translate(o.x, 0, o.z) : g);
  if (o.smooth === false) { kit.add(mat, fit(t.vis)); return t; }
  kit.add(mat, smooth(fit(t.vis)), { shadow: false });
  kit.add(M.hidden, fit(t.shadow), { solid: false });
  return t;
}

/** Balanced stones stacked from y: [[r, squash, egg]…]; returns the top. */
function stones(kit, M, x, y, z, list, seed, mat = 'bone') {
  const r2 = mulberry32(seed * 31 + 1);
  let yy = y, ox = 0, oz = 0;
  for (const [r, sy, egg] of list) {
    const tilt = (r2() - 0.5) * 0.25;
    yy += r * sy * 0.92;
    kit.add(M[mat], place(boulder(r, 1 + r2() * 0.25, sy, 0.85 + r2() * 0.3, egg, seed + yy), x + ox, yy, z + oz, r2() * TAU, 1, 1, 1, tilt, -tilt));
    yy += r * sy * 0.92;
    ox += (r2() - 0.5) * r * 0.35; oz += (r2() - 0.5) * r * 0.35;
  }
  return yy;
}

/** A thin disc of stone (a mushroom cap with hardly a stalk), its top at y. */
function disc(kit, M, x, y, z, R, th, seed, mat = 'cap') {
  mushroom(kit, M, { x, z, R, top: y, base: y - th * 2.5, capT: th, under: th * 0.6, dome: th * 0.3, stalk: R * 0.18, seed, rib: 0.4, ribK: 20, seg: 64, colSeg: 12, foot: 1, neckR: 1, waist: 0, outline: 0.04, mat });
}

/** A floating island: a rough cone hanging under a flat top at y. */
function island(kit, M, { x, y, z, R, depth = R * 1.6, seed = 9, mat = 'bone' }) {
  const rs = [[-1, 0.06], [-0.94, 0.2], [-0.82, 0.38], [-0.64, 0.57], [-0.44, 0.74], [-0.24, 0.88], [-0.1, 0.97], [-0.03, 1.02], [-0.006, 0.975]]
    .map(([t, s]) => ({ y: y + t * depth, r: R * s, ox: 0, oz: 0 }));
  for (const k of [0.9, 0.7, 0.45, 0.2]) rs.push({ y: y + 0.8 * (1 - k * k), r: R * k, ox: 0, oz: 0 });
  const g = new THREE.BufferGeometry(), pos = [];
  const P = rs.map((rg) => Array.from({ length: 72 }, (_, j) => {
    const a = (j / 72) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    let m = 1 + 0.16 * nV(ca * 1.3 + seed, sa * 1.3 + rg.y * 0.02);
    if (rg.y < y - 2) m *= 1 - 0.1 * Math.pow(0.5 + 0.5 * Math.sin(13 * a + 2 * nW(ca, sa + rg.y * 0.05)), 3);
    return [x + ca * rg.r * m, rg.y, z + sa * rg.r * m];
  }));
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < 72; j++) { const j2 = (j + 1) % 72; tri(P[i][j], P[i + 1][j], P[i][j2]); tri(P[i][j2], P[i + 1][j], P[i + 1][j2]); }
  const top = [x, y + 0.8, z], tip = [x + 2, y - depth - 3, z + 1], L = P[P.length - 1], F = P[0];
  for (let j = 0; j < 72; j++) { tri(L[j], top, L[(j + 1) % 72]); tri(F[j], F[(j + 1) % 72], tip); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  kit.add(M[mat], g);
}

/**
 * A monastery on a cliff top at (x, y, z) turned by yaw: kind 'tower' (a tall bell tower and its
 * houses), 'chapel' (a domed chapel), 'palace' (domes and towers along the edge), 'church' (a domed
 * church between two round towers, a cross), s its scale.
 */
function monastery(kit, M, { x, y, z, yaw = 0, kind = 'tower', s = 1 }) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const P = (dx, dz) => [x + (dx * c + dz * sn) * s, z + (-dx * sn + dz * c) * s];
  const box = (m, dx, dy, dz, w, h, d, ry = 0) => { const [px, pz] = P(dx, dz); kit.add(M[m], place(new THREE.BoxGeometry(w * s, h * s, d * s), px, y + (dy + h / 2) * s, pz, yaw + ry)); };
  const gable = (dx, dy, dz, w, d, ry = 0) => { const [px, pz] = P(dx, dz); kit.add(M.roof, place(new THREE.BoxGeometry(w * 0.7071 * 1.08 * s, w * 0.7071 * 1.08 * s, d * 1.06 * s).rotateZ(Math.PI / 4).scale(1, 0.42, 1), px, y + dy * s, pz, yaw + ry)); };
  const house = (dx, dz, w, h, d, ry = 0) => { box('wall', dx, -2, dz, w, h + 2, d, ry); gable(dx, h, dz, w, d, ry); };
  const domed = (dx, dy, dz, r, drum) => {
    const [px, pz] = P(dx, dz);
    kit.add(M.plain, place(new THREE.CylinderGeometry(r * s, r * s, drum * s, 16), px, y + (dy + drum / 2) * s, pz));
    kit.add(M.dome, place(new THREE.SphereGeometry(r * 1.06 * s, 16, 8, 0, TAU, 0, Math.PI / 2), px, y + (dy + drum) * s, pz, 0, 1, 0.9, 1));
    kit.add(M.wall, place(new THREE.CylinderGeometry(r * 0.12 * s, r * 0.16 * s, r * 0.6 * s, 6), px, y + (dy + drum + r * 1.25) * s, pz));
  };
  const belltower = (dx, dz, w, h, round = false) => {
    const [px, pz] = P(dx, dz);
    if (round) kit.add(M.plain, place(new THREE.CylinderGeometry(w / 2 * s, w / 2 * 1.06 * s, (h + 2) * s, 14), px, y + (h / 2 - 1) * s, pz));
    else box('plain', dx, -2, dz, w, h + 2, w);
    for (const [ox, oz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) box('dark', dx + ox * w * 0.47, h - w * 1.05, dz + oz * w * 0.47, oz ? w * 0.36 : 0.4, w * 0.62, ox ? w * 0.36 : 0.4);
    kit.add(M.wall, place(round ? new THREE.CylinderGeometry(w * 0.6 * s, w * 0.6 * s, 0.5 * s, 14) : new THREE.BoxGeometry(w * 1.15 * s, 0.5 * s, w * 1.15 * s), px, y + (h + 0.25) * s, pz, yaw));
    kit.add(M.dome, place(new THREE.SphereGeometry(w * 0.52 * s, 14, 7, 0, TAU, 0, Math.PI / 2), px, y + (h + 0.5) * s, pz, 0, 1, round ? 0.9 : 0.75, 1));
  };
  const cypress = (dx, dz, h) => { const [px, pz] = P(dx, dz); kit.add(M.tree, place(new THREE.ConeGeometry(h * 0.16 * s, h * s, 7), px, y + h / 2 * s, pz)); };
  if (kind === 'tower') {
    belltower(-6, 0, 5, 30);
    house(4, 2, 12, 8, 16); domed(-16, 0, 8, 5, 7); box('wall', -16, -2, 8, 12, 9, 12);
    house(14, -4, 8, 6, 9, Math.PI / 2); house(-24, -6, 8, 5, 8, 0.2);
    cypress(-28, 6, 9); cypress(22, 4, 8);
  } else if (kind === 'chapel') {
    box('wall', 0, -2, 0, 8, 9, 8); domed(0, 7, 0, 3.4, 2.5); house(7, 1, 5, 4, 7, Math.PI / 2); house(-6, -2, 5, 4, 5);
  } else if (kind === 'palace') {
    box('wall', 0, -2, 0, 16, 14, 14); domed(0, 12, 0, 6.5, 5);
    belltower(-14, 2, 4, 26, true); belltower(16, -2, 4, 32, true); belltower(26, 0, 3.4, 20, true);
    house(-24, 0, 10, 8, 12); house(8, 10, 12, 7, 8, Math.PI / 2); box('wall', 34, -2, 2, 10, 8, 12); domed(34, 6, 2, 3.6, 2);
    house(-34, 2, 8, 5, 8, 0.3);
  } else if (kind === 'church') {
    box('wall', 0, -2, 0, 14, 12, 14); domed(0, 10, 0, 6, 4.5); house(0, 11, 10, 8, 10, Math.PI / 2);
    belltower(-11, -6, 4.5, 22, true); belltower(11, -6, 4.5, 18, true);
    box('wall', -0.25, 21, -0.25, 0.5, 3.2, 0.5); box('wall', -1, 22.6, -0.25, 2, 0.5, 0.5);
  }
}

/** An aqueduct or a natural arch across (arzach2.js bridge), broken parapets along an aqueduct. */
function aqueduct(kit, M, o) {
  const br = bridge({ seed: 1, ...o });
  kit.add(M[o.mat ?? 'aq'], br.g);
  if (!o.parapets) return;
  for (let i = 4; i < br.S.length - 4; i += 3) {
    const s = br.S[i];
    for (const side of [-1, 1]) {
      if (nV(i * 0.21 + side * 7, o.seed ?? 0) < -0.05) continue;
      const h = 0.7 + nW(i * 0.5, side) * 0.35;
      kit.add(M[o.mat ?? 'aq'], place(new THREE.BoxGeometry(0.8, h, 3.3), s.cx + br.px * side * (s.w * 0.5 - 0.4), s.top + h / 2, s.cz + br.pz * side * (s.w * 0.5 - 0.4), Math.atan2(br.ux, br.uz)));
    }
  }
}

/** The lone tower on the plain (arzach2.js's, s its scale), standing on the ground at (x, z). */
function loneTower(kit, M, x, z, s = 1) {
  const base = kit.base(x, z, 12 * s), H = 150 * s;
  const cyl = (rt, rb, h, y, seg = 14) => kit.add(M.tower, place(new THREE.CylinderGeometry(rt * s, rb * s, h * s, seg, 1), x, base + y * s, z));
  cyl(5.5, 9, 150, 73); cyl(15, 13, 2, 140, 18); cyl(8, 8, 9, 145.5); cyl(11, 9, 1.5, 150.5, 18); cyl(3, 3, 5, 153.5, 10); cyl(6.5, 6.5, 0.8, 156.2);
  kit.add(M.tower, place(new THREE.ConeGeometry(1.8 * s, 26 * s, 8), x, base + H + 19 * s, z));
  cyl(14, 16, 3, 0, 16);
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; kit.add(M.dark, place(new THREE.BoxGeometry(2.2 * s, 4 * s, 1 * s), x + Math.cos(a) * 7.9 * s, base + H - 6 * s, z + Math.sin(a) * 7.9 * s, -a + Math.PI / 2)); }
  kit.add(M.plain, place(new THREE.BoxGeometry(14 * s, 4 * s, 8 * s), x + 22 * s, base + 1 * s, z + 6 * s, 0.3));
}

/**
 * A sea of cloud in front of the camera: cauliflower puffs (a big one and lobes round it) on a deck
 * at y, from `near` to `far` metres out, within `spread` degrees either side of the line of sight
 * (local -z turned by `yaw`); `at`: [x, z] the camera; `pink`: the warmer clouds.
 */
export function cloudSea(kit, M, { y, near = 40, far = 1600, spread = 70, at = [0, 0], yaw = 0, n = 260, size = [10, 26], seed = 1, pink = false, deck = true, avoid = [] }) {
  const r2 = mulberry32(seed * 13 + 5), mat = pink ? M.pinkCloud : M.cloud;
  const geo = (detail) => { const g = new THREE.IcosahedronGeometry(1, detail); lumpy(g, 0.09, 1.8, detail + seed); return smooth(g); };
  const fine = geo(3), hi = geo(2), lo = geo(1);
  for (let i = 0; i < n; i++) {
    const u = r2(), d = near * Math.pow(far / near, u), a = (yaw + (r2() * 2 - 1) * spread) * Math.PI / 180;
    const x = at[0] + Math.sin(a) * d, z = at[1] - Math.cos(a) * d;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const s = (size[0] + r2() * (size[1] - size[0])) * (0.6 + 0.8 * u) * (r2() < 0.1 ? 1.4 : 1), sy = 0.62 + r2() * 0.2;
    const y0 = y + (r2() - 0.5) * s * 0.3;
    const g = d < near * 1.6 ? fine : d < near * 4 ? hi : lo;
    const puff = (px, py, pz, ps, psy) => kit.add(mat, g.clone().scale(ps, ps * psy, ps * (0.85 + r2() * 0.3)).translate(px, py, pz), { solid: false, shadow: false });
    puff(x, y0, z, s, sy);
    const lobes = 2 + Math.floor(r2() * 4);
    for (let k = 0; k < lobes; k++) {
      const b = r2() * TAU, rr = s * (0.6 + r2() * 0.45), ls = s * (0.4 + r2() * 0.3);
      puff(x + Math.cos(b) * rr, y0 - ls * 0.2, z + Math.sin(b) * rr, ls, 0.65 + r2() * 0.2);
    }
    if (r2() < 0.55) puff(x + (r2() - 0.5) * 0.4 * s, y0 + s * 0.42, z + (r2() - 0.5) * 0.4 * s, s * (0.45 + r2() * 0.15), 0.8);
  }
  // a deck between the puffs hides the chasm's floor
  if (deck) kit.add(mat, new THREE.CircleGeometry(far * 1.3, 48).rotateX(-Math.PI / 2).translate(at[0], y - 4, at[1]), { solid: false, shadow: false });
}

/** The bird, standing or flying (wings spread), s its scale; a rider in the panels' violet on its saddle. */
function bird(kit, M, { at, yaw = 0, s = 1, fly = false, rider = false }) {
  const b = buildBird();
  // ([x, z]: standing on the ground; [x, y, z]: in the air)
  b.root.position.set(...(at.length === 2 ? [at[0], kit.H(at[0], at[1]) + 0.92 * s, at[1]] : at));
  b.root.rotation.y = yaw;
  b.root.scale.setScalar(s);
  // (bird.js' poses: wings folded on the ground, spread and the legs tucked in the air)
  if (fly) { for (const w of b.wings) { w.shoulder.rotation.z = w.side * 0.12; w.elbow.rotation.y = w.side * 0.12; } for (const l of b.legs) l.rotation.x = -1.25; }
  else for (const w of b.wings) { w.shoulder.rotation.set(0, w.side * 1.12, -w.side * 0.24); w.elbow.rotation.y = w.side * 1.5; }
  if (rider) {
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 10).translate(0, 0.5, 0), M.cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.22, 0), M.cloak);
    b.seat.add(cloak, head);
  }
  b.root.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(b.root);
}

/**
 * A panel's scene. o: { spires: [...], mushrooms: [...], stones: [[x, y, z, list, mat]…], discs: [[x, y, z, R, th]…],
 * islands: [...], monasteries: [...], aqueducts: [...], clouds: {...} | [...], towers: [[x, z, s]…], birds: [...] }
 */
function vaelScene(kit, v, o) {
  const M = materials(kit), seed = o.seed ?? 1;
  for (const s of o.spires ?? []) spires(kit, M, { seed, ...s, y: s.y ?? kit.base(s.x, s.z, s.R) - 0.5 });
  for (const m of o.mushrooms ?? []) mushroom(kit, M, { seed: seed * 0.1, ...m });
  for (const [x, y, z, R, th, mat] of o.discs ?? []) disc(kit, M, x, y, z, R, th, seed + x, mat);
  for (const [x, y, z, list, mat] of o.stones ?? []) stones(kit, M, x, y ?? kit.H(x, z) - 0.4, z, list, seed + x * 0.1, mat);
  for (const i of o.islands ?? []) island(kit, M, i);
  for (const m of o.monasteries ?? []) monastery(kit, M, m);
  for (const a of o.aqueducts ?? []) aqueduct(kit, M, a);
  for (const c of [o.clouds ?? []].flat()) cloudSea(kit, M, { at: [v.camera.eye[0], v.camera.eye[2]], yaw: v.camera.yaw ?? 0, seed, ...c });
  for (const [x, z, s] of o.towers ?? []) loneTower(kit, M, x, z, s);
  for (const b of o.birds ?? []) bird(kit, M, b);
  o.extra?.(kit, M);
}

// ---------------------------------------------------------------- grounds
const ROCK = { color: '#f8e2cb', color2: '#f5dcc4', color3: '#efd2b8', pattern: 'cracks' };
const PLAIN = { color: '#feb28a', color2: '#fcb894', color3: '#f3a47f', ripples: true };
/** A ledge of rock round the camera out to `edge` m (front), falling away to a floor far below. */
const ledge = (edge = 20, y = 0, floor = -300) => ({
  height: (x, z) => {
    const d = Math.hypot(x * 0.6, Math.min(z, 0));
    return y + 0.4 * nV(x * 0.05, z * 0.05) - (y - floor) * smoothstep(edge, edge * 1.6, d);
  },
  material: ROCK, rings: { r1: 2400 },
});
/** Only a floor far below: the view stands in the air over the cloud. */
const sky = (floor = -300) => ({ height: (x, z) => floor + 2 * nV(x * 0.01, z * 0.01), material: ROCK, rings: { r1: 2400 } });
/**
 * The peach plain: gentle swells, crevasses (narrow and deep) along the lines given ([[x0, z0, x1, z1, w, depth]…]),
 * fine dark cracks wandering over it.
 */
const plain = (cracks = [], o = {}) => ({
  height: (x, z) => {
    let h = (o.y ?? 0) + 0.6 * nV(x * 0.01, z * 0.01) + 0.15 * nW(x * 0.06, z * 0.06) + smoothstep(400, 2400, Math.hypot(x, z)) * (o.rise ?? 6);
    for (const [x0, z0, x1, z1, w, depth] of cracks) {
      const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = Math.min(Math.max(((x - x0) * dx + (z - z0) * dz) / L2, 0), 1);
      const wob = w * (0.6 + 0.5 * nW(x * 0.08 + x0, z * 0.08));
      const d = Math.hypot(x - x0 - t * dx, z - z0 - t * dz);
      h -= depth * (1 - smoothstep(wob * 0.6, wob, d)) * smoothstep(0, 0.08, t) * smoothstep(1, 0.92, t);
    }
    return h;
  },
  material: { ...PLAIN, ...(o.material ?? {}) }, rings: { r1: 2600 },
});

const view = (o) => ({ sky: SKY.aqua, look: VAEL2_LOOK, fog: 0.35, ...o });
const CLOAKED = { palette: PERSON, head: 'hood' };

/** A small cloaked figure standing on a cliff top (where no person of content.js can stand: off the view's ground). */
const figureAt = (x, y, z) => (k, M) => {
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.7, 8).translate(0, 0.85, 0), M.cloak);
  f.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6).translate(0, 1.75, 0), M.cloak));
  f.position.set(x, y, z);
  k.group.add(f);
};

export const VAEL2_VIEWS = [
  // ===================================================================== IMG_3783
  view({
    id: '3783-spires', title: 'Needles against the peach sky', sheet: 'IMG_3783', panel: 1, where: 'top left', crop: [39, 37, 222, 451],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 62, horizon: 0.84 },
    sun: { side: 140, el: 35 }, sky: SKY.peach,
    ground: ledge(220, 0, -80),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 3783, spires: [{ x: 4, z: -170, H: 175, R: 13, n: 7 }, { x: -40, z: -190, H: 95, R: 8, n: 4 }, { x: 40, z: -185, H: 75, R: 7, n: 3 }],
        clouds: { y: -40, near: 260, far: 1400, n: 160, size: [12, 26] },
      });
    },
  }),
  view({
    id: '3783-egg-column', title: 'The column, its disc and its egg', sheet: 'IMG_3783', panel: 2, where: 'top, second', crop: [276, 38, 224, 451],
    camera: { eye: [0, 10, 0], yaw: 0, fov: 72, pitch: 9 },
    sun: { side: 130, el: 40 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37832,
        mushrooms: [{ x: 0, z: -70, R: 20, top: 32, base: -80, stalk: 4.3, capT: 2.4, under: 3, dome: 0.6, rib: 0.4, ribK: 22, flute: 0.14, fluteK: 7, foot: 1.5, neckR: 0.9, waist: 0.05, outline: 0.04, mat: 'bone', smooth: false }],
        stones: [[0.4, 42, -70, [[4.6, 2.7, 0.15]]]],
        spires: [{ x: -16, z: -90, y: -40, H: 45, R: 4, n: 2, rubble: false }, { x: 14, z: -80, y: -40, H: 30, R: 3, n: 1, rubble: false }],
        clouds: [{ y: -30, near: 60, far: 1200, n: 240, size: [12, 30] }, { y: 10, near: 120, far: 400, n: 22, size: [24, 40], deck: false, spread: 30 }],
      });
    },
  }),
  view({
    id: '3783-cliffs-egg', title: 'The chapel, the floating egg, the tower on its cliff', sheet: 'IMG_3783', panel: 3, where: 'top right', crop: [516, 38, 470, 452],
    camera: { eye: [0, 10, 0], yaw: 0, fov: 50, horizon: 0.72 },
    sun: { side: 60, el: 50 },
    ground: { height: (x, z) => 8 - 0.2 * Math.max(0, -z) + 6 * smoothstep(0, 40, x - 10) * smoothstep(0, -40, z) - 300 * smoothstep(40, 70, -z), material: ROCK, rings: { r1: 2400 } },
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37833,
        mushrooms: [
          { x: -26, z: -180, R: 36, top: 0.5, stalk: 32, capT: 5, under: 7, dome: 0.6, rib: 1.2, ribK: 40, foot: 0.95, neckR: 0.97, waist: 0.03, base: -200, mat: 'bone', smooth: false, off: [4, 8] },
          { x: 62, z: -170, R: 50, top: 35, stalk: 34, capT: 7, under: 20, dome: 0.8, rib: 1.2, ribK: 40, foot: 1.0, neckR: 0.97, waist: 0.03, base: -200, mat: 'bone', smooth: false, off: [-16, 16] },
        ],
        spires: [{ x: -51, z: -178, y: 0.5, H: 54, R: 5, n: 1, rubble: false }],
        monasteries: [{ x: -29, y: 1, z: -170, yaw: 0.2, kind: 'chapel', s: 1.8 }, { x: 40, y: 35.5, z: -165, yaw: -0.3, kind: 'tower', s: 1.9 }],
        stones: [[-5, 52, -180, [[5, 7, 0.15]]], [-5, 42, -180, [[1.4, 1, 0]]]],
        clouds: { y: -40, near: 120, far: 1500, n: 260, size: [14, 32] },
      });
    },
  }),
  view({
    id: '3783-rose-arch', title: 'The rose arch over the cloud', sheet: 'IMG_3783', panel: 4, where: 'bottom left', crop: [39, 505, 297, 480],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 64, horizon: 0.6 },
    sun: { side: -140, el: 45 },
    ground: ledge(16, 0, -300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37834,
        spires: [{ x: -17, z: -44, y: -120, H: 200, R: 8, n: 1, rubble: false, mat: 'rose' }, { x: 17, z: -52, y: -120, H: 190, R: 8, n: 2, rubble: false, mat: 'rose' }],
        aqueducts: [{ a: [-17, -45], b: [17, -50], y0: 37, W: 12, bays: 1, pier: 0.04, rise: 1.4, thick: 8, rough: 1.6, seed: 5, ends: 0, flare: 0.6, bulge: 0.3, bottom: -120, mat: 'rose' }],
        monasteries: [{ x: 19, y: 37.5, z: -52, kind: 'chapel', s: 0.35 }],
        clouds: { y: -6, near: 80, far: 1400, n: 280, size: [8, 22] },
      });
    },
  }),
  view({
    id: '3783-mushroom-plain', title: 'Under the mushroom, the plain and its tower', sheet: 'IMG_3783', panel: 5, where: 'bottom right', crop: [350, 506, 636, 480],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 56, horizon: 0.675 },
    sun: { side: 140, el: 50 },
    ground: plain([[20, -16, 90, -22, 5, 6], [-40, -60, -10, -70, 6, 5], [40, -120, 140, -150, 10, 8]]),
    people: [{ at: [-5, -9.5], facing: 0.5, ...CLOAKED }],
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37835,
        mushrooms: [{ x: -7.7, z: -14, R: 5.8, top: 10.3, base: -3, stalk: 1.5, off: [3.3, 0], capT: 1.8, under: 2.4, dome: 0.8 }],
        towers: [[234, -900, 1.05]],
        clouds: [{ y: -6, near: 1300, far: 2600, n: 70, spread: 35, yaw: -18, size: [30, 60], deck: false }, { y: -6, near: 1500, far: 2600, n: 30, spread: 8, yaw: 33, size: [30, 60], deck: false }],
        birds: [{ at: [-3, -9], yaw: -2.6, s: 0.7, fly: true }],
      });
    },
  }),
  // ===================================================================== IMG_3784
  view({
    id: '3784-spires', title: 'Needles, white on peach', sheet: 'IMG_3784', panel: 1, where: 'top left', crop: [44, 45, 296, 454],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 60, pitch: 14 },
    sun: { side: 160, el: 40 }, sky: SKY.peach,
    ground: sky(-200),
    build(kit, v) {
      vaelScene(kit, v, { seed: 3784, spires: [{ x: 8, z: -170, y: -60, H: 230, R: 15, n: 5, rubble: false }, { x: -45, z: -175, y: -60, H: 150, R: 11, n: 2, rubble: false }, { x: 55, z: -160, y: -60, H: 120, R: 8, n: 1, rubble: false }] });
    },
  }),
  view({
    id: '3784-stacks', title: 'Stacked discs, stacked rose stones', sheet: 'IMG_3784', panel: 2, where: 'top middle', crop: [364, 45, 296, 454],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 64, horizon: 0.62 },
    sun: { side: -130, el: 40 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37842,
        spires: [{ x: -28, z: -130, y: -90, H: 115, R: 7, n: 0, rubble: false }],
        discs: [[-32, 58, -130, 18, 2.2], [-30, 24.5, -130, 12.5, 1.6]],
        stones: [[-30, 25.5, -130, [[4.2, 0.8, 0.1], [3.8, 0.9, 0.15], [3.2, 0.75, 0.05], [2.6, 0.9, 0.1]]], [-32, 59.5, -130, [[3.4, 0.8, 0.2], [2.4, 0.9, 0.2]]],
          [21, -40, -95, [[12, 0.8, 0.05], [10.5, 0.85, 0.1], [11, 0.8, 0.1], [9.5, 0.9, 0.15], [9, 0.85, 0.1], [7.5, 0.9, 0.2]], 'rose']],
        mushrooms: [{ x: 30, z: -95, R: 30, top: -38, stalk: 24, capT: 6, under: 6, dome: 0.8, base: -200, mat: 'rose', smooth: false, foot: 0.95, neckR: 0.97, waist: 0.03 }],
        clouds: [{ y: -60, near: 80, far: 1400, n: 240, size: [12, 30] }, { y: 0, near: 160, far: 400, n: 18, size: [22, 38], deck: false, spread: 25 }],
      });
    },
  }),
  view({
    id: '3784-cliff-monastery', title: 'The monastery on the rose cliff', sheet: 'IMG_3784', panel: 3, where: 'top right', crop: [684, 45, 295, 454],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 56, horizon: 0.7 },
    sun: { side: -80, el: 45 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37843,
        mushrooms: [{ x: 40, z: -175, R: 72, top: 44, stalk: 55, capT: 9, under: 10, dome: 0.8, rib: 1.4, ribK: 40, foot: 0.95, neckR: 0.97, waist: 0.03, base: -250, mat: 'rose', smooth: false, off: [-12, 6], squash: [1, 0.6] }],
        monasteries: [{ x: 28, y: 44.6, z: -178, yaw: 0.25, kind: 'tower', s: 1.9 }],
        clouds: { y: -20, near: 160, far: 1500, n: 240, size: [12, 30] },
        extra: figureAt(-27, 44.6, -150),
      });
    },
  }),
  view({
    id: '3784-mushrooms-arches', title: 'Mushrooms in the cloud, the arched cliff', sheet: 'IMG_3784', panel: 4, where: 'bottom left', crop: [44, 523, 456, 455],
    camera: { eye: [0, 30, 0], yaw: 0, fov: 60, horizon: 0.42 },
    sun: { side: 150, el: 50 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37844,
        mushrooms: [{ x: 3, z: -95, R: 50, top: 20, dome: 4.8, stalk: 13, capT: 6, under: 19, base: -100 }, { x: -18, z: -62, R: 14, top: 1.5, dome: 1.3, stalk: 4.5, capT: 2, under: 5, base: -100 }],
        aqueducts: [{ a: [-220, -320], b: [220, -330], y0: 177, W: 50, bays: 3, pier: 0.3, rise: 1.5, thick: 40, rough: 3, seed: 7, ends: 0.04, bottom: -120, mat: 'rose', flare: 0.3 }],
        clouds: [{ y: -25, near: 40, far: 1400, n: 280, size: [10, 26] }, { y: 45, near: 240, far: 300, n: 40, size: [18, 34], deck: false, spread: 40 }],
      });
    },
  }),
  view({
    id: '3784-plain-tower', title: 'A figure on the peach plain, the tower far off', sheet: 'IMG_3784', panel: 5, where: 'bottom right', crop: [524, 523, 455, 455],
    camera: { eye: [0, 6.5, 0], yaw: 0, fov: 50, horizon: 0.71 },
    sun: { side: 140, el: 50 },
    ground: plain([[-60, -40, 40, -60, 3, 2], [60, -200, 200, -260, 6, 4]]),
    people: [{ at: [-4, -55], facing: 0.3, ...CLOAKED }],
    build(kit, v) { vaelScene(kit, v, { seed: 37845, towers: [[210, -1400, 1]] }); },
  }),
  // ===================================================================== IMG_3785
  view({
    id: '3785-spires', title: 'Pink needles', sheet: 'IMG_3785', panel: 1, where: 'top left', crop: [35, 43, 289, 566],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 66, horizon: 0.93 },
    sun: { side: 130, el: 40 }, sky: ['#fbcaab', '#fbd2b6', TINT, '#ffffff', '#fff6dc'],
    ground: ledge(160, 0, -60),
    build(kit, v) {
      vaelScene(kit, v, { seed: 3785, spires: [{ x: -22, z: -120, H: 230, R: 15, n: 5, mat: 'pink' }, { x: 24, z: -110, H: 130, R: 7, n: 2, mat: 'pink' }, { x: 45, z: -130, H: 80, R: 5, n: 3, mat: 'pink' }] });
    },
  }),
  view({
    id: '3785-overhang-aqueduct', title: 'The village on the overhang, the aqueduct below', sheet: 'IMG_3785', panel: 2, where: 'top middle', crop: [344, 43, 337, 567],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 70, horizon: 0.75 },
    sun: { side: 140, el: 50 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37852,
        mushrooms: [{ x: -60, z: -170, R: 115, top: 75, stalk: 80, capT: 12, under: 12, dome: 1, rib: 1.6, ribK: 44, foot: 0.9, neckR: 0.9, waist: 0.03, base: -250, mat: 'cap', squash: [1, 0.5] }],
        monasteries: [{ x: 0, y: 75.6, z: -175, yaw: 0.4, kind: 'tower', s: 1.2 }],
        discs: [[48, 104, -168, 14, 2.5], [48, 136, -168, 9, 2]],
        stones: [[48, 75.5, -168, [[8, 1.2, 0.1], [4, 0.9, 0.1]]], [48.5, 106, -168, [[9, 0.9, 0.15]]], [48.5, 137.5, -168, [[4, 1, 0.2]]]],
        aqueducts: [{ a: [-200, -210], b: [200, -230], y0: 8, W: 9, bays: 6, pier: 0.3, thick: 4, seed: 3, ends: 0, bottom: -80, parapets: true }],
        clouds: { y: -55, near: 60, far: 1500, n: 260, size: [12, 30] },
      });
    },
  }),
  view({
    id: '3785-bird-palace', title: 'The bird and its rider past the palace cliff', sheet: 'IMG_3785', panel: 3, where: 'top right', crop: [698, 43, 291, 567],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 64, horizon: 0.75 },
    sun: { side: -120, el: 35 }, sky: SKY.salmon,
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37853,
        mushrooms: [{ x: 35, z: -130, R: 52, top: 45, stalk: 40, capT: 7, under: 12, dome: 0.8, rib: 1.2, ribK: 40, foot: 0.95, neckR: 0.97, waist: 0.03, base: -250, mat: 'rose', smooth: false, off: [-10, 4], squash: [1, 0.6] }],
        monasteries: [{ x: 24, y: 45.6, z: -128, yaw: -0.2, kind: 'palace', s: 1.4 }],
        birds: [{ at: [-5, 22.6, -26], yaw: 1.9, s: 1.6, fly: true, rider: true }],
        clouds: { y: -20, near: 160, far: 1500, n: 260, size: [10, 26], pink: true },
      });
    },
  }),
  view({
    id: '3785-mushroom-spire', title: 'The mushroom and the needle', sheet: 'IMG_3785', panel: 4, where: 'bottom left', crop: [35, 630, 466, 352],
    camera: { eye: [0, 10, 0], yaw: 0, fov: 50, horizon: 0.65 },
    sun: { side: 150, el: 50 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37854,
        mushrooms: [{ x: 3, z: -120, R: 68, top: 65, dome: 7, stalk: 16, capT: 10, under: 25, base: -100 }],
        spires: [{ x: -35, z: -90, y: -40, H: 85, R: 8, n: 1, rubble: false }],
        clouds: { y: -22, near: 50, far: 1500, n: 280, size: [12, 30] },
      });
    },
  }),
  view({
    id: '3785-crevasse', title: 'The crevasse, the tower, the far sea of cloud', sheet: 'IMG_3785', panel: 5, where: 'bottom right', crop: [521, 629, 469, 353],
    camera: { eye: [0, 4, 0], yaw: 0, fov: 46, horizon: 0.6 },
    sun: { side: 130, el: 45 },
    ground: plain([[-30, -40, 70, -25, 3, 6], [-110, -70, -40, -74, 3, 5]], { rise: 4 }),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37855, towers: [[40, -720, 1]],
        clouds: { y: -4, near: 1100, far: 2600, n: 60, spread: 22, yaw: -40, size: [30, 60], deck: false },
      });
    },
  }),
  // ===================================================================== IMG_3786
  view({
    id: '3786-spires', title: 'Needles over the pink rubble', sheet: 'IMG_3786', panel: 1, where: 'top left', crop: [22, 28, 316, 482],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 64, horizon: 0.97 },
    sun: { side: 110, el: 30 }, sky: ['#f4d1ba', '#f6d8c4', TINT, '#ffffff', '#fff6dc'],
    ground: ledge(160, 0, -60),
    build(kit, v) {
      vaelScene(kit, v, { seed: 3786, spires: [{ x: 2, z: -120, H: 175, R: 13, n: 7, rubble: 'pink' }, { x: -30, z: -125, H: 110, R: 8, n: 4, rubble: 'pink' }, { x: 40, z: -130, H: 70, R: 6, n: 4 }] });
    },
  }),
  view({
    id: '3786-egg-cap', title: 'The cracked egg on its cap', sheet: 'IMG_3786', panel: 2, where: 'top middle', crop: [354, 31, 292, 374],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 56, horizon: 0.85 },
    sun: { side: 120, el: 40 }, sky: ['#f2c5aa', '#f4cdb4', TINT, '#ffffff', '#fff6dc'],
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37862,
        spires: [{ x: 6, z: -70, y: -70, H: 98, R: 3.2, n: 0, rubble: false }],
        discs: [[9, 27, -70, 12.5, 2, 'peach']],
        stones: [[9.3, 30, -70, [[8, 2.6, 0.14]]]],
        extra(k, M) {
          // the flank on the left, a great rounded rock rising out of the frame
          k.add(M.bone, place(boulder(1, 1, 1, 1, 0.05, 7), -52, 5, -62, 0.3, 42, 80, 40));
          for (const [x, y, z, r] of [[-21, 91, -100, 3.2], [-19, 67, -100, 2.4], [-16, 43, -100, 2]]) {
            disc(k, M, x, y, z, r, 0.6, x + y);
            for (let i = 1; i <= 3; i++) k.add(M.bone, place(boulder(0.45, 1, 1, 1, 0, i), x, y - 3 * i, z));
          }
        },
        clouds: { y: -40, near: 40, far: 1200, n: 220, size: [12, 30] },
      });
    },
  }),
  view({
    id: '3786-island', title: 'The floating island and its monastery', sheet: 'IMG_3786', panel: 3, where: 'top right', crop: [662, 34, 338, 371],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 46, horizon: 0.75 },
    sun: { side: -140, el: 45 }, sky: SKY.lilac,
    ground: sky(-400),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37863,
        islands: [{ x: 5, y: 23, z: -175, R: 56, depth: 47, seed: 3 }],
        monasteries: [{ x: 30, y: 23.6, z: -178, yaw: 0.2, kind: 'tower', s: 1.8 }],
      });
    },
  }),
  view({
    id: '3786-under-cap', title: 'Under the great cap, the birds and the traveller', sheet: 'IMG_3786', panel: 4, where: 'bottom left', crop: [23, 524, 315, 473],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 70, pitch: 14 },
    sun: { side: 70, el: 20 },
    ground: { height: (x, z) => -300 * smoothstep(-16, -30, z) + 0.3 * nV(x * 0.1, z * 0.1), material: PLAIN, rings: { r1: 2400 } },
    people: [{ at: [8, -13], facing: -0.4, ...CLOAKED }],
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37864,
        mushrooms: [{ x: 3, z: -62, R: 80, top: 70, stalk: 9, capT: 6, under: 40, base: -100 }],
        spires: [{ x: -15, z: -42, y: -100, H: 175, R: 8, n: 0, rubble: false }],
        birds: [{ at: [3, -11], yaw: 2.2, s: 0.8 }, { at: [5, -12.5], yaw: -2.6, s: 0.7 }],
        clouds: { y: -30, near: 30, far: 1200, n: 240, size: [10, 26] },
      });
    },
  }),
  view({
    id: '3786-cap-aqueduct', title: 'The cap under the aqueduct', sheet: 'IMG_3786', panel: 5, where: 'bottom middle', crop: [355, 420, 315, 577],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 72, horizon: 0.42 },
    sun: { side: 40, el: 50 },
    ground: { height: (x, z) => -4 - 300 * smoothstep(-25, -40, z) + 1.5 * nV(x * 0.08, z * 0.08) - 0.12 * Math.max(0, -z), material: PLAIN, rings: { r1: 2400 } },
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37865,
        mushrooms: [{ x: -13, z: -62, R: 24, top: 11, dome: 2, stalk: 6, capT: 4, under: 13, base: -100, off: [11, 0], mat: 'peach' }],
        aqueducts: [{ a: [-200, -250], b: [200, -260], y0: 140, W: 12, bays: 5, pier: 0.3, rise: 1.4, thick: 15, seed: 6, ends: 0, bottom: -120 }],
        clouds: [{ y: -30, near: 40, far: 1400, n: 240, size: [10, 26] }, { y: 50, near: 140, far: 400, n: 20, size: [20, 36], deck: false, spread: 30 }],
        extra(k, M) { for (const [x, z, r] of [[-8, -10, 1.6], [6, -14, 1.2], [-3, -20, 2.2], [10, -6, 0.9]]) k.add(M.peach, place(boulder(r, 1.2, 0.7, 1, 0, x), x, k.H(x, z) + r * 0.3, z)); },
      });
    },
  }),
  view({
    id: '3786-plain-tower', title: 'The tower under a high sky', sheet: 'IMG_3786', panel: 6, where: 'bottom right', crop: [685, 421, 316, 570],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 56, horizon: 0.64 },
    sun: { side: -140, el: 50 }, sky: SKY.lilac,
    ground: plain([[-20, -12, 30, -30, 1.5, 1.5], [-60, -80, 40, -110, 2, 2]]),
    build(kit, v) { vaelScene(kit, v, { seed: 37866, towers: [[-20, -1780, 1]] }); },
  }),
  // ===================================================================== IMG_3787
  view({
    id: '3787-spires', title: 'A forest of needles', sheet: 'IMG_3787', panel: 1, where: 'top left', crop: [34, 23, 233, 497],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 70, horizon: 0.93 },
    sun: { side: -120, el: 40 },
    ground: ledge(160, 0, -60),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 3787,
        spires: [{ x: -4, z: -110, H: 190, R: 10, n: 5 }, { x: 42, z: -95, H: 200, R: 9, n: 3 }, { x: -40, z: -130, H: 120, R: 7, n: 4 }, { x: 20, z: -150, H: 140, R: 7, n: 3 }, { x: -70, z: -150, H: 90, R: 6, n: 2 }],
      });
    },
  }),
  view({
    id: '3787-overhang-eggs', title: 'The overhang, the two eggs, the arch', sheet: 'IMG_3787', panel: 2, where: 'top middle', crop: [282, 25, 388, 496],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 66, horizon: 0.68 },
    sun: { side: -130, el: 40 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37872,
        mushrooms: [{ x: -50, z: -100, R: 54, top: 115, stalk: 30, capT: 70, under: 15, dome: 4, base: -150, foot: 1.2, mat: 'peach', squash: [1, 0.6] }],
        stones: [[44, 50, -120, [[9, 1.75, 0.15], [8.5, 1.7, 0.12]]]],
        aqueducts: [{ a: [-90, -150], b: [100, -150], y0: -10, W: 22, bays: 1, pier: 0.04, rise: 0.6, thick: 10, rough: 2.4, seed: 8, ends: 0.2, flare: 0.5, bulge: 0.3, bottom: -120, mat: 'bone' }],
        spires: [{ x: -5, z: -250, y: -9, H: 15, R: 2, n: 2, rubble: false }, { x: -40, z: -260, y: -9, H: 12, R: 2, n: 1, rubble: false }],
        clouds: [{ y: -60, near: 60, far: 1400, n: 260, size: [12, 30] }, { y: 15, near: 180, far: 360, n: 16, size: [28, 44], deck: false, spread: 18, yaw: 18 }],
      });
    },
  }),
  view({
    id: '3787-palace-overhang', title: 'The palace over the dark overhang', sheet: 'IMG_3787', panel: 3, where: 'top right', crop: [685, 27, 315, 494],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 60, horizon: 0.88 },
    sun: { side: 140, el: 50 }, sky: ['#a6cccd', '#e6c6b3', TINT, '#ffffff', '#fff6dc'],
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37873,
        mushrooms: [{ x: 30, z: -140, R: 72, top: 78, stalk: 28, capT: 8, under: 33, dome: 0.8, rib: 1.6, ribK: 44, base: -200, foot: 1.4, neckR: 1, waist: 0.05, squash: [1, 0.6] }],
        monasteries: [{ x: 4, y: 78.6, z: -140, yaw: 0, kind: 'palace', s: 1.8 }],
        clouds: { y: -10, near: 80, far: 1600, n: 260, size: [14, 32] },
      });
    },
  }),
  view({
    id: '3787-cave-mouth', title: 'Mushrooms in the cloud from the cave mouth', sheet: 'IMG_3787', panel: 4, where: 'bottom left', crop: [33, 535, 307, 462],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 66, horizon: 0.6 },
    sun: { side: 60, el: 30 }, sky: SKY.salmon,
    ground: { height: (x, z) => -6 + 0.3 * x - 300 * smoothstep(-20, -32, z), material: ROCK, rings: { r1: 2400 } },
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37874,
        mushrooms: [{ x: -5, z: -125, R: 22, top: 40, stalk: 5, capT: 5, under: 8, base: -60 }, { x: -30, z: -115, R: 11.5, top: 5, stalk: 3, capT: 2.4, under: 4, base: -60 }],
        aqueducts: [{ a: [-30, -20], b: [14, -22], y0: 24, W: 18, bays: 1, pier: 0.04, rise: 0.5, thick: 10, rough: 3, seed: 9, ends: 0, flare: 0.5, bulge: 0.4, bottom: -40, mat: 'bone' }],
        spires: [{ x: 9, z: -22, y: -40, H: 70, R: 6, n: 1, rubble: false }],
        clouds: { y: -14, near: 70, far: 1400, n: 280, size: [8, 22] },
      });
    },
  }),
  view({
    id: '3787-giant-cap', title: 'Up under the giant cap', sheet: 'IMG_3787', panel: 5, where: 'bottom middle', crop: [354, 535, 316, 461],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 70, pitch: 26 },
    sun: { side: 110, el: 40 }, sky: ['#f0b9a0', '#f2c4ad', TINT, '#ffffff', '#fff6dc'],
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37875,
        mushrooms: [{ x: 0, z: -50, R: 44, top: 60, stalk: 7, capT: 7, under: 40, base: -140, foot: 1.6, mat: 'peach', off: [-8, 10] }],
        spires: [{ x: -30, z: -60, y: -40, H: 26, R: 3, n: 1, rubble: false }, { x: 28, z: -55, y: -40, H: 22, R: 3, n: 1, rubble: false }],
        clouds: { y: -26, near: 40, far: 1400, n: 240, size: [10, 26] },
      });
    },
  }),
  view({
    id: '3787-plain-tower', title: 'The traveller, the plain, the tower', sheet: 'IMG_3787', panel: 6, where: 'bottom right', crop: [685, 535, 317, 459],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 50, horizon: 0.6 },
    sun: { side: 130, el: 45 },
    ground: plain([[-40, -40, 20, -60, 2, 2], [10, -140, 120, -160, 4, 3]]),
    people: [{ at: [-2.5, -30], facing: 0.2, ...CLOAKED }],
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37876, towers: [[0, -1800, 1]],
        extra(k, M) { k.add(M.peach, place(boulder(2.2, 1.4, 0.8, 1, 0, 3), -9, k.H(-9, -10), -10)); },
      });
    },
  }),
  // ===================================================================== IMG_3788
  view({
    id: '3788-spires', title: 'Needles on the plateau', sheet: 'IMG_3788', panel: 1, where: 'top left', crop: [44, 47, 294, 564],
    camera: { eye: [0, 12, 0], yaw: 0, fov: 66, horizon: 0.73 },
    sun: { side: 130, el: 35 }, sky: ['#f7ae88', '#f8b995', TINT, '#ffffff', '#fff6dc'],
    ground: { height: (x, z) => -2 * Math.floor(Math.max(0, -z - 10) / 26) - 0.5 * nV(x * 0.05, z * 0.05) - 300 * smoothstep(-140, -170, z) - 20 * smoothstep(-6, -14, z) * smoothstep(-34, -18, z), material: ROCK, rings: { r1: 2400 } },
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 3788,
        spires: [{ x: -14, z: -110, H: 150, R: 10, n: 5 }, { x: 18, z: -95, H: 100, R: 6, n: 4 }, { x: 40, z: -120, H: 70, R: 5, n: 3 }, { x: -40, z: -100, H: 60, R: 5, n: 2 }],
        clouds: { y: -40, near: 200, far: 1400, n: 140, size: [12, 26] },
      });
    },
  }),
  view({
    id: '3788-pillar-floater', title: 'The pillar, the floating stone, the aqueduct', sheet: 'IMG_3788', panel: 2, where: 'top middle', crop: [365, 47, 293, 564],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 64, horizon: 0.6 },
    sun: { side: -70, el: 50 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37882,
        mushrooms: [{ x: -12, z: -150, R: 13, top: 71, stalk: 12, capT: 6, under: 1, dome: 8, base: -120, mat: 'bone', smooth: false, foot: 1.05, neckR: 1, waist: 0.03, rib: 0, outline: 0.06 }],
        spires: [{ x: -45, z: -170, y: -40, H: 70, R: 6, n: 2, rubble: false }],
        discs: [[-2, 92, -150, 12, 3.5]],
        stones: [[-2, 80, -150, [[1.6, 1.4, 0.2]]], [26, 58, -150, [[1.8, 2.2, 0.15]]]],
        aqueducts: [{ a: [-160, -120], b: [160, -125], y0: -3, W: 10, bays: 5, pier: 0.32, rise: 1.2, thick: 6, seed: 4, ends: 0, bottom: -150 }],
        clouds: { y: -50, near: 60, far: 1400, n: 260, size: [12, 30], pink: true },
      });
    },
  }),
  view({
    id: '3788-island-church', title: 'The church on its floating island', sheet: 'IMG_3788', panel: 3, where: 'top right', crop: [688, 47, 294, 564],
    camera: { eye: [0, 0, 0], yaw: 0, fov: 64, horizon: 0.62 },
    sun: { side: -70, el: 50 },
    ground: sky(-300),
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37883,
        islands: [{ x: 0, y: 47, z: -170, R: 35, depth: 22, seed: 5 }],
        monasteries: [{ x: 0, y: 47.5, z: -172, kind: 'church', s: 2.4 }],
        mushrooms: [{ x: 40, z: -150, R: 42, top: 21, stalk: 38, capT: 6, under: 4, dome: 1, rib: 0.8, foot: 0.95, neckR: 0.97, waist: 0.03, base: -150, mat: 'bone', smooth: false }],
        aqueducts: [{ a: [-150, -120], b: [40, -122], y0: 0, W: 10, bays: 4, pier: 0.32, rise: 1.2, thick: 6, seed: 5, ends: 0, bottom: -150 }],
        clouds: { y: -50, near: 60, far: 1400, n: 260, size: [12, 30], pink: true },
      });
    },
  }),
  view({
    id: '3788-mushroom-walk', title: 'Walking past the mushrooms to the tower', sheet: 'IMG_3788', panel: 4, where: 'bottom, wide', crop: [44, 639, 938, 340],
    camera: { eye: [0, 2.4, 0], yaw: 0, fov: 34, horizon: 0.52 },
    sun: { side: 140, el: 50 },
    ground: plain([[-30, -14, 10, -18, 2, 2], [-40, -40, -10, -44, 2, 1.5]]),
    people: [{ at: [0.8, -10], facing: 0.3, ...CLOAKED }],
    build(kit, v) {
      vaelScene(kit, v, {
        seed: 37884,
        mushrooms: [{ x: -2.3, z: -14, R: 6.3, top: 6, dome: 0.6, stalk: 2.1, foot: 1.25, capT: 1.4, under: 1.6, base: -3, off: [-0.7, 0] }, { x: -14, z: -26, R: 3.6, top: 3.8, dome: 0.4, stalk: 1.2, capT: 0.9, under: 1.1, base: -3 }],
        spires: [{ x: -12, z: -15, H: 14, R: 1.6, n: 0, rubble: false }],
        towers: [[725, -1300, 1]],
        clouds: { y: 0, near: 1500, far: 2600, n: 80, spread: 20, yaw: 22, size: [30, 60], deck: false },
      });
    },
  }),
];
