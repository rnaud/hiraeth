// #800 family B: the cloud jelly's Tripo export (cloud-jelly/tripo/model.glb, untouched) made into the game's asset
// (tripo-lod.glb, flat-texture.png and landmarks.json beside this script), by the skill's recipe
// (.claude/skills/enemy-rework/references/tripo-rebuild.md section 2; the shared steps in ../flyer-tripo/prep-lib.mjs):
//
// 1. Into the game's frame (Tripo: +x ahead; the game: +z), HEIGHT m tall, the lanterns' feet on y = 0.
// 2. Each texel's role from its colour: the cap's cream (Tripo's three creams), the green of the stems, the arms and the
//    skirt under the cap, the salmon of the three lanterns (two shades), the dark of the crease under the cap, the
//    painted eyes and the lanterns' little dark tips.
// 3. Decimated to TARGET triangles by the geometry alone.
// 4. Cut by geometry (never by colour): the cap along its lip, the lowest of its cream round it (a Fourier curve of order
//    4 through the lowest cream point per azimuth, a hair up), flood filled from the crown; each lantern's bulb across
//    its neck (a plane normal to the lantern's axis, at the top of its bulb). Triangles written grouped by part: the cap,
//    the three bulbs, then the rest (the skirt, the stems and the two curled arms: one skinned mesh in the game).
// 5. Repainted by part in the reference's flat colours (PALETTE: measured off the approved image): the cap all cream
//    (the painted eyes painted out: they are their own parts in the game), the skirt and stems and arms green with the
//    crease dark, the bulbs salmon with their dark tips; the islands' gaps filled.
// 6. COLOR_0 from the repainted texture (the engines draw it).
// 7. Landmarks measured from the mesh: the lip (mean height, its curve), the crown, the eyes (where the painted ones
//    were, their size), each arm's root and middle, each lantern's root under the cap, its bulb's top, middle and
//    bottom, and its axis.
//
//   node references/enemy-redesign-2026-10-30/trials/jelly-tripo/prepare.mjs [--target 12000]
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExport, texelRoles, decimate, splitter, repaint, vertexColours, fourier, writeGlb, hex, hsl, lumOf, r4 } from '../flyer-tripo/prep-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/cloud-jelly/tripo/model.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000);
/** Its height, the cap's crown over the lanterns' tips (m): the old lantern jelly's drawn 2.42 m, its bell 2.3 m across. */
export const HEIGHT = 2.6;
/** One flat colour a role: the approved image's own (cloud-jelly/0cdfba00-…-1.png, read off its flat fills). */
export const PALETTE = { cap: '#efdcb4', green: '#8fa984', bulb: '#e3a07e', dark: '#2a2a22' };
const ROLE = ['cap', 'green', 'bulb', 'dark'];
const roleOfRGB = (r, g, b) => {
  const { h, l, s } = hsl(r, g, b);
  if (l < 58) return 3;
  if (h >= 62 && h < 170 && s > 12) return 1;
  if (h < 34) return 2;
  return 0;
};

const src = await loadExport(IN, { ahead: 'x', size: { axis: 1, metres: HEIGHT } });
const T = await texelRoles(src.image.bytes, roleOfRGB, ROLE.length);
const lod = await decimate(src, TARGET);
const nv = lod.P.length / 3, I0 = lod.I;
const vrole = new Uint8Array(nv); for (let v = 0; v < nv; v++) vrole[v] = T.role[Math.min(T.H - 1, Math.floor(lod.UV[v * 2 + 1] * T.H)) * T.W + Math.min(T.W - 1, Math.floor(lod.UV[v * 2] * T.W))];
const at = (v) => [lod.P[v * 3], lod.P[v * 3 + 1], lod.P[v * 3 + 2]];

