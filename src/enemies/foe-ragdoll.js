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
  stillMove: 0.035, // m: its trunk moved no further than this from where it was...
  stillFor: 0.4,    // ...this long (s): lying still, asleep
  maxSecs: 3.2,     // s at most it steps (still sliding on something: held where it is)
  toes: 1.1,        // rad the feet point along the shins, slack
  minStep: 1 / 120, // s: the shortest step it takes (time gathered until then)
  mu: 0.9,          // friction against the ground (Ragdoll.friction: a body lies still on a slope up to atan μ, 42°; it
                    // slid a metre or more on the flat and on and on down a 14° slope with the people's alone, #765)
  maxSpeed: 18,     // m/s no particle goes faster (a fall off a ledge reaches ~14; a constraint fighting the ground threw
                    // a warlord 15 m at 47 m/s, #765)
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

/**
 * The rig's joints now (world), in the ragdoll's order: the chest is the shoulders' line over the hips; the head's
 * particle at `head` in the head joint's frame (bodyShape: the middle of what is drawn of it), else on the joint.
 */
export function rigPoints(J, out = JOINTS.map(() => new THREE.Vector3()), head = null) {
  J.body.updateWorldMatrix(true, true);
  for (let i = 0; i < JOINTS.length; i++) {
    if (i === RJ.chest) J.torso.localToWorld(out[i].copy(CHEST.set(0, J.D.chest, 0)));
    else if (i === RJ.head && head) J.head.localToWorld(out[i].copy(head));
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
  const pts = rigPoints(J, undefined, shape.head);
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
  rag.friction = RAGDOLL.mu; rag.maxSpeed = RAGDOLL.maxSpeed;
  // (its head held over its neck no tighter than it is drawn: the warlord's, its mane down its back, sits behind and below
  // its neck's joint, and the people's limit threw it back up every step, a tremble that never slept)
  {
    const L = _a.subVectors(pts[RJ.hipL], pts[RJ.hipR]).normalize(), U = _b.subVectors(pts[RJ.chest], pts[RJ.pelvis]);
    U.addScaledVector(L, -U.dot(L)).normalize();
    const hd = new THREE.Vector3().subVectors(pts[RJ.head], pts[RJ.chest]), k = hd.dot(U) / Math.max(1e-6, hd.length());
    rag.headUp = Math.min(0.55, k - 0.45);
  }
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
  // (the head turned onto its particle along the line from its joint to the middle of what is drawn of it)
  const headDir = shape.head && shape.head.length() > 0.02 ? shape.head.clone().normalize() : UPV.clone();
  return { rag, J, loose, lay: layable(J, loose), headDir, snap: { q: js.map((j) => j.quaternion.clone()), p: J.body.position.clone() }, t: 0, asleep: false, s };
}

/**
 * What lies on the ground by turning about its own joint (issue #765): the feet (slack, toes along the shin, or turned
 * back or flat where that puts the toes in the ground), the head (turned on its neck, a cheek to the ground, as a body
 * lies on its face), the fingers (curled) and the parts that hang off the body (a hem, a kilt, a horn strapped to its
 * back; not a tail, which lies by itself): each tried in a few turns, the first that keeps its drawn box out of the
 * ground kept (else the one least in it). Before, a hem, a snout, a foot or the fingers in the ground lifted the whole
 * body by as much (the drawn hull, src/enemies/defeat.js), 6-58 cm, and it lay over the ground.
 */
export const LAY = {
  toes: [RAGDOLL.toes, 0.45, 1.75, -0.2, 2.3],        // rad about x, the feet's turns tried (slack first)
  // [x, y, z] rad, on top of how it rests
  hang: [[0, 0, 0], [0.6, 0, 0], [-0.6, 0, 0], [1.2, 0, 0], [-1.2, 0, 0], [1.8, 0, 0], [-1.8, 0, 0], [0, 0, 0.8], [0, 0, -0.8], [0, 0, 1.5], [0, 0, -1.5]],
  head: [[0, 0, 0], [0, 0.9, 0], [0, -0.9, 0], [0, 1.4, 0], [0, -1.4, 0], [0.5, 0, 0], [-0.5, 0, 0], [0.5, 1.1, 0], [0.5, -1.1, 0], [-0.4, 1.1, 0], [-0.4, -1.1, 0]],
  fingers: [[0, 0, 0], [0.7, 0, 0], [1.4, 0, 0], [-0.5, 0, 0]],
  wrist: [[0, 0, 0], [0.8, 0, 0], [-0.8, 0, 0], [0, 0, 0.8], [0, 0, -0.8], [1.4, 0, 0], [-1.4, 0, 0]],
  keep: 0.02,        // m better than the turn it has before it changes (no flicker between two)
  touch: 0.01,       // m into the ground that counts as on it
};
function layable(J, loose) {
  const skinned = [];
  let top = J.body; while (top.parent) top = top.parent;
  top.traverse((x) => { if (x.isSkinnedMesh) skinned.push(x); });
  const rigJ = new Set(joints(J));
  const corners = (o, list) => {
    const b = boxOf(o, skinned, list), sc = o.getWorldScale(new THREE.Vector3());
    const h = b.half.clone().divide(sc), out = [];
    for (const [x, y, z] of [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]]) out.push(new THREE.Vector3(x * h.x, y * h.y, z * h.z).add(b.centre));
    return out;
  };
  const out = [];
  for (const f of J.feet) if (f) { const own = []; f.traverse((x) => own.push(x)); out.push({ o: f, turns: LAY.toes, foot: true, pts: corners(f, own), pick: 0 }); }
  for (const [o] of loose) {
    if (!rigJ.has(o.parent) && o.parent !== J.body) continue;   // (a loose part's own loose parts go with it)
    if (/^tail/.test(o.name)) continue;
    const own = []; o.traverse((x) => own.push(x));
    const turns = o.parent === J.head ? LAY.head : J.hands.includes(o.parent) ? LAY.fingers : LAY.hang;
    out.push({ o, turns, foot: false, pts: corners(o, own), pick: 0 });
  }
  // (a hand bends at the wrist, the mummer king's broad palms lifted it 14 cm; not laid again each frame, so turned from
  // how it was. A shield on its arm is let go with its weapon: Foes.looseGrips)
  const fixed = (o, turns) => { const own = []; o.traverse((x) => own.push(x)); out.push({ o, turns, foot: false, base: o.quaternion.clone(), pts: corners(o, own), pick: 0 }); };
  for (const h of J.hands) if (h) fixed(h, LAY.wrist);
  // (the hands before their fingers: a wrist's turn moves them)
  const first = (P) => (J.hands.includes(P.o) ? 0 : 1);
  return out.sort((a, b) => first(a) - first(b));
}

