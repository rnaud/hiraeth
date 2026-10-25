// The motion QC (.claude/skills/motion-qc): its judgement (scripts/motion-qc/lib.mjs) on made-up tracks, and the
// traveller's own runs on the gait harness's course held to its limits where they are green today (scripts/motion-qc/
// run.mjs). Before the QC, the default walk popped a knee straight and bent again at every lift-off (25 rad/s), dropped a
// foot 9 cm in a frame at every touchdown at a jog, and a pivot that flickered off for a frame planted a foot half a
// metre off (docs/systems/animation.md, "The motion QC").
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, steps, pops, jolts, latency, pivots, LIMITS, BONES, JOINTS } from '../scripts/motion-qc/lib.mjs';
import { runScenario } from '../scripts/motion-qc/runner.mjs';
import { COURSE, WORLDS_FLAT, unevenFrames } from '../scripts/motion-qc/scenarios.mjs';

const meta = { ballRest: 0.04, ankleRest: 0.08 };
/**
 * A made-up walk along +z at `v` m/s, 60 frames a second: feet planted in turn (each 0.4 s down, 0.4 s swinging over
 * 1.6 v m), the bones turning smoothly, the joints moving with the body. edit(s, i) changes a frame.
 */
function walk(n = 300, { v = 1.5, edit = () => {}, stick = [0, 1] } = {}) {
  const S = [];
  for (let i = 0; i < n; i++) {
    const t = i / 60, z = v * t, feet = {};
    for (const [f, off] of [['l', 0], ['r', 0.4]]) {
      const ts = Math.floor((t + off) / 0.8 + 1e-9) * 0.8 - off, ph = (t - ts) / 0.8;
      // (down for the first half of each cycle where the body is half way through it, then a swing to the next place)
      const down = ph < 0.5, k = down ? 0 : (ph - 0.5) / 0.5;
      const fz = v * (ts + 0.2) + (down ? 0 : 0.8 * v * 0.5 * (1 - Math.cos(Math.PI * k)));
      const lift = down ? 0 : 0.12 * Math.sin(Math.PI * k);
      const x = f === 'l' ? 0.1 : -0.1;
      feet[f] = { ball: [x, meta.ballRest + lift, fz + 0.1], ankle: [x, meta.ankleRest + lift, fz], gBall: 0, gAnkle: 0, held: down && ph > 0.05 && ph < 0.45 };
    }
    const w = BONES.map((_, b) => [Math.sin(t * 6 + b) * 2, 0, Math.cos(t * 6 + b)]);
    const joints = JOINTS.map((_, j) => [Math.sin(t * 5 + j) * 0.2, 0.5 + j * 0.05, Math.cos(t * 5 + j) * 0.2]);
    const s = { t, dt: 1 / 60, tag: 'walk', stick, run: false, pos: [0, 0, z], vel: [0, 0, v], heading: 0, onGround: true, feet, joints, w, chest: 0, mm: { w: 0, jumps: 0, clip: null }, move: null, gait: 'walk', pivot: false, us: { match: 0, anim: 50 } };
    edit(s, i);
    S.push(s);
  }
  return S;
}

test('the judgement: a planted walk is green; a slide, a pop, a jolt at a boundary are each caught', () => {
  const ok = analyse(walk(), meta);
  assert.ok(ok.green, `a planted walk is green (${ok.fails.join(', ')})`);
  assert.ok(ok.measures.steps >= 8, `its steps are found (${ok.measures.steps})`);
  assert.ok(ok.measures.slideMax < 0.03, `and none slides more than its lift-off and touchdown (${ok.measures.slideMax.toFixed(3)} m)`);
  // a foot dragged 15 cm over one of its steps
  const slid = analyse(walk(300, { edit: (s, i) => { const f = s.feet.l; if (f.ball[1] < meta.ballRest + 0.01 && i >= 100 && i < 140) f.ball[2] += Math.min(i - 100, 17) * 0.009; } }), meta);
  assert.ok(slid.fails.includes('slideMax'), `a 15 cm slide is red (${slid.measures.slideMax.toFixed(3)} m)`);
  assert.ok(slid.worst.some((w) => /slid/.test(w.what)), 'and on the contact sheet');
  // a calf flicked 0.5 rad in one frame
  const popped = pops(walk(300, { edit: (s, i) => { if (i === 150) s.w[BONES.indexOf('calf_l')] = [30, 0, 0]; } }));
  assert.equal(popped.length, 1, 'one pop');
  assert.equal(popped[0].bone, 'calf_l');
  // a hand jumping 6 cm for a frame as the matcher jumps
  const S = walk(300, { edit: (s, i) => { if (i === 200) { s.joints[JOINTS.indexOf('hand_r')][0] += 0.06; s.mm = { w: 1, jumps: 1, clip: 'x' }; } if (i > 200) s.mm = { w: 1, jumps: 1, clip: 'x' }; } });
  const J = jolts(S);
  assert.ok(J.events.some((e) => e.joint === 'hand_r' && e.size > 0.04), 'the jolt is found');
  const r = analyse(S, meta);
  assert.ok(r.fails.includes('boundary'), `and judged at the matcher's jump (${r.measures.boundaryMax.toFixed(3)} m)`);
});

