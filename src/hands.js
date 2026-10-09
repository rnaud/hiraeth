import * as THREE from 'three';
import { talkFaces as gameFaces } from './talk-face.js';

// Hands: the fingers of the people's bodies (Quaternius' human has three bones a finger and a
// thumb, all skinned) were left in the T-pose's flat, straight hand, since the clips carry no
// finger tracks. Here each hand gets a pose: a relaxed arc at rest (every finger a little more
// curled than the last, from the index to the little finger, the thumb in by the index), a looser
// open hand running or gliding, a grip on the holds, the handlebars or a staff, the gloved fist on the
// fluid's line of fire with the other hand cupped under it, and while someone talks a gesture in
// the line's tone (src/story/tone.js), beating with the syllables. Poses blend into each other
// over a moment, and the fingers move a little by themselves: a slow drift, and a lag behind the
// wrist when the hand is jerked about.
//
//   new Hands(humanoid)            (Humanoid's constructor; the relaxed pose at once, so even the
//                                   people never driven have relaxed hands)
//   hands.update(dt, ctx)          a context (handTargets) -> blended pose -> the finger bones
//   updateHands(dt, { player, npcs, camera })   once a frame (main.js): everyone near the camera
//
// A pose is 16 numbers (radians): the curl of each finger's three joints (index, middle, ring,
// little finger; knuckle first), the fan of the fingers at the knuckles, and the thumb's three:
// roll (about the hand's long axis: + out over the palm, - in by the index; the model's thumb
// stands well out, so most poses roll it in), in (toward the fingers' line) and its bend (across
// the palm, toward the little finger's knuckle).

export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
export const N_PARAMS = 16;
const SPREAD = 12, T_ROLL = 13, T_IN = 14, T_BEND = 15;

const D = Math.PI / 180;
/** A pose from degrees: four fingers' [knuckle, middle, tip] curls, the fan, the thumb's [roll, in, bend]. */
const pose = (fingers, spread, thumb) => Float32Array.from([...fingers.flat(), spread, ...thumb].map((v) => v * D));

export const HAND_POSES = {
  // a hand at rest: the natural arc, more curled toward the little finger, the thumb by the index
  relaxed: pose([[12, 24, 12], [18, 32, 15], [24, 40, 19], [31, 46, 23]], 3, [-60, -20, 35]),
  // running, gliding: looser, more open, the fingers a little apart
  open: pose([[5, 8, 5], [7, 10, 6], [9, 12, 7], [12, 14, 8]], 8, [-40, -28, 22]),
  // startled, falling, a shout: fingers flung wide
  splay: pose([[-6, 2, 2], [-4, 2, 2], [-2, 4, 3], [0, 6, 4]], 17, [0, -18, 0]),
  // holds on a wall, the handlebars, a staff: wrapped round something about 3 cm thick, the thumb over it
  grip: pose([[44, 66, 30], [50, 70, 32], [54, 72, 32], [58, 72, 32]], 0, [15, -40, 45]),
  // the glove's fist (aiming: the fluid leaves from its knuckles), an angry line (the tips into the palm, not through the back of the hand)
  fist: pose([[72, 92, 36], [76, 94, 38], [78, 94, 38], [80, 92, 36]], -2, [-55, -25, 65]),
  // reins: a fist with the thumb on top
  reins: pose([[60, 88, 34], [66, 90, 36], [70, 90, 36], [74, 88, 36]], -1, [-50, -55, 72]),
  // a handle hanging from the fingers (a lantern, a basket, a bell)
  hook: pose([[24, 70, 36], [28, 74, 38], [32, 76, 38], [36, 76, 38]], 0, [-60, -20, 35]),
  // the other hand under the gloved fist, swimming strokes: cupped, the fingers together
  cup: pose([[16, 20, 10], [18, 22, 11], [20, 24, 12], [23, 26, 13]], -2, [-70, -15, 35]),
  // pushing up onto a ledge: the palm flat, the fingers apart
  flat: pose([[3, 4, 2], [3, 4, 2], [4, 5, 3], [5, 6, 3]], 7, [-55, -30, 25]),
  // limp: sad, tired, sitting, down
  limp: pose([[22, 36, 18], [28, 42, 22], [34, 50, 26], [40, 56, 30]], 1, [-70, -25, 45]),
  // gestures of speech
  talk: pose([[8, 16, 8], [12, 20, 10], [16, 26, 13], [20, 30, 15]], 6, [-50, -25, 32]),
  point: pose([[2, 6, 3], [66, 88, 34], [72, 90, 36], [76, 90, 36]], 2, [-55, -25, 65]),
  pinch: pose([[38, 52, 26], [28, 38, 18], [32, 44, 22], [36, 50, 25]], 2, [15, 5, 15]),
  claw: pose([[22, 58, 40], [24, 60, 42], [26, 62, 42], [30, 62, 42]], 12, [-30, -30, 45]),
  together: pose([[6, 9, 5], [7, 10, 6], [8, 11, 6], [10, 12, 7]], -3, [-70, -20, 32]),
  // a flower's stem between thumb and fingers
  hold: pose([[34, 46, 22], [42, 58, 30], [48, 66, 34], [54, 70, 36]], 0, [-45, -25, 50]),
};
export const POSE_IDS = Object.keys(HAND_POSES);

