import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_MODELS, readPublicModel } from './public-model-inputs.js';

test('native picture tests cover every public GLB, including newly added folders', () => {
  const root = fileURLToPath(new URL('../public/', import.meta.url));
  const found = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(e => !e.isDirectory() && e.name.endsWith('.glb'))
    .map(e => (relative(root, e.parentPath) + '/' + e.name).replace(/^\//, '').split('\\').join('/'));
  assert.deepEqual([...PUBLIC_MODELS].sort(), found.sort());
  assert.equal(new Set(PUBLIC_MODELS).size, PUBLIC_MODELS.length);
  for (const name of ['../package.json', '__proto__', 'characters/new/model.glb'])
    assert.throws(() => readPublicModel(name), /Undeclared public model/);
});
