// The Unity picture gone black (issue #462; docs/systems/engine-bridge.md "A black picture: the renderer made again"):
// URP making its renderer again (Dispose, then Create on the same feature) left the ink feature holding a composite
// material destroyed at the frame's end, and from then on it added no passes; and the NaN guards: one NaN pixel can't
// spread through the glow, the Surface shader writes none where a normal has no length or a pattern's centre is hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const feature = read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs');
const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
const bloom = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Bloom.shader');
const common = read('unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl');
const surface = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');

test('a renderer made again keeps the ink feature drawing: Dispose lets the materials go, the composite made again', () => {
  const dispose = feature.match(/protected override void Dispose\(bool disposing\)\s*\{([\s\S]*?)\n {8}\}/);
  assert.ok(dispose, 'the feature disposes its materials');
  assert.match(dispose[1], /CoreUtils\.Destroy\(compositeMaterial\)/);
  assert.match(dispose[1], /compositeMaterial = bloomMaterial = fxaaMaterial = smaaMaterial = upscaleMaterial = null;/,
    'a destroyed material is still there until the frame ends: Create must not keep it');
  const add = feature.slice(feature.indexOf('public override void AddRenderPasses'));
  const made = add.indexOf('compositeMaterial = CoreUtils.CreateEngineMaterial(compositeShader)'), bail = add.indexOf('if (compositeMaterial == null) return;');
  assert.ok(made > 0 && bail > made, 'AddRenderPasses makes the composite again before it gives up');
  // (the test's switch: the renderer made again once, after the first picture)
  assert.match(runner, /BridgeArgs\.Flag\("-renderer-rebuild"\)[^\n]*rendererDataList\.Length > 0\)\s*\{ rebuilt = true; ua\.rendererDataList\[0\]\.SetDirty\(\); \}/);
});

test('the glow gathers no NaN or infinity: read by the bits, which no compiler folds', () => {
  assert.match(bloom, /all\(\(asuint\(c\) & 0x7fffffffu\) < 0x477de800u\)/);
  assert.doesNotMatch(bloom, /all\(c == c\)/);
  // 0x477de800 is 65000; a NaN or an infinity has every exponent bit set, above it
  const bits = (x) => { const f = new Float32Array([x]); return (new Uint32Array(f.buffer)[0] & 0x7fffffff) >>> 0; };
  assert.equal(bits(65000), 0x477de800);
  for (const x of [0, 1, 0.5, 64999, -3]) assert.ok(bits(x) < 0x477de800, `${x} kept`);
  for (const x of [NaN, Infinity, -Infinity, 65000, 70000]) assert.ok(!(bits(x) < 0x477de800), `${x} left out`);
});

test('atan2 is 0 at (0, 0) in everything the Surface shader includes', () => {
  const macro = common.indexOf('#define atan2(y, x) hiraethAtan2(y, x)');
  assert.ok(macro > 0);
  const code = common.replace(/\/\/.*$/gm, '');
  assert.ok(code.indexOf('atan2(') >= code.indexOf('float hiraethAtan2(float y, float x)'), 'no atan2 before the helper');
  assert.match(common, /float hiraethAtan2\(float y, float x\) \{ return atan2\(y, x \+ step\(abs\(x\) \+ abs\(y\), 0\.0\)\); \}/);
  assert.ok(surface.indexOf('#include "HiraethCommon.hlsl"') < surface.indexOf('#include "Figure.hlsl"'), 'the includes after it');
  // the helper as the GPU works it out, in JS: x moved to 1 only where both are 0
  const step = (e, v) => (v >= e ? 1 : 0), at = (y, x) => Math.atan2(y, x + step(Math.abs(x) + Math.abs(y), 0));
  assert.equal(at(0, 0), 0);
  assert.equal(at(1, 0), Math.PI / 2);
  assert.equal(at(-2, -2), Math.atan2(-2, -2));
});

test('the G-buffer\'s normals have no NaN where a normal has no length', () => {
  assert.match(surface, /float3 n = SafeNormalize\(i\.normal\);/);
  assert.match(surface, /n = SafeNormalize\(cross\(ddx\(rel\), ddy\(rel\)\)\);/);
  // (only the glass's and the veil's discard tests and a ship room's key keep normalize: a cut, or a smoothstep's edge)
  const plain = surface.split('\n').filter((l) => /(?<![A-Za-z])normalize\((i\.normal|i\.objNormal|on|objN)\)/.test(l));
  assert.equal(plain.length, 3);
  assert.ok(plain.every((l) => /discard|float fr = |roomKey/.test(l)), plain.join('\n'));
  assert.doesNotMatch(surface, /\* sign\(det\)\)/, 'a plant flat in one axis keeps its normal');
  for (const w of ['tw', 'pw', 'cw', 'gw']) assert.match(surface, new RegExp(`${w} /= max\\(${w}\\.x \\+ ${w}\\.y \\+ ${w}\\.z, 1e-6\\);`));
});

test('the test switch -surface-debug -1 / -2 writes a NaN made at run time, off by default', () => {
  assert.match(surface, /UNITY_BRANCH if \(_MSurfaceDebug < -0\.5 && all\(fmod\(floor\(i\.positionCS\.xy\), 64\.0\) == 32\.0\)\)/);
  assert.match(surface, /float nan = asfloat\(asuint\(_MSurfaceDebug\) \| 0x7fc00000u\);/);
  assert.match(runner, /SetGlobalFloat\("_MSurfaceDebug", BridgeArgs\.Arg\("-surface-debug"\) is string sdv && int\.TryParse\(sdv, out int sdi\) \? sdi : 0\)/);
});
