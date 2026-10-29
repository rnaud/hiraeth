// Issue #789: "There should be no loading screen between the desert house and the keeper game." The Rose House's Keeper
// game is played in the desert's own page (src/minigames/kit/here.js): its court built over the world for the run, the
// way back the receipt's, no game page (and so no loading screen) either way. Temples keep theirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { bundle, loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { GameState } from '../src/game-state.js';
import { beginHelperEncounter, consumeHelperReturn, holdHelperReturn, HELPER_KEY } from '../src/temples/helper-encounter.js';
import { helperThreshold } from '../src/temples/helper-threshold.js';
import { helperHere, hereAt, readGameHref } from '../src/minigames/kit/here.js';
import cistern from '../src/minigames/cistern.js';
import elderflight from '../src/minigames/elderflight.js';
import fishing from '../src/minigames/fishing.js';
const byId = (id) => ({ cistern, elderflight, fishing })[id] ?? null;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pose = { pos: [4, 10, 6], up: [0, 1, 0], fwd: [0, 0, 1] }, done = { pos: [4, 10, 20], up: [0, 1, 0], fwd: [0, 0, 1] };

test('the Keeper\'s game is played in the desert, the court clear of the world\'s high rooms; the Elder\'s keeps its page', () => {
  assert.deepEqual(hereAt(cistern, 'desert'), [-400, 2000, -900]);
  assert.equal(hereAt(cistern, 'arena'), null);
  assert.equal(hereAt(elderflight, 'arzach'), null);
  assert.deepEqual(readGameHref('?game=cistern&from=desert&encounter=1%3Adesert%3A1%3Ax'), { game: 'cistern', from: 'desert', encounter: '1:desert:1:x' });
});

test('helperHere: the court built for the run, the runner the host\'s, the receipt held until the run is left', () => {
  const game = new GameState(null), scene = new THREE.Scene(), level = { noShadow: [] };
  const href = beginHelperEncounter(game, 'desert', { from: 'desert', returnPose: pose, completionPose: done });
  let host = null;
  const here = helperHere({ levelId: 'desert', scene, level, game, byId, open: (def, h) => { host = h; return { def, ended: false, end() {} }; } });
  assert.equal(here.play('?game=cistern&from=arzach&encounter=x'), false, 'another world\'s: its page');
  assert.equal(here.play('?game=fishing&from=desert'), false, 'not a helping game: its page');
  assert.equal(here.play(href), true);
  assert.equal(here.running, true);
  const court = scene.children.find((o) => /cistern \(played here\)/.test(o.name));
  assert.ok(court, 'the court is in the world\'s scene');
  assert.deepEqual(court.position.toArray(), [-400, 2000, -900]);
  assert.equal(host.scene, court, 'the session draws in the court');
  assert.deepEqual(host.level.at.toArray(), [-400, 2000, -900]);
  assert.ok(host.level.cistern?.braziers?.length, 'the court\'s own level');
  host.level.noShadow.push('x'); assert.deepEqual(level.noShadow, ['x'], 'the world\'s no-shadow list');
  assert.equal(here.play(href), false, 'one run at a time');
  // a win: the receipt marked, but the temple does not take it back while the run is up
  assert.equal(host.onResult({ goal: { game: 'cistern', complete: true } }), true);
  let restored = null;
  assert.equal(consumeHelperReturn(game, 'desert', 'desert', { restore: (p) => restored = p, resolve: () => game.set('temple.desert.done', true) }), null);
  assert.equal(restored, null);
  host.navigate(host.completionHref({ goal: { game: 'cistern', complete: true } }));
  assert.equal(here.running, false);
  assert.ok(!scene.children.includes(court), 'the court let go with the run');
  const back = consumeHelperReturn(game, 'desert', 'desert', { restore: (p) => restored = p, resolve: () => game.set('temple.desert.done', true) });
  assert.equal(back.success, true); assert.deepEqual(restored, done);
  assert.equal(game.flag('temple.desert.done'), true); assert.equal(game.flag(HELPER_KEY), null);
});

test('holdHelperReturn holds the temple\'s take-back, and lets it go', () => {
  const game = new GameState(null);
  beginHelperEncounter(game, 'desert', { from: 'desert', returnPose: pose });
  game.set(HELPER_KEY, { ...game.flag(HELPER_KEY), returning: true });
  holdHelperReturn(game, true);
  assert.equal(consumeHelperReturn(game, 'desert', 'desert', {}), null);
  holdHelperReturn(game, false);
  assert.equal(consumeHelperReturn(game, 'desert', 'desert', { restore() {} }).success, false);
});

