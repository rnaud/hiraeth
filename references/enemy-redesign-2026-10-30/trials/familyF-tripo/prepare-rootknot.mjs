// #800 family F: the reed knot's Tripo export (reed-knot/tripo/model.glb, untouched, task 6e112a46-…) made into the game's
// root knot (rootknot-lod.glb, rootknot-texture.png, rootknot-landmarks.json beside this script), by family A's
// prep-kit.mjs steps:
//
// 1. the game's frame: Tripo faced the picture's view, the knot's eyes 94° aside: turned about y so they sit either side of
//    its front (+z), moved so the bulb's middle is over its origin; scaled to 3.2 m to the cap's top (the legacy
//    knot's); Tripo drew five legs (twice: a second try, again-1, drew five too; the picture hides its sixth behind the
//    bulb), as the legacy's five root-arms;
// 2. a 12,000-triangle LOD by geometry alone;
// 3. each triangle's part: the cap, the bulb and the legs meet at creases (the cap's underside on the bulb's top, each
//    leg where it goes into the bulb), so each triangle takes its texels' majority role, the lone ones folded into their
//    neighbours' (four passes, welded by position): no ragged seam; the cap's underside (its triangles facing down: the rim
//    a crease) its gills; the painted eyes painted out (the eyes are their own
//    parts, they look at the traveller); one flat colour a part, the reference's (measured off it);
// 4. COLOR_0 by part;
// 5. the landmarks the rig is fitted to, from the mesh: each leg's centre line followed up from its foot (slabs of its
//    texels), its foot, ankle, knee (the line's furthest point from the hip–ankle chord) and hip (where it goes into the
//    bulb), its radius; the cap's hinge (the bulb's top under it) and its rim's lowest; the eyes.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/prepare-rootknot.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { framed, decimate, keepPieces, texture, repaint, flatPng, hsl, cloud } from '../familyA-tripo/prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/reed-knot/tripo/model.glb');
const TASK = '6e112a46-9834-494e-84c8-f3e16f468dba';
const HEIGHT = 3.2, TARGET = 12000;
/** The approved image's flat colours (measured off it): the mauve cap (its underside in the cap's shade), the sage bulb, the orange legs. */
export const PALETTE = { cap: '#b57f77', gill: '#8e5f5a', bulb: '#88ac95', leg: '#f6bf78' };

const F = await framed(IN, HEIGHT);
const c = [0, 0, 0];
const hslAt = (UV, v) => { sample(F.m.tex, UV[v * 2], UV[v * 2 + 1], c); return hsl(...c); };
const isEye = (h, s, l) => l > 0.8 && h > 40 && h < 70;
const roleOf = (h, s, l) => (isEye(h, s, l) ? 'eye' : (h < 22 || h > 330) && s < 0.45 && l > 0.3 ? 'cap' : h > 100 && h < 190 ? 'bulb' : h >= 22 && h < 60 && s > 0.4 ? 'leg' : null);
// (turned so the painted eyes are either side of its front, moved so the bulb's middle is over its origin)
{ let ex = 0, ez = 0, n = 0;
  for (let v = 0; v < F.n; v++) if (F.P[v * 3 + 1] > 1.9 && isEye(...hslAt(F.m.UV, v))) { ex += F.P[v * 3]; ez += F.P[v * 3 + 2]; n++; }
  const a = Math.atan2(ex / n, ez / n), ca = Math.cos(-a), sa = Math.sin(-a);
  const turn = (A, v) => { const x = A[v * 3], z = A[v * 3 + 2]; A[v * 3] = x * ca + z * sa; A[v * 3 + 2] = -x * sa + z * ca; };
  for (let v = 0; v < F.n; v++) { turn(F.P, v); turn(F.N, v); }
  // (the bulb's middle: its sage texels between the legs and the cap)
  let fx = 0, fz = 0, fn = 0; for (let v = 0; v < F.n; v++) if (F.P[v * 3 + 1] > 1.2 && F.P[v * 3 + 1] < 2.0 && roleOf(...hslAt(F.m.UV, v)) === 'bulb') { fx += F.P[v * 3]; fz += F.P[v * 3 + 2]; fn++; }
  for (let v = 0; v < F.n; v++) { F.P[v * 3] -= fx / fn; F.P[v * 3 + 2] -= fz / fn; }
  F.turned = +a.toFixed(4); F.moved = [+(fx / fn).toFixed(4), +(fz / fn).toFixed(4)]; }
