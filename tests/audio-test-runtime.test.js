import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,symlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tempDir,removeTemp} from '../scripts/temp-dirs.mjs';
import {decodedTakes,effectBytes,installEffectFileDecoder,RATE} from '../scripts/sound-qc/test-runtime.mjs';
import {decodedTakes as genericDecoder} from '../scripts/sound-qc/render.mjs';
import {sfxFiles} from '../src/sfx.js';
import {installAudio} from '../engine/webaudio.js';
import {affectedTests,dependenciesOf} from '../scripts/affected-tests.mjs';
import {boundedAudioInputs,AUDIO_CONTRACT_FILE} from '../scripts/test-loader-contract.mjs';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const read=f=>readFileSync(f,'utf8'), exists=existsSync;
const options={read,exists,files,analyze:dependenciesOf};
const consumers=['tests/action-sounds.test.js','tests/engine-sound.test.js','tests/music-page.test.js','tests/sound-qc-decoder.test.js'];
const witness='tests/audio-input-witness.test.js';
const analysisCache=new Map();
const selected=(path,consumer,override={})=>affectedTests([path],{read:f=>f===witness?`import '../${path}';`:read(f),exists:f=>f===witness||exists(f),files,tests:[consumer,witness],modifiedRegularOnly:true,analysisCache,...override});
test('audio consumers exclude presentation while retaining real sound, decoder and packaged assets',()=>{
 const d=boundedAudioInputs(options);assert.ok(d);assert.equal(d.unknown,false);
 for(const consumer of consumers){
  for(const path of ['src/hud-view.js','docs/systems/ui.md'])assert.deepEqual(selected(path,consumer),[witness],consumer+' excludes '+path);
  for(const path of ['src/sfx.js','public/sfx/new-take.mp3','scripts/sound-qc/render.mjs','scripts/sound-qc/test-runtime.mjs'])assert.ok(selected(path,consumer).includes(consumer),consumer+' retains '+path);
 }
 for(const path of ['src/audio.js','src/player.js','src/levels/desert.js'])assert.ok(selected(path,'tests/engine-sound.test.js').includes('tests/engine-sound.test.js'),path);
 assert.equal(affectedTests([AUDIO_CONTRACT_FILE],{files,read,exists}),'ALL');
});
test('stale or malformed audio contracts fail closed, including newly opaque source imports',()=>{
 for(const path of ['scripts/sound-qc/test-runtime.mjs','scripts/sound-qc/render.mjs']){
  const changed=f=>read(f)+(f===path?'\n// modified\n':'');
  assert.equal(boundedAudioInputs({...options,read:changed}),null,path);
  assert.ok(selected('src/hud-view.js',consumers[0],{read:f=>f===witness?"import '../src/hud-view.js';":changed(f)}).includes(consumers[0]));
 }
 for(const content of ['','{}','{"version":2}'])assert.equal(boundedAudioInputs({...options,read:f=>f===AUDIO_CONTRACT_FILE?content:read(f)}),null);
 const d=boundedAudioInputs({...options,read:f=>read(f)+(f==='scripts/sound-qc/render-core.mjs'?"\nimport(someUnknownPath);":'')});
 assert.equal(d.unknown,true);
});
test('guarded decoder uses the same packaged bytes and PCM as the generic decoder',()=>{
 const dir=tempDir('audio-boundary-parity-');
 try{
  const name=sfxFiles().find(f=>f.endsWith('.mp3'));assert.ok(name);
  assert.deepEqual(effectBytes(name),readFileSync(new URL('../public/sfx/'+name,import.meta.url)));
  const a=decodedTakes(join(dir,'bounded'))(name), b=genericDecoder(join(dir,'generic'))(name);
  assert.ok(a&&b);assert.equal(a.rate,RATE);assert.deepEqual(a,b);
 }finally{removeTemp(dir);}
});
test('audio boundary rejects traversal, arbitrary roots, repository caches and cache symlinks',()=>{
 const dir=tempDir('audio-boundary-guards-');
 try{
  const decode=decodedTakes(dir);
  for(const name of ['../src/hud-view.js','/etc/passwd','a/b.mp3','a\\b.mp3','x.mp3\0'])assert.throws(()=>decode(name),/Packaged audio filename/);
  assert.throws(()=>decodedTakes(dir,'src'),/Packaged audio directory/);
  assert.throws(()=>decodedTakes(process.cwd()),/temporary directory/);
  symlinkSync(process.cwd(),join(dir,'repository'),'dir');
  assert.throws(()=>decodedTakes(join(dir,'repository')),/temporary directory/);
 }finally{removeTemp(dir);}
});
test('installed decoder produces real finite audio and rejects unknown bytes',async()=>{
 const dir=tempDir('audio-boundary-install-'), global={};
 try{
  installAudio(global,{sampleRate:RATE});installEffectFileDecoder(global.AudioContext,{cache:dir});
  const context=new global.AudioContext(),name=sfxFiles().find(f=>f.endsWith('.mp3'));
  const pcm=await context.decodeAudioData(effectBytes(name));
  assert.ok(pcm.length>0);assert.ok(pcm.getChannelData(0).every(Number.isFinite));
  assert.ok(pcm.getChannelData(0).some(x=>Math.abs(x)>0.00001));
  await assert.rejects(context.decodeAudioData(new Uint8Array([1,2,3])),/unknown bytes/);
 }finally{removeTemp(dir);}
});

