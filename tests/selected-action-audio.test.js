import { effectBytes } from '../scripts/sound-qc/test-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { TravellerVoice } from '../src/traveller-voice.js';
import { TempleAudio } from '../src/temples/sfx.js';
import { Door } from '../src/temples/pieces.js';
import { Sound } from '../src/audio.js';
import { ACTION_SFX } from '../src/action-sfx.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function fixture() {
  const calls=[], voices=new Set(); let ready=true;
  const s={ctx:{currentTime:0},fx:{},voices:{},muted:false,bank:{
    state:()=>ready?'ready':'loading',load:()=>{},
    start(group,opt){ if(!ready)return null;const h={duration:group==='vox-run'?6:group==='temple-slide-open'?1.8:.7,stop(){voices.delete(h);}};calls.push({group,opt,h});voices.add(h);return h;},
  }};
  return {s,calls,voices,ready:v=>ready=v,tick:t=>{s.ctx.currentTime+=t;}};
}
test('selected traveller voice is exclusive, including action interrupts and mute/pause',()=>{
 const f=fixture(),v=new TravellerVoice(f.s);
 assert.equal(v.play('vox-run',{priority:0}),true);
 assert.equal(v.play('vox-attack-heavy'),true);assert.equal(f.voices.size,1);
 assert.equal(v.play('vox-jump-running'),false);assert.equal(f.calls.length,2);
 v.pause(true);assert.equal(f.voices.size,0);assert.equal(v.play('vox-land-soft'),false);
 v.pause(false);f.tick(2);assert.equal(v.play('vox-mantle'),true);
 f.s.muted=true;v.body({vel:{x:10,y:0,z:0},onGround:true},.1);assert.equal(f.voices.size,0);
 v.dispose();f.s.muted=false;assert.equal(v.play('vox-run'),false);
});
test('loading voices fall back once but a suppressed ready voice never asks for layered fallback',()=>{
 const f=fixture(),v=new TravellerVoice(f.s);f.ready(false);
 assert.equal(v.play('vox-attack-light'),null);assert.equal(v.reserve(.3),true);
 f.ready(true);assert.equal(v.play('vox-attack-heavy'),false);f.tick(.4);
 assert.equal(v.play('vox-attack-heavy'),true);
 assert.equal(v.play('effort'),false);
});
test('running breath needs sustained actual running and recovery is once after deceleration',()=>{
 const f=fixture(),v=new TravellerVoice(f.s),p={vel:{x:0,y:0,z:0},onGround:true};
 const move=(speed,n)=>{p.vel.x=speed;for(let i=0;i<n;i++){f.tick(.1);v.body(p,.1);}};
 move(0,300);move(4,300);assert.equal(f.calls.length,0);
 move(10,62);assert.deepEqual(f.calls.map(c=>c.group),['vox-run']);assert.equal(f.calls[0].opt.loop,undefined);
 move(6,1);move(0,2);assert.deepEqual(f.calls.map(c=>c.group),['vox-run','vox-recover']);
 move(0,300);assert.equal(f.calls.length,2);
 move(10,62);v.pause(true);v.pause(false);move(0,30);assert.equal(f.calls.filter(c=>c.group==='vox-recover').length,1,'menu exit is not sprint recovery');
});
test('selected attack/jump/mantle calls preserve separate body foley without adding generic vocals',()=>{
 const f=fixture(),s=f.s;s._travellerVoice=new TravellerVoice(s);
 Object.assign(s,{assignedEffect:Sound.prototype.assignedEffect,actionVocal:Sound.prototype.actionVocal,step(){},sample(){return true;},vocal(){throw Error('unexpected generic layer');},vary:()=>1,swish(){},sweep(){},burst(){},rand:()=>0,effort(){throw Error('generic effort layered');}});
 Sound.prototype.fluidSlash.call(s,0);assert.equal(f.calls[0].group,'vox-attack-light');
 s._travellerVoice.stop();f.tick(2);s._travellerVoice.speed=7;
 Sound.prototype.jump.call(s,{breath:true});assert.equal(f.calls.at(-1).group,'vox-jump-running');
 s._travellerVoice.stop();f.tick(2);Sound.prototype.mantle.call(s,{breath:true});assert.equal(f.calls.at(-1).group,'vox-mantle');
});
test('real Door transitions share one twin-leaf cue; blocked and instant changes stay silent',()=>{
 const f=fixture(),a=new TempleAudio(f.s);let fallback=0;
 const rt={sound:{templeDoor:(...args)=>a.door(...args),doorOpen:()=>fallback++}};
 const make=()=>({rt,id:'same',open:false,k:0,inDoorway:()=>false,apply(){}});
 const p=make(),twin=make();Door.prototype.setOpen.call(p,true);Door.prototype.setOpen.call(twin,true);
 assert.equal(f.calls.length,1);assert.equal(fallback,0);
 Door.prototype.setOpen.call(p,true);assert.equal(f.calls.length,1);
 p.inDoorway=()=>true;Door.prototype.setOpen.call(p,false);assert.equal(p.wantShut,true);assert.equal(fallback,0);
 p.inDoorway=()=>false;Door.prototype.setOpen.call(p,false);Door.prototype.setOpen.call(twin,false);
 assert.equal(fallback,0,'closing reuses the shared sliding recording');assert.equal(f.voices.size,1);
 assert.equal(f.calls.at(-1).group,'temple-slide-open');
 Door.prototype.setOpen.call(p,true,true);assert.equal(f.calls.length,2);assert.equal(f.voices.size,0);assert.equal(p.k,1);
});
test('sliding cue pause/resume and stalled frame follow physical progress, not a second full playback',()=>{
 const f=fixture(),a=new TempleAudio(f.s),p={rt:{},id:'d',k:0};
 a.door(p,true);p.k=.25;f.tick(.45);a.update(p);assert.equal(f.calls.length,1);
 a.pause(true);assert.equal(f.voices.size,0);f.tick(3);a.pause(false);a.update(p);
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].opt.offset,.45);
 f.tick(1);p.k=.3;a.update(p);assert.equal(f.calls.length,3);assert.equal(f.voices.size,1);
 assert.ok(Math.abs(f.calls.at(-1).opt.offset-.54)<1e-8);
 p.k=1;a.update(p);assert.equal(f.voices.size,0);a.release(p.rt);
});
test('unavailable assigned door audio stays silent and never replays after decode; locked proximity is edge-triggered',()=>{
 const f=fixture(),a=new TempleAudio(f.s),p={rt:{},id:'d',k:0};f.ready(false);
 assert.equal(a.door(p,true),true);f.ready(true);p.k=.4;a.update(p);assert.equal(f.calls.length,0);
 let count=0,near=true;
 const door={id:'keyed',open:false,lock:'small',keyholes:[],inDoorway:()=>near,rt:{player:{pos:{}},logic:{unlocked:()=>false,canUnlock:()=>false,keysIn:()=>0},sound:{templeLocked:()=>count++},notice(){}}};
 for(let i=0;i<120;i++)Door.prototype.updateLock.call(door,1/60);
 assert.equal(count,1);near=false;Door.prototype.updateLock.call(door,.1);near=true;Door.prototype.updateLock.call(door,.1);assert.equal(count,2);
});
test('all and only starred masters have finite runtime derivatives and common action group names',()=>{
 const source=JSON.parse(readFileSync(new URL('../references/audio/elevenlabs-actions-2026-10-21/manifest.json',import.meta.url)));
 const runtime=JSON.parse(readFileSync(new URL('../public/sfx/manifest.json',import.meta.url)));
 assert.equal(source.sources.length,18);assert.equal(source.sources.filter(x=>x.group.startsWith('vox-')).length,10);
 for(const x of source.sources){
  assert.ok(ACTION_SFX[x.group]);assert.ok(!/rose|footprint|casting|aerie/i.test(x.group));
  const meta=runtime.files[`${x.group}-${x.index}`],bytes=effectBytes(`${x.group}-${x.index}.wav`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);assert.equal(meta.sourceSha256,x.sha256);
  assert.ok(Number.isFinite(meta.rmsDbfs)&&meta.peakDbfs<=-3.99);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),44100);
  if(x.group==='temple-slide-open')assert.equal(meta.duration,1.8);
 }
 assert.equal(ACTION_SFX['temple-slide-close'],undefined);assert.ok(ACTION_SFX['key-unlock']);
});

