import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createElderCreature} from '../src/characters/elder-creature.js';
import {Guardian} from '../src/temples/boss.js';
import {ELDER} from '../src/temples/arzach.js';
import {ELDER_LEGS,elderPoint} from '../src/characters/elder-fit.js';

globalThis.ProgressEvent ??= class {constructor(type,v){this.type=type;Object.assign(this,v);}};
const bytes=fs.readFileSync(new URL('../public/guardians/elder-v1/model.glb',import.meta.url));
const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+len));
for(const m of json.meshes)for(const p of m.primitives)delete p.material;
delete json.materials;delete json.textures;delete json.images;
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+len).toString('base64');
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
const vertex=(mesh,i)=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i));
const frame=(m,t,opts={})=>{m.group.position.copy(m.pos);m.group.rotation.y=m.heading;m.animate(1/60,t,{state:'fight',kit:{ground:()=>0},...opts});};

test('Elder bind pose roundtrips every vertex; all 23 joints have influence',()=>{
 const m=createElderCreature(gltf),mesh=m.meshes[0],a=mesh.geometry.attributes,counts=new Array(23).fill(0);m.group.updateMatrixWorld(true);
 let error=0;
 for(let i=0;i<a.position.count;i++){
  error=Math.max(error,vertex(mesh,i).distanceTo(new T.Vector3().fromBufferAttribute(a.position,i)));
  let sum=0;for(let k=0;k<4;k++){const w=a.skinWeight.getComponent(i,k);sum+=w;if(w>.1)counts[a.skinIndex.getComponent(i,k)]++;}assert.ok(Math.abs(sum-1)<1e-6);
 }
 assert.ok(error<2e-6,`bind error ${error}`);assert.equal(mesh.skeleton.bones.length,23);assert.ok(counts.every(n=>n>100));m.dispose();
});

test('each leg and jaw visibly deforms only its own weighted region',()=>{
 const m=createElderCreature(gltf),mesh=m.meshes[0],a=mesh.geometry.attributes;
 for(const name of [...Array.from({length:2},(_,i)=>`leg${i}_shin`),'jaw','wing0_1','wing1_1','tail1']){
  const bone=m.bones[name],indices=new Set();bone.traverse(b=>indices.add(mesh.skeleton.bones.indexOf(b)));const before=Array.from({length:a.position.count},(_,i)=>vertex(mesh,i));
  const q=bone.quaternion.clone();bone.rotateX(.35);m.group.updateMatrixWorld(true);let changed=0;
  for(let i=0;i<a.position.count;i++){
   let influence=0;for(let k=0;k<4;k++)if(indices.has(a.skinIndex.getComponent(i,k)))influence+=a.skinWeight.getComponent(i,k);
   const displacement=vertex(mesh,i).distanceTo(before[i]);if(influence===0)assert.ok(displacement<1e-6,`${name} leaked to vertex ${i}`);else if(displacement>.005)changed++;
  }
  assert.ok(changed>100,`${name} only moved ${changed} vertices`);bone.quaternion.copy(q);m.group.updateMatrixWorld(true);
 }m.dispose();
});

test('two legs reuse measured lengths and hold planted world-space feet while walking and turning',()=>{
 const m=createElderCreature(gltf),swings=new Set();let maxError=0,stance=0;
 ELDER_LEGS.forEach((l,i)=>assert.ok(Math.abs(m.kit.legs[i].lenA-elderPoint(l.hip).distanceTo(elderPoint(l.knee)))<1e-8));
 for(let f=0;f<600;f++){
  const t=f/60;m.heading=t*.13;m.pos.set(5+Math.sin(m.heading)*4,0,8+t*.65);frame(m,t);
  m.kit.rig.planner.feet.forEach((foot,i)=>{
   const actual=m.bones[`leg${i}_foot`].getWorldPosition(new T.Vector3());
   maxError=Math.max(maxError,actual.distanceTo(foot.pos));
   if(!foot.planted)swings.add(i);else {stance++;assert.ok(Math.abs(actual.y)<.002,`foot ${i} y ${actual.y}`);}
  });
 }
 assert.equal(swings.size,2);assert.ok(stance>200);assert.ok(maxError<.002,`IK target error ${maxError}`);m.dispose();
});

