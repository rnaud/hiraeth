// The Elder's flight's rules (src/minigames/elderflight.js; docs/design/helper-guardians.md, issue #339): the Elder flies
// a route across the open sky of Vael, from the Aerie's crown to the riders' Old Roost, and you fly as her wingman. Pure
// (tests/minigames-helpers.test.js): three.js vectors, no scene.
//
//   makeRoute(points?) → the route: samples every metre, its gates, its gusts
//   routeAt(R, s, out) → { pos, fwd, right, yaw, bank } where she is s m along it
//   newFlight(R) / herStep(F, R, dt) / wingStep(W, inp, dt, env) / flightStep(F, R, W, p0, dt) → [events]
//   slotAt(F, R, out) → where her wingman's slot is (her wingtip's side, a little back)
//   wakeAt(F, R, p) → 0..1, how much of her wake holds you there
//
// Her slot moves to the side the next gate is on: after a gate she calls it ('call'); your ring of each gate is on that
// side of hers. Her courage falls while you are far from her, and with every gate missed and every stone hit; out of it,
// she turns back.

import * as THREE from 'three';

export const FORMATION = {
  her: { speed: 17, slow: 11.5, far: 16, ease: 0.8 },     // m/s; slower when you are more than `far` m from your slot
  wing: {
    glide: 15, min: 8, max: 30,               // m/s: the speed it settles to alone, its bounds
    beat: 6, brake: 7, drag: 0.32, g: 7,      // m/s² beating, spread wide, 1/s back to the glide, m/s² along a climb or dive
    sink: 1.3,                                // m/s alone (her wake holds it off)
    pitchMax: 0.5, pitchRate: 3,              // rad, 1/s
    bank: 0.85, bankRate: 3.5, turn: 1.05,    // rad; 1/s; rad/s at full bank
  },
  slot: { side: 12, back: 5, r: 5, near: 9 },
  wake: { along: [-22, 3], lat: [5, 19], up: 6, draw: 1.8 },   // where it holds you (m, her frame); 1/s to her pace
  gate: { R: 8.5, r: 4.6, pillar: 23, together: 0.8, lost: 45 },         // her ring, yours; the pillars' offset; m past it a gate is lost
  courage: { drain: 0.075, refill: 0.05, miss: 0.18, bump: 0.15, cloud: 0.2 },
  mult: { every: 3, max: 5, grace: 1 },
  points: { harmony: 10, gate: 100, together: 50, landing: 300, courage: 500 },
  cloud: -12, ceiling: 240, body: 0.9,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UP = new THREE.Vector3(0, 1, 0);

/** The route's turning points (x, y, z): from over the Aerie's crown, north across the sky stones, to the Old Roost. */
export const ROUTE_POINTS = [
  [0, 74, 0], [26, 72, 110], [-14, 64, 240], [-78, 58, 370], [-66, 68, 510], [8, 82, 630], [92, 92, 750],
  [126, 80, 890], [70, 66, 1010], [-24, 58, 1130], [-92, 66, 1260], [-70, 84, 1390], [2, 98, 1510], [70, 90, 1640],
  [86, 76, 1770], [44, 66, 1890], [0, 60, 2000], [-6, 58, 2040],
];
/** The gates: m along the route, and which side of her yours is (1 her right, -1 her left). */
export const GATE_SIDES = [1, 1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, -1];
/** The gusts: m along the route where a crosswind blows (m/s across: > 0 to her right). */
export const GUSTS = [{ s0: 560, s1: 700, w: 7 }, { s0: 1180, s1: 1320, w: -7 }, { s0: 1680, s1: 1800, w: 6 }];

/**
 * The route: a smooth curve through the points, sampled every metre (pos, fwd: the way along it, level), its length,
 * the gates (each `s` m along, its side, the centres of her ring and yours, the way through) and the gusts.
 */
export function makeRoute(points = ROUTE_POINTS, K = FORMATION) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const length = curve.getLength(), n = Math.ceil(length);
  const pts = curve.getSpacedPoints(n);
  const R = { length, step: length / n, pos: pts, yaw: [], gates: [], gusts: GUSTS.map((g) => ({ ...g })) };
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n, i + 2)];
    R.yaw.push(Math.atan2(b.x - a.x, b.z - a.z));
  }
  // the turn rate along it (rad/m), for her bank
  R.curv = R.yaw.map((y, i) => { const a = R.yaw[Math.max(0, i - 6)], b = R.yaw[Math.min(n, i + 6)]; return Math.atan2(Math.sin(b - a), Math.cos(b - a)) / (Math.min(n, i + 6) - Math.max(0, i - 6)) / R.step; });
  const first = 150, last = length - 160, gap = (last - first) / (GATE_SIDES.length - 1);
  GATE_SIDES.forEach((side, k) => {
    const s = first + k * gap, at = routeAt(R, s);
    const hers = at.pos.clone(), yours = at.pos.clone().addScaledVector(at.right, side * K.slot.side).addScaledVector(at.fwd, -K.slot.back * 0);
    R.gates.push({ k, s, side, hers, yours, n: at.fwd.clone(), right: at.right.clone() });
  });
  return R;
}

