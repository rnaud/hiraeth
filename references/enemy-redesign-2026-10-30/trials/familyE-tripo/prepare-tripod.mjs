// #800 family E: the inspection tripod's Tripo export (keep-tripod/tripo-seed7/model.glb, untouched, task 75908627-…: the
// second take; the first fused its hidden third leg into a stray tusk) made into the game's asset (tripod-lod.glb,
// tripod-texture.png, tripod-landmarks.json beside this script), by prep-machine.mjs's steps:
//
// 1. the picture's shadow (a flat olive disc Tripo built under it) dropped;
// 2. the game's frame: +z ahead along the axis its three legs are drawn round (the two front legs either side of it,
//    the third behind), its feet on y 0, scaled to HEIGHT to the top of its lamp; Tripo turned the lamp head 107° off
//    that axis on its round neck: the head (everything over the neck's top) turned back about the neck to face ahead;
// 3. 12,000 triangles by geometry alone;
// 4. its rigid parts cut by geometry, each exactly on its cut: the head over the neck (it turns: the lamp aims, it looks
//    at the traveller), the hull (the neck's dark rings, the round hub and its sockets, the sage cap under it), and each
//    leg's thigh (its dark hip ball and the sage bracket out to the knee), shin (the block down from the knee, with the
//    sage plate on its inner side) and foot (the dark ankle ball and the domed foot);
// 5. one flat colour a role, the reference's (measured off the approved image): the cream, the sage, the near-black of
//    the joints; Tripo's painted lens (orange, at both ends of the head) painted out (dark in the front's tube, cream on
//    the back's cap): the lens is the model's own part, it glows and narrows;
// 6. the skin's weights baked: each vertex on its part's bone, blended across the hip, knee and ankle cuts (BLEND m);
// 7. the landmarks the rig is fitted to: each leg's hip, knee, ankle and foot, the neck's pivot, the lens's centre,
//    radius and facing, the hub's centre and radius, the head's box.
//
//   node references/enemy-redesign-2026-10-30/trials/familyE-tripo/prepare-tripod.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from '../shellback-tripo/glb.mjs';
import { texture, repaint, flatPng } from '../familyA-tripo/prep-kit.mjs';
import { readFramed, decimate, splitAlong, carry, triangleRoles, neighbours, foldLone, bakeWeights, grouped, roleColours, box, nearestRole, V, r4 } from './prep-machine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-tripod/tripo-seed7/model.glb');
const TASK = '75908627-606e-4432-80ae-51fdb4f03bbf';
/** The top of its lamp over its feet (m): the old lamp tripod's lamp at 3.1 m, its beam from as high. */
export const HEIGHT = 3.1;
const TARGET = 12000;
/** The approved image's flat colours (measured off it, pick-colours.mjs): the cream, the sage, the joints' near-black. */
export const PALETTE = { body: '#eac9ae', limb: '#5f7560', dark: '#2c2f33' };
/** Tripo's own tones, for each texel's role. */
const TONES = nearestRole({ cream: '#d8c090', sage: '#8a9a7a', dark: '#2c2e2a', orange: '#c87838', olive: '#4a4a28', shade: '#a09070' });
export const BONES = ['hull', 'head', 'thigh0', 'shin0', 'foot0', 'thigh1', 'shin1', 'foot1', 'thigh2', 'shin2', 'foot2'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

// ------------------------------------------------------------------ the landmarks in Tripo's frame (islands.mjs)
const T = {
  hub: [0.051, -0.156, 0.069], neck: [0.048, -0.024, 0.079], neckTop: 0.015,
  lensFront: [0.335, 0.304, 0.168], lensBack: [-0.205, 0.297, 0.010], lensR: 0.07,
  // (each leg: its hip ball on the hub's side, its ankle ball; A and C the pair, B the one behind)
  legs: { A: { hip: [0.165, -0.155, -0.010], ankle: [0.305, -0.323, -0.125] }, B: { hip: [0.054, -0.158, 0.229], ankle: [0.080, -0.315, 0.386] }, C: { hip: [-0.066, -0.155, -0.011], ankle: [-0.211, -0.313, -0.143] } },
  ball: 0.033, kneeY: -0.095, kneeIn: 0.025, shinHalf: 0.075, stripY: -0.215, ankleY: -0.29, footLo: -0.432, top: 0.434,
};
// the axis its legs are drawn round: from the one behind (B) to the middle of the pair
const fwdT = V.norm([(T.legs.A.hip[0] + T.legs.C.hip[0]) / 2 - T.legs.B.hip[0], 0, (T.legs.A.hip[2] + T.legs.C.hip[2]) / 2 - T.legs.B.hip[2]]);
const A0 = Math.atan2(fwdT[0], fwdT[2]), cs = Math.cos(A0), sn = Math.sin(A0);
const S = HEIGHT / (T.top - T.footLo);
/** Tripo's frame → the game's: turned so the legs' axis is +z, the hub's middle over the origin, the feet on 0, m. */
const turn = (x, y, z) => [x * cs - z * sn, y, x * sn + z * cs];
const toGame = (x, y, z) => { const q = turn(x - T.hub[0], y, z - T.hub[2]); return [q[0] * S, (y - T.footLo) * S, q[2] * S]; };
const G = (p) => toGame(...p);

const F = await readFramed(IN, { roleOf: TONES, toGame, turn, drop: (pc) => pc.role === 'olive' && pc.hi[1] - pc.lo[1] < 0.06 });
const lod = await decimate(F.m, F.P, F.N, TARGET);

// ------------------------------------------------------------------ the head turned back to face ahead, about the neck
const neck = G(T.neck), cutY = (T.neckTop - T.footLo) * S;
let mesh = lod;
let split = splitAlong(mesh, (p) => p[1] - cutY);
mesh = split.mesh;
const headDirG = V.sub(G(T.lensFront), G(T.lensBack));
const headTurn = -Math.atan2(headDirG[0], headDirG[2]), hc = Math.cos(headTurn), hs = Math.sin(headTurn);
const aboutNeck = (p) => { const x = p[0] - neck[0], z = p[2] - neck[2]; return [neck[0] + x * hc + z * hs, p[1], neck[2] - x * hs + z * hc]; };
{ const moved = new Uint8Array(mesh.n);
  split.side.forEach((s, t) => { if (!s) return; for (let k = 0; k < 3; k++) { const v = mesh.I[t * 3 + k]; if (moved[v]) continue; moved[v] = 1;
    const q = aboutNeck([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]); mesh.P.set(q, v * 3);
    const nx = mesh.N[v * 3], nz = mesh.N[v * 3 + 2]; mesh.N[v * 3] = nx * hc + nz * hs; mesh.N[v * 3 + 2] = -nx * hs + nz * hc; } }); }
let isHead = split.side.map((s) => s === 1);
const lensAt = aboutNeck(G(T.lensFront)), lensBackAt = aboutNeck(G(T.lensBack)), lensR = T.lensR * S;

// ------------------------------------------------------------------ the legs' cuts (game frame)
const hub = [0, (T.hub[1] - T.footLo) * S, 0];
const LEGS = ['C', 'A', 'B'].map((key) => {   // (legs 0 and 1 the front pair, left then right; 2 behind)
  const L = T.legs[key], hip = G(L.hip), ankle = G(L.ankle);
  const u = V.norm([ankle[0], 0, ankle[2]]), w = [-u[2], 0, u[0]];
  const s = (p) => p[0] * u[0] + p[2] * u[2], lat = (p) => p[0] * w[0] + p[2] * w[2];
  const knee = [ankle[0] - u[0] * T.kneeIn * S, (T.kneeY - T.footLo) * S, ankle[2] - u[2] * T.kneeIn * S], foot = [ankle[0], 0, ankle[2]];   // (the knee's bolt at the shin's top, the shin leaning out a little)
  return { key, hip, knee, ankle, foot, u, s, lat, sHip: s(hip) - T.ball * 0.6 * S, sKnee: s(ankle) - T.shinHalf * S, stripY: (T.stripY - T.footLo) * S, ankleY: (T.ankleY - T.footLo) * S };
});
const hipF = (L, p) => Math.max(L.s(p) - L.s(L.hip), T.ball * 1.15 * S - V.len(V.sub(p, L.hip)));   // (> 0: the thigh's: its ball, and past the ball's middle)
const sector = (L, p) => Math.abs(L.lat(p)) < 0.13 * S && p[1] < cutY - 0.02 && L.s(p) > L.sHip - 0.06 * S;
const legOf = (p) => { if (p[1] > cutY) return -1; let best = -1, d = Infinity; LEGS.forEach((L, k) => { if (!sector(L, p)) return; const e = Math.abs(L.lat(p)); if (e < d) { d = e; best = k; } }); return best; };
const kneeF = (L, p) => Math.min(L.sKnee - L.s(p), p[1] - L.stripY);   // (> 0: the thigh's side)
for (const [k, L] of LEGS.entries()) {
  const only = (t) => { const vs = [0, 1, 2].map((q) => mesh.I[t * 3 + q]); return vs.some((v) => legOf([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]) === k); };
  for (const Fn of [(p) => hipF(L, p), (p) => kneeF(L, p), (p) => p[1] - L.ankleY]) { split = splitAlong(mesh, Fn, only); mesh = split.mesh; isHead = carry(isHead, split); }
}
// ------------------------------------------------------------------ each triangle's part
const nt = mesh.I.length / 3, mid = (t) => [0, 1, 2].map((k) => (mesh.P[mesh.I[t * 3] * 3 + k] + mesh.P[mesh.I[t * 3 + 1] * 3 + k] + mesh.P[mesh.I[t * 3 + 2] * 3 + k]) / 3);
const part = new Array(nt);
for (let t = 0; t < nt; t++) {
  if (isHead[t]) { part[t] = 'head'; continue; }
  const p = mid(t), k = legOf(p);
  if (k < 0) { part[t] = 'hull'; continue; }
  const L = LEGS[k];
  part[t] = hipF(L, p) < 0 ? 'hull' : kneeF(L, p) > 0 ? `thigh${k}` : p[1] > L.ankleY ? `shin${k}` : `foot${k}`;
}
// ------------------------------------------------------------------ the colour roles: the reference's three; the painted lenses out
const tex = await texture(F.m, 1024, 3);
let role = triangleRoles(mesh, F.m.tex, TONES, (r, p, t) => {
  if (r === 'orange') return part[t] === 'head' && V.len(V.sub(p, lensBackAt)) < V.len(V.sub(p, lensAt)) ? 'body' : 'dark';
  return r === 'cream' || r === 'shade' ? 'body' : r === 'sage' ? 'limb' : r === 'dark' ? 'dark' : null;   // (olive: folded below)
});
const nb = neighbours(mesh);
{ // (the olive shade: the role round it)
  for (let pass = 0; pass < 6; pass++) for (let t = 0; t < nt; t++) if (!role[t]) { const n = nb[t].map((u) => role[u]).filter(Boolean); if (n.length) { const c = {}; for (const x of n) c[x] = (c[x] ?? 0) + 1; role[t] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; } }
  for (let t = 0; t < nt; t++) role[t] ??= 'body';
}
role = foldLone(role, nb, part, 3);
// (the reference's legs: the two in front a cream shin over a sage bracket, the one behind all sage; Tripo drew one front
//  shin sage and the back one cream: each shin's outer block repainted by part, its inner plate and its knee bolt kept)
for (let t = 0; t < nt; t++) { const m = /^shin(\d)$/.exec(part[t]); if (!m || role[t] === 'dark') continue; const k = +m[1], L = LEGS[k]; if (L.s(mid(t)) > L.sKnee + 0.03 * S) role[t] = k === 2 ? 'limb' : 'body'; }
// ------------------------------------------------------------------ the weights
const joints = LEGS.flatMap((L, k) => [
  { a: BI.hull, b: BI[`thigh${k}`], F: (p) => hipF(L, p), near: (p) => sector(L, p) },
  { a: BI[`thigh${k}`], b: BI[`shin${k}`], F: (p) => -kneeF(L, p), near: (p) => sector(L, p) && hipF(L, p) > 0 },
  { a: BI[`shin${k}`], b: BI[`foot${k}`], F: (p) => L.ankleY - p[1], near: (p) => sector(L, p) },
]);
const BLEND = 0.06;
const { J, W } = bakeWeights(mesh, part.map((q) => BI[q]), joints, BLEND);
// ------------------------------------------------------------------ the landmarks
const pts = (want) => { const out = []; for (let t = 0; t < nt; t++) if (want(t)) for (let k = 0; k < 3; k++) { const v = mesh.I[t * 3 + k]; out.push([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]); } return out; };
const headBox = box(pts((t) => part[t] === 'head')), hubBox = box(pts((t) => part[t] === 'hull' && mid(t)[1] < cutY - 0.1 && mid(t)[1] > hub[1] - 0.3));
// (the lens's face: the most forward of the head's points round its axis)
let lensZ = -Infinity; for (const p of pts((t) => part[t] === 'head')) if (Math.hypot(p[0] - lensAt[0], p[1] - lensAt[1]) < lensR * 0.8) lensZ = Math.max(lensZ, p[2]);
// (the tube's mouth round the lens: the most forward of the head's points in a ring past the lens's rim)
let mouthZ = -Infinity; for (const p of pts((t) => part[t] === 'head')) { const r = Math.hypot(p[0] - lensAt[0], p[1] - lensAt[1]); if (r > lensR * 1.1 && r < lensR * 1.9) mouthZ = Math.max(mouthZ, p[2]); }
const hubR = Math.max(...pts((t) => part[t] === 'hull' && Math.abs(mid(t)[1] - hub[1]) < 0.12 * S).map((p) => Math.hypot(p[0], p[2])));
const ORDER = ['body', 'limb', 'dark'];
const G2 = grouped(mesh, role, ORDER);
const COL = roleColours(mesh, role, PALETTE);
const { paint } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => role[t]);
const png = await flatPng(paint, tex.W, tex.H);
let top = 0; for (let v = 0; v < mesh.n; v++) top = Math.max(top, mesh.P[v * 3 + 1]);
const landmarks = {
  frame: 'game: +z ahead, +y up, metres, feet on y 0', scale: +S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), bones: BONES, blend: BLEND,
  neck: r4([neck[0], cutY, neck[2]]), head: { lo: r4(headBox.lo), hi: r4(headBox.hi) }, hub: { at: r4(hub), r: +hubR.toFixed(4), lo: +hubBox.lo[1].toFixed(4), hi: +hubBox.hi[1].toFixed(4) },
  lens: { at: r4([lensAt[0], lensAt[1], lensZ]), r: +lensR.toFixed(4), mouth: +mouthZ.toFixed(4) },
  legs: LEGS.map((L, k) => ({ side: k === 2 ? 0 : k === 0 ? 1 : -1, hip: r4(L.hip), knee: r4(L.knee), ankle: r4(L.ankle), foot: r4(L.foot), out: r4(L.u) })),
  parts: G2.parts, palette: PALETTE,
};
writeFileSync(join(HERE, 'tripod-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'tripod-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL, JOINTS_0: J, WEIGHTS_0: W }, indices: G2.indices, image: png, name: 'inspection tripod tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-tripod/tripo-seed7/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'tripod-lod.glb'), glb);
const count = {}; part.forEach((q) => { count[q] = (count[q] ?? 0) + 1; });
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3, dropped: F.dropped }, lod: { vertices: mesh.n, triangles: nt, bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  scale: +S.toFixed(4), headTurn: +(headTurn * 180 / Math.PI).toFixed(1), parts: G2.parts, bones: count, lens: landmarks.lens, hub: landmarks.hub, top }));
if (process.env.DEBUG_PARTS) for (const name of Object.keys(count)) { const b = box(pts((t) => part[t] === name)); console.log(name.padEnd(7), r4(b.lo).join(' '), '|', r4(b.hi).join(' ')); }
