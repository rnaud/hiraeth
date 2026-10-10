import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../../../materials.js';

// The Sealed Hangar's upside-down quarter, its far edge (level design audit, fourth round: the walk to the Major's
// desk could not see where it went, and the walk back from it to the portal home passed nothing new). Built in the
// slab's own upright frame (src/levels/garage.js flips the group after: to us they hang from the slab). No rng.
//
//   the Major's mast       a tall signal mast over his old desk, a red flag on it and a lamp at its tip: he flew it
//                          when he still came out here, and nobody took it down. It shows over the quarter's houses.
//   the Major's telescope  on its tripod halfway back to the portal, still trained on the portal's light: where he
//                          sat and watched his people come and go.
//
//   buildHangarWays(group, { mast, scope, look }) → { mastH }   (slab-local spots; `look` is where the telescope points)

export function buildHangarWays(grp, { mast, scope, look }) {
  const H = 26;
  const pole = makeMaterial({ color: '#f3ead8', flat: true, metal: 'painted' });
  const red = makeMaterial({ color: '#c8473a', flat: true, side: THREE.DoubleSide });
  const brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' });
  const ink = makeMaterial({ color: '#34405e', flat: true, metal: 'iron' });
  const lamp = makeMaterial({ color: '#d8aa50', glow: 0.9 });
  // the mast: a tapering pole on a stepped stone foot, a yard near the top, the flag off the yard, the lamp on the tip
  const m = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(0.22, 0.4, H, 8).translate(0, H / 2, 0),
    new THREE.CylinderGeometry(1.4, 1.6, 0.8, 10).translate(0, 0.4, 0),
    new THREE.CylinderGeometry(0.08, 0.08, 4, 5).rotateZ(Math.PI / 2).translate(0, H - 2.5, 0),
  ].map((g) => g.toNonIndexed())), pole);
  m.position.copy(mast); m.name = 'The Major’s mast';
  grp.add(m);
  const flagGeo = new THREE.PlaneGeometry(5, 3, 10, 1).translate(2.6, 0, 0);
  { const p = flagGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.1) * 0.35); flagGeo.computeVertexNormals(); }
  const flag = new THREE.Mesh(flagGeo, red);
  flag.position.set(mast.x, H - 4.3, mast.z); flag.rotation.y = 0.6; flag.userData.noCollide = true;
  grp.add(flag);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lamp);
  tip.position.set(mast.x, H + 0.4, mast.z); tip.userData.noCollide = true;
  grp.add(tip);
  // the telescope: three legs, a brass tube on a yoke, a little stool beside it
  const dir = new THREE.Vector3(look.x - scope.x, 0, look.z - scope.z).normalize(), yaw = Math.atan2(dir.x, dir.z);
  const legs = [0, 1, 2].map((k) => { const a = k * Math.PI * 2 / 3; return new THREE.CylinderGeometry(0.05, 0.06, 1.6, 5).translate(0, 0.8, 0).rotateZ(0.32).rotateY(a).translate(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25).toNonIndexed(); });
  const tube = new THREE.CylinderGeometry(0.16, 0.12, 1.8, 10).rotateX(Math.PI / 2 - 0.12).translate(0, 1.6, 0.2).toNonIndexed();
  const scopeMesh = new THREE.Mesh(mergeGeometries(legs), ink);
  const tubeMesh = new THREE.Mesh(tube, brass);
  const stool = new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10).translate(0, 0.55, 0), ...[0, 1, 2].map((k) => new THREE.CylinderGeometry(0.03, 0.03, 0.55, 4).translate(Math.cos(k * 2.1) * 0.2, 0.27, Math.sin(k * 2.1) * 0.2))].map((g) => g.toNonIndexed())), ink);
  stool.position.set(-0.9, 0, -0.6);
  const s = new THREE.Group();
  s.add(scopeMesh, tubeMesh, stool);
  s.position.copy(scope); s.rotation.y = yaw; s.name = 'The Major’s telescope';
  s.traverse((o) => { o.userData.noCollide = true; });   // (small things you walk round, drawn only)
  grp.add(s);
  return { mastH: H };
}
