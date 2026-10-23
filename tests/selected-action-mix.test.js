import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioContext, setAudioDecoder } from '../engine/webaudio.js';
import { SampleBank } from '../src/sfx.js';
import { ACTION_SFX } from '../src/action-sfx.js';
import { TravellerVoice } from '../src/traveller-voice.js';
import { TempleAudio } from '../src/temples/sfx.js';
import { SelectedWorldAudio } from '../src/selected-world-audio.js';
import { Sound } from '../src/audio.js';
import { SfxTrace, recordedOrigin } from '../src/sfx-trace.js';

// Only the native decoder boundary is supplied here. Real approved PCM then
// travels through SampleBank and the production engine DSP, never a speaker.
function wav(data) {
 const b=Buffer.from(data);let at=12,pcm=null,rate=0,channels=0,bits=0;
 while(at+8<=b.length){const name=b.toString('ascii',at,at+4),n=b.readUInt32LE(at+4),p=at+8;
  if(name==='fmt '){assert.equal(b.readUInt16LE(p),1);channels=b.readUInt16LE(p+2);rate=b.readUInt32LE(p+4);bits=b.readUInt16LE(p+14);}
  if(name==='data')pcm=b.subarray(p,p+n);at=p+n+(n%2);
 }
 assert.equal(bits,16);assert.ok(pcm);const f=new Float32Array(pcm.length/2);
 for(let i=0;i<f.length;i++)f[i]=pcm.readInt16LE(i*2)/32768;
 return {numberOfChannels:channels,length:f.length/channels,sampleRate:rate,pcm:f.buffer};
}
async function setup(){
 setAudioDecoder(wav);const ctx=new AudioContext({sampleRate:44100}),master=ctx.createGain();master.connect(ctx.destination);
 const bank=new SampleBank(ctx,{base:'',table:ACTION_SFX,rand:()=>.5,fetcher:async name=>{const b=readFileSync(new URL('../public/sfx/'+name,import.meta.url));return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};}});
 await bank.preload(2);for(const g of Object.keys(ACTION_SFX))assert.equal(bank.state(g),'ready',g);
 return {ctx,master,bank,s:{ctx,bank,fx:master,voices:master,muted:false},close:async()=>{bank.dispose();await ctx.close();setAudioDecoder(null);}};
}
const signal=a=>a.some(x=>Math.abs(x)>1e-6);
const finite=a=>{assert.ok(a.every(Number.isFinite));assert.ok(Math.max(...a.map(Math.abs))<1);};
test('actual selected vocal PCM is finite, exclusive, and silent after pause and mute',async()=>{
 const f=await setup();try{
  const v=new TravellerVoice(f.s);assert.equal(v.play('vox-run',{priority:0}),true);
  let out=f.ctx.render(4096);finite(out);assert.ok(signal(out));
  assert.equal(v.play('vox-attack-heavy'),true);assert.equal(f.bank.active.size,1);
  out=f.ctx.render(4096);finite(out);assert.ok(signal(out));
  v.pause(true);assert.equal(f.bank.active.size,0);assert.ok(!signal(f.ctx.render(4096)));
  v.pause(false);f.s.muted=true;assert.equal(v.play('vox-mantle'),false);assert.ok(!signal(f.ctx.render(4096)));
  v.dispose();
 }finally{await f.close();}
});
test('actual sliding recordings resume at physical offset and stop on reversal/disposal',async()=>{
 const f=await setup();try{
  const a=new TempleAudio(f.s),p={rt:{},id:'door',k:0};assert.equal(a.door(p,true),true);
  let out=f.ctx.render(11025);finite(out);assert.ok(signal(out));p.k=.25/1.8;a.update(p);assert.equal(f.bank.played.length,1);
  a.pause(true);assert.ok(!signal(f.ctx.render(11025)));a.pause(false);a.update(p);
  assert.equal(f.bank.active.size,1);assert.ok(Math.abs(f.bank.played.at(-1).offset-.25)<1e-8);
  out=f.ctx.render(4096);finite(out);assert.ok(signal(out));
  assert.equal(a.door(p,false),true,'closing reuses the shared sliding recording');assert.equal(f.bank.active.size,1);
  assert.ok(Math.abs(f.bank.played.at(-1).offset-(1-p.k)*1.8)<1e-8);
  out=f.ctx.render(1024);finite(out);assert.ok(signal(out));a.dispose();
  assert.equal(f.bank.active.size,0);assert.ok(!signal(f.ctx.render(4096)));
 }finally{await f.close();}
});
test('approved loop PCM stays quiet, never doubles across updates, and stops immediately on exit',async()=>{
 const f=await setup();try{
  const world=new SelectedWorldAudio(f.s);
  for(let i=0;i<120;i++)world.update({rideKind:'bike',rideSpeed:30,house:{bed:i%2?'fire':'deep'}});
  assert.equal(f.bank.active.size,2);assert.equal(f.bank.played.length,2);
  const out=f.ctx.render(8192);finite(out);assert.ok(signal(out));
  const rms=Math.sqrt(out.reduce((n,x)=>n+x*x,0)/out.length);assert.ok(rms<.01,'restrained combined loop gain');
  world.update({});assert.equal(f.bank.active.size,0);assert.ok(!signal(f.ctx.render(4096)));
  world.update({house:{}});f.s.muted=true;world.update({house:{}});assert.ok(!signal(f.ctx.render(4096)));
  world.dispose();
 }finally{await f.close();}
});
test('actual chest and key recordings retain their long magical tails without synthetic layers',async()=>{
 const f=await setup();try{
  Sound.prototype.keyTurn.call(f.s);assert.equal(f.bank.active.size,1);
  f.ctx.render(44100);assert.ok(signal(f.ctx.render(8192)),'unlock still present after one second');
  f.ctx.render(44100*3);assert.ok(!signal(f.ctx.render(4096)), 'the completed unlock tail is silent');
  await Promise.resolve(); // Engine onended dispatch follows the render in a microtask.
  assert.equal(f.bank.active.size,0);
  Sound.prototype.boxOpen.call(f.s);f.ctx.render(44100*2);
  let music=0;f.s.musicCue=()=>music++;Sound.prototype.fanfare.call(f.s);
  assert.equal(music,1);assert.equal(f.bank.active.size,1,'only the chest ceremony, not another reveal recording');
  assert.ok(signal(f.ctx.render(8192)),'chest remains present after two seconds');
  f.s._templeAudio.dispose();assert.ok(!signal(f.ctx.render(4096)));
 }finally{await f.close();}
});
test('the game source trace identifies all five approved groups as recordings, including owned loops',async()=>{
 const f=await setup(),trace=new SfxTrace(f.s);try{
  trace.manifest=JSON.parse(readFileSync(new URL('../public/sfx/manifest.json',import.meta.url)));
  await trace.enable();const world=new SelectedWorldAudio(f.s);
  world.update({rideKind:'bike',rideSpeed:20,house:{}});
  Sound.prototype.keyTurn.call(f.s);Sound.prototype.boxOpen.call(f.s);Sound.prototype.hologramOn.call(f.s);
  trace.refresh();
  const rows=trace.recent;
  assert.equal(rows.length,5);assert.equal(rows.filter(e=>e.loop).length,2);
  assert.deepEqual(rows.map(e=>e.file).sort(),['chest-open-0.wav','hologram-crt-0.wav','hoverbike-glide-0.wav','key-unlock-0.wav','temple-ambience-0.wav'].sort());
  for(const row of rows)assert.equal(recordedOrigin(trace.manifest,row.file),'ElevenLabs');
  world.stop();f.s._templeAudio.dispose();f.s._nextActionAudio.dispose();trace.refresh();assert.equal(trace.active.size,0);
 }finally{trace.dispose();await f.close();}
});
