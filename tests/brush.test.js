import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BrushTrail, BRUSH, brushKernel, brushPace, BRUSH_GLSL } from '../src/brush.js';
import { makeMaterial } from '../src/materials.js';
import { GRASS_VERT_PARS } from '../src/grass-shader.js';

// The traveller walks along x past a plant at the origin, `off` metres to its side, at v m/s;
// the plant's lean away from them (m at the tip of a 1.3 m plant), frame by frame at 60 fps.
function pass(v, off, { seconds = 4, start = -4 } = {}) {
  const trail = new BrushTrail(), plant = new THREE.Vector3(), feet = new THREE.Vector3();
  const dt = 1 / 60, out = [];
  let x = v ? start : 0;
  for (let i = 0; i < seconds * 60; i++) {
    x += v * dt;
    trail.update(dt, feet.set(x, 0, off), v);
    const l = trail.leanAt(plant);
    out.push({ t: (i + 1) * dt, x, away: -l.z, along: l.x });
  }
  return out;
}
const peakOf = (log) => log.reduce((a, b) => (b.away > a.away ? b : a));

test('brush: walking past, a plant leans a little away, quickly, and springs back with a light wobble', () => {
  const log = pass(3.8, 0.25), peak = peakOf(log);
  assert.ok(peak.away > 0.04 && peak.away < 0.15, `peak lean ${peak.away.toFixed(3)} m (the old shove: ~1 m at chest height)`);
  // quick: the peak comes within a third of a second of passing the plant
  const tPass = 4 / 3.8;
  assert.ok(peak.t > tPass - 0.15 && peak.t < tPass + 0.35, `peak at ${peak.t.toFixed(2)} s, passing at ${tPass.toFixed(2)} s`);
  // the wobble: after the peak it swings back past upright a little, then settles
  const after = log.filter((s) => s.t > peak.t);
  const back = -Math.min(...after.map((s) => s.away));
  assert.ok(back > 0.08 * peak.away && back < 0.45 * peak.away, `overshoot ${(back / peak.away * 100).toFixed(0)}%`);
  const left = (4 + 1) / 3.8;   // out of reach
  const late = log.filter((s) => s.t > left + 0.9);
  assert.ok(Math.max(...late.map((s) => Math.hypot(s.away, s.along))) < 0.02 * peak.away, 'still again within a second');
  // smooth, frame to frame (no jump as the path's samples shift along)
  let jump = 0;
  for (let i = 1; i < log.length; i++) jump = Math.max(jump, Math.abs(log[i].away - log[i - 1].away));
  assert.ok(jump < 0.15 * peak.away, `largest step between frames ${(jump / peak.away * 100).toFixed(0)}% of the peak`);
});

test('brush: the closer and the faster you pass, the more it leans; out of reach, nothing', () => {
  const at = (v, off) => peakOf(pass(v, off)).away;
  assert.ok(at(3.8, 0.2) > at(3.8, 0.6) && at(3.8, 0.6) > at(3.8, 0.9), 'closer leans more');
  assert.ok(Math.abs(at(3.8, 1.3)) < 1e-9, 'past the reach');
  assert.ok(at(7.2, 0.3) > at(3.8, 0.3) * 1.05, `running ${at(7.2, 0.3).toFixed(3)} > walking ${at(3.8, 0.3).toFixed(3)}`);
  assert.ok(at(1.2, 0.3) < at(3.8, 0.3), 'a slow step leans less');
  assert.ok(at(7.2, 0.3) < 0.2, 'even running it is a brush, not a shove');
  assert.ok(brushPace(50) === brushPace(BRUSH.maxSpeed), 'a fall or a jet pushes no harder than a run');
});

test('brush: standing in a plant holds a small steady lean, without flicker; riding touches nothing', () => {
  const log = pass(0, 0.3, { seconds: 3 }).slice(60);
  const lo = Math.min(...log.map((s) => s.away)), hi = Math.max(...log.map((s) => s.away));
  assert.ok(hi - lo < 0.002, `steady (${lo.toFixed(4)}..${hi.toFixed(4)})`);
  assert.ok(Math.abs(hi - BRUSH.still) < 0.005, `the still lean (${hi.toFixed(3)} m)`);
  const trail = new BrushTrail();
  for (let i = 0; i < 90; i++) trail.update(1 / 60, null, 4);
  assert.deepEqual(trail.leanAt(new THREE.Vector3()), { x: 0, z: 0 });
  assert.ok(trail.bound.z < 0, 'no path: the shader skips every plant at once');
});

test('brush: the spring\'s response is normalised (a steady touch gives the steady lean) and dies down within the memory', () => {
  let sum = 0;
  const N = 4000, end = BRUSH.samples * BRUSH.dt;
  for (let i = 0; i < N; i++) sum += brushKernel((i + 0.5) * end / N) * end / N;
  assert.ok(Math.abs(sum - 1) < 0.03, `∫g = ${sum.toFixed(3)}`);
  assert.equal(brushKernel(0), 0);
  assert.equal(brushKernel(end), 0);
});

test('brush: plants and grass sum the same path in their vertex stage', () => {
  assert.ok(BRUSH_GLSL.includes(`uniform vec4 uBrushTrail[${BRUSH.samples}]`));
  const plant = makeMaterial({ color: '#ffffff', vertexColors: true, sway: 0.1, swayH: 1.2, key: 't.brush.plant' });
  assert.ok(plant.vertexShader.includes('vec2 brushLean(') && plant.uniforms.uBrushTrail.value.length === BRUSH.samples);
  assert.deepEqual(plant.uniforms.uSwayPlant.value.toArray(), [1.2, 0]);
  assert.ok(GRASS_VERT_PARS.includes('brushLean(root'));
  assert.ok(!plant.vertexShader.includes('uBrush.w'), 'the old shove (position and speed now) is gone');
});
