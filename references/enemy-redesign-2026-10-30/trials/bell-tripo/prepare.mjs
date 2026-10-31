// #800 family D: the bell walker's Tripo export (keep-bell/tripo/model.glb, untouched) made into the game's asset
// (public/enemies/bell/body.glb + landmarks.json, loaded by src/enemies/foe-assets.js; the flat texture's picture stays
// here), by the shared steps (../machine-tripo/prep.mjs), a machine's rigid parts cut by geometry:
//
// 1. The game's frame: Tripo's +x ahead (the bell's side, the spirit under its mouth) -> +z, feet on y 0, HEIGHT m to
//    the arch's top, centred between its four feet.
// 2. The texture's roles (by hue and lightness, a 7 × 7 majority): the sage of the legs and the machine behind, its
//    dark, the pink bell, the cream arch, the brass rings, the spirit's black (its painted eye slits painted out: they
//    become the model's own).
// 3. 12,000 triangles by the geometry alone.
// 4. The parts by geometry: the spirit (the black ball under the bell's mouth: a sphere fitted to it), each leg (outboard
//    of the body over its foot) cut across at the knee and the ankle, the arch (the band in the bell's middle plane,
//    outside the bell's radius: a surface of revolution measured round its axis), the bell's dome (inside that radius,
//    over the skirt), the rest the hull (the machine behind, the skirt, the knobs and shafts).
// 5. Repainted in the reference's flat colours (keep-bell/b4852320-…-1.png, sampled); swatches for the model's own parts.
// 6. COLOR_0; JOINTS_0/WEIGHTS_0: each part on its own bone, blended across the knees and ankles.
// 7. The landmarks: the legs, the cuts, the bell's axis, profile and pins, the arch's curve, the spirit's sphere.
//
//   node references/enemy-redesign-2026-10-30/trials/bell-tripo/prepare.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, partition, paint, weights, write, ring, radiusAt, fitSphere, planeBlend, V3, r3 } from '../machine-tripo/prep.mjs';
import { BELL_PARTS as PARTS, BELL_HOME } from '../../../../src/enemies/plans/bell-tripo.js';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-bell/tripo/model.glb'), OUT = join(ROOT, 'public/enemies/bell');
const HEIGHT = 3.4, BLEND = 0.06, KNEE = Number(process.env.KNEE ?? 0.88), ANKLE = Number(process.env.ANKLE ?? 0.22);
const ROLES = ['green', 'dark', 'pink', 'cream', 'brass', 'black'];
const roleOf = (r, g, b) => {
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  if (l < 28) return 5;
  if (r > 225 && g > 195 && b < 170) return 3;
  if (r > 165 && r > g + 12 && b > 90) return 2;
  if (r > 95 && r >= g - 6 && b < r - 30) return 4;
  if (l < 62) return 1;
  return 0;
};
const m = await load(IN, { height: HEIGHT, roleOf, roles: ROLES });

// ---------------------------------------------------------------- the legs: each corner's column
const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
const colAt = (sx, sz, y0, y1) => { let n = 0, x = 0, z = 0; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (p[1] < y0 || p[1] >= y1 || Math.sign(p[0]) !== sx || Math.sign(p[2]) !== sz || Math.abs(p[0]) < 0.82) continue; n++; x += p[0]; z += p[2]; } return n ? [x / n, z / n] : null; };
const legs = corners.map(([sx, sz]) => {
  const f = colAt(sx, sz, 0, 0.08), a = colAt(sx, sz, ANKLE - 0.05, ANKLE + 0.05) ?? f, k = colAt(sx, sz, KNEE - 0.05, KNEE + 0.05) ?? a, h = colAt(sx, sz, 1.35, 1.5) ?? k;
  return { sx, sz, hip: r3([h[0], 1.45, h[1]]), knee: r3([k[0], KNEE, k[1]]), ankle: r3([a[0], ANKLE, a[1]]), foot: r3([f[0], 0, f[1]]) };
});
const legOf = (p) => { if (p[1] > 1.65 || Math.abs(p[0]) < 0.84) return -1; let best = -1, d = 0.45; legs.forEach((L, k) => { const e = Math.hypot(p[0] - L.foot[0], p[2] - L.foot[2]); if (e < d) { d = e; best = k; } }); return best; };
// ---------------------------------------------------------------- the spirit: a sphere fitted to the black under the bell
const blackPts = []; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (m.role[v] === 5 && Math.abs(p[0]) < 0.55 && p[1] > 0.4 && p[1] < 1.6 && p[2] > 0) blackPts.push(p); }
const spirit = fitSphere(blackPts);
const isSpirit = (p) => V3.len(V3.sub(p, spirit.centre)) < spirit.r + 0.03 && p[1] < spirit.centre[1] + spirit.r * 0.75;
// ---------------------------------------------------------------- the bell: its axis, its radius by height (the arch's two azimuths left out)
let zc = 0, zn = 0; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (m.role[v] === 2 && p[1] > 2.3 && Math.abs(p[0]) < 0.5) { zc += p[2]; zn++; } } zc /= zn;
const prof = (() => { const rows = new Map(), step = 0.03;
  for (let v = 0; v < m.n; v++) { const p = m.at(v); if (p[1] < 1.0) continue; const dx = p[0], dz = p[2] - zc, a = Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * 24) % 24;
    // (the arch's azimuths, straight out to either side, and the machine behind, left out)
    if (a === 5 || a === 6 || a === 17 || a === 18 || dz < -0.25) continue;
    const k = Math.floor(p[1] / step); if (!rows.has(k)) rows.set(k, new Float32Array(24)); const r = rows.get(k); r[a] = Math.max(r[a], Math.hypot(dx, dz)); }
  return [...rows.keys()].sort((a, b) => a - b).map((k) => { const r = [...rows.get(k)].filter((x) => x > 0).sort((a, b) => a - b); return [+((k + 0.5) * step).toFixed(3), +(r.length ? r[r.length >> 1] : 0).toFixed(3)]; }); })();
