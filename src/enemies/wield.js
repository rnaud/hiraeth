import * as THREE from 'three';
import { twoBone } from '../motion-kit/ik.js';
import { HOLD_AT } from './humanoid-rig.js';

// How the humanoid foes hold their weapons (issue #744; docs/systems/procedural-animation.md, "Holding a weapon").
//
// Before: each model hung its weapon from a grip on the hand at a fixed "carry" turn, then turned it as the clip's fist
// would hold the library's sword (HumanoidDriver.gripFrom). The hand itself never turned (the Animator aims the forearm
// along the clip's; the hand hung straight off it, its fingers open), the clips' fists are often turned wrong for a
// weapon (the captured moves were made for another skeleton), and a hand-made pose kept the carry's turn: the hulk's
// club lay across open palms, the sentinel's blade hid behind its head, the bow hung from the end of a limb.
//
// Now the weapon decides and the hand follows:
//   1. its line (the haft's, out of the thumb's side: a blade's point, a club's head, a bow's upper limb) is aimed by
//      what the body does (Wielder): a carry in the forearm's frame (it swings with the arm), each attack's own aims in
//      the chest's frame (`wind`: the loaded pose, held; `via` and `hit` through the strike to its contact; `follow`
//      after it), a held pose's (a guard), a lying or sitting body's; kept off the ground (its two ends);
//   2. the fist closes round it there (fistOn): the hand turned so the haft runs across its palm and out past the thumb,
//      its fingers' line the forearm's made square to the haft (the wrist as straight as it can be; WRIST its reach);
//      the fingers curl round it (Fist: a knuckle and a middle joint, bent to wrap a haft of its own radius);
//   3. a two-handed hold brings the other hand onto the haft (two-bone IK of that arm to a point on it, its fist closed
//      round it too): an overhead's fists stacked at the butt, a glaive's spread along its shaft;
//   4. empty, the hand opens again and hangs off its forearm as before.

/** The haft's angle to the forearm a fist can hold (rad: π/2 square across it), and how much of a lean off square lies
 * diagonally across the palm (the rest the wrist's bend). A weapon may have its own (`wrist`). */
export const WRIST = { min: 0.8, max: 2.3, diag: 0.45 };
/** A sword's, a spear's, a glaive's: they can lie nearly along the forearm (a thrust, a lance). */
export const SWORD_WRIST = { min: 0.3, max: 2.6, diag: 0.5 };
const GROUND_WRIST = { min: 0.1, max: 3.0, diag: 0.5 };
/** s an attack's aims ease in and out over (the rig's BLEND), how fast a hand closes and opens and takes or lets go of
 * a two-handed haft (1/s), and how far short of it (m at size 1) the other arm may fall before it lets go. */
