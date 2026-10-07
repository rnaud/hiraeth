// The Unity testers' builds (docs/systems/unity.md, "Building in GitHub Actions"): the workflow's key lines,
// the testers' APK's identity (BridgeBuild.AndroidRelease), the project's settings, and the releases' notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { UNITY_RELEASES, unityNotes } from '../scripts/release-info.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const workflow = read('.github/workflows/unity-android.yml');
const build = read('unity/Memento/Assets/MementoJS/Editor/BridgeBuild.cs');
const settings = read('unity/Memento/ProjectSettings/ProjectSettings.asset');

test('the workflow runs on pushes that touch the bridge, and by hand', () => {
  assert.match(workflow, /^on:\n {2}push:\n {4}branches: \[main\]\n {4}paths:/m);
  for (const p of ['unity/**', 'engine/**', 'src/**', 'scripts/unity-*', 'scripts/unity-*/**'])
    assert.ok(workflow.includes(`- '${p}'`), p);
  assert.match(workflow, /^ {2}workflow_dispatch:/m);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('the workflow builds with GameCI on the local editor\'s Unity, licensed by the Unity account', () => {
  const version = /m_EditorVersion: (\S+)/.exec(read('unity/Memento/ProjectSettings/ProjectVersion.txt'))[1];
  assert.match(workflow, new RegExp(`UNITY_VERSION: ${version.replace(/\./g, '\\.')}`));
  assert.match(workflow, /uses: game-ci\/unity-builder@v6/);
  // every GameCI step gets the account's sign-in (a Personal seat), never a licence file
  const steps = workflow.split('uses: game-ci/unity-builder@v6').slice(1);
  assert.equal(steps.length, 3);
  for (const s of steps) {
    assert.match(s, /UNITY_EMAIL: \$\{\{ secrets\.UNITY_EMAIL \}\}/);
    assert.match(s, /UNITY_PASSWORD: \$\{\{ secrets\.UNITY_PASSWORD \}\}/);
    assert.match(s, /allowDirtyBuild: true/);   // (Puerts' embedded packages move packages-lock.json)
  }
  // the secrets are checked first and a missing one fails the run at once, by name
  assert.match(workflow, /for s in UNITY_EMAIL UNITY_PASSWORD ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD/);
  assert.match(workflow, /::error title=Missing secrets::/);
  assert.match(workflow, /android:\n {4}needs: secrets/);
  assert.match(workflow, /linux:\n(?: {4}#.*\n)* {4}needs: android/);   // (one Personal seat at a time)
});

test('the workflow prepares the bridge as the local players do, then builds the APK and the Linux player', () => {
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /scripts\/unity-js-setup\.sh/);
  assert.match(workflow, /node scripts\/engine-bundle\.mjs unity/);
  assert.match(workflow, /path: \$\{\{ env\.PROJECT \}\}\/Library/);
  assert.match(workflow, /buildMethod: Memento\.EditorTools\.BridgeBuild\.Il2cpp/);
  // (GameCI v6 fails a run whose log lacks "Build succeeded!": the entries say it on success)
  assert.match(build, /if \(ok\) Debug\.Log\("Memento: Build succeeded!"\);/);
  assert.match(build, /public static void Il2cpp\(\) => Exit\(GenerateGlue\(\)\);/);
  assert.match(build, /Exit\(s\.result == BuildResult\.Succeeded\);/);
  assert.match(workflow, /buildMethod: Memento\.EditorTools\.BridgeBuild\.AndroidRelease/);
  assert.match(workflow, /targetPlatform: Android/);
  assert.match(workflow, /androidVersionCode: \$\{\{ steps\.meta\.outputs\.build \}\}/);
  assert.match(workflow, /node scripts\/release-info\.mjs version/);
  assert.match(workflow, /node scripts\/release-info\.mjs build/);
  assert.match(workflow, /androidKeystorePass: \$\{\{ secrets\.ANDROID_KEYSTORE_PASSWORD \}\}/);
  assert.match(workflow, /androidKeyaliasName: moebius/);
  assert.match(workflow, /scripts\/unity-publish\.sh android/);
  // (never -version on the editor's command line: Unity prints its own version and quits, building nothing)
  const local = read('scripts/unity-android-release.sh');
  assert.match(local, /BridgeBuild\.AndroidRelease -buildVersion "\$VERSION" -androidVersionCode "\$BUILD"/);
  for (const text of [workflow, local]) assert.doesNotMatch(text, /(customParameters:|AndroidRelease).* -version /);
  assert.match(workflow, /buildMethod: Memento\.EditorTools\.BridgeBuild\.Linux/);
  assert.match(workflow, /targetPlatform: StandaloneLinux64/);
  assert.match(workflow, /scripts\/unity-publish\.sh linux/);
});

test('the releases are prereleases, never the latest, their file replaced each build', () => {
  const publish = read('scripts/unity-publish.sh');
  assert.match(publish, /gh release upload "\$TAG" "\$TMP\/\$NAME" -R "\$REPO" --clobber/);
  assert.equal((publish.match(/--prerelease --latest=false/g) || []).length, 2);
  assert.deepEqual(Object.values(UNITY_RELEASES).map((r) => r.tag), ['unity-android', 'unity-linux']);
  // the local build publishes to the same release with the same script
  assert.match(read('scripts/unity-android-release.sh'), /scripts\/unity-publish\.sh android/);
});

test('the testers\' APK has its own identity: installed next to the web app, never over it', () => {
  const c = (name) => new RegExp(`const string ${name} = "([^"]+)"`).exec(build)[1];
  assert.equal(c('ReleasePackage'), 'com.rnaud.memento.unity');
  assert.equal(c('ReleasePackage'), UNITY_RELEASES.android.package);
  assert.notEqual(c('ReleasePackage'), 'com.rnaud.moebius');
  assert.notEqual(c('ReleasePackage'), c('Package'));   // (nor the bench's debug-signed bridge player)
  assert.equal(c('ReleaseName'), 'Memento (Unity)');
  assert.equal(c('ReleaseAlias'), 'moebius');
  assert.match(read('android/app/build.gradle'), /keyAlias System\.getenv\("ANDROID_KEY_ALIAS"\) \?: "moebius"/);
  const release = build.slice(build.indexOf('static bool Release()'));
  assert.match(release, /UIOrientation\.LandscapeLeft/);
  assert.match(release, /startInFullscreen = true/);
  assert.match(release, /runInBackground = false/);
  assert.match(release, /useCustomKeystore = true/);
  assert.match(release, /"public", "icons", "icon-512\.png"/);
  assert.ok(existsSync(new URL('../public/icons/icon-512.png', import.meta.url)));
  // the bridge's Android player: IL2CPP, ARM64
  assert.match(build, /SetScriptingBackend\(NamedBuildTarget\.Android, ScriptingImplementation\.IL2CPP\)/);
  assert.match(build, /AndroidArchitecture\.ARM64/);
});

test('the project carries the identity, and reads the pads through the Input System', () => {
  assert.match(settings, /applicationIdentifier:\n {4}Android: com\.rnaud\.memento\.unity\n/);
  assert.match(settings, /activeInputHandler: 1\n/);   // (the Input System only: BridgeHost reads Gamepad.current)
  assert.match(read('unity/Memento/Packages/manifest.json'), /"com\.unity\.inputsystem"/);
});

test('the notes say which commit and web version a build came from', () => {
  const n = unityNotes({ platform: 'android', sha: '0123456789abcdef0123', subject: 'a change', version: '0.80', build: 812, by: 'GitHub Actions', date: '2026-10-07' });
  assert.match(n, /`0123456789ab` \(a change\), web version v0\.80, build 812, by GitHub Actions on 2026-10-07/);
  assert.match(n, /`com\.rnaud\.memento\.unity`/);
  assert.match(n, /`com\.rnaud\.moebius`/);
  assert.match(unityNotes({ platform: 'linux', sha: 'abc' }), /memento-unity-linux\.tar\.gz/);
  assert.throws(() => unityNotes({ platform: 'ios' }));
});
