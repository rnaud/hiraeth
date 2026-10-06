// The Unity side of the engine bridge (docs/systems/engine-bridge.md): the mirror in x, the geometry
// and command layouts BridgeRenderer.cs reads, the port's material and look formats, and the Unity
// bundle run in a bare V8 context against a stand-in of the C# host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { mirrorMatrix, unityGeometry, CommandWriter, OP } from '../engine/unity/pack.js';
import { portMaterial, portLook } from '../engine/unity/port-format.js';
import { inkSpec } from '../engine/ink-spec.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';

THREE.ColorManagement.enabled = false;
const X = new THREE.Matrix4().makeScale(-1, 1, 1);

test('the mirror in x: X·M·X, points mirrored, the winding flipped', () => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(3, 4, 5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.1, -0.4)), new THREE.Vector3(1, 2, 0.5));
  const want = X.clone().multiply(m).multiply(X);
  const got = mirrorMatrix(m.elements);
  want.elements.forEach((v, i) => assert.ok(Math.abs(v - got[i]) < 1e-6, `element ${i}`));
  // a point through the mirrored matrix is the mirrored point through the original
  const p = new THREE.Vector3(0.5, -1, 2);
  const a = p.clone().applyMatrix4(m).applyMatrix4(X), b = p.clone().applyMatrix4(X).applyMatrix4(new THREE.Matrix4().fromArray(got));
  assert.ok(a.distanceTo(b) < 1e-5);
  // (the mirror's geometry: typed arrays as three holds them, engine/mirror.js)
  const geo = { attributes: { position: { array: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), itemSize: 3 }, normal: { array: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]), itemSize: 3 } }, index: new Uint16Array([0, 1, 2]), groups: null };
  const buf = unityGeometry(geo, { bind: true });
  const u = new Uint32Array(buf), f = new Float32Array(buf);
  assert.deepEqual([u[0], u[1], u[2] & 1, u[2] & 16, u[3]], [3, 3, 1, 16, 1]);
  const o = 4 + 3;
  assert.deepEqual(Array.from(f.subarray(o, o + 3)), [-1, 0, 0], 'x mirrored');
  assert.equal(f[o + 9], -1, 'the normal too');
  assert.deepEqual(Array.from(f.subarray(o + 18, o + 21)), [1, 0, 0], 'the rest pose stays in three\'s space');
  assert.deepEqual(Array.from(u.subarray(o + 27, o + 30)), [0, 2, 1], 'wound a, c, b');
});

test('the frame\'s command buffer: what BridgeRenderer.Frame reads', () => {
  const w = new CommandWriter(64);
  const m = new THREE.Matrix4().makeTranslation(7, 8, 9);
  w.reserve(2 + 17); w.u(OP.transforms); w.u(1); w.i(42); w.matrix(m.elements);
  w.reserve(3); w.u(OP.visible); w.i(42); w.u(0);
  for (let k = 0; k < 50; k++) { w.reserve(2); w.u(OP.remove); w.i(k); }   // (grows past its first buffer)
  const buf = w.take();
  const u = new Uint32Array(buf), f = new Float32Array(buf), i = new Int32Array(buf);
  let o = 0;
  assert.equal(u[o++], OP.transforms); assert.equal(u[o++], 1); assert.equal(i[o++], 42);
  assert.deepEqual([f[o + 12], f[o + 13], f[o + 14]], [-7, 8, 9], 'translation mirrored'); o += 16;
  assert.equal(u[o++], OP.visible); assert.equal(i[o++], 42); assert.equal(u[o++], 0);
  for (let k = 0; k < 50; k++) { assert.equal(u[o++], OP.remove); assert.equal(i[o++], k); }
  assert.equal(u[o], 0, 'closed with 0');
  assert.ok(w.empty, 'and the writer starts again');
});

