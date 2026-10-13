import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildItemModel, fluidMaterials, tickItem } from '../src/boxes/model.js';
import { buildSword, bladeGeometry, brassGeometry, gripGeometry, swordMaterial } from '../src/fluid-sword.js';
import { ShieldDevice, SHIELD } from '../src/shield.js';
import { gunModel } from '../src/gadgets/gun.js';
import { TRAVELLER_PALETTE as PAL } from '../src/traveller-style.js';

// What comes out of a chest is the thing he will use (issue #242: the Givers' blade came out of its chest a thin jade
// spike on a brass rod, and in his hand it is a broad blade of living fluid). Each reveal (src/boxes/model.js
// buildItemModel: the box scene's hovering item, the menu's picture, the items page) is built from the item's in-use
// model: the same geometry and the same material options, in a material of its own (the box winds its clock).

const meshes = (root) => { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
const counts = (root) => meshes(root).map((m) => m.geometry.attributes.position.count).sort((a, b) => a - b);
const kind = (m) => m.uniforms?.uFluidA?.value.w;
const size = (root) => { root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); };

test('the Givers\' blade comes out of its chest as it is held: the wrapped grip, the brass cup and the living blade', () => {
  const item = buildItemModel('sword'), held = buildSword();
  assert.deepEqual(counts(item), counts(held.group), 'the held sword\'s meshes, every one');
  const blade = meshes(item).find((m) => m.name === 'blade');
  assert.ok(blade?.geometry.attributes.aFold, 'the blade\'s own mesh (its fold, read by the fluid\'s shader)');
  assert.equal(blade.geometry.attributes.position.count, bladeGeometry().attributes.position.count);
  assert.equal(meshes(item).find((m) => m.name === 'brass').geometry.attributes.position.count, brassGeometry().attributes.position.count);
  assert.equal(meshes(item).find((m) => m.name === 'grip').geometry.attributes.position.count, gripGeometry().attributes.position.count);
  const M = blade.material;
  assert.equal(kind(M), 6, 'the sword\'s fluid kind');
  assert.ok(M.defines.BLADE_FLUID, 'alive: currents, ripples, meniscus, glow (src/blade-shader.js)');
  assert.notEqual(M, swordMaterial(), 'its own material: the box\'s clock is not the held sword\'s');
  for (const k of ['uFluidTones', 'uFluidBase']) assert.deepEqual(JSON.stringify(M.uniforms[k].value), JSON.stringify(swordMaterial().uniforms[k].value), `the held blade's ${k}`);
  const s = size(item);
  assert.ok(s.y > 0.3 && s.y < 0.6, `about the size of the other items (${s.y.toFixed(2)} m tall)`);
});

test('the Givers\' guard comes out open, as it is raised: the brass petals, the ring and the living fluid with its rim', () => {
  const item = buildItemModel('shield'), d = new ShieldDevice({});
  assert.deepEqual(counts(item), counts(d.face), 'the held device\'s face, every mesh');
  const fluid = fluidMaterials(item);
  assert.ok(fluid.length >= 1 && fluid.every((m) => kind(m) === 6 && m.defines.BLADE_FLUID && m.defines.BLADE_DISC), 'the sword\'s living water, spread as a disc (issue #284)');
  assert.notEqual(fluid[0], d.fluid, 'a material of its own');
  for (const k of ['uFluidTones', 'uFluidBase']) assert.equal(JSON.stringify(fluid[0].uniforms[k].value), JSON.stringify(swordMaterial().uniforms[k].value), `the sword's ${k}`);
  const disc = meshes(item).find((m) => m.name === 'shield fluid');
  disc.geometry.computeBoundingSphere();
  assert.ok(disc.visible && disc.scale.x > SHIELD.radius * 0.8, 'open: the disc out at the blob\'s reach');
  const s = size(item);
  assert.ok(s.x > 0.2 && s.x < 0.45, `scaled for the reveal (${s.x.toFixed(2)} m across)`);
});

test('the wings and the gun\'s glove come out of their chests as they did before #242 (issue #283: the sword and the guard alone)', () => {
  const wings = buildItemModel('glider');
  assert.equal(meshes(wings).filter((m) => kind(m.material) === 3).length, 0, 'no lobes of wing fluid: the leaves of colour on a brass rod');
  assert.equal(meshes(wings).length, 7, 'six leaves and the rod');
  const colours = new Set(meshes(gunModel()).map((m) => `#${m.material.uniforms.uColor.value.getHexString()}`));
  for (const c of ['#6a4f38', '#efe6cf', '#d6a94a', '#72d5bf']) assert.ok(colours.has(c), `${c}: the brown glove, its cream cuff, brass and fluid`);
  assert.ok(!colours.has(PAL.lavender), 'not the worn glove\'s lavender band');
});

test('a reveal\'s fluid flows on the box\'s clock, each of its own kind; the parts that move do', () => {
  for (const id of ['sword', 'shield', 'backpack']) {
    const m = buildItemModel(id), mats = fluidMaterials(m), kinds = mats.map(kind);
    tickItem(m, mats, { time: 3.2, fill: 0.5 });
    assert.deepEqual(mats.map(kind), kinds, `${id}: its fluid's kind kept`);
    assert.ok(mats.every((x) => x.uniforms.uFluidA.value.z === 3.2 && x.uniforms.uFluidA.value.x === 0.5), `${id}: its clock and fill`);
  }
  const sword = buildItemModel('sword'), M = fluidMaterials(sword)[0];
  tickItem(sword, fluidMaterials(sword), { time: 2 });
  assert.ok(M.uniforms.uBlade.value.z > 0, 'the blade breathes');
});
