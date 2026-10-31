// #800 family B: the storm ray's Tripo export (storm-ray/tripo/model.glb, untouched) made into the game's asset
// (tripo-lod.glb, flat-texture.png and landmarks.json beside this script), by the skill's recipe
// (.claude/skills/enemy-rework/references/tripo-rebuild.md section 2; the shared steps in ../flyer-tripo/prep-lib.mjs):
//
// 1. The loose shell Tripo added under it dropped (the drawn shadow on the ground, a flat disc); into the game's frame
//    (Tripo made it facing +z already, as the game does), LENGTH m from its nose to its tail's end, its belly on y = 0.
// 2. Each texel's role from its colour: the teal of its back and wings (Tripo's two), the cream of its belly and the wings'
//    undersides, the red-brown of the wing tips, the grey-green of the tail's underside (folded into the teal), the dark of
//    the mouth's crease, the tail's notch and the painted eyes.
// 3. Decimated to TARGET triangles by the geometry alone.
// 4. Cut by geometry: the tail across its root (a plane across the body behind the wings' trailing edge), split exactly
//    on it: the tail its own mesh in the game (its own painted bands). The wings are not cut: they bend at their roots in
//    the game's skin (weighted by geometry from the body to each wing over the root).
// 5. Repainted by part in the reference's flat colours (PALETTE: measured off the approved image): its back and wings
//    teal, its belly and the wings' undersides cream, the tips red-brown, the mouth's line and the tail's notch dark, the
//    painted eyes painted out (its own eyes in the game); the islands' gaps filled.
// 6. COLOR_0 from the repainted texture (the engines draw it).
// 7. Landmarks measured from the mesh: the body (its middle, half-width, its top), each wing's root (where it leaves the
//    body's top), its middle and tip, the tail's root, middle and end, the nose, the eyes (where the painted ones were).
//
//   node references/enemy-redesign-2026-10-30/trials/ray-tripo/prepare.mjs [--target 12000]
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExport, texelRoles, decimate, splitter, repaint, vertexColours, writeGlb, hex, hsl, lumOf, r4 } from '../flyer-tripo/prep-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/storm-ray/tripo/model.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000);
/** Nose to the tail's end (m): with its wings let down, about 3.4 m across (the sky ray's 4 m, with more body). */
export const LENGTH = 2.3;
/** One flat colour a role: the approved image's own (storm-ray/4fc2da68-…-0.png, read off its flat fills). */
export const PALETTE = { top: '#5f8578', under: '#e6d6aa', tip: '#a5523c', dark: '#1f2a26' };
const ROLE = ['top', 'under', 'tip', 'dark'];
const roleOfRGB = (r, g, b) => {
  const { h, l, s } = hsl(r, g, b);
  if (l < 42) return 3;
  if (h < 32 && s > 50) return 2;                 // (the red-brown tips)
  if (l > 150 && h >= 32 && h < 80) return 1;     // (cream)
  return 0;                                       // (the teals and the tail's grey-green)
};

// (the export's own shell, not the shadow disc Tripo drew under it: the biggest)
const src = await loadExport(IN, { ahead: 'z', size: { axis: 2, metres: LENGTH }, keep: (c, i) => i === 0 });
const T = await texelRoles(src.image.bytes, roleOfRGB, ROLE.length);
const lod = await decimate(src, TARGET);
const nv = lod.P.length / 3, I0 = lod.I;
const vrole = new Uint8Array(nv); for (let v = 0; v < nv; v++) vrole[v] = T.role[Math.min(T.H - 1, Math.floor(lod.UV[v * 2 + 1] * T.H)) * T.W + Math.min(T.W - 1, Math.floor(lod.UV[v * 2] * T.W))];
const used = new Uint8Array(nv); for (const v of I0) used[v] = 1;
const all = []; for (let v = 0; v < nv; v++) if (used[v]) all.push([lod.P[v * 3], lod.P[v * 3 + 1], lod.P[v * 3 + 2], vrole[v]]);
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];

