import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LINE, lineStep, packLight, unpackLight, makeMaterial } from '../src/materials.js';

// The ink pass's per-material and per-world settings (docs/systems/rendering.md, "The G-buffer's layout" and
// "Lines, haze and cast shadows by world").

/** What the half-float G-buffer keeps of a value: 11 significant bits. */
const half = (x) => { if (x === 0) return 0; const step = 2 ** (Math.floor(Math.log2(Math.abs(x))) - 10); return Math.round(x / step) * step; };

test('a line step packs over the light term and comes back out of the half float (the light, the weight, the tint)', () => {
  for (let step = 0; step < 16; step++) for (const L of [0, 0.01, 0.38, 0.49, 0.5, 0.51, 0.9, 1]) {
    const a = packLight(L, step);
    assert.ok(a < 32, `packed ${a}: under 32, 1/64 steps at worst`);
    const [l, w, t] = unpackLight(half(a));
    assert.ok(Math.abs(l - L) <= 1 / 128 + 1e-9, `the light ${L} → ${l} (step ${step})`);
    assert.equal(w, LINE.weights[step % 4]);
    assert.equal(t, Math.floor(step / 4) / (LINE.tints - 1));
    // (the toon threshold's side is kept: post.js tells shade from light by it)
    if (L !== 0.5) assert.equal(l < 0.5, L < 0.5, `L ${L} stays on its side of the threshold`);
  }
  // nothing packed (every material by default, every other shader): the light as it was, the world's ink
  assert.deepEqual(unpackLight(0.73), [0.73, 1, 0]);
  // a material keeps the light term's full precision unless it has a step
  assert.equal(half(packLight(0.4931, 0)), half(0.4931));
});

test("materials say their line: the world's ink unless they say; glass and foliage thin and in their own colour", () => {
  assert.equal(lineStep({ color: '#fff' }), 0);
  assert.equal(lineStep({ color: '#fff', line: 1, lineTint: 0 }), 0);
  assert.equal(lineStep({ color: '#fff', line: 0.45, lineTint: 1 }), 2 + 4 * 3, 'a cloud: thin, its own colour');
  assert.equal(lineStep({ color: '#fff', line: 0.5 }), 2, 'the nearest weight');
  assert.equal(lineStep({ color: '#fff', line: 0.1 }), 3, 'a hairline at the lightest');
  assert.equal(lineStep({ color: '#fff', glass: true }), 2 + 4 * 2);
  assert.equal(lineStep({ color: '#fff', pattern: 'leaves' }), 1 + 4 * 2);
  assert.equal(lineStep({ color: '#fff', pattern: 'leaves', line: 1, lineTint: 0 }), 0, 'a material saying otherwise');
  assert.equal(makeMaterial({ color: '#abcdef', line: 0.45, lineTint: 1 }).uniforms.uLineStep.value, 14);
  assert.equal(makeMaterial({ color: '#abcdef' }).uniforms.uLineStep.value, 0);
});

test('every reader of the light term takes the line step off it', () => {
  const surf = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(surf, /gAlbedoLight = vec4\(albedo, clamp\(L, 0\.0, 1\.0\) \+ 2\.0 \* uLineStep\)/);
  const post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  // the composite: the centre's light and the four shadow-edge taps
  assert.match(post, /A\.a = lightOf\(A\.a\)/);
  for (const k of ['a', 'a1', 'a2', 'a3', 'a4']) assert.match(post, new RegExp(`lightOf\\(${k}\\.a\\)`), `shadow edge tap ${k}`);
  // the water's sparkle (lit or not)
  const water = readFileSync(new URL('../src/water.js', import.meta.url), 'utf8');
  assert.match(water, /la - 2\.0 \* floor\(la \* 0\.5\)/);
  // the line block: the owner's step, its weights and tints from LINE
  assert.match(post, /float lq = floor\(Ao\.a \* 0\.5\)/);
  assert.ok(post.includes('${LINE.alpha') && post.includes('${LINE.far') && post.includes('${LINE.tints - 1}'));
});

