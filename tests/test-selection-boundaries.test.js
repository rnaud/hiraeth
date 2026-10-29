// Repository architecture contracts: keep unrelated checks out of the edit loop,
// and keep the same checks selected when their actual inputs change.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {affectedTests,dependenciesOf,repositorySyntax} from '../scripts/affected-tests.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const motion='tests/motion-qc.test.js', witness='tests/selection-witness.test.js';
const inventory=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
// Syntax of exact source bytes from the selector's own cache (warm after the hook's run); every selection is recomputed.
const files=new Map(),presence=new Map(),analysisCache=new Map(),syntax=repositorySyntax();
const exists=f=>{if(!presence.has(f))presence.set(f,existsSync(join(root,f)));return presence.get(f);};
const read=f=>{if(!files.has(f))files.set(f,readFileSync(join(root,f),'utf8'));return files.get(f);};
function selection(path,consumer=motion){
 // A virtual direct consumer supplies ownership; every real consumer/dependency
 // is read from the repository, without executing the expensive gameplay test.
 return affectedTests([path],{root,files:inventory,tests:[consumer,witness],modifiedRegularOnly:true,analysisCache,syntax,
  read:f=>f===witness?`import '../${path}';`:read(f),exists:f=>f===witness||exists(f)});
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
 const opts={root,files:inventory,tests:consumers,read,exists,analysisCache,modifiedRegularOnly:true};
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

test('focused quest, presentation and packaging consumers exclude HUD but retain actual inputs',()=>{
 const cases=[
  ['tests/quest-needs.test.js',['src/story/quest-needs.js','src/story/desert-data.js','src/story/glassdunes-people.js','tests/story-people-modules.js']],
  ['tests/quest-skip.test.js',['src/story/quests.js','src/story/incal-data.js']],
  ['tests/people-page.test.js',['src/story/people-book.js','src/story/glassdunes-people.js']],
  ['tests/prominence.test.js',['src/costumes.js','src/story/bazaar-data.js']],
  ['tests/minigames-qa.test.js',['src/minigames/gallery.js','src/minigames/kit/registry.js']],
  ['tests/garden-kit.test.js',['src/levels/reference-spheres.js']],
  ['tests/dialogue-playtest.test.js',['src/npc.js','src/story/dialogue.js']],
  ['tests/dialogue-instructions-626.test.js',['src/temples/buried-data.js','tests/fixtures/dialogue-instructions-626.json']],
  ['tests/teasel-briony-guidance.test.js',['src/temples/perdide-data.js','tests/fixtures/teasel-briony-guidance-626.json']],
  ['tests/changelog.test.js',['src/changelog.js','changelog.md']],
  ['tests/reference-sheets.test.js',['scripts/content-policy.mjs','src/levels/reference-sheets.js']],
 ];
 for(const [consumer,inputs] of cases){
  assert.deepEqual(selection('src/hud.js',consumer),[witness],consumer+' excludes HUD');
  for(const input of inputs)assert.ok(selection(input,consumer).includes(consumer),consumer+' tracks '+input);
 }
});

test('packaging predicates have no dependency on publishing, stripping or game bundle code',()=>{
 const policy=dependenciesOf('scripts/content-policy.mjs',read('scripts/content-policy.mjs'));
 assert.equal(policy.unknown,false);
 assert.deepEqual(policy.imports,['src/music-store.js']);
 const consumer='tests/reference-sheets.test.js';
 for(const file of ['scripts/web-update.mjs','scripts/site-only.mjs','scripts/engine-bundle.mjs'])assert.deepEqual(selection(file,consumer),[witness],file);
});


test('map chest save/reload audit stays selected for world and chest changes, not HUD presentation',()=>{
 const consumer='tests/map-chest-saves.test.js';
 assert.deepEqual(selection('src/hud.js',consumer),[witness]);
 for(const input of ['src/temples/pieces.js','src/temples/runtime.js','src/temples/garage.js','src/temples/attachment.js','src/game-state.js']) {
  assert.ok(selection(input,consumer).includes(consumer),consumer+' tracks '+input);
 }
 assert.ok(selection('src/hud-state.js','tests/key-chests.test.js').includes('tests/key-chests.test.js'),'actual key-to-HUD behavior remains selected');
});


test('transport HUD tests do not drag unrelated city rides and hull audits into a HUD edit',()=>{
 for(const consumer of ['tests/cab-ride.test.js','tests/ship.test.js'])assert.deepEqual(selection('src/hud.js',consumer),[witness],consumer);
 for(const consumer of ['tests/cab-hud.test.js','tests/ship-hud.test.js']){assert.ok(selection('src/hud-state.js',consumer).includes(consumer),consumer);assert.deepEqual(selection('src/hud-view.js',consumer),[witness],consumer+' excludes browser presentation');}
 for(const [consumer,input] of [['tests/cab-ride.test.js','src/taxi.js'],['tests/ship.test.js','src/ship/ship.js'],['tests/ship-hud.test.js','src/ship/ship.js']])assert.ok(selection(input,consumer).includes(consumer),input);
});


test('material runtime audits exclude presentation and source-scanning tools while retaining game inputs',()=>{
 for(const consumer of ['tests/bridge-materials-worlds-a.test.js','tests/bridge-materials-worlds-b.test.js','tests/bridge-materials-minigames.test.js']){
  for(const path of ['src/hud-view.js','scripts/bridge-gaps.mjs','engine/bridge-gaps.js','scripts/engine-bundle.mjs'])assert.deepEqual(selection(path,consumer),[witness],consumer+' excludes '+path);
  for(const path of ['engine/bridge-material-gaps.js','scripts/bridge-materials.mjs','scripts/bridge-gap-compare.mjs','src/levels/desert.js','src/minigames/canyon.js','src/materials.js','engine/unity/port-format.js'])assert.ok(selection(path,consumer).includes(consumer),consumer+' tracks '+path);
 }
});


test('gameplay sequences do not inherit generic VM fixture inputs',()=>{
 const consumer='tests/sequences-play.test.js';
 for(const path of ['src/hud-view.js','scripts/engine-bundle.mjs'])assert.deepEqual(selection(path,consumer),[witness],consumer+' excludes '+path);
 for(const path of ['src/hud-state.js','engine/sequences.js','engine/vm-run.mjs','src/levels/desert.js'])assert.ok(selection(path,consumer).includes(consumer),consumer+' tracks '+path);
});


test('whole-game bridge and Whale input cases stay independent of custom VM fixtures',()=>{
 for(const consumer of ['tests/engine-game-flow.test.js','tests/engine-whale-input.test.js']){
  for(const path of ['src/hud-view.js','scripts/engine-bundle.mjs','tests/fixtures/whale-exit-entry.mjs'])assert.deepEqual(selection(path,consumer),[witness],consumer+' excludes '+path);
  for(const path of ['src/hud-state.js','engine/game.js','src/temples/underwater.js'])assert.ok(selection(path,consumer).includes(consumer),consumer+' tracks '+path);
 }
});


test('key presentation and Unity input policy do not select unrelated expensive fixtures',()=>{
 assert.deepEqual(selection('src/hud-view.js','tests/key-chests.test.js'),[witness]);
 assert.ok(selection('src/hud-view.js','tests/key-counter-hud.test.js').includes('tests/key-counter-hud.test.js'));
 for(const input of ['src/hud-state.js','src/temples/pieces.js','src/temples/runtime.js'])assert.ok(selection(input,'tests/key-chests.test.js').includes('tests/key-chests.test.js'),input);
 const consumer='tests/unity-traveller-v2.test.js';
 for(const input of ['src/hud-view.js','scripts/unity-release-plan.mjs'])assert.deepEqual(selection(input,consumer),[witness],input);
 for(const input of ['scripts/unity-release-inputs.mjs','src/characters/traveller-v2.js','engine/game.js'])assert.ok(selection(input,consumer).includes(consumer),input);
});

test('browser theme changes exclude gameplay journeys while actual behavior still reaches them', () => {
  for (const consumer of ['tests/sequences-opening.test.js', 'tests/sequences-play.test.js', 'tests/engine-finishable.test.js']) {
    for (const presentation of ['src/hud-look.js', 'src/hud-styles/cinema.js', 'src/hud-styles/box-card.js']) {
      assert.deepEqual(selection(presentation, consumer), [witness], consumer + ' excludes ' + presentation);
    }
    assert.ok(selection('src/ship/cinema.js', consumer).includes(consumer), consumer + ' retains cinema behavior');
  }
  assert.ok(selection('src/hud-look.js', 'tests/ui-style-registry.test.js').includes('tests/ui-style-registry.test.js'));
  assert.ok(selection('src/hud-styles/cinema.js', 'tests/unity-letterbox.test.js').includes('tests/unity-letterbox.test.js'));
});


test('native picture checks ignore HUD markup but retain game and complete model inputs', () => {
  const consumer = 'tests/engine-gltf-pictures.test.js';
  assert.deepEqual(selection('src/hud-view.js', consumer), [witness]);
  for (const path of ['src/hud-state.js', 'src/levels/desert.js', 'engine/boot.js',
    'tests/public-model-inputs.js', 'public/characters/new/model.glb'])
    assert.ok(selection(path, consumer).includes(consumer), path);
  const catalogue = 'tests/public-model-inputs.test.js';
  assert.deepEqual(selection('src/hud-view.js', catalogue), [witness]);
  assert.ok(selection('public/characters/new/model.glb', catalogue).includes(catalogue));
});


test('approved PCM mix tests exclude theme edits but retain audio and packaged files', () => {
  for (const consumer of ['tests/selected-action-audio.test.js', 'tests/selected-action-mix.test.js', 'tests/next-action-mix.test.js']) {
    assert.deepEqual(selection('src/hud-look.js', consumer), [witness], consumer);
    for (const input of ['src/audio.js', 'src/action-sfx.js', 'public/sfx/new-take.wav', 'scripts/sound-qc/test-runtime.mjs'])
      assert.ok(selection(input, consumer).includes(consumer), consumer + ' tracks ' + input);
  }
});

// A virtual consumer importing one module, so a boundary can be checked for any module, not only for a test of it.
function reach(path, module) {
  const consumer = 'tests/virtual-consumer.test.js';
  return affectedTests([path], { root, files: inventory, tests: [consumer, witness], modifiedRegularOnly: true, analysisCache, syntax,
    read: f => f === consumer ? `import '../${module}';` : f === witness ? `import '../${path}';` : read(f),
    exists: f => f === consumer || f === witness || exists(f) }).includes(consumer);
}

test('changelog text stays out of modules that only show the version; What\'s new keeps it', () => {
  for (const module of ['src/version.js', 'src/ui.js', 'src/title.js', 'src/world-picker.js', 'src/update-panel.js']) {
    assert.equal(reach('src/changelog.js', module), false, module + ' only shows the version');
    assert.equal(reach('src/version.js', module), true, module + ' shows the version');
  }
  // the real readers of the lines: the native What's new (and so the whole game), the web panel, the release notes
  for (const module of ['engine/menus.js', 'engine/game.js', 'engine/unity/game.js', 'src/main.js', 'scripts/release-metadata.mjs', 'scripts/changelog-md.mjs'])
    assert.equal(reach('src/changelog.js', module), true, module + ' reads the lines');
  assert.equal(dependenciesOf('scripts/changelog-md.mjs', read('scripts/changelog-md.mjs')).unknown, false, 'its two outputs are read by name');
});

test('the controller-feel numbers follow the traveller, not the command line\'s tuning', () => {
  const consumer = 'tests/locomotion-botw.test.js';
  assert.deepEqual(selection('src/hud.js', consumer), [witness]);
  for (const path of ['scripts/motion-qc/feel-core.mjs', 'tests/gait-sim.js', 'src/locomotion.js', 'src/loco-moves.js', 'src/player.js', 'src/gait-course.js'])
    assert.ok(selection(path, consumer).includes(consumer), path);
  const cli = dependenciesOf('scripts/motion-qc/feel.mjs', read('scripts/motion-qc/feel.mjs'));
  assert.ok(cli.imports.includes('scripts/motion-qc/feel-core.mjs'), 'the command measures with the same core');
  assert.equal(cli.unknown, true, 'TUNE\'s chosen imports keep the command conservative');
});
