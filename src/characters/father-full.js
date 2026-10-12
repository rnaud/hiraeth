import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFatherV1 } from './father-v1.js';

// The father in full (issue #26): the same generated model as the recordings' bust (src/characters/father-v1.js),
// uncut (public/characters/father-v1/full.glb: scripts/tripo/slim-father.mjs --full), made to walk. The bust's rig
// holds everything below the waist on the pelvis; here, at load, the lower body is weighted again:
//
//  - the legs below the coat's hem (trousers and boots) on their own bones, thigh, calf, foot and toes, blended
//    across the knee and the ankle (fatherLegWeights);
//  - the long coat's skirt, from the waist to its hem below the knee, on a ring of COAT.columns hanging chains of
//    two bones each, added under the pelvis (coatWeights, addCoatBones);
//  - the chains swung by a small simulation every frame (CoatSkirt): each chain's knee and hem points pulled
//    back to where the pelvis carries them, with momentum and damping, kept their length, trailing as he walks,
//    and pushed off the thighs and shins, so the coat swings with his stride and the knees press it forward.
//
//   const asset = await loadFatherFull(base)
//   const humanoid = createFatherFull(char, asset)   // humanoid.coat: the skirt; walk him with the Animator
//   humanoid.coat.update(dt, { velocity })            // after humanoid.update(): velocity (m/s, his own frame)

/** The coat's skirt (the fitted model's metres, feet at 0): its chains' joints, and the blends. */
export const COAT = {
  columns: 12,
  joints: [0.93, 0.68, 0.44],   // the chain's pivot at the waist, its knee, its hem end (y)
  waist: [0.86, 0.95],           // the pelvis lets go of the coat between these (y)
  knee: 0.06,                    // half the blend across the chain's knee (m)
  hem: 0.47,                     // below it, what is near a leg is the leg (the coat ends at ~0.42 m)
  below: [0.33, 0.39],           // and below these, everything is (the boots)
  legRadius: [0.105, 0.14],      // within the first of a leg's bones: leg; past the second: coat
  // the swing: spring back to the carried shape (1/s²), damping (1/s), the drag of walking (m/s² per m/s, the hem
  // twice the knee's), how much of a chain's swing its neighbours share each step, the legs' capsules (m, round the
  // thigh and the shin, with the coat's own thickness)
  stiffness: 70, damping: 5, drag: 1.6, share: 0.3, thigh: 0.1, shin: 0.085, step: 1 / 120,
};

let cached;
export function loadFatherFull(base = '/') {
  return cached ??= new GLTFLoader().loadAsync(`${base}characters/father-v1/full.glb`).catch((e) => { cached = null; throw e; });
}

const smooth = (a, b, x) => T.MathUtils.smoothstep(x, a, b);
const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _d = new T.Vector3(), _q = new T.Quaternion();

/** The leg chains in bind space: per side, the joints thigh, calf, foot, ball and a toe tip, and their bone names. */
export function legChains(bones) {
  const at = (n) => bones.find((b) => b.name === n).getWorldPosition(new T.Vector3());
  return ['l', 'r'].map((s) => {
    const pts = ['thigh', 'calf', 'foot', 'ball'].map((n) => at(`${n}_${s}`));
    pts.push(pts[3].clone().add(new T.Vector3(0, 0, 0.09)));   // (the toe's tip: the boot's front)
    return { side: s, pts, names: ['thigh', 'calf', 'foot', 'ball'].map((n) => `${n}_${s}`) };
  });
}

/** The nearest point of a chain to p: { d (m), j (segment), t (0..1 along it) }. */
function nearestOnChain(p, pts) {
  let best = null;
  for (let j = 0; j < pts.length - 1; j++) {
    const line = new T.Line3(pts[j], pts[j + 1]), t = line.closestPointToPointParameter(p, true);
    const d = line.at(t, _a).distanceTo(p);
    if (!best || d < best.d) best = { d, j, t, len: pts[j].distanceTo(pts[j + 1]) };
  }
  return best;
}

/**
 * A lower-body point's leg weights: { leg (0..1: how much of it is the leg, not the coat), w: Map bone name → weight }
 * (pure apart from three's maths). Each bone of the chain owns its segment, half and half at a joint, eased over
 * `blend` m either side (the knee and the ankle bend the trouser and the boot's cuff, not tear them).
 */
