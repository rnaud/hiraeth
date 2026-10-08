// Ring race (docs/systems/minigames.md): the jets, race-tuned, through twenty brass hoops strung among
// the sandstone needles of the Needle Field, against the clock. The flight is the jets' own (src/player.js
// jetSteer / jetNose / jetStep / jetDroop: RT / R2 the throttle, the stick the nose), on a body of the
// game's own (flyStep: pure, tests/rings.test.js) with a tank that each ring tops up. A ring missed costs
// 5 s, a crash into a needle or the sand 3 s (you start again at the last ring). The best run flies with
// you as a ghost, and each ring tells you how far ahead or behind it you are.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { JET, jetNose, jetSteer, jetStep, jetDroop } from '../player.js';
import { arenaLevel } from './kit/world.js';
import { lendItems } from './kit/gear.js';
import { Dots } from '../fluid-tool.js';

// ------------------------------------------------------------------ the course
export const RACE = {
  ringR: 6.5,            // m, the hoop's opening (radius)
  missFar: 6,            // a crossing of a ring's plane within this many radii of it, outside it: missed
  penaltyMiss: 5,        // s a ring missed
  penaltyCrash: 3,       // s a crash
  burn: 0.09,            // of the tank a second at full throttle (JET.idle of it at a light squeeze)
  topUp: 0.28,           // of the tank a ring gives back
  respawnFuel: 0.4,      // at least this much after a crash (the race can always be finished)
  boost: true,           // race-tuned: the jets' boosted speed all the way (JET.speed × JET.boost)
  gravity: 32,
  body: 0.7,             // m, the traveller's reach for a crash
};

/** The pad on top of the start mesa, and the twenty rings after it (hand-placed: a slalom down the field, a climb, a dive, the long way home). */
export const PAD = { x: 0, y: 50, z: 420, r: 11 };
export const RING_POINTS = [
  [0, 58, 340], [-30, 50, 260], [25, 42, 185], [-20, 34, 110], [10, 22, 40],
  [60, 40, -30], [120, 70, -80], [190, 100, -60], [240, 110, 10], [260, 85, 90],
  [235, 55, 170], [265, 30, 245], [240, 45, 320], [205, 75, 380], [150, 110, 420],
  [100, 85, 480], [40, 55, 520], [-30, 45, 520], [-60, 58, 470], [-20, 70, 420],
];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The rings: { i, c (centre), n (the way through, unit), R, last }. */
export function courseRings(points = RING_POINTS, R = RACE.ringR) {
  const pts = [V(PAD.x, PAD.y + 4, PAD.z), ...points.map((p) => V(...p))];
  const rings = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[Math.min(i + 1, pts.length - 1)];
    const n = b.clone().sub(a);
    if (i === pts.length - 1) n.copy(pts[i]).sub(pts[i - 1]);
    rings.push({ i: i - 1, c: pts[i].clone(), n: n.normalize(), R, last: i === pts.length - 1 });
  }
  return rings;
}

/** The dunes of the field's floor (gentle: the needles are the show). */
export function fieldHeight(x, z) {
  return 3 + 3 * Math.sin(x / 70) * Math.cos(z / 55) + 2 * Math.sin((x + z) / 37) + 1.2 * Math.sin(x / 13 - z / 17);
}

// a small seeded random (the field is the same every time)
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The flight line the rings make (the pad, then each ring's centre), sampled every `step` m: [{ x, y, z, seg }]. */
export function courseLine(rings, step = 5) {
  const pts = [V(PAD.x, PAD.y + 4, PAD.z), ...rings.map((r) => r.c)];
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 0; k < n; k++) { const t = k / n; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, seg: i - 1 }); }
  }
  return out;
}

/** How close a column of radius r at (x, z), standing up to `top`, comes to the line (the horizontal gap; a column well under the line does not count). */
function clearance(line, x, z, r, top, skip = null) {
  let best = Infinity;
  for (const p of line) {
    if (skip && skip(p)) continue;
    if (top < p.y - 16) continue;
    best = Math.min(best, Math.hypot(p.x - x, p.z - z) - r);
  }
  return best;
}

/**
 * The needles: tapered columns of sandstone (some with a hoodoo's cap), a pair flanking some of the
 * rings, the rest scattered over the field clear of the flight line. Each is collision cones:
 * { x, z, y0, y1, r0, r1, cap? }. Also the start mesa and the floating rocks ({ c, r }).
 */
