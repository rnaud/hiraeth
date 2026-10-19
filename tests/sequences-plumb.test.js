// Plumb's talk (issue #543): something critical brings Plumb to your shoulder with its mark (nothing on the cue), Q opens
// its talk in the dialogue box, and after it Plumb flies toward the goal; the engines' bundle held to the web's recorded
// stream beat by beat (tests/sequences-check.js; engine/sequences.js 'plumb-talk'). Its own file: tests/sequences-play.test.js
// is long enough.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSequences, WEB } from './sequences-check.js';
import { sequenceById } from '../engine/sequences.js';

checkSequences((s) => s.id === 'plumb-talk');

test('Plumb\'s web stream: the mark and no line of its on the cue, its talk in its name, then the find', () => {
  assert.ok(sequenceById('plumb-talk'));
  const beats = Object.fromEntries(WEB.sequences['plumb-talk'].beats.map((b) => [b.beat, b]));
  assert.ok(!/Plumb:/.test(beats.mark.hud.cue ?? ''), 'not on the cue');
  assert.equal(beats.talk.hud.dialogue?.name, 'Plumb');
  assert.match(beats.talk.hud.dialogue.text, /Makers’ gate/);
  assert.equal(beats.page.hud.dialogue?.text, 'Something got in.');
  assert.equal(beats.flight.hud.dialogue, undefined);
  assert.match(beats.flight.hud.cue ?? '', / m$/, 'the find\'s line, as the button gives it');
});
