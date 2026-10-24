import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mapDisplay } from '../src/temples/map-display.js';

test('map display raises chest foot exactly to its visible/solid plinth top', () => {
  for(const [at,yaw] of [[[-50.2,0,58.9],Math.atan2(9,-4.3)],[[35,0,77],Math.atan2(-6,11)],[[-7,16,105.6],Math.PI/4]]) {
    const floor=[...at], d=mapDisplay(at,{scale:1.5,plinth:[1.8,.24,1.6]},yaw);
    d.plinth.computeBoundingBox();
    assert.deepEqual(at,floor,'authored floor position is not mutated');
    assert.ok(Math.abs(d.plinth.boundingBox.max.y-d.at[1])<1e-5);
    assert.ok(Math.abs(d.plinth.boundingBox.min.y-at[1])<1e-5);
    assert.equal(d.scale,1.5); d.plinth.dispose();
  }
  assert.deepEqual(mapDisplay([1,2,3]),{at:[1,2,3],scale:1,plinth:null});
});

test('display footprints stay on existing floors, clear of mandatory puzzle lanes', () => {
  const bounds=(at,yaw)=>{const d=mapDisplay(at,{scale:1.5,plinth:[1.8,.24,1.6]},yaw);d.plinth.computeBoundingBox();const b=d.plinth.boundingBox.clone();d.plinth.dispose();return b;};
  const desert=bounds([-50.2,0,58.9],Math.atan2(9,-4.3));
  assert.ok(desert.min.z>54.6 && desert.max.z<63.2-2, 'no extension towards the mandatory double-jump pit');
  assert.ok(desert.max.x < -41.2-5,'entry/jump axis clear');
  const bazaar=bounds([35,0,77],Math.atan2(-6,11));
  assert.ok(bazaar.min.x>29 && bazaar.min.z>73);
  assert.ok(bazaar.max.z<84,'entry mark and z92 ball lane clear');
  assert.ok(bazaar.max.x<45.6-5,'key cage and horn not raised or obstructed');
  const aerie=bounds([-7,16,105.6],Math.PI/4);
  assert.ok(aerie.max.x < -1.8-3,'ball route has more than its radius plus player clearance');
  assert.ok(!aerie.intersectsBox(new THREE.Box3(new THREE.Vector3(-3.4,15,90.4),new THREE.Vector3(-.2,18,93.6))),'shaft remains untouched');
  assert.ok(aerie.max.z<112.6-4,'entrance clearance');
});
