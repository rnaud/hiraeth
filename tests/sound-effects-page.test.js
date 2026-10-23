import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const G=globalThis;
G.window??=G; G.addEventListener??=()=>{}; G.removeEventListener??=()=>{};
const cat=await import('../src/sound-effects-page/catalog.js');
const { EFFECTS }=await import('../src/music-page/catalog.js');
const { SFX }=await import('../src/sfx.js');
const { EffectPreview }=await import('../src/sound-effects-page/preview.js');
const manifest=JSON.parse(readFileSync(new URL('../public/sfx/manifest.json',import.meta.url),'utf8'));
const action=id=>cat.INVENTORY.find(e=>e.id===id);

test('effects inventory preserves the shared catalogue without counting variants as actions',()=>{
 const ids=cat.INVENTORY.map(e=>e.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const e of EFFECTS)assert.equal(ids.includes(e.id),!cat.EXCLUDED_GROUPS.has(e.group),e.id);
 for(const g of Object.keys(SFX))assert.ok(ids.includes('sample:'+g),g);
 const n=cat.inventoryCounts(manifest);
 assert.equal(n.actions,cat.ACTIONS.length);
 assert.equal(n.characterEfforts,10);
 assert.equal(n.variants,cat.ACTIONS.reduce((sum,e)=>sum+e.variants.length,0));
 for(const e of cat.INVENTORY)for(let i=0;i<e.variants.length;i++){
  const info=cat.sourceInfo(e,i,manifest);
  for(const group of info.groups)assert.ok(SFX[group],e.id+': '+group);
  assert.ok(!info.context&&!info.unclassified,e.id+' needs an explicit reviewed routing classification');
 }
});

test('delegated minigame factories have every public cue represented',()=>{
 for(const [id,make] of cat.DELEGATED_FACTORIES)for(const name of Object.keys(make(null)))
  assert.ok(action(id+':'+name),id+':'+name);
 assert.ok(action('canyon:motor'));
 for(const e of cat.INVENTORY.filter(e=>e.id.startsWith('pirates:')||e.id.startsWith('ship:')||e.id.startsWith('layer:')))
  for(let i=0;i<e.variants.length;i++)assert.ok(!cat.routeFor(e,i).unclassified,e.id);
 assert.deepEqual(cat.routeFor(action('pirates:engine'),0).groups,['ship-thrust']);
 assert.ok(cat.routeFor({id:'pirates:newCue',variants:[['Play',()=>{}]]}).unclassified);
 assert.ok(cat.routeFor({id:'layer:newBed',variants:[['Play',()=>{}]]}).unclassified);
});

test('variant source labels describe the callback, not every possible gameplay branch',()=>{
 assert.deepEqual(cat.routeFor(action('jump'),0).groups,['step-sand','belt','vox-jump-standing']);
 assert.deepEqual(cat.routeFor(action('getUp'),0).groups,['cloth','belt']);
 assert.deepEqual(cat.routeFor(action('getUp'),1).groups,['cloth','belt','sigh']);
 assert.equal(cat.sourceInfo(action('land'),0,manifest).mixed,false);
 assert.equal(cat.sourceInfo(action('land'),1,manifest).mixed,true);
 assert.deepEqual(cat.routeFor(action('land'),1).groups,['step-sand','vox-land-heavy','land','cloth']);
 assert.deepEqual(cat.routeFor(action('land'),2).groups,['step-sand','vox-land-heavy','land-heavy','cloth']);
 assert.equal(cat.sourceInfo(action('fluidSlashHit'),0,manifest).silent,true);
 assert.equal(cat.sourceInfo(action('fluidShoot'),1,manifest).badge,'Procedural');
 assert.equal(cat.sourceInfo(action('fluidBlock'),1,manifest).mixed,false);
 assert.match(cat.sourceInfo(action('fluidSlash'),0,manifest).display,/Recorded.*procedural layers/);
 assert.equal(cat.sourceInfo(action('step'),0,null).badge,'Unknown recording');
});

