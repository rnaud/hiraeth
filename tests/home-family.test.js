// Home's people: Lou's lines by how much you have brought, the dog who follows
// you, paying your respects at the stone (the flower, the tokens since the
// ending), and the ending with Lou at the stone (src/story/home.js, home-data.js,
// src/dog.js, src/ship/homecoming.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameState, game } from '../src/game-state.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { PEOPLE, keepsakeBand, DRAWING_LINES, LOU_AT_STONE } from '../src/story/home-data.js';
import { Dog } from '../src/dog.js';
import { BODY_MORPHS, FACE_MORPHS, cleanMorph, boneMorph } from '../src/morph.js';
import { voiceOf } from '../src/story/voice.js';
import { setupHome, Moment, kneelPose, LOU_MORPH } from '../src/story/home.js';
import { createHome, laidTokens, unlaidTokens } from '../src/levels/home.js';
import { Physics } from '../src/physics.js';
import { Player, buildCharacter } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { HomecomingDirector } from '../src/ship/homecoming.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { tombLines, tokenList, FINAL_RECORDING } from '../src/story/ending.js';
import { clearInteractables } from '../src/interact.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const memory = () => { const store = new Map(); return new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const keepsakes = (g, n) => { for (let i = 0; i < n; i++) g.addKeepsake({ id: `k${i}`, level: ORDER[i % ORDER.length], name: `K${i}`, kind: ['thing', 'song', 'word', 'person', 'knowing'][i % 5], text: '“K.”' }); };

/** Lou's pages at a node, reached the way the talk goes: hello, then "I brought a lot". */
function brought(n, { met = false, flags = {} } = {}) {
  const g = memory();
  keepsakes(g, n);
  for (const [k, v] of Object.entries(flags)) g.set(k, v);
  if (met) g.set('home.lou.met', true);
  const r = new DialogueRunner(PEOPLE.lou, { game: g, quests: null, npc: { greetedThisVisit: false } });
  while (!r.lastPage) r.advance();
  r.choose(0);
  return { r, g };
}

test('Lou runs to meet you, asks what you brought, and what she says follows how much you have brought', () => {
  assert.deepEqual([0, 5, 6, 10, 11, 16, 17, 22].map(keepsakeBand), [0, 0, 1, 1, 2, 2, 3, 3]);
  const first = new DialogueRunner(PEOPLE.lou, { game: memory(), quests: null, npc: {} });
  assert.equal(first.nodeId, 'hello', 'the first time: hello');
  assert.ok(first.pages.some((p) => /What did you bring/.test(p)));
  const pages = [3, 8, 13, 20].map((n) => brought(n).r.pages.join(' '));
  assert.equal(new Set(pages).size, 4, 'a different answer for each band');
  assert.match(pages[0], /bag would be bigger/);
  assert.match(pages[1], /copies from your cards/);
  assert.match(pages[3], /brought everything/);
  // coming back: "You're back again!", once a visit; after that, her everyday lines
  const g = memory(); g.set('home.lou.met', true);
  assert.equal(new DialogueRunner(PEOPLE.lou, { game: g, quests: null, npc: { greetedThisVisit: false } }).nodeId, 'back');
  assert.equal(new DialogueRunner(PEOPLE.lou, { game: g, quests: null, npc: { greetedThisVisit: true } }).nodeId, 'again');
  g.set('home.flower.held', 'poppy');
  assert.equal(new DialogueRunner(PEOPLE.lou, { game: g, quests: null, npc: { greetedThisVisit: true } }).nodeId, 'flower', 'she sees the flower in your hand');
  // her drawings: the newest world you wrote to her from
  const { r } = brought(9, { flags: { 'world.bazaar.done': true } });
  while (!r.lastPage) r.advance();
  r.choose(0);   // "Show me your drawings."
  assert.equal(r.nodeId, 'drawings');
  assert.ok(r.pages.includes(DRAWING_LINES.bazaar.replace(/^~\w+~ /, '')), 'the tower that listens');
  // every world has its drawing, the furthest along the route: the spheres, over Viridel's garden
  const { r: r2 } = brought(9, { flags: { 'world.spheres.done': true, 'world.edena.done': true } });
  while (!r2.lastPage) r2.advance();
  r2.choose(0);
  assert.ok(r2.pages.includes(DRAWING_LINES.spheres.replace(/^~\w+~ /, '')), 'the round spheres');
  assert.ok(!r2.pages.includes(DRAWING_LINES.edena.replace(/^~\w+~ /, '')), 'one drawing only');
  for (const node of Object.values(PEOPLE.lou.talk.nodes)) assert.ok((node.choices ?? []).length <= 3, 'three choices at most');
  // a child, unmistakably: a big head on short limbs, a short torso, a round young face, a girl's voice on the slighter body
  const L = PEOPLE.lou;
  assert.ok(LOU_MORPH.headSize >= 1.25 && LOU_MORPH.legLength <= 0.8 && LOU_MORPH.armLength <= 0.8 && LOU_MORPH.torsoLength < 0.9 && L.scale <= 0.85, 'a child’s proportions');
  for (const [list, m] of [[BODY_MORPHS, LOU_MORPH], [FACE_MORPHS, L.face]]) {
    const c = cleanMorph(m, list);
    for (const [k, v] of Object.entries(m)) assert.equal(c[k], v, `${k} ${v} is within its range (not clamped)`);
  }
  assert.equal(L.face.lines, 0, 'no age lines');
  assert.ok(L.face.eyeSize > 1.3 && L.face.noseLength <= 0.6 && L.face.faceLength < 0.9, 'big eyes, a small nose, a short lower face');
  assert.ok(['twin', 'bob', 'curls'].includes(L.head), 'a child’s hairstyle');
  assert.equal(L.kind, 'f'); assert.equal(L.body, 'm');
  assert.equal(voiceOf(L).age, 'child', 'a child’s voice');
  assert.ok(L.gait.stride < 0.8 && L.gait.pace < 0.8 && L.gait.fidget > 0, 'short quick steps, never still');
  const bm = boneMorph(LOU_MORPH);
  assert.ok(bm.position.spine_02 < 1 && bm.position.spine_03 < 1 && bm.lift < 0, 'the torso shortened, the legs too');
});

