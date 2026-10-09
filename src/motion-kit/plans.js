// The body plans on the kit (docs/systems/procedural-animation.md, §4 "The body plans"), as Spore's parameter
// tables: one kit, a table per plan. Lengths are shares of the plan's leg length L (thigh + shin), so a plan
// fits any size of creature; angles in rad. Read by src/motion-kit/rig.js.
//
//   gait   gait ('alternate' | 'wave' | 'lateral', or a function of the leg count), drift (half a stride, × L),
//          stepTime [shortest, longest] swing (s), height (the lift, × L), arc ('organic' | 'machine'), duty (the
//          far tier's canned cycle), reach (× L: a foot dragged this far steps whatever the groups say)
//   knee   lenA, lenB: thigh and shin as shares of the hip-to-foot distance at rest (their sum over 1 is the bend)
//   body   bob (× L), lean (rad per m/s²), bank (rad per rad/s × m/s), sway, tilt, spring / height { f, z, r }
//   poses  the key poses (src/motion-kit/pose.js): y and z × L; a coil per attack where they must read apart
//   style  'organic' | 'machine' (harder springs, a servo's notches)

export const PLANS = {
  // plan 1: crabs and spiders, 6 to 8 legs: a tripod or alternating tetrapods, knees out and up, hold-then-burst
  walker: {
    gait: { gait: 'alternate', drift: 0.3, stepTime: [0.09, 0.3], height: 0.24, arc: 'organic', duty: 0.6, reach: 0.5 },
    knee: { lenA: 0.68, lenB: 0.72, pole: 'out-up' },
    body: { bob: 0.05, lean: 0.025, bank: 0.03, sway: 0.1, tilt: 0.3, spring: { f: 4, z: 0.55, r: 0 }, height: { f: 4.5, z: 0.5, r: 0 } },
    poses: {
      coil: { y: -0.14, z: -0.12, pitch: -0.14, spread: 1.18 },        // (squats back on its legs, claws up)
      strike: { y: -0.02, z: 0.16, pitch: 0.12 },
      recover: { y: -0.1, z: 0.04, pitch: 0.06 },
      hurt: { y: -0.08, roll: 0.12 },
      'coil:spin': { y: -0.2, z: 0, pitch: 0, spread: 1.0 },           // (the spin tucks in: no lean)
      'strike:spin': { y: -0.2 },
    },
    style: 'organic',
  },
  // plan 6: hounds and lizards on four legs: a trot on diagonal pairs, hocks back, the head steady
  quadruped: {
    gait: { gait: 'alternate', drift: 0.4, stepTime: [0.07, 0.28], height: 0.22, arc: 'organic', duty: 0.55, reach: 0.5 },
    knee: { lenA: 0.62, lenB: 0.62, pole: 'beast' },
    body: { bob: 0.05, lean: 0.03, bank: 0.05, sway: 0.15, tilt: 0.3, spring: { f: 3.5, z: 0.55, r: 0 } },
    poses: {
      coil: { y: -0.22, z: -0.16, pitch: 0.16, spread: 1.12 },         // (back on its haunches)
      strike: { y: 0.05, z: 0.2, pitch: -0.12 },
      recover: { y: -0.12, z: 0.06, pitch: 0.05 },
      hurt: { y: -0.1, roll: 0.15 },
    },
    air: { front: { y: 0.18, z: 0.3 }, hind: { y: 0.18, z: -0.3 } },  // (stretched out through a leap, × L)
    style: 'organic',
  },
  // plan 6 for a dog (src/dog.js: Moustache at home): a trot on diagonal pairs on long legs, hocks back; a longer,
  // lower step than the hound's, a light body that settles soft; no attacks, so only the rest pose
  dog: {
    gait: { gait: 'alternate', drift: 0.44, stepTime: [0.08, 0.3], height: 0.17, arc: 'organic', duty: 0.6, reach: 0.6 },
    knee: { lenA: 0.6, lenB: 0.6, pole: 'beast' },
    body: { bob: 0.03, lean: 0.025, bank: 0.05, sway: 0.12, tilt: 0.28, spring: { f: 3.2, z: 0.62, r: 0 } },
    poses: {},
    air: { front: { y: 0.12, z: 0.18 }, hind: { y: 0.12, z: -0.18 } },
    style: 'organic',
  },
  // plan 18: the makers' machines on pistons, two or three legs: a wave, steps as three straight moves, hard stops
  machine: {
    gait: { gait: (n) => (n === 3 ? 'wave' : 'alternate'), drift: 0.24, stepTime: [0.14, 0.42], height: 0.17, arc: 'machine', duty: 0.7, reach: 0.4 },
    knee: { lenA: 0.62, lenB: 0.62, pole: 'out-up' },
    body: { bob: 0.035, lean: 0.02, bank: 0.02, sway: 0.25, tilt: 0.22, spring: { f: 5.5, z: 0.45, r: 0 } },
    poses: {
      coil: { y: -0.16, z: -0.1, pitch: -0.12, spread: 1.15 },         // (sinks on its pistons, leans back)
      strike: { y: 0.02, z: 0.12, pitch: 0.16 },
      recover: { y: -0.12, pitch: 0.1 },
      hurt: { y: -0.06, roll: 0.1 },
    },
    style: 'machine',
  },
};

/** The pole (the knee's side) for a leg whose rest foot is at {x, z} (body frame), by the plan's rule. */
export function poleFor(rule, foot) {
  const side = Math.sign(foot.x) || 1;
  if (rule === 'beast') return { x: 0, y: 0.15, z: foot.z >= 0 ? 0.6 : -1 };   // (front knees forward, hocks back)
  if (rule === 'forward') return { x: 0, y: 0.1, z: 1 };
  // out and up, away from the body's centre
  const r = Math.hypot(foot.x, foot.z) || 1;
  return { x: (foot.x / r) * 1 + side * 0.001, y: 1.1, z: foot.z / r };
}
