// Fixed viewpoints over the desert, in the web game's coordinates, for side-by-side
// screenshots of the web game and the Unity port:
//   node scripts/unity-export/views.mjs > views.json
// Each eye stands a set height above the ground there, so both sides see the same frame.
import './shim.mjs';
import * as THREE from 'three';
THREE.ColorManagement.enabled = false;
const { createDesert } = await import('../../src/levels/desert.js');
const log = console.log; console.log = console.info = console.warn = () => {};
const level = createDesert(new THREE.Scene());
const h = (x, z) => level.ground.heightAt(x, z);
const Q = level.qanat;
const at = (x, z, up) => [x, h(x, z) + up, z];
const c = Q.city.center, g = Q.city.gate, f = Q.camps.fires[0], tree = Q.city.treeBase;
const views = [
  { name: 'start', eye: at(0, 7, 2.4), target: at(0, -30, 1.5), fov: 55 },
  { name: 'ship', eye: at(-10, 80, 6), target: [20, h(20, 120) + 6, 120], fov: 55 },
  { name: 'camps', eye: at(f.x - 14, f.z - 16, 3), target: [f.x, f.y + 1.2, f.z], fov: 55 },
  { name: 'city', eye: at(g.x - 60, g.z - 70, 12), target: [c.x, c.y + 10, c.z], fov: 55 },
  { name: 'tree', eye: [Q.city.plinthStair.x, Q.city.plinthStair.y + 2, Q.city.plinthStair.z], target: [tree.x, tree.y + 14, tree.z], fov: 60 },
  { name: 'dunes', eye: at(-200, 300, 18), target: at(-420, 520, 0), fov: 55 },
];
log(JSON.stringify(views, null, 1));
