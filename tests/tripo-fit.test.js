import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { fitDonorToSurface } from '../tools/tripo-fit.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document??={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
const {parseBody,makeBody}=await import('../src/makehuman/body.js');
const {personParams}=await import('../src/makehuman/shape.js');
test('joint fitting follows lower arm sections and preserves skeleton hierarchy and bind pose',()=>{
 const b=readFileSync('public/anim/mh/body.bin');
 const donor=makeBody(parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),personParams({kind:'m',years:26,build:'slim',world:'desert'}));
 const body=donor.getObjectByName('Body'),bones=body.skeleton.bones;
 const hierarchy=bones.map(b=>[b.name,b.parent.name]),rotations=bones.map(b=>b.quaternion.clone());
 const surface=[new THREE.Vector3(0,1.8,0),new THREE.Vector3(0,0,0)];
 // Known synthetic arm cross sections, deliberately 15 cm below the donor.
 const expected=new Map();
 for(const bone of bones.filter(b=>/^(upperarm|lowerarm|hand)_[lr]$/.test(b.name))){const p=bone.getWorldPosition(new THREE.Vector3());const center=new THREE.Vector3(p.x,p.y-.15,.02);expected.set(bone.name,center);
 for(let i=0;i<21;i++){const theta=i*Math.PI*2/20;surface.push(new THREE.Vector3(center.x,center.y+Math.cos(theta)*.025,center.z+Math.sin(theta)*.025));}}
 fitDonorToSurface(donor,surface);
 assert.deepEqual(bones.map(b=>[b.name,b.parent.name]),hierarchy);
 bones.forEach((b,i)=>assert.deepEqual(b.quaternion.toArray(),rotations[i].toArray()));
 for(const [name,center]of expected){const actual=donor.getObjectByName(name).getWorldPosition(new THREE.Vector3());assert.ok(actual.distanceTo(center)<.006,`${name}: ${actual.distanceTo(center)}`);}
 donor.updateMatrixWorld(true);body.skeleton.update();
 const p=body.geometry.attributes.position;for(let i=0;i<p.count;i+=17){const v=new THREE.Vector3().fromBufferAttribute(p,i);assert.ok(body.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-5);}
});
