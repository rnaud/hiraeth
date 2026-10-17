// The berths that carry the ship in two ports (issue #451, the "options for later" of docs/design/space-ports.md): the
// Underwater City's lock lowers it down onto the Dock's dome, the City-Shaft's cradle swings it in over the rim. The ship
// still rests where it always did (its site, its ramp, its walk out): a berth only changes where it sets down and lifts
// off, and plays a short step between that and its rest (src/ship/cinematics.js ArrivalDirector, TakeoffDirector).
//
// Pure numbers, no engine: the berth's pose at a time, as an offset of the ship from its rest in the hull's frame (du
// metres out of the hatch, up metres up) and the cradle's swing (theta, rad, + out toward the hatch). The berth's meshes
// are built by the port's kit (src/levels/port-pad.js buildBerth) and set from the same pose.
//
//   lock    { rise, arrive, leave }: down `rise` m on its lift plate in `arrive` s (eased in and out); up again in `leave`
//   cradle  { arm, swing, arrive, leave }: a gondola hung from a hub `arm` m over its pins, level as it swings; it takes
//           the ship swung out `swing` rad, swings it in past its rest a little and settles (arrive); swings out (leave)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
/** Eased in and out with no speed at either end (and no jolt in its acceleration). */
const smoother = (x) => { x = clamp01(x); return x * x * x * (x * (6 * x - 15) + 10); };

/** Each kind's defaults: its timings (s) and its travel. */
export const BERTH = {
  lock: { rise: 12, arrive: 3.6, leave: 2.8 },
  cradle: { arm: 13, swing: 0.72, arrive: 3.8, leave: 2.6 },
};

/** A berth's spec with its kind's defaults. */
export const berthSpec = (b) => (b ? { ...BERTH[b.kind], ...b } : null);

/** The pose of a berth at its swing (cradle) or its lift (lock: k 0 at rest, 1 up): { du, up, theta, k }. */
export function berthPose(b, k) {
  b = berthSpec(b);
  if (b.kind === 'lock') return { du: 0, up: b.rise * k, theta: 0, k };
  const theta = b.swing * k;
  return { du: b.arm * Math.sin(theta), up: b.arm * (1 - Math.cos(theta)), theta, k };
}

/** Where it sets down and lifts off: the berth out (lock up, cradle swung out). */
export const berthOut = (b) => berthPose(b, 1);
/** At rest. */
export const berthRest = (b) => berthPose(b, 0);

/**
 * The arrival's step, t s into it: from out to rest. The lock comes down smoothly; the cradle, let go, swings in past
 * its rest by a fifth of its swing and back, and settles (no speed at either end).
 */
export function berthArrive(b, t) {
  b = berthSpec(b);
  const s = clamp01(t / b.arrive);
  if (b.kind === 'lock') return berthPose(b, 1 - smoother(s));
  // (a damped swing: cos(1.5 PI s) crosses its rest at a third and comes back to it at the end; the envelope keeps the
  // start gentle and fades the overswing; the last 30 % eases it to a standstill on its rest)
  const k = Math.cos(1.5 * Math.PI * s) * Math.exp(-3.5 * s * s) * (1 - smooth((s - 0.7) / 0.3));
  return berthPose(b, k);
}

/** The take-off's step, t s into it: from rest to out, eased in and out. */
export function berthLeave(b, t) {
  b = berthSpec(b);
  return berthPose(b, smoother(t / b.leave));
}
