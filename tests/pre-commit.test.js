// The pre-commit hook runs the tests a commit's changes reach (scripts/affected-tests.mjs); the whole
// suite runs on GitHub once per push to main, and every deploy waits for it to pass (.github/workflows/tests.yml).
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

// A GitHub Actions expression (`${{ … }}`) as JavaScript: enough of the language for these workflows
// (==, !=, &&, ||, !, strings, format(), property paths that are null when missing, as on GitHub).
const evalExpr = (expr, github) => {
  const js = expr
    .replace(/\bgithub((?:\.[A-Za-z_]+)+)/g, (_, path) => `github${path.replace(/\./g, '?.')}`)
    .replace(/==/g, '===').replace(/!===/g, '!==');
  const format = (f, ...a) => f.replace(/\{(\d+)\}/g, (_, i) => a[i]);
  return new Function('github', 'format', `return (${js});`)(github, format);
};
// a workflow value: one expression (its value), or a string with expressions in it (as text)
const evalValue = (value, github) => {
  const whole = value.split('${{').length === 2 && /^\$\{\{ (.*) \}\}$/.exec(value);
  return whole ? evalExpr(whole[1], github) : value.replace(/\$\{\{ (.*?) \}\}/g, (_, e) => String(evalExpr(e, github)));
};

// The events a deploy workflow can see: Tests finishing (a push to main passed or failed, a pull request from a
// fork whose branch is named main, a run by hand, another repository) and a run by hand of the deploy itself.
const REPO = 'rnaud/hiraeth';
const run = (o) => ({ event_name: 'workflow_run', ref: 'refs/heads/main', sha: 'tip', repository: REPO, run_id: 7,
  event: { workflow_run: { conclusion: 'success', event: 'push', head_branch: 'main', head_sha: 'tested', head_repository: { full_name: REPO }, ...o } } });
const EVENTS = {
  passed: [run({}), true],
  failed: [run({ conclusion: 'failure' }), false],
  cancelled: [run({ conclusion: 'cancelled' }), false],
  'a fork’s pull request from its main': [run({ event: 'pull_request', head_repository: { full_name: 'someone/hiraeth' } }), false],
  'Tests run by hand': [run({ event: 'workflow_dispatch' }), false],
  'another repository’s push': [run({ head_repository: { full_name: 'someone/hiraeth' } }), false],
};
const DISPATCH = { event_name: 'workflow_dispatch', ref: 'refs/heads/main', sha: 'dispatched', repository: REPO, run_id: 8, event: {} };