export const WIELD = { in: 0.12, out: 0.22, close: 12, both: 9, miss: 0.05 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _e = new THREE.Vector3(), _w = new THREE.Vector3(), _pole = new THREE.Vector3(), _knee = new THREE.Vector3(), _end = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const IK_ROUNDS = 6;
const _gq = new THREE.Vector3();
const _wt = new THREE.Vector3(), _d = new THREE.Vector3(), _ms = new THREE.Vector3(), _me = new THREE.Vector3(), _mw = new THREE.Vector3(), _mp = new THREE.Vector3();
const _tn = new THREE.Vector3(), _tw = new THREE.Vector3(), _tx = new THREE.Vector3(), _ty = new THREE.Vector3(), _tz = new THREE.Vector3(), _tm = new THREE.Matrix4(), _ax = new THREE.Vector3();
/** Lying (knocked down, falling, getting up, asleep): the weapon along its side toward its feet, in the body's frame. */
export const LYING = { down: { frame: 'body', dir: [0.25, -1, 0.15] }, fall: { frame: 'body', dir: [0.25, -1, 0.15] }, sleep: { frame: 'body', dir: [0.25, -1, 0.15] } };

/** dir ([x, y, z] in `frame`'s own axes: x its left, y up, z ahead) in the world, unit. */
export function frameDir(frame, d, out = new THREE.Vector3()) {
  frame.updateWorldMatrix(true, false);
  return out.set(d[0], d[1], d[2]).normalize().applyQuaternion(frame.getWorldQuaternion(_q));
}

/** Unit a turned toward unit b by t (0..1) along the great circle (a's own when they are opposite: turned about `pole`). */
export function slerpDir(a, b, t, out = new THREE.Vector3(), pole = null) {
  const d = Math.max(-1, Math.min(1, a.dot(b)));
  if (t <= 0) return out.copy(a);
  if (t >= 1) return out.copy(b);
  if (d > 0.9999) return out.copy(a).lerp(b, t).normalize();
  const th = Math.acos(d);
  if (d < -0.9999) {
    _n.copy(pole ?? (Math.abs(a.y) < 0.9 ? _y.set(0, 1, 0) : _y.set(1, 0, 0))).addScaledVector(a, -a.dot(pole ?? _y)).normalize();
    return out.copy(a).multiplyScalar(Math.cos(Math.PI * t)).addScaledVector(_n, Math.sin(Math.PI * t));
  }
  const s = Math.sin(th), ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
  return out.set(a.x * ka + b.x * kb, a.y * ka + b.y * kb, a.z * ka + b.z * kb).normalize();
}

/**
 * The hand's turn (world, into `out`) whose fist holds a haft along `axis` (unit, world, out of the thumb's side) on a
 * forearm along `fore` (unit, world, elbow to wrist), side s (−1 the right hand, +1 the left): the haft across the palm
 * (the hand's own ±x, the thumb at s·x), the fingers' line (the hand's −y) the forearm's made square to the haft, the
 * palm (+z) the way the fingers close. A haft nearer the forearm's line than `lim` allows (WRIST, or the weapon's own:
 * a sword's can lie nearly along it, a club's can't) is brought out to it: `axis` is written with the line held. Of what
 * is left off square, up to WRIST.diag lies diagonally across the palm (a sword's grip does) and the wrist bends the
 * rest. Returns that diagonal (rad, + the haft's head toward the fingers' line). Pure (tests/wield.test.js).
 */
export function fistTurn(fore, axis, s, out, lim = WRIST) {
  let cos = Math.max(-1, Math.min(1, fore.dot(axis)));
  _tn.copy(axis).addScaledVector(fore, -cos);
  if (_tn.lengthSq() < 1e-10) _tn.set(1, 0, 0).addScaledVector(fore, -fore.x);
  _tn.normalize();
  const ang = Math.acos(cos), held = Math.min(lim.max ?? WRIST.max, Math.max(lim.min ?? WRIST.min, ang));
  if (Math.abs(held - ang) > 1e-6) axis.copy(fore).multiplyScalar(Math.cos(held)).addScaledVector(_tn, Math.sin(held)).normalize();
  const D = lim.diag ?? WRIST.diag, diag = Math.max(-D, Math.min(D, Math.PI / 2 - held)), at = held + diag;
  // (the line the hand closes on: the haft turned square by its diagonal in the palm)
  _tw.copy(fore).multiplyScalar(Math.cos(at)).addScaledVector(_tn, Math.sin(at)).normalize();
  _ty.copy(fore).addScaledVector(_tw, -Math.cos(at)).normalize().negate();   // (the hand's +y: back up the fingers' line)
  _tx.copy(_tw).multiplyScalar(s);
  _tz.crossVectors(_tx, _ty);
  out.setFromRotationMatrix(_tm.makeBasis(_tx, _ty, _tz));
  return diag;
}

/**
 * Turn hand i (0 the right, 1 the left) so its fist closes round a haft along `axis` (world: written with the line the
 * wrist can hold), `w` of the way from its turn on the forearm (straight off it). Returns the haft's diagonal in the palm.
 */
export function fistOn(J, i, axis, w = 1, lim = WRIST) {
  const hand = J.hands[i], elbow = J.elbows[i];
  hand.quaternion.identity();
  if (!(w > 0.001)) { hand.updateMatrixWorld(true); return 0; }
  elbow.updateWorldMatrix(true, false);
  elbow.getWorldQuaternion(_q2);
  _f.copy(DOWN).applyQuaternion(_q2);
  const diag = fistTurn(_f, axis, i ? 1 : -1, _q, lim);
  hand.quaternion.copy(_q2.invert().multiply(_q));
  if (w < 1) hand.quaternion.slerp(_q.identity(), 1 - w);   // (the identity is the hand straight off its forearm)
  hand.updateMatrixWorld(true);
  return diag * w;
}

// ------------------------------------------------------------------ fingers that close

/** Angle of (y, z) from −y toward +z (rad): a finger's lean forward. */
const lean = (y, z) => Math.atan2(z, -y);
/** The two intersections of circle (a, ra) and circle (b, rb) in the (y, z) plane ([y, z] pairs), or null. */
function meet(a, ra, b, rb) {
  const dy = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dy, dz);
  if (d < 1e-9 || d > ra + rb || d < Math.abs(ra - rb)) return null;
  const l = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - l * l));
  const my = a[0] + (dy * l) / d, mz = a[1] + (dz * l) / d;
  return [[my + (dz * h) / d, mz - (dy * h) / d], [my - (dz * h) / d, mz + (dy * h) / d]];
}
/**
 * How far a finger bends (rad, at its knuckle and at its middle joint, each forward: from −y toward +z) to wrap a haft
 * across the palm: K its knuckle, M its middle joint, E its tip ([y, z], the hand's frame, as built), C the haft's centre,
 * R the haft's radius and the finger's. The middle joint is laid on the haft first (as far round as the knuckle reaches
 * it), then the tip round it. Pure (tests/wield.test.js).
 */
