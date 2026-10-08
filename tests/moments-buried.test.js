// The Buried Machine's climax, filmed (src/story/buried-moments.js): the great wheel turns one
// tooth, and goes on turning. Played in the real story runtime with a fake ship.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createBuried } = await import('../src/levels/buried.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { TURN_TIME } = await import('../src/story/buried.js');
const { WHEEL, MOMENTS } = await import('../src/story/buried-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');
const { clearInteractables } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};
const LEN = WHEEL.A + WHEEL.B + WHEEL.C + WHEEL.D;

/** A fresh Buried Machine with the Wick lit, the traveller standing before the wheel (ship: the camera, or null). */
function world(ship) {
  game.reset();
  clearInteractables(); clearTargets();
  game.set('buried.valve.open', true); game.set('buried.oculus.lit', true);
  const scene = new THREE.Scene();
  const level = createBuried(scene);
  const physics = new Physics(scene, level.ground);
  const B = level.buried;
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  const rt = createStory({ levelId: 'buried', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  const W = B.wheel;
  player.pos.copy(W.drop).addScaledVector(W.face, 20);
  player.pos.y = level.ground.heightAt(player.pos.x, player.pos.z);
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); camera.lookAt(player.pos); camera.updateMatrixWorld(); rt.update(dt, i * dt, { camera }); } };
  return { rt, B, W, player, sound, toasts, step, level };
}

test('the Buried Machine’s moment is the one registered for it', () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.buried.map(({ id, flag }) => ({ id, flag })));
  assert.ok(LEN >= 5 && LEN <= 12, `5–12 s (${LEN})`);
  assert.ok(LEN > TURN_TIME, 'the tooth goes round inside it…');
  assert.ok(LEN < TURN_TIME + 3, '…and control comes back while the sand still slides and the wheel eases into its endless turn');
});

test('the wheel’s first turn is filmed once: the arc, the teeth out of the sand, the city rocking, his face; it goes on turning after', () => {
  const ship = fakeShip();
  const { rt, W, player, sound, toasts, step } = world(ship);
  const st = rt.world.state;
  for (let i = 0; i < 60 && !rt.moments.playing; i++) step(1);
  assert.ok(rt.moments.playing, 'standing before it, once the Wick is lit: the moment plays');
  assert.equal(game.flag('buried.moment.wheel'), true, 'once per save');
  assert.ok(st.turning, 'the wheel turns, film or no film');
  assert.ok(rt.busy(), 'the traveller is held while it plays');
  const n0 = ship.shots.length;
  step(Math.round((WHEEL.LURCH + 0.2) * 30));
  assert.deepEqual(sound.swells, ['motif'], 'the world’s motif swells on the lurch');
  step(Math.round((TURN_TIME - WHEEL.LURCH) * 30));
  assert.equal(game.flag('buried.wheel.turned'), true, 'the tooth goes round inside the film');
  assert.ok(rt.moments.playing);
  assert.deepEqual(toasts, [], 'its toasts wait for the end');
  step(Math.round((LEN - TURN_TIME) * 30) + 3);
  assert.ok(!rt.moments.playing && !rt.busy(), 'then back to you');
  assert.ok(toasts.some((t) => /great wheel is turning/.test(t)) && toasts.some((t) => /One tooth/.test(t)), 'and the toasts');
  assert.ok(!toasts.some((t) => /keeps on turning/.test(t)), 'while the sand is still sliding off');
  assert.ok(W.cleared < 1, 'the climax still going on');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line: it shows, it doesn’t tell');
  const shots = ship.shots.slice(n0 - 1), at = (s) => shots[Math.round(s * 30)];
  const flatTo = (p) => Math.hypot(p.x - W.centre.x, p.z - W.centre.z);
  const a = at(1);
  assert.ok(flatTo(a.look) < flatTo(a.pos) - 15 && a.look.y > a.pos.y + 3 && a.pos.y < W.ground + 8, 'A: low behind him, looking up toward the arc');
  const b = at(WHEEL.A + 1);
  assert.ok(Math.abs(flatTo(b.look) - W.R) < 15 && b.look.y < W.ground + 14, 'B: low where the teeth come out of the sand');
  const c = at(WHEEL.A + WHEEL.B + 1);
  assert.ok(flatTo(c.pos) > 150 && c.look.y - c.pos.y > 40 && flatTo(c.look) < flatTo(c.pos), 'C: far out beyond the wheel, looking back over it and up at the hanging city');
  const d = at(WHEEL.A + WHEEL.B + WHEEL.C + 1);
  assert.ok(d.look.distanceTo(player.pos) < 2.2 && d.pos.distanceTo(player.pos) < 3.5, 'D: close on his face');
  // and it keeps turning
  const a0 = W.spin.rotation.z;
  step(150);
  assert.ok(a0 - W.spin.rotation.z > 0.01, 'still turning');
  assert.ok(rt.world.film.wheel() === false, 'never twice');
});

test('skipped, it lands the same: the wheel turns its tooth and goes on, the toasts said', () => {
  const ship = fakeShip();
  const { rt, W, toasts, step } = world(ship);
  for (let i = 0; i < 60 && !rt.moments.playing; i++) step(1);
  assert.ok(rt.moments.playing);
  step(Math.round(0.8 * 30));
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing && !rt.busy());
  assert.ok(toasts.some((t) => /great wheel is turning/.test(t)), 'the turn’s toast at the end');
  for (let i = 0; i < (TURN_TIME + 1) * 10 && !game.flag('buried.wheel.turned'); i++) step(1, 0.1);
  assert.equal(game.flag('buried.wheel.turned'), true, 'the tooth goes round on its own clock');
  assert.ok(toasts.some((t) => /One tooth/.test(t)));
  assert.ok(ship.log.some(([k, v]) => k === 'release' && v === 0.5));
  assert.ok(W.spin.rotation.z < 0);
});

test('show, don’t tell: no lines for him, a slight smirk at most', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/buried-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(\s*'you'|line\s*:/.test(src), 'nothing said in his voice');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1);
  for (const l of looks) assert.ok(!/'(surprised|happy|shout|scared|playful)'/.test(l), `no big face: ${l}`);
});

test('without the ship’s camera the wheel turns as it always did, at once', () => {
  const { rt, toasts, step } = world(null);
  for (let i = 0; i < 60 && !rt.world.state.turning; i++) step(1);
  assert.ok(rt.world.state.turning && !rt.moments.playing);
  assert.equal(game.flag('buried.moment.wheel'), undefined);
  assert.ok(toasts.some((t) => /great wheel is turning/.test(t)), 'its toast at once');
});
