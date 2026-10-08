// The City-Shaft's climax, filmed (src/story/incal-moments.js): the splinter given back from the
// palace's crown, and the Lodestar lit again. It plays once, holds the traveller, frames the climb,
// the flare, the wall's LOOK UP and his face, says nothing for him, and gives the controls back while
// the light still rises; skipped mid-climb, the light burns at once; without the ship's camera the
// old framing (st.cine) and toasts, as ever.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };
const warn = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('toNonIndexed')) warn(...a); };

const { createIncal } = await import('../src/levels/incal.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { clearInteractables } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');
const { MOMENTS, LODESTAR } = await import('../src/story/incal-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = 'incal.light';
const LEN = LODESTAR.A + LODESTAR.B + LODESTAR.C + LODESTAR.D;

const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

const scene = new THREE.Scene();
const level = createIncal(scene);
const physics = new Physics(scene, null);
level.init(physics);
const S = level.shaft, P = S.places;
const npcs = spawnNPCs(scene, physics, CONTENT.incal.npcs, {});

/** A visit with the splinter in hand, on the palace's crown, looking up (the quest at 'look'). */
function visit({ ship = null } = {}) {
  game.reset();
  game.set(`quest.${Q}`, 'look');
  clearInteractables(); clearTargets();
  S.incal.k = 0; S.incal.flare = 0;
  const player = { pos: P.palace.crown.clone().add(V(3.5, 0, 1.5)), vel: V(), heading: 0.7, riding: false, vehicles: [...level.vehicles], frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { swells: [], setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swell(k) { this.swells.push(k); return 8; } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  const rt = createStory({ levelId: 'incal', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  rt.quests.give('splinter');
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) {
      clock += dt;
      camera.position.copy(player.pos).add(V(0, 2, 4)); camera.lookAt(S.incal.pos); camera.updateMatrixWorld();
      rt.update(dt, clock, { camera });
    }
  };
  return { rt, W: rt.world, step, toasts, sound, player, camera };
}

test('registered as film.js lists it', () => {
  assert.deepEqual(MOMENTS, WORLD_MOMENTS.incal);
  assert.ok(LEN >= 5 && LEN <= 12, `${LEN} s`);
});

test('the light given back: filmed once, the climb, the flare, the wall, his face; the controls back while it still rises', () => {
  const ship = fakeShip(), { rt, W, step, toasts, sound, player } = visit({ ship });
  step(45);   // looking up from the crown: it goes home
  assert.ok(W.state.release, 'the splinter climbs');
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('incal.moment.lodestar'), true, 'once per save');
  assert.ok(rt.busy(), 'the traveller is held');
  assert.ok(!W.state.cine, 'the old framing gives way to it');
  const n0 = ship.shots.length - 1, t0 = rt.moments.current.t;
  step(Math.round((LODESTAR.ARRIVE - t0) * 30) + 6);
  assert.equal(game.flag('incal.lit'), true, 'it lands on its own clock, mid-moment');
  assert.deepEqual(sound.swells, ['motif'], 'the world’s motif as it flares');
  assert.ok(!toasts.some((t) => /flares|slips out/.test(t)), 'what is said waits for the end');
  step(Math.round((LEN - LODESTAR.ARRIVE) * 30) + 6);
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(S.incal.k < 0.97 && S.incal.k > 0.5, `while the light is still rising (${S.incal.k.toFixed(2)})`);
  assert.ok(toasts.some((t) => /The Lodestar flares/.test(t)), 'and its toast, after');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line for him');
  assert.equal(rt.quests.stage(Q), 'tell');
  // the panels
  const shots = ship.shots.slice(n0), at = (s) => shots[Math.round((s - t0) * 30)];
  const A = at(1.6);
  assert.ok(A.pos.distanceTo(player.pos) < 6 && A.look.y > A.pos.y + 1, 'A: by him, looking up');
  const B = at(LODESTAR.A + 1.2);
  assert.ok(Math.hypot(B.pos.x, B.pos.z) > 80 && B.look.y > P.palace.y + 60, 'B: from out beside the dome, up to the light');
  const C = at(LODESTAR.A + LODESTAR.B + 0.9);
  assert.ok(S.billboards.some((b) => b.pos.distanceTo(C.look) < 8), 'C: on a billboard of the wall');
  const D = at(LEN - 0.8);
  assert.ok(D.look.distanceTo(player.pos) < 2.2 && D.pos.distanceTo(player.pos) < 3.5, 'D: close on his face');
  assert.equal(W.film.lodestar(), false, 'never twice');
});

test('skipped mid-climb, the light burns at once', () => {
  const ship = fakeShip(), { rt, W, step, toasts } = visit({ ship });
  step(45);
  assert.ok(rt.moments.playing);
  step(20);
  assert.ok(!game.flag('incal.lit'));
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing && !rt.busy());
  assert.equal(game.flag('incal.lit'), true, 'home at once');
  assert.ok(!W.state.release && !rt.quests.has('splinter'));
  assert.ok(toasts.some((t) => /The Lodestar flares/.test(t)));
  step(150, 1 / 20);
  assert.ok(S.incal.k > 0.9);
});

test('without the ship’s camera the light goes home as it always did', () => {
  const { rt, W, step, toasts, sound } = visit();
  step(45);
  assert.ok(W.state.release && W.state.cine, 'the old framing');
  assert.ok(!rt.moments.playing);
  assert.ok(toasts.some((t) => /slips out of your hand/.test(t)));
  step(150);
  assert.equal(game.flag('incal.lit'), true);
  assert.ok(toasts.some((t) => /The Lodestar flares/.test(t)));
  assert.deepEqual(sound.swells, []);
});

test('show, don’t tell: no lines in his voice, a slight smirk at most', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/incal-moments.js', import.meta.url), 'utf8');
  assert.ok(!/line:|spoken\(/.test(src));
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1);
  for (const l of looks) assert.ok(!/'(surprised|happy|shout|scared|playful)'/.test(l), l);
});
