import * as THREE from 'three';

// The gait planner (docs/systems/procedural-animation.md, "Stepping: feet stay where they land"; the kit:
// "src/motion-kit/"). Each foot has a home spot on the ground fixed to the body. A planted foot stays exactly
// where it landed; it steps when it drifts too far from home (or has stood too long while the body turned),
// and lands past home by part of a stride, so the body walks over it. Only one group of legs swings at a time,
// and a group lifts only when every other foot is down: a tripod on six legs, alternating tetrapods on eight,
// diagonal pairs on four, one at a time on three. One ground ray per step (at its landing spot, as it lifts),
// and a touchdown event for each landing (dust, a sound, a rumble).
//
// Pure logic over THREE.Vector3 (no scene graph): tested in node (tests/motion-kit.test.js). The mind never
// asks the planner anything; it only follows f.pos and f.heading (src/motion-kit/rig.js).

const smoother = THREE.MathUtils.smootherstep, clamp = THREE.MathUtils.clamp;
const _h = new THREE.Vector3(), _t = new THREE.Vector3();

/** A small seeded random (mulberry32): the same foe steps the same way every run; two foes differ. */
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Sort a body's feet into sides and rows, and give the gait groups and each foot's neighbours.
 * homes: the feet's rest spots in the body's frame ({x, z}; +z ahead). gait: 'alternate' (the default for 2, 4,
 * 6 and 8 legs: diagonal pairs, a tripod, alternating tetrapods), 'wave' (one leg at a time, round the body: the
 * default for 3 or an odd count) or 'lateral' (one at a time, hind then fore on each side: a slow four-legged walk).
 * Returns { groups: [[leg…]…], group: [g per leg], neighbours: [[leg…] per leg], left, right }.
 */
export function layoutLegs(homes, gait) {
  const n = homes.length;
  const left = [], right = [];
  homes.forEach((h, i) => (h.x >= 0 ? left : right).push(i));
  const byZ = (a, b) => homes[b].z - homes[a].z;   // (front first)
  left.sort(byZ); right.sort(byZ);
  gait ??= n % 2 === 0 && left.length === right.length ? 'alternate' : 'wave';
  const group = new Array(n).fill(0);
  let groups;
  if (gait === 'alternate') {
    left.forEach((leg, i) => { group[leg] = i % 2; });
    right.forEach((leg, i) => { group[leg] = (i + 1) % 2; });
    groups = [0, 1].map((g) => group.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0));
  } else if (gait === 'lateral' && n === 4) {
    // hind left, fore left, hind right, fore right
    const order = [left[1], left[0], right[1], right[0]];
    order.forEach((leg, k) => { group[leg] = k; });
    groups = order.map((leg) => [leg]);
  } else {
    // round the body by angle: each leg alone, in turn
    const order = homes.map((h, i) => [Math.atan2(h.x, h.z), i]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    const seq = [];
    for (let k = 0; k < n; k++) seq.push(order[(k * (n % 2 ? 2 : 1)) % n]);   // (skip one round an odd ring: 0 2 1)
    const used = new Set(), unique = [];
    for (const leg of [...seq, ...order]) if (!used.has(leg)) { used.add(leg); unique.push(leg); }
    unique.forEach((leg, k) => { group[leg] = k; });
    groups = unique.map((leg) => [leg]);
  }
  // neighbours: next to each other along a side, and across the same row
  const neighbours = homes.map(() => []);
  const link = (a, b) => { if (a == null || b == null || a === b) return; if (!neighbours[a].includes(b)) neighbours[a].push(b); if (!neighbours[b].includes(a)) neighbours[b].push(a); };
  for (const side of [left, right]) for (let i = 0; i + 1 < side.length; i++) link(side[i], side[i + 1]);
  for (let i = 0; i < Math.min(left.length, right.length); i++) link(left[i], right[i]);
  if (gait === 'wave') for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) link(a, b);   // (a ring of three: every leg is next to the others)
  return { groups, group, neighbours, left, right, gait };
}

