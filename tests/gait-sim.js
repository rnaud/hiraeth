// A headless traveller (Player + Humanoid + the clip library + Physics) driven through scripted
// input, with the measures the animation work is judged by: how far a foot slides while it is
// on the ground, how deep a sole goes under it, how much the pose jitters, and how long the body
// takes to answer the stick. tests/locomotion.test.js uses it; so can a script (see README,
// "The traveller's locomotion").
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter, Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { libraryFrom } from '../src/animator.js';
import { Animator } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';

const parse = async (name) => {
  const b = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
let assets = null;
export async function loadAssets() {
  // (the clip library with its motion-matching database, public/anim/locomotion.glb, attached: lib.motion)
  assets ??= Promise.all([parse('ual.glb'), parse('human_m.glb'), parse('human_f.glb'), parse('locomotion.glb')]).then(([ual, m, f, loco]) => {
    const lib = libraryFrom(ual);
    attachMotion(lib, loco);
    return { lib, human: { m: prepareHuman(m.scene, 'm'), f: prepareHuman(f.scene, 'f') } };
  });
  return assets;
}

/** Ground for the walk: a flat floor, a 12° ramp up (x = -20) and 18 cm stairs up and down again (x = 20), along +z from z = 30. */
export function course({ ramp = true, stairs = true } = {}) {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400));
  floor.position.y = -0.5;
  scene.add(floor);
  if (ramp) {
    const a = THREE.MathUtils.degToRad(12), len = 14;
    const r = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, len));
    r.rotation.x = -a;
    r.position.set(-20, Math.sin(a) * len / 2 - 0.2 / Math.cos(a), 30 + Math.cos(a) * len / 2);
    scene.add(r);
  }
  if (stairs) {
    // eight 18 cm steps up from z = 30, a 3 m landing, eight steps down
    const step = (h, z) => { const s = new THREE.Mesh(new THREE.BoxGeometry(6, h, 0.32)); s.position.set(20, h / 2, z); scene.add(s); };
    for (let i = 0; i < 8; i++) step(0.18 * (i + 1), 30.16 + i * 0.32);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 1.44, 3));
    top.position.set(20, 0.72, 32.56 + 1.5);
    scene.add(top);
    for (let i = 0; i < 8; i++) step(0.18 * (8 - i), 35.56 + 0.16 + i * 0.32);
  }
  scene.updateMatrixWorld(true);
  return scene;
}

/** A traveller on the course, standing at `at` facing +z (heading 0); o.matching: motion matching on, or off (the loops alone, the game's default). */
export async function traveller(scene, at = new THREE.Vector3(0, 0, 0), { matching = false } = {}) {
  const { lib, human } = await loadAssets();
  const physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.animator.matching = matching;
  p.humanoid = new Humanoid(human.m, p.char, 'm');
  p.gear = { update() {}, device: { visible: true } };   // (no cloth or gear: they don't move the body)
  p._lastVel = new THREE.Vector3();
  p.pos.copy(at); p.pos.y = physics.groundAt(at.x, at.y + 5, at.z);
  p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true;
  p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}

// camera yaw for which W walks toward +z (player.js: camF = -(sin yaw, cos yaw) in x, z)
export const CAM_PLUS_Z = Math.PI;

/**
 * Run a script of [seconds, input] at `fps`, sampling every frame. Returns the frames and the
 * measures. input: { KeyW, KeyS, KeyA, KeyD, ShiftLeft } or { stick: { x, y } } (camera-relative).
 */
export function drive(p, script, { fps = 60, camYaw = CAM_PLUS_Z } = {}) {
  const dt = 1 / fps, frames = [];
  const B = p.humanoid.b, up = new THREE.Vector3(0, 1, 0);
  const ground = (v) => p.physics.groundAt(v.x, v.y + 1.5, v.z, 4);
  const names = Object.keys(B);
  let t = 0, prevQ = null;
  for (const [secs, input, tag] of script) {
    const n = Math.round(secs * fps);
    for (let i = 0; i < n; i++) {
      p.update(dt, input, camYaw);
      p.object.updateMatrixWorld(true);
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
      const q = names.map((k) => B[k].quaternion.clone());
      f.maxTurn = 0;
      if (prevQ) q.forEach((x, i) => { const a = x.angleTo(prevQ[i]); if (a > f.maxTurn) { f.maxTurn = a; f.turnBone = names[i]; } });
      prevQ = q;
      frames.push(f);
      t += dt;
    }
  }
  return { frames, ...measure(frames, p.humanoid, dt) };
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
