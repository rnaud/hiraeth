import * as THREE from 'three';
import { worldPos, worldQuat, updateRig } from './world-read.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { MotionMatcher, MATCH, mirrorClip } from './motion-match.js';

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
// the clips whose head turns on the neck as captured (Animator.apply): on foot
const HEAD_NOD = ['idle', 'walk', 'jog', 'sprint', 'talk', 'look'];
// the traveller's idle variants after standing 7 s (Animator.idleMoves), in turn with IDLE_GAP s between
const IDLE_VARIANTS = ['looking_around', 'breathing_idle', 'look'];
const IDLE_GAP = 10;
// the rig's hips over its body's origin (player.js buildCharacter: the thighs' pivots, the pelvis)
const HIP_PIVOT = 0.97;
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
  for (const k of keys) gait.clips[k] = loopFeet(lib.clips[k], s, mixer);
  mixer.stopAllAction();
  return (lib.gait = gait);
}

/**
 * One loop's feet (analyseGait): its stance speed, contact and lead curves over the phase, on the
 * library skeleton `s` (a clone of lib.scene) with its mixer. Any in-place walking loop will do:
 * the people's own walks (lib.motion.walks) are measured the same way (gaitOf).
 */
function loopFeet(clip, s, mixer) {
  const by = (n) => byName(s, n);
  const pel = new THREE.Vector3(), cur = new THREE.Vector3();
  const action = mixer.clipAction(clip);
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
  return { speed: speeds[Math.floor(speeds.length / 2)] ?? 1, duration: clip.duration, contact, lead };
}

/** The feet of a walking loop that isn't one of the library's own (a person's walk), measured once per clip. */
export function gaitOf(lib, clip) {
  const G = analyseGait(lib);
  if (!G) return null;
  if (!clip.userData.gaitFeet) {
    const s = cloneSkeleton(lib.scene), mixer = new THREE.AnimationMixer(s);
    const feet = loopFeet(clip, s, mixer);
    mixer.stopAllAction();
    // a captured walk knows when its feet were down (scripts/mocap/ labelled them on the capture:
    // the ball low and still): those, over the phase, rather than a guess from the foot's height
    const C = clip.userData.contact;
    if (C?.l?.length) {
      const N = feet.contact.l.length, n = C.l.length;
      for (const f of ['l', 'r']) {
        for (let i = 0; i < N; i++) { const x = (i / N) * n, j = Math.floor(x) % n, t = x - Math.floor(x); feet.contact[f][i] = C[f][j] * (1 - t) + C[f][(j + 1) % n] * t; }
        for (let i = 0; i < N; i++) { let j = 0; while (j < N && feet.contact[f][(i + j) % N] < 0.5) j++; feet.lead[f][i] = j / N; }
      }
    }
    clip.userData.gaitFeet = feet;
  }
  return clip.userData.gaitFeet;
}

