// #800 phase 2b: the wood cutter's Tripo export (keep-brute/tripo/model.glb, untouched) made into the trial's game asset
// (tripo-lod.glb beside this script) and its rig landmarks (landmarks.json), as the shellback's prepare.mjs:
//
// 1. Turned into the game's frame (Tripo: +x ahead, +y up; the game: +z ahead), scaled to the direct wood cutter's
//    height (WOODCUTTER.height m, feet on y = 0) and centred between its feet (Tripo centres the box, saw and all).
// 2. Each texel's role from its colour (a median filter, then by hue and lightness: the sage hull, the dark of the
//    joints and creases, the olive bands, the rust, the ochre, the cream). Tripo's texture is a darker, greener sage
//    than the reference (Remove Lighting was on, its values are low): its colours are not kept, only what each is.
// 3. Decimated to TARGET triangles (meshoptimizer, by the geometry alone and the UV seams kept: weighting the colours'
//    borders, as phase 2b did, kept the creases' noise as saw-toothed folds that shaded dark at the knees and boots).
// 4. Cut into its rigid parts by geometry (the fixes, 2026-10-30; phase 2b cut at run time by the nearest capsule, a
//    ragged line through the colours): the head is the dome itself, grown from its crown over the surface that lies on
//    the dome's fitted sphere and faces out of it (the collar's inside faces in: the cut runs in the crease between
//    them); the pauldrons the caps over the shoulders; each arm and leg cut across by a plane at each joint (normal to
//    the bisector of its two segments), so every cut is a clean ring a band covers. Tripo's saw hand (the muddy rust
//    "mitten" and its disc, the teeth lost) is cut off at the wrist and dropped: the model builds each world's own tool
//    on the wrist (the reference's toothed disc in Lorn II). The triangles are written grouped by part
//    (landmarks.parts: [first, count] each).
// 5. The texture repainted by part, one flat colour a role: the reference's own (the direct body's home skin,
//    plans/woodcutter.js WOODCUTTER_OWN): the head all cream but its visor's groove, nothing cream on the hull (the
//    collar's inside dark), the ochre only on the vent, the knee and elbow bands olive; the texels between the islands
//    filled from their nearest island (no other colour bleeds in as the smaller mips are read), and a swatch of each
//    of the tools' and bands' colours where no triangle draws (landmarks.swatches: the uv the model's own parts read).
// 6. Vertex colours from the repainted texture (COLOR_0) for the engines' VMs.
// 7. The landmarks its machine rig is fitted to (game frame, m): each arm's shoulder, elbow, wrist (where its forearm
//    ends) and tool's end, each leg's hip, knee, ankle and foot, the head's sphere, the visor's groove, the vent, each
//    cut's ring (where, its normal and radius: the bands that hide it), the saw disc's centre and normal.
//
//   node references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/prepare.mjs [--target 12000]
// Deterministic: the same input writes the same bytes.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MeshoptSimplifier as MS } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { readTripo, sample, writeGlb } from '../shellback-tripo/glb.mjs';
import { WOODCUTTER, WOODCUTTER_OWN } from '../../../../src/enemies/plans/woodcutter.js';
import { PARTS } from '../../../../src/enemies/plans/woodcutter-tripo.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
// (the game's asset: public/enemies/woodcutter/, src/enemies/foe-assets.js; the flat texture's picture stays here; the game's
// body.glb then has its picture taken out, scripts/tripo/strip-picture.mjs: every skin is drawn by its vertex colours)
const OUT = join(ROOT, 'public/enemies/woodcutter');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-brute/tripo/model.glb');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TARGET = +opt('--target', 12000), TEX = 1024, AW = +opt('--attr', 0);
const HEIGHT = WOODCUTTER.height;
const O = WOODCUTTER_OWN.perdide2;
/** One flat colour a role, the reference's (the direct body's home skin). */
export const PALETTE = { body: O.body, dark: O.joint, band: O.band, vent: O.brass, head: O.head, visor: O.visor };
/** The colours the model's own parts (the tool, the bands over the cuts) read from swatches in the texture. */
const SWATCH = { saw: O.saw, clamp: O.clamp, brass: O.brass, dark: O.joint, band: O.band, body: O.body };
await MS.ready;