/** Where she is s m along the route: { pos, fwd (level), right, yaw, curv }. */
export function routeAt(R, s, out = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), yaw: 0, curv: 0, climb: 0 }) {
  const u = clamp(s / R.step, 0, R.pos.length - 1), i = Math.min(Math.floor(u), R.pos.length - 2), f = u - i;
  out.pos.lerpVectors(R.pos[i], R.pos[i + 1], f);
  const ya = R.yaw[i], yb = R.yaw[i + 1];
  out.yaw = ya + Math.atan2(Math.sin(yb - ya), Math.cos(yb - ya)) * f;
  out.fwd.set(Math.sin(out.yaw), 0, Math.cos(out.yaw));
  out.right.crossVectors(out.fwd, UP).normalize();
  out.curv = R.curv[i] + (R.curv[i + 1] - R.curv[i]) * f;
  out.climb = (R.pos[i + 1].y - R.pos[i].y) / R.step;
  return out;
}

// ------------------------------------------------------------------ her, your wings
export function newFlight(R, K = FORMATION) {
  const at = routeAt(R, 0);
  return {
    s: 0, v: K.her.speed, her: at, side: R.gates[0]?.side ?? 1, gate: 0, t: 0,
    courage: 1, held: 0, out: 0, mult: 1, harmony: 0, gatePts: 0, together: 0, passed: 0, missed: 0, bumps: 0, clouds: 0,
    herAt: [], done: false, turned: false, bank: 0,
  };
}

/** Her frame: she flies on along the route, slower while you are far from her slot (she waits for you). */
export function herStep(F, R, dt, far = false, K = FORMATION) {
  const want = far ? K.her.slow : K.her.speed - 3 * clamp(F.her.climb * 4, -1, 1);
  F.v += (want - F.v) * (1 - Math.exp(-K.her.ease * dt));
  F.s = Math.min(R.length, F.s + F.v * dt);
  routeAt(R, F.s, F.her);
  // her bank: into the turn as the turn's rate asks at her speed (a little ahead: she leans before it comes)
  const ahead = routeAt(R, Math.min(R.length, F.s + 10));
  const want2 = clamp(Math.atan2(F.v * F.v * ahead.curv, 9.8), -0.7, 0.7);
  F.bank += (want2 - F.bank) * (1 - Math.exp(-3 * dt));
}

/** Her wingman's slot: on her `side`, slot.side m out, slot.back m back. */
export function slotAt(F, R, out = new THREE.Vector3(), K = FORMATION) {
  return out.copy(F.her.pos).addScaledVector(F.her.right, F.side * K.slot.side).addScaledVector(F.her.fwd, -K.slot.back);
}

const _d = new THREE.Vector3();
/** How much of her wake holds you at p (0..1): behind and beside her, off either wingtip, about her height. */
export function wakeAt(F, R, p, K = FORMATION) {
  _d.subVectors(p, F.her.pos);
  const along = _d.dot(F.her.fwd), lat = Math.abs(_d.dot(F.her.right)), up = Math.abs(_d.y);
  const W = K.wake;
  if (along < W.along[0] || along > W.along[1] || lat < W.lat[0] - 2 || lat > W.lat[1] + 2 || up > W.up) return 0;
  const a = smooth(W.along[0], -K.slot.back - 3, along) * (1 - smooth(-1, W.along[1], along));
  const l = smooth(W.lat[0] - 2, W.lat[0] + 2, lat) * (1 - smooth(W.lat[1] - 3, W.lat[1] + 2, lat));
  return a * l * (1 - smooth(W.up * 0.5, W.up, up));
}