/** The hands a line's tone talks with (TONES of src/story/tone.js). */
export const TONE_GESTURES = {
  neutral: 'talk', happy: 'open', sad: 'limp', angry: 'fist', scared: 'claw', surprised: 'splay',
  curious: 'point', tired: 'limp', solemn: 'together', playful: 'open', whisper: 'pinch', shout: 'splay',
};

/** Gestures made with the right hand alone: the left one does this meanwhile. */
const ONE_HANDED = { point: 'talk', pinch: 'relaxed' };

/** What each held prop (costumes.js PROPS) makes the right hand do. */
export const PROP_GRIPS = { staff: 'grip', parasol: 'grip', lamppole: 'grip', wrench: 'grip', lantern: 'hook', basket: 'hook', bell: 'hook', flower: 'hold',
  // the desert's own: the reed and the lute's neck held, the hook and the bell staff gripped like a staff
  ney: 'hold', oud: 'hold', hook: 'grip', bellstaff: 'grip', discstaff: 'grip' };

/** Rides (player.ride.kind): handlebars, a stick or the reins; in a cab (it drives itself) the hands rest. */
export const RIDE_GRIPS = { bike: 'grip', skiff: 'grip', taxi: 'relaxed', bird: 'reins' };

export const HANDS = {
  near: 30,         // m from the camera: hands driven (further off they keep their last pose)
  nearLow: 12,      // the same on the Handheld preset (NPC.lowDetail)
  rate: 7,          // 1/s, how fast a hand takes on a new pose
  gripRate: 14,     // 1/s, grabbing (a hold, the handlebars, a fist) is quicker
  runFrom: 2.4, runTo: 5,   // m/s: relaxed walking -> the open running hand
  airAfter: 0.18,   // s off the ground before the hands open (not every kerb)
  drift: 0.05,      // rad: the fingers' slow drift at rest (less in a grip)
  lag: 0.006,       // rad of curl per m/s² of the wrist's acceleration across the palm
  lagMax: 0.35,
  straighten: 5 * Math.PI / 180,   // rad: a finger joint bent back further than this at rest straightens its rig (Hands.rig)
};
const TIGHT = new Set(['grip', 'fist', 'reins', 'hook', 'hold']);

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A weighted set of poses `{ id: weight }`, normalised (an empty one is the relaxed hand). */
function normalise(w) {
  let sum = 0;
  for (const k in w) { if (!(w[k] > 0)) delete w[k]; else sum += w[k]; }
  if (sum <= 0) return { relaxed: 1 };
  for (const k in w) w[k] /= sum;
  return w;
}
/** Lay pose `id` over a set by k (0..1): the rest scaled down by 1 - k. */
function over(w, id, k) {
  if (!(k > 0) || !HAND_POSES[id]) return w;
  k = Math.min(1, k);
  for (const key in w) w[key] *= 1 - k;
  w[id] = (w[id] ?? 0) + k;
  return w;
}

