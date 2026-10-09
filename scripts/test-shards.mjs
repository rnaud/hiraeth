#!/usr/bin/env node
// Splits the unit test files into shards of about equal time, for the parallel jobs of
// .github/workflows/tests.yml (docs/systems/testing.md, "The shards").
//
//   node scripts/test-shards.mjs 2/3            the files of shard 2 of 3, one a line
//   node scripts/test-shards.mjs --plan 3       every shard's files and expected seconds
//   node scripts/test-shards.mjs --update [--jobs 4]
//                                               times every test file on its own (a node --test
//                                               process each, --jobs at once) and rewrites the table
//
// The table (tests/shard-timings.json: file → seconds) is committed. The files in it are dealt
// longest first, each to the shard with the least time so far; files not in it yet (new tests) go
// round-robin after them, and a file in the table that no longer exists is ignored.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TABLE = 'tests/shard-timings.json';

export const testFiles = (root = ROOT) => readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js')).sort().map((f) => `tests/${f}`);

/** The files split into n shards: [{ files, seconds }], balanced by the table's times. */
export function shardPlan(files, times, n) {
  const shards = Array.from({ length: n }, () => ({ files: [], seconds: 0 }));
  const known = files.filter((f) => times[f] !== undefined).sort((a, b) => times[b] - times[a] || a.localeCompare(b));
  for (const f of known) {
    const s = shards.reduce((best, x) => (x.seconds < best.seconds ? x : best));
    s.files.push(f); s.seconds += times[f];
  }
  files.filter((f) => times[f] === undefined).forEach((f, i) => shards[i % n].files.push(f));
  for (const s of shards) { s.files.sort(); s.seconds = Math.round(s.seconds * 10) / 10; }
  return shards;
}

const readTable = () => { try { return JSON.parse(readFileSync(join(ROOT, TABLE), 'utf8')); } catch { return {}; } };

function timeFile(file) {
  return new Promise((done) => {
    const t0 = performance.now();
    const p = spawn(process.execPath, ['--test', '--test-reporter=dot', file], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('close', (code) => done({ file, seconds: (performance.now() - t0) / 1000, code }));
  });
}

async function update(jobs) {
  const files = testFiles(), queue = [...files], out = {};
  let failed = 0;
  const worker = async () => {
    for (let f; (f = queue.shift());) {
      const r = await timeFile(f);
      out[f] = Math.round(r.seconds * 10) / 10;
      if (r.code) { failed++; console.error(`${f}: failed (exit ${r.code})`); }
      process.stderr.write(`${String(files.length - queue.length).padStart(4)}/${files.length} ${out[f].toFixed(1).padStart(6)} s  ${f}\n`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const sorted = Object.fromEntries(Object.keys(out).sort().map((f) => [f, out[f]]));
  writeFileSync(join(ROOT, TABLE), `${JSON.stringify(sorted, null, 1)}\n`);
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  console.log(`${files.length} files, ${sum.toFixed(0)} s in all, written to ${TABLE}${failed ? ` (${failed} failed)` : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--update') {
    const j = args.indexOf('--jobs');
    await update(j >= 0 ? +args[j + 1] : Math.max(1, Math.floor(availableParallelism() / 2)));
  } else if (args[0] === '--plan') {
    const n = +(args[1] ?? 3), times = readTable();
    shardPlan(testFiles(), times, n).forEach((s, i) => {
      const fresh = s.files.filter((f) => times[f] === undefined).length;
      console.log(`shard ${i + 1}/${n}: ${s.files.length} files, ${s.seconds} s${fresh ? ` (+${fresh} not timed yet)` : ''}`);
      for (const f of s.files) console.log(`  ${String(times[f] ?? '?').padStart(6)}  ${f}`);
    });
  } else {
    const m = /^(\d+)\/(\d+)$/.exec(args[0] ?? '');
    if (!m || +m[1] < 1 || +m[1] > +m[2]) { console.error('usage: test-shards.mjs <i>/<n> | --plan <n> | --update [--jobs k]'); process.exit(2); }
    process.stdout.write(shardPlan(testFiles(), readTable(), +m[2])[+m[1] - 1].files.map((f) => `${f}\n`).join(''));
  }
}
