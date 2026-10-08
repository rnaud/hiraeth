import * as THREE from 'three';

// What the magnet glove (src/gadgets/magnet.js) takes for metal (docs/systems/gadgets.md, "The magnet
// glove"). Loose metal is the gadgets' world's own (a Prop with `metal`: the metal crates) and the makers'
// machines among the foes; heavy metal fixed in a world is tagged where it is built:
//
//   tagMetal(mesh)                                  the mesh's middle (its bounding sphere) is the spot
//   tagMetal(mesh, { points: [v3, …], radius })     spots of their own (local to the mesh): a merged mesh
//                                                   of many valve wheels, a long pipe
//   level.metal = [{ pos, radius }]                 or a level lists them
//
// metalSpots(scene, level) finds them all once (the magnet asks when first used in a world): each spot
// { pos (world), radius (to its faces), extent (its bounding sphere), object }. The glove pulls the traveller to a spot (it is too heavy to move).

const _b = new THREE.Box3(), _s = new THREE.Sphere();

/** Mark an object as heavy fixed metal (brass machinery, an iron block, a cart's chassis). Returns it. */
export function tagMetal(object, { points = null, radius = null } = {}) {
  object.userData.metal = { points: points?.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p))) ?? null, radius };
  return object;
}

/** Is this object tagged metal? */
export const isMetal = (object) => !!object?.userData?.metal;

/** Every tagged spot under `root` (and the level's own list): [{ pos, radius, object }], in world space. */
export function metalSpots(root, level = null) {
  const out = [];
  root?.updateMatrixWorld?.(true);
  root?.traverse?.((o) => {
    const m = o.userData?.metal;
    if (!m) return;
    if (m.points?.length) {
      for (const p of m.points) out.push({ pos: o.localToWorld(p.clone()), radius: m.radius ?? 0.6, extent: m.radius ?? 0.6, object: o });
      return;
    }
    _b.setFromObject(o);
    if (_b.isEmpty()) return;
    _b.getBoundingSphere(_s);
    // (a block's spot: its middle; how far out its faces are: the smallest half-size, so the pull stops at a face)
    const size = _b.getSize(new THREE.Vector3());
    out.push({ pos: _s.center.clone(), radius: m.radius ?? Math.max(0.3, Math.min(size.x, size.y, size.z) / 2), extent: _s.radius, object: o });
  });
  for (const s of level?.metal ?? []) out.push({ pos: s.pos.isVector3 ? s.pos.clone() : new THREE.Vector3(...s.pos), radius: s.radius ?? 0.6, extent: s.radius ?? 0.6, object: null });
  return out;
}
