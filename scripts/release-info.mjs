// Release metadata for the release workflows, from the newest entry in src/changelog.js.
//   node scripts/release-info.mjs version                → 0.34
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
 * the zip of the player's StreamingAssets/hiraeth-js without public/, its sha256 and size, and `minUnity`, the player it needs.
 */
export function unityJson({ build, version, zip, file, minUnity = unityMinApi(), notes = releaseNotes() }) {
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const page = releasePage(zip);
  return { version, build, sha256, zip, minUnity, size: statSync(file).size, notes, ...(page ? { page } : {}) };
}

/**
 * What a Unity player does with unity.json (mirrors UpdateRules.Decide in BridgeUpdates.cs): 'skip' when it isn't one of
 * ours, isn't newer than every build on the device (the player's own script, the one in use, one downloaded) or failed
 * to start before; 'player' when it needs a newer player (minUnity above its UnityApi: the player's update comes first);
 * else 'stage'.
 */
export function unityDecision(manifest, { unity, current, bad = [] }) {
  if (!Number.isSafeInteger(manifest?.build) || manifest.build <= 0 || !/^[0-9a-f]{64}$/i.test(manifest.sha256 ?? '')) return 'skip';
  if ((manifest.minUnity ?? 1) > unity) return 'player';
  if (bad.includes(manifest.build) || manifest.build <= current) return 'skip';
  return 'stage';
}

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
export const releaseNotes = (entry = CHANGELOG[0], max = 12) => newestFirst(entry).slice(0, max).map(lineText);

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

/**
 * What the Xbox app does with web.json (mirrors WebBundles.Decide in xbox/Hiraeth/WebBundles.cs): 'app' when the
 * bundle needs a newer Xbox app (minXbox; a web.json without it runs on every one), 'skip' when it is not newer
 * than the newest build on the console (packaged, running or downloaded) or failed to start before, else 'stage'.
 */
export function xboxDecision(manifest, { xbox, current, bad = [] }) {
  if (!Number.isSafeInteger(manifest?.build) || manifest.build <= 0 || !/^[0-9a-f]{64}$/.test(manifest.sha256 ?? '')) return 'skip';
  if ((manifest.minXbox ?? 1) > xbox) return 'app';
  if (bad.includes(manifest.build) || manifest.build <= current) return 'skip';
  return 'stage';
}

/** The Unity testers' builds (docs/systems/unity.md, "Building in GitHub Actions"): their releases, files and package. */
export const UNITY_RELEASES = {
  android: { tag: 'unity-android', file: 'hiraeth-unity.apk', package: 'com.rnaud.hiraeth.unity', title: 'Hiraeth (Unity) for Android' },
  linux: { tag: 'unity-linux', file: 'hiraeth-unity-linux.tar.gz', title: 'Hiraeth (Unity) for Linux / Steam Deck' },
  xbox: { tag: 'unity-xbox', file: 'hiraeth-unity-xbox.zip', package: 'rnaud.HiraethUnity', title: 'Hiraeth (Unity) for Xbox (Developer Mode)' },
};

/** GitHub's limit on one release asset (2 GiB): a bigger Unity build would stay on its prerelease alone. */
export const MAX_RELEASE_ASSET = 2 * 1024 ** 3;

/** The newest version's tag (vX.Y, compared number by number) among release tags; unity-*, xbox and the like ignored. */
export function newestVersionTag(tags) {
  const parse = (t) => (/^v\d+(\.\d+)*$/.test(t) ? t.slice(1).split('.').map(Number) : null);
  const newer = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
    return false;
  };
  let best;
  for (const t of tags) {
    const v = parse(t);
    if (v && (!best || newer(v, best.v))) best = { t, v };
  }
  return best?.t;
}

/**
 * A Unity build's label on a version's release (docs/systems/android.md, "The Unity builds on a version's release"):
 * what it is and the commit built. GitHub shows the label in place of the file's name, and the notes' Unity section is
 * read back from it (unityBuilds): the commit travels with the file, so a rewrite of the notes can't lose it.
 */
export function unityLabel(platform, sha) {
  const r = UNITY_RELEASES[platform];
  if (!r) throw new Error(`unknown platform: ${platform}`);
  if (!/^[0-9a-f]{7,40}$/.test(sha ?? '')) throw new Error(`not a commit: ${sha}`);
  return `${r.title}, testers' build (commit ${sha.slice(0, 12)})`;
}

/** The Unity builds on a release, from its assets ([{ name, label }]): { platform: { file, sha } } (sha from the label, if any). */
export function unityBuilds(assets = []) {
  const out = {};
  for (const [platform, r] of Object.entries(UNITY_RELEASES)) {
    const a = (assets ?? []).find((x) => x?.name === r.file);
    if (a) out[platform] = { file: r.file, sha: /\(commit ([0-9a-f]{7,40})\)/.exec(a.label ?? '')?.[1] };
  }
  return out;
}

