import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sharedUniforms } from '../src/materials.js';
import { bindCaravanModel, CARAVAN } from '../src/ship/caravan-prototype.js';
test('authored review loading is awaited and reports failures instead of silently substituting a ship', async () => {
  const { loadCaravanPrototype, CARAVAN_MODEL_URL } = await import('../src/ship/caravan-prototype.js');
  assert.match(CARAVAN_MODEL_URL, /\/data\/ships\/caravan-a\/caravan\.glb$/);
  const failure = new Error('asset unavailable');
  await assert.rejects(loadCaravanPrototype({ loader: { loadAsync: async () => { throw failure; } } }), failure);
  await assert.rejects(loadCaravanPrototype({ loader: { loadAsync: async () => ({ scene: new THREE.Group() }) } }), /missing hull/);
});

test('authored pivots preserve hierarchy, reverse every stage, and keep the locker open during prop travel', async () => {
  const { bindCaravanMechanisms } = await import('../src/ship/caravan-prototype.js');
  const root = new THREE.Group(), deck = new THREE.Group(), rail = new THREE.Group(), prop = new THREE.Group(), shutter = new THREE.Group(), gear = new THREE.Group();
  root.add(deck, prop, shutter, gear); deck.add(rail);
  deck.position.set(2, 4.4, 3);
  deck.userData.caravanMechanism = { stage: 'deck', closedRotation: [-Math.PI / 2, 0, 0] };
  rail.userData.caravanMechanism = { stage: 'rails', closedRotation: [-Math.PI / 2, 0, 0], hideClosed: true };
  prop.position.set(1, 5, 6); prop.userData.caravanMechanism = { stage: 'props', closedOffset: [0, 0, -4] };
  shutter.userData.caravanMechanism = { range: [.55, .65], closedOffset: [0, -2, 0] };
  gear.userData.caravanMechanism = { stage: 'gear', closedOffset: [0, 3, 0], hideClosed: true };
  const apply = bindCaravanMechanisms(root);
  apply(0, 8);
  assert.deepEqual(deck.position.toArray(), [2, 4.4, 3]);
  assert.ok(Math.abs(deck.rotation.x + Math.PI / 2) < 1e-8);
  assert.deepEqual(prop.position.toArray(), [1, 5, 2]);
  assert.equal(prop.visible, true, 'stored furniture remains physically present inside its locker');
  assert.equal(rail.visible, false); assert.equal(gear.visible, false);
  apply(.8, 0);
  assert.equal(shutter.position.y, 0, 'shutter is fully open throughout furniture travel');
  assert.ok(prop.position.z > 2 && prop.position.z < 6);
  assert.equal(gear.visible, true);
  apply(1, 0);
  assert.ok(Math.abs(deck.rotation.x) < 1e-8); assert.deepEqual(prop.position.toArray(), [1, 5, 6]);
  assert.equal(rail.parent, deck);
  apply(0, 8); apply(1, 0);
  assert.deepEqual(prop.position.toArray(), [1, 5, 6], 'repeated cycles never accumulate offsets');
});
// Validate the same authored GLB served by development and copied into the published build.
const ASSET = new URL('../data/ships/caravan-a/caravan.glb', import.meta.url);
async function actualModel() {
  const bytes = readFileSync(ASSET);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return bindCaravanModel((await new GLTFLoader().parseAsync(data, '')).scene);
}

test('the retained Blender study has finite geometry, named mechanisms and bounded draw cost', async () => {
  const bytes = readFileSync(ASSET), jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  assert.equal(gltf.images?.length ?? 0, 0, 'neutral geometry has no baked lighting textures');
  assert.equal(gltf.textures?.length ?? 0, 0);
  assert.ok(gltf.materials.length <= 16, 'small shared neutral palette');
  for (const material of gltf.materials) {
    assert.equal(material.occlusionTexture, undefined);
    assert.equal(material.emissiveTexture, undefined);
  }
  const model = await actualModel();
  let triangles = 0, draws = 0;
  model.root.traverse(node => {
    if (!node.isMesh) return;
    assert.equal(node.geometry.attributes.color, undefined, 'no baked vertex lighting');
    for (const value of node.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    for (const value of node.geometry.attributes.normal.array) assert.ok(Number.isFinite(value));
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    draws += Math.max(1, node.geometry.groups.length);
    assert.ok(node.material.isShaderMaterial);
    assert.equal(node.material.uniforms.uSunDir, sharedUniforms.uSunDir);
    assert.equal(node.material.uniforms.uShadowMap, sharedUniforms.uShadowMap);
  });
  assert.ok(triangles <= 200000, `triangles: ${triangles}`);
  assert.ok(draws <= 100, `primitive draws: ${draws}`);
  let railAncestor = model.parts['porch-rail'];
  while (railAncestor && railAncestor !== model.parts['porch-panel']) railAncestor = railAncestor.parent;
  assert.equal(railAncestor, model.parts['porch-panel'], 'folded rails travel with the closing deck');
  const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - CARAVAN.length) < 1, `length ${size.x}`);
  assert.deepEqual(model.root.scale.toArray(), [1, 1, 1]);
  for (const name of ['porch-panel','porch-rail','porch-supports','ramp','porch-furniture','plants','awning','laundry','solar-panel','roof-ladder','landing-gear']) {
    assert.ok(model.parts[name]?.userData.caravanMechanism, name);
  }
  model.dispose();
});

