// Fewer surface programs (docs/systems/performance.md, "Fewer surface programs"): three.js's module patched as Vite
// serves and builds it, so a surface material's program is keyed without its side, its normals or its colours
// (scripts/three-program-keys.mjs). If three.js changes, the patch must fail loudly, not silently stop applying.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { patchThree, threeProgramKeys, THREE_PATCHES } from '../scripts/three-program-keys.mjs';

const threeFile = createRequire(import.meta.url).resolve('three').replace(/three\.cjs$/, 'three.module.js');

test('the installed three.js takes the patch: each change found exactly once', () => {
  const code = readFileSync(threeFile, 'utf8');
  const out = patchThree(code);
  for (const [from, to] of THREE_PATCHES) {
    assert.ok(!out.includes(from), `${from} replaced`);
    assert.ok(out.includes(to), to);
  }
  assert.throws(() => patchThree(code.replace(THREE_PATCHES[0][0], 'doubleSided: false,')), /three\.js changed/);
});

test('the patched key: a material that shares programs keys none of its side, normals or colours; others as before', () => {
  const out = patchThree(readFileSync(threeFile, 'utf8'));
  // (the patched expressions, evaluated as three evaluates them in getParameters)
  const exprs = Object.fromEntries(THREE_PATCHES.map(([, to]) => { const [k, e] = to.replace(/,$/, '').split(/:\s(.+)/); return [k, e]; }));
  const evalAs = (e, material, geometry) => new Function('material', 'geometry', 'DoubleSide', 'BackSide', `return ${e};`)(material, geometry, 2, 1);
  const shared = { side: 2, vertexColors: false, userData: { sharesProgram: true } }, plain = { side: 2, vertexColors: false, userData: {} };
  const geo = { attributes: {} };
  assert.equal(evalAs(exprs.doubleSided, shared, geo), false);
  assert.equal(evalAs(exprs.doubleSided, plain, geo), true);
  assert.equal(evalAs(exprs.flipSided, { ...shared, side: 1 }, geo), false);
  assert.equal(evalAs(exprs.flipSided, { ...plain, side: 1 }, geo), true);
  assert.equal(evalAs(exprs.vertexNormals, shared, geo), true, 'a geometry without normals keys as one with');
  assert.equal(evalAs(exprs.vertexNormals, plain, geo), false);
  assert.equal(evalAs(exprs.vertexColors, shared, geo), true, 'USE_COLOR in every shared program; the material says by uVertexColors');
  assert.equal(evalAs(exprs.vertexColors, plain, geo), false);
  assert.ok(out.length > 100000);
});

test('the Vite plugin patches three\'s module (and keeps it out of the dev server\'s pre-bundling) and nothing else', () => {
  const p = threeProgramKeys();
  assert.deepEqual(p.config().optimizeDeps.exclude, ['three']);
  assert.ok(p.load(threeFile).includes(THREE_PATCHES[0][1]));
  assert.equal(p.load('/x/src/main.js'), null);
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /plugins: \[threeProgramKeys\(\)/);
});

test('the surface shader reads no define the patch leaves out', () => {
  const src = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  for (const d of ['DOUBLE_SIDED', 'FLIP_SIDED', 'HAS_NORMAL']) assert.ok(!src.includes(d), d);
  assert.match(src, /else if \(!gl_FrontFacing\) n = -n;/, 'it turns a back face\'s normal itself');
});
