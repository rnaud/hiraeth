// The Unity players' store as a file and their script over the air (the Unity-default plan's D4, D13, D14; issue #264):
// the release side (release-info.mjs unityApi / unityJson / unityDecision, web-update.mjs's unity-<build>.zip and
// unity.json, the Worker, the Cloudflare deploy), the Updates page (engine/unity/updates.js in engine/menus.js, the
// words from src/updates.js), and the C# side's shape (BridgeStore, BridgeUpdates: their rules run in the editor's tests,
// unity/Hiraeth/Assets/HiraethJS/Editor/Tests/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { tempDir } from '../scripts/temp-dirs.mjs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { unityApi, unityMinApi, unityJson, unityDecision, unityBundleInfo } = await import('../scripts/release-info.mjs');
const { writeUpdate, writeUnityUpdate, previousZip, SITE, UPDATES } = await import('../scripts/web-update.mjs');
const { updateView } = await import('../src/updates.js');
const { UnityUpdates } = await import('../engine/unity/updates.js');
const { EngineMenus, START_SIDE, UPDATES_SIDE } = await import('../engine/menus.js');
const { SlotStore } = await import('../src/save-slots.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const UPDATES_CS = 'unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeUpdates.cs';

/** A zip's files through its central directory: { name: bytes }. */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10), csize = buf.readUInt32LE(at + 20), nlen = buf.readUInt16LE(at + 28), xlen = buf.readUInt16LE(at + 30), clen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42), name = buf.toString('utf8', at + 46, at + 46 + nlen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    out[name] = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    at += 46 + nlen + xlen + clen;
  }
  return out;
}

/** The player's script folder as engine-bundle.mjs ota makes it (and a public/ the zip leaves out). */
function scriptDir(build, { minUnity = 1 } = {}) {
  const dir = tempDir('hiraeth-unity-ota-');
  writeFileSync(join(dir, 'hiraeth.cjs'), 'module.exports = { start() {}, frame() {} };'.repeat(20));
  writeFileSync(join(dir, 'audio.cjs'), 'module.exports = {};');
  writeFileSync(join(dir, 'bundle.json'), JSON.stringify(unityBundleInfo({ build, version: '9.9', minUnity, updates: true })));
  mkdirSync(join(dir, 'item-pictures')); writeFileSync(join(dir, 'item-pictures', 'lamp.png'), 'png');
  writeFileSync(join(dir, 'item-pictures', 'lamp.png.meta'), 'unity meta');
  mkdirSync(join(dir, 'public', 'anim'), { recursive: true }); writeFileSync(join(dir, 'public', 'anim', 'walk.glb'), 'glb');
  return dir;
}
function site() {
  const dist = tempDir('hiraeth-site-');
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Hiraeth</title>');
  return dist;
}

test('the player\'s levels: UnityApi and the script\'s ScriptMinUnity, read from BridgeUpdates.cs', () => {
  const cs = src(UPDATES_CS);
  assert.ok(unityApi() >= 1);
  assert.ok(unityMinApi() >= 1 && unityMinApi() <= unityApi(), 'the script never needs a player newer than this one');
  assert.equal(unityApi('public const int UnityApi = 7;'), 7);
  assert.throws(() => unityApi('nothing'), /UnityApi/);
  assert.match(cs, /public const string Manifest = "https:\/\/hiraeth\.alexandria-rnaud\.workers\.dev\/updates\/unity\.json"/, 'beside web.json on the site');
  assert.match(cs, /public const float BootSeconds = 30;/, 'the boot watchdog, as the web app\'s 30 s');
  assert.match(cs, /public const int MaxTries = 2;/);
});

