import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// The Signal Market's way home (level design audit, fourth round: the walk back from Madame Sel to the ship was the
// avenue you came up). The listeners' lane: the back lane behind the west towers, reached by the alley behind Sel's
// square and left by the alley by the lantern market, where the market's old listeners put up their dishes, every one
// of them turned to the silent tower and kept turned to it for thirty years. Halfway, the radio-mender's table. Sel
// sends you home that way once the tower speaks again. No rng: the street's layout stays as it was.
//
//   buildListenersLane(scene) → { points, stall }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** The way, [x, z]: from Sel's square west down the alley, north up the back lane, east down the alley by the market. */
export const LANE = [[-12, -231.5], [-40, -231.5], [-83, -231.5], [-83, -160], [-83, -90], [-83, -20], [-83, 50], [-83, 79.5], [-40, 79.5], [-12, 82]];
/** The silent tower the dishes face (src/levels/bazaar.js SIGNAL), and the radio-mender's table. */
const TOWER = { x: 0, y: 70, z: -255 };
export const STALL = { x: -80.6, z: -58 };

export function buildListenersLane(scene) {
  const iron = makeMaterial({ color: '#465c65', flat: true, metal: 'painted' });
  const cream = makeMaterial({ color: '#f5dfab', flat: true });
  const coral = makeMaterial({ color: '#f0a083', flat: true });
  const wood = makeMaterial({ color: '#a07a58', flat: true });
  const glow = makeMaterial({ color: '#fff0bd', glow: 0.75 });
  const poles = [], dishes = [], stall = [], dials = [];
  // dishes on poles against the lane's west side every 26 m, and two in each alley
  const spots = [];
  for (let z = -222; z <= 70; z += 26) spots.push([-85.6, z]);
  spots.push([-62, -232.8], [-44, -232.8], [-66, 81], [-50, 81]);
  spots.forEach(([x, z], i) => {
    const h = 3.2 + (i % 3) * 0.6;
    poles.push(nonIdx(new THREE.CylinderGeometry(0.07, 0.09, h, 6).translate(x, h / 2, z)));
    // the dish: a shallow bowl on a yoke, its face to the tower, and the little receiver on its arm
    const dir = V(TOWER.x - x, TOWER.y - h, TOWER.z - z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
    const m = new THREE.Matrix4().compose(V(x, h + 0.25, z), q, V(1, 1, 1));
    const r = 0.75 + (i % 2) * 0.2;
    dishes.push(nonIdx(new THREE.SphereGeometry(r, 12, 4, 0, Math.PI * 2, 0, 0.75).translate(0, -r * Math.cos(0.75), 0)).applyMatrix4(m));
    dishes.push(nonIdx(new THREE.CylinderGeometry(0.025, 0.025, r * 0.9, 4).translate(0, r * 0.45, 0)).applyMatrix4(m));
    dials.push(nonIdx(new THREE.SphereGeometry(0.07, 6, 4).translate(0, r * 0.92, 0)).applyMatrix4(m));
  });
  // the radio-mender's table: trestles, a board, three radios, a lamp; a stool
  {
    const { x, z } = STALL;
    stall.push(nonIdx(new THREE.BoxGeometry(1.0, 0.08, 2.4).translate(x, 0.92, z)));
    for (const dz of [-1, 1]) for (const dx of [-1, 1]) stall.push(nonIdx(new THREE.BoxGeometry(0.06, 0.92, 0.06).translate(x + dx * 0.42, 0.46, z + dz * 1.1)));
    stall.push(nonIdx(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 8).translate(x + 1.1, 0.5, z + 0.4)), nonIdx(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4).translate(x + 1.1, 0.25, z + 0.4)));
    for (const [dz, w, hh] of [[-0.75, 0.55, 0.4], [0.05, 0.7, 0.34], [0.8, 0.45, 0.5]]) {
      dials.push(nonIdx(new THREE.BoxGeometry(0.36, hh, w).translate(x, 0.96 + hh / 2, z + dz)));
      dishes.push(nonIdx(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8).rotateZ(Math.PI / 2).translate(x + 0.19, 0.96 + hh * 0.55, z + dz)));
    }
    stall.push(nonIdx(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4).translate(x - 0.2, 1.26, z - 1.05)), nonIdx(new THREE.ConeGeometry(0.16, 0.16, 8, 1, true).translate(x - 0.2, 1.58, z - 1.05)));
  }
  const g = new THREE.Group();
  g.name = 'The listeners’ lane';
  // the poles and the table collide as drawn; the dishes, the radios and the lamp on them are drawn only (within a hand
  // of what holds them)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).translate(STALL.x - 0.2, 1.48, STALL.z - 1.05), glow);
  const parts = [new THREE.Mesh(mergeGeometries(poles), iron), new THREE.Mesh(mergeGeometries(stall), wood)];
  const drawn = [new THREE.Mesh(mergeGeometries(dishes), cream), new THREE.Mesh(mergeGeometries(dials), coral), lamp];
  for (const m of drawn) m.userData.noCollide = true;
  g.add(...parts, ...drawn);
  scene.add(g);
  return { points: LANE.map(([x, z]) => [x, 0.5, z]), stall: V(STALL.x, 0.9, STALL.z) };
}