const m = await readTripo(IN);
const n0 = m.P.length / 3;
let lo = Infinity, hi = -Infinity;
for (let v = 0; v < n0; v++) { lo = Math.min(lo, m.P[v * 3 + 1]); hi = Math.max(hi, m.P[v * 3 + 1]); }
const S = HEIGHT / (hi - lo);
// (the middle between its feet: the vertices under 6 cm, their x and z extents' centre)
let fx0 = Infinity, fx1 = -Infinity, fz0 = Infinity, fz1 = -Infinity;
for (let v = 0; v < n0; v++) { if ((m.P[v * 3 + 1] - lo) * S > 0.06) continue; const x = -m.P[v * 3 + 2] * S, z = m.P[v * 3] * S; fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fz0 = Math.min(fz0, z); fz1 = Math.max(fz1, z); }
const CX = (fx0 + fx1) / 2, CZ = (fz0 + fz1) / 2;
/** Tripo's frame → the game's (x ahead → z ahead; y up; the feet on 0, centred between them), m. */
const toGame = (x, y, z) => [-z * S - CX, (y - lo) * S, x * S - CZ];

// ------------------------------------------------------------------ 2. each texel's role
const { data: px, info } = await sharp(m.image.bytes).resize(TEX, TEX, { kernel: 'lanczos3' }).median(5).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
/** A colour's role: 0 green (the hull), 1 dark, 2 olive (bands), 3 rust, 4 ochre, 5 cream. */
const ROLE = ['green', 'dark', 'olive', 'rust', 'ochre', 'cream'];
const roleOfRGB = (r, g, b) => {
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  if (l > 112 && r > g && g > b) return 5;   // (the head's cream, and its shade)
  if (l < 50) return 1;
  if (r - g > 18 && r - b > 25 && g - b < 30) return 3;
  if (r >= g - 4 && g - b > 28) return r - g > 10 ? 4 : 2;
  if (g > r + 6) return 0;
  return 2;
};
const texRole = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) texRole[i] = roleOfRGB(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
// (the specks and the thin strokes Tripo drew in its creases: each texel the commonest role round it, 7 × 7; and a dark
//  that is not black, a crease's shade, reads as the surface it is on: the engine's ink draws the creases)
{ const R = 3, src = texRole.slice(), cnt = new Uint16Array(ROLE.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { cnt.fill(0);
    for (let j = Math.max(0, y - R); j <= Math.min(H - 1, y + R); j++) for (let i = Math.max(0, x - R); i <= Math.min(W - 1, x + R); i++) cnt[src[j * W + i]]++;
    let best = src[y * W + x]; for (let k = 0; k < ROLE.length; k++) if (cnt[k] > cnt[best]) best = k; texRole[y * W + x] = best; } }
const deep = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) deep[i] = px[i * 3] * 0.3 + px[i * 3 + 1] * 0.59 + px[i * 3 + 2] * 0.11 < 30 ? 1 : 0;
const roleAt = (u, v) => texRole[Math.min(H - 1, Math.max(0, Math.floor(v * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)))];

// ------------------------------------------------------------------ 1. positions in the game's frame; 3. decimated
const P = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3), ATT = new Float32Array(n0 * 3);
const PROTO = [[85, 122, 96], [40, 44, 30], [95, 95, 50], [91, 54, 34], [110, 85, 26], [231, 200, 161]];
const c = [0, 0, 0];
for (let v = 0; v < n0; v++) {
  const [x, y, z] = toGame(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
  P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
  N[v * 3] = -m.N[v * 3 + 2]; N[v * 3 + 1] = m.N[v * 3 + 1]; N[v * 3 + 2] = m.N[v * 3];
  sample(m.tex, m.UV[v * 2], m.UV[v * 2 + 1], c);
  const k = roleOfRGB(c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) ATT[v * 3 + i] = PROTO[k][i] / 255;
}
const [simp, err] = MS.simplifyWithAttributes(m.I, P, 3, ATT, 3, [AW, AW, AW], null, Math.min(m.I.length, TARGET * 3), 0.05, ['LockBorder']);
const used = new Int32Array(n0).fill(-1); let nv = 0;
for (const i of simp) if (used[i] < 0) used[i] = nv++;
const out = { P: new Float32Array(nv * 3), N: new Float32Array(nv * 3), UV: new Float32Array(nv * 2), COL: new Uint8Array(nv * 4) };
for (let v = 0; v < n0; v++) { const j = used[v]; if (j < 0) continue;
  out.P.set(P.subarray(v * 3, v * 3 + 3), j * 3); out.N.set(N.subarray(v * 3, v * 3 + 3), j * 3); out.UV.set(m.UV.subarray(v * 2, v * 2 + 2), j * 2); }
const I0 = Uint32Array.from(simp, (i) => used[i]);
const vrole = new Uint8Array(nv); for (let v = 0; v < nv; v++) vrole[v] = roleAt(out.UV[v * 2], out.UV[v * 2 + 1]);

// ------------------------------------------------------------------ 7. the landmarks (game frame, centred; measured)
// (from the slices: the left arm hangs straight, a dark band at the elbow at 1.56 m, the hand from 1.0 to 0.64 m; the
//  saw arm's upper arm hangs a little back, its forearm held forward level at 1.4 m, green for 0.3 m past the elbow,
//  then the olive cuff and the rust of the hand and disc, the disc centred 1.32 m up; the legs nearly straight, a short
//  thigh into the barrel at 0.9 m, an olive knee band at 0.62–0.78 m, the boots from 0.36 m down to a broad round sole)
const r3 = (a) => a.map((x) => +x.toFixed(3));
const V3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: (a) => Math.hypot(...a) };
V3.norm = (a) => { const l = V3.len(a) || 1; return a.map((x) => x / l); };
const at = (v) => [out.P[v * 3], out.P[v * 3 + 1], out.P[v * 3 + 2]];
const ELBOW0 = [-0.84, 1.42, -0.14], DISC0 = [-1.15, 1.32, 0.56];
/** The saw arm's wrist: 0.3 m past the elbow toward the disc, where the rust begins (the cut; the tool is built past it). */
const WRIST0 = r3(V3.add(ELBOW0, V3.norm(V3.sub(DISC0, ELBOW0)), 0.3));
/** The new disc's hub: on the line to Tripo's disc, HUB m past the wrist (the reference's disc is held at the forearm's end). */
const HUB = 0.24, END0 = r3(V3.add(WRIST0, V3.norm(V3.sub(DISC0, WRIST0)), HUB));
const arms = [
  { side: -1, shoulder: [-0.7, 1.92, -0.12], elbow: ELBOW0, wrist: WRIST0, end: END0, tool: 'saw', sawR: WOODCUTTER.saw },
  { side: 1, shoulder: [0.68, 1.92, -0.1], elbow: [0.84, 1.56, -0.08], wrist: [0.86, 1.0, 0.1], end: [0.86, 0.64, 0.14], tool: 'clamp' },
];
const legs = [-1, 1].map((s) => ({ side: s, hip: r3([s * 0.42, 0.9, -0.02]), knee: r3([s * 0.46, 0.7, 0.0]), ankle: r3([s * 0.5, 0.25, 0.0]), foot: r3([s * 0.55, 0, 0.0]) }));
const PAULDRON_Y = 1.74, CHEST_Y = [1.62, 1.98], VENT = [0, 1.2, 0.52];

