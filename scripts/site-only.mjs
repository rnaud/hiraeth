// What the site serves but the devices never need: the reference sheets (scripts/web-update.mjs SHEET_FILE: the
// References level's photographs, about 39 MB, which a bundled game reads from the site anyway:
// src/levels/reference-sheets.js sheetSrc) and the changelog's pictures (MEDIA_FILE: docs/systems/changelog.md).
// The over-the-air zip already leaves both out; the APK (`npx cap sync android` copies dist/) and the Steam Deck
// package (scripts/package-steam-deck.mjs) leave them out through this.
//
//   node scripts/site-only.mjs dist        deletes them from a built dist/ (the Android workflow, before cap sync)
import { readdir, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MEDIA_FILE, SHEET_FILE } from './web-update.mjs';

/** Is a file of dist/ (its path from dist/, with / between folders) one the devices never get? */
export const siteOnly = (rel) => SHEET_FILE.test(rel) || MEDIA_FILE.test(rel);

/** Delete the site-only files from a built dist/; returns { files, bytes } removed. */
export async function stripSiteOnly(dist) {
  let files = 0, bytes = 0;
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name), rel = relative(dist, p).split(sep).join('/');
      if (siteOnly(rel)) { const s = await stat(p); if (e.isDirectory()) { bytes += await size(p); } else bytes += s.size; files++; await rm(p, { recursive: true, force: true }); }
      else if (e.isDirectory()) await walk(p);
    }
  };
  const size = async (dir) => { let n = 0; for (const e of await readdir(dir, { withFileTypes: true })) { const p = join(dir, e.name); n += e.isDirectory() ? await size(p) : (await stat(p)).size; } return n; };
  await walk(dist);
  return { files, bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv[2] ?? 'dist';
  const { files, bytes } = await stripSiteOnly(dist);
  console.log(`site-only: removed ${files} files (${(bytes / 2 ** 20).toFixed(1)} MB) from ${dist}`);
}