// ------------------------------------------------------------------ the lanterns: three bulbs of salmon (k-means on the ground plan)
const bulbV = []; for (let v = 0; v < nv; v++) if (vrole[v] === 2) bulbV.push(v);
let cent = [[0, 0, 0.4], [-0.5, 0, -0.3], [0.5, 0, -0.3]];   // (seeds: the front one, the back two: the side view's)
const own = new Uint8Array(nv);
for (let it = 0; it < 20; it++) {
  const s = cent.map(() => [0, 0, 0]);
  for (const v of bulbV) { const p = at(v); let b = 0, d = Infinity; cent.forEach((c, k) => { const e = (p[0] - c[0]) ** 2 + (p[2] - c[2]) ** 2; if (e < d) { d = e; b = k; } }); own[v] = b; s[b][0] += p[0]; s[b][1] += p[2]; s[b][2]++; }
  cent = s.map((x, k) => (x[2] ? [x[0] / x[2], 0, x[1] / x[2]] : cent[k]));
}
// (by x: the two back ones either side, the front one between)
const lanterns = cent.map((c, k) => {
  const ps = bulbV.filter((v) => own[v] === k).map(at);
  const top = Math.max(...ps.map((p) => p[1])), bot = Math.min(...ps.map((p) => p[1]));
  const ring = (y0, y1) => { const q = ps.filter((p) => p[1] >= y0 && p[1] <= y1); return [0, 2].map((i) => q.reduce((t, p) => t + p[i], 0) / (q.length || 1)); };
  const [tx, tz] = ring(top - 0.08, top), [mx, mz] = ring((top + bot) / 2 - 0.05, (top + bot) / 2 + 0.05);
  const radius = Math.max(...ps.filter((p) => Math.abs(p[1] - (top + bot) / 2) < 0.05).map((p) => Math.hypot(p[0] - mx, p[2] - mz)));
  return { k, top: [tx, top, tz], mid: [mx, (top + bot) / 2, mz], bottom: [mx, bot, mz], radius };
}).sort((a, b) => a.mid[0] - b.mid[0]);

// ------------------------------------------------------------------ the cap's lip: the lowest cream round it
const cz = 0, BINS = 48, low = Array.from({ length: BINS }, () => null);
let crown = 0;
for (let v = 0; v < nv; v++) {
  const [x, y, z] = at(v); if (y > lod.P[crown * 3 + 1]) crown = v;
  if (vrole[v] !== 0 || y < lanterns[0].top[1]) continue;
  const a = Math.atan2(x, z - cz), b = Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS) % BINS, r = Math.hypot(x, z - cz);
  if (r < 0.45) continue;   // (the cap's outer skirt, not a stray cream fleck under its middle)
  if (!low[b] || y < low[b].y) low[b] = { a, y, r };
}
let pts = low.filter(Boolean), lip = fourier(pts, 'y', 4);
for (let round = 0; round < 2; round++) { pts = pts.filter((p) => Math.abs(p.y - lip.at(p.a)) < 0.08); lip = fourier(pts, 'y', 4); }
const LIP_UP = 0.015;
const lipMean = pts.reduce((t, p) => t + lip.at(p.a), 0) / pts.length + LIP_UP;

// ------------------------------------------------------------------ the arms: the green curls either side at the front,
// their tops rising over the lip (the cap's cut goes round them: a sphere a little bigger than the curl)
const armV = [-1, 1].map((s) => { const q = []; for (let v = 0; v < nv; v++) { const p = at(v); if (vrole[v] === 1 && s * p[0] > 0.78 && p[2] > 0.3 && p[1] < lipMean - 0.02) q.push(p); } return q; });
const arms = armV.map((q, i) => {
  const s = i ? 1 : -1, mid = [0, 1, 2].map((k) => q.reduce((t, p) => t + p[k], 0) / q.length);
  const inner = q.filter((p) => s * p[0] < 0.86), root = [0, 1, 2].map((k) => inner.reduce((t, p) => t + p[k], 0) / (inner.length || 1));
  const ds = q.map((p) => Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2])).sort((x, y) => x - y);
  return { side: s, root: r4(root), mid: r4(mid), radius: +ds[Math.floor(ds.length * 0.9)].toFixed(3) };
});
const ARM_PAD = 0.04;
const armF = (p) => Math.min(...arms.map((a) => Math.hypot(p[0] - a.mid[0], p[1] - a.mid[1], p[2] - a.mid[2]) - a.radius - ARM_PAD));
const capF = (p) => Math.min(p[1] - (lip.at(Math.atan2(p[0], p[2] - cz)) + LIP_UP), armF(p));

