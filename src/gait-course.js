import * as THREE from 'three';

// The locomotion test course and its measures, without Node: shared by the gait harness
// (tests/gait-sim.js, scripts/mocap/compare.mjs) and the Motion page (motion.html, src/motion/),
// so the page's live numbers are the harness's.

/**
 * Ground for the walk: a flat floor, a 12° ramp up (x = -20) and 18 cm stairs up and down again
 * (x = 20), along +z from z = 30. o.obstacles: a few pillars and crates to walk round (the Motion
 * page; out of the scripted runs' way). o.group: build into this Object3D instead of a new Scene.
 */
export function course({ ramp = true, stairs = true, obstacles = false, group = null } = {}) {
  const scene = group ?? new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400));
  floor.name = 'floor';
  floor.position.y = -0.5;
  scene.add(floor);
  if (ramp) {
    const a = THREE.MathUtils.degToRad(12), len = 14;
    const r = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, len));
    r.name = 'ramp';
    r.rotation.x = -a;
    r.position.set(-20, Math.sin(a) * len / 2 - 0.2 / Math.cos(a), 30 + Math.cos(a) * len / 2);
    scene.add(r);
  }
  if (stairs) {
    // eight 18 cm steps up from z = 30, a 3 m landing, eight steps down
    const step = (h, z) => { const s = new THREE.Mesh(new THREE.BoxGeometry(6, h, 0.32)); s.name = 'step'; s.position.set(20, h / 2, z); scene.add(s); };
    for (let i = 0; i < 8; i++) step(0.18 * (i + 1), 30.16 + i * 0.32);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 1.44, 3));
    top.name = 'step';
    top.position.set(20, 0.72, 32.56 + 1.5);
    scene.add(top);
    for (let i = 0; i < 8; i++) step(0.18 * (8 - i), 35.56 + 0.16 + i * 0.32);
  }
  if (obstacles) {
    // (north of the scripted runs' flat stretch, z = -60 .. -30, and clear of the ramp and the stairs)
    for (const [x, z, r] of [[-3, -12, 0.45], [4, -6, 0.6], [-6, 2, 0.4], [2, 8, 0.5]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 2.6, 20));
      p.name = 'pillar';
      p.position.set(x, 1.3, z);
      scene.add(p);
    }
    for (const [x, z, w, d, h, yaw] of [[7, 2, 1.2, 1.2, 0.9, 0.4], [-8, -8, 2, 0.8, 0.6, -0.3]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
      c.name = 'crate';
      c.position.set(x, h / 2, z);
      c.rotation.y = yaw;
      scene.add(c);
    }
  }
  scene.updateMatrixWorld(true);
  return scene;
}

// camera yaw for which W walks toward +z (player.js: camF = -(sin yaw, cos yaw) in x, z)
export const CAM_PLUS_Z = Math.PI;

