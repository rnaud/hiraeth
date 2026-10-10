import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { steppedColumns } from './lookouts.js';

// Lorn's way home and the crystal cave's crown (level design audit, fourth round: the walk back from the cave to the
// ship was the way out, and the cave, a tunnel, could not be seen from the Great Crystal). No rng: the swamp round
// them stays as it was.
//
//   the cave's crown     a cluster of teal crystal grown up through the cave's ridge from the vault below, the tallest
//                        26 m over the ridge: the cave's crystals' own colour (it glows with them, and answers the
//                        splinter as they do), seen over the fungus trees from the Great Crystal's island.
//   Wendel's egg-lamps   posts in the shallows, each with one of Lorn's glowing eggs in an iron cup on top, from the
//                        cave's west mouth along the swamp's south shore to the landing: the egg-warden set them out
//                        to bring the egg-gatherers home from the cave at dusk. Halfway, the gatherers' punt is moored
//                        to one of them, its baskets still full of eggs.
//
//   buildCaveCrown(scene, cave, mat)  → { top, height }
//   buildEggLamps(scene, terrain)     → { points, punt, sight }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The lamps, [x, z]: from just outside the cave's west mouth along the south shore to the landing island's west beach. */
export const EGG_LAMPS = [[-214, 76], [-204, 50], [-184, 24], [-156, 4], [-124, -12], [-92, -22], [-62, -22], [-36, -12]];
/** The gatherers' punt, moored at the fifth lamp ([x, z], and the way its bow points). */
export const PUNT = { x: -121, z: -18, heading: 1.9 };

export function buildCaveCrown(scene, cave, mat) {
  // crooked hexagonal spires out of the ridge's crown: (along the ridge, across it, height, radius, lean x, lean z)
  const SPIRES = [[0, 0, 26, 3.2, 0.06, -0.04], [5, 2, 17, 2.2, 0.28, 0.12], [-6, -1.5, 19, 2.5, -0.24, 0.1], [2, -3.5, 12, 1.8, 0.1, -0.35], [-2, 3.5, 10, 1.6, -0.1, 0.38], [9, -1, 8, 1.4, 0.4, -0.1]];
  const ridge = cave.y + cave.r + 7;   // (the outer vault's crown: src/levels/perdide.js, its wall 7 m thick)
  const c = Math.cos(cave.rot), s = Math.sin(cave.rot);
  const parts = SPIRES.map(([u, v, h, r, lx, lz]) => {
    const g = new THREE.CylinderGeometry(0, r, h, 6).translate(0, h / 2, 0).rotateX(lx).rotateZ(lz);
    // (u along the tunnel's axis, v across it; sunk 3 m into the rock)
    return g.translate(cave.x + s * u + c * v, ridge - 3, cave.z + c * u - s * v).toNonIndexed();
  });
  const crown = new THREE.Mesh(mergeGeometries(parts), mat);
  crown.name = 'The cave’s crown';
  crown.userData.castShadow = true;
  scene.add(crown);
  return { top: V(cave.x, ridge - 3 + 26, cave.z), height: 24 };
}

/**
 * The crown's window (fifth round: Saba → the cave was blind, the landing island's crystal grove standing between her
 * stone and every bearing on the cave). The grove's crystals in a narrow lane along the sightline from Saba's stone to
 * the crown grow only as tall as the line allows, so from her stone the crown shows through a notch in the grove, framed
 * by its tall crystals. Only the height changes (the grove draws the same random numbers), so nothing else moves.
 *   crownWindow(cave) → (x, z, h, foot) => h, lowered where it would stand in the line
 */
export const SABA_STONE = [107, -131];
export function crownWindow(cave, { eye = 3.7, half = 7 } = {}) {
  const ridge = cave.y + cave.r + 7, aim = ridge - 3 + 26 - 0.2 * 24;   // (the crown's top, aimed at a fifth down: the audit's own aim)
  const [ax, az] = SABA_STONE, dx = cave.x - ax, dz = cave.z - az, L2 = dx * dx + dz * dz;
  return (x, z, h, foot = 0) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const off = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (off > half + h * 0.25) return h;   // (a crystal leans up to a quarter of its height)
    return Math.max(2.5, Math.min(h, eye + (aim - eye) * t - 3 - foot));   // (its top 3 m under the line; foot: the ground it stands on)
  };
}