export function curlAngles(K, M, E, C, R) {
  const a = Math.hypot(M[0] - K[0], M[1] - K[1]), b = Math.hypot(E[0] - M[0], E[1] - M[1]);
  const p1 = lean(M[0] - K[0], M[1] - K[1]), p2 = lean(E[0] - M[0], E[1] - M[1]);
  const m = meet(K, a, C, R);
  // (the first the finger meets swinging forward from straight down: the lower one)
  const M2 = m ? (lean(m[0][0] - K[0], m[0][1] - K[1]) < lean(m[1][0] - K[0], m[1][1] - K[1]) ? m[0] : m[1]) : [C[0] - R, C[1]];
  const t1 = lean(M2[0] - K[0], M2[1] - K[1]) - p1;
  const e = meet(M2, b, C, R);
  // (the tip round the far side: bent the more)
  const tipLean = e ? Math.max(...e.map((x) => lean(x[0] - M2[0], x[1] - M2[1]))) : lean(C[0] - M2[0], C[1] - M2[1]) + Math.PI / 2;
  return [t1, tipLean - p2 - t1];
}

/**
 * A hand's fingers on two pivots (`knuckles`, under it `tips`) bending about x: closed (set(1, r)) wrapped round a haft of
 * radius r centred at `haft(r)` (the hand's frame), open (set(0)) as built. spec: { K, M, E ([y, z]: the knuckle, middle
 * and tip of its longest finger), finger (its radius), haft(r) → [x, y, z] the haft's centre for that radius }.
 */
export class Fist {
  constructor(knuckles, tips, spec) { Object.assign(this, { knuckles, tips, spec }); this.cache = new Map(); this.w = 0; this.r = 0.02; }
  /** The haft's centre for radius r (the hand's frame) and the bends that wrap it, worked out once a radius. */
  fit(r) {
    const key = Math.round(r * 1e4);
    let F = this.cache.get(key);
    if (!F) {
      const S = this.spec, at = S.haft(r), R = r + S.finger, a = Math.hypot(S.M[0] - S.K[0], S.M[1] - S.K[1]);
      // (a thin haft sits lower in the fist, where the first joint of the fingers can reach round it)
      for (let n = 0; n < 24 && !meet(S.K, a, [at[1], at[2]], R); n++) at[1] -= a * 0.05;
      F = { at: new THREE.Vector3(...at), bend: curlAngles(S.K, S.M, S.E, [at[1], at[2]], R) };
      this.cache.set(key, F);
    }
    return F;
  }
  /** Close by w (0 open … 1 round a haft of radius r). */
  set(w, r = this.r) {
    this.w = w; this.r = r;
    const [b1, b2] = this.fit(r).bend;
    this.knuckles.rotation.x = -b1 * w; this.tips.rotation.x = -b2 * w;
  }
}

/**
 * A finger's parts built straight down its hand and split onto the fist's two pivots: `prox` (knuckle to middle joint)
 * moved onto the knuckle pivot at K, `dist` (middle joint to tip, a claw) onto the tip pivot at M (both [x, y, z] in the
 * hand's frame). Returns the pivots: { knuckles, tips } (made once a hand).
 */
