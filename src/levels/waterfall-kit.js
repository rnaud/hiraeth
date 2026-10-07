import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { MODE_STRATA } from '../materials.js';
import { put } from './lab-kit.js';
import { lumpy } from './sky-stones-kit.js';
import { leafCrown } from './garden-kit.js';

// ---------------------------------------------------------------------------
// The City Behind the Waterfall's pieces (references/The City Behind the Waterfall), shared by its
// reference views (reference-waterfall.js) and the world (waterfall.js). Everything goes through a
// kit with RoomKit's face (lab-kit.js: mat, add, mesh, light, mover, group): geometry in the kit's
// frame, fronts looking toward +z before their yaw.
//
//   waterfall    a falling sheet (waterfall-shader.js: flat bands streaming down, pen streaks,
//                see-through slits, a lip and a mist), the mist bank at its foot
//   rock         the cavern's walls, roof and pillars: lumpy faceted masses in a teal strata rock
//   houses       rounded houses of warm pale stone: domed drums, barrel vaults, rounded blocks, each
//                with its arched door, round windows (a few lit amber), now and then an awning,
//                a balcony, pots of plants
//   terraces     the streets carved into the rock: a platform, its retaining wall, a parapet
//   stairs, arch bridges, copper pipes with their collars, amber lamps, potted plants, residents
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
/** The deep cavern fades into a teal haze in stepped bands (post.js 4b): the world's and its views'. */
export const WATERFALL_HAZE = { uHazeLayers: [70, 1.9, 0.12, 4], uHazeTone: [0.36, 0.6, 0.62, 0.85] };
/** The world's touches on the print preset (WATERFALL_LOOK's, without the views' clean sky): few strokes, no bounce, the teal haze. */
export const WATERFALL_WORLD_LOOK = { uHalftone: 0.06, uBounce: 0, uHatch: 0.14, uLineWidth: 0.9, uShadeKeep: 0, uCumulus: 0, uClouds: 0.15, ...WATERFALL_HAZE };
/** sky top, horizon, shadow (the cavern's teal), light, sun */
export const WATERFALL_DAY = ['#a9dcd6', '#f2ead0', '#447f86', '#fff2dc', '#fff3d6'];
export const WATERFALL_DUSK = ['#d9b9b4', '#f7d6bf', '#566f7e', '#ffe2cf', '#ffd0a8'];
export const WATERFALL_NIGHT = ['#18303a', '#2f4f58', '#203a48', '#8fb5bd', '#e9f0e0'];
const NS = { solid: false, shadow: false };

/** The sheets' colours. */
export const WF_PAL = {
  water: { deep: '#357f8a', mid: '#66c2c6', pale: '#b2ebe2' },
  stone: ['#f1dcbd', '#ecd0ad', '#f4e3c8', '#e8c9a6', '#efd6b8'],
  rock: ['#3a7178', '#366b72', '#3f777d'],
  floor: '#7fb0ad',
  dark: '#24393d',
  lamp: '#ffb455',
  awning: ['#c2603f', '#d99a4e', '#4f8f8a', '#efe0c4', '#b84f3c'],
  pot: '#c46f4a',
  leaf: ['#3f7f62', '#4f8f5f', '#2f6b5a'],
  people: ['#c46b4e', '#4f7f86', '#d9a35e', '#7a6e9e', '#b5523e', '#e0c08a', '#5f8f7a', '#a24e3e'],
  skin: '#e0b08e',
};

// ------------------------------------------------------------------ the waterfall

/**
 * A sheet of falling water: w wide and h tall, its foot at y = 0, centred on x = 0, facing +z. uv in metres
 * (x across, y up from the foot: waterfall-shader.js reads them). bow: how far its middle bulges toward +z (m);
 * lean: how far its top stands out toward +z (m; the water leaves the lip, then falls plumb).
 */
export function fallSheet({ w, h, cols = Math.max(2, Math.ceil(w / 8)), rows = Math.max(2, Math.ceil(h / 14)), bow = 0, lean = 0 }) {
  const g = new THREE.PlaneGeometry(w, h, cols, rows).translate(0, h / 2, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), u = x / (w / 2);
    p.setZ(i, bow * (1 - u * u) + lean * Math.pow(y / h, 3));
    uv.setXY(i, x + w / 2, y);
  }
  g.computeVertexNormals();
  return g;
}

