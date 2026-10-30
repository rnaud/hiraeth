// The Tripo grunt with its atlas dropped (issue #768): each triangle sampled once from the 2048² atlas (median-filtered,
// then the median of seven points inside the triangle), snapped to the procedural grunt's colour zones (skin, cloth,
// leather, iron, bone, ink, eye: src/enemies/plans/monster.js gruntModel, palette src/enemies/skins.js), cleaned up over
// the mesh (majority smoothing, small islands merged), the eyes made round round their pupils, and written as one
// primitive per zone sharing one set of vertex attributes; no texture, no UVs. The skeleton is scaled to metres (1.3 m
// tall) so the game's surface patterns (in bind space, src/materials.js vBind) print at the procedural grunt's scale.
// At run time arena-model.js gives each zone the procedural grunt's own material (its patterns, gloss, ink, the eyes'
// flash). Trial only: the game never loads this file.
//
// Usage (from the repository):
//   node references/enemy-archetypes/grunt/tripo-trial/flatten-tripo.mjs [in.glb] [out.glb] [--preview <folder>]
// Defaults: tripo-rigged.glb → tripo-flat.glb beside this script. --preview writes front/side/head renders (original
// sampled colour | zones) and the zone counts, for review.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2), flag = args.indexOf('--preview'), preview = flag >= 0 ? args.splice(flag, 2)[1] : null;
const IN = args[0] ?? here + 'tripo-rigged.glb', OUT = args[1] ?? here + 'tripo-flat.glb';

// ------------------------------------------------------------------ the zones
// The procedural grunt's materials, in draw order; the colours its desert palette's (skins.js grunt.desert).
export const ZONES = ['skin', 'cloth', 'leather', 'iron', 'bone', 'ink', 'eye'];
const PALETTE = { skin: '#d65a40', cloth: '#c6b071', leather: '#6b4630', iron: '#5e5852', bone: '#efe2c4', ink: '#1b1414', eye: '#f2c33c' };
// Seeds: the atlas's own colours for each zone (k-means of the per-triangle samples, read against where they sit on the
// body), so the snap follows what Tripo painted rather than the palette's exact values. `pale` is skin, a paler red: the
// snout and belly, tinted toward the palette's skin2 by vertex colour.
const SEEDS = {
  skin: ['#dd5138', '#e15039', '#dd4e36', '#e3533c', '#d34d36', '#c44731', '#af3924', '#da563a', '#a95536'],
  pale: ['#ce6f44', '#cd7446', '#e08a60'],
  cloth: ['#c4a856', '#bd9351', '#9f7d44', '#d6bd6a'],
  leather: ['#715d43', '#8a5434', '#5a4632'],
  iron: ['#817f73', '#6a6a66', '#9a988c'],
  bone: ['#efe2c4', '#e6d8b4', '#f6f0e0', '#d8ccb0'],
  ink: ['#0a0401', '#2a1a14'],
  eye: ['#f2c33c', '#f0d040', '#e8b020'],
};
const SKIN2 = '#e98a68';

// ------------------------------------------------------------------ the GLB
function readGlb(file) {
  const b = fs.readFileSync(file), n = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + n));
  const binLen = b.readUInt32LE(20 + n), bin = b.subarray(28 + n, 28 + n + binLen);
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const C = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const acc = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = T[a.componentType], k = C[a.type];
    if (v.byteStride && v.byteStride !== k * A.BYTES_PER_ELEMENT) throw Error('interleaved accessor ' + i);
    const off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * k * A.BYTES_PER_ELEMENT));
  };
  const view = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
  return { json, acc, view };
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const { json, acc, view } = readGlb(IN);
const prim = json.meshes[0].primitives[0];
if (json.meshes.length !== 1 || json.meshes[0].primitives.length !== 1) throw Error('expected one mesh, one primitive');
const P = acc(prim.attributes.POSITION), N = acc(prim.attributes.NORMAL), UV = acc(prim.attributes.TEXCOORD_0);
const JO = acc(prim.attributes.JOINTS_0), WE = acc(prim.attributes.WEIGHTS_0), I = acc(prim.indices);
const nV = P.length / 3, nT = I.length / 3;
const img = json.images[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index];
// (a 5 px median first: the baked hatching and noise are finer than any colour field we keep)
const { data: px, info } = await sharp(view(img.bufferView)).median(5).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, CH = info.channels;
const at = (u, v) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(H - 1, Math.max(0, Math.floor(v * H))), o = (y * W + x) * CH; return [px[o], px[o + 1], px[o + 2]]; };

