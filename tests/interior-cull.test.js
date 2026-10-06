import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { InteriorCuller } from '../src/perf.js';

// A map with a room built a kilometre over it (as the desert's cave): the ground, a town and a person
// on the map; the room's shell, a second room through its far door, a pool and a figure inside.
function world() {
  const scene = new THREE.Scene();
  const add = (geo, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.position.set(x, y, z); parent.add(m); return m; };
  const ground = add(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), 0, 0, 0);
  const town = add(new THREE.BoxGeometry(20, 12, 20), 40, 6, 30);
  const tall = add(new THREE.BoxGeometry(4, 120, 4), -60, 60, 0);   // a mesa's needle: tall, but on the map
  const room = add(new THREE.SphereGeometry(30, 12, 8), 0, 1000, 0);
  const next = add(new THREE.BoxGeometry(14, 6, 14), 0, 1000, -48);   // the next room along, through the far door
  const pool = add(new THREE.CircleGeometry(8, 16).rotateX(-Math.PI / 2), 0, 999, 0);
  const farRoom = add(new THREE.BoxGeometry(10, 5, 10), 900, 1000, 900);   // another room off the map, elsewhere
  // people: one on the map, one in the room (they move: never part of a room's extent)
  const walker = add(new THREE.BoxGeometry(0.6, 1.8, 0.4), 10, 1, 10); walker.userData.dynamic = true;
  const guest = add(new THREE.BoxGeometry(0.6, 1.8, 0.4), 4, 1000, 6); guest.userData.dynamic = true;
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 5000);
  scene.updateMatrixWorld(true);
  return { scene, camera, ground, town, tall, room, next, pool, farRoom, walker, guest };
}
const door = new THREE.Vector3(0, 1000, 26);

test('inside a room off the map, the map and everything elsewhere is hidden; the room, the rooms beyond its door and who is with you stay', () => {
  const w = world();
  const cull = new InteriorCuller(w.scene, [door], { ground: () => 0 });
  w.camera.position.set(0, 1002, 20);
  const hidden = cull.hide(w.camera);
  for (const k of ['ground', 'town', 'tall', 'walker', 'farRoom']) assert.ok(hidden.includes(w[k]), `${k} hidden`);
  for (const k of ['room', 'next', 'pool', 'guest']) assert.ok(!hidden.includes(w[k]) && w[k].visible, `${k} drawn`);
  assert.ok(hidden.every((o) => !o.visible));
  for (const o of hidden) o.visible = true;   // (renderFrame shows them again after the frame)
  // in the next room along (found by growing the extent room by room)
  w.camera.position.set(0, 1002, -50);
  assert.ok(cull.hide(w.camera).includes(w.ground));
});

test('on the map (or flying near a room but outside it), nothing is hidden', () => {
  const w = world();
  const cull = new InteriorCuller(w.scene, [door], { ground: () => 0 });
  w.camera.position.set(0, 2, 40);
  assert.deepEqual(cull.hide(w.camera), []);
  w.camera.position.set(0, 1000, 120);   // up there, but well outside the room
  assert.deepEqual(cull.hide(w.camera), []);
  assert.equal(cull.active, null);
  const none = new InteriorCuller(w.scene, [], { ground: () => 0 });
  w.camera.position.set(0, 1002, 20);
  assert.deepEqual(none.hide(w.camera), [], 'a level without rooms off the map');
});

test('a room\'s extent leaves out what stands on the map under it, however tall, and moving things', () => {
  const w = world();
  const cull = new InteriorCuller(w.scene, [door], { ground: () => 0 });
  const box = cull.extent(cull.rooms[0]);
  assert.ok(box.containsPoint(new THREE.Vector3(0, 1000, 0)) && box.containsPoint(new THREE.Vector3(0, 1000, -50)), 'the shell and the next room');
  assert.ok(box.min.y > 900, 'nothing from the map');
  assert.ok(!box.containsPoint(new THREE.Vector3(900, 1000, 900)), 'not the other room');
});

test('what arrives while you are inside is caught on the next refresh; what leaves the room is hidden as it goes', () => {
  const w = world();
  const cull = new InteriorCuller(w.scene, [door], { ground: () => 0 });
  w.camera.position.set(0, 1002, 20);
  for (const o of cull.hide(w.camera)) o.visible = true;
  const late = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  late.position.set(50, 3, 50);
  w.scene.add(late); w.scene.updateMatrixWorld(true);
  assert.ok(cull.hide(w.camera).includes(late), 'a new mesh on the map');
  for (const o of w.scene.children) o.visible = true;
  w.guest.position.set(0, 2, 0); w.scene.updateMatrixWorld(true);   // the guest went back down
  assert.ok(cull.hide(w.camera).includes(w.guest));
});

