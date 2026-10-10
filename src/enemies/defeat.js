import * as THREE from 'three';

// The defeats (docs/systems/foes.md, "Hit and defeat", v1.35): each body plan goes down its own way over ~0.8-1.5 s, and
// then bursts as before (src/foes.js Foes.burst: the ink, the tank's charge, the chimes, the pieces). The killing blow
// starts it (Foes.defeat): the mind is done (state 'dead': no target, no blows, nothing blocks you, the lock moves on), and
// the look runs the model's own pose with the recipe's moves on top (Foes.look):
//
//   flip    onto its back (a hop up, half a turn about its length) and its legs curled (the crab, the skitters)
//   roll    over onto a side, `angle` rad about its length (side ±1), legs curling (the lizard, the centipede)
//   topple  over forward about its feet, `angle` rad (the heron off its stilts, the brute onto its face)
//   sag     its body sinks `y` m onto its legs (the kit re-solves them: knees buckle; a tripod's, a bell walker's)
//   squash  flattened to `sy` of its height, `sxz` wider (the blot into a puddle, the shade's cloak falling empty)
//   sink    into the ground `y` m (the worm back under the sand, the root knot)
//   land    a flyer comes down from its height to the ground (the moth spiralling, the jelly deflating, the ray gliding)
//   spin    turns about itself, rad/s (falling off to nothing: a spiral)
//   curl    [from, to, k]: its legs drawn up under the body over that share of the time (the rig's `air` above 1)
//   slack   the plan's own: its parts let go (the marionette's strings, the moth's wings folding: model.defeat)
//   ripple  the plan's own, in its pose (f.dying): the centipede's plates sink and roll over one after another
//   puff    what comes off it as it goes: 'dust' as it lands, 'vent' (a machine's steam), 'ink' (a spirit's drips)
// Each move has `at: [from, to]`, the share of the time it runs over (eased). Everything is the foe's own transform and a
// few numbers: no new meshes, no draws (cheap with many at once). The eyes go out over the first half.
// A foe that went out of the world (fell, swept away) or an old kind without a recipe bursts at once, as before.

export const DEFEATS = {
  crab: { time: 1.25, flip: { hop: 0.5, at: [0, 0.45] }, curl: [0.4, 1, 0.9], puff: 'dust' },
  skitter: { time: 0.8, flip: { hop: 0.3, at: [0, 0.4] }, curl: [0.25, 0.9, 1], puff: 'dust' },
  centipede: { time: 1.3, ripple: true, puff: 'dust' },   // (its own: a ripple from head to tail, each plate sinking and rolling over: centipede.js)
  toad: { time: 1.1, squash: { sy: 0.6, sxz: 1.22, at: [0, 0.3] }, roll: { side: -1, angle: 1.25, at: [0.25, 0.8] }, curl: [0.3, 0.8, 0.5], puff: 'dust' },
  lizard: { time: 1.0, roll: { side: -1, angle: 1.5, at: [0.05, 0.5] }, curl: [0.3, 0.9, 0.8], puff: 'dust' },
  heron: { time: 1.45, sag: { y: -1.9, at: [0.05, 0.55] }, curl: [0.05, 0.5, 1], topple: { angle: 1.25, at: [0.4, 0.92] }, puff: 'dust' },
  roller: { time: 1.0, roll: { side: 1, angle: 1.45, at: [0.05, 0.55] }, sag: { y: -0.15, at: [0, 0.4] }, puff: 'dust' },
  rootknot: { time: 1.3, sag: { y: -0.5, at: [0, 0.5] }, topple: { angle: 0.5, at: [0.1, 0.6] }, sink: { y: 0.7, at: [0.45, 1] }, curl: [0.1, 0.6, 0.6], puff: 'dust' },
  jelly: { time: 1.5, land: { at: [0, 1] }, squash: { sy: 0.45, sxz: 1.35, at: [0.05, 0.8] }, spin: 0.8, puff: null },
  moth: { time: 1.3, land: { at: [0, 0.95] }, spin: 7, roll: { side: 1, angle: 0.8, at: [0, 0.4] }, slack: true, puff: 'dust' },
  ray: { time: 1.4, land: { at: [0, 0.95] }, spin: 2.6, roll: { side: -1, angle: 0.5, at: [0, 0.5] }, puff: 'dust' },
  worm: { time: 1.1, sink: { y: 2.4, at: [0.1, 1] }, roll: { side: 1, angle: 0.35, at: [0, 0.4] }, puff: 'dust' },
  tripod: { time: 1.3, sag: { y: -0.95, at: [0.05, 0.6] }, topple: { angle: 0.45, at: [0.3, 0.9] }, puff: 'vent' },
  cart: { time: 1.1, sag: { y: -0.2, at: [0, 0.4] }, roll: { side: 1, angle: 0.35, at: [0.2, 0.7] }, puff: 'vent' },
  bell: { time: 1.5, sag: { y: -1.3, at: [0.05, 0.6] }, topple: { angle: 0.4, at: [0.35, 0.95] }, puff: 'vent' },
  drone: { time: 1.1, land: { at: [0, 0.85] }, spin: 9, roll: { side: 1, angle: 0.9, at: [0.1, 0.6] }, puff: 'vent' },
  brute: { time: 1.5, sag: { y: -0.75, at: [0, 0.4] }, topple: { angle: 1.4, at: [0.4, 0.95] }, puff: 'vent' },
  blot: { time: 0.9, squash: { sy: 0.12, sxz: 1.75, at: [0, 0.75] }, puff: 'ink' },
  shade: { time: 1.2, sag: { y: -0.55, at: [0.1, 0.7] }, squash: { sy: 0.4, sxz: 1.45, at: [0.15, 0.85] }, puff: 'ink' },
  hound: { time: 1.2, sag: { y: -0.3, at: [0, 0.35] }, roll: { side: 1, angle: 1.4, at: [0.25, 0.7] }, curl: [0.4, 0.9, 0.6], puff: 'ink' },
  marionette: { time: 1.3, land: { at: [0.15, 0.45], to: 0 }, slack: true, puff: 'ink' },
};

