// The blade's attacks from motion capture (src/fluid-blade.js ATTACKS, docs/systems/foes.md "The swings"): every attack
// has its clip in moves.glb, its cut inside the clip and on the clip's own swing frames; held, the first swing charges
// into the Great Sword pack's slash; in the air, the jump attack; moves blend from the pose on screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ATTACKS, SWINGS, CHARGE, AIR, LUNGE, RIPOSTE, DASH, BLADE, attackSample, activeRange, chargePose, trailCut, riposteOpen, dashOpen } from '../src/fluid-blade.js';
import { Foe } from '../src/foes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { readGLB } from '../scripts/mocap/glb.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
const lib = readGLB(readFileSync(new URL('../public/anim/moves.glb', import.meta.url)));

test('every attack has its clip shipped, its phases and its cut inside the clip', () => {
  for (const [name, S] of Object.entries(ATTACKS)) {
    const c = lib.clips.find((x) => x.name === S.clip);
    assert.ok(c, `${name}: ${S.clip} is in moves.glb`);
    const end = (c.n - 1) / c.fps, [a, b] = activeRange(S);
    assert.ok(S.from >= 0 && S.from < a && a < b && b <= S.to && S.to <= end + 1e-6, `${name}: from ${S.from} < cut ${a}–${b} ≤ to ${S.to} ≤ the clip's ${end.toFixed(2)} s`);
    assert.ok(S.hit >= a && S.hit <= b, `${name}: its hit (${S.hit}) inside the cut`);
    const s0 = attackSample(S, 0), d = s0.duration;
    assert.ok(d > 0.3 && d < 1.2, `${name}: ${d.toFixed(2)} s long`);
    assert.equal(s0.phase, 'wind'); assert.equal(attackSample(S, s0.wind + 1e-3).phase, 'strike'); assert.equal(attackSample(S, d - 1e-3).phase, 'recover');
    assert.ok(Math.abs(attackSample(S, s0.wind + s0.active / 2).t - (a + b) / 2) < 1e-6, `${name}: the cut's middle on the clip's`);
    assert.ok(Math.abs(attackSample(S, d).t - S.to) < 1e-6 && Math.abs(s0.t - S.from) < 1e-6, `${name}: from start to end of its range`);
  }
  // the charge's held pose: drawn from the first swing's way to the cocked pose, held round it, before the cut
  assert.ok(CHARGE.raiseFrom < CHARGE.hold && CHARGE.hold === CHARGE.from && CHARGE.hold < activeRange(CHARGE)[0]);
  assert.ok(Math.abs(chargePose(0) - CHARGE.raiseFrom) < 1e-9);
  for (let t = CHARGE.raise; t < 5; t += 0.37) assert.ok(Math.abs(chargePose(t) - CHARGE.hold) < 0.03, `held at ${t.toFixed(2)} s`);
  assert.ok(CHARGE.after < SWINGS[0].wind, 'the charge takes over before the first swing cuts');
  assert.deepEqual(CHARGE.damage, [2, 3]);
});

async function armed() {
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'v1' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const tick = (input = {}, move = null) => { if (move) p.swingMove = move; p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); };
  return { p, tool, tick };
}

test('each attack cuts on its clip\'s own swing: the blade\'s tip is fastest inside the cut, slow before and after', async () => {
  const { p, tool, tick } = await armed();
  const blade = tool.blade;
  for (let i = 0; i < 30; i++) tick({ KeyZ: true });   // (the guard draws the blade: in the fist, full size)
  for (const [name, S] of Object.entries(ATTACKS)) {
    const [a, b] = activeRange(S), step = 1 / 60;
    let prev = null, seen = 0, peak = 0, peakT = 0, inCut = 0, nCut = 0, outside = 0, nOut = 0;
    for (let t = S.from; t <= S.to + 1e-9; t += step) {
      // (settled on the first pose a while: the blend from the last clip runs out)
      for (let k = 0; k < (prev ? 3 : 15); k++) { tick({ KeyZ: true }, { clip: S.clip, t, w: 1, full: true, id: 'probe' }); blade.since = 0; }
      blade.move = S; blade.lit = 1; blade.sheath.set(true); blade.place(0);
      const tip = blade.bladeSegment(1).b.clone().sub(p.pos);
      if (prev && ++seen > 1) {   // (the first step left out: the hilt settling on the first pose)
        const sp = tip.distanceTo(prev) / step, mid = t - step / 2;
        if (sp > peak) { peak = sp; peakT = mid; }
        if (mid >= a && mid <= b) { inCut += sp; nCut++; } else { outside += sp; nOut++; }
      }
      prev = tip;
    }
    // (the lunge's slide: its cut is the run in, the hips' travel, more than the arm's)
    if (S === LUNGE) continue;
    assert.ok(peakT >= a - 0.02 && peakT <= b + 0.02, `${name}: the tip's fastest (${peak.toFixed(1)} m/s at ${peakT.toFixed(2)} s) inside the cut ${a}–${b}`);
    if (process.env.SHOW) console.log(name, peak.toFixed(1), peakT.toFixed(2), (inCut / nCut).toFixed(1), (outside / Math.max(1, nOut)).toFixed(1));
    assert.ok(inCut / nCut > 1.3 * (outside / Math.max(1, nOut)), `${name}: the cut ${(inCut / nCut).toFixed(1)} m/s against ${(outside / Math.max(1, nOut)).toFixed(1)} round it`);
  }
  tool.dispose();
});

