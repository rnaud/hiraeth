// Paved ground: where nothing grows (docs/systems/worlds.md "Paved ground"; the author's note, v1.42: "vegetation only
// where it makes sense: flowers in the middle of the desert city"). A level that has towns, squares, paths or courts gives
// `level.paved(p)`: true on its paving, streets, squares and inside its walls. The responsive world's flowers
// (src/reactive-world.js) and the flora (src/flora.js) read it and grow elsewhere, as they read the Arena's keepClear.
//
//   const paved = pavedMask({ discs: [{ x, z, r }], ways: [{ points: [[x, z], …], w }] });
//   paved(new THREE.Vector3(x, y, z)) / paved.at(x, z)  → true on the paving
//
// A disc is a square, a court or a walled town (all of it streets, houses and paving); a way is a path or an avenue,
// `w` its full width.

/** The distance (m) from (x, z) to the polyline `pts` ([[x, z], …]). */
export function toLine(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  if (pts.length === 1) best = Math.hypot(x - pts[0][0], z - pts[0][1]);
  return best;
}

/**
 * A level's paving as a test of a point: `discs` [{ x, z, r }] and `ways` [{ points, w }] (w the full width; `pad` m more
 * on every side). The returned function takes a point (anything with x and z) and has `.at(x, z)`, `.discs` and `.ways`.
 */
export function pavedMask({ discs = [], ways = [], pad = 0.4 } = {}) {
  const at = (x, z) => discs.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + pad)
    || ways.some((w) => toLine(w.points, x, z) < w.w / 2 + pad);
  const paved = (p) => !!p && at(p.x, p.z);
  return Object.assign(paved, { at, discs, ways });
}
