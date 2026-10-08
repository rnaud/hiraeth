// Canyon run (docs/systems/minigames.md): the hoverbike (src/bike.js, the very one of the desert) round a
// winding canyon cut into a rose plateau, three laps against the clock. The canyon is one closed loop
// (makeTrack: a wobbly ring, sampled; nearest gives any point's place along it and across it) and one
// height function on it (canyonHeight): a sand floor that rises and falls, soft sand banks, strata
// cliffs, two chasms with a wooden kicker before each, and sand drifts across part of the floor. The
// bike is its own little body on that function (bikeStep: pure, tests/minigames.test.js): the hover
// spring and the steering of the desert's bike, the sand banks that drag, the cliffs that throw you
// back, the drifts that bog you down, the boost pads (ink chevrons) that fling you on. Checkpoints
// split each lap; the splits of your best run are kept and every one is shown against them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA, MODE_RIBBON } from '../materials.js';
import { Terrain } from '../world.js';
import { arenaLevel } from './kit/world.js';
import { disposeTree } from './kit/dispose.js';
import { buildBike, bikeSteer } from '../bike.js';
import { Dots, FLUID_TONES } from '../fluid-tool.js';
import { Trail } from '../trail.js';

// ------------------------------------------------------------------ the loop
export const TRACK = {
  N: 1024, R0: 172,
  waves: [[3, 38, 0], [5, 13, 1.1], [2, 20, 0.4]],   // [k, amplitude, phase]: r(θ) = R0 + Σ A sin(kθ + φ)
};
const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** The loop, sampled evenly in angle round the middle: x, z, the distance along it (s) and its tangent. */
export function makeTrack(T = TRACK) {
  const N = T.N, x = new Float64Array(N), z = new Float64Array(N), s = new Float64Array(N + 1), tx = new Float64Array(N), tz = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU;
    let r = T.R0;
    for (const [k, A, p] of T.waves) r += A * Math.sin(k * th + p);
    x[i] = r * Math.cos(th); z[i] = r * Math.sin(th);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, dx = x[j] - x[i], dz = z[j] - z[i], l = Math.hypot(dx, dz);
    s[i + 1] = s[i] + l;
    const p = (i + N - 1) % N, ex = x[j] - x[p], ez = z[j] - z[p], el = Math.hypot(ex, ez);
    tx[i] = ex / el; tz[i] = ez / el;
  }
  return { N, x, z, s, tx, tz, L: s[N] };
}

/**
 * Where (x, z) is against the loop: s (m along it, 0..L), d (m across it, > 0 outward), the tangent
 * (tx, tz) and the middle line's point (cx, cz). hint: the sample to search round (else from the angle).
 */
export function nearest(track, x, z, hint = -1, W = 48, out = {}) {
  const { N } = track;
  const i0 = hint >= 0 ? hint : Math.round((((Math.atan2(z, x) / TAU) % 1 + 1) % 1) * N) % N;
  let best = Infinity, bi = i0;
  for (let k = -W; k <= W; k++) {
    const i = (i0 + k + N) % N, dx = x - track.x[i], dz = z - track.z[i], d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bi = i; }
  }
  // onto the segment either side of the nearest sample
  let bs = track.s[bi], bcx = track.x[bi], bcz = track.z[bi], bd = best;
  for (const a of [bi, (bi + N - 1) % N]) {
    const b = (a + 1) % N, ax = track.x[a], az = track.z[a], ex = track.x[b] - ax, ez = track.z[b] - az;
    const l2 = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
    const px = ax + ex * t, pz = az + ez * t, d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < bd) { bd = d2; bcx = px; bcz = pz; bs = track.s[a] + (track.s[a + 1] - track.s[a]) * t; }
  }
  const tx = track.tx[bi], tz = track.tz[bi];
  out.i = bi; out.s = bs; out.cx = bcx; out.cz = bcz; out.tx = tx; out.tz = tz;
  out.d = (x - bcx) * tz - (z - bcz) * tx;   // (the outward normal is (tz, -tx): the loop runs anticlockwise seen from above +y... toward +θ)
  return out;
}

/** The middle line's point and tangent at s (wrapped): { x, z, tx, tz, i }. */
export function pointAt(track, s, out = {}) {
  const L = track.L, q = ((s % L) + L) % L;
  let lo = 0, hi = track.N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (track.s[m] <= q) lo = m; else hi = m; }
  const a = lo, b = (lo + 1) % track.N, t = (q - track.s[a]) / (track.s[a + 1] - track.s[a]);
  out.x = track.x[a] + (track.x[b] - track.x[a]) * t; out.z = track.z[a] + (track.z[b] - track.z[a]) * t;
  out.tx = track.tx[a]; out.tz = track.tz[a]; out.i = a;
  return out;
}

// ------------------------------------------------------------------ the course on the loop
export const COURSE = {
  laps: 3, checkpoints: 5,                 // per lap (the fifth is the line)
  bank: 4.5, cliff: 7,                     // m: the sand bank's width, then the cliff's
  jumps: [{ at: 0.30, gap: 13 }, { at: 0.715, gap: 15 }],   // (fractions of the lap) a chasm right across, a kicker before it
  ramp: { len: 20, h: 3.4 },
  drifts: [{ at: 0.115, side: -1, reach: 0.56 }, { at: 0.45, side: 1, reach: 0.6 }, { at: 0.53, side: -1, reach: 0.55 }, { at: 0.86, side: 1, reach: 0.58 }],
  driftThick: 4.5, driftH: 1.7,
  pads: [{ at: 0.255, d: 0 }, { at: 0.49, d: -0.45 }, { at: 0.665, d: 0.35 }, { at: 0.93, d: 0 }],   // d: across, a fraction of the half-width
  padLen: 9, padW: 6,
  arches: [0.085, 0.385, 0.6, 0.79],
  fallPenalty: 2,
};

