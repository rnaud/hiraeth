import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState } from '../src/game-state.js';
import { Quests } from '../src/story/quests.js';
import { nextObjective, findText, viaPortal } from '../src/scout.js';
import { placeOf, Companion } from '../src/companion.js';
const V = (x, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function fixture(storage = null) {
  const game = new GameState(storage), quests = new Quests({ game });
  quests.define({ id: 'arrival', main: true, stages: [{ id: 'meet', text: 'Meet Sister Aube at the hermitage', at: 'aube' }] });
  quests.locate('aube', () => V(100));
  quests.opensWith('arrival', 'aube', { hint: 'Someone by the smoke', knownWhen: () => game.flag('heard.aube.location') === true });
  const scout = () => nextObjective({ player: { pos: V(0) }, level: {}, quest: () => quests.objective() });
  return { game, quests, scout };
}
test('fresh arrival directions conceal catalogue identity without changing the destination or progress', () => {
  const { game, quests, scout } = fixture(), before = JSON.stringify(game.data);
  const original = quests.objective(), target = scout();
  assert.equal(target.id, original.id);
  assert.deepEqual(target.position, original.position);
  assert.equal(findText(target, 100), 'Someone by the smoke · 100 m');
  assert.equal(placeOf(target.label), 'Someone by the smoke', 'lost bark retains the useful observed description');
  assert.equal(quests.isStarted('arrival'), false);
  assert.equal(JSON.stringify(game.data), before, 'asking never grants knowledge or progression');
});
test('world visitation and an unrelated meeting cannot unlock a named hint', () => {
  const { game, scout } = fixture();
  game.set('world.arzach2.visited', true); game.set('met.someone', true);
  assert.equal(scout().label, 'Someone by the smoke');
});
test('accepted quest keeps its learned directions, including existing saves', () => {
  const { game, quests, scout } = fixture();
  game.set('quest.arrival', 'meet');
  assert.equal(quests.isStarted('arrival'), true);
  assert.equal(scout().label, 'Meet Sister Aube at the hermitage');
});
test('earned names survive opener and giver metadata, Scout resolution and a real saved-state reload', () => {
  const records = new Map(), storage = { getItem: (k) => records.get(k) ?? null, setItem: (k, v) => records.set(k, v) };
  const first = fixture(storage);
  assert.equal(first.scout().label, 'Someone by the smoke');
  first.game.set('heard.aube.location', true);
  assert.equal(first.scout().label, 'Meet Sister Aube at the hermitage');
  const loaded = fixture(storage);
  assert.equal(loaded.scout().label, 'Meet Sister Aube at the hermitage');
  assert.equal(loaded.quests.isStarted('arrival'), false, 'learning a name does not silently start its quest');
  loaded.quests.define({ id: 'side', stages: [{ id: 'hear', text: 'A hidden vault' }] });
  loaded.quests.locate('guide', () => V(20));
  loaded.quests.givenBy('side', 'guide', { rank: 0, label: 'Mira by the vault', hint: 'Someone by a gate',
    knownWhen: () => loaded.game.flag('heard.mira.location') === true });
  assert.equal(loaded.scout().label, 'Someone by a gate');
  loaded.game.set('heard.mira.location', true);
  loaded.game.reload();
  assert.equal(loaded.scout().label, 'Mira by the vault');
  assert.equal(loaded.scout().id, 'giver-guide');
  assert.deepEqual(loaded.scout().position, V(20));
});
test('lost guidance retains an observable description without inventing the name', () => {
  const { game, scout } = fixture();
  game.set('drone.said.pointer', true);
  const companion = new Companion({ state: game });
  for (const why of ['still', 'away', 'circling']) {
    const line = companion.lostLine(why, placeOf(scout().label));
    assert.match(line, /Someone by the smoke/);
    assert.doesNotMatch(line, /Aube|hermitage/);
  }
});
test('unopened side-quest givers use the same safe directions', () => {
  const { quests } = fixture();
  quests.define({ id: 'side', stages: [{ id: 'hear', text: 'Find the hidden vault' }] });
  quests.locate('guide', () => V(20));
  quests.givenBy('side', 'guide', { rank: 0, label: 'Mira at the hidden vault' });
  const g = quests.giverObjective(quests.leadGiver());
  assert.equal(g.id, 'giver-guide'); assert.equal(g.hintLabel, 'Someone to talk to');
  assert.deepEqual(g.position, V(20));
});
test('portal routing cannot leak the name of an unknown destination', () => {
  const target = { id: 'opener-arrival', label: 'Someone by the smoke', unidentified: true, position: V(1000) };
  const portal = { at: V(2), to: V(990), label: 'Aube’s hidden hermitage' };
  const routed = viaPortal(V(0), target, [portal]);
  assert.equal(routed.id, 'portal-0-opener-arrival');
  assert.equal(routed.label, 'Through the doorway');
  assert.deepEqual(routed.position, portal.at);
  assert.match(viaPortal(V(0), { ...target, unidentified: false }, [portal]).label, /Aube/);
});
