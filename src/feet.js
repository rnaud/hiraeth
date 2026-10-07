import * as THREE from 'three';

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

export const FEET = {
  lockAt: 0.6, unlockAt: 0.35,   // contact (0..1) to plant a foot / to let it go
  release: 0.6,                  // m (x body size): a held foot this far from the clip's lets go
  restGait: 0.25,                // under this share of locomotion the body is standing: settling steps
  stepFar: 0.13,                 // m (x size): a standing foot this far from its place steps there
  stepTwist: 0.6,                // rad: or this twisted from the way the body faces
  stepTime: 0.3, stepLift: 0.07, // s, m: one settling step
  pivotStepTime: 0.17,           // s: a step round in a pivot
  stepRest: 0.06,                // s between two steps
  maxDrop: 0.26,                 // m (x size): how far the hips may come down to reach a low foot
  landTime: 0.07, landHeight: 0.15,   // s, m (x size): a landing foot slows over the ground in its last moments before touchdown
  landBack: 0.14,                // m (x size): by at most this much
};

const newFoot = () => ({ locked: false, w: 0, pos: new THREE.Vector3(), yaw: new THREE.Vector3(0, 0, 1), n: null, released: false, lastHeight: undefined, step: null });

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
  out.copy(local).applyQuaternion(foot.getWorldQuaternion(_q3));
  out.addScaledVector(up, -out.dot(up));
  const flat = out.length();
  if (flat > 1e-4) out.divideScalar(flat); else out.set(0, 0, 0);
  return flat;
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
  bone.quaternion.copy(bone.parent.getWorldQuaternion(_rq2).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone IK for a leg: the ankle onto `target`, the knee bent toward `pole`; thigh and shin are
 * aimed from their rest pose (as the clip's legs are), so a leg held far from the clip's never
 * picks up a sudden twist of the thigh or the shin.
 */
function legIK(H, s, target, pole) {
  const B = H.b, a = B[`thigh_${s}`], b = B[`calf_${s}`], c = B[`foot_${s}`];
  const A = a.getWorldPosition(_r1), K = b.getWorldPosition(_r2), C = c.getWorldPosition(_r3);
  const la = A.distanceTo(K), lb = K.distanceTo(C);
  const dir = _a.subVectors(target, A);
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(la - lb) + 1e-3, (la + lb) * 0.999);
  dir.normalize();
  const along = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(la * la - along * along, 0));
  const pd = _b.subVectors(pole, A);
  pd.addScaledVector(dir, -pd.dot(dir));
  if (pd.lengthSq() < 1e-8) pd.subVectors(K, A).addScaledVector(dir, -_c.subVectors(K, A).dot(dir));
  pd.normalize();
  const knee = _c.copy(A).addScaledVector(dir, along).addScaledVector(pd, h);
  const end = _d.copy(A).addScaledVector(dir, d);
  const rootQ = H.char.root.getWorldQuaternion(new THREE.Quaternion());
  aimFromRest(H, a, b, _e.subVectors(knee, A), rootQ);
  aimFromRest(H, b, c, _e.subVectors(end, b.getWorldPosition(_r2)), rootQ);
}

