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
