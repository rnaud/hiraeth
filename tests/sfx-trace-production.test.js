import test from 'node:test';
import assert from 'node:assert/strict';
import { installAudio } from '../engine/webaudio.js';
const G=globalThis;
G.window??=G; G.addEventListener??=()=>{}; G.removeEventListener??=()=>{};
installAudio(G,{sampleRate:8000});
const {Sound}=await import('../src/audio.js');

test('unavailable assigned recordings stay silent while intentional procedural effort remains traceable',async()=>{
 const s=new Sound('desert',{autoStart:false,score:false,muted:false});
 try {
  await s.sfxTrace.enable(); s.start();
  clearTimeout(s._preload); s.bank.dispose(); s.bank=null;
  s.shieldOpen(); s.sfxTrace.refresh();
  assert.equal(s.sfxTrace.recent.length,0,'missing assigned shield recording must not emit a procedural substitute');
  s.grunt('effort',1,0); s.ctx.render(160); s.sfxTrace.refresh();
  assert.ok(s.sfxTrace.recent.some(e=>e.name==='grunt'));
  const n=s.sfxTrace.recent.length;
  s.muted=true; s.master.gain.value=0; s.fluidWindup(0); s.sfxTrace.refresh();
  assert.equal(s.sfxTrace.recent.length,n);
 }finally{s.dispose();}
});


test('an instrument routed to effects is a sound, while its music-bus counterpart is excluded',async()=>{
 const s=new Sound('desert',{autoStart:false,score:false,muted:false});
 try {
  s.start(); clearTimeout(s._preload); await s.sfxTrace.enable();
  s.instrument('bell',220,s.ctx.currentTime+.05,.2,.1,s.fx);
  s.instrument('bell',220,s.ctx.currentTime+.05,.2,.1,s.music);
  s.ctx.render(800); s.sfxTrace.refresh();
  assert.equal(s.sfxTrace.recent.length,1); assert.equal(s.sfxTrace.recent[0].name,'bell note');
 }finally{s.dispose();}
});


test('unavailable assigned ship loops never create a procedural substitute',async()=>{
 const {engines}=await import('../src/ship/sfx.js');
 const s=new Sound('desert',{autoStart:false,score:false,muted:false});
 try {
  s.start();clearTimeout(s._preload);s.bank.dispose();s.bank=null;await s.sfxTrace.enable();
  engines(s,.7,.5);s.ctx.render(4000);s.sfxTrace.refresh();
  const ship=()=>[...s.sfxTrace.active.values()].filter(e=>e.name==='Ship engines');
  assert.equal(ship().length,0);assert.equal(s.sfxTrace.recent.length,0);
  engines(s,0,0);s.ctx.render(s.ctx.sampleRate*4);s.sfxTrace.refresh();assert.equal(ship().length,0);
 }finally{s.dispose();}
});


test('the real engine developer toggle is safe when the host has no audio system', async () => {
 const {bundle}=await import('../engine/game-test-runtime.mjs');
 const {loadBundle}=await import('../engine/game-test-runtime.mjs');
 const {tempPath}=await import('../scripts/temp-dirs.mjs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const file=tempPath(join(tmpdir(), `hiraeth-trace-no-audio-${process.pid}.js`));
 await bundle('godot',{input:'engine/game.js',out:[file]});
 const E=loadBundle(file).exports;
 const menus={open:false,mode:null,openDev(){return true;},changed(){},action(){},navigate(){},show(){},openShop(){return true;}};
 const backend={geometry(){},material(){},create(){},visible(){},remove(){},camera(){},frame(){},instances(){},transforms(){}};
 const g=await E.createGame({levelId:'garage',backend,menus,audio:null});
 try {
  assert.ok(g.devMenu, 'real developer menu exists without an audio context');
  assert.doesNotThrow(()=>g.devMenu.act({do:'toggle',key:'soundSources'}));
  assert.doesNotThrow(()=>g.devMenu.act({do:'toggle',key:'soundSources'}));
  assert.equal(g.screen().state.sfxTrace,undefined,'no synthetic trace is created');
 }finally{g.dispose?.();}
});