/**
 * The poses each hand should take for a context:
 *   mode     'ground' | 'climb' | 'mantle' | 'ride' | 'swim' | 'glide' | 'jet' | 'air' | 'seated' | 'rail' | 'down'
 *   speed    m/s over the ground (walking -> running)
 *   ride     the ride's kind (RIDE_GRIPS)
 *   air      s off the ground (mode 'air')
 *   prop     a held prop in the right hand (PROP_GRIPS)
 *   aim      0..1 aiming the glove: the right fist, the left cupped under it
 *   sword    0..1 the fluid blade drawn: the right hand a fist round its grip (src/blade-grip.js)
 *   shield   0..1 the shield open on the back of the left hand: that hand a fist
 *   handoff  0..1 both hands on the tank
 *   startle  0..1 a fright (splayed hands)
 *   talk     { tone, k (0..1), beat (0..1) } speaking a line: a gesture in its tone
 *   pose     a pose id: both hands just that (the studio)
 * Returns { r: { id: weight }, l: { id: weight }, rate } (weights sum to 1).
 */
export function handTargets(ctx = {}) {
  if (ctx.pose && HAND_POSES[ctx.pose]) return { r: { [ctx.pose]: 1 }, l: { [ctx.pose]: 1 }, rate: HANDS.rate };
  let base, rate = HANDS.rate;
  switch (ctx.mode) {
    case 'down': base = { limp: 1 }; rate = 5; break;
    case 'climb': base = { grip: 1 }; rate = HANDS.gripRate; break;
    case 'mantle': base = { flat: 1 }; rate = HANDS.gripRate; break;
    case 'ride': base = { [RIDE_GRIPS[ctx.ride] ?? 'grip']: 1 }; rate = HANDS.gripRate; break;
    case 'swim': base = { cup: 1 }; break;
    case 'glide': base = { open: 0.7, splay: 0.3 }; break;
    case 'jet': base = { open: 1 }; break;
    case 'air': { const k = smooth(ctx.air ?? 1, HANDS.airAfter, HANDS.airAfter + 0.3); base = { relaxed: 1 - k, open: k * 0.6, splay: k * 0.4 }; break; }
    case 'seated': base = { limp: 0.7, relaxed: 0.3 }; break;
    case 'rail': base = { grip: 0.8, relaxed: 0.2 }; break;
    default: { const k = smooth(ctx.speed ?? 0, HANDS.runFrom, HANDS.runTo); base = { relaxed: 1 - k, open: k }; }
  }
  const r = { ...base }, l = { ...base };
  const free = !['climb', 'mantle', 'ride', 'down'].includes(ctx.mode);
  if (free) {
    if (ctx.startle > 0) { over(r, 'splay', ctx.startle); over(l, 'splay', ctx.startle); }
    // a gesture in the line's tone, beating with its syllables: the right hand leads
    const t = ctx.talk;
    if (t && t.k > 0) {
      const g = TONE_GESTURES[t.tone] ?? 'talk', beat = t.beat ?? 0;
      over(r, g, t.k * (0.7 + 0.3 * beat));
      over(l, ONE_HANDED[g] ?? g, t.k * (0.6 + 0.2 * (1 - beat)));
    }
    if (PROP_GRIPS[ctx.prop]) { for (const k in r) delete r[k]; r[PROP_GRIPS[ctx.prop]] = 1; }
  }
  if (ctx.handoff > 0) { over(r, 'grip', ctx.handoff); over(l, 'grip', ctx.handoff); rate = Math.max(rate, HANDS.gripRate); }
  if (ctx.aim > 0) { over(r, 'fist', ctx.aim); over(l, 'cup', ctx.aim * 0.85); rate = Math.max(rate, HANDS.gripRate); }
  if (ctx.sword > 0) { over(r, 'fist', ctx.sword); rate = Math.max(rate, HANDS.gripRate); }
  if (ctx.shield > 0) { over(l, 'fist', ctx.shield); rate = Math.max(rate, HANDS.gripRate); }
  return { r: normalise(r), l: normalise(l), rate };
}

/** The pose of a weighted set (a straight blend of the angles). */
export function mixPose(weights, out = new Float32Array(N_PARAMS)) {
  out.fill(0);
  for (const id in weights) {
    const p = HAND_POSES[id], w = weights[id];
    if (!p) continue;
    for (let i = 0; i < N_PARAMS; i++) out[i] += p[i] * w;
  }
  return out;
}

