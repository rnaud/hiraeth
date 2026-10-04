import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createPerdide2, PERDIDE2_CONTENT, DARK_POOLS, CAVE } = await import('../src/levels/perdide2.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS, KEEPERS } = await import('../src/story/perdide2-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
const scene = new THREE.Scene();
const level = createPerdide2(scene);
const terrain = level.ground;
const physics = new Physics(scene, terrain);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, critter() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = spawnNPCs(scene, physics, CONTENT.perdide2.npcs);
const rt = createStory({ levelId: 'perdide2', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
const talk = (person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (!r.lastPage) r.advance();
    const pick = r.choices().find((x) => (typeof c === 'number' ? x.index === c : x.text.startsWith(c)));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const stand = (p, label) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 1.2, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
  assert.ok(terrain.heightAt(p.x, p.z) > -1.4 && !level.unsafe(V(p.x, g, p.z)), `${label} is not in deep water`);
  assert.ok(physics.rayDistance(V(p.x, g + 0.3, p.z), V(0, 1, 0), 1.6) > 1.55, `${label} has headroom`);
  return g;
};
const reachable = (() => {
  const S = 2, R = 500, N = (2 * R) / S + 1, ok = (i, j) => terrain.heightAt(-R + i * S, -R + j * S) > -1.45;
  const seen = new Uint8Array(N * N), q = [((R / S) | 0) * N + ((R / S) | 0)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % N, j = (c / N) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N || seen[nj * N + ni] || !ok(ni, nj)) continue; seen[nj * N + ni] = 1; q.push(nj * N + ni); }
  }
  return (x, z) => { for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) { const i = Math.round((x + dx + R) / S), j = Math.round((z + dz + R) / S); if (seen[j * N + i]) return true; } return false; };
})();

test('the deep wood’s people and places stand on walkable or wadeable ground', () => {
  assert.equal(CONTENT.perdide2, PERDIDE2_CONTENT);
  assert.deepEqual(CONTENT.perdide2.npcs.map((n) => n.id), ['hollin', 'pim', 'bram']);
  assert.ok(PERDIDE2_CONTENT.story.manual, 'the quest closes the story page, not the beacon');
  for (const n of npcs.slice(0, 3)) for (const p of n.route) stand(p, n.def.name);   // the level's own (the story's are pushed after them)
  for (const p of W.people.wick.route) stand(p, 'Wick');
  // Fen stands on his landing stage, a raft moored on the deep water: dry, above the water line
  for (const p of W.people.fen.route) {
    const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
    assert.ok(Math.abs(g - p.y) < 0.2 && g > 0.5 && !level.unsafe(V(p.x, g, p.z)), `Fen stands on the raft (${g.toFixed(2)})`);
    assert.ok(level.fenLanding.distanceTo(V(p.x, 0.6, p.z)) < 3.4, 'on the raft');
  }
  stand(W.places.hollinEnd, 'Hollin’s place at the cave');
  // the dark pools sit on the path's dry bank, a walk from the island
  for (const D of DARK_POOLS) {
    assert.ok(terrain.heightAt(D.x, D.z) > 0, `dark pool at ${D.x.toFixed(0)},${D.z.toFixed(0)} is on dry ground`);
    assert.ok(reachable(D.x, D.z), 'and you can walk there');
  }
  // the latch is up on the glass dome's roof
  assert.ok(W.places.latchAt.y - terrain.heightAt(W.places.latchAt.x, W.places.latchAt.z) > 5, 'the latch is on the big roof');
  // the saucer and Fen's dome are across deep water: the skiff's
  assert.ok(!reachable(W.places.saucerAt.x, W.places.saucerAt.z), 'the saucer is out on the deep water');
  assert.ok(!reachable(W.places.fenAt.x, W.places.fenAt.z), 'Fen is out on the deep water');
  assert.ok(reachable(W.places.hollinEnd.x, W.places.hollinEnd.z), 'the cave mouth is a walk');
});

