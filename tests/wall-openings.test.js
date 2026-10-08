// Old walls' hairline cracks keep clear of windows, doors and what is fixed on a wall (src/wall-openings.js,
// materials.js weatherInk; docs/systems/materials.md, "Weathered walls: hairline cracks").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WallOpenings, OPENINGS, OPENINGS_GLSL, openingBit, wallOpenings } from '../src/wall-openings.js';
import { makeMaterial, WEATHER } from '../src/materials.js';
import { RoomKit } from '../src/levels/lab-kit.js';

// a wall in the plane z = 0 facing +z, a window 0.6 × 0.8 m standing 0.3 m proud of it, its centre 2 m up
const windowBox = () => new THREE.Box3(new THREE.Vector3(-0.3, 1.6, -0.05), new THREE.Vector3(0.3, 2.4, 0.3));
// a crack's points on the wall's face (as weatherInk samples them: its ends and between), straight up at x
const crack = (x, y0 = 0.6, len = 2.3, n = WEATHER.samples) => Array.from({ length: n }, (_, i) => [x, y0 + len * i / (n - 1), 0]);

test('a crack near a window is left out; one clear of it by the margin is kept', () => {
  const o = new WallOpenings();
  assert.ok(o.clear(crack(0)), 'no openings: every crack is kept');
  assert.ok(o.addBox(windowBox()));
  assert.ok(!o.clear(crack(0)), 'through the window');
  assert.ok(!o.clear(crack(0.3 + OPENINGS.margin * 0.6)), 'beside it, inside the margin');
  assert.ok(!o.clear(crack(-0.3 - OPENINGS.margin * 0.9)), 'on its other side, inside the margin');
  assert.ok(o.clear(crack(0.3 + OPENINGS.margin + OPENINGS.voxel + 0.01)), 'past the margin and a voxel: kept');
  assert.ok(o.clear(crack(0, 2.4 + OPENINGS.margin + OPENINGS.voxel + 0.01, 1.5)), 'above it: kept');
  assert.ok(!o.clear(crack(0, 2.4 + 0.1, 1.5)), 'starting just over its head: out');
  // every point within the margin of the box, on the wall's face, is marked (a false hit only leaves a crack out)
  for (let x = -0.3 - OPENINGS.margin + 0.01; x < 0.3 + OPENINGS.margin; x += 0.05)
    for (let y = 1.6 - OPENINGS.margin + 0.01; y < 2.4 + OPENINGS.margin; y += 0.05) assert.ok(o.has(x, y, 0), `${x.toFixed(2)}, ${y.toFixed(2)}`);
  assert.ok(o.fill < 1e-4, `the table stays almost empty: ${o.fill}`);
});

test('only the pieces on a wall count: not the weathered wall itself, not a wall, roof or floor', () => {
  const o = new WallOpenings(), dark = makeMaterial({ color: '#34405e', flat: true, key: 't.open.dark' });
  const wall = makeMaterial({ color: '#f0d7c3', flat: true, weathered: true, key: 't.open.wall' });
  assert.ok(!o.addGeometry(new THREE.BoxGeometry(0.6, 0.8, 0.3), wall), 'a weathered piece is the wall');
  assert.ok(!o.addGeometry(new THREE.BoxGeometry(12, 6, 0.4), dark), 'a 12 m slab is a wall of its own');
  assert.ok(!o.addGeometry(new THREE.BoxGeometry(5, 5, 5), dark), 'a 5 m cube is a building');
  assert.ok(o.addGeometry(new THREE.BoxGeometry(1.2, 2, 0.3).translate(4, 1, 0), dark), 'a door');
  assert.ok(o.has(4, 1, 0) && !o.has(-4, 1, 0));
  // a mesh of its own (home's round window), found once the world is up; the weathered wall round it is not
  const scene = new THREE.Scene(), win = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), dark);
  win.position.set(10, 3, -2); scene.add(win);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wall).translateX(-10));
  o.collectScene(scene);
  assert.ok(o.has(10, 3, -2) && o.has(10.6, 3.5, -2), 'the window and round it');
  assert.ok(!o.has(-10, 0, 0), 'the weathered box is wall, not an opening');
});

