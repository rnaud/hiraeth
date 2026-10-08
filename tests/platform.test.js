// The platform layer (src/platform.js, docs/systems/engine-bridge.md "The platform layer"): the page's
// calls in one place, never throwing without a page, and the screen's state as data, set by the
// modules that draw the HUD and the conversation, so an engine draws the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { page, store, input, audio, screen } from '../src/platform.js';
import { Cue } from '../src/hud.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { Dialogue } from '../src/story/dialogue.js';

test('without a page: no element, no listener, no storage, no pads, no audio, and nothing throws', () => {
  assert.equal(page.byId('cue'), null);
  const off = page.on('keydown', () => {});
  assert.equal(typeof off, 'function'); off();
  page.bodyClass('talking', true); page.exitPointerLock();
  assert.equal(page.hasBodyClass('talking'), false);
  assert.equal(typeof store.set('platform.test', '1'), 'boolean');   // (Node may have a storage of its own)
  store.remove('platform.test');
  assert.deepEqual(input.pads(), []);
  assert.equal(audio.context(), null);
});

test('storage: what localStorage holds, and a failing one stays quiet', () => {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  try {
    assert.equal(store.set('moebius.k', 'v'), true);
    assert.equal(store.get('moebius.k'), 'v');
    store.remove('moebius.k');
    assert.equal(store.get('moebius.k'), null);
    globalThis.localStorage = { getItem() { throw new Error('no'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('no'); } };
    assert.equal(store.get('a'), null); assert.equal(store.set('a', 'b'), false); store.remove('a');
  } finally { delete globalThis.localStorage; }
});

test('the screen\'s state: a part set moves the version only when it changes', () => {
  screen.reset();
  const v0 = screen.version;
  assert.equal(screen.set('cue', { text: 'E open', kind: '' }), true);
  assert.equal(screen.set('cue', { text: 'E open', kind: '' }), false, 'the same again: nothing moves');
  assert.equal(screen.version, v0 + 1);
  screen.toast('Received: a jar', 4.5);
  assert.deepEqual(screen.state.toast, { text: 'Received: a jar', secs: 4.5, id: screen.state.toast.id });
  const id = screen.state.toast.id;
  screen.toast('Received: a jar', 4.5);
  assert.equal(screen.state.toast.id, id + 1, 'the same words again are another toast');
  screen.reset();
  assert.equal(screen.state.cue, null);
});

test('the cue line and the conversation set their state as they draw', () => {
  screen.reset();
  const cue = new Cue(null);
  cue.set('Golden dunes', 'place');
  assert.deepEqual(screen.state.cue, { text: 'Golden dunes', kind: 'place' });
  cue.set('');
  assert.equal(screen.state.cue, null);
  const game = new GameState({ load: false }), quests = new Quests(game, {});
  const d = new Dialogue({ game, quests });
  const bob = { id: 'bob', name: 'Bob', title: 'the potter', talk: { nodes: { hello: { say: '~happy~ Hello there, traveller.', choices: [{ text: 'Hello.', goto: 'bye' }, { text: 'Bye.', end: true }] }, bye: { say: 'Safe roads.' } }, entry: [{ node: 'hello' }] } };
  assert.ok(d.start(bob));
  d.update(0.05);
  const s = screen.state.dialogue;
  assert.equal(s.name, 'Bob'); assert.equal(s.title, 'the potter');
  assert.equal(s.text, 'Hello there, traveller.');
  assert.ok(s.shown > 0 && s.shown < s.text.length && !s.done, 'revealing');
  assert.deepEqual(s.choices, [], 'no answers until the line is out');
  for (let i = 0; i < 200; i++) d.update(0.05);
  assert.equal(screen.state.dialogue.done, true);
  assert.deepEqual(screen.state.dialogue.choices.map((c) => c.text), ['Hello.', 'Bye.']);
  d.choose(screen.state.dialogue.choices[0].index);
  // the reply at once: his answer is not said back (playtest, October 2026)
  assert.equal(screen.state.dialogue.text, 'Safe roads.');
  assert.equal(screen.state.dialogue.speaker, 'npc');
  assert.equal(screen.state.dialogue.name, 'Bob');
  d.close();
  assert.equal(screen.state.dialogue, null, 'closed: nothing');
});
