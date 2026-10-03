import { FaceExpression } from './face.js';
import { limbSegments } from './creases.js';
import { TRAVELLER_PALETTE, TRAVELLER_TONES } from './traveller-style.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeMaterial, MODE_OUTFIT } from './materials.js';

// A real human body (Quaternius' Universal Base Characters, CC0) dressed in
// the rider's clothes by our inked material, driven every frame by the
// procedural rig. The rig keeps doing all the animation (mocap clips and the
// authored climb / ride / glide / jetpack poses) and stays invisible; each
// skinned bone is aimed along the matching rig limb, keeping its own rest
// twist. The hood, collar, cloth cape and jetpack stay ours and are moved
// onto the body's head and shoulders.

const MODELS = { m: 'anim/human_m.glb', f: 'anim/human_f.glb' };
const cache = {};
export function loadHuman(kind = 'm') {
  cache[kind] ??= new GLTFLoader().loadAsync(MODELS[kind]).then((g) => { reshape(g.scene, kind); return g.scene; });
  return cache[kind];
}

// Rest-pose facial landmarks (metres): eyeY, eyeX, noseY, noseZ, chinY
export const FACE = { m: [1.699, 0.032, 1.657, 0.115, 1.577], f: [1.656, 0.032, 1.617, 0.112, 1.538] };

// ---------------------------------------------------------------------------
// Turn the stock "superhero" into a gaunt Moebius figure, in the rest pose:
//  - slim: every vertex is pulled toward the bones it's skinned to (weighted,
//    so joints stay smooth); the shoulders come in by moving the arm bones;
//  - face: narrower and longer, a long straight nose, hollow cheeks, a heavy
//    brow. The ink lines of the face are drawn by the material (outfit mode).

// radial factor per bone, and the bone that ends its segment
const SLIM = [
  [/^thigh_/, 0.74], [/^calf_/, 0.78], [/^upperarm_/, 0.66], [/^lowerarm_/, 0.74], [/^clavicle_/, 0.78],
  [/^spine_0[123]$/, [0.78, 0.84]], [/^pelvis$/, [0.86, 0.88]], [/^neck_01$/, 0.82],
];
const NEXT = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head',
  thigh_l: 'calf_l', calf_l: 'foot_l', thigh_r: 'calf_r', calf_r: 'foot_r',
  clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l',
  clavicle_r: 'upperarm_r', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r' };
const SHOULDER_IN = { m: 0.045, f: 0.02 };

/** Landmarks after reshape(): the lower face is 22% longer, x narrowed 10%. */
function faceAfterReshape(kind) {
  const [eyeY, eyeX, noseY, noseZ, chinY] = FACE[kind];
  const longer = (y) => eyeY + (y - eyeY) * 1.22;
  return [eyeY, eyeX * 0.9, longer(noseY), noseZ, longer(chinY)];
}

