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
const out = Buffer.alloc(W * H * 3);
let kept = 0;
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
  out[k * 3 + (major ? 0 : 1)] = Math.round(255 * ink);
  kept++;
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: false }).toFile(OUT);
console.log({ out: OUT, W, H, kept });
