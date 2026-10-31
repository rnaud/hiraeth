// #800 family F: the dune worm's Tripo export (dune-worm/tripo/model.glb, untouched, task 4cea24a8-…) made into the game's
// asset (worm-lod.glb, worm-texture.png, worm-landmarks.json beside this script), by family A's prep-kit.mjs steps:
//
// 1. the game's frame (Tripo drew it facing +z: kept), scaled to 2.6 m to the top of its reared head's crown (so the body is
//    the legacy worm's metre thick, 1.05 m across the neck; 3.7 m along its spine);
// 2. a 12,000-triangle LOD by geometry alone;
// 3. its spine measured (spine.mjs: a slab across the body from the tail's tip to the head's middle), and each triangle's
//    part by geometry: the cream belly on the inside of its curl (each point's angle round the spine from the belly's side,
//    under the edge fitted to the cream texels along the spine, smoothed; on the head only its chin), the cream crown on its head over the plane
//    under it, the turquoise mouth inside a cylinder round the mouth's axis, its dark throat inside a narrower one; the
//    rest the ochre body. The painted eye dots painted out (the eyes are their own parts, on the head that turns to the
//    traveller); one flat colour a part, the reference's (measured off it);
// 4. COLOR_0 by part;
// 5. the landmarks the rig is fitted to: the spine (tail to head, every 0.12 m), the head's middle, the mouth's centre,
//    axis and radius, the eyes, the crown's top.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/prepare-worm.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud, splitAlong } from '../familyA-tripo/prep-kit.mjs';
import { trackSpine } from './spine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/dune-worm/tripo/model.glb');
const TASK = '4cea24a8-4b47-4ec2-832e-8ab9dd745057';
const HEIGHT = 2.6, TARGET = 12000, STEP = 0.12;
/** The approved image's flat colours (measured off it): the ochre body, the cream belly and crown, the turquoise mouth, the throat. */
export const PALETTE = { body: '#e5bb68', belly: '#f1ebba', mouth: '#33927f', throat: '#0f1a12' };

const F = await framed(IN, HEIGHT, { ahead: 'z' });
const c = [0, 0, 0];
const colourAt = (uv, v) => { sample(F.m.tex, uv[v * 2], uv[v * 2 + 1], c); return hsl(...c); };
const P = (m, v) => [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]];
// ------------------------------------------------------------------ the spine, from the tail's tip to the head's middle
const tail = [0, 0, 0]; { let k = 0; for (let v = 0; v < F.n; v++) if (F.P[v * 3 + 2] < -1.45) { for (let j = 0; j < 3; j++) tail[j] += F.P[v * 3 + j]; k++; } for (let j = 0; j < 3; j++) tail[j] /= k; }
const spine = trackSpine(F.P, F.n, { start: tail, dir: [0, 0, 1], step: STEP, stop: (m) => m[1] > 2.05 });
const len = [0]; for (let i = 1; i < spine.length; i++) len.push(len[i - 1] + Math.hypot(...[0, 1, 2].map((j) => spine[i][j] - spine[i - 1][j])));
const head = spine[spine.length - 1];
/** A point's place on the spine: { s (m from the tail), at, T (the spine's heading there) }. */
function onSpine(p) {
  let best = { d: Infinity };
  for (let i = 1; i < spine.length; i++) {
    const a = spine[i - 1], b = spine[i], ab = [0, 1, 2].map((j) => b[j] - a[j]), L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2));
    const q = [0, 1, 2].map((j) => a[j] + ab[j] * t), d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (d < best.d) { const l = Math.sqrt(L2); best = { d, s: len[i - 1] + t * l, at: q, T: ab.map((x) => x / l) }; }
  }
  return best;
}
/** Its angle round the spine from the belly's side (the inside of the curl: down along the tail, forward up the neck). */
function angle(p, o = onSpine(p)) {
  const T = o.T, B = [0, -T[2], T[1]], bl = Math.hypot(...B), r = [0, 1, 2].map((j) => p[j] - o.at[j]);
  return Math.abs(Math.atan2(r[0], (r[1] * B[1] + r[2] * B[2]) / bl));
}
// ------------------------------------------------------------------ the mouth and the eyes, measured off the texels
const teal = [], dots = [[], []];
for (let v = 0; v < F.n; v++) {
  const p = P(F, v), [h, s, l] = colourAt(F.m.UV, v);
  if (h > 150 && h < 210 && s > 0.25 && l > 0.2) teal.push(p);
  if (l < 0.16 && p[1] > 1.9 && Math.abs(p[0]) > 0.3) dots[p[0] > 0 ? 1 : 0].push(p);
}
const mouthC = cloud(teal), mouth = { at: mouthC.at, axis: [0, 0, 1], r: +((mouthC.hi[0] - mouthC.lo[0]) / 2).toFixed(4) };
const eyes = dots.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const nearEye = (p) => eyes.some((e) => Math.hypot(p[0] - e.at[0], p[1] - e.at[1], p[2] - e.at[2]) < 0.07);
const axial = (p) => Math.hypot(p[0] - mouth.at[0], p[1] - mouth.at[1]);
// ------------------------------------------------------------------ decimated; the belly's edge along the spine
const lod = await decimate(F.m, F.P, F.N, TARGET);
const dropped = keepPieces(lod);
const BIN = 0.3, bins = Math.ceil(len[len.length - 1] / BIN) + 1, edge = new Array(bins).fill(null);
{ const pts = [];
  for (let v = 0; v < lod.n; v++) { const p = P(lod, v); if (axial(p) < mouth.r + 0.06 && p[2] > 1.2) continue; const [h, s, l] = colourAt(lod.UV, v); if (l < 0.18) continue; const o = onSpine(p); pts.push({ s: o.s, a: angle(p, o), cream: l > 0.7 }); }
  for (let b = 0; b < bins; b++) {
    const q = pts.filter((x) => Math.floor(x.s / BIN) === b); if (q.length < 20) continue;
    let best = { a: 0, wrong: Infinity };
    for (let a = 0; a <= Math.PI; a += 0.02) { const wrong = q.filter((x) => (x.a < a) !== x.cream).length; if (wrong < best.wrong) best = { a, wrong }; }
    edge[b] = best.a;
  }
  // (the bins with too few points take their neighbours'; then a 5-bin average)
  for (let b = 0; b < bins; b++) if (edge[b] === null) edge[b] = edge[b - 1] ?? edge.find((x) => x !== null);
  const sm = edge.map((_, b) => { const w = edge.slice(Math.max(0, b - 2), b + 3); return w.reduce((s, x) => s + x, 0) / w.length; });
  for (let b = 0; b < bins; b++) edge[b] = +sm[b].toFixed(4); }
