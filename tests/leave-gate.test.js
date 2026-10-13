import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORE, missingCore, leaveRefusal } from '../src/story/leave-gate.js';
import { ORDER, partsOf } from '../src/levels/names.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ITEMS } from '../src/items.js';
import { parseLine } from '../src/story/tone.js';
import { progressBefore } from '../src/debug-save.js';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { QUESTS as DESERT_QUESTS } from '../src/story/desert-data.js';
import { QUESTS as VAEL_QUESTS } from '../src/story/arzach-data.js';

// Issue #217: "I shouldn't be able to leave the desert without getting all the core gadgets from that level. I was able
// to leave without a sword and shield right now." The ship (src/ship/ship.js travel) asks src/story/leave-gate.js.

const owning = (...ids) => (id) => ids.includes(id);
const DESERT_MAIN = ['backpack', 'doublejump', 'gun'];

test('the desert: not without the Givers’ blade and guard; the ship says where they are, in one line with a tone', () => {
  const no = leaveRefusal('desert', 'arzach', owning(...DESERT_MAIN));
  assert.ok(no, 'refused without the blade and the guard');
  assert.deepEqual(no.missing, ['sword', 'shield']);
  assert.equal(no.quest, 'temple.desert', 'the Rose House’s quest leads there');
  assert.equal(no.line.who, 'ship');
  assert.equal(no.line.tone, 'neutral');
  assert.match(no.line.text, /Rose House/);
  assert.ok(!/\n/.test(no.line.text) && no.line.text.length < 90, `one short line: ${no.line.text}`);
  // only the guard missing: it names the guard alone
  const one = leaveRefusal('desert', 'perdide', owning(...DESERT_MAIN, 'sword'));
  assert.deepEqual(one.missing, ['shield']);
  assert.match(one.line.text, /guard is still in the Rose House/);
  // everything had: it goes, anywhere on the chart
  for (const to of ['arzach', 'perdide', 'home']) assert.equal(leaveRefusal('desert', to, owning(...DESERT_MAIN, 'sword', 'shield')), null, to);
  // (never stopped from going nowhere)
  assert.equal(leaveRefusal('desert', 'desert', owning()), null);
});

test('Vael: not without the fluid wings, from either of its parts; the other worlds leave whenever', () => {
  for (const from of ['arzach', 'arzach2']) {
    const no = leaveRefusal(from, 'perdide', owning());
    assert.deepEqual(no?.missing, ['glider'], from);
    assert.match(no.line.text, /^Not yet\. The fluid wings are still in the Aerie\.$/);
  }
  assert.equal(leaveRefusal('arzach', 'perdide', owning('glider')), null);
  for (const w of ORDER.filter((id) => !CORE[id])) assert.deepEqual(missingCore(w, owning()), [], `${w}: no core gadgets`);
  assert.deepEqual(Object.keys(CORE).sort(), ['arzach', 'desert']);
});

test('every core gadget is an item found in its own world, so no save is kept where it cannot get it', () => {
  for (const [w, list] of Object.entries(CORE)) {
    const boxes = partsOf(w).flatMap((p) => PLACEMENTS[p] ?? []);
    for (const c of list) {
      assert.ok(ITEMS[c.item], `${c.item}: an item`);
      assert.ok(boxes.some((b) => b.item === c.item), `${w}: a chest of ${c.item} in the world`);
    }
  }
});

test('the debug saves of every world after them carry the core gadgets, so they leave as before', () => {
  for (const [i, w] of ORDER.entries()) {
    const flags = progressBefore(w).flags;
    for (const before of ORDER.slice(0, i)) assert.deepEqual(missingCore(before, (id) => !!flags[`item.${id}`]).map((c) => c.item), [], `${w}'s debug save, leaving ${before}`);
  }
});