/** The course's pieces in metres along a given loop. */
export function makeCourse(track = makeTrack(), C = COURSE) {
  const L = track.L;
  const floorY = (s) => 3.5 * Math.sin(TAU * 3 * s / L) + 1.8 * Math.sin(TAU * 7 * s / L + 1);
  const halfW = (s) => 13 + 3 * Math.sin(TAU * 4 * s / L + 0.7);
  const cliffH = (s) => 24 + 7 * Math.sin(TAU * 5 * s / L + 2) + 4 * Math.sin(TAU * 11 * s / L);
  const jumps = C.jumps.map((j) => ({ s: j.at * L, gap: j.gap, ramp0: j.at * L - C.ramp.len }));
  const drifts = C.drifts.map((d) => ({ s: d.at * L, side: d.side, reach: d.reach }));
  const pads = C.pads.map((p) => ({ s: p.at * L, df: p.d }));
  const checks = Array.from({ length: C.checkpoints }, (_, k) => (k * L) / C.checkpoints);
  const ds = (a, b) => { let d = (a - b) % L; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; };   // (a − b, the short way round)
  return { track, L, C, floorY, halfW, cliffH, jumps, drifts, pads, checks, ds };
}

/** Is s in a chasm (the gap after a kicker)? */
export const inGap = (K, s) => K.jumps.some((j) => { const u = K.ds(s, j.s); return u >= 0 && u <= j.gap; });

/** The kicker's rise at s (0 off it). */
export function rampAt(K, s) {
  for (const j of K.jumps) {
    const u = K.ds(s, j.ramp0);
    if (u >= 0 && u <= K.C.ramp.len) return K.C.ramp.h * (u / K.C.ramp.len) ** 2;
  }
  return 0;
}

/** The sand drift at (s, d), 0..1 of its height (0: none). */
export function driftAt(K, s, d) {
  const hw = K.halfW(s);
  let r = 0;
  for (const D of K.drifts) {
    const u = K.ds(s, D.s);
    if (Math.abs(u) > K.C.driftThick) continue;
    const along = Math.cos((u / K.C.driftThick) * Math.PI / 2) ** 2;
    const edge = D.side * hw - D.side * 2 * hw * D.reach;   // (it runs from the wall on its side to here)
    const across = smooth(-1.6, 1.6, (d - edge) * D.side);
    r = Math.max(r, along * across);
  }
  return r;
}

/** A drift's footprint (the bike bogs down in it): its index, or -1. */
export function driftHit(K, s, d) {
  const hw = K.halfW(s);
  for (let i = 0; i < K.drifts.length; i++) {
    const D = K.drifts[i];
    if (Math.abs(K.ds(s, D.s)) > K.C.driftThick * 0.55) continue;
    const edge = D.side * hw - D.side * 2 * hw * D.reach;
    if ((d - edge) * D.side > 0.3 && Math.abs(d) < hw + 1) return i;
  }
  return -1;
}

/** A boost pad under (s, d): its index, or -1. */
export function padHit(K, s, d) {
  for (let i = 0; i < K.pads.length; i++) {
    const P = K.pads[i], u = K.ds(s, P.s);
    if (Math.abs(u) <= K.C.padLen / 2 && Math.abs(d - P.df * K.halfW(P.s)) <= K.C.padW / 2) return i;
  }
  return -1;
}

/** The canyon's height at a place along and across it. */
export function profileHeight(K, s, d, shift = 0) {
  const C = K.C, hw = K.halfW(s), a = Math.abs(d), f = K.floorY(s), c0 = hw + C.bank + shift;
  const top = f + 4 + K.cliffH(s);
  if (a > c0 + C.cliff) {
    // the plateau: low swells and the odd butte
    return top + 1.5 * Math.sin(s / 23 + a / 17) + 2 * smooth(30, 70, a - hw) * Math.sin(s / 41 - a / 29);
  }
  if (a > c0) return f + 4 + K.cliffH(s) * smooth(c0, c0 + C.cliff, a) ** 0.8;
  if (inGap(K, s)) return f - 22;
  let h;
  if (a > hw) { const u = Math.min(1, (a - hw) / C.bank); h = f + 0.6 + 3.4 * u * u; }
  else h = f + 0.6 * (a / hw) ** 2;
  h += rampAt(K, s) * (1 - smooth(hw - 2, hw + 2, a));
  h += C.driftH * driftAt(K, s, d);
  return h;
}

/**
 * The height anywhere: found on the loop, then the profile. (shift: the cliff's foot moved out, m: the
 * ground drawn behind the cliffs' strata faces, so its coarse triangles never poke through them)
 */
export function canyonHeight(K, x, z, hint = -1, shift = 0) {
  const n = nearest(K.track, x, z, hint, 48, _nh);
  return profileHeight(K, n.s, n.d, shift);
}
const _nh = {};

// ------------------------------------------------------------------ the bike (pure)
export const BIKE = {
  hover: 1.15, max: 34, boost: 52, boostKick: 46, accel: 0.85, brake: 40, coast: 0.5,
  turn: 1.9, airTurn: 0.45, g: 26, hop: 12,
  sandDrag: 2.4,        // 1/s, at the bank's foot (more up it)
  wallSlow: 0.55, wallBounce: 0.35,
  driftSlow: 0.5, driftDrag: 1.2,
  padTime: 1.6,
};

export function newBike(K, s, d = 0) {
  const p = pointAt(K.track, s), nx = p.tz, nz = -p.tx;
  const x = p.x + nx * d, z = p.z + nz * d;
  const y = profileHeight(K, s, d) + BIKE.hover;
  return { x, y, z, vx: 0, vy: 0, vz: 0, heading: Math.atan2(p.tx, p.tz), speed: 0, yawRate: 0, bank: 0, pitch: 0, grounded: true,
    boost: 0, hint: p.i, s, d, prog: s, drift: -1, pad: -1, sand: 0, t: 0, hopHeld: false };
}

/**
 * One step of the bike: B changes in place; returns what happened
 * ([{ kind: 'hop' | 'air' | 'land' | 'wall' | 'drift' | 'boost' | 'fell', … }]).
 * inp: { x (-1..1 steer, > 0 right), throttle 0..1, brake 0..1, hop (held) }
 */
