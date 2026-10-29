// Issue #557 (the author's rule from #518: "I should have all the tools available at that moment in the game to open
// them"): a makers' box held shut by its court's puzzle or a small lock is not spoken of before its tool is yours. Its
// quest is not given by the temple's local, not offered on arrival, no beacon stands over it, and nobody's line points at
// it; the tool's coming offers it. Every little chest of every world on the route, run through the boxes' own quests.
import test from 'node:test';
import assert from 'node:assert/strict';
// (src/story/ through its literal catalogue, checked against the directory: tests/test-catalogs.test.js)
import * as storySources from './catalogs/story-sources.js';
import * as THREE from 'three';
import './register-gadgets.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ORDER, partOf, partsOf, isDiscarded } from '../src/levels/names.js';
import { createBoxes, boxTool, toolHeld, BOX_QUEST_DELAY } from '../src/boxes/index.js';
import { COURTS } from '../src/finds/courts.js';
import { LOCK_ITEM } from '../src/boxes/locks.js';
import { Quests } from '../src/story/quests.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { clearInteractables } from '../src/interact.js';
import { clearTargets } from '../src/targets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The little chests on the route (not a temple's, not the story's): each with the world it stands in. */
const LITTLE = Object.entries(PLACEMENTS).filter(([part]) => !isDiscarded(part) && ORDER.includes(partOf(part)))
  .flatMap(([part, list]) => list.map((p) => ({ ...p, part, world: partOf(part) })))
  .filter((p) => !p.temple && !p.story && p.chest !== 'temple' && (p.court || p.lock));
const WORLDS = [...new Set(LITTLE.map((p) => p.world))];

test('every little chest’s tool is its court’s or its lock’s, and the box waits for it (issue #557)', () => {
  assert.ok(LITTLE.length >= 20, `the little chests (${LITTLE.length})`);
  for (const p of LITTLE) {
    const tool = p.court ? COURTS[p.court].needs : LOCK_ITEM[p.lock.tool];
    assert.equal(boxTool(p), tool, `${p.id}: its tool`);
    assert.ok(ITEMS[tool], `${p.id}: an item (${tool})`);
    assert.equal(toolHeld(p, () => false), false, `${p.id}: not held with nothing in hand`);
    assert.equal(toolHeld(p, (id) => id === tool), true, `${p.id}: held with its ${tool}`);
  }
  assert.equal(toolHeld({ id: 'x' }, () => false), true, 'a box nothing holds shut waits for nothing');
});

/** A world's boxes on flat ground (the real placements, each moved to a spot of its own), with a temple's local per part. */
function setup(world, { flags = {}, old = false } = {}) {
  game.reset(); clearInteractables(); clearTargets();
  game.set('box.desert.backpack', true);   // (box quests wait for a first box found: src/boxes/index.js boxesFound)
  for (const [k, v] of Object.entries(flags)) game.set(k, v);
  const table = {};
  let i = 0;
  for (const part of partsOf(world)) {
    table[part] = (PLACEMENTS[part] ?? []).filter((p) => LITTLE.some((q) => q.id === p.id))
      .map((p) => ({ ...p, site: null, at: [30 + 12 * i++, 40], lift: 0 }));
    if (old) game.set(`givers.old.${part}`, true);
  }
  // (a box's giver is its id's part's: the Glass Dunes' level is the old garage's, src/boxes/index.js giverFor)
  if (old) for (const p of Object.values(table).flat()) game.set(`givers.old.${p.id.split('.')[0]}`, true);
  const quests = new Quests({ game });
  for (const part of partsOf(world)) {
    quests.define({ id: `temple.${part}`, title: 'The temple', world, stages: [{ id: 'find', text: 'Find it', flag: `temple.${part}.entered` }] });
    quests.givenBy(`temple.${part}`, `local.${part}`, { rank: 0 });
  }
  const physics = { groundAt: () => 0, groundNormal: () => V(0, 1, 0), addCollider: () => null, removeCollider: () => {} };
  const level = { spawn: V(0, 0, 0), spawnHeading: 0 };
  const player = { pos: V(0, 0, 0), vel: V(), heading: 0, riding: false };
  const boxes = createBoxes({ levelId: world, scene: new THREE.Scene(), physics, level, player, quests, toast: () => {}, table });
  const run = (s) => { for (let k = 0; k < 30 * s; k++) boxes.update(1 / 30, k / 30); };
  return { quests, boxes, run, table };
}
const toolsOf = (world) => LITTLE.filter((p) => p.world === world).map((p) => ({ id: `box.${p.id}`, tool: boxTool(p), part: p.part }));
const waitingFor = (quests, id) => quests.pendingGivers().some((g) => g.quests.includes(id));

