// The lore page's pictures (lore.html, docs/systems/lore-page.md): each original of src/lore-page/pictures.js
// SOURCES (reference picks, too large to serve) made into a small WebP in public/lore-pictures/<name>.webp, 720 px on
// its long side. The site's alone: the over-the-air zip, the APK and the Deck leave the folder out
// (scripts/web-update.mjs LORE_FILE, scripts/site-only.mjs). Run it again when a source changes or one is added.
//
//   node scripts/lore-pictures.mjs            makes the missing ones (--all: every one again)
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, LORE_DIR } from '../src/lore-page/pictures.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SIZE = 720, QUALITY = 70;

const all = process.argv.includes('--all');
const { default: sharp } = await import('sharp');
const out = join(ROOT, 'public', LORE_DIR);
await mkdir(out, { recursive: true });
let made = 0, bytes = 0;
for (const [name, { from }] of Object.entries(SOURCES)) {
  const file = join(out, `${name}.webp`);
  if (!all && existsSync(file)) continue;
  const buf = await sharp(await readFile(join(ROOT, from))).rotate()
    .resize({ width: SIZE, height: SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 }).toBuffer();
  await writeFile(file, buf);
  made++; bytes += buf.length;
  console.log(`${name}.webp  ${(buf.length / 1024).toFixed(0)} KB`);
}
console.log(`made ${made} (${(bytes / 1024).toFixed(0)} KB) in public/${LORE_DIR}/`);