export function courseField(rings, seed = 7) {
  const rand = rng(seed), line = courseLine(rings);
  const needles = [];
  const ground = (x, z) => fieldHeight(x, z);
  const add = (x, z, r0, r1, top, cap) => {
    const y0 = ground(x, z) - 3;
    const n = { x, z, y0, y1: top, r0, r1 };
    needles.push(n);
    if (cap) needles.push({ x, z, y0: top - 1, y1: top + 4.5, r0: r1 * 2.1, r1: r1 * 1.8, cap: true });
  };
  // the start mesa
  needles.push({ x: PAD.x, z: PAD.z, y0: ground(PAD.x, PAD.z) - 3, y1: PAD.y, r0: PAD.r * 1.9, r1: PAD.r, mesa: true });
  // the flankers: a needle each side of some rings, the hoop threaded between them
  for (const i of [1, 2, 3, 4, 10, 11, 12, 17, 18]) {
    const g = rings[i], side = V(g.n.z, 0, -g.n.x).normalize();
    for (const s of [-1, 1]) {
      const r1 = 3 + rand() * 1.5, gap = g.R + 5 + r1 + 2 + rand() * 4;
      const x = g.c.x + side.x * s * gap, z = g.c.z + side.z * s * gap;
      const near = clearance(line, x, z, r1 + 2, Infinity, (p) => Math.abs(p.seg - i) <= 1);
      if (near < 12) continue;
      add(x, z, r1 + 2.5 + rand() * 2, r1, g.c.y + 25 + rand() * 45, rand() < 0.3);
    }
  }
  // the field: as many as fit, clear of the line, taller near it
  for (let tries = 0; tries < 900 && needles.length < 110; tries++) {
    const x = -340 + rand() * 860, z = -300 + rand() * 1060;
    const r0 = 5 + rand() * 12, r1 = r0 * (0.3 + rand() * 0.35);
    const top = ground(x, z) + 30 + rand() * (rand() < 0.4 ? 150 : 80);
    if (Math.hypot(x - PAD.x, z - PAD.z) < PAD.r * 2 + r0 + 10) continue;
    const c = clearance(line, x, z, r0, top);
    if (c < 14) continue;
    if (needles.some((n) => !n.cap && Math.hypot(n.x - x, n.z - z) < n.r0 + r0 + 4)) continue;
    add(x, z, r0, r1, top, rand() < 0.22);
  }
  // the floating rocks: a few boulders hanging in the air near the high part of the course
  const rocks = [];
  for (let tries = 0; tries < 400 && rocks.length < 7; tries++) {
    const g = rings[5 + Math.floor(rand() * 11)];
    const c = V(g.c.x + (rand() - 0.5) * 120, g.c.y + (rand() - 0.3) * 50, g.c.z + (rand() - 0.5) * 120);
    const r = 6 + rand() * 9;
    if (c.y - r < ground(c.x, c.z) + 15) continue;
    if (line.some((p) => Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) < r + 16)) continue;
    if (rocks.some((o) => o.c.distanceTo(c) < o.r + r + 10)) continue;
    if (needles.some((n) => Math.hypot(n.x - c.x, n.z - c.z) < n.r0 + r + 4 && c.y - r < n.y1 + 4)) continue;
    rocks.push({ c, r });
  }
  return { needles, rocks };
}

/** Is a point inside a needle, a rock or the sand (with the body's reach)? 'ground' | 'needle' | 'rock' | null */
export function hitAt(p, field, ground = fieldHeight, reach = RACE.body) {
  if (p.y < ground(p.x, p.z) + reach) return 'ground';
  for (const n of field.needles) {
    if (p.y < n.y0 || p.y > n.y1 + reach) continue;
    const t = Math.min(1, Math.max(0, (p.y - n.y0) / (n.y1 - n.y0)));
    const r = n.r0 + (n.r1 - n.r0) * t;
    if (Math.hypot(p.x - n.x, p.z - n.z) < r + reach) return 'needle';
  }
  for (const o of field.rocks) if (p.distanceTo(o.c) < o.r + reach) return 'rock';
  return null;
}

/** Did a flight from p0 to p1 go through the ring's plane (the right way)? 'pass' | 'miss' | null (not near it). */
export function crossRing(g, p0, p1) {
  const s0 = (p0.x - g.c.x) * g.n.x + (p0.y - g.c.y) * g.n.y + (p0.z - g.c.z) * g.n.z;
  const s1 = (p1.x - g.c.x) * g.n.x + (p1.y - g.c.y) * g.n.y + (p1.z - g.c.z) * g.n.z;
  if (!(s0 < 0 && s1 >= 0)) return null;
  const t = s0 / (s0 - s1);
  const d = Math.hypot(p0.x + (p1.x - p0.x) * t - g.c.x, p0.y + (p1.y - p0.y) * t - g.c.y, p0.z + (p1.z - p0.z) * t - g.c.z);
  return d <= g.R ? 'pass' : d <= g.R * RACE.missFar ? 'miss' : null;
}

/** The race's progress: the next ring, the rings passed and missed. */
export const newRace = (n = RING_POINTS.length) => ({ n, next: 0, passed: 0, missed: 0, state: Array(n).fill(null), done: false });