const edgeAt = (s) => { const x = s / BIN - 0.5, b = Math.max(0, Math.min(bins - 2, Math.floor(x))), t = Math.max(0, Math.min(1, x - b)); return edge[b] * (1 - t) + edge[b + 1] * t; };
const CROWN = 2.4;   // (m: the crown's foot, on the top of the head)
const front = (p) => p[2] > 1.2 && p[1] > 1.6;
// (the cuts exactly on their surfaces, one after another: the belly, the crown, the mouth, the throat)
// (on the head the cream is its chin only, under the mouth, as the reference draws it: the head round the mouth ochre)
const chin = (p, o) => (o.s > len[len.length - 1] - 0.25 && p[2] > 0.9 ? mouth.at[1] - mouth.r * 0.7 - p[1] : Infinity);
const cut1 = splitAlong(lod, (p) => { if (front(p) && axial(p) < mouth.r + 0.08) return -1; const o = onSpine(p); return Math.min(edgeAt(o.s) - angle(p, o), chin(p, o)); });
const cut2 = splitAlong(cut1.mesh, (p) => (p[2] > 0.7 ? p[1] - CROWN : -1));
const cut3 = splitAlong(cut2.mesh, (p) => (front(p) ? mouth.r - axial(p) : -1));
const cut4 = splitAlong(cut3.mesh, (p) => (front(p) ? mouth.r * 0.45 - axial(p) : -1));
const mesh = cut4.mesh, nt = mesh.I.length / 3, part = new Array(nt);
for (let t = 0; t < nt; t++) {
  const t3 = cut4.from[t], t2 = cut3.from[t3], t1 = cut2.from[t2];
  part[t] = cut4.side[t] ? 'throat' : cut3.side[t3] ? 'mouth' : cut2.side[t2] || cut1.side[t1] ? 'belly' : 'body';
}
// ------------------------------------------------------------------ repainted (the trial's texture), the painted eyes out
const tex = await texture(F.m, 1024, 5);
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => (nearEye(p) ? '!' + part[t] : part[t]));
const png = await flatPng(paint, tex.W, tex.H);
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const COL = new Uint8Array(mesh.n * 4); part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });
const ORDER = ['body', 'belly', 'mouth', 'throat'], grouped = [], parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, grouped.length / 3 - first]; }
// ------------------------------------------------------------------ the landmarks
let top = 0, radius = 0; for (let v = 0; v < mesh.n; v++) { const p = P(mesh, v); top = Math.max(top, p[1]); radius = Math.max(radius, Math.abs(p[0])); }
// (the throat's floor: how deep the mouth goes, the teeth set inside its lip)
let deep = Infinity; for (let v = 0; v < mesh.n; v++) { const p = P(mesh, v); if (front(p) && axial(p) < mouth.r * 0.4) deep = Math.min(deep, p[2]); }
const landmarks = { frame: 'game: +z ahead, +y up, metres, on y 0', scale: +F.S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), radius: +radius.toFixed(4),
  spine, length: +len[len.length - 1].toFixed(4), head: head.map((x) => +x.toFixed(4)), mouth: { ...mouth, deep: +deep.toFixed(4) },
  eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n })), crown: CROWN, belly: edge, removed: removed.length, parts, palette: PALETTE };
writeFileSync(join(HERE, 'worm-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'worm-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'dune worm tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/dune-worm/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'worm-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3 }, lod: { vertices: mesh.n, triangles: nt, decimated: lod.I.length / 3, dropped, error: +lod.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  spine: spine.length, length: landmarks.length, head, mouth: landmarks.mouth, eyes: landmarks.eyes.map((e) => e.at), parts, top, radius, belly: edge }));
