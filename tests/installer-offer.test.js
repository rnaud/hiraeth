// "A newer version is available" (issue #805): the newest installer of each kind published where the apps look (the
// Unity players' player.json on each prerelease, read by the deploy into unity.json's players; the Android app's
// latest.json), and the offer each app makes when its own build is older: the decision (src/updates.js playerOffer,
// appOffer), its words and buttons, the Unity players' title card and Updates page (engine/unity/updates.js,
// engine/menus.js), and the C# and Java pieces' shape (BridgeApk, ApkInstaller.java, BridgeAndroidManifest, BridgeMenu.Offer;
// Updater.java: tests/android-ota.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tempDir } from '../scripts/temp-dirs.mjs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { playerRecord, validPlayer, playerUrl, unityJson, PLAYER_JSON } = await import('../scripts/release-info.mjs');
const { newestPlayers } = await import('../scripts/web-update.mjs');
const { playerOffer, playerOfferView, appOffer, updateView, OFFER_DISMISSED_KEY, APP_INSTALL_NATIVE } = await import('../src/updates.js');
const { UnityUpdates } = await import('../engine/unity/updates.js');
const { EngineMenus } = await import('../engine/menus.js');
const { SlotStore } = await import('../src/save-slots.js');

const root = new URL('..', import.meta.url).pathname;
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SHA = 'a'.repeat(64), COMMIT = '0123456789abcdef0123456789abcdef01234567';
const APK = 'https://github.com/rnaud/hiraeth/releases/download/unity-android/hiraeth-unity.apk';
const record = (platform, build = 3012, extra = {}) => playerRecord({ platform, build, version: '2.39', sha: COMMIT, size: 176_564_648, sha256: SHA, ...extra });

// ---------------------------------------------------------------- publishing

test('a player.json names its platform\'s own file on the game\'s releases, with its build, size and checksum', () => {
  const p = record('android');
  assert.deepEqual(p, { platform: 'android', build: 3012, version: '2.39', commit: COMMIT, url: APK, size: 176_564_648, sha256: SHA });
  assert.equal(PLAYER_JSON, 'player.json');
  assert.equal(playerUrl('linux'), 'https://github.com/rnaud/hiraeth/releases/download/unity-linux/hiraeth-unity-linux.tar.gz');
  assert.equal(playerUrl('xbox', 'o/r'), 'https://github.com/o/r/releases/download/unity-xbox/hiraeth-unity-xbox.zip');
  assert.ok(validPlayer('android', p));
  assert.ok(!validPlayer('linux', p), 'another platform\'s');
  assert.ok(!validPlayer('android', { ...p, url: 'https://example.com/x.apk' }), 'not on the releases');
  assert.ok(!validPlayer('android', { ...p, sha256: 'abc' }));
  assert.ok(!validPlayer('android', { ...p, size: 0 }));
  assert.ok(!validPlayer('android', { ...p, build: 0 }));
  assert.throws(() => record('ios'));
  assert.throws(() => record('android', 0));
});

test('release-info.mjs player-json reads the built commit\'s build and version and the file\'s size and sha256', { skip: !existsSync(join(root, '.git')) && 'no git checkout' }, () => {
  const dir = tempDir('player-json-'), file = join(dir, 'hiraeth-unity.apk');
  writeFileSync(file, 'a testers\' build');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const build = +execFileSync('git', ['rev-list', '--count', sha], { cwd: root, encoding: 'utf8' });
  const out = JSON.parse(execFileSync(process.execPath, ['scripts/release-info.mjs', 'player-json', 'android', sha, file], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: 'rnaud/hiraeth' } }));
  assert.equal(out.build, build);
  assert.equal(out.commit, sha);
  assert.equal(out.url, APK);
  assert.equal(out.size, readFileSync(file).length);
  assert.equal(out.sha256, createHash('sha256').update(readFileSync(file)).digest('hex'));
  assert.match(out.version, /^\d+\.\d+/);
});

