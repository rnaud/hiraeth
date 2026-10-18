// Issue #264, surfaces D: the Unity bridge's "barely seen" surfaces (docs/systems/engine-bridge.md, "Surfaces D"): the
// traveller's portrait head moving (its morph targets as blend shapes, its drawn blink and mouth), the plants' own lean as
// he brushes past, the traveller cut while the lens is in him, white lines, a room's least hatch spacing, the crowd's
// shadow-only material drawing nothing; what crosses the bridge, and the port's copies of the web's numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SceneMirror, LIVE_VECTORS } from '../engine/mirror.js';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { morphKeys, morphKeyDeltas } from '../engine/unity/backend.js';
import { makeMaterial, INK_WHITE } from '../src/materials.js';

THREE.ColorManagement.enabled = false;
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SHADERS = 'unity/Hiraeth/Assets/Hiraeth/Shaders';
const SURFACE = read(`${SHADERS}/Surface.shader`), COMPOSITE = read(`${SHADERS}/Composite.shader`), FACE = read(`${SHADERS}/PortraitFace.hlsl`);
const HEAD = read('src/characters/portrait-head.js'), MATERIALS = read('src/materials.js');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), LOADER = read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs');

test('three\'s morph targets as blend shapes: only the vertices each moves, x mirrored; relative or not', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const blink = new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0, 0, 0], 3), open = new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0.25, 0, 0.1], 3);
  g.morphAttributes.position = [blink, open];
  g.morphTargetsRelative = true;
  const mk = morphKeys(g);
  assert.ok(mk && mk.relative && mk.morph.length === 2);
  const b = morphKeyDeltas(mk, 3), u = new Uint32Array(b), f = new Float32Array(b);
  assert.deepEqual([u[0], u[1], u[2], u[3]], [2, 3, 1, 1], 'two keys, three vertices; the first moves vertex 1');
  assert.deepEqual([f[4], f[5], f[6]], [-0, -0.5, 0].map(Math.fround));
  assert.deepEqual([u[7], u[8], f[9], f[10], f[11]], [1, 2, -0.25, 0, Math.fround(0.1)], 'the second: vertex 2, x mirrored');
  // (absolute targets: less the rest position)
  const h = new THREE.BufferGeometry();
  h.setAttribute('position', new THREE.Float32BufferAttribute([1, 1, 1], 3));
  h.morphAttributes.position = [new THREE.Float32BufferAttribute([1, 2, 1], 3)];
  const hf = new Float32Array(morphKeyDeltas(morphKeys(h), 1));
  assert.equal(hf[5], 1, "y up a metre"); assert.equal(hf[6], 0);
  assert.equal(morphKeys(new THREE.BoxGeometry()), null, 'none without morph targets');
});

test('mirror: a mesh\'s morphTargetInfluences go as its keys\' weights when they move (the portrait head\'s blink)', () => {
  const keys = [];
  const mirror = new SceneMirror({ material: () => {}, materialLive: () => {}, materialVec: () => {}, keyWeights: (id, w) => keys.push(Array.from(w)) });
  const scene = new THREE.Scene(), g = new THREE.BoxGeometry();
  g.morphAttributes.position = [g.attributes.position.clone()];
  const head = new THREE.Mesh(g, makeMaterial({ color: '#c08060' }));
  head.updateMorphTargets();
  scene.add(head);
  mirror.sync(scene, null); mirror.sync(scene, null);
  assert.equal(keys.length, 1, 'as they are, once');
  head.morphTargetInfluences[0] = 0.9;
  mirror.sync(scene, null);
  assert.ok(Math.abs(keys[1][0] - 0.9) < 1e-6, 'the blink');
});