function reshape(scene, kind) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const skel = meshes[0].skeleton;
  const bones = skel.bones, idx = new Map(bones.map((b, i) => [b.name, i]));
  const bindPos = bones.map((b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld));
  const seg = bones.map((b) => {
    const rule = SLIM.find(([re]) => re.test(b.name));
    const next = NEXT[b.name] !== undefined ? idx.get(NEXT[b.name]) : undefined;
    if (!rule || next === undefined) return null;
    const f = Array.isArray(rule[1]) ? rule[1] : [rule[1], rule[1]];
    return { a: bindPos[bones.indexOf(b)], b: bindPos[next], fx: f[0], fz: f[1], vertical: /spine|pelvis|neck/.test(b.name) };
  });
  const armSide = bones.map((b) => {
    if (/(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)(_twist)?_?\d*_l$/.test(b.name)) return 1;
    if (/(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)(_twist)?_?\d*_r$/.test(b.name)) return -1;
    if (b.name === 'clavicle_l') return 0.5;
    if (b.name === 'clavicle_r') return -0.5;
    return 0;
  });
  const [eyeY, , noseY, noseZ, chinY] = FACE[kind];
  const headI = idx.get('Head');
  const shoulderIn = SHOULDER_IN[kind];
  const v = new THREE.Vector3(), out = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3();

  for (const mesh of meshes) {
    const g = mesh.geometry;
    const isBrow = /hair/i.test(mesh.material?.name ?? '');
    if (isBrow) {   // eyebrows: half as tall, pulled toward their own centre line
      g.computeBoundingBox();
      const cy = (g.boundingBox.min.y + g.boundingBox.max.y) / 2;
      const Pb = g.attributes.position;
      for (let i = 0; i < Pb.count; i++) Pb.setY(i, cy + (Pb.getY(i) - cy) * 0.5);
    }
    const P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      out.set(0, 0, 0);
      let wsum = 0, headW = 0, arm = 0;
      for (let k = 0; k < 4; k++) {
        const j = J.getComponent(i, k), w = W.getComponent(i, k);
        if (w <= 0) continue;
        wsum += w;
        if (j === headI) headW += w;
        arm += armSide[j] * w;
        const sg = seg[j];
        if (!sg) { out.addScaledVector(v, w); continue; }
        // closest point on the bone segment, then scale the offset from it
        ab.subVectors(sg.b, sg.a);
        const t = THREE.MathUtils.clamp(c.subVectors(v, sg.a).dot(ab) / ab.lengthSq(), 0, 1);
        c.copy(sg.a).addScaledVector(ab, t);
        if (sg.vertical) { c.x = sg.a.x; }   // torso: squeeze toward the spine's vertical axis
        const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
        const fy = sg.vertical ? 1 : sg.fx;
        out.x += (c.x + dx * sg.fx) * w;
        out.y += (c.y + dy * fy) * w;
        out.z += (c.z + dz * sg.fz) * w;
      }
      if (wsum > 0) v.copy(out.divideScalar(wsum));
      // shoulders in: the arms (and half the clavicles) slide toward the body
      v.x -= Math.sign(arm) * Math.min(Math.abs(arm), 1) * shoulderIn;
      // the face
      if (headW > 0.3) {
        const k = THREE.MathUtils.smoothstep(headW, 0.3, 0.8);
        let x = v.x * (1 - 0.1 * k), y = v.y, z = v.z;
        if (y < eyeY) y = eyeY + (y - eyeY) * (1 + 0.22 * k);                       // longer lower face
        const front = THREE.MathUtils.smoothstep(z, noseZ - 0.045, noseZ - 0.01);
        // long straight nose: a ridge from between the eyes to below the old tip
        const along = THREE.MathUtils.clamp((eyeY - 0.004 - y) / (eyeY - noseY + 0.012), 0, 1);
        const ridge = Math.exp(-((v.x / 0.013) ** 2)) * front * Math.sin(Math.PI * Math.min(along * 1.05, 1)) ** 0.6;
        z += ridge * 0.009 * k;
        y -= ridge * along * 0.004 * k;
        // hollow cheeks under the cheekbones
        const cheek = Math.exp(-(((Math.abs(v.x) - 0.052) / 0.016) ** 2) - (((y - (noseY - 0.018)) / 0.02) ** 2));
        z -= cheek * 0.008 * k;
        x -= Math.sign(v.x) * cheek * 0.005 * k;
        // heavy brow
        const brow = Math.exp(-(((y - (eyeY + 0.017)) / 0.008) ** 2)) * THREE.MathUtils.smoothstep(z, 0.03, 0.07);
        z += brow * 0.002 * k;
        // a stronger, narrower chin
        const chin = Math.exp(-((v.x / 0.02) ** 2) - (((y - chinY) / 0.02) ** 2));
        z += chin * 0.006 * k;
        v.set(x, y, z);
      }
      P.setXYZ(i, v.x, v.y, v.z);
    }
    P.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }

  // move the arm bones in to match, then rebind
  for (const s of ['l', 'r']) {
    const ua = bones[idx.get(`upperarm_${s}`)];
    const parentQ = ua.parent.getWorldQuaternion(new THREE.Quaternion());
    const parentS = ua.parent.getWorldScale(new THREE.Vector3());
    const d = new THREE.Vector3(s === 'l' ? -shoulderIn : shoulderIn, 0, 0).applyQuaternion(parentQ.invert()).divide(parentS);
    ua.position.add(d);
  }
  scene.updateMatrixWorld(true);
  for (const m of meshes) { m.bind(m.skeleton, m.matrixWorld); m.skeleton.calculateInverses(); }
}

// rest-pose regions per model (metres): bootTop, beltY, neckY, wristX
const OUTFIT = { m: [0.13, 0.97, 1.47, 0.64], f: [0.12, 0.95, 1.44, 0.58] };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _i1 = new THREE.Vector3(), _i2 = new THREE.Vector3(), _i3 = new THREE.Vector3(), _i4 = new THREE.Vector3(), _i5 = new THREE.Vector3();
const _i6 = new THREE.Vector3(), _i7 = new THREE.Vector3(), _i8 = new THREE.Vector3(), _i9 = new THREE.Vector3();
const _iq = new THREE.Quaternion(), _iq2 = new THREE.Quaternion(), _iq3 = new THREE.Quaternion(), _im = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();