const P = (m, v) => [m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]];
// ------------------------------------------------------------------ the eyes
const eyePts = [[], []];
for (let v = 0; v < F.n; v++) { const p = P(F, v); if (p[1] > 1.9 && isEye(...hslAt(F.m.UV, v))) eyePts[p[0] > 0 ? 1 : 0].push(p); }
const eyes = eyePts.map((q, i) => ({ side: i ? 1 : -1, ...cloud(q) }));
const nearEye = (p) => eyes.some((e) => Math.hypot((p[0] - e.at[0]) / 1.4, (p[1] - e.at[1]) / 2.6, (p[2] - e.at[2]) / 1.4) < 0.09);
// ------------------------------------------------------------------ the legs: each one's centre line, from its foot up into the bulb
const legV = []; for (let v = 0; v < F.n; v++) if (roleOf(...hslAt(F.m.UV, v)) === 'leg') legV.push(P(F, v));
const pads = [];
for (const p of legV) { if (p[1] > 0.1) continue; let k = pads.find((q) => Math.hypot(q.c[0] - p[0], q.c[2] - p[2]) < 0.5); if (!k) { k = { c: p.slice(), pts: [] }; pads.push(k); } k.pts.push(p); k.c = [0, 1, 2].map((j) => k.pts.reduce((s, q) => s + q[j], 0) / k.pts.length); }
const feet = pads.filter((k) => k.pts.length > 60).map((k) => k.c);
function trackLeg(foot) {
  // (from the leg's column over its pad: a pad reaches out ahead of its ankle)
  const low = legV.filter((p) => Math.abs(p[1] - 0.26) < 0.04 && Math.hypot(p[0] - foot[0], p[2] - foot[2]) < 0.5), start = cloud(low).at;
  const line = [start], d = [0, 1, 0];
  for (let i = 0; i < 60; i++) {
    const at = line[line.length - 1], next = at.map((x, j) => x + d[j] * 0.08), s = [0, 0, 0]; let k = 0;
    for (const p of legV) { const q = [p[0] - next[0], p[1] - next[1], p[2] - next[2]]; if (Math.abs(q[0] * d[0] + q[1] * d[1] + q[2] * d[2]) > 0.035 || Math.hypot(...q) > 0.3) continue; for (let j = 0; j < 3; j++) s[j] += p[j]; k++; }
    if (k < 6) break;
    const m = s.map((x) => x / k), nd = m.map((x, j) => x - at[j]), l = Math.hypot(...nd) || 1;
    for (let j = 0; j < 3; j++) d[j] = d[j] * 0.4 + (nd[j] / l) * 0.6; const dl = Math.hypot(...d); for (let j = 0; j < 3; j++) d[j] /= dl;
    line.push(m);
  }
  return line;
}
const legs = feet.map((foot) => {
  const line = trackLeg(foot), hip = line[line.length - 1], ankle = line[1];
  // (the knee: the line's furthest point from the chord ankle–hip)
  let knee = line[1], far = -1;
  for (const q of line) { const ab = [0, 1, 2].map((j) => hip[j] - ankle[j]), aq = [0, 1, 2].map((j) => q[j] - ankle[j]), t = (aq[0] * ab[0] + aq[1] * ab[1] + aq[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2);
    const e = Math.hypot(...aq.map((x, j) => x - ab[j] * t)); if (e > far) { far = e; knee = q; } }
  // (its radius: the leg's texels' mean distance from the line round the shin)
  const r = 0.1;
  const fmt = (q) => q.map((x) => +x.toFixed(4));
  return { foot: fmt([foot[0], 0, foot[2]]), ankle: fmt(ankle), knee: fmt(knee), hip: fmt(hip), line: line.map(fmt), r, side: Math.sign(foot[0]) || 1, az: +Math.atan2(foot[0], foot[2]).toFixed(4) };
}).sort((a, b) => a.az - b.az);
// ------------------------------------------------------------------ decimated; each triangle's part by its texels' majority
const lod = await decimate(F.m, F.P, F.N, TARGET);
const dropped = keepPieces(lod);
const nt = lod.I.length / 3;
let part = new Array(nt);
for (let t = 0; t < nt; t++) {
  const cnt = {};
  for (let k = 0; k < 3; k++) { const r = roleOf(...hslAt(lod.UV, lod.I[t * 3 + k])); if (r && r !== 'eye') cnt[r] = (cnt[r] ?? 0) + 1; }
  // (the triangle's middle too, twice: a crease's dark line is no role)
  const u = [0, 1, 2].reduce((s, k) => s + lod.UV[lod.I[t * 3 + k] * 2], 0) / 3, w = [0, 1, 2].reduce((s, k) => s + lod.UV[lod.I[t * 3 + k] * 2 + 1], 0) / 3;
  sample(F.m.tex, u, w, c); const r = roleOf(...hsl(...c)); if (r && r !== 'eye') cnt[r] = (cnt[r] ?? 0) + 2;
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  // (no role at all: a dark crease or an eye; by where it is: high up the cap's, under the cap's rim the bulb's, low a leg's)
  const y = [0, 1, 2].reduce((s, k) => s + lod.P[lod.I[t * 3 + k] * 3 + 1], 0) / 3;
  part[t] = best ? best[0] : y > 2.6 ? 'cap' : y < 0.9 ? 'leg' : 'bulb';
}
{ const key = (v) => `${Math.round(lod.P[v * 3] * 1e4)},${Math.round(lod.P[v * 3 + 1] * 1e4)},${Math.round(lod.P[v * 3 + 2] * 1e4)}`, edges = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const a = key(lod.I[t * 3 + k]), b = key(lod.I[t * 3 + (k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a; if (!edges.has(e)) edges.set(e, []); edges.get(e).push(t); }
  const nb = Array.from({ length: nt }, () => []); for (const ts of edges.values()) for (const t of ts) for (const u of ts) if (u !== t) nb[t].push(u);
  for (let pass = 0; pass < 4; pass++) { const next = part.slice(); for (let t = 0; t < nt; t++) { const n = nb[t].map((u) => part[u]); const same = n.filter((r) => r === part[t]).length; if (n.length && same === 0) { const cnt = {}; for (const r of n) cnt[r] = (cnt[r] ?? 0) + 1; next[t] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; } } part = next; } }
// (the cap's underside, its gills: the cap's triangles facing down, the rim a crease between them and its top)
for (let t = 0; t < nt; t++) {
  if (part[t] !== 'cap') continue;
  const [a, b, d] = [0, 1, 2].map((k) => P(lod, lod.I[t * 3 + k])), u = b.map((x, j) => x - a[j]), w = d.map((x, j) => x - a[j]);
  const ny = u[2] * w[0] - u[0] * w[2], nl = Math.hypot(u[1] * w[2] - u[2] * w[1], ny, u[0] * w[1] - u[1] * w[0]) || 1;
  if (ny / nl < -0.2) part[t] = 'gill';
}
const mesh = lod;
// ------------------------------------------------------------------ repainted (the trial's texture), the painted eyes out
const tex = await texture(F.m, 1024, 5);
const { paint, removed } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => (nearEye(p) ? '!' + part[t] : part[t]));
const png = await flatPng(paint, tex.W, tex.H);
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]));
const COL = new Uint8Array(mesh.n * 4); part.forEach((q, t) => { for (let k = 0; k < 3; k++) COL.set([...PAL[q], 255], mesh.I[t * 3 + k] * 4); });
const ORDER = ['cap', 'gill', 'bulb', 'leg'], grouped = [], parts = {};
for (const k of ORDER) { const first = grouped.length / 3; part.forEach((q, t) => { if (q === k) grouped.push(mesh.I[t * 3], mesh.I[t * 3 + 1], mesh.I[t * 3 + 2]); }); parts[k] = [first, grouped.length / 3 - first]; }
// ------------------------------------------------------------------ the cap: its hinge on the bulb's top, its rim
const capV = [], bulbV = [];
part.forEach((q, t) => { for (let k = 0; k < 3; k++) (q === 'cap' || q === 'gill' ? capV : q === 'bulb' ? bulbV : []).push(P(mesh, mesh.I[t * 3 + k])); });
const capLow = Math.min(...capV.map((p) => p[1])), bulbTop = Math.max(...bulbV.map((p) => p[1]));
const nearAxis = bulbV.filter((p) => Math.hypot(p[0], p[2]) < 0.35 && p[1] > bulbTop - 0.4);
const hinge = cloud(nearAxis.length ? nearAxis : bulbV).at; hinge[1] = +(bulbTop - 0.15).toFixed(4);
let top = 0; for (let v = 0; v < mesh.n; v++) top = Math.max(top, mesh.P[v * 3 + 1]);
const bulb = cloud(bulbV);
const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +F.S.toFixed(5), turned: F.turned, moved: F.moved, height: HEIGHT, top: +top.toFixed(4),
  legs, cap: { hinge, low: +capLow.toFixed(4) }, bulb: { at: bulb.at, lo: bulb.lo, hi: bulb.hi, top: +bulbTop.toFixed(4) },
  eyes: eyes.map((e) => ({ side: e.side, at: e.at, lo: e.lo, hi: e.hi, texels: e.n })), removed: removed.length, parts, palette: PALETTE };
writeFileSync(join(HERE, 'rootknot-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'rootknot-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL }, indices: Uint32Array.from(grouped), image: png, name: 'root knot tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/reed-knot/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'rootknot-lod.glb'), glb);
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3 }, lod: { vertices: mesh.n, triangles: nt, dropped, error: +lod.error.toFixed(5), bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  turned: F.turned, legs: legs.map((l) => ({ az: l.az, foot: l.foot, knee: l.knee, hip: l.hip, n: l.line.length })), cap: landmarks.cap, bulb: landmarks.bulb, eyes: landmarks.eyes.map((e) => e.at), parts, top }));
