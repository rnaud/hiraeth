import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document??={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
const {buildCharacter}=await import('../src/player.js');
const {createFatherV1,applyFatherGaze,resetFatherGaze}=await import('../src/characters/father-v1.js');
const {HoloFigure,holoLook}=await import('../src/ship/hologram.js');
const bytes=readFileSync('public/characters/father-v1/model.glb'),size=bytes.readUInt32LE(12);
const json=JSON.parse(bytes.subarray(20,20+size)),bin=bytes.subarray(28+size);
json.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
delete json.images;delete json.textures;delete json.materials;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
asset.scene.traverse(o=>{if(o.isMesh)o.material=new T.MeshStandardMaterial({map:new T.Texture()});});

test('father has independent instances, normalized skin and stable bind pose at translated spawns',()=>{
  const a=buildCharacter(),b=buildCharacter();b.root.position.set(37,-4,18);b.root.rotation.y=1.2;
  const h=createFatherV1(a,asset),other=createFatherV1(b,asset);
  assert.notEqual(h.body.skeleton,other.body.skeleton);
  assert.notEqual(h.body.geometry,other.body.geometry);
  assert.equal(h.body.visible,true);assert.equal(h.body.skeleton.bones.length,53);
  h.body.skeleton.pose();a.root.updateMatrixWorld(true);h.body.skeleton.update();
  const p=h.body.geometry.attributes.position,w=h.body.geometry.attributes.skinWeight;
  for(let i=0;i<p.count;i++){
    let sum=0;for(let k=0;k<4;k++){assert.ok(w.getComponent(i,k)>=0);sum+=w.getComponent(i,k);}
    assert.ok(Math.abs(sum-1)<1e-5);
    if(i%101===0){const v=new T.Vector3().fromBufferAttribute(p,i);assert.ok(h.body.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-5);}
  }
  for(const side of h.hands.sides)assert.ok(side.normal.z>.9,'both palm normals face forward');
  const baseline=other.body.morphTargetInfluences.slice();h.body.morphTargetInfluences[1]=1;
  assert.deepEqual(other.body.morphTargetInfluences,baseline);
});

test('all thirty father phalanges influence vertices and visibly displace their own surface',()=>{
  const char=buildCharacter(),h=createFatherV1(char,asset),mesh=h.body;
  const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
  for(const bone of mesh.skeleton.bones.filter(b=>/^(thumb|index|middle|ring|pinky)_0[123]_[lr]$/.test(b.name))){
    mesh.skeleton.pose();char.root.updateMatrixWorld(true);mesh.skeleton.update();
    const id=mesh.skeleton.bones.indexOf(bone),vertices=[];
    for(let i=0;i<p.count;i++)for(let k=0;k<4;k++)if(j.getComponent(i,k)===id&&w.getComponent(i,k)>.05){vertices.push(i);break;}
    assert.ok(vertices.length>=3,`${bone.name}: ${vertices.length} meaningful vertices`);
    const before=vertices.map(i=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)));
    bone.rotateY(.3);char.root.updateMatrixWorld(true);mesh.skeleton.update();
    const moved=vertices.map((i,k)=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)).distanceTo(before[k]));
    assert.ok(Math.max(...moved)>.001,`${bone.name} must deform visible geometry`);
  }
});

test('father hologram preserves texture, responds to speech and keeps the generated face',()=>{
  const f=new HoloFigure('father',{humans:[],fatherAsset:asset});
  assert.equal(f.humanoid.body.material.uniforms.uKind.value,4);
  assert.ok(f.humanoid.body.material.uniforms.uMap.value);
  assert.equal(f.humanoid.body.morphTargetInfluences.length,2);
  f.t=0;f.update(.1,{talking:true});
  assert.ok(f.u.uTalk.value>0);assert.ok(f.humanoid.body.morphTargetInfluences[1]>0);
  f.update(.1,{talking:false});assert.equal(f.humanoid.body.morphTargetInfluences[1],0);
  assert.equal(holoLook(new T.MeshBasicMaterial()).uKind.value,0,'procedural figures keep their existing material path');
});

test('stationary father lower body cannot tear between coat and trouser weights',()=>{
  const h=createFatherV1(buildCharacter(),asset),g=h.body.geometry;
  const pelvis=h.body.skeleton.bones.findIndex(b=>b.name==='pelvis');
  for(let i=0;i<g.attributes.position.count;i++){
    if(g.attributes.position.getY(i)>=.94)continue;
    for(let k=0;k<4;k++)if(g.attributes.skinWeight.getComponent(i,k)>1e-6)
      assert.equal(g.attributes.skinIndex.getComponent(i,k),pelvis);
  }
});