const bellR = (y) => radiusAt(prof, y);
// (the skirt's top: where the bell's radius steps out, going down, past the dome's flare)
let skirtTop = 1.7; for (const [y, r] of prof) if (y > 1.4 && y < 2.2 && r > 0) { /* scanned below */ }
{ let best = 0; for (let i = 1; i < prof.length; i++) { const [y, r] = prof[i], d = prof[i - 1][1] - r; if (y > 1.45 && y < 2.1 && d > best) { best = d; skirtTop = prof[i][0]; } } }
// (the crown's top: the narrowest of the profile over 2.9 m, the knob's neck, before the arch passes over it; over it all is the arch's)
const domeTop = prof.filter(([y, r]) => y > 2.9 && y < 3.15 && r > 0).reduce((a, b) => (b[1] < a[1] ? b : a), [3, 9])[0] + 0.02;
const isArch = (p) => p[1] > skirtTop - 0.12 && Math.abs(p[2] - zc) < 0.16 && (Math.hypot(p[0], p[2] - zc) > bellR(Math.min(p[1], domeTop)) + 0.025 || p[1] > domeTop + 0.03) && Math.abs(p[0]) < 0.95;
const isDome = (p) => p[1] > skirtTop && p[1] < domeTop && p[2] > zc - 0.9 && Math.hypot(p[0], p[2] - zc) < bellR(p[1]) + 0.02;
// (Tripo's web across the arch's inside, by its top: what lies in the arch's plane well inside its outer edge, the
//  edge measured as the outermost arch point at each height: dropped)
const outer = new Map(); for (let v = 0; v < m.n; v++) { const p = m.at(v); if (!isArch(p) || isDome(p)) continue; const k = Math.round(p[1] / 0.05); outer.set(k, Math.max(outer.get(k) ?? 0, Math.abs(p[0]))); }
let archTopY = 0; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (isArch(p)) archTopY = Math.max(archTopY, p[1]); }
const isWeb = (p) => isArch(p) && p[1] < archTopY - 0.16 && Math.abs(p[0]) < (outer.get(Math.round(p[1] / 0.05)) ?? 0) - 0.2;
// ---------------------------------------------------------------- the parts
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
partition(m, (v) => {
  const p = m.at(v);
  const k = legOf(p);
  if (k >= 0) { const L = legs[k]; return PI[p[1] > L.knee[1] ? `thigh${k}` : p[1] > L.ankle[1] ? `shin${k}` : `foot${k}`]; }
  if (isSpirit(p)) return PI.spirit;
  if (isWeb(p)) return 255;
  if (isArch(p)) return PI.arch;
  if (isDome(p)) return PI.dome;
  return PI.hull;
}, PARTS, { strict: ['spirit', 'arch'], bridges: [['arch', 'dome']] });   // (Tripo filled half the arch's inside with a web to the dome)
// the spirit hung SPIRIT_DROP m lower than Tripo sat it, its painted eyes clear of the skirt's lip (from above, where the
// traveller's camera is, the skirt hid them)
const SPIRIT_DROP = 0.08;
{ const [first, count] = m.parts.spirit, seen = new Set(); for (let t = first; t < first + count; t++) for (let k = 0; k < 3; k++) { const v = m.I[t * 3 + k]; if (!seen.has(v)) { seen.add(v); m.P[v * 3 + 1] -= SPIRIT_DROP; } } }
spirit.centre[1] = +(spirit.centre[1] - SPIRIT_DROP).toFixed(3);
// the arch's curve: its points' middle per height on either side, and its top
const archPts = []; for (let v = 0; v < m.n; v++) if (m.vpart[v] === PI.arch) archPts.push(m.at(v));
const archY0 = Math.min(...archPts.map((p) => p[1])), archTop = Math.max(...archPts.map((p) => p[1]));
const archCurve = []; for (let i = 0; i <= 12; i++) { const y = archY0 + ((archTop - archY0) * i) / 12; for (const s of [-1, 1]) { const q = archPts.filter((p) => Math.abs(p[1] - y) < 0.08 && Math.sign(p[0]) === s); if (q.length) archCurve.push(r3([q.reduce((a, p) => a + p[0], 0) / q.length, y, q.reduce((a, p) => a + p[2], 0) / q.length])); } }
// the spirit's painted eyes: its pale texels (they are painted out; the model lays slit eyes there)
const eyePts = []; for (let v = 0; v < m.n; v++) { if (m.vpart[v] !== PI.spirit) continue; const p = m.at(v); if (m.role[v] !== 5 && m.role[v] !== 1 && p[2] > spirit.centre[2]) eyePts.push(p); }
const eyes = [-1, 1].map((s) => { const q = eyePts.filter((p) => Math.sign(p[0]) === s); if (!q.length) return null; return r3([0, 1, 2].map((i) => q.reduce((a, p) => a + p[i], 0) / q.length)); });
// ---------------------------------------------------------------- repainted, the reference's flat colours
const H = BELL_HOME, PALETTE = { body: H.body, dark: H.dark, bell: H.bell, arch: H.arch, brass: H.brass, spirit: H.spirit };
const SWATCH = { body: H.body, dark: H.dark, bell: H.bell, arch: H.arch, brass: H.brass, spirit: H.spirit, eye: H.eye };
await paint(m, (part, role) => {
  if (part === 'spirit') return 'spirit';
  if (part === 'arch') return 'arch';
  if (part === 'dome') return role === 'brass' ? 'brass' : 'bell';
  if (part.startsWith('thigh') || part.startsWith('shin') || part.startsWith('foot')) return role === 'brass' ? 'brass' : role === 'black' || role === 'dark' ? 'dark' : 'body';
  // (the hull: the skirt pink, the machine sage with its dark, the knobs and rings brass, the cream of the arch's feet)
  return role === 'pink' ? 'bell' : role === 'cream' ? 'arch' : role === 'brass' ? 'brass' : role === 'black' ? 'dark' : role === 'dark' ? 'dark' : 'body';
}, PALETTE, SWATCH);
// ---------------------------------------------------------------- the weights: each part its bone, blended at the knees and ankles
const cuts = {};
legs.forEach((L, k) => {
  cuts[`knee${k}`] = ring(m, { at: L.knee, n: [0, -1, 0] }, [PI[`thigh${k}`], PI[`shin${k}`]], 0.45);
  cuts[`ankle${k}`] = ring(m, { at: L.ankle, n: [0, -1, 0] }, [PI[`shin${k}`], PI[`foot${k}`]], 0.45);
});
weights(m, PI, (v, part, p) => {
  const k = +part.slice(-1);
  if (part.startsWith('thigh')) return planeBlend(p, legs[k].knee, [0, -1, 0], BLEND, PI[part], PI[`shin${k}`]);
  if (part.startsWith('shin')) return planeBlend(p, legs[k].knee, [0, -1, 0], BLEND, PI[`thigh${k}`], PI[part]) ?? planeBlend(p, legs[k].ankle, [0, -1, 0], BLEND, PI[part], PI[`foot${k}`]);
  if (part.startsWith('foot')) return planeBlend(p, legs[k].ankle, [0, -1, 0], BLEND, PI[`shin${k}`], PI[part]);
  return null;
});
// ---------------------------------------------------------------- the landmarks; the files
const landmarks = {
  frame: 'game: +z ahead, +y up, metres, feet on y 0, centred between the feet', scale: m.S, shift: m.shift, height: HEIGHT,
  legs: legs.map(({ hip, knee, ankle, foot }) => ({ hip, knee, ankle, foot })), cuts,
  bell: { axisZ: +zc.toFixed(3), skirtTop, domeTop, profile: prof.filter((_, i) => i % 2 === 0) },
  arch: { y0: +archY0.toFixed(3), top: +archTop.toFixed(3), curve: archCurve },
  spirit: { ...spirit, eyes },
  parts: m.parts, partNames: PARTS, palette: PALETTE, swatches: m.swatches, swatchColours: SWATCH,
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const sum = write(join(OUT, 'body.glb'), join(HERE, 'flat-texture.png'), m, { name: 'bell walker tripo', source: 'references/enemy-redesign-2026-10-30/keep-bell/tripo/model.glb', task: '63c37cb8-1f93-478f-8fc3-00e9d53434b6' });
console.log(JSON.stringify({ ...sum, legs, spirit, eyes, bell: { zc, skirtTop, domeTop }, arch: { archY0, archTop, n: archPts.length } }, null, 0));
