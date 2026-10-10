// The night mail, played through (src/story/night-train.js, docs/story-bible.md "The night mail"): the Signal Market's
// side quest that takes you aboard the Overnight Train, its sub-level. In node, on the game's own modules (the
// play-through's agent, tests/playthrough-agent.js): the market's halt, Edda and her bell; the train boarded from it,
// running, Ambrose on the porch, Mireille on the last roof; the stop asked for, the halt, the step down; back at the
// halt with the answer. And the saves: a save on the train wakes on the running train with the quest where it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, loadWorld, talkTo, goalOf, standNear, objectiveNow, allInteractables, game, V } from './playthrough-agent.js';
import { Q } from '../src/story/night-train-data.js';
import { RUN } from '../src/levels/overnight-train-run.js';
import { NIGHT_MAIL, FLOOR, WALK, TAIL, car, CARS } from '../src/levels/overnight-train.js';
import { HALT } from '../src/levels/night-halt.js';
import { SUB } from '../src/levels/names.js';

const page = (search) => { globalThis.location = { search }; };
const use = (W, id) => { const e = allInteractables().find((x) => x.id === id); assert.ok(e, `E offers ${id}`); W.at(e.at().clone().setY(W.player.pos.y)); return e; };
/** Where the page would go (src/story/night-train.js travel: game 'travel:page'). */
const listen = () => { const went = []; const off = game.on('travel:page', ({ href }) => went.push(href)); return { went, off }; };

test('the night mail: the market\'s halt, the train boarded from it, Mireille on the last roof, the stop, the step down, the answer home', () => {
  loadSave({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'ship.powered': true }, keepsakes: [] });
  assert.equal(SUB.overnighttrain, 'bazaar');

  // ---------------------------------------------------------------- the Signal Market: the halt past the south gate
  page('?level=bazaar');
  let W = loadWorld('bazaar');
  const H = W.level.nightHalt;
  assert.ok(H && W.level.arrivals?.overnighttrain, 'the market has its night halt, and an arrival there off the train');
  assert.ok(Math.abs(W.physics.groundAt(H.arrival.pos.x, 5, H.arrival.pos.z, 10) - HALT.top) < 0.1, 'the platform stands under the step down');
  assert.ok(W.npcs.some((n) => n.def?.id === 'edda'), 'Edda keeps the lamp');
  assert.ok(!W.quests.isStarted(Q), 'nothing given before you meet her');
  let r = talkTo(W, 'edda', goalOf(W, Q));
  assert.ok(!r.error, r.error);
  assert.equal(W.quests.stage(Q), 'board', 'she gives you the letter and sends you to the bell');
  assert.ok(W.quests.has('letter'));
  let o = objectiveNow(W);
  assert.ok(o.raw && o.raw.position.distanceTo(H.bell) < 1, 'the objective is the bell');
  let L = listen();
  use(W, 'nightmail.bell').use(W.player);
  assert.deepEqual(L.went, ['?level=overnighttrain&from=bazaar'], 'the bell calls the train: the next page is the train, from the halt');
  L.off(); W.dispose();

  // ---------------------------------------------------------------- aboard: pulling out of the halt
  page('?level=overnighttrain&from=bazaar');
  W = loadWorld('overnighttrain');
  assert.equal(W.level.from, 'bazaar');
  assert.ok(W.level.spawn.distanceTo(NIGHT_MAIL.arrival.pos) < 0.01 && W.level.arrivals.bazaar === NIGHT_MAIL.arrival, 'you step aboard on the station-side porch');
  assert.equal(W.level.run.phase, 'leaving', 'the train pulling out of the halt');
  assert.ok(standNear(W, NIGHT_MAIL.arrival.pos, { radius: 0.5, up: 0.4 }), 'the porch is solid under you');
  assert.equal(W.quests.stage(Q), 'find', 'aboard: find Mireille, ask the conductor');
  W.step(60 * 1.5);   // (the train gets going)
  r = talkTo(W, 'ambrose', goalOf(W, Q));
  assert.ok(!r.error, r.error);
  assert.equal(W.quests.stage(Q), 'mireille', 'Ambrose sends you to the roofs of the long tail');
  // Mireille: on the last carriage's roof by the chalk mark, reached by the ladder on the long tail's first porch
  const m = W.npcs.find((n) => n.def?.id === 'mireille');
  assert.ok(m && m.pos.x < TAIL + 6 && m.pos.y > WALK - 0.2, 'Mireille on the last roof');
  assert.ok(standNear(W, m.pos, { radius: 2, up: 0.6 }), 'room to stand by her on the roof');
  const tail = CARS.filter((c) => c.kind === 'coach');
  for (const c of tail) assert.ok(Math.abs(W.physics.groundAt(c.xc, WALK + 3, 0, 5) - WALK) < 0.15, `the roof walk over the long tail (${c.i})`);
  o = objectiveNow(W);
  assert.ok(o.raw && o.raw.position.distanceTo(m.pos) < 1, 'the objective is Mireille');
  W.at(standNear(W, m.pos, { radius: 2, up: 0.6 }).add(V(1.2, 0, 0))); W.step(3);   // (walked up to her: people far off aren't drawn)
  r = talkTo(W, 'mireille', goalOf(W, Q));
  assert.ok(!r.error, r.error);
  assert.equal(W.quests.stage(Q), 'stop', 'she writes her answer');
  assert.ok(W.quests.has('reply') && !W.quests.has('letter'));
  // the stop: Ambrose pulls the cord, the train brakes into the market's halt
  W.at(NIGHT_MAIL.arrival.pos.clone()); W.step(3);   // (back along the roofs and down the ladder to the porch)
  r = talkTo(W, 'ambrose', goalOf(W, Q));
  assert.ok(!r.error, r.error);
  assert.equal(W.quests.stage(Q), 'off');
  assert.ok(game.flag('nightmail.stop'));
  const halt = W.level.plan.halt();
  assert.ok(halt && ['running', 'leaving'].includes(W.level.run.phase), 'a halt planned; still under way for now');
  // not yet: the platform isn't there to step onto
  L = listen();
  const step = use(W, 'nightmail.stepOff');
  step.use(W.player);
  if (W.rt.dialogue.open) W.rt.dialogue.close();
  assert.deepEqual(L.went, [], 'no stepping off a moving train');
  for (let i = 0; i < 200 && W.level.run.phase !== 'halt'; i++) W.step(30);
  assert.equal(W.level.run.phase, 'halt', 'it brakes into the halt');
  assert.ok(Math.abs(W.scene.getObjectByName('The station').position.x) < 1e-6, 'the station beside the carriages');
  use(W, 'nightmail.stepOff').use(W.player);
  assert.deepEqual(L.went, ['?level=bazaar&from=overnighttrain'], 'stepping down: back to the market\'s halt');
  L.off(); W.dispose();

  // ---------------------------------------------------------------- the halt again, with the answer
  page('?level=bazaar&from=overnighttrain');
  W = loadWorld('bazaar');
  assert.equal(W.quests.stage(Q), 'home', 'off the train: bring Edda the answer');
  r = talkTo(W, 'edda', goalOf(W, Q));
  assert.ok(!r.error, r.error);
  assert.ok(W.quests.isDone(Q), 'done');
  assert.ok(!W.quests.has('reply'), 'she keeps it');
  // the bell still calls the train, for a ride of your own
  L = listen();
  use(W, 'nightmail.bell').use(W.player);
  assert.deepEqual(L.went, ['?level=overnighttrain&from=bazaar']);
  L.off(); W.dispose();
  page('');
});