test('haze in layers: nothing before the first, then a flat step per layer, each k times farther, capped', async () => {
  const { HAZE, hazeLayers, PRESETS } = await import('../src/post.js');
  const H = [100, 2, 0.2, 3];
  assert.equal(hazeLayers(50, H), 0, 'nearer than a layer before the first');
  assert.equal(hazeLayers(5000, [100, 2, 0.2, 0]), 0, 'no layers: none');
  // flat within a layer, a step at each boundary (100, 200, 400 m), the ramp only just before it
  const one = 1 - 0.8, two = 1 - 0.8 ** 2, three = 1 - 0.8 ** 3;
  for (const [d, v] of [[110, one], [170, one], [230, two], [330, two], [450, three], [9000, three]]) assert.ok(Math.abs(hazeLayers(d, H) - v) < 1e-9, `${d} m → ${hazeLayers(d, H)}`);
  let last = 0;
  for (let d = 1; d < 2000; d *= 1.01) { const v = hazeLayers(d, H); assert.ok(v >= last - 1e-12, 'never thinner farther'); last = v; }
  // continuous (no hard jump: no shimmer at a band's edge as the camera moves)
  for (let d = 60; d < 1000; d *= 1.0005) assert.ok(Math.abs(hazeLayers(d * 1.0005, H) - hazeLayers(d, H)) < 0.03, `smooth at ${d}`);
  assert.ok(HAZE.edge > 0 && HAZE.edge < 0.5);
  for (const [name, p] of Object.entries(PRESETS)) for (const k of ['uHazeLayers', 'uHazeTone', 'uHeightFog', 'uHeightFogTone']) assert.ok(Array.isArray(p[k]) && p[k].length === 4, `${name} says ${k}`);
  for (const p of Object.values(PRESETS)) assert.equal(p.uHazeLayers[3] + p.uHeightFog[3], 0, 'the presets have none: the worlds say theirs');
});

test('fog by height: thicker looking down into it than across or up out of it', async () => {
  const { heightFog } = await import('../src/post.js');
  const F = [0, 120, 0.002, 0.7];
  const down = heightFog(200, -0.8, 500, F), across = heightFog(200, 0, 500, F), up = heightFog(200, 0.8, 500, F);
  assert.ok(down > across && across > up && up >= 0, `${down} ${across} ${up}`);
  assert.ok(down <= 0.7 + 1e-9, 'never more than its most');
  assert.ok(heightFog(-300, 0, 50, F) > heightFog(150, 0, 50, F), 'deeper in the shaft, thicker');
  assert.equal(heightFog(0, -1, 100, [0, 120, 0, 0.7]), 0, 'no density: none');
  assert.ok(Number.isFinite(heightFog(-2000, -1, 4000, F)), 'no overflow far below');
});

test('the worlds and the views say their haze', async () => {
  const { DESERT_LOOK } = await import('../src/desert-sites.js');
  const { DEEP_WOOD_LOOK } = await import('../src/levels/perdide2.js');
  const { MARKET_LOOK } = await import('../src/levels/bazaar.js');
  const { SKY_STONES_LOOK } = await import('../src/levels/arzach2.js');
  const { SHAFT_FOG } = await import('../src/levels/incal.js');
  const { SHAFT_LOOK } = await import('../src/levels/reference-shaft.js');
  const { LORN_LOOK } = await import('../src/levels/reference-lorn.js');
  const { MARKET_VIEW_LOOK } = await import('../src/levels/reference-market.js');
  const { VAEL2_LOOK } = await import('../src/levels/reference-vael2.js');
  for (const [name, look] of Object.entries({ DESERT_LOOK, DEEP_WOOD_LOOK, MARKET_LOOK, SKY_STONES_LOOK, LORN_LOOK, MARKET_VIEW_LOOK, VAEL2_LOOK })) {
    assert.ok(look.uHazeLayers?.[3] > 0 && look.uHazeLayers[1] > 1 && look.uHazeLayers[2] > 0 && look.uHazeLayers[2] < 0.3, `${name}: layers`);
  }
  for (const [name, look] of Object.entries({ DEEP_WOOD_LOOK, SHAFT_FOG, SHAFT_LOOK })) assert.ok(look.uHeightFog?.[2] > 0 && look.uHeightFog[3] > 0, `${name}: fog by height`);
  // the shaft's fog thickens down its pit (its rim at 200 m)
  assert.ok(SHAFT_FOG.uHeightFog[0] < 200);
});