// The push's shock front went missing in every temple: the fluid's rings and spray are instanced,
// unculled, empty at load, so their cached bounds were empty and the culler hid them in rooms.
test('effects left unculled are judged by where their instances are now, never by stale bounds', () => {
  const w = world();
  const cull = new InteriorCuller(w.scene, [door], { ground: () => 0 });
  const effect = (max) => {
    const m = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.07, 4, 16), new THREE.MeshBasicMaterial(), max);
    m.frustumCulled = false; m.count = 0; w.scene.add(m); return m;
  };
  const rings = effect(8), mapSpray = effect(8);
  const hose = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)), new THREE.MeshBasicMaterial());
  hose.frustumCulled = false; w.scene.add(hose);   // its vertices rewritten each frame where the traveller is
  rings.computeBoundingSphere(); hose.geometry.computeBoundingSphere();   // (cached while empty, as the first frame did)
  w.camera.position.set(0, 1002, 20);
  for (const o of cull.hide(w.camera)) o.visible = true;
  // a push in the room: three rings ahead of the traveller; a spray somewhere on the map below
  const at = new THREE.Matrix4();
  for (let i = 0; i < 3; i++) rings.setMatrixAt(i, at.makeTranslation(0, 1001, 14 - i * 2));
  rings.count = 3;
  mapSpray.setMatrixAt(0, at.makeTranslation(40, 2, 30)); mapSpray.count = 1;
  w.scene.updateMatrixWorld(true);
  const hidden = cull.hide(w.camera);
  assert.ok(!hidden.includes(rings) && rings.visible, 'the push\'s rings are drawn in the room');
  assert.ok(!hidden.includes(hose), 'the hose is drawn in the room');
  assert.ok(hidden.includes(mapSpray), 'a spray on the map is still hidden');
  assert.ok(hidden.includes(w.ground), 'the map is still hidden');
});

test('the game culls the map from rooms off it in every pass, and the bench can measure both ways', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const frame = main.slice(main.indexOf('function renderFrame()'), main.indexOf('// 1. shadow maps'));
  assert.match(frame, /interiorCull\.hide\(camera, frameHidden\)/, 'hidden with the other per-frame culling, before the shadow passes');
  assert.match(main, /new InteriorCuller\(scene, offMapRooms/);
  assert.match(readFileSync(new URL('../scripts/bench/passes.mjs', import.meta.url), 'utf8'), /noInterior/);
});

// The cave's other costs, once the map was gone: the magic pool and stream in the fluid's shader.
test('the fluid\'s lava sums its blobs tone by tone, with no local array indexed at run time', async () => {
  const src = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  const lava = src.slice(src.indexOf('float fluidBlob('), src.indexOf('vec3 fluidAlbedo('));
  assert.ok(lava.length > 100);
  assert.doesNotMatch(lava, /float\s+\w+\[\d+\]/, 'no float F[6]');
  assert.match(lava, /for \(int i = c; i < 12; i \+= n\)/, 'blob i joins tone i mod n');
  // the same tones as summing into F[i mod n]: every blob counted once, in its own tone
  for (let n = 1; n <= 6; n++) {
    const seen = [];
    for (let c = 0; c < Math.min(n, 6); c++) for (let i = c; i < 12; i += n) seen.push([i, c]);
    assert.deepEqual(seen.map(([i]) => i).sort((a, b) => a - b), [...Array(12).keys()]);
    for (const [i, c] of seen) assert.equal(i % n, c);
  }
});

test('the sun\'s sparkle pass runs for water that sparkles, not for the cave\'s magic pool', async () => {
  const { makeMaterial, MODE_WATER } = await import('../src/materials.js');
  const { Waters } = await import('../src/water.js');
  const { magicMaterial, magicPool } = await import('../src/story/magic-water.js');
  const scene = new THREE.Scene();
  const pool = magicPool(8, magicMaterial(1));
  pool.userData.water = true;
  scene.add(pool);
  const waters = new Waters(scene, { drops: false });
  assert.equal(waters.bodies.length, 1, 'the pool is water (you wade in it)');
  const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 5000);
  camera.position.set(0, 3, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  waters.keepCamera(camera);
  assert.equal(waters.inView, false, 'no glints to draw: no full-screen pass');
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), makeMaterial({ color: '#4c8fb0', mode: MODE_WATER }));
  lake.position.set(0, 0, -5); scene.add(lake); scene.updateMatrixWorld(true);
  waters.add(lake);
  waters.keepCamera(camera);
  assert.equal(waters.inView, true);
});
