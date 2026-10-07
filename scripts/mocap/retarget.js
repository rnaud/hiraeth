// A take (take.js) onto the game's clip skeleton: the UAL library's (public/anim/ual.glb, UE
// mannequin names), so a converted clip plays through the same Animator, retargeting and feet as
// the library's own loops.
//
// For each of our bones: the source bone's rotation relative to its rest pose is laid onto ours
// (rest-relative transfer: keeps the twist), then the bone is swung so it points exactly where the
// source's points (`aim`): the Animator reads directions, so those are what must match, whatever
// the two skeletons' proportions and rest poses. The body is scaled by leg length, the motion
// split into a root (on the ground under the hips, facing the way the hips face, smoothed) and an
// in-place pose relative to it, as the library's loops are.
import * as THREE from 'three';

// the bones a clip animates (the UAL clips' own 22 tracks, less the fixed root)
export const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
// the ones the game never reads (the Animator takes directions from the neck to the head and
// along the arms, never the head's own turn or the shoulders' place): kept at rest, not stored
export const FIXED = new Set(['Head', 'clavicle_l', 'clavicle_r']);
export const TRACKS = BONES.filter((k) => !FIXED.has(k));
// the child each bone points at (its direction)
const CHILD = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
  clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l',
  clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', hand_r: 'middle_01_r',
  thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l', thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r' };

const by = (scene, n) => scene.getObjectByName(n);

/** The target skeleton's rest pose, from the UAL library's scene. */
export function targetSkeleton(scene) {
  scene.updateMatrixWorld(true);
  const bones = {};
  const names = [...BONES, 'root', 'ball_l', 'ball_r', 'middle_01_l', 'middle_01_r'];
  for (const n of names) {
    const o = by(scene, n);
    if (!o) throw new Error(`target skeleton: no bone ${n}`);
    bones[n] = {
      o, parent: o.parent?.name,
      wp: o.getWorldPosition(new THREE.Vector3()), wq: o.getWorldQuaternion(new THREE.Quaternion()),
      lp: o.position.clone(), lq: o.quaternion.clone(),
    };
  }
  const B = bones;
  const legLength = B.thigh_l.wp.distanceTo(B.calf_l.wp) + B.calf_l.wp.distanceTo(B.foot_l.wp);
  const hipMid = B.thigh_l.wp.clone().add(B.thigh_r.wp).multiplyScalar(0.5);
  for (const n of BONES) B[n].restDir = CHILD[n] ? B[CHILD[n]].wp.clone().sub(B[n].wp).normalize() : new THREE.Vector3(0, 1, 0);
  // the foot standing flat: the ankle's height over the ground and the pitch of ankle -> ball
  const ankleHeight = (B.foot_l.wp.y + B.foot_r.wp.y) / 2, ballHeight = (B.ball_l.wp.y + B.ball_r.wp.y) / 2;
  const footPitch = Math.atan2(B.foot_l.wp.y - B.ball_l.wp.y, Math.hypot(B.ball_l.wp.x - B.foot_l.wp.x, B.ball_l.wp.z - B.foot_l.wp.z));
  return { bones, legLength, hipMid, ballHeight, ankleHeight, footPitch, rootQ: B.root.wq.clone() };
}

const gauss = (arr, n, dim, sigma) => {
  // smooth each column of an (n x dim) array with a gaussian of sigma frames; past the ends the
  // signal is mirrored about its end point (x[-k] = 2 x[0] - x[k]), so a body still moving as the
  // take ends keeps its speed instead of seeming to slow down into a clamped edge
  if (sigma <= 0) return arr;
  const out = new Float32Array(arr.length), R = Math.ceil(sigma * 3), w = [];
  for (let k = -R; k <= R; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const at = (j, d) => {
    if (j < 0) return 2 * arr[d] - arr[Math.min(-j, n - 1) * dim + d];
    if (j >= n) return 2 * arr[(n - 1) * dim + d] - arr[Math.max(2 * (n - 1) - j, 0) * dim + d];
    return arr[j * dim + d];
  };
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) {
      let s = 0, ws = 0;
      for (let k = -R; k <= R; k++) { s += at(i + k, d) * w[k + R]; ws += w[k + R]; }
      out[i * dim + d] = s / ws;
    }
  }
  return out;
};