test('the judgement: a foot skimming the ground mid-swing is not a planted step', () => {
  const S = walk(300, { edit: (s) => { s.feet.r.ball[1] = meta.ballRest + 0.01; s.feet.r.ball[2] = 3 * s.t; s.feet.r.held = false; } });
  const st = steps(S, meta);
  assert.ok(st.skims.length >= 1, 'the skim is counted as one');
  assert.ok(st.steps.every((x) => x.side === 'l' || x.slowest < LIMITS.still), 'and not as a slide');
});

test('the judgement: the answer to the stick, and a pivot with crossed feet', () => {
  // standing 1 s, then the stick: a foot lifts 0.1 s later
  const S = walk(240, { edit: (s, i) => {
    if (i < 60) { s.stick = null; s.vel = [0, 0, 0]; s.feet.l.ball[1] = s.feet.r.ball[1] = meta.ballRest; s.feet.l.held = s.feet.r.held = true; }
    else if (i < 66) { s.feet.l.ball[1] = s.feet.r.ball[1] = meta.ballRest; }
  } });
  const L = latency(S, meta);
  assert.equal(L.starts.length, 1);
  assert.ok(Math.abs(L.starts[0].s - 0.1) < 0.02, `a foot off the ground 0.1 s after the stick (${L.starts[0].s})`);
  // a pivot: the feet crossed for most of it
  const P = walk(120, { v: 0, edit: (s, i) => { s.pivot = i >= 30 && i < 50; if (i >= 30) { s.feet.l.ankle[0] = -0.1; s.feet.r.ankle[0] = 0.1; } s.feet.l.held = true; } });
  const V = pivots(P);
  assert.equal(V.length, 1);
  assert.ok(V[0].crossed > 0.5, `crossed (${V[0].crossed.toFixed(2)})`);
});

// (the standing pivots, read by the two tests below: run once, the same frames for both; a run is the same whatever ran
// before it in the file, measured)
let pivotsRun = null;
const pivotsStanding = () => (pivotsRun ??= runScenario(COURSE['pivots standing: 90° each way, 180°'], 'moves'));

test('the traveller on the course: the runs green today stay green (the default: loops with captured moves)', { timeout: 120000 }, async () => {
  for (const name of ['walk, 90° turn, stop', 'jog, 45° and back, stop', 'curve: the stick round a circle at a jog', 'stand still 6 s', 'turn round on the spot']) {
    const { r } = await runScenario(COURSE[name], 'moves');
    assert.ok(r.green, `${name}: green (${r.fails.join(', ')}; slide p95 ${(r.measures.slideP95 * 100).toFixed(1)} cm, pops ${r.measures.popsPerMin}/min, jolts ${r.measures.joltsPerMin}/min)`);
  }
  // the worst before: the walk's knee and foot pops at every step, and the pivot's 20 cm jolt
  const g = (await runScenario(COURSE['gaits: walk → jog → sprint → jog → walk → stop'], 'moves')).r.measures;
  // (its pops, 3 a minute at most on v1, 7 on B3 before issue #47's knee: the B3 test below)
  assert.ok(g.joltsPerMin <= 9, `every gait: jolts ${g.joltsPerMin}/min (13 before the sprint was looked at)`);
  const p = (await pivotsStanding()).r.measures;
  assert.ok(p.joltMax < 0.1, `pivots: the worst jolt ${(p.joltMax * 100).toFixed(1)} cm (20 before)`);
  assert.ok(p.crossed <= 0.1, `pivots: the feet crossed ${Math.round(p.crossed * 100)} % of the frames (17 % before a step kept to its own side)`);
  // the last step of a stop from a run slid 29 cm; the stairs threw a swinging foot 18 cm in a frame
  const s = (await runScenario(COURSE['starts and stops, walk and run'], 'moves')).r.measures;
  assert.ok(s.slideMax < 0.2, `starts and stops: the worst step slides ${(s.slideMax * 100).toFixed(1)} cm (29 before)`);
  const st = (await runScenario(COURSE['stairs up, stand, down'], 'moves')).r.measures;
  assert.ok(st.joltMax < 0.16 && st.popsPerMin <= 10, `stairs: the worst jolt ${(st.joltMax * 100).toFixed(1)} cm (18 before), pops ${st.popsPerMin}/min (18, then 12 before a foot rose ahead of a step up)`);
});