/**
 * A frame of the race (R changed): the next ring through or by, or one of the two after it went
 * through (those skipped are missed). Returns [{ kind: 'pass' | 'miss', i }], in order.
 */
export function raceStep(R, rings, p0, p1) {
  const ev = [];
  if (R.done) return ev;
  for (let k = R.next; k < Math.min(R.next + 3, R.n); k++) {
    const r = crossRing(rings[k], p0, p1);
    if (!r || (k > R.next && r !== 'pass')) continue;
    for (let j = R.next; j < k; j++) { R.state[j] = 'miss'; R.missed++; ev.push({ kind: 'miss', i: j }); }
    R.state[k] = r;
    if (r === 'pass') R.passed++; else R.missed++;
    ev.push({ kind: r, i: k });
    R.next = k + 1;
    break;
  }
  if (R.next >= R.n) R.done = true;
  return ev;
}

// ------------------------------------------------------------------ the flyer (pure)
const UP = V(0, 1, 0);
const dirOf = (h, out = V()) => out.set(Math.sin(h), 0, Math.cos(h));
const _fw = V(), _nose = V();

/** The traveller on the pad (standing; the first squeeze lifts off), or flying from a ring. */
export function newFlyer(pos, heading, { pad = true, along = 0, pitch = 0, fuel = 1 } = {}) {
  const F = { pos: pos.clone(), vel: V(), heading, pitch, bank: 0, along, fuel, pad, T: 0, burn: 0 };
  if (!pad) F.vel.copy(jetNose(dirOf(heading, _fw), UP, pitch, _nose)).multiplyScalar(along);
  return F;
}

/**
 * A frame of the race-tuned jets (F changed): inp { x (bank, > 0 right), y (> 0 the nose down),
 * throttle (0..1) }. The jets' own model (src/player.js): the stick flies the nose, the throttle
 * drives along it, unpowered a glide; the tank burns while you thrust, dry you glide.
 */
