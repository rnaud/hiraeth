// Lorn II's climax, filmed (src/story/perdide2-moments.js): the last dark pool lit, and the
// saucer across the water blinking back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const quiet = (f) => { const w = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = w; } };
const { createPerdide2, DARK_POOLS } = await import('../src/levels/perdide2.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { clearTargets, allTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');
const { POOLS, MOMENTS } = await import('../src/story/perdide2-moments.js');
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

/** A fresh Lorn II with two pools lit, the traveller by the third; with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const scene = new THREE.Scene();
  const level = quiet(() => createPerdide2(scene));
  const terrain = level.ground;
  const physics = new Physics(scene, terrain);
  const player = { pos: V(0, 0, 0), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, critter() {}, swells: [], swell(k) { this.swells.push(k); return 8; } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  const npcs = spawnNPCs(scene, physics, CONTENT.perdide2.npcs);
  const rt = createStory({ levelId: 'perdide2', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  const { quests } = rt;
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  game.set('perdide2.hollin.met', true);
  quests.start('perdide2.lamps', 'pools');
  const targets = allTargets().filter((t) => t.kind === 'pool');
  const near = (i) => { const D = DARK_POOLS[i]; player.pos.copy(V(D.x, terrain.heightAt(D.x, D.z), D.z).add(V(4, 0, 4))); };
  for (const i of [0, 1]) { near(i); targets[i].onHit('shoot'); }
  near(2); step(2);
  assert.equal(game.flag('perdide2.pools.lit'), 2);
  toasts.length = 0;
  return { rt, W: rt.world, player, sound, toasts, step, quests, ship, shoot: () => targets[2].onHit('shoot') };
}

test('the registry: Lorn II’s moment is the one in film.js', () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.perdide2.map(({ id, flag }) => ({ id, flag })));
  const len = POOLS.A + POOLS.B + POOLS.C + POOLS.D;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);
});

test('the third pool lit is filmed once: the pool, the saucer blinking back, the path, his face; it still blinks when the controls come back', () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, player, ship, step, toasts, sound, quests, shoot } = w;
  shoot();
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('perdide2.moment.pools'), true, 'once per save');
  assert.equal(game.flag('perdide2.pools.lit'), 3, 'the pool is lit, film or no film');
  assert.ok(W.pools[2].on && W.pools[2].live.visible);
  assert.ok(rt.busy(), 'the traveller is held while it plays');
  assert.ok(!toasts.some((t) => /third pool/.test(t)), 'its toast waits for its end');
  assert.equal(game.flag('perdide2.saucer.answered'), undefined, 'the saucer waits for its panel');
  const n0 = ship.shots.length;
  const len = POOLS.A + POOLS.B + POOLS.C + POOLS.D;
  let answeredAt = null;
  for (let i = 0; i < Math.round(len * 30) + 20 && rt.moments.playing; i++) {
    step(1);
    if (answeredAt === null && game.flag('perdide2.saucer.answered')) answeredAt = (i + 1) / 30;
  }
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(answeredAt !== null && Math.abs(answeredAt - POOLS.ANSWER) < 0.1 && answeredAt > POOLS.A, `the saucer answers in its panel (${answeredAt?.toFixed(2)} s)`);
  assert.ok(Math.abs(W.state.blink0 - (W.state.clock - (len - POOLS.ANSWER))) < 0.2, 'its blink starts from its phrase’s start there');
  assert.equal(quests.stage('perdide2.lamps'), 'answer');
  assert.deepEqual(sound.swells, ['motif'], 'the world’s motif swells');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line: it shows, it doesn’t tell');
  assert.ok(toasts.some((t) => /third pool lights up/.test(t)), 'the toast at its end');
  // the panels: A past the pool at him, B out at the saucer, C high behind him, D his face
  const shots = ship.shots.slice(n0);
  const at = (s) => shots[Math.min(shots.length - 1, Math.round(s * 30))];
  const c = W.pools[2].c, S = W.places.saucerAt;
  const a = at(1);
  assert.ok(a.pos.distanceTo(c) < 9 && a.look.distanceTo(c) < 4, 'A is on the pool');
  const b = at(POOLS.A + 1.5);
  assert.ok(b.pos.distanceTo(S) < 35 && b.look.distanceTo(S) < 9, 'B is on the saucer');
  const cc = at(POOLS.A + POOLS.B + 1);
  assert.ok(cc.pos.y > player.pos.y + 1.5 && cc.pos.distanceTo(player.pos) < 8 && cc.look.distanceTo(S) < player.pos.distanceTo(S), 'C is above and behind him, looking the way to the saucer');
  const d = at(POOLS.A + POOLS.B + POOLS.C + 1);
  assert.ok(d.look.distanceTo(player.pos) < 2.2 && d.pos.distanceTo(player.pos) < 3.5, 'D is close on his face');
  // a second time never plays
  assert.equal(W.film.pools(W.pools[2], { answer() {}, said: 'x' }), false);
});

test('skipped, it lands the same: the saucer answers, the toast said', () => {
  const w = world({ ship: fakeShip() });
  const { rt, step, toasts, quests, shoot } = w;
  shoot();
  assert.ok(rt.moments.playing);
  step(10);
  assert.equal(rt.moments.skip(), false, 'not in its first moments');
  step(15);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing, 'skipped');
  assert.ok(!rt.busy());
  assert.equal(game.flag('perdide2.saucer.answered'), true, 'the saucer answers');
  assert.ok(toasts.some((t) => /third pool lights up/.test(t)), 'the toast');
  step(2);
  assert.equal(quests.stage('perdide2.lamps'), 'answer');
});

test('without the ship’s camera Lorn II does what it always did: the toast and the answer at once', () => {
  const w = world();
  const { rt, toasts, shoot, step, quests } = w;
  shoot();
  assert.ok(!rt.moments.playing, 'no moment');
  assert.equal(game.flag('perdide2.moment.pools'), undefined);
  assert.equal(game.flag('perdide2.saucer.answered'), true, 'the saucer answers at once');
  assert.ok(toasts.some((t) => /third pool lights up/.test(t)));
  step(2);
  assert.equal(quests.stage('perdide2.lamps'), 'answer');
  clearInteractables(); clearTargets();
});
