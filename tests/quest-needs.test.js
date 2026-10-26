// Issue #328, the author: "In Vael, I shouldn't be able to get the quest marker for the waiting bird if I don't have the
// wings. I should never be able to unlock a quest that requires a critical item if I don't have it. The character
// instigator should send me to go to the other quest instead." A quest's `needs` (src/story/quest-needs.js) hold its
// giver back: no mark, no scout, no quest from their talk, one line saying where the missing thing is instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { files as storyFiles, loadStoryFile } from './story-data-modules.js';
import { files as peopleFiles, loadStoryPeopleFile } from './story-people-modules.js';
import * as THREE from 'three';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { Dialogue, DialogueRunner } from '../src/story/dialogue.js';
import { parseLine, stripTone } from '../src/story/tone.js';
import { CRITICAL, SOURCES, questNeeds, templeNeeds, carriedIn, missingNeed, heldBackLine } from '../src/story/quest-needs.js';
import { TEMPLES, templeWorld } from '../src/temples/index.js';
import { QUESTS as VAEL, PEOPLE as VAEL_PEOPLE } from '../src/story/arzach-data.js';
import { QUESTS as DESERT, PEOPLE as DESERT_PEOPLE } from '../src/story/desert-data.js';
import { QUESTS as INCAL, PEOPLE as INCAL_PEOPLE } from '../src/story/incal-data.js';


/** Every world's quests: the story data's, and the temples' as src/temples/index.js defines them. */
async function everyQuest() {
  const out = [];
  for (const f of [...storyFiles, ...peopleFiles]) {
    const m = await (f.endsWith('-people.js') ? loadStoryPeopleFile(f) : loadStoryFile(f));
    for (const q of m.QUESTS ?? []) out.push(q);
  }
  for (const [id, T] of Object.entries(TEMPLES)) {
    const Q = T.words.QUEST, world = templeWorld(id);
    out.push({ id: Q.id, title: Q.title, world: Q.world ?? world, needs: templeNeeds(T.def.logic, world), stages: [{ id: 'find', text: Q.find }], temple: id });
  }
  return out;
}
const ALL = await everyQuest();

function fresh(flags = {}) {
  const game = new GameState(null);
  for (const [k, v] of Object.entries(flags)) game.set(k, v);
  return { game, quests: new Quests({ game }) };
}
const meet = (game, n) => (n.item ? game.set(`item.${n.item}`, true) : game.set(`quest.${n.quest}`, 'done'));

test('every quest\'s needs are critical items (or a quest), each with a place to find it', () => {
  assert.ok(ALL.length > 60, `every world's quests (${ALL.length})`);
  for (const q of ALL) for (const n of questNeeds(q)) {
    if (n.item) {
      assert.ok(CRITICAL.includes(n.item), `${q.id}: ${n.item} is a critical item (${CRITICAL})`);
      assert.ok(SOURCES[n.item].where, `${q.id}: where ${n.item} is`);
      assert.ok(!carriedIn(q.world).includes(n.item), `${q.id}: ${n.item} is carried by everyone in ${q.world} already`);
    } else assert.ok(ALL.some((o) => o.id === n.quest), `${q.id}: the quest it waits for, ${n.quest}, exists`);
  }
  const held = ALL.filter((q) => questNeeds(q).length).map((q) => q.id).sort();
  // (the Undertower, the exam of the whole game, issue #418: its Bellows want the wings, so its quest waits for them)
  assert.deepEqual(held, ['arzach.bird', 'arzach2.bell', 'desert.bike', 'desert.mask', 'incal.light', 'temple.bazaar', 'temple.desert'].sort(), 'the quests held back');
  assert.deepEqual(templeNeeds(TEMPLES.desert.def.logic, 'desert'), ['doublejump'], 'the Rose House wants the lift valve (over the channel)');
  assert.deepEqual(templeNeeds(TEMPLES.arzach.def.logic, 'arzach'), [], 'the Aerie holds its own wings; the gun is carried past the desert');
});

