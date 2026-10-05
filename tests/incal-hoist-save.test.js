import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The goods hoist and an older save (src/story/incal.js): a save already carrying Pip's tin (the
// errand's old single stage, 'carry') finds the hoist swung in and its basket empty.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { createIncal } = await import('../src/levels/incal.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS } = await import('../src/story/incal-data.js');
const { bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');

game.reset();
game.set('quest.incal.ration', 'carry');
game.set('item.ration', 1);
const scene = new THREE.Scene();
const level = createIncal(scene);
const physics = new Physics(scene, null);
level.init(physics);
const P = level.shaft.places;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, vehicles: [...level.vehicles], frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
const rt = createStory({ levelId: 'incal', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests, dialogue } = rt;
const H = rt.world.hoist;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
const talk = (person, choices) => {
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
    const pick = r.choices().find((x) => x.text.startsWith(c));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const target = (kind) => allTargets().find((t) => t.kind === kind);
const toasted = (re) => toasts.some((t) => re.test(t));
const basket = () => H.rig.hang.localToWorld(V(0, -3.0, 0));
const flatTo = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('an older save carrying the tin: the hoist is already swung in, nothing to solve, and Dov still takes it', () => {
  assert.equal(quests.stage('incal.ration'), 'carry');
  assert.ok(H.pinOut() && H.swungIn());
  assert.ok(Math.abs(Math.abs(H.rig.arm.rotation.y) - Math.PI) < 1e-6, 'swung in over the terrace');
  assert.equal(H.rig.tin.visible, false, 'the basket is empty');
  assert.equal(target('hoistPin').enabled(), false);
  assert.equal(target('hoistWeight').enabled(), false);
  at(P.hoistIn.clone());
  assert.notEqual(bestInteractable(player)?.entry.id, 'hoistBasket');
  at(P.palace.dov.clone().add(V(2, 0, 0)));
  const r = talk(PEOPLE.dov, []);
  while (!r.ended && r.advance());
  assert.equal(quests.isDone('incal.ration'), true);
  void step; void toasted; void basket; void flatTo; void THINGS; void dialogue;
});
