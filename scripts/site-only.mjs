// What the site serves but the devices never need: the reference sheets (scripts/web-update.mjs SHEET_FILE: the
// References level's photographs, about 39 MB, which a bundled game reads from the site anyway:
// src/levels/reference-sheets.js sheetSrc) and the changelog's pictures (MEDIA_FILE: docs/systems/changelog.md).
// The over-the-air zip already leaves both out; the APK (`npx cap sync android` copies dist/) and the Steam Deck
// package (scripts/package-steam-deck.mjs) leave them out through this.
//
// A second kind stays off the devices too, for another reason: the recorded themes fetched on demand
// (onDemand, scripts/web-update.mjs: every music/*.mp3 but the desert's). A device does need them, one world
// at a time: it fetches each from the site the first time and keeps it for good (src/music-store.js).
// leftOff() is both: what the APK, the Deck package and the over-the-air zip never carry.
//
//   node scripts/site-only.mjs dist        deletes them all from a built dist/ (the Android workflow, before cap sync)
import { readdir, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MEDIA_FILE, SHEET_FILE, SITE_CONFIG, onDemand } from './web-update.mjs';

/** Is a file of dist/ (its path from dist/, with / between folders) one the devices never get? */
export const siteOnly = (rel) => SHEET_FILE.test(rel) || MEDIA_FILE.test(rel) || SITE_CONFIG.test(rel);
/** Is it a recorded theme a device fetches from the site when it needs it (and keeps)? */
export const fetchedOnDemand = (rel) => onDemand(rel);
/** What the APK and the Deck package leave out: the site's own files and the themes fetched on demand. */
export const leftOff = (rel) => siteOnly(rel) || fetchedOnDemand(rel);

/** Delete what the devices leave out (leftOff, or `skip`) from a built dist/; returns { files, bytes } removed. */
export async function stripSiteOnly(dist, skip = leftOff) {
  let files = 0, bytes = 0;
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name), rel = relative(dist, p).split(sep).join('/');
      if (skip(rel)) { const s = await stat(p); if (e.isDirectory()) { bytes += await size(p); } else bytes += s.size; files++; await rm(p, { recursive: true, force: true }); }
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
  console.log(`site-only and fetched on demand: removed ${files} files (${(bytes / 2 ** 20).toFixed(1)} MB) from ${dist}`);
}