test('a save on the train wakes on the running train, the night mail where it was; the bell needs the letter first', () => {
  loadSave({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, [`quest.${Q}`]: 'mireille', 'item.letter': 1 }, keepsakes: [] });
  page('?level=overnighttrain');
  let W = loadWorld('overnighttrain');
  assert.equal(W.level.from, null);
  assert.equal(W.level.run.phase, 'running', 'running, not waiting at a station');
  assert.equal(W.quests.stage(Q), 'mireille', 'the quest where it was');
  assert.ok(W.npcs.some((n) => n.def?.id === 'mireille') && W.npcs.some((n) => n.def?.id === 'ambrose'));
  W.step(60 * 20);
  assert.equal(W.level.run.phase, 'running', 'still running twenty seconds on: nobody asked it to stop');
  W.dispose();
  // a stop asked and then the game left before the halt: on waking, the train stops again for you
  loadSave({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, [`quest.${Q}`]: 'off', 'item.reply': 1, 'nightmail.stop': true }, keepsakes: [] });
  W = loadWorld('overnighttrain');
  assert.ok(W.level.plan.halt(), 'the stop asked for is kept');
  W.dispose();
  // in the market without the letter, the bell is only a bell
  loadSave({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] });
  page('?level=bazaar');
  W = loadWorld('bazaar');
  const L = listen();
  use(W, 'nightmail.bell').use(W.player);
  if (W.rt.dialogue.open) W.rt.dialogue.close();
  assert.deepEqual(L.went, [], 'nothing calls the train before Edda has asked you');
  L.off(); W.dispose();
  page('');
});
