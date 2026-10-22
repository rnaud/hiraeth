import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioContext, setAudioDecoder } from '../engine/webaudio.js';
import { SampleBank } from '../src/sfx.js';
import { ACTION_SFX } from '../src/action-sfx.js';
import { TravellerVoice } from '../src/traveller-voice.js';
import { TempleAudio } from '../src/temples/sfx.js';

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
  assert.equal(a.door(p,false),false,'closing retains its existing synthesized cue');assert.equal(f.bank.active.size,0);
  assert.ok(!signal(f.ctx.render(4096)));a.dispose();
 }finally{await f.close();}
});
