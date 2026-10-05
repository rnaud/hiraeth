// Moments: a first time filmed (src/story/moment.js), and the desert's two (src/story/desert-moments.js):
// the water's first run into the giant's basin, and the empty tank's first fill.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { Moment, MomentStage, shotAt, shotIndex, shotsLength, EASE } = await import('../src/story/moment.js');
const { game } = await import('../src/game-state.js');
const { parseLine } = await import('../src/story/tone.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** A stage that writes down what it is asked. */
const fakeStage = () => {
  const log = [];
  return {
    log, shots: [],
    shot(c) { this.shots.push(c); }, release: (b) => log.push(['release', b]), bars: (on) => log.push(['bars', on]), hud: (on) => log.push(['hud', on]),
    say: (line) => log.push(['say', line?.text ?? null]), skipTag: (on) => log.push(['tag', on]), game,
  };
};
/** The ship as the moments see it: its camera and its Cinema. */
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};
const run = (m, secs, dt = 1 / 30) => { for (let t = 0; t < secs && !m.done; t += dt) m.update(dt); };
const two = [
  { dur: 2, ease: 'linear', from: { pos: V(0, 0, 0), look: V(0, 0, -1), fov: 40 }, to: { pos: V(2, 0, 0), look: V(2, 0, -1), fov: 50 } },
  { dur: 1, from: (t) => ({ pos: V(10 + t, 0, 0), look: V(10, 0, -1) }) },
];

test('shots: panels in time order, each a move or a hold, eased, a frame may follow something', () => {
  assert.equal(shotsLength(two), 3);
  const a = shotAt(two, 1);
  assert.equal(a.i, 0);
  assert.ok(a.pos.distanceTo(V(1, 0, 0)) < 1e-9 && Math.abs(a.fov - 45) < 1e-9, 'halfway along the move');
  const b = shotAt(two, 2.5);
  assert.equal(b.i, 1, 'then a cut to the next panel');
  assert.ok(b.pos.distanceTo(V(10.5, 0, 0)) < 1e-9, 'a frame given as a function is asked at the shot’s own time');
  assert.equal(b.fov, 50, 'no fov: the default');
  assert.equal(shotAt(two, 9).i, 1, 'past the end the last panel holds');
  assert.equal(shotIndex(two, 9).t, 1);
  for (const k of Object.keys(EASE)) { assert.equal(EASE[k](0), 0, k); assert.ok(Math.abs(EASE[k](1) - 1) < 1e-9, k); }
  assert.ok(EASE.inOut(0.25) < 0.25 && EASE.out(0.25) > 0.25);
});

test('a moment plays once through: letterbox up, beats and lines in order, the camera every frame, then back to you', () => {
  game.set('test.moment.a', undefined);
  const S = fakeStage(), order = [];
  let ended = null;
  const m = new Moment({ id: 'a', flag: 'test.moment.a', shots: two, stage: S,
    beats: [{ t: 0.5, run: () => order.push('b1') }, { t: 1.2, line: { who: 'you', text: 'Hm.', tone: 'curious' }, secs: 1 }, { t: 2.2, run: () => order.push('b3') }],
    onEnd: (mm, skipped) => { ended = { skipped, n: (ended?.n ?? 0) + 1 }; } });
  m.start();
  assert.equal(game.flag('test.moment.a'), true, 'once per save: its flag is set as it starts');
  assert.deepEqual(S.log.slice(0, 3), [['bars', true], ['hud', false], ['tag', true]]);
  run(m, 5);
  assert.ok(m.done && !m.skipped);
  assert.deepEqual(order, ['b1', 'b3']);
  assert.ok(S.log.some(([k, v]) => k === 'say' && v === 'Hm.'), 'the line goes up');
  assert.ok(S.shots.length > 80, 'a camera every frame');
  assert.equal(S.shots[0].pos.x, 0);
  const end = S.log.slice(-5);
  assert.deepEqual(end, [['say', null], ['release', 1.2], ['bars', false], ['hud', true], ['tag', false]], 'and everything put back');
  assert.deepEqual(ended, { skipped: false, n: 1 }, 'its end runs once');
  m.update(1 / 30); m.finish(true);
  assert.equal(ended.n, 1, 'never twice');
});

