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
import { capePacketWords } from '../engine/cape-job.js';
import { AudioReplay } from '../engine/webaudio.js';

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
  assert.deepEqual(Array.from(f.subarray(o + 18, o + 21)), [-1, 0, 0], 'the rest pose mirrored too, as the port\'s figures keep it (the shader takes it back)');
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

test('hatching that follows the form, a box\'s marks, a lining and a face\'s keys reach the port', async () => {
  // the part's axis per vertex (src/form.js aFormC, aFormA) in the geometry's buffer (flag 64), as they are
  const P = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const g = { attributes: { position: { array: P, itemSize: 3 }, aFormC: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), itemSize: 4 }, aFormA: { array: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), itemSize: 3 } }, index: null, groups: [] };
  const u = new Uint32Array(unityGeometry(g, { form: true })), f = new Float32Array(u.buffer);
  assert.equal(u[2] & 64, 64);
  assert.equal(f[4 + 3 + 9 + 3], 1, 'the first axis point\'s kind');
  assert.equal(new Uint32Array(unityGeometry(g))[2] & 64, 0, 'only where its material follows the form');
  const cap = portMaterial(inkSpec(makeMaterial({ color: '#334', form: true, veins: 0.6 })), 1);
  assert.equal(cap.form, 1); assert.equal(cap.veins, 0.6);
  const box = portMaterial(inkSpec(makeMaterial({ color: '#1d2a52', makersBox: { half: [0.4, 0.3, 0.3], center: 0.3 } })), 2);
  assert.equal(box.box, 1); assert.deepEqual(box.boxB, [0.4, 0.3, 0.3, 0.3]); assert.equal(box.boxMark.length, 3);
  const shirt = makeMaterial({ color: '#ffffff', figure: true }).clone(); shirt.userData.lining = [0.45, 0.12, 0.06];
  assert.deepEqual(portMaterial(inkSpec(shirt), 3).lining, [0.45, 0.12, 0.06, 1]);
  // a face's keys: only the vertices each moves, mirrored in x and scaled by the head
  const { faceKeyDeltas } = await import('../engine/unity/backend.js');
  const data = new Float32Array(4 * 4 * 2); data[1 * 4] = 0.5; data[16 + 2 * 4 + 1] = 0.25;   // key 0 moves vertex 1 in x, key 1 vertex 2 in y
  const kb = faceKeyDeltas({ names: ['smile', 'blink'], kHead: [2, 2, 2], texture: { image: { data, width: 4, height: 1, depth: 2 } } }, 4);
  const ku = new Uint32Array(kb), kf = new Float32Array(kb);
  assert.deepEqual([ku[0], ku[1], ku[2], ku[3], kf[4]], [2, 4, 1, 1, -1], 'key 0: vertex 1, x mirrored and doubled');
  assert.deepEqual([ku[7], ku[8], kf[10]], [1, 2, 0.5], 'key 1: vertex 2 in y');
});

