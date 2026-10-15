// The Steam Deck's main thread, issue #111 (docs/systems/performance.md, "The Steam Deck, round 10"): the per-frame
// work this round took out, each with the numbers it must still give.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { watchSceneEdits, updateSceneMatrices } from '../engine/scene-matrices.js';
import { installMatrixCache } from '../src/matrix-cache.js';
import { EmptyInstances, emptyCandidate } from '../src/empty-instances.js';
import { ShadowCuller, shadowVariants } from '../src/shadows.js';
import { opaqueSort } from '../src/static-batch.js';
import { holdsToasts, HOLD_TOASTS } from '../src/ship/cinema.js';

installMatrixCache?.();
watchSceneEdits();

test('instanced meshes holding no instance are left out of the frame\'s passes, and shown again after', () => {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(), mat = new THREE.MeshBasicMaterial();
  const empty = new THREE.InstancedMesh(geo, mat, 8); empty.count = 0;
  const full = new THREE.InstancedMesh(geo, mat, 8); full.count = 3;
  const hooked = new THREE.InstancedMesh(geo, mat, 8); hooked.count = 0; hooked.onBeforeRender = () => { hooked.count = 2; };
  const parent = new THREE.InstancedMesh(geo, mat, 8); parent.count = 0; parent.add(new THREE.Mesh(geo, mat));
  const hidden = new THREE.InstancedMesh(geo, mat, 8); hidden.count = 0; hidden.visible = false;
  scene.add(empty, full, hooked, parent, hidden, new THREE.Mesh(geo, mat));
  updateSceneMatrices(scene); updateSceneMatrices(scene);   // (the scene's list made: the frame's matrices)
  const E = new EmptyInstances(scene);
  const out = E.hide([]);
  assert.deepEqual(out, [empty], 'only the plain empty one');
  assert.equal(empty.visible, false);
  assert.ok(full.visible && hooked.visible && parent.visible, 'the others as they were');
  assert.equal(hidden.visible, false, 'one already hidden is not shown again by the frame');
  for (const o of out) o.visible = true;
  // an instance put in: drawn again the next frame
  empty.count = 1;
  updateSceneMatrices(scene);
  assert.deepEqual(E.hide([]), []);
  assert.ok(!emptyCandidate(new THREE.Mesh(geo, mat)));
  // a scene edited this frame: its list is stale until the next frame's matrices, and nothing is hidden meanwhile
  empty.count = 0;
  scene.add(new THREE.Group());
  assert.deepEqual(E.hide([]), []);
  updateSceneMatrices(scene); updateSceneMatrices(scene);
  assert.deepEqual(E.hide([]), [empty]);
});

test('ShadowCuller.begin: each caster\'s world sphere the numbers Vector3.applyMatrix4 and getMaxScaleOnAxis give', () => {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial();
  const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const meshes = [];
  for (let i = 0; i < 40; i++) {
    const g = new THREE.SphereGeometry(0.2 + rng() * 3).translate(rng() * 2 - 1, rng(), rng() * 2 - 1);
    const m = i % 5 === 0 ? new THREE.InstancedMesh(g, mat, 2) : new THREE.Mesh(g, mat);
    if (m.isInstancedMesh) m.computeBoundingSphere();
    m.position.set(rng() * 200 - 100, rng() * 20, rng() * 200 - 100);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.scale.set(0.5 + rng() * 2, 0.5 + rng() * 2, 0.5 + rng() * 2);
    if (i % 7 === 0) m.userData.batch = true, m.partRadius = 0.4;
    scene.add(m); meshes.push(m);
  }
  scene.updateMatrixWorld();
  const camera = new THREE.PerspectiveCamera(55, 1.6, 0.3, 3000); camera.position.set(0, 5, 0); camera.updateMatrixWorld();
  const cull = new ShadowCuller(scene);
  cull.begin(camera, new THREE.Vector3(0.3, 0.8, 0.2).normalize());
  for (const it of cull.items) {
    const o = it.o, c = it.local.center.clone().applyMatrix4(o.matrixWorld), k = o.matrixWorld.getMaxScaleOnAxis();
    assert.deepEqual([it.c.x, it.c.y, it.c.z], [c.x, c.y, c.z], 'the centre, bit for bit');
    assert.equal(it.r, it.local.radius * k * it.pad + (it.pad > 1 ? 0.3 : 0));
    assert.equal(it.size, it.part ? it.part * k : it.r);
  }
  // a hidden caster is out; moved, the next frame's sphere follows it
  meshes[3].visible = false; meshes[4].position.x += 50; scene.updateMatrixWorld();
  cull.begin(camera, new THREE.Vector3(0, 1, 0));
  assert.equal(cull.items.find((x) => x.o === meshes[3]).r, -1);
  const it4 = cull.items.find((x) => x.o === meshes[4]);
  assert.equal(it4.c.x, it4.local.center.clone().applyMatrix4(meshes[4].matrixWorld).x);
});

