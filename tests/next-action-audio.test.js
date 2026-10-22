import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NextActionAudio } from '../src/next-action-audio.js';
import { Sound } from '../src/audio.js';
import { ring, beep } from '../src/ship/sfx.js';
import { ACTION_SFX } from '../src/action-sfx.js';
function fixture() {
 const calls=[], active=new Set(); let ready=true;
 const s={ctx:{currentTime:0},fx:{},muted:false,uiOut:()=>({ui:true}),bank:{start(group,opts){if(!ready)return null;const h={stop(){active.delete(h);}};active.add(h);calls.push({group,opts});return h;}},nextAction:Sound.prototype.nextAction};
 return {s,calls,active,ready:v=>ready=v,tick:n=>s.ctx.currentTime+=n};
}
test('selected cues coalesce, interrupt their own tail, stop on host pause and never replay after decode',()=>{
 const f=fixture(),a=new NextActionAudio(f.s);f.s._nextActionAudio=a;
 a.cue('fluid-refill',{gap:2.4});a.cue('fluid-refill',{gap:2.4});assert.equal(f.calls.length,1);
 f.tick(3);a.cue('fluid-refill');assert.equal(f.active.size,1);
 Sound.prototype.pauseActionAudio.call(f.s,true);assert.equal(f.active.size,0);
 a.cue('shield-bloom');assert.equal(f.calls.length,2);
 Sound.prototype.pauseActionAudio.call(f.s,false);assert.equal(f.calls.length,2);
 f.ready(false);assert.equal(a.cue('small-pickup'),false);f.ready(true);assert.equal(a.cue('small-pickup'),true);assert.equal(f.calls.length,2);
 f.tick(1);a.cue('small-pickup');assert.equal(f.active.size,1);a.dispose();assert.equal(f.active.size,0);
 f.s._disposed=true;a.cue('small-pickup');assert.equal(f.calls.length,3);
});
test('low fluid only announces real downward crossing and rearms after meaningful refill',()=>{
 const f=fixture(),a=new NextActionAudio(f.s);
 a.level(0,false);a.level(.1);a.level(.2);assert.equal(f.calls.length,0,'initial dry/restored low tank quiet');
 a.level(1);a.level(.26);a.level(.24);assert.equal(f.calls.length,1);
 for(let i=0;i<100;i++){a.level(.26);a.level(.24);}assert.equal(f.calls.length,1,'tiny recovery oscillations do not rearm');
 f.tick(4);a.level(.6);a.level(.2);assert.equal(f.calls.length,2);
 a.level(.1,false);a.level(.1);assert.equal(f.calls.length,2,'menu/tool reentry quiet');
});
test('map cues work on paused UI bus, while muted and away reviews remain silent',()=>{
 const f=fixture(),a=new NextActionAudio(f.s);f.s._actionPaused=true;
 a.cue('discovery-reveal',{ui:true});assert.equal(f.calls[0].opts.dest.ui,true);
 a.cue('shield-bloom');assert.equal(f.calls.length,1);
 f.s.muted=true;a.cue('ship-confirm',{ui:true});assert.equal(f.calls.length,1);
 f.s.muted=false;f.s.guard={away:()=>true};a.cue('ship-confirm',{ui:true});assert.equal(f.calls.length,1);
});
test('opening voicemail announces once and only accepted high ship control uses new confirmation',()=>{
 const f=fixture();f.s.sweep=()=>{};
 ring(f.s);f.tick(8);ring(f.s);assert.deepEqual(f.calls.map(x=>x.group),['voicemail-ready']);
 f.tick(8);ring(f.s,'call2');assert.equal(f.calls.length,2);
 beep(f.s,false);assert.equal(f.calls.length,2);beep(f.s,true);assert.equal(f.calls.at(-1).group,'ship-confirm');
});
test('ordinary pickup, shield and refill replace old layers; new-colour celebration remains',()=>{
 const f=fixture();Object.assign(f.s,{vary:()=>1,freq:()=>440,pluck(){},sweep(){},burst(){},sample(){throw Error('legacy pickup layered');}});
 Sound.prototype.pickup.call(f.s);Sound.prototype.shieldOpen.call(f.s);Sound.prototype.fluidRefill.call(f.s,false);
 assert.deepEqual(f.calls.map(x=>x.group),['small-pickup','shield-bloom','fluid-refill']);
 Sound.prototype.fluidRefill.call(f.s,true);assert.equal(f.calls.length,3);
});
test('exact eight approved NEXT sources match packaged WAV hashes and finite safe levels',()=>{
 const sources=JSON.parse(readFileSync(new URL('../references/audio/elevenlabs-next-2026-10-22/manifest.json',import.meta.url))).sources;
 const runtime=JSON.parse(readFileSync(new URL('../public/sfx/manifest.json',import.meta.url))).files;
 assert.equal(sources.length,8);assert.equal(new Set(sources.map(x=>x.generationId)).size,8);
 for(const s of sources){assert.ok(ACTION_SFX[s.group]);const p=readFileSync(new URL('../references/audio/elevenlabs-next-2026-10-22/'+s.file,import.meta.url));assert.equal(createHash('sha256').update(p).digest('hex'),s.sha256);const m=runtime[s.group+'-0'];const b=readFileSync(new URL('../public/sfx/'+s.group+'-0.wav',import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),m.sha256);assert.equal(m.sourceSha256,s.sha256);assert.ok(m.peakDbfs<=-5.99&&Number.isFinite(m.rmsDbfs));assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),44100);}
 assert.ok(!sources.some(s=>/hologram|hoverbike/.test(s.group)));
});
