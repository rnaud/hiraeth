import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { MODE_WATER } from '../materials.js';
import { put } from './lab-kit.js';
import { leafCrown } from './garden-kit.js';
import { lumpy } from './sky-stones-kit.js';

// ---------------------------------------------------------------------------
// The Underwater City's pieces (references/The Underwater City), shared by its reference views
// (reference-underwater.js) and the world (underwater.js). Everything goes through a kit with RoomKit's
// face (lab-kit.js: mat, add, mesh, light, mover, group), geometry in the kit's frame.
//
//   the sea      its surface far overhead (a MODE_WATER plane: from below, a pale ceiling with its
//                ripples) carrying the sea's look (water.js SEA_LOOK: the banded tint, the shafts of
//                light as flat bands, the caustics as printed lines) and its air pockets
//   towers       tall pale salmon towers, storey rings, round windows, a dome or a spire on top
//   pods         the balconies round them: a saucer underside, a band of lit amber glass with its
//                mullions, a pale rim, plants over it (open) or a dome of glass ribs (closed)
//   columns      glass tubes of luminous water with bubbles rising in them (instanced, one mover)
//   domes        the cafés: a glass dome (only its rim and a highlight drawn: materials.js S_GLASS) on its
//                ribs and base ring, a door in it, the warm floor, tables and chairs inside; air inside
//   streets      walkways on piers with globe lamps, bridges, the paving
//   life         a manta gliding overhead, a school of small fish, swimmers, kelp and dark bushes
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
const NS = { solid: false, shadow: false };
const SOLID = { solid: true, shadow: true };

/** The sheets' colours (read off the four plates). */
export const UW_PAL = {
  tower: ['#f2a48e', '#eb9a86', '#f4b09a', '#e69482', '#f0a896'],
  towerCool: '#d9a49a',
  rim: '#f6c2b0',
  under: '#c98478',
  glass: '#e27a46',      // the pods' amber windows, lit from within
  glassDim: '#c06a48',
  mullion: '#5a3a36',
  column: '#36a3b8',
  bubble: '#e8fdff',
  domeGlass: '#a8e4e6',
  frame: '#3d6f78',
  floor: '#e08a5a',
  table: '#f2c8a0',
  chair: '#6a4a44',
  street: '#3a7279',
  streetPale: '#8cc8c8',
  sand: ['#3f8088', '#3b7a82', '#36737b'],
  lamp: '#ffc477',
  post: '#2f5a62',
  leaf: ['#2a5a4e', '#33664f', '#244c46'],
  kelp: '#2f6a58',
  manta: '#24597a',
  belly: '#9ccfd8',
  fish: '#e9f6f2',
  people: ['#d97a5e', '#4f8f96', '#e3b06a', '#7a6e9e', '#c4604a', '#efd2a6', '#5f8f7a', '#2f8a8f'],
  suit: '#3a5f6a',
  skin: '#e0b08e',
};

/** The water: a flat tinted depth haze in stepped layers (post.js 4b), deeper below the city floor. */
export const UNDERWATER_HAZE = { uHazeLayers: [70, 1.5, 0.22, 7], uHazeTone: [0.06, 0.3, 0.5, 0.5], uHeightFog: [-4, 7, 0.05, 0.85], uHeightFogTone: [0.03, 0.2, 0.32, 1] };
/**
 * The ink: the shade printed flat in the water's teal (a salmon tower's turned side goes blue-green), few strokes,
 * no bounce, a clean sky (no clouds: the sky is the sea seen far off), a few spot blacks in the pods' undersides.
 */
export const UNDERWATER_LOOK = { uCumulus: 0, uClouds: 0, uShadowFlat: 0.82, uShadeKeep: 0.1, uHalftone: 0.04, uBounce: 0, uHatch: 0.16, uLineWidth: 0.9, uRays: 0, uSkyDots: 0, uSkyBands: 0.6, uAerial: 0, ...UNDERWATER_HAZE };
/** sky top (toward the surface), horizon (the far water), shadow (the water's teal), light, sun */
export const UNDERWATER_DAY = ['#1f7fae', '#0e5079', '#1f5a68', '#fff2e8', '#e9fbff'];
export const UNDERWATER_DUSK = ['#2f6f98', '#1d4c6c', '#2f5568', '#ffd9c6', '#ffd2b0'];
export const UNDERWATER_NIGHT = ['#0b2a3c', '#0a2232', '#123444', '#7fb2c2', '#d8f0f4'];

/** The sea's look under its surface (water.js SEA_LOOK): light tint near, the shafts, the caustics. */
export const SEA_DAY = {
  tint: '#2479a8', deep: '#0c3a5c', density: 0.004, bands: 4, min: 0.0, max: 0.6, start: 25,
  shafts: { cell: 26, width: [2.2, 7], lean: 0.32, reach: 70, strength: 0.16, tone: '#bff2f6', n: 0.55 },
  caustics: { scale: 1.5, range: 22, strength: 0.13, tone: '#c9f6f2', speed: 0.55 },
};

/**
 * The sea's surface, `y` up, `size` across, centred on (x, z): drawn from below as a pale ceiling with its ripples,
 * carrying the sea's look (and `air`, the air pockets) for water.js. Its own mesh (water.js finds it).
 */
export function seaSurface(kit, { y = 60, size = 4000, x = 0, z = 0, sea = SEA_DAY, air = null, color = '#2f8fb0', color2 = '#2f86b4', below = ['#8fd0e4', 0.22] } = {}) {
  const m = kit.mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(x, y, z), kit.mat({ color, color2, below, mode: MODE_WATER, waterDepth: 40 }), NS);
  m.name = 'The sea';
  m.userData.sea = { ...sea, ...(air ? { air } : {}) };
  return m;
}

// ------------------------------------------------------------------ materials

