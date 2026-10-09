// The father's message in the prologue. Tightened after the playtest of 8 October 2026 ("the intro from Dad is
// boring"), then rewritten (9 October 2026) so the years away are clear in it: "We haven't heard from you for so
// long", he misses him and is still disappointed in him, and he is not to come home without *something of value*
// (the game's key phrase, lettered as itself: src/story/key-phrase.js). Under it the singing light's theme comes
// nearer, and the traveller pauses the recording to listen (src/ship/prologue.js OPENING_ORDER).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROLOGUE_CALL } from '../src/story/calls.js';
import { callTimeline, PROLOGUE_STAGES, OPENING_ORDER, PAUSE, PAUSE_THEME_AT } from '../src/ship/prologue.js';
import { CHARGE } from '../src/story/charge.js';
import { TONES } from '../src/story/tone.js';
import { KEY_PHRASE, markKeyPhrase, saysKeyPhrase } from '../src/story/key-phrase.js';
import { formatText } from '../src/story/dialogue.js';
import { LIGHT_THEME, lightThemeNotes, lightLength, lightCues, lightEnvelope } from '../src/story/light-theme.js';
import { HUM } from '../src/story/hum.js';
import { FATHER_THEME } from '../src/score.js';
import { CUES } from '../src/soundtracks.js';

const father = PROLOGUE_CALL.filter((l) => l.who === 'father');
const plain = (l) => markKeyPhrase(l.text, false);
const said = father.map(plain).join(' ');

test('the message is short: four lines from him and the cut, under half a minute', () => {
  assert.ok(father.length <= 5, `${father.length} lines`);
  const total = callTimeline(PROLOGUE_CALL).total;
  assert.ok(total < 30, `${total.toFixed(1)} s (it was 34.5 s)`);
  assert.equal(PROLOGUE_STAGES.find((s) => s.id === 'call').dur, total);
});

test('the years away are clear: he has not heard from his son for so long, misses him, is still disappointed', () => {
  assert.match(said, /We haven’t heard from you for so long/);
  assert.match(said, /We miss you/);
  assert.match(said, /still disappointed in you/);
  // and the order: the greeting and the years first, the charge last before the cut
  const i = (re) => father.findIndex((l) => re.test(plain(l)));
  assert.ok(i(/so long/) < i(/miss you/) && i(/miss you/) < i(/disappointed/) && i(/disappointed/) < i(/something of value/));
});

test('the charge: not to come home until he brings something of value, said word for word', () => {
  const charge = father.find((l) => saysKeyPhrase(l.text));
  assert.ok(charge, 'he says it');
  assert.ok(plain(charge).includes(CHARGE.quote), 'the charge card’s words, word for word');
  assert.match(plain(charge), /don’t come home/i, 'and not to come back without it');
  assert.equal(charge.tone, 'solemn');
});

test('the key phrase is lettered as itself: on the subtitle, in a conversation, wherever the story echoes it', () => {
  const charge = father.find((l) => saysKeyPhrase(l.text));
  assert.match(charge.text, /\*something of value\*/, 'starred in the line: the voice leans on it');
  assert.match(markKeyPhrase(charge.text), /<em class="value">something of value<\/em>/);
  assert.ok(!markKeyPhrase(charge.text).includes('*'), 'its stars are spent on it');
  // a conversation: starred or not, it is the key phrase; other highlights stay highlights
  assert.match(formatText('~neutral~ I’m looking for something of value.'), /<em class="value">something of value<\/em>/);
  assert.match(formatText('~neutral~ Go to *the well*. Bring *something of value*.'), /<em>the well<\/em>.*<em class="value">something of value<\/em>/);
  assert.equal(formatText('~neutral~ Bring *something of value*.', false), 'Bring something of value.');
  // inside a quoted recording (the market's broadcast), the quote keeps its own span
  const q = formatText('~sad~ *At the port, I told you to make us proud. Bring back something of value. I wished I could take it back.*');
  assert.match(q, /^<em class="quote">.*<em class="value">something of value<\/em>.*<\/em>$/);
  assert.equal(KEY_PHRASE, 'something of value');
});

