// Whole-game cases retain their assertions without generic platform/spike VM fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { bundle, loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { recorder } from './engine-bridge-fixtures.js';
THREE.ColorManagement.enabled = false;

test('a graphics preset in the engines\' game (the Unity bridge\'s -quality deck): its look and its detail, as main.js applies them', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-quality-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const warn = console.warn, info = console.info; console.warn = console.info = () => {};
  try {
    const high = await loadBundle(file).exports.createGame({ levelId: 'garage', backend: recorder().backend });
    high.frame(1 / 30);
    const deck = await loadBundle(file).exports.createGame({ levelId: 'garage', backend: recorder().backend, quality: 'deck' });
    deck.frame(1 / 30);
    const H = high.fullLook().shared, D = deck.fullLook().shared;
    assert.equal(H.uWearLite, 0); assert.equal(D.uWearLite, 1, 'the lighter weathering');
    assert.equal(D.uCloudShadows, 0, 'no cloud shadows'); assert.equal(D.uShadowTaps, 4); assert.equal(H.uShadowTaps, 9);
    if (deck.crowd) assert.ok(deck.crowd.range.far <= 260 && deck.crowd.range.dist < Infinity, 'the crowd\'s ranges');
  } finally { console.warn = warn; console.info = info; }
});

test('the game in a bare V8 context: a world with its people, the traveller walks on the keys, the camera follows', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-game-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const { exports } = loadBundle(file);
  const R = recorder();
  let bones = 0;
  R.backend.bones = () => bones++;
  const warn = console.warn, info = console.info; console.warn = console.info = () => {};
  try {
    const game = await exports.createGame({ levelId: 'garage', backend: R.backend });
    // the world's people on MakeHuman bodies, as main.js has them (src/makehuman/people.js)
    assert.ok(game.npcs.some((n) => n.humanoid?.profile?.buildGeometry), 'MakeHuman bodies for the people');
    // the conversations' gestures (issue #197, #264: public/anim/gestures.glb), and since #427's round 4 the people's walks and
    // the traveller's captured moves as main.js loads them (walks.glb, moves.glb); the matching database left out, as on the page
    assert.ok(game.player.animator.lib.motion?.clips?.some((c) => /^gesture_talking/.test(c.name)), 'the talking clips');
    assert.equal(game.player.locoMoves, true, 'his captured moves');
    assert.ok(game.player.animator.lib.motion?.walks?.length > 0, 'the people\'s walks');
    assert.equal(game.player.animator.matching, false, 'no matching');
    game.frame(1 / 30);
    const p0 = game.player.pos.clone(), c0 = game.camera.position.clone();
    game.key('KeyW', true);
    for (let i = 0; i < 45; i++) game.frame(1 / 30);
    game.key('KeyW', false);
    const walked = game.player.pos.distanceTo(p0);
    assert.ok(walked > 2, `walked ${walked.toFixed(2)} m`);
    assert.ok(game.camera.position.distanceTo(c0) > 1, 'the camera followed');
    assert.ok(game.camera.position.distanceTo(game.player.pos) < 30, 'and stayed with him');
    assert.ok(bones > 0, 'skinned people and the traveller send their bones');
    const look = game.lookParams();
    assert.equal(look.uSkyTop.length, 3);
    assert.equal(typeof look.uToon, 'number');
  } finally { console.warn = warn; console.info = info; }
});

test('the engines\' ways through (issue #264): a doorway walked into carries the traveller to its room under the paper, and its way back out', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-portals-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const { exports } = loadBundle(file);
  const warn = console.warn, info = console.info; console.warn = console.info = () => {};
  try {
    // This is the earned-bike doorway fixture; fresh Rose refusal is covered by door-walk.test.js.
    const game = await exports.createGame({ levelId: 'desert', backend: recorder().backend, flags: { 'desert.bike.found': true } });
    const P = game.level.portals ?? [];
    assert.ok(P.length > 2, 'the desert\'s doorways, caves and hatches');
    game.frame(1 / 30);
    // a way that takes you now, with a way back out of where it lands
    const back = (pt) => P.find((q) => q !== pt && (!q.when || q.when()) && q.at.distanceTo(pt.to) < 30 && q.to.distanceTo(pt.at) < 30);
    const pt = P.find((q) => (!q.when || q.when()) && back(q));
    assert.ok(pt, 'a doorway with its way back');
    const go = (way) => {
      game.player.teleport(way.at.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
      let covered = false, f = 0;
      for (; f < 120 && game.player.pos.distanceTo(way.to) > 2; f++) { game.frame(1 / 30); covered ||= !!game.screen().state.passage; }
      return { f, covered };
    };
    const inTo = go(pt);
    assert.ok(game.player.pos.distanceTo(pt.to) < 2, `carried to the room (${game.player.pos.distanceTo(pt.to).toFixed(1)} m off)`);
    assert.ok(inTo.covered, 'under the paper (the screen\'s passage, BridgeHud draws it)');
    for (let i = 0; i < 90 && game.passage.active; i++) game.frame(1 / 30);
    assert.equal(game.passage.active, false, 'the paper gone off the far side');
    assert.equal(game.screen().state.passage ?? null, null, 'and the screen clear of it');
    for (let i = 0; i < 45; i++) game.frame(1 / 30);   // (the cool-down after a way through)
    const way = back(pt);
    go(way);
    assert.ok(game.player.pos.distanceTo(way.to) < 2, 'and back out the way he came');
    // the temple's door (src/temples/runtime.js: the doorway in, its ways back out), into its halls and out again
    for (let i = 0; i < 60; i++) game.frame(1 / 30);
    const door = P.find((q) => q.temple && q.label !== 'way out' && (!q.when || q.when()));
    assert.ok(door, 'the desert temple\'s door');
    go(door);
    assert.ok(game.player.pos.distanceTo(door.to) < 2, 'into the temple');
    for (let i = 0; i < 90; i++) game.frame(1 / 30);
    const out = P.find((q) => q.temple === door.temple && q.label === 'way out');
    go(out);
    assert.ok(game.player.pos.distanceTo(out.to) < 2, 'and out of it');
  } finally { console.warn = warn; console.info = info; }
});