// ------------------------------------------------------------------ the cut: the cap, then each bulb across its neck
const S = splitter(lod);
// the cap: flood filled from the crown over its side of the curve, then split exactly on it
const weld = new Int32Array(nv); { const seen = new Map(); for (let v = 0; v < nv; v++) { const k = at(v).map((x) => Math.round(x * 2e4)).join(); if (!seen.has(k)) seen.set(k, v); weld[v] = seen.get(k); } }
const F = new Float32Array(nv); for (let v = 0; v < nv; v++) F[v] = capF(at(v));
const nT = I0.length / 3, triOf = new Map();
for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const w = weld[I0[t * 3 + k]]; if (!triOf.has(w)) triOf.set(w, []); triOf.get(w).push(t); }
const reach = new Uint8Array(nT), queue = [...triOf.get(weld[crown])]; for (const t of queue) reach[t] = 1;
while (queue.length) { const t = queue.pop(); for (let k = 0; k < 3; k++) { const v = I0[t * 3 + k]; if (F[v] <= 0) continue; for (const u of triOf.get(weld[v])) if (!reach[u]) { reach[u] = 1; queue.push(u); } } }
const reached = [], rest0 = [];
for (let t = 0; t < nT; t++) (reach[t] ? reached : rest0).push(I0[t * 3], I0[t * 3 + 1], I0[t * 3 + 2]);
const capCut = S.split(reached, capF, 'lip');
const capIdx = capCut.inside;
let rest = [...rest0, ...capCut.outside];
// each lantern: its stem traced up from the bulb's top toward the skirt under the cap (green slabs 6 cm deep, each
// within 0.18 m of the last one's middle, stopping short of the skirt), its root over the last, just under the lip; its
// axis from there to the bulb's middle; its neck a little down the bulb (the stem's ragged collar stays on the stem)
const greenV = []; for (let v = 0; v < nv; v++) if (vrole[v] !== 2) greenV.push(at(v));
for (const L of lanterns) {
  let c = [L.top[0], L.top[2]], y = L.top[1];
  const path = [];
  while (y < lipMean - 0.14) {
    const q = greenV.filter((p) => p[1] >= y && p[1] < y + 0.06 && Math.hypot(p[0] - c[0], p[2] - c[1]) < 0.18);
    if (q.length < 2) break;
    c = [q.reduce((t, p) => t + p[0], 0) / q.length, q.reduce((t, p) => t + p[2], 0) / q.length];
    y += 0.06; path.push([c[0], y, c[1]]);
  }
  L.root = [path.at(-1)?.[0] ?? L.top[0], lipMean - 0.04, path.at(-1)?.[2] ?? L.top[2]];
  L.stem = path.filter((_, i) => i % 3 === 0).map(r4);
  const ax = [0, 1, 2].map((i) => L.mid[i] - L.root[i]), l = Math.hypot(...ax); L.axis = ax.map((x) => x / l);
  L.neck = L.top.map((x, i) => x + L.axis[i] * 0.06);
}
const bulbIdx = lanterns.map((L) => {
  const F2 = (p) => (p[0] - L.neck[0]) * L.axis[0] + (p[1] - L.neck[1]) * L.axis[1] + (p[2] - L.neck[2]) * L.axis[2];   // (> 0 past the neck, down the axis)
  // (only the triangles near this lantern's column)
  const near = [], far = [];
  for (let t = 0; t < rest.length; t += 3) {
    const c = [0, 1, 2].map((i) => (S.V.P[rest[t] * 3 + i] + S.V.P[rest[t + 1] * 3 + i] + S.V.P[rest[t + 2] * 3 + i]) / 3);
    (Math.hypot(c[0] - L.mid[0], c[2] - L.mid[2]) < L.radius + 0.12 && c[1] < L.top[1] + 0.12 ? near : far).push(rest[t], rest[t + 1], rest[t + 2]);
  }
  const cut = S.split(near, F2, `neck${L.k}`);
  rest = [...far, ...cut.outside];
  return cut.inside;
});
const I = Uint32Array.from([...capIdx, ...bulbIdx.flat(), ...rest]);
const parts = { cap: [0, capIdx.length / 3] };
let first = capIdx.length / 3;
bulbIdx.forEach((b, k) => { parts[`bulb${k}`] = [first, b.length / 3]; first += b.length / 3; });
parts.skin = [first, rest.length / 3];
const partOf = (t) => (t < parts.cap[1] ? 'cap' : t < parts.skin[0] ? 'bulb' : 'skin');

