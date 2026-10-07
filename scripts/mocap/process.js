// Cleaning and tagging a retargeted take (retarget.js): foot contacts, trimming, splitting at
// glitches, loops for cyclic walks, and the tags the library and the matcher use.
import * as THREE from 'three';
import { BONES } from './retarget.js';

const sm = THREE.MathUtils.smoothstep;

/** Frames a..b (exclusive) of a retargeted clip. */
export function sliceClip(r, a, b) {
  const n = Math.max(0, Math.min(b, r.n) - a);
  const cut = (arr, dim) => arr.slice(a * dim, (a + n) * dim);
  return {
    ...r, n,
    local: Object.fromEntries(Object.entries(r.local).map(([k, v]) => [k, cut(v, 4)])),
    pelvisPos: cut(r.pelvisPos, 3), root: cut(r.root, 3),
    feet: Object.fromEntries(Object.entries(r.feet).map(([k, v]) => [k, cut(v, 3)])),
    contact: r.contact ? { l: r.contact.l.slice(a, a + n), r: r.contact.r.slice(a, a + n) } : undefined,
  };
}

/**
 * Foot contacts (0 or 1 per frame and foot): the ball of the foot within ~2.5 cm of where it
 * rests on the floor and nearly still over it, which is what the game plants (feet.js holds the
 * ball): from the moment it comes down after the heel to the push off the toes. The floor is the
 * ball's own lowest (5th percentile) over the take, so a marker's height over the sole doesn't
 * matter.
 */
export function footContacts(r) {
  const n = r.n, fps = r.fps, out = {};
  const low = (arr) => { const h = []; for (let i = 0; i < n; i++) h.push(arr[i * 3 + 1]); h.sort((x, y) => x - y); return h[Math.floor(h.length * 0.05)]; };
  const speed = (arr, i) => {
    const j = Math.min(i + 1, n - 1), k = Math.max(i - 1, 0);
    return Math.hypot(arr[j * 3] - arr[k * 3], arr[j * 3 + 2] - arr[k * 3 + 2]) / Math.max(j - k, 1) * fps;
  };
  for (const [f, ball] of [['l', r.feet.ballL], ['r', r.feet.ballR]]) {
    const b0 = low(ball), c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = (1 - sm(ball[i * 3 + 1] - b0, 0.015, 0.035)) * (1 - sm(speed(ball, i), 0.3, 0.6));
    // on or off, with hysteresis (on over 0.6, off under 0.35), so a foot resting lightly doesn't flicker
    const on = new Array(n);
    let state = c[0] > 0.5;
    for (let i = 0; i < n; i++) { state = state ? c[i] > 0.35 : c[i] > 0.6; on[i] = state; }
    // a contact or a flight shorter than 3 frames is noise: fill / clear it
    for (const want of [true, false]) {
      let i = 0;
      while (i < n) {
        if (on[i] === want) { i++; continue; }
        let j = i;
        while (j < n && on[j] !== want) j++;
        if (j - i < 3 && i > 0 && j < n) for (let k = i; k < j; k++) on[k] = want;
        i = j;
      }
    }
    // stored as a clean label: 1 down, 0 up (the runtime interpolates between frames)
    out[f] = Float32Array.from(on, (x) => (x ? 1 : 0));
  }
  return out;
}

/** Root speed (m/s), turn rate (rad/s) and the way it travels relative to its facing (rad), per frame. */
export function rootMotion(r) {
  const n = r.n, fps = r.fps, speed = new Float32Array(n), turn = new Float32Array(n), travel = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = Math.min(i + 1, n - 1), k = Math.max(i - 1, 0), dt = Math.max(j - k, 1) / fps;
    const dx = r.root[j * 3] - r.root[k * 3], dz = r.root[j * 3 + 1] - r.root[k * 3 + 1];
    speed[i] = Math.hypot(dx, dz) / dt;
    turn[i] = (r.root[j * 3 + 2] - r.root[k * 3 + 2]) / dt;
    const yaw = r.root[i * 3 + 2];
    travel[i] = speed[i] > 0.2 ? Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw)) : 0;
  }
  return { speed, turn, travel };
}

/** The largest change of any bone's local rotation between two frames (rad), per frame. */
function poseJumps(r) {
  const n = r.n, out = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    let m = 0;
    for (const k of BONES) {
      const A = r.local[k];
      const dot = Math.abs(A[i * 4] * A[i * 4 - 4] + A[i * 4 + 1] * A[i * 4 - 3] + A[i * 4 + 2] * A[i * 4 - 2] + A[i * 4 + 3] * A[i * 4 - 1]);
      m = Math.max(m, 2 * Math.acos(Math.min(1, dot)));
    }
    out[i] = m;
  }
  return out;
}

/**
 * Clean a retargeted take into the clips worth keeping: split where the capture glitches (a bone
 * turning more than `maxJump` between frames), trim long still stretches at either end to `keepStill`
 * seconds (idles keep theirs), and drop what is left too short.
 */