export function newWings(pos, yaw, speed = FORMATION.wing.glide) {
  return { pos: pos.clone(), yaw, pitch: 0, bank: 0, turn: 0, v: speed, vel: new THREE.Vector3(), beat: 0, wake: 0, blink: 0 };
}

/**
 * Your wings for a frame (W changed): inp { x (bank: > 0 right), y (> 0 forward: dive), beat (A / × held), brake
 * (LT / L2 held) }; env { wake (0..1), herSpeed, wind ({ x, z } m/s) }.
 */
export function wingStep(W, inp, dt, { wake = 0, herSpeed = 17, wind = null } = {}, K = FORMATION.wing) {
  const steer = clamp(inp.x ?? 0, -1, 1), pitch = clamp(inp.y ?? 0, -1, 1);
  W.bank += (steer * K.bank - W.bank) * (1 - Math.exp(-K.bankRate * dt));
  W.turn = -(W.bank / K.bank) * K.turn;
  W.yaw += W.turn * dt;
  W.pitch += (-pitch * K.pitchMax - W.pitch) * (1 - Math.exp(-K.pitchRate * dt));
  W.beat = inp.beat ? 1 : 0;
  let a = W.beat * K.beat - (inp.brake ?? 0) * K.brake - K.g * Math.sin(W.pitch) - K.drag * (W.v - K.glide);
  a += (herSpeed - W.v) * FORMATION.wake.draw * wake;   // (her wake draws you to her pace)
  W.v = clamp(W.v + a * dt, K.min, K.max);
  W.wake = wake;
  const c = Math.cos(W.pitch);
  W.vel.set(Math.sin(W.yaw) * c * W.v, Math.sin(W.pitch) * W.v - K.sink * (1 - wake), Math.cos(W.yaw) * c * W.v);
  if (wind) { W.vel.x += wind.x; W.vel.z += wind.z; }
  W.pos.addScaledVector(W.vel, dt);
  if (W.blink > 0) W.blink -= dt;
}

/** The stones as columns: [{ x, z, r, y0, y1 }]; the one p is inside (with the body's reach), or null. */
export function hitAt(stones, p, reach = FORMATION.body) {
  for (const c of stones) {
    if (p.y < c.y0 - reach || p.y > c.y1 + reach) continue;
    const dx = p.x - c.x, dz = p.z - c.z;
    if (dx * dx + dz * dz < (c.r + reach) ** 2) return c;
  }
  return null;
}

/** Through a ring's plane between p0 and p1: 'pass' (within r), 'miss' (crossed outside, within 3 r), or null. */
export function crossGate(c, n, r, p0, p1) {
  const d0 = _d.subVectors(p0, c).dot(n), d1 = new THREE.Vector3().subVectors(p1, c).dot(n);
  if (d0 > 0 || d1 <= 0) return null;
  const k = d0 / (d0 - d1);
  const x = new THREE.Vector3().lerpVectors(p0, p1, k).sub(c);
  const off = x.length();
  return off <= r ? 'pass' : off <= r * 3 ? 'miss' : null;
}

/** The gust you are in (a wind { x, z }), from the route's s nearest you (her s is close enough), or null. */
export function gustAt(R, F, out = { x: 0, z: 0 }) {
  const g = R.gusts.find((q) => F.s >= q.s0 && F.s <= q.s1);
  if (!g) return null;
  const k = smooth(g.s0, g.s0 + 25, F.s) * (1 - smooth(g.s1 - 25, g.s1, F.s));
  out.x = F.her.right.x * g.w * k; out.z = F.her.right.z * g.w * k;
  return out;
}

/**
 * The formation's frame, after both have moved (F changed): the slot held (harmony, the multiplier), the gates (yours
 * passed or missed, together with her or not; a gate she is well past is lost), her courage, the stones, the cloud, the
 * end. p0: where you were. Events: slot { in }, gate { k, together, pts }, miss { k }, call { side }, bump, cloud,
 * turnback, arrive.
 */
