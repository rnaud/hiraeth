import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Foes} from '../src/foes.js';
import {materialCount} from '../src/materials.js';
const make=()=>new Foes({scene:new THREE.Scene(),level:{},levelId:'arena',physics:{groundAt:()=>0},player:{pos:new THREE.Vector3()}});
test('enemy warning colours belong to each enemy and are released with it',()=>{
 const foes=make();
 // Warm shared, immutable materials before measuring ownership.
 for(const k of ['blot','spitter','machine'])foes.add(k,new THREE.Vector3());
 for(const f of [...foes.list])foes.remove(f);
 const baseline=materialCount();
 for(const kind of ['blot','spitter','machine']){
  const a=foes.add(kind,new THREE.Vector3()),b=foes.add(kind,new THREE.Vector3());
  assert.notEqual(a.model.eyeMat,b.model.eyeMat);
  const original=b.model.eyeMat.uniforms.uColor.value.clone();
  a.model.eyeMat.uniforms.uColor.value.set('#ff0000');
  assert.ok(original.equals(b.model.eyeMat.uniforms.uColor.value));
  foes.remove(a);foes.remove(b);
 }
 assert.equal(materialCount(),baseline);
 foes.dispose();
});
test('wing roots remain embedded throughout the flap, and machine arms have shoulder sockets',()=>{
 const foes=make(),fly=foes.add('flyer',new THREE.Vector3());
 for(const wing of fly.model.wings)for(const angle of [-.6,0,.6]){
  wing.rotation.z=angle;fly.model.group.updateMatrixWorld(true);
  const p=wing.geometry.attributes.position;let near=Infinity;
  for(let i=0;i<p.count;i++){
   const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(wing.matrixWorld);
   near=Math.min(near,v.distanceTo(new THREE.Vector3(0,.55,0)));
  }
  assert.ok(near<.5,'wing surface overlaps the ink body throughout its flap');
 }
 const machine=foes.add('machine',new THREE.Vector3());
 for(const arm of machine.model.arms){
  const socket=arm.children.find(c=>c.geometry?.type==='SphereGeometry');
  assert.ok(socket,'a physical shoulder joint joins the arm to the shell');
  assert.ok(arm.position.x*Math.sign(arm.position.x)-socket.geometry.parameters.radius<.6);
 }
 foes.dispose();
});


test('the humanoid shade stays upright through a full turn, including after recoil', async()=>{
 const {loadAssets}=await import('./gait-sim.js');
 const {lib,human}=await loadAssets();
 const foes=new Foes({scene:new THREE.Scene(),level:{},levelId:'arena',physics:{groundAt:()=>0},player:{pos:new THREE.Vector3()},lib,humans:[human.m]});
 const f=foes.add('shade',new THREE.Vector3());
 for(const heading of [0,Math.PI/3,Math.PI*.6,Math.PI,Math.PI*1.4,Math.PI*1.8]){
  f.heading=heading;
  for(const recoil of [0,1,0]){
   f.recoil=recoil;f.recoilDir.set(1,0,0);foes.look(f,1/60);
   f.model.group.updateMatrixWorld(true);
   const head=f.model.shade.char.head.getWorldPosition(new THREE.Vector3());
   assert.ok(head.y>1.5,`upright head at heading ${heading}, recoil ${recoil}: ${head.y}`);
   const up=new THREE.Vector3(0,1,0).applyQuaternion(f.model.group.quaternion);
   assert.ok(up.y>.98,'recoil is a small lean, never a flipped orientation');
  }
 }
 foes.dispose();
});
