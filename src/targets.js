import * as THREE from 'three';

// Things the player's tool can hit from afar: wildlife, switches, reactive
// scenery. Anything can register; the blaster asks for the nearest hit along
// its ray (or a projectile's step) and calls back with the mode it fired in.
//
//   const off = registerTarget({ kind: 'wildlife', radius: 0.4, position: () => v3, onHit: (mode, point, dir) => {} });
//   off();   // unregister
//
// modes: 'stun' (paralyze ray, for wildlife) and 'dart' (projectile, activates things).

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

export function hitTarget(hit, mode, dir) { hit?.target.onHit?.(mode, hit.point, dir); return !!hit; }
export const allTargets = () => [...targets];
export function clearTargets() { targets.clear(); }
