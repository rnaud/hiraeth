// The Unity builds on a version's release (issue #186; docs/systems/android.md, "The Unity builds on a version's
// release"): scripts/unity-publish.sh puts each build on its prerelease, as before, and onto the newest vX.Y release,
// labelled with its commit; the notes' Unity section is read back from the labels, and the Android release keeps it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tempDir } from '../scripts/temp-dirs.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_RELEASE_ASSET, UNITY_RELEASES, UNITY_SECTION_END, UNITY_SECTION_START,
  newestVersionTag, unityBuilds, unityLabel, unitySection, withUnitySection,
} from '../scripts/release-info.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const SHA = '0123456789abcdef0123456789abcdef01234567';

test('the newest version is the highest vX.Y, number by number, among the releases', () => {
  assert.equal(newestVersionTag(['v1.9', 'v1.58', 'v1.100', 'unity-xbox', 'steam-deck', 'xbox']), 'v1.100');
  assert.equal(newestVersionTag(['v0.99', 'v1.0']), 'v1.0');
  assert.equal(newestVersionTag(['v1.58.1', 'v1.58']), 'v1.58.1');
  assert.equal(newestVersionTag(['unity-linux', 'v1.x']), undefined);
  assert.equal(MAX_RELEASE_ASSET, 2 ** 31);
});

test('each Unity build is labelled with what it is and its commit, and read back from the label', () => {
  assert.equal(unityLabel('xbox', SHA), "Hiraeth (Unity) for Xbox (Developer Mode), testers' build (commit 0123456789ab)");
  assert.match(unityLabel('linux', SHA), /^Hiraeth \(Unity\) for Linux \/ Steam Deck/);
  assert.match(unityLabel('android', SHA), /^Hiraeth \(Unity\) for Android/);
  assert.throws(() => unityLabel('ios', SHA));
  assert.throws(() => unityLabel('xbox', 'HEAD'));
  const assets = [
    { name: 'hiraeth-v1.58.apk', label: 'Hiraeth v1.58 for Android (the game)' },
    { name: 'hiraeth-unity-xbox.zip', label: unityLabel('xbox', SHA) },
    { name: 'hiraeth-unity.apk', label: '' },
  ];
  assert.deepEqual(unityBuilds(assets), {
    xbox: { file: 'hiraeth-unity-xbox.zip', sha: '0123456789ab' },
    android: { file: 'hiraeth-unity.apk', sha: undefined },
  });
  const s = unitySection(assets, 'o/r');
  assert.ok(s.startsWith(UNITY_SECTION_START) && s.endsWith(UNITY_SECTION_END));
  assert.match(s, /Xbox \(Developer Mode\): `hiraeth-unity-xbox\.zip` below, built from commit \[0123456789ab\]\(https:\/\/github\.com\/o\/r\/commit\/0123456789ab\)/);
  assert.match(s, /for Android: `hiraeth-unity\.apk` below, from an unrecorded commit/);
  assert.match(s, /Linux \/ Steam Deck: not built since this release was made; the newest is on \[unity-linux\]\(https:\/\/github\.com\/o\/r\/releases\/tag\/unity-linux\)/);
  assert.match(s, /earlier commit than the APK/);
});

test('the notes\' Unity section is replaced in place, or added once at the end', () => {
  const assets = [{ name: UNITY_RELEASES.linux.file, label: unityLabel('linux', SHA) }];
  const added = withUnitySection('Hiraeth v1.58\n\n- a line\n', assets);
  assert.match(added, /^Hiraeth v1\.58\n\n- a line\n\n<!-- unity builds -->/);
  const again = withUnitySection(`${added}\nafter`, [...assets, { name: UNITY_RELEASES.xbox.file, label: unityLabel('xbox', 'fedcba9876543210') }]);
  assert.equal(again.split(UNITY_SECTION_START).length, 2);
  assert.match(again, /fedcba987654/);
  assert.match(again, /\nafter$/);
});

test('the Android release writes the section from the release\'s assets, and labels its APK', () => {
  const dir = tempDir('notes-');
  writeFileSync(join(dir, 'r.json'), JSON.stringify({ assets: [{ name: 'hiraeth-unity-xbox.zip', label: unityLabel('xbox', SHA) }] }));
  const notes = execFileSync(process.execPath, ['scripts/release-info.mjs', 'notes', join(dir, 'r.json')], { cwd: root, encoding: 'utf8' });
  assert.match(notes, /Download `hiraeth-v[\d.]+\.apk` below/);
  assert.match(notes, /commit \[0123456789ab\]/);
  assert.match(execFileSync(process.execPath, ['scripts/release-info.mjs', 'notes'], { cwd: root, encoding: 'utf8' }), /Xbox \(Developer Mode\): not built since/);
  const w = read('.github/workflows/android.yml');
  assert.match(w, /gh release view "\$TAG" --json assets > "\$RUNNER_TEMP\/release\.json" \|\| return 1\n\s*node scripts\/release-info\.mjs notes "\$RUNNER_TEMP\/release\.json" > "\$RUNNER_TEMP\/notes\.md" \|\| return 1\n\s*gh release edit "\$TAG" --notes-file/);
  assert.match(w, /gh release create "\$TAG" "\$APK#\$LABEL"/);
});