test('the port\'s formats: a material as materialOf writes it, the look as world.json\'s', () => {
  const m = makeMaterial({ color: '#ff8000', color2: '#0000ff', mode: MODE_STRATA, strataSize: 6, glow: 0.5, side: THREE.DoubleSide, metal: 'steel' });
  const p = portMaterial(inkSpec(m), 7);
  assert.equal(p.id, 7);
  assert.deepEqual(p.color, [1, 0.50196, 0]);
  assert.equal(p.mode, MODE_STRATA); assert.equal(p.strataSize, 6); assert.equal(p.glow, 0.5); assert.equal(p.side, 2);
  assert.equal(p.plain, 0);
  assert.equal(p.metal.length, 4, 'the metal (kind, brushed, reflectivity, highlight)');
  for (const k of ['flat', 'grid', 'glyphs', 'biomes', 'ripples', 'sandInk', 'ticks', 'folds', 'scrub', 'pattern', 'figure', 'sway', 'strataObject', 'vertexColors']) assert.equal(typeof p[k], 'number', k);
  const L = portLook({ hour: 10, preset: 'Moebius print', uSkyTop: [0.4, 0.6, 0.8], uSkyHorizon: [0.9, 0.9, 0.8], uShadowTint: [0.5, 0.6, 0.7], uLightTint: [1, 1, 1], uInk: [0.1, 0.1, 0.1], uSunDir: [0.5, 0.6, 0.3], post: { uFogDensity: 0.001 }, shared: { uToon: 0.5 } });
  assert.equal(L.hours.length, 1);
  assert.deepEqual(L.hours[0].light, [-0.5, 0.6, 0.3], 'directions in Unity\'s frame');
  assert.deepEqual(L.post.ink, [0.1, 0.1, 0.1]);
  assert.equal(L.post.uFogDensity, 0.001);
});

test('the Unity bundle in a bare V8 context, against a stand-in of the C# host', async () => {
  const file = join(tmpdir(), `memento-engine-unity-${process.pid}.js`);
  await bundle('unity', { out: [file] });
  const calls = { Geometry: 0, Material: 0, Create: 0, Frame: 0, Look: 0, bytes: 0 };
  let lastFrame = null, look = null, screenJson = null;
  const BridgeHost = {
    Now: () => performance.now(), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry(key, buf) { calls.Geometry++; calls.bytes += buf.byteLength; }, Material() { calls.Material++; }, Create() { calls.Create++; }, SetMesh() {},
    Frame(buf) { calls.Frame++; lastFrame = buf; }, Look(json) { calls.Look++; look = json; }, Screen(json) { calls.Screen = (calls.Screen ?? 0) + 1; screenJson = json; }, ApplyMs: () => 0,
    Keys: () => (calls.Frame > 3 ? 'KeyW' : ''), Pad: () => null, MouseLook: () => null, Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() {},
  };
  const { exports, readFile } = loadBundle(file, {}, { CS: { Memento: { Bridge: { BridgeHost } } } });
  BridgeHost.ReadFile = readFile;
  const errors = [];
  const warn = console.warn, info = console.info, log = console.log, error = console.error; console.warn = console.info = console.log = () => {}; console.error = (...a) => errors.push(a.map(String).join(' ').slice(0, 300));
  try {
    exports.start(JSON.stringify({ level: 'garage' }));
    for (let i = 0; i < 2000 && !calls.Frame; i++) { await new Promise((r) => setTimeout(r, 30)); exports.frame(1 / 30); }   // (the world builds first: up to a minute on a busy machine)
    for (let i = 0; i < 20; i++) exports.frame(1 / 30);
  } finally { console.warn = warn; console.info = info; console.log = log; console.error = error; }
  assert.ok(calls.Frame >= 20, `frames: ${JSON.stringify(calls)} ${errors.join(' | ')}`);
  assert.ok(calls.Create > 50 && calls.Material > 5 && calls.Geometry > 20, JSON.stringify(calls));
  assert.ok(JSON.parse(look).hours[0].skyTop.length === 3, 'the look in the port\'s format');
  assert.ok(calls.Screen >= 1 && 'dialogue' in JSON.parse(screenJson), 'the screen\'s state for the HUD');
  // the last frame's commands parse to the end
  const u = new Uint32Array(lastFrame);
  let o = 0, ops = 0;
  const size = { 1: () => 1 + u[o] * 17, 2: () => 2, 3: () => 3 + u[o + 1] * 16 + (u[o + 2] ? u[o + 1] * 3 : 0), 4: () => 2 + u[o + 1] * 16, 5: () => 19, 6: () => 1, 7: () => 2 + u[o + 1] * 16, 8: () => 3 + u[o + 1] * 3 * (u[o + 2] ? 2 : 1) };
  const skeletons = [];
  while (u[o] !== 0) { const op = u[o++]; assert.ok(size[op], `op ${op}`); if (op === 7) skeletons.push(u[o]); o += size[op](); ops++; }
  assert.ok(skeletons.length > 0, 'the people\'s skeletons');
  assert.equal(new Set(skeletons).size, skeletons.length, 'each skeleton once a frame, however many meshes it moves');
  assert.equal(o, u.length - 1, 'the stream ends where it says');
  assert.ok(ops > 0);
});
