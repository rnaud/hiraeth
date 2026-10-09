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
    assert.equal(g.flag('desert.quest.v'), 4);
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
  assert.equal(old.flag('desert.quest.v'), 4);
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
  assert.equal(quests.isDone('desert.power'), false, 'Qanat brings its gift first (src/story/desert-repay.js)');
  step(30 * 26);
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

test('saves from before the four talks were folded into two (desert.quest.v 3): the well, Ama and the Speaker go to the merged stage (Ama’s jar), keeping what was done', async () => {
  const { STAGE_MERGE, DESERT_QUEST_V } = await import('../src/story/desert-data.js');
  assert.equal(DESERT_QUEST_V, 4);
  const ids = QUESTS.find((q) => q.id === 'desert.power').stages.map((s) => s.id);
  for (const gone of ['well', 'ama', 'speaker']) assert.ok(!ids.includes(gone), `${gone} is no stage now`);
  assert.deepEqual(ids.slice(0, 5), ['city', 'box', 'elder', 'ask', 'down']);
  for (const to of Object.values(STAGE_MERGE)) assert.ok(ids.includes(to));
  const base = { 'prologue.done': true, 'items.v': 1, 'item.backpack': true, 'box.desert.backpack': true, 'tool.empty': true, 'desert.quest.v': 3, 'desert.bike.v': 1, 'desert.elder.heard': true };
  // at the well (heard Nour, nothing else): the merged stage, Ama first
  let D = desert({ ...base, 'quest.desert.power': 'well' });
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'ask');
  assert.equal(game.flag('desert.quest.v'), 4);
  assert.ok(D.quests.objective().position.distanceTo(D.rt.world.people.ama.pos) < 0.01, 'the marker on Ama');
  // (since the first hour was shortened, October 2026, the jar alone finishes it: Nour says the Speaker's verse herself)
  game.set('desert.jar.given', true);
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'down', 'the jar: the way down, the Speaker optional');
  // at the Speaker, the jar already given: straight on to the way down
  D = desert({ ...base, 'quest.desert.power': 'speaker', 'desert.well.seen': true, 'desert.jar.given': true, 'item.jar': 1 });
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'down');
  assert.ok(D.quests.has('jar'), 'the jar is kept');
  // at Ama, having heard the Speaker first (the old order allowed it): the jar finishes it
  D = desert({ ...base, 'quest.desert.power': 'ama', 'desert.well.seen': true, 'desert.speaker.heard': true });
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'ask');
  game.set('desert.jar.given', true);
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'down');
  // already past it (the cave, the fill): untouched
  D = desert({ ...base, 'quest.desert.power': 'channel' });
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'channel');
  // a v1 save at its old 'speaker' stage: to Nour first (STAGE_MIGRATION), not the merged stage
  const g = new GameState({ getItem: () => null, setItem() {} });
  g.set('quest.desert.power', 'speaker'); g.set('prologue.done', true);
  assert.equal(migrateDesertQuest(g), 'elder');
  game.reset();
});