// unity-publish.sh against a fake gh: it records the calls and keeps the releases' assets and notes in a JSON file
function fakeGh(dir, { tags = ['v1.57', 'v1.58', 'unity-xbox', 'steam-deck'], failVersionUpload = false } = {}) {
  const state = join(dir, 'state.json');
  writeFileSync(state, JSON.stringify({ calls: [], releases: { 'v1.58': { body: 'Hiraeth v1.58\n\n- a line\n', assets: [{ name: 'hiraeth-v1.58.apk', label: 'Hiraeth v1.58 for Android (the game)' }] } } }));
  // (a shell wrapper: the node binary's path may hold spaces, which a #! line can't)
  const gh = join(dir, 'gh');
  writeFileSync(gh, `#!/bin/sh\nexec "${process.execPath}" "${join(dir, 'gh.cjs')}" "$@"\n`);
  writeFileSync(join(dir, 'gh.cjs'), `const fs = require('fs');
const s = JSON.parse(fs.readFileSync(${JSON.stringify(state)}, 'utf8'));
const a = process.argv.slice(2);
s.calls.push(a);
const save = () => fs.writeFileSync(${JSON.stringify(state)}, JSON.stringify(s));
const rel = (t) => (s.releases[t] ??= { body: '', assets: [] });
let code = 0;
if (a[0] === 'api') { if (!a.includes('PATCH')) console.log(a[1].split('/').pop()); }
else if (a[0] === 'release' && a[1] === 'list') console.log(${JSON.stringify(tags.join('\n'))});
else if (a[0] === 'release' && a[1] === 'view') { if (a.includes('--json')) console.log(JSON.stringify(rel(a[2]))); }
else if (a[0] === 'release' && a[1] === 'upload') {
  const [file, label = ''] = a[3].split('#');
  if (${failVersionUpload} && a[2].startsWith('v')) { console.error('HTTP 422: Validation Failed'); code = 1; }
  else { const r = rel(a[2]), name = file.split('/').pop(); r.assets = r.assets.filter((x) => x.name !== name).concat({ name, label, size: fs.statSync(file).size }); }
} else if (a[0] === 'release' && a[1] === 'edit') { const f = a[a.indexOf('--notes-file') + 1]; rel(a[2]).body = fs.readFileSync(f, 'utf8'); }
save();
process.exit(code);
`);
  chmodSync(gh, 0o755);
  return () => JSON.parse(readFileSync(state, 'utf8'));
}

function publish(env = {}, opts) {
  const dir = tempDir('unity-publish-');
  const state = fakeGh(dir, opts);
  const build = join(dir, 'build.zip');
  writeFileSync(build, 'a build');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const r = spawnSync('sh', [join(root, 'scripts/unity-publish.sh'), 'xbox', build, 'a test'], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${dirname(process.execPath)}:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r', RETRY_DELAYS: '0 0 0', SHA: sha, GH_TOKEN: 'x', ...env },
  });
  return { r, s: state(), sha };
}

test('a Unity build goes onto its prerelease, then onto the newest version\'s release, labelled with its commit', { skip: !existsSync(join(root, '.git')) && 'no git checkout' }, () => {
  const { r, s, sha } = publish();
  assert.equal(r.status, 0, r.stderr);
  const uploads = s.calls.filter((c) => c[1] === 'upload');
  assert.deepEqual(uploads.map((c) => c[2]), ['unity-xbox', 'v1.58']);
  assert.ok(uploads.every((c) => c.includes('--clobber')));
  assert.match(uploads[0][3], /\/hiraeth-unity-xbox\.zip$/);   // (the prerelease's file as before: no label)
  assert.equal(uploads[1][3].split('#')[1], unityLabel('xbox', sha));
  // the prerelease's notes and flags as before; the version's notes keep their lines and gain the section
  assert.ok(s.calls.some((c) => c[1] === 'edit' && c[2] === 'unity-xbox' && c.includes('--prerelease') && c.includes('--latest=false')));
  const vedit = s.calls.find((c) => c[1] === 'edit' && c[2] === 'v1.58');
  assert.ok(vedit && !vedit.includes('--prerelease') && !vedit.some((x) => x.startsWith('--latest')));
  const body = s.releases['v1.58'].body;
  assert.match(body, /^Hiraeth v1\.58\n\n- a line\n\n<!-- unity builds -->/);
  assert.match(body, new RegExp(`Xbox \\(Developer Mode\\): \`hiraeth-unity-xbox\\.zip\` below, built from commit \\[${sha.slice(0, 12)}\\]`));
  assert.match(r.stdout, /releases\/tag\/v1\.58 \(hiraeth-unity-xbox\.zip as/);
});

test('VERSION_TAG picks the release (a test one), NO_VERSION_RELEASE=1 leaves the prerelease alone, a failure is a warning', () => {
  let { r, s } = publish({ VERSION_TAG: 'test-186' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(s.calls.filter((c) => c[1] === 'upload').map((c) => c[2]), ['unity-xbox', 'test-186']);
  assert.ok(!s.calls.some((c) => c[1] === 'list'));
  ({ r, s } = publish({ NO_VERSION_RELEASE: '1' }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(s.calls.filter((c) => c[1] === 'upload').map((c) => c[2]), ['unity-xbox']);
  ({ r, s } = publish({}, { failVersionUpload: true }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::hiraeth-unity-xbox\.zip is on unity-xbox but could not be put on the newest version's release v1\.58/);
  assert.ok(!s.calls.some((c) => c[1] === 'edit' && c[2] === 'v1.58'));
});

test('the Unity workflows publish through the script, so every build lands on the version\'s release', () => {
  for (const [file, platform] of [['unity-xbox.yml', 'xbox'], ['unity-android.yml', 'android'], ['unity-android.yml', 'linux']]) {
    assert.match(read(`.github/workflows/${file}`), new RegExp(`scripts/unity-publish\\.sh ${platform} `), file);
  }
  const publishSh = read('scripts/unity-publish.sh');
  assert.match(publishSh, /retry gh release upload "\$VTAG" "\$ASSET#\$LABEL" -R "\$REPO" --clobber/);
});