export function flyStep(F, inp, dt, K = RACE) {
  const want = Math.min(1, Math.max(0, inp.throttle ?? 0));
  const T = F.fuel > 0 ? want : 0;
  if (F.pad) {
    F.T = 0; F.burn = 0;
    if (T <= 0) return;
    // the lift-off: up and forward off the mesa, the nose raised
    F.pad = false; F.pitch = 0.55;
    F.vel.copy(dirOf(F.heading, _fw)).multiplyScalar(6).addScaledVector(UP, JET.lift);
  }
  F.burn = T > 0 ? JET.idle + (1 - JET.idle) * T : 0;
  F.fuel = Math.max(0, F.fuel - K.burn * F.burn * dt);
  F.T = T;
  F.heading += jetSteer(F, inp.y ?? 0, inp.x ?? 0, dt);
  const nose = jetNose(dirOf(F.heading, _fw), UP, F.pitch, _nose);
  F.along = jetStep(F.vel, nose, UP, T, dt, { boost: K.boost, gravity: K.gravity });
  if (!T) F.pitch = jetDroop(F.pitch, F.vel, UP, dt, F.along);
  F.pos.addScaledVector(F.vel, dt);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/** A pilot that flies the course (the tests', and the screenshots'): full throttle, the nose at the next ring, lined up with its way through. */
export function botInput(F, rings, R) {
  const g = rings[Math.min(R.next, rings.length - 1)];
  const d = F.pos.distanceTo(g.c);
  const aim = g.c.clone().addScaledVector(g.n, -Math.min(d * 0.45, 30));   // (come in along its way through)
  const to = aim.sub(F.pos);
  const wantH = Math.atan2(to.x, to.z), wantP = Math.atan2(to.y, Math.hypot(to.x, to.z));
  const eh = wrap(wantH - F.heading), ep = wantP - F.pitch;
  return { x: clamp1(-eh * 3), y: clamp1(-ep * 3), throttle: 1 };
}

// ------------------------------------------------------------------ the ghost (your best run, kept on this device)
export const GHOST = { every: 0.1, key: 'moebius.minigame.rings.ghost' };

/** A run's track packed small: positions every GHOST.every s, to a tenth of a metre, and the ring splits. */
export function packGhost(time, track, splits) {
  return JSON.stringify({ v: 1, time: +time.toFixed(2), every: GHOST.every, pts: track.map((v) => Math.round(v * 10)), splits: splits.map((s) => +s.toFixed(2)) });
}
export function unpackGhost(text) {
  try {
    const g = JSON.parse(text);
    if (g?.v !== 1 || !Array.isArray(g.pts) || g.pts.length < 6) return null;
    return { time: g.time, every: g.every, pts: Float32Array.from(g.pts, (v) => v / 10), splits: g.splits ?? [] };
  } catch { return null; }
}
/** Where the ghost was t s into its run (null past its end). */
export function ghostAt(g, t, out = V()) {
  const n = g.pts.length / 3, f = t / g.every, i = Math.floor(f);
  if (i < 0 || i >= n - 1) return null;
  const k = f - i, a = i * 3, b = a + 3;
  return out.set(g.pts[a] + (g.pts[b] - g.pts[a]) * k, g.pts[a + 1] + (g.pts[b + 1] - g.pts[a + 1]) * k, g.pts[a + 2] + (g.pts[b + 2] - g.pts[a + 2]) * k);
}
function loadGhost() { try { return unpackGhost(localStorage.getItem(GHOST.key)); } catch { return null; } }
function saveGhost(text) { try { localStorage.setItem(GHOST.key, text); } catch { /* full or private: no ghost */ } }

// ------------------------------------------------------------------ the field, built
const INK = '#2b211f';
const tag = (m) => { m.userData.noCollide = true; return m; };

/** A needle's mesh: a tapered column of beds, each bed a little in or out (the strata's ledges), leaning a touch. */
function needleGeometry(n, rand) {
  const h = n.y1 - n.y0, sides = 8 + Math.floor(rand() * 4), rows = Math.max(4, Math.round(h / 7));
  const g = new THREE.CylinderGeometry(n.r1, n.r0, h, sides, rows, false);
  const p = g.attributes.position, ph = rand() * 10, lean = (rand() - 0.5) * 0.06, leanA = rand() * 6.28;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = (y + h / 2) / h;
    const ledge = 1 + 0.07 * Math.sin(y * 0.55 + ph) + 0.05 * Math.sin(y * 1.7 + ph * 2) + (Math.floor(y / 6 + ph) % 2 ? 0.03 : -0.02);
    const wob = 1 + 0.06 * Math.sin(Math.atan2(z, x) * 3 + ph + y * 0.1);
    p.setXYZ(i, x * ledge * wob + Math.cos(leanA) * lean * u * h, y, z * ledge * wob + Math.sin(leanA) * lean * u * h);
  }
  g.translate(n.x, n.y0 + h / 2, n.z);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function rockGeometry(o, rand) {
  const g = new THREE.IcosahedronGeometry(o.r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + 0.18 * Math.sin(v.x * 0.7 + v.z * 0.4) + (v.y < 0 ? 0.25 * (-v.y / o.r) : -0.15 * (v.y / o.r));   // (flat on top, a hanging keel below)
    v.multiplyScalar(k);
    if (v.y < 0) v.y *= 1.5;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(o.c.x, o.c.y, o.c.z);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** A hoop: the brass ring, ink bands round it, four little fins (the makers' style), facing along n. */
function ringModel(g, mats) {
  const grp = new THREE.Group();
  const hoop = tag(new THREE.Mesh(new THREE.TorusGeometry(g.R, 0.42, 8, 44), mats.brass));
  grp.add(hoop);
  const bands = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    bands.push(new THREE.TorusGeometry(0.5, 0.09, 4, 10).rotateY(Math.PI / 2).rotateZ(a + Math.PI / 2).translate(Math.cos(a) * g.R, Math.sin(a) * g.R, 0).toNonIndexed());
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    bands.push(new THREE.ConeGeometry(0.32, 1.5, 4).rotateZ(a - Math.PI / 2).translate(Math.cos(a) * (g.R + 0.95), Math.sin(a) * (g.R + 0.95), 0).toNonIndexed());
  }
  grp.add(tag(new THREE.Mesh(mergeGeometries(bands), mats.ink)));
  if (g.last) {   // the finish: a chequer of ink and cream round the inside
    const cheq = [];
    for (let k = 0; k < 24; k += 2) {
      const a0 = (k / 24) * Math.PI * 2;
      cheq.push(new THREE.TorusGeometry(g.R - 0.55, 0.2, 4, 3, Math.PI * 2 / 24).rotateZ(a0).toNonIndexed());
    }
    grp.add(tag(new THREE.Mesh(mergeGeometries(cheq), mats.ink)));
  }
  grp.position.copy(g.c);
  grp.lookAt(g.c.clone().add(g.n));
  grp.userData.hoop = hoop;
  return grp;
}

function* buildRings(scene) {
  const terrain = yield* Terrain.make({
    size: 1800, seg: 360, height: fieldHeight,
    material: { color: '#eec79a', color2: '#f3d9b4', color3: '#d9a27a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
  });
  scene.add(terrain.mesh);
  yield;
  const rings = courseRings();
  const field = courseField(rings);
  const rand = rng(11);
  const rock = makeMaterial({ color: '#d98b5f', color2: '#c4714a', color3: '#9d5338', mode: MODE_STRATA, strataSize: 5, strataHatch: 0.6, cracks: 0.5 });
  const pale = makeMaterial({ color: '#e7b48a', color2: '#d79a70', color3: '#b77a55', mode: MODE_STRATA, strataSize: 4, strataHatch: 0.5, cracks: 0.4 });
  const geos = [[], []];
  field.needles.forEach((n, i) => { if (!n.mesa) geos[n.cap ? 1 : i % 3 === 0 ? 1 : 0].push(needleGeometry(n, rand)); });
  scene.add(tag(new THREE.Mesh(mergeGeometries(geos[0]), rock)));
  scene.add(tag(new THREE.Mesh(mergeGeometries(geos[1]), pale)));
  yield;
  if (field.rocks.length) scene.add(tag(new THREE.Mesh(mergeGeometries(field.rocks.map((o) => rockGeometry(o, rand))), rock)));
  // the start mesa: a flat top you stand on (collidable: the feet find it), a painted pad and a pennant
  const mesaN = field.needles.find((n) => n.mesa);
  const mesa = new THREE.Mesh(needleGeometry({ ...mesaN, r1: PAD.r }, () => 0.5), pale);
  scene.add(mesa);
  const padTop = new THREE.Mesh(new THREE.CylinderGeometry(PAD.r * 0.62, PAD.r * 0.62, 0.08, 32).translate(PAD.x, PAD.y + 0.04, PAD.z), makeMaterial({ color: '#f7ecd2', flat: true }));
  const padRing = tag(new THREE.Mesh(new THREE.TorusGeometry(PAD.r * 0.5, 0.18, 4, 40).rotateX(Math.PI / 2).translate(PAD.x, PAD.y + 0.1, PAD.z), makeMaterial({ color: '#d9643a', flat: true })));
  scene.add(tag(padTop), padRing);
  const ink = makeMaterial({ color: INK, flat: true });
  const pole = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6).translate(PAD.x + 6, PAD.y + 3, PAD.z + 3), ink));
  const flagGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 6, 0, 0, 4.6, 0, 2.2, 5.3, 0], 3));
  flagGeo.computeVertexNormals();
  const flag = tag(new THREE.Mesh(flagGeo, makeMaterial({ color: '#d9643a', side: THREE.DoubleSide })));
  flag.position.set(PAD.x + 6, PAD.y, PAD.z + 3);
  scene.add(pole, flag);
  yield;
  // the rings
  const mats = {
    brass: makeMaterial({ metal: 'brass' }), ink,
    next: makeMaterial({ color: '#f2c54b', glow: 0.85 }),
    passed: makeMaterial({ color: '#71d7cf', glow: 0.55 }),
    missed: makeMaterial({ color: '#8f8577' }),
  };
  const ringObjs = rings.map((g) => { const o = ringModel(g, mats); scene.add(o); return o; });
  yield;
  // far mesas round the field, for the eye to run to
  const far = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.2, d = 620 + rand() * 180, x = 100 + Math.cos(a) * d, z = 200 + Math.sin(a) * d;
    const r = 40 + rand() * 50, h = 60 + rand() * 120;
    far.push(new THREE.CylinderGeometry(r * 0.8, r, h, 12, 3).translate(x, fieldHeight(x, z) + h / 2 - 5, z).toNonIndexed());
  }
  scene.add(tag(new THREE.Mesh(mergeGeometries(far), pale)));
  yield;
  return arenaLevel({
    ground: terrain, name: 'The Needle Field', hour: 16.4,
    spawn: V(PAD.x, PAD.y, PAD.z),
    features: { mount: false, wind: true, jetpack: true, climb: false },
    race: { rings, field, ringObjs, mats, H: (x, z) => fieldHeight(x, z) },
  });
}

