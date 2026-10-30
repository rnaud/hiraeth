// The camera QC's close lock in node (issue #795, a gap left by #752: "at 2 m the furnace brute, bell and heron, and the
// warlord's glaive tip, can clip the top of the frame; rooms keep the close camera"). A foe of each kind in the Arena's
// middle (the open) or the Undertower's antechamber (a room, 8 × 6.9 m), awake and fighting (its real update and pose:
// its wind-ups raise its arms and its weapon), held to its spot; the traveller locked on to it 1.5, 2 and 3 m off,
// standing, then circling it each way at a jog; the real CameraRig and the lock camera as the game turns them
// (src/foes.js lockFollow), the foe's box as the game gives it (src/lock-frame.js foeBox). Every frame: the share of its
// drawn body's bounds (bodySpan's box, its corners on the screen) off the screen, and the camera's motion (lib.mjs).
// `fit: false` is the camera before #752 (no box given).
//
//   node scripts/camera-qc/sim-close.mjs [kind …] [--room] [--before] [--d 1.5,2,3]     a line per kind and distance
import * as THREE from 'three';
import { CameraRig } from '../../src/player.js';
import { Foes, lockFollow } from '../../src/foes.js';
import { GameState } from '../../src/game-state.js';
import { foeBox } from '../../src/lock-frame.js';
import { bodySpan } from '../../src/foe-body.js';
import { analyse } from './lib.mjs';
import { world } from './sim-guardians.mjs';
import { antechamber } from './sim-lock.mjs';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const F = { up: Y, fwd: Z, right: X };
const RADIUS = 0.45, STEP = 0.6, HEIGHT = 2.2, JOG = 2.6;
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

/** The kinds #795 names, and two that fitted already (they must not change for the worse). */
export const CLOSE_KINDS = ['brute', 'bell', 'heron', 'warlord', 'hulk', 'grunt'];
export const CLOSE_DISTS = [1.5, 2, 3];

/** A place to stand it: 'open' the Arena's middle, 'room' the Undertower's antechamber's middle (its collision, its ceiling). */
export function place(where = 'open') {
  if (where === 'room') {
    const W = world('bazaar'), A = antechamber(W.level);
    const y = W.physics.groundAt(A.mid.x, A.mid.y + 1.5, A.mid.z, 4);
    return { ...W, where, at: A.mid.clone().setY(Number.isFinite(y) ? y : A.mid.y), ax: A.ax };
  }
  return { ...world('arena'), where, at: new THREE.Vector3(0, 0, 0), ax: Z.clone() };
}

/** A foe of `kind` awake at the place's middle, fighting the stand-in traveller `P` (his hurts dropped). */
export function awake(W, kind, P, seed = 7) {
  const foes = quiet(() => new Foes({ scene: new THREE.Scene(), level: { spawn: new THREE.Vector3(0, 0, -500), foes: { waves: false } }, levelId: W.id, physics: W.physics, player: P,
    settings: { enemies: 'normal' }, game: new GameState(null), notice() {}, rng: seeded(seed), sound: new Proxy({}, { get: () => () => {} }) }));
  const f = quiet(() => foes.add(kind, W.at.clone()));
  f.provoked = true; f.state = 'chase';
  return { foes, f };
}

const _n = new THREE.Vector3();
/**
 * The share of `box` (the foe's drawn bounds) off the screen: of a 5 × 5 × 5 grid of points through it, those outside the
 * view (behind the lens too); `head` whether the middle of its top is off; `rect` its corners' screen rectangle (NDC,
 * for the diagnosis: it blows up for a corner near the lens's plane, which is why the share is counted by points).
 */
const G5 = [0, 0.25, 0.5, 0.75, 1];
export function offShare(camera, box) {
  let out = 0, n = 0;
  const inView = () => { _n.project(camera); return _n.z < 1 && _n.z > -1 && Math.abs(_n.x) <= 1 && Math.abs(_n.y) <= 1; };
  for (const u of G5) for (const v of G5) for (const w of G5) {
    _n.set(box.min.x + (box.max.x - box.min.x) * u, box.min.y + (box.max.y - box.min.y) * v, box.min.z + (box.max.z - box.min.z) * w);
    n++; if (!inView()) out++;
  }
  _n.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  const head = !inView();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < 8; k++) {
    _n.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
    x0 = Math.min(x0, _n.x); x1 = Math.max(x1, _n.x); y0 = Math.min(y0, _n.y); y1 = Math.max(y1, _n.y);
  }
  return { off: out / n, head, rect: [x0, y0, x1, y1] };
}

