import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setHintLevel } from '../src/hint-level.js';

// (these check the game's words as hints full says them, every tip and step; subtle, the default, is checked in tests/hint-level.test.js)
setHintLevel('full');

// a little DOM for the people's speech balloons (the story never needs a real page)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createSpheres } = await import('../src/levels/spheres.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE, SOUNDS, orbDegree } = await import('../src/story/spheres-data.js');
const { SPHERES_SONG } = await import('../src/audio.js');
const { clearInteractables, bestInteractable } = await import('../src/interact.js');
const { allTargets, clearTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

game.reset();
clearInteractables(); clearTargets();
const scene = new THREE.Scene();
const level = createSpheres(scene);
const physics = new Physics(scene, level.ground);
const G = level.spheres;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const player = { pos: level.spawn.clone(), vel: V(), heading: 0, riding: false, onGround: true, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const at = (p) => { player.pos.copy(p); player.vel.set(0, 0, 0); return player; };
// a sound stand-in that keeps its bands, so the test can hear what plays
let bands = [];
const played = [];
const sound = { setBands(b) { bands = b; }, setBandMode(id, m) { const b = bands.find((x) => x.id === id); if (b) b.mode = m; }, band: (id) => bands.find((x) => x.id === id) ?? null, chime() {}, listen() {}, whoosh() {},
  orbNote: (deg, at, o) => played.push({ what: 'note', deg, at, ...o }), remembered: (kind, at) => played.push({ what: kind, at }), spheresSong: (at, o) => { played.push({ what: 'song', at, ...o }); return 0; } };
const toasts = [];
const camera = new THREE.PerspectiveCamera();
let storyDone = false;
const npcs = spawnNPCs(scene, physics, CONTENT.spheres.npcs);
const rt = createStory({ levelId: 'spheres', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete: () => { storyDone = true; } },
  capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
const { quests } = rt;
let clock = 0;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { clock += dt; camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, clock, { camera }); } };
const talk = (person, choices) => {
  quests.opening(person.id);   // (as Dialogue.start does: the world's opening quest starts with its first talk)
  const r = new DialogueRunner(person, { game, quests });
  while (r.advance());
  for (const c of choices) {
    const pick = r.choices().find((x) => (typeof c === 'number' ? x.index === c : x.text.startsWith(c)));
    assert.ok(pick, `${person.name}: no choice "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    while (!r.ended && r.advance());
  }
  return r;
};
const stand = (p, label, tol = 1.2) => {
  const g = physics.groundAt(p.x, p.y + 3, p.z, 8);
  assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < tol, `${label} has solid ground (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
};
// a dry place to stand beside a sphere, on the side facing the start
const beside = (s) => { const d = V(-s.o.x, 0, -s.o.z).normalize(); const x = s.o.x + d.x * (s.o.R + 5), z = s.o.z + d.z * (s.o.R + 5); return V(x, physics.groundAt(x, 60, z, 120), z); };

test('the listeners stand on walkable, dry ground; there is somewhere to stand beside each sphere', () => {
  const W = rt.world.people;
  for (const id of ['aube', 'nell', 'ivo', 'cael', 'ume']) assert.ok(W[id], `${id} is in the garden`);
  for (const [id, n] of Object.entries(W)) for (const [k, p] of n.route.entries()) {
    stand(p, `${id}'s route point ${k}`);
    assert.equal(level.unsafe(p), false, `${id} keeps out of the lake`);
  }
  for (const s of rt.world.listeners) {
    const p = beside(s);
    stand(p, `beside the ${s.id} sphere`, 0.2);
    assert.equal(level.unsafe(p), false);
    assert.ok(physics.groundNormal(p.x, p.y + 1, p.z).y > 0.85, 'level ground to stand still on');
  }
  stand(rt.world.shore.clone(), 'the shore where the pebble lands', 0.6);
  assert.equal(level.unsafe(rt.world.shore), false);
});

test('every great sphere is a note: splashed, it rings, bigger ones lower', () => {
  const orbs = allTargets().filter((t) => t.kind === 'orb');
  assert.ok(orbs.length >= 8, `${orbs.length} spheres you can play`);
  const plain = orbs.filter((t) => !rt.world.listeners.some((s) => s.o === t.orb));
  played.length = 0;
  for (const t of plain) t.onHit('shoot', t.position().clone());
  assert.equal(played.length, plain.length);
  assert.ok(played.every((p) => p.what === 'note'));
  const byR = plain.map((t, i) => [t.orb.R, played[i].deg]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < byR.length; i++) assert.ok(byR[i][1] <= byR[i - 1][1], 'a bigger sphere never sings higher');
  assert.ok(new Set(byR.map((x) => x[1])).size >= 4, 'several different notes');
  assert.equal(orbDegree(12), 9); assert.equal(orbDegree(46), 0);
  for (const s of rt.world.listeners) assert.equal(game.flag(`spheres.heard.${s.id}`), undefined, 'nothing remembered yet');
});

test('the main quest: three spheres remembered by splashing them, the pole sings them back as a tune', async () => {
  const Q = 'spheres.listen';
  // it doesn't just appear: it waits for its first talk, and till then the scout finds who to ask
  assert.equal(quests.stage(Q), undefined);
  assert.equal(quests.openerObjective()?.id, `opener-${Q}`);
  talk(PEOPLE.aube, ['How do you hear it?', 'And then?']);
  step(2);
  assert.equal(quests.stage(Q), 'listen');
  // standing and looking does nothing now: it wants the fluid
  const [first] = rt.world.listeners;
  at(beside(first));
  step(30 * 6);
  assert.ok(!game.flag(`spheres.heard.${first.id}`), 'looking alone hears nothing');
  assert.ok(toasts.some((t) => t.includes('splash')), 'a hint to splash it');
  for (const s of rt.world.listeners) {
    at(beside(s));
    const t = allTargets().find((x) => x.kind === 'orb' && x.orb === s.o);
    played.length = 0;
    t.onHit('shoot', t.position().clone());
    step(2);
    assert.equal(game.flag(`spheres.heard.${s.id}`), true, `the ${s.id} sphere remembered`);
    assert.deepEqual(played.map((p) => p.what), [SOUNDS[s.id].part], 'and plays its own sound');
    assert.ok(sound.band(`sphere.${s.id}`).vol > 0.9, 'then keeps playing it');
    assert.ok(toasts.some((x) => x.includes(SOUNDS[s.id].text)), 'and says what it remembers');
  }
  assert.equal(game.flag('clue.spheres.desert'), true, 'one remembers the desert’s drum');
  step(2);
  assert.equal(quests.stage(Q), 'plaza');
  at(V(G.plaza.x, G.plaza.inner, G.plaza.z + G.plaza.r - 4)); step(2);
  assert.equal(quests.stage(Q), 'pole');
  at(rt.world.pole.clone().add(V(0, G.plaza.inner, 3)));
  step(30 * 6);
  assert.equal(game.flag('spheres.chord.heard'), undefined, 'standing still by it is not enough');
  played.length = 0;
  allTargets().find((x) => x.kind === 'pole').onHit('shoot');
  assert.equal(game.flag('spheres.chord.heard'), true);
  assert.equal(played.filter((p) => p.what === 'song').length, 1, 'the pole plays them back as a tune');
  assert.ok(SPHERES_SONG.length >= 8 && SPHERES_SONG.every(([d, n]) => (d === null || Number.isInteger(d)) && n > 0));
  assert.deepEqual(sound.band('pole').parts.slice(0, 3), ['bell', 'chant', 'drum'], 'the pole plays all three');
  step(2);
  assert.equal(quests.stage(Q), 'ume');
  talk(PEOPLE.ume, ['Where is that?']);
  assert.equal(quests.isDone(Q), true);
  assert.equal(game.flag('world.spheres.done'), true);
  const k = game.keepsakes().find((x) => x.id === 'spheres.song');
  assert.ok(k && k.kind === 'song', 'the keepsake: the chord');
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(storyDone);
});

test('side quests: the lake’s reflection carried to the pole; the avenue walked slowly', () => {
  talk(PEOPLE.nell, ['Except what?', 'I’ll try']);
  assert.equal(quests.stage('spheres.pebble'), 'glint');
  const glint = allTargets().find((t) => t.kind === 'glint');
  glint.onHit('push');
  assert.equal(game.flag('spheres.pebble.out'), undefined, 'a shove only makes waves');
  glint.onHit('shoot');
  step(60);
  assert.equal(quests.stage('spheres.pebble'), 'pick');
  at(rt.world.shore);
  assert.equal(bestInteractable(player)?.entry.id, 'pebble');
  bestInteractable(player).entry.use(player);
  step(2);
  assert.equal(quests.stage('spheres.pebble'), 'carry');
  at(rt.world.pole.clone().add(V(0, G.plaza.inner, 2.5)));
  assert.equal(bestInteractable(player)?.entry.id, 'placePebble');
  bestInteractable(player).entry.use(player);   // (the panel isn't open in tests; set the flag the way its page does)
  talk({ id: 'pebble', talk: { nodes: { look: { say: [''], do: { set: { 'spheres.pebble.placed': true } } } } } }, []);
  step(2);
  assert.equal(quests.isDone('spheres.pebble'), true);
  assert.ok(sound.band('pole').parts.includes('ney'), 'the lake’s breath joins the chord');
  // the avenue: running breaks the walk; a slow walk from the arch to the plaza opens every bell
  talk(PEOPLE.cael, ['What happens if you walk it slowly?', 'I’ll walk it']);
  const { z0, z1 } = G.avenue;
  const walk = (speed, from, to) => { for (let z = from; z > to; z -= speed / 30) { player.pos.set(0, level.ground.heightAt(0, z), z); player.vel.set(0, 0, -speed); step(1); } };
  walk(3.6, z0 + 2, z0 - 40);
  walk(7, z0 - 40, z0 - 80);
  assert.equal(rt.world.state.walk, null, 'running shut the bells');
  assert.equal(game.flag('spheres.avenue.walked'), undefined);
  walk(3.6, z0 + 2, z1 - 4);
  assert.equal(game.flag('spheres.avenue.walked'), true);
  assert.ok(rt.world.bells.every((b) => b.open), 'every bell along the avenue is open');
  talk(PEOPLE.cael, ['It was long']);
  assert.equal(quests.isDone('spheres.avenue'), true);
  clearInteractables(); clearTargets();
});

test('out of order: all three spheres heard before meeting Linnet; her talk still sends you on', async () => {
  const { GameState } = await import('../src/game-state.js');
  const { Quests } = await import('../src/story/quests.js');
  const { QUESTS } = await import('../src/story/spheres-data.js');
  const m = new Map();
  const g = new GameState({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
  const q = new Quests({ game: g });
  for (const d of QUESTS) q.define(d);
  for (const f of ['spheres.heard.bell', 'spheres.heard.chant', 'spheres.heard.drum', 'spheres.heard.three']) g.set(f, true);
  q.start('spheres.listen');
  const r = new DialogueRunner(PEOPLE.aube, { game: g, quests: q });
  assert.equal(r.nodeId, 'three');
  while (!r.ended && r.advance());
  for (let i = 0; i < 4; i++) q.update(null);
  assert.ok(q.reached('spheres.listen', 'plaza'), `on to the plaza (${q.stage('spheres.listen')})`);
});