/**
 * The planner. Options:
 *   homes      the feet's rest spots in the body's frame (x to the side, z ahead, y 0 at the ground)
 *   gait       see layoutLegs; groups / neighbours may be given directly
 *   drift      how far a planted foot may fall from its home before it steps (m): half a stride
 *   stepTime   [shortest, longest] swing (s); the swing shortens with speed so the stance stays the longer
 *   height     the step's lift (m); `arc`: 'organic' (rise, then travel on a smootherstep) or 'machine'
 *              (three straight moves: lift, translate, drop)
 *   reach      the farthest a planted foot may fall from home before it lifts whatever the groups say (m)
 *   maxStance  a foot that has stood this long and drifted at all steps (s): it settles after a turn
 *   seed       per foe: the stagger of its first stance and a few per cent on its stride, so a pack never
 *              steps in unison
 */
export class GaitPlanner {
  constructor({ homes, gait, groups, neighbours, drift = 0.3, stepTime = [0.12, 0.4], height = 0.1, arc = 'organic', reach, maxStance = 2.5, seed = 1 } = {}) {
    const lay = layoutLegs(homes, gait);
    this.groups = groups ?? lay.groups;
    this.neighbours = neighbours ?? lay.neighbours;
    this.gait = lay.gait;
    const rnd = seeded(seed);
    this.rnd = rnd;
    this.drift = drift * (0.94 + rnd() * 0.12);
    this.reach = reach ?? this.drift * 1.7;
    this.stepTime = stepTime; this.height = height; this.arc = arc; this.maxStance = maxStance;
    this.spread = 1; this.locked = false; this.pending = null;
    const group = new Array(homes.length).fill(0);
    this.groups.forEach((g, k) => g.forEach((leg) => { group[leg] = k; }));
    this.feet = homes.map((h, i) => ({
      home: new THREE.Vector3(h.x, h.y ?? 0, h.z), group: group[i],
      pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
      planted: true, t: 0, dur: 0.2, lift: height, stood: 0, drift: 0,
    }));
    this.lastGroup = -1;
    this.events = [];
    this.rays = 0;   // (ground rays made: one per step)
    this.ready = false;
    this.heading = 0;
  }

  /** A foot's home in the world for a body at root (ground level) facing heading, pushed ahead by `ahead`. */
  homeOf(foot, root, heading, out, ahead = null) {
    const s = Math.sin(heading), c = Math.cos(heading), hx = foot.home.x * this.spread, hz = foot.home.z * this.spread;
    out.set(root.x + hx * c + hz * s, root.y + foot.home.y, root.z - hx * s + hz * c);
    if (ahead) { out.x += ahead.x; out.z += ahead.z; }
    return out;
  }

  /**
   * Plant every foot near its home, each group at its own point of the stride (spread evenly over a cycle, from
   * a point chosen by the seed), so the groups start out of step with each other and a pack out of step too.
   */
  init(root, heading) {
    const n = this.groups.length, u = this.rnd();
    const s = Math.sin(heading), c = Math.cos(heading);
    for (const f of this.feet) {
      const phase = (f.group / n + u) % 1;
      const off = this.drift * 0.85 * (1 - 2 * phase) + (this.rnd() - 0.5) * this.drift * 0.1;
      this.homeOf(f, root, heading, f.pos);
      f.pos.x += s * off; f.pos.z += c * off;
      f.planted = true; f.t = 0; f.stood = this.rnd() * this.maxStance * 0.5;
    }
    this.heading = heading;
    this.ready = true;
  }

  /** Plant every foot where it is now (after a hop, a tuck or a fall), at the root's height. */
  replant(positions, root) {
    this.feet.forEach((f, i) => { f.pos.copy(positions[i]); f.pos.y = root.y + f.home.y; f.planted = true; f.t = 0; });
    this.ready = true;
  }

  /** The wind-up's stance: lock stops new steps once the feet have braced; spread widens their homes first. */
  setStance(lock, spread = 1) {
    if (lock && !this.locked) {
      this.spread = spread;
      this.pending = new Set();   // (the brace: each foot that is not at its widened home steps there once)
      this._brace = true;
    } else if (!lock && this.locked) { this.pending = null; this.spread = 1; }
    else if (!lock) this.spread = 1;
    this.locked = lock;
  }

