#!/usr/bin/env node
// Splits the unit test files into shards of about equal time, for the parallel jobs of
// .github/workflows/tests.yml (docs/systems/testing.md, "The shards").
//
//   node scripts/test-shards.mjs 2/4            the files of shard 2 of 4, one a line
//   node scripts/test-shards.mjs --plan 4       every shard's files and expected seconds
//   node scripts/test-shards.mjs --ci <run id> [<run id>...]
//                                               reads each file's time from those runs of Tests on GitHub
//                                               (scripts/test-file-times.mjs prints them; the mean of the
//                                               runs) and rewrites the table: the way to update it
//   node scripts/test-shards.mjs --update [--missing] [--jobs 2]
//                                               the fallback: times the files here (a node --test process
//                                               each, --jobs at once; --missing: only those the table lacks)
//                                               and writes them as a runner's seconds (RUNNER_PER_MAC)
//
// The table (tests/shard-timings.json: file -> seconds a GitHub runner takes over it, three files at once) is
// committed. Every file is dealt longest first, each to the shard with the least time so far; a file not in it
// yet (a new test) counts as the table's mean file, and a file in the table that no longer exists is ignored.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TABLE = 'tests/shard-timings.json';
export const SHARDS = 4;                // the matrix of .github/workflows/tests.yml
export const AT_ONCE = 3;               // files node --test runs at once on a runner (its 4 cores less one)
export const RUNNER_PER_MAC = 1.9;      // a runner's seconds for a file timed alone on the author's Mac (2026-10-17)

export const testFiles = (root = ROOT) => readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js')).sort().map((f) => `tests/${f}`);

/** What a file the table lacks counts as: the mean of the files it has. */
export const guess = (files, times) => {
  const known = files.filter((f) => times[f] !== undefined);
  return known.length ? known.reduce((s, f) => s + times[f], 0) / known.length : 1;
};

/** The files split into n shards: [{ files, seconds, untimed }], balanced by the table's times. */
export function shardPlan(files, times, n) {
  const shards = Array.from({ length: n }, () => ({ files: [], seconds: 0, untimed: 0 }));
  const g = guess(files, times), t = (f) => times[f] ?? g;
  for (const f of [...files].sort((a, b) => t(b) - t(a) || a.localeCompare(b))) {
    const s = shards.reduce((best, x) => (x.seconds < best.seconds ? x : best));
    s.files.push(f); s.seconds += t(f);
    if (times[f] === undefined) s.untimed++;
  }
  for (const s of shards) { s.files.sort(); s.seconds = Math.round(s.seconds * 10) / 10; }
  return shards;
}

const readTable = () => { try { return JSON.parse(readFileSync(join(ROOT, TABLE), 'utf8')); } catch { return {}; } };

function writeTable(times, note) {
  const files = new Set(testFiles());
  const sorted = Object.fromEntries(Object.keys(times).filter((f) => files.has(f)).sort().map((f) => [f, Math.round(times[f] * 10) / 10]));
  writeFileSync(join(ROOT, TABLE), `${JSON.stringify(sorted, null, 1)}\n`);
  const sum = Object.values(sorted).reduce((a, b) => a + b, 0);
  console.log(`${Object.keys(sorted).length} of ${files.size} files, ${sum.toFixed(0)} s in all, written to ${TABLE}${note}`);
}

/** Each file's seconds in a run's log: the test-file-times lines of its shards. */
export function logTimes(log) {
  const out = {};
  for (const line of log.split('\n')) {
    const i = line.indexOf('test-file-times {');
    if (i >= 0) Object.assign(out, JSON.parse(line.slice(i + 'test-file-times '.length)).files);
  }
  return out;
}

function fromCI(runs) {
  const seen = {};
  for (const id of runs) {
    const t = logTimes(execFileSync('gh', ['run', 'view', id, '--log'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30 }));
    if (!Object.keys(t).length) { console.error(`run ${id}: no test-file-times in its log (a run from before scripts/test-file-times.mjs?)`); process.exit(1); }
    console.error(`run ${id}: ${Object.keys(t).length} files, ${Object.values(t).reduce((a, b) => a + b, 0).toFixed(0)} s`);
    for (const [f, s] of Object.entries(t)) (seen[f] ??= []).push(s);
  }
  const times = readTable();
  for (const [f, v] of Object.entries(seen)) times[f] = v.reduce((a, b) => a + b, 0) / v.length;
  writeTable(times, ` (the mean of ${runs.length} run${runs.length > 1 ? 's' : ''})`);
}

function timeFile(file) {
  return new Promise((done) => {
    const t0 = performance.now();
    const p = spawn(process.execPath, ['--test', '--test-reporter=dot', file], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('close', (code) => done({ file, seconds: (performance.now() - t0) / 1000, code }));
  });
}

async function update(jobs, missing) {
  const times = readTable(), files = testFiles().filter((f) => !missing || times[f] === undefined), queue = [...files];
  let failed = 0;
  const worker = async () => {
    for (let f; (f = queue.shift());) {
      const r = await timeFile(f);
      times[f] = r.seconds * RUNNER_PER_MAC;
      if (r.code) { failed++; console.error(`${f}: failed (exit ${r.code})`); }
      process.stderr.write(`${String(files.length - queue.length).padStart(4)}/${files.length} ${r.seconds.toFixed(1).padStart(6)} s here  ${f}\n`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  writeTable(times, ` (${files.length} timed here, x${RUNNER_PER_MAC})${failed ? ` (${failed} failed)` : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--update') {
    const j = args.indexOf('--jobs');
    await update(j >= 0 ? +args[j + 1] : 2, args.includes('--missing'));
  } else if (args[0] === '--ci') {
    if (args.length < 2) { console.error('usage: test-shards.mjs --ci <run id> [<run id>...]'); process.exit(2); }
    fromCI(args.slice(1));
  } else if (args[0] === '--plan') {
    const n = +(args[1] ?? SHARDS), times = readTable(), files = testFiles(), g = guess(files, times);
    shardPlan(files, times, n).forEach((s, i) => {
      console.log(`shard ${i + 1}/${n}: ${s.files.length} files, ${s.seconds} s, about ${(s.seconds / AT_ONCE / 60).toFixed(1)} min${s.untimed ? ` (${s.untimed} not timed yet, at ${g.toFixed(1)} s each)` : ''}`);
      for (const f of s.files) console.log(`  ${String(times[f] ?? '?').padStart(6)}  ${f}`);
    });
  } else {
    const m = /^(\d+)\/(\d+)$/.exec(args[0] ?? '');
    if (!m || +m[1] < 1 || +m[1] > +m[2]) { console.error('usage: test-shards.mjs <i>/<n> | --plan <n> | --ci <run id>... | --update [--missing] [--jobs k]'); process.exit(2); }
    process.stdout.write(shardPlan(testFiles(), readTable(), +m[2])[+m[1] - 1].files.map((f) => `${f}\n`).join(''));
  }
}
