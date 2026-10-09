import test from 'node:test';
import assert from 'node:assert/strict';

// The route's people hear about Ilen (src/story/bazaar-data.js Sel, perdide2-data.js Hollin, desert-data.js
// Nour): their lines wait until he knows who she was (the mother's recording, `calls.ilen.told`) or has
// found her (`finale.met`), each once. And an old save that kept Dov's lift token before it was a choice
// reads as kept (src/save-migrate.js step 3), so the Lantern, Dov and the stone have their line for it.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { DialogueRunner } = await import('../src/story/dialogue.js');
const { GameState } = await import('../src/game-state.js');
const { migrateFlags } = await import('../src/save-migrate.js');
const { choicesMade } = await import('../src/story/ending.js');
const bazaar = await import('../src/story/bazaar-data.js');
const perdide2 = await import('../src/story/perdide2-data.js');
const desert = await import('../src/story/desert-data.js');
const incal = await import('../src/story/incal-data.js');
const lantern = await import('../src/story/lantern-data.js');

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
/** A save with these flags, every quest done (the people are at their `after`). */
function ctx(flags = {}) {
  const game = new GameState(store());
  for (const [k, v] of Object.entries(flags)) game.set(k, v);
  const quests = { isDone: () => true, isActive: () => false, isStarted: () => true, stage: () => 'done', has: () => false, reached: () => true };
  return { game, quests };
}
/** The choices on the person's opening node, once its pages are read. */
function opening(person, c) {
  const r = new DialogueRunner(person, c);
  while (!r.choices().length && r.advance());
  return { r, texts: r.choices().map((x) => x.text) };
}
function pick(r, start) {
  const c = r.choices().find((x) => x.text.startsWith(start));
  assert.ok(c, `no "${start}" in ${r.choices().map((x) => x.text).join(' | ')}`);
  r.choose(c.index);
  const pages = [];
  for (;;) { pages.push(r.text); if (r.ended || r.choices().length || !r.advance()) break; }
  return pages.join(' ');
}
const hollin = perdide2.KEEPERS.find((p) => p.id === 'hollin.perdide2');

test('Sel hears who Ilen was only once he knows, and that she heard it once he has found her', () => {
  const sel = bazaar.PEOPLE.sel;
  assert.ok(!opening(sel, ctx()).texts.some((t) => /Ilen/.test(t)), 'nothing before the mother’s recording');
  const c = ctx({ 'calls.ilen.told': true });
  const { r, texts } = opening(sel, c);
  assert.ok(texts.some((t) => t.startsWith('Ilen was my sister')));
  assert.ok(!texts.some((t) => t.startsWith('Ilen heard it')), 'not found yet');
  assert.match(pick(r, 'Ilen was my sister'), /first reading/);
  assert.ok(!opening(sel, c).texts.some((t) => /Ilen/.test(t)), 'once');
  // found her: Sel hears how the message ended
  c.game.set('finale.met', true);
  const o = opening(sel, c);
  assert.match(pick(o.r, 'Ilen heard it'), /how one ended/);
  assert.ok(!opening(sel, c).texts.some((t) => /Ilen/.test(t)), 'and that once too');
  // met her without the sister line first: both, the sister first
  const c2 = ctx({ 'finale.met': true });
  const o2 = opening(sel, c2);
  assert.deepEqual(o2.texts.filter((t) => /Ilen/.test(t)).map((t) => t.slice(0, 12)), ['Ilen was my ', 'Ilen heard i']);
});

