// #800 family D: the crucible walker's Tripo export (keep-cart/tripo/model.glb, untouched) made into the game's asset
// (public/enemies/cart/body.glb + landmarks.json, loaded by src/enemies/foe-assets.js; the flat texture's picture stays
// here), by the shared steps (../machine-tripo/prep.mjs), the wood cutter's route (a machine: rigid parts cut by geometry,
// blended across each cut):
//
// 1. The game's frame: Tripo's +x ahead (its eye unit's side) -> +z, feet on y 0, HEIGHT m to the rim, centred between
//    its four feet.
// 2. The texture's roles (by hue and lightness, a 7 × 7 majority): the sage hull, its creases' darker greens, the near
//    black of the eye, vents and the pot's inside, the orange brew. Remove Lighting was on, so the creases are Tripo's
//    folds, not its light: painted out (the game's ink draws them), the bands at the legs' joints kept dark green.
// 3. 12,000 triangles by the geometry alone.
// 4. The parts by geometry: the pot (a surface of revolution: its radius per height measured round it), the brew (the
//    pot's upturned floor inside the rim), the eye unit (what stands proud of the pot's surface over its front: it is
//    turned onto the front, azimuth 0, about the pot's axis, so it slides round the pot to look at you), each leg's thigh
//    (proud of the pot over its corner, or under the pot's floor), shin and foot (cut across by planes at the knee and
//    ankle bands, measured).
// 5. Repainted: the reference's own flat colours (keep-cart/13ed7341-…-3.png, sampled): sage #98a88b, the bands'
//    #40573c, the brew #d09770, the eye's and the vents' near black; swatches for the model's own parts.
// 6. COLOR_0; JOINTS_0/WEIGHTS_0: each part on its own bone, blended over BLEND m across the knee and ankle cuts and over
//    the hip's crease (by the thigh's height over the pot's surface), so a bent leg stays closed.
// 7. The landmarks: each leg's hip, knee, ankle and foot, the cuts' rings, the pot's profile, rim and brew, the eye
//    unit's (its centre, the eye's centre, radius and facing), the vents.
//
//   node references/enemy-redesign-2026-10-30/trials/cart-tripo/prepare.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, partition, paint, weights, write, ring, profile, radiusAt, planeBlend, V3, r3 } from '../machine-tripo/prep.mjs';
import { CART_PARTS as PARTS, CART_HOME } from '../../../../src/enemies/plans/cart-tripo.js';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '../../../..');
const IN = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-cart/tripo/model.glb'), OUT = join(ROOT, 'public/enemies/cart');
const HEIGHT = 2.0, BLEND = 0.05, HIP_BLEND = 0.1, KNEE = 0.52, ANKLE = 0.21;
const ROLES = ['body', 'shade', 'black', 'brew'];
const roleOf = (r, g, b) => {
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  if (r > g + 15 && r > b + 40) return 3;
  if (l < 45) return 2;
  if (l < 80) return 1;
  return 0;
};
const m = await load(IN, { height: HEIGHT, roleOf, roles: ROLES });

