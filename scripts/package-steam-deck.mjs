import { packager } from '../desktop/node_modules/@electron/packager/dist/index.js';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { VERSION } from '../src/changelog.js';
import { desktopApi, gameBuild } from './release-info.mjs';

// DECK_BUILD numbers the runtime package (the updater compares it); WEB_BUILD the game inside it,
// on the same scale as the content updates from the game's site (release-info.mjs gameBuild).
const build = Number(process.env.DECK_BUILD ?? 0);
if (!Number.isSafeInteger(build) || build < 0) throw new Error('Invalid DECK_BUILD');
const webBuild = process.env.WEB_BUILD ? Number(process.env.WEB_BUILD) : (() => { try { return gameBuild(); } catch { return 0; } })();
if (!Number.isSafeInteger(webBuild) || webBuild < 0) throw new Error('Invalid WEB_BUILD');
const output = 'output/steam-deck';
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/source`, { recursive: true });
// (not dist/updates/, the site's content updates and runtime, when the Cloudflare deploy packages it)
await cp('dist', `${output}/source/game`, { recursive: true, filter: (src) => !/^dist[\\/]updates([\\/]|$)/.test(src) });
await cp('desktop/main.mjs', `${output}/source/main.mjs`);
await cp('desktop/deck-updates.mjs', `${output}/source/deck-updates.mjs`);   // (the settings' Updates section)
await cp('scripts/steam-deck/deck.py', `${output}/source/deck.py`);
// Steam's library artwork for the shortcut (scripts/steam-art.mjs; deck.py puts it in Steam's grid/)
await cp('desktop/steam', `${output}/source/steam`, { recursive: true });
await writeFile(`${output}/source/package.json`, JSON.stringify({ name: 'moebius', version: `${VERSION}.0`, type: 'module', main: 'main.mjs' }));
// (build.json stays exactly { build, version }: the updaters installed today check it so)
await writeFile(`${output}/source/build.json`, JSON.stringify({ build, version: VERSION }));
// what deck.py compares a downloaded game with: the packaged game's build and this runtime's level
await writeFile(`${output}/source/content.json`, JSON.stringify({ web: webBuild, desktop: desktopApi() }));
const [bundle] = await packager({
  dir: `${output}/source`, out: output, name: 'moebius', platform: 'linux', arch: 'x64',
  electronVersion: '44.4.5', overwrite: true, asar: false,
});
const filename = `moebius-steam-deck-${build}.tar.gz`;
execFileSync('tar', ['-czf', `${output}/${filename}`, '-C', bundle, '.']);
const archive = await readFile(`${output}/${filename}`);
const repo = process.env.GITHUB_REPOSITORY ?? 'rnaud/moebius';
await writeFile(`${output}/steam-deck.json`, JSON.stringify({
  build, version: VERSION, sha256: createHash('sha256').update(archive).digest('hex'),
  url: `https://github.com/${repo}/releases/download/steam-deck/${filename}`,
}, null, 2) + '\n');
await cp('scripts/steam-deck/deck.py', `${output}/install-moebius.py`);
console.log(`${output}/${filename}`);