test('the shadow override: one copy for each kind three compiles differently, the same copy for the same kind', () => {
  const base = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  const pick = shadowVariants(base);
  const geo = new THREE.BoxGeometry(), morphGeo = new THREE.BoxGeometry();
  morphGeo.morphAttributes.position = [morphGeo.attributes.position.clone()];
  const mesh = new THREE.Mesh(geo), inst = new THREE.InstancedMesh(geo, null, 2), coloured = new THREE.InstancedMesh(geo, null, 2);
  coloured.setColorAt(0, new THREE.Color(1, 0, 0));
  const skinned = new THREE.SkinnedMesh(geo), face = new THREE.SkinnedMesh(morphGeo);
  const kinds = [mesh, inst, coloured, skinned, face].map(pick);
  assert.equal(kinds[0], base, 'a plain mesh draws with the material itself');
  assert.equal(new Set(kinds).size, 5, 'each kind its own copy');
  assert.equal(pick(new THREE.InstancedMesh(geo, null, 3)), kinds[1]);
  assert.equal(pick(new THREE.Mesh(new THREE.SphereGeometry())), base);
  for (const k of kinds) assert.ok(k.side === THREE.DoubleSide && k.colorWrite === false, 'a copy of the same depth material');
});

test('the opaque order: a render item\'s material sort id kept while it holds that material (the same order as before)', () => {
  const mats = Array.from({ length: 12 }, () => new THREE.MeshBasicMaterial());
  mats[5].batchSortId = mats[1].id;   // (a batch drawn where its first material was)
  const plain = (a, b) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
    const ma = a.material.batchSortId ?? a.material.id, mb = b.material.batchSortId ?? b.material.id;
    if (ma !== mb) return ma - mb;
    if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
    if (a.z !== b.z) return a.z - b.z;
    return a.id - b.id;
  };
  const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(3);
  const items = Array.from({ length: 200 }, (_, i) => ({ id: i, groupOrder: 0, renderOrder: rng() < 0.1 ? 1 : 0, material: mats[Math.floor(rng() * 12)], materialVariant: 0, z: rng() }));
  for (let frame = 0; frame < 3; frame++) {
    // (three reuses its items: another material in an item the next frame)
    for (const it of items) if (rng() < 0.3) it.material = mats[Math.floor(rng() * 12)];
    assert.deepEqual(items.slice().sort(opaqueSort).map((x) => x.id), items.slice().sort(plain).map((x) => x.id));
  }
});