test('unity-publish.sh puts player.json on the prerelease only after the build is up', () => {
  const sh = src('scripts/unity-publish.sh');
  const build = sh.indexOf('retry gh release upload "$TAG" "$TMP/$NAME"'), create = sh.indexOf('retry gh release create "$TAG" "$TMP/$NAME"');
  const record = sh.indexOf('player-json "$PLATFORM" "$SHA" "$FILE" > "$TMP/player.json"'), up = sh.indexOf('retry gh release upload "$TAG" "$TMP/player.json" -R "$REPO" --clobber');
  assert.ok(build > 0 && create > 0 && record > Math.max(build, create) && up > record, 'the record goes up after the file it names');
});

/** A fetch stand-in: GitHub's release files by URL ({ status, body, size }). */
const fakeFetch = (files) => async (url, opts = {}) => {
  const f = files[String(url)] ?? { status: 404 };
  return { ok: f.status === 200, status: f.status, json: async () => f.body, headers: { get: (k) => (k === 'content-length' && opts.method === 'HEAD' ? String(f.size ?? 0) : null) } };
};
const json = (tag) => `https://github.com/rnaud/hiraeth/releases/download/${tag}/player.json`;

test('the deploy advertises each platform\'s newest player only when its file is there at its size', async () => {
  const android = record('android'), linux = record('linux', 3010, { size: 300 }), xbox = record('xbox', 3001, { size: 60 });
  const logs = [];
  const players = await newestPlayers({
    log: (s) => logs.push(s),
    fetch: fakeFetch({
      [json('unity-android')]: { status: 200, body: android }, [android.url]: { status: 200, size: android.size },
      [json('unity-linux')]: { status: 200, body: linux }, [linux.url]: { status: 404 },   // (being replaced: missing)
      [json('unity-xbox')]: { status: 200, body: xbox }, [xbox.url]: { status: 200, size: 59 },   // (half there)
    }),
  });
  assert.deepEqual(Object.keys(players), ['android']);
  assert.deepEqual(players.android, { build: 3012, version: '2.39', commit: COMMIT, url: APK, size: android.size, sha256: SHA });
  assert.ok(logs.some((l) => /hiraeth-unity-linux\.tar\.gz on unity-linux is missing \(HTTP 404\)/.test(l)));
  assert.ok(logs.some((l) => /59 bytes, not 60/.test(l)));
  // no player.json yet, one not ours, offline: none, and the deploy goes on
  assert.deepEqual(await newestPlayers({ log() {}, fetch: fakeFetch({}) }), {});
  assert.deepEqual(await newestPlayers({ log() {}, fetch: fakeFetch({ [json('unity-android')]: { status: 200, body: { ...android, url: 'https://evil.example/x.apk' } } }) }), {});
  assert.deepEqual(await newestPlayers({ log() {}, fetch: async () => { throw new Error('offline'); } }), {});
});

test('unity.json carries players only when there are some; the deploy reads them unless --no-players', () => {
  const dir = tempDir('unity-json-'), file = join(dir, 'unity-1.zip');
  writeFileSync(file, 'zip');
  const base = { build: 1, version: '2.39', zip: 'https://x/updates/unity-1.zip', file, minUnity: 5, notes: [] };
  assert.ok(!('players' in unityJson(base)));
  assert.ok(!('players' in unityJson({ ...base, players: {} })));
  assert.deepEqual(unityJson({ ...base, players: { android: { build: 2 } } }).players, { android: { build: 2 } });
  const w = src('scripts/web-update.mjs');
  assert.match(w, /!args\.includes\('--no-players'\) \? await newestPlayers\(\) : null/);
  assert.match(w, /writeUnityUpdate\(\{ out, dir: unity\.dir, build, version, site, previous: unity\.previous \?\? null, partSize, players: unity\.players \?\? null \}\)/);
});

// ---------------------------------------------------------------- the decision

const players = { android: { build: 3012, version: '2.39', url: APK, size: 176_564_648, sha256: SHA }, linux: { ...record('linux', 3012) }, xbox: { ...record('xbox', 3012) } };
const unity = (o = {}) => ({ platform: 'unity', web: 2957, app: 2957, native: 5, check: 'current', players, os: 'android', apkInstall: true, openUrl: true, ...o });

