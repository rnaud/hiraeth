// Issue #264 / #458, Unity's surfaces C, the water (docs/systems/engine-bridge.md, "Surfaces C: the water"): the waterfalls'
// falling water (src/waterfall-shader.js → Fall.hlsl), and the water's pass over the page (src/water.js WaterPass →
// WaterOver.shader: under water the tint and banded fog, a sea's shafts and caustics; above it the sun's sparkle, marked
// by Surface.shader's water in its normal's length), what crosses the bridge and the port's copies of the web's numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { portMaterial } from '../engine/unity/port-format.js';
import { FALL_GLSL, FALL_TONES } from '../src/waterfall-shader.js';
import { WATER_MARK } from '../src/water-shader.js';
import { Waters, underLook, SEA_LOOK, SEA_SHAFTS, seaShafts } from '../src/water.js';
import { sharedUniforms, makeMaterial, MODE_WATER } from '../src/materials.js';
import { UnityBackend } from '../engine/unity/backend.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const U = 'unity/Hiraeth/Assets/';
const FALL = read(`${U}Hiraeth/Shaders/Fall.hlsl`), SURFACE = read(`${U}Hiraeth/Shaders/Surface.shader`), OVER = read(`${U}Hiraeth/Shaders/WaterOver.shader`);
const RENDERER = read(`${U}HiraethJS/Runtime/BridgeRenderer.cs`), FEATURE = read(`${U}Hiraeth/Rendering/HiraethFeature.cs`), RUNNER = read(`${U}HiraethJS/Runtime/BridgeRunner.cs`);
const nums = (s) => [...s.replace(/\/\/[^\n]*/g, '').matchAll(/(?<![\w.])\d+\.\d+|(?<![\w.])\d+(?![\w.])/g)].map((m) => +m[0]);

test('a fall crosses as the port\'s values: _FallOn, its speed, columns, gaps, mist, ink, lip, height and seed', () => {
  const m = portMaterial({ type: 'ink', u: { uMode: 0, uFallA: [7, 2.6, 0.05, 11], uFallB: [0.85, 3.5, 167, 9] }, defines: { FALL: 1 } });
  assert.equal(m.fallOn, 1);
  assert.deepEqual(m.fallA, [7, 2.6, 0.05, 11]);
  assert.deepEqual(m.fallB, [0.85, 3.5, 167, 9]);
  assert.equal(portMaterial({ type: 'ink', u: { uMode: 0 }, defines: {} }).fallOn, undefined);
  const loader = read(`${U}Hiraeth/Runtime/WorldLoader.cs`);
  assert.match(loader, /\("fallOn", "_FallOn"\)/);
  assert.match(loader, /\("fallA", "_FallA"\), \("fallB", "_FallB"\)/);
});

test('Fall.hlsl is the web\'s fallLook, number for number', () => {
  const web = FALL_GLSL.slice(FALL_GLSL.indexOf('FallLook fallLook('));
  const port = FALL.slice(FALL.indexOf('FallLook fallLook('));
  // (the web's tone thresholds are spliced in from FALL_TONES; the port's are its FALL_TONES constant)
  const webNums = nums(web), portNums = nums(port.replace(/FALL_TONES\.([xyz])/g, (_, c) => String(FALL_TONES['xyz'.indexOf(c)])));
  assert.deepEqual(portNums, webNums);
  const tones = FALL.match(/FALL_TONES = float3\(([^)]+)\)/)[1].split(',').map(Number);
  assert.deepEqual(tones, FALL_TONES);
});

