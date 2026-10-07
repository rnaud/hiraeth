import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const quiet = (f) => { const w = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = w; } };
const { createArzach } = await import('../src/levels/arzach.js');
const { Physics } = await import('../src/physics.js');
const { NPC } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, LOCALS, THINGS, KNUCKLE_ORDER, RIDER_CALL, QUESTS } = await import('../src/story/arzach-data.js');
const { windContains, windLift } = await import('../src/story/arzach.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
clearInteractables(); clearTargets();
const scene = new THREE.Scene();
const level = quiet(() => createArzach(scene));
const physics = new Physics(scene, level.ground);
const A = level.arzach;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// the bird is the level's mount: a real one, so her look and her bow run
const bird = level.mount(physics);
const player = { pos: V(0, 0, 0), vel: V(), heading: 0, riding: false, ride: null, mount: bird, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); return player; };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
// the level's own people (content.js), as main.js spawns them
const npcs = CONTENT.arzach.npcs.map((s) => new NPC(scene, physics, { route: [V(s.at[0], physics.groundAt(s.at[0], 1e4, s.at[1]), s.at[1])], palette: s.palette, lines: s.lines }));
const rt = createStory({ levelId: 'arzach', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); bird.update(dt, player.riding ? {} : null); } };
const talk = (person, choices) => {
  quests.opening(person.id);   // (as Dialogue.start does: the world's opening quest starts with its first talk)
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
const stand = (p, label, tol = 1.2) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < tol, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
  return g;
};


test('the fallen giant on the plain can be looked at, from in front of its face', async () => {
  const { allInteractables } = await import('../src/interact.js');
  const e = allInteractables().find((x) => x.id === 'colossus');
  assert.ok(e, 'the colossus has a look-at');
  const foot = e.at();
  const g = physics.groundAt(foot.x, foot.y + 3, foot.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - foot.y) < 1.2, `in front of its face is walkable (${g?.toFixed?.(2)} vs ${foot.y.toFixed(2)})`);
  assert.ok(foot.distanceTo(A.colossus.face) < 30, 'near its face');
  const r = new DialogueRunner(THINGS.colossus, { game });
  assert.match(r.pages.join(' '), /lies on its side in the plain/);
  assert.equal(game.flag('arzach.colossus.seen'), true);
});

test('the people stand on the plain, and the tower’s balcony, steps and sill can be climbed', () => {
  for (const [id, n] of Object.entries(W.people)) stand(n.pos, id, 1.6);
  const T = A.tower;
  stand(T.balcony, 'the balcony');
  let y = T.floor;
  for (const s of [...T.steps, T.sill]) {
    const g = stand(s, 'a step');
    const rise = g - y;
    assert.ok(rise > 0.5 && rise < 3.2, `each step is a jump (or a boost) above the last: ${rise.toFixed(2)} m`);
    // room to stand: nothing at head height over the step
    assert.ok(physics.rayDistance(V(s.x, g + 0.2, s.z), V(0, 1, 0), 2) >= 1.9, 'headroom over the step');
    y = g;
  }
  assert.ok(T.window.y - T.sill.y > 1 && T.window.y - T.sill.y < 5, 'the window is at a standing person’s eye level from the sill');
  // the knuckles and feathers are where the story says
  assert.equal(A.hand.knuckles.length, 4);
  for (const k of A.hand.knuckles) assert.ok(k.pos.y - level.ground.heightAt(k.pos.x, k.pos.z) > 10, 'knuckles stand high over the sand');
  assert.equal(W.feathers.length, 3, 'three shed feathers');
  for (const f of W.feathers.filter((x) => !x.held)) stand(f.g.position.clone().setY(f.g.position.y - 0.35), 'a feather on a spire cap', 0.6);
});