// ---------------------------------------------------------------- the pot's profile (round its axis, the front's unit and the legs left out)
const prof = profile(m, { skip: (p) => (p[2] > 0.5 && Math.abs(p[0]) < 0.6 && p[1] > 1.1 && p[1] < 1.8) || p[1] < 0.42 || (p[1] < 1.05 && Math.hypot(Math.abs(p[0]) - 0.72, Math.abs(p[2]) - 0.62) < 0.36) });
const potR = (y) => radiusAt(prof, y);
let bottom = Infinity; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (Math.hypot(p[0], p[2]) < 0.25) bottom = Math.min(bottom, p[1]); }
const RIM = Math.max(...prof.map((x) => x[0]));
// ---------------------------------------------------------------- the legs: each corner's column, its centre per height
const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
const colAt = (sx, sz, y0, y1) => { let n = 0, x = 0, z = 0; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (p[1] < y0 || p[1] >= y1 || Math.sign(p[0]) !== sx || Math.sign(p[2]) !== sz) continue; if (p[1] > bottom && Math.hypot(p[0], p[2]) < potR(p[1]) + 0.03) continue; n++; x += p[0]; z += p[2]; } return n ? [x / n, z / n, n] : null; };
const legs = corners.map(([sx, sz]) => {
  // (the band heights by the dark texels are noisy corner to corner, 0.48–0.64 m: Tripo's legs are one design, so one
  //  height for all four, where the reference's bands are: the knee's at the pot's floor, the ankle's over the foot)
  const knee = KNEE, ankle = ANKLE;
  const c = (y) => colAt(sx, sz, y - 0.04, y + 0.04) ?? colAt(sx, sz, y - 0.1, y + 0.1);
  const f = colAt(sx, sz, 0, 0.06), k = c(knee), a = c(ankle), h = c(0.86);
  return { sx, sz, hip: r3([h[0], 0.9, h[1]]), knee: r3([k[0], knee, k[1]]), ankle: r3([a[0], ankle, a[1]]), foot: r3([f[0], 0, f[1]]) };
});
// ---------------------------------------------------------------- the eye unit: proud of the pot over its front
const headLo = 1.12, headHi = 1.8;
const isHead = (p) => p[2] > 0.55 && p[1] > headLo && p[1] < headHi && Math.hypot(p[0], p[2]) > potR(p[1]) + 0.012;
let hc = [0, 0, 0], hn = 0; for (let v = 0; v < m.n; v++) { const p = m.at(v); if (isHead(p)) { hc = V3.add(hc, p); hn++; } }
hc = hc.map((x) => x / hn);
const headAz = Math.atan2(hc[0], hc[2]);
// ---------------------------------------------------------------- the parts
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
const legOf = (p) => { if (p[1] > 1.08) return -1; let best = -1, d = 0.4; legs.forEach((L, k) => { const e = Math.hypot(p[0] - L.knee[0], p[2] - L.knee[2]); if (e < d) { d = e; best = k; } }); if (best < 0) return -1; if (p[1] < bottom + 0.01) return best; return Math.hypot(p[0], p[2]) > potR(p[1]) + 0.015 ? best : -1; };
partition(m, (v) => {
  const p = m.at(v);
  if (isHead(p)) return PI.head;
  const k = legOf(p);
  if (k >= 0) { const L = legs[k]; return PI[p[1] > L.knee[1] ? `thigh${k}` : p[1] > L.ankle[1] ? `shin${k}` : `foot${k}`]; }
  // (the brew: the pot's floor inside, facing up, under the rim)
  if (p[1] > RIM - 0.45 && p[1] < RIM - 0.08 && Math.hypot(p[0], p[2]) < potR(p[1]) - 0.08 && m.nor(v)[1] > 0.6) return PI.brew;
  return PI.hull;
}, PARTS, { strict: ['brew', 'head'] });
// the pot round the eye unit's foot made true to its profile (the fillet Tripo blended between them left a ridge round
// the hole the unit leaves as it slides, and bent normals the ink drew as a slot): the hull's vertices within 6 cm of
// the unit's, set on the pot's surface with its own normal
{ const [first, count] = m.parts.head, hv = new Set(); for (let t = first; t < first + count; t++) for (let k = 0; k < 3; k++) hv.add(m.I[t * 3 + k]);
  const H = [...hv].map((v) => m.at(v)), near = (p) => H.some((q) => Math.abs(q[1] - p[1]) < 0.06 && Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 0.06);
  let snapped = 0;
  for (let v = 0; v < m.n; v++) { if (hv.has(v) || m.vpart[v] !== PI.hull) continue; const p = m.at(v); if (p[2] < 0.5 || p[1] < headLo - 0.1 || p[1] > headHi + 0.1 || !near(p)) continue;
    const r = Math.hypot(p[0], p[2]), R = potR(p[1]), k = R / r, slope = (potR(p[1] + 0.02) - potR(p[1] - 0.02)) / 0.04;
    m.P[v * 3] = p[0] * k; m.P[v * 3 + 2] = p[2] * k;
    const n = V3.norm([p[0] / r, -slope, p[2] / r]); m.N[v * 3] = n[0]; m.N[v * 3 + 1] = n[1]; m.N[v * 3 + 2] = n[2]; snapped++; }
  console.error('the pot round the eye unit: vertices set on its profile', snapped); }
// the eye unit turned onto the front (about the pot's axis): it slides round the pot from there (its look, src/enemies/plans/cart-tripo.js)
{ const c = Math.cos(-headAz), s = Math.sin(-headAz);
  const turn = (A, v) => { const x = A[v * 3], z = A[v * 3 + 2]; A[v * 3] = x * c + z * s; A[v * 3 + 2] = -x * s + z * c; };
  const [first, count] = m.parts.head, seen = new Set();
  for (let t = first; t < first + count; t++) for (let k = 0; k < 3; k++) { const v = m.I[t * 3 + k]; if (seen.has(v)) continue; seen.add(v); turn(m.P, v); turn(m.N, v); } }
