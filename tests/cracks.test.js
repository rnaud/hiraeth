// Cracks down a cliff's face (materials.js `cracks`, docs/systems/materials.md): off by default, on where the
// canyon materials say so, drawn only on strata faces and only when asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { strataMat } from '../src/levels/reference-kit.js';

test('a strata material draws its face cracks only when it asks for them', () => {
  const plain = makeMaterial({ color: '#c97b63', mode: MODE_STRATA, strataSize: 6 });
  assert.equal(plain.uniforms.uCracks.value, 0, 'off by default: the old look');
  const cliff = makeMaterial({ color: '#c97b63', mode: MODE_STRATA, strataSize: 6, cracks: 0.8 });
  assert.equal(cliff.uniforms.uCracks.value, 0.8);
  assert.match(cliff.fragmentShader, /if \(uCracks > 0\.0\) detail = max\(detail, faceCracks\(/, 'gated by the uniform, in the strata branch');
  // the References' canyon material has them
  const kit = { mat: (o) => makeMaterial(o) };
  assert.equal(strataMat(kit, '#d47d4a', '#c56f40', '#e08d58', 6).uniforms.uCracks.value, 0.8);
});
