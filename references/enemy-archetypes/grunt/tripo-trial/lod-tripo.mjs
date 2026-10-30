// The flat Tripo grunt (tripo-flat.glb, flatten-tripo.mjs) brought down to the game's budget (issue #768, round 3):
//
// 1. The scalp smoothed. Tripo's scan-like cranium is a field of small bumps; under the house shading each bump takes its
//    own shadow, so the scalp broke into small dark patches. A Taubin (shrink-free) smoothing of the positions over the
//    cranium (Head-weighted, behind and above the face, the ears left alone), faded out toward the face and neck, keeps
//    the dome and the brow and drops the ripple.
// 2. Decimated to ~12k triangles with meshoptimizer's attribute-aware simplifier (three's bundled WASM build). It only
//    collapses edges onto existing vertices, so every surviving vertex keeps its own skin joints and weights: the rig is
//    the one Tripo made. Each colour zone gets its own copy of the vertices along its edge, so the zones' borders are
//    seams the simplifier keeps; the eyes and the ink are locked (they are small, and their shapes are the face).
// 3. Normals rebuilt from the simplified surface and softened, so the house shading forms broad shapes.
// 4. The face ink of the procedural grunt (monster.js gruntModel): two black nostrils on the snout's front, small flattened
//    ellipsoids pressed into the surface, bound wholly to the Head bone, drawn in the ink zone (no extra draw).
//
// Usage (from the repository):
//   node references/enemy-archetypes/grunt/tripo-trial/lod-tripo.mjs [in.glb] [out.glb] [--target 12000] [--preview <folder>]
// Defaults: tripo-flat.glb → tripo-lod.glb beside this script. Deterministic: the same input writes the same bytes.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d; };
const preview = opt('--preview', null), TARGET = +opt('--target', 12000);
const IN = args[0] ?? here + 'tripo-flat.glb', OUT = args[1] ?? here + 'tripo-lod.glb';
await MS.ready;

// ------------------------------------------------------------------ read
const bytes = fs.readFileSync(IN), jn = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString('utf8', 20, 20 + jn)), bin = bytes.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const prims = json.meshes[0].primitives, at0 = prims[0].attributes;
const P = acc(at0.POSITION), N = acc(at0.NORMAL), COL = acc(at0.COLOR_0), JO = acc(at0.JOINTS_0), WE = acc(at0.WEIGHTS_0);
const ZONES = prims.map((p) => p.extras.zone), zoneIdx = prims.map((p) => acc(p.indices));
const nV = P.length / 3, joints = json.skins[0].joints.map((j) => json.nodes[j].name), HEAD = joints.indexOf('mixamorig:Head');
const headW = (v) => { let w = 0; for (let k = 0; k < 4; k++) if (JO[v * 4 + k] === HEAD) w += WE[v * 4 + k]; return w; };
const before = zoneIdx.reduce((a, I) => a + I.length / 3, 0);

// ------------------------------------------------------------------ weld by position (Tripo's UV seams split vertices)
const weld = new Int32Array(nV), seen = new Map();
for (let v = 0; v < nV; v++) { const k = `${P[v * 3].toFixed(6)},${P[v * 3 + 1].toFixed(6)},${P[v * 3 + 2].toFixed(6)}`; if (!seen.has(k)) seen.set(k, v); weld[v] = seen.get(k); }
const ring = Array.from({ length: nV }, () => new Set());
for (const I of zoneIdx) for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = weld[I[t + e]], b = weld[I[t + ((e + 1) % 3)]]; ring[a].add(b); ring[b].add(a); }

