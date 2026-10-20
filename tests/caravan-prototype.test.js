import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCaravanPrototype, CARAVAN } from '../src/ship/caravan-prototype.js';
test('the review ship has finite geometry, named independent camp parts, and the advertised scale', () => {
  const {root,parts,dispose}=createCaravanPrototype();root.updateMatrixWorld(true);
  for(const key of ['hull','cockpit','engines','porch','awning','water-tank','plants','roof','landing-gear'])assert.ok(parts[key]?.isGroup,key);
  root.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v),'finite vertex');});
  const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-CARAVAN.length)<1,`length ${size.x}m`);
  assert.ok(size.y>10&&size.y<16,`height ${size.y}m`);
  assert.equal(CARAVAN.humanHeight,1.75);
  parts.awning.visible=false;assert.equal(parts.hull.visible,true);dispose();
});


test('the prototype uses live game lighting uniforms, including double-sided windows and cloth', async () => {
  const { sharedUniforms } = await import('../src/materials.js');
  const model = createCaravanPrototype();
  model.root.traverse(o => {
    assert.ok(!o.isLineSegments, 'silhouette ink comes from the game post pass');
    if (o.isMesh) {
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        assert.ok(material.isShaderMaterial);
        assert.equal(material.uniforms.uSunDir, sharedUniforms.uSunDir, 'materials keep shared sun changes');
        assert.equal(material.uniforms.uShadowMap, sharedUniforms.uShadowMap, 'materials keep live shadow maps');
      }
    }
  });
  model.dispose();
});

test('intrinsic shell paint batches its faces into at most three contiguous draws', () => {
  const model = createCaravanPrototype();
  for (const name of ['rounded-capsule-shell', 'flush-hull-hatch']) {
    const mesh = model.root.getObjectByName(name);
    assert.ok(mesh?.isMesh, name);
    const groups = mesh.geometry.groups;
    assert.ok(groups.length > 0 && groups.length <= 3, `${name} paint draw budget`);
    let at = 0;
    for (const group of groups) {
      assert.equal(group.start, at, 'paint groups cover contiguous index ranges');
      assert.ok(mesh.material[group.materialIndex]?.isShaderMaterial);
      at += group.count;
    }
    assert.equal(at, mesh.geometry.index.count, 'every shell face has exactly one paint draw');
  }
  model.dispose();
});

test('flight stows the camp and landing restores the original presentation', () => {
  const model = createCaravanPrototype();
  const hinge = model.root.getObjectByName('porch-hinge');
  model.deployment.depart(); model.deployment.update(20);
  assert.equal(hinge.rotation.x, -Math.PI / 2);
  for (const name of ['awning', 'plants', 'porch-furniture', 'laundry', 'ramp', 'porch-supports', 'porch-rail', 'roof-ladder', 'landing-gear']) assert.equal(model.parts[name].visible, false, name);
  assert.equal(model.parts.hull.visible, true);
  model.deployment.arrive(); model.deployment.update(20);
  assert.ok(Math.abs(hinge.rotation.x) < 1e-12);
  for (const name of ['awning', 'plants', 'porch-furniture', 'laundry', 'ramp', 'porch-supports', 'porch-rail', 'roof-ladder', 'landing-gear']) assert.equal(model.parts[name].visible, true, name);
  assert.equal(model.root.position.y, 0);
  model.dispose();
});

test('visible camp parts stay stowed while the prototype changes altitude', () => {
  const model = createCaravanPrototype();
  const camp = ['awning', 'plants', 'porch-furniture', 'laundry', 'ramp', 'porch-supports', 'porch-rail', 'roof-ladder'];
  const check = () => {
    if (model.root.position.y > 0) for (const name of camp) assert.equal(model.parts[name].visible, false, name);
  };
  model.deployment.depart();
  for (let i = 0; i < 160; i++) { model.deployment.update(.05); check(); }
  assert.equal(model.deployment.phase, 'flight');
  model.deployment.arrive();
  for (let i = 0; i < 160; i++) { model.deployment.update(.05); check(); }
  assert.equal(model.deployment.phase, 'landed');
  model.dispose();
});
