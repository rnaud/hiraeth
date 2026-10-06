// The engine bridge (docs/systems/engine-bridge.md): the browser stand-ins for an engine's VM, the
// scene mirror's ops, materials read back for the engines, the Godot data layouts, and a bundle
// of the game run in a bare V8 context (no Node, no page), as GodotJS and Puerts hold it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { SceneMirror } from '../engine/mirror.js';
import { inkSpec, plainValue } from '../engine/ink-spec.js';
import { inkParams } from '../engine/ink-params.js';
import { godotIndex, multimeshBuffer, packedBytes, VARIANT, rgbaColors } from '../engine/godot/pack.js';
import { MiniURL, SearchParams, Utf8Decoder, Utf8Encoder, publicPath } from '../engine/platform.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';

// as the game (main.js): colours are display values, not converted to linear
THREE.ColorManagement.enabled = false;

/** A backend that records every op. */
function recorder() {
  const log = [];
  const rec = (op) => (...a) => log.push([op, ...a]);
  return {
    log,
    ops: (op) => log.filter((e) => e[0] === op),
    backend: {
      geometry: rec('geometry'), material: rec('material'), create: rec('create'), visible: rec('visible'), remove: rec('remove'), camera: rec('camera'), frame: rec('frame'),
      instances: (id, count, mats) => log.push(['instances', id, count, Float32Array.from(mats.subarray(0, count * 16))]),
      transforms: (ids, mats, n) => log.push(['transforms', Array.from(ids.subarray(0, n)), Float32Array.from(mats.subarray(0, n * 16))]),
    },
  };
}

test('platform: text, URLs and the public paths the game asks for', () => {
  const s = 'Memento — été 🌵';
  assert.equal(new Utf8Decoder().decode(new Utf8Encoder().encode(s)), s);
  assert.equal(new MiniURL('../anim/x.glb', 'engine://memento/src/levels/a.js').href, 'engine://memento/src/anim/x.glb');
  assert.equal(new MiniURL('engine://m/a/b?level=desert#x').searchParams.get('level'), 'desert');
  assert.equal(new MiniURL('/x.png', 'engine://m/a/b.js').href, 'engine://m/x.png');
  assert.equal(new SearchParams('?level=desert&mh=1').get('mh'), '1');
  assert.equal(publicPath('./anim/ual.glb'), 'anim/ual.glb');
  assert.equal(publicPath('https://x.org/moebius/anim/ual.glb?v=2'.replace('/moebius', '')), 'anim/ual.glb');
});

test('platform: a bare context gets the page, keys reach window listeners, fetch reads the host', async () => {
  const { exports, ctx } = loadBundleOf(await platformBundle(), { readFile: (p) => (p === 'a.json' ? new Utf8Encoder().encode('{"x":1}').buffer : null), search: '?level=garage' });
  const page = exports.page;
  assert.equal(typeof ctx.performance.now(), 'number');
  assert.equal(typeof ctx.document.createElement('canvas').getContext('2d').fillRect, 'function');
  assert.equal(ctx.document.getElementById('health'), ctx.document.getElementById('health'), 'the same element each time');
  const seen = [];
  ctx.addEventListener('keydown', (e) => seen.push(e.code));
  page.dispatch('keydown', { code: 'KeyW' });
  assert.deepEqual(seen, ['KeyW']);
  assert.equal(JSON.stringify(await (await ctx.fetch('./a.json')).json()), '{"x":1}');   // (an object of the other realm)
  assert.equal((await ctx.fetch('missing.bin')).ok, false);
  let ran = 0;
  ctx.requestAnimationFrame(() => ran++);
  page.tick(16);
  assert.equal(ran, 1);
  ctx.localStorage.setItem('k', 'v');
  assert.equal(ctx.localStorage.getItem('k'), 'v');
});

test('mirror: drawables once, transforms only when they move, hidden with an ancestor, forgotten when gone', () => {
  const R = recorder();
  const mirror = new SceneMirror(R.backend, { forgetAfter: 2 });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const a = new THREE.Mesh(geo, makeMaterial({ color: '#c0a080' })), b = new THREE.Mesh(geo, a.material);
  group.add(a); scene.add(group, b);
  a.position.set(1, 2, 3);
  mirror.sync(scene, camera);
  assert.equal(R.ops('create').length, 2);
  assert.equal(R.ops('geometry').length, 1, 'a shared geometry goes over once');
  assert.equal(R.ops('material').length, 1, 'a shared material once');
  const [, ids, mats] = R.ops('transforms')[0];
  assert.equal(ids.length, 2);
  assert.deepEqual(Array.from(mats.subarray(12, 15)), [1, 2, 3]);
  // nothing moved: no transforms
  R.log.length = 0;
  mirror.sync(scene, camera);
  assert.equal(R.ops('transforms').length, 0);
  // the parent moves: only its child's world matrix is sent
  group.position.x = 5;
  mirror.sync(scene, camera);
  assert.deepEqual(R.ops('transforms')[0][1], [mirror.idOf(a)]);
  // hidden with its group, then removed after leaving the scene
  R.log.length = 0;
  group.visible = false;
  mirror.sync(scene, camera);
  assert.deepEqual(R.ops('visible'), [['visible', mirror.idOf(a), false]]);
  const idA = mirror.idOf(a);
  group.remove(a);
  for (let i = 0; i < 4; i++) mirror.sync(scene, camera);
  assert.deepEqual(R.ops('remove'), [['remove', idA]]);
  assert.equal(mirror.idOf(a), 0);
  // a geometry rewritten is sent again
  R.log.length = 0;
  b.geometry.attributes.position.needsUpdate = true;
  mirror.sync(scene, camera);
  assert.equal(R.ops('geometry').length, 1);
  assert.ok(R.ops('camera').length && R.ops('frame').length);
});

