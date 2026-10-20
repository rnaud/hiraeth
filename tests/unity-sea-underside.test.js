// Issue #577: Unity drew the sea's surface seen from below (the Underwater City, looking up from under the water) much
// paler than the web, with streaks across it. Two of water-shader.js waterLook's terms the port had left out: the
// underside's own colour (uWaterBelow, the sea's `below`: Unity used the default's 0.45 toward white for every water), and
// the crests' fade (WATER_INK: only in the wind's patches, gone far off), whose lack drew the wave lines to the horizon on
// both of its sides. docs/systems/engine-bridge.md "The sea from below (issue #577)".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { portMaterial } from '../engine/unity/port-format.js';
import { inkSpec } from '../engine/ink-spec.js';
import { WATER_INK, WATER_GLSL } from '../src/water-shader.js';
import { makeMaterial, MODE_WATER } from '../src/materials.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const LOADER = read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs');
const look = SURFACE.slice(SURFACE.indexOf('float3 waterLook('), SURFACE.indexOf('struct GBufferOut'));

test('a water\'s underside crosses the bridge and reaches the material as _WaterBelow', () => {
  const mat = makeMaterial({ color: '#2f8fb0', color2: '#2f86b4', below: ['#8fd0e4', 0.22], mode: MODE_WATER, waterDepth: 40 });
  const m = portMaterial(inkSpec(mat));
  const c = new THREE.Color('#8fd0e4');
  assert.deepEqual(m.water.uWaterBelow.map((x) => +x.toFixed(4)), [c.r, c.g, c.b, 0.22].map((x) => +x.toFixed(4)));
  assert.match(LOADER, /var wbl = water\.L\("uWaterBelow"\);/);
  assert.match(LOADER, /mat\.SetVector\("_WaterBelow", new Vector4\(Json\.Num\(wbl\[0\]\), Json\.Num\(wbl\[1\]\), Json\.Num\(wbl\[2\]\), Json\.Num\(wbl\[3\]\)\)\)/);
});

test('the port\'s default underside is the web\'s, and the shader reads the material\'s', () => {
  const def = makeMaterial({ color: '#2f8fb0', mode: MODE_WATER }).uniforms.uWaterBelow.value;
  assert.match(SURFACE, new RegExp(`_WaterBelow \\("[^"]*", Vector\\) = \\(${def.x}, ${def.y}, ${def.z}, ${def.w}\\)`));
  assert.match(SURFACE, /float4 _WaterBelow;/, 'in the material\'s buffer');
  assert.match(look, /if \(!front\) \{ ink \*= 0\.75; lit = 1; return lerp\(shallow, _WaterBelow\.rgb, _WaterBelow\.a\); \}/);
  assert.doesNotMatch(look, /0\.96, 0\.98, 0\.97/, 'no fixed pale underside');
  assert.match(WATER_GLSL, /W\.albedo = mix\(shallow, uWaterBelow\.rgb, uWaterBelow\.a\);/);
});

test('the crests fade as the web\'s: in the wind\'s patches, gone far off, before the underside returns', () => {
  const [p0, p1] = WATER_INK.paws, [f0, f1] = WATER_INK.far;
  const fade = look.match(/float paws = smoothstep\(([\d.]+), ([\d.]+), vnoise\(p\.xz \* 0\.018 - wd \* t \* 0\.05\) \* 0\.7 \+ vnoise\(p\.xz \* 0\.05 \+ 9\.0\) \* 0\.3\);\s*ink \*= 0\.75 \* lerp\(([\d.]+), 1\.0, paws\) \* \(1\.0 - smoothstep\(([\d.]+), ([\d.]+), px\)\);/);
  assert.ok(fade, 'the paws and the far fade');
  assert.deepEqual(fade.slice(1).map(Number), [p0, p1, WATER_INK.calm, f0, f1]);
  assert.ok(look.indexOf('float paws') < look.indexOf('if (!front)'), 'the underside\'s crests fade too');
  assert.match(look, /if \(_WaterLite < 0\.5\) ink = max\(ink, waveInk\(p\.xz, t, str, wd, 3\.2, 17\.0\) \* 0\.7\);/, 'one scale of waves on the handheld');
});
