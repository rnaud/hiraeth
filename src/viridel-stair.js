import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothstep } from './noise.js';
import { makeMaterial, MODE_WATER } from './materials.js';

// Viridel's water stair (issue #189, after references/levels/Viridel/environment/explorations/water-stair): the Builders'
// Greenhouse stands on a hill now, not in a hollow, and the gardeners grow its south-west flank as a stair of white stone
// terraces. Eight beds, each a wall's height (3.9 m) over the last, a channel down the middle of them falling from bed to
// bed; up each wall a flight of steps against it, turning left and right by turns, so the way up zigzags across the beds
// on their stepping stones. Three of the flights have a sluice-gate at the top: its board stands across the way (3 m: no
// jump clears it), and turning its wheel lifts it: the way on opens, the water pours down the wall beside it and floods
// the bed below, which blooms, its stepping stones going under. So you climb the stair opening it, and the water you let
// down is the walk home. (A traveller who climbs can go up the walls; the gates are the gardeners' way.) No rng: what
// stands round it stays where it was.
//
//   shapeHill(h, x, z, L)               the terrain: the hill under the Greenhouse, and the ground held under the beds
//   stairLevels(rolling)                → L: the plateau's height, the foot bed's, the rise between beds
//   buildWaterStair(scene, terrain, L)  → { beds, flights, gates, line, foot, top, init(physics), setOpen(k, on, instant),
//                                          update(dt), covers(x, z, r) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (t) => t * t * (3 - 2 * t);

/** The Greenhouse's hill: flat within rIn of its middle, `rise` m over the meadow there, back to the meadow by rOut. */
export const HILL = { x: 110, z: 320, rise: 26, rIn: 42, rOut: 112 };
/**
 * The stair, in its own frame: s up the stair from its foot (0) to the hill's top (len), u across it (± w/2). `dir` is
 * from the hill's middle out to the foot, `r` the foot's distance out. Beds `bed` m deep, the channel down the middle
 * `ch` m wide; each flight `fw` m deep against its wall, from `from` m out of the middle, in steps of about `step` m, a
 * landing `land` m long at its top; the flights with a sluice-gate (`gated`, by the wall they climb: 0 is the first).
 */
export const STAIR = { dir: [-0.2311, -0.9729], r: 114, len: 72, w: 30, beds: 8, bed: 9, ch: 2.2, fw: 2.2, from: 3.2, step: 0.4, land: 2.0, gated: [1, 3, 5] };
const E_S = V(-STAIR.dir[0], 0, -STAIR.dir[1]).normalize();   // (up the stair)
const E_U = V(E_S.z, 0, -E_S.x);                                // (across it: the frame's x, so (u, y, s) is right-handed)
export const STAIR_FOOT = V(HILL.x + STAIR.dir[0] * STAIR.r, 0, HILL.z + STAIR.dir[1] * STAIR.r);

/** (x, z) in the stair's frame: { u, s }. */
export function toStair(x, z) {
  const dx = x - STAIR_FOOT.x, dz = z - STAIR_FOOT.z;
  return { u: dx * E_U.x + dz * E_U.z, s: dx * E_S.x + dz * E_S.z };
}
/** The stair's frame point (u, y, s) in the world. */
export function fromStair(u, y, s) { return V(STAIR_FOOT.x + E_U.x * u + E_S.x * s, y, STAIR_FOOT.z + E_U.z * u + E_S.z * s); }

/** The heights the stair is built to, from the meadow's own height (before the hill): { plateau, y0, rise }. */
export function stairLevels(rolling) {
  const plateau = rolling(HILL.x, HILL.z) + HILL.rise, y0 = rolling(STAIR_FOOT.x, STAIR_FOOT.z) + 0.5;
  return { plateau, y0, rise: (plateau - y0) / (STAIR.beds - 1) };
}
export const bedTop = (L, k) => L.y0 + k * L.rise;
/** Which way flight k climbs across (+1: toward +u), and where it starts and ends (u). */
export const flightDir = (k) => (k % 2 ? -1 : 1);

/**
 * The terrain round the Greenhouse: the hill, and under the stair's footprint the ground held below each bed (below the
 * bed a cell and a half back down the stair, so no triangle of the ground between a bed and the one under it shows
 * through), the ground beside it let rise again 0.7 m a metre out past a margin, and in front a step down to the meadow.
 */
