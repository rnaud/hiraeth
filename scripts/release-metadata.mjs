// Release formatting and update decisions. No filesystem reads or subprocesses.
// CLI and I/O compatibility exports remain in release-info.mjs.
import { CHANGELOG, lineText, newestFirst } from '../src/changelog.js';

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

/** The release page next to a download URL (…/releases/download/v0.56/x → …/releases/tag/v0.56); mirrors UpdateRules.pageFor. */
export function releasePage(url) {
  const m = /^(.*)\/releases\/download\/([^/]+)\//.exec(url ?? '');
  return m ? `${m[1]}/releases/tag/${m[2]}` : undefined;
}

/** The newest changelog lines, for the settings' "what's new in the update" (plain text, at most `max`). */
export const releaseNotes = (entry = CHANGELOG[0], max = 12) => newestFirst(entry).slice(0, max).map(lineText);

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
    `**The Unity port**, for testers (not the game players install): the same game run inside Unity. Each build is added here when it finishes, so it may come from an earlier commit than the web update.`,
    '',
    ...lines,
    UNITY_SECTION_END,
  ].join('\n');
}

/** Web releases do not claim a new native installer; preserve attached build provenance. */
export function webReleaseNotes({ entry = CHANGELOG[0], assets = [], repo = 'rnaud/hiraeth', sha, build } = {}) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('web release needs an exact commit');
  if (!Number.isSafeInteger(build) || build < 1) throw new Error('web release needs a positive build');
  return [
    `Hiraeth v${entry.v} (${entry.date}) — web and game-content update.`,
    `Play at https://hiraeth.alexandria-rnaud.workers.dev/. Built from [${sha.slice(0, 12)}](https://github.com/${repo}/commit/${sha}), build ${build}.`,
    newestFirst(entry).map((i) => `- ${lineText(i)}`).join('\n'),
    `Before and after pictures: https://hiraeth.alexandria-rnaud.workers.dev/changelog.html#v${entry.v}`,
    'Installed apps receive compatible game-content updates automatically. Native installers are built separately: Unity Android/Linux daily when changed, other installers on request; attached installers retain the versions and commits they were built from.',
    unitySection(assets, repo),
  ].join('\n\n') + '\n';
}

/** A release's notes with their Unity section replaced (or added at the end), from the release's assets. */
export function withUnitySection(body = '', assets = [], repo = undefined) {
  const section = unitySection(assets, repo);
  const start = body.indexOf(UNITY_SECTION_START), end = body.indexOf(UNITY_SECTION_END);
  if (start >= 0 && end > start) return body.slice(0, start) + section + body.slice(end + UNITY_SECTION_END.length);
  return `${body.replace(/\s+$/, '')}\n\n${section}\n`;
}

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