/** The city's materials (one per option set, shared by the kit). shadeFlat: how flat its shade is printed. */
export function uwMats(kit, { shadeFlat = 0.82 } = {}) {
  const P = shadeFlat ? { shadeFlat } : {};
  return {
    // (the towers keep their salmon in the shade: the sheets turn a tower's far side a dusky rose, not grey)
    tower: UW_PAL.tower.map((c) => kit.mat({ color: c, weathered: 0.25, shadeHue: 0.5 })),
    shell: { teal: kit.mat({ color: '#4a8790', flat: true, weathered: 0.2, ...P }), pink: kit.mat({ color: '#f0aa98', flat: true, weathered: 0.2, shadeHue: 0.5 }) },
    // a shell's inside, seen through its windows and from within: warm plaster, lit
    lining: kit.mat({ color: '#e0905e', glow: 0.5, shade: 0.9, flat: true, spot: 0, side: THREE.BackSide }),
    rim: kit.mat({ color: UW_PAL.rim, flat: true, ...P }),
    under: kit.mat({ color: UW_PAL.under, flat: true, ...P }),
    // (lit from within: self-lit under the bloom's threshold, so no halo, and their shade lifted to their own colour)
    glass: kit.mat({ color: UW_PAL.glass, glow: 0.58, shade: 0.9, flat: true, spot: 0 }),
    glassDim: kit.mat({ color: UW_PAL.glassDim, glow: 0.5, shade: 0.8, flat: true, spot: 0 }),
    mullion: kit.mat({ color: UW_PAL.mullion, flat: true }),
    window: kit.mat({ color: '#2f4a52', flat: true }),
    windowLit: kit.mat({ color: '#f09a52', glow: 0.58, shade: 0.9, flat: true, spot: 0 }),
    column: kit.mat({ color: UW_PAL.column, glow: 0.45, flat: true, spot: 0, line: 0.45, lineTint: 0.7 }),
    bubble: kit.mat({ color: UW_PAL.bubble, glow: 0.3, flat: true, spot: 0, line: 0.5, lineTint: 0.5 }),
    frame: kit.mat({ color: UW_PAL.frame, metal: 'painted', ...P }),
    // (a café's inside: lit warm from within, whatever the light outside)
    floor: kit.mat({ color: UW_PAL.floor, glow: 0.5, shade: 0.9, flat: true, spot: 0 }),
    wallIn: kit.mat({ color: '#e6844e', glow: 0.55, shade: 0.9, flat: true, spot: 0 }),
    table: kit.mat({ color: UW_PAL.table, glow: 0.5, shade: 0.9, flat: true, spot: 0 }),
    chair: kit.mat({ color: UW_PAL.chair, flat: true }),
    street: kit.mat({ color: UW_PAL.street, flat: true, grid: 2.4, ...P }),
    streetPale: kit.mat({ color: UW_PAL.streetPale, flat: true, ...P }),
    pier: kit.mat({ color: '#5e9aa0', flat: true, weathered: 0.3, ...P }),
    lamp: kit.mat({ color: UW_PAL.lamp, glow: 0.95, flat: true, spot: 0 }),
    post: kit.mat({ color: UW_PAL.post, flat: true }),
    leaf: UW_PAL.leaf.map((c) => kit.mat({ color: c, flat: true, line: 0.6, lineTint: 0.6 })),
    kelp: kit.mat({ color: UW_PAL.kelp, flat: true, side: THREE.DoubleSide, line: 0.6, lineTint: 0.6 }),
    manta: kit.mat({ color: UW_PAL.manta, flat: true, side: THREE.DoubleSide }),
    fish: kit.mat({ color: UW_PAL.fish, flat: true, spot: 0, line: 0.5, lineTint: 0.5 }),
    people: UW_PAL.people.map((c) => kit.mat({ color: c, flat: true, figure: true })),
    suit: kit.mat({ color: UW_PAL.suit, flat: true, figure: true }),
    skin: kit.mat({ color: UW_PAL.skin, flat: true, figure: true }),
    tank: kit.mat({ color: '#8ff0e8', glow: 0.85, flat: true, spot: 0 }),
    rock: kit.mat({ color: '#3f7880', flat: true, hatch: 0.3, ...P }),
  };
}

// ------------------------------------------------------------------ towers and pods

/** A lathed shape from [radius, y] pairs (radii clamped off zero so the caps close cleanly). */
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);

/**
 * A balcony pod at (x, y, z) (y its underside's foot), R round, H tall: a saucer underside, a band of lit amber glass
 * with mullions, a pale rim; `kind` 'open' (a deck you stand on inside the rim, plants over it) or 'dome' (a roof of
 * glass ribs and a cap). yaw turns its mullions; `lit` false draws the glass dim. Solid as drawn. Returns its deck's height.
 */
export function pod(kit, M, rng, { x, y, z, R = 5, H = R * 0.9, kind = 'open', lit = true, plants = 0.7, seg = 22, stalk = 0 }) {
  const g0 = y, bowl = H * 0.36, band = H * 0.42, rim = H * 0.1;
  // the underside: a saucer from a narrow foot out to the full radius
  kit.add(M.under, lathe([[R * 0.18, g0], [R * 0.55, g0 + bowl * 0.25], [R * 0.86, g0 + bowl * 0.62], [R, g0 + bowl]], seg).translate(x, 0, z), SOLID);
  // the glass band (its own lit tone), the mullions over it
  const gy0 = g0 + bowl, gy1 = gy0 + band;
  kit.add(lit ? M.glass : M.glassDim, new THREE.CylinderGeometry(R * 1.0, R * 0.98, band, seg, 1, true).translate(x, (gy0 + gy1) / 2, z), SOLID);
  const n = Math.max(8, Math.round(R * 2.6)), a0 = rng() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    kit.add(M.mullion, put(new THREE.BoxGeometry(0.08, band, 0.08), x + Math.cos(a) * R, (gy0 + gy1) / 2, z + Math.sin(a) * R, -a), NS);   // (4 cm proud of the glass: what you climb is the glass)
  }
  // the rim, and over it the deck (open) or the roof
  kit.add(M.rim, lathe([[R * 0.97, gy1], [R * 1.07, gy1 + rim * 0.2], [R * 1.07, gy1 + rim], [R * 0.9, gy1 + rim]], seg).translate(x, 0, z), SOLID);
  const top = gy1 + rim;
  if (kind === 'open') {
    kit.add(M.rim, new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.3, seg).translate(x, top - 0.15, z), SOLID);
    for (let i = 0, k = Math.round(R * 1.6 * plants); i < k; i++) {
      const a = rng() * TAU, rr = R * (0.72 + rng() * 0.22), s = 0.7 + rng() * 0.9;
      kit.add(M.leaf[Math.floor(rng() * M.leaf.length)], leafCrown(Math.floor(rng() * 1e4), { lobes: 4, detail: 0 }).scale(s, s * 0.7, s).translate(x + Math.cos(a) * rr, top + s * 0.3, z + Math.sin(a) * rr), NS);
    }
  } else {
    // a roof of glass: amber panes between ribs, a pale cap
    kit.add(lit ? M.glass : M.glassDim, lathe([[R * 0.98, top], [R * 0.9, top + H * 0.22], [R * 0.66, top + H * 0.42], [R * 0.3, top + H * 0.52], [0, top + H * 0.55]], seg).translate(x, 0, z), SOLID);
    for (let i = 0; i < n; i += 2) {
      const a = a0 + (i / n) * TAU, c = Math.cos(a), s = Math.sin(a);
      const pts = [[R * 1.0, top], [R * 0.92, top + H * 0.22], [R * 0.68, top + H * 0.42], [R * 0.32, top + H * 0.525], [0.02, top + H * 0.56]].map(([r, yy]) => new THREE.Vector3(x + c * r, yy, z + s * r));
      kit.add(M.mullion, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.07, 4, false), NS);
    }
    kit.add(M.rim, new THREE.CylinderGeometry(R * 0.22, R * 0.28, H * 0.08, 12).translate(x, top + H * 0.56, z), NS);
  }
  if (stalk > 0) kit.add(M.under, new THREE.CylinderGeometry(R * 0.14, R * 0.22, stalk, 10).translate(x, g0 - stalk / 2, z), SOLID);
  if (lit) kit.light(x, gy0 + band / 2, z, R * 1.6);
  return top;
}