// ------------------------------------------------------------------ 1. the scalp, smoothed (mesh frame: x ahead, y up, z side)
// How much each welded vertex is cranium: Head-weighted, above the brow or behind the eyes, not the ears, not the face.
const scalp = new Float32Array(nV);
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
for (let v = 0; v < nV; v++) {
  if (weld[v] !== v) continue;
  const x = P[v * 3], y = P[v * 3 + 1], z = Math.abs(P[v * 3 + 2]);
  const above = ramp(y, 1.08, 1.12), behind = ramp(-x, -0.14, -0.08); // (the brow line at 1.1 m; the eyes at x 0.19)
  scalp[v] = ramp(headW(v), 0.5, 0.9) * Math.max(above, behind) * (1 - ramp(z, 0.17, 0.22)) * ramp(y, 0.98, 1.03);
}
const SM = +(process.env.SCALP ?? 12);
if (SM > 0) {
  const pos = P.slice();
  const pass = (lam) => {
    const nx = pos.slice();
    for (let v = 0; v < nV; v++) {
      if (weld[v] !== v || !scalp[v] || !ring[v].size) continue;
      const c = [0, 0, 0]; for (const o of ring[v]) for (let k = 0; k < 3; k++) c[k] += pos[o * 3 + k];
      for (let k = 0; k < 3; k++) nx[v * 3 + k] = pos[v * 3 + k] + lam * scalp[v] * (c[k] / ring[v].size - pos[v * 3 + k]);
    }
    pos.set(nx);
  };
  for (let i = 0; i < SM; i++) { pass(0.6); pass(-0.63); }
  for (let v = 0; v < nV; v++) for (let k = 0; k < 3; k++) P[v * 3 + k] = pos[weld[v] * 3 + k];
}

// ------------------------------------------------------------------ 2. zones split, then simplified
// A vertex used by two zones gets a copy in each, so the zone edges are attribute seams (kept by the simplifier).
const copies = new Map(), src = [], zoneOf = [];
const split = zoneIdx.map((I, z) => { const out = new Uint32Array(I.length); for (let i = 0; i < I.length; i++) { const k = I[i] * 8 + z; let c = copies.get(k); if (c === undefined) { c = src.length; copies.set(k, c); src.push(I[i]); zoneOf.push(z); } out[i] = c; } return out; });
const nS = src.length, SP = new Float32Array(nS * 3), SA = new Float32Array(nS * 4), lock = new Uint8Array(nS);
const LOCK = new Set(['eye', 'ink']);
for (let i = 0; i < nS; i++) {
  const v = src[i]; for (let k = 0; k < 3; k++) SP[i * 3 + k] = P[v * 3 + k];
  for (let k = 0; k < 3; k++) SA[i * 4 + k] = N[v * 3 + k]; SA[i * 4 + 3] = COL[v * 3 + 1]; // (normal; the pale tint)
  if (LOCK.has(ZONES[zoneOf[i]])) lock[i] = 1;
}
// (the locked zones' vertices are locked in every zone's copy too, so their rims cannot move from under them)
const lockedPos = new Set(); for (let i = 0; i < nS; i++) if (lock[i]) lockedPos.add(weld[src[i]]);
for (let i = 0; i < nS; i++) if (lockedPos.has(weld[src[i]])) lock[i] = 1;
const all = new Uint32Array(split.reduce((a, I) => a + I.length, 0)); let off = 0; const zoneOfTri = [];
split.forEach((I, z) => { all.set(I, off); off += I.length; for (let t = 0; t < I.length / 3; t++) zoneOfTri.push(z); });
const [simp, err] = MS.simplifyWithAttributes(all, SP, 3, SA, 4, [0.5, 0.5, 0.5, 0.2], lock, TARGET * 3, 0.05, []);
// (a collapse keeps a triangle's corners, so each surviving triangle still lies in one zone: read it from its corners)
const zoneOfVert = Int32Array.from(zoneOf);
const kept = ZONES.map(() => []);
for (let t = 0; t < simp.length; t += 3) kept[zoneOfVert[simp[t]]].push(simp[t], simp[t + 1], simp[t + 2]);

