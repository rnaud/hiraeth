import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createArzach2, ARZACH2_CONTENT } = await import('../src/levels/arzach2.js');
const { Physics } = await import('../src/physics.js');
const { NPC } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, LOCALS, THINGS, CAIRN_STONES } = await import('../src/story/arzach2-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');

game.reset();
clearInteractables(); clearTargets();
const scene = new THREE.Scene();
const level = createArzach2(scene);
const physics = new Physics(scene, level.ground);
const A = level.arzach2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = ARZACH2_CONTENT.npcs.map((s) => new NPC(scene, physics, { route: [V(s.at[0], physics.groundAt(s.at[0], (s.y ?? 1e4) + 2, s.at[1]), s.at[1])], palette: s.palette, lines: s.lines }));
const rt = createStory({ levelId: 'arzach2', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
const talk = (person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (r.advance());
    const pick = r.choices().find((x) => (typeof c === 'number' ? x.index === c : x.text.startsWith(c)));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const solid = (p, label, tol = 1.2) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < tol, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
  assert.ok(!level.unsafe(V(p.x, g, p.z)), `${label} is not in the cloud`);
  return g;
};
const use = (id, p) => {
  at(p);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, id, `E here is ${id}`);
  e.entry.use(player);
};
const [aube, calix, ondine] = LOCALS;

test('the people, the bell rope, the clapper, the cairn and the sky stones stand on solid stone above the cloud', () => {
  for (const [id, n] of Object.entries(W.people)) solid(n.pos, id, 1.6);
  solid(A.ropeFoot.clone().setY(A.ropeFoot.y - 0.9), 'the foot of the bell rope');
  solid(A.clapper, 'the clapper on the island');
  solid(A.cairn.clone().setY(A.cairn.y - 0.7), 'the cairn’s footing', 1.6);
  solid(A.face.clone().setY(physics.groundAt(A.face.x, A.face.y + 10, A.face.z)), 'the face on the tower');
  // the sky stones climb, each a boost-jump (more than a jump, less than jump + boost) above the last, and close enough to leap
  let prev = { pos: V(A.table.x + 58 * Math.cos(0.2), physics.groundAt(A.table.x + 56, 80, A.table.z + 4), A.table.z), r: 0 };
  for (const s of A.sky) {
    solid(s.pos, 'a sky stone', 0.6);
    const up = s.pos.y - prev.pos.y, gap = flatDist(s.pos, prev.pos) - s.r - prev.r;
    assert.ok(up > 2 && up < 5, `rise ${up.toFixed(2)}`);
    assert.ok(gap < 5.5, `gap ${gap.toFixed(2)}`);
    prev = s;
  }
  assert.ok(physics.triangles < 60000, `collision budget: ${physics.triangles}`);
});
function flatDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

test('the main quest: Aube, the monastery, Calix, the clapper, the bell, the note; the cloud settles', () => {
  assert.equal(quests.stage('arzach2.bell'), 'aube');
  talk(aube, ['Why is it higher', 'I’ll go up']);
  step(2);
  assert.equal(quests.stage('arzach2.bell'), 'monastery');
  at(A.monastery.clone().add(V(-10, 0.3, -20))); step(2);
  assert.equal(quests.stage('arzach2.bell'), 'calix');
  talk(calix, ['Why doesn’t', 'What’s that mark', 'A light that sang', 'I’ll bring it']);
  assert.equal(game.flag('arzach2.rumour.light'), true, 'the bell hummed for the singing light');
  step(2);
  assert.equal(quests.stage('arzach2.bell'), 'clapper');
  // pulling the rope before: the bell swings, silent
  use('bellrope', A.ropeFoot.clone().add(V(0.4, -0.9, 0.6)));
  assert.equal(game.flag('arzach2.bell.rung'), undefined);
  W.bell.t = -1;
  use('clapper', A.clapper.clone().add(V(0.6, 0, 0.4)));
  assert.ok(quests.has('clapper'));
  talk(calix, ['I’ll ring']);
  assert.equal(game.flag('arzach2.clapper.hung'), true);
  step(2);
  assert.equal(quests.stage('arzach2.bell'), 'ring');
  const cloud0 = A.cloud[0].position.y, float0 = A.floaters.position.y;
  use('bellrope', A.ropeFoot.clone().add(V(0.4, -0.9, 0.6)));
  assert.equal(game.flag('arzach2.bell.rung'), true);
  step(15 * 10, 1 / 10);
  assert.ok(A.cloud[0].position.y < cloud0 - 9, `the cloud settled: ${(cloud0 - A.cloud[0].position.y).toFixed(1)} m`);
  assert.ok(A.floaters.position.y < float0 - 3, 'the floating stones came down a little');
  assert.equal(quests.stage('arzach2.bell'), 'listen');
  talk(calix, ['Thank you']);
  assert.equal(quests.isDone('arzach2.bell'), true);
  assert.equal(game.flag('world.arzach2.done'), true);
  assert.equal(game.flag('arzach2.bell.note'), true, 'the tank sings the note now');
  const k = game.keepsakes().find((x) => x.id === 'arzach2.song');
  assert.ok(k && k.kind === 'song', 'the keepsake: the bell’s note');
});

test('side quests: Ysolde’s letter across the aqueduct, and Tiv’s cairn from the sky stones, widest first', async () => {
  talk(PEOPLE.ysolde, ['Where is your sister', 'I could carry']);
  assert.ok(quests.has('letter'));
  assert.equal(quests.stage('arzach2.letter'), 'carry');
  talk(ondine, ['I’ll look']);
  assert.equal(quests.stage('arzach2.letter'), 'face');
  use('face', A.face.clone().setY(physics.groundAt(A.face.x, A.face.y + 10, A.face.z)).add(V(0, 0, 2)));
  talk(THINGS.face, ['(remember']);
  step(2);
  assert.equal(quests.isDone('arzach2.letter'), true);
  assert.equal(game.flag('clue.arzach2.desert'), true, 'the clue: the giants were here too');
  // the cairn
  talk(PEOPLE.tiv, ['Up where', 'I’ll fetch']);
  assert.equal(quests.stage('arzach2.cairn'), 'gather');
  for (const s of CAIRN_STONES) use(`stone.${s.id}`, W.stones[s.id].at.clone().add(V(0.5, -0.5, 0)));
  step(2);
  assert.equal(quests.stage('arzach2.cairn'), 'stack');
  // the round one first falls off; then widest first
  talk(THINGS.cairn, ['Set down the round']);
  assert.equal(game.flag('arzach2.cairn.placed'), 0);
  assert.ok(quests.has('cairn.round'), 'it slid back into your hands');
  talk(THINGS.cairn, ['Set down the wide', 'Set down the round', 'Set down the little egg', '(look at it)']);
  assert.equal(game.flag('arzach2.cairn.placed'), 3);
  step(2);
  assert.equal(quests.isDone('arzach2.cairn'), true);
  await new Promise((r) => setTimeout(r, 1600));
  assert.ok(storyDone, 'the main quest closed the story page');
  clearInteractables(); clearTargets();
});