/**
 * A tower at (x, z) from y0 up h, r round: a pale salmon shaft, a ring every storey, round windows (a share lit),
 * a top ('dome' | 'spire' | 'flat'), and pods round it (pods: [{ y, a (angle), R, kind, out (how far out of the
 * wall: 0.6 of R) }…]). Solid as drawn. Returns the pods' tops [{ x, y, z, R }].
 */
export function tower(kit, M, rng, { x, z, y0 = 0, h = 50, r = 6, top = 'dome', storey = 4.6, windows = 0.6, lit = 0.35, pods = [], tone, seg = 24 }) {
  const mat = M.tower[tone ?? Math.floor(rng() * M.tower.length)];
  kit.add(mat, new THREE.CylinderGeometry(r * 0.96, r, h, seg, 1, false).translate(x, y0 + h / 2, z), SOLID);
  for (let yy = y0 + storey; yy < y0 + h - 2; yy += storey) kit.add(M.rim, new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.35, seg).translate(x, yy, z), SOLID);   // (solid: a climber holds the ring)
  // round windows: dark discs on the wall, some lit
  const per = Math.max(4, Math.round(r * 1.1));
  for (let yy = y0 + storey * 0.55; yy < y0 + h - 3; yy += storey) {
    for (let i = 0; i < per; i++) {
      if (rng() > windows) continue;
      const a = (i + (Math.floor(yy) % 2) * 0.5) / per * TAU + rng() * 0.2, wr = 0.45 + rng() * 0.35;
      const g = new THREE.CircleGeometry(wr, 10).rotateY(Math.PI / 2 + a);
      kit.add(rng() < lit ? M.windowLit : M.window, g.translate(x + Math.cos(a) * (r + 0.03), yy, z - Math.sin(a) * (r + 0.03)), NS);
    }
  }
  const yt = y0 + h;
  if (top === 'dome') kit.add(mat, new THREE.SphereGeometry(r * 0.98, seg, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.7, 1).translate(x, yt, z), SOLID);
  else if (top === 'spire') {
    kit.add(mat, lathe([[r, yt], [r * 0.8, yt + r * 0.4], [r * 0.45, yt + r * 0.9], [r * 0.2, yt + r * 1.3], [0, yt + r * 1.4]], seg).translate(x, 0, z), SOLID);
    kit.add(M.post, new THREE.CylinderGeometry(0.08, 0.14, r * 3, 5).translate(x, yt + r * 1.4 + r * 1.5, z), NS);
  } else kit.add(M.rim, new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.6, seg).translate(x, yt + 0.3, z), SOLID);
  const out = [];
  for (const p of pods) {
    const R = p.R ?? r * 0.8, d = r + R * (p.out ?? 0.55), px = x + Math.cos(p.a) * d, pz = z + Math.sin(p.a) * d;
    const t = pod(kit, M, rng, { x: px, y: p.y, z: pz, R, H: p.H ?? R * 0.85, kind: p.kind ?? (rng() < 0.5 ? 'open' : 'dome'), lit: p.lit ?? rng() < 0.8, plants: p.plants ?? 0.7 });
    out.push({ x: px, y: t, z: pz, R, kind: p.kind });
  }
  return out;
}

/** Pods for a tower: n of them up its height, round it (each a little round from the last), R about rr. */
export function podRing(rng, { h, y0 = 0, n = 5, rr = 4, from = 6, a0 = rng() * TAU, spread = 2.4, kinds = ['open', 'dome'] }) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + from + (i / Math.max(n - 1, 1)) * (h - from - rr * 1.6);
    list.push({ y, a: a0 + i * spread + (rng() - 0.5) * 0.6, R: rr * (0.75 + rng() * 0.5), kind: kinds[Math.floor(rng() * kinds.length)] });
  }
  return list;
}

// ------------------------------------------------------------------ the glass columns and their bubbles

/**
 * Glass columns of luminous water (cols: [{ x, z, r, y0, y1 }…]) with bubbles rising in them: the columns merged (solid
 * as drawn), the bubbles one InstancedMesh of small discs on the glass, moved by one mover. `near` (optional, a
 * function → a point) skips the bubbles of columns far from it. Returns { mesh, update(t) }.
 */
