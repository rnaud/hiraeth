import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';
// The pre-commit hook runs the tests a commit's changes reach (scripts/affected-tests.mjs); the whole
// affected suite runs on GitHub per change, with a separate daily full suite and exact-commit deploy gates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { affectedTests, refsOf, repositorySyntax } from '../scripts/affected-tests.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the pre-commit hook runs the reached tests, all of them when asked, and is enabled by npm install', () => {
  const hook = read('.githooks/pre-commit');
  assert.match(hook, /node scripts\/affected-tests\.mjs/);
  assert.match(hook, /--staged --json/);
  assert.match(hook, /spawnSync/);
  assert.match(hook, /FULL_TESTS/);
  assert.match(hook, /--staged --all --json/);
  assert.match(hook, /git diff --quiet --ignore-submodules --/);
  assert.match(hook, /testEnv\.NODE_COMPILE_CACHE\?\?=process\.cwd\(\)\+'\/\.cache\/node-compile'/, 'the test processes share Node\'s compile cache, unless one is set');
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

test('shared affected selection runs per change, and automatic web deploys wait for its exact commit', () => {
  const tests = read('.github/workflows/tests.yml');
  assert.match(tests, /^name: Tests\n/, 'the name the deploys wait for (workflow_run: workflows: [Tests])');
  for (const event of ['push', 'pull_request', 'workflow_dispatch', 'workflow_call']) assert.match(tests, new RegExp('\\n  '+event+':'), event);
  assert.match(tests, /node scripts\/ci-test-plan\.mjs/);
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
  assert.match(tests, /node scripts\/run-test-shard\.mjs/);
  assert.match(tests, /SELECTED_TESTS: \$\{\{ needs\.selection\.outputs\.files \}\}/);
  assert.doesNotMatch(tests, /fail-fast: true/, 'one shard failing doesn’t hide the others');

  for (const [f, job, group, cancels] of [['deploy.yml', 'build', 'pages', true], ['cloudflare.yml', 'deploy', 'cloudflare-production', false]]) {
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
    assert.match(code, /if: github\.event_name == 'workflow_dispatch'[\s\S]*?run: scripts\/wait-tests\.sh \"\$\{\{ github\.sha \}\}\"/, `${f}: manual deploy verifies its selected commit`);
    assert.doesNotMatch(code.replace(/\|\| github\.sha \}\}/g, '').replace(/scripts\/wait-tests\.sh \"\$\{\{ github\.sha \}\}\"/g, ''), /GITHUB_SHA|github\.sha/, `${f}: no other sha`);
  }
  // cloudflare.yml by hand only from main (the Worker is production)
  const cf = /\n  deploy:\n(?: *#[^\n]*\n)*    if: ([^\n]*)\n/.exec(read('.github/workflows/cloudflare.yml'))[1];
  assert.equal(!!evalExpr(cf, { ...DISPATCH, ref: 'refs/heads/try' }), false);
  assert.equal(!!evalExpr(cf, { ...DISPATCH, event: { inputs: { migrate_deck_runtime: 'true' } } }), false, 'migration never deploys the site');
  for (const f of ['android.yml','steam-deck.yml','xbox.yml','unity-android.yml']) {
    const code=read(`.github/workflows/${f}`).split('\n').filter(l=>!/^\s*#/.test(l)).join('\n');
    assert.match(code,/\n  workflow_dispatch:/, `${f}: manual native release`);
    // the GeckoView APK builds again after every tested push to main (the author, 2026-10-30); the others stay manual
    if(f==='android.yml') assert.match(code,/\n  workflow_run:\n    workflows: \[Tests\]\n    types: \[completed\]\n    branches: \[main\]/, 'android.yml: after the Tests run on main');
    else assert.doesNotMatch(code,/\n  (?:push|workflow_run):/, `${f}: no per-push native build`);
    if(f==='unity-android.yml') {
      assert.match(code,/\n  schedule:/);
      assert.match(code,/scripts\/unity-release-plan\.mjs/,'daily native build checks changed inputs');
    } else assert.doesNotMatch(code,/\n  schedule:/, `${f}: manual only`);
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
  assert.equal(affectedTests(['src/nobody.js'], opts), 'ALL', 'unowned changes fail closed');
  assert.equal(affectedTests(['docs/x.md'], opts), 'ALL', 'unknown resource changes are not silently ignored');
});

test('shared infrastructure and unowned change sets run everything', () => {
  for (const f of ['package.json', 'package-lock.json', '.githooks/pre-commit', 'scripts/affected-tests.mjs']) {
    assert.equal(affectedTests([f], opts), 'ALL', f);
  }
  assert.equal(affectedTests(Array.from({ length: 41 }, (_, i) => `src/f${i}.js`), opts), 'ALL', 'these paths have no known test owner');
});

test('refsOf follows relative imports, re-exports and new URL, not packages', () => {
  assert.deepEqual(refsOf('src/x/y.js', "import a from '../a.js'; export * from './b.js?raw'; import 'three'; new URL('./c.png', import.meta.url)").sort(),
    ['src/a.js', 'src/x/b.js', 'src/x/c.png']);
});

test('the real repository: a change to dev-gate.js reaches the first-run test, and not the whole suite', () => {
  const r = affectedTests(['src/dev-gate.js'], { syntax: repositorySyntax() });   // (exact-bytes syntax from the selector's cache)
  assert.ok(Array.isArray(r) && r.includes('tests/first-run.test.js'));
  assert.ok(r.length > 0, 'known consumer retained alongside conservative dynamic consumers');
});


test('a real commit keeps Git context for staged selection but isolates fixture repositories in tests', () => {
  const root = tempDir('hiraeth-hook-isolation-');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && key !== 'NODE_TEST_CONTEXT'));   // (else the hook's node --test skips its files)
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'Hook isolation fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'core.hooksPath', '.githooks');
    for (const dir of ['.githooks', 'scripts', 'tests']) mkdirSync(join(root, dir));
    writeFileSync(join(root, '.githooks/pre-commit'), read('.githooks/pre-commit'), { mode: 0o755 });
    writeFileSync(join(root, 'scripts/affected-tests.mjs'), `
      import assert from 'node:assert/strict';
      import { writeFileSync } from 'node:fs';
      assert.ok(process.env.GIT_INDEX_FILE, 'selector must retain the staged index');
      assert.ok(process.argv.includes('--staged'));
      writeFileSync('selection-proof.json', JSON.stringify({ index: process.env.GIT_INDEX_FILE, args: process.argv.slice(2) }));
      console.log(JSON.stringify(['tests/isolation.test.js']));
    `);
    writeFileSync(join(root, 'tests/isolation.test.js'), `
      const { test } = require('node:test');
      const assert = require('node:assert/strict');
      const { tmpdir } = require('node:os');
      const { join } = require('node:path');
      const { execFileSync } = require('node:child_process');
      test('nested Git is isolated from the committing repository', async () => {
        const { tempDir, removeTemp } = await import(${JSON.stringify(new URL('../scripts/temp-dirs.mjs', import.meta.url).href)});
        assert.deepEqual(Object.keys(process.env).filter(k => k.startsWith('GIT_')), []);
        const nested = tempDir('hiraeth-nested-git-');
        try {
          execFileSync('git', ['init', '-q'], { cwd: nested });
          execFileSync('git', ['config', 'user.name', 'Nested fixture'], { cwd: nested });
          const dir = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: nested, encoding: 'utf8' }).trim();
          assert.equal(require('node:fs').realpathSync(dir), require('node:fs').realpathSync(nested));
        } finally { removeTemp(nested); }
      });
    `);
    git('add', '.');
    const configBefore = readFileSync(join(root, '.git/config'), 'utf8');
    execFileSync('git', ['commit', '-qm', 'exercise normal hook'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...env, GIT_DIR: join(root, '.git'), GIT_WORK_TREE: root,
      GIT_COMMON_DIR: join(root, '.git'), GIT_INDEX_FILE: join(root, '.git/index'), TEST_CONCURRENCY: '1',
    } });
    const selectionProof = JSON.parse(readFileSync(join(root, 'selection-proof.json'), 'utf8'));
    assert.equal(selectionProof.index, join(root, '.git/index'), 'selector successfully saw the actual staged index, not a full-suite fallback');
    assert.ok(selectionProof.args.includes('--staged'));
    assert.equal(readFileSync(join(root, '.git/config'), 'utf8'), configBefore, 'nested init/config must not change parent Git settings');
    assert.equal(git('rev-parse', '--is-bare-repository'), 'false');
    assert.equal(git('config', 'core.hooksPath'), '.githooks');
    assert.equal(git('rev-list', '--count', 'HEAD'), '1', 'the real normal-hook commit succeeded');
  } finally { removeTemp(root); }
});