test('sliding door previews exercise both physical directions with the selected shared bank',()=>{
 const e=action('templeDoor');assert.deepEqual(e.variants.map(v=>v[0]),['Open','Close']);
 for(const [i,open] of [true,false].entries()){
  const calls=[];let phase=.5;
  const sound={templeDoor:(piece,direction)=>calls.push({kind:'start',k:piece.k,direction}),templeDoorUpdate:piece=>calls.push({kind:'update',k:piece.k})};
  e.variants[i][1](sound,{phase:()=>phase,hold:(seconds,tick,end)=>{assert.equal(seconds,1.8);tick();end();}});
  assert.deepEqual(calls,[{kind:'start',k:open?0:1,direction:open},{kind:'update',k:.5},{kind:'update',k:open?1:0}]);
  assert.deepEqual(cat.routeFor(e,i).groups,['temple-slide-open']);
 }
 assert.ok(cat.filterInventory(cat.INVENTORY,{source:'Silent variant'},manifest).some(e=>e.id==='fluidSlashHit'));
});

test('source coverage counts every gameplay variant once and excludes raw bank cards',()=>{
 const n=cat.inventoryCounts(manifest);
 assert.equal(Object.values(n.coverage).reduce((a,b)=>a+b,0),n.variants);
 const sampleEntries=[
  {id:'one',route:{groups:['blade-light'],mixed:false},variants:[['Play',()=>{}]]},
  {id:'two',route:{groups:['blade-light','cloth'],mixed:false},variants:[['Play',()=>{}]]},
  {id:'three',route:{groups:['blade-light'],mixed:true},variants:[['Play',()=>{}]]},
  {id:'four',route:{groups:[],mixed:false},variants:[['Play',()=>{}]]},
  {id:'five',route:{groups:[],mixed:false,silent:true},variants:[['Play',()=>{}]]},
 ];
 const m={files:Object.fromEntries(cat.filesFor(['blade-light','cloth']).map(f=>[f.replace(/\.(mp3|wav)$/,''),{from:f.startsWith('blade-light')?'ElevenLabs':'Foley source'}]))};
 const bins=cat.variantCoverage(m,sampleEntries);
 assert.equal(bins['Recorded — ElevenLabs'],1);
 assert.equal(bins['Recorded — ElevenLabs + other'],1);
 assert.equal(bins['Mixed — recording + procedural'],1);
 assert.equal(bins.Procedural,1);
 assert.equal(bins['Silent variant'],1);
 assert.equal(Object.values(bins).reduce((a,b)=>a+b,0),5);
});