// (on the B3 body, the game's since 2026-10-13: the runs above were measured on the coral-shirt v1 until 2026-10-14, when
// the QC moved to him (scripts/motion-qc/runner.mjs body). Four that were green on v1 were not on him: the slow walk popped 5
// a minute, up the ramp 6 (the limit 3), every gait 7, and the standing pivots' worst jolt was 5.2 cm. Every pop a calf
// (his knee), 14-19 rad/s at a step's lift-off or touchdown, and one of 45 at the gaits' stop. Issue #47, 2026-10-15: the
// soft IK's zone 2 -> 3.5 % of the leg (FEET.soft: B3's knee reached straight within v1's 2 %); a foot planted and let go
// in the same frame (out of reach as it touched down, a stop) goes on easing off its old hold instead of thrown back onto
// it for that frame (FEET.relockKeep, the stop's 38-45 rad/s); a foot only plants early on its way down, not as its
// contact falls at a lift-off (the start's 19 rad/s); standing stays standing till the gait is 0.05 over FEET.restGait
// (FEET.restKeep: a pivot's settling step was cut short for one frame as its gait passed 0.25, set down the next, 25 rad/s).)
test('on B3, the slow walk, the ramp, every gait and the standing pivots as they were on v1 (issue #47)', { timeout: 120000 }, async () => {
  const g = (await runScenario(COURSE['gaits: walk → jog → sprint → jog → walk → stop'], 'moves')).r.measures;
  assert.ok(g.popsPerMin <= 3, `every gait: pops ${g.popsPerMin}/min (7 before issue #47's knee on B3; 34, then 14 before the sprint was looked at, 10 before its push-off)`);
  assert.ok(g.boundaryMax < 0.03, `every gait: the worst boundary ${(g.boundaryMax * 100).toFixed(1)} cm (7.6 before the stop's foot was eased off its hold)`);
  // standing pivots: the held foot turned on its ball at once, a settling step cut short dropped 6 cm, the facing spun up in a frame
  const p = (await pivotsStanding()).r.measures;
  assert.ok(p.popsPerMin <= LIMITS.popsPerMin && p.joltMax < 0.03 && p.boundaryMax < LIMITS.boundary, `pivots standing: pops ${p.popsPerMin}/min (3 before), the worst jolt ${(p.joltMax * 100).toFixed(1)} cm (5.2 before), boundary ${(p.boundaryMax * 100).toFixed(1)} cm (3.7)`);
  assert.ok(p.slideP95 < LIMITS.slideP95 && p.held < 0.01, `pivots standing: slide p95 ${(p.slideP95 * 100).toFixed(1)} cm (6.0 before), held ${(p.held * 100).toFixed(1)} cm (1.3)`);

  const { r } = await runScenario(COURSE['slow walk (half stick), stop'], 'moves');
  assert.ok(r.green, `slow walk (half stick), stop: green (${r.fails.join(', ')}; slide p95 ${(r.measures.slideP95 * 100).toFixed(1)} cm, pops ${r.measures.popsPerMin}/min (5 before), jolts ${r.measures.joltsPerMin}/min)`);
  // up the ramp a landing foot was planted from the clip's height, under the floor it rode: it dropped 10-13 cm in a frame
  const ramp = await runScenario(COURSE['up the ramp, stand'], 'moves');
  assert.ok(ramp.r.green, `up the ramp: green (${ramp.r.fails.join(', ')}; pops ${ramp.r.measures.popsPerMin}/min (6 before on B3, 9 on v1), jolts ${ramp.r.measures.joltsPerMin}/min)`);
});

// (issue #47's second round on B3, 2026-10-15. The sprint's steps slid: a landing foot was planted where the clip's foot
// was that frame, 5-6 cm on from where it was drawn, and the landing's hold-back stopped at 14 cm of the 22 its foot
// travels at a sprint (FEET.plantShown, landBack 0.14 -> 0.2); a foot let go out of reach as a run set off was dragged
// along the floor (FEET.releaseMin); a stop's last step set down out of reach was let go in the frame it landed
// (FEET.reachGrace). A pivot's step round went straight across the held foot (FEET.stepPathGap). Up and down a flight at
// a run the drawn body lagged its climb by its speed / 12, 18 cm at a jog, 38 at a sprint (src/locomotion.js STEP_LAG.climb),
// and a swinging foot passing over a stair's edge set off down it at 4-5 m/s in a frame (FEET.rideSpring). The recorder
// now reads the joints against the drawn body, not the controller's place, which steps a riser in a frame (and on
// the stairs every joint "jolted" by half of it, 9 cm); the stairs' stands are longer than a stop's limit (scenarios.mjs).)
test('the sprint\'s steps, the 180° turns, the standing pivots\' feet and the stairs at a run (issue #47, second round)', { timeout: 180000 }, async () => {
  const g = (await runScenario(COURSE['gaits: walk → jog → sprint → jog → walk → stop'], 'moves')).r;
  assert.ok(g.green, `every gait: green (${g.fails.join(', ')}; slide p95 ${(g.measures.slideP95 * 100).toFixed(1)} cm (9.7 before), max ${(g.measures.slideMax * 100).toFixed(1)} (31.3), jolts ${g.measures.joltsPerMin}/min (5))`);
  const p = (await pivotsStanding()).r;
  assert.ok(p.green && p.measures.crossed <= LIMITS.crossed, `pivots standing: green, the feet crossed ${Math.round(p.measures.crossed * 100)} % of the frames (9 % before; ${p.fails.join(', ')})`);
  const s = (await runScenario(COURSE['starts and stops, walk and run'], 'moves')).r.measures;
  assert.ok(s.slideP95 < LIMITS.slideP95 && s.joltsPerMin <= LIMITS.joltsPerMin && s.boundaryMax < LIMITS.boundary, `starts and stops: slide p95 ${(s.slideP95 * 100).toFixed(1)} cm (11.3 before), jolts ${s.joltsPerMin}/min (6), boundary ${(s.boundaryMax * 100).toFixed(1)} cm (3.3)`);
  const t = (await runScenario(COURSE['walk → run → 180° turn → stop'], 'moves')).r.measures;
  assert.ok(t.slideP95 < LIMITS.slideP95 && t.joltsPerMin <= 5, `walk → run → 180°: slide p95 ${(t.slideP95 * 100).toFixed(1)} cm (10.1 before), jolts ${t.joltsPerMin}/min (8)`);
  const v = (await runScenario(COURSE['pivot 180° at a jog, and at a sprint'], 'moves')).r.measures;
  assert.ok(v.slideP95 < LIMITS.slideP95 && v.slideMax < LIMITS.slideMax && v.joltsPerMin <= 5, `the 180° pivots: slide p95 ${(v.slideP95 * 100).toFixed(1)} cm (9.4 before), max ${(v.slideMax * 100).toFixed(1)} (20.9), jolts ${v.joltsPerMin}/min (13)`);
  const o = (await runScenario(COURSE[Object.keys(COURSE).find((n) => n.startsWith('setting off the other way'))], 'moves')).r.measures;
  assert.ok(o.slideP95 < LIMITS.slideP95, `setting off the other way: slide p95 ${(o.slideP95 * 100).toFixed(1)} cm (10.3 before)`);
  const st = (await runScenario(COURSE['stairs up, stand, down'], 'moves')).r.measures;
  assert.ok(st.stop !== null && st.stop <= LIMITS.stop && st.joltMax < 0.08 && st.joltsPerMin <= 6 && st.boundaryMax < 0.05, `the stairs: every stop settles (${st.stop?.toFixed(2)} s, "never" before), the worst jolt ${(st.joltMax * 100).toFixed(1)} cm (12.6), jolts ${st.joltsPerMin}/min (18, 9 of them the recorder\'s), boundary ${(st.boundaryMax * 100).toFixed(1)} cm (10.1)`);
  const sr = (await runScenario(COURSE['stairs at a run'], 'moves')).r.measures;
  assert.ok(sr.sink <= LIMITS.sink && sr.joltMax < 0.1 && sr.popsPerMin <= 6, `the stairs at a run: the soles sink ${(sr.sink * 100).toFixed(1)} cm (4.7 before), the worst jolt ${(sr.joltMax * 100).toFixed(1)} cm (30.6), pops ${sr.popsPerMin}/min (9)`);
});

