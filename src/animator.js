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

// The library uses the UE mannequin bone names (pelvis, spine_01, thigh_l…).
const byName = (root, n) => root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));

const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop',
  jumpStart: 'Jump_Start', jumpLoop: 'Jump_Loop', jumpLand: 'Jump_Land', drive: 'Driving_Loop', talk: 'Idle_Talking_Loop',
  look: 'Idle_LookAround_Loop', ledge: 'ClimbLedge',
  climbIdle: 'Climb_Idle_Loop', climbUp: 'Climb_Up_Loop', climbDown: 'Climb_Down_Loop', climbLeft: 'Climb_Left_Loop', climbRight: 'Climb_Right_Loop' };
const CLIMB = ['climbIdle', 'climbUp', 'climbDown', 'climbLeft', 'climbRight'];

let libPromise = null;
/** Load the clip library once; resolves to { scene, clips, native } (native = ground speed per loop). */
export function loadAnimationLibrary(url = 'anim/ual.glb') {
  libPromise ??= new GLTFLoader().loadAsync(url).then(libraryFrom);
  return libPromise;
}

/** The library from a parsed ual.glb (loadAnimationLibrary; tests parse the file themselves). */
export function libraryFrom(gltf) {
  const clips = {};
  for (const [k, name] of Object.entries(CLIPS)) clips[k] = gltf.animations.find((a) => a.name === name);
  // (all: every clip in the file, for the character studio's clip list)
  const lib = { scene: gltf.scene, clips, native: {}, all: gltf.animations };
  for (const k of ['walk', 'jog', 'sprint']) lib.native[k] = measureGroundSpeed(lib, clips[k]);
  return lib;
}

// How much of each loop's own stride a step covers in the game: the jog's stance sweeps the foot
// back fast (it has a long flight) and the sprint's too, so their strides are shortened (Humanoid.
// plantFeet warps the feet's swing toward the body by the same amount) and their cadence stays
// human: ~1.2 cycles a second jogging at 3.8 m/s, ~1.5 running at 7.2.
export const STRIDE_K = { walk: 0.8, jog: 0.55, sprint: 0.75 };
const CONTACT_N = 64;

/**
 * The loops' feet, measured once on the library skeleton (lib.gait): each loop's true stance
 * speed (the ball of the planted foot, relative to the pelvis, in library metres a second at
 * rate 1), and for each foot a contact curve over the gait phase (1 on the ground, 0 in the air),
 * which is what plants a foot (Humanoid.plantFeet): the phase says when, not the foot's height
 * from frame to frame. legLength: the library's hip-to-ankle, for scaling to other bodies.
 */
export function analyseGait(lib) {
  if (lib.gait !== undefined) return lib.gait;
  const keys = ['walk', 'jog', 'sprint'].filter((k) => lib.clips[k]);
  if (keys.length < 3) return (lib.gait = null);
  const s = cloneSkeleton(lib.scene), by = (n) => byName(s, n);
  const mixer = new THREE.AnimationMixer(s);
  const at = (n) => by(n).getWorldPosition(new THREE.Vector3());
  s.updateMatrixWorld(true);
  const legLength = at('thigh_l').distanceTo(at('calf_l')) + at('calf_l').distanceTo(at('foot_l'));
  const gait = { legLength, clips: {} };
  const pel = new THREE.Vector3(), cur = new THREE.Vector3();
  for (const k of keys) {
    const clip = lib.clips[k], action = mixer.clipAction(clip);
    action.play();
    const N = CONTACT_N, dt = clip.duration / N;
    const h = { l: new Float32Array(N), r: new Float32Array(N) }, vz = { l: new Float32Array(N), r: new Float32Array(N) };
    const prev = { l: null, r: null };
    for (let i = -1; i < N; i++) {
      mixer.setTime(((i + N) % N) * dt);
      s.updateMatrixWorld(true);
      by('pelvis').getWorldPosition(pel);
      for (const f of ['l', 'r']) {
        by(`ball_${f}`).getWorldPosition(cur);
        const z = cur.z - pel.z;
        if (i >= 0) { h[f][i] = cur.y; vz[f][i] = (z - prev[f]) / dt; }
        prev[f] = z;
      }
    }
    action.stop();
    const contact = {}, speeds = [];
    for (const f of ['l', 'r']) {
      let min = Infinity;
      for (const y of h[f]) min = Math.min(min, y);
      contact[f] = new Float32Array(N);
      // on the ground: within 3 cm of the foot's lowest, and going back under the body
      for (let i = 0; i < N; i++) {
        const c = 1 - THREE.MathUtils.smoothstep(h[f][i] - min, 0.025, 0.05);
        contact[f][i] = vz[f][i] < 0.05 ? c : 0;
        if (h[f][i] - min < 0.012) speeds.push(-vz[f][i]);
      }
    }
    // and how far (in phase) each sample is from that foot's next touchdown (0 while it is down)
    const lead = {};
    for (const f of ['l', 'r']) {
      lead[f] = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let j = 0;
        while (j < N && contact[f][(i + j) % N] < 0.5) j++;
        lead[f][i] = j / N;
      }
    }
    speeds.sort((a, b) => a - b);
    gait.clips[k] = { speed: speeds[Math.floor(speeds.length / 2)] ?? 1, duration: clip.duration, contact, lead };
  }
  mixer.stopAllAction();
  return (lib.gait = gait);
}

