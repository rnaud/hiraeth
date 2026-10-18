// Issue #264, surfaces B: the Unity bridge's still-water reflections, Lorn's veins, the market's night screens, the Buried
// Machine's moving parts, the splats' growth and the grass parting along his path (docs/systems/engine-bridge.md,
// "Surfaces B"): what crosses the bridge, and the port's copies of the web's numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unityGeometry, OP } from '../engine/unity/pack.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { SPLAT_DROPS } from '../src/splat-decal.js';
import { SLIDE, PUFF_LIFE } from '../src/breathe-shader.js';
import { BRUSH } from '../src/brush.js';
import { LIVE_VECTORS } from '../engine/mirror.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');

const geo = (n, more = {}) => {
  const attributes = { position: { array: new Float32Array(n * 3), itemSize: 3 }, ...more };
  return { attributes, index: null, groups: [] };
};
const header = (buf) => new Uint32Array(buf, 0, 7);

test('a billboard\'s aNight rides in the form\'s slot (NIGHT_PAINT)', () => {
  const night = new Float32Array([1, 0, 1, 0.6, 1, 0, 1, 0.6, 1, 0, 1, 0.6]);
  const buf = unityGeometry(geo(3, { aNight: { array: night, itemSize: 4 } }), { form: true });
  const h = header(buf);
  assert.equal(h[2] & 64, 64, 'the form flag');
  const f = new Float32Array(buf), at = 4 + 3 + 9;   // (the header with one group, then the points)
  assert.deepEqual([...f.subarray(at, at + 4)], [1, 0, 1, 0.6].map(Math.fround));
  assert.equal(portMaterial({ type: 'ink', u: { uMode: 0 }, defines: { NIGHT_PAINT: 1 } }).nightOn, 1);
});

test('a splat: aSplat in the form\'s slot, its inner tone the axis, its phase the uv; only the drawn range', () => {
  const n = 6, S = new Float32Array(n * 4), S2 = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { S.set([i, -i, 2, 5], i * 4); S2.set([0.5 + i, 0.1, 0.2, 0.3], i * 4); }
  const g = geo(n, { aSplat: { array: S, itemSize: 4 }, aSplat2: { array: S2, itemSize: 4 } });
  g.drawRange = { start: 0, count: 3 };
  const buf = unityGeometry(g, { form: true }), h = header(buf);
  assert.equal(h[2] & (64 | 2), 64 | 2, 'the form and uv flags');
  assert.equal(h[5], 3, 'its group: the drawn corners only');
  const f = new Float32Array(buf), uv = 7 + n * 3;
  assert.equal(f[uv], Math.fround(0.5), 'the phase in the uv\'s x');
  const formC = uv + n * 2, formA = formC + n * 4;
  assert.deepEqual([...f.subarray(formC + 4, formC + 8)], [1, -1, 2, 5]);
  assert.deepEqual([...f.subarray(formA, formA + 3)], [0.1, 0.2, 0.3].map(Math.fround));
  const pm = portMaterial({ type: 'ink', u: { uMode: 0, uSplatTime: 3.5 }, defines: {} });
  assert.equal(pm.splatOn, 1); assert.deepEqual(pm.splatClock, [3.5, 0, 0, 0]);
});

test('the port\'s splat drops and growth are the web\'s (splat-decal.js)', () => {
  const m = SURFACE.match(/SPLAT_DROPS\[5\] = \{([^}]+)\}/);
  assert.ok(m, 'Surface.shader SPLAT_DROPS');
  const nums = [...m[1].matchAll(/-?\d+\.\d+/g)].map(Number);
  assert.deepEqual(nums, SPLAT_DROPS.flat().map((x) => +x.toFixed(5)));
  assert.match(SURFACE, /1\.12 - 0\.12 \* min\(1\.0, \(t - 0\.14\) \/ 0\.2\)/);
});

test('the Buried Machine\'s parts: the clock live, the port\'s slide and puff the web\'s numbers', () => {
  assert.ok(LIVE_VECTORS.includes('uBreathe') && LIVE_VECTORS.includes('uVeinBox') && LIVE_VECTORS.includes('uSplatTime'));
  const cs = RENDERER.match(/static readonly string\[\] LiveVectors = \{([^}]+)\}/)[1].match(/"[^"]+"/g);
  assert.equal(cs.length, LIVE_VECTORS.length, 'BridgeRenderer.LiveVectors one for one with mirror.js LIVE_VECTORS');
  assert.deepEqual(cs.slice(-3), ['"_Breathe"', '"_VeinBox"', '"_SplatClock"']);
  const slide = RENDERER.match(/static float BreatheSlide[\s\S]+?return 0f;/)[0];
  for (const x of [SLIDE.out, SLIDE.out + SLIDE.hold, SLIDE.out + SLIDE.hold + SLIDE.back]) assert.ok(slide.includes(`${+x.toFixed(3)}f`), `${x}`);
  assert.ok(RENDERER.includes(`/ ${PUFF_LIFE}f;`), 'PUFF_LIFE');
});

test('a reflection and Lorn\'s veins cross as the port\'s values', () => {
  const m = portMaterial({ type: 'ink', u: { uMode: 3, uMirror: [-0.8, 0.003, 500, 1], uMirrorLake: [190, -120, 99, 65] }, defines: { MIRROR: 1, WATER: 1 } });
  assert.equal(m.mirrorOn, 1); assert.deepEqual(m.mirror, [-0.8, 0.003, 500, 1]); assert.deepEqual(m.mirrorLake, [190, -120, 99, 65]);
  const v = portMaterial({ type: 'ink', u: { uMode: 3, uVeinBox: [1, 2, 0.5, 0.25] }, defines: { WATER: 1, WATER_VEINS: 1 } });
  assert.equal(v.veinOn, 1); assert.deepEqual(v.veinBox, [1, 2, 0.5, 0.25]);
});

test('the grass\'s path: op 28 the brush trail, its samples the port\'s', () => {
  assert.equal(OP.brushTrail, 28);
  assert.match(RENDERER, /new Vector4\[14\]/);
  assert.equal(BRUSH.samples, 14);
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl'), /float4 _BrushTrail\[14\];/);
});