test('no box quest is given or offered while its tool is missing; the tool’s coming offers it (every world on the route, issue #557)', () => {
  for (const world of WORLDS) {
    const want = toolsOf(world);
    // the temple's local: the boxes' quests not theirs to give, nothing marked for them, no line said of them
    {
      const { quests, boxes, run } = setup(world);
      run(BOX_QUEST_DELAY + 1);
      for (const { id, tool, part } of want) {
        assert.equal(quests.isStarted(id), false, `${world}: ${id} not started without the ${tool}`);
        assert.equal(waitingFor(quests, id), false, `${world}: nobody waits to give ${id} before the ${tool}`);
        quests.opening(`local.${part}`);
        assert.ok(!quests.givenWords().length, `${world}: ${part}'s local says nothing of ${id} before the ${tool}`);
        assert.equal(quests.isStarted(id), false, `${world}: talking doesn't give ${id} without the ${tool}`);
      }
      for (const b of boxes.list) assert.equal(b.beacon.visible, false, `${world}: no beacon over ${b.id} before its tool`);
      // the tools come (the world's temple, an earlier world's): now the local gives them, a line for each
      for (const { tool } of want) items.grant(tool);
      for (const { id, part } of want) assert.ok(waitingFor(quests, id), `${world}: ${id} waits for ${part}'s local once its tool is yours`);
      for (const part of new Set(want.map((w) => w.part))) { quests.opening(`local.${part}`); quests.givenWords(); }
      for (const { id } of want) assert.equal(quests.isActive(id), true, `${world}: ${id} given with its tool in hand`);
      boxes.dispose();
    }
    // a world that offers them on arrival (a save that was here before the givers): held, then offered once the tool comes
    {
      const { quests, boxes, run } = setup(world, { old: true });
      run(BOX_QUEST_DELAY + 1);
      for (const { id, tool } of want) assert.equal(quests.isStarted(id), false, `${world}: ${id} not offered on arrival without the ${tool}`);
      for (const { tool } of want) items.grant(tool);
      run(1);
      for (const { id } of want) assert.equal(quests.isStarted(id), false, `${world}: ${id} not on the tool's heels`);
      run(BOX_QUEST_DELAY + 1);
      for (const { id, tool } of want) assert.equal(quests.isActive(id), true, `${world}: ${id} offered once the ${tool} is yours`);
      boxes.dispose();
    }
  }
  clearInteractables(); clearTargets(); game.reset();
});

test('nobody’s line points at a little chest before its tool is yours (issue #557)', () => {
  // a line that speaks of one box (its condition names the box's flag) also asks for that box's tool
  const files = ['desert', 'arzach', 'arzach2', 'perdide', 'perdide2', 'edena', 'underwater', 'incal', 'glassdunes', 'buried', 'moonfoundry', 'spheres', 'spacecity', 'bazaar']
    .map((w) => `${w}-data.js`).filter((f) => storySources.files.includes(f));   // (those there are: src/story/'s literal catalogue)
  let seen = 0;
  for (const f of files) {
    const lines = storySources.source(f).split('\n');
    lines.forEach((line, n) => {
      if (/^\s*\/\//.test(line)) return;
      for (const p of LITTLE) {
        if (!line.includes(`flag: 'box.${p.id}'`)) continue;
        seen++;
        assert.ok(line.includes(`has: '${boxTool(p)}'`), `${f}:${n + 1}: the line about ${p.id} waits for its ${boxTool(p)}`);
      }
    });
  }
  assert.ok(seen >= 5, `the lines about a little chest (${seen})`);
});