/** A contact curve's value at phase p (0..1), interpolated. */
function contactAt(curve, p) {
  const N = curve.length, x = (((p % 1) + 1) % 1) * N, i = Math.floor(x) % N, t = x - Math.floor(x);
  return curve[i] * (1 - t) + curve[(i + 1) % N] * t;
}

// How fast the ground moves under a planted foot in an in-place loop.
function measureGroundSpeed(lib, clip) {
  const s = cloneSkeleton(lib.scene);
  const mixer = new THREE.AnimationMixer(s);
  mixer.clipAction(clip).play();
  const feet = ['foot_l', 'foot_r'].map((n) => byName(s, n));
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
      { j: C.torso, a: 'spine_01', b: 'spine_03', axis: UP },
      { j: C.head, a: 'neck_01', b: 'Head', axis: UP },
    ];
    // our index 0 is the -x side, which is the character's right
    ['r', 'l'].forEach((s, i) => {
      map.push({ j: C.arms[i], a: `upperarm_${s}`, b: `lowerarm_${s}`, axis: DOWN });
      map.push({ j: C.elbows[i], a: `lowerarm_${s}`, b: `hand_${s}`, axis: DOWN });
      map.push({ j: C.legs[i], a: `thigh_${s}`, b: `calf_${s}`, axis: DOWN });
      map.push({ j: C.knees[i], a: `calf_${s}`, b: `foot_${s}`, axis: DOWN });
      map.push({ j: C.feet[i], a: `foot_${s}`, b: `ball_${s}`, axis: FWD, foot: true });
    });
    this.map = map.map((m) => ({ ...m, A: this.bone(m.a), B: this.bone(m.b), rest: new THREE.Vector3() }));
    this.hips = this.bone('pelvis');
    // rest directions from the T-pose
    this.mixer.stopAllAction();
    this.src.updateMatrixWorld(true);
    for (const m of this.map) m.rest.copy(this.dir(m.A, m.B, _a));
    this.restHands = Object.fromEntries(['r', 'l'].map((s) => [s, this.bone(`hand_${s}`).getWorldQuaternion(new THREE.Quaternion())]));
    // Hand directions are measured in the source bone's local frame. Retargeting
    // these anatomical axes also works when the destination was bound in A-pose.
    this.handFrames = Object.fromEntries(['r', 'l'].map((s) => {
      const hand = this.bone(`hand_${s}`), inverse = this.restHands[s].clone().invert();
      const along = this.dir(hand, this.bone(`middle_01_${s}`), new THREE.Vector3());
      const span = this.dir(this.bone(`pinky_01_${s}`), this.bone(`index_01_${s}`), new THREE.Vector3());
      const normal = new THREE.Vector3().crossVectors(along, span).normalize();
      if (normal.y > 0) normal.negate(); // palms face down in the source T-pose
      return [s, { along: along.applyQuaternion(inverse), normal: normal.applyQuaternion(inverse) }];
    }));
    this.restHips = this.hips.getWorldPosition(new THREE.Vector3());
    this.restHipsQ = this.hips.getWorldQuaternion(new THREE.Quaternion());
    for (const a of Object.values(this.actions)) a.play();
    this.phase = 0;
    this.w = { idle: 1, walk: 0, jog: 0, sprint: 0, air: 0, drive: 0, talk: 0, jumpLand: 0, look: 0, ledge: 0, climbIdle: 0, climbUp: 0, climbDown: 0, climbLeft: 0, climbRight: 0 };
    this.idleT = 0;
    this.airState = null;
    // the gait's feet (analyseGait): contact per foot this frame (0..1), how fast the loop sweeps a
    // planted foot back (m/s on the bound body), and the locomotion loops' share of the pose
    this.gait = analyseGait(lib);
    this.legRatio = 1;   // the body's hip-to-ankle over the library's (bindBody)
    this.contact = { l: 1, r: 1 };
    this.toContact = { l: 0, r: 0 };   // s until each foot's next touchdown in the gait (Infinity off the ground)
    this.footSpeed = 0;
    this.gaitW = 0;
  }

  /** The body these clips pose (a Humanoid): its legs' length sets the stride and the cadence. */
  bindBody(humanoid) {
    const R = humanoid?.rest, B = humanoid?.b;
    if (!this.gait || !R || !B?.thigh_l) return this;
    const p = (n) => R.get(B[n]).p;
    this.legRatio = (p('thigh_l').distanceTo(p('calf_l')) + p('calf_l').distanceTo(p('foot_l'))) / this.gait.legLength;
    return this;
  }

  dir(A, B, out) {
    A.getWorldPosition(_r);
    return B.getWorldPosition(out).sub(_r).normalize();
  }

  /**
   * @param s.speed horizontal speed (m/s), s.onGround, s.vy (up velocity),
   *          s.mode 'ground' | 'drive' | 'talk' | 'climb' (s.climbF, s.climbS: -1..1) | 'ledge' (s.ledgeT 0..1)
   */
  update(dt, s) {
    const L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    const N = this.lib.native;
    const sp = s.speed;
    // target weights for the locomotion blend (piecewise between clip speeds)
    const tw = { idle: 0, walk: 0, jog: 0, sprint: 0, air: 0, drive: 0, talk: 0, jumpLand: 0, look: 0, ledge: 0, climbIdle: 0, climbUp: 0, climbDown: 0, climbLeft: 0, climbRight: 0 };
    // landing from a real fall: play the land clip for a beat
    if (s.onGround && this._wasAir && this._airT > 0.45 && this.actions.jumpLand) { this.landT = 0; this.actions.jumpLand.reset().play(); }
    this._airT = s.onGround ? 0 : (this._airT ?? 0) + dt;
    this._wasAir = !s.onGround;
    const landing = this.landT !== undefined && this.landT < 0.45;
    if (landing) { this.landT += dt; this.actions.jumpLand.time = this.landT * 1.3 + 0.1; }
    if (s.mode === 'climb') {
      // on the wall: up / down / sideways loops by the direction you push, hanging idle otherwise
      const f = s.climbF ?? 0, sd = s.climbS ?? 0;
      if (!f && !sd) tw.climbIdle = 1;
      else {
        const m = Math.abs(f) + Math.abs(sd);
        tw[f > 0 ? 'climbUp' : 'climbDown'] = Math.abs(f) / m;
        tw[sd > 0 ? 'climbRight' : 'climbLeft'] += Math.abs(sd) / m;
      }
    } else if (s.mode === 'ledge') tw.ledge = 1;
    else if (s.mode === 'drive') tw.drive = 1;
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
    if (landing && sp < 3 && s.mode !== 'climb') { for (const k in tw) tw[k] *= 0.15; tw.jumpLand = 0.85; }
    // standing a while: now and then look around properly
    this.idleT = tw.idle > 0.99 ? this.idleT + dt : 0;
    const look = this.lib.clips.look;
    if (look && this.idleT > 7) {
      const lt = (this.idleT - 7) % (look.duration + 14);
      if (lt < look.duration) {
        const k = Math.min(lt / 0.6, (look.duration - lt) / 0.6, 1);
        tw.look = k; tw.idle = 1 - k;
        this.actions.look.time = lt;
      }
    }
    const kk = 1 - Math.exp(-10 * dt);
    for (const key in this.w) this.w[key] = L(this.w[key], tw[key], kk);

    // one shared gait phase: cycles per second = speed / stride, stride from the
    // clip that dominates (each clip's native stride = native speed * duration)
    const gaitKeys = ['walk', 'jog', 'sprint'];
    const G = this.gait, size = this.legRatio * (s.scale ?? 1);
    let wsum = 0, stride = 0, sweep = 0;
    for (const k of gaitKeys) {
      const w = this.w[k];
      wsum += w;
      if (G) {
        // the loop's true stance sweep on this body, shortened by STRIDE_K (plantFeet warps the feet to match)
        const c = G.clips[k], full = c.speed * c.duration * size;
        sweep += w * full; stride += w * full * STRIDE_K[k];
      } else stride += w * N[k] * this.lib.clips[k].duration;
    }
    this.footSpeed = 0;
    let cps = 0;
    if (wsum > 0.01) {
      stride /= wsum; sweep /= wsum;
      // (strideScale: a longer or shorter stride than the loop's, for people's own gaits)
      cps = sp / Math.max(stride * (s.strideScale ?? 1), 0.3);
      this.phase = (this.phase + cps * dt) % 1;
      this.footSpeed = cps * sweep;
    }
    for (const k of gaitKeys) this.actions[k].time = this.phase * this.lib.clips[k].duration;
    // which feet are on the ground: the standing poses plant both, the loops by their phase, the air neither
    let total = 0;
    for (const k in this.w) total += this.w[k];
    total = Math.max(total, 1e-3);
    const still = this.w.idle + this.w.talk + this.w.look + this.w.jumpLand;
    this.gaitW = wsum / total;
    for (const f of ['l', 'r']) {
      let c = still;
      let lead = 0;
      if (G) for (const k of gaitKeys) { c += this.w[k] * contactAt(G.clips[k].contact[f], this.phase); lead += this.w[k] * contactAt(G.clips[k].lead[f], this.phase); }
      this.contact[f] = Math.min(c / total, 1);
      this.toContact[f] = wsum > 0.01 && cps > 0.05 ? lead / wsum / cps : Infinity;
    }
    // climbing loops: a little faster than authored, since we climb quickly
    const moving = s.mode === 'climb' && (s.climbF || s.climbS);
    for (const k of CLIMB) {
      const a = this.actions[k];
      if (a) a.time = (a.time + dt * (k === 'climbIdle' ? 1 : moving ? 1.6 * (s.climbRate ?? 1) : 0)) % this.lib.clips[k].duration;
    }
    if (this.actions.ledge) this.actions.ledge.time = THREE.MathUtils.clamp(s.ledgeT ?? 0, 0, 1) * this.lib.clips.ledge.duration * 0.999;
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