// ------------------------------------------------------------------ sample: one colour a triangle
const BARY = [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6], [0.45, 0.45, 0.1], [0.1, 0.45, 0.45], [0.45, 0.1, 0.45]];
const col = new Uint8Array(nT * 3);
for (let t = 0; t < nT; t++) {
  const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
  const s = BARY.map(([x, y, z]) => at(UV[a * 2] * x + UV[b * 2] * y + UV[c * 2] * z, UV[a * 2 + 1] * x + UV[b * 2 + 1] * y + UV[c * 2 + 1] * z));
  for (let k = 0; k < 3; k++) col[t * 3 + k] = s.map((q) => q[k]).sort((p, q) => p - q)[3];
}

// ------------------------------------------------------------------ where each triangle sits (metres, the model's frame)
// The mesh's own frame faces +x (Tripo's export); the scene's first node turns it to +z. We classify in the mesh's frame:
// x ahead, y up, z its side. Heights as a share of the model's height.
let yMin = Infinity, yMax = -Infinity;
for (let i = 0; i < nV; i++) { yMin = Math.min(yMin, P[i * 3 + 1]); yMax = Math.max(yMax, P[i * 3 + 1]); }
const HT = yMax - yMin, S = 1.3 / HT;
const cen = new Float32Array(nT * 3), fn = new Float32Array(nT * 3);
for (let t = 0; t < nT; t++) {
  const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
  for (let k = 0; k < 3; k++) cen[t * 3 + k] = (P[a * 3 + k] + P[b * 3 + k] + P[c * 3 + k]) / 3;
  cen[t * 3 + 1] = (cen[t * 3 + 1] - yMin) / HT;
  for (let k = 0; k < 3; k++) fn[t * 3 + k] = N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k];
}

// ------------------------------------------------------------------ snap to the nearest seed (Lab)
const LABELS = [...ZONES, 'pale'], Z = Object.fromEntries(LABELS.map((z, i) => [z, i]));
const seeds = Object.entries(SEEDS).flatMap(([z, hs]) => hs.map((h) => [Z[z], lab(hex(h))]));
const label = new Uint8Array(nT);
for (let t = 0; t < nT; t++) {
  const L = lab([col[t * 3], col[t * 3 + 1], col[t * 3 + 2]]);
  let best = 0, bd = Infinity;
  for (const [z, s] of seeds) { const d = (L[0] - s[0]) ** 2 + (L[1] - s[1]) ** 2 + (L[2] - s[2]) ** 2; if (d < bd) { bd = d; best = z; } }
  label[t] = best;
}

// ------------------------------------------------------------------ adjacency (edge-sharing triangles, by position)
const key = (i) => `${P[i * 3].toFixed(5)},${P[i * 3 + 1].toFixed(5)},${P[i * 3 + 2].toFixed(5)}`;
const weld = new Int32Array(nV), seen = new Map();
for (let i = 0; i < nV; i++) { const k = key(i); if (!seen.has(k)) seen.set(k, i); weld[i] = seen.get(k); }
const edges = new Map(), nbr = Array.from({ length: nT }, () => []);
for (let t = 0; t < nT; t++) for (let e = 0; e < 3; e++) {
  const a = weld[I[t * 3 + e]], b = weld[I[t * 3 + ((e + 1) % 3)]], k = a < b ? a * nV + b : b * nV + a;
  const o = edges.get(k); if (o === undefined) edges.set(k, t); else { nbr[t].push(o); nbr[o].push(t); }
}
const tally = (t, lab) => { const c = new Map(); for (const o of nbr[t]) c.set(lab[o], (c.get(lab[o]) ?? 0) + 1); return c; };
const area = new Float32Array(nT);
for (let t = 0; t < nT; t++) {
  const [a, b, c] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]];
  const u = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k]), v = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k]);
  area[t] = 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) * S * S;
}

