// Issue #273: "I shouldn't have all quests in my menu by default when arriving at a new level. Key characters should
// give me the quests (and they should be visible on the map in case I'm lost) [...] Talking to them unlocks the quest.
// Each major level should focus on giving me access to the quest for the temple first."
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { balloonReason, beckonFor } from '../src/story/balloons.js';
import { mapMarks } from '../src/world-map.js';
import { migrateFlags, migrateQuestGivers273, MIGRATED } from '../src/save-migrate.js';
import { GIVERS_LINE, GIVERS_NOTE, giversLine, GIVERS_FLAG } from '../src/story/signature.js';
import { boxLine } from '../src/boxes/index.js';
import { parseLine } from '../src/story/tone.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** A world as the story builds it: its main quest opened by Oia, its temple's quest Lark's, two boxes Lark's too. */
function world({ flags = {}, lead = false } = {}) {
  const game = new GameState(null);
  for (const [k, v] of Object.entries(flags)) game.set(k, v);
  const toasts = [];
  const quests = new Quests({ game, toast: (t) => toasts.push(t) });
  quests.define({ id: 'w.main', title: 'The Bird', world: 'w', main: true, stages: [{ id: 'hear', text: 'Hear Oia out', flag: 'w.heard' }, { id: 'go', text: 'Go to the tower', flag: 'w.tower' }] });
  quests.define({ id: 'temple.w', title: 'The Aerie', world: 'w', stages: [{ id: 'find', text: 'Find the Aerie', flag: 'temple.w.entered', at: [0, 0, 260] }, { id: 'keeper', text: 'Wake its heart', flag: 'temple.w.done', at: [0, 0, 260] }] });
  quests.define({ id: 'box.w.a', title: 'A Makers’ Box', world: 'w', background: true, stages: [{ id: 'find', text: 'On the spire', flag: 'box.w.a' }] });
  quests.define({ id: 'box.w.b', title: 'A Makers’ Box', world: 'w', background: true, stages: [{ id: 'find', text: 'At the court', flag: 'box.w.b' }] });
  quests.locate('oia', () => V(100, 0, 0));
  quests.locate('lark', () => V(0, 0, 200));
  quests.opensWith('w.main', 'oia', { lead });
  quests.givenBy('temple.w', 'lark', { rank: 0, label: 'Lark, by the Aerie' });
  const found = () => !!game.flag('box.elsewhere');
  quests.givenBy('box.w.a', 'lark', { ready: () => found() && !game.flag('box.w.a'), line: (k) => boxLine('On the needle spire', k) });
  quests.givenBy('box.w.b', 'lark', { ready: () => found() && !game.flag('box.w.b'), line: (k) => boxLine('At the pale court', k) });
  return { game, quests, toasts };
}

test('on arrival nothing is in the quest log, and only the temple’s giver is known: the scout and the map find Lark alone', () => {
  const { quests } = world({ flags: { 'box.elsewhere': true } });
  assert.deepEqual(quests.summary().active, [], 'no quest in the menu on arrival');
  assert.equal(quests.journalHtml(), '');
  const o = quests.objective();
  assert.equal(o.id, 'giver-lark');
  assert.equal(o.label, 'Lark, by the Aerie');
  assert.ok(o.position.distanceTo(V(0, 0, 200)) < 1e-6);
  assert.deepEqual(quests.giverMarks().map((g) => g.person), ['lark'], 'Oia is not marked yet: the temple first');
  assert.equal(quests.leadGiver().person, 'lark');
  assert.deepEqual(quests.leadGiver().quests, ['temple.w', 'box.w.a', 'box.w.b'], 'the temple’s first, then the boxes she knows of');
});