test('audio contracts use both Git snapshots rather than uncommitted working bytes',async()=>{
 const {mkdirSync,writeFileSync}=await import('node:fs');
 const {gitSelection}=await import('../scripts/affected-tests.mjs');
 const dir=tempDir('audio-contract-git-');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('GIT_')));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,env,encoding:'utf8'}).trim();
 const put=(p,text)=>{mkdirSync(join(dir,p,'..'),{recursive:true});writeFileSync(join(dir,p),text);};
 const commit=()=>{git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};
 try{
  git('init','-q');git('config','user.name','Audio input fixture');git('config','user.email','fixture@example.invalid');git('config','core.hooksPath','/dev/null');
  put(AUDIO_CONTRACT_FILE,read(AUDIO_CONTRACT_FILE));
  for(const p of Object.keys(JSON.parse(read(AUDIO_CONTRACT_FILE)).fingerprints))put(p,read(p));
  put('scripts/sound-qc/render-core.mjs',"export const RATE=48000;\n");put('src/sfx.js','export const sfxFiles=()=>[];');
  put('docs/note.md','before');put('tests/audio.test.js',"import '../scripts/sound-qc/test-runtime.mjs';");
  put('tests/docs.test.js',"readFileSync('docs/note.md');");const base=commit();
  put('docs/note.md','after');git('add','docs/note.md');
  put(AUDIO_CONTRACT_FILE,'{}');
  assert.deepEqual(gitSelection({root:dir,staged:true}),['tests/docs.test.js']);
  put(AUDIO_CONTRACT_FILE,read(AUDIO_CONTRACT_FILE));const head=commit();
  assert.deepEqual(gitSelection({root:dir,base,head}),['tests/docs.test.js']);
  put('scripts/sound-qc/render.mjs',read('scripts/sound-qc/render.mjs')+'\n// changed decoder');const stale=commit();
  put('docs/note.md','third');const after=commit();
  assert.deepEqual(gitSelection({root:dir,base:stale,head:after}),['tests/audio.test.js','tests/docs.test.js']);
 }finally{removeTemp(dir);}
});

test('the sound QC CLI keeps its public driver interface and the same scenario constants',async()=>{
 const facade=await import('../scripts/sound-qc/drive.mjs');
 const core=await import('../scripts/sound-qc/drive-core.mjs');
 assert.deepEqual(Object.keys(facade).sort(),['FPS','PLUMBING','driver','engineBundle']);
 assert.strictEqual(facade.PLUMBING,core.PLUMBING);assert.equal(facade.FPS,core.FPS);
});
