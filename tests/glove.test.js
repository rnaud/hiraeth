import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { FluidTool } from '../src/fluid-tool.js';
import { MODES } from '../src/fluid-kit.js';
import { GameState } from '../src/game-state.js';
import { GLOVE } from '../src/traveller.js';

// The fluid glove (traveller.js fluidGlove, Humanoid.wearGlove, fluid-tool.js): the glove on the
// traveller's right hand is what shoots. It is worn with the tank and only then; the fluid leaves from
// just in front of its knuckles whatever the aim; no hose runs to it (cut in October 2026): the vial on
// its cuff glows with the tank's fluid instead; the skin under it is not drawn.
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
async function glb(name) {
  const bytes = await readFileP(new URL(`../public/anim/${name}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}
const template = await glb('traveller.glb');
const human = prepareHuman(await glb('human_m.glb'), 'm');
const V = () => new THREE.Vector3();
const at = (o) => o.getWorldPosition(V());
const UP = new THREE.Vector3(0, 1, 0);

/** The traveller (on the people's body, as in the studio) with the tank: the tool on a minimal player. */
function wearing(owned = true) {
  const char = buildCharacter(), h = new Humanoid(human, char, 'm', { outfit: template });
  const scene = new THREE.Scene(); scene.add(char.root);
  const has = { v: owned };
  const player = { char, humanoid: h, object: char.root, pos: char.root.position, frame: { up: UP }, vel: V() };
  const tool = new FluidTool({ scene, player, camera: new THREE.PerspectiveCamera(), state: new GameState(null), items: { has: (id) => (id === 'backpack' || id === 'gun') && has.v, on: () => () => {} } });
  return { h, char, tool, has, scene };
}
/** The skin's drawn triangles with every corner under the glove. */
function underGlove(h) {
  const body = h.body, P = body.geometry.attributes.position, idx = body.geometry.index.array, bones = body.skeleton.bones;
  const bind = (b) => V().setFromMatrixPosition(body.skeleton.boneInverses[bones.indexOf(b)].clone().invert()).applyMatrix4(body.bindMatrix.clone().invert());
  const wrist = bind(h.b.hand_r), along = bind(h.b.middle_01_r).sub(wrist).normalize();
  const covered = (i) => V().fromBufferAttribute(P, i).sub(wrist).dot(along) > -GLOVE.cuff + 0.01;
  let n = 0;
  for (let t = 0; t < idx.length; t += 3) if (covered(idx[t]) && covered(idx[t + 1]) && covered(idx[t + 2])) n++;
  return n;
}

test('the glove is the fluid gun, worn with the tank, and only then: its leather, band, plate, three knuckle lights, the cuff fitting and its vial', () => {
  const { h, tool, has } = wearing(false);
  const G = h.glove;
  assert.deepEqual(G.meshes.map((m) => m.name).sort(), ['Glove_band_r', 'Glove_fitting_r', 'Glove_light_0_r', 'Glove_light_1_r', 'Glove_light_2_r', 'Glove_plate_r', 'Glove_r', 'Glove_vial_r']);
  assert.ok(G.vial && G.vial.name === 'Glove_vial_r', 'the vial is the glove\'s lit glass');
  assert.equal(G.lights.length, 3);
  const bare = underGlove(h);
  assert.ok(bare > 50, `the bare hand is drawn (${bare} triangles)`);
  tool.updateWorn(1 / 60);
  assert.ok(G.meshes.every((m) => !m.visible), 'no tank: a bare hand');
  has.v = true; tool.updateWorn(1 / 60);
  assert.ok(G.meshes.every((m) => m.visible), 'the tank and the gun found: the glove on');
  assert.equal(underGlove(h), 0, 'the skin under the leather is not drawn (it showed between the fingers)');
  has.v = false; tool.updateWorn(1 / 60);
  assert.ok(G.meshes.every((m) => !m.visible) && underGlove(h) === bare, 'lost: the bare hand again, as it was');
  // every piece rides the right hand and forearm
  const right = new Set(h.body.skeleton.bones.map((b, i) => (/_r$/.test(b.name) && /^(lowerarm|hand|thumb|index|middle|ring|pinky)/.test(b.name) ? i : -1)));
  for (const m of G.meshes) {
    const J = m.geometry.attributes.skinIndex, W = m.geometry.attributes.skinWeight;
    for (let i = 0; i < J.count; i++) for (let k = 0; k < 4; k++) if (W.getComponent(i, k) > 0.01) assert.ok(right.has(J.getComponent(i, k)), `${m.name} on the right hand`);
  }
  tool.dispose();
});

test('the fluid leaves from in front of the glove\'s knuckles in every aim', () => {
  const { h, char, tool } = wearing(true);
  tool.updateWorn(1 / 60);
  char.root.updateMatrixWorld(true);
  for (const aim of [V().set(0, 1.4, 6), V().set(0, 5, 4), V().set(0, -1, 4), V().set(-4, 1.4, 3), V().set(5, 2, 2)]) {
    h.update(); h.hands?.update?.(1, { aim: 1 }); h.aimAt(aim, 1, UP); char.root.updateMatrixWorld(true);
    const m = tool.muzzle(V()), hand = at(h.b.hand_r), dir = aim.clone().sub(at(h.b.upperarm_r)).normalize();
    assert.ok(m.distanceTo(at(h.b.middle_01_r)) < 0.05, `at the knuckles (${m.distanceTo(at(h.b.middle_01_r)).toFixed(3)} m)`);
    assert.ok(m.clone().sub(hand).dot(dir) > 0.07, `ahead of the wrist toward ${aim.toArray()}`);
    assert.ok(m.clone().sub(hand).normalize().dot(dir) > 0.85, 'on the line of fire');
  }
  tool.dispose();
});

test('no cable runs from the tank to the glove: nothing named a hose anywhere on the traveller, no inlet anchor', () => {
  const { h, tool, scene } = wearing(true);
  for (let i = 0; i < 5; i++) tool.updateWorn(1 / 60);
  const names = []; scene.traverse((o) => names.push(o.name ?? ''));
  assert.ok(!names.some((n) => /hose|cable|tube/i.test(n)), `no hose in the scene (${names.filter((n) => /hose|cable|tube/i.test(n))})`);
  assert.equal(tool.hose, undefined, 'the tool has no hose');
  assert.equal(h.glove.inlet, undefined, 'the glove has no hose inlet');
  assert.equal(tool.tank.outlet, undefined, 'the flask has no outlet elbow');
  tool.dispose();
});

test('the vial on the glove\'s cuff glows with the tank\'s fluid, brighter full than empty, on the forearm by the wrist', () => {
  const { h, char, tool } = wearing(true);
  const glow = () => h.glove.vial.material.uniforms.uGlow.value;
  for (let i = 0; i < 60; i++) tool.updateWorn(1 / 60);
  const full = glow();
  assert.ok(full > 0.6, `lit full (${full.toFixed(2)})`);
  assert.ok(new Set([h.glove.vial.material, ...h.glove.lights.map((m) => m.material)]).size === 4, 'its own material');
  tool.fill = 0; tool.fillTo = 0;
  tool.updateWorn(1 / 60);
  assert.ok(glow() < full, 'dimmer as the tank empties');
  char.root.updateMatrixWorld(true); h.body.skeleton.update();
  const box = new THREE.Box3(), P = h.glove.vial.geometry.attributes.position, c = V();
  for (let i = 0; i < P.count; i++) box.expandByPoint(h.glove.vial.applyBoneTransform(i, c.fromBufferAttribute(P, i)).applyMatrix4(h.glove.vial.matrixWorld));
  const size = box.getSize(V()), mid = box.getCenter(V());
  assert.ok(Math.max(size.x, size.y, size.z) < 0.045, `a small vial (${size.toArray().map((x) => x.toFixed(3))})`);
  assert.ok(mid.distanceTo(at(h.b.hand_r)) < 0.09, `on the cuff (${mid.distanceTo(at(h.b.hand_r)).toFixed(3)} m from the wrist)`);
  tool.dispose();
});

test('the glove\'s knuckles light for the charges left, its plate in the mode\'s tone', () => {
  const { h, tool } = wearing(true);
  const glow = (m) => m.material.uniforms.uGlow.value;
  for (let i = 0; i < 60; i++) tool.updateWorn(1 / 60);
  assert.ok(h.glove.lights.every((m) => glow(m) > 0.5), 'three charges: three lights');
  assert.ok(new Set(h.glove.lights.map((m) => m.material)).size === 3, 'each light its own');
  tool.reserve.charges = 1;
  for (let i = 0; i < 60; i++) tool.updateWorn(1 / 60);
  assert.ok(glow(h.glove.lights[0]) > 0.5 && glow(h.glove.lights[1]) < 0.1 && glow(h.glove.lights[2]) < 0.1, 'one charge: one light');
  tool.mode = 'stun';
  for (let i = 0; i < 30; i++) tool.updateWorn(1 / 60);
  const c = h.glove.plate.material.uniforms.uColor.value, tone = new THREE.Color(MODES.stun.tones[0]);
  assert.ok(Math.abs(c.r - tone.r) + Math.abs(c.g - tone.g) + Math.abs(c.b - tone.b) < 0.2, 'the plate in stilling blue');
  tool.dispose();
});

test('the coral-shirt traveller (the game\'s) wears the glove on his own mesh', async () => {
  const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
  globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
  const { parseBody } = await import('../src/makehuman/body.js');
  const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
  const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const dir = 'public/characters/traveller-v1/';
  const report = JSON.parse(readFileSync(dir + 'rig.json')), colors = JSON.parse(readFileSync(dir + 'colors.json'));
  const g = readFileSync(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.materials; for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const char = buildCharacter();
  char.root.position.set(40, 3, -20); char.root.rotation.y = 2;
  const { humanoid: h, mesh } = createTravellerV1(char, { gltf, data, report, colors });
  const G = h.glove;
  assert.ok(G && G.meshes.length === 8 && G.vial && G.meshes.every((m) => m.skeleton === mesh.skeleton && !m.visible));
  char.root.updateMatrixWorld(true); mesh.skeleton.update();
  assert.ok(at(G.muzzle).distanceTo(at(h.b.middle_01_r)) < 0.05, 'the mouth at his knuckles, wherever he stands');
  const index = mesh.geometry.index;
  G.show(true);
  assert.ok(mesh.geometry.index.count < index.count, 'his skin under the leather left out');
  G.show(false);
  assert.equal(mesh.geometry.index, index);
});
