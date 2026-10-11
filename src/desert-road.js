import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { staticFlame } from './story/flames.js';
import { rough } from './desert-hearth.js';

// The pilgrims' road: the old way down from Qanat's main gate to the landing, west of the straight way in, marked
// with cairns of stacked stones, each with a little clay lamp on top. It bends out over the dunes past Oum's stone and
// over the crest of the last big dune, where the pilgrims' resting stone looks back at the tree, then down to the
// landing from the north-west (level design audit v1.15: the walk from the tree back to the ship was the way you
// came; this is the second way home). While the tree is cold the lamps are dead; when it burns, Qanat lights them
// one after another from the gate down to your ship (src/story/desert-road.js), the road home for its guest.
//
//   const road = buildPilgrimsRoad(scene, terrain)  →  { points, cairns: [{ at, top, flame, light }], rest, avoid(x, z, r) }

/** The cairns, [x, z], from just west of the main gate down to the landing. */
export const ROAD = [[168, 352], [128, 340], [90, 318], [55, 290], [28, 255], [16, 226], [-4, 182], [-24, 146], [-22, 102], [-14, 62], [-6, 30]];
/** The resting stone on the last dune's crest, between the 7th and 8th cairns ([x, z]; it faces the tree). */
export const REST = { x: -12, z: 142 };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function buildPilgrimsRoad(scene, terrain, { tree = V(230, 0, 400) } = {}) {
  const H = (x, z) => terrain.heightAt(x, z);
  const stone = makeMaterial({ color: '#cdb38f', color2: '#bfa27c', flat: true });
  const clay = makeMaterial({ color: '#b86a43', flat: true });
  const flameMat = makeMaterial({ color: '#ffd27a', glow: 1, flat: true, key: 'desert.road.flame' });
  const stones = [], lamps = [], cairns = [];
  ROAD.forEach(([x, z], i) => {
    const y = H(x, z), turn = i * 1.7;
    let h = 0;
    // four or five flat stones, each a little smaller and turned, leaning a touch (a pilgrim stacked them by hand)
    const n = 4 + (i % 2);
    for (let k = 0; k < n; k++) {
      const r = 0.62 - k * 0.1, t = r * 0.62;
      const g = rough(new THREE.IcosahedronGeometry(r, 0).scale(1.25, 0.62, 1), 0.035, 3, i * 7 + k)
        .rotateY(turn + k * 0.9).translate(x + Math.sin(k * 2.1 + i) * 0.05, y + h + t * 0.5 - 0.12, z + Math.cos(k * 1.7 + i) * 0.05);
      stones.push(g);
      h += t * 0.82;
    }
    // the lamp: a little clay bowl on the top stone, a wick
    const top = V(x, y + h - 0.1, z);
    lamps.push(new THREE.LatheGeometry([[0.03, 0], [0.16, 0.02], [0.2, 0.1], [0.17, 0.14]].map(([r, yy]) => new THREE.Vector2(r, yy)), 9).translate(top.x, top.y, top.z).toNonIndexed());
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 6).translate(0, 0.32, 0), flameMat);
    flame.position.copy(top); flame.userData.noCollide = true; flame.visible = false; flame.name = 'Cairn lamp flame';
    staticFlame(flame, [V(0, 0.11, 0)], { r: 0.12, h: 0.42 });   // (lit, it burns: issue #77)
    scene.add(flame);
    cairns.push({ at: V(x, y, z), top, flame, light: new THREE.Vector4(top.x, top.y + 0.4, top.z, 0) });
  });
  // the resting stone: a broad slab worn smooth on two low stones, turned to the tree, on the last dune's crest
  const ry = H(REST.x, REST.z), face = Math.atan2(tree.x - REST.x, tree.z - REST.z);
  const at = (lx, ly, lz) => V(REST.x + Math.cos(face) * lx + Math.sin(face) * lz, ry + ly, REST.z - Math.sin(face) * lx + Math.cos(face) * lz);
  for (const lx of [-1.0, 1.0]) { const p = at(lx, 0.22, 0); stones.push(rough(new THREE.BoxGeometry(0.55, 0.6, 0.6), 0.04, 2, lx > 0 ? 3 : 4).rotateY(face).translate(p.x, p.y, p.z)); }
  { const p = at(0, 0.6, 0); stones.push(rough(new THREE.BoxGeometry(2.8, 0.22, 0.85), 0.03, 1.4, 9).rotateY(face).translate(p.x, p.y, p.z)); }
  // pilgrims' tokens tied to a stake beside it: strips of cloth, faded
  const stake = at(1.9, 0, -0.2), cloth = makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide }), cream = makeMaterial({ color: '#f3ead8', flat: true, side: THREE.DoubleSide });
  const wood = makeMaterial({ color: '#8a6a4a', flat: true });
  const stakeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 5).translate(stake.x, stake.y + 0.8, stake.z), wood);
  scene.add(stakeMesh);
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.55).translate(0, -0.27, 0).rotateY(face + k * 1.3).rotateZ(0.25), k % 2 ? cream : cloth);
    m.position.set(stake.x, stake.y + 1.45 - k * 0.06, stake.z); m.userData.noCollide = true;
    scene.add(m);
  }
  const group = new THREE.Group(); group.name = 'The pilgrims’ road';
  const s = new THREE.Mesh(mergeGeometries(stones.map((g) => (g.index ? g.toNonIndexed() : g))), stone); s.name = 'The pilgrims’ cairns';
  const l = new THREE.Mesh(mergeGeometries(lamps), clay); l.userData.noCollide = true;
  group.add(s, l);
  scene.add(group);
  const rest = { at: at(0, 0, 0.9), look: at(0, 0.7, 0), seat: at(0, 0.71, 0), heading: face };
  const clear = [...cairns.map((c) => ({ x: c.at.x, z: c.at.z, r: 1.6 })), { x: REST.x, z: REST.z, r: 3.2 }, { x: stake.x, z: stake.z, r: 0.8 }];
  return {
    group, cairns, rest, clear,
    /** The road as a line, [x, y, z] from the gate down to the landing (the level design audit follows it home). */
    points: cairns.map((c) => [c.at.x, c.at.y, c.at.z]),
    /** Nothing grows on a cairn or the resting stone. */
    avoid: (x, z, r = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r),
  };
}
