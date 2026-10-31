import * as THREE from 'three';
import { pivot } from './kit.js';
import { gazePart } from '../gaze.js';
import { humanoidSkeleton } from '../humanoid-rig.js';
import { tripoBody } from './dune-mummer-tripo.js';
import { skinWith } from './dune-mummer.js';

// The two-legged Tripo bodies of #800's family H (the prowler, the warlord): Tripo's biped rig posed directly by the
// clips, the dune mummer's way (plans/dune-mummer-tripo.js). The humanoid foe rig's joints (humanoidSkeleton) are stood
// where Tripo's rig put its joints (the asset's skeleton.json), the mesh skinned to them with Tripo's own weights, so the
// driver's clips pose the very bones the mesh hangs on (never a hidden skeleton copied over, #768's adapter). Tripo's 23
// joints fold onto the rig's: its three spine bones, the hips and the clavicles onto the torso, the neck and the head onto
// the head's look (the gaze turns it toward the traveller), the toes onto the feet; a body's own joints after Tripo's
// (the prowler's tail, `Tail0`…) onto the bones it gives (`extra`). The bind pose is the rig's joints turned to the
// T-pose of the mesh (each limb's −y along Tripo's bone), then let down to the rig's rest.
//
//   tripoBiped(g, src, o)  { rig, J, at, D, S, look, gaze, geo, bones, bind(mat), hands }:
//     o.look      the head's gaze reach { yaw, up, down }
//     o.extra     (J, look) → { name: Object3D } the bones a body adds for its own joints (made before the bind)
//     o.recolour  (role index per vertex, keys) → Float32Array colours, or null for the asset's own COLOR_0

/** Which rig joint carries each of Tripo's (by name). */
export const FOLD = { Root: 'torso', Hips: 'torso', Spine: 'torso', Spine1: 'torso', Spine2: 'torso', LeftShoulder: 'torso', RightShoulder: 'torso', Neck: 'head', Head: 'head',
  LeftArm: 'arm1', LeftForeArm: 'elbow1', LeftHand: 'hand1', RightArm: 'arm0', RightForeArm: 'elbow0', RightHand: 'hand0',
  LeftUpLeg: 'leg1', LeftLeg: 'knee1', LeftFoot: 'foot1', LeftToeBase: 'foot1', RightUpLeg: 'leg0', RightLeg: 'knee0', RightFoot: 'foot0', RightToeBase: 'foot0' };

const v3 = (a) => new THREE.Vector3(...a);
const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
/** j's world rotation made the one that points its −y along dir (world), its parent's read now. */
export function pointAlong(j, dir) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_p);
  _q.setFromUnitVectors(DOWN, dir.clone().normalize());
  j.quaternion.copy(_p.invert().multiply(_q));
  j.updateWorldMatrix(false, true);
}
/** j's world rotation made none (its frame the model's), its parent's read now. */
function level(j) { j.parent.updateWorldMatrix(true, false); j.parent.getWorldQuaternion(_p); j.quaternion.copy(_p.invert()); j.updateWorldMatrix(false, true); }

