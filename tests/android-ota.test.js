import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeApi, webMinNative, desktopApi, gameBuild, LAST_RUN_NUMBER_BUILD, latestJson, webJson, webDecision, staleWebZips, releasePage, releaseNotes } from '../scripts/release-info.mjs';
import { CHANGELOG } from '../src/changelog.js';

const java = (name) => readFileSync(new URL(`../android/app/src/main/java/com/rnaud/moebius/${name}`, import.meta.url), 'utf8');
const script = fileURLToPath(new URL('../scripts/release-info.mjs', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('the native level comes from WebBundles.NATIVE_API', () => {
  assert.equal(nativeApi(), +/NATIVE_API = (\d+);/.exec(java('WebBundles.java'))[1]);
  assert.ok(nativeApi() >= 2, 'the over-the-air app is level 2');
  assert.equal(nativeApi('    static final int NATIVE_API = 7;'), 7);
  assert.throws(() => nativeApi('class Nothing {}'));
  assert.equal(run('native').trim(), String(nativeApi()));
});

test('the levels: what the app is, what the web game needs (WEB_MIN_NATIVE), what the Deck runtime is', () => {
  const src = java('WebBundles.java');
  assert.equal(webMinNative(), +/WEB_MIN_NATIVE = (\d+);/.exec(src)[1]);
  assert.equal(run('web-min-native').trim(), String(webMinNative()));
  assert.ok(webMinNative() <= nativeApi(), 'an app runs the web game it carries');
  assert.ok(nativeApi() >= 5, 'NATIVE_API 5: the updates from the game\'s site');
  assert.ok(webMinNative() <= 4, 'apps from NATIVE_API 4 keep taking the game\'s updates (from GitHub, until the repository is private)');
  assert.equal(desktopApi(), +/export const DESKTOP_API = (\d+);/.exec(readFileSync(new URL('../desktop/main.mjs', import.meta.url), 'utf8'))[1]);
  assert.throws(() => webMinNative('class Nothing {}'));
});

test('the build number: the commit count, the same in every workflow, above the run-numbered builds', () => {
  const fake = (shallow, count) => (...a) => (a[0] === 'rev-parse' ? String(shallow) : String(count));
  assert.equal(gameBuild({ run: fake(false, 541) }), 541);
  assert.throws(() => gameBuild({ run: fake(true, 541) }), /fetch-depth: 0/, 'a shallow clone would count 1');
  assert.throws(() => gameBuild({ run: fake(false, LAST_RUN_NUMBER_BUILD) }), /not above/, 'never back below the APKs out there');
  assert.equal(LAST_RUN_NUMBER_BUILD, 117, 'the last APK numbered by its run (v0.59)');
  let real;
  try { real = gameBuild(); } catch (e) { if (!/shallow/.test(e.message)) throw e; }
  if (real) assert.equal(run('build').trim(), String(real));
  for (const f of ['android.yml', 'cloudflare.yml', 'steam-deck.yml']) {
    assert.match(readFileSync(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf8'), /fetch-depth: 0/, `${f} checks out the whole history`);
  }
  const yml = readFileSync(new URL('../.github/workflows/android.yml', import.meta.url), 'utf8');
  assert.match(yml, /echo "build=\$\(node scripts\/release-info\.mjs build\)"/);
  assert.match(yml, /APP_VERSION_CODE: \$\{\{ steps\.meta\.outputs\.build \}\}/, 'versionCode = the build the app compares a web bundle with');
  assert.doesNotMatch(yml, /run_number/, 'no run numbers left in the Android build');
  assert.match(readFileSync(new URL('../.github/workflows/steam-deck.yml', import.meta.url), 'utf8'), /WEB_BUILD=\$\(node scripts\/release-info\.mjs build\)/);
});

test('the game\'s updates come from its site; the APK still from GitHub releases', () => {
  const src = java('WebBundles.java'), up = java('Updater.java');
  assert.match(src, /MANIFEST = "https:\/\/memento\.alexandria-rnaud\.workers\.dev\/updates\/web\.json"/);
  assert.match(src, /RELEASES = "https:\/\/github\.com\/rnaud\/moebius\/releases\/latest"/);
  assert.match(up, /LATEST = "https:\/\/github\.com\/rnaud\/moebius\/releases\/latest\/download\/latest\.json"/, 'apps up to NATIVE_API 4 read it here too: it brings them this APK');
  // the APK feed failing is never an update error: only a quiet note in the settings
  assert.match(up, /catch \(Exception e\) \{[^}]*web\.apkChecked\(e\);/);
  assert.match(src, /void apkChecked\(Exception failure\)/);
  assert.match(src, /ret\.put\("apkCheck", apkCheck\);/);
  const find = /private void findApk\(\) \{([\s\S]*?)\n {4}\}/.exec(src)?.[1];
  assert.ok(find);
  assert.doesNotMatch(find, /status\(|error = /, 'a failed APK lookup leaves the update state alone');
  const deck = readFileSync(new URL('../scripts/steam-deck/deck.py', import.meta.url), 'utf8');
  assert.match(deck, /CONTENT_URL = 'https:\/\/memento\.alexandria-rnaud\.workers\.dev\/updates\/'/, 'the Deck reads the same web.json');
});

test('web.json: version, build number, the zip\'s sha256, its URL, size, notes and the native level it needs', () => {
  const zip = join(mkdtempSync(join(tmpdir(), 'moebius-ota-')), 'web-14.zip');
  writeFileSync(zip, 'not really a zip');
  const sha = createHash('sha256').update('not really a zip').digest('hex');
  const url = 'https://example.com/o/r/releases/download/v0.37/web-14.zip';
  assert.deepEqual(webJson({ build: 14, version: '0.37', zip: url, file: zip, native: 2, notes: ['a', 'b'] }),
    { version: '0.37', build: 14, sha256: sha, zip: url, minNative: 2, size: 16, notes: ['a', 'b'], page: 'https://example.com/o/r/releases/tag/v0.37' });
  // as the workflow runs it
  assert.deepEqual(JSON.parse(run('web-json', '14', zip, 'https://x/web-14.zip')),
    { version: CHANGELOG[0].v, build: 14, sha256: sha, zip: 'https://x/web-14.zip', minNative: webMinNative(), size: 16, notes: releaseNotes() });
  assert.equal(webJson({ build: 14, version: '1', zip: 'u', file: zip, native: 4, desktop: 2, notes: [] }).minDesktop, 2, 'the Deck runtime level, for the site\'s web.json');
  assert.deepEqual(releaseNotes(), CHANGELOG[0].items.slice(0, 12), 'the newest changelog lines, for the settings');
  assert.deepEqual(JSON.parse(run('latest-json', '14', 'https://x/a.apk')), { code: 14, name: CHANGELOG[0].v, apk: 'https://x/a.apk', native: nativeApi() });
  assert.deepEqual(latestJson({ build: 3, version: '1', apk: 'u', native: 2 }), { code: 3, name: '1', apk: 'u', native: 2 });
  assert.equal(latestJson({ build: 3, version: '1', apk: 'https://example.com/o/r/releases/download/v1/a.apk', native: 2 }).page, 'https://example.com/o/r/releases/tag/v1');
  assert.equal(releasePage('https://example.com/a.apk'), undefined);
  assert.equal(run('version').trim(), CHANGELOG[0].v);
});

test('a release keeps the newest two web zips (one may still be downloading)', () => {
  const names = ['moebius-v0.56.apk', 'web.json', 'latest.json', 'web-110.zip', 'web-108.zip', 'web-111.zip', 'web.zip'];
  assert.deepEqual(staleWebZips(names), ['web-108.zip', 'web.zip']);
  assert.deepEqual(staleWebZips(['web.zip', 'web-110.zip']), [], 'the old plain web.zip stays until two named ones are up');
  assert.deepEqual(staleWebZips(['web-110.zip', 'web-111.zip']), []);
  assert.deepEqual(run('web-zips', ...names).trim().split('\n'), ['web-108.zip', 'web.zip']);
});

test('which web builds the app takes', () => {
  const on = { native: 2, current: 12 };
  assert.equal(webDecision({ build: 14, minNative: 2 }, on), 'stage', 'newer, and this app can run it');
  assert.equal(webDecision({ build: 12, minNative: 2 }, on), 'skip', 'the same build as on the device');
  assert.equal(webDecision({ build: 11, minNative: 1 }, on), 'skip', 'older');
  assert.equal(webDecision({ build: 14, minNative: 1 }, on), 'stage', 'an older native level is fine');
  assert.equal(webDecision({ build: 14, minNative: 3 }, on), 'apk', 'needs a newer app: the APK update comes first');
  assert.equal(webDecision({ build: 11, minNative: 3 }, on), 'apk');
  assert.equal(webDecision({ build: 14, minNative: 2 }, { ...on, bad: [14] }), 'skip', 'a build that failed to boot is never retried');
  assert.equal(webDecision({ build: 14 }, on), 'stage', 'no minNative: this level');
});

test('UpdateRules.decide mirrors webDecision', () => {
  const rules = java('UpdateRules.java'), src = java('WebBundles.java');
  const body = /static String decide\(int build, int minNative, int nativeApi, int current, boolean bad\) \{([\s\S]*?)\n {4}\}/.exec(rules)?.[1];
  assert.ok(body, 'decide() is there');
  assert.match(body, /if \(minNative > nativeApi\) return "apk";/);
  assert.match(body, /if \(bad \|\| build <= current\) return "skip";/);
  assert.match(body, /return "stage";/);
  assert.match(src, /optInt\("minNative", NATIVE_API\)/, 'a manifest without minNative needs this level, as in webDecision');
  // current = the newest build on the device: built in (versionCode), in use or pending
  assert.match(src, /Math\.max\(builtin, Math\.max\(prefs\.getInt\("active", 0\), ready\(\)\)\)/);
  assert.match(src, /UpdateRules\.decide\(build, minNative, NATIVE_API, current, bad\)/);
});

test('the check: past the caches, on every return to the app, retried, one at a time', () => {
  const src = java('WebBundles.java'), up = java('Updater.java'), main = java('MainActivity.java');
  // web.json and latest.json with a changing query and no-cache
  assert.match(src, /Updater\.fetch\(UpdateRules\.bust\(manifestUrl, System\.currentTimeMillis\(\)\)/);
  assert.match(up, /setUseCaches\(false\)/);
  assert.match(up, /setRequestProperty\("Cache-Control", "no-cache"\)/);
  // launch and resume both go through onResume (MainActivity calls it), throttled by UpdateRules.dueOnResume
  assert.match(main, /bundles\.onResume\(\);/);
  assert.match(src, /if \(UpdateRules\.dueOnResume\(SystemClock\.elapsedRealtime\(\), checkedAt, state\)\) checkAsync\(true, why\);/);
  // a failed automatic check retries; only one check or download runs at a time (across activity recreations)
  assert.match(src, /if \(auto\) scheduleRetry\(\);/);
  assert.match(src, /private static boolean working;/);
  assert.match(src, /synchronized \(LOCK\) \{\s*if \(working\) return;\s*working = true;/);
  // an interrupted download goes on from where it stopped (a Range request)
  assert.match(up, /setRequestProperty\("Range", "bytes=" \+ from \+ "-"\)/);
  assert.match(src, /new FileOutputStream\(to, append\)/);
});

test('a build that booted once is trusted: a slow world later doesn\'t drop it', () => {
  const src = java('WebBundles.java');
  const tick = /private void tick\(int forPage\) \{([\s\S]*?)\n {4}\}/.exec(src)?.[1];
  assert.ok(tick);
  assert.match(tick, /if \(prefs\.getInt\("good", 0\) == serving\) \{ booted = true; return; \}/);
});

test('nothing in the update path touches the saves (the page\'s storage)', () => {
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const f of ['WebBundles.java', 'Updater.java', 'AppShellPlugin.java', 'AppShell.java', 'MainActivity.java', 'WebViewActivity.java', 'AssetServer.java']) {
    assert.doesNotMatch(code(java(f)), /WebStorage|clearCache|deleteDatabase|clearFormData|CookieManager|localStorage/, f);
  }
  for (const f of ['../src/update-panel.js', '../src/updates.js']) {
    assert.doesNotMatch(code(readFileSync(new URL(f, import.meta.url), 'utf8')), /localStorage|removeItem|\.clear\(/, f);
  }
});

test('the APK updater only asks for native changes', () => {
  const src = java('Updater.java');
  assert.match(src, /latest\.optInt\("native", 0\) > WebBundles\.NATIVE_API/);
  assert.match(src, /web\.apkOffered\(name, apk, /, 'the settings know about the APK it offered');
});

test('the workflow publishes the APK and its manifest, never half', () => {
  const yml = readFileSync(new URL('../.github/workflows/android.yml', import.meta.url), 'utf8');
  // the repository is private: the game's updates come from the site only, no web zip on GitHub (docs/cloudflare.md)
  assert.doesNotMatch(yml, /TRANSITION|web-\$BUILD\.zip|web\.json|web-zips/);
  assert.match(yml, /release-info\.mjs latest-json/);
  const apkUp = yml.indexOf('"$APK" --clobber'), jsonUp = yml.indexOf('"$RUNNER_TEMP/latest.json" --clobber');
  assert.ok(apkUp > 0 && apkUp < jsonUp, 'the APK goes up before the manifest that points at it');
  // a new release is made with every file at once (gh keeps it a draft until they are up)
  assert.match(yml, /gh release create "\$TAG" "\$APK" "\$RUNNER_TEMP\/latest\.json"/);
  // a run publishing is never cancelled (that left the newest release without its manifest)
  assert.match(yml, /concurrency:\s*\n\s*group: android-release\s*\n\s*cancel-in-progress: false/);
});

test('saves survive bundle switches: one fixed origin', () => {
  // Capacitor serves every bundle (APK assets or downloaded files) at <androidScheme>://<hostname>;
  // pin them so a change of defaults can't move localStorage
  const cfg = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(cfg.server?.androidScheme, 'https');
  assert.equal(cfg.server?.hostname, 'localhost');
});

test('the Deck keeps its screen on while the game runs (no dimming or sleep mid-game)', () => {
  const main = readFileSync(new URL('../desktop/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /powerSaveBlocker\.start\('prevent-display-sleep'\)/);
});

test('the Deck runs on Wayland on its desktop and on X11 under gamescope (Gaming Mode)', () => {
  const main = readFileSync(new URL('../desktop/main.mjs', import.meta.url), 'utf8');
  const src = /export function ozonePlatform[\s\S]*?\n\}/.exec(main)[0].replace('export ', '');
  const ozonePlatform = new Function(`${src}; return ozonePlatform;`)();
  assert.equal(ozonePlatform({ WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0', XDG_CURRENT_DESKTOP: 'KDE' }), 'wayland', 'Desktop Mode');
  assert.equal(ozonePlatform({ WAYLAND_DISPLAY: 'wayland-0', GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0', DISPLAY: ':1' }), 'x11', 'nested in gamescope');
  assert.equal(ozonePlatform({ DISPLAY: ':0', XDG_CURRENT_DESKTOP: 'gamescope' }), 'x11', 'Gaming Mode');
  assert.equal(ozonePlatform({ DISPLAY: ':0' }), 'x11', 'a plain X11 desktop');
  assert.match(main, /appendSwitch\('ozone-platform', ozonePlatform\(\)\)/);
});
