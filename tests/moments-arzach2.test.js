// Vael II's first time, filmed (src/story/arzach2-moments.js): the rope is pulled and the bell rings
// after thirty years; the cloud settles.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createArzach2, ARZACH2_CONTENT } = await import('../src/levels/arzach2.js');
const { Physics } = await import('../src/physics.js');
const { NPC } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { LOCALS } = await import('../src/story/arzach2-data.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { clearTargets } = await import('../src/targets.js');
const { BELL, MOMENTS } = await import('../src/story/arzach2-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

/** A fresh Vael II at the bell's stage (the clapper hung), with or without the ship's camera. */
function world({ ship = null } = {}) {
  game.reset();
  clearInteractables(); clearTargets();
  const scene = new THREE.Scene();
  const level = createArzach2(scene);
  const physics = new Physics(scene, level.ground);
  const A = level.arzach2;
  const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
  const tolls = [];
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; },
    ctx: { currentTime: 0 }, instrument: (kind, f) => { if (kind === 'bell' && f === 82.4) tolls.push(f); } };
  const toasts = [];
  const camera = new THREE.PerspectiveCamera();
  const npcs = ARZACH2_CONTENT.npcs.map((s) => new NPC(scene, physics, { route: [V(s.at[0], physics.groundAt(s.at[0], (s.y ?? 1e4) + 2, s.at[1]), s.at[1])], palette: s.palette, lines: s.lines }));
  const rt = createStory({ levelId: 'arzach2', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
  const { quests } = rt;
  let clock = 0;
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
  // to the bell's stage: Aube, then the clapper hung (the story catches up)
  const aube = LOCALS.find((p) => p.id === 'aube');
  quests.opening('aube');
  const r = new DialogueRunner(aube, { game, quests });
  for (const c of ['Why is it higher', 'I’ll go up']) {
    while (r.advance());
    r.choose(r.choices().find((x) => x.text.startsWith(c)).index);
    while (!r.ended && r.advance());
  }
  game.set('arzach2.clapper.hung', true);
  step(2);
  assert.equal(quests.stage('arzach2.bell'), 'ring');
  return { rt, W: rt.world, A, player, sound, toasts, tolls, step, quests, ship };
}
const pull = (w) => {
  w.player.pos.copy(w.A.ropeFoot).add(V(0.4, -0.9, 0.6));
  const e = bestInteractable(w.player);
  assert.equal(e?.entry.id, 'bellrope');
  e.entry.use(w.player);
};

test('the registry and show, don’t tell: Vael II’s moment is the one in film.js', async () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.arzach2.map(({ id, flag }) => ({ id, flag })));
  const len = BELL.A + BELL.B + BELL.C + BELL.D;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);  // show, don't tell: nothing in his voice, a slight smirk at most
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/arzach2-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line:/.test(src), 'no lines in it');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1 && looks.every((l) => !/'(surprised|happy|shout|scared|playful)'/.test(l)), 'no big face');
});

test('the bell’s first ringing is filmed once: the tower, the bell, the cloud, his face; the controls back while it still tolls and the cloud still goes down', () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, A, player, ship, step, toasts, sound, tolls } = w;
  toasts.length = 0;
  const cloud0 = A.cloud[0].position.y;
  pull(w);
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('arzach2.moment.bell'), true, 'once per save');
  assert.equal(game.flag('arzach2.bell.rung'), true, 'the bell has rung, film or no film');
  assert.ok(rt.busy(), 'the traveller is held');
  assert.ok(!toasts.some((t) => /The bell speaks/.test(t)), 'its toast waits for its end');
  assert.equal(W.bell.t, -1, 'the pull is seen first: it rings on its beat');
  const n0 = ship.shots.length;
  step(Math.round(BELL.RING * 30) + 2);
  assert.ok(W.bell.t >= 0 && W.bell.ringing, 'it rings');
  assert.equal(tolls.length, 1, 'the first toll');
  step(Math.round((BELL.SETTLE - BELL.RING) * 30) - 6);
  assert.ok(Math.abs(A.cloud[0].position.y - cloud0) < 1e-6, 'the cloud waits to be seen going down');
  for (let i = 0; i < 30 * 12 && rt.moments.playing; i++) step(1);
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(tolls.length >= 4, `it tolled on (${tolls.length})`);
  assert.ok(W.bell.t >= 0 && W.bell.ringing, 'and is still swinging when the controls come back');
  assert.ok(W.bell.settle > 0.2 && W.bell.settle < 1, `the cloud still going down (${W.bell.settle.toFixed(2)})`);
  assert.ok(A.cloud[0].position.y < cloud0 - 3, 'it has gone down');
  assert.deepEqual(sound.swells, ['father'], 'the father’s theme');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line in his voice');
  assert.ok(toasts.some((t) => /The bell speaks/.test(t)), 'the toast at its end');
  // the panels
  const shots = ship.shots.slice(n0);
  const at = (s) => shots[Math.min(shots.length - 1, Math.round(s * 30))];
  assert.ok(at(1).pos.distanceTo(player.pos) > 25, 'A is wide');
  assert.ok(at(BELL.A + 1).look.distanceTo(A.bell.position) < 3, 'B is on the bell');
  const C = at(BELL.A + BELL.B + 1);
  assert.ok(C.pos.distanceTo(A.ropeFoot) > 80 && C.look.y < A.monastery.y - 80, 'C is out at the cliff’s lip, looking down over the cloud');
  const D = at(BELL.A + BELL.B + BELL.C + 1);
  assert.ok(D.look.distanceTo(player.pos) < 2.2 && D.pos.distanceTo(player.pos) < 3.5, 'D is close on his face');
  // and the cloud settles all the way, as it always did
  step(30 * 10);
  assert.equal(W.bell.settle, 1);
  assert.ok(A.cloud[0].position.y < cloud0 - 15);
  assert.equal(rt.quests.stage('arzach2.bell'), 'listen');
  // a second pull: just the bell, no moment
  pull(w);
  assert.ok(!rt.moments.playing);
});

test('skipped, it lands the same: the bell rings, the cloud settles, the toast', () => {
  const w = world({ ship: fakeShip() });
  const { rt, W, step, toasts, tolls } = w;
  toasts.length = 0;
  pull(w);
  step(10);
  assert.equal(rt.moments.skip(), false, 'not in its first moments');
  assert.equal(W.bell.t, -1);
  step(10);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing && !rt.busy());
  assert.ok(W.bell.ringing && tolls.length === 1, 'it rings (once)');
  assert.ok(!W.bell.hold, 'the cloud is let go');
  assert.ok(toasts.some((t) => /The bell speaks/.test(t)));
  step(30 * 13);
  assert.equal(W.bell.settle, 1, 'settled');
});

test('without the ship’s camera Vael II does what it always did: the bell at once, the cloud over twelve seconds', () => {
  const w = world();
  const { rt, W, step, toasts, tolls } = w;
  toasts.length = 0;
  pull(w);
  assert.ok(!rt.moments.playing);
  assert.equal(game.flag('arzach2.moment.bell'), undefined);
  assert.ok(W.bell.ringing && W.bell.t === 0, 'it rings at once');
  assert.ok(toasts.some((t) => /The bell speaks/.test(t)), 'the toast at once');
  step(1);
  assert.equal(tolls.length, 1);
  step(30 * 6);
  assert.ok(W.bell.settle > 0.45 && W.bell.settle < 0.55, `its own twelve seconds (${W.bell.settle.toFixed(2)})`);
  clearInteractables(); clearTargets();
});