// The face lights as one rounded volume (bind-pose centre, normal blend).
const HEAD_BALL = [0, 1.8, 0.03, 0.8];

export class Humanoid {
  /**
   * @param template loadHuman() result
   * @param char     the rig from buildCharacter()
   * @param kind     'm' | 'f'
   */
  constructor(template, char, kind = 'm', { skin = '#e8c6a8', hair = '#8a6a55', gloves = null, suit = false, imported = false } = {}) {
    this.char = char;
    this.imported = imported;
    if (imported) this.face = new FaceExpression();
    this.noShadow = [];
    const model = cloneSkinned(template);
    this.model = model;
    const C = char.colors;
    const body = makeMaterial({ color: C.cloth, color2: C.legs, color3: C.boot ?? '#6e3f2c', mode: MODE_OUTFIT, skin, outfit: OUTFIT[kind], face: faceAfterReshape(kind), gloves, suit });
    const eyes = makeMaterial({ color: C.ink });
    const brows = makeMaterial({ color: hair });
    model.traverse((o) => {
      if (!o.isMesh) return;
      const isBrow = /brow/i.test(o.name) || /hair/i.test(o.material?.name ?? '');
      if (imported) {
        const source = o.material;
        const glass = source.name === 'Clear bubble';
        const portrait = source.name === 'Traveller peach skin';
        if (['Traveller facial ink', 'Traveller warm facial lines'].includes(source.name)) o.visible = false;
        o.geometry.computeBoundingBox();
        const glassCenter = glass ? o.geometry.boundingBox.getCenter(new THREE.Vector3()) : undefined;
        // The suit is flat printed colour (baked vertex zones); the shader draws its folds.
        const flat = !!o.geometry.attributes.color;
        const tone = TRAVELLER_PALETTE[TRAVELLER_TONES[source.name]];
        const color = flat ? '#ffffff' : tone ?? source.color;
        o.material = makeMaterial({ color, map: source.map, glass, glassCenter, glow: glass ? 0.35 : 0, vertexColors: flat, palette: flat ? Object.values(TRAVELLER_PALETTE) : null,
          creases: flat && o.isSkinnedMesh ? limbSegments(o) : null, headBall: portrait ? HEAD_BALL : undefined });
        if (portrait) {
          const uniforms = o.material.uniforms;
          o.material = o.material.clone();
          Object.assign(o.material.uniforms, uniforms, { uMap: { value: null }, uHasMap: { value: 0 } });
          Object.assign(o.material.uniforms, this.face.uniforms);
        }
        if (glass) this.noShadow.push(o);
      } else o.material = isBrow ? brows : /eye/i.test(o.name) ? eyes : body;
      o.frustumCulled = false;
      o.userData.noCollide = true;
    });
    char.root.add(model);
    char.root.updateMatrixWorld(true);
    const rootInv = char.root.matrixWorld.clone().invert();

    // bones and their rest pose, in model (character) space
    this.b = {};
    model.traverse((o) => { if (o.isBone) this.b[o.name] = o; });
    if (imported) {
      const aliases = { spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'Head' };
      for (const [source, target] of Object.entries(aliases)) this.b[target] = this.b[source];
      for (const s of ['l', 'r']) {
        for (const [source, target] of Object.entries({ clavicle: 'clavicle', upper_arm: 'upperarm', forearm: 'lowerarm', hand: 'hand', thigh: 'thigh', shin: 'calf', foot: 'foot', toe: 'ball' })) {
          // GLTFLoader sanitizes periods in node names.
          this.b[`${target}_${s}`] = this.b[`${source}${s.toUpperCase()}`] ?? this.b[`${source}.${s.toUpperCase()}`];
        }
      }
    }
    this.rest = new Map();
    for (const bone of Object.values(this.b)) {
      const q = new THREE.Quaternion(), p = new THREE.Vector3();
      _m4.multiplyMatrices(rootInv, bone.matrixWorld).decompose(p, q, _c);   // character space
      this.rest.set(bone, { q, p });
    }
    this.restDir = (a, c) => this.rest.get(this.b[c]).p.clone().sub(this.rest.get(this.b[a]).p).normalize();

    const B = this.b;
    // [bone, child-for-rest-direction, rig points that give the desired direction]
    const chains = [];
    ['r', 'l'].forEach((s, i) => {      // rig index 0 is the character's right
      chains.push({ bone: `thigh_${s}`, child: `calf_${s}`, from: () => char.legs[i], to: () => char.knees[i] });
      chains.push({ bone: `calf_${s}`, child: `foot_${s}`, from: () => char.knees[i], to: () => char.feet[i] });
      chains.push({ bone: `upperarm_${s}`, child: `lowerarm_${s}`, from: () => char.arms[i], to: () => char.elbows[i] });
      chains.push({ bone: `lowerarm_${s}`, child: `hand_${s}`, from: () => char.elbows[i], hand: i });
    });
    this.chains = chains.filter((c) => B[c.bone] && B[c.child]).map((c) => ({ ...c, B: B[c.bone], dir: this.restDir(c.bone, c.child) }));
    // whole-segment orientation follows a rig joint's rotation
    this.follow = [
      ['pelvis', () => char.body], ['spine_01', () => char.torso], ['spine_02', () => char.torso], ['spine_03', () => char.torso],
      ['neck_01', () => char.head], ['Head', () => char.head],
      ['foot_r', () => char.feet[0]], ['foot_l', () => char.feet[1]],
    ].filter(([n]) => B[n]).map(([n, j]) => ({ B: B[n], j }));
    // Blender hand bones run along local +Y. Using the forearm as a substitute
    // loses the bend already present at the wrist in the imported bind pose.
    this.handFrames = imported ? Object.fromEntries(['r', 'l'].map(s => [s, {
      along: new THREE.Vector3(0, 1, 0).applyQuaternion(this.rest.get(B[`hand_${s}`]).q),
      normal: new THREE.Vector3(0, 0, 1),
    }])) : null;
    this.restHipMid = this.rest.get(B.thigh_l).p.clone().add(this.rest.get(B.thigh_r).p).multiplyScalar(0.5);
    this.restPelvis = this.rest.get(B.pelvis).p.clone();

    this.order = [];
    model.traverse((o) => { if (o.isBone) this.order.push(o); });   // parents before children
    this.charQ = new Map();
    this.chainOf = new Map(this.chains.map((c) => [c.B, c]));
    this.followOf = new Map(this.follow.map((f) => [f.B, f]));

    this.dressRig();
  }

