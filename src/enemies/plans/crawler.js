import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, many, skinBy, pivot, ease, finish } from './kit.js';
import { gazePart } from '../gaze.js';
import { droidMaterials, droidGlow, lathe, lensParts } from './droid.js';

// The crawler (issue #726, docs/design/enemy-roster-v4.md; its sheet: a new `crawler/` folder under the enemy references,
// sheet-1): the makers' defunct scout. A knee-high dome of the droids' weathered ivory ceramic, cut into panels by amber
// seams, one big amber eye in a dark socket at its front, a thin antenna; under the dome a dark band and four jointed
// legs: dark thighs rising to the knee, ivory sickle shins down to a point. It walks on the locomotion kit (plan
// `crawler`, src/motion-kit/plans.js), a quick trot on diagonal pairs.
//
// What the body says (nothing on the ground):
//   bite     sunk back on its hind legs, the eye tipped up at you; then it springs in
//   call     reared up on its hind pair, the front legs raised, the eye flashing white and the antenna sparking: every
//            sleeping droid near it wakes
//   blast    (low health, fight.low 'last') its fuse: squatting braced and shaking, the seams and the eye blinking red,
//            faster and faster, as it scuttles at you; then it bursts (roll out of it)

/** Its size (m): the dome's centre over the ground, its radius; the dome's top is knee-high. */
export const CRAWLER_SIZE = { centre: 0.34, r: 0.29, top: 0.63 };
const R = CRAWLER_SIZE.r;

