// The hosts of the games in the worlds (issue #248): every game, trial and makers' run placed in a world starts from a
// person (or a thing of that place) who says what it is in a line or two and offers it, Play or Not now.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { HOSTS, hostOf, hostTalk, hostStand, queueHost, takeHosts } from '../src/minigames/kit/hosts.js';
import { placeGameMarker } from '../src/minigames/kit/marker-core.js';
import { loadMinigameModules } from './minigame-modules.js';
import { collectGames } from '../src/minigames/kit/registry.js';
import { TRIALS } from '../src/trials/data.js';
import { KIT_TRIALS } from '../src/trials/kit-data.js';
import { parseLine } from '../src/story/tone.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { clearInteractables, allInteractables } from '../src/interact.js';
import { GameState } from '../src/game-state.js';

const { EVERYONE } = await import('../src/story/people-book.js');
const { CONTENT } = await import('../src/levels/content.js');

// every game file there is (as tests/arcade.test.js finds them: node has no glob)
const GAMES = collectGames(Object.fromEntries(Object.entries(await loadMinigameModules()).map(([f,m])=>[`./${f}`,m])), (m) => { throw new Error(m); });
/** The games whose signs stand in a world (not the developer's Arena or Arcade): the levels' own, and the games' markers. */
const IN_WORLDS = ['fishing', 'canyon', 'rings', 'wingdrop', 'gallery', ...GAMES.filter((g) => g.markers?.length).map((g) => g.id)];

test('every game, trial and makers’ run in a world has a host', () => {
  assert.ok(IN_WORLDS.length >= 9, IN_WORLDS.join(' '));
  for (const id of IN_WORLDS) assert.ok(hostOf(id), `${id}: a host`);
  for (const T of Object.values(TRIALS)) assert.ok(hostOf(T.id), `${T.id}: a host`);
  for (const T of Object.values(KIT_TRIALS)) assert.ok(hostOf(T.id), `${T.id}: a host`);
  assert.equal(hostOf('waves'), null, 'the Arena’s game keeps its sign (a developer’s world)');
});

test('a host says one or two toned lines, then offers Play or Not now', () => {
  for (const [id, H] of Object.entries(HOSTS)) {
    assert.ok(H.say.length >= 1 && H.say.length <= 2, `${id}: one or two lines`);
    for (const l of [...H.say, ...(H.lines ?? [])]) assert.ok(parseLine(l).explicit, `${id}: "${l}" has a tone`);
    for (const l of H.say) assert.ok(parseLine(l).text.length <= 120, `${id}: terse (${l.length})`);
    if (!H.object) assert.ok(H.name && H.title && H.palette && H.kind, `${id}: a person to stand there`);
  }
  let played = 0;
  const def = hostTalk(HOSTS.canyon, () => played++, { name: 'Canyon run' });
  assert.equal(def.prompt, 'ask Kamal about the canyon run');
  assert.equal(hostTalk(HOSTS.gallery, () => {}, { name: 'The shooting gallery' }).prompt, 'ask Fitz about the shooting gallery');
  assert.equal(hostTalk(HOSTS.fishing, () => {}, { name: 'Fishing' }).prompt, 'ask Yusra about fishing');
  assert.equal(hostTalk(HOSTS.ski, () => {}, { name: 'Dune skiing' }).prompt, 'ask Tarek about dune skiing');
  assert.equal(hostTalk(HOSTS['kit-desert'], () => {}, { name: 'Wind hall' }).prompt, 'read the makers’ post');
  const R = new DialogueRunner(def, { game: new GameState(), quests: { stage: () => null } });
  assert.deepEqual(R.pages, HOSTS.canyon.say.map((l) => parseLine(l).text));
  assert.deepEqual(R.node.choices.map((c) => parseLine(c.text).text), ['Play.', 'Not now.']);
  assert.equal(played, 0, 'nothing starts by itself');
  assert.equal(R.node.choices[1].do, undefined, 'not now: nothing');
  R.node.choices[0].do();
  assert.equal(played, 1, 'play: the game');
});