test('real boss poses keep finite skin vertices and reachable mouth; reset repeats the same gait',()=>{
 const m=createElderCreature(gltf),rt={def:{id:'elder-test'},root:new T.Group(),logic:{resolved:false},physics:{groundAt:()=>0},player:{pos:new T.Vector3(0,0,9),dead:false}};
 const boss=new Guardian(rt,{def:ELDER,model:m,arena:{center:new T.Vector3(),r:20,y:0}});
 const mesh=m.meshes[0];
 for(const mode of ['sleep','wake','open','weary','resolved',...Object.keys(ELDER.attacks)]){
  m.reset();boss.state=ELDER.attacks[mode]?'fight':mode;boss.attack=ELDER.attacks[mode]?{...ELDER.attacks[mode],id:mode}:null;
  for(let f=0;f<150;f++){
   const t=f/60,k=t/1.4;boss.attackK=k;boss.struck=k>=1;boss.poseRig(1/60,t);frame(m,t,{state:boss.state,attack:boss.attack,k});
   assert.ok(m.mouth.toArray().every(Number.isFinite));
   if(f%30===0)for(let i=0;i<mesh.geometry.attributes.position.count;i+=37)assert.ok(vertex(mesh,i).toArray().every(Number.isFinite),mode);
  }
  if(mode==='weary')assert.ok(m.mouth.y>0&&m.mouth.y<6,`${mode} mouth ${m.mouth.y}`);
 }
 const sample=()=>{m.reset();for(let f=0;f<120;f++){m.pos.z=f/60;frame(m,f/60);}return Object.values(m.bones).flatMap(b=>[...b.position,...b.quaternion]);};
 assert.deepEqual(sample(),sample());boss.dispose();m.dispose();
});

test('generated Elder runs through real encounter updates and reset without replacing the controller',()=>{
 const m=createElderCreature(gltf),rt={def:{id:'elder-encounter-test'},root:new T.Group(),logic:{resolved:false},physics:{groundAt:()=>0},player:{pos:new T.Vector3(0,0,9),dead:false}};
 const boss=new Guardian(rt,{def:ELDER,model:m,arena:{center:new T.Vector3(),r:20,y:0}}),states=new Set(),attacks=new Set();
 for(let f=0;f<3600;f++){boss.update(1/60,f/60);states.add(boss.state);if(boss.attack)attacks.add(boss.attack.id);assert.ok(m.mouth.toArray().every(Number.isFinite));}
 assert.ok(states.has('wake')&&states.has('fight'));assert.ok(attacks.size>=2,`attacks: ${[...attacks]}`);
 boss.reset();assert.equal(boss.state,'sleep');boss.dispose();m.dispose();
});


test('hover raises the complete skin; wing tips carry a delayed beat and feet hang clear',()=>{
 const m=createElderCreature(gltf),mesh=m.meshes[0];let min=Infinity,max=-Infinity;
 for(let f=0;f<360;f++){const t=f/60;m.pos.set(4,3.5,7);m.heading=.4;frame(m,t,{phase:1});if(f>120){const tip=m.part('wings',new T.Vector3(),1);min=Math.min(min,tip.y);max=Math.max(max,tip.y);assert.ok(m.bones.leg1_foot.getWorldPosition(new T.Vector3()).y>2);assert.ok(m.mouth.y>8);}}
 assert.ok(max-min>1.2,`wingbeat range ${max-min}`);assert.ok(Math.abs(m.wings[0][1].rotation.z)>0);m.dispose();
});