test('shipped father stays within its recording budget and retains every visible source attribute',async()=>{
  const {trimFather,FATHER_BUDGET}=await import('../scripts/tripo/slim-father.mjs');
  const {readGlb}=await import('../scripts/tripo/slim-traveller.mjs');
  const sharp=(await import('sharp')).default;
  const {json:g,bin}=readGlb(bytes),p=g.meshes[0].primitives[0];
  assert.ok(bytes.length<FATHER_BUDGET.maxBytes);
  assert.ok(g.accessors[p.indices].count/3<=FATHER_BUDGET.maxTriangles);
  const image=g.images[0],v=g.bufferViews[image.bufferView];
  const meta=await sharp(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength)).metadata();
  assert.equal(meta.width,2048);assert.equal(meta.height,2048);
  // Trimming an already trimmed model must preserve its topology and vertex data.
  const {json:trimmed,bin:tb}=readGlb(trimFather(bytes).bytes);
  const tp=trimmed.meshes[0].primitives[0];
  const values=(doc,data,id)=>{const a=doc.accessors[id],v=doc.bufferViews[a.bufferView];return data.subarray((v.byteOffset??0)+(a.byteOffset??0),(v.byteOffset??0)+v.byteLength);};
  for(const name of Object.keys(p.attributes))assert.deepEqual(values(g,bin,p.attributes[name]),values(trimmed,tb,tp.attributes[name]),name);
});

test('father remains continuous throughout real idle and talking animation cycles',async()=>{
  const {libraryFrom}=await import('../src/animator.js');
  const b=readFileSync('public/anim/ual.glb');
  const lib=libraryFrom(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
  const f=new HoloFigure('father',{lib,humans:[],fatherAsset:asset});
  f.seed=1;f.glance.t=100;f.animator.phase=0;
  const mesh=f.humanoid.body,g=mesh.geometry,p=g.attributes.position,ix=g.index;
  const edges=[],seen=new Set();
  for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){
    const a=ix.getX(i+k),b=ix.getX(i+(k+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(',');
    if(seen.has(key))continue;seen.add(key);
    const length=new T.Vector3().fromBufferAttribute(p,a).distanceTo(new T.Vector3().fromBufferAttribute(p,b));
    if(length>.002)edges.push([a,b,length]);
  }
  const rest=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i)),posed=rest.map(v=>v.clone());
  let maxRatio=0,bad=0,total=0,elbowMax=0;
  for(let frame=0;frame<360;frame++){
    f.update(.1,{talking:frame>=60&&frame<240});f.object.updateMatrixWorld(true);mesh.skeleton.update();
    for(let i=0;i<p.count;i++)mesh.applyBoneTransform(i,posed[i].fromBufferAttribute(p,i));
    for(const [a,b,length] of edges){const ratio=posed[a].distanceTo(posed[b])/length;maxRatio=Math.max(maxRatio,ratio);if(ratio>3)bad++;total++;const x=Math.abs((rest[a].x+rest[b].x)/2);if(x>.35&&x<.56)elbowMax=Math.max(elbowMax,ratio);}
  }
  console.log('Father full-cycle surface stretch:',{maxRatio,elbowMax,over3Fraction:bad/total});
  assert.ok(elbowMax<2,'sleeve edges stay below 2x stretch through elbow bends');
  assert.ok(maxRatio<8,'no exploding triangles across the real motion cycles');
  assert.ok(bad/total<.005,'at most 0.5% of sampled edges stretch beyond 3x');
});


test('father speech cannot move the nose, eyes or upper face',()=>{
  const h=createFatherV1(buildCharacter(),asset),g=h.body.geometry,p=g.attributes.position,m=g.morphAttributes.position[1];
  let moved=0;
  for(let i=0;i<p.count;i++){
    const length=new T.Vector3().fromBufferAttribute(m,i).length();
    if(p.getY(i)>1.625)assert.equal(length,0,'speech must leave the nose and upper face untouched');
    if(length>0.001)moved++;
    assert.ok(length<.009);
  }
  assert.ok(moved>20,'actual lip and jaw vertices must move');
});

test('speech leaves chin underside, neck, scarf and collar entirely unchanged',()=>{
  const g=createFatherV1(buildCharacter(),asset).body.geometry,p=g.attributes.position,m=g.morphAttributes.position[1];
  let throat=0;
  for(let i=0;i<p.count;i++)if(p.getY(i)<=1.596){
    assert.equal(new T.Vector3().fromBufferAttribute(m,i).lengthSq(),0);
    if(p.getY(i)>1.48)throat++;
  }
  assert.ok(throat>100,'exercise actual throat and collar geometry');
});

