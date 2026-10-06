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

test('cast shadows by world: a cast shadow lifted by how much the world says, form shade and the jump shadow kept', async () => {
  const { CAST, castLift } = await import('../src/post.js');
  const both = [1, 0.5];
  // a cast shadow on open ground (facing the sun and up, shaded): all of it with 1
  assert.ok(Math.abs(castLift(0.6, 1, 0.38, 0, both) - 1) < 1e-9);
  // on a wall (upright): the other amount
  assert.ok(Math.abs(castLift(0.6, 0, 0.38, 0, both) - 0.5) < 1e-9);
  // the low sun of Lorn II (9°): the ground still counts as facing it
  assert.ok(castLift(Math.sin(9 * Math.PI / 180), 1, 0.38, 0, both) > 0.99);
  // form shade (turned from the sun) keeps, so does the terminator's band, the lit side and the jump shadow (light 0)
  assert.equal(castLift(-0.3, 1, 0.35, 0, both), 0);
  assert.equal(castLift(0.0, 1, 0.45, 0, both), 0);
  assert.equal(castLift(0.6, 1, 0.9, 1, both), 0);
  assert.equal(castLift(0.6, 1, 0, 0, both), 0);
  // nothing said: nothing lifted
  assert.equal(castLift(0.6, 1, 0.38, 0, [0, 0]), 0);
  assert.ok(CAST.facing[1] < Math.sin(9 * Math.PI / 180) && CAST.light[1] < 0.38, 'a cast shadow (L 0.38) under the lowest sun counts');
  // the shader: its strokes and its edge line go with it, the light kept as the shade's own test
  const post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.match(post, /lit = max\(lit, castLift\)/);
  assert.match(post, /\* \(1\.0 - castLift\);/);
  assert.match(post, /eI\.w \* 0\.8 \* \(1\.0 - face\) \* \(1\.0 - castPot\)/);
  assert.ok(post.includes('${CAST.facing[0]}') && post.includes('${CAST.ground[0]}') && post.includes('${CAST.light[0]}'));
});

test('the worlds say their cast shadows: Vael II and Lorn II lift them on open ground, the views more, every preset none', async () => {
  const { PRESETS } = await import('../src/post.js');
  for (const [name, p] of Object.entries(PRESETS)) assert.deepEqual(p.uCast, [0, 0], `${name} keeps them`);
  const { SKY_STONES_LOOK } = await import('../src/levels/arzach2.js');
  const { DEEP_WOOD_LOOK } = await import('../src/levels/perdide2.js');
  const { VAEL2_LOOK } = await import('../src/levels/reference-vael2.js');
  const { LORN_LOOK } = await import('../src/levels/reference-lorn.js');
  for (const [name, world, views] of [['Vael II', SKY_STONES_LOOK, VAEL2_LOOK], ['Lorn II', DEEP_WOOD_LOOK, LORN_LOOK]]) {
    assert.ok(world.uCast[0] >= 0.5 && world.uCast[0] <= 1, `${name}: most of a shadow on open ground lifted`);
    assert.ok(views.uCast[0] >= world.uCast[0], `${name}'s panels: as much or more`);
    assert.ok(world.uCast[1] < world.uCast[0] && views.uCast[1] < views.uCast[0], `${name}: walls and things keep more of theirs`);
  }
  // the desert's sheets ink theirs darker (the spot tier), never lifted
  const { DESERT_LOOK } = await import('../src/desert-sites.js');
  assert.equal(DESERT_LOOK.uCast, undefined);
});

test('the desert views all say the dunes\' haze, the first sheet\'s too', async () => {
  const { REFERENCE_VIEWS } = await import('../src/levels/reference-views.js');
  const desert = REFERENCE_VIEWS.filter((v) => /^IMG_377[2-5]$/.test(v.sheet));
  assert.equal(desert.length, 27);
  for (const v of desert) assert.ok(v.look.uHazeLayers?.[3] > 0, `${v.title}: layers`);
});

test('a flat facet edge-on to the sun is shaded whole (no lit specks on the toon threshold)', async () => {
  const { FACET_EDGE } = await import('../src/materials.js');
  assert.ok(FACET_EDGE > 0.01 && FACET_EDGE < 0.1);
  const surf = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(surf, /if \(uFlat > 0\.5 && ndl < \$\{FACET_EDGE\}\) ndl = min\(ndl, -\$\{FACET_EDGE\}\);\n\s*float lambert = ndl/);
});