export function crawlerModel(skin) {
  const P = skin.palette, M = materials('crawler', skin);
  const g = new THREE.Group(); g.name = skin.name;
  const body = pivot(g, 0, 0, 0, 'body');
  const shell = pivot(body, 0, CRAWLER_SIZE.centre, 0, 'shell');
  const X = droidMaterials(M, P), C = X.ceramicB, K = X.jointB, S = X.seamB, Mo = X.mossB;
  // ---- the dome: three quarters of a ball over a dark band, its lower rim flaring a little
  const DOME = Array.from({ length: 14 }, (_, i) => { const a = -0.42 + (i / 13) * (Math.PI / 2 + 0.42); return [Math.cos(a) * R, Math.sin(a) * R]; });
  const dome = add(shell, lathe([[R * 0.86, -0.13], [R * 0.93, -0.115], ...DOME.slice(1)], 26, 1), C);
  add(shell, lathe([[R * 0.7, -0.17], [R * 0.86, -0.14], [R * 0.86, -0.1], [R * 0.6, -0.095], [0.001, -0.1]], 20), K);   // (the dark band under it)
  add(shell, lathe([[0.001, -0.22], [R * 0.5, -0.2], [R * 0.72, -0.16]], 16), K);                                          // (its belly)
  // (the seams: a ring round its middle, and lines from the eye up over the dome and down the sides into panels)
  const arc = (a0, a1, el, n = 10) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * (i / (n - 1)); return [Math.sin(a) * Math.cos(el) * (R + 0.003), Math.sin(el) * (R + 0.003), Math.cos(a) * Math.cos(el) * (R + 0.003)]; });
  const meridian = (az, e0, e1, n = 9) => Array.from({ length: n }, (_, i) => { const e = e0 + (e1 - e0) * (i / (n - 1)); return [Math.sin(az) * Math.cos(e) * (R + 0.003), Math.sin(e) * (R + 0.003), Math.cos(az) * Math.cos(e) * (R + 0.003)]; });
  const lines = [arc(0.35, Math.PI * 2 - 0.35, 0.0, 30), meridian(0, 0.38, 1.25), meridian(0.75, 0.05, 1.0), meridian(-0.75, 0.05, 1.0), meridian(Math.PI * 0.62, 0.1, 0.9), meridian(-Math.PI * 0.62, 0.1, 0.9), arc(-0.75, 0.75, 1.0, 8), arc(0.35, -0.35, -0.12, 6)];
  const seams = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), UPV = new THREE.Vector3(0, 1, 0);
  for (const pts of lines) for (let i = 0; i < pts.length - 1; i++) { const A = new THREE.Vector3(...pts[i]), B = new THREE.Vector3(...pts[i + 1]), d = B.clone().sub(A); seams.push(new THREE.CylinderGeometry(0.006, 0.006, d.length() + 0.004, 4).applyMatrix4(_m.compose(A.clone().add(B).multiplyScalar(0.5), _q.setFromUnitVectors(UPV, d.normalize()), new THREE.Vector3(1, 1, 1)))); }
  many(shell, seams, S);
  // (two raised vent panels on its back, as the sheet's rear view)
  many(shell, [-1, 1].map((s) => new THREE.BoxGeometry(0.11, 0.08, 0.03).translate(0, 0, R).rotateX(-0.12).rotateY(Math.PI + s * 0.55)), C);
  // ---- the eye: big, amber, in a dark socket at the front
  const lens = lensParts(0.072);
  // (the socket and the pupil turn with the glass: the eyes look at you, src/enemies/gaze.js)
  const eyes = new THREE.Group(); shell.add(eyes); eyes.name = 'eyes'; eyes.position.set(0, 0.02, R - 0.04);
  add(eyes, lens.socket, K, 0, 0, 0.028);
  add(eyes, lens.glass, X.eye, 0, 0, 0.034);
  add(eyes, new THREE.CircleGeometry(0.026, 14), K, 0, 0, 0.077);   // (its dark pupil, as the sheet's)
  // ---- the antenna, a little back of the crown, and its tip
  const antenna = pivot(shell, -0.03, R * 0.92, -0.05, 'antenna');
  many(antenna, [new THREE.CylinderGeometry(0.02, 0.026, 0.03, 8).translate(0, 0.01, 0), new THREE.CylinderGeometry(0.006, 0.008, 0.26, 5).translate(0, 0.15, 0), new THREE.SphereGeometry(0.014, 6, 5).translate(0, 0.28, 0)], K);
  // (a little moss in the lip of its rim)
  many(shell, [new THREE.SphereGeometry(0.03, 6, 5).scale(1.6, 0.5, 1).translate(R * 0.8, -0.11, R * 0.4), new THREE.SphereGeometry(0.025, 6, 5).scale(1.4, 0.5, 1).translate(-R * 0.7, -0.115, -R * 0.5)], Mo);
  // ---- four legs at its corners: a dark hip and thigh rising to the knee, an ivory sickle shin to a point
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = planLeg(PLANS.crawler, { group: g, body, hipParent: shell, hip: { x: sx * R * 0.62, y: -0.14, z: sz * R * 0.6 }, foot: { x: sx * 0.38, z: sz * 0.34 }, pole: { x: sx * 0.8, y: 0.7, z: sz * 0.5 }, radius: 0.019, pad: 'point', bow: { thigh: 0.02, shin: 0.16 }, mats: { joint: K, thigh: K, shin: C, foot: C }, name: `crawler leg ${legs.length}` });
    // (the sheet's ivory sickle over the shin: broad at the knee, tapering to the point)
    add(leg.shin, new THREE.CylinderGeometry(0.011, 0.04, leg.lenB * 0.96, 8).scale(1, 1, 0.7).translate(0, leg.lenB * 0.5, 0), C);
    add(leg.thigh, new THREE.SphereGeometry(0.032, 8, 6), K);
    legs.push(leg);
  }
  const rig = new Rig({ plan: PLANS.crawler, group: g, body, legs });
  const gaze = [gazePart(g, eyes, { mode: 'turn' })];
  skinBy(g, X.sets);
  finish(g);
  eyes.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  const parts = [dome, eyes, antenna, ...legs.map((l) => l.root)];
  const st = { glow: 0 };
  let rear = 0, fuse = 0, blink = 0;
  return {
    group: g, gaze, body: shell, rig, parts, eyeMat: X.eye, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.ceramic, P.seam, P.joint],
    height: CRAWLER_SIZE.top,
    tell: (id) => (id === 'call' ? antenna : eyes),
    anim(f, c) {
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind';
      // the call: up on its hind pair, the front legs raised and pawing
      rear = ease(rear, id === 'call' && wind ? c.wind : 0, 12, dt);
      for (const i of [0, 1]) { legs[i].lift = rear > 0.3 ? 1 : 0; legs[i].air.set(0, 0.22 + Math.sin(c.now / 60 + i * 2) * 0.04 * rear, 0.12); }
      // the fuse: its blinking quickens through the wind-up (and is on a moment before, as the last move is planned)
      fuse = id === 'blast' && wind ? f.k : 0;
      blink += dt * (2 + fuse * fuse * 22);
      const on = fuse > 0 && Math.sin(blink * Math.PI * 2) > 0;
      const shake = fuse > 0 ? Math.sin(c.now / 18) * 0.03 * (0.3 + fuse) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery });
      shell.position.set(o.x + shake, CRAWLER_SIZE.centre + o.y, o.z);
      shell.rotation.set(o.pitch, o.yaw, o.roll + shake * 2);
      antenna.rotation.set(Math.sin(c.now / 120 + f.home.x) * 0.15 - rear * 0.4, 0, Math.sin(c.now / 170) * 0.1);
      rig.write();
      droidGlow(f, X, P, st, dt, { call: id === 'call' && wind ? (Math.sin(c.now / 50) > 0 ? rear : 0) : 0 });
      if (fuse > 0) {
        X.eye.uniforms.uColor.value.set(on ? '#ff3a24' : P.eye); X.eye.uniforms.uGlow.value = on ? 1 : 0.6;
        X.seam.uniforms.uColor.value.set(on ? '#ff4a2e' : P.seam); X.seam.uniforms.uGlow.value = on ? 1 : 0.5;
        if (c.spray && Math.random() < dt * 8 * fuse) c.spray(antenna.getWorldPosition(new THREE.Vector3()), ['#ffd27a', '#ff6a3a'], 2, 1.2, -1);
      } else X.seam.uniforms.uColor.value.set(P.seam);
    },
    dispose: M.dispose,
  };
}