// ------------------------------------------------------------------ compact
const remap = new Int32Array(nS).fill(-1), order = [];
for (const list of kept) for (const i of list) if (remap[i] < 0) { remap[i] = order.length; order.push(i); }
const nO = order.length;
const POS = new Float32Array(nO * 3), JOI = new Uint16Array(nO * 4), WEI = new Float32Array(nO * 4), CLR = new Float32Array(nO * 3);
order.forEach((i, o) => { const v = src[i]; for (let k = 0; k < 3; k++) { POS[o * 3 + k] = P[v * 3 + k]; CLR[o * 3 + k] = COL[v * 3 + k]; } for (let k = 0; k < 4; k++) { JOI[o * 4 + k] = JO[v * 4 + k]; WEI[o * 4 + k] = WE[v * 4 + k]; } });
let zoneIndices = kept.map((list) => Uint32Array.from(list, (i) => remap[i]));

// ------------------------------------------------------------------ 3. normals: from the new surface, welded, softened
function normals(pos, lists, smooth) {
  const n = pos.length / 3, key = new Map(), wv = new Int32Array(n);
  for (let v = 0; v < n; v++) { const k = `${pos[v * 3].toFixed(6)},${pos[v * 3 + 1].toFixed(6)},${pos[v * 3 + 2].toFixed(6)}`; if (!key.has(k)) key.set(k, v); wv[v] = key.get(k); }
  let acc3 = new Float32Array(n * 3); const nb = Array.from({ length: n }, () => new Set());
  for (const I of lists) for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
    const u = [0, 1, 2].map((k) => pos[b * 3 + k] - pos[a * 3 + k]), w = [0, 1, 2].map((k) => pos[c * 3 + k] - pos[a * 3 + k]);
    const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) acc3[wv[v] * 3 + k] += f[k];
    for (let e = 0; e < 3; e++) { const p = wv[I[t + e]], q = wv[I[t + ((e + 1) % 3)]]; nb[p].add(q); nb[q].add(p); }
  }
  const unit = (a) => { for (let v = 0; v < n; v++) { const l = Math.hypot(a[v * 3], a[v * 3 + 1], a[v * 3 + 2]) || 1; for (let k = 0; k < 3; k++) a[v * 3 + k] /= l; } };
  unit(acc3);
  for (let it = 0; it < smooth; it++) { const nx = acc3.slice(); for (let v = 0; v < n; v++) { if (wv[v] !== v) continue; for (const o of nb[v]) for (let k = 0; k < 3; k++) nx[v * 3 + k] += acc3[o * 3 + k]; } unit(nx); acc3 = nx; }
  const out = new Float32Array(n * 3); for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) out[v * 3 + k] = acc3[wv[v] * 3 + k];
  return out;
}