/** Ease `cur` toward `goal` at `rate` (1/s) over dt: frame-rate independent, never overshooting. */
export function easePose(cur, goal, rate, dt) {
  const k = 1 - Math.exp(-rate * Math.max(dt, 0));
  for (let i = 0; i < N_PARAMS; i++) cur[i] += (goal[i] - cur[i]) * k;
  return cur;
}

/** How tight a weighted set is (0 open .. 1 a grip or fist): grips hold still. */
export function tightness(weights) {
  let t = 0;
  for (const id in weights) if (TIGHT.has(id)) t += weights[id];
  return Math.min(1, t);
}

/**
 * Each finger joint's bend as it is now, in degrees: + toward the palm, - bent back (hyperextended).
 * Measured about the hand's own crosswise axis (its knuckles' line, turned as the hand is), from the
 * segment before the joint to the one after it: the palm's line (wrist -> the finger's knuckle), then
 * each phalanx (the bone's rest direction turned as the bone has turned, so a rig without fingertip
 * leaves is measured the same). The same sign on both hands, whatever the rig's mirroring.
 *   fingerFlex(humanoid, 'r') -> { index: [knuckle, middle, tip], middle, ring, pinky }, or null
 */
export function fingerFlex(h, s) {
  const S = h.hands?.sides.find((x) => x.s === s);
  if (!S) return null;
  const R = h.rest, root = h.char?.root ?? h.model;
  root.updateMatrixWorld(true);
  const rootQi = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const turn = (b) => b.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQi).multiply(R.get(b).q.clone().invert());
  const hq = turn(S.hand);
  const n = S.normal.clone().applyQuaternion(hq), along = S.along.clone().applyQuaternion(hq);
  const side = new THREE.Vector3().crossVectors(along, n).normalize();   // (+ about it turns along toward the palm)
  const angle = (d) => Math.atan2(d.dot(n), d.dot(along));
  const out = {};
  for (const f of FINGERS) {
    const segs = [];
    const k = h.b[`${f}_01_${s}`];
    if (!k) continue;
    segs.push(R.get(k).p.clone().sub(R.get(S.hand).p).normalize().applyQuaternion(hq));
    for (let j = 1; j <= 3; j++) {
      const J = S.joints.find((x) => x.b === h.b[`${f}_0${j}_${s}`]);
      if (J) segs.push(J.dir.clone().applyQuaternion(turn(J.b)));
    }
    const a = [];
    for (let j = 1; j < segs.length; j++) {
      // (each segment flattened onto the plane the fingers curl in)
      const p0 = segs[j - 1].clone().addScaledVector(side, -segs[j - 1].dot(side)), p1 = segs[j].clone().addScaledVector(side, -segs[j].dot(side));
      let d = angle(p1) - angle(p0);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.push(d * 180 / Math.PI);
    }
    out[f] = a;
  }
  return out;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
let seeds = 0;

/** One person's two hands: the finger bones' axes at rest, and the pose each hand is in. */
export class Hands {
  constructor(h) {
    this.h = h;
    this.seed = (seeds++ * 0.618034) % 1;
    this.t = this.seed * 40;
    this.sides = ['r', 'l'].map((s) => this.rig(s)).filter(Boolean);
    for (const S of this.sides) S.cur.set(HAND_POSES.relaxed);
    this.speed = 0;
    this.air = 0;
    this.targets = null;
    this.live = false;   // (the drift once driven: until then every body's hands are the same)
    // how much of each pose a body's fingers and thumb take (the coral-shirt traveller's generated thumb
    // takes less: src/characters/tripo-hands.js). Part of every write (apply), so it never accumulates
    this.reach = { fingers: 1, thumb: 1 };
    this.apply();
  }

