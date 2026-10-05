import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { course, traveller, drive, timeToFace, loadAssets } from './gait-sim.js';

// The traveller's and the people's locomotion (src/locomotion.js, src/feet.js, the gait analysis in
// src/animator.js): the prototype walk -> run -> sharp turn -> stop with the feet measured, slopes
// and stairs, turning on the spot, the people's own gaits, and their animation by distance.

const W = { KeyW: true }, R = { KeyW: true, ShiftLeft: true }, SR = { KeyS: true, ShiftLeft: true }, S = { KeyS: true }, D = { KeyD: true }, none = {};
const report = (name, r) => console.log(`  ${name}: held ${r.heldSlide.toFixed(4)} m, slide max ${r.maxSlide.toFixed(3)} mean ${r.meanSlide.toFixed(3)} m (${r.contacts} contacts), sink ${r.sink.toFixed(3)} m, jerk pelvis ${r.jitterPelvis.toFixed(2)} head ${r.jitterHead.toFixed(2)} km/s³, max bone turn ${r.maxTurn.toFixed(2)} rad/frame`);

test('walk -> run -> sharp turn -> stop: planted feet stay put, nothing pops, the turn answers at once', async () => {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60));
  const r = drive(p, [[1, none, 'idle'], [2, W, 'walk'], [2, R, 'run'], [1.5, SR, 'turn180'], [2.5, none, 'stop']]);
  report('sequence', r);
  assert.ok(r.contacts >= 16, 'the feet touch down all along');
  // (touching down and lifting off included: at a sprint a foot covers 12 cm a frame as it meets the ground; it was 2 m before)
  assert.ok(r.maxSlide < 0.2, `no foot skids more than 20 cm over a contact (${r.maxSlide.toFixed(3)})`);
  assert.ok(r.heldSlide < 0.015, `a planted foot stays where it was put (${r.heldSlide.toFixed(4)} m over a hold)`);
  assert.ok(r.meanSlide < 0.07, `a contact slides under 7 cm on average (${r.meanSlide.toFixed(3)})`);
  assert.ok(r.sink < 0.02, `no sole goes into the ground (${r.sink.toFixed(3)})`);
  assert.ok(r.maxTurn < 1.0, `no bone turns a radian in a frame (${r.maxTurn.toFixed(2)})`);
  assert.ok(r.jitterHead < 4, `the head moves smoothly (${r.jitterHead.toFixed(2)})`);
  // responsive: facing back within 0.35 s of the stick (it was 0.3 s before any of this)
  const t = timeToFace(r.frames, 5, Math.PI);
  assert.ok(t <= 0.35, `faces the new way in ${t.toFixed(2)} s`);
  // and it ends standing: both feet down, under the body, after its settling step
  const last = r.frames.at(-1);
  assert.ok(last.feet.l.locked && last.feet.r.locked, 'both feet planted at the end');
});

test('stopping takes a settling step; starting leans forward, braking leans back', async () => {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60));
  const steps = [];
  p.onStep = (pt) => steps.push(p.time);
  const leans = [];
  const r = drive(p, [[1, none, 'idle'], [0.4, W, 'go']]);
  leans.push(p.loco.lean);
  const r2 = drive(p, [[1.0, W, 'walk'], [0.12, none, 'brake']]);
  leans.push(p.loco.lean);
  const before = steps.length;
  const r3 = drive(p, [[2.5, none, 'stop']]);
  assert.ok(leans[0] > 0.03, `leans forward setting off (${leans[0].toFixed(3)})`);
  assert.ok(leans[1] < -0.03, `leans back braking (${leans[1].toFixed(3)})`);
  const settle = r3.frames.some((f) => f.feet.l.step || f.feet.r.step);
  assert.ok(settle, 'a settling step after the stop');
  assert.ok(steps.length > before, 'its touchdown is a step (a footprint, a sound)');
  report('walk-stop', r3);
  assert.ok(r3.maxSlide < 0.08, `the stop doesn't skid (${r3.maxSlide.toFixed(3)})`);
});

test('slopes and stairs: feet on the steps, none under them, the hips coming down; standing on a stair', async () => {
  for (const [name, at, script] of [
    ['ramp', [-20, 0, 24], [[1, none, 'idle'], [5, W, 'up'], [1.5, none, 'stand']]],
    ['stairs', [20, 0, 26], [[1, none, 'idle'], [1.6, W, 'up'], [1, none, 'stand'], [3, W, 'down'], [1, none, 'stand']]],
  ]) {
    const p = await traveller(course(), new THREE.Vector3(...at));
    const r = drive(p, script);
    report(name, r);
    assert.ok(r.sink < 0.02, `${name}: no sole under the ground (${r.sink.toFixed(3)})`);
    assert.ok(r.maxSlide < 0.15, `${name}: no foot skids (${r.maxSlide.toFixed(3)})`);
    assert.ok(r.heldSlide < 0.015, `${name}: planted feet stay put (${r.heldSlide.toFixed(4)})`);
    assert.ok(r.jitterPelvis < 3.5, `${name}: the hips ride the steps smoothly (${r.jitterPelvis.toFixed(2)})`);
    if (name === 'stairs') {
      // standing mid-flight: the two feet on two different steps, the hips down to reach the lower
      const f = r.frames.find((x) => x.tag === 'stand' && x.t > 3.4);
      const dy = Math.abs(f.feet.l.gBall - f.feet.r.gBall);
      assert.ok(dy > 0.1, `standing on the stairs, the feet are on different steps (${dy.toFixed(2)} m apart)`);
      assert.ok(p.humanoid._feet.drop >= 0, 'the hips may come down');
    }
  }
});