/**
 * Locked on a fighting `kind` at `d` m in `where`: standing `stand` s, then circling it `secs` s each way at a jog. Returns
 * lib.mjs's measures of the camera's path, and of the frames after the first second: `off` the mean share of its bounds
 * off the screen (offShare), `offMax` the worst frame's, `cut` the share of frames with more than 2 % off, `heads` the
 * share with the middle of its top off; `accel` the camera's largest change of velocity in a frame (m/s per frame) and `turn` the view's
 * largest change of angular speed in a frame (°/s per frame).
 */
export function closeLock(kind, d, { where = 'open', fit = true, stand = 2, secs = 4, dt = 1 / 60, seed = 7, probe = false } = {}) {
  const W = place(where), { physics } = W;
  const pos = W.at.clone().addScaledVector(W.ax, -d);
  const P = { pos, vel: new THREE.Vector3(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, hurt() { this.health = 1; }, knockDown() { return false; }, flinch() {} };
  const { foes, f } = awake(W, kind, P, seed);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, dom, physics);
  rig.yaw = Math.atan2(-(f.pos.x - pos.x), -(f.pos.z - pos.z));
  const view = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 }, vel = new THREE.Vector3(), box = { min: new THREE.Vector3(), max: new THREE.Vector3() }, push = new THREE.Vector3();
  const S = [], fwd = new THREE.Vector3(), head = new THREE.Vector3(), chest = new THREE.Vector3(), n = new THREE.Vector3();
  const ndc = (p) => { n.copy(p).project(camera); return n.z > 1 ? null : [n.x, n.y]; };
  const offs = [];
  let t = 0;
  rig._jumped = true;
  for (const [side, for_] of [[0, stand], [1, secs], [-1, secs]]) {
    for (let st = 0; st < for_; st += dt) {
      t += dt;
      quiet(() => foes.update(dt));
      f.pos.x = W.at.x; f.pos.z = W.at.z; P.health = 1;
      rig.locked = true; rig.lockAt = f.chest; rig.frameWith = fit ? foeBox(f, f.pos, box, t, bodySpan) : null;
      // (round it at d m: a jog across the line to it, held to the circle)
      const to = new THREE.Vector3(f.pos.x - pos.x, 0, f.pos.z - pos.z); to.divideScalar(to.length() || 1);
      const move = side ? new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(side * JOG) : new THREE.Vector3();
      vel.lerp(move, 1 - Math.exp(-(side ? 8 : 16) * dt));
      pos.addScaledVector(vel, dt);
      const R1 = Math.hypot(pos.x - f.pos.x, pos.z - f.pos.z) || 1;
      pos.x = f.pos.x + ((pos.x - f.pos.x) * d) / R1; pos.z = f.pos.z + ((pos.z - f.pos.z) * d) / R1;
      if (physics.pushCapsule?.(pos, RADIUS, STEP, HEIGHT, push, Y)) { const n2 = push.clone().setY(0).normalize(); const into = vel.dot(n2); if (into < 0) vel.addScaledVector(n2, -into); }
      const g = physics.groundAt(pos.x, pos.y + 1.2, pos.z, 3); if (Number.isFinite(g)) pos.y = g;
      rig._vel = vel;
      lockFollow(view, rig, f, pos, F, dt);
      rig.update(pos, dt, null);
      rig._jumped = false;
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(fwd);
      head.copy(pos).addScaledVector(Y, 1.6); chest.copy(pos).addScaledVector(Y, 1.1);
      const o = offShare(camera, bodySpan(f.model)._box);
      if (t > 1) offs.push(o);
      let clear = 1;
      for (const dd of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) clear = Math.min(clear, physics.rayDistance(camera.position, n.set(...dd), 1));
      S.push({ t, dt, cam: camera.position.toArray(), look: rig._look.toArray(), pos: pos.toArray(), fwd: fwd.toArray(), cmdYaw: 0, cmdPitch: 0, clear,
        occl: false, head: ndc(head), chest: ndc(chest), tight: rig.tightK, side: rig._side, shoulder: rig.shoulder, cur: rig._curDist, seg: side + 1, fitK: rig.fitK, fov: camera.fov,
        ...(probe ? { state: f.state, off: o.off, head: o.head, rect: o.rect, goal: rig._fitGoal && { ...rig._fitGoal }, boxTop: box.max.y - f.pos.y, fitBoxTop: rig._fitBox ? rig._fitBox.max.y - f.pos.y : null, bodyTop: bodySpan(f.model)._box.max.y - f.pos.y } : {}) });
    }
  }
  quiet(() => foes.dispose?.());
  // (the camera's motion: its largest change of velocity in a frame, the view's largest change of turning speed)
  let accel = 0, accelT = 0, turn = 0, fovStep = 0, fovRev = 0, fovSign = 0;
  for (let i = 2; i < S.length; i++) {
    if (S[i].t < 1) continue;
    const a = S[i].cam, b = S[i - 1].cam, c = S[i - 2].cam;
    const ac = Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1], a[2] - 2 * b[2] + c[2]) / dt;
    if (ac > accel) { accel = ac; accelT = S[i].t; }
    // (the lens: its largest step in a frame, and how often its widening turns back, > 0.02° a frame: breathing)
    const df = S[i].fov - S[i - 1].fov;
    fovStep = Math.max(fovStep, Math.abs(df));
    if (Math.abs(df) > 0.02) { if (fovSign && Math.sign(df) !== fovSign) fovRev++; fovSign = Math.sign(df); }
    const ang = (p, q) => Math.acos(THREE.MathUtils.clamp(p[0] * q[0] + p[1] * q[1] + p[2] * q[2], -1, 1));
    turn = Math.max(turn, Math.abs(ang(S[i].fwd, S[i - 1].fwd) - ang(S[i - 1].fwd, S[i - 2].fwd)) / dt * 180 / Math.PI);
  }
  const r = analyse(S);
  return { ...r, samples: S, rig, off: offs.reduce((s, o) => s + o.off, 0) / Math.max(1, offs.length), offMax: Math.max(...offs.map((o) => o.off)),
    cut: offs.filter((o) => o.off > 0.02).length / Math.max(1, offs.length), heads: offs.filter((o) => o.head).length / Math.max(1, offs.length), accel, accelT, turn, fovStep, fovRev,
    tight: S.reduce((s, x) => s + x.tight, 0) / S.length, fitK: S.reduce((s, x) => s + x.fitK, 0) / S.length, fovMax: Math.max(...S.map((x) => x.fov)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), fit = !args.includes('--before'), where = args.includes('--room') ? 'room' : 'open';
  const di = args.indexOf('--d'), dists = di >= 0 ? args[di + 1].split(',').map(Number) : CLOSE_DISTS;
  const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--d');
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  for (const kind of only.length ? only : CLOSE_KINDS) for (const d of dists) {
    const c = closeLock(kind, d, { where, fit }), m = c.measures;
    console.log(`${where} ${kind.padEnd(8)} ${d} m: off ${pct(c.off)} (worst ${pct(c.offMax)}, frames cut ${pct(c.cut)}, top cut ${pct(c.heads)}) | ${c.green ? 'green' : 'RED'} pops ${m.pops} jumps ${m.jumps} look ${m.lookJumps} spins ${m.spins} rough ${(m.rms * 100).toFixed(2)} cm accel ${c.accel.toFixed(2)} (${c.accelT.toFixed(2)} s) turn ${c.turn.toFixed(0)}°/s fov step ${c.fovStep.toFixed(2)}° rev ${c.fovRev} | arm ${m.armMin}-${m.armMax} tight ${c.tight.toFixed(2)} fit ${c.fitK.toFixed(2)} fov ${c.fovMax.toFixed(0)}${c.green ? '' : ' | ' + c.fails.join('; ')}`);
  }
}
