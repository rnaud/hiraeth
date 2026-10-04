// Release metadata for the Android workflow, from the newest entry in src/changelog.js.
//   node scripts/release-info.mjs version                → 0.34
//   node scripts/release-info.mjs notes                  → markdown release notes for that version
//   node scripts/release-info.mjs native                 → the app's native bridge level (WebBundles.NATIVE_API)
//   node scripts/release-info.mjs latest-json <build> <apk url>        → latest.json, read by Updater.java
//   node scripts/release-info.mjs web-json <build> <web.zip> <zip url> → web.json, read by WebBundles.java
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG } from '../src/changelog.js';

const BUNDLES_JAVA = fileURLToPath(new URL('../android/app/src/main/java/com/rnaud/moebius/WebBundles.java', import.meta.url));

/** NATIVE_API from WebBundles.java: bumped whenever the native bridge changes. */
export function nativeApi(source = readFileSync(BUNDLES_JAVA, 'utf8')) {
  const m = /static final int NATIVE_API = (\d+);/.exec(source);
  if (!m) throw new Error('NATIVE_API not found in WebBundles.java');
  return +m[1];
}

/** The APK manifest. Apps from before v0.37 compare `code`; newer ones only take an APK whose `native` is newer. */
export const latestJson = ({ build, version, apk, native = nativeApi() }) => ({ code: build, name: version, apk, native });

/** The web bundle manifest. A bundle needs the native bridge it was built with (or newer). */
export function webJson({ build, version, zip, file, native = nativeApi() }) {
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  return { version, build, sha256, zip, minNative: native };
}

/**
 * What the app does with web.json (mirrors WebBundles.decide):
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
  else if (what === 'notes') {
    console.log(`Moebius v${latest.v} (${latest.date}) for Android. Download the APK below and open it on the device to install; new versions install over the old one and keep your progress. Once installed, the app updates the game by itself when online.\n`);
    console.log(latest.items.map((i) => `- ${i}`).join('\n'));
    console.log('\nThe game runs fully offline. Built from the web version that is also playable on GitHub Pages.');
  } else throw new Error(`unknown: ${what}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(...process.argv.slice(2));
