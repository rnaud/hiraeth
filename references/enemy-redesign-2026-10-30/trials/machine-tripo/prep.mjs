// #800 family D (the machines: the crucible walker, the bell walker, the pearl roller): the shared steps of their
// prepare.mjs, on the wood cutter's lines (../woodcutter-tripo/prepare.mjs) but split into calls so each foe's script
// says only what is its own (where its parts are, what colour each role is):
//
//   load(file, { height, centre })   the export in the game's frame (Tripo +x ahead -> +z), feet on y 0, `height` m tall,
//                                    centred between its feet (or on `centre(P)`), decimated to `target` triangles by the
//                                    geometry alone (meshoptimizer, the UV seams kept); the texture's roles (`roleOf`)
//   partition(m, partOf, PARTS)      each triangle whole to one part (the part most of its corners are in; `strict` parts
//                                    only with all three), the triangles grouped by part (landmarks.parts: [first, count])
//   paint(m, paintRole, PALETTE)     the texture repainted one flat colour a role, per texel by its part and its own role
//                                    (`paintRole(part, role, p)`), the gaps between islands filled from the nearest island,
//                                    swatches of the model's own parts' colours; COLOR_0 from it
//   weights(m, bones)                JOINTS_0/WEIGHTS_0: each vertex 1 on its part's bone, blended across the cuts
//                                    (`blend(v, part, p)` -> [[bone, w], ...] or null)
//   write(out, m, extras)            body.glb (no picture: every skin draws the vertex colours) and the flat texture's
//                                    picture beside the script
//
// Deterministic: the same input writes the same bytes. Colours: sRGB bytes as they are (COLOR_0 holds the texture's
// bytes; never through THREE.Color).
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { readTripo, sample, writeGlb } from '../shellback-tripo/glb.mjs';

export const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
export const r3 = (a) => a.map((x) => +x.toFixed(3));
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * The export in the game's frame, decimated. roleOf(r, g, b) -> a role index (the texture's own colours: what each texel
 * is). Returns { P, N, UV, I, n, role (per vertex), texRole, W, H, px, S, shift }.
 */
export async function load(file, { height, target = 12000, tex = 1024, roleOf, roles, centre, drop = null, majority = 3 }) {
  await MS.ready;
  const m = await readTripo(file);
  const n0 = m.P.length / 3;
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < n0; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
  // (a ground plate Tripo modelled under it, `drop`: its vertices left out of the height, then of the mesh)
  const S0 = height / (hi - lo);
  const toGame0 = (v) => [-m.P[v * 3 + 2], m.P[v * 3 + 1], m.P[v * 3]];
  let S = S0, LO = lo;
  if (drop) {
    let lo2 = Infinity; for (let v = 0; v < n0; v++) { const p = toGame0(v); const g = [p[0] * S0, (p[1] - lo) * S0, p[2] * S0]; if (!drop(g)) lo2 = Math.min(lo2, m.P[v * 3 + 1]); }
    LO = lo2; S = height / (hi - lo2);
  }
  // the middle between its feet (the vertices under 6 cm: their x and z extents' centre), or the script's own
  let CX = 0, CZ = 0;
  { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let v = 0; v < n0; v++) { const p = toGame0(v), y = (p[1] - LO) * S; if (y > 0.06 || y < -0.01) continue; const x = p[0] * S, z = p[2] * S; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    CX = (x0 + x1) / 2; CZ = (z0 + z1) / 2; }
  if (centre) [CX, CZ] = centre;
  const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3);
  for (let v = 0; v < n0; v++) { const p = toGame0(v); P[v * 3] = p[0] * S - CX; P[v * 3 + 1] = (p[1] - LO) * S; P[v * 3 + 2] = p[2] * S - CZ; N[v * 3] = -m.N[v * 3 + 2]; N[v * 3 + 1] = m.N[v * 3 + 1]; N[v * 3 + 2] = m.N[v * 3]; }
  // the texture's roles: a median filter, each texel's role, then the commonest role round each (2·majority + 1)²
  const { data: px, info } = await sharp(m.image.bytes).resize(tex, tex, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, texRole = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) texRole[i] = roleOf(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
  if (majority > 0) { const R = majority, src = texRole.slice(), cnt = new Uint16Array(roles.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { cnt.fill(0);
      for (let j = Math.max(0, y - R); j <= Math.min(H - 1, y + R); j++) for (let i = Math.max(0, x - R); i <= Math.min(W - 1, x + R); i++) cnt[src[j * W + i]]++;
      let best = src[y * W + x]; for (let k = 0; k < roles.length; k++) if (cnt[k] > cnt[best]) best = k; texRole[y * W + x] = best; } }
  // decimated by the geometry alone (the UV seams kept), after the dropped ground's triangles are taken out
  let I0 = m.I;
  if (drop) { const keep = []; for (let t = 0; t < m.I.length; t += 3) { let all = true; for (let k = 0; k < 3; k++) { const v = m.I[t + k]; if (!drop([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]])) all = false; } if (!all) keep.push(m.I[t], m.I[t + 1], m.I[t + 2]); } I0 = Uint32Array.from(keep); }
  const [simp, err] = MS.simplify(I0, P, 3, Math.min(I0.length, target * 3), 0.05, ['LockBorder']);
  const used = new Int32Array(n0).fill(-1); let nv = 0;
  for (const i of simp) if (used[i] < 0) used[i] = nv++;
  const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2) };
  for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue; out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(m.UV.subarray(v * 2, v * 2 + 2), j * 2); }
  const I = Uint32Array.from(simp, (i) => used[i]);
  const roleAt = (u, v) => texRole[Math.min(H - 1, Math.max(0, Math.floor(v * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)))];
  const role = new Uint8Array(nv); for (let v = 0; v < nv; v++) role[v] = roleAt(out.UV[v * 2], out.UV[v * 2 + 1]);
  const res = { ...out, I, n: nv, role, texRole, roles, W, H, px, S: +S.toFixed(5), shift: r3([CX, CZ]), source: { vertices: n0, triangles: m.I.length / 3, texture: [m.tex.w, m.tex.h] }, error: +err.toFixed(5) };
  // (read through res: partition() replaces its arrays)
  res.at = (v) => [res.P[v * 3], res.P[v * 3 + 1], res.P[v * 3 + 2]]; res.nor = (v) => [res.N[v * 3], res.N[v * 3 + 1], res.N[v * 3 + 2]];
  return res;
}

