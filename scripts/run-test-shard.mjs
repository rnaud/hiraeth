#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shardPlan, testFiles, TABLE, AT_ONCE } from './test-shards.mjs';
import { validateTests } from './ci-test-plan.mjs';
export function selectedShard(files, available, times, spec) {
  const m = /^(\d+)\/(\d+)$/.exec(spec ?? '');
  if (!m || +m[1] < 1 || +m[2] < 1 || +m[1] > +m[2] || +m[2] > 64) throw Error('Invalid shard');
  return shardPlan(validateTests(files, available), times, +m[2])[+m[1] - 1].files;
}
export function runSelected(files, options, spawn = spawnSync) {
  if (!files.length) { console.log('No selected tests in this shard; Node test discovery was not invoked.'); return 0; }
  const result = spawn(process.execPath, ['--test', `--test-concurrency=${AT_ONCE}`, ...options, ...files], { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.SELECTED_TESTS) throw Error('Explicit SELECTED_TESTS JSON is required');
  const files = selectedShard(JSON.parse(process.env.SELECTED_TESTS), testFiles(), JSON.parse(readFileSync(TABLE, 'utf8')), process.argv[2]);
  process.exitCode = runSelected(files, process.argv.slice(3));
}
