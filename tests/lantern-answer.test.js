// The Lantern's last stretch (v1.47, issue #97; src/story/lantern.js): over the sand bar to the island, then the
// light's song: it sings to the keepers' three lamps in turn, and a whistle by each (nothing in hand) lights it. With
// the third Ilen comes out of her house to the lantern's step, and the talk is the meeting, as before.
import test from 'node:test';
import assert from 'node:assert/strict';

const A = await import('./playthrough-agent.js');
const { game, V } = A;
const { LAMPS, ANSWER, QUESTS } = await import('../src/story/lantern-data.js');
const Q = 'lantern.ilen';
const SAVE = { flags: { 'prologue.done': true, 'ending.done': true, 'world.bazaar.done': true, 'item.backpack': true }, keepsakes: [] };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('three stages: the bar, the light’s song, Ilen; the song is a goal you reach, one line', () => {
  const st = QUESTS[0].stages;
  assert.deepEqual(st.map((s) => s.id), ['bar', 'answer', 'ilen']);
  for (const s of st) assert.ok(s.text.length < 70 && !/\.\s/.test(s.text), `${s.id}: one line`);
  assert.equal(st[1].flag, 'lantern.answered');
  assert.equal(LAMPS.length, 3);
});

test('the light’s song answered lamp by lamp, then Ilen comes out to the step', () => {
  A.loadSave(SAVE);
  const W = A.loadWorld('lantern');
  const rt = W.world, ilen = rt.people.ilen;
  assert.equal(W.quests.stage(Q), 'bar', 'the bar first');
  assert.equal(ilen.object.visible, false, 'she is indoors until someone answers');
  // the island: the light comes down (the moment), and the song begins
  W.at(W.level.lantern.spots.isle); W.step(30 * 12);
  assert.equal(W.quests.stage(Q), 'answer');
  const lamp = W.quests.locators.get('lamp');
  assert.ok(flat(lamp(), V(...[LAMPS[0][0], 0, LAMPS[0][1]])) < 0.5, 'the drone finds the first lamp');
  // a whistle far from any lamp does nothing
  game.emit('whistle', { pos: W.level.lantern.spots.step.clone() });
  assert.ok(!game.flag('lantern.lamp.0'));
  // by each, in turn: the bell answers as well as a whistle
  for (let i = 0; i < LAMPS.length; i++) {
    const at = lamp();
    assert.ok(flat(at, V(LAMPS[i][0], 0, LAMPS[i][1])) < 0.5, `the light sings to lamp ${i}`);
    W.at(at.clone().add(V(ANSWER.reach * 0.6, 0, 0))); W.step(2);
    game.emit(i === 1 ? 'bell' : 'whistle', { pos: W.player.pos.clone() });
    assert.ok(game.flag(`lantern.lamp.${i}`), `lamp ${i} lit`);
    W.step(5);
  }
  assert.ok(game.flag('lantern.answered'));
  W.step(30 * 14);
  assert.equal(W.quests.stage(Q), 'ilen', 'then her');
  assert.ok(ilen.object.visible, 'she has come out');
  assert.ok(flat(ilen.pos, W.level.lantern.spots.ilen) < 2.5, `at the lantern’s step (${flat(ilen.pos, W.level.lantern.spots.ilen).toFixed(1)} m off)`);
});

test('a save from before: met her already, or at her stage, finds her on the step', () => {
  A.loadSave({ ...SAVE, flags: { ...SAVE.flags, 'quest.lantern.ilen': 'ilen', 'met.ilen': true } });
  const W = A.loadWorld('lantern');
  assert.equal(W.quests.stage(Q), 'ilen');
  assert.ok(W.world.people.ilen.object.visible);
});
