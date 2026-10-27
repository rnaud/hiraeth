import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webTransport } from '../src/analytics/web.js';

test('unconfigured browser does not import or initialize an SDK', async () => {
  assert.equal(await webTransport({ loadSdk: () => assert.fail('unconfigured SDK loaded') }), null);
});
test('browser adapter initializes once, forwards progression without private fields, and disables submission', async () => {
  const calls=[]; let listener;
  const sdk=new Proxy({}, {get:(_,name)=>(...args)=>{
    if (name === 'addRemoteConfigsListener') listener=args[0];
    calls.push([name,...args]);
  }});
  const transport=await webTransport({gameKey:'0'.repeat(32),secretKey:'0'.repeat(40),build:'test',
    loadSdk:async()=>({gameanalytics:{GameAnalytics:sdk,EGAProgressionStatus:{Start:1,Complete:2,Fail:3}}})});
  transport.enable(false); assert.equal(calls.length,0);
  transport.enable(true);
  transport.send({type:'progression',status:'Start',category:'World',name:'desert',privateText:'never send'});
  transport.send({type:'progression',status:'Complete',category:'Minigame',name:'canyon',value:12});
  transport.send({type:'design',name:'Loading:World:desert',value:123});
  assert.equal(calls.filter(c=>c[0]==='addProgressionEvent').length,0,'wait for session handshake');
  listener.onRemoteConfigsUpdated(); await Promise.resolve();
  transport.enable(false); transport.enable(true);
  transport.send({type:'progression',status:'Start',category:'World',name:'private-discarded'});
  listener.onRemoteConfigsUpdated(); transport.enable(false); await Promise.resolve();
  transport.close();
  assert.equal(calls.filter(c=>c[0]==='initialize').length,1);
  assert.ok(calls.some(c=>c[0]==='setEnabledEventSubmission'&&c[1]===false));
  assert.deepEqual(calls.filter(c=>c[0]==='addProgressionEvent'),[
    ['addProgressionEvent',1,'World','desert'],['addProgressionEvent',2,'Minigame','canyon',undefined,12]]);
  assert.ok(!JSON.stringify(calls).includes('privateText'));
  assert.equal(calls.at(-1)[0],'endSession');
});
