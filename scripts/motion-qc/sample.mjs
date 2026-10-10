// The motion QC's recorder (.claude/skills/motion-qc/SKILL.md): one plain sample a frame of a posed traveller (a
// Player with its Humanoid and Animator), in node (scripts/motion-qc/run.mjs) and in the running game (the skill's
// run.mjs imports this file into the page). The fields: scripts/motion-qc/lib.mjs.
import * as THREE from 'three';
import { JOINTS, BONES } from './lib.mjs';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const arr = (v) => [r4(v.x), r4(v.y), r4(v.z)];

/** Time the Animator's update and its matching every frame (µs, read by sample()). Idempotent. */
export function timeAnimator(A) {
  if (!A || A._qcTimed) return;
  A._qcTimed = true;
  A._qcUs = { match: 0, anim: 0 };
  const now = () => performance.now();
  const up = A.update.bind(A), mt = A.match.bind(A);
  A.update = function (...a) { const t = now(); const r = up(...a); A._qcUs.anim += (now() - t) * 1000; return r; };
  A.match = function (...a) { const t = now(); const r = mt(...a); A._qcUs.match += (now() - t) * 1000; return r; };
}

/** The sole's rest heights the slide and the sink are read against. */
export function metaOf(p) {
  const H = p.humanoid;
  return { ballRest: H.rest.get(H.b.ball_l).p.y, ankleRest: H.rest.get(H.b.foot_l).p.y };
}

/**
 * This frame's sample. `st` carries what the recorder keeps between frames (the bones' last rotations); input: the
 * stick as asked ([x, y] or null) and Shift; tag: the script's phase.
 */
export function sample(p, st, { t, dt, tag = '', stick = null, run = false }) {
  const H = p.humanoid, B = H.b, A = p.animator;
  const ground = (v) => p.physics.groundAt(v.x, v.y + 1.5, v.z, 4);
  const feet = {};
  for (const s of ['l', 'r']) {
    const ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3()), ankle = B[`foot_${s}`].getWorldPosition(new THREE.Vector3());
    const F = H._feet?.[s];
    feet[s] = { ball: arr(ball), ankle: arr(ankle), gBall: r4(ground(ball)), gAnkle: r4(ground(ankle)), held: !!(F?.locked && (F.w ?? 0) > 0.95) };
  }
  const joints = JOINTS.map((n) => (B[n] ? arr(B[n].getWorldPosition(_v).sub(p.pos)) : [0, 0, 0]));
  // the bones' angular velocities: q_t * q_{t-1}^-1 as a rotation vector over dt (local, rad/s)
  st.q ??= null;
  const qs = BONES.map((n) => (B[n] ? B[n].quaternion.clone() : new THREE.Quaternion()));
  const w = qs.map((q, i) => {
    if (!st.q || !(dt > 0)) return [0, 0, 0];
    _q.copy(q).multiply(st.q[i].clone().invert());
    if (_q.w < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
    const s = Math.hypot(_q.x, _q.y, _q.z), a = s < 1e-8 ? 2 : (2 * Math.atan2(s, _q.w)) / s;
    return [r4((_q.x * a) / dt), r4((_q.y * a) / dt), r4((_q.z * a) / dt)];
  });
  st.q = qs;
  // the chest's facing (unwrapped from frame to frame: only its changes are read)
  const cq = B.spine_03.getWorldQuaternion(_q);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(cq);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cq);
  // (a chest leaning forward points its +z down: the facing is read off whichever of its axes lies flatter)
  const flat = Math.abs(fwd.y) < 0.8 ? fwd : up;
  let chest = Math.atan2(flat.x, flat.z);
  if (st.lastChest !== undefined) { while (chest - st.lastChest > Math.PI) chest -= 2 * Math.PI; while (chest - st.lastChest < -Math.PI) chest += 2 * Math.PI; }
  st.lastChest = chest;
  const M = A?.mm, db = M?.db;
  const gw = A?.w ?? {};
  const gait = ['idle', 'walk', 'jog', 'sprint'].reduce((a, k) => ((gw[k] ?? 0) > (gw[a] ?? 0) ? k : a), 'idle');
  const us = A?._qcUs ? { match: r4(A._qcUs.match), anim: r4(A._qcUs.anim) } : null;
  if (A?._qcUs) { A._qcUs.match = 0; A._qcUs.anim = 0; }
  return {
    t: r4(t), dt: r4(dt), tag, stick: stick ? [r4(stick[0]), r4(stick[1])] : null, run: !!run,
    pos: arr(p.pos), vel: arr(p.vel), heading: r4(p.heading), onGround: !!p.onGround,
    feet, joints, w, chest: r4(chest),
    mm: { w: r4(A?.mmW ?? 0), jumps: M?.jumps ?? 0, clip: M && M.cur >= 0 ? db.segments[db.segOf[Math.floor(M.cur)]].name : null },
    move: p.moves?.cur?.name ?? null, gait, pivot: !!p.loco?.pivot, us,
  };
}

/** A script's input ({ KeyW, KeyS, KeyA, KeyD, ShiftLeft } or { stick }) as the stick it asks for ([x, y] or null). */
export function stickOf(input) {
  if (!input) return null;
  if (input.stick) return Math.hypot(input.stick.x, input.stick.y) > 0.05 ? [input.stick.x, input.stick.y] : null;
  const x = (input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0), y = (input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0);
  if (!x && !y) return null;
  const l = Math.hypot(x, y);
  return [x / l, y / l];
}