test('a sprint reversed: no forearm turned over in a frame (src/humanoid.js shareWristRoll, issue #47)', { timeout: 60000 }, async () => {
  // (the hand's roll on the forearm passing a half turn flipped from +π to -π, and the forearm took half of it the other way:
  // 180-230 rad/s in a frame and back a few frames on, the running 180° and the sprint reversed, in node and in the game)
  const arms = ['lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r'];
  for (const name of ['pivot 180° at a jog, and at a sprint', 'walk → run → 180° turn → stop']) {
    const { r } = await runScenario(COURSE[name], 'moves');
    const worst = Math.max(0, ...r.events.pops.filter((x) => arms.includes(x.bone)).map((x) => x.size));
    assert.ok(worst < 60, `${name}: the worst forearm or hand pop ${worst.toFixed(0)} rad/s (186-233 before)`);
  }
});

// (issue #47's third round on B3, 2026-10-15. The 180° turns at a run: the speed passing through nothing for a frame as
// the body reversed stood him up for that frame (the idle took 15 % of the blend, every swinging foot dropped 7-10 cm:
// Animator GAIT_HOLD, the stick held); a foot still easing off an old hold, in its release's arc 8-12 cm over the clip's,
// was planted early and thrown onto the ground with its weight on (FEET.earlyShown, FEET.dropShown: the calf 38 rad/s);
// the facing's speed-up came in at once at a run (FACE.jerk); the arm's clearance, read from the front, flipped as the
// arm swung up behind (src/characters/tripo-walk.js ARM_HANG: the forearm 60-80 rad/s). A landing foot is eased off its
// speed to nothing at touchdown (FEET.landEase: held back toward where it was, it kept a third of its speed in the first
// frame) and a release's toe-off lets the hold go at its end (FEET.toeOffTail: the last 3 % of a sprint's release drew the
// foot 13 cm back, and it jumped on as it touched down). A pivot's step round falls no more than FEET.footLag behind its
// turn (set to it past 1.5 rad: the foot 85-93 rad/s), and lands only where the gait has it down (FEET.landPlanted).
// Down a flight, a foot set on the step below before the body comes down isn't let go out of reach in the frame it
// lands (FEET.reachGrace's third: the calf 26-31 rad/s); a foot rises toward the next stair from rest (FEET.rideAheadSpring).)
test('the 180° turns at a run, starts and stops, the stairs at a run\'s boundary, setting off the other way (issue #47, third round)', { timeout: 180000 }, async () => {
  const v = (await runScenario(COURSE['pivot 180° at a jog, and at a sprint'], 'moves')).r;
  assert.ok(v.green, `the 180° pivots at a jog and a sprint: green (${v.fails.join(', ')}; boundary ${(v.measures.boundaryMax * 100).toFixed(1)} cm (5.6 before), pops ${v.measures.popsPerMin}/min (5), jolts ${v.measures.joltsPerMin}/min (4))`);
  const pv = Math.max(0, ...v.events.pops.filter((x) => x.tag === 'pivot-sprint').map((x) => x.size));
  assert.ok(pv < 25, `the sprint reversed: the worst pop ${pv.toFixed(0)} rad/s (a calf 38 as the running turn came in)`);
  const s = (await runScenario(COURSE['starts and stops, walk and run'], 'moves')).r;
  assert.ok(s.green, `starts and stops: green (${s.fails.join(', ')}; pops ${s.measures.popsPerMin}/min (4 before), slide max ${(s.measures.slideMax * 100).toFixed(1)} cm (12.0))`);
  const t = (await runScenario(COURSE['walk → run → 180° turn → stop'], 'moves')).r;
  const arm = Math.max(0, ...t.events.pops.filter((x) => /arm|hand/.test(x.bone)).map((x) => x.size));
  assert.ok(t.measures.popsPerMin <= 1 && arm < 14 && t.measures.slideP95 < 0.045, `walk → run → 180°: pops ${t.measures.popsPerMin}/min (2 before), the worst arm pop ${arm.toFixed(0)} rad/s (26-81), slide p95 ${(t.measures.slideP95 * 100).toFixed(1)} cm (5.4)`);
  const g = (await runScenario(COURSE['gaits: walk → jog → sprint → jog → walk → stop'], 'moves')).r.measures;
  assert.ok(g.popsPerMin === 0 && g.slideP95 < 0.045, `every gait: pops ${g.popsPerMin}/min (2 before), slide p95 ${(g.slideP95 * 100).toFixed(1)} cm (5.2)`);
  const o = (await runScenario(COURSE[Object.keys(COURSE).find((n) => n.startsWith('setting off the other way'))], 'moves')).r;
  const foot = Math.max(0, ...o.events.pops.filter((x) => /^foot_/.test(x.bone)).map((x) => x.size));
  assert.ok(o.measures.popsPerMin <= LIMITS.popsPerMin && o.measures.joltsPerMin <= LIMITS.joltsPerMin && foot < 30, `setting off the other way: pops ${o.measures.popsPerMin}/min (5 before), jolts ${o.measures.joltsPerMin}/min (4), the worst foot pop ${foot.toFixed(0)} rad/s (85)`);
  const sr = (await runScenario(COURSE['stairs at a run'], 'moves')).r.measures;
  assert.ok(sr.boundaryMax < LIMITS.boundary && sr.slideP95 < 0.045, `the stairs at a run: boundary ${(sr.boundaryMax * 100).toFixed(1)} cm (5.9 before), slide p95 ${(sr.slideP95 * 100).toFixed(1)} cm (5.4)`);
  const st = (await runScenario(COURSE['stairs up, stand, down'], 'moves')).r.measures;
  assert.ok(st.joltsPerMin <= LIMITS.joltsPerMin && st.popsPerMin <= 6, `the stairs: jolts ${st.joltsPerMin}/min (5 before), pops ${st.popsPerMin}/min (7)`);
});