// ------------------------------------------------------------------ where a zone may be (the body's layout)
// What a colour alone cannot tell: Tripo paints the loincloth, the tusks and the claws the same tan, so tan on the hips is
// cloth and tan anywhere else bone; the eyes are only in the face. Anything else off its place falls back to skin.
const y = (t) => cen[t * 3 + 1], ahead = (t) => cen[t * 3], side = (t) => cen[t * 3 + 2];
const headFront = (t) => y(t) > 0.66 && ahead(t) > 0.02;
const allow = {
  eye: (t) => headFront(t),
  ink: (t) => y(t) > 0.3,
  cloth: (t) => y(t) > 0.12 && y(t) < 0.45 && Math.abs(side(t)) < 0.2,
  leather: (t) => y(t) > 0.3 && y(t) < 0.75 && Math.abs(side(t)) < 0.16,
  iron: (t) => y(t) > 0.3 && y(t) < 0.75 && Math.abs(side(t)) < 0.16,
  bone: () => true,
};
// (khaki off the hips is ivory: the tusks, the claws, painted the same tan)
const fallback = { cloth: 'bone' };
for (let t = 0; t < nT; t++) { const z = LABELS[label[t]]; if (allow[z] && !allow[z](t)) label[t] = Z[fallback[z] ?? 'skin']; }

// ------------------------------------------------------------------ clean: majority smoothing, then small islands
for (let it = 0; it < 4; it++) {
  const next = label.slice();
  for (let t = 0; t < nT; t++) {
    const c = tally(t, label); let best = label[t], bn = 0;
    for (const [z, n] of c) if (n > bn) { bn = n; best = z; }
    if (best !== label[t] && bn >= 2 && (c.get(label[t]) ?? 0) === 0) next[t] = best;
  }
  label.set(next);
}
// (islands under a zone's least area join the zone round them: the hatching's flecks; the eyes' and teeth's own sizes kept)
const MIN = { skin: 4e-4, pale: 6e-4, cloth: 8e-4, leather: 6e-4, iron: 2e-4, bone: 6e-5, ink: 4e-5, eye: 4e-5 };
for (let pass = 0; pass < 3; pass++) {
  const comp = new Int32Array(nT).fill(-1); let nc = 0;
  for (let s = 0; s < nT; s++) {
    if (comp[s] >= 0) continue;
    const z = label[s], list = [s]; comp[s] = nc; let A = 0;
    for (let q = 0; q < list.length; q++) { const t = list[q]; A += area[t]; for (const o of nbr[t]) if (comp[o] < 0 && label[o] === z) { comp[o] = nc; list.push(o); } }
    if (A < MIN[LABELS[z]]) {
      const c = new Map(); for (const t of list) for (const o of nbr[t]) if (comp[o] !== nc) c.set(label[o], (c.get(label[o]) ?? 0) + area[o]);
      let best = z, ba = 0; for (const [k, a] of c) if (a > ba) { ba = a; best = k; }
      for (const t of list) label[t] = best;
    }
    nc++;
  }
}