test('a fall is drawn on the full variant: its slits\' discard never in a lean prepass', () => {
  assert.match(RENDERER, /F\(m, "_FallOn"\) > 0\.5f \? "fall"/);
  assert.match(RENDERER, /\(F\(m, "_FallOn"\) > 0\.5f \? 1 : 0\);/, 'RareCount counts it');
  assert.match(SURFACE, /UNITY_BRANCH if \(LEANK && _FallOn > 0\.5\) \{ fall = fallLook\(I_FORM\.xy\); if \(fall\.gap > 0\.5\) discard; \}/);
  assert.match(SURFACE, /if \(_MapOn > 0\.5 \|\| _FallOn > 0\.5\) O_FORM = float4\(v\.uv, 0, 0\);/, 'its uv in the form\'s slot');
  assert.match(SURFACE, /if \(LEANK && _FallOn > 0\.5\) \{ albedo = fall\.albedo; L = 1\.0; \}/, 'its own light');
  assert.match(SURFACE, /detail = max\(detail, fall\.ink\);/);
  assert.match(SURFACE, /#include "Fall\.hlsl"/);
});

test('the water marks itself and its glints in the normal\'s length, as water-shader.js WATER_MARK', () => {
  assert.match(SURFACE, new RegExp(`o\\.normalDepth\\.xyz \\*= ${1 + WATER_MARK.base} \\+ ${WATER_MARK.glint} \\* waterGlint;`));
  assert.match(SURFACE, /UNITY_BRANCH if \(_SunDir\.y > 0\.02 && _WaterOpt\.w > 0\.0 && _WaterLite < 0\.5\)/, 'gated as the web\'s: sun up, sparkle on, not the low detail');
  assert.match(OVER, new RegExp(`#define MARK_BASE ${1 + WATER_MARK.base}`));
  assert.match(OVER, new RegExp(`#define MARK_GLINT ${WATER_MARK.glint}`));
  assert.match(OVER, new RegExp(`float4 _WOShafts\\[${SEA_SHAFTS}\\];`));
});

test('underLook: a plain body\'s tint from its own colour, a sea\'s look with its shafts round the camera', () => {
  const mat = { uniforms: { uColor: { value: new THREE.Color(0.4, 0.6, 0.7) } } };
  const plain = underLook({ y: 3, body: { mat } }, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  assert.equal(plain.surf, 3);
  assert.deepEqual(plain.fog, [SEA_LOOK.density, SEA_LOOK.bands, SEA_LOOK.min, SEA_LOOK.max]);
  assert.deepEqual(plain.tint, [0.4, 0.6, 0.7]);
  assert.deepEqual(plain.deep.map((x) => +x.toFixed(4)), [0.2, 0.3, 0.35]);
  assert.equal(plain.shaftTone[3], 0, 'the generic shafts'); assert.equal(plain.caustic[2], 0); assert.equal(plain.shafts, null);
  const sea = { tint: '#3f8f95', deep: '#1f4f60', density: 0.05, shafts: { cell: 30, width: [2, 5], lean: 0.3, reach: 90, strength: 0.3, tone: '#eafbf6' }, caustics: { scale: 0.4, range: 25, strength: 0.6, speed: 0.5 } };
  const cam = new THREE.Vector3(14, -10, -40), sun = new THREE.Vector3(0.6, 0.6, 0.2).normalize();
  const L = underLook({ y: 78, body: { sea } }, cam, sun);
  assert.deepEqual([...L.shafts], [...seaShafts(sea.shafts, cam.x, cam.z)]);
  assert.equal(Math.hypot(L.shaftDir[0], L.shaftDir[1], L.shaftDir[2]).toFixed(5), '1.00000');
  assert.ok(L.shaftDir[0] < 0 && L.shaftDir[1] < 0, 'slanting away from the sun, down');
  assert.equal(L.shaftDir[3], 90); assert.equal(L.shaftTone[3], 0.3);
  assert.deepEqual(L.caustic, [0.4, 25, 0.6, 0.5]);
  assert.deepEqual(L.fog, [0.05, SEA_LOOK.bands, SEA_LOOK.min, SEA_LOOK.max]);
});

test('Waters.overState: nothing without water, the sparkle by day over water in view, the sea\'s look under it', () => {
  const scene = new THREE.Scene();
  const w = new Waters(scene, { drops: false });
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 5, 10); camera.lookAt(0, 0, 0);
  w.keepCamera(camera);
  assert.equal(w.overState(camera), null);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), makeMaterial({ color: '#4fb3b0', color2: '#8fdcd2', mode: MODE_WATER }));
  scene.add(mesh);
  w.add(mesh);
  const sunWas = sharedUniforms.uSunDir.value.clone();
  sharedUniforms.uSunDir.value.set(0.3, 0.8, 0.2).normalize();
  w.keepCamera(camera);
  assert.deepEqual(w.overState(camera), { under: 0 });
  camera.position.set(0, -3, 10); camera.updateMatrixWorld();
  w.keepCamera(camera);
  const s = w.overState(camera);
  assert.equal(s.under, 1); assert.ok(Math.abs(s.surf) < 1e-9);
  sharedUniforms.uSunDir.value.copy(sunWas);
});

test('the bridge sends the pass\'s numbers when they change, and the frame draws it after the composite', () => {
  const calls = [];
  const b = Object.create(UnityBackend.prototype);
  b.host = { Water: (j) => calls.push(j) };
  b.water({ under: -1, lite: 0 });
  b.water({ under: -1, lite: 0 });
  b.water({ under: 1, surf: 2.5, shafts: new Float32Array([1.23456, 2, 3, 4]) });
  assert.equal(calls.length, 2, 'once a change');
  assert.deepEqual(JSON.parse(calls[1]).shafts, [1.235, 2, 3, 4]);
  assert.match(read('engine/unity/game.js'), /backend\.water\(game\.waterOver\?\.\(\)\);/);
  const game = read('engine/game.js');
  assert.match(game, /waters\.keepCamera\(camera, player\.swim\?\.under \? 'under' : 'over'\);/, 'the camera kept off the surface, as main.js');
  assert.match(game, /waterShared\.uWaterLite\.value = Q\.lowDetail \|\| Q\.postLite \? 1 : 0;/, 'the preset\'s sparkle, as main.js applyDetail');
  assert.match(RUNNER, /public void Water\(string json\)/);
  assert.match(RUNNER, /BridgeArgs\.Flag\("-no-water-over"\)/);
  assert.match(FEATURE, /composite\.water = Settings\.waterOver && WaterOverMode > 0 && WorldDetail\.DrawsWorld\(cam\) \? waterOverMaterial : null;/);
  assert.match(FEATURE, /"Hiraeth water over"/);
  assert.match(read(`${U}Hiraeth/Editor/Batch.cs`), /"Hidden\/Hiraeth\/WaterOver"/, 'kept in the builds');
  const guid = read(`${U}Hiraeth/Shaders/WaterOver.shader.meta`).match(/guid: (\w+)/)[1];
  assert.ok(read('unity/Hiraeth/ProjectSettings/ProjectSettings.asset').includes(guid), 'preloaded (issue #500)');
});
