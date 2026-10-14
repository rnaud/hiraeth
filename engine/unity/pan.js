// A slow pan of a fixed view, for the distant shimmer's pictures (the bridge's -pan, issue #218: engine/unity/game.js
// makePlan; scripts/bench/unity-shimmer.mjs measures them).

/** The default step a frame, degrees: a third of a render pixel on the Retroid at Handheld (1280 × 960 at 0.75, fov 55). */
export const PAN_STEP = 0.025;

/** A fixed view turned by `a` radians round the vertical through its eye (the traveller left where the view put him). */
export function yawed(v, a) {
  if (!a) return v;
  const [ex, , ez] = v.eye, dx = v.target[0] - ex, dz = v.target[2] - ez, c = Math.cos(a), s = Math.sin(a);
  return { ...v, player: undefined, hidePlayer: v.hidePlayer ?? !v.player, target: [ex + c * dx + s * dz, v.target[1], ez - s * dx + c * dz] };
}

/** The steps of a view's pan (`n` + 1 frames `stepDeg` apart): a picture of each into `out`, or (live) one drawn frame each. */
export function panSteps(v, { n, stepDeg = PAN_STEP, out = null, live = false }) {
  const a = (stepDeg * Math.PI) / 180, steps = [];
  if (!n || (!out && !live)) return steps;
  for (let k = 0; k <= n; k++) {
    steps.push({ kind: 'pin', view: yawed(v, k * a) }, live ? { kind: 'wait', frames: 1 } : { kind: 'shot', file: `${out}/pan-${v.name}-${String(k).padStart(3, '0')}.png` });
  }
  return steps;
}
