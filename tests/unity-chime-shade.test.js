// Issue #264: the patch of shade under each chime crystal (src/chimes.js blobMaterial) had no Unity port and fell back to
// a Surface (a dark disc). It goes as the port's `chimeshade` to Hiraeth/ChimeShade: the page's G-buffer decal, the
// albedo blended toward its tint by its strength (the instance's in its colour's red), the light term in alpha kept,
// normals and the marks left alone, faded out by uFar; on the GPU instances, with no discard and in no depth prepass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial, unmappedKey } from '../engine/unity/port-format.js';
import { blobMaterial, BLOB } from '../src/chimes.js';
import { SEQUENCES } from '../engine/sequences.js';

THREE.ColorManagement.enabled = false;
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SHADER = read('unity/Hiraeth/Assets/Hiraeth/Shaders/ChimeShade.shader');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');

test('the chimes\' shade goes as its own port, with the page\'s numbers', () => {
  const spec = inkSpec(blobMaterial());
  assert.equal(unmappedKey(spec), 'shader:uCore,uDark,uFar,uTint', 'the key bridge-gaps named');
  const e = portMaterial(spec, 7);
  assert.equal(e.port, 'chimeshade');
  const t = new THREE.Color(BLOB.tint);
  assert.deepEqual(e.tint, [t.r, t.g, t.b].map((x) => +x.toFixed(5)));
  assert.equal(e.dark, BLOB.dark); assert.equal(e.core, BLOB.core); assert.equal(e.far, BLOB.far);
  assert.match(RENDERER, /m\.S\("port"\) == "chimeshade"[\s\S]{0,400}Shader\.Find\("Hiraeth\/ChimeShade"\)[\s\S]{0,500}"_Dark"[\s\S]{0,80}"_Core"[\s\S]{0,80}"_Far"/);
  // (the list a build keeps, since #500 RuntimeShaders.Names, the player checking each at its start)
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Runtime/RuntimeShaders.cs'), /"Hiraeth\/ChimeShade"/, 'kept in a build (Shader.Find)');
});

test('the shader is the page\'s decal: the albedo blended by its strength, the light term and the other targets kept', () => {
  const web = blobMaterial().fragmentShader;
  assert.match(web, /float s = \(1\.0 - smoothstep\(uCore, 1\.0, r\)\) \* vK \* uDark;/);
  assert.match(SHADER, /\(1\.0 - smoothstep\(_Core, 1\.0, r\)\) \* i\.spot\.z \* _Dark/);
  assert.match(blobMaterial().vertexShader, /vK \*= 1\.0 - smoothstep\(uFar \* 0\.6, uFar, -mv\.z\);/);
  assert.match(SHADER, /k \*= 1\.0 - smoothstep\(_Far \* 0\.6, _Far, -TransformWorldToView\(w\)\.z\);/);
  // three's CustomBlending: SrcAlpha / OneMinusSrcAlpha on colour, the alpha kept (Zero / One)
  const m = blobMaterial();
  assert.equal(m.blendSrc, THREE.SrcAlphaFactor); assert.equal(m.blendDst, THREE.OneMinusSrcAlphaFactor);
  assert.equal(m.blendSrcAlpha, THREE.ZeroFactor); assert.equal(m.blendDstAlpha, THREE.OneFactor);
  assert.match(SHADER, /Blend 0 SrcAlpha OneMinusSrcAlpha, Zero One\s+Blend 1 Zero One\s+Blend 2 Zero One/);
  assert.match(SHADER, /ZWrite Off/); assert.match(SHADER, /Offset -3, -3/); assert.match(SHADER, /Cull Off/);
  assert.match(SHADER, /k = mi\.col\.r;/, 'the strength from the instance\'s tint, as instanceColor.r');
});

test('no discard, no depth or shadow pass: a pixel outside the disc blends by nothing', () => {
  assert.doesNotMatch(SHADER.replace(/\/\/[^\n]*/g, ''), /\bdiscard\b/);
  assert.equal((SHADER.match(/\bPass\b/g) ?? []).length, 1);
  assert.match(SHADER, /"LightMode" = "HiraethGBuffer"/);
  assert.match(SHADER, /#pragma multi_compile_local _ HIRAETH_INSTMAT/, 'two programs: the instances\' and a plain mesh\'s');
});

test('a sequence beat sees the crystals at rest with their shade (foes: chimes-rest)', () => {
  const foes = SEQUENCES.find((s) => s.id === 'foes');
  const i = foes.beats.findIndex((b) => b.name === 'chimes');
  assert.equal(foes.beats[i + 1]?.name, 'chimes-rest');
});