export function fatherLegWeights(p, chains, blend = 0.05) {
  const chain = p.x >= 0 ? chains[0] : chains[1];
  const n = nearestOnChain(p, chain.pts);
  const near = 1 - smooth(COAT.legRadius[0], COAT.legRadius[1], n.d);
  // (under the hem there is no coat: the boots' heels and toes stand further off the chain than the trousers)
  const leg = Math.max(near, 1 - smooth(COAT.below[0], COAT.below[1], p.y)) * (1 - smooth(COAT.hem - 0.03, COAT.hem + 0.05, p.y));
  const w = new Map(), add = (k, v) => { if (v > 0) w.set(chain.names[k], (w.get(chain.names[k]) ?? 0) + v); };
  const s = n.t * n.len, e = (1 - n.t) * n.len;   // (m from the segment's start, and to its end)
  const into = n.j > 0 ? 0.5 * (1 - smooth(0, blend, s)) : 0;                       // the previous bone, near the start
  const onto = n.j < chain.names.length - 1 ? 0.5 * (1 - smooth(0, blend, e)) : 0;  // the next, near the end
  add(n.j, 1 - into - onto);
  if (into) add(n.j - 1, into);
  if (onto) add(n.j + 1, onto);
  return { leg, w };
}

/** The coat's centre (x, z) and the column a direction falls in. */
export function coatFrame(points) {
  let x = 0, z = 0, n = 0;
  for (const p of points) if (p.y > 0.6 && p.y < 0.8) { x += p.x; z += p.z; n++; }
  return { cx: n ? x / n : 0, cz: n ? z / n : 0 };
}
const angleOf = (p, f) => { const a = Math.atan2(p.x - f.cx, p.z - f.cz); return a < 0 ? a + Math.PI * 2 : a; };

/**
 * A coat point's skirt weights: Map of [column, joint (0 the pivot's bone, 1 the knee's)] keys 'c:j' → weight, and
 * `pelvis` (what the waist keeps). Columns blend by the point's direction round the coat's centre, the two bones
 * across the chain's knee, the pelvis over the waist band.
 */
export function coatWeights(p, frame, K = COAT.columns) {
  const c = angleOf(p, frame) / (Math.PI * 2) * K, i0 = Math.floor(c) % K, i1 = (i0 + 1) % K, a = c - Math.floor(c);
  const lower = smooth(COAT.joints[1] + COAT.knee, COAT.joints[1] - COAT.knee, p.y);
  const pelvis = smooth(COAT.waist[0], COAT.waist[1], p.y);
  const w = new Map(), add = (k, v) => { if (v > 1e-4) w.set(k, (w.get(k) ?? 0) + v); };
  for (const [i, ka] of [[i0, 1 - a], [i1, a]]) { add(`${i}:0`, (1 - pelvis) * ka * (1 - lower)); add(`${i}:1`, (1 - pelvis) * ka * lower); }
  return { w, pelvis };
}

/** The chains' rest points (bind space): per column, the pivot, the knee and the hem end on the coat. */
export function coatRest(points, frame, K = COAT.columns) {
  const out = [];
  const coat = points.filter((p) => p.y < COAT.waist[1] + 0.05 && p.y > 0.3);
  const minY = Math.min(...coat.map((p) => p.y));
  for (let i = 0; i < K; i++) {
    const th = (i + 0.5) / K * Math.PI * 2, dir = new T.Vector3(Math.sin(th), 0, Math.cos(th));
    out.push(COAT.joints.map((h, k) => {
      const y = k === 2 ? Math.max(h, minY + 0.01) : h;
      let r = 0, n = 0;
      for (const p of coat) {
        if (Math.abs(p.y - y) > 0.03) continue;
        let da = Math.abs(angleOf(p, frame) - th); da = Math.min(da, Math.PI * 2 - da);
        if (da > Math.PI / K) continue;
        const rr = Math.hypot(p.x - frame.cx, p.z - frame.cz);
        if (rr > r * 0.98) { r = n ? Math.max(r, rr) : rr; } n++;
      }
      // (the outer surface: the furthest point, a little in, the chain inside the cloth it carries)
      return new T.Vector3(frame.cx, y, frame.cz).addScaledVector(dir, Math.max(0.08, r * 0.9));
    }));
  }
  return out;
}

