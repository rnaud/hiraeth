// The engine bridge (docs/systems/engine-bridge.md): the browser stand-ins for an engine's VM, the
// scene mirror's ops, materials read back for the engines, the Godot data layouts, and a bundle
// of the game run in a bare V8 context (no Node, no page), as GodotJS and Puerts hold it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { SceneMirror, LIVE_VECTORS } from '../engine/mirror.js';
import { inkSpec, plainValue } from '../engine/ink-spec.js';
import { inkParams } from '../engine/ink-params.js';
import { godotIndex, multimeshBuffer, packedBytes, VARIANT, rgbaColors } from '../engine/godot/pack.js';
import { MiniURL, SearchParams, Utf8Decoder, Utf8Encoder, publicPath } from '../engine/platform.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { bundle, lowerUnicodeClasses } from '../scripts/engine-bundle.mjs';
import { readFileSync } from 'node:fs';
import { godotKeyCode, standardPad, STANDARD_FROM_GODOT } from '../engine/keys.js';
import { skinMatrices } from '../engine/skin.js';
import { lookGlobals, GLOBALS, shaderGlobalsIni } from '../engine/ink-params.js';
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

test('mirror: no false moves or uploads (doubles floats cannot hold, interleaved glTF attributes)', () => {
  const R = recorder();
  const mirror = new SceneMirror(R.backend);
  const scene = new THREE.Scene();
  const ib = new THREE.InterleavedBuffer(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]), 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
  geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 3));
  const m = new THREE.Mesh(geo, makeMaterial({ color: '#808080' }));
  m.position.set(0.1, 0.2, 0.3);   // (not floats)
  m.rotation.y = 0.7;
  scene.add(m);
  mirror.sync(scene, null);
  assert.equal(R.ops('geometry').length, 1);
  assert.deepEqual(Array.from(R.ops('geometry')[0][2].attributes.position.array), [0, 0, 0, 1, 0, 0, 0, 1, 0], 'de-interleaved');
  R.log.length = 0;
  for (let i = 0; i < 3; i++) mirror.sync(scene, null);
  assert.equal(R.ops('transforms').length, 0, 'an object standing still is not sent again');
  assert.equal(R.ops('geometry').length, 0, 'nor its interleaved geometry');
  ib.needsUpdate = true;
  mirror.sync(scene, null);
  assert.equal(R.ops('geometry').length, 1, 'until its buffer changes');
});

test('mirror: cloth sends its points alone, a new shape the whole geometry', () => {
  const R = recorder();
  const verts = [];
  R.backend.vertices = (gid, pos, nrm, n) => verts.push([gid, n, Array.from(pos.slice(0, 3))]);
  const geomOf = []; R.backend.geometryOf = (id, gid) => geomOf.push(gid);
  const mirror = new SceneMirror(R.backend);
  const scene = new THREE.Scene();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 2, 2), makeMaterial({ color: '#c0402a', side: THREE.DoubleSide }));
  scene.add(cloth);
  mirror.sync(scene, null);
  assert.equal(R.ops('geometry').length, 1);
  const P = cloth.geometry.attributes.position;
  P.setX(0, 5); P.needsUpdate = true; cloth.geometry.attributes.normal.needsUpdate = true;
  mirror.sync(scene, null);
  assert.equal(R.ops('geometry').length, 1, 'not sent whole again');
  assert.deepEqual(verts.map((v) => v[1]), [9]);
  assert.equal(verts[0][2][0], 5);
  assert.equal(geomOf.length, 0, 'the node keeps its mesh');
  // a new index: the whole geometry, and the node told
  cloth.geometry.setIndex([0, 1, 2]);
  mirror.sync(scene, null);
  assert.equal(R.ops('geometry').length, 2);
  assert.equal(geomOf.length, 1);
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

