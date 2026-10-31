// Orthographic splats of a prepared flyer asset (tripo-lod.glb, the game's frame) in its vertex colours, each part's
// triangles tinted by --parts, the landmarks marked: front (looking along −z at its face), side (from its right), top.
// A working view for checking the cuts and the landmarks by eye (never changelog media).
//
//   node splat.mjs <tripo-lod.glb> <landmarks.json> <out-prefix> [--parts]
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const [IN, LM, OUT] = process.argv.slice(2), PARTS = process.argv.includes('--parts');
const b = readFileSync(IN), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const p = json.meshes[0].primitives[0], P = acc(p.attributes.POSITION), C = acc(p.attributes.COLOR_0), I = acc(p.indices);
const L = JSON.parse(readFileSync(LM, 'utf8')), parts = json.meshes[0].extras.parts ?? L.parts ?? {};
const TINT = [[255, 60, 60], [60, 160, 255], [60, 200, 90], [240, 200, 40], [200, 80, 220], [40, 220, 220], [255, 140, 0], [140, 140, 140], [120, 60, 20], [0, 0, 160]];
const triPart = new Int16Array(I.length / 3).fill(-1);
Object.values(parts).forEach(([f, n], k) => { for (let t = f; t < f + n; t++) triPart[t] = k; });
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < P.length / 3; v++) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], P[v * 3 + i]); hi[i] = Math.max(hi[i], P[v * 3 + i]); }
const half = Math.max(...hi.map((h, i) => h - lo[i])) * 0.55, mid = hi.map((h, i) => (h + lo[i]) / 2);
const S = 900;
// views: [horizontal axis, its sign, vertical axis, depth axis, depth sign (nearer = larger)]
const views = { front: [0, -1, 1, 2, 1], side: [2, 1, 1, 0, -1], top: [0, -1, 2, 1, 1] };
const marks = [];
const walk = (o) => { if (Array.isArray(o) && o.length === 3 && o.every((x) => typeof x === 'number')) marks.push(o); else if (o && typeof o === 'object') for (const v of Object.values(o)) walk(v); };
walk({ eyes: L.eyes, arms: L.arms, lanterns: L.lanterns, wings: L.wings, head: L.head, tail: L.tail, antennae: L.antennae, body: L.body, marks: L.marks });
for (const [name, [ax, sx, ay, ad, sd]] of Object.entries(views)) {
  const px = Buffer.alloc(S * S * 3, 255), depth = new Float32Array(S * S).fill(-Infinity);
  const toPx = (q) => [Math.round(((sx * (q[ax] - mid[ax]) + half) / (2 * half)) * S), Math.round(((half - (q[ay] - mid[ay]) * (name === 'top' ? -1 : 1)) / (2 * half)) * S)];
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) { const x = (i / S) * 2 * half - half, y = half - (j / S) * 2 * half; if (Math.abs(x * 4 - Math.round(x * 4)) < 0.01 || Math.abs(y * 4 - Math.round(y * 4)) < 0.01) { const k = (j * S + i) * 3; px[k] = px[k + 1] = px[k + 2] = 220; } }
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) {
    const v = I[t * 3 + k], q = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], D = sd * q[ad];
    let col = [C[v * 4], C[v * 4 + 1], C[v * 4 + 2]];
    if (PARTS && triPart[t] >= 0) { const tn = TINT[triPart[t] % TINT.length]; col = col.map((c, i) => Math.round(c * 0.35 + tn[i] * 0.65)); }
    const [ci, cj] = toPx(q);
    for (let a = -2; a <= 2; a++) for (let bb = -2; bb <= 2; bb++) { const i = ci + a, j = cj + bb; if (i < 0 || j < 0 || i >= S || j >= S) continue; const kk = j * S + i; if (D < depth[kk]) continue; depth[kk] = D; px[kk * 3] = col[0]; px[kk * 3 + 1] = col[1]; px[kk * 3 + 2] = col[2]; }
  }
  for (const m of marks) { const [ci, cj] = toPx(m); for (let a = -6; a <= 6; a++) for (const [i, j] of [[ci + a, cj], [ci, cj + a]]) { if (i < 0 || j < 0 || i >= S || j >= S) continue; const kk = (j * S + i) * 3; px[kk] = 255; px[kk + 1] = 0; px[kk + 2] = 255; } }
  await sharp(px, { raw: { width: S, height: S, channels: 3 } }).png().toFile(`${OUT}-${name}.png`);
}
console.log('parts', Object.keys(parts).join(', '), 'grid 0.25 m');
