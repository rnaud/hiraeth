// The Sealed Hangar's climax, filmed (src/levels/dismissed/hangar/moments.js): the signal read through the
// ring's slit, nine dots of light on the floor. Played in the real story runtime with a fake ship.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createGarage } = await import('../src/levels/dismissed/hangar/level.js');
const { Physics } = await import('../src/physics.js');
const { NPC } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE } = await import('../src/levels/dismissed/hangar/story-data.js');
const { CONTENT } = await import('../src/levels/content.js');
const { SIGNAL, MOMENTS } = await import('../src/levels/dismissed/hangar/moments.js');
const { WORLD_MOMENTS } = await import('../src/story/film.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeShip = () => {
  const s = { log: [], shots: [], playing: false, busy: () => false, auto: null };
  s.shot = (c) => s.shots.push(c);
  s.release = (b) => s.log.push(['release', b]);
  s.cinema = { bars: (on) => s.log.push(['bars', on]), hud: (on) => s.log.push(['hud', on]), say: (l) => s.log.push(['say', l?.text ?? null]), skip: (k, on, label) => s.log.push(['skip', on, label]) };
  return s;
};

game.reset();
const scene = new THREE.Scene();
const level = createGarage(scene);
const physics = new Physics(scene, null);
const G = level.garage;
const player = { pos: G.aSpawn.clone(), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, swells: [], swell(k) { this.swells.push(k); return 8; } };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
const ship = fakeShip();
const npcs = CONTENT.garage.npcs.map((s) => new NPC(scene, physics, { route: [V(s.at[0], physics.groundAt(s.at[0], 50, s.at[1]), s.at[1])], palette: s.palette, lines: s.lines }));
const rt = createStory({ levelId: 'garage', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null, ship });
const { quests } = rt;
const W = rt.world;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); level.update(dt, clock, {}); } };
const talk = (person, choices) => {
  quests.opening(person.id);
  const r = new DialogueRunner(person, { game, quests });
  for (const c of choices) {
    while (r.advance());
    const pick = r.choices().find((x) => x.text.startsWith(c));
    assert.ok(pick, `no choice "${c}"`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const lune = W.people.lune;
const besideLune = () => { const p = lune.pos.clone().add(V(0, 0, -3.2)); p.y = G.C_POS.y - Math.sqrt(G.RING_R ** 2 - (p.z - G.C_POS.z) ** 2); player.pos.copy(p); player.heading = 0; };
const lit = () => W.film.dots.children.filter((d) => d.visible).length;

test('the Hangar’s moment is the one registered for it', () => {
  assert.deepEqual(MOMENTS.map(({ id, flag }) => ({ id, flag })), WORLD_MOMENTS.garage.map(({ id, flag }) => ({ id, flag })));
  const len = SIGNAL.A + SIGNAL.B + SIGNAL.C + SIGNAL.D;
  assert.ok(len >= 5 && len <= 12, `5–12 s (${len})`);
});

test('the signal read at the slit is filmed once, as Lune’s talk closes: the ring, the slit, the nine dots, his face', () => {
  // the round done as far as the ring: the stamped signal in hand, standing by Lune
  talk(PEOPLE.ambroise, ['What does the signal say', 'Can I carry it', 'Through the portal']);
  game.set('garage.signal.stamped', true);
  step(2);
  besideLune();
  step(2);
  assert.equal(quests.stage('garage.signal'), 'ring');
  assert.ok(!rt.moments.playing && lit() === 0, 'nothing before the talk');
  const n0 = ship.shots.length;
  talk(PEOPLE.lune, ['The desk']);
  assert.equal(game.flag('garage.signal.read'), true);
  step(1);
  assert.ok(rt.moments.playing, 'the moment plays as the talk closes');
  assert.equal(game.flag('garage.moment.signal'), true, 'once per save');
  assert.ok(rt.busy(), 'the traveller is held while it plays');
  assert.equal(quests.stage('garage.signal'), 'note', 'the story went on with the talk, film or no film');
  const P = player.pos.clone(), M = W.film.dots.position.clone();
  assert.ok(M.distanceTo(P.clone().lerp(lune.pos, 0.5)) < 1.5, 'the dots lie between them');
  step(Math.round(SIGNAL.DOTS * 30) - 3);
  assert.equal(lit(), 0, 'the dots wait for their panel');
  assert.deepEqual(sound.swells, ['motif'], 'the world’s motif swells');
  step(Math.round(9 * SIGNAL.DOT_STEP * 30) + 3);
  assert.equal(lit(), 9, 'nine dots of light on the floor');
  step(Math.round((SIGNAL.A + SIGNAL.B + SIGNAL.C + SIGNAL.D - SIGNAL.DOTS - 9 * SIGNAL.DOT_STEP) * 30) + 20);
  assert.ok(!rt.moments.playing, 'then back to you');
  assert.ok(!rt.busy());
  assert.equal(lit(), 9, 'with the dots still there: the climax goes on as he walks again');
  assert.ok(!ship.log.some(([k, v]) => k === 'say' && v), 'no line: it shows, it doesn’t tell');
  // the panels: the pair in the ring (A), up the curve to the slit (B), the dots (C), his face (D)
  const shots = ship.shots.slice(n0), at = (s) => shots[Math.round(s * 30)];
  const a = at(1);
  assert.ok(a.pos.distanceTo(M) < 20 && a.look.y > M.y + 4, 'A: low and wide, looking up from the floor');
  const b = at(SIGNAL.A + 1);
  assert.ok(b.look.y - b.pos.y > 100 && b.pos.distanceTo(lune.pos) < 3, 'B: from by Lune, up to the slit');
  const c = at(SIGNAL.A + SIGNAL.B + 1);
  assert.ok(c.look.distanceTo(M) < 0.5 && c.pos.distanceTo(M) < 4.5 && c.pos.y > M.y + 2, 'C: from above, on the dots');
  const d = at(SIGNAL.A + SIGNAL.B + SIGNAL.C + 1);
  assert.ok(d.look.distanceTo(player.pos) < 2.2 && d.pos.distanceTo(player.pos) < 3.5, 'D: close on his face');
  for (const s of shots) assert.ok(Math.hypot(s.pos.y - G.C_POS.y, s.pos.z - G.C_POS.z) < G.RING_R - 0.3, 'every camera inside the ring');
  // the dots go once he walks off
  player.pos.addScaledVector(V(1, 0, 0), SIGNAL.AWAY + 5);
  step(2);
  assert.equal(lit(), 0);
  // never twice
  assert.equal(W.film.signal(), false);
});

test('skipped, it lands the same: all nine dots on the floor, back to you', () => {
  game.set('garage.moment.signal', undefined);
  besideLune();
  assert.equal(W.film.signal(), true);
  step(Math.round(0.7 * 30));
  assert.equal(lit(), 0);
  assert.equal(rt.moments.skip(), true);
  step(1);
  assert.ok(!rt.moments.playing && !rt.busy());
  assert.equal(lit(), 9, 'the dots, all of them');
  assert.ok(ship.log.some(([k, v]) => k === 'release' && v === 0.5), 'a quick blend back');
});

test('show, don’t tell: no lines for him, a slight smirk at most', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/levels/dismissed/hangar/moments.js', import.meta.url), 'utf8');
  assert.ok(!/spoken\(\s*'you'|line\s*:/.test(src), 'nothing said in his voice');
  const looks = [...src.matchAll(/\.look\s*=\s*([^;\n]+)/g)].map((m) => m[1]);
  assert.ok(looks.length >= 1);
  for (const l of looks) assert.ok(!/'(surprised|happy|shout|scared|playful)'/.test(l), `no big face: ${l}`);
});

test('without the film (once seen, or no ship’s camera) the Hangar goes on as ever', () => {
  // seen: the flag holds it back, nothing comes up
  W.film.update(1, clock);
  player.pos.x += 60; step(2);
  besideLune();
  assert.equal(W.film.signal(), false);
  step(2);
  assert.ok(!rt.moments.playing && lit() === 0);
  // (no ship at all: tests/story-garage.test.js plays the whole quest without one)
});
