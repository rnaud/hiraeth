import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { createBazaar } = await import('../src/levels/bazaar.js');
const { Physics } = await import('../src/physics.js');
const { Crowd } = await import('../src/crowd.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS, STREET, CROWD_TALK, LINES } = await import('../src/story/bazaar-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
const scene = new THREE.Scene();
const level = createBazaar(scene);
const physics = new Physics(scene, level.ground);
level.init(physics);
const G = level.signal, P = G.places;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
const crowd = new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: fakeNPC });
const npcs = spawnNPCs(scene, physics, CONTENT.bazaar.npcs, {});

const player = { pos: level.spawn.clone(), vel: V(), heading: Math.PI, riding: false, vehicles: [...level.vehicles], frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, toolClick() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const rt = createStory({ levelId: 'bazaar', scene, physics, level, player, npcs, crowd, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests, dialogue } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => {
  for (let i = 0; i < n; i++) {
    clock += dt;
    camera.position.copy(player.pos).add(V(0, 2, 4)); camera.lookAt(player.pos); camera.updateMatrixWorld();
    rt.update(dt, clock, { camera });
    rt.frameCamera(camera);
    crowd.update(dt, clock, player, camera);
  }
};
const talk = (person, choices) => {
  quests.opening(person.id);   // (as Dialogue.start does: the world's opening quest starts with its first talk)
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
  return g;
};

test('the market’s people and places stand on walkable ground', () => {
  for (const k of ['sel', 'kip', 'ferro', 'brush', 'ummu', 'crates']) stand(P[k], k);
  stand(P.console.clone().setY(44).add(V(0, 0, 1.6)), 'in front of the console');
  for (const [id, npc] of Object.entries(W.people)) for (const q of npc.route) stand(q, `${id}’s route`);
  for (const n of npcs.slice(0, 3)) assert.ok(Math.abs(n.pos.y) < 0.5, `the street’s people are on the street (${n.pos.toArray().map((v) => v.toFixed(1))})`);
  // the oldest sign hangs under the second bridge, above the street, below the deck
  const deck = physics.groundAt(P.oldSign.x, 30, P.oldSign.z - 3, 10);
  assert.ok(Math.abs(deck - 25) < 0.1 && P.oldSign.y < 24 && P.oldSign.y > 15, 'under the bridge');
  // and the antenna's bulbs are within a shot of the balcony
  assert.ok(P.antenna.distanceTo(V(6, 45.5, -231)) < 30, 'the bulbs can be reached from the balcony');
  // everyone in the crowd belongs somewhere and has something to say
  const zones = new Set(crowd.people.map((p) => p.spot?.id));
  for (const z of ['market', 'square', 'bridge']) assert.ok(zones.has(z), `people in the ${z}`);
  for (const p of crowd.people.slice(0, 60)) { const d = W.crowdTalk(p); assert.ok(d?.talk && new DialogueRunner(d, { game, quests }).text.length > 5); }
  for (const id of ['doss', 'oyo', 'teb']) assert.ok(new DialogueRunner(STREET[id], { game, quests }).text.length > 10);
});

test('every conversation’s links lead somewhere', () => {
  const all = [...Object.values(PEOPLE), ...Object.values(THINGS), ...Object.values(STREET), ...Object.values(CROWD_TALK).flat()];
  for (const p of all) {
    if (p.talk.listen) continue;   // (listen-only: no nodes, no links; tests/listen.test.js)
    const nodes = p.talk.nodes;
    for (const e of p.talk.entry ?? []) assert.ok(nodes[e.node], `${p.name}: entry to a missing node ${e.node}`);
    for (const [id, n] of Object.entries(nodes)) {
      if (n.next) assert.ok(nodes[n.next], `${p.name}.${id}: next ${n.next}`);
      for (const c of n.choices ?? []) if (c.goto) assert.ok(nodes[c.goto], `${p.name}.${id}: goto ${c.goto}`);
    }
  }
});

test('the main quest: Sel, Kip’s recording, the antenna, the broadcast, and where it came from', () => {
  // it doesn't just appear: it waits for its first talk, and till then the scout finds who to ask
  assert.equal(quests.stage('bazaar.signal'), undefined);
  assert.equal(quests.openerObjective()?.id, `opener-${'bazaar.signal'}`);
  assert.ok(quests.objective().position.distanceTo(W.people.sel.pos) < 0.01);
  talk(PEOPLE.sel, ['Why did it go quiet', 'I’ll find Kip', 'Then we listen']);
  assert.equal(quests.stage('bazaar.signal'), 'kip');
  assert.equal(game.flag('bazaar.rumour.light'), true, 'Sel saw the singing light pass');
  talk(PEOPLE.kip, ['Sel says', 'Did you hear', 'I’ll take it up']);
  assert.ok(quests.has('recording'));
  assert.equal(quests.stage('bazaar.signal'), 'tune');
  // the console won't play yet: dead air
  at(P.console.clone().setY(44).add(V(0, 0, 1.6)));
  assert.equal(bestInteractable(player)?.entry.prompt(), 'look at the console');
  // the antenna: two bulbs, then a wait, and they fade
  const bulbs = allTargets().filter((t) => t.kind === 'bulb');
  assert.equal(bulbs.length, 3);
  bulbs[0].onHit('shoot'); bulbs[1].onHit('shoot');
  step(8 * 30);
  bulbs[2].onHit('shoot');
  assert.notEqual(game.flag('bazaar.antenna.tuned'), true, 'the first two faded before the third');
  // three quick shots: tuned
  bulbs[0].onHit('shoot'); bulbs[1].onHit('shoot'); bulbs[2].onHit('shoot');
  assert.equal(game.flag('bazaar.antenna.tuned'), true);
  step(2);
  assert.equal(quests.stage('bazaar.signal'), 'play');
  // the console: play it
  const use = bestInteractable(player);
  assert.equal(use?.entry.prompt(), 'play the recording');
  use.entry.use(player);
  assert.ok(!quests.has('recording'));
  assert.ok(G.coversAll.visible, 'the tower is still dark');
  step(30 * 2);
  assert.ok(!G.coversAll.visible && G.covers.some((c) => c.visible) && G.covers.some((c) => !c.visible), 'the tower wakes row by row');
  const looking = crowd.people.filter((p) => p.gazeAt && p.gazeUntil > crowd.time).length;
  assert.ok(looking > crowd.people.length * 0.9, `${looking} of ${crowd.people.length} turn to the tower`);
  step(30 * 2.5);
  assert.ok(dialogue.runner?.person.id === 'broadcast' || dialogue.open, 'the broadcast plays');
  const voice = dialogue.runner.pages.join(' ');
  assert.match(voice, /make us proud/);
  assert.match(voice, /you are not alone/i);
  assert.match(voice, /Ilen/);
  // read to the end
  while (!dialogue.runner.lastPage) dialogue.runner.advance();
  dialogue.close();
  step(3);
  assert.equal(game.flag('bazaar.broadcast.on'), true);
  assert.ok(!G.coversAll.visible && G.covers.every((c) => !c.visible), 'all the tower’s screens are lit');
  const k = game.keepsakes().find((x) => x.id === 'bazaar.word');
  assert.ok(k && k.kind === 'word' && /not alone/i.test(k.name));
  step(2);
  assert.equal(quests.stage('bazaar.signal'), 'sel2');
  const p = crowd.people.find((x) => x.spot?.id === 'square');
  assert.ok(LINES.onAir.includes(p.lines[0]), 'the square talks about it');
  assert.ok(CROWD_TALK.onAir.some((c) => c.name === W.crowdTalk(p).name));
  // Sel reads where it came from: home
  talk(PEOPLE.sel, ['It wasn’t my name', 'Where did it come from', 'From home', 'Thank you']);
  assert.equal(game.flag('clue.bazaar.home'), true);
  assert.equal(quests.isDone('bazaar.signal'), true);
  assert.equal(game.flag('world.bazaar.done'), true);
});

test('side quests: the oldest sign, and Ummu’s bowl under the crates', async () => {
  // Brush points at the oldest sign; a shot wakes it
  talk(PEOPLE.brush, ['Which is the oldest']);
  assert.equal(quests.stage('bazaar.oldsign'), 'wake');
  const sign = allTargets().find((t) => t.kind === 'oldsign');
  at(V(P.oldSign.x, 0, P.oldSign.z + 20));
  assert.ok(sign.enabled());
  sign.onHit('shoot');
  assert.equal(game.flag('bazaar.oldsign.awake'), true);
  step(2);
  assert.equal(quests.stage('bazaar.oldsign'), 'tell');
  talk(PEOPLE.brush, ['The mark']);
  assert.equal(quests.isDone('bazaar.oldsign'), true);
  // Ummu, through its screen; the crates need a push, not a shot
  at(P.ummu.clone().add(V(2, 0, 0)));
  assert.equal(bestInteractable(player)?.entry.id, 'ummu');
  talk(THINGS.ummu, ['I’ll move']);
  assert.equal(quests.stage('bazaar.bowl'), 'crates');
  const crates = allTargets().find((t) => t.kind === 'crates');
  crates.onHit('shoot');
  assert.notEqual(game.flag('bazaar.crates.clear'), true, 'a shot only rocks them');
  crates.onHit('push');
  assert.equal(game.flag('bazaar.crates.clear'), true);
  step(40);
  assert.equal(quests.stage('bazaar.bowl'), 'bowl');
  assert.ok(G.crates.every((c) => c.mesh.position.distanceTo(c.rest) > 0.5), 'the crates tumbled aside');
  at(G.bowl.position.clone().add(V(1, 0, 0)));
  const pick = bestInteractable(player);
  assert.equal(pick?.entry.id, 'bowl');
  pick.entry.use(player);
  assert.ok(quests.has('bowl'));
  talk(THINGS.ummu, []);
  assert.equal(quests.isDone('bazaar.bowl'), true);
  assert.ok(game.keepsakes().some((x) => x.id === 'bazaar.song' && x.kind === 'song'));
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone, 'the main quest closed the story page');
  clearInteractables();
});

test('Oyo’s last lantern: its little sun goes into the tank as a band of its own colour, once', async () => {
  const { LANTERN_TONE, LANTERN_FLAG } = await import('../src/story/bazaar-data.js');
  const { FLUID } = await import('../src/fluid-tool.js');
  const refills = [];
  const off = game.on('tool:refill', (o) => refills.push(o));
  game.set('item.backpack', false);
  let r = talk(STREET.oyo, ['What colour?']);
  assert.ok(!r.choices().some((c) => /for my tank/.test(c.text)), 'no tank, nothing to pour it into');
  game.set('item.backpack', true);
  talk(STREET.oyo, ['What colour?', 'All of them?']);
  assert.equal(game.flag(LANTERN_FLAG), true);
  assert.deepEqual(refills, [{ addColour: true, tone: LANTERN_TONE }], 'the tank takes the lantern’s colour');
  assert.ok(toasts.some((t) => /lantern’s little sun/.test(t)));
  r = talk(STREET.oyo, ['What colour?']);
  assert.ok(!r.choices().some((c) => /for my tank/.test(c.text)), 'he only had the one');
  assert.equal(refills.length, 1);
  off();
  // the desert's water, the buried machine's oil-light, the Great Crystal and the market's lantern: four bands, room for all
  assert.ok(FLUID.maxColours >= 1 + 4, 'every world’s source has room in the tank');
});
