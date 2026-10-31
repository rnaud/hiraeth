// The test selector's view (scripts/affected-tests.mjs dependenciesOf) of the family A body modules: each must name the
// files it reads (no unknown dependency: an unknown one makes every test that imports it run for every change).
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/selector-check.mjs [module …]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependenciesOf } from '../../../../scripts/affected-tests.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const mods = process.argv.slice(2).length ? process.argv.slice(2) : ['src/enemies/plans/tripo-body.js', 'src/enemies/plans/toad-tripo.js', 'src/enemies/plans/centipede-tripo.js', 'src/enemies/plans/skitter-tripo.js'];
let bad = 0;
for (const f of mods) {
  if (!existsSync(join(ROOT, f))) continue;
  const d = dependenciesOf(f, readFileSync(join(ROOT, f), 'utf8'));
  if (d.unknown) bad++;
  console.log(f, d.unknown ? 'UNKNOWN' : 'known', d.resources.filter((r) => !r.startsWith('src/')).join(' '));
}
process.exitCode = bad ? 1 : 0;
