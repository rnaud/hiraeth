// #800 family E: the survey crawler's Tripo export (keep-crawler/tripo-seed7/model.glb, untouched, task c7b50a5d-…: the
// second take; the first drew five legs) made into the game's asset (crawler-lod.glb, crawler-texture.png,
// crawler-landmarks.json beside this script), by prep-machine.mjs's steps:
//
// 1. the game's frame: Tripo's +z ahead (its head) as the game's, its legs' middle over the origin, its feet on y 0,
//    scaled to HEIGHT to the top of its antenna (drawn ×1.5 in the game, GROWN #741: its dome at his thigh, the antenna's
//    knob at his hip);
// 2. 12,000 triangles by geometry alone;
// 3. four legs, the reference's note's ("four-legged anatomy remains the target"): Tripo drew six, three a side; the
//    front pair and the middle pair kept, the back pair cut off where it leaves its socket (a dark port closes each, the
//    model's own);
// 4. its rigid parts cut by geometry, each exactly on its cut: the head (the round front under the dome's lip: it turns
//    to look at the traveller), the antenna (it sways and sparks), the body (the dome, its dark band, the belly and the
//    sockets), each leg's thigh (out of its socket to the knee), shin (down to the ankle) and foot (the stem and the
//    domed pad);
// 5. one flat colour a role, the reference's (measured off the approved image): the cream ceramic, the sage legs, the
//    near-black joints, the navy band, the pink sockets; the painted eye (one orange dot) painted out: two eyes are the
//    model's own parts on the head;
// 6. the skin's weights baked: each vertex on its part's bone, blended across the hip, knee, ankle and the head's cut;
// 7. the landmarks: each leg's hip, knee, ankle and foot, the head's pivot, the eyes, the antenna's foot, the dropped
//    sockets, the dome's top.
//
//   node references/enemy-redesign-2026-10-30/trials/familyE-tripo/prepare-crawler.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from '../shellback-tripo/glb.mjs';
import { texture, repaint, flatPng } from '../familyA-tripo/prep-kit.mjs';
import { readFramed, decimate, splitAlong, carry, triangleRoles, neighbours, foldLone, bakeWeights, grouped, roleColours, box, nearestRole, V, r4 } from './prep-machine.mjs';
import { segDist } from '../familyA-tripo/prep-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-crawler/tripo-seed7/model.glb');
const TASK = 'c7b50a5d-154d-4216-abc4-0861094e2b42';
/** To the top of its antenna's knob, as built (m): drawn ×1.5, 0.99 m, its knob at the traveller's hip (0.955 m), its dome under it. */
export const HEIGHT = 0.66;
const TARGET = 12000;
/** The approved image's flat colours (pick-colours.mjs): the cream ceramic, the sage legs, the joints, the navy band, the pink sockets. */
export const PALETTE = { ceramic: '#e4cdb6', leg: '#7e8d7c', joint: '#3a4640', band: '#1a2230', socket: '#a06a66' };
const TONES = nearestRole({ cream: '#e0c8a8', shade: '#b8a088', sage: '#7e8d7c', dark: '#2a3430', band: '#18202a', orange: '#b85a1a', pink: '#a06a66', olive: '#606850' });
export const BONES = ['body', 'head', 'antenna', 'thigh0', 'shin0', 'foot0', 'thigh1', 'shin1', 'foot1', 'thigh2', 'shin2', 'foot2', 'thigh3', 'shin3', 'foot3'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

// ------------------------------------------------------------------ the landmarks in Tripo's frame (islands.mjs, grid-views.mjs)
const T = {
  lo: -0.381, top: 0.381, mid: [0, 0.06],
  // (each leg: its socket's middle on the body's side, its foot pad's middle; the kit's order: the front pair left then right, the middle pair)
  legs: [{ hip: [0.183, -0.123, 0.217], foot: [0.339, -0.381, 0.329] }, { hip: [-0.183, -0.124, 0.217], foot: [-0.340, -0.381, 0.329] },
    { hip: [0.235, -0.120, -0.002], foot: [0.428, -0.378, -0.116] }, { hip: [-0.236, -0.120, 0.000], foot: [-0.428, -0.377, -0.120] }],
  dropped: [{ hip: [0.117, -0.119, -0.210], foot: [0.182, -0.343, -0.367] }, { hip: [-0.120, -0.118, -0.212], foot: [-0.18, -0.343, -0.365] }],
  ankleY: -0.318, kneeY: -0.132, kneeAt: 0.7, socket: 0.05, thighLow: -0.205,
  head: { back: 0.272, half: 0.168, top: -0.034, pivot: [0, -0.12, 0.29], eyes: [[0.145, -0.094, 0.371], [-0.145, -0.094, 0.371]] },
  antenna: { at: [0.001, 0.245, -0.098], r: 0.07 },
};
const S = HEIGHT / (T.top - T.lo);
/** Tripo's frame → the game's: +z ahead as it is, its legs' middle over the origin, the feet on 0. */
const toGame = (x, y, z) => [(x - T.mid[0]) * S, (y - T.lo) * S, (z - T.mid[1]) * S];
const turn = (x, y, z) => [x, y, z];
const G = (p) => toGame(...p);
const gy = (y) => (y - T.lo) * S;

const F = await readFramed(IN, { roleOf: TONES, toGame, turn, drop: (pc) => pc.tris < 60 });
const lod = await decimate(F.m, F.P, F.N, TARGET);
// ------------------------------------------------------------------ the legs, in the game's frame
const legOf = (L) => {
  const hip = G(L.hip), foot = G(L.foot), ankle = [foot[0], gy(T.ankleY), foot[2]];
  const u = V.norm([ankle[0] - hip[0], 0, ankle[2] - hip[2]]), w = [-u[2], 0, u[0]];
  const s = (p) => (p[0] - hip[0]) * u[0] + (p[2] - hip[2]) * u[2], lat = (p) => (p[0] - hip[0]) * w[0] + (p[2] - hip[2]) * w[2];
  const knee = [hip[0] + (ankle[0] - hip[0]) * T.kneeAt, gy(T.kneeY), hip[2] + (ankle[2] - hip[2]) * T.kneeAt];
  return { hip, knee, ankle, foot, u, s, lat, sHip: T.socket * S, sKnee: s(knee) - 0.03 * S, thighLow: gy(T.thighLow), ankleY: gy(T.ankleY) };
};
const LEGS = T.legs.map(legOf);
const DROP = T.dropped.map((d) => { const hip = G(d.hip), foot = G(d.foot), u = V.norm([foot[0] - hip[0], 0, foot[2] - hip[2]]), knee = [hip[0] + (foot[0] - hip[0]) * T.kneeAt, hip[1], hip[2] + (foot[2] - hip[2]) * T.kneeAt]; return { hip, foot, knee, u, near: (p) => Math.min(segDist(p, hip, knee), segDist(p, knee, foot)), s: (p) => (p[0] - hip[0]) * u[0] + (p[2] - hip[2]) * u[2], lat: (p) => (p[0] - hip[0]) * -u[2] + (p[2] - hip[2]) * u[0] }; });
// (a leg's sector: beside its socket, under the band, out from the body's side)
const below = gy(-0.04);
// (near the body only what lies round the thigh's own line from its socket: the socket's rim is the body's)
const sector = (L, p) => p[1] < below && ((segDist(p, L.hip, L.knee) < 0.06 * S && L.s(p) > -0.02 * S) || (L.s(p) > 0.09 * S && Math.abs(L.lat(p)) < 0.11 * S));
// (a dropped leg: all that lies round its line from its socket down to its foot, out of the socket's mouth)
const dropSector = (D, p) => p[1] < below && D.s(p) > T.socket * S && D.near(p) < 0.1 * S;
const legIndex = (p) => { let best = -1, d = Infinity; LEGS.forEach((L, k) => { if (!sector(L, p)) return; const e = Math.abs(L.lat(p)); if (e < d) { d = e; best = k; } }); return best; };
const hipF = (L, p) => L.s(p) - L.sHip;                                     // (> 0: out of the socket, the leg's)
const kneeF = (L, p) => Math.max(L.s(p) - L.sKnee, L.thighLow - p[1]);    // (> 0: the shin's)
const ankleF = (L, p) => L.ankleY - p[1];                                    // (> 0: the foot's)
const H = T.head, headF = (p) => Math.min(p[2] - (H.back - T.mid[1]) * S, H.half * S - Math.abs(p[0]), gy(H.top) - p[1]);   // (> 0: the head's)
const A = G(T.antenna.at), antennaF = (p) => Math.min(p[1] - A[1], T.antenna.r * S - Math.hypot(p[0] - A[0], p[2] - A[2]));
// ------------------------------------------------------------------ the cuts
let mesh = lod, split, drop = new Array(lod.I.length / 3).fill(false);
const midOf = (m, t) => [0, 1, 2].map((k) => (m.P[m.I[t * 3] * 3 + k] + m.P[m.I[t * 3 + 1] * 3 + k] + m.P[m.I[t * 3 + 2] * 3 + k]) / 3);
const anyIn = (pred) => (t) => [0, 1, 2].some((q) => { const v = mesh.I[t * 3 + q]; return pred([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]); });
// (the back pair cut off at their sockets' mouths)
for (const D of DROP) { split = splitAlong(mesh, (p) => D.s(p) - T.socket * S, anyIn((p) => p[1] < below && D.near(p) < 0.11 * S)); mesh = split.mesh; drop = carry(drop, split); }
for (const [k, L] of LEGS.entries()) for (const Fn of [(p) => hipF(L, p), (p) => kneeF(L, p), (p) => ankleF(L, p)]) {
  split = splitAlong(mesh, Fn, anyIn((p) => legIndex(p) === k)); mesh = split.mesh; drop = carry(drop, split);
}
split = splitAlong(mesh, headF, anyIn((p) => p[2] > (H.back - T.mid[1] - 0.05) * S && p[1] < gy(0))); mesh = split.mesh; drop = carry(drop, split);
split = splitAlong(mesh, antennaF, anyIn((p) => p[1] > A[1] - 0.05 * S)); mesh = split.mesh; drop = carry(drop, split);
// ------------------------------------------------------------------ each triangle's part
let nt = mesh.I.length / 3;
const part = new Array(nt);
// (the dropped legs' roots inside their sockets too: the sage there, near the socket's middle)
const raw = triangleRoles(mesh, F.m.tex, TONES);
for (let t = 0; t < nt; t++) {
  const p = midOf(mesh, t);
  if (DROP.some((D) => dropSector(D, p) || ((raw[t] === 'sage' || raw[t] === 'dark' || raw[t] === 'olive') && V.len(V.sub(p, D.hip)) < 0.12 * S && p[1] < below))) { part[t] = 'gone'; continue; }
  if (antennaF(p) > 0) { part[t] = 'antenna'; continue; }
  const k = legIndex(p);
  if (k >= 0 && hipF(LEGS[k], p) > 0) { const L = LEGS[k]; part[t] = ankleF(L, p) > 0 ? `foot${k}` : kneeF(L, p) > 0 ? `shin${k}` : `thigh${k}`; continue; }
  part[t] = headF(p) > 0 ? 'head' : 'body';
}
// (the dropped legs' triangles left out, their vertices with them)
{ const keepT = []; for (let t = 0; t < nt; t++) if (part[t] !== 'gone') keepT.push(t);
  const used = new Int32Array(mesh.n).fill(-1); let nv = 0; for (const t of keepT) for (let q = 0; q < 3; q++) { const v = mesh.I[t * 3 + q]; if (used[v] < 0) used[v] = nv++; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2);
  for (let v = 0; v < mesh.n; v++) { const j = used[v]; if (j < 0) continue; P.set(mesh.P.subarray(v * 3, v * 3 + 3), j * 3); N.set(mesh.N.subarray(v * 3, v * 3 + 3), j * 3); UV.set(mesh.UV.subarray(v * 2, v * 2 + 2), j * 2); }
  const I = new Uint32Array(keepT.length * 3); keepT.forEach((t, i) => { for (let q = 0; q < 3; q++) I[i * 3 + q] = used[mesh.I[t * 3 + q]]; });
  const kept = keepT.map((t) => part[t]); part.length = 0; part.push(...kept);
  mesh = { P, N, UV, I, n: nv, error: mesh.error }; nt = keepT.length; }
// ------------------------------------------------------------------ the colour roles: the reference's five; the painted eye out
let role = triangleRoles(mesh, F.m.tex, TONES, (r, p, t) => {
  if (part[t] === 'head' && (r === 'orange' || r === 'dark' || r === 'olive')) return 'ceramic';   // (the painted eye and its shade: the head's ceramic)
  if (r === 'cream' || r === 'shade') return 'ceramic';
  if (r === 'sage') return 'leg';
  if (r === 'band') return 'band';
  if (r === 'pink') return 'socket';
  if (r === 'orange') return 'ceramic';
  return 'joint';   // (dark, olive: the joints, the stems, the antenna's stalk)
});
const nb = neighbours(mesh);
role = foldLone(role, nb, part, 3);
// ------------------------------------------------------------------ the weights
const joints = [
  ...LEGS.flatMap((L, k) => [
    { a: BI.body, b: BI[`thigh${k}`], F: (p) => hipF(L, p), near: (p) => sector(L, p) },
    { a: BI[`thigh${k}`], b: BI[`shin${k}`], F: (p) => kneeF(L, p), near: (p) => sector(L, p) && hipF(L, p) > 0 },
    { a: BI[`shin${k}`], b: BI[`foot${k}`], F: (p) => ankleF(L, p), near: (p) => sector(L, p) },
  ]),
  { a: BI.body, b: BI.head, F: headF, near: (p) => p[2] > 0 && p[1] < gy(0.02) && legIndex(p) < 0 },
];
const BLEND = 0.02;
const { J, W } = bakeWeights(mesh, part.map((q) => BI[q]), joints, BLEND);
// ------------------------------------------------------------------ the landmarks
const pts = (want) => { const out = []; for (let t = 0; t < nt; t++) if (want(t)) for (let k = 0; k < 3; k++) { const v = mesh.I[t * 3 + k]; out.push([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]); } return out; };
const domeTop = Math.max(...pts((t) => part[t] === 'body').map((p) => p[1]));
// (each eye on the head's surface: its most outward point at the painted dot's height and depth)
const headPts = pts((t) => part[t] === 'head');
const eyes = H.eyes.map((e) => { const g = G(e); let best = null, d = -Infinity; for (const p of headPts) if (Math.abs(p[1] - g[1]) < 0.02 && Math.abs(p[2] - g[2]) < 0.03 && p[0] * Math.sign(g[0]) > d) { d = p[0] * Math.sign(g[0]); best = p; } return r4(best ?? g); });
const ORDER = ['ceramic', 'leg', 'joint', 'band', 'socket'];
const G2 = grouped(mesh, role, ORDER);
const COL = roleColours(mesh, role, PALETTE);
const tex = await texture(F.m, 1024, 3);
const { paint } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => role[t]);
const png = await flatPng(paint, tex.W, tex.H);
let top = 0; for (let v = 0; v < mesh.n; v++) top = Math.max(top, mesh.P[v * 3 + 1]);
const landmarks = {
  frame: 'game: +z ahead, +y up, metres, feet on y 0, as built (drawn ×1.5: GROWN)', scale: +S.toFixed(5), height: HEIGHT, top: +top.toFixed(4), dome: +domeTop.toFixed(4), bones: BONES, blend: BLEND,
  legs: LEGS.map((L, k) => ({ side: k % 2 ? -1 : 1, hip: r4(L.hip), knee: r4(L.knee), ankle: r4(L.ankle), foot: r4(L.foot) })),
  dropped: DROP.map((D) => ({ at: r4(D.hip), out: r4(D.u) })),
  head: { pivot: r4(G(H.pivot)), back: +((H.back - T.mid[1]) * S).toFixed(4) }, eyes, antenna: { at: r4(A) },
  parts: G2.parts, palette: PALETTE,
};
writeFileSync(join(HERE, 'crawler-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'crawler-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL, JOINTS_0: J, WEIGHTS_0: W }, indices: G2.indices, image: png, name: 'survey crawler tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-crawler/tripo-seed7/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'crawler-lod.glb'), glb);
const count = {}; part.forEach((q) => { count[q] = (count[q] ?? 0) + 1; });
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3, dropped: F.dropped }, lod: { vertices: mesh.n, triangles: nt, bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  scale: +S.toFixed(4), parts: G2.parts, bones: count, eyes, top, dome: domeTop }));
if (process.env.DEBUG_PARTS) for (const name of Object.keys(count)) { const b = box(pts((t) => part[t] === name)); console.log(name.padEnd(8), r4(b.lo).join(' '), '|', r4(b.hi).join(' ')); }
