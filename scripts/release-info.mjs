// Release metadata for the release workflows, from the newest entry in src/changelog.js.
//   node scripts/release-info.mjs version                → 0.34
//   node scripts/release-info.mjs version-at <sha>       → the version in the built commit
//   node scripts/release-info.mjs build                  → the game's build number (gameBuild: APK versionCode, web bundle build)
//   node scripts/release-info.mjs notes                  → markdown release notes for that version
//   node scripts/release-info.mjs native                 → the app's native bridge level (WebBundles.NATIVE_API)
//   node scripts/release-info.mjs web-min-native         → the bridge the web game needs (WebBundles.WEB_MIN_NATIVE, web.json's minNative)
//   node scripts/release-info.mjs unity-api              → the Unity player's bridge level (BridgeUpdates.UnityApi)
//   node scripts/release-info.mjs unity-min              → the player the Unity script needs (BridgeUpdates.ScriptMinUnity, unity.json's minUnity)
//   node scripts/release-info.mjs latest-json <build> <apk url>        → latest.json, read by Updater.java
//   node scripts/release-info.mjs web-json <build> <web.zip> <zip url> → web.json, read by WebBundles.java
//   node scripts/release-info.mjs web-zips <asset names…>              → the web zips a release can delete (staleWebZips)
//   node scripts/release-info.mjs unity-notes <android|linux|xbox> [sha] [by] → the Unity testers' release notes (unityNotes)
//   node scripts/release-info.mjs notes [release.json]                 → … with the Unity section (unitySection) from `gh release view --json assets`
//   node scripts/release-info.mjs newest-version <tags…>               → the newest vX.Y among the tags (newestVersionTag)
//   node scripts/release-info.mjs unity-label <android|linux|xbox> <sha> → a Unity build's label on a version's release (unityLabel)
//   node scripts/release-info.mjs unity-body <release.json>            → that release's notes with their Unity section redone (withUnitySection)
// The Cloudflare deploy writes its own web.json (scripts/web-update.mjs, from webJson below).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANGELOG, lineText, newestFirst } from '../src/changelog.js';
import { UNITY_APK } from '../src/updates.js';
import {
  LAST_RUN_NUMBER_BUILD, releasePage, releaseNotes, staleWebZips, newestVersionTag,
  unityLabel, unitySection, webReleaseNotes, withUnitySection, unityNotes,
} from './release-metadata.mjs';
export {
  unityDecision, LAST_RUN_NUMBER_BUILD, releasePage, releaseNotes, staleWebZips,
  webDecision, xboxDecision, UNITY_RELEASES, MAX_RELEASE_ASSET, newestVersionTag,
  unityLabel, unityBuilds, UNITY_SECTION_START, UNITY_SECTION_END, unitySection,
  webReleaseNotes, withUnitySection, unityNotes,
} from './release-metadata.mjs';

const BUNDLES_JAVA = fileURLToPath(new URL('../android/app/src/main/java/com/rnaud/hiraeth/WebBundles.java', import.meta.url));
const DESKTOP_MAIN = fileURLToPath(new URL('../desktop/main.mjs', import.meta.url));
const XBOX_BUNDLES = fileURLToPath(new URL('../xbox/Hiraeth/WebBundles.cs', import.meta.url));
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

/** XboxApi from xbox/Hiraeth/WebBundles.cs: the Xbox app's level (web.json's minXbox, docs/systems/xbox.md). */
export const xboxApi = (source = readFileSync(XBOX_BUNDLES, 'utf8')) =>
  constant(source, /public const int XboxApi = (\d+);/, 'XboxApi in xbox/Hiraeth/WebBundles.cs');

