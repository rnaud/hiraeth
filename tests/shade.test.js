import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADE, shadeOf, packShade, unpackShade, makeMaterial, sharedUniforms, MODE_TERRAIN, MODE_STRATA } from '../src/materials.js';
import { PRESETS } from '../src/post.js';
import { GROUND } from '../src/ground-ink.js';

// Shade and hatching by surface (README): each material's shade has its own lift and hue, the light's
// geometry adds a half-tone and the ground's bounce, packed over the hatch strokes for post.js.

test('the shade packs over the strokes and comes back out (lift, hue, strokes)', () => {
  for (const h1 of [0, 0.37, 1]) for (const h2 of [0, 0.5, 1]) for (const lift of [0, 0.2, 0.6, 1]) for (const hue of [-1, 0, 0.45, 1]) {
    const [r, g] = packShade(h1, h2, lift, hue);
    // (the G-buffer is half float: 1/64 steps up to 32, the packed values stay under it)
    assert.ok(r < 32 && g < 32, `packed ${r}, ${g}`);
    const q = (v) => Math.round(v * 64) / 64;
    const [a, b, l, h] = unpackShade(q(r), q(g));
    assert.ok(Math.abs(a - h1) < 0.02 && Math.abs(b - h2) < 0.02, 'the strokes');
    assert.ok(Math.abs(l - lift) <= 0.5 / SHADE.lifts + 1e-9, `lift ${lift} -> ${l}`);
    if (hue < 0) assert.equal(h, -1, "nothing packed: the world's hue");
    else assert.ok(Math.abs(h - hue) <= 0.5 / SHADE.hues + 1e-9, `hue ${hue} -> ${h}`);
  }
  // a pixel written by another shader (strokes 0..1, nothing packed) is the world's default, unlifted
  assert.deepEqual(unpackShade(0.8, 1).slice(2), [0, -1]);
});

test("a material's shade: metal keeps its tones and few strokes, sand few strokes, strata hatched along its beds", () => {
  assert.deepEqual(shadeOf({ color: '#fff' }), [0, -1, 1, 0], 'a plain surface: the world\'s shade, all its strokes');
  const [, hue, hatch] = shadeOf({ metal: 'steel' });
  assert.ok(hue >= 0.5 && hatch < 0.5, 'metal');
  assert.ok(shadeOf({ mode: MODE_TERRAIN, ripples: true })[2] < 1, 'sand');
  assert.equal(shadeOf({ mode: MODE_TERRAIN })[2], 1, 'other ground keeps its hatching');
  assert.ok(shadeOf({ mode: MODE_STRATA })[3] > 0, 'strata rock: strokes along its beds in the light');
  assert.deepEqual(shadeOf({ shade: 0.4, shadeHue: 0.2, hatch: 0, strataHatch: 0 }), [0.4, 0.2, 0, 0], 'a material may say');
  const m = makeMaterial({ color: '#d0c0a0', shade: 0.3, hatch: 0.5, key: 't.shade' });
  assert.deepEqual(m.uniforms.uShade.value.toArray(), [0.3, -1, 0.5, 0]);
  assert.equal(m.uniforms.uHalftone, sharedUniforms.uHalftone, 'the half-tone is the world\'s (shared)');
});

test('every ink preset sets the shade tones (a zone switching presets never keeps the last one\'s)', () => {
  for (const [name, p] of Object.entries(PRESETS)) for (const k of ['uHalftone', 'uBounce', 'uShadeKeep']) assert.ok(k in p, `${name}: ${k}`);
  const print = PRESETS['Moebius print'];
  assert.ok(print.uHalftone > 0 && print.uBounce > 0 && print.uShadeKeep > 0 && print.uShadeKeep < 1, 'the print look shades in three tones');
});

test('the shaders read and write the same packing', async () => {
  const { readFile } = await import('node:fs/promises');
  const post = await readFile(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.ok(post.includes('floor(surface.rg * 0.5)'), 'post.js unpacks before the strokes are read');
  const m = makeMaterial({ color: '#808080', key: 't.shade.frag' });
  assert.ok(m.fragmentShader.includes(`* ${SHADE.lifts}.0 + 0.5`), 'the surface shader packs the lift in SHADE.lifts steps');
});

test('ground marks: rarer ripple patches, few print dots, cracks for bare rock', () => {
  assert.ok(GROUND.ripple.patch[0] >= 0.62, 'ripple patches are rare');
  assert.ok(GROUND.dots.density <= 0.15, 'a few coarse dots, not a screen');
  const rock = makeMaterial({ color: '#d8a8b4', mode: MODE_TERRAIN, pattern: 'cracks', key: 't.rockground' });
  assert.ok(rock.defines.S_CRACKS && rock.fragmentShader.includes('rockFissures('), 'terrain with pattern cracks draws fissures');
});
