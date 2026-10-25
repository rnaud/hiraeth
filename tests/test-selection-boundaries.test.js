// Repository architecture contracts: keep unrelated checks out of the edit loop,
// and keep the same checks selected when their actual inputs change.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {affectedTests,dependenciesOf} from '../scripts/affected-tests.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const motion='tests/motion-qc.test.js', witness='tests/selection-witness.test.js';
const inventory=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const files=new Map(),analysisCache=new Map();
const read=f=>{if(!files.has(f))files.set(f,readFileSync(join(root,f),'utf8'));return files.get(f);};
function selection(path,consumer=motion){
 // A virtual direct consumer supplies ownership; every real consumer/dependency
 // is read from the repository, without executing the expensive gameplay test.
 return affectedTests([path],{root,files:inventory,tests:[consumer,witness],modifiedRegularOnly:true,analysisCache,
  read:f=>f===witness?`import '../${path}';`:read(f),exists:f=>f===witness||existsSync(join(root,f))});
}
test('HUD edits do not select motion QC; real motion inputs still do',()=>{
 for(const path of ['src/hud.js'])assert.deepEqual(selection(path),[witness],path);
 for(const path of ['src/animator.js','src/player.js','src/physics.js','scripts/motion-qc/runner.mjs','scripts/motion-qc/lib.mjs','scripts/motion-qc/scenarios.mjs'])assert.ok(selection(path).includes(motion),path);
 const cli=dependenciesOf('scripts/motion-qc/run.mjs',read('scripts/motion-qc/run.mjs'));
 assert.ok(cli.imports.includes('scripts/motion-qc/runner.mjs'),'CLI uses the same tested runner');
 assert.equal(cli.unknown,true,'arbitrary CLI tuning remains conservative');
});
test('finite source contracts stay local while tracking their declared inputs',()=>{
 for(const [consumer,dependency] of [['tests/ambush.test.js','src/ambush.js'],['tests/door-walk.test.js','src/main.js']]){
  assert.deepEqual(selection('src/hud.js',consumer),[witness],consumer);
  assert.ok(selection(dependency,consumer).includes(consumer),dependency);
 }
});


test('audit boundaries exclude HUD edits and retain their gameplay, model and catalog inputs',()=>{
 const cases=[
  ['tests/guardian-completable.test.js',['src/temples/boss.js','public/guardians/keeper-v1/model.glb']],
  ['tests/keeper-fairness.test.js',['src/temples/boss.js','public/guardians/keeper-v1/model.glb']],
  ['tests/zfight.test.js',['scripts/zfight/audit-core.mjs','scripts/zfight/lib.mjs','src/levels/desert.js']],
  ['tests/serendipity-map.test.js',['tests/minigame-modules.js','src/minigames/canyon.js']],
  ['tests/hosts.test.js',['tests/minigame-modules.js','src/minigames/canyon.js']],
  ['tests/makehuman-worlds.test.js',['tests/story-data-modules.js','src/story/desert-data.js']],
  ['tests/playthrough.test.js',['tests/completion-spec.js','src/temples/boss.js']],
 ];
 for(const [consumer,inputs] of cases){
  assert.deepEqual(selection('src/hud.js',consumer),[witness],consumer+' must not depend on HUD');
  for(const path of inputs)assert.ok(selection(path,consumer).includes(consumer),consumer+' must track '+path);
 }
});

test('Keeper-only audits exclude Elder model edits while retaining Keeper model changes',()=>{
 for(const consumer of ['tests/keeper-fairness.test.js','tests/keeper-guardian.test.js','tests/keeper-second-pass.test.js']){
  for(const path of ['public/guardians/elder-v3/model.glb','data/guardians/elder-v1/model.glb'])assert.deepEqual(selection(path,consumer),[witness],consumer+' excludes '+path);
  assert.ok(selection('public/guardians/keeper-v1/model.glb',consumer).includes(consumer));
 }
});
