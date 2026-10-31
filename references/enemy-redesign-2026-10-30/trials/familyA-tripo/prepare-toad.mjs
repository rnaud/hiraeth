// #800 family A: the bellows toad's Tripo export (bellows-toad/tripo/model.glb, untouched, task 6183568d-…) made into
// the game's asset (toad-lod.glb, toad-texture.png, toad-landmarks.json beside this script), by prep-kit.mjs's steps:
//
// 1. the game's frame, scaled to the legacy toad's sitting height (2.2 m to the top of its head, plans/hopper-legacy.js);
// 2. 12,000 triangles by geometry alone;
// 3. repainted in the approved image's four flat colours (bellows-toad/c5a76758-…-0.png, measured off it): the sage skin,
//    the orange belly, the pale orange webbed feet, and the eyes' own (their parts): Tripo's dark creases under the
//    belly and round the haunches folded into the part round them, the painted eyes (a lid line, an orange iris) painted
//    out of the eye bumps (the eyes are their own parts on their own bones, they look at the traveller);
// 4. COLOR_0;
// 5. the landmarks the rig is fitted to, measured from the mesh (slices.mjs: the leg columns over each foot, the haunch's
//    ellipsoid), in the game's frame: each leg's hip, knee, ankle and foot (the arms first, then the hind legs), the
//    belly's ellipsoid (the bellows: its own bone, it breathes and swells), the head's (it turns to you), the eyes.
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/prepare-toad.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud, splitAlong, segDist } from './prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/bellows-toad/tripo/model.glb');
const TASK = '6183568d-3cf2-4acc-807f-fd7784f5c672';
const HEIGHT = 2.2, TARGET = 12000;
/** The approved image's flat colours (measured off it: the sage skin, the orange belly, the feet's paler orange). */
export const PALETTE = { skin: '#9bbb85', belly: '#f0bd72', toe: '#f2c27e', eye: '#e9a85a' };

const F = await framed(IN, HEIGHT);
const T = (x, y, z) => F.toGame(x, y, z).map((a) => +a.toFixed(4));
// ------------------------------------------------------------------ the landmarks (Tripo's frame, measured; then the game's)
// (slices.mjs at y −0.39 … 0.2: the feet at y −0.40; the front wrists' columns at x 0.205, |z| 0.195, up the belly's sides to
// y ~0.12; the hind ankles at x −0.22, |z| 0.275 under the haunch's back, the haunch an ellipsoid round x −0.07, y −0.13,
// |z| 0.33 with its front, the knee, at x 0.1; the hind feet forward and out from the ankle)
const legs = [];
for (const s of [1, -1]) legs.push({ side: -s, arm: true, hip: T(0.21, 0.1, s * 0.225), knee: T(0.185, -0.12, s * 0.222), ankle: T(0.205, -0.31, s * 0.197), foot: T(0.27, -0.405, s * 0.19), r: 0.06 * F.S });
for (const s of [1, -1]) legs.push({ side: -s, arm: false, hip: T(-0.2, -0.08, s * 0.24), knee: T(0.1, -0.12, s * 0.37), ankle: T(-0.22, -0.31, s * 0.285), foot: T(-0.1, -0.405, s * 0.36), r: 0.1 * F.S, rShin: 0.075 * F.S });
// (the game's x is −Tripo z: leg 0 and 2 on the game's −x side (side −1), 1 and 3 on +x)

// ------------------------------------------------------------------ the eyes: the painted ones on the head's top (pale-green bumps)
const c = [0, 0, 0], eyePts = [[], []];
for (let v = 0; v < F.n; v++) {
  const p = F.P.subarray(v * 3, v * 3 + 3); if (p[1] < 1.9 || p[2] < 0.55) continue;
  sample(F.m.tex, F.m.UV[v * 2], F.m.UV[v * 2 + 1], c); const [h, , l] = hsl(...c);
  if (l < 0.3 || (h > 15 && h < 55)) eyePts[p[0] > 0 ? 1 : 0].push([p[0], p[1], p[2]]);
}
const eyes = eyePts.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const nearEye = (p) => eyes.some((e) => e.n && Math.hypot(p[0] - e.at[0], p[1] - e.at[1], p[2] - e.at[2]) < 0.16);

