// Paving's flagstones (issue #669, src/paving-shader.js): the option, its define and uniform, the courses and stones the
// shader lays (its JavaScript twin), and the Unity port's copy of the GLSL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAVING, PAVING_GLSL, pavingOf, stoneAt } from '../src/paving-shader.js';
import { makeMaterial, surfaceDefines, MODE_TERRAIN, MODE_WATER, MODE_STRATA } from '../src/materials.js';
import { pavingHlsl, PAVING_HLSL_PATH } from '../scripts/unity-export/paving-hlsl.mjs';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';

test('paving: the option as its uniform (course, wear, tone, turn), never on ground, water, glass or lights', () => {
  assert.deepEqual(pavingOf({}), [0, 0, 0, 0]);
  assert.deepEqual(pavingOf({ paving: true }), [PAVING.size, 1, 1, 0]);
  assert.deepEqual(pavingOf({ paving: 2.5 }), [2.5, 1, 1, 0]);
  assert.deepEqual(pavingOf({ paving: { size: 3, wear: 5, tone: -1, turn: 0.5 } }), [3, 2, 0, 0.5]);
  for (const o of [{ mode: MODE_TERRAIN }, { mode: MODE_WATER }, { glass: true }, { glow: 1 }, { figure: true }]) assert.deepEqual(pavingOf({ ...o, paving: true }), [0, 0, 0, 0]);
  assert.deepEqual(pavingOf({ mode: MODE_STRATA, paving: 1.4 }), [1.4, 1, 1, 0], 'strata steps can be paved');
});

test('paving: compiled only into the materials that ask for it (S_PAVING), its uniform set', () => {
  assert.ok(!('S_PAVING' in surfaceDefines({ color: '#fff', grid: 3 })));
  assert.ok('S_PAVING' in surfaceDefines({ color: '#fff', grid: 3, paving: 1.8 }));
  const m = makeMaterial({ color: '#e9dcc2', grid: 3, paving: 1.8 });
  assert.deepEqual(m.uniforms.uPaving.value.toArray(), [1.8, 1, 1, 0]);
  assert.equal(makeMaterial({ color: '#e9dcc3' }).uniforms.uPaving.value.x, 0);
  assert.match(m.fragmentShader, /float paving\(vec2 p, vec2 fp, inout vec3 alb\)/);
});

test('paving: courses of uneven depth, stones of uneven length with staggered joints, every point in one stone', () => {
  const S = 1.6, depths = new Map(), lengths = [];
  for (let i = 0; i < 4000; i++) {
    const x = (i * 7.31) % 211 - 100, y = (i * 3.97) % 173 - 80;
    const { box: [x0, y0, x1, y1], id } = stoneAt(x, y, S);
    assert.ok(x >= x0 - 1e-9 && x < x1 + 1e-9 && y >= y0 - 1e-9 && y < y1 + 1e-9, `(${x}, ${y}) inside its stone`);
    const again = stoneAt((x0 + x1) / 2, (y0 + y1) / 2, S);
    assert.deepEqual(again.id, id, 'the stone\'s middle lies in the same stone');
    depths.set(id[1], y1 - y0);
    lengths.push(x1 - x0);
  }
  const d = [...depths.values()];
  assert.ok(Math.min(...d) >= S * (1 - PAVING.jitter.row) - 1e-9 && Math.max(...d) <= S * (1 + PAVING.jitter.row) + 1e-9, 'courses 0.6..1.4 of the size');
  assert.ok(Math.max(...d) - Math.min(...d) > 0.4 * S, 'their depths vary');
  assert.ok(Math.max(...lengths) / Math.min(...lengths) > 2, 'stones short and long');
  // staggered: the joints of one course seldom meet the next's
  let met = 0, n = 0;
  for (let x = -50; x < 50; x += 0.37) {
    const a = stoneAt(x, 0.5 * S, S), b = stoneAt(x, 0.5 * S + a.box[3] - a.box[1], S);
    if (b.id[1] !== a.id[1] + 1) continue;
    n++;
    if (Math.abs(a.box[0] - b.box[0]) < 0.05 * S) met++;
  }
  assert.ok(n > 100 && met / n < 0.1, `joints staggered (${met} of ${n} aligned)`);
});

test('paving reaches the Unity port: Paving.hlsl made from the GLSL, the material\'s _Paving in its record', () => {
  assert.equal(readFileSync(PAVING_HLSL_PATH, 'utf8'), pavingHlsl(), 'Paving.hlsl is out of date: node scripts/unity-export/paving-hlsl.mjs');
  assert.ok(!/\b(vec[234]|mix|fract|uPaving|uPixelRatio)\b/.test(pavingHlsl().replace(/\/\/.*$/gm, '')), 'no GLSL left in it');
  assert.ok(PAVING_GLSL.includes('uPaving'));
  const p = portMaterial(inkSpec(makeMaterial({ color: '#d5c7a8', grid: 3, paving: { size: 1.2, turn: 0.25 } })), 3);
  assert.deepEqual(p.paving, [1.2, 1, 1, 0.25]);
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: '#d5c7a9', grid: 3 })), 4).paving, undefined);
  const shader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.match(shader, /#include "Paving\.hlsl"/);
  assert.match(shader, /float pInk = paving\(i\.worldPos\.xz, paveFw, pa\)/);
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs', import.meta.url), 'utf8'), /\("paving", "_Paving", Vector4\.zero\)/);
});