// a real traveller: run at the next stone, jump, and (if asked) jump again in the air for the fluid boost
const { Player } = await import('../src/player.js');
const { boostVelocity } = await import('../src/fluid-tool.js');
function hop(from, to, boost) {
  const P = new Player(physics, { unsafe: level.unsafe });
  P.onAirJump = () => { boostVelocity(P.vel, P.frame.up, P.frame.dir(P.heading, new THREE.Vector3())); return true; };
  P.respawn(from.clone());
  P.heading = Math.atan2(to.x - from.x, to.z - from.z);
  let phase = 0;
  for (let i = 0; i < 360; i++) {
    const input = { KeyW: Math.hypot(to.x - P.pos.x, to.z - P.pos.z) > 0.6 };
    if (phase === 0 && i > 5) { input.Space = true; phase = 1; } else if (phase === 1 && !P.onGround && P.vel.y < 3) phase = 2; else if (phase === 2 && boost) { input.Space = true; phase = 3; }
    P.update(1 / 60, input, Math.atan2(to.x - P.pos.x, to.z - P.pos.z) + Math.PI);
    if (phase >= 2 && P.onGround && i > 30) break;
  }
  return Math.abs(P.pos.y - to.y) < 0.6 && Math.hypot(P.pos.x - to.x, P.pos.z - to.z) < 3.5;
}

test('the tower’s steps are boost-jumps from the balcony up to the sill', () => {
  const T = A.tower;
  const pts = [V(T.x + Math.sin(1.25) * 17.5, T.floor, T.z + Math.cos(1.25) * 17.5), ...T.steps, T.sill];
  for (let i = 0; i < pts.length - 1; i++) assert.equal(hop(pts[i], pts[i + 1], true), true, `step ${i + 1} is in a boost's reach`);
});

test('passing the Aerie on the way in starts its quest, but the scout still finds Oïa first', () => {
  const door = rt.temple?.rt?.outside?.door?.at;
  assert.ok(door, 'the Aerie has a door in the world');
  // a save that has the wings already: the Aerie's quest did not start on arrival (the browser pass's old save)
  game.set('quest.temple.arzach', undefined);
  quests.def('temple.arzach').arrival = false;
  assert.equal(quests.isStarted('temple.arzach'), false);
  at(door.clone().add(V(0, 0, 20)));
  step(2);
  assert.equal(quests.isStarted('temple.arzach'), true, 'near its door the Aerie’s quest begins');
  assert.equal(quests.objective()?.id, 'opener-arzach.bird', 'the opening talk keeps the scout');
  // inside, it no longer counts as one that started on its own
  game.set('temple.arzach.entered', true);
  step(1);
  assert.equal(!!quests.def('temple.arzach').arrival, false);
  game.set('temple.arzach.entered', undefined);
  at(V(0, 0, 0));
});