/** The welded surface's neighbours (the LOD's UV seams split vertices that share a place): weld[v], adj (Map of Sets). */
export function welded(m) {
  const weld = new Int32Array(m.n), map = new Map();
  for (let v = 0; v < m.n; v++) { const k = `${Math.round(m.P[v * 3] * 4000)},${Math.round(m.P[v * 3 + 1] * 4000)},${Math.round(m.P[v * 3 + 2] * 4000)}`; if (!map.has(k)) map.set(k, v); weld[v] = map.get(k); }
  const adj = new Map(), link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (let t = 0; t < m.I.length; t += 3) for (let k = 0; k < 3; k++) { const a = weld[m.I[t + k]], b = weld[m.I[t + (k + 1) % 3]]; link(a, b); link(b, a); }
  return { weld, adj };
}

/**
 * Each triangle to one part: vpart(v) per vertex (an index in PARTS, or DROP 255), the triangle the part most of its
 * corners are in (`strict` parts only with all three; a dropped corner drops it). Reorders m in place: m.I grouped by part
 * (m.parts { name: [first, count] }), m.tri (each triangle's part), the unused vertices gone.
 */
export function partition(m, vpartOf, PARTS, { strict = [], fallback = 0, bridges = [] } = {}) {
  const vpart = new Uint8Array(m.n); for (let v = 0; v < m.n; v++) vpart[v] = vpartOf(v);
  const STRICT = new Set(strict.map((s) => PARTS.indexOf(s))), T = m.I.length / 3, triPart = new Uint8Array(T);
  for (let t = 0; t < T; t++) {
    const q = [vpart[m.I[t * 3]], vpart[m.I[t * 3 + 1]], vpart[m.I[t * 3 + 2]]];
    if (q.includes(255)) { triPart[t] = 255; continue; }
    // (a triangle bridging two parts that never touch, Tripo's web across a gap: dropped)
    if (bridges.some(([x, y]) => q.includes(PARTS.indexOf(x)) && q.includes(PARTS.indexOf(y)))) { triPart[t] = 255; continue; }
    let pick = q[0] === q[1] || q[0] === q[2] ? q[0] : q[1] === q[2] ? q[1] : q[0];
    if (STRICT.has(pick) && !(q[0] === pick && q[1] === pick && q[2] === pick)) pick = q.find((x) => !STRICT.has(x)) ?? fallback;
    triPart[t] = pick;
  }
  const order = [], parts = {};
  for (const [k, name] of PARTS.entries()) { const first = order.length; for (let t = 0; t < T; t++) if (triPart[t] === k) order.push(t); parts[name] = [first, order.length - first]; }
  // (a vertex used by two parts' triangles is copied, one a part: each part's rim its own, so a part that moves apart
  //  from its neighbour, the eye unit sliding round the pot, takes none of the neighbour's triangles with it)
  const key = new Map(); let nk = 0; const src = [], vp0 = [];
  const I = new Uint32Array(order.length * 3);
  order.forEach((t, i) => { for (let k = 0; k < 3; k++) { const v = m.I[t * 3 + k], q = v * 256 + triPart[t]; let j = key.get(q); if (j === undefined) { j = nk++; key.set(q, j); src.push(v); vp0.push(triPart[t]); } I[i * 3 + k] = j; } });
  const P = new Float32Array(nk * 3), N = new Float32Array(nk * 3), UV = new Float32Array(nk * 2), role = new Uint8Array(nk);
  src.forEach((v, j) => { P.set(m.P.subarray(v * 3, v * 3 + 3), j * 3); N.set(m.N.subarray(v * 3, v * 3 + 3), j * 3); UV.set(m.UV.subarray(v * 2, v * 2 + 2), j * 2); role[j] = m.role[v]; });
  const tri = new Uint8Array(order.length); { let i = 0; for (const [k, name] of PARTS.entries()) for (let j = 0; j < parts[name][1]; j++) tri[i++] = k; }
  const vtri = vp0;
  Object.assign(m, { P, N, UV, I, n: nk, role, vpart: Uint8Array.from(vtri), tri, parts, PARTS, dropped: T - order.length, split: nk - new Set(src).size });
  return m;
}

