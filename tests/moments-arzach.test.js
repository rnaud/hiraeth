// Vael's first time, filmed (src/story/arzach-moments.js): the rider's flute is played, and the bird
// comes down out of the haze for the first time, lands before the traveller and bows.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const quiet = (f) => { const w = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = w; } };
const { createArzach } = await import('../src/levels/arzach.js');
const { Physics } = await import('../src/physics.js');
const { NPC } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE } = await import('../src/story/arzach-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');
const { BIRD, MOMENTS } = await import('../src/story/arzach-moments.js');
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

/** A fresh Vael at the flute's stage (the sill, the flute in hand), with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const scene = new THREE.Scene();
  const level = quiet(() => createArzach(scene));
  const physics = new Physics(scene, level.ground);
  const bird = level.mount(physics);
  const player = { pos: V(0, 0, 0), vel: V(), heading: 0, riding: false, ride: null, mount: bird, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, tune: () => true, swells: [], swell(k) { this.swells.push(k); return 8; } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  const npcs = CONTENT.arzach.npcs.map((s) => new NPC(scene, physics, { route: [V(s.at[0], physics.groundAt(s.at[0], 1e4, s.at[1]), s.at[1])], palette: s.palette, lines: s.lines }));
  const rt = createStory({ levelId: 'arzach', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  const { quests } = rt;
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); bird.update(dt, player.riding ? {} : null); } };
  // to the flute's stage: Oïa, the tower, the flute from the sill
  quests.opening('oia');
  const r = new DialogueRunner(PEOPLE.oia, { game, quests });
  for (const c of ['Who lived', 'And the bird', 'I’ve seen that mark', 'I’ll go']) {
    while (r.advance());
    r.choose(r.choices().find((x) => x.text.startsWith(c)).index);
    while (!r.ended && r.advance());
  }
  const T = level.arzach.tower;
  player.pos.copy(T.sill);
  rt.world.takeFlute();
  step(2);
  assert.equal(quests.stage('arzach.bird'), 'call');
  return { rt, W: rt.world, T, bird, player, sound, toasts, step, quests, ship };
}
const play = (w) => {
  const e = bestInteractable(w.player);
  assert.equal(e?.entry.id, 'whistle');
  e.entry.use(w.player);
};

test('the registry and show, don’t tell: Vael’s moment is the one in film.js', async () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.arzach.map(({ id, flag }) => ({ id, flag })));
  const len = BIRD.A + BIRD.B + BIRD.C + BIRD.D;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);  // show, don't tell: nothing in his voice, a slight smirk at most
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/arzach-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line:/.test(src), 'no lines in it');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1 && looks.every((l) => !/'(surprised|happy|shout|scared|playful)'/.test(l)), 'no big face');
});

test('the bird’s first coming down is filmed once: the haze, her coming, his face, her bow; the controls back while she is still bowed', () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, bird, player, ship, step, toasts, sound } = w;
  toasts.length = 0;
  play(w);
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('arzach.moment.bird'), true, 'once per save');
  assert.equal(game.flag('arzach.bird.called'), true, 'the call is played, film or no film');
  assert.equal(bird.dormant, false, 'she can be seen and ridden');
  assert.ok(rt.busy(), 'the traveller is held while it plays');
  assert.ok(!toasts.some((t) => /Five notes/.test(t)), 'the flute’s toast waits for its end');
  const n0 = ship.shots.length;
  const len = BIRD.A + BIRD.B + BIRD.C + BIRD.D, D0 = BIRD.A + BIRD.B + BIRD.C;
  const frames = Math.round(len * 30);
  let landedAt = null, bowAtEnd = null, bowAt = null;
  for (let i = 0; i < frames + 20 && rt.moments.playing; i++) {
    step(1);
    if (landedAt === null && bird.landed) landedAt = i / 30;
    if (bowAt === null && W.bow.t > 0) bowAt = i / 30;
    if (rt.moments.playing) bowAtEnd = W.bow.t;
  }
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(landedAt !== null && landedAt > BIRD.A + BIRD.B - 0.6 && landedAt < D0, `she lands as his face’s panel plays (${landedAt?.toFixed(2)} s)`);
  assert.ok(bowAt !== null && bowAt < D0 + 0.1, `and bows (${bowAt?.toFixed(2)} s)`);
  // the controls come back at the bow's deepest, not after it
  assert.ok(W.bow.t > 0, 'she is still bowing when the controls come back');
  const k = Math.sin(Math.PI * Math.min(bowAtEnd / BIRD.BOW, 1));
  assert.ok(k > 0.6, `bowed low (${k.toFixed(2)})`);
  assert.deepEqual(sound.swells, ['motif'], 'the world’s motif swells');
  assert.ok(!ship.log.some(([kk, v]) => kk === 'say' && v), 'no line: it shows, it doesn’t tell');
  assert.ok(toasts.some((t) => /Five notes/.test(t)), 'the flute’s toast at its end');
  // the panels: A wide behind him, B up at her, C close on his face, D the two of them from out past her
  const shots = ship.shots.slice(n0);
  const at = (s) => shots[Math.min(shots.length - 1, Math.round(s * 30))];
  const a = at(1);
  assert.ok(a.pos.distanceTo(player.pos) > 6, 'A is wide');
  const bShot = at(BIRD.A + 1.5);
  assert.ok(bShot.pos.distanceTo(player.pos) < 4, 'B is beside him');
  assert.ok(bShot.look.y > player.pos.y + 10, 'looking up into the haze at her');
  const c = at(BIRD.A + BIRD.B + 1);
  assert.ok(c.look.distanceTo(player.pos) < 2.2 && c.pos.distanceTo(player.pos) < 3.5, 'C is close on his face');
  const d = at(D0 + 1);
  const mid = player.pos.clone().lerp(bird.pos, 0.5);
  assert.ok(d.look.distanceTo(mid) < 5 && d.pos.distanceTo(bird.pos) > 10, 'D from out past her, on the two of them');
  // then her bow ends and the promise is kept, as it always was
  step(30 * 4);
  assert.equal(game.flag('arzach.bird.promise'), true, 'she bowed');
  assert.equal(W.bow.len, undefined, 'her next bows are their own length');
  // a second time never plays
  assert.equal(W.film.bird({ land: bird.pos.clone(), said: 'x' }), false);
});

test('skipped, it lands the same: she comes down, bows and promises; the toast said', () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, bird, step, toasts } = w;
  toasts.length = 0;
  play(w);
  assert.ok(rt.moments.playing);
  step(10);
  assert.equal(rt.moments.skip(), false, 'not in its first moments');
  step(15);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing, 'skipped');
  assert.ok(!rt.busy());
  assert.ok(toasts.some((t) => /Five notes/.test(t)), 'the toast');
  assert.equal(W.bow.len, undefined, 'her bow its own length');
  for (let i = 0; i < 30 * 20 && !game.flag('arzach.bird.promise'); i++) step(1);
  assert.equal(game.flag('arzach.bird.promise'), true, 'she came down and bowed');
  assert.ok(bird.landed);
});

test('without the ship’s camera Vael does what it always did: she comes from the far haze, the toast at once', () => {
  const w = world();
  const { rt, bird, step, toasts, T } = w;
  toasts.length = 0;
  play(w);
  assert.ok(!rt.moments.playing, 'no moment');
  assert.equal(game.flag('arzach.moment.bird'), undefined);
  assert.ok(toasts.some((t) => /Five notes/.test(t)), 'the toast at once');
  assert.ok(bird.pos.y > T.floor + 100, 'from high over the haze, as always');
  for (let i = 0; i < 30 * 30 && !game.flag('arzach.bird.promise'); i++) step(1);
  assert.equal(game.flag('arzach.bird.promise'), true);
  clearInteractables(); clearTargets();
});
