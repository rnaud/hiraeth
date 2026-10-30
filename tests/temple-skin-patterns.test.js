// The temples' futuristic skins in the engines (src/temples/skins/skin-shader.js, issue #342): each skin declares its
// pattern once; the web's shader is spliced from it as before, the bridge sends a skinned material's pattern as data
// (its number, its uniforms packed), and the Unity port's SkinPatterns.hlsl is made from the same GLSL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { TempleRuntime } from '../src/temples/runtime.js';
import { GameState } from '../src/game-state.js';
import { makeMaterial } from '../src/materials.js';
import { SKIN_ORDER, BODIES_PER_SKIN, skinShaders, skinLayout, skinPatternSpec, spliceSkin } from '../src/temples/skins/skin-shader.js';
import { ROSE_SKIN } from '../src/temples/skins/rose-house.js';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { SceneMirror } from '../engine/mirror.js';
import { OP } from '../engine/unity/pack.js';
import { loadSkins, skinHlsl, SKIN_HLSL_PATH } from '../scripts/unity-export/skin-hlsl.mjs';

const ground = new Proxy({}, { get: (t, k) => (k === 'normalAt' ? () => new THREE.Vector3(0, 1, 0) : () => 0) });
const build = (id) => new TempleRuntime({ scene: new THREE.Scene(), level: { lights: [], ground }, def: TEMPLES[id].def, game: new GameState(null) });
let rose = null, well = null;
const roseRt = () => (rose ??= build('desert'));
const wellRt = () => (well ??= build('incal'));
/** Every material the house drew with a skin's pattern. */
function patterned(rt) {
  const out = new Set();
  rt.root.traverse((o) => { for (const m of [o.material].flat()) if (m?.userData?.skinPattern) out.add(m); });
  return [...out];
}

test('every skin declares its pattern: in SKIN_ORDER, each body its own number', async () => {
  const all = await loadSkins();
  assert.deepEqual(all.map((s) => s.id), SKIN_ORDER, 'all thirteen houses and the Whale-House\'s sea, in order');
  const seen = new Set();
  for (const S of all) {
    const names = Object.keys(S.bodies);
    assert.ok(names.length >= 1 && names.length <= BODIES_PER_SKIN, S.id);
    for (const b of names) { const n = S.number(b); assert.ok(n > 0 && !seen.has(n), `${S.id} ${b}: ${n}`); seen.add(n); }
    assert.ok(S.layout.slots > 0 && S.layout.slots <= 64, `${S.id}: ${S.layout.slots} slots`);
  }
});

test('a uniform layout: one vec4 slot a scalar or vector, one an array\'s element, in pars order', () => {
  const L = skinLayout('uniform vec3 uA;\n uniform vec4 uR[16];\n uniform int uN;\n uniform vec2 uC;');
  assert.deepEqual(L.map((e) => [e.name, e.slot, e.n]), [['uA', 0, null], ['uR', 1, 16], ['uN', 17, null], ['uC', 18, null]]);
  assert.equal(L.slots, 19);
});

test('the web\'s shader is spliced as the skins did by hand: the body over the albedo, its lines and glow the surface\'s', async () => {
  const [S] = (await loadSkins()).filter((s) => s.id === 'rose-house');
  const m = makeMaterial({ flat: true, color: '#5e5462', key: 'test.skin.splice' });
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  // (rose-house.js before skin-shader.js, word for word)
  const old = S.pars + S.defines + fs.slice(0, at) + S.glsl + fs.slice(at).replace('vec3 albedo = uColor;', S.bodies.slab)
    .replace('float detail = 0.0;', 'float detail = skInk;').replace('float emit = 0.0;', 'float emit = skEmit;');
  spliceSkin(m, S, 'slab');
  assert.equal(m.fragmentShader, old);
  assert.deepEqual(m.userData.skinPattern, { skin: 'rose-house', body: 'slab' });
});