test('held through the wind-up the first swing charges; let go, the sweep: full it deals 3 and staggers, early 2; then the cooldown', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => v(0, 0.8, -57.8), onHit: (_m, _p, _d, info) => hits.push(info) });
  const blade = tool.blade;
  // a tap: the light first swing, no charge
  tick({ KeyF: true }); tick({ KeyF: true }); tick({});
  for (let i = 0; i < 60; i++) { tick({}); assert.ok(!blade.charging, 'a tap never charges'); }
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, BLADE.damage[0]); assert.ok(!hits[0].breaks);
  for (let i = 0; i < 60; i++) tick({});
  // held: charging by CHARGE.after, the clip drawn back to its cocked pose and held there
  let at = null;
  for (let i = 0; i < 80; i++) { tick({ KeyF: true }); if (blade.charging && at === null) at = i * dt; }
  assert.ok(at !== null && at >= CHARGE.after - dt && at <= CHARGE.after + 3 * dt, `charging at ${at?.toFixed(3)} s`);
  assert.ok(blade.charging.full, 'full after CHARGE.full');
  assert.equal(p.swingMove.clip, CHARGE.clip); assert.ok(Math.abs(p.swingMove.t - CHARGE.hold) < 0.03, `held at ${p.swingMove.t.toFixed(3)}`);
  assert.equal(hits.length, 1, 'no cut while it gathers');
  assert.ok(p.combatMotion && p.combatMotion.scale <= CHARGE.move, 'a slow step at most while gathering');
  // let go: the sweep
  let cut = 0, off = 0;
  for (let i = 0; i < 50; i++) { tick({}); if (trailCut(blade)) cut++; if (blade.cutting && !trailCut(blade)) off++; }
  assert.ok(cut >= 8 && off <= 2, `the trail sweeps on the cut's frames (${cut} frames, ${off} cutting without it)`);
  assert.equal(hits.length, 2); assert.equal(hits[1].damage, CHARGE.damage[1]); assert.ok(hits[1].breaks, 'it staggers even an armoured foe');
  assert.ok(blade.cool > 0 || !blade.swinging, 'then the cooldown, as after a third swing');
  for (let i = 0; i < 60; i++) tick({});
  // let go early: not full, 2
  for (let i = 0; i < 20; i++) tick({ KeyF: true });
  assert.ok(blade.charging && !blade.charging.full);
  for (let i = 0; i < 60; i++) tick({});
  assert.equal(hits.length, 3); assert.equal(hits[2].damage, CHARGE.damage[0]);
  // evading out of a charge
  for (let i = 0; i < 40; i++) tick({});
  for (let i = 0; i < 25; i++) tick({ KeyF: true });
  assert.ok(blade.charging);
  tick({ KeyF: true, AltLeft: true });
  assert.ok(!blade.charging && blade.evadeT > 0, 'an evade cancels the charge');
  tool.dispose(); clearTargets();
});

test('the charged cut staggers a heavy foe and one committed to its blow, which a light cut does not', () => {
  const f = new Foe('machine', v()); f.state = 'wind'; f.k = 0.9;
  f.hit('blade', v(0, 0, 1), { damage: 1 }); assert.equal(f.state, 'wind', 'a light cut: shrugged off');
  f.hit('blade', v(0, 0, 1), { damage: 2, combo: 2, breaks: true }); assert.equal(f.state, 'recover', 'the charged cut: it reels');
});

