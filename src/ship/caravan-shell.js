import * as THREE from 'three';

// Closing the caravan's shell where the authored export leaves it open (issue #776: "The back of my ship is see
// through"). The playable GLB's hull is one loft whose middle section ends in an open ring at the tail, between the
// four boosters (about 4 m wide and 3.6 m high): from behind you looked down the inside of the hull, past the hold's
// back wall, out through the bow. The Blender source (scripts/blender/ship/build_caravan.py) caps the forecabin's
// rows but not the middle's last section, and Blender is not available to export it again, so the cap is laid here
// over the ring's own vertices, in the hull's own paint (it collides like the rest of the shell). Where a later export
// closes the tail itself, nothing is added (a ray down the ring's axis already meets the hull).

const _v = new THREE.Vector3();

/**
 * The porch's forward pocket (issue #776: "when I'm about to enter the ship, on the left I can see through as well").
 * Forward of the porch the hull's skin and the main room's port wall stand 3 m apart, and nothing closed the space
 * between them: from the porch and the ramp you looked left down a tunnel inside the hull to the bow, its inner skin
 * and the daylight through the windshield's back. A plate closes it just forward of where the sliding door parks when
 * open (the door slides 2.47 m toward the bow: `Ship.setDoor`), so the door still slides into a shallow pocket.
 * Its outline, in the ship's frame (x to starboard, y up) in the plane z = PORCH_POCKET.z, follows the skin's inner face,
 * the stairwell's wall and the room's wall round the cavity, measured on the playable GLB and the built rooms by rays
 * from `centre` in that plane (tests/ship-shell.test.js measures it again: a changed hull or room fails there).
 */
export const PORCH_POCKET = Object.freeze({
  z: -3.65,
  centre: [-4.6, 3],
  outline: [[-3.2, 3], [-3.2, 10.202], [-3.264, 10.575], [-3.552, 10.458], [-4.228, 10.102], [-4.6, 9.837], [-5.049, 9.424],
    [-5.345, 9.068], [-5.748, 8.402], [-5.987, 7.837], [-6.217, 7.002], [-6.311, 6.358], [-6.352, 5.803], [-6.359, 4.186],
    [-6.329, 3.664], [-6.242, 3], [-6.165, 2.581], [-6.032, 2.105], [-5.799, 1.52], [-5.333, 0.744], [-4.652, 0.028],
    [-3.711, -0.566], [-2.795, -0.871], [-3.2, 0.13]],
});

/** The porch pocket's plate (a fan from its centre: the outline is star-shaped from it), in the ship's frame. */
export function porchPocketGeometry(P = PORCH_POCKET) {
  const pos = [P.centre[0], P.centre[1], P.z], idx = [];
  for (const [x, y] of P.outline) pos.push(x, y, P.z);
  const n = P.outline.length;
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** The world-space vertices of `meshes` with z within `band` m of their largest z (the hull's tail ring). */
function tailRing(meshes, band) {
  let maxZ = -Infinity;
  for (const n of meshes) {
    const p = n.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) maxZ = Math.max(maxZ, _v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld).z);
  }
  const seen = new Set(), ring = [];
  for (const n of meshes) {
    const p = n.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld);
      if (_v.z < maxZ - band) continue;
      const k = `${_v.x.toFixed(3)},${_v.y.toFixed(3)}`;
      if (seen.has(k)) continue;
      seen.add(k); ring.push(_v.clone());
    }
  }
  return ring;
}

/** The hull's own paint: its largest mesh's (the cream shell). */
export function shellPaint(hull) {
  let shell = null;
  hull?.traverse((n) => { if (n.isMesh && (!shell || n.geometry.attributes.position.count > shell.geometry.attributes.position.count)) shell = n; });
  return shell ? (Array.isArray(shell.material) ? shell.material[0] : shell.material) : null;
}

/**
 * Cap the hull's open tail ring (in the parked ship's frame: bow -z, stern +z) under `hull` (the authored 'hull' node),
 * painted like its largest mesh. Returns the cap mesh, or null when the tail is already closed or no ring is found.
 * Call once the authored root is placed, with world matrices up to date.
 */
export function capCaravanTail(hull, { band = 0.1 } = {}) {
  if (!hull) return null;
  const meshes = [];
  hull.traverse((n) => { if (n.isMesh && !n.userData.paneCue && !/reflections/.test(n.name)) meshes.push(n); });
  if (!meshes.length) return null;
  const ring = tailRing(meshes, band);
  if (ring.length < 6) return null;
  const c = ring.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
  // already closed: a ray from behind the ring along its axis meets the hull just past it
  const ray = new THREE.Raycaster(c.clone().add(new THREE.Vector3(0, 0, 1)), new THREE.Vector3(0, 0, -1), 0, 1.6);
  if (ray.intersectObjects(meshes, false).length) return null;
  ring.sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
  const pos = [c.x, c.y, c.z];
  for (const p of ring) pos.push(p.x, p.y, p.z);
  const idx = [];
  for (let i = 0; i < ring.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % ring.length));   // (counter-clockwise seen from behind: faces aft)
  // the cap lives in the hull's frame, under the same parent as the hull's meshes
  const host = meshes[0].parent;
  const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3).applyMatrix4(inv));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const cap = new THREE.Mesh(geo, shellPaint(hull));
  cap.name = 'hull-tail-cap';
  cap.castShadow = cap.receiveShadow = true;
  host.add(cap);
  cap.updateMatrixWorld(true);
  return cap;
}

/**
 * Close the caravan's shell (issue #776) on a freshly built model: the tail's cap under the hull, the porch's forward
 * pocket plate in the ship's frame, both in the hull's paint and colliding like the rest of it. Returns the geometries
 * added (the live copy owns them).
 */
export function closeCaravanShell(group, authored) {
  const hull = authored.getObjectByName('hull');
  authored.updateMatrixWorld(true);
  const owned = [];
  const cap = capCaravanTail(hull);
  if (cap) owned.push(cap.geometry);
  const paint = shellPaint(hull);
  if (paint) {
    const plate = new THREE.Mesh(porchPocketGeometry(), paint);
    plate.name = 'porch-pocket';
    plate.castShadow = plate.receiveShadow = true;
    group.add(plate);
    owned.push(plate.geometry);
  }
  return owned;
}