// ------------------------------------------------------------------ the body, the wings, the tail (measured)
const zs = all.map((p) => p[2]), nose = Math.max(...zs), end = Math.min(...zs);
// the body: what lies near the middle line, low (under the wings' rise): its half-width by its cream belly
const belly = all.filter((p) => p[3] === 1 && p[1] < pct(all.map((q) => q[1]), 0.35));
const half = pct(belly.map((p) => Math.abs(p[0])), 0.97);
const bodyTop = pct(all.filter((p) => Math.abs(p[0]) < half * 0.3).map((p) => p[1]), 0.97);
const bodyMid = [0, median(belly.map((p) => p[1])), median(belly.map((p) => p[2]))];
// each wing: its tip the highest point a side; its root where it leaves the body (its vertices over the body's top half
// within the body's half-width, their middle)
const wings = [-1, 1].map((s) => {
  const q = all.filter((p) => s * p[0] > half * 0.5);
  const tip = q.reduce((a, p) => (p[1] > a[1] ? p : a));
  const rootV = q.filter((p) => s * p[0] < half * 1.05 && s * p[0] > half * 0.6 && p[1] > bodyMid[1] + (bodyTop - bodyMid[1]) * 0.4);
  const root = [s * pct(rootV.map((p) => s * p[0]), 0.5), median(rootV.map((p) => p[1])), median(rootV.map((p) => p[2]))];
  const mid = [0, 1, 2].map((i) => root[i] + (tip[i] - root[i]) * 0.5);
  return { side: s, root: r4(root), mid: r4(mid), tip: r4(tip.slice(0, 3)) };
});
// the tail: behind the wings' trailing edge, near the middle line
const wingsBack = pct(all.filter((p) => Math.abs(p[0]) > half * 1.2).map((p) => p[2]), 0.02);
const tailRootZ = Math.min(wingsBack, bodyMid[2] - (nose - bodyMid[2]) * 0.55);
const tailV = all.filter((p) => p[2] < tailRootZ && Math.abs(p[0]) < half);
const tail = { root: r4([0, median(tailV.filter((p) => p[2] > tailRootZ - 0.1).map((p) => p[1])), tailRootZ]), mid: r4([0, median(tailV.map((p) => p[1])), (tailRootZ + end) / 2]), end: r4([0, median(tailV.filter((p) => p[2] < end + 0.1).map((p) => p[1])), end]) };

// ------------------------------------------------------------------ the cut: the tail across its root
const S = splitter(lod);
const cut = S.split(Array.from(I0), (p) => tailRootZ - p[2] - (Math.abs(p[0]) > half * 1.3 ? 1 : 0), 'tail');
const I = Uint32Array.from([...cut.outside, ...cut.inside]);
const parts = { body: [0, cut.outside.length / 3], tail: [cut.outside.length / 3, cut.inside.length / 3] };

// ------------------------------------------------------------------ repainted
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]));
const removed = [];
const { paint, png, W, H } = await repaint({ V: S.V, I, T, PAL, paintOf: (t, role, p, n, inside, k) => {
  const key = ROLE[role];
  // (the painted eyes: dark on the head's sides, ahead of the wings, over the mouth's line)
  if (inside && p[2] > nose - (nose - bodyMid[2]) * 0.7 && p[1] > bodyMid[1] && Math.abs(n[0]) > 0.35 && lumOf(T.px[k * 3], T.px[k * 3 + 1], T.px[k * 3 + 2]) < 60) { removed.push(p); return 'top'; }
  return key;
} });
writeFileSync(join(HERE, 'flat-texture.png'), png);
const COL = vertexColours({ V: S.V, I, paint, W, H });
const eyes = [-1, 1].map((s) => { let q = removed.filter((p) => s * p[0] > 0); for (let it = 0; it < 3 && q.length; it++) { const m = [0, 1, 2].map((i) => median(q.map((p) => p[i]))); q = q.filter((p) => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) < 0.05); }
  if (q.length < 3) return null;
  const mid = [0, 1, 2].map((i) => q.reduce((t, p) => t + p[i], 0) / q.length), span = (i) => Math.max(...q.map((p) => p[i])) - Math.min(...q.map((p) => p[i]));
  return { side: s, at: r4(mid), size: [+span(2).toFixed(3), +span(1).toFixed(3)], texels: q.length }; });

const landmarks = { frame: 'game: +z ahead, +y up, metres, its belly on y 0', scale: +src.scale.toFixed(5), length: LENGTH,
  body: { mid: r4(bodyMid), half: +half.toFixed(4), top: +bodyTop.toFixed(4), nose: +nose.toFixed(4) }, wings, tail, eyes, parts, palette: PALETTE };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const out = { P: Float32Array.from(S.V.P), N: Float32Array.from(S.V.N), UV: Float32Array.from(S.V.UV) };
const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: COL }, indices: I, image: png, name: 'storm ray tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/storm-ray/tripo/model.glb', task: 'e9077ebe-b1ce-4d64-afcb-be364d3d44e0', triangles: I.length / 3, parts, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: src.sourceVertices, triangles: src.sourceTriangles }, lod: { vertices: S.count(), triangles: I.length / 3, parts, bytes: glb.length, sha: sha(glb) }, landmarks: { body: landmarks.body, wings, tail, eyes }, pngBytes: png.length }, null, 1));
