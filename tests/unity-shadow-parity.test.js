// Issue #569: Unity's sun shadows as the web's (src/shadows.js, materials.js sampleShadow): the near map's bias and normal
// offset the web's since its shadow QC (v1.45: Unity kept 2.3 and 3.2 texels, and Home's stepping stones cast next to no
// shadow at dusk), and the taps a tent on the map's texels sliding with the point (a box of taps on a fixed grid printed
// the near map's texels as steps along the Overnight Train's platform wall).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEAR_CASCADE, FINE_CASCADE } from '../src/shadows.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SHADOWS = read('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethShadows.cs');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const WEB = read('src/materials.js');

const cascade = (name) => {
  const m = SHADOWS.match(new RegExp(`Cascade ${name} = new\\(\\) \\{[^}]*biasTexels = ([\\d.]+)f, offsetTexels = ([\\d.]+)f`));
  return { bias: +m[1], offset: +m[2] };
};

test('the near and fine maps\' bias and normal offset, in their texels, are the web\'s', () => {
  assert.deepEqual(cascade('near'), { bias: NEAR_CASCADE.bias, offset: NEAR_CASCADE.offset });
  assert.deepEqual(cascade('fine'), { bias: FINE_CASCADE.bias, offset: FINE_CASCADE.offset });
});

test('the taps are the web\'s tent: the same weights and offsets, 4 or 9 of them', () => {
  // (the arithmetic lines of the web's sampleShadow, as they stand in the port: vec2 → float2)
  const body = (s, from) => s.slice(s.indexOf(from), s.indexOf(from) + 2400);
  const web = body(WEB, 'float sampleShadow(');
  const port = body(SURFACE, 'float mSampleShadow(');
  for (const line of ['uv + 0.5 - base', 'base -= 0.5;', 'w0 = 3.0 - 2.0 * st, w1 = 1.0 + 2.0 * st;', 'o0 = (2.0 - st) / w0 - 1.0, o1 = st / w1 + 1.0;', ') / 16.0;',
    'w0 = 4.0 - 3.0 * st, w2 = 1.0 + 3.0 * st;', 'o0 = (3.0 - 2.0 * st) / w0 - 2.0, o1 = (3.0 + st) / 7.0, o2 = st / w2 + 2.0;', 's / 144.0;']) {
    assert.ok(web.includes(line), `web: ${line}`);
    assert.ok(port.includes(line), `port: ${line}`);
  }
  assert.match(SURFACE, /#define M_SHADOW_TAP\(o\) SAMPLE_TEXTURE2D_SHADOW\(map, smp, float3\(\(uv \+ \(base \+ \(o\) - uv\) \* spread\) \* inv, z\)\)/);
  assert.match(WEB, /return texture\(map, vec3\(\(uv \+ \(base \+ o - uv\) \* spread\) \* inv, z\)\);/);
  assert.equal((port.match(/M_SHADOW_TAP\(float2/g) ?? []).length, 4 + 9);
});
