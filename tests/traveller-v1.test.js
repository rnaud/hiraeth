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
 // (all but the fingers: they start relaxed, src/hands.js, not in the rig's rest)
 const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,digit=/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/;
 const onFingers=(i)=>[0,1,2,3].some(k=>sw.getComponent(i,k)>0&&digit.test(mesh.skeleton.bones[si.getComponent(i,k)].name));
 let fingers=0;
 for(let i=0;i<p.count;i+=199){const v=new T.Vector3().fromBufferAttribute(p,i),d=mesh.applyBoneTransform(i,v.clone()).distanceTo(v);if(onFingers(i)){fingers++;continue;}assert.ok(d<1e-4,'identity skin at arbitrary spawn');}
 assert.ok(fingers>0,'the fingers sampled too');
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

async function loadHead() {
 const b=readFileSync(dir+'head-v2/model.glb'),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n)),bin=b.subarray(28+n);
 j.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
 delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
 return new GLTFLoader().parseAsync(JSON.stringify(j),'');
}

test('approved Tripo head replaces the old surface and follows the real head and neck at arbitrary spawns',async()=>{
 const asset=await loadHead(),char=buildCharacter();
 char.root.position.set(-71,24,182);char.root.rotation.set(.2,1.3,-.15);
 const c=createTravellerV1(char,{gltf,data,report,colors,head:asset});
 const {head,mesh,humanoid:h}=c;
 assert.ok(head.isSkinnedMesh);assert.equal(head.skeleton,mesh.skeleton);
 assert.ok(head.material.isShaderMaterial);assert.ok(!head.material.fragmentShader.includes('tripoFace('),'accepted eyes are not painted over');
 assert.ok(mesh.geometry.boundingBox.max.y<1.56,`the original head was actually removed: ${mesh.geometry.boundingBox.max.y}`);
 let source;asset.scene.traverse(o=>{if(o.isMesh)source=o;});
 assert.equal(source.geometry.morphAttributes.position,undefined,'original export is untouched');
 assert.deepEqual(head.geometry.attributes.uv.array,source.geometry.attributes.uv.array);
 // The scarf repair must not turn the original jaw into a projecting chin.
 const original=source.geometry.attributes.position, fitted=head.geometry.attributes.position;
 let jaw=0;
 for(let i=0;i<original.count;i++)if(original.getY(i)>.25&&original.getZ(i)>.20){
  const expected=new T.Vector3().fromBufferAttribute(original,i).multiplyScalar(.32).add(new T.Vector3(-.001,1.455,-.006));
  assert.ok(new T.Vector3().fromBufferAttribute(fitted,i).distanceTo(expected)<1e-6,'front face and chin keep their original shape');
  assert.equal(head.geometry.attributes.skinWeight.getX(i),1,'the lower jaw follows the skull, not the neck');
  jaw++;
 }
 assert.ok(jaw>100);

 char.root.updateMatrixWorld(true);head.skeleton.update();
 const p=head.geometry.attributes.position, sw=head.geometry.attributes.skinWeight;
 let skull=0,neck=0;
 for(let i=0;i<p.count;i+=37){
  const v=new T.Vector3().fromBufferAttribute(p,i);
  assert.ok(head.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-4,'neutral skin roundtrip away from origin');
  assert.ok(Math.abs(sw.getX(i)+sw.getY(i)-1)<1e-6);
  if(v.y>1.56){assert.equal(sw.getX(i),1);skull++;}
  else if(sw.getX(i)>0&&sw.getX(i)<1)neck++;
 }
 assert.ok(skull>100&&neck>10,'rigid skull and a blended neck both have real vertices');
 const bone=h.b.Head, q=bone.quaternion.clone();bone.rotateY(.45);char.root.updateMatrixWorld(true);head.skeleton.update();
 let moved=0;
 for(let i=0;i<p.count;i+=37)if(p.getY(i)>1.60){const v=new T.Vector3().fromBufferAttribute(p,i);if(head.applyBoneTransform(i,v.clone()).distanceTo(v)>.005)moved++;}
 assert.ok(moved>100,'turning the actual head bone visibly moves the replacement');
 bone.quaternion.copy(q);char.root.updateMatrixWorld(true);
 const at=h.drawnFace.at(bone,new T.Vector3());assert.ok(at.distanceTo(char.root.position)<2);
});

test('new head preserves neutral identity, closes its textured eyes, and responds to speech after hero material cloning',async()=>{
 const asset=await loadHead(),char=buildCharacter();
 const {head,humanoid:h}=createTravellerV1(char,{gltf,data,report,colors,head:asset});
 const {markHero}=await import('../src/materials.js');const {TalkFace}=await import('../src/talk-face.js');
 markHero(char.root);h.setExpression({});h.drawnFace.eyes(0,0,null);
 assert.ok(head.morphTargetInfluences.every(w=>w===0),'neutral adds no sculpt');
 const p=head.geometry.attributes.position,blink=head.geometry.morphAttributes.position[0];
 let tested=0,dy=0,closed=0;
 for(let i=0;i<p.count;i++){
  const x=(p.getX(i)+.001)/.32,y=(p.getY(i)-1.455)/.32,z=(p.getZ(i)+.006)/.32;
  if(Math.abs(Math.abs(x)-.102)<.026&&Math.abs(y-.593)<.015&&z>.20){
   dy+=Math.abs(y-.593);closed+=Math.abs(y-.593+blink.getY(i)/.32);tested++;
  }
  if(y>.77)for(const key of head.geometry.morphAttributes.position)assert.ok(Math.abs(key.getY(i))<1e-8,'expressions leave the hair silhouette alone');
 }
 assert.ok(tested>10&&closed<dy*.07,`actual central eye aperture closes (${tested} vertices, ${closed/dy})`);
 h.eyeLook.update=function(){this.blink=1;};h.updateEyes(1/60,null);
 assert.equal(head.morphTargetInfluences[0],1,'the game blink reaches the new mesh');
 const talk=new TalkFace(h);let lo=1,hi=0;
 for(let i=0;i<90;i++){talk.update(1/60,{speaking:true,tone:'neutral',mouth:i%12<6?.9:0});if(i>30){lo=Math.min(lo,head.morphTargetInfluences[5]);hi=Math.max(hi,head.morphTargetInfluences[5]);}}
 assert.ok(hi>.2&&lo<hi*.5);assert.equal(head.material.uniforms.uHeadSpeech.value.x,head.morphTargetInfluences[5]);
 for(let i=0;i<400;i++)talk.update(1/60,{});
 assert.ok(head.morphTargetInfluences[5]<1e-4,'mouth returns shut');
 h.setExpression({smile:1,browTilt:1});assert.equal(head.morphTargetInfluences[1],1);assert.equal(head.morphTargetInfluences[3],1);
});
