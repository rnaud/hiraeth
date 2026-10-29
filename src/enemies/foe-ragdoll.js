import * as THREE from 'three';
import { Ragdoll, J as RJ, JOINTS, toppleVelocities, trunkFrame, RAG } from '../ragdoll.js';
import { boxOf } from './debris.js';

// Defeated foes ragdoll (issue #750; docs/systems/foes.md, "Hit and defeat"): a humanoid foe on the clip rig
// (src/enemies/humanoid-rig.js) goes limp under the killing blow instead of playing a fall onto its side. The people's
// ragdoll (src/ragdoll.js: fifteen joint particles, position-based dynamics, the trunk rigid, knees that bend only
// forward, thighs that don't swing far back, elbows and knees that never fold flat, the head kept over the neck, every
// particle landing on the ground under it and its slope) run on the rig's joints: started from the pose it was struck
// in, thrown along the blow, then laid back on the rig each frame (the trunk turned onto its particles, each limb aimed
// joint to joint). It settles, then it lies and goes up in its puff as before (Foes.burst, src/smoke-puff.js).
//
// Cheap: at most RAGDOLL.most step at once (any more fall the old way, src/enemies/defeat.js), each asleep once it lies
// still (no rays, its pose held); ~15 ground reads a frame each while it moves. Deterministic: the caller gives the throw.

export const RAGDOLL = {
  most: 4,          // ragdolls stepping at once
  carry: 0.55,      // of the blow's shove (m/s) the whole body takes along it...
  shove: 3.5,       // ...the shove taken as at most this (a heavy third swing throws a grunt at 11 m/s)
  tip: 2.2,         // m/s more at the top than the feet: it goes over along the blow
  heavy: 1.3,       // × for a heavy blow (the charged cut, the riposte, the third swing)
  drag: 3.5,        // 1/s: lying with three joints or more on the ground, what is left of its slide dies away (a body
                    // drags on the ground: the people's ragdoll's friction alone let a big one skate metres)
  rise: 0.8,        // m/s up at the blow
  punch: 1.8,       // m/s more at the joint nearest where it was struck
  blend: 0.12,      // s from the pose it was struck in into the limp one
  sleepAfter: 0.25, // s settled (RAG.stillFor) before it stops stepping
  maxSecs: 3.2,     // s at most it steps (still sliding on something: held where it is)
  toes: 1.1,        // rad the feet point along the shins, slack
  minStep: 1 / 120, // s: the shortest step it takes (time gathered until then)
};

// the rig's joints in the ragdoll's order (JOINTS: pelvis, chest, head, hips, knees, feet, shoulders, elbows, hands;
// the rig's index 0 is its right, -x)
const CHEST = new THREE.Vector3();
function jointOf(J, i) {
  switch (i) {
    case RJ.pelvis: return J.torso; case RJ.head: return J.head;
    case RJ.hipL: return J.legs[1]; case RJ.hipR: return J.legs[0];
    case RJ.kneeL: return J.knees[1]; case RJ.kneeR: return J.knees[0];
    case RJ.footL: return J.feet[1]; case RJ.footR: return J.feet[0];
    case RJ.shL: return J.arms[1]; case RJ.shR: return J.arms[0];
    case RJ.elL: return J.elbows[1]; case RJ.elR: return J.elbows[0];
    case RJ.haL: return J.hands[1]; case RJ.haR: return J.hands[0];
    default: return null;
  }
}

/** The rig's joints now (world), in the ragdoll's order: the chest is the shoulders' line over the hips. */
export function rigPoints(J, out = JOINTS.map(() => new THREE.Vector3())) {
  J.body.updateWorldMatrix(true, true);
  for (let i = 0; i < JOINTS.length; i++) {
    if (i === RJ.chest) J.torso.localToWorld(out[i].copy(CHEST.set(0, J.D.chest, 0)));
    else jointOf(J, i).getWorldPosition(out[i]);
  }
  return out;
}