test('talking to the giver unlocks what they give: the temple’s quest and the boxes’, said as their last words, one card at the end of the talk', () => {
  const { quests, toasts } = world({ flags: { 'box.elsewhere': true } });
  assert.equal(quests.opening('lark'), true);
  assert.equal(quests.isActive('temple.w'), true);
  assert.equal(quests.isActive('box.w.a'), true);
  assert.equal(quests.isActive('box.w.b'), true);
  assert.deepEqual(toasts, [], 'quiet while she speaks');
  const words = quests.givenWords();
  assert.equal(words.length, 2);
  assert.equal(words[0], '~curious~ The makers left chests out in the open too. One *on the needle spire*.');
  assert.equal(words[1], '~neutral~ And one *at the pale court*.');
  for (const w of words) assert.ok(parseLine(w).explicit, 'every line with its tone');
  assert.deepEqual(quests.givenWords(), [], 'said once');
  quests.opened();
  assert.equal(toasts.filter((t) => /The Aerie/.test(t)).length, 1, 'one card, for the temple');
  assert.equal(quests.summary().active.length, 3);
  // then the others are marked: Oia, the world's own quest; the scout is on the temple (what she gave)
  assert.deepEqual(quests.giverMarks().map((g) => g.person), ['oia']);
  assert.equal(quests.objective().quest, 'temple.w');
  // a second talk gives nothing again
  assert.equal(quests.opening('lark'), false);
});

test('the dialogue says the giver’s words after their own first node, with their tones', () => {
  const { game, quests } = world({ flags: { 'box.elsewhere': true } });
  const lark = { id: 'lark', name: 'Lark', talk: { nodes: { hello: { say: ['~neutral~ The Aerie is west.'], choices: [{ text: '~neutral~ I’ll go.', end: true }] } } } };
  quests.opening('lark');
  const r = new DialogueRunner(lark, { game, quests });
  r.addPages(quests.givenWords());
  assert.deepEqual(r.pages, ['The Aerie is west.', 'The makers left chests out in the open too. One *on the needle spire*.', 'And one *at the pale court*.']);
  assert.deepEqual(r.tones, ['neutral', 'curious', 'neutral']);
  assert.deepEqual(r.choices(), [], 'the answers wait for the last page');
  r.advance(); r.advance();
  assert.equal(r.choices()[0].text, 'I’ll go.');
});

test('givers still waiting are marked on the map, the lead alone first; met givers are not doubled; the box quests wait for a first box', () => {
  const { quests, game } = world();
  // no box found yet anywhere: Lark gives only the temple's quest
  assert.deepEqual(quests.leadGiver().quests, ['temple.w']);
  quests.opening('lark'); quests.opened();
  assert.equal(quests.isStarted('box.w.a'), false);
  assert.deepEqual(quests.giverMarks().map((g) => g.person), ['oia']);
  // the first box found: Lark is marked again (the boxes are hers to give now)
  game.set('box.elsewhere', true);
  assert.deepEqual(quests.giverMarks().map((g) => g.person).sort(), ['lark', 'oia']);
  assert.equal(quests.givesNow('lark'), 'box.w.a');
  // and on the Map: a mark of kind 'giver' each, with why the ship knows them
  const bounds = { x0: -300, z0: -300, w: 600, h: 600 };
  const givers = quests.giverMarks().map((g) => ({ id: g.person, label: g.label, x: g.position.x, z: g.position.z }));
  const marks = mapMarks({ you: { x: 0, z: 0, dx: 0, dz: 1 }, givers, bounds });
  const g = marks.filter((m) => m.kind === 'giver');
  assert.equal(g.length, 2);
  assert.ok(g.every((m) => /heard the light/.test(m.sub)), JSON.stringify(g.map((m) => m.sub)));
  // one the way on points at is the way on, saying why
  const goal = { x: 100, z: 0, label: 'Oia' };
  const withGoal = mapMarks({ you: { x: 0, z: 0 }, goal, givers, bounds });
  assert.equal(withGoal.filter((m) => m.kind === 'giver').length, 2, 'the way on, drawn as a giver, and the other');
  assert.equal(withGoal.some((m) => m.kind === 'goal'), false);
  assert.match(withGoal.find((m) => m.id === 'goal').sub, /the way on · the ship heard the light/);
  assert.ok(GIVERS_NOTE.length < 90, 'the Map’s line is short');
});

test('a giver waves you over: their balloon is for the quest they give', () => {
  const { quests, game } = world({ flags: { 'box.elsewhere': true } });
  const lark = { id: 'lark', talk: { nodes: { hello: { say: ['~neutral~ Hm.'] } } } };
  game.set('met.lark', true);
  const why = balloonReason(lark, { game, quests, objective: null, at: V(0, 0, 200) });
  assert.equal(why, 'quest');
  assert.equal(beckonFor(why, lark, { quests }), 'quest:temple.w');
  quests.opening('lark');
  assert.equal(balloonReason(lark, { game, quests, objective: null, at: V(0, 0, 200) }), null, 'nothing more to give');
});

