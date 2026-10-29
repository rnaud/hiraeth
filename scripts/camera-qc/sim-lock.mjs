// The camera QC's lock-on walks in node (.claude/skills/camera-qc/SKILL.md, issue #289): the browser's ante-lock without
// a browser. The Signal Market built (its collision), the traveller locked on to a blot held still in the Undertower's
// antechamber, moved by the scenario's own stick (scripts/camera-qc/scenarios.mjs) as the game moves him locked on (the
// stick read from the lock's line, a jog, pushed out of the walls), the real CameraRig following him, the lock camera
// turned as main.js turns it (src/foes.js lockFollow). `jitter` wobbles each frame's step by ± that share (seeded): the
// run twice with other steps must come out the same, the cause of #289 being a camera whose path forked on a millisecond.
//
//   node scripts/camera-qc/sim-lock.mjs [runs=5] [jitter=0.25]     each run's measures (scripts/camera-qc/lib.mjs)
import * as THREE from 'three';
import { buildableById } from '../../src/levels/buildable.js';
import { Physics } from '../../src/physics.js';
import { CameraRig } from '../../src/player.js';
import { lockFollow } from '../../src/foes.js';
import { analyse, cover } from './lib.mjs';
import { foeBox } from '../../src/lock-frame.js';
import { ANTE_WAY, ANTE_SEGS } from './scenarios.mjs';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const F = { up: Y, fwd: Z, right: X };
const WALK = 3.8, LOCK_SPEED = 4.2, RADIUS = 0.45, STEP = 0.6, HEIGHT = 2.2;

const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };

/** The Signal Market built once: its level and collision. */
export function marketWorld() {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('bazaar').create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  return { scene, level, physics };
}

/** The antechamber's start, as the browser scenario's setup works it out: the room's middle (the blot), him 2.6 m back toward the door. */
export function antechamber(level) {
  const rt = (level.temples ?? []).find((t) => t.guardian && t.marks.some((m) => m.room === 'ante'));
  const K = rt.kit, o = K.world(0, 0, 0), ax = K.world(0, 0, 1).sub(o).normalize(), sx = K.world(1, 0, 0).sub(o).normalize();
  const m = rt.marks.find((q) => q.room === 'ante'), mid = m.pos.clone().addScaledVector(sx, -(4.4 - 1));
  return { mid, start: mid.clone().addScaledVector(ax, -2.6), ax };
}

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/**
 * One locked-on walk: `segs` the scenario's segments (stick, run: m/s running in; lock taken at the start), the foe `foe` (a position, held
 * still; `foeR` its radius, chest `chestY` m up), him from `start`, the camera's yaw `yaw` (the scenario's: looking along
 * `ax`). Returns the samples as the browser records them (lib.mjs), and the rig.
 */
