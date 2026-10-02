import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// Motion from Quaternius' Universal Animation Library (CC0, public/anim/),
// retargeted onto our hand-built rider rig.
//
// A hidden copy of the library skeleton plays the clips. Each frame, every
// limb of ours is aimed along the same direction the matching library bone
// has moved to *relative to its rest pose* (so differing proportions and rest
// orientations don't matter); the hips' motion becomes the body bob/sway.
// Locomotion blends idle → walk → jog → sprint by speed, all locked to one
// shared gait phase, and each clip's playback rate is set from its measured
// stride so the feet don't skate.

// GLTFLoader sanitises node names ("DEF-foot.L" -> "DEF-footL")
const byName = (root, n) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));

const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop',
  jumpStart: 'Jump_Start', jumpLoop: 'Jump_Loop', jumpLand: 'Jump_Land', drive: 'Driving_Loop', talk: 'Idle_Talking_Loop' };

let libPromise = null;
/** Load the clip library once; resolves to { scene, clips, native } (native = ground speed per loop). */
export function loadAnimationLibrary(url = 'anim/ual.glb') {
  libPromise ??= new GLTFLoader().loadAsync(url).then((gltf) => {
    const clips = {};
    for (const [k, name] of Object.entries(CLIPS)) clips[k] = gltf.animations.find((a) => a.name === name);
    const lib = { scene: gltf.scene, clips, native: {} };
    for (const k of ['walk', 'jog', 'sprint']) lib.native[k] = measureGroundSpeed(lib, clips[k]);
    return lib;
  });
  return libPromise;
}

// How fast the ground moves under a planted foot in an in-place loop.
function measureGroundSpeed(lib, clip) {
  const s = cloneSkeleton(lib.scene);
  const mixer = new THREE.AnimationMixer(s);
  mixer.clipAction(clip).play();
  const feet = ['DEF-foot.L', 'DEF-foot.R'].map((n) => byName(s, n));
  const N = 120, dt = clip.duration / N, samples = [];
  const prev = feet.map(() => new THREE.Vector3()), cur = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    mixer.setTime(i * dt);
    s.updateMatrixWorld(true);
    feet.forEach((f, k) => {
      f.getWorldPosition(cur);
      if (i > 0) samples.push({ y: cur.y, vz: (cur.z - prev[k].z) / dt });
      prev[k].copy(cur);
    });
  }
  samples.sort((a, b) => a.y - b.y);
  const low = samples.slice(0, Math.floor(samples.length * 0.3));   // planted
  return Math.abs(low.reduce((a, b) => a + b.vz, 0) / low.length);
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3();
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);

export class Animator {
  /** @param lib result of loadAnimationLibrary(); @param char a buildCharacter() rig */
  constructor(lib, char) {
    this.lib = lib;
    this.char = char;
    this.src = cloneSkeleton(lib.scene);
    this.mixer = new THREE.AnimationMixer(this.src);
    this.actions = {};
    for (const [k, clip] of Object.entries(lib.clips)) {
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      this.actions[k] = a;
    }
    for (const k of ['jumpStart', 'jumpLand']) {
      const a = this.actions[k];
      if (a) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    }
    this.bone = (n) => byName(this.src, n);
    // our joint ← library chain (from, to), our joint's rest axis
    const C = char;
    const map = [
      { j: C.torso, a: 'DEF-spine.001', b: 'DEF-spine.003', axis: UP },
      { j: C.head, a: 'DEF-neck', b: 'DEF-head', axis: UP },
    ];
    // our index 0 is the -x side, which is the character's right
    ['R', 'L'].forEach((s, i) => {
      map.push({ j: C.arms[i], a: `DEF-upper_arm.${s}`, b: `DEF-forearm.${s}`, axis: DOWN });
      map.push({ j: C.elbows[i], a: `DEF-forearm.${s}`, b: `DEF-hand.${s}`, axis: DOWN });
      map.push({ j: C.legs[i], a: `DEF-thigh.${s}`, b: `DEF-shin.${s}`, axis: DOWN });
      map.push({ j: C.knees[i], a: `DEF-shin.${s}`, b: `DEF-foot.${s}`, axis: DOWN });
      map.push({ j: C.feet[i], a: `DEF-foot.${s}`, b: `DEF-toe.${s}`, axis: FWD, foot: true });
    });
    this.map = map.map((m) => ({ ...m, A: this.bone(m.a), B: this.bone(m.b), rest: new THREE.Vector3() }));
    this.hips = this.bone('DEF-hips');
    // rest directions from the T-pose
    this.mixer.stopAllAction();
    this.src.updateMatrixWorld(true);
    for (const m of this.map) m.rest.copy(this.dir(m.A, m.B, _a));
    this.restHips = this.hips.getWorldPosition(new THREE.Vector3());
    this.restHipsQ = this.hips.getWorldQuaternion(new THREE.Quaternion());
    for (const a of Object.values(this.actions)) a.play();
    this.phase = 0;
    this.w = { idle: 1, walk: 0, jog: 0, sprint: 0, air: 0, drive: 0, talk: 0, jumpLand: 0 };
    this.airState = null;
  }

  dir(A, B, out) {
    A.getWorldPosition(_r);
    return B.getWorldPosition(out).sub(_r).normalize();
  }

