import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Hoverbike, bikeSteer } from '../src/bike.js';
const flat={groundAt:()=>0,pushCapsule:()=>false,rayDistance:()=>Infinity};
function call(physics=flat,start=new THREE.Vector3(70,1.15,0)){
 const bike=new Hoverbike(physics);bike.pos.copy(start);const player=new THREE.Vector3();bike.summon(3,0,0,player);return {bike,player};
}
test('bike reaches boarding range within four seconds, including a distant summon',()=>{
 for(const x of [30,70,500]){const {bike,player}=call(flat,new THREE.Vector3(x,1.15,0));for(let i=0;i<250&&bike.auto;i++)bike.update(1/60,null);assert.equal(bike.auto,null);assert.ok(bike.pos.distanceTo(player)<6);}
});
test('blocked bike teleports to a clear spot beside the player',()=>{
 const physics={...flat,pushCapsule(p){if(p.x>10){p.x=30;return true;}return false;}};
 const {bike,player}=call(physics,new THREE.Vector3(30,1.15,0));for(let i=0;i<310&&bike.auto;i++)bike.update(1/60,null);
 assert.equal(bike.auto,null);assert.ok(bike.pos.distanceTo(player)<6);assert.equal(bike.speed,0);
});
test('recall avoids occupied positions and riding cancels autopilot',()=>{
 const {bike}=call({...flat,pushCapsule:()=>true});assert.equal(bike.recallNear(bike.auto),false);
 bike.update(1/60,{});assert.equal(bike.auto,null);
});

test('stick steering: a deadzone while driving forward, gentle small pushes, full lock at the edge', () => {
  assert.equal(bikeSteer(0.25, true), 0, 'the drift of a forward push is ignored');
  assert.ok(bikeSteer(0.25, false) > 0, 'standing still, a small push still turns');
  assert.ok(bikeSteer(0.5, true) < 0.25, 'half over turns gently');
  assert.equal(bikeSteer(1, true), 1);
  assert.equal(bikeSteer(-1, true), -1);
});