  /** A hand's joints: each bone's rest (local) rotation, and the axes it curls, fans and turns about (in its own frame). */
  rig(s) {
    const h = this.h, B = h.b, R = h.rest;
    const bone = (n) => B[`${n}_${s}`];
    if (!bone('hand') || !bone('middle_01') || !bone('index_01') || !bone('pinky_01')) return null;
    const restQ = (b) => R.get(b).q, restP = (b) => R.get(b).p;
    const bindLocal = (b) => (b.parent?.isBone ? R.get(b.parent).q.clone().invert() : new THREE.Quaternion()).multiply(restQ(b));
    const local = (b, axis) => axis.clone().applyQuaternion(_qi.copy(restQ(b)).invert()).normalize();
    // Some MakeHuman rigs end at the distal phalanx instead of providing a
    // fingertip leaf. Its incoming segment still defines a curl axis; skipping
    // it leaves every fingertip rigid even when it has valid skin weights.
    const dirOf = (b) => {
      const c = b.children.find((o) => o.isBone);
      if (c) return restP(c).clone().sub(restP(b)).normalize();
      return b.parent?.isBone && R.has(b.parent) ? restP(b).clone().sub(restP(b.parent)).normalize() : null;
    };
    // the palm (character space, at rest): along the fingers, across the knuckles (toward the index), the way it faces
    const origin = restP(bone('hand'));
    const along = restP(bone('middle_01')).clone().sub(origin).normalize();
    const span = restP(bone('index_01')).clone().sub(restP(bone('pinky_01')));
    const normal = new THREE.Vector3().crossVectors(along, span).normalize();
    if (normal.y > 0) normal.negate();   // (palms face down in the T-pose)
    span.addScaledVector(normal, -span.dot(normal)).normalize();
    const joints = [];
    // a joint's bend at rest (rad, + toward the palm): each segment flattened onto the plane the fingers curl in
    const side = new THREE.Vector3().crossVectors(along, normal).normalize();
    const pitch = (d) => { const p = d.clone().addScaledVector(side, -d.dot(side)); return Math.atan2(p.dot(normal), p.dot(along)); };
    FINGERS.forEach((f, fi) => {
      let prev = bone(`${f}_01`) ? restP(bone(`${f}_01`)).clone().sub(origin).normalize() : null;
      for (let j = 0; j < 3; j++) {
        const b = bone(`${f}_0${j + 1}`), d = b && dirOf(b);
        if (!d) continue;
        // curl: the finger turns toward the palm; fan: at the knuckle, toward the index's side (the little finger away)
        const curl = new THREE.Vector3().crossVectors(d, normal).normalize();
        const fan = j === 0 ? local(b, new THREE.Vector3().crossVectors(d, span)) : null;
        // the bend the rig gives the joint at rest (+ toward the palm), kept to straighten it if need be (below)
        let zero = 0;
        if (prev) { const a = pitch(d) - pitch(prev); zero = -Math.atan2(Math.sin(a), Math.cos(a)); }
        prev = d;
        joints.push({ b, rest: bindLocal(b), curl: local(b, curl), fan, dir: d.clone(), zero, i: fi * 3 + j, fanK: [1, 0.25, -0.45, -1][fi], tip: [0.6, 1, 0.8][j] });
      }
    });
    // A rig whose fingers are bent back at rest is straightened before any pose: a fitted rig's knuckles
    // and joints sit on the generated hand's surface, not on a line (the coral-shirt traveller's are bent
    // up to 30° either way, and not the same on both hands), so the poses laid on them bent some fingers
    // back and curled others twice as far. Every pose's numbers are then each joint's bend from a straight
    // finger, the same on both hands. A rig bent only toward the palm at rest (the MakeHuman people's
    // natural curl; the Quaternius bodies' are straight, within 3°) keeps its rest, as the poses and
    // the props they hold were set on it.
    if (!joints.some((J) => J.zero > HANDS.straighten)) for (const J of joints) J.zero = 0;
    const thumb = [];
    for (let j = 0; j < 3; j++) {
      const b = bone(`thumb_0${j + 1}`), d = b && dirOf(b);
      if (!d) continue;
      // roll: about the hand's long axis; in: toward the fingers' line; bend: across the palm, toward the little finger's knuckle
      const roll = new THREE.Vector3().crossVectors(span, normal).normalize();
      const toIn = new THREE.Vector3().crossVectors(d, along);
      const m = restP(bone('pinky_01')).clone().sub(restP(b));
      m.addScaledVector(d, -m.dot(d));
      const bend = new THREE.Vector3().crossVectors(d, m.normalize()).normalize();
      thumb.push({ b, rest: bindLocal(b), roll: local(b, roll), in: toIn.lengthSq() > 1e-8 ? local(b, toIn) : null, bend: local(b, bend), j });
    }
    return {
      s, hand: bone('hand'), joints, thumb, normal, along, restHandQ: restQ(bone('hand')).clone(),
      cur: new Float32Array(N_PARAMS), goal: new Float32Array(N_PARAMS),
      lag: 0, lagV: 0, last: null, tight: 0,
    };
  }