/** A fall's material: o its tones ({ deep, mid, pale }) and the shader's knobs (waterfall-shader.js FALL). */
export function fallMat(kit, o = {}) {
  const t = { ...WF_PAL.water, ...(o.tones ?? {}) };
  const { tones, ...knobs } = o;
  void tones;
  // (its own light: no shade, no spot black; a thin line in a dark shade of its own colour)
  return kit.mat({ color: t.mid, color2: t.pale, color3: t.deep, fall: { ...knobs }, glow: 0.72, spot: 0, line: 0.5, lineTint: 0.6 });
}

/**
 * A waterfall: the sheet (its own mesh: it keeps its uv), drawn only (no collision, no shadow), and a mist bank
 * at its foot. at: [x, y, z] its foot's middle, yaw its facing; the rest are fallSheet's and the shader's.
 */
export function waterfall(kit, { at, w, h, yaw = 0, bow = 0, lean = 0, seed = 0, speed, column, gaps, mist = 9, ink, lip, tones, mistBank: mb = true }) {
  const mat = fallMat(kit, { speed, column, gaps, mist, ink, lip, height: h, seed, tones });
  const g = put(fallSheet({ w, h, bow, lean }), at[0], at[1], at[2], yaw);
  const m = kit.mesh(g, mat, NS);
  m.name = 'Waterfall';
  m.userData.waterfall = { at: at.slice(), w, h, yaw };
  if (mb) mistBank(kit, { at, w: w * 1.05, yaw, h: mist, seed, tones });
  return m;
}

/** Mist at a fall's foot: low pale cauliflower puffs along it, self-lit, breathing slowly (a mover). */
export function mistBank(kit, { at, w, yaw = 0, h = 9, depth = h * 0.9, n = Math.ceil(w / 5), seed = 1, tones = {} }) {
  const r = mulberry32(seed * 31 + 7), parts = [];
  const pale = tones.pale ?? WF_PAL.water.pale;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * w - w / 2 + (r() - 0.5) * 3, s = h * (0.45 + r() * 0.35);
    const ball = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.18, 1.9, seed + i).scale(s * 1.3, s * 0.8, s);
    parts.push(ball.translate(x, s * 0.35, depth * 0.35 + (r() - 0.5) * depth * 0.4));
    if (r() < 0.6) parts.push(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.2, 2.2, seed + i + 50).scale(s * 0.7, s * 0.55, s * 0.7).translate(x + (r() - 0.5) * s, s * 0.9, depth * 0.5));
  }
  const g = put(mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p)), at[0], at[1], at[2], yaw);
  g.computeVertexNormals();
  const m = kit.mesh(g, kit.mat({ color: pale, glow: 0.6, spot: 0, flat: true, line: 0.4, lineTint: 0.5 }), NS);
  m.name = 'Mist';
  const y0 = m.position.y, ph = seed * 1.7;
  kit.mover((t) => { m.position.y = y0 + Math.sin(t * 0.4 + ph) * 0.35; m.scale.y = 1 + Math.sin(t * 0.27 + ph) * 0.06; });
  return m;
}

// ------------------------------------------------------------------ materials