test('the portrait head\'s face reaches the port: _TripoFace 2, its fit, its mouth and blink live', () => {
  const m = makeMaterial({ color: '#ffffff', figure: true }).clone();
  Object.assign(m.uniforms, { uHeadSpeech: { value: new THREE.Vector4(0.4, 0.2, 0, 0) }, uPortraitBlink: { value: 0 } });
  m.userData.portraitFace = [-0.001, 1.487, -0.006, 0.28, 0.293];
  const p = portMaterial(inkSpec(m), 1);
  assert.equal(p.tripoFace, 2);
  assert.deepEqual(p.phFit, [-0.001, 1.487, -0.006, 0.28]); assert.deepEqual(p.phFit2, [0.293, 0, 0, 0]);
  assert.deepEqual(p.phSpeech, [0.4, 0.2, 0, 0]);
  for (const k of ['uHeadSpeech', 'uPortraitBlink', 'uCutMe', 'uLineWhite']) assert.ok(LIVE_VECTORS.includes(k), k);
  const cs = RENDERER.match(/static readonly string\[\] LiveVectors = \{([^}]+)\}/)[1].match(/"[^"]+"/g);
  assert.deepEqual(['uHeadSpeech', 'uPortraitBlink', 'uCutMe', 'uLineWhite'].map((k) => cs[LIVE_VECTORS.indexOf(k)]), ['"_PhSpeech"', '"_PhBlink"', '"_CutMe"', '"_LineWhite"']);
  for (const k of ['phFit', 'phFit2', 'phSpeech', 'phBlink', 'surfD', 'cutMe', 'lineWhite']) assert.ok(LOADER.includes(`("${k}", "_`), `WorldLoader sets ${k}`);
  // (and engine/game.js gives the head its fit from the head's own: portrait-head.js mouthY)
  assert.ok(read('engine/game.js').includes('head.material.userData.portraitFace = [...F.offset, F.scale, F.mouthY]'));
});