  /** Hide the rig's own body; move hood, collar, jetpack and satchel onto the human. */
  dressRig() {
    const c = this.char, B = this.b;
    const keep = new Set();
    // anchors at the head and shoulders, oriented like the character
    const anchor = (bone, charPos) => {
      const g = new THREE.Group();
      g.position.copy(charPos);
      c.root.add(g);
      c.root.updateMatrixWorld(true);
      bone.attach(g);     // keeps its character-space placement at the rest pose
      return g;
    };
    this.update(true);  // make sure the skeleton is at rest before anchoring
    const restHead = this.rest.get(B.Head).p;
    this.headAnchor = anchor(B.Head, new THREE.Vector3(0, restHead.y + 0.1, restHead.z + 0.01));
    this.chestAnchor = anchor(B.spine_03, new THREE.Vector3(0, this.rest.get(B.neck_01).p.y - 0.74 - 0.02, 0));
    const move = (obj, parent, pos) => { parent.add(obj); if (pos) obj.position.copy(pos); obj.traverse((o) => keep.add(o)); };
    this.hood = [];
    if (this.imported) {
      move(c.jetpack, this.chestAnchor, new THREE.Vector3(0, 0.52, -0.33));
      c.root.traverse((o) => {
        if (o.isMesh && !keep.has(o) && !this.model.getObjectById(o.id)) o.visible = false;
      });
      c.capeAnchor = this.chestAnchor;
      return;
    }
    // the hood (and its peak) were children of the rig head
    for (const child of [...c.head.children]) {
      if (child.isMesh && child.geometry.type === 'SphereGeometry' && child.material.side === THREE.DoubleSide) {
        move(child, this.headAnchor, new THREE.Vector3(0, 0, -0.02));
        child.scale.multiplyScalar(0.92);
        this.hood.push(child);
      } else if (child.isGroup) { move(child, this.headAnchor, new THREE.Vector3(0, 0.12, -0.04)); this.hood.push(child); }
    }
    // collar + jetpack + satchel lived on the rig torso
    for (const child of [...c.torso.children]) {
      if (child.isMesh && child.geometry.type === 'TorusGeometry' && Math.abs(child.position.y - 0.74) < 0.01) move(child, this.chestAnchor);
      else if (child === c.jetpack) move(child, this.chestAnchor, new THREE.Vector3(0, 0.52, -0.33));
      else if (child === c.pack) move(child, this.chestAnchor, new THREE.Vector3(0, 0.3, 0));
    }
    c.jetpack.scale.setScalar(0.92);
    // everything else of the rig is now an invisible armature
    c.root.traverse((o) => {
      if (o.isMesh && !keep.has(o) && !this.model.getObjectById(o.id)) o.visible = false;
    });
    // the cape pins under the human's collar
    c.capeAnchor = this.chestAnchor;
  }

