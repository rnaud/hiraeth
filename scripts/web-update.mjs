// The game's content update, published next to the site by the Cloudflare deploy (cloudflare.yml):
//   dist/updates/web-<build>.zip  the built game (dist/ without updates/), the same files the APK and the Deck carry
//                                 (without the site's own files and the themes fetched on demand: SHEET_FILE, MEDIA_FILE, onDemand)
//   dist/updates/web.json         its manifest (release-info.mjs webJson): build, sha256, zip URL, minNative, minDesktop…
// read by the Android app (WebBundles.MANIFEST), the Steam Deck updater (deck.py CONTENT_MANIFEST_URL) and the
// Xbox app (xbox/Hiraeth/WebBundles.cs Manifest).
//
//   npm run build && node scripts/web-update.mjs [--live <site url>] [--no-previous]
// --live: the site the update is published on (default SITE): the zip URL in web.json, and where
// the previous build is fetched from. WEB_BUILD overrides the build number (release-info.mjs build).
//
// A Workers deploy replaces every asset, so the previous build's zip is fetched from the live site
// (and checked against its live web.json) and published again: a device that read the old web.json
// a moment ago can finish its download. The zip is deterministic (sorted names, fixed times), so the
// same build always gives the same bytes. Every file stays under the Workers asset limits.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { deflateRawSync, crc32 } from 'node:zlib';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG } from '../src/changelog.js';
import { desktopApi, gameBuild, webJson, xboxApi } from './release-info.mjs';
import { ON_DEVICE_THEMES } from '../src/music-store.js';

export const SITE = 'https://memento.alexandria-rnaud.workers.dev/';
export const UPDATES = 'updates';
/** Workers static assets: 25 MiB per file, 20,000 files per version on the free plan. */
export const MAX_FILE = 25 * 1024 * 1024;
export const MAX_FILES = 20000;
export const UPDATE_PART = 20 * 1024 * 1024;

// 2000-01-01 00:00 in MS-DOS time (zip entries carry a local date and time, not a timestamp)
const DOS_TIME = 0, DOS_DATE = ((2000 - 1980) << 9) | (1 << 5) | 1;

async function files(dir, skip = () => false, root = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name), name = relative(root, path).split(sep).join('/');
    if (skip(name)) continue;
    if (entry.isDirectory()) out.push(...await files(path, skip, root));
    else if (entry.isFile()) out.push(name);
  }
  return out;
}

/**
 * A zip of `dir` (no directory entries; WebBundles and deck.py make the folders), the same bytes for
 * the same files: names in byte order, fixed times, deflate where it saves space.
 */
