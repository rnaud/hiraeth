// Shared prompt/use eligibility for the web and native story runtime. The label anchor is
// distinct from the reachable body point: floating words must not make a wall permeable.
import * as THREE from 'three';
import { besideAnchor } from './talk-prompt.js';

const projected = new THREE.Vector3(), right = new THREE.Vector3();
const origin = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3();

/** Match the floating prompt's viewport, including the near plane. No camera means no view restriction. */
export function promptVisible(at, camera) {
  if (!at || !camera?.projectionMatrix || !camera?.matrixWorldInverse) return true;
  projected.copy(at).project(camera);
  return projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
}

/** The actual floating anchor, including a person's shoulder-side tag. Copies borrowed vectors. */
export function interactionAnchor(entry, camera, out, side = 1, placement = null) {
  const body = camera?.matrixWorld ? entry?.beside?.() : null;
  if (body) {
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const scale = entry.npc?.object?.scale?.y ?? 1;
    out.copy(besideAnchor(body, right, side, scale));
    if (!promptVisible(out, camera)) {
      // A newly selected person near the edge has no previous tag side. Try the other
      // shoulder before rejecting them; the renderer receives this same chosen side.
      out.copy(besideAnchor(body, right, -side, scale));
      if (promptVisible(out, camera)) side = -side;
      else out.copy(besideAnchor(body, right, side, scale));
    }
    if (placement) placement.side = side;
    return out;
  }
  if (placement) placement.side = side;
  const at = entry?.at?.();
  return at ? out.copy(at) : null;
}

/** First-slice reach: loose props, ordinary chests and people opt in with a body point. */
export function interactionReachable(player, entry, physics) {
  if (!entry.reachAt || !physics?.rayDistance || !player?.pos) return true;
  const at = entry.reachAt(player);
  if (!at) return false;
  up.copy(player.frame?.up ?? { x: 0, y: 1, z: 0 }).normalize();
  if (up.lengthSq() < 0.5) up.set(0, 1, 0);
  origin.copy(player.pos).addScaledVector(up, 1.1);
  direction.subVectors(at, origin);
  const distance = direction.length();
  if (!Number.isFinite(distance)) return false;
  if (distance < 0.001) return true;
  direction.multiplyScalar(1 / distance);
  // Ignore only this exact object's collider, never a radius allowance or the world's solids.
  const hit = physics.rayDistance(origin, direction, distance, entry.reachCollider?.() ?? null);
  return hit >= distance - 0.001;
}

export function interactionEligible(player, entry, { camera, physics, anchor }) {
  return (entry.offscreenUse || promptVisible(anchor, camera)) && interactionReachable(player, entry, physics);
}