export function shapeHill(h, x, z, L) {
  const dx=x-HILL.x, dz=z-HILL.z, r=Math.hypot(dx,dz);
  // The glasshouse is now 130 m across. Broaden the crown across its facade,
  // while retaining the old outer hill and the water stair's cut below.
  const yaw=Math.atan2(40,-220), across=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  const inner=HILL.rIn+36*(r>0?across*across/(r*r):0);
  if (r < HILL.rOut) h = THREE.MathUtils.lerp(h, L.plateau, smoothstep(HILL.rOut, inner, r));
  // (a cell and more of the ground's grid, 9.5 m, held low round the footprint before it may rise: a triangle that
  // spans the side wall leans no higher than the bed inside it)
  const { u, s } = toStair(x, z), back = 14, out = Math.abs(u) - STAIR.w / 2 - 11;
  if (out > 16 || s < -28 || s - back >= STAIR.len) return h;
  // (behind the top bed the hill's top, just under it: you step down off it onto the grass)
  const cap = s < 0 ? L.y0 - 0.45 + Math.max(0, -s - 14) * 0.5
    : s >= STAIR.len ? bedTop(L, STAIR.beds - 1) - 0.3
      : bedTop(L, Math.min(STAIR.beds - 1, Math.floor(Math.max(0, s - back) / STAIR.bed))) - 0.3;
  return Math.min(h, cap + Math.max(0, out) * 0.7);
}

