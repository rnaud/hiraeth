// The Unity side of the engine bridge (docs/systems/engine-bridge.md): the mirror in x, the geometry
// and command layouts BridgeRenderer.cs reads, the port's material and look formats, and the Unity
// bundle run in a bare V8 context against a stand-in of the C# host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { mirrorMatrix, unityGeometry, CommandWriter, OP, puffInstances } from '../engine/unity/pack.js';
import { portMaterial, portLook } from '../engine/unity/port-format.js';
import { UnityBackend } from '../engine/unity/backend.js';
import { inkSpec } from '../engine/ink-spec.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';
import { Motes, Footprints } from '../src/life.js';
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

test('the web\'s newer surface marks reach the port: weathering, pen detail, patches, the shade, the spot and line steps; the look\'s vectors', () => {
  // a weathered house front (the Signal Market's walls): weathering, built pen detail and colour patches on by default
  const wall = portMaterial(inkSpec(makeMaterial({ color: '#7fa79c', pattern: 'facade', windows: 0.5, shade: 0.3, shadeHue: 0.5, spot: 0, line: 0.45, lineTint: 1 })), 1);
  assert.equal(wall.weather, 1, 'weathered');
  assert.deepEqual(wall.detail, [1, 1], 'built pen detail');
  assert.equal(wall.patch, 1, 'colour across the wall');
  assert.equal(wall.windows, 0.5);
  assert.deepEqual(wall.shade, [0.3, 0.5, 1, 0], 'the shade: lift, hue, hatch, strata strokes');
  assert.equal(wall.spotStep, 1, 'no spot blacks (step 1: none)');
  assert.equal(wall.lineStep, 2 + 4 * 3, 'a thin line in its own colour');
  // a plain material: none of it, the world's shade, ink and spots
  const plain = portMaterial(inkSpec(makeMaterial({ color: '#808080' })), 2);
  assert.equal(plain.weather, 0); assert.deepEqual(plain.detail, [0, 0]); assert.equal(plain.patch, 0);
  assert.equal(plain.spotStep, 0); assert.equal(plain.lineStep, 0); assert.deepEqual(plain.shade, [0, -1, 1, 0]);
  // the coral-shirt traveller's linear colours (tripo-material.js): turned to display values in the port's shader
  const lin = makeMaterial({ color: '#ffffff', figure: true }).clone(); lin.userData.albedoLinear = true;
  assert.equal(portMaterial(inkSpec(lin), 3).toDisplay, 1);
  assert.equal(plain.toDisplay, undefined);
  // the look's vectors (spot blacks, haze by depth and height, cast shadows lifted or inked) go with its numbers
  const L = portLook({ hour: 10, uSunDir: [0, 1, 0], post: { uSpot: [0.8, 2.5, 0.5, 0.3], uInkShadow: [1, 0] }, shared: {} });
  assert.deepEqual(L.post.uSpot, [0.8, 2.5, 0.5, 0.3]);
  assert.deepEqual(L.post.uInkShadow, [1, 0]);
});

