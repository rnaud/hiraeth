import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { vistaCamera, vistaResolution, buildVista, CLOUD_Y, DRIFT } from '../src/title-vista.js';

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('the title vista reads and writes no save: it loads nothing of the game state', () => {
  const banned = ['game-state', 'items', 'quest', 'main', 'levels/index', 'levels/content', 'save-slots', 'ui'];
  for (const f of ['title-vista.js', 'levels/sky-stones-kit.js']) {
    for (const m of src(f).matchAll(/from '\.{1,2}\/([\w/-]+)\.js'/g)) assert.ok(!banned.includes(m[1]), `${f} imports ${m[1]}`);
    assert.doesNotMatch(src(f), /localStorage|SaveGame|journal/, f);
  }
  // the title loads it only after the menu is up, and frees it before the game starts
  const title = src('title.js');
  assert.match(title, /import\('\.\/title-vista\.js'\)/);
  assert.ok(title.indexOf('markBooted(win)') < title.indexOf("import('./title-vista.js')"), 'the heartbeat does not wait for the 3D view');
  assert.match(title, /vista\?\.dispose\(\)/);
});

test('the render size is capped, lower on touch screens and handhelds', () => {
  const desk = vistaResolution({ width: 1600, height: 900, dpr: 2, scale: 1.5 });
  assert.ok(desk.w * desk.h <= 2.1e6 + 4000, `${desk.w}x${desk.h}`);
  assert.ok(desk.pr <= 2);
  const plain = vistaResolution({ width: 1920, height: 1080, dpr: 1, scale: 1 });
  assert.deepEqual([plain.w, plain.h], [1920, 1080]);
  const phone = vistaResolution({ width: 390, height: 844, dpr: 3, scale: 1, touch: true });
  assert.ok(phone.w * phone.h <= 1e6 + 3000, `${phone.w}x${phone.h}`);
  const hand = vistaResolution({ width: 730, height: 410, dpr: 2.6, scale: 0.75, handheld: true });
  assert.ok(hand.w * hand.h <= 0.5e6 + 2000, `${hand.w}x${hand.h}`);
  const dropped = vistaResolution({ width: 730, height: 410, dpr: 1, scale: 0.75, handheld: true, drop: 0.5 });
  assert.ok(dropped.w < hand.w && dropped.w >= 1);
});

test('the camera drifts high over the cloud, smoothly, and comes back round', () => {
  const p = new THREE.Vector3(), q = new THREE.Vector3(), t0 = vistaCamera(0);
  const end = vistaCamera(DRIFT.period);
  assert.ok(t0.pos.distanceTo(end.pos) < 1e-6 && t0.target.distanceTo(end.target) < 1e-6, 'periodic');
  let prev = vistaCamera(0).pos.clone();
  for (let t = 0.5; t <= DRIFT.period; t += 0.5) {
    vistaCamera(t, p, q);
    assert.ok(p.y > CLOUD_Y + 110, `height ${p.y}`);
    assert.ok(p.distanceTo(prev) < 4, 'slow: under 8 m/s, some 300 m from what it looks at');
    assert.ok(p.distanceTo(q) > 150, 'looks out across the land');
    assert.ok(q.y < p.y, 'looks a little down');
    prev.copy(p);
  }
});

test('the vista builds within its budget, and nothing stands in the camera\'s way', async () => {
  let steps = 0;
  const full = await buildVista(new THREE.Scene(), { step: async () => { steps++; } });
  assert.ok(steps >= 4, 'built in several steps');
  assert.ok(full.triangles > 100000 && full.triangles < 800000, `${full.triangles} triangles`);
  assert.ok(full.movers.length >= 5, 'floating stones bob');
  assert.ok(full.flock.count > 0);
  assert.ok(full.noShadow.some((m) => m.isInstancedMesh), 'the cloud casts no shadow');
  const low = await buildVista(new THREE.Scene(), { detail: 0.5 });
  assert.ok(low.triangles < full.triangles * 0.6, `handheld ${low.triangles}`);
  const p = new THREE.Vector3();
  for (let t = 0; t < DRIFT.period; t += 1) {
    vistaCamera(t, p);
    for (const [x, z, r] of full.solids) assert.ok(Math.hypot(p.x - x, p.z - z) > r + 15, `camera at ${t}s inside a stone at ${x.toFixed(0)},${z.toFixed(0)}`);
  }
  full.flock.update(0.016, 1, new THREE.Vector3(), p);
  for (const m of full.movers) m(3);
});
