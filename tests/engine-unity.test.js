// The Unity side of the engine bridge (docs/systems/engine-bridge.md): the mirror in x, the geometry
// and command layouts BridgeRenderer.cs reads, the port's material and look formats, and the Unity
// bundle run in a bare V8 context against a stand-in of the C# host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
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
import { buildFlask } from '../src/fluid-tool.js';
import { AudioReplay } from '../engine/webaudio.js';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { LOAD_WHY } from '../src/load-page.js';

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

test('the round backpack\'s dome reaches the port (its nebula marched through it: Figure.hlsl flaskNebula)', () => {
  const glass = makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBox: [0, 0.3, 0.2, 0] });
  buildFlask(glass);
  const p = portMaterial(inkSpec(glass), 4);
  assert.equal(p.fluid, 1);
  assert.equal(p.fluidA[3], 0, 'kind 0: the tank');
  assert.equal(p.fluidDome.length, 4);
  assert.ok(p.fluidDome[3] > 0, 'the dome\'s radius, set by buildFlask');
  assert.ok(p.fluidDomeK > 0, 'how far it stands out of its ring');
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

test('a foe\'s painted surface reaches the port: its features as bits, its uniforms packed, FoeSurface.hlsl made from foe-surface.js\'s own GLSL', async () => {
  const { readFileSync } = await import('node:fs');
  const { foeHlsl, FOE_HLSL_PATH } = await import('../scripts/unity-export/foe-hlsl.mjs');
  const { FOE_LAYOUT, foePack } = await import('../engine/foe-pack.js');
  const { FOE_SURFACE_FEATURES } = await import('../src/foe-surface.js');
  assert.equal(readFileSync(FOE_HLSL_PATH, 'utf8'), foeHlsl(), 'FoeSurface.hlsl is out of date: node scripts/unity-export/foe-hlsl.mjs');
  assert.ok(!/\b(vec[234]|mix|fract|uFs\w*|#ifdef)\b/.test(foeHlsl().replace(/\/\/.*$/gm, '')), 'no GLSL left in it');
  const m = makeMaterial({ color: '#7a8a5a', foeSurface: { belly: { color: '#efe1c3' }, spots: { scale: 0.2 }, cracks: { open: 0.25 }, gloss: true } });
  const p = portMaterial(inkSpec(m), 3);
  const bit = (k) => 1 << FOE_SURFACE_FEATURES.indexOf(k);
  assert.equal(p.foeBits, bit('belly') | bit('spots') | bit('cracks') | bit('gloss'));
  assert.equal(p.foeData.length, FOE_LAYOUT.length * 4);
  const at = (name) => FOE_LAYOUT.find((e) => e.name === name).slot * 4;
  assert.equal(p.foeData[at('uFs_spots')], 0.2, 'the spots\' cell in its slot');
  assert.equal(p.foeData[at('uFsCracksO')], 0.25, 'the cracks\' opening in its slot');
  assert.equal(p.foeData[at('uFsFadeC') + 3], 0, 'a feature it lacks: zeros');
  // (and packed again from the live uniforms as the mirror does: a brute's cracks opening)
  m.uniforms.uFsCracksO.value = 0.8;
  assert.equal(foePack(m.uniforms)[at('uFsCracksO')], Math.fround(0.8));
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: '#ffffff' })), 4).foeBits, undefined, 'a plain material has none');
});

