// Viridel's climax, filmed (src/story/edena-moments.js): the builders' gate gives way and the flood
// takes the middle of Esk's terraces. It plays once, holds the traveller, frames the gate, the lane,
// the hollow and his face, says nothing for him, and gives the controls back while the water still
// runs; skipped, the flood lands the same; without the ship's camera the terraces do what they did.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const warn = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('toNonIndexed')) warn(...a); };

const { createEdena, TERRACES: TR } = await import('../src/levels/edena.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');
const { MOMENTS, TERRACES } = await import('../src/story/edena-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = 'edena.terraces';
const LEN = TERRACES.A + TERRACES.B + TERRACES.C + TERRACES.D;

/** The ship as the moments see it: its camera and its Cinema. */
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

/** A visit to Viridel on the current save, at the gate with the wheel free (the quest at 'gate'). */
function visit({ ship = null } = {}) {
  clearInteractables(); clearTargets();
  const scene = new THREE.Scene();
  const level = createEdena(scene);
  const physics = new Physics(scene, level.ground);
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const toasts = [];
  const sound = { swells: [], setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, rumble() {}, fail() {}, swell(k) { this.swells.push(k); return 8; } };
  const npcs = spawnNPCs(scene, physics, CONTENT.edena.npcs);
  const rt = createStory({ levelId: 'edena', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  const camera = new THREE.PerspectiveCamera();
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  const T = rt.world.terraces;
  player.pos.copy(T.gateStand);
  step(2);
  const gate = allTargets().find((t) => t.kind === 'gate');
  return { rt, T, step, toasts, sound, gate, player };
}
const atGate = () => {
  game.reset();
  game.set('edena.gate.roots', true);
  game.set(`quest.${Q}`, 'gate');
};

test('registered as film.js lists it', () => {
  assert.deepEqual(MOMENTS, WORLD_MOMENTS.edena);
  assert.ok(LEN >= 5 && LEN <= 12, `${LEN} s`);
});

test('the gate goes: filmed once, the gate, the lane, the hollow, his face; the controls back while the water still runs', () => {
  atGate();
  const ship = fakeShip(), W = visit({ ship });
  const { rt, T, step, toasts, sound, gate, player } = W;
  assert.equal(rt.quests.stage(Q), 'gate');
  gate.onHit('push');
  assert.equal(game.flag('edena.gate.turned'), true);
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('edena.moment.terraces'), true, 'once per save');
  assert.ok(rt.busy(), 'the traveller is held');
  const n0 = ship.shots.length;
  step(Math.round(LEN * 30) - 6);
  assert.ok(rt.moments.playing, 'still playing to its last panel');
  assert.ok(!toasts.some((t) => /gate tears loose|takes the terraces|gives one notch|cracks, deep/.test(t)), 'no toast says what the panels show');
  step(10);
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(T.state.flood < T.FLOOD_S && !game.flag('edena.terraces.flooded'), 'while the water is still running (the climax, not after it)');
  assert.deepEqual(sound.swells, ['father'], 'the father’s theme over it');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line for him: it shows, it doesn’t tell');
  // every panel looked at what it should
  const shots = ship.shots.slice(n0), at = (s) => shots[Math.round(s * 30)];
  const wheel = T.wheelAt, cz = T.flood.cz;
  assert.ok(at(1).look.distanceTo(wheel) < 4 && at(1).pos.distanceTo(wheel) < 20, 'A: on the gate');
  const B = at(TERRACES.A + 1.5);
  assert.ok(Math.abs(B.look.z - cz) < 3 && B.look.x < TR.x1 && B.look.x > TR.hollow.x, 'B: down the lane, on the water');
  const C = at(TERRACES.A + TERRACES.B + 0.9);
  assert.ok(Math.hypot(C.pos.x - TR.hollow.x, C.pos.z - TR.hollow.z) < TR.hollow.r + 5 && C.look.x > C.pos.x, 'C: from the hollow, up the slope');
  const D = at(LEN - 1);
  assert.ok(D.look.distanceTo(player.pos) < 2.2 && D.pos.distanceTo(player.pos) < 3.5, 'D: close on his face');
  // the flood goes on, and lands as it always did
  step(Math.round((T.FLOOD_S - T.state.flood) * 30) + 20);
  assert.equal(game.flag('edena.terraces.flooded'), true);
  const shown = T.shown();
  assert.ok(shown.after && !shown.gate && !shown.lane);
  assert.ok(toasts.some((t) => /water goes quiet/.test(t)), 'and the last toast, when it comes');
  step(2);
  assert.equal(rt.quests.stage(Q), 'sorry');
  assert.equal(rt.world.film.terraces(), false, 'never twice');
});

test('skipped (after the grace), the flood still lands the same', () => {
  atGate();
  const ship = fakeShip(), { rt, T, step, gate } = visit({ ship });
  gate.onHit('push');
  assert.ok(rt.moments.playing);
  step(25);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing && !rt.busy(), 'back to you at once');
  assert.ok(ship.log.some(([k, b]) => k === 'release' && b === 0.5));
  step(Math.round(T.FLOOD_S * 30) + 20);
  assert.equal(game.flag('edena.terraces.flooded'), true);
  assert.ok(T.shown().after && !T.shown().gate);
  step(2);
  assert.equal(rt.quests.stage(Q), 'sorry');
});

test('without the ship’s camera the gate goes as it always did, its toasts and all', () => {
  atGate();
  const { rt, T, step, toasts, sound, gate } = visit();
  gate.onHit('push');
  assert.ok(!rt.moments.playing && !rt.busy());
  step(Math.round(T.FLOOD_S * 30) + 20);
  assert.equal(game.flag('edena.terraces.flooded'), true);
  assert.ok(toasts.some((t) => /gate tears loose/.test(t)) && toasts.some((t) => /takes the terraces/.test(t)));
  assert.deepEqual(sound.swells, []);
  assert.equal(game.flag('edena.moment.terraces'), undefined);
});

test('show, don’t tell: no lines in his voice, a quiet face', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/edena-moments.js', import.meta.url), 'utf8');
  assert.ok(!/line:|spoken\(/.test(src), 'nothing said');
  const looks = [...src.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  for (const l of ['surprised', 'happy', 'scared', 'shout', 'playful']) assert.ok(!looks.includes(l), `no ${l} face`);
  assert.ok(looks.includes('sad') || looks.includes('solemn'), 'quiet dismay');
});
