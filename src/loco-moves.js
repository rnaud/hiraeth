import * as THREE from 'three';

// Starts, stops and turns from motion capture (Mixamo's, scripts/mocap/: moves.glb), laid over the
// blended loops (Animator.play) at the moments the loops alone can't show: setting off from
// standing, stopping from a walk or a run, turning round on the spot, and the 180° pivot at a run.
// None of it changes where you go or how fast you turn: the controller moves the body as before,
// and each clip is played *by* that motion, not by the clock:
//  - a start by distance: the clip's frame is the one where its own walk has covered as much
//    ground as the body has since it set off (so its first step comes as the body moves, however
//    quick the controller's start; and it never waits for the clip's own wind-up);
//  - a stop by the distance left: the frame where the clip has as far left to go as the body has
//    (its speed over the controller's braking rate), on whichever foot (the clip or its mirror)
//    is down now; the clip's settling steps then play out once the body is still;
//  - a turn on the spot and the pivot by angle: the frame where the clip has turned the same share
//    of its turn as the body has of its own (a 45°, 90° or 180° clip, mirrored for the right); the
//    feet catch up after the body, as a person's do.
// Every frame's time is held between `minRate` and `maxRate` of real time from the last one, so it
// never stalls or races. A clip eases in over `blendIn` and out over `blendOut`; one that steps
// (`legs`) hands over to the loops in step (Animator.alignPhase), with the foot the clip has down.

/** The starts, stops and turns on (the default) or off (the loops alone): `?moves=0`, or the dev menu. */
export const movesSetting = {
  key: 'memento.locoMoves',
  get() {
    try {
      const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('moves') : null;
      if (q !== null) return !(q === '0' || q === 'off');
      return globalThis.localStorage?.getItem(this.key) !== '0';
    } catch { return true; }
  },
  set(on) { try { globalThis.localStorage?.setItem(this.key, on ? '1' : '0'); } catch { /* this session only */ } },
};

export const MOVES = {
  blendIn: 0.1, blendOut: 0.2,
  start: { clips: ['start_walking'], legs: false, from: 0.25, fade: [2.2, 3.4], minRate: 0.6, maxRate: 3, lead: 0.12 },
  stop: { legs: false, walk: 'stop_walking', run: 'run_to_stop', runFrom: 2.8, from: 0.9, brake: 16, minRate: 0.7, maxRate: 2.5 },
  turn: { legs: false, from: 0.75, maxSpeed: 2.0, outSpeed: 2.8, clips: [[1.15, 'left_turn_45'], [2.2, 'left_turn_90'], [Infinity, 'left_turn_180']], minRate: 0.9, maxRate: 3.2 },
  pivot: { legs: false, clip: 'running_turn_180', speed: 4.2, from: 2.4, minRate: 0.8, maxRate: 2.4 },
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;

/** The first frame (s) where `arr` reaches `x` (arr rising, as a path's distance), linearly between frames. */
function timeAt(arr, x, fps) {
  const n = arr.length;
  if (x <= arr[0]) return 0;
  for (let i = 1; i < n; i++) if (arr[i] >= x) return (i - 1 + (x - arr[i - 1]) / Math.max(arr[i] - arr[i - 1], 1e-6)) / fps;
  return (n - 1) / fps;
}

/** A clip's path analysed once: where it starts moving, where it has done its move, its whole turn and distance. */
export function moveShape(clip) {
  const ud = clip.userData ?? {};
  if (ud.shape) return ud.shape;
  const P = ud.path, fps = ud.fps ?? 30;
  if (!P) return (ud.shape = null);
  const n = P.d.length, yaw = P.yaw, turn = yaw[n - 1] - yaw[0], dist = P.d[n - 1];
  const rate = (i) => (i > 0 && i < n - 1 ? (yaw[i + 1] - yaw[i - 1]) * fps / 2 : 0);
  let on = 0, off = n - 1;
  // (moving: walking over 0.12 m/s or turning over 0.35 rad/s)
  const moving = (i) => P.speed[i] > 0.12 || Math.abs(rate(i)) > 0.35;
  while (on < n - 1 && !moving(on)) on++;
  while (off > on && !moving(off)) off--;
  // (the turn as a share of the whole, rising from 0 to 1: for matching an angle)
  const share = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) { const k = Math.abs(turn) > 1e-3 ? (yaw[i] - yaw[0]) / turn : 0; peak = Math.max(peak, k); share[i] = peak; }
  return (ud.shape = { fps, n, on: on / fps, off: off / fps, end: (n - 1) / fps, turn, dist, share, d: P.d, speed: P.speed });
}