const W = { KeyW: true }, R = { KeyW: true, ShiftLeft: true }, SR = { KeyS: true, ShiftLeft: true }, S = { KeyS: true }, D = { KeyD: true }, WD = { KeyW: true, KeyD: true }, none = {};
const slow = (x, y) => ({ stick: { x, y } });
/** The harness's scripted runs (scripts/mocap/compare.mjs): where they start, [seconds, input, tag] steps, and a turn to time. */
export const RUNS = {
  'walk → run → 180° turn → stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [2, W, 'walk'], [2, R, 'run'], [1.5, SR, 'turn180'], [2.5, none, 'stop']], face: [5, Math.PI] },
  'walk, 90° turn, stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [2, W, 'walk'], [2, D, 'turn90'], [2, none, 'stop']], face: [3, -Math.PI / 2] },
  'turn round on the spot': { at: [0, 0, -60], script: [[1, none, 'idle'], [0.12, S, 'tap'], [2.5, none, 'settle']] },
  'up the ramp, stand': { at: [-20, 0, 24], script: [[1, none, 'idle'], [5, W, 'up'], [1.5, none, 'stand']] },
  'stairs up, stand, down': { at: [20, 0, 26], script: [[1, none, 'idle'], [1.6, W, 'up'], [1, none, 'stand'], [3, W, 'down'], [1, none, 'stand']] },
  'slow walk (half stick), stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [3, slow(0, 0.45), 'stroll'], [2, none, 'stop']] },
  'jog, 45° and back, stop': { at: [0, 0, -60], script: [[1, none, 'idle'], [2, W, 'jog'], [1, WD, 'veer'], [1.5, W, 'jog'], [2, none, 'stop']] },
  'stand still 6 s': { at: [0, 0, -60], script: [[6, none, 'idle']] },
};
/** The Motion page's runs: the harness's, and starts and stops over and over. */
export const PAGE_RUNS = {
  ...RUNS,
  'start, stop, again (walk and run)': { at: [0, 0, -60], script: [[1, none, 'idle'],
    ...[0, 1, 2].flatMap((i) => [[0.9, W, `walk${i + 1}`], [0.9, none, `stop${i + 1}`]]),
    ...[0, 1].flatMap((i) => [[1.1, R, `run${i + 1}`], [1.2, none, `halt${i + 1}`]])] },
};
/** A run's length in frames at `fps` (each step rounded as drive() rounds it). */
export const runFrames = (run, fps = 60) => run.script.reduce((n, [secs]) => n + Math.round(secs * fps), 0);
/** What a run's script asks on frame k (at `fps`, as drive() steps it): { input, tag, step, done }. */
export function scriptFrame(run, k, fps = 60) {
  let n0 = 0;
  for (const [i, [secs, input, tag]] of run.script.entries()) {
    const n = Math.round(secs * fps);
    if (k < n0 + n) return { input, tag, step: i, done: false };
    n0 += n;
  }
  return { input: none, tag: 'end', step: run.script.length, done: true };
}

/**
 * One frame of a traveller (a Player with its Humanoid and Animator) as the measures read it:
 * the feet's balls and ankles and the ground under them, planted or not, the pelvis and the head,
 * the biggest bone turn since `prev` (the previous frame's, or null). t, tag: the run's.
 */
export function sampleFrame(p, t, tag, prev = null) {
  const B = p.humanoid.b;
  const ground = (v) => p.physics.groundAt(v.x, v.y + 1.5, v.z, 4);
  const M = p.animator?.mm, db = M?.db;
  const f = { t, tag, pos: p.pos.clone(), vel: p.vel.clone(), heading: p.heading, feet: {}, mmW: p.animator?.mmW ?? 0, clip: M && M.cur >= 0 ? db.segments[db.segOf[Math.floor(M.cur)]].name : null, dbSpeed: M?.speed ?? 0, cost: M?.cost ?? 0 };
  for (const s of ['l', 'r']) {
    const ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3());
    const ankle = B[`foot_${s}`].getWorldPosition(new THREE.Vector3());
    // the sole: the ball and the heel (the ankle's ground point) each sit this high over their bone at rest
    const F = p.humanoid._feet?.[s];
    f.feet[s] = { ball, ankle, gBall: ground(ball), gAnkle: ground(ankle), locked: !!F?.locked, step: !!F?.step, w: F?.w ?? 0, contact: p.animator?.contact?.[s] ?? 0, gait: p.animator?.gaitW ?? 0 };
  }
  f.pelvis = B.pelvis.getWorldPosition(new THREE.Vector3());
  f.head = B.Head.getWorldPosition(new THREE.Vector3());
  // the largest change of any bone's local rotation since the last frame (rad)
  const names = (p._sampleNames ??= Object.keys(B));
  f.q = names.map((k) => B[k].quaternion.clone());
  f.maxTurn = 0;
  if (prev?.q) f.q.forEach((x, i) => { const a = x.angleTo(prev.q[i]); if (a > f.maxTurn) { f.maxTurn = a; f.turnBone = names[i]; } });
  if (prev) delete prev.q;   // (only the last frame's rotations are kept)
  return f;
}

