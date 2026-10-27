import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ANALYTICS, productionWeb, progression, loading, observeGameplay } from '../src/analytics/events.js';
import { createAnalytics } from '../src/analytics/controller.js';
import { trackSession } from '../src/analytics/session.js';
import { unityTransport } from '../src/analytics/unity.js';

const event = progression('Start', 'World', 'desert');
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), resolve: v => resolve(v) }; };
function bus() { const listeners = new Map(); return { on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); return () => listeners.get(k).delete(f); }, emit(k, v) { for (const f of listeners.get(k) ?? []) f(v); } }; }

test('default on; only release origins and ordinary play may collect', () => {
  assert.equal(DEFAULT_ANALYTICS, true);
  const release = { production: true, hostname: 'hiraeth.alexandria-rnaud.workers.dev' };
  assert.equal(productionWeb(release), true);
  assert.equal(productionWeb({ ...release, hostname: 'rnaud.github.io' }), true);
  for (const options of [{ production: false }, { hostname: 'localhost' }, { hostname: 'preview.workers.dev' }, { debugSlot: true }, ...['?dev=1','?cinematicReview=1','?debugsave=1','?sequence=x','?capture=1','?worlds=1'].map(search => ({ search }))]) assert.equal(productionWeb({ ...release, ...options }), false, JSON.stringify(options));
  assert.equal(productionWeb({ ...release, search: '?level=desert&via=ship' }), true);
});
test('event schema accepts authored identifiers and finite numbers, drops arbitrary data', () => {
  assert.deepEqual(progression('Complete', 'Minigame', 'canyon', 42), { type:'progression', status:'Complete', category:'Minigame', name:'canyon', value:42 });
  for (const name of ['', 'name@example.com', 'a:b', 'a'.repeat(33), null]) assert.equal(progression('Start','World',name),null);
  assert.equal(progression('Quit','World','desert'),null);
  assert.equal(progression('Start','Save','desert'),null);
  assert.equal(progression('Complete','World','desert',Infinity).value,undefined);
  assert.equal(loading('desert',-1),null);
  assert.equal(loading('desert',NaN),null);
});
test('disallowed sessions and explicit opt-out never even load an SDK', async () => {
  let calls = 0;
  const disabled = createAnalytics(() => { calls++; });
  await disabled.setEnabled(true); disabled.send(event);
  const optedOut = createAnalytics(() => { calls++; }, { allowed:true });
  await optedOut.setEnabled(false); optedOut.send(event);
  assert.equal(calls,0);
});
test('bounded queue flushes once after loading; opt-out drops subsequent events', async () => {
  const wait = deferred(), calls = [];
  const a = createAnalytics(() => wait.promise, { allowed:true, limit:2 });
  const pending = a.setEnabled(true); a.send(event); a.send(event); a.send(event);
  wait.resolve({ enable:v => calls.push(v), send:v => calls.push(v) }); await pending;
  assert.deepEqual(calls,[true,event,event]);
  await a.setEnabled(false); a.send(event);
  assert.deepEqual(calls,[true,event,event,false]);
});
test('opt-out during download cannot initialize or replay queued events', async () => {
  const wait = deferred(); let enabled = 0;
  const a = createAnalytics(() => wait.promise,{allowed:true});
  const pending = a.setEnabled(true); a.send(event); await a.setEnabled(false);
  wait.resolve({ enable:() => enabled++, send:() => assert.fail('stale event') }); await pending;
  assert.equal(enabled,0);
});
test('dispose cancels pending initialization; transport failures never break gameplay', async () => {
  const wait = deferred(), a = createAnalytics(() => wait.promise,{allowed:true});
  const p = a.setEnabled(true); a.dispose(); wait.resolve({ enable:() => assert.fail('disposed') }); await p;
  const broken = createAnalytics(async () => { throw Error('blocked'); },{allowed:true});
  await broken.setEnabled(true); broken.send(event); broken.dispose();
});
test('only known game events become telemetry, and subscription cleanup works', () => {
  const game=bus(), events=[], stop=observeGameplay(game,e => { if(e)events.push(e); });
  game.emit('flag',{name:'world.desert.done',value:true});
  game.emit('flag',{name:'world.desert.done',value:false});
  game.emit('flag',{name:'private.save',value:'never send this'});
  game.emit('quest',{id:'desert.power',stage:'cave',prev:undefined});
  game.emit('quest',{id:'desert.power',stage:'next',prev:'cave'});
  game.emit('quest',{id:'desert.power',stage:'done',prev:'next'});
  game.emit('minigame:attempt',{id:'canyon',status:'Fail',score:12,save:'private'});
  assert.equal(events.length,4); assert.ok(events.every(e => !JSON.stringify(e).includes('private')));
  stop(); game.emit('minigame:attempt',{id:'canyon',status:'Start'}); assert.equal(events.length,4);
});
test('session readiness is reported once; preference changes stop collection', async () => {
  const game=bus(), events=[]; let listener, time=0;
  const settings={analytics:true,on(f){listener=f;f(null);}};
  const session=trackSession({game,settings,world:'desert',allowed:true,now:()=>time,loadTransport:async()=>({enable(){},send:e=>events.push(e),close(){}})});
  time=123; session.ready(); session.ready();
  assert.equal(events.length,0); session.play(); session.play(); await new Promise(r=>setImmediate(r));
  assert.equal(events.length,2); assert.equal(events[1].value,123);
  settings.analytics=false; listener('analytics'); game.emit('quest',{id:'desert.power',stage:'done'});
  assert.equal(events.length,2); session.dispose();
});
test('native adapter is optional and transports only event JSON', () => {
  assert.equal(unityTransport(null,'2.31'),null);
  const calls=[], a=unityTransport({analytics:(...v)=>calls.push(v)},'2.31');
  a.enable(true); a.send(event); a.close();
  assert.deepEqual(JSON.parse(calls[0][1]),{enabled:true,build:'2.31'});
  assert.deepEqual(JSON.parse(calls[1][1]),{...event,hasValue:false});
  assert.equal(calls[2][0],'end');
});