/**
 * Retarget a take onto the target skeleton (targetSkeleton()).
 * Returns { fps, n, scale, local: { bone: Float32Array(n*4) }, pelvisPos: Float32Array(n*3),
 *   root: Float32Array(n*3) (x, z, yaw), feet: { ankleL, ankleR, ballL, ballR, toeL, toeR: Float32Array(n*3) in
 *   the target's metres, on a floor at y = 0 (world, not root-relative) } }
 */
export function retarget(take, T, { posSigma = 0.1, yawSigma = 0.2, root: pin = null, head = false } = {}) {
  const { map, landmarks: L } = take, n = take.n, B = T.bones;
  const up = new THREE.Vector3(0, 1, 0);
  // scale: the target's leg over the source's
  const P = (k, i, out) => take.point(k, i, out);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
  const srcLeg = P(map.thigh_l.from, 0, a).distanceTo(P(map.thigh_l.to, 0, b)) + P(map.calf_l.from, 0, a).distanceTo(P(map.calf_l.to, 0, b));
  const s = T.legLength / srcLeg;
  // The floor. A captured skeleton's ankle sits lower over its sole than ours (CMU's ankle joint is
  // ~5 cm up, ours ~10) and its foot lies flatter (ankle -> ball pitched ~13°, ours 31°): matched as
  // they are, our heel would go into the ground. So the floor is set by the ankles (their lowest,
  // the 5th percentile, is our ankle's height standing), and each foot is pitched down by the
  // difference between the two flat feet (footPitch below).
  const low = (k) => { const h = []; for (let i = 0; i < n; i++) h.push(P(k, i, a).y); h.sort((x, y) => x - y); return h[Math.floor(h.length * 0.05)]; };
  const floor = (low(L.ankleL) + low(L.ankleR)) / 2;
  const lift = T.ankleHeight;
  const W = (k, i, out) => { P(k, i, out); out.y -= floor; return out.multiplyScalar(s).setY(out.y + lift); };   // target metres
  // the source's flat foot: the median pitch of ankle -> ball while both are low (standing on it)
  const pitches = [];
  for (const [an, bl] of [[L.ankleL, L.ballL], [L.ankleR, L.ballR]]) {
    const a0 = low(an), b0 = low(bl);
    for (let i = 0; i < n; i++) {
      P(an, i, a); P(bl, i, b);
      if (a.y - a0 < 0.02 / s && b.y - b0 < 0.02 / s) pitches.push(Math.atan2(a.y - b.y, Math.hypot(b.x - a.x, b.z - a.z)));
    }
  }
  pitches.sort((x, y) => x - y);
  const footPitch = pitches.length > 10 ? T.footPitch - pitches[Math.floor(pitches.length / 2)] : 0;
  const footAxis = new THREE.Vector3(), footFix = new THREE.Quaternion();

  // the root: under the hips, facing the hips' way, smoothed
  const raw = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    W(L.hipL, i, a); W(L.hipR, i, b);
    const mid = c.addVectors(a, b).multiplyScalar(0.5);
    const across = d.subVectors(a, b); across.y = 0;
    const fwd = across.cross(up).normalize();   // left x up = forward
    raw[i * 3] = mid.x; raw[i * 3 + 1] = mid.z;
    raw[i * 3 + 2] = Math.atan2(fwd.x, fwd.z);
  }
  // unwrap the yaw before smoothing
  for (let i = 1; i < n; i++) { let y = raw[i * 3 + 2]; const p = raw[(i - 1) * 3 + 2]; while (y - p > Math.PI) y -= 2 * Math.PI; while (y - p < -Math.PI) y += 2 * Math.PI; raw[i * 3 + 2] = y; }
  const pos = gauss(raw.filter((_, k) => k % 3 !== 2), n, 2, posSigma * take.fps);
  const yaw = gauss(raw.filter((_, k) => k % 3 === 2), n, 1, yawSigma * take.fps);
  const root = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { root[i * 3] = pos[i * 2]; root[i * 3 + 1] = pos[i * 2 + 1]; root[i * 3 + 2] = yaw[i]; }
  // a root held still (`pin`): 'fixed' at its mean place and facing (a clip on the spot: the hips sway
  // over still feet), 'end' where it ends (a get-up: from lying down to standing there)
  if (pin === 'fixed' || pin === 'end') {
    let x = 0, z = 0, y = 0;
    if (pin === 'end') { x = root[(n - 1) * 3]; z = root[(n - 1) * 3 + 1]; y = root[(n - 1) * 3 + 2]; }
    else { for (let i = 0; i < n; i++) { x += root[i * 3]; z += root[i * 3 + 1]; y += root[i * 3 + 2]; } x /= n; z /= n; y /= n; }
    for (let i = 0; i < n; i++) { root[i * 3] = x; root[i * 3 + 1] = z; root[i * 3 + 2] = y; }
  }

  const local = Object.fromEntries(BONES.map((k) => [k, new Float32Array(n * 4)]));
  const pelvisPos = new Float32Array(n * 3);
  const feet = Object.fromEntries(['ankleL', 'ankleR', 'ballL', 'ballR', 'toeL', 'toeR'].map((k) => [k, new Float32Array(n * 3)]));
  const world = {};   // our bones' world rotations this frame (in the root's frame)
  const R = new THREE.Quaternion(), q = new THREE.Quaternion(), yq = new THREE.Quaternion(), yqi = new THREE.Quaternion(), fix = new THREE.Quaternion();
  const restOffset = T.bones.pelvis.wp.clone().sub(T.hipMid);   // the pelvis from the hips' midpoint, at rest (world)
  for (let i = 0; i < n; i++) {
    yq.setFromAxisAngle(up, root[i * 3 + 2]); yqi.copy(yq).invert();
    const rootPos = a.set(root[i * 3], 0, root[i * 3 + 1]).clone();
    for (const k of BONES) {
      // (a fixed bone keeps its rest turn on its parent: its children are aimed in the world all the same)
      // (`head`: the head's own turn too, for a clip that looks about: the Animator turns the skull with it)
      if (FIXED.has(k) && !(head && k === 'Head')) { world[k] = world[B[k].parent].clone().multiply(B[k].lq); continue; }
      const m = map[k];
      take.rotation(m.rot, i, R);
      q.copy(R).multiply(B[k].wq);                         // rest-relative transfer (world)
      if (m.aim) {
        const now = b.copy(B[k].restDir).applyQuaternion(R);
        const want = W(m.to, i, c).sub(W(m.from, i, d));
        // (a foot: pitched down by the flat feet's difference, about its own side axis)
        if (footPitch && k.startsWith('foot_')) {
          footAxis.crossVectors(up, want);
          if (footAxis.lengthSq() > 1e-8) want.applyQuaternion(footFix.setFromAxisAngle(footAxis.normalize(), footPitch));
        }
        if (want.lengthSq() > 1e-10) q.premultiply(fix.setFromUnitVectors(now.normalize(), want.normalize()));
      }
      world[k] = q.clone().premultiply(yqi);              // in the root's frame
    }
    for (const k of BONES) {
      const parentQ = B[k].parent === 'root' ? T.rootQ : world[B[k].parent];
      const lq = q.copy(parentQ).invert().multiply(world[k]);
      local[k].set([lq.x, lq.y, lq.z, lq.w], i * 4);
    }
    // the pelvis: the source's hips' midpoint (scaled), less the root, plus our pelvis' rest offset from the hips turned with it
    W(L.hipL, i, b); W(L.hipR, i, c);
    const mid = b.add(c).multiplyScalar(0.5).sub(rootPos).applyQuaternion(yqi);
    const off = d.copy(restOffset).applyQuaternion(world.pelvis.clone().multiply(B.pelvis.wq.clone().invert()));
    const pw = mid.add(off);                              // the pelvis in the root's frame (world axes)
    const pl = pw.applyQuaternion(T.rootQ.clone().invert());   // in the root bone's frame
    pelvisPos.set([pl.x, pl.y, pl.z], i * 3);
    for (const [k, lm] of Object.entries({ ankleL: L.ankleL, ankleR: L.ankleR, ballL: L.ballL, ballR: L.ballR, toeL: L.toeL, toeR: L.toeR })) {
      W(lm, i, b);
      feet[k].set([b.x, b.y, b.z], i * 3);
    }
  }
  // keep quaternions continuous (no sign flips from frame to frame: they're interpolated)
  for (const k of BONES) {
    const A = local[k];
    for (let i = 1; i < n; i++) {
      const dot = A[i * 4] * A[i * 4 - 4] + A[i * 4 + 1] * A[i * 4 - 3] + A[i * 4 + 2] * A[i * 4 - 2] + A[i * 4 + 3] * A[i * 4 - 1];
      if (dot < 0) for (let j = 0; j < 4; j++) A[i * 4 + j] = -A[i * 4 + j];
    }
  }
  return { fps: take.fps, n, scale: s, local, pelvisPos, root, feet, name: take.name, meta: take.meta };
}