test('the port\'s crowd figures read the costume as costumes.js packs it (the pieces worn, not the wrong ones)', async () => {
  const { MASK_ID_LIMIT, BODY_ID_LIMIT, HEAD_ID_LIMIT } = await import('../src/costumes.js');
  const { readFileSync } = await import('node:fs');
  const hlsl = readFileSync(new URL('../unity/Memento/Assets/Memento/Shaders/Crowd.hlsl', import.meta.url), 'utf8');
  const num = (re) => { const m = hlsl.match(re); assert.ok(m, `${re}`); return +m[1]; };
  assert.equal(num(/maskId = \(int\)\(cmod\(aDress\.y, ([\d.]+)\)/), MASK_ID_LIMIT);
  assert.equal(num(/bodyId = \(int\)\(cmod\(floor\(aDress\.y \/ ([\d.]+) /), MASK_ID_LIMIT);
  assert.equal(num(/bodyId = [^;]*?, ([\d.]+)\) \+ 0\.5\)/), BODY_ID_LIMIT);
  assert.equal(num(/propId = \(int\)\(floor\(aDress\.y \/ ([\d.]+) /), MASK_ID_LIMIT * BODY_ID_LIMIT);
  assert.equal(num(/headId = \(int\)\(cmod\(aDress\.x, ([\d.]+)\)/), HEAD_ID_LIMIT);
});

test('the grass for the port: its tufts (op 12: the root mirrored in x, the rest as it is), its fades (op 13), live colours (op 15)', () => {
  const created = [];
  const B = new UnityBackend({ Create: (id, json) => created.push(JSON.parse(json)), Geometry: () => {}, Material: () => {} });
  const geo = { attributes: { position: { array: new Float32Array(9), itemSize: 3 } }, index: null, groups: [] };
  B.geometry(1, geo);
  B.material(1, inkSpec(makeMaterial({ color: '#8cc77e', grass: true, side: THREE.DoubleSide })));
  B.create(5, { kind: 'instgeo', gid: 1, mids: [1], name: 'grass', capacity: 2 });
  assert.equal(created[0].kind, 'grass');
  assert.equal(created[0].capacity, 2);
  const aGrass = { array: new Float32Array([1, 2, 3, 0.3, -4, 5, 6, 0.2]), itemSize: 4, range: [4, 4] };
  const aGrass2 = { array: new Float32Array([0.5, 0.1, 0.05, 0.9, 1.5, 0.7, -0.1, 0.4]), itemSize: 4, range: null };
  B.instances(5, 2, null, null, { aGrass, aGrass2 });
  const U = { uGrassView: { value: new THREE.Vector4(7, 8, 9, 10) }, uGrassLod: { value: new THREE.Vector4(1, 2, 3, 0) }, uGrassLook: { value: new THREE.Vector4(4, 5, 0.55, 0.12) },
    uColor: { value: new THREE.Color(0.1, 0.2, 0.3) }, uColor2: { value: new THREE.Color(0.4, 0.5, 0.6) } };
  B.drawState(5, { material: { uniforms: U } });
  B.drawState(5, { material: { uniforms: U } });   // (unchanged: not again)
  B.materialLive(3, [0.9, 0.8, 0.7], null);
  const f = new Float32Array(B.w.take()), u = new Uint32Array(f.buffer);
  let o = 0;
  // aGrass: only the second tuft (its range), its root's x mirrored
  assert.deepEqual([u[o], u[o + 1], u[o + 2], u[o + 3], u[o + 4], u[o + 5]], [OP.grass, 5, 2, 0, 1, 1]); o += 6;
  assert.deepEqual(Array.from(f.subarray(o, o + 4)), [4, 5, 6, Math.fround(0.2)]); o += 4;
  // aGrass2: all of it, as it is
  assert.deepEqual([u[o], u[o + 3], u[o + 4], u[o + 5]], [OP.grass, 1, 0, 2]); o += 6;
  assert.equal(f[o], 0.5); assert.equal(f[o + 4], 1.5); o += 8;
  assert.equal(u[o], OP.grassView); assert.equal(u[o + 1], 5); assert.equal(f[o + 2], 7, 'the patch\'s centre in three\'s space'); o += 20;
  assert.equal(u[o], OP.material); assert.equal(u[o + 1], 3); assert.ok(Math.abs(f[o + 2] - 0.9) < 1e-6); assert.ok(Number.isNaN(f[o + 5]), 'the glow unchanged'); o += 6;
  assert.equal(u[o], 0, 'the end');
});

test('the motes and the footprints go to the port\'s own shaders; a print\'s place, turn, size and fade as Puffs.Inst', () => {
  const scene = new THREE.Scene();
  const motes = new Motes(scene, { count: 8, color: '#e6cf9f', size: 0.05 });
  const mm = motes.scene.children[0].material;
  const pm = portMaterial(inkSpec(mm), 3);
  assert.equal(pm.port, 'mote'); assert.equal(pm.size, 0.05); assert.equal(pm.color.length, 3);
  const prints = new Footprints(scene, { count: 4 });
  assert.equal(portMaterial(inkSpec(prints.mesh.material), 4).port, 'print');
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: '#808080' })), 5).port, undefined, 'an ink surface stays the port\'s Surface');
  const m = new THREE.Matrix4().compose(new THREE.Vector3(2, 3, 4), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5), new THREE.Vector3(1, 1, 1.5));
  const out = puffInstances(m.elements, 1, { aFade: { array: new Float32Array([0.25]), itemSize: 1 } });
  assert.deepEqual([out[0], out[1], out[2]], [-2, 3, 4], 'mirrored in x');
  assert.ok(Math.abs(out[3] + 0.5) < 1e-6, 'the turn mirrored');
  assert.ok(Math.abs(out[6] - 1.5) < 1e-6 && Math.abs(out[4] - 1) < 1e-6, 'the scale');
  assert.equal(out[7], 0.25, 'the fade');
  // the local lights: op 11 when they change, mirrored, nothing when they stay
  const B = new UnityBackend({});
  B.lights([[3, 4, 5, 6]]); B.lights([[3, 4, 5, 6]]);
  const f = new Float32Array(B.w.take()), u = new Uint32Array(f.buffer);
  assert.deepEqual([u[0], u[1], f[2], f[3], f[4], f[5], u[6]], [OP.lights, 1, -3, 4, 5, 6, 0]);
});