/** A move's eased progress at u (0..1 over the defeat) for its `at` window. */
export const stage = (m, u) => {
  if (!m) return 0;
  const [a, b] = m.at ?? [0, 1];
  const x = THREE.MathUtils.clamp((u - a) / Math.max(1e-6, b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

/** A defeat under way for foe f (recipe R): its clock and what it started from. */
export function startDefeat(f, R) {
  return { R, t: 0, u: 0, alt: f.alt ?? 0, over: f.over ?? 0, heading: f.heading, puffed: 0 };
}

/**
 * The recipe's moves at u: { body: { y, pitch, roll, sx, sy } on the body before its legs are solved, group (applied to
 * the root after the pose), curl (the rig's air), alt (a flyer's height), heading, flipped, k }.
 */
export function defeatPose(D, u, out = {}) {
  const R = D.R;
  const sag = R.sag ? R.sag.y * stage(R.sag, u) : 0;
  const sq = stage(R.squash, u);
  out.body = { y: sag, pitch: 0, roll: 0, sx: R.squash ? THREE.MathUtils.lerp(1, R.squash.sxz, sq) : 1, sy: R.squash ? THREE.MathUtils.lerp(1, R.squash.sy, sq) : 1 };
  // the root: a flip (a hop and half a turn about its length), a roll onto its side, a topple forward, a sink
  const fl = stage(R.flip, u);
  out.flip = fl * Math.PI;
  out.hop = R.flip ? R.flip.hop * Math.sin(Math.PI * fl) : 0;
  out.roll = R.roll ? R.roll.side * R.roll.angle * stage(R.roll, u) : 0;
  out.pitch = R.topple ? R.topple.angle * stage(R.topple, u) : 0;
  out.sink = R.sink ? R.sink.y * stage(R.sink, u) : 0;
  // the legs curled up under it
  if (R.curl) { const [a, b, k] = R.curl, x = THREE.MathUtils.clamp((u - a) / Math.max(1e-6, b - a), 0, 1); out.curl = 1 + k * x * x * (3 - 2 * x); } else out.curl = 0;
  // a flyer's height: from where it was down to the ground (or below its anchor: the marionette's `to`)
  out.alt = R.land ? THREE.MathUtils.lerp(D.alt, R.land.to ?? 0, stage(R.land, u)) : null;
  out.over = R.land ? D.over * (1 - stage(R.land, u)) : null;
  out.spin = R.spin ? R.spin * D.t * (1 - 0.5 * u) : 0;
  out.k = u;
  return out;
}

const _q = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);

/** The root's moves (after the model posed itself): the flip and the roll about its length, the topple, the hop, the sink. */
export function defeatRoot(g, P, size = 1) {
  g.position.y += (P.hop - P.sink) * size;
  // (about its own axes: its heading kept, then rolled, flipped, toppled)
  if (P.roll || P.flip) g.quaternion.multiply(_q.setFromAxisAngle(_z, P.roll + P.flip));
  if (P.pitch) g.quaternion.multiply(_q.setFromAxisAngle(_x, P.pitch));
  // (flipped: lifted by its own height so its back, not its belly, is on the ground)
  if (P.flip) g.position.y += Math.sin(P.flip / 2) * 0.55 * size;
}

/** The eyes going out: toward a dull tone, the glow gone, over the first half. */
export function dimEyes(model, u) {
  const U = model.eyeMat?.uniforms;
  if (!U?.uColor) return;
  const k = THREE.MathUtils.clamp(u * 2, 0, 1);
  U.uColor.value.lerp(_dull, k);
  if (U.uGlow) U.uGlow.value *= 1 - k;
}
const _dull = new THREE.Color('#3a332e');
