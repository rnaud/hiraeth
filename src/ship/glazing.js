import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// Inward reflections plus a real post-ink wash; exterior paint remains untouched.
export const GLAZING = Object.freeze({ width: .03, inset: .12, lift: .012, alpha: .12 });
const key = p => [p.x, p.y, p.z].map(v => Math.round(v * 1e5)).join(',');

/** Recover perimeter edges only; welded triangle diagonals never become window bars. */
export function paneCues(geometry, { width = GLAZING.width } = {}) {
  const position = geometry.getAttribute('position'), index = geometry.index;
  const edges = new Map(), read = i => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i) : i);
  const count = index?.count ?? position.count;
  for (let i = 0; i < count; i += 3) {
    const p = [read(i), read(i + 1), read(i + 2)];
    const normal = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
    if (!normal.lengthSq()) continue;
    for (let k = 0; k < 3; k++) {
      const a = p[k], b = p[(k + 1) % 3], c = p[(k + 2) % 3];
      const id = [key(a), key(b)].sort().join('|');
      if (edges.has(id)) edges.get(id).uses++;
      else edges.set(id, { a, b, c, normal, uses: 1 });
    }
  }
  const positions = [];
  const strip = (a, b, inward, normal, inset, w) => {
    const offset = inward.clone().multiplyScalar(inset).addScaledVector(normal, -GLAZING.lift);
    const p = [a.clone().add(offset), b.clone().add(offset), b.clone().add(offset).addScaledVector(inward, w), a.clone().add(offset).addScaledVector(inward, w)];
    const face = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    const order = face.dot(normal) < 0 ? [0,1,2,0,2,3] : [0,2,1,0,3,2];
    for (const i of order) positions.push(p[i].x, p[i].y, p[i].z);
  };
  for (const { a, b, c, normal, uses } of edges.values()) {
    if (uses !== 1) continue;
    const along = b.clone().sub(a), length = along.length();
    if (length < width * 2) continue;
    along.normalize();
    const inward = c.clone().sub(a).addScaledVector(along, -c.clone().sub(a).dot(along));
    const altitude = inward.length();
    inward.normalize();
    const w = Math.min(width, altitude * .06), inset = Math.min(GLAZING.inset, altitude * .1);
    strip(a, b, inward, normal, inset, w);
    // Short, parallel glints near upper edges; no stripe crosses the viewing centre.
    if (Math.abs(along.y) < .15 && length > .3) {
      strip(a.clone().lerp(b, .18), a.clone().lerp(b, .42), inward, normal, inset + w * 3, w * .55);
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  return result;
}

/** Exact current authored windshield signature; fail closed for unrelated dark cockpit objects.
 * Future authored asset revisions must add an explicit pane tag/material (or deliberately
 * update this signature with the real-GLB regression); never widen this to all dark paint. */
export function isCaravanPane(node, material) {
  if (Array.isArray(node.material)) return false; // Never decorate an unsplit multi-material mesh.
  if (material?.name === 'viewGlass') return true;
  if (material?.name !== 'dark') return false;
  let cockpit = false;
  for (let p = node; p; p = p.parent) if (p.name === 'cockpit') cockpit = true;
  const g = node.geometry;
  if (!cockpit || g?.getAttribute('position')?.count !== 867 || g.index?.count !== 4800) return false;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  return Math.abs(min.y - 9.48) < .001 && Math.abs(max.y - 11.68) < .001 && Math.abs(min.x + 20.042839) < .001 && Math.abs(max.x + 12.6) < .001;
}

export function addPaneCues(pane) {
  const mesh = new THREE.Mesh(paneCues(pane.geometry), makeMaterial({ color: '#a5bdc5', flat: true, glow: .2 }));
  mesh.name = 'inward window reflections';
  mesh.userData.noCollide = true;
  mesh.userData.shipGlazing = true;
  mesh.userData.castShadow = false;
  mesh.castShadow = mesh.receiveShadow = false;
  pane.add(mesh);
  return mesh;
}

/** Register exact panes with the shared depth-tested web/native Veil pass.
 * Veils snapshots matrices when adding: moving ships must sync after their pose update.
 * BackSide shows the wash inward only, leaving the original outside surface intact.
 */
export function bindPaneWashes(veils, panes) {
  const entries = veils ? [...new Set(panes)].map(pane => ({ pane, wash: veils.add(pane, { color: '#cbd8d5', alpha: GLAZING.alpha, glow: 0, side: THREE.BackSide }) })) : [];
  let disposed = false;
  return {
    entries,
    sync() {
      if (disposed) return;
      for (const { pane, wash } of entries) {
        pane.updateWorldMatrix(true, false);
        wash.matrix.copy(pane.matrixWorld);
        wash.matrixWorld.copy(pane.matrixWorld);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { wash } of entries) veils.remove(wash);
      entries.length = 0;
    },
  };
}
