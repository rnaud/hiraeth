import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, surfaceDefines, SURFACE_FEATURES, sharedUniforms, MODE_PLAIN, MODE_TERRAIN, MODE_STRATA, MODE_WATER, MODE_OUTFIT, MODE_RIBBON, MODE_EYE } from '../src/materials.js';
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

test('surface shader: only the features a material uses are compiled, the rest is left out', () => {
  const plain = makeMaterial({ color: '#808080', key: 't.spec.plain' });
  assert.equal(plain.defines.SURFACE_SPEC, 1);
  assert.deepEqual(Object.keys(plain.defines).filter((k) => k.startsWith('S_')), []);
  const frag = mainOf(preprocess(plain.fragmentShader, plain.defines));
  for (const call of ['faceInk(', 'eyeball(', 'glyphs(glyphUV', 'rockCracks(', 'facade(', 'biomeWeights(', 'sandRipples(', 'outfitCreases(', 'portraitInk(', 'gridLines(', 'discard']) {
    assert.ok(!frag.includes(call), `a plain surface doesn't compile ${call}`);
  }
  // the shadows, the hatching, the lights are everyone's
  for (const call of ['getShadow(', 'strokes(', 'uLights[i]']) assert.ok(frag.includes(call), call);
  const vert = preprocess(plain.vertexShader, plain.defines);
  assert.ok(!vert.includes('faceRound(position'), 'nor rounds a face');
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
  const D = (o) => Object.keys(surfaceDefines(o)).filter((k) => k !== 'SURFACE_SPEC').sort();
  assert.deepEqual(D({ mode: MODE_TERRAIN, biomes: true, ripples: true, sandInk: true }), ['S_BIOMES', 'S_RIPPLES', 'S_SANDINK', 'S_TERRAIN']);
  assert.deepEqual(D({ mode: MODE_TERRAIN, ticks: true }), ['S_TERRAIN', 'S_TICKS']);
  assert.deepEqual(D({ mode: MODE_OUTFIT, creases: [1] }), ['S_CREASES', 'S_FIGURE']);
  assert.deepEqual(D({ mode: MODE_EYE }), ['S_EYE']);
  assert.deepEqual(D({ mode: MODE_STRATA, flat: true, grid: 0.6, glyphs: true }), ['S_GLYPHS', 'S_GRID', 'S_STRATA']);
  assert.deepEqual(D({ mode: MODE_RIBBON }), ['S_RIBBON']);
  assert.deepEqual(D({ mode: MODE_WATER }), ['S_WATERMODE']);
  assert.deepEqual(D({ pattern: 'cracks' }), ['S_CRACKS']);
  assert.deepEqual(D({ pattern: 'facade' }), ['S_FACADE']);
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