test('the hook leaves the listed long end-to-end files to GitHub, runs the rest, and runs them all when asked', () => {
  const root = tempDir('hiraeth-hook-deferred-');
  // (no Git context, and not this test runner's: the hook's own node --test must run its files)
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && key !== 'NODE_TEST_CONTEXT'));
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (message, extra = {}) => {
    // (git hands the hook's output to stderr)
    const r = spawnSync('git', ['commit', '-qm', message], { cwd: root, encoding: 'utf8', env: { ...env, TEST_CONCURRENCY: '1', ...extra } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return r.stdout + r.stderr;
  };
  const ran = (name) => { try { readFileSync(join(root, `ran-${name}`)); return true; } catch { return false; } };
  try {
    git('init', '-q');
    git('config', 'user.name', 'Hook deferral fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'core.hooksPath', '.githooks');
    for (const dir of ['.githooks', 'scripts', 'tests']) mkdirSync(join(root, dir));
    writeFileSync(join(root, '.githooks/pre-commit'), read('.githooks/pre-commit'), { mode: 0o755 });
    // the selector says both are affected; the list defers one
    writeFileSync(join(root, 'scripts/affected-tests.mjs'), "console.log(JSON.stringify(['tests/kept.test.js', 'tests/long.test.js']));");
    writeFileSync(join(root, 'tests/hook-deferred.json'), JSON.stringify({ files: ['tests/long.test.js'] }));
    for (const name of ['kept', 'long']) writeFileSync(join(root, `tests/${name}.test.js`),
      `require('node:test')('${name}', () => require('node:fs').writeFileSync(${JSON.stringify(join(root, `ran-${name}`))}, ''));`);
    writeFileSync(join(root, '.gitignore'), 'ran-*\n');
    git('add', '.');
    const out = commit('the hook defers the long file');
    assert.equal(ran('kept'), true, 'the affected file runs in the hook: ' + out);
    assert.equal(ran('long'), false, 'the long end-to-end file waits for the push');
    assert.match(out, /1 long end-to-end files left to GitHub's push run and the daily suite/);
    for (const name of ['kept', 'long']) rmSync(join(root, `ran-${name}`), { force: true });
    writeFileSync(join(root, 'tests/kept.test.js'), readFileSync(join(root, 'tests/kept.test.js'), 'utf8') + '\n');
    git('add', '.');
    commit('asked for everything selected', { RUN_DEFERRED: '1' });
    assert.equal(ran('kept'), true);
    assert.equal(ran('long'), true, 'RUN_DEFERRED=1 runs it in the hook');
    // a malformed list defers nothing
    for (const name of ['kept', 'long']) rmSync(join(root, `ran-${name}`), { force: true });
    writeFileSync(join(root, 'tests/hook-deferred.json'), '{ not json');
    git('add', '.');
    commit('a malformed list');
    assert.equal(ran('long'), true, 'a malformed list defers nothing');
  } finally { removeTemp(root); }
});
