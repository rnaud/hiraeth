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
//   - the bracer (bracerMount): on the back of the left hand, over the middle of its bones, its face out; the shield's
//     own (forearmMount) is strapped round the left forearm, near the wrist (issue #284).
//
//   fistGrip(humanoid)       { bone, position, quaternion } for the hilt (+y up the blade, +x the edge)
//   bracerMount(humanoid)    { bone, position, quaternion } on the back of the hand (+z out of its back, +y to the fingers)
//   forearmMount(humanoid)   the shield's bracer strapped round the left forearm (+z out, +y to the hand), turning with
//                            the hand (forearmFrame each frame; issue #284)
//   forearmWrap(humanoid, mount)   where the strap lies on the forearm's skin (issue #303): points of the skin itself,
//                            found once on the body as it was bound, round the forearm at the strap's edges
//   wrapFrame(wrap)          those points this frame (the skin as the bones have it now, in the forearm bone's frame)
//   wrapLift(wrap, mount)    how far the skin stands off the bone line the strap's outside way this frame
//   carry(object, mount)     parent `object` to the mount's bone, there (and at world size each frame: fitScale)

export const GRIP = {
  pommel: 0.082,     // m from the grip's middle (the fingers' centre) down to the pommel's end of the wrapped grip (src/fluid-sword.js HILT.grip)
  fingers: ['index', 'middle', 'ring', 'pinky'],
};
export const BRACER = {
  along: 0.45,       // share of the way from the wrist to the knuckles
  lift: 0.028,       // m off the hand's bone line, out of its back (half the hand's thickness)
};
export const FOREARM = {
  along: 0.66,       // share of the way from the elbow to the wrist the shield's bracer is strapped (issue #284)
  lift: 0.042,       // m off the forearm's bone line, out of its back, before the skin is read (forearmWrap: then the skin's own)
};
export const STRAP = {
  // the leather's rows (m along the forearm from the bracer's middle, + toward the hand): the wide strap under the
  // plate (its two edges and its middle, where the forearm bulges) and the narrow one nearer the elbow
  bands: [[-0.025, 0, 0.025], [-0.07, -0.046]],
  sectors: 24,       // points round the forearm a row
  leather: 0.003,    // m thick
  plate: 0.004,      // m from the strap's face up to the bracer's origin (the brass plate's underside)
  reach: 0.12,       // m off the bone line a skin point may be (the arm's own, never the chest's beside it)
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

/**
 * Where the shield's bracer is strapped (issue #284): round the left forearm, FOREARM.along of the way from the elbow
 * to the wrist, on its outside (the back of the hand's side), in the forearm bone's frame: +y along the forearm toward
 * the hand, +z out of it. `outHand` is the back of the hand's way in the hand bone's frame: the strap turns with the
 * hand as a forearm does near the wrist (forearmFrame, each frame), where the forearm bone itself does not roll.
 */
export function forearmMount(humanoid, s = 'l') {
  const B = humanoid?.b, arm = B?.[`lowerarm_${s}`], hand = B?.[`hand_${s}`];
  if (!arm || !hand) return null;
  return withPose(humanoid, 'fist', () => {
    hand.updateMatrixWorld(true);
    const hinv = new THREE.Matrix4().copy(hand.matrixWorld).invert();
    const { palm } = handAxes(B, s, hinv);
    const outHand = palm.clone().negate();
    const inv = _m.copy(arm.matrixWorld).invert();
    const wrist = local(hand, inv), len = wrist.length(), along = wrist.clone().normalize();
    const mount = { bone: arm, hand, along, len, outHand, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), out: new THREE.Vector3() };
    forearmFrame(mount);
    return mount;
  });
}

const _o = new THREE.Vector3(), _x = new THREE.Vector3(), _mb = new THREE.Matrix4(), _mi = new THREE.Matrix4();
/**
 * The bracer's place on the forearm this frame (forearmMount's mount, written in place: position, quaternion, out, in
 * the forearm bone's frame): its outside the back of the hand's way as the hand is turned now, square to the forearm.
 */
export function forearmFrame(mount) {
  const { bone, hand, along, len, outHand } = mount;
  bone.updateWorldMatrix(true, false); hand.updateWorldMatrix(false, false);
  _mi.copy(bone.matrixWorld).invert();
  const o = _o.copy(outHand).transformDirection(hand.matrixWorld).transformDirection(_mi);
  o.addScaledVector(along, -o.dot(along));
  if (o.lengthSq() < 1e-8) return mount;   // (the hand bent straight along it: keep the last)
  o.normalize();
  mount.out.copy(o);
  mount.position.copy(along).multiplyScalar(len * FOREARM.along).addScaledVector(o, FOREARM.lift);
  const x = _x.crossVectors(along, o).normalize();
  mount.quaternion.setFromRotationMatrix(_mb.makeBasis(x, along, o));
  return mount;
}

const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _pv = new THREE.Vector3(), _tv = new THREE.Vector3(), _qv = new THREE.Vector3(),
  _dir = new THREE.Vector3(), _org = new THREE.Vector3();
