import * as THREE from 'three';

// A ragdoll for the people's skeleton (src/humanoid.js): fifteen joint
// particles (pelvis, chest, head, hips, knees, ankles, shoulders, elbows,
// wrists) moved by position-based dynamics. The trunk (pelvis, chest, hips,
// shoulders) is held rigid, the limbs by their bone lengths, with a few limits
// so it falls like a body and not a string of beads: knees only bend forward,
// thighs don't swing far behind the hips, the head stays on top of the neck,
// elbows and knees never fold flat. Every particle lands on the ground under it
// (one ray each per sub-step, physics.heightAbove, so any "up" works), and the
// trunk is pushed out of walls as a capsule. Cheap: ~30 rays and a capsule cast
// a frame.
//
// It drives a Humanoid by aiming its bones at the particles (apply), and blends
// between any two poses (snapshot, blend): from the animated pose into the
// limp one as it starts, and from lying there back into the get-up.

export const RAG = {
  gravity: 32,       // m/s² (the player's)
  sub: 1 / 90,       // longest sub-step (s)
  iters: 4,          // constraint passes per sub-step
  drag: 0.35,        // air drag (1/s)
  slide: 7,          // ground friction: sliding dies away at this rate (1/s)
  grip: 12,          // ... and loses at least this much speed (m/s²): a slow slide stops
  bounce: 0.12,      // what a hard landing gives back
  still: 0.55,       // m/s: slower than this everywhere counts as lying still
  stillFor: 0.35,    // s of that before it is settled
};

// [name, bone, radius (m), mass]
export const JOINTS = [
  ['pelvis', 'pelvis', 0.14, 3], ['chest', 'spine_03', 0.15, 3], ['head', 'Head', 0.12, 1.2],
  ['hipL', 'thigh_l', 0.09, 1.5], ['hipR', 'thigh_r', 0.09, 1.5],
  ['kneeL', 'calf_l', 0.07, 1], ['kneeR', 'calf_r', 0.07, 1],
  ['footL', 'foot_l', 0.08, 0.6], ['footR', 'foot_r', 0.08, 0.6],
  ['shL', 'upperarm_l', 0.07, 1], ['shR', 'upperarm_r', 0.07, 1],
  ['elL', 'lowerarm_l', 0.06, 0.6], ['elR', 'lowerarm_r', 0.06, 0.6],
  ['haL', 'hand_l', 0.05, 0.4], ['haR', 'hand_r', 0.05, 0.4],
];
export const J = Object.fromEntries(JOINTS.map(([n], i) => [n, i]));
const N = JOINTS.length;
const TRUNK = [J.pelvis, J.chest, J.hipL, J.hipR, J.shL, J.shR];
const LIMBS = [[J.hipL, J.kneeL], [J.kneeL, J.footL], [J.hipR, J.kneeR], [J.kneeR, J.footR],
  [J.shL, J.elL], [J.elL, J.haL], [J.shR, J.elR], [J.elR, J.haR], [J.chest, J.head]];
// soft: the head eases back to its rest place over the shoulders (a neck, not a hinge)
const SOFT = [[J.shL, J.head, 0.15], [J.shR, J.head, 0.15]];
const LEGS = [[J.hipL, J.kneeL, J.footL], [J.hipR, J.kneeR, J.footR]];
const ARMS = [[J.shL, J.elL, J.haL], [J.shR, J.elR, J.haR]];

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _K = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _f1 = new THREE.Vector3(), _f2 = new THREE.Vector3(), _p = new THREE.Vector3(), _push = new THREE.Vector3();

/** The trunk's frame (left = +x, up = +y, forward = +z) from hips, pelvis and chest, as a quaternion. */
export function trunkFrame(hipL, hipR, pelvis, chest, out = new THREE.Quaternion()) {
  _X.subVectors(hipL, hipR).normalize();
  _Y.subVectors(chest, pelvis);
  _Y.addScaledVector(_X, -_Y.dot(_X)).normalize();
  _Z.crossVectors(_X, _Y);
  return out.setFromRotationMatrix(_m.makeBasis(_X, _Y, _Z));
}

