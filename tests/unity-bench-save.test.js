// Issue #565: a bright white streak down the middle of the Underwater City's wide views in Unity. It was a makers' chest's
// beacon (src/boxes/model.js buildBeacon: a glowing column 36 m tall) standing 8 m in front of the eye, on a chest the web
// never built: the double jump's fallback chest by the ship (src/boxes/placements.js FALLBACKS). The page boots the bench's
// save from its storage and src/game-state.js migrates it (a save that never emptied its tank has the lift valve's double
// jump, src/save-migrate.js step 8); the engines put the same flags straight into their state, unmigrated, so they had no
// double jump and laid a second chest out by the ship. engine/game.js now boots them as the page does (bootFlags).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { GameState } from '../src/game-state.js';
import { bootFlags } from '../src/save-migrate.js';
import { placementsFor } from '../src/boxes/index.js';
import * as THREE from 'three';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** An object literal of plain flags, as written in a source file after `marker`. */
const flagsAfter = (src, marker) => {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} found`);
  const from = src.indexOf('{', at + marker.length), body = src.slice(from, src.indexOf('}', from) + 1);
  return JSON.parse(body.replace(/'/g, '"'));
};
// the web bench's save (scripts/bench/web-page.mjs prepareStorage, scripts/design-qc/capture.mjs) and Unity's (engine/unity/game.js)
const WEB = flagsAfter(read('scripts/bench/web-page.mjs'), "setItem('hiraeth.game.v1', JSON.stringify({ flags:");
const UNITY = flagsAfter(read('engine/unity/game.js'), 'const BENCH_FLAGS =');
/** The flags the page has once it has booted a save from its storage. */
const pageBoots = (flags) => {
  const store = new Map([['hiraeth.game.v1', JSON.stringify({ flags, keepsakes: [] })]]);
  return new GameState({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }).data.flags;
};

test('the engines\' bench save is the web bench\'s, booted as the page boots it', () => {
  assert.deepEqual(UNITY, WEB, 'the same save on both sides of the visual check');
  const page = pageBoots(WEB);
  assert.deepEqual(bootFlags(UNITY), page, 'migrated as the page migrates it');
  assert.equal(page['item.doublejump'], true, 'a save that never emptied its tank has the lift valve (save-migrate step 8)');
  // a save that says it is migrated is taken as it is, and the flags handed in are never changed
  const done = { ...UNITY, 'save.migrated': page['save.migrated'] };
  assert.deepEqual(bootFlags(done), done);
  const given = { ...UNITY };
  bootFlags(given);
  assert.deepEqual(given, UNITY);
});

test('the bench save asks for the same fallback chests on both sides, in every world', () => {
  const page = pageBoots(WEB), booted = bootFlags(UNITY);
  for (const levelId of ['underwater', 'perdide', 'edena', 'glassdunes', 'overnighttrain', 'arzach']) {
    const want = (f) => placementsFor(levelId, { has: (id) => !!f[`item.${id}`] }).filter((p) => p.fallback).map((p) => p.item);
    assert.deepEqual(want(booted), want(page), levelId);
    assert.ok(!want(booted).includes('doublejump'), `${levelId}: no double jump chest by the ship`);
  }
});

// the game in a bare V8 context, as Unity runs it, at the Underwater City's wide view (scripts/bench/viewpoints-worlds.json)
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'noticed', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const file = tempPath(join(tmpdir(), `hiraeth-bench-save-${process.pid}.js`));

test('Unity\'s wide view of the Underwater City: no beacon the web lacks down the middle of the picture', async () => {
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const E = loadBundle(file, { pads: () => [] }).exports;
  const wide = JSON.parse(read('scripts/bench/viewpoints-worlds.json')).worlds.underwater.views.find((v) => v.name === 'wide');
  const g = await quietly(() => E.createGame({ levelId: 'underwater', backend, flags: UNITY, view: { ...wide, hour: 18.6, weather: 'clear' } }));
  await quietly(() => { for (let i = 0; i < 4; i++) g.frame(1 / 30); });
  const fallbacks = g.boxes.list.filter((b) => b.fallback).map((b) => b.item);
  assert.deepEqual(Array.from(fallbacks), ['gun'], 'the web\'s one fallback chest by the ship (the gun\'s), not the double jump\'s');
  // the beacons in the picture, sampled up their height: the gun's chest's alone, as on the web (the streak was the double
  // jump's, 8 m in front of the eye)
  const cam = g.camera;
  cam.updateMatrixWorld();
  g.scene.updateMatrixWorld(true);
  const seen = [];
  for (const b of g.boxes.list) {
    let o = b.beacon, shown = !!o;
    for (let p = o; p; p = p.parent) if (!p.visible) shown = false;
    if (!shown) continue;
    for (let k = 0; k <= 20; k++) {
      const q = new THREE.Vector3(0, k / 20, 0).applyMatrix4(o.matrixWorld).project(cam);
      if (Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && q.z < 1) { seen.push(b.id); break; }
    }
  }
  // (since issue #572 the fallback chest stands by the ship on the sea port, 80 m up, out of this view of the Dock: none is
  // in the frame, and never the double jump's)
  assert.ok(seen.every((id) => id === 'underwater.gun'), `the beacons in the frame: ${seen.join(', ')}`);
});
