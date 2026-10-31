// #800 family G: the test files a change reaches (a JSON list from scripts/affected-tests.mjs), less the hook's deferred
// ones (tests/hook-deferred.json), run as the pre-commit hook runs them (concurrency 2), ahead of the commit.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/run-affected.mjs <list.json> > log
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const list = JSON.parse(readFileSync(process.argv[2], 'utf8')), deferred = JSON.parse(readFileSync('tests/hook-deferred.json', 'utf8')).files;
const tests = list.filter((f) => !deferred.includes(f));
console.log(`${tests.length} files (${list.length - tests.length} deferred)`);
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=2', '--test-reporter=dot', ...tests], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
