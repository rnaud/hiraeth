// CMU's own format (http://mocap.cs.cmu.edu/info.php): an ASF skeleton (bone directions and
// lengths in the rest pose, each bone's local axes) and an AMC motion (per frame, the root's
// position and every bone's rotation about its local axes, in degrees).
//
// Read into a "take" (see take.js): for each bone, its world rotation relative to the rest pose
// and where it ends, per frame, in metres, y up, the subject facing +z at rest (CMU's own axes).
import * as THREE from 'three';
import { newTake } from './take.js';

/** Parse an ASF skeleton. Returns { unit (m per length unit), root: { order }, bones: Map name -> bone, order: names parents-first }. */
export function parseASF(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  let section = null, lengthUnit = 1, angleDeg = true;
  const bones = new Map(), parent = new Map();
  let root = { order: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ'], axis: [0, 0, 0] };
  let cur = null;
  for (const line of lines) {
    if (line.startsWith(':')) {
      const [key, ...rest] = line.slice(1).split(/\s+/);
      section = key;
      if (key === 'units' || key === 'root' || key === 'bonedata' || key === 'hierarchy') continue;
      continue;
    }
    const t = line.split(/\s+/);
    if (section === 'units') {
      if (t[0] === 'length') lengthUnit = parseFloat(t[1]);
      if (t[0] === 'angle') angleDeg = t[1].toLowerCase().startsWith('deg');
    } else if (section === 'root') {
      if (t[0] === 'order') root.order = t.slice(1).map((x) => x.toUpperCase());
      if (t[0] === 'orientation') root.axis = t.slice(1, 4).map(Number);
    } else if (section === 'bonedata') {
      if (t[0] === 'begin') cur = { dof: [], axis: [0, 0, 0], axisOrder: 'XYZ' };
      else if (t[0] === 'end') { bones.set(cur.name, cur); cur = null; }
      else if (cur) {
        if (t[0] === 'name') cur.name = t[1];
        else if (t[0] === 'direction') cur.direction = new THREE.Vector3(...t.slice(1, 4).map(Number));
        else if (t[0] === 'length') cur.length = parseFloat(t[1]);
        else if (t[0] === 'axis') { cur.axis = t.slice(1, 4).map(Number); cur.axisOrder = (t[4] ?? 'XYZ').toUpperCase(); }
        else if (t[0] === 'dof') cur.dof = t.slice(1).map((x) => x.toLowerCase());
      }
    } else if (section === 'hierarchy') {
      if (t[0] === 'begin' || t[0] === 'end') continue;
      for (const c of t.slice(1)) parent.set(c, t[0]);
    }
  }
  const toRad = angleDeg ? Math.PI / 180 : 1;
  const unit = 0.0254 / lengthUnit;   // CMU: length 0.45 -> (1 / 0.45) * 2.54 / 100 m (their FAQ)
  for (const b of bones.values()) {
    b.parent = parent.get(b.name) ?? 'root';
    b.C = axisQuat(b.axis, b.axisOrder, toRad);
    b.Ci = b.C.clone().invert();
    b.offset = b.direction.clone().normalize().multiplyScalar(b.length * unit);
  }
  // parents first
  const order = [];
  const visit = (name) => { for (const [c, p] of parent) if (p === name) { order.push(c); visit(c); } };
  visit('root');
  root.C = axisQuat(root.axis, 'XYZ', toRad);
  root.Ci = root.C.clone().invert();
  return { unit, toRad, root, bones, order };
}

/** An ASF axis / AMC rotation: rotations about x, then y, then z, in the world (three's 'ZYX' order). */
function axisQuat([x, y, z], order = 'XYZ', toRad = Math.PI / 180) {
  // (CMU is always XYZ: x applied first; an extrinsic sequence is three's intrinsic one reversed)
  const e = new THREE.Euler(x * toRad, y * toRad, z * toRad, order.split('').reverse().join(''));
  return new THREE.Quaternion().setFromEuler(e);
}

/** Parse an AMC motion against its skeleton. Returns frames: [{ root: [..6], bone: [values] }]. */
export function parseAMC(text) {
  const frames = [];
  let f = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(':')) continue;
    if (/^\d+$/.test(line)) { f = new Map(); frames.push(f); continue; }
    if (!f) continue;
    const t = line.split(/\s+/);
    f.set(t[0], t.slice(1).map(Number));
  }
  return frames;
}