// ------------------------------------------------------------------ 4. the nostrils
// Found on the surface: rays along −x (toward the snout's front) at about the procedural grunt's spacing (3.4 cm either
// side of the middle), 2 cm under the snout's tip (the front-most point of the head). Each nostril: a sphere of 1.5 cm scaled
// (1, 1.2, 0.5) as the procedural one, its flat axis along the surface normal, sunk to half its depth.
function raycastX(y, z) {
  let best = null;
  for (const I of zoneIndices) for (let t = 0; t < I.length; t += 3) {
    const A = I[t], B = I[t + 1], C = I[t + 2];
    const p = (v) => [POS[v * 3], POS[v * 3 + 1], POS[v * 3 + 2]], a = p(A), b = p(B), c = p(C);
    // project onto the y-z plane; barycentric inside test
    const d = (b[1] - c[1]) * (a[2] - c[2]) + (c[2] - b[2]) * (a[1] - c[1]); if (Math.abs(d) < 1e-12) continue;
    const l1 = ((b[1] - c[1]) * (z - c[2]) + (c[2] - b[2]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (z - c[2]) + (a[2] - c[2]) * (y - c[1])) / d, l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    const x = l1 * a[0] + l2 * b[0] + l3 * c[0];
    if (!best || x > best.x) { const u = [0, 1, 2].map((k) => b[k] - a[k]), w = [0, 1, 2].map((k) => c[k] - a[k]); let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n); n = n.map((q) => q / l); if (n[0] < 0) n = n.map((q) => -q); best = { x, n }; }
  }
  return best;
}
let tip = null; for (let v = 0; v < nO; v++) if (headW(src[order[v]]) > 0.5 && Math.abs(POS[v * 3 + 2]) < 0.02 && (!tip || POS[v * 3] > tip[0])) tip = [POS[v * 3], POS[v * 3 + 1]];
// (a little under the tip, on the snout's front-and-under face as the sheet draws them: at the tip's own height they sat
// level with the eyes and read as a second pair; 1.6 cm, a touch over the procedural 1.5, the Tripo snout being broader)
const NOSE_Y = +(process.env.NOSE_Y ?? tip[1] - 0.02), NOSE_Z = 0.034, NOSE_R = +(process.env.NOSE_R ?? 0.016);
const nostrils = [-1, 1].map((s) => { const h = raycastX(NOSE_Y, s * NOSE_Z); return { s, at: [h.x, NOSE_Y, s * NOSE_Z], n: h.n }; });
const extra = { pos: [], idx: [] };
for (const { at, n } of nostrils) {
  // frame: f along the normal (flat axis), up roughly y, side the cross
  const f = n, upG = [0, 1, 0], sd = [upG[1] * f[2] - upG[2] * f[1], upG[2] * f[0] - upG[0] * f[2], upG[0] * f[1] - upG[1] * f[0]];
  const sl = Math.hypot(...sd); for (let k = 0; k < 3; k++) sd[k] /= sl;
  const up = [f[1] * sd[2] - f[2] * sd[1], f[2] * sd[0] - f[0] * sd[2], f[0] * sd[1] - f[1] * sd[0]];
  const W = 8, H = 6, base = POS.length / 3 + extra.pos.length / 3, r = [NOSE_R, NOSE_R * 1.2, NOSE_R * 0.5];
  const c = at.map((q, k) => q - f[k] * r[2] * 0.3); // (sunk a little: the surface cuts it near its middle)
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
    const th = (j / H) * Math.PI, ph = (i / W) * Math.PI * 2, e = [Math.sin(th) * Math.cos(ph) * r[0], Math.cos(th) * r[1], Math.sin(th) * Math.sin(ph) * r[2]];
    for (let k = 0; k < 3; k++) extra.pos.push(c[k] + sd[k] * e[0] + up[k] * e[1] + f[k] * e[2]);
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const a = base + j * (W + 1) + i, b = a + W + 1; if (j) extra.idx.push(a, a + 1, b); if (j < H - 1) extra.idx.push(a + 1, b + 1, b); }
}
// (the winding toward the outside: checked against the frame below, flipped if needed)
const nE = extra.pos.length / 3, nT = nO + nE;
const POS2 = new Float32Array(nT * 3); POS2.set(POS); POS2.set(extra.pos, POS.length);
const JOI2 = new Uint16Array(nT * 4); JOI2.set(JOI); const WEI2 = new Float32Array(nT * 4); WEI2.set(WEI);
const CLR2 = new Float32Array(nT * 3).fill(1); CLR2.set(CLR);
for (let v = nO; v < nT; v++) { JOI2[v * 4] = HEAD; WEI2[v * 4] = 1; }
const inkZ = ZONES.indexOf('ink');
{
  // orient the nostril triangles outward (from each ellipsoid's centre)
  const E = extra.idx;
  for (let t = 0; t < E.length; t += 3) {
    const [a, b, c] = [E[t], E[t + 1], E[t + 2]], p = (v) => [0, 1, 2].map((k) => POS2[v * 3 + k]);
    const A = p(a), B = p(b), C = p(c), u = A.map((q, k) => B[k] - q), w = A.map((q, k) => C[k] - q);
    const fN = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const ns = nostrils[a - nO < nE / 2 ? 0 : 1], cen = ns.at, out = A.map((q, k) => q - cen[k]);
    if (fN[0] * out[0] + fN[1] * out[1] + fN[2] * out[2] < 0) { E[t + 1] = c; E[t + 2] = b; }
  }
  const merged = new Uint32Array(zoneIndices[inkZ].length + E.length); merged.set(zoneIndices[inkZ]); merged.set(E, zoneIndices[inkZ].length); zoneIndices[inkZ] = merged;
}
const NOR = normals(POS2, zoneIndices, +(process.env.SMOOTH ?? 2));
// (the nostrils keep their own round normals: they are their own small form, not the snout's)
for (let v = nO; v < nT; v++) { const ns = nostrils[v - nO < nE / 2 ? 0 : 1]; const d = [0, 1, 2].map((k) => POS2[v * 3 + k] - ns.at[k]); const l = Math.hypot(...d) || 1; for (let k = 0; k < 3; k++) NOR[v * 3 + k] = d[k] / l; }

