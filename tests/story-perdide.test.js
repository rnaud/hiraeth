import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createPerdide, GREAT, BED, ISLE, CAVE, PERDIDE_CONTENT } = await import('../src/levels/perdide.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS, LANDING } = await import('../src/story/perdide-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');
const { CONTENT, ERRANDS } = await import('../src/levels/content.js');

game.reset();
const scene = new THREE.Scene();
const level = createPerdide(scene);
const terrain = level.ground;
const physics = new Physics(scene, terrain);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, critter() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = spawnNPCs(scene, physics, CONTENT.perdide.npcs);
const rt = createStory({ levelId: 'perdide', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); level.update(dt, clock, { player }); } };
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
  // and room to stand: nothing at chest height right on top of them
  assert.ok(physics.rayDistance(V(p.x, g + 0.3, p.z), V(0, 1, 0), 1.6) > 1.55, `${label} has headroom`);
  return g;
};
// on-foot reachability from the spawn over wadeable ground (a 2 m grid)
const reachable = (() => {
  const S = 2, R = 300, N = (2 * R) / S + 1, ok = (i, j) => terrain.heightAt(-R + i * S, -R + j * S) > -1.45;
  const seen = new Uint8Array(N * N), q = [((R / S) | 0) * N + ((R / S) | 0)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % N, j = (c / N) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N || seen[nj * N + ni] || !ok(ni, nj)) continue; seen[nj * N + ni] = 1; q.push(nj * N + ni); }
  }
  return (x, z) => { for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) { const i = Math.round((x + dx + R) / S), j = Math.round((z + dz + R) / S); if (seen[j * N + i]) return true; } return false; };
})();

test('the swamp’s people and places stand on walkable or wadeable ground', () => {
  assert.equal(CONTENT.perdide, PERDIDE_CONTENT);
  assert.deepEqual(CONTENT.perdide.npcs.map((n) => n.id), ['wendel', 'sedge', 'ivo']);
  for (const n of npcs) for (const p of n.route) stand(p, n.def.name);
  for (const id of ['saba', 'corm', 'ysse']) { const n = W.people[id]; for (const p of n.route) stand(p, n.def.name); }
  stand(W.places.heart, 'the cave’s heart');
  stand(W.places.splinterAt, 'the splinter');
  stand(W.places.hushAt, 'the root stone');
  stand(V(BED.x, terrain.heightAt(BED.x, BED.z), BED.z), 'the snapping bed');
  stand(level.nest, 'the fireflies’ nest');
  // the cave's heart is under its vault
  assert.ok(physics.rayDistance(W.places.heart.clone().add(V(0, 1, 0)), V(0, 1, 0), 40) < 20, 'the heart is inside the cave');
  // the crystal is a walk (through the ford); the cave island and the fireflies' isle need the skiff
  assert.ok(reachable(W.places.sabaAt.x, W.places.sabaAt.z), 'you can walk to Saba');
  assert.ok(reachable(BED.x, BED.z), 'and to the snapping bed');
  assert.ok(!reachable(CAVE.x, CAVE.z) && !reachable(ISLE.x, ISLE.z), 'the cave island and the isle are across deep water');
  // the fireflies fly over the water from Ivo to the nest
  const route = W.places.route;
  assert.ok(route.length >= 4 && route.at(-1).distanceTo(level.nest) < 3);
  // relics: none under water any more
  for (const s of PERDIDE_CONTENT.relics.spots) {
    const [x, z] = Array.isArray(s) ? s : [s.at[0], s.at[2]];
    assert.ok(terrain.heightAt(x, z) > -0.5, `relic at ${x},${z} is above the water`);
  }
  // the errands still find their people: the egg-warden takes the seed, Ivo gives the crystal
  assert.equal(ERRANDS.find((e) => e.id === 'seed').to[1], 0);
  assert.equal(ERRANDS.find((e) => e.id === 'crystal').from[1], 2);
});

test('side quest: feed nothing to the plants', () => {
  talk(LANDING[0], ['Why keep the plants hungry?', 'What do you mean, the patient?']);
  assert.equal(quests.stage('perdide.patience'), 'bed');
  const bedAt = V(BED.x, terrain.heightAt(BED.x, BED.z), BED.z);
  at(bedAt); step(3);
  assert.equal(quests.stage('perdide.patience'), 'wait');
  // the plants snap at you at first
  step(30);
  const bed = level.plants.filter((p) => p.bed);
  assert.equal(bed.length, 5);
  assert.ok(bed.some((p) => p.open < 0.3), 'the bed snaps at you');
  // feeding one resets the test
  step(30 * 8);
  assert.ok(W.patience.t > 7);
  const plantT = level.targets.find((t) => t.kind === 'plant' && t.position() === bed[0].pos);   // (the tool registers the level's targets)
  plantT.onHit('shoot');
  step(2);
  assert.ok(W.patience.t < 0.5, 'a splash of fluid starts it again');
  step(30 * 21);
  assert.equal(game.flag('perdide.patience.kept'), true);
  assert.equal(level.tame, true, 'the plants know you now');
  step(30);
  assert.ok(bed.every((p) => p.open > 0.6), 'the jaws lie open while you stand among them');
  assert.equal(quests.stage('perdide.patience'), 'tell');
  talk(LANDING[0], []);
  assert.equal(quests.isDone('perdide.patience'), true);
  assert.ok(game.keepsakes().some((k) => k.id === 'perdide.word'), 'Wendel’s saying');
  talk(PEOPLE.corm, []);
});