test('a Unity player offers the newest player of its platform when its own build is older, and nothing otherwise', () => {
  assert.deepEqual(playerOffer(unity()), { platform: 'android', build: 3012, version: '2.39', size: 176_564_648, url: APK, sha256: SHA, how: 'install', dismissed: false }, 'older: install');
  assert.equal(playerOffer(unity({ app: 3012 })), null, 'the same build');
  assert.equal(playerOffer(unity({ app: 3050 })), null, 'a newer one installed by hand');
  assert.equal(playerOffer(unity({ players: {} })), null, 'no newest player advertised');
  assert.equal(playerOffer(unity({ players: undefined })), null, 'a feed from before players');
  assert.equal(playerOffer(unity({ players: { android: { ...players.android, url: '' } } })), null, 'no APK to point at');
  assert.equal(playerOffer(unity({ players: { android: { ...players.android, url: 'https://example.com/x.apk' } } })), null, 'not on the game\'s releases');
  assert.equal(playerOffer(unity({ players: { android: { ...players.android, sha256: '' } } })), null, 'no checksum');
  assert.equal(playerOffer(unity({ os: 'mac' })), null, 'a platform without a published player');
  assert.equal(playerOffer({ ...unity(), platform: undefined }), null, 'the Android app: appOffer instead');
  assert.equal(playerOffer(unity({ os: 'editor', playerPlatform: 'android' }))?.how, 'install', 'a test\'s -player-platform');
  assert.equal(playerOffer(unity({ apkInstall: false }))?.how, 'open', 'a player that can only open a link');
  assert.equal(playerOffer(unity({ apkInstall: false, openUrl: false }))?.how, 'notice');
  assert.equal(playerOffer(unity({ os: 'linux' }))?.how, 'notice', 'the Deck: notice only');
  assert.equal(playerOffer(unity({ os: 'xbox' }))?.how, 'notice', 'the Xbox: notice only');
  assert.equal(playerOffer(unity(), { dismissed: 3012 }).dismissed, true, '"Not now" to this build');
  assert.equal(playerOffer(unity(), { dismissed: 3001 }).dismissed, false, 'a newer build than the one dismissed');
});

test('what the offer says and offers: install with its progress on Android, how they update on the Deck and the Xbox', () => {
  const v = playerOfferView(playerOffer(unity()));
  assert.equal(v.title, 'A newer player is available: v2.39 · build 3012');
  assert.match(v.detail, /\(168 MB\) and Android installs it over this one\. Your saves are kept\./);
  assert.deepEqual(v.actions.map((a) => a.a), ['offer-install', 'offer-dismiss']);
  assert.deepEqual(v.card, { title: 'A newer player is available', sub: 'v2.39 · build 3012', how: 'Open Updates to install it' });
  const dl = playerOfferView(playerOffer(unity()), { state: 'downloading', got: 88_282_324, total: 176_564_648 });
  assert.equal(dl.progress, 0.5);
  assert.equal(dl.progressText, '50% · 84.2 MB of 168 MB');
  assert.deepEqual(dl.actions, [], 'nothing to press while it downloads');
  assert.ok(dl.busy);
  assert.match(dl.card.sub, /downloading 50%/);
  assert.match(playerOfferView(playerOffer(unity()), { state: 'permission' }).detail, /Allow Hiraeth \(Unity\) to install apps/);
  assert.equal(playerOfferView(playerOffer(unity()), { state: 'installing' }).actions[0].label, 'Open the installer again');
  const err = playerOfferView(playerOffer(unity()), { state: 'error', error: 'The download stopped (HTTP 503)' });
  assert.match(err.detail, /^The download stopped \(HTTP 503\)\. Download it/);
  assert.equal(err.actions[0].label, 'Try the download again');
  assert.deepEqual(playerOfferView(playerOffer(unity(), { dismissed: 3012 })).actions.map((a) => a.a), ['offer-install'], 'no Not now once said');
  const deck = playerOfferView(playerOffer(unity({ os: 'linux' })));
  assert.match(deck.detail, /Steam Deck its launcher brings the new player: quit Hiraeth and launch it again/);
  assert.deepEqual(deck.actions.map((a) => a.a), ['offer-dismiss'], 'the Deck: a notice, dismissable');
  const xbox = playerOfferView(playerOffer(unity({ os: 'xbox' })));
  assert.match(xbox.detail, /Device Portal/);
  assert.deepEqual(xbox.actions.map((a) => a.a), ['offer-dismiss']);
  assert.deepEqual(playerOfferView(playerOffer(unity({ apkInstall: false }))).actions.map((a) => a.a), ['offer-open', 'offer-dismiss']);
  assert.equal(playerOfferView(null), null);
});

