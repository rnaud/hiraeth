import * as THREE from 'three';

// The flat worlds' high places (level design audit, fifth round: Lorn and the Deep Wood span 8 and 17 m of height). A
// stepped stand of flat-topped columns: four in a ring round a tall middle one, each a climb of `step` m above the last,
// so the traveller goes up a short climb and a rest at a time (the climb's stamina never runs out on one pitch). The
// columns stand side by side a hair apart, their faces upright (within the climb's 20 degrees) and their tops level;
// every one collides as drawn. Each world dresses its own (Lorn's teal crystal, the Deep Wood's dead giant stalks).
//
//   steppedColumns({ x, z, r, step, sides, ground, face }) → { parts, steps, top, foot, g0, d, open }
//     parts   the five columns' geometries (non-indexed), the middle first
//     steps   the columns' top centres in climbing order (the ring's four, then the middle)
//     top     the middle's top centre; foot: the ground before the first column; g0: the lowest ground under them
//     open    the two ring places left open ([x, z] each), for a world's own dressing

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function steppedColumns({ x, z, r = 3, step = 6, sides = 6, ground, face = 0, sink = 1.5 }) {
  // (hexagons sit side by side flat face to flat face; rounder columns a little apart, so the climb has a face each)
  const ap = r * Math.cos(Math.PI / sides), d = ap * 2 + (sides === 6 ? 0.04 : 0.3);
  const ring = [0, 1, 2, 3].map((k) => [face + (k * Math.PI) / 3, k + 1]);
  const g0 = Math.min(...[[0, 0], ...ring.map(([a]) => [Math.cos(a) * d, Math.sin(a) * d])].map(([dx, dz]) => ground(x + dx, z + dz)));
  const col = (cx, cz, top) => {
    const foot = Math.min(ground(cx, cz), g0) - sink;
    return new THREE.CylinderGeometry(r, r, top - foot, sides).rotateY(sides === 6 ? Math.PI / 6 : 0).translate(cx, (top + foot) / 2, cz).toNonIndexed();
  };
  const top = V(x, g0 + step * 5, z);
  const parts = [col(x, z, top.y)];
  const steps = [];
  for (const [a, k] of ring) {
    const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
    parts.push(col(cx, cz, g0 + step * k));
    steps.push(V(cx, g0 + step * k, cz));
  }
  steps.push(top.clone());
  const open = [face - Math.PI / 3, face - (2 * Math.PI) / 3].map((a) => [x + Math.cos(a) * d, z + Math.sin(a) * d]);
  return { parts, steps, top, foot: V(x + Math.cos(face) * (d + r), g0, z + Math.sin(face) * (d + r)), g0, d, ap, open };
}
