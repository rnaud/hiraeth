// The Garden of Spheres' climax, filmed (src/story/spheres-moments.js): the pole sings the three
// sounds back, the rings run out over the plaza, the great sphere answers on the horizon, his face.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createSpheres } = await import('../src/levels/spheres.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { MOMENTS, CHORD } = await import('../src/story/spheres-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};
const scene = new THREE.Scene();
const level = createSpheres(scene);
const physics = new Physics(scene, level.ground);
const G = level.spheres, Pz = G.plaza;
const pole = V(Pz.x, Pz.inner, Pz.z);

/** A garden whose three spheres have remembered, the traveller on the plaza by the pole. */
function garden({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  let bands = [];
  const played = [], swells = [], toasts = [];
  const sound = { setBands(b) { bands = b; }, setBandMode() {}, band: (id) => bands.find((x) => x.id === id) ?? null, chime() {}, listen() {}, whoosh() {},
    orbNote() {}, remembered() {}, spheresSong: (at) => { played.push(at); return 0; }, swell(k, at) { swells.push([k, at]); return 8; } };
  const player = { pos: pole.clone().add(V(0, 0, 4)), vel: V(), heading: Math.PI, riding: false, onGround: true, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const rt = createStory({ levelId: 'spheres', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: {},
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  for (const id of ['bell', 'chant', 'drum']) game.set(`spheres.heard.${id}`, true);
  game.set('spheres.heard.three', true);
  rt.quests.start('spheres.listen', 'pole');
  const camera = new THREE.PerspectiveCamera();
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, i * dt, { camera }); } };
  const splash = () => allTargets().find((x) => x.kind === 'pole').onHit('shoot');
  return { rt, player, played, swells, toasts, step, splash, W: rt.world };
}
const SANG = /The pole sings them back/;
const LEN = CHORD.A + CHORD.B + CHORD.C + CHORD.D;

test('the spheres’ moment is the one the registry lists, and short', () => {
  assert.deepEqual(MOMENTS, WORLD_MOMENTS.spheres);
  assert.ok(LEN >= 5 && LEN <= 12, `${LEN} s`);
});

test('without the ship’s camera the garden does what it always did, at once', () => {
  const g = garden();
  g.step(2);
  g.splash();
  assert.equal(game.flag('spheres.chord.heard'), true);
  assert.equal(g.played.length, 1, 'the tune');
  assert.ok(g.toasts.some((t) => SANG.test(t)), 'and its toast at once');
  assert.ok(!g.rt.moments.playing && !game.flag('spheres.moment.chord'));
  assert.equal(g.W.state.chordT, 0, 'the rings and the halo start');
});

test('the chord is filmed once: the plaza, its rings, the horizon, his face; the toast after, the controls back while it still sings', () => {
  const ship = fakeShip();
  const g = garden({ ship });
  g.step(2);
  g.splash();
  const { rt, W } = g;
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('spheres.moment.chord'), true, 'once per save');
  assert.equal(game.flag('spheres.chord.heard'), true, 'its state is the caller’s, applied at once');
  assert.equal(g.played.length, 1, 'the pole’s tune plays under it');
  assert.ok(rt.busy(), 'the traveller is held');
  assert.ok(!g.toasts.some((t) => SANG.test(t)), 'the toast waits for its end');
  const n0 = ship.shots.length;
  g.step(Math.round(CHORD.swellAt * 30) + 2);
  assert.deepEqual(g.swells.map(([k]) => k), ['motif'], 'the world’s motif, the bell’s phrase, swells as the tune lands');
  g.step(Math.round((LEN - CHORD.swellAt) * 30) + 20);
  assert.ok(!rt.moments.playing && !rt.busy(), 'then back to you');
  assert.ok(g.toasts.some((t) => SANG.test(t)), 'and the toast');
  assert.ok(W.state.chordT > LEN - 0.5 && W.state.chordT < 10, 'the controls come back while the rings still run and the halo is up');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line: it shows, it doesn’t tell');
  // the panels frame what they should
  const shots = ship.shots.slice(n0), at = (s) => shots[Math.round(s * 30)];
  const A = at(1.2), B = at(CHORD.A + 1), C = at(CHORD.A + CHORD.B + 1), D = at(CHORD.A + CHORD.B + CHORD.C + 1);
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(flat(A.look, pole) < 1 && flat(A.pos, pole) > 12 && A.pos.y < Pz.inner + 6, 'A: wide and low across the plaza at the pole');
  assert.ok(flat(B.look, pole) < 1 && B.pos.y > Pz.inner + 18, 'B: high over the rings');
  const toGreat = V(G.great.x - C.pos.x, G.great.y + G.great.R * 0.55 - C.pos.y, G.great.z - C.pos.z).normalize(), dir = C.look.clone().sub(C.pos).normalize();
  assert.ok(flat(C.pos, pole) < 20 && dir.angleTo(toGreat) < 0.1, 'C: past the pole at the great sphere on the horizon');
  assert.ok(D.look.distanceTo(g.player.pos) < 2.2 && D.pos.distanceTo(g.player.pos) < 3.5, 'D: close on his face');
  // never again
  assert.equal(W.film.chord(), false);
});

test('skipped, it lands the same: the toast, the chord going on', () => {
  const ship = fakeShip();
  const g = garden({ ship });
  g.step(2);
  g.splash();
  assert.ok(g.rt.moments.playing);
  g.step(10);
  assert.equal(g.rt.moments.skip(), false, 'not inside the grace');
  g.step(12);
  assert.equal(g.rt.moments.skip(), true);
  g.step(1);
  assert.ok(!g.rt.moments.playing && !g.rt.busy());
  assert.ok(g.toasts.some((t) => SANG.test(t)), 'the toast');
  assert.equal(game.flag('spheres.chord.heard'), true);
  assert.equal(g.played.length, 1, 'the tune once');
  assert.ok(g.W.state.chordT > 0 && g.W.state.chordT < 12, 'the rings and the halo go on');
});

test('show, don’t tell: no lines for him, a slight smirk at most', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/spheres-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line\s*:/.test(src), 'nothing said');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1, 'his face reacts');
  for (const l of looks) assert.ok(!/'(surprised|happy|shout|scared|playful)'/.test(l), `no big face: ${l}`);
});