export function flightStep(F, R, W, p0, dt, { stones = [] } = {}, K = FORMATION) {
  const ev = [];
  if (F.done) return ev;
  F.t += dt;
  const slot = slotAt(F, R, new THREE.Vector3());
  const d = W.pos.distanceTo(slot);
  const inSlot = d < K.slot.r;
  // the slot: held, the multiplier climbs a step every `every` s; out of it more than `grace` s, it falls back to 1
  if (inSlot) {
    if (F.out > 0.4) ev.push({ kind: 'slot', in: true });
    F.out = 0; F.held += dt;
    const m = Math.min(K.mult.max, 1 + Math.floor(F.held / K.mult.every));
    if (m > F.mult) ev.push({ kind: 'mult', mult: m });
    F.mult = m;
    F.harmony += K.points.harmony * F.mult * dt;
    F.courage = Math.min(1, F.courage + K.courage.refill * dt);
  } else {
    F.out += dt;
    if (F.out > K.mult.grace && F.held > 0) { F.held = 0; if (F.mult > 1) ev.push({ kind: 'slot', in: false }); F.mult = 1; }
  }
  if (W.pos.distanceTo(F.her.pos) > K.her.far + K.slot.side) F.courage -= K.courage.drain * dt;
  // the gates: yours passed (with her or not), or missed; one she is well past without you, lost
  const G = R.gates[F.gate];
  if (G) {
    if (F.herAt[G.k] == null && F.s >= G.s) F.herAt[G.k] = F.t;
    const r = crossGate(G.yours, G.n, K.gate.r, p0, W.pos);
    const lost = F.s > G.s + K.gate.lost;
    if (r === 'pass') {
      const together = F.herAt[G.k] != null ? F.t - F.herAt[G.k] < K.gate.together : G.s - F.s < K.gate.together * F.v;
      const pts = K.points.gate * F.mult + (together ? K.points.together : 0);
      F.gatePts += pts; F.passed++; if (together) F.together++;
      ev.push({ kind: 'gate', k: G.k, together, pts });
      F.gate++;
    } else if (r === 'miss' || lost) {
      F.missed++; F.courage -= K.courage.miss; F.held = 0; F.mult = 1;
      ev.push({ kind: 'miss', k: G.k });
      F.gate++;
    }
    if (F.gate > G.k) {
      const next = R.gates[F.gate];
      if (next && next.side !== F.side) { F.side = next.side; ev.push({ kind: 'call', side: next.side }); }
    }
  }
  // the stones, the cloud below, the sky's ceiling
  const hit = hitAt(stones, W.pos);
  if (hit && W.blink <= 0) {
    _d.set(W.pos.x - hit.x, 0, W.pos.z - hit.z);
    const l = _d.length() || 1;
    W.pos.x = hit.x + (_d.x / l) * (hit.r + K.body + 0.5); W.pos.z = hit.z + (_d.z / l) * (hit.r + K.body + 0.5);
    W.v = Math.max(FORMATION.wing.min, W.v * 0.6); W.blink = 1.2;
    F.courage -= K.courage.bump; F.bumps++; F.held = 0; F.mult = 1;
    ev.push({ kind: 'bump' });
  }
  if (W.pos.y < K.cloud) {
    W.pos.copy(slot); W.yaw = F.her.yaw; W.pitch = 0; W.v = F.v; W.blink = 1.5;
    F.courage -= K.courage.cloud; F.clouds++; F.held = 0; F.mult = 1;
    ev.push({ kind: 'cloud' });
  }
  if (W.pos.y > K.ceiling) W.pos.y = K.ceiling;
  F.courage = clamp(F.courage, 0, 1);
  if (F.courage <= 0) { F.done = true; F.turned = true; ev.push({ kind: 'turnback' }); }
  else if (F.s >= R.length - 0.5) { F.done = true; ev.push({ kind: 'arrive' }); }
  return ev;
}

/**
 * The sky stones round the route, as columns for the collision ({ kind: 'table' | 'needle', x, z, r, y0, y1, top, R,
 * H }): a pair of tall needles flanking every gate (`pillar` m either side of her ring), and tables and needles
 * scattered off the route (never within `clear` m of it, so the slot on either side is always open sky).
 */