// ------------------------------------------------------------------ 4. the parts, by geometry
// (the welded surface: the LOD's UV seams split vertices that share a place)
const weld = new Int32Array(nv); { const map = new Map(); for (let v = 0; v < nv; v++) { const k = `${Math.round(out.P[v * 3] * 4000)},${Math.round(out.P[v * 3 + 1] * 4000)},${Math.round(out.P[v * 3 + 2] * 4000)}`; if (!map.has(k)) map.set(k, v); weld[v] = map.get(k); } }
const adj = new Map(); const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
for (let t = 0; t < I0.length; t += 3) for (let k = 0; k < 3; k++) { const a = weld[I0[t + k]], b = weld[I0[t + (k + 1) % 3]]; link(a, b); link(b, a); }
// the head's sphere: fitted to its cream over the collar (x² + y² + z² = 2a·p + d by least squares)
const sphere = (() => {
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]), B = [0, 0, 0, 0];
  for (let v = 0; v < nv; v++) { if (vrole[v] !== 5 || out.P[v * 3 + 1] < 1.95) continue; const p = at(v), r = [2 * p[0], 2 * p[1], 2 * p[2], 1], s = V3.dot(p, p); for (let i = 0; i < 4; i++) { B[i] += r[i] * s; for (let j = 0; j < 4; j++) A[i][j] += r[i] * r[j]; } }
  for (let i = 0; i < 4; i++) { let q = i; for (let k = i + 1; k < 4; k++) if (Math.abs(A[k][i]) > Math.abs(A[q][i])) q = k; [A[i], A[q]] = [A[q], A[i]]; [B[i], B[q]] = [B[q], B[i]];
    for (let k = i + 1; k < 4; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j]; B[k] -= f * B[i]; } }
  const X = [0, 0, 0, 0]; for (let i = 3; i >= 0; i--) { let s = B[i]; for (let j = i + 1; j < 4; j++) s -= A[i][j] * X[j]; X[i] = s / A[i][i]; }
  const centre = X.slice(0, 3); return { centre: r3(centre), r: +Math.sqrt(X[3] + V3.dot(centre, centre)).toFixed(3) };
})();
const HEAD_OUT = 0.055, HEAD_LOW = 1.76;
const isHeadV = (v) => { const p = at(v); if (p[1] < HEAD_LOW) return false; const d = V3.sub(p, sphere.centre), dist = V3.len(d) - sphere.r; if (dist > HEAD_OUT) return false;
  const nn = [out.N[v * 3], out.N[v * 3 + 1], out.N[v * 3 + 2]]; return dist < -0.005 || V3.dot(nn, d) / (V3.len(d) || 1) > 0.25; };
