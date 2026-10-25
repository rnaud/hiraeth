import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir } from '../scripts/temp-dirs.mjs';
import { webReleaseNotes, unityLabel } from '../scripts/release-metadata.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHA = '0123456789abcdef0123456789abcdef01234567';
test('web notes identify tested source and preserve native provenance without promising a new APK', () => {
  const notes = webReleaseNotes({ entry: { v: '9.1', date: '2026-10-25', items: ['A clearer hint.'] }, sha: SHA, build: 123, assets: [{name:'hiraeth-unity.apk', label:unityLabel('android', SHA)}] });
  assert.match(notes, /web and game-content update/);
  assert.match(notes, /build 123/);
  assert.ok(notes.includes('Native installers are built separately: Unity Android/Linux daily when changed, other installers on request'));
  assert.match(notes, /0123456789ab/);
  assert.doesNotMatch(notes, /Download `hiraeth-v9.1.apk`/);
  assert.throws(() => webReleaseNotes({sha:'HEAD',build:123}), /exact commit/);
});

function run({exists = false, failEdit = false} = {}) {
  const dir = tempDir('web-publish-'), log = join(dir, 'calls.json');
  writeFileSync(log, '[]');
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${join(dir, 'gh.cjs')}" "$@"\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  writeFileSync(join(dir,'gh.cjs'), `const fs=require('fs');const a=process.argv.slice(2);const p=${JSON.stringify(log)};const c=JSON.parse(fs.readFileSync(p));c.push(a);fs.writeFileSync(p,JSON.stringify(c));
if(a[1]==='view'){if(!${exists})process.exit(1);console.log(JSON.stringify({assets:[{name:'hiraeth-unity.apk',label:${JSON.stringify(unityLabel('android',SHA))}}]}));}
if(a[1]==='edit'&&${failEdit}){console.error('HTTP 422: Validation Failed');process.exit(1);}
if(a[1]==='create'||a[1]==='edit')fs.copyFileSync(a[a.indexOf('--notes-file')+1],${JSON.stringify(join(dir,'published.md'))});`);
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const result=spawnSync('sh',['scripts/web-publish.sh',sha],{cwd:root,encoding:'utf8',env:{...process.env,PATH:`${dir}:${dirname(process.execPath)}:${process.env.PATH}`,GITHUB_REPOSITORY:'o/r',RETRY_DELAYS:'0',RUNNER_TEMP:dir}});
  return {result,calls:JSON.parse(readFileSync(log)),dir,sha};
}
test('a new web release does not displace latest native APK metadata or upload fake installers', () => {
  const {result,calls,sha}=run();assert.equal(result.status,0,result.stderr);
  const create=calls.find(c=>c[1]==='create');assert.ok(create.includes('--latest=false'));assert.equal(create[create.indexOf('--target')+1],sha);
  assert.ok(!calls.some(c=>['upload','delete'].includes(c[1])));
});
test('existing release assets and latest designation are preserved; publish failures stay failures', () => {
  const {result,calls,dir}=run({exists:true});assert.equal(result.status,0,result.stderr);
  const edit=calls.find(c=>c[1]==='edit');assert.ok(edit);assert.ok(!edit.some(x=>x.startsWith('--latest')));
  assert.ok(!calls.some(c=>['upload','delete','create'].includes(c[1])));
  assert.match(readFileSync(join(dir,'published.md'),'utf8'),/0123456789ab/);
  const failed=run({exists:true,failEdit:true});assert.notEqual(failed.result.status,0);assert.ok(!failed.calls.some(c=>c[1]==='create'));
});
