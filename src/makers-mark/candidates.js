import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Five hearted sources. Option 4 is the approved production mark; the others remain for comparison.
// Coordinates are in a 100 × 100 drawing, y down; kept as paths for the picker too.
import { MAKERS_MARK_ID, MAKERS_MARK_PATHS } from './design.js';
export const MARK_CANDIDATES = [
  { id: 'hand', name: 'Maker’s hand', source: '99e27f40-417d-4b3b-a0a3-e0092926e3fe', index: 0,
    description: 'Three rising strokes held by a sweep.', paths: [
      [['M', 29, 18], ['C', 16, 48, 14, 72, 67, 89], ['L', 75, 88], ['L', 70, 95], ['C', 12, 79, 9, 62, 29, 18]],
      [['M', 39, 17], ['Q', 29, 27, 31, 48], ['Q', 31, 57, 39, 66]],
      [['M', 45, 11], ['Q', 48, 7, 52, 7], ['L', 52, 79], ['Q', 46, 78, 45, 70]],
      [['M', 59, 3], ['Q', 63, 0, 67, 1], ['L', 67, 86], ['Q', 61, 84, 59, 78]],
    ] },
  { id: 'listening', name: 'Listening', source: '7f7335c4-c2a2-4e8e-946e-a8ac3c3661b5', index: 0,
    description: 'A deep crescent receiving three marks.', paths: [
      [['M', 73, 3], ['C', 31, 5, 13, 31, 13, 52], ['C', 13, 75, 39, 89, 73, 97], ['L', 73, 77], ['C', 49, 70, 38, 62, 38, 51], ['C', 38, 37, 50, 29, 73, 24]],
      [['M', 73, 25], ['L', 86, 35], ['Q', 87, 37, 84, 40], ['L', 76, 48], ['L', 63, 39], ['Q', 61, 37, 64, 34]],
      [['M', 65, 45], ['L', 76, 54], ['L', 66, 65], ['L', 56, 56]],
      [['M', 74, 64], ['L', 84, 70], ['L', 80, 82], ['L', 69, 77], ['L', 67, 70]],
    ] },
  { id: 'resonance', name: 'Resonance', source: 'c8098a92-88d5-4f19-a046-67bbb3dbc6e4', index: 2,
    description: 'Three broad arcs, one quiet centre.', paths: [
      [['M', 84, 2], ['C', 41, 4, 10, 22, 10, 50], ['C', 10, 76, 41, 95, 84, 98], ['L', 84, 87], ['C', 48, 83, 23, 69, 23, 50], ['C', 23, 31, 47, 17, 84, 13]],
      [['M', 83, 25], ['C', 57, 26, 34, 36, 34, 51], ['C', 34, 66, 54, 77, 80, 80], ['L', 83, 70], ['C', 63, 65, 47, 60, 47, 51], ['C', 47, 42, 63, 37, 84, 36]],
      [['M', 76, 43], ['Q', 58, 45, 59, 54], ['Q', 60, 63, 76, 65], ['L', 83, 60], ['Q', 71, 56, 76, 43]],
    ] },
  { id: 'corner', name: 'Open corner', source: 'f24ca4ef-8d15-499e-86b7-aa56024167a8', index: 2,
    description: 'An open shoulder and a grounded answering stroke.', paths: MAKERS_MARK_PATHS },
  { id: 'corner-soft', name: 'Quiet reply', source: '1ff9bc0a-df41-4514-a78b-78872b875715', index: 2,
    description: 'A wider shoulder; the shorter stroke floats inside it.', paths: [
      [['M', 23, 94], ['L', 20, 12], ['Q', 42, 9, 77, 12], ['Q', 80, 20, 74, 26], ['Q', 62, 29, 43, 28], ['L', 43, 94]],
      [['M', 53, 43], ['Q', 62, 33, 73, 38], ['L', 76, 41], ['L', 72, 83], ['Q', 60, 84, 52, 80]],
    ] },
];

export const markById = id => MARK_CANDIDATES.find(m => m.id === id);
export const markSource = m => `https://www.midjourney.com/jobs/${m.source}?index=${m.index}`;
export const markPath = path => path.map(c => c.join(' ')).join(' ') + ' Z';
export function reviewMark(search = globalThis.location?.search ?? '') {
  const q = new URLSearchParams(search);
  return q.has('markReview') && markById(q.get('mark')) ? q.get('mark') : null;
}

/** Production uses the approved mark; the local comparison can still show the former design. */
export function activeMark(search = globalThis.location?.search ?? '') {
  const q = new URLSearchParams(search);
  if (q.has('markReview') && q.get('mark') === 'current') return null;
  return reviewMark(search) ?? MAKERS_MARK_ID;
}

/** Centred, +z-facing relief. All candidates fit the same size square, with their original proportions. */
export function candidateGeometry(id, size = 1, depth = 0.06) {
  const mark = markById(id);
  if (!mark) return null;
  if (!(size > 0) || !(depth > 0)) throw new RangeError('Mark size and depth must be positive');
  const methods = { M: 'moveTo', L: 'lineTo', Q: 'quadraticCurveTo', C: 'bezierCurveTo' };
  const shapes = mark.paths.map(path => {
    const shape = new THREE.Shape();
    for (const [op, ...p] of path) shape[methods[op]](...p.map((v, i) => i % 2 ? -v : v));
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 24);
  });
  const outline = mergeGeometries(shapes);
  outline.computeBoundingBox();
  const bounds = outline.boundingBox, extent = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3()), scale = size / Math.max(extent.x, extent.y);
  outline.dispose(); shapes.forEach(g => g.dispose());
  const solids = mark.paths.map(path => {
    const shape = new THREE.Shape();
    for (const [op, ...p] of path) shape[methods[op]](...p.map((v, i) => i % 2 ? -v : v));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24, steps: 1 })
      .translate(-centre.x, -centre.y, -depth / 2).scale(scale, scale, 1);
  });
  const geometry = mergeGeometries(solids);
  solids.forEach(g => g.dispose());
  geometry.userData.makersMark = id;
  return geometry;
}
