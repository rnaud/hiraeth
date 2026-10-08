// Screens against the wind: walls put up after a level was built (the ink bridge pen's walls,
// src/gadgets/bridge.js) that a gust can't blow through. A temple's gust (src/temples/pieces.js Gust)
// asks screened(pos, windDir) for whoever stands in its hall, beside its own shelter boxes.
//
//   const off = addScreen({ a, b, bottom, top })   a segment of wall on the ground (a, b: its ends; y range)
//   screened(pos, dir, reach)                       is something at pos sheltered from wind blowing along dir?

const SCREENS = new Set();

/** A wall segment from a to b (world points; only x, z used), standing from `bottom` to `top`. Returns its remover. */
export function addScreen(s) {
  SCREENS.add(s);
  return () => SCREENS.delete(s);
}

export const screenCount = () => SCREENS.size;

/**
 * Is `pos` (a body's feet) sheltered from wind blowing along `dir` (horizontal) by a screen within `reach`
 * metres upwind of it, as tall as the body's middle? Pure geometry: the ray from pos against the wind, in
 * the ground plane, meets the segment.
 */
export function screened(pos, dir, reach = 6, list = SCREENS) {
  const L = Math.hypot(dir.x, dir.z);
  if (!(L > 1e-6) || !list.size) return false;
  const ux = -dir.x / L, uz = -dir.z / L, y = pos.y + 0.9;
  for (const s of list) {
    if (y < s.bottom || y > s.top) continue;
    // ray p + t·u (0 ≤ t ≤ reach) against segment a + k·(b − a) (0 ≤ k ≤ 1)
    const ex = s.b.x - s.a.x, ez = s.b.z - s.a.z;
    const den = ux * ez - uz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = s.a.x - pos.x, wz = s.a.z - pos.z;
    const t = (wx * ez - wz * ex) / den, k = (wx * uz - wz * ux) / den;
    if (t >= 0 && t <= reach && k >= -0.02 && k <= 1.02) return true;
  }
  return false;
}
