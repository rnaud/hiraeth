// #800 family B: the lamp moth's Tripo export (lamp-moth/tripo/model.glb, untouched) made into the game's asset
// (tripo-lod.glb, flat-texture.png and landmarks.json beside this script), by the skill's recipe
// (.claude/skills/enemy-rework/references/tripo-rebuild.md section 2; the shared steps in ../flyer-tripo/prep-lib.mjs):
//
// 1. Into the game's frame (Tripo: +x ahead; the game: +z), SPAN m from wing tip to wing tip, its feet on y = 0.
// 2. Each texel's role from its colour: the lilac of the wings (Tripo's three), the cream of the eye-spots and the face,
//    the grey-teal shade on the head, the orange body and the olive shade down its side and on its feet, the brown of
//    the shoulder nubs, the dark of the antennae's stalks, the creases and the painted eyes.
// 3. Decimated to TARGET triangles by the geometry alone.
// 4. Cut by geometry: the body, an ellipsoid fitted to its orange (with its feet under it and the nubs on its shoulders),
//    split exactly on its surface (a little out); the head over it, a sphere fitted to its cream above the body, cut
//    from the body by the plane of the neck; the antennae over the head; the wings, all the rest (behind the body,
//    either side); each wing's eye-spot, an ellipse in the wing's plane fitted to its cream (its mean and spread),
//    split exactly on it through both faces. Triangles grouped by part: body, head (with the antennae), wings, spots.
// 5. Repainted by part in the reference's flat colours (PALETTE: measured off the approved image): the body all orange
//    (its olive shade folded in) with its nubs brown, the head cream with its teal folded in and its painted eyes painted
//    out (its own eyes in the game), the antennae's stalks dark and their tips orange, the wings flat lilac, the spots
//    cream; the islands' gaps filled.
// 6. COLOR_0 from the repainted texture (the engines draw it).
// 7. Landmarks measured from the mesh: the body's ellipsoid, the neck, the head's sphere, the eyes (where the painted
//    ones were, their size), each antenna's root and tip, each wing's root (its hinge at the shoulder), the span's middle
//    and tip, each spot's middle and radii.
//
//   node references/enemy-redesign-2026-10-30/trials/moth-tripo/prepare.mjs [--target 12000]
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExport, texelRoles, decimate, splitter, repaint, vertexColours, writeGlb, hex, hsl, lumOf, r4 } from '../flyer-tripo/prep-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/lamp-moth/tripo/model.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000);
/** Wing tip to wing tip (m): the signal moth's 1.8 m open. */
export const SPAN = 1.85;
/** One flat colour a role: the approved image's own (lamp-moth/5b88e9ea-…-1.png, read off its flat fills). */
export const PALETTE = { wing: '#b3a7c3', spot: '#f5e8c3', body: '#e7aa6e', head: '#f3ead0', nub: '#a4574a', dark: '#2b2620' };
const ROLE = ['wing', 'spot', 'teal', 'body', 'olive', 'nub', 'dark'];
const roleOfRGB = (r, g, b) => {
  const { h, l, s } = hsl(r, g, b);
  if (l < 45) return 6;
  if (s < 40 && h > 180 && h < 330) return 0;                // (the lilac: a cool, unsaturated grey-violet)
  if (l > 175 && h >= 25 && h < 75) return 1;                // (cream)
  if (s < 45 && h >= 75 && h < 200) return 2;                // (the grey-teal shade)
  if (h < 40 && s > 60 && l > 95) return r - g > 70 ? 5 : 3; // (orange; the nubs' brown-red)
  if (l < 110) return h < 30 && r - g > 30 ? 5 : 4;          // (olive, brown)
  return 3;
};

const src = await loadExport(IN, { ahead: 'x', size: { axis: 0, metres: SPAN } });
const T = await texelRoles(src.image.bytes, roleOfRGB, ROLE.length);
const lod = await decimate(src, TARGET);
const nv = lod.P.length / 3, I0 = lod.I;
const vrole = new Uint8Array(nv); for (let v = 0; v < nv; v++) vrole[v] = T.role[Math.min(T.H - 1, Math.floor(lod.UV[v * 2 + 1] * T.H)) * T.W + Math.min(T.W - 1, Math.floor(lod.UV[v * 2] * T.W))];
const at = (v) => [lod.P[v * 3], lod.P[v * 3 + 1], lod.P[v * 3 + 2]];
const all = Array.from({ length: nv }, (_, v) => at(v));
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];