// ------------------------------------------------------------------ the eyes: round, yellow, a black pupil
// Tripo paints them as a few black flecks with a thin yellow ring. The procedural grunt's: a round yellow eye of radius
// 3.4 cm with a black pupil of 1.4 cm. Find each pupil (the ink in the face, left and right), and make the
// front-facing triangles within the eye's radius of it eye, the inner ones ink.
const pupils = [-1, 1].map((s) => {
  let sx = 0, sy = 0, sz = 0, w = 0;
  for (let t = 0; t < nT; t++) if (label[t] === Z.ink && headFront(t) && Math.sign(side(t)) === s && y(t) > 0.75) { const a = area[t]; sx += cen[t * 3] * a; sy += cen[t * 3 + 1] * a; sz += cen[t * 3 + 2] * a; w += a; }
  return w ? [sx / w, sy / w, sz / w] : null;
});
const EYE_R = 0.034 / S, PUPIL_R = 0.015 / S;
for (const p of pupils) {
  if (!p) continue;
  for (let t = 0; t < nT; t++) {
    if (!headFront(t) || fn[t * 3] <= 0.2 * Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2])) continue;
    const d = Math.hypot(cen[t * 3] - p[0], (cen[t * 3 + 1] - p[1]) * HT, cen[t * 3 + 2] - p[2]);
    if (d < PUPIL_R) label[t] = Z.ink; else if (d < EYE_R && label[t] !== Z.ink) label[t] = Z.eye;
  }
}

if (preview) await renders(preview);

// ------------------------------------------------------------------ vertex colours: 1, the pale skin toward skin2
const ratio = hex(SKIN2).map((c, k) => lin(c) / lin(hex(PALETTE.skin)[k]));
const pale = new Float32Array(nV), cnt = new Float32Array(nV);
for (let t = 0; t < nT; t++) for (let e = 0; e < 3; e++) { const v = I[t * 3 + e]; cnt[v]++; if (label[t] === Z.pale) pale[v]++; }
const COLOR = new Float32Array(nV * 3);
for (let v = 0; v < nV; v++) { const p = cnt[v] ? (pale[v] / cnt[v]) * 0.6 : 0; for (let k = 0; k < 3; k++) COLOR[v * 3 + k] = 1 + (ratio[k] - 1) * p; }
for (let t = 0; t < nT; t++) if (label[t] === Z.pale) label[t] = Z.skin;