test('the fire-bearers’ way: a bowl that wakes its stone, a cold camp and a glinting bell, by the marked stones on the ride to the Hearth', async () => {
  const { wayPlaces, hearthStones, STORY } = await import('../src/desert-sites.js');
  const { PEOPLE, THINGS } = await import('../src/story/desert-data.js');
  const { DialogueRunner } = await import('../src/story/dialogue.js');
  const D = desert({ 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 4, 'desert.bike.v': 1, 'desert.channel.open': true, 'desert.spark.heard': true, 'quest.desert.power': 'hearth' });
  const { H, step, toasts, player, rt } = D;
  // spread along the way, each beside its marked stone, all between the city and the Hearth
  const P = wayPlaces(), S = hearthStones();
  const along = (p) => Math.hypot(p.x - STORY.city.x, p.z - STORY.city.z);
  assert.ok(along(P.bowl) < along(P.camp) && along(P.camp) < along(P.bell), 'in order along the ride');
  assert.ok(along(P.bowl) > 300 && along(P.bell) < Math.hypot(STORY.hearth.x - STORY.city.x, STORY.hearth.z - STORY.city.z) - 100);
  for (const p of Object.values(P)) assert.ok(Math.hypot(p.x - S[p.stone][0], p.z - S[p.stone][1]) < 20, 'by its stone');
  // each is something to look at (E), from the ground beside it
  const W = H.way;
  for (const [at, id] of [[W.bowl.at, 'way.wayBowl'], [W.camp.at, 'way.wayCamp'], [W.bell.at, 'way.wayBell']]) {
    player.pos.copy(at).add(V(1.2, 0, 0));
    assert.equal(bestInteractable(player)?.entry.id, id);
  }
  // the bowl: its stone's mark is dull; a shot of fluid fills it, and the mark wakes
  step(5);
  assert.ok(H.materials.wayMark.uniforms.uGlow.value < 0.1, 'the dull mark');
  assert.equal(W.bowl.fluid.visible, false);
  const bowl = allTargets().find((t) => t.kind === 'wayBowl');
  assert.equal(bowl.onHit('push'), false, 'a push does nothing');
  assert.equal(bowl.onHit('shoot'), true);
  assert.equal(game.flag('desert.way.bowl'), true);
  assert.match(toasts.at(-1), /mark on the stone above it wakes/);
  step(60);
  assert.ok(H.materials.wayMark.uniforms.uGlow.value > 0.8, 'the mark shines like the others');
  assert.equal(W.bowl.fluid.visible, true);
  assert.equal(new DialogueRunner(THINGS.wayBowl, { game, quests: rt.quests }).nodeId, 'lit');
  // the bell glints now and then (the sun on it), and the Speaker hears of it once
  player.pos.copy(W.bell.at).add(V(30, 0, 0));   // (from the saddle, out on the way)
  let big = 0, small = Infinity;
  for (let i = 0; i < 120; i++) { step(1); big = Math.max(big, W.bell.glint.scale.x); small = Math.min(small, W.bell.glint.scale.x); }
  assert.ok(big > 2 && big > small * 3, `a flash big enough to see from the saddle (${small.toFixed(2)}..${big.toFixed(2)})`);
  const r = new DialogueRunner(THINGS.wayBell, { game, quests: rt.quests });
  while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
  assert.equal(game.flag('desert.way.bell'), true);
  game.set('item.stone', 1);
  const sp = new DialogueRunner(PEOPLE.speaker, { game, quests: rt.quests });
  assert.equal(sp.nodeId, 'carried');
  while (!sp.lastPage && sp.advance());
  assert.ok(sp.choices().some((c) => /bell like yours/.test(c.text)), 'the Speaker can be told');
  game.reset();
});

test('the first hour shorter: Ama’s jar on the way in, so after the chest only Nour stands between you and the way down', async () => {
  const { PEOPLE } = await import('../src/story/desert-data.js');
  const { DialogueRunner } = await import('../src/story/dialogue.js');
  const D = desert({ 'prologue.done': true, 'desert.quest.v': 4, 'quest.desert.power': 'city', 'met.marrow': true });
  const say = (person, picks) => {
    const r = new DialogueRunner(person, { game, quests: D.quests });
    const pages = [];
    for (const p of picks) {
      while (!r.ended && (!r.lastPage || !r.choices().length)) { pages.push(r.text); r.advance(); }
      pages.push(r.text);
      const c = r.choices().find((x) => x.text.startsWith(p));
      assert.ok(c, `${person.name}: no "${p}" in ${r.choices().map((x) => x.text).join(' | ')}`);
      r.choose(c.index);
    }
    while (!r.ended) { pages.push(r.text); if (!r.advance()) break; }
    return pages.join(' ');
  };
  // passing her fire on the way to the city: she gives the jar there
  say(PEOPLE.ama, ['My ship has no power', 'I’ll go to the city', 'I’ll bring it back full']);
  assert.ok(D.quests.has('jar'), 'the jar, before Nour has sent you');
  // the chest opens; Nour sends you straight to the giant's mouth, the jar already on your hip
  game.set('item.backpack', true); game.set('box.desert.backpack', true); game.set('desert.city.entered', true);
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'elder');
  const words = say(PEOPLE.nour, ['My ship has no power', 'Then I’ll find out', 'The giant’s mouth']);
  assert.match(words, /jar on your hip already/);
  assert.match(words, /mouth is a door/);
  assert.doesNotMatch(words, /Get \*the drinking jar/);
  D.step(3);
  assert.equal(D.quests.stage('desert.power'), 'down', 'Ama’s stage passes at once');
  // once given, she has no second jar to give
  assert.equal(new DialogueRunner(PEOPLE.ama, { game, quests: D.quests }).nodeId, 'again');
  assert.equal(game.flag('item.jar'), 1, 'one jar');
  assert.equal(PEOPLE.ama.talk.nodes.early.choices.filter((c) => c.goto === 'jarEarly').every((c) => c.if?.not?.flag === 'desert.jar.given'), true, 'only offered without it');
  game.reset();
});