export function skyStones(R, seed = 7, { clear = 34, n = 70 } = {}, K = FORMATION) {
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [];
  for (const G of R.gates) for (const s of [-1, 1]) {
    const c = G.hers.clone().addScaledVector(G.right, s * K.gate.pillar);
    const H = c.y + 26 + rand() * 14, r = 3.2 + rand() * 1.2;
    out.push({ kind: 'needle', gate: G.k, x: c.x, z: c.z, r, y0: -50, y1: H, H, R: r });
  }
  const near = (x, z, d) => { for (let i = 0; i < R.pos.length; i += 6) { const p = R.pos[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < d * d) return true; } return false; };
  for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
    const s = rand() * R.length, at = routeAt(R, s), side = rand() < 0.5 ? -1 : 1;
    const off = clear + 8 + rand() * 260, x = at.pos.x + at.right.x * side * off, z = at.pos.z + at.right.z * side * off;
    const table = rand() < 0.45, Rr = table ? 14 + rand() * 26 : 3 + rand() * 6;
    if (near(x, z, clear + Rr)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < o.R + Rr + 6)) continue;
    const top = table ? 20 + rand() * 70 : 50 + rand() * 120;
    out.push(table ? { kind: 'table', x, z, R: Rr, r: Rr, y0: top - Rr * 0.45, y1: top, top, stalk: Rr * 0.32 } : { kind: 'needle', x, z, r: Rr, R: Rr, y0: -50, y1: top, H: top });
    if (table) out.push({ kind: 'stalk', x, z, r: Rr * 0.32, R: Rr * 0.32, y0: -50, y1: top - Rr * 0.45 });
    i++;
  }
  return out;
}

/** Persistent recovery guidance in her frame; it never steers or grants a gate. */
export function flightGuide(F, R, W) {
  const target = slotAt(F, R, new THREE.Vector3()), delta = target.sub(W.pos);
  if (delta.length() <= FORMATION.slot.r) return 'In her wake · courage recovers';
  if (Math.abs(delta.y) > 4) return delta.y > 0 ? 'Pull back to climb toward her wing' : 'Push forward to descend toward her wing';
  const side = delta.dot(F.her.right), along = delta.dot(F.her.fwd);
  if (Math.abs(side) > 6) return side > 0 ? 'Bank right toward the gold circle' : 'Bank left toward the gold circle';
  if (along > 5) return 'Hold A / × to catch up';
  if (along < -5) return 'Hold LT / L2 to slow beside her';
  return F.side > 0 ? 'Stay at her right wing · follow the gold circle' : 'Stay at her left wing · follow the gold circle';
}

/** The flight's points, line by line. */
export function flightScore(F, K = FORMATION) {
  const harmony = Math.round(F.harmony), gates = F.gatePts;
  const landing = F.turned ? 0 : K.points.landing, courage = F.turned ? 0 : Math.round(F.courage * K.points.courage);
  return { harmony, gates, landing, courage, total: harmony + gates + landing + courage };
}

/**
 * A wingman for the tests and the pictures: flies at the slot ahead of where it will be, beats when behind, spreads
 * when ahead, climbs and dives to its height. Returns the input for wingStep.
 */
export function botInput(F, R, W, K = FORMATION) {
  const slot = slotAt(F, R, new THREE.Vector3());
  const ahead = routeAt(R, Math.min(R.length, F.s + 12));
  const to = new THREE.Vector3().subVectors(slot, W.pos);
  const lat = to.dot(F.her.right), along = to.dot(F.her.fwd);
  // the way she will be going, turned toward the slot's side by how far off it you are (to the right: the yaw falls)
  // (crabbed into a gust: the wind across, over the speed, taken off the way)
  const g = gustAt(R, F), cross = g ? (g.x * F.her.right.x + g.z * F.her.right.z) / Math.max(8, W.v) : 0;
  const want = ahead.yaw - Math.atan(clamp(lat * 0.09 - cross, -1.2, 1.2));
  const turn = Math.atan2(Math.sin(want - W.yaw), Math.cos(want - W.yaw));
  const x = clamp(-turn * 2.6, -1, 1);
  const y = clamp(-to.y * 0.12, -1, 1);
  return { x, y, beat: along > 1 || W.v < F.v - 1.5, brake: along < -1.5 && W.v > F.v - 0.5 ? 1 : 0 };
}
