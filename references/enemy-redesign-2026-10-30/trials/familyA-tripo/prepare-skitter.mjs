// #800 family A: the seedpod skitter's Tripo export (keep-skitter/tripo/model.glb, untouched, task 118d9422-…) made into
// the game's asset (skitter-lod.glb, skitter-texture.png, skitter-landmarks.json beside this script), by prep-kit.mjs's
// steps:
//
// 1. the game's frame (Tripo's +x ahead → +z), scaled to 0.55 m to the top of its shell (drawn ×1.75 in the game, GROWN
//    #741: 0.98 m, at the traveller's hip as the size floor asks; the reference's low long shell makes it 2.3 m long);
// 2. a 6,000-triangle LOD by geometry alone (a flock of eight: half the others' budget);
// 3. each triangle's part by geometry and colour: the eight legs cut out exactly on a capsule round each (measured) under
//    the rim, the shell, the cream underside (by its colour, the rim a crease); the painted eye dots painted out (the eyes
//    are their own parts on the head, they look at the traveller); one flat colour a part, the reference's;
// 4. COLOR_0 by part;
// 5. the landmarks the rig is fitted to, measured from the mesh (slices.mjs): each leg's hip under the rim, knee,
//    ankle and foot pad (the front, middle-front, middle-back and back pairs), the head plate's hinge, the eyes.
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/prepare-skitter.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud, segDist, splitAlong } from './prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-skitter/tripo/model.glb');
const TASK = '118d9422-ffa9-436d-8a27-b220f908afb4';
const HEIGHT = 0.55, TARGET = 6000;
/** The approved image's flat colours (measured off it): the shell and head, the cream underside, the brown legs (Tripo drew
 *  the reference's sage band under the rim cream: one part). */
export const PALETTE = { shell: '#cf8553', under: '#efe6c3', leg: '#b8703f' };

const F = await framed(IN, HEIGHT);
const T = (x, y, z) => F.toGame(x, y, z).map((a) => +a.toFixed(4));
// ------------------------------------------------------------------ the landmarks (Tripo's frame, measured; then the game's)
// (slices.mjs: the feet pads at y −0.21, x 0.45 / 0.16 / −0.18 / −0.33, |z| 0.18 / 0.31 / 0.29 / 0.185; each leg's
// column up to the rim at y −0.06 … −0.09, its hip in under it; the head plate ahead of the seam at x 0.25)
const LEGS = [[0.45, 0.18, 0.33, 0.13, 0.4], [0.16, 0.31, 0.13, 0.17, 0.16], [-0.18, 0.29, -0.13, 0.16, -0.17], [-0.33, 0.185, -0.26, 0.13, -0.3]];
const legs = [];
for (const [fx, fz, hx, hz, kx] of LEGS) for (const s of [1, -1]) legs.push({ side: -s, hip: T(hx, -0.07, s * hz), knee: T(kx, -0.09, s * (fz - 0.01)), ankle: T(fx, -0.165, s * fz), foot: T(fx, -0.21, s * fz), r: 0.034 * F.S });
const head = { hinge: T(0.25, -0.02, 0), seam: (0.25) * F.S };

// ------------------------------------------------------------------ the painted eyes: two black dots on the head plate's front
const c = [0, 0, 0], eyePts = [[], []];
for (let v = 0; v < F.n; v++) {
  const p = F.P.subarray(v * 3, v * 3 + 3); if (p[2] < head.seam + 0.1 || p[1] < 0.1) continue;
  sample(F.m.tex, F.m.UV[v * 2], F.m.UV[v * 2 + 1], c); const [, , l] = hsl(...c);
  if (l < 0.25) eyePts[p[0] > 0 ? 1 : 0].push([p[0], p[1], p[2]]);
}
const eyes = eyePts.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const nearEye = (p) => eyes.some((e) => e.n && Math.hypot(p[0] - e.at[0], p[1] - e.at[1], p[2] - e.at[2]) < 0.05);