/** The city's materials, made by the kit (one per option set, shared). shadeFlat: how flat its shade is printed. */
export function cityMats(kit, { shadeFlat = 0.8, windows = 0 } = {}) {
  const PRINT = shadeFlat ? { shadeFlat } : {};
  const DS = THREE.DoubleSide;
  return {
    stone: WF_PAL.stone.map((c) => kit.mat({ color: c, weathered: 0.35, ...PRINT, ...(windows ? { pattern: 'facade', windows } : {}) })),
    wall: kit.mat({ color: '#e6c9a3', flat: true, weathered: 0.5, ...PRINT }),
    paving: kit.mat({ color: '#d8c2a0', flat: true, grid: 2.4, ...PRINT }),
    floor: kit.mat({ color: '#b9c4b4', flat: true, weathered: 0.5, ...PRINT }),   // (the big floors: worn stone, no slab lines)
    rock: kit.mat({ color: WF_PAL.rock[0], color2: WF_PAL.rock[1], color3: WF_PAL.rock[2], mode: MODE_STRATA, strataSize: 9, flat: true, cracks: 0.35, hatch: 0.3, ...PRINT }),
    step: kit.mat({ color: '#e2cba6', flat: true, spot: 0, hatch: 0.4, ...PRINT }),
    dark: kit.mat({ color: WF_PAL.dark, flat: true }),
    door: kit.mat({ color: '#2d4547', flat: true }),
    lit: kit.mat({ color: '#f6b860', glow: 0.8, flat: true }),
    lamp: kit.mat({ color: WF_PAL.lamp, glow: 0.95, flat: true, spot: 0 }),
    copper: kit.mat({ color: '#c47548', metal: 'copper' }),
    iron: kit.mat({ color: '#5a4a42', flat: true }),
    awning: WF_PAL.awning.map((c) => kit.mat({ color: c, flat: true, side: DS, shade: 0.25, line: 0.7, lineTint: 0.7 })),
    pot: kit.mat({ color: WF_PAL.pot, flat: true }),
    leaf: WF_PAL.leaf.map((c) => kit.mat({ color: c, flat: true, line: 0.6, lineTint: 0.6 })),
    people: WF_PAL.people.map((c) => kit.mat({ color: c, flat: true, figure: true })),
    skin: kit.mat({ color: WF_PAL.skin, flat: true, figure: true }),
    basket: kit.mat({ color: '#c9a060', flat: true, figure: true }),
  };
}

// ------------------------------------------------------------------ rock

/**
 * A lumpy faceted block of rock w × h × d centred on the origin (position only: it merges). lump: how far it
 * bulges (a share of its size), freq: how fine its lumps.
 */
export function rockMass(seed, w, h, d, { lump = 0.12, freq = null, seg = null } = {}) {
  const s = seg ?? [Math.max(2, Math.round(w / 9)), Math.max(2, Math.round(h / 9)), Math.max(2, Math.round(d / 9))];
  const g = new THREE.BoxGeometry(1, 1, 1, s[0], s[1], s[2]);
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const m = g.toNonIndexed();
  lumpy(m, lump, freq ?? 2.2, seed);
  m.scale(w, h, d);
  m.computeVertexNormals();
  return m;
}

// ------------------------------------------------------------------ houses

const arch = (w, h) => {   // a doorway's outline: straight sides, a round head
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return new THREE.ShapeGeometry(s, 6);
};

/** A door (dark, or lit from inside) and round windows on a face: fz the face's distance from the house's centre, along +z before yaw. */
function openings(kit, M, rng, { x, y, z, yaw, fz, w, h, lit = 0.3, door = true }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (g, u, v, off = 0.04) => kit.add(rng() < lit ? M.lit : M.door, put(g, x + c * u + s * (fz + off), y + v, z - s * u + c * (fz + off), yaw), NS);
  if (door && w > 2.4) at(arch(Math.min(1.5, w * 0.3), Math.min(2.4, h * 0.55)), (rng() - 0.5) * (w - 2) * 0.5, 0);
  for (let i = 0, n = Math.floor(rng() * 3); i < n; i++) {
    const r = 0.25 + rng() * 0.25;
    at(new THREE.CircleGeometry(r, 10), (rng() - 0.5) * (w - 1.2), Math.min(h - 0.6, 2.6 + rng() * Math.max(0.1, h - 3.4)));
  }
}

/**
 * A rounded house of warm stone standing at (x, y, z): kind 'drum' (a round drum under a dome), 'vault' (a
 * block under a barrel roof, its arch to the front), 'block' (a block with a low dome on its roof). w its width
 * (the drum's diameter), d its depth, h the wall's height. Its walls collide as drawn.
 */
