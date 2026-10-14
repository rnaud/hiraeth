/** A broad clearing behind a landmark, opening farther toward its entrance.
 * Only ambient scenery uses this: authored paths, puzzles and their supports stay.
 * `pad` includes a prop's canopy or rock radius, not just its centre.
 */
export function templeVista(site, { width = 120, front = 240, back = 160 } = {}) {
  const s = Math.sin(site.heading), c = Math.cos(site.heading);
  return (x, z, pad = 0) => {
    const dx = x - site.x, dz = z - site.z;
    const across = dx * c - dz * s, along = dx * s + dz * c;
    return (across / (width + pad)) ** 2 + (along / ((along > 0 ? front : back) + pad)) ** 2 < 1;
  };
}
