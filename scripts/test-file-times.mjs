// A node:test reporter beside spec on GitHub (.github/workflows/tests.yml): at the end of a shard it prints each
// test file's own time, its process from start to end, as one line
//   test-file-times {"cpus":4,"files":{"tests/a.test.js":12.3,...}}
// that `node scripts/test-shards.mjs --ci <run id>` reads back into tests/shard-timings.json; and it warns (a
// GitHub annotation) of a file over a few minutes, which should be split, and of a slow one the table doesn't
// have yet (docs/systems/testing.md, "The shards").
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { relative, resolve } from 'node:path';

export const SPLIT_OVER = 240;      // seconds on a runner: a file this long should be split (it holds its shard's tail)
export const UNTIMED_OVER = 60;     // a file the table lacks that took this long: time it into the table

export default async function* fileTimes(source) {
  const files = {};
  for await (const e of source) {
    const d = e.data;
    // the file itself: node:test's top-level entry named after it, its duration the process's
    if (e.type !== 'test:complete' || d?.nesting !== 0 || !d.file || resolve(d.name ?? '') !== d.file) continue;
    files[relative(process.cwd(), d.file)] = Math.round(d.details.duration_ms / 100) / 10;
  }
  let table = {};
  try { table = JSON.parse(readFileSync('tests/shard-timings.json', 'utf8')); } catch { /* none: no hints */ }
  for (const [f, s] of Object.entries(files)) {
    if (s > SPLIT_OVER) yield `::warning file=${f}::${f} took ${s} s: split it over files (one this long holds its shard; docs/systems/testing.md "The shards")\n`;
    else if (s > UNTIMED_OVER && table[f] === undefined) yield `::warning file=${f}::${f} took ${s} s and is not in tests/shard-timings.json: node scripts/test-shards.mjs --ci <this run>\n`;
  }
  yield `test-file-times ${JSON.stringify({ cpus: availableParallelism(), files })}\n`;
}