export function roundHouse(kit, M, rng, { x, y, z, w = 6, d = w, h = 4, yaw = 0, kind = 'drum', lit = 0.45, awning = 0.3, mat = null }) {
  const stone = mat ?? M.stone[Math.floor(rng() * M.stone.length)];
  const solid = { solid: true, shadow: true };
  if (kind === 'drum') {
    // a pod: one smooth lathe, its wall swelling a little, rounding into its dome (the sheets' beehive houses)
    const r = w / 2, k = 0.55 + rng() * 0.35, wall = h * 0.85, prof = [[r * 0.98, 0], [r * 1.04, wall * 0.45], [r, wall]];
    for (let i = 1; i <= 6; i++) { const t = (i / 6) * Math.PI / 2; prof.push([Math.max(0.02, r * Math.cos(t)), wall + r * k * Math.sin(t)]); }
    kit.add(stone, put(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 18), x, y, z, yaw), solid);
    if (rng() < 0.4) kit.add(stone, put(new THREE.CylinderGeometry(r * 0.12, r * 0.15, r * 0.5, 8), x + (rng() - 0.5) * r * 0.6, y + wall + r * k * 0.8, z, yaw), solid);   // a chimney
    openings(kit, M, rng, { x, y, z, yaw, fz: r * 0.98, w: w * 0.75, h: wall, lit });
    h = wall + r * k * 0.6;
  } else if (kind === 'vault') {
    const r = w / 2;
    kit.add(stone, put(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, yaw), solid);
    kit.add(stone, put(new THREE.CylinderGeometry(r, r, d, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.75, 1), x, y + h, z, yaw), solid);
    openings(kit, M, rng, { x, y, z, yaw, fz: d / 2, w, h: h + r * 0.6, lit });
  } else {
    // a block with rounded corners under a low pillow of a roof
    const cr = Math.min(w, d) * 0.3, sh = new THREE.Shape(), hw = w / 2 - cr, hd = d / 2 - cr;
    sh.moveTo(-hw, -d / 2); sh.lineTo(hw, -d / 2); sh.absarc(hw, -hd, cr, -Math.PI / 2, 0, false); sh.lineTo(w / 2, hd); sh.absarc(hw, hd, cr, 0, Math.PI / 2, false);
    sh.lineTo(-hw, d / 2); sh.absarc(-hw, hd, cr, Math.PI / 2, Math.PI, false); sh.lineTo(-w / 2, -hd); sh.absarc(-hw, -hd, cr, Math.PI, Math.PI * 1.5, false);
    const body = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
    for (const a of Object.keys(body.attributes)) if (a !== 'position' && a !== 'normal') body.deleteAttribute(a);
    kit.add(stone, put(body, x, y, z, yaw), solid);
    kit.add(stone, put(new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, Math.PI / 2).scale(w * 0.5, Math.min(w, d) * (0.18 + rng() * 0.2), d * 0.5), x, y + h - 0.05, z, yaw), solid);
    openings(kit, M, rng, { x, y, z, yaw, fz: d / 2, w, h, lit });
  }
  const fz = kind === 'drum' ? w / 2 : d / 2, c = Math.cos(yaw), s = Math.sin(yaw);
  if (rng() < awning) {   // a striped awning slanted out over the door
    const aw = Math.min(w * 0.7, 4.5), a = M.awning[Math.floor(rng() * M.awning.length)], ay = y + Math.min(h - 0.3, 2.8);
    kit.add(a, put(new THREE.BoxGeometry(aw, 0.07, 1.6).rotateX(0.32), x + s * (fz + 0.7), ay, z + c * (fz + 0.7), yaw), NS);
    for (const e of [-1, 1]) kit.add(M.iron, put(new THREE.CylinderGeometry(0.03, 0.03, ay - y, 4), x + c * e * aw * 0.45 + s * (fz + 1.4), y + (ay - y) / 2 - 0.25, z - s * e * aw * 0.45 + c * (fz + 1.4), yaw), NS);
  }
  if (rng() < 0.45) pottedPlant(kit, M, rng, x + c * (rng() - 0.5) * w * 0.8 + s * (fz + 0.6), y, z - s * (rng() - 0.5) * w * 0.8 + c * (fz + 0.6), 0.7 + rng() * 0.5);
  return { top: y + h, fz };
}

/** A pot of plants: a terracotta pot and a crown of leaf masses on it (drawn only). */
export function pottedPlant(kit, M, rng, x, y, z, s = 1) {
  kit.add(M.pot, new THREE.CylinderGeometry(0.32 * s, 0.24 * s, 0.5 * s, 8).translate(x, y + 0.25 * s, z), NS);
  kit.add(M.leaf[Math.floor(rng() * M.leaf.length)], leafCrown(Math.floor(rng() * 1e4), { lobes: 4, detail: 0 }).scale(0.45 * s, 0.6 * s, 0.45 * s).translate(x, y + 0.85 * s, z), NS);
}

