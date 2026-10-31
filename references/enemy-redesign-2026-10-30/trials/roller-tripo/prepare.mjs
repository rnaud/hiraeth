// #800 family D: the pearl roller's Tripo export (keep-roller/tripo/model.glb, untouched) made into the game's asset
// (public/enemies/roller/body.glb + landmarks.json, loaded by src/enemies/foe-assets.js; the flat texture's picture stays
// here), by the shared steps (../machine-tripo/prep.mjs): a snail is not a machine, but nothing in it bends at a joint
// either, so it takes the machines' rigid parts (the trials' rule for rolling plans), blended where the soft foot ripples:
//
// 1. The game's frame: Tripo drew this one facing its -z (its head and eye stalks there) -> +z, feet on y 0, HEIGHT m to
//    the shell's top; Tripo's ground puddle (a flat sheet round its foot, the reference's shadow taken for a thing) left out.
// 2. The texture's roles: the shell's pale green, its spiral's dark lines, the foot's olive and its folds' dark, the head
//    and stalks' terracotta, the eyeballs' cream, the pupils' black (painted out: the model's own pupils turn).
// 3. 12,000 triangles by the geometry alone.
// 4. The parts by geometry: the shell (a sphere fitted to its pale top, all that lies on it and over the foot), the head
//    (the terracotta face in front, a sphere fitted to it), each eye stalk and each eyeball (fitted spheres at the stalks'
//    tips), the foot in three lengths, front, middle and back (planes across it), so its ripple runs along it.
// 5. Repainted in the reference's flat colours (keep-roller/f586ce93-…-1.png, sampled).
// 6. COLOR_0; JOINTS_0/WEIGHTS_0: each part on its own bone, the foot's lengths blended 10 cm across their planes.
// 7. The landmarks: the shell's sphere and its spiral's eye (its side), the head's, the stalks' bases and tips, the eyes'.
//
//   node references/enemy-redesign-2026-10-30/trials/roller-tripo/prepare.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTripo } from '../shellback-tripo/glb.mjs';
import { load, partition, paint, weights, write, fitSphere, planeBlend, V3, r3 } from '../machine-tripo/prep.mjs';
import { ROLLER_PARTS as PARTS, ROLLER_HOME } from '../../../../src/enemies/plans/roller-tripo.js';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-roller/tripo/model.glb'), OUT = join(ROOT, 'public/enemies/roller');
// (its height set so its shell's radius is the roller plan's, 0.7 m: its roll locked to the ground, a shell 1.4 m across
//  as tall as the traveller's chest; the fitted radius is 0.792 m at 1.55 m)
const HEIGHT = Number(process.env.HEIGHT ?? 1.37), BLEND = 0.1;
const ROLES = ['shell', 'line', 'foot', 'fold', 'head', 'eye', 'pupil'];
const roleOf = (r, g, b) => {
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  if (l < 26) return 6;
  if (r > g + 25 && r > b + 40) return 4;
  if (r > 190 && g > 190 && b < 175 && r >= g - 10) return 5;
  if (g > r + 18 && b > r && l > 150) return 0;
  if (l < 70) return 3;
  if (g > r + 18 && b > r + 10) return 1;
  return 2;
};
// Tripo's ground puddle: in the export's own units, the flat sheet under 2 % of its height, outside the foot's outline
// (each azimuth's outermost point a little above the ground)
const raw = await readTripo(IN), nr = raw.P.length / 3;
let lo = Infinity, hi = -Infinity; for (let v = 0; v < nr; v++) { lo = Math.min(lo, raw.P[v * 3 + 1]); hi = Math.max(hi, raw.P[v * 3 + 1]); }
const H0 = hi - lo, outline = new Float32Array(48);
for (let v = 0; v < nr; v++) { const y = (raw.P[v * 3 + 1] - lo) / H0; if (y < 0.03 || y > 0.09) continue; const x = raw.P[v * 3], z = raw.P[v * 3 + 2], a = Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * 48) % 48; outline[a] = Math.max(outline[a], Math.hypot(x, z)); }
const S0 = HEIGHT / H0;
const drop = (p) => { if (p[1] > 0.035 * HEIGHT) return false; const x = -p[0] / S0, z = -p[2] / S0, a = Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * 48) % 48; return Math.hypot(x, z) > outline[a] * 1.02; };
const m = await load(IN, { height: HEIGHT, roleOf, roles: ROLES, facing: '-z', drop, centre: null });
// ---------------------------------------------------------------- the shell: a sphere fitted to its pale top
const top = []; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (m.role[v] === 0 && p[1] > 0.9) top.push(p); }
const shell = fitSphere(top);
const FOOT_TOP = 0.2 * HEIGHT;
const onShell = (p) => { const d = V3.len(V3.sub(p, shell.centre)); return d > shell.r - 0.16 && d < shell.r + 0.08 && p[1] > FOOT_TOP; };
// the eyeballs: the cream and the pupils' black high in front; the head: the terracotta under them; the stalks: over it
const eyePts = [[], []], terra = [];
for (let v = 0; v < m.n; v++) { const p = m.at(v), r = m.role[v]; if (p[2] < shell.centre[2] + 0.45) continue;
  if (r === 5 && p[1] > shell.centre[1]) eyePts[p[0] > 0 ? 1 : 0].push(p); else if (r === 4) terra.push(p); }