test('mirror: a mesh on an instanced geometry (the grass blades) is its own kind; its tufts go when they move, only the range rewritten', async () => {
  const { Grass, GRASS_QUALITY } = await import('../src/flora-grass.js');
  const log = [];
  const backend = {
    create: (id, d) => log.push(['create', id, d]),
    instances: (id, count, mats, colors, attrs) => log.push(['instances', id, count, mats, attrs]),
    drawState: (id, o) => log.push(['drawState', id, o]),
  };
  const mirror = new SceneMirror(backend);
  const scene = new THREE.Scene();
  const field = { heightAt: () => 0, color: '#8cc77e', color2: '#9fd08a', inside: () => true };
  const grass = new Grass({ scene, fields: [field], quality: { radius: 6, density: 2 } });   // (no far layer)
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.7, 0); camera.lookAt(0, 0, -5); camera.updateMatrixWorld();
  grass.update(camera, 0);
  mirror.sync(scene, camera);
  const made = log.filter((e) => e[0] === 'create');
  assert.equal(made.length, 1);
  assert.equal(made[0][2].kind, 'instgeo', 'not a plain mesh: one blade at the origin');
  assert.equal(made[0][2].capacity, grass.count);
  assert.deepEqual(made[0][2].attrs.sort(), ['aGrass', 'aGrass2']);
  let inst = log.filter((e) => e[0] === 'instances');
  assert.equal(inst.length, 1);
  assert.equal(inst[0][2], grass.count, 'every tuft');
  assert.equal(inst[0][3], null, 'no matrices');
  assert.equal(inst[0][4].aGrass.range, null, 'the first time: all of it');
  assert.ok(inst[0][4].aGrass2, 'and the tufts\' own turn, tint, lean and rank');
  assert.equal(log.filter((e) => e[0] === 'drawState').length, 1, 'its per-frame state each frame it is drawn');
  mirror.sync(scene, camera);
  assert.equal(log.filter((e) => e[0] === 'instances').length, 1, 'standing still: nothing sent again');
  // a step: the tufts that wrapped are placed again, and only their range goes (aGrass2 never changes)
  camera.position.x += 3; camera.updateMatrixWorld();
  grass.update(camera, 100);
  mirror.sync(scene, camera);
  inst = log.filter((e) => e[0] === 'instances');
  assert.equal(inst.length, 2);
  const a = inst[1][4].aGrass;
  assert.ok(a.range && a.range[1] > 0 && a.range[1] <= grass.count * 4, `a range: ${a.range}`);
  assert.equal(inst[1][4].aGrass2, undefined, 'the unchanged attribute not sent again');
});

test('mirror: a material\'s colour and glow, changed after it was sent, go live (the answering plants waking)', () => {
  const live = [];
  const backend = { material: () => {}, materialLive: (mid, c, g) => live.push([mid, c, g]) };
  const mirror = new SceneMirror(backend);
  const scene = new THREE.Scene();
  const base = makeMaterial({ color: '#a8c48a', flat: true });
  const m = base.clone(); m.uniforms = { ...base.uniforms, uColor: { value: new THREE.Color('#a8c48a') }, uGlow: { value: 0 } };
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m), new THREE.Mesh(new THREE.BoxGeometry(), m));
  mirror.sync(scene, null);
  mirror.sync(scene, null);
  assert.equal(live.length, 0, 'unchanged: nothing');
  m.uniforms.uColor.value.set('#f6e2a0'); m.uniforms.uGlow.value = 0.65;
  mirror.sync(scene, null);
  assert.equal(live.length, 1, 'once, however many drawables use it');
  assert.ok(Math.abs(live[0][1][0] - new THREE.Color('#f6e2a0').r) < 1e-6);
  assert.equal(live[0][2], 0.65);
});

test('mirror: the traveller\'s fluid on a material (its fill, clock and tones) goes live when it moves', () => {
  const sent = [];
  const mirror = new SceneMirror({ material: () => {}, materialLive: () => {}, materialFluid: (mid, f) => sent.push(Array.from(f)) });
  const scene = new THREE.Scene();
  const m = makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBox: [0, 1, 0.2, 0] });
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  mirror.sync(scene, null);
  assert.equal(sent.length, 1, 'as it is when first drawn');
  mirror.sync(scene, null);
  assert.equal(sent.length, 1, 'unchanged: nothing');
  m.uniforms.uFluidA.value.z = 3.5; m.uniforms.uFluidTones.value[2].set('#263c37');
  mirror.sync(scene, null);
  assert.equal(sent.length, 2);
  assert.equal(sent[1][2], 3.5, 'its clock');
  assert.ok(Math.abs(sent[1][8 + 6] - new THREE.Color('#263c37').r) < 1e-6, 'its third tone');
});

