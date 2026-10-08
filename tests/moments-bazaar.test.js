// The Signal Market's climax, filmed (src/story/bazaar-moments.js): the tower wakes, the street
// signs go white, the square stops, his face; then the broadcast's voice, as a conversation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { createBazaar } = await import('../src/levels/bazaar.js');
const { Physics } = await import('../src/physics.js');
const { Crowd } = await import('../src/crowd.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { MOMENTS, BROADCAST } = await import('../src/story/bazaar-moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

game.reset();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const scene = new THREE.Scene();
const level = createBazaar(scene);
const physics = new Physics(scene, level.ground);
level.init(physics);
const G = level.signal, P = G.places;
const fakeNPC = (kind) => ({ kind, pooled: true, person: null, assign(p) { this.person = p; }, release() { this.person = null; } });
const crowd = new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: fakeNPC });
const ship = { log: [], shots: [], playing: false, busy: () => false, auto: null };
ship.shot = (c) => ship.shots.push(c);
ship.release = (b) => ship.log.push(['release', b]);
ship.cinema = { bars: (on) => ship.log.push(['bars', on]), hud: (on) => ship.log.push(['hud', on]), say: (l) => ship.log.push(['say', l?.text ?? null]), skip: (k, on, label) => ship.log.push(['skip', on, label]) };
const player = { pos: P.console.clone().setY(44).add(V(0, 0, 1.6)), vel: V(), heading: Math.PI, riding: false, vehicles: [...level.vehicles], frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const swells = [], toasts = [];
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, toolClick() {}, swell(k, at) { swells.push([k, at]); return 8; } };
const camera = new THREE.PerspectiveCamera();
const rt = createStory({ levelId: 'bazaar', scene, physics, level, player, npcs: [], crowd, sound, journal: { sections: [], el: { addEventListener() {} } }, story: {},
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
const { quests, dialogue } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => {
  for (let i = 0; i < n; i++) {
    clock += dt;
    camera.position.copy(player.pos).add(V(0, 2, 4)); camera.lookAt(player.pos); camera.updateMatrixWorld();
    rt.update(dt, clock, { camera });
    rt.frameCamera(camera);
    crowd.update(dt, clock, player, camera);
  }
};
const LEN = BROADCAST.A + BROADCAST.B + BROADCAST.C + BROADCAST.D;
/** Ready to play: the recording in hand, the antenna tuned, the tower silent. */
const ready = () => {
  game.set('bazaar.broadcast.on', undefined);
  game.set('bazaar.antenna.tuned', true);
  if (!quests.has('recording')) quests.give('recording');
  dialogue.open && dialogue.close();
  step(2);
};
const voice = () => dialogue.open && dialogue.runner?.person.id === 'broadcast';
const hear = () => { while (!dialogue.runner.lastPage) dialogue.runner.advance(); dialogue.close(); step(3); };

test('the market’s moment is the one the registry lists, and short', () => {
  assert.deepEqual(MOMENTS, WORLD_MOMENTS.bazaar);
  assert.ok(LEN >= 5 && LEN <= 12, `${LEN} s`);
});

test('the broadcast’s waking is filmed once: the covers, the white signs, the stopped square, his face; the voice opens at its end', () => {
  ready();
  W.play();
  assert.ok(rt.moments.playing, 'the moment plays');
  assert.equal(game.flag('bazaar.moment.broadcast'), true, 'once per save');
  assert.ok(rt.busy(), 'the traveller is held');
  assert.ok(!quests.has('recording'));
  const n0 = ship.shots.length;
  step(Math.round(BROADCAST.A * 30) - 2);
  assert.ok(G.covers.every((c) => !c.visible) && !G.coversAll.visible, 'all the covers lifted inside the first panel');
  assert.ok(!voice(), 'the voice waits');
  const looking = crowd.people.filter((p) => p.gazeAt && p.gazeUntil > crowd.time).length;
  assert.ok(looking > crowd.people.length * 0.9, 'the market turns to the tower');
  step(Math.round((BROADCAST.whiteAt - BROADCAST.A) * 30) + 4);
  assert.ok(W.state.cast?.film, 'still filmed');
  step(Math.round((BROADCAST.swellAt - BROADCAST.whiteAt) * 30) + 2);
  assert.deepEqual(swells.map(([k]) => k), ['father'], 'the father’s theme');
  assert.ok(!voice(), 'not yet');
  step(Math.round((LEN - BROADCAST.swellAt) * 30) + 3);
  assert.ok(!rt.moments.playing, 'back to you, as');
  assert.ok(voice(), 'the voice begins');
  assert.equal(dialogue.runner.nodeId, 'play');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line in the film: it shows, it doesn’t tell');
  // the panels frame what they should
  const shots = ship.shots.slice(n0), at = (s) => shots[Math.round(s * 30)];
  const tower = V(0, 50, -240);
  const A = at(1.5), B = at(BROADCAST.A + 1), C = at(BROADCAST.A + BROADCAST.B + 1), D = at(BROADCAST.A + BROADCAST.B + BROADCAST.C + 1);
  assert.ok(A.look.distanceTo(tower) < 8 && A.pos.y < 10 && A.pos.z > -200, 'A: from the square up the whole tower');
  assert.ok(B.pos.z > 0 && B.pos.y > 15 && B.look.x > 40 && B.look.y > 50, 'B: up the avenue, at the street-facing signs high on the towers');
  assert.ok(C.pos.z < -230 && C.pos.y > 12 && C.look.y < 3 && C.look.distanceTo(P.square) < 16, 'C: from the tower down over the square');
  assert.ok(D.look.distanceTo(player.pos) < 2.2 && D.pos.distanceTo(player.pos) < 3.5, 'D: close on his face');
  hear();
  assert.equal(game.flag('bazaar.broadcast.on'), true);
  assert.ok(G.covers.every((c) => !c.visible) && !G.coversAll.visible);
  assert.ok(game.keepsakes().some((k) => k.id === 'bazaar.word'));
  assert.equal(W.film.broadcast(), false, 'never again');
});

test('skipped, it lands the same: the tower awake, the signs white, the voice opening', () => {
  ready();
  game.set('bazaar.moment.broadcast', undefined);
  W.play();
  assert.ok(rt.moments.playing);
  step(10);
  assert.equal(rt.moments.skip(), false, 'not inside the grace');
  step(12);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing);
  assert.ok(voice(), 'the voice opens at once');
  assert.equal(W.state.cast?.film, false);
  step(30);
  assert.ok(G.covers.every((c) => !c.visible) && !G.coversAll.visible, 'every screen lit');
  hear();
  assert.equal(game.flag('bazaar.broadcast.on'), true);
});

test('without the ship’s camera (a scene up) the market does what it always did', () => {
  ready();
  game.set('bazaar.moment.broadcast', undefined);
  ship.playing = true;
  try {
    W.play();
    assert.ok(!rt.moments.playing);
    assert.ok(!game.flag('bazaar.moment.broadcast'));
    step(30 * 2);
    assert.ok(!G.coversAll.visible && G.covers.some((c) => c.visible) && G.covers.some((c) => !c.visible), 'the tower wakes row by row');
    assert.ok(!voice());
    step(30 * 2.5);
    assert.ok(voice(), 'the voice at 3.8 s, as before');
    hear();
    assert.equal(game.flag('bazaar.broadcast.on'), true);
  } finally { ship.playing = false; }
});

test('show, don’t tell: no lines for him, a still face', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/story/bazaar-moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(|line\s*:/.test(src), 'nothing said');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  for (const l of looks) assert.ok(!/'(surprised|happy|shout|scared|playful|smirk)'/.test(l), `a still face: ${l}`);
});
