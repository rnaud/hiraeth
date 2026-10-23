import test from 'node:test';
import assert from 'node:assert/strict';
import { SfxTrace, recordedOrigin } from '../src/sfx-trace.js';
import { screen } from '../src/platform.js';

const known = {files:{'key-unlock-0':{from:'ElevenLabs Sound Effects v3'}}};
const deferred = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; };
const sound = () => ({muted:false,fxVol:1,voiceVol:1,layers:{}});

test('supplied catalogue provenance skips network completely, including explicit unknown', async () => {
  const fetcher=globalThis.fetch;
  let calls=0;
  globalThis.fetch=()=>{calls++;return new Promise(()=>{});};
  try {
    for(const manifest of [known,null]) {
      const trace=new SfxTrace(sound());
      try {
        let deadline;
        try { await Promise.race([trace.enable(true,{manifest,hud:false}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('provenance preflight stalled')),2000);})]); }
        finally { clearTimeout(deadline); }
        assert.equal(calls,0,'preflight cannot wait for a second manifest request');
        assert.equal(trace.manifest,manifest);
        assert.equal(trace.el,null,'the catalogue owns its status UI');
        assert.equal(recordedOrigin(trace.manifest,'key-unlock-0.wav'),manifest?'ElevenLabs':'Unknown recording');
      } finally { trace.dispose(); }
    }
  } finally { globalThis.fetch=fetcher; }
});

test('disabled trace cannot accept stale provenance or resurrect screen state', async () => {
  const fetcher=globalThis.fetch,wait=deferred(),trace=new SfxTrace(sound());
  globalThis.fetch=()=>wait.promise;
  try {
    const pending=trace.enable();
    assert.ok(trace.timer,'trace was initialized before the request');
    trace.dispose();
    wait.resolve({ok:true,json:async()=>known});await pending;
    assert.equal(trace.enabled,false);assert.equal(trace.manifest,null);
    assert.equal(screen.state.sfxTrace,null);
    assert.equal(trace.el,null);assert.equal(trace.active.size,0);
  } finally { trace.dispose();globalThis.fetch=fetcher; }
});

test('an already enabled trace adopts catalogue provenance and rejects its older request', async () => {
  const fetcher=globalThis.fetch,wait=deferred(),trace=new SfxTrace(sound());
  globalThis.fetch=()=>wait.promise;
  try {
    const pending=trace.enable();
    const fresh={files:{'key-unlock-0':{from:'Verified ElevenLabs source'}}};
    await trace.enable(true,{manifest:fresh,hud:false});
    wait.resolve({ok:true,json:async()=>known});await pending;
    assert.equal(trace.manifest,fresh);
    assert.equal(screen.state.sfxTrace,null,'catalogue does not restore the game HUD');
  } finally { trace.dispose();globalThis.fetch=fetcher; }
});
