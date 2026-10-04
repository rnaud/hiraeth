import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { DialogueRunner, Dialogue, check, apply, formatText } from '../src/story/dialogue.js';
import { registerInteractable, bestInteractable, updateInteract, clearInteractables, PRIORITY } from '../src/interact.js';
import { PEOPLE, THINGS, QUESTS, CROWD_TALK } from '../src/story/desert-data.js';
import { CONTENT } from '../src/levels/content.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const world = () => {
  const game = new GameState(memory());
  const quests = new Quests({ game });
  quests.define({ id: 'q', title: 'A quest', stages: [{ id: 'a', text: 'Step A', talk: 'bob' }, { id: 'b', text: 'Step B', flag: 'thing.done' }, { id: 'c', text: 'Step C', goto: [10, 0, 0], radius: 3 }] });
  return { game, quests, ctx: { game, quests } };
};
const BOB = {
  id: 'bob', name: 'Bob',
  talk: {
    entry: [
      { if: { quest: 'q', done: true }, node: 'thanks' },
      { if: { quest: 'q', stage: 'a' }, node: 'job' },
      { if: { flag: 'met.bob' }, node: 'again' },
      { node: 'hello' },
    ],
    nodes: {
      hello: { say: ['Hello.', 'I have a job for you.'], do: { set: { 'met.bob': true } },
        choices: [
          { text: 'What job?', do: { start: 'q' }, goto: 'job' },
          { text: 'Only if I have the key.', if: { has: 'key' }, goto: 'job' },
          { text: 'Bye.', end: true },
        ] },
      again: { say: 'You again.', choices: [{ text: 'Bye.', end: true }] },
      job: { say: 'Do step A for me.', choices: [
        { text: 'Done.', do: [{ advance: ['q', 'a'] }, { give: 'coin' }, { keepsake: { id: 'k.bob', level: 'test', name: 'Bob’s word', kind: 'word', text: 'Thanks.' } }], goto: 'paid' },
        { text: 'Tell me once.', once: true, goto: 'job' },
      ] },
      paid: { say: 'Here, a coin.', next: 'again' },
      thanks: { say: 'All done, thank you.' },
    },
  },
};

test('conditions: flags, items, quest stages and combinations', () => {
  const { game, quests, ctx } = world();
  assert.equal(check(null, ctx), true);
  assert.equal(check({ flag: 'x' }, ctx), false);
  game.set('x', 3);
  assert.equal(check({ flag: 'x' }, ctx), true);
  assert.equal(check({ flag: 'x', is: 3 }, ctx), true);
  assert.equal(check({ flag: 'x', is: 4 }, ctx), false);
  assert.equal(check({ not: { flag: 'x' } }, ctx), false);
  assert.equal(check({ quest: 'q', started: false }, ctx), true);
  quests.start('q');
  assert.equal(check({ quest: 'q', stage: 'a' }, ctx), true);
  assert.equal(check({ quest: 'q', stage: ['b', 'c'] }, ctx), false);
  assert.equal(check({ quest: 'q', active: true }, ctx), true);
  assert.equal(check({ quest: 'q', reached: 'b' }, ctx), false);
  assert.equal(check({ has: 'key' }, ctx), false);
  quests.give('key');
  assert.equal(check({ all: [{ has: 'key' }, { flag: 'x' }] }, ctx), true);
  assert.equal(check({ any: [{ flag: 'nope' }, { has: 'key' }] }, ctx), true);
  assert.equal(check(() => false, ctx), false);
});

test('a talk tree opens on the first entry that holds, pages turn, choices set flags and start quests', () => {
  const { game, quests, ctx } = world();
  let r = new DialogueRunner(BOB, ctx);
  assert.equal(r.nodeId, 'hello');
  assert.equal(game.flag('met.bob'), true, 'node effects run on entering it');
  assert.equal(r.text, 'Hello.');
  assert.deepEqual(r.choices(), [], 'choices wait for the last page');
  assert.equal(r.advance(), true);
  assert.equal(r.text, 'I have a job for you.');
  assert.deepEqual(r.choices().map((c) => c.text), ['What job?', 'Bye.'], 'a choice whose condition fails is hidden');
  r.choose(0);
  assert.equal(quests.stage('q'), 'a', 'the choice started the quest');
  assert.equal(r.nodeId, 'job');
  // a once-only choice disappears after it has been taken
  r.choose(1);
  assert.deepEqual(r.choices().map((c) => c.text), ['Done.']);
  r.choose(0);
  assert.equal(quests.stage('q'), 'b', 'the choice advanced the quest');
  assert.equal(quests.has('coin'), true, 'and gave an item');
  assert.equal(game.keepsakes().length, 1, 'and a keepsake');
  assert.equal(r.nodeId, 'paid');
  assert.equal(r.advance(), true, '`next` continues to another node');
  assert.equal(r.nodeId, 'again');
  r.choose(0);
  assert.equal(r.ended, true);
  // talking again opens elsewhere: the quest is no longer at stage a, but we have met
  r = new DialogueRunner(BOB, ctx);
  assert.equal(r.nodeId, 'again');
  quests.complete('q');
  assert.equal(new DialogueRunner(BOB, ctx).nodeId, 'thanks');
  assert.deepEqual(new DialogueRunner(BOB, ctx).choices().map((c) => c.text), ['(leave)'], 'a node without choices offers to leave');
});