export class Ragdoll {
  constructor() {
    this.x = Array.from({ length: N }, () => new THREE.Vector3());
    this.v = Array.from({ length: N }, () => new THREE.Vector3());
    this.prev = Array.from({ length: N }, () => new THREE.Vector3());
    this.floor = new Float64Array(N);      // the ground level under each (along up) this sub-step
    this.contact = new Uint8Array(N);
    this.w = JOINTS.map(([, , , m]) => 1 / m);
    this.r = JOINTS.map(([, , r]) => r);
    this.links = [];                       // [i, j, length, stiffness]
    this.t = 0;
    this.stillT = 0;
    this.speed = 0;                        // the fastest particle (m/s)
  }

  /**
   * Start from world points (one per JOINTS entry) moving at `vel` (Vector3 or one per joint).
   * `rest` (optional points, same order) gives the trunk's shape; it defaults to `points`.
   * `scale` sizes the particles (a child is smaller); `radii` (m, one per JOINTS entry, before the
   * scale) a body's own (Humanoid.ragdollRadii: a heavy body lies on a fuller trunk).
   */
  start(points, vel, { rest = points, scale = 1, radii = null } = {}) {
    for (let i = 0; i < N; i++) {
      this.x[i].copy(points[i]);
      this.prev[i].copy(points[i]);
      this.v[i].copy(Array.isArray(vel) ? vel[i] : vel);
      this.r[i] = (radii?.[i] ?? JOINTS[i][2]) * scale;
    }
    this.links.length = 0;
    for (let a = 0; a < TRUNK.length; a++) for (let b = a + 1; b < TRUNK.length; b++) {
      const i = TRUNK[a], j = TRUNK[b];
      this.links.push([i, j, rest[i].distanceTo(rest[j]), 1]);
    }
    for (const [i, j] of LIMBS) this.links.push([i, j, points[i].distanceTo(points[j]), 1]);
    for (const [i, j, k] of SOFT) this.links.push([i, j, rest[i].distanceTo(rest[j]), k]);
    this.legLen = LEGS.map(([a, b, c]) => points[a].distanceTo(points[b]) + points[b].distanceTo(points[c]));
    this.armLen = ARMS.map(([a, b, c]) => points[a].distanceTo(points[b]) + points[b].distanceTo(points[c]));
    this.scale = scale;
    this.t = 0; this.stillT = 0; this.speed = 0;
    return this;
  }

  /** Start from a Humanoid's pose this frame (its bones in world space). */
  startFrom(H, vel, opts = {}) {
    const pts = JOINTS.map(([, bone]) => H.b[bone].getWorldPosition(new THREE.Vector3()));
    // the trunk's shape from the rest pose (the clip may have the back bent), placed on the hips
    const root = H.char.root, s = root.scale.x;
    const restQ = trunkFrame(...[J.hipL, J.hipR, J.pelvis, J.chest].map((i) => H.rest.get(H.b[JOINTS[i][1]]).p), _q2);
    const nowQ = trunkFrame(pts[J.hipL], pts[J.hipR], pts[J.pelvis], pts[J.chest], _q).multiply(restQ.invert());
    const pr = H.rest.get(H.b.pelvis).p;
    const rest = JOINTS.map(([, bone], i) => TRUNK.includes(i)
      ? H.rest.get(H.b[bone]).p.clone().sub(pr).multiplyScalar(s).applyQuaternion(nowQ).add(pts[J.pelvis]) : pts[i]);
    return this.start(pts, vel, { scale: s, radii: H.ragdollRadii?.() ?? null, ...opts, rest });
  }

  /** Lying still a moment (nothing moving faster than RAG.still for RAG.stillFor s). */
  get settled() { return this.stillT >= RAG.stillFor; }

