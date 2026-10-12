// Bake authored surface strokes into the unchanged traveller UV atlas. A stroke is
// measured in the model's rest space, so UV islands get matching marks on either
// side of a seam. At runtime the same UVs follow skinning and the GPU cloth cage.
// node scripts/tripo/bake-cloth-ink.mjs
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
const file = readFileSync('public/characters/traveller-v1/model.glb');
const n = file.readUInt32LE(12), json = JSON.parse(file.toString('utf8', 20, 20 + n)), bin = file.subarray(28 + n);
const primitive = json.meshes[0].primitives[0];
function accessor(id) {
  const a = json.accessors[id], v = json.bufferViews[a.bufferView];
  const count = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], bytes = { 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const read = { 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: count }, (_, c) => bin[read]((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? count * bytes) + c * bytes)));
}
const positions = accessor(primitive.attributes.POSITION), uv = accessor(primitive.attributes.TEXCOORD_0), indices = accessor(primitive.indices).flat();
const paths = JSON.parse(readFileSync('data/characters/traveller-v1/ink/cloth-strokes.json'));
const segments = [];
for (const { points, width, name } of paths) for (let i = 1; i < points.length; i++) {
  const a = points[i - 1], b = points[i], delta = b.map((v, k) => v - a[k]), length2 = delta.reduce((s, v) => s + v * v, 0);
  if (length2 < 1e-12 || length2 > 0.03 ** 2) continue; // never bridge an occlusion
  const taper = Math.min(1, i / 4, (points.length - i) / 4);
  segments.push({ a, b, delta, length2, width: width * (0.35 + 0.65 * taper), name });
}
const size = 2048, pixels = new Uint8Array(size * size);
let triangles = 0;
for (let t = 0; t < indices.length; t += 3) {
  const ids = indices.slice(t, t + 3), p = ids.map(i => positions[i]);
  const min = [0, 1, 2].map(k => Math.min(...p.map(v => v[k])) - 0.004);
  const max = [0, 1, 2].map(k => Math.max(...p.map(v => v[k])) + 0.004);
  const near = segments.filter(s => [0, 1, 2].every(k => Math.max(s.a[k], s.b[k]) >= min[k] && Math.min(s.a[k], s.b[k]) <= max[k]));
  if (!near.length) continue;
  const u = ids.map(i => uv[i].map(v => v * size)), [a, b, c] = u;
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(det) < 1e-9) continue;
  const lo = [0, 1].map(k => Math.max(0, Math.floor(Math.min(...u.map(v => v[k])))));
  const hi = [0, 1].map(k => Math.min(size - 1, Math.ceil(Math.max(...u.map(v => v[k])))));
  // Rest-space area / UV area gives a conservative antialias radius in metres.
  const ab = p[1].map((v, k) => v - p[0][k]), ac = p[2].map((v, k) => v - p[0][k]);
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const aa = Math.max(0.0003, Math.min(0.003, Math.sqrt(Math.hypot(...cross) / Math.abs(det)) * 0.65));
  for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
    const w0 = ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / det;
    const w1 = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / det, w2 = 1 - w0 - w1;
    if (Math.min(w0, w1, w2) < -0.001) continue;
    const v = [0, 1, 2].map(k => w0 * p[0][k] + w1 * p[1][k] + w2 * p[2][k]);
    let ink = 0;
    for (const s of near) {
      const q = v.map((v, k) => v - s.a[k]);
      const f = Math.max(0, Math.min(1, q.reduce((sum, v, k) => sum + v * s.delta[k], 0) / s.length2));
      const d = Math.hypot(...q.map((v, k) => v - f * s.delta[k]));
      ink = Math.max(ink, Math.max(0, Math.min(1, (s.width + aa - d) / (2 * aa))));
    }
    pixels[y * size + x] = Math.max(pixels[y * size + x], Math.round(255 * ink));
  }
  triangles++;
}
await sharp(pixels, { raw: { width: size, height: size, channels: 1 } }).png().toFile('public/characters/traveller-v1/cloth-ink.png');
console.log(JSON.stringify({ size, paths: paths.length, segments: segments.length, triangles, inkTexels: pixels.filter(v => v > 32).length }));
