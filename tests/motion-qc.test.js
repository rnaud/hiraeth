// The motion QC (.claude/skills/motion-qc): its judgement (scripts/motion-qc/lib.mjs) on made-up tracks, and the
// traveller's own runs on the gait harness's course held to its limits where they are green today (scripts/motion-qc/
// run.mjs). Before the QC, the default walk popped a knee straight and bent again at every lift-off (25 rad/s), dropped a
// foot 9 cm in a frame at every touchdown at a jog, and a pivot that flickered off for a frame planted a foot half a
// metre off (docs/systems/animation.md, "The motion QC").
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, steps, pops, jolts, latency, pivots, LIMITS, BONES, JOINTS } from '../scripts/motion-qc/lib.mjs';
import { runScenario } from '../scripts/motion-qc/run.mjs';
import { COURSE } from '../scripts/motion-qc/scenarios.mjs';

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

test('the traveller on the course: the runs green today stay green (the default: loops with captured moves)', { timeout: 120000 }, async () => {
  for (const name of ['walk, 90° turn, stop', 'jog, 45° and back, stop', 'curve: the stick round a circle at a jog', 'stand still 6 s']) {
    const { r } = await runScenario(COURSE[name], 'moves');
    assert.ok(r.green, `${name}: green (${r.fails.join(', ')}; slide p95 ${(r.measures.slideP95 * 100).toFixed(1)} cm, pops ${r.measures.popsPerMin}/min, jolts ${r.measures.joltsPerMin}/min)`);
  }
  // the worst before: the walk's knee and foot pops at every step, and the pivot's 20 cm jolt
  const g = (await runScenario(COURSE['gaits: walk → jog → sprint → jog → walk → stop'], 'moves')).r.measures;
  assert.ok(g.popsPerMin <= 12, `every gait: pops ${g.popsPerMin}/min (34, then 14 before the sprint was looked at)`);
  assert.ok(g.joltsPerMin <= 9, `every gait: jolts ${g.joltsPerMin}/min (13 before the sprint was looked at)`);
  const p = (await runScenario(COURSE['pivots standing: 90° each way, 180°'], 'moves')).r.measures;
  assert.ok(p.joltMax < 0.1, `pivots: the worst jolt ${(p.joltMax * 100).toFixed(1)} cm (20 before)`);
  assert.ok(p.crossed <= 0.1, `pivots: the feet crossed ${Math.round(p.crossed * 100)} % of the frames (17 % before a step kept to its own side)`);
  // the last step of a stop from a run slid 29 cm; the stairs threw a swinging foot 18 cm in a frame
  const s = (await runScenario(COURSE['starts and stops, walk and run'], 'moves')).r.measures;
  assert.ok(s.slideMax < 0.2, `starts and stops: the worst step slides ${(s.slideMax * 100).toFixed(1)} cm (29 before)`);
  const st = (await runScenario(COURSE['stairs up, stand, down'], 'moves')).r.measures;
  assert.ok(st.joltMax < 0.16 && st.popsPerMin <= 15, `stairs: the worst jolt ${(st.joltMax * 100).toFixed(1)} cm (18 before), pops ${st.popsPerMin}/min (18 before)`);
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
