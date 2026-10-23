/** Fine analog placement without changing the established middle/full-stick travel pace. */
export function movementScale(strength) {
  const k = Math.max(0, Math.min(1, strength));
  // Keep the fine end linear, then join the old travel curve without a speed or slope discontinuity.
  const t = Math.max(0, Math.min(1, (k - 0.12) / (0.45 - 0.12)));
  const blend = t * t * (3 - 2 * t);
  return k + ((0.35 + 0.65 * k) - k) * blend;
}

/** Authored walks ask for a pace, rather than depending on an obsolete stick response. */
export function stickForMovementScale(scale) {
  const target = Math.max(0, Math.min(1, scale));
  if (target === 0 || target === 1) return target;
  let lo = 0, hi = 1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (movementScale(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
