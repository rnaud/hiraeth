// The traveller's arm in the Lens Vault (issue #382): the fluid glove seen from his own eyes, made a cannon. His coral
// sleeve, the lavender band, the dark leather glove round a brass barrel, the glass vial of the tank's fluid along its
// top, the three knuckle studs lit at the mouth, a ball of fluid swelling there as the charge fills. Drawn in the
// world (the post pass inks it as everything else), placed in front of the camera each frame, a little low and right,
// turned in toward the reticle 20 m out; it sways with the view's bob and kicks back at each shot.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { TRAVELLER_PALETTE as PAL } from '../traveller-style.js';

/** Where the arm sits in the camera's frame (m: x right, y up, z back; the near plane is 0.3 m out). */
export const ARM = { at: [0.27, -0.27, -0.66], aim: 20, kick: 0.07, sway: 0.6 };
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

/** The arm's meshes, along -z from the elbow (z 0.3) to the mouth (z -0.42), in its own frame. */
export function armModel() {
  const g = new THREE.Group(); g.name = 'lens arm';
  const mat = (color, o = {}) => makeMaterial({ color, flat: true, ...o, key: `lensvault.arm.${color}` });
  const sleeve = mat(PAL.jacket), shade = mat(PAL.jacketShade), band = mat(PAL.lavender), glove = mat(PAL.glove), brass = mat(PAL.fitting, { metal: 'brass' });
  const lit = makeMaterial({ color: PAL.gloveLight, flat: true, glow: 0.85, key: 'lensvault.arm.lit' });
  const along = (geo, z) => geo.rotateX(Math.PI / 2).translate(0, 0, z);
  const add = (geo, m, y = 0, x = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, 0); g.add(o); return o; };
  add(along(new THREE.CylinderGeometry(0.098, 0.108, 0.3, 14), 0.1), sleeve);          // the sleeve
  // (the elbow bent down and out, so the sleeve leaves the picture by its bottom edge, not toward the lens)
  const elbow = new THREE.Vector3(0, 0, 0.25), shoulder = new THREE.Vector3(0.1, -0.42, 0.42);
  add(new THREE.SphereGeometry(0.108, 14, 10).translate(0, 0, 0.25), sleeve);
  const up = new THREE.CylinderGeometry(0.12, 0.108, elbow.distanceTo(shoulder), 14).translate(0, elbow.distanceTo(shoulder) / 2, 0);
  up.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), shoulder.clone().sub(elbow).normalize())).translate(elbow.x, elbow.y, elbow.z);
  add(up, shade);
  add(along(new THREE.CylinderGeometry(0.118, 0.118, 0.06, 14), -0.06), shade);         // its cuff
  add(along(new THREE.CylinderGeometry(0.122, 0.122, 0.035, 14), -0.105), band);        // the lavender band
  add(along(new THREE.CylinderGeometry(0.118, 0.13, 0.26, 14), -0.24), glove);           // the glove round the barrel
  for (const z of [-0.16, -0.3]) add(along(new THREE.CylinderGeometry(0.138, 0.138, 0.035, 14), z), brass);   // brass hoops
  add(along(new THREE.CylinderGeometry(0.085, 0.108, 0.1, 14), -0.41), brass);           // the mouth's brass collar
  const mouth = add(new THREE.CircleGeometry(0.07, 16).translate(0, 0, -0.462), lit);  // the fluid in the mouth
  // the vial of the tank's fluid along the top, in a brass cradle
  add(along(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), -0.22), lit, 0.145);
  for (const z of [-0.12, -0.32]) add(along(new THREE.CylinderGeometry(0.042, 0.042, 0.025, 10), z), brass, 0.145);
  // the three knuckle studs round the mouth (lit as the charge fills)
  const studs = [-0.6, 0, 0.6].map((a) => { const o = add(new THREE.BoxGeometry(0.03, 0.03, 0.03).translate(0, 0, -0.39), lit); o.position.set(Math.sin(a) * 0.1, Math.cos(a) * 0.1, 0); return o; });
  // the charge: a ball of fluid at the mouth, swelling
  const ballMats = [makeMaterial({ color: '#72d5bf', flat: true, glow: 0.8, key: 'lensvault.arm.ball' }), makeMaterial({ color: '#f2c54b', flat: true, glow: 0.9, key: 'lensvault.arm.ballFull' })];
  const ball = add(new THREE.SphereGeometry(1, 14, 10), ballMats[0]);
  ball.position.set(0, 0, -0.5); ball.scale.setScalar(0.001); ball.visible = false;
  g.traverse((o) => { o.userData.noCollide = true; o.castShadow = false; o.frustumCulled = false; });
  return Object.assign(g, { ball, ballMats, studs, mouth, kickK: 0 });
}

/**
 * The arm placed in front of the camera: `bob` the view's bob ({ x, y }), `charge` 0..1, `t` the clock (the charge's
 * shimmer), `visor` 'lens' (the arm lowered a little while the lens reads). The mouth's point in the world into `out`.
 */
export function placeArm(arm, camera, { bob = { x: 0, y: 0 }, charge = 0, t = 0, visor = 'arm', dt = 0 } = {}, out = null) {
  arm.kickK = Math.max(0, arm.kickK - dt * 9);
  arm.lowK = THREE.MathUtils.damp(arm.lowK ?? 0, visor === 'lens' ? 1 : 0, 8, dt);
  const [ax, ay, az] = ARM.at;
  _v.set(ax + bob.x * ARM.sway, ay + bob.y * ARM.sway - 0.05 * arm.lowK, az + ARM.kick * arm.kickK);
  arm.position.copy(_v).applyQuaternion(camera.quaternion).add(camera.position);
  // turned in toward the reticle ARM.aim m out: its -z along the line from it to there
  _w.set(0, 0, -ARM.aim).applyQuaternion(camera.quaternion).add(camera.position).sub(arm.position).normalize();
  _m.lookAt(_v.set(0, 0, 0), _w, _up.set(0, 1, 0).applyQuaternion(camera.quaternion));
  arm.quaternion.setFromRotationMatrix(_m);
  arm.rotateX(-0.06 * arm.lowK + 0.05 * arm.kickK);
  const k = Math.max(0, Math.min(1, charge));
  arm.ball.visible = k > 0.02;
  arm.ball.scale.setScalar(0.02 + 0.06 * k + (k >= 1 ? 0.008 * Math.sin(t * 30) : 0));
  arm.ball.material = arm.ballMats[k >= 1 ? 1 : 0];
  for (const [i, s] of arm.studs.entries()) s.scale.setScalar(k > (i + 1) / 4 ? 1.25 : 1);
  arm.updateMatrixWorld(true);
  if (out) out.set(0, 0, -0.5).applyMatrix4(arm.matrixWorld);
  return out;
}
/** A shot's kick: the arm thrown back, more for a charged one. */
export const kickArm = (arm, k = 1) => { arm.kickK = Math.min(1.6, k); };