// ------------------------------------------------------------------ decimated; each triangle's part
const lod = await decimate(F.m, F.P, F.N, TARGET);
const dropped = keepPieces(lod);
const legDist = (p) => Math.min(...legs.map((l) => Math.min(segDist(p, l.hip, l.knee), segDist(p, l.knee, l.ankle), segDist(p, l.ankle, l.foot)) - l.r));
const rim = (-0.06 + 0.21) * F.S;   // (game m: the shell's rim; under it the legs and the underside)
// (the legs cut out by geometry, exactly on their capsules under the rim: no shards of leg on the underside)
const cutLegs = splitAlong(lod, (p) => Math.min(-legDist(p), rim + 0.02 - p[1]));
const mesh = cutLegs.mesh;
const nt = mesh.I.length / 3, mid = (t) => [0, 1, 2].map((k) => (mesh.P[mesh.I[t * 3] * 3 + k] + mesh.P[mesh.I[t * 3 + 1] * 3 + k] + mesh.P[mesh.I[t * 3 + 2] * 3 + k]) / 3);
let part = new Array(nt);
for (let t = 0; t < nt; t++) {
  const m = mid(t), vs = [mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]];
  if (cutLegs.side[t]) { part[t] = 'leg'; continue; }
  const u = vs.reduce((s, v) => s + mesh.UV[v * 2], 0) / 3, q = vs.reduce((s, v) => s + mesh.UV[v * 2 + 1], 0) / 3;
  sample(F.m.tex, u, q, c); const [h, s, l] = hsl(...c);
  part[t] = l > 0.62 && s < 0.6 ? 'under' : 'shell';
}
// (the lone triangles folded into their neighbours': three passes, welded by position)
{ const key = (v) => `${Math.round(mesh.P[v * 3] * 1e4)},${Math.round(mesh.P[v * 3 + 1] * 1e4)},${Math.round(mesh.P[v * 3 + 2] * 1e4)}`, edges = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const a = key(mesh.I[t * 3 + k]), b = key(mesh.I[t * 3 + (k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a; if (!edges.has(e)) edges.set(e, []); edges.get(e).push(t); }
  const nb = Array.from({ length: nt }, () => []); for (const ts of edges.values()) for (const t of ts) for (const u of ts) if (u !== t) nb[t].push(u);
  for (let pass = 0; pass < 3; pass++) { const next = part.slice(); for (let t = 0; t < nt; t++) { if (part[t] === 'leg') continue; const n = nb[t].map((u) => part[u]); if (n.length && n.every((r) => r !== part[t])) { const cnt = {}; for (const r of n) cnt[r] = (cnt[r] ?? 0) + 1; next[t] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; } } part = next; } }
// ------------------------------------------------------------------ repainted (the trial's texture), the painted eyes out
const tex = await texture(F.m, 1024, 5);
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => (nearEye(p) && part[t] === 'shell' ? '!shell' : part[t]));
const png = await flatPng(paint, tex.W, tex.H);
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const COL = new Uint8Array(mesh.n * 4); part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });
const ORDER = ['shell', 'under', 'leg'], grouped = [], parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, grouped.length / 3 - first]; }
let top = 0, front = -Infinity; for (let v = 0; v < mesh.n; v++) { top = Math.max(top, mesh.P[v * 3 + 1]); front = Math.max(front, mesh.P[v * 3 + 2]); }
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +F.S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), front: +front.toFixed(4), rim: +rim.toFixed(4),
  legs, head, eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n })), removed: removed.length, parts, palette: PALETTE };
writeFileSync(join(HERE, 'skitter-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'skitter-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'seedpod skitter tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-skitter/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'skitter-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3 }, lod: { vertices: mesh.n, triangles: nt, decimated: lod.I.length / 3, split: cutLegs.split, dropped, error: +lod.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  scale: F.S, eyes: landmarks.eyes, parts, top, front }));