test('the fluid sword\'s blade and the shield reach the port: BladeSurface.hlsl made from blade-shader.js\'s GLSL, their numbers live, aFold with the bind', async () => {
  const { readFileSync } = await import('node:fs');
  const { bladeHlsl, BLADE_HLSL_PATH } = await import('../scripts/unity-export/blade-hlsl.mjs');
  const { LIVE_VECTORS } = await import('../engine/mirror.js');
  assert.equal(readFileSync(BLADE_HLSL_PATH, 'utf8'), bladeHlsl(), 'BladeSurface.hlsl is out of date: node scripts/unity-export/blade-hlsl.mjs');
  const h = bladeHlsl().replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(vec[234]|mix|fract|mat2|#ifdef|uBlade\w*|vFold|vBind)\b/.test(h), 'no GLSL left in it');
  for (const f of ['bladeFluidBlade', 'bladeFluidDisc', 'bladeLight', 'bladeCutBlade', 'bladeCutDisc', 'bladeBendBlade', 'bladeBendDisc']) assert.match(h, new RegExp(`\\b${f}\\(`), f);
  const blade = portMaterial(inkSpec(makeMaterial({ color: '#5fd0c8', fluid: 'blade' })), 5), shield = portMaterial(inkSpec(makeMaterial({ color: '#5fd0c8', fluid: 'blade', disc: true })), 6);
  assert.equal(blade.blade, 1); assert.equal(shield.blade, 2);
  assert.deepEqual(blade.bladeB, [0, 0, 99, 0.75]);
  for (const k of ['uBlade', 'uBladeB', 'uBladeC']) assert.ok(LIVE_VECTORS.includes(k), `${k} sent live`);
  // (the blade's across and along, aFold, go with the bind: uv1)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  g.setAttribute('aFold', new THREE.Float32BufferAttribute([-1, 0, 1, 0.5, 0, 1], 2));
  const u = new Uint32Array(unityGeometry(g, { bind: true })), f = new Float32Array(u.buffer);
  assert.equal(u[2] & 256, 256);
  const at = 4 + 3 + 9 + 9;   // (head, one group; positions, bind)
  assert.deepEqual(Array.from(f.subarray(at, at + 6)), [-1, 0, 1, 0.5, 0, 1]);
  assert.equal(new Uint32Array(unityGeometry(g))[2] & 256, 0, 'only with the bind');
});

test('the chimes\' crystal reaches the port: CrystalSurface.hlsl made from crystal-shader.js\'s GLSL, its uniforms packed, aCrystal in the form\'s slot', async () => {
  const { readFileSync } = await import('node:fs');
  const { crystalHlsl, CRYSTAL_HLSL_PATH } = await import('../scripts/unity-export/crystal-hlsl.mjs');
  const { CRYSTAL_LAYOUT } = await import('../engine/foe-pack.js');
  const { crystalLook, crystalGeometry } = await import('../src/chimes.js');
  assert.equal(readFileSync(CRYSTAL_HLSL_PATH, 'utf8'), crystalHlsl(), 'CrystalSurface.hlsl is out of date: node scripts/unity-export/crystal-hlsl.mjs');
  assert.ok(!/\b(vec[234]|mix|fract|uCrystal\w*|vCrystal\w*)\b/.test(crystalHlsl().replace(/\/\/.*$/gm, '')), 'no GLSL left in it');
  const m = crystalLook(), p = portMaterial(inkSpec(m), 9);
  assert.equal(p.crystal, 1);
  assert.equal(p.foeData.length, CRYSTAL_LAYOUT.length * 4);
  assert.equal(p.foeData[CRYSTAL_LAYOUT.find((e) => e.name === 'uCrystalDeep').slot * 4 + 3], +m.uniforms.uCrystalDeep.value.w.toFixed(5), 'the pen\'s share in its slot');
  const g = crystalGeometry();
  const u = new Uint32Array(unityGeometry(g, { form: true }));
  assert.equal(u[2] & 64, 64, 'aCrystal in the form\'s slot');
});

test('a fight temple\'s wall opening round him and a lamp\'s own colour reach the port', async () => {
  const { SEE_HOLE } = await import('../src/materials.js');
  const { LIVE_VECTORS } = await import('../engine/mirror.js');
  const wall = makeMaterial({ color: '#c8b89a', seeThrough: 'test:wall' });
  wall.uniforms.uSeeK.value = 0.4;
  SEE_HOLE.value.set(1, 2, 3, 3.4);
  const p = portMaterial(inkSpec(wall), 7);
  assert.equal(p.seeOn, 1); assert.deepEqual(p.see, [1, 2, 3, 3.4]); assert.deepEqual(p.seeK, [0.4, 0, 0, 0]);
  SEE_HOLE.value.set(0, -1e4, 0, 3.4);
  assert.ok(LIVE_VECTORS.includes('uSee') && LIVE_VECTORS.includes('uSeeK'), 'the hole moves with him, opens and closes: sent live');
  const lamp = portMaterial(inkSpec(makeMaterial({ color: '#c8b89a', lampTint: ['#ffd192', 0.85] })), 8);
  assert.equal(lamp.lampTint.length, 4); assert.equal(lamp.lampTint[3], 0.85);
  // (the shader's cut keeps the web's foot and wobble: SEE_LOOK)
  const { SEE_LOOK } = await import('../src/materials.js');
  const { readFileSync } = await import('node:fs');
  const sh = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.ok(sh.includes(`_See.y - ${SEE_LOOK.foot.toFixed(2)}`) && sh.includes(`1.0 - ${SEE_LOOK.wobble.toFixed(2)} * vnoise`), 'Surface.shader\'s see-through hole has SEE_LOOK\'s numbers');
});

test('the mirror sends a live number as a vector\'s x (a wall\'s share of the see-through hole)', async () => {
  const { SceneMirror, LIVE_VECTORS } = await import('../engine/mirror.js');
  const sent = [];
  const mirror = new SceneMirror({ materialVec: (mid, w, v) => sent.push([w, ...v]), material() {} });
  const wall = makeMaterial({ color: '#c8b89a', seeThrough: 'test:wall2' });
  mirror.mats.set(wall, 3);
  mirror._live(wall, 1);
  wall.uniforms.uSeeK.value = 0.7;
  mirror._live(wall, 2);
  const w = LIVE_VECTORS.indexOf('uSeeK');
  assert.deepEqual(sent.filter((s) => s[0] === w).map((s) => s.slice(1).map((x) => +x.toFixed(4))), [[0.7, 0, 0, 0]]);
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

test('the holo table\'s planet reaches the port as its own (Hiraeth/Planet: the galactic map\'s colours and mark, not a white ball; issue #264)', async () => {
  const { planetMaterial, planetLook, MARK_IDS } = await import('../src/ship/approach.js');
  const m = planetMaterial('desert');
  m.uniforms.uInkK.value = 0.6; m.uniforms.uFreq.value = 0.45;
  const p = portMaterial(inkSpec(m), 4);
  const L = planetLook('desert');
  assert.equal(p.port, 'planet');
  assert.deepEqual(p.body, new THREE.Color(L.body).toArray().map((x) => +x.toFixed(5)));
  assert.equal(p.kind, MARK_IDS[L.mark] ?? 3);
  assert.equal(p.inkK, 0.6); assert.equal(p.freq, 0.45); assert.equal(p.light.length, 3);
  // (the ship's wall pictures and console screen take their no-canvas colours only where a page's canvases draw nothing;
  // the engines' draw now, engine/raster.js)
  const { hasCanvas } = await import('../src/ship/art.js');
  const had = globalThis.document;
  globalThis.document = { createElement: () => ({}), canvasDrawsNothing: true };
  try { assert.equal(hasCanvas(), false); } finally { if (had === undefined) delete globalThis.document; else globalThis.document = had; }
});

test('the game\'s canvases reach Unity as textures: sent before the material that names them, once, again when redrawn (issue #264)', async () => {
  const { PixelCanvas } = await import('../engine/raster.js');
  const sent = [], mats = [];
  const B = new UnityBackend({ Texture: (id, buf, w, h, flags) => sent.push({ id, bytes: buf.byteLength, w, h, flags, first: Array.from(new Uint8Array(buf, 0, 4)), mats: mats.length }), Material: (mid, json) => mats.push(JSON.parse(json)), Frame() {}, Geometry() {}, Create() {} });
  const c = new PixelCanvas(8, 4), g = c.getContext('2d');
  g.fillStyle = '#c8483a'; g.fillRect(0, 0, 8, 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = makeMaterial({ color: '#ffffff', map: tex, flat: true });
  B.material(1, inkSpec(m), m);
  assert.deepEqual([sent.length, sent[0].w, sent[0].h, sent[0].bytes, sent[0].mats], [1, 8, 4, 128, 0], 'its pixels first');
  assert.equal(sent[0].flags & 3, 3, 'three\'s flipY, sRGB');
  assert.deepEqual(sent[0].first, [200, 72, 58, 255]);
  assert.equal(mats[0].map, sent[0].id, 'the material names it');
  // on a second material: named, not sent again
  const m2 = makeMaterial({ color: '#ffffff', map: tex });
  B.material(2, inkSpec(m2), m2);
  assert.equal(sent.length, 1); assert.equal(mats[1].map, sent[0].id);
  // redrawn (needsUpdate, as the console's screen): sent at the next frame, once
  g.fillStyle = '#000000'; g.fillRect(0, 0, 1, 1); tex.needsUpdate = true;
  B.frame(); B.frame();
  assert.equal(sent.length, 2); assert.deepEqual(sent[1].first, [0, 0, 0, 255]);
  // a DataTexture's RGBA bytes (the Arena floor's markings) as they are, rows not flipped; a float one not at all
  const d = new THREE.DataTexture(new Uint8Array(16).fill(200), 2, 2); d.needsUpdate = true;
  const md = makeMaterial({ color: '#ffffff', map: d });
  B.material(3, inkSpec(md), md);
  assert.equal(sent.length, 3); assert.equal(sent[2].flags & 1, 0);
  const f = new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const mf = makeMaterial({ color: '#ffffff', map: f });
  B.material(4, inkSpec(mf), mf);
  assert.equal(sent.length, 3); assert.equal(mats[3].map, undefined);
  const none = makeMaterial({ color: '#ffffff' });
  B.material(5, inkSpec(none), none);
  assert.equal(mats[4].map, undefined);
  // the C# side: the texture made (rows bottom up for three's flipY), the Surface shader's _Map and _MapOn
  const { readFileSync } = await import('node:fs');
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs', import.meta.url), 'utf8');
  assert.match(cs, /public void Texture\(int tid, byte\[\] b, int n, int w, int h, int flags\)/);
  assert.match(cs, /int map = m\.I\("map"\);\s*\n\s*if \(map > 0\) UseMap/);
  const sh = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.match(sh, /if \(_MapOn > 0\.5\) albedo \*= SAMPLE_TEXTURE2D\(_Map, sampler_Map, I_FORM\.xy\)\.rgb;/);
});


test('the port\'s crowd figures read the costume as costumes.js packs it (the pieces worn, not the wrong ones)', async () => {
  const { MASK_ID_LIMIT, BODY_ID_LIMIT, HEAD_ID_LIMIT } = await import('../src/costumes.js');
  const { readFileSync } = await import('node:fs');
  const hlsl = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Crowd.hlsl', import.meta.url), 'utf8');
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
  const file = tempPath(join(tmpdir(), `hiraeth-engine-unity-${process.pid}.js`));
  await bundle('unity', { out: [file] });
  const calls = { Geometry: 0, Material: 0, Create: 0, Frame: 0, Look: 0, bytes: 0 };
  let lastFrame = null, look = null, screenJson = null, keyCalls = 0;
  // the menus (engine/menus.js, BridgeMenu.cs): the kind of each state sent, null when none is open
  const menus = [], panels = {}, grounds = [], maps = [];
  let closedAt = 0;
  const stages = [];   // (the loading screen's lines, BridgeHud.Loading.cs: issue #424)
  const loading = [];   // (the world's load from the title's choice, under the loading screen: issue #510)
  const progress = [];   // (the bar and the why line under the loading screen's line: issue #527)
  const cloths = {}, capes = {};
  const clothWords = (id) => { const c = cloths[id]; return 3 * c.N + 28 * c.K + 16 * c.B + 16; };
  // the sound (BridgeAudio.cs): a ring Unity drains at its rate, topped up by the script each frame
  const sound = { queued: 0, frames: 0, sumSq: 0, bad: 0, batches: 0 };
  const replay = new AudioReplay(48000), ended = [];
  // the recorded music (BridgeMusic.cs): every file decoded at once here (a minute long), its places and gains read back
  const music = { loads: [], natives: [], fetch: null };
  const BridgeHost = {
    Now: () => performance.now(), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Geometry(key, buf) { calls.Geometry++; calls.bytes += buf.byteLength; }, Material() { calls.Material++; },
    // the coral-shirt traveller's overshirt (BridgeCloth.cs): its description's header, for op 17's size
    FaceKeys(key, buf) { const u = new Uint32Array(buf); calls.Keys = (calls.Keys ?? 0) + 1; calls.keyVerts = (calls.keyVerts ?? 0) + u[2]; },
    Cloth(id, buf) { const h = new Uint32Array(buf, 0, 7); cloths[id] = { N: h[0], K: h[5], B: h[6] }; }, Create() { calls.Create++; }, SetMesh() {},
    // the people's capes (BridgeCape.cs): their descriptions' sizes, for op 20's; their points never read back here
    Cape(id, buf) { const h = new Uint32Array(buf, 0, 2); capes[id] = h[0] * h[1]; }, CapeState: () => null,
    Frame(buf) { calls.Frame++; lastFrame = buf; }, Look(json) { calls.Look++; look = json; }, Screen(json) { calls.Screen = (calls.Screen ?? 0) + 1; screenJson = json; }, ApplyMs: () => 0,
    // (on the title Enter once: New game, in the world it was started at; in the world W held, and Esc twice: the Start
    // menu open, then closed)
    // then J: the game menu (Quests), E: the Map (left open while its ground is drawn), J: closed
    // (the Map closed once its ground has come, at frame 70 at the soonest: its raster runs on a time budget a frame, so a
    // slow runner's frames take longer to finish it; away 6 frames after)
    Keys: () => (!calls.Frame ? (++keyCalls === 8 ? 'Enter' : '') : calls.Frame > 3 ? (({ 8: 'KeyW,Escape', 12: 'KeyW,Escape', 14: 'KeyW,KeyJ', 16: 'KeyW,KeyE' }[calls.Frame]) ?? (!closedAt && calls.Frame >= 70 && maps.length ? (closedAt = calls.Frame, 'KeyW,KeyJ') : 'KeyW')) : ''),
    Menu(json) { const v = JSON.parse(json); menus.push(v?.kind ?? null); if (v?.kind === 'game') panels[v.panel] = v; if (v?.map?.ground) grounds.push(v.map.ground); },
    // the Map's drawn ground (BridgeMenu.SetMap), before the state that names it
    MapImage(key, buf, w, h) { maps.push({ key, bytes: buf.byteLength, w, h, sentBefore: !grounds.includes(key), inked: new Uint8Array(buf).some((x, i) => i % 4 === 0 && x < 80) }); },
    // (gone away at frame 76, BridgeRunner.Away: the Steam button, a suspend; back, the game waits under the Start menu)
    AwayCount: () => (closedAt && calls.Frame >= closedAt + 6 ? 1 : 0),
    LoadStage(t) { stages.push(t); },
    LoadProgress(p, why) { progress.push({ p, why, loading: loading.length, stages: stages.length }); },
    Loading(on) { loading.push({ on, frames: calls.Frame, menus: menus.length, stages: stages.length }); },
    MenuWidth: () => 960, MenuMapBox: () => '878,508', PadName: () => 'Retroid Pocket Controller', Platform: () => 'android', Pad: () => null, MouseLook: () => null, Shot() {}, WriteText() {}, LastFrameCpuMs: () => 0, LastFrameGpuMs: () => 0, Exit() {},
    AudioRate: () => 48000, AudioQueued: () => sound.queued,
    Audio(buf) { const f = new Float32Array(buf); sound.queued += f.length / 2; sound.frames += f.length / 2; for (const x of f) { if (!Number.isFinite(x)) sound.bad++; sound.sumSq += x * x; } },
    // the sound rendered on Unity's audio thread (BridgeRunner.RunAudio, engine/unity/audio-worker.js): its batches played here as there
    AudioThreaded: () => true,
    AudioBatch(buf) { sound.batches++; const r = replay.apply(new Float64Array(buf)); if (r.pcm.length) BridgeHost.Audio(r.pcm.slice().buffer); if (r.ended.length) ended.push(...r.ended); if (replay.natives) BridgeHost.AudioNatives(replay.natives); },
    MusicLoad(path) { music.loads.push(path); return music.loads.length; }, MusicState: () => `ok,2,${48000 * 60},48000`,
    AudioNatives(text) { music.natives.push(text); }, MusicFetch(list, carried) { music.fetch = { list, carried }; },
    AudioEndedTake: () => { const s = ended.join(','); ended.length = 0; return s; },
  };
  // (no timers of the VM's own, as in Puerts: engine/platform.js runs them from the frame)
  const { exports, readFile } = loadBundle(file, {}, { CS: { Hiraeth: { Bridge: { BridgeHost } } }, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined });
  BridgeHost.ReadFile = readFile;
  const errors = [];
  const warn = console.warn, info = console.info, log = console.log, error = console.error; console.warn = console.info = console.log = () => {}; console.error = (...a) => errors.push(a.map(String).join(' ').slice(0, 300));
  try {
    exports.start(JSON.stringify({ level: 'glassdunes' }));   // (the Sealed Hangar's successor; since issue #347 its mechanics' crowd wears no capes)
    for (let i = 0; i < 2000 && !calls.Frame; i++) { await new Promise((r) => setTimeout(r, 30)); exports.frame(1 / 30); }   // (the world builds first: up to a minute on a busy machine)
    // (the promises settled between frames, as Puerts' V8 does after each call: a recording Unity decoded comes in)
    for (let i = 0; i < 400 && !(closedAt && calls.Frame >= closedAt + 10); i++) { exports.frame(1 / 30); sound.queued = Math.max(0, sound.queued - 1600); await new Promise((r) => setImmediate(r)); }
  } finally { console.warn = warn; console.info = info; console.log = log; console.error = error; }
  assert.ok(calls.Frame >= 20, `frames: ${JSON.stringify(calls)} ${errors.join(' | ')}`);
  // the loading screen told what the build is on, main.js's stages in its order (issue #424)
  assert.deepEqual(stages, ['sketching the glass dunes…', 'inking the collisions…', 'waking the people…', 'mixing the inks…'], JSON.stringify(stages));
  // and the screen itself up from the title's choice (the title sent first), before the build's first line, until the
  // world's first frame has played (its commands sent): issue #510, where Unity stayed on the title's "…"
  assert.deepEqual(loading.map((l) => l.on), [true, false], JSON.stringify(loading));
  assert.ok(loading[0].menus >= 1 && loading[0].frames === 0 && loading[0].stages === 0, JSON.stringify(loading[0]));
  assert.ok(loading[1].frames >= 1 && loading[1].stages === 4, JSON.stringify(loading[1]));
  // and how far it has come, with why (engine/game.js onLoad, src/load-page.js; BridgeHost.LoadProgress, issue #527): from
  // the start, after the screen went up, never back, through every stage, full as the world's first frame plays, before
  // the screen fades; the why lines the page's own
  assert.ok(progress.length >= 10 && progress.every((x) => x.loading === 1), JSON.stringify(progress));
  assert.ok(progress[0].p === 0 && progress[0].stages === 1, JSON.stringify(progress[0]));
  progress.forEach((x, i) => assert.ok(typeof x.p === 'number' && x.p >= 0 && x.p <= 1 && (!i || x.p >= progress[i - 1].p), `the bar went back: ${JSON.stringify(progress)}`));
  assert.equal(progress.at(-1).p, 1);
  assert.ok(progress.some((x) => x.why === LOAD_WHY.world) && progress.some((x) => x.why === LOAD_WHY.batches) && progress.some((x) => x.why === LOAD_WHY.surfaces), JSON.stringify(progress.map((x) => x.why)));
  assert.ok(progress.every((x) => x.why === '' || Object.values(LOAD_WHY).includes(x.why)), JSON.stringify(progress.map((x) => x.why)));
  const runner = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs', import.meta.url), 'utf8');
  assert.match(runner, /\(!booted \|\| BridgeHost\.WorldLoading\) && !bootBlocking/, 'Unity draws on (the loading screen, the Xbox\'s pipelines warming) while the world builds');
  const hudLoad = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Loading.cs', import.meta.url), 'utf8');
  assert.match(hudLoad, /if \(world && !loadWorld\)/);
  assert.match(runner, /if \(yieldToLoad && BridgeHost\.WorldLoading\) \{ awaitYielded = true; return true; \}/, 'not waited out on the title as the build begins');
  assert.match(hudLoad, /overrideSorting = true/, 'over the title\'s canvas');
  // the C# draws it: the bar's red fill as far as BridgeHost.LoadP (eased, never past it), the why line from LoadWhy;
  // BridgeHost keeps the furthest and empties both as a load begins
  assert.match(hudLoad, /loadBarFill = Ui\.Rect\(loadBar, LoadNib/);
  assert.match(hudLoad, /loadShown = Mathf\.Min\(p, /);
  assert.match(hudLoad, /var why = BridgeHost\.LoadWhy/);
  const hostCs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs', import.meta.url), 'utf8');
  assert.match(hostCs, /public static void LoadProgress\(double p, string why\)\s*\{\s*if \(p > LoadP\)/);
  assert.match(hostCs, /public static void Loading\(bool on\) \{ if \(on\) LoadReset\(\);/);
  // the title first, gone once the world was ready; the Start menu over the world, and closed again
  assert.deepEqual(menus.filter((k, i) => k !== menus[i - 1]), ['title', null, 'start', null, 'game', null, 'start'], JSON.stringify(menus));
  // the game menu's panels filled from the world running (engine/game.js menuSources): the father's charge, the map's marks
  assert.ok(panels.quests?.rows.length >= 1, JSON.stringify(panels.quests));
  assert.ok(panels.map?.map.marks.some((m) => m.kind === 'you'), JSON.stringify(panels.map?.map));
  // its ground drawn from the world's collision (engine/game.js WorldMap, engine/raster.js), sent once, before it shows; at
  // the shape of the room BridgeMenu has for it (the Retroid's 4:3: 878 × 508, a map 1.7 times as wide as tall, issue #343)
  assert.equal(maps.length, 1, JSON.stringify(maps));
  assert.equal(panels.map.map.aspect, 1.7);
  assert.deepEqual([maps[0].w, maps[0].h, maps[0].bytes, maps[0].sentBefore, maps[0].inked], [1088, 640, 1088 * 640 * 4, true, true]);
  // the whole sheet, the cursor on the traveller, no list
  assert.deepEqual(panels.map.rows, []);
  const you = panels.map.map.marks.find((m) => m.kind === 'you');
  assert.ok(Math.abs(panels.map.map.cursor[0] - you.x) < 1e-3 && Math.abs(panels.map.map.cursor[1] - you.y) < 1e-3, JSON.stringify(panels.map.map));
  assert.equal(panels.map.map.ground, maps[0].key);
  // on the Retroid (BridgeHost.Platform: android): the prompts in its own names, the menus' confirm the printed A
  assert.match(panels.map.hint, /^L2 \/ R2 zoom · A zoom in · L1\/R1 turn · B close$/, panels.map.hint);
  assert.deepEqual(panels.map.keys, { ok: 'A', back: 'B', prev: 'L1', next: 'R1' });
  assert.ok(calls.Create > 50 && calls.Material > 5 && calls.Geometry > 20, JSON.stringify(calls));
  assert.ok(JSON.parse(look).hours[0].skyTop.length === 3, 'the look in the port\'s format');
  assert.ok(calls.Screen >= 1 && 'dialogue' in JSON.parse(screenJson), 'the screen\'s state for the HUD');
  assert.ok(sound.frames >= 20 * 1600 && sound.queued <= 48000 * 0.12 + 128, `the sound kept a little ahead: ${JSON.stringify(sound)}`);
  assert.equal(sound.bad, 0, 'every sample finite');
  assert.ok(sound.batches >= 20, `the sound recorded and played elsewhere: ${sound.batches} batches`);
  assert.ok(Math.sqrt(sound.sumSq / (sound.frames * 2)) > 1e-5, 'and something to hear (the wind)');
  // the recorded music: the title's, then the world's theme, decoded by Unity and played where the graph says, faded in
  assert.deepEqual(music.loads, ['music/title.mp3', 'music/glassdunes.mp3'], JSON.stringify(music.loads));
  const lines = music.natives.flatMap((t) => (t ? t.split(';') : [])).map((l) => l.split(',').map(Number));
  assert.ok(lines.some((l) => l[1] === 1), 'the title\'s recording played on the title');
  const world = lines.filter((l) => l[1] === 2);
  assert.ok(world.length > 20 && world.at(-1)[3] > 0.01 && world.at(-1)[5] === 1 && world.at(-1)[6] === 2, `the world's theme, looped, faded in: ${JSON.stringify(world.at(-1))}`);
  assert.equal(music.fetch?.list.split(';')[0].split(' ')[0], 'glassdunes.mp3', 'the themes the package lacks fetched, this world\'s first');
  // the last frame's commands parse to the end
  const u = new Uint32Array(lastFrame);
  let o = 0, ops = 0;
  const size = { 1: () => 1 + u[o] * 17, 2: () => 2, 3: () => 3 + u[o + 1] * 16 + (u[o + 2] ? u[o + 1] * 3 : 0), 4: () => 2 + u[o + 1] * 16, 5: () => 19, 6: () => 1, 7: () => 2 + u[o + 1] * 16, 8: () => 3 + u[o + 1] * 3 + (u[o + 2] & 1 ? u[o + 1] * 3 : 0) + (u[o + 2] & 2 ? u[o + 1] : 0) + (u[o + 2] & 4 ? u[o + 1] * 4 : 0), 9: () => 3 + u[o + 1] * 32, 10: () => 2 + u[o + 1] * 8, 11: () => 1 + u[o] * 4, 12: () => 5 + u[o + 4] * 4, 13: () => 19, 14: () => 4, 15: () => 5, 16: () => 30, 17: () => 4 + clothWords(u[o]), 18: () => 6, 19: () => 2 + u[o + 1], 20: () => capePacketWords(u, o, capes[u[o]]) };
  const skeletons = [];
  assert.equal(Object.keys(cloths).length, 1, 'the overshirt done by the C# side (BridgeCloth)');
  assert.ok(calls.Keys > 0 && calls.keyVerts > 0, `the MakeHuman faces' shape keys as blend shapes: ${calls.Keys} meshes`);
  // (since issue #347 few wear one: Halden by the ship does, the crowd near seldom)
  assert.ok(Object.keys(capes).length >= 1, `the capes done by the C# side (BridgeCape): ${Object.keys(capes).length}`);
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
  assert.equal(pm.vmat, 1, 'the port\'s variant that reads them (HIRAETH_VMAT)');
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

// A deadly drop's dark (src/pit-void.js, issue #312) in the Unity bridge: not drawn there before (its ShaderMaterial fell to
// the port's Surface); now the bridge's Hiraeth/PitVoid, over the ink, with the box, its frame and its look.
test('a deadly drop\'s dark: on Hiraeth/PitVoid with its frame, box and look, over the ink, no shadow', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const { pitVoid, PIT_VOID } = await import('../src/pit-void.js');
  const frame = new THREE.Matrix4().makeRotationY(0.7).setPosition(30, 2400, -12);
  const v = pitVoid(null, { min: [-4, -6, -3], max: [4, 0, 3], frame, color: '#120b18', ring: '#70e7df' });
  const pm = portMaterial(inkSpec(v.mesh.material), 5);
  assert.equal(pm.port, 'pitvoid');
  assert.equal(pm.inv.length, 16);
  const inv = new THREE.Matrix4().fromArray(pm.inv), p = new THREE.Vector3(1, -2, 0.5);
  assert.ok(p.clone().applyMatrix4(frame).applyMatrix4(inv).distanceTo(p) < 1e-3, 'three\'s world into the box\'s frame');
  assert.deepEqual(pm.min, [-4, -6, -3]); assert.deepEqual(pm.max, [4, 0, 3]);
  assert.deepEqual(pm.look, [Math.min(PIT_VOID.fade, 6), PIT_VOID.dark, PIT_VOID.steps]);
  assert.deepEqual(pm.rings, [PIT_VOID.ring, PIT_VOID.turn, 1]);
  assert.equal(pm.side, 1, 'its inside faces');
  // the mirror's node: drawn, casting no shadow (as the washes)
  const made = [], H = { Material: () => {}, Create: (id, j) => made.push(JSON.parse(j)), Geometry: () => {} };
  const B = new UnityBackend(H);
  B.material(5, inkSpec(v.mesh.material));
  B.create(9, { kind: 'mesh', gid: 0, mids: [5], name: 'pit', shadow: true });
  assert.equal(made[0].shadow, false);
  const sh = read('unity/Hiraeth/Assets/Hiraeth/Shaders/PitVoid.shader');
  assert.match(sh, /Shader "Hiraeth\/PitVoid"/);
  assert.match(sh, /Cull Front/, 'three\'s BackSide through the mirror\'s flipped winding');
  assert.match(sh, /_GNormalTex\.Load/, 'the scene\'s depth read by hand');
  const guid = /guid: ([0-9a-f]{32})/.exec(read('unity/Hiraeth/Assets/Hiraeth/Shaders/PitVoid.shader.meta'))[1];
  assert.ok(read('unity/Hiraeth/ProjectSettings/ProjectSettings.asset').includes(`guid: ${guid}, type: 3}`), 'preloaded (BridgeBuild.KeepShaders, issue #500): Shader.Find finds it in a player');
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), /m\.S\("port"\) == "pitvoid"/);
});

// The light pools gone in Unity pictures (the Rose House's flame, its fires and cistern): the bridge's look, sent again
// whenever it moves, cleared the local lights (HiraethLook.Load with no list) and sent the shader none before the next
// op 11. The look keeps them now; the off-screen cull (#262) is measured against the picture's own frustum in a shot.
test('the bridge\'s look keeps the local lights; a shot culls them to its own frustum', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const look = read('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethLook.cs');
  const load = look.slice(look.indexOf('public void Load('), look.indexOf('public void SetLocalLights'));
  assert.match(load, /if \(lights != null\)\s*\{\s*localLights\.Clear\(\);/, 'cleared only when a list comes with the look');
  assert.match(look, /public void PushLights\(\)/);
  const shot = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(shot, /cam\.targetTexture = rt;\s*\n\s*\/\/[^\n]*\n\s*if \(look\) \{ look\.PushLights\(\);/, 'the shot\'s lights culled once its target is set');
});

test('the title\'s logo laid out for the screen the menus have now: a cold start\'s first frames, a turn to landscape, a resize (issue #470)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-unity-title-${process.pid}.js`));
  await bundle('unity', { out: [file] });
  // the menus' canvas width as BridgeMenu sets it (720 units high): 1280 until its first Update (BridgeHost's default),
  // then the Retroid's panel upright for a frame or two (960 × 1280: 540), then its landscape 4:3 (960); then a 16:9 window
  let width = 1280;
  const sent = [];
  const BridgeHost = new Proxy({
    Now: () => performance.now(), ReadFile: null, StorageGet: () => null, StorageSet() {}, StorageRemove() {},
    Keys: () => '', Pad: () => null, MouseLook: () => null, PadName: () => '', Platform: () => 'android', AudioRate: () => 0,
    MenuWidth: () => width, MenuMapBox: () => '', AwayCount: () => 0, Exit() {}, Shot() {},
    Menu(json) { sent.push(JSON.parse(json)); },
  }, { get: (o, k) => (k in o ? o[k] : undefined) });
  const { exports, readFile } = loadBundle(file, {}, { CS: { Hiraeth: { Bridge: { BridgeHost } } }, setTimeout: undefined, setInterval: undefined, clearTimeout: undefined, clearInterval: undefined });
  BridgeHost.ReadFile = readFile;
  const log = console.log, info = console.info; console.log = console.info = () => {};
  const at = {};
  try {
    exports.start('{}');
    for (const [w, frames] of [[1280, 1], [540, 2], [960, 3], [1280, 2], [960, 2]]) {
      width = w;
      for (let i = 0; i < frames; i++) exports.frame(1 / 60);
      const v = sent.at(-1);
      at[w] = v;
      // the title's last state is laid out on the canvas it is drawn on now: the name centred, inside the screen
      assert.equal(v?.kind, 'title', JSON.stringify(v)?.slice(0, 200));
      const L = v.layout.logo;
      assert.ok(Math.abs(L.x + L.w / 2 - w / 2) < 1, `the name centred on a canvas ${w} wide: ${JSON.stringify(L)}`);
      assert.ok(L.x >= 0 && L.x + L.w <= w, `inside it: ${JSON.stringify(L)}`);
    }
  } finally { console.log = log; console.info = info; }
  // the Retroid's 4:3 as the web's at 1280 × 960 (src/title-layout.js there, × 0.75 for the canvas 720 high): 86 % of the width
  assert.ok(Math.abs(at[960].layout.logo.w - 960 * 0.86) < 1, JSON.stringify(at[960].layout.logo));
  // and nothing sent again while the screen stays as it was
  const n = sent.length; exports.frame(1 / 60); exports.frame(1 / 60);
  assert.equal(sent.length, n, 'the same state not sent again');
});