test('Moustache follows you, keeps a little off, catches up when you run, and barks at the drone', () => {
  let barks = 0;
  const dog = new Dog(null, { at: V(0, 0, 0), onBark: () => barks++ });
  const leader = { pos: V(0, 0, 0), heading: 0, vel: V(0, 0, 4) };
  for (let t = 0; t < 12; t += 1 / 30) { leader.pos.z += 4 / 30; dog.update(1 / 30, { leader }); }
  const d = Math.hypot(dog.pos.x - leader.pos.x, dog.pos.z - leader.pos.z);
  assert.ok(d < 4.5, `at your heels after a 48 m walk (${d.toFixed(1)} m)`);
  leader.vel.set(0, 0, 8);
  for (let t = 0; t < 5; t += 1 / 30) { leader.pos.z += 8 / 30; dog.update(1 / 30, { leader }); }
  assert.ok(Math.hypot(dog.pos.x - leader.pos.x, dog.pos.z - leader.pos.z) < 7, 'he keeps up when you run');
  leader.vel.set(0, 0, 0);
  for (let t = 0; t < 12; t += 1 / 30) dog.update(1 / 30, { leader });
  const rest = Math.hypot(dog.pos.x - leader.pos.x, dog.pos.z - leader.pos.z);
  assert.ok(rest > 0.6 && rest < 4.5, `never under your feet (${rest.toFixed(2)} m)`);
  assert.ok(['sit', 'sniff'].includes(dog.state), `you stand still: he noses about or sits (${dog.state})`);
  // the drone comes by
  const drone = leader.pos.clone().add(V(3, 2.5, 4));
  for (let t = 0; t < 2; t += 1 / 30) dog.update(1 / 30, { leader, targets: [drone] });
  assert.equal(dog.state, 'bark');
  assert.ok(barks >= 2, `he barks (${barks})`);
  dog.pet();
  assert.equal(dog.state, 'petted');
  for (let t = 0; t < 5; t += 1 / 30) dog.update(1 / 30, { leader });
  assert.notEqual(dog.state, 'petted', 'then goes back to his business');
});