/** The foot (l / r) a move has down at `t` (s), and how long since it came down (s); null if neither. */
export function plantedAt(animator, clip, t) {
  const c = animator.moveContact(clip, t, {}), feet = clip.userData?.feet, fps = clip.userData?.fps ?? 30;
  if (!feet) return null;
  const f = c.l > 0.5 && (c.r <= 0.5 || feet.l[Math.round(t * fps)] >= feet.r[Math.round(t * fps)]) ? 'l' : c.r > 0.5 ? 'r' : null;
  if (!f) return null;
  let i = Math.min(Math.round(t * fps), feet[f].length - 1);
  while (i > 0 && feet[f][i - 1] > 0.5) i--;
  return { f, since: t - i / fps };
}

/**
 * The traveller's starts, stops and turns (Player.animateClips): update() each frame on foot, then
 * `play(animator)` lays the clip on. `state()` for the Motion page and the tests.
 */
export class LocoMoves {
  constructor(animator) {
    this.A = animator;
    this.cur = null;          // { kind, name, clip, shape, t, w, out, ... }
    this.prev = null;         // last frame's { speed, steering, heading }
    this.flip = false;        // starts alternate the foot they set off on
    this.count = { start: 0, stop: 0, turn: 0, pivot: 0 };
  }

  get busy() { return !!this.cur; }

  /**
   * @param s.speed     horizontal speed (m/s)
   * @param s.steering  the stick pushed (the controller is steering somewhere)
   * @param s.heading   the facing now (rad)
   * @param s.want      the heading steered to (rad), or null
   * @param s.ground    on foot on the ground, free (no aim, ride, climb, move of its own)
   * @param s.size      the body's legs against the clips' (Animator.legRatio x scale)
   */
  update(dt, { speed, steering, heading, want = null, ground = true, size = 1 }) {
    const was = this.prev;
    this.prev = { speed, steering, heading };
    const C = this.cur;
    if (!ground) { if (C) C.out = true; this.advance(dt, { speed, heading }); return this; }
    if (C && !C.out) {
      // what ends a move early: going off a different way than it shows
      if (C.kind === 'start' && (!steering || (want !== null && Math.abs(wrap(want - heading)) > 1.2) || speed > MOVES.start.fade[1])) C.out = true;
      if (C.kind === 'stop' && steering) C.out = true;
      if (C.kind === 'turn' && speed > MOVES.turn.outSpeed) C.out = true;
      if (C.kind === 'pivot' && !steering) C.out = true;
    }
    if (was && (!this.cur || this.cur.out)) {
      const turnBy = want === null ? 0 : wrap(want - heading);
      if (steering && !was.steering && was.speed < MOVES.start.from && Math.abs(turnBy) < MOVES.turn.from) this.begin('start', MOVES.start.clips[0], { size, heading });
      else if (!steering && was.steering && was.speed > MOVES.stop.from) this.beginStop(was.speed, size, heading);
      else if (steering && speed < MOVES.turn.maxSpeed && was.speed < MOVES.turn.maxSpeed && Math.abs(turnBy) > MOVES.turn.from && (!this.cur || this.cur.kind !== 'turn')) {
        const name = MOVES.turn.clips.find(([lim]) => Math.abs(turnBy) < lim)[1];
        this.begin('turn', name + (turnBy < 0 ? '_m' : ''), { size, heading, angle: turnBy });
      } else if (steering && speed > MOVES.pivot.speed && Math.abs(turnBy) > MOVES.pivot.from && (!this.cur || this.cur.kind !== 'pivot')) {
        // (the clip turns right: mirrored for a left one)
        this.begin('pivot', MOVES.pivot.clip + (turnBy > 0 ? '_m' : ''), { size, heading, angle: turnBy });
      }
    }
    this.advance(dt, { speed, heading, size });
    return this;
  }

  begin(kind, name, { size, heading, angle = 0, t0 = null }) {
    const clip = this.A.moveClip(name);
    const shape = clip && moveShape(clip);
    if (!shape) return null;
    if (kind === 'start') {
      // (every other start sets off on the other foot)
      this.flip = !this.flip;
      const alt = this.flip ? this.A.moveClip(`${name}_m`) : null;
      if (alt && moveShape(alt)) return this.open(kind, alt, moveShape(alt), { size, heading, angle, t0 });
    }
    return this.open(kind, clip, shape, { size, heading, angle, t0 });
  }

