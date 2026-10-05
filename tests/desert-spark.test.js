import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The desert's second errand and its edges (src/story/desert.js, desert-spark.js,
// desert-hearth.js): the tree stands cold until the spark-stone is set in its
// full well; ember mode can't light it; the Hearth's grille only rises for a
// shove of fluid; saves from before the rework keep a burning tree and skip the
// errand; a save part-way through it is restored as it was.
// (tests/desert-story.test.js plays the whole chain end to end.)

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game, GameState } = await import('../src/game-state.js');
const { items } = await import('../src/items.js');
const { QUESTS, SPARK_STAGES } = await import('../src/story/desert-data.js');
const { migrateDesertQuest } = await import('../src/story/desert.js');
const { Quests } = await import('../src/story/quests.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { bestInteractable, clearInteractables } = await import('../src/interact.js');
const { updateHazards, resetHazardNotes, clearHazards } = await import('../src/hazards.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** A desert with its story running on the shared game state (set its flags first). */
function desert(flags = {}) {
  game.reset();
  clearInteractables(); clearHazards(); clearTargets();
  for (const [k, v] of Object.entries(flags)) game.set(k, v);
  const scene = new THREE.Scene();
  const level = createDesert(scene);
  const physics = new Physics(scene, level.ground);
  const player = { pos: V(0, level.ground.heightAt(0, 0), 0), vel: V(0, 0, 0), wind: V(0, 0, 0), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const toasts = [];
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
  const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
  const camera = new THREE.PerspectiveCamera();
  let t = 0;
  const step = (n = 1, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) {
      t += dt;
      camera.position.copy(player.pos).add(V(0, 2, 4));
      rt.update(dt, t, { camera });
      level.update?.(dt, t, { camera, player });
    }
  };
  return { level, Q: level.qanat, H: level.hearth, player, rt, quests: rt.quests, step, toasts };
}

test('saves from before the rework: a tree that already drank keeps burning, and the spark-stone’s errand is skipped', () => {
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  const save = (stage, flags = {}) => {
    const g = new GameState(store());
    g.set('prologue.done', true); g.set('items.v', 1); g.set('item.backpack', true); g.set('desert.quest.v', 2);
    if (stage) g.set('quest.desert.power', stage);
    for (const [k, v] of Object.entries(flags)) g.set(k, v);
    return g;
  };
  // the water rose in the old story (the channel open): the tree was burning, and stays so
  for (const [stage, flags] of [['fill', { 'desert.channel.open': true }], ['ship', { 'desert.channel.open': true, 'desert.jar.filled': true }], ['done', { 'desert.ship.fed': true, 'ship.powered': true }]]) {
    const g = save(stage, flags);
    assert.equal(migrateDesertQuest(g), null, `${stage}: the stage stays where it was`);
    assert.equal(g.flag('desert.tree.lit'), true, `${stage}: the tree burns`);
    assert.equal(g.flag('desert.quest.v'), 3);
    assert.equal(g.flag('tool.empty'), undefined, 'and the tank was never empty');
  }
  // short of the water: the tree is cold now, the new errand waits
  const g = save('channel');
  migrateDesertQuest(g);
  assert.equal(g.flag('desert.tree.lit'), undefined);
  // the stages still exist (old ids) and the errand's are in order between the well and the ship
  const ids = QUESTS.find((q) => q.id === 'desert.power').stages.map((s) => s.id);
  assert.deepEqual(ids.slice(ids.indexOf('fill')), ['fill', ...SPARK_STAGES, 'ship']);
  // once only
  assert.equal(migrateDesertQuest(g), null);
  // a v1 save gets both migrations: the moved stages, and the tree
  const old = save('ama', { 'desert.quest.v': undefined });
  assert.equal(migrateDesertQuest(old), 'elder');
  assert.equal(old.flag('desert.quest.v'), 3);
  void Quests;
});

test('an old save at the jar: the tree already burns; wading fills the jar and the quest goes straight to the ship', () => {
  const D = desert({ 'prologue.done': true, 'items.v': 1, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 2,
    'quest.desert.power': 'fill', 'desert.channel.open': true, 'item.jar': 1, 'desert.jar.given': true, 'desert.elder.heard': true });
  const { Q, step, quests, player } = D;
  step(2);
  assert.equal(game.flag('desert.tree.lit'), true);
  assert.equal(Q.city.lit, 1, 'the tree burns');
  assert.equal(Q.city.smoke.mesh.visible, true);
  assert.equal(Q.city.smoke.grow, Infinity, 'its smoke column standing as it always did');
  assert.equal(D.rt.world.dry(), false, 'the tank is full');
  player.pos.copy(Q.cave.poolCenter).setY(Q.cave.origin.y - 1.5);
  step(3);
  assert.ok(quests.has('water'));
  step(3);
  assert.equal(quests.stage('desert.power'), 'ship', 'no spark-stone errand for a tree that burns');
  game.emit('ship:enter');
  step(2);
  assert.equal(quests.isDone('desert.power'), true);
});

test('the cold tree: no burn, ember mode only hisses on it, and the well refuses a stone before the water rises', () => {
  resetHazardNotes();
  const D = desert({ 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 3, 'desert.bike.v': 1, 'desert.elder.heard': true, 'quest.desert.power': 'down', 'item.stone': 1 });
  const { Q, step, toasts, player } = D;
  step(2);
  assert.equal(Q.city.lit, 0);
  const inFlame = { pos: Q.city.crown.clone().add(V(0, -6, 0)), vel: V(0, 0, 0), hurt() {} };
  assert.equal(updateHazards(0.5, inFlame), null, 'nothing burns in a cold crown');
  // an ember glob (the Givers' House's ember mode) spits and dies on it
  const tree = allTargets().find((t) => t.kind === 'tree');
  assert.ok(tree.accepts.includes('fire'));
  tree.onHit('fire');
  assert.ok(toasts.at(-1).includes('never burned'), 'its wood never burned: only the water in it');
  assert.equal(Q.city.lit, 0, 'and it stays cold');
  // a stone in a dry well: no
  player.pos.copy(Q.city.wellLook);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'well.stone');
  e.entry.use(player);
  assert.equal(game.flag('desert.tree.lit'), undefined);
  assert.ok(toasts.at(-1).includes('The well is dry'));
  // lit, the crown burns again
  Q.city.setLit(1);
  assert.equal(updateHazards(0.5, inFlame), 'fire');
  Q.city.setLit(0);
});

test('the Hearth: the grille holds until a shove rolls the ball; a save part-way finds it as it was', () => {
  const D = desert({ 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 3, 'desert.bike.v': 1, 'quest.desert.power': 'stone', 'desert.channel.open': true,
    'desert.jar.filled': true, 'desert.well.watched': true, 'desert.spark.heard': true, 'desert.bike.found': true, 'desert.hearth.seen': true });
  const { H, step, player, quests } = D;
  player.pos.copy(H.inside);
  step(2);
  // the outside: a butte far from Qanat, its door looking back at the city; the hall inside, dark, overhead
  assert.ok(H.origin.y > 900, 'the hall is built far overhead, like the giant’s chest');
  const back = level => level.portals.find((p) => p.label === 'passage out');
  assert.ok(back(D.level).to.distanceTo(H.doorFront) < 1.5, 'the way out leads back to the door');
  // the stone can't be taken through the grille, a shot only rocks the ball, the ball won't move by hand
  player.pos.copy(H.shelfFront).add(V(0, 0, -1.6));
  assert.notEqual(bestInteractable(player)?.entry.id, 'hearth.stone');
  player.pos.copy(H.plinthFront);
  const look = bestInteractable(player);
  assert.equal(look?.entry.id, 'hearth.weight', 'E on the ball: only a look');
  const w = allTargets().find((t) => t.kind === 'weight');
  w.onHit('shoot');
  step(40);
  assert.equal(game.flag('desert.hearth.open'), undefined);
  w.onHit('push');
  step(30 * 5);
  assert.equal(game.flag('desert.hearth.open'), true);
  assert.equal(H.ball.userData.gone, true, 'the ball has dropped into its hole');
  assert.equal(w.enabled(), false);
  // a reload: the grille up, the ball gone; the stone taken is in your pack (not floating about you)
  const R = desert({ 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 3, 'desert.bike.v': 1, 'quest.desert.power': 'light', 'desert.channel.open': true,
    'desert.jar.filled': true, 'desert.well.watched': true, 'desert.spark.heard': true, 'desert.bike.found': true, 'desert.hearth.seen': true,
    'desert.hearth.open': true, 'desert.stone.taken': true, 'item.stone': 1 });
  R.player.pos.set(400, R.level.ground.heightAt(400, 100), 100);
  R.step(3);
  assert.ok(R.H.grille.position.y - R.H.grilleRest.y > 1.5, 'the grille is up');
  assert.equal(R.H.ball.userData.gone, true);
  assert.equal(R.H.stone.visible, false, 'nothing floats about you: the stone is in your pack');
  assert.ok(R.quests.carried().includes('the spark-stone'), 'your gear lists it');
  assert.equal(R.H.stoneLight.w, 0, 'out under the sky it gives no light');
  R.player.pos.copy(R.H.inside); R.step(2);
  assert.equal(R.H.stone.visible, false);
  assert.ok(R.H.stoneLight.w > 5 && Math.hypot(R.H.stoneLight.x - R.player.pos.x, R.H.stoneLight.z - R.player.pos.z) < 1.5, 'in the dark hall it glows through your pack');
  assert.equal(R.quests.objective().label, 'The well at the tree');
  void quests;
});

test('the hoverbike won’t wake on an empty tank', () => {
  const D = desert({ 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 3, 'desert.bike.v': 1, 'tool.empty': true, 'quest.desert.power': 'down', 'desert.bike.uncovered': true });
  const { step, player, toasts } = D;
  const site = D.rt.world.hollow.site.bike;
  player.pos.copy(site).add(V(1.5, 0, 0)).setY(D.level.ground.heightAt(site.x + 1.5, site.z));
  step(1);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'bike.tarp');
  assert.equal(e.entry.prompt(), 'look at the hoverbike');
  e.entry.use();
  assert.equal(game.flag('desert.bike.found'), undefined);
  assert.ok(toasts.at(-1).includes('tank is empty'));
  assert.equal(items.has('backpack'), true);
  game.reset();
});
