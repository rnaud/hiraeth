// The Steam Deck runtime on the game's site (scripts/deck-runtime.mjs), read by deck.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtimeKey, split, partName, runtimeJson, liveRuntime, writeRuntime, KEY_FILES, PART } from '../scripts/deck-runtime.mjs';
import { MAX_FILE, SITE } from '../scripts/web-update.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

test('the runtime goes up in parts under the Workers file limit, named as deck.py expects', () => {
  assert.ok(PART < MAX_FILE);
  const data = Buffer.alloc(PART * 2 + 5, 7);
  const parts = split(data);
  assert.deepEqual(parts.map((p) => p.length), [PART, PART, 5]);
  assert.deepEqual(Buffer.concat(parts), data);
  const manifest = runtimeJson({ build: 795001, version: '0.74', data, key: 'k' });
  assert.equal(manifest.sha256, sha256(data));
  assert.equal(manifest.size, data.length);
  assert.deepEqual(manifest.parts, [0, 1, 2].map((i) => `${SITE}updates/steam-deck-795001.tar.gz.00${i}`));
  assert.equal(partName(795001, 12), 'steam-deck-795001.tar.gz.012');
  // deck.py validate_manifest checks exactly these URLs
  const deck = read('../scripts/steam-deck/deck.py');
  assert.match(deck, /CONTENT_URL = 'https:\/\/memento\.alexandria-rnaud\.workers\.dev\/updates\/'/);
  assert.match(deck, /RUNTIME_SITE_URL = CONTENT_URL \+ 'steam-deck\.json'/);
  assert.match(deck, /CONTENT_URL \+ f'steam-deck-\{build\}\.tar\.gz\.\{i:03d\}'/);
});

test('the runtime\'s key is what it runs: the launcher, the updater, the packaging and Electron', async () => {
  assert.deepEqual(KEY_FILES.slice(0, 5), ['desktop/main.mjs', 'desktop/deck-updates.mjs', 'scripts/steam-deck/deck.py', 'scripts/package-steam-deck.mjs', 'desktop/package-lock.json']);
  assert.ok(KEY_FILES.includes('desktop/steam/hero.png'), 'and Steam\'s artwork it carries');
  const files = Object.fromEntries(KEY_FILES.map((name) => [name, Buffer.from(name)]));
  const key = await runtimeKey(async (name) => files[name]);
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(await runtimeKey(async (name) => files[name]), key);
  files['desktop/main.mjs'] = Buffer.from('changed');
  assert.notEqual(await runtimeKey(async (name) => files[name]), key);
});

test('the live runtime is published again while its key holds, checked against its manifest', async () => {
  const data = Buffer.from('a runtime, in two parts');
  const manifest = runtimeJson({ build: 795001, version: '0.74', data, key: 'same', size: 12 });
  const parts = split(data, 12);
  const site = (overrides = {}) => async (url) => {
    const path = new URL(url).pathname;
    const body = path.endsWith('steam-deck.json') ? Buffer.from(JSON.stringify({ ...manifest, ...overrides }))
      : parts[manifest.parts.findIndex((p) => new URL(p).pathname === path)];
    return body ? { ok: true, status: 200, json: async () => JSON.parse(body), arrayBuffer: async () => body } : { ok: false, status: 404 };
  };
  const quiet = { log: () => {} };
  const live = await liveRuntime(SITE, 'same', { fetch: site(), ...quiet });
  assert.deepEqual(Buffer.concat(live.parts), data);
  assert.equal(await liveRuntime(SITE, 'other', { fetch: site(), ...quiet }), null, 'other code: package a new one');
  assert.equal(await liveRuntime(SITE, 'same', { fetch: site({ sha256: '0'.repeat(64) }), ...quiet }), null);
  assert.equal(await liveRuntime(SITE, 'same', { fetch: async () => { throw new Error('offline'); }, ...quiet }), null);
  const dist = mkdtempSync(join(tmpdir(), 'deck-runtime-'));
  mkdirSync(join(dist, 'updates'));
  await writeRuntime(dist, live.manifest, live.parts);
  assert.equal(readFileSync(join(dist, 'updates/steam-deck-795001.tar.gz.001'), 'utf8'), data.subarray(12).toString());
  assert.equal(JSON.parse(readFileSync(join(dist, 'updates/steam-deck.json'), 'utf8')).key, 'same');
});

test('the Cloudflare deploy puts the runtime on the site, numbered as the GitHub release numbers it', () => {
  const yml = read('../.github/workflows/cloudflare.yml'), deckYml = read('../.github/workflows/steam-deck.yml');
  const update = yml.indexOf('node scripts/web-update.mjs'), runtime = yml.indexOf('node scripts/deck-runtime.mjs'), deploy = yml.indexOf('npx wrangler deploy');
  assert.ok(update > 0 && update < runtime && runtime < deploy, 'after the update (which empties updates/), before the deploy');
  const number = 'export DECK_BUILD=$((WEB_BUILD * 1000 + GITHUB_RUN_ATTEMPT))';
  assert.ok(yml.includes(number) && deckYml.includes(number), 'one commit, one runtime number in both');
  assert.doesNotMatch(deckYml, /GITHUB_RUN_NUMBER/);
  assert.match(JSON.parse(read('../package.json')).scripts['deploy:cloudflare'], /web-update\.mjs && node scripts\/deck-runtime\.mjs && wrangler deploy/);
  // the packaged game leaves the site's updates out
  assert.match(read('../scripts/package-steam-deck.mjs'), /filter: \(src\) => !\/\^dist\[\\\\\/\]updates/);
});

test('Steam\'s library artwork: every image at Steam\'s size, in the package, named in Steam\'s grid as deck.py names it', async () => {
  const { ART, GRID, LOGO_SIZE } = await import('../scripts/steam-art.mjs');
  const size = (file) => { const b = readFileSync(new URL(`../desktop/steam/${file}`, import.meta.url)); assert.equal(b.toString('latin1', 1, 4), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(ART.portrait.size, [600, 900]);
  assert.deepEqual(ART.wide.size, [920, 430]);
  assert.deepEqual(ART.hero.size, [1920, 620]);
  for (const [name, a] of Object.entries(ART)) assert.deepEqual(size(`${name}.png`), a.size, name);
  assert.deepEqual(size('logo.png'), LOGO_SIZE);
  assert.equal(ART.hero.logo, undefined, 'no title on the hero: Steam lays the logo over it');
  for (const name of ['wide', 'portrait']) assert.ok(ART[name].logo, `${name} carries the title`);
  // the views are References views (captures of the game itself)
  const refs = readFileSync(new URL('../src/levels/reference-views.js', import.meta.url), 'utf8') + readdirSync(new URL('../src/levels/', import.meta.url)).filter((f) => f.startsWith('reference-')).map((f) => readFileSync(new URL(`../src/levels/${f}`, import.meta.url), 'utf8')).join('');
  for (const a of Object.values(ART)) assert.ok(refs.includes(`'${a.view}'`), a.view);
  // deck.py writes the same files under the same names
  const deck = read('../scripts/steam-deck/deck.py');
  const py = Object.fromEntries([...deck.matchAll(/'([p_a-z]*\.png)': '([\w/-]+\.png)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(py, GRID);
  assert.deepEqual(Object.keys(GRID).sort(), ['.png', '_hero.png', '_icon.png', '_logo.png', 'p.png']);
  assert.match(read('../scripts/package-steam-deck.mjs'), /cp\('desktop\/steam', `\$\{output\}\/source\/steam`/);
});