// A dialogue can begin while a running phrase is active. Temple/chest audio
// remains available, but an action voice cannot leak over the conversation.
test('host voice hold cancels body vocals without silencing an actual treasure reveal',()=>{
 const f=fixture();f.s._travellerVoice=new TravellerVoice(f.s);f.s._templeAudio=new TempleAudio(f.s);
 f.s._travellerVoice.play('vox-run',{priority:0});
 Sound.prototype.pauseActionAudio.call(f.s,false,true);assert.equal(f.voices.size,0);
 assert.equal(f.s._travellerVoice.play('vox-jump-standing'),false);
 assert.equal(f.s._templeAudio.cue('treasure-reveal'),true);
 f.s._templeAudio.cue('quest-important');assert.equal(f.calls.length,2,'one reward cue for chest plus quest completion');
 Sound.prototype.pauseActionAudio.call(f.s,false,false);f.tick(2);
 assert.equal(f.s._travellerVoice.play('vox-jump-standing'),true);
 const fresh=fixture();fresh.s._voiceHeld=true;assert.equal(new TravellerVoice(fresh.s).play('vox-mantle'),false);
});

test('selected treasure retains the score response and legacy voices retain positional panning',()=>{
 const f=fixture(),music=[];f.s.musicCue=(...args)=>music.push(args);
 Sound.prototype.fanfare.call(f.s);
 assert.deepEqual(music,[['moment',{delay:2.5}]]);
 assert.equal(f.calls[0].group,'treasure-reveal');
 const pos={x:3,y:1,z:4};f.s._ear={};f.s.placeAt=(p,reach)=>{assert.equal(p,pos);assert.equal(reach,60);return {gain:.1,pan:-.6};};
 assert.equal(Sound.prototype.vocal.call(f.s,'hurt',{pos,vol:.8}),true);
 assert.equal(f.calls.at(-1).opt.pan,-.3);assert.equal(f.calls.at(-1).opt.vol,.2);
 assert.equal(f.calls.at(-1).opt.dest,f.s.voices);
});