test('the lower beak closes while the skull and upper beak stay fixed',()=>{
 const m=createElderCreature(gltf),mesh=m.meshes[0],a=mesh.geometry.attributes.position,upper=[],lower=[];
 for(let i=0;i<a.count;i++){const y=a.getY(i)/10.7,z=a.getZ(i)/10.7,seam=.604-.61*(z-.20);if(z>.25&&y>seam+.005)upper.push([i,vertex(mesh,i)]);if(z>.25&&y<seam-.004)lower.push([i,vertex(mesh,i)]);}
 assert.ok(upper.length>20&&lower.length>20);m.jaw.quaternion.setFromAxisAngle(new T.Vector3(.82,0,.57).normalize(),-.055);m.updateAnchors();
 for(const[i,v]of upper)assert.ok(vertex(mesh,i).distanceTo(v)<1e-5);
 const rise=lower.reduce((s,[i,v])=>s+vertex(mesh,i).y-v.y,0)/lower.length;assert.ok(rise>.025,`lower beak rise ${rise}`);m.dispose();
});

test('full attack and flight cycles keep skin edges bounded without frame jumps',()=>{
 const m=createElderCreature(gltf),mesh=m.meshes[0],a=mesh.geometry.attributes.position,index=mesh.geometry.index,edges=[];
 for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){const u=index.getX(i+k),v=index.getX(i+(k+1)%3),d=new T.Vector3().fromBufferAttribute(a,u).distanceTo(new T.Vector3().fromBufferAttribute(a,v));if(d>.02)edges.push([u,v,d]);}
 let worst=0,detail='';
 for(const mode of ['hover','walk','sleep','weary','resolved',...Object.keys(ELDER.attacks)]){m.reset();const atk=ELDER.attacks[mode];for(let f=0;f<240;f++){const t=f/60;const active=atk&&t<2.4;m.pos.set(0,mode==='hover'?3.5:0,mode==='walk'?t*.9:0);frame(m,t,{state:['sleep','weary','resolved'].includes(mode)?mode:'fight',phase:mode==='hover'?1:0,attack:active?{...atk,id:mode}:null,k:t/1.8});if(f%30===0){const vs=Array.from({length:a.count},(_,i)=>vertex(mesh,i));for(const[u,v,d]of edges){const ratio=vs[u].distanceTo(vs[v])/d;if(ratio>worst){worst=ratio;detail=`${mode} t=${t} edge=${u}/${v}`;}}}}}
 assert.ok(worst<4,`edge stretch ${worst.toFixed(2)}: ${detail}`);m.dispose();
});

test('wing and head rotations blend through strikes and attack recovery',()=>{
 const m=createElderCreature(gltf);let previous=null;
 for(let f=0;f<360;f++){const t=f/60;frame(m,t,{phase:1,attack:t<2.4?{id:'buffet'}:null,k:t/1.8});const current=[m.head,...m.wings.flat()].map(b=>b.quaternion.clone());if(previous)for(let i=0;i<current.length;i++)assert.ok(current[i].angleTo(previous[i])<.13,`joint ${i} jumps at ${t}`);previous=current;}m.dispose();
});

test('all encounter phases preserve finite anchors and complete movement cycles',()=>{
 const m=createElderCreature(gltf),rt={def:{id:'elder-phases'},root:new T.Group(),logic:{resolved:false},physics:{groundAt:()=>0},player:{pos:new T.Vector3(0,0,9),dead:false}};
 const boss=new Guardian(rt,{def:ELDER,model:m,arena:{center:new T.Vector3(),r:20,y:0}});
 for(const meter of [0,.46,.76]){boss.reset();m.reset();boss.meter=boss.floor=meter;let flying=false;for(let f=0;f<1800;f++){boss.update(1/60,f/60);for(const part of ['mouth','feet','wings'])assert.ok(m.part(part,new T.Vector3()).toArray().every(Number.isFinite));if(m.floats){flying=true;assert.ok(m.mouth.y>4);}}if(meter>0)assert.ok(flying);}
 boss.dispose();m.dispose();
});