  /** Both hands to one pose at once (no easing): a pose id or 16 numbers. */
  set(p) {
    const v = typeof p === 'string' ? HAND_POSES[p] : p;
    if (!v) return;
    for (const S of this.sides) { S.cur.set(v); S.goal.set(v); S.lag = S.lagV = 0; }
    this.apply();
  }

  /** Step: the context's poses (handTargets), eased into, with the fingers' own motion; then the bones. */
  update(dt, ctx = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.t += dt;
    this.live = true;
    // walking speed: the body's own when not given
    const root = this.h.char?.root;
    if (root) {
      const p = _a.setFromMatrixPosition(root.matrixWorld);   // (posed this frame: Humanoid.update)
      if (this._root && dt > 1e-4) {
        const v = Math.min(_b.subVectors(p, this._root).setY(0).length() / dt, 15);
        this.speed += (v - this.speed) * (1 - Math.exp(-6 * dt));
      }
      (this._root ??= new THREE.Vector3()).copy(p);
    }
    this.air = ctx.mode === 'air' ? this.air + dt : 0;
    const T = (this.targets = handTargets({ ...ctx, speed: ctx.speed ?? this.speed, air: ctx.air ?? this.air }));
    for (const S of this.sides) {
      const w = T[S.s];
      mixPose(w, S.goal);
      easePose(S.cur, S.goal, T.rate, dt);
      S.tight += (tightness(w) - S.tight) * (1 - Math.exp(-T.rate * dt));
      this.inertia(S, dt);
    }
    this.apply();
  }

  /** The fingers lag behind the wrist: a damped spring driven by the wrist's acceleration across the palm. */
  inertia(S, dt) {
    const hand = S.hand;
    if (!hand || dt <= 1e-4) return;
    const p = _a.setFromMatrixPosition(hand.matrixWorld);
    if (!S.last) { S.last = p.clone(); S.vel = new THREE.Vector3(); return; }
    const v = _b.subVectors(p, S.last).divideScalar(dt);
    S.last.copy(p);
    if (v.lengthSq() > 400) { S.vel.set(0, 0, 0); return; }   // (a teleport, a respawn)
    const acc = _c.subVectors(v, S.vel).divideScalar(dt);
    S.vel.copy(v);
    if (acc.lengthSq() > 120 * 120) acc.setLength(120);
    // the palm's facing now, in the world: its rest facing turned as the hand has turned
    hand.matrixWorld.decompose(_n, _q, _b);
    _n.copy(S.normal).applyQuaternion(_q.multiply(_qi.copy(S.restHandQ).invert()));
    const an = acc.dot(_n);
    const w = 14, z = 0.45;   // (a quick, light spring: the fingers are small)
    S.lagV += (-w * w * S.lag - 2 * z * w * S.lagV - an * HANDS.lag * w * w) * dt;
    S.lag += S.lagV * dt;
    S.lag = Math.max(-HANDS.lagMax, Math.min(HANDS.lagMax, S.lag));
  }

  /** Write the hands' poses (plus the drift and the lag) onto the finger bones. */
  apply() {
    const t = this.t;
    for (const S of this.sides) {
      const P = S.cur, loose = this.live ? (1 - S.tight) * (1 - S.tight) : 0, lag = S.lag * (1 - 0.7 * S.tight);
      const kf = this.reach.fingers, kt = this.reach.thumb;
      for (const J of S.joints) {
        const ph = this.seed * 9 + J.i * 1.7 + (S.s === 'l' ? 3.1 : 0);
        const drift = HANDS.drift * loose * (0.6 * Math.sin(t * 0.43 + ph) + 0.4 * Math.sin(t * 0.91 + ph * 1.3)) * J.tip;
        const q = J.b.quaternion.copy(J.rest).multiply(_q.setFromAxisAngle(J.curl, J.zero + kf * (P[J.i] + drift + lag * J.tip)));
        if (J.fan) q.multiply(_q2.setFromAxisAngle(J.fan, kf * P[SPREAD] * J.fanK));
      }
      for (const J of S.thumb) {
        const drift = HANDS.drift * 0.6 * loose * Math.sin(t * 0.37 + this.seed * 7 + (S.s === 'l' ? 2 : 0));
        const q = J.b.quaternion.copy(J.rest);
        if (J.j === 0) {
          q.multiply(_q.setFromAxisAngle(J.roll, kt * (P[T_ROLL] + drift)));
          if (J.in) q.multiply(_q.setFromAxisAngle(J.in, kt * P[T_IN]));
          q.multiply(_q.setFromAxisAngle(J.bend, kt * P[T_BEND] * 0.4));
        } else q.multiply(_q.setFromAxisAngle(J.bend, kt * (P[T_BEND] * (J.j === 1 ? 1 : 0.8) + drift * 0.5)));
      }
      S.hand.updateMatrixWorld(true);
    }
  }
}