test('the Android app offers a newer APK than its own, installed by the app from NATIVE_API 10', () => {
  const app = (o = {}) => ({ web: 3000, app: 3000, native: APP_INSTALL_NATIVE, check: 'current', checkedAt: 1, apkBuild: 3012, apkVersion: '2.39', apkState: 'idle', ...o });
  assert.equal(appOffer(app({ apkBuild: 3000 })), null, 'the same build');
  assert.equal(appOffer(app({ apkBuild: 0 })), null, 'none read');
  assert.equal(appOffer(app({ check: 'apk' })), null, 'the game needs it: its own words');
  assert.equal(appOffer(app({ platform: 'deck' })), null);
  const o = appOffer(app());
  assert.equal(o.how, 'install');
  assert.deepEqual(o.action, { a: 'app-install', label: 'Install the new app' });
  assert.equal(appOffer(app({ native: 9 })).action.a, 'apk', 'an app before installApk: the release page');
  const dl = appOffer(app({ apkState: 'downloading', apkGot: 50, apkTotal: 100 }));
  assert.equal(dl.progress, 0.5);
  assert.equal(dl.action, null);
  const v = updateView(app(), { version: '2.39' });
  assert.equal(v.title, 'You have the newest game');
  assert.match(v.detail, /A new app is available: v2\.39 · build 3012\. It installs over this one and keeps your saves\./);
  assert.deepEqual(v.actions.map((a) => a.a), ['check', 'app-install']);
  const busy = updateView(app({ apkState: 'downloading', apkGot: 25, apkTotal: 100 }), { version: '2.39' });
  assert.equal(busy.progress, 0.25);
  assert.ok(busy.busy);
  assert.ok(!updateView(app({ apkBuild: 0 }), { version: '2.39' }).actions.some((a) => a.a === 'app-install'));
});

// ---------------------------------------------------------------- the Unity players' title and Updates page

function fakeHost(info, apk = { state: 'idle', got: 0, total: 0, error: '' }) {
  const calls = [];
  const host = {
    info, apk, UpdateInfo: () => JSON.stringify(host.info), UpdateCheck: (auto) => calls.push(['check', auto]), UpdateDownload: () => calls.push(['download']),
    UpdateRestart: () => calls.push(['restart']), Platform: () => info.os, OpenUrl: (u) => calls.push(['open', u]),
    ApkInfo: () => JSON.stringify(host.apk), ApkInstall: (b) => calls.push(['install', b]),
  };
  return { host, calls };
}
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const settings = () => ({ music: 0.8, effects: 1, voices: 0.8, mute: false, sensitivity: 1, invertY: false, hints: 'subtle', quality: 'auto', set(k, v) { this[k] = v; } });