  /** The swing's length at this speed (s): the stance must stay the longer, so groups never overlap. */
  swingTime(speed) {
    const [lo, hi] = this.stepTime, n = Math.max(1, this.groups.length - 1);
    if (speed < 0.05) return hi * 0.8;
    return clamp((0.85 * 2 * this.drift) / (speed * n), lo, hi);
  }

  /** Where a foot lifting now should land: its home after the swing, a part of a stride past it. */
  landing(foot, root, heading, vel, turn, dur, out) {
    const speed = Math.hypot(vel.x, vel.z);
    const lead = speed > 0.05 ? Math.min(1, speed / 0.6) * this.drift * 0.9 : 0;
    _h.set(vel.x * dur + (speed > 1e-6 ? (vel.x / speed) * lead : 0), 0, vel.z * dur + (speed > 1e-6 ? (vel.z / speed) * lead : 0));
    return this.homeOf(foot, root, heading + turn * dur * 1.5, out, _h);
  }

  /**
   * One frame. root: the body's spot on the ground (world); heading (rad); vel: {x, z} (m/s); ground(x, fromY, z)
   * → height or null: called once per step. Returns the touchdowns of this frame [{ leg, at, speed }].
   */
  update(dt, root, heading, vel, ground) {
    const ev = this.events; ev.length = 0;
    if (!this.ready) this.init(root, heading);
    if (this.cannedLast) { for (const f of this.feet) { f.planted = true; f.t = 0; f.pos.y = root.y + f.home.y; } this.cannedLast = false; }
    let turn = Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading)) / Math.max(dt, 1e-4);
    if (!(dt > 0)) turn = 0;
    this.heading = heading;
    const speed = Math.hypot(vel.x, vel.z);
    const feet = this.feet;
    let swinging = -1;
    // 1. the feet in the air move along their arcs, and land
    for (let i = 0; i < feet.length; i++) {
      const f = feet[i];
      if (f.planted) { f.stood += dt; continue; }
      f.t += dt / f.dur;
      if (f.t < 0.6) {   // (early in the swing the landing follows the body: a turn or a change of pace)
        const y = f.to.y;
        this.landing(f, root, heading, vel, turn, f.dur * (1 - f.t), _t);
        f.to.set(_t.x, y, _t.z);
      }
      if (f.t >= 1) {
        f.pos.copy(f.to); f.planted = true; f.stood = 0; f.t = 1;
        ev.push({ leg: i, at: f.pos.clone(), speed });
        this.pending?.delete(i);
      } else { this.arcAt(f, f.t, f.pos); swinging = f.group; }
    }
    // 2. how far each planted foot has fallen behind its home
    for (const f of feet) if (f.planted) { this.homeOf(f, root, heading, _t); f.drift = Math.hypot(f.pos.x - _t.x, f.pos.z - _t.z); }
    if (this.locked && this._brace) {   // (the brace, once as the wind-up begins: feet not at their wide homes step there)
      this._brace = false;
      feet.forEach((f, i) => { if (f.planted && f.drift > this.drift * 0.12) this.pending.add(i); });
    }
    const moving = speed > 0.08 || Math.abs(turn) > 0.3;
    const threshold = moving ? this.drift : this.drift * 0.35;   // (stopped: a settling step brings a foot home)
    const dur = this.locked ? this.stepTime[0] : this.swingTime(speed);   // (a brace is quick: done well before the pose holds)
    if (swinging >= 0) return ev;
    // 3. the most urgent group lifts, when every foot is down (a foot past `reach` is the most urgent of all)
    let best = -1, bestU = 0, second = -1, secondU = 0;
    for (let g = 0; g < this.groups.length; g++) {
      let u = 0;
      for (const i of this.groups[g]) {
        const f = feet[i];
        if (this.locked && !this.pending?.has(i)) continue;
        let fu = f.drift / threshold;
        if (this.locked) fu = Math.max(fu, 1);
        if (f.stood > this.maxStance && f.drift > this.drift * 0.25) fu = Math.max(fu, 1);
        u = Math.max(u, fu);
      }
      if (u > bestU) { second = best; secondU = bestU; best = g; bestU = u; }
      else if (u > secondU) { second = g; secondU = u; }
    }
    if (bestU < 1) return ev;
    if (best === this.lastGroup && second >= 0 && secondU > 0.6) best = second;   // (groups take turns)
    const min = this.locked ? 0 : moving ? this.drift * 0.2 : this.drift * 0.08;
    // the swing is short enough that no foot left waiting is dragged past its reach before this group is down
    let swing = dur;
    if (speed > 0.05 && !this.locked) for (let g = 0; g < this.groups.length; g++) if (g !== best) for (const i of this.groups[g]) {
      const left = (this.reach - feet[i].drift) / speed;
      swing = Math.min(swing, left * 0.9);
    }
    swing = clamp(swing, this.stepTime[0] * 0.75, this.stepTime[1]);
    for (const i of this.groups[best]) {
      const f = feet[i];
      if (this.locked && !this.pending?.has(i)) continue;
      if (f.drift >= min || f.stood > this.maxStance) this.lift(i, root, heading, vel, turn, swing, ground);
    }
    this.lastGroup = best;
    return ev;
  }

  /** Start a step: one ground ray at its landing spot. */
  lift(i, root, heading, vel, turn, dur, ground) {
    const f = this.feet[i];
    f.from.copy(f.pos);
    this.landing(f, root, heading, vel, turn, dur, f.to);
    const y = ground ? ground(f.to.x, root.y + 1.5, f.to.z) : null;
    this.rays++;
    f.to.y = Number.isFinite(y) ? y + f.home.y : root.y + f.home.y;
    f.dur = dur; f.t = 0; f.planted = false;
    const speed = Math.hypot(vel.x, vel.z);
    f.lift = this.height * (speed < 0.08 && Math.abs(turn) < 0.3 ? 0.55 : 1);
  }

  /** A foot's place along its step at t (0..1). */
  arcAt(f, t, out) {
    if (this.arc === 'machine') {
      // three straight moves: lift, translate, drop (hard stops)
      const top = Math.max(f.from.y, f.to.y) + f.lift;
      if (t < 0.28) { const u = t / 0.28; out.set(f.from.x, THREE.MathUtils.lerp(f.from.y, top, u), f.from.z); }
      else if (t < 0.72) { const u = (t - 0.28) / 0.44; out.set(THREE.MathUtils.lerp(f.from.x, f.to.x, u), top, THREE.MathUtils.lerp(f.from.z, f.to.z, u)); }
      else { const u = (t - 0.72) / 0.28; out.set(f.to.x, THREE.MathUtils.lerp(top, f.to.y, u), f.to.z); }
      return out;
    }
    const s = smoother(t, 0.12, 0.9);   // (it rises first, then travels)
    out.lerpVectors(f.from, f.to, s);
    out.y += f.lift * Math.sin(Math.PI * t);
    return out;
  }

  /**
   * The far tier's canned cycle: no planning, no rays; each foot's place follows the distance walked (so it
   * never skates even so). distance: m walked so far; duty: the share of a cycle a foot is down.
   */
  canned(root, heading, distance, duty = 0.6) {
    const n = this.groups.length, S = this.drift * 2, cycle = S / duty;
    const s = Math.sin(heading), c = Math.cos(heading);
    for (const f of this.feet) {
      const ph = (((distance / cycle + f.group / n) % 1) + 1) % 1;
      let x, y = 0;
      if (ph < duty) x = S / 2 - (ph / duty) * S;
      else { const u = (ph - duty) / (1 - duty); x = -S / 2 + smoother(u, 0, 1) * S; y = this.height * Math.sin(Math.PI * u); }
      this.homeOf(f, root, heading, f.pos);
      f.pos.x += s * x; f.pos.z += c * x; f.pos.y += y;
      f.planted = ph < duty;
    }
    this.cannedLast = true;   // (back to planning: it plants where the feet are)
  }

  /** How many feet are in the air. */
  get lifted() { let n = 0; for (const f of this.feet) if (!f.planted) n++; return n; }
}
