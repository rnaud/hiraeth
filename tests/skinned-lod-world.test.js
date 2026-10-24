import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SkinnedLod,skinnedLods} from '../src/skinned-lod.js';
const make=root=>new SkinnedLod({model:root,char:{root}}, {min:-4,max:-2,sync:true});
// Empty skins keep this regression about manager selection and real transforms,
// not the separately tested geometry simplifier or asynchronous worker timing.
test('nested moving and scaled bodies select the same detail as their rendered world pose',()=>{
 const scene=new T.Scene(),parent=new T.Group(),root=new T.Group();scene.add(parent);parent.add(root);
 parent.position.set(420,180,2054);parent.rotation.set(.13,.7,-.2);parent.scale.setScalar(1.7);
 root.position.set(0,-4.4,0);root.scale.setScalar(.9);
 const camera=new T.PerspectiveCamera(),cameraParent=new T.Group();scene.add(cameraParent);cameraParent.add(camera);cameraParent.position.set(390,170,2000);cameraParent.rotation.y=.3;
 const actual=skinnedLods.add(make(root)),reference=make(new T.Group()),calls=[],update=actual.update.bind(actual);
 actual.update=(...args)=>{calls.push(args);return update(...args);};
 try{for(const distance of [18,120,500,18]){
  const p=root.getWorldPosition(new T.Vector3()),eye=p.clone().add(new T.Vector3(0,0,distance));camera.position.copy(cameraParent.worldToLocal(eye));
  skinnedLods.update(camera,720,1);reference.update(distance,1.53,720,1);
  assert.ok(Math.abs(calls.at(-1)[0]-distance)<1e-9);assert.ok(Math.abs(calls.at(-1)[1]-1.53)<1e-9);
  assert.equal(actual.j,reference.j,'same detail and hysteresis at the same world distance/scale');
 }
 // Moving the carrier and camera together does not lower detail.
 parent.position.add(new T.Vector3(-800,120,1300));const p=root.getWorldPosition(new T.Vector3());camera.position.copy(cameraParent.worldToLocal(p.clone().add(new T.Vector3(0,0,18))));
 skinnedLods.update(camera,720,1);assert.equal(actual.j,reference.j);
 }finally{skinnedLods.remove(actual);actual.reset();}
});
test('ordinary scene-rooted bodies retain distance, scale, cutoffs and detached-root exclusion',()=>{
 const scene=new T.Scene(),root=new T.Group(),camera=new T.PerspectiveCamera();scene.add(root);root.position.set(4,2,9);root.scale.setScalar(1.25);
 const actual=skinnedLods.add(make(root)),reference=make(new T.Group());
 try{for(const distance of [2,35,90,300,30,2]){camera.position.copy(root.position).add(new T.Vector3(0,0,distance));skinnedLods.update(camera,650,1);reference.update(distance,1.25,650,1);assert.equal(actual.j,reference.j);}
 const previous=actual.j;root.removeFromParent();camera.position.set(0,0,1000);skinnedLods.update(camera,650,1);assert.equal(actual.j,previous);
 }finally{skinnedLods.remove(actual);actual.reset();}
});