/**
 * The texture repainted: each texel one flat colour, PALETTE[paintRole(partName, texRoleName, p, k)] (p: the texel's
 * place on its triangle, game frame; k its index). Swatches (16², 4 free round them) of SWATCH's colours where no
 * triangle draws; the gaps filled from the nearest island. Sets m.COL (COLOR_0, RGBA bytes), m.png, m.swatches.
 */
export async function paint(m, paintRole, PALETTE, SWATCH = {}) {
  const { W, H } = m, PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]));
  const img = Buffer.alloc(W * H * 3), owner = new Int32Array(W * H).fill(-1);
  for (const pass of [0, 1]) for (let t = 0; t < m.I.length / 3; t++) {
    const [a, b, d] = [m.I[t * 3], m.I[t * 3 + 1], m.I[t * 3 + 2]], U = (v) => [m.UV[v * 2] * W - 0.5, m.UV[v * 2 + 1] * H - 0.5];
    const A = U(a), B = U(b), D = U(d), area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
    if (Math.abs(area) < 1e-12) continue;
    const mid = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3].map(Math.round);
    const x0 = pass ? mid[0] : Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))), x1 = pass ? mid[0] : Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], D[0])));
    const y0 = pass ? mid[1] : Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))), y1 = pass ? mid[1] : Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], D[1])));
    const part = m.PARTS[m.tri[t]];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      let w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
      if (pass) { if (owner[y * W + x] >= 0) continue; w1 = w2 = w3 = 1 / 3; }
      else if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
      const k = y * W + x, inside = !pass && w1 >= 0 && w2 >= 0 && w3 >= 0;
      if (owner[k] >= 0 && !inside) continue;
      const p = [0, 1, 2].map((i) => w1 * m.P[a * 3 + i] + w2 * m.P[b * 3 + i] + w3 * m.P[d * 3 + i]);
      const role = paintRole(part, m.roles[m.texRole[k]], p, k, t);
      owner[k] = t; const c = PAL[role]; if (!c) throw new Error('no colour for role ' + role);
      img[k * 3] = c[0]; img[k * 3 + 1] = c[1]; img[k * 3 + 2] = c[2];
    }
  }
  const swatches = {};
  { const B = 16, M = 4; let sx = 0, sy = 0;
    const free = (x, y) => { for (let j = y - M; j < y + B + M; j++) for (let i = x - M; i < x + B + M; i++) { if (i < 0 || j < 0 || i >= W || j >= H) return false; if (owner[j * W + i] >= 0) return false; } return true; };
    for (const [name, h] of Object.entries(SWATCH)) {
      let found = null;
      for (let y = sy; y < H - B && !found; y += 4) for (let x = y === sy ? sx : 0; x < W - B && !found; x += 4) if (free(x, y)) found = [x, y];
      if (!found) throw new Error('no room for a swatch: ' + name);
      const col = hex(h);
      for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = (found[1] + j) * W + found[0] + i; owner[k] = -2; img[k * 3] = col[0]; img[k * 3 + 1] = col[1]; img[k * 3 + 2] = col[2]; }
      swatches[name] = [+((found[0] + B / 2) / W).toFixed(5), +((found[1] + B / 2) / H).toFixed(5)];
      [sx, sy] = [found[0] + B + 2 * M, found[1]];
    }
  }
  { let front = []; for (let k = 0; k < W * H; k++) if (owner[k] !== -1) front.push(k);
    const done = Uint8Array.from(owner, (o) => (o !== -1 ? 1 : 0));
    while (front.length) { const next = []; for (const k of front) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (done[j]) continue; done[j] = 1; img.copy(img, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
  m.png = await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: 16, dither: 0 }).toBuffer();
  // COLOR_0: a texel a little inside one of each vertex's triangles
  m.COL = new Uint8Array(m.n * 4);
  const done = new Uint8Array(m.n);
  for (let t = 0; t < m.I.length / 3; t++) {
    const tri = [m.I[t * 3], m.I[t * 3 + 1], m.I[t * 3 + 2]], cu = tri.reduce((s, v) => s + m.UV[v * 2], 0) / 3, cv = tri.reduce((s, v) => s + m.UV[v * 2 + 1], 0) / 3;
    for (const v of tri) { if (done[v]) continue; done[v] = 1;
      const u = m.UV[v * 2] * 0.85 + cu * 0.15, w = m.UV[v * 2 + 1] * 0.85 + cv * 0.15;
      const k = Math.min(H - 1, Math.max(0, Math.floor(w * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      for (let i = 0; i < 3; i++) m.COL[v * 4 + i] = img[k * 3 + i]; m.COL[v * 4 + 3] = 255; }
  }
  m.swatches = swatches; m.img = img;
  return m;
}

/**
 * Skin weights: each vertex 1 on its part's bone (boneOfPart[part name] -> bone index), or what blend(v, partName, p)
 * gives ([[bone, w], …], up to 4, summing to 1). Sets m.JOINTS (Uint8), m.WEIGHTS (Float32).
 */
export function weights(m, boneOfPart, blend = () => null) {
  m.JOINTS = new Uint8Array(m.n * 4); m.WEIGHTS = new Float32Array(m.n * 4);
  for (let v = 0; v < m.n; v++) {
    const part = m.PARTS[m.vpart[v]], b = blend(v, part, m.at(v));
    const list = b ?? [[boneOfPart[part], 1]];
    const sum = list.reduce((s, x) => s + x[1], 0) || 1;
    list.slice(0, 4).forEach(([j, w], i) => { m.JOINTS[v * 4 + i] = j; m.WEIGHTS[v * 4 + i] = w / sum; });
  }
  return m;
}

/** A blend across a plane (at, n): within `half` m of it, the vertex's weight goes from `from` (behind) to `to` (past). */
export const planeBlend = (p, at, n, half, from, to) => {
  const s = V3.dot(V3.sub(p, at), n);
  if (Math.abs(s) >= half) return null;
  const x = Math.min(1, Math.max(0, (s + half) / (2 * half))), w = x * x * (3 - 2 * x);
  return [[to, w], [from, 1 - w]];
};

/** body.glb (16-bit indices, no picture) at `out`, the flat texture's picture at `png`; a summary. */
export function write(out, png, m, extras) {
  const I = m.n < 65536 ? Uint16Array.from(m.I) : m.I;
  const glb = writeGlb({ attrs: { POSITION: m.P, NORMAL: m.N, TEXCOORD_0: m.UV, COLOR_0: m.COL, ...(m.JOINTS ? { JOINTS_0: m.JOINTS, WEIGHTS_0: m.WEIGHTS } : {}) }, indices: I, image: null, name: extras.name ?? 'tripo lod', extras: { ...extras, triangles: m.I.length / 3 } });
  writeFileSync(out, glb);
  writeFileSync(png, m.png);
  return { vertices: m.n, triangles: m.I.length / 3, bytes: glb.length, parts: Object.fromEntries(Object.entries(m.parts).map(([k, v]) => [k, v[1]])), dropped: m.dropped, error: m.error, source: m.source };
}

/** The ring a cut leaves (where, its outer radius and inner one): the surface of `parts` within 3 cm of the plane. */
export function ring(m, cut, partIds, reach = 0.5) {
  const pts = []; let cc = [0, 0, 0];
  for (let v = 0; v < m.n; v++) { if (!partIds.includes(m.vpart[v])) continue; const p = m.at(v); if (Math.abs(V3.dot(V3.sub(p, cut.at), cut.n)) < 0.03 && V3.len(V3.sub(p, cut.at)) < reach) { pts.push(p); cc = V3.add(cc, p); } }
  if (!pts.length) return { at: r3(cut.at), n: r3(cut.n), r: 0.15, inner: 0.1 };
  cc = cc.map((x) => x / pts.length); const on = V3.add(cc, cut.n, -V3.dot(V3.sub(cc, cut.at), cut.n));
  const rs = pts.map((p) => { const d = V3.sub(p, on); return V3.len(V3.add(d, cut.n, -V3.dot(d, cut.n))); }).sort((a, b) => a - b), q = (f) => rs[Math.min(rs.length - 1, Math.floor(f * rs.length))];
  return { at: r3(on), n: r3(cut.n), r: +q(0.85).toFixed(3), inner: +q(0.25).toFixed(3) };
}

/** A sphere fitted to points (least squares): { centre, r }. */
export function fitSphere(pts) {
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]), B = [0, 0, 0, 0];
  for (const p of pts) { const r = [2 * p[0], 2 * p[1], 2 * p[2], 1], s = V3.dot(p, p); for (let i = 0; i < 4; i++) { B[i] += r[i] * s; for (let j = 0; j < 4; j++) A[i][j] += r[i] * r[j]; } }
  for (let i = 0; i < 4; i++) { let q = i; for (let k = i + 1; k < 4; k++) if (Math.abs(A[k][i]) > Math.abs(A[q][i])) q = k; [A[i], A[q]] = [A[q], A[i]]; [B[i], B[q]] = [B[q], B[i]];
    for (let k = i + 1; k < 4; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j]; B[k] -= f * B[i]; } }
  const X = [0, 0, 0, 0]; for (let i = 3; i >= 0; i--) { let s = B[i]; for (let j = i + 1; j < 4; j++) s -= A[i][j] * X[j]; X[i] = s / A[i][i]; }
  const c = X.slice(0, 3); return { centre: r3(c), r: +Math.sqrt(X[3] + V3.dot(c, c)).toFixed(3) };
}

