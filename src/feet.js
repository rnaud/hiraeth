import * as THREE from 'three';
import { worldPos, worldQuat } from './world-read.js';

// Feet on the ground (Humanoid.plantFeet): a foot the gait puts down is locked to the real ground
// where it lands and held there, its place and its way, while the body moves over it; the legs
// reach it by two-bone IK and the hips come down when it is out of reach (slopes, stairs).
//
//  - When: the clip's phase says (Animator.contact, from the loops' own foot contacts: analyseGait),
//    with hysteresis, so a foot never flickers between held and free as the pose blends. Without
//    an animator the clip foot's height decides, as before.
//  - The stride: the loops sweep a planted foot back faster than the body moves at game speeds
//    (STRIDE_K); every foot's forward reach from the hips is scaled by `warp` (body speed over the
//    loop's sweep), so the clip's foot and the held one move alike and a foot leaves the ground
//    where the clip lifts it, not a few centimetres off.
//  - Standing: the feet hold where they are, so turning on the spot or stopping mid-stride leaves
//    them behind; once one is too far from where the standing pose wants it (or twisted too far),
//    it takes a short step there (one foot at a time): the settling step after a stop, the
//    stepping round of a turn. `pivot` (a fast turn on the spot): the more settled foot turns on
//    its ball with the body, the other steps round.
//  - Slopes: a held foot lies along the ground (the ball stays on it, the heel doesn't sink).

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _qr = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qd = new THREE.Quaternion();

export const FEET = {
  lockAt: 0.6, unlockAt: 0.35,   // contact (0..1) to plant a foot / to let it go
  release: 0.6,                  // m (x body size): a held foot this far from the clip's lets go
  restGait: 0.25,                // under this share of locomotion the body is standing: settling steps
  restKeep: 0.05,                // and standing stays so till the share is this much over it
  stepFar: 0.13,                 // m (x size): a standing foot this far from its place steps there
  stepTwist: 0.6,                // rad: or this twisted from the way the body faces
  stepTime: 0.3, stepLift: 0.07, // s, m: one settling step
  pivotStepTime: 0.17,           // s: a step round in a pivot
  pivotYawRate: 14,              // rad/s: the most a pivoting foot turns on its ball (0: at once)
  pivotPlant: 0.05,              // m (x size): a free foot a pivot plants at once is no higher than this (else it comes down as the gait says)
  landPlanted: true,             // and only if the gait has the foot down (else it goes with the stride from where it is)
  pivotFinish: 0.5,              // share of a pivot's step past which, the pivot ending, it goes on to its place before the stride takes it (0: never)
  pivotLand: 0.75,               // share of a pivot's step past which, the pivot ending, it lands rather than goes with the stride
  pivotStepSpeed: 2.5,           // m/s (x size): faster, a pivot is about to end in a stride (LOCO.pivotSpeed): a held foot out of reach waits for the gait
  pivotOverlap: 0.6,             // share of a pivot's step after which the other foot, out of reach, may lift (a pivot that sets off)
  stepLead: 0.4,                 // m (x size): the most a step's place is led by the body's travel (it lands where its place will be)
  stepGap: 0.05,                 // m (x size): a step sets the foot down at least this far to its own side of the other, held one
  stepPathGap: 0.12, stepPathRate: 20,   // m (x size), 1/s: a pivot's step round keeps this far to its own side of the other foot on its way, eased
  stepMove: [0.1, 0.85],         // shares of a settling step: it goes over from the first to the second (null: over the whole step)
  stepRest: 0.06,                // s between two steps
  reachGrace: [0.1, 1, 0.08],    // s, m/s, m (x size): a foot set down this long ago, under this speed or this far under the body's floor (a step
                                 // down), lets go out of reach only past the hips' whole drop (a stop's last step set down out of reach was let go in
                                 // the frame it landed and planted again 4 frames on, 27-36 rad/s; down a flight at a jog, a foot set on the step
                                 // below before the body came down was let go in the frame it landed, the calf 26-31 rad/s, and slid the step through)
  maxDrop: 0.26,                 // m (x size): how far the hips may come down to reach a low foot
  landTime: 0.07, landHeight: 0.15,   // s, m (x size): a landing foot slows over the ground in its last moments before touchdown
  landEase: true,                // its speed eased off to nothing at touchdown (false: held back toward where it was by the share of landTime gone)
  landBack: 0.3,                 // m (x size): by at most this much (0.14 before issue #47's sprint: its foot travels 22 cm over the last moments;
                                 // 0.2 before the running 180° turn's, carried round the body at 11 m/s, which went on at the limit into touchdown)
  plantShown: [0.22, 6],         // m (x size), m/s (x size): a free foot touching down this near where it was drawn, drawn moving slower than this,
                                 // holds where it was drawn (planted at the clip's place, it lunged 5-6 cm on in the frame it touched down at a sprint)
  releaseMin: 0.03, dragSpeed: 5.5,   // m (x size), m/s: a foot let go out of reach under this speed, the clip's foot still on the ground,
                                 // rises at least this high as it eases off (dragged along the floor, 3-10 cm a frame, as a run sets off)
  // (the motion QC, .claude/skills/motion-qc: what made the legs pop)
  soft: 0.035,                   // share of the leg's length over which it eases to straight (soft IK): no knee locking straight for frames and snapping bent
                                 // (0.02 on the coral-shirt v1; B3's knee, 14-19 rad/s at a walk's and a ramp's lift-off with it, issue #47)
  softStand: [0.3, 1, 0.02],     // m/s, m/s, share: under the first speed (standing) it narrows to this, eased in by the second
  softFast: [4, 7, 0.05],        // m/s, m/s, share: from the first speed to the second it widens to this (a sprint's hips go 14 cm a frame, through the
                                 // whole of a 2 % zone in one; standing, a wide one keeps the legs from their rest length and they twitch)
  softFlight: [0.15, 0.4, 0.12], // pitch, pitch, share: up or down a flight at a run (o.flight, the stairs' line's rise a metre), from the first pitch
                                 // to the second it widens to this (null: as on the level)
  pushOff: [4.5, 7, 0.05, 0.05, 0.03], // m/s, m/s, s, share, s: from the first speed to the second a moving held foot lets go once the hips, this far ahead
                                 // at the body's speed, would have its leg within this share of its full length (the release's spring takes the rest)
  relockSlow: [3, 0.03, 5],      // m/s, m (x size), m/s: under this speed a foot let go out of reach (pushOff) at over the third, the contact still full,
                                 // plants again within this of the ground (a sprint braking hard; not a walk's: a calf pop setting off)
  pushOffBrake: true,            // and the hips' lead counts the body's braking (false: its speed alone)
  pushOffBack: [2.5, 3.5, 0.05, 0.1, 0.03],   // the same walking back (o.reverse): from a slower speed, within a wider share
  toeOff: 0.7,                   // a foot let go leaves its hold along the ground as w^toeOff (1: as it rises)
  toeOffTail: true,              // as 1 - (1 - w)^(1 / toeOff) instead: as slowly at first, all gone at the end
  releaseArc: [1, 0.12],        // share of the way, m (x size): a foot let go far from the clip's goes over there in an arc this high
  releaseLag: 40, releaseLagRise: 0.06, releaseLagLevel: 0.999,   // 1/s, m (x size), cos: a foot let go from a tread this level with the clip's this far over it (up a step) eases off toward an eased goal (0: at once)
  holdRate: 45, releaseRate: 30, // 1/s: a foot eases onto its hold and off it as a critically damped spring (from rest), not at once
  earlyShown: 0.05,              // a foot this much or more on an old hold still plants early only once it is drawn near the ground too
  dropShown: 0.05,               // a foot planted where it is drawn, this much or more on an old hold still, comes down from the height it is drawn at (its release's arc)
  rideOver: [4.5, 6.5, 0.1, 0.06, 0.2, 0.1],   // m/s, m/s, m, m (x size), s, s: from the first speed to the second, a free foot over a higher floor rises only
                                 // to clear it by min(its own height, the third) (a smooth max, this soft) (null: by the floor's whole rise, on top)
  dropKeep: true,                // a foot let go while still coming down onto its hold goes on coming down as it eases off (false: at once)
  ballTurn: [0.4, 14],           // rad, rad/s: moving, a held foot turned more than this from the clip's way turns on its ball toward it this fast (null: never)
  lateRelease: [0.1, 0.15],      // s, share: a foot let go this soon before the clip's touchdown lands only once this little is left on its old hold (null: as any)
  relockKeep: 0.05,              // a foot planted and let go in one frame, this much or more on its old hold, goes on easing off it
  footRate: 12,                  // rad/s: the most a foot turns against the body (0: as the clip)
  footLag: 0.5,                  // rad: and it falls no further than this behind (0: any, set to the clip's past 1.5 rad)
  rideRate: 25, rideUp: 0,       // 1/s: a free foot follows a fall / a rise of the floor's height under it (a stair) this fast (0: at once)
  rideSpring: true,              // as a critically damped spring (false: eased at the rate, a step in its speed)
  rideAhead: 0.1, rideAheadRate: 60,   // s, 1/s: and rises toward the floor this far ahead along its way, this fast (a step up)
  rideDownAhead: [6, 0.999],     // [m/s, cos]: under this speed, over a tread this level, a free foot rides down toward the floor ahead along its way too (a stair down; null: never)
  rideAheadSpring: true,         // as a critically damped spring from rest (false: eased at the rate, its full speed at once)
  clearAhead: 0.06, clearAheadMax: 0.2, clearRise: 30, clearFall: 10, clearSink: 0.03,   // a free foot's lift over a stair: s it looks ahead, 1/s it eases up and down, m (x size) it may dip under before it follows at once
};