export function fingerPivots(hand, K, M, name = 'fingers') {
  const knuckles = new THREE.Group(); knuckles.name = `${name} knuckles`; knuckles.position.set(...K); hand.add(knuckles);
  const tips = new THREE.Group(); tips.name = `${name} tips`; tips.position.set(M[0] - K[0], M[1] - K[1], M[2] - K[2]); knuckles.add(tips);
  return { knuckles, tips };
}

// ------------------------------------------------------------------ the wielder

/**
 * One foe's weapons in its hands. J: its joints; driver: its HumanoidDriver; o:
 *   fists      [right, left]: each a Fist or null (a hand of one piece: a gauntlet, a ball)
 *   grips      [right, left]: the grip pivot on each hand (or null): placed at the fist's haft and turned with it
 *   at         [right, left]: where a hand without a Fist holds the haft ([x, y, z], its frame)
 *   weapons    { name: spec }: spec (all lengths m at the model's size 1):
 *                side     0 the right hand, 1 the left
 *                r        the haft's radius where the fist holds it
 *                reach    [up, down]: how far it runs out of the fist along its line and back (kept off the ground,
 *                         `head` m over it: a club's knob)
 *                carry    { frame: 'arm' | 'torso' | 'body', dir }   standing, walking, running, struck
 *                moves    { attackId: { frame, wind, via, hit, follow, both } }: dirs in the frame (default 'torso');
 *                         `both`: the other hand on the haft { at (m along it from this fist: + toward its head), from,
 *                         to (the phases it holds it: 'wind', 'strike', 'recover') }; a feint's second move its own
 *                         keys under the feint's name (`thrust`)
 *                poses    { poseName: { frame, dir } }: a held pose of the arms (a guard)
 *                states   { kind: { frame, dir } }: lying, falling, sitting, picking up, asleep (else the carry)
 */
export class Wielder {
  constructor(J, driver, o) {
    Object.assign(this, { J, driver, fists: o.fists ?? [null, null], grips: o.grips ?? [null, null], at: o.at ?? [null, null], weapons: o.weapons });
    this.moveW = 0; this.last = null; this.hold = [0, 0]; this.bothW = 0; this.diag = [0, 0]; this.reachW = 1;
    this.axis = new THREE.Vector3(0, 1, 0); this.aim = new THREE.Vector3(0, 1, 0); this.name = null;
  }

  /** A key's direction (world) for side i. */
  dir(K, frame, i, out) {
    const J = this.J, fr = (K.frame ?? frame) === 'arm' ? J.elbows[i] : (K.frame ?? frame) === 'body' ? J.body : J.torso;
    return frameDir(fr, K.dir ?? K, out);
  }

  /**
   * The weapon's line this frame (world, into out) for spec W in hand i: the carry, a held pose over it, an attack's
   * aims over that; null when nothing is aimed.
   */
  aimOf(W, f, want, dt, out) {
    const J = this.J, D = this.driver, i = W.side ?? 0;
    this.dir(W.carry, 'arm', i, out);
    // (carried off a swinging arm: half the arm's swing, half the body's, so a run's forearm forward doesn't point the
    // weapon at you; W.carry.body the body's share)
    if ((W.carry.frame ?? 'arm') === 'arm') slerpDir(out, frameDir(J.body, W.carry.dir, _a), W.carry.body ?? 0.5, out);
    const kind = want.kind ?? null;
    const lying = (W.states ?? LYING)[kind];
    if (lying) slerpDir(out, this.dir(lying, 'body', i, _a), D.moveW, out);
    // a held pose of the arms (a guard): its own aim, by the pose's weight
    const P = D.procName && W.poses?.[D.procName];
    if (P && D.procW > 0.01) slerpDir(out, this.dir(P, 'torso', i, _a), clamp01(D.procW), out);
    // an attack's
    const a = f.atk, phase = kind === 'wind' || kind === 'strike' || kind === 'recover' ? kind : want.phase ?? null;
    let M = a && W.moves?.[a.id];
    if (M && want.feint && M[want.feint]) M = M[want.feint];
    const inMove = !!(M && (phase === 'wind' || phase === 'strike' || phase === 'recover') && !(f.downT > 0));
    if (inMove) { this.last = { M, a }; this.moveW = dt === 0 ? 1 : Math.min(1, this.moveW + dt / WIELD.in); }
    else this.moveW = dt === 0 ? 0 : Math.max(0, this.moveW - dt / WIELD.out);
    const L = inMove ? { M, a } : this.last;
    if (L && this.moveW > 0.001) {
      const frame = L.M.frame ?? 'torso', k = f.k ?? 0, c = Math.min(0.95, Math.max(0.05, L.a.contact ?? 0.5));
      const wind = this.dir(L.M.wind, frame, i, _a), hit = this.dir(L.M.hit ?? L.M.wind, frame, i, _b);
      let m;
      if (!inMove || phase === 'recover') m = L.M.follow ? this.dir(L.M.follow, frame, i, _c) : _c.copy(hit);
      else if (phase === 'wind') m = slerpDir(out, wind, smooth(want.load ?? k / HOLD_AT), _c);
      else if (k < c) {
        const u = k / c;
        if (L.M.via) { const via = this.dir(L.M.via, frame, i, _p); m = u < 0.5 ? slerpDir(wind, via, u * 2, _c) : slerpDir(via, hit, u * 2 - 1, _c); }
        else m = slerpDir(wind, hit, u, _c);
      } else m = L.M.follow ? slerpDir(hit, this.dir(L.M.follow, frame, i, _p), smooth((k - c) / (1 - c)), _c) : _c.copy(hit);
      slerpDir(out, m, smooth(this.moveW), out);
    }
    return { inMove, M: L?.M ?? null, phase };
  }