test('Ama calls you to her fire about the jar while she still has it for you, twice at most, and not once it is yours', async () => {
  const { PEOPLE, CALLS } = await import('../src/story/desert-data.js');
  const { amaCallsYou, amaCampShout } = await import('../src/story/desert.js');
  const { DialogueRunner } = await import('../src/story/dialogue.js');
  const flags = { 'prologue.done': true, 'desert.quest.v': 4, 'quest.desert.power': 'city', 'met.marrow': true };
  const D = desert(flags);
  const ama = D.rt.world.people.ama, call = D.rt.world.calls.ama;
  assert.equal(amaCallsYou(game), true);
  assert.equal(amaCampShout(game), CALLS.ama[0], 'coming up to the camps, she calls you over instead of waving you on');
  assert.match(amaCampShout(game), /jar/);
  // standing a few steps from her fire for a minute: two words, then she leaves it to you
  D.player.pos.copy(ama.pos).add(V(6, 0, 0));
  const heard = new Set();
  for (let i = 0; i < 60 * 10; i++) { D.step(1, 1 / 10); D.player.pos.copy(ama.pos).add(V(6, 0, 0)); if (ama.shout) heard.add(ama.shout.text); }
  assert.equal(call.calls, 2, 'twice, not nagging');
  assert.ok([...heard].every((t) => CALLS.ama.includes(t)) && heard.size === 2, `her words: ${[...heard].join(' | ')}`);
  assert.equal(game.flag('desert.ama.called'), true);
  // and her talk has the jar straight away once she has called
  const r = new DialogueRunner(PEOPLE.ama, { game, quests: D.quests });
  assert.equal(r.nodeId, 'hello');
  while (!r.choices().length) r.advance();
  const c = r.choices().find((x) => x.text.startsWith('You called me over'));
  assert.ok(c, 'a choice for the jar she called about');
  r.choose(c.index);
  while (!r.choices().length && !r.ended) r.advance();
  assert.equal(D.quests.has('jar'), true);
  assert.equal(game.flag('desert.jar.given'), true);
  // once the jar is yours: no call, and the old wave on to the city
  assert.equal(amaCallsYou(game), false);
  assert.match(amaCampShout(game), /To the city/);
  const D2 = desert({ ...flags, 'desert.jar.given': true, 'item.jar': 1 });
  const ama2 = D2.rt.world.people.ama;
  for (let i = 0; i < 30 * 10; i++) { D2.step(1, 1 / 10); D2.player.pos.copy(ama2.pos).add(V(6, 0, 0)); }
  assert.equal(D2.rt.world.calls.ama.calls ?? 0, 0, 'no call with the jar on your hip');
  // and a cold save that never had it called about: no jar choice in hello
  game.set('desert.ama.called', undefined);
  game.set('desert.jar.given', undefined);
  assert.equal(PEOPLE.ama.talk.nodes.hello.choices.find((x) => x.goto === 'jarCalled').if.all[0].flag, 'desert.ama.called');
  // the tree lit (whatever the jar): she has nothing to call about
  game.set('desert.tree.lit', true);
  assert.equal(amaCallsYou(game), false);
  game.reset();
});

