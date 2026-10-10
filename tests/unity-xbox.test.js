// The Unity build on the Xbox (docs/systems/xbox.md, "The Unity build on the Xbox"): the workflow's key lines, the
// package's own identity, Puerts' QuickJS chosen where there is no V8, and the numbers written to LocalState.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITY_RELEASES, unityNotes } from '../scripts/release-info.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const workflow = read('.github/workflows/unity-xbox.yml');
const build = read('unity/Memento/Assets/MementoJS/Editor/BridgeBuild.cs');

test('the workflow builds the UWP solution with GameCI on Windows, then packages and signs it', () => {
  assert.match(workflow, /runs-on: windows-2022/);
  assert.match(workflow, /^ {2}workflow_dispatch:/m);
  assert.match(workflow, /- '\.github\/workflows\/unity-xbox\.yml'/);
  assert.match(workflow, /UNITY_VERSION: 6000\.6\.4f1/);
  const version = /m_EditorVersion: (\S+)/.exec(read('unity/Memento/ProjectSettings/ProjectVersion.txt'))[1];
  assert.ok(workflow.includes(`UNITY_VERSION: ${version}`));
  const steps = workflow.split('uses: game-ci/unity-builder@v6').slice(1);
  assert.equal(steps.length, 4);   // (the glue and the solution, each retried once)
  for (const s of steps) {
    assert.match(s, /targetPlatform: WSAPlayer/);
    assert.match(s, /UNITY_EMAIL: \$\{\{ secrets\.UNITY_EMAIL \}\}/);
    assert.match(s, /allowDirtyBuild: true/);
  }
  assert.match(workflow, /buildMethod: Memento\.EditorTools\.BridgeBuild\.Il2cpp/);
  assert.match(workflow, /buildMethod: Memento\.EditorTools\.BridgeBuild\.Xbox/);
  // QuickJS, its UWP natives built from Puerts' source
  assert.match(workflow, /PUERTS_BACKENDS=Quickjs scripts\/unity-js-setup\.sh/);
  assert.match(workflow, /\.\/scripts\/unity-uwp-natives\.ps1/);
  // msbuild Master x64, unsigned, then signtool with the WebView2 app's certificate
  assert.match(workflow, /-p:Configuration=Master -p:Platform=x64/);
  assert.match(workflow, /-p:AppxPackageSigningEnabled=false/);
  assert.match(workflow, /XBOX_PFX_BASE64: \$\{\{ secrets\.XBOX_PFX_BASE64 \}\}/);
  assert.match(workflow, /signtool/);
  assert.match(workflow, /Name="rnaud\.HiraethUnity"/);
  assert.match(workflow, /scripts\/unity-publish\.sh xbox out\/memento-unity-xbox\.zip/);
  assert.match(workflow, /key: unity-library-xbox-/);
  assert.match(workflow, /scripts\/unity-ci-cache-prune\.sh unity-library-xbox- "\$KEY"/);
  assert.doesNotMatch(workflow, /github\.run_id/);   // (no cache key that changes every run)
});

test('the package installs next to the WebView2 app, never over it, to a prerelease of its own', () => {
  assert.equal(/const string XboxPackage = "([^"]+)"/.exec(build)[1], 'rnaud.HiraethUnity');
  assert.equal(UNITY_RELEASES.xbox.package, 'rnaud.HiraethUnity');
  assert.match(read('xbox/Hiraeth/Package.appxmanifest'), /Name="rnaud\.Hiraeth"/);
  assert.equal(UNITY_RELEASES.xbox.tag, 'unity-xbox');
  const notes = unityNotes({ platform: 'xbox', sha: 'abcdef0123456789', version: '1.39', build: 1700 });
  assert.match(notes, /memento-unity-xbox\.zip/);
  assert.match(notes, /rnaud\.Hiraeth`/);
  assert.match(notes, /unity\.log/);
  const xbox = build.slice(build.indexOf('public static void Xbox()'));
  assert.match(xbox, /BuildTarget\.WSAPlayer/);
  assert.match(xbox, /ScriptingImplementation\.IL2CPP/);
  assert.match(xbox, /GraphicsDeviceType\.Direct3D11/);
  assert.match(xbox, /Wsa\("wsaArchitecture", "x64"\)/);
});

test('Puerts runs QuickJS where its V8 package is missing, and the setup can install QuickJS', () => {
  const js = read('unity/Memento/Assets/MementoJS/Runtime/JsRuntime.cs');
  assert.match(js, /Puerts\.BackendQuickJS, com\.tencent\.puerts\.quickjs/);
  assert.match(js, /Enum\.Parse\(kind, "QuickJS"\)/);
  assert.match(read('unity/Memento/Assets/MementoJS/link.xml'), /com\.tencent\.puerts\.quickjs/);
  const setup = read('scripts/unity-js-setup.sh');
  assert.match(setup, /BACKENDS=\$\{PUERTS_BACKENDS:-V8\}/);
  const natives = read('scripts/unity-uwp-natives.ps1');
  assert.match(natives, /'-DCMAKE_SYSTEM_NAME=WindowsStore' '-DCMAKE_SYSTEM_VERSION=10\.0'/);
  assert.match(natives, /--branch "Unity_v\$Version"/);
  assert.match(natives, /Windows Store Apps: WindowsStoreApps/);
});

test('the numbers go to LocalState\\unity.log, the native side apart from the script', () => {
  const m = read('unity/Memento/Assets/MementoJS/Runtime/BridgeMetrics.cs');
  assert.match(m, /Application\.persistentDataPath/);
  assert.match(m, /"unity\.log"/);
  assert.match(m, /#if UNITY_WSA && !UNITY_EDITOR\n\s*return true;/);
  for (const s of ['first node', 'world settled', 'first frames', 'gpu', 'script', 'wait']) assert.ok(m.includes(s), s);
  const runner = read('unity/Memento/Assets/MementoJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /if \(BridgeMetrics\.Wanted\(\)\) gameObject\.AddComponent<BridgeMetrics>\(\)\.runner = this;/);
  assert.match(runner, /scriptMsTotal \+=/);
});