test('reaching a goal before anyone gave its quest never waits for them; the desert’s lead is Marrow, not the temple', () => {
  const { quests, game } = world({ flags: { 'box.elsewhere': true } });
  // the temple entered first (src/temples/index.js starts its quest as you go in): Lark gives only the boxes now
  quests.start('temple.w');
  game.set('temple.w.entered', true);
  quests.update(null);
  assert.equal(quests.stage('temple.w'), 'keeper');
  const larks = () => quests.pendingGivers().find((g) => g.person === 'lark').quests;
  assert.equal(quests.leadGiver(), null, 'the lead’s own quest under way: everyone still waiting is marked');
  assert.deepEqual(larks(), ['box.w.a', 'box.w.b']);
  // a box opened first is its quest done (src/boxes/index.js): not hers to give any more
  game.set('box.w.a', true); game.set('quest.box.w.a', 'done');
  assert.deepEqual(larks(), ['box.w.b']);
  // the world's own quest, its goal reached before Oia spoke: it starts past it (openAhead), Oia no longer marked
  game.set('w.tower', true);
  quests.update(null);
  assert.equal(quests.isDone('w.main'), true);
  assert.ok(!quests.giverMarks().some((g) => g.person === 'oia'));
  // a world whose lead opens its own quest (the desert's Marrow at the ship: the power before the temple)
  const d = world({ lead: true });
  assert.equal(d.quests.objective().id, 'opener-w.main');
  assert.deepEqual(d.quests.giverMarks().map((g) => g.person), ['oia'], 'the lead alone');
  d.quests.opening('oia'); d.quests.opened();
  assert.deepEqual(d.quests.giverMarks().map((g) => g.person), ['lark'], 'then the temple’s local');
});

test('save migration (step 26): an old save keeps every quest it had, and the worlds it had been to keep the old ways', () => {
  const old = { 'save.migrated': 25, 'prologue.done': true, 'quest.desert.power': 'done', 'quest.temple.arzach': 'find', 'quest.box.arzach.spire': 'find', 'arzach.glyph.drawn': true, 'box.garage.level': true };
  migrateFlags(old);
  assert.equal(old['save.migrated'], MIGRATED());
  assert.equal(old['quest.temple.arzach'], 'find', 'a quest under way stays');
  assert.equal(old['quest.box.arzach.spire'], 'find');
  assert.equal(old['quest.desert.power'], 'done', 'a quest done stays');
  assert.equal(old['givers.old.desert'], true);
  assert.equal(old['givers.old.arzach'], true);
  assert.equal(old['givers.old.garage'], true, 'the Clock-House (a box of the Glass Dunes opened)');
  assert.equal(old['givers.old.glassdunes'], true);
  assert.equal(old['givers.old.perdide'], undefined, 'a world it has still to reach: the new ways');
  assert.equal(old['givers.old.arzach2'], undefined, 'a part of Vael it has not been to');
  // a new game has nothing to migrate: every world has givers
  const fresh = {};
  migrateFlags(fresh);
  assert.equal(Object.keys(fresh).some((k) => k.startsWith('givers.old.')), false);
  // pure
  assert.deepEqual(migrateQuestGivers273({ 'temple.bazaar.entered': true }), { 'temple.bazaar.entered': true, 'givers.old.bazaar': true });
});

test('the lore of the marks: the ship says it once, with its tone, and the Map has its line', () => {
  assert.equal(GIVERS_LINE.who, 'ship');
  assert.ok(GIVERS_LINE.tone && GIVERS_LINE.text.split(' ').length <= 22, 'terse');
  assert.match(GIVERS_LINE.text, /light/);
  const flags = {};
  const l = giversLine((k) => flags[k]);
  assert.equal(l, GIVERS_LINE);
  Object.assign(flags, l.set);
  assert.equal(flags[GIVERS_FLAG], true);
  assert.equal(giversLine((k) => flags[k]), null, 'said once');
});