test('a slowed legacy voice is stopped before a selected voice after the nominal deadline',()=>{
 const f=fixture(),v=new TravellerVoice(f.s);
 assert.equal(v.play('hurt'),true);
 const legacy=f.calls[0].h;
 // The fixture retains the actual active handle beyond its raw buffer duration,
 // as a pitch-lowered legacy take does. A nominal timer is not an ended signal.
 f.tick(.8);assert.equal(f.voices.has(legacy),true);
 assert.equal(v.play('vox-jump-standing'),true);
 assert.equal(f.voices.has(legacy),false);assert.equal(f.voices.size,1);
});


test('a missing action fallback stops a slowed legacy voice before reserving a synthesized grunt',()=>{
 const f=fixture(),v=new TravellerVoice(f.s);
 assert.equal(v.play('hurt'),true);
 const legacy=f.calls[0].h;
 assert.equal(v.reserve(.3),false);assert.equal(f.voices.has(legacy),true,'an occupied lane is not interrupted by fallback');
 f.tick(.8);f.ready(false);
 assert.equal(v.play('vox-attack-heavy'),null,'unavailable selected take requests the fallback');
 assert.equal(f.voices.has(legacy),true,'the lowered legacy take outlasts its nominal timer');
 assert.equal(v.reserve(.3),true);assert.equal(f.voices.size,0,'stop the recording before synthesized fallback starts');
 const gainCalls=[];v.bindSynth({gain:{cancelScheduledValues:t=>gainCalls.push(['cancel',t]),setValueAtTime:(value,t)=>gainCalls.push(['set',value,t])}});
 v.pause(true);assert.deepEqual(gainCalls,[['cancel',.8],['set',0,.8]],'pause also stops the reserved fallback');
});
