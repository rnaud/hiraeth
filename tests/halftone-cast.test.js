// The half-tone of a wall turned from the sun is not given where it stands in another's cast shadow
// (materials.js castBeyond, docs/systems/materials.md): one tap of the shadow map toward the sun, on built
// walls only, and only in a look that half-tones at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, MODE_STRATA, HALFTONE_REACH } from '../src/materials.js';

test('a turned wall in another wall\'s cast shadow keeps the full shadow', () => {
  const wall = makeMaterial({ color: '#f1e6cf', flat: true });
  assert.match(wall.fragmentShader, /float castBeyond\(vec3 wp\)/);
  assert.match(wall.fragmentShader, /if \(turned > 0\.0 && uHalftone > 0\.0 && uSunDir\.y > 0\.0 && uMode != 2 && uMode != 1 && abs\(n\.y\) < 0\.5\) turned \*= 1\.0 - castBeyond\(vWorldPos\);/);
  assert.ok(HALFTONE_REACH > 8 && HALFTONE_REACH < 40, 'past a house\'s own body, short of the street across');
  assert.equal(MODE_STRATA, 2, '(the test reads the modes by number)');
});
