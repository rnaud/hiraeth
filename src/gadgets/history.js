import * as THREE from 'three';

// Motion history (docs/systems/gadgets.md, "The recall hourglass"): a short memory of where loose things
// have been, so the hourglass can send one back along its own path. Cheap by design: a ring buffer of
// samples per thing (x, y, z, yaw, time), taken HISTORY.rate times a second and only when it moved; a thing
// is only followed while it moves or moved within HISTORY.window seconds, and no more than HISTORY.cap of
// them at once (the one that has been still longest gives its place up). Pure: tests/recall-bridge.test.js.
//
//   const h = new MotionHistory()
//   h.update(dt, items)    items: [{ key, pos, yaw?: () => number, moving: () => bool }] (anything with a position)
//   h.track(key)           its Track or null · h.path(key) → [{ pos, yaw, t }] newest first · h.freeze(key, on) · h.clear(key)
//   new Rewind(h.path(key), { rate })   .step(dt, outPos) → { done, yaw } along it, newest to oldest

export const HISTORY = {
  window: 8,      // s of motion kept
  rate: 20,       // samples a second (while it moves)
  cap: 24,        // things followed at once
  eps: 0.025,     // m it must have moved since the last sample to take another
  turn: 0.06,     // or radians it turned
};

const STRIDE = 5;

/** One thing's recent path: a ring buffer of samples (x, y, z, yaw, t), newest last. */
export class Track {
  constructor(n = Math.ceil(HISTORY.window * HISTORY.rate) + 4) {
    this.n = n; this.buf = new Float64Array(n * STRIDE); this.head = 0; this.len = 0;
    this.lastMove = 0; this.frozen = false;
  }
  push(x, y, z, yaw, t) {
    const i = this.head * STRIDE, b = this.buf;
    b[i] = x; b[i + 1] = y; b[i + 2] = z; b[i + 3] = yaw; b[i + 4] = t;
    this.head = (this.head + 1) % this.n;
    this.len = Math.min(this.len + 1, this.n);
    return this;
  }
  /** The k-th sample back from the newest (0: the newest): its index into buf. */
  index(k) { return ((this.head - 1 - k) % this.n + this.n) % this.n * STRIDE; }
  /** The k-th sample back into out ({ pos, yaw, t }; new when not given). */
  get(k, out = { pos: new THREE.Vector3(), yaw: 0, t: 0 }) {
    const i = this.index(k), b = this.buf;
    out.pos.set(b[i], b[i + 1], b[i + 2]); out.yaw = b[i + 3]; out.t = b[i + 4];
    return out;
  }
  /** Samples older than `window` seconds before `now` are let go (the newest is always kept). */
  expire(now, window = HISTORY.window) {
    while (this.len > 1 && this.buf[this.index(this.len - 1) + 4] < now - window) this.len--;
  }
  /** Metres along the path, newest to oldest. */
  length() {
    let L = 0;
    for (let k = 1; k < this.len; k++) {
      const a = this.index(k - 1), b = this.index(k), B = this.buf;
      L += Math.hypot(B[a] - B[b], B[a + 1] - B[b + 1], B[a + 2] - B[b + 2]);
    }
    return L;
  }
  /** Seconds of motion it holds (samples × the rate's step: still stretches are not kept). */
  seconds(rate = HISTORY.rate) { return Math.max(0, this.len - 1) / rate; }
  clear() { this.len = 0; this.head = 0; }
}

