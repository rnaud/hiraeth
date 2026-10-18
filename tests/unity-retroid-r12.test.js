// The Unity build's GPU frame on the Retroid, round 12 (issue #456; docs/systems/performance.md, "Unity on the Retroid,
// round 12"): the rock cracks' cell search skipped where nothing is drawn, as the web's rockCracks does (Lorn's far trunks).
// The same picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const common = read('unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl');
const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
const web = read('src/materials.js');
const fn = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf('\n}', i) + 2); };

test('the rock cracks skip their cell search where the web\'s do: in a gap, too far off, or out of the line\'s reach', () => {
  const w = fn(web, 'float rockCracks(vec3 op)').replace(/\n  }\n/, '\n}\n');
  assert.match(w, /if \(gaps \* fade <= 0\.0\) return 0\.0;/);
  assert.match(w, /voronoiBorder\(q, \(0\.45 \* uPixelRatio \+ 0\.6\) \* fwq \* 1\.01\)/);
  const u = fn(common, 'float rockCracks(float3 op)');
  // (the same fade and gaps as the web's, the search only where both are above 0, its reach the web's)
  assert.match(u, /float gaps = smoothstep\(0\.35, 0\.55, vnoise\(q \* 2\.3 \+ 11\.0\)\);/);
  assert.match(u, /float fade = 1\.0 - smoothstep\(0\.08, 0\.2, fwq\);/);
  assert.match(u, /UNITY_BRANCH if \(full \|\| gaps \* fade > 0\.0\)/);
  assert.match(u, /voronoiBorder\(q, full \? 1e9 : \(0\.45 \* _PixelRatio \+ 0\.6\) \* fwq \* 1\.01\)/);
  // (inkLine's reach is the one the bound stands for: 0 from widthPx x the ratio / 2 + 0.6 px)
  assert.match(common, /float inkLine\(float distPx, float widthPx\) \{\n\s+float w = widthPx \* _PixelRatio \* 0\.5;\n\s+return 1\.0 - smoothstep\(w - 0\.6, w \+ 0\.6, distPx\);/);
  // (the bound: half the gap between the two nearest cells (the second capped at 1), as the web's)
  const v = fn(common, 'float voronoiBorder(float2 x, float reach)');
  assert.match(v, /if \(d < md\) \{ md2 = md; md = d; mr = r; mg = g; \}\n\s+else if \(d < md2\) md2 = d;/);
  assert.match(v, /UNITY_BRANCH if \(0\.5 \* \(min\(sqrt\(md2\), 1\.0\) - sqrt\(md\)\) <= reach\)/);
  // (no early return in a branch: HLSLcc's GLSL for Vulkan lost a variable to one)
  for (const f of [u, v]) assert.doesNotMatch(f.split('\n').slice(1, -2).join('\n').replace(/\/\/.*$/gm, ''), /\breturn\b/);
  assert.match(common, /float voronoiBorder\(float2 x\) \{ return voronoiBorder\(x, 1e9\); \}/, 'the water\'s caustics keep the full search');
  assert.match(runner, /SetGlobalFloat\("_MCrackFull", BridgeArgs\.Flag\("-crack-full"\)/);
});