/** A surface of revolution's radius at each height (round the y axis): per `step` m, the median over 36 azimuths of each one's outermost point. */
export function profile(m, { step = 0.02, skip = () => false } = {}) {
  const rows = new Map();
  for (let v = 0; v < m.n; v++) { const p = m.at(v); if (skip(p)) continue; const k = Math.floor(p[1] / step), a = Math.floor(((Math.atan2(p[0], p[2]) + Math.PI) / (2 * Math.PI)) * 36) % 36; if (!rows.has(k)) rows.set(k, new Float32Array(36)); const r = rows.get(k); r[a] = Math.max(r[a], Math.hypot(p[0], p[2])); }
  const ks = [...rows.keys()].sort((a, b) => a - b), out = [];
  for (const k of ks) { const r = [...rows.get(k)].filter((x) => x > 0).sort((a, b) => a - b); out.push([+((k + 0.5) * step).toFixed(3), +(r.length ? r[r.length >> 1] : 0).toFixed(3)]); }
  return out;
}
/** That profile's radius at y (linear between its rows). */
export const radiusAt = (prof, y) => {
  if (y <= prof[0][0]) return prof[0][1]; if (y >= prof.at(-1)[0]) return prof.at(-1)[1];
  for (let i = 1; i < prof.length; i++) if (prof[i][0] >= y) { const [y0, r0] = prof[i - 1], [y1, r1] = prof[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1); }
  return prof.at(-1)[1];
};
