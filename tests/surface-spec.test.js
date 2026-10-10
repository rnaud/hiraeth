import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, surfaceDefines, surfaceFeatures, SURFACE_FEATURES, SURFACE_SHARED, SURFACE_LIGHT, SURFACE_HEAVY, FACE_KEY_SLOTS, sharedUniforms, MODE_PLAIN, MODE_TERRAIN, MODE_STRATA, MODE_WATER, MODE_OUTFIT, MODE_RIBBON, MODE_EYE } from '../src/materials.js';
import { LAB_MATERIALS } from '../src/levels/lab.js';

// A small GLSL preprocessor: #define, #ifdef, #ifndef, #if defined(A) || defined(B), #else, #endif
// (what the surface shader uses); returns the lines that survive.
function preprocess(src, defines) {
  const d = new Set(Object.keys(defines)), out = [], stack = [];
  const live = () => stack.every((s) => s.on);
  const cond = (e) => e.split('||').some((t) => d.has(t.trim().replace(/^defined\((\w+)\)$/, '$1')));
  for (const raw of src.split('\n')) {
    const l = raw.trim();
    let m;
    if ((m = l.match(/^#ifdef\s+(\w+)/))) stack.push({ on: d.has(m[1]), taken: d.has(m[1]) });
    else if ((m = l.match(/^#ifndef\s+(\w+)/))) stack.push({ on: !d.has(m[1]), taken: !d.has(m[1]) });
    else if ((m = l.match(/^#if\s+(.*)$/))) { const c = cond(m[1]); stack.push({ on: c, taken: c }); }
    else if (l.startsWith('#else')) { const s = stack.at(-1); s.on = !s.taken; }
    else if (l.startsWith('#endif')) assert.ok(stack.pop(), 'an #endif without its #if');
    else if (live()) {
      if ((m = l.match(/^#define\s+(\w+)/))) d.add(m[1]);
      else out.push(raw);
    }
  }
  assert.equal(stack.length, 0, 'every #if is closed');
  return out.join('\n');
}

const mainOf = (s) => s.slice(s.lastIndexOf('void main()'));

test('surface shader: a plain surface compiles none of the heavy features, only the shared ones', () => {
  const plain = makeMaterial({ color: '#808080', key: 't.spec.plain' });
  assert.equal(plain.defines.SURFACE_SPEC, 1);
  const S = Object.keys(plain.defines).filter((k) => k.startsWith('S_')).sort();
  assert.deepEqual(S, [...SURFACE_SHARED, ...SURFACE_LIGHT].filter((k) => k.startsWith('S_')).sort(), 'the shared features, nothing else');
  assert.ok(!SURFACE_HEAVY.some((k) => plain.defines[k]));
  const frag = mainOf(preprocess(plain.fragmentShader, plain.defines));
  for (const call of ['faceInk(', 'eyeball(', 'glyphs(glyphUV', 'facade(', 'biomeWeights(', 'sandRipples(', 'outfitCreases(', 'portraitInk(', 'weatherInk(', 'detailLod(', 'wallPatch(', 'metalAlbedo(']) {
    assert.ok(!frag.includes(call), `a plain surface doesn't compile ${call}`);
  }
  // the shadows, the hatching, the lights are everyone's
  for (const call of ['getShadow(', 'strokes(', 'uLights[i]']) assert.ok(frag.includes(call), call);
  const vert = preprocess(plain.vertexShader, plain.defines);
  assert.ok(!vert.includes('faceRound(position'), 'nor rounds a face');
});

test('surface shader: materials share programs (docs/systems/performance.md, "Fewer surface programs")', () => {
  const D = (o) => surfaceDefines(o);
  // plain ones: one program whatever their cheap options
  const key = (o) => JSON.stringify(D(o));
  const plain = key({ color: '#808080' });
  for (const o of [{ mode: MODE_STRATA }, { grid: 3, plates: true }, { glass: true }, { folds: 2, scrub: true }, { pattern: 'cracks' }, { thin: true }, { veil: 0.5 }, { lampTint: '#ffaa55' }, { mode: MODE_RIBBON }])
    assert.equal(key({ color: '#808080', ...o }), plain, JSON.stringify(o));
  // in one order, whatever order the options came in (three.js keys a program on the defines' order)
  assert.deepEqual(Object.keys(D({ grid: 3, mode: MODE_STRATA })), Object.keys(D({ mode: MODE_STRATA, grid: 3 })));
  assert.deepEqual(Object.keys(D({ grid: 3 })), Object.keys(D({})).sort());
  // a heavy one keeps its own features, plus strata (weathering and inscriptions on rock as on walls)
  const w = D({ pattern: 'facade' });
  assert.ok(w.S_WEATHER && w.S_STRATA && !w.S_GLASS && !w.S_PLATES && !w.S_THIN, 'no light features on a heavy program');
  assert.equal(key({ mode: MODE_STRATA, weathered: true }), key({ weathered: true, detail: 'built' }));
  assert.equal(key({ glyphs: true, mode: MODE_STRATA }), key({ glyphs: true }));
  // the ground's own features are inside the ground's code: every ground compiles one program
  assert.equal(key({ mode: MODE_TERRAIN }), key({ mode: MODE_TERRAIN, biomes: true, ripples: true, sandInk: true, ticks: true }));
  // metals: brushed or not, plated or not, one program; METAL itself is the metals' own (makeMaterial)
  assert.equal(key({ metal: 'steel' }), key({ metal: 'brass', brushed: true, grid: 3, plates: true }));
  assert.ok(!D({ color: '#fff' }).METAL);
  assert.equal(makeMaterial({ metal: 'steel', key: 't.spec.metal' }).defines.METAL, 1);
  // a fluid's trails share it
  assert.equal(key({ fluid: 'glob' }), key({ fluid: 'glob', mode: MODE_RIBBON }));
  // a define of its own: no light features (they would only slow its program); a crowd's attributes: not past D3D's 16
  assert.ok(!D({ crowd: true }).S_THIN && !D({ fluid: 'glob' }).S_GLASS);
  for (const o of [{ crowd: true }, { grass: true }, { perVertex: true }, { sway: 0.01 }, { nightPaint: true }]) assert.equal(makeMaterial({ ...o, key: `t.spec.own.${Object.keys(o)[0]}` }).userData.sharesProgram, false);
  assert.equal(makeMaterial({ color: '#808080', key: 't.spec.shares' }).userData.sharesProgram, true);
  // the shared features' uniforms are every material's (a program keeps the last material's values otherwise)
  const m = makeMaterial({ color: '#808080', key: 't.spec.uniforms' });
  for (const u of ['uMetal', 'uLampTint', 'uVertexColors', 'uThinPx', 'uGrid', 'uPlates', 'uGlass', 'uVeil', 'uFolds', 'uScrub', 'uHasMap', 'uPattern', 'uMode'])
    assert.ok(m.uniforms[u], u);
  assert.equal(m.uniforms.uMetal.value.w, 0); assert.equal(m.uniforms.uLampTint.value.w, 0); assert.equal(m.uniforms.uThinPx.value, 0);
  assert.equal(m.uniforms.uVertexColors.value, 0);
  m.vertexColors = true;
  assert.equal(m.uniforms.uVertexColors.value, 1, 'follows the material');
  m.vertexColors = false;
  assert.equal(m.clone().uniforms.uVertexColors.value, 0);
  assert.equal(m.clone().userData.sharesProgram, true, 'a clone shares too');
  // gated by their uniforms inside
  const src = m.fragmentShader, vsrc = m.vertexShader;
  assert.match(vsrc, /if \(uThinPx > 0\.0 && aThin\.w > 0\.5/);
  assert.match(vsrc, /#elif defined\(USE_COLOR\)\s+if \(uVertexColors > 0\.5\) vInstColor \*= color\.rgb;/);
  assert.match(src, /if \(uMetal\.w > 0\.0\) albedo = metalAlbedo/);
  assert.match(src, /if \(uLampTint\.a > 0\.0\) albedo = mix/);
  assert.match(src, /if \(uMode == \d+\) \{\s*\/\/ \(a uniform branch[^\n]*\n\s*strataC = /);
  // the face keys: one count for every face
  const brows = makeMaterial({ color: '#555', figure: true, facePart: true, faceKeys: 6, key: 't.spec.brows' });
  assert.equal(brows.defines.FACE_KEYS, FACE_KEY_SLOTS);
  assert.equal(brows.uniforms.uKeyW.value.length, FACE_KEY_SLOTS);
});

test('surface shader: without SURFACE_SPEC everything is compiled, as before', () => {
  const m = makeMaterial({ color: '#808080', key: 't.spec.all' });
  const frag = mainOf(preprocess(m.fragmentShader, {}));
  for (const call of ['faceInk(', 'eyeball(', 'glyphs(glyphUV', 'rockCracks(', 'facade(', 'roofTiles(', 'leaves(', 'biomeWeights(', 'sandRipples(', 'mudCracks(', 'grassTicks(', 'sandScuffs(', 'outfitCreases(', 'portraitInk(', 'gridLines(', 'strata(', 'fissures(', 'waterLines(', 'discard']) {
    assert.ok(frag.includes(call), `${call} is there`);
  }
  for (const f of SURFACE_FEATURES) assert.ok(m.fragmentShader.includes(`#define ${f}`), `${f} in the fallback`);
});

test('surface shader: each option turns on its feature, and every feature is guarded somewhere', () => {
  const D = (o) => Object.keys(surfaceFeatures(o)).filter((k) => k !== 'SURFACE_SPEC').sort();
  assert.deepEqual(D({ mode: MODE_TERRAIN, biomes: true, ripples: true, sandInk: true }), ['S_BIOMES', 'S_RIPPLES', 'S_SANDINK', 'S_TERRAIN']);
  assert.deepEqual(D({ mode: MODE_TERRAIN, ticks: true }), ['S_TERRAIN', 'S_TICKS']);
  assert.deepEqual(D({ mode: MODE_OUTFIT, creases: [1] }), ['S_CREASES', 'S_FIGURE']);
  assert.deepEqual(D({ mode: MODE_EYE }), ['S_EYE']);
  assert.deepEqual(D({ mode: MODE_STRATA, flat: true, grid: 0.6, glyphs: true }), ['S_GLYPHS', 'S_GRID', 'S_STRATA']);
  assert.deepEqual(D({ mode: MODE_RIBBON }), ['S_RIBBON']);
  assert.deepEqual(D({ mode: MODE_WATER }), ['S_WATERMODE']);
  assert.deepEqual(D({ pattern: 'cracks' }), ['S_CRACKS']);
  assert.deepEqual(D({ pattern: 'facade' }), ['S_DETAIL', 'S_FACADE', 'S_PATCH', 'S_WEATHER'], 'house fronts are weathered, pen-detailed and patched by default');
  assert.deepEqual(D({ pattern: 'facade', weathered: false }), ['S_FACADE']);
  assert.deepEqual(D({ mode: MODE_STRATA, weathered: true }), ['S_DETAIL', 'S_PATCH', 'S_STRATA', 'S_WEATHER']);
  assert.deepEqual(D({ form: true }), ['S_FORM'], 'hatching that follows the form');
  assert.deepEqual(D({ detail: 'organic' }), ['S_DETAIL'], 'bark, stalks, rock: grain strokes');
  assert.deepEqual(D({ pattern: 'facade', detail: 0 }), ['S_FACADE', 'S_WEATHER'], 'a material may say none');
  assert.deepEqual(D({ mode: MODE_STRATA, weathered: true, glyphs: true }), ['S_GLYPHS', 'S_STRATA'], "the makers' work stays new");
  assert.deepEqual(D({ metal: 'painted', weathered: true }), [], 'metal is never weathered');
  assert.deepEqual(D({ grid: 3, plates: true }), ['S_GRID', 'S_PLATES']);
  assert.deepEqual(D({ pattern: 'nonsense' }), []);
  assert.deepEqual(D({ folds: 4, scrub: true, glass: true }), ['S_FOLDS', 'S_GLASS', 'S_SCRUB']);
  assert.deepEqual(D({ metal: 'steel' }), []);
  assert.deepEqual(D({ metal: 'steel', brushed: true }), ['METAL_BRUSHED']);
  const src = makeMaterial({ color: '#808080', key: 't.spec.src' }).fragmentShader;
  for (const f of SURFACE_FEATURES) assert.ok(src.includes(`#ifdef ${f}`) || src.includes(`defined(${f})`), `${f} guards some code`);
});

test('surface shader: a feature whose uniform is on is always compiled (the Lab\'s samples and the modes)', () => {
  const samples = [...LAB_MATERIALS.map((m) => ({ ...m.o, key: `t.spec.lab.${m.name}` })),
    { mode: MODE_TERRAIN, biomes: true, ripples: true, sandInk: true, ticks: true, key: 't.spec.t' }, { mode: MODE_OUTFIT, creases: true, key: 't.spec.o' },
    { mode: MODE_EYE, key: 't.spec.e' }, { mode: MODE_RIBBON, key: 't.spec.r' }, { mode: MODE_WATER, key: 't.spec.w' }, { glass: true, folds: 3, scrub: true, key: 't.spec.g' }];
  for (const o of samples) {
    const m = makeMaterial(o), u = m.uniforms, d = m.defines;
    const need = {
      S_TERRAIN: u.uMode.value === MODE_TERRAIN, S_STRATA: u.uMode.value === MODE_STRATA, S_FIGURE: u.uMode.value === MODE_OUTFIT, S_EYE: u.uMode.value === MODE_EYE,
      S_RIBBON: u.uMode.value === MODE_RIBBON, S_GLYPHS: u.uGlyphs.value > 0, S_GRID: u.uGrid.value > 0, S_FOLDS: u.uFolds.value > 0, S_SCRUB: u.uScrub.value > 0,
      S_GLASS: u.uGlass.value > 0, S_CREASES: u.uCreases.value > 0, S_MAP: u.uHasMap.value > 0, S_BIOMES: u.uBiomes.value > 0, S_RIPPLES: u.uRipples.value > 0,
      S_TICKS: u.uTicks.value > 0, S_SANDINK: u.uSandInk.value > 0, [[null, 'S_FACADE', 'S_TILES', 'S_LEAVES', 'S_CRACKS'][u.uPattern.value]]: u.uPattern.value > 0,
      S_WEATHER: u.uWeather.value > 0, S_PLATES: u.uPlates.value > 0,
      WATER: u.uMode.value === MODE_WATER, METAL_BRUSHED: !!(u.uMetal && u.uMetal.value.y > 0),
    };
    for (const [k, on] of Object.entries(need)) if (on) assert.ok(d[k], `${o.key}: ${k}`);
    assert.ok(u.uMode.value !== MODE_PLAIN || !d.S_TERRAIN);
  }
});

test('local lights: the shader looks only at the lit slots, which main.js packs first and counts', () => {
  assert.equal(sharedUniforms.uLightCount.value, 0);
  const m = makeMaterial({ color: '#808080', key: 't.spec.lights' });
  assert.equal(m.uniforms.uLightCount, sharedUniforms.uLightCount);
  assert.ok(/for \(int i = 0; i < 8; i\+\+\) \{\s*if \(i >= uLightCount\) break;/.test(m.fragmentShader));
});