/** Möller–Trumbore: the ray's distance to the triangle and its barycentric weights, or null. */
function rayTriangle(o, d, a, b, c) {
  _e1.subVectors(b, a); _e2.subVectors(c, a); _pv.crossVectors(d, _e2);
  const det = _e1.dot(_pv);
  if (Math.abs(det) < 1e-14) return null;
  const inv = 1 / det; _tv.subVectors(o, a);
  const u = _tv.dot(_pv) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  _qv.crossVectors(_tv, _e1);
  const v = d.dot(_qv) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  return { t: _e2.dot(_qv) * inv, u, v };
}

/**
 * Where the strap lies on the forearm (issue #303): for each of STRAP.bands' rows, STRAP.sectors points of the skin
 * round the forearm (the outermost of every drawn skinned mesh the forearm moves: a sleeve over the arm, not the arm
 * under it), found by rays out of the bone line on the body as it was bound (so the same wherever he stands, however
 * posed), each a triangle of the skin and its weights: the skin's own points, which the bones carry as they carry
 * the skin (wrapFrame). Sector 0 is the strap's outside as bound, the back of the hand's way; sector k is k/sectors
 * of a turn round toward along × out. A sector with no skin to read is null (wrapFrame fills it from its neighbours).
 */
export function forearmWrap(humanoid, mount, { bands = STRAP.bands, n = STRAP.sectors, reach = STRAP.reach } = {}) {
  const { bone: arm, hand, outHand } = mount ?? {}, root = humanoid?.model;
  if (!arm || !hand || !root || !outHand) return null;
  const meshes = [];
  root.traverseVisible((o) => { if (o.isSkinnedMesh && o.skeleton?.bones.includes(arm) && o.skeleton.bones.includes(hand)) meshes.push(o); });
  if (!meshes.length) return null;
  arm.updateWorldMatrix(true, false);
  arm.matrixWorld.decompose(_v, _q, _s);
  const unit = 1 / (_s.x || 1);   // (metres in the forearm bone's own units)
  const offs = bands.flat(), entries = [];
  for (const mesh of meshes) {
    const sk = mesh.skeleton, ia = sk.bones.indexOf(arm), ih = sk.bones.indexOf(hand);
    // the forearm as the mesh was bound: its frame (the elbow at the origin, the wrist along it), the back of the hand
    const G = new THREE.Matrix4().multiplyMatrices(sk.boneInverses[ia], mesh.bindMatrix);
    const handBind = new THREE.Matrix4().multiplyMatrices(sk.boneInverses[ia], new THREE.Matrix4().copy(sk.boneInverses[ih]).invert());
    const wrist = new THREE.Vector3().setFromMatrixPosition(handBind), len = wrist.length(), along = wrist.clone().normalize();
    const out = outHand.clone().transformDirection(handBind);
    out.addScaledVector(along, -out.dot(along)).normalize();
    const x = new THREE.Vector3().crossVectors(along, out).normalize();
    const g = mesh.geometry, P = g.attributes.position, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight;
    if (!J || !Wt) continue;
    const index = g.index?.lodBase ?? g.index, count = index ? index.count : P.count;
    const mid = len * FOREARM.along, lo = mid + (Math.min(...offs) - 0.02) * unit, hi = mid + (Math.max(...offs) + 0.02) * unit;
    const bound = new Map(), at = (i) => {
      let p = bound.get(i);
      if (!p) { p = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(G); bound.set(i, p); }
      return p;
    };
    // (the forearm's and the hand's weight on a vertex: the arm's skin, not the shirt hanging beside it)
    const moved = (i) => { let w = 0; for (let k = 0; k < 4; k++) { const b = J.getComponent(i, k); if (b === ia || b === ih) w += Wt.getComponent(i, k); } return w; };
    const tris = [];
    for (let f = 0; f + 2 < count; f += 3) {
      const i0 = index ? index.getX(f) : f, i1 = index ? index.getX(f + 1) : f + 1, i2 = index ? index.getX(f + 2) : f + 2;
      if (Math.max(moved(i0), moved(i1), moved(i2)) < 0.5) continue;
      const a = at(i0), b = at(i1), c = at(i2), ha = a.dot(along), hb = b.dot(along), hc = c.dot(along);
      if (Math.max(ha, hb, hc) < lo || Math.min(ha, hb, hc) > hi) continue;
      tris.push([i0, i1, i2]);
    }
    entries.push({ mesh, along, out, x, mid, tris, at });
  }
  if (!entries.length) return null;
  // each row's points: the outermost hit of a ray out of the bone line, among every mesh
  const rows = [];
  bands.forEach((band, bi) => band.forEach((off) => {
    const samples = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2;
      let best = null;
      for (const E of entries) {
        const o = _org.copy(E.along).multiplyScalar(E.mid + off * unit);
        const d = _dir.copy(E.out).multiplyScalar(Math.cos(th)).addScaledVector(E.x, Math.sin(th));
        for (const [i0, i1, i2] of E.tris) {
          const r = rayTriangle(o, d, E.at(i0), E.at(i1), E.at(i2));
          if (r && r.t > 0 && r.t < reach * unit && (!best || r.t > best.t)) best = { t: r.t, mesh: E.mesh, i: [i0, i1, i2], w: [1 - r.u - r.v, r.u, r.v] };
        }
      }
      samples.push(best && { mesh: best.mesh, i: best.i, w: best.w });
    }
    rows.push({ off, band: bi, samples, points: samples.map(() => new THREE.Vector3()) });
  }));
  // the vertices to skin each frame, a mesh at a time, and the bones that move them
  const used = new Map();
  for (const r of rows) for (const s of r.samples) if (s) {
    let m = used.get(s.mesh);
    if (!m) used.set(s.mesh, m = { mesh: s.mesh, verts: new Map(), mats: new Map() });
    const g = s.mesh.geometry, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight;
    for (const i of s.i) if (!m.verts.has(i)) {
      const bi = [0, 1, 2, 3].map((k) => J.getComponent(i, k)), bw = [0, 1, 2, 3].map((k) => Wt.getComponent(i, k));
      bi.forEach((b, k) => { if (bw[k] > 0 && !m.mats.has(b)) m.mats.set(b, new THREE.Matrix4()); });
      m.verts.set(i, { bind: new THREE.Vector3().fromBufferAttribute(g.attributes.position, i).applyMatrix4(s.mesh.bindMatrix), bi, bw, now: new THREE.Vector3() });
    }
  }
  return wrapFrame({ arm, along: mount.along.clone(), rows, n, unit, meshes: [...used.values()], C: new THREE.Matrix4() });
}