test('back without the win from a game played here, the doorway asks again', () => {
  const flags = { 'item.sword': true, 'item.shield': true, 'item.gun': true };
  const game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = structuredClone(v); } };
  const group = new THREE.Group(); group.updateMatrixWorld(true);
  const door = { group, w: 4.4, h: 6, open: true, handle: null, slab: { position: V(0, -6.3, 0) } };
  const player = { pos: V(0, 0, -2), onGround: true, heading: 0, frame: { up: V(0, 1, 0), dir: (_, v) => v.set(0, 0, 1) }, teleport(p) { this.pos.copy(p); } };
  const rt = { id: 'desert', piece: () => door, logic: { resolved: false, isOpen: () => true }, inside: () => true, guardian: { arena: { center: V(0, 0, 20), r: 18, y: 0 } } };
  const calls = [], flow = helperThreshold(rt, { game, player, invitation: { start: (o) => { calls.push(o); return true; } }, slot: () => 'a' });
  const walkIn = () => { for (const z of [-2, -0.1, 0.2]) { player.pos.set(0, 0, z); flow.update(); } };
  flow.update(); walkIn();
  assert.equal(calls.length, 1);
  player.pos.set(0, 0, -2); flow.update(); walkIn();
  assert.equal(calls.length, 1, 'launched: once');
  flow.rearm();
  player.pos.set(0, 0, -2); flow.update(); walkIn();
  assert.equal(calls.length, 2, 'the quit came back to the doorway: crossing it again asks again');
});

test('main.js and the engine try the game here before its page', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /playGame: \(href\) => \{ if \(!helperHereRt\?\.play\(href\)\) location\.href = href; \}/);
  assert.match(main, /!minigameDef && !helperHereRt\?\.running && !player\.god && SaveGame\.write/, 'the save keeps the place in the house');
  const engine = readFileSync(new URL('../engine/game.js', import.meta.url), 'utf8');
  assert.match(engine, /playGame: \(href\) => \{ if \(!trials\?\.here\?\.play\(href\)\) onGame\?\.\(href\); \}/);
});

// ------------------------------------------------------------------ the engine (Unity's, Godot's game.js), played through
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (_t, k) => UNSET.has(k) ? undefined : () => {} });
const quiet = async (fn) => { const names = ['warn', 'info', 'log', 'error'], old = names.map((k) => console[k]); names.forEach((k) => console[k] = () => {}); try { return await fn(); } finally { names.forEach((k, i) => console[k] = old[i]); } };
const plain = (x) => JSON.parse(JSON.stringify(x));

test('engine: the Keeper\'s game in the desert\'s own world, won and quit, never a page (no loading screen)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-helper-here-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  for (const how of ['quit', 'win']) {
    const state = new GameState(null);
    const href = beginHelperEncounter(state, 'desert', { from: 'desert', returnPose: pose, completionPose: done, slot: 1 });
    const memory = new Map([['hiraeth.slot', '1'], ['hiraeth.slots.v', '1'], ['hiraeth.s1.game.v1', JSON.stringify(state.data)]]);
    const vm = loadBundle(file, { pads: () => [], storage: { get: (k) => memory.get(k), set: (k, v) => memory.set(k, v), remove: (k) => memory.delete(k) } });
    const X = vm.exports, pages = [], stages = [];
    const g = await quiet(() => X.createGame({ levelId: 'desert', backend, menus: new X.EngineMenus({}), audio: null, onGame: (h) => pages.push(h), onLeave: (h) => pages.push(h), onStage: (s) => stages.push(s) }));
    const frames = (n) => quiet(() => { for (let i = 0; i < n; i++) g.frame(1 / 30); });
    stages.length = 0;
    assert.ok(g.trials.here, 'the engine has the same here');
    assert.equal(g.trials.here.play(href), true);
    const r = g.trials.runner;
    assert.equal(r.def.id, 'cistern'); assert.equal(r.phase, 'intro');
    assert.deepEqual(plain(r.ctx.level.at), { x: -400, y: 2000, z: -900 });
    r.begin(); await frames(100);
    assert.equal(r.phase, 'play');
    assert.ok(g.player.pos.y > 1990 && g.player.pos.distanceTo(new g.player.pos.constructor(-400, 2000, -900)) < 40, 'the traveller in the court');
    assert.equal(g.screen().state.minigame.timer?.down, 300, 'the countdown in the native HUD');
    const saved = memory.get('hiraeth.s1.save.v1') ?? null;
    g.save(); assert.equal(memory.get('hiraeth.s1.save.v1') ?? null, saved, 'no save in the court');
    if (how === 'win') r.ctx.finish({ score: 1, failed: false, goal: { game: 'cistern', complete: true } });
    else r.quit();
    await frames(90);
    assert.equal(g.trials.running, false);
    assert.equal(g.trials.here.running, false);
    assert.deepEqual(pages, [], 'neither the game\'s page nor the world\'s again: no loading screen either way');
    assert.deepEqual(stages, [], 'no new stage');
    const back = how === 'win' ? done : pose;
    assert.ok(Math.hypot(g.player.pos.x - back.pos[0], g.player.pos.z - back.pos[2]) < 1.5 && g.player.pos.y < 100, `${how}: back at ${back.pos} (${g.player.pos.toArray()})`);
    assert.equal(g.scene.children.some((o) => /played here/.test(o.name)), false, 'the court is gone');
    assert.equal(r.host.state.flag('temple.desert.done') ?? false, how === 'win', `${how}: the house's ending is the win's alone`);
    assert.equal(r.host.state.flag(HELPER_KEY) ?? null, null, 'the receipt taken back');
  }
});
