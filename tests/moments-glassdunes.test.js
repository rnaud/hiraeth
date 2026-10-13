// The Glass Dunes' climax, filmed (src/story/glassdunes-moments.js): out of the Clock-House after the Foreman keeps
// time, the clock over its door comes round; the world is done, its keepsake given.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createGlassDunes } = await import('../src/levels/glass-dunes.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { CLOCK, MOMENTS, cogShot } = await import('../src/story/glassdunes-moments.js');
const { FILM_NEAR } = await import('../src/story/glassdunes.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');
const { KEEPSAKE } = await import('../src/story/glassdunes-people.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const quiet = (f) => { const w = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = w; } };
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

const scene = new THREE.Scene();
const level = quiet(() => createGlassDunes(scene));
const physics = new Physics(scene, level.ground);
const rt0 = level.temples.find((t) => t.id === 'garage');

/** The Glass Dunes' story on a fresh save, with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; }, ctx: { currentTime: 0 } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  let done = false;
  const rt = createStory({ levelId: 'glassdunes', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() { done = true; } },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  return { rt, player, sound, toasts, step, ship, isDone: () => done };
}

test('the registry and show, don’t tell: the Glass Dunes’ moment is the one in film.js', async () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.glassdunes.map(({ id, flag }) => ({ id, flag })));
  const len = CLOCK.A + CLOCK.B + CLOCK.C + CLOCK.D;
  assert.ok(len >= 8 && len <= 10, `the moments' 8–10 s (${len}; 7.2 s in three panels before the cogs' panel, QC v1.66)`);
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/glassdunes-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line:/.test(src), 'no lines in it');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1 && looks.every((l) => !/'(surprised|happy|shout|scared|playful)'/.test(l)), 'no big face');
});

test('out of the Clock-House once the Foreman keeps time: the world is done, its keepsake given, the clock filmed once', () => {
  const ship = fakeShip();
  const w = world({ ship });
  assert.ok(rt0?.outside?.hands, 'the Clock-House stands in the dunes, its clock over the door');
  w.step(2);
  assert.equal(ship.shots.length, 0, 'nothing before the guardian');
  game.set('temple.garage.done', true);
  w.step(1);
  assert.equal(game.flag('world.glassdunes.done'), true, 'the world done on the route');
  assert.ok(game.keepsakes().some((k) => k.id === KEEPSAKE.id), 'Wim’s tick kept');
  // far from the door: not yet
  w.player.pos.copy(level.spawn);
  w.step(2);
  assert.equal(ship.shots.length, 0, 'not from the ship’s flat');
  // out by the door
  const D = rt0.outside.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading));
  w.player.pos.copy(D.at).addScaledVector(out, 6);
  assert.ok(w.player.pos.distanceTo(D.at) < FILM_NEAR);
  w.step(2);
  assert.ok(ship.shots.length > 0, 'filmed');
  assert.equal(game.flag('glassdunes.moment.clock'), true, 'once per save');
  for (let i = 0; i < 30 * 10; i++) w.step(1);
  assert.ok(w.sound.swells.includes('father'), 'the father’s theme under it');
  assert.ok(w.toasts.some((t) => /keeps time/.test(t)), 'said at its end');
  const n = ship.shots.length;
  w.step(30);
  assert.equal(ship.shots.length, n, 'not again');
});

test('without the ship’s camera nothing is lost: done, kept, and no film', () => {
  const w = world({ ship: null });
  game.set('temple.garage.done', true);
  const D = rt0.outside.door;
  w.player.pos.copy(D.at).add(V(0, 0, 4));
  w.step(4);
  assert.equal(game.flag('world.glassdunes.done'), true);
  assert.equal(game.flag('glassdunes.moment.clock'), undefined, 'it waits for a stage to play on');
});

test('the cogs\' panel (QC v1.66): low in front of a great cog, out of the house and off the sand, the cog in frame', () => {
  const O = rt0.outside, D = O.door, out = V(Math.sin(D.heading), 0, Math.cos(D.heading)), side = V(out.z, 0, -out.x);
  const shot = cogShot(O, D.at, side);
  assert.ok(shot, 'the house has its cogs');
  const home = O.kit.world(0, 0, 0);
  const cogs = O.cogs.map((k) => k.g.getWorldPosition(V(0, 0, 0)));
  for (const s of [shot.from, shot.to]) {
    const near = Math.min(...cogs.map((c) => c.distanceTo(s.pos)));
    assert.ok(near > 6 && near < 22, `close to a cog, not in it (${near.toFixed(1)} m)`);
    assert.ok(Math.hypot(s.pos.x - home.x, s.pos.z - home.z) > O.R + 3, 'outside the house');
    assert.ok(s.pos.y > level.ground.heightAt(s.pos.x, s.pos.z) + 0.4, 'over the sand');
    const cam = new THREE.PerspectiveCamera(s.fov, 16 / 9, 0.1, 500);
    cam.position.copy(s.pos); cam.lookAt(s.look); cam.updateMatrixWorld();
    const c = cogs.reduce((b, p) => (p.distanceTo(s.look) < b.distanceTo(s.look) ? p : b)).clone().project(cam);   // (the cog it looks at)
    assert.ok(Math.abs(c.x) < 0.6 && Math.abs(c.y) < 0.6 && c.z < 1, `the cog in frame (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`);
  }
});