test('the kits hand their pieces in where they stand in the world', () => {
  wallOpenings.reset();
  const group = new THREE.Group(); group.position.set(100, 0, 50);
  const kit = new RoomKit({ group, centre: new THREE.Vector3(100, 0, 50) });
  const wall = kit.mat({ color: '#f0d7c3', flat: true, weathered: true }), dark = kit.mat({ color: '#34405e', flat: true });
  kit.add(wall, new THREE.BoxGeometry(10, 6, 1).translate(0, 3, 0));
  kit.add(dark, new THREE.BoxGeometry(0.6, 0.8, 0.3).translate(2, 3, 0.55));
  kit.finish();
  assert.ok(wallOpenings.has(102, 3, 50.5), 'the window, in the world');
  assert.ok(!wallOpenings.has(2, 3, 0.5), 'not where it was laid in the room');
  assert.ok(!wallOpenings.has(97, 3, 50.5), 'the wall itself is free to crack');
  wallOpenings.reset();
});

test('the shader asks the same table: one hash, one bit layout', async () => {
  // the bits are spread (no two neighbours share a byte by rule) and the same in JS and GLSL
  const a = openingBit(0, 0, 0), b = openingBit(1, 0, 0), c = openingBit(0, 1, 0);
  assert.ok(a !== b && b !== c && a !== c);
  assert.ok(openingBit(-5, 3, 7) === openingBit(-5, 3, 7) && openingBit(-5, 3, 7) < OPENINGS.side ** 2 * 32);
  for (const k of ['73856093u', '19349663u', '83492791u', '0x7feb352du', '0x846ca68bu', `+ ${OPENINGS.offset}`, `t % ${OPENINGS.side}u`])
    assert.ok(OPENINGS_GLSL.includes(k), k);
  const { readFile } = await import('node:fs/promises');
  const js = await readFile(new URL('../src/wall-openings.js', import.meta.url), 'utf8');
  for (const k of ['73856093', '19349663', '83492791', '0x7feb352d', '0x846ca68b']) assert.ok(js.split(k).length >= 3, `${k} in both twins`);
  // the table on the GPU: RGBA8, 32 bits a texel, read as the JS writes it
  const o = new WallOpenings(); o.addBox(windowBox());
  const tex = o.texture();
  assert.equal(tex.image.width, OPENINGS.side); assert.equal(tex.image.data.length, OPENINGS.side ** 2 * 4);
  assert.ok(OPENINGS_GLSL.includes('c[int((b >> 3u) & 3u)]') && OPENINGS_GLSL.includes('(byteV >> (b & 7u)) & 1u'));
});

test('a crack is drawn whole or not at all: every opening check comes before its ink', () => {
  const f = makeMaterial({ color: '#c8a888', weathered: 1, key: 't.open.f' }).fragmentShader;
  const body = f.slice(f.indexOf('float weatherInk('), f.indexOf('#ifdef S_DETAIL', f.indexOf('float weatherInk(')));
  const ink = body.indexOf('float ink = max(inkLine');
  assert.ok(ink > 0);
  const checks = [...body.matchAll(/wallOpenAt\(/g)].map((m) => m.index);
  assert.ok(checks.length >= 4, 'its points along it, its branches\' ends and the pixel');
  assert.ok(checks.every((i) => i < ink), 'all before any ink');
  assert.ok(body.includes(`i < ${WEATHER.samples}`), 'its points along it');
  // a façade's own drawn windows are openings too (facade(): the window, shutters and sill, grown by the margin)
  const fac = makeMaterial({ color: '#c8a888', pattern: 'facade', windows: 0.3, key: 't.open.fac' }).fragmentShader;
  assert.ok(fac.includes('bool wallOpenAt(vec3 p, vec3 nv)') && fac.includes(`abs(c.x) < ${(0.31 + OPENINGS.margin / 3).toFixed(3)}`));
  assert.ok(!fac.includes('a crack running out from a corner of the odd window'), 'no crack starts at a window any more');
});