const headV = new Uint8Array(nv);
{ let top = 0; for (let v = 1; v < nv; v++) if (out.P[v * 3 + 1] > out.P[top * 3 + 1]) top = v;
  const seen = new Set([weld[top]]), q = [weld[top]];
  while (q.length) { const a = q.pop(); for (const b of adj.get(a) ?? []) if (!seen.has(b) && isHeadV(b)) { seen.add(b); q.push(b); } }
  for (let v = 0; v < nv; v++) if (seen.has(weld[v])) headV[v] = 1;
  // (and the dome's cream the growth missed past a fold: nothing else on the hull is cream)
  for (let v = 0; v < nv; v++) if (vrole[v] === 5 && out.P[v * 3 + 1] > 1.9 && V3.len(V3.sub(at(v), sphere.centre)) - sphere.r < HEAD_OUT) headV[v] = 1;
  if (process.env.DEBUG_CUTS) { let pass = 0, cream = 0, creamIn = 0, hv = 0; for (let v = 0; v < nv; v++) { if (isHeadV(v)) pass++; if (vrole[v] === 5) { cream++; if (headV[v]) creamIn++; } if (headV[v]) hv++; } console.error('head', { pass, bfs: hv, cream, creamIn, top: at(top) }); } }
const segDist = (p, a, b) => { const ab = V3.sub(b, a), t = Math.min(1, Math.max(0, V3.dot(V3.sub(p, a), ab) / V3.dot(ab, ab))); return V3.len(V3.sub(p, V3.add(a, ab, t))); };
/** A joint's cut: the plane through `j` normal to the bisector of the segments (a → j) and (j → b). */
const cutAt = (a, j, b) => ({ at: j, n: V3.norm(V3.add(V3.norm(V3.sub(j, a)), V3.norm(V3.sub(b, j)))) });
const past = (p, cut) => V3.dot(V3.sub(p, cut.at), cut.n) > 0;
const ARM = arms.map((a) => ({ ...a, cEl: cutAt(a.shoulder, a.elbow, a.wrist), cWr: cutAt(a.elbow, a.wrist, a.end) }));
const LEG = legs.map((l) => ({ ...l, cKnee: { at: l.knee, n: [0, -1, 0] }, cAnkle: { at: [l.ankle[0], 0.36, l.ankle[2]], n: [0, -1, 0] } }));
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
const DROP = 255;   // (Tripo's saw hand: not kept)
const vpart = new Uint8Array(nv);
for (let v = 0; v < nv; v++) {
  const p = at(v);
  if (headV[v]) { vpart[v] = PI.head; continue; }
  const pk = ARM.findIndex((a) => p[1] > PAULDRON_Y && Math.sign(p[0]) === Math.sign(a.shoulder[0]) && Math.abs(p[0]) > 0.42 && V3.len(V3.sub(p, a.shoulder)) < 0.62);
  if (pk >= 0) { vpart[v] = PI[`pauldron${pk}`]; continue; }
  // (the limb it is on: the nearest of the hull's ellipsoid, each arm's and leg's capsules)
  const cand = [['hull', -1, Math.hypot(p[0] / 0.6, (p[1] - 1.48) / 0.66, (p[2] + 0.06) / 0.58) * 0.6 - 0.6],
    ...ARM.flatMap((a, k) => [['arm', k, Math.min(segDist(p, a.shoulder, a.elbow) - 0.17, segDist(p, a.elbow, a.wrist) - 0.2, k ? segDist(p, a.wrist, a.end) - 0.16 : V3.len(V3.sub(p, DISC0)) - 0.45)]]),
    ...LEG.map((l, k) => ['leg', k, p[1] > l.hip[1] - 0.04 ? 9 : p[1] < 0.36 ? segDist(p, [l.ankle[0], 0.1, l.ankle[2]], [l.foot[0], 0.1, l.foot[2]]) - 0.5 : segDist(p, l.hip, l.ankle) - 0.26])];
  let best = cand[0]; for (const x of cand) if (x[2] < best[2]) best = x;
  const [kind, k] = best;
  if (kind === 'hull') vpart[v] = PI.hull;
  else if (kind === 'arm') { const a = ARM[k]; vpart[v] = !past(p, a.cEl) ? PI[`upper${k}`] : !past(p, a.cWr) ? PI[`fore${k}`] : k ? PI.hand1 : DROP; }
  else { const l = LEG[k]; vpart[v] = !past(p, l.cKnee) ? PI[`thigh${k}`] : !past(p, l.cAnkle) ? PI[`shin${k}`] : PI[`foot${k}`]; }
}
// (a triangle goes whole to the part most of its corners are in; the head's and pauldrons' only with all three; the
//  dropped hand's with any one, so nothing of its rust is left at the cuff)
const STRICT = new Set([PI.head, PI.pauldron0, PI.pauldron1]);
const triPart = new Uint8Array(I0.length / 3);
for (let t = 0; t < triPart.length; t++) {
  const q = [vpart[I0[t * 3]], vpart[I0[t * 3 + 1]], vpart[I0[t * 3 + 2]]];
  if (q.includes(DROP)) { triPart[t] = DROP; continue; }
  let pick = q[0] === q[1] || q[0] === q[2] ? q[0] : q[1] === q[2] ? q[1] : q[0];
  if (STRICT.has(pick) && !(q[0] === pick && q[1] === pick && q[2] === pick)) pick = q.find((x) => !STRICT.has(x)) ?? PI.hull;
  triPart[t] = pick;
}
// the triangles grouped by part, the dropped hand's left out; its vertices too
const order = []; const parts = {};
for (const [k, name] of PARTS.entries()) { const first = order.length; for (let t = 0; t < triPart.length; t++) if (triPart[t] === k) order.push(t); parts[name] = [first, order.length - first]; }
const keepV = new Int32Array(nv).fill(-1); let nk = 0;
for (const t of order) for (let k = 0; k < 3; k++) { const v = I0[t * 3 + k]; if (keepV[v] < 0) keepV[v] = nk++; }
const fin = { P: new Float32Array(nk * 3), N: new Float32Array(nk * 3), UV: new Float32Array(nk * 2), COL: new Uint8Array(nk * 4) }, frole = new Uint8Array(nk);
for (let v = 0; v < nv; v++) { const j = keepV[v]; if (j < 0) continue; fin.P.set(out.P.subarray(v * 3, v * 3 + 3), j * 3); fin.N.set(out.N.subarray(v * 3, v * 3 + 3), j * 3); fin.UV.set(out.UV.subarray(v * 2, v * 2 + 2), j * 2); frole[j] = vrole[v]; }
const I = new Uint32Array(order.length * 3); order.forEach((t, i) => { for (let k = 0; k < 3; k++) I[i * 3 + k] = keepV[I0[t * 3 + k]]; });
const partOfTri = new Uint8Array(order.length); { let i = 0; for (const [k, name] of PARTS.entries()) for (let j = 0; j < parts[name][1]; j++) partOfTri[i++] = k; }

