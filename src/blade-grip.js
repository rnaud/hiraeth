import * as THREE from 'three';

// Where the blade and the shield sit on the traveller's hands (src/fluid-blade.js).
//
// The hilt is carried by the right hand's bone and the shield's bracer by the left's: children of
// the bones, so they are wherever the hand is drawn, after every layer of the frame's pose (the
// clips, motion matching, the combat moves, the aim and the feet's IK, a scene's overlay), with no
// frame of lag. Where in the hand is worked out once per body from its own fingers, so every body
// (the coral-shirt traveller, the suited fallback, any other on the same skeleton) holds them the
// same way, whatever its bones' axes:
//
//   - the grip: each finger, curled into the fist (HAND_POSES.fist), wraps round the grip, so the
//     circle through its three joints is centred on the grip's axis. The line through the four
//     centres (the little finger's to the index's) is the grip, and the blade leaves the fist on the
//     index's side. The edge faces the way the fingers point out of the palm (the knuckles' way, as
//     a sword is held), its flat to the palm's side.
//   - the bracer: on the back of the left hand, over the middle of its bones, its face out.
//
//   fistGrip(humanoid)       { bone, position, quaternion } for the hilt (+y up the blade, +x the edge)
//   bracerMount(humanoid)    { bone, position, quaternion } for the bracer (+z out of the back of the hand, +y to the fingers)
//   carry(object, mount)     parent `object` to the mount's bone, there (and at world size each frame: fitScale)

export const GRIP = {
  pommel: 0.07,      // m from the grip's middle (the fingers' centre) down to the pommel's end of the wrapped grip
  fingers: ['index', 'middle', 'ring', 'pinky'],
};
export const BRACER = {
  along: 0.45,       // share of the way from the wrist to the knuckles
  lift: 0.028,       // m off the hand's bone line, out of its back (half the hand's thickness)
};

/** The centre of the circle through three points, or null if they are (nearly) in a line. */
export function circumcentre(a, b, c, out = new THREE.Vector3()) {
  const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a);
  const n = new THREE.Vector3().crossVectors(ab, ac), nn = n.lengthSq();
  if (nn < 1e-12) return null;
  // a + ((|ac|² (n × ab)) + (|ab|² (ac × n))) / (2 |n|²)
  const t1 = new THREE.Vector3().crossVectors(n, ab).multiplyScalar(ac.lengthSq());
  const t2 = new THREE.Vector3().crossVectors(ac, n).multiplyScalar(ab.lengthSq());
  return out.copy(a).add(t1.add(t2).divideScalar(2 * nn));
}

/**
 * The grip's line from the four fingers' joints (hand frame, the fist): { centre, axis, centres, radii }.
 * joints: { index: [p1, p2, p3], ... } knuckle first. Null if fewer than two fingers make a circle.
 */
export function gripLine(joints) {
  const centres = [], radii = [];
  for (const f of GRIP.fingers) {
    const j = joints[f];
    if (!j || j.length < 3) continue;
    const c = circumcentre(j[0], j[1], j[2]);
    if (!c) continue;
    const r = c.distanceTo(j[0]);
    if (r > 0.08) continue;   // (a finger near straight: its circle says nothing)
    centres.push({ f, c }); radii.push(r);
  }
  if (centres.length < 2) return null;
  const centre = new THREE.Vector3();
  for (const { c } of centres) centre.add(c);
  centre.divideScalar(centres.length);
  // index side minus little-finger side: a least-squares line would do no better with four points
  const order = GRIP.fingers, first = centres[0], last = centres[centres.length - 1];
  const axis = new THREE.Vector3().subVectors(first.c, last.c);
  if (order.indexOf(first.f) > order.indexOf(last.f)) axis.negate();
  return { centre, axis: axis.normalize(), centres: centres.map((x) => x.c), radii };
}

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
const local = (bone, inv, out = new THREE.Vector3()) => out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inv);

/** Run `fn` with the hand's fingers in the pose `id` (src/hands.js), then put them back. */
function withPose(humanoid, id, fn) {
  const H = humanoid.hands;
  const saved = H?.sides?.map((S) => [S.cur.slice(), S.goal.slice(), S.lag, S.lagV]);
  try { H?.set(id); return fn(); } finally {
    if (H && saved) { H.sides.forEach((S, i) => { S.cur.set(saved[i][0]); S.goal.set(saved[i][1]); S.lag = saved[i][2]; S.lagV = saved[i][3]; }); H.apply(); }
  }
}