// ------------------------------------------------------------------ write (the flat export's nodes, skin and materials kept)
const chunks = [], views = [], accessors = []; let blen = 0;
const push = (arr, target) => { const pad = (4 - (blen % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); blen += pad; } views.push({ buffer: 0, byteOffset: blen, byteLength: arr.byteLength, ...(target ? { target } : {}) }); chunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); blen += arr.byteLength; return views.length - 1; };
const bounds = (a, k) => { const mn = Array(k).fill(Infinity), mx = Array(k).fill(-Infinity); for (let i = 0; i < a.length; i++) { mn[i % k] = Math.min(mn[i % k], a[i]); mx[i % k] = Math.max(mx[i % k], a[i]); } return { min: mn, max: mx }; };
const attr = (arr, type, ct, k, target, mm = false) => { accessors.push({ bufferView: push(arr, target), componentType: ct, count: arr.length / k, type, ...(mm ? bounds(arr, k) : {}) }); return accessors.length - 1; };
const aPos = attr(POS2, 'VEC3', 5126, 3, 34962, true), aNor = attr(NOR, 'VEC3', 5126, 3, 34962), aCol = attr(CLR2, 'VEC3', 5126, 3, 34962);
const aJo = attr(JOI2, 'VEC4', 5123, 4, 34962), aWe = attr(WEI2, 'VEC4', 5126, 4, 34962), aIbm = attr(acc(json.skins[0].inverseBindMatrices), 'MAT4', 5126, 16);
const IDX = new Uint32Array(zoneIndices.reduce((a, I) => a + I.length, 0)); let w = 0; const ranges = zoneIndices.map((I) => { const s = w; IDX.set(I, w); w += I.length; return [s, I.length]; });
const vIdx = push(IDX, 34963);
const outPrims = [];
ZONES.forEach((z, i) => { const [s, count] = ranges[i]; if (!count) return; accessors.push({ bufferView: vIdx, byteOffset: s * 4, componentType: 5125, count, type: 'SCALAR' }); outPrims.push({ mode: 4, material: prims[i].material, indices: accessors.length - 1, attributes: { POSITION: aPos, NORMAL: aNor, COLOR_0: aCol, JOINTS_0: aJo, WEIGHTS_0: aWe }, extras: { zone: z } }); });
const binBuf = Buffer.concat(chunks), binPad = Buffer.concat([binBuf, Buffer.alloc((4 - (binBuf.length % 4)) % 4)]);
const counts = Object.fromEntries(ZONES.map((z, i) => [z, zoneIndices[i].length / 3]));
const triangles = Object.values(counts).reduce((a, b) => a + b, 0);
const out = {
  asset: { version: '2.0', generator: 'hiraeth lod-tripo.mjs (issue #768)', extras: { source: IN.split('/').pop(), triangles, from: before, zones: counts, nostrils: nostrils.map((n) => n.at.map((q) => +q.toFixed(4))) } },
  scene: json.scene, scenes: json.scenes, nodes: json.nodes, meshes: [{ name: 'grunt-lod', primitives: outPrims }], materials: json.materials,
  skins: [{ ...json.skins[0], inverseBindMatrices: aIbm }], accessors, bufferViews: views, buffers: [{ byteLength: binPad.length }],
};
let js = Buffer.from(JSON.stringify(out)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binPad.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4); return b; };
fs.writeFileSync(OUT, Buffer.concat([head, ch(js.length, 'JSON'), js, ch(binPad.length, 'BIN\0'), binPad]));
console.log(JSON.stringify({ in: IN.split('/').pop(), out: OUT.split('/').pop(), bytes: fs.statSync(OUT).size, from: before, triangles, vertices: nT, error: +err.toFixed(5), zones: counts, nostrils: out.asset.extras.nostrils }));