export function glassColumns(kit, M, cols, { per = 2.6, speed = 1.4, mover = true, near = 0 } = {}) {
  const rng = mulberry32(cols.length * 977 + 3), list = [];
  for (const c of cols) {
    kit.add(M.column, new THREE.CylinderGeometry(c.r, c.r, c.y1 - c.y0, 18, 1, true).translate(c.x, (c.y0 + c.y1) / 2, c.z), SOLID);
    kit.add(M.frame, new THREE.CylinderGeometry(c.r * 1.12, c.r * 1.12, 0.6, 18).translate(c.x, c.y0 + 0.3, c.z), SOLID);
    kit.add(M.frame, new THREE.CylinderGeometry(c.r * 1.12, c.r * 1.12, 0.6, 18).translate(c.x, c.y1 - 0.3, c.z), SOLID);
    const n = Math.round((c.y1 - c.y0) * c.r * per);
    for (let i = 0; i < n; i++) list.push({ c, a: rng() * TAU, y: rng() * (c.y1 - c.y0 - 1), s: 0.05 + rng() * rng() * 0.24, v: speed * (0.6 + rng() * 0.8), wob: rng() * TAU });
  }
  const geo = new THREE.CircleGeometry(1, 10);
  const mesh = new THREE.InstancedMesh(geo, M.bubble, Math.max(1, list.length));
  mesh.name = 'Bubbles'; mesh.userData.noCollide = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  kit.group.add(mesh);
  kit.noShadow?.push?.(mesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  // (near > 0 and a point `at`: only the bubbles of the columns within near m of it move; the rest keep their places)
  const update = (t, at = null) => {
    let k = 0;
    for (const b of list) {
      const c = b.c;
      if (near > 0 && at && Math.hypot(at.x - c.x, at.z - c.z) > near) { k++; continue; }
      const L = c.y1 - c.y0 - 0.8, yy = c.y0 + 0.4 + ((b.y + t * b.v) % L + L) % L;
      const a = b.a + Math.sin(t * 0.8 + b.wob) * 0.12;
      _p.set(c.x + Math.cos(a) * c.r * 1.01, yy, c.z + Math.sin(a) * c.r * 1.01);
      _q.setFromEuler(_e.set(0, Math.PI / 2 - a, 0));
      const s = b.s * Math.min(1, (yy - c.y0) / 1.5, (c.y1 - yy) / 1.5);
      mesh.setMatrixAt(k++, _m.compose(_p, _q, _s.set(s, s, s)));
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  if (mover) kit.mover(update);
  return { mesh, update };
}

// ------------------------------------------------------------------ the café domes

/** three.js's sphere puts phi = 0 at -x; ours (yaw) at +z, growing toward +x. */
const phiOf = (yaw) => yaw + Math.PI / 2;
const thetaAt = (y, r, sy) => Math.acos(THREE.MathUtils.clamp(y / (r * sy), -1, 1));

/**
 * The surface of a dome (r round, sy its height over r, floor at y = 0) between heights ya and yb, all round but the
 * gaps ([[yaw, half angle]…]): the pieces of shell, and the pieces in the gaps (each with its gap's index).
 */
function domeRow(r, sy, ya, yb, gaps, seg = 32) {
  const t0 = thetaAt(yb, r, sy), t1 = thetaAt(ya, r, sy), th = t1 - t0;
  const rows = Math.max(1, Math.ceil(th / 0.18));
  const piece = (a, len) => new THREE.SphereGeometry(r, Math.max(2, Math.ceil(seg * len / TAU)), rows, phiOf(a), len, t0, th).scale(1, sy, 1);
  if (!gaps.length) return { shell: [piece(0, TAU)], holes: [] };
  const g = gaps.map(([yaw, h], i) => ({ a: yaw - h, b: yaw + h, i })).sort((p, q) => p.a - q.a);
  const shell = [], holes = [];
  for (let k = 0; k < g.length; k++) {
    holes.push({ geo: piece(g[k].a, g[k].b - g[k].a), i: g[k].i });
    const next = k + 1 < g.length ? g[k + 1].a : g[0].a + TAU;
    if (next - g[k].b > 1e-3) shell.push(piece(g[k].b, next - g[k].b));
  }
  return { shell, holes };
}

/** A tube along the dome's surface (r round, sy tall) through [yaw, y] points (y over the floor), a little out from it. */
function onDome(r, sy, pts, rad = 0.1) {
  const P = pts.map(([yaw, y]) => {
    const th = thetaAt(y, r, sy), rr = Math.sin(th) * r * 1.012;
    return new THREE.Vector3(Math.sin(yaw) * rr, Math.cos(th) * r * sy * 1.012, Math.cos(yaw) * rr);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), Math.max(4, pts.length * 3), rad, 4, false);
}

/**
 * A café under a dome at (x, y, z) (y its floor), r round, sy its height over r.
 *   shell     'glass': a glass dome on ribs (S_GLASS: only its rim and a highlight drawn); else the shell's tone
 *             ('teal', 'pink') with windows of glass in it (windows: [{ yaw, w (m), y0, y1 }…], heights over the floor)
 *   door      { yaw, w, h }: left open (the way in)
 *   porthole  a lit round window in the top (its radius, m), 0 none
 * Inside: the warm floor, tables and chairs, a counter at the back, pendant lamps, people at the tables. Solid as drawn
 * (the glass too). Returns { x, y, z, r, sy, air(x, y, z), tables: [[x, z]…], door: [x, z], doorYaw }.
 */
export function cafeDome(kit, M, rng, { x, y = 0, z, r = 10, sy = 0.85, shell = 'glass', doorYaw = 0, doorW = 3.2, doorH = 3.4, windows = [], porthole = 0, tables = Math.round(r * 0.9), people = 0, ribs = 12, base = 0.9 }) {
  const glassMat = kit.mat({ color: UW_PAL.domeGlass, glass: true, glassCenter: new THREE.Vector3(x, y, z), line: 0.5, lineTint: 0.7 });
  const shellMat = shell === 'glass' ? glassMat : M.shell[shell] ?? M.shell.teal;
  const H = r * sy, at = (g) => g.translate(x, y, z);
  // the gaps: the door (open) and the windows (glass), in rows between their tops and feet
  const gaps = [{ yaw: doorYaw, half: Math.asin(Math.min(0.95, doorW / 2 / r)), y0: 0, y1: doorH, door: true },
    ...windows.map((w) => ({ yaw: w.yaw, half: Math.asin(Math.min(0.95, w.w / 2 / r)), y0: w.y0, y1: Math.min(w.y1, H * 0.92) }))];
  const cuts = [...new Set([0, H, ...gaps.flatMap((g) => [g.y0, g.y1])])].filter((v) => v >= 0 && v <= H).sort((a, b) => a - b);
  for (let k = 0; k < cuts.length - 1; k++) {
    const ya = cuts[k], yb = cuts[k + 1];
    if (yb - ya < 0.05) continue;
    const open = gaps.filter((g) => g.y0 <= ya + 1e-3 && g.y1 >= yb - 1e-3);
    const { shell: s, holes } = domeRow(r, sy, ya, yb, open.map((g) => [g.yaw, g.half]));
    for (const geo of s) {
      if (shell !== 'glass') kit.add(M.lining, at(geo.clone().scale(0.985, 0.985, 0.985)), { solid: false, shadow: false });   // (its inside: drawn only)
      kit.add(shellMat, at(geo), { solid: true, shadow: false });   // (casting no shadow: the inside is lit, as the sheets have it)
    }
    for (const h of holes) if (!open[h.i].door) kit.add(glassMat, at(h.geo), SOLID);
  }
  // the frames: ribs over a glass dome; round each window of a shell; the door's posts and lintel
  if (shell === 'glass') {
    const dh = gaps[0].half;
    for (let i = 0; i < ribs; i++) {
      const a = doorYaw + dh + (i + 0.5) / ribs * (TAU - 2 * dh);
      kit.add(M.frame, at(onDome(r, sy, Array.from({ length: 9 }, (_, k) => [a, (H * k) / 8]), 0.09)), NS);
    }
    for (const f of [0.42, 0.85]) kit.add(M.frame, at(new THREE.TorusGeometry(Math.sin(thetaAt(H * f, r, sy)) * r * 1.012, 0.1, 4, 40).rotateX(Math.PI / 2).translate(0, H * f * 1.012, 0)), NS);
  } else {
    for (const g of gaps.slice(1)) {
      const arc = (yy) => Array.from({ length: 7 }, (_, k) => [g.yaw - g.half + (2 * g.half * k) / 6, yy]);
      kit.add(M.frame, at(onDome(r, sy, arc(g.y0), 0.14)), NS);
      kit.add(M.frame, at(onDome(r, sy, arc(g.y1), 0.14)), NS);
      for (const e of [-1, 1]) kit.add(M.frame, at(onDome(r, sy, Array.from({ length: 5 }, (_, k) => [g.yaw + e * g.half, g.y0 + ((g.y1 - g.y0) * k) / 4]), 0.14)), NS);
      // the mullions across the glass
      for (let k = 1, n = Math.max(1, Math.round((2 * g.half * r) / 1.6)); k < n; k++) {
        const a = g.yaw - g.half + (2 * g.half * k) / n;
        kit.add(M.frame, at(onDome(r, sy, Array.from({ length: 4 }, (_, j) => [a, g.y0 + ((g.y1 - g.y0) * j) / 3]), 0.06)), NS);
      }
    }
    if (porthole > 0) {
      kit.add(M.windowLit, at(new THREE.CircleGeometry(porthole, 20).rotateX(-Math.PI / 2).translate(0, H + 0.02, 0)), NS);
      kit.add(M.frame, at(new THREE.TorusGeometry(porthole, 0.18, 5, 24).rotateX(Math.PI / 2).translate(0, H + 0.04, 0)), NS);
    }
  }
  const dh = gaps[0].half;
  for (const e of [-1, 1]) {
    const a = doorYaw + e * dh;
    kit.add(M.frame, new THREE.BoxGeometry(0.3, doorH + base, 0.3).translate(x + Math.sin(a) * r, y + (doorH - base) / 2, z + Math.cos(a) * r), SOLID);
  }
  kit.add(M.frame, put(new THREE.BoxGeometry(doorW + 0.6, 0.35, 0.35), x + Math.sin(doorYaw) * r, y + doorH, z + Math.cos(doorYaw) * r, doorYaw), SOLID);
  // the base ring (round the shell's foot) and the floor
  kit.add(M.frame, lathe([[r * 1.04, y - base], [r * 1.06, y - base * 0.4], [r * 1.02, y + 0.05], [r * 0.98, y + 0.05]], 40).translate(x, 0, z), SOLID);
  kit.add(M.floor, new THREE.CylinderGeometry(r * 0.99, r * 0.99, 0.2, 40).translate(x, y - 0.06, z), SOLID);   // (4 cm over the street it stands on)
  const list = cafeInside(kit, M, rng, { x, y, z, r, H, doorYaw, tables, people });
  const R2 = (r - 0.25) ** 2;
  return {
    x, y, z, r, sy, tables: list, door: [x + Math.sin(doorYaw) * r, z + Math.cos(doorYaw) * r], doorYaw,
    // air inside the shell (down to the base ring's foot)
    air: (px, py, pz) => py > y - base - 0.5 && (px - x) ** 2 + (pz - z) ** 2 + ((py - y) / sy) ** 2 < R2,
  };
}

/** A café's inside (floor at y, r round, H high, the door toward doorYaw): the counter, tables and chairs, lamps, people. */
function cafeInside(kit, M, rng, { x, y, z, r, H, doorYaw, tables, people }) {
  const back = doorYaw + Math.PI, bx = x + Math.sin(back) * r * 0.5, bz = z + Math.cos(back) * r * 0.5;
  // the counter, and behind it a dresser of dark wood: shelves of bottles and jars
  const W = r * 0.7, DH = Math.min(2.6, H * 0.5);
  kit.add(M.wallIn, put(new THREE.BoxGeometry(W, 1.05, 0.8), bx, y + 0.52, bz, back), SOLID);
  kit.add(M.chair, put(new THREE.BoxGeometry(W + 0.1, 0.08, 0.9), bx, y + 1.08, bz, back), SOLID);
  kit.add(M.wallIn, put(new THREE.BoxGeometry(W, DH, 0.3).translate(0, DH / 2, 1.25), bx, y, bz, back), SOLID);   // (local +z: toward the back wall)
  for (const sy of [0.95, 1.55, 2.15].filter((v) => v < DH - 0.2)) {
    kit.add(M.table, put(new THREE.BoxGeometry(W - 0.2, 0.05, 0.32).translate(0, sy, 1.0), bx, y, bz, back), NS);
    for (let i = 0, n = Math.round(W / 0.45); i < n; i++) {
      if (rng() < 0.25) continue;
      const big = rng() < 0.3, hgt = big ? 0.22 : 0.32;
      kit.add(rng() < 0.5 ? M.windowLit : M.glassDim, put(new THREE.CylinderGeometry(big ? 0.1 : 0.05, big ? 0.1 : 0.06, hgt, 6).translate(-W / 2 + 0.3 + i * 0.45 + (rng() - 0.5) * 0.1, sy + 0.03 + hgt / 2, 1.0), bx, y, bz, back), NS);
    }
  }
  const list = [];
  const dx = x + Math.sin(doorYaw) * r * 0.85, dz = z + Math.cos(doorYaw) * r * 0.85;
  for (let i = 0, tries = 0; i < tables && tries < tables * 12; tries++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.78;
    const tx = x + Math.sin(a) * d, tz = z + Math.cos(a) * d;
    if (Math.hypot(tx - bx, tz - bz) < 2.2 || Math.hypot(tx - dx, tz - dz) < 2.6 || list.some(([qx, qz]) => Math.hypot(tx - qx, tz - qz) < 2.4)) continue;
    list.push([tx, tz]); i++;
    kit.add(M.chair, new THREE.CylinderGeometry(0.06, 0.12, 0.74, 6).translate(tx, y + 0.37, tz), SOLID);
    kit.add(M.table, new THREE.CylinderGeometry(0.55, 0.55, 0.06, 14).translate(tx, y + 0.77, tz), SOLID);
    for (let c = 0, nc = 2 + Math.floor(rng() * 3); c < nc; c++) {
      const ca = rng() * TAU + c * (TAU / nc), cx = tx + Math.sin(ca) * 0.85, cz = tz + Math.cos(ca) * 0.85;
      kit.add(M.chair, put(new THREE.BoxGeometry(0.42, 0.06, 0.42).translate(0, 0.46, 0), cx, y, cz, ca), SOLID);
      kit.add(M.chair, put(new THREE.BoxGeometry(0.42, 0.5, 0.05).translate(0, 0.72, 0.2), cx, y, cz, ca), NS);
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) kit.add(M.chair, put(new THREE.BoxGeometry(0.04, 0.46, 0.04).translate(lx, 0.23, lz), cx, y, cz, ca), NS);
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * TAU, d = rng() * r * 0.5, lx = x + Math.sin(a) * d, lz = z + Math.cos(a) * d, ly = y + H * 0.62;
    kit.add(M.post, new THREE.CylinderGeometry(0.02, 0.02, H - (ly - y), 3).translate(lx, (ly + y + H) / 2, lz), NS);
    kit.add(M.lamp, new THREE.SphereGeometry(0.28, 10, 6, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI).translate(lx, ly, lz), NS);
  }
  kit.light(x, y + 2.4, z, r * 1.3);
  for (let k = 0; k < people; k++) {
    const t = list[k % Math.max(list.length, 1)];
    if (!t) break;
    const a = rng() * TAU;
    resident(kit, M, rng, t[0] + Math.sin(a) * 0.85, y, t[1] + Math.cos(a) * 0.85, { yaw: a + Math.PI, sit: true });
  }
  return list;
}

// ------------------------------------------------------------------ streets

/** A globe lamp on a thin post (the sheets' street lamps), its light pool. h: the globe's height. Drawn only. */
export function lampPost(kit, M, x, y, z, { h = 3.6, r = 8, cap = true } = {}) {
  kit.add(M.post, new THREE.CylinderGeometry(0.05, 0.09, h, 5).translate(x, y + h / 2, z), NS);
  kit.add(M.lamp, new THREE.SphereGeometry(0.24, 10, 8).translate(x, y + h + 0.1, z), NS);
  if (cap) kit.add(M.post, new THREE.CylinderGeometry(0.08, 0.42, 0.16, 10).translate(x, y + h + 0.38, z), NS);
  kit.light(x, y + h, z, r);
}

/**
 * A walkway along pts ([x, y, z]…, its deck's top), w wide, thick: a deck of paving, curbs both sides, piers under it
 * every `span` m down to `ground` (a function (x, z) → y, or a height) flaring into small arches, lamps every `lamps` m
 * on alternate sides. Solid as drawn. Returns the samples [{ x, y, z }].
 */
export function walkway(kit, M, pts, { w = 3.2, thick = 0.9, curb = 0.35, span = 12, ground = 0, lamps = 14, mat = M.street, pier = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const L = curve.getLength(), n = Math.max(2, Math.ceil(L / 2.4)), out = [];
  const gy = typeof ground === 'function' ? ground : () => ground;
  for (let i = 0; i < n; i++) {
    const a = curve.getPointAt(i / n), b = curve.getPointAt((i + 1) / n), d = b.clone().sub(a), len = d.length(), c = a.clone().add(b).multiplyScalar(0.5);
    const yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(THREE.MathUtils.clamp(d.y / len, -1, 1));
    kit.add(mat, put(new THREE.BoxGeometry(w, thick, len + 0.08).translate(0, -thick / 2, 0), c.x, c.y, c.z, yaw, 1, pitch, 0), SOLID);
    if (curb > 0) for (const e of [-1, 1]) kit.add(M.pier, put(new THREE.BoxGeometry(0.3, curb, len + 0.08).translate(e * (w / 2 - 0.15), curb / 2, 0), c.x, c.y, c.z, yaw, 1, pitch, 0), SOLID);
    out.push({ x: c.x, y: c.y, z: c.z });
  }
  if (pier) for (let s = span / 2; s < L; s += span) {
    const p = curve.getPointAt(s / L), g = gy(p.x, p.z), hh = p.y - thick - g;
    if (hh < 0.8) continue;
    kit.add(M.pier, new THREE.CylinderGeometry(w * 0.16, w * 0.22, hh, 10).translate(p.x, g + hh / 2, p.z), SOLID);
    kit.add(M.pier, new THREE.CylinderGeometry(w * 0.42, w * 0.16, Math.min(2.4, hh * 0.3), 10).translate(p.x, p.y - thick - Math.min(1.2, hh * 0.15), p.z), SOLID);
  }
  if (lamps > 0) for (let s = lamps / 2, k = 0; s < L; s += lamps, k++) {
    const t = s / L, p = curve.getPointAt(t), d = curve.getTangentAt(t), e = k % 2 ? 1 : -1;
    const sx = d.z, sz = -d.x, m = Math.hypot(sx, sz) || 1;
    lampPost(kit, M, p.x + (sx / m) * e * (w / 2 - 0.15), p.y + curb, p.z + (sz / m) * e * (w / 2 - 0.15), { h: 3.2 });
  }
  return out;
}

/** A straight stair from (x, y0, z) climbing to y1 toward -z before its yaw, w wide, steps `rise` high. Solid as drawn. Returns its top's middle. */
export function stair(kit, M, { x, z, y0, y1, w = 3, yaw = 0, rise = 0.3, run = 0.42, mat = M.pier }) {
  const n = Math.max(1, Math.round((y1 - y0) / rise)), dr = (y1 - y0) / n, c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const f = -(i + 0.5) * run, top = y0 + (i + 1) * dr;
    kit.add(mat, put(new THREE.BoxGeometry(w, top - y0 + 0.05, run).translate(0, (top - y0) / 2, 0), x + s * f, y0 - 0.05, z + c * f, yaw), SOLID);
  }
  return [x - s * n * run, y1, z - c * n * run];
}

/** A dark green bush (a clump of leaf lobes) at (x, y, z), s across. Drawn only. */
export function bush(kit, M, rng, x, y, z, s = 1.4) {
  kit.add(M.leaf[Math.floor(rng() * M.leaf.length)], leafCrown(Math.floor(rng() * 1e4), { lobes: 5, detail: 0 }).scale(s, s * 0.75, s).translate(x, y + s * 0.3, z), NS);
}

/** Kelp: tall ribbons rising from the bed, swaying (one mover for the bunch). at: [x, y, z]; n ribbons, h tall. */
export function kelp(kit, M, rng, at, { n = 6, h = 9, spread = 2.5 } = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(0.5 + rng() * 0.4, h * (0.6 + rng() * 0.5), 1, 8), p = g.attributes.position, H = g.parameters.height;
    for (let k = 0; k < p.count; k++) { const yy = p.getY(k) + H / 2, u = yy / H; p.setY(k, yy); p.setX(k, p.getX(k) * (1 - u * 0.5) + Math.sin(u * 3 + i) * u * 0.8); p.setZ(k, Math.cos(u * 2.4 + i) * u * 0.5); }
    g.computeVertexNormals();
    parts.push(put(g, (rng() - 0.5) * spread, 0, (rng() - 0.5) * spread, rng() * TAU));
  }
  const m = kit.mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())).translate(at[0], at[1], at[2]), M.kelp, NS);
  m.name = 'Kelp';
  m.userData.flora = true;
  const ph = rng() * 9;
  kit.mover((t) => { m.rotation.z = Math.sin(t * 0.5 + ph) * 0.04; m.rotation.x = Math.cos(t * 0.37 + ph) * 0.03; });
  return m;
}

