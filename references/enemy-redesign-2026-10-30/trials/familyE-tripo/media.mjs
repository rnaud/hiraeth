// The changelog's other pictures of a family E foe (#800): the approved reference as its own picture (`<name>-ref.webp`,
// scripts/changelog-shots.mjs sheetWebp) and a Unity batch run's picture as an after-only one (toWebp, the page's size
// and quality), into changelog-media/<version>/.
//
//   node references/enemy-redesign-2026-10-30/trials/familyE-tripo/media.mjs <version> ref <name> <references/…png>
//   node references/enemy-redesign-2026-10-30/trials/familyE-tripo/media.mjs <version> png <name> <picture.png>
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetWebp, toWebp } from '../../../../scripts/changelog-shots.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [VERSION, kind, name, from] = process.argv.slice(2);
const out = join(ROOT, 'changelog-media', VERSION, kind === 'ref' ? `${name}-ref.webp` : `${name}-after.webp`);
const bytes = kind === 'ref' ? sheetWebp(from, out) : toWebp(from, out);
console.log(out, `${(bytes / 1024).toFixed(0)} KB`);
