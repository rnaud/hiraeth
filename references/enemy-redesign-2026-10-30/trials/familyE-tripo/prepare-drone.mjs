// #800 family E: the spool drone's Tripo export (keep-drone/tripo/model.glb, untouched, task e25f40fd-…) made into the
// game's asset (drone-lod.glb, drone-texture.png, drone-landmarks.json beside this script), by prep-machine.mjs's steps:
//
// 1. the game's frame: Tripo's +x ahead (its eye and its nozzle) → +z, its plates' axis over the origin, scaled to a
//    plate PLATE m across, its lowest point BASE m over the model's origin (it hovers: the foe's hover lifts it);
// 2. 12,000 triangles by geometry alone;
// 3. its rigid parts cut by geometry, each exactly on its cut: the top plate (with its slate cap) over the core, the
//    bottom plate (with its nozzle and the pod under it) under the core, and the core between them, the dark heart that
//    turns to look at the traveller (a level cut each side of it, where the plates' flat faces meet it);
// 4. one flat colour a role, the reference's (measured off the approved image): the cream plates, the slate cap, the
//    dark core, the olive-brown pod; the painted eye (an orange oval with a black slit) painted out: the eye is the
//    model's own part on the core;
// 5. the skin's weights: each vertex wholly on its part's bone (the plates part from the core: no blend);
// 6. the landmarks: each plate's centre and radius, the core's centre and radius, the eye's place and size, the nozzle's
//    mouth and its axis.
//
//   node references/enemy-redesign-2026-10-30/trials/familyE-tripo/prepare-drone.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from '../shellback-tripo/glb.mjs';
import { texture, repaint, flatPng } from '../familyA-tripo/prep-kit.mjs';
import { readFramed, decimate, splitAlong, carry, triangleRoles, neighbours, foldLone, bakeWeights, grouped, roleColours, box, nearestRole, r4 } from './prep-machine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-drone/tripo/model.glb');
const TASK = 'e25f40fd-10e8-48c5-8abc-61733fd0cdd1';
/** A plate across (m): the old ring drone's plates were 1.2 m; its lowest point over the model's origin (m). */
export const PLATE = 1.4, BASE = 0.25;
const TARGET = 12000;
/** The approved image's flat colours (pick-colours.mjs): the cream plates, the slate cap, the dark green-black core, the olive-brown pod. */
export const PALETTE = { plate: '#ecc7a9', cap: '#4e5d63', core: '#1d2b26', pod: '#6a4a2e' };
const TONES = nearestRole({ cream: '#e8b890', shade: '#b08a68', slate: '#556068', core: '#1e3026', eye: '#d08020', pupil: '#100c08', olive: '#5a5030' });
export const BONES = ['body', 'top', 'core', 'bottom'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

// ------------------------------------------------------------------ the landmarks in Tripo's frame (islands.mjs)
const T = { axis: [-0.045, -0.004], radius: 0.45, lo: -0.356, topCut: 0.079, bottomCut: -0.041,   // (the cuts just past the plates' flat faces: each plate whole, the core's caps with them)
  core: { at: [-0.085, 0.017, 0], r: 0.287 }, eye: { at: [0.2, 0.035, -0.002], h: 0.12, w: 0.07 }, nozzle: { mouth: [0.5, -0.167, 0.065], root: [0.38, -0.162, 0.05] } };
const S = PLATE / (2 * T.radius);
/** Tripo's frame → the game's: +x ahead → +z, its +z → −x; the plates' axis over the origin, its lowest point at BASE. */
const toGame = (x, y, z) => [-(z - T.axis[1]) * S, (y - T.lo) * S + BASE, (x - T.axis[0]) * S];
const turn = (x, y, z) => [-z, y, x];
const G = (p) => toGame(...p);

const F = await readFramed(IN, { roleOf: TONES, toGame, turn, drop: (pc) => pc.tris < 60 });
const lod = await decimate(F.m, F.P, F.N, TARGET);
// ------------------------------------------------------------------ the cuts: a level each side of the core
const topY = (T.topCut - T.lo) * S + BASE, botY = (T.bottomCut - T.lo) * S + BASE;
let mesh = lod, split = splitAlong(mesh, (p) => p[1] - topY);
mesh = split.mesh; let side = split.side.slice();
split = splitAlong(mesh, (p) => p[1] - botY); mesh = split.mesh; side = carry(side, split);
const nt = mesh.I.length / 3, mid = (t) => [0, 1, 2].map((k) => (mesh.P[mesh.I[t * 3] * 3 + k] + mesh.P[mesh.I[t * 3 + 1] * 3 + k] + mesh.P[mesh.I[t * 3 + 2] * 3 + k]) / 3);
const part = new Array(nt);
for (let t = 0; t < nt; t++) { const y = mid(t)[1]; part[t] = y > topY ? 'top' : y < botY ? 'bottom' : 'core'; }
// ------------------------------------------------------------------ the colour roles; the painted eye out
const capZ = (-0.0725 - T.axis[0]) * S, capY = (0.296 - T.lo) * S + BASE, podY = (-0.272 - T.lo) * S + BASE;   // (the plates' outer flat faces: Tripo's 0.299 and −0.276)
const eye = G(T.eye.at), eyeR = Math.max(T.eye.h, T.eye.w) * S * 0.75;
let role = triangleRoles(mesh, F.m.tex, TONES, (r, p, t) => {
  if (part[t] === 'core') return 'core';   // (the core all its own dark: the painted eye and its shades in it painted out)
  // (the cap and the pod by geometry: the dome over the top plate's flat face, the pod under the bottom plate's)
  if (part[t] === 'top' && p[1] > capY && Math.hypot(p[0], p[2] - capZ) < 0.225 * S) return 'cap';
  if (part[t] === 'bottom' && p[1] < podY && Math.hypot(p[0], p[2]) < 0.3 * S) return 'pod';
  if (r === 'core' || r === 'pupil') return 'core';   // (the core's caps over and under it, on the plates' bones)
  if (r === 'cream' || r === 'shade') return 'plate';
  if (r === 'slate') return part[t] === 'top' && p[1] > topY + 0.25 * S ? 'cap' : 'plate';   // (the cap on top; slate specks on the plates' undersides: the plate's)
  if (r === 'olive' || r === 'eye') return part[t] === 'bottom' && p[1] < botY - 0.15 * S ? 'pod' : 'plate';
  return 'plate';
});
const nb = neighbours(mesh);
role = foldLone(role, nb, part, 3);
// ------------------------------------------------------------------ the weights: each vertex its part's, wholly
const { J, W } = bakeWeights(mesh, part.map((q) => BI[q]), [], 0.01);
// ------------------------------------------------------------------ the landmarks
const pts = (want) => { const out = []; for (let t = 0; t < nt; t++) if (want(t)) for (let k = 0; k < 3; k++) { const v = mesh.I[t * 3 + k]; out.push([mesh.P[v * 3], mesh.P[v * 3 + 1], mesh.P[v * 3 + 2]]); } return out; };
const plateBox = (name) => { const b = box(pts((t) => part[t] === name && role[t] === 'plate')); return { lo: +b.lo[1].toFixed(4), hi: +b.hi[1].toFixed(4), r: +((b.hi[0] - b.lo[0]) / 2).toFixed(4) }; };
const coreBox = box(pts((t) => part[t] === 'core'));
// (the core's front where the eye sits: its most forward point near the eye's height)
let front = -Infinity; for (const p of pts((t) => part[t] === 'core')) if (Math.abs(p[0] - eye[0]) < 0.05 && Math.abs(p[1] - eye[1]) < 0.06) front = Math.max(front, p[2]);
const ORDER = ['plate', 'cap', 'core', 'pod'];
// (the plates' triangles split by plate: the top's and the bottom's their own meshes, each world's tint its own)
const key = role.map((r, t) => (r === 'plate' ? (part[t] === 'top' ? 'plateTop' : 'plateBottom') : r));
const G2 = grouped(mesh, key, ['plateTop', 'plateBottom', 'cap', 'core', 'pod']);
const COL = roleColours(mesh, role, PALETTE);
const tex = await texture(F.m, 1024, 3);
const { paint } = repaint(mesh, tex, PALETTE, (p, n, rgb, t) => role[t]);
const png = await flatPng(paint, tex.W, tex.H);
let top = 0, low = Infinity; for (let v = 0; v < mesh.n; v++) { top = Math.max(top, mesh.P[v * 3 + 1]); low = Math.min(low, mesh.P[v * 3 + 1]); }
const landmarks = {
  frame: 'game: +z ahead, +y up, metres; its lowest point at BASE over the origin (it hovers)', scale: +S.toFixed(5), plate: PLATE, base: BASE, top: +top.toFixed(4), low: +low.toFixed(4), bones: BONES,
  cuts: { top: +topY.toFixed(4), bottom: +botY.toFixed(4) }, plates: { top: plateBox('top'), bottom: plateBox('bottom') },
  core: { at: r4(G(T.core.at)), r: +(T.core.r * S).toFixed(4), lo: r4(coreBox.lo), hi: r4(coreBox.hi) },
  eye: { at: r4([eye[0], eye[1], front]), h: +(T.eye.h * S).toFixed(4), w: +(T.eye.w * S).toFixed(4) },
  nozzle: { mouth: r4(G(T.nozzle.mouth)), root: r4(G(T.nozzle.root)) },
  parts: G2.parts, palette: PALETTE, roles: ORDER,
};
writeFileSync(join(HERE, 'drone-landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
writeFileSync(join(HERE, 'drone-texture.png'), png);
const glb = writeGlb({ attrs: { POSITION: mesh.P, NORMAL: mesh.N, TEXCOORD_0: mesh.UV, COLOR_0: COL, JOINTS_0: J, WEIGHTS_0: W }, indices: G2.indices, image: png, name: 'spool drone tripo lod',
  extras: { source: 'references/enemy-redesign-2026-10-30/keep-drone/tripo/model.glb', task: TASK, triangles: nt, simplifyError: +lod.error.toFixed(5) } });
writeFileSync(join(HERE, 'drone-lod.glb'), glb);
const count = {}; part.forEach((q) => { count[q] = (count[q] ?? 0) + 1; });
console.log(JSON.stringify({ source: { vertices: F.n, triangles: F.m.I.length / 3, dropped: F.dropped }, lod: { vertices: mesh.n, triangles: nt, bytes: glb.length, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) },
  scale: +S.toFixed(4), parts: G2.parts, bones: count, eye: landmarks.eye, core: landmarks.core, plates: landmarks.plates, nozzle: landmarks.nozzle, top, low }));