/**
 * Weight the father's lower body again, for walking: the legs on their bones, the coat on its chains. `mesh` is
 * the Humanoid's body (its skeleton in the bind pose, the character at the origin). Returns the chain bones and
 * the rest points (bind space).
 */
export function rigFatherLowerBody(mesh) {
  const g = mesh.geometry, P = g.attributes.position, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight;
  const skeleton = mesh.skeleton, bones = skeleton.bones;
  skeleton.pose(); mesh.updateMatrixWorld(true);
  const index = new Map(bones.map((b, i) => [b.name, i]));
  const pelvis = bones[index.get('pelvis')];
  const chains = legChains(bones);
  const points = Array.from({ length: P.count }, (_, i) => new T.Vector3().fromBufferAttribute(P, i));
  const frame = coatFrame(points), rest = coatRest(points, frame);
  // the chains: two bones each under the pelvis, at the pivot and the knee, turned as the pelvis is at rest
  const pelvisInv = pelvis.matrixWorld.clone().invert(), K = COAT.columns, chainBones = [];
  for (let i = 0; i < K; i++) {
    const b0 = new T.Bone(), b1 = new T.Bone();
    b0.name = `coat_${i}_0`; b1.name = `coat_${i}_1`;
    const local0 = rest[i][0].clone().applyMatrix4(pelvisInv);
    pelvis.add(b0); b0.position.copy(local0);
    // (b0's frame is the pelvis's turned not at all: its rest quaternion undoes the pelvis's own)
    b0.quaternion.identity();
    b0.add(b1); b0.updateMatrixWorld(true);
    b1.position.copy(rest[i][1].clone().applyMatrix4(b0.matrixWorld.clone().invert()));
    b1.updateMatrixWorld(true);
    chainBones.push([b0, b1]);
  }
  const all = [...bones, ...chainBones.flat()];
  const inverses = [...skeleton.boneInverses, ...chainBones.flat().map((b) => b.matrixWorld.clone().invert())];
  const firstChain = bones.length;
  const sk = new T.Skeleton(all, inverses);
  mesh.bind(sk, mesh.bindMatrix);
  // the weights: below the waist band, the leg's or the coat's (the bust's rig kept everything here on the pelvis)
  const id = (name) => index.get(name);
  const pid = id('pelvis');
  let legs = 0, coat = 0;
  for (let i = 0; i < P.count; i++) {
    const p = points[i];
    if (p.y > COAT.waist[1] + 0.02) continue;
    // (the hands, swinging by the coat: their own weights)
    let onPelvis = 0; for (let k = 0; k < 4; k++) if (J.getComponent(i, k) === pid) onPelvis += Wt.getComponent(i, k);
    if (onPelvis < 0.999) continue;
    const L = fatherLegWeights(p, chains), C = coatWeights(p, frame);
    const w = new Map();
    const add = (b, v) => { if (v > 1e-5) w.set(b, (w.get(b) ?? 0) + v); };
    for (const [name, v] of L.w) add(id(name), v * L.leg);
    add(pid, (1 - L.leg) * C.pelvis);
    for (const [key, v] of C.w) { const [c, j] = key.split(':').map(Number); add(firstChain + c * 2 + j, v * (1 - L.leg)); }
    const best = [...w].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = best.reduce((s, x) => s + x[1], 0);
    for (let k = 0; k < 4; k++) { J.setComponent(i, k, best[k]?.[0] ?? 0); Wt.setComponent(i, k, best[k] ? best[k][1] / sum : 0); }
    if (L.leg > 0.5) legs++; else coat++;
  }
  J.needsUpdate = true; Wt.needsUpdate = true;
  return { chainBones, rest, frame, chains, counts: { legs, coat } };
}

/**
 * The coat's swing: per chain, the knee and hem points (character space, the fitted model's metres) with their
 * momentum, pulled back toward where the pelvis carries them, kept their length, pushed off the legs; the chain's
 * two bones turned to them. update(dt, { velocity }) after the body is posed (Humanoid.update).
 */
export class CoatSkirt {
  constructor(humanoid, rig) {
    this.h = humanoid; this.rig = rig;
    const pelvis = humanoid.b.pelvis;
    this.pelvis = pelvis;
    // the rest points in the pelvis's frame (the chains' targets: bind space is the character's, built at the origin)
    this.restLocal = rig.rest.map((col) => col.map((p) => p.clone().applyMatrix4(rig.pelvisInv)));
    this.len = rig.rest.map((col) => [col[0].distanceTo(col[1]), col[1].distanceTo(col[2])]);
    this.x = rig.rest.map((col) => col.map((p) => p.clone()));
    this.prev = rig.rest.map((col) => col.map((p) => p.clone()));
    this.acc = 0;
    this.started = false;
    this.caps = [];
  }

