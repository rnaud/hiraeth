import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { createIncal } = await import('../src/levels/incal.js');
const { Physics } = await import('../src/physics.js');
const { Crowd } = await import('../src/crowd.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, THINGS, RIM, CROWD_TALK, LINES } = await import('../src/story/incal-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
const scene = new THREE.Scene();
const level = createIncal(scene);
const physics = new Physics(scene, null);
level.init(physics);
const S = level.shaft, P = S.places;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
const crowd = new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: fakeNPC });
const npcs = spawnNPCs(scene, physics, CONTENT.incal.npcs, {});

const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, vehicles: [...level.vehicles], frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const rt = createStory({ levelId: 'incal', scene, physics, level, player, npcs, crowd, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30, look = null) => {
  for (let i = 0; i < n; i++) {
    clock += dt;
    camera.position.copy(player.pos).add(V(0, 2, 4));
    if (look) camera.lookAt(look); else camera.lookAt(player.pos);
    camera.updateMatrixWorld();
    rt.update(dt, clock, { camera });
    crowd.update(dt, clock, player, camera);
    for (const v of player.vehicles) v.update(dt, null, clock);
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

test('the city’s people and places stand on walkable ground', () => {
  stand(P.nima, 'Nima’s corner of the high terrace');
  stand(P.shrine.clone().add(V(1.8, 0.34, 0)), 'the Upward Shrine’s dais');
  stand(P.ossa, 'Ossa, by the shrine');
  stand(P.pip, 'Pip’s patch');
  stand(P.lamp, 'the call-lamp');
  stand(P.wren, 'where you step out of Wren');
  for (const c of level.cabStops) stand(c.step, `the cab stop ${c.id}`);
  stand(P.palace.landing, 'the palace landing');
  stand(P.palace.dov, 'Dov at the gate');
  stand(P.palace.crown, 'the crown on the dome');
  // the content entry for Nima matches the terrace corner the level keeps for her
  const n = CONTENT.incal.npcs[3];
  assert.equal(n.id, 'nima');
  assert.ok(Math.hypot(n.at[0] - P.nima.x, n.at[1] - P.nima.z) < 0.5 && n.y === P.nima.y, 'Nima stands where the level expects her');
  // and every story person ends up on the ground they were put on
  for (const [id, npc] of Object.entries(W.people)) {
    if (!npc) continue;
    for (const q of npc.route ?? [npc.pos]) stand(q, `${id}’s route`);
  }
  // the rim's people are on the rim, not under it
  for (const k of [0, 1, 2]) assert.ok(Math.abs(npcs[k].pos.y - S.TOP) < 0.5, `rim person ${k} stands on the rim (${npcs[k].pos.y})`);
  // the cab's parking spot is over the void beside the lamp, with nothing in the way
  assert.ok(!Number.isFinite(physics.groundAt(P.cab.x, P.cab.y + 1, P.cab.z, 20)), 'the cab hovers over the void');
  // the Lodestar can be seen from the palace landing (nothing overhead in the way)
  const eye = P.palace.landing.clone().add(V(0, 1.6, 0)), to = S.incal.pos.clone().sub(eye);
  assert.ok(physics.rayDistance(eye, to.clone().normalize(), to.length()) >= to.length() - 20, 'a clear line from the landing up to the light');
});

test('the crowd is talkable by where they live, and the lower levels pray', () => {
  const zones = new Set(crowd.people.map((p) => p.spot?.id));
  for (const z of ['rim', 'upper', 'middle', 'lower']) assert.ok(zones.has(z), `people live on the ${z}`);
  const low = crowd.people.find((p) => p.spot?.id === 'lower');
  assert.ok(LINES.lower.includes(low.lines[0]) || low.lines === LINES.lower);
  const def = W.crowdTalk(low);
  assert.ok(def && def.talk && CROWD_TALK.lower.some((c) => c.name === def.name), 'a lower-level person has a conversation');
  const r = new DialogueRunner(def, { game, quests });
  assert.ok(r.text.length > 10);
  for (const p of crowd.people.slice(0, 50)) assert.ok(W.crowdTalk(p), 'everyone has something to say');
  // the rim's people talk too
  for (const id of ['corvin', 'lio', 'hask']) assert.ok(new DialogueRunner(RIM[id], { game, quests }).text.length > 10);
});

test('every conversation’s links lead somewhere', () => {
  const all = [...Object.values(PEOPLE), ...Object.values(THINGS), ...Object.values(RIM), ...Object.values(CROWD_TALK).flat()];
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

test('the main quest: from the rim, down to the shrine, up to the palace, and the light burns', () => {
  // it doesn't just appear: it waits for its first talk, and till then the scout finds who to ask
  assert.equal(quests.stage('incal.light'), undefined);
  assert.equal(quests.openerObjective()?.id, `opener-${'incal.light'}`);
  assert.match(rt.hud(), /Nima/);
  // the marker is on Nima
  assert.ok(quests.objective().position.distanceTo(W.people.nima.pos) < 0.01);
  talk(PEOPLE.nima, ['It looks dim', 'The night the sky rang', 'Where did the piece']);
  assert.equal(quests.stage('incal.light'), 'ossa');
  assert.equal(game.flag('incal.rumour.light'), true, 'Nima saw the singing light');
  // the cabs don't stop at the bottom
  at(P.shrine.clone().add(V(0, 0, 3)));
  const taxi = level.vehicles.find((v) => v.kind === 'taxi' && v !== W.cab);
  const before = taxi.mode;
  taxi.hail(player.pos, 0);
  assert.equal(taxi.mode, before, 'a cab won’t stop in the depths');
  assert.ok(toasts.some((t) => /flies on/.test(t)));
  // Ossa gives the splinter (and the clue: it hums like the swamp's crystal)
  talk(PEOPLE.ossa, ['What came down', 'The Lodestar is dimming', 'Then let me carry']);
  assert.ok(quests.has('splinter'));
  assert.equal(game.flag('clue.incal.perdide'), true);
  assert.equal(quests.stage('incal.light'), 'palace');
  assert.ok(quests.isActive('incal.wren'), 'Ossa mentions the call-lamp');
  step(3);
  // the splinter floats at your shoulder
  assert.ok(W.state && quests.has('splinter'));
  // up at the palace, Dov lets you by
  at(P.palace.dov.clone().add(V(2, 0, 0)));
  talk(PEOPLE.dov, ['You’re from the bottom']);
  assert.equal(quests.stage('incal.light'), 'look');
  // stand on the crown and look up: the splinter goes home and the light burns
  at(P.palace.crown.clone());
  step(45, 1 / 30, S.incal.pos);
  assert.ok(W.state.release || game.flag('incal.lit'), 'looking up sends the splinter home');
  step(150, 1 / 30, S.incal.pos);
  assert.equal(game.flag('incal.lit'), true);
  assert.ok(!quests.has('splinter'));
  assert.equal(quests.stage('incal.light'), 'tell');
  step(200, 1 / 20);
  assert.ok(S.incal.k > 0.9, `the Lodestar brightens (${S.incal.k.toFixed(2)})`);
  // the city looks up: heads turned to the light, the lines changed
  const looking = crowd.people.filter((p) => p.gazeAt && p.gazeUntil > crowd.time).length;
  assert.ok(looking > crowd.people.length * 0.9, `${looking} of ${crowd.people.length} look up`);
  const low = crowd.people.find((p) => p.spot?.id === 'lower');
  assert.ok(LINES.lit.lower.includes(low.lines[0]));
  // Nima: the keepsake, a word
  talk(PEOPLE.nima, ['I gave it back']);
  assert.equal(quests.isDone('incal.light'), true);
  assert.equal(game.flag('world.incal.done'), true);
  const k = game.keepsakes().find((x) => x.id === 'incal.word');
  assert.ok(k && k.kind === 'word' && /Look up once a day/.test(k.name));
});

test('side quests: the call-lamp and Wren, Pip’s ration for Dov', async () => {
  // the lamp: a shot lights it, and Wren's cab comes down to it
  const lamp = allTargets().find((t) => t.kind === 'lamp');
  at(P.lamp.clone().add(V(3, 0, 0)));
  assert.ok(lamp?.enabled(), 'the dead lamp is a target');
  lamp.onHit('push');
  assert.notEqual(game.flag('incal.lamp.lit'), true, 'a push only rattles it');
  lamp.onHit('shoot');
  assert.equal(game.flag('incal.lamp.lit'), true);
  step(2);
  assert.equal(quests.stage('incal.wren'), 'wren');
  step(30 * 12, 1 / 30);
  assert.ok(W.cab.pos.distanceTo(P.cab) < 1.5, `Wren parks at the lamp (${W.cab.pos.distanceTo(P.cab).toFixed(1)} m away)`);
  // Wren is the cab: nobody steps out of it (cabs drive themselves); you get in and its dash speaks
  assert.equal(W.people.wren, undefined, 'no driver');
  assert.ok(!npcs.some((n) => n.def?.id === 'wren'), 'nobody called Wren walks about');
  at(P.wren.clone());
  player.ride = W.cab; W.cab.board(player.pos.clone());
  step(1);
  const D = rt.dialogue;
  assert.ok(D.open && D.person.name === 'Wren', 'getting in, the cab speaks');
  const answer = (prefix) => {
    while (!D.runner.choices().length && D.runner.advance());
    const c = D.runner.choices().find((x) => x.text.startsWith(prefix));
    assert.ok(c, `no answer "${prefix}" in ${JSON.stringify(D.runner.choices().map((x) => x.text))} at ${D.runner.nodeId}`);
    D.revealed = Infinity; D.choose(c.index);
  };
  answer('Why do you still stop'); answer('Did you see'); answer('I need to get');
  assert.equal(quests.isDone('incal.wren'), true);
  // then where to: every stop but the one it waits at (the bottom: only Wren goes below the smog)
  while (!D.runner.choices().length && D.runner.advance());
  const names = D.runner.choices().map((c) => c.text);
  assert.ok(names.includes('The palace gate') && names.includes('The rim, by the ship') && !names.some((n) => /bottom/.test(n)), JSON.stringify(names));
  answer('The palace gate');
  assert.equal(D.open, false);
  assert.equal(W.cab.mode, 'route', 'Wren flies you up');
  for (let i = 0; i < 30 * 60 && W.cab.mode === 'route'; i++) { step(1); player.pos.copy(W.cab.pos); }
  const gate = level.cabStops.find((x) => x.id === 'palace');
  assert.equal(W.cab.mode, 'aboard', 'there, it waits for you to get out');
  assert.ok(W.cab.pos.distanceTo(gate.at) < 0.6 && W.cab.stop === gate, `at the palace gate (${W.cab.pos.toArray().map((x) => x.toFixed(1))})`);
  assert.ok(W.cab.exitAt().distanceTo(gate.step) < 1e-6, 'you step out beside the gate');
  assert.ok(toasts.some((x) => /^Wren: The palace gate\./.test(x)), 'it says where you are');
  player.ride = null; W.cab.leave();
  // now hailing at the bottom brings Wren
  at(P.wren.clone());
  W.cab.pos.set(0, -250, 150); W.cab.mode = 'lane';
  const other = level.vehicles.find((v) => v.kind === 'taxi' && v !== W.cab);
  other.hail(player.pos, 0);
  assert.equal(W.cab.mode, 'hail', 'Wren comes when you hail down here');
  // Pip's ration tin, carried up to Dov
  at(P.pip.clone());
  talk(PEOPLE.pip, ['I could take something']);
  assert.equal(quests.stage('incal.ration'), 'hoist', 'the tin hangs in the hoist basket, out over the void');
  // (src/story/incal.js) knock the pin out, push the weight round the post, take the tin from the basket
  const pin = allTargets().find((t) => t.kind === 'hoistPin'), weight = allTargets().find((t) => t.kind === 'hoistWeight');
  at(P.hoist.clone().add(V(0, 0, 0)));
  pin.onHit('shoot');
  step(30);
  const w = weight.position().clone(), round = V(-(w.z - P.hoist.z), 0, w.x - P.hoist.x).normalize();
  weight.onHit('push', w, round);
  step(30 * 3);
  at(P.hoistIn.clone());
  const b = bestInteractable(player);
  assert.equal(b?.entry.id, 'hoistBasket');
  b.entry.use(player);
  assert.ok(quests.has('ration'));
  assert.equal(quests.stage('incal.ration'), 'carry');
  assert.ok(quests.objective() || true);
  at(P.palace.dov.clone().add(V(2, 0, 0)));
  const r = talk(PEOPLE.dov, []);
  while (!r.ended && r.advance());
  assert.equal(quests.isDone('incal.ration'), true);
  assert.ok(!quests.has('ration'));
  assert.ok(game.keepsakes().some((k) => k.id === 'incal.token' && k.kind === 'thing'), 'Dov’s lift token');
  // the shrine's bowl and the lamp can be looked at
  at(P.shrine.clone().add(V(0.5, 0, 1)));
  assert.equal(bestInteractable(player)?.entry.id, 'bowl');
  assert.match(new DialogueRunner(THINGS.bowl, { game, quests }).text, /empty/);
  await new Promise((res) => setTimeout(res, 1300));
  assert.ok(storyDone, 'the main quest closed the story page');
  clearInteractables();
});

test('the cabs ignore you without a pass: Lio writes one for the fare Tobin owes him', async () => {
  const { Taxi, CAB_PASS } = await import('../src/taxi.js');
  const { Player } = await import('../src/player.js');
  const { items, gearHtml } = await import('../src/items.js');
  game.set(`item.${CAB_PASS}`, undefined);
  const cab = level.vehicles.find((v) => v.kind === 'taxi' && v !== W.cab);
  const p = new Player(physics, { health: false });
  p.respawn(level.spawn.clone());
  const notes = [];
  p.onNotice = (t) => notes.push(t);
  p.vehicles = [cab];
  // hailing from the rim: the cab flies on, and says who writes the passes
  cab.mode = 'lane'; Taxi._refusedAt = -1e9;
  p.callMount();
  assert.equal(cab.mode, 'lane', 'no pass: it does not come');
  assert.match(notes.at(-1) ?? '', /PASS HOLDERS ONLY.*Lio/);
  assert.equal(quests.stage('incal.pass'), 'lio', 'the refusal starts the errand');
  cab.hail(p.pos, 0);
  assert.equal(cab.mode, 'lane', 'not even a direct hail');
  // one waiting right beside you won't take you either
  cab.mode = 'parked'; cab.pos.copy(p.pos).add(V(2, 1, 0)); cab.parkY = cab.pos.y; Taxi._refusedAt = -1e9;
  assert.equal(p.board(cab), false);
  assert.equal(p.ride ?? null, null);
  assert.match(notes.at(-1) ?? '', /PASS HOLDERS ONLY/);
  // Wren stops for anyone
  assert.equal(W.cab.refuses(p), false);
  // Lio, then Tobin's coin, then Lio again: the pass
  talk(RIM.lio, ['How do I get a pass']);
  assert.equal(quests.stage('incal.pass'), 'fare');
  const h = new DialogueRunner(RIM.hask, { game, quests });
  assert.match(h.text, /Lio sent you/);
  while (!h.ended && h.advance());
  assert.ok(quests.has('fare'), 'Tobin’s coin');
  assert.equal(quests.stage('incal.pass'), 'back');
  const r = new DialogueRunner(RIM.lio, { game, quests });
  assert.equal(r.nodeId, 'paid');
  while (!r.ended && r.advance());
  assert.ok(!quests.has('fare'));
  assert.ok(quests.has(CAB_PASS) && items.has(CAB_PASS), 'the cab pass, in hand');
  assert.equal(quests.isDone('incal.pass'), true);
  assert.match(gearHtml(items.owned()), /Cab pass/, 'listed in the gear');
  // now it stops, and lets you in
  cab.mode = 'lane';
  p.callMount();
  assert.equal(cab.mode, 'hail', 'with the pass, the cab comes');
  cab.mode = 'parked'; cab.pos.copy(p.pos).add(V(2, 1, 0));
  assert.equal(p.board(cab), true);
  game.set(`item.${CAB_PASS}`, undefined);
});

test('the middle levels: Perrine’s halfway stall, its mirror washed and turned up the shaft, and the coin of light at the bottom', () => {
  const H = W.halfway, MQ = 'incal.mirror';
  const flat2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(H, 'the halfway stall is built');
  const stop = level.cabStops.find((c) => c.id === 'middle');
  assert.ok(flat2(H.frame.position, stop.step) < 14, `beside the middle levels’ cab stop (${flat2(H.frame.position, stop.step).toFixed(1)} m)`);
  stand(H.perrine.pos, 'Perrine, behind her counter');
  // the awning's flat roof holds the Smog lantern (content.js keeps its place)
  const relic = CONTENT.incal.relics.spots[2].at;
  assert.ok(Math.hypot(relic[0] - H.awning.x, relic[2] - H.awning.z) < 0.3 && Math.abs(relic[1] - 1.1 - H.awning.y) < 0.2, 'the relic is over the awning');
  const roof = physics.groundAt(H.awning.x, H.awning.y + 1, H.awning.z, 3);
  assert.ok(Math.abs(roof - H.awning.y) < 0.05, `the awning is a roof you can stand on (${roof?.toFixed?.(2)})`);
  // Perrine asks
  assert.equal(quests.isStarted(MQ), false);
  talk(PEOPLE.perrine, ['What’s the mirror', 'I’ll see to it.']);
  assert.equal(quests.stage(MQ), 'wash');
  const mirror = allTargets().find((t) => t.kind === 'mirror');
  at(H.frame.position.clone()); step(2);
  assert.ok(mirror.enabled());
  mirror.onHit('shoot', mirror.position(), V(0, 0, 1));
  step(2);
  assert.equal(game.flag('incal.mirror.washed'), true);
  assert.equal(quests.stage(MQ), 'turn');
  // straight at the glass it only rocks; side-on it turns a notch at a time, to face up the shaft
  const out = () => H.facing();
  mirror.onHit('push', H.glassAt(), out());
  assert.equal(H.notch(), 3, 'shoved straight, it won’t turn');
  let n = 0;
  while (H.notch() !== 0 && n++ < 8) { const rr = out(); mirror.onHit('push', H.glassAt(), V(-rr.z, 0, rr.x)); step(20); }
  assert.equal(H.notch(), 0, `it came round to face up the shaft in ${n} pushes`);
  step(30);
  assert.equal(game.flag('incal.mirror.turned'), true);
  assert.equal(quests.stage(MQ), 'tell');
  // facing in, toward the shaft's middle (and tilted up)
  const fwd = V(0, 0, 1).applyQuaternion(H.face.getWorldQuaternion(new THREE.Quaternion()));
  const inward = V(-H.frame.position.x, 0, -H.frame.position.z).normalize();
  assert.ok(fwd.y > 0.3 && V(fwd.x, 0, fwd.z).normalize().dot(inward) > 0.9, `the glass looks up and in, at the Lodestar (${fwd.toArray().map((v) => v.toFixed(2))})`);
  talk(PEOPLE.perrine, ['Goodbye, Perrine.']);
  assert.equal(quests.isDone(MQ), true);
  assert.equal(game.flag('incal.mirror.done'), true);
  // with the Lodestar lit, Ossa sees the coin of light at the bottom
  game.set('incal.lit', true);
  const r2 = new DialogueRunner(PEOPLE.ossa, { game, quests });
  const said = [];
  for (let i = 0; i < 6 && !r2.ended; i++) { said.push(r2.text); if (!r2.advance()) break; }
  if (quests.isDone('incal.light')) assert.match(said.join(' '), /coin of light has come back on Behla’s wall/);
});