test('unityDecision is UpdateRules.Decide\'s table (the editor\'s TheManifestDecides)', () => {
  const s = 'a'.repeat(64), on = { unity: 1, current: 15000 };
  assert.equal(unityDecision({ build: 15010, minUnity: 1, sha256: s }, on), 'stage');
  assert.equal(unityDecision({ build: 15000, minUnity: 1, sha256: s }, on), 'skip', 'not newer');
  assert.equal(unityDecision({ build: 15010, minUnity: 1, sha256: s }, { ...on, bad: [15010] }), 'skip', 'failed before');
  assert.equal(unityDecision({ build: 15010, minUnity: 2, sha256: s }, on), 'player', 'needs a newer player first');
  assert.equal(unityDecision({ build: 15010, minUnity: 1, sha256: 'nope' }, on), 'skip', 'not one of ours');
  assert.equal(unityDecision({ build: 0, minUnity: 1, sha256: s }, on), 'skip');
  assert.equal(unityDecision({ build: 15010, minUnity: 1, sha256: 'g'.repeat(64) }, on), 'skip');
  assert.equal(unityDecision({ build: 15010, sha256: s }, on), 'stage', 'no minUnity: any player');
  const tests = src('unity/Hiraeth/Assets/HiraethJS/Editor/Tests/BridgeUpdatesTests.cs');
  for (const want of ['"stage", UpdateRules.Decide(15010, 1, sha', '"player", UpdateRules.Decide(15010, Api + 1', '"skip", UpdateRules.Decide(15010, 1, "nope"']) assert.ok(tests.includes(want), want);
});

test('unity-<build>.zip and unity.json beside web.json: the script folder without public/, its size, sha256 and minUnity', async () => {
  const dist = site(), dir = scriptDir(541, { minUnity: 1 });
  const previous = { build: 540, name: 'unity-540.zip', zip: Buffer.from('the previous script') };
  const m = await writeUpdate({ dist, build: 541, unity: { dir, previous } });
  const zip = readFileSync(join(dist, UPDATES, 'unity-541.zip'));
  const u = JSON.parse(readFileSync(join(dist, UPDATES, 'unity.json'), 'utf8'));
  assert.deepEqual(m.unity, u);
  assert.equal(JSON.parse(readFileSync(join(dist, UPDATES, 'web.json'), 'utf8')).unity, undefined, 'web.json stays as the web devices read it');
  assert.equal(u.build, 541);
  assert.equal(u.zip, `${SITE}${UPDATES}/unity-541.zip`);
  assert.equal(u.sha256, sha(zip));
  assert.equal(u.size, zip.length);
  assert.equal(u.minUnity, 1);
  assert.equal(u.apk, 'https://github.com/rnaud/hiraeth/releases/download/unity-android/hiraeth-unity.apk', 'the Android player a too-old one installs (#715)');
  assert.ok(Array.isArray(u.notes) && u.notes.length > 0, 'what it brings, for the Updates page');
  const files = Object.keys(unzip(zip)).sort();
  assert.deepEqual(files, ['audio.cjs', 'bundle.json', 'hiraeth.cjs', 'item-pictures/lamp.png'], 'no public/ (the player carries it), no .meta');
  assert.equal(JSON.parse(unzip(zip)['bundle.json']).build, 541);
  assert.equal(readFileSync(join(dist, UPDATES, 'unity-540.zip'), 'utf8'), 'the previous script', 'a player that read the old unity.json can finish');
  assert.ok(existsSync(join(dist, UPDATES, 'web-541.zip')));
});

test('a script folder of another build, or without its script, is refused', async () => {
  await assert.rejects(writeUnityUpdate({ out: tempDir('hiraeth-up-'), dir: scriptDir(540), build: 541 }), /bundle\.json is build 540, not 541/);
  const empty = tempDir('hiraeth-unity-empty-');
  writeFileSync(join(empty, 'bundle.json'), '{"build":541}');
  await assert.rejects(writeUnityUpdate({ out: tempDir('hiraeth-up-'), dir: empty, build: 541 }), /no hiraeth\.cjs/);
});

test('the previous Unity zip: kept from the live unity.json, as web\'s', async () => {
  const old = Buffer.from('unity zip 540');
  const routes = { 'updates/unity.json': { build: 540, sha256: sha(old) }, 'updates/unity-540.zip': old };
  const fetch = async (url) => { const r = routes[new URL(url).pathname.slice(1)]; return r === undefined ? new Response('', { status: 404 }) : new Response(Buffer.isBuffer(r) ? r : JSON.stringify(r)); };
  const got = await previousZip(SITE, 541, { fetch, log: () => {}, kind: 'unity' });
  assert.equal(got.name, 'unity-540.zip');
  assert.deepEqual(got.zip, old);
  assert.equal(await previousZip(SITE, 541, { fetch, log: () => {} }), null, 'web\'s own manifest is another');
});