export function lockWalk(world, { segs, foe, start, yaw, jitter = 0, seed = 1, settle = 3, foeR = 0.6, chestY = 0.5, frame = true }) {
  const fbox = { min: new THREE.Vector3(), max: new THREE.Vector3() };
  const { physics } = world;
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, dom, physics);
  const rand = rng(seed), step = () => (1 / 60) * (1 + jitter * (2 * rand() - 1));
  const pos = start.clone(); pos.y = physics.groundAt(pos.x, pos.y + 1.5, pos.z, 4);
  const vel = new THREE.Vector3(), push = new THREE.Vector3();
  const f = { pos: foe.clone(), chest: foe.clone().add(new THREE.Vector3(0, chestY, 0)), def: { radius: foeR } };
  rig.yaw = yaw; rig._lastP = null;
  const view = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 };
  // (settled where he starts, not yet locked)
  for (let i = 0; i < settle * 60; i++) { rig.lockRoom(1 / 60, null); rig.update(pos, 1 / 60, null); }
  const S = [], fwd = new THREE.Vector3(), head = new THREE.Vector3(), chest = new THREE.Vector3(), n = new THREE.Vector3(), to = new THREE.Vector3();
  const ndc = (p) => { n.copy(p).project(camera); return n.z > 1 ? null : [n.x, n.y]; };
  const rect = (c, rx, y0, y1) => { let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 8; k++) { n.set(c.x + (k & 1 ? rx : -rx), (k & 2 ? y1 : y0), c.z + (k & 4 ? rx : -rx)).project(camera); if (n.z > 1) return null;
      b = [Math.min(b[0], n.x), Math.min(b[1], n.y), Math.max(b[2], n.x), Math.max(b[3], n.y)]; }
    return b; };
  let t = 0;
  for (const [si, s] of segs.entries()) {
    let wp = 0, stuck = 0, stuckP = null;
    for (let st = 0; st < s.for && !(s.path && wp >= s.path.length);) {
      const dt = step(); st += dt; t += dt;
      // the lock (main.js: before the traveller moves, the frame before's camera)
      rig.locked = true; rig.lockAt = f.chest;
      // (its box, as the game gives any locked foe's since #752: src/lock-frame.js foeBox; a blot of its radius and chest here)
      rig.frameWith = frame ? foeBox(f, f.pos, fbox, t, null) : null;
      // him: the stick read from the lock's line (rig.yaw less its turn off the line for room), a jog at most
      let move = null, sc = 0;
      if (s.stick) {
        const [x, y] = s.stick, cy = rig.yaw - rig.lockOff; sc = Math.min(Math.hypot(x, y), 1);
        move = new THREE.Vector3(-Math.sin(cy) * y + Math.cos(cy) * x, 0, -Math.cos(cy) * y - Math.sin(cy) * x);
      } else if (s.path && wp < s.path.length) {
        // (to the points in turn, as the browser's hands walk them: the next within `near` (0.6) m, or after 2 s stuck)
        const w = s.path[wp], d = new THREE.Vector3(w[0] - pos.x, 0, w[1] - pos.z);
        if (d.length() < (s.near ?? 0.6)) { wp++; stuck = 0; }
        else { move = d.normalize(); sc = Math.min(1, s.pace ?? 1); }
        if (!stuckP || stuckP.distanceTo(pos) > 0.3) { stuckP = pos.clone(); stuck = 0; } else if ((stuck += dt) > 2) { wp++; stuck = 0; stuckP = null; }
      }
      // (`run`: m/s, running in at the foe with the run held: src/player.js LOCK_RUN, issue #770; else a jog at most)
      if (move?.lengthSq() > 0) move.normalize().multiplyScalar(s.run ?? Math.min(WALK * (sc < 1 ? THREE.MathUtils.lerp(0.35, 1, sc) : 1), LOCK_SPEED));
      else move = null;
      const a = 1 - Math.exp(-(move ? 8 : 16) * dt);
      vel.addScaledVector((move ?? new THREE.Vector3()).sub(vel), a);
      pos.addScaledVector(vel, dt);
      if (physics.pushCapsule(pos, RADIUS, STEP, HEIGHT, push, Y)) { const n2 = push.clone().setY(0).normalize(); const into = vel.dot(n2); if (into < 0) vel.addScaledVector(n2, -into); }
      const g = physics.groundAt(pos.x, pos.y + 1.2, pos.z, 3); if (Number.isFinite(g)) pos.y = g;
      rig._vel = vel;
      const want = lockFollow(view, rig, f, pos, F, dt), line0 = Math.atan2(-(f.pos.x - pos.x), -(f.pos.z - pos.z));
      rig.update(pos, dt, null);
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(fwd);
      head.copy(pos).addScaledVector(Y, 1.6); chest.copy(pos).addScaledVector(Y, 1.1);
      to.copy(head).sub(camera.position); const Lh = to.length();
      let clear = 1;
      for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) clear = Math.min(clear, physics.rayDistance(camera.position, n.set(...d), 1));
      const fb = rect(f.pos, foeR, f.pos.y, f.chest.y + foeR * 0.5), pb = rect(pos, 0.3, pos.y, pos.y + 1.75);
      S.push({ t, dt, cam: camera.position.toArray(), look: rig._look.toArray(), pos: pos.toArray(), fwd: fwd.toArray(), cmdYaw: 0, cmdPitch: 0, clear,
        occl: Lh > 0.4 && physics.rayDistance(camera.position, to.divideScalar(Lh), Lh) < Lh - 0.25,
        head: ndc(head), chest: ndc(chest), tight: rig.tightK, side: rig._side, shoulder: rig.shoulder, cur: rig._curDist, seg: si,
        foeCover: fb && pb ? cover(fb, pb) : 0, foeD: Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z),
        // (the lock camera's state, for the diagnosis: its lag behind the yaw it wants, its yaw off the line, its stand-off
        // swing, the room's turn off the line and its goal, the climb, the short arm's tip)
        lag: Math.atan2(Math.sin(want - rig.yaw), Math.cos(want - rig.yaw)), yawOff: Math.atan2(Math.sin(rig.yaw - line0), Math.cos(rig.yaw - line0)),
        view: view.angle, vside: view.side, vturn: view.turn, lockOff: rig._lockOff ?? 0, lockGoal: rig._lockGoal ?? 0, climb: rig._climb ?? 0, tilt: rig._tilt ?? 0 });
    }
  }
  return { samples: S, rig };
}

