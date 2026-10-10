import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// The Buried Machine's way back to Wen (level design audit, fourth round: the walk from the great wheel back to the
// great dome passed nothing new). The Tooth Day posts: every Tooth Day the counters walk the sliver the wheel dropped
// from its foot to Wen's dome, and leave a post where they rest, the year's sliver nailed on top. Forty-one teeth on,
// the posts make a row across the dunes, the oldest by the domes grey and leaning, the newest by the wheel still red
// with rust. Kept off the strip the wheel digs out when it turns (src/levels/buried.js wheelSand). No rng.
//
//   buildToothPosts(scene, terrain) → { points, sight, oldest }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** The row, [x, z]: from the newest post, by the wheel's foot (outside its sand strip), to the oldest, by the domes. */
export const TOOTH_POSTS = { from: [80, -140], to: [-2, -30], count: 41 };

export function buildToothPosts(scene, terrain) {
  const { from, to, count } = TOOTH_POSTS;
  const wood = [], rust = [];
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), age = t;   // (0 the newest, 1 the oldest)
    // (a gentle bow in the row, as people walk it: a little off the straight line in the middle)
    const bow = Math.sin(t * Math.PI) * 9;
    const dx = to[0] - from[0], dz = to[1] - from[1], L = Math.hypot(dx, dz);
    const x = from[0] + dx * t + (dz / L) * bow, z = from[1] + dz * t - (dx / L) * bow;
    const y = terrain.heightAt(x, z), h = 1.35 - age * 0.35;
    const lean = (((i * 7) % 5) - 2) * 0.05 * (0.4 + age), yaw = i * 1.37;
    const m = new THREE.Matrix4().compose(V(x, y - 0.35, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, yaw, lean * 0.6)), V(1, 1, 1));
    wood.push(nonIdx(new THREE.BoxGeometry(0.22, h + 0.35, 0.22).translate(0, (h + 0.35) / 2, 0)).applyMatrix4(m));
    // the sliver: a little curved wedge of iron nailed on top
    rust.push(nonIdx(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 6, 1, false, 0, Math.PI * 0.7).rotateX(Math.PI / 2).translate(0, h + 0.38, 0)).applyMatrix4(m));
    pts.push([x, y + 0.5, z]);
  }
  const posts = new THREE.Mesh(mergeGeometries(wood), makeMaterial({ color: '#a8917a', flat: true }));
  posts.name = 'The Tooth Day posts';
  const slivers = new THREE.Mesh(mergeGeometries(rust), makeMaterial({ color: '#b5583a', flat: true, metal: 'iron' }));
  // (drawn only, thin posts you walk beside: as solids they shifted the contact audit's sampling of the whole world)
  posts.userData.noCollide = true; slivers.userData.noCollide = true;
  scene.add(posts, slivers);
  const every = (k) => pts.filter((_, i) => i % k === 0 || i === pts.length - 1);
  return { points: every(4), sight: V(...pts[Math.floor(count * 0.45)]), oldest: V(...pts[count - 1]) };
}