/** An amber lamp: a lantern on a bracket off a wall (wall: the face's outward direction yaw) or on a post; its light pool (kit.light). */
export function lamp(kit, M, x, y, z, { post = false, yaw = 0, r = 9 } = {}) {
  if (post) {
    kit.add(M.iron, new THREE.CylinderGeometry(0.06, 0.08, y, 5).translate(x, y / 2, z), NS);
  } else {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    kit.add(M.iron, put(new THREE.BoxGeometry(0.06, 0.06, 0.7), x - s * 0.35, y + 0.35, z - c * 0.35, yaw), NS);
  }
  kit.add(M.iron, new THREE.CylinderGeometry(0.16, 0.22, 0.12, 6).translate(x, y + 0.36, z), NS);
  kit.add(M.lamp, new THREE.CylinderGeometry(0.2, 0.17, 0.5, 8).translate(x, y + 0.05, z), NS);
  kit.light(x, y, z, r);
}

/** Copper pipes along a path (points [x, y, z]), corners rounded, a collar every few metres; r the pipe's radius; n pipes side by side. */
export function copperPipe(kit, M, pts, { r = 0.3, n = 1, gap = 2.4, side = [1, 0, 0], solid = false } = {}) {
  const how = solid ? { solid: true, shadow: true } : NS;   // (solid: up a wall you climb, so the climber holds the pipe, not the wall behind it)
  const P = pts.map((p) => new THREE.Vector3(...p)), off = new THREE.Vector3(...side).normalize();
  for (let k = 0; k < n; k++) {
    const o = off.clone().multiplyScalar((k - (n - 1) / 2) * r * gap);
    const Q = P.map((p) => p.clone().add(o));
    // (rounded corners: a Catmull-Rom through the points with extra knots near each corner)
    const pts2 = [];
    for (let i = 0; i < Q.length; i++) {
      if (i > 0 && i < Q.length - 1) {
        const a = Q[i].clone().lerp(Q[i - 1], Math.min(0.5, (r * 4) / Q[i].distanceTo(Q[i - 1])));
        const b = Q[i].clone().lerp(Q[i + 1], Math.min(0.5, (r * 4) / Q[i].distanceTo(Q[i + 1])));
        pts2.push(a, Q[i].clone().lerp(a, 0.3).lerp(b, 0.35), b);
      } else pts2.push(Q[i]);
    }
    const cr = new THREE.CatmullRomCurve3(pts2, false, 'centripetal');
    const L = cr.getLength();
    kit.add(M.copper, new THREE.TubeGeometry(cr, Math.max(8, Math.ceil(L / 1.5)), r, 7, false), how);
    for (let s = gap * 1.3; s < L - 0.5; s += 3.2 + (k % 2)) {
      const t = s / L, p = cr.getPointAt(t), d = cr.getTangentAt(t);
      const col = new THREE.CylinderGeometry(r * 1.3, r * 1.3, r * 0.8, 7);
      col.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)).translate(p.x, p.y, p.z);
      kit.add(M.copper, col, how);
    }
  }
}

// ------------------------------------------------------------------ streets

/**
 * A terrace carved into the rock: its paving x0..x1 at height y, from z1 (the front edge) back to z0, its
 * retaining wall down to `below` under its front, a parapet along the front edge (gaps: [[x0, x1]…] left
 * open for stairs and bridges). Solid as drawn.
 */
export function terrace(kit, M, { x0, x1, z0, z1, y, below = y - 6, parapet = 0.95, gaps = [], wall = true }) {
  const w = x1 - x0, cx = (x0 + x1) / 2, solid = { solid: true, shadow: true };
  // the paving, and under it the terrace's whole block of stone down to `below` (its front the retaining wall)
  kit.add(M.paving, new THREE.BoxGeometry(w, 0.6, z1 - z0).translate(cx, y - 0.3, (z0 + z1) / 2), solid);
  if (wall && y - 0.6 > below) kit.add(M.wall, new THREE.BoxGeometry(w, y - 0.6 - below, z1 - z0).translate(cx, (y - 0.6 + below) / 2, (z0 + z1) / 2), solid);
  if (parapet > 0) {
    const cuts = [[x0, x0], ...gaps.slice().sort((a, b) => a[0] - b[0]), [x1, x1]];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i][1], b = cuts[i + 1][0];
      if (b - a > 0.5) kit.add(M.wall, new THREE.BoxGeometry(b - a, parapet, 0.5).translate((a + b) / 2, y + parapet / 2, z1 - 0.25), solid);
    }
  }
}

