// Where a plant may stand (issue #497): shared by the responsive world's flowers, fans and fungi
// (src/reactive-world.js), in the browser and the engines alike.
//
//  - builtTop: a spot on top of something built (a roof, a stall, a pyramid's crown, a wall's top, a raised
//    floor) is no ground for a plant. In a world with a heightfield the ground is the terrain (or a pavement a
//    hand over it); anything higher is built, unless the level says that spot is its own raised ground
//    (level.plantGround: Vael's sky stones, rock tables high over the cloud). On such ground, and in a world
//    with no heightfield, a small raised top (a drop at its edge on several sides close by) is still built.
//    Roof gardens a world draws on purpose (the City-Shaft's villas, the floating city's roofs, the night
//    train's carriages) are the level's own drawing, never scattered: they are not asked here.

/** How high over the terrain (m) a spot still counts as the ground (a pavement, a kerb). */
export const GROUND_LIFT = 0.35;
/** A small raised top: a drop of more than `drop` m within `reach` m on at least `sides` of eight sides. */
export const TOP_EDGE = { drop: 1.2, reach: [1.5, 3], sides: 2 };

/**
 * Is (x, y, z), a surface a plant would stand on, the top of something built?
 * @param physics  the world's collision (groundAt)
 * @param level    its level (ground.heightAt, plantGround(x, y, z))
 */
export function builtTop(physics, level, x, y, z, { lift = GROUND_LIFT, edge = TOP_EDGE } = {}) {
  const base = level?.ground?.heightAt?.(x, z);
  if (Number.isFinite(base)) {
    if (y <= base + lift) return false;                       // the terrain, or a pavement on it
    if (!level.plantGround?.(x, y, z)) return true;           // a roof, a stall, a floor: built
  }
  // the world's own raised ground (or a world of meshes): only a small top, cut off on several sides, is built
  if (!physics?.groundAt) return false;
  let sides = 0;
  for (let k = 0; k < 8 && sides < edge.sides; k++) {
    const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
    for (const r of edge.reach) {
      const g = physics.groundAt(x + c * r, y + 0.5, z + s * r);
      if (!(y - g < edge.drop)) { sides++; break; }
    }
  }
  return sides >= edge.sides;
}