// ------------------------------------------------------------------ the body: an ellipsoid round its orange
// (under the head: the antennae's orange tips left out)
const Ytop = pct(all.map((p) => p[1]), 0.999);
const orange = all.filter((p, v) => (vrole[v] === 3 || vrole[v] === 4) && Math.abs(p[0]) < 0.35 && p[1] < Ytop * 0.7);
const bc = [median(orange.map((p) => p[0])), (pct(orange.map((p) => p[1]), 0.02) + pct(orange.map((p) => p[1]), 0.98)) / 2, median(orange.map((p) => p[2]))];
const br = [0, 1, 2].map((i) => (pct(orange.map((p) => p[i]), 0.985) - pct(orange.map((p) => p[i]), 0.015)) / 2);
const BODY_OUT = 1.06;
const bodyE = (p) => Math.hypot((p[0] - bc[0]) / br[0], (p[1] - bc[1]) / br[1], (p[2] - bc[2]) / br[2]);
// ------------------------------------------------------------------ the head: a sphere fitted to its cream and teal over the body
const top = bc[1] + br[1];
const headV = all.filter((p, v) => (vrole[v] === 1 || vrole[v] === 2) && p[1] > top - 0.06 && p[1] < Ytop * 0.9 && Math.abs(p[0]) < 0.2 && p[2] > bc[2] - br[2]);
const hc = [median(headV.map((p) => p[0])), median(headV.map((p) => p[1])), median(headV.map((p) => p[2]))];
let hr = pct(headV.map((p) => Math.hypot(p[0] - hc[0], p[1] - hc[1], p[2] - hc[2])), 0.8);
// (re-centred on the vertices within its first radius: the antennae left out)
{ const q = headV.filter((p) => Math.hypot(p[0] - hc[0], p[1] - hc[1], p[2] - hc[2]) < hr * 1.1); for (let i = 0; i < 3; i++) hc[i] = (Math.min(...q.map((p) => p[i])) + Math.max(...q.map((p) => p[i]))) / 2; hr = Math.max(...[0, 1, 2].map((i) => (Math.max(...q.map((p) => p[i])) - Math.min(...q.map((p) => p[i]))) / 2)); }
const NECK = hc[1] - hr * 0.72;   // (the plane the head is cut from the body at)
const inColumn = (p) => Math.hypot(p[0] - hc[0], p[2] - hc[2]) < hr * (p[1] > hc[1] + hr * 0.5 ? 2 : 1.35) && p[2] > bc[2] - br[2] * 0.6;
const headF = (p) => (p[1] > NECK && inColumn(p) ? 1 : -1);
// the antennae: what rises over the head
const antV = all.filter((p) => p[1] > hc[1] + hr * 0.6 && Math.abs(p[0] - hc[0]) < hr * 2.5 && Math.abs(p[2] - hc[2]) < hr * 2);
const antennae = [-1, 1].map((s) => { const q = antV.filter((p) => s * (p[0] - hc[0]) > 0); if (!q.length) return null; const hi = q.reduce((a, p) => (p[1] > a[1] ? p : a)); const lo = q.filter((p) => p[1] < hc[1] + hr * 1.05);
  return { side: s, root: r4(lo.length ? [0, 1, 2].map((i) => lo.reduce((t, p) => t + p[i], 0) / lo.length) : [hc[0] + s * hr * 0.4, hc[1] + hr * 0.9, hc[2]]), tip: r4(hi) }; });