const eyes = eyePts.map((q) => fitSphere(q)), eyeLow = Math.min(...eyes.map((e) => e.centre[1] - e.r));
const head = fitSphere(terra.filter((p) => p[1] < eyeLow - 0.12));
const stalkPts = [0, 1].map((k) => terra.filter((p) => p[1] > head.centre[1] + head.r * 0.55 && Math.sign(p[0]) === Math.sign(eyes[k].centre[0]) && V3.len(V3.sub(p, eyes[k].centre)) > eyes[k].r + 0.015));
const stalks = [0, 1].map((k) => { const q = stalkPts[k]; const low = q.reduce((a, p) => (p[1] < a[1] ? p : a), eyes[k].centre); return { base: r3(low), tip: eyes[k].centre }; });
const inEye = (p, k) => V3.len(V3.sub(p, eyes[k].centre)) < eyes[k].r + 0.025;
const nearStalk = (p, k) => { const a = stalks[k].base, b = stalks[k].tip, ab = V3.sub(b, a), t = Math.max(0, Math.min(1, V3.dot(V3.sub(p, a), ab) / V3.dot(ab, ab))); return V3.len(V3.sub(p, V3.add(a, ab, t))) < 0.11 && p[1] > a[1] - 0.04; };
// the foot's three lengths along z
const FRONT = shell.centre[2] + 0.25, BACK = shell.centre[2] - 0.35;
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
partition(m, (v) => {
  const p = m.at(v);
  for (const k of [0, 1]) { if (inEye(p, k)) return PI[`eye${k}`]; if (nearStalk(p, k)) return PI[`stalk${k}`]; }
    if (V3.len(V3.sub(p, head.centre)) < head.r + 0.06 && p[2] > shell.centre[2] + 0.35 && p[1] > 0.04) {
    // (the shell's rim over the head lies on the shell's sphere and faces out of it; the head's face out of its own)
    const n = m.nor(v), out = (c) => V3.dot(n, V3.norm(V3.sub(p, c)));
    if (!(onShell(p) && out(shell.centre) > out(head.centre))) return PI.head;
  }
  if (onShell(p)) return PI.shell;
  return PI[p[2] > FRONT ? 'foot0' : p[2] > BACK ? 'foot1' : 'foot2'];
}, PARTS, { strict: ['eye0', 'eye1'] });
// the spiral's eye: the side of the shell where its dark lines gather, round the axis across it
const lines = []; for (let v = 0; v < m.n; v++) if (m.vpart[v] === PI.shell && m.role[v] === 1) lines.push(m.at(v));
const sideX = Math.sign(lines.reduce((a, p) => a + (p[0] - shell.centre[0]), 0)) || 1;
// ---------------------------------------------------------------- repainted, the reference's flat colours
const Hc = ROLLER_HOME, PALETTE = { shell: Hc.shell, line: Hc.line, foot: Hc.foot, fold: Hc.fold, head: Hc.head, eye: Hc.eye };
const SWATCH = { shell: Hc.shell, foot: Hc.foot, head: Hc.head, eye: Hc.eye, pupil: Hc.pupil, brass: Hc.brass };
await paint(m, (part, role) => {
  if (part === 'eye0' || part === 'eye1') return 'eye';
  if (part === 'head' || part.startsWith('stalk')) return 'head';
  if (part === 'shell') return role === 'line' || role === 'fold' || role === 'pupil' ? 'line' : 'shell';
  return role === 'fold' || role === 'pupil' ? 'fold' : 'foot';
}, PALETTE, SWATCH);
weights(m, PI, (v, part, p) => {
  if (part === 'foot0') return planeBlend(p, [0, 0, FRONT], [0, 0, -1], BLEND, PI.foot0, PI.foot1);
  if (part === 'foot1') return planeBlend(p, [0, 0, FRONT], [0, 0, -1], BLEND, PI.foot0, PI.foot1) ?? planeBlend(p, [0, 0, BACK], [0, 0, -1], BLEND, PI.foot1, PI.foot2);
  if (part === 'foot2') return planeBlend(p, [0, 0, BACK], [0, 0, -1], BLEND, PI.foot1, PI.foot2);
  return null;
});
const landmarks = {
  frame: 'game: +z ahead, +y up, metres, its foot on y 0', scale: m.S, shift: m.shift, height: HEIGHT,
  shell: { ...shell, spiralSide: sideX }, head, stalks, eyes, foot: { front: +FRONT.toFixed(3), back: +BACK.toFixed(3) },
  parts: m.parts, partNames: PARTS, palette: PALETTE, swatches: m.swatches, swatchColours: SWATCH,
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const sum = write(join(OUT, 'body.glb'), join(HERE, 'flat-texture.png'), m, { name: 'pearl roller tripo', source: 'references/enemy-redesign-2026-10-30/keep-roller/tripo/model.glb', task: 'bac43175-5270-46f9-a047-cdb348ab423d' });
console.log(JSON.stringify({ ...sum, shell, head, stalks, eyes, sideX }, null, 0));
