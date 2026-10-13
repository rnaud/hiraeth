// The approved front portrait's own facial pen lines, lifted once into head-v3's
// source-front space (issue #198): nose side line, wings and nostrils, mouth,
// lower lip, chin, philtrum, bridge ticks and the cheek's freckles. No pixel is redrawn: dark
// thin marks are kept, broad dark masses (hair, pupils, brows) and the eyes and
// brows the mesh already paints are left out, and so are the jaw contour and the
// hatching under it, which portrait-head.js draws from the geometry instead so
// they hold at every angle. R = the lines the face keeps longest (mouth, nose),
// G = the finer ones that fade first.
//   node scripts/tripo/bake-face-ink.mjs
import sharp from 'sharp';
import { PORTRAIT_FACE_INK } from '../../src/characters/portrait-head.js';

const SRC = 'data/characters/traveller-v1/head-v3/reference/front.png';
const OUT = 'public/characters/traveller-v1/head-v3/face-ink.png';
// prepare-portrait-head.mjs's projection of the reference crops onto source-front space
const S = 833, CX = 512, CROWN = 80, TOP = 0.979;
const { box: [X0, Y0, X1, Y1], size: [W, H] } = PORTRAIT_FACE_INK;
const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
// a reference pixel's luminance at a source-front point (bilinear)
function lum(x, y) {
  const px = CX + x * S, py = CROWN + (TOP - y) * S, x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
  const at = (i, j) => { const k = (Math.min(info.height - 1, Math.max(0, j)) * info.width + Math.min(info.width - 1, Math.max(0, i))) * 3; return data[k] * 0.3 + data[k + 1] * 0.55 + data[k + 2] * 0.15; };
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}
const point = (i, j) => [X0 + ((i + 0.5) / W) * (X1 - X0), Y1 - ((j + 0.5) / H) * (Y1 - Y0)];
const L = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) L[j * W + i] = lum(...point(i, j));
const dark = Uint8Array.from(L, (v) => (v < 80 ? 1 : 0));
// broad masses: what survives an erosion (the hair, pupils, brows), grown back past their edge
const radius = (r) => Math.round(r * W / ((X1 - X0) * S));
function morph(m, r, erode) {
  const o = new Uint8Array(m.length);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let v = erode ? 1 : 0;
    for (let dj = -r; dj <= r && v === (erode ? 1 : 0); dj++) for (let di = -r; di <= r; di++) {
      if (di * di + dj * dj > r * r) continue;
      const ii = i + di, jj = j + dj, q = ii < 0 || jj < 0 || ii >= W || jj >= H ? (erode ? 1 : 0) : m[jj * W + ii];
      if (erode ? !q : q) { v = erode ? 0 : 1; break; }
    }
    o[j * W + i] = v;
  }
  return o;
}
const broad = morph(morph(dark, radius(3), true), radius(6), false);
// the local mean (a box 2r + 1 texels wide), for the freckles: small dots a little darker than the
// skin (lit or shaded) round them, too light for the line threshold
function boxMean(r) {
  const o = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let s = 0, n = 0;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < W && jj < H) { s += L[jj * W + ii]; n++; } }
    o[j * W + i] = s / n;
  }
  return o;
}
const mean = boxMean(radius(5));
const FRECKLES = { x: [0.05, 0.2], y: [0.38, 0.52], contrast: [6, 20], size: 6 };   // size: a dot's widest, reference px
// freckle candidates, kept only as small round dots: the edge of a shadow shape is just as much darker
// than its surroundings, but long
const fleck = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i, [x, y] = point(i, j);
  if (Math.abs(x) > FRECKLES.x[0] && Math.abs(x) < FRECKLES.x[1] && y > FRECKLES.y[0] && y < FRECKLES.y[1])
    fleck[k] = Math.min(1, Math.max(0, (mean[k] - L[k] - FRECKLES.contrast[0]) / (FRECKLES.contrast[1] - FRECKLES.contrast[0])));
}
const seen = new Uint8Array(W * H), dot = new Uint8Array(W * H), most = radius(FRECKLES.size);
for (let k0 = 0; k0 < W * H; k0++) {
  if (!fleck[k0] || seen[k0]) continue;
  const blob = [k0]; seen[k0] = 1;
  for (let b = 0; b < blob.length; b++) { const k = blob[b], i = k % W, j = (k / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj, q = jj * W + ii; if (ii >= 0 && jj >= 0 && ii < W && jj < H && fleck[q] && !seen[q]) { seen[q] = 1; blob.push(q); } } }
  const is = blob.map((k) => k % W), js = blob.map((k) => (k / W) | 0);
  if (Math.max(...is) - Math.min(...is) <= most && Math.max(...js) - Math.min(...js) <= most) for (const k of blob) dot[k] = 1;
}
// the portrait's lines where the portrait has them (red and green planes), before they are moved onto the mesh
const P = [new Float32Array(W * H), new Float32Array(W * H)];
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i, [x, y] = point(i, j);
  // (the nostrils are small dark masses of their own: kept)
  if (broad[k] && !(y > 0.36 && y < 0.42 && Math.abs(x) < 0.08)) continue;
  const eye = [[-0.118, 0.522], [0.125, 0.522]].some(([ex, ey]) => Math.abs(x - ex) < 0.085 && Math.abs(y - ey) < 0.045);
  const brow = y > 0.555 && Math.abs(x) > 0.03;
  const ear = Math.abs(x) > 0.19 || y > 0.6 || (Math.abs(x) > 0.13 && y < 0.27);
  const underJaw = y < 0.17 || (y < 0.235 && (x < -0.025 || x > 0.07));
  if (eye || brow || ear || underJaw) continue;
  const cheek = Math.abs(x) > FRECKLES.x[0] && Math.abs(x) < FRECKLES.x[1] && y > FRECKLES.y[0] && y < FRECKLES.y[1];
  let ink = Math.min(1, Math.max(0, (110 - L[k]) / 60));
  // a freckle: as dark as a line at its middle, so it survives the shader's threshold as a dot
  if (cheek && dot[k]) ink = Math.max(ink, fleck[k]);
  if (!ink) continue;
  const major = (y > 0.29 && y < 0.325) || (y > 0.36 && y < 0.6 && Math.abs(x) < 0.07);
  // the nose's side line above its wings, a lighter stroke than the reference's darkest marks (it read heavy)
  if (major && y > 0.41) ink *= 0.72;
  // the nostrils, a little fuller than drawn: on the mesh they sit on the nose's underside, seen slantwise from in
  // front, and a slantwise sample of a thin mark thins it further (#266)
  if (major && Math.abs(Math.abs(x) - 0.03) < 0.017 && Math.abs(y - 0.383) < 0.009) ink = Math.min(1, ink * 1.6);
  P[major ? 0 : 1][k] = ink;
}