// ------------------------------------------------------------------ repainted
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]));
const removed = [];
const { paint, png, W, H } = await repaint({ V: S.V, I, T, PAL, paintOf: (t, role, p, n, inside, k) => {
  const part = partOf(t), key = ROLE[role];
  // (the cap all cream: its painted eyes out; they are dark on the front lobe's face, over the dark crease under its edge)
  if (part === 'cap') { if (inside && lumOf(T.px[k * 3], T.px[k * 3 + 1], T.px[k * 3 + 2]) < 80 && n[2] > 0.3 && p[1] > lipMean + 0.08) removed.push(p); return 'cap'; }
  if (part === 'bulb') return key === 'dark' ? 'dark' : key === 'green' ? 'green' : 'bulb';
  // (the skin: the skirt, stems and arms green, the crease dark; nothing cream or salmon left on it)
  if (key === 'dark') return 'dark';
  if (armF(p) < 0.02) return 'green';   // (the arms all green, their tops over the lip too)
  if (key === 'bulb') return p[1] < lanterns[0].top[1] + 0.02 ? 'bulb' : 'green';
  return key === 'cap' ? (p[1] > lipMean - 0.03 ? 'dark' : 'green') : 'green';
} });
writeFileSync(join(HERE, 'flat-texture.png'), png);
const COL = vertexColours({ V: S.V, I, paint, W, H, order: [...Array.from({ length: I.length / 3 - parts.cap[1] }, (_, k) => k + parts.cap[1]), ...Array.from({ length: parts.cap[1] }, (_, k) => k)], own: (t) => (t < parts.cap[1] ? PAL.cap : null) });
// the eyes where they were painted: each side's removed texels, their middle and size
// the eyes where they were painted: the removed texels in two by their x (2-means), each one's middle and size
let ex = [Math.min(...removed.map((p) => p[0])), Math.max(...removed.map((p) => p[0]))];
for (let it = 0; it < 12; it++) { const g = [[], []]; for (const p of removed) g[Math.abs(p[0] - ex[0]) < Math.abs(p[0] - ex[1]) ? 0 : 1].push(p[0]); ex = g.map((q, k) => (q.length ? q.reduce((t, x) => t + x, 0) / q.length : ex[k])); }
const median = (q, i) => q.map((p) => p[i]).sort((x, y) => x - y)[q.length >> 1];
// (each kept to the texels within 7 cm of its median: the crease's dark specks along the lip dropped)
const eyes = [0, 1].map((k) => { let q = removed.filter((p) => (Math.abs(p[0] - ex[0]) < Math.abs(p[0] - ex[1]) ? 0 : 1) === k);
  for (let it = 0; it < 3 && q.length; it++) { const m = [0, 1, 2].map((i) => median(q, i)); q = q.filter((p) => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) < 0.07); }
  if (q.length < 3) return null;
  const mid = [0, 1, 2].map((i) => q.reduce((t, p) => t + p[i], 0) / q.length), span = (i) => Math.max(...q.map((p) => p[i])) - Math.min(...q.map((p) => p[i]));
  return { side: k ? 1 : -1, at: r4(mid), size: [+span(0).toFixed(3), +span(1).toFixed(3)], texels: q.length }; });

const landmarks = { frame: 'game: +z ahead, +y up, metres, the lanterns\' tips on y 0', scale: +src.scale.toFixed(5), height: HEIGHT,
  crown: +lod.P[crown * 3 + 1].toFixed(4), lip: { y: +lipMean.toFixed(4), up: LIP_UP, order: 4, co: r4(lip.co), note: 'the cut: y = c0 + Σ ck cos(ka) + sk sin(ka) + up, a = atan2(x, z)' },
  eyes, arms, lanterns: lanterns.map((L) => ({ stem: L.stem, root: r4(L.root), top: r4(L.top), neck: r4(L.neck), mid: r4(L.mid), bottom: r4(L.bottom), axis: r4(L.axis), radius: +L.radius.toFixed(3) })),
  parts, palette: PALETTE };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const out = { P: Float32Array.from(S.V.P), N: Float32Array.from(S.V.N), UV: Float32Array.from(S.V.UV) };
const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: COL }, indices: I, image: png, name: 'cloud jelly tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/cloud-jelly/tripo/model.glb', task: 'b9a1a819-c283-435b-b7e1-9181a3f2770c', triangles: I.length / 3, parts, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: src.sourceVertices, triangles: src.sourceTriangles }, lod: { vertices: S.count(), triangles: I.length / 3, parts, bytes: glb.length, sha: sha(glb) }, lip: { points: pts.length, y: lipMean }, eyes, arms, lanterns: landmarks.lanterns, pngBytes: png.length }, null, 1));
