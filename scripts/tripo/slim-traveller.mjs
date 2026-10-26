// Filesystem command; binary transformations are shared with the tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import { TRAVELLER_FILES, SLIM, readGlb, writeGlb, usedParts, slimGlb, makeResize } from './slim-traveller-core.mjs';
export { TRAVELLER_FILES, SLIM, readGlb, writeGlb, usedParts, slimGlb, makeResize } from './slim-traveller-core.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const resize = await makeResize();
  let stale = 0;
  for (const [src, dst] of TRAVELLER_FILES) {
    const before = readFileSync(resolve(ROOT, src));
    const after = await slimGlb(before, resize);
    if (check) {
      const shipped = readFileSync(resolve(ROOT, dst));
      if (!shipped.equals(after)) { console.error(`${dst} is not what slim-traveller makes from ${src}`); stale++; }
      continue;
    }
    writeFileSync(resolve(ROOT, dst), after);
    console.log(`${dst}: ${(before.length / 1e6).toFixed(2)} MB → ${(after.length / 1e6).toFixed(2)} MB`);
  }
  process.exit(stale ? 1 : 0);
}