export function bikeStep(B, inp, dt, K, P = BIKE) {
  const ev = [];
  const ground = (x, z) => canyonHeight(K, x, z, B.hint);
  B.t += dt;
  const steer = inp.x ?? 0, thr = inp.throttle ?? 0, brake = inp.brake ?? 0;
  // the steering (the desert bike's: tighter slow, less in the air)
  const grip = Math.min(1, Math.max(0.35, Math.abs(B.speed) / 14)) * (B.grounded ? 1 : P.airTurn);
  const rate = -steer * P.turn * grip;
  B.yawRate += (rate - B.yawRate) * (1 - Math.exp(-6 * dt));
  B.heading = wrap(B.heading + B.yawRate * dt);
  // the throttle, the boost, the brake
  B.boost = Math.max(0, B.boost - dt);
  const max = B.boost > 0 ? P.boost : P.max;
  if (brake > 0.05) B.speed = Math.max(0, B.speed - P.brake * brake * dt);
  else if (thr > 0.02) B.speed += (max * thr - B.speed) * (1 - Math.exp(-(B.speed > max ? 1.4 : P.accel) * dt));
  else B.speed *= Math.exp(-P.coast * dt);
  const fx = Math.sin(B.heading), fz = Math.cos(B.heading);
  const a = 1 - Math.exp(-(B.grounded ? 3.5 : 0.6) * dt);
  B.vx += (fx * B.speed - B.vx) * a;
  B.vz += (fz * B.speed - B.vz) * a;
  // the hover spring over the ground (and the ground just ahead: it rides up a rise early)
  const g = ground(B.x, B.z), gA = ground(B.x + fx * 2.5, B.z + fz * 2.5);
  const target = Math.max(g, gA - 0.3) + P.hover;
  const was = B.grounded;
  B.hopT = Math.max(0, (B.hopT ?? 0) - dt);
  if (B.y < target + 0.6 && !(B.hopT > 0 || (B.vy > 2 && !was))) { B.vy += ((target - B.y) * 45 - B.vy * 7) * dt; B.grounded = true; }   // (a hop flies free of the spring until it comes down)
  else { B.vy -= P.g * dt; B.grounded = false; }
  if (inp.hop && !B.hopHeld && B.grounded) { B.vy = P.hop; B.hopT = 0.3; B.grounded = false; ev.push({ kind: 'hop' }); }
  B.hopHeld = !!inp.hop;
  if (was && !B.grounded && !ev.length) ev.push({ kind: 'air' });
  if (!was && B.grounded) ev.push({ kind: 'land', impact: Math.max(0, -B.vy) });
  B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
  const gNow = ground(B.x, B.z);
  if (B.y < gNow + 0.4) { B.y = gNow + 0.4; B.vy = Math.max(B.vy, 0); }

  // where it is on the loop now
  const n = nearest(K.track, B.x, B.z, B.hint, 24, B._n ??= {});
  B.hint = n.i;
  B.prog += K.ds(n.s, B.s);
  B.s = n.s; B.d = n.d;
  const hw = K.halfW(n.s), side = Math.sign(n.d) || 1, nx = n.tz * side, nz = -n.tx * side;   // (outward from the middle, on this side)
  const u = Math.abs(n.d) - hw;
  B.sand = 0;
  if (u > 0 && B.y < gNow + P.hover + 1.2) {
    // up the sand bank: the deeper the slower
    B.sand = Math.min(1, u / K.C.bank);
    B.speed *= Math.exp(-P.sandDrag * (0.5 + 1.5 * B.sand) * dt);
  }
  if (u > K.C.bank) {
    // the cliff's foot: thrown back off it
    const over = u - K.C.bank;
    B.x -= nx * over; B.z -= nz * over; B.d = side * (hw + K.C.bank);
    const vn = B.vx * nx + B.vz * nz;
    if (vn > 0) {
      B.vx -= nx * vn * (1 + P.wallBounce); B.vz -= nz * vn * (1 + P.wallBounce);
      B.speed *= P.wallSlow;
      const along = Math.atan2(B.vx, B.vz);
      B.heading = wrap(B.heading + wrap(along - B.heading) * 0.7);
      ev.push({ kind: 'wall', impact: vn });
    }
  }
  // a sand drift across the floor: bogged down on entering it (hopped over, nothing)
  const di = B.grounded ? driftHit(K, n.s, n.d) : -1;
  if (di >= 0 && B.drift !== di) { B.speed *= P.driftSlow; ev.push({ kind: 'drift', i: di }); }
  if (di >= 0) B.speed *= Math.exp(-P.driftDrag * dt);
  B.drift = di;
  // a boost pad
  const pi = B.y < gNow + P.hover + 1.0 ? padHit(K, n.s, n.d) : -1;
  if (pi >= 0 && B.pad !== pi) { B.boost = P.padTime; B.speed = Math.max(B.speed, P.boostKick); ev.push({ kind: 'boost', i: pi }); }
  B.pad = pi;
  // down a chasm
  if (B.y < K.floorY(n.s) - 6) ev.push({ kind: 'fell' });

  // the pose: pitch with the ground, bank into the turns
  const hB = ground(B.x - fx * 1.5, B.z - fz * 1.5), hF = ground(B.x + fx * 1.5, B.z + fz * 1.5);
  const tp = B.grounded ? -Math.atan2(hF - hB, 3) : -B.vy * 0.02;
  const tb = Math.max(-0.55, Math.min(0.55, -B.yawRate * Math.abs(B.speed) * 0.025));
  const k = 1 - Math.exp(-6 * dt);
  B.pitch += (tp - B.pitch) * k; B.bank += (tb - B.bank) * k;
  return ev;
}

// ------------------------------------------------------------------ the race (pure)
/** Laps and splits: a split at each checkpoint, in order; the run done after the last lap's line. */
export function newRace(K) { return { next: 1, splits: [], laps: [], lapStart: 0, done: false, n: K.C.checkpoints * K.C.laps }; }

/** The progress (m from the line, unwrapped) at which split n (1-based) is taken. */
export const splitAt = (K, n) => (n * K.L) / K.C.checkpoints;