// each cut's ring: the limb's surface within 3 cm of the plane, its centre and outer radius (the band that hides it)
const ring = (cut, inPart) => { let n = 0, cc = [0, 0, 0]; const pts = [];
  for (let t = 0; t < order.length; t++) { if (!inPart(partOfTri[t])) continue; for (let k = 0; k < 3; k++) { const p = [fin.P[I[t * 3 + k] * 3], fin.P[I[t * 3 + k] * 3 + 1], fin.P[I[t * 3 + k] * 3 + 2]]; if (Math.abs(V3.dot(V3.sub(p, cut.at), cut.n)) < 0.03 && V3.len(V3.sub(p, cut.at)) < 0.4) { pts.push(p); cc = V3.add(cc, p); n++; } } }
  if (!n) return { at: r3(cut.at), n: r3(cut.n), r: 0.15 };
  cc = cc.map((x) => x / n); const on = V3.add(cc, cut.n, -V3.dot(V3.sub(cc, cut.at), cut.n));
  const rs = pts.map((p) => { const d = V3.sub(p, on); return V3.len(V3.add(d, cut.n, -V3.dot(d, cut.n))); }).sort((a, b) => a - b), q = (f) => rs[Math.min(rs.length - 1, Math.floor(f * rs.length))];
  if (process.env.DEBUG_CUTS) console.error('cut', cut.at, rs.length, [0.1, 0.25, 0.5, 0.75, 0.9, 1].map((f) => q(f).toFixed(3)).join(' '));
  // (its radius: the surface's own round the centre, the 85th percentile, a stray point of a fold or a finger left out)
  return { at: r3(on), n: r3(cut.n), r: +q(0.85).toFixed(3), inner: +q(0.25).toFixed(3) }; };
