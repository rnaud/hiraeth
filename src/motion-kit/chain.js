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
