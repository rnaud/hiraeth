// Issue #502: Lorn's lake in Unity without its shallows. The water's depth bands (pale shallows, the bed through them, the
// deep band: water-shader.js waterLook) come from the bed map src/water.js bakes; the engines never baked it (main.js does
// through waters.update), and its half floats could not cross the bridge. Now engine/game.js bakes it as main.js does, the
// mirror sends it as bytes (engine/water-bed.js) with its box and height, and Surface.shader reads the bytes back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { BED_RANGE, fromHalf, bedByte, bedFromByte, bedBytes } from '../engine/water-bed.js';
import { SceneMirror, LIVE_VECTORS } from '../engine/mirror.js';
import { makeMaterial, MODE_WATER } from '../src/materials.js';
import { waterMaterial } from '../src/water-shader.js';
import { Waters } from '../src/water.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
const GAME = read('engine/game.js');

test('half floats read back as three wrote them', () => {
  for (const v of [0, 1, -1, 0.5, -0.42, -1.15, -3.4, -16, -60, 6, 2.5e-5]) assert.ok(Math.abs(fromHalf(THREE.DataUtils.toHalfFloat(v)) - v) <= Math.abs(v) * 1e-3 + 1e-7, `${v}`);
});

test('the bytes keep the shader\'s bands: within a few cm at the shallows\' edges, deep past BED_RANGE, a bank as 0', () => {
  for (const [depth, tol] of [[0.15, 0.02], [0.42, 0.03], [0.7, 0.03], [1.15, 0.04], [3.4, 0.07]]) {
    const back = -bedFromByte(bedByte(-depth));
    assert.ok(Math.abs(back - depth) < tol, `${depth} m read back as ${back.toFixed(3)}`);
  }
  assert.equal(bedFromByte(bedByte(-40)), -BED_RANGE, 'deep water: the range\'s floor, deeper than every band');
  assert.equal(bedFromByte(bedByte(3)) + 0, 0, 'a bank over the surface: depth 0, the shallows as the shader draws them');
  assert.ok(BED_RANGE > 3.4 + 0.5, 'past the deep band');
});

test('a baked map becomes RGBA bytes the backend sends, rows as they are', () => {
  const data = new Uint16Array(4 * 3);
  for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(-i * 0.5);
  const tex = new THREE.DataTexture(data, 4, 3, THREE.RedFormat, THREE.HalfFloatType);
  const b = bedBytes(tex);
  assert.equal(b.format, THREE.RGBAFormat); assert.equal(b.type, THREE.UnsignedByteType); assert.equal(b.flipY, false);
  assert.equal(b.image.data.length, 4 * 3 * 4);
  for (let i = 0; i < 12; i++) assert.equal(b.image.data[i * 4], bedByte(-i * 0.5));
  assert.equal(bedBytes(tex), b, 'once a map');
  assert.equal(bedBytes(new THREE.DataTexture(new Uint16Array(1), 1, 1, THREE.RedFormat, THREE.HalfFloatType)), null, 'the 1 × 1 "unknown" map stays home');
});

test('the mirror sends the bed map once it is baked, with its height (z 1: bytes) and its box live', () => {
  const texs = [], vecs = [];
  const mirror = new SceneMirror({ material: () => {}, materialLive: () => {}, materialVec: (mid, which, v) => vecs.push([which, ...v]), materialTexture: (mid, which, tex) => texs.push([which, tex]) });
  const scene = new THREE.Scene();
  const mat = waterMaterial(makeMaterial({ color: '#2e7f86', color2: '#5fb8b0', mode: MODE_WATER }), {});
  const water = new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), mat);
  water.position.y = 2;
  scene.add(water); scene.updateMatrixWorld(true);
  const waters = new Waters(scene, { physics: { groundAt: (x) => 2 - Math.abs(x) * 0.3 } });
  assert.equal(waters.bodies.length, 1);
  mirror.sync(scene, null); mirror.sync(scene, null);
  assert.equal(texs.length, 0, 'nothing before the bake');
  waters.bakeAll(new THREE.Vector3());
  mirror.sync(scene, null);
  assert.equal(texs.length, 1);
  assert.equal(texs[0][0], '_Bed');
  const ref = vecs.find((v) => v[0] === LIVE_VECTORS.indexOf('uBedRef'));
  assert.deepEqual(ref.slice(1).map((x) => +x.toFixed(3)), [2, 1, 1, 0], 'its height, baked, bytes');
  const box = vecs.find((v) => v[0] === LIVE_VECTORS.indexOf('uBedBox'));
  assert.ok(box && box[3] > 0, 'its box, live');
  mirror.sync(scene, null);
  assert.equal(texs.length, 1, 'once');
});

test('Unity: the live vectors in the mirror\'s order, the shader reads the bytes back, the engine bakes', () => {
  const cs = RENDERER.match(/LiveVectors = \{([^}]*)\}/)[1].split(',').map((s) => s.trim().replace(/"/g, ''));
  assert.equal(cs.length, LIVE_VECTORS.length);
  assert.equal(cs[LIVE_VECTORS.indexOf('uBedBox')], '_BedBox');
  assert.equal(cs[LIVE_VECTORS.indexOf('uBedRef')], '_BedRef');
  assert.match(SURFACE, new RegExp(`bed = _BedRef\\.x \\+ lerp\\(r, -${BED_RANGE.toFixed(1)} \\* r \\* r, _BedRef\\.z\\)`), 'the bytes\' scale, BED_RANGE');
  assert.match(GAME, /waters\.bakeStep\(player\.pos/, 'a few rows a frame, as main.js');
  assert.match(GAME, /bakeAround\(\)/, 'and at once for a fixed view');
});
