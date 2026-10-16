// The Unity build's spatial upscalers (issue #392; docs/systems/performance.md, "Unity on the Retroid, round 8"): the
// picture made at the render scale taken to the screen by FSR 1 (EASU, then RCAS) or Snapdragon GSR 1 in our own pass,
// the HUD drawn after it at the screen's size; the switches (-upscale, -sharpness, -ink-full, -render-scale); URP's own
// final blit by default; the licences kept with the shaders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const feature = read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs');
const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
const shader = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Upscale.shader');
const sgsr = read('unity/Hiraeth/Assets/Hiraeth/Shaders/SGSR1.hlsl');

test('the switches: -upscale fsr|sgsr|linear|off, -sharpness, -ink-full, URP\'s own filters as urp-*', () => {
  assert.match(feature, /public enum Upscaler \{ Urp, Fsr, Sgsr, Linear \}/);
  assert.match(feature, /"off" or "urp" => Upscaler\.Urp,/);
  assert.match(feature, /"fsr" or "fsr1" => Upscaler\.Fsr,/);
  assert.match(feature, /"sgsr" or "sgsr1" => Upscaler\.Sgsr,/);
  assert.match(feature, /"linear" => Upscaler\.Linear,/);
  assert.match(feature, /_ => null,/, 'an unknown name changes nothing');
  assert.match(runner, /ApplyUpscale\(urp, BridgeArgs\.Arg\("-upscale"\), BridgeArgs\.Arg\("-sharpness"\), BridgeArgs\.Flag\("-ink-full"\), BridgeArgs\.Arg\("-ink-weight"\)\)/);
  assert.match(runner, /up\.StartsWith\("urp-"\)/);
  assert.match(runner, /Settings\.sharpness = Mathf\.Clamp01\(sv\)/);
  // (-ink-full: the G-buffer at the render scale, the rest at the screen's: URP's own scale back to 1, nothing to upscale)
  assert.match(runner, /Settings\.gbufferScale = urp\.renderScale;\n\s+urp\.renderScale = 1f;\n\s+S = Hiraeth\.Rendering\.HiraethFeature\.Upscaler\.Urp;/);
  assert.match(runner, /BridgeArgs\.Arg\("-render-scale"\) is string rs/);
});

test('URP\'s own final blit by default on every platform: no upscaler chosen unless asked', () => {
  assert.match(feature, /public static Upscaler upscaler = Upscaler\.Urp;/);
  assert.match(feature, /public static float gbufferScale = 1f;/);
  assert.match(feature, /if \(Settings\.upscaler != Upscaler\.Urp\)\n\s+\{/, 'the pass enqueued only when asked');
  // (Android's Handheld still draws at 0.75 of the screen)
  assert.match(runner, /else if \(urp != null\) urp\.renderScale = BridgeArgs\.Quality == "handheld" \? 0\.75f : 1f;/);
});

test('the upscale pass: FSR as EASU then RCAS (none at sharpness 0), SGSR in one pass, the HUD after it, no URP blit', () => {
  const p = feature.slice(feature.indexOf('class UpscalePass'));
  assert.match(feature, /upscale = new UpscalePass \{ renderPassEvent = RenderPassEvent\.AfterRenderingPostProcessing \};/);
  assert.match(p, /if \(u == Upscaler\.Fsr && Settings\.sharpness > 0\)/);
  assert.match(p, /Blit\(rg, "Hiraeth FSR EASU", src, mid, 0, inSize, outSize, 0, 0\);\n\s+Blit\(rg, "Hiraeth FSR RCAS", mid, dst, 1, outSize, outSize, flip, 1\);/);
  assert.match(p, /public static int PassOf\(Upscaler u\) => u == Upscaler\.Fsr \? 0 : u == Upscaler\.Sgsr \? 2 : 3;/);
  assert.match(p, /FSRUtils\.SetEasuConstants\(ctx\.cmd, x\.inSize, x\.inSize/);
  assert.match(p, /FSRUtils\.SetRcasConstantsLinear\(ctx\.cmd, x\.sharp\)/);
  assert.match(p, /DrawUi\(rg, frame, dst, window\);\n\s+res\.SwitchActiveTexturesToBackbuffer\(\);/, 'the HUD at the screen\'s size, then URP adds no blit');
  assert.match(p, /new FilteringSettings\(RenderQueueRange\.transparent, 1 << Settings\.UiLayer\)/);
  // (the HUD leaves URP's transparent pass only while our upscaler is on, and the asset is put back on quitting)
  assert.match(runner, /HiraethFeature\.UiAfterUpscale\(urp, S != Hiraeth\.Rendering\.HiraethFeature\.Upscaler\.Urp\);/);
  assert.match(feature, /int want = on \? uiMaskWas & ~\(1 << Settings\.UiLayer\) : uiMaskWas;/);
  assert.match(feature, /Application\.quitting \+= \(\) =>/);
});

test('the shader: AMD\'s FSR 1 from the core package, Qualcomm\'s SGSR 1 with its BSD-3 notice, both in gamma 2.0', () => {
  for (const pass of ['EASU', 'RCAS', 'SGSR', 'Linear']) assert.match(shader, new RegExp(`Name "${pass}"`));
  assert.match(shader, /#include "Packages\/com\.unity\.render-pipelines\.core\/Runtime\/PostProcessing\/Shaders\/FSRCommon\.hlsl"/);
  assert.match(shader, /#define FastTonemap\(c\) sqrt\(max\(c, 0\.0\)\)/, 'EASU\'s gathers to gamma 2.0');
  assert.match(shader, /return float4\(c \* c, 1\.0\);/, 'and back to linear');
  assert.match(sgsr, /Copyright \(c\) 2023, Qualcomm Innovation Center, Inc\. All rights reserved\./);
  assert.match(sgsr, /SPDX-License-Identifier: BSD-3-Clause/);
  assert.match(sgsr, /Redistributions of source code must retain the above copyright notice/);
  assert.match(sgsr, /#define EdgeThreshold 8\.0\/255\.0/);
  assert.match(sgsr, /half4 SGSRGamma\(half4 v\) \{ return sqrt\(max\(v, half4\(0, 0, 0, 0\)\)\); \}/);
  // (the shader in the build: found by name at run time)
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Editor/Batch.cs'), /"Hidden\/Hiraeth\/Upscale"/);
  const guid = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Upscale.shader.meta').match(/guid: (\w+)/)[1];
  assert.match(read('unity/Hiraeth/ProjectSettings/GraphicsSettings.asset'), new RegExp(`guid: ${guid}, type: 3`));
});

test('placement (a): the G-buffer and the glow at gbufferScale, the composite\'s lines at the page\'s pixels', () => {
  assert.match(feature, /var gs = GSize\(desc\.width, desc\.height\); desc\.width = gs\.x; desc\.height = gs\.y;/);
  assert.match(feature, /ddesc\.width = gs\.x; ddesc\.height = gs\.y;/);
  assert.match(feature, /new TextureDesc\(Mathf\.Max\(1, \(GW \+ 3\) \/ 4\), Mathf\.Max\(1, \(GH \+ 3\) \/ 4\)\)/);
  assert.match(feature, /if \(s >= 0\.999f \|\| s <= 0\) return new Vector2Int\(w, h\);/);
});
