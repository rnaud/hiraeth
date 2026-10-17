// The motion check's tools (scripts/motion-check, docs/systems/rendering.md "Stable in motion"), issue #301: its frozen
// world holds the flocks, the creatures and the foes too (they moved round the traveller, whom every frame of a path puts
// behind the camera: Viridel's pan read 12.8 flickering px per 10 000, mostly birds), and it finds Playwright without a
// hand-set path (the default pointed at another session's scratch folder) or says how to get it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { freezeLife } from '../scripts/motion-check/freeze.mjs';
import { Flock } from '../src/life.js';
import { findPlaywright, importPlaywright, PLAYWRIGHT_HELP } from '../scripts/bench/browser.mjs';

test('the frozen world holds the flocks where they were as the traveller is carried along a path', () => {
  const scene = new THREE.Scene(), player = { pos: new THREE.Vector3(0, 0, 0) }, camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, 5);
  const flock = new Flock(scene, { count: 4, seed: 2 });
  const at = () => { const m = new THREE.Matrix4(); flock.bodies.getMatrixAt(0, m); return new THREE.Vector3().setFromMatrixPosition(m); };
  // before: the flock's centre follows him, so a camera path dragged the birds across the frame
  flock.update(1e-4, 10, player.pos, camera.position); const a = at();
  player.pos.set(6, 0, 0); camera.position.set(6, 2, 5);
  flock.update(1e-4, 10, player.pos, camera.position);
  assert.ok(at().distanceTo(a) > 5, 'the bug: the birds moved with him');
  // held: the same centre and eye whatever he does, the clock all but stopped
  player.pos.set(0, 0, 0); camera.position.set(0, 2, 5);
  const win = { player, camera, flocks: [flock] };
  assert.deepEqual(freezeLife(win), ['flock 0']);
  flock.update(1e-4, 10, player.pos, camera.position); const b = at();
  player.pos.set(6, 0, 0); camera.position.set(6, 2, 5);
  flock.update(1e-4, 10, player.pos, camera.position);
  assert.ok(at().distanceTo(b) < 1e-3, `held (${at().distanceTo(b).toFixed(4)} m)`);
  assert.deepEqual(freezeLife(win), [], 'held once');
});

test('the frozen world updates the creatures, the reactive things and the foes as paused', () => {
  const calls = [];
  const mover = (name) => ({ update(...a) { calls.push([name, ...a]); } });
  const win = { player: { pos: new THREE.Vector3() }, camera: { position: new THREE.Vector3() }, wildlife: mover('wildlife'), reactiveWorld: mover('reactive'), foes: mover('foes') };
  assert.deepEqual(freezeLife(win), ['wildlife', 'reactiveWorld', 'foes']);
  win.wildlife.update(0.1, 3, 'P', 'C', false); win.reactiveWorld.update(0.1, 3, 'P', 'C'); win.foes.update(0.1, false); win.foes.update(0.1);
  assert.deepEqual(calls, [['wildlife', 0.1, 3, 'P', 'C', true], ['reactive', 0.1, 3, 'P', 'C', true], ['foes', 0.1, true], ['foes', 0.1, true]]);
  // the game's own calls take those arguments in those places (main.js), and the classes stop on them
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('wildlife.update(dt, t, player, camera, busy() || photo.on);') && main.includes('reactiveWorld.update(dt, t, player, camera, busy() || photo.on);'));
  assert.ok(main.includes('fight.update(dt, busy() || photo.on || ship.playing);'));   // (src/host/game-host.js wireFight: foes.update(dt, quiet))
  assert.ok(readFileSync(new URL('../src/host/game-host.js', import.meta.url), 'utf8').includes('foes.update(dt, quiet);'));
  assert.ok(main.includes('f.update(dt, t, player.pos, camera.position)'));
  assert.match(readFileSync(new URL('../src/wildlife.js', import.meta.url), 'utf8'), /update\(dt, t, player, camera, paused = false\) \{\n\s*if \(paused\) return;/);
  assert.match(readFileSync(new URL('../src/foes.js', import.meta.url), 'utf8'), /update\(dt, paused = false\) \{[\s\S]{0,400}if \(paused\) return;/);
  // and the check hands it to the page, held unless asked (--live)
  const rec = readFileSync(new URL('../scripts/motion-check/record.mjs', import.meta.url), 'utf8');
  assert.ok(rec.includes('window.__freezeLife = ${freezeLife.toString()}') && rec.includes('window.__frozenLife = live ? [] : window.__freezeLife(window);'));
});

test('the benches find Playwright where Node does, or say how to get it (no other session\'s scratch folder)', async () => {
  const src = readFileSync(new URL('../scripts/bench/browser.mjs', import.meta.url), 'utf8');
  assert.ok(!/\/private\/tmp|scratchpad/.test(src), 'no hand-set path to a scratch folder');
  assert.equal(findPlaywright({ PLAYWRIGHT: '/x/playwright-core/index.mjs' }), '/x/playwright-core/index.mjs');
  assert.equal(findPlaywright({}, (m) => { if (m === 'playwright-core') return '/n/playwright-core/index.mjs'; throw new Error('no'); }), 'file:///n/playwright-core/index.mjs');
  assert.equal(findPlaywright({}, (m) => { if (m === 'playwright') return '/n/playwright/index.js'; throw new Error('no'); }), 'file:///n/playwright/index.js');
  assert.equal(findPlaywright({}, () => { throw new Error('no'); }), 'playwright-core');
  // (what Node resolves is the CommonJS index.js: imported, its chromium is on `default` only)
  assert.equal((await importPlaywright('data:text/javascript,export default { chromium: 7 }')).chromium, 7);
  assert.equal((await importPlaywright('data:text/javascript,export const chromium = 8')).chromium, 8);
  await assert.rejects(importPlaywright('/nowhere/playwright-core/index.mjs'), (e) => e.message.startsWith(PLAYWRIGHT_HELP) && /npm i --no-save playwright-core/.test(e.message));
  // every script that drives Chrome through it asks importPlaywright
  for (const f of ['motion-check/record.mjs', 'lab-perf/lab-perf.mjs', 'bench/deck-pen.mjs', 'transition-perf/loading.mjs', 'transition-perf/transitions.mjs', 'transition-perf/pen.mjs']) {
    const s = readFileSync(new URL(`../scripts/${f}`, import.meta.url), 'utf8');
    assert.ok(s.includes('importPlaywright()') && !s.includes('import(PLAYWRIGHT)'), f);
  }
});