  /** One frame of simulation. `physics`: heightAbove(pos, up, step), optional pushCapsule. */
  step(dt, physics, up) {
    if (!(dt > 0)) return;
    const n = Math.min(6, Math.ceil(dt / RAG.sub)), h = dt / n;
    const x = this.x, v = this.v, prev = this.prev, w = this.w;
    for (let s = 0; s < n; s++) {
      const drag = Math.exp(-RAG.drag * h);
      for (let i = 0; i < N; i++) {
        v[i].addScaledVector(up, -RAG.gravity * h).multiplyScalar(drag);
        prev[i].copy(x[i]);
        x[i].addScaledVector(v[i], h);
        // the ground under it: a ray from where it was (so nothing overhead counts as ground)
        const drop = Math.max(0, _a.subVectors(prev[i], x[i]).dot(up));
        const hgt = physics.heightAbove(x[i], up, drop + this.r[i] + 0.05);
        this.floor[i] = Number.isFinite(hgt) ? x[i].dot(up) - hgt : -Infinity;
        this.contact[i] = 0;
      }
      for (let it = 0; it < RAG.iters; it++) {
        for (const [i, j, len, k] of this.links) {
          const d = _a.subVectors(x[j], x[i]), L = d.length();
          if (L < 1e-6) continue;
          const c = ((L - len) / L) * k / (w[i] + w[j]);
          x[i].addScaledVector(d, c * w[i]);
          x[j].addScaledVector(d, -c * w[j]);
        }
        this.limits(up);
        for (let i = 0; i < N; i++) {
          const pen = this.floor[i] + this.r[i] - x[i].dot(up);
          if (pen > 0) { x[i].addScaledVector(up, pen); this.contact[i] = 1; }
        }
      }
      // walls: the trunk as a capsule, pelvis to head (once a frame, on the last sub-step)
      let pushed = null;
      if (s === n - 1 && physics.pushCapsule) {
        const axis = _b.subVectors(x[J.head], x[J.pelvis]), len = axis.length();
        if (len > 1e-3) {
          axis.divideScalar(len);
          // (thinner than the trunk's particles, so on a floor they touch it first and take its friction)
          const r = 0.11 * this.scale;
          const p = _p.copy(x[J.pelvis]);
          const push = physics.pushCapsule(p, r, -r, len + r, _push, axis);
          if (push && push.lengthSq() > 1e-8) {
            for (let i = 0; i < N; i++) x[i].add(push);
            pushed = _c.copy(push).normalize();
            if (pushed.dot(up) > 0.5) for (const i of TRUNK) this.contact[i] = 1;   // lifted off a floor: that is lying on it
          }
        }
      }
      let fastest = 0;
      for (let i = 0; i < N; i++) {
        const vi = v[i].subVectors(x[i], prev[i]).divideScalar(h);
        if (pushed) { const out = vi.dot(pushed); if (out > 0) vi.addScaledVector(pushed, -out * 0.8); }
        if (this.contact[i]) {
          // friction: sliding dies away, and a slow slide stops (it holds on a slope up to ~20°)
          const vn = vi.dot(up);
          const vt = _d.copy(vi).addScaledVector(up, -vn), st = vt.length();
          const lose = Math.max(st * (1 - Math.exp(-RAG.slide * h)), RAG.grip * h);
          vt.multiplyScalar(st > lose ? (st - lose) / st : 0);
          vi.copy(vt).addScaledVector(up, Math.max(vn, 0) * (vn > 2 ? RAG.bounce : 1));
        }
        fastest = Math.max(fastest, vi.lengthSq());
      }
      this.speed = Math.sqrt(fastest);
    }
    this.t += dt;
    this.stillT = this.speed < RAG.still ? this.stillT + dt : 0;
  }