  /** The pelvis's transform in character space now. */
  pelvisChar(out = new T.Matrix4()) {
    const root = this.h.char.root;
    root.updateWorldMatrix(true, false);
    return out.copy(root.matrixWorld).invert().multiply(this.pelvis.matrixWorld);
  }

  /** Where the pelvis carries each chain's points now (character space). */
  targets() {
    const m = this.pelvisChar(new T.Matrix4());
    return this.restLocal.map((col) => col.map((p) => p.clone().applyMatrix4(m)));
  }

  legCapsules() {
    const root = this.h.char.root, inv = new T.Matrix4().copy(root.matrixWorld).invert(), B = this.h.b;
    const at = (n) => B[n].getWorldPosition(new T.Vector3()).applyMatrix4(inv);
    const caps = [];
    for (const s of ['l', 'r']) {
      const hip = at(`thigh_${s}`), knee = at(`calf_${s}`), ankle = at(`foot_${s}`);
      caps.push([hip, knee, COAT.thigh], [knee, ankle, COAT.shin]);
    }
    return caps;
  }

  /** One fixed step of the swing. */
  step(dt, T0, velocity) {
    const S = COAT, keep = Math.exp(-S.damping * dt), caps = this.caps;
    for (let i = 0; i < this.x.length; i++) {
      const x = this.x[i], pv = this.prev[i], tg = T0[i];
      x[0].copy(tg[0]); pv[0].copy(tg[0]);   // (the pivot: carried by the pelvis)
      for (let k = 1; k < 3; k++) {
        const v = _a.copy(x[k]).sub(pv[k]).multiplyScalar(keep);
        pv[k].copy(x[k]);
        // back toward the carried shape, and trailing as he walks (the drag of the air on the long coat)
        v.addScaledVector(_b.copy(tg[k]).sub(x[k]), S.stiffness * dt * dt);
        if (velocity) v.addScaledVector(velocity, -S.drag * k * dt * dt);
        x[k].add(v);
      }
      for (let it = 0; it < 3; it++) {
        // their lengths
        for (let k = 1; k < 3; k++) {
          const d = _c.copy(x[k]).sub(x[k - 1]), l = d.length() || 1e-6, err = (l - this.len[i][k - 1]) / l;
          if (k === 1) x[1].addScaledVector(d, -err);
          else { x[1].addScaledVector(d, err * 0.5); x[2].addScaledVector(d, -err * 0.5); }
        }
        // off the legs: the points and the middle of each segment (no closer than they hang at rest: where the
        // coat folds in between his legs it already lies nearer them than the capsule)
        caps.forEach(([a, b, r], c) => {
          const clear = this.clear[i][c];
          for (let k = 1; k < 3; k++) pushOff(x[k], a, b, Math.min(r, clear[k]), 1);
          for (let k = 1; k < 3; k++) {
            const mid = _d.copy(x[k - 1]).add(x[k]).multiplyScalar(0.5), push = pushOff(mid, a, b, Math.min(r, clear[2 + k]), 0);
            if (push) { x[k].add(push); if (k === 2) x[1].addScaledVector(push, 0.5); }
          }
        });
      }
    }
  }

  /** The chains' swing shared with their neighbours: the coat is one cloth, its columns don't part. */
  share(T0) {
    const K = this.x.length, k = COAT.share, off = this._off ??= Array.from({ length: K }, () => [new T.Vector3(), new T.Vector3(), new T.Vector3()]);
    for (let i = 0; i < K; i++) for (let j = 1; j < 3; j++) off[i][j].copy(this.x[i][j]).sub(T0[i][j]);
    for (let i = 0; i < K; i++) for (let j = 1; j < 3; j++) {
      const l = off[(i + K - 1) % K][j], r = off[(i + 1) % K][j];
      this.x[i][j].addScaledVector(_a.copy(l).add(r).multiplyScalar(0.5).sub(off[i][j]), k);
    }
  }

