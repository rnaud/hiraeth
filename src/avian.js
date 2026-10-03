import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A curved, tapered feather with a raised shaft. Local +Z is the bird's head;
// feathers grow toward -Z. Volume keeps them visible from above and below.
export function featherGeometry(length, width) {
  const vertices = [], indices = [], steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const half = width * .5 * Math.pow(Math.sin(Math.PI * t), .65);
    const z = -length * t, camber = Math.sin(Math.PI * t) * width * .08;
    vertices.push(-half, camber, z, 0, camber + width * .09, z, half, camber, z);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j, b = a + 3;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function smallWingGeometry(side) {
  const parts = [featherGeometry(1.32,.65).rotateY(-side*1.1).translate(side*.12,.03,.05)];
  // Separated primary tips, overlapping secondary feathers at the shoulder.
  for (let i=0;i<7;i++) parts.push(featherGeometry(.64 + i*.04,.2).rotateY(-side*(.25+i*.13)).translate(side*(.24+i*.14),0,-.04-i*.065));
  return mergeGeometries(parts.map(g=>g.toNonIndexed()));
}
