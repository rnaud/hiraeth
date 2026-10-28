// Issue #725 (after #716): on the AYN Odin 3 (a portrait panel shown in landscape, Vulkan's swap-chain pre-transform on)
// Unity at render scale 1 drew the world on its side under an upright HUD. URP's own blit and anything drawn with the
// camera's matrices are turned for the display by Unity; our full-screen triangles written straight into the back buffer
// (the ink composite, the water's pass over it, FXAA; the upscale since #716) must turn themselves
// (ApplyPretransformRotation), and what reads the picture's pixel from SV_Position (the composite's weather streaks,
// GAt's depth read for what is laid over the page) must turn the panel's pixel back. On a screen with no pre-rotation
// the constant is 0 and every branch is skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const DIR = 'unity/Hiraeth/Assets/Hiraeth/Shaders/';
const ROTATE = /if \(_TargetFlip > 0\.5\) o\.pos\.y = -o\.pos\.y;[^\n]*\n(\s*\/\/[^\n]*\n)*\s*#ifdef UNITY_PRETRANSFORM_TO_DISPLAY_ORIENTATION\s+o\.pos = ApplyPretransformRotation\(o\.pos\);\s+#endif/;

test('every full-screen pass that can write a player\'s back buffer turns its triangle with the display', () => {
  assert.match(read('unity/Hiraeth/ProjectSettings/ProjectSettings.asset'), /vulkanEnablePreTransform: 1/);
  // (the ones with _TargetFlip are exactly those HiraethFeature lets write the back buffer; Bloom only ever writes textures)
  const fullScreen = readdirSync(new URL(`../${DIR}`, import.meta.url))
    .filter((f) => f.endsWith('.shader') && /SV_VertexID/.test(read(DIR + f)) && /o\.pos = float4\(uv \* 2\.0 - 1\.0/.test(read(DIR + f)));
  const toScreen = fullScreen.filter((f) => /_TargetFlip/.test(read(DIR + f))).sort();
  assert.deepEqual(toScreen, ['Composite.shader', 'FXAA.shader', 'Upscale.shader', 'WaterOver.shader']);
  for (const f of toScreen) assert.match(read(DIR + f), ROTATE, `${f}: the rotation after the flip`);
  assert.deepEqual(fullScreen.filter((f) => !toScreen.includes(f)), ['Bloom.shader'], 'only the glow is left unturned');
  const feature = read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs');
  const glow = feature.slice(feature.indexOf('TextureHandle Blur('), feature.indexOf('public override void RecordRenderGraph', feature.indexOf('TextureHandle Blur(')));
  assert.doesNotMatch(glow, /backBuffer|activeColorTexture/, 'the glow writes its own textures');
  // (SMAA never into the back buffer; URP's Blitter turns itself)
  assert.match(feature, /var useSmaa = smaa != null && !ToScreen\(res, cam\);/);
});

test('the composite\'s weather streaks keep the picture\'s pixel on a rotated back buffer (unchanged elsewhere)', () => {
  const c = read(`${DIR}Composite.shader`);
  assert.match(c, /float2 fc = i\.pos\.xy \/ _PixelRatio;\n(\s*\/\/[^\n]*\n|\s*#ifdef UNITY_PRETRANSFORM_TO_DISPLAY_ORIENTATION\n)+\s*if \(UNITY_DISPLAY_ORIENTATION_PRETRANSFORM != UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_0\)\n\s*fc = float2\(uv\.x, _TargetFlip > 0\.5 \? 1\.0 - uv\.y : uv\.y\) \* _Res\.xy \/ _PixelRatio;\n\s*#endif/);
  // (the crease shading's quad mean takes the panel's own pixel and derivatives together: left as it is)
  assert.match(c, /creaseOcc = quadMean\(creaseOcc, i\.pos\.xy\);/);
});

// The back buffer's pixel from the shader's clip position, as the game's own flips fix it on an unrotated screen: the
// composite writes G-buffer row uv.y·h at clip y = 2·uv.y − 1 into the back buffer (_TargetFlip), and GAt reads that row
// as h − 1 − SV_Position.y (_GFlip): so SV_Position.y = (1 − y) / 2 · h.
const pixelOf = ([x, y], [w, h]) => [(x + 1) / 2 * w, (1 - y) / 2 * h];
// URP's ApplyPretransformRotation (core ShaderLibrary/API/Vulkan.hlsl)
const rotate = ([x, y], o) => (o === 1 ? [y, -x] : o === 2 ? [-x, -y] : o === 3 ? [-y, x] : [x, y]);
// GAt.hlsl's turn back, line for line
function gatBack([qx, qy], o, L) {
  if (o === 0) return [qx, qy];
  const half = o === 2;
  const P = half ? L : [L[1], L[0]];
  const n = [qx / P[0], qy / P[1]];
  const l = half ? [1 - n[0], 1 - n[1]] : o === 1 ? [n[1], 1 - n[0]] : [1 - n[1], n[0]];
  return [l[0] * L[0], l[1] * L[1]];
}

test('GAt turns the panel\'s pixel back to the picture\'s, for each pre-rotation', () => {
  const g = read(`${DIR}GAt.hlsl`);
  assert.match(g, /#ifdef UNITY_PRETRANSFORM_TO_DISPLAY_ORIENTATION\n[\s\S]*if \(UNITY_DISPLAY_ORIENTATION_PRETRANSFORM != UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_0\)/);
  assert.match(g, /float2 n = q \/ \(halfTurn \? L : L\.yx\);/);
  assert.match(g, /q = \(halfTurn \? 1\.0 - n : UNITY_DISPLAY_ORIENTATION_PRETRANSFORM == UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_90 \? float2\(n\.y, 1\.0 - n\.x\) : float2\(1\.0 - n\.y, n\.x\)\) \* L;/);
  const L = [1920, 1080];
  for (const o of [0, 1, 2, 3]) {
    const P = o === 1 || o === 3 ? [L[1], L[0]] : L;   // (the panel's own size)
    for (const [x, y] of [[0.5, 0.5], [100.5, 900.5], [1919.5, 0.5], [960.5, 540.5], [1500.5, 1079.5]]) {
      const clip = [x / L[0] * 2 - 1, 1 - y / L[1] * 2];   // (the picture's pixel's clip position)
      const panel = pixelOf(rotate(clip, o), P);
      const back = gatBack(panel, o, L);
      assert.ok(Math.abs(back[0] - x) < 1e-6 && Math.abs(back[1] - y) < 1e-6, `rotation ${o}: (${x}, ${y}) came back as (${back})`);
    }
  }
});