// ------------------------------------------------------------------ the cut
const S = splitter(lod);
const tris = Array.from(I0);
// the body: in front of the wings' sheet (its plane a little forward), inside its silhouette's half-width at each height
// (measured off its orange in 3 cm slabs, a slab's the widest of its neighbours', 2.5 cm out), under the neck; split
// exactly on that surface. Then the feet under it, and the head off the rest at the neck
const wingZ = median(all.filter((p, v) => vrole[v] === 0 && Math.abs(p[0]) > 0.4).map((p) => p[2]));
const SLAB = 0.03, halfW = [];
for (const p of orange) { if (p[2] < wingZ + 0.05) continue; const k = Math.max(0, Math.floor(p[1] / SLAB)); halfW[k] = Math.max(halfW[k] ?? 0, Math.abs(p[0] - bc[0])); }
const HW = (y) => { const k = Math.max(0, Math.floor(y / SLAB)); return Math.max(halfW[k - 1] ?? 0, halfW[k] ?? 0, halfW[k + 1] ?? 0) + 0.025; };
// (the neck's plane only under the head: the shoulders round it are the body's, up to its top)
const BODY_TOP = bc[1] + br[1] + 0.08;
const cutBody = S.split(tris, (p) => Math.min(HW(p[1]) - Math.abs(p[0] - bc[0]), p[2] - (wingZ + 0.03), (inColumn(p) ? NECK : BODY_TOP) - p[1]), 'body');
let rest = cutBody.outside;
// (the feet under it, and the shoulder nubs in front of the wings' roots: its too)
const feetY = bc[1] - br[1] * 0.75;
const bodyIdx = [...cutBody.inside], keep = [];
for (let t = 0; t < rest.length; t += 3) { const c = [0, 1, 2].map((i) => (S.V.P[rest[t] * 3 + i] + S.V.P[rest[t + 1] * 3 + i] + S.V.P[rest[t + 2] * 3 + i]) / 3); ((c[1] < feetY && Math.abs(c[0] - bc[0]) < br[0] * 1.1 && c[2] > bc[2] - br[2] * 1.2) || (c[2] > wingZ + 0.12 && c[1] < BODY_TOP + 0.05 && !inColumn(c)) || (inColumn(c) && c[1] <= NECK && c[2] > wingZ + 0.05) ? bodyIdx : keep).push(rest[t], rest[t + 1], rest[t + 2]); }
rest = keep;
// the head and the antennae: over the neck, round the head's column
const headPart = [], wingPart = [];
for (let t = 0; t < rest.length; t += 3) { const c = [0, 1, 2].map((i) => (S.V.P[rest[t] * 3 + i] + S.V.P[rest[t + 1] * 3 + i] + S.V.P[rest[t + 2] * 3 + i]) / 3); (headF(c) > 0 ? headPart : wingPart).push(rest[t], rest[t + 1], rest[t + 2]); }
// the wings: each its hinge at the shoulder (the inner edge of the wing behind the body, at the body's widest height)
const wingV = all.filter((p, v) => vrole[v] === 0);
const back = median(wingV.filter((p) => Math.abs(p[0]) < 0.3).map((p) => p[2]));
const wings = [-1, 1].map((s) => {
  const q = wingV.filter((p) => s * p[0] > 0.05);
  const tip = q.reduce((a, p) => (s * p[0] > s * a[0] ? p : a));
  const hinge = [s * (br[0] * 0.55), bc[1] + br[1] * 0.35, back];
  const ys = q.map((p) => p[1]);
  return { side: s, hinge: r4(hinge), tip: r4(tip), top: +pct(ys, 0.99).toFixed(4), bottom: +pct(ys, 0.01).toFixed(4), z: +median(q.map((p) => p[2])).toFixed(4) };
});
// the eye-spots: each an ellipse in the wing's plane (x, y) round its cream (mean ± 2.2 σ), split through both faces
const spotTexel = [];
{ // (the cream texels' places on the wings' triangles, from the texture: their mean and spread a side)
  const W = T.W, H = T.H;
  for (let t = 0; t < wingPart.length; t += 3) {
    const [a, b, d] = [wingPart[t], wingPart[t + 1], wingPart[t + 2]];
    for (const [wa, wb] of [[1 / 3, 1 / 3], [0.6, 0.2], [0.2, 0.6], [0.2, 0.2]]) {
      const u = S.V.UV[a * 2] * wa + S.V.UV[b * 2] * wb + S.V.UV[d * 2] * (1 - wa - wb), w = S.V.UV[a * 2 + 1] * wa + S.V.UV[b * 2 + 1] * wb + S.V.UV[d * 2 + 1] * (1 - wa - wb);
      if (T.role[Math.min(H - 1, Math.floor(w * H)) * W + Math.min(W - 1, Math.floor(u * W))] !== 1) continue;
      spotTexel.push([0, 1, 2].map((i) => S.V.P[a * 3 + i] * wa + S.V.P[b * 3 + i] * wb + S.V.P[d * 3 + i] * (1 - wa - wb)));
    }
  }
}
const spots = [-1, 1].map((s) => {
  let q = spotTexel.filter((p) => s * p[0] > 0.2);
  for (let it = 0; it < 3; it++) { const m = [median(q.map((p) => p[0])), median(q.map((p) => p[1]))]; q = q.filter((p) => Math.hypot(p[0] - m[0], p[1] - m[1]) < 0.22); }
  const mx = q.reduce((t, p) => t + p[0], 0) / q.length, my = q.reduce((t, p) => t + p[1], 0) / q.length;
  const sx = Math.sqrt(q.reduce((t, p) => t + (p[0] - mx) ** 2, 0) / q.length), sy = Math.sqrt(q.reduce((t, p) => t + (p[1] - my) ** 2, 0) / q.length);
  return { side: s, mid: r4([mx, my, median(q.map((p) => p[2]))]), radii: r4([sx * 2.1, sy * 2.1]), samples: q.length };
});
const spotF = (p) => Math.max(...spots.map((sp) => 1 - Math.hypot((p[0] - sp.mid[0]) / sp.radii[0], (p[1] - sp.mid[1]) / sp.radii[1])));
const cutSpots = S.split(wingPart, spotF, 'spots');
const I = Uint32Array.from([...bodyIdx, ...headPart, ...cutSpots.outside, ...cutSpots.inside]);
const parts = {}; let first = 0;
for (const [k, a] of [['body', bodyIdx], ['head', headPart], ['wings', cutSpots.outside], ['spots', cutSpots.inside]]) { parts[k] = [first, a.length / 3]; first += a.length / 3; }
const partOf = (t) => (t < parts.head[0] ? 'body' : t < parts.wings[0] ? 'head' : t < parts.spots[0] ? 'wings' : 'spots');

