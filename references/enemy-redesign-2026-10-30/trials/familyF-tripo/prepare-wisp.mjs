// #800 family F: the cinder wisp's Tripo export (keep-wisp/tripo/model.glb, untouched, task fbbea7ea-…) made into the game's
// ember wisp (wisp-lod.glb, wisp-texture.png, wisp-landmarks.json beside this script), by family A's prep-kit.mjs steps:
//
// 1. the bud alone: Tripo drew the picture's ground stain and the ember floating beside it as pieces of their own (dropped,
//    the largest piece kept); in the game's frame (Tripo's +x ahead → +z: the front petal with the eyes on it faces ahead),
//    its axis over the origin, its foot on y 0, scaled to 1.3 m tall (the legacy bud's 1.15 m petals over its cup);
// 2. a 12,000-triangle LOD by geometry alone;
// 3. each triangle's part by geometry: the four petals (front, left, back, right) cut apart on the two vertical planes
//    through the axis along their creases (each crease's azimuth measured where the petals part, its two opposite creases
//    on one plane), above the hinge ring where they join; the cup under that ring; Tripo's orange coal inside the bud
//    dropped (the game's own glowing coal takes its place: the ball is thrown from it). The painted eyes painted out (the
//    eyes are their own parts on the front petal, they look at the traveller); one flat colour a part, the reference's;
// 4. COLOR_0 by part;
// 5. the landmarks the rig is fitted to: the hinge ring (height, radius), each petal's middle azimuth, the coal (its
//    middle and radius), the eyes, the bud's widest radius and top.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/prepare-wisp.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud, splitAlong } from '../familyA-tripo/prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-wisp/tripo/model.glb');
const TASK = 'fbbea7ea-566b-4e57-9301-030774836659';
const HEIGHT = 1.3, TARGET = 12000;
/** The approved image's flat colours (measured off it): the teal-green petals, the darker cup. */
export const PALETTE = { petal: '#3d5c55', cup: '#1d3b32' };
const HINGE = 0.36;   // the hinge ring's height, a share of the bud's (where the petals' creases close)

const F = await framed(IN, 1.0);
const c = [0, 0, 0];
const hslAt = (UV, v) => { sample(F.m.tex, UV[v * 2], UV[v * 2 + 1], c); return hsl(...c); };
// ------------------------------------------------------------------ the bud alone, its axis over the origin, scaled
const full = { P: F.P, I: Uint32Array.from(F.m.I) }; const droppedPieces = keepPieces(full, 0.3);
const used = new Uint8Array(F.n); for (const i of full.I) used[i] = 1;
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < F.n; v++) if (used[v]) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], F.P[v * 3 + k]); hi[k] = Math.max(hi[k], F.P[v * 3 + k]); }
const S = HEIGHT / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
for (let v = 0; v < F.n; v++) { F.P[v * 3] = (F.P[v * 3] - cx) * S; F.P[v * 3 + 1] = (F.P[v * 3 + 1] - lo[1]) * S; F.P[v * 3 + 2] = (F.P[v * 3 + 2] - cz) * S; }
const P = (m, v) => [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]];
const az = (p) => Math.atan2(p[0], p[2]);
// ------------------------------------------------------------------ the creases: where the petals part (their radius least), high up
const BINS = 72, rad = new Array(BINS).fill(0);
for (let v = 0; v < F.n; v++) { if (!used[v]) continue; const p = P(F, v); if (p[1] < 0.62 * HEIGHT || p[1] > 0.78 * HEIGHT) continue; const b = Math.floor(((az(p) + Math.PI) / (2 * Math.PI)) * BINS) % BINS; rad[b] = Math.max(rad[b], Math.hypot(p[0], p[2])); }
// (the four deepest dips, each the middle of its run under half the widest)
const deep = rad.map((r, b) => ({ r, a: -Math.PI + (b + 0.5) * (2 * Math.PI / BINS) })).filter((x, b) => x.r < Math.max(...rad) * 0.6 && x.r <= rad[(b + BINS - 1) % BINS] && x.r <= rad[(b + 1) % BINS]);
const creases = [];
for (const d of deep.sort((a, b) => a.r - b.r)) if (creases.every((x) => Math.abs(Math.atan2(Math.sin(x - d.a), Math.cos(x - d.a))) > 0.8)) creases.push(d.a);
creases.splice(4); creases.sort((a, b) => a - b);
// (two planes through the axis, each through a pair of opposite creases: their mean direction)
const pairs = [[creases[0], creases[2]], [creases[1], creases[3]]].map(([a, b]) => { const m = Math.atan2(Math.sin(a) + Math.sin(b + Math.PI), Math.cos(a) + Math.cos(b + Math.PI)); return m; });
const planeN = pairs.map((a) => [Math.cos(a), 0, -Math.sin(a)]);   // (normal to the plane holding direction (sin a, 0, cos a))
// ------------------------------------------------------------------ the eyes and the coal
const eyePts = [[], []], coalPts = [];
for (let v = 0; v < F.n; v++) {
  if (!used[v]) continue; const p = P(F, v), [h, s, l] = hslAt(F.m.UV, v);
  if (l > 0.75 && h > 40 && h < 70 && p[2] > 0.3) eyePts[p[0] > cloudX() ? 1 : 0].push(p);
  if (h > 20 && h < 45 && s > 0.5 && l > 0.45 && Math.hypot(p[0], p[2]) < 0.5) coalPts.push(p);
}
function cloudX() { return 0; }
const eyes = eyePts.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const coal = cloud(coalPts), coalR = +Math.max(...coalPts.map((p) => Math.hypot(p[0] - coal.at[0], p[1] - coal.at[1], p[2] - coal.at[2]))).toFixed(4);
const nearEye = (p) => eyes.some((e) => e.n && Math.hypot(p[0] - e.at[0], p[1] - e.at[1], p[2] - e.at[2]) < 0.06);
// ------------------------------------------------------------------ decimated (the bud's triangles), the coal's dropped
const lod = await decimate({ I: full.I, UV: F.m.UV }, F.P, F.N, TARGET);
keepPieces(lod, 0.3);
{ const keep = [];
  for (let t = 0; t < lod.I.length / 3; t++) {
    const tri = [lod.I[t * 3], lod.I[t * 3 + 1], lod.I[t * 3 + 2]], m = [0, 1, 2].map((k) => tri.reduce((s, v) => s + lod.P[v * 3 + k], 0) / 3);
    const inCoal = Math.hypot(m[0] - coal.at[0], m[1] - coal.at[1], m[2] - coal.at[2]) < coalR * 1.05;
    const orange = tri.filter((v) => { const [h, s, l] = hslAt(lod.UV, v); return h > 18 && h < 48 && s > 0.45 && l > 0.4; }).length >= 2;
    if (!(inCoal && orange)) keep.push(...tri);
  }
  lod.dropped = lod.I.length / 3 - keep.length / 3; lod.I = Uint32Array.from(keep); }
