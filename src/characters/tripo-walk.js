import { Quaternion, Vector3, MathUtils } from 'three';

// Character-specific walk/jog styling, after Animator.apply and before Humanoid.update.
// Rotate the entire arm together so elbow bend and fore/aft swing are preserved.
// Keep 7 degrees of walk clearance and 12 degrees when jogging; never modify climbing or the bind pose.
export function relaxWalkArms(char, motion, enabled = true, options = {}) {
  if (!enabled || !['walk','jog'].includes(motion)) return [];
  char.root.updateMatrixWorld(true);
  const rootQ = char.root.getWorldQuaternion(new Quaternion());
  return char.arms.map((arm, i) => {
    const dir = char.elbows[i].getWorldPosition(new Vector3()).sub(arm.getWorldPosition(new Vector3()))
      .applyQuaternion(rootQ.clone().invert()).normalize();
    const side = i === 0 ? -1 : 1;
    const angle = Math.atan2(dir.x * side, -dir.y);
    const minimum=options.minimum ?? (motion==='jog'?12:7), maximum=options.maximum ?? (motion==='jog'?40:8);
    const amount = MathUtils.clamp(angle - MathUtils.degToRad(minimum), 0, MathUtils.degToRad(maximum)) * (options.weight ?? 1);
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1).applyQuaternion(rootQ), -side * amount);
    const world = arm.getWorldQuaternion(new Quaternion()).premultiply(rotation);
    arm.quaternion.copy(arm.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));
    arm.updateMatrixWorld(true);
    return rotation;
  });
}

export function relaxWalkHands(humanoid, rotations) {
  ['r', 'l'].forEach((side, i) => {
    if (!rotations[i]) return;
    const hand = humanoid.b[`hand_${side}`];
    const world = hand.getWorldQuaternion(new Quaternion()).premultiply(rotations[i]);
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));
    hand.updateMatrixWorld(true);
  });
}

// The source seated clip is Driving_Loop. Retain its body/leg motion but place
// the hands on the lap, instead of preserving a steering-wheel reach and roll.
export function seatTripoArms(h,motion){
 if(motion!=='drive')return;
 const root=h.char.root,q=root.getWorldQuaternion(new Quaternion()),up=new Vector3(0,1,0).applyQuaternion(q),right=new Vector3(1,0,0).applyQuaternion(q),forward=new Vector3(0,0,1).applyQuaternion(q);
 for(const [side,sign]of [['r',-1],['l',1]]){
  const upper=h.b['upperarm_'+side],lower=h.b['lowerarm_'+side],hand=h.b['hand_'+side];
  const hip=h.b['thigh_'+side].getWorldPosition(new Vector3()),knee=h.b['calf_'+side].getWorldPosition(new Vector3());
  const target=hip.clone().lerp(knee,.45).addScaledVector(up,.115).addScaledVector(right,sign*.025);
  const pole=upper.getWorldPosition(new Vector3()).addScaledVector(up,-.32).addScaledVector(right,sign*.08).addScaledVector(forward,-.04);
  h.solveTwoBone(upper,lower,hand,target,pole);
  const along=hand.getWorldPosition(new Vector3()).sub(lower.getWorldPosition(new Vector3()));
  const restAlong=h.rest.get(hand).p.clone().sub(h.rest.get(lower).p),frame=h.handFrames[side];
  // Share the palm-down roll with the forearm, avoiding a twisted wrist cuff.
  h.orientContact(lower,restAlong,frame.normal,along,up.clone().negate());
  h.orientContact(hand,frame.along,frame.normal,knee.clone().sub(hip),up.clone().negate());
 }
}