// Onto the mesh's own features (issue #266). The mesh Tripo made from this portrait does not match it: its nose
// is longer, wider and a little right of the centre line, its mouth lower and its lower lip fuller. Front-projected
// unmoved, the nostrils sat on the nose's front (5–6 mm above its base) and the mouth on the upper lip (about 3 mm
// above the lips' parting). So each stroke is moved onto the landmarks face-landmarks.mjs measures on the shipped
// mesh, by a thin-plate warp through pairs of points: the mouth's line column by column onto the valley between the
// lips, the wings' hooks onto the grooves round the wings, the nostrils above the nose's lower outline, the side line
// onto the nose's side, the lower lip's stroke onto its lower edge, the chin's mark into the hollow over the chin;
// the eyes, brows, cheeks, freckles and jaw stay where they are. The strokes keep the portrait's own hand.
const { faceLandmarks, headGeometry } = await import('./face-landmarks.mjs');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { readFile } = await import('node:fs/promises');
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const glb = await readFile('public/characters/traveller-v1/head-v3/model.glb'), jn = glb.readUInt32LE(12), json = JSON.parse(glb.toString('utf8', 20, 20 + jn)), bin = glb.subarray(28 + jn);
json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
delete json.images; delete json.textures; delete json.materials;
for (const m of json.meshes) for (const pr of m.primitives) delete pr.material;
const M = faceLandmarks(headGeometry((await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene));
// The portrait's own marks, measured on the planes above (source-front units): each wing's hook (its outer edge at
// its middle, its foot, its top), the nostrils' middle, the side line's ends, the lower lip's stroke, the chin's mark.
const PORTRAIT = {
  wing: { left: [-0.061, 0.39], right: [0.059, 0.388], footL: [-0.052, 0.376], footR: [0.05, 0.375], topL: [-0.055, 0.406], topR: [0.052, 0.401] },
  nostrils: [0.001, 0.383], side: [[-0.021, 0.511], [-0.021, 0.41]],
  lowerLip: [[-0.04, 0.275], [-0.001, 0.275], [0.039, 0.275]], chin: [0.023, 0.247], mouth: [-0.09, 0.094],
};
// the portrait's mouth line: the middle of its red marks, column by column
const mouthAt = (x) => { const i = Math.round(((x - X0) / (X1 - X0)) * W - 0.5); let s = 0, n = 0; for (let j = 0; j < H; j++) { const [, y] = point(i, j); if (y > 0.29 && y < 0.325 && P[0][j * W + i] > 0.5) { s += y; n++; } } return n ? s / n : null; };
const pairs = [];   // [mesh x, mesh y, portrait x, portrait y]
const same = (x, y) => pairs.push([x, y, x, y]);
// (what stays: the eyes and brows, the cheeks and their freckles, the bridge's ticks, the jaw, the forehead)
for (const [x, y] of [[-0.118, 0.522], [0.125, 0.522], [-0.12, 0.59], [0.12, 0.59], [0, 0.6], [-0.035, 0.475], [-0.17, 0.44], [0.17, 0.44],
  [-0.15, 0.4], [0.15, 0.38], [-0.16, 0.33], [0.16, 0.33], [-0.13, 0.26], [0.13, 0.26], [-0.1, 0.2], [0.1, 0.2], [0, 0.17], [-0.2, 0.3], [0.2, 0.3]]) same(x, y);
const W8 = M.wings, foot = W8.foot + 0.003;   // (the wings' feet on the nose's lower outline under them, the nostrils a little above)
pairs.push([W8.left, W8.y, ...PORTRAIT.wing.left], [W8.right, W8.y, ...PORTRAIT.wing.right],
  [W8.left + 0.006, foot, ...PORTRAIT.wing.footL], [W8.right - 0.007, foot, ...PORTRAIT.wing.footR],
  [W8.left + 0.004, W8.top + 0.006, ...PORTRAIT.wing.topL], [W8.right - 0.004, W8.top + 0.006, ...PORTRAIT.wing.topR],
  [M.ridge, foot + 0.006, ...PORTRAIT.nostrils]);
// the side line: its top at the bridge (by the nose's centre line, as far left of it as in the portrait), its foot by the left wing's top
pairs.push([M.ridge + PORTRAIT.side[0][0] - 0.004, PORTRAIT.side[0][1], ...PORTRAIT.side[0]], [M.ridge + PORTRAIT.side[1][0] - 0.004, W8.top + 0.01, ...PORTRAIT.side[1]]);
// the mouth, column by column: the portrait's corners on the mesh's, its line on the valley between the lips
const [c0, c1] = M.mouth.corners, [p0, p1] = PORTRAIT.mouth, creaseAt = (x) => {
  const c = M.mouth.crease, i = c.findIndex((q) => q[0] >= x);
  if (i <= 0) return c[0][1]; const a = c[i - 1], b = c[i], t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t;
};
for (let t = 0; t <= 1 + 1e-9; t += 1 / 12) {
  const px = p0 + (p1 - p0) * t, mx = c0 + (c1 - c0) * t, py = mouthAt(px);
  if (py != null) pairs.push([mx, creaseAt(mx), px, py]);
}
// the lower lip's stroke on its lower edge, the chin's mark in the hollow under it
const lipAt = (x) => { const l = M.lowerLip, i = Math.max(1, l.findIndex((q) => q[0] >= x)); const a = l[i - 1], b = l[Math.min(i, l.length - 1)]; return a[1] + (b[1] - a[1]) * Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0] || 1))); };
for (const [px, py] of PORTRAIT.lowerLip) { const mx = px + M.ridge; pairs.push([mx, lipAt(mx), px, py]); }
// (the chin's mark a little under the hollow, where the chin's ball begins: in the hollow itself it ran into the lip's stroke)
pairs.push([PORTRAIT.chin[0] + M.ridge, M.fold[1] - 0.007, ...PORTRAIT.chin]);
// a thin-plate spline through the pairs, mesh → portrait (each output texel looks up where its line was drawn)
const U = (r2) => (r2 > 1e-12 ? 0.5 * r2 * Math.log(r2) : 0);
function solve(A, b) {
  const n = b.length, m = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  return m.map((r, i) => r[n] / r[i]);
}
const n = pairs.length, A = [];
for (let i = 0; i < n + 3; i++) A.push(new Array(n + 3).fill(0));
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) A[i][j] = U((pairs[i][0] - pairs[j][0]) ** 2 + (pairs[i][1] - pairs[j][1]) ** 2);
  A[i][n] = A[n][i] = 1; A[i][n + 1] = A[n + 1][i] = pairs[i][0]; A[i][n + 2] = A[n + 2][i] = pairs[i][1];
}
const coef = [2, 3].map((c) => solve(A, [...pairs.map((p) => p[c]), 0, 0, 0]));
const warp = (x, y) => coef.map((w) => { let v = w[n] + w[n + 1] * x + w[n + 2] * y; for (let i = 0; i < n; i++) v += w[i] * U((x - pairs[i][0]) ** 2 + (y - pairs[i][1]) ** 2); return v; });
const sample = (plane, x, y) => {
  const u = ((x - X0) / (X1 - X0)) * W - 0.5, v = ((Y1 - y) / (Y1 - Y0)) * H - 0.5, i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : plane[j * W + i]);
  return (at(i0, j0) * (1 - fu) + at(i0 + 1, j0) * fu) * (1 - fv) + (at(i0, j0 + 1) * (1 - fu) + at(i0 + 1, j0 + 1) * fu) * fv;
};
const out = Buffer.alloc(W * H * 3);
let kept = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const [x, y] = point(i, j), k = j * W + i;
  // (only the middle of the face moves: the cheeks' freckles and everything past them are copied as they were)
  const [sx, sy] = Math.abs(x) < 0.14 && y > 0.19 && y < 0.53 ? warp(x, y) : [x, y];
  for (const c of [0, 1]) { const v = sample(P[c], sx, sy); if (v > 0.02) { out[k * 3 + c] = Math.round(255 * Math.min(1, v)); kept++; } }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: false }).toFile(OUT);
console.log({ out: OUT, W, H, kept, pairs: n, landmarks: { ridge: M.ridge, wings: M.wings, stomion: M.mouth.stomion, corners: M.mouth.corners, fold: M.fold } });