const hingeY = HINGE * HEIGHT;
// (the cuts exactly on their surfaces: the hinge ring, then the two planes over it)
const cut0 = splitAlong(lod, (p) => p[1] - hingeY);
const dot = (p, n) => p[0] * n[0] + p[2] * n[2];
const cut1 = splitAlong(cut0.mesh, (p) => (p[1] > hingeY ? dot(p, planeN[0]) : -1));
const cut2 = splitAlong(cut1.mesh, (p) => (p[1] > hingeY ? dot(p, planeN[1]) : -1));
const mesh = cut2.mesh, nt = mesh.I.length / 3, part = new Array(nt);
// the petals' middles: the bisectors between neighbouring creases; each above-ring triangle by its quadrant
const mids = creases.map((a, i) => { const b = creases[(i + 1) % 4] + (i === 3 ? 2 * Math.PI : 0); return Math.atan2(Math.sin((a + b) / 2), Math.cos((a + b) / 2)); });
const NAMES = mids.map((m) => { const d = (x) => Math.abs(Math.atan2(Math.sin(m - x), Math.cos(m - x))); return d(0) < 0.8 ? 'front' : d(Math.PI / 2) < 0.8 ? 'left' : d(Math.PI) < 0.8 ? 'back' : 'right'; });
for (let t = 0; t < nt; t++) {
  const m = [0, 1, 2].map((k) => (mesh.P[mesh.I[t * 3] * 3 + k] + mesh.P[mesh.I[t * 3 + 1] * 3 + k] + mesh.P[mesh.I[t * 3 + 2] * 3 + k]) / 3);
  if (!cut0.side[cut1.from[cut2.from[t]]]) { part[t] = 'cup'; continue; }
  const a = az(m); let best = 0; mids.forEach((x, i) => { if (Math.abs(Math.atan2(Math.sin(a - x), Math.cos(a - x))) < Math.abs(Math.atan2(Math.sin(a - mids[best]), Math.cos(a - mids[best])))) best = i; });
  part[t] = NAMES[best];
}
// ------------------------------------------------------------------ repainted (the trial's texture), the painted eyes out
const tex = await texture(F.m, 1024, 5);
const roleColour = (q) => (q === 'cup' ? 'cup' : 'petal');
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => (nearEye(p) ? '!' + roleColour(part[t]) : roleColour(part[t])));
const png = await flatPng(paint, tex.W, tex.H);
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const COL = new Uint8Array(mesh.n * 4); part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[roleColour(q)], 255], mesh.I[t * 3 + k] * 4); });
const ORDER = ['cup', 'front', 'left', 'back', 'right'], grouped = [], parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, grouped.length / 3 - first]; }
// ------------------------------------------------------------------ the landmarks
let top = 0, widest = 0, ringR = 0;
for (let v = 0; v < mesh.n; v++) { const p = P(mesh, v); top = Math.max(top, p[1]); widest = Math.max(widest, Math.hypot(p[0], p[2])); if (Math.abs(p[1] - hingeY) < 0.02) ringR = Math.max(ringR, Math.hypot(p[0], p[2])); }
const petals = Object.fromEntries(NAMES.map((n, i) => [n, { az: +mids[i].toFixed(4) }]));
const landmarks = { frame: 'game: +z ahead, +y up, metres, its foot on y 0', scale: +S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), widest: +widest.toFixed(4),
  hinge: { y: +hingeY.toFixed(4), r: +ringR.toFixed(4) }, creases: creases.map((x) => +x.toFixed(4)), petals, coal: { at: coal.at, r: coalR },
  eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n })), removed: removed.length, parts, palette: PALETTE };
writeFileSync(join(HERE, 'wisp-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'wisp-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'cinder wisp tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-wisp/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'wisp-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3, piecesDropped: droppedPieces }, lod: { vertices: mesh.n, triangles: nt, coalDropped: lod.dropped, error: +lod.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  creases: landmarks.creases, petals, hinge: landmarks.hinge, coal: landmarks.coal, eyes: landmarks.eyes.map((e) => [e.at, e.texels]), parts, top, widest }));