  /**
   * After the driver's pose: aim the weapon named `name` (null: none in hand), close the fists, bring the other hand onto
   * a two-handed haft, place the grip. f: the foe; want: what the driver chose; c: the anim kit ({ dt }); o: { pinch
   * [right, left]: a hand closed on something thin held elsewhere (the bow's cord drawn) }.
   */
  update(f, want, c, name, o = {}) {
    const J = this.J, dt = Math.max(0, c.dt ?? 0), W = name ? this.weapons[name] : null, side = W ? W.side ?? 0 : -1;
    this.name = W ? name : null; this.dt = dt; this.offW = 0;
    const scale = J.body.getWorldScale(_s).y || 1, ease = (x, to, rate) => x + (to - x) * (dt === 0 ? 1 : 1 - Math.exp(-rate * dt));
    for (let i = 0; i < 2; i++) this.hold[i] = ease(this.hold[i], i === side || o.pinch?.[i] ? 1 : 0, WIELD.close);
    J.body.updateMatrixWorld(true);
    // (each hand straight off its forearm unless it holds the haft below)
    for (let i = 0; i < 2; i++) J.hands[i].quaternion.identity();
    let B = null;
    if (W) {
      // (a carry with the forearm brought up before it: a spear or a glaive upright in the fist, not slanting off a
      // hanging arm; eased out as a move or a lying body takes the arm)
      const fore = W.carry?.fore, free = !want.clip && !want.pose && !(f.downT > 0);
      this.foreW = ease(this.foreW ?? 0, fore && free ? 1 : 0, 10);
      if (fore && this.foreW > 0.01) {
        const el = J.elbows[side];
        el.updateWorldMatrix(true, false);
        _q2.copy(el.quaternion);
        aimAt(el, frameDir(J.body, fore, _b));
        el.quaternion.copy(_q2.slerp(el.quaternion, smooth(this.foreW)));
        el.updateMatrixWorld(true);
      }
      const info = this.aimOf(W, f, want, dt, this.aim);
      this.axis.copy(this.aim);
      this.diag[side] = fistOn(J, side, this.axis, this.hold[side], W.wrist);
      this.place(side, W.r);
      this.offGround(f, side, W, scale, c.ground);
      // the other hand onto the haft, in the phases the move holds it with both
      const H = info.M?.both, on = !!(H && info.inMove && (!H.phases || H.phases.includes(info.phase)));
      if (H) this.lastBoth = H;
      this.bothW = ease(this.bothW, on ? 1 : 0, WIELD.both);
      B = this.bothW > 0.01 ? H ?? this.lastBoth : null;
      if (B) this.both(side, W, B, this.bothW, scale);
    } else this.bothW = 0;
    // the fingers: closed round the haft (its own radius) or pinching, open when empty
    for (let i = 0; i < 2; i++) {
      const F = this.fists[i];
      if (!F) continue;
      const onHaft = W && (i === side || (B && this.bothW > 0.01));
      F.set(Math.max(this.hold[i], onHaft && i !== side ? this.offW ?? this.bothW : 0), onHaft ? W.r : 0.006);
    }
    J.body.updateMatrixWorld(true);
    return this.axis;
  }