test('the actual Blender camp stays secured in the air and restores every authored open transform', async () => {
  const model = await actualModel(), rest = new Map();
  model.root.traverse(node => {
    if (node.userData.caravanMechanism) rest.set(node, {position:node.position.clone(), quaternion:node.quaternion.clone(), scale:node.scale.clone()});
  });
  model.deployment.depart();
  for (let i=0; i<180; i++) {
    model.deployment.update(.05);
    if (model.root.position.y>0) assert.equal(model.deployment.camp, 0);
  }
  assert.equal(model.deployment.phase, 'flight');
  assert.equal(model.parts['landing-gear'].visible, false);
  model.deployment.arrive();
  for (let i=0; i<180; i++) {
    model.deployment.update(.05);
    if (model.root.position.y>0) assert.equal(model.deployment.camp, 0);
  }
  assert.equal(model.deployment.phase, 'landed');
  for (const [node, before] of rest) {
    assert.ok(node.position.distanceTo(before.position)<1e-8, node.name);
    assert.ok(node.quaternion.angleTo(before.quaternion)<1e-7, node.name);
    assert.ok(node.scale.distanceTo(before.scale)<1e-8, node.name);
  }
  model.dispose();
});

test('the real camp can reverse mid-deployment and repeat without drift or loose parts beyond the hull', async () => {
  const model = await actualModel(), d = model.deployment;
  for (let cycle = 0; cycle < 3; cycle++) {
    d.reset('flight'); d.arrive(); d.update(4);
    assert.equal(d.phase, 'deploying');
    assert.equal(d.depart(), true);
    for (let frame = 0; frame < 140; frame++) {
      d.update(.05);
      if (model.root.position.y > 0) assert.equal(d.camp, 0);
    }
    assert.equal(d.phase, 'flight');
    model.root.updateMatrixWorld(true);
    for (const part of Object.values(model.parts)) {
      for (const value of part.matrixWorld.elements) assert.ok(Number.isFinite(value));
    }
    const hullBounds = new THREE.Box3().setFromObject(model.parts.hull);
    for (const name of ['porch-furniture', 'plants', 'porch-rail']) {
      const bounds = new THREE.Box3().setFromObject(model.parts[name]);
      assert.ok(bounds.min.x >= hullBounds.min.x && bounds.max.x <= hullBounds.max.x, `${name} longitudinal storage clearance`);
      assert.ok(bounds.min.z >= hullBounds.min.z && bounds.max.z <= hullBounds.max.z, `${name} side storage clearance`);
      assert.deepEqual(model.parts[name].scale.toArray(), [1, 1, 1], 'solid props retract without shrinking');
    }
    d.arrive(); d.update(20); assert.equal(d.phase, 'landed');
  }
  model.dispose();
});

test('the authored ship has four separate aft boosters arranged in two symmetric height rows', async () => {
  const model = await actualModel();
  model.root.updateMatrixWorld(true);
  const names = ['booster-port-upper', 'booster-port-lower', 'booster-starboard-upper', 'booster-starboard-lower'];
  const assemblies = [];
  model.root.traverse(node => { if (/^booster-(port|starboard)-(upper|lower)$/.test(node.name)) assemblies.push(node); });
  assert.equal(assemblies.length, 4);
  const centres = {};
  for (const name of names) {
    const node = model.root.getObjectByName(name);
    assert.ok(node, name);
    let parent = node.parent;
    while (parent && parent !== model.parts.engines) parent = parent.parent;
    assert.equal(parent, model.parts.engines, `${name} belongs to the rear engine assembly`);
    const bounds = new THREE.Box3().setFromObject(node);
    assert.ok(!bounds.isEmpty(), `${name} has real geometry`);
    const centre = bounds.getCenter(new THREE.Vector3()); centres[name] = centre;
    assert.ok(bounds.min.x > 5, `${name} is behind the inhabited hull`);
    assert.ok(name.includes('port-') && !name.includes('starboard-') ? centre.z < -1 : centre.z > 1, `${name} occupies its own side`);
  }
  for (const side of ['port', 'starboard']) assert.ok(centres[`booster-${side}-upper`].y - centres[`booster-${side}-lower`].y > 3, 'both upper and lower rows are present');
  for (const row of ['upper', 'lower']) {
    const port = centres[`booster-port-${row}`], starboard = centres[`booster-starboard-${row}`];
    assert.ok(Math.abs(port.x - starboard.x) < .1);
    assert.ok(Math.abs(port.y - starboard.y) < .1);
    assert.ok(Math.abs(port.z + starboard.z) < .1, 'paired boosters mirror across the centreline');
  }
  model.dispose();
});

test('the forecabin has a closed belly beneath its centreline', async () => {
  const model = await actualModel(); model.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-12, -10, 0), new THREE.Vector3(0, 1, 0));
  const hit = ray.intersectObject(model.root, true)[0];
  assert.ok(hit, 'underside ray hits the authored belly');
  assert.ok(hit.point.y > 1 && hit.point.y < 4, `belly surface height ${hit.point.y}, not a far roof through an open hole`);
  model.dispose();
});