test('the main quest: Oïa, the wind up the tower, the flute on the sill, her call, the promise', () => {
  // it doesn't just appear: it waits for its first talk, and till then the scout finds who to ask
  assert.equal(quests.stage('arzach.bird'), undefined);
  assert.equal(quests.openerObjective()?.id, `opener-${'arzach.bird'}`);
  // the bird is nowhere to be seen until her call is played: not drawn, not to be ridden, deaf to a plain whistle
  assert.equal(bird.dormant, true, 'not to be ridden');
  assert.equal(bird.object.visible, false, 'not seen');
  assert.equal(W.shown(), false);
  // older saves: one that rode her before she was hidden keeps her in sight; one on the old ride stage goes on from the wind
  game.set('arzach.rode', true);
  assert.equal(W.shown(), true);
  game.set('arzach.rode', undefined);
  game.set('quest.arzach.bird', 'ride');
  assert.equal(quests.stage('arzach.bird'), 'tower');
  game.set('quest.arzach.bird', undefined);   // (back to a new game: the quest waits for Oïa)
  talk(PEOPLE.oia, ['Who lived', 'And the bird', 'I’ve seen that mark', 'I’ll go']);
  assert.equal(game.flag('arzach.glyph.drawn'), true, 'she draws the glyph in the sand');
  step(2);
  assert.equal(quests.stage('arzach.bird'), 'tower', 'next: the wind at the tower');
  assert.ok(quests.objective().position.distanceTo(W.wind.foot) < 1, 'the marker stands at the wind’s foot');
  assert.equal(bird.object.visible, false, 'still unseen');
  // up the wind, onto the balcony
  at(A.tower.balcony.clone().add(V(0, 1.2, 0))); step(2);
  assert.equal(quests.stage('arzach.bird'), 'window');
  // on the sill: the flute, a thing to pick up (no window to read)
  at(A.tower.sill.clone());
  const f = bestInteractable(player);
  assert.equal(f?.entry.id, 'flute', 'E takes the rider’s flute from the sill');
  assert.equal(W.flute.visible, true, 'it lies there, modelled');
  f.entry.use(player);
  assert.ok(quests.has('whistle'), 'the rider’s flute, in hand');
  assert.equal(W.flute.visible, false);
  assert.equal(game.flag('clue.arzach.arzach2'), true, 'the map of the sky stones on the wall: the clue to Vael II');
  assert.match(toasts.at(-1), /flute.*map/);
  step(2);
  assert.equal(quests.stage('arzach.bird'), 'call');
  assert.equal(bird.dormant, true, 'not until it is played');
  // play it on the tower: the call, and she comes down out of the haze to the balcony
  const tunes = [];
  sound.tune = (notes) => { tunes.push(notes); return true; };
  const w = bestInteractable(player);
  assert.equal(w?.entry.id, 'whistle');
  assert.match(w.entry.prompt, /flute/);
  w.entry.use(player);
  assert.deepEqual(tunes, [RIDER_CALL], 'five notes on the flute');
  assert.ok(RIDER_CALL.length === 5 && RIDER_CALL.every(([hz, beats]) => hz > 200 && hz < 2000 && beats > 0));
  assert.equal(bird.dormant, false, 'she can be ridden now');
  assert.equal(bird.object.visible, true, 'and seen');
  assert.ok(bird.pos.y > A.tower.floor + 100, 'from high over the haze');
  step(2);
  assert.equal(quests.stage('arzach.bird'), 'promise');
  assert.equal(bird.mode, 'summoned');
  step(30 * 30, 1 / 30);
  assert.ok(bird.pos.distanceTo(A.tower.balcony) < 12, `she landed on the balcony: ${bird.pos.distanceTo(A.tower.balcony).toFixed(1)} m`);
  assert.equal(game.flag('arzach.bird.promise'), true, 'she bowed');
  assert.equal(quests.isDone('arzach.bird'), true);
  assert.equal(game.flag('world.arzach.done'), true);
  assert.equal(game.flag('bird.promise'), true);
  const k = game.keepsakes().find((x) => x.id === 'arzach.person');
  assert.ok(k && k.kind === 'person', 'the keepsake: the bird’s promise');
  // after: she waits on the plain for you to ride (brought down there for the side quests)
  bird.pos.set(30, physics.groundAt(30, 1e4, 10) + 1.4, 10); bird.mode = 'idle'; bird.landed = true;
});

