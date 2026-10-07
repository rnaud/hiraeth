#!/usr/bin/env node
// Mixamo packs kept in the repository (data/mocap/packs/<pack>.zip, as downloaded): every row of
// scripts/mocap/mixamo-clips.json with a `pack` and an `entry` is unpacked to data/mocap/mixamo/<file>.fbx,
// where build-library.mjs reads it. The packs hold more clips than the table takes: add a row to take one.
//
//   node scripts/mocap/unpack-packs.mjs          # then: node scripts/mocap/build-library.mjs --add <ids>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../..');
const PACKS = resolve(ROOT, 'data/mocap/packs'), OUT = resolve(ROOT, 'data/mocap/mixamo');
const { clips } = JSON.parse(await readFile(resolve(HERE, 'mixamo-clips.json'), 'utf8'));
await mkdir(OUT, { recursive: true });
let n = 0;
for (const c of clips.filter((x) => x.pack && x.entry)) {
  const zip = resolve(PACKS, `${c.pack}.zip`);
  if (!existsSync(zip)) { console.warn(`  ${c.id}: ${c.pack}.zip is not in data/mocap/packs/`); continue; }
  const bytes = execFileSync('unzip', ['-p', zip, c.entry], { maxBuffer: 64 * 2 ** 20 });
  if (!bytes.length) { console.warn(`  ${c.id}: "${c.entry}" is not in ${c.pack}.zip`); continue; }
  await writeFile(resolve(OUT, `${c.file}.fbx`), bytes);
  n++;
}
console.log(`${n} clips unpacked to data/mocap/mixamo/`);
