// The content update the Cloudflare deploy publishes next to the site (scripts/web-update.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { zipDir, writeUpdate, previousZip, checkLimits, SITE, UPDATES, MAX_FILE, MAX_FILES } from '../scripts/web-update.mjs';
import { desktopApi, webMinNative } from '../scripts/release-info.mjs';
import { CHANGELOG } from '../src/changelog.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Read a zip back through its central directory: { name: bytes }. */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50);
    const method = buf.readUInt16LE(at + 10), csize = buf.readUInt32LE(at + 20), size = buf.readUInt32LE(at + 24);
    const nlen = buf.readUInt16LE(at + 28), xlen = buf.readUInt16LE(at + 30), clen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42), name = buf.toString('utf8', at + 46, at + 46 + nlen);
    assert.equal(buf.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    out[name] = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    assert.equal(out[name].length, size, name);
    at += 46 + nlen + xlen + clen;
  }
  return out;
}

function site() {
  const dist = mkdtempSync(join(tmpdir(), 'memento-site-'));
  mkdirSync(join(dist, 'assets'));
  mkdirSync(join(dist, UPDATES));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Memento</title>');
  writeFileSync(join(dist, 'assets', 'main.js'), 'console.log("game");'.repeat(50));
  writeFileSync(join(dist, 'assets', 'ünïcode.bin'), Buffer.from([1, 2, 3]));
  writeFileSync(join(dist, UPDATES, 'web-1.zip'), 'an older update');   // (never zipped into the bundle)
  return dist;
}

test('the bundle zip: every game file and nothing of updates/, the same bytes every time', async () => {
  const dist = site();
  const a = await zipDir(dist, { skip: (n) => n === UPDATES || n.startsWith(`${UPDATES}/`) });
  const b = await zipDir(dist, { skip: (n) => n === UPDATES || n.startsWith(`${UPDATES}/`) });
  assert.deepEqual(a.zip, b.zip, 'deterministic: a redeploy of the same build gives the same zip');
  const files = unzip(a.zip);
  assert.deepEqual(Object.keys(files), ['assets/main.js', 'assets/ünïcode.bin', 'index.html'], 'sorted, no folders, no updates/');
  assert.equal(files['index.html'].toString(), '<!doctype html><title>Memento</title>');
  assert.deepEqual([...files['assets/ünïcode.bin']], [1, 2, 3]);
});

test('web.json: the build, its zip on the site, the levels the Android app and the Deck need', async () => {
  const dist = site();
  const previous = { build: 540, name: 'web-540.zip', zip: Buffer.from('the previous build') };
  const m = await writeUpdate({ dist, build: 541, previous });
  const zip = readFileSync(join(dist, UPDATES, 'web-541.zip'));
  assert.equal(m.build, 541);
  assert.equal(m.version, CHANGELOG[0].v);
  assert.equal(m.zip, `${SITE}${UPDATES}/web-541.zip`);
  assert.equal(m.sha256, sha(zip));
  assert.equal(m.size, zip.length);
  assert.equal(m.minNative, webMinNative(), 'the bridge the web game needs, not the newest app\'s');
  assert.equal(m.minDesktop, desktopApi());
  assert.equal(m.page, undefined, 'no release page on the site: the app falls back to GitHub releases (the author\'s)');
  assert.deepEqual(JSON.parse(readFileSync(join(dist, UPDATES, 'web.json'), 'utf8')), m);
  assert.equal(readFileSync(join(dist, UPDATES, 'web-540.zip'), 'utf8'), 'the previous build', 'the previous zip stays downloadable');
  assert.equal(existsSync(join(dist, UPDATES, 'web-1.zip')), false, 'older ones go');
  assert.equal(SITE, 'https://memento.alexandria-rnaud.workers.dev/');
});

test('the previous zip: kept only when it is the live web.json\'s, and checks out', async () => {
  const old = Buffer.from('zip bytes of build 540');
  const live = { build: 540, sha256: sha(old) };
  const serve = (routes) => async (url) => {
    const path = new URL(url).pathname.replace(/^\//, '');
    const r = routes[path];
    if (r instanceof Error) throw r;
    if (r === undefined) return new Response('missing', { status: 404 });
    return new Response(typeof r === 'object' && !Buffer.isBuffer(r) ? JSON.stringify(r) : r);
  };
  const quiet = () => {};
  const got = await previousZip(SITE, 541, { fetch: serve({ 'updates/web.json': live, 'updates/web-540.zip': old }), log: quiet });
  assert.equal(got.name, 'web-540.zip');
  assert.deepEqual(got.zip, old);
  assert.equal(await previousZip(SITE, 540, { fetch: serve({ 'updates/web.json': live, 'updates/web-540.zip': old }), log: quiet }), null, 'the same build: this deploy\'s zip has that name');
  assert.equal(await previousZip(SITE, 541, { fetch: serve({ 'updates/web.json': live, 'updates/web-540.zip': 'damaged' }), log: quiet }), null, 'a zip that doesn\'t match its web.json is not kept');
  assert.equal(await previousZip(SITE, 541, { fetch: serve({}), log: quiet }), null, 'the first deploy');
  assert.equal(await previousZip(SITE, 541, { fetch: serve({ 'updates/web.json': live }), log: quiet }), null, 'its zip is gone');
  assert.equal(await previousZip(SITE, 541, { fetch: serve({ 'updates/web.json': { build: 'x' } }), log: quiet }), null);
  assert.equal(await previousZip(SITE, 541, { fetch: serve({ 'updates/web.json': new Error('offline') }), log: quiet }), null, 'offline: deploy without it');
});

test('the site stays under the Workers asset limits', async () => {
  assert.equal(MAX_FILE, 25 * 1024 * 1024);
  assert.equal(MAX_FILES, 20000);
  const dist = site();
  assert.equal(await checkLimits(dist), 4);
  await assert.rejects(checkLimits(dist, { maxFile: 100 }), /assets\/main\.js is .* at most/);
  await assert.rejects(checkLimits(dist, { maxFiles: 3 }), /4 files/);
});

test('the Cloudflare deploy owns the site: it builds, adds the update, then deploys', () => {
  const yml = read('../.github/workflows/cloudflare.yml');
  const build = yml.indexOf('npm run build'), update = yml.indexOf('node scripts/web-update.mjs'), deploy = yml.indexOf('npx wrangler deploy');
  assert.ok(build > 0 && build < update && update < deploy, 'build, then the update into dist/, then one deploy');
  assert.match(yml, /web-update\.mjs --live https:\/\/memento\.alexandria-rnaud\.workers\.dev\//, 'the previous zip from the live site');
  assert.match(yml, /fetch-depth: 0/, 'the build number counts the whole history');
  assert.match(yml, /cancel-in-progress: false/);
  assert.doesNotMatch(yml, /npm run deploy:cloudflare/, 'that would build again and drop updates/');
  const pkg = JSON.parse(read('../package.json'));
  for (const s of ['deploy:cloudflare', 'check:cloudflare', 'dev:cloudflare']) {
    assert.match(pkg.scripts[s], /npm run build && node scripts\/web-update\.mjs/, `${s} deploys the update too`);
  }
  for (const f of ['android.yml', 'steam-deck.yml']) {
    assert.doesNotMatch(read(`../.github/workflows/${f}`), /wrangler/, `${f} doesn't deploy the Worker (it would replace the updates)`);
  }
  assert.match(read('../wrangler.jsonc'), /"directory": "\.\/dist"/, 'updates/ is inside dist/');
});
