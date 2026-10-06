import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADE, shadeOf, packShade, unpackShade, makeMaterial, sharedUniforms, MODE_TERRAIN, MODE_STRATA } from '../src/materials.js';
import { PRESETS } from '../src/post.js';
import { GROUND } from '../src/ground-ink.js';

// Shade and hatching by surface (docs/systems/materials.md): each material's shade has its own lift and hue, the light's
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
  assert.deepEqual(unpackShade(0.8, 1).slice(2), [0, -1, -1]);
});

test("a material's own flat print (shadeFlat) packs past the hues and comes back out; it keeps the world's hue", () => {
  for (const h1 of [0, 0.6, 1]) for (const flat of [0, 0.4, 0.85, 1]) {
    const [, hue] = shadeOf({ color: '#fff', shadeFlat: flat });
    assert.equal(hue, 2 + flat, 'shadeOf carries it as 2 + the print');
    const [r, g] = packShade(h1, 0.5, 0.3, hue);
    assert.ok(r < 32 && g < 32, `packed ${r}`);
    const q = (v) => Math.round(v * 64) / 64;
    const [a, , , h, f] = unpackShade(q(r), q(g));
    assert.ok(Math.abs(a - h1) < 0.02, 'the strokes');
    assert.equal(h, -1, "the world's hue");
    assert.ok(Math.abs(f - flat) <= 0.5 / SHADE.flats + 1e-9, `flat ${flat} -> ${f}`);
  }
  // a hue kept says nothing of the print (the world's)
  assert.equal(unpackShade(...packShade(0, 0, 0, 0.5))[4], -1);
  // the shaders agree: the surface packs the print in SHADE.flats steps, post.js reads it past the hues
  const m = makeMaterial({ color: '#d0c0a0', shadeFlat: 0.85, key: 't.shade.flat' });
  assert.equal(m.uniforms.uShade.value.y, 2.85);
  assert.ok(m.fragmentShader.includes(`* ${SHADE.flats}.0 + 0.5`));
});

test('Vael II prints its rock, plain and buildings flat per material, its people and flowers keep their shade', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/levels/arzach2.js', import.meta.url), 'utf8');
  const { SKY_STONES_FLAT, SKY_STONES_LOOK } = await import('../src/levels/arzach2.js');
  assert.ok(SKY_STONES_FLAT > 0.5 && SKY_STONES_FLAT <= 1);
  assert.ok(src.includes('const PRINT = { shadeFlat: SKY_STONES_FLAT }') && (src.match(/\.\.\.PRINT/g) ?? []).length >= 9, 'the terrain, the rock and the buildings');
  assert.ok(!('uShadowFlat' in SKY_STONES_LOOK), 'not the world\'s: its flowers and people keep their own shade');
  assert.ok(SKY_STONES_LOOK.uCumulus === 0 && SKY_STONES_LOOK.uClouds === 0 && SKY_STONES_LOOK.uBounce === 0, 'a clean sky, dark undersides');
});

