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
  cache[kind] ??= new GLTFLoader().loadAsync(MODELS[kind]).then((g) => g.scene);
  return cache[kind];
}

// rest-pose regions per model (metres): bootTop, beltY, neckY, wristX
const OUTFIT = { m: [0.13, 0.97, 1.47, 0.64], f: [0.12, 0.95, 1.44, 0.58] };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();

export class Humanoid {
  /**
   * @param template loadHuman() result
   * @param char     the rig from buildCharacter()
   * @param kind     'm' | 'f'
   */
  constructor(template, char, kind = 'm', { skin = '#e8c6a8', hair = '#2b211f' } = {}) {
    this.char = char;
    const model = cloneSkinned(template);
    this.model = model;
    const C = char.colors;
    const body = makeMaterial({ color: C.cloth, color2: C.legs, color3: C.boot ?? '#6e3f2c', mode: MODE_OUTFIT, skin, outfit: OUTFIT[kind] });
    const eyes = makeMaterial({ color: C.ink });
    const brows = makeMaterial({ color: hair });
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = /eye(?!brow)/i.test(o.name) ? eyes : /brow/i.test(o.name) ? brows : body;
      o.frustumCulled = false;
      o.userData.noCollide = true;
    });
    char.root.add(model);
    char.root.updateMatrixWorld(true);
    const rootInv = char.root.matrixWorld.clone().invert();

    // bones and their rest pose, in model (character) space
    this.b = {};
    model.traverse((o) => { if (o.isBone) this.b[o.name] = o; });
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
    // the hood (and its peak) were children of the rig head
    for (const child of [...c.head.children]) {
      if (child.isMesh && child.geometry.type === 'SphereGeometry' && child.material.side === THREE.DoubleSide) {
        move(child, this.headAnchor, new THREE.Vector3(0, 0, -0.02));
        child.scale.multiplyScalar(0.92);
      } else if (child.isGroup) move(child, this.headAnchor, new THREE.Vector3(0, 0.12, -0.04));
    }
    // collar + jetpack + satchel lived on the rig torso
    for (const child of [...c.torso.children]) {
      if (child.isMesh && child.geometry.type === 'TorusGeometry' && Math.abs(child.position.y - 0.74) < 0.01) move(child, this.chestAnchor);
      else if (child === c.jetpack) move(child, this.chestAnchor, new THREE.Vector3(0, 0.52, -0.22));
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

  /** Body capsules (world space) for cloth collision. */
  capsules() {
    const B = this.b;
    if (!this._caps) {
      this._caps = [{ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.19 }];
      for (let i = 0; i < 4; i++) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: i % 2 ? 0.08 : 0.1 });
    }
    const K = this._caps;
    B.pelvis.getWorldPosition(K[0].a);
    B.spine_03.getWorldPosition(K[0].b);
    ['r', 'l'].forEach((s, i) => {
      B[`thigh_${s}`].getWorldPosition(K[1 + i * 2].a);
      B[`calf_${s}`].getWorldPosition(K[1 + i * 2].b);
      K[2 + i * 2].a.copy(K[1 + i * 2].b);
      B[`foot_${s}`].getWorldPosition(K[2 + i * 2].b);
    });
    return K;
  }
}