// what each step asks for, from its words: a safety net for a quest added without its needs
const ASKS = [
  { item: 'glider', re: /\b(ride the wind|wings|glide|gliding)\b/i },
  { item: 'gun', re: /\b(splash|gun’s|gun's|your fluid|spark of fluid)\b/i },
  { item: 'backpack', re: /\b(full tank|fill your tank)\b/i },
  { quest: 'arzach.bird', re: /\bride the bird\b/i },
];
// what a quest's own steps find on the way, for the steps after (the desert's main quest: the backpack, the lift valve, the gun)
const GETS = { 'desert.power': { box: 'backpack', valve: 'doublejump', gun: 'gun' } };

test('a step that asks for a critical item belongs to a quest that needs it (or finds it first, or every traveller there has it)', () => {
  for (const q of ALL) {
    const needs = questNeeds(q), carried = carriedIn(q.world), got = new Set();
    for (const s of q.stages) {
      if (s.temple) continue;   // (a core gadget's own step, leave-gate.js coreStage: "Take the fluid wings from the Aerie")
      for (const a of ASKS) {
        if (!a.re.test(s.text ?? '')) continue;
        const ok = a.item ? got.has(a.item) || carried.includes(a.item) || needs.some((n) => n.item === a.item) : needs.some((n) => n.quest === a.quest);
        assert.ok(ok, `${q.id} · ${s.id} (“${s.text}”) asks for ${a.item ?? a.quest}: list it in the quest's needs (src/story/quest-needs.js)`);
      }
      const g = GETS[q.id]?.[s.id];
      if (g) got.add(g);
    }
  }
});

test('no quest of any world is given while something it needs is missing; once had, it is', () => {
  for (const q of ALL) for (const need of questNeeds(q)) {
    for (const as of ['opener', 'giver']) {
      const { game, quests } = fresh();
      for (const n of questNeeds(q)) if ((n.item ?? n.quest) !== (need.item ?? need.quest)) meet(game, n);   // (only this one missing)
      quests.define({ ...q, stages: q.stages.map((s) => ({ id: s.id, text: s.text })) });
      if (as === 'opener') quests.opensWith(q.id, 'who'); else quests.givenBy(q.id, 'who', { at: 'who' });
      quests.locate('who', () => new THREE.Vector3());
      const tag = `${q.id} (${as}, without ${need.item ?? need.quest})`;
      assert.ok(quests.blocked(q.id), `${tag}: blocked`);
      assert.equal(quests.pendingOpener(), null, `${tag}: no opener waiting`);
      assert.deepEqual(quests.pendingGivers(), [], `${tag}: no giver waiting`);
      assert.deepEqual(quests.giverMarks(), [], `${tag}: nobody marked on the map`);
      assert.equal(quests.givesNow('who'), null, `${tag}: no balloon`);
      assert.equal(quests.opening('who'), false, `${tag}: talking gives nothing`);
      assert.equal(quests.isStarted(q.id), false, tag);
      const held = quests.heldBack('who');
      assert.equal(held?.quest, q.id, `${tag}: held back`);
      const line = parseLine(held.line);
      assert.ok(line.explicit, `${tag}: the line carries a tone (“${held.line}”)`);
      assert.ok(line.text.length < 200, `${tag}: one short line`);
      if (!q.needsLine && need.where) assert.ok(line.text.includes(need.where), `${tag}: says where (“${line.text}”)`);
      assert.doesNotMatch(line.text, /\b(talk|speak|ask) to\b/i, `${tag}: no hand-off to somebody else`);
      // had: given as before
      meet(game, need);
      assert.equal(quests.blocked(q.id), null, `${tag}: had`);
      assert.equal(quests.heldBack('who'), null);
      assert.equal(quests.opening('who'), true, `${tag}: the talk gives it`);
      assert.equal(quests.isStarted(q.id), true);
    }
  }
});

test('an answer that would give a held-back quest is not offered (the desert: the masked head wants the gun)', () => {
  const pell = Object.values(DESERT_PEOPLE).find((p) => JSON.stringify(p.talk ?? {}).includes('"start":"desert.mask"'));
  assert.ok(pell, 'who gives the mask');
  // (each node that offers it, from a state of its own: going to a node does what it does)
  const asked = (flags) => Object.keys(pell.talk.nodes).filter((k) => k !== 'mask').some((nodeId) => {
    const { game, quests } = fresh({ 'quest.desert.oum': 'done', ...flags });
    for (const q of DESERT) quests.define(q);
    const r = new DialogueRunner(pell, { game, quests });
    r.goto(nodeId);
    while (!r.lastPage) r.advance();
    return r.choices().some((c) => /masked head/.test(c.text));
  });
  assert.equal(asked({}), false, 'without the gun: not asked about');
  assert.equal(asked({ 'item.gun': true }), true, 'with it: asked');
});

test('Vael\'s waiting bird: without the wings Oïa is not marked and gives nothing, she points at the Aerie and its quest starts; with them she gives it', () => {
  const { game, quests } = fresh({ 'prologue.done': true, 'item.backpack': true, 'item.gun': true, 'item.doublejump': true, 'item.sword': true, 'item.shield': true });
  for (const q of VAEL) quests.define(q);
  const T = TEMPLES.arzach;
  quests.define({ id: T.words.QUEST.id, title: T.words.QUEST.title, world: 'arzach', needs: templeNeeds(T.def.logic, 'arzach'), stages: [{ id: 'find', text: T.words.QUEST.find }, { id: 'keeper', text: 'x' }] });
  const at = new THREE.Vector3(1, 0, 2);
  quests.locate('oia', () => at); quests.locate('lark', () => at);
  quests.opensWith('arzach.bird', 'oia');
  quests.givenBy('temple.arzach', 'lark', { rank: 0, at: 'lark' });
  const marked = () => quests.giverMarks().map((g) => g.person);
  assert.deepEqual(marked(), ['lark'], 'Lark, by the Aerie, the lead');
  assert.equal(quests.pendingOpener(), null, 'the bird\'s quest waits for no talk yet');
  assert.ok(!quests.objective()?.id?.startsWith('opener-'), 'the scout doesn\'t find Oïa');
  // Oïa talked to first: her one line, the Aerie's quest under way, the bird's not
  const d = new Dialogue({ game, quests });
  assert.equal(d.start(VAEL_PEOPLE.oia), true);
  assert.match(stripTone(d.runner.text), /white house with stone wings/, 'she points at the Aerie');
  assert.equal(d.runner.tone, 'neutral');
  while (d.open) d.next();
  assert.equal(quests.isStarted('arzach.bird'), false, 'no Waiting Bird');
  assert.equal(game.flag('arzach.watcher.met'), undefined, 'nothing of her own talk happened');
  assert.equal(quests.isActive('temple.arzach'), true, 'the Aerie\'s quest instead: the quest that gets the wings');
  assert.deepEqual(marked(), [], 'and nobody else is marked (Oïa waits for the wings)');
  // the wings found: Oïa is marked, and her talk gives the quest
  game.set('item.glider', true);
  assert.deepEqual(marked(), ['oia']);
  assert.equal(quests.pendingOpener()?.id, 'arzach.bird');
  const d2 = new Dialogue({ game, quests });
  assert.equal(d2.start(VAEL_PEOPLE.oia), true);
  assert.equal(quests.isActive('arzach.bird'), true, 'the Waiting Bird, given');
  assert.match(stripTone(d2.runner.text), /lone tower/, 'her own talk');
});

// (reopened, the author 2026-10-14: the City-Shaft's main quest waits for the wings too; Wren's cab at the bottom is no way
//  through it: the way down is flown terrace by terrace, the way back up the air pillars)
test('the City-Shaft\'s main quest waits for the wings: Nima is not marked and gives nothing, she points at the Aerie in one line; with them she gives it', () => {
  const main = INCAL.find((q) => q.main);
  assert.deepEqual(questNeeds(main), [{ item: 'glider' }]);
  const { game, quests } = fresh({ 'prologue.done': true, 'item.backpack': true, 'item.gun': true, 'item.doublejump': true, 'item.sword': true, 'item.shield': true });
  for (const q of INCAL) quests.define(q);
  quests.locate('nima', () => new THREE.Vector3(1, 0, 2));
  quests.opensWith(main.id, 'nima');
  assert.equal(quests.pendingOpener(), null, 'no opener waiting');
  assert.ok(!quests.objective()?.id?.startsWith('opener-'), 'the scout doesn\'t find Nima');
  const d = new Dialogue({ game, quests });
  assert.equal(d.start(INCAL_PEOPLE.nima), true);
  const line = parseLine(main.needsLine);
  assert.ok(line.explicit && line.text.length < 120, `one short toned line (“${main.needsLine}”)`);
  assert.match(stripTone(d.runner.text), /the Aerie, on Vael/, 'she says where the wings are');
  assert.doesNotMatch(stripTone(d.runner.text), /\b(talk|speak|ask) to\b/i, 'no hand-off');
  while (d.open) d.next();
  assert.equal(quests.isStarted(main.id), false, 'not given');
  assert.equal(game.flag('incal.nima.heard'), undefined, 'nothing of her own talk happened');
  game.set('item.glider', true);
  assert.equal(quests.pendingOpener()?.id, main.id, 'the wings had: she waits for you');
  const d2 = new Dialogue({ game, quests });
  assert.equal(d2.start(INCAL_PEOPLE.nima), true);
  assert.equal(quests.isActive(main.id), true, 'given');
  assert.match(stripTone(d2.runner.text), /dust/, 'her own talk');
});

test('the generic line names the thing and its place, in the giver\'s voice', () => {
  assert.equal(heldBackLine({}, missingNeed({ needs: ['doublejump'] })), '~neutral~ Not without the lift valve. It is in the giant’s cave.');
  assert.equal(heldBackLine({}, missingNeed({ needs: ['glider'] })), '~neutral~ Not without the fluid wings. They are in the Aerie.');
  assert.equal(missingNeed({ needs: ['glider'] }, { has: (i) => i === 'glider' }), null);
  assert.equal(missingNeed({ needs: [{ quest: 'arzach.bird' }] }, { isDone: (q) => q === 'arzach.bird' }), null);
});