const set = (...names) => (k) => names.includes(PARTS[k]);
const cuts = {
  elbow0: ring(ARM[0].cEl, set('upper0', 'fore0')), wrist0: ring(ARM[0].cWr, set('fore0')),
  elbow1: ring(ARM[1].cEl, set('upper1', 'fore1')), wrist1: ring(ARM[1].cWr, set('fore1', 'hand1')),
  knee0: ring(LEG[0].cKnee, set('thigh0', 'shin0')), ankle0: ring(LEG[0].cAnkle, set('shin0', 'foot0')),
  knee1: ring(LEG[1].cKnee, set('thigh1', 'shin1')), ankle1: ring(LEG[1].cAnkle, set('shin1', 'foot1')),
  // (the hips: where the legs leave the barrel's underside, the plane the leg's capsule starts under)
  hip0: { ...ring({ at: [LEG[0].hip[0], LEG[0].hip[1] - 0.04, LEG[0].hip[2]], n: [0, -1, 0] }, set('thigh0')), at: r3([LEG[0].hip[0], LEG[0].hip[1] - 0.04, LEG[0].hip[2]]) },
  hip1: { ...ring({ at: [LEG[1].hip[0], LEG[1].hip[1] - 0.04, LEG[1].hip[2]], n: [0, -1, 0] }, set('thigh1')), at: r3([LEG[1].hip[0], LEG[1].hip[1] - 0.04, LEG[1].hip[2]]) },
};
// the saw's disc (Tripo's, before it was dropped): its rust round the end, the least spread direction is its normal
const sawN = (() => { const pts = []; for (let v = 0; v < nv; v++) { if (vrole[v] !== 3) continue; const d = V3.sub(at(v), DISC0); if (V3.len(d) < 0.45) pts.push(d); }
  let best = null, bv = Infinity;
  for (let a = 0; a < 90; a++) for (let b = 0; b <= 30; b++) { const th = (a / 90) * Math.PI * 2, ph = (b / 30) * Math.PI / 2, d = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)]; let s = 0; for (const q of pts) s += V3.dot(q, d) ** 2; if (s < bv) { bv = s; best = d; } }
  return r3(best); })();
