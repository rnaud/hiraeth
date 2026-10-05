// Release metadata for the Android workflow, from the newest entry in src/changelog.js.
//   node scripts/release-info.mjs version                → 0.34
//   node scripts/release-info.mjs notes                  → markdown release notes for that version
//   node scripts/release-info.mjs native                 → the app's native bridge level (WebBundles.NATIVE_API)
//   node scripts/release-info.mjs latest-json <build> <apk url>        → latest.json, read by Updater.java
//   node scripts/release-info.mjs web-json <build> <web.zip> <zip url> → web.json, read by WebBundles.java
//   node scripts/release-info.mjs web-zips <asset names…>              → the web zips a release can delete (staleWebZips)
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG } from '../src/changelog.js';

const BUNDLES_JAVA = fileURLToPath(new URL('../android/app/src/main/java/com/rnaud/moebius/WebBundles.java', import.meta.url));

/** NATIVE_API from WebBundles.java: bumped whenever the native bridge changes. */
export function nativeApi(source = readFileSync(BUNDLES_JAVA, 'utf8')) {
  const m = /static final int NATIVE_API = (\d+);/.exec(source);
  if (!m) throw new Error('NATIVE_API not found in WebBundles.java');
  return +m[1];
}

/** The release page next to a download URL (…/releases/download/v0.56/x → …/releases/tag/v0.56); mirrors UpdateRules.pageFor. */
export function releasePage(url) {
  const m = /^(.*)\/releases\/download\/([^/]+)\//.exec(url ?? '');
  return m ? `${m[1]}/releases/tag/${m[2]}` : undefined;
}

/** The APK manifest. Apps from before v0.37 compare `code`; newer ones only take an APK whose `native` is newer. */
export const latestJson = ({ build, version, apk, native = nativeApi() }) => {
  const page = releasePage(apk);
  return { code: build, name: version, apk, native, ...(page ? { page } : {}) };
};

/** The newest changelog lines, for the settings' "what's new in the update" (plain text, at most `max`). */
export const releaseNotes = (entry = CHANGELOG[0], max = 12) => entry.items.slice(0, max).map((i) => String(i));

/**
 * The web bundle manifest. A bundle needs the native bridge it was built with (or newer).
 * `size`, `notes` and `page` are for the settings (apps from before NATIVE_API 4 ignore them).
 */
export function webJson({ build, version, zip, file, native = nativeApi(), notes = releaseNotes() }) {
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const page = releasePage(zip);
  return { version, build, sha256, zip, minNative: native, size: statSync(file).size, notes, ...(page ? { page } : {}) };
}

/**
 * The web bundle assets a release can let go once its new web.json is up: every web-<build>.zip
 * but the newest two (an app that read the previous web.json may still be downloading its zip),
 * and the plain web.zip of the workflow from before per-build names (once two named ones exist).
 */
export function staleWebZips(names, keep = 2) {
  const zips = names.map((n) => [n, /^web-(\d+)\.zip$/.exec(n)]).filter(([, m]) => m).map(([n, m]) => [n, +m[1]]);
  const newest = zips.sort((a, b) => b[1] - a[1]).slice(0, keep).map(([n]) => n);
  return names.filter((n) => (n === 'web.zip' && zips.length >= keep) || (/^web-\d+\.zip$/.test(n) && !newest.includes(n)));
}

/**
 * What the app does with web.json (mirrors UpdateRules.decide in the app):
 * 'apk' when the bundle needs a newer app (the APK update comes first), 'skip' when it is not
 * newer than the newest build on the device (built in, in use or pending) or failed before, else 'stage'.
 */
export function webDecision(manifest, { native, current, bad = [] }) {
  if ((manifest.minNative ?? native) > native) return 'apk';
  if (bad.includes(manifest.build) || manifest.build <= current) return 'skip';
  return 'stage';
}

function main(what = 'version', ...args) {
  const [latest] = CHANGELOG;
  if (what === 'version') console.log(latest.v);
  else if (what === 'native') console.log(nativeApi());
  else if (what === 'latest-json') console.log(JSON.stringify(latestJson({ build: +args[0], version: latest.v, apk: args[1] })));
  else if (what === 'web-json') console.log(JSON.stringify(webJson({ build: +args[0], version: latest.v, file: args[1], zip: args[2] })));
  else if (what === 'web-zips') console.log(staleWebZips(args).join('\n'));
  else if (what === 'notes') {
    console.log(`Memento v${latest.v} (${latest.date}) for Android. Download the APK below and open it on the device to install; new versions install over the old one and keep your progress. Once installed, the app updates the game by itself when online.\n`);
    console.log(latest.items.map((i) => `- ${i}`).join('\n'));
    console.log('\nThe game runs fully offline. Built from the web version that is also playable on GitHub Pages.');
  } else throw new Error(`unknown: ${what}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(...process.argv.slice(2));