  /** Its head and its butt kept over the ground under the foe (the slope's plane), the fist turned again if it moved. */
  offGround(f, i, W, scale, ground = null) {
    const grip = this.grips[i];
    if (!grip || !W.reach) return;
    grip.updateWorldMatrix(true, false);
    grip.getWorldPosition(_p);
    const up = W.reach[0] * scale, dn = W.reach[1] * scale, m = Math.max(0.03, W.head ?? 0) * scale, A = this.axis;
    // (the ground under each end: the kit's own (c.ground), or the foe's slope's plane; a fist the lying clip sinks into
    // the ground takes the ground at itself, so the weapon lies flat from it)
    const under = (x, z) => { _gq.set(x, _p.y, z); const g = ground?.(x, _p.y + 1.5, z); return g ?? groundUnder(f, _gq); };
    let moved = false;
    const sunk = _p.y < under(_p.x, _p.z) + m, cap = (g) => (sunk ? Math.min(g, _p.y - m) : g);
    for (let pass = 0; pass < 2; pass++) {
      const gT = cap(under(_p.x + A.x * up, _p.z + A.z * up)), gB = cap(under(_p.x - A.x * dn, _p.z - A.z * dn));
      const lo = up > 0 ? (gT + m - _p.y) / up : -1, hi = dn > 0 ? (_p.y - gB - m) / dn : 1;
      if (!(A.y < lo - 1e-6 || A.y > hi + 1e-6) || lo > hi + 1e-6) break;
      const y = Math.max(-1, Math.min(1, Math.min(hi, Math.max(lo, A.y)))), h = Math.hypot(A.x, A.z), r = Math.sqrt(1 - y * y);
      if (h > 1e-6) A.set((A.x / h) * r, y, (A.z / h) * r); else A.set(r, y, 0);
      moved = true;
    }
    if (!moved) return;
    // (the ground before the wrist: the fist bends further than it would to keep the weapon out of it)
    this.diag[i] = fistOn(this.J, i, A, this.hold[i], GROUND_WRIST);
    this.place(i, W.r);
  }

  /** The grip on hand i at its fist's haft (for radius r), turned with the fist: its +y out of the thumb's side, +z along the fingers. */
  place(i, r) {
    const grip = this.grips[i], s = i ? 1 : -1;
    if (!grip) return;
    grip.position.copy(this.haftAt(i, r, _c));
    _y.set(s, 0, 0); _z.set(0, -1, 0); _x.crossVectors(_y, _z);
    grip.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    // (lying diagonally across the palm by what the wrist didn't bend: its head toward the fingers' line, −y)
    if (this.diag[i]) grip.quaternion.premultiply(_q.setFromAxisAngle(_z.set(0, 0, 1), -s * this.diag[i]));
    grip.updateMatrixWorld(true);
  }
  /** Where hand i's fist holds a haft of radius r (its own frame). */
  haftAt(i, r, out) {
    const F = this.fists[i];
    return F ? out.copy(F.fit(r).at) : out.set(...(this.at[i] ?? [0, -0.05, 0]));
  }

