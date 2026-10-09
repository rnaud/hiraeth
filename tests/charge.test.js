// The father's charge: "Bring back something of value", the journey's own quest (src/story/charge.js).
import { markKeyPhrase } from '../src/story/key-phrase.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeState, chargeHud, chargeJournalHtml, chargeStep, showChargeCard, CHARGE, GIVEN } from '../src/story/charge.js';
import { PROLOGUE_CALL } from '../src/story/calls.js';
import { ENDING_WORLDS } from '../src/story/ending.js';
import { badgeLine } from '../src/prompt-keys.js';

const flags = (o) => (f) => o[f];
const K = [{ id: 'desert.song', name: 'Teo’s walking rhythm' }, { id: 'incal.word', name: 'Look up once a day' }];

test('the charge is the father’s own words on the prologue’s recording', () => {
  assert.ok(PROLOGUE_CALL.some((l) => l.who === 'father' && markKeyPhrase(l.text, false).includes(CHARGE.words)), 'he says it before the traveller pauses the recording');
  assert.ok(CHARGE.quote.endsWith(CHARGE.words));
});

test('its stages come from the save: not given, out in the worlds, home on the map, brought home', () => {
  assert.equal(chargeState({ flag: flags({}) }).stage, null, 'nothing before the father has said it');
  assert.equal(chargeState({ flag: flags({ [GIVEN]: true }) }).stage, 'out');
  assert.equal(chargeState({ flag: flags({ 'prologue.done': true }) }).stage, 'out', 'a save from before the charge has it too');
  const out = chargeState({ flag: flags({ [GIVEN]: true }), keepsakes: K, completed: 2 });
  assert.deepEqual([out.worlds, out.kept, out.names], [2, 2, K.map((k) => k.name)]);
  const six = chargeState({ flag: flags({ [GIVEN]: true }), completed: ENDING_WORLDS });
  assert.equal(six.stage, 'out', 'six worlds: the last recording waits at the console first');
  assert.ok(six.waiting);
  assert.match(chargeStep(six), /new message is waiting on the ship’s voicemail/);
  assert.equal(chargeState({ flag: flags({ [GIVEN]: true, 'calls.home': true }), completed: ENDING_WORLDS }).stage, 'home');
  // the first homecoming: follow the singing light (its trace once the market is heard); Ilen aboard; the true ending
  const light = chargeState({ flag: flags({ [GIVEN]: true, 'ending.done': true }), completed: ENDING_WORLDS });
  assert.equal(light.stage, 'light');
  assert.equal(light.traced, false);
  assert.match(chargeStep(light), /follow it/);
  const traced = chargeState({ flag: flags({ [GIVEN]: true, 'ending.done': true, 'world.bazaar.done': true }), completed: ENDING_WORLDS });
  assert.ok(traced.traced);
  assert.match(chargeStep(traced), /past the Signal Market/);
  assert.match(chargeHud(traced), /^✦ Follow the light’s trace/);
  assert.equal(chargeState({ flag: flags({ [GIVEN]: true, 'ending.done': true, 'finale.met': true }), completed: 11 }).stage, 'ilen');
  assert.equal(chargeState({ flag: flags({ [GIVEN]: true, 'ending.done': true, 'finale.met': true, 'ending.final': true }), completed: 11 }).stage, 'done');
  for (const stage of ['out', 'home', 'light', 'ilen', 'done']) assert.ok(chargeStep({ stage, kept: 0 }).length > 5);
});

test('the HUD shows it with its own mark, in its own gold tag', () => {
  const st = chargeState({ flag: flags({ [GIVEN]: true }) });
  assert.equal(chargeHud(st), '✦ Bring back something of value');
  assert.equal(chargeHud(st, { kept: 'Teo’s walking rhythm' }), '✦ Something of value: Teo’s walking rhythm');
  assert.match(chargeHud({ ...st, stage: 'home' }), /^✦ Home is on the map/);
  for (const l of [chargeHud(st, { kept: 'A' }), chargeHud({ ...st, stage: 'home' })]) assert.ok(!l.includes(' · '), 'one gold tag, not split by the HUD');
  assert.equal(chargeHud({ ...st, stage: 'done' }), null);
  assert.equal(chargeHud({ stage: null }), null);
  assert.equal(badgeLine('Vael · E talk\n✦ Bring back something of value · relics 1/5'),
    'Vael · <b class="key">E</b> talk\n<span class="charge">✦ Bring back something of value</span> · relics 1/5');
  assert.ok(!badgeLine('◆ the well · 20 m').includes('charge'), 'a world’s quest keeps its own look');
});

test('the journal card: pinned, his words, what you carry', () => {
  assert.equal(chargeJournalHtml(chargeState({ flag: flags({}) })), '');
  const html = chargeJournalHtml(chargeState({ flag: flags({ [GIVEN]: true }), keepsakes: K, completed: 1 }));
  assert.match(html, /class="charge"/);
  assert.ok(html.includes(CHARGE.quote) && html.includes('✦') && html.includes('1 of 6 worlds'));
  for (const k of K) assert.ok(html.includes(k.name.replace('’', '’')), k.name);
  assert.match(chargeJournalHtml(chargeState({ flag: flags({ [GIVEN]: true }) })), /nothing yet/);
  assert.match(chargeJournalHtml(chargeState({ flag: flags({ [GIVEN]: true, 'ending.done': true, 'ending.final': true }), completed: 6 })), /Brought home/);
  assert.doesNotMatch(chargeJournalHtml(chargeState({ flag: flags({ [GIVEN]: true, 'ending.done': true }), completed: 6 })), /Brought home/, 'not at the first homecoming');
  // past six the count goes on (eleven worlds on the route), it doesn't stop at “6 of 6”
  const eight = chargeJournalHtml(chargeState({ flag: flags({ [GIVEN]: true, 'calls.home': true }), completed: 8 }));
  assert.ok(eight.includes('8 worlds done') && !eight.includes('of 6'));
  assert.ok(html.includes('1 of 6 worlds before home'));
});

test('the title card sounds even without a page (and resolves)', async () => {
  let rang = 0;
  assert.equal(await showChargeCard({ sound: { charge: () => rang++ }, doc: null }), false);
  assert.equal(rang, 1);
});