/** A straight stair from (x, y0, z0) climbing to y1 toward -z (before yaw), w wide; steps of `rise` m. Solid as drawn. */
export function stair(kit, M, { x, z, y0, y1, w = 3, yaw = 0, rise = 0.3, run = 0.42, side = true }) {
  const n = Math.max(1, Math.round((y1 - y0) / rise)), dr = (y1 - y0) / n, solid = { solid: true, shadow: true };
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const f = -(i + 0.5) * run, top = y0 + (i + 1) * dr;
    kit.add(M.step, put(new THREE.BoxGeometry(w, top - y0 + 0.05, run).translate(0, (top - y0) / 2, 0), x + s * f, y0 - 0.05, z + c * f, yaw), solid);
  }
  if (side) for (const e of [-1, 1]) {   // the low walls each side
    const L = n * run, H = y1 - y0;
    const g = new THREE.BoxGeometry(0.4, 0.9, Math.hypot(L, H)).rotateX(Math.atan2(H, L)).translate(e * (w / 2 + 0.2), H / 2 + 0.55, -L / 2);
    kit.add(M.wall, put(g, x, y0, z, yaw), { solid: false, shadow: true });
  }
  return { top: [x - s * n * run, y1, z - c * n * run] };
}

/**
 * A stone bridge from a to b ([x, y, z], its deck's ends), w wide: a deck, parapets, and under it an arch (rise:
 * how high the arch's opening stands under the deck, m; 0 a flat slab). Solid as drawn.
 */
export function archBridge(kit, M, a, b, { w = 3.2, thick = 1.2, rise = 0, wall = 0.9 } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(), yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(d.y / L);
  const c = A.clone().add(B).multiplyScalar(0.5), solid = { solid: true, shadow: true };
  kit.add(M.paving, put(new THREE.BoxGeometry(w, thick, L), c.x, c.y - thick / 2, c.z, yaw, 1, pitch, 0), solid);
  for (const e of [-1, 1]) kit.add(M.wall, put(new THREE.BoxGeometry(0.45, wall, L).translate(e * (w / 2 - 0.22), thick / 2 + wall / 2, 0), c.x, c.y - thick / 2, c.z, yaw, 1, pitch, 0), solid);
  if (rise > 0) {
    // the spandrel: a wall under the deck, `rise` deep, pierced by a round-headed opening (its crown a little
    // under the deck); along the bridge in the shape's x, across it its extrusion
    const sh = new THREE.Shape(), half = L / 2, R = Math.min(half * 0.8, rise * 0.8), foot = -rise, crown = -0.6;
    sh.moveTo(-half, 0); sh.lineTo(-half, foot); sh.lineTo(-R, foot); sh.lineTo(-R, crown - R); sh.absarc(0, crown - R, R, Math.PI, 0, true);
    sh.lineTo(R, foot); sh.lineTo(half, foot); sh.lineTo(half, 0); sh.lineTo(-half, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w * 0.9, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -w * 0.45).rotateY(-Math.PI / 2);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    kit.add(M.wall, put(g, c.x, c.y - thick, c.z, yaw, 1, pitch, 0), solid);
  }
}

/** A resident: legs, a long coat, shoulders, a head, a hat now and then, and (basket) a basket on the arm or the head. Drawn only. */
export function resident(kit, M, rng, x, y, z, { h = 1.65, yaw = rng() * TAU, basket = rng() < 0.35 } = {}) {
  const coat = M.people[Math.floor(rng() * M.people.length)], c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (m, g, f, s2, yy) => kit.add(m, put(g, x + s * f + c * s2, y + yy, z + c * f - s * s2, yaw), NS);
  const legs = M.people[(M.people.indexOf(coat) + 3) % M.people.length], stride = (rng() - 0.5) * 0.3;
  for (const e of [-1, 1]) at(legs, new THREE.CylinderGeometry(0.06 * h, 0.05 * h, h * 0.42, 5), e * stride, e * 0.07 * h, h * 0.21);
  at(coat, new THREE.CylinderGeometry(0.12 * h, 0.21 * h, h * 0.56, 8), 0, 0, h * 0.58);
  at(coat, new THREE.SphereGeometry(0.14 * h, 8, 5).scale(1.2, 0.6, 0.85), 0, 0, h * 0.82);
  at(M.skin, new THREE.SphereGeometry(0.075 * h, 8, 6), 0, 0, h * 0.92);
  if (rng() < 0.4) { const hat = M.people[Math.floor(rng() * M.people.length)]; at(hat, new THREE.CylinderGeometry(0.15 * h, 0.15 * h, 0.012 * h, 10), 0, 0, h * 0.975); at(hat, new THREE.CylinderGeometry(0.055 * h, 0.07 * h, 0.08 * h, 8), 0, 0, h * 1.01); }
  if (basket) {
    if (rng() < 0.5) at(M.basket, new THREE.CylinderGeometry(0.17 * h, 0.12 * h, 0.12 * h, 9), 0, 0, h * 1.04);   // on the head
    else at(M.basket, new THREE.CylinderGeometry(0.11 * h, 0.08 * h, 0.12 * h, 8), 0.06 * h, 0.22 * h, h * 0.5);   // on the arm
  }
}

