import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const source = readFileSync(new URL('./register-gadgets.js', import.meta.url), 'utf8');
// This literal directory resource deliberately selects this test for gadget
// additions/deletions, including a newly added file absent from the loader list.
const discovered = readdirSync(new URL('../src/gadgets/', import.meta.url))
  .filter(f => f.endsWith('.js') && f !== 'all.js').sort();

function loaderList(text) {
  const ast = parseAst(text);
  const declarations = ast.body.flatMap(n => n.type === 'VariableDeclaration' ? n.declarations : [])
    .filter(n => n.id.type === 'Identifier' && n.id.name === 'loaders');
  assert.equal(declarations.length, 1, 'one explicit loader list');
  const list = declarations[0].init;
  assert.equal(list.type, 'ArrayExpression');
  const imports = list.elements.map(n => {
    assert.equal(n?.type, 'ArrowFunctionExpression', 'each loader is a lazy literal import');
    assert.equal(n.params.length, 0);
    assert.equal(n.body.type, 'ImportExpression');
    assert.equal(n.body.source.type, 'Literal');
    assert.match(n.body.source.value, /^\.\.\/src\/gadgets\/[^/]+\.js$/);
    return n.body.source;
  });
  const registry = ast.body.filter(n => n.type === 'ImportDeclaration');
  assert.equal(registry.length, 1, 'no eagerly evaluated gadget imports');
  assert.equal(registry[0].source.value, '../src/gadgets/registry.js');
  return { imports, registry: registry[0].source };
}

function requireComplete(names, files) {
  assert.deepEqual(names, files, 'literal imports must match every discovered module in alphabetic order');
}

test('explicit gadget imports cover exactly the automatic discovery directory in its original order', () => {
  const { imports } = loaderList(source);
  requireComplete(imports.map(n => n.value.slice('../src/gadgets/'.length)), discovered);
});

test('the completeness rule rejects newly added, removed, duplicate and reordered modules', () => {
  const names = loaderList(source).imports.map(n => n.value.slice('../src/gadgets/'.length));
  assert.ok(names.length > 2);
  assert.throws(() => requireComplete(names, [...discovered, 'zz-new-gadget.js'].sort()));
  assert.throws(() => requireComplete(names, discovered.slice(1)));
  assert.throws(() => requireComplete([...names, names[0]], discovered));
  assert.throws(() => requireComplete([names[1], names[0], ...names.slice(2)], discovered));
});

test('the actual helper evaluates and registers each module before loading the next, with unchanged default guards', async () => {
  const { imports, registry } = loaderList(source);
  const dir = tempDir('hiraeth-gadget-order-');
  try {
    writeFileSync(join(dir, 'registry.mjs'), `
      export const trace = [], GADGETS = [];
      export function registerGadget(def) { trace.push('register:' + def.id); GADGETS.push(def); }
    `);
    const replacements = [{ node: registry, text: JSON.stringify('./registry.mjs') }];
    const expected = [], accepted = [];
    for (let i = 0; i < imports.length; i++) {
      const id = 'g' + i;
      // Includes absent/null default, missing id, and non-callable create.
      const variant = i % 5;
      const declaration = variant === 0 ? `export default { id: '${id}', create() {} };`
        : variant === 1 ? 'export const utility = true;'
        : variant === 2 ? 'export default null;'
        : variant === 3 ? `export default { id: '${id}', create: true };`
        : 'export default { create() {} };';
      writeFileSync(join(dir, `module-${i}.mjs`), `
        import { trace } from './registry.mjs';
        await Promise.resolve();
        trace.push('evaluate:${id}');
        ${declaration}
      `);
      expected.push('evaluate:' + id);
      if (variant === 0) { expected.push('register:' + id); accepted.push(id); }
      replacements.push({ node: imports[i], text: JSON.stringify(`./module-${i}.mjs`) });
    }
    // Substitute only dependency literals in the actual helper. Its loop and
    // shape predicates execute unchanged; no real gameplay registry is touched.
    let fixture = source;
    for (const { node, text } of replacements.sort((a, b) => b.node.start - a.node.start)) {
      fixture = fixture.slice(0, node.start) + text + fixture.slice(node.end);
    }
    writeFileSync(join(dir, 'helper.mjs'), fixture);
    const actual = await import(pathToFileURL(join(dir, 'helper.mjs')).href);
    const state = await import(pathToFileURL(join(dir, 'registry.mjs')).href);
    assert.deepEqual(state.trace, expected);
    assert.equal(actual.GADGETS, state.GADGETS, 'same exported registry object');
    assert.deepEqual(actual.GADGETS.map(d => d.id), accepted);
  } finally { removeTemp(dir); }
});