/** Where in a contact curve's cycle (0..1) the foot comes down. */
function touchdown(curve) {
  const N = curve.length;
  for (let i = 0; i < N; i++) if (curve[i] >= 0.5 && curve[(i + N - 1) % N] < 0.5) return i / N;
  return 0;
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
    this.clips = { ...lib.clips };   // (this body's own: a person may walk a walk of their own, useWalk)
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
    this.restHead = this.bone('Head')?.getWorldQuaternion(new THREE.Quaternion());
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
    this.restAnkleY = this.bone('foot_l').getWorldPosition(new THREE.Vector3()).y;   // (the clips' floor: a standing ankle's height)
    this.restHipsQ = this.hips.getWorldQuaternion(new THREE.Quaternion());
    for (const a of Object.values(this.actions)) a.play();
    this.phase = 0;
    this.w = { idle: 1, walk: 0, jog: 0, sprint: 0, air: 0, jumpStart: 0, drive: 0, talk: 0, jumpLand: 0, look: 0, ledge: 0, climbIdle: 0, climbUp: 0, climbDown: 0, climbLeft: 0, climbRight: 0 };
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
    // motion matching (src/motion-match.js): on when `matching` is set and the library has its
    // database (lib.motion, public/anim/locomotion.glb); mmW is its share of the pose
    this.matching = false;
    this.mm = null;
    this.mmW = 0;
    // a move of the traveller's own (lib.motion.clips: a get-up, a jump, a kneel, the petting) laid
    // over all of it this frame: play(); moveW its share, fullW how much of the body follows its hips
    this.moveReq = null;
    this.moveW = 0;
    this.legsW = 0;   // (its share of the legs: 0 for one laid on above them)
    this.fullW = 0;
    this.groundW = 0;
    this.headW = 0;
    this.moveActs = new Map();
  }

  /** A move (lib.motion.clips) by name, or null: `mixamo_get_up_back`, or just `get_up_back`. */
  moveClip(name) {
    const clips = this.lib.motion?.clips;
    if (!clips?.length || !name) return null;
    const by = (this.lib._moveBy ??= new Map());
    if (!by.has(name)) {
      // (`<name>_m`: the move in a mirror, made once)
      const find = (n) => clips.find((c) => c.name === n || c.name === `mixamo_${n}`) ?? null;
      const own = find(name), base = !own && name.endsWith('_m') ? find(name.slice(0, -2)) : null;
      by.set(name, own ?? (base ? mirrorClip(base) : null));
    }
    return by.get(name);
  }

  /**
   * Play a move this frame (call before update()): `t` s into it, weight `w` (0..1) over the blend.
   * o.full: the body follows the clip's hips all the way (lying, kneeling, a get-up; else the
   * walk's 0.6 of their sway and half their turn); o.ground: the clip's own rise off the floor is
   * left out (a jump in the air: the body's flight is the controller's); o.head: the clip turns the
   * head on the neck (on foot); o.walks: a start, a stop or a turn (the gait's share and the stride's
   * sweep from the clip's own path and its playback `rate`, clip s a s, so the feet plant as the
   * loops' do); o.legs false: the body above the hips only (and the hips' height), the legs and the
   * feet left to the loops (a stop's braking, a start's lean, the pivot's twist at speeds the clips
   * don't walk at); o.free: the feet let go of where they stand and follow the clip's (a kneel: one
   * goes back, a knee down). Returns false when the clip isn't there (moves.glb not loaded).
   */
  play(name, t, w, { full = true, ground = false, head = true, walks = false, rate = 1, legs = true, free = false } = {}) {
    const clip = this.moveClip(name);
    if (!clip || !(w > 0.001)) return !!clip;
    this.moveReq = { clip, t: THREE.MathUtils.clamp(t, 0, clip.duration), w: Math.min(w, 1), full: full && legs, ground, head, walks: walks && legs, rate, legs, free };
    return true;
  }

  /**
   * A second move this frame above the legs only (on top of play()'s, which may hold the legs: the
   * petting's arms over the kneel). Same names and times as play().
   */
  playUpper(name, t, w) {
    const clip = this.moveClip(name);
    if (!clip || !(w > 0.001)) return !!clip;
    this.upperReq = { clip, t: THREE.MathUtils.clamp(t, 0, clip.duration), w: Math.min(w, 1), legs: false, head: true };
    return true;
  }

  /** Deliberate attacks use phase timing; transitions crossfade from the actual displayed pose. */
  playCombat(name, t, w, { full = true, id = name } = {}) {
    this.combatKey = `${id}:${name}`;
    return this.play(name, t, w, { full, legs: full, head: true });
  }

  blendCombat(dt) {
    if (!this.combatKey && !this.lastCombatKey && !this.combatFrom) return;
    // Retain the displayed pose, including motion matching, for a continuous handover.
    this.combatBones ??= (() => { const b = []; this.src.traverse((o) => { if (o.isBone) b.push(o); }); return b; })();
    const key = this.combatKey ?? null;
    if (key !== this.lastCombatKey && this.lastCombatPose) {
      this.combatFrom = this.lastCombatPose.map((v) => ({ q: v.q.clone(), p: v.p.clone() })); this.combatBlendT = 0;
    }
    this.lastCombatKey = key; this.combatKey = null;
    if (this.combatFrom) {
      this.combatBlendT += dt;
      const k = THREE.MathUtils.smoothstep(this.combatBlendT, 0, 0.09);
      this.combatBones.forEach((b, i) => {
        b.quaternion.slerp(this.combatFrom[i].q, 1 - k);
        b.position.lerp(this.combatFrom[i].p, 1 - k);
      });
      if (k >= 1) this.combatFrom = null;
    }
    this.lastCombatPose ??= this.combatBones.map(() => ({ q: new THREE.Quaternion(), p: new THREE.Vector3() }));
    this.combatBones.forEach((b, i) => { this.lastCombatPose[i].q.copy(b.quaternion); this.lastCombatPose[i].p.copy(b.position); });
    if (!key && !this.combatFrom) this.lastCombatPose = null;
  }

  /** The move's contacts at `t` (its own, labelled on the capture: scripts/mocap/process.js), { l, r } 0..1. */
  moveContact(clip, t, out) {
    const ud = clip.userData ?? {};
    if (ud.feet === undefined) {
      ud.feet = null;
      if (ud.contact?.l) {
        const dec = (s) => { const b = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); const u = new Float32Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i) / 255; return u; };
        ud.feet = { l: dec(ud.contact.l), r: dec(ud.contact.r) };
      }
    }
    if (!ud.feet) { out.l = out.r = 1; return out; }
    const fps = ud.fps ?? 30, n = ud.feet.l.length, x = Math.min(t * fps, n - 1), i = Math.floor(x), k = x - i, j = Math.min(i + 1, n - 1);
    out.l = ud.feet.l[i] * (1 - k) + ud.feet.l[j] * k;
    out.r = ud.feet.r[i] * (1 - k) + ud.feet.r[j] * k;
    return out;
  }

  /** Start the gait and the standing loops at `k` (0..1) of their cycle: people side by side don't breathe or step in time. */
  offsetLoops(k) {
    this.phase = k % 1;
    for (const key of ['idle', 'talk', 'look', 'drive']) {
      const a = this.actions[key];
      if (a) a.time = ((k * 7.31) % 1) * this.clips[key].duration;
    }
    return this;
  }

  /**
   * Walk a walk of one's own (lib.motion.walks: a captured person's walking cycle, retargeted,
   * scripts/mocap/) instead of the library's: the loop takes the walk's place in the blend, its
   * feet are measured as the library's are (gaitOf), and its stride is taken as captured.
   */
  useWalk(walk) {
    if (!this.gait || !this.lib.clips.walk) return this;
    // (none: the library's own walk again)
    const own = !walk?.clip;
    if (own) walk = { clip: this.lib.clips.walk, name: null, strideK: STRIDE_K.walk };
    if (walk.clip === this.clips.walk) return this;
    const feet = own ? analyseGait(this.lib).clips.walk : gaitOf(this.lib, walk.clip);
    if (!feet) return this;
    const old = this.actions.walk, a = this.mixer.clipAction(walk.clip);
    a.enabled = true; a.setEffectiveWeight(0); a.play();
    if (old && old !== a) { old.setEffectiveWeight(0); old.stop(); }
    this.actions.walk = a;
    this.clips.walk = walk.clip;
    // (in step with the library's loops, so blending it with the jog keeps the feet together)
    const phase = own ? 0 : touchdown(feet.contact.l) - touchdown(analyseGait(this.lib).clips.walk.contact.l);
    this.gait = { ...this.gait, clips: { ...this.gait.clips, walk: { ...feet, strideK: walk.strideK ?? 1, phase } } };
    this.walkName = walk.name;
    return this;
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
    // (the library skeleton's matrices: current since update(), src.updateMatrixWorld)
    worldPos(A, _r);
    return worldPos(B, out).sub(_r).normalize();
  }

  /**
   * @param s.speed horizontal speed (m/s), s.onGround, s.vy (up velocity), s.jump (in the air: src/jump.js jumpPhase),
   *          s.mode 'ground' | 'drive' | 'talk' | 'climb' (s.climbF, s.climbS: -1..1) | 'ledge' (s.ledgeT 0..1)
   */
  update(dt, s) {
    const L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    const N = this.lib.native;
    const sp = s.speed;
    // target weights for the locomotion blend (piecewise between clip speeds)
    const tw = { idle: 0, walk: 0, jog: 0, sprint: 0, air: 0, jumpStart: 0, drive: 0, talk: 0, jumpLand: 0, look: 0, ledge: 0, climbIdle: 0, climbUp: 0, climbDown: 0, climbLeft: 0, climbRight: 0 };
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
    else if (!s.onGround) {
      // the jump by its phase (src/jump.js jumpPhase): the push (the late part of Jump_Start), the
      // tucked loop through the top, and the first frame of Jump_Land as the ground comes up (the
      // landing clip then carries on from it)
      const J = s.jump;
      if (J) {
        tw.jumpStart = J.takeoff;
        tw.jumpLand = J.reach * (1 - J.takeoff);
        tw.air = Math.max(0, 1 - tw.jumpStart - tw.jumpLand);
      } else tw.air = 1;
    }
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
    // standing a while: now and then look around properly (not while `calm`: in a conversation he holds still)
    this.idleT = tw.idle > 0.99 && !this.calm ? this.idleT + dt : 0;
    const look = this.clips.look;
    // (the traveller, idleMoves: Mixamo's looking about and breathing idle take turns with the
    // library's look-around, above the legs, so the feet stay as they stand: IDLE_VARIANTS)
    const variants = this.idleMoves ? IDLE_VARIANTS.map((v) => (v === 'look' ? (look ? { look, d: look.duration } : null) : (() => { const c = this.moveClip(v); return c && { clip: c, d: c.duration }; })())).filter(Boolean) : null;
    if (variants?.length && this.idleT > 7) {
      const gap = IDLE_GAP, cycle = variants.reduce((a, v) => a + v.d + gap, 0);
      let lt = (this.idleT - 7) % cycle;
      for (const v of variants) {
        if (lt < v.d) {
          const k = Math.min(lt / 0.8, (v.d - lt) / 0.8, 1);
          if (v.look) { tw.look = k; tw.idle = 1 - k; this.actions.look.time = lt; }
          else if (!this.moveReq && k > 0.001) this.moveReq = { clip: v.clip, t: lt, w: k, full: false, ground: false, head: true, walks: false, rate: 1, legs: false };
          break;
        }
        lt -= v.d + gap;
        if (lt < 0) break;
      }
    } else if (look && this.idleT > 7) {
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
        sweep += w * full; stride += w * full * (c.strideK ?? STRIDE_K[k]);
      } else stride += w * N[k] * this.clips[k].duration;
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
    // (a loop's own phase: a person's walk is shifted so its feet come down when the library's do, phaseOf)
    for (const k of gaitKeys) this.actions[k].time = (((this.phase + (G?.clips[k].phase ?? 0)) % 1) + 1) % 1 * this.clips[k].duration;
    // which feet are on the ground: the standing poses plant both, the loops by their phase, the air neither
    let total = 0;
    for (const k in this.w) total += this.w[k];
    total = Math.max(total, 1e-3);
    const still = this.w.idle + this.w.talk + this.w.look + this.w.jumpLand;
    this.gaitW = wsum / total;
    for (const f of ['l', 'r']) {
      let c = still;
      let lead = 0;
      if (G) for (const k of gaitKeys) { const p = this.phase + (G.clips[k].phase ?? 0); c += this.w[k] * contactAt(G.clips[k].contact[f], p); lead += this.w[k] * contactAt(G.clips[k].lead[f], p); }
      this.contact[f] = Math.min(c / total, 1);
      this.toContact[f] = wsum > 0.01 && cps > 0.05 ? lead / wsum / cps : Infinity;
    }
    // climbing loops: a little faster than authored, since we climb quickly
    const moving = s.mode === 'climb' && (s.climbF || s.climbS);
    for (const k of CLIMB) {
      const a = this.actions[k];
      if (a) a.time = (a.time + dt * (k === 'climbIdle' ? 1 : moving ? 1.6 * (s.climbRate ?? 1) : 0)) % this.clips[k].duration;
    }
    if (this.actions.ledge) this.actions.ledge.time = THREE.MathUtils.clamp(s.ledgeT ?? 0, 0, 1) * this.clips.ledge.duration * 0.999;
    // idle / talk / drive loop at their own pace
    for (const k of ['idle', 'talk', 'drive']) {
      const a = this.actions[k];
      if (a) a.time = (a.time + dt) % this.clips[k].duration;
    }
    // air: start → loop → land
    const air = this.actions.jumpLoop;
    if (air) air.time = (air.time + dt) % this.clips.jumpLoop.duration;
    if (!s.onGround && s.mode !== 'climb' && s.mode !== 'ledge') {
      // (the push: from just past the crouch to the tuck over the first third of a second)
      const st = this.actions.jumpStart;
      if (st) st.time = THREE.MathUtils.clamp(0.08 + (this._airT ?? 0) * 0.8, 0, 0.6) * this.clips.jumpStart.duration;
      // (reaching down: Jump_Land just before its touchdown)
      if (this.actions.jumpLand && !landing) this.actions.jumpLand.time = 0.02 * this.clips.jumpLand.duration;
    }

    for (const [k, a] of Object.entries(this.actions)) {
      const key = k === 'jumpLoop' ? 'air' : k;
      a.setEffectiveWeight(this.w[key] ?? 0);
    }
    this.cps = cps;
    this.layMove(size);
    this.mixer.update(0);
    if (this.move?.legs === false) this.overlayMove(this.move);
    if (this.upperReq) { this.overlayMove(this.upperReq); this.headW = Math.max(this.headW, this.upperReq.w); this.upperReq = null; }
    this.match(dt, s, landing, size);
    this.blendCombat(dt);
    this.src.updateMatrixWorld(true);
  }

  /** This frame's move (play()) over the blend: its share off every other clip's weight, the feet by its contacts. */
  layMove(size = 1) {
    const M = this.moveReq;
    this.moveReq = null;
    const w = M ? M.w : 0;
    for (const [clip, a] of this.moveActs) if (!M || clip !== M.clip) a.setEffectiveWeight(0);
    this.moveW = w; this.legsW = M && M.legs !== false ? w : 0; this.fullW = M?.full ? w : 0; this.groundW = M?.ground ? w : 0; this.headW = M?.head ? w : 0;
    this.move = M;
    if (!M) return;
    if (M.legs === false) return;   // (laid on after the mixer: overlayMove)
    let a = this.moveActs.get(M.clip);
    if (!a) { a = this.mixer.clipAction(M.clip); a.enabled = true; a.play(); this.moveActs.set(M.clip, a); }
    for (const b of Object.values(this.actions)) b.setEffectiveWeight(b.getEffectiveWeight() * (1 - w));
    a.setEffectiveWeight(w);
    a.time = M.t;
    // (the feet: the move's own contacts; no gait, no landing to wait for)
    const c = M.free ? Object.assign(this._mc ??= {}, { l: 0, r: 0 }) : this.moveContact(M.clip, M.t, (this._mc ??= { l: 1, r: 1 }));
    const P = M.clip.userData?.path, fps = M.clip.userData?.fps ?? 30;
    for (const f of ['l', 'r']) {
      this.contact[f] += (c[f] - this.contact[f]) * w;
      if (w > 0.5) this.toContact[f] = c[f] > 0.5 ? 0 : M.walks ? this.moveLead(M.clip, M.t, f) / Math.max(M.rate, 0.05) : Infinity;
    }
    if (M.walks && P) {
      // (a start or a stop walks: the gait's share and the stride's sweep are the clip's own)
      const i = Math.min(Math.round(M.t * fps), P.speed.length - 1), sp = P.speed[i];
      this.gaitW += (THREE.MathUtils.smoothstep(sp, 0.15, 0.55) - this.gaitW) * w;
      this.footSpeed += (sp * M.rate * size - this.footSpeed) * w;
    } else {
      this.gaitW *= 1 - w;
      this.footSpeed *= 1 - w;
    }
  }

  /** A move on the body above the legs (play's legs: false), over the blend the mixer made: each bone turned toward the clip's by its weight. */
  overlayMove(M) {
    if (!M) return;
    const ud = M.clip.userData ?? (M.clip.userData = {});
    ud.upper ??= M.clip.tracks.flatMap((t) => {
      const dot = t.name.lastIndexOf('.'), bone = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
      return /^(thigh|calf|foot|ball)_|^pelvis$/.test(bone) ? [] : [{ prop, bone, ip: t.createInterpolant() }];
    });
    for (const u of ud.upper) {
      const b = (u.b ??= new Map()).get(this) ?? (u.b.set(this, this.bone(u.bone)), u.b.get(this));
      if (!b) continue;
      const v = u.ip.evaluate(M.t);
      if (u.prop === 'quaternion') b.quaternion.slerp(_q.fromArray(v), M.w);
      else if (u.prop === 'position') b.position.lerp(_a.fromArray(v), M.w);
    }
  }

  /** Seconds of the move (at rate 1) from `t` until foot `f` comes down again (Infinity: not before it ends). */
  moveLead(clip, t, f) {
    const feet = clip.userData?.feet, fps = clip.userData?.fps ?? 30;
    if (!feet) return Infinity;
    const a = feet[f], n = a.length;
    for (let i = Math.ceil(t * fps); i < n; i++) if (a[i] > 0.5 && (i === 0 || a[i - 1] <= 0.5)) return i / fps - t;
    return Infinity;
  }

  /**
   * Set the loops' shared phase so foot `f` came down `since` s ago (at this cadence): a start or a
   * pivot hands over to the walk or the run in step, not with the feet crossed.
   */
  alignPhase(f, since) {
    const G = this.gait;
    if (!G) return;
    const k = ['walk', 'jog', 'sprint'].reduce((a, b) => ((this.w[b] ?? 0) > (this.w[a] ?? 0) ? b : a), 'walk');
    const c = G.clips[k];
    this.phase = ((touchdown(c.contact[f]) - (c.phase ?? 0) + since * (this.cps ?? 1)) % 1 + 1) % 1;
  }

  /**
   * Motion matching (src/motion-match.js) over the loops' pose: on the ground, walking, running,
   * starting, stopping, turning, standing; s.mm is the stick ({ vel, want, k, face }: the body's
   * frame, x left, z ahead). Where the database has nothing close (a sprint faster than it runs,
   * the air, climbing, talking, driving), the loops' pose stays, with a short blend either way.
   * The feet take their contacts and stride from whichever pose leads.
   */
  match(dt, s, landing, size) {
    const db = this.lib.motion?.db;
    if (!this.matching || !db || !s.mm) { this.mmW = 0; return; }
    const ground = s.onGround && (s.mode === 'ground' || s.mode === undefined) && !landing;
    // (past the database's fastest run, the sprint loop: MATCH.fallback x its 95th percentile)
    const fast = THREE.MathUtils.smoothstep(s.speed / (db.maxSpeed * size), 1.2, 1.45);
    let target = ground ? 1 - fast : 0;
    if (target > 0 || this.mmW > 0.001) {
      this.mm ??= new MotionMatcher(db);
      if (this.mmW <= 0.001) this.mm.reset();   // (coming in from the loops: a fresh match, faded in)
      // speed warping: the clip plays faster or slower so its feet sweep back at the body's own
      // speed (the game starts and stops quicker than anyone captured); within reason, the stride
      // warp (feet.js) does the rest
      const clip = this.mm.speed * size;
      const want = s.speed > 0.4 && clip > 0.25 ? THREE.MathUtils.clamp(s.speed / clip, MATCH.rate[0], MATCH.rate[1]) : 1;
      this.mmRate = (this.mmRate ?? 1) + (want - (this.mmRate ?? 1)) * (1 - Math.exp(-10 * dt));
      this.mm.update(dt, s.mm, size, { rate: this.mmRate });
      // nothing close in the database (or the body is far faster than any clip that fits, as when
      // it sets off at full tilt): the loops, until a match is good again (with some margin)
      const lag = s.speed > 1 && s.speed > clip * MATCH.rate[1] * MATCH.lag;
      this._mmLag = lag;
      this._mmMiss = this.mm.cost > MATCH.maxCost || lag || (this._mmMiss && (this.mm.cost > MATCH.maxCost * 0.5 || s.speed > clip * MATCH.rate[1]));
      if (this._mmMiss) target = 0;
    }
    // (in quickly; out quickly when the body outruns the clips, which the feet would show at once)
    this.mmW += (target - this.mmW) * (1 - Math.exp(-(target > this.mmW ? 10 : this._mmLag ? 25 : 7) * dt));
    if (this.mmW < 0.001) { this.mmW = 0; return; }
    const k = this.mmW * (1 - this.moveW), M = this.mm;
    if (k < 0.001) return;
    this._mmBones ??= db.bones.map((n) => this.bone(n));
    this._mmBones.forEach((b, i) => b.quaternion.slerp(_q.fromArray(M.outQ, i * 4), k));
    this.hips.position.lerp(_a.fromArray(M.outP), k);
    // the feet: contacts, the time to the next touchdowns, the stride's sweep, how much it walks
    for (const f of ['l', 'r']) {
      this.contact[f] += (M.contact[f] - this.contact[f]) * k;
      const t = M.lead[f];
      this.toContact[f] = k > 0.5 ? t : this.toContact[f];
    }
    const mmGait = THREE.MathUtils.smoothstep(M.speed, 0.15, 0.55);
    this.footSpeed += (M.speed * size * M.rate - this.footSpeed) * k;
    this.gaitW += (mmGait - this.gaitW) * k;
  }

  /** Copy the sampled pose onto our rig. root = the character's root Object3D. */
  apply(root, { lean = 0, bank = 0, drop = 0, legScale = 1 } = {}) {
    const C = this.char;
    // body: hip motion relative to rest (bob, sway, rotation)
    const hp = worldPos(this.hips, _a);
    const hq = worldQuat(this.hips, _q);
    _q2.copy(this.restHipsQ).invert().premultiply(hq);   // hq * rest^-1
    // (a move that lies, kneels or gets up (fullW): the body follows its hips all the way, not the
    // walk's 0.6 of their sway and half their turn; in the air (groundW), the clip's own rise off the
    // floor is left out: the controller flies the body)
    const fw = this.fullW;
    let lift = 0;
    if (this.groundW > 0) {
      const ankle = Math.min(worldPos(this.bone('foot_l'), _d).y, worldPos(this.bone('foot_r'), _r).y);
      lift = Math.max(0, ankle - this.restAnkleY) * this.groundW;
    }
    C.body.position.set((hp.x - this.restHips.x) * (0.6 + 0.4 * fw), (hp.y - this.restHips.y - lift) * legScale - drop, (hp.z - this.restHips.z) * fw);
    C.body.quaternion.setFromEuler(new THREE.Euler(lean, 0, bank)).multiply(_q2.slerp(_qp.identity(), 0.5 * (1 - fw)));
    // (turned about the hips, not the feet: the walk's small turns never showed the difference, a body
    // lying down does: turned 90° about the ground under it, the hips went a metre to the side, into the floor)
    if (fw > 0) {
      const piv = _x.set(0, HIP_PIVOT, 0), turned = _y.copy(piv).applyQuaternion(_q2);
      C.body.position.addScaledVector(piv.sub(turned), fw);
    }
    updateRig(root);
    // (the rig's matrices current from here: the root's update, then each joint's own after it turns)
    const rootQ = worldQuat(root, _qp);
    for (const m of this.map) {
      // limbs follow the library bone's absolute direction (both rigs face +Z,
      // y up); feet are corrected by the library foot's rest pitch so a flat
      // library foot gives a flat boot
      const cur = this.dir(m.A, m.B, _b);
      const desiredChar = m.foot ? cur.clone().applyQuaternion(_q.setFromUnitVectors(m.rest, FWD)) : cur.clone();
      // character space → world → the joint's parent space
      const world = desiredChar.applyQuaternion(rootQ);
      worldQuat(m.j.parent, _q2);
      const local = world.applyQuaternion(_q2.invert());
      if (m.foot) {
        // keep the boot level side-to-side: build a basis from forward + parent up
        _z.copy(local).normalize();
        _y.set(0, 1, 0);
        _x.crossVectors(_y, _z);
        // (toes pointing straight down or up: the side axis from the parent's instead, so the boot doesn't spin)
        if (_x.lengthSq() < 0.04) _x.set(1, 0, 0).addScaledVector(_z, -_z.x);
        _x.normalize();
        _y.crossVectors(_z, _x);
        m.j.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
      } else {
        m.j.quaternion.setFromUnitVectors(m.axis, local.normalize());
      }
      m.j.updateMatrixWorld(true);
    }
    // the head: the rig's head joint takes the neck's line (above), and the skull the clip's own turn on
    // it. Running, the neck leans 35-50 deg forward while the clip's head stays up (20 deg down): with the
    // neck's line alone the face looked at the ground. (On foot only: hanging from a ledge, climbing,
    // in the air and seated the neck's line is kept, as before: the head tipped back there would meet
    // the scout docked behind it.)
    if (C.headNod && this.restHead) {
      let k = 0;
      for (const key of HEAD_NOD) k += this.actions[key]?.getEffectiveWeight() ?? 0;
      k = Math.min(1, k + this.headW);
      const want = worldQuat(this.bone('Head'), _q).multiply(_q2.copy(this.restHead).invert()).premultiply(rootQ);
      C.headNod.quaternion.copy(worldQuat(C.head, _q2).invert().multiply(want)).slerp(_q.identity(), 1 - k);
      C.headNod.updateMatrixWorld(true);
    }
  }
}
