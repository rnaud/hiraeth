import * as THREE from 'three';

// Loose chains for secondary motion (docs/systems/procedural-animation.md, "Secondary motion: springs, chains,
// waves"): a tail, a trail of smoke, a cable. A minimal piece of the kit's phase 4, enough for the first
// archetypes' tails (the horn lizard's curl, the antler hound's smoke).
//
// VerletChain: a pinned root and n points joined by fixed lengths. Each frame the points keep their momentum
// (damped), sag a little (gravity), are pulled toward a rest shape (stiffness: 0 hangs like rope, 1 holds the
// rest shape like a whip), then the lengths are enforced from the root out (follow-the-leader passes). Pure
// math over THREE.Vector3, no scene; tested in tests/archetypes.test.js.
//
//   const c = new VerletChain({ n: 6, length: 0.25, stiffness: 0.4 })
//   c.update(dt, root, restDir)     root: the pinned point (world); restDir: where the chain points at rest
//   c.points                        the joints, root first

const _d = new THREE.Vector3(), _rest = new THREE.Vector3(), _v = new THREE.Vector3();

export class VerletChain {
  constructor({ n = 5, length = 0.2, stiffness = 0.3, damping = 0.86, gravity = 2, curl = 0 } = {}) {
    this.n = n; this.length = length; this.stiffness = stiffness; this.damping = damping; this.gravity = gravity;
    this.curl = curl;   // (rad per link the rest shape turns up: a lizard's curled tail)
    this.points = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.prev = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.ready = false;
  }

  /** Lay the chain out along its rest shape from `root` (no motion). */
  reset(root, dir) {
    this.rest(root, dir, (i, p) => { this.points[i].copy(p); this.prev[i].copy(p); });
    this.ready = true;
  }

  /** The rest shape: from root along dir, each link turned `curl` further up (in the plane of dir and up). */
  rest(root, dir, fn) {
    _d.copy(dir).normalize();
    const flat = Math.hypot(_d.x, _d.z) || 1;
    let pitch = Math.atan2(_d.y, flat), yaw = Math.atan2(_d.x, _d.z);
    _rest.copy(root);
    fn(0, _rest);
    for (let i = 1; i <= this.n; i++) {
      pitch += this.curl;
      _rest.x += Math.sin(yaw) * Math.cos(pitch) * this.length;
      _rest.z += Math.cos(yaw) * Math.cos(pitch) * this.length;
      _rest.y += Math.sin(pitch) * this.length;
      fn(i, _rest);
    }
  }

  /** One step: the root pinned at `root`, the rest shape along `dir`; `stiffness` may be overridden (a tail held rigid). */
  update(dt, root, dir, stiffness = this.stiffness) {
    if (!this.ready || !(dt > 0)) { this.reset(root, dir); return this.points; }
    const P = this.points, Q = this.prev, h = Math.min(dt, 1 / 30);
    // momentum, gravity
    for (let i = 1; i <= this.n; i++) {
      _v.subVectors(P[i], Q[i]).multiplyScalar(this.damping);
      Q[i].copy(P[i]);
      P[i].add(_v);
      P[i].y -= this.gravity * h * h;
    }
    // toward the rest shape (a share each frame, scaled to stay alike at any frame rate)
    const k = 1 - Math.pow(1 - Math.min(0.99, stiffness), h * 60);
    this.rest(root, dir, (i, p) => { if (i > 0) P[i].lerp(p, k); });
    // lengths, root out
    P[0].copy(root); Q[0].copy(root);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i <= this.n; i++) {
        _d.subVectors(P[i], P[i - 1]);
        const l = _d.length() || 1e-9;
        P[i].copy(P[i - 1]).addScaledVector(_d, this.length / l);
      }
    }
    return P;
  }
}

// ------------------------------------------------------------------------------------------------------------
// Phase 4 of the kit (docs/systems/procedural-animation.md §5 "Chains"): the chains the enemy roster's batch 2
// rides on (the mound worm, the sky ray, the signal moth, the ring centipede, the lantern jelly).
//
// PathTrail: the leader's path, kept as a polyline (newest first) with points every `spacing` m, up to `length` m
// behind it. at(s) is the point s m back along it: a body whose segments sit at fixed arc lengths follows the
// head's path exactly (a centipede, a worm's mounds: nothing slides sideways, by construction). seed() lays out a
// rest shape behind the head (a coil, a crescent) for it to unroll from.
//
//   const t = new PathTrail({ spacing: 0.08, length: 6 })
//   t.update(head)                    the head's world position, each frame
//   t.at(s, out[, dir])               the point s m behind the head (dir: the path's heading there, unit, toward the head)
//   t.travelled                       how far the head has gone (m): the clock a metachronal wave runs on

