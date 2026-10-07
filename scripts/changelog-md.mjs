// Writes changelog.md from src/changelog.js: the same release notes the game shows
// (press N), so the repository's changelog can never fall behind.
//   node scripts/changelog-md.mjs          → rewrite changelog.md
//   node scripts/changelog-md.mjs --check  → exit 1 if changelog.md is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG, lineText, newestFirst } from '../src/changelog.js';

export const CHANGELOG_MD = fileURLToPath(new URL('../changelog.md', import.meta.url));

export function changelogMarkdown(entries = CHANGELOG) {
  const out = ['# Changelog', '', 'The same release notes shown in the game (press **N** or open settings).', ''];
  for (const e of entries) {
    out.push(`## v${e.v} — ${e.date}`, '');
    for (const item of newestFirst(e)) out.push(`- ${lineText(item)}`);
    out.push('');
  }
  return out.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const md = changelogMarkdown();
  if (process.argv.includes('--check')) {
    let now = '';
    try { now = readFileSync(CHANGELOG_MD, 'utf8'); } catch { /* missing */ }
    if (now !== md) { console.error('changelog.md is out of date: run node scripts/changelog-md.mjs'); process.exit(1); }
  } else writeFileSync(CHANGELOG_MD, md);
}
