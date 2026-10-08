// The Arcade (docs/systems/minigames.md, "The Arcade"): a sign for every game of the registry, the way
// there and back (?game=<id>&from=arcade, ?level=arcade&back=<id>), the games before and after, round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import * as THREE from 'three';
import { collectGames, gameHref } from '../src/minigames/index.js';
import { arcadeSigns, arcadeLinks, arcadeHref, cycleGame, returnSpot, ARCADE, ARCADE_RING } from '../src/minigames/kit/arcade.js';
import { quitHref } from '../src/minigames/kit/flow.js';
import { allInteractables, clearInteractables } from '../src/interact.js';
import { runSteps } from '../src/load-steps.js';

// every game file there is, as the registry's glob finds them (a new game is in this test by itself)
const files = readdirSync(new URL('../src/minigames/', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'index.js');
const modules = Object.fromEntries(await Promise.all(files.map(async (f) => [`./${f}`, await import(`../src/minigames/${f}`)])));
const GAMES = collectGames(modules, (m) => { throw new Error(m); });

test('every registered game gets a sign round the plaza, apart, facing the middle', () => {
  assert.ok(GAMES.length >= 10, 'the ten games at least');
  const signs = arcadeSigns(GAMES);
  assert.deepEqual(signs.map((s) => s.id), GAMES.map((g) => g.id), 'one each, in the games\' order');
  for (const s of signs) {
    const [x, , z] = s.pos;
    assert.ok(Math.abs(Math.hypot(x, z) - ARCADE_RING.radius) < 1e-9, `${s.id} on the ring`);
    // its face (local +z turned by heading) toward the middle; the traveller in front of it facing it
    const face = [Math.sin(s.heading), Math.cos(s.heading)];
    assert.ok(face[0] * -x + face[1] * -z > 0.99 * Math.hypot(x, z), `${s.id} faces the middle`);
    const [sx, , sz] = s.stand;
    assert.ok(Math.hypot(sx - x, sz - z) < 3.2, `${s.id}: standing there is in the sign's reach`);
    const look = [Math.sin(s.standHeading), Math.cos(s.standHeading)];
    assert.ok(look[0] * (x - sx) + look[1] * (z - sz) > 0.99 * Math.hypot(x - sx, z - sz), `${s.id}: facing the sign`);
    assert.ok(z < ARCADE_RING.radius * 0.75, `${s.id}: not in the way in (the south)`);
  }
  for (let i = 1; i < signs.length; i++) {
    const [a, b] = [signs[i - 1].pos, signs[i].pos];
    assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) > 5, 'neighbours more than 5 m apart: one prompt at a time');
  }
});

test('the plaza built: a sign that plays each game, the board, back in front of the sign of the game left', () => {
  clearInteractables();
  const scene = new THREE.Scene();
  const flags = { 'minigame.ski.best': 52.31 };
  return import('../src/levels/arcade.js').then(({ buildArcade, bestText }) => {
    const level = runSteps(buildArcade(scene, { games: GAMES, state: { flag: (k) => flags[k] }, search: '?back=fishing' }));
    const ids = allInteractables().map((e) => e.id);
    for (const g of GAMES) assert.ok(ids.includes(`minigame.${g.id}`), `${g.id} has its sign`);
    assert.ok(ids.includes('arcade.board'), 'the games board');
    assert.equal(level.signs.length, GAMES.length);
    const fishing = level.signs.find((s) => s.id === 'fishing');
    assert.deepEqual(level.spawn.toArray(), fishing.stand, 'back from Fishing: in front of its sign');
    assert.equal(level.spawnHeading, fishing.standHeading);
    assert.ok(level.keepSpawn, 'not the place saved as the game was opened');
    assert.ok(level.quickMenu, 'the games board is the level\'s quick menu');
    assert.equal(bestText(GAMES.find((g) => g.id === 'ski'), { flag: (k) => flags[k] }), '52.31');
    assert.equal(bestText(GAMES.find((g) => g.id === 'rings'), { flag: (k) => flags[k] }), '');
    const fresh = runSteps(buildArcade(new THREE.Scene(), { games: GAMES, state: { flag: () => undefined }, search: '' }));
    assert.ok(!fresh.keepSpawn && fresh.spawn.z > ARCADE_RING.radius, 'no ?back: at the way in, the save may put you back');
    clearInteractables();
  });
});

test('the round trip: a sign opens the game from the Arcade, its Quit comes back to that sign', () => {
  const at = gameHref('canyon', ARCADE);
  assert.equal(at, '?game=canyon&from=arcade');
  const from = new URLSearchParams(at).get('from');
  const links = arcadeLinks(from, 'canyon', GAMES);
  assert.equal(links.quit.label, 'Back to the Arcade');
  assert.equal(links.quit.href, arcadeHref('canyon'));
  const back = new URLSearchParams(links.quit.href);
  assert.equal(back.get('level'), ARCADE);
  assert.ok(returnSpot(arcadeSigns(GAMES), back.get('back')), 'the sign to stand at');
  assert.equal(returnSpot(arcadeSigns(GAMES), 'nope'), null);
  // a game started anywhere else: no links, Quit as before
  assert.equal(arcadeLinks('desert', 'canyon', GAMES), null);
  assert.equal(arcadeLinks(null, 'canyon', GAMES), null);
  assert.equal(quitHref('desert'), '?level=desert');
});

test('next and previous go round every game and wrap', () => {
  const ids = GAMES.map((g) => g.id), n = ids.length;
  assert.equal(cycleGame(GAMES, ids[n - 1], 1).id, ids[0], 'after the last: the first');
  assert.equal(cycleGame(GAMES, ids[0], -1).id, ids[n - 1], 'before the first: the last');
  // ten presses of Next from any game visit every game once and come back
  let id = ids[3];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const next = arcadeLinks(ARCADE, id, GAMES).extra.find((l) => l.id === 'next');
    assert.equal(next.step, 1);
    id = new URLSearchParams(next.href).get('game');
    assert.equal(new URLSearchParams(next.href).get('from'), ARCADE, 'still from the Arcade');
    seen.add(id);
  }
  assert.equal(seen.size, n);
  assert.equal(id, ids[3]);
  const prev = arcadeLinks(ARCADE, ids[0], GAMES).extra.find((l) => l.id === 'prev');
  assert.equal(prev.sub, GAMES[n - 1].name);
  assert.equal(cycleGame([], 'x', 1), null);
  assert.equal(cycleGame(GAMES, 'unknown', 1).id, ids[0]);
});
