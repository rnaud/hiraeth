import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { RoomKit } from '../src/levels/lab-kit.js';
import { sheetRay, sheetPlane } from '../src/levels/reference-overnighttrain.js';
import { TR, profile, shell, endWall, nose, bogie, porch, dustPuffs, pennant, pennantWave, train, trainMats, TRAIN_LOOK, TRAIN_NIGHT, TRAIN_DAY, TRAIN_DUSK, windowRow } from '../src/levels/overnight-train-kit.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const box = (list) => { const b = new THREE.Box3(); for (const g of [list].flat()) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };
const kitOf = () => { const group = new THREE.Group(); return { group, kit: new RoomKit({ group, centre: new THREE.Vector3(), seed: 1 }) }; };

test('the Overnight Train\'s pictures: four views, one per picture, in the References', async () => {
  const k = worldIndex('overnighttrain');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Overnight Train');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['overnighttrain-1', 'overnighttrain-2', 'overnighttrain-3', 'overnighttrain-4']);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Overnight Train / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.ok(v.sun.el < 8, 'dusk: the sun low');
    // the eye low on the plain, as the pictures look from (solved from the nose's two points)
    assert.ok(v.camera.eye[1] > 0.2 && v.camera.eye[1] < 3, `${v.id}: the eye ${v.camera.eye[1].toFixed(2)} m up`);
    assert.ok(v.camera.d > 10 && v.camera.d < 80, `${v.id}: the nose ${v.camera.d.toFixed(0)} m off`);
    assert.ok(v.ground.hidden, 'the scene lays its own plain');
  }
  for (const pal of [TRAIN_DAY, TRAIN_DUSK, TRAIN_NIGHT]) assert.equal(pal.length, 5);
  assert.equal(TRAIN_LOOK.uDots, 0, 'no pen dots on the plain (they would stand still while it runs past)');
});

test('the pictures\' pixels: a ray through a pixel and back', () => {
  const cam = { eye: [0, 1.2, 0], fov: 40, horizon: 0.7 };
  const p = sheetPlane(cam, 900, 700, 0);
  assert.ok(Math.abs(p.y) < 1e-9 && p.z < 0, 'below the horizon: on the plain ahead');
  const r = sheetRay(cam, 728, 0.7 * 816);
  assert.ok(Math.abs(r.y) < 1e-6, 'the horizon\'s pixel looks level');
});

test('the views build: the train, its lit lounge, the dust, the two moons, the streaked plain', async () => {
  const w = await loadWorld(worldIndex('overnighttrain'));
  for (const v of w.views) {
    const group = new THREE.Group(), kit = new RoomKit({ group, ground: { heightAt: v.ground.height, baseAt: v.ground.height }, centre: new THREE.Vector3(), seed: 1 });
    v.build(kit, v); kit.finish();
    group.updateMatrixWorld(true);
    let meshes = 0, moons = 0, dust = 0;
    group.traverse((o) => { if (!o.isMesh) return; meshes++; assert.ok(finite(o.geometry), `${v.id}: finite`); if (o.material.uniforms?.uColor && `#${o.material.uniforms.uColor.value.getHexString()}` === '#fff4e0') moons++; if (o.isInstancedMesh) dust += o.count; });
    assert.ok(meshes < 60, `${v.id}: merged by material (${meshes} meshes)`);
    assert.equal(moons, 1, `${v.id}: the moons (one mesh)`);
    assert.ok(dust > 150, `${v.id}: the dust (${dust} puffs)`);
    assert.ok(kit.lights.length >= 8, `${v.id}: the lounge's lamps light it`);
  }
});