/** The hand's axes in its bone's frame: along (wrist to the middle knuckle), palm (the way the fingers curl). */
function handAxes(B, s, inv) {
  const hand = B[`hand_${s}`], o = local(hand, inv);
  const mk = B[`middle_01_${s}`] ? local(B[`middle_01_${s}`], inv) : new THREE.Vector3(0, 0.09, 0);
  const along = mk.clone().sub(o), len = along.length();
  along.normalize();
  const palm = new THREE.Vector3();
  for (const f of GRIP.fingers) {
    const a = B[`${f}_01_${s}`], b = B[`${f}_02_${s}`];
    if (a && b) palm.add(local(b, inv)).sub(local(a, inv));
  }
  palm.addScaledVector(along, -palm.dot(along));
  if (palm.lengthSq() < 1e-10) palm.set(1, 0, 0).addScaledVector(along, -along.x);
  return { o, along, palm: palm.normalize(), len, knuckle: mk };
}

/**
 * Where the hilt sits in the right fist (hand bone frame): the fingers' grip line, the hilt's grip
 * centred on it, the blade out on the index's side, the edge the fingers' way.
 */
export function fistGrip(humanoid, s = 'r') {
  const B = humanoid?.b, hand = B?.[`hand_${s}`];
  if (!hand) return null;
  return withPose(humanoid, 'fist', () => {
    hand.updateMatrixWorld(true);
    const inv = _m.copy(hand.matrixWorld).invert();
    const joints = {};
    for (const f of GRIP.fingers) {
      const js = [1, 2, 3].map((j) => B[`${f}_0${j}_${s}`]).filter(Boolean);
      if (js.length === 3) joints[f] = js.map((b) => local(b, inv));
    }
    const { along, palm, len } = handAxes(B, s, inv);
    let line = gripLine(joints);
    // (no fingers to read: across the palm under the knuckles, as most fists hold)
    if (!line) {
      const across = new THREE.Vector3().crossVectors(palm, along).normalize();
      line = { centre: along.clone().multiplyScalar(len * 0.9).addScaledVector(palm, 0.03), axis: across, radii: [] };
    }
    const y = line.axis, x = along.clone().addScaledVector(y, -along.dot(y)).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return { bone: hand, position: line.centre.clone(), quaternion, axis: y.clone(), edge: x.clone(), radius: line.radii.length ? line.radii.reduce((a, b) => a + b) / line.radii.length : 0.03, palm };
  });
}

/** Where the shield's bracer sits on the back of the left hand (hand bone frame): +z out of the back, +y toward the fingers. */
export function bracerMount(humanoid, s = 'l') {
  const B = humanoid?.b, hand = B?.[`hand_${s}`];
  if (!hand) return null;
  return withPose(humanoid, 'fist', () => {
    hand.updateMatrixWorld(true);
    const inv = _m.copy(hand.matrixWorld).invert();
    const { o, along, palm, len } = handAxes(B, s, inv);
    const out = palm.clone().negate();
    const position = o.clone().addScaledVector(along, len * BRACER.along).addScaledVector(out, BRACER.lift);
    const x = new THREE.Vector3().crossVectors(along, out).normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, along, out));
    return { bone: hand, position, quaternion, along: along.clone(), out };
  });
}

/** Parent `object` to `mount.bone` where the mount says, at world size (fitScale). */
export function carry(object, mount) {
  if (!mount?.bone) return false;
  if (object.parent !== mount.bone) mount.bone.add(object);
  object.position.copy(mount.position);
  object.quaternion.copy(mount.quaternion);
  fitScale(object);
  return true;
}

/** Undo the bone's world scale on a carried object (a taller body's hand holds the same sword). */
export function fitScale(object, k = 1) {
  const p = object.parent;
  if (!p) return;
  p.matrixWorld.decompose(_v, _q, _s);
  object.scale.set(k / (_s.x || 1), k / (_s.y || 1), k / (_s.z || 1));
}
