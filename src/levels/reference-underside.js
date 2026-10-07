import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { CLEAN_SKY } from './reference-kit.js';
import {
  underMats, slab, lobesFor, boulder, podAt, deckAt, bannerAt, basketAt, lampAt, stoneStair, shrubs, grassTufts, cloudPuffs, puffGeo,
  traveller, resident, framed, town, stick, UNDER_LOOK,
} from './underside-kit.js';

// ---------------------------------------------------------------------------
// The Underside's reference pictures (references/The Underside/reference-1 … 4): an immense shelf of pale
// limestone jutting from a mountain far out over a sea of cloud, a town hung from its underside (round white
// houses like swallows' nests, timber decks and scaffolds slung on rods, lit windows), long rust-red banners
// falling from the decks toward the cloud, baskets let down on ropes; grass and shrubs along the shelf's top; the
// traveller with his great pale pack on a stair cut into a cliff in the foreground, in its shade. Each picture is
// one composition: one view each. One scene builder (undersideScene) does them all (reference-views.js describes
// the fields). Things are placed off the pictures' pixels (sheetAt, sheetPlane): a point drawn at pixel (px, py)
// that stands at a depth, or on a level, is put where the view's camera sees it there.
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Underside / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Underside/reference-${n}.jpeg`, import.meta.url).href });
export const UNDER_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`underside-${n}`, sheet(n)]));

/** The pictures' ink: the world's own look (underside-kit.js) and a clean sky. */
export const UNDER_VIEW_LOOK = { ...UNDER_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow (the blue-grey of the undersides), light, sun: read off the pictures */
const SKY = {
  gold: ['#4f88d0', '#e6ecee', '#7682b0', '#ffe8c8', '#ffd8a0'],
  pale: ['#6694d0', '#e2eaf0', '#8290bc', '#ffefd8', '#ffe2b8'],
  deep: ['#2f62b2', '#d6e2ee', '#6a78ac', '#ffe2bc', '#ffcc90'],
  dusk: ['#8296c0', '#f6c8a8', '#7c74a8', '#ffc8a4', '#ffa878'],
};

// ---------------------------------------------------------------- the pictures' pixels
const SW = 1456, SHH = 816, DEG = Math.PI / 180;
const camOf = (cam) => { const t = Math.tan((cam.fov * DEG) / 2); return { f: SHH / 2 / t, p: Math.atan((cam.horizon - 0.5) * 2 * t), e: cam.eye }; };
/** The point drawn at the picture's pixel (px, py), d m down the line of sight (a view looking down -z). */
export function sheetAt(cam, px, py, d) {
  const { f, p, e } = camOf(cam), u = (px - SW / 2) / f, v = (SHH / 2 - py) / f, t = d / (Math.cos(p) - v * Math.sin(p));
  return new THREE.Vector3(e[0] + t * u, e[1] + t * (Math.sin(p) + v * Math.cos(p)), e[2] - d);
}
/** Where the picture's pixel (px, py) meets the level y = g (above or below the eye), in the view's frame. */
export function sheetPlane(cam, px, py, g) {
  const { f, p, e } = camOf(cam), u = (px - SW / 2) / f, v = (SHH / 2 - py) / f, t = (g - e[1]) / (Math.sin(p) + v * Math.cos(p));
  return new THREE.Vector3(e[0] + t * u, g, e[2] - t * (Math.cos(p) - v * Math.sin(p)));
}
/** How many metres n of the picture's pixels span at depth d. */
export const sheetSpan = (cam, n, d) => (n / camOf(cam).f) * d;

const NC = { solid: false, shadow: false };
const SH = { solid: false, shadow: true };

/**
 * The great shelf: a slab of limestone from its root (R, a point of its top front edge, [x, z]) out to its tip
 * (P), its top at `top`, T thick, D deep behind its face (away from the eye), its root running on `root` m past R;
 * lobes under it, its sides cut in ledges (band, ledge) or fluted (flutes: many cracks), shrubs along its top's
 * front edge. Returns the face's frame for the town: { fk (framed kit), L (m along the face, root → tip), s (+1 or -1:
 * the frame's x along the face), yU (the underside's height) }.
 */
function shelfAt(kit, M, rng, o) {
  const R = new THREE.Vector3(o.R[0], 0, o.R[1]), P = new THREE.Vector3(o.P[0], 0, o.P[1]), u = P.clone().sub(R), L = u.length();
  u.normalize();
  // which side of the face line the eye is on: the face looks toward it
  const eye = new THREE.Vector3(o.eye[0], 0, o.eye[2]), toEye = eye.clone().sub(R), nA = new THREE.Vector3(-u.z, 0, u.x), side = Math.sign(toEye.dot(nA)) || 1;
  const nOut = nA.clone().multiplyScalar(side), back = o.root ?? 60, len = L + back, D = o.D ?? 120, T = o.T ?? 30;
  const mid = R.clone().addScaledVector(u, (L - back) / 2).addScaledVector(nOut, -D / 2);
  const lobes = o.lobes ?? lobesFor({ sx: len, sz: D, n: Math.round(len / 18), r: [8, 20], h: [3, T * 0.35], seed: o.seed ?? 1 });
  const g = slab({ sx: len, sy: T, sz: D, rTop: o.rTop ?? 4, rBot: o.rBot ?? T * 0.3, rSide: o.rSide ?? 10, band: o.band ?? T / 4, ledge: o.ledge ?? 1.6, cracks: o.cracks ?? 10, crack: o.crack ?? 1, lump: o.lump ?? 1.4, pillow: o.pillow ?? 3.5, lobes, pinch: -side, tip: o.tip ?? 0.45, tipLen: o.tipLen ?? D * 0.5, seed: o.seed ?? 1, seg: o.seg ?? 3 });
  const yaw = Math.atan2(-u.z, u.x);
  kit.add(M.rock, g.rotateY(yaw).translate(mid.x, o.top - T, mid.z), SH);
  // the frame along the face: x from the root toward the tip (s), z out toward the eye
  const fyaw = side > 0 ? yaw : yaw + Math.PI, s = side > 0 ? 1 : -1;
  const fk = framed(kit, R.x, 0, R.z, fyaw);
  // shrubs and grass along the top's front edge
  if (o.shrubs !== false) {
    // (in from the rounded edge, and short of the pinched tip: never in the air)
    const n = Math.round(L / 5);
    for (const gg of shrubs([0, o.top - 0.3, -7], [s * L * 0.72, o.top - 0.3, -7], { n, s: [0.8, 2.4], seed: (o.seed ?? 1) + 5, jitter: 3 })) fk.add(M.shrub[Math.floor(rng() * 2)], gg, NC);
  }
  return { fk, L, s, yU: o.top - T, top: o.top, T };
}

/** A cliff of the same rock (the eye's own, beside the stair): a tall slab at (x, z), w × h × d, its foot at y, turned by yaw. */
function cliff(kit, M, { x, y = -60, z, w = 30, h = 160, d = 40, yaw = 0, corner = null, side = 'left', seed = 1, band = 12, cracks = 4, lump = 1.5, mat = 'rock' }) {
  if (corner) {
    // (the corner between its face toward the eye (+z) and its side toward the middle of the frame, that side edge-on)
    const e = new THREE.Vector2(corner[0], corner[1]).normalize(), sx = side === 'left' ? 1 : -1;
    yaw = Math.atan(e.x / e.y);
    const c = Math.cos(yaw), sn = Math.sin(yaw), lx = (sx * w) / 2, lz = d / 2;
    x = corner[0] - (lx * c + lz * sn); z = corner[1] - (-lx * sn + lz * c);
  }
  const g = slab({ sx: w, sy: h, sz: d, rTop: 6, rBot: 4, rSide: Math.min(8, w / 3, d / 3), band, ledge: 0.8, cracks, crack: 1.2, lump, seed, seg: 5, flatTop: false, wobble: 1.5 });
  kit.add(M[mat], g.rotateY(yaw).translate(x, y, z), SH);
}

/** The sea of cloud far below: cauliflower puffs on a deck, out to the horizon in front of the eye. */
function cloudSea(kit, M, { y = -120, near = 50, far = 3600, n = 420, size = [24, 60], arc = 0.85, seed = 1, pink = false, flat = 1 }) {
  const mat = pink ? M.cloudPink : M.cloud, fine = puffGeo(3, seed), mid = puffGeo(3, seed + 1), lo = puffGeo(2, seed);
  for (const p of cloudPuffs({ y, near, far, n, size, seed, arc: [-arc, arc] })) {
    const g = (p.d < near * 2.5 ? fine : p.d < near * 8 ? mid : lo).clone();
    kit.add(mat, g.scale(p.s, p.s * p.sy * flat, p.s).translate(p.x, p.y, p.z), NC);
  }
  // a deck between the puffs hides the void's floor
  kit.add(mat, new THREE.CircleGeometry(4800, 48).rotateX(-Math.PI / 2).translate(0, y - 5, 0), NC);
}

/**
 * A picture's scene. o: { seed, shelf: {...shelfAt}, town: {...town()'s options, in the face's frame}, cliffs: [cliff…],
 * stair: { x, y0, y1, z, w, yaw, wall, base }, traveller: [x, y, z, yaw, pack], clouds: {...}, rocks: [[x, y, z, r, sy]…],
 * extra(kit, M, rng, face) }
 */
function undersideScene(kit, v, o) {
  const M = underMats(kit, { lamps: false }), rng = mulberry32(o.seed ?? 1);
  const face = o.shelf ? shelfAt(kit, M, rng, { eye: v.camera.eye, seed: o.seed, ...o.shelf }) : null;
  if (face && o.town) {
    const t = o.town, L = face.L, s = face.s;
    const fill = t.fill ? (x) => t.fill((s * x) / L) : () => 1;
    town(face.fk, M, rng, { x0: s > 0 ? (t.from ?? 0) * L : -(t.to ?? 1) * L, x1: s > 0 ? (t.to ?? 1) * L : -(t.from ?? 0) * L, yU: face.yU, faceTop: face.top, ...t, fill });
  }
  for (const c of o.cliffs ?? []) cliff(kit, M, c);
  // what shades the foreground from behind the eye (the mountain the stair is cut into): its shadow only is seen
  for (const c of o.shade ?? []) cliff(kit, M, { seed: 99, ...c });
  for (const [x, y, z, r, sy] of o.rocks ?? []) kit.add(M.rock, boulder(x + z, r, sy ?? 0.7).translate(x, y, z), SH);
  if (o.stair) {
    const S = o.stair, St = stoneStair({ y0: S.y0, y1: S.y1, w: S.w ?? 3.4, rise: S.rise ?? 0.22, run: S.run ?? 0.44, wall: S.wall ?? 1, base: S.base ?? S.y0 - 30, parapet: S.parapet ?? 1, seed: o.seed });
    const at = (g) => g.rotateY(S.yaw ?? 0).translate(S.x, 0, S.z);
    for (const g of St.step) kit.add(M.step, at(g), SH);
    for (const g of St.rock) kit.add(M.rock, at(g), SH);
    for (const g of St.wall) kit.add(M.step, at(g), SH);
  }
  if (o.clouds !== false) cloudSea(kit, M, { seed: o.seed, ...(o.clouds ?? {}) });
  if (o.traveller) { const [x, y, z, yaw, pack] = o.traveller; traveller(kit, M, x, y, z, { yaw, pack }); }
  o.extra?.(kit, M, rng, face);
}

/** Only the void far below: the view stands over the cloud. */
const VOID = { height: () => -600, material: { color: '#f4f0ea' }, rings: { r1: 600, rings: 20, seg: 32 } };
const view = (o) => ({ sky: SKY.gold, look: UNDER_VIEW_LOOK, fog: 0.5, ground: VOID, ...o });
const CAM = {
  1: { eye: [0, 0, 0], yaw: 0, fov: 50, horizon: 0.5 },
  2: { eye: [0, 0, 0], yaw: 0, fov: 50, horizon: 0.56 },
  3: { eye: [0, 0, 0], yaw: 0, fov: 50, horizon: 0.54 },
  4: { eye: [0, 0, 0], yaw: 0, fov: 50, horizon: 0.5 },
};
const xz = (p) => [p.x, p.z];

export const UNDER_VIEWS = [
  view({
    id: 'underside-1-stair', title: 'From the stair: the shelf\'s town over the cloud, its banners and baskets', sheet: 'underside-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[1],
    sun: { side: -130, el: 24 },
    build(kit, v) {
      const c = CAM[1], G = (px, py, g) => sheetPlane(c, px, py, g);
      undersideScene(kit, v, {
        seed: 81001,
        // the face runs from near on the right (its top off the frame, behind the great domes) to the tip far on the left
        shelf: { R: [35, -45], P: xz(G(250, 140, 46)), top: 46, T: 30, D: 230, root: 100, tip: 0.5, seed: 3 },
        town: { from: 0, to: 0.8, fill: (t) => 1 - t * 0.95, levels: [11, 5, -1, -7, -13], out: [5, 7, 8, 8, 9], under: [40, 26, 14, 8, 4], bannerDrop: [18, 45], banners: 20, baskets: 4, facePods: 10, underPods: 26 },
        cliffs: [{ corner: [-7.4, -12], side: 'left', w: 16, h: 230, d: 40, y: -120, seed: 11 }],
        stair: { x: 2, z: -7.5, y0: -6, y1: 0.5, w: 4, yaw: Math.PI / 2, wall: -1, base: -60 },
        shade: [{ x: -26, z: 22, w: 30, h: 75, d: 30, y: -48 }],
        traveller: [-4.3, -2.85, -7.2, -0.8, 'shell'],
        extra(k, M, rng, face) {
          // the great domes on the shelf's top over the near town, in a cluster
          // (standing on the face's ledges over the town and rising past the top, as the picture's)
          for (const [t, h, r, z, y] of [[0.1, 38, 14, 2, 12], [0.18, 30, 12, 4, 16], [0.25, 26, 10, 3, 19], [0.31, 20, 8, 2, 22], [0.04, 30, 13, -4, 28], [0.37, 14, 6, 1, 24]]) podAt(face.fk, M, face.s * t * face.L, y, z, { r, h, kind: t > 0.3 ? 'egg' : 'dome', seed: t * 99, windows: 7, lit: 0.45, solid: false, lights: false, squash: 0.85 });
        },
      });
    },
  }),
  view({
    id: 'underside-2-climb', title: 'Up the stair: the shelf\'s nose, the silo houses, the banners in the light', sheet: 'underside-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[2],
    sun: { side: -120, el: 32 }, sky: SKY.pale,
    build(kit, v) {
      const c = CAM[2], G = (px, py, g) => sheetPlane(c, px, py, g);
      undersideScene(kit, v, {
        seed: 81002,
        shelf: { R: xz(G(1150, 0, 50)), P: xz(G(125, 195, 50)), top: 50, T: 28, D: 220, root: 110, tip: 0.55, seed: 7 },
        town: { from: 0, to: 0.72, fill: (t) => 1 - t * 0.9, levels: [17, 11, 5, -1], out: [5, 7, 8, 8], under: [40, 24, 12, 5], bannerDrop: [20, 50], banners: 14, baskets: 2, facePods: 4, underPods: 20 },
        cliffs: [{ corner: [8.6, -11], side: 'right', w: 16, h: 240, d: 40, y: -120, seed: 21 }],
        stair: { x: 3.4, z: -6.9, y0: -4.1, y1: 0.5, w: 3, yaw: -Math.PI / 2 + 0.35, wall: 1, base: -60 },
        traveller: [3.6, -3.3, -7.3, -1.2, 'bag'],
        rocks: [[-150, -70, -250, 30, 1.6], [-120, -60, -230, 16, 1.2]],
        extra(k, M, rng, face) {
          // the silo houses along the face near its root, tall eggs with their cupolas
          for (const [t, h, r] of [[0.06, 30, 9], [0.13, 34, 10], [0.2, 26, 8], [0.27, 22, 7], [0.33, 18, 6]]) podAt(face.fk, M, face.s * t * face.L, face.yU + 4, r * 0.25, { r, h, kind: 'egg', seed: t * 77, windows: 6, lit: 0.4, solid: false, lights: false, squash: 0.8 });
          // hanging lamps on long cords from the underside toward the nose
          for (const t of [0.76, 0.83, 0.9]) { const p = face.fk.at(face.s * t * face.L, 0, -3); lampAt(k, M, p.x, face.yU - 12 - rng() * 6, p.z, face.yU, { s: 2.2, light: false }); }
          // the far rock's little tower
          podAt(k, M, -146, -24, -250, { r: 4, h: 12, kind: 'egg', seed: 5, windows: 3, solid: false, lights: false });
        },
      });
    },
  }),
  view({
    id: 'underside-3-nests', title: 'The nests under the shelf, the baskets on their long ropes, the cloud to the edge', sheet: 'underside-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[3],
    sun: { side: -135, el: 24 }, sky: SKY.deep,
    build(kit, v) {
      const c = CAM[3], G = (px, py, g) => sheetPlane(c, px, py, g);
      undersideScene(kit, v, {
        seed: 81003,
        // the face runs from the cliff on the left out to the tip on the right
        shelf: { R: xz(G(60, 45, 46)), P: xz(G(1250, 185, 46)), top: 46, T: 26, D: 200, root: 60, tip: 0.4, seed: 13 },
        town: { from: 0.05, to: 0.8, fill: (t) => Math.min(1, 1.35 - Math.abs(t - 0.42) * 1.7), levels: [15, 9, 3, -3], out: [5, 7, 9, 8], under: [40, 22, 10, 4], bannerDrop: [16, 40], banners: 12, baskets: 3, facePods: 12, underPods: 26 },
        cliffs: [{ corner: [-7, -10], side: 'left', w: 16, h: 240, d: 40, y: -140, seed: 31 }],
        stair: { x: 1.5, z: -7.2, y0: -6, y1: 0.5, w: 4.4, yaw: Math.PI / 2, wall: -1, base: -60 },
        shade: [{ x: -24, z: 24, w: 30, h: 75, d: 30, y: -48 }],
        traveller: [-4.2, -2.45, -7, -0.6, 'shell'],
        rocks: [[-1.7, -2.6, -4.6, 0.8, 0.9]],
        extra(k, M, rng, face) {
          // baskets on long ropes from the underside toward the tip
          for (const [t, drop] of [[0.8, 22], [0.84, 30], [0.87, 18], [0.9, 36], [0.93, 26]]) { const p = face.fk.at(face.s * t * face.L, 0, 2); basketAt(k, M, p.x, face.yU - drop, p.z, face.yU + 1, { r: 0.9, h: 1.1 }); }
        },
      });
    },
  }),
  view({
    id: 'underside-4-dusk', title: 'At dusk: the fluted face of the shelf, its town, the flat cloud to the horizon', sheet: 'underside-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[4],
    sun: { side: -125, el: 9 }, sky: SKY.dusk,
    build(kit, v) {
      const c = CAM[4], G = (px, py, g) => sheetPlane(c, px, py, g);
      undersideScene(kit, v, {
        seed: 81004,
        shelf: { R: xz(G(1300, 55, 50)), P: xz(G(165, 75, 50)), top: 50, T: 28, D: 200, root: 60, tip: 0.35, band: 30, cracks: 46, crack: 3, ledge: 0.4, pillow: 2, seed: 17 },
        town: { from: 0.05, to: 0.85, fill: (t) => 1 - t * 0.55, levels: [18, 11, 4, -3, -10], out: [5, 7, 8, 9, 8], under: [40, 26, 14, 8, 4], bannerDrop: [16, 40], banners: 14, baskets: 4, facePods: 6, underPods: 20 },
        cliffs: [{ corner: [6.4, -10], side: 'right', w: 16, h: 220, d: 40, y: -120, seed: 41 }],
        stair: { x: 1.8, z: -5, y0: -2.7, y1: 1.2, w: 2.6, yaw: -Math.PI / 2 + 0.6, wall: 1, base: -60 },
        shade: [{ x: -26, z: 18, w: 30, h: 56, d: 30, y: -50 }],
        traveller: [3.1, -2.1, -5.6, -1.4, 'shell'],
        clouds: { pink: true, size: [50, 130], n: 200, flat: 0.45 },
        extra(k, M, rng, face) {
          // the great white masses along the face near its root
          for (const [t, h, r, y] of [[0.02, 40, 14, -6], [0.1, 30, 11, 6], [0.2, 22, 9, 10], [0.62, 18, 7, 14], [0.7, 16, 6, 16]]) podAt(face.fk, M, face.s * t * face.L, y, r * 0.2, { r, h, kind: 'egg', seed: t * 55, windows: 5, lit: 0.5, solid: false, lights: false, squash: 0.75 });
        },
      });
    },
  }),
];
export { UNDER_SHEETS as SHEETS, UNDER_VIEWS as VIEWS };
