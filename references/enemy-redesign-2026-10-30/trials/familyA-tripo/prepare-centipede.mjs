// #800 family A: the drill-head centipede's Tripo export (centipede/tripo/model.glb, untouched, task 7a924a40-…) made
// into the game's asset (centipede-lod.glb, centipede-texture.png, centipede-landmarks.json beside this script), by
// prep-kit.mjs's steps:
//
// 1. the game's frame (Tripo drew it facing +z already), scaled to 2.4 m to the top of its reared head (its body 4.3 m
//    long, the legacy ring centipede's 4.9 m from its head to its tail, its tube as thick, 0.88 m against 0.92);
// 2. 12,000 triangles by geometry alone;
// 3. each triangle's part (the reference's flat colours, measured off the approved image: the salmon plates and head,
//    the dark teal under the plates, the cream underside): its texels' majority, then the lone triangles of another part
//    than all their neighbours folded in (a crease's specks); the head (over its neck, by geometry) its own part, the
//    painted slit eyes painted out (the eyes are their own parts on the head's halves, they look at the traveller);
// 4. COLOR_0 by part, exactly;
// 5. the landmarks the rig is fitted to, measured from the mesh (slices.mjs): the spine from the tail's tip up the neck
//    to the head's base (the body's middle at each length, the neck's at each height), the five pairs of legs (each
//    stub's hip under the plates, its knee, its foot pad on the ground), the head's base and middle, its halves' hinge,
//    the eyes.
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/prepare-centipede.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud } from './prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/centipede/tripo/model.glb');
const TASK = '7a924a40-1173-4983-8d6d-34bcc7efee6f';
const HEIGHT = 2.4, TARGET = 12000;
/** The approved image's flat colours (measured off it): the salmon plates, head and legs, the dark teal, the cream underside. */
export const PALETTE = { plate: '#d9876b', head: '#d9876b', dark: '#1f3a37', under: '#f2ead0' };

const F = await framed(IN, HEIGHT, { ahead: 'z' });
const T = (z, y, x = 0) => F.toGame(x, y, z).map((a) => +a.toFixed(4));
// ------------------------------------------------------------------ the landmarks (Tripo's frame, measured; then the game's)
// (slices.mjs along z: the body's middle at y −0.13 from z −0.3 to 0.22, the tail's cone falling to y −0.18 at its tip;
// along y: the neck's middle climbing from z 0.26, y −0.1 to z 0.4, y 0.06, the head over it to y 0.28; the feet pads at
// y −0.277, x ±0.16, five pairs at z 0.25, 0.127, 0.015, −0.104, −0.207)
const SPINE = [[-0.5, -0.18], [-0.42, -0.18], [-0.34, -0.16], [-0.26, -0.14], [-0.18, -0.135], [-0.1, -0.13], [-0.02, -0.13], [0.06, -0.13], [0.14, -0.13], [0.22, -0.12], [0.28, -0.09], [0.33, -0.04], [0.37, 0.01], [0.4, 0.06]];
const spine = SPINE.map(([z, y]) => T(z, y));
const legs = [];
for (const z of [0.25, 0.127, 0.015, -0.104, -0.207]) for (const s of [1, -1]) legs.push({ side: s, hip: T(z, -0.19, s * 0.115), knee: T(z, -0.235, s * 0.145), foot: T(z + 0.012, -0.277, s * 0.16), r: 0.035 * F.S });
const head = { base: T(0.395, 0.05), at: T(0.43, 0.17), hinge: [T(0.4, 0.12, 0.05), T(0.4, 0.12, -0.05)], from: (0.06 + 0.277) * F.S, split: 0.03 * F.S };

// ------------------------------------------------------------------ the painted eyes: dark slits on the head's front
const c = [0, 0, 0], eyePts = [[], []];
for (let v = 0; v < F.n; v++) {
  const p = F.P.subarray(v * 3, v * 3 + 3); if (p[1] < head.at[1] - 0.1 || p[2] < head.at[2] + 0.1) continue;
  sample(F.m.tex, F.m.UV[v * 2], F.m.UV[v * 2 + 1], c); const [, , l] = hsl(...c);
  if (l < 0.25 && Math.abs(p[0]) > 0.1) eyePts[p[0] > 0 ? 1 : 0].push([p[0], p[1], p[2]]);
}
const eyes = eyePts.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const nearEye = (p) => eyes.some((e) => e.n && Math.hypot(p[0] - e.at[0], p[1] - e.at[1], p[2] - e.at[2]) < 0.09);