test('turning on the spot: the feet step round, one at a time, instead of the body spinning on them', async () => {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60));
  const r = drive(p, [[1, none, 'idle'], [0.12, S, 'tap'], [2.5, none, 'settle']]);
  report('spin', r);
  assert.ok(Math.abs(Math.atan2(Math.sin(p.heading), Math.cos(p.heading))) > 2.4, 'turned round');
  assert.ok(r.maxSlide < 0.1, `the feet don't skid round (${r.maxSlide.toFixed(3)})`);
  let steps = 0, both = 0;
  for (let i = 1; i < r.frames.length; i++) {
    const f = r.frames[i].feet, g = r.frames[i - 1].feet;
    for (const s of ['l', 'r']) if (f[s].step && !g[s].step) steps++;
    if (f.l.step && f.r.step) both++;
  }
  assert.ok(steps >= 2, `steps round (${steps})`);
  assert.equal(both, 0, 'never both feet in the air');
});

test('the loops\' feet: contact curves alternate, stance speeds and the body\'s leg ratio', async () => {
  const { lib, human } = await loadAssets();
  const { analyseGait, Animator } = await import('../src/animator.js');
  const { Humanoid } = await import('../src/humanoid.js');
  const { buildCharacter } = await import('../src/player.js');
  const G = analyseGait(lib);
  for (const [k, lo, hi] of [['walk', 0.7, 1.3], ['jog', 4, 7], ['sprint', 7, 11]]) {
    const c = G.clips[k];
    assert.ok(c.speed > lo && c.speed < hi, `${k}: the planted foot sweeps back at ${c.speed.toFixed(2)} m/s`);
    const on = (f) => [...c.contact[f]].map((x) => x > 0.5);
    const l = on('l'), r = on('r');
    assert.ok(l.some(Boolean) && r.some(Boolean), `${k}: both feet touch down`);
    // half a cycle apart: the left's stance is the right's swing
    const shifted = r.map((_, i) => r[(i + r.length / 2) % r.length]);
    const agree = l.filter((x, i) => x === shifted[i]).length / l.length;
    assert.ok(agree > 0.85, `${k}: the feet alternate (${agree.toFixed(2)})`);
  }
  const char = buildCharacter(), h = new Humanoid(human.m, char, 'm'), a = new Animator(lib, char).bindBody(h);
  assert.ok(a.legRatio > 1 && a.legRatio < 1.15, `our legs are a little longer than the library's (${a.legRatio.toFixed(3)})`);
  // cadence: human, ~1.2 cycles a second jogging at 3.8 m/s and ~1.5 running at 7.2
  for (const [sp, lo, hi] of [[3.8, 1.0, 1.4], [7.2, 1.3, 1.8]]) {
    a.phase = 0;
    for (let i = 0; i < 120; i++) a.update(1 / 60, { speed: sp, onGround: true, mode: 'ground', walkAt: 0.93, jogAt: 3.8, sprintAt: 7.2, strideScale: 1 });
    const t0 = a.phase;
    a.update(0.25, { speed: sp, onGround: true, mode: 'ground', walkAt: 0.93, jogAt: 3.8, sprintAt: 7.2, strideScale: 1 });
    const cps = (((a.phase - t0) % 1) + 1) % 1 / 0.25;
    assert.ok(cps > lo && cps < hi, `${sp} m/s: ${cps.toFixed(2)} cycles a second`);
    const warp = sp / (a.footSpeed * a.gaitW);
    assert.ok(warp > 0.5 && warp < 0.85, `${sp} m/s: the stride is warped by ${warp.toFixed(2)}`);
  }
});

test('people walk their own way: build, size and a seed; the same person always walks the same', async () => {
  const { gaitStyle } = await import('../src/locomotion.js');
  const { mulberry32 } = await import('../src/noise.js');
  const a = gaitStyle(mulberry32(1), { build: 'slim' }), b = gaitStyle(mulberry32(1), { build: 'slim' });
  assert.deepEqual(a, b, 'seeded');
  const heavy = gaitStyle(mulberry32(1), { build: 'heavy' });
  assert.ok(heavy.stride < a.stride && heavy.sway > a.sway && heavy.bob < a.bob, 'a heavy body: a shorter stride, more roll, less bounce');
  const child = gaitStyle(mulberry32(1), { size: 0.6 });
  assert.ok(child.bob > gaitStyle(mulberry32(1), {}).bob, 'a child bounces more');
  const many = Array.from({ length: 40 }, (_, i) => gaitStyle(mulberry32(i + 7), {}));
  const phases = new Set(many.map((g) => Math.floor(g.phase * 8)));
  assert.ok(phases.size >= 6, 'people start their steps all over the cycle');
  const strides = many.map((g) => g.stride);
  assert.ok(Math.max(...strides) - Math.min(...strides) > 0.06, 'and walk at their own stride');
});
