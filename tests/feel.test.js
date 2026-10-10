import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../src/player.js';
import { STAMINA, spendStamina, restStamina, canSprint } from '../src/stamina.js';
import { jumpPhase, timeToGround, landSquash, squashCurve, JumpLayer } from '../src/jump.js';
import { keepInside, EdgePush, EDGE_HINTS } from '../src/edge.js';
import { course, traveller } from './gait-sim.js';
import { setHintLevel } from '../src/hint-level.js';

// Feel and look, October 2026 (TODO.md): one stamina for running and climbing, the jump by its
// phase, and the world's edge you can feel (no more running on the spot against it).

const DT = 1 / 60;
const flat = { heightAbove: (p) => p.y, groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null, pushCapsule: () => null, groundNormal: () => new THREE.Vector3(0, 1, 0) };
const horiz = (v) => Math.hypot(v.x, v.z);
const run = (p, secs, input = {}, yaw = 0, each) => { for (let i = 0; i < Math.round(secs * 60); i++) { p.update(DT, input, yaw); each?.(p); } };
const walker = (opts = {}) => { const p = new Player(flat, { health: false, climb: false, ...opts }); p.pos.set(0, 0, 0); p.onGround = true; return p; };
const SPRINT = { KeyW: true, ShiftLeft: true }, JOG = { KeyW: true };

// ---------------------------------------------------------------- stamina

test('stamina: spent, rested after a pause, faster standing; run dry, winded until it is back to recover', () => {
  const P = { stamina: 1 };
  spendStamina(P, 0.4);
  assert.equal(P.stamina, 0.6);
  restStamina(P, STAMINA.delay * 0.5, 1);
  assert.equal(P.stamina, 0.6, 'nothing back straight after spending');
  restStamina(P, STAMINA.delay, 0.5);
  assert.ok(P.stamina > 0.6, 'then it comes back');
  spendStamina(P, 2);
  assert.equal(P.stamina, 0); assert.ok(P.winded && !canSprint(P), 'run dry: winded');
  for (let i = 0; i < 600 && P.winded; i++) restStamina(P, DT, STAMINA.walk);
  assert.ok(!P.winded && Math.abs(P.stamina - STAMINA.recover) < 0.01, `back at ${P.stamina.toFixed(2)}`);
  assert.ok(STAMINA.stand > STAMINA.walk, 'standing rests faster than walking');
});

test('sprinting runs a little faster and drains the stamina; jogging and standing give it back', () => {
  const p = walker();
  run(p, 2, JOG);
  const jog = horiz(p.vel);
  run(p, 3, SPRINT);
  const sprint = horiz(p.vel);
  assert.ok(sprint > 8 && sprint < 8.4, `the sprint: ${sprint.toFixed(2)} m/s (it was 7.2)`);
  assert.ok(Math.abs(jog - 3.8) < 0.05, 'the jog is as it was');
  assert.ok(p.stamina < 0.8 && p.stamina > 0.6, `3 s of sprinting: ${p.stamina.toFixed(2)} left`);
  // jogging on: it comes back; standing faster
  const s0 = 0.2; p.stamina = s0; run(p, 2, JOG); const jogBack = p.stamina - s0;
  assert.ok(jogBack > 0.2, `jogging rests it (${jogBack.toFixed(2)} in 2 s)`);
  p.stamina = s0; run(p, 2, {}); const standBack = p.stamina - s0;
  assert.ok(standBack > jogBack, `standing rests it faster (${standBack.toFixed(2)})`);
  // none in the air: a sprint jump neither spends nor rests
  const a = walker(); run(a, 1, SPRINT); const before = a.stamina;
  a.update(DT, { ...SPRINT, Space: true }, 0);
  let air = 0; run(a, 0.5, SPRINT, 0, (q) => { if (!q.onGround) air++; });
  assert.ok(air > 20 && Math.abs(a.stamina - (before - STAMINA.sprint * DT)) < 0.01, 'in the air it holds');
});

