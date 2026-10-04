import * as THREE from 'three';

// The traveller's outfit on the people's skeleton.
//
// The traveller (public/anim/traveller.glb) was modelled and weighted on a
// 22-bone rig of its own, in an A-pose, with a big head and short legs. The
// people of the worlds use Quaternius' 65-bone human (humanoid.js). Here the
// outfit (the suit, boots, gloves, helmet, headphones, scarf and radio pack)
// is put on that human instead, so the traveller is driven by exactly the
// skeleton, retargeting and IK the NPCs use, and nothing of its old rig is
// left to break.
//
// Nothing in the outfit's geometry changes (the face shader, the suit's
// folds and the helmet glass all work in the outfit's own bind coordinates).
// The fit lives in the bind matrices instead: each outfit mesh is skinned to
// the human's bones, and each bone's inverse bind matrix carries a warp W
// from the outfit's rig onto the human:
//
//   world = sum_i  w_i · bone_i(now) · A_i⁻¹ · W_i · v
//
//   A   the human's skeleton bent into the outfit's A-pose (its arms brought
//       down along the outfit's sleeves): bind-pose matrices for the outfit
//   W   per outfit bone: the outfit's joint onto the human's, turned onto the
//       human's limb and scaled to its length and girth (measured from both
//       meshes, with some room so the suit stays baggy)
//
// Rigid pieces have their own warps: the head (helmet, face, headphones,
// scarf) keeps its shape and is scaled down a little to the human's
// proportions; the gloves turn with the human's palms; the pack is moved so
// it sits on the narrower back. Weights are the outfit's own, renamed onto
// the human's bones (spine -> spine_01, chest -> spine_03, shin -> calf...).

/** The outfit rig's bones (GLTFLoader-sanitized names) → the human's. */
export const OUTFIT_BONES = {
  root: 'root', pelvis: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'Head',
  ...Object.fromEntries(['L', 'R'].flatMap((S) => {
    const s = S.toLowerCase();
    return [['clavicle', 'clavicle'], ['upper_arm', 'upperarm'], ['forearm', 'lowerarm'], ['hand', 'hand'], ['thigh', 'thigh'], ['shin', 'calf'], ['foot', 'foot'], ['toe', 'ball']]
      .map(([a, b]) => [`${a}${S}`, `${b}_${s}`]);
  })),
};
// each bone's segment: the joint it runs to (outfit rig, human)
const SEG_T = { pelvis: 'spine', spine: 'chest', chest: 'neck', neck: 'head', clavicleL: 'upper_armL', clavicleR: 'upper_armR',
  upper_armL: 'forearmL', upper_armR: 'forearmR', forearmL: 'handL', forearmR: 'handR', thighL: 'shinL', thighR: 'shinR', shinL: 'footL', shinR: 'footR' };
const SEG_Q = { pelvis: 'spine_01', spine_01: 'spine_03', spine_03: 'neck_01', neck_01: 'Head', clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r',
  upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', lowerarm_l: 'hand_l', lowerarm_r: 'hand_r', thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r' };

/** Fit settings: how loose the suit sits over the body, and the rigid pieces' scale. */
export const OUTFIT_FIT = {
  bag: { torso: 1.3, arm: 1.45, leg: 1.4 },   // suit girth / body girth
  head: 0.86,                                 // the helmet and face (the outfit's head is a cartoon's)
  boot: 1.12,                                 // boot length / foot length
  bootHeight: 0.78,                           // of the boots' height, kept at least (the human's ankle is half as high)
  k: [0.55, 1.3],                             // limits on any girth scale
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
const pos = (m, out = new THREE.Vector3()) => out.setFromMatrixPosition(m);
const rotOf = (m) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));
/** Rotation whose y is `along` and z is `ref` (made perpendicular). */
function frame(along, ref) {
  const y = along.clone().normalize();
  const z = ref.clone().addScaledVector(y, -ref.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}
const T = (v) => new THREE.Matrix4().makeTranslation(v.x, v.y, v.z);

/** The skinned meshes of a glTF scene, and the skeleton they share. */
function skinnedOf(scene) {
  const out = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) out.push(o); });
  return out;
}

/**
 * Work out the fit of an outfit (a glTF scene skinned to the outfit rig) onto a human's body
 * (the template's main skinned mesh, in its bind pose). Pure data, shared by every instance:
 * { inverses: { body, rigid } (Matrix4 per human bone), meshes: [{ source, geometry, rigid }],
 *   head: { W, scale }, pack: W, forearm: { l, r } (matrices in the human's forearm bone frame) }.
 */