test("the City-Shaft prints its shade flat in the shaft's blue as its sheets do; its trees say their own and stay green", async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/levels/incal.js', import.meta.url), 'utf8');
  const { SHAFT_LOOK } = await import('../src/levels/reference-shaft.js');
  assert.ok(/look: \{ uHatch: 0\.45, uCumulus: 0, uShadowFlat: 0\.8,/.test(src), "the world prints its shadows flat, as its views already do");
  assert.equal(SHAFT_LOOK.uShadowFlat, 0.8, 'the world and its sheets at the same strength');
  assert.ok(/treeMat = makeMaterial\(\{[^}]*pattern: 'leaves', shadeFlat: 0 \}\)/.test(src), 'the cypresses and olives keep their green');
  // a material's own flat print of 0 is not "nothing said": it overrides the world's uShadowFlat (post.js ownFlat)
  const [, hue] = shadeOf({ color: '#5e7a3a', pattern: 'leaves', shadeFlat: 0 });
  const [, , , h, f] = unpackShade(...packShade(0.3, 0.2, 0, hue));
  assert.equal(f, 0, "the tree's own print, flat: the world's is overridden, not inherited");
  assert.equal(h, -1, "and it keeps the world's hue");
  // nothing said at all stays the world's
  assert.equal(unpackShade(...packShade(0.3, 0.2, 0, shadeOf({ color: '#5e7a3a' })[1]))[4], -1);
  // people never take the world's print (the traveller's coat in shade stays a darker coat, not the shaft's blue);
  // a material's own print still holds
  const post = await readFile(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.match(post, /float flatHere = ownFlat \? shadowFlat : shadowFlat \* \(1\.0 - max\(figure, hero\)\);/);
  assert.match(post, /if \(flatHere > 0\.0 && face < 0\.5\) shadeC = mix\(/);
});

test('rock in strata is hatched down its faces; cross-hatched rings only on upright faces', () => {
  const m = makeMaterial({ color: '#d0c0a0', mode: MODE_STRATA, key: 't.strata.dir' });
  assert.ok(m.fragmentShader.includes(`uMode == ${MODE_STRATA} ? vec2(0.99, 0.14)`), 'strata strokes run down the face');
  assert.ok(/bool rings = [^;]*abs\(n\.y\) < 0\.6/.test(m.fragmentShader), 'no rings under a cap');
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
  assert.ok(post.includes('bool ownFlat = shadeQ.x > ${SHADE.hues + 1}.5'), 'post.js reads a material\'s own flat print past the hues');
  const m = makeMaterial({ color: '#808080', key: 't.shade.frag' });
  assert.ok(m.fragmentShader.includes(`* ${SHADE.lifts}.0 + 0.5`), 'the surface shader packs the lift in SHADE.lifts steps');
});

test('ground marks: rarer ripple patches, few print dots, cracks for bare rock', () => {
  assert.ok(GROUND.ripple.patch[0] >= 0.62, 'ripple patches are rare');
  assert.ok(GROUND.dots.density <= 0.15, 'a few coarse dots, not a screen');
  const rock = makeMaterial({ color: '#d8a8b4', mode: MODE_TERRAIN, pattern: 'cracks', key: 't.rockground' });
  assert.ok(rock.defines.S_CRACKS && rock.fragmentShader.includes('rockFissures('), 'terrain with pattern cracks draws fissures');
});

test('weathered walls: house fronts and old masonry, never metal, glass, lights or the makers\' work', async () => {
  const { weatheredOf, WATER_INK } = { ...(await import('../src/materials.js')), ...(await import('../src/water-shader.js')) };
  assert.equal(weatheredOf({ pattern: 'facade' }), 1, 'a house front');
  assert.equal(weatheredOf({ pattern: 'facade', weathered: 0 }), 0);
  assert.equal(weatheredOf({ mode: MODE_STRATA, weathered: 0.8 }), 0.8);
  for (const o of [{ metal: 'painted', weathered: true }, { glass: true, weathered: true }, { glyphs: true, pattern: 'facade' }, { glow: 1, weathered: true }, { mode: MODE_TERRAIN, weathered: true }])
    assert.equal(weatheredOf(o), 0, JSON.stringify(o));
  const m = makeMaterial({ color: '#e8d0b0', mode: MODE_STRATA, weathered: true, key: 't.weather' });
  assert.ok(m.defines.S_WEATHER && m.fragmentShader.includes('weatherInk('), 'compiled only where asked');
  assert.ok(!makeMaterial({ color: '#e8d0b0', key: 't.noweather' }).defines.S_WEATHER);
  // the water's crests: in patches, gone far off
  assert.ok(WATER_INK.calm < 0.5 && WATER_INK.far[1] < 0.5);
});

test('the City-Shaft pass: flat printed shadows and far haze per look, fewer windows, sand hatched on slip faces, the desert\'s clean sky', async () => {
  const { DESERT_LOOK } = await import('../src/desert-sites.js');
  const { SHAFT_LOOK } = await import('../src/levels/reference-shaft.js');
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.equal(p.uShadowFlat, 0, `${name}: shadows as before unless a look asks`);
    assert.equal(p.uHaze[3], 0, `${name}: the sky's haze unless a look asks`);
  }
  assert.ok(SHAFT_LOOK.uShadowFlat > 0.5 && SHAFT_LOOK.uCumulus === 0, 'the shaft sheets: shade in its own blue, a clean sky');
  assert.ok(DESERT_LOOK.uCumulus === 0 && DESERT_LOOK.uClouds === 0 && DESERT_LOOK.uHaze[3] > 0, 'the desert: no cloud bank, a warm far band');
  assert.equal(makeMaterial({ color: '#eee', pattern: 'facade', key: 't.win' }).uniforms.uWindows.value, 0.78, 'façades keep their windows');
  assert.equal(makeMaterial({ color: '#eee', pattern: 'facade', windows: 0.2, key: 't.win2' }).uniforms.uWindows.value, 0.2);
  assert.ok(SHADE.slip[0] < SHADE.slip[1] && SHADE.slip[1] < 0.42, 'slip faces hatched fully before the ground turns rock');
});