test('it keeps what the story leans on: the translator, what he left half done, and the cut (his own pause)', () => {
  assert.match(said, /translator at your ear/, 'the translator (story-bible.md, "The translator")');
  assert.match(said, /half done/, 'the boat, the school (LORE.md, "The prologue recording")');
  assert.ok(PROLOGUE_CALL.at(-1).cut && /—$/.test(PROLOGUE_CALL.at(-1).text), 'cut off mid-word: he pauses it');
  // nothing says it is a recording, and he talks as if it were live ("There you are")
  assert.ok(!PROLOGUE_CALL.some((l) => /reel|record|years/i.test(l.text)));
  assert.match(father[0].text, /There you are/);
  for (const l of PROLOGUE_CALL) assert.ok(TONES.includes(l.tone), `${l.text}: ${l.tone}`);
});

test('every line of it is one breath (no line runs to the subtitle’s cap)', () => {
  for (const l of father) assert.ok(l.text.length <= 100, `${l.text.length}: ${l.text}`);
});

test('the restaged opening, in order: the theme over the message, the pause, the pass, the drain, the landing', () => {
  const ids = PROLOGUE_STAGES.map((s) => s.id);
  const at = OPENING_ORDER.map((id) => ids.indexOf(id));
  assert.deepEqual(OPENING_ORDER, ['call', 'pause', 'pass', 'drain', 'glide', 'land']);
  assert.ok(at.every((i, k) => i >= 0 && (k === 0 || i === at[k - 1] + 1)), `back to back: ${ids.join(' → ')}`);
  assert.ok(!ids.some((id) => /impact|crash|plough|streak/.test(id)), 'nothing strikes it, nothing crashes');
  // the theme is heard over the message (three times, nearer each), before he pauses it
  const tl = callTimeline(PROLOGUE_CALL), cues = lightCues(tl);
  assert.equal(cues.length, 3);
  assert.ok(cues.every((c) => c.t > 0 && c.t < tl.total), 'all of them under his words');
  assert.ok(cues[0].vol < cues[1].vol && cues[1].vol < cues[2].vol, 'nearer each time');
  const charge = tl.lines.find((l) => saysKeyPhrase(l.line.text));
  assert.ok(cues[2].t >= charge.t0 && cues[2].t < charge.t1, 'nearest under the charge');
  // the pause is long enough to hear it whole, alone
  assert.ok(PAUSE >= PAUSE_THEME_AT + lightLength() - 0.5, `the theme (${lightLength().toFixed(1)} s) fits the pause (${PAUSE} s)`);
  // a recorded version follows the same rise
  const env = lightEnvelope(tl, { pause: PAUSE, pass: 5.4 });
  assert.ok(env.every(([t], i) => i === 0 || t >= env[i - 1][0]), 'in time order');
  assert.equal(Math.max(...env.map(([, g]) => g)), 1, 'loudest as it passes');
});

test('the singing light’s theme: a few notes of its own, kin to the hum, not the father’s tune', () => {
  const notes = lightThemeNotes();
  assert.ok(notes.length >= 4 && notes.length <= 6, `${notes.length} notes`);
  assert.ok(lightLength() > 4 && lightLength() < 8, `${lightLength().toFixed(1)} s`);
  // it starts on the note the hum lifts to (D up a fifth: A), two octaves up
  assert.ok(Math.abs(notes[0].f / (HUM.root * 1.5) - 2) < 0.01, `${notes[0].f.toFixed(1)} Hz`);
  // the lydian fourth, glided into
  assert.ok(LIGHT_THEME.notes.some(([s, , glide]) => s % 12 === 6 && glide), 'the raised fourth, from a quarter tone under');
  const shape = LIGHT_THEME.notes.map(([s]) => s - LIGHT_THEME.notes[0][0]);
  const dad = FATHER_THEME.map(([s]) => s - FATHER_THEME[0][0]);
  assert.notDeepEqual(shape, dad.slice(0, shape.length), 'not the father’s theme');
  // a recorded version can take its place: its slot is ready
  assert.equal(CUES['singing-light'], 'singing-light.mp3');
});

test('the short theme (the map’s signature search sings it every 1.7 s): its first notes, quicker, never overlapping itself', () => {
  const short = lightThemeNotes({ short: true });
  assert.equal(short.length, 4);
  assert.deepEqual(short.map((n) => n.f), lightThemeNotes().slice(0, 4).map((n) => n.f));
  const len = short.at(-1).t + short.at(-1).dur;
  assert.ok(len < 1.7, `${len.toFixed(2)} s`);
});
