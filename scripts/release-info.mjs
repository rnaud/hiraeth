// Release metadata for the release workflows, from the newest entry in src/changelog.js.
//   node scripts/release-info.mjs version                → 0.34
//   node scripts/release-info.mjs build                  → the game's build number (gameBuild: APK versionCode, web bundle build)
//   node scripts/release-info.mjs notes                  → markdown release notes for that version
//   node scripts/release-info.mjs native                 → the app's native bridge level (WebBundles.NATIVE_API)
//   node scripts/release-info.mjs web-min-native         → the bridge the web game needs (WebBundles.WEB_MIN_NATIVE, web.json's minNative)
//   node scripts/release-info.mjs latest-json <build> <apk url>        → latest.json, read by Updater.java
//   node scripts/release-info.mjs web-json <build> <web.zip> <zip url> → web.json, read by WebBundles.java
//   node scripts/release-info.mjs web-zips <asset names…>              → the web zips a release can delete (staleWebZips)
// The Cloudflare deploy writes its own web.json (scripts/web-update.mjs, from webJson below).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG } from '../src/changelog.js';

const BUNDLES_JAVA = fileURLToPath(new URL('../android/app/src/main/java/com/rnaud/moebius/WebBundles.java', import.meta.url));
const DESKTOP_MAIN = fileURLToPath(new URL('../desktop/main.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('..', import.meta.url));

const constant = (source, re, what) => {
  const m = re.exec(source);
  if (!m) throw new Error(`${what} not found`);
  return +m[1];
};

/** NATIVE_API from WebBundles.java: bumped whenever the native bridge changes. */
export const nativeApi = (source = readFileSync(BUNDLES_JAVA, 'utf8')) =>
  constant(source, /static final int NATIVE_API = (\d+);/, 'NATIVE_API in WebBundles.java');

/**
 * WEB_MIN_NATIVE from WebBundles.java: the oldest native bridge the web game runs on (web.json's
 * minNative). It follows NATIVE_API only when the web side starts relying on a bridge change; a
 * change on the Java side alone (NATIVE_API 5: the update address) leaves older apps their updates.
 */
export const webMinNative = (source = readFileSync(BUNDLES_JAVA, 'utf8')) =>
  constant(source, /static final int WEB_MIN_NATIVE = (\d+);/, 'WEB_MIN_NATIVE in WebBundles.java');

/** DESKTOP_API from desktop/main.mjs: the Steam Deck runtime's level (web.json's minDesktop). */
export const desktopApi = (source = readFileSync(DESKTOP_MAIN, 'utf8')) =>
  constant(source, /export const DESKTOP_API = (\d+);/, 'DESKTOP_API in desktop/main.mjs');

/**
 * Builds up to 117 were numbered by the Android workflow's run (versionCode = run number).
 * From then on a build is numbered by its commit (gameBuild), the same in every workflow.
 */
export const LAST_RUN_NUMBER_BUILD = 117;

/**
 * The game's build number: the number of commits up to HEAD. One commit gets the same number in
 * every workflow (the Cloudflare deploy's web bundle, the APK's versionCode and the game built into
 * it, the Steam Deck package's game), so an app can compare a downloaded bundle with the one it
 * carries; every push to main adds commits, so it only grows. It needs the whole history
 * (actions/checkout with fetch-depth: 0): a shallow clone would count 1.
 */
export function gameBuild({ cwd = REPO, run = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim() } = {}) {
  if (run('rev-parse', '--is-shallow-repository') !== 'false') throw new Error('a shallow clone can\'t number the build: check out with fetch-depth: 0');
  const n = +run('rev-list', '--count', 'HEAD');
  if (!Number.isSafeInteger(n) || n <= LAST_RUN_NUMBER_BUILD) throw new Error(`build ${n} is not above the last run-numbered build ${LAST_RUN_NUMBER_BUILD}`);
  return n;
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
 * The web bundle manifest. `minNative`: the Android bridge the bundle needs (WEB_MIN_NATIVE);
 * `minDesktop` (with `desktop`): the Steam Deck runtime it needs (DESKTOP_API).
 * `size`, `notes` and `page` are for the settings (apps from before NATIVE_API 4 ignore them).
 */
export function webJson({ build, version, zip, file, native = webMinNative(), desktop, notes = releaseNotes() }) {
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const page = releasePage(zip);
  return {
    version, build, sha256, zip, minNative: native, ...(desktop ? { minDesktop: desktop } : {}),
    size: statSync(file).size, notes, ...(page ? { page } : {}),
  };
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
  else if (what === 'build') console.log(gameBuild());
  else if (what === 'native') console.log(nativeApi());
  else if (what === 'web-min-native') console.log(webMinNative());
  else if (what === 'latest-json') console.log(JSON.stringify(latestJson({ build: +args[0], version: latest.v, apk: args[1] })));
  else if (what === 'web-json') console.log(JSON.stringify(webJson({ build: +args[0], version: latest.v, file: args[1], zip: args[2] })));
  else if (what === 'web-zips') console.log(staleWebZips(args).join('\n'));
  else if (what === 'notes') {
    console.log(`Memento v${latest.v} (${latest.date}) for Android. Download the APK below and open it on the device to install; new versions install over the old one and keep your progress. Once installed, the app updates the game by itself when online, from the game's own site.\n`);
    console.log(latest.items.map((i) => `- ${i}`).join('\n'));
    console.log('\nThe game runs fully offline. Built from the web version that is also playable at https://memento.alexandria-rnaud.workers.dev/.');
  } else throw new Error(`unknown: ${what}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(...process.argv.slice(2));