test('mirror: instanced meshes send their instances when they change', () => {
  const R = recorder();
  const mirror = new SceneMirror(R.backend);
  const scene = new THREE.Scene();
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(), makeMaterial({ color: '#888' }), 4);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 4; i++) im.setMatrixAt(i, m.makeTranslation(i, 0, 0));
  scene.add(im);
  mirror.sync(scene, null);
  assert.equal(R.ops('instances').length, 1);
  assert.equal(R.ops('instances')[0][2], 4);
  mirror.sync(scene, null);
  assert.equal(R.ops('instances').length, 1, 'unchanged: not sent again');
  im.setMatrixAt(2, m.makeTranslation(9, 0, 0)); im.instanceMatrix.needsUpdate = true;
  mirror.sync(scene, null);
  assert.equal(R.ops('instances').length, 2);
  assert.equal(R.ops('instances')[1][3][2 * 16 + 12], 9);
});

test('ink spec: makeMaterial read back as plain numbers, the shared uniforms left out', () => {
  const m = makeMaterial({ color: '#ff8000', color2: '#0000ff', mode: MODE_STRATA, strataSize: 6, glow: 0.5, metal: 'steel' });
  const s = inkSpec(m);
  assert.equal(s.type, 'ink');
  assert.ok(Math.abs(s.u.uColor[0] - 1) < 1e-6 && Math.abs(s.u.uColor[1] - 0.502) < 0.01);
  assert.equal(s.u.uMode, MODE_STRATA);
  assert.equal(s.u.uStrataSize, 6);
  assert.equal(s.u.uSunDir, undefined, 'the sun is the frame\'s');
  assert.ok(JSON.stringify(s).length < 20000, 'plain data');
  const p = inkParams(s);
  assert.equal(p.mode, MODE_STRATA);
  assert.equal(p.glow, 0.5);
  assert.equal(p.hatch_k, 0.35, 'metal keeps few strokes');
  assert.deepEqual(plainValue(new THREE.Vector3(1, 2, 3)), [1, 2, 3]);
  assert.deepEqual(plainValue([new THREE.Color(1, 0, 0), new THREE.Color(0, 1, 0)]), [1, 0, 0, 0, 1, 0]);
  const basic = inkSpec(new THREE.MeshBasicMaterial({ color: '#00ff00', transparent: true, opacity: 0.5 }));
  assert.equal(basic.type, 'basic');
  assert.equal(basic.opacity, 0.5);
});

test('godot layouts: winding swapped, instances as 3×4 rows, packed arrays as var_to_bytes writes them', () => {
  assert.deepEqual(Array.from(godotIndex(new Uint16Array([0, 1, 2, 2, 3, 0]), 4)), [0, 2, 1, 2, 0, 3]);
  assert.deepEqual(Array.from(godotIndex(null, 6, 3)), [3, 5, 4]);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(7, 8, 9), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1));
  const buf = multimeshBuffer(Float32Array.from(m.elements), 1);
  // row 0: basis.x.x, basis.y.x, basis.z.x, origin.x (a quarter turn about y: x → -z)
  assert.ok(Math.abs(buf[0]) < 1e-6 && Math.abs(buf[2] - 1) < 1e-6 && buf[3] === 7 && buf[7] === 8 && buf[11] === 9);
  const bytes = packedBytes(VARIANT.PACKED_VECTOR3, new Float32Array([1, 2, 3, 4, 5, 6]), 2);
  const dv = new DataView(bytes);
  assert.equal(dv.getUint32(0, true), 36);
  assert.equal(dv.getUint32(4, true), 2);
  assert.equal(dv.getFloat32(8 + 5 * 4, true), 6);
  const c = rgbaColors({ itemSize: 3, normalized: true, array: new Uint8Array([255, 0, 51]) }, 1);
  assert.deepEqual(Array.from(c).map((x) => +x.toFixed(2)), [1, 0, 0.2, 1]);
});

test('a bundle of the game runs in a bare V8 context: a world built and mirrored', async () => {
  const file = join(tmpdir(), `memento-engine-spike-${process.pid}.js`);
  await bundle('spike', { input: 'engine/spike.js', out: [file] });
  const { exports, ctx } = loadBundle(file);
  assert.equal(ctx.process, undefined, 'no Node');
  assert.equal(typeof ctx.document.createElement, 'function');
  const R = recorder();
  const quietLog = console.warn; console.warn = () => {};
  let r;
  try { r = exports.buildSpike({ levelId: 'garage', backend: R.backend }); } finally { console.warn = quietLog; }
  assert.ok(r.stats.drawn > 50, `drew ${r.stats.drawn}`);
  assert.equal(R.ops('create').length, r.stats.drawn);
  assert.ok(R.ops('material').length > 5);
  assert.ok(R.ops('material').every(([, , spec]) => typeof spec.type === 'string' && spec.u && typeof spec.u === 'object'));
});

// ---------------------------------------------------------------- helpers
let platformFile = null;
async function platformBundle() {
  if (platformFile) return platformFile;
  platformFile = join(tmpdir(), `memento-engine-boot-${process.pid}.js`);
  await bundle('spike', { input: 'engine/boot.js', out: [platformFile] });
  return platformFile;
}
function loadBundleOf(file, host) { return loadBundle(file, host); }