test('the main quest: the crystal sings the song of the light that struck the ship', async () => {
  assert.equal(quests.stage('perdide.crystal'), 'wendel');
  talk(LANDING[0], ['Something is humming']);
  step(2);
  assert.equal(quests.stage('perdide.crystal'), 'cross');
  at(W.places.sabaAt.clone().add(V(1.5, 0, 0))); step(2);
  assert.equal(quests.stage('perdide.crystal'), 'saba');
  talk(PEOPLE.saba, ['Why does it sing?', 'Calling what?', 'I carry water', 'What’s carved', 'My ship has that mark']);
  step(2);
  assert.equal(quests.stage('perdide.crystal'), 'sing');
  // three splashes on the spires, close together: it sings, and every jaw shuts
  const crystal = allTargets().find((t) => t.kind === 'crystal');
  assert.ok(crystal?.enabled(), 'the crystal is a target from its foot');
  crystal.onHit('shoot'); step(10);
  crystal.onHit('shoot'); step(10);
  assert.equal(game.flag('perdide.crystal.sung'), undefined, 'two are not enough');
  crystal.onHit('shoot');
  step(30 * 6);
  assert.ok(level.silence > 0.85, 'the plants fall silent');
  assert.ok(level.plants.filter((p) => !p.bed).every((p) => p.open < 0.5), 'every jaw in the swamp shuts');
  assert.equal(game.flag('perdide.crystal.sung'), true);
  step(2);
  assert.equal(quests.stage('perdide.crystal'), 'listen');
  // the clue: the song is the singing light's
  talk(PEOPLE.saba, ['I’ve heard it before', 'What should I do']);
  assert.equal(game.flag('perdide.clue.ship'), true);
  step(2);
  assert.equal(quests.stage('perdide.crystal'), 'splinter');
  at(W.places.splinterAt);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'splinter');
  e.entry.use(player);
  assert.ok(quests.has('splinter'));
  step(2);
  assert.equal(quests.stage('perdide.crystal'), 'cave');
  // the song fades; the jaws open again
  step(30 * 60, 1 / 10);
  assert.ok(level.silence < 0.1, 'the song ends');
  // the cave's heart: hold the splinter up, the walls answer, the tank takes the crystal's colour
  talk(PEOPLE.ysse, ['Is there anywhere else like this?']);
  assert.equal(game.flag('clue.perdide.perdide2'), true, 'Ysse points to the deep wood');
  at(W.places.heart.clone().add(V(1, 0, 0)));
  assert.equal(bestInteractable(player)?.entry.id, 'heart');
  const refills = [];
  game.on('tool:refill', (x) => refills.push(x));
  talk(THINGS.heart, [0]);
  assert.deepEqual(refills.map((x) => [x.addColour, x.tone]), [[true, '#c7a6f2']], 'the tank takes a crystal-violet band');
  step(2);
  assert.equal(quests.isDone('perdide.crystal'), true);
  assert.equal(game.flag('world.perdide.done'), true);
  const k = game.keepsakes().find((x) => x.id === 'perdide.thing');
  assert.ok(k && k.kind === 'thing', 'the keepsake: a singing splinter');
  assert.ok(quests.has('splinter'), 'you keep the splinter');
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone, 'the quest closes the story page');
});

test('side quest: follow the fireflies to their nest, and tell Ivo', () => {
  talk(LANDING[2], ['I’ll follow them.']);
  assert.equal(quests.stage('perdide.fireflies'), 'follow');
  // they wait for you, then fly on while you keep up (over the water, on the skiff)
  const start = W.swarm.c.clone();
  at(V(200, 0, 200)); step(60);
  assert.ok(W.swarm.c.distanceTo(start) < 1, 'they wait when you are far');
  for (let i = 0; i < 2000 && !game.flag('perdide.fireflies.home'); i++) { at(W.swarm.c.clone().setY(0.5)); step(1); }
  assert.equal(game.flag('perdide.fireflies.home'), true);
  rt.dialogue.close();
  step(2);
  assert.equal(quests.stage('perdide.fireflies'), 'ivo');
  talk(LANDING[2], ['Home.']);
  assert.equal(quests.isDone('perdide.fireflies'), true);
  assert.ok(quests.has('jar'));
  talk(LANDING[0], ['Tell me about the eggs.']);
  clearInteractables();
});