// ------------------------------------------------------------------ repainted
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]));
const removed = [];
const { paint, png, W, H } = await repaint({ V: S.V, I, T, PAL, paintOf: (t, role, p, n, inside, k) => {
  const part = partOf(t), key = ROLE[role];
  if (part === 'spots') return 'spot';
  if (part === 'wings') return key === 'dark' && p[1] > bc[1] + br[1] * 0.5 && Math.abs(p[0]) < 0.3 ? 'nub' : 'wing';   // (the wings all lilac; the nubs that reach behind)
  if (part === 'body') return key === 'nub' ? 'nub' : key === 'dark' ? (p[1] < feetY ? 'dark' : 'body') : 'body';
  // the head: cream, its painted eyes out; the antennae's stalks dark, their tips orange
  if (p[1] > hc[1] + hr * 0.85 && Math.hypot(p[0] - hc[0], p[2] - hc[2]) > hr * 0.25) return key === 'body' || key === 'olive' || key === 'nub' ? 'body' : 'dark';
  if (inside && lumOf(T.px[k * 3], T.px[k * 3 + 1], T.px[k * 3 + 2]) < 70 && n[2] > 0.3) removed.push(p);
  return 'head';
} });
writeFileSync(join(HERE, 'flat-texture.png'), png);
const COL = vertexColours({ V: S.V, I, paint, W, H, own: (t) => (partOf(t) === 'spots' ? PAL.spot : partOf(t) === 'wings' ? null : null) });
// the eyes where they were painted: the removed texels in two by x, each kept to within 3 cm of its median
const eyes = [-1, 1].map((s) => { let q = removed.filter((p) => s * (p[0] - hc[0]) > 0); for (let it = 0; it < 3 && q.length; it++) { const m = [0, 1, 2].map((i) => median(q.map((p) => p[i]))); q = q.filter((p) => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) < 0.03); }
  if (q.length < 3) return null;
  const mid = [0, 1, 2].map((i) => q.reduce((t, p) => t + p[i], 0) / q.length), span = (i) => Math.max(...q.map((p) => p[i])) - Math.min(...q.map((p) => p[i]));
  return { side: s, at: r4(mid), size: [+span(0).toFixed(3), +span(1).toFixed(3)], texels: q.length }; });

const landmarks = { frame: 'game: +z ahead, +y up, metres, its feet on y 0', scale: +src.scale.toFixed(5), span: SPAN,
  body: { centre: r4(bc), radii: r4(br), out: BODY_OUT, feet: +feetY.toFixed(4) }, neck: +NECK.toFixed(4), head: { centre: r4(hc), radius: +hr.toFixed(4) },
  eyes, antennae, wings, spots, parts, palette: PALETTE };
writeFileSync(join(HERE, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const out = { P: Float32Array.from(S.V.P), N: Float32Array.from(S.V.N), UV: Float32Array.from(S.V.UV) };
const glb = writeGlb({ attrs: { POSITION: out.P, NORMAL: out.N, TEXCOORD_0: out.UV, COLOR_0: COL }, indices: I, image: png, name: 'lamp moth tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/lamp-moth/tripo/model.glb', task: '3c2ccaf8-7fc1-4638-8195-e03c424d3a9e', triangles: I.length / 3, parts, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'tripo-lod.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: src.sourceVertices, triangles: src.sourceTriangles }, lod: { vertices: S.count(), triangles: I.length / 3, parts, bytes: glb.length, sha: sha(glb) }, landmarks: { body: landmarks.body, neck: landmarks.neck, head: landmarks.head, eyes, antennae, wings, spots }, pngBytes: png.length }, null, 1));
