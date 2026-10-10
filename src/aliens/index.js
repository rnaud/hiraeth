import * as THREE from 'three';
import { Alien } from './alien.js';
import { SPECIES } from './species.js';
import { ALIENS, ALIEN_LINES } from '../story/aliens-data.js';
import { registerTarget } from '../targets.js';
import { mulberry32 } from '../noise.js';
import { partsOf, offsetOf, shiftAt } from '../levels/names.js';

// The non-humanoid people of a world (docs/systems/aliens.md): main.js spawns them with the
// world's people and adds them to its `npcs`, so they are updated, balloon, can be talked to
// (their def.talk, src/story/index.js) and hit by the fluid tool like anyone.
//
//   alienSpots(levelId)                     [{ x, z, r }] where they live (the crowd keeps clear)
//   spawnAliens(scene, physics, levelId)    → [Alien]

export { SPECIES, ALIENS };

/**
 * A world's aliens, where they stand in it: by the part (the old world) they were placed for, its places moved
 * where a merged world carries it (src/levels/names.js PARTS, PART_OFFSET: Lorn's Deep Wood has the shellbacks).
 */
export function aliensIn(levelId) {
  return partsOf(levelId).flatMap((part) => {
    const o = offsetOf(part), moved = o[0] || o[1] || o[2];
    return (ALIENS[part] ?? []).map((d) => (moved ? { ...d, at: shiftAt(part, d.at), ...(d.y !== undefined ? { y: d.y + o[1] } : {}), ...(d.route ? { route: d.route.map((p) => shiftAt(part, p)) } : {}) } : d));
  });
}
/** Where this world's aliens live, for the crowd and the flora to keep clear of. */
export const alienSpots = (levelId) => aliensIn(levelId).map((d) => ({ x: d.at[0], y: d.y, z: d.at[1], r: (d.wander ?? 6) * 0.5 + 2 }));

/** The ground at x, z (from `from` down), on gentle ground only (null on a bank or a wall). */
function groundOf(physics, x, z, from) {
  const y = physics?.groundAt?.(x, from, z);
  if (!Number.isFinite(y)) return physics ? null : 0;
  const n = physics.groundNormal?.(x, y + 1, z);
  return n && n.y < 0.8 ? null : y;
}

/** A def's wandering loop: its own route ([[x, z]…]) or a few seeded points within `wander` m of where it stands. */
export function routeOf(def, physics) {
  const [cx, cz] = def.at, from = def.y !== undefined ? def.y + 2 : 1e4;
  const at = new THREE.Vector3(cx, groundOf(physics, cx, cz, from) ?? (def.y ?? 0), cz);
  if (def.route) return { at, route: [at, ...def.route.map(([x, z]) => new THREE.Vector3(x, groundOf(physics, x, z, from) ?? at.y, z))] };
  const r = def.wander ?? 0, route = [at];
  if (r > 0.5) {
    const rand = mulberry32(((Math.round(cx * 7.3) * 73856093) ^ (Math.round(cz * 7.3) * 19349663)) >>> 0);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.8;
      for (let t = 0; t < 5; t++) {
        const d = r * (0.5 + rand() * 0.5) * (1 - t / 5), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = groundOf(physics, x, z, from);
        if (y !== null && Math.abs(y - at.y) < 2.5) { route.push(new THREE.Vector3(x, y, z)); break; }
      }
    }
  }
  return { at, route };
}

/** This world's aliens, placed and with their reactions to the tool; their targets registered. */
export function spawnAliens(scene, physics, levelId) {
  const out = [];
  for (const d of aliensIn(levelId)) {
    const { at, route } = routeOf(d, physics);
    const def = { ...d, reactions: ALIEN_LINES[d.species] };
    const a = new Alien(scene, physics, { def, at, route });
    out.push(a);
    const p = new THREE.Vector3();
    a.offTarget = registerTarget({ kind: 'npc', radius: SPECIES[d.species].radius, npc: a, accepts: ['stun', 'fire'],
      position: () => a.chest(p), enabled: () => a.object.visible, onHit: (mode, point, dir, info) => a.hit(mode, dir, info) });
  }
  return out;
}
