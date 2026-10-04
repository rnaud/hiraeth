import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createGarage } = await import('../src/levels/garage.js');
const { Physics } = await import('../src/physics.js');
const { NPC } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, LOCALS, THINGS } = await import('../src/story/garage-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
clearInteractables(); clearTargets();
const scene = new THREE.Scene();
const level = createGarage(scene);
const physics = new Physics(scene, null);
const G = level.garage;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: G.aSpawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = CONTENT.garage.npcs.map((s) => new NPC(scene, physics, { route: [V(s.at[0], physics.groundAt(s.at[0], 50, s.at[1]), s.at[1])], palette: s.palette, lines: s.lines }));
const rt = createStory({ levelId: 'garage', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); level.update(dt, clock, {}); } };
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
const use = (id, p) => {
  at(p);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, id, `E here is ${id} (got ${e?.entry.id})`);
  e.entry.use(player);
};
// the floor under someone, along their own up (the plateau: +y; the upside-down: -y; the ring: toward the axis)
const floorUnder = (p) => {
  const up = level.gravityAt(p);
  return physics.rayDistance(p.clone().addScaledVector(up, 1.5), up.clone().negate(), 6);
};

test('the people stand on floors in their zones, the props are clear of the buildings', () => {
  for (const [id, n] of Object.entries(W.people)) {
    const d = floorUnder(n.pos);
    assert.ok(d > 1.0 && d < 2.6, `${id} stands on a floor (${d.toFixed(2)})`);
    assert.ok(['A', 'C'].includes(G.zoneId(n.pos)), `${id} lives where down is down for people (${G.zoneId(n.pos)})`);
  }
  for (const [label, p] of [['the relay box', G.relay.foot], ['the Major’s desk', G.desk.foot]]) {
    assert.equal(G.zoneId(p), 'B', `${label} is in the upside-down quarter`);
    const d = floorUnder(p);
    assert.ok(d > 1.3 && d < 1.7, `${label}: the slab under your feet (${d.toFixed(2)})`);
  }
  // the ball's lane up the ring's curve to the portal is open
  const ball = W.ball;
  assert.equal(G.zoneId(ball.pos), 'C');
  assert.ok(floorUnder(ball.pos) < 3, 'the ball sits on the ring floor');
});

test('the main quest: the signal goes round A, B and C, and the Major’s note waits at the desk', () => {
  assert.equal(quests.stage('garage.signal'), 'clerk');
  talk(PEOPLE.ambroise, ['What does the signal say', 'Can I carry it', 'Through the portal']);
  assert.ok(quests.has('signal'));
  step(2);
  assert.equal(quests.stage('garage.signal'), 'relay');
  // the guide routes through the portals to the relay box
  assert.ok(rt.objective(), 'an objective to follow');
  use('relay', G.relay.foot.clone().add(V(0.5, 0, 0)));   // E opens the box's page: posting it stamps it
  assert.equal(rt.dialogue.runner.nodeId, 'post');
  rt.dialogue.close();
  assert.equal(game.flag('garage.signal.stamped'), true);
  step(2);
  assert.equal(quests.stage('garage.signal'), 'ring');
  talk(PEOPLE.lune, ['The desk']);
  assert.ok(!quests.has('signal'), 'Lune keeps the round going');
  step(2);
  assert.equal(quests.stage('garage.signal'), 'note');
  use('note', G.desk.foot.clone().add(V(0.3, 0, 0.3)));
  assert.equal(rt.dialogue.runner.nodeId, 'read');
  rt.dialogue.close();
  assert.equal(talk(THINGS.note, []).nodeId, 'again');
  step(2);
  assert.equal(quests.isDone('garage.signal'), true);
  assert.equal(game.flag('world.garage.done'), true);
  assert.equal(game.flag('clue.garage.buried'), true, 'the clue: a wheel under sand');
  const k = game.keepsakes().find((x) => x.id === 'garage.knowing');
  assert.ok(k && k.kind === 'knowing' && /That is the point/.test(k.text), 'the keepsake: the Major’s note');
});

test('side quests: three machines restart when shot, and Pip’s ball crosses from the ring to the plateau', async () => {
  talk(PEOPLE.ottla, ['Can I help']);
  assert.equal(quests.stage('garage.machines'), 'fix');
  const machines = allTargets().filter((t) => t.kind === 'machine');
  assert.equal(machines.length, 3);
  for (const m of machines) {
    at(m.position().clone().add(V(0, 0, 12)));
    m.onHit('push');
    assert.ok(m.enabled(), 'a push only rocks it');
    m.onHit('shoot');
  }
  for (const id of ['mill', 'pump', 'turbine']) assert.equal(game.flag(`garage.machine.${id}`), true, id);
  step(60);
  for (const m of Object.values(G.machines)) assert.ok(m.speed > 0.5, 'turning');
  assert.equal(quests.stage('garage.machines'), 'tell');
  talk(PEOPLE.ottla, ['They just needed']);
  assert.equal(quests.isDone('garage.machines'), true);
  // Pip's ball: push it up the curve toward the portal on the wall, until it goes through
  talk(PEOPLE.pip, ['I’ll push it', 'Up the curve']);
  assert.equal(quests.stage('garage.ball'), 'push');
  const ballT = allTargets().find((t) => t.kind === 'ball');
  const portal = G.portals.find((p) => p.label === 'A');
  let pushes = 0;
  for (let i = 0; i < 40 && !game.flag('garage.ball.through'); i++) {
    const b = W.ball.pos;
    // stand behind it, push toward the portal along the floor
    const up = level.gravityAt(b);
    const to = portal.pos.clone().sub(b); to.addScaledVector(up, -to.dot(up)).normalize();
    at(b.clone().addScaledVector(to, -2));
    ballT.onHit('push', b.clone(), to, { strength: 1 });
    pushes++;
    step(30 * 4, 1 / 30);
  }
  assert.equal(game.flag('garage.ball.through'), true, `through after ${pushes} pushes`);
  assert.equal(G.zoneId(W.ball.pos), 'A', 'the ball is on the plateau now');
  assert.ok(pushes > 1 && pushes < 20, `it takes a few pushes up the curve (${pushes})`);
  step(2);
  assert.equal(quests.stage('garage.ball'), 'tell');
  talk(PEOPLE.pip, ['Very new']);
  assert.equal(quests.isDone('garage.ball'), true);
  // the locals talk too
  for (const l of LOCALS) talk(l, []);
  await new Promise((r) => setTimeout(r, 1600));
  assert.ok(storyDone, 'the main quest closed the Garage’s story page');
  clearInteractables(); clearTargets();
});