test('the whole unit suite runs once per push, and every deploy waits for it to pass', () => {
  const tests = read('.github/workflows/tests.yml');
  assert.match(tests, /^name: Tests\n/, 'the name the deploys wait for (workflow_run: workflows: [Tests])');
  assert.match(tests, /\non:\n  push:\n    branches: \[main\]\n  pull_request:\n  workflow_dispatch:\n  workflow_call:\n/, 'on every push to main (and pull requests, by hand, and called by xbox.yml)');
  // pushes to main one at a time and never cancelled (so they finish in push order); a pull request's newer push cancels its older run
  const group = /\nconcurrency:\n  group: (.*)\n/.exec(tests)[1];
  const cancel = /\n  cancel-in-progress: (.*)\n/.exec(tests)[1];
  const ctx = (workflow, event_name, ref) => ({ workflow, event_name, ref });
  assert.equal(evalValue(cancel, ctx('Tests', 'push', 'refs/heads/main')), false);
  assert.equal(evalValue(cancel, ctx('Tests', 'pull_request', 'refs/pull/3/merge')), true);
  assert.notEqual(evalValue(group, ctx('Tests', 'push', 'refs/heads/main')), evalValue(group, ctx('Xbox release (Developer Mode)', 'push', 'refs/heads/main')),
    'xbox.yml’s call never queues with (or replaces) the push runs');
  // the suite in shards, run at once (scripts/test-shards.mjs: together they are every test file, tests/test-shards.test.js)
  const n = /\n {8}shard: \[([\d, ]+)\]\n/.exec(tests);
  assert.ok(n, 'a matrix of shards');
  const shards = n[1].split(',').map(Number);
  assert.deepEqual(shards, shards.map((_, i) => i + 1), 'numbered from 1');
  assert.match(tests, new RegExp(`node --test \\$\\(node scripts/test-shards\\.mjs \\$\\{\\{ matrix\\.shard \\}\\}/${shards.length}\\)`), 'each shard runs its share of all of them');
  assert.doesNotMatch(tests, /fail-fast: true/, 'one shard failing doesn’t hide the others');

  for (const [f, job, group, cancels] of [['deploy.yml', 'build', 'pages', true], ['cloudflare.yml', 'deploy', 'cloudflare-production', false],
    ['android.yml', 'apk', 'android-release', false], ['steam-deck.yml', 'linux', 'steam-deck-release', false]]) {
    const yml = read(`.github/workflows/${f}`);
    const code = yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    assert.doesNotMatch(code, /tests\.yml|needs: tests|\n  push:/, `${f}: no suite of its own, not on push`);
    assert.match(yml, /\non:\n  workflow_run:\n    workflows: \[Tests\]\n    types: \[completed\]\n    branches: \[main\]\n  workflow_dispatch:\n/, `${f}: when Tests finished on main, or by hand`);
    // its first job builds only when the suite passed on a push to main here (or by hand)
    const first = /\njobs:\n  ([\w-]+):\n(?: *#[^\n]*\n)*    if: ([^\n]*)\n/.exec(yml);
    assert.ok(first, `${f}: its first job has an if`);
    assert.equal(first[1], job, f);
    for (const [name, [ctx, builds]] of Object.entries(EVENTS)) assert.equal(!!evalExpr(first[2], ctx), builds, `${f}: ${name}`);
    assert.equal(!!evalExpr(first[2], DISPATCH), true, `${f}: by hand`);
    // only a run that builds takes the concurrency group (a failed one can't replace a waiting deploy or cancel a running one)
    const g = /\nconcurrency:\n  group: (.*)\n/.exec(yml)[1];
    for (const [name, [ctx, builds]] of Object.entries(EVENTS)) assert.equal(evalValue(g, ctx) === group, builds, `${f}: group when ${name}`);
    assert.equal(evalValue(g, DISPATCH), group, `${f}: group by hand`);
    assert.match(yml, new RegExp(`\\nconcurrency:\\n  group: [^\\n]*\\n  cancel-in-progress: ${cancels}\\n`), `${f}: cancel-in-progress ${cancels}`);
    // the tested commit, not github.sha (main's newest commit when the run started): checked out, and a release's target
    const refs = [...yml.matchAll(/\n *(?:ref|SHA): \$\{\{ (.*) \}\}/g)].map((m) => m[1]);
    assert.ok(refs.length, `${f}: checks out the tested commit`);
    for (const r of refs) {
      if (r === 'env.SHA') continue;
      assert.equal(evalExpr(r, EVENTS.passed[0]), 'tested', f);
      assert.equal(evalExpr(r, DISPATCH), 'dispatched', f);
    }
    for (const checkout of yml.split('uses: actions/checkout@').slice(1)) assert.match(checkout.split('\n      - ')[0], /\n {10}ref: /, `${f}: every checkout names the commit`);
    assert.doesNotMatch(code.replace(/\|\| github\.sha \}\}/g, ''), /GITHUB_SHA|github\.sha/, `${f}: no other sha`);
  }
  // cloudflare.yml by hand only from main (the Worker is production)
  const cf = /\n  deploy:\n(?: *#[^\n]*\n)*    if: ([^\n]*)\n/.exec(read('.github/workflows/cloudflare.yml'))[1];
  assert.equal(!!evalExpr(cf, { ...DISPATCH, ref: 'refs/heads/try' }), false);
  // xbox.yml, on its own triggers, still runs the suite first
  assert.match(read('.github/workflows/xbox.yml'), /\n  tests:\n(    [^\n]*\n)*    uses: \.\/\.github\/workflows\/tests\.yml/);
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
