// Garden beds (issue #691, src/garden-beds-shader.js, after references/surfaces/garden-beds/sheet-1.jpg): the option, the
// define, the uniform, the port's record and its HLSL being current; and the machined finish outside the skins
// (src/temples/skins/machined-plates.js): a skin pattern the port carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bedsOf, BEDS_GLSL } from '../src/garden-beds-shader.js';
import { makeMaterial } from '../src/materials.js';
import { bedsHlsl, BEDS_HLSL_PATH } from '../scripts/unity-export/beds-hlsl.mjs';
import { machinedMaterial } from '../src/temples/skins/machined-plates.js';
import { skinPatternSpec, SKIN_ORDER } from '../src/temples/skins/skin-shader.js';

test('beds: the option as its uniform, never on terrain, water or lights', () => {
  assert.deepEqual(bedsOf({}), [0, 0, 0, 0]);
  assert.deepEqual(bedsOf({ beds: true }).slice(2), [0.7, 1]);
  assert.equal(bedsOf({ beds: 0.4 })[0], 0.4);
  assert.deepEqual(bedsOf({ beds: { row: 0.3, turn: 1, plants: 0 } }), [0.3, 1, 0, 1]);
  for (const o of [{ mode: 1 }, { mode: 3 }, { glow: 1 }, { glass: true }]) assert.deepEqual(bedsOf({ beds: true, ...o }), [0, 0, 0, 0]);
});

test('beds: the define and the uniform on the material, nothing on one without', () => {
  const m = makeMaterial({ color: '#86694a', flat: true, beds: { row: 0.55, plants: 0.7 } });
  assert.ok(m.defines.S_BEDS);
  assert.equal(m.uniforms.uBeds.value.w, 1);
  assert.ok(m.fragmentShader.includes('gardenBeds('));
  assert.ok(!makeMaterial({ color: '#86694a', flat: true }).defines.S_BEDS);
});

test('beds: the Unity port gets its record and the same GLSL in HLSL', () => {
  assert.equal(readFileSync(BEDS_HLSL_PATH, 'utf8'), bedsHlsl(BEDS_GLSL), 'run node scripts/unity-export/beds-hlsl.mjs');
  const shader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.ok(shader.includes('#include "GardenBeds.hlsl"') && shader.includes('_Beds.w > 0.0'));
  assert.ok(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs', import.meta.url), 'utf8').includes('"_Beds"'));
  assert.ok(readFileSync(new URL('../engine/unity/port-format.js', import.meta.url), 'utf8').includes('e.beds ='));
});

test('the machined finish outside the skins: a skin pattern, with mkFinish, the port sends as data', () => {
  const m = machinedMaterial({ color: '#e9dcc0' }, { plate: 1.9, panel: [1.9, 0.6] });
  assert.equal(m.userData.skinPattern.skin, 'machined');
  assert.ok(m.fragmentShader.split('mkFinish(').length > 2, 'the finish is called');
  const spec = skinPatternSpec(m);
  assert.equal(spec.body, SKIN_ORDER.indexOf('machined') * 8 + 1);
  assert.deepEqual(Array.from(spec.data.slice(0, 4)).map((v) => +v.toFixed(3)), [1.9, 1.9, 0.6, 1]);
  assert.equal(machinedMaterial({ color: '#e9dcc0' }, { plate: 1.9, panel: [1.9, 0.6] }), m, 'cached');
});
