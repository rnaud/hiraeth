// Lorn's climax, filmed (src/story/perdide-moments.js): the splinter raised in the cave's heart,
// and the cave singing the singing light's phrase back to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const quiet = (f) => { const w = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = w; } };
const { createPerdide } = await import('../src/levels/perdide.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');
const { CRYSTAL, MOMENTS } = await import('../src/story/perdide-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** The ship as the moments see it: its camera and its Cinema. */
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

/** A fresh Lorn at the cave's stage (the splinter in hand), the traveller at the heart; with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const scene = new THREE.Scene();
  const level = quiet(() => createPerdide(scene));
  const physics = new Physics(scene, level.ground);
  const player = { pos: V(0, 0, 0), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, critter() {}, swells: [], swell(k) { this.swells.push(k); return 8; } };
  const toasts = [], done = { story: false };
  const camera = new THREE.PerspectiveCamera();
  const npcs = spawnNPCs(scene, physics, CONTENT.perdide.npcs);
  const rt = createStory({ levelId: 'perdide', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { done.story = true; } },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  const { quests } = rt;
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  quests.start('perdide.crystal', 'cave');
  quests.give('splinter');
  game.set('perdide.crystal.sung', true); game.set('perdide.splinter.taken', true);
  const W = rt.world;
  player.pos.copy(W.places.heart).add(V(1.6, 0, 0.4));
  step(2);
  assert.equal(quests.stage('perdide.crystal'), 'cave');
  return { rt, W, player, sound, toasts, step, quests, ship, done };
}
const raise = (w) => {
  const e = bestInteractable(w.player);
  assert.equal(e?.entry.id, 'heart');
  e.entry.use(w.player);
};

test('the registry: Lorn’s moment is the one in film.js', () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.perdide.map(({ id, flag }) => ({ id, flag })));
  const len = CRYSTAL.A + CRYSTAL.B + CRYSTAL.C + CRYSTAL.D;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);
  assert.ok(CRYSTAL.RING > CRYSTAL.A && CRYSTAL.RING < CRYSTAL.A + CRYSTAL.B, 'the cave answers in the ring’s panel');
});

test('the splinter raised in the heart is filmed once: the ring, the crystals answering, the vault, his face; the cave still singing when the controls come back', async () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, player, ship, step, toasts, sound, done, quests } = w;
  const refills = [];
  game.on('tool:refill', (x) => refills.push(x));
  toasts.length = 0;
  raise(w);
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.ok(!rt.dialogue.open, 'instead of the heart’s page');
  assert.equal(game.flag('perdide.moment.crystal'), true, 'once per save');
  assert.ok(rt.busy(), 'the traveller is held while it plays');
  assert.equal(game.flag('perdide.heart.rung'), undefined, 'the cave waits for its beat');
  const n0 = ship.shots.length;
  const len = CRYSTAL.A + CRYSTAL.B + CRYSTAL.C + CRYSTAL.D;
  let rungAt = null;
  for (let i = 0; i < Math.round(len * 30) + 20 && rt.moments.playing; i++) {
    step(1);
    if (rungAt === null && game.flag('perdide.heart.rung')) rungAt = (i + 1) / 30;
  }
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(rungAt !== null && Math.abs(rungAt - CRYSTAL.RING) < 0.1, `the cave answers on its beat (${rungAt?.toFixed(2)} s)`);
  assert.deepEqual(refills.map((x) => [x.addColour, x.tone]), [[true, '#c7a6f2']], 'the tank takes its crystal-violet band, once');
  assert.ok(W.cave.t > 3, `the cave is still singing when the controls come back (${W.cave.t.toFixed(1)} s left)`);
  assert.deepEqual(sound.swells, ['father'], 'the father’s theme swells');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line: it shows, it doesn’t tell');
  assert.ok(toasts.some((t) => /colour band/.test(t)) && toasts.some((t) => /Keepsake: A singing splinter/.test(t)), 'its news toasted at its end');
  assert.ok(game.keepsakes().some((k) => k.id === 'perdide.thing'));
  assert.equal(player.aim, null, 'his arm down');
  // the panels: A wide down the cave, B low across the ring at him, C high under the vault, D his face
  const shots = ship.shots.slice(n0);
  const at = (s) => shots[Math.min(shots.length - 1, Math.round(s * 30))];
  const H = W.places.heart;
  const a = at(1);
  assert.ok(a.pos.distanceTo(H) > 7 && a.look.distanceTo(H) < 2.5, 'A is wide, on the ring');
  const b = at(CRYSTAL.A + 1);
  assert.ok(b.pos.distanceTo(player.pos) < 3.5 && b.look.distanceTo(H) < 2.6 && b.pos.distanceTo(H) > player.pos.distanceTo(H), 'B is over his shoulder, across the ring');
  const c = at(CRYSTAL.A + CRYSTAL.B + 1);
  assert.ok(c.pos.y > H.y + 5 && c.look.distanceTo(H) < 2, 'C is high over the ring');
  const d = at(CRYSTAL.A + CRYSTAL.B + CRYSTAL.C + 1);
  assert.ok(d.look.distanceTo(player.pos) < 2.2 && d.pos.distanceTo(player.pos) < 3.5, 'D is close on his face');
  for (const s of shots) assert.ok(s.pos.distanceTo(H) < 13 && s.pos.y < H.y + 10, 'every camera inside the cave');
  // the quest ends as it always did, its closing words after the moment
  step(2);
  assert.equal(quests.isDone('perdide.crystal'), true);
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(done.story, 'the story page closes');
  // a second time never plays
  assert.equal(W.film.crystal(), false);
});

test('skipped, it lands the same: the cave answers, the tank tinted, the keepsake, the toasts', () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, step, toasts, quests } = w;
  toasts.length = 0;
  raise(w);
  assert.ok(rt.moments.playing);
  step(10);
  assert.equal(rt.moments.skip(), false, 'not in its first moments');
  step(15);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing, 'skipped');
  assert.ok(!rt.busy());
  assert.equal(game.flag('perdide.heart.rung'), true, 'the cave answered');
  assert.equal(game.flag('perdide.tank.tinted'), true, 'the tank took its colour');
  assert.ok(W.cave.t > 10, 'and sings');
  assert.ok(game.keepsakes().some((k) => k.id === 'perdide.thing'));
  assert.ok(toasts.some((t) => /colour band/.test(t)), 'the toast');
  step(2);
  assert.equal(quests.isDone('perdide.crystal'), true);
});

test('without the ship’s camera Lorn does what it always did: the heart’s page', () => {
  const w = world();
  const { rt, step, quests } = w;
  raise(w);
  assert.ok(!rt.moments.playing, 'no moment');
  assert.equal(game.flag('perdide.moment.crystal'), undefined);
  assert.ok(rt.dialogue.open, 'the heart’s page, as always');
  while (rt.dialogue.runner && !rt.dialogue.runner.ended) { if (!rt.dialogue.runner.advance()) { const c = rt.dialogue.runner.choices(); if (!c.length) break; rt.dialogue.runner.choose(c[0].index); } }
  rt.dialogue.close();
  assert.equal(game.flag('perdide.heart.rung'), true);
  step(2);
  assert.equal(quests.isDone('perdide.crystal'), true);
  clearInteractables(); clearTargets();
});
