// The relay signal (src/story/relay.js): the way to Ilen before home, and the recordings a
// normal run could never reach before (docs/story-audit.md, "Ilen before Home").
import test from 'node:test';
import assert from 'node:assert/strict';
import { relaySignal, RELAY_FROM, RELAY_WORLD, RELAY_TEXT } from '../src/story/relay.js';
import { callLines, pendingCall, applyCall, ilenPending, REEL, ILEN_CALL } from '../src/story/calls.js';
import { ilenAtStoneDue, ILEN_AT_STONE, ENDING_WORLDS, homeOpen } from '../src/story/ending.js';
import { mapEntries } from '../src/ship/starmap.js';
import { ORDER } from '../src/levels/names.js';
import { parseLine } from '../src/story/tone.js';

const save = (o = {}) => { const f = { ...o }; return { f, flag: (k) => f[k], set: (k, v) => { f[k] = v; } }; };

test('relay: no signal early; a far signal from RELAY_FROM worlds until the broadcast is heard; held until the mother speaks', () => {
  const s = save();
  assert.equal(relaySignal({ flag: s.flag, completed: RELAY_FROM - 1 }), null);
  assert.deepEqual(relaySignal({ flag: s.flag, completed: RELAY_FROM }), { stage: 'far', world: RELAY_WORLD });
  assert.ok(RELAY_FROM < ENDING_WORLDS, 'heard before home opens');
  s.set('clue.bazaar.home', true);
  assert.equal(relaySignal({ flag: s.flag, completed: 10 }), null, 'heard: nothing far off any more');
  s.set('calls.ilen.asked', true);
  assert.equal(relaySignal({ flag: s.flag, completed: 11 }).stage, 'held');
  s.set('calls.ilen.told', true);
  assert.equal(relaySignal({ flag: s.flag, completed: 11 }), null);
});

test('relay: the map marks the market, charted or a faint dot, and home holds the recording', () => {
  const levels = ORDER.map((id) => ({ id, title: id }));
  const s = save();
  ORDER.slice(0, 6).forEach((id) => s.set(`world.${id}.done`, true));
  const far = mapEntries({ order: ORDER, levels, flag: s.flag, current: 'edena', home: true, relay: relaySignal({ flag: s.flag, completed: 6 }) });
  const market = far.find((e) => e.id === RELAY_WORLD);
  assert.equal(market.signal, 'far');
  assert.equal(market.known, false, 'the order of the worlds is unchanged: it is not charted yet');
  assert.ok(far.find((e) => e.home).relayFar, 'home’s panel points along the route');
  assert.equal(far.filter((e) => e.signal).length, 1);
  s.set('clue.bazaar.home', true); s.set('calls.ilen.asked', true);
  const held = mapEntries({ order: ORDER, levels, flag: s.flag, current: 'bazaar', home: true, relay: () => relaySignal({ flag: s.flag, completed: 11 }) });
  assert.equal(held.find((e) => e.home).held, true);
  assert.ok(!held.some((e) => e.signal));
  for (const t of [RELAY_TEXT.far, RELAY_TEXT.farUncharted, RELAY_TEXT.held, RELAY_TEXT.console.far, RELAY_TEXT.console.held]) assert.ok(t.length > 10);
});

test('relay: "Come home" mentions the signal while it is out there', () => {
  const s = save();
  ORDER.slice(0, 6).forEach((id) => s.set(`world.${id}.done`, true));
  const ctx = { flag: s.flag, completed: ORDER.slice(0, 6), lastWorld: 'edena' };
  assert.ok(callLines(ENDING_WORLDS, ctx).some((l) => l.who === 'ship' && /old relay/.test(l.text)));
  s.set('clue.bazaar.home', true);
  assert.ok(!callLines(ENDING_WORLDS, ctx).some((l) => /old relay/.test(l.text)));
});

test('relay: the mother’s recording waits once he steps out of the ship, without flying', () => {
  const s = save({ 'calls.ilen.asked': true, 'calls.ilen.at': 'bazaar', 'ship.level': 'bazaar' });
  assert.equal(ilenPending(s.flag), false, 'not here, not yet');
  s.set('calls.ilen.later', true);
  assert.equal(ilenPending(s.flag), true);
});

test('relay: Ilen is named at the stone after the ending, once, unless the ending named her', () => {
  const s = save({ 'ending.done': true });
  assert.equal(ilenAtStoneDue(s.flag), false);
  s.set('calls.ilen.told', true);
  assert.equal(ilenAtStoneDue(s.flag), true);
  s.set('home.ilen.said', true);
  assert.equal(ilenAtStoneDue(s.flag), false);
  assert.equal(ilenAtStoneDue(save({ 'ending.done': true, 'calls.ilen.told': true, 'ending.ilen': true }).flag), false);
  assert.ok(parseLine(ILEN_AT_STONE).explicit);
});

test('a normal run, in the route’s order, hears every world’s reel line, the mother’s recording and the father on Ilen before the stone', () => {
  const s = save({ 'charge.given': true });
  const heard = [];
  const play = (done, here) => {
    for (let guard = 0; guard < 4; guard++) {
      const n = pendingCall({ flag: s.flag, completed: done.length });
      if (n == null) return;
      const lines = callLines(n, { flag: s.flag, completed: done, lastWorld: done[done.length - 1], here });
      for (const l of lines) assert.ok(l.tone, `every line toned: ${l.text}`);
      applyCall({ set: s.set }, lines);
      s.set(`calls.${n}`, true);
      heard.push(...lines.map((l) => l.text));
    }
  };
  const done = [];
  for (const id of ORDER) {
    s.set('ship.level', id);
    if (id === RELAY_WORLD) s.set('clue.bazaar.home', true);
    s.set(`world.${id}.done`, true);
    done.push(id);
    play(done, id);
    // he steps out of the ship, back into the world
    if (s.flag('calls.ilen.asked') && !s.flag('calls.ilen.told')) s.set('calls.ilen.later', true);
    play(done, id);
    if (s.flag('calls.ilen.told') && !s.flag('calls.beat.ilen.after')) s.set('calls.ilen.after.later', true);
    play(done, id);
  }
  assert.ok(homeOpen({ flag: s.flag, completed: done }), 'home is open');
  assert.ok(!s.flag('ending.done'));
  const text = heard.join('\n');
  for (const id of ORDER) assert.ok(text.includes(parseLine([].concat(REEL[id].find)[0]).text), `${id}: its reel line plays`);
  assert.ok(s.flag('calls.ilen.told'), 'the mother’s recording played');
  assert.ok(s.flag(`calls.${ILEN_CALL}`));
  assert.match(text, /welcomed her back with empty hands/);
  assert.match(text, /Recording held/);
});