  /** The joint limits (position corrections, inside the solver loop). */
  limits(up) {
    const x = this.x;
    const L = _X.subVectors(x[J.hipL], x[J.hipR]).normalize();      // the body's left
    const U = _Y.subVectors(x[J.chest], x[J.pelvis]);
    U.addScaledVector(L, -U.dot(L)).normalize();                     // the trunk's up
    const F = _Z.crossVectors(L, U);                                 // its front
    LEGS.forEach(([a, b, c], k) => {
      // the knee bends forward only: in front of the hip-ankle line, in the leg's own plane
      const D = _a.subVectors(x[c], x[a]);
      const span = D.length();
      if (span > 1e-4) {
        D.divideScalar(span);
        const K = _K.crossVectors(D, L);
        if (K.lengthSq() > 1e-6) {
          K.normalize();
          const mid = _b.addVectors(x[a], x[c]).multiplyScalar(0.5);
          const off = _c.subVectors(x[b], mid);
          const fwd = off.dot(K), min = 0.02 * this.scale;
          if (fwd < min) x[b].addScaledVector(K, min - fwd);
          const side = _d.crossVectors(K, D);
          x[b].addScaledVector(side, -off.dot(side) * 0.5);
        }
      }
      // no folding flat (heel to the hip at most this close)
      this.minSpan(a, c, this.legLen[k] * 0.32);
      // the thigh doesn't swing far behind the hip
      const th = _a.subVectors(x[b], x[a]), tl = th.length();
      if (tl > 1e-4) {
        const back = th.dot(F) / tl;
        if (back < -0.4) { x[b].addScaledVector(F, (-0.4 - back) * tl); }
      }
    });
    ARMS.forEach(([a, , c], k) => this.minSpan(a, c, this.armLen[k] * 0.3));
    // the head on top of the neck, not hanging behind or beside the chest
    const hd = _a.subVectors(x[J.head], x[J.chest]), hl = hd.length();
    if (hl > 1e-4) {
      const k = hd.dot(U) / hl;
      if (k < 0.55) x[J.head].addScaledVector(U, (0.55 - k) * hl);
    }
  }

  minSpan(a, c, min) {
    const x = this.x, d = _a.subVectors(x[c], x[a]), L = d.length();
    if (L >= min || L < 1e-6) return;
    const k = ((min - L) / L) / (this.w[a] + this.w[c]);
    x[a].addScaledVector(d, -k * this.w[a]);
    x[c].addScaledVector(d, k * this.w[c]);
  }

  /** The pelvis particle (the camera follows it). */
  get pelvis() { return this.x[J.pelvis]; }

  /** Where the body lies: the ground under the pelvis (along up), into out. */
  groundSpot(physics, up, out = new THREE.Vector3()) {
    const p = this.x[J.pelvis];
    const h = physics.heightAbove(p, up, 0.3);
    return out.copy(p).addScaledVector(up, -(Number.isFinite(h) ? Math.min(h, 2) : 0));
  }

  /**
   * Which way to face getting up (a unit vector in the ground plane): lying on
   * the back you sit up toward the feet, face down you push up toward the head.
   */
  riseDir(up, out = new THREE.Vector3()) {
    const x = this.x;
    const L = _X.subVectors(x[J.hipL], x[J.hipR]).normalize();
    const U = _Y.subVectors(x[J.chest], x[J.pelvis]).normalize();
    const F = _Z.crossVectors(L, U);
    const facing = F.dot(up);                       // > 0: on the back
    out.copy(F).addScaledVector(up, -facing);
    const along = _a.copy(U).addScaledVector(up, -U.dot(up));
    out.addScaledVector(along, -facing * 1.5);
    if (out.lengthSq() < 1e-6) out.copy(along);
    if (out.lengthSq() < 1e-6) out.set(0, 0, 1).addScaledVector(up, -up.z);
    return out.normalize();
  }

  // ------------------------------------------------------------- the pose
  /** Rest data for a Humanoid (cached on it): each bone's local rest rotation, the pelvis's rest place. */
  static restOf(H) {
    if (H._ragRest) return H._ragRest;
    const root = H.char.root;
    root.updateMatrixWorld(true);
    const local = H.order.map((bone) => {
      const r = H.rest.get(bone), pq = bone.parent?.isBone ? H.rest.get(bone.parent).q : _q.identity();
      return _q2.copy(pq).invert().multiply(r.q).clone();
    });
    const pelvis = H.b.pelvis;
    const parentChar = _m.copy(root.matrixWorld).invert().multiply(pelvis.parent.matrixWorld);
    const pelvisLocal = H.rest.get(pelvis).p.clone().applyMatrix4(_m2.copy(parentChar).invert());
    const p = (n) => H.rest.get(H.b[n]).p;
    const trunk = trunkFrame(p('thigh_l'), p('thigh_r'), p('pelvis'), p('spine_03'), new THREE.Quaternion()).invert();
    return (H._ragRest = { local, pelvisLocal, trunk });
  }