const _lq = new THREE.Quaternion(), _lq2 = new THREE.Quaternion(), _lp = new THREE.Vector3(), _le = new THREE.Euler();
/** How far the part's drawn box goes into the ground as it is turned now (m; negative: over it). */
function layDepth(P, G) {
  P.o.updateMatrixWorld(true);
  let worst = -Infinity;
  for (const c of P.pts) {
    _lp.copy(c).applyMatrix4(P.o.matrixWorld);
    worst = Math.max(worst, G.y + G.sx * (_lp.x - G.x) + G.sz * (_lp.z - G.z) - _lp.y);
  }
  return worst;
}
/**
 * The feet, the head, the fingers and the hanging parts each turned to lie on the ground (after the rig is laid), against
 * the ground's plane under its pelvis this frame (three reads: per corner, 140 reads a frame cost a millisecond for four).
 */
const _G = { x: 0, y: 0, z: 0, sx: 0, sz: 0 };
function layParts(R, physics) {
  const p = R.rag.pelvis, at = (dx, dz) => { const q = _lp.set(p.x + dx, p.y, p.z + dz), h = physics.heightAbove(q, UPV, 1.5); return Number.isFinite(h) ? q.y - h : null; };
  const y0 = at(0, 0);
  if (y0 == null) return;
  const yx = at(0.4, 0), yz = at(0, 0.4), G = _G;
  G.x = p.x; G.z = p.z; G.y = y0;
  G.sx = yx != null && Math.abs(yx - y0) < 0.4 ? (yx - y0) / 0.4 : 0; G.sz = yz != null && Math.abs(yz - y0) < 0.4 ? (yz - y0) / 0.4 : 0;
  for (const P of R.lay) {
    const base = _lq2.copy(P.base ?? P.o.quaternion), T = P.turns, n = T.length;
    const turn = (i) => {
      if (P.foot) P.o.quaternion.setFromAxisAngle(XAXIS, T[i]);
      else P.o.quaternion.copy(base).multiply(_lq.setFromEuler(_le.set(T[i][0], T[i][1], T[i][2])));
    };
    // (the turn it had, then the others while that one is in the ground)
    turn(P.pick);
    let best = P.pick, depth = layDepth(P, G);
    if (depth > LAY.touch) {
      for (let i = 0; i < n; i++) {
        if (i === P.pick) continue;
        turn(i);
        const d = layDepth(P, G);
        if (d < depth - LAY.keep) { depth = d; best = i; }
        if (depth <= LAY.touch) break;
      }
    }
    P.pick = best;
    turn(best);
    P.o.updateMatrixWorld(true);
  }
}

