// The default outfit made as calm as the tailored ones (issue #680; docs/systems/characters.md, "Outfits"): his own
// shirt, tee, trousers and scarf are B3's surface cut, lumpy with B3's sculpted folds, and painted with B3's soft fold
// shading, so the game's cel light broke them into many small blotches and creases. This relaxes those garments'
// normals across their welded surface (the light then falls in a few broad shapes; the silhouette and the geometry
// stay as they are) and flattens their texels in the atlas toward each garment's own median colour (B3's painted
// lines, much darker than the cloth, stay). The boots, the skin, the head and the hair are left alone. Run by build.sh
// after the model; once only (the GLB's asset.extras.calm says it was).
//
//   node scripts/blender/traveller/calm-default.mjs [data/characters/traveller-v2/traveller.glb]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const file = process.argv[2] ?? 'data/characters/traveller-v2/traveller.glb';
/** Per garment: smoothing passes of its surface, relax passes (each mixes a vert's normal with its neighbours'), how far its paint goes to its median. */
export const CALM = {
  Shirt: { smooth: 10, relax: 80, flatten: 0.95 },
  Tee: { smooth: 10, relax: 80, flatten: 0.95 },
  Trousers: { smooth: 10, relax: 80, flatten: 0.95 },
  Scarf: { smooth: 4, relax: 4, flatten: 0.85 },
};
const INK = 0;   // (a texel darker than this share of its garment's median lightness is a painted line: kept; none now)

const bytes = readFileSync(file);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
if (gltf.asset.extras?.calm) { console.log('calm already:', JSON.stringify(gltf.asset.extras.calm)); process.exit(0); }
const binStart = 20 + jsonLength + 8;
const bin = Buffer.from(bytes.subarray(binStart, binStart + bytes.readUInt32LE(20 + jsonLength)));
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function array(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  if (v.byteStride && v.byteStride !== SIZE[a.type] * Type.BYTES_PER_ELEMENT) throw new Error('interleaved accessor');
  return new Type(bin.buffer, bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), a.count * SIZE[a.type]);
}

