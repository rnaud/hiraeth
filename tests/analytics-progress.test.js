import test from 'node:test';
import assert from 'node:assert/strict';
import { storyProgress, progressSnapshot, STORY_WORLD_TARGET } from '../src/analytics/progress.js';
import { cleanEvent } from '../src/analytics/protocol.js';
import { trackSession } from '../src/analytics/session.js';
import { ORDER } from '../src/levels/names.js';

test('only the true ending reaches 100%; optional worlds cannot inflate the estimate', () => {
  assert.equal(storyProgress('desert', 0, 0).value, 0);
  assert.ok(storyProgress('home', ORDER.length, 3).value < 100);
  assert.ok(storyProgress('lantern', ORDER.length, 7).value < 100);
  assert.equal(storyProgress('home', 0, 8).value, 100);
  assert.equal(storyProgress('bazaar', ORDER.length, 1).value, storyProgress('bazaar', STORY_WORLD_TARGET, 1).value);
});
test('wire recomputes percentage and stage and rejects unsupported counters and models', () => {
  const event = storyProgress('home', 6, 3);
  assert.deepEqual(cleanEvent({ ...event, value: 100, status: 'true-ending', private: 'discard' }), event);
  for (const override of [{ model: undefined }, { model: 2 }, { worlds: -1 }, { worlds: 99 }, { worlds: 1.1 }, { milestones: 16 }, { milestones: null }, { name: 'private-name' }]) assert.equal(cleanEvent({ ...event, ...override }), null);
});
test('existing saves and legacy journal completion are captured without sending their contents', () => {
  const flags = { 'prologue.done': true, 'world.desert.done': true, 'ending.done': true };
  const game = { flag: k => flags[k], storage: { getItem: () => JSON.stringify({ stories: { desert: true, arzach: true }, notes: 'private' }) } };
  const result = progressSnapshot(game, 'arzach2');
  assert.equal(result.worlds, 2); assert.equal(result.name, 'arzach'); assert.equal(result.milestones, 3);
  assert.ok(!JSON.stringify(result).includes('private'));
  game.storage.getItem = () => '{'; assert.equal(progressSnapshot(game, 'desert').worlds, 1);
});
test('title preload does not collect; play resumes a save, deduplicates flags and respects opt-out', async () => {
  const listeners = new Map(), flags = { 'prologue.done': true }, events = [];
  const game = { flag: k => flags[k], on(k, fn) { const set = listeners.get(k) ?? new Set(); listeners.set(k,set); set.add(fn); return () => set.delete(fn); } };
  const emit = (name, value) => { flags[name] = value; for (const f of listeners.get('flag')) f({name,value}); };
  let preference, loaded = 0;
  const settings = { analytics:true, on(fn) { preference=fn; fn(null); } };
  const session = trackSession({ game, settings, world:'desert', allowed:true, loadTransport:async()=>{ loaded++; return {enable(){},send:e=>events.push(e)}; } });
  session.ready(); emit('world.desert.done', true); await new Promise(r=>setImmediate(r));
  assert.equal(loaded,0); session.play(); await new Promise(r=>setImmediate(r));
  assert.equal(events.find(e=>e.type==='progress').worlds,1);
  emit('world.desert.done',true); assert.equal(events.filter(e=>e.type==='progress').length,1);
  settings.analytics=false; preference('analytics'); emit('ending.final',true);
  assert.equal(events.filter(e=>e.type==='progress').length,1);
  settings.analytics=true; preference('analytics'); assert.equal(events.filter(e=>e.type==='progress').at(-1).value,100);
  session.dispose(); const n=events.length; emit('finale.met',true); assert.equal(events.length,n);
});