  /** A frame: `velocity` his own speed in character space (m/s), for the drag. */
  update(dt, { velocity = null } = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.h.char.root.updateMatrixWorld(true);
    const T0 = this.targets();
    this.caps = this.legCapsules();
    if (!this.started) {   // (the first frame: hung where it is carried)
      this.started = true;
      T0.forEach((col, i) => col.forEach((p, k) => { this.x[i][k].copy(p); this.prev[i][k].copy(p); }));
      // how near each point (1, 2) and segment middle (3, 4) hangs to each leg at rest
      const far = (p, [a, b]) => { const l = new T.Line3(a, b); return l.at(l.closestPointToPointParameter(p, true), new T.Vector3()).distanceTo(p) - 0.005; };
      this.clear = T0.map((col) => this.caps.map((cap) => [0, far(col[1], cap), far(col[2], cap),
        far(col[0].clone().add(col[1]).multiplyScalar(0.5), cap), far(col[1].clone().add(col[2]).multiplyScalar(0.5), cap)]));
    }
    this.acc += dt;
    while (this.acc >= COAT.step) { this.acc -= COAT.step; this.step(COAT.step, T0, velocity); this.share(T0); }
    this.pose();
  }

  /** Turn each chain's bones to its points. */
  pose() {
    const pc = this.pelvisChar(new T.Matrix4()), inv = pc.clone().invert();
    const rest = this.restLocal;
    this.rig.chainBones.forEach(([b0, b1], i) => {
      const x = this.x[i];
      const r0 = _a.copy(rest[i][1]).sub(rest[i][0]).normalize();
      const n0 = _b.copy(x[1]).applyMatrix4(inv).sub(_c.copy(x[0]).applyMatrix4(inv)).normalize();
      b0.quaternion.setFromUnitVectors(r0, n0);
      const r1 = _a.copy(rest[i][2]).sub(rest[i][1]).normalize();
      const n1 = _b.copy(x[2]).applyMatrix4(inv).sub(_c.copy(x[1]).applyMatrix4(inv)).normalize().applyQuaternion(_q.copy(b0.quaternion).invert());
      b1.quaternion.setFromUnitVectors(r1, n1);
    });
    this.pelvis.updateMatrixWorld(true);
  }

  /** How far the hem has swung off where the pelvis carries it (m, the largest): 0 at rest. */
  swing() {
    const T0 = this.targets();
    let max = 0;
    this.x.forEach((col, i) => { max = Math.max(max, col[2].distanceTo(T0[i][2])); });
    return max;
  }
}

/** Push p out of the capsule a-b of radius r: moves it when `apply`, returns the push (or null). */
function pushOff(p, a, b, r, apply) {
  const line = new T.Line3(a, b), t = line.closestPointToPointParameter(p, true);
  const q = line.at(t, new T.Vector3()), d = p.clone().sub(q), l = d.length();
  if (l >= r) return null;
  // (straight out, level: the coat pushed forward off the knee, not up it)
  d.y = 0;
  if (d.lengthSq() < 1e-10) d.set(0, 0, 1);
  const push = d.normalize().multiplyScalar(r - l);
  if (apply) p.add(push);
  return push;
}

/**
 * The father, whole and walking: the bust's build (createFatherV1: his face keys, his material, his hands) on
 * the uncut model, its lower body weighted again and the coat on its chains (humanoid.coat).
 */
export function createFatherFull(char, asset) {
  const root = char.root, position = root.position.clone(), quaternion = root.quaternion.clone(), scale = root.scale.clone();
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.setScalar(1); root.updateMatrixWorld(true);
  try {
    const humanoid = createFatherV1(char, asset);
    const mesh = humanoid.body;
    mesh.name = 'FatherFull';
    mesh.geometry.attributes.skinIndex = mesh.geometry.attributes.skinIndex.clone();
    mesh.geometry.attributes.skinWeight = mesh.geometry.attributes.skinWeight.clone();
    humanoid.update(true);
    const rig = rigFatherLowerBody(mesh);
    root.updateMatrixWorld(true);
    rig.pelvisInv = humanoid.b.pelvis.matrixWorld.clone().invert();
    humanoid.coat = new CoatSkirt(humanoid, rig);
    humanoid.fullBody = true;
    return humanoid;
  } finally {
    root.position.copy(position); root.quaternion.copy(quaternion); root.scale.copy(scale); root.updateMatrixWorld(true);
  }
}