const image = gltf.images[0], imageView = gltf.bufferViews[image.bufferView];
const jpeg = bin.subarray(imageView.byteOffset, imageView.byteOffset + imageView.byteLength);
const { data: px, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const label = new Uint8Array(W * H);   // 0: not a calmed garment's texel; else its index + 1
const report = {};
const names = Object.keys(CALM);

for (const mesh of gltf.meshes) {
  const k = names.indexOf(mesh.name);
  if (k < 0) continue;
  const prim = mesh.primitives[0];
  const P = array(prim.attributes.POSITION), N = array(prim.attributes.NORMAL), UV = array(prim.attributes.TEXCOORD_0);
  const I = array(prim.indices), n = P.length / 3;
  // ---- the normals relaxed over the welded surface (UV seams joined, so no seam shows in the light)
  const weld = new Map(), id = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(P[i * 3] * 2e4)},${Math.round(P[i * 3 + 1] * 2e4)},${Math.round(P[i * 3 + 2] * 2e4)}`;
    if (!weld.has(key)) weld.set(key, weld.size);
    id[i] = weld.get(key);
  }
  const m = weld.size, near = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = id[I[t + e]], b = id[I[t + (e + 1) % 3]];
    if (a !== b) { near[a].add(b); near[b].add(a); }
  }
  // ---- B3's small sculpted lumps eased out (Taubin: a shrink and an inflate a pass, so the volume and the silhouette
  // stay)
  const X = new Float32Array(m * 3), edgeUse = new Map();
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) X[id[i] * 3 + c] = P[i * 3 + c];
  for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = id[I[t + e]], b = id[I[t + (e + 1) % 3]], key = a < b ? a * m + b : b * m + a;
    edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
  }
  // (an open edge's verts smooth along their edge only: B3's ragged hems run straighter, and stay where they hang)
  const rim = new Map();
  for (const [key, uses] of edgeUse) if (uses === 1) {
    const a = Math.floor(key / m), b = key % m;
    if (!rim.has(a)) rim.set(a, new Set());
    if (!rim.has(b)) rim.set(b, new Set());
    rim.get(a).add(b); rim.get(b).add(a);
  }
  const step = (f) => {
    const next = Float32Array.from(X);
    for (let i = 0; i < m; i++) {
      const by = rim.get(i) ?? near[i];
      if (!by.size || (rim.has(i) && by.size !== 2)) continue;
      for (let c = 0; c < 3; c++) {
        let mean = 0;
        for (const j of by) mean += X[j * 3 + c];
        next[i * 3 + c] += f * (mean / by.size - X[i * 3 + c]);
      }
    }
    X.set(next);
  };
  for (let pass = 0; pass < CALM[mesh.name].smooth; pass++) { step(0.5); step(-0.53); }
  let shift = 0;
  for (let i = 0; i < n; i++) {
    shift = Math.max(shift, Math.hypot(X[id[i] * 3] - P[i * 3], X[id[i] * 3 + 1] - P[i * 3 + 1], X[id[i] * 3 + 2] - P[i * 3 + 2]));
    for (let c = 0; c < 3; c++) P[i * 3 + c] = X[id[i] * 3 + c];
  }
  const pa = gltf.accessors[prim.attributes.POSITION];
  pa.min = [0, 1, 2].map((c) => { let v = Infinity; for (let i = c; i < P.length; i += 3) v = Math.min(v, P[i]); return v; });
  pa.max = [0, 1, 2].map((c) => { let v = -Infinity; for (let i = c; i < P.length; i += 3) v = Math.max(v, P[i]); return v; });
  // ---- the normals: the eased surface's own (area-weighted), then relaxed over it (UV seams joined: no seam in the light)
  let s = new Float32Array(m * 3);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [id[I[t]], id[I[t + 1]], id[I[t + 2]]];
    const u = [0, 1, 2].map((k) => X[b * 3 + k] - X[a * 3 + k]), w = [0, 1, 2].map((k) => X[c * 3 + k] - X[a * 3 + k]);
    const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) s[v * 3 + k] += f[k];
  }
  // (a face wound against the GLB's own normals, as a turned-in lip can be, is set by the GLB's normals instead)
  const own = new Float32Array(m * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) own[id[i] * 3 + c] += N[i * 3 + c];
  for (let i = 0; i < m; i++) if (s[i * 3] * own[i * 3] + s[i * 3 + 1] * own[i * 3 + 1] + s[i * 3 + 2] * own[i * 3 + 2] <= 0) for (let c = 0; c < 3; c++) s[i * 3 + c] = own[i * 3 + c];
  const unit = (a) => { for (let i = 0; i < m; i++) { const l = Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]) || 1; for (let c = 0; c < 3; c++) a[i * 3 + c] /= l; } return a; };
  unit(s);
  const before = Float32Array.from(N);
  for (let pass = 0; pass < CALM[mesh.name].relax; pass++) {
    const next = Float32Array.from(s);
    for (let i = 0; i < m; i++) for (const j of near[i]) for (let c = 0; c < 3; c++) next[i * 3 + c] += s[j * 3 + c] / near[i].size;
    s = unit(next);
  }
  let turned = 0;
  for (let i = 0; i < n; i++) {
    turned += Math.acos(Math.min(1, before[i * 3] * s[id[i] * 3] + before[i * 3 + 1] * s[id[i] * 3 + 1] + before[i * 3 + 2] * s[id[i] * 3 + 2]));
    for (let c = 0; c < 3; c++) N[i * 3 + c] = s[id[i] * 3 + c];
  }
  // ---- its texels: the UV triangles rasterised (a texel's centre inside, or within a texel of an edge)
  for (let t = 0; t < I.length; t += 3) {
    const q = [0, 1, 2].map((e) => [UV[I[t + e] * 2] * W, UV[I[t + e] * 2 + 1] * H]);
    const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0])) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1])) - 1), y1 = Math.min(H - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])) + 1);
    const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
    if (!area) continue;
    const pad = 1.5;   // (texels, outside the edge: the seams' bleed)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = [x + 0.5, y + 0.5];
      let inside = true;
      for (let e = 0; e < 3 && inside; e++) {
        const a = q[e], b = q[(e + 1) % 3];
        const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1;
        const d = (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) / len * Math.sign(area);
        if (d < -pad) inside = false;
      }
      if (inside && !label[y * W + x]) label[y * W + x] = k + 1;
    }
  }
  report[mesh.name] = { normalsTurnedDeg: +(turned / n * 180 / Math.PI).toFixed(1), mostMovedMm: +(shift * 1000).toFixed(1) };
}

// ---- each garment's paint flattened toward its median (its lines kept)
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
names.forEach((name, k) => {
  const ch = [[], [], []];
  for (let i = 0; i < W * H; i += 1) if (label[i] === k + 1) for (let c = 0; c < 3; c++) ch[c].push(px[i * C + c]);
  if (!ch[0].length) return;
  const med = ch.map((a) => { const s = Uint8Array.from(a).sort(); return s[s.length >> 1]; });
  const L = lum(...med), f = CALM[name].flatten;
  let moved = 0, kept = 0, count = 0;
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== k + 1) continue;
    count++;
    const o = i * C, l = lum(px[o], px[o + 1], px[o + 2]);
    if (l < L * INK) { kept++; continue; }
    for (let c = 0; c < 3; c++) { const v = px[o + c] + (med[c] - px[o + c]) * f; moved += Math.abs(v - px[o + c]); px[o + c] = Math.round(v); }
  }
  Object.assign(report[name], { median: med, texels: count, linesKept: kept, meanChange: +(moved / count / 3).toFixed(1) });
});

const newJpeg = await sharp(px, { raw: { width: W, height: H, channels: C } }).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
// ---- the binary chunk again, with the new picture in its view's place
const views = gltf.bufferViews.map((v) => (v === imageView ? newJpeg : bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)));
let offset = 0;
const parts = [];
gltf.bufferViews.forEach((v, i) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
  v.byteOffset = offset; v.byteLength = views[i].length;
  parts.push(Buffer.from(views[i])); offset += views[i].length;
});
const tail = (4 - (offset % 4)) % 4;
if (tail) parts.push(Buffer.alloc(tail));
const newBin = Buffer.concat(parts);
gltf.buffers[0].byteLength = newBin.length;
gltf.asset.extras = { ...(gltf.asset.extras ?? {}), calm: { issue: 680, garments: Object.fromEntries(names.map((nm) => [nm, CALM[nm]])) } };
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
header.write('glTF', 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + newBin.length, 8);
jh.writeUInt32LE(json.length, 0); jh.write('JSON', 4); bh.writeUInt32LE(newBin.length, 0); bh.write('BIN\0', 4);
writeFileSync(file, Buffer.concat([header, jh, json, bh, newBin]));
console.log('CALM', JSON.stringify(report), `atlas ${jpeg.length} -> ${newJpeg.length} bytes`);