/** The traveller seen from behind, his pack glowing in its fluid's colours (the sheets' small figure for scale). */
export function travellerFigure(kit, x, y, z, { yaw = 0, s = 1 } = {}) {
  const g = new THREE.Group();
  const suit = kit.mat({ color: '#3f5a66', flat: true, figure: true });
  const pack = kit.mat({ color: '#7fe0c8', glow: 0.9, flat: true, spot: 0 });
  const pack2 = kit.mat({ color: '#f29a7a', glow: 0.9, flat: true, spot: 0 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.25, 10).translate(0, 0.65, 0), suit));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8).translate(0, 1.45, 0), suit));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 4, 10).translate(0, 1.05, 0.26), pack));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.08, 4, 10).translate(0, 0.86, 0.26), pack2));
  g.position.set(x, y, z); g.rotation.y = yaw; g.scale.setScalar(s);
  g.traverse((o) => { o.userData.noCollide = true; });
  kit.group.add(g);
  kit.light?.(x, y + 1, z + 0.4, 3);
  return g;
}

// ------------------------------------------------------------------ a frame, a quarter

/**
 * The kit seen through a frame: what is added to it is moved to (x, y, z) and turned by yaw first (geometry, lights,
 * meshes), so a quarter can be built in its own frame (its streets along x, climbing toward -z) and set anywhere.
 */
export function framed(kit, x, y, z, yaw = 0) {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z), c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    get group() { return kit.group; },
    mat: (o) => kit.mat(o),
    add: (mat, geo, o) => kit.add(mat, geo.applyMatrix4(m), o),
    mesh: (geo, mat, o) => kit.mesh(geo.applyMatrix4(m), mat, o),
    light: (lx, ly, lz, r) => kit.light(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, r),
    mover: (fn) => kit.mover(fn),
    matrix: m,
  };
}

/**
 * A quarter of the city on the cavern's back wall, in its own frame: n terraces along x (x0 .. x1, each `shrink` m
 * narrower at both ends than the one under it), the first's front edge at z = z1 and y = y0, each one `rise` m higher
 * and `step` m further back (-z). Every terrace is a solid block of stone carrying a row of rounded houses against the
 * riser behind it and now and then a low one or a pot at its front, a street between; stairs climb along the riser
 * (toward -x) to the terrace over it, through a gap in its parapet; lamps on the house fronts, copper pipes up the
 * risers, residents in the streets (people: a share per metre). Returns the streets ([{ x0, x1, z0, z1, y }]: where
 * people walk) and the stairs ([{ x0, x1, z, y0, y1 }]: foot to top).
 */