test('skip: not in its first moments (a press mashed through), then on the next frame, to its end', () => {
  const S = fakeStage(), said = [];
  let skipped = null;
  const m = new Moment({ id: 'b', shots: two, stage: S, beats: [{ t: 2, line: { who: 'you', text: 'Late.', tone: 'neutral' } }], onEnd: (mm, s) => { skipped = s; } });
  m.start();
  run(m, 0.3);
  assert.equal(m.skip(), false, 'inside the grace a press does nothing');
  run(m, 0.5);
  assert.equal(m.skip(), true);
  assert.equal(m.done, false, 'the key that asked opens nothing else: it ends on the next frame');
  m.update(1 / 30);
  assert.ok(m.done && m.skipped && skipped === true);
  for (const [k, v] of S.log) if (k === 'say') said.push(v);
  assert.ok(!said.includes('Late.'), 'what comes after is not said');
  assert.deepEqual(S.log.find(([k]) => k === 'release'), ['release', 0.5], 'a quicker blend back');
});

test('a moment that fails ends at once and still runs its end (the state it shows is the caller’s)', () => {
  const S = fakeStage(), warn = console.warn;
  let skipped = null;
  console.warn = () => {};
  try {
    const m = new Moment({ id: 'c', shots: two, stage: S, onFrame: (mm, t) => { if (t > 1) throw new Error('boom'); }, onEnd: (mm, s) => { skipped = s; } });
    m.start();
    run(m, 3);
    assert.ok(m.done && m.failed);
    assert.equal(skipped, true);
    assert.ok(S.log.some(([k, v]) => k === 'bars' && v === false), 'the letterbox comes down');
  } finally { console.warn = warn; }
});

test('the stage: one at a time, once per save, never without the ship’s camera nor over a scene, and a failed start falls back', () => {
  game.set('test.moment.d', undefined);
  const def = (o = {}) => ({ id: 'd', flag: 'test.moment.d', shots: two, ...o });
  assert.equal(new MomentStage({ game }).play(def()), null, 'no ship, no moment: the caller does what it always did');
  const ship = fakeShip(), stage = new MomentStage({ ship, game, player: { pos: V(0, 0, 0), vel: V(1, 0, 1) } });
  ship.playing = true;
  assert.equal(stage.play(def()), null, 'not over the ship’s own scenes');
  ship.playing = false;
  let talking = true;
  const quiet = new MomentStage({ ship, game, quiet: () => talking });
  assert.equal(quiet.play(def()), null, 'nor over a conversation');
  talking = false;
  const m = stage.play(def());
  assert.ok(m && stage.playing);
  assert.equal(stage.player.vel.x, 0, 'the traveller stops where he is');
  assert.deepEqual(ship.log.find(([k]) => k === 'skip'), ['skip', true, 'Esc skip'], 'the corner tag says how to skip');
  assert.equal(stage.play(def({ flag: null })), null, 'one at a time');
  for (let i = 0; i < 200 && stage.playing; i++) stage.update(1 / 30);
  assert.ok(!stage.playing && stage.current === null);
  assert.ok(ship.log.some(([k, b]) => k === 'release' && b === 1.2), 'the camera blends back to you');
  assert.equal(stage.play(def()), null, 'once per save');
  // a moment whose start throws: nothing of its end runs (the caller falls back and does all of it)
  const warn = console.warn;
  console.warn = () => {};
  let ended = false;
  try {
    assert.equal(stage.play({ id: 'e', shots: two, onStart: () => { throw new Error('no'); }, onEnd: () => { ended = true; } }), null);
  } finally { console.warn = warn; }
  assert.ok(!stage.playing && !ended);
  assert.ok(ship.log.filter(([k, v]) => k === 'bars' && v === false).length >= 2, 'and the letterbox is down again');
});

test('show, don’t tell: the desert’s moments give the traveller no lines, and a slight smirk at most', async () => {
  const data = await import('../src/story/desert-data.js');
  assert.equal(data.MOMENT_LINES, undefined, 'no lines for him in them');
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/desert-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(\s*'you'/.test(src), 'nothing said in his voice');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 2, 'his face reacts');
  for (const l of looks) assert.ok(!/'(surprised|happy|shout|scared|playful)'/.test(l), `no big face: ${l}`);
});