test('side quest: Pim’s latch from the big roof', () => {
  talk(KEEPERS[1], ['Why not?', 'I’ll fetch it.']);
  assert.equal(quests.stage('perdide2.latch'), 'find');
  at(W.places.latchAt);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'latch');
  e.entry.use(player);
  assert.equal(quests.stage('perdide2.latch'), 'return');
  talk(KEEPERS[1], []);
  assert.equal(quests.isDone('perdide2.latch'), true);
  assert.ok(quests.has('lamp') && !quests.has('latch'));
  assert.ok(level.domeDoors[0].warm, 'Pim’s door glows warm');
});

test('the main quest: three pools relit, the saucer answers, Hollin asks you to come back', async () => {
  assert.equal(quests.stage('perdide2.lamps'), 'hollin');
  talk(KEEPERS[0], ['Why light pools', 'The Welcome?', 'I’ve seen that mark', 'And the two travellers?', 'I’ll light them.']);
  step(2);
  assert.equal(quests.stage('perdide2.lamps'), 'pools');
  assert.match(quests.objective().label, /0 of 3/);
  // walking the path, the keepers brighten the pools near you
  at(V(DARK_POOLS[0].x, terrain.heightAt(DARK_POOLS[0].x, DARK_POOLS[0].z), DARK_POOLS[0].z).add(V(0, 0, 6)));
  step(30);
  assert.ok(level.poolList.some((e) => e.k > 0.3), 'pools near you brighten');
  const targets = allTargets().filter((t) => t.kind === 'pool');
  assert.equal(targets.length, 3);
  // a push only ripples it; a shot lights it
  targets[0].onHit('push');
  assert.equal(game.flag('perdide2.pools.lit'), undefined);
  for (const [i, T] of targets.entries()) {
    const D = DARK_POOLS[i];
    at(V(D.x, terrain.heightAt(D.x, D.z), D.z).add(V(4, 0, 4)));
    assert.ok(T.enabled(), `pool ${i} can be hit`);
    T.onHit('shoot');
    assert.equal(game.flag('perdide2.pools.lit'), i + 1);
    assert.ok(!T.enabled(), 'once lit it stays lit');
    if (i === 1) talk(PEOPLE.wick, ['What happened the night']);
  }
  assert.equal(game.flag('perdide2.rumour.light'), true, 'Wick saw the singing light');
  step(2);
  assert.equal(quests.stage('perdide2.lamps'), 'answer');
  assert.equal(game.flag('perdide2.saucer.answered'), true, 'the saucer blinks back');
  // out to the saucer on the skiff: the look works while riding
  player.riding = true;
  at(W.places.saucerAt.clone().add(V(7, 0.3, 0)));
  assert.equal(bestInteractable(player, { riding: true })?.entry.id, 'saucer');
  talk(THINGS.saucer, [0]);
  player.riding = false;
  assert.equal(game.flag('clue.perdide2.edena'), true, 'the clue: their lifeboat, a garden of white pyramids');
  step(2);
  assert.equal(quests.stage('perdide2.lamps'), 'tell');
  // Hollin has walked down to the cave while you were away
  assert.ok(W.people.hollin.pos.distanceTo(W.places.hollinEnd) < 0.5, 'Hollin waits at the root cave');
  assert.ok(quests.objective().position.distanceTo(W.places.hollinEnd) < 0.5);
  at(W.places.hollinEnd.clone().add(V(2, 0, 0)));
  talk(KEEPERS[0], ['Two couches', 'I’ll come back.']);
  step(2);
  assert.equal(quests.isDone('perdide2.lamps'), true);
  assert.equal(game.flag('world.perdide2.done'), true);
  const k = game.keepsakes().find((x) => x.id === 'perdide2.person');
  assert.ok(k && k.kind === 'person', 'the keepsake: a promise to Hollin');
  step(30 * 6);
  assert.ok(level.poolList.every((e) => e.k > 0.9), 'every pool on the path is lit for you');
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone, 'the quest closes the story page');
});

test('side quest: whose skiff? Fen in the far dome', () => {
  talk(KEEPERS[2], ['Whose skiff']);
  assert.equal(quests.stage('perdide2.skiff'), 'owner');
  assert.ok(quests.objective() !== null);
  talk(PEOPLE.fen, ['It’s yours?', 'Where did they go?', 'Do you want your skiff back?']);
  assert.equal(quests.isDone('perdide2.skiff'), true);
  assert.equal(game.flag('perdide2.fen.told'), true);
  talk(PEOPLE.fen, []);
  clearInteractables();
});