test('a large Unity zip is split and streamed by the Worker like web\'s', async () => {
  const { default: worker } = await import('../worker/update-download.js');
  const dist = site(), dir = scriptDir(541);
  const m = await writeUpdate({ dist, build: 541, unity: { dir }, partSize: 100 });
  assert.equal(existsSync(join(dist, UPDATES, 'unity-541.zip')), false, 'in parts');
  const env = { ASSETS: { fetch: async (request) => { try { return new Response(readFileSync(join(dist, new URL(request.url).pathname))); } catch { return new Response(null, { status: 404 }); } } } };
  const zip = Buffer.from(await (await worker.fetch(new Request(m.unity.zip), env)).arrayBuffer());
  assert.equal(sha(zip), m.unity.sha256);
  assert.match(src('wrangler.jsonc'), /"\/updates\/unity-\*\.zip"/, 'the Worker runs first for the Unity zips');
  assert.match(src('scripts/check-deployment.mjs'), /\(web\|unity\)-\\d\+\\\.zip\\\.json/, 'the deploy\'s check reads them back');
});

test('the Cloudflare deploy publishes the Unity script with the web bundle', () => {
  const yml = src('.github/workflows/cloudflare.yml');
  assert.match(yml, /node scripts\/web-update\.mjs --live https:\/\/hiraeth\.alexandria-rnaud\.workers\.dev\/ --unity "\$RUNNER_TEMP\/unity-ota"/);
  assert.match(src('package.json'), /"deploy:cloudflare": "npm run build && node scripts\/web-update\.mjs --unity \.cache\/unity-ota/, 'a deploy by hand keeps unity.json on the site');
  const bundle = src('scripts/engine-bundle.mjs');
  assert.match(bundle, /export async function unityOta\(dir\)/);
  assert.match(bundle, /unityBundleJson\(to, \{ updates: true \}\)/, 'the script over the air looks for updates');
  assert.match(bundle, /process\.env\.UNITY_OTA \? process\.env\.UNITY_OTA === '1' : process\.env\.GITHUB_ACTIONS === 'true'/, 'a player made in Actions updates, a local one not');
  assert.match(src('scripts/unity-android-release.sh'), /UNITY_OTA=1/, 'the testers\' APK from a Mac updates as the CI one does');
});

test('the Updates page\'s words for a Unity player (src/updates.js platform unity)', () => {
  const base = { platform: 'unity', web: 15000, app: 15000, native: 1, bundle: false };
  const idle = updateView({ ...base, check: 'idle' }, { version: '1.80' });
  assert.equal(idle.legacy, false, 'every Unity player has the buttons');
  assert.equal(idle.running, 'v1.80 · build 15000 (built in) · player 15000');
  assert.deepEqual(idle.actions.map((a) => a.a), ['check']);
  const dl = updateView({ ...base, web: 15010, bundle: true, check: 'available', latest: 15020, latestVersion: '1.81', latestMin: 1, size: 6 * 1048576, notes: ['a'] }, { version: '1.80' });
  assert.equal(dl.running, 'v1.80 · build 15010 · player 15000', 'a downloaded script');
  assert.match(dl.title, /v1\.81 · build 15020 is available \(6\.0 MB\)/);
  const ready = updateView({ ...base, check: 'ready', ready: 15020, readyVersion: '1.81' }, { version: '1.80' });
  assert.match(ready.detail, /the next time the game starts/);
  const player = updateView({ ...base, check: 'apk', latest: 15020, latestVersion: '1.81', latestMin: 2 }, { version: '1.80' });
  assert.match(player.title, /needs a newer version of the player/);
  assert.deepEqual(player.actions.map((a) => a.a), ['check'], 'no APK page: the player\'s own update brings it');
  assert.match(updateView({ ...base, check: 'off' }).detail, /local build/);
  const err = updateView({ ...base, check: 'error', error: 'The download stopped', latest: 15020, latestMin: 1 });
  assert.equal(err.actions[0].a, 'download', 'a failed download can be tried again');
});

/** A BridgeHost stand-in: the player's state, what the page asked of it. */
function fakeHost(info) {
  const calls = [];
  const host = { info, UpdateInfo: () => JSON.stringify(host.info), UpdateCheck: (auto) => calls.push(['check', auto]), UpdateDownload: () => calls.push(['download']), UpdateRestart: () => calls.push(['restart']) };
  return { host, calls };
}
const memStore = () => { const m = new Map(); return new SlotStore({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }); };
const settings = () => ({ music: 0.8, effects: 1, voices: 0.8, mute: false, sensitivity: 1, invertY: false, hints: 'subtle', quality: 'auto', set(k, v) { this[k] = v; } });

test('Updates in the Start menu before Quit to title, and under Settings on the title, only in a player that has them', () => {
  const plain = new EngineMenus({ store: memStore(), settings: settings() });
  plain.show('start');
  assert.deepEqual(plain.view().side.map((e) => e.text), START_SIDE.map((e) => e.label()), 'none without updates');
  plain.show('title');
  assert.ok(!plain.view().rows.some((r) => r.text === 'Updates'));
  const { host } = fakeHost({ platform: 'unity', web: 15000, app: 15000, native: 1, check: 'idle' });
  const m = new EngineMenus({ store: memStore(), settings: settings(), updates: new UnityUpdates({ host, version: '1.80' }) });
  m.show('start');
  const side = m.view().side.map((e) => e.text);
  assert.equal(side.indexOf(UPDATES_SIDE.label()), side.length - 2, 'before Quit to title');
  m.show('title');
  assert.deepEqual(m.view().rows.map((r) => r.text), ['New game', 'Saves', 'Settings', 'Updates']);
  assert.ok(!new EngineMenus({ updates: new UnityUpdates({ host: {} }) }).hasUpdates(), 'a player from before them: none');
});

test('the Updates page: check, download with its progress, then the restart once it is in (the game saved first)', () => {
  const { host, calls } = fakeHost({ platform: 'unity', web: 15000, app: 15000, native: 1, check: 'idle' });
  let t = 0, saved = 0;
  const updates = new UnityUpdates({ host, version: '1.80', save: () => saved++, now: () => t });
  const m = new EngineMenus({ store: memStore(), settings: settings(), updates });
  m.show('title');
  m.navigate(0, 1); m.navigate(0, 1); m.navigate(0, 1);
  m.action('confirm');
  let v = m.view();
  assert.equal(v.screen, 'updates');
  assert.equal(v.head, 'UPDATES');
  const on = v.page.rows.find((r) => r.on);
  assert.equal(on.act, 'check', 'the cursor on the first button');
  assert.equal(v.page.rows[0].val, 'v1.80 · build 15000 (built in) · player 15000');
  m.action('confirm');
  assert.deepEqual(calls.at(-1), ['check', false]);
  host.info = { ...host.info, check: 'available', latest: 15020, latestVersion: '1.81', latestMin: 1, size: 4 << 20, notes: ['The desert at dusk', 'A new boat'] };
  t += 5000; m.tick();
  v = m.view();
  assert.ok(v.page.rows.some((r) => r.text.includes('v1.81 · build 15020 is available')));
  assert.ok(v.page.rows.some((r) => r.text === 'The desert at dusk'), 'what it brings');
  assert.ok(v.page.rows.find((r) => r.on)?.act, 'the rows moved under it: the cursor on the nearest button still');
  m.navigate(0, 1);
  assert.equal(m.view().page.rows.filter((r) => r.on).length, 1);
  assert.ok(m.view().page.rows.find((r) => r.on).act, 'up and down go from button to button');
  const dl = v.page.rows.findIndex((r) => r.act === 'download');
  while (m.view().page.rows.findIndex((r) => r.on) !== dl) m.navigate(0, 1);
  m.action('confirm');
  assert.deepEqual(calls.at(-1), ['download']);
  host.info = { ...host.info, check: 'downloading', got: 1 << 20, total: 4 << 20 };
  t += 500; m.tick();
  const bar = m.view().page.rows.find((r) => r.bar);
  assert.equal(bar.slider, 0.25);
  assert.match(bar.text, /25% · 1\.0 MB of 4\.0 MB/);
  host.info = { ...host.info, check: 'ready', ready: 15020, readyVersion: '1.81' };
  t += 500; m.tick();
  assert.deepEqual(calls.at(-1), ['restart'], 'armed: restarted once it is in');
  assert.equal(saved, 1, 'the game saved before');
  m.action('back');
  assert.equal(m.view().screen, 'main');
});

test('the title\'s own check: once a launch, auto (the player throttles it and downloads by itself)', () => {
  const { host, calls } = fakeHost({ platform: 'unity', web: 1, app: 1, native: 1, check: 'idle' });
  const u = new UnityUpdates({ host });
  u.auto(); u.auto();
  assert.deepEqual(calls, [['check', true]]);
  const game = src('engine/unity/game.js');
  assert.match(game, /menus\.show\('title'\); S\.titleSound = titleSound\(args, settings\); updates\.auto\(\);/, 'when the title first shows, never in a planned run');
  assert.match(game, /updates: updates\.on \? updates : null/);
});

test('the C# side: the store is a file, the script chosen at each start, its watchdog and first frame, Restart', () => {
  const host = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  const store = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeStore.cs');
  const runner = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  const ota = src(UPDATES_CS);
  assert.match(host, /public static string StorageGet\(string k\) => \(store \?\? Ask\(OpenStore\)\)\.Get\(k\);/);
  assert.doesNotMatch(host, /PlayerPrefs\.SetString/, 'nothing written to PlayerPrefs any more (8 KB a value on UWP)');
  // (issue #714: no hard links. .NET's File.Replace with a backup and File.Move link(2) on Unix, which Android's FUSE storage
  // refuses with EINVAL: on the AYN Odin 3 nothing after the first write reached the disk)
  assert.doesNotMatch(store, /File\.Replace\(Tmp, path, Backup/, 'no File.Replace with a backup (a hard link on Unix)');
  assert.match(store, /WriteDurable\(Backup \+ "\.tmp", File\.ReadAllBytes\(path\)\);\s*Rename\(Backup \+ "\.tmp", Backup\);/, 'the last good file copied to the backup');
  assert.match(store, /Rename\(Tmp, path\);/, 'then the new one renamed over store.json');
  assert.match(store, /DllImport\("libc", EntryPoint = "rename"/, 'rename(2) on the POSIX players');
  const rename = store.slice(store.indexOf('public static void Rename('), store.indexOf('[DllImport("libc"'));
  assert.ok(rename.indexOf('PosixRename') < rename.indexOf('File.Move(src, dst);\n            RenameWay = "move"'), 'File.Move (a link on Unix) only when there is no libc');
  assert.match(store, /f\.Flush\(true\)/, 'on the disk before it takes the place of the last');
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs'), /BridgeHost\.OpenStore\(\)\.Get\("hiraeth\.settings\.v1"\)/, 'the saved Graphics from the store');
  for (const [what, re] of [['the store opened first', /BridgeHost\.OpenStore\(\);/], ['the script chosen', /BridgeUpdates\.Choose\(\) is string ota/], ['the watchdog', /BridgeUpdates\.Watchdog\(\)/],
    ['trusted at its first frame', /BridgeUpdates\.FirstFrame\(\)/], ['a failed start back to the built-in', /BridgeUpdates\.Failed\("its start threw"\)/], ['flushed at the exit', /BridgeHost\.FlushStore\(\);/]]) assert.match(runner, re, what);
  assert.match(ota, /r\?\.Exit\(76\)/, 'the Deck\'s launcher starts the player again on 76 (deck.py RESTART_EXIT)');
  assert.match(src('scripts/steam-deck/deck.py'), /RESTART_EXIT = 76/);
  for (const f of ['BridgeStoreTests.cs', 'BridgeUpdatesTests.cs']) assert.ok(existsSync(new URL(`../unity/Hiraeth/Assets/HiraethJS/Editor/Tests/${f}`, import.meta.url)), f);
});
