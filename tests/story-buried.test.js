import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createBuried } = await import('../src/levels/buried.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS, AMBER } = await import('../src/story/buried-data.js');
const { TURN_TIME, CLEAR_TIME, JIB_PHI0, JIB_STEP, JIB_IN } = await import('../src/story/buried.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets, clearTargets, targetsInCone } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
clearInteractables(); clearTargets();
const scene = new THREE.Scene();
const level = createBuried(scene);
const physics = new Physics(scene, level.ground);
const B = level.buried;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = spawnNPCs(scene, physics, CONTENT.buried.npcs);
const rt = createStory({ levelId: 'buried', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); camera.lookAt(player.pos); camera.updateMatrixWorld(); rt.update(dt, clock, { camera }); } };
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
const target = (kind, i = 0) => allTargets().filter((t) => t.kind === kind)[i];
const stand = (p, label, tol = 1.2) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < tol, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
};

test('the people of the domes, the canyon and the oculus stand on walkable ground', () => {
  const W = rt.world.people;
  for (const id of ['wen', 'hask', 'dun', 'pim', 'ossa', 'tull']) assert.ok(W[id], `${id} is in the world`);
  for (const [id, n] of Object.entries(W)) {
    for (const [k, p] of n.route.entries()) {
      stand(p, `${id}'s route point ${k}`);
      // a gentle place to stand: not on a dome's shoulder or a pipe
      const nrm = physics.groundNormal(p.x, p.y + 1, p.z);
      assert.ok(nrm.y > 0.8, `${id} stands on level ground (n.y ${nrm.y.toFixed(2)})`);
    }
  }
  // the places the quest sends you to are reachable surfaces
  stand(B.wick.valve.at.clone().add(V(2, 0, 0)).setY(B.oculus.floor), 'the floor by the valve', 0.3);
  for (const g of B.gauges) stand(g.stand, `the canyon floor by the gauge at z ${g.z}`, 0.3);
  stand(B.wheel.drop, 'the sand at the wheel’s foot', 0.6);
  const balcony = physics.groundAt(B.oculus.x, 10, B.oculus.z - B.oculus.r + 3, 30);
  assert.ok(Math.abs(balcony - B.oculus.balcony) < 0.05, 'the balcony under the warm window');
});

