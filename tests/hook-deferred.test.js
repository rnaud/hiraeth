// The long end-to-end files the pre-commit hook leaves to GitHub's push run and the daily suite (tests/hook-deferred.json;
// docs/systems/testing.md "Long end-to-end files on push"). The list can hold only long files, and only the hook reads it:
// the CI plan and the shards still run every selected file. The hook's own behaviour is run in tests/pre-commit.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const list = JSON.parse(readFileSync(new URL('./hook-deferred.json', import.meta.url), 'utf8'));
const timings = JSON.parse(readFileSync(new URL('./shard-timings.json', import.meta.url), 'utf8'));
const DEFER_OVER = 60;   // runner seconds: only files this long may wait for the push
const here = readdirSync(new URL('./', import.meta.url));

test('only long, existing top-level test files are deferred, each once', () => {
  assert.ok(Array.isArray(list.files) && list.files.length > 0);
  assert.equal(new Set(list.files).size, list.files.length);
  for (const f of list.files) {
    assert.match(f, /^tests\/[^/]+\.test\.js$/, f);
    assert.ok(here.includes(f.slice('tests/'.length)), f + ' exists');
    assert.ok((timings[f] ?? 0) >= DEFER_OVER, `${f}: ${timings[f]} s on a runner, under ${DEFER_OVER} s: run it in the hook`);
  }
});

test('GitHub still runs them: neither the CI plan nor the workflows read the list', () => {
  for (const f of ['../scripts/ci-test-plan.mjs', '../scripts/run-test-shard.mjs', '../scripts/test-shards.mjs', '../.github/workflows/tests.yml', '../.github/workflows/nightly-tests.yml'])
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /hook-deferred/, f);
  const hook = readFileSync(new URL('../.githooks/pre-commit', import.meta.url), 'utf8');
  assert.match(hook, /tests\/hook-deferred\.json/);
  assert.match(hook, /!process\.env\.FULL_TESTS&&!process\.env\.RUN_DEFERRED/, 'FULL_TESTS and RUN_DEFERRED run them here');
});