test('quests: stages advance by talk, flag and arrival; progress persists in the game state', () => {
  const store = memory();
  const game = new GameState(store);
  const quests = new Quests({ game });
  const def = { id: 'q', title: 'A quest', stages: [{ id: 'a', text: 'A', talk: 'bob' }, { id: 'b', text: 'B', flag: 'thing.done' }, { id: 'c', text: 'C', goto: [10, 0, 0], radius: 3 }] };
  quests.define(def);
  const events = [];
  game.on('quest', (e) => events.push(e.stage));
  const player = { pos: new THREE.Vector3() };
  quests.start('q');
  quests.update(player);
  assert.equal(quests.stage('q'), 'a', 'a talk stage waits for the conversation');
  apply({ advance: ['q', 'a'] }, { game, quests });
  apply({ advance: ['q', 'a'] }, { game, quests });   // a second advance from the same stage does nothing
  assert.equal(quests.stage('q'), 'b');
  quests.update(player);
  assert.equal(quests.stage('q'), 'b');
  game.set('thing.done', true);   // another system sets the flag
  quests.update(player);
  assert.equal(quests.stage('q'), 'c');
  const o = quests.objective();
  assert.equal(o.label, 'C');
  assert.deepEqual(o.position.toArray(), [10, 0, 0]);
  assert.match(quests.hud(player), /C · 10 m/);
  player.pos.set(9, 0, 1);
  quests.update(player);
  assert.equal(quests.isDone('q'), true);
  assert.deepEqual(events, ['a', 'b', 'c', 'done']);
  // a fresh state on the same storage remembers
  const again = new Quests({ game: new GameState(store) });
  again.define(def);
  assert.equal(again.isDone('q'), true);
  assert.match(quests.journalHtml(), /A quest/);
});

test('bring objectives point at the item until you carry it, then at whoever wants it', () => {
  const { quests } = world();
  quests.define({ id: 'drum', title: 'Drum', stages: [{ id: 'find', text: 'Find it', bring: 'drum', at: 'drum', to: 'teo' }] });
  quests.locate('drum', () => new THREE.Vector3(1, 0, 0));
  quests.locate('teo', () => new THREE.Vector3(2, 0, 0));
  quests.start('drum');
  quests.track('drum');
  assert.equal(quests.objective().position.x, 1);
  quests.give('drum');
  assert.equal(quests.objective().position.x, 2);
});

test('E priority: the nearest person or thing wins, the ship outranks them, nothing while riding', () => {
  clearInteractables();
  const player = { pos: new THREE.Vector3(), riding: false };
  const used = [];
  const at = (x) => (p) => Math.abs(p.pos.x - x);
  registerInteractable({ id: 'npc', priority: PRIORITY.talk, range: 3, distance: at(2), prompt: 'talk to Ama', use: () => used.push('npc') });
  registerInteractable({ id: 'bike', priority: PRIORITY.vehicle, range: 6, distance: at(-1.5), prompt: 'ride the hoverbike', use: () => used.push('bike') });
  assert.equal(bestInteractable(player).entry.id, 'bike', 'the bike is nearer');
  player.pos.x = 1.5;
  assert.equal(bestInteractable(player).entry.id, 'npc', 'now the person is nearer: talking wins');
  assert.equal(updateInteract(player, false).prompt, 'talk to Ama');
  assert.deepEqual(used, [], 'no press, no use');
  const r = updateInteract(player, true);
  assert.equal(r.handled, true);
  assert.deepEqual(used, ['npc']);
  // the ship's hatch, when you're at it, beats everyone in range
  const off = registerInteractable({ id: 'ship', priority: PRIORITY.ship, range: 4, distance: at(4), prompt: 'open the hatch', use: () => used.push('ship') });
  assert.equal(bestInteractable(player).entry.id, 'ship');
  off();
  assert.equal(bestInteractable(player).entry.id, 'npc', 'unregistered');
  // out of range: nothing, the press falls through to the player's own E (the whistle)
  player.pos.x = 30;
  assert.equal(updateInteract(player, true).handled, false);
  // riding: only what is meant for riders
  player.pos.x = 1.5; player.riding = true;
  assert.equal(bestInteractable(player), null);
  registerInteractable({ id: 'dock', priority: PRIORITY.use, range: 5, whileRiding: true, distance: at(0), prompt: () => 'dock', use: () => used.push('dock') });
  assert.equal(updateInteract(player, true).prompt, 'dock');
  clearInteractables();
});

