// How the shield's strap lies on the forearm's skin (issue #303), measured on its own: the skin as three.js skins it
// (SkinnedMesh.applyBoneTransform, the GPU's sum), the strap as drawn (its mesh's vertices in the world), each strap
// vertex's distance to the nearest skin triangle, signed (+ off the skin, away from the forearm's bone line; − under
// it). tests/blade-grip.test.js holds it to a few millimetres through the clips; a script can print it.
import * as THREE from 'three';

const closest = new THREE.Triangle(), _q = new THREE.Vector3(), _l = new THREE.Line3();

/** strapSkin(humanoid, device).measure() -> { min, max, plate, worst }: m, the strap's vertices off the skin this frame. */
export function strapSkin(humanoid, device) {
  const arm = humanoid.b.lowerarm_l, hand = humanoid.b.hand_l;
  humanoid.model.updateMatrixWorld(true);
  const around = new THREE.Vector3().setFromMatrixPosition(device.root.matrixWorld);
  const parts = [];
  humanoid.model.traverseVisible((o) => {
    if (!o.isSkinnedMesh || !o.skeleton.bones.includes(arm)) return;
    const g = o.geometry, P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
    const index = g.index?.lodBase ?? g.index, ia = o.skeleton.bones.indexOf(arm), ih = o.skeleton.bones.indexOf(hand);
    const world = (i, out) => o.applyBoneTransform(i, out.fromBufferAttribute(P, i)).applyMatrix4(o.matrixWorld);
    const moved = (i) => { let w = 0; for (let k = 0; k < 4; k++) if ([ia, ih].includes(J.getComponent(i, k))) w += W.getComponent(i, k); return w; };
    const tris = [], verts = new Set(), p = new THREE.Vector3();
    for (let f = 0; f < (index ? index.count : P.count); f += 3) {
      const ids = [0, 1, 2].map((j) => (index ? index.getX(f + j) : f + j));
      if (Math.max(...ids.map(moved)) < 0.5 || ids.some((i) => world(i, p).distanceTo(around) > 0.14)) continue;
      tris.push(ids); ids.forEach((i) => verts.add(i));
    }
    parts.push({ world, tris, verts: [...verts], at: new Map() });
  });
  const strap = device.strap, Q = strap.geometry.attributes.position;
  return {
    triangles: parts.reduce((n, x) => n + x.tris.length, 0),
    /** Signed distance (m) from `p` (world) to the skin. */
    off(p) {
      let best = Infinity, sign = 1;
      for (const x of parts) for (const [a, b, c] of x.tris) {
        const A = x.at.get(a), B = x.at.get(b), C = x.at.get(c);
        if (Math.min(A.distanceToSquared(p), B.distanceToSquared(p), C.distanceToSquared(p)) > 0.0016) continue;
        closest.set(A, B, C).closestPointToPoint(p, _q);
        const d = _q.distanceTo(p);
        if (d < best) {
          best = d;
          const axis = _l.closestPointToPoint(_q, false, new THREE.Vector3());
          sign = p.clone().sub(_q).dot(_q.clone().sub(axis)) >= 0 ? 1 : -1;
        }
      }
      return best * sign;
    },
    measure() {
      humanoid.model.updateMatrixWorld(true);
      for (const x of parts) for (const i of x.verts) x.at.set(i, x.world(i, x.at.get(i) ?? new THREE.Vector3()));
      _l.set(arm.getWorldPosition(new THREE.Vector3()), hand.getWorldPosition(new THREE.Vector3()));
      strap.updateWorldMatrix(true, false);
      let min = Infinity, max = -Infinity, worst = null;
      const p = new THREE.Vector3();
      for (let i = 0; i < Q.count; i++) {
        const d = this.off(p.fromBufferAttribute(Q, i).applyMatrix4(strap.matrixWorld));
        if (d < min) { min = d; worst = i; }
        if (d > max) max = d;
      }
      const plate = this.off(p.setFromMatrixPosition(device.root.matrixWorld));
      return { min, max, plate, worst };
    },
  };
}