test('in the air a swing is the jump attack: the whole body, held at the top, driven down onto a foe below; one an airtime', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => v(0, 0.6, -56.8), onHit: (_m, _p, _d, info) => hits.push(info) });
  const blade = tool.blade;
  for (let i = 0; i < 3; i++) tick({ Space: true });
  for (let i = 0; i < 12; i++) tick({});
  assert.ok(!p.onGround);
  const z0 = p.pos.z;
  tick({ KeyF: true }); tick({});
  assert.equal(blade.special, AIR); assert.equal(p.swingMove.clip, AIR.clip);
  let legs = 0, top = p.pos.y, landed = null, again = false;
  for (let i = 0; i < 60; i++) {
    tick(i === 6 ? { KeyF: true } : {});
    if (i === 6) again = blade.swingId;
    if (!p.onGround) legs = Math.max(legs, p.animator.legsW);
    if (blade.phase === 'wind') top = Math.max(top, p.pos.y);
    if (p.onGround && landed === null) landed = i;
  }
  assert.ok(legs > 0.9, `the whole body in the air (${legs.toFixed(2)})`);
  assert.ok(landed !== null && landed < 40, `driven down: landed ${landed} frames on`);
  assert.ok(p.pos.z - z0 > 0.5, `carried in toward the foe (${(p.pos.z - z0).toFixed(2)} m)`);
  assert.equal(hits.length, 1, 'the slam lands on the foe below'); assert.equal(hits[0].damage, AIR.damage);
  // a second press in the air started nothing (the same swing ran on), and the cooldown follows
  assert.equal(blade.swingId, again);
  tool.dispose(); clearTargets();
});

test('a swing changing into the charge blends from the pose on screen: no bone jumps in a frame', async () => {
  const { p, tool, tick } = await armed();
  const A = p.animator;
  let prev = null, worst = 0;
  for (let i = 0; i < 90; i++) {
    tick(i < 50 ? { KeyF: true } : {});
    const q = A.bone('upperarm_r').quaternion.clone(), h = A.bone('hand_r').quaternion.clone();
    if (prev) worst = Math.max(worst, q.angleTo(prev[0]), h.angleTo(prev[1]));
    prev = [q, h];
  }
  assert.ok(A.combatBones.length > 20, `the blend holds every joint (${A.combatBones.length})`);
  assert.ok(worst < 0.8, `the largest turn in a frame ${worst.toFixed(2)} rad`);
  tool.dispose();
});

test('a perfect parry opens the riposte: a press within RIPOSTE.window plays slash 4, heavy, staggering; missed, a plain swing', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => v(0, 0.8, -57.8), onHit: (_m, _p, _d, info) => hits.push(info) });
  const blade = tool.blade, foeAt = v(0, 0, -57.8);
  const parry = () => {
    for (let i = 0; i < 40; i++) tick({});
    // (the guard up and the shield opened over the foe's way, inside the parry window)
    let i = 0, r = false;
    while (!r && i++ < 20) { tick({ KeyZ: true }); if (blade.parryLive) r = blade.block(foeAt); }
    assert.equal(r, 'perfect', `parried ${i} frames into the guard`);
  };
  assert.ok(riposteOpen(0) && riposteOpen(RIPOSTE.window - 0.01) && !riposteOpen(RIPOSTE.window) && !riposteOpen(Infinity));
  // in the window, the guard still held: the riposte
  parry();
  for (let i = 0; i < 12; i++) tick({ KeyZ: true });   // (0.2 s on)
  tick({ KeyZ: true, KeyF: true });
  assert.equal(blade.special, RIPOSTE, 'the riposte'); assert.equal(p.swingMove.clip, RIPOSTE.clip);
  let cut = 0;
  // (the chop comes down to his right: turned into it, it lands on the line to the foe)
  let wide = 0;
  for (let i = 0; i < 50; i++) { tick({}); if (blade.cutting) { cut++; wide = Math.max(wide, Math.abs(blade.bladeSegment().b.x - p.pos.x)); } }
  assert.ok(wide < 0.5, `the chop on the foe's line (${wide.toFixed(2)} m off it)`);
  assert.ok(cut >= 4, `it cuts (${cut} frames)`);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, RIPOSTE.damage); assert.ok(RIPOSTE.damage > BLADE.damage[0]);
  assert.ok(hits[0].breaks && hits[0].stagger === RIPOSTE.stagger && hits[0].riposte, 'heavy: it staggers anyone, held reeling');
  // only once a parry: a second press is the combo's own swing again
  for (let i = 0; i < 60; i++) tick({});
  tick({ KeyF: true }); tick({});
  assert.equal(blade.special, null, 'the window spent: a plain swing');
  // the window missed: back to normal
  for (let i = 0; i < 60; i++) tick({});
  parry();
  for (let i = 0; i < Math.ceil(RIPOSTE.window / dt) + 2; i++) tick({ KeyZ: true });
  tick({ KeyZ: true, KeyF: true });
  assert.ok(!blade.swinging, 'late, the guard held: nothing (as before)');
  tick({}); tick({ KeyF: true }); tick({});
  assert.ok(blade.swinging && blade.special === null, 'late: the plain first swing');
  tool.dispose(); clearTargets();
});

test('the riposte staggers a parried foe for RIPOSTE.stagger and doubles on its stun', () => {
  const f = new Foe('shade', v()); f.hp = 99; f.staggered(true); f.stunned = 2;
  const hp = f.hp;
  f.hit('blade', v(0, 0, 1), { damage: RIPOSTE.damage, combo: 2, breaks: true, stagger: RIPOSTE.stagger, riposte: true });
  assert.equal(f.state, 'recover'); assert.ok(f.timer >= RIPOSTE.stagger, `held reeling ${f.timer} s`); assert.equal(f.reel, 'riposted');
  assert.equal(hp - f.hp, RIPOSTE.damage * 2, 'doubled on the parried (stunned) foe');
});