  /**
   * Pose a Humanoid on the particles: the whole body turned with the trunk
   * (its root moved so the pelvis sits on its particle), then neck, legs and
   * arms aimed along their segments.
   */
  apply(H) {
    const R = Ragdoll.restOf(H), B = H.b, root = H.char.root, x = this.x;
    H.order.forEach((bone, i) => bone.quaternion.copy(R.local[i]));
    B.pelvis.position.copy(R.pelvisLocal);
    trunkFrame(x[J.hipL], x[J.hipR], x[J.pelvis], x[J.chest], root.quaternion).multiply(R.trunk);
    const pr = H.rest.get(B.pelvis).p;
    root.position.copy(x[J.pelvis]).sub(_a.copy(pr).multiply(root.scale).applyQuaternion(root.quaternion));
    root.updateMatrixWorld(true);
    const aim = (bone, child, target) => {
      const from = child.getWorldPosition(_f1).sub(bone.getWorldPosition(_f2));
      H.turnBone(bone, from, _d.subVectors(target, _f2));
    };
    if (B.neck_01) aim(B.neck_01, B.Head, x[J.head]);
    for (const [s, hip, knee, foot] of [['l', J.hipL, J.kneeL, J.footL], ['r', J.hipR, J.kneeR, J.footR]]) {
      aim(B[`thigh_${s}`], B[`calf_${s}`], x[knee]);
      aim(B[`calf_${s}`], B[`foot_${s}`], x[foot]);
    }
    for (const [s, , el, ha] of [['l', J.shL, J.elL, J.haL], ['r', J.shR, J.elR, J.haR]]) {
      aim(B[`upperarm_${s}`], B[`lowerarm_${s}`], x[el]);
      aim(B[`lowerarm_${s}`], B[`hand_${s}`], x[ha]);
    }
  }

  // ------------------------------------------------------------- blending
  /** Remember a Humanoid's pose as it is now (to blend away from it). */
  snapshot(H) {
    const root = H.char.root;
    const S = (this.snap ??= { q: [], pelvis: new THREE.Vector3(), pelvisWorld: new THREE.Vector3(), rootQ: new THREE.Quaternion() });
    H.order.forEach((bone, i) => (S.q[i] ??= new THREE.Quaternion()).copy(bone.quaternion));
    S.pelvis.copy(H.b.pelvis.position);
    S.rootQ.copy(root.quaternion);
    root.updateMatrixWorld(true);
    H.b.pelvis.getWorldPosition(S.pelvisWorld);
    return S;
  }

  /**
   * Blend from the snapshot to the pose the Humanoid has now, by w (0: the
   * snapshot, 1: now). The pelvis travels in a straight line between the two
   * (lifted by `lift` m along up at the middle); everything else turns.
   */
  blend(H, w, { up = null, lift = 0 } = {}) {
    const S = this.snap;
    if (!S || w >= 1) return;
    const root = H.char.root, pelvis = H.b.pelvis;
    root.updateMatrixWorld(true);
    const want = pelvis.getWorldPosition(_b).sub(S.pelvisWorld).multiplyScalar(w).add(S.pelvisWorld);
    if (up && lift) want.addScaledVector(up, lift * Math.sin(Math.PI * w));
    root.quaternion.slerpQuaternions(S.rootQ, _q.copy(root.quaternion), w);
    H.order.forEach((bone, i) => bone.quaternion.slerpQuaternions(S.q[i], _q.copy(bone.quaternion), w));
    pelvis.position.lerpVectors(S.pelvis, _a.copy(pelvis.position), w);
    root.updateMatrixWorld(true);
    root.position.add(want.sub(pelvis.getWorldPosition(_a)));
    root.updateMatrixWorld(true);
  }
}