// ------------------------------------------------------------------ building it
const prep = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; };
const BASIS = new THREE.Matrix4().makeBasis(E_U, V(0, 1, 0), E_S);
const FRAME = BASIS.clone().setPosition(STAIR_FOOT.x, 0, STAIR_FOOT.z);
/** A box in the stair's frame: u0..u1 across, y0..y1 high, s0..s1 up (either order). */
const box = (u0, u1, y0, y1, s0, s1) => {
  [u0, u1] = [Math.min(u0, u1), Math.max(u0, u1)]; [s0, s1] = [Math.min(s0, s1), Math.max(s0, s1)];
  return new THREE.BoxGeometry(u1 - u0, y1 - y0, s1 - s0).translate((u0 + u1) / 2, (y0 + y1) / 2, (s0 + s1) / 2).applyMatrix4(FRAME);
};
/** A flat quad in the stair's frame at height y (drawn only: water). */
const quad = (u0, u1, y, s0, s1) => {
  const a = fromStair(u0, y, s0), b = fromStair(u1, y, s0), c = fromStair(u0, y, s1), d = fromStair(u1, y, s1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...c.toArray(), ...b.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  g.computeVertexNormals();
  return g;
};
/** The beds' flowers, from the foot up (mint, pink, peach, lavender, round again: the sheets'). */
export const BED_FLOWERS = ['#9fe0c4', '#f2a7b8', '#f6c7a0', '#b5a7e6', '#9fe0c4', '#f2a7b8', '#f6c7a0', '#b5a7e6'];
/** Each bed a little wider or narrower than STAIR.w (m), so the terraces step in and out like the sheet's, not one block. */
export const BED_WIDTHS = [0, 2.4, -1.6, 3.2, 0.8, -2.4, 1.6, -0.8];
/** The rounded lip along each wall's top and side (m: its radius, how far under the bed's top its axis runs). */
export const LIP = { r: 0.42, drop: 0.22, gap: 0.02 };
/** A rod in the stair's frame from (u0, s0) to (u1, s1) at height y, radius r (a lip: along u or along s). */
const rod = (u0, s0, u1, s1, y, r) => {
  const L = Math.hypot(u1 - u0, s1 - s0), g = new THREE.CylinderGeometry(r, r, L, 12, 1);
  g.rotateZ(Math.PI / 2).rotateY(-Math.atan2(s1 - s0, u1 - u0));
  return g.translate((u0 + u1) / 2, y, (s0 + s1) / 2).applyMatrix4(FRAME);
};
/** An upright sheet across u at s from y0 up to y1, its uv in metres (x across, y up: a fall, waterfall-shader.js). */
const sheet = (u0, u1, y0, y1, s) => {
  const w = Math.abs(u1 - u0), h = y1 - y0, g = new THREE.PlaneGeometry(w, h, 1, 1);   // (facing up the stair: drawn from both sides)
  const uv = g.attributes.uv, pp = g.attributes.position;
  for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) + w / 2, pp.getY(i) + h / 2);
  return g.translate((u0 + u1) / 2, (y0 + y1) / 2, s).applyMatrix4(FRAME);
};
/** A hash of a number, 0..1 (no rng: what stands round the stair stays where it was). */
const hash1 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildWaterStair(scene, terrain, L) {
  const { beds: N, bed: D, fw, w, ch, from, land, gated } = STAIR, H = (x, z) => terrain.heightAt(x, z);
  const top = (k) => bedTop(L, k), c2 = ch / 2, K = 0.5, KH = 0.45;
  const white = [], soil = [], kerb = [], lipList = [], stones = [], posts = [], cascade = [];
  // the lowest the ground comes round a rectangle (u, s), less a margin: where a box goes down to
  const floorUnder = (u0, u1, s0, s1) => {
    let lo = Infinity;
    for (let u = Math.min(u0, u1) - 1; u <= Math.max(u0, u1) + 1; u += 2.5) for (let s = Math.min(s0, s1) - 1; s <= Math.max(s0, s1) + 1; s += 2.5) { const p = fromStair(u, 0, s); lo = Math.min(lo, H(p.x, p.z)); }
    return lo - 1.5;
  };
  // ---- the flights first (where each starts and lands, which the beds' kerbs and stones go round)
  const flights = [];
  for (let k = 0; k < N - 1; k++) {
    const d = flightDir(k), S = (k + 1) * D, y0 = top(k), y1 = top(k + 1), n = Math.round((y1 - y0) / STAIR.step), r = (y1 - y0) / n, dl = 0.62;
    const a = d * from, b = d * (from + n * dl), e = b + d * land;
    flights.push({ k, d, S, y0, y1, n, r, dl, a, b, e, gate: gated.includes(k), steps: [] });
  }
  // ---- the beds: the white body down into the hill, soil either side of the channel, kerbs, the stepping stones
  const beds = [];
  for (let k = 0; k < N; k++) {
    const S0 = k * D, S1 = S0 + D, y = top(k), up = flights[k], down = flights[k - 1], wk = w + BED_WIDTHS[k];
    white.push(box(-wk / 2, wk / 2, floorUnder(-wk / 2, wk / 2, S0, S1), y - 0.25, S0, S1));
    const rects = [[-wk / 2 + 0.25, -c2, S0 + 0.25, S1], [c2, wk / 2 - 0.25, S0 + 0.25, S1]];
    for (const [u0, u1, s0, s1] of rects) soil.push(box(u0, u1, y - 0.25, y, s0, s1));
    // the channel's kerbs down the middle (the water: below)
    kerb.push(box(-c2 - 0.3, -c2, y, y + 0.35, S0 + 0.25, S1), box(c2, c2 + 0.3, y, y + 0.35, S0 + 0.25, S1));
    // the sides; the front, with a gap where you come up onto it (off the meadow, or off the last flight's landing)
    const kb = (u0, u1, s0, s1) => { if (Math.abs(u1 - u0) > 0.05) kerb.push(box(u0, u1, y, y + KH, s0, s1)); };
    kb(-wk / 2, -wk / 2 + K, S0, S1); kb(wk / 2 - K, wk / 2, S0, S1);
    // (over a gated flight, a wall 3 m over the bed instead of the kerb, so the gate is the only way off its top step)
    const gap = down ? [Math.min(down.a, down.e), Math.max(down.a, down.e)] : [-4.2, -1.6];
    const spans = [[-wk / 2 + K, -c2 - 0.3], [c2 + 0.3, wk / 2 - K]].flatMap(([u0, u1]) => (gap[1] <= u0 || gap[0] >= u1 ? [[u0, u1]] : [[u0, Math.max(u0, gap[0])], [Math.min(u1, gap[1]), u1]]));
    for (const [u0, u1] of spans) kb(u0, u1, S0, S0 + K);
    if (down?.gate) white.push(box(down.a, down.b + down.d * (0.2 - 0.45), y - 0.25, y + 3.0, S0, S0 + 0.25));   // (up to the gate's back post)
    else if (down) kb(down.a, down.b, S0, S0 + K);
    if (k === N - 1) { const ex = [Math.min(down.b, down.e) - 0.5, Math.max(down.b, down.e) + 0.5]; for (const [u0, u1] of [[-wk / 2 + K, -c2 - 0.3], [c2 + 0.3, wk / 2 - K]]) { if (ex[1] <= u0 || ex[0] >= u1) kb(u0, u1, S1 - K, S1); else { kb(u0, Math.max(u0, ex[0]), S1 - K, S1); kb(Math.min(u1, ex[1]), u1, S1 - K, S1); } } }
    // the stepping stones: from where you come onto it, across (over the channel on a slab) to the next flight's foot
    const inU = down ? (down.b + down.e) / 2 + down.d * 0.3 : (gap[0] + gap[1]) / 2;
    const toU = up ? up.d * (from - 0.95) : inU;
    const path = up ? [{ u: inU, s: S0 + 1.2 }, { u: inU, s: S1 - fw - 1.6 }, { u: toU, s: S1 - fw - 1.6 }, { u: toU, s: S1 - 1.1 }] : [{ u: inU, s: S0 + 1.2 }, { u: inU, s: S1 - 1.2 }];
    const st = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const p = path[i], q = path[i + 1], n = Math.max(1, Math.round(Math.hypot(q.u - p.u, q.s - p.s) / 1.7));
      for (let j = i ? 1 : 0; j <= n; j++) { const t = j / n, u = p.u + (q.u - p.u) * t; if (Math.abs(u) > c2 + 0.9) st.push({ u, s: p.s + (q.s - p.s) * t }); }
    }
    for (const p of st) stones.push(box(p.u - 0.55, p.u + 0.55, y, y + 0.2, p.s - 0.55, p.s + 0.55));
    // (the slab over the channel where the stones cross it, as high as its kerbs)
    let bridge = null;
    if (up && Math.sign(inU) !== Math.sign(toU)) { const s = S1 - fw - 1.6; kerb.push(box(-c2 - 0.9, c2 + 0.9, y + 0.35, y + 0.5, s - 0.7, s + 0.7)); bridge = fromStair(0, y + 0.5, s); }
    // the wall's rounded lip over the bed below, and along its sides (solid: a climber takes hold of it), not over the
    // flight up it nor where you step up onto the foot bed, nor over the channel's fall
    const skip = down ? [Math.min(down.a, down.e) - 0.7, Math.max(down.a, down.e) + 0.7] : [gap[0] - 0.6, gap[1] + 0.6];
    const lips = [[-wk / 2, -c2 - 0.35], [c2 + 0.35, wk / 2]].flatMap(([u0, u1]) => (skip[1] <= u0 || skip[0] >= u1 ? [[u0, u1]] : [[u0, Math.max(u0, skip[0])], [Math.min(u1, skip[1]), u1]])).filter(([u0, u1]) => u1 - u0 > 0.8);
    // (each rod's end 2 cm inside the wall's side or back face it would end flush with: its cap and the face, one plane
    // of two looks, striped as the camera moved; zfight v1.66)
    const offFace = (u) => (Math.abs(Math.abs(u) - wk / 2) < 1e-6 ? u - Math.sign(u) * LIP.gap : u);
    for (const [u0, u1] of lips) lipList.push(rod(offFace(u0), S0 + 0.08, offFace(u1), S0 + 0.08, y - LIP.drop, LIP.r));
    for (const d of [-1, 1]) lipList.push(rod(d * (wk / 2 - 0.08), S0 + 0.08, d * (wk / 2 - 0.08), S1 - LIP.gap, y - LIP.drop, LIP.r * 0.9));
    beds.push({ k, y, S0, S1, w: wk, lips, rects, stones: st.map((p) => fromStair(p.u, y + 0.2, p.s)), stoneUs: st, bridge, flowers: BED_FLOWERS[k] });
  }
  // ---- the paved terrace at the top, behind the last bed (the ground held under the beds dips there: it covers it)
  const wTop = w + BED_WIDTHS[N - 1];
  white.push(box(-wTop / 2, wTop / 2, floorUnder(-wTop / 2, wTop / 2, D * N, D * N + 12), top(N - 1) - 0.25, D * N, D * N + 12));
  // ---- the flights' steps against their walls, each landing at the top, onto the bed above
  for (const f of flights) {
    const { d, S, y0, n, r, dl, a, e } = f;
    for (let j = 0; j < n; j++) {
      const u0 = a + d * j * dl, u1 = u0 + d * dl, ty = y0 + (j + 1) * r;
      white.push(box(u0, u1, y0, ty, S - fw, S));
      f.steps.push(fromStair((u0 + u1) / 2, ty, S - fw / 2));
    }
    white.push(box(f.b, e, y0, f.y1, S - fw, S));   // the landing
  }
  // ---- the gates: a post either side of the landing's start, a lintel, the board across the way, a wheel on the post
  const gates = [];
  const teal = makeMaterial({ color: '#3d8a86', flat: true });
  for (const f of flights.filter((x) => x.gate)) {
    const { d, S, y0, y1, b } = f, uG = b + d * 0.2;
    posts.push(box(uG - 0.45, uG + 0.45, y0, y1 + 6.6, S - fw - 0.9, S - fw));                  // (on the bed below, in front)
    posts.push(box(uG - 0.45, uG + 0.45, y1 - 0.25, y1 + 6.6, S + 0.05, S + 0.95));             // (on the bed above, behind)
    posts.push(box(uG - 0.5, uG + 0.5, y1 + 6.6, y1 + 7.2, S - fw - 0.9, S + 0.95));
    // the board: a group of its own in the stair's frame; lifted 3.3 m it hangs under the lintel
    const board = new THREE.Group();
    board.name = `The water stair’s sluice board ${gates.length + 1}`;
    const plank = new THREE.BoxGeometry(0.3, 3.0, fw + 0.1).translate(0, 1.5, 0);
    board.add(new THREE.Mesh(prep(plank), makeMaterial({ color: '#4fa9a4', flat: true, grid: 0.5 })));
    board.add(new THREE.Mesh(prep(mergeGeometries([0.6, 1.5, 2.4].map((h) => new THREE.BoxGeometry(0.38, 0.18, fw + 0.14).translate(0, h, 0).toNonIndexed()))), teal));
    const at = fromStair(uG, y1, S - fw / 2);
    board.position.copy(at);
    board.quaternion.setFromRotationMatrix(BASIS);
    board.userData.noCollide = true;   // (out of the bake: a moving collider, init below)
    scene.add(board);
    // the wheel: on the front post's face toward the steps, at hand from the top step
    const wheel = new THREE.Group(), spin = new THREE.Group();
    wheel.position.copy(fromStair(uG - d * 0.75, y1 + 1.5, S - fw - 0.35));
    wheel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(E_U.clone().multiplyScalar(d), V(0, 1, 0), E_S.clone().multiplyScalar(-d)));
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 5, 18).rotateY(Math.PI / 2), teal));
    spin.add(new THREE.Mesh(mergeGeometries([0, 1, 2].map((i) => new THREE.BoxGeometry(0.06, 1.2, 0.06).rotateX((i / 3) * Math.PI).toNonIndexed())), teal));
    spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8).rotateZ(Math.PI / 2), teal));
    wheel.add(spin);
    wheel.traverse((o) => { o.userData.noCollide = true; });
    scene.add(wheel);
    gates.push({ k: gates.length, flight: f, bed: f.k, board, at, wheel, spin, stand: fromStair(b - d * 0.6, y1, S - fw / 2), open: false, lift: 0, collider: null });
  }
  const mk = (list, mat, name) => { const m = new THREE.Mesh(mergeGeometries(list.map(prep)), mat); m.name = name; scene.add(m); return m; };
  // (a warm white stone in big uneven blocks, its shade lifted: the sheet's, not a grey grid)
  mk(white, makeMaterial({ color: '#efe3c9', flat: true, plates: 3.6, shade: 0.35, line: 0.85 }), 'The water stair');
  mk(kerb, makeMaterial({ color: '#f7eedb', flat: true, shade: 0.4, line: 0.75 }), 'The water stair’s kerbs');
  mk(lipList, makeMaterial({ color: '#f7eedb', shade: 0.4, line: 0.75 }), 'The water stair’s lips');   // (rounded: smooth shading)
  mk(soil, makeMaterial({ color: '#7d8a52', flat: true }), 'The water stair’s beds');
  mk(stones, makeMaterial({ color: '#ece2cd', flat: true, shade: 0.35, line: 0.8 }), 'The water stair’s stepping stones');
  mk(posts, makeMaterial({ color: '#efe3c9', flat: true, plates: 1.4, shade: 0.35, line: 0.85 }), 'The water stair’s sluice-gates');

  // ---- the water: the channel down the middle, falling over each wall (always running); each gated bed's flood
  const waterMat = makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER });
  // (the falls drawn as falling sheets, waterfall-shader.js: streaming bands, pen streaks, a glassy lip, a little mist)
  const fallMat = makeMaterial({ color: '#86cbd4', color2: '#d6efee', color3: '#4f97a3', fall: { speed: 2.4, column: 0.32, gaps: 0.12, mist: 0.7, ink: 0.85, lip: 0.45, height: L.rise + 0.15, seed: 3 }, spot: 0, line: 0.6, lineTint: 0.6 });
  const falls = [];
  for (const b of beds) {
    cascade.push(quad(-c2, c2, b.y - 0.1, b.S0, b.S1));
    if (b.k > 0) falls.push(sheet(-c2 + 0.2, c2 - 0.2, beds[b.k - 1].y - 0.1, b.y + 0.05, b.S0 - 0.03));
  }
  const run = new THREE.Mesh(mergeGeometries(cascade), waterMat);
  run.name = 'The water stair’s channel'; run.userData.noCollide = true; run.userData.water = true;
  scene.add(run);
  const fallMesh = (g, name) => { const m = new THREE.Mesh(g, fallMat); m.name = name; m.userData.noCollide = true; m.userData.floats = true; m.userData.castShadow = false; scene.add(m); return m; };
  // the beds' own water sheeting over their lips here and there onto the bed below (a gated bed's once it floods), and
  // the planting spilling over them: ferns hanging down the wall, a bush on the kerb
  const spillAt = new Map(), drapes = [], bushes = [];
  for (const b of beds) {
    if (!b.k) continue;
    const spots = [];
    b.lips.forEach(([u0, u1], i) => {
      const L0 = u1 - u0;
      if (L0 > 5 && spots.length < 2 && hash1(b.k * 7 + i) < 0.75) { const c = u0 + L0 * (0.3 + 0.4 * hash1(b.k * 13 + i)), hw = Math.min(1.3, L0 * 0.18); spots.push([c - hw, c + hw]); }
    });
    if (spots.length) spillAt.set(b.k, spots.map(([u0, u1]) => sheet(u0, u1, beds[b.k - 1].y - 0.05, b.y + 0.1, b.S0 - LIP.r + 0.02)));
    // (the ferns and bushes between the spills)
    for (const [u0, u1] of b.lips) for (let u = u0 + 0.5, j = 0; u < u1 - 0.4; u += 0.8, j++) {
      const h = hash1(b.k * 31 + u * 3.7);
      if (h < 0.22 || spots.some(([a, c]) => u > a - 0.5 && u < c + 0.5)) continue;
      const len = 0.9 + 1.6 * hash1(u * 9.1 + b.k);
      for (let i = 0; i < 6; i++) {
        const du = (i - 2.5) * 0.13, top = fromStair(u + du, b.y - 0.05, b.S0 - LIP.r - 0.03), foot = fromStair(u + du * 1.5, b.y - len * (0.45 + 0.55 * hash1(i * 3.3 + u)), b.S0 - LIP.r - 0.2);
        const side = E_U.clone().multiplyScalar(0.065);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...top.clone().sub(side).toArray(), ...top.clone().add(side).toArray(), ...foot.toArray()], 3));
        drapes.push(g);
      }
      if (h > 0.55) bushes.push(new THREE.IcosahedronGeometry(0.42 + 0.25 * h, 1).scale(1.25, 0.8, 1).translate(0, 0, 0).applyMatrix4(new THREE.Matrix4().setPosition(fromStair(u, b.y + 0.62, b.S0 + 0.25))));
    }
  }
  // (and a cypress at the back corner of every other bed, the sheet's dark flames over the white)
  const cypresses = [];
  for (const b of beds) if (b.k % 2 === 1 || b.k === N - 1) for (const d of [-1, 1]) {
    if (hash1(b.k * 5 + d) < 0.3) continue;
    const h = 6 + 4 * hash1(b.k * 17 + d), at = fromStair(d * (b.w / 2 - 1.4), b.y + 0.4, b.S1 - 1.6);
    cypresses.push(new THREE.LatheGeometry([[0.01, 0], [0.75, 0.6], [1.0, h * 0.32], [0.8, h * 0.72], [0.01, h]].map(([r, y]) => new THREE.Vector2(r, y)), 9).translate(at.x, at.y, at.z));
  }
  // (the beds the channel waters spill always: drawn with the channel's falls; a gated bed's, a mesh of its own)
  const wet = (k) => !gated.includes(k);
  fallMesh(mergeGeometries([...falls, ...[...spillAt].filter(([k]) => wet(k)).flatMap(([, g]) => g)]), 'The water stair’s falls');
  const spills = beds.map((b) => (spillAt.has(b.k) && !wet(b.k) ? fallMesh(mergeGeometries(spillAt.get(b.k)), `The water stair’s bed ${b.k + 1}, spilling over`) : null));
  for (const [list, mat, name] of [[drapes, makeMaterial({ color: '#6a9a57', flat: true, side: THREE.DoubleSide, line: 0.6, lineTint: 0.7 }), 'The water stair’s ferns'], [bushes, makeMaterial({ color: '#7fae62', flat: true, line: 0.7, lineTint: 0.67 }), 'The water stair’s bushes'], [cypresses, makeMaterial({ color: '#4f6b3a', pattern: 'leaves', line: 0.7, lineTint: 0.67 }), 'The water stair’s cypresses']]) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeGeometries(list.map(prep)), mat);
    m.name = name; m.userData.noCollide = true; m.userData.flora = true;
    scene.add(m);
  }
  const floods = gates.map((G) => {
    const b = beds[G.bed];
    const m = new THREE.Mesh(mergeGeometries(b.rects.map(([u0, u1, s0, s1]) => quad(u0, u1, 0, s0, s1))), waterMat);
    m.name = `The water stair’s bed ${b.k + 1}, flooded`;
    m.userData.noCollide = true; m.userData.water = true; m.userData.waterMoves = true; m.userData.dynamic = true;
    m.position.y = b.y - 0.2; m.visible = false;
    scene.add(m);
    return m;
  });
  // (and the gate's water down the wall beside its landing, while it is open)
  const pours = gates.map((G) => {
    const f = G.flight, u0 = f.e + f.d * 0.3, u1 = f.e + f.d * 1.9;
    const m = fallMesh(sheet(Math.min(u0, u1), Math.max(u0, u1), f.y0 + 0.1, f.y1 + 0.05, f.S - 0.03), `The water stair’s sluice ${G.k + 1}, pouring`);
    m.visible = false;
    return m;
  });
  // ---- the flowers: buds in every bed; a gated bed's open when it floods, from where its water comes in; the others in flower
  const FLOWER = mergeGeometries([0, 1, 2, 3, 4].map((i) => new THREE.OctahedronGeometry(0.2, 0).scale(1, 0.4, 0.6).rotateY((i / 5) * Math.PI * 2).translate(Math.sin((i / 5) * Math.PI * 2) * 0.2, 0, Math.cos((i / 5) * Math.PI * 2) * 0.2)).concat([new THREE.OctahedronGeometry(0.1, 0).translate(0, 0.05, 0)]).map(prep));
  const BUD = prep(new THREE.ConeGeometry(0.12, 0.45, 5).translate(0, 0.22, 0));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), UP = V(0, 1, 0), col = new THREE.Color();
  const clearOf = (b, u, s) => !b.stoneUs.some((p) => Math.hypot(p.u - u, p.s - s) < 0.95)
    && !flights.some((f) => (f.k === b.k && s > b.S1 - fw - 0.4 && (u - f.a) * f.d > -0.6 && (u - f.e) * f.d < 0.4))
    && !(b.bridge && Math.abs(s - (b.S1 - fw - 1.6)) < 1.1 && Math.abs(u) < c2 + 1.2)
    && !(b.k && gated.includes(b.k - 1) && s < b.S0 + 1.3);
  const blooms = beds.map((b) => {
    const G = gates.find((g) => g.bed === b.k), spots = [];
    const inU = G ? (G.flight.e + G.flight.d * 1.1) : 0;
    let i = 0;
    for (const [u0, u1, s0, s1] of b.rects) for (let u = u0 + 0.8; u < u1 - 0.6; u += 1.35) for (let s = s0 + 0.8; s < s1 - 0.6; s += 1.35) {
      const uu = u + Math.sin(i * 12.9898) * 0.45, ss = s + Math.cos(i * 78.233) * 0.45; i++;
      if (!clearOf(b, uu, ss)) continue;
      spots.push({ at: fromStair(uu, b.y + 0.02, ss), from: Math.hypot(uu - inU, ss - b.S1), r: i * 1.7, s: 0.8 + ((i * 7) % 5) * 0.12 });
    }
    spots.sort((a, c) => a.from - c.from);
    const fm = new THREE.InstancedMesh(FLOWER, makeMaterial({ color: '#ffffff', flat: true, key: `viridel.stair.flowers.${b.k}` }), Math.max(1, spots.length));
    const bm = new THREE.InstancedMesh(BUD, makeMaterial({ color: '#5f9a63', flat: true }), Math.max(1, spots.length));
    const fc = new THREE.Color(b.flowers), alt = new THREE.Color('#ffffff');
    spots.forEach((p, j) => {
      fm.setMatrixAt(j, _m.compose(p.at.clone().add(V(0, 0.34, 0)), _q.setFromAxisAngle(UP, p.r), _s.setScalar(p.s * 1.15))); fm.setColorAt(j, col.copy(j % 7 ? fc : alt));
      bm.setMatrixAt(j, _m.compose(p.at, _q.setFromAxisAngle(UP, p.r), _s.setScalar(p.s)));
    });
    for (const m of [fm, bm]) { m.userData.noCollide = true; m.userData.flora = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); }
    fm.name = `The water stair’s bed ${b.k + 1}, in flower`;
    const k = G ? 0 : 0.85;   // (the beds the channel waters are in flower; the gated ones wait for their water)
    return { fm, bm, n: spots.length, k, want: k, gate: G ?? null };
  });

  // ---- opening and closing: a gate's board lifts (eased), its water pours, the bed below floods and blooms
  const flood = gates.map(() => 0);
  const apply = () => {
    for (const G of gates) { G.board.position.y = G.at.y + 3.3 * ease(G.lift); pours[G.k].visible = G.lift > 0.3; }
    for (const G of gates) { const b = beds[G.bed], f = flood[G.k]; floods[G.k].visible = f > 0.02; floods[G.k].position.y = b.y - 0.2 + 0.5 * f; }   // (to 0.3 m over the soil: the stones 0.1 m under)
    // (a bed spills over its lip once it holds water: the ungated ones always, a gated one once it has flooded)
    beds.forEach((b, k) => { if (spills[k]) { const G = gates.find((g) => g.bed === k); spills[k].visible = !G || flood[G.k] > 0.6; } });
    for (const B of blooms) { B.fm.count = Math.round(B.n * B.k); B.bm.count = B.n - Math.round(B.n * Math.min(1, B.k * 1.2)); }
  };
  const setOpen = (k, on, instant = false) => {
    const G = gates[k];
    if (!G) return;
    G.open = !!on;
    const B = blooms[G.bed];
    B.want = on ? 1 : 0;
    if (instant) { G.lift = on ? 1 : 0; G.spin.rotation.x = G.lift * 9; flood[k] = G.lift; B.k = B.want; }
    apply();
  };
  const update = (dt) => {
    let moved = false;
    for (const G of gates) {
      const want = G.open ? 1 : 0;
      if (G.lift !== want) { G.lift = THREE.MathUtils.clamp(G.lift + (want ? dt / 2.2 : -dt / 1.5), 0, 1); G.spin.rotation.x = G.lift * 9; moved = true; }
      const f = G.open ? (G.lift > 0.5 ? Math.min(1, flood[G.k] + dt / 6) : flood[G.k]) : Math.max(0, flood[G.k] - dt / 4);
      if (f !== flood[G.k]) { flood[G.k] = f; moved = true; }
    }
    // (a gated bed opens as far as its water has come)
    for (const B of blooms) {
      const to = B.gate ? Math.min(B.want, flood[B.gate.k]) : B.want;
      if (Math.abs(B.k - to) > 1e-4) { B.k = to > B.k ? Math.min(to, B.k + dt / 7) : Math.max(to, B.k - dt / 3); moved = true; }
    }
    if (moved) apply();
  };
  apply();
  // the boards collide where they are: moving colliders (src/physics.js addMover), lifted and lowered with their gates
  const init = (physics) => { for (const G of gates) G.collider = physics.addMover?.(G.board, { all: true }) ?? null; };

  // ---- the way up, for the level design audit and the tests: off the meadow onto the foot bed, across each bed on its
  // stones (and over the channel's slab), up the flight against the next wall, along its landing, onto the bed above;
  // and out onto the hill's top
  const foot = fromStair(-2.9, 0, -4);
  foot.y = H(foot.x, foot.z);
  const way = [foot];
  for (const b of beds) {
    const f = flights[b.k];
    const st = b.stones;
    if (b.bridge) { const i = b.stoneUs.findIndex((p, j) => j && Math.sign(p.u) !== Math.sign(b.stoneUs[j - 1].u)); way.push(...st.slice(0, i), b.bridge, ...st.slice(i)); }
    else way.push(...st);
    if (f) way.push(f.steps[0], f.steps[Math.floor(f.n / 2)], f.steps.at(-1), fromStair((f.b + f.e) / 2, f.y1, f.S - fw / 2), fromStair((f.b + f.e) / 2, f.y1, f.S + 1.2));
  }
  const last = flights.at(-1), out = fromStair((last.b + last.e) / 2, top(N - 1), D * N + 3);
  way.push(out);
  return {
    beds, flights, gates, floods, pours, blooms, setOpen, update, init, levels: L, flood,
    foot, top: out,
    line: way.map((p) => [p.x, p.y + 0.3, p.z]),
    /** (x, z) on or within r of the stair's footprint (the flora keeps off it) */
    covers: (x, z, r = 0) => { const q = toStair(x, z); return Math.abs(q.u) < w / 2 + 1 + r && q.s > -1.5 - r && q.s < STAIR.len + 1 + r; },
  };
}