// the eye's recess and the vents: the unit's near-black texels' places (measured after the turn)
const eyePts = [], ventPts = [];
for (let v = 0; v < m.n; v++) { if (m.vpart[v] !== PI.head || m.role[v] !== 2) continue; const p = m.at(v); (p[1] > hc[1] - 0.02 ? eyePts : ventPts).push(p); }
const mean = (a) => [0, 1, 2].map((i) => a.reduce((s, p) => s + p[i], 0) / (a.length || 1));
const eyeC = mean(eyePts), eyeR = Math.max(0.05, Math.sqrt(eyePts.reduce((s, p) => s + (p[0] - eyeC[0]) ** 2 + (p[1] - eyeC[1]) ** 2, 0) / (eyePts.length || 1)) * 1.35);
// ---------------------------------------------------------------- repainted, the reference's flat colours
const PALETTE = { body: CART_HOME.body, band: CART_HOME.band, dark: CART_HOME.dark, brew: CART_HOME.brew, black: CART_HOME.vent };
const SWATCH = { body: CART_HOME.body, band: CART_HOME.band, dark: CART_HOME.dark, brass: CART_HOME.brass, black: CART_HOME.vent };
await paint(m, (part, role, p) => {
  if (part === 'brew') return 'brew';
  if (part === 'head') return role === 'black' ? 'black' : 'body';
  if (part.startsWith('thigh') || part.startsWith('shin') || part.startsWith('foot')) return role === 'body' ? 'body' : 'band';
  // (the pot: its inside wall over the brew dark, its folds painted out; a stray orange off the brew sage)
  if (p[1] > RIM - 0.5 && Math.hypot(p[0], p[2]) < potR(p[1]) - 0.06) return 'dark';
  return 'body';
}, PALETTE, SWATCH);
// ---------------------------------------------------------------- the weights: each part its bone, blended at the joints
const cuts = {};
legs.forEach((L, k) => {
  cuts[`knee${k}`] = ring(m, { at: L.knee, n: [0, -1, 0] }, [PI[`thigh${k}`], PI[`shin${k}`]], 0.4);
  cuts[`ankle${k}`] = ring(m, { at: L.ankle, n: [0, -1, 0] }, [PI[`shin${k}`], PI[`foot${k}`]], 0.4);
});
weights(m, PI, (v, part, p) => {
  const k = +part.slice(-1);
  if (part.startsWith('thigh')) {
    // (its crease into the pot: the thigh's vertices near the pot's surface carry some of the pot's weight)
    const hb = p[1] > bottom ? Math.hypot(p[0], p[2]) - potR(p[1]) : 9, w = Math.min(1, Math.max(0, hb / HIP_BLEND)), s = w * w * (3 - 2 * w);
    const kb = planeBlend(p, legs[k].knee, [0, -1, 0], BLEND, PI[part], PI[`shin${k}`]);
    if (kb) return kb;
    return s < 1 ? [[PI[part], s], [PI.hull, 1 - s]] : null;
  }
  if (part.startsWith('shin')) return planeBlend(p, legs[k].knee, [0, -1, 0], BLEND, PI[`thigh${k}`], PI[part]) ?? planeBlend(p, legs[k].ankle, [0, -1, 0], BLEND, PI[part], PI[`foot${k}`]);
  if (part.startsWith('foot')) return planeBlend(p, legs[k].ankle, [0, -1, 0], BLEND, PI[`shin${k}`], PI[part]);
  return null;
});
// ---------------------------------------------------------------- the landmarks; the files
const landmarks = {
  frame: 'game: +z ahead, +y up, metres, feet on y 0, centred between the feet', scale: m.S, shift: m.shift, height: HEIGHT,
  legs: legs.map(({ hip, knee, ankle, foot }) => ({ hip, knee, ankle, foot })), cuts,
  pot: { bottom: +bottom.toFixed(3), rim: +RIM.toFixed(3), rimR: potR(RIM - 0.02), profile: prof.filter((_, i) => i % 3 === 0) },
  head: { centre: r3([0, hc[1], Math.hypot(hc[0], hc[2])]), az: +headAz.toFixed(3), lo: headLo, hi: headHi, note: 'turned onto the front about the pot\'s axis; it slides round the pot to look at you' },
  eye: { at: r3(eyeC), r: +eyeR.toFixed(3), n: [0, 0, 1], texels: eyePts.length }, vents: r3(mean(ventPts)),
  parts: m.parts, partNames: PARTS, palette: PALETTE, swatches: m.swatches, swatchColours: SWATCH,
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'landmarks.json'), JSON.stringify(landmarks, null, 1) + '\n');
const sum = write(join(OUT, 'body.glb'), join(HERE, 'flat-texture.png'), m, { name: 'crucible walker tripo', source: 'references/enemy-redesign-2026-10-30/keep-cart/tripo/model.glb', task: '9d5f38fe-d4e4-4e25-83d2-24cee48106e3' });
console.log(JSON.stringify({ ...sum, legs, eye: landmarks.eye, head: landmarks.head, pot: { bottom, rim: RIM }, cuts }, null, 0));
