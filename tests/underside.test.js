import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { RoomKit } from '../src/levels/lab-kit.js';
import { sheetAt, sheetPlane } from '../src/levels/reference-underside.js';
import { slab, lobesFor, pod, deck, banner, basket, lamp, stoneStair, cloudPuffs, town, framed, underMats, UNDER_LOOK, UNDER_DAY } from '../src/levels/underside-kit.js';
import { mulberry32 } from '../src/noise.js';

const finite = (g) => { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false; return true; };
const box = (list) => { const b = new THREE.Box3(); for (const g of [list].flat()) { g.computeBoundingBox(); b.union(g.boundingBox); } return b; };

test('the Underside\'s pictures: four views, one per picture, in the References', async () => {
  const k = worldIndex('underside');
  assert.ok(k >= 0, 'a References world');
  assert.equal(REFERENCE_WORLDS[k].name, 'The Underside');
  const w = await loadWorld(k);
  assert.equal(w.views.length, 4);
  assert.deepEqual(w.views.map((v) => v.sheet), ['underside-1', 'underside-2', 'underside-3', 'underside-4']);
  for (const v of w.views) {
    const S = w.sheets[v.sheet];
    assert.ok(S.name.startsWith('The Underside / '), 'the quick menu groups it under the world');
    assert.deepEqual(S.size, [1456, 816]);
    assert.deepEqual(v.crop, [0, 0, 1456, 816], 'the whole picture');
    assert.ok(v.sun.side < -90, 'lit from the left and behind, as the pictures light the shelf\'s face');
  }
  assert.equal(UNDER_DAY.length, 5);
  assert.equal(UNDER_LOOK.uClouds, 0, 'the cloud is below, not drawn in the sky');
});

test('the views build: the shelf, its town, the cloud below, the traveller on his stair', async () => {
  const w = await loadWorld(worldIndex('underside'));
  for (const v of w.views) {
    const group = new THREE.Group(), kit = new RoomKit({ group, ground: { heightAt: v.ground.height, baseAt: v.ground.height }, centre: new THREE.Vector3(), seed: 1 });
    v.build(kit, v); kit.finish();
    group.updateMatrixWorld(true);
    const all = new THREE.Box3().setFromObject(group);
    assert.ok(all.max.y > 40 && all.min.y < -100, `${v.id}: from the shelf's top down to the cloud`);
    assert.ok(group.children.length < 60, `${v.id}: merged by material (${group.children.length} meshes)`);
    assert.ok(kit.lights.length > 10, `${v.id}: lamps by the doors and under the decks`);
  }
});

test('placed off the pictures\' pixels: a point drawn at a pixel is seen there', () => {
  const cam = { eye: [0, 0, 0], fov: 50, horizon: 0.54 };
  const c = new THREE.PerspectiveCamera(50, 1456 / 816, 0.1, 5000);
  const t = Math.tan(25 * Math.PI / 180), pitch = Math.atan((0.54 - 0.5) * 2 * t);
  c.lookAt(new THREE.Vector3(0, Math.sin(pitch), -Math.cos(pitch)));
  c.updateMatrixWorld(true);
  for (const [px, py] of [[100, 100], [728, 408], [1300, 700]]) {
    for (const p of [sheetAt(cam, px, py, 80), sheetPlane(cam, px, py, py < 440 ? 40 : -30)]) {
      const q = p.clone().project(c), x = (q.x + 1) / 2 * 1456, y = (1 - q.y) / 2 * 816;
      assert.ok(Math.abs(x - px) < 1 && Math.abs(y - py) < 1, `pixel (${px}, ${py}) → (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
  }
});

test('the kit: a shelf of rock, flat on top, lobes under it, its tip pinched on its back only', () => {
  const g = slab({ sx: 120, sy: 24, sz: 80, lobes: lobesFor({ sx: 120, sz: 80, n: 6, h: [4, 6] }), tip: 0.5, pinch: -1, seed: 3 });
  assert.ok(finite(g));
  const b = box(g);
  assert.ok(Math.abs(b.max.y - 24) < 0.6, 'its top at its height (flat: walked on)');
  assert.ok(b.min.y < -2, 'lobes hanging under it');
  assert.ok(b.max.x > 55 && b.max.x < 66 && b.max.z > 38, 'as long and as deep as asked (give or take its ledges)');
  // the top really is flat: the highest points of a strip across its middle
  const p = g.attributes.position;
  let top = -Infinity, low = Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 30 && Math.abs(p.getZ(i)) < 20 && p.getY(i) > 20) { top = Math.max(top, p.getY(i)); low = Math.min(low, p.getY(i)); }
  assert.ok(top - low < 0.4, `flat on top (${(top - low).toFixed(2)} m of play)`);
});

test('the kit: houses like swallows\' nests, timber decks, banners, baskets, lamps, a stair', () => {
  for (const kind of ['dome', 'egg', 'drop', 'bulb']) {
    const P = pod({ r: 5, h: 10, kind, seed: 2 });
    assert.ok(P.plaster.length >= 1 && P.plaster.every(finite), kind);
    const b = box(P.plaster);
    assert.ok(Math.abs(b.min.y) < 0.2 && b.max.y > 9.5, `${kind}: from its foot to its crown`);
    assert.ok(P.dark.length + P.glow.length >= 3, `${kind}: windows`);
  }
  const D = deck({ x0: 0, x1: 12, z0: -6, z1: 3, y: 5, up: (x, z) => (z < -1 ? 12 : -Infinity), seed: 1 });
  assert.ok(D.planks.length >= 20 && D.planks.every(finite));
  assert.ok(D.rods.length > 0, 'hung on rods where the rock is overhead');
  for (const r of D.rods) { r.computeBoundingBox(); assert.ok(r.boundingBox.max.z < -0.5, 'and nowhere else'); }
  const B = banner([0, 10, 0], [4, 10, 0], 20);
  B.cloth.computeBoundingBox();
  assert.ok(B.cloth.boundingBox.min.y < -9 && finite(B.cloth), 'it falls');
  assert.ok(basket(0, 0, 0).wicker.length === 2 && lamp(0, 2, 0, 4).rope.length === 1);
  const S = stoneStair({ y0: 0, y1: 4, w: 3 });
  assert.equal(S.step.length, 20);
  assert.ok(Math.abs(S.top[1] - 4) < 1e-9 && S.top[2] < -8, 'climbing toward -z');
  const sr = box(S.rock);
  assert.ok(sr.max.z < 0.05 && sr.min.z < -8, 'the rock under the flight, not behind its foot');
  const C = cloudPuffs({ y: -100, n: 40, seed: 1 });
  assert.ok(C.length > 80 && C.every((c) => Number.isFinite(c.x) && c.s > 0));
});

test('the kit: a town hung under a face, its decks under the rock and its houses on them', () => {
  const group = new THREE.Group(), kit = new RoomKit({ group, centre: new THREE.Vector3(), seed: 1 });
  const M = underMats(kit), fk = framed(kit, 10, 0, -20, 0.3);
  const T = town(fk, M, mulberry32(5), { x0: 0, x1: 80, yU: 20, faceTop: 46, levels: [16, 10], out: [5, 6], under: [24, 10] });
  assert.ok(T.decks.length >= 3, `decks (${T.decks.length})`);
  assert.ok(T.decks.every((d) => d.z0 < -1 && d.z1 > 1), 'from under the shelf out past its face');
  assert.ok(T.pods.length > 2);
  kit.finish();
  assert.ok(group.children.length > 10 && group.children.length < 50);
});