const newFoot = () => ({ locked: false, w: 0, pos: new THREE.Vector3(), yaw: new THREE.Vector3(0, 0, 1), n: null, released: false, lastHeight: undefined, step: null, lift: 0, lastSwing: null, gRide: undefined });

/**
 * The way a foot points, flat on the plane of `up`: the foot bone's own turn applied to its rest
 * way (the rest ankle -> ball, laid flat). Returns how flat the foot lies (1: level, 0: toes
 * straight down or up). (The ankle -> ball line itself won't do: on a body whose ankle sits high
 * over the ball, the traveller's, it is steep, so a little roll of the foot swung its flat part
 * through tens of degrees and its flatness hovered at the threshold: the way jumped between the
 * foot's and the body's from frame to frame, the held foot snapped round and took a settling
 * step, over and over: a leg twitching at idle.)
 */
function footWay(H, s, up, out) {
  const foot = H.b[`foot_${s}`];
  const local = ((H._footWay ??= {})[s] ??= (() => {
    const r = H.rest.get(foot), v = H.rest.get(H.b[`ball_${s}`]).p.clone().sub(r.p);
    v.y = 0;   // (character space: y is up at rest)
    return v.normalize().applyQuaternion(r.q.clone().invert());
  })());
  out.copy(local).applyQuaternion(worldQuat(foot, _q3));
  out.addScaledVector(up, -out.dot(up));
  const flat = out.length();
  if (flat > 1e-4) out.divideScalar(flat); else out.set(0, 0, 0);
  return flat;
}

const _goal = new THREE.Vector3(), _side = new THREE.Vector3(), _nd = new THREE.Vector3();
/**
 * Where a stepping foot (side s) sets down: `place`, moved out to its own side of the other foot, `gap` beside it
 * (in the body's frame: the left foot left of the right one) when that one is held. Into `out`.
 */
function ownSide(place, other, s, fwd, up, gap, out, always = false) {
  out.copy(place);
  if (!(other.locked || (always && other.step)) || !(gap > 0)) return out;
  const left = _side.crossVectors(up, fwd);
  if (left.lengthSq() < 1e-8) return out;
  left.normalize();
  const sign = s === 'l' ? 1 : -1, lat = _e.subVectors(place, other.pos).dot(left) * sign;
  if (lat < gap) out.addScaledVector(left, (gap - lat) * sign);
  return out;
}

/**
 * A pivoting foot turning on its ball toward the way the clip's points (`way`), no faster than FEET.pivotYawRate: set to it
 * at once as a pivot began, the held foot and the knee over it turned 20-30° in a frame, the calf flicking 30 rad/s, issue #47.
 */
function pivotYaw(yaw, way, up, dt) {
  const a = yawBetween(yaw, way, up), max = FEET.pivotYawRate * dt;
  if (!(FEET.pivotYawRate > 0) || Math.abs(a) <= max) { yaw.copy(way); return; }
  yaw.applyAxisAngle(up, Math.sign(a) * max);
}

/** Signed angle (about up) from a to b, both flat. */
function yawBetween(a, b, up) {
  if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return 0;
  return Math.atan2(_e.crossVectors(a, b).dot(up), a.dot(b));
}