// the topple (JOINTS order): how much of the tip-over each joint gets, and of the sideways lean
const TOPPLE = [0.3, 1, 1.25, 0.3, 0.3, 0, 0, -0.4, -0.4, 1, 1, 1.1, 1.1, 1.2, 1.2];
const TOPPLE_SIDE = [0, 0.6, 0.8, 0, 0, 0, 0, -0.3, -0.3, 0.6, 0.6, 0.8, 0.8, 1, 1];

/**
 * Starting velocities for a body knocked over toward `dir` (unit, in the
 * ground plane): all of it moving at `carry` along dir and `rise` along up,
 * the top tipping over that way at `tip` m/s more than the feet, leaning a
 * little to one side by `twist` (-1..1). One Vector3 per joint.
 */
export function toppleVelocities(dir, up, { carry = 0, rise = 0, tip = 2.6, twist = Math.random() * 2 - 1 } = {}) {
  const side = _a.crossVectors(dir, up);
  return TOPPLE.map((k, i) => new THREE.Vector3().copy(dir).multiplyScalar(carry + k * tip)
    .addScaledVector(up, rise).addScaledVector(side, TOPPLE_SIDE[i] * twist * 1.5));
}

/**
 * The whole of being knocked down, for anyone with a Humanoid: the limp fall
 * (blending in from the pose they had), lying a moment, and the get-up (a
 * blend from lying there into a kneel that rises to standing). The owner poses
 * the standing body each frame of the rise and calls rise() after it.
 *   phase 'fall' -> 'lie' -> 'rise' -> done; `dead` stays at 'lie'.
 */
/** A push knocks someone over (rather than a stumble) from this strength (1 point-blank .. 0 at the cone's reach, src/npc.js, src/crowd.js); at most `most` bodies down at once. */
export const KNOCKOVER = { strength: 0.3, most: 4 };

export const KNOCK = { blendIn: 0.12, lie: 0.7, rise: 1.25, maxFall: 3.5 };

export class Knockdown {
  constructor(H, { dead = false, lie = KNOCK.lie } = {}) {
    this.H = H;
    this.rag = new Ragdoll();
    this.phase = 'fall';
    this.t = 0;              // time in this phase
    this.age = 0;            // since it began
    this.dead = dead;
    this.lie = lie;
  }

  /** Begin from the Humanoid's pose this frame, moving at vel (per-joint velocities allowed). */
  start(vel) {
    if (this.H) { this.rag.startFrom(this.H, vel); this.rag.snapshot(this.H); }
    return this;
  }

  /**
   * One frame of the fall and the lying still: steps the ragdoll and poses the body.
   * Returns true once it is time to get up (call beginRise()).
   */
  update(dt, physics, up) {
    this.t += dt; this.age += dt;
    if (this.phase === 'fall') {
      if (this.H) {
        this.rag.step(dt, physics, up);
        this.rag.apply(this.H);
        if (this.t < KNOCK.blendIn) this.rag.blend(this.H, this.t / KNOCK.blendIn);
      }
      const done = !this.H || this.rag.settled || this.t > KNOCK.maxFall;
      if (done && this.t > 0.5) { this.phase = 'lie'; this.t = 0; }
      return false;
    }
    if (this.phase === 'lie') {
      if (this.H) this.rag.apply(this.H);
      return !this.dead && this.t >= this.lie;
    }
    return false;
  }

  /** Lying done: remember the pose to rise from. */
  beginRise() {
    this.phase = 'rise'; this.t = 0;
    if (this.H) this.rag.snapshot(this.H);
  }

  /** The rise's kneel (0..1) at its time: down on one knee first, then up to standing. */
  get kneel() {
    const k = this.t / KNOCK.rise;
    return 1 - THREE.MathUtils.smoothstep(k, 0.42, 1);
  }

  /**
   * During the rise, after the owner posed the standing body (with kneel()):
   * blends from lying into it. Returns true when standing again.
   */
  rise(dt, up) {
    this.t += dt; this.age += dt;
    const w = THREE.MathUtils.smoothstep(this.t / KNOCK.rise, 0, 0.45);
    if (this.H) this.rag.blend(this.H, w, { up, lift: 0.08 });
    return this.t >= KNOCK.rise;
  }
}