export function cleanClip(r, { idle = false, keepStill = 0.7, maxJump = 1.0, minLength = 1.0, turnMoves = false } = {}) {
  const jumps = poseJumps(r), out = [];
  let a = 0;
  const pieces = [];
  for (let i = 1; i <= r.n; i++) if (i === r.n || jumps[i] > maxJump) { pieces.push([a, i]); a = i + 1; }
  for (const [s, e] of pieces) {
    let c = sliceClip(r, s, e);
    if (!idle) {
      const { speed, turn } = rootMotion(c);
      const keep = Math.round(keepStill * c.fps);
      // (still: hardly moving, and with `turnMoves` hardly turning either: a turn on the spot is all motion)
      const still = (i) => speed[i] < 0.2 && (!turnMoves || Math.abs(turn[i]) < 0.5);
      let i0 = 0, i1 = c.n;
      while (i0 < c.n && still(i0)) i0++;
      while (i1 > i0 && still(i1 - 1)) i1--;
      c = sliceClip(c, Math.max(0, i0 - keep), Math.min(c.n, i1 + keep));
    }
    if (c.n >= minLength * c.fps) out.push(c);
  }
  return out;
}

/**
 * A clip that is one whole cycle as it is (Mixamo's loops: the last frame is the first again, a
 * cycle on): the clip less its last frame, so playing it round and round doesn't hold that pose
 * twice. Returns the loop (with `loop.speed` its mean ground speed) or null if too short.
 */
export function wholeLoop(r) {
  if (r.n < 8) return null;
  const loop = sliceClip(r, 0, r.n - 1);
  const { speed } = rootMotion(loop);
  loop.loop = { from: 0, to: r.n - 1, speed: speed.reduce((a, b) => a + b, 0) / speed.length, score: 0 };
  return loop;
}

/**
 * A walk's best loop: from one left touchdown to another a cycle (or two) later, where the pose
 * and the speed at the two ends agree best; the last frames are blended into the first so it
 * plays seamlessly. Returns the loop (in place: its root motion is the stance speed only) or null.
 */
export function findLoop(r, { cycles = 1, blend = 4 } = {}) {
  const c = r.contact ?? footContacts(r), n = r.n;
  const { speed } = rootMotion(r);
  // (touchdowns of either foot: a cycle from one to the same foot's next)
  const downs = { l: [], r: [] };
  for (const f of ['l', 'r']) for (let i = 1; i < n; i++) if (c[f][i] > 0.5 && c[f][i - 1] <= 0.5) downs[f].push(i);
  let best = null;
  for (const f of ['l', 'r']) for (let k = 0; k + cycles < downs[f].length; k++) {
    const a = downs[f][k], b = downs[f][k + cycles];
    const len = b - a;
    if (len < 0.5 * r.fps || len > 2.0 * r.fps) continue;
    // steady: the speed doesn't change much over the cycle
    let lo = Infinity, hi = 0, mean = 0;
    for (let i = a; i < b; i++) { lo = Math.min(lo, speed[i]); hi = Math.max(hi, speed[i]); mean += speed[i]; }
    mean /= len;
    if (mean < 0.5 || hi - lo > 0.45 * mean) continue;
    let d = 0;
    for (const bone of BONES) {
      const A = r.local[bone];
      const dot = Math.abs(A[a * 4] * A[b * 4] + A[a * 4 + 1] * A[b * 4 + 1] + A[a * 4 + 2] * A[b * 4 + 2] + A[a * 4 + 3] * A[b * 4 + 3]);
      d += 2 * Math.acos(Math.min(1, dot));
    }
    d += Math.abs(r.pelvisPos[a * 3 + 2] - r.pelvisPos[b * 3 + 2]) * 10;
    // prefer the middle of the take (the subject in their stride, not just off or nearly stopping)
    const mid = Math.abs((a + b) / 2 - n / 2) / n;
    const score = d + (hi - lo) / mean + mid;
    if (!best || score < best.score) best = { a, b, score, mean };
  }
  if (!best) return null;
  const loop = sliceClip(r, best.a, best.b);
  // blend the end into the start: the last frames ease toward the frames just before the loop's
  // first (the same phase of the cycle before), so frame n-1 flows into frame 0
  const N = loop.n;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (let j = 0; j < Math.min(blend, N - 1); j++) {
    const i = N - blend + j, pre = best.a - blend + j, k = (j + 1) / (blend + 1);
    if (pre < 0) continue;
    for (const bone of BONES) {
      const A = loop.local[bone], R = r.local[bone];
      qa.fromArray(A, i * 4); qb.fromArray(R, pre * 4);
      if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
      qa.slerp(qb, k);
      A.set([qa.x, qa.y, qa.z, qa.w], i * 4);
    }
    for (let d = 0; d < 3; d++) loop.pelvisPos[i * 3 + d] += (r.pelvisPos[pre * 3 + d] - loop.pelvisPos[i * 3 + d]) * k;
  }
  loop.loop = { from: best.a, to: best.b, speed: best.mean, score: best.score };
  return loop;
}