/** A low mass of rock on the bed at (x, y, z), s across. Solid as drawn. */
export function rock(kit, M, x, y, z, s = 3, seed = 1) {
  kit.add(M.rock, lumpy(new THREE.IcosahedronGeometry(1, 1), 0.25, 1.6, seed).scale(s, s * 0.55, s * 0.8).translate(x, y + s * 0.2, z), SOLID);
}

// ------------------------------------------------------------------ life

/** The manta's three parts (body, wings), flat shapes lying in xz, its nose toward +z, w across the wings. */
function mantaParts(w) {
  const half = w / 2;
  const wing = new THREE.Shape();
  wing.moveTo(0, w * 0.22); wing.quadraticCurveTo(half * 0.55, w * 0.18, half, -w * 0.06);
  wing.quadraticCurveTo(half * 0.55, -w * 0.06, 0, -w * 0.24); wing.lineTo(0, w * 0.22);
  const wg = new THREE.ShapeGeometry(wing, 8).rotateX(-Math.PI / 2);
  const body = new THREE.Shape();
  body.moveTo(-w * 0.09, w * 0.24); body.lineTo(w * 0.09, w * 0.24); body.lineTo(w * 0.06, -w * 0.26); body.lineTo(0, -w * 0.3); body.lineTo(-w * 0.06, -w * 0.26); body.lineTo(-w * 0.09, w * 0.24);
  const bg = new THREE.ExtrudeGeometry(body, { depth: w * 0.035, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -w * 0.017, 0);
  const tail = new THREE.CylinderGeometry(w * 0.004, w * 0.012, w * 0.55, 4).rotateX(Math.PI / 2).translate(0, 0, w * 0.55);
  return { wg, body: mergeGeometries([bg.toNonIndexed(), tail.toNonIndexed()]) };
}

/**
 * A manta gliding round a loop overhead: centre [x, y, z], radius R, w across, speed m/s, its wings beating slowly.
 * Drawn only (its own group); moved by a mover. Returns its group.
 */
export function manta(kit, M, { at, R = 60, w = 14, speed = 3, phase = 0, bank = 0.25, tilt = 0, fixed = null } = {}) {
  const g = new THREE.Group();
  g.name = 'Manta';
  g.userData.noCollide = true;
  const { wg, body } = mantaParts(w);
  const b = new THREE.Mesh(body, M.manta);
  const wl = new THREE.Mesh(wg, M.manta), wr = new THREE.Mesh(wg.clone().scale(-1, 1, 1), M.manta);
  wl.position.x = w * 0.08; wr.position.x = -w * 0.08;
  g.add(b, wl, wr);
  kit.group.add(g);
  for (const m of [b, wl, wr]) kit.noShadow?.push?.(m);
  const place = (t) => {
    const a = phase + (t * speed) / R;
    if (fixed) { g.position.set(...fixed.pos); g.rotation.set(fixed.pitch ?? 0, fixed.yaw ?? 0, fixed.roll ?? 0, 'YXZ'); }
    else {
      g.position.set(at[0] + Math.cos(a) * R, at[1] + Math.sin(a * 2) * 2, at[2] + Math.sin(a) * R);
      g.rotation.set(tilt, -a + (speed > 0 ? Math.PI : 0), bank * Math.sign(speed), 'YXZ');
    }
    const flap = Math.sin(t * 1.1 + phase) * 0.28;
    wl.rotation.z = flap; wr.rotation.z = -flap;
  };
  place(0);
  kit.mover(place);
  return g;
}

/**
 * A school of small pale fish milling round a point: n of them, one InstancedMesh, one mover. at: [x, y, z]; R its
 * radius. Returns the mesh.
 */
export function fishSchool(kit, M, { at, n = 40, R = 5, size = 0.35, speed = 0.4, seed = 5 } = {}) {
  const rng = mulberry32(seed);
  const g = mergeGeometries([
    new THREE.ConeGeometry(0.25, 1, 5).rotateX(Math.PI / 2).toNonIndexed(),
    new THREE.ConeGeometry(0.22, 0.4, 3).rotateX(-Math.PI / 2).scale(0.2, 1, 1).translate(0, 0, -0.62).toNonIndexed(),
  ]);
  const mesh = new THREE.InstancedMesh(g, M.fish, n);
  mesh.name = 'Fish'; mesh.userData.noCollide = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  kit.group.add(mesh);
  kit.noShadow?.push?.(mesh);
  const f = Array.from({ length: n }, () => ({ r: R * (0.4 + rng() * 0.6), y: (rng() - 0.5) * R * 0.5, a: rng() * TAU, v: speed * (0.8 + rng() * 0.4), s: size * (0.7 + rng() * 0.6) }));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const update = (t) => {
    for (let i = 0; i < n; i++) {
      const o = f[i], a = o.a + t * o.v;
      _p.set(at[0] + Math.cos(a) * o.r, at[1] + o.y + Math.sin(t * 0.7 + i) * 0.3, at[2] + Math.sin(a) * o.r);
      _q.setFromEuler(_e.set(0, -a, 0));
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(o.s)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  kit.mover(update);
  return mesh;
}

/**
 * A resident (drawn only): legs, a coat, shoulders, a head; `sit`: on a chair (shorter, the legs forward). In the
 * sheets' figures' colours.
 */
export function resident(kit, M, rng, x, y, z, { h = 1.65, yaw = rng() * TAU, sit = false } = {}) {
  const coat = M.people[Math.floor(rng() * M.people.length)], c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (m, g, f, s2, yy) => kit.add(m, put(g, x + s * f + c * s2, y + yy, z + c * f - s * s2, yaw), NS);
  const legs = M.people[(M.people.indexOf(coat) + 3) % M.people.length], lift = sit ? -0.18 * h : 0;
  if (!sit) for (const e of [-1, 1]) at(legs, new THREE.CylinderGeometry(0.06 * h, 0.05 * h, h * 0.42, 5), 0, e * 0.07 * h, h * 0.21);
  else for (const e of [-1, 1]) at(legs, new THREE.CylinderGeometry(0.06 * h, 0.05 * h, h * 0.3, 5).rotateX(Math.PI / 2), 0.12 * h, e * 0.07 * h, h * 0.27);
  at(coat, new THREE.CylinderGeometry(0.12 * h, 0.19 * h, h * 0.5, 8), 0, 0, h * 0.6 + lift);
  at(coat, new THREE.SphereGeometry(0.14 * h, 8, 5).scale(1.2, 0.6, 0.85), 0, 0, h * 0.84 + lift);
  at(M.skin, new THREE.SphereGeometry(0.075 * h, 8, 6), 0, 0, h * 0.94 + lift);
}

/** A swimmer (the sheets' small dark figures between the towers): a diver lying along yaw, pitched, its tank lit. Drawn only. */
export function swimmer(kit, M, x, y, z, { yaw = 0, pitch = 0.2, h = 1.7 } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * h / 1.7, 0.95 * h / 1.7, 3, 8).rotateX(Math.PI / 2), M.suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13 * h / 1.7, 8, 6).translate(0, 0.05, 0.72 * h / 1.7), M.suit));
  for (const e of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.9, 5).rotateX(Math.PI / 2 + e * 0.15).translate(e * 0.1, -0.02, -0.85 * h / 1.7), M.suit));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 3, 8).rotateX(Math.PI / 2).translate(0, 0.2, 0.05), M.tank));
  g.position.set(x, y, z); g.rotation.set(pitch, yaw, 0, 'YXZ');
  g.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(g);
  return g;
}

