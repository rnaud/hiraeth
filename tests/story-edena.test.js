import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { isIndoors } from '../src/shelter.js';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const warn = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('toNonIndexed')) warn(...a); };

const { createEdena, TALL_TREE } = await import('../src/levels/edena.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS } = await import('../src/story/edena-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { CONTENT, ERRANDS } = await import('../src/levels/content.js');

game.reset();
clearInteractables(); clearTargets();
const scene = new THREE.Scene();
const level = createEdena(scene);
const physics = new Physics(scene, level.ground);
const E = level.edena, S = E.crashed;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = spawnNPCs(scene, physics, CONTENT.edena.npcs);
const rt = createStory({ levelId: 'edena', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
const talk = (person, choices) => {
  quests.opening(person.id);   // (as Dialogue.start does: the world's opening quest starts with its first talk)
  const r = new DialogueRunner(person, { game, quests });
  while (r.advance());
  for (const c of choices) {
    const pick = r.choices().find((x) => (typeof c === 'number' ? x.index === c : x.text.startsWith(c)));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const target = (kind) => allTargets().find((t) => t.kind === kind);
const stand = (p, label, tol = 1.2) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < tol, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
};

test('the gardeners stand on walkable ground; the errands still find Mira and Lio', () => {
  const W = rt.world.people;
  for (const id of ['mira', 'sol', 'oro', 'lio', 'vey']) assert.ok(W[id], `${id} is in the garden`);
  for (const [id, n] of Object.entries(W)) for (const [k, p] of n.route.entries()) {
    stand(p, `${id}'s route point ${k}`);
    assert.ok(physics.groundNormal(p.x, p.y + 1, p.z).y > 0.8, `${id} stands on gentle ground`);
  }
  // errands deliver to the first person and start from the fourth (src/levels/content.js)
  assert.equal(CONTENT.edena.npcs[0].id, 'mira');
  assert.equal(CONTENT.edena.npcs[3].id, 'lio.edena');
  assert.ok(ERRANDS.some((e) => e.to[0] === 'edena' && e.to[1] === 0) && ERRANDS.some((e) => e.from[0] === 'edena' && e.from[1] === 3));
});

test('the hatch is in the hull itself, open meadow in front of it, and the cabin is reachable through it', () => {
  // (players saw the old doorway standing a few metres out from the ship): the hull is right behind the threshold
  const into = new THREE.Vector3(-Math.sin(S.hatchHeading), 0, -Math.cos(S.hatchHeading));
  for (const h of [0.6, 1.5, 2.5]) {
    const d = physics.rayDistance(S.hatch.clone().add(new THREE.Vector3(0, h, 0)), into, 10);
    assert.ok(d < 1.6, `the hull ${d.toFixed(2)} m behind the threshold, ${h} m up`);
  }
  // the ground in front of the doorway is open meadow (nothing of the hull over it)
  for (let d = 1.5; d <= 6; d += 1.5) {
    const x = S.hatch.x + Math.sin(S.hatchHeading) * d, z = S.hatch.z + Math.cos(S.hatchHeading) * d;
    const g = physics.groundAt(x, S.hatch.y + 30, z, 60);
    assert.ok(Math.abs(g - level.ground.heightAt(x, z)) < 0.3, `open ground ${d} m out from the hatch (${g.toFixed(2)})`);
  }
  const [inn, outp] = level.portals.filter((p) => !p.temple);   // (the ship's hatch: the Greenhouse's doorways come first)
  assert.ok(inn.at.distanceTo(S.hatch) < 1 && inn.to.y > 1400, 'the doorway leads up into the cabin');
  assert.ok(outp.to.distanceTo(S.hatch) < 4, 'and back out');
  stand(S.panel, 'the cabin floor by the cockpit panel', 0.4);
  // and it never rains in it (players saw the rain fall in the cabin)
  assert.ok(isIndoors(S.panel.clone().add(new THREE.Vector3(0, 1.6, 0))) && isIndoors(S.room.inside.clone().add(new THREE.Vector3(0, 1.6, 0))), 'the cabin is indoors');
  assert.ok(!isIndoors(S.hatch.clone().add(new THREE.Vector3(0, 1.6, 0))), 'the meadow by the hatch is not');
});

test('the main quest: the fallen ship, the log, the flowers drawn aside, the same mark', async () => {
  const Q = 'edena.garden';
  // it doesn't just appear: it waits for its first talk, and till then the scout finds who to ask
  assert.equal(quests.stage(Q), undefined);
  assert.equal(quests.openerObjective()?.id, `opener-${Q}`);
  talk(PEOPLE.mira, ['Twice?', 'Can I see it?']);
  step(2);
  assert.equal(quests.stage(Q), 'ship');
  at(quests.where(quests.current(Q))); step(2);
  assert.equal(quests.stage(Q), 'vey');
  talk(PEOPLE.vey, ['Mira said']);
  step(2);
  assert.equal(quests.stage(Q), 'inside');
  // a shove at the flowers only closes them (and Vey notices)
  const veil = target('veil');
  assert.ok(veil.enabled());
  veil.onHit('push');
  assert.equal(game.flag('edena.veil.open'), undefined);
  assert.equal(game.flag('edena.veil.pushed'), true);
  veil.onHit('shoot');
  assert.equal(game.flag('edena.veil.open'), undefined, 'before the log, the flowers only drink');
  // into the cabin, the log
  at(level.portals.find((p) => !p.temple).to); step(2);
  assert.equal(quests.stage(Q), 'log');
  at(S.panel);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'log');
  talk(THINGS.log, [0]);
  step(2);
  assert.equal(quests.stage(Q), 'veil');
  at(rt.world.veilLook); step(2);
  veil.onHit('shoot');
  assert.equal(game.flag('edena.veil.open'), true);
  step(200, 1 / 20);
  assert.ok(rt.world.state.veil > 0.95, 'the vines are drawn aside');
  assert.equal(quests.stage(Q), 'scar');
  assert.equal(bestInteractable(player)?.entry.id, 'scar');
  const r = talk(THINGS.scar, [0]);
  void r;
  step(2);
  assert.equal(quests.stage(Q), 'tell');
  talk(PEOPLE.mira, ['My ship has the same mark', 'Where did they go', 'What does it want']);
  assert.equal(quests.isDone(Q), true);
  assert.equal(game.flag('world.edena.done'), true);
  assert.ok(toasts.some((t) => /Something of value\? Words you can carry/.test(t)), 'the closing toast, as Lorn’s');
  assert.equal(game.flag('clue.edena.struck'), true);
  assert.equal(game.flag('clue.edena.pod'), true);
  const k = game.keepsakes().find((x) => x.id === 'edena.word');
  assert.ok(k && k.kind === 'word');
  step(400, 1 / 10);
  assert.ok(rt.world.state.veil < 0.5, 'and then the flowers close over it again');
  await new Promise((res) => setTimeout(res, 1300));
  assert.ok(storyDone);
});

test('side quests: the pyramid seed, planted and watered; the tallest tree’s crown', () => {
  talk(PEOPLE.oro, ['Pyramids grow', 'I’ll look']);
  assert.equal(quests.stage('edena.seed'), 'find');
  // the seed lies on the pond's far shore, out of the water
  const seedAt = rt.world.seedAt;
  assert.ok(level.ground.heightAt(seedAt.x, seedAt.z) > E.pond.y, 'on dry ground');
  at(seedAt);
  assert.equal(bestInteractable(player)?.entry.id, 'seed');
  bestInteractable(player).entry.use(player);
  assert.equal(quests.stage('edena.seed'), 'return');
  talk(PEOPLE.oro, [0]);
  assert.equal(quests.stage('edena.seed'), 'water');
  target('sprout').onHit('shoot');
  step(10 * 30, 1 / 30);
  assert.equal(quests.isDone('edena.seed'), true);
  // the tree: two canopies you can stand on, a crown above them, the lookout on it
  const T = E.tall;
  assert.ok(Math.hypot(T.base.x - TALL_TREE.x, T.base.z - TALL_TREE.z) < 1);
  for (const [c, label] of [[T.c1, 'the lower canopy'], [T.c2, 'the upper canopy'], [T.crown, 'the crown']]) {
    const g = physics.groundAt(c.x + 3, c.y + 2, c.z + 3, 6);
    assert.ok(Math.abs(g - c.y) < 0.6, `${label} is solid (${g.toFixed(1)} vs ${c.y.toFixed(1)})`);
  }
  const gap = T.crown.y - T.c2.y;
  assert.ok(gap > 6 && gap < 11, `the crown is a boost above the upper canopy (${gap.toFixed(1)} m)`);
  talk(PEOPLE.lio, ['What’s on the crown?', 'I’ll go']);
  at(T.lookout);
  assert.equal(bestInteractable(player)?.entry.id, 'lookout');
  talk(THINGS.lookout, [0]);
  step(2);
  assert.equal(quests.stage('edena.tree'), 'tell');
  talk(PEOPLE.lio, ['A bench']);
  assert.equal(quests.isDone('edena.tree'), true);
  // Talo's note read before Lio ever asked: telling him starts and ends the quest in that talk (it used to wait forever)
  game.set('quest.edena.tree', undefined);
  assert.equal(quests.isStarted('edena.tree'), false);
  talk(PEOPLE.lio, ['The whole garden']);
  assert.equal(quests.isDone('edena.tree'), true);
  // Mira hears her mended clock once, and never says it rang while it had no gear
  game.set('quest.edena.clock', 'done');
  const r = new DialogueRunner(PEOPLE.mira, { game, quests });
  assert.equal(r.nodeId, 'clockDone');
  clearInteractables(); clearTargets();
});
