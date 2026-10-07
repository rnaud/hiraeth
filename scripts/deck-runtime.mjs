// The Steam Deck runtime (Electron, desktop/main.mjs, deck.py and a packaged game) on the game's site,
// next to the content update, for the Deck updater (deck.py RUNTIME_SITE_URL): the GitHub release that
// also carries it is private, out of a Deck's reach.
//   dist/updates/steam-deck.json                  build, version, sha256, size, key, parts
//   dist/updates/steam-deck-<build>.tar.gz.<nnn>  the package in 20 MiB parts (Workers takes 25 MiB a file)
//
//   npm run build && node scripts/web-update.mjs && node scripts/deck-runtime.mjs [--live <site url>]
//
// The game updates on its own (web.json), so the runtime only changes with what it runs: its key is
// a hash of main.mjs, deck.py, the packaging and Electron's lockfile. While the live site's runtime
// has the same key its parts are fetched, checked and published again unchanged (a deploy uploads
// nothing for them); a new key packages a new runtime (scripts/package-steam-deck.mjs, DECK_BUILD).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SITE, UPDATES, MAX_FILE, checkLimits } from './web-update.mjs';

export const PART = 20 * 1024 * 1024;
export const KEY_FILES = ['desktop/main.mjs', 'scripts/steam-deck/deck.py', 'scripts/package-steam-deck.mjs', 'desktop/package-lock.json'];
const REPO = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** What the runtime runs, hashed: the same key, the same runtime. */
export async function runtimeKey(read = (name) => readFile(join(REPO, name))) {
  const hash = createHash('sha256');
  for (const name of KEY_FILES) hash.update(`${name}\0`).update(await read(name)).update('\0');
  return hash.digest('hex');
}

/** A package as parts no bigger than `size`. */
export function split(data, size = PART) {
  const parts = [];
  for (let at = 0; at < data.length; at += size) parts.push(data.subarray(at, at + size));
  return parts;
}

export const partName = (build, index) => `steam-deck-${build}.tar.gz.${String(index).padStart(3, '0')}`;

/** The manifest deck.py reads (validate_manifest): its parts' URLs, in order, on `site`. */
export function runtimeJson({ build, version, data, key, site = SITE, size = PART }) {
  const count = split(data, size).length;
  return {
    build, version, sha256: sha256(data), size: data.length, key,
    parts: Array.from({ length: count }, (_, i) => new URL(`${UPDATES}/${partName(build, i)}`, site).href),
  };
}

/** The live site's runtime, when it has `key`: { manifest, parts } with its bytes checked; else null. */
export async function liveRuntime(site, key, { fetch = globalThis.fetch, log = console.warn } = {}) {
  try {
    const get = (url) => fetch(`${url}?t=${Date.now()}`, { signal: AbortSignal.timeout(120_000), headers: { 'Cache-Control': 'no-cache' } });
    const res = await get(new URL(`${UPDATES}/steam-deck.json`, site).href);
    if (!res.ok) { log(`no live steam-deck.json (HTTP ${res.status})`); return null; }
    const manifest = await res.json();
    if (manifest.key !== key) { log('the live runtime runs other code: a new one is packaged'); return null; }
    const parts = [];
    for (const url of manifest.parts) {
      const part = await get(url);
      if (!part.ok) { log(`the live ${url} is gone (HTTP ${part.status})`); return null; }
      parts.push(Buffer.from(await part.arrayBuffer()));
    }
    const data = Buffer.concat(parts);
    if (data.length !== manifest.size || sha256(data) !== manifest.sha256) { log('the live runtime doesn\'t match its manifest'); return null; }
    return { manifest, parts };
  } catch (error) {
    log(`couldn't read the live runtime (${error.message})`);
    return null;
  }
}

/** Write the runtime's parts and manifest into dist/updates/. */
export async function writeRuntime(dist, manifest, parts) {
  const out = join(dist, UPDATES);
  for (const [i, part] of parts.entries()) {
    if (part.length > MAX_FILE) throw new Error(`part ${i} is over the Workers limit`);
    await writeFile(join(out, new URL(manifest.parts[i]).pathname.split('/').pop()), part);
  }
  await writeFile(join(out, 'steam-deck.json'), JSON.stringify(manifest, null, 2) + '\n');
}

async function main(args) {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  const at = args.indexOf('--live');
  const site = at >= 0 ? args[at + 1] : SITE;
  const key = await runtimeKey();
  const live = await liveRuntime(site, key);
  if (live) {
    await writeRuntime(dist, live.manifest, live.parts);
    console.log(`updates/steam-deck.json: the live runtime ${live.manifest.build} again (${live.parts.length} parts)`);
  } else {
    // (the same number as the GitHub release's package of this commit: steam-deck.yml)
    if (!process.env.DECK_BUILD) throw new Error('DECK_BUILD is needed to package a new runtime');
    // (the packager fetches Linux's Electron itself)
    execFileSync('npm', ['--prefix', 'desktop', 'ci', '--ignore-scripts'], { cwd: REPO, stdio: 'inherit', env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1' } });
    execFileSync('node', ['scripts/package-steam-deck.mjs'], { cwd: REPO, stdio: 'inherit' });
    const built = JSON.parse(await readFile(join(REPO, 'output/steam-deck/steam-deck.json'), 'utf8'));
    const data = await readFile(join(REPO, 'output/steam-deck', `moebius-steam-deck-${built.build}.tar.gz`));
    if (sha256(data) !== built.sha256) throw new Error('the package changed under us');
    const manifest = runtimeJson({ build: built.build, version: built.version, data, key, site });
    await writeRuntime(dist, manifest, split(data));
    console.log(`updates/steam-deck.json: runtime ${manifest.build}, ${manifest.parts.length} parts (${(data.length / 1048576).toFixed(1)} MiB)`);
  }
  await checkLimits(dist);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(1); });
}
