// #800 family G: a new test file's line in tests/shard-timings.json, timed here as scripts/test-shards.mjs --update times
// one (a node --test process alone, its seconds × RUNNER_PER_MAC), the table's other lines left as they are: the plan
// counts at most a tenth of the files untimed, and main sat at that edge.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/time-own.mjs tests/<file>.test.js [...]
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { RUNNER_PER_MAC } from '../../../../scripts/test-shards.mjs';

const TABLE = 'tests/shard-timings.json', times = JSON.parse(readFileSync(TABLE, 'utf8'));
for (const f of process.argv.slice(2)) {
  const t0 = performance.now(), r = spawnSync(process.execPath, ['--test', f], { stdio: 'ignore' });
  if (r.status !== 0) throw new Error(`${f} failed`);
  times[f] = Math.round(((performance.now() - t0) / 1000) * RUNNER_PER_MAC * 10) / 10;
  console.log(f, times[f], 's on a runner');
}
const sorted = Object.fromEntries(Object.keys(times).sort().map((f) => [f, times[f]]));
writeFileSync(TABLE, `${JSON.stringify(sorted, null, 1)}\n`);
