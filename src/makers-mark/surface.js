import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { markContours } from './design.js';
/** Flat ink following a curved hull or terrain; map(x,y) returns a Vector3.
 * Subdivide before projection so broad strokes follow the surface between their edges. */
export function markOnSurface(size, map) {
  const parts = markContours(size).map(points => {
    const shape = new THREE.Shape(points.map(([x,y]) => new THREE.Vector2(x,y)));
    const source = new THREE.ShapeGeometry(shape), flat = source.toNonIndexed();
    const p = flat.attributes.position, vertices = [];
    const mid = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
    function triangle(a,b,c,n) {
      if (n) {
        const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
        triangle(a,ab,ca,n-1); triangle(ab,b,bc,n-1); triangle(ca,bc,c,n-1); triangle(ab,bc,ca,n-1);
      } else for(const [x,y] of [a,b,c]) { const v=map(x,y);vertices.push(v.x,v.y,v.z); }
    }
    for(let i=0;i<p.count;i+=3) triangle([p.getX(i),p.getY(i)],[p.getX(i+1),p.getY(i+1)],[p.getX(i+2),p.getY(i+2)],3);
    source.dispose();flat.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));
    g.computeVertexNormals();return g;
  });
  const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
}