test('run dry: no sprint (a jog) until it has come back, then the sprint again', () => {
  const p = walker();
  let emptyAt = null;
  run(p, 16, SPRINT, 0, (q) => { if (q.winded && emptyAt === null) emptyAt = q.time; });
  assert.ok(emptyAt > 10 && emptyAt < 14, `about 12 s of sprinting (${emptyAt?.toFixed(1)} s)`);
  // straight after, holding the sprint: a jog
  const q = walker(); q.stamina = 0.01; run(q, 0.4, SPRINT);
  assert.ok(q.winded && horiz(q.vel) < 4, `winded: ${horiz(q.vel).toFixed(2)} m/s`);
  run(q, 6, SPRINT);
  assert.ok(!q.winded, 'it comes back');
  run(q, 1, SPRINT);
  assert.ok(horiz(q.vel) > 8, 'and the sprint with it');
});

test('climbing spends the same stamina: a winded body lets go of the wall and can\'t take a new hold', () => {
  const wall = { ...flat, pushCapsule: (pos, r, b, t, out) => { if (pos.z < -2 + r) { const d = -2 + r - pos.z; pos.z += d; return out.set(0, 0, d); } return null; },
    rayHit: (o, d) => (d.z < -0.5 ? { distance: Math.max(0, o.z + 2), point: new THREE.Vector3(o.x, o.y, -2), normal: new THREE.Vector3(0, 0, 1) } : null) };
  const p = new Player(wall, { health: false });
  p.pos.set(0, 0, 0); p.onGround = true;
  run(p, 1.5, { KeyW: true });
  assert.ok(p.climbing, 'pushing into the wall climbs');
  p.stamina = 0.3;
  run(p, 0.5, { KeyW: true });
  const used = 0.3 - p.stamina;
  assert.ok(used > 0.015 && used < 0.03, `climbing spends it (${used.toFixed(3)} in 0.5 s)`);
  p.stamina = 0.005; run(p, 0.3, { KeyW: true });
  assert.ok(!p.climbing && p.winded, 'run dry on the wall: it lets go, winded');
  run(p, 1.5, { KeyW: true });
  assert.ok(!p.climbing, 'no new hold while winded');
  // and a sprint after the climb starts from what the climb left
  const s = walker(); s.stamina = 0.2; s.winded = false; run(s, 3, SPRINT);
  assert.ok(s.winded || s.stamina < 0.2, 'one pool');
});

// ---------------------------------------------------------------- the jump by its phase

test('jumpPhase: take-off, rising, the top, falling, reaching for the ground', () => {
  assert.equal(jumpPhase({ airT: 0.05, vy: 11, jumped: true }).stage, 'takeoff');
  assert.equal(jumpPhase({ airT: 0.05, vy: 11, jumped: false }).stage, 'rise', 'a step off a ledge has no push');
  assert.equal(jumpPhase({ airT: 0.3, vy: 5, h: 2 }).stage, 'rise');
  assert.equal(jumpPhase({ airT: 0.4, vy: 0.4, h: 2.5 }).stage, 'apex');
  assert.equal(jumpPhase({ airT: 0.4, vy: -0.8, h: 2.5 }).stage, 'apex');
  assert.equal(jumpPhase({ airT: 1, vy: -12, h: 30 }).stage, 'fall', 'a long way to go');
  assert.equal(jumpPhase({ airT: 0.7, vy: -9, h: 0.8 }).stage, 'reach', 'the ground comes up');
  assert.equal(jumpPhase({ airT: 2, vy: -20, h: Infinity }).stage, 'fall', 'nothing below');
  const P = jumpPhase({ airT: 1, vy: -16, h: 40 });
  assert.ok(P.fall > 0.8 && P.reach === 0 && P.takeoff === 0);
  // the time to the ground: free fall from rest, 4 m at g = 32: 0.5 s
  assert.ok(Math.abs(timeToGround(4, 0, 32) - 0.5) < 1e-9);
  assert.equal(timeToGround(Infinity, -3), Infinity);
  // the squash: deeper the harder the landing, and over in its time
  assert.ok(landSquash(2) < landSquash(10) && landSquash(10) < landSquash(25) && landSquash(25) <= 1);
  assert.equal(landSquash(0.5), 0);
  assert.equal(squashCurve(0), 0); assert.equal(squashCurve(1), 0);
  assert.ok(squashCurve(0.18) > 0.99);
});