test('the kit: a carriage\'s shell, open at its windows; its ends, its nose, its wheels', () => {
  const P = profile();
  for (let i = 1; i < P.out.length; i++) assert.ok(P.out[i][1] > P.out[i - 1][1], 'the profile climbs from the skirt to the crown');
  assert.equal(P.out.at(-1)[0], 0, 'to the crown in the middle');
  assert.ok(P.out[P.SILL][1] === TR.sill && P.out[P.HEAD][1] === TR.head);
  const win = windowRow(-10, 10, 2.5, 1.2);
  assert.equal(win.length, 8);
  const open = shell({ x0: -12, x1: 12, windows: { 1: win, [-1]: win } }), shut = shell({ x0: -12, x1: 12, windows: { 1: win, [-1]: win }, panes: true });
  assert.ok(open.frame?.length && !open.pane && shut.pane?.length && !shut.panel, 'reveals through the open ones; panes and no inside in the closed');
  // a ray straight through a window's middle meets no skin
  const scene = new THREE.Scene();
  for (const g of [...open.hull, ...open.panel, ...open.wain, ...open.ceil]) scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  scene.updateMatrixWorld(true);
  const mid = (win[3][0] + win[3][1]) / 2, y = TR.floor + (TR.sill + TR.head) / 2;
  assert.equal(new THREE.Raycaster(new THREE.Vector3(mid, y, 6), new THREE.Vector3(0, 0, -1), 0, 3.1).intersectObjects(scene.children).length, 0, 'a window is open');
  assert.ok(new THREE.Raycaster(new THREE.Vector3(mid + 1.25, y, 6), new THREE.Vector3(0, 0, -1), 0, 4).intersectObjects(scene.children).length > 0, 'a pillar between two is not');
  const E = endWall(12, 1), b = box(E.hull);
  assert.ok(b.max.x <= 12 + 1e-6 && b.min.x >= 12 - TR.wall - 1e-6, 'the end wall stands inside the carriage');
  const N = nose(12);
  assert.ok(box(N.floor).max.x > 15, 'the balcony juts out past the nose');
  assert.ok(N.rail.length > 20 && N.hull.every(finite) && N.roof.every(finite));
  const B = bogie(0, { r: 0.85, axles: 3, spokes: true });
  assert.equal(B.wheels.length, 6);
  assert.ok(B.wheels.every((w) => Math.abs(w.y - w.r - TR.rail) < 1e-9), 'the wheels on the rails');
  assert.ok(Math.max(...B.wheels.map((w) => w.y + w.r)) <= TR.floor, 'under the floor');
  const Pc = porch(12, 1);
  assert.equal(Pc.ladder.length, 1);
  assert.ok(Pc.ladder[0].y1 > TR.floor + TR.crown - 0.5, 'the ladder up to the roof');
});

test('the kit: the whole train, the dust behind it, the pennants in the wind', () => {
  const { kit } = kitOf(), M = trainMats(kit);
  const T = train(kit, M, [{ kind: 'prow', roof: 'garden', pennants: [[0, 0, 3, 6]] }, { kind: 'dome', roof: 'terrace' }, { kind: 'coach' }], { x: 0 });
  assert.equal(T.cars.length, 3);
  for (let i = 1; i < T.cars.length; i++) assert.ok(Math.abs(T.cars[i - 1].x0 - T.cars[i].x1 - TR.gap) < 1e-9, 'the gaps between carriages');
  assert.equal(T.terraces.length, 1, 'the dome carriage\'s terrace');
  assert.equal(T.pennants.length, 1);
  const puffs = dustPuffs({ x0: 0, x1: T.xTail, trail: 100 });
  assert.ok(puffs.length > 100 && puffs.every((p) => Number.isFinite(p.x + p.y + p.z + p.s)));
  const back = puffs.filter((p) => p.x < T.xTail - 50), front = puffs.filter((p) => p.x > -10);
  assert.ok(back.reduce((m, p) => m + p.s, 0) / back.length > 2 * front.reduce((m, p) => m + p.s, 0) / front.length, 'heaped up behind');
  const g = pennant(0, 5, 0, { L: 6 }), z0 = g.attributes.position.getZ(30);
  pennantWave(g, 1.3, 1);
  assert.notEqual(g.attributes.position.getZ(30), z0, 'it waves');
  assert.ok(finite(g));
});