test('Hollin: the sister line once he knows of Ilen (not after he found her), and Odile and Talo’s news even without the promise', () => {
  const told = ctx({ 'calls.ilen.told': true, 'perdide2.promise': 'maybe' });
  const o = opening(hollin, told);
  assert.equal(o.r.nodeId, 'after');
  assert.ok(!o.texts.some((t) => t.startsWith('I found where')), 'no news before the Lantern');
  assert.match(pick(o.r, 'I had a sister'), /kept a light for her/);
  assert.ok(!opening(hollin, told).texts.some((t) => t.startsWith('I had a sister')), 'once');
  assert.ok(!opening(hollin, ctx({ 'perdide2.promise': 'maybe' })).texts.some((t) => t.startsWith('I had a sister')), 'not before he knows');
  // the Lantern: he declined the promise, and still can tell him where they went (once)
  const met = ctx({ 'calls.ilen.told': true, 'finale.met': true, 'perdide2.promise': 'maybe' });
  const m = opening(hollin, met);
  assert.ok(!m.texts.some((t) => t.startsWith('I had a sister')), 'found her: no sister line');
  assert.match(pick(m.r, 'I found where Odile and Talo went'), /They got there/);
  assert.ok(!opening(hollin, met).texts.some((t) => t.startsWith('I found where')), 'told once');
  // told already when the promise was kept (his `came`): not again in `after`
  const kept = ctx({ 'finale.met': true, 'perdide2.promise': 'yes', 'perdide2.promise.kept': true, 'perdide2.hollin.found': true });
  assert.ok(!opening(hollin, kept).texts.some((t) => t.startsWith('I found where')));
});

test('Nour, after the desert: a word about the singing light over his house, once he knows of Ilen and before the Lantern', () => {
  const nour = desert.PEOPLE.nour;
  assert.ok(!opening(nour, ctx()).texts.some((t) => /sister/.test(t)));
  const c = ctx({ 'calls.ilen.told': true });
  const o = opening(nour, c);
  assert.equal(o.r.nodeId, 'after');
  assert.match(pick(o.r, 'My parents heard a singing light'), /knew your house/);
  assert.ok(!opening(nour, c).texts.some((t) => /sister/.test(t)), 'once');
  assert.ok(!opening(nour, ctx({ 'calls.ilen.told': true, 'finale.met': true })).texts.some((t) => /sister/.test(t)), 'not once the light is answered');
});

test('an old save that kept Dov’s token before it was a choice reads as kept; newer saves are left as they chose', () => {
  const token = { id: 'incal.token', level: 'incal', name: 'Dov’s lift token', kind: 'thing' };
  // the old ration talk gave the keepsake outright, no flag
  const old = { 'save.migrated': 2, 'incal.dov.fed': true };
  assert.equal(migrateFlags(old, [token]), true);
  assert.equal(old['incal.token'], 'kept');
  assert.equal(choicesMade((k) => old[k]).token, 'kept');
  // fed him, never chose yet (no keepsake): nothing decided for them
  const mid = { 'save.migrated': 2, 'incal.dov.fed': true };
  migrateFlags(mid, []);
  assert.equal(mid['incal.token'], undefined);
  // gave it back: stays given back
  const back = { 'save.migrated': 2, 'incal.dov.fed': true, 'incal.token': 'returned' };
  migrateFlags(back, [token]);
  assert.equal(back['incal.token'], 'returned');
  // through the real loader: the keepsakes are read with the flags
  const s = store();
  s.setItem('moebius.game.v1', JSON.stringify({ flags: { 'save.migrated': 2, 'incal.dov.fed': true }, keepsakes: [token] }));
  const g = new GameState(s);
  assert.equal(g.flag('incal.token'), 'kept');
  // and it has its lines: Dov, and the Lantern's answer
  const c = { game: g, quests: { has: () => false, isDone: () => true, isActive: () => false, isStarted: () => true, stage: () => 'done' } };
  const r = new DialogueRunner(incal.PEOPLE.dov, c);
  r.goto('lit');
  assert.ok(r.pages.some((p) => /Keep that token/.test(p)), 'Dov nods at the pocket');
  const asks = lantern.PEOPLE.ilen.talk.nodes;
  const brought = Object.values(asks).flatMap((n) => n.choices ?? []).filter((ch) => ch.goto === 'tokenKept');
  assert.ok(brought.length && brought.every((ch) => new DialogueRunner({ id: 'x', talk: { nodes: { a: { say: 'x', choices: [ch] } } } }, c).choices().some((x) => x.goto === 'tokenKept')), 'the Lantern asks about the kept token');
});