test('the wind up the tower’s side lifts open wings to the balcony; without wings it only says so', async () => {
  const { Player } = await import('../src/player.js');
  const { items } = await import('../src/items.js');
  const T = A.tower, wnd = W.wind;
  assert.ok(Math.abs(physics.groundAt(wnd.foot.x, wnd.foot.y + 20, wnd.foot.z) - wnd.foot.y) < 1.5, 'its foot is on the sand');
  assert.ok(Math.hypot(wnd.foot.x - T.x, wnd.foot.z - T.z) - wnd.r > 20, 'it rises clear of the balcony’s rim');
  const ride = (own) => {
    for (const id of ['backpack', 'glider', 'jetpack']) if (own.includes(id)) items.grant(id); else items.revoke(id);
    const P = new Player(physics, { health: false });
    P.respawn(wnd.foot.clone().add(V(0, 0.6, 0)));
    let up = 0, onBalcony = false;
    for (let i = 0; i < 60 * 45; i++) {
      const input = { Space: i > 2 && i < 6 ? true : i > 30 };   // jump, then hold it as you fall: the wings
      P.update(1 / 60, input, 0);
      if (windContains(wnd, P.pos) && P.gliding) windLift(wnd, P, 1 / 60, T.balcony);
      up = Math.max(up, P.pos.y);
      if (P.onGround && Math.abs(P.pos.y - T.floor) < 1 && Math.hypot(P.pos.x - T.x, P.pos.z - T.z) < 21) { onBalcony = true; break; }
      if (P.onGround && i > 60 && P.pos.y < wnd.foot.y + 3 && !own.includes('glider')) break;
    }
    return { onBalcony, up, P };
  };
  const winged = ride(['backpack', 'glider']);
  assert.ok(winged.onBalcony, `carried up and set down on the balcony (${winged.P.pos.toArray().map((v) => v.toFixed(1))}, up to ${winged.up.toFixed(1)}; floor ${T.floor.toFixed(1)})`);
  const bare = ride(['backpack']);
  assert.ok(!bare.onBalcony && bare.up < wnd.foot.y + 6, 'no wings: it only tugs at you');
  for (const id of ['backpack', 'glider', 'jetpack']) items.revoke(id);
});

test('side quests: the stone hand rings small to tall, and the three feathers go back to the bird', async () => {
  const [tam, senn, hollin] = LOCALS;
  void tam;
  talk(senn, ['What light', 'The bird cried', 'I’ll find']);
  assert.equal(game.flag('arzach.rumour.light'), true, 'the singing light');
  assert.equal(quests.stage('arzach.feathers'), 'find');
  talk(hollin, ['Rang', 'With the fluid', 'I’ll try']);
  assert.equal(quests.stage('arzach.hand'), 'ring');
  const knuckles = allTargets().filter((t) => t.kind === 'knuckle');
  assert.equal(knuckles.length, 4);
  const byPos = (i) => knuckles.find((t) => t.position().distanceTo(A.hand.knuckles[i].pos) < 0.01);
  at(W.knuckles[0].pos.clone().add(V(0, -18, 15)));
  // the wrong order does nothing
  byPos(1).onHit('shoot'); byPos(0).onHit('shoot');
  assert.equal(game.flag('arzach.hand.rung'), undefined);
  for (const i of KNUCKLE_ORDER) byPos(i).onHit('shoot');
  assert.equal(game.flag('arzach.hand.rung'), true, 'smallest to tallest rings it');
  step(2);
  assert.equal(quests.isDone('arzach.hand'), true);
  // the third feather drifts down from the palm
  step(30 * 7);
  for (const f of W.feathers) {
    at(f.g.position.clone().add(V(0.5, -0.3, 0)));
    const e = bestInteractable(player);
    assert.equal(e?.entry.id, `feather.${f.i}`);
    e.entry.use(player);
  }
  step(2);
  assert.equal(quests.stage('arzach.feathers'), 'give');
  at(bird.pos.clone().add(V(2, -1.4, 0)));
  assert.equal(bird.dormant, false);
  const g = bestInteractable(player);
  assert.equal(g?.entry.id, 'feathers.give');
  g.entry.use(player);
  step(2);
  assert.equal(quests.isDone('arzach.feathers'), true);
  assert.equal(game.flag('item.feather'), 0);
  await new Promise((r) => setTimeout(r, 1600));
  assert.ok(storyDone, 'the main quest closed Vael’s story page');
  clearInteractables(); clearTargets();
});

test('looking at the stone hand starts its quest and says what to do', () => {
  const look = THINGS.palm.talk.nodes.look;
  assert.equal(look.do?.start, 'arzach.hand', 'looking at it puts the knuckles in the journal');
  const strike = THINGS.palm.talk.nodes[look.choices.find((c) => c.goto)?.goto];
  assert.ok(strike && /shoot/i.test(strike.say.join(' ')) && /Kesh/.test(strike.say.join(' ')), 'shoot a knuckle; Kesh knows the order');
});

