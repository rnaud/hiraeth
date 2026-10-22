import test from 'node:test';
import assert from 'node:assert/strict';
import { SfxTrace, recordedOrigin, TRACE_LIMIT } from '../src/sfx-trace.js';
import { AudioContext } from '../engine/webaudio.js';
import { SampleBank } from '../src/sfx.js';
import { screen } from '../src/platform.js';

class Fixture {
  constructor() { this.muted = false; this.fxVol = this.voiceVol = 1; }
  start() {
    this.ctx = new AudioContext({sampleRate:8000});
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.fx = this.ctx.createGain(); this.fx.connect(this.master);
  }
  shield() {
    for (let i=0;i<4;i++) {
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      g.gain.value=.1; o.connect(g).connect(this.fx); o.start(); o.stop(this.ctx.currentTime+.5+i*.1);
    }
  }
  pad() { this.shield(); }
  tick(delay=.03) {
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); g.gain.value=.1;
    o.connect(g).connect(this.fx); o.start(this.ctx.currentTime+delay); o.stop(this.ctx.currentTime+delay+.01);
  }
}
const setup = async () => {
  const s=new Fixture(); s.start(); const trace=new SfxTrace(s);
  // No HTTP request or speaker: this context is the shared CPU DSP implementation.
  trace.manifest={files:{'contact-0':{from:'ElevenLabs Sound Effects v3'}}};
  await trace.enable(); return {s,trace};
};

test('provenance comes from metadata, never a name that resembles a provider', () => {
  assert.equal(recordedOrigin({files:{'elevenlabs-0':{from:'Kenney'}}},'elevenlabs-0.mp3'),'Other recording');
  assert.equal(recordedOrigin({files:{'contact-0':{from:'ElevenLabs Sound Effects v3'}}},'contact-0.wav'),'ElevenLabs');
  assert.equal(recordedOrigin(null,'contact-0.wav'),'Unknown recording');
});

test('one layered invocation is one occurrence; distinct invocations remain distinct, music excluded', async () => {
  const {s,trace}=await setup();
  try {
    s.shield(); trace.refresh(); assert.equal(trace.recent.length,1); assert.equal(trace.recent[0].layers.length,4);
    s.shield(); s.pad(); trace.refresh(); assert.equal(trace.recent.length,2);
    s.ctx.render(7200); trace.refresh(); assert.equal(trace.active.size,0);
    for(let i=0;i<30;i++) s.shield(); trace.refresh(); assert.equal(trace.recent.length,TRACE_LIMIT);
  } finally { trace.dispose(); }
});

test('muted and zero-gain emission is not recorded and disabling restores methods', async () => {
  const {s,trace}=await setup();
  try {
    s.muted=true; s.shield(); trace.refresh(); assert.equal(trace.recent.length,0);
    s.muted=false; s.fx.gain.value=0; s.shield(); trace.refresh(); assert.equal(trace.recent.length,0);
    await trace.enable(false); assert.equal(Object.hasOwn(s,'shield'),false); assert.equal(trace.active.size,0);
  } finally { trace.dispose(); }
});

test('enable before context exists attaches once context and bank arrive', async () => {
  const s=new Fixture(), trace=new SfxTrace(s);
  try {
    await trace.enable(); s.start(); trace.refresh(); s.shield(); trace.refresh(); assert.equal(trace.recent.length,1);
    trace.refresh(); s.shield(); trace.refresh(); assert.equal(trace.recent.length,2,'no doubled wrappers');
  } finally { trace.dispose(); }
});

test('only successfully started recorded sources appear; loop stops and dispose clear ownership', async () => {
  const {s,trace}=await setup();
  try {
    s.ctx.decodeAudioData=async()=>s.ctx.createBuffer(1,4000,8000);
    s.bank=new SampleBank(s.ctx,{table:{contact:{n:1,vol:1,ext:'wav'}},fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})});
    trace.attach();
    assert.equal(s.bank.start('contact',{dest:s.fx}),null); assert.equal(trace.recent.length,0);
    await s.bank.load('contact');
    const h=s.bank.start('contact',{dest:s.fx,loop:true}); trace.refresh();
    assert.ok(h); assert.equal(trace.recent.length,1); assert.equal(trace.recent[0].file,'contact-0.wav');
    h.stop(0); trace.refresh(); assert.equal(trace.active.size,0);
    s.bank.dispose(); trace.dispose(); assert.equal(trace.active.size,0);
  } finally { s.bank?.dispose(); trace.dispose(); }
});


test('already playing loops show as Playing, not invented starts, with shared mute status', async () => {
  const s=new Fixture(); s.start(); s.layers={jet:{g:s.ctx.createGain()}};
  const trace=new SfxTrace(s);
  try {
    await trace.enable(); trace.refresh();
    assert.equal(trace.recent.length,0); assert.equal(screen.state.sfxTrace.loopCount,1);
    s.muted=true; trace.refresh(); assert.equal(screen.state.sfxTrace.status,'Muted'); assert.equal(screen.state.sfxTrace.loopCount,0);
    await trace.enable(false); assert.equal(screen.state.sfxTrace,null);
  } finally { trace.dispose(); }
});

test('partial decode retains original take provenance and cancelled future starts are not events', async () => {
  const {s,trace}=await setup();
  try {
    s.ctx.decodeAudioData=async()=>s.ctx.createBuffer(1,8000,8000);
    s.bank=new SampleBank(s.ctx,{table:{contact:{n:2,vol:1,ext:'wav'}},fetcher:async url=>({ok:url.endsWith('-1.wav'),arrayBuffer:async()=>new ArrayBuffer(8)})});
    await s.bank.load('contact'); trace.attach();
    const h=s.bank.start('contact',{dest:s.fx,when:s.ctx.currentTime+1});
    assert.equal(h.traceInfo().file,'contact-1.wav'); h.stop(0); trace.refresh();
    assert.equal(trace.recent.length,0); assert.equal(trace.active.size,0);
  } finally { s.bank?.dispose(); trace.dispose(); }
});


test('a delayed short procedural effect survives between-refresh completion exactly once', async () => {
  const {s,trace}=await setup();
  try {
    s.tick(); assert.equal(trace.recent.length,0);
    s.ctx.render(800); trace.refresh();
    assert.equal(trace.recent.length,1); assert.equal(trace.recent[0].ended,true);
    trace.refresh(); assert.equal(trace.recent.length,1); assert.equal(trace.active.size,0);
  } finally { trace.dispose(); }
});
