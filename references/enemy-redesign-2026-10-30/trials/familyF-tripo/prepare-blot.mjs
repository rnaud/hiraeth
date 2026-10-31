// #800 family F: the ink blot's Tripo export (blob/tripo/model.glb, untouched, task ebbb5fc2-…) made into the game's asset
// (blot-lod.glb, blot-texture.png, blot-landmarks.json beside this script), by family A's prep-kit.mjs steps:
//
// 1. the game's frame (Tripo's +x ahead → +z), scaled to 1.05 m to the tip of its hook (the legacy drop's 0.9 m and
//    its splash: at the traveller's thigh, as before);
// 2. a 6,000-triangle LOD by geometry alone (a soft drop: the legacy's was 3k; the teacher comes two or three at a time);
// 3. each triangle's part by geometry, never by colour: the lilac flank (Tripo's grey-lilac side, the reference's light
//    on its left edge) on one side of the plane that best parts its texels from the ink's; the tan belly inside the ellipse
//    fitted to its texels on the front (its raised plate's crease); the rest ink. The painted eyes painted out (the eyes
//    are their own parts, they look at the traveller); one flat colour a part, the reference's (measured off it);
// 4. COLOR_0 by part;
// 5. the landmarks the body is built on, from the mesh: the eyes (where the painted ones were, their size), the belly's
//    ellipse, the mouth (where the spit gathers: the front under the eyes), the crown (where the hook's lag begins), the
//    base's radius.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/prepare-blot.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud, splitAlong } from '../familyA-tripo/prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/blob/tripo/model.glb');
const TASK = 'ebbb5fc2-d278-43be-ba37-4636776cdeef';
const HEIGHT = 1.05, TARGET = 6000;
/** The approved image's flat colours (measured off it): the ink, the lilac flank, the tan belly. */
export const PALETTE = { ink: '#24363b', shine: '#a28c97', belly: '#e3b279' };

const F = await framed(IN, HEIGHT);
const c = [0, 0, 0];
const colour = (v) => { sample(F.m.tex, F.m.UV[v * 2], F.m.UV[v * 2 + 1], c); return hsl(...c); };
const isEye = (h, s, l) => l > 0.72 && h > 30 && h < 70;
// (Tripo faced the picture's view, not the blot: its face looks 30° aside. Turned about y so the painted eyes sit either
// side of its front (+z), and moved so the middle of its foot is under its origin)
{ let ex = 0, ez = 0, n = 0;
  for (let v = 0; v < F.n; v++) { const p = F.P.subarray(v * 3, v * 3 + 3); if (p[2] < 0.12 || p[1] < 0.55) continue; if (isEye(...colour(v))) { ex += p[0]; ez += p[2]; n++; } }
  const a = Math.atan2(ex / n, ez / n), ca = Math.cos(-a), sa = Math.sin(-a);
  const turn = (A, v) => { const x = A[v * 3], z = A[v * 3 + 2]; A[v * 3] = x * ca + z * sa; A[v * 3 + 2] = -x * sa + z * ca; };
  for (let v = 0; v < F.n; v++) { turn(F.P, v); turn(F.N, v); }
  let fx = 0, fz = 0, fn = 0; for (let v = 0; v < F.n; v++) if (F.P[v * 3 + 1] < 0.08) { fx += F.P[v * 3]; fz += F.P[v * 3 + 2]; fn++; }
  for (let v = 0; v < F.n; v++) { F.P[v * 3] -= fx / fn; F.P[v * 3 + 2] -= fz / fn; }
  F.turned = +a.toFixed(4); F.moved = [+(fx / fn).toFixed(4), +(fz / fn).toFixed(4)]; }
// ------------------------------------------------------------------ the painted eyes: two cream ovals high on its front
const eyePts = [[], []];
for (let v = 0; v < F.n; v++) {
  const p = F.P.subarray(v * 3, v * 3 + 3); if (p[2] < 0.1 || p[1] < 0.55) continue;
  if (isEye(...colour(v))) eyePts[p[0] > 0 ? 1 : 0].push([p[0], p[1], p[2]]);
}
const eyes = eyePts.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const nearEye = (p) => eyes.some((e) => e.n && Math.hypot(p[0] - e.at[0], p[1] - e.at[1], p[2] - e.at[2]) < 0.075);