// ------------------------------------------------------------------ write: one primitive a zone, shared attributes
const order = ZONES.map((z) => { const out = []; for (let t = 0; t < nT; t++) if (label[t] === Z[z]) out.push(t); return out; });
const counts = Object.fromEntries(ZONES.map((z, i) => [z, order[i].length]));
const IDX = new Uint32Array(nT * 3); let w = 0;
const ranges = order.map((list) => { const start = w; for (const t of list) { IDX[w++] = I[t * 3]; IDX[w++] = I[t * 3 + 1]; IDX[w++] = I[t * 3 + 2]; } return [start, w - start]; });
const POS = P.slice(); for (let i = 0; i < POS.length; i++) POS[i] *= S;
// (the normals softened: Tripo's scan-like surface breaks the house shading into many small shadow islands, where the
// procedural grunt's round forms take one broad shade; a few passes of averaging over the welded neighbours keep the
// big forms, the scalp's bumps and the folds, and drop the fine ripple. SMOOTH=0 keeps Tripo's own.)
const SMOOTH = +(process.env.SMOOTH ?? 3), NOR = N.slice();
if (SMOOTH > 0) {
  const ring = Array.from({ length: nV }, () => new Set());
  for (let t = 0; t < nT; t++) for (let e = 0; e < 3; e++) { const a = weld[I[t * 3 + e]], b = weld[I[t * 3 + ((e + 1) % 3)]]; ring[a].add(b); ring[b].add(a); }
  let cur = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) for (let k = 0; k < 3; k++) cur[weld[v] * 3 + k] += N[v * 3 + k];
  for (let it = 0; it < SMOOTH; it++) {
    const nx = new Float32Array(nV * 3);
    for (let v = 0; v < nV; v++) { if (weld[v] !== v) continue; for (let k = 0; k < 3; k++) nx[v * 3 + k] = cur[v * 3 + k]; for (const o of ring[v]) for (let k = 0; k < 3; k++) nx[v * 3 + k] += cur[o * 3 + k]; const l = Math.hypot(nx[v * 3], nx[v * 3 + 1], nx[v * 3 + 2]) || 1; for (let k = 0; k < 3; k++) nx[v * 3 + k] /= l; }
    cur = nx;
  }
  for (let v = 0; v < nV; v++) for (let k = 0; k < 3; k++) NOR[v * 3 + k] = cur[weld[v] * 3 + k];
}
// (the skeleton in metres too: every node's translation, every inverse bind's, times S)
const nodes = json.nodes.map((n) => { const m = { ...n }; if (n.matrix) { m.matrix = n.matrix.slice(); for (const k of [12, 13, 14]) m.matrix[k] *= S; } if (n.translation) m.translation = n.translation.map((x) => x * S); return m; });
const IBM = acc(json.skins[0].inverseBindMatrices).slice(); for (let j = 0; j < IBM.length; j += 16) for (const k of [12, 13, 14]) IBM[j + k] *= S;
const chunks = [], views = [], accessors = [];
const push = (arr, target) => { const pad = (4 - (chunks.reduce((a, c) => a + c.length, 0) % 4)) % 4; if (pad) chunks.push(Buffer.alloc(pad)); const off = chunks.reduce((a, c) => a + c.length, 0); chunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); views.push({ buffer: 0, byteOffset: off, byteLength: arr.byteLength, ...(target ? { target } : {}) }); return views.length - 1; };
const bounds = (a, k) => { const mn = Array(k).fill(Infinity), mx = Array(k).fill(-Infinity); for (let i = 0; i < a.length; i++) { mn[i % k] = Math.min(mn[i % k], a[i]); mx[i % k] = Math.max(mx[i % k], a[i]); } return { min: mn, max: mx }; };
const attr = (arr, type, ct, k, target, mm = false) => { accessors.push({ bufferView: push(arr, target), componentType: ct, count: arr.length / k, type, ...(mm ? bounds(arr, k) : {}) }); return accessors.length - 1; };
const aPos = attr(POS, 'VEC3', 5126, 3, 34962, true), aNor = attr(NOR, 'VEC3', 5126, 3, 34962), aCol = attr(COLOR, 'VEC3', 5126, 3, 34962);
const aJo = attr(JO, 'VEC4', 5123, 4, 34962), aWe = attr(WE, 'VEC4', 5126, 4, 34962), aIbm = attr(IBM, 'MAT4', 5126, 16);
const vIdx = push(IDX, 34963);
const prims = [], mats = [];
ZONES.forEach((z, i) => {
  const [start, count] = ranges[i]; if (!count) return;
  accessors.push({ bufferView: vIdx, byteOffset: start * 4, componentType: 5125, count, type: 'SCALAR' });
  mats.push({ name: 'grunt.' + z, pbrMetallicRoughness: { baseColorFactor: [...hex(PALETTE[z]).map(lin), 1], metallicFactor: 0, roughnessFactor: 0.9 }, extras: { zone: z } });
  prims.push({ mode: 4, material: mats.length - 1, indices: accessors.length - 1, attributes: { POSITION: aPos, NORMAL: aNor, COLOR_0: aCol, JOINTS_0: aJo, WEIGHTS_0: aWe }, extras: { zone: z } });
});
const binBuf = Buffer.concat(chunks), binPad = Buffer.concat([binBuf, Buffer.alloc((4 - (binBuf.length % 4)) % 4)]);
const out = {
  asset: { version: '2.0', generator: 'hiraeth flatten-tripo.mjs (issue #768)', extras: { source: IN.split('/').pop(), scale: S, zones: counts } },
  scene: 0, scenes: json.scenes, nodes, meshes: [{ name: 'grunt-flat', primitives: prims }], materials: mats,
  skins: [{ ...json.skins[0], inverseBindMatrices: aIbm }], accessors, bufferViews: views, buffers: [{ byteLength: binPad.length }],
};
let js = Buffer.from(JSON.stringify(out)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binPad.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4); return b; };
fs.writeFileSync(OUT, Buffer.concat([head, ch(js.length, 'JSON'), js, ch(binPad.length, 'BIN\0'), binPad]));
console.log(JSON.stringify({ in: IN.split('/').pop(), out: OUT.split('/').pop(), bytes: fs.statSync(OUT).size, triangles: nT, vertices: nV, scale: +S.toFixed(5), zones: counts, pupils: pupils.map((p) => p && p.map((x) => +x.toFixed(4))) }));

