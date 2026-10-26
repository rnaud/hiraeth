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

test('remaining guardian audits and fight-only discovery retain only their actual inputs',()=>{
 for(const consumer of ['tests/elder-guardian.test.js','tests/guardian-fairness.test.js','tests/fight-load.test.js','tests/fight-temples-story.test.js'])assert.deepEqual(selection('src/hud.js',consumer),[witness],consumer);
 assert.ok(selection('public/guardians/elder-v3/model.glb','tests/elder-guardian.test.js').includes('tests/elder-guardian.test.js'));
 assert.ok(selection('src/temples/arzach.js','tests/elder-guardian.test.js').includes('tests/elder-guardian.test.js'));
 assert.deepEqual(selection('public/guardians/keeper-v1/model.glb','tests/elder-guardian.test.js'),[witness]);
 for(const consumer of ['tests/fight-load.test.js','tests/fight-temples-story.test.js']){
  assert.ok(selection('src/minigames/fight-desert.js',consumer).includes(consumer));
  assert.deepEqual(selection('src/minigames/pirates.js',consumer),[witness]);
 }
});


test('temple measurements follow game inputs without importing the CLI process wrapper',()=>{
 for(const consumer of ['tests/far-keys.test.js','tests/temple-design.test.js']) {
  for(const unrelated of ['src/hud.js','scripts/temple-design/audit.mjs'])assert.deepEqual(selection(unrelated,consumer),[witness],consumer+' excludes '+unrelated);
  for(const input of ['scripts/temple-design/measure.mjs','src/temples/spacecity.js','src/temples/logic.js'])assert.ok(selection(input,consumer).includes(consumer),consumer+' tracks '+input);
 }
 const cli=dependenciesOf('scripts/temple-design/audit.mjs',read('scripts/temple-design/audit.mjs'));
 assert.ok(cli.imports.includes('scripts/temple-design/measure.mjs'),'CLI uses the measured implementation');
});


test('documentation edits have a real reference-scan owner; unrelated unknown inputs still fail closed',()=>{
 const consumers=['tests/reference-paths.test.js',motion];
 const opts={root,files:inventory,tests:consumers,read,exists:f=>existsSync(join(root,f)),analysisCache,modifiedRegularOnly:true};
 assert.deepEqual(affectedTests(['docs/systems/testing.md'],opts),['tests/reference-paths.test.js']);
 assert.equal(affectedTests(['unknown-build-input.config'],opts),'ALL');
});


test('tool cores exclude unrelated UI, docs and CLI inputs while retaining their real data and code',()=>{
 const cases=[
  ['tests/sound-qc-measures.test.js',['scripts/sound-qc/lib.mjs','src/soundtracks.js','src/theme-levels.js']],
  ['tests/sound-qc-synthesis.test.js',['scripts/sound-qc/render-core.mjs','src/audio.js','src/gadgets/sfx.js']],
  ['tests/pirates-levels.test.js',['scripts/sound-qc/render-core.mjs','src/minigames/pirates-sfx.js']],
  ['tests/score-distinct.test.js',['scripts/score-features-core.mjs','src/score.js','src/audio.js']],
  ['tests/father-v1.test.js',['scripts/tripo/slim-father-core.mjs','scripts/tripo/slim-traveller-core.mjs','public/characters/father-v1/model.glb']],
  ['tests/portrait-head.test.js',['scripts/tripo/slim-traveller-core.mjs','public/characters/traveller-v1/head-v3/model.glb']],
  ['tests/desert-lookout.test.js',['scripts/level-design/measure.mjs','src/desert-sites.js']],
  ['tests/level-design-glass.test.js',['scripts/level-design/measure.mjs','src/levels/underwater.js']],
  ['tests/bosses.test.js',['src/temples/arzach.js','src/temples/boss.js','tests/temple-modules.js']],
  ['tests/cape-share.test.js',['scripts/costume-people.mjs','src/story/desert-data.js','src/costumes.js']],
  ['tests/hat-share.test.js',['scripts/costume-people.mjs','src/costumes.js']],
  ['tests/skirt-share.test.js',['scripts/costume-people.mjs','src/costumes.js']],
  ['tests/body-shapes.test.js',['scripts/costume-people.mjs','src/costumes.js']],
 ];
 for(const [consumer,inputs] of cases){
  for(const path of ['src/hud.js','docs/systems/testing.md'])assert.deepEqual(selection(path,consumer),[witness],consumer+' excludes '+path);
  for(const path of inputs)assert.ok(selection(path,consumer).includes(consumer),consumer+' tracks '+path);
 }
 for(const [consumer,cli] of [
  ['tests/score-distinct.test.js','scripts/score-features.mjs'],
  ['tests/father-v1.test.js','scripts/tripo/slim-father.mjs'],
  ['tests/portrait-head.test.js','scripts/tripo/slim-traveller.mjs'],
  ['tests/desert-lookout.test.js','scripts/level-design/audit.mjs'],
  ['tests/sound-qc-synthesis.test.js','scripts/sound-qc/render.mjs'],
 ])assert.deepEqual(selection(cli,consumer),[witness],consumer+' excludes its wrapper');
});