test('a press during an evade is a dash cut as it ends: carried through the foe\'s line, no i-frames of its own, once a cooldown', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => v(0, 0.8, -57.8), onHit: (_m, _p, _d, info) => hits.push(info) });
  const blade = tool.blade;
  assert.ok(dashOpen(0, 0) && dashOpen(DASH.late, 0) && !dashOpen(DASH.late + 0.01, 0) && !dashOpen(0, 0.1));
  for (let i = 0; i < 40; i++) tick({});
  const evadeThen = (pressAt) => {
    tick({ AltLeft: true }); tick({});
    assert.ok(blade.evadeT > 0, 'evading');
    let n = 0;
    while (blade.evadeT > 0 && n++ < 30) tick(n === pressAt ? { KeyF: true } : {});
  };
  evadeThen(3);
  assert.equal(blade.special, DASH, 'the dash cut, as the evade ends'); assert.equal(p.swingMove.clip, DASH.clip);
  const z0 = p.pos.z;
  let iframes = 0;
  for (let i = 0; i < 40; i++) { tick({}); if (blade.iframes()) iframes++; }
  assert.equal(iframes, 0, 'no i-frames of its own');
  assert.ok(p.pos.z - z0 > 1.6 && p.pos.z > -57.8, `carried forward ${(p.pos.z - z0).toFixed(2)} m, past the foe's line (${p.pos.z.toFixed(2)})`);
  assert.ok(Math.abs(p.pos.x) > 0.5 && Math.abs(p.pos.x) < 1.6, `beside it, not through its body (${p.pos.x.toFixed(2)} m)`);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, DASH.damage);
  // back to back: within the cooldown the press out of an evade is a plain swing
  for (let i = 0; i < 6; i++) tick({});
  assert.ok(blade.dashCool > 0);
  evadeThen(12);
  assert.ok(blade.special !== DASH, 'the cooldown: no second dash cut');
  for (let i = 0; i < Math.ceil(DASH.cooldown / dt); i++) tick({});
  // pressed too late after the evade: a plain swing
  tick({ AltLeft: true }); tick({});
  while (blade.evadeT > 0) tick({});
  for (let i = 0; i < Math.ceil(DASH.late / dt) + 2; i++) tick({});
  tick({ KeyF: true }); tick({});
  assert.ok(blade.swinging && blade.special !== DASH, 'late: the plain swing');
  for (let i = 0; i < 60; i++) tick({});
  // cooled down, right at the evade's end: the dash cut again
  evadeThen(-1); tick({ KeyF: true });
  assert.equal(blade.special, DASH, 'pressed right at the end');
  tool.dispose(); clearTargets();
});

test('the combo\'s third swing is a heavy blow on the ground: a longer wind-up, both feet planted (the leap it was is not)', async () => {
  const { p, tick } = await armed();
  const S = SWINGS[2];
  assert.ok(S.heavy && S.wind > SWINGS[0].wind && S.wind > SWINGS[1].wind, 'the longest wind-up of the three');
  assert.equal(BLADE.damage[2], 3, 'its damage as before');
  const feet = [];
  p.object.traverse((o) => { if (/^(foot|ball)_[lr]$/i.test(o.name)) feet.push(o); });
  assert.ok(feet.length >= 2, `the feet's bones (${feet.map((o) => o.name)})`);
  const w = new THREE.Vector3();
  /** The highest both feet are off the ground together (m) through a clip's range. */
  const lift = (clip, from, to) => {
    let top = 0, floor = Infinity;
    for (let t = from; t <= to; t += 1 / 30) {
      for (let k = 0; k < 3; k++) tick({}, { clip, t, w: 1, full: true, id: 'probe' });
      p.object.updateMatrixWorld(true);
      const ys = { l: Infinity, r: Infinity };
      for (const o of feet) { const y = o.getWorldPosition(w).y - p.pos.y, s = /_l$/i.test(o.name) ? 'l' : 'r'; ys[s] = Math.min(ys[s], y); }
      floor = Math.min(floor, ys.l, ys.r);
      top = Math.max(top, Math.min(ys.l, ys.r));
    }
    return top - floor;
  };
  const planted = lift(S.clip, S.from, S.to), leap = lift('mixamo_ss_attack_1', 0.55, 1.7);
  assert.ok(planted < 0.2, `the third: both feet up at most ${planted.toFixed(2)} m`);
  assert.ok(leap > 0.5, `(the measure sees the old leap: ${leap.toFixed(2)} m)`);
});
