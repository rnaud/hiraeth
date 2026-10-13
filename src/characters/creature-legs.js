import * as T from 'three';
import { matrixTo } from '../motion-kit/rig.js';

// A generated creature's leg bones driven from the motion kit's solved legs (src/motion-kit/rig.js write): the
// Keeper's six and the Elder's two (src/characters/keeper-creature.js, elder-creature.js; docs/systems/characters.md
// "Leg bones in their bend plane").
//
// The kit aims its own rigid segments with the shortest turn from +Y (ik.js aim). That is fine for a round cylinder,
// but a skin hangs off-axis knees, hocks and toes on those frames, and for a segment pointing nearly straight down
// the shortest turn from +Y is ill-defined: a tiny change of direction spun the Elder's thighs and the Keeper's
// shins half a turn about their own length in one frame (the wobble of issue #237). Here each thigh and shin is
// framed in the leg's bend plane instead (+Y along the segment, +Z toward the pole, which the kit keeps fixed to the
// body), times the bone's own rest offset, so the bind pose stays exact and a bone only turns as its leg bends.
// A planted foot keeps the heading it landed with (no toes spinning on the floor as the body turns); a swinging one
// turns to the body's heading by the end of its swing; `curl` (rad) folds the toes down and back about the ankle
// (a bird's flight tuck).

const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _x = new T.Vector3(), _z = new T.Vector3();
const _hip = new T.Vector3(), _knee = new T.Vector3(), _end = new T.Vector3(), _side = new T.Vector3(), _d = new T.Vector3(), _yq = new T.Quaternion(), _cq = new T.Quaternion();
const UP = new T.Vector3(0, 1, 0), X = new T.Vector3(1, 0, 0);

/** The frame with +Y along `dir` and +Z toward `side`'s part across it (null when side is along dir). */
export function bendFrame(dir, side, out) {
  _p.copy(dir).normalize();
  _z.copy(side).addScaledVector(_p, -side.dot(_p));
  if (_z.lengthSq() < 1e-10) return null;
  _z.normalize();
  _x.crossVectors(_p, _z);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _p, _z));
}

export class SkinLegs {
  /**
   * kit: the creature's GuardianLegs; bones: { name: Bone } with leg<i>_thigh / _shin / _foot as children of `group`
   * (their rest pose is the bind pose); body: what the hips ride on (its rest is the group's frame).
   */
  constructor({ kit, bones, group, body }) {
    this.kit = kit; this.group = group; this.body = body;
    this.legs = kit.legs.map((L, i) => {
      const thigh = bones[`leg${i}_thigh`], shin = bones[`leg${i}_shin`], foot = bones[`leg${i}_foot`];
      const hip = thigh.position.clone(), knee = shin.position.clone(), end = foot.position.clone().add(new T.Vector3(0, L.ankle, 0));
      const offset = (b, from, to) => {
        const f = bendFrame(_d.subVectors(to, from), L.pole, new T.Quaternion());
        return f ? f.invert().multiply(b.quaternion) : b.quaternion.clone();
      };
      return {
        L, thigh, shin, foot, offThigh: offset(thigh, hip, knee), offShin: offset(shin, knee, end), footRest: foot.quaternion.clone(),
        qThigh: new T.Quaternion(), qShin: new T.Quaternion(), yaw: null, from: 0, t: 0,
      };
    });
  }
  /** Leg i's foot heading in the world (rad): held while planted. */
  footYaw(i) { return this.legs[i].yaw; }
  /** After kit.write(): the bones from the kit's solved chains. heading: the creature's (rad); curl: per leg or one (rad). */
  write(heading, { curl = 0, air = 0 } = {}) {
    const body = matrixTo(this.body, this.group, _m);
    body.decompose(_s, _q, _s);
    const feet = this.kit.rig.planner.feet;
    this.legs.forEach((S, i) => {
      const L = S.L, f = feet[i];
      _hip.copy(L.root.position);
      _knee.copy(L.shin.position).add(_hip);
      _end.copy(L.foot.position).add(_hip); _end.y += L.ankle;
      _side.copy(L.pole).applyQuaternion(_q);
      if (bendFrame(_d.subVectors(_knee, _hip), _side, S.qThigh)) S.qThigh.multiply(S.offThigh);
      if (bendFrame(_d.subVectors(_end, _knee), _side, S.qShin)) S.qShin.multiply(S.offShin);
      S.thigh.position.copy(_hip); S.thigh.quaternion.copy(S.qThigh);
      S.shin.position.copy(_knee); S.shin.quaternion.copy(S.qShin);
      // the foot's heading: held planted, turned to the body's over a swing (and at once off the ground)
      if (S.yaw === null || air > 0.5) { S.yaw = heading; S.from = heading; }
      else if (f.planted || f.t < S.t) S.from = S.yaw;   // (planted, or a new swing begun the frame the last one landed)
      if (!f.planted && air <= 0.5) {
        const k = T.MathUtils.smootherstep(f.t, 0.1, 0.9), d = Math.atan2(Math.sin(heading - S.from), Math.cos(heading - S.from));
        S.yaw = S.from + d * k;
      }
      S.t = f.planted ? 0 : f.t;
      const c = Array.isArray(curl) ? curl[i] ?? 0 : curl;
      _yq.setFromAxisAngle(UP, S.yaw - heading);
      _cq.setFromAxisAngle(X, c);
      S.foot.quaternion.copy(_yq).multiply(_cq).multiply(S.footRest);
      // (turned about the ankle, not the sole: the ankle stays where the shin ends)
      S.foot.position.set(0, -L.ankle, 0).applyQuaternion(_yq.multiply(_cq)).add(_end);
    });
  }
}
