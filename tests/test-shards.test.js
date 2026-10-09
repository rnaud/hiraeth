// The unit suite's shards on GitHub (scripts/test-shards.mjs, .github/workflows/tests.yml): every test file in
// exactly one shard, the timed ones dealt longest first to the lightest shard, new ones round-robin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shardPlan, testFiles, TABLE } from '../scripts/test-shards.mjs';

test('the shards: every file once, balanced by its time, new files round-robin, gone ones ignored', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'new1', 'new2', 'new3', 'new4'];
  const times = { a: 50, b: 30, c: 20, d: 20, e: 10, f: 5, gone: 99 };
  const plan = shardPlan(files, times, 3);
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.flatMap((s) => s.files).sort(), [...files].sort(), 'every file, once');
  assert.deepEqual(plan.map((s) => s.seconds), [50, 45, 40], 'longest first, each to the lightest shard');
  assert.deepEqual(plan.map((s) => s.files.filter((f) => f.startsWith('new'))), [['new1', 'new4'], ['new2'], ['new3']]);
  assert.deepEqual(shardPlan(files, times, 3), plan, 'the same plan every time (each shard works it out alone)');
});

test('the real plan: all of tests/*.test.js across three shards, none more than the longest file over the others', () => {
  const files = testFiles(), times = JSON.parse(readFileSync(new URL(`../${TABLE}`, import.meta.url), 'utf8'));
  const plan = shardPlan(files, times, 3);
  assert.deepEqual(plan.flatMap((s) => s.files).sort(), [...files].sort());
  assert.ok(files.includes('tests/test-shards.test.js'));
  const longest = Math.max(...files.map((f) => times[f] ?? 0)), secs = plan.map((s) => s.seconds);
  assert.ok(Math.max(...secs) - Math.min(...secs) <= longest, `shards of ${secs.join(', ')} s`);
  // (the table is regenerated now and then, node scripts/test-shards.mjs --update: most files are in it)
  assert.ok(files.filter((f) => times[f] !== undefined).length >= files.length * 0.8, 'tests/shard-timings.json is out of date: run node scripts/test-shards.mjs --update');
});