export class PathTrail {
  constructor({ spacing = 0.08, length = 6 } = {}) {
    this.spacing = spacing; this.length = length;
    this.pts = [];            // (newest first; pts[0] is the head)
    this.travelled = 0;
  }
  /** Lay the path out: from the head back along `shape(s) → {x, z}` (s m behind the head), at the head's height. */
  seed(head, shape) {
    this.pts = [];
    for (let s = 0; s <= this.length + this.spacing; s += this.spacing) { const p = shape(s); this.pts.push(new THREE.Vector3(p.x, head.y, p.z)); }
    this.pts[0].copy(head);
  }
  update(head) {
    const P = this.pts;
    if (!P.length) { P.push(head.clone(), head.clone()); return; }
    const d = head.distanceTo(P[0]);
    if (d > 2.5) { this.seed(head, () => head); return; }   // (a teleport: start the path again here)
    this.travelled += d;
    // the head moves; a new point is laid down once the newest is a spacing behind it
    if (P.length > 1 && P[1].distanceTo(head) < this.spacing) P[0].copy(head);
    else P.unshift(head.clone());
    // (drop what is past the length)
    let s = 0;
    for (let i = 1; i < P.length; i++) { s += P[i].distanceTo(P[i - 1]); if (s > this.length + this.spacing) { P.length = i + 1; break; } }
  }
  /** The point s m behind the head along the path (past its end: on along the last link). */
  at(s, out, dir = null) {
    const P = this.pts;
    if (P.length < 2) { out.copy(P[0] ?? out); if (dir) dir.set(0, 0, 1); return out; }
    let left = s;
    for (let i = 1; i < P.length; i++) {
      const l = P[i].distanceTo(P[i - 1]);
      if (left <= l || i === P.length - 1) {
        const u = l > 1e-9 ? Math.min(left / l, i === P.length - 1 ? Infinity : 1) : 0;
        out.lerpVectors(P[i - 1], P[i], u);
        if (dir) { dir.subVectors(P[i - 1], P[i]); const n = dir.length(); if (n > 1e-9) dir.divideScalar(n); else dir.set(0, 0, 1); }
        return out;
      }
      left -= l;
    }
    return out;
  }
}

/**
 * FollowChain: follow-the-leader with angle limits (argonaut's). Each point is pulled to `length` behind the one
 * before it, the bend at each joint clamped to `maxBend` rad. One pass from the head, no integration: a tail, a
 * whip, a spine that drags behind whatever leads it (the sky ray's tail).
 *   const c = new FollowChain({ n: 8, length: 0.2, maxBend: 0.5 }); c.update(head, back)   back: the rest direction
 */
export class FollowChain {
  constructor({ n = 6, length = 0.2, maxBend = 0.6, straighten = 0 } = {}) {
    this.n = n; this.length = length; this.maxBend = maxBend; this.straighten = straighten;
    this.points = Array.from({ length: n + 1 }, () => new THREE.Vector3());
    this.ready = false;
  }
  reset(head, back) {
    _d.copy(back).normalize();
    for (let i = 0; i <= this.n; i++) this.points[i].copy(head).addScaledVector(_d, i * this.length);
    this.ready = true;
  }
  /** head: the leading point (world); back: where the chain points at rest (the first link is bent from it at most maxBend). */
  update(head, back, dt = 1 / 60) {
    if (!this.ready) { this.reset(head, back); return this.points; }
    const P = this.points;
    P[0].copy(head);
    _rest.copy(back).normalize();   // (the direction the previous link took)
    const k = this.straighten > 0 ? 1 - Math.exp(-this.straighten * dt) : 0;
    for (let i = 1; i <= this.n; i++) {
      _d.subVectors(P[i], P[i - 1]);
      let l = _d.length();
      if (l < 1e-9) { _d.copy(_rest); l = 1; }
      _d.divideScalar(l);
      if (k > 0) _d.lerp(_rest, k).normalize();   // (a little back toward straight: a whip settles)
      // the angle limit: no sharper than maxBend from the link before
      const cos = Math.max(-1, Math.min(1, _d.dot(_rest)));
      if (Math.acos(cos) > this.maxBend) {
        _v.copy(_d).addScaledVector(_rest, -cos);
        if (_v.lengthSq() < 1e-12) _v.set(-_rest.z, 0, _rest.x);
        _v.normalize();
        _d.copy(_rest).multiplyScalar(Math.cos(this.maxBend)).addScaledVector(_v, Math.sin(this.maxBend));
      }
      P[i].copy(P[i - 1]).addScaledVector(_d, this.length);
      _rest.copy(_d);
    }
    return P;
  }
}

/**
 * A travelling wave on a phase accumulator (docs/systems/procedural-animation.md, "Travelling waves"): the rate
 * (cycles a second) may change any frame and the motion never jumps, since only the phase accumulates.
 * angle(i) = amp · sin(2π·phase − i·lag): joint i down the chain trails the root by `lag` rad (a wing's tip
 * behind its root, a thread behind the bell).
 *   const w = new Wave(); w.update(dt, rate); w.angle(i, amp, lag)
 */
export class Wave {
  constructor(phase = 0) { this.phase = phase; this.cycles = 0; }
  update(dt, rate) { const p = this.phase + Math.max(0, rate) * dt; this.cycles += Math.floor(p); this.phase = p - Math.floor(p); return this.phase; }
  angle(i, amp, lag) { return amp * Math.sin(2 * Math.PI * this.phase - i * lag); }
}