test('the Rose House\'s skinned materials carry their pattern to the bridge: the number, the uniforms packed, to the port', () => {
  const rt = roseRt();
  const mats = patterned(rt);
  const bodies = new Set(mats.map((m) => m.userData.skinPattern.body));
  for (const b of ['slab', 'plates', 'basin']) assert.ok(bodies.has(b), `its ${b}`);
  const wall = rt.skin.mats.wall, spec = inkSpec(wall);
  assert.ok(spec.skin, 'the ink spec has the pattern');
  const S = skinShaders().find((s) => s.id === 'rose-house');
  assert.equal(spec.skin.body, S.number('slab'));
  assert.equal(spec.skin.data.length, S.layout.slots * 4);
  // the ember (uSkE) and the slabs' sizes (uSkP) where the layout puts them
  const slot = (name) => S.layout.find((e) => e.name === name).slot * 4;
  const ember = new THREE.Color(ROSE_SKIN.ember);
  assert.ok(Math.abs(spec.skin.data[slot('uSkE')] - ember.r) < 1e-6 && Math.abs(spec.skin.data[slot('uSkE') + 2] - ember.b) < 1e-6, 'the ember');
  assert.deepEqual(spec.skin.data.slice(slot('uSkP'), slot('uSkP') + 4).map((x) => +x.toFixed(4)), ROSE_SKIN.wall.size);
  assert.ok(Math.abs(spec.skin.data[slot('uSkinO') + 1] - rt.kit.origin.y) < 1e-3, 'the house\'s origin');
  const port = portMaterial(spec, 7);
  assert.equal(port.skinPattern, spec.skin.body);
  assert.equal(port.skinData.length, spec.skin.data.length);
  // a material with no pattern sends none
  assert.equal(inkSpec(makeMaterial({ color: '#ffffff' })).skin, undefined);
  assert.equal(portMaterial(inkSpec(makeMaterial({ color: "#ffffff" }))).skinPattern, undefined);
});

