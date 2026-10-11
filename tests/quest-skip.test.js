import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { QUESTS } from '../src/story/desert-data.js';

// "If I go straight to the quest to fill up my jar we should complete the quest. Here I still had to talk to Ama. All
// quests should be solvable by just going to the end if you can" (the author's playthrough, October 2026, issue #73):
// a later step whose goal is met already carries the quest past it, the steps before it passed over (Quests.skipAhead);
// a `gate` holds the quest until its own goal is met; an `ahead: false` step done out of order pulls nothing.
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const world = (stages) => {
  const game = new GameState(memory()), quests = new Quests({ game });
  quests.define({ id: 'q', title: 'A quest', stages });
  return { game, quests };
};

test('going straight to the end: a later step already done carries the quest past it', () => {
  const { game, quests } = world([
    { id: 'meet', text: 'Meet Bob', talk: 'bob' },
    { id: 'go', text: 'Go to the cave', goto: [100, 0, 0], radius: 5 },
    { id: 'lever', text: 'Lever the rock', flag: 'rock.moved' },
    { id: 'fill', text: 'Fill the jar', flag: 'jar.filled' },
    { id: 'home', text: 'Come home', flag: 'home' },
  ]);
  quests.start('q');
  quests.update(null);
  assert.equal(quests.stage('q'), 'meet', 'nothing done yet: where it was');
  game.set('jar.filled', true);
  quests.update(null);
  assert.equal(quests.stage('q'), 'home', 'the jar filled: Bob, the cave and the rock are passed over');
  game.set('home', true);
  quests.update(null);
  assert.equal(quests.isDone('q'), true);
});

test('a gate holds the quest until its own goal is met; a step that can be done out of order pulls nothing', () => {
  const { game, quests } = world([
    { id: 'meet', text: 'Meet Bob', talk: 'bob' },
    { id: 'water', text: 'Let the water up', flag: 'water.up', gate: true },
    { id: 'bike', text: 'Find the bike', flag: 'bike.found', ahead: false },
    { id: 'ride', text: 'Ride out', flag: 'rode' },
    { id: 'stone', text: 'Take the stone', flag: 'stone.taken' },
  ]);
  quests.start('q');
  game.set('stone.taken', true);
  quests.update(null);
  assert.equal(quests.stage('q'), 'meet', 'the stone is no use before the water is up: the gate holds');
  game.set('water.up', true);
  quests.update(null);
  assert.equal(quests.isDone('q'), true, 'the water up, the stone already taken: done');
  const w = world([
    { id: 'a', text: 'A', flag: 'a' },
    { id: 'bike', text: 'Find the bike', flag: 'bike.found', ahead: false },
    { id: 'c', text: 'C', flag: 'c' },
  ]);
  w.quests.start('q');
  w.game.set('bike.found', true);
  w.quests.update(null);
  assert.equal(w.quests.stage('q'), 'a', 'a bike found on a side errand doesn’t carry the quest on');
  w.game.set('a', true);
  w.quests.update(null); w.quests.update(null);   // (a step a frame)
  assert.equal(w.quests.stage('q'), 'c', 'but reached, it is done at once');
});

test('the desert: the water let out and the tank filled before anyone sent you, the quest goes on from there (no Ama, no jar)', () => {
  const game = new GameState(memory()), quests = new Quests({ game });
  for (const q of QUESTS) quests.define(q);
  quests.start('desert.power');
  const main = QUESTS.find((q) => q.id === 'desert.power');
  assert.ok(!main.stages.some((s) => s.id === 'ask' || /\bjar\b/i.test(s.text)), 'Ama’s jar is no step of the main quest');
  assert.equal(main.stages.find((s) => s.id === 'fill').flag, 'desert.pool.tinted', 'the pool step is the tank filled, jar or no jar');
  // straight to the cave: the rib off, the tank filled
  game.set('item.backpack', true);   // (items.grant's flag)
  game.set('desert.channel.open', true);
  game.set('desert.pool.tinted', true);
  quests.update(null);
  assert.equal(quests.stage('desert.power'), 'valve', 'the city, the chest, Nour and the way down passed over: the chest by the pool next');
  // the fire's steps can't carry it past the water: a hoverbike found early is no reason to skip the rest
  const g2 = new GameState(memory()), q2 = new Quests({ game: g2 });
  for (const q of QUESTS) q2.define(q);
  q2.start('desert.power');
  g2.set('desert.bike.found', true); g2.set('desert.hearth.seen', true); g2.set('item.gun', 1);
  q2.update(null);
  assert.equal(q2.stage('desert.power'), 'city', 'the Hearth seen before the water is up: the gate (the channel) holds');
  // and nothing past the chest without the backpack it holds: straight to the cave with a bare back, the chest first
  const g3 = new GameState(memory()), q3 = new Quests({ game: g3 });
  for (const q of QUESTS) q3.define(q);
  q3.start('desert.power');
  g3.set('desert.city.entered', true); g3.set('desert.cave.seen', true); g3.set('desert.channel.open', true);
  for (let i = 0; i < 3; i++) q3.update(null);
  assert.equal(q3.stage('desert.power'), 'box', 'the chest on the tree, for the tank');
});
