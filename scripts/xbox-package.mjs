// The Xbox app's package (xbox/, docs/systems/xbox.md), the parts that don't need Windows: run by the Xbox workflow
// (.github/workflows/xbox.yml) before msbuild, and tested in tests/xbox.test.js.
//
//   node scripts/xbox-package.mjs prepare [--publisher "CN=…"] [--dist dist]
//        stages the built game (dist/, without what the devices never carry: scripts/site-only.mjs leftOff) into
//        xbox/Hiraeth/game/ with its bundle.json (build, version), and writes the package's version and publisher
//        into xbox/Hiraeth/Package.appxmanifest. Prints version=, build=, package= lines (for GITHUB_OUTPUT).
//   node scripts/xbox-package.mjs version             → the package version (1.6.4123.0)
//   node scripts/xbox-package.mjs notes [sha] [by]    → the notes of the GitHub prerelease `xbox`
//
// WEB_BUILD overrides the build number (release-info.mjs build: the commit count).
import { cp, mkdir, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG } from '../src/changelog.js';
import { gameBuild } from './release-info.mjs';
import { leftOff } from './site-only.mjs';
import { UPDATES } from './web-update.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const APP_DIR = join(ROOT, 'xbox', 'Hiraeth');
export const MANIFEST = join(APP_DIR, 'Package.appxmanifest');
export const GAME_DIR = join(APP_DIR, 'game');
/** The release the workflow publishes to: a prerelease of its own, never the players' latest. */
export const XBOX_TAG = 'xbox';
/** The publisher the committed manifest names (the certificate's subject must match it, or the workflow passes its own). */
export const DEFAULT_PUBLISHER = 'CN=Hiraeth Xbox Dev';

/**
 * The package's version from the game's: major.minor from the changelog's newest entry ('1.6'), the build (the
 * commit count, the same number as the web bundle's) third, 0 last. Windows compares them field by field, so a
 * newer commit always installs over an older one; each field must fit in 16 bits.
 */
export function uwpVersion(version, build) {
  const [major, minor = '0'] = String(version ?? '').split('.');
  const parts = [major, minor, build, 0].map((n) => Number(n));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 65535)) throw new Error(`can't make a package version from ${version} and build ${build}`);
  return parts.join('.');
}

/** A certificate subject the manifest takes as Publisher ("CN=…", optionally more "X=…" parts). */
export function checkPublisher(publisher) {
  const p = String(publisher ?? '').trim();
  if (!/^CN=[^,"<>&]+(,\s*[A-Z]+=[^,"<>&]+)*$/.test(p)) throw new Error(`not a certificate subject: "${publisher}" (expected CN=…)`);
  return p;
}

/** The manifest with Identity's Version and Publisher replaced (and nothing else). */
export function setIdentity(xml, { version, publisher }) {
  const identity = /<Identity\b[^>]*\/>/;
  const m = identity.exec(xml);
  if (!m) throw new Error('no <Identity …/> in the manifest');
  let tag = m[0];
  if (version !== undefined) {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error(`bad package version ${version}`);
    tag = tag.replace(/\bVersion="[^"]*"/, `Version="${version}"`);
  }
  if (publisher !== undefined) tag = tag.replace(/\bPublisher="[^"]*"/, `Publisher="${checkPublisher(publisher)}"`);
  return xml.replace(identity, tag);
}

/** What the package leaves out of dist/: what no device carries (leftOff) and the site's update feed. */
export const leftOutOfPackage = (rel) => rel === UPDATES || rel.startsWith(`${UPDATES}/`) || leftOff(rel);

/** Copy the built game into the app (GAME_DIR by default), with its bundle.json. @returns { files, bytes } */
export async function stageGame({ dist, dest = GAME_DIR, build, version }) {
  try { await stat(join(dist, 'index.html')); } catch { throw new Error(`no built game in ${dist}: run npm run build first`); }
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  let files = 0, bytes = 0;
  await cp(dist, dest, {
    recursive: true,
    filter: async (src) => {
      const rel = relative(dist, src).split(sep).join('/');
      if (!rel) return true;
      if (leftOutOfPackage(rel)) return false;
      const s = await stat(src);
      if (s.isFile()) { files++; bytes += s.size; }
      return true;
    },
  });
  await writeFile(join(dest, 'bundle.json'), JSON.stringify({ build, version }) + '\n');
  return { files, bytes };
}

/** The notes of the `xbox` prerelease: what it is, how to install it, what it was built from. */
export function xboxNotes({ version, build, sha = '', by = 'GitHub Actions', date = new Date().toISOString().slice(0, 10) }) {
  return [
    'Hiraeth for Xbox, for testing on a console in Developer Mode (not for players: the game itself is the Android app, the Steam Deck package and https://memento.alexandria-rnaud.workers.dev/).',
    '',
    'Install through the Xbox Device Portal: Add, pick the `.msix`, add the `.appx` files under Dependencies (x64), install. Then set the app type to **Game** (the app\'s "View details" in Dev Home, or Device Portal\'s app list): about 5 GB and the whole GPU instead of an App\'s 1 GB and 45 %. A package signed with a new certificate needs the old app removed first; the saves go with it. How, and what to measure on the first run: docs/systems/xbox.md.',
    '',
    'Once installed, the app updates the game by itself from the game\'s site, like the Android app; a new package is needed only when the app itself changes.',
    '',
    `Built from commit ${sha ? `\`${sha.slice(0, 12)}\`` : '(unknown)'}, web version v${version}, build ${build} (package ${uwpVersion(version, build)}), by ${by} on ${date}.`,
  ].join('\n');
}

async function count(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) n += e.isDirectory() ? await count(join(dir, e.name)) : 1;
  return n;
}

async function main(what = 'version', args = []) {
  const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
  const version = CHANGELOG[0].v;
  const build = () => (process.env.WEB_BUILD ? +process.env.WEB_BUILD : gameBuild());
  if (what === 'version') { console.log(uwpVersion(version, build())); return; }
  if (what === 'notes') {
    const sha = args[0] || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    console.log(xboxNotes({ version, build: build(), sha, by: args[1] }));
    return;
  }
  if (what === 'prepare') {
    const b = build(), pkg = uwpVersion(version, b);
    const publisher = arg('publisher', process.env.XBOX_PUBLISHER || DEFAULT_PUBLISHER);
    const dist = join(ROOT, arg('dist', 'dist'));
    const { files, bytes } = await stageGame({ dist, build: b, version });
    await writeFile(MANIFEST, setIdentity(await readFile(MANIFEST, 'utf8'), { version: pkg, publisher }));
    console.error(`staged ${files} files (${(bytes / 1048576).toFixed(1)} MB) into xbox/Hiraeth/game (${await count(GAME_DIR)} with bundle.json); manifest ${pkg}, ${publisher}`);
    console.log(`version=${version}\nbuild=${b}\npackage=${pkg}`);
    return;
  }
  throw new Error(`unknown: ${what}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv.slice(3)).catch((error) => { console.error(error.message); process.exit(1); });
}