test('spot blacks: a third tier of value, per world (presets) and per material (packed over the drawn detail)', async () => {
  const { SPOT, spotStep } = await import('../src/materials.js');
  for (const [name, p] of Object.entries(PRESETS)) assert.ok(p.uSpot?.length === 4 && p.uSpotTone?.length === 4, `${name}: its spot blacks set (a zone never keeps the last one's)`);
  assert.ok(PRESETS['Moebius print'].uSpot[0] > 0, 'the print look has them');
  assert.equal(spotStep(undefined), 0, "unsaid: the world's");
  assert.equal(spotStep(0), 1);
  assert.equal(spotStep(1), 1 + SPOT.steps);
  assert.equal(makeMaterial({ color: '#fff', glow: 0.5, key: 't.spot.glow' }).uniforms.uSpotStep.value, 1, 'a light never goes black');
  assert.equal(makeMaterial({ color: '#fff', key: 't.spot.plain' }).uniforms.uSpotStep.value, 0);
  const m = makeMaterial({ color: '#808080', spot: 0, key: 't.spot.frag' });
  assert.ok(m.fragmentShader.includes('gHatch.b = detail + 4.0 * uSpotStep'), 'the surface packs its step over the detail');
  const { readFile } = await import('node:fs/promises');
  const post = await readFile(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.ok(post.includes('floor(surface.b * 0.25)'), 'post.js unpacks it before the detail is read');
  assert.ok(/uSpot\.x > 0\.0 && lit < 0\.99[^\n]*face \+ figure \+ hero \+ soft < 0\.5/.test(post), 'only in shade, never on a face, a person, the traveller or grass');
  assert.ok(post.includes('uPostLite > 0.5 ? 4 : 8'), 'half the taps on the handheld');
  const { BURIED_SPOTS } = await import('../src/levels/buried.js');
  assert.ok(BURIED_SPOTS.uSpot[3] > PRESETS['Moebius print'].uSpot[3], 'the Buried Machine prints its cast shadows darker');
});

test('worn by time: grime streaks, chips with the lip\'s shadow, cracks with a shadow side, dust at the foot; per building; lighter on the handheld', async () => {
  const { WEATHER, sharedUniforms: S } = await import('../src/materials.js');
  assert.ok(WEATHER.grime.share > 0.5 && WEATHER.grime.dark > 0.2, 'grime streaks are common and visible');
  assert.ok(WEATHER.chip.lip > 0 && WEATHER.chip.dark > 0.2, 'chips cast a shadow from their lip');
  assert.ok(WEATHER.farTone[0] > WEATHER.far[1], 'the tone marks reach further than the pen marks (no moiré: both fade)');
  assert.ok('uWearLite' in S, 'the handheld\'s lighter wear is shared');
  const m = makeMaterial({ color: '#e8d0b0', weathered: 1, key: 't.wear' });
  const f = m.fragmentShader;
  assert.ok(f.includes('float weatherInk(vec2 q, vec2 fq, vec2 sun2, float litK, float seed, float k, inout vec3 alb)'), 'the sun on the wall makes the shadow sides');
  assert.ok(f.includes('vec2 wqA = vec2(vWorldPos.x, vWorldPos.y), wqB = vec2(vWorldPos.z, vWorldPos.y)'), 'the wall\'s frame from world axes: stable on round walls far from the origin');
  assert.ok(f.includes('floor(vWorldPos.xz / 9.0)'), 'each building its own wear');
  assert.ok(f.includes('if (uWeather > 0.0) gHatch.b += 16.0'), 'a weathered pixel is flagged for post.js');
  const { readFile } = await import('node:fs/promises');
  const post = await readFile(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.ok(post.includes('float wearW = step(15.5, surface.b)') && post.indexOf('wearW = step') < post.indexOf('float spotQ'), 'post.js unpacks the flag before the spot steps');
  // on in every world's plaster, mud and stone buildings
  for (const [file, pat] of [['../src/desert-landmarks.js', /adobe: makeMaterial\(\{[^}]*weathered/], ['../src/levels/bazaar.js', /shop = colors\.map\(c => mat\(c, \{ weathered/], ['../src/levels/home-houses.js', /cream = mat\('#f3ead8', \{ weathered/], ['../src/desert-city.js', /wall: makeMaterial\(\{[^}]*weathered: true/]])
    assert.match(await readFile(new URL(file, import.meta.url), 'utf8'), pat, file);
});

test('faceted normals come from the position measured from the camera (no specks on facets edge-on to the sun far out)', () => {
  const f = makeMaterial({ color: '#e8d0b0', flat: true, key: 't.flatn' }).fragmentShader;
  assert.ok(f.includes('n = normalize(cross(dFdx(vWorldRel), dFdy(vWorldRel)))'));
  assert.ok(!f.includes('cross(dFdx(vWorldPos), dFdy(vWorldPos))'));
  assert.ok(makeMaterial({ color: '#e8d0b0', flat: true, key: 't.flatn' }).vertexShader.includes('vWorldRel = world.xyz - cameraPosition'));
});

test('pen detail at every scale: built seams, rectangles and bolts, organic grain strokes, by distance, never on people or lights', async () => {
  const { DETAIL, detailOf } = await import('../src/materials.js');
  assert.deepEqual(detailOf({ pattern: 'facade' }), [1, 1], 'house fronts: built detail by default');
  assert.deepEqual(detailOf({ color: '#fff' }), [0, 0], 'plain surfaces: none unless asked');
  assert.deepEqual(detailOf({ detail: 'organic', detailDensity: 0.7 }), [2, 0.7], 'bark and stalks: grain');
  assert.deepEqual(detailOf({ metal: 'iron', detail: 'built' }), [1, 1], 'a machine may ask (the Buried Machine)');
  for (const o of [{ figure: true, detail: 'built' }, { glass: true, detail: 'built' }, { glow: 0.5, detail: 'organic' }, { mode: MODE_TERRAIN, detail: 'built' }, { pattern: 'facade', detail: 0 }])
    assert.equal(detailOf(o)[0], 0, JSON.stringify(o));
  assert.ok(DETAIL.lods >= 3 && DETAIL.ink > 1 && DETAIL.ink < 2, 'levels by distance; darker pen lines, packed under 2');
  assert.ok(DETAIL.built.far[0] > DETAIL.built.fine.far[1], 'the fine level fades first');
  const f = makeMaterial({ color: '#e8d0b0', detail: 'built', key: 't.detail.b' }).fragmentShader;
  assert.ok(f.includes('float detailLod(') && f.includes('builtDetail(q / L') && f.includes('grainDetail('), 'the levels by distance');
  assert.ok(f.includes('uWearLite < 0.5'), 'the handheld keeps the coarse level only');
  assert.ok(!makeMaterial({ color: '#e8d0b0', key: 't.detail.none' }).defines.S_DETAIL, 'compiled only where used');
  const { readFile } = await import('node:fs/promises');
  for (const [file, pat] of [['../src/levels/spheres.js', /trunk: makeMaterial\(\{[^}]*detail: 'organic'/], ['../src/levels/perdide2.js', /detail: 'organic'/], ['../src/levels/buried.js', /detail: 'built'/], ['../src/levels/edena.js', /detail: 'organic'/]])
    assert.match(await readFile(new URL(file, import.meta.url), 'utf8'), pat, file);
});
