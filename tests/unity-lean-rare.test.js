// The lean variants with one rare path kept in the Unity build (issue #404, round 11; docs/systems/performance.md, "Unity on
// the Retroid, round 11"): the scrub's strokes (the City-Shaft's trees, the desert's scrub) and the glass's cut (Underwater's
// domes) on the lean variant with that path alone, not the full one, on Android under Vulkan; the same picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../unity/Hiraeth/Assets/${p}`, import.meta.url), 'utf8');
const shader = read('Hiraeth/Shaders/Surface.shader');
const renderer = read('HiraethJS/Runtime/BridgeRenderer.cs');
const runner = read('HiraethJS/Runtime/BridgeRunner.cs');
const strip = read('HiraethJS/Editor/BridgeShaderStrip.cs');

test('the two variants drop every rare path but their own, and the ground\'s and the water\'s', () => {
  assert.match(shader, /#pragma multi_compile_local _ HIRAETH_LEAN HIRAETH_LEAN_TERRAIN HIRAETH_LEAN_WATER HIRAETH_LEAN_SLIM HIRAETH_LEAN_SCRUB HIRAETH_LEAN_GLASS/);
  for (const k of ['LEANK', 'TERRAINK', 'WATERK']) assert.match(shader, new RegExp(`\\|\\| defined\\(LEAN_ONE\\)\\n\\s+#define ${k} false`));
  assert.match(shader, /#if defined\(HIRAETH_LEAN_SCRUB\)\n\s+#define SCRUBK true\n\s+#else\n\s+#define SCRUBK LEANK/);
  assert.match(shader, /#if defined\(HIRAETH_LEAN_GLASS\)\n\s+#define GLASSK true\n\s+#else\n\s+#define GLASSK LEANK/);
  assert.match(shader, /if \(GLASSK && _Glass > 0\.0 && _MSurfaceDebug < 3\.5\)/);
  assert.match(shader, /UNITY_BRANCH if \(SCRUBK && _Scrub > 0\.0\) \{/);
  // (the prepass discards for the glass alone there: the scrub's variant has no discard, its depth known before the fragment)
  assert.match(shader, /void fragEntry\(DepthVaryings i\) \{ if \(\(GLASSK && \(_Glass > 0\.0 \|\| \(_SeeOn > 0\.5 && _SeeK\.x > 0\.001\)\)\) \|\| \(LEANK && \(_Dissolve\.x > 0\.0 \|\| _Veil > 0\.0 \|\| _SplatOn > 0\.5 \|\| _MirrorOn > 0\.5 \|\| _FallOn > 0\.5 \|\| \(_Mode > 4\.5 && _Mode < 5\.5\)\)\) \|\| BLADEPP\) discard; \}/);
  assert.equal((shader.match(/LEANK && _Scrub|LEANK && _Glass/g) ?? []).length, 0);
});

test('a material gets one only when that is its one rare path, on no ground or water', () => {
  assert.match(renderer, /if \(leanRare && \(why == "scrub" \|\| why == "glass" \|\| why == "see"\) && mode != 1 && mode != 3 && RareCount\(m\) == 1\)/);
  assert.match(renderer, /static int RareCount\(Material m\)/);
  for (const p of ['_Glass', '_Veil', '_Dissolve', '_Fluid', '_TripoFace', '_Veins', '_BoxOn', '_Scrub']) assert.ok(renderer.split('static int RareCount')[1].split(';')[0].includes(p), p);
});

test('on Android under Vulkan only, as the slim variants, with switches to compare', () => {
  assert.match(renderer, /public static bool leanRare =\n#if UNITY_ANDROID && !UNITY_EDITOR\n\s+SystemInfo\.graphicsDeviceType == UnityEngine\.Rendering\.GraphicsDeviceType\.Vulkan;/);
  assert.match(strip, /new ShaderKeyword\(shader, "HIRAETH_LEAN_SCRUB"\)/);
  assert.match(strip, /new ShaderKeyword\(shader, "HIRAETH_LEAN_GLASS"\)/);
  assert.match(strip, /if \(k\.IsEnabled\(a\) \|\| k\.IsEnabled\(b\) \|\| k\.IsEnabled\(c\)\) data\.RemoveAt\(i\);/);
  for (const f of ['-lean-rare', '-no-lean-rare', '-no-lean-scrub', '-no-lean-glass']) assert.ok(runner.includes(`BridgeArgs.Flag("${f}")`), f);
});