/**
 * The particles' radii (m, before the ragdoll's scale `size`) and where its head's particle sits (`head`, in the head
 * joint's frame): the trunk's from the torso's drawn box (half its depth and width, the smaller: how far its belly or its
 * back stands off its spine when it lies), the head's particle at the middle of what is drawn of the head (its skull, a
 * mane, horns, a snout: on its joint, at the top of the neck, a big head swung about a point a few centimetres from the
 * chest and lay 30 cm deep in the ground, #765) and as big as most of it; each limb's as thick as it is drawn (the thigh,
 * the shin, the foot, the upper arm, the forearm, the hand: a grunt's arms are twice a person's, and its drawn limbs in
 * the ground lifted the whole body off it, #765). A body drawn with nothing on its torso joint keeps a person's, × bulk.
 */
export function bodyShape(J, size, bulk = 1) {
  const R = JOINTS.map(([, , r]) => r), skinned = [], rigJoints = new Set(joints(J));
  let top = J.body; while (top.parent) top = top.parent;
  top.traverse((x) => { if (x.isSkinnedMesh) skinned.push(x); });
  // (a joint's own drawn box: its subtree's meshes and the skin's points on its bones, the rig's other joints left out)
  const own = (j) => {
    const kids = j.children.filter((c) => rigJoints.has(c));
    for (const c of kids) j.remove(c);
    const list = []; j.traverse((x) => list.push(x));
    const b = boxOf(j, skinned, list);
    for (const c of kids) j.add(c);
    return b.half.x <= 0.0151 && b.half.y <= 0.0151 && b.half.z <= 0.0151 ? null : b;
  };
  // (each way's reach from the joint: the box's half and how far its middle sits off the joint, as the belly before a
  // grunt's spine: its front and its back averaged, so neither side lies deep in the ground)
  const reach = (j, b) => {
    const sc = j.getWorldScale(new THREE.Vector3());
    return new THREE.Vector3(b.half.x + Math.abs(b.centre.x * sc.x) * 0.5, b.half.y, b.half.z + Math.abs(b.centre.z * sc.z) * 0.5).divideScalar(size);
  };
  const clamp = (x, r, lo = 0.6, hi = 3) => Math.max(r * lo, Math.min(r * hi, x));
  const tb = own(J.torso), t = tb && reach(J.torso, tb);
  // (up to 3.6 a person's: the mummer king's sack of a belly, 2.6 before, lay 30 cm deep and lifted the whole body)
  if (t) R[RJ.pelvis] = Math.min(R[RJ.pelvis] * 3.6, clamp(Math.min(t.x, t.z), R[RJ.pelvis] * bulk, 0.6, 3.6));
  else R[RJ.pelvis] *= bulk;
  R[RJ.chest] = R[RJ.pelvis] * 1.05;
  // the head: its particle at the middle of its drawn box, as big as the mean of the box's two larger halves (its
  // corners, a horn's tip, are the drawn hull's: src/enemies/defeat.js groundDefeat)
  // (measured as it rests on its neck: the face its gaze turned, turned back)
  let head = null;
  const turned = [];
  J.head.traverse((o) => { if (o !== J.head && !rigJoints.has(o) && !o.isMesh && !o.isBone) { turned.push([o, o.quaternion.clone()]); o.quaternion.identity(); } });
  const hb = own(J.head);
  for (const [o, q] of turned) o.quaternion.copy(q);
  J.head.updateMatrixWorld(true);
  if (hb) {
    const hs = [hb.half.x, hb.half.y, hb.half.z].sort((a, b) => b - a);
    R[RJ.head] = clamp(((hs[0] * 2 + hs[1]) / 3) / size, R[RJ.head], 0.6, 4);
    head = hb.centre.clone();
  }
  // the limbs: each joint's particle as thick as the segment below it is drawn (across its bone, its x and z: the bone
  // runs down its -y), a foot by its width and height (it lies along the shin, slack)
  const limb = (j, i, foot = false) => {
    const b = j && own(j);
    if (!b) return;
    const r = reach(j, b);
    R[i] = clamp(((foot ? r.x + r.y : r.x + r.z) / 2) * 0.9, R[i], 0.6, 2.6);
  };
  for (const [k, side] of [[0, 'R'], [1, 'L']]) {
    limb(J.legs[k], RJ['hip' + side]); limb(J.knees[k], RJ['knee' + side]); limb(J.feet[k], RJ['foot' + side], true);
    limb(J.arms[k], RJ['sh' + side]); limb(J.elbows[k], RJ['el' + side]);
    const b = own(J.hands[k]);
    if (b) { const r = reach(J.hands[k], b); R[RJ['ha' + side]] = clamp(((r.x + r.y + r.z) / 3) * 0.85, R[RJ['ha' + side]]); }
  }
  return { radii: R, head };
}