const _r1 = new THREE.Vector3(), _r2 = new THREE.Vector3(), _r3 = new THREE.Vector3(), _r4 = new THREE.Vector3(), _r5 = new THREE.Vector3();
const _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rq3 = new THREE.Quaternion();
/** Aim a bone along a world direction as Humanoid.update does: a swing from its rest direction (no twist picked up on the way). */
function aimFromRest(H, bone, child, dirWorld, rootQ) {
  const r = H.rest.get(bone), rc = H.rest.get(child);
  const restDir = _r4.subVectors(rc.p, r.p).normalize();
  const want = _r5.copy(dirWorld).applyQuaternion(_rq3.copy(rootQ).invert());
  const q = _rq.setFromUnitVectors(restDir, want.normalize()).multiply(r.q).premultiply(rootQ);   // world
  bone.quaternion.copy(worldQuat(bone.parent, _rq2).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone IK for a leg: the ankle onto `target`, the knee bent toward `pole`; thigh and shin are
 * aimed from their rest pose (as the clip's legs are), so a leg held far from the clip's never
 * picks up a sudden twist of the thigh or the shin.
 */
function legIK(H, s, target, pole, soft = FEET.soft) {
  const B = H.b, a = B[`thigh_${s}`], b = B[`calf_${s}`], c = B[`foot_${s}`];
  const A = worldPos(a, _r1), K = worldPos(b, _r2), C = worldPos(c, _r3);
  const la = A.distanceTo(K), lb = K.distanceTo(C);
  const dir = _a.subVectors(target, A);
  // soft IK: past (1 - soft) of the leg's length the reach eases toward straight instead of meeting it, so a leg pulled
  // out of reach (a held foot left behind, a long stride) doesn't lock straight for frames and snap bent as it lets go
  const L = la + lb, ds = L * (1 - soft), raw = dir.length();
  const reach = raw > ds && soft > 0 ? ds + (L * 0.999 - ds) * (1 - Math.exp(-(raw - ds) / (L * 0.999 - ds))) : raw;
  const d = THREE.MathUtils.clamp(reach, Math.abs(la - lb) + 1e-3, L * 0.999);
  dir.normalize();
  const along = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(la * la - along * along, 0));
  const pd = _b.subVectors(pole, A);
  pd.addScaledVector(dir, -pd.dot(dir));
  if (pd.lengthSq() < 1e-8) pd.subVectors(K, A).addScaledVector(dir, -_c.subVectors(K, A).dot(dir));
  pd.normalize();
  const knee = _c.copy(A).addScaledVector(dir, along).addScaledVector(pd, h);
  const end = _d.copy(A).addScaledVector(dir, d);
  const rootQ = worldQuat(H.char.root, new THREE.Quaternion());
  aimFromRest(H, a, b, _e.subVectors(knee, A), rootQ);
  aimFromRest(H, b, c, _e.subVectors(end, worldPos(b, _r2)), rootQ);
}

export function resetFeet(H) {
  const S = H._feet;
  if (!S) return;
  for (const s of ['l', 'r']) Object.assign(S[s], { locked: false, w: 0, wv: 0, dropIn: 0, shown: null, shownV: 0, dragged: false, gRideV: 0, footQ: null, released: false, lastHeight: undefined, step: null, lift: 0, lastSwing: null, gRide: undefined });
  S.drop = 0; S.cool = 0; S.lastRoot = null;
}

/**
 * @param H       the Humanoid (posed for this frame by update())
 * @param o.contact { l, r } 0..1 from the animator (else the clip feet's heights decide)
 * @param o.warp    the stride's scale (1: the clip's)
 * @param o.gait    the locomotion loops' share of the pose (0 standing .. 1)
 * @param o.pivot   turning fast on the spot
 * @param o.scale   the body's size (default: its root's scale)
 * @param o.steps   take settling steps when standing (default: with a contact)
 * @param o.carry   how far a moving floor carried the body this frame (the held feet go with it)
 * @param o.reverse walking back (the gait run backwards, locked on): FEET.pushOffBack
 */
export function plantFeet(H, dt, physics, up, rootPos, fwd, onStep, o = {}) {
  const B = H.b;
  const S = (H._feet ??= { l: newFoot(), r: newFoot(), drop: 0, cool: 0 });
  S.cool = Math.max(0, (S.cool ?? 0) - dt);
  // standing on a moving floor (a riding disc, a taxi's roof): the held feet go where it took the body
  if (o.carry && o.carry.lengthSq() > 0) for (const s of ['l', 'r']) { const F = S[s]; F.pos.add(o.carry); F.step?.from.add(o.carry); F.step?.goal?.add(o.carry); F.land?.add(o.carry); }
  const sc = o.scale ?? H.char.root.scale.y ?? 1;
  // the body's own speed along the ground this frame (a moving floor's carry taken out): a step sets down where its place
  // will be when it lands, not where it is now (a pivot that turns into a start: the place runs on at 2 m/s, and the
  // stepping foot touched down sliding with it, the motion QC's 20 cm "steps", issue #288)
  const bodyV = (S.bodyV ??= new THREE.Vector3());
  if (S.lastRoot && dt > 0) {
    bodyV.subVectors(rootPos, S.lastRoot);
    if (o.carry) bodyV.sub(o.carry);
    bodyV.addScaledVector(up, -bodyV.dot(up)).divideScalar(dt);
  } else bodyV.set(0, 0, 0);
  (S.lastRoot ??= new THREE.Vector3()).copy(rootPos);
  // (and how fast that speed is changing: a running reversal brakes from 8 m/s at 100 m/s², FEET.pushOffBrake)
  const bodyA = (S.bodyA ??= new THREE.Vector3());
  if (S.lastBodyV && dt > 0) bodyA.subVectors(bodyV, S.lastBodyV).divideScalar(dt); else bodyA.set(0, 0, 0);
  (S.lastBodyV ??= new THREE.Vector3()).copy(bodyV);
  const contact = o.contact ?? null, warp = o.warp ?? 1, gait = o.gait ?? (contact ? 0 : 1);
  // a fast turn at low speed (a pivot): both feet stay down and step round, quicker, whatever the gait's phase says
  const pivoting = !!(o.pivot && contact && (o.steps ?? true));
  // (standing stays standing while the gait's share settles: as a pivot ended its gait passed 0.25 for one frame on its way
  // down, the settling step under way was cut short and set down again the next, a 25 rad/s calf, issue #47. Not as it
  // rises, setting off: a pivot that turns into a start held its foot on a frame or two too long, 2-3 cm, the Arena)
  const settling = S.standing && !pivoting && gait <= (S.gaitWas ?? gait) + 1e-3;
  const standing = contact && (gait < FEET.restGait + (settling ? FEET.restKeep : 0) || pivoting) && (o.steps ?? true);
  S.standing = standing; S.gaitWas = gait;
  const still = standing && ((o.speed ?? 0) < 0.6 || pivoting);   // (setting off: the gait's first step comes, no settling step)
  const ballRest = H.rest.get(B.ball_l).p.y * sc;
  H.ankleRest ??= H.rest.get(B.foot_l).p.y;   // the ankle over the sole at rest
  H.legLen ??= H.rest.get(B.thigh_l).p.distanceTo(H.rest.get(B.calf_l).p) + H.rest.get(B.calf_l).p.distanceTo(H.rest.get(B.foot_l).p);
  const pelvis = worldPos(B.pelvis, _a).clone();
  const D = {};
  // (a running stride's push-off: the held foot is let go a moment before the hips, at 6-8 m/s, would carry the leg out of its
  // reach: let go at its full length, the knee straightened 30° a frame and stopped dead for two frames while the release eased
  // in, a calf pop at every step of a sprint, issue #47)
  // (and walking back, locked on (o.reverse): the loops' gait run backwards lifts a foot where it came down, in front, the leg
  // at its full length; let go there, the knee snapped bent, a calf pop at every step back, 14 in 8 s, issue #47: FEET.pushOffBack)
  const PO = o.reverse && FEET.pushOffBack ? FEET.pushOffBack : FEET.pushOff;
  const pushOff = (far, thigh, F, d, speed, sc) => {
    const k = THREE.MathUtils.smoothstep(speed, PO[0], PO[1]);
    if (!(k > 0) || !(dt > 0) || (F.heldT ?? 0) < PO[4]) return false;
    // (where the hips will be, braking counted: read at the body's speed alone, a running reversal's first frame, braking
    // from 8 m/s, let the stance foot go with the clip's contact still full, and it skimmed the floor 5-12 cm a frame as the
    // body turned, the game's sprint reversed, issue #47)
    const T = PO[2] * k, lead = _b.copy(bodyV).multiplyScalar(T);
    if (FEET.pushOffBrake) { const along = bodyA.dot(bodyV); if (along < 0) { const v2 = Math.max(bodyV.lengthSq(), 1e-6); lead.addScaledVector(bodyV, Math.max(-T, 0.5 * T * T * along / v2)); } }
    const ahead = worldPos(thigh, _d).add(lead).distanceTo(_c.copy(F.pos).add(_e.subVectors(d.ankle, d.ball)));
    return ahead > far && ahead > H.legLen * sc * (1 - PO[3]) + Math.min(S.drop, FEET.maxDrop * sc);
  };
  for (const s of ['l', 'r']) {
    const F = S[s];
    F.lockedNow = false;
    const ankle = worldPos(B[`foot_${s}`], new THREE.Vector3());
    const ball = worldPos(B[`ball_${s}`], new THREE.Vector3());
    // the stride warp: the foot's reach ahead of / behind the hips, scaled
    if (Math.abs(warp - 1) > 1e-3) {
      const along = _b.addVectors(ankle, ball).multiplyScalar(0.5).sub(pelvis).dot(fwd);
      const shift = _c.copy(fwd).multiplyScalar(-along * (1 - warp));
      ankle.add(shift); ball.add(shift);
    }
    // (and along o.reach.dir by o.reach.k: a locked-on step played slower than the body moves, issue #47)
    if (o.reach) {
      const along = _b.addVectors(ankle, ball).multiplyScalar(0.5).sub(pelvis).dot(o.reach.dir);
      const shift = _c.copy(o.reach.dir).multiplyScalar(along * (o.reach.k - 1));
      ankle.add(shift); ball.add(shift);
    }
    const hBall = _b.subVectors(ball, rootPos).dot(up);
    const gh = physics.heightAbove(_b.copy(ball).addScaledVector(up, 1.2), up, 0);
    const groundH = Number.isFinite(gh) ? 1.2 - gh : -hBall;   // how far the ground is above the ball (none found: the root's plane)
    // the way the foot points, flat on the ground (toes pointing down: the body's way, it flips there)
    const way = new THREE.Vector3(), flat = footWay(H, s, up, way) > 0.6;
    if (!flat) way.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize();
    // where this foot would stand on the ground now (the clip's place for it)
    const place = ball.clone().addScaledVector(up, groundH + ballRest);
    let planted;
    // (a foot coming down onto the real ground plants as it touches it, a frame or two before the clip's contact would)
    let clear = -groundH - ballRest;   // the ball's sole over the ground under it
    // the end of a swing: the loops' foot still travels with the body as it comes down (it skims
    // in to land); a real foot slows over the ground as it meets it. In its last moments it is held
    // back toward where it was then, by at most FEET.landBack (more and the stance would end with
    // the foot out of the leg's reach)
    const ttc = o.toContact?.[s] ?? Infinity;
    if (contact && !F.locked && !F.step && F.aloft && ttc < FEET.landTime && clear < FEET.landHeight * sc) {
      let back;
      if (FEET.landEase) {
        // (slowed from its speed as it came over the ground to nothing at touchdown: the share of its place's travel it keeps
        // falls from 1 to 0 over the moments left (held back toward where it was as it came over the ground, by the share of
        // landTime gone, it kept a third of its speed in the first frame: a foot swung round at 13 m/s by a running 180° turn
        // stopped from 22 cm a frame to 7, a 4.5 cm jolt, issue #47))
        if (!F.land) { F.land = place.clone(); F.landAt = (F.landAt ?? new THREE.Vector3()).copy(place); F.landT0 = Math.max(ttc, 1e-3); }
        F.land.addScaledVector(_b.subVectors(place, F.landAt), THREE.MathUtils.clamp(ttc / F.landT0, 0, 1));
        F.landAt.copy(place);
        back = _b.subVectors(F.land, place);
        back.addScaledVector(up, -back.dot(up));
        // (at most landBack, reached smoothly: clamped, the foot went from its eased speed back to the clip's in a frame)
        const raw = back.length(), lim = FEET.landBack * sc;
        if (raw > 1e-6) back.multiplyScalar(lim * Math.tanh(raw / lim) / raw);
      } else {
        F.land ??= place.clone();
        back = _b.subVectors(F.land, place);
        back.addScaledVector(up, -back.dot(up)).clampLength(0, FEET.landBack * sc).multiplyScalar(1 - ttc / FEET.landTime);
      }
      place.add(back); ankle.add(back); ball.add(back);
    } else if (F.locked || F.step || ttc > FEET.landTime * 1.5) F.land = null;
    // (held: let go once the gait's contact falls away, not while it is still rising at a touchdown)
    // (early, by where it is drawn too: a foot still easing off an old hold goes over in its release's arc, 8-12 cm over the
    // clip's, and planted early as the clip's came near the ground it was set down from up there, the calf 38 rad/s as the
    // running 180° turn came in, issue #47)
    const early = FEET.earlyShown && F.w > FEET.earlyShown && F.shown ? Math.max(clear, _b.subVectors(F.shown, place).dot(up)) : clear;
    const c = contact?.[s] ?? 0, dc = c - (F.lastC ?? c), falling = dc < -0.002, rising = dc > 0.004;
    F.lastC = c;
    // (a foot swinging high as a pivot begins, a sprint reversed through it, isn't set down where it is in the air: it was,
    // planted 15 cm up and pulled down onto the ground in a frame as the pivot ended, the calf 12 cm off its path, issue #47)
    if (pivoting) planted = F.locked || !!F.step || c > FEET.lockAt || clear < FEET.pivotPlant * sc;
    else if (contact) planted = F.locked || F.step ? c > FEET.unlockAt || !falling : (contact[s] > FEET.lockAt && hBall < ballRest + 0.14 * sc) || (F.aloft && !falling && ((contact[s] > 0.15 && early < 0.06 * sc) || (contact[s] > 0.02 && early < 0.025 * sc)))
      // (a lift-off that never left the ground, the contact coming back as the body stops: down again where it is)
      || (!F.aloft && rising && c > 0.2 && clear < 0.03 * sc);
    else {
      const rising = F.lastHeight !== undefined && hBall - F.lastHeight > dt * 0.12;
      planted = hBall < ballRest + (F.locked ? 0.09 : 0.04) * sc && !rising;
    }
    if (!F.locked && !F.step && clear > 0.07 * sc) F.aloft = true;   // (a foot only plants early coming down, not just as it lifts off)
    const vy = F.lastHeight !== undefined && dt > 0 ? (hBall - F.lastHeight) / dt : 0;
    F.lastHeight = hBall;
    D[s] = { ankle, ball, hBall, groundH, way, flat, place, planted, finite: Number.isFinite(gh), clear, vy };
  }

  // standing: settling steps (one foot at a time)
  if (still && !S.l.step && !S.r.step && S.l.locked && S.r.locked) {
    const score = {};
    for (const s of ['l', 'r']) {
      const F = S[s], d = D[s];
      const off = _b.subVectors(F.pos, d.place);
      off.addScaledVector(up, -off.dot(up));
      score[s] = off.length() / (FEET.stepFar * sc) + Math.abs(yawBetween(F.yaw, d.way, up)) / FEET.stepTwist;
    }
    // a fast turn: the more settled foot turns on its ball (it keeps its place, not its way)
    if (o.pivot) { const p = score.l < score.r ? 'l' : 'r'; pivotYaw(S[p].yaw, D[p].way, up, dt); score[p] = 0; }
    const s = score.l > score.r ? 'l' : 'r';
    if (score[s] > 1 && S.cool <= 0 && D[s].finite) {
      const F = S[s];
      F.step = { from: F.pos.clone(), fromYaw: F.yaw.clone(), t: 0, quick: pivoting };
      F.locked = false;
    }
  } else if (standing && o.pivot) {
    for (const s of ['l', 'r']) if (S[s].locked && !S[s === 'l' ? 'r' : 'l'].step) { pivotYaw(S[s].yaw, D[s].way, up, dt); break; }
  } else if (FEET.ballTurn && !standing) {
    // (moving, a held foot turned further than BT[0] from the way the clip's points turns on its ball toward it, at most
    // BT[1] rad/s: a running reversal turned the body half round over its held foot, and as it was let go the knee, bent
    // over the toes pointing back, swung across to the front, 7-8 cm a frame, the calf 18-21 rad/s, issue #47)
    const BT = FEET.ballTurn;
    for (const s of ['l', 'r']) {
      const F = S[s];
      if (!F.locked || F.step) continue;
      const a = yawBetween(F.yaw, D[s].way, up), over = Math.abs(a) - BT[0];
      if (over > 0) F.yaw.applyAxisAngle(up, Math.sign(a) * Math.min(over, BT[1] * dt));
    }
  }

  const targets = {}, yaws = {};
  let need = 0;
  // (a foot let go with the clip's touchdown FEET.lateRelease[0] s away or less: it lands only once
  // little is left on its old hold. A pivot that set off into a jog let its held foot go 60 cm from where the jog set it down
  // two frames on: planted again there where it was drawn, pulled 9 cm toward the clip's in the frame between, it stopped
  // dead and its knee snapped, 18-25 rad/s, the game's jog2, issue #47. It goes over in its release's arc to the clip's instead)
  const lateRel = (s) => { const t = o.toContact?.[s] ?? Infinity; return !!(FEET.lateRelease && t > 0 && t < FEET.lateRelease[0] && (contact?.[s] ?? 1) < FEET.lockAt); };
  // (a foot planted and let go again in the same frame (a stop: its place out of the leg's reach as it touched down) goes on
  // from the hold it was leaving: set to its whole hold for that frame, it was thrown from half released back to held and
  // off again, the calf flicking 35-45 rad/s, issue #47)
  const unlockNow = (F) => { if (F.lockedNow && F.wWas > FEET.relockKeep) { F.w = F.wWas; F.wv = F.wvWas; F.lockedNow = false; } };
  for (const s of ['l', 'r']) {
    const F = S[s], d = D[s];
    if (F.step) {
      // a settling step: lifted, over to the foot's place, set down again
      // (walking off: the gait takes the foot from here: it is set down where it is, and lifts when the clip lifts it)
      // (a pivot's step, the pivot ending in a start, goes with the stride from where it is in the air: set down where it
      // was, it came down 6 cm in a frame, was held there three frames, dragged along a few centimetres and lifted again:
      // the Signal Market's street, issue #288; one coming down already lands, from the height it is at, as a foot meeting
      // the ground does: let go, both feet were in the air for a third of a second)
      // (a pivot's step well on its way when the pivot ends finishes first: cut there, set down or let go where it was, the foot
      // stopped dead from 1-2 m/s in a frame, a 3.2-3.5 cm jolt as a turn on the spot became a walk or a jog, issue #47)
      const finish = FEET.pivotFinish > 0 && F.step.quick && F.step.t > FEET.pivotFinish && d.finite;
      if ((!standing || !d.planted) && !finish) {
        // (landing only where the gait has it down: one it lifts, set down and let go in the same frame, dropped its step's
        // height, 3-4 cm, in that frame and rose again, the calf 21 rad/s as a pivot turned into a jog, issue #47)
        const landing = F.step.quick && F.step.t > FEET.pivotLand && (d.planted || !FEET.landPlanted), set = landing || (d.planted && !F.step.quick);
        const above = _b.subVectors(F.pos, d.place).dot(up);
        F.step = null;
        if (set) F.pos.addScaledVector(up, -above);   // (let go: from where it is, in the air)
        if (set) { F.dropIn = Math.max(0, above); F.dropV = 0; }   // (a settling step cut short by setting off, too: set down at once, it dropped 6 cm in a frame)
        F.locked = set; F.released = !set;
      }
      else {
        F.step.t += dt / (F.step.quick ? FEET.pivotStepTime : FEET.stepTime);
        // (over the ground only between FEET.stepMove's shares of the step: lifted first and set down last, so it never travels
        // with its ball still on the floor; over the whole step, a settling step after a pivot came down 3-4 cm a frame along
        // the floor in its last frame, the game's slides)
        const SM = F.step.quick ? null : FEET.stepMove, k = THREE.MathUtils.smootherstep(Math.min(F.step.t, 1), SM ? SM[0] : 0, SM ? SM[1] : 1);
        // (never over the other foot: turning on the spot, the clip's place for the stepping foot may lie across the held
        // one, and the legs crossed for a few frames as it stepped round (the motion QC's pivots): kept to its own side)
        const goal = ownSide(d.place, S[s === 'l' ? 'r' : 'l'], s, fwd, up, FEET.stepGap * sc, _goal, F.step.quick && FEET.stepPathGap > 0);
        // (led by the body's travel over what is left of the step: it comes to rest as it lands, on its place then)
        const left = Math.max(0, 1 - F.step.t) * (F.step.quick ? FEET.pivotStepTime : FEET.stepTime);
        goal.addScaledVector(_c.copy(bodyV).multiplyScalar(left).clampLength(0, FEET.stepLead * sc), 1);
        // (and its place followed less and less over the step's second half: in a fast turn the place swings round the
        // body at a metre or two a second, and a foot that followed it to the end touched down sliding 4-5 cm a frame)
        const follow = 1 - THREE.MathUtils.smoothstep(F.step.t, 0.5, 1);
        F.step.goal = F.step.goal ? F.step.goal.lerp(goal, follow) : goal.clone();
        goal.copy(F.step.goal);
        F.pos.lerpVectors(F.step.from, goal, k);
        // (and on its way there too, in a pivot: a straight line from where it was to its place on the far side, the body
        // turning over it, went across the held foot, the feet crossed for 9 % of a 180° pivot, issue #47)
        if (F.step.quick && FEET.stepPathGap > 0) {
          // (eased, the push out to its side and its letting go, and gone by the time it lands: set at once, the foot jumped 5-6 cm as the other one lifted)
          const want = ownSide(F.pos, S[s === 'l' ? 'r' : 'l'], s, fwd, up, FEET.stepPathGap * sc, _c, true).sub(F.pos);
          const push = (F.step.push ??= new THREE.Vector3());
          push.lerp(want, 1 - Math.exp(-FEET.stepPathRate * dt));
          F.pos.addScaledVector(push, 1 - THREE.MathUtils.smoothstep(F.step.t, 0.5, 0.8));   // (gone before it comes down: no slide as it lands)
        }
        F.pos.addScaledVector(up, Math.sin(Math.PI * Math.min(F.step.t, 1)) * FEET.stepLift * sc);
        // (up onto a stair: the foot rises first and goes over, so its toe doesn't drag up the riser)
        const rise = _b.subVectors(goal, F.step.from).dot(up);
        if (rise > 0.02 * sc) F.pos.addScaledVector(up, rise * (THREE.MathUtils.smootherstep(Math.min(F.step.t * 1.7, 1), 0, 1) - k));
        // (turned round about up: a vector lerp through a half turn, a step round in a pivot, passes near nothing and
        // the foot flipped round in a frame, 97 rad/s)
        // (and the way round kept from frame to frame: a half turn's place swinging past the back flipped the angle from +π to
        // -π, and the foot went round the other way in a frame, 83 rad/s, setting off the other way, issue #47)
        let turn = yawBetween(F.step.fromYaw, d.way, up);
        if (F.step.turn !== undefined) { while (turn - F.step.turn > Math.PI) turn -= 2 * Math.PI; while (turn - F.step.turn < -Math.PI) turn += 2 * Math.PI; }
        F.step.turn = turn;
        F.yaw.copy(F.step.fromYaw).applyAxisAngle(up, turn * k);
        if (F.step.t >= 1) {
          F.step = null; F.locked = true; F.pos.copy(goal); F.yaw.copy(d.way);
          F.n = physics.groundNormal(d.ball.x, d.ball.y + 1.2, d.ball.z, F.n ?? new THREE.Vector3());
          if (F.n.dot(up) < 0.5) F.n.copy(up);
          S.cool = FEET.stepRest; S.lastStep = s;
          onStep?.(_b.copy(d.place).addScaledVector(up, -ballRest), s, F.n);
        }
      }
    }
    if (!F.step) {
      // (or the body slowed right down under a foot let go with the gait's contact still full, its drawn foot on the ground: down
      // again where it is shown. A sprint reversed or stopped as a long stance's foot was pushing off (Kevin Iglesias's sprint,
      // issue #704) let it go, and it skidded 30-45 cm with the body as it braked, the contact never falling to free it again;
      // only a foot let go at a run's speed: a walk's, planted again as it set off, popped the calf 22 rad/s)
      const RS = FEET.relockSlow;
      if (!d.planted || still || (RS && F.released && (F.relV ?? 0) > RS[2] && (contact?.[s] ?? 0) > FEET.lockAt && (o.speed ?? 0) < RS[0] && d.clear < RS[1] * sc)) F.released = false;
      if (F.late && (F.locked || F.step || F.w <= FEET.lateRelease[1])) F.late = false;
      if (d.planted && !F.locked && !F.released && d.finite && !F.late) {
        F.locked = true; F.aloft = false;
        // (it stops where it meets the ground; a foot still partly on an old hold, let go a moment ago, holds where it
        // is shown, on the ground under it: planted at the clip's place, it jumped there, half a metre in a pivot)
        // (and a pivot sets down a foot that was in the air where it is shown too: planted at the clip's place, the ball jumped 16 cm)
        const relock = (F.w > 0.05 || pivoting || (FEET.plantShown && F.shown && F.shown.distanceTo(d.place) < FEET.plantShown[0] * sc && (F.shownV ?? 0) < FEET.plantShown[1] * sc)) && F.shown && F.shown.distanceTo(d.place) > 0.04 * sc;
        // (meeting the ground a few centimetres up, it stops there but comes down onto it at the speed it was falling,
        // easing in: set at 0.65 of its hold at once, the foot dropped 9 cm in a frame at every touchdown at a jog, the
        // foot bone flicking 20 rad/s; eased onto its hold altogether, it slid on with the clip's foot meanwhile)
        F.wWas = F.w; F.wvWas = F.wv ?? 0; F.lockedNow = true;
        F.w = 1; F.wv = 0;
        // (from where it is shown: up a slope or a stair the drawn foot rides the floor ahead of it (gRide) and is still
        // its swing's height over it when the clip's foot, under that floor, meets it: planted from the clip's clearance,
        // the foot dropped 10-13 cm in a frame at every step up the ramp, issue #47)
        let shownUp = d.clear + (F.gRide ?? 0);
        // (held where it is drawn, from the height it is drawn at: a foot still easing off an old hold goes over in its
        // release's arc, 8-12 cm over the clip's, and set down from the clip's height it dropped 8 cm in a frame with its
        // whole weight on, the calf 38 rad/s, as the running 180° turn came in, issue #47)
        if (relock && F.wWas > FEET.dropShown) shownUp = Math.max(shownUp, _b.subVectors(F.shown, d.place).dot(up));
        F.dropIn = THREE.MathUtils.clamp(shownUp, 0, 0.25 * sc); F.dropV = Math.min(0, d.vy);
        F.pos.copy(d.place);
        if (relock) F.pos.copy(F.shown).addScaledVector(up, _b.subVectors(d.place, F.shown).dot(up));
        F.yaw.copy(d.way);
        // the slope under the foot: the sole and the footprint lie along it
        F.n = physics.groundNormal(d.ball.x, d.ball.y + 1.2, d.ball.z, F.n ?? new THREE.Vector3());
        if (F.n.dot(up) < 0.5) F.n.copy(up);
        onStep?.(_b.copy(d.place).addScaledVector(up, -ballRest), s, F.n);
      } else if (!d.planted) { if (F.locked) F.late = lateRel(s); F.locked = false; }
      // too far from the clip's foot (a stride that ran away, a teleport): let go (standing: set down again at once)
      // (standing, as after a fast turn on the spot: it steps over there, once the other foot is down,
      // rather than jumping there in a frame; only a real teleport lets go at once)
      if (F.locked && F.pos.distanceTo(d.place) > FEET.release * sc) {
        const other = S[s === 'l' ? 'r' : 'l'], far = F.pos.distanceTo(d.place) > 2 * FEET.release * sc;
        if (still && !far && d.finite) {
          if (!other.step) { F.step = { from: F.pos.clone(), fromYaw: F.yaw.clone(), t: 0, quick: pivoting }; F.locked = false; }
        } else { F.locked = false; F.released = !standing; F.dragged = false; }
      }
      // the body has left a held foot behind, out of the leg's reach (the hips can't come down that
      // fast): it goes with the stride now rather than being dragged along the ground
      // (a pivot too: standing, but a fast turn as he sets off the other way carries the body off at a walk's speed, and
      // the held foot was dragged 4-6 cm over its hold, the leg at its full length and the ball lifting (the Signal
      // Market's street, issue #288): it steps round after the body, quickly, as a pivot's foot does)
      if (F.locked && (!standing || pivoting)) {
        // (in a pivot it steps as soon as the leg comes into its soft end, the stride's slack not there to take it; with
        // the other foot stepping it holds on till that one is coming down (let go at once, it skimmed along the floor; held
        // till it was down, the body ran on 40 cm, the hips sank 16 cm after it and the ball still lifted and dragged), and
        // the foot just set down doesn't go again before it: the other, further behind, was dragged meanwhile)
        const far = worldPos(B[`thigh_${s}`], _d).distanceTo(_c.copy(F.pos).add(_e.subVectors(d.ankle, d.ball)));
        const other = S[s === 'l' ? 'r' : 'l'];
        if (pivoting && bodyV.length() < FEET.pivotStepSpeed * sc && (!other.step || other.step.t > FEET.pivotOverlap) && (S.cool <= 0 || S.lastStep !== s) && d.finite && far > H.legLen * sc * (1 - FEET.soft / 2) + Math.min(S.drop, FEET.maxDrop * sc)) {
          F.step = { from: F.pos.clone(), fromYaw: F.yaw.clone(), t: 0, quick: true }; F.locked = false;
        } else if (!standing && (far > H.legLen * sc + Math.min((F.heldT ?? 0) < FEET.reachGrace[0] && ((o.speed ?? 0) < FEET.reachGrace[1] || _b.subVectors(rootPos, F.pos).dot(up) > FEET.reachGrace[2] * sc) ? FEET.maxDrop * sc : S.drop + 0.03 * sc, FEET.maxDrop * sc) || pushOff(far, B[`thigh_${s}`], F, d, o.speed ?? 0, sc))) { F.locked = false; F.released = true; F.relV = o.speed ?? 0; F.dragged = d.clear < FEET.releaseMin * sc && (o.speed ?? 0) < FEET.dragSpeed; unlockNow(F); F.late = lateRel(s); }
      }
    }
    const held = F.locked || !!F.step;
    F.heldT = F.locked ? (F.heldT ?? 0) + dt : 0;
    // (planting is quick: the foot stops as it meets the ground; letting go is softer)
    // (onto the hold and off it: a critically damped spring, so the foot meets and leaves its hold with no step in its
    // speed: let go at 24/s at once, the knee snapped from straight to bent in a frame at every lift-off, 25 rad/s)
    {
      // (letting go, its goal itself eased from the hold (FEET.releaseLag): from rest at once, the foot's pull toward the clip's
      // came in fully in two frames, and up a flight, where the clip's foot is a riser over the held one, the calf flicked 35 rad/s)
      // (only up onto a step: the clip's place this far over the hold as it is let go (FEET.releaseLagRise); on the level the
      // later release left a running foot behind, dragged)
      // (and from a level tread, a stair's: up a dune's slope a sprint's place is as far over its hold, and eased off later there
      // the knee popped at every other step)
      if (!held && F.heldWas) F.lagOn = FEET.releaseLag > 0 && _b.subVectors(d.place, F.pos).dot(up) > FEET.releaseLagRise * sc && (!F.n || F.n.dot(up) > FEET.releaseLagLevel);
      F.heldWas = held;
      if (held || !F.lagOn) F.wg = held ? 1 : 0;
      else F.wg = (F.wg ?? 0) * Math.exp(-FEET.releaseLag * dt);
      const goal = held ? 1 : F.wg, k = held ? FEET.holdRate : FEET.releaseRate, e = Math.exp(-k * dt), x = F.w - goal, j = (F.wv ?? 0) + x * k;
      F.w = THREE.MathUtils.clamp(goal + e * (x + j * dt), 0, 1); F.wv = e * ((F.wv ?? 0) - j * k * dt);
    }
    // the held foot: the clip's ankle round the held ball, turned to the held way, tilted onto the slope
    // (measured while held, when the foot lies flat; a lifted foot's toes may point down past the
    // ankle, where its flat way flips: the turn it had as it let go fades out instead)
    if (held) F.yawOff = yawBetween(d.way, F.yaw, up);
    const yaw = F.w > 0.01 ? F.yawOff ?? 0 : (F.yawOff = 0);
    yaws[s] = yaw;
    const offset = _b.subVectors(d.ankle, d.ball).applyAxisAngle(up, yaw);
    if (F.n && F.w > 0.01) offset.applyQuaternion(_q.setFromUnitVectors(up, F.n));
    // the foot turns no faster than FEET.footRate against the body: the loops' feet slap flat at a touchdown in a frame
    // at the game's cadence (20 rad/s); over two or three frames instead, turned about the ball so a held one stays put
    F.corr = null;
    if (FEET.footRate > 0 && dt > 0) {
      const rootQ = worldQuat(H.char.root, _qr), clipQ = worldQuat(B[`foot_${s}`], _qc);
      if (F.w > 0.01) { clipQ.premultiply(_qd.setFromAxisAngle(up, yaw * F.w)); if (F.n) clipQ.premultiply(_qd.setFromUnitVectors(up, F.n).slerp(_q3.identity(), 1 - F.w)); }
      const rel = clipQ.premultiply(_qd.copy(rootQ).invert());   // (now the body's frame)
      // (never more than FEET.footLag behind: a pivot's step round turns the foot half a turn in 0.17 s, 35 rad/s, and held to
      // 12 rad/s it fell 1.5 rad behind and was set to the clip's in a frame, 85-93 rad/s, setting off the other way, issue #47)
      const gap = F.footQ ? F.footQ.angleTo(rel) : Infinity;
      if (gap < 1.5) {
        F.footQ.rotateTowards(rel, Math.max(FEET.footRate * dt, FEET.footLag > 0 ? gap - FEET.footLag : 0));
        F.corr = (F.corrQ ??= new THREE.Quaternion()).copy(rootQ).multiply(F.footQ).multiply(rel.invert()).multiply(_qd.copy(rootQ).invert());
        offset.applyQuaternion(F.corr);
      } else (F.footQ ??= new THREE.Quaternion()).copy(rel);
    }
    const lockedAnkle = F.pos.clone().add(offset);
    // (a foot that met the ground a little up comes down onto its hold: a critically damped spring from its fall)
    if (F.dropIn) {
      // (let go before it has come down, it goes on coming down as it eases off: zeroed, a sprint's foot set down on the
      // top stair from its lift, 9 cm over its hold, and let go two frames on, dropped 8 cm in a frame, issue #47)
      if (!held && !(FEET.dropKeep && F.w > 0.01)) F.dropIn = 0;
      else {
        lockedAnkle.addScaledVector(up, F.dropIn);   // (from where it met the ground this frame, down from the next)
        const k = FEET.holdRate, e = Math.exp(-k * dt), j = F.dropV + F.dropIn * k;
        F.dropIn = e * (F.dropIn + j * dt); F.dropV = e * (F.dropV - j * k * dt);
        if (F.dropIn < 1e-4) F.dropIn = 0;   // (falling fast, the spring would carry it on under the ground: it stops on it)
      }
    }
    // (the free foot rides the ground under it, eased: the floor's height under the ball steps by a stair's riser as it
    // passes over the edge, and the foot went up or down 18 cm in a frame, a pop at every stair: the motion QC)
    let gWant = THREE.MathUtils.clamp(d.groundH + d.hBall, -0.25 * sc, 0.3 * sc);
    // (and down toward the floor ahead too (FEET.rideDownAhead): a foot stepping down a flight followed the stair it was over,
    // and met the one below 9 cm up, dropped onto it with its weight on, the calf 24 rad/s, issue #47; the clearance rays keep it off the edge)
    // (on a level tread only, a stair's: down a slope it set the feet down early and they sank; and under a sprint, whose
    // stride's foot comes down well past the edge it looked over)
    if (FEET.rideDownAhead && !held && F.gAraw !== undefined && F.gAraw < gWant - 0.005 * sc && (o.speed ?? 0) < FEET.rideDownAhead[0]
      && physics.groundNormal(d.ball.x, d.ball.y + 1.2, d.ball.z, _nd).dot(up) > FEET.rideDownAhead[1]) gWant = F.gAraw;
    const rr = gWant > (F.gRide ?? gWant) ? FEET.rideUp : FEET.rideRate;
    if (held || F.gRide === undefined || !(rr > 0)) { F.gRide = gWant; F.gRideV = 0; }
    else if (FEET.rideSpring) {
      // (a critically damped spring: eased at a rate, the swinging foot set off down a stair's 18 cm at 4-5 m/s in a frame as
      // it passed over the edge, the calf flicking 22-40 rad/s at every step down, issue #47)
      const e = Math.exp(-rr * dt), x = F.gRide - gWant, j = (F.gRideV ?? 0) + x * rr;
      F.gRide = gWant + e * (x + j * dt); F.gRideV = e * ((F.gRideV ?? 0) - j * rr * dt);
    } else F.gRide += (gWant - F.gRide) * (1 - Math.exp(-rr * dt));
    // (and it rises ahead of a step up: the floor a moment ahead along its way, eased up to; followed at once only as it
    // passed the riser, the swinging foot went up a stair's 18 cm in a frame at every step, the calf flicking 30 rad/s, issue #47)
    if (!held && FEET.rideAhead > 0 && F.lastBall && dt > 0) {
      const v = _d.subVectors(d.ball, F.lastBall).divideScalar(dt);
      v.addScaledVector(up, -v.dot(up)).multiplyScalar(FEET.rideAhead).clampLength(0, FEET.clearAheadMax * 2 * sc);
      const p = _e.copy(d.ball).add(v), g2 = physics.heightAbove(_c.copy(p).addScaledVector(up, 1.2), up, 0);
      if (Number.isFinite(g2)) {
        const gA = THREE.MathUtils.clamp(_c.subVectors(p, rootPos).dot(up) + 1.2 - g2, -0.25 * sc, 0.3 * sc);
        F.gAraw = gA;   // (for the next frame's ride down: FEET.rideDownAhead)
        const was = F.gAhead ?? F.gRide, goal = Math.max(gA, gWant);
        if (FEET.rideAheadSpring) {
          // (a critically damped spring from rest: eased at a rate, the foot set off up the next stair at its full speed in the
          // frame it lifted, 7 cm a frame at once, the calf 35 rad/s at every step up at a jog, issue #47)
          const r = FEET.rideAheadRate, e = Math.exp(-r * dt), x = was - goal, j = (F.gAheadV ?? 0) + x * r;
          F.gAhead = goal + e * (x + j * dt); F.gAheadV = e * ((F.gAheadV ?? 0) - j * r * dt);
          if (F.gAhead < gWant) { F.gAhead = gWant; F.gAheadV = Math.max(F.gAheadV, 0); }
        } else F.gAhead = Math.max(gWant, was + (goal - was) * (1 - Math.exp(-FEET.rideAheadRate * dt)));
        F.gRide = Math.max(F.gRide, F.gAhead);
      } else F.gAraw = undefined;
    } else { F.gAhead = F.gRide; F.gAheadV = 0; F.gAraw = undefined; }
    (F.lastBall ??= new THREE.Vector3()).copy(d.ball);
    // (at a run, a foot the clip already lifts well clear rises over a higher floor only by what it lacks: added on top of
    // its own height, a sprint's kick-back over the stair behind it, down a flight, or the floor ahead, up one, came within
    // 11-18 cm of the hip, the knee's bend barely defined, the thigh turning 45 rad/s in a frame, issue #47. Its swing over
    // the floor at least min(its own height, RO[2]); a smooth max, so the foot's path keeps its curve)
    let ride = F.gRide;
    // (not as it comes in to land: there it rises onto the higher tread with the floor's whole rise, from RO[4] s before
    // touchdown fully by RO[5]: cut there, a foot coming down onto the first stair dipped 5 cm and rose again)
    const RO = FEET.rideOver, ro = RO && !held && ride > 0 ? THREE.MathUtils.smoothstep(o.speed ?? 0, RO[0], RO[1]) * THREE.MathUtils.smoothstep(o.toContact?.[s] ?? Infinity, RO[5], RO[4]) : 0;
    if (ro > 0) {
      const cc = Math.max(0, d.hBall - ballRest), a = cc, b = ride + Math.min(cc, RO[2] * sc), e = RO[3] * sc;
      ride += ((a + b + Math.sqrt((a - b) * (a - b) + e * e)) / 2 - e / 2 - cc - ride) * ro;
      ride = Math.max(ride, 0);
    }
    const swing = d.ankle.clone().addScaledVector(up, ride);
    // letting go far from the clip's foot: the foot goes over there in a low arc, not along the floor
    if (!held && F.w > 0.01) {
      const gap = _d.subVectors(F.pos, d.place).addScaledVector(up, -_d.dot(up)).length();
      swing.addScaledVector(up, Math.min(FEET.releaseArc[1] * sc, gap * FEET.releaseArc[0]) * 4 * F.w * (1 - F.w));
    }
    // a swinging foot clears the ground by `minClear` (motion-captured feet skim in low, a couple of
    // centimetres over the floor, which reads as a foot dragged along at the body's speed): eased
    // in once it has left the ground and out again before it comes down
    if (o.minClear > 0) {
      const ttc = o.toContact?.[s] ?? Infinity;
      const swingK = (contact?.[s] ?? 1) < 0.3 && ttc > FEET.landTime * 0.6 && !held ? 1 : 0;
      F.liftK = (F.liftK ?? 0) + (swingK - (F.liftK ?? 0)) * (1 - Math.exp(-(swingK ? 25 : 60) * dt));
      const lack = o.minClear * sc - d.clear;
      if (lack > 0 && F.liftK > 0.01) swing.addScaledVector(up, lack * F.liftK * (1 - F.w));
    }
    // a free foot never goes into the ground: over a stair or a kerb, the ball and the heel of where
    // it is going clear what is under them (two short rays, only near the ground)
    // (where it is drawn, the swing blended with the hold it is leaving: a foot let go on a stair's edge went through the
    // edge on its way down to the next; looking a little ahead along its way, and eased: lifted all at once as a ray
    // crossed a stair's edge, the swinging foot jumped 18 cm in a frame, the calf and the foot flicking 30-40 rad/s: the motion QC)
    // (letting go, the ball stays over its hold longer than it rises: toe-off. Blended alike, a foot let go at a run's push-off
    // was drawn along the floor toward the clip's, 2-4 cm a frame while the ball was still on it: the motion QC's slides, issue #47)
    let t;
    if (!held && F.w > 0.01 && F.w < 0.999 && FEET.toeOff < 1) {
      const gap = _d.subVectors(lockedAnkle, swing), rise = gap.dot(up);
      // (FEET.toeOffTail: as 1 - (1 - w)^(1 / toeOff), which keeps the ball over its hold as long early on but lets it go at
      // the end: as w^toeOff, the last 3 % of a release still drew a sprint's foot 13 cm back toward a hold 1.5 m behind,
      // and it jumped 15 cm on in the frame it touched down, issue #47)
      const hk = FEET.toeOffTail ? 1 - Math.pow(1 - F.w, 1 / FEET.toeOff) : Math.pow(F.w, FEET.toeOff);
      t = swing.clone().addScaledVector(gap.addScaledVector(up, -rise), hk).addScaledVector(up, rise * F.w);
    } else t = swing.lerp(lockedAnkle, F.w);
    if (!held && F.released && F.dragged && F.w > 0.01 && FEET.releaseMin > 0) t.addScaledVector(up, Math.max(0, FEET.releaseMin * sc - Math.max(d.clear, 0)) * 4 * F.w * (1 - F.w));
    let lift = 0, liftNow = 0;
    const aheadV = F.lastSwing && dt > 0 ? _a.subVectors(t, F.lastSwing).multiplyScalar(FEET.clearAhead / dt) : null;
    if (aheadV) aheadV.addScaledVector(up, -aheadV.dot(up)).clampLength(0, FEET.clearAheadMax * sc);   // (along the ground: where it is going, not how it falls)
    (F.lastSwing ??= new THREE.Vector3()).copy(t);
    if (F.w < 0.99 && d.clear < 0.3 * sc) {
      const toBall = _d.subVectors(d.ball, d.ankle);
      for (const ahead of [0, 1]) {
        if (ahead && !aheadV) break;
        for (const [p, rest] of [[_e.copy(t).add(toBall), ballRest], [_b.copy(t), H.ankleRest * sc]]) {
          if (ahead) p.add(aheadV);
          const g = physics.heightAbove(_c.copy(p).addScaledVector(up, 0.5), up, 0);
          if (Number.isFinite(g)) { const l = rest - (g - 0.5); lift = Math.max(lift, l); if (!ahead) liftNow = Math.max(liftNow, l); }
        }
      }
      lift = Math.min(lift, 0.4 * sc); liftNow = Math.min(liftNow, 0.4 * sc);
    }
    const lk = 1 - Math.exp(-(lift > (F.lift ?? 0) ? FEET.clearRise : FEET.clearFall) * dt);
    F.lift = Math.max((F.lift ?? 0) + (lift - (F.lift ?? 0)) * lk, liftNow - FEET.clearSink * sc, 0);
    if (F.lift > 1e-4) t.addScaledVector(up, F.lift * (held ? 1 - F.w : 1));   // (a foot coming onto its hold: its hold says where)
    targets[s] = t;
    const hip = worldPos(B[`thigh_${s}`], _d);
    need = Math.max(need, hip.distanceTo(t) - H.legLen * 0.985 * sc);
  }
  // (quicker in a pivot, down most of all: a pivot ending in a start carries the hips away from the held foot at a walk's
  // speed, and eased at 16/s they lagged it by 2-3 cm, the held ball lifting and dragging as the other foot stepped)
  const wantDrop = THREE.MathUtils.clamp(need, 0, FEET.maxDrop * sc);
  S.drop += (wantDrop - S.drop) * (1 - Math.exp(-(pivoting ? (wantDrop > S.drop ? 120 : 40) : 16) * dt));
  if (S.drop > 0.002) {
    // lower the pelvis (world down) and refresh the chain
    const p = B.pelvis;
    const wp = worldPos(p, _a).addScaledVector(up, -S.drop).applyMatrix4(_m.copy(p.parent.matrixWorld).invert());
    p.position.copy(wp);
    p.updateMatrixWorld(true);
  }
  // (standing, the narrower zone: a wide one keeps the legs from their rest length, and a held ball crept 5 mm at idle)
  const SS = FEET.softStand, soft0 = SS ? THREE.MathUtils.lerp(SS[2], FEET.soft, THREE.MathUtils.smoothstep(o.speed ?? 0, SS[0], SS[1])) : FEET.soft;
  const SF = FEET.softFast, soft1 = SF ? THREE.MathUtils.lerp(soft0, SF[2], THREE.MathUtils.clamp(((o.speed ?? 0) - SF[0]) / Math.max(SF[1] - SF[0], 1e-3), 0, 1)) : soft0;
  // (and wider still up or down a flight at a run (o.flight: the stairs' line's pitch, src/locomotion.js StairLine): down one at a
  // sprint the swinging foot reached the tread below with the leg 95 % straight, where the knee's bend is barely defined, and the
  // body coming down onto it bent the knee 8 cm in the frame it landed, the calf 21 rad/s, issue #47)
  const FL = FEET.softFlight, soft = FL && o.flight > 0 ? Math.max(soft1, FL[2] * THREE.MathUtils.smoothstep(o.flight, FL[0], FL[1])) : soft1;
  for (const s of ['l', 'r']) {
    const foot = B[`foot_${s}`], F = S[s];
    const fq = worldQuat(foot, new THREE.Quaternion());
    const knee = worldPos(B[`calf_${s}`], new THREE.Vector3());
    // the knee bends over the toes (the held way, as the foot turned), else forward
    const kneeWay = _b.copy(fwd).applyAxisAngle(up, yaws[s] * F.w);
    const pole = knee.addScaledVector(kneeWay, 0.6);
    legIK(H, s, targets[s], pole, soft);
    // the foot keeps the clip's pose, turned to the held way and tilted onto the slope while held
    if (F.w > 0.01) {
      fq.premultiply(_q2.setFromAxisAngle(up, yaws[s] * F.w));
      if (F.n) fq.premultiply(_q.setFromUnitVectors(up, F.n).slerp(_q3.identity(), 1 - F.w));
    }
    if (F.corr) fq.premultiply(F.corr);
    foot.quaternion.copy(worldQuat(foot.parent, _q3).invert().multiply(fq));
    foot.updateMatrixWorld(true);
    if (F.shown && dt > 0) { F.shownV = _a.subVectors(worldPos(B[`ball_${s}`], _b), F.shown).addScaledVector(up, -_a.dot(up)).length() / dt; }
    worldPos(B[`ball_${s}`], (F.shown ??= new THREE.Vector3()));   // (where it is shown: a relock holds there)
  }
}