test('the toasts\' hold: the same answer as the selector, by id', async () => {
  const ids = {}, huds = [];
  const el = (cls) => ({ classList: { contains: (c) => cls.includes(c) } });
  const doc = { getElementById: (id) => ids[id] ?? null, getElementsByClassName: (c) => (c === 'mg-hud' ? huds : []) };
  assert.equal(holdsToasts(doc), false);
  for (const [id, cls] of [['homeward', 'open'], ['starmap', 'open'], ['page', 'open'], ['journal', 'open'], ['warp', 'on'], ['boxscene', 'on']]) {
    assert.ok(HOLD_TOASTS.includes(`#${id}.${cls}`), `${id} is in the selector`);
    ids[id] = el(['x']); assert.equal(holdsToasts(doc), false, `${id} without .${cls}`);
    ids[id] = el([cls]); assert.equal(holdsToasts(doc), true, `${id}.${cls}`);
    delete ids[id];
  }
  huds.push(el(['mg-hud'])); assert.equal(holdsToasts(doc), false, 'no game\'s screens: no HUD looked for');
  huds.length = 0; ids.minigame = el([]);
  huds.push(el(['mg-hud', 'off'])); assert.equal(holdsToasts(doc), false, 'a game\'s HUD put away');
  huds.push(el(['mg-hud'])); assert.equal(holdsToasts(doc), true, 'a game on');
  // (a game's HUD is made only by the game's runner, inside its #minigame screens)
  const { readFileSync } = await import('node:fs');
  const runner = readFileSync(new URL('../src/minigames/kit/runner.js', import.meta.url), 'utf8');
  assert.match(runner, /el\.id = 'minigame';[\s\S]{0,200}class="mg-hud off"/);
  assert.equal(HOLD_TOASTS.split(',').length, 7, 'every part of the selector checked');
});

test('the wind\'s wisps out of the view are not built: the ones in view are drawn as before, every one blows on', async () => {
  const { WindStreaks } = await import('../src/wind.js');
  const run = (cull) => {
    const r = Math.random; let a = 11;
    Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    try {
      const cam = new THREE.PerspectiveCamera(55, 4 / 3, 0.1, 2000);
      cam.position.set(0, 1.7, -6); cam.lookAt(0, 1, 20); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const w = new WindStreaks();
      w.uniforms.uRes.value.set(960, 720); w.fixedAngle = 0.4; w.gust = () => 1;
      // (no culling: a frustum round everything, the view's own camera for the strokes' widths)
      const wide = Object.assign(cam.clone(), { fov: 179 }); wide.position.set(0, 1.7, -6); wide.lookAt(0, 1, 20); wide.far = 1e6; wide.updateProjectionMatrix(); wide.updateMatrixWorld();
      for (let f = 0; f < 240; f++) {
        if (!cull) { const pm = cam.projectionMatrix.clone(), pmi = cam.projectionMatrixInverse.clone(); cam.projectionMatrix.copy(wide.projectionMatrix); w.update(1 / 60, new THREE.Vector3(), Object.assign(cam, { _p: [pm, pmi] }), { heightAt: () => 0 }, 0.002, true); cam.projectionMatrix.copy(pm); }
        else w.update(1 / 60, new THREE.Vector3(), cam, { heightAt: () => 0 }, 0.002, true);
      }
      return { w, cam };
    } finally { Math.random = r; }
  };
  const a = run(true), b = run(false);
  assert.deepEqual(a.w.wisps.map((x) => [x.x, x.z, x.age]), b.w.wisps.map((x) => [x.x, x.z, x.age]), 'every wisp where it would be');
  let drawnA = 0, cleared = 0;
  const P = a.w.positions, p = new THREE.Vector3();
  for (let i = 0; i < a.w.alphas.length; i++) {
    const ina = p.fromArray(b.w.positions, i * 3).clone().project(a.cam);   // (where the point would be)
    const inView = Math.abs(ina.x) <= 1 && Math.abs(ina.y) <= 1 && ina.z <= 1 && ina.z >= -1;
    if (a.w.alphas[i] > 0) { drawnA++; assert.equal(a.w.alphas[i], b.w.alphas[i]); assert.equal(P[i * 3], b.w.positions[i * 3]); }
    else if (b.w.alphas[i] > 0) { cleared++; assert.ok(!inView, 'a point left clear is out of the view'); }
  }
  assert.ok(drawnA > 50 && cleared > 20, `${drawnA} drawn, ${cleared} out of the view left clear`);
});