export function resetFeet(H) {
  const S = H._feet;
  if (!S) return;
  for (const s of ['l', 'r']) Object.assign(S[s], { locked: false, w: 0, released: false, lastHeight: undefined, step: null });
  S.drop = 0; S.cool = 0;
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
 */
export function plantFeet(H, dt, physics, up, rootPos, fwd, onStep, o = {}) {
  const B = H.b;
  const S = (H._feet ??= { l: newFoot(), r: newFoot(), drop: 0, cool: 0 });
  S.cool = Math.max(0, (S.cool ?? 0) - dt);
  // standing on a moving floor (a riding disc, a taxi's roof): the held feet go where it took the body
  if (o.carry && o.carry.lengthSq() > 0) for (const s of ['l', 'r']) { const F = S[s]; F.pos.add(o.carry); F.step?.from.add(o.carry); F.land?.add(o.carry); }
  const sc = o.scale ?? H.char.root.scale.y ?? 1;
  const contact = o.contact ?? null, warp = o.warp ?? 1, gait = o.gait ?? (contact ? 0 : 1);
  // a fast turn at low speed (a pivot): both feet stay down and step round, quicker, whatever the gait's phase says
  const pivoting = !!(o.pivot && contact && (o.steps ?? true));
  const standing = contact && (gait < FEET.restGait || pivoting) && (o.steps ?? true);
  const still = standing && ((o.speed ?? 0) < 0.6 || pivoting);   // (setting off: the gait's first step comes, no settling step)
  const ballRest = H.rest.get(B.ball_l).p.y * sc;
  H.ankleRest ??= H.rest.get(B.foot_l).p.y;   // the ankle over the sole at rest
  H.legLen ??= H.rest.get(B.thigh_l).p.distanceTo(H.rest.get(B.calf_l).p) + H.rest.get(B.calf_l).p.distanceTo(H.rest.get(B.foot_l).p);
  const pelvis = B.pelvis.getWorldPosition(_a).clone();
  const D = {};
  for (const s of ['l', 'r']) {
    const F = S[s];
    const ankle = B[`foot_${s}`].getWorldPosition(new THREE.Vector3());
    const ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3());
    // the stride warp: the foot's reach ahead of / behind the hips, scaled
    if (Math.abs(warp - 1) > 1e-3) {
      const along = _b.addVectors(ankle, ball).multiplyScalar(0.5).sub(pelvis).dot(fwd);
      const shift = _c.copy(fwd).multiplyScalar(-along * (1 - warp));
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
      F.land ??= place.clone();
      const back = _b.subVectors(F.land, place);
      back.addScaledVector(up, -back.dot(up)).clampLength(0, FEET.landBack * sc).multiplyScalar(1 - ttc / FEET.landTime);
      place.add(back); ankle.add(back); ball.add(back);
    } else if (F.locked || F.step || ttc > FEET.landTime * 1.5) F.land = null;
    // (held: let go once the gait's contact falls away, not while it is still rising at a touchdown)
    const c = contact?.[s] ?? 0, dc = c - (F.lastC ?? c), falling = dc < -0.002, rising = dc > 0.004;
    F.lastC = c;
    if (pivoting) planted = true;
    else if (contact) planted = F.locked || F.step ? c > FEET.unlockAt || !falling : (contact[s] > FEET.lockAt && hBall < ballRest + 0.14 * sc) || (F.aloft && ((contact[s] > 0.15 && clear < 0.06 * sc) || (contact[s] > 0.02 && clear < 0.025 * sc)))
      // (a lift-off that never left the ground, the contact coming back as the body stops: down again where it is)
      || (!F.aloft && rising && c > 0.2 && clear < 0.03 * sc);
    else {
      const rising = F.lastHeight !== undefined && hBall - F.lastHeight > dt * 0.12;
      planted = hBall < ballRest + (F.locked ? 0.09 : 0.04) * sc && !rising;
    }
    if (!F.locked && !F.step && clear > 0.07 * sc) F.aloft = true;   // (a foot only plants early coming down, not just as it lifts off)
    F.lastHeight = hBall;
    D[s] = { ankle, ball, hBall, groundH, way, flat, place, planted, finite: Number.isFinite(gh), clear };
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
    if (o.pivot) { const p = score.l < score.r ? 'l' : 'r'; S[p].yaw.copy(D[p].way); score[p] = 0; }
    const s = score.l > score.r ? 'l' : 'r';
    if (score[s] > 1 && S.cool <= 0 && D[s].finite) {
      const F = S[s];
      F.step = { from: F.pos.clone(), fromYaw: F.yaw.clone(), t: 0, quick: pivoting };
      F.locked = false;
    }
  } else if (standing && o.pivot) {
    for (const s of ['l', 'r']) if (S[s].locked && !S[s === 'l' ? 'r' : 'l'].step) { S[s].yaw.copy(D[s].way); break; }
  }

  const targets = {}, yaws = {};
  let need = 0;
  for (const s of ['l', 'r']) {
    const F = S[s], d = D[s];
    if (F.step) {
      // a settling step: lifted, over to the foot's place, set down again
      // (walking off: the gait takes the foot from here: it is set down where it is, and lifts when the clip lifts it)
      if (!standing || !d.planted) {
        F.step = null;
        F.pos.addScaledVector(up, _b.subVectors(d.place, F.pos).dot(up));
        F.locked = d.planted; F.released = !d.planted;
      }
      else {
        F.step.t += dt / (F.step.quick ? FEET.pivotStepTime : FEET.stepTime);
        const k = THREE.MathUtils.smootherstep(Math.min(F.step.t, 1), 0, 1);
        F.pos.lerpVectors(F.step.from, d.place, k).addScaledVector(up, Math.sin(Math.PI * Math.min(F.step.t, 1)) * FEET.stepLift * sc);
        // (up onto a stair: the foot rises first and goes over, so its toe doesn't drag up the riser)
        const rise = _b.subVectors(d.place, F.step.from).dot(up);
        if (rise > 0.02 * sc) F.pos.addScaledVector(up, rise * (THREE.MathUtils.smootherstep(Math.min(F.step.t * 1.7, 1), 0, 1) - k));
        F.yaw.copy(F.step.fromYaw).lerp(d.way, k);
        if (F.yaw.lengthSq() > 1e-8) F.yaw.normalize();
        if (F.step.t >= 1) {
          F.step = null; F.locked = true; F.pos.copy(d.place); F.yaw.copy(d.way);
          F.n = physics.groundNormal(d.ball.x, d.ball.y + 1.2, d.ball.z, F.n ?? new THREE.Vector3());
          if (F.n.dot(up) < 0.5) F.n.copy(up);
          S.cool = FEET.stepRest;
          onStep?.(_b.copy(d.place).addScaledVector(up, -ballRest), s, F.n);
        }
      }
    }
    if (!F.step) {
      if (!d.planted || still) F.released = false;
      if (d.planted && !F.locked && !F.released && d.finite) {
        F.locked = true; F.aloft = false;
        F.w = Math.max(F.w, d.clear < 0.03 * sc ? 1 : 0.65);   // (it stops where it meets the ground)
        F.pos.copy(d.place);
        F.yaw.copy(d.way);
        // the slope under the foot: the sole and the footprint lie along it
        F.n = physics.groundNormal(d.ball.x, d.ball.y + 1.2, d.ball.z, F.n ?? new THREE.Vector3());
        if (F.n.dot(up) < 0.5) F.n.copy(up);
        onStep?.(_b.copy(d.place).addScaledVector(up, -ballRest), s, F.n);
      } else if (!d.planted) F.locked = false;
      // too far from the clip's foot (a stride that ran away, a teleport): let go (standing: set down again at once)
      // (standing, as after a fast turn on the spot: it steps over there, once the other foot is down,
      // rather than jumping there in a frame; only a real teleport lets go at once)
      if (F.locked && F.pos.distanceTo(d.place) > FEET.release * sc) {
        const other = S[s === 'l' ? 'r' : 'l'], far = F.pos.distanceTo(d.place) > 2 * FEET.release * sc;
        if (still && !far && d.finite) {
          if (!other.step) { F.step = { from: F.pos.clone(), fromYaw: F.yaw.clone(), t: 0, quick: pivoting }; F.locked = false; }
        } else { F.locked = false; F.released = !standing; }
      }
      // the body has left a held foot behind, out of the leg's reach (the hips can't come down that
      // fast): it goes with the stride now rather than being dragged along the ground
      if (F.locked && !standing) {
        const reach = H.legLen * sc + Math.min(S.drop + 0.03 * sc, FEET.maxDrop * sc);
        if (B[`thigh_${s}`].getWorldPosition(_d).distanceTo(_c.copy(F.pos).add(_e.subVectors(d.ankle, d.ball))) > reach) { F.locked = false; F.released = true; }
      }
    }
    const held = F.locked || !!F.step;
    // (planting is quick: the foot stops as it meets the ground; letting go is softer)
    F.w += ((held ? 1 : 0) - F.w) * (1 - Math.exp(-(held ? 40 : 24) * dt));
    // the held foot: the clip's ankle round the held ball, turned to the held way, tilted onto the slope
    // (measured while held, when the foot lies flat; a lifted foot's toes may point down past the
    // ankle, where its flat way flips: the turn it had as it let go fades out instead)
    if (held) F.yawOff = yawBetween(d.way, F.yaw, up);
    const yaw = F.w > 0.01 ? F.yawOff ?? 0 : (F.yawOff = 0);
    yaws[s] = yaw;
    const offset = _b.subVectors(d.ankle, d.ball).applyAxisAngle(up, yaw);
    if (F.n && F.w > 0.01) offset.applyQuaternion(_q.setFromUnitVectors(up, F.n));
    const lockedAnkle = F.pos.clone().add(offset);
    const swing = d.ankle.clone().addScaledVector(up, THREE.MathUtils.clamp(d.groundH + d.hBall, -0.25 * sc, 0.3 * sc));
    // letting go far from the clip's foot: the foot goes over there in a low arc, not along the floor
    if (!held && F.w > 0.01) {
      const gap = _d.subVectors(F.pos, d.place).addScaledVector(up, -_d.dot(up)).length();
      swing.addScaledVector(up, Math.min(0.1 * sc, gap * 0.5) * 4 * F.w * (1 - F.w));
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
    if (F.w < 0.99 && d.clear < 0.25 * sc) {
      const toBall = _d.subVectors(d.ball, d.ankle);
      let lift = 0;
      for (const [p, rest] of [[_e.copy(swing).add(toBall), ballRest], [swing, H.ankleRest * sc]]) {
        const g = physics.heightAbove(_c.copy(p).addScaledVector(up, 0.5), up, 0);
        if (Number.isFinite(g)) lift = Math.max(lift, rest - (g - 0.5));
      }
      if (lift > 0) swing.addScaledVector(up, Math.min(lift, 0.4 * sc));
    }
    const t = swing.lerp(lockedAnkle, F.w);
    targets[s] = t;
    const hip = B[`thigh_${s}`].getWorldPosition(_d);
    need = Math.max(need, hip.distanceTo(t) - H.legLen * 0.985 * sc);
  }
  S.drop += (THREE.MathUtils.clamp(need, 0, FEET.maxDrop * sc) - S.drop) * (1 - Math.exp(-16 * dt));
  if (S.drop > 0.002) {
    // lower the pelvis (world down) and refresh the chain
    const p = B.pelvis;
    const wp = p.getWorldPosition(_a).addScaledVector(up, -S.drop).applyMatrix4(_m.copy(p.parent.matrixWorld).invert());
    p.position.copy(wp);
    p.updateMatrixWorld(true);
  }
  for (const s of ['l', 'r']) {
    const foot = B[`foot_${s}`], F = S[s];
    const fq = foot.getWorldQuaternion(new THREE.Quaternion());
    const knee = B[`calf_${s}`].getWorldPosition(new THREE.Vector3());
    // the knee bends over the toes (the held way, as the foot turned), else forward
    const kneeWay = _b.copy(fwd).applyAxisAngle(up, yaws[s] * F.w);
    const pole = knee.addScaledVector(kneeWay, 0.6);
    legIK(H, s, targets[s], pole);
    // the foot keeps the clip's pose, turned to the held way and tilted onto the slope while held
    if (F.w > 0.01) {
      fq.premultiply(_q2.setFromAxisAngle(up, yaws[s] * F.w));
      if (F.n) fq.premultiply(_q.setFromUnitVectors(up, F.n).slerp(_q3.identity(), 1 - F.w));
    }
    foot.quaternion.copy(foot.parent.getWorldQuaternion(_q3).invert().multiply(fq));
    foot.updateMatrixWorld(true);
  }
}