// ------------------------------------------------------------------ the game's contexts
const _v = new THREE.Vector3();

/** The traveller's hands (src/player.js state, read only). */
export function playerHands(p) {
  const mode = p.down ? 'down' : p.mantle ? 'mantle' : p.climbing ? 'climb' : p.ride ? 'ride' : p.swim ? 'swim'
    : p.gliding ? 'glide' : p.onJets ?? p.thrusting ? 'jet' : !p.onGround && !p.overlay ? 'air' : 'ground';
  const U = p.frame?.up ?? _v.set(0, 1, 0);
  const speed = p.vel ? Math.sqrt(Math.max(0, p.vel.lengthSq() - p.vel.dot(U) ** 2)) : 0;
  return { mode, ride: p.ride?.kind, speed, aim: p.aim?.k ?? 0, handoff: p.handoffGrip?.() ?? 0, sword: p.swordGrip ?? 0, shield: p.shieldGrip ?? 0 };
}

/** Someone's hands (src/npc.js state, read only): a story person, or a crowd person's pooled body. */
export function npcHands(n) {
  const p = n.person;
  const now = p ? n.crowd?.time ?? 0 : n.time ?? 0;
  const pose = p ? (p.speed > 0.05 ? 1 : p.pose) : n.seat ? 4 : 0;
  const stumble = p ? now < (p.stumbleUntil ?? -1) : now < (n.stumbleUntil ?? -1);
  const since = p ? now - (p.startleT ?? -99) : now - (n.startleAt ?? -99);
  return {
    mode: n.down ? 'down' : pose === 3 || pose === 4 ? 'seated' : pose === 2 ? 'rail' : 'ground',
    speed: p ? p.speed : undefined,
    prop: n.humanoid?.stowed ? null : n.look?.prop,   // (put away on the back while walking: nothing in hand)
    startle: stumble ? 1 : since >= 0 && since < 0.9 ? 1 - since / 0.9 : 0,
  };
}

/** The gesture of someone speaking (their talking face, src/talk-face.js): { tone, k, beat }, or null. */
export function talkOf(h, faces = gameFaces) {
  const f = faces?.faces?.get(h);
  if (!f || f.quiet) return null;   // (a face worn without a word: the hands stay still)
  const k = Math.max(f.talk ?? 0, f.hold > 0 ? Math.min(1, f.hold / 0.6) * 0.8 : 0);
  return k > 0.01 ? { tone: f.tone, k, beat: Math.min(1, (f.open ?? 0) * 1.6) } : null;
}

/** Once a frame (main.js, after the people and the talking faces): the traveller's hands, and those near the camera. */
export function updateHands(dt, { player = null, npcs = [], camera = null, faces = gameFaces } = {}) {
  const H = player?.humanoid;
  if (H?.hands && player.object?.visible !== false) H.hands.update(dt, { ...playerHands(player), talk: talkOf(H, faces) });
  for (const n of npcs) {
    const h = n.humanoid;
    if (!h?.hands || n.object?.visible === false) continue;
    const near = (n.lowDetail ? HANDS.nearLow : HANDS.near) * Math.max(1, n.object?.scale?.x ?? 1);
    if (camera && camera.position.distanceToSquared(n.pos) > near * near) continue;
    h.hands.update(dt, { ...npcHands(n), talk: talkOf(h, faces) });
  }
}
