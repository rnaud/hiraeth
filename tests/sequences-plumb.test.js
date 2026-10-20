// Plumb's talk (issue #543): something critical brings Plumb to your shoulder with its mark (nothing on the cue), Q opens
// its talk in the dialogue box, and after it Plumb flies toward the goal; the engines' bundle held to the web's recorded
// stream beat by beat (tests/sequences-check.js; engine/sequences.js 'plumb-talk'). Its own file: tests/sequences-play.test.js
// is long enough.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSequences, WEB } from './sequences-check.js';
import { sequenceById } from '../engine/sequences.js';

checkSequences((s) => s.id === 'plumb-talk');

test('Plumb\'s web stream: the mark and no line of its on the cue, its talk in its name; the gate\'s ends there, a lost one flies with its bark', () => {
  assert.ok(sequenceById('plumb-talk'));
  const beats = Object.fromEntries(WEB.sequences['plumb-talk'].beats.map((b) => [b.beat, b]));
  assert.ok(!/Plumb:/.test(beats.mark.hud.cue ?? ''), 'not on the cue');
  assert.equal(beats.talk.hud.dialogue?.name, 'Plumb');
  assert.match(beats.talk.hud.dialogue.text, /Blades on a gate/);
  assert.equal(beats.page.hud.dialogue?.text, 'Keep out. Something got in.');
  assert.equal(beats.after.hud.dialogue, undefined);
  assert.doesNotMatch(beats.after.hud.cue ?? '', / m$/, 'no flight to the goal from the gate (#563)');
  assert.equal(beats.lostTalk.hud.dialogue?.name, 'Plumb');
  assert.doesNotMatch(beats.lostTalk.hud.dialogue.text, /this way|over here|Look\./i, 'no pointing word in the box (#559)');
  assert.match(beats.bark.hud.cue ?? '', /Plumb: .*(this way|over here|Look|back here)/i, 'the pointing word on the cue as it flies');
  assert.match(beats.flight.hud.cue ?? '', / m$/, 'then the find\'s line, as the button gives it');
});