test('the ride to the Hearth: each thing on the way is named once as it comes up ahead, and the butte on the way out', async () => {
  const { STORY } = await import('../src/desert-sites.js');
  const { CALLS, CALL } = await import('../src/story/desert-way.js');
  const errand = { 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 4, 'desert.bike.v': 1, 'desert.channel.open': true, 'desert.spark.heard': true };
  const city = V(STORY.city.x, 0, STORY.city.z), hearth = V(STORY.hearth.x, 0, STORY.hearth.z);
  const dir = hearth.clone().sub(city).normalize();
  // a ride in a straight line at the bike's top speed (34 m/s, a frame at 30 fps): what was named, and where
  const ride = (D, from, to) => {
    const said = [];
    const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / (34 / 30));
    for (let i = 0; i <= n; i++) {
      const p = from.clone().lerp(to, i / n);
      D.player.pos.set(p.x, D.level.ground.heightAt(p.x, p.z), p.z);
      const before = D.toasts.length;
      D.step(1);
      if (D.toasts.length > before && Object.values(CALLS).includes(D.toasts.at(-1))) said.push({ text: D.toasts.at(-1), at: p.clone() });   // (not the quest's own toasts)
    }
    return said;
  };
  let D = desert({ ...errand, 'quest.desert.power': 'hearth' });
  const W = D.H.way;
  const out = ride(D, city.clone().addScaledVector(dir, 200), D.H.doorFront.clone().addScaledVector(dir, -30));
  const named = (t) => out.find((s) => s.text === t);
  for (const id of ['bowl', 'camp', 'bell', 'hearth']) assert.ok(named(CALLS[id]), `${id} is named on the way out`);
  assert.equal(out.length, 4, 'each once');
  // ahead of you, with time to stop: between the near and the far reach
  for (const [id, at] of [['bowl', W.bowl.at], ['camp', W.camp.at], ['bell', W.bell.at]]) {
    const d = Math.hypot(named(CALLS[id]).at.x - at.x, named(CALLS[id]).at.z - at.z);
    assert.ok(d > CALL.near && d <= CALL.range + 2, `${id} named ${d.toFixed(0)} m ahead`);
  }
  assert.deepEqual(out.map((s) => s.text), ['bowl', 'camp', 'bell', 'hearth'].map((id) => CALLS[id]), 'in order along the ride');
  // what is done is not named again (the bowl filled, the camp seen), nor the butte on the way home
  D = desert({ ...errand, 'quest.desert.power': 'light', 'item.stone': 1, 'desert.way.bowl': true, 'desert.way.camp': true });
  const home = ride(D, D.H.doorFront.clone().addScaledVector(dir, -30), city.clone().addScaledVector(dir, 200));
  assert.deepEqual(home.map((s) => s.text), [CALLS.bell], 'on the way home only the bell, not rung yet');
  // and nothing is named off the errand (before Nour sends you for the stone)
  D = desert({ ...errand, 'desert.channel.open': undefined, 'desert.spark.heard': undefined, 'quest.desert.power': 'down' });
  assert.deepEqual(ride(D, city.clone().addScaledVector(dir, 200), D.H.doorFront.clone().addScaledVector(dir, -30)), []);
  game.reset();
});

test('the straight ride out (level design audit v1.9): Yara’s shade and a skiff’s wreck on the line from Marrow’s hollow to the Hearth, each named as it comes up', async () => {
  const { STORY, ridePlaces } = await import('../src/desert-sites.js');
  const { CALLS } = await import('../src/story/desert-way.js');
  const { CONTENT } = await import('../src/levels/content.js');
  const { THINGS } = await import('../src/story/desert-data.js');
  const { DialogueRunner } = await import('../src/story/dialogue.js');
  const P = ridePlaces(), bike = V(STORY.bike.x, 0, STORY.bike.z);
  // on the way, in order, well apart: a stop every 500 m or so of a 1.6 km ride
  const along = (p) => Math.hypot(p.x - bike.x, p.z - bike.z);
  assert.ok(along(P.shade) > 350 && along(P.shade) < 650 && along(P.wreck) > 850 && along(P.wreck) < 1150);
  // Yara sits under the shade (src/levels/content.js)
  const yara = Object.values(CONTENT).flatMap((c) => c?.npcs ?? []).find((n) => n.id === 'yara');
  assert.ok(yara && Math.hypot(yara.at[0] - P.shade.x, yara.at[1] - P.shade.z) < 3, 'Yara in her shade');
  const D = desert({ 'prologue.done': true, 'item.backpack': true, 'box.desert.backpack': true, 'desert.quest.v': 4, 'desert.bike.v': 1, 'desert.channel.open': true, 'desert.spark.heard': true, 'desert.bike.found': true, 'quest.desert.power': 'hearth' });
  const R = D.H.ride, said = [];
  const to = D.H.doorFront, n = Math.ceil(Math.hypot(to.x - bike.x, to.z - bike.z) / (34 / 30));
  for (let i = 0; i <= n; i++) {
    const p = bike.clone().lerp(to, i / n);
    D.player.pos.set(p.x, D.level.ground.heightAt(p.x, p.z), p.z);
    const before = D.toasts.length;
    D.step(1);
    if (D.toasts.length > before && Object.values(CALLS).includes(D.toasts.at(-1))) said.push(D.toasts.at(-1));
  }
  assert.deepEqual(said.filter((t) => t === CALLS.shade || t === CALLS.wreck), [CALLS.shade, CALLS.wreck], 'both named, in order, once');
  // the wreck is something to look at
  D.player.pos.copy(R.wreck.stand);
  assert.equal(bestInteractable(D.player)?.entry.id, 'way.rideWreck');
  const r = new DialogueRunner(THINGS.rideWreck, { game, quests: D.quests });
  while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
  assert.equal(game.flag('desert.ride.wreck'), true);
  game.reset();
});