// (turned SAW_TURN rad about the forearm, toward its front: Tripo's faces straight out sideways, edge on from the front;
//  the reference's shows its face to a three-quarter view from the front)
const SAW_TURN = 0.6;
const sawFace = (() => { const k = V3.norm(V3.sub(END0, WRIST0)), rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a), kv = V3.dot(k, v), x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]; return v.map((vi, i) => vi * c + x[i] * s + k[i] * kv * (1 - c)); };
  const a = rot(sawN, SAW_TURN), b = rot(sawN, -SAW_TURN); return r3(V3.norm(a[2] > b[2] ? a : b)); })();

// ------------------------------------------------------------------ 5. the texture repainted by part
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAL = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]));
const paint = Buffer.alloc(W * H * 3), owner = new Int32Array(W * H).fill(-1);
const visorPts = [];
for (const pass of [0, 1]) for (let t = 0; t < I.length / 3; t++) {
  const [a, b, d] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], U = (v) => [fin.UV[v * 2] * W - 0.5, fin.UV[v * 2 + 1] * H - 0.5];
  const A = U(a), B = U(b), D = U(d), area = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]);
  if (Math.abs(area) < 1e-12) continue;
  const mid = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3].map(Math.round);
  const x0 = pass ? mid[0] : Math.max(0, Math.floor(Math.min(A[0], B[0], D[0]))), x1 = pass ? mid[0] : Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], D[0])));
  const y0 = pass ? mid[1] : Math.max(0, Math.floor(Math.min(A[1], B[1], D[1]))), y1 = pass ? mid[1] : Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], D[1])));
  const part = PARTS[partOfTri[t]];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    let w1 = ((B[0] - x) * (D[1] - y) - (B[1] - y) * (D[0] - x)) / area, w2 = ((D[0] - x) * (A[1] - y) - (D[1] - y) * (A[0] - x)) / area, w3 = 1 - w1 - w2;
    if (pass) { if (owner[y * W + x] >= 0) continue; w1 = w2 = w3 = 1 / 3; }
    else if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
    const k = y * W + x, inside = !pass && w1 >= 0 && w2 >= 0 && w3 >= 0;
    if (owner[k] >= 0 && !inside) continue;
    const p = [0, 1, 2].map((i) => w1 * fin.P[a * 3 + i] + w2 * fin.P[b * 3 + i] + w3 * fin.P[d * 3 + i]);
    const r = ROLE[texRole[k]];
    let role;
    if (part === 'head') {
      // (all cream but the visor's groove: the dark sunk under the dome's sphere)
      const sunk = V3.len(V3.sub(p, sphere.centre)) - sphere.r;
      role = r === 'dark' || r === 'olive' ? (sunk < -0.012 ? 'visor' : 'head') : 'head';
      if (role === 'visor' && inside) visorPts.push(p);
    } else if (r === 'cream') role = 'dark';   // (the collar's inside, the neck's shadow)
    else if (r === 'ochre' || r === 'rust') role = part === 'hull' && V3.len(V3.sub(p, VENT)) < 0.24 ? 'vent' : 'band';
    else role = r === 'green' ? 'body' : r === 'dark' ? (deep[k] ? 'dark' : 'body') : 'band';
    owner[k] = t; const col = PAL[role]; paint[k * 3] = col[0]; paint[k * 3 + 1] = col[1]; paint[k * 3 + 2] = col[2];
  }
}
// the swatches: a 16² block of each colour where no triangle draws (within 4 texels), their middle's uv
const swatches = {};
{ const B = 16, M = 4; let sx = 0, sy = 0;
  const free = (x, y) => { for (let j = y - M; j < y + B + M; j++) for (let i = x - M; i < x + B + M; i++) { if (i < 0 || j < 0 || i >= W || j >= H) return false; if (owner[j * W + i] >= 0) return false; } return true; };
  for (const [name, h] of Object.entries(SWATCH)) {
    let found = null;
    for (let y = sy; y < H - B && !found; y += 4) for (let x = y === sy ? sx : 0; x < W - B && !found; x += 4) if (free(x, y)) found = [x, y];
    if (!found) throw new Error('no room for a swatch: ' + name);
    const col = hex(h);
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = (found[1] + j) * W + found[0] + i; owner[k] = -2; paint[k * 3] = col[0]; paint[k * 3 + 1] = col[1]; paint[k * 3 + 2] = col[2]; }
    swatches[name] = [+((found[0] + B / 2) / W).toFixed(5), +((found[1] + B / 2) / H).toFixed(5)];
    [sx, sy] = [found[0] + B + 2 * M, found[1]];
  }
}
// the texels no triangle owns: filled from the nearest owned one (breadth first), so no mip mixes another island in
{ let front = []; for (let k = 0; k < W * H; k++) if (owner[k] !== -1) front.push(k);
  const done = Uint8Array.from(owner, (o) => (o !== -1 ? 1 : 0));
  while (front.length) { const next = []; for (const k of front) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (done[j]) continue; done[j] = 1; paint.copy(paint, j * 3, k * 3, k * 3 + 3); next.push(j); } } front = next; } }