test('the main quest: Tooth Day, the Wick lit, the wheel turns one tooth, Wen counts it', async () => {
  const Q = 'buried.tooth';
  // it doesn't just appear: it waits for its first talk, and till then the scout finds who to ask
  assert.equal(quests.stage(Q), undefined);
  assert.equal(quests.openerObjective()?.id, `opener-${Q}`);
  talk(PEOPLE.wen, ['What wheel?', 'And it turns today?']);
  step(2);
  assert.equal(quests.stage(Q), 'hask');
  talk(PEOPLE.hask, ['Why not this year?', 'Then let me light it.']);
  assert.equal(game.flag('buried.rumour.light'), true, 'Hask saw the Tuning Star');
  step(2);
  assert.equal(quests.stage(Q), 'down');
  at(V(B.canyonX(-180), B.floorAt(-180), -180)); step(2);
  assert.equal(quests.stage(Q), 'oculus');
  at(V(B.oculus.x - 4, B.oculus.floor, B.oculus.z + 12)); step(2);
  assert.equal(quests.stage(Q), 'valve');
  // the valve: a shot only rings it; a push turns it
  const valve = target('valve');
  assert.ok(valve?.enabled(), 'the valve is a target');
  valve.onHit('shoot');
  assert.equal(game.flag('buried.valve.open'), undefined);
  // a shot on the dry wick does nothing
  target('wick').onHit('shoot');
  assert.equal(game.flag('buried.oculus.lit'), undefined, 'no oil, no flame');
  valve.onHit('push');
  assert.equal(game.flag('buried.valve.open'), true);
  step(10);
  assert.equal(quests.stage(Q), 'light');
  target('wick').onHit('shoot');
  assert.equal(game.flag('buried.oculus.lit'), true);
  step(2);
  assert.equal(quests.stage(Q), 'watch');
  // stand in the Wick's light: the tank fills and takes the amber band
  const refills = [];
  game.on('tool:refill', (e) => refills.push(e));
  step(150, 1 / 30);   // the light comes up
  at(B.wick.centre.clone().add(V(2.5, 0, 0))); step(2);
  assert.deepEqual(refills.map((e) => [e.addColour, e.tone]), [[true, AMBER]], 'the oil-light adds an amber band, once');
  at(B.wick.centre.clone().add(V(20, 0, 0))); step(2);
  at(B.wick.centre.clone().add(V(2, 0, 0))); step(2);
  assert.equal(refills.length, 2); assert.equal(refills[1].addColour, false, 'later visits just refill');
  // nothing turns while you're down in the canyon
  step(60, 0.1);
  assert.equal(game.flag('buried.wheel.turned'), undefined);
  // in front of the wheel: it turns, the city rocks, the tooth drops
  const W = B.wheel;
  at(W.drop.clone().addScaledVector(W.face, 20));
  const before = W.spin.rotation.z;
  const sandBefore = level.ground.heightAt(W.centre.x + W.face.x * 5, W.centre.z + W.face.z * 5);
  for (let i = 0; i < (TURN_TIME + 3) / 0.1 && !game.flag('buried.wheel.turned'); i++) step(1, 0.1);
  assert.equal(game.flag('buried.wheel.turned'), true);
  assert.ok(Math.abs(W.spin.rotation.z - before + Math.PI * 2 / W.teeth) < 1e-3, 'one tooth round');
  assert.ok(Math.abs(B.city.rotation.z) > 0.002 || Math.abs(B.city.rotation.x) > 0.002, 'the hanging city sways');
  // then the sand slides off it, and it keeps turning
  step(Math.ceil((CLEAR_TIME + 2) / 0.1), 0.1);
  assert.equal(W.cleared, 1, 'the sand is gone');
  const sandAfter = level.ground.heightAt(W.centre.x + W.face.x * 5, W.centre.z + W.face.z * 5);
  assert.ok(sandBefore - sandAfter > 8, `a hollow along its face (${(sandBefore - sandAfter).toFixed(1)} m)`);
  assert.ok(physics.groundAt(W.centre.x + W.face.x * 5, sandBefore + 5, W.centre.z + W.face.z * 5) < sandBefore - 8, 'and you can walk down into it');
  const spun = W.spin.rotation.z;
  step(50, 0.1);
  assert.ok(spun - W.spin.rotation.z > 0.1, 'still turning');
  assert.ok(toasts.some((t) => t.includes('keeps on turning')));
  assert.equal(quests.stage(Q), 'tooth');
  at(W.drop.clone()); step(20, 0.1);
  const e = bestInteractable(player);
  assert.equal(e?.entry.id, 'tooth');
  e.entry.use(player);
  assert.ok(quests.has('tooth'));
  step(2);
  assert.equal(quests.stage(Q), 'count');
  talk(PEOPLE.wen, []);
  assert.equal(quests.isDone(Q), true);
  assert.equal(game.flag('world.buried.done'), true);
  const k = game.keepsakes().find((x) => x.id === 'buried.thing');
  assert.ok(k && k.kind === 'thing', 'the keepsake: a rust gear tooth');
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone, 'the main quest closed the world’s story page');
});

