import { packager } from '../desktop/node_modules/@electron/packager/dist/index.js';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { VERSION } from '../src/changelog.js';

const build = Number(process.env.DECK_BUILD ?? 0);
if (!Number.isSafeInteger(build) || build < 0) throw new Error('Invalid DECK_BUILD');
const output = 'output/steam-deck';
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/source`, { recursive: true });
await cp('dist', `${output}/source/game`, { recursive: true });
await cp('desktop/main.mjs', `${output}/source/main.mjs`);
await cp('scripts/steam-deck/deck.py', `${output}/source/deck.py`);
await writeFile(`${output}/source/package.json`, JSON.stringify({ name: 'moebius', version: `${VERSION}.0`, type: 'module', main: 'main.mjs' }));
await writeFile(`${output}/source/build.json`, JSON.stringify({ build, version: VERSION }));
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