test('a quiet moment: set in place, kneeling, its lines, then back to you', () => {
  const char = buildCharacter();
  const said = [], shots = [];
  const player = { pos: V(1, 0, 1), heading: 0, vel: V(), char, overlay: null };
  const tags = [];
  const ship = { cinema: { say: (l) => said.push(l), bars() {}, hud() {}, skip: (k, on, label) => tags.push([on, label]) }, shot: (s) => shots.push(s), release() {} };
  let ended = false;
  const m = new Moment({ player, ship, at: V(3, 0, 3), heading: 1.2, pose: 'kneel', dur: 6, beats: [{ t: 1, line: { who: 'scene', text: 'a' } }, { t: 3, line: { who: 'you', text: 'b' } }],
    shot: () => ({ pos: V(0, 1, 0), look: V(3, 0.5, 3) }), onEnd: () => { ended = true; } });
  m.start();
  for (let t = 0; t < 3; t += 1 / 30) { m.update(1 / 30); player.overlay?.(player, 1 / 30); }
  assert.ok(player.pos.distanceTo(V(3, 0, 3)) < 0.01 && Math.abs(player.heading - 1.2) < 0.01, 'in place, facing the stone');
  assert.ok(char.body.position.y < -0.3, 'kneeling');
  for (let t = 0; t < 4; t += 1 / 30) { m.update(1 / 30); player.overlay?.(player, 1 / 30); }
  assert.ok(m.done && ended && player.overlay === null, 'over, and the player is theirs again');
  assert.equal(char.body.position.y, 0, 'standing');
  assert.deepEqual(said.filter(Boolean).map((l) => l.text), ['a', 'b']);
  assert.ok(shots.length > 30, 'the camera framed it throughout');
  assert.ok(tags[0][0] && /skip/.test(tags[0][1]) && tags.at(-1)[0] === false, 'its skip tag shows while it plays (the cinematics QC pass)');
  kneelPose(char, 0);   // (a zero weight changes nothing)
});

/** Home with its story, on the real level, the real collision and a stand-in for the ship and the people. */
function homeWorld() {
  clearInteractables();
  const scene = new THREE.Scene();
  const level = quiet(() => createHome(scene));
  const physics = new Physics(scene, level.ground);
  const player = new Player(physics, { spawn: level.spawn });
  const said = [];
  const ship = { cinema: { say: (l) => said.push(l), bars() {}, hud() {} }, shot() {}, release() {}, playing: false, busy: () => false, inside: false };
  const people = [];
  const spawn = (def, { route, seat = null }) => { const n = { def, pos: route[0].clone(), heading: 0, follow: null, seat, object: { scale: { x: 1 }, visible: true }, humanoid: null }; people.push(n); return n; };
  const world = setupHome({ level, physics, player, dialogue: { open: false, start: () => true }, game, sound: {}, spawn, scene, toast: () => {}, ship });
  return { level, physics, player, world, said, people };
}

test('paying your respects: kneel, lay the flower you picked; it stays on the stone', () => {
  game.reset();
  const { level, player, world, said } = homeWorld();
  const G = level.home.garden;
  player.pos.copy(G.spots.border);
  const f = world.pickFlower(G.spots.border);
  assert.ok(f && game.flag('home.flower.held') === f.kind, 'a flower in hand');
  player.pos.copy(level.tomb.stand).add(V(1, 0, -1));
  world.homage();
  assert.ok(world.busy(), 'a scene: your input waits');
  for (let t = 0; t < 25 && world.busy(); t += 1 / 30) world.update(1 / 30, t);
  assert.ok(!world.busy(), 'it ends by itself');
  assert.equal(level.tomb.flowers.children.length, 1, 'the flower is on the stone');
  assert.deepEqual(game.flag('home.flowers'), [f.kind], 'and kept');
  assert.ok(!game.flag('home.flower.held'), 'your hand is empty again');
  assert.ok(said.some((l) => l?.who === 'you'), 'you say something to them');
  const again = quiet(() => createHome(new THREE.Scene()));
  assert.equal(again.tomb.flowers.children.length, 1, 'next visit, still there');
});

