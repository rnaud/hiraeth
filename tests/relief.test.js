// The painted relief (issue #696, src/relief.js): the band beside an edge lit toward the sun and shaded away from it,
// never ink, nothing far from the edge; the frame's sun found from two frames' derivatives; the switch on by default,
// in the web's shader and the Unity port's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELIEF, RELIEF_GLSL, reliefEdge, reliefTone, reliefFrameSun } from '../src/relief.js';
import { sharedUniforms, makeMaterial } from '../src/materials.js';
import { marksHlsl } from '../scripts/unity-export/marks-hlsl.mjs';

const close = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);

test('reliefEdge: lit on the edge toward the sun, shaded on the one away, as strong as the sun is across the face', () => {
  const sun = [0.6, 0];   // (the sun along +x, grazing)
  const at = 0.5 + RELIEF.soft + RELIEF.width * 0.5;   // (in the band's full part: past the ink line's half and the first ramp)
  assert.ok(reliefEdge(at, [1, 0], sun, 1) > 0.9, 'a raised edge facing the sun: lit');
  assert.ok(reliefEdge(at, [-1, 0], sun, 1) < -0.9, 'facing away: shaded');
  assert.equal(reliefEdge(at, [0, 1], sun, 1), 0, 'an edge along the sun\'s way: neither');
  assert.ok(Math.abs(reliefEdge(at, [1, 0], [0.1, 0], 1)) < 0.25, 'the sun nearly head on: faint');
  assert.equal(reliefEdge(at, [1, 0], [0, 0], 1), 0, 'head on: none');
});

test('reliefEdge: a thin band just past the ink line, nothing on the line or far from it', () => {
  const g = [1, 0], sun = [1, 0];
  assert.equal(reliefEdge(0, g, sun, 1), 0, 'on the ink line');
  assert.equal(reliefEdge(0.5 + RELIEF.width + 2 * RELIEF.soft + 0.01, g, sun, 1), 0, 'past the band');
  assert.equal(reliefEdge(8, g, sun, 1), 0);
  // (wider at a higher pixel ratio, in device px)
  assert.ok(reliefEdge(5.5, g, sun, 1, 2) > 0.5 && reliefEdge(5.5, g, sun, 1, 1) === 0);
  // its ramps soft: never all of it from one px to the next
  for (let d = 0; d < 6; d += 0.25) assert.ok(Math.abs(reliefEdge(d + 1, g, sun, 1) - reliefEdge(d, g, sun, 1)) < 0.9, `step at ${d} px`);
});

test('reliefTone: lighter under a ceiling, darker but never ink, nothing while the switch is off', () => {
  const c = [0.5, 0.4, 0.3];
  assert.deepEqual(reliefTone(c, 1, 0), c, 'off: the colour as it was');
  assert.deepEqual(reliefTone(c, -1, 0), c);
  const d = [0.2, 0.15, 0.1];
  assert.ok(close(reliefTone(d, 1), d.map((x) => x * (1 + RELIEF.light))), 'a dark colour: its share');
  assert.ok(close(reliefTone(d, -1), d.map((x) => x * (1 - RELIEF.dark))));
  assert.ok(close(reliefTone([0.8, 0.7, 0.6], -1), [0.8, 0.7, 0.6].map((x) => x - RELIEF.most)), 'a pale one: at most RELIEF.most a channel');
  // (no step from one px to the next past post.js's colour-edge threshold, 0.08 in rgb length, on the band's ramps)
  assert.ok(RELIEF.most * Math.sqrt(3) * 1.5 / (RELIEF.soft + 0.2) < 0.08, 'the band never inked as a line of its own');
  assert.ok(RELIEF.dark < 0.25 && RELIEF.light < 0.25, 'a tone of the surface, far from ink');
  assert.deepEqual(reliefTone([0.88, 0.95, 0.5], 1).map((x) => +x.toFixed(4)), [0.9, 0.95, 0.565], 'a light channel lifted only to the ceiling, never lowered');
});

test('reliefFrameSun: the sun across the face, in another frame (an object turned and scaled)', () => {
  // a floor (world x z), seen from above at 1 cm a px; the object turned 90° about y and scaled 2×: obj = R(world) * 2
  const wdx = [0.01, 0, 0], wdy = [0, 0, 0.01];
  const rot = ([x, y, z]) => [-z * 2, y * 2, x * 2];   // (x → z, z → -x, and twice as many units)
  const sun = [0.6, 0.64, 0.48];
  const o = reliefFrameSun(wdx, wdy, rot(wdx), rot(wdy), sun);
  // in the object's frame the in-plane sun (0.6, 0, 0.48) turned: (-0.48, 0, 0.6), its length kept (world units)
  assert.ok(close(o, [-0.48, 0, 0.6], 1e-9), JSON.stringify(o));
  assert.deepEqual(reliefFrameSun([0.01, 0, 0], [0.02, 0, 0], [1, 0, 0], [2, 0, 0], sun), [0, 0, 0], 'a degenerate frame: none');
});

test('the switch: on by default (the author picked it), one shared uniform, read by every pattern that draws relief', () => {
  assert.equal(sharedUniforms.uRelief.value, 1, 'on: picked from the review page');
  const m = makeMaterial({ color: '#c9b9a0', paving: true });
  assert.equal(m.uniforms.uRelief, sharedUniforms.uRelief, 'the shared uniform, not a copy');
  assert.ok(m.fragmentShader.includes('float reliefEdge(') && m.fragmentShader.includes('uniform float uRelief;'));
  // every use behind the switch (so with it off a pattern draws what it drew before)
  for (const src of [readFileSync(new URL('../src/surface-marks.js', import.meta.url), 'utf8'), readFileSync(new URL('../src/paving-shader.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/temples/skins/machined.js', import.meta.url), 'utf8')]) {
    assert.ok(/reliefEdge\(/.test(src) && /reliefTone\(/.test(src) && /uRelief > 0\.0/.test(src));
  }
  assert.ok(!/reliefEdge|reliefTone/.test(readFileSync(new URL('../src/surface-marks.js', import.meta.url), 'utf8').split('TIMBER_GLSL')[1].split('GROUND_MID_GLSL')[0]), 'none on timber');
  // (and the tone itself scaled by it: with it off, alb * (1 + 0) is the colour exactly)
  assert.match(RELIEF_GLSL, /float k = uRelief \* r;/, 'reliefTone scaled by the switch');
});

test('Unity: the relief\'s HLSL at the head of SurfaceMarks.hlsl, behind the same switch (_Relief), set from the shared value', () => {
  const h = marksHlsl();
  assert.ok(h.indexOf('float reliefEdge(') > 0 && h.indexOf('float reliefEdge(') < h.indexOf('float interiorFloor('));
  assert.match(h, /_Relief \* r/);
  assert.ok(!/\buRelief\b|\buSunDir\b|\bdFdx\b/.test(h.replace(/\/\/.*$/gm, '')));
  const shader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.ok(shader.indexOf('#include "SurfaceMarks.hlsl"') < shader.indexOf('#include "Paving.hlsl"'), 'the relief before the paving that uses it');
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl', import.meta.url), 'utf8'), /float _Relief;/);
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethLook.cs', import.meta.url), 'utf8'), /SetGlobalFloat\("_Relief", shared\.F\("uRelief", 1\)\)/);
});