export async function zipDir(dir, { skip = () => false } = {}) {
  const names = (await files(dir, skip)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const parts = [], central = [];
  let offset = 0;
  for (const name of names) {
    const data = await readFile(join(dir, ...name.split('/')));
    const packed = deflateRawSync(data, { level: 9 });
    const deflate = packed.length < data.length, body = deflate ? packed : data;
    const crc = crc32(data), file = Buffer.from(name, 'utf8');
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);                   // version needed: 2.0
    head.writeUInt16LE(0x0800, 6);               // UTF-8 names
    head.writeUInt16LE(deflate ? 8 : 0, 8);
    head.writeUInt16LE(DOS_TIME, 10);
    head.writeUInt16LE(DOS_DATE, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(file.length, 26);
    head.writeUInt16LE(0, 28);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(0x0314, 4);              // made by: Unix, 2.0 (for the file mode below)
    head.copy(entry, 6, 4, 30);                  // needed, flags, method, time, date, crc, sizes, name length
    entry.writeUInt16LE(0, 30);                  // extra
    entry.writeUInt16LE(0, 32);                  // comment
    entry.writeUInt16LE(0, 34);                  // disk
    entry.writeUInt16LE(0, 36);                  // internal attributes
    entry.writeUInt32LE((0o100644 << 16) >>> 0, 38);   // a plain file, rw-r--r--
    entry.writeUInt32LE(offset, 42);
    parts.push(head, file, body);
    central.push(entry, file);
    offset += head.length + file.length + body.length;
    if (offset > 0xffffffff) throw new Error('the bundle is too large for a plain zip');
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(dirSize, 12);
  end.writeUInt32LE(offset, 16);
  return { zip: Buffer.concat([...parts, ...central, end]), names };
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * The previous build's zip from the live site, when its web.json names another build and the
 * zip's bytes match it. @returns { build, name, zip } or null (first deploy, offline, or the same build)
 */
export async function previousZip(site, build, { fetch = globalThis.fetch, log = console.warn } = {}) {
  try {
    const get = (path) => fetch(new URL(`${UPDATES}/${path}?t=${Date.now()}`, site), { signal: AbortSignal.timeout(60_000), headers: { 'Cache-Control': 'no-cache' } });
    const res = await get('web.json');
    if (!res.ok) { log(`no live web.json (HTTP ${res.status}): nothing to keep`); return null; }
    const live = await res.json();
    if (!Number.isSafeInteger(live.build) || live.build <= 0 || !/^[0-9a-f]{64}$/.test(live.sha256 ?? '')) { log('the live web.json is not one of ours: nothing to keep'); return null; }
    if (live.build === build) return null;   // (the same build: this deploy's zip has the same name)
    const name = `web-${live.build}.zip`;
    const z = await get(name);
    if (!z.ok) { log(`the live ${name} is gone (HTTP ${z.status})`); return null; }
    const zip = Buffer.from(await z.arrayBuffer());
    if (sha256(zip) !== live.sha256) { log(`the live ${name} doesn't match its web.json: not kept`); return null; }
    return { build: live.build, name, zip };
  } catch (error) {
    log(`couldn't read the live update (${error.message}): nothing to keep`);
    return null;
  }
}

/** Check a built site against the Workers static asset limits. */
export async function checkLimits(dir, { maxFile = MAX_FILE, maxFiles = MAX_FILES } = {}) {
  const all = await files(dir);
  if (all.length > maxFiles) throw new Error(`${all.length} files: Workers takes at most ${maxFiles}`);
  for (const name of all) {
    const { size } = await stat(join(dir, ...name.split('/')));
    if (size > maxFile) throw new Error(`${name} is ${(size / 1048576).toFixed(1)} MiB: Workers takes at most ${(maxFile / 1048576).toFixed(0)} MiB per file`);
  }
  return all.length;
}

/** The References level's sheets (assets/IMG_<n>-<hash>.JPG, ~18 MB) stay out of the zip: the site serves
 * them to bundled games (src/levels/reference-sheets.js), and with them the zip passed Workers' 25 MiB. */
export const SHEET_FILE = /^assets\/(IMG_\d+|reference-\d+)-[\w-]+\.jpe?g$/i;   // (the new worlds' sheets are reference-1 … 4.jpeg)
/** The interactive changelog's pictures (changelog-media/, docs/systems/changelog.md) are the site's alone:
 * the build never holds them (the deploy copies them in after this zip and the Deck's runtime are made),
 * and if they ever were in dist/ they would still stay out of the zip, the APK and the Deck. */
export const MEDIA_FILE = /^changelog-media(\/|$)/;
/** The audits page's data and the reports' pictures (dist/audits/: scripts/audits-data.mjs) are the site's alone too:
 * audits.html, small, ships with the game and reads them from the site. */
export const AUDIT_FILE = /^audits\//;
/** The site's own configuration (public/_headers: Cloudflare's headers by path, the themes' CORS). */
export const SITE_CONFIG = /^_headers$/;
/** The recorded themes a device fetches from the site the first time it needs one, and keeps (src/music-store.js):
 * every music/*.mp3 but ON_DEVICE_THEMES (the desert's). The zip, the APK and the Deck leave them out (about
 * 99 MB); the site serves them. OTA_MUSIC=1 puts them back in the zip, for a hand-over update: a game that finds
 * them in its bundle keeps them (adoptBundledThemes), so an install from before keeps its soundtrack for good. */
export const onDemand = (name) => /^music\/[^/]+\.mp3$/.test(name) && !ON_DEVICE_THEMES.includes(name.slice('music/'.length));

/** Store large archives as bounded assets; the Worker streams their original zip URL. */
export async function writeArchive(out, name, zip, partSize = UPDATE_PART) {
  if (zip.length <= partSize) {
    await writeFile(join(out, name), zip);
    return;
  }
  const parts = [];
  for (let at = 0; at < zip.length; at += partSize) {
    const part = `${name}.${String(parts.length).padStart(3, '0')}`;
    await writeFile(join(out, part), zip.subarray(at, at + partSize));
    parts.push(part);
  }
  await writeFile(join(out, `${name}.json`), JSON.stringify({ size: zip.length, sha256: sha256(zip), partSize, parts }) + '\n');
}

/** Write dist/updates/: this build's zip and web.json, and the previous build's zip. */
export async function writeUpdate({ dist, build, version = CHANGELOG[0].v, site = SITE, previous = null, partSize = UPDATE_PART, music = process.env.OTA_MUSIC === '1' }) {
  const out = join(dist, UPDATES);
  await rm(out, { recursive: true, force: true });
  const { zip, names } = await zipDir(dist, { skip: (n) => n === UPDATES || n.startsWith(`${UPDATES}/`) || SHEET_FILE.test(n) || MEDIA_FILE.test(n) || AUDIT_FILE.test(n) || SITE_CONFIG.test(n) || (!music && onDemand(n)) });
  if (!names.includes('index.html')) throw new Error('no index.html in the build: run npm run build first');
  await mkdir(out, { recursive: true });
  const file = join(out, `web-${build}.zip`);
  await writeFile(file, zip);

  const manifest = webJson({ build, version, file, zip: new URL(`${UPDATES}/web-${build}.zip`, site).href, desktop: desktopApi(), xbox: xboxApi() });
  await rm(file);
  await writeArchive(out, `web-${build}.zip`, zip, partSize);
  if (previous) await writeArchive(out, previous.name, previous.zip, partSize);
  await writeFile(join(out, 'web.json'), JSON.stringify(manifest) + '\n');
  return manifest;
}

async function main(args) {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  const at = args.indexOf('--live');
  const site = at >= 0 ? args[at + 1] : SITE;
  const build = process.env.WEB_BUILD ? +process.env.WEB_BUILD : gameBuild();
  if (!Number.isSafeInteger(build) || build <= 0) throw new Error(`bad build number ${process.env.WEB_BUILD}`);
  const previous = args.includes('--no-previous') ? null : await previousZip(site, build);
  const manifest = await writeUpdate({ dist, build, site, previous });
  const count = await checkLimits(dist);
  console.log(`updates/web-${build}.zip (${(manifest.size / 1048576).toFixed(1)} MiB)${previous ? ` and the previous ${previous.name}` : ''}, web.json; ${count} files in the site`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(1); });
}