  open(kind, clip, shape, { size, heading, angle, t0 }) {
    const lead = kind === 'start' ? MOVES.start.lead : 0.05;
    const prevW = this.cur ? this.cur.w : 0;
    this.cur = { kind, name: clip.name, clip, shape, t: t0 ?? Math.max(0, shape.on - lead), w: kind === 'turn' && this.cur?.kind === 'stop' ? prevW : 0, out: false,
      dist: 0, size, heading0: heading, lastHeading: heading, turned: 0, angle, aligned: false };
    this.count[kind]++;
    return this.cur;
  }

  /** A stop from `speed`: the walk's or the run's, on the foot that is down now (the clip or its mirror), from as far as is left. */
  beginStop(speed, size, heading) {
    const S = MOVES.stop, name = speed > S.runFrom ? S.run : S.walk;
    const left = speed / S.brake / Math.max(size, 0.3);
    const down = this.A.contact.l >= this.A.contact.r ? 'l' : 'r';
    let best = null;
    for (const n of [name, `${name}_m`]) {
      const clip = this.A.moveClip(n), sh = clip && moveShape(clip);
      if (!sh) continue;
      const t = timeAt(sh.d, sh.dist - left, sh.fps);
      const p = plantedAt(this.A, clip, t);
      const score = p?.f === down ? 0 : 1;
      if (!best || score < best.score) best = { clip, sh, t, score };
    }
    if (best) this.open('stop', best.clip, best.sh, { size, heading, angle: 0, t0: best.t });
  }

  /** Move the clip's time on by the body's own motion, and its weight in or out. */
  advance(dt, { speed, heading, size = 1 }) {
    const C = this.cur;
    if (!C) return;
    const sh = C.shape, M = MOVES[C.kind];
    C.dist += speed * dt / Math.max(C.size, 0.3);
    const dh = wrap(heading - C.lastHeading);
    C.lastHeading = heading;
    C.turned += dh;
    let want = C.t + dt;
    if (C.kind === 'start') want = timeAt(sh.d, C.dist, sh.fps);
    else if (C.kind === 'stop') want = speed < 0.05 ? C.t + dt : timeAt(sh.d, sh.dist - speed / MOVES.stop.brake / Math.max(C.size, 0.3), sh.fps);
    else if (C.kind === 'turn' || C.kind === 'pivot') {
      const k = Math.abs(C.angle) > 1e-3 ? clamp(C.turned / C.angle, 0, 1) : 1;
      want = timeAt(sh.share, k, sh.fps);
    }
    const t0 = C.t;
    C.t = clamp(want, C.t + dt * M.minRate, C.t + dt * M.maxRate);
    C.rate = dt > 0 ? (C.t - t0) / dt : 1;
    // done: past where the clip has done its move (a start: walking steadily; the others: settled)
    const end = C.kind === 'start' ? Math.min(sh.end, sh.off) - MOVES.blendOut : C.kind === 'pivot' ? sh.end - MOVES.blendOut : Math.min(sh.end, sh.off + 0.35);
    if (C.t >= end) C.out = true;
    if (C.kind === 'start') {
      const f = MOVES.start.fade;
      C.cap = 1 - THREE.MathUtils.smoothstep(speed, f[0], f[1]);
    } else C.cap = 1;
    if (C.out && !C.aligned && (C.kind === 'start' || C.kind === 'pivot') && M.legs !== false) {
      // (handing over to the loops: in step with the foot the clip has down)
      const p = plantedAt(this.A, C.clip, C.t);
      if (p) this.A.alignPhase(p.f, p.since);
      C.aligned = true;
    }
    C.w = C.out ? Math.max(0, C.w - dt / MOVES.blendOut) : Math.min(1, C.w + dt / MOVES.blendIn);
    if (C.t >= sh.end) C.w = Math.min(C.w, Math.max(0, C.w - dt / MOVES.blendOut));
    if (C.out && C.w <= 0) this.cur = null;
  }

  /** Lay this frame's move on the Animator (before its update). Returns its weight. */
  play(animator = this.A) {
    const C = this.cur;
    if (!C || C.w <= 0) return 0;
    const w = C.w * (C.cap ?? 1);
    // (a turn on the spot steps as captured; the others walk and run faster than any of the clips:
    // their legs stay the loops', planted as before, and the clip shows above them)
    animator.play(C.name, Math.min(C.t, C.shape.end), w, { full: false, head: true, walks: true, rate: C.rate ?? 1, legs: MOVES[C.kind].legs !== false });
    return w;
  }

  state() { const C = this.cur; return C ? { kind: C.kind, name: C.name, t: C.t, w: C.w, rate: C.rate } : null; }
}
