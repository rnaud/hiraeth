import test from 'node:test';
import assert from 'node:assert/strict';

// "A quest completes when you reach its goal directly" (the author's standing rules; the v1.49 level design audit, issue
// #137): in the Moon Foundry, the City Floating in Space and the Underwater City each errand is done where its goal is,
// with nobody to report to after. Played on the worlds as main.js builds them (tests/playthrough-agent.js loadWorld):
// the count at the pillar's lookout (before Wen asked, too), the ladle-hook on the last furnace's crane, Sel's notes on
// the cables under the Towers, the kelp cutting up in the Crown. The people they named say their word when you pass.

const A = await import('./playthrough-agent.js');
const { game } = A;
const { ROUTE } = await import('./playthrough-worlds.js');

/** A fresh save in `id`, the traveller at the ship; `before` flags set first (a quest started, its thing in hand). */
function fresh(id, before = {}) {
  A.loadSave({ flags: { 'prologue.done': true, 'charge.given': true, 'charge.card': true, ...before }, keepsakes: [] });
  const W = A.loadWorld(id);
  W.step(2);
  return W;
}
/** Stand by a quest locator (where the climb or the walk comes out) and let the world run. */
function standBy(W, name, o) {
  const at = A.objectiveAt(W, name);
  assert.ok(at, `${W.id}: no ${name}`);
  const s = A.standNear(W, at, o);
  assert.ok(s, `${W.id}: nowhere to stand by ${name}`);
  W.at(s); W.step(4);
}
/** The node a person's talk opens on now. */
const opensOn = (W, id) => {
  const e = A.allInteractables().find((x) => x.id === `talk.${id}`);
  assert.ok(e, `nobody to talk to: ${id}`);
  e.use(W.player);
  const node = W.rt.dialogue.runner?.nodeId;
  W.rt.dialogue.close();
  return node;
};

test('the Moon Foundry: the count is done at the lookout, Wen asked or not; Petra is no step', () => {
  const W = fresh('moonfoundry');
  try {
    assert.equal(W.quests.isStarted('moonfoundry.count'), false, 'nobody has asked');
    standBy(W, 'lookout', { radius: 6, up: 3 });
    assert.equal(W.quests.isDone('moonfoundry.count'), true, 'up on the lookout, the moons counted: done');
    assert.ok(W.toasts.some((t) => /thirty-two/i.test(String(t))), 'the count said up there');
    assert.ok(!W.quests.def('moonfoundry.count').stages.some((s) => s.talk || s.at === 'ilse'), 'no step at Petra');
    assert.equal(opensOn(W, 'wen'), 'counted', 'Wen has her word on it when you pass');
  } finally { W.dispose(); }
  // asked first, the same: the lookout is where it ends
  const W2 = fresh('moonfoundry', { 'quest.moonfoundry.count': 'climb' });
  try {
    standBy(W2, 'lookout', { radius: 6, up: 3 });
    assert.equal(W2.quests.isDone('moonfoundry.count'), true);
  } finally { W2.dispose(); }
});

test('the Moon Foundry: the ladle-hook is done on the last furnace’s crane, without Bertil', () => {
  const W = fresh('moonfoundry', { 'quest.moonfoundry.hook': 'crane', 'item.ladlehook': 1 });
  try {
    standBy(W, 'crane', { radius: 5, up: 3 });
    assert.equal(W.quests.isDone('moonfoundry.hook'), true, 'at the crane: hung, done');
    assert.equal(W.quests.has('ladlehook'), false, 'the hook is on the crane, not in the bag');
    assert.equal(opensOn(W, 'bertil'), 'hook', 'Bertil thanks you when you pass');
  } finally { W.dispose(); }
});

test('the City Floating in Space: Sel’s notes are done on the cables under the Towers, without Ines', () => {
  const W = fresh('spacecity', { 'quest.spacecity.notes': 'cables', 'item.selnotes': 1 });
  try {
    standBy(W, 'towerCables', { radius: 3, up: 2 });
    const e = A.bestInteractable(W.player)?.entry;
    assert.equal(e?.id, 'towerCables', 'E by the cables');
    e.use(W.player);
    A.converse(W, A.goalOf(W, 'spacecity.notes'));
    W.step(2);
    assert.equal(W.quests.isDone('spacecity.notes'), true, 'laid on the cable: done');
    assert.equal(W.quests.has('selnotes'), false);
    // (and that is a hand on the cables too: Rosa's quest, not yet opened, starts past them)
    assert.equal(W.quests.stage('spacecity.drift'), 'house', 'the cables felt, before Rosa asked');
  } finally { W.dispose(); }
});

test('the Underwater City: the kelp cutting is done up in the Crown, without Fabre; his word to Maelle is no quest', () => {
  const W = fresh('underwater', { 'quest.underwater.kelp': 'lift', 'item.kelpcutting': 1 });
  try {
    const lift = W.level.portals?.find((pt) => /up to the Crown/.test(pt.label ?? ''));
    assert.ok(lift, 'the lift in the column');
    W.at(lift.at.clone()); W.step(3);
    W.at(lift.to.clone()); W.step(3);
    assert.equal(W.quests.isDone('underwater.kelp'), true, 'up in the Crown: in the window box, done');
    assert.equal(W.quests.has('kelpcutting'), false);
    assert.equal(opensOn(W, 'fabre'), 'cutting', 'Fabre thanks you when you pass');
    assert.equal(W.quests.def('underwater.lamps'), undefined);
  } finally { W.dispose(); }
});

test('the route through these worlds has no more than two talks in a row (the Moon Foundry ran four, issue #137)', () => {
  for (const id of ['moonfoundry', 'spacecity', 'underwater']) {
    const W = fresh(id);
    try {
      const people = new Set(W.npcs.map((n) => n.def?.id).filter(Boolean));
      const kinds = [], met = new Set();
      for (const p of ROUTE.find((r) => r.id === id).play) {
        if (p.act && p.at) { met.add(p.at); kinds.push(people.has(p.at) ? `talk ${p.at}` : 'do'); continue; }
        if (typeof p !== 'string') { kinds.push('temple'); continue; }
        for (const [i, s] of W.quests.def(p).stages.entries()) {
          if (i === 0 && met.has(s.at ?? s.talk)) continue;   // (opened by an act before it)
          kinds.push(s.talk || people.has(s.at) ? `talk ${s.at ?? s.talk}` : 'goal');
        }
      }
      let run = 0, most = 0;
      for (const k of kinds) { run = k.startsWith('talk') ? run + 1 : 0; most = Math.max(most, run); }
      assert.ok(most <= 2, `${id}: ${kinds.join(' › ')}`);
    } finally { W.dispose(); }
  }
});