test('the coral-shirt traveller\'s drawn face and the flask reach the port (TripoFace.hlsl made from tripo-face.js\'s own shader)', async () => {
  const { readFileSync } = await import('node:fs');
  const { tripoFaceHlsl, TRIPO_FACE_HLSL_PATH } = await import('../scripts/unity-export/tripo-face-hlsl.mjs');
  assert.equal(readFileSync(TRIPO_FACE_HLSL_PATH, 'utf8'), tripoFaceHlsl(), 'TripoFace.hlsl is out of date: node scripts/unity-export/tripo-face-hlsl.mjs');
  assert.ok(!/\b(vec[234]|mix|uTf)\b/.test(tripoFaceHlsl()), 'no GLSL left in it');
  const face = makeMaterial({ color: '#ffffff', figure: true }).clone();
  Object.assign(face.uniforms, { uTfBrowA: { value: new THREE.Vector4(0.01, 1.66, 0.03, 1.665) }, uTfBrowB: { value: new THREE.Vector4(0.06, 1.66, 1, 0) }, uTfEye: { value: new THREE.Vector4() }, uTfMouth: { value: new THREE.Vector4(0.02, 0, 0, 0) } });
  const p = portMaterial(inkSpec(face), 1);
  assert.equal(p.tripoFace, 1); assert.deepEqual(p.tfBrowA, [0.01, 1.66, 0.03, 1.665]);
  const flask = portMaterial(inkSpec(makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBase: '#5fb86a' })), 2);
  assert.equal(flask.fluidBase.length, 3);
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
  const cloths = {}, capes = {};
  const clothWords = (id) => { const c = cloths[id]; return 3 * c.N + 28 * c.K + 16 * c.B + 16; };
  // the sound (BridgeAudio.cs): a ring Unity drains at its rate, topped up by the script each frame
  const sound = { queued: 0, frames: 0, sumSq: 0, bad: 0, batches: 0 };
  const replay = new AudioReplay(48000), ended = [];
  const BridgeHost = {
    Now: () => performance.now(), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry(key, buf) { calls.Geometry++; calls.bytes += buf.byteLength; }, Material() { calls.Material++; },
    // the coral-shirt traveller's overshirt (BridgeCloth.cs): its description's header, for op 17's size
    FaceKeys(key, buf) { const u = new Uint32Array(buf); calls.Keys = (calls.Keys ?? 0) + 1; calls.keyVerts = (calls.keyVerts ?? 0) + u[2]; },
    Cloth(id, buf) { const h = new Uint32Array(buf, 0, 7); cloths[id] = { N: h[0], K: h[5], B: h[6] }; }, Create() { calls.Create++; }, SetMesh() {},
    // the people's capes (BridgeCape.cs): their descriptions' sizes, for op 20's; their points never read back here
    Cape(id, buf) { const h = new Uint32Array(buf, 0, 2); capes[id] = h[0] * h[1]; }, CapeState: () => null,
    Frame(buf) { calls.Frame++; lastFrame = buf; }, Look(json) { calls.Look++; look = json; }, Screen(json) { calls.Screen = (calls.Screen ?? 0) + 1; screenJson = json; }, ApplyMs: () => 0,
    Keys: () => (calls.Frame > 3 ? 'KeyW' : ''), Pad: () => null, MouseLook: () => null, Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() {},
    AudioRate: () => 48000, AudioQueued: () => sound.queued,
    Audio(buf) { const f = new Float32Array(buf); sound.queued += f.length / 2; sound.frames += f.length / 2; for (const x of f) { if (!Number.isFinite(x)) sound.bad++; sound.sumSq += x * x; } },
    // the sound rendered on Unity's audio thread (BridgeRunner.RunAudio, engine/unity/audio-worker.js): its batches played here as there
    AudioThreaded: () => true,
    AudioBatch(buf) { sound.batches++; const r = replay.apply(new Float64Array(buf)); if (r.pcm.length) BridgeHost.Audio(r.pcm.slice().buffer); if (r.ended.length) ended.push(...r.ended); },
    AudioEndedTake: () => { const s = ended.join(','); ended.length = 0; return s; },
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
  assert.ok(sound.batches >= 20, `the sound recorded and played elsewhere: ${sound.batches} batches`);
  assert.ok(Math.sqrt(sound.sumSq / (sound.frames * 2)) > 1e-5, 'and something to hear (the wind)');
  // the last frame's commands parse to the end
  const u = new Uint32Array(lastFrame);
  let o = 0, ops = 0;
  const size = { 1: () => 1 + u[o] * 17, 2: () => 2, 3: () => 3 + u[o + 1] * 16 + (u[o + 2] ? u[o + 1] * 3 : 0), 4: () => 2 + u[o + 1] * 16, 5: () => 19, 6: () => 1, 7: () => 2 + u[o + 1] * 16, 8: () => 3 + u[o + 1] * 3 + (u[o + 2] & 1 ? u[o + 1] * 3 : 0) + (u[o + 2] & 2 ? u[o + 1] : 0), 9: () => 3 + u[o + 1] * 32, 10: () => 2 + u[o + 1] * 8, 11: () => 1 + u[o] * 4, 12: () => 5 + u[o + 4] * 4, 13: () => 19, 14: () => 4, 15: () => 5, 16: () => 30, 17: () => 4 + clothWords(u[o]), 18: () => 6, 19: () => 2 + u[o + 1], 20: () => capePacketWords(u, o, capes[u[o]]) };
  const skeletons = [];
  assert.equal(Object.keys(cloths).length, 1, 'the overshirt done by the C# side (BridgeCloth)');
  assert.ok(calls.Keys > 0 && calls.keyVerts > 0, `the MakeHuman faces' shape keys as blend shapes: ${calls.Keys} meshes`);
  assert.ok(Object.keys(capes).length > 3, `the capes done by the C# side (BridgeCape): ${Object.keys(capes).length}`);
  while (u[o] !== 0) { const op = u[o++]; assert.ok(size[op], `op ${op}`); if (op === 7) skeletons.push(u[o]); o += size[op](); ops++; }
  assert.ok(skeletons.length > 0, 'the people\'s skeletons');
  assert.equal(new Set(skeletons).size, skeletons.length, 'each skeleton once a frame, however many meshes it moves');
  assert.equal(o, u.length - 1, 'the stream ends where it says');
  assert.ok(ops > 0);
});

