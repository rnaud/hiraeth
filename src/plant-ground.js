// Where a plant may stand and where people may (issues #496, #497): shared by the flora (src/flora.js), the
// responsive world's flowers, fans and fungi (src/reactive-world.js), the people (src/npc.js) and the crowd
// (src/crowd.js), in the browser and the engines alike.
//
//  - builtTop: a spot on top of something built (a roof, a stall, a pyramid's crown, a wall's top, a raised
//    floor) is no ground for a plant. In a world with a heightfield the ground is the terrain (or a pavement a
//    hand over it); anything higher is built, unless the level says that spot is its own raised ground
//    (level.plantGround: Vael's sky stones, rock tables high over the cloud). On such ground, and in a world
//    with no heightfield, a small raised top (a drop at its edge on several sides close by) is still built.
//    Roof gardens a world draws on purpose (the City-Shaft's villas, the floating city's roofs, the night
//    train's carriages) are the level's own drawing, never scattered: they are not asked here.
//  - plantClear / routeClear / CircleGrid: people and plants kept apart (issue #496). The responsive plants grow
//    first (round the people's spots): a person's walk never starts or turns inside one (src/npc.js, the crowd's
//    clear list). The flora grows last: it keeps off everyone's spot and the loop they walk (src/flora.js floraKeep).

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

/** The responsive world's plants (its flowers, fans and fungi: not the screens) as [{ x, y, z, r }], r their petals' reach. */
export function plantClear(reactiveWorld, pad = 0.4) {
  const out = [];
  for (const n of reactiveWorld?.nodes ?? []) {
    if (!n.obj?.petals || !n.foot) continue;
    out.push({ x: n.foot.x, y: n.foot.y, z: n.foot.z, r: (n.obj.reach ?? 0.6) * (n.obj.root?.scale?.x ?? 1) + pad });
  }
  return out;
}

/**
 * Where a person stands and walks, as circles to keep plants off: the points of their loop (r) and the way between
 * them sampled every `step` m (rw).
 */
export function routeClear(route, { r = 1.8, rw = 1.1, step = 1.5, loop = true } = {}) {
  const out = [];
  if (!route?.length) return out;
  for (const p of route) out.push({ x: p.x, y: p.y, z: p.z, r });
  const n = loop ? route.length : route.length - 1;
  if (route.length > 1) for (let i = 0; i < n; i++) {
    const a = route[i], b = route[(i + 1) % route.length], L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let t = step; t < L; t += step) { const f = t / L; out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, r: rw }); }
  }
  return out;
}

/** Circles ({ x, z, r }) filed by cell, for quick "is this point within `pad` m of any of them" tests. */
export class CircleGrid {
  constructor(circles = [], cell = 8) {
    this.cell = cell;
    this.map = new Map();
    this.most = 0;   // (the widest circle: how far round a point to look)
    for (const c of circles) this.add(c);
  }
  add(c) {
    if (!Number.isFinite(c?.x) || !Number.isFinite(c?.z)) return;
    const i = Math.floor(c.x / this.cell), j = Math.floor(c.z / this.cell), k = `${i},${j}`;
    (this.map.get(k) ?? this.map.set(k, []).get(k)).push(c);
    this.most = Math.max(this.most, c.r ?? 0);
  }
  /** Is (x, z) within `pad` m of any circle? */
  hits(x, z, pad = 0) {
    const S = this.cell, R = this.most + pad;
    for (let i = Math.floor((x - R) / S); i <= Math.floor((x + R) / S); i++) for (let j = Math.floor((z - R) / S); j <= Math.floor((z + R) / S); j++) {
      const L = this.map.get(`${i},${j}`);
      if (L) for (const c of L) { const d = (c.r ?? 0) + pad; if ((c.x - x) ** 2 + (c.z - z) ** 2 < d * d) return true; }
    }
    return false;
  }
}

/** Where everyone starts: the people (their loop's first point, or where they stand) and the crowd, as [{ x, y, z }]. */
export function peopleStarts(npcs = [], crowd = null) {
  const out = [];
  for (const n of npcs) { if (n.pooled) continue; const p = n.route?.[0] ?? n.pos; if (p) out.push(p); }
  for (const p of crowd?.people ?? []) { const q = p.pos ?? p.home; if (q) out.push(q); }
  return out;
}
