// Remove only upward triangles completely enclosed by another solid. Keep their
// side/bottom faces and any exposed cap, including caps crossing the cover edge.
// This is geometry ownership, shared by WebGL and the Unity bridge, not a depth bias.
export function omitCoveredCap(geometry, covers) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const source = geometry.index?.array ?? Array.from({ length: p.count }, (_, i) => i);
  const kept = [];
  for (let i = 0; i < source.length; i += 3) {
    const triangle = [source[i], source[i + 1], source[i + 2]];
    if (triangle.every(v => n.getY(v) > .999 && covers(p.getX(v), p.getY(v), p.getZ(v)))) continue;
    kept.push(...triangle);
  }
  geometry.setIndex(kept);
  geometry.clearGroups(); // These scenery parts have one material and are batched later.
  return geometry;
}