  /**
   * Swap the hood for other headwear: 'hood' | 'hat' | 'wrap' | 'hair'.
   * The head anchor sits at the centre of the skull, facing +z.
   */
  setHeadwear(kind, { color = '#d8a24a', hair = '#3a2a22', accent = '#c8483a' } = {}) {
    for (const h of this.hood) h.visible = kind === 'hood';
    if (kind === 'hood') return;
    const A = this.headAnchor;
    const mat = (c, o = {}) => makeMaterial({ color: c, ...o });
    const add = (geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.userData.noCollide = true; A.add(mesh); return mesh; };
    // short hair under any hat, a fuller cut for bare heads
    const cap = new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    cap.scale(1, 1.08, 1.12);
    add(cap, mat(hair), 0, 0.012, -0.012).rotation.x = -0.32;
    if (kind === 'short') { /* just the short crop */ }
    else if (kind === 'hair') {
      const style = Math.random();
      if (style < 0.5) add(new THREE.SphereGeometry(0.045, 10, 8), mat(hair), 0, 0.12, -0.06);                 // top-knot
      else {
        const tail = add(new THREE.CapsuleGeometry(0.03, 0.18, 4, 8), mat(hair), 0, -0.06, -0.12);              // ponytail
        tail.rotation.x = 0.35;
      }
    } else if (kind === 'hat') {
      // wide flat desert hat with a tall crown, tilted a little
      const brim = add(new THREE.CylinderGeometry(0.3, 0.3, 0.014, 22), mat(color), 0, 0.075, 0);
      const crown = add(new THREE.CylinderGeometry(0.075, 0.12, 0.17, 14), mat(color), 0, 0.16, 0);
      add(new THREE.CylinderGeometry(0.121, 0.124, 0.03, 14), mat(accent), 0, 0.09, 0);
      brim.rotation.z = crown.rotation.z = (Math.random() - 0.5) * 0.2;
    } else if (kind === 'wizard') {
      // the tall pointed hat with a wide brim, its tip bending back a little
      add(new THREE.CylinderGeometry(0.4, 0.4, 0.012, 28), mat(color), 0, 0.07, 0).rotation.x = -0.06;
      add(new THREE.CylinderGeometry(0.13, 0.142, 0.05, 18), mat(color), 0, 0.095, 0);
      const crown = add(new THREE.ConeGeometry(0.13, 0.42, 18, 1, true), mat(color, { side: THREE.DoubleSide }), 0, 0.33, -0.01);
      crown.rotation.x = -0.08;
      const tipPivot = new THREE.Group();
      tipPivot.position.set(0, 0.53, -0.03);
      tipPivot.rotation.x = -0.32;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 12), mat(color));
      tip.position.y = 0.13;
      tip.userData.noCollide = true;
      tipPivot.add(tip);
      A.add(tipPivot);
      this.hatTip = tipPivot;
    } else if (kind === 'wrap') {
      // head-wrap: stacked twisted rolls and a trailing tail
      for (let k = 0; k < 3; k++) {
        const t = add(new THREE.TorusGeometry(0.11 - k * 0.02, 0.032, 8, 18), mat(k % 2 ? accent : color, { flat: true }), 0, 0.045 + k * 0.045, -0.01);
        t.rotation.set(Math.PI / 2 + 0.15, 0, k * 0.4);
      }
      const tail = add(new THREE.BoxGeometry(0.07, 0.32, 0.01), mat(color, { side: THREE.DoubleSide }), 0.02, -0.08, -0.12);
      tail.rotation.set(0.25, 0.3, 0.1);
    }
  }

  /** Aim the skeleton along the rig (call after the rig's pose for this frame). */
  update(atRest = false) {
    const c = this.char, root = c.root;
    if (atRest) {   // restore the bind pose
      const rootInv = _m4.copy(root.matrixWorld).invert();
      for (const bone of this.order) {
        const r = this.rest.get(bone), pq = bone.parent?.isBone ? this.rest.get(bone.parent).q : _q.identity();
        bone.quaternion.copy(_qr.copy(pq).invert().multiply(r.q));
      }
      this.model.updateMatrixWorld(true);
      return;
    }
    root.updateMatrixWorld(true);
    const rootQi = root.getWorldQuaternion(_qp).invert();
    const charQOf = (o, out) => o.getWorldQuaternion(out).premultiply(rootQi);
    const charPosOf = (o, out) => root.worldToLocal(o.getWorldPosition(out));

    // pelvis position: the rig's hip midpoint, keeping the model's hip→pelvis offset
    const hipMid = charPosOf(c.legs[0], _a).add(charPosOf(c.legs[1], _b)).multiplyScalar(0.5);
    const pelvisChar = hipMid.add(_c.copy(this.restPelvis).sub(this.restHipMid));

    for (const bone of this.order) {
      const parentQ = bone.parent?.isBone ? this.charQ.get(bone.parent) : _q.identity();
      const rest = this.rest.get(bone);
      let q = null;
      const f = this.followOf.get(bone), ch = this.chainOf.get(bone);
      if (ch) {
        // minimal rotation of the bone's rest direction onto the rig limb
        const from = charPosOf(ch.from(), _a);
        const to = ch.hand !== undefined ? root.worldToLocal(c.elbows[ch.hand].localToWorld(_b.set(0, -0.31, 0))) : charPosOf(ch.to(), _b);
        const want = to.sub(from).normalize();
        q = new THREE.Quaternion().setFromUnitVectors(ch.dir, want).multiply(rest.q);
      } else if (f) {
        // rig joint's rotation (its rest is identity in character space)
        q = charQOf(f.j(), new THREE.Quaternion()).multiply(rest.q);
      }
      if (q) {
        bone.quaternion.copy(_qr.copy(parentQ).invert().multiply(q));
        this.charQ.set(bone, q);
      } else {
        this.charQ.set(bone, (this.charQ.get(bone) ?? new THREE.Quaternion()).copy(parentQ).multiply(bone.quaternion));
      }
      if (bone === this.b.pelvis && !atRest) {
        bone.parent.updateMatrixWorld(true);
        _m4.copy(bone.parent.matrixWorld).invert().multiply(root.matrixWorld);
        bone.position.copy(pelvisChar).applyMatrix4(_m4);
      }
    }
    this.model.updateMatrixWorld(true);
  }

  /** Preserve wrist rotation from the source clip instead of leaving T-pose hands. */
  poseHands(animator) {
    const rootQ = this.char.root.getWorldQuaternion(new THREE.Quaternion());
    for (const s of ['r', 'l']) {
      const hand = this.b[`hand_${s}`];
      if (this.imported) {
        const source = animator.handFrames[s], rest = this.handFrames[s];
        const q = animator.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQ);
        this.orientContact(hand, rest.along, rest.normal,
          source.along.clone().applyQuaternion(q), source.normal.clone().applyQuaternion(q));
        continue;
      }
      const q = animator.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion())
        .multiply(animator.restHands[s].clone().invert()).multiply(this.rest.get(hand).q).premultiply(rootQ);
      hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
      hand.updateMatrixWorld(true);
    }
  }

  // ------------------------------------------------------------------ IK
  /** Rotate a bone (in world space) so its direction `from` turns to `to`. */
  turnBone(bone, from, to) {
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
    const q = _iq.setFromUnitVectors(from.normalize(), to.normalize());
    const wq = bone.getWorldQuaternion(_iq2).premultiply(q);
    const pq = bone.parent.getWorldQuaternion(_iq3);
    bone.quaternion.copy(pq.invert().multiply(wq));
    bone.updateMatrixWorld(true);
  }

  /** Two-bone IK: a (root), b (mid), c (end) so c reaches `target`, bending toward `pole` (world). */
  solveTwoBone(a, b, c, target, pole, weight = 1) {
    if (weight <= 0.001) return;
    const A = a.getWorldPosition(_i1), B = b.getWorldPosition(_i2), C = c.getWorldPosition(_i3);
    const la = A.distanceTo(B), lb = B.distanceTo(C);
    const T = _i4.copy(C).lerp(target, weight);
    const dir = _i5.subVectors(T, A);
    const d = THREE.MathUtils.clamp(dir.length(), Math.abs(la - lb) + 1e-3, (la + lb) * 0.999);
    dir.normalize();
    const along = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(la * la - along * along, 0));
    const pd = _i6.subVectors(pole, A);
    pd.addScaledVector(dir, -pd.dot(dir));
    if (pd.lengthSq() < 1e-8) pd.subVectors(B, A).addScaledVector(dir, -_i7.subVectors(B, A).dot(dir));
    pd.normalize();
    const newB = _i7.copy(A).addScaledVector(dir, along).addScaledVector(pd, h);
    this.turnBone(a, _i8.subVectors(B, A), _i9.subVectors(newB, A));
    const B2 = b.getWorldPosition(_i2), C2 = c.getWorldPosition(_i3);
    const endT = _i1.copy(A).addScaledVector(dir, d);
    this.turnBone(b, _i8.subVectors(C2, B2), _i9.subVectors(endT, B2));
  }

  /**
   * Plant the feet: a foot that comes down in the clip is locked to the real
   * ground where it lands and held there while the body moves over it (no
   * sliding, no sinking); swinging feet are kept above the ground; the pelvis
   * drops when a locked foot is out of reach. Calls onStep(groundPoint) on
   * each touchdown.
   */
  plantFeet(dt, physics, up, rootPos, fwd, onStep) {
    const B = this.b;
    const S = (this._feet ??= { l: { locked: false, w: 0, pos: new THREE.Vector3() }, r: { locked: false, w: 0, pos: new THREE.Vector3() }, drop: 0 });
    const H0 = this.rest.get(B.foot_l).p.y;        // ankle height above the sole at rest
    const targets = {};
    let need = 0;
    for (const s of ['l', 'r']) {
      const F = S[s];
      // contact is judged at the ball of the foot (the heel rolls up first)
      const ankle = B[`foot_${s}`].getWorldPosition(new THREE.Vector3());
      const ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3());
      const ballRest = this.rest.get(B[`ball_${s}`]).p.y;
      const hBall = _i1.subVectors(ball, rootPos).dot(up);
      const hClip = _i1.subVectors(ankle, rootPos).dot(up);
      const rising = F.lastHeight !== undefined && hBall - F.lastHeight > dt * 0.12;
      const planted = hBall < ballRest + (F.locked ? 0.09 : 0.04) && !rising;
      F.lastHeight = hBall;
      const gh = physics.heightAbove(_i2.copy(ball).addScaledVector(up, 1.2), up, 0);
      const groundH = Number.isFinite(gh) ? 1.2 - gh : -hBall;          // ball -> real ground
      if (!planted) F.released = false;
      if (planted && !F.locked && !F.released && Number.isFinite(gh)) {
        F.locked = true;
        F.pos.copy(ball).addScaledVector(up, groundH + ballRest);
        // the slope under the foot: the sole and the footprint lie along it
        F.n = physics.groundNormal(ball.x, ball.y + 1.2, ball.z, F.n ?? new THREE.Vector3());
        if (F.n.dot(up) < 0.5) F.n.copy(up);
        onStep?.(_i3.copy(ball).addScaledVector(up, groundH), s, F.n);
      } else if (!planted) F.locked = false;
      if (F.locked && F.pos.distanceTo(ball) > 0.45) { F.locked = false; F.released = true; }
      F.w += ((F.locked ? 1 : 0) - F.w) * (1 - Math.exp(-28 * dt));
      // ankle target: keep the clip's heel roll around the locked ball
      const locked = _i4.copy(F.pos).add(_i5.subVectors(ankle, ball));
      const swing = ankle.clone().addScaledVector(up, THREE.MathUtils.clamp(groundH + hBall, -0.25, 0.3));
      const t = swing.lerp(locked, F.w);
      targets[s] = t;
      const hip = B[`thigh_${s}`].getWorldPosition(_i4);
      const reach = hip.distanceTo(t) - (this.legLen ??= this.rest.get(B[`thigh_${s}`]).p.distanceTo(this.rest.get(B[`calf_${s}`]).p) + this.rest.get(B[`calf_${s}`]).p.distanceTo(this.rest.get(B[`foot_${s}`]).p)) * 0.985;
      need = Math.max(need, reach);
    }
    S.drop += (THREE.MathUtils.clamp(need, 0, 0.12) - S.drop) * (1 - Math.exp(-16 * dt));
    if (S.drop > 0.002) {
      // lower the pelvis (world down) and refresh the chain
      const p = B.pelvis;
      const down = _i5.copy(up).multiplyScalar(-S.drop);
      const parentInv = _im.copy(p.parent.matrixWorld).invert();
      const wp = p.getWorldPosition(_i6).add(down).applyMatrix4(parentInv);
      p.position.copy(wp);
      p.updateMatrixWorld(true);
    }
    for (const s of ['l', 'r']) {
      const foot = B[`foot_${s}`];
      const fq = foot.getWorldQuaternion(new THREE.Quaternion());
      const knee = B[`calf_${s}`].getWorldPosition(new THREE.Vector3());
      const pole = knee.addScaledVector(fwd, 0.6);
      this.solveTwoBone(B[`thigh_${s}`], B[`calf_${s}`], foot, targets[s], pole);
      // the foot keeps the clip's orientation, tilted onto the slope while planted
      const F = S[s];
      if (F.n && F.w > 0.01) fq.premultiply(_iq.setFromUnitVectors(up, F.n).slerp(_iq2.identity(), 1 - F.w));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(_iq3).invert().multiply(fq));
      foot.updateMatrixWorld(true);
    }
  }

  resetFeet() { if (this._feet) { this._feet.l.locked = this._feet.r.locked = false; this._feet.l.w = this._feet.r.w = 0; this._feet.drop = 0; this._feet.l.released = this._feet.r.released = false; this._feet.l.lastHeight = this._feet.r.lastHeight = undefined; } }

  /** Match a contact's direction and surface normal, including its rest-pose twist. */
  orientContact(bone, restDirection, restNormal, direction, normal) {
    const basis = (along, facing) => {
      const y = along.clone().normalize();
      const z = facing.clone().addScaledVector(y, -facing.dot(y)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    };
    const world = basis(direction, normal).multiply(basis(restDirection, restNormal).invert()).multiply(this.rest.get(bone).q);
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    bone.updateMatrixWorld(true);
  }

  /** Climbing: hands and feet onto wall points (world), elbows out, knees off the wall. */
  reach({ hands, feet, wallN, up, wallContact = false }) {
    const B = this.b;
    ['r', 'l'].forEach((s, i) => {
      const side = i === 0 ? -1 : 1;
      if (hands?.[i]) {
        const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
        const right = _i5.crossVectors(up, wallN).normalize();   // character's left, seen from the wall
        const pole = sh.addScaledVector(right, side * 0.6).addScaledVector(up, -0.4).addScaledVector(wallN, 0.4);
        const hand = B[`hand_${s}`], q = hand.getWorldQuaternion(new THREE.Quaternion());
        this.solveTwoBone(B[`upperarm_${s}`], B[`lowerarm_${s}`], hand, hands[i], pole);
        hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
        hand.updateMatrixWorld(true);
        if (wallContact) {
          const origin = this.rest.get(hand).p;
          const fingers = this.imported
            ? this.handFrames[s].along.clone()
            : this.rest.get(B[`middle_01_${s}`]).p.clone().sub(origin).normalize();
          const span = this.imported ? null : this.rest.get(B[`index_01_${s}`]).p.clone().sub(this.rest.get(B[`pinky_01_${s}`]).p);
          const palm = this.imported ? this.handFrames[s].normal.clone() : new THREE.Vector3().crossVectors(fingers, span).normalize();
          if (palm.y > 0) palm.negate();
          this.orientContact(hand, fingers, palm, up, wallN.clone().negate());
        }
      }
      if (feet?.[i]) {
        const hip = B[`thigh_${s}`].getWorldPosition(new THREE.Vector3());
        const pole = hip.addScaledVector(wallN, 0.8).addScaledVector(up, 0.3);
        this.solveTwoBone(B[`thigh_${s}`], B[`calf_${s}`], B[`foot_${s}`], feet[i], pole);
        if (wallContact) {
          const foot = B[`foot_${s}`];
          const toes = this.rest.get(B[`ball_${s}`]).p.clone().sub(this.rest.get(foot).p).normalize();
          this.orientContact(foot, toes, new THREE.Vector3(0, 1, 0), wallN.clone().negate().addScaledVector(up, 0.35).normalize(), up);
        }
      }
    });
  }

  /** Body capsules (world space) for cloth collision. */
  capsules() {
    const B = this.b;
    // [from bone, to bone (or point offset), radius]; radii include the cloth's thickness
    const spec = this._spec ??= [
      ['pelvis', 'spine_03', 0.2], ['spine_03', 'neck_01', 0.17], ['clavicle_l', 'clavicle_r', 0.12],
      ['thigh_l', 'calf_l', 0.12], ['calf_l', 'foot_l', 0.1], ['foot_l', 'ball_l', 0.08],
      ['thigh_r', 'calf_r', 0.12], ['calf_r', 'foot_r', 0.1], ['foot_r', 'ball_r', 0.08],
      ['upperarm_l', 'lowerarm_l', 0.08], ['lowerarm_l', 'hand_l', 0.07],
      ['upperarm_r', 'lowerarm_r', 0.08], ['lowerarm_r', 'hand_r', 0.07],
    ].filter(([a, b]) => B[a] && B[b]);
    if (!this._caps) this._caps = spec.map(([, , r]) => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), r }));
    spec.forEach(([a, b], i) => { B[a].getWorldPosition(this._caps[i].a); B[b].getWorldPosition(this._caps[i].b); });
    return this._caps;   // the jetpack sits on top of the cloth, so it isn't a collider
  }
}
