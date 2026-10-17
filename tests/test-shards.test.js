// The unit suite's shards on GitHub (scripts/test-shards.mjs, .github/workflows/tests.yml): every test file in
// exactly one shard, dealt longest first to the lightest shard (a new one counted as the table's mean file), each
// shard well inside the job's timeout, and no file so long it holds its shard alone (#445).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shardPlan, testFiles, logTimes, TABLE, SHARDS, AT_ONCE } from '../scripts/test-shards.mjs';
import fileTimes, { SPLIT_OVER } from '../scripts/test-file-times.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the shards: every file once, longest first to the lightest, a new file as the mean one, gone ones ignored', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'new1', 'new2'];
  const times = { a: 50, b: 30, c: 20, d: 20, e: 10, f: 2, gone: 99 };   // (the mean of the six: 22)
  const plan = shardPlan(files, times, 3);
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.flatMap((s) => s.files).sort(), [...files].sort(), 'every file, once');
  assert.deepEqual(plan.map((s) => s.files), [['a', 'e'], ['b', 'c', 'f'], ['d', 'new1', 'new2']]);
  assert.deepEqual(plan.map((s) => s.seconds), [60, 52, 64]);
  assert.deepEqual(plan.map((s) => s.untimed), [0, 0, 2]);
  assert.deepEqual(shardPlan(files, times, 3), plan, 'the same plan every time (each shard works it out alone)');
});

test('the real plan: all of tests/*.test.js over the workflow\'s shards, each well inside its 20 minutes', () => {
  const yml = read('.github/workflows/tests.yml');
  const matrix = /\n {8}shard: \[([\d, ]+)\]\n/.exec(yml)[1].split(',').map(Number);
  assert.equal(matrix.length, SHARDS, 'the matrix has as many shards as scripts/test-shards.mjs plans');
  assert.match(yml, /timeout-minutes: 20\n/);
  assert.match(yml, /--test-reporter=\.\/scripts\/test-file-times\.mjs/, 'the runs print each file\'s time (test-shards.mjs --ci)');
  const files = testFiles(), times = JSON.parse(read(TABLE));
  const plan = shardPlan(files, times, SHARDS);
  assert.deepEqual(plan.flatMap((s) => s.files).sort(), [...files].sort());
  assert.ok(files.includes('tests/test-shards.test.js'));
  // the table is a runner's seconds; runners run 20% slower than it some days (2026-10-17), and a job sets up for half
  // a minute: 12 minutes planned is 15 at worst
  const minutes = plan.map((s) => s.seconds / AT_ONCE / 60);
  assert.ok(Math.max(...minutes) <= 12, `shards of ${minutes.map((m) => m.toFixed(1)).join(', ')} min: add a shard (tests.yml's matrix and SHARDS) or lighten the heaviest files`);
  const longest = Math.max(...files.map((f) => times[f] ?? 0)), secs = plan.map((s) => s.seconds);
  assert.ok(Math.max(...secs) - Math.min(...secs) <= longest, `shards of ${secs.join(', ')} s`);
  // a file over a few minutes holds its shard's tail alone: deal its tests over files (tests/wings-reach.js, door-bypass.js)
  const heavy = files.filter((f) => times[f] > SPLIT_OVER);
  assert.deepEqual(heavy, [], `over ${SPLIT_OVER} s on a runner: split ${heavy.map((f) => `${f} (${times[f]} s)`).join(', ')}`);
  // (a new file counts as the mean one until timed: node scripts/test-shards.mjs --ci <a green run of main>)
  const untimed = files.filter((f) => times[f] === undefined);
  assert.ok(untimed.length <= files.length * 0.1, `${untimed.length} files not in ${TABLE}: node scripts/test-shards.mjs --ci <a green run of main>`);
});

test('the runs\' own times: the reporter prints each file\'s, warns of a long one, and --ci reads them back', async () => {
  const cwd = process.cwd();
  const ev = (name, ms) => ({ type: 'test:complete', data: { nesting: 0, name, file: `${cwd}/${name}`, details: { duration_ms: ms } } });
  async function* events() {
    yield { type: 'test:complete', data: { nesting: 0, name: 'a test in it', file: `${cwd}/tests/x.test.js`, details: { duration_ms: 5 } } };
    yield ev('tests/x.test.js', 12345);
    yield ev('tests/long.test.js', (SPLIT_OVER + 10) * 1000);
    yield { type: 'test:pass', data: { nesting: 0, name: 'tests/y.test.js', file: `${cwd}/tests/y.test.js`, details: { duration_ms: 1 } } };
  }
  let out = '';
  for await (const s of fileTimes(events())) out += s;
  assert.match(out, /^::warning file=tests\/long\.test\.js::.*split it/m);
  const lines = out.split('\n').map((l) => `unit (shard 1/4)\tRun node --test\t2026-10-17T19:14:36.0Z ${l}`).join('\n');
  assert.deepEqual(logTimes(lines), { 'tests/x.test.js': 12.3, 'tests/long.test.js': SPLIT_OVER + 10 });
});
