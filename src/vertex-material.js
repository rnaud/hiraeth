// Many meshes of one surface shader drawn as one, each keeping its own material values and its own object
// space (materials.js S_VMAT, makeMaterial({ perVertex: true }); docs/systems/performance.md, "Round 3"):
// the colours, the strata's band size, the grid and flat shading go per vertex, and so do the object-space
// position and normal that the hatching, the grid and the strata strokes are anchored to, and the object's
// place and turn (the camera-relative point the facet normals are taken from). For objects turned about +y
// only, unscaled: what the City-Shaft's towers are (a draw and a material each: some 200 draws in a view
// across the shaft, twice with the shadows).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** the uniforms that go per vertex (the fragment shader reads them from the vertex under S_VMAT) */
export const VERTEX_UNIFORMS = ['uColor', 'uColor2', 'uColor3', 'uStrataSize', 'uGrid', 'uFlat'];

const valueKey = (v) => (v === null || v === undefined ? 'n' : v.isTexture ? 't' + v.uuid : v.toArray ? v.toArray().join(',')
  : Array.isArray(v) ? v.map(valueKey).join(';') : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** what else of two materials must agree for their meshes to share a merged draw: every other uniform, the defines, the state */
export function restKey(m) {
  const u = Object.entries(m.uniforms ?? {}).filter(([k]) => !VERTEX_UNIFORMS.includes(k)).map(([k, x]) => k + '=' + valueKey(x.value));
  return [JSON.stringify(m.defines ?? {}), m.side, m.transparent, m.depthWrite, m.blending, m.polygonOffset, m.vertexColors, ...u].join('|');
}

/**
 * items: [{ geometry (its object space), x, y, z, rotY, material }], all with the same restKey: one geometry in
 * world space carrying each one's material values (aMatC1-3, aMatS: band size, grid, flat), object-space point
 * and normal (aObjP, aObjN) and place and turn (aObjM). Placed as Object3D would place it (position, a turn
 * about y, no scale).
 */
export function mergeWithMaterials(items) {
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), M = new THREE.Matrix4();
  const geos = items.map(({ geometry: src, x, y, z, rotY, material: m }) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.attributes.position.clone());
    g.setAttribute('normal', src.attributes.normal.clone());
    if (src.index) g.setIndex(src.index.clone());
    const n = g.attributes.position.count, U = m.uniforms;
    const fill = (size, f) => { const a = new Float32Array(n * size); for (let i = 0; i < n; i++) f(a, i * size, i); return new THREE.BufferAttribute(a, size); };
    const c = (k) => U[k].value;
    g.setAttribute('aMatC1', fill(3, (a, j) => c('uColor').toArray(a, j)));
    g.setAttribute('aMatC2', fill(3, (a, j) => c('uColor2').toArray(a, j)));
    g.setAttribute('aMatC3', fill(3, (a, j) => c('uColor3').toArray(a, j)));
    g.setAttribute('aMatS', fill(3, (a, j) => { a[j] = c('uStrataSize'); a[j + 1] = c('uGrid'); a[j + 2] = c('uFlat'); }));
    g.setAttribute('aObjP', src.attributes.position.clone());
    g.setAttribute('aObjN', src.attributes.normal.clone());
    g.setAttribute('aObjM', fill(4, (a, j) => { a[j] = x; a[j + 1] = y; a[j + 2] = z; a[j + 3] = rotY; }));
    g.applyMatrix4(M.compose(p.set(x, y, z), q.setFromEuler(e.set(0, rotY, 0)), one));
    return g;
  });
  // (all indexed or none, as mergeGeometries wants)
  const list = geos.every((x) => x.index) ? geos : geos.map((x) => (x.index ? x.toNonIndexed() : x));
  const g = mergeGeometries(list);
  g.computeBoundingSphere();
  return g;
}