/**
 * The measures over a run:
 *  slide: for each contact (the ball within 3 cm of the ground below it), how far it moved over
 *         the ground meanwhile (m): max and mean; touching down and lifting off included
 *  heldSlide: the most a planted foot (held, fully blended in) moved over one hold (m)
 *  sink:  the deepest the ball or the heel went under the ground (m)
 *  jitter: the pelvis and head's jerk (3rd difference of their world position) RMS, km/s^3
 *  maxTurn: the most any bone turned (its local rotation) from one frame to the next (rad)
 * (the first `warm` seconds are left out: the body settling from its bind pose)
 */
export function measure(frames, H, dt, warm = 0.3) {
  const ballRest = H.rest.get(H.b.ball_l).p.y, ankleRest = H.rest.get(H.b.foot_l).p.y;
  let maxSlide = 0, sumSlide = 0, contacts = 0, sink = 0;
  const slides = [];
  for (const s of ['l', 'r']) {
    let run = null;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].t < warm) continue;
      const f = frames[i].feet[s], g = frames[i - 1].feet[s];
      const h = f.ball.y - ballRest - f.gBall;
      if (Number.isFinite(f.gBall)) sink = Math.max(sink, -h);
      const hh = f.ankle.y - ankleRest - f.gAnkle;
      if (Number.isFinite(f.gAnkle)) sink = Math.max(sink, -hh - 0.04);   // (the heel's sole is ~4 cm under the ankle's rest line when the toe is down)
      const on = h < 0.03;
      if (on) {
        const d = Math.hypot(f.ball.x - g.ball.x, f.ball.z - g.ball.z);
        if (!run) run = { slide: 0, n: 0, from: frames[i].t, tag: frames[i].tag };
        run.slide += d; run.n++;
      } else if (run) {
        if (run.n >= 4) { slides.push({ ...run, side: s }); maxSlide = Math.max(maxSlide, run.slide); sumSlide += run.slide; contacts++; }
        run = null;
      }
    }
    if (run && run.n >= 4) { slides.push({ ...run, side: s }); maxSlide = Math.max(maxSlide, run.slide); sumSlide += run.slide; contacts++; }
  }
  const jerk = (key) => {
    let s = 0, n = 0;
    for (let i = 3; i < frames.length; i++) {
      if (frames[i - 3].t < warm) continue;
      const p = (k) => frames[i - k][key];
      // (in the world: what the eye sees, the root's own steps on a stair included)
      const j = new THREE.Vector3().copy(p(0)).addScaledVector(p(1), -3).addScaledVector(p(2), 3).addScaledVector(p(3), -1);
      s += j.lengthSq(); n++;
    }
    return Math.sqrt(s / Math.max(n, 1)) / dt ** 3 / 1000;
  };
  const maxTurn = Math.max(...frames.filter((f) => f.t >= warm).map((f) => f.maxTurn));
  // the planted feet themselves: how far a held foot (planted, fully blended in) moves over its hold
  let heldSlide = 0;
  for (const s of ['l', 'r']) {
    let run = 0;
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i].feet[s], g = frames[i - 1].feet[s];
      if (frames[i].t >= warm && f.locked && g.locked && f.w > 0.95 && g.w > 0.95) { run += Math.hypot(f.ball.x - g.ball.x, f.ball.z - g.ball.z); heldSlide = Math.max(heldSlide, run); }
      else run = 0;
    }
  }
  return { maxSlide, meanSlide: contacts ? sumSlide / contacts : 0, contacts, slides, heldSlide, sink, jitterPelvis: jerk('pelvis'), jitterHead: jerk('head'), maxTurn };
}

/** The seconds from `from` until the heading is within `tol` of `target` (rad), or Infinity. */
export function timeToFace(frames, from, target, tol = 0.2) {
  for (const f of frames) if (f.t >= from && Math.abs(Math.atan2(Math.sin(f.heading - target), Math.cos(f.heading - target))) < tol) return f.t - from;
  return Infinity;
}

/** Per phase of a run (its script's tags): the contacts that began in it, their worst and mean slide. */
export function byTag(r) {
  const out = {};
  for (const s of r.slides) { const o = (out[s.tag] ??= { n: 0, max: 0, sum: 0 }); o.n++; o.max = Math.max(o.max, s.slide); o.sum += s.slide; }
  for (const o of Object.values(out)) o.mean = o.sum / o.n;
  return out;
}