test('opposite father glances turn the head without shifting torso or shoulders',async()=>{
  const {libraryFrom}=await import('../src/animator.js');const data=readFileSync('public/anim/ual.glb');
  const lib=libraryFrom(await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),''));
  const figures=[-1,1].map(sign=>{const f=new HoloFigure('father',{lib,humans:[],fatherAsset:asset});f.t=0;f.seed=1;f.animator.phase=0;f.glance={t:100,until:100,target:'aside',yaw:sign*.6,pitch:0};return f;});
  const restPositions=figures[0].humanoid.body.geometry.attributes.position.clone();
  let headDifference=0;
  for(let frame=0;frame<90;frame++){
    for(const f of figures){f.update(1/30,{talking:true});f.object.updateMatrixWorld(true);}
    for(const name of ['pelvis','spine_01','spine_02','spine_03','neck_01','upperarm_l','upperarm_r']){
      const a=figures[0].humanoid.b[name],b=figures[1].humanoid.b[name];
      assert.ok(a.getWorldPosition(new T.Vector3()).distanceTo(b.getWorldPosition(new T.Vector3()))<1e-6,name+' position');
      assert.ok(a.getWorldQuaternion(new T.Quaternion()).angleTo(b.getWorldQuaternion(new T.Quaternion()))<1e-5,name+' rotation');
    }
    headDifference=Math.max(headDifference,figures[0].humanoid.b.Head.getWorldQuaternion(new T.Quaternion()).angleTo(figures[1].humanoid.b.Head.getWorldQuaternion(new T.Quaternion())));
    // Bone invariance alone missed the collar being pulled by the neck driver.
    const [a,b]=figures.map(f=>f.humanoid.body),p=a.geometry.attributes.position;
    a.skeleton.update();b.skeleton.update();
    for(let i=0;i<p.count;i++){
      const v=new T.Vector3().fromBufferAttribute(restPositions,i);
      if(v.y>1.545||Math.abs(v.x)>.32)continue;
      assert.ok(a.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)).distanceTo(b.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(b.geometry.attributes.position,i)))<1e-6,'gaze must not shift chest, scarf base or shoulders');
    }
  }
  assert.ok(headDifference>.5,'the fix must retain an actual head turn');
});

test('the jaw follows the skull rigidly instead of stretching against neck weights',()=>{
  const mesh=createFatherV1(buildCharacter(),asset).body,g=mesh.geometry,p=g.attributes.position;
  const head=mesh.skeleton.bones.findIndex(b=>b.name==='Head');let jaw=0;
  for(let i=0;i<p.count;i++)if(p.getY(i)>=1.575&&p.getY(i)<1.63&&p.getZ(i)>.135&&Math.abs(p.getX(i))<.06){
    let weight=0;for(let k=0;k<4;k++)if(g.attributes.skinIndex.getComponent(i,k)===head)weight+=g.attributes.skinWeight.getComponent(i,k);
    assert.ok(weight>.999,'jaw must not shear during gaze');jaw++;
  }
  assert.ok(jaw>20,'exercise the protruding lower chin, not just the upper jaw');
});

test('neck transition retains surface length through strong skull turns',()=>{
  const f=new HoloFigure('father',{humans:[],fatherAsset:asset});
  const mesh=f.humanoid.body,g=mesh.geometry,p=g.attributes.position,ix=g.index;
  const rest=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i));
  let min=Infinity,max=0,count=0,worst;
  for(const yaw of [-.7,-.35,0,.35,.7])for(const pitch of [-.3,0,.35]){
    mesh.skeleton.pose();applyFatherGaze(f.humanoid,yaw,pitch);
    f.object.updateMatrixWorld(true);mesh.skeleton.update();
    const posed=rest.map((v,i)=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)));
    for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){
      const a=ix.getX(i+k),b=ix.getX(i+(k+1)%3),mid=rest[a].clone().add(rest[b]).multiplyScalar(.5),length=rest[a].distanceTo(rest[b]);
      if(mid.y<1.55||mid.y>1.65||Math.abs(mid.x)>.13||length<.004)continue;
      const ratio=posed[a].distanceTo(posed[b])/length;if(ratio<min)worst={a:rest[a].toArray(),b:rest[b].toArray(),yaw,pitch};min=Math.min(min,ratio);max=Math.max(max,ratio);count++;
    }
  }
  console.log('Father neck surface length range:',{min,max,count,worst});
  assert.ok(min>.45,'no neck edges collapse below 45% of rest length');
  assert.ok(max<2.5,'no neck edges stretch beyond 2.5x');
  console.log('Father neck correction budget:',{vertices:mesh.userData.gazeCorrection.rows.length,edges:mesh.userData.gazeCorrection.edges.length});
});

test('neck correction is repeatable, resets to rest and follows translated/rotated spawns',()=>{
  const chars=[buildCharacter(),buildCharacter()];chars[1].root.position.set(19,-3,7);chars[1].root.rotation.y=1.1;
  const humans=chars.map(c=>createFatherV1(c,asset));
  const rest=humans[0].body.geometry.attributes.position.clone();
  for(let repeat=0;repeat<3;repeat++){
    for(const h of humans){h.body.skeleton.pose();applyFatherGaze(h,.6,-.2);h.char.root.updateMatrixWorld(true);h.body.skeleton.update();}
    const [a,b]=humans.map(h=>h.body);
    for(const {i} of a.userData.gazeCorrection.rows){
      const v=mesh=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i));
      assert.ok(v(a).distanceTo(v(b))<1e-5,'same deformation at world-space spawn');
    }
  }
  resetFatherGaze(humans[0].body);
  assert.deepEqual(humans[0].body.geometry.attributes.position.array,rest.array);
});