/** The trunk's shape at rest (hips, pelvis, chest, shoulders: the rig's own proportions), placed on the trunk as it is now. */
function restTrunk(J, pts, s) {
  const D = J.D, q = trunkFrame(pts[RJ.hipL], pts[RJ.hipR], pts[RJ.pelvis], pts[RJ.chest], new THREE.Quaternion());
  const local = {
    [RJ.pelvis]: [0, 0, 0], [RJ.chest]: [0, D.chest, 0], [RJ.hipL]: [D.hipX, 0, 0], [RJ.hipR]: [-D.hipX, 0, 0],
    [RJ.shL]: [D.shoulder, D.chest, 0], [RJ.shR]: [-D.shoulder, D.chest, 0],
  };
  return pts.map((p, i) => (local[i] ? new THREE.Vector3(...local[i]).multiplyScalar(s).applyQuaternion(q).add(pts[RJ.pelvis]) : p));
}

/**
 * The ground for the ragdoll from a height function (Foes' env.ground: the height under (x, z) read from about y, or
 * null): one read for its height, two more for its slope when it is near (a test's flat ground, any world's). The
 * game's own physics (groundHit, pushCapsule: walls) is used where it is there.
 */
export const WALLS = { on: false };
export function groundPhysics(ground, world = null, near = 0.6, probe = 0.15) {
  const UP = new THREE.Vector3(0, 1, 0);
  const hAt = (x, y, z) => { const h = ground(x, y, z); return h == null || !Number.isFinite(h) ? null : h; };
  return {
    groundHit(pos, up, step, outN) {
      const h = hAt(pos.x, pos.y + step, pos.z);
      if (h == null) { outN.copy(UP); return Infinity; }
      const d = pos.y - h;
      if (d < near) {
        const hx = hAt(pos.x + probe, pos.y + step, pos.z), hz = hAt(pos.x, pos.y + step, pos.z + probe);
        const sx = hx != null && Math.abs(hx - h) < probe * 1.8 ? (hx - h) / probe : 0, sz = hz != null && Math.abs(hz - h) < probe * 1.8 ? (hz - h) / probe : 0;
        outN.set(-sx, 1, -sz).normalize();
      } else outN.copy(UP);
      return d;
    },
    heightAbove(pos, up, step) { const h = hAt(pos.x, pos.y + step, pos.z); return h == null ? Infinity : pos.y - h; },
    // (the world's walls, where it has them: the trunk pushed out of them as a capsule; its floors are the ground above)
    ...(world?.pushCapsule && WALLS.on ? { pushCapsule: (...a) => world.pushCapsule(...a) } : {}),
  };
}

/**
 * A ragdoll for a humanoid foe struck down: from its rig's pose now, thrown along the blow (`dir`, unit and level;
 * `shove` its speed m/s; `heavy` a heavy blow; `at` where it was struck; `twist` -1..1). Its particles sized by the
 * rig's size (`scale` × `bulk` for a stout body's trunk).
 */
export function startFoeRagdoll(J, { dir, shove = 2, heavy = false, at = null, twist = 0, bulk = 1 } = {}) {
  const s = J.body.getWorldScale(new THREE.Vector3()).y || 1;
  const size = (J.D.hip * s) / 0.95, shape = bodyShape(J, size, bulk);
  const pts = rigPoints(J);
  const rest = restTrunk(J, pts, s);
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(dir?.x ?? 0, 0, dir?.z ?? 1);
  if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
  d.normalize();
  const k = heavy ? RAGDOLL.heavy : 1;
  const vel = toppleVelocities(d, up, { carry: RAGDOLL.carry * Math.min(shove, RAGDOLL.shove), rise: RAGDOLL.rise * k, tip: RAGDOLL.tip * k * Math.min(1.2, Math.sqrt(size)), twist });
  if (at) {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const q = p.distanceToSquared(at); if (q < bd) { bd = q; best = i; } });
    vel[best].addScaledVector(d, RAGDOLL.punch * k);
  }
  // (its trunk and head as thick as they are drawn: a grunt is all belly, a sentinel slim; the limbs a person's, sized)
  const radii = shape.radii;
  const rag = new Ragdoll().start(pts, vel, { rest, scale: size, radii });
  // (the body's own hanging parts, its hems, kilts, a horn on its back, the face its gaze turned: back to how they hang at
  // rest on the body, as it goes limp; their springs no longer move them)
  const rigJ = new Set(joints(J)), loose = [];
  // (what it holds, a grip and all under it, a shield on its arm, is left as it is: its weapon flies as a piece of its own)
  const walk = (o) => {
    if (/^(grip|shield)/.test(o.name)) return;
    if (!rigJ.has(o) && !o.isMesh && !o.isBone && o !== J.body) loose.push([o, o.quaternion.clone()]);
    for (const c of o.children) walk(c);
  };
  walk(J.body);
  // (the pose it was struck in, to blend from)
  const js = joints(J);
  return { rag, J, loose, snap: { q: js.map((j) => j.quaternion.clone()), p: J.body.position.clone() }, t: 0, asleep: false, s };
}

