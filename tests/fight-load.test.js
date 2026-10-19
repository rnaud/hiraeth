// A fight temple's load (issue #505): the warm before the first frame builds and compiles the run's own kinds of foe
// (src/fight-temples/rules.js fightKinds, rooms.js level.foes.warm, main.js foes.warmModels), not every kind in the
// game as the Arena's id it answers to had asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readdirSync } from 'node:fs';
import { FOES } from '../src/foes.js';
import { fightKinds } from '../src/fight-temples/rules.js';
import { buildHall } from '../src/fight-temples/rooms.js';
import { drawRun } from '../src/fight-temples/generate.js';
import { runSteps } from '../src/load-steps.js';

const dir = new URL('../src/minigames/', import.meta.url);
const temples = await Promise.all(readdirSync(dir).filter((f) => /^fight-.*\.js$/.test(f)).map(async (f) => (await import(new URL(f, dir))).default));

test('every fight temple: the warm names the run\'s kinds, each a foe, every kind its waves bring, far fewer than all', () => {
  assert.ok(temples.length >= 12, `${temples.length} fight temples`);
  for (const g of temples) for (const seed of [1, 7, 42]) {
    const run = drawRun(g.table, seed), kinds = fightKinds(run);
    const brought = new Set(run.rooms.flatMap((r) => (r.waves ?? []).flat().map(([k]) => k)));
    assert.deepEqual(new Set(kinds), brought, `${g.id} seed ${seed}`);
    for (const k of kinds) assert.ok(FOES[k.split(':')[0]], `${g.id}: ${k} is a foe`);
    assert.ok(kinds.length < Object.keys(FOES).length / 2, `${g.id}: ${kinds.length} kinds warmed`);
    const level = runSteps(buildHall(new THREE.Scene(), run));
    assert.deepEqual(level.foes.warm, kinds, `${g.id}: the hall's level hands them to the warm`);
  }
});

test('main.js warms the level\'s kinds when it names them', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('foes.warmModels(level.foes?.warm)'));
});
