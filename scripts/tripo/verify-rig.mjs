import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const b=readFileSync(process.argv[2]??'output/character-tripo/rig-prototype.glb'),n=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+n));
const bin=b.subarray(28+n,28+n+b.readUInt32LE(20+n));
// Geometry/skeleton validation needs no image decoder or WebGL context.
g.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];delete g.images;delete g.textures;delete g.materials;for(const m of g.meshes)for(const p of m.primitives)delete p.material;
globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
const model=await new GLTFLoader().parseAsync(JSON.stringify(g),'');model.scene.updateMatrixWorld(true);
let vertices=0,maxRestError=0;
model.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
for(const name of ['pelvis','spine_01','Head','upperarm_l','upperarm_r','hand_l','hand_r','foot_l','foot_r'])assert.ok(mesh.skeleton.bones.some(b=>b.name===name),name);
for(let i=0;i<p.count;i++){let total=0;for(let k=0;k<4;k++){assert.ok(j.getComponent(i,k)<mesh.skeleton.bones.length);const value=w.getComponent(i,k);assert.ok(Number.isFinite(value)&&value>=0);total+=value;}assert.ok(Math.abs(total-1)<1e-5);const a=new THREE.Vector3().fromBufferAttribute(p,i),skinned=mesh.applyBoneTransform(i,a.clone());maxRestError=Math.max(maxRestError,a.distanceTo(skinned));vertices++;}
});
assert.ok(vertices>0);assert.ok(maxRestError<1e-5,`rest error ${maxRestError}`);console.log(JSON.stringify({vertices,maxRestError,status:'valid normalized weights and bind-pose roundtrip'},null,2));
