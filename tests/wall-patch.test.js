import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, surfaceDefines, patchesOf, PATCH, MODE_STRATA, MODE_TERRAIN } from '../src/materials.js';

test('colour across a wall: on wherever a material has built pen detail, never metal, glass, lights or the makers\' work', () => {
  assert.equal(patchesOf({ color: '#fff', pattern: 'facade' }), 1, 'house fronts (weathered, built detail)');
  assert.equal(patchesOf({ color: '#fff', weathered: 0.5 }), 1);
  assert.equal(patchesOf({ color: '#c8643f', mode: MODE_STRATA, detail: 'built' }), 1, "the Buried Machine's rust");
  assert.equal(patchesOf({ color: '#fff', detail: 'organic' }), 0, 'not bark');
  assert.equal(patchesOf({ color: '#fff' }), 0, 'not a plain material');
  assert.equal(patchesOf({ color: '#fff', weathered: 1, patches: 0 }), 0, 'patches: 0 turns it off');
  assert.equal(patchesOf({ color: '#fff', patches: true }), 1, 'or asked for');
  for (const o of [{ metal: 'steel', detail: 'built' }, { glass: true, patches: 1 }, { glow: 0.8, patches: 1 }, { glyphs: true, detail: 'built' }, { mode: MODE_TERRAIN, patches: 1 }]) {
    assert.equal(surfaceDefines({ color: '#fff', ...o }).S_PATCH, undefined, JSON.stringify(o));
  }
  const m = makeMaterial({ color: '#e9a08a', pattern: 'facade', key: 't.patch.mat' });
  assert.equal(m.defines.S_PATCH, 1);
  assert.equal(m.uniforms.uPatch.value, 1);
});

test('the patches: world boxes (no seam on a round wall), clean edges under the colour-edge threshold, none far off', () => {
  const m = makeMaterial({ color: '#e9a08a', pattern: 'facade', key: 't.patch.src' });
  const f = m.fragmentShader;
  // every layer is constant over boxes of the world: no wall frame, no projection to switch at 45°
  const cells = f.slice(f.indexOf('vec3 patchA('), f.indexOf('vec3 wallPatch('));
  assert.ok(!/wqA|wqB|facingX/.test(cells), 'not in a wall\'s frame');
  assert.ok(cells.includes('floor((p + PATCH_O * PATCH_LB) / PATCH_LB)') && cells.includes('floor(qa.xz / PATCH_LA.xz)'), 'boxes of the world');
  assert.ok(!/for \(/.test(cells), 'no loop');
  // the edge ramps over PATCH.ramp px to the mean of both sides; post.js's colour edges compare pixels about
  // its interior line width apart (at most ~1.7 px × the pixel ratio) and draw from 0.08: the steepest
  // step the ramp makes stays under it
  const maxInteriorWidth = 1.7;
  assert.ok(PATCH.edge * 0.5 * maxInteriorWidth / PATCH.ramp < 0.08, 'no line drawn round a patch');
  assert.ok(/min\(1\.0, \$?[\d.]+ \/ max\(length\(dP\), 1e-5\)\)/.test(f) || f.includes(`min(1.0, ${PATCH.edge} / max(length(dP), 1e-5))`), 'the change is capped at PATCH.edge');
  assert.ok(f.includes(`vViewDepth < ${PATCH.far[1]}.0`), 'far pixels pay nothing');
  // few and big
  assert.ok(PATCH.share <= 0.3 && PATCH.band <= 0.15 && PATCH.cell[0] >= 5 && PATCH.building >= 12);
});
