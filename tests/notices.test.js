// The notices' order (issue #78): one thing written on the screen at a time, the region's name first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTICE_ORDER, noticeMay, Cinema } from '../src/ship/cinema.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the notices take their turn: the region\'s name, a line, the objective card, the notices, a lesson', () => {
  assert.deepEqual(NOTICE_ORDER, ['title', 'caption', 'line', 'objective', 'toast', 'teach']);
  assert.equal(noticeMay('caption', { up: ['title'] }), false, 'the father\'s charge up: the region\'s name waits');
  assert.equal(noticeMay('toast'), true, 'nothing up: it shows');
  assert.equal(noticeMay('toast', { up: ['objective'] }), false, 'the objective card up: a notice waits');
  assert.equal(noticeMay('objective', { up: ['caption'] }), false, 'the region\'s name up: the card waits');
  assert.equal(noticeMay('objective', { waiting: ['caption'] }), false, 'and while it waits to show');
  assert.equal(noticeMay('toast', { waiting: ['objective'] }), false, 'the card goes before the notices');
  assert.equal(noticeMay('objective', { waiting: ['toast'] }), true, 'and is not held by them');
  assert.equal(noticeMay('teach', { waiting: ['toast'] }), false, 'a lesson is the last');
  assert.equal(noticeMay('teach', { up: ['line'] }), false);
  // a line (the ship's word as you step out) waits for the region's name, and for whatever is up
  assert.equal(noticeMay('line', { up: ['caption'] }), false);
  assert.equal(noticeMay('line', { waiting: ['caption'] }), false);
  assert.equal(noticeMay('line', { up: ['toast'] }), false);
  assert.equal(noticeMay('line', { waiting: ['objective', 'toast'] }), true, 'and goes before the card and the notices');
  assert.equal(noticeMay('toast', { up: ['line'] }), false, 'a notice waits for the line');
});

test('the cinema keeps its notices in order (node: no screen, so the lines and cards are not held)', () => {
  const c = new Cinema();
  assert.deepEqual(c.notices(), { up: [], waiting: [] });
  c.setCaption(false, true);
  assert.deepEqual(c.notices().waiting, ['caption']);
  assert.equal(c.mayNotice('objective'), false, 'the region\'s name waiting: the card waits');
  assert.equal(c.noticeBusy(), true, 'a lesson or a caller waits too');
  c.setCaption(true, true);
  assert.deepEqual(c.notices(), { up: ['caption'], waiting: [] }, 'up, it is no longer waiting');
  c.setCaption(false, false);
  assert.equal(c.noticeBusy(), false);
});

test('the game puts everything that writes on the screen by itself through the order', () => {
  const m = src('src/main.js'), cine = src('src/ship/cinema.js'), desert = src('src/story/desert.js');
  assert.match(m, /hold: quiet \|\| ship\.playing \|\| othersUp/, 'the region\'s name waits for whatever is up');
  assert.match(m, /ship\.cinema\.setCaption\(!!place, placeName\.waiting\)/, 'and tells the cinema');
  assert.match(m, /cue\.set\(found \|\| text \|\| place \|\| teach/, 'on the cue, the region\'s name before a lesson');
  assert.match(m, /!place && !ship\.cinema\.noticeBusy\(\) && now - balloonAt > 600 && game\.flag\('prologue\.done'\)/, 'a lesson waits for every notice, and a balloon');
  assert.match(m, /const greet = !ship\.cinema\.noticeBusy\(\)/, 'a greeting balloon waits');
  assert.match(m, /story\.start\(\{ quiet: !!playPrologue \}\)/, 'the crash\'s objective card is the desert\'s opening words: not said twice');
  assert.match(cine, /!this\.mayNotice\('toast'\)/, 'a notice waits its turn');
  assert.match(cine, /this\._toastT = secs;/, 'one notice at a time, each for its full time');
  assert.match(cine, /if \(!this\.mayNotice\('objective'\)\) \{ this\._objPending = text; return; \}/, 'the objective card waits its turn');
  assert.match(desert, /ctx\.ship\?\.cinema\?\.noticeBusy\?\.\(\)/, 'a caller waits for the notices');
});

// (issue #79: characters wave you over only when they have something you need to hear, once)
test('only someone with a word you need waves you over, and only once for it', async () => {
  const { beckonFor } = await import('../src/story/balloons.js');
  const quests = { pendingOpener: () => ({ id: 'desert.power' }) };
  assert.equal(beckonFor('objective', { id: 'sel' }, { objective: { id: 'q.step' } }), 'objective:q.step', 'the quest you follow points at them');
  assert.equal(beckonFor('quest', { id: 'marrow' }, { quests }), 'quest:desert.power', 'they open the world\'s quest');
  assert.equal(beckonFor('new', { id: 'kip' }), null, 'someone you have never met: no wave');
  assert.equal(beckonFor('news', { id: 'kip' }), null, 'news: no wave');
  assert.equal(beckonFor(null, { id: 'kip' }), null);
  const npc = src('src/npc.js'), desert = src('src/story/desert.js'), data = src('src/story/desert-data.js');
  assert.match(npc, /if \(this\.beckon\) this\.waveOnce\(this\.beckon\)/, 'a greeting waves only with a reason');
  assert.match(npc, /if \(done\.has\(why\)\) return false;/, 'once for each reason');
  assert.match(npc, /const waveT = -1;   \/\/ \(the crowd/, 'the crowd never waves');
  assert.match(desert, /!\(c\.moment && game\.flag\(calledFlag\(c\)\)\)/, 'a call is once for each moment, kept in the save');
  const { CALLS } = await import('../src/story/desert-data.js');
  assert.equal(CALLS.marrow.length, 1);
  assert.equal(CALLS.nour.length, 1);
  assert.doesNotMatch(data, /Psst! Over here, child/, 'no second call');
});