/** The race after this frame's progress at time t: the splits taken ([{ n, t, lap, lapTime? }]). */
export function raceStep(R, K, prog, t) {
  const out = [];
  while (!R.done && prog >= splitAt(K, R.next)) {
    const n = R.next++;
    R.splits.push(t);
    const e = { n, t, lap: Math.ceil(n / K.C.checkpoints) };
    if (n % K.C.checkpoints === 0) { e.lapTime = t - R.lapStart; R.laps.push(e.lapTime); R.lapStart = t; }
    if (n >= R.n) { R.done = true; e.done = true; }
    out.push(e);
  }
  return out;
}

/** The time against the best run's split: − ahead, + behind (null: no best yet). */
export const splitDelta = (t, best, n) => (Array.isArray(best) && Number.isFinite(best[n - 1]) ? t - best[n - 1] : null);
export const fmtDelta = (d) => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`;

// ------------------------------------------------------------------ a rider that can drive it (tests, screenshots)
/** The bike's input to drive the course well: along the middle, onto the pads, round the drifts. */
export function botInput(B, K, { look = 16 } = {}) {
  const ahead = look + Math.abs(B.speed) * 0.45;
  let d = 0;
  // a pad coming: aim for it; a drift coming: the open side
  for (const P of K.pads) { const u = K.ds(P.s, B.s); if (u > 0 && u < 70) d = P.df * K.halfW(P.s); }
  for (const D of K.drifts) {
    const u = K.ds(D.s, B.s);
    if (u > -6 && u < 75) d = -D.side * K.halfW(D.s) * D.reach;   // (the middle of the gap it leaves)
  }
  const p = pointAt(K.track, B.s + ahead);
  const tx = p.x + p.tz * d, tz = p.z - p.tx * d;
  const want = Math.atan2(tx - B.x, tz - B.z);
  const diff = wrap(want - B.heading);
  return { x: Math.max(-1, Math.min(1, -diff * 2.6)), throttle: 1, brake: 0, hop: false };
}

// ------------------------------------------------------------------ the canyon, built
const INK = '#2b211f';
const tag = (m) => { m.userData.noCollide = true; return m; };

/** A flat shape laid onto the ground: each vertex's height from H, lifted. (geo in world x, z; y ignored) */
function drape(geo, H, lift) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)) + lift);
  geo.computeVertexNormals();
  return geo;
}

/** A shape in the course's own frame (u along, v across, outward) at s: to world x, z. */
function frameAt(K, s) {
  const p = pointAt(K.track, s);
  return { x: p.x, z: p.z, tx: p.tx, tz: p.tz, nx: p.tz, nz: -p.tx, heading: Math.atan2(p.tx, p.tz) };
}

function* buildCanyon(scene) {
  const K = makeCourse();
  const terrain = yield* Terrain.make({
    size: 720, seg: 360,
    height: (x, z) => canyonHeight(K, x, z, -1, 4),
    material: { color: '#eebf8c', color2: '#f3d3a6', color3: '#c9765a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const H = (x, z) => terrain.heightAt(x, z);
  const ink = makeMaterial({ color: INK, flat: true });
  const wood = makeMaterial({ color: '#a8683f', color2: '#8c5533' });
  const strata = makeMaterial({ color: '#d98a64', color2: '#e9b48a', color3: '#b7604a', mode: MODE_STRATA, strataSize: 3.2, side: THREE.DoubleSide });
  const strataPale = makeMaterial({ color: '#efc9a0', color2: '#e1a77d', color3: '#c87d5d', mode: MODE_STRATA, strataSize: 5 });
  const cloth = {
    rust: makeMaterial({ color: '#d9643a', side: THREE.DoubleSide }), cream: makeMaterial({ color: '#f7ecd2', side: THREE.DoubleSide }),
    cobalt: makeMaterial({ color: '#3f5fae', side: THREE.DoubleSide }), passed: makeMaterial({ color: '#71d7cf', glow: 0.6, side: THREE.DoubleSide }),
  };

  // the cliffs' faces: banded strata, standing where the ground's own cliffs would be (those are drawn 4 m
  // further back), a lip over the top
  const C = K.C, rows = 9, step = 2, faces = [];
  for (const side of [-1, 1]) {
    const pos = [], idx = [];
    const cols = Math.floor(K.track.N / step);
    for (let c = 0; c <= cols; c++) {
      const i = (c * step) % K.track.N, s = K.track.s[i], hw = K.halfW(s);
      const nx = K.track.tz[i], nz = -K.track.tx[i];
      for (let r = 0; r < rows; r++) {
        const top = r === rows - 1, a = top ? hw + C.bank + C.cliff + 3.5 : hw + C.bank + C.cliff * (r / (rows - 2)) ** 1.2;
        let y = profileHeight(K, s, side * Math.min(a, hw + C.bank + C.cliff + 0.01));
        if (r === 0) y = inGap(K, s) ? K.floorY(s) - 22 : profileHeight(K, s, side * (hw + C.bank - 0.5)) - 0.3;   // (down into a chasm; just into the bank's top)
        if (top) y += 0.3;
        const d = side * (r === 0 ? a - 0.5 : a);
        pos.push(K.track.x[i] + nx * d, y, K.track.z[i] + nz * d);
      }
    }
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r, b = a + rows;
      if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    faces.push(g);
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(faces), strata)));
  yield;

  // natural arches across the canyon, and hoodoos along the rims
  const rock = [];
  for (const f of C.arches) {
    const s = f * K.L, F = frameAt(K, s), hw = K.halfW(s), R = hw + C.bank + 4;
    const y = K.floorY(s) + 3.2;
    const g = new THREE.TorusGeometry(R, 2.6 + (f * 7) % 1.2, 7, 26, Math.PI).scale(1, 1.05 + (f * 3) % 0.4, 1.3);
    // (the torus stands in its x-y plane: x across the canyon, so turned to the loop's heading)
    g.rotateY(F.heading).translate(F.x, y, F.z);
    rock.push(g.toNonIndexed());
  }
  for (let i = 0; i < 46; i++) {
    const s = (i / 46) * K.L + (i * 37) % 23, side = i % 2 ? 1 : -1, F = frameAt(K, s);
    const a = K.halfW(s) + C.bank + C.cliff + 4 + (i * 53) % 30, x = F.x + F.nx * side * a, z = F.z + F.nz * side * a;
    const h = 8 + (i * 29) % 18, r = 1.6 + (i % 4) * 0.7, y = profileHeight(K, s, side * a);
    rock.push(new THREE.CylinderGeometry(r * 0.75, r, h, 7).translate(x, y + h / 2 - 1, z).toNonIndexed());
    rock.push(new THREE.CylinderGeometry(r * 1.6, r * 1.2, 1.6, 8).translate(x, y + h - 0.6, z).toNonIndexed());
  }
  // the far mesas, past the plateau's edge, for the eye
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3, R = 330 + (i * 41) % 60, x = Math.cos(a) * R, z = Math.sin(a) * R;
    const h = 40 + (i * 23) % 50, r = 22 + (i * 17) % 20;
    rock.push(new THREE.CylinderGeometry(r * 0.8, r, h, 12, 3).translate(x, 28 + h / 2, z).toNonIndexed());
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(rock), strataPale)));
  yield;

  // the kickers: wooden decks over the ramps, striped stakes at the lips
  const deckParts = [], stakes = [];
  for (const j of K.jumps) {
    for (let u = 0; u < C.ramp.len; u += 2.0) {
      const s = j.ramp0 + u, F = frameAt(K, s), hw = K.halfW(s) - 1.5;
      const g = new THREE.BoxGeometry(hw * 2, 0.12, 1.7, 8, 1, 1);
      g.rotateY(F.heading).translate(F.x, 0, F.z);
      deckParts.push(drape(g.toNonIndexed(), (x, z) => canyonHeight(K, x, z), 0.08));
    }
    for (const side of [-1, 1]) for (const at of [j.s - 0.3, j.s + j.gap + 0.3]) {
      const F = frameAt(K, at), a = K.halfW(at) - 0.5, x = F.x + F.nx * side * a, z = F.z + F.nz * side * a;
      const y = at < j.s ? profileHeight(K, j.s - 0.5, side * a) : profileHeight(K, at, side * a);
      for (let b = 0; b < 4; b++) stakes.push({ g: new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6).translate(x, y + 0.45 + b * 0.9, z), m: b % 2 });
    }
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(deckParts), wood)));
  scene.add(tag(new THREE.Mesh(mergeGeometries(stakes.filter((p) => p.m).map((p) => p.g)), cloth.rust)));
  scene.add(tag(new THREE.Mesh(mergeGeometries(stakes.filter((p) => !p.m).map((p) => p.g)), cloth.cream)));
  yield;

  // the drifts: a sand fence along each crest, its slats leaning, half buried (so a drift is seen coming)
  const slats = [];
  for (const D of K.drifts) {
    const hw = K.halfW(D.s), edge = D.side * hw - D.side * 2 * hw * D.reach;
    for (let d = edge + D.side * 1.2, k = 0; (d - D.side * hw) * D.side < -0.5; d += D.side * 0.9, k++) {
      const F = frameAt(K, D.s), x = F.x + F.nx * d, z = F.z + F.nz * d, y = canyonHeight(K, x, z);
      const h = 0.9 + ((k * 7) % 5) * 0.12;
      const g = new THREE.BoxGeometry(0.16, h, 0.06).translate(0, h / 2 - 0.25, 0).rotateZ(((k * 5) % 7 - 3) * 0.05).rotateY(F.heading).translate(x, y, z);
      slats.push(g.toNonIndexed());
    }
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(slats), wood)));
  yield;

  // the boost pads: a pale plate, three ink chevrons pointing on (they glow when one is taken)
  const plateM = makeMaterial({ color: '#f6e7c4', glow: 0.25, flat: true });
  const chevM = makeMaterial({ color: INK, flat: true, side: THREE.DoubleSide });
  const chevGlow = makeMaterial({ color: '#71d7cf', glow: 1, flat: true, side: THREE.DoubleSide });
  const padMeshes = [];
  const chevShape = new THREE.Shape([new THREE.Vector2(-1.9, -0.6), new THREE.Vector2(0, 0.9), new THREE.Vector2(1.9, -0.6), new THREE.Vector2(1.9, 0.35), new THREE.Vector2(0, 1.85), new THREE.Vector2(-1.9, 0.35)]);
  for (const P of K.pads) {
    const F = frameAt(K, P.s), d0 = P.df * K.halfW(P.s);
    const cx = F.x + F.nx * d0, cz = F.z + F.nz * d0;
    const plate = new THREE.PlaneGeometry(C.padW, C.padLen, 4, 6).rotateX(-Math.PI / 2).rotateY(F.heading).translate(cx, 0, cz);
    const chevs = [];
    for (let k = 0; k < 3; k++) {
      const g = new THREE.ShapeGeometry(chevShape).rotateX(Math.PI / 2).translate(0, 0, -3.6 + k * 2.4);
      g.scale(1.15, 1, 1.15).rotateY(F.heading).translate(cx, 0, cz);
      chevs.push(g.toNonIndexed());
    }
    const pm = tag(new THREE.Mesh(drape(plate, H, 0.06), plateM));
    const cm = tag(new THREE.Mesh(drape(mergeGeometries(chevs), H, 0.1), chevM));
    pm.castShadow = cm.castShadow = false;
    scene.add(pm, cm);
    padMeshes.push({ chev: cm, glow: 0 });
  }
  yield;

  // the checkpoints: two posts on the banks, a line between with pennants; the line itself chequered
  const gates = K.checks.map((s, k) => {
    const grp = new THREE.Group(), F = frameAt(K, s), hw = K.halfW(s), a = hw + 2.5, flags = [];
    const tops = [];
    for (const side of [-1, 1]) {
      const x = F.x + F.nx * side * a, z = F.z + F.nz * side * a, y = profileHeight(K, s, side * a);
      const post = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 9, 7).translate(0, 4.5, 0), k === 0 ? ink : wood));
      post.position.set(x, y - 0.3, z);
      const cap = tag(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), k === 0 ? cloth.cream : cloth.rust));
      cap.position.set(x, y + 8.9, z);
      grp.add(post, cap);
      tops.push(new THREE.Vector3(x, y + 8.4, z));
    }
    const span = tops[0].distanceTo(tops[1]), mid = tops[0].clone().lerp(tops[1], 0.5);
    const rope = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, span, 4).rotateX(Math.PI / 2), ink));
    rope.position.copy(mid); rope.lookAt(tops[1]);
    grp.add(rope);
    const n = k === 0 ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = tops[0].clone().lerp(tops[1], t);
      p.y -= Math.sin(t * Math.PI) * 0.9;
      const fl = tag(new THREE.Mesh(k === 0 ? new THREE.PlaneGeometry(span / n, 1.3) : new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.55, 0, 0, 0.55, 0, 0, 0, -1.5, 0], 3)), k === 0 ? (i % 2 ? ink : cloth.cream) : i % 2 ? cloth.cobalt : cloth.cream));
      if (!fl.geometry.attributes.normal) fl.geometry.computeVertexNormals();
      fl.position.copy(p); if (k === 0) fl.position.y -= 0.65;
      fl.rotation.y = F.heading;
      fl.castShadow = false;
      grp.add(fl); flags.push(fl);
    }
    scene.add(grp);
    return { s, flags, colours: flags.map((f) => f.material) };
  });
  yield;

  const start = frameAt(K, 6);
  return arenaLevel({
    ground: terrain, name: 'The Rose Canyon', hour: 15.2,
    spawn: new THREE.Vector3(start.x, H(start.x, start.z) + 1, start.z),
    features: { mount: false, wind: true, jetpack: false, climb: false },
    canyon: { K, H, gates, pads: padMeshes, cloth, chevM, chevGlow },
  });
}

// ------------------------------------------------------------------ the rider on the bike
function poseRider(player, B, t) {
  const c = player.char, flow = Math.min(Math.abs(B.speed) / 30, 1.3), lean = B.bank;
  for (const f of c.feet) f.rotation.set(0, 0, 0);
  c.legs[0].rotation.set(-1.35, 0, 0.12);
  c.legs[1].rotation.set(-1.35, 0, -0.12);
  c.knees[0].rotation.x = c.knees[1].rotation.x = 1.45;
  c.body.position.set(0, B.grounded ? 0 : 0.06, 0);
  c.body.rotation.set(0.12 + flow * 0.14 + (B.boost > 0 ? 0.12 : 0), 0, -lean * 0.4);
  c.torso.rotation.set(0.12 + (B.boost > 0 ? 0.1 : 0), 0, -lean * 0.3);
  c.arms[0].rotation.set(-1.0, 0, -0.2);
  c.arms[1].rotation.set(-1.0, 0, 0.2);
  c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.6;
  c.head.rotation.set(-0.15, 0, lean * 0.3);
  c.hatTip.rotation.x = -0.55 - flow * 0.5 + Math.sin(t * 20) * 0.06 * flow;
  for (const fl of c.flames) fl.visible = false;
  player._gait = null;
}

// ------------------------------------------------------------------ the bike's sound: its own motor
function motor(sound) {
  if (!sound?.ctx || !sound.fx) return null;
  const ctx = sound.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0;
  o.connect(f); o2.connect(f); f.connect(g).connect(sound.fx);
  o.start(); o2.start();
  return {
    set(speed, boost, live) {
      const t = ctx.currentTime, on = live && !sound.muted ? 1 : 0;
      g.gain.setTargetAtTime(on * (0.03 + boost * 0.02), t, 0.15);
      o.frequency.setTargetAtTime(40 + Math.abs(speed) * 2.2 + boost * 30, t, 0.12);
      o2.frequency.setTargetAtTime(81 + Math.abs(speed) * 4.3, t, 0.12);
      f.frequency.setTargetAtTime(260 + Math.abs(speed) * 26 + boost * 900, t, 0.12);
    },
    stop() { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); o.stop(ctx.currentTime + 0.3); o2.stop(ctx.currentTime + 0.3); } catch { /* (already stopped) */ } },
  };
}

// ------------------------------------------------------------------ the game
const SPLITS = 'minigame.canyon.splits', BEST_LAP = 'minigame.canyon.lap';
const SAND = ['#e7b98a', '#d9a273', '#f2d4ae', '#b98a5a'];
const _UP = new THREE.Vector3(0, 1, 0), _sp = new THREE.Vector3(), _sv = new THREE.Vector3(), _q = new THREE.Quaternion(), _jet = new THREE.Vector3();

function start(ctx) {
  const { player, camera, level, sfx } = ctx;
  const Cy = level.canyon, K = Cy.K;
  const state = ctx.state;
  const bestSplits = state?.flag?.(SPLITS) ?? null, bestLap = state?.flag?.(BEST_LAP) ?? null;
  const B = newBike(K, 6, 0);
  const R = newRace(K);
  const bike = buildBike();
  ctx.add(bike.root);
  bike.root.traverse((o) => { o.userData.noCollide = true; });
  const glowM = makeMaterial({ color: '#9fe0d0', glow: 0.9, key: 'canyon-bike-glow' });
  for (const m of bike.lights ?? []) m.material = glowM;
  const trails = bike.jets.map((_, i) => new Trail(ctx.scene, { radius: 0.26, life: 1.6, offset: i * 2.5, ground: (x, y, z) => Cy.H(x, z) }));
  const trailM = makeMaterial({ color: '#ffffff', mode: MODE_RIBBON, glow: 1, fluid: 'trail', fluidTones: FLUID_TONES, key: 'fluid-trail' });
  for (const tr of trails) tr.mesh.material = trailM;
  const spray = new Dots(ctx.scene, 320, makeMaterial({ color: '#ffffff', flat: true, key: 'canyon-spray' }));
  (level.noShadow ??= []).push(spray.mesh, ...trails.map((t) => t.mesh));
  for (const g of Cy.gates) g.flags.forEach((f, i) => { f.material = g.colours[i]; });
  const eng = motor(ctx.sound);
  const run = { walls: 0, drifts: 0, boosts: 0, falls: 0, top: 0, dying: 0, airFrom: null, longest: 0 };
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let t = 0, lastCheck = 0;
  const _w = new THREE.Vector3(), _l = new THREE.Vector3();

  function place(dt) {
    bike.root.position.set(B.x, B.y, B.z);
    bike.root.rotation.y = B.heading;
    bike.body.rotation.set(B.pitch, 0, B.bank);
    bike.animate?.(dt, { yawRate: B.yawRate, speed: B.speed, time: t });
    bike.root.updateMatrixWorld(true);
    bike.seatAnchor.getWorldPosition(player.object.position);
    bike.seatAnchor.getWorldQuaternion(player.object.quaternion);
    player.pos.set(B.x, B.y, B.z);
    player.vel.set(B.vx, B.vy, B.vz);
    player.heading = B.heading;
    player.onGround = B.grounded;
  }

  function updateCamera(dt, snap = false) {
    const k = Math.min(Math.abs(B.speed) / 40, 1);
    const vdir = Math.abs(B.speed) > 3 ? Math.atan2(B.vx, B.vz) : B.heading;
    const a = vdir + wrap(B.heading - vdir) * 0.5;
    const back = 6.6 + 2.6 * k, up = 2.5 + 0.7 * k;
    _w.set(B.x - Math.sin(a) * back, B.y + up, B.z - Math.cos(a) * back);
    const floor = Cy.H(_w.x, _w.z) + 1.4;
    if (_w.y < floor) _w.y = floor;
    _l.set(B.x + Math.sin(a) * (6 + 6 * k), B.y + 0.9, B.z + Math.cos(a) * (6 + 6 * k));
    cam.pos.lerp(_w, snap ? 1 : 1 - Math.exp(-8 * dt));
    cam.look.lerp(_l, snap ? 1 : 1 - Math.exp(-11 * dt));
    camera.position.copy(cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.look);
    ctx.setFov(60 + 14 * k + (B.boost > 0 ? 6 : 0));
  }

  function respawn() {
    const s0 = splitAt(K, R.next - 1) + 4;
    const nb = newBike(K, s0 % K.L, 0);
    Object.assign(B, nb, { prog: s0, speed: 14 });
    B.vx = Math.sin(B.heading) * 14; B.vz = Math.cos(B.heading) * 14;
    for (const tr of trails) tr.samples.length = 0;
    updateCamera(0, true);
  }

  function split(e) {
    const k = ((e.n - 1) % K.C.checkpoints) + 1;
    const gate = Cy.gates[k % K.C.checkpoints];
    for (const f of gate.flags) if (k !== K.C.checkpoints) f.material = Cy.cloth.passed;
    if (k === K.C.checkpoints) for (const g of Cy.gates) g.flags.forEach((f, i) => { f.material = g.colours[i]; });   // (a new lap: the gates fresh again)
    const d = splitDelta(e.t, bestSplits, e.n);
    if (e.lapTime !== undefined) {
      sfx.checkpoint();
      const lb = Number.isFinite(bestLap) && e.lapTime < bestLap;
      if (!e.done) ctx.flash(`Lap ${e.lap} · ${e.lapTime.toFixed(2)} s${d !== null ? `  ${fmtDelta(d)}` : ''}${lb ? ' · best lap!' : ''}`, d !== null && d > 0 ? 'bad' : 'good', 1.8);
    } else {
      sfx.gate();
      ctx.flash(d !== null ? `${fmtDelta(d)}` : `Split ${e.t.toFixed(2)}`, d === null ? '' : d <= 0 ? 'good' : 'bad', 1.1);
    }
    lastCheck = e.n;
    if (e.done) {
      const total = e.t;
      const best = state?.flag?.(SPLITS);
      const prev = Array.isArray(best) ? best[best.length - 1] : null;
      if (state && (!Number.isFinite(prev) || total < prev)) state.set(SPLITS, R.splits.slice());
      const fastest = Math.min(...R.laps);
      if (state && (!Number.isFinite(bestLap) || fastest < bestLap)) state.set(BEST_LAP, fastest);
      ctx.finish({ lines: [
        `Laps ${R.laps.map((l) => l.toFixed(2)).join(' · ')}`,
        `Fastest lap ${fastest.toFixed(2)} s${Number.isFinite(bestLap) ? ` (best ${Math.min(bestLap, fastest).toFixed(2)})` : ''}`,
        `Top speed ${Math.round(run.top * 3.6)} km/h · boosts ${run.boosts} · longest jump ${run.longest.toFixed(0)} m`,
        ...(run.walls || run.drifts || run.falls ? [`Walls ${run.walls} · drifts ${run.drifts} · falls ${run.falls}${run.falls ? ` (+${run.falls * K.C.fallPenalty} s)` : ''}`] : ['A clean run: no wall, no drift, no fall']),
      ] });
    }
  }

  place(1 / 60);
  updateCamera(0, true);
  poseRider(player, B, 0);
  ctx.status(`Lap 1/${K.C.laps} · 0 km/h`);

  return {
    bike: B, course: K, race: R,
    update(dt, inp, { live, phase }) {
      t += dt;
      const moving = live || phase === 'finishing';
      const bot = (typeof window !== 'undefined' && window.__canyonBot) ? botInput(B, K) : null;
      const steerX = bot ? bot.x : bikeSteer(inp.x, false);
      const thr = bot ? 1 : Math.max(inp.tuck, inp.y > 0.3 ? inp.y : 0);
      const ii = !moving ? { x: 0, throttle: 0, brake: 0, hop: false }
        : R.done ? { x: 0, throttle: 0, brake: 0.35, hop: false }
          : { x: steerX, throttle: thr, brake: bot ? 0 : inp.brake, hop: bot ? false : inp.jump };
      if (run.dying > 0) {
        run.dying -= dt;
        B.vy -= 26 * dt; B.y += B.vy * dt; B.x += B.vx * dt * 0.3; B.z += B.vz * dt * 0.3;
        if (run.dying <= 0) respawn();
      } else if (moving || phase === 'count') {
        const evs = bikeStep(B, phase === 'count' ? { x: 0, throttle: 0, brake: 1, hop: false } : ii, dt, K);
        for (const e of evs) {
          if (e.kind === 'hop') { sfx.jump(); run.airFrom = { x: B.x, z: B.z }; }
          if (e.kind === 'air') run.airFrom = { x: B.x, z: B.z };
          if (e.kind === 'land') {
            sfx.land(Math.min(e.impact / 14, 1)); if (e.impact > 8) ctx.kick(Math.min(e.impact / 30, 0.5));
            if (run.airFrom) { const d = Math.hypot(B.x - run.airFrom.x, B.z - run.airFrom.z); run.longest = Math.max(run.longest, d); if (d > 18 && live) ctx.flash(`${d.toFixed(0)} m jump`, 'good', 0.9); run.airFrom = null; }
          }
          if (e.kind === 'wall') { run.walls++; sfx.land(Math.min(e.impact / 15, 1)); ctx.kick(Math.min(0.15 + e.impact / 30, 0.6)); burst(10 + e.impact * 2, 1.4); }
          if (e.kind === 'drift') { run.drifts++; sfx.crumble(); ctx.kick(0.35); ctx.flash('Sand drift!', 'bad', 0.8); burst(30, 1.8); }
          if (e.kind === 'boost') { run.boosts++; sfx.whoosh(); sfx.spring(); ctx.kick(0.2); const pm = Cy.pads[e.i]; pm.glow = 1; pm.chev.material = Cy.chevGlow; }
          if (e.kind === 'fell' && live) {
            run.falls++; run.dying = 1.0; sfx.hurt(); ctx.kick(0.5);
            ctx.addTime(K.C.fallPenalty, `Down the chasm · +${K.C.fallPenalty} s`);
          }
        }
        if (live) for (const e of raceStep(R, K, B.prog, ctx.time)) split(e);
      }
      run.top = Math.max(run.top, B.speed);
      // the pads cool after their flash
      for (const pm of Cy.pads) if (pm.glow > 0 && (pm.glow -= dt / 0.6) <= 0) pm.chev.material = Cy.chevM;
      // sand thrown up off the banks and the drifts; the jets' trails
      const fx = Math.sin(B.heading), fz = Math.cos(B.heading);
      const churn = (B.sand > 0 || B.drift >= 0) && B.speed > 4 ? Math.min(1, 0.4 + B.sand + (B.drift >= 0 ? 0.6 : 0)) : 0;
      if (churn > 0 && Math.random() < 0.9) burst(1 + churn * 4, churn);
      function burst(n, k) {
        for (let i = 0; i < n; i++) {
          _sp.set(B.x - fx * 1.0 + (Math.random() - 0.5) * 1.2, B.y - 0.8, B.z - fz * 1.0 + (Math.random() - 0.5) * 1.2);
          _sv.set(B.vx * 0.35 + (Math.random() - 0.5) * 6 * k, 2 + 5 * Math.random() * k, B.vz * 0.35 + (Math.random() - 0.5) * 6 * k);
          spray.add({ pos: _sp, vel: _sv, grav: 14, drag: 2.2, size: 0.03 + 0.04 * Math.random(), stretch: 3, life: 0.4 + 0.5 * Math.random(), color: SAND[(Math.random() * SAND.length) | 0] });
        }
      }
      spray.update(dt, _UP);
      place(dt);
      const lay = run.dying <= 0 && (moving || phase === 'count');
      trails.forEach((tr, i) => tr.update(dt, lay ? bike.body.localToWorld(_jet.copy(bike.jets[i])) : null));
      poseRider(player, B, t);
      player.humanoid?.update();
      player.humanoid?.resetFeet();
      player.humanoid?.updateEyes?.(dt, null);
      player.updateCloth?.(dt);
      updateCamera(dt);
      ctx.speed(Math.max(0, Math.min(1, (B.speed - 26) / 22)) + (B.boost > 0 ? 0.25 : 0));
      eng?.set(B.speed, B.boost > 0 ? 1 : 0, moving || phase === 'count');
      const lap = Math.min(K.C.laps, Math.floor((R.next - 1) / K.C.checkpoints) + 1);
      ctx.status(`Lap ${lap}/${K.C.laps} · ${Math.round(B.speed * 3.6)} km/h`);
    },
    end() {
      eng?.stop();
      disposeTree(...trails.map((tr) => tr.mesh), spray.mesh);
      level.noShadow = (level.noShadow ?? []).filter((m) => m !== spray.mesh && !trails.some((t) => t.mesh === m));
      ctx.speed(0);
      for (const pm of Cy.pads) { pm.glow = 0; pm.chev.material = Cy.chevM; }
    },
  };
}

export default {
  id: 'canyon', order: 3,
  name: 'Canyon run',
  blurb: 'The hoverbike round the Rose Canyon: three laps through its bends, over its two chasms, against your best.',
  rules: 'Three laps; every checkpoint shows your split against your best run. The sand banks and the drifts slow you, the cliffs throw you back, the ink chevrons boost you. Hit the kickers fast to clear the chasms (a fall costs 2 s).',
  controls: {
    pad: [['Left stick', 'steer'], ['RT / R2', 'throttle'], ['LT / L2', 'brake'], ['A / ×', 'hop (over a drift)'], ['Menu', 'pause']],
    keys: [['A  D', 'steer'], ['W  or  Shift', 'throttle'], ['S', 'brake'], ['Space', 'hop (over a drift)'], ['Esc', 'pause']],
    touch: [['Stick', 'steer, push up to go, pull back to brake'], ['⤒', 'hop'], ['run', 'full throttle on / off']],
  },
  score: { kind: 'time' },
  hud: { timer: true },
  color: '#e9a15a',
  build: buildCanyon,
  start,
};