const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export class MotionHistory {
  constructor({ window = HISTORY.window, rate = HISTORY.rate, cap = HISTORY.cap } = {}) {
    Object.assign(this, { window, rate, cap });
    this.tracks = new Map(); this.t = 0; this.acc = 0;
    this._s = { pos: new THREE.Vector3(), yaw: 0, t: 0 };
  }

  /** Follow what moves among `items` (called every frame; samples are taken `rate` times a second). */
  update(dt, items) {
    this.t += dt; this.acc += dt;
    if (this.acc < 1 / this.rate - 1e-9) return;
    this.acc = Math.min(this.acc - 1 / this.rate, 1 / this.rate);
    const now = this.t, seen = new Set();
    for (const it of items) {
      if (!it || it.key == null) continue;
      seen.add(it.key);
      const yaw = it.yaw?.() ?? 0, p = it.pos;
      let tr = this.tracks.get(it.key);
      if (!tr) {
        if (!(it.moving?.() ?? false)) continue;
        if (this.tracks.size >= this.cap && !this.evict()) continue;
        tr = new Track(Math.ceil(this.window * this.rate) + 4);
        this.tracks.set(it.key, tr);
        tr.push(p.x, p.y, p.z, yaw, now); tr.lastMove = now;
        continue;
      }
      if (tr.frozen) continue;
      const s = tr.get(0, this._s);
      if (tr.len === 0 || s.pos.distanceTo(p) > HISTORY.eps || angleGap(s.yaw, yaw) > HISTORY.turn) {
        tr.push(p.x, p.y, p.z, yaw, now); tr.lastMove = now;
      }
    }
    for (const [key, tr] of this.tracks) {
      if (tr.frozen) continue;
      // gone (no longer among the items), or still for longer than the window: forgotten
      if (!seen.has(key) || now - tr.lastMove > this.window) { this.tracks.delete(key); continue; }
      tr.expire(now, this.window);
    }
  }

  /** Make room: the track still for longest goes (never a frozen one, nor one that moved in the last `busy` s: no churn). */
  evict(busy = 1) {
    let worst = null, wk = null;
    for (const [k, tr] of this.tracks) if (!tr.frozen && this.t - tr.lastMove > busy && (!worst || tr.lastMove < worst.lastMove)) { worst = tr; wk = k; }
    if (wk == null) return false;
    this.tracks.delete(wk);
    return true;
  }

  track(key) { return this.tracks.get(key) ?? null; }
  /** Does it have a path to go back along (at least `min` metres)? */
  has(key, min = 0.3) { const tr = this.tracks.get(key); return !!tr && tr.len >= 2 && tr.length() >= min; }
  /** Its path, newest first: [{ pos, yaw, t }] (copies). */
  path(key) {
    const tr = this.tracks.get(key);
    if (!tr) return [];
    return Array.from({ length: tr.len }, (_, k) => tr.get(k));
  }
  /** Hold a track as it is (while it is being rewound: nothing new is written, nothing expires). */
  freeze(key, on = true) { const tr = this.tracks.get(key); if (tr) tr.frozen = on; }
  clear(key) { this.tracks.delete(key); }
}

/**
 * Going back along a path (newest first), at the pace it was recorded (`rate` samples a second, times
 * `speed`): step(dt, out) puts the point for now in `out` and says the yaw, and whether the oldest end
 * was reached. `left` is the seconds still to go.
 */
export class Rewind {
  constructor(path, { rate = HISTORY.rate, speed = 1 } = {}) {
    this.path = path; this.rate = rate; this.speed = speed; this.f = 0;
    this.vel = new THREE.Vector3(); this._prev = new THREE.Vector3();
    if (path.length) this._prev.copy(path[0].pos);
  }
  get done() { return this.f >= this.path.length - 1; }
  get left() { return Math.max(0, this.path.length - 1 - this.f) / (this.rate * this.speed); }
  /** The point `ahead` seconds further back from now (for drawing what is left). */
  at(f, out) {
    const P = this.path, n = P.length;
    if (!n) return out;
    const c = THREE.MathUtils.clamp(f, 0, n - 1), i = Math.min(n - 2, Math.floor(c)), u = c - i;
    if (n === 1) return out.copy(P[0].pos);
    return out.lerpVectors(P[i].pos, P[i + 1].pos, u);
  }
  yawAt(f) {
    const P = this.path, n = P.length;
    if (n < 2) return P[0]?.yaw ?? 0;
    const c = THREE.MathUtils.clamp(f, 0, n - 1), i = Math.min(n - 2, Math.floor(c)), u = c - i;
    const a = P[i].yaw, d = Math.atan2(Math.sin(P[i + 1].yaw - a), Math.cos(P[i + 1].yaw - a));
    return a + d * u;
  }
  step(dt, out) {
    this.f = Math.min(this.path.length - 1, this.f + dt * this.rate * this.speed);
    this.at(this.f, out);
    if (dt > 0) this.vel.subVectors(out, this._prev).divideScalar(dt);
    this._prev.copy(out);
    return { done: this.done, yaw: this.yawAt(this.f) };
  }
}