test('after the ending, what you found since goes on the slab too, the way the ending set everything down', () => {
  game.reset();
  keepsakes(game, 3);
  game.set('ending.done', true);
  game.set('home.stone', ['k0', 'k1']);
  const { level, world } = homeWorld();
  assert.deepEqual(unlaidTokens(game).map((t) => t.id), ['k2']);
  assert.equal(level.tomb.tokens.children.length, 2, 'two tokens (the first homecoming: he kept the reel)');
  world.homage();
  for (let t = 0; t < 30 && world.busy(); t += 1 / 30) world.update(1 / 30, t);
  assert.deepEqual(laidTokens(game).map((t) => t.id), ['k0', 'k1', 'k2']);
  assert.equal(level.tomb.tokens.children.length, 3, 'three tokens');
  assert.deepEqual(unlaidTokens(game), []);
  // after the true ending: the reel on the slab, and the message Ilen set down
  game.set('ending.final', true);
  game.set('finale.met', true);
  clearInteractables();
  const after = homeWorld();
  assert.equal(after.level.tomb.tokens.children.length, 5, 'three tokens, Ilen’s message and the reel');
  assert.ok(after.world.people.ilen, 'Ilen lives at home now');
});

test('the ending with Lou: she comes to the stone, leaves her drawing, asks about the recording; it still completes', () => {
  const list = tokenList([{ id: 'a', name: 'A', kind: 'song' }], []);
  const lines = tombLines(list, { lou: true });
  const light = lines.findIndex((l) => l.light);
  assert.ok(lines.findIndex((l) => l.drawing) < light && lines.findIndex((l) => l.drawing) > 0, 'her drawing before the light comes over');
  assert.ok(!lines.some((l) => l.reel), 'the first homecoming: he keeps the reel');
  assert.ok(lines.some((l) => l.who === 'lou' && /Promise on the stone/.test(l.text)), 'she makes him promise');
  const last = tombLines(list, { lou: true, final: true, drawn: true });
  const reel = last.findIndex((l) => l.reel);
  assert.deepEqual(last.slice(reel + 1, reel + 1 + FINAL_RECORDING.length), FINAL_RECORDING, 'the true ending: the oldest recording, whole');
  assert.ok(last.some((l) => l.who === 'lou' && l.text === LOU_AT_STONE.after.replace(/^~\w+~ /, '')));
  assert.ok(!last.some((l) => l.drawing), 'her drawing is there already');
  assert.match(last.at(-1).text, /Something of value/);
  assert.ok(!tombLines(list).some((l) => l.who === 'lou'), 'without her, as before');

  game.reset();
  game.addKeepsake({ id: 'a', level: 'desert', name: 'A', kind: 'song' });
  clearInteractables();
  const meta = LEVELS.find((l) => l.id === 'home');
  const scene = new THREE.Scene();
  const level = quiet(() => meta.create(scene));
  const physics = new Physics(scene, level.ground);
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'home', content: CONTENT.home, prologue: true }));
  const player = new Player(physics, { spawn: level.spawn });
  const rig = { yaw: 0, pitch: 0, target: new THREE.Vector3(), dist: 6 };
  ship.attach({ player, rig, camera: new THREE.PerspectiveCamera(), sound: {}, levels: LEVELS, order: ORDER, titles: {}, npcs: [] });
  const lou = { pos: V(8, 0, 21), follow: null, heading: 0 };
  level.family = { lou, dog: null };
  const dir = new HomecomingDirector(ship);
  ship.cinematic = dir;
  dir.start();
  const step = (secs, skip = false) => { for (let t = 0; t < secs && !dir.done; t += 1 / 30) { dir.update(1 / 30, skip); player.update(1 / 30, ship.input({}), rig.yaw); const f = lou.follow?.(); if (f?.pos) lou.pos.lerp(f.pos, Math.min(1, (f.speed ?? 1.5) / 30 / Math.max(0.01, lou.pos.distanceTo(f.pos)))); } };
  step(8); dir.choose(); step(50);
  while (dir.stage === 'walk' && !dir.done) step(1);
  assert.equal(dir.stage, 'tomb');
  step(3);
  assert.ok(lou.pos.distanceTo(dir.louSpot()) < 1.5, 'Lou beside you at the stone');
  step(40);
  assert.ok(level.tomb.extras.children.length === 1, 'her drawing against the stone');
  step(1.2, true); step(0.2); step(1.2, true); step(0.2); step(1.2, true);
  assert.ok(dir.done && game.flag('ending.done'), 'the ending completes');
  assert.equal(lou.follow, null, 'and she is free again');
  assert.equal(game.flag('home.lou.drawing'), true);
});