const TRUNK = [RJ.pelvis, RJ.chest, RJ.head, RJ.hipL, RJ.hipR, RJ.shL, RJ.shR];
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
  // (at the body's scale now: shrinking in its puff it shrinks about its pelvis, not toward its feet, #765)
  const sNow = P.getWorldScale(_b).y * J.body.scale.y || s;
  const origin = _a.set(0, -D.hip * sNow, 0).applyQuaternion(Q).add(x[RJ.pelvis]);
  J.body.position.copy(P.worldToLocal(origin));
  J.torso.quaternion.identity();
  J.body.updateMatrixWorld(true);
  // the head over the neck: its +y toward the head's particle from the chest's
  J.torso.getWorldQuaternion(_q2).invert();
  J.head.quaternion.setFromUnitVectors(R.headDir ?? UPV, _a.subVectors(x[RJ.head], x[RJ.chest]).normalize().applyQuaternion(_q2));
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
 * Down on the ground on its side, it rolls the rest of the way over onto its back or its front, whichever it faces more
 * (issue #767, the author: "No enemy should fall on their side when they die"): while its hips' line is tipped more
 * than ROLL.from, the whole body turns about its spine (pelvis to chest) at up to ROLL.rate rad/s toward lying level,
 * its limbs carried with it and the ground pushing them out, and its upper hip and shoulder are pushed over and down at
 * ROLL.push m/s². Its trunk rests on round particles, which lie as well on a side as on a back, and its limbs' friction
 * held it there (2 of 40 blows left a humanoid 47-65° over; now one at 40°, the rest within 22°: node, flat ground).
 */
export const ROLL = { from: Math.sin((22 * Math.PI) / 180), rate: 1, push: 60, near: 0.25, most: 0.9 };
const _ra = new THREE.Vector3(), _rb = new THREE.Vector3(), _rq = new THREE.Quaternion();
function rollFlat(R, dt, physics) {
  const x = R.rag.x, v = R.rag.v;
  R.tilted = false;
  if ((R.rolling ?? 0) >= ROLL.most) return;   // (it has tried long enough: it lies as it is)
  const across = _ra.subVectors(x[RJ.hipL], x[RJ.hipR]).normalize();
  if (Math.abs(across.y) < ROLL.from) return;
  // (only lying: its pelvis down near the ground)
  const h = physics.heightAbove(x[RJ.pelvis], UPV, 1);
  if (!(h < R.rag.r[RJ.pelvis] + ROLL.near)) return;
  R.tilted = true;
  // about its spine, the way that brings its hips' line level soonest (onto its back or its front, whichever is nearer)
  const axis = _rb.subVectors(x[RJ.chest], x[RJ.pelvis]).normalize();
  const turned = _rq.setFromAxisAngle(axis, 0.05), test = across.clone().applyQuaternion(turned);
  const sign = Math.abs(test.y) < Math.abs(across.y) ? 1 : -1;
  _rq.setFromAxisAngle(axis, sign * Math.min(ROLL.rate * dt, Math.asin(Math.min(1, Math.abs(across.y)))));
  const o = x[RJ.pelvis].clone();
  for (let i = 0; i < x.length; i++) { x[i].sub(o).applyQuaternion(_rq).add(o); v[i].applyQuaternion(_rq); }
  // (and its upper hip and shoulder pushed over and down, as its weight takes it)
  if (ROLL.push) {
    const up = _rb.subVectors(x[RJ.chest], x[RJ.pelvis]);
    up.addScaledVector(across, -up.dot(across)).normalize();
    const front = up.crossVectors(across, up.clone()), way = front.y >= 0 ? -1 : 1;
    const dir = front.setY(0).normalize().multiplyScalar(way).addScaledVector(UPV, -1).normalize();
    for (const i of across.y > 0 ? [RJ.hipL, RJ.shL] : [RJ.hipR, RJ.shR]) v[i].addScaledVector(dir, ROLL.push * dt);
  }
  R.rolling = (R.rolling ?? 0) + dt;
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
    if (touching >= 2) rollFlat(R, dt, physics); else R.tilted = false;
    stepped = true;
    // (lying still: its trunk, head and hips and shoulders, has gone no more than RAGDOLL.stillMove from where it was
    // since it last moved: a knee caught between its limit and the ground trembles at a metre a second, or a leg folds
    // slowly over, and kept the people's speed test awake past its puff)
    const S = (R.rest ??= { at: TRUNK.map((i) => R.rag.x[i].clone()), t: 0 });
    let moved = 0;
    for (let k = 0; k < TRUNK.length; k++) moved = Math.max(moved, R.rag.x[TRUNK[k]].distanceToSquared(S.at[k]));
    if (moved > RAGDOLL.stillMove * RAGDOLL.stillMove) { S.t = 0; TRUNK.forEach((i, k) => S.at[k].copy(R.rag.x[i])); } else S.t += dt;
    // (still on its side and rolling over: not asleep yet, unless it has been at it ROLL.most s)
    const rolling = R.tilted && (R.rolling ?? 0) < ROLL.most;
    if (((R.rag.stillT >= RAG.stillFor + RAGDOLL.sleepAfter || S.t >= RAGDOLL.stillFor) && R.t > 0.5 && !rolling) || R.t > RAGDOLL.maxSecs) R.asleep = true;
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
  } else if (R.lay?.length) layParts(R, physics);   // (its feet and what hangs off it laid on the ground: #765)
  return stepped;
}

