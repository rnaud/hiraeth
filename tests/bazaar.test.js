import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBazaar, BRIDGES, SIGNAL} from '../src/levels/bazaar.js';
import {Physics} from '../src/physics.js';
import {CONTENT,ORDER,nextLevel} from '../src/levels/content.js';
import {LEVELS} from '../src/levels/index.js';
const scene=new THREE.Scene(),level=createBazaar(scene),physics=new Physics(scene,level.ground);
test('market avenue is clear at walking height and spawn has a solid floor',()=>{
 assert.equal(physics.groundAt(0,3,125),0);
 for(let z=125;z>=-215;z-=5) {
  const hit=physics.rayHit(new THREE.Vector3(-10,1,z),new THREE.Vector3(1,0,0),20);
  assert.equal(hit,null,`avenue blocked at ${z}`);
 }
});
test('all skybridges and broadcast balcony have continuous collision',()=>{
 for(const {z,y} of BRIDGES) for(let x=-30;x<=30;x+=3) assert.ok(Math.abs(physics.groundAt(x,y+.4,z)-y)<.01);
 assert.equal(physics.groundAt(0,45,SIGNAL.approachZ),44);
 for(let k=1;k<=6;k++) assert.ok(Math.abs(physics.groundAt(k%2?-7:7,k*6+1,-235)-(k*6+.325))<.01);
});
test('new world participates in progression and has five reachable relic surfaces',()=>{
 assert.equal(nextLevel('perdide2'),'bazaar');assert.equal(nextLevel('bazaar'),'desert');
 assert.ok(ORDER.includes('bazaar'));assert.ok(LEVELS.some(l=>l.id==='bazaar'&&!l.hidden));
 assert.equal(CONTENT.bazaar.relics.spots.length,5);
 for(const {at:[x,y,z]} of CONTENT.bazaar.relics.spots) {
  const ground=physics.groundAt(x,y,z,10);
  assert.ok(y-ground>0 && y-ground<3,`relic has a nearby platform at ${x},${y},${z}: ${ground}`);
 }
});
test('taxis initialize and moving crowd routes avoid stalls',()=>{
 level.init(physics);assert.equal(level.vehicles.length,12);assert.equal(level.vehicles[0].mode,'parked');
 for(const route of level.crowd()) for(const p of route) assert.ok(Math.abs(physics.groundAt(p.x,3,p.z))<1e-6);
 const triangles=physics.triangles;assert.ok(triangles<30000,`static collision budget: ${triangles}`);
});

test('broadcast completes at the balcony, not underneath it', async()=>{
 const {Story}=await import('../src/quest.js');
 let completed=0;
 const story={def:CONTENT.bazaar.story,goal:new THREE.Vector3(0,45,-234),player:{pos:new THREE.Vector3(0,27,-234)},halo:{scale:{setScalar(){}}},showPage(){completed++;}};
 Story.prototype.update.call(story,.016,0);assert.equal(completed,0);
 story.player.pos.y=44;Story.prototype.update.call(story,.016,0);assert.equal(completed,1);
});