  /** The other hand (1 − i) brought onto the haft `B.at` m along it from hand i's fist (its arm by two-bone IK), w of the way. */
  both(i, W, B, w, scale) {
    const J = this.J, j = 1 - i, D = J.D;
    J.hands[i].localToWorld(this.haftAt(i, W.r, _p));   // (this fist's haft, world)
    const arm = J.arms[j], elbow = J.elbows[j];
    arm.updateWorldMatrix(true, false);
    arm.getWorldPosition(_s);
    elbow.getWorldPosition(_e); J.hands[j].getWorldPosition(_w);
    _pole.copy(_e).sub(_s);
    const e0 = _e.clone(), w0 = _w.clone();
    const l1 = D.upper * scale, l2 = D.fore * scale, reach = (l1 + l2) * 0.98;
    // (where on the haft: its own place, or as near it as the arm reaches within the span the hand may hold, B.from..to)
    let along = (B.at ?? -0.12) * scale;
    _a.copy(_p).addScaledVector(this.axis, along);
    if (_a.distanceTo(_s) > reach) {
      const lo = (B.from ?? Math.min(0, B.at ?? 0)) * scale, hi = (B.to ?? Math.max(0, B.at ?? 0)) * scale, gap = (B.gap ?? 0.1) * scale;
      along = Math.max(lo, Math.min(hi, _b.copy(_s).sub(_p).dot(this.axis)));
      // (never in this fist: a fist's width away from it, on the side nearer the shoulder)
      if (Math.abs(along) < gap) along = along < 0 ? (lo <= -gap ? -gap : gap) : (hi >= gap ? gap : -gap);
      _a.copy(_p).addScaledVector(this.axis, along);
    }
    // (still out of reach: the weapon brought over toward that shoulder, the holding arm reaching it there, its line kept)
    const over = _a.distanceTo(_s) - reach * 0.97;
    if (over > 0) {
      const mArm = J.arms[i], mEl = J.elbows[i], mHand = J.hands[i];
      _d.copy(_s).sub(_a).normalize().multiplyScalar(Math.min(over, 0.3 * (l1 + l2)) * w);
      mArm.getWorldPosition(_ms); mEl.getWorldPosition(_me); mHand.getWorldPosition(_mw).add(_d);
      twoBone(_ms, _mw, l1, l2, _mp.copy(_me).sub(_ms), _knee, _end);
      aimAt(mArm, _b.copy(_knee).sub(_ms));
      mEl.getWorldPosition(_me);
      aimAt(mEl, _b.copy(_end).sub(_me));
      this.diag[i] = fistOn(J, i, this.axis, this.hold[i], W.wrist);
      this.place(i, W.r);
      J.hands[i].localToWorld(this.haftAt(i, W.r, _p));
      _a.copy(_p).addScaledVector(this.axis, along);
    }
    const off = this.haftAt(j, W.r, new THREE.Vector3()).multiplyScalar(scale);
    // (out of the arm's reach it lets go rather than hold the air beside the haft: eased off, and on again in reach)
    const w1 = w; w *= this.reachW; this.offW = w;
    let miss = 0;
    // (the wrist where its fist's haft falls on the point: the fist's offset turned as that hand is turned on the forearm
    // reached; the hand's turn follows the forearm, so a few damped rounds)
    _wt.copy(_a).addScaledVector(_b.copy(_s).sub(_a).normalize(), off.length());
    for (let it = 0; it < IK_ROUNDS; it++) {
      fistOn(J, j, _ax.copy(this.axis), 1, W.wrist);
      J.hands[j].getWorldQuaternion(_q);
      _c.copy(off).applyQuaternion(_q);
      _c.subVectors(_a, _c);
      if (it) _c.lerp(_wt, 0.4);
      _wt.copy(_c);
      miss = twoBone(_s, _c, l1, l2, _pole, _knee, _end);
      _knee.lerpVectors(e0, _knee, w); _end.lerpVectors(w0, _end, w);
      aimAt(arm, _b.copy(_knee).sub(_s));
      elbow.getWorldPosition(_e);
      aimAt(elbow, _b.copy(_end).sub(_e));
    }
    this.diag[j] = fistOn(J, j, _ax.copy(this.axis), w, W.wrist);
    const dt = this.dt ?? 0;
    this.reachW += ((miss < WIELD.miss * scale ? 1 : 0) - this.reachW) * (dt === 0 ? 1 : 1 - Math.exp(-WIELD.both * dt));
    return w1;
  }
}

/** A limb joint's −y aimed along dir (world). */
function aimAt(j, dir) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_q).invert();
  j.quaternion.setFromUnitVectors(DOWN, dir.normalize().applyQuaternion(_q));
  j.updateMatrixWorld(true);
}

/** The ground's height under a point (world) by the foe's slope's plane (src/enemies/slope.js), or its own feet's. */
function groundUnder(f, p) {
  const S = f.slope, y0 = f.pos?.y ?? 0;
  if (!S) return y0;
  return y0 + (S.sx ?? 0) * (p.x - f.pos.x) + (S.sz ?? 0) * (p.z - f.pos.z);
}