test('the facing\'s speed-up comes in over a few frames at a run, at once from standing (src/player.js FACE.jerk, issue #47)', async () => {
  const { faceStep, FACE } = await import('../src/player.js');
  const dt = 1 / 60, run = {}, stand = {};
  const a = faceStep(run, 0.5, dt, 0, 0, true), b = faceStep(stand, 0.5, dt, 0, 0, false);
  assert.ok(a <= FACE.jerk * dt * dt * dt + 1e-9, `running, the first frame turns ${a.toFixed(4)} rad`);
  assert.ok(Math.abs(b - FACE.accel * dt * dt) < 1e-9, 'from standing, at FACE.accel from the first frame (as before)');
  let was = 0, acc = 0;
  for (let i = 0; i < 20; i++) { faceStep(run, 0.5, dt, was, acc, true); acc = run._faceAcc; was = run._faceRate; }
  assert.ok(Math.abs(acc - FACE.accel) < 1e-6 || was >= Math.min(0.5 / dt, FACE.runMax) - 1e-6, 'and running it reaches FACE.accel after a few frames (or FACE.runMax)');
});

test('the stick held through a reversal keeps the gait\'s blend for the frame the speed passes through nothing (Animator GAIT_HOLD, issue #47)', { timeout: 60000 }, async () => {
  const { GAIT_HOLD } = await import('../src/animator.js');
  let idle = 0;
  await runScenario(COURSE['walk → run → 180° turn → stop'], 'moves', { onFrame: (p, i, smp) => { if (smp.tag === 'turn180' && p.animator.gaitW > GAIT_HOLD) idle = Math.max(idle, p.animator.w.idle); } });
  assert.ok(idle < 0.02, `the idle's share at the reversal ${idle.toFixed(2)} (0.15 in a frame before)`);
});

// (issue #47's fourth round on B3, 2026-10-15. The running 180° turn came round at 28 rad/s and its swinging foot, carried
// round the body at 11-13 m/s, stopped in the three frames before it touched down: the facing turns no faster than
// FACE.runMax running (src/player.js), and a landing foot is held back by up to 30 cm, not 20 (FEET.landBack). A pivot's step on its way when the pivot ended (a turn on the spot into a walk or
// a jog: setting off the other way, down the ramp) was cut where it was, the foot stopped dead from 1-2 m/s: it finishes
// first (FEET.pivotFinish). A captured move's weight is laid on along a smoothstep of its ramp (MOVES.smooth: the arm
// 3.5 cm off its curve as a turn into a jog at 90° ended). Up a flight, a foot let go with the clip's a riser over it
// eases off toward an eased goal (FEET.releaseLag: it rose 11 cm a frame, the calf 35 rad/s), and down one a free foot
// rides down toward the floor ahead too (FEET.rideDownAhead: it met the step below 9 cm up, the calf 24 rad/s).)
test('the running 180° turn, setting off the other way, down the ramp and the stairs (issue #47, fourth round)', { timeout: 120000 }, async () => {
  const t = (await runScenario(COURSE['walk → run → 180° turn → stop'], 'moves')).r;
  assert.ok(t.green && t.measures.turn <= LIMITS.turn, `walk → run → 180°: green (${t.fails.join(', ')}; boundary ${(t.measures.boundaryMax * 100).toFixed(1)} cm (4.0 before), the turn ${t.measures.turn?.toFixed(2)} s)`);
  const o = (await runScenario(COURSE[Object.keys(COURSE).find((n) => n.startsWith('setting off the other way'))], 'moves')).r;
  assert.ok(o.green, `setting off the other way: green (${o.fails.join(', ')}; boundary ${(o.measures.boundaryMax * 100).toFixed(1)} cm (3.5 before), jolts ${o.measures.joltsPerMin}/min (2))`);
  const d = (await runScenario(COURSE['down the ramp, stop on it'], 'moves')).r;
  assert.ok(d.green, `down the ramp: green (${d.fails.join(', ')}; boundary ${(d.measures.boundaryMax * 100).toFixed(1)} cm (3.2 before))`);
  const st = (await runScenario(COURSE['stairs up, stand, down'], 'moves')).r;
  assert.ok(st.green, `the stairs: green (${st.fails.join(', ')}; pops ${st.measures.popsPerMin}/min (5 before), boundary ${(st.measures.boundaryMax * 100).toFixed(1)} cm (3.9))`);
});