test('source filters retain matching actions and expose only matching variants',()=>{
 const result=cat.filterInventory(cat.INVENTORY,{query:'shield',source:'Procedural'},manifest);
 assert.ok(result.some(e=>e.id==='shield'));
 const e=action('shield');
 assert.equal(cat.matchesSource(e,0,'Procedural',manifest),false);
 assert.equal(cat.matchesSource(e,1,'Procedural',manifest),true);
 assert.deepEqual(cat.filterInventory(cat.INVENTORY,{query:'no-such-effect-621'},manifest),[]);
});

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture({ready,load,traceReady,failed=false}={}){
 const events=[],players=[];
 const trace={serial:0,active:new Map(),recent:[],enable:async(on,options)=>{trace.enableOptions=options;await traceReady;},refresh(){},run(name,fn){fn();}};
 const sound={sfxTrace:trace,bank:{load:()=>load??Promise.resolve(!failed),state:()=>failed?'failed':'ready'}};
 const preview=new EffectPreview({muted:true,manifest,changed:e=>events.push(e),makePlayer:options=>{
  const p={options,disposed:0,calls:0,readyCalls:0,
   prepareEffects(o){this.prepareOptions=o;return load??(failed?Promise.reject(Error('Recording could not load: blade-light-0.wav')):Promise.resolve());},
   ready(){this.readyCalls++;return ready??Promise.resolve(sound);},
   async preparePreview({current,...options}){await this.prepareEffects(options);if(this.disposed||!current())return null;const s=await this.ready();return this.disposed||!current()?null:s;},
   play(fn){this.calls++;fn(sound);},dispose(){this.disposed++;}};
  players.push(p);return p;
 }});
 return {preview,players,events,sound};
}
const entry={id:'test',name:'Test cue',previewGroups:['blade-light'],variants:[['Play',()=>{}]]};
test('Stop during ready or decoding prevents late playback and disposes its owner',async()=>{
 for(const phase of ['ready','load']){
  const wait=deferred(),f=fixture({[phase]:wait.promise});
  const pending=f.preview.play(entry,0);
  await Promise.resolve();await Promise.resolve();
  f.preview.stop();wait.resolve(phase==='ready'?f.sound:true);await pending;
  assert.equal(f.players[0].calls,0,phase);
  assert.equal(f.players[0].disposed,1,phase);
  assert.equal(f.players[0].options.muted,true,'constructor review mute');
 }
});
test('rapid switching cannot revive the previous ready request',async()=>{
 const wait=deferred(),f=fixture({ready:wait.promise});
 const first=f.preview.play(entry,0),second=f.preview.play(entry,0);
 wait.resolve(f.sound);await Promise.all([first,second]);
 assert.equal(f.players[0].calls,0);assert.equal(f.players[1].calls,1);
 f.preview.stop();assert.equal(f.players[1].disposed,1);
});
test('missing assigned recording is a visible error, never a substitute preview',async()=>{
 const f=fixture({failed:true});await f.preview.play(entry,0);
 assert.equal(f.players[0].calls,0);
 assert.equal(f.players[0].readyCalls,0,'failed preparation never activates output');
 assert.equal(f.events.at(-1).state,'error');
 assert.match(f.events.at(-1).text,/Recording could not load/);
});
test('explicit retry is passed to shared preparation, not a page-owned decoder',async()=>{
 const f=fixture();await f.preview.play(entry,0,{retry:true});
 assert.equal(f.players[0].prepareOptions.retry,true);
 assert.equal(typeof f.players[0].prepareOptions.onProgress,'function');
 f.preview.stop();
});
test('site wiring stops on away events without writing gameplay preferences',()=>{
 const main=readFileSync(new URL('../src/sound-effects-page/main.js',import.meta.url),'utf8');
 assert.match(main,/visibilitychange/);assert.match(main,/pagehide/);assert.match(main,/'blur'/);
 assert.doesNotMatch(main,/localStorage\.setItem|progress\.save|\.muted\s*=/);
 assert.doesNotMatch(main,/Wait for recordings/);
});

// A supplied null manifest deliberately means unknown; it must not trigger a second fetch.
test('preview reuses provenance without enabling a game HUD',async()=>{
 for(const supplied of [manifest,null]){
  const f=fixture();f.preview.manifest=supplied;await f.preview.play(entry,0);
  assert.equal(f.sound.sfxTrace.enableOptions.manifest,supplied);
  assert.equal(f.sound.sfxTrace.enableOptions.hud,false);
  assert.equal(f.players[0].calls,1);f.preview.stop();
 }
});
test('Stop during tracing initialization cannot later play or start its refresh timer',async()=>{
 const wait=deferred(),f=fixture({traceReady:wait.promise});
 const pending=f.preview.play(entry,0);
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.ok(f.sound.sfxTrace.enableOptions,'tracing initialization reached');
 f.preview.stop();const count=f.events.length;wait.resolve();await pending;
 assert.equal(f.players[0].calls,0);assert.equal(f.players[0].disposed,1);
 assert.equal(f.events.length,count);assert.equal(f.preview.timer,undefined);
});