test('the Unity bundle in a bare V8 context, against a stand-in of the C# host', async () => {
  const file = join(tmpdir(), `memento-engine-unity-${process.pid}.js`);
  await bundle('unity', { out: [file] });
  const calls = { Geometry: 0, Material: 0, Create: 0, Frame: 0, Look: 0, bytes: 0 };
  let lastFrame = null, look = null, screenJson = null;
  // the sound (BridgeAudio.cs): a ring Unity drains at its rate, topped up by the script each frame
  const sound = { queued: 0, frames: 0, sumSq: 0, bad: 0 };
  const BridgeHost = {
    Now: () => performance.now(), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry(key, buf) { calls.Geometry++; calls.bytes += buf.byteLength; }, Material() { calls.Material++; }, Create() { calls.Create++; }, SetMesh() {},
    Frame(buf) { calls.Frame++; lastFrame = buf; }, Look(json) { calls.Look++; look = json; }, Screen(json) { calls.Screen = (calls.Screen ?? 0) + 1; screenJson = json; }, ApplyMs: () => 0,
    Keys: () => (calls.Frame > 3 ? 'KeyW' : ''), Pad: () => null, MouseLook: () => null, Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() {},
    AudioRate: () => 48000, AudioQueued: () => sound.queued,
    Audio(buf) { const f = new Float32Array(buf); sound.queued += f.length / 2; sound.frames += f.length / 2; for (const x of f) { if (!Number.isFinite(x)) sound.bad++; sound.sumSq += x * x; } },
  };
  // (no timers of the VM's own, as in Puerts: engine/platform.js runs them from the frame)
  const { exports, readFile } = loadBundle(file, {}, { CS: { Memento: { Bridge: { BridgeHost } } }, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined });
  BridgeHost.ReadFile = readFile;
  const errors = [];
  const warn = console.warn, info = console.info, log = console.log, error = console.error; console.warn = console.info = console.log = () => {}; console.error = (...a) => errors.push(a.map(String).join(' ').slice(0, 300));
  try {
    exports.start(JSON.stringify({ level: 'garage' }));
    for (let i = 0; i < 2000 && !calls.Frame; i++) { await new Promise((r) => setTimeout(r, 30)); exports.frame(1 / 30); }   // (the world builds first: up to a minute on a busy machine)
    for (let i = 0; i < 20; i++) { exports.frame(1 / 30); sound.queued = Math.max(0, sound.queued - 1600); }
  } finally { console.warn = warn; console.info = info; console.log = log; console.error = error; }
  assert.ok(calls.Frame >= 20, `frames: ${JSON.stringify(calls)} ${errors.join(' | ')}`);
  assert.ok(calls.Create > 50 && calls.Material > 5 && calls.Geometry > 20, JSON.stringify(calls));
  assert.ok(JSON.parse(look).hours[0].skyTop.length === 3, 'the look in the port\'s format');
  assert.ok(calls.Screen >= 1 && 'dialogue' in JSON.parse(screenJson), 'the screen\'s state for the HUD');
  assert.ok(sound.frames >= 20 * 1600 && sound.queued <= 48000 * 0.12 + 128, `the sound kept a little ahead: ${JSON.stringify(sound)}`);
  assert.equal(sound.bad, 0, 'every sample finite');
  assert.ok(Math.sqrt(sound.sumSq / (sound.frames * 2)) > 1e-5, 'and something to hear (the wind)');
  // the last frame's commands parse to the end
  const u = new Uint32Array(lastFrame);
  let o = 0, ops = 0;
  const size = { 1: () => 1 + u[o] * 17, 2: () => 2, 3: () => 3 + u[o + 1] * 16 + (u[o + 2] ? u[o + 1] * 3 : 0), 4: () => 2 + u[o + 1] * 16, 5: () => 19, 6: () => 1, 7: () => 2 + u[o + 1] * 16, 8: () => 3 + u[o + 1] * 3 + (u[o + 2] & 1 ? u[o + 1] * 3 : 0) + (u[o + 2] & 2 ? u[o + 1] : 0), 9: () => 3 + u[o + 1] * 32, 10: () => 2 + u[o + 1] * 8, 11: () => 1 + u[o] * 4, 12: () => 5 + u[o + 4] * 4, 13: () => 19, 14: () => 4, 15: () => 5, 16: () => 27 };
  const skeletons = [];
  while (u[o] !== 0) { const op = u[o++]; assert.ok(size[op], `op ${op}`); if (op === 7) skeletons.push(u[o]); o += size[op](); ops++; }
  assert.ok(skeletons.length > 0, 'the people\'s skeletons');
  assert.equal(new Set(skeletons).size, skeletons.length, 'each skeleton once a frame, however many meshes it moves');
  assert.equal(o, u.length - 1, 'the stream ends where it says');
  assert.ok(ops > 0);
});