export function buildEggLamps(scene, terrain) {
  const wood = makeMaterial({ color: '#4a3a4a', flat: true });
  const iron = makeMaterial({ color: '#2f2a3a', flat: true });
  const egg = makeMaterial({ color: '#f2e38f', glow: 1 });
  const posts = [], cups = [], eggs = [];
  const points = [];
  EGG_LAMPS.forEach(([x, z], i) => {
    const g = Math.min(terrain.heightAt(x, z), 0.3), top = 3.2 + (i % 2) * 0.4;   // (on the shore, or stood in the shallows)
    posts.push(new THREE.CylinderGeometry(0.14, 0.2, top - g + 0.6, 6).translate(x, (top + g - 0.6) / 2, z).toNonIndexed());
    cups.push(new THREE.CylinderGeometry(0.42, 0.22, 0.4, 7, 1, true).translate(x, top + 0.15, z).toNonIndexed());
    eggs.push(new THREE.SphereGeometry(0.34, 10, 8).scale(1, 1.35, 1).translate(x, top + 0.5, z).toNonIndexed());
    points.push([x, Math.max(terrain.heightAt(x, z), 0) + 0.5, z]);
  });
  // the punt: a long flat-bottomed boat tied to its lamp, two baskets of eggs aboard, a pole along its thwarts
  const P = PUNT, hull = [], load = [];
  const yaw = P.heading, frame = new THREE.Matrix4().compose(V(P.x, 0.05, P.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  hull.push(new THREE.BoxGeometry(1.5, 0.12, 5.2).translate(0, 0.06, 0));
  for (const sx of [-1, 1]) hull.push(new THREE.BoxGeometry(0.1, 0.5, 5.2).translate(sx * 0.75, 0.3, 0));
  for (const sz of [-1, 1]) hull.push(new THREE.BoxGeometry(1.5, 0.5, 0.1).rotateX(sz * 0.5).translate(0, 0.32, sz * 2.66));
  hull.push(new THREE.CylinderGeometry(0.04, 0.04, 5.6, 5).rotateX(Math.PI / 2).translate(0.5, 0.62, 0.2));
  for (const bz of [-1.2, 0.9]) {
    hull.push(new THREE.CylinderGeometry(0.5, 0.38, 0.55, 8, 1, true).translate(0, 0.4, bz));
    for (let k = 0; k < 5; k++) load.push(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 1.3, 1).translate(Math.cos(k * 1.3) * 0.22, 0.66 + (k % 2) * 0.1, bz + Math.sin(k * 1.3) * 0.22));
  }
  const rope = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 4).rotateZ(Math.PI / 2 - 0.3).translate(-1.4, 1.1, -2.4);
  const lampMat = (list, m) => { const mesh = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), m); return mesh; };
  // the posts collide as drawn (the skiff bumps them); the cups and eggs on top are drawn only, within a hand of the post's top
  const g = new THREE.Group();
  g.name = 'Wendel’s egg-lamps';
  const heads = [lampMat(cups, iron), lampMat(eggs, egg)];
  for (const m of heads) m.userData.noCollide = true;
  g.add(lampMat(posts, wood), ...heads);
  // the punt rides the water over the channel's floor (the clipping and contact audits: afloat on purpose); you pass through it
  const punt = new THREE.Group();
  punt.name = 'The gatherers’ punt';
  punt.add(lampMat([...hull, rope].map((q) => q.applyMatrix4(frame)), wood), lampMat(load.map((q) => q.applyMatrix4(frame)), egg));
  punt.userData.noCollide = true;
  for (const m of punt.children) m.userData.floats = true;
  scene.add(g, punt);
  return { points, punt: V(P.x, 0.4, P.z), sight: V(...points[2]) };
}

/**
 * Wendel's lookout (fifth round: Lorn was flat, 8 m between its lowest and highest places). A crystal of the cave's own
 * teal grown in a honeycomb of flat-topped hexagonal columns on the rise east of the landing: four round a tall middle
 * one, each a climb of 6 m above the last (6, 12, 18, 24, then the middle at 30), so you go up it step by step, a short
 * climb and a rest. The egg-warden climbs it at dusk to count the gatherers home. From the top the whole swamp shows:
 * the cave's crown over the fungus to the north-west, the Great Crystal to the south-east, the egg-lamps on the shore.
 * The makers' box that sat on the rise sits on the top now. Every column collides as drawn.
 *
 *   buildLookout(scene, terrain, mat) → { top, steps (the columns' tops in climbing order), foot, height }
 */
export const LOOKOUT = { x: 62, z: -32, r: 3, step: 6 };
export function buildLookout(scene, terrain, mat) {
  const { x, z, r, step } = LOOKOUT;
  // the ring climbs anticlockwise from the side that faces the landing (src/lookouts.js)
  const S = steppedColumns({ x, z, r, step, sides: 6, ground: (px, pz) => terrain.heightAt(px, pz), face: Math.PI * 0.75 });
  const parts = [...S.parts];
  // two short pointed crystals where the ring is open, and a thin spire up from the middle's back edge
  for (const [[ox, oz], h] of [[S.open[0], 4.5], [S.open[1], 3.2]]) {
    const k = (S.d - 0.6) / S.d, cx = x + (ox - x) * k, cz = z + (oz - z) * k, f = terrain.heightAt(cx, cz) - 0.8;
    parts.push(new THREE.CylinderGeometry(0, 1.6, h + 0.8, 6).translate(cx, f + (h + 0.8) / 2, cz).toNonIndexed());
  }
  {
    const a = Math.PI * 0.75 + Math.PI * 1.5, cx = x + Math.cos(a) * (S.ap - 0.7), cz = z + Math.sin(a) * (S.ap - 0.7);
    parts.push(new THREE.CylinderGeometry(0, 0.75, 8, 6).translate(cx, S.top.y - 0.5 + 4, cz).toNonIndexed());
  }
  const m = new THREE.Mesh(mergeGeometries(parts), mat);
  m.name = 'Wendel’s lookout';
  m.userData.castShadow = true;
  scene.add(m);
  return { top: S.top, steps: S.steps, foot: S.foot, height: step * 5 };
}