// ------------------------------------------------------------------ review renders (software, orthographic, lit by the normals)
if (preview) {
  fs.mkdirSync(preview, { recursive: true });
  const ZC = { skin: [214, 90, 64], cloth: [198, 176, 113], leather: [107, 70, 48], iron: [94, 88, 82], bone: [239, 226, 196], ink: [27, 20, 20], eye: [242, 195, 60] };
  const VIEWS = { front: [[0, 0, -1], [0, 1, 0], [1, 0, 0]], side: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], back: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] };
  for (const [name, vn, zoom, cy] of [['front', 'front', 1, 0.65], ['side', 'side', 1, 0.65], ['back', 'back', 1, 0.65], ['head', 'front', 3.2, 1.07], ['head-side', 'side', 3.2, 1.07], ['head-top', 'back', 3.2, 1.1]]) {
    const [R, U, F] = VIEWS[vn], SZ = 700, img = Buffer.alloc(SZ * SZ * 3, 235), zb = new Float32Array(SZ * SZ).fill(-Infinity), span = 1.5 / zoom;
    const dot = (a, p) => a[0] * p[0] + a[1] * p[1] + a[2] * p[2];
    const proj = (v) => { const p = [POS2[v * 3], POS2[v * 3 + 1], POS2[v * 3 + 2]]; return [(dot(R, p) / span + 0.5) * SZ, (0.5 - (dot(U, p) - cy) / span) * SZ, dot(F, p)]; };
    const L = [0.45, 0.75, 0.3]; const ll = Math.hypot(...L); L.forEach((q, k) => (L[k] = q / ll));
    zoneIndices.forEach((I, z) => {
      for (let t = 0; t < I.length; t += 3) {
        const q = [0, 1, 2].map((e) => proj(I[t + e]));
        const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), x1 = Math.min(SZ - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
        const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), y1 = Math.min(SZ - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
        const den = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]); if (Math.abs(den) < 1e-12) continue;
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
          const px = xx + 0.5, py = yy + 0.5;
          const a = ((q[1][1] - q[2][1]) * (px - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / den, b = ((q[2][1] - q[0][1]) * (px - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / den, c = 1 - a - b;
          if (a < 0 || b < 0 || c < 0) continue;
          const d = a * q[0][2] + b * q[1][2] + c * q[2][2]; if (d <= zb[yy * SZ + xx]) continue; zb[yy * SZ + xx] = d;
          const vs = [I[t], I[t + 1], I[t + 2]], n = [0, 1, 2].map((k) => a * NOR[vs[0] * 3 + k] + b * NOR[vs[1] * 3 + k] + c * NOR[vs[2] * 3 + k]);
          // (house-like: two bands, lit and shade, so shadow islands show as they would in the game)
          const lit = dot(n, L) / (Math.hypot(...n) || 1), sh = lit > 0.15 ? 1 : 0.62;
          const tint = (k) => a * CLR2[vs[0] * 3 + k] + b * CLR2[vs[1] * 3 + k] + c * CLR2[vs[2] * 3 + k]; // (the vertex colour, linear: shown boosted ×1.6 off 1 so the pale patches read)
          for (let k = 0; k < 3; k++) img[(yy * SZ + xx) * 3 + k] = Math.min(255, ZC[ZONES[z]][k] * sh * (1 + (tint(k) - 1) * 1.6));
        }
      }
    });
    await sharp(img, { raw: { width: SZ, height: SZ, channels: 3 } }).png().toFile(`${preview}/lod-${name}.png`);
  }
}