test('each host speaks in their own voice: no two first pages open alike, none a custom told in the third person (issue #280)', () => {
  const people = Object.entries(HOSTS).filter(([, H]) => !H.object);
  const opened = new Map();
  for (const [id, H] of people) {
    const first = parseLine(H.say[0]).text;
    const open = first.toLowerCase().split(/[^a-z’']+/).filter(Boolean).slice(0, 2).join(' ');
    assert.ok(!opened.has(open), `${id} opens like ${opened.get(open)}: "${open}…"`);
    opened.set(open, id);
    assert.ok(/\b(I|I’m|I’ve|my|me|we|our|us|you|your)\b/i.test(first), `${id}: the first page is somebody talking ("${first}")`);
    assert.ok(!/^(In|On|When|Every night|Each) /.test(first), `${id}: starts in their work, not the place’s custom`);
    for (const l of H.say) assert.ok(!/hand’s width/.test(l), `${id}: the Floating city’s hand’s width is Joss’s and Rosa’s`);
  }
  assert.ok(people.length >= 22, `${people.length} hosts`);
});

test('a host whose run wants what he hasn’t got says so and offers no Play (issue #226, quest QC rule 4)', () => {
  let want = 'It wants the hoverbike.', played = 0;
  const def = hostTalk(HOSTS['trial-desert'], () => played++, { name: 'Dune line', lacks: () => want });
  const ctx = { game: new GameState(), quests: { stage: () => null } };
  let R = new DialogueRunner(def, ctx);
  assert.equal(R.pages.length, HOSTS['trial-desert'].say.length + 1);
  assert.equal(R.pages.at(-1), 'It wants the hoverbike. Come back with it.');
  assert.equal(R.tones.at(-1), 'neutral');
  while (!R.lastPage) R.advance();
  assert.deepEqual(R.choices().map((c) => c.text), ['I’ll come back with it.']);
  want = '';
  R = new DialogueRunner(def, ctx);
  assert.deepEqual(R.pages, HOSTS['trial-desert'].say.map((l) => parseLine(l).text), 'had: the lines alone');
  while (!R.lastPage) R.advance();
  assert.deepEqual(R.choices().map((c) => c.text), ['Play.', 'Not now.']);
  assert.equal(played, 0);
});

test('one name, one person: the hosts’ names are their own', () => {
  const first = (n) => n.replace(/^(Madame|Mother|Sister|Brother|Aunt|The) /, '').split(' ')[0];
  const taken = new Set([...EVERYONE.map((p) => first(p.name)), ...Object.values(CONTENT).flatMap((c) => (c?.npcs ?? []).filter((n) => n.name).map((n) => first(n.name)))]);
  const mine = Object.values(HOSTS).filter((H) => !H.object).map((H) => first(H.name));
  assert.equal(new Set(mine).size, mine.length, 'no two hosts share a name');
  for (const n of mine) assert.ok(!taken.has(n), `${n} is nobody else`);
});

test('a hosted sign starts nothing itself: it asks for its host; the Arcade’s signs still play', () => {
  clearInteractables(); takeHosts();
  const scene = new THREE.Scene(), went = [];
  const m = placeGameMarker({ scene, levelId: 'desert', go: (h) => went.push(h) }, 'fishing', new THREE.Vector3(10, 0, 4), { heading: 0.5, games: GAMES });
  assert.ok(!allInteractables().some((e) => e.id === 'minigame.fishing'), 'no button on the sign');
  const [spot] = takeHosts();
  assert.equal(spot.id, 'fishing');
  assert.equal(spot.name, 'Fishing');
  assert.equal(went.length, 0);
  spot.play();
  assert.match(went[0], /game=fishing/);
  m.remove();
  placeGameMarker({ scene, levelId: 'arcade', go: () => {} }, 'fishing', new THREE.Vector3(0, 0, 0), { games: GAMES });
  assert.ok(allInteractables().some((e) => e.id === 'minigame.fishing'), 'the Arcade’s sign plays at once');
  assert.equal(takeHosts().length, 0);
  // a host stands beside the sign, a little toward you, whichever way it faces
  for (const h of [0, 1, -2.4]) {
    const at = new THREE.Vector3(3, 1, -2), s = hostStand(at, h);
    assert.ok(Math.abs(s.distanceTo(at) - Math.hypot(1.5, 0.5)) < 1e-9);
    assert.ok((s.x - at.x) * Math.sin(h) + (s.z - at.z) * Math.cos(h) > 0.4, 'in front of the sign');
  }
  assert.equal(queueHost({ id: 'nothing' }), false);
  clearInteractables();
});

// the games' hosts where they stand: the signs the worlds put up (the desert's, the market's) and the games' own markers
// (placed as main.js does), each host beside its sign on solid ground, out of the water
for (const id of ['desert', 'bazaar', 'arzach']) {
  test(`${id}: the games’ hosts stand on solid ground beside their signs`, async () => {
    const { LEVELS } = await import('../src/levels/index.js');
    const { Physics } = await import('../src/physics.js');
    const { Waters } = await import('../src/water.js');
    const { partsOf } = await import('../src/levels/names.js');
    const quiet = (f) => { const w = console.warn, i = console.info; console.warn = console.info = () => {}; try { return f(); } finally { console.warn = w; console.info = i; } };
    clearInteractables(); takeHosts();
    const scene = new THREE.Scene(), level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics));
    const waters = quiet(() => new Waters(scene, { physics, drops: false }));
    const spots = takeHosts();
    for (const g of GAMES) for (const m of g.markers ?? []) {
      if (!partsOf(id).includes(m.level) && m.level !== id) continue;
      const [x, y, z] = m.at, gy = y ?? physics.groundAt(x, 1e4, z);
      spots.push({ id: g.id, at: new THREE.Vector3(x, gy, z), heading: m.heading ?? 0 });
    }
    // (in node the registry's glob finds no games, so the signs a level puts up only for a registered game are not here:
    // the desert's fishing and canyon run, the market's gallery; checked in the running game)
    assert.ok(spots.length >= (id === 'desert' ? 4 : 1), spots.map((s) => s.id).join(' '));
    for (const s of spots) {
      const H = hostOf(s.id);
      assert.ok(H && !H.object, `${s.id}: a person`);
      const st = hostStand(s.at, s.heading, H.stand), g = physics.groundAt(st.x, st.y + 2.5, st.z, 6);
      assert.ok(Number.isFinite(g) && Math.abs(g - st.y) < 1.5, `${H.name} (${s.id}) stands on something (${g} vs ${st.y.toFixed(2)})`);
      assert.ok(!(waters.surfaceAt(st.x, st.z, g + 3, 10)?.y > g + 0.3), `${H.name} is not in the water`);
    }
    clearInteractables();
  });
}