export function quarter(kit, M, rng, { x0, x1, z1 = 0, y0 = 0, n = 5, rise = 6, step = 9, shrink = 4, street = 4.5, lit = 0.35, people = 0.08, lamps = 0.5, pipes = 0.25,
  kinds = ['drum', 'vault', 'block', 'drum', 'block'], h = [rise * 0.75, rise * 1.3], awning = 0.35, stairEvery = 38, base = y0 - 3, front0 = true }) {
  const streets = [], stairs = [], RISE = 0.3, RUN = 0.36, SW = 2.4, L = Math.round(rise / RISE) * RUN;
  // the stairs first: on terrace i, along its back riser, foot at sx, top at sx - L (a gap in terrace i+1's parapet there)
  const ups = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + i * shrink, b = x1 - i * shrink, a2 = x0 + (i + 1) * shrink, b2 = x1 - (i + 1) * shrink, list = [];
    if (i < n - 1 && b2 - a2 >= 8) for (let sx = Math.max(a, a2) + L + 4 + rng() * 8; sx < Math.min(b, b2) - 4; sx += stairEvery * (0.7 + rng() * 0.6)) list.push(sx);
    ups.push(list);
  }
  for (let i = 0; i < n; i++) {
    const a = x0 + i * shrink, b = x1 - i * shrink, front = z1 - i * step, back = front - step, y = y0 + i * rise;
    if (b - a < 8) break;
    const below = i === 0 ? base : y - rise;
    const gaps = i > 0 ? ups[i - 1].map((sx) => [sx - L - 0.4, sx - L + 2.4]) : [];
    terrace(kit, M, { x0: a, x1: b, z0: back, z1: front, y, below, parapet: i === 0 && !front0 ? 0 : 0.95, wall: i > 0 || front0, gaps });
    streets.push({ x0: a, x1: b, z0: back, z1: front, y });
    const busy = (x0b, x1b) => ups[i].some((sx) => x1b > sx - L - 1.5 && x0b < sx + 1.5);   // (this terrace's stairs)
    // the houses against the riser behind (the next terrace's wall), clear of the stairs
    for (let x = a + 0.8; x < b - 3;) {
      const kind = kinds[Math.floor(rng() * kinds.length)], w = 3.5 + rng() * 3.5, d = kind === 'drum' ? w : Math.min(step - street, 3.5 + rng() * 3);
      if (!busy(x, x + w) && rng() < 0.92) {
        const hh = h[0] + rng() * (h[1] - h[0]);
        const r = roundHouse(kit, M, rng, { x: x + w / 2, y, z: back + d / 2 + 0.3, w, d, h: hh, kind, lit, awning });
        if (rng() < lamps) lamp(kit, M, x + w * (0.2 + rng() * 0.6), y + 2.6, back + 0.3 + (kind === 'drum' ? w / 2 : d) + 0.55);
        if (rng() < 0.2 && kind === 'block') roundHouse(kit, M, rng, { x: x + w / 2 + (rng() - 0.5) * 1.2, y: r.top, z: back + d / 2, w: w * 0.6, d: d * 0.6, h: 2.5 + rng() * 1.5, kind: 'drum', lit, awning: 0 });
      }
      x += w + 0.4 + rng() * 1.2;
    }
    // at the front: now and then a low house or a pot of plants, the street behind them
    for (let x = a + 4; x < b - 6; x += 9 + rng() * 14) {
      if (busy(x - 3, x + 3) || gaps.some(([g0, g1]) => x + 3 > g0 && x - 3 < g1)) continue;
      if (rng() < 0.3) {
        const w = 3 + rng() * 2.5;
        roundHouse(kit, M, rng, { x, y, z: front - 1.2 - w / 2, w, d: w, h: 2.4 + rng(), kind: rng() < 0.6 ? 'drum' : 'block', lit, awning: 0.6, yaw: Math.PI });
      } else if (rng() < 0.6) pottedPlant(kit, M, rng, x, y, front - 0.9, 0.8 + rng() * 0.6);
    }
    for (const sx of ups[i]) {
      stair(kit, M, { x: sx, z: back + SW / 2 + 0.05, y0: y, y1: y + rise, w: SW, rise: RISE, run: RUN, yaw: Math.PI / 2, side: false });
      stairs.push({ x0: sx, x1: sx - L, z: back + SW / 2 + 0.05, y0: y, y1: y + rise });
    }
    // copper pipes up the riser under this terrace, turning into its parapet
    if (i > 0) for (let px = a + 3; px < b - 3; px += 6 + rng() * 10) if (rng() < pipes && !gaps.some(([g0, g1]) => px > g0 - 1 && px < g1 + 1)) {
      copperPipe(kit, M, [[px, y - rise - 0.3, front + 0.45], [px, y - 0.9, front + 0.45], [px, y - 0.5, front - 0.3]], { r: 0.18 + rng() * 0.12, n: rng() < 0.5 ? 2 : 1, gap: 2.6, solid: true });
    }
    for (let k = 0, m2 = Math.round((b - a) * people); k < m2; k++) resident(kit, M, rng, a + 2 + rng() * (b - a - 4), y, front - 1.2 - rng() * (street - 1), { yaw: rng() * 6.3 });
  }
  return { streets, stairs };
}