test('a jump on flat ground goes through every phase in order, and squashes on landing', async () => {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60));
  run(p, 0.5, {});
  const stages = [], hipFoot = {};
  const U = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3();
  p.update(DT, { Space: true }, 0);
  let squash = 0, landed = false;
  run(p, 1.4, {}, 0, (q) => {
    const J = q._jumpLayer;
    if (!q.onGround) {
      if (stages.at(-1) !== J.phase.stage) stages.push(J.phase.stage);
      // how far the feet hang under the hips, by stage
      const reach = q.char.legs[0].getWorldPosition(a).sub(q.char.feet[0].getWorldPosition(b)).dot(U);
      (hipFoot[J.phase.stage] ??= []).push(reach);
      if (process.env.DBG) console.log(J.phase.stage, reach.toFixed(3), JSON.stringify(Object.fromEntries(Object.entries(J.w).map(([k, v]) => [k, +v.toFixed(2)]))), q.animator.w.jumpLand.toFixed(2), q.animator.w.air.toFixed(2));
    } else if (stages.length) { landed = true; squash = Math.max(squash, J.squash); }
  });
  assert.deepEqual(stages, ['takeoff', 'rise', 'apex', 'fall', 'reach'].filter((s) => stages.includes(s)), `in order: ${stages.join(' → ')}`);
  for (const s of ['takeoff', 'apex', 'reach']) assert.ok(stages.includes(s), `${s} (${stages.join(' → ')})`);
  assert.ok(landed && squash > 0.2, `a squash on landing (${squash.toFixed(2)})`);
  // the feet under the hips: pushing off, legs long; tucked as it rises; long again, reaching for the ground
  const push = hipFoot.takeoff[0], tuck = Math.min(...hipFoot.takeoff, ...(hipFoot.rise ?? []), ...hipFoot.apex), reach = Math.max(...hipFoot.reach);
  assert.ok(push > tuck + 0.15 && reach > tuck + 0.15, `push ${push.toFixed(2)} m, tuck ${tuck.toFixed(2)} m, reach ${reach.toFixed(2)} m`);
  // the clips: the push is Jump_Start's, reaching down is Jump_Land's first frame
  const A = p.animator;
  p.update(DT, { Space: true }, 0); run(p, 0.08, {});
  assert.ok(A.w.jumpStart > 0.3, `the push plays Jump_Start (${A.w.jumpStart.toFixed(2)})`);
  run(p, 0.62, {});
  assert.ok(A.w.jumpLand > 0.3 && !p.onGround, `before landing, Jump_Land (${A.w.jumpLand.toFixed(2)})`);
});

test('the jump layer eases between phases: no pose snaps from one frame to the next', () => {
  const J = new JumpLayer();
  let vy = 13, h = 0, prev = null, worst = 0;
  J.update(DT, { onGround: true, vy: 0 });
  for (let t = 0; t < 0.9; t += DT) {
    vy -= 32 * DT; h += vy * DT;
    if (h < 0) break;
    J.update(DT, { onGround: false, vy, airT: t, h, jumped: true });
    if (prev) for (const k in J.w) worst = Math.max(worst, Math.abs(J.w[k] - prev[k]));
    prev = { ...J.w };
  }
  assert.ok(worst < 0.25, `the biggest change of a weight in a frame: ${worst.toFixed(2)}`);
});

// ---------------------------------------------------------------- the world's edge

