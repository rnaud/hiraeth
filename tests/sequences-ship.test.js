// The ship's hold and Anselm's shop (issue #264, #195/#234; the talk's gestures, #197): walked into the ramp, up it and
// in on the ship's autopilot, Anselm's talk and his shop, the engines' bundle held to the web's recorded stream beat by
// beat (tests/sequences-check.js; engine/sequences.js 'hold'). Its own file: tests/sequences-play.test.js is long enough.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSequences, WEB } from './sequences-check.js';
import { sequenceById } from '../engine/sequences.js';

checkSequences((s) => s.id === 'hold');

test('the hold\'s web stream walks aboard, talks and opens Anselm\'s shop', () => {
  assert.ok(sequenceById('hold'));
  const beats = Object.fromEntries(WEB.sequences.hold.beats.map((b) => [b.beat, b]));
  assert.equal(beats.anselm.hud.prompt?.text, 'talk to Anselm Thrum');
  assert.equal(beats.talk.hud.dialogue?.name, 'Anselm Thrum');
  assert.equal(beats.shop.menu?.kind, 'shop');
  assert.equal(beats.shop.menu?.page, 'thrum');
  assert.ok(beats.shop.menu.rows.length >= 4, 'his wares');
});
