// The unit tests run locally before each commit (.githooks/pre-commit), not on GitHub: the deploy only builds and ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the pre-commit hook runs the unit tests and is enabled by npm install', () => {
  const hook = read('.githooks/pre-commit');
  assert.match(hook, /node --test tests\/\*\.test\.js/);
  assert.ok(statSync(new URL('../.githooks/pre-commit', import.meta.url)).mode & 0o111, 'the hook is executable');
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.prepare, /core\.hooksPath \.githooks/);
});

test('no workflow runs the unit tests (they ran before the commit)', () => {
  for (const f of ['cloudflare.yml', 'android.yml']) {
    const yml = read(`.github/workflows/${f}`);
    assert.doesNotMatch(yml, /node --test/, f);
    assert.doesNotMatch(yml, /needs: test\b/, f);
  }
});