const UNITY_UPDATES = fileURLToPath(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeUpdates.cs', import.meta.url));

/** UnityApi from BridgeUpdates.cs: the Unity player's C# bridge level (bumped when BridgeHost changes in a way the script relies on). */
export const unityApi = (source = readFileSync(UNITY_UPDATES, 'utf8')) =>
  constant(source, /public const int UnityApi = (\d+);/, 'UnityApi in BridgeUpdates.cs');

/**
 * ScriptMinUnity from BridgeUpdates.cs: the oldest Unity player the game's script runs on (unity.json's minUnity, the
 * script bundle's bundle.json). It follows UnityApi only when the script starts relying on a bridge change.
 */
export const unityMinApi = (source = readFileSync(UNITY_UPDATES, 'utf8')) =>
  constant(source, /public const int ScriptMinUnity = (\d+);/, 'ScriptMinUnity in BridgeUpdates.cs');

/**
 * The Unity script bundle's own record (StreamingAssets/hiraeth-js/bundle.json, and inside unity-<build>.zip): its build,
 * version, the player it needs, and whether a player built with it looks for updates (`updates`: the published builds,
 * GitHub Actions or UNITY_OTA=1; a local build keeps the script it was built with).
 */
export const unityBundleInfo = ({ build, version, minUnity = unityMinApi(), updates = false }) => ({ build, version, minUnity, updates: !!updates });

/**
 * The Unity script's manifest, updates/unity.json beside web.json (scripts/web-update.mjs; read by BridgeUpdates.cs):
 * the zip of the player's StreamingAssets/hiraeth-js without public/, its sha256 and size, `minUnity`, the player it needs,
 * and `apk`, the Android player to install when it is too old (the testers' APK, .github/workflows/unity-android.yml).
 */
export function unityJson({ build, version, zip, file, minUnity = unityMinApi(), notes = releaseNotes() }) {
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const page = releasePage(zip);
  return { version, build, sha256, zip, minUnity, size: statSync(file).size, notes, apk: UNITY_APK, ...(page ? { page } : {}) };
}

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

/** The APK manifest. Apps from before v0.37 compare `code`; newer ones only take an APK whose `native` is newer. */
export const latestJson = ({ build, version, apk, native = nativeApi() }) => {
  const page = releasePage(apk);
  return { code: build, name: version, apk, native, ...(page ? { page } : {}) };
};

/**
 * The web bundle manifest. `minNative`: the Android bridge the bundle needs (WEB_MIN_NATIVE);
 * `minDesktop` (with `desktop`): the Steam Deck runtime it needs (DESKTOP_API); `minXbox` (with `xbox`): the
 * Xbox app it needs (XboxApi).
 * `size`, `notes` and `page` are for the settings (apps from before NATIVE_API 4 ignore them).
 */
export function webJson({ build, version, zip, file, native = webMinNative(), desktop, xbox, notes = releaseNotes() }) {
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const page = releasePage(zip);
  return {
    version, build, sha256, zip, minNative: native, ...(desktop ? { minDesktop: desktop } : {}), ...(xbox ? { minXbox: xbox } : {}),
    size: statSync(file).size, notes, ...(page ? { page } : {}),
  };
}

/** `gh release view --json body,assets` saved to a file (none: {}). */
const readRelease = (file) => (file ? JSON.parse(readFileSync(file, 'utf8')) : {});

/** Read the built commit, never fall back to the current checkout's version. */
export function versionAt(sha, git) {
  const version = /export const CHANGELOG\s*=\s*\[\s*\{\s*v:\s*['"](\d+(?:\.\d+)+)['"]/.exec(git('show', `${sha}:src/changelog.js`))?.[1];
  if (!version) throw new Error(`no release version in commit ${sha}`);
  return version;
}

/** A commit's web version (its newest changelog entry) and build number (its commit count, as gameBuild counts HEAD's). */
export function unityBuildOf(sha, git) {
  const version = /\{\s*v:\s*'([^']+)'/.exec(git('show', `${sha}:src/changelog.js`))?.[1] ?? CHANGELOG[0].v;
  return { version, build: +git('rev-list', '--count', sha) };
}

function main(what = 'version', ...args) {
  const [latest] = CHANGELOG;
  if (what === 'version') console.log(latest.v);
  else if (what === 'version-at') console.log(versionAt(args[0], (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' })));
  else if (what === 'build') console.log(gameBuild());
  else if (what === 'native') console.log(nativeApi());
  else if (what === 'web-min-native') console.log(webMinNative());
  else if (what === 'unity-api') console.log(unityApi());
  else if (what === 'unity-min') console.log(unityMinApi());
  else if (what === 'latest-json') console.log(JSON.stringify(latestJson({ build: +args[0], version: latest.v, apk: args[1] })));
  else if (what === 'web-json') console.log(JSON.stringify(webJson({ build: +args[0], version: latest.v, file: args[1], zip: args[2] })));
  else if (what === 'web-zips') console.log(staleWebZips(args).join('\n'));
  else if (what === 'newest-version') {
    const tag = newestVersionTag(args);
    if (!tag) throw new Error('no vX.Y tag among the releases');
    console.log(tag);
  } else if (what === 'unity-label') console.log(unityLabel(args[0], args[1]));
  else if (what === 'unity-body') {
    const r = readRelease(args[0]);
    process.stdout.write(withUnitySection(r.body ?? '', r.assets, process.env.GITHUB_REPOSITORY || undefined));
  }
  else if (what === 'unity-notes') {
    const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
    const sha = args[1] || git('rev-parse', 'HEAD');
    // (the version and build of the commit built, which need not be the checkout's)
    const at = unityBuildOf(sha, git);
    console.log(unityNotes({ platform: args[0], sha, subject: git('log', '-1', '--format=%s', sha), ...at, by: args[2] }));
  }
  else if (what === 'web-notes') {
    const sha = args[1];
    const build = +execFileSync('git', ['rev-list', '--count', sha], { cwd: REPO, encoding: 'utf8' });
    process.stdout.write(webReleaseNotes({ assets: readRelease(args[0]).assets, repo: process.env.GITHUB_REPOSITORY, sha, build }));
  }
  else if (what === 'notes') {
    console.log(`Hiraeth v${latest.v} (${latest.date}) for Android. Download \`hiraeth-v${latest.v}.apk\` below and open it on the device to install; new versions install over the old one and keep your progress. Once installed, the app updates the game by itself when online, from the game's own site.\n`);
    console.log(newestFirst(latest).map((i) => `- ${lineText(i)}`).join('\n'));
    console.log(`\nBefore and after pictures of what changed: https://hiraeth.alexandria-rnaud.workers.dev/changelog.html#v${latest.v}`);
    console.log('\nThe game runs fully offline. Built from the web version that is also playable at https://hiraeth.alexandria-rnaud.workers.dev/.');
    // (the Unity builds the release holds, from their labels: kept by every push that rewrites these notes)
    console.log(`\n${unitySection(readRelease(args[0]).assets, process.env.GITHUB_REPOSITORY || undefined)}`);
  } else throw new Error(`unknown: ${what}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(...process.argv.slice(2));
