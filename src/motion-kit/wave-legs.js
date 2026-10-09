import * as THREE from 'three';

// Metachronal legs (docs/systems/procedural-animation.md §4, plan 3 "Crawler / centipede"): many short legs, one pair
// per body segment, stepping in a wave that runs down the body. Each leg's phase is the distance its own segment has
// travelled along the path (PathTrail's arc length), divided by the stride, plus an offset that grows down the body
// (−i·lag) and a half cycle between the left and the right leg of a segment:
//
//   phase < duty   stance: the foot stays where it landed (planted in the world)
//   phase ≥ duty   swing: from where it lifted to a spot half a stance ahead of its rest spot, on an arc
//
// The phase runs on distance, never on a clock, so the cadence follows the speed, a body standing still keeps
// every foot down, and a foot can't slide (it lands where the stance will carry it back past). One ground ray per
// step, at touchdown. Pure maths over THREE.Vector3 (tests/motion-chains.test.js).
//
//   const L = new WaveLegs({ n, stride, duty, height, lag })
//   L.update(i, s, rest, fwd, ground)   leg i: s its segment's arc length (m), rest its rest foot (world), fwd the
//                                       segment's heading (unit, world); ground(x, y, z) → y or null
//   L.feet[i].pos                       where foot i is (world)

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export class WaveLegs {
  /** n legs; leg i is pair Math.floor(i / 2), side i % 2. lag: rad of the wave between one pair and the next. */
  constructor({ n = 24, stride = 0.5, duty = 0.65, height = 0.12, lag = 0.55, seed = Math.random() } = {}) {
    this.stride = stride; this.duty = duty; this.height = height; this.lag = lag;
    this.feet = Array.from({ length: n }, (_, i) => ({
      pos: new THREE.Vector3(), from: new THREE.Vector3(), planted: true, ready: false,
      off: (seed + (Math.floor(i / 2) * lag) / (2 * Math.PI) + (i % 2) * 0.5) % 1,   // (the wave down the body; left against right)
      phase: 0, steps: 0,
    }));
    this.touches = [];   // (this frame's touchdowns: { leg, at })
  }
  /** The phase of a leg whose segment has travelled s m. */
  phaseOf(i, s) { const p = s / this.stride + this.feet[i].off; return p - Math.floor(p); }

  update(i, s, rest, fwd, ground = null) {
    const F = this.feet[i], ph = this.phaseOf(i, s);
    if (!F.ready) { F.pos.copy(rest); F.phase = ph; F.ready = true; F.planted = ph < this.duty; F.from.copy(rest); return F.pos; }
    const was = F.phase;
    F.phase = ph;
    const swing = ph >= this.duty;
    if (swing) {
      if (F.planted || ph < was) { F.from.copy(F.pos); F.planted = false; }   // (it lifts where it stood)
      const u = (ph - this.duty) / (1 - this.duty), k = smoother(u);
      // the landing: half a stance ahead of its rest spot (so the stance carries it back as far behind)
      const ahead = this.stride * this.duty * 0.5;
      _to.copy(rest).addScaledVector(fwd, ahead);
      F.pos.lerpVectors(F.from, _to, k);
      F.pos.y = THREE.MathUtils.lerp(F.from.y, rest.y, k) + Math.sin(Math.PI * u) * this.height;
    } else if (!F.planted) {
      // touchdown: on the ground under where the swing brought it (one ray)
      // (where the swing left it, all but there: no snap, so nothing slides in the last frame)
      const y = ground?.(F.pos.x, F.pos.y + 0.6, F.pos.z);
      F.pos.y = Number.isFinite(y) ? y : rest.y;
      F.planted = true; F.steps++;
      this.touches.push({ leg: i, at: F.pos });
    }
    return F.pos;
  }
}
const _to = new THREE.Vector3();
