import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document??={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
const { parseBody } = await import('../src/makehuman/body.js');
const { buildCharacter } = await import('../src/player.js');
const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
const { Gear } = await import('../src/gear.js');
const b=readFileSync('public/anim/mh/body.bin'),data=parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const dir='public/characters/traveller-v1/';
const report=JSON.parse(readFileSync(dir+'rig.json')),colors=JSON.parse(readFileSync(dir+'colors.json'));
// Load the shipped skeleton/geometry in Node; browser visual checks cover texture decoding.
const g=readFileSync(dir+'model.glb'),n=g.readUInt32LE(12),json=JSON.parse(g.toString('utf8',20,20+n)),bin=g.subarray(28+n);
json.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
delete json.images;delete json.textures;delete json.materials;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');

test('shipped traveller binds the visible character and repairs to the fitted MakeHuman rig',()=>{
 const char=buildCharacter();
 char.root.position.set(180,12,-84);char.root.rotation.set(.2,1.4,-.3);
 const position=char.root.position.clone(),q=char.root.quaternion.clone();
 const cm=T.ColorManagement.enabled;T.ColorManagement.enabled=false;
 let character;
 try{character=createTravellerV1(char,{gltf,data,report,colors});}finally{T.ColorManagement.enabled=cm;}
 const {humanoid:h,mesh,cloth}=character;
 assert.ok(char.root.position.equals(position));assert.ok(char.root.quaternion.equals(q));
 assert.equal(h.body.visible,false);assert.equal(mesh.visible,true);
 assert.equal(mesh.skeleton.bones.length,53);assert.equal(cloth.underlayer.skeleton,mesh.skeleton);
 assert.equal(cloth.innerShirt.skeleton,mesh.skeleton);
 for(const part of [mesh,cloth.garment,cloth.underlayer,cloth.innerShirt]){
  assert.ok(part.material.isShaderMaterial,'uses the real game G-buffer shader');
  assert.ok(part.material.uniforms.uHero,'supports game hero lighting');
 }
 char.root.updateMatrixWorld(true);mesh.skeleton.update();
 const p=mesh.geometry.attributes.position;
 for(let i=0;i<p.count;i+=199){const v=new T.Vector3().fromBufferAttribute(p,i);assert.ok(mesh.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-4,'identity skin at arbitrary spawn');}
 character.updateCloth(1/60);
 const local=cloth.garment.geometry.attributes.position.array.slice();
 char.root.position.add(new T.Vector3(-330,22,70));char.root.rotateY(1);char.root.updateMatrixWorld(true);
 character.updateCloth(0);
 const moved=cloth.garment.geometry.attributes.position.array;
 let max=0;for(let i=0;i<local.length;i++)max=Math.max(max,Math.abs(local[i]-moved[i]));
 assert.ok(max<1e-4,`cloth follows translated/rotated root in local space: ${max}`);
 for(const c of cloth.caps){assert.ok(c.from.length()<2);assert.ok(c.to.length()<2);}
 const scene=new T.Scene();scene.add(char.root);
 const gear=new Gear(scene,h,char);
 assert.equal(gear.springs.length,0,'no legacy antenna/backpack geometry');
 assert.ok(gear.scoutDock && !gear.device,'gameplay equipment anchors remain available (and nothing in the hand)');
 for(const state of [{ride:{}},{aim:{}},{climbing:true},{overlay:()=>{}},{swim:true}]){
  const player={animator:{w:{walk:0,jog:1,sprint:0}},onGround:true,...state};
  const before=char.arms.map(a=>a.quaternion.clone());
  assert.deepEqual(character.poseArms(player),[]);
  char.arms.forEach((a,i)=>assert.ok(a.quaternion.equals(before[i]),'contact/interaction poses remain authoritative'));
 }
});

test('repair colours match between preview and game colour-management modes',()=>{
 const samples=[];
 for(const enabled of [true,false]){
  T.ColorManagement.enabled=enabled;
  const c=createTravellerV1(buildCharacter(),{gltf,data,report,colors});
  samples.push({colors:Array.from(c.cloth.underlayer.geometry.attributes.color.array),shader:c.cloth.garment.material.fragmentShader});
 }
 T.ColorManagement.enabled=true;
 assert.deepEqual(samples[0],samples[1]);
});