test('the Rose House\'s walls stay quiet (issue #739): few circuits, none held under a few pixels, in the web and the port', () => {
  // (a circuit in over half the wall's strips, each trace held at a pixel's width however far: on the Handheld preset
  // the walls' lines came and went as the view moved, 28 flicker events in 10 000 px a frame down the Great Hall)
  assert.ok(ROSE_SKIN.wall.more[1] <= 0.2, `the wall's circuit share: ${ROSE_SKIN.wall.more[1]}`);
  assert.equal(ROSE_SKIN.wall.more[0], 0, 'no panel inset of the skin\'s own on the walls (the machined finish has its border)');
  assert.ok(ROSE_SKIN.thin[0] >= 1 && ROSE_SKIN.thin[1] > ROSE_SKIN.thin[0], `the fade's widths: ${ROSE_SKIN.thin}`);
  const S = skinShaders().find((s) => s.id === 'rose-house');
  const circuit = S.glsl.slice(S.glsl.indexOf('void rhCircuit'), S.glsl.indexOf('}', S.glsl.indexOf('void rhCircuit')));
  for (const k of ['kT', 'kD', 'kN']) assert.ok(circuit.includes(`${k} = smoothstep(RH_THIN.x, RH_THIN.y, `), `its fade ${k}`);
  assert.match(circuit, /rhCov\(T\.x, [0-9.]+, pxm\) \* kT/, 'the lit trace fades');
  assert.match(circuit, /rhCov\(T\.z, [0-9.]+, pxm\) \* kN/, 'the node fades');
  assert.match(circuit, /\* kN \* \(1\.0 - smoothstep/, 'the node\'s ring with it');
  assert.ok(S.defines.includes(`#define RH_THIN vec2(${ROSE_SKIN.thin.map((v) => v.toFixed(3)).join(', ')})`), 'the define');
  // (the slabs' chamfer a soft tone, under the colour edges' threshold: at its whole tone each joint was drawn three times)
  assert.ok(ROSE_SKIN.bevel > 0 && ROSE_SKIN.bevel <= 0.5, `the chamfer's tone: ${ROSE_SKIN.bevel}`);
  assert.ok(S.defines.includes(`#define RH_BEVEL ${ROSE_SKIN.bevel.toFixed(3)}`) && S.bodies.slab.includes('bev * abs(up) * RH_BEVEL'), 'the chamfer by RH_BEVEL');
  // the port's HLSL is made from the same (scripts/unity-export/skin-hlsl.mjs): it has the fade too
  const hlsl = readFileSync(SKIN_HLSL_PATH, 'utf8');
  assert.ok(hlsl.includes(`#define s0_RH_THIN float2(${ROSE_SKIN.thin.map((v) => v.toFixed(3)).join(', ')})`), 'SkinPatterns.hlsl is regenerated');
  assert.match(hlsl, /s0_rhCov\(T\.x, [0-9.]+, pxm\) \* kT/);
  // and the house's walls carry the share to the bridge
  const wall = roseRt().skin.mats.wall;
  assert.ok(Math.abs(wall.uniforms.uSkQ.value.y - ROSE_SKIN.wall.more[1]) < 1e-6);
});

test('the Warden\'s Well\'s pattern carries its rooms (the drums the slabs run round) and its pieces\' own frame', () => {
  const rt = wellRt();
  const S = skinShaders().find((s) => s.id === 'wardens-well');
  const wall = inkSpec(rt.skin.mats.wall).skin, obj = inkSpec(rt.skin.mats.floorObj).skin;
  const at = (name) => S.layout.find((e) => e.name === name).slot * 4;
  const n = wall.data[at('uSkN')];
  assert.ok(n > 4, `its rooms: ${n}`);
  const rooms = Array.from({ length: n }, (_, i) => wall.data.slice(at('uSkR') + i * 4, at('uSkR') + i * 4 + 4));
  assert.ok(rooms.some((r) => r[3] < 0 && r[2] > 4), 'a round room (its radius, w < 0)');
  assert.equal(wall.data[at('uSkObj')], 0);
  assert.equal(obj.data[at('uSkObj')], 1, 'a riding disc\'s plates in its own frame');
  assert.equal(obj.body, S.number('plates'));
});

test('a skin\'s uniforms that move (a bell ringing) go to the port live, op 21', () => {
  const sent = [];
  const mirror = new SceneMirror({ material: () => {}, materialLive: () => {}, materialSkin: (mid, d) => sent.push([mid, Array.from(d)]) });
  const scene = new THREE.Scene();
  const rt = roseRt();
  const m = rt.skin.mats.wall.clone();
  m.uniforms = { ...rt.skin.mats.wall.uniforms, uSkQ: { value: rt.skin.mats.wall.uniforms.uSkQ.value.clone() } };
  m.userData = { ...rt.skin.mats.wall.userData };
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  for (let i = 0; i < 8; i++) mirror.sync(scene, null);
  assert.equal(sent.length, 0, 'unchanged: nothing');
  m.uniforms.uSkQ.value.y = 0.25;
  for (let i = 0; i < 4; i++) mirror.sync(scene, null);
  assert.equal(sent.length, 1, 'moved: once');
  const S = skinShaders().find((s) => s.id === 'rose-house');
  assert.equal(sent[0][1][S.layout.find((e) => e.name === 'uSkQ').slot * 4 + 1], 0.25);
  assert.equal(OP.skin, 21);
});

test('the port\'s SkinPatterns.hlsl is what skin-hlsl.mjs makes of the skins\' GLSL; Surface.shader draws it in one variant', async () => {
  await loadSkins();
  assert.equal(readFileSync(SKIN_HLSL_PATH, 'utf8'), skinHlsl(), 'SkinPatterns.hlsl is out of date: node scripts/unity-export/skin-hlsl.mjs');
  const h = skinHlsl();
  for (const S of skinShaders()) for (const b of Object.keys(S.bodies)) assert.match(h, new RegExp(`case ${S.number(b)}: s${SKIN_ORDER.indexOf(S.id)}_${b}\\(`), `${S.id} ${b}`);
  assert.doesNotMatch(h, /\bvec[234]\b|\bmix\(|\bfract\(|\bdFdx\(|\buniform\b|gl_FragCoord/, 'no GLSL left');
  const sh = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.match(sh, /#pragma multi_compile_local _ HIRAETH_CROWD HIRAETH_PUFFS HIRAETH_INSTMAT HIRAETH_GRASS HIRAETH_FLORA HIRAETH_VMAT HIRAETH_SKIN\n/, 'one keyword for every skin, in the vertex kinds\' set');
  assert.equal((sh.match(/HIRAETH_SKIN_\w+|SKIN_[A-Z]+_\w+/g) ?? []).length, 0, 'no keyword a skin');
  assert.match(sh, /#include "SkinPatterns.hlsl"/);
  const r = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs', import.meta.url), 'utf8');
  assert.match(r, /IsKeywordEnabled\("HIRAETH_SKIN"\)\) \{[^}]*return; \}/, 'Lean leaves a skin on its own variant');
  assert.match(r, /case 21:/, 'op 21, the live uniforms');
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs', import.meta.url), 'utf8'), /EnableKeyword\("HIRAETH_SKIN"\)/);
});