test('running, the facing turns no faster than FACE.runMax; from standing as before (src/player.js, issue #47)', async () => {
  const { faceStep, FACE } = await import('../src/player.js');
  const dt = 1 / 60, run = {}, stand = {};
  let was = 0, acc = 0, top = 0;
  for (let i = 0; i < 30; i++) { faceStep(run, 3, dt, was, acc, true); was = run._faceRate; acc = run._faceAcc; top = Math.max(top, Math.abs(was)); }
  assert.ok(top <= FACE.runMax + 1e-9, `running, the fastest turn ${top.toFixed(1)} rad/s (28 before)`);
  was = 0;
  for (let i = 0; i < 30; i++) { faceStep(stand, 3, dt, was, 0, false); was = stand._faceRate; }
  assert.ok(was > FACE.runMax, 'standing (a pivot), as fast as before');
});

// (issue #47's fifth round on B3, 2026-10-16: the last red, the stairs at a run, 4 pops and 6 jolts a minute (a 9.1 cm
// jolt). A riser passed under him every two or three frames, and the drawn body eased after each one (StepLag) climbed 6 cm
// one frame and 10 the next by turns, then stopped dead at the landing from 4.6 m/s up; the sprint's kick-back, lifted over
// the floor ahead on top of its own height, came within 11-18 cm of the hip. Now the drawn body rides the stairs' own line,
// read ahead (src/locomotion.js StairLine); a free foot the clip lifts well clear rises over a higher floor only by what it
// lacks (FEET.rideOver); a foot let go while still coming down onto its hold goes on coming down (FEET.dropKeep: zeroed, it
// dropped 8 cm in a frame on the top stair); and on a flight at a run the legs' soft zone widens (FEET.softFlight: down one
// the landing leg was 95 % straight, and bent 8 cm in the frame it landed).)
test('the stairs at a run: green, the drawn body on the stairs\' line, the kick-back clear of the hip (issue #47, fifth round)', { timeout: 120000 }, async () => {
  const H = [], near = [];
  const { r } = await runScenario(COURSE['stairs at a run'], 'moves', { onFrame: (p) => {
    H.push(p.object.position.y);
    if (p.pos.z > 30 && p.pos.z < 38.1) {
      const B = p.humanoid.b, v = (n) => B[n].getWorldPosition(p.pos.clone());
      near.push(Math.min(v('thigh_l').distanceTo(v('foot_l')), v('thigh_r').distanceTo(v('foot_r'))));
    }
  } });
  assert.ok(r.green, `stairs at a run: green (${r.fails.join(', ')}; pops ${r.measures.popsPerMin}/min (4 before), jolts ${r.measures.joltsPerMin}/min (6), the worst jolt ${(r.measures.joltMax * 100).toFixed(1)} cm (9.1))`);
  // (the drawn body's climb frame to frame: up the flight 6 and 10 cm by turns before, and 7.7 cm a frame to 2 at the landing)
  let jerk = 0;
  for (let i = 2; i < H.length; i++) jerk = Math.max(jerk, Math.abs(H[i] - 2 * H[i - 1] + H[i - 2]));
  assert.ok(jerk < 0.035, `the drawn body's climb changes by at most ${(jerk * 100).toFixed(1)} cm a frame from one frame to the next (5.5 before)`);
  const closest = Math.min(...near);
  assert.ok(closest > 0.25, `a foot comes no nearer its hip than ${(closest * 100).toFixed(0)} cm on the stairs (11 before)`);
});

// (issue #47's sixth round, 2026-10-16: the game's reds. In headless Chrome a frame is 15-19 ms, not 16.7: the jolts' cubic
// through evenly spaced frames read a smooth swing at a run, sampled unevenly, as 2-4 cm off its curve (the cubic is now at
// the frames' own times, each pose at its frame's end), and the worlds' course on flat ground in node at such frames plays
// what the game showed: the pivot into a jog at 90° popped the calf 22-29 rad/s at every seed, its held foot let go as the
// jog was about to set it down and planted again two frames on (FEET.lateRelease); a sprint reversed threw a foot 8 cm on
// and 16 back in the frame its speed passed through nothing (the warp held, src/locomotion.js WARP_HOLD) and swung the knee
// across as its foot, held through the half turn, was let go (FEET.ballTurn).)
test('the judgement: a smooth swing at uneven frames is no jolt (the cubic at the frames\' own times)', () => {
  let t = 0;
  const S = walk(300, { v: 6, edit: (s, i) => {
    const dt = (1 / 60) * (0.88 + 0.24 * ((i * 7919) % 101) / 100);
    s.t = t; s.dt = dt; t += dt;
    const te = s.t + dt;   // (the pose at the frame's end)
    s.joints = JOINTS.map((_, j) => [Math.sin(te * 9 + j) * 0.4, 0.5 + j * 0.05, Math.cos(te * 9 + j) * 0.4]);
  } });
  const J = jolts(S);
  assert.equal(J.events.length, 0, `no jolts (${J.events.map((e) => (e.size * 100).toFixed(1)).join(', ')} cm)`);
});