/** The browser's ante-lock in node: its own segments, from its own start. */
export function anteLock(world, opts = {}) {
  const A = antechamber(world.level), side = new THREE.Vector3(A.ax.z, 0, -A.ax.x);
  const P = ([a, b]) => { const p = A.mid.clone().addScaledVector(A.ax, a).addScaledVector(side, b); return [p.x, p.z]; };
  const segs = ANTE_SEGS.map((s) => ({ ...s, path: s.path ? ANTE_WAY[s.path].map(P) : undefined }));
  return lockWalk(world, { segs, foe: A.mid, start: A.start, yaw: Math.atan2(-A.ax.x, -A.ax.z), ...opts });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const world = marketWorld(), runs = Number(process.argv[2] ?? 5), jitter = Number(process.argv[3] ?? 0.25);
  for (let k = 1; k <= runs; k++) {
    const { samples } = anteLock(world, { jitter: k > 1 ? jitter : 0, seed: k });
    const r = analyse(samples), m = r.measures, end = samples.at(-1);
    console.log(`ante-lock run ${k} ${r.green ? 'green' : 'RED  '} pops ${m.pops} jumps ${m.jumps} look ${m.lookJumps} spins ${m.spins} (p95 ${m.spinP95}) clip ${(m.clip * 100).toFixed(1)}% out ${(m.out * 100).toFixed(1)}% rev ${m.reversals}/s rough ${(m.rms * 100).toFixed(2)} cm arm ${m.armMin}-${m.armMax} foe hidden ${((m.lockHidden ?? 0) * 100).toFixed(1)}% ends ${end.pos.map((v) => v.toFixed(2))}${r.green ? '' : ' | ' + r.fails.join('; ')}`);
    if (process.env.DUMP && process.env.RUN == k) { const [a, b] = process.env.DUMP.split('-').map(Number);
      for (const [i, s] of samples.entries()) if (s.t >= a && s.t <= b) console.log(`   #${i} t ${s.t.toFixed(3)} pos ${s.pos.map((v) => v.toFixed(2))} look ${s.look.map((v) => v.toFixed(2))} cam ${s.cam.map((v) => v.toFixed(2))} cur ${s.cur.toFixed(2)} k ${s.tight.toFixed(2)} side ${s.side.toFixed(2)} off ${s.lockOff.toFixed(2)} goal ${s.lockGoal.toFixed(2)} climb ${s.climb.toFixed(2)} tilt ${s.tilt.toFixed(2)} head ${s.head?.map((v) => v.toFixed(2))}`); }
    if (process.env.EVENTS) for (const e of r.events.slice(0, +process.env.EVENTS)) { const s = samples[e.i]; console.log(`   ${e.kind} t ${e.t.toFixed(2)} ${e.size.toFixed(2)} at ${s.pos.map((v) => v.toFixed(2))} cur ${s.cur.toFixed(2)} off ${s.lockOff.toFixed(2)} goal ${s.lockGoal.toFixed(2)} climb ${s.climb.toFixed(2)} tilt ${s.tilt.toFixed(2)}`); }
  }
}
