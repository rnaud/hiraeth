import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME, templeOf, setupTempleStory } from '../src/temples/index.js';
import { game } from '../src/game-state.js';
import { allInteractables } from '../src/interact.js';
import { helperRun, consumeHelperReturn, HELPER_KEY } from '../src/temples/helper-encounter.js';
import { wayOut } from '../src/temples/finale.js';

const quiet = fn => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
for (const [id, gameId] of [['desert', 'cistern'], ['arzach', 'elderflight']]) test(`${id}: actual temple invitation, goal return, finale and exit resolve once`, () => {
  game.reset();
  const scene = new THREE.Scene(), world = TEMPLE_HOME[id] ?? id;
  const level = quiet(() => buildableById(world).create(scene)), rt = templeOf(level, id) ?? level.temple;
  const player = { pos: rt.guardian.model.pos.clone(), heading: 0, opts: {}, frame: {
    up: new THREE.Vector3(0, 1, 0), dir: (_a, out) => out.set(0, 0, 1) } };
  const navigations = [], order = [];
  const story = setupTempleStory({ level, levelId: world, player, game, quests: { isStarted: () => true }, playGame: href => navigations.push(href) });
  const off = game.on('temple:resolved', e => { if (e.id === id) order.push('resolved'); });
  try {
    assert.equal(rt.guardian.def.helper, gameId);
    rt.guardian.wake(); assert.equal(rt.guardian.state, 'sleep', 'entering never starts the former battle');
    assert.equal(rt.guardian.add(.5), false, 'combat cannot skip the helping game');
    const invite = allInteractables().find(e => e.id === `temple.${id}.help`);
    assert.ok(invite?.enabled()); assert.equal(invite.use(), true); assert.equal(invite.use(), false, 'one launch per world host');
    assert.equal(navigations.length, 1);
    const token = new URLSearchParams(navigations[0]).get('encounter'), run = helperRun(game, gameId, token);
    assert.ok(run); assert.equal(rt.logic.resolved, false);
    assert.equal(run.onResult({ score: 9999, failed: false }), false, 'arcade score alone cannot win the temple');
    assert.equal(run.onResult({ failed: true, goal: { game: gameId, complete: true } }), false);
    assert.equal(run.onResult({ failed: false, goal: { game: gameId, complete: true } }), true);
    run.left();
    rt.onFinale = () => { assert.equal(order[0], 'pose'); order.push('finale'); };
    const finish = () => consumeHelperReturn(game, id, world, {
      restore: p => { player.pos.fromArray(p.pos); order.push('pose'); }, resolve: () => rt.guardian.resolve(),
    });
    assert.equal(finish().success, true);
    assert.deepEqual(order, ['pose', 'finale', 'resolved']);
    assert.equal(game.flag(`temple.${id}.done`), true); assert.equal(rt.logic.resolved, true);
    assert.equal(rt.logic.isOpen(wayOut(rt).id), true, 'existing exit contract opens');
    assert.equal(game.flag(HELPER_KEY), null); assert.equal(finish(), null);
    rt.guardian.resolve(); assert.deepEqual(order, ['pose', 'finale', 'resolved']);
  } finally { off(); story?.dispose(); rt.dispose?.(); game.reset(); }
});