const png = await sharp(paint, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9, palette: true, colours: 16, dither: 0 }).toBuffer();
writeFileSync(join(HERE, 'flat-texture.png'), png);
// ------------------------------------------------------------------ 6. vertex colours from it (a texel a little inside one of its triangles)
{ const done = new Uint8Array(nk);
  for (let t = 0; t < I.length / 3; t++) {
    const tri = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], cu = tri.reduce((s, v) => s + fin.UV[v * 2], 0) / 3, cv = tri.reduce((s, v) => s + fin.UV[v * 2 + 1], 0) / 3;
    for (const v of tri) { if (done[v]) continue; done[v] = 1;
      const u = fin.UV[v * 2] * 0.85 + cu * 0.15, w = fin.UV[v * 2 + 1] * 0.85 + cv * 0.15;
      const k = Math.min(H - 1, Math.max(0, Math.floor(w * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      for (let i = 0; i < 3; i++) fin.COL[v * 4 + i] = paint[k * 3 + i]; fin.COL[v * 4 + 3] = 255; }
  } }
// the visor's groove: its middle, its width and height (the slit the model lays in it)
const visor = (() => { if (!visorPts.length) return null; const mid = [0, 1, 2].map((i) => visorPts.reduce((s, p) => s + p[i], 0) / visorPts.length), span = (i) => Math.max(...visorPts.map((p) => p[i])) - Math.min(...visorPts.map((p) => p[i]));
  return { at: r3(mid), size: [+span(0).toFixed(3), +span(1).toFixed(3)], texels: visorPts.length }; })();

const landmarks = { frame: 'game: +z ahead, +y up, metres, feet on y 0, centred between the feet', scale: +S.toFixed(5), shift: r3([CX, CZ]), height: HEIGHT,
  arms: arms.map((a) => ({ ...a, shoulder: r3(a.shoulder), elbow: r3(a.elbow), wrist: r3(a.wrist), end: r3(a.end) })), legs,
  head: { centre: sphere.centre, r: sphere.r, top: HEIGHT, note: 'the dome\'s fitted sphere: the head turns about its centre' }, visor,
  vent: VENT, pauldronY: PAULDRON_Y, chestY: CHEST_Y, saw: { centre: END0, tripo: DISC0, normal: sawFace, tripoNormal: sawN, turn: SAW_TURN, r: WOODCUTTER.saw },
  cuts, parts, partNames: PARTS, swatches, palette: PALETTE, swatchColours: SWATCH };
writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');

const glb = writeGlb({ attrs: { POSITION: fin.P, NORMAL: fin.N, TEXCOORD_0: fin.UV, COLOR_0: fin.COL }, indices: I, image: png, name: 'wood cutter tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-brute/tripo/model.glb', task: '32ba0f6c-65ed-4cb9-8685-bdfb19b47047', triangles: I.length / 3, decimated: I0.length / 3, simplifyError: +err.toFixed(5) } });
writeFileSync(join(OUT, 'body.glb'), glb);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
console.log(JSON.stringify({ source: { vertices: n0, triangles: m.I.length / 3, texture: [m.tex.w, m.tex.h] }, centre: [CX, CZ], lod: { vertices: nk, triangles: I.length / 3, decimated: I0.length / 3, dropped: I0.length / 3 - I.length / 3, error: +err.toFixed(5), bytes: glb.length, sha: sha(glb) },
  parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v[1]])), head: sphere, visor, cuts, sawN, swatches, pngBytes: png.length }));