/** Each vertex's colour role: the nearest of `roles` (hex) to its COLOR_0 (the texture's own bytes: matched as they are, not made linear). */
export function rolesOf(col, roles) {
  const keys = Object.keys(roles), ref = keys.map((k) => { const h = parseInt(roles[k].slice(1), 16); return [(h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; });
  const role = new Uint8Array(col.count);
  for (let v = 0; v < col.count; v++) { let best = 0, dd = Infinity; ref.forEach((c, k) => { const e = (c[0] - col.getX(v)) ** 2 + (c[1] - col.getY(v)) ** 2 + (c[2] - col.getZ(v)) ** 2; if (e < dd) { dd = e; best = k; } }); role[v] = best; }
  return { keys, role };
}

export function tripoBiped(g, src, o = {}) {
  const rig = pivot(g, 0, 0, 0, 'rig');
  const S = src.rig ?? src.skeleton, { D, at } = tripoBody(S);
  const J = humanoidSkeleton(rig, D);
  // (each joint where Tripo put it: the torso at its hips, the limbs' roots at its, their lengths each side's own)
  J.torso.position.copy(at.Hips);
  J.head.position.copy(at.Neck).sub(at.Hips);
  const side = (i) => (i ? 'Left' : 'Right');
  for (const i of [0, 1]) {
    const s = side(i);
    J.legs[i].position.copy(at[`${s}UpLeg`]);
    J.knees[i].position.set(0, -at[`${s}UpLeg`].distanceTo(at[`${s}Leg`]), 0);
    J.feet[i].position.set(0, -at[`${s}Leg`].distanceTo(at[`${s}Foot`]), 0);
    J.arms[i].position.copy(at[`${s}Arm`]).sub(at.Hips);
    J.elbows[i].position.set(0, -at[`${s}Arm`].distanceTo(at[`${s}ForeArm`]), 0);
    J.hands[i].position.set(0, -at[`${s}ForeArm`].distanceTo(at[`${s}Hand`]), 0);
  }
  // the look (at rest: the gaze measures its frame now); its node is the head's bone
  const gaze = [gazePart(g, J.head, { mode: 'turn', ...(o.look ?? { yaw: 0.6, up: 0.3, down: 0.35 }) })], look = gaze[0].node;
  // ---------------------------------------------------------------- the bind pose: the rig's limbs along the mesh's T-pose
  g.updateMatrixWorld(true);
  const hc = S.hands;
  for (const i of [0, 1]) {
    const s = side(i);
    pointAlong(J.arms[i], at[`${s}ForeArm`].clone().sub(at[`${s}Arm`]));
    pointAlong(J.elbows[i], at[`${s}Hand`].clone().sub(at[`${s}ForeArm`]));
    pointAlong(J.hands[i], v3(hc[s].centre).sub(at[`${s}Hand`]));
    pointAlong(J.legs[i], at[`${s}Leg`].clone().sub(at[`${s}UpLeg`]));
    pointAlong(J.knees[i], at[`${s}Foot`].clone().sub(at[`${s}Leg`]));
    level(J.feet[i]);
  }
  g.updateMatrixWorld(true);
  const extra = o.extra ? o.extra(J, look, at) : {};
  g.updateMatrixWorld(true);
  // ---------------------------------------------------------------- the body: Tripo's weights folded onto the rig's joints
  const rigJ = { torso: J.torso, head: look, arm0: J.arms[0], arm1: J.arms[1], elbow0: J.elbows[0], elbow1: J.elbows[1], hand0: J.hands[0], hand1: J.hands[1], leg0: J.legs[0], leg1: J.legs[1], knee0: J.knees[0], knee1: J.knees[1], foot0: J.feet[0], foot1: J.feet[1], ...extra };
  const bones = [...new Set(Object.values(rigJ))], of = S.joints.map((j) => bones.indexOf(rigJ[FOLD[j.name] ?? j.name]));
  if (of.some((b) => b < 0)) throw new Error(`no bone for ${S.joints.filter((_, k) => of[k] < 0).map((j) => j.name)}`);
  const src0 = src.geometry, n = src0.attributes.position.count;
  const SI0 = src0.attributes.skinIndex, SW0 = src0.attributes.skinWeight, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const acc = new Map();
    for (let k = 0; k < 4; k++) { const w = SW0.getComponent(v, k); if (w <= 0) continue; const b = of[SI0.getComponent(v, k)]; acc.set(b, (acc.get(b) ?? 0) + w); }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([b, w], k) => { SI[v * 4 + k] = b; SW[v * 4 + k] = w / sum; });
    if (!top.length) { SI[v * 4] = 0; SW[v * 4] = 1; }
  }
  // (a stiff sole, o.soles m: a leg's vertices under it carried whole on its foot, so a broad pad tipped onto a slope stays
  //  flat, not bent at the ankle with its edge in the ground: family G's sentinel's, tripo-biped.js)
  if (o.soles) {
    const pos = src0.attributes.position, legs = new Set([J.legs, J.knees, J.feet].flat().map((j) => bones.indexOf(j)));
    for (let v = 0; v < n; v++) {
      if (pos.getY(v) >= o.soles || !legs.has(SI[v * 4])) continue;
      const b = bones.indexOf(J.feet[pos.getX(v) > 0 ? 1 : 0]);
      SI[v * 4] = b; SW[v * 4] = 1; for (let q = 1; q < 4; q++) { SI[v * 4 + q] = 0; SW[v * 4 + q] = 0; }
    }
  }
  // (each foot's sole: its lowest vertices' outermost few, in the foot's own frame (level at the bind, as at the rig's
  //  rest): what `soleUp` keeps over the ground)
  const soles = [0, 1].map((i) => {
    const b = bones.indexOf(J.feet[i]), pos = src0.attributes.position, foot = J.feet[i].getWorldPosition(new THREE.Vector3()), pts = [];
    for (let v = 0; v < n; v++) if (SI[v * 4] === b && pos.getY(v) < 0.03) pts.push(new THREE.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v)).sub(foot));
    const ext = (f) => pts.reduce((a, p) => (f(p) > f(a) ? p : a), pts[0]);
    return pts.length ? [ext((p) => p.x), ext((p) => -p.x), ext((p) => p.z), ext((p) => -p.z), ext((p) => p.x + p.z), ext((p) => p.x - p.z), ext((p) => -p.x + p.z), ext((p) => -p.x - p.z)] : [];
  });
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) geo.setAttribute(k, src0.attributes[k]);
  const own = o.recolour?.(src0.attributes.color) ?? null;
  geo.setAttribute('color', own ? new THREE.BufferAttribute(own, 3) : src0.attributes.color);
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setIndex(src0.index);
  /** Bound in the bind pose, then the rig's rest (its limbs let down: the clips pose them from there). */
  const bind = (mat) => {
    const body = skinWith(g, geo, mat, bones); body.name = 'tripo body';
    for (const j of [...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet]) j.quaternion.identity();
    g.updateMatrixWorld(true);
    return body;
  };
  /**
   * Its broad soles kept over the ground as posed (after the driver, before what hangs off it): the whole body raised by
   * the deepest sole corner under the ground under it (`ground(x, y, z)`, the kit's; else `floor`), at most `most` m. A
   * Tripo pad is longer and wider than the traveller's foot the clips are made for: on a slope its heel's edge went 3 cm in.
   */
  const _sp = new THREE.Vector3();
  const soleUp = (ground, floor, most = 0.06) => {
    rig.updateMatrixWorld(true);
    let dip = 0;
    for (const [i, pts] of soles.entries()) for (const p of pts) {
      _sp.copy(p).applyMatrix4(J.feet[i].matrixWorld);
      const gy = ground?.(_sp.x, _sp.y + 0.5, _sp.z) ?? floor;
      if (Number.isFinite(gy)) dip = Math.max(dip, gy - _sp.y);
    }
    if (dip <= 0) return 0;
    const s = rig.getWorldScale(_sp).y || 1;
    J.body.position.y += Math.min(most, dip) / s;
    J.body.updateMatrixWorld(true);
    return dip;
  };
  return { rig, J, at, D, S, look, gaze, geo, bones, bind, hands: hc, side, soleUp, soles };
}