test('catalogue consumers and animation checks retain their inputs without unrelated HUD or docs',()=>{
 const cases=[
  ['tests/arcade.test.js',['src/minigames/canyon.js','src/minigames/kit/arcade.js','tests/minigame-modules.js']],
  ['tests/fight-entrance.test.js',['src/minigames/fight-desert.js','src/fight-temples/entrance.js','tests/fight-modules.js']],
  ['tests/foe-surface.test.js',['src/enemies/plans/fencer.js','src/enemies/surfaces.js']],
  ['tests/highlight.test.js',['src/story/desert-data.js','src/story/dialogue.js','tests/story-data-modules.js']],
  ['tests/short-talks.test.js',['src/story/desert-data.js','src/story/quests.js','tests/story-data-modules.js']],
  ['tests/menu-pointer.test.js',['unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.Pointer.cs','engine/menus.js']],
  ['tests/traveller-clip-bends.test.js',['src/animator.js','src/player.js','public/anim/ual.glb','data/characters/traveller-v2/traveller.glb']],
 ];
 for(const [consumer,inputs] of cases){
  for(const path of ['src/hud.js','docs/systems/testing.md'])assert.deepEqual(selection(path,consumer),[witness],consumer+' excludes '+path);
  for(const path of inputs)assert.ok(selection(path,consumer).includes(consumer),consumer+' tracks '+path);
 }
 assert.deepEqual(selection('src/minigames/pirates.js','tests/fight-entrance.test.js'),[witness]);
 assert.deepEqual(selection('scripts/blender/traveller/poses.py','tests/traveller-clip-bends.test.js'),[witness]);
 assert.ok(selection('scripts/blender/traveller/poses.py','tests/traveller-elbows.test.js').includes('tests/traveller-elbows.test.js'));
});


test('single-game definitions do not reach sibling games through pure registry helpers',()=>{
 for(const [consumer,own,other] of [
  ['tests/minigames-gallery.test.js','src/minigames/gallery.js','src/minigames/pirates.js'],
  ['tests/pirates.test.js','src/minigames/pirates.js','src/minigames/gallery.js'],
  ['tests/rings.test.js','src/minigames/rings.js','src/minigames/pirates.js'],
  ['tests/wingdrop.test.js','src/minigames/wingdrop.js','src/minigames/gallery.js'],
 ]){
  assert.ok(selection(own,consumer).includes(consumer),consumer+' tracks its game');
  assert.ok(selection('src/minigames/kit/registry.js',consumer).includes(consumer),'registry validation stays relevant');
  assert.deepEqual(selection(other,consumer),[witness],consumer+' excludes '+other);
 }
});
