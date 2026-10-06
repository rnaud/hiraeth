import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FORM } from './materials.js';

// ---------------------------------------------------------------------------
// Hatching that follows the form (docs/systems/materials.md): a part's axis, carried per vertex through
// merged geometry, so a material with form: true (S_FORM) can radiate its shade's strokes from a cap's
// stalk or wrap them round a cylinder.
//
//   formAxis(geo, 'cap' | 'wrap', { centre, axis })   tag a part, in its own frame (default: the y axis
//                                                     through the origin, as lathes and cylinders are made)
//   geo.translate / rotate / scale / applyMatrix4 / put()   carry the axis with the part
//   keepForm(copy)                                    a copy (toNonIndexed, mergeVertices) carries it too
//   mergeFormed(list), padForm(list)                  merge parts with and without an axis (the others: none)
// ---------------------------------------------------------------------------

export const FORM_ATTRS = ['aFormC', 'aFormA'];
const _n = new THREE.Matrix3(), _v = new THREE.Vector3();
const base = THREE.BufferGeometry.prototype.applyMatrix4;

/** Move a tagged part: its axis' point as a position, its direction by the linear part (a line stays the line). */
function applyFormed(m) {
  base.call(this, m);
  const c = this.attributes.aFormC, a = this.attributes.aFormA;
  if (c) {
    for (let i = 0; i < c.count; i++) { _v.set(c.getX(i), c.getY(i), c.getZ(i)).applyMatrix4(m); c.setXYZ(i, _v.x, _v.y, _v.z); }
    c.needsUpdate = true;
  }
  if (a) {
    _n.setFromMatrix4(m);
    for (let i = 0; i < a.count; i++) { _v.set(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix3(_n).normalize(); a.setXYZ(i, _v.x, _v.y, _v.z); }
    a.needsUpdate = true;
  }
  return this;
}

/** A copy of a tagged part (toNonIndexed, clone, mergeVertices) keeps carrying its axis when moved. */
export function keepForm(geo) {
  if (geo.attributes.aFormC) geo.applyMatrix4 = applyFormed;
  return geo;
}

/** Give a part its axis (kind 'cap': strokes radiate from it; 'wrap': they wrap round it). Returns geo. */
export function formAxis(geo, kind, { centre = [0, 0, 0], axis = [0, 1, 0] } = {}) {
  const k = FORM.kinds[kind] ?? 0, n = geo.attributes.position.count;
  const C = new Float32Array(n * 4), A = new Float32Array(n * 3);
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  for (let i = 0; i < n; i++) {
    C[i * 4] = centre[0]; C[i * 4 + 1] = centre[1]; C[i * 4 + 2] = centre[2]; C[i * 4 + 3] = k;
    A[i * 3] = axis[0] / l; A[i * 3 + 1] = axis[1] / l; A[i * 3 + 2] = axis[2] / l;
  }
  geo.setAttribute('aFormC', new THREE.BufferAttribute(C, 4));
  geo.setAttribute('aFormA', new THREE.BufferAttribute(A, 3));
  return keepForm(geo);
}

/** The parts that have no axis get none (kind 0), so they merge with those that do. */
export function padForm(list) {
  if (!list.some((g) => g.attributes.aFormC)) return list;
  for (const g of list) {
    if (g.attributes.aFormC) continue;
    const n = g.attributes.position.count, A = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) A[i * 3 + 1] = 1;
    g.setAttribute('aFormC', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    g.setAttribute('aFormA', new THREE.BufferAttribute(A, 3));
  }
  return list;
}

/** mergeGeometries for parts with and without an axis. */
export const mergeFormed = (list, groups = false) => keepForm(mergeGeometries(padForm(list), groups));