const _sum = new THREE.Vector3(), _one = new THREE.Vector3(), _ai = new THREE.Matrix4();
/**
 * The strap's skin points this frame (forearmWrap's, written in place: rows[].points, in the forearm bone's frame):
 * each vertex skinned as the GPU skins it, from the bones as they are now. A sector with no skin to read is set
 * between its row's nearest neighbours that have one.
 */
export function wrapFrame(wrap) {
  if (!wrap) return wrap;
  wrap.arm.updateWorldMatrix(true, false);
  _ai.copy(wrap.arm.matrixWorld).invert();
  for (const m of wrap.meshes) {
    const mesh = m.mesh, bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses;
    for (const [b, M] of m.mats) M.multiplyMatrices(bones[b].matrixWorld, inv[b]);
    mesh.updateWorldMatrix(true, false);
    wrap.C.multiplyMatrices(_ai, mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
    for (const v of m.verts.values()) {
      _sum.set(0, 0, 0);
      for (let k = 0; k < 4; k++) if (v.bw[k] > 0) _sum.addScaledVector(_one.copy(v.bind).applyMatrix4(m.mats.get(v.bi[k])), v.bw[k]);
      v.now.copy(_sum).applyMatrix4(wrap.C);
    }
  }
  for (const r of wrap.rows) {
    const N = r.samples.length;
    for (let k = 0; k < N; k++) {
      const s = r.samples[k];
      if (!s) continue;
      const V = wrap.meshes.find((m) => m.mesh === s.mesh).verts, p = r.points[k].set(0, 0, 0);
      for (let j = 0; j < 3; j++) p.addScaledVector(V.get(s.i[j]).now, s.w[j]);
    }
    // (a hole in the skin: the sector's point turned round the bone line from the last read, its height and its
    // distance off the line between the two either side)
    const al = wrap.along;
    for (let k = 0; k < N; k++) {
      if (r.samples[k]) continue;
      let ja = 0, jb = 0;
      for (let j = 1; j < N && !ja; j++) if (r.samples[(k - j + N) % N]) ja = j;
      for (let j = 1; j < N && !jb; j++) if (r.samples[(k + j) % N]) jb = j;
      if (!ja || !jb) continue;
      const A = r.points[(k - ja + N) % N], B = r.points[(k + jb) % N], f = ja / (ja + jb);
      const ha = A.dot(al), hb = B.dot(al), ua = _one.copy(A).addScaledVector(al, -ha), ra = ua.length(), rb = _sum.copy(B).addScaledVector(al, -hb).length();
      ua.normalize().applyAxisAngle(al, (ja / N) * Math.PI * 2);
      r.points[k].copy(al).multiplyScalar(ha + (hb - ha) * f).addScaledVector(ua, ra + (rb - ra) * f);
    }
  }
  return wrap;
}

/**
 * How far the skin under the wide strap stands off the forearm's bone line the mount's way out this frame (in the
 * forearm bone's units): where each of its rows' rings of points crosses `mount.out`, the furthest of them.
 */
export function wrapLift(wrap, mount) {
  const { along, out } = mount, x = _x.crossVectors(along, out).normalize();
  let best = 0;
  for (const r of wrap?.rows ?? []) {
    if (r.band !== 0) continue;
    const N = r.points.length;
    for (let k = 0; k < N; k++) {
      const a = r.points[k], b = r.points[(k + 1) % N], ax = a.dot(x), bx = b.dot(x);
      if (ax === bx || (ax > 0) === (bx > 0)) continue;
      const s = ax / (ax - bx), o = a.dot(out) + s * (b.dot(out) - a.dot(out));
      if (o > best) best = o;
    }
  }
  return best;
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