// ------------------------------------------------------------------ the sounds
function raceSounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && sound.fx;
  const note = (s) => 440 * Math.pow(2, s / 12);
  const PENTA = [0, 2, 4, 7, 9];
  return {
    /** A ring through: a bell, a step higher each ring (a pentatonic run up the course). */
    chime(i) {
      if (!on()) return;
      const t = sound.ctx.currentTime, s = PENTA[i % 5] + 12 * Math.floor(i / 5) - 5;
      sound.pluck(note(s + 12), t, 0.08, 'sine', sound.fx);
      sound.pluck(note(s + 24), t + 0.04, 0.035, 'sine', sound.fx);
      sound.pluck(note(s + 19), t + 0.11, 0.03, 'triangle', sound.fx);
    },
    /** The tank topped up: a little gurgle up. */
    fill() { if (on()) sound.sweep(sound.ctx.currentTime + 0.05, 300, 720, 0.22, 0.035, 'triangle'); },
    crash() {
      if (!on()) return;
      const t = sound.ctx.currentTime;
      sound.burst(t, { dur: 0.5, type: 'lowpass', freq: 380, q: 0.8, vol: 0.28, rate: 0.6 });
      sound.burst(t + 0.02, { dur: 0.3, type: 'bandpass', freq: 1300, q: 0.9, vol: 0.12 });
    },
    low() { if (on()) sound.pluck(note(-14), sound.ctx.currentTime, 0.06, 'square', sound.fx); },
  };
}