// ------------------------------------------------------------------ the desert's two, in the story
const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { items } = await import('../src/items.js');
const { FLOW, FILL } = await import('../src/story/desert-moments.js');
const scene = new THREE.Scene();
const level = createDesert(scene);
const physics = new Physics(scene, level.ground);
const Q = level.qanat;
const player = { pos: V(0, level.ground.heightAt(0, 0), 0), vel: V(), wind: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; }, rumble() {}, splash() {} };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
const ship = fakeShip();
const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: {},
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
const W = rt.world, C = Q.cave;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, i * dt, { camera }); } };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('the first run of the water is filmed once: the rib, the crack, the basin, his face; the toast after; skipped, it lands the same', async () => {
  items.grant('backpack');
  game.set('tool.empty', true);
  assert.equal(W.dry(), true);
  // at the carved post, the keepers' pole in it: three heaves
  const perp = V(-C.chDir.z, 0, C.chDir.x).normalize();
  player.pos.copy(W.lever.postAt).addScaledVector(perp, -2.4);
  for (let i = 0; i < W.lever.HEAVES; i++) { W.lever.heave(); step(30); }
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(game.flag('desert.channel.open'), true, 'the rib is off: the water runs, film or no film');
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('desert.moment.flow'), true, 'once per save');
  assert.ok(rt.busy(), 'the traveller is held while it plays');
  assert.ok(!toasts.some((t) => /Water runs/.test(t)), 'its toast waits for its end');
  const n0 = ship.shots.length;
  step(Math.round(FLOW.flowDelay * 30) - 4);
  assert.ok(st().flow === 0, 'the water waits for the crack’s panel');
  step(Math.round((FLOW.B + FLOW.C) * 30));
  assert.ok(st().flow >= 1 && st().level > C.levels.dry + 0.05, 'by the basin’s panel the stream has run and the pool is spreading');
  assert.deepEqual(sound.swells, ['motif'], 'the world’s motif swells over it');
  step(Math.round(FLOW.D * 30) + 30);
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line: it shows, it doesn’t tell');
  assert.ok(toasts.some((t) => /Water runs/.test(t)), 'and the toast');
  // every panel looked at what it should: the rib (A), the gutter (B), the basin (C), his face (D)
  const shots = ship.shots.slice(n0);
  const near = (s, p, r) => s.look.distanceTo(p) < r;
  assert.ok(near(shots[10], C.boneRest.pos, 4), 'A looks at the rib');
  assert.ok(shots.slice(Math.round(FLOW.A * 30) + 8, Math.round((FLOW.A + FLOW.B) * 30) - 2).every((s) => C.streamAt(0.5).distanceTo(s.look) < 12), 'B follows the gutter');
  const D = shots[Math.round((FLOW.A + FLOW.B + FLOW.C + 1) * 30)];
  assert.ok(D.look.distanceTo(player.pos) < 2.2 && D.pos.distanceTo(player.pos) < 3.5, 'D is close on his face');
  for (const s of shots) assert.ok(s.pos.distanceTo(C.origin) < 30 && s.pos.y < C.origin.y + 12, 'every camera inside the giant’s chest');
  // a second time never plays (a save from before: the flag is set)
  assert.equal(W.film.flow('again'), false);
});

test('the empty tank’s first fill is filmed once: it fills on its beat, the jar too, the controls said after; skipping lands it all', () => {
  assert.equal(W.dry(), true, 'the tank is still empty');
  rt.quests.give('jar');
  for (let i = 0; i < 400 && st().level < C.levels.high - 0.05; i++) step(1, 1 / 10);   // (the pool up)
  const refills = [];
  const offRefill = game.on('tool:refill', (e) => refills.push(e));
  toasts.length = 0;
  // wade in at the edge
  const c = C.poolCenter, r = C.basinR(st().level) - 1.2, edge = V(c.x + r, C.origin.y + st().level - 0.3, c.z);
  player.pos.copy(edge);
  step(1);
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('desert.moment.fill'), true);
  assert.deepEqual(refills, [], 'the glass is still dry: it fills on its beat');
  step(Math.round(FILL.fillAt * 30) + 3);
  assert.equal(refills.length, 1, 'it fills');
  assert.equal(game.flag('tool.empty'), false, 'for good');
  assert.ok(!rt.quests.has('water'), 'the jar waits for the end');
  assert.deepEqual(sound.swells.slice(-1), ['father'], 'the father’s theme');
  // skip it now (B / ○, Menu, Esc)
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing);
  assert.equal(refills.length, 1, 'never twice');
  assert.ok(rt.quests.has('water'), 'the jar fills at its end');
  assert.ok(toasts.some((t) => /RT \/ R2/.test(t) && /RB \/ R1/.test(t)), 'and the controls, in Xbox / PlayStation form');
  assert.equal(W.dry(), false);
  offRefill?.();
});

test('without the ship’s camera (or once seen) the desert does what it always did, at once', () => {
  // a save that saw it: the flag holds it back
  game.set('tool.empty', true);
  const refills = [];
  game.on('tool:refill', (e) => refills.push(e));
  toasts.length = 0;
  player.pos.copy(Q.city.wellLook); step(2);
  const c = C.poolCenter;
  player.pos.copy(V(c.x, C.origin.y - 1.5, c.z)); step(2);
  assert.ok(!rt.moments.playing, 'no second time');
  assert.equal(refills.length, 1, 'it fills at once');
  assert.ok(toasts.some((t) => /empty tank fills/.test(t)));
});

function st() { return W.state; }
