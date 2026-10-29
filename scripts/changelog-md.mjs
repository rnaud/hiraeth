// Writes changelog.md from src/changelog.js: the same release notes the game shows
// (press N), so the repository's changelog can never fall behind; and src/version.js,
// the newest entry's version alone, which the game shows without loading the changelog.
//   node scripts/changelog-md.mjs          → rewrite changelog.md and src/version.js
//   node scripts/changelog-md.mjs --check  → exit 1 if either is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG, lineText, newestFirst } from '../src/changelog.js';

export const CHANGELOG_MD = fileURLToPath(new URL('../changelog.md', import.meta.url));
export const VERSION_JS = fileURLToPath(new URL('../src/version.js', import.meta.url));

export function changelogMarkdown(entries = CHANGELOG) {
  const out = ['# Changelog', '', 'The same release notes shown in the game (press **N** or open settings).', ''];
  for (const e of entries) {
    out.push(`## v${e.v} — ${e.date}`, '');
    for (const item of newestFirst(e)) out.push(`- ${lineText(item)}`);
    out.push('');
  }
  return out.join('\n');
}

/** src/version.js: the newest entry's version, as a literal (no import of the changelog, no top-level await). */
export function versionModule(entries = CHANGELOG) {
  return [
    '// The game\'s version: the newest entry of src/changelog.js, written here by `node scripts/changelog-md.mjs` (with',
    '// changelog.md), so the title screen, the settings and the engines show it without the 1 MB of every version\'s lines',
    '// (issue #110), and so editing a changelog line doesn\'t reach every module that only shows the version.',
    '// tests/changelog.test.js fails if this differs from the changelog.',
    `export const VERSION = ${JSON.stringify(entries[0].v).replaceAll('"', '\'')};`,
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const md = changelogMarkdown(), version = versionModule();
  if (process.argv.includes('--check')) {
    // (each file read by its own name, so the test selector sees exactly which two it reads)
    let now = '', nowVersion = '';
    try { now = readFileSync(CHANGELOG_MD, 'utf8'); } catch { /* missing */ }
    try { nowVersion = readFileSync(VERSION_JS, 'utf8'); } catch { /* missing */ }
    if (now !== md) { console.error('changelog.md is out of date: run node scripts/changelog-md.mjs'); process.exit(1); }
    if (nowVersion !== version) { console.error('src/version.js is out of date: run node scripts/changelog-md.mjs'); process.exit(1); }
  } else { writeFileSync(CHANGELOG_MD, md); writeFileSync(VERSION_JS, version); }
}
