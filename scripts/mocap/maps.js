// Skeleton maps for joint-based files (BVH, FBX): our bone (the UAL library's names) <- the source
// joint whose rotation it takes, aimed from that joint to the next (see asf-amc.js CMU_MAP for the
// ASF one, whose points are bone ends instead).
const side = (L, R, f) => Object.fromEntries(['l', 'r'].flatMap((s) => f(s, s === 'l' ? L : R)));

/** Mixamo's rig ("mixamorig:" prefixes stripped). */
export const MIXAMO_MAP = {
  pelvis: { rot: 'Hips' },
  spine_01: { rot: 'Spine', from: 'Spine', to: 'Spine1', aim: true },
  spine_02: { rot: 'Spine1', from: 'Spine1', to: 'Spine2', aim: true },
  spine_03: { rot: 'Spine2', from: 'Spine2', to: 'Neck', aim: true },
  neck_01: { rot: 'Neck', from: 'Neck', to: 'Head', aim: true },
  Head: { rot: 'Head' },
  ...side('Left', 'Right', (s, S) => [
    [`clavicle_${s}`, { rot: `${S}Shoulder`, from: `${S}Shoulder`, to: `${S}Arm`, aim: true }],
    [`upperarm_${s}`, { rot: `${S}Arm`, from: `${S}Arm`, to: `${S}ForeArm`, aim: true }],
    [`lowerarm_${s}`, { rot: `${S}ForeArm`, from: `${S}ForeArm`, to: `${S}Hand`, aim: true }],
    [`hand_${s}`, { rot: `${S}Hand`, from: `${S}Hand`, to: `${S}HandMiddle1`, aim: true }],
    [`thigh_${s}`, { rot: `${S}UpLeg`, from: `${S}UpLeg`, to: `${S}Leg`, aim: true }],
    [`calf_${s}`, { rot: `${S}Leg`, from: `${S}Leg`, to: `${S}Foot`, aim: true }],
    [`foot_${s}`, { rot: `${S}Foot`, from: `${S}Foot`, to: `${S}ToeBase`, aim: true }],
  ]),
};
export const MIXAMO_POINTS = { hipL: 'LeftUpLeg', hipR: 'RightUpLeg', ankleL: 'LeftFoot', ankleR: 'RightFoot', ballL: 'LeftToeBase', ballR: 'RightToeBase', toeL: 'LeftToe_End', toeR: 'RightToe_End', head: 'Head' };

/** The CMU database as BVH (Bruce Hahne's conversion, cgspeed: MotionBuilder-friendly). */
export const CGSPEED_MAP = {
  pelvis: { rot: 'Hips' },
  spine_01: { rot: 'LowerBack', from: 'LowerBack', to: 'Spine', aim: true },
  spine_02: { rot: 'Spine', from: 'Spine', to: 'Spine1', aim: true },
  spine_03: { rot: 'Spine1', from: 'Spine1', to: 'Neck', aim: true },
  neck_01: { rot: 'Neck', from: 'Neck', to: 'Head', aim: true },
  Head: { rot: 'Head' },
  ...side('Left', 'Right', (s, S) => [
    [`clavicle_${s}`, { rot: `${S}Shoulder`, from: `${S}Shoulder`, to: `${S}Arm`, aim: true }],
    [`upperarm_${s}`, { rot: `${S}Arm`, from: `${S}Arm`, to: `${S}ForeArm`, aim: true }],
    [`lowerarm_${s}`, { rot: `${S}ForeArm`, from: `${S}ForeArm`, to: `${S}Hand`, aim: true }],
    [`hand_${s}`, { rot: `${S}Hand`, from: `${S}Hand`, to: `${S}FingerBase`, aim: true }],
    [`thigh_${s}`, { rot: `${S}UpLeg`, from: `${S}UpLeg`, to: `${S}Leg`, aim: true }],
    [`calf_${s}`, { rot: `${S}Leg`, from: `${S}Leg`, to: `${S}Foot`, aim: true }],
    [`foot_${s}`, { rot: `${S}Foot`, from: `${S}Foot`, to: `${S}ToeBase`, aim: true }],
  ]),
};
export const CGSPEED_POINTS = { hipL: 'LeftUpLeg', hipR: 'RightUpLeg', ankleL: 'LeftFoot', ankleR: 'RightFoot', ballL: 'LeftToeBase', ballR: 'RightToeBase', toeL: 'LeftToeBase', toeR: 'RightToeBase', head: 'Head' };

/** The map for a skeleton, from its joint names (Mixamo or the cgspeed CMU BVH); null if neither. */
export function mapFor(names) {
  const has = (n) => names.includes(n);
  const fix = (map, pts) => {
    // a missing aim target (no finger bones, say): keep the rotation, drop the aim
    const m = {};
    for (const [k, v] of Object.entries(map)) m[k] = v.aim && !(has(v.from) && has(v.to)) ? { rot: v.rot } : v;
    const missing = Object.values(m).map((v) => v.rot).filter((n) => !has(n));
    return missing.length ? null : { map: m, landmarks: pts };
  };
  if (has('LowerBack') && has('LeftUpLeg')) return fix(CGSPEED_MAP, CGSPEED_POINTS);
  if (has('Hips') && has('Spine2') && has('LeftUpLeg')) return fix(MIXAMO_MAP, MIXAMO_POINTS);
  return null;
}

/** A source joint's other side: Left <-> Right (Mixamo, BVH), lfemur <-> rfemur (CMU's ASF). */
const CMU_SIDED = /^([lr])(hipjoint|femur|tibia|foot|toes|clavicle|humerus|radius|wrist|hand|fingers|thumb)$/;
export const otherSide = (n) => (/Left/.test(n) ? n.replace('Left', 'Right') : /Right/.test(n) ? n.replace('Right', 'Left')
  : CMU_SIDED.test(n) ? n.replace(CMU_SIDED, (_, s, b) => (s === 'l' ? 'r' : 'l') + b) : n);
