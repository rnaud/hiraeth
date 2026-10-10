import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// Lorn II's way home (level design audit, fourth round: the walk back from the root cave to the ship was the lit path
// you came down). The lamp-keepers kept two ways lit: the path for those on foot, and the water-way for boats, lamps on
// posts over the deep water east of the wood. The water-way went dark long ago; when Hollin hears what was in the
// saucer he lights it again, and the skiff waiting in the root cave's lagoon takes you home by it. No rng: the wood
// round it stays as it was.
//
//   the water-gate    two tall posts and a crossbeam with a hanging lamp, where the water-way leaves the lagoon
//   the water-way     coral lamps on posts, north-east round the deep water and back to the landing island
//   the lamp-raft     halfway, a raft moored under the biggest lamp, where the keepers trimmed the wicks
//
//   buildWaterWay(scene, terrain) → { points, gate, raft, lit(on) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);

/** The water-gate ([x, z]), and the water-way's lamps after it ([x, z]), from the lagoon home. */
export const WATER_GATE = { x: 18, z: -372, heading: 0.9 };
export const WATER_WAY = [[56, -368], [95, -342], [118, -296], [120, -232], [108, -172], [84, -114], [60, -60], [28, -26]];
/** The lamp-raft, under the fourth lamp. */
export const LAMP_RAFT = { x: 124, z: -236 };

export function buildWaterWay(scene, terrain) {
  const wood = makeMaterial({ color: '#3a3446', flat: true });
  const dark = makeMaterial({ color: '#6a5a5e', flat: true });
  const lamp = makeMaterial({ color: '#f2a07a', glow: 1 });
  const posts = [], glass = [];
  const lampAt = (x, z, top) => {
    const g = Math.min(terrain.heightAt(x, z), 0);
    posts.push(nonIdx(new THREE.CylinderGeometry(0.16, 0.22, top - g + 0.8, 6).translate(x, (top + g - 0.8) / 2, z)));
    posts.push(nonIdx(new THREE.ConeGeometry(0.5, 0.45, 6).translate(x, top + 0.95, z)));
    glass.push(nonIdx(new THREE.CylinderGeometry(0.32, 0.32, 0.75, 6).translate(x, top + 0.38, z)));
  };
  WATER_WAY.forEach(([x, z], i) => lampAt(x, z, 2.8 + (i % 2) * 0.5));
  // the gate: two posts, a crossbeam, a lamp hung from its middle
  {
    const { x, z, heading } = WATER_GATE, c = Math.cos(heading), s = Math.sin(heading);
    for (const k of [-1, 1]) { const px = x + c * k * 3.4, pz = z - s * k * 3.4, g = Math.min(terrain.heightAt(px, pz), 0); posts.push(nonIdx(new THREE.CylinderGeometry(0.22, 0.3, 7 - g, 7).translate(px, (7 + g) / 2, pz))); }
    posts.push(nonIdx(new THREE.BoxGeometry(8.2, 0.35, 0.35).rotateY(heading).translate(x, 6.8, z)));
    posts.push(nonIdx(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4).translate(x, 6.0, z)));
    posts.push(nonIdx(new THREE.ConeGeometry(0.55, 0.45, 6).translate(x, 5.6, z)));
    glass.push(nonIdx(new THREE.CylinderGeometry(0.36, 0.36, 0.8, 6).translate(x, 5.0, z)));
  }
  // the raft: planks on two logs, a lamp-box, a coil of wick, under the fourth lamp
  const raft = [];
  {
    const { x, z } = LAMP_RAFT;
    for (const k of [-1, 1]) raft.push(nonIdx(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 7).rotateX(Math.PI / 2).translate(x + k * 0.9, 0.08, z)));
    raft.push(nonIdx(new THREE.BoxGeometry(2.6, 0.12, 4.4).translate(x, 0.38, z)), nonIdx(new THREE.BoxGeometry(0.8, 0.6, 0.6).translate(x - 0.5, 0.74, z + 1.2)));
    raft.push(nonIdx(new THREE.TorusGeometry(0.3, 0.08, 5, 10).rotateX(Math.PI / 2).translate(x + 0.6, 0.5, z - 1.1)));
  }
  // the posts and the gate collide as drawn (the skiff bumps them); the lamps on them are drawn only, within a hand of
  // the posts' tops; the raft rides the water over its floor (the clipping and contact audits: afloat on purpose)
  const g = new THREE.Group();
  g.name = 'The water-way';
  const woodMesh = new THREE.Mesh(mergeGeometries(posts), wood);
  const raftMesh = new THREE.Mesh(mergeGeometries(raft), wood);
  raftMesh.name = 'The lamp-raft'; raftMesh.userData.noCollide = true; raftMesh.userData.floats = true;
  const glassGeo = mergeGeometries(glass);
  const unlit = new THREE.Mesh(glassGeo, dark), litGlass = new THREE.Mesh(glassGeo, lamp);
  litGlass.visible = false;
  for (const m of [unlit, litGlass]) m.userData.noCollide = true;
  g.add(woodMesh, raftMesh, unlit, litGlass);
  scene.add(g);
  const lit = (on) => { litGlass.visible = !!on; unlit.visible = !on; };
  const points = [[WATER_GATE.x, 0.5, WATER_GATE.z], ...WATER_WAY.map(([x, z]) => [x, Math.max(terrain.heightAt(x, z), 0) + 0.5, z])];
  return { points, gate: V(WATER_GATE.x, 0.5, WATER_GATE.z), raft: V(LAMP_RAFT.x, 0.5, LAMP_RAFT.z), lit };
}