// ------------------------------------------------------------------ the game
const _cw = V(), _cl = V(), _cd = V(), _sp = V(), _sv = V(), _gp = V();

function start(ctx) {
  const { player, camera, level, sfx } = ctx;
  const C = level.race, rings = C.rings, field = C.field, ground = C.H;
  const snd = raceSounds(ctx.sound);
  const giveBack = lendItems(['backpack', 'jetpack']);
  const heading0 = Math.atan2(rings[0].c.x - PAD.x, rings[0].c.z - PAD.z);
  let F = newFlyer(V(PAD.x, PAD.y, PAD.z), heading0);
  const R = newRace(rings.length);
  for (const [i, o] of C.ringObjs.entries()) { o.userData.hoop.material = i === 0 ? C.mats.next : C.mats.brass; o.scale.setScalar(1); }
  const run = { t: 0, crashes: 0, track: [], trackT: 0, splits: [], lowWarned: false, blink: 0, top: 0 };
  const ghost = loadGhost();
  const cam = { pos: V(PAD.x - Math.sin(heading0) * 9, PAD.y + 4, PAD.z - Math.cos(heading0) * 9), look: V(PAD.x, PAD.y + 1.5, PAD.z), roll: 0 };

  // the guide arrow: a brass dart hung at the top of the view, pointing at the next ring (a four-sided
  // head and a shaft, so it reads from any side; the ink line is the world's own)
  const arrow = new THREE.Group();
  const head = new THREE.ConeGeometry(0.34, 0.75, 4).rotateY(Math.PI / 4).scale(1, 1, 0.45).rotateX(Math.PI / 2).translate(0, 0, 0.32);
  const shaft = new THREE.BoxGeometry(0.15, 0.07, 0.6).translate(0, 0, -0.3);
  const arrowMesh = tag(new THREE.Mesh(mergeGeometries([head.toNonIndexed(), shaft.toNonIndexed()]), makeMaterial({ color: '#f2c54b', glow: 0.55, key: 'rings-arrow' })));
  arrow.add(arrowMesh);
  ctx.add(arrow);
  (level.noShadow ??= []).push(arrowMesh);

  // the ghost: a teal dart and its trail
  let ghostObj = null;
  const trail = new Dots(ctx.scene, 160, makeMaterial({ color: '#ffffff', flat: true, glow: 0.6, key: 'rings-trail' }));
  (level.noShadow ??= []).push(trail.mesh);
  if (ghost) {
    ghostObj = new THREE.Group();
    const gm = makeMaterial({ color: '#71d7cf', glow: 0.8, key: 'rings-ghost' });
    const body = tag(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.7, 6).rotateX(Math.PI / 2), gm));
    const wings = tag(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.55).translate(0, 0, -0.3), gm));
    ghostObj.add(body, wings);
    ctx.add(ghostObj);
  }
  const ghostPrev = V();

  function updateCamera(dt, snap = false) {
    const sp = F.vel.length(), k = Math.min(sp / 34, 1);
    const fwd = dirOf(F.heading, _cd);
    const way = F.pad ? fwd : jetNose(fwd, UP, F.pitch * 0.55, _cl.set(0, 0, 0)).clone();
    const arm = 5.2 + 0.08 * sp;
    _cw.copy(F.pos).addScaledVector(way, -arm).addScaledVector(UP, 1.9 + 0.4 * k);
    const floor = ground(_cw.x, _cw.z) + 1.5;
    if (_cw.y < floor) _cw.y = floor;
    const look = _cl.copy(F.pos).addScaledVector(jetNose(fwd, UP, F.pitch, V()), 10 + 6 * k).addScaledVector(UP, 1.2);
    const f = snap ? 1 : 1 - Math.exp(-6 * dt);
    cam.pos.lerp(_cw, f);
    cam.look.lerp(look, snap ? 1 : 1 - Math.exp(-9 * dt));
    cam.roll += (F.bank * 0.35 - cam.roll) * (snap ? 1 : 1 - Math.exp(-5 * dt));
    camera.position.copy(cam.pos);
    _cd.subVectors(cam.look, cam.pos).normalize();
    camera.up.set(0, 1, 0).applyAxisAngle(_cd, -cam.roll);
    camera.lookAt(cam.look);
    ctx.setFov(60 + 16 * k);
  }

  function pose(dt) {
    player.pos.copy(F.pos);
    player.vel.copy(F.vel);
    player.heading = F.heading;
    player.onGround = F.pad;
    player.gliding = false;
    player._moveDir = (player._moveDir ?? V()).set(0, 0, 0);
    player._wantSpeed = 0;
    if (F.pad) { player.jetFlight = null; player.thrusting = false; player.jetPower = 0; }
    else {
      player.jetFlight = { pitch: F.pitch, bank: F.bank, along: F.along };
      player.thrusting = F.T > 0; player.jetPower = F.burn;
    }
    player.jetHold = false;
    player.finishFrame(dt, F.pad ? 0 : F.vel.length());
  }

  function crash(kind) {
    run.crashes++;
    snd.crash(); sfx.hurt(); ctx.kick(0.9);
    ctx.addTime(RACE.penaltyCrash, `${kind === 'ground' ? 'Into the sand' : 'Crashed'} · +${RACE.penaltyCrash} s`);
    // again from the last ring passed (or the pad's air), flying on its way, the tank at least a little full
    const last = R.next > 0 ? rings[R.next - 1] : null;
    const at = last ? last.c.clone() : V(PAD.x, PAD.y + 8, PAD.z);
    const to = rings[Math.min(R.next, rings.length - 1)].c.clone().sub(at);
    if (last) { at.addScaledVector(to.clone().normalize(), 14); to.copy(rings[Math.min(R.next, rings.length - 1)].c).sub(at); }   // (a little past it, on the way to the next: the camera clear of its hoop)
    F = newFlyer(at, Math.atan2(to.x, to.z), { pad: false, along: 18, pitch: Math.atan2(to.y, Math.hypot(to.x, to.z)) * 0.6, fuel: Math.max(F.fuel, RACE.respawnFuel) });
    run.blink = 1.2;
    updateCamera(0, true);
  }

  function ringEvents(ev) {
    for (const e of ev) {
      const o = C.ringObjs[e.i];
      if (e.kind === 'pass') {
        o.userData.hoop.material = C.mats.passed;
        o.userData.pop = 1;
        snd.chime(R.passed - 1);
        F.fuel = Math.min(1, F.fuel + RACE.topUp);
        snd.fill();
        run.lowWarned = false;
        // the split against the ghost's
        run.splits[e.i] = ctx.time;   // (with the penalties so far)
        const gs = ghost?.splits?.[e.i];
        if (Number.isFinite(gs) && !rings[e.i].last) {
          const d = ctx.time - gs;
          ctx.flash(`${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} s`, d <= 0 ? 'good' : 'bad', 0.9);
        }
      } else {
        o.userData.hoop.material = C.mats.missed;
        sfx.miss();
        ctx.addTime(RACE.penaltyMiss, `Missed ring ${e.i + 1} · +${RACE.penaltyMiss} s`);
      }
      const nx = C.ringObjs[R.next];
      if (nx) nx.userData.hoop.material = C.mats.next;
    }
    if (R.done) {
      run.done = true;
      const time = ctx.time;
      const best = ctx.best();
      if (!ghost || time < ghost.time || !Number.isFinite(best) || time < best) saveGhost(packGhost(time, run.track, run.splits));
      ctx.finish({ lines: [
        `Rings ${R.passed} of ${R.n}${R.missed ? ` · ${R.missed} missed (+${R.missed * RACE.penaltyMiss} s)` : ' · every one'}`,
        ...(run.crashes ? [`Crashes: ${run.crashes} (+${run.crashes * RACE.penaltyCrash} s)`] : ['No crashes']),
        `Top speed ${Math.round(run.top * 3.6)} km/h${ghost ? ` · ghost ${ghost.time.toFixed(2)} s` : ''}`,
      ] });
    }
  }

  updateCamera(0, true);
  pose(1 / 60);
  ctx.status(statusText());

  function statusText() {
    const n = Math.round(F.fuel * 8);
    return `Ring ${Math.min(R.next + 1, R.n)} / ${R.n}  ${'▮'.repeat(n)}${'▯'.repeat(8 - n)}`;
  }

  return {
    /** (for a scripted pilot: the flyer, the race, the rings) */
    get state() { return { F, R, rings }; },
    update(dt, inp, { live, phase }) {
      const moving = live || phase === 'finishing';
      if (moving) {
        if (live) run.t += dt;
        const p0 = F.pos.clone(), wasPad = F.pad;
        const ii = run.done ? { x: 0.35, y: clamp1(F.pitch * 2), throttle: 0.6 } : { x: inp.x, y: inp.y, throttle: Math.max(inp.tuck, inp.jump ? 1 : 0) };
        flyStep(F, ii, dt);
        if (wasPad && !F.pad) { run.safe = 0.6; sfx.whoosh(); }   // (lifting off the mesa's top: not a crash into it)
        run.top = Math.max(run.top, F.vel.length());
        if (!run.done) {
          ringEvents(raceStep(R, rings, p0, F.pos));
          const hit = !F.pad && run.blink <= 0 && !(run.safe > 0) ? hitAt(F.pos, field, ground) : null;
          if (hit && !run.done) crash(hit);
          if (!F.pad && F.fuel < 0.15 && !run.lowWarned) { run.lowWarned = true; snd.low(); ctx.flash('Fuel low', 'bad', 1); }
        } else if (F.pos.y < ground(F.pos.x, F.pos.z) + 2) { F.pos.y = ground(F.pos.x, F.pos.z) + 2; F.vel.y = Math.max(0, F.vel.y); }
        run.blink = Math.max(0, run.blink - dt); run.safe = Math.max(0, (run.safe ?? 0) - dt);
        // the ghost's track, every GHOST.every s
        if (live && (run.trackT += dt) >= GHOST.every - 1e-6) { run.trackT -= GHOST.every; run.track.push(F.pos.x, F.pos.y, F.pos.z); }
        if (live && run.track.length === 0) run.track.push(F.pos.x, F.pos.y, F.pos.z);
      }
      // the ghost flies its best run, at the same time into it
      if (ghostObj) {
        const at = ghostAt(ghost, run.t, _gp);
        ghostObj.visible = !!at && phase !== 'intro' && phase !== 'count';
        if (at) {
          ghostObj.position.copy(at).addScaledVector(UP, 0.9);   // (where the body flies: the feet are under it)
          if (at.distanceToSquared(ghostPrev) > 1e-4) ghostObj.lookAt(_sp.copy(at).multiplyScalar(2).sub(ghostPrev));
          if (ghostObj.visible && Math.random() < 0.8) trail.add({ pos: at, vel: _sv.set((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6), size: 0.035 + Math.random() * 0.03, life: 0.9, color: Math.random() < 0.5 ? '#71d7cf' : '#c9efe9' });
          ghostPrev.copy(at);
        }
      }
      // the jets' wake: a few ink dashes off the nozzles at speed
      if (!F.pad && F.T > 0.3 && Math.random() < 0.6) {
        _sp.copy(F.pos).addScaledVector(UP, 1.0).addScaledVector(F.vel, -0.03);
        trail.add({ pos: _sp, vel: _sv.copy(F.vel).multiplyScalar(0.25).add(V((Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2)), size: 0.022 + Math.random() * 0.02, stretch: 4, life: 0.4, color: Math.random() < 0.5 ? INK : '#d9643a' });
      }
      trail.update(dt, UP);
      // the rings: the next one breathes, a ring passed swells out once
      for (const [i, o] of C.ringObjs.entries()) {
        if (o.userData.pop > 0) { o.userData.pop = Math.max(0, o.userData.pop - dt * 2.5); o.scale.setScalar(1 + 0.35 * Math.sin(Math.PI * (1 - o.userData.pop))); }
        else if (i === R.next) o.scale.setScalar(1 + 0.05 * Math.sin(run.t * 6));
        else o.scale.setScalar(1);
      }
      pose(dt);
      if (run.blink > 0) player.object.visible = Math.floor(run.blink * 10) % 2 === 0; else player.object.visible = true;
      updateCamera(dt);
      // the arrow: hung at the top of the view, at the next ring
      const g = rings[Math.min(R.next, rings.length - 1)];
      arrow.visible = !R.done && phase !== 'intro';
      camera.updateMatrixWorld();
      arrow.position.set(0, 1.05, -4.2).applyMatrix4(camera.matrixWorld);
      arrow.lookAt(g.c);
      arrow.scale.setScalar(0.62);
      ctx.speed(Math.max(0, Math.min(1, (F.vel.length() - 24) / 14)));
      ctx.status(statusText());
    },
    end() {
      giveBack();
      trail.mesh.removeFromParent();
      for (const m of [trail.mesh, arrowMesh]) { const i = level.noShadow.indexOf(m); if (i >= 0) level.noShadow.splice(i, 1); }
      player.jetFlight = null; player.thrusting = false; player.jetPower = 0;
      player.object.visible = true;
      ctx.speed(0);
    },
  };
}

export default {
  id: 'rings', order: 3,
  name: 'Ring race',
  blurb: 'The jets, race-tuned, through twenty brass hoops strung among the needles of the Needle Field.',
  rules: 'Fly through every ring in order (the arrow points at the next). Each ring tops up the tank; a missed ring costs 5 s, a crash 3 s. Fastest run wins; your best flies with you as a ghost.',
  controls: {
    pad: [['RT / R2', 'thrust (lift off the mesa)'], ['Left stick', 'forward dives, back climbs; left / right bank and turn'], ['Let go of RT / R2', 'glide: saves fuel'], ['Menu', 'pause']],
    keys: [['Space or Shift', 'thrust (lift off the mesa)'], ['W  S', 'dive / climb'], ['A  D', 'bank and turn'], ['Esc', 'pause']],
    touch: [['Jump, held', 'thrust'], ['Stick', 'dive, climb, bank']],
  },
  score: { kind: 'time' },
  hud: { timer: true },
  color: '#f2c54b',
  build: buildRings,
  start,
};
