// The father's message in the prologue, tightened after the playtest of 8 October 2026 ("the intro from
// Dad is boring"): shorter, one beat a line, the facts the story leans on kept, and cut off by the strike.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROLOGUE_CALL } from '../src/story/calls.js';
import { callTimeline, PROLOGUE_STAGES } from '../src/ship/prologue.js';
import { CHARGE } from '../src/story/charge.js';

const father = PROLOGUE_CALL.filter((l) => l.who === 'father');

test('the message is short: four lines from him and the cut, under half a minute', () => {
  assert.ok(father.length <= 5, `${father.length} lines`);
  const total = callTimeline(PROLOGUE_CALL).total;
  assert.ok(total < 30, `${total.toFixed(1)} s (it was 34.5 s)`);
  assert.equal(PROLOGUE_STAGES.find((s) => s.id === 'call').dur, total);
});

test('it keeps what the story leans on: the translator, what he left half done, the charge, the cut', () => {
  const said = father.map((l) => l.text).join(' ');
  assert.match(said, /translator at your ear/, 'the translator (story-bible.md, "The translator")');
  assert.match(said, /Nobody out there talks like us/);
  assert.match(said, /half done/, 'the boat, the school, his mother (LORE.md, "The prologue recording")');
  assert.ok(father.some((l) => l.text === CHARGE.quote), 'the charge, word for word');
  assert.ok(PROLOGUE_CALL.at(-1).cut && /waiting for you at the—$/.test(PROLOGUE_CALL.at(-1).text), 'the strike cuts him off');
  // nothing says it is a recording, and he talks as if it were live ("There you are")
  assert.ok(!PROLOGUE_CALL.some((l) => /reel|record|years/i.test(l.text)));
  assert.match(father[0].text, /There you are/);
});

test('every line of it is one breath (no line runs to the subtitle’s cap)', () => {
  for (const l of father) assert.ok(l.text.length <= 100, `${l.text.length}: ${l.text}`);
});