test('PortraitFace.hlsl draws the web\'s blink line and open mouth (portrait-head.js\'s numbers)', () => {
  for (const n of ['.052,.063', '.024,.033', '.82,.99', '.0015,.0030', '.087-.013*ho', '.022*ho', '.92,1.0', '.02,.08', '.14,.055,.045', '.16,.085,.045', '.118:.125,.522'])
    assert.ok(HEAD.replace(/\s/g, '').includes(n.replace('.118:', '-.118:')), `portrait-head.js still ${n}`);
  for (const n of ['0.052, 0.063', '0.024, 0.033', '0.82, 0.99', '0.0015, 0.0030', '0.087 - 0.013 * ho', '0.022 * ho', '0.92, 1.0', '0.02, 0.08', '0.14, 0.055, 0.045', '0.16, 0.085, 0.045', '-0.118 : 0.125, 0.522'])
    assert.ok(FACE.includes(n), `PortraitFace.hlsl ${n}`);
  assert.match(SURFACE, /_TripoFace > 1\.5 \? portraitFace\(albedo, I_BIND\) : tripoFace\(/);
  assert.match(SURFACE, /#include "PortraitFace.hlsl"/);
});

test('a room\'s least hatch spacing, a plant\'s own height, the traveller cut, a white line: what the port sends', () => {
  const room = portMaterial(inkSpec(makeMaterial({ color: '#888', hatchPx: 7 })), 1);
  assert.deepEqual(room.surfD, [7, 0, 0, 0]);
  assert.match(SURFACE, /max\(max\(hsp0 \/ min\(hDense, 1\.3\), min\(hsp0, 4\.5\)\), _SurfD\.x\)/);
  assert.ok(MATERIALS.includes('uHatchPx);'), 'materials.js: hsp\'s floor is uHatchPx');
  const plant = portMaterial(inkSpec(makeMaterial({ color: '#5e7a3a', sway: 0.2, swayH: 0.8, swayLarge: true })), 2);
  assert.deepEqual(plant.surfD, [0, 0.8, 1, 0]);
  const plain = portMaterial(inkSpec(makeMaterial({ color: '#888' })), 3);
  assert.equal(plain.surfD, undefined); assert.equal(plain.cutMe, undefined); assert.equal(plain.lineWhite, undefined);
  const hero = makeMaterial({ color: '#888' }); hero.uniforms.uCutMe.value = 1;
  assert.deepEqual(portMaterial(inkSpec(hero), 4).cutMe, [1, 0, 0, 0]);
  assert.deepEqual(portMaterial(inkSpec(makeMaterial({ color: '#111', lineWhite: true })), 5).lineWhite, [1, 0, 0, 0]);
  // a mover (a foe, the drone: materials.js MOVER): +64 in the G-buffer's hatch.a, seen past by the crease shading's taps
  assert.deepEqual(portMaterial(inkSpec(makeMaterial({ color: '#334', mover: true })), 6).surfD, [0, 0, 0, 1]);
  assert.ok(MATERIALS.includes('+ 64.0 * uMover;'));
  assert.ok(SURFACE.includes('+ 32.0 * _Drift + 64.0 * _SurfD.w;'));
  assert.ok(COMPOSITE.includes('float mover = step(63.5, surface.a);') && COMPOSITE.includes('max(step(ha, 63.5), self)') && COMPOSITE.includes('creaseAO(uv, N.xyz, depth, mover,'));
  assert.ok(COMPOSITE.includes('float4 fa = fmod(float4(t1.a, t2.a, t3.a, t4.a), 64.0);'), 'the lines\' taps: the mover\'s +64 off before banked sand\'s 32 is read');
});

test('the plants lean as the web\'s do when he brushes past (materials.js SWAY\'s numbers in floraPlace)', () => {
  const web = MATERIALS.replace(/\s/g, ''), port = SURFACE.replace(/\s/g, '');
  for (const n of ['clamp(0.3+0.35*plantH,0.45,1.1)', 'brushLean(swayAt,reach*0.35,reach,2.5)', '0.6*min(wy,1.3)/1.3*(1.0-smoothstep(1.3,2.2,wy))', 'rel*rel*clamp(plantH/1.3,0.3,1.2)'])
    assert.ok(web.includes(n), `materials.js ${n}`);
  for (const n of ['clamp(0.3+0.35*plantH,0.45,1.1)', 'reach*0.35,reach,2.5)', '0.6*min(wy,1.3)/1.3*(1.0-smoothstep(1.3,2.2,wy))', 'rel*rel*clamp(plantH/1.3,0.3,1.2)'])
    assert.ok(port.includes(n), `Surface.shader ${n}`);
});

test('the traveller cut in the G-buffer pass only (his shadow kept), and white lines in the composite', () => {
  assert.match(SURFACE, /Varyings vertEntry\(Attributes v\) \{ Varyings o = vert\(v\); if \(_HeroCut \* _CutMe\.x > 0\.5\) o\.positionCS = float4\(2, 2, 2, 1\)/);
  const shadow = SURFACE.slice(SURFACE.indexOf('Name "ShadowCaster"'));
  assert.ok(!shadow.includes('_HeroCut'), 'not in the shadow caster');
  assert.ok(read('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethLook.cs').includes('Shader.SetGlobalFloat("_HeroCut", shared.F("uHeroCut", 0))'));
  assert.match(SURFACE, /if \(_LineWhite\.x > 0\.5\) o\.albedoLight\.a = -1\.0 - o\.albedoLight\.a;/);
  assert.match(COMPOSITE, /float lightOf\(float a\) \{ a = a < 0\.0 \? -a - 1\.0 : a;/);
  assert.ok(COMPOSITE.includes(`if (Ao.a < 0.0) lineC = float3(${INK_WHITE.join(', ')});`), 'the paper\'s white, INK_WHITE');
});

test('the crowd\'s shadow casters (no colour written) draw nothing in Unity', () => {
  const m = new THREE.ShaderMaterial({ uniforms: {}, vertexShader: 'void main() {}', fragmentShader: 'void main() {}', colorWrite: false });
  assert.equal(portMaterial(inkSpec(m), 1).port, 'hidden');
  assert.ok(read('src/crowd.js').includes('colorWrite: false'), 'crowd.js crowdDepthMaterial still writes no colour');
});