test('the worlds\' course at the game\'s uneven frames: the pivot into a jog at 90° and the sprint reversed (issue #47, sixth round)', { timeout: 180000 }, async () => {
  let red = 0;
  for (const seed of [2, 3, 5, 6]) {
    const { r } = await runScenario(WORLDS_FLAT, 'moves', { frames: unevenFrames(seed) });
    const jog2 = r.events.pops.filter((e) => e.tag === 'jog2'), b = Math.max(0, ...r.events.boundaries.filter((e) => e.tag === 'jog2').map((e) => e.size));
    assert.ok(jog2.every((e) => e.size < 18), `seed ${seed}: the pivot into a jog at 90°: pops ${jog2.map((e) => e.size.toFixed(0)).join(', ')} rad/s (22-29 before)`);
    assert.ok(b < LIMITS.boundary, `seed ${seed}: the pivot into a jog at 90°: its blend ${(b * 100).toFixed(1)} cm (5.4-6.7 before)`);
    const rev = Math.max(0, ...r.events.jolts.filter((e) => e.tag === 'pivot-sprint').map((e) => e.size));
    assert.ok(rev < 0.06, `seed ${seed}: the sprint reversed: the worst jolt ${(rev * 100).toFixed(1)} cm`);
    if (!r.green) red++;
  }
  assert.ok(red <= 1, `${red} of 4 seeds red (all 4 before)`);
});

test('gaitFeet keeps the stride\'s warp through a frame of no sweep while the gait holds the pose (src/locomotion.js WARP_HOLD)', async () => {
  const { gaitFeet } = await import('../src/locomotion.js');
  const A = { contact: { l: 0, r: 1 }, toContact: { l: 0.2, r: 0 }, gaitW: 1, footSpeed: 10, mmW: 0, w: {} };
  const o = gaitFeet(A, 7, {});
  assert.ok(Math.abs(o.warp - 0.7) < 1e-9, `warp ${o.warp}`);
  A.footSpeed = 0;
  assert.ok(Math.abs(gaitFeet(A, 0.01, o).warp - 0.7) < 1e-9, 'the warp kept for the frame the sweep is nothing');
  A.gaitW = 0.1;
  assert.equal(gaitFeet(A, 0.01, o).warp, 1, 'standing: no warp');
});

test('StairLine: an even flight read ahead is a smooth line through it, continuous as each riser is stepped (src/locomotion.js, issue #47)', async () => {
  const THREE = await import('three');
  const { StairLine, STAIR_LINE } = await import('../src/locomotion.js');
  // (a floor of 18 cm risers every 32 cm from z = 1, eight of them: the physics' heightAbove, read straight down)
  const floor = (z) => 0.18 * Math.max(0, Math.min(8, Math.floor((z - 1) / 0.32) + 1));
  const physics = { heightAbove: (p) => p.y - floor(p.z) };
  const line = new StairLine(), up = new THREE.Vector3(0, 1, 0), vel = new THREE.Vector3(0, 0, 8), dt = 1 / 60;
  const drawn = [];
  for (let z = -4; z < 5; z += 8 * dt) {   // (from 4 m back: the line's weight eased in at speed)
    const pos = new THREE.Vector3(0, floor(z), z);
    const off = line.update(dt, pos, up, true, vel, physics);
    drawn.push({ z, y: pos.y + off * line.w });
  }
  // (at full weight on the flight: within a centimetre of the line through the treads' middles, read STAIR_LINE.lead ahead)
  const mid = drawn.filter((d) => d.z > 1.4 && d.z < 2.6);
  for (const d of mid) assert.ok(Math.abs(d.y - 0.18 * ((d.z + STAIR_LINE.lead - 1) / 0.32 + 0.5)) < 0.01, `on the line at z ${d.z.toFixed(2)}: ${d.y.toFixed(3)}`);
  let step = 0;
  for (let i = 1; i < drawn.length; i++) step = Math.max(step, Math.abs(drawn[i].y - drawn[i - 1].y));
  assert.ok(step < 0.1, `no riser's jump in a frame (the most ${(step * 100).toFixed(1)} cm)`);
  assert.ok(Math.abs(drawn[drawn.length - 1].y - 1.44) < 0.005, 'and on the top floor once past the flight');
});

test('starts, stops and turns at the game\'s speeds: the ramp\'s touchdowns, the pivots, a sprint reversed (issue #47)', { timeout: 120000 }, async () => {
  // (standing pivots, their pops and worst jolt: the B3 test above)
  // a sprint reversed: a foot swinging 15 cm up was planted in the air for the one frame the pivot was on
  const v = (await runScenario(COURSE['pivot 180° at a jog, and at a sprint'], 'moves')).r;
  const rev = Math.max(0, ...v.events.boundaries.filter((b) => b.tag === 'pivot-sprint').map((b) => b.size));
  assert.ok(rev < 0.08, `the sprint reversed: the worst boundary ${(rev * 100).toFixed(1)} cm (12.5 with the pivot's plant in mid-air)`);
});

