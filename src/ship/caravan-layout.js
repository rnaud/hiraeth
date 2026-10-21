// Playable rounded caravan: uniform 1.3x authoring scale preserves the approved silhouette.
// The authored 40m study becomes 52m, matching the former ship's overall length.
// Game frame remains starboard +X, up +Y, aft +Z; the port entry is at Z=0.
import * as THREE from 'three';
export const CARAVAN_SCALE = 1.3;
export const AUTHORED_ENTRY = Object.freeze({ x: -2.65, y: 3.6, z: 2.5 });
export const DECK = 0, LIFT = 2.8; // grounded deck height, independent of the interior authoring origin
export const AUTHORED_OFFSET = AUTHORED_ENTRY.y * CARAVAN_SCALE;
export const HATCH_A = -Math.PI / 2;
export const HATCH = Object.freeze({ z0: -1.05, z1: 1.05, y0: 0, y1: 3.2 });
export const HALF_W = 7.8, WALL_IN = 3.1; // exterior pod envelope versus furnished room walls
export const HINGE_R = 8.188206100673813 * CARAVAN_SCALE; // outer porch edge; the ground ramp begins here
export const NOSE_Z = (-20 - AUTHORED_ENTRY.x) * CARAVAN_SCALE;
export const STERN_Z = (20 - AUTHORED_ENTRY.x) * CARAVAN_SCALE;
export const CENTRE_Z = (NOSE_Z + STERN_Z) / 2;
export const R = Math.hypot(STERN_Z, 8), ROOF = 15.4 * CARAVAN_SCALE - AUTHORED_OFFSET;
export const BELLY = -2.21, LENGTH = STERN_Z - NOSE_Z;
export const CEIL = 3.3;
export const COCKPIT_DECK = 5.2;
export const ROOMS = Object.freeze({
  cockpit: { z0: -20.2, z1: -12, floor: COCKPIT_DECK, half: 4.7, ceiling: 10.4 },
  main: { z0: -12, z1: 6.4, floor: DECK, half: WALL_IN, ceiling: CEIL },
  cabin: { z0: 6.4, z1: 10.9, floor: DECK, half: WALL_IN, ceiling: 3.3 },
  hold: { z0: 10.9, z1: 16.1, floor: DECK, half: 2.5, ceiling: 3.3 },
});
export const STAIRS = Object.freeze({ z0: -12, z1: -3.2, width: 1.8, rise: COCKPIT_DECK, steps: 30 });
export const ENTRY_Z = 0;
// Centre the wider aft pods inside the Space City pier parapet; preserve the bridge-facing ramp.
export const SITE_OFFSETS = Object.freeze({ spacecity: Object.freeze({ x: 5, z: 0 }) });
// Anselm stands in the clear hold aisle, beside the starboard cargo crate.
export const SCIENTIST = Object.freeze({ at: [.75, 0, 13.25], heading: -2.4, jar: [1.85, .995, 13.25] });
export const authoredToShip = (p, out = new THREE.Vector3()) => out.set(-p.z * CARAVAN_SCALE, (p.y - AUTHORED_ENTRY.y) * CARAVAN_SCALE, (p.x - AUTHORED_ENTRY.x) * CARAVAN_SCALE);
export function placeAuthoredRoot(root) {
  root.rotation.y = -Math.PI / 2; root.scale.setScalar(CARAVAN_SCALE);
  root.position.set(0, -AUTHORED_OFFSET, -AUTHORED_ENTRY.x * CARAVAN_SCALE);
  return root;
}
export function roomAt(z) { return Object.values(ROOMS).find(r => z >= r.z0 && z <= r.z1) ?? null; }
export function deckAt(x, z) {
  if (Math.abs(x) < STAIRS.width / 2 && z >= STAIRS.z0 && z <= STAIRS.z1) {
    return Math.ceil((STAIRS.z1 - z) / (STAIRS.z1 - STAIRS.z0) * STAIRS.steps) * STAIRS.rise / STAIRS.steps;
  }
  return roomAt(z)?.floor ?? null;
}
export const cockpitHalf = () => ROOMS.cockpit.half;
export function inRooms(p, { margin = .3 } = {}) {
  const room = roomAt(p.z); if (!room) return false;
  const floor = deckAt(p.x, p.z);
  return Math.abs(p.x) <= room.half + margin && p.y >= floor - .8 && p.y <= (floor > 0 ? Math.max(room.ceiling, ROOMS.cockpit.ceiling) : room.ceiling) + .9;
}
// Conservative parking envelope. Actual walking/camera collision comes from the authored shell and room meshes.
export function undersideAt(x, z) { return z >= NOSE_Z && z <= STERN_Z && Math.abs(x) <= HALF_W ? BELLY : null; }
export function reachAt(a) { return Math.min(HALF_W / Math.max(.001, Math.abs(Math.sin(a))), 26 / Math.max(.001, Math.abs(Math.cos(a)))); }
export const LEGS = [{ x: -4.8, z: -9 }, { x: 4.8, z: -9 }, { x: -4.3, z: 14 }, { x: 4.3, z: 14 }];
export const footOf = l => l;
export const SCAR = { x: -5.9, y: 2, z: -6 };
export const WINDOW = { z0: -22, z1: -14, y0: 6.6, y1: 9.5 };
export const BOOSTER_CENTRES = ['port', 'starboard'].flatMap(side => ['upper', 'lower'].map(level => ({
  name: `booster-${side}-${level}`,
  at: authoredToShip(new THREE.Vector3(19.96, level === 'upper' ? 10.6 : 4.8, side === 'port' ? -3.2 : 3.2)),
})));