export const UNITY_SECTION_START = '<!-- unity builds -->';
export const UNITY_SECTION_END = '<!-- /unity builds -->';

/**
 * The release notes' Unity section: each Unity build on this release and the commit it came from, or, for one not
 * built since the release was made, where the newest is (its prerelease). The Unity builds finish later than the
 * release and may come from an earlier commit than its APK.
 */
export function unitySection(assets = [], repo = 'rnaud/hiraeth') {
  const builds = unityBuilds(assets);
  const lines = Object.entries(UNITY_RELEASES).map(([platform, r]) => {
    const b = builds[platform];
    if (!b) return `- ${r.title}: not built since this release was made; the newest is on [${r.tag}](https://github.com/${repo}/releases/tag/${r.tag}).`;
    const from = b.sha ? `built from commit [${b.sha}](https://github.com/${repo}/commit/${b.sha})` : 'from an unrecorded commit';
    return `- ${r.title}: \`${r.file}\` below, ${from}.`;
  });
  return [
    UNITY_SECTION_START,
    `**The Unity port**, for testers (not the game players install): the same game run inside Unity. Each build is added here when it finishes, so it may come from an earlier commit than the APK.`,
    '',
    ...lines,
    UNITY_SECTION_END,
  ].join('\n');
}

/** A release's notes with their Unity section replaced (or added at the end), from the release's assets. */
export function withUnitySection(body = '', assets = [], repo = undefined) {
  const section = unitySection(assets, repo);
  const start = body.indexOf(UNITY_SECTION_START), end = body.indexOf(UNITY_SECTION_END);
  if (start >= 0 && end > start) return body.slice(0, start) + section + body.slice(end + UNITY_SECTION_END.length);
  return `${body.replace(/\s+$/, '')}\n\n${section}\n`;
}

/** `gh release view --json body,assets` saved to a file (none: {}). */
const readRelease = (file) => (file ? JSON.parse(readFileSync(file, 'utf8')) : {});

/**
 * The notes of a Unity testers' release (unity-android, unity-linux): what it is, how to install it, and which
 * commit and web version it was built from (a release of its own, replaced each build; never the players' latest).
 */
export function unityNotes({ platform = 'android', sha, subject = '', version = CHANGELOG[0].v, build, by = 'GitHub Actions', date = new Date().toISOString().slice(0, 10) }) {
  const r = UNITY_RELEASES[platform];
  if (!r) throw new Error(`unknown platform: ${platform}`);
  const what = platform === 'android'
    ? `Hiraeth (Unity), for testing: the game's own JavaScript run inside Unity (the engine bridge) and drawn by Unity, on Android. `
      + `Package \`${r.package}\`: it installs next to the Hiraeth app (\`com.rnaud.hiraeth\`) and never replaces it; each new build installs over the last (the same release key) and keeps its saves. `
      + `Download \`${r.file}\` below and open it on the device.`
    : platform === 'xbox'
      ? `Hiraeth (Unity), for measuring on an Xbox in Developer Mode: the engine bridge as a UWP app (IL2CPP x64, Direct3D 11, the game's JavaScript in Puerts' V8, relinked for UWP). `
        + `Package \`${r.package}\`: it installs next to the WebView2 app (\`rnaud.Hiraeth\`). `
        + `Download \`${r.file}\`, unpack it and add the \`.msix\` with its dependency \`.appx\` files in the Device Portal (docs/systems/xbox.md, "The Unity build on the Xbox"); its numbers are in LocalState\\unity.log.`
      : `Hiraeth (Unity), for testing: the engine bridge's Linux player (x86_64, Vulkan, IL2CPP), for the Steam Deck. `
        + `Download \`${r.file}\`, unpack it and run \`hiraeth-js.x86_64\`.`;
  const from = `Built from commit ${sha ? `\`${sha.slice(0, 12)}\`` : '(unknown)'}${subject ? ` (${subject})` : ''}, web version v${version}${build ? `, build ${build}` : ''}, by ${by} on ${date}.`;
  return `${what}\n\n${from}\n\nNot for players: the game itself is the Hiraeth app and https://hiraeth.alexandria-rnaud.workers.dev/.`;
}

/** A commit's web version (its newest changelog entry) and build number (its commit count, as gameBuild counts HEAD's). */
export function unityBuildOf(sha, git) {
  const version = /\{\s*v:\s*'([^']+)'/.exec(git('show', `${sha}:src/changelog.js`))?.[1] ?? CHANGELOG[0].v;
  return { version, build: +git('rev-list', '--count', sha) };
}

function main(what = 'version', ...args) {
  const [latest] = CHANGELOG;
  if (what === 'version') console.log(latest.v);
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
