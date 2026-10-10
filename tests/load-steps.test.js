import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A world's load in steps (src/load-steps.js): generators run straight through for tests and the
// studio, a slice at a time for the game; the builds that used to be one long task (the terrain, the
// collision bake, the levels themselves) give the same result either way.

globalThis.window ??= { addEventListener() {} };
const { runSteps, runStepsAsync, slicer, stepped, yieldTask } = await import('../src/load-steps.js');
const { Terrain } = await import('../src/world.js');
const { Physics } = await import('../src/physics.js');

test('runSteps: straight through, the value sent back in; a promise is refused', () => {
  function* g() { const a = yield 1; const b = yield 2; return [a, b]; }
  assert.deepEqual(runSteps(g()), [1, 2], 'each yielded value comes back');
  assert.throws(() => runSteps((function* () { yield Promise.resolve(); })()), /promise/);
  const create = stepped(function* (x) { yield; return x * 2; });
  assert.equal(create(21), 42, 'stepped(): a sync create from a build');
});

test('runStepsAsync: gives the main thread back once a slice has run its budget, waits for promises', async () => {
  const slice = slicer(5);
  let busy = 0;
  function* work() {
    for (let i = 0; i < 40; i++) { const t = performance.now(); while (performance.now() - t < 1) { busy++; } yield; }
    const v = yield new Promise((r) => setTimeout(() => r('late'), 5));
    return v;
  }
  let other = 0;
  const tick = setInterval(() => other++, 0);
  const out = await runStepsAsync(work(), slice);
  clearInterval(tick);
  assert.equal(out, 'late', 'a yielded promise is awaited and its value sent back');
  assert.ok(slice.slices >= 5, `about every 5 ms of work it yields (${slice.slices} times over ~40 ms)`);
  // generous: on a loaded machine the OS can preempt a 1 ms step for tens of ms
  assert.ok(slice.longest < 250, `no slice ran long (${slice.longest.toFixed(1)} ms)`);
  assert.ok(other > 0, 'other tasks ran in between');
  await yieldTask();
});

test('Terrain.make: the same ground as new Terrain, built a row a step', () => {
  const height = (x, z) => Math.sin(x * 0.01) * 20 + Math.cos(z * 0.013) * 15;
  const a = new Terrain({ size: 400, seg: 40, height });
  const g = Terrain.make({ size: 400, seg: 40, height });
  let r = g.next(), steps = 0;
  while (!r.done) { steps++; r = g.next(); }
  const b = r.value;
  assert.ok(b instanceof Terrain && steps > 40, `a Terrain, in ${steps} steps`);
  assert.deepEqual([...b.heights], [...a.heights]);
  assert.equal(b.heightAt(13, -71), a.heightAt(13, -71));
  assert.deepEqual([...b.mesh.geometry.attributes.normal.array.slice(0, 30)], [...a.mesh.geometry.attributes.normal.array.slice(0, 30)]);
});

test('the collision bake, in steps: the same triangles as mergeGeometries made', async () => {
  const scene = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3)); box.position.set(5, 0, 1); box.rotation.y = 0.4; scene.add(box);
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).toNonIndexed()); flat.rotation.x = -Math.PI / 2; scene.add(flat);
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial(), 3);
  for (let i = 0; i < 3; i++) inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 2, 1, -3));
  scene.add(inst);
  const sync = new Physics(scene);
  const sliced = await Physics.create(scene, null, slicer(0));
  assert.equal(sliced.triangles, sync.triangles);
  assert.deepEqual([...sliced.geometry.attributes.position.array], [...sync.geometry.attributes.position.array]);
  // and what the old bake made: mergeGeometries of the same pieces
  scene.updateMatrixWorld(true);
  const pieces = [box.geometry.clone().applyMatrix4(box.matrixWorld).toNonIndexed(), flat.geometry.clone().applyMatrix4(flat.matrixWorld)];
  const m = new THREE.Matrix4();
  for (let i = 0; i < 3; i++) { inst.getMatrixAt(i, m); m.premultiply(inst.matrixWorld); pieces.push(new THREE.BufferGeometry().setAttribute('position', inst.geometry.attributes.position).setIndex(inst.geometry.index).clone().applyMatrix4(m).toNonIndexed()); }
  const merged = mergeGeometries(pieces.map((g) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', g.attributes.position); return b; }));
  assert.deepEqual([...sync.geometry.attributes.position.array], [...merged.attributes.position.array]);
  assert.ok(sync.groundAt(0, 5, 0) > -0.01 && sync.groundAt(0, 5, 0) < 0.01, 'and it collides');
});

test('every world has a build in steps, and its create runs it straight through', async () => {
  // (every world still built: the route's, the merged worlds' parts on their own, the dismissed ones: src/levels/buildable.js)
  const { BUILDABLE, buildableById } = await import('../src/levels/buildable.js');
  const Gen = Object.getPrototypeOf(function* () {}).constructor;
  for (const l of BUILDABLE) assert.ok(l.build instanceof Gen, `${l.id}: build is a generator`);
  // one world both ways: the same world (the Sealed Hangar, dismissed but still built whole)
  const garage = buildableById('garage');
  const a = garage.create(new THREE.Scene());
  const s2 = new THREE.Scene();
  const b = await runStepsAsync(garage.build(s2), slicer(0));
  assert.deepEqual(b.spawn.toArray(), a.spawn.toArray());
  assert.equal(b.navigationPortals.length, a.navigationPortals.length);
  let na = 0, nb = 0;
  s2.traverse(() => nb++);
  garage.create(new THREE.Scene()).ground;   // (built again: deterministic)
  const s3 = new THREE.Scene(); garage.create(s3); s3.traverse(() => na++);
  assert.equal(nb, na, 'the same scene, object for object');
});

test('the game loads in steps; the loading screen turns on the compositor', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /meta\.build \? await runStepsAsync\(meta\.build\(scene\), slice\)/, 'the world built a slice at a time');
  assert.match(main, /Physics\.create\(scene, [^;]*, slice[,)]/, 'the collision baked a slice at a time');   // (then the level's collision settings)
  for (const step of ['spawnNPCsSteps', 'buildFloraSteps', 'tileSceneSteps', 'dropBuriedFloraSteps', 'buildPeopleSteps', 'ReactiveWorld.make', 'warmShadersSliced']) assert.ok(main.includes(step), step);
  assert.ok((main.match(/await slice\(\)/g) ?? []).length >= 20, 'and gives the main thread back between its parts');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const spin = html.match(/@keyframes spin \{([^}]*\})/)?.[1] ?? '';
  assert.match(spin, /transform/, 'the pen turns by a transform');
  assert.doesNotMatch(spin, /(width|height|top|left|margin|stroke)/, 'and nothing that needs the main thread');
  assert.match(html, /#loading \.pen \{[^}]*animation: spin/);
});