test('the ship asks before it takes off, and the play-through checks it between worlds', () => {
  const ship = readFileSync(new URL('../src/ship/ship.js', import.meta.url), 'utf8');
  assert.match(ship, /travel\(to\) \{\n\s+if \(!game\.flag\('ship\.powered'\)\) return;[\s\S]{0,200}leaveRefusal\(this\.levelId, to,/);
  const agent = readFileSync(new URL('./playthrough-agent.js', import.meta.url), 'utf8');
  assert.match(agent, /leaveRefusal\(from, to,/);
  // a refusal starts the quest that leads to what is missing (main.js)
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /game\.on\('travel:refused', \(\{ quest \}\) => \{ if \(quest && !storyRt\.quests\.isStarted\(quest\)\) storyRt\.quests\.start\(quest\)/);
  assert.match(ship, /game\.emit\('travel:refused', \{ to, missing: no\.missing, quest: no\.quest \}\)/);
  // and the line parses as a tagged one (tests/tone.test.js's rule for every line)
  assert.ok(parseLine(`~neutral~ ${leaveRefusal('desert', 'arzach', owning()).line.text}`).explicit);
});

// Issue #232: the desert's main quest ended ("Meet Qanat at your ship"), then the ship refused to leave without the blade
// and the guard: what held him was in no step. Now the quest's last step names them while they are missing.
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const mainQuest = (quests, id) => { const game = new GameState(memory()), q = new Quests({ game }); for (const d of quests) q.define(d); return { game, q, d: q.def(id) }; };
const hasAll = (game) => (id) => !!game.flag(`item.${id}`);

test('the desert: the blade and the guard missing, the step after the tree is the Rose House, before Qanat’s gift, and the quest ends only with them (issues #232, #278)', () => {
  const { game, q, d } = mainQuest(DESERT_QUESTS, 'desert.power');
  const ids = d.stages.map((s) => s.id);
  assert.deepEqual(ids.slice(-3), ['light', 'gear', 'ship'], 'the Rose House a leg out from the tree, the gift the way home');
  const gear = d.stages.find((s) => s.id === 'gear');
  assert.match(gear.text, /blade and guard from the Rose House/);
  assert.equal(gear.at, 'temple.desert.door');
  assert.equal(gear.gate, true);
  assert.equal(d.stages.at(-1).flag, 'desert.ship.fed', 'the gift ends it: reaching the ship is the goal');
  for (const i of DESERT_MAIN) game.set(`item.${i}`, 1);
  q.start('desert.power', 'light');
  game.set('desert.tree.lit', true); q.update(null);
  assert.equal(q.stage('desert.power'), 'gear');
  assert.ok(leaveRefusal('desert', 'arzach', hasAll(game)), 'and the ship would refuse: the quest says so first');
  // an old save fed before the Rose House (the order before #278): the gift had doesn't carry the quest past the gate
  game.set('desert.ship.fed', true); q.update(null);
  assert.equal(q.stage('desert.power'), 'gear', 'the ship fed, the quest still open: its step names what the ship waits for');
  game.set('item.sword', 1); q.update(null);
  assert.equal(q.stage('desert.power'), 'gear', 'the blade alone: not yet');
  game.set('item.shield', 1); q.update(null); q.update(null);
  assert.equal(q.isDone('desert.power'), true, 'both, and the gift had: the quest ends');
  assert.equal(leaveRefusal('desert', 'arzach', hasAll(game)), null, 'and the ship goes: a done quest always means it can fly');
});

test('the desert: with the blade and the guard, Qanat’s gift follows the Rose House’s step (issue #278)', () => {
  const { game, q } = mainQuest(DESERT_QUESTS, 'desert.power');
  for (const i of DESERT_MAIN) game.set(`item.${i}`, 1);
  q.start('desert.power', 'gear');
  q.update(null);
  assert.equal(q.stage('desert.power'), 'gear');
  game.set('item.sword', 1); game.set('item.shield', 1); q.update(null);
  assert.equal(q.stage('desert.power'), 'ship', 'on to the gift at the ship');
  assert.equal(q.isDone('desert.power'), false);
  game.set('desert.ship.fed', true); q.update(null);
  assert.equal(q.isDone('desert.power'), true);
});

test('the desert: the blade and guard had first, the step is never shown and never pulls the quest past Qanat\'s gift (issue #232)', () => {
  const { game, q } = mainQuest(DESERT_QUESTS, 'desert.power');
  const seen = [];
  q.onChange(({ stage }) => seen.push(stage));
  for (const i of [...DESERT_MAIN, 'sword', 'shield']) game.set(`item.${i}`, 1);
  q.start('desert.power', 'light');
  q.update(null);
  assert.equal(q.stage('desert.power'), 'light', 'having them early skips nothing before them');
  game.set('desert.tree.lit', true); q.update(null);
  assert.equal(q.stage('desert.power'), 'ship');
  game.set('desert.ship.fed', true); q.update(null);
  assert.equal(q.isDone('desert.power'), true);
  assert.ok(!seen.includes('gear'), `passed over without a frame on it: ${seen.join(' → ')}`);
  // (the ship wakes when it is fed: src/story/desert.js; the quest's end says the galaxy is open)
  const desert = readFileSync(new URL('../src/story/desert.js', import.meta.url), 'utf8');
  assert.match(desert, /game\.on\('flag:desert\.ship\.fed', \(v\) => \{ if \(v && missingCore\('desert', \(id\) => quests\.has\(id\)\)\.length\) wake\(false\); \}\);/);
});

test('Vael: the main quest\'s last step is the fluid wings while they are missing; passed over when had (issue #232)', () => {
  const { game, q, d } = mainQuest(VAEL_QUESTS, 'arzach.bird');
  assert.equal(d.stages.at(-1).id, 'wings'); assert.match(d.stages.at(-1).text, /fluid wings from the Aerie/);
  q.start('arzach.bird', 'promise');
  game.set('arzach.bird.promise', true); q.update(null);
  assert.equal(q.stage('arzach.bird'), 'wings');
  game.set('item.glider', 1); q.update(null);
  assert.equal(q.isDone('arzach.bird'), true);
  const had = mainQuest(VAEL_QUESTS, 'arzach.bird');
  had.game.set('item.glider', 1); had.q.start('arzach.bird', 'promise');
  had.game.set('arzach.bird.promise', true); had.q.update(null);
  assert.equal(had.q.isDone('arzach.bird'), true, 'with the wings: done at once');
});