test('the panel: the speaker turns to you, Esc-closing emits the events, motifs render', () => {
  const { game, quests } = world();
  const events = [];
  game.on('dialogue:start', (e) => events.push(['start', e.id]));
  game.on('dialogue:end', (e) => events.push(['end', e.id]));
  const npc = { talkTo: null, pos: new THREE.Vector3(2, 0, 0) };
  const d = new Dialogue({ game, quests, onOpen: (p, n) => { n.talkTo = { speaking: true }; }, onClose: (p, n) => { n.talkTo = null; } });
  assert.equal(d.start(BOB, npc), true);
  assert.equal(d.open, true);
  assert.ok(npc.talkTo, 'they turn to the player');
  d.update(10);   // the whole line is revealed
  assert.equal(d.revealed, d.runner.text.length);
  d.next();       // next page
  d.update(10);
  d.choose(2);    // "Bye."
  assert.equal(d.open, false);
  assert.equal(npc.talkTo, null);
  assert.deepEqual(events, [['start', 'bob'], ['end', 'bob']]);
  assert.match(formatText('the {glyph} mark, *here*'), /<svg class="glyph".*<em>here<\/em>/);
  assert.equal(formatText('the {glyph}', false), 'the ⁖⌒');
  // the two-shot camera eases toward a framing of both faces
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 3, 8);
  d.open = true; d.blend = 1;
  d.frameCamera(cam, { pos: new THREE.Vector3() }, npc.pos);
  const mid = new THREE.Vector3(1, 1.5, 0), f = cam.getWorldDirection(new THREE.Vector3());
  const flat = (v) => v.clone().setY(0).normalize();
  assert.ok(flat(f).dot(flat(mid.clone().sub(cam.position))) > 0.98, 'looking between them');
  assert.ok(f.y < 0 && f.y > -0.5, 'a little down, so the faces sit above the panel');
  assert.ok(cam.position.distanceTo(mid) > 2.5 && cam.position.distanceTo(mid) < 8, 'close enough to see faces');
});

test('the desert’s conversations are well formed: every goto, quest and condition points somewhere real', () => {
  const quests = new Set(QUESTS.map((q) => q.id));
  const people = [...Object.values(PEOPLE), ...Object.values(THINGS), ...CONTENT.desert.npcs.filter((n) => n.talk), ...Object.values(CROWD_TALK).flat()];
  const conds = (c, where) => {
    if (!c || typeof c === 'function') return;
    if (Array.isArray(c)) return c.forEach((x) => conds(x, where));
    for (const k of ['all', 'any']) if (c[k]) c[k].forEach((x) => conds(x, where));
    if (c.not) conds(c.not, where);
    if (c.quest) assert.ok(quests.has(c.quest), `${where}: no quest ${c.quest}`);
  };
  for (const p of people) {
    const nodes = p.talk.nodes;
    assert.ok(Object.keys(nodes).length, `${p.name} has something to say`);
    for (const e of p.talk.entry ?? []) { assert.ok(nodes[e.node], `${p.name}: entry to missing ${e.node}`); conds(e.if, p.name); }
    for (const [id, n] of Object.entries(nodes)) {
      if (n.next) assert.ok(nodes[n.next], `${p.name}.${id}: next ${n.next}`);
      for (const c of n.choices ?? []) {
        if (c.goto) assert.ok(nodes[c.goto], `${p.name}.${id}: goto ${c.goto}`);
        conds(c.if, `${p.name}.${id}`);
        for (const e of [c.do ?? []].flat()) {
          for (const q of [e.start, e.advance && [e.advance].flat()[0], e.stage?.[0]]) if (q) assert.ok(quests.has(q), `${p.name}.${id}: quest ${q}`);
        }
      }
      for (const s of [n.say].flat()) if (typeof s === 'object') conds(s.if, `${p.name}.${id}`);
    }
  }
  assert.ok(people.length >= 15);
});