/**
 * Where it lies (issue #765): its model's origin moved to the ground under its pelvis, every part of it kept where it is
 * drawn, so what scales the model about its origin (its puff, Foes.update: it shrinks away in its smoke) shrinks it where
 * it lies. Before, the origin stayed where it was struck down and the body slid back there over the ground as it shrank,
 * 0.8-1.8 m (a warlord thrown far, 12 m). `group` is the model's root, `pos` the foe's position (moved with it).
 */
export function anchorRagdoll(R, group, pos, ground) {
  const p = R.rag.pelvis, gy = ground?.(p.x, p.y + 1, p.z);
  const to = _a.set(p.x, Number.isFinite(gy) ? gy : pos.y, p.z);
  const shift = _b.subVectors(group.position, pos);   // (what stands it off its position: a hover's height, the hull's lift)
  const was = group.position.clone(), now = to.clone().add(shift);
  // (each child of the root moved back by as much in the root's own frame: its turn and its scale undone)
  group.updateMatrixWorld(true);
  const d = was.sub(now).applyQuaternion(_q.copy(group.quaternion).invert()).divide(group.scale);
  for (const c of group.children) c.position.add(d);
  group.position.copy(now);
  pos.copy(to);
  group.updateMatrixWorld(true);
  return pos;
}