test('mirror: a makers\' box\'s ray (uBoxA) and a face\'s shape-key weights go live when they move', () => {
  const vecs = [], keys = [];
  const mirror = new SceneMirror({ material: () => {}, materialLive: () => {}, materialVec: (mid, which, v) => vecs.push([which, ...v]), keyWeights: (id, w) => keys.push(Array.from(w)) });
  const scene = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(), makeMaterial({ color: '#1d2a52', makersBox: { half: [0.4, 0.3, 0.3] } }));
  const face = new THREE.Mesh(new THREE.BoxGeometry(), makeMaterial({ color: '#c08060' }));
  face.userData.keyWeights = new Float32Array([0, 0, 0]);
  scene.add(box, face);
  mirror.sync(scene, null); mirror.sync(scene, null);
  assert.equal(vecs.length, 1, 'the box\'s vector as it is, once');
  assert.equal(keys.length, 1, 'the face\'s weights as they are, once');
  box.material.uniforms.uBoxA.value.w = 2.5; face.userData.keyWeights[1] = 0.7;
  mirror.sync(scene, null);
  assert.deepEqual(vecs[1].slice(0, 1).concat(vecs[1][4]), [0, 2.5], 'its clock');
  assert.ok(Math.abs(keys[1][1] - 0.7) < 1e-6, 'a smile');
  // a face's expression as its ink draws it (Humanoid.setExpression: uMood, uMood2): only when it moves
  const n0 = vecs.length;
  mirror.sync(scene, null);
  assert.equal(vecs.length, n0, 'nothing more while it stays');
  face.material.uniforms.uMood.value.set(0.8, 0, 0.15, 0.25); face.material.uniforms.uMood2.value.x = -0.6;
  mirror.sync(scene, null);
  const which = (k) => vecs.slice(n0).find((x) => x[0] === LIVE_VECTORS.indexOf(k));
  assert.deepEqual(Array.from(which('uMood').slice(1)).map((x) => +x.toFixed(3)), [0.8, 0, 0.15, 0.25], 'the smile, brow and squint');
  assert.equal(+which('uMood2')[1].toFixed(3), -0.6, 'the brows\' tilt');
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

test('keys and pads: Godot keys as KeyboardEvent codes, joypads as standard Gamepads', () => {
  assert.equal(godotKeyCode(87), 'KeyW');
  assert.equal(godotKeyCode(32), 'Space');
  assert.equal(godotKeyCode(4194325, 1), 'ShiftLeft');
  assert.equal(godotKeyCode(4194325, 2), 'ShiftRight');
  assert.equal(godotKeyCode(49), 'Digit1');
  assert.equal(godotKeyCode(4194320), 'ArrowUp');
  assert.equal(godotKeyCode(123456), null);
  // A (SDL 0) and Menu (SDL 6) pressed, RT (axis 5) squeezed, the left stick up
  const pad = standardPad(0, (b) => b === 0 || b === 6, (a) => (a === 5 ? 0.8 : a === 1 ? -1 : 0));
  assert.equal(pad.mapping, 'standard');
  assert.equal(pad.buttons.length, 17);
  assert.equal(pad.buttons[0].pressed, true);
  assert.equal(pad.buttons[9].pressed, true, 'Menu is standard button 9');
  assert.equal(pad.buttons[7].value, 0.8);
  assert.equal(pad.buttons[7].pressed, true);
  assert.deepEqual(pad.axes, [0, -1, 0, 0]);
  assert.equal(new Set(STANDARD_FROM_GODOT.filter((x) => x !== null)).size, 15, 'each Godot button once');
});

test('skinning: one matrix a bone gives three\'s skinned vertex', () => {
  const bones = [new THREE.Bone(), new THREE.Bone()];
  bones[1].position.set(0, 1, 0); bones[0].add(bones[1]);
  const geo = new THREE.BoxGeometry(0.2, 2, 0.2, 1, 4, 1).translate(0, 1, 0);
  const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const y = geo.attributes.position.getY(i); si[i * 4 + 1] = 1; sw[i * 4] = 1 - y / 2; sw[i * 4 + 1] = y / 2; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.position.set(3, 0, 1);
  bones[1].rotation.z = 0.6; bones[0].rotation.x = 0.2;
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  const S = skinMatrices(mesh.skeleton.boneMatrices, 2, mesh.bindMatrix.elements, mesh.bindMatrixInverse.elements);
  const M = [0, 1].map((b) => new THREE.Matrix4().fromArray(S, b * 16));
  const v = new THREE.Vector3(), want = new THREE.Vector3(), got = new THREE.Vector3(), t = new THREE.Vector3();
  for (const i of [0, 5, n - 1]) {
    v.fromBufferAttribute(geo.attributes.position, i);
    mesh.getVertexPosition(i, want);   // three's own skinning (mesh space)
    got.set(0, 0, 0);
    for (let k = 0; k < 2; k++) got.add(t.copy(v).applyMatrix4(M[k]).multiplyScalar(sw[i * 4 + k]));
    assert.ok(got.distanceTo(want) < 1e-5, `vertex ${i}: ${got.toArray()} vs ${want.toArray()}`);
  }
});

test('the look as global shader parameters, and Godot\'s project declares every one', () => {
  const g = lookGlobals({ uShadowTint: [0.5, 0.6, 0.7], uToon: 0.45, uHaze: [1, 0.9, 0.8, 0.3], uSunDir: [0, 1, 0, 9] });
  assert.deepEqual(g.g_shadow_tint, [0.5, 0.6, 0.7]);
  assert.equal(g.g_toon, 0.45);
  assert.deepEqual(g.g_haze, [1, 0.9, 0.8, 0.3]);
  assert.deepEqual(g.g_sun_dir, [0, 1, 0], 'a vec3 keeps three');
  assert.equal(g.g_hatch, GLOBALS.g_hatch[2], 'the default where the look says nothing');
  const project = readFileSync(new URL('../godot/project.godot', import.meta.url), 'utf8');
  assert.ok(project.includes(shaderGlobalsIni().trim()), 'godot/project.godot [shader_globals] is out of date: node scripts/godot-globals.mjs');
  // and the shaders use only those
  for (const f of ['ink.gdshaderinc', 'ink_post.gdshader']) {
    const src = readFileSync(new URL(`../godot/shaders/${f}`, import.meta.url), 'utf8');
    for (const [, name] of src.matchAll(/global uniform \w+ (\w+)/g)) assert.ok(name === 'g_bones' || GLOBALS[name], `${f}: ${name} is not in GLOBALS`);
  }
});

test('the bundle lowers Unicode property escapes (GodotJS\'s V8 has no ICU): the same letters match', () => {
  const lowered = new RegExp(lowerUnicodeClasses(String.raw`[\p{L}\p{N}’']+`), 'gu');
  const real = /[\p{L}\p{N}’']+/gu;
  for (const line of ['Nour — the tree that drinks, 3 jars?', 'Qanat\'s élan: Ça va, Æsir…', 'Έλα εδώ, привет мир', 'שלום, مرحبا 42', '旅人 たびびと 여행자']) {
    assert.deepEqual(line.match(lowered), line.match(real), line);
  }
  assert.ok(!lowerUnicodeClasses(readFileSync(new URL('../src/story/voice.js', import.meta.url), 'utf8')).includes('\\p{'));
});

test('the game in a bare V8 context: a world with its people, the traveller walks on the keys, the camera follows', async () => {
  const file = join(tmpdir(), `memento-engine-game-${process.pid}.js`);
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const { exports } = loadBundle(file);
  const R = recorder();
  let bones = 0;
  R.backend.bones = () => bones++;
  const warn = console.warn, info = console.info; console.warn = console.info = () => {};
  try {
    const game = await exports.createGame({ levelId: 'garage', backend: R.backend });
    // the world's people on MakeHuman bodies, as main.js has them (src/makehuman/people.js)
    assert.ok(game.npcs.some((n) => n.humanoid?.profile?.buildGeometry), 'MakeHuman bodies for the people');
    game.frame(1 / 30);
    const p0 = game.player.pos.clone(), c0 = game.camera.position.clone();
    game.key('KeyW', true);
    for (let i = 0; i < 45; i++) game.frame(1 / 30);
    game.key('KeyW', false);
    const walked = game.player.pos.distanceTo(p0);
    assert.ok(walked > 2, `walked ${walked.toFixed(2)} m`);
    assert.ok(game.camera.position.distanceTo(c0) > 1, 'the camera followed');
    assert.ok(game.camera.position.distanceTo(game.player.pos) < 30, 'and stayed with him');
    assert.ok(bones > 0, 'skinned people and the traveller send their bones');
    const look = game.lookParams();
    assert.equal(look.uSkyTop.length, 3);
    assert.equal(typeof look.uToon, 'number');
  } finally { console.warn = warn; console.info = info; }
});