/** The traveller seen from behind, his pack glowing (the sheets' figure for scale: the tank's cyan, as they draw it). */
export function travellerFigure(kit, x, y, z, { yaw = 0, s = 1 } = {}) {
  const g = new THREE.Group();
  const suit = kit.mat({ color: '#3f5a66', flat: true, figure: true });
  const pack = kit.mat({ color: '#9ff4ee', glow: 0.92, flat: true, spot: 0 });
  const hair = kit.mat({ color: '#2f4a6a', flat: true, figure: true });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.25, 10).translate(0, 0.65, 0), suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8).translate(0, 1.45, 0), hair));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.3).translate(0, 1.0, 0.3), pack));
  g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s);
  g.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(g);
  kit.light?.(x, y + 1, z + 0.4, 3);
  return g;
}

/**
 * The city far off: a field of plain towers with pods, low on detail (the haze takes them), merged, drawn only.
 * Around (x, z) between rMin and rMax, n towers, toward the directions `arc` ([a0, a1] rad; all round by default);
 * `outside`: none inside the square |x|, |z| < outside (the world's limit, so nobody walks into them).
 */
export function farCity(kit, M, rng, { x = 0, z = 0, rMin = 150, rMax = 420, n = 40, arc = [0, TAU], hMin = 30, hMax = 90, outside = 0, ground = () => 0 } = {}) {
  const mat = M.tower[2], rim = M.rim, glass = M.glassDim;
  for (let i = 0; i < n; i++) {
    const a = arc[0] + rng() * (arc[1] - arc[0]), d = rMin + rng() * (rMax - rMin);
    const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d, h = hMin + rng() * (hMax - hMin), r = 3 + rng() * 6;
    if (Math.max(Math.abs(tx), Math.abs(tz)) < outside) continue;   // (only out of reach: past the world's limit)
    const g0 = ground(tx, tz) - 1;
    kit.add(mat, new THREE.CylinderGeometry(r * 0.95, r, h, 10).translate(tx, g0 + h / 2, tz), NS);
    kit.add(mat, new THREE.SphereGeometry(r, 10, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1).translate(tx, g0 + h, tz), NS);
    for (let k = 0, m = 2 + Math.floor(rng() * 4); k < m; k++) {
      const pa = rng() * TAU, R = r * (0.6 + rng() * 0.5), py = g0 + 6 + rng() * (h - 10), px = tx + Math.cos(pa) * (r + R * 0.5), pz = tz + Math.sin(pa) * (r + R * 0.5);
      kit.add(rim, new THREE.CylinderGeometry(R, R * 0.3, R * 0.5, 10).translate(px, py, pz), NS);
      kit.add(glass, new THREE.CylinderGeometry(R, R, R * 0.45, 10).translate(px, py + R * 0.47, pz), NS);
    }
  }
}
