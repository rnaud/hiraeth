#!/usr/bin/env node
// Writes tests/catalogs/*.js from the source directories (scripts/test-catalogs-core.mjs). Run it after adding,
// removing or renaming a file in one of them; tests/test-catalogs.test.js says when it is due.
//   node scripts/test-catalogs.mjs          → rewrite the catalogues
//   node scripts/test-catalogs.mjs --check  → exit 1 if one is out of date
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS, entries, renderCatalog } from './test-catalogs-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let stale = 0;
mkdirSync(join(ROOT, 'tests/catalogs'), { recursive: true });
for (const [name, spec] of Object.entries(SPECS)) {
  const text = renderCatalog(name, entries(name, readdirSync(join(ROOT, spec.dir), { recursive: spec.recursive })));
  const file = join(ROOT, 'tests/catalogs', name + '.js');
  let now = '';
  try { now = readFileSync(file, 'utf8'); } catch { /* new */ }
  if (now === text) continue;
  stale++;
  if (process.argv.includes('--check')) console.error(`tests/catalogs/${name}.js is out of date: run node scripts/test-catalogs.mjs`);
  else { writeFileSync(file, text); console.log(`wrote tests/catalogs/${name}.js`); }
}
if (stale && process.argv.includes('--check')) process.exit(1);
