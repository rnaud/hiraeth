import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeApi, latestJson, webJson, webDecision } from '../scripts/release-info.mjs';
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

test('web.json: version, run number, the zip\'s sha256, its URL and the native level it needs', () => {
  const zip = join(mkdtempSync(join(tmpdir(), 'moebius-ota-')), 'web.zip');
  writeFileSync(zip, 'not really a zip');
  const sha = createHash('sha256').update('not really a zip').digest('hex');
  assert.deepEqual(webJson({ build: 14, version: '0.37', zip: 'https://x/web.zip', file: zip, native: 2 }),
    { version: '0.37', build: 14, sha256: sha, zip: 'https://x/web.zip', minNative: 2 });
  // as the workflow runs it
  assert.deepEqual(JSON.parse(run('web-json', '14', zip, 'https://x/web.zip')),
    { version: CHANGELOG[0].v, build: 14, sha256: sha, zip: 'https://x/web.zip', minNative: nativeApi() });
  assert.deepEqual(JSON.parse(run('latest-json', '14', 'https://x/a.apk')), { code: 14, name: CHANGELOG[0].v, apk: 'https://x/a.apk', native: nativeApi() });
  assert.deepEqual(latestJson({ build: 3, version: '1', apk: 'u', native: 2 }), { code: 3, name: '1', apk: 'u', native: 2 });
  assert.equal(run('version').trim(), CHANGELOG[0].v);
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

test('WebBundles.decide mirrors webDecision', () => {
  const src = java('WebBundles.java');
  const body = /static String decide\(int build, int minNative, int nativeApi, int current, boolean bad\) \{([\s\S]*?)\n {4}\}/.exec(src)?.[1];
  assert.ok(body, 'decide() is there');
  assert.match(body, /if \(minNative > nativeApi\) return "apk";/);
  assert.match(body, /if \(bad \|\| build <= current\) return "skip";/);
  assert.match(body, /return "stage";/);
  assert.match(src, /optInt\("minNative", NATIVE_API\)/, 'a manifest without minNative needs this level, as in webDecision');
  // current = the newest build on the device: built in (versionCode), in use or pending
  assert.match(src, /Math\.max\(builtin, Math\.max\(prefs\.getInt\("active", 0\), ready\(\)\)\)/);
});

test('the APK updater only asks for native changes, and the web update yields to it', () => {
  const src = java('Updater.java');
  assert.match(src, /latest\.optInt\("native", 0\) > WebBundles\.NATIVE_API/);
  assert.match(src, /if \(!offered && web != null\) web\.update\(\);/);
});

test('the workflow publishes web.zip and both manifests', () => {
  const yml = readFileSync(new URL('../.github/workflows/android.yml', import.meta.url), 'utf8');
  assert.match(yml, /zip -q -r -X "\$RUNNER_TEMP\/web\.zip" \./);
  assert.match(yml, /release-info\.mjs web-json/);
  assert.match(yml, /release-info\.mjs latest-json/);
  const zipUp = yml.indexOf('"$RUNNER_TEMP/web.zip" --clobber'), jsonUp = yml.indexOf('"$RUNNER_TEMP/web.json" --clobber');
  assert.ok(zipUp > 0 && zipUp < jsonUp, 'the zip goes up before the manifest that points at it');
});

test('saves survive bundle switches: one fixed origin', () => {
  // Capacitor serves every bundle (APK assets or downloaded files) at <androidScheme>://<hostname>;
  // pin them so a change of defaults can't move localStorage
  const cfg = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(cfg.server?.androidScheme, 'https');
  assert.equal(cfg.server?.hostname, 'localhost');
});
