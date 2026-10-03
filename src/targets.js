import * as THREE from 'three';

// Things the player's fluid tool can hit: wildlife, people, switches, reactive
// scenery. Anything can register; the tool asks for the nearest hit along a
// glob's path (or everything inside its push cone) and calls back with the
// ability that touched it.
//
//   const off = registerTarget({ kind: 'wildlife', radius: 0.4, position: () => v3, onHit: (mode, point, dir, info) => {} });
//   off();   // unregister
//
// modes (fluid-tool.js):
//   'shoot'  a glob of magical fluid landed on it (point: where; dir: the glob's flight)
//   'push'   it was inside the push cone (dir: away from the traveller, the way to shove it)
// info: { colours: ['#52c8cf', …] } the fluid's current tones, strength (push: 1 near, 0 at the cone's reach)

const targets = new Set();
const _oc = new THREE.Vector3();

export function registerTarget(t) {
  const entry = { radius: 0.5, enabled: () => true, ...t };
  targets.add(entry);
  return () => targets.delete(entry);
}

/** Nearest registered target hit by a ray, within maxDist. Returns { target, distance, point } or null. */
export function raycastTargets(origin, dir, maxDist = 80) {
  let best = null;
  for (const t of targets) {
    if (!t.enabled()) continue;
    const c = t.position();
    _oc.subVectors(c, origin);
    const along = _oc.dot(dir);
    if (along < 0 || along - t.radius > maxDist) continue;
    const d2 = _oc.lengthSq() - along * along, r2 = t.radius * t.radius;
    if (d2 > r2) continue;
    const distance = Math.max(0, along - Math.sqrt(r2 - d2));
    if (distance <= maxDist && (!best || distance < best.distance))
      best = { target: t, distance, point: origin.clone().addScaledVector(dir, distance) };
  }
  return best;
}

/**
 * Every enabled target inside a cone (apex origin, unit axis dir, half-angle in
 * radians, reach range), counting the target's radius, nearest first. With
 * physics, targets behind world geometry are left out. Each result:
 * { target, distance, point (its centre), dir (unit, origin -> target) }.
 */
export function targetsInCone(origin, dir, range, angle, physics = null) {
  const out = [];
  for (const t of targets) {
    if (!t.enabled()) continue;
    const c = t.position();
    _oc.subVectors(c, origin);
    const d = _oc.length();
    if (d - t.radius > range) continue;
    const to = d > 1e-5 ? _oc.clone().divideScalar(d) : dir.clone();
    if (d > t.radius) {
      const off = Math.acos(THREE.MathUtils.clamp(to.dot(dir), -1, 1)) - Math.asin(Math.min(1, t.radius / d));
      if (off > angle) continue;
    }
    if (physics?.rayDistance && d > 0.3 && physics.rayDistance(origin, to, d) < d - t.radius - 0.05) continue;
    out.push({ target: t, distance: Math.max(0, d - t.radius), point: c.clone(), dir: to });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

export function hitTarget(hit, mode, dir, info) { hit?.target.onHit?.(mode, hit.point, dir, info); return !!hit; }
export const allTargets = () => [...targets];
export function clearTargets() { targets.clear(); }