test('the facing turns up to speed over a few frames, and slows as before (src/player.js faceStep, issue #47)', async () => {
  const { faceStep, FACE } = await import('../src/player.js');
  const dt = 1 / 60, p = {};
  let was = 0;
  const steps = [];
  for (let i = 0; i < 6; i++) { const s = faceStep(p, Math.PI * (1 - Math.exp(-12 * dt)), dt, was); was = p._faceRate; steps.push(s); }
  assert.ok(steps[0] <= FACE.accel * dt * dt + 1e-9, `the first frame turns ${steps[0].toFixed(3)} rad, not 0.57 at once`);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] - steps[i - 1] <= FACE.accel * dt * dt + 1e-9, 'its speed rises no faster than FACE.accel');
  // slowing down: as asked, at once
  const q = { _faceRate: 30 };
  assert.ok(Math.abs(faceStep(q, 0.1, dt, 30) - 0.1) < 1e-9, 'a slower turn than the last frame\'s is taken as it is');
});

test('the gait loops through a smooth curve: each key kept, the cycle closed, no step in a bone\'s speed at a key', async () => {
  const THREE = await import('three');
  const { smoothLoop } = await import('../src/animator.js');
  // a bone turning about x at 0, 1, 0, 1 rad... keyed every 0.1 s (linear: its speed flips at every key)
  const T = 0.4, times = [0, 0.1, 0.2, 0.3, 0.4], ang = [0, 1, 0, 1, 0];
  const q = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
  const vals = ang.flatMap((a) => q(a).toArray());
  const clip = new THREE.AnimationClip('loop', T, [new THREE.QuaternionKeyframeTrack('b.quaternion', times, vals), new THREE.VectorKeyframeTrack('b.position', times, ang.flatMap((a) => [a, 0, 0]))]);
  const s = smoothLoop(clip, 120);
  const at = (tr, t) => { const I = tr.createInterpolant(); return Array.from(I.evaluate(t)); };
  for (const [i, t] of times.entries()) {
    const v = at(s.tracks[0], t), want = q(ang[i]).toArray();
    const d = Math.abs(v.reduce((a, x, k) => a + x * want[k], 0));
    assert.ok(d > 0.9999, `the key at ${t} s kept (${d.toFixed(5)})`);
    assert.ok(Math.abs(at(s.tracks[1], t)[0] - ang[i]) < 1e-4, `the position key at ${t} s kept`);
  }
  // its speed a frame either side of a key at 240 Hz (linear: +10, then -10 at once; smooth: easing through 0)
  const p = (t) => at(s.tracks[1], t)[0];
  const h = 1 / 240, before = (p(0.1) - p(0.1 - h)) / h, after = (p(0.1 + h) - p(0.1)) / h;
  assert.ok(Math.abs(before - after) < 5, `no step in its speed at a key (it turns round there over the frames either side, not in one) (${before.toFixed(2)} → ${after.toFixed(2)})`);
  // the cycle closes: the end is the start
  assert.ok(Math.abs(p(T) - p(0)) < 1e-6 && Math.abs(p(T - h) - p(h)) < 0.05, 'the loop closes smoothly');
});

test('setting off the other way from standing: the pivot that turns into a start keeps its held feet and steps clean (issue #288)', { timeout: 60000 }, async () => {
  // (the Signal Market's street: he faced the camera; pushed away and held, the 180° pivot carried the body off at a walk's
  // speed while feet.js held on to a foot the leg could no longer reach, 5.8-6.2 cm over its hold, and the steps round
  // touched down sliding with a place that ran on with the body: 22 cm "steps". Flat ground: no kerb, no crowd.)
  const name = Object.keys(COURSE).find((n) => n.startsWith('setting off the other way'));
  const { r } = await runScenario(COURSE[name], 'moves');
  const back = (x) => x.tag === 'walk-back';
  const held = Math.max(0, ...r.events.holds.filter(back).map((h) => h.slide)), slid = Math.max(0, ...r.events.steps.filter(back).map((s) => s.slide));
  assert.ok(held < LIMITS.held, `the walk off: a held foot moves ${(held * 100).toFixed(1)} cm over its hold (3.6 before, limit ${LIMITS.held * 100})`);
  assert.ok(slid < LIMITS.slideMax, `the walk off: the worst step slides ${(slid * 100).toFixed(1)} cm (19.5 before, limit ${LIMITS.slideMax * 100})`);
  assert.ok(r.measures.stop !== null && r.measures.stop <= LIMITS.stop, `every stop settles (${r.measures.stop})`);
});

test('the worlds\' course stands long enough to see a stop settle, and the Arena keeps its waves off him (issue #288)', async () => {
  const { WORLDS } = await import('../scripts/motion-qc/scenarios.mjs');
  for (const sc of WORLDS) {
    const last = sc.segs[sc.segs.length - 1];
    assert.ok(!last.stick && last.for >= LIMITS.stop + 0.3, `${sc.name}: the last stop stands ${last.for} s (a stop counts once both feet are still for 0.3 s, within ${LIMITS.stop} s)`);
  }
  assert.match(WORLDS.find((s) => s.world === 'arena').setup ?? '', /setPractice/, 'the Arena: the waves held off (one came up beside him and shoved him as he stood)');
});