export function fitOutfit(outfitScene, body) {
  const bones = body.skeleton.bones, qi = new Map(bones.map((b, i) => [b.name, i]));
  const Q = body.skeleton.boneInverses.map((m) => m.clone().invert());          // the human's bind (T-pose)
  const meshes = skinnedOf(outfitScene);
  const tSk = meshes[0].skeleton, ti = new Map(tSk.bones.map((b, i) => [b.name, i]));
  const Tm = tSk.boneInverses.map((m) => m.clone().invert());
  const tp = (n) => pos(Tm[ti.get(n)]);

  // ---- A: the human bent into the outfit's A-pose (arms down along the sleeves)
  const A = Q.map((m) => m.clone());
  const under = bones.map((b) => { const s = new Set(); for (let o = b; o?.isBone; o = o.parent) s.add(o); return s; });
  const turnFrom = (i, R) => {
    const p = pos(A[i]), M = T(p).multiply(new THREE.Matrix4().makeRotationFromQuaternion(R)).multiply(T(p.clone().negate()));
    bones.forEach((b, k) => { if (under[k].has(bones[i])) A[k].premultiply(M); });
  };
  const qp = (n) => pos(A[qi.get(n)]);
  const qDir = (a, b) => qp(b).sub(qp(a)).normalize();
  const tDir = (a, b) => tp(b).sub(tp(a)).normalize();
  const tAlong = (n) => new THREE.Vector3(0, 1, 0).applyQuaternion(rotOf(Tm[ti.get(n)]));   // the outfit rig's hand bone runs along +y
  const palms = {};
  for (const [s, S] of [['l', 'L'], ['r', 'R']]) {
    // the palm in the human's T-pose (facing down), carried along by the turns below
    const along = qDir(`hand_${s}`, `middle_01_${s}`), span = qDir(`pinky_01_${s}`, `index_01_${s}`);
    const palm = new THREE.Vector3().crossVectors(along, span).normalize();
    if (palm.y > 0) palm.negate();
    const hq0 = rotOf(A[qi.get(`hand_${s}`)]);
    turnFrom(qi.get(`upperarm_${s}`), _q.setFromUnitVectors(qDir(`upperarm_${s}`, `lowerarm_${s}`), tDir(`upper_arm${S}`, `forearm${S}`)).clone());
    turnFrom(qi.get(`lowerarm_${s}`), _q.setFromUnitVectors(qDir(`lowerarm_${s}`, `hand_${s}`), tDir(`forearm${S}`, `hand${S}`)).clone());
    turnFrom(qi.get(`hand_${s}`), _q.setFromUnitVectors(qDir(`hand_${s}`, `middle_01_${s}`), tAlong(`hand${S}`)).clone());
    palms[s] = palm.applyQuaternion(rotOf(A[qi.get(`hand_${s}`)]).multiply(hq0.invert()));
  }

  // ---- the human's body in that A-pose (for measuring it)
  const P = body.geometry.attributes.position, J = body.geometry.attributes.skinIndex, Wt = body.geometry.attributes.skinWeight;
  const skinM = A.map((a, i) => a.clone().multiply(body.skeleton.boneInverses[i]).multiply(body.bindMatrix));
  const bodyA = [], bodyBone = [];
  const acc = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i); acc.set(0, 0, 0);
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = Wt.getComponent(i, k); if (w <= 0) continue;
      const j = J.getComponent(i, k);
      acc.addScaledVector(_w.copy(_v).applyMatrix4(skinM[j]), w);
      if (w > bw) { bw = w; best = j; }
    }
    bodyA.push(acc.clone()); bodyBone.push(bw > 0.6 ? best : -1);
  }
  // the outfit's own vertices, by their main bone
  const suit = meshes.filter((m) => !rigidMesh(m));
  const girth = (pts, origin, F) => {
    const Fi = F.clone().invert(), out = [0, 0];
    if (!pts.length) return null;
    for (const p of pts) { _v.copy(p).sub(origin).applyMatrix4(Fi); out[0] += _v.x * _v.x; out[1] += _v.z * _v.z; }
    return out.map((v) => Math.sqrt(v / pts.length));
  };
  const byBone = tSk.bones.map(() => []);
  for (const m of suit) {
    const Pm = m.geometry.attributes.position, Jm = m.geometry.attributes.skinIndex, Wm = m.geometry.attributes.skinWeight;
    for (let i = 0; i < Pm.count; i += 2) for (let k = 0; k < 4; k++) if (Wm.getComponent(i, k) > 0.6) byBone[Jm.getComponent(i, k)].push(new THREE.Vector3().fromBufferAttribute(Pm, i));
  }
  const outfitPts = (j) => byBone[j];
  const bodyPts = (names) => {
    const set = new Set(names.map((n) => qi.get(n)));
    return bodyA.filter((_, i) => set.has(bodyBone[i]));
  };

  // ---- W: one warp per outfit bone
  const F = OUTFIT_FIT, clampK = (k) => THREE.MathUtils.clamp(k, F.k[0], F.k[1]);
  // the trunk is measured whole (its bones split it differently in the two rigs): one girth for all of it
  const trunk = (() => {
    // everything between the hips and the armpits that isn't an arm
    const band = (pts, lo, hi) => pts.filter((p) => p.y > lo && p.y < hi);
    const armT = new Set(['upper_arm', 'forearm', 'hand'].flatMap((n) => [`${n}L`, `${n}R`]).map((n) => ti.get(n)));
    const tPts = band(byBone.flatMap((pts, j) => (armT.has(j) ? [] : pts)), tp('thighL').y + 0.05, tp('upper_armL').y - 0.12);
    const armQ = new Set(bones.map((b, i) => (/arm|hand|index|middle|ring|pinky|thumb/.test(b.name) ? i : -1)));
    const qPts = band(bodyA.filter((_, i) => bodyBone[i] >= 0 && !armQ.has(bodyBone[i])), qp('thigh_l').y + 0.05, qp('upperarm_l').y - 0.12);
    const spread = (pts) => {
      const c = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
      let x = 0, z = 0;
      for (const p of pts) { x += p.x * p.x; z += (p.z - c.z) ** 2; }
      return [Math.sqrt(x / pts.length), Math.sqrt(z / pts.length)];
    };
    const t = spread(tPts), q = spread(qPts);
    return [clampK(F.bag.torso * q[0] / t[0]), clampK(F.bag.torso * q[1] / t[1])];
  })();
  const W = new Map();
  const FWD = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
  for (const [tn, qn] of Object.entries(OUTFIT_BONES)) {
    if (!ti.has(tn) || !qi.has(qn)) continue;
    const a = tp(tn), b = qp(qn);
    if (/^(root|head|hand|toe)/.test(tn)) continue;   // below
    if (/^foot/.test(tn)) continue;
    const tEnd = SEG_T[tn], qEnd = SEG_Q[qn];
    const dT = tp(tEnd).sub(a), dQ = qp(qEnd).sub(b);
    // limbs turn onto the human's; the trunk and collarbones stay upright and square (the human's
    // spine leans and its collarbones run back, which would tip the suit), only stretched
    const limb = /arm|thigh|shin/.test(tn);
    const R = new THREE.Matrix4();
    if (limb) R.makeRotationFromQuaternion(_q.setFromUnitVectors(dT.clone().normalize(), dQ.clone().normalize()));
    const Ft = frame(dT, FWD);
    const group = /arm|clav/.test(tn) ? 'arm' : /thigh|shin/.test(tn) ? 'leg' : 'torso';
    let kx = trunk[0], kz = trunk[1];
    if (limb) {
      const gT = girth(outfitPts(ti.get(tn)), a, Ft), gQ = girth(bodyPts([qn]), b, frame(dQ, FWD));
      const bag = F.bag[group];
      kx = gT && gQ ? clampK(bag * gQ[0] / gT[0]) : 1; kz = gT && gQ ? clampK(bag * gQ[1] / gT[1]) : 1;
    }
    const ky = limb ? dQ.length() / dT.length() : Math.abs(dQ.dot(dT.clone().normalize())) / dT.length();
    const S = Ft.clone().multiply(new THREE.Matrix4().makeScale(kx, ky, kz)).multiply(Ft.clone().invert());
    W.set(tn, T(b).multiply(R).multiply(S).multiply(T(a.clone().negate())));
  }
  // the head: rigid, a little smaller
  const headW = T(qp('Head')).multiply(new THREE.Matrix4().makeScale(F.head, F.head, F.head)).multiply(T(tp('head').negate()));
  W.set('head', headW);
  W.set('root', new THREE.Matrix4());
  const twist = {};
  for (const [s, S] of [['l', 'L'], ['r', 'R']]) {
    // gloves: rigid on the hand, turned so the outfit's palm (forward, at rest) is the human's
    const Rt = frame(tAlong(`hand${S}`), FWD), Rq = frame(qDir(`hand_${s}`, `middle_01_${s}`), palms[s]);
    const R = Rq.clone().multiply(Rt.clone().invert());
    twist[s] = R;
    W.set(`hand${S}`, T(qp(`hand_${s}`)).multiply(R).multiply(T(tp(`hand${S}`).negate())));
    // boots: rigid on the foot (below), scaled to its length and a little lower, the soles on the ground
    const footT = outfitPts(ti.get(`foot${S}`)), footQ = bodyPts([`foot_${s}`, `ball_${s}`]);
    const zr = (pts) => pts.reduce(([lo, hi], p) => [Math.min(lo, p.z), Math.max(hi, p.z)], [Infinity, -Infinity]);
    const [t0, t1] = zr(footT), [q0, q1] = zr(footQ);
    const sl = Number.isFinite(t0) && Number.isFinite(q0) ? THREE.MathUtils.clamp(F.boot * (q1 - q0) / (t1 - t0), 0.6, 1.2) : 1;
    const aT = tp(`foot${S}`), aQ = qp(`foot_${s}`);
    const gT = new THREE.Vector3(aT.x, 0, Number.isFinite(t0) ? (t0 + t1) / 2 : aT.z), gQ = new THREE.Vector3(aQ.x, 0, Number.isFinite(q0) ? (q0 + q1) / 2 : aQ.z);
    const foot = T(gQ).multiply(new THREE.Matrix4().makeScale(sl, Math.max(aQ.y / aT.y, F.bootHeight) * sl, sl)).multiply(T(gT.negate()));
    W.set(`foot${S}`, foot);
    W.set(`toe${S}`, foot);
  }
  // the pack: rigid, moved onto the human's back (where the suit's back now is)
  const backT = (() => {
    let z = Infinity;
    for (const m of suit) {
      const Pm = m.geometry.attributes.position;
      for (let i = 0; i < Pm.count; i++) if (Math.abs(Pm.getX(i)) < 0.05 && Math.abs(Pm.getY(i) - 1.3) < 0.04) z = Math.min(z, Pm.getZ(i));
    }
    return new THREE.Vector3(0, 1.3, Number.isFinite(z) ? z : -0.15);
  })();
  const backQ = backT.clone().applyMatrix4(W.get('chest'));
  const packW = T(backQ.clone().sub(backT));

  // ---- inverse bind matrices: A⁻¹ · W, per human bone
  const byQ = new Map(Object.entries(OUTFIT_BONES).filter(([tn]) => W.has(tn)).map(([tn, qn]) => [qn, W.get(tn)]));
  const warpOf = (b) => { for (let o = b; o?.isBone; o = o.parent) if (byQ.has(o.name)) return byQ.get(o.name); return new THREE.Matrix4(); };
  const bodyInv = bones.map((b, i) => A[i].clone().invert().multiply(warpOf(b)));
  const rigidInv = bodyInv.map((m, i) => (bones[i].name === 'spine_03' ? A[i].clone().invert().multiply(packW) : m.clone()));

  // ---- the meshes: the outfit's weights renamed onto the human's bones
  const remap = tSk.bones.map((b) => qi.get(OUTFIT_BONES[b.name]) ?? qi.get('root'));
  // the boots ride on the foot alone (their shafts bent with the shin, and the human's ankle is far lower)
  const bootRemap = tSk.bones.map((b, j) => (/^shin/.test(b.name) ? qi.get(OUTFIT_BONES[b.name.replace('shin', 'foot')]) : remap[j]));
  const out = meshes.map((m) => {
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(m.geometry.attributes)) g.setAttribute(k, a);
    g.setIndex(m.geometry.index);
    for (const gr of m.geometry.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    const src = m.geometry.attributes.skinIndex, J2 = new Uint16Array(src.count * 4), map = /boots/.test(m.name) ? bootRemap : remap;
    for (let i = 0; i < src.count; i++) for (let k = 0; k < 4; k++) J2[i * 4 + k] = map[src.getComponent(i, k)];
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(J2, 4));
    g.boundingBox = m.geometry.boundingBox; g.boundingSphere = m.geometry.boundingSphere;
    return { source: m, geometry: g, rigid: rigidMesh(m) };
  });

  // the forearm's frame as the outfit rig had it (+y toward the hand), for things strapped to it (the bracer)
  const forearm = {};
  for (const [s, S] of [['l', 'L'], ['r', 'R']]) {
    const i = qi.get(`lowerarm_${s}`), Tf = Tm[ti.get(`forearm${S}`)];
    const Rt = frame(tDir(`forearm${S}`, `hand${S}`), FWD), Rq = frame(qDir(`lowerarm_${s}`, `hand_${s}`), palms[s]);
    const Wf = T(qp(`lowerarm_${s}`)).multiply(Rq.multiply(Rt.invert())).multiply(T(tp(`forearm${S}`).negate()));
    forearm[s] = A[i].clone().invert().multiply(Wf).multiply(Tf);
  }
  return { inverses: { body: bodyInv, rigid: rigidInv }, meshes: out, head: { W: headW, scale: F.head }, pack: packW, chest: W.get('chest'), forearm, A, W, twist };
}

/** A mesh every vertex of which follows one bone (the helmet, the pack, gloves, soles). */
function rigidMesh(m) {
  const W = m.geometry.attributes.skinWeight;
  for (let i = 0; i < W.count; i++) if (W.getX(i) < 0.99 && W.getY(i) < 0.99 && W.getZ(i) < 0.99 && W.getW(i) < 0.99) return false;
  return true;
}
