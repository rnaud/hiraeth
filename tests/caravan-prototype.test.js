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
