import * as THREE from 'three';

// The Signal Market's night halt (the night mail: src/story/night-train.js, docs/story-bible.md "The night mail"): past
// the landing at the market's south end, a single line of rail running out east and west into the dark, a low platform
// along it, a lamp on an iron post, a brass bell on another, a shelter with a bench and the timetable under glass, a
// board that says NIGHT HALT. Edda keeps it. Built with the market's own helpers (src/levels/bazaar.js buildBazaar's
// box / tube / sphere and materials), so it is merged with the market's geometry and its colours.
//
//   const H = buildNightHalt({ box, tube, sphere, M: { ink, brass, cream, glow, dark, plank, stone } })
//   → { edda, bell, lamp, timetable, heading, arrival: { pos, heading }, lights: [Vector4], line: { z, x0, x1 } }

/** Where it stands: the platform's middle (x, z), its length along x, the line's z (south of the platform). */
export const HALT = { x: -28, z: 170, half: 20, depth: 4.2, top: 0.62, line: 174.6, reach: 420 };

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildNightHalt({ box, tube, sphere, M }) {
  const { x, z, half, depth, top, line, reach } = HALT;
  const z0 = z - depth / 2, z1 = z + depth / 2;
  // the platform: a stone kerb and plank top, a step up at each end
  box(x, top / 2, z, half * 2, top, depth, M.stone);
  box(x, top + 0.03, z1 - 0.25, half * 2, 0.06, 0.5, M.cream, false);   // (the edge's pale line)
  for (const s of [-1, 1]) box(x + s * (half + 0.7), top / 4, z, 1.4, top / 2, depth * 0.7, M.stone);
  // the line: the bed, the sleepers, two rails, out to the dark both ways
  box(0, 0.06, line, reach * 2, 0.12, 3.2, M.dark, false);
  for (let xs = -reach; xs <= reach; xs += 1.2) box(xs, 0.15, line, 0.28, 0.1, 2.6, M.plank, false);
  for (const s of [-0.72, 0.72]) box(0, 0.26, line + s, reach * 2, 0.12, 0.1, M.brass, false);
  // the lamp: an iron post, an arm, the lantern
  const lampX = x + 4, lampZ = z0 + 0.6;
  box(lampX, top + 2.1, lampZ, 0.16, 4.2, 0.16, M.ink);
  box(lampX + 0.45, top + 4.15, lampZ, 1.0, 0.1, 0.1, M.ink, false);
  box(lampX + 0.9, top + 3.75, lampZ, 0.42, 0.62, 0.42, M.ink, false);
  sphere(lampX + 0.9, top + 3.72, lampZ, 0.17, 0.24, 0.17, M.glow);
  // the bell on its post, its rope
  const bellX = x - 2, bellZ = z0 + 0.6;
  box(bellX, top + 1.45, bellZ, 0.14, 2.9, 0.14, M.ink);
  box(bellX + 0.25, top + 2.85, bellZ, 0.6, 0.08, 0.08, M.ink, false);
  sphere(bellX + 0.5, top + 2.62, bellZ, 0.22, 0.26, 0.22, M.brass);
  tube([[bellX + 0.5, top + 2.4, bellZ], [bellX + 0.52, top + 1.7, bellZ + 0.02], [bellX + 0.48, top + 1.1, bellZ]], 0.02, M.cream);
  // the shelter: four posts, a roof, a bench, the timetable under glass on its back
  const sx = x - 11;
  for (const [dx, dz] of [[-2.2, -1.4], [2.2, -1.4], [-2.2, 1.0], [2.2, 1.0]]) box(sx + dx, top + 1.3, z + dz, 0.14, 2.6, 0.14, M.ink);
  box(sx, top + 2.66, z - 0.2, 5.0, 0.12, 3.0, M.dark);
  box(sx, top + 0.45, z - 1.15, 3.6, 0.1, 0.5, M.plank);
  box(sx, top + 0.22, z - 1.15, 3.4, 0.44, 0.08, M.ink, false);
  box(sx, top + 1.4, z - 1.42, 1.2, 0.9, 0.06, M.cream, false);
  // the board over the platform: NIGHT HALT (its letters are the sign's paint: a long cream panel on two posts)
  const bx = x + 12;
  for (const s of [-1, 1]) box(bx + s * 1.6, top + 1.5, z0 + 0.3, 0.12, 3.0, 0.12, M.ink);
  box(bx, top + 2.75, z0 + 0.3, 3.8, 0.7, 0.1, M.cream, false);
  box(bx, top + 2.75, z0 + 0.36, 3.4, 0.08, 0.02, M.ink, false);
  return {
    edda: V(lampX - 1.4, top, lampZ + 0.9), heading: Math.PI, bell: V(bellX + 0.5, top + 1.6, bellZ),
    lamp: V(lampX + 0.9, top + 3.72, lampZ), timetable: V(sx, top + 1.4, z - 1.3),
    board: V(bx, top + 2.75, z0 + 0.25),   // (its face toward the market, -z: the letters go on it, src/story/night-train.js)
    // stepping down from the train: on the platform by the bell, facing the market
    arrival: { pos: V(x - 6, top + 0.05, z + 0.8), heading: Math.PI },
    lights: [new THREE.Vector4(lampX + 0.9, top + 3.4, lampZ, 9), new THREE.Vector4(sx, top + 2.4, z - 0.4, 5)],
    line: { z: line, x0: -reach, x1: reach },
  };
}
