import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUALITY_PRESETS, resolveQuality, detectHandheld } from '../src/perf.js';

const FIELDS = ['label', 'scale', 'dynamic', 'shadow', 'nearExtent', 'nearEvery', 'farEvery', 'taps', 'ao', 'cloudShadows', 'lowDetail', 'crowdFar', 'crowdMid', 'propFar', 'propPx', 'postLite'];

test('every preset is a complete recipe', () => {
  for (const [name, p] of Object.entries(QUALITY_PRESETS)) {
    for (const f of FIELDS) assert.ok(f in p, `${name}.${f}`);
    assert.ok(p.scale > 0.3 && p.scale <= 2, `${name} scale`);
    assert.ok([4, 9].includes(p.taps), `${name} taps`);
    for (const k of ['fine', 'near', 'far']) assert.ok(p.shadow[k] === 0 || [1024, 2048, 4096].includes(p.shadow[k]), `${name} ${k} map`);
    assert.ok(p.shadow.near > 0 && p.shadow.far > 0, `${name} keeps the near and far cascades`);
    assert.ok(p.nearEvery >= 1 && p.farEvery >= 1);
    if (p.dynamic) assert.ok(p.dynamic.min < p.dynamic.max && p.dynamic.low < p.dynamic.high && p.scale >= p.dynamic.min && p.scale <= p.dynamic.max, `${name} dynamic range`);
  }
});

test('the handheld preset is the cheap one: lower resolution held by dynamic resolution, fewer and smaller shadow maps, no AO, fewer people and props, lighter ink', () => {
  const H = QUALITY_PRESETS.handheld, M = QUALITY_PRESETS.medium;
  assert.ok(H.scale < M.scale);
  assert.ok(H.dynamic && H.dynamic.low >= 30 && H.dynamic.high <= 60, 'aims between 30 and 60 fps');
  const maps = (p) => Object.values(p.shadow).filter(Boolean);
  assert.ok(maps(H).length < maps(M).length, 'fewer cascades');
  assert.ok(maps(H).reduce((s, n) => s + n * n, 0) <= maps(M).reduce((s, n) => s + n * n, 0) / 3 + 1, 'a third of the shadow texels');
  assert.ok(H.farEvery > M.farEvery, 'the far cascade refreshes less often');
  assert.equal(H.ao, false);
  assert.equal(H.taps, 4);
  assert.ok(H.crowdFar > 0 && H.crowdFar < 420 && H.crowdMid < 65);
  assert.ok(H.propFar < M.propFar && H.propPx > M.propPx);
  assert.equal(H.postLite, true);
});

test('Auto runs the handheld recipe on a handheld, the full one elsewhere; High is 1.5x unless HiDPI', () => {
  assert.equal(resolveQuality('auto', { handheld: true }).key, 'handheld');
  assert.equal(resolveQuality('auto', { handheld: true }).setting, 'auto');
  assert.equal(resolveQuality('auto', { handheld: false }).key, 'auto');
  assert.equal(resolveQuality('handheld').key, 'handheld');
  assert.equal(resolveQuality('high', { hiDPI: false }).scale, 1.5);
  assert.equal(resolveQuality('high', { hiDPI: true }).scale, 1);
  assert.equal(resolveQuality('nonsense').key, 'medium');
  // resolving never mutates the table
  resolveQuality('high', { hiDPI: true });
  assert.equal(QUALITY_PRESETS.high.scale, 1.5);
});

test('handheld detection: the Android app, mobile and software GPUs', () => {
  assert.equal(detectHandheld({ native: true }), true);
  assert.equal(detectHandheld({ gpu: 'Adreno (TM) 650' }), true);
  assert.equal(detectHandheld({ gpu: 'Mali-G77 MC9' }), true);
  assert.equal(detectHandheld({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }), true);
  assert.equal(detectHandheld({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)' }), false);
  assert.equal(detectHandheld({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)', touch: true }), false);
  assert.equal(detectHandheld({ gpu: 'ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11)', touch: true }), true);
});

test('the settings menu offers every preset', () => {
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const sel = ui.match(/<select data-k="quality">(.*?)<\/select>/)[1];
  const values = [...sel.matchAll(/value="(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(values, Object.keys(QUALITY_PRESETS).sort());
});
