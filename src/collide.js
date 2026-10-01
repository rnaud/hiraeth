// Circle colliders on the ground plane, shared by the player and the bike.
//   { x, z, r }                 solid pillar of infinite height
//   { x, z, r, y0, y1 }         pillar only between y0 and y1 (a tower on one level)
//   { x, z, r, inside: true }   keep *inside* the circle (e.g. a shaft wall)
// Returns true if anything pushed the position.
export function resolveColliders(pos, radius, colliders, height = 2) {
  let hit = false;
  for (const c of colliders) {
    if (c.y0 !== undefined && (pos.y > c.y1 || pos.y + height < c.y0)) continue;
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const d = Math.hypot(dx, dz);
    if (c.inside) {
      const max = c.r - radius;
      if (d > max) {
        pos.x = c.x + (dx / d) * max;
        pos.z = c.z + (dz / d) * max;
        hit = true;
      }
      continue;
    }
    const min = c.r + radius;
    if (d < min && d > 1e-5) {
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
      hit = true;
    }
  }
  return hit;
}