test('the title shows the offer\'s card and says it under Updates; "Not now" hides it until a newer build', () => {
  const info = unity();
  delete info.os;
  const { host, calls } = fakeHost({ ...info, os: 'android' });
  let t = 0;
  const storage = memory();
  const updates = new UnityUpdates({ host, version: '2.33', now: () => t, storage });
  const m = new EngineMenus({ store: new SlotStore(memory()), settings: settings(), updates });
  m.show('title');
  m.tick();   // (the title reads the player's state)
  let v = m.view();
  assert.deepEqual(v.offer, { title: 'A newer player is available', sub: 'v2.39 · build 3012', how: 'Open Updates to install it', progress: null });
  assert.equal(v.rows.find((r) => r.text === 'Updates').sub, 'A newer player is available');
  // the page: the offer first, then the script's updates as before
  const rows = updates.rows();
  assert.equal(rows[0].text, 'Playing');
  assert.equal(rows[1].text, 'A newer player is available: v2.39 · build 3012');
  assert.deepEqual(rows.filter((r) => r.act).map((r) => r.act), ['offer-install', 'offer-dismiss', 'check']);
  // (the player starts its download as it is pressed: BridgeApk.Install)
  host.ApkInstall = (b) => { calls.push(['install', b]); host.apk = { state: 'downloading', got: 88_282_324, total: 176_564_648 }; };
  updates.act('offer-install');
  assert.deepEqual(calls.at(-1), ['install', 3012]);
  // its download's progress on the card, polled close while it runs (never every frame)
  t += 500; m.tick();
  assert.equal(m.view().offer.progress, 0.5);
  t += 100;
  assert.equal(updates.titleTick(), false, 'not again within 400 ms');
  host.apk = { state: 'idle' };
  t += 500; m.tick();
  updates.act('offer-dismiss');
  assert.equal(storage.getItem(OFFER_DISMISSED_KEY), '3012');
  t += 5000; m.tick();
  v = m.view();
  assert.equal(v.offer, undefined, 'dismissed: no card');
  assert.equal(v.rows.find((r) => r.text === 'Updates').sub, '');
  assert.ok(updates.rows().some((r) => r.act === 'offer-install'), 'the page still offers it, without Not now');
  assert.ok(!updates.rows().some((r) => r.act === 'offer-dismiss'));
  // a newer build than the one dismissed: the card again
  host.info = { ...host.info, players: { ...players, android: { ...players.android, build: 3020 } } };
  t += 5000; m.tick();
  assert.match(m.view().offer.sub, /build 3020/);
  // a tap on the card: the Updates page
  m.pointer({ how: 'press', pt: 'offer' });
  assert.equal(m.title.screen, 'updates');
  // a stale press does nothing
  const before = calls.length;
  updates.act('offer-open');
  assert.equal(calls.length, before);
});

test('the Deck and the Xbox only say how they update; an older player\'s script goes on as before', () => {
  for (const os of ['linux', 'xbox']) {
    const { host, calls } = fakeHost({ ...unity({ os, apkInstall: false }) });
    delete host.ApkInfo; delete host.ApkInstall;
    const updates = new UnityUpdates({ host, storage: memory() });
    updates.read();
    assert.equal(updates.titleOffer().how, os === 'linux' ? 'Relaunch to update' : 'Install it through the Device Portal');
    assert.deepEqual(updates.rows().filter((r) => r.act).map((r) => r.act), ['offer-dismiss', 'check']);
    updates.act('offer-install');
    assert.equal(calls.length, 0, 'nothing to install there');
  }
  // a player from before players (no ApkInfo, no players in its info): no offer, the page as before
  const { host } = fakeHost({ platform: 'unity', web: 2957, app: 2957, native: 5, check: 'current', os: 'android' });
  delete host.ApkInfo; delete host.ApkInstall;
  const old = new UnityUpdates({ host, storage: memory() });
  old.read();
  assert.equal(old.titleOffer(), null);
  assert.equal(old.rows()[1].text, 'You have the newest game');
});

// ---------------------------------------------------------------- the C# and Java pieces