  /**
   * @param s.speed horizontal speed (m/s), s.onGround, s.vy (up velocity),
   *          s.mode 'ground' | 'drive' | 'talk'
   */
  update(dt, s) {
    const L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    const N = this.lib.native;
    const sp = s.speed;
    // target weights for the locomotion blend (piecewise between clip speeds)
    const tw = { idle: 0, walk: 0, jog: 0, sprint: 0, air: 0, drive: 0, talk: 0, jumpLand: 0 };
    // landing from a real fall: play the land clip for a beat
    if (s.onGround && this._wasAir && this._airT > 0.45 && this.actions.jumpLand) { this.landT = 0; this.actions.jumpLand.reset().play(); }
    this._airT = s.onGround ? 0 : (this._airT ?? 0) + dt;
    this._wasAir = !s.onGround;
    const landing = this.landT !== undefined && this.landT < 0.45;
    if (landing) { this.landT += dt; this.actions.jumpLand.time = this.landT * 1.3 + 0.1; }
    if (s.mode === 'drive') tw.drive = 1;
    else if (!s.onGround) tw.air = 1;
    else if (sp < 0.25) tw[s.mode === 'talk' ? 'talk' : 'idle'] = 1;
    else {
      const stops = [['idle', 0], ['walk', s.walkAt], ['jog', s.jogAt], ['sprint', s.sprintAt]];
      let k = 0;
      while (k < stops.length - 2 && sp > stops[k + 1][1]) k++;
      const t = THREE.MathUtils.clamp((sp - stops[k][1]) / (stops[k + 1][1] - stops[k][1]), 0, 1);
      tw[stops[k][0]] = 1 - t;
      tw[stops[k + 1][0]] = t;
    }
    if (landing && sp < 3) { for (const k in tw) tw[k] *= 0.15; tw.jumpLand = 0.85; }
    const kk = 1 - Math.exp(-10 * dt);
    for (const key in this.w) this.w[key] = L(this.w[key], tw[key], kk);

    // one shared gait phase: cycles per second = speed / stride, stride from the
    // clip that dominates (each clip's native stride = native speed * duration)
    const gaitKeys = ['walk', 'jog', 'sprint'];
    let wsum = 0, stride = 0;
    for (const k of gaitKeys) { wsum += this.w[k]; stride += this.w[k] * N[k] * this.lib.clips[k].duration; }
    if (wsum > 0.01) {
      stride /= wsum;
      // lengthen the stride a little at game speeds, so cadence stays human
      const cps = sp / Math.max(stride * s.strideScale, 0.3);
      this.phase = (this.phase + cps * dt) % 1;
    }
    for (const k of gaitKeys) this.actions[k].time = this.phase * this.lib.clips[k].duration;
    // idle / talk / drive loop at their own pace
    for (const k of ['idle', 'talk', 'drive']) {
      const a = this.actions[k];
      if (a) a.time = (a.time + dt) % this.lib.clips[k].duration;
    }
    // air: start → loop → land
    const air = this.actions.jumpLoop;
    if (air) air.time = (air.time + dt) % this.lib.clips.jumpLoop.duration;

    for (const [k, a] of Object.entries(this.actions)) {
      const key = k === 'jumpLoop' ? 'air' : k;
      a.setEffectiveWeight(this.w[key] ?? 0);
    }
    this.mixer.update(0);
    this.src.updateMatrixWorld(true);
  }

  /** Copy the sampled pose onto our rig. root = the character's root Object3D. */
  apply(root, { lean = 0, bank = 0, drop = 0, legScale = 1 } = {}) {
    const C = this.char;
    // body: hip motion relative to rest (bob, sway, rotation)
    const hp = this.hips.getWorldPosition(_a);
    const hq = this.hips.getWorldQuaternion(_q);
    _q2.copy(this.restHipsQ).invert().premultiply(hq);   // hq * rest^-1
    C.body.position.set((hp.x - this.restHips.x) * 0.6, (hp.y - this.restHips.y) * legScale - drop, 0);
    C.body.quaternion.setFromEuler(new THREE.Euler(lean, 0, bank)).multiply(_q2.slerp(_qp.identity(), 0.5));
    root.updateMatrixWorld(true);
    const rootQ = root.getWorldQuaternion(_qp);
    for (const m of this.map) {
      // limbs follow the library bone's absolute direction (both rigs face +Z,
      // y up); feet are corrected by the library foot's rest pitch so a flat
      // library foot gives a flat boot
      const cur = this.dir(m.A, m.B, _b);
      const desiredChar = m.foot ? cur.clone().applyQuaternion(_q.setFromUnitVectors(m.rest, FWD)) : cur.clone();
      // character space → world → the joint's parent space
      const world = desiredChar.applyQuaternion(rootQ);
      m.j.parent.getWorldQuaternion(_q2);
      const local = world.applyQuaternion(_q2.invert());
      if (m.foot) {
        // keep the boot level side-to-side: build a basis from forward + parent up
        _z.copy(local).normalize();
        _y.set(0, 1, 0);
        _x.crossVectors(_y, _z).normalize();
        _y.crossVectors(_z, _x);
        m.j.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
      } else {
        m.j.quaternion.setFromUnitVectors(m.axis, local.normalize());
      }
      m.j.updateMatrixWorld(true);
    }
  }
}
