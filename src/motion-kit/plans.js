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
  // ---------------------------------------------------------------- phase 5: the roster's batch 3
  // plan 2: the tiny skitterers (a swarm of 6 to 12): six short legs each, knees high over the dome, a quick tripod;
  // the planner runs at the mid tier at most (every 2nd frame: `tier`), each member out of step with the next so a
  // flock reads as a ripple; a light body that twitches (fast, underdamped springs)
  skitterers: {
    gait: { gait: 'alternate', drift: 0.32, stepTime: [0.05, 0.16], height: 0.3, arc: 'organic', duty: 0.55, reach: 0.55 },
    knee: { lenA: 1.22, lenB: 1.42, pole: 'out-up' },                   // (long for the short hip-to-foot span: the knees ride up level with the dome)
    body: { bob: 0.06, lean: 0.03, bank: 0.04, sway: 0.12, tilt: 0.35, spring: { f: 7, z: 0.42, r: 0 }, height: { f: 8, z: 0.45, r: 0 } },
    tier: 'mid',
    poses: {
      coil: { y: 0.3, z: -0.2, pitch: -1.05, spread: 1.1 },           // (the rush: reared up on its back legs, front legs raised)
      strike: { y: -0.02, z: 0.5, pitch: 0.2 },
      recover: { y: -0.05, pitch: 0.1 },
      hurt: { y: -0.05, roll: 0.3 },
      'coil:pile': { y: -0.1, z: 0, pitch: 0.05, spread: 1.3 },     // (the heap's foot: braced wide under the others)
      'strike:pile': { y: -0.15, z: 0.3, pitch: 0.4 },
    },
    style: 'organic',
  },
  // plan 5: the hopper (the bellows toad): ballistic hops: crouch, launch, a tuck in the air, a squashed landing with
  // a puff of dust. Its drawn root goes hop by hop (src/enemies/plans/hopper.js), so between hops it stands still on
  // planted feet and the rig only settles them (turning on the spot steps them round); in the air they tuck.
  hopper: {
    hop: { length: 1.15, air: 0.36, height: 0.5, crouch: 0.14, squash: 0.2, gap: 0.1, catchUp: 0.62 },   // (m, s; catchUp: m it lags before it hops, so a slower toad hops less often)
    gait: { gait: 'alternate', drift: 0.3, stepTime: [0.14, 0.32], height: 0.16, arc: 'organic', duty: 0.6, reach: 0.6 },
    knee: { lenA: 0.6, lenB: 0.62, pole: 'beast' },
    body: { bob: 0.02, lean: 0.02, bank: 0.02, sway: 0.06, tilt: 0.2, spring: { f: 3.2, z: 0.45, r: 0 } },
    poses: {
      coil: { y: 0.04, z: -0.12, pitch: -0.32 },                      // (the lob: it rears back, the swollen throat high)
      strike: { y: 0, z: 0.1, pitch: 0.15 },
      recover: { y: -0.06, pitch: 0.06 },
      hurt: { y: -0.08, roll: 0.15 },
      'coil:flop': { y: -0.3, z: -0.05, pitch: 0.12, spread: 1.15 },  // (the belly flop: a deep crouch, legs shaking)
      'strike:flop': { y: 0, z: 0, pitch: 0 },                         // (in the air: the arc is the hop's, src/enemies/plans/hopper.js)
    },
    style: 'organic',
  },
  // plan 7: the stilt-walker (the stilt heron; StiltMotor's rules, src/aliens/alien.js, as a table of the kit): two
  // long legs stepping one at a time (a wave on two), a long slow swing and a high lift, the bird's joint halfway down
  // bending back (pole 'back'); the high body on a soft spring that sways over the planted foot and lags a push
  stilt: {
    gait: { gait: 'alternate', drift: 0.5, stepTime: [0.3, 0.62], height: 0.13, arc: 'organic', duty: 0.7, reach: 0.62 },
    knee: { lenA: 0.37, lenB: 0.71, pole: 'back' },                     // (a short thigh, a long shank: the joint two thirds up)
    body: { bob: 0.035, lean: 0.06, bank: 0.05, sway: 0.4, tilt: 0.18, spring: { f: 1.5, z: 0.38, r: 0 }, height: { f: 2.4, z: 0.5, r: 0 } },
    sway: { f: 1.1, z: 0.3, push: 0.5 },                               // (the high body's own pendulum: StiltMotor's hub)
    poses: {
      coil: { y: 0.02, z: -0.12, pitch: -0.16, spread: 1.12 },        // (the spear: leaning back, the neck drawn into an S)
      strike: { y: -0.12, z: 0.16, pitch: 0.3 },                       // (all at once: it dips and pitches into the thrust)
      recover: { y: -0.03, z: 0.05, pitch: 0.08 },
      hurt: { y: -0.08, roll: 0.12 },
      'coil:sweep': { y: 0.03, z: 0, pitch: 0, roll: 0.1, spread: 1 },  // (one foot raised high: its weight on the other)
      'coil:buffet': { y: 0.02, z: -0.08, pitch: -0.1 },
    },
    style: 'organic',
  },
  // plan 12: the tentacled (the root knot): five root-arms, each three segments with two bends solved by FABRIK
  // (src/motion-kit/ik.js) from a curled guess, their tips planted as feet; the body carried between them, slow and
  // heavy, stepping one arm at a time round the ring
  tentacled: {
    gait: { gait: 'wave', drift: 0.26, stepTime: [0.28, 0.6], height: 0.14, arc: 'organic', duty: 0.75, reach: 0.5 },
    knee: { lenA: 0.4, lenB: 0.4, lenC: 0.31, pole: 'out-up' },
    body: { bob: 0.04, lean: 0.03, bank: 0.03, sway: 0.25, tilt: 0.16, spring: { f: 1.6, z: 0.55, r: 0 }, height: { f: 1.8, z: 0.6, r: 0 } },
    poses: {
      coil: { y: -0.12, z: -0.04, pitch: 0.28, spread: 1.05 },        // (the grip: two arms plunged in front, the cap tipped to you)
      strike: { y: -0.05, z: 0.08, pitch: 0.18 },
      recover: { y: -0.06, pitch: 0.06 },
      hurt: { y: -0.1, roll: 0.1 },
      'coil:lash': { y: 0.04, z: -0.12, pitch: -0.18 },               // (the lash: two arms coiled back high)
      'strike:lash': { y: 0, z: 0.14, pitch: 0.22 },
      'coil:puff': { y: -0.18, z: 0, pitch: 0 },                        // (the puff: it squats and its cap shudders)
    },
    style: 'organic',
  },
  // ---------------------------------------------------------------- phase 5 (cont.): the roster's batch 4, the machines
  // plan 8: the giant slow brute (the furnace brute): two short legs, the knee bending forward, a long stance and a slow
  // heavy step; the body on soft underdamped springs, so it dips deep at each footfall and overshoots when it stops, and
  // its hips shift over the standing foot (a big sway); its long arms swing from the shoulders (src/enemies/plans/brute.js)
  brute: {
    gait: { gait: 'alternate', drift: 0.36, stepTime: [0.38, 0.72], height: 0.14, arc: 'organic', duty: 0.72, reach: 0.5 },
    knee: { lenA: 0.56, lenB: 0.56, pole: 'forward' },
    body: { bob: 0.1, lean: 0.035, bank: 0.02, sway: 0.55, tilt: 0.16, spring: { f: 1.5, z: 0.42, r: 0 }, height: { f: 2.1, z: 0.32, r: 0 } },
    poses: {
      coil: { y: -0.06, z: -0.1, pitch: -0.26, spread: 1.18 },        // (the slam: both fists over the top, the torso arched back)
      strike: { y: -0.2, z: 0.18, pitch: 0.32 },                       // (down onto the fists, all its weight)
      recover: { y: -0.12, z: 0.04, pitch: 0.14 },
      hurt: { y: -0.06, roll: 0.08 },
      'coil:hurl': { y: -0.18, z: 0.04, pitch: 0.3, spread: 1.15 },    // (bent over, tearing up the slab: it straightens to throw)
      'strike:hurl': { y: 0, z: 0.06, pitch: -0.1 },
      'coil:sweep': { y: -0.05, z: -0.02, yaw: 0.55, spread: 1.12 },  // (the backhand: one arm swung back, the shoulder turned)
      'strike:sweep': { y: -0.06, z: 0.04, yaw: -0.65 },
    },
    style: 'organic',
  },
  // plan 19: the siege machine (the bell walker): five short spider legs round a hub, one at a time round the ring (a
  // wave), a very slow step in a machine's three straight moves; the great bell on its yoke rides on stiff springs and
  // swings with its own lag, the clapper a pendulum inside it (src/motion-kit/machines.js Pendulum)
  siege: {
    gait: { gait: 'wave', drift: 0.3, stepTime: [0.32, 0.6], height: 0.2, arc: 'machine', duty: 0.8, reach: 0.5 },
    knee: { lenA: 0.4, lenB: 1.08, pole: 'out-up' },                   // (a short thigh rising out of the hub to a high knee, a long shin down)
    body: { bob: 0.04, lean: 0.03, bank: 0.02, sway: 0.2, tilt: 0.14, spring: { f: 2.2, z: 0.5, r: 0 }, height: { f: 2.6, z: 0.55, r: 0 } },
    swing: { length: 1.25, damping: 0.6, drive: 0.5 },                  // (the bell on its yoke: a pendulum of `length` m)
    clapper: { length: 1.15, damping: 0.35, drive: 1 },
    poses: {
      coil: { y: 0.08, z: -0.16, pitch: -0.34, spread: 1.1 },         // (the toll: reared back on its rear legs, the clapper swinging higher)
      strike: { y: -0.04, z: 0.08, pitch: 0.12 },
      recover: { y: -0.04, pitch: 0.04 },
      hurt: { y: -0.08, roll: 0.06 },
      'coil:drop': { y: 0.5, z: 0, pitch: 0, spread: 0.9 },           // (the drop: its legs straighten and the bell rises a metre)
      'strike:drop': { y: -0.2, z: 0, pitch: 0 },
    },
    style: 'machine',
  },
  // plan 17: the tracked machine (the crucible cart): no legs; two tracks that turn by the distance each side covered
  // (src/motion-kit/machines.js TrackDrive: never a slip, a turn on the spot runs them opposite ways), the chassis
  // pitching and rolling on springs over the ground under its four corners, a turret that turns on a slow spring with
  // a servo's overshoot (ζ 0.4) and notches
  tracked: {
    track: { gauge: 1.5, length: 1.9, wheel: 0.17 },
    body: { spring: { f: 2.4, z: 0.38, r: 0 }, tilt: 0.25, settle: 0.04 },
    turret: { f: 1.1, z: 0.4, r: 0, notch: 0.035 },
    poses: {
      coil: { y: -0.04, z: -0.06, pitch: -0.08 },                       // (the pour: it sits back on its springs as the crucible tips)
      strike: { y: 0, z: 0.05, pitch: 0.06 },
      recover: { y: -0.02, pitch: 0.03 },
      hurt: { y: -0.03, roll: 0.06 },
      'coil:ram': { y: -0.06, z: -0.12, pitch: -0.12 },               // (the ram: backed up, squatting on its springs, the tracks spinning)
      'strike:ram': { y: 0, z: 0.1, pitch: 0.14 },
    },
    style: 'machine',
  },
  // plan 13 for a machine (the ring drone): no wings; it hovers on springs, its plates spinning at their own speeds, and
  // tilts with a servo's overshoot (underdamped, ζ 0.35); its aim moves in notches (src/enemies/plans/hover.js)
  hover: {
    plates: { spin: [0.7, -1.1, 1.5], lock: 11 },                     // (rad/s each plate idling; spun up and locked for the ram)
    body: { tilt: 0.05, tiltMax: 0.4, bob: 0.08, spring: { f: 2.4, z: 0.35, r: 0 } },
    aim: 0.12,                                                         // (rad: the notches its aim moves in)
    poses: {
      coil: { y: 0.12, z: -0.1, pitch: -0.1 },                         // (the harpoon: the plates part, it draws back a little)
      strike: { y: 0, z: 0.1, pitch: 0.12 },
      recover: { y: -0.08 },
      hurt: { y: -0.2, roll: 0.4 },
      'coil:ram': { y: 0.45, z: -0.2, pitch: -0.3 },                   // (the ram: it rises, rocked back, plates locked and spinning up)
      'strike:ram': { y: -0.3, z: 0.3, pitch: 0.4 },
    },
    style: 'machine',
  },
  // ---------------------------------------------------------------- the chain plans (kit phase 4: src/motion-kit/chain.js)
  // plan 3: the centipede: a follow-the-leader spine on the head's own path (PathTrail), a pair of legs per segment
  // stepping in a metachronal wave on distance (src/motion-kit/wave-legs.js), knees out and up
  centipede: {
    spine: { segments: 12, spacing: 0.36 },
    legs: { stride: 0.5, duty: 0.65, height: 0.42, lag: 0.62, lenA: 0.62, lenB: 0.66, pole: 'out-up' },   // (height × leg; lag rad a pair)
    body: { spring: { f: 4, z: 0.55, r: 0 } },
    poses: {
      coil: { y: -0.06, z: -0.18, pitch: -0.3 },                     // (the head rears, the front segments bunch back)
      strike: { y: 0.02, z: 0.3, pitch: 0.18 },
      recover: { y: -0.04, pitch: 0.08 },
      hurt: { y: -0.04, roll: 0.15 },
      'coil:ring': { y: 0.05, z: 0, pitch: -0.18 },                   // (the ring: the head lifts and turns inward)
    },
    style: 'organic',
  },
  // plan 15: the burrower: under the sand a path of mounds on the head's path (PathTrail), a fin at the front;
  // surfaced, a stack of rings standing out of the hole (a spine of rings bent by the pose), slumping back slowly
  burrower: {
    spine: { mounds: 6, spacing: 0.55, rings: 7 },
    body: { spring: { f: 2.2, z: 0.5, r: 0 }, rise: { f: 2.6, z: 0.62, r: -0.4 } },   // (it dips before it rises: r < 0)
    poses: {
      coil: { y: -0.1, z: -0.25, pitch: -0.35 },                     // (spit stones: rears back, its rings bunching)
      strike: { z: 0.3, pitch: 0.4 },
      recover: { y: -0.2, pitch: 0.25 },
      hurt: { y: -0.1, roll: 0.2 },
      'coil:dive': { z: 0.25, pitch: 0.6 },                          // (the dive: it leans over toward you first)
    },
    style: 'organic',
  },
  // plan 14: the glider: a slow travelling wave across the span (the tips lag the root), bank = turn rate × speed,
  // pitch with acceleration, a follow-the-leader tail
  glider: {
    wing: { strips: 4, rate: [0.45, 1.3], amp: 0.13, lag: 0.7 },        // (rate: cycles a second idle → at full speed)
    body: { bank: 0.16, bankMax: 0.75, pitch: 0.05, spring: { f: 1.6, z: 0.7, r: 0 } },
    tail: { n: 9, length: 0.24, maxBend: 0.35 },
    poses: {
      coil: { y: 0.4, z: -0.3, pitch: -0.25 },                       // (it climbs and sweeps back before the skim)
      strike: { y: -0.2, z: 0.3, pitch: 0.2 },
      recover: { y: -0.1, pitch: -0.1 },
      hurt: { y: -0.3, roll: 0.4 },
    },
    style: 'organic',
  },
  // plan 13: the flyer: a flap by speed (the tips lag the root), body pitch from acceleration, a hover bob
  flyer: {
    wing: { strips: 3, rate: [2.4, 3.6], amp: 0.75, lag: 0.55 },   // (beats a second hovering → flying: a big lamp moth fanning)
    body: { pitch: 0.06, pitchMax: 0.5, bob: 0.12, spring: { f: 3, z: 0.6, r: 0 } },
    poses: {
      coil: { y: 0.15, z: -0.12, pitch: -0.3 },                      // (rears up, nose high)
      strike: { z: 0.2, pitch: 0.35 },
      recover: { y: -0.1 },
      hurt: { y: -0.2, roll: 0.5 },
      'coil:flash': { y: 0.1, z: -0.05, pitch: -0.15 },
    },
    style: 'organic',
  },
  // plan 11: the floater: the bell pulses (scale) at a rate the telegraph raises, bobs, tilts into its drift on a
  // spring; threads and lanterns hang on verlet chains
  floater: {
    bell: { rate: [0.55, 2.4], squash: 0.14 },                         // (pulses a second: drifting → winding up)
    body: { tilt: 0.06, tiltMax: 0.4, bob: 0.18, spring: { f: 1.2, z: 0.55, r: 0 } },
    threads: { n: 12, links: 9, length: 0.4 },
    poses: {
      coil: { y: -0.25, pitch: 0.1 },                                // (the bell clenches, drawn down)
      strike: { y: 0.1 },
      recover: { y: 0.05 },
      hurt: { y: -0.4, roll: 0.3 },
      'coil:mend': { y: -2.2 },                                      // (it sinks low over the hurt one, in reach)
    },
    style: 'organic',
  },
};

/** The pole (the knee's side) for a leg whose rest foot is at {x, z} (body frame), by the plan's rule. */
export function poleFor(rule, foot) {
  const side = Math.sign(foot.x) || 1;
  if (rule === 'beast') return { x: 0, y: 0.15, z: foot.z >= 0 ? 0.6 : -1 };   // (front knees forward, hocks back)
  if (rule === 'forward') return { x: 0, y: 0.1, z: 1 };
  if (rule === 'back') return { x: Math.sign(foot.x) * 0.08, y: 0.05, z: -1 };   // (a bird's: the joint halfway down bends back)
  // out and up, away from the body's centre
  const r = Math.hypot(foot.x, foot.z) || 1;
  return { x: (foot.x / r) * 1 + side * 0.001, y: 1.1, z: foot.z / r };
}