test('side quests: Dun’s key off the floating derrick, the three gauges, the warm window', () => {
  // the key
  talk(PEOPLE.dun, ['Sightseeing where?', 'I’ll fetch it.']);
  assert.equal(quests.stage('buried.key'), 'swing');
  // the hook hangs out over the drop: no reaching it, even hovering beside it
  const C = B.crane, plat = C.root.y;
  const out = quests.where({ at: 'key' });
  assert.ok(Math.hypot(out.x - B.tower.x, out.z - B.tower.z) > 12, 'the hook hangs out past the platform’s rim');
  at(out.clone().add(V(0.5, -1, 0)));
  assert.notEqual(bestInteractable(player)?.entry.id, 'key', 'the key is out of reach while the jib is out');
  // the jib: a shove on the rusted collar does nothing; a splash frees it
  const jib = target('jib');
  const phi = () => JIB_PHI0 - (game.flag('buried.jib.notch') ?? 0) * JIB_STEP;
  const round = (k = 1) => V(Math.sin(phi()) * k, 0, -Math.cos(phi()) * k);   // the way the pawl lets it go
  at(V(C.root.x - 2, plat, C.root.z + 0.5));
  stand(player.pos, 'the derrick’s platform by the crane', 0.3);
  assert.ok(jib.enabled());
  jib.onHit('push', null, round());
  assert.equal(game.flag('buried.jib.notch'), undefined, 'rusted solid');
  assert.ok(toasts.at(-1).includes('rusted solid'));
  jib.onHit('shoot');
  assert.equal(game.flag('buried.jib.oiled'), true);
  // end-on it shudders, the wrong way the pawl holds
  jib.onHit('push', null, V(Math.cos(phi()), 0, Math.sin(phi())));
  assert.ok(toasts.at(-1).includes('side-on'));
  jib.onHit('push', null, round(-1));
  assert.ok(toasts.at(-1).includes('other way'));
  assert.equal(game.flag('buried.jib.notch'), undefined);
  // the right way: a real push from the platform reaches the jib (not hidden behind the cabin), and it clicks round
  for (let i = 0; i < JIB_IN; i++) {
    step(60, 1 / 30);   // (it swings round to the notch)
    const j = jib.position().clone(), side = round();
    let hit = null;
    for (const back of [2.5, 2, 3, 1.5]) for (const lean of [0, 1.5, -1.5]) {
      if (hit) break;
      const p = j.clone().addScaledVector(side, -back).add(V(Math.cos(phi()) * lean, 0, Math.sin(phi()) * lean));
      const g = physics.groundAt(p.x, plat + 2, p.z, 4);
      if (!Number.isFinite(g) || Math.abs(g - plat) > 0.3 || Math.hypot(p.x - B.tower.x, p.z - B.tower.z) > 7.6) continue;
      const origin = V(p.x, g + 1.15, p.z), aim = j.clone().sub(origin).normalize();
      aim.y *= 0.25; aim.normalize();   // (a quick push is flattened toward the ground)
      const h = targetsInCone(origin, aim, 6, 0.62, physics).find((x) => x.target === jib);
      if (h && Math.cos(phi()) * h.dir.z - Math.sin(phi()) * h.dir.x < -0.3) hit = h;
    }
    assert.ok(hit, `notch ${i}: you can stand on the platform and shove the jib round`);
    jib.onHit('push', hit.point, hit.dir);
    assert.equal(game.flag('buried.jib.notch'), i + 1);
  }
  assert.equal(game.flag('buried.jib.in'), true);
  assert.ok(!jib.enabled(), 'once in, the jib is done');
  step(120, 1 / 30);
  assert.equal(quests.stage('buried.key'), 'find');
  const hook = quests.where(quests.current('buried.key'));
  assert.ok(Math.hypot(hook.x - B.tower.x, hook.z - B.tower.z) < 7, 'the hook hangs over the platform now');
  assert.ok(hook.y - plat > 0.8 && hook.y - plat < 2.5, `at a reachable height (${(hook.y - plat).toFixed(2)} m)`);
  at(V(hook.x + 1, plat, hook.z));
  stand(player.pos, 'the platform under the hook', 0.3);
  let e = bestInteractable(player);
  assert.equal(e?.entry.id, 'key');
  e.entry.use(player);
  assert.equal(quests.stage('buried.key'), 'return');
  talk(PEOPLE.dun, []);
  assert.equal(quests.isDone('buried.key'), true);
  assert.equal(game.flag('buried.chimneys.open'), true);
  // the gauges: a push only rattles a needle, a shot reads it
  talk(PEOPLE.ossa, ['What do they say?', 'I’ll read them']);
  assert.equal(quests.stage('buried.gauges'), 'read');
  at(B.gauges[0].stand);
  target('gauge', 0).onHit('push');
  assert.equal(game.flag('buried.gauge.0'), undefined);
  for (let i = 0; i < 3; i++) target('gauge', i).onHit('shoot');
  step(60, 1 / 30);
  assert.ok(Math.abs(B.gauges[1].needle.rotation.z - -0.47 * Math.PI) < 0.02, 'the needle settles on ninety-one');
  assert.equal(quests.stage('buried.gauges'), 'tell');
  talk(PEOPLE.ossa, []);
  assert.equal(quests.isDone('buried.gauges'), true);
  assert.equal(game.flag('clue.buried.mark'), true, 'the Maker’s Thumb is the glyph');
  // the window, and the numbers by the doorway (the clue back to the Glass Dunes' clock-winder)
  talk(PEOPLE.tull, ['What’s behind the window?', 'I’ll climb up']);
  assert.equal(quests.stage('buried.window'), 'climb');
  at(V(B.oculus.x, B.oculus.balcony, B.oculus.z - B.oculus.r + 3));
  e = bestInteractable(player);
  assert.equal(e?.entry.id, 'window');
  talk(THINGS.window, [0]);
  step(2);
  assert.equal(quests.isDone('buried.window'), true);
  talk(THINGS.numbers, [0]);
  assert.equal(game.flag('clue.buried.garage'), true);
  clearInteractables(); clearTargets();
});

