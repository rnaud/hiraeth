// The pre-commit hook runs the tests a commit's changes reach (scripts/affected-tests.mjs); the whole
// suite runs on GitHub, and every deploy waits for it (.github/workflows/tests.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { affectedTests, refsOf, MAX_CHANGED } from '../scripts/affected-tests.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the pre-commit hook runs the reached tests, all of them when asked, and is enabled by npm install', () => {
  const hook = read('.githooks/pre-commit');
  assert.match(hook, /node scripts\/affected-tests\.mjs/);
  assert.match(hook, /set -- tests\/\*\.test\.js/);
  assert.match(hook, /FULL_TESTS/);
  assert.ok(statSync(new URL('../.githooks/pre-commit', import.meta.url)).mode & 0o111, 'the hook is executable');
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.prepare, /core\.hooksPath \.githooks/);
});

test('every deploy waits for the whole unit suite', () => {
  const tests = read('.github/workflows/tests.yml');
  assert.match(tests, /workflow_call:/);
  assert.match(tests, /node --test tests\/\*\.test\.js/);
  for (const [f, job] of [['deploy.yml', 'build'], ['cloudflare.yml', 'deploy'], ['android.yml', 'apk'], ['steam-deck.yml', 'linux']]) {
    const yml = read(`.github/workflows/${f}`);
    assert.match(yml, /\n  tests:\n    uses: \.\/\.github\/workflows\/tests\.yml/, f);
    assert.match(yml, new RegExp(`\\n  ${job}:\\n(    if: [^\\n]*\\n)?    needs: tests\\n`), `${f}: ${job} needs the tests`);
  }
});

// a small repository: a test reaching b.js through a.js, one reading c.json by its path, one naming d.md
const FILES = {
  'tests/a.test.js': "import { a } from '../src/a.js';",
  'tests/c.test.js': "const c = readFileSync(new URL('../src/c.json', import.meta.url));",
  'tests/d.test.js': "const md = 'changelog.md';",
  'tests/e.test.js': "import x from 'node:fs';",
  'src/a.js': "export { b } from './b.js'; const later = () => import('./lazy.js');",
  'src/b.js': 'export const b = 1;',
  'src/lazy.js': 'export default 1;',
};
const opts = { read: (f) => { if (!(f in FILES)) throw new Error(f); return FILES[f]; }, exists: (f) => f in FILES, tests: Object.keys(FILES).filter((f) => f.endsWith('.test.js')) };

test('a change reaches the tests that import it, through other files and lazy imports', () => {
  assert.deepEqual(affectedTests(['src/b.js'], opts), ['tests/a.test.js']);
  assert.deepEqual(affectedTests(['src/lazy.js'], opts), ['tests/a.test.js']);
  assert.deepEqual(affectedTests(['src/c.json'], opts), ['tests/c.test.js'], 'read by a literal path');
  assert.deepEqual(affectedTests(['src/c.json', 'changelog.md'], opts), ['tests/c.test.js', 'tests/d.test.js'], 'named by its path');
  assert.deepEqual(affectedTests(['tests/e.test.js'], opts), ['tests/e.test.js'], 'a changed test runs');
  assert.deepEqual(affectedTests(['src/nobody.js'], opts), [], 'nothing reaches it: GitHub runs it');
  assert.deepEqual(affectedTests(['docs/x.md'], opts), [], 'no code changed');
});

test('shared pieces and large commits run everything', () => {
  for (const f of ['package.json', 'package-lock.json', '.githooks/pre-commit', 'tests/playthrough-agent.js', 'scripts/affected-tests.mjs']) {
    assert.equal(affectedTests([f], opts), 'ALL', f);
  }
  assert.equal(affectedTests(Array.from({ length: MAX_CHANGED + 1 }, (_, i) => `src/f${i}.js`), opts), 'ALL');
});

test('refsOf follows relative imports, re-exports and new URL, not packages', () => {
  assert.deepEqual(refsOf('src/x/y.js', "import a from '../a.js'; export * from './b.js?raw'; import 'three'; new URL('./c.png', import.meta.url)").sort(),
    ['src/a.js', 'src/x/b.js', 'src/x/c.png']);
});

test('the real repository: a change to dev-gate.js reaches the first-run test, and not the whole suite', () => {
  const r = affectedTests(['src/dev-gate.js']);
  assert.ok(Array.isArray(r) && r.includes('tests/first-run.test.js'));
  assert.ok(r.length < 100, `${r.length} tests`);
});
