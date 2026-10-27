import { effectBytes } from '../scripts/sound-qc/test-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext, setAudioDecoder } from '../engine/webaudio.js';
import { SampleBank } from '../src/sfx.js';
import { ACTION_SFX } from '../src/action-sfx.js';
import { NextActionAudio } from '../src/next-action-audio.js';
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
 const bank=new SampleBank(ctx,{base:'',table:ACTION_SFX,rand:()=>.5,fetcher:async name=>{const b=effectBytes(name);return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};}});
 await bank.preload(2);for(const g of Object.keys(ACTION_SFX))assert.equal(bank.state(g),'ready',g);
 return {ctx,master,bank,s:{ctx,bank,fx:master,voices:master,muted:false,uiOut:()=>master},close:async()=>{bank.dispose();await ctx.close();setAudioDecoder(null);}};
}
const signal=a=>a.some(x=>Math.abs(x)>1e-6);
const finite=a=>{assert.ok(a.every(Number.isFinite));assert.ok(Math.max(...a.map(Math.abs))<1);};
test('all eight real NEXT recordings render finite PCM and world pause preserves UI-only cues',async()=>{
 const f=await setup();try{
  const a=new NextActionAudio(f.s);
  for(const group of ['blade-form','shield-bloom','fluid-refill','voicemail-ready','ship-confirm','small-pickup','discovery-reveal','low-fluid']){
   assert.equal(a.cue(group,{ui:group==='ship-confirm'||group==='discovery-reveal'}),true);
   const out=f.ctx.render(8192);finite(out);assert.ok(signal(out),group);assert.equal(f.bank.active.size,1);
   a.stop();assert.equal(f.bank.active.size,0);assert.ok(!signal(f.ctx.render(4096)));
  }
  f.s.uiOut=()=>f.master;f.s._actionPaused=true;
  a.cue('discovery-reveal',{ui:true,gap:0});a.stop(true);assert.equal(f.bank.active.size,1);
  assert.ok(signal(f.ctx.render(8192)));a.stop();assert.ok(!signal(f.ctx.render(4096)));
  f.s.muted=true;a.cue('ship-confirm',{ui:true,gap:0});assert.equal(f.bank.active.size,0);
 }finally{await f.close();}
});