test('keepInside: held at the edge, the outward speed gone, the speed along it kept', () => {
  const pos = new THREE.Vector3(21, 0, 3), vel = new THREE.Vector3(4, 0, 2), n = new THREE.Vector3();
  assert.ok(keepInside(pos, vel, 20, n));
  assert.deepEqual([pos.x, vel.x, vel.z], [20, 0, 2]);
  assert.deepEqual(n.toArray(), [-1, 0, 0]);
  const inward = new THREE.Vector3(-3, 0, 0);
  pos.set(20.5, 0, 0); keepInside(pos, inward, 20); assert.equal(inward.x, -3, 'moving back in is left alone');
  assert.equal(keepInside(new THREE.Vector3(1e6, 0, 0), new THREE.Vector3(), Infinity), false, 'no edge');
});

test('pushing into the world\'s edge: no running on the spot, no jitter; sliding along it is smooth; the hint once (hints full)', () => {
  setHintLevel('full');
  const notices = [];
  const p = walker({ limit: 20, edgeHint: EDGE_HINTS.desert });
  p.onNotice = (t) => notices.push(t);
  p.pos.set(0, 0, -17);
  // camera yaw 0: W runs to -z, into the edge at z = -20
  const zs = [], speeds = [];
  run(p, 3, JOG, 0, (q) => { if (q.time > 1.5) { zs.push(q.pos.z); speeds.push(horiz(q.vel)); } });
  assert.ok(zs.every((z) => z === -20), 'held at the edge, not bouncing off it');
  assert.ok(Math.max(...speeds) < 1e-9, `standing against it, not running on the spot (${Math.max(...speeds).toFixed(3)} m/s)`);
  assert.ok(p.edge.k > 0.9, `leaning into it (${p.edge.k.toFixed(2)})`);
  assert.ok(Math.abs(Math.sin(p.heading - Math.PI)) < 0.05, 'facing it');
  assert.deepEqual(notices, [EDGE_HINTS.desert], 'what holds you back, once');
  run(p, 1, {}); run(p, 2, JOG);
  assert.equal(notices.length, 1, 'not again');
  setHintLevel('subtle');
  const quiet = walker({ limit: 20, edgeHint: EDGE_HINTS.desert }), heard = [];
  quiet.onNotice = (t) => heard.push(t); quiet.pos.set(0, 0, -17);
  run(quiet, 3, JOG);
  assert.deepEqual(heard, [], 'hints subtle: the wind and the lean say it, no line');
  // along it, pushing in at 45°: a steady slide (no stutter), at the speed along the edge
  const s = walker({ limit: 20 }); s.pos.set(0, 0, -19.5);
  const along = [], jerk = [];
  let last = null, lastV = null;
  run(s, 3, { KeyW: true, KeyA: true }, 0, (q) => {
    if (q.time < 1.5) return;
    along.push(horiz(q.vel));
    if (last) { const v = q.pos.clone().sub(last); if (lastV) jerk.push(v.clone().sub(lastV).length()); lastV = v; }
    last = q.pos.clone();
  });
  const mean = along.reduce((x, y) => x + y, 0) / along.length;
  assert.ok(Math.abs(mean - 3.8 * Math.SQRT1_2) < 0.1, `sliding along at ${mean.toFixed(2)} m/s`);
  assert.ok(Math.max(...along) - Math.min(...along) < 0.02, 'at a steady speed');
  assert.ok(Math.max(...jerk) < 1e-3, `no jitter (${(Math.max(...jerk) * 1000).toFixed(2)} mm)`);
  assert.ok(s.pos.z === -20, 'against the edge');
  assert.ok(s.edge.k < 0.9, 'walking along it, a lighter lean');
});

test('EdgePush eases in and out and only leans when the stick pushes into the edge', () => {
  const E = new EdgePush(), n = new THREE.Vector3(0, 0, 1), at = new THREE.Vector3(), into = new THREE.Vector3(0, 0, -1), away = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 10; i++) E.update(DT, true, n, at, into);
  assert.ok(E.k > 0.3 && E.k < 0.9, `easing in (${E.k.toFixed(2)})`);
  for (let i = 0; i < 120; i++) E.update(DT, true, n, at, away);
  assert.ok(E.k < 0.01, 'stepping back: none');
  for (let i = 0; i < 120; i++) E.update(DT, true, n, at, null);
  assert.equal(E.k, 0, 'standing at it without pushing: none');
});
