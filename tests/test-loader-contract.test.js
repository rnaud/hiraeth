import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { affectedTests, dependenciesOf, gitSelection, repositorySyntax } from '../scripts/affected-tests.mjs';
import { join } from 'node:path';
import { tempDir, removeTemp } from '../scripts/temp-dirs.mjs';
import { boundedGameInputs, CONTRACT_FILE } from '../scripts/test-loader-contract.mjs';
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
// Repository inputs are frozen for this test process; mutation cases use explicit overlays.
const sources = new Map(), presence = new Map();
const read = f => { if (!sources.has(f)) sources.set(f, readFileSync(f, 'utf8')); return sources.get(f); };
const exists = f => { if (!presence.has(f)) presence.set(f, existsSync(f)); return presence.get(f); };
// Syntax of exact source bytes may come from the selector's own cache (warm after the hook's run); selections are recomputed.
const syntax = new Map(), analysisCache = new Map(), store = repositorySyntax();
const analyze = (f,text,o) => {
  const key=f+'\0'+!!o?.explain, old=syntax.get(key);
  if(old?.text===text)return old.value;
  const id=store?.key(f,text,!!o?.explain), value=(id&&store.get(id))||dependenciesOf(f,text,o);syntax.set(key,{text,value});return value;
};
const options = {read, exists, files, analyze};
const witness = 'tests/bounded-input-witness.test.js';
function selected(path, consumer, override={}) {
  return affectedTests([path], {files, tests:[consumer,witness], modifiedRegularOnly:true, analysisCache, syntax:store,
    exists:f=>f===witness||exists(f), read:f=>f===witness?`import '../${path}';`:read(f), ...override});
}
test('bounded engine inputs include the real source closure and both asset roots', () => {
  const d = boundedGameInputs(options);
  assert.ok(d); assert.equal(d.unknown, false);
  for(const p of ['engine/game.js','src/player.js','src/hud-state.js','src/levels/desert.js','public','data',CONTRACT_FILE]) assert.ok(d.resources.includes(p),p);
});
test('whole-game tests exclude unrelated tooling/docs but retain behavior, assets and adapter changes', () => {
  for(const consumer of ['tests/sequences-opening.test.js','tests/engine-finishable.test.js','tests/engine-combat.test.js']) {
    for(const path of ['docs/systems/ui.md','scripts/playthrough-browser.mjs','scripts/release-info.mjs','src/hud-view.js']) assert.deepEqual(selected(path,consumer),[witness],consumer+' excludes '+path);
    for(const path of ['src/player.js','src/hud-state.js','src/levels/desert.js','public/guardians/keeper-v1/model.glb','data/new-model.glb','engine/vm-run.mjs']) assert.ok(selected(path,consumer).includes(consumer),consumer+' retains '+path);
  }
});
test('stale, missing and malformed contracts fail closed; unknown new entry dependencies remain unknown', () => {
  for(const path of ['engine/game-test-runtime.mjs','engine/vm-run.mjs','scripts/engine-bundle-core.mjs','engine/boot.js','engine/platform.js']) {
    const changed=f=>read(f)+(f===path?'\n// changed\n':'');
    assert.equal(boundedGameInputs({...options,read:changed}),null,path);
    assert.ok(selected('docs/systems/ui.md','tests/engine-finishable.test.js',{read:f=>f===witness?"import '../docs/systems/ui.md';":changed(f)}).includes('tests/engine-finishable.test.js'));
  }
  for(const content of ['', '{}', '{"version":2}']) assert.equal(boundedGameInputs({...options,read:f=>f===CONTRACT_FILE?content:read(f)}),null);
  const d = boundedGameInputs({...options,read:f=>read(f)+(f==='engine/game.js'?"\nimport(someUnknownPath);":'')});
  assert.equal(d.unknown,true,'new unresolved entry inputs cannot be silently omitted');
  const e = boundedGameInputs({...options,read:f=>read(f)+(f==='engine/game.js'?"\nimport './missing-test-input.js';":'')});
  assert.equal(e.unknown,true,'missing imports still fail closed');
});
test('the sequence-pattern alias avoids filesystem-name ambiguity; local IO wrappers remain conservative', () => {
  assert.equal(dependenciesOf('tests/x.js',"import {glob as sequencePattern} from '../engine/sequences.js'; sequencePattern(pattern).test(name);").unknown,false);
  assert.equal(dependenciesOf('tests/x.js',"import {glob} from 'node:fs'; glob(pattern);").unknown,true);
  assert.equal(dependenciesOf('tests/x.js',"glob(pattern);").unknown,true);
  assert.equal(dependenciesOf('tests/x.js',"import {readFileSync} from './fs-wrapper.js'; readFileSync(path);").unknown,true, 'a local import may re-export filesystem IO');
  assert.equal(dependenciesOf('tests/x.js',"import {glob} from '../engine/sequences.js'; function f(glob) { glob(pattern); }").unknown,true);
});


test('Git contracts use committed/index bytes; removed imports and stale helpers remain conservative across snapshots', () => {
  const root=tempDir('hiraeth-loader-snapshots-');
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('GIT_')));
  const git=(...args)=>execFileSync('git',args,{cwd:root,env,encoding:'utf8'}).trim();
  const put=(p,t)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),t);};
  const commit=()=>{git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};
  try {
    git('init','-q');git('config','user.name','Loader fixture');git('config','user.email','fixture@example.invalid');git('config','core.hooksPath','/dev/null');
    const contract=JSON.parse(read(CONTRACT_FILE));
    put(CONTRACT_FILE,JSON.stringify(contract));
    for(const p of Object.keys(contract.fingerprints))put(p,read(p));
    put('engine/game.js',"import '../src/used.js';");put('src/used.js','export const value=1;');
    put('docs/note.md','before');
    put('tests/game.test.js',"import '../engine/game-test-runtime.mjs';");
    put('tests/docs.test.js',"readFileSync('docs/note.md');");
    const base=commit();put('docs/note.md','after');git('add','docs/note.md');
    // Working files cannot invalidate a valid committed/index contract.
    put(CONTRACT_FILE,'{}');put('engine/vm-run.mjs','invalid working copy');
    assert.deepEqual(gitSelection({root,staged:true}),['tests/docs.test.js']);
    put(CONTRACT_FILE,JSON.stringify(contract));put('engine/vm-run.mjs',read('engine/vm-run.mjs'));
    const head=commit();assert.deepEqual(gitSelection({root,base,head}),['tests/docs.test.js']);
    // A modified helper invalidates the new snapshot even though the adapter is unchanged.
    put('engine/vm-run.mjs',read('engine/vm-run.mjs')+'\n// stale');const stale=commit();
    put('docs/note.md','third');const after=commit();
    assert.deepEqual(gitSelection({root,base:stale,head:after}),['tests/docs.test.js','tests/game.test.js']);
    // Dropping a real import cannot hide the consumer from the old graph.
    put('engine/vm-run.mjs',read('engine/vm-run.mjs'));const restored=commit();
    put('engine/game.js','export const value=0;');put('src/used.js','export const value=2;');const removed=commit();
    assert.ok(gitSelection({root,base:restored,head:removed}).includes('tests/game.test.js'));
  } finally {removeTemp(root);}
});
