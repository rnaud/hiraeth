// Pure consumers must not inherit the CLI's arbitrary filesystem and Git reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAst } from 'rolldown/parseAst';
import * as metadata from '../scripts/release-metadata.mjs';
import * as compatibility from '../scripts/release-info.mjs';

test('existing release-info callers retain the identical metadata exports', () => {
  for (const [name, value] of Object.entries(metadata)) assert.equal(compatibility[name], value, name);
});

test('release metadata imports only game changelog data, never release I/O', () => {
  const ast = parseAst(readFileSync(new URL('../scripts/release-metadata.mjs', import.meta.url), 'utf8'));
  const imports = ast.body.filter(n => n.type === 'ImportDeclaration').map(n => n.source.value);
  assert.deepEqual(imports, ['../src/changelog.js']);
});