// ------------------------------------------------------------------ review renders (software, orthographic)
async function renders(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const zc = Object.fromEntries(LABELS.map((z) => [Z[z], hex(PALETTE[z] ?? SKIN2)]));
  // view: [right axis, up axis, toward-viewer axis] in the mesh frame; region in model units
  const VIEWS = { front: [[0, 0, -1], [0, 1, 0], [1, 0, 0]], side: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], back: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] };
  const shots = [['front', 'front', 1], ['side', 'side', 1], ['back', 'back', 1], ['head', 'front', 3.2]];
  for (const [name, vn, zoom] of shots) {
    const [R, U, F] = VIEWS[vn], SZ = 700, img = Buffer.alloc(SZ * 2 * SZ * 3, 235), zb = new Float32Array(SZ * SZ).fill(-Infinity);
    const cy = zoom > 1 ? yMin + HT * 0.8 : yMin + HT / 2, span = (HT * 1.15) / zoom;
    const proj = (v) => { const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], d = (a) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2]; return [(d(R) / span + 0.5) * SZ, (0.5 - (d(U) - (cy * U[1])) / span) * SZ, d(F)]; };
    const light = [0.5, 0.7, 0.5];
    for (let t = 0; t < nT; t++) {
      const q = [0, 1, 2].map((e) => proj(I[t * 3 + e]));
      const nl = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1, dot = (fn[t * 3] * F[0] + fn[t * 3 + 1] * F[1] + fn[t * 3 + 2] * F[2]) / nl;
      if (dot <= 0) continue;
      const sh = 0.55 + 0.45 * Math.max(0, (fn[t * 3] * light[0] + fn[t * 3 + 1] * light[1] + fn[t * 3 + 2] * light[2]) / nl);
      const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), x1 = Math.min(SZ - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), y1 = Math.min(SZ - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
      const den = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]); if (Math.abs(den) < 1e-9) continue;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const px_ = xx + 0.5, py = yy + 0.5;
        const a = ((q[1][1] - q[2][1]) * (px_ - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / den, b = ((q[2][1] - q[0][1]) * (px_ - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / den, c = 1 - a - b;
        if (a < 0 || b < 0 || c < 0) continue;
        const d = a * q[0][2] + b * q[1][2] + c * q[2][2]; if (d <= zb[yy * SZ + xx]) continue; zb[yy * SZ + xx] = d;
        const L = label[t], zcol = zc[L];
        for (let k = 0; k < 3; k++) { img[(yy * SZ * 2 + xx) * 3 + k] = Math.min(255, col[t * 3 + k] * sh); img[(yy * SZ * 2 + xx + SZ) * 3 + k] = Math.min(255, zcol[k] * sh); }
      }
    }
    await sharp(img, { raw: { width: SZ * 2, height: SZ, channels: 3 } }).png().toFile(`${dir}/zones-${name}.png`);
  }
  console.log('preview', dir, JSON.stringify(Object.fromEntries(LABELS.map((z) => [z, label.filter((l) => l === Z[z]).length]))));
}