// ------------------------------------------------------------------ decimated
const lod = await decimate(F.m, F.P, F.N, TARGET);
const dropped = keepPieces(lod);
// the texels' roles at the LOD's vertices: lilac (grey, a little light), tan, ink
const roleAt = (v) => { const u = lod.UV[v * 2], w = lod.UV[v * 2 + 1]; sample(F.m.tex, u, w, c); const [h, s, l] = hsl(...c); return isEye(h, s, l) ? 'eye' : l > 0.5 && s > 0.4 && h > 22 && h < 48 ? 'belly' : l > 0.24 && s < 0.2 ? 'shine' : 'ink'; };
const P = (m, v) => [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]];
// the lilac flank: Tripo's grey-lilac half (its texels' side of the plane that parts them best from the ink's) is the
// reference's light on the drop's edge as its picture sees it, half a turn aside of the face; seen from the front (as the
// game sees it, coming at you) that half put a third of the face and one eye in lilac. The plane is turned out to its
// right flank (20° ahead of square) and moved out past the right eye, so from the front it is the reference's crescent
// down one edge, and both eyes sit on the ink, the right one at the crescent's edge as the picture draws it.
const mid = { shine: [0, 0, 0, 0], ink: [0, 0, 0, 0] };
for (let v = 0; v < lod.n; v++) { const r = roleAt(v); if (!mid[r]) continue; const p = P(lod, v); for (let k = 0; k < 3; k++) mid[r][k] += p[k]; mid[r][3]++; }
for (const r of ['shine', 'ink']) for (let k = 0; k < 3; k++) mid[r][k] /= mid[r][3];
const fitted = [mid.shine[0] - mid.ink[0], mid.shine[2] - mid.ink[2]], fl = Math.hypot(...fitted);
const nrm = [-Math.cos(0.35), 0, Math.sin(0.35)];
const along = (p) => p[0] * nrm[0] + p[2] * nrm[2];
const best = { cut: +along([-0.17, 0, 0.33]).toFixed(3), fitted: [+(fitted[0] / fl).toFixed(3), 0, +(fitted[1] / fl).toFixed(3)] };
// the belly's ellipse on its front: the tan texels' middle and spread in x, y (a uniform ellipse's edge at twice its σ)
const tan = []; for (let v = 0; v < lod.n; v++) if (roleAt(v) === 'belly') tan.push(P(lod, v));
const bm = [0, 1, 2].map((k) => tan.reduce((s, p) => s + p[k], 0) / tan.length);
let sxx = 0, syy = 0, sxy = 0; for (const p of tan) { sxx += (p[0] - bm[0]) ** 2; syy += (p[1] - bm[1]) ** 2; sxy += (p[0] - bm[0]) * (p[1] - bm[1]); }
sxx /= tan.length; syy /= tan.length; sxy /= tan.length;
const det = sxx * syy - sxy * sxy, inv = [syy / det, -sxy / det, sxx / det];
const bellyF = (p) => { if (p[2] < bm[2] - 0.13) return -1; const dx = p[0] - bm[0], dy = p[1] - bm[1]; return 1 - (inv[0] * dx * dx + 2 * inv[1] * dx * dy + inv[2] * dy * dy) / 4; };
// (the two cuts exactly on their surfaces: the belly's first, then the flank's plane on what is left)
const cutB = splitAlong(lod, bellyF);
const cutS = splitAlong(cutB.mesh, (p) => along(p) - best.cut);
const mesh = cutS.mesh, nt = mesh.I.length / 3;
const part = new Array(nt);
for (let t = 0; t < nt; t++) part[t] = cutB.side[cutS.from[t]] ? 'belly' : cutS.side[t] ? 'shine' : 'ink';
// ------------------------------------------------------------------ repainted (the trial's texture), the painted eyes out
const tex = await texture(F.m, 1024, 5);
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => (nearEye(p) && part[t] !== 'belly' ? '!' + part[t] : part[t]));
const png = await flatPng(paint, tex.W, tex.H);
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const COL = new Uint8Array(mesh.n * 4); part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });
const ORDER = ['ink', 'shine', 'belly'], grouped = [], parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, grouped.length / 3 - first]; }
// ------------------------------------------------------------------ the landmarks
let top = 0, front = -Infinity, base = 0;
for (let v = 0; v < mesh.n; v++) { const p = P(mesh, v); top = Math.max(top, p[1]); front = Math.max(front, p[2]); if (p[1] < 0.12) base = Math.max(base, Math.hypot(p[0], p[2])); }
// (the front surface's most forward point near (x, y))
const frontAt = (x, y, r = 0.03) => { let z = -Infinity; for (let v = 0; v < mesh.n; v++) { const p = P(mesh, v); if (Math.abs(p[0] - x) < r && Math.abs(p[1] - y) < r) z = Math.max(z, p[2]); } return z; };
const eyeY = (eyes[0].at[1] + eyes[1].at[1]) / 2, mx = (eyes[0].at[0] + eyes[1].at[0]) / 2;
const mouth = [+mx.toFixed(4), +(eyeY - 0.09).toFixed(4), +frontAt(mx, eyeY - 0.09).toFixed(4)];
const landmarks = { frame: 'game: +z ahead, +y up, metres, on y 0', scale: +F.S.toFixed(5), turned: F.turned, moved: F.moved, height: HEIGHT, top: +top.toFixed(4), front: +front.toFixed(4), base: +base.toFixed(4),
  eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n, surface: +frontAt(e.at[0], e.at[1], 0.02).toFixed(4) })),
  belly: { at: bm.map((x) => +x.toFixed(4)), cov: [sxx, sxy, syy].map((x) => +x.toFixed(6)) }, flank: { normal: [+nrm[0].toFixed(4), 0, +nrm[2].toFixed(4)], cut: best.cut, fitted: best.fitted },
  mouth, crown: [0.45, 0.85], removed: removed.length, parts, palette: PALETTE };
writeFileSync(join(HERE, 'blot-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'blot-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'ink blot tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/blob/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'blot-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3 }, lod: { vertices: mesh.n, triangles: nt, decimated: lod.I.length / 3, split: cutB.split + cutS.split, dropped, error: +lod.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  eyes: landmarks.eyes, belly: landmarks.belly, flank: landmarks.flank, mouth, parts, top, front, base }));