/**
 * The particles' radii (m, before the ragdoll's scale `size`) and where its head's particle sits (in the head's frame): the trunk's from the torso's drawn box (half its depth and
 * width, the smaller: how far its belly or its back stands off its spine when it lies), the head's from the head's, the
 * limbs a person's (JOINTS). A body drawn with nothing on its torso joint keeps a person's, × bulk.
 */
export function bodyShape(J, size, bulk = 1) {
  const R = JOINTS.map(([, , r]) => r), skinned = [], rigJoints = new Set(joints(J));
  let top = J.body; while (top.parent) top = top.parent;
  top.traverse((x) => { if (x.isSkinnedMesh) skinned.push(x); });
  // (a joint's own drawn box: its subtree's meshes and the skin's points on its bones, the rig's other joints left out)
  const boxFor = (j) => {
    const kids = j.children.filter((c) => rigJoints.has(c));
    for (const c of kids) j.remove(c);
    const own = []; j.traverse((x) => own.push(x));
    const b = boxOf(j, skinned, own);
    for (const c of kids) j.add(c);
    if (j === J.head) headAt = b.centre.clone();
    if (b.half.x <= 0.0151 && b.half.y <= 0.0151 && b.half.z <= 0.0151) return null;
    // (each way's reach from the joint: the box's half and how far its middle sits off the joint, as the belly before a
    // grunt's spine: its front and its back averaged, so neither side lies deep in the ground)
    const sc = j.getWorldScale(new THREE.Vector3());
    return new THREE.Vector3(b.half.x + Math.abs(b.centre.x * sc.x) * 0.5, b.half.y, b.half.z + Math.abs(b.centre.z * sc.z) * 0.5).divideScalar(size);
  };
  let headAt = null;
  const clamp = (x, r) => Math.max(r * 0.6, Math.min(r * 3, x));
  const t = boxFor(J.torso), h = boxFor(J.head);
  if (t) R[RJ.pelvis] = Math.min(R[RJ.pelvis] * 2.6, clamp(Math.min(t.x, t.z), R[RJ.pelvis] * bulk));
  else R[RJ.pelvis] *= bulk;
  R[RJ.chest] = R[RJ.pelvis] * 1.05;
  if (h) R[RJ.head] = Math.max(R[RJ.head] * 0.6, Math.min(R[RJ.head] * 5, Math.max(h.x, h.y, h.z)));
  for (const [i, j] of [[RJ.haR, J.hands[0]], [RJ.haL, J.hands[1]]]) { const b = boxFor(j); if (b) R[i] = clamp(((b.x + b.y + b.z) / 3) * 0.85, R[i]); }
  // (the head's particle stays on its joint, the people's ragdoll keeps it over the neck: its sphere reaches over what is
  // drawn of it, a maned head or a long snout off to one side half counted)
  if (h && headAt) R[RJ.head] = Math.max(R[RJ.head], Math.min(JOINTS[RJ.head][2] * 5, R[RJ.head] * 0.8 + (headAt.length() * (J.head.getWorldScale(new THREE.Vector3()).y || 1) * 0.5) / size));
  return { radii: R };
}

const joints = (J) => (J._ragJoints ??= [J.body, J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet]);

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();
const IDQ = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0), UPV = new THREE.Vector3(0, 1, 0), XAXIS = new THREE.Vector3(1, 0, 0);
/** A limb joint's -y aimed along dir (world). */
function aimDown(j, dir) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_q2).invert();
  j.quaternion.setFromUnitVectors(DOWN, _a.copy(dir).normalize().applyQuaternion(_q2));
  j.updateMatrixWorld(true);
}