// ------------------------------------------------------------------ decimated; each triangle's part
const mesh = await decimate(F.m, F.P, F.N, TARGET);
const dropped = keepPieces(mesh);
const nt = mesh.I.length / 3, roleOf = (rgb) => { const [h, s, l] = hsl(...rgb); return l < 0.3 ? 'dark' : (h > 30 && h < 70 && l > 0.6) || s < 0.25 ? 'under' : 'plate'; };
let part = new Array(nt);
for (let t = 0; t < nt; t++) {
  const vs = [mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]], votes = {};
  const uv = (w) => [vs.reduce((s, v, k) => s + mesh.UV[v * 2] * w[k], 0), vs.reduce((s, v, k) => s + mesh.UV[v * 2 + 1] * w[k], 0)];
  for (const w of [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]]) { const [u, q] = uv(w); sample(F.m.tex, u, q, c); const r = roleOf(c); votes[r] = (votes[r] ?? 0) + 1; }
  part[t] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}
// (the lone triangles folded into their neighbours': three passes, welded by position)
{ const key = (v) => `${Math.round(mesh.P[v * 3] * 1e4)},${Math.round(mesh.P[v * 3 + 1] * 1e4)},${Math.round(mesh.P[v * 3 + 2] * 1e4)}`, edges = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const a = key(mesh.I[t * 3 + k]), b = key(mesh.I[t * 3 + (k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a; if (!edges.has(e)) edges.set(e, []); edges.get(e).push(t); }
  const nb = Array.from({ length: nt }, () => []); for (const ts of edges.values()) for (const t of ts) for (const u of ts) if (u !== t) nb[t].push(u);
  for (let pass = 0; pass < 3; pass++) { const next = part.slice(); for (let t = 0; t < nt; t++) { const n = nb[t].map((u) => part[u]); if (n.length && n.every((r) => r !== part[t])) { const cnt = {}; for (const r of n) cnt[r] = (cnt[r] ?? 0) + 1; next[t] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; } } part = next; } }
// the head: its salmon over the neck's top (by geometry: over the head's base, ahead of the neck), its own part
for (let t = 0; t < nt; t++) {
  const m = [0, 1, 2].map((k) => (mesh.P[mesh.I[t * 3] * 3 + k] + mesh.P[mesh.I[t * 3 + 1] * 3 + k] + mesh.P[mesh.I[t * 3 + 2] * 3 + k]) / 3);
  if (part[t] === 'plate' && m[1] > head.from && m[2] > head.base[2] - 0.05) part[t] = 'head';
}
// ------------------------------------------------------------------ repainted (the trial's texture), the painted eyes out
const tex = await texture(F.m, 1024, 5);
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => (nearEye(p) && part[t] !== 'under' ? (part[t] === 'dark' ? '!head' : 'head') : part[t]));
for (let t = 0; t < nt; t++) { const m = [0, 1, 2].map((k) => (mesh.P[mesh.I[t * 3] * 3 + k] + mesh.P[mesh.I[t * 3 + 1] * 3 + k] + mesh.P[mesh.I[t * 3 + 2] * 3 + k]) / 3); if (part[t] === 'dark' && nearEye(m)) part[t] = 'head'; }
const png = await flatPng(paint, tex.W, tex.H);
// (COLOR_0 by part; a vertex two parts' takes its first triangle's: the parts are their own meshes in the game, coloured by material)
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const COL = new Uint8Array(mesh.n * 4); part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });
const ORDER = ['plate', 'head', 'dark', 'under'], grouped = [], parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, grouped.length / 3 - first]; }
let top = 0, front = -Infinity, back = Infinity; for (let v = 0; v < mesh.n; v++) { top = Math.max(top, mesh.P[v * 3 + 1]); front = Math.max(front, mesh.P[v * 3 + 2]); back = Math.min(back, mesh.P[v * 3 + 2]); }
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +F.S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), front: +front.toFixed(4), back: +back.toFixed(4),
  spine, legs, head, eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n })), removed: removed.length, parts, palette: PALETTE };
writeFileSync(join(HERE, 'centipede-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'centipede-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'drill-head centipede tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/centipede/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +mesh.error.toFixed(5) } });
writeFileSync(join(HERE, 'centipede-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3 }, lod: { vertices: mesh.n, triangles: nt, dropped, error: +mesh.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  scale: F.S, eyes: landmarks.eyes, parts, top, front, back }));