test('the Unity player: the feed\'s players in its info, the APK downloaded and checked, then Android\'s installer', () => {
  const upd = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeUpdates.cs'), host = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  const apk = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeApk.cs'), java = src('unity/Hiraeth/Assets/HiraethJS/Android/ApkInstaller.java');
  assert.match(upd, /\["players"\] = manifest\?\.Get\("players"\) as Dictionary<string, object> \?\? new Dictionary<string, object>\(\)/);
  assert.match(upd, /\["playerPlatform"\] = BridgeArgs\.Arg\("-player-platform"\) \?\? ""/);
  assert.match(upd, /\["apkInstall"\] = BridgeApk\.Supported/);
  assert.match(host, /public static string ApkInfo\(\) => Ask\(BridgeApk\.Info\);/);
  assert.match(host, /public static void ApkInstall\(int build\) => On\(\(\) => BridgeApk\.Install\(build\)\);/);
  // only the feed's newer build, from the game's releases, at its size and sha256 (checked off the main thread)
  assert.match(apk, /var p = BridgeUpdates\.NewestPlayer\("android"\);/);
  assert.match(apk, /if \(build != want\) return/);
  assert.match(apk, /if \(build <= own\) return/);
  assert.match(apk, /!url\.StartsWith\(Releases, StringComparison\.Ordinal\) \|\| !UpdateRules\.OpenableUrl\(url\)/);
  assert.match(apk, /new DownloadHandlerFile\(to\) \{ removeFileOnAbort = true \}/);
  assert.match(apk, /got = \(long\)req\.downloadedBytes;/, 'its progress');
  assert.match(apk, /new Thread\(\(\) => \{ try \{ fail = Check\(to, size, sha\);/);
  assert.match(apk, /if \(len != size\) return[\s\S]*?SHA256\.Create\(\)/);
  assert.match(apk, /#if UNITY_ANDROID && !UNITY_EDITOR[\s\S]*?new AndroidJavaClass\(JavaClass\)[\s\S]*?CallStatic<string>\("install", UnityEngine\.Android\.AndroidApplication\.currentActivity, path\)/);
  assert.match(apk, /const string JavaClass = "com\.rnaud\.hiraeth\.bridge\.ApkInstaller";/);
  assert.match(java, /^package com\.rnaud\.hiraeth\.bridge;/m);
  assert.match(java, /public final class ApkInstaller/);
  assert.match(java, /public static String install\(final Activity activity, final String path\)/);
  assert.match(java, /canRequestPackageInstalls\(\)[\s\S]*?ACTION_MANAGE_UNKNOWN_APP_SOURCES[\s\S]*?return status = "permission"/);
  assert.match(java, /getPackageInstaller\(\)[\s\S]*?createSession[\s\S]*?openWrite[\s\S]*?fsync[\s\S]*?commit\(PendingIntent\.getBroadcast/);
  assert.match(java, /STATUS_PENDING_USER_ACTION[\s\S]*?EXTRA_INTENT[\s\S]*?startActivity\(confirm\)/);
  assert.match(java, /RECEIVER_NOT_EXPORTED/);
  assert.match(java, /new Intent\(action\)\.setPackage\(ctx\.getPackageName\(\)\)/, 'explicit: Android 14 refuses a mutable implicit one');
  assert.match(src('unity/Hiraeth/Assets/HiraethJS/Android/ApkInstaller.java.meta'), /Android: Android\n\s+second:\n\s+enabled: 1/, 'built into the Android player only');
  // the permission in the generated manifest, with the Gradle project (UnityEditor.CoreModule: also in an editor without Android)
  const man = src('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeAndroidManifest.cs');
  assert.match(man, /class BridgeAndroidManifest : IPostGenerateGradleAndroidProject/);
  assert.match(man, /"android\.permission\.REQUEST_INSTALL_PACKAGES"/);
  assert.match(man, /Path\.Combine\(path, "src", "main", "AndroidManifest\.xml"\)/, 'the unityLibrary manifest');
  assert.match(man, /if \(xml\.Contains\("\\"" \+ Permission \+ "\\""\)\) return xml;/, 'once');
  assert.match(man, /xml\.IndexOf\("<application"[\s\S]*?xml\.Insert\(at, line\)/, 'before <application>');
});

test('the title\'s card is drawn in the enamel, hidden with the rest and tapped through to Updates', () => {
  const menu = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs'), offer = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Offer.cs');
  assert.match(menu, /OfferHide\(\);/);
  assert.match(menu, /DrawOffer\(state\.O\("offer"\)\);/);
  assert.match(offer, /Ui\.Panel\(root, "player offer", Ui\.Hex\("#161d1d", 0\.94f\), EnLine/);
  assert.match(offer, /EnAccent[\s\S]*?EnBrass[\s\S]*?EnInk/);
  assert.match(offer, /Hit\(offerBox\.rt, "offer"\);/);
  assert.match(src('engine/menus.js'), /k === 'offer'\) \{ if \(press && this\.hasUpdates\(\)\) \{ T\.screen = 'updates';/);
});