test('a merged mesh\'s material values per vertex (S_VMAT: the City-Shaft\'s towers) and a cliff\'s cracks reach the port', async () => {
  const { mergeWithMaterials } = await import('../src/vertex-material.js');
  const { VMAT_ATTRS } = await import('../engine/unity/pack.js');
  const a = makeMaterial({ color: '#c08060', color2: '#405060', color3: '#a0a0a0', strataSize: 5, grid: 2, flat: true });
  const b = makeMaterial({ color: '#203040', color2: '#405060', color3: '#a0a0a0', strataSize: 3, grid: 0, flat: false });
  const box = new THREE.BoxGeometry(2, 4, 2);
  const g = mergeWithMaterials([{ geometry: box, x: 10, y: 0, z: -5, rotY: 0.5, material: a }, { geometry: box, x: -20, y: 2, z: 40, rotY: 0, material: b }]);
  const merged = makeMaterial({ color: '#c08060', perVertex: true });
  const pm = portMaterial(inkSpec(merged), 1);
  assert.equal(pm.vmat, 1, 'the port\'s variant that reads them (MEMENTO_VMAT)');
  // (as the mirror hands a geometry over: its attributes' arrays and sizes, the index's array)
  const plain = { attributes: Object.fromEntries(Object.entries(g.attributes).map(([k, x]) => [k, { array: x.array, itemSize: x.itemSize }])), index: g.index.array, groups: null };
  const buf = unityGeometry(plain, { vmat: true });
  const u = new Uint32Array(buf), f = new Float32Array(buf);
  const n = u[0];
  assert.ok(u[2] & 128, 'flag 128');
  assert.equal(n, g.attributes.position.count);
  // after the points and normals: aMatC1, C2, C3, S, P, N (3n each), M (4n), as the attributes are
  let o = 4 + u[3] * 3 + n * 6;
  for (const [k, s] of VMAT_ATTRS) {
    const src = g.attributes[k].array;
    for (const i of [0, n - 1]) for (let c = 0; c < s; c++) assert.ok(Math.abs(f[o + i * s + c] - src[i * s + c]) < 1e-6, `${k}[${i}]`);
    o += n * s;
  }
  // the second object's colour, band size and flat where the vertex says
  const c1 = g.attributes.aMatC1.array, S = g.attributes.aMatS.array;
  assert.ok(Math.abs(c1[(n - 1) * 3] - new THREE.Color('#203040').r) < 1e-6 && S[(n - 1) * 3] === 3 && S[(n - 1) * 3 + 2] === 0);
  assert.equal(new Uint32Array(unityGeometry(plain))[2] & 128, 0, 'only when asked for');
  // the strata's cracks (uCracks)
  const cliff = makeMaterial({ color: '#c08060', color2: '#a06040', color3: '#e0a080', mode: MODE_STRATA, strataSize: 5, flat: true, cracks: 0.8 });
  assert.equal(portMaterial(inkSpec(cliff), 2).cracks, 0.8);
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: '#808080' })), 3).cracks, undefined);
});

test('a conversation\'s portrait goes to Unity mirrored, named for the chip, kept as a PNG in a batch run', () => {
  const sent = [];
  const B = new UnityBackend({ Portrait: (n, json) => sent.push([n, JSON.parse(json)]) });
  B.portrait(3, { eye: [1, 2, 3], look: [4, 5, 6], up: [0, 1, 0], fov: 36, ids: [7, 8], backdrop: '#f0cf8e', size: 105, css: 84 });
  B.portraitDir = '/tmp/out';
  B.portrait(4, { eye: [1, 2, 3], look: [4, 5, 6], fov: 36, ids: [7], backdrop: null, size: 105, css: 84 });
  assert.deepEqual(sent[0][1].eye, [-1, 2, 3], 'the eye in Unity\'s frame');
  assert.deepEqual(sent[0][1].look, [-4, 5, 6]);
  assert.deepEqual(sent[0][1].ids, [7, 8]);
  assert.equal(sent[0][1].file, null, 'no file outside a batch run');
  assert.equal(sent[1][1].file, '/tmp/out/unity-portrait-4.png');
  assert.deepEqual(sent[1][1].up.map(Math.abs), [0, 1, 0], 'up by default');
});