test('a later visit: the wheel stands in its hollow, bare of sand, and is still turning', () => {
  assert.equal(game.flag('buried.wheel.turned'), true);
  clearInteractables(); clearTargets();
  const scene2 = new THREE.Scene();
  const level2 = createBuried(scene2);
  const physics2 = new Physics(scene2, level2.ground);
  const W = level2.buried.wheel;
  const heaped = level2.ground.heightAt(W.centre.x, W.centre.z);
  const rt2 = createStory({ levelId: 'buried', scene: scene2, physics: physics2, level: level2, player, npcs: spawnNPCs(scene2, physics2, CONTENT.buried.npcs), crowd: null, sound,
    journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} }, capture: null, lib: null, humans: null, toast: () => {}, tool: null });
  assert.equal(W.cleared, 1, 'the sand stays gone');
  assert.ok(heaped - level2.ground.heightAt(W.centre.x, W.centre.z) > 9);
  const a = W.spin.rotation.z;
  at(W.drop.clone().addScaledVector(W.face, 30));
  for (let i = 0; i < 60; i++) rt2.update(0.1, 100 + i * 0.1, { camera });
  assert.ok(a - W.spin.rotation.z > 0.1, 'it keeps turning');
  clearInteractables(); clearTargets();
});

test('the wheel that keeps turning: Wen reads the last tooth the gentle way, and Hask agrees', () => {
  assert.equal(quests.isDone('buried.tooth'), true);
  const r = new DialogueRunner(PEOPLE.wen, { game, quests });
  const said = [];
  while (!r.lastPage) { said.push(r.text); r.advance(); }
  r.choose(r.choices().find((x) => /last tooth/.test(x.text)).index);
  while (!r.ended) { said.push(r.text); if (!r.advance()) break; }
  assert.match(said.join(' '), /hasn’t got a last tooth/);
  assert.match(said.join(' '), /whichever one keeps it turning/);
  assert.equal(game.flag('buried.wen.last'), true);
  const h = new DialogueRunner(PEOPLE.hask, { game, quests });
  assert.match(h.pages.join(' '), /No last tooth on a wheel, only the one that keeps it going/);
});

test('an old save waiting at the hook (from before the crane swung) is sent to swing the jib first', () => {
  clearInteractables(); clearTargets();
  game.reset();
  game.set('quest.buried.key', 'find');
  const scene3 = new THREE.Scene();
  const level3 = createBuried(scene3);
  const physics3 = new Physics(scene3, level3.ground);
  const rt3 = createStory({ levelId: 'buried', scene: scene3, physics: physics3, level: level3, player, npcs: spawnNPCs(scene3, physics3, CONTENT.buried.npcs), crowd: null, sound,
    journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} }, capture: null, lib: null, humans: null, toast: () => {}, tool: null });
  assert.equal(rt3.quests.stage('buried.key'), 'swing', 'the key still hangs out over the drop');
  at(level3.buried.crane.root.clone());
  assert.ok(target('jib')?.enabled(), 'and the jib is there to swing');
  clearInteractables(); clearTargets();
});

test('out of order: the Wick lit and the gauges read before anyone asked; Wen and Ket still carry their quests on', () => {
  clearInteractables(); clearTargets();
  game.reset();
  // Wen's directions and Ket's own lines say where the Wick is: a player can go down and light it first
  for (const f of ['buried.canyon.seen', 'buried.oculus.seen', 'buried.valve.open', 'buried.oculus.lit', 'buried.gauges.read']) game.set(f, true);
  const scene4 = new THREE.Scene();
  const level4 = createBuried(scene4);
  const physics4 = new Physics(scene4, level4.ground);
  const rt4 = createStory({ levelId: 'buried', scene: scene4, physics: physics4, level: level4, player, npcs: spawnNPCs(scene4, physics4, CONTENT.buried.npcs), crowd: null, sound,
    journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} }, capture: null, lib: null, humans: null, toast: () => {}, tool: null });
  const q4 = rt4.quests;
  const say = (person) => { q4.opening(person.id); const r = new DialogueRunner(person, { game, quests: q4 }); while (!r.ended && r.advance()); q4.opened(); return r; };
  say(PEOPLE.wen);
  for (let i = 0; i < 8; i++) rt4.update(1 / 30, i / 30, { camera });
  assert.equal(q4.stage('buried.tooth'), 'watch', 'Wen’s and Hask’s talks pass over: on to the wheel');
  // Ket, met after the three gauges were read: her reading starts and ends the quest
  say(PEOPLE.ossa);
  assert.equal(q4.isDone('buried.gauges'), true);
  clearInteractables(); clearTargets();
});