// ------------------------------------------------------------------ decimated; the parts cut by geometry
const lod = await decimate(F.m, F.P, F.N, TARGET);
const dropped = keepPieces(lod);
/** How far inside a leg's capsule p is (m: under 0 inside). */
const legDist = (p) => Math.min(...legs.map((l) => Math.min(segDist(p, l.hip, l.knee) - l.r, segDist(p, l.knee, l.ankle) - (l.rShin ?? l.r), segDist(p, l.ankle, l.foot) - (l.rShin ?? l.r))));
// the belly's edge, by geometry: the orange of the export's texture only says roughly where it is (its edge ragged), so
// per height its angle round the body's upright axis (from the front), the share's best split, smoothed into one curve
const orange = new Uint8Array(lod.n);
for (let v = 0; v < lod.n; v++) { sample(F.m.tex, lod.UV[v * 2], lod.UV[v * 2 + 1], c); const [h, s, l] = hsl(...c); orange[v] = l > 0.3 && h < 57 && s >= 0.12 ? 1 : 0; }
const BIN = 0.06, Y0 = 0.3, Y1 = 2.16, nb = Math.round((Y1 - Y0) / BIN);
const mids = new Float64Array(nb), raw = new Float64Array(nb).fill(NaN);
for (let b = 0; b < nb; b++) {
  const y0 = Y0 + b * BIN, q = [];
  for (let v = 0; v < lod.n; v++) { const p = [lod.P[v * 3], lod.P[v * 3 + 1], lod.P[v * 3 + 2]]; if (p[1] < y0 || p[1] >= y0 + BIN || legDist(p) < 0.03) continue; q.push([p, orange[v]]); }
  if (q.length < 20) continue;
  const zs = q.map(([p]) => p[2]); mids[b] = (Math.min(...zs) + Math.max(...zs)) / 2;
  const at = q.map(([p, o]) => [Math.abs(Math.atan2(p[0], p[2] - mids[b])), o]).sort((x, y) => x[0] - y[0]);
  // (the angle that best splits orange inside from green outside)
  let best = 0, err = at.filter(([, o]) => o).length, e = err;
  for (let i = 0; i < at.length; i++) { e += at[i][1] ? -1 : 1; if (e < err) { err = e; best = (at[i][0] + (at[i + 1]?.[0] ?? Math.PI)) / 2; } }
  raw[b] = at.some(([, o]) => o) ? best : 0;
}
// (smoothed: a five-bin running mean; the chin, where the share falls to none, closes the curve)
const A = Array.from(raw, (_, b) => { const w = [-2, -1, 0, 1, 2].map((d) => raw[b + d]).filter(Number.isFinite); return w.length ? w.reduce((s, x) => s + x, 0) / w.length : 0; });
const Ai = (y) => { const u = (y - Y0) / BIN - 0.5, b = Math.floor(u), t = u - b, at = (k) => A[Math.max(0, Math.min(nb - 1, k))]; return at(b) * (1 - t) + at(b + 1) * t; };
const Mi = (y) => { const u = (y - Y0) / BIN - 0.5, b = Math.max(0, Math.min(nb - 2, Math.floor(u))), t = Math.max(0, Math.min(1, u - b)); return mids[b] * (1 - t) + mids[b + 1] * t; };
const FOOT_TOP = 0.17;   // (game m: under it the webbed feet, the toes' orange)
const footF = (p) => FOOT_TOP - p[1];
const bellyF = (p) => (p[1] < Y0 - 0.2 ? -1 : Math.min(Ai(p[1]) - Math.abs(Math.atan2(p[0], p[2] - Mi(p[1]))), legDist(p)));
const s1 = splitAlong(lod, footF), s2 = splitAlong(s1.mesh, bellyF, (t) => !s1.side[t]);
const mesh = s2.mesh, part = s2.side.map((b, t) => (s1.side[s2.from[t]] ? 'toe' : b ? 'belly' : 'skin'));
// ------------------------------------------------------------------ repainted: one flat colour a part, the painted eyes out
const tex = await texture(F.m, 1024, 5);
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => {
  const [h, , l] = hsl(...rgb);
  if (part[t] === 'skin' && nearEye(p) && p[1] > 1.85 && (l < 0.3 || (h > 15 && h < 55))) return '!skin';   // (the painted eye: out)
  return part[t];
});
const png = await flatPng(paint, tex.W, tex.H);
// (COLOR_0 by part, exactly: no vertex is two parts', the cut's own made twice)
const COL = new Uint8Array(mesh.n * 4), PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });

// ------------------------------------------------------------------ the belly and the head, measured from the repainted mesh
const bellyPts = [], headPts = [];
for (let v = 0; v < mesh.n; v++) {
  const p = [mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]], col = [COL[v * 4], COL[v * 4 + 1], COL[v * 4 + 2]];
  const isBelly = col[0] === 0xf0 && col[1] === 0xbd && mesh.N[v * 3 + 2] > 0.2;   // (its front: the bellows)
  if (isBelly) bellyPts.push(p);
  if (p[1] > 1.72) headPts.push(p);
}
const belly = cloud(bellyPts), head = cloud(headPts);
let top = 0, front = -Infinity; for (let v = 0; v < mesh.n; v++) { top = Math.max(top, mesh.P[v * 3 + 1]); front = Math.max(front, mesh.P[v * 3 + 2]); }
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +F.S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), front: +front.toFixed(4),
  belly: { edge: A.map((x) => +x.toFixed(4)), mids: Array.from(mids, (x) => +x.toFixed(4)), y0: Y0, bin: BIN }, legs, eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n })), removed: removed.length, bellyBox: belly, head, footTop: FOOT_TOP, palette: PALETTE };
writeFileSync(join(HERE, 'toad-texture.png'), png);
// (the triangles grouped by part, skin, belly, toes, each its own mesh in the game: landmarks.parts [first, count])
const ORDER = ['skin', 'belly', 'toe'], grouped = [];
landmarks.parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); landmarks.parts[k] = [first, grouped.length / 3 - first]; }
writeFileSync(join(HERE, 'toad-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'bellows toad tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/bellows-toad/tripo/model.glb', task: TASK, triangles: mesh.I.length / 3, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'toad-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3 }, lod: { vertices: mesh.n, triangles: mesh.I.length / 3, decimated: lod.I.length / 3, split: s1.split + s2.split, dropped, error: +lod.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  scale: F.S, eyes: landmarks.eyes, belly, head: { lo: head.lo, hi: head.hi }, top, front, parts: landmarks.parts, pngBytes: png.length }));