/**
 * Forward kinematics: the take (take.js) of an ASF + AMC pair.
 * Points: 'root' (the root's position) and each bone's end; rotations: each bone's (and the
 * root's) world rotation relative to the rest pose.
 */
export function asfAmcTake(asfText, amcText, { fps = 120, name = 'take' } = {}) {
  const S = parseASF(asfText), frames = parseAMC(amcText);
  const names = ['root', ...S.order];
  const take = newTake({ name, fps, n: frames.length, points: names, rotations: names });
  const G = new Map(), E = new Map();
  for (const k of names) { G.set(k, new THREE.Quaternion()); E.set(k, new THREE.Vector3()); }
  const m = new THREE.Quaternion(), v = new THREE.Vector3();
  for (let i = 0; i < frames.length; i++) {
    const F = frames[i];
    // root: position and rotation in the root's channel order
    const r = F.get('root') ?? [0, 0, 0, 0, 0, 0];
    const ch = {};
    S.root.order.forEach((c, k) => { ch[c] = r[k] ?? 0; });
    E.get('root').set(ch.TX ?? 0, ch.TY ?? 0, ch.TZ ?? 0).multiplyScalar(S.unit);
    m.copy(axisQuat([(ch.RX ?? 0), (ch.RY ?? 0), (ch.RZ ?? 0)], 'XYZ', S.toRad));
    G.get('root').copy(S.root.C).multiply(m).multiply(S.root.Ci);
    for (const name of S.order) {
      const b = S.bones.get(name), vals = F.get(name) ?? [];
      const rot = [0, 0, 0];
      b.dof.forEach((d, k) => { const a = { rx: 0, ry: 1, rz: 2 }[d]; if (a !== undefined) rot[a] = vals[k] ?? 0; });
      m.copy(axisQuat(rot, 'XYZ', S.toRad));
      const g = G.get(name).copy(G.get(b.parent)).multiply(b.C).multiply(m).multiply(b.Ci);
      E.get(name).copy(E.get(b.parent)).add(v.copy(b.offset).applyQuaternion(g));
    }
    for (const k of names) { take.setPoint(k, i, E.get(k)); take.setRotation(k, i, G.get(k)); }
  }
  take.parents = Object.fromEntries(names.map((k) => [k, k === 'root' ? null : S.bones.get(k).parent]));
  return take;
}

// The CMU skeleton onto the game's (the UAL library's UE-mannequin names): each of our bones takes
// the rotation of `rot` (relative to rest) and is then aimed from point `from` to point `to`
// (bone ends) when `aim` is set. Points are bone ends ('lfemur' = the knee).
export const CMU_MAP = {
  pelvis: { rot: 'root' },
  spine_01: { rot: 'lowerback', from: 'root', to: 'lowerback', aim: true },
  spine_02: { rot: 'upperback', from: 'lowerback', to: 'upperback', aim: true },
  spine_03: { rot: 'thorax', from: 'upperback', to: 'thorax', aim: true },
  neck_01: { rot: 'lowerneck', from: 'thorax', to: 'upperneck', aim: true },
  Head: { rot: 'head' },
  ...Object.fromEntries(['l', 'r'].flatMap((s) => [
    [`clavicle_${s}`, { rot: `${s}clavicle`, from: 'thorax', to: `${s}clavicle`, aim: true }],
    [`upperarm_${s}`, { rot: `${s}humerus`, from: `${s}clavicle`, to: `${s}humerus`, aim: true }],
    [`lowerarm_${s}`, { rot: `${s}radius`, from: `${s}humerus`, to: `${s}radius`, aim: true }],
    [`hand_${s}`, { rot: `${s}hand`, from: `${s}wrist`, to: `${s}hand`, aim: true }],
    [`thigh_${s}`, { rot: `${s}femur`, from: `${s}hipjoint`, to: `${s}femur`, aim: true }],
    [`calf_${s}`, { rot: `${s}tibia`, from: `${s}femur`, to: `${s}tibia`, aim: true }],
    [`foot_${s}`, { rot: `${s}foot`, from: `${s}tibia`, to: `${s}foot`, aim: true }],
  ])),
};
// the source's landmarks: the hips (for the pelvis' place), the ankles, balls and toes (for contacts)
export const CMU_POINTS = { hipL: 'lhipjoint', hipR: 'rhipjoint', ankleL: 'ltibia', ankleR: 'rtibia', ballL: 'lfoot', ballR: 'rfoot', toeL: 'ltoes', toeR: 'rtoes', head: 'head' };