/** Lay the ragdoll on the rig: the trunk turned and placed on its particles, the head, legs and arms aimed along them. */
export function applyFoeRagdoll(R) {
  const { rag, J, s } = R, x = rag.x, D = J.D;
  // the trunk: the body's frame (+x its left, +y up, +z its front) from hips, pelvis and chest, the hips on the pelvis
  const Q = trunkFrame(x[RJ.hipL], x[RJ.hipR], x[RJ.pelvis], x[RJ.chest], _q);
  const P = J.body.parent;
  P.updateWorldMatrix(true, false);
  P.getWorldQuaternion(_q2);

  J.body.quaternion.copy(_q2).invert().multiply(Q);
  // (the body's origin under the pelvis by the hips' height, in the body's own turned frame)
  const origin = _a.set(0, -D.hip * s, 0).applyQuaternion(Q).add(x[RJ.pelvis]);
  J.body.position.copy(P.worldToLocal(origin));
  J.torso.quaternion.identity();
  J.body.updateMatrixWorld(true);
  // the head over the neck: its +y toward the head's particle from the chest's
  J.torso.getWorldQuaternion(_q2).invert();
  J.head.quaternion.setFromUnitVectors(UPV, _a.subVectors(x[RJ.head], x[RJ.chest]).normalize().applyQuaternion(_q2));
  J.head.updateMatrixWorld(true);
  // the legs and the arms, joint to joint
  for (const [hip, knee, foot, i] of [[RJ.hipR, RJ.kneeR, RJ.footR, 0], [RJ.hipL, RJ.kneeL, RJ.footL, 1]]) {
    aimDown(J.legs[i], _b.subVectors(x[knee], J.legs[i].getWorldPosition(_a)));
    aimDown(J.knees[i], _b.subVectors(x[foot], J.knees[i].getWorldPosition(_a)));
    // (the feet go slack, toes pointed along the shin: a foot square to a lying leg stands into the ground)
    J.feet[i].quaternion.setFromAxisAngle(XAXIS, RAGDOLL.toes); J.feet[i].updateMatrixWorld(true);
  }
  for (const [el, ha, i] of [[RJ.elR, RJ.haR, 0], [RJ.elL, RJ.haL, 1]]) {
    aimDown(J.arms[i], _b.subVectors(x[el], J.arms[i].getWorldPosition(_a)));
    aimDown(J.elbows[i], _b.subVectors(x[ha], J.elbows[i].getWorldPosition(_a)));
  }
}

/**
 * One frame of a foe's ragdoll: stepped (unless asleep), laid on the rig, blended in from the pose it was struck in over
 * RAGDOLL.blend s. `physics`: groundHit / heightAbove (groundPhysics or the game's). Returns whether it stepped.
 */
export function stepFoeRagdoll(R, dt, physics) {
  R.t += dt;
  let stepped = false;
  // (the time is gathered into steps of at least a 120th: the ragdoll reads its speed off how far a step moved it, and
  // a hit-stop's or a slow motion's sliver of a frame turned its constraints' pushes into thousands of metres a second;
  // a long frame, a hitch, is stepped as at most a 30th, so it never takes a stride that throws it off)
  R.acc = (R.acc ?? 0) + dt;
  if (!R.asleep && R.acc >= RAGDOLL.minStep) {
    R.rag.step(Math.min(R.acc, 1 / 30), physics, UPV);
    R.acc = 0;
    let touching = 0;
    for (let i = 0; i < R.rag.contact.length; i++) touching += R.rag.contact[i];
    if (touching >= 3) { const k = Math.exp(-RAGDOLL.drag * dt); for (const v of R.rag.v) v.multiplyScalar(k); }
    stepped = true;
    if ((R.rag.stillT >= RAG.stillFor + RAGDOLL.sleepAfter && R.t > 0.5) || R.t > RAGDOLL.maxSecs) R.asleep = true;
  }
  if (!stepped && R.applied) return false;
  applyFoeRagdoll(R);
  R.applied = true;
  for (const [o, q0] of R.loose) o.quaternion.slerpQuaternions(q0, IDQ, Math.min(1, R.t / RAGDOLL.blend));
  if (R.t < RAGDOLL.blend) {
    const w = R.t / RAGDOLL.blend, js = joints(R.J), S = R.snap;
    js.forEach((j, i) => j.quaternion.slerpQuaternions(S.q[i], _q.copy(j.quaternion), w));
    R.J.body.position.lerpVectors(S.p, _a.copy(R.J.body.position), w);
    R.J.body.updateMatrixWorld(true);
  }
  return stepped;
}
