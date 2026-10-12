import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createKeeperCreature} from '../src/characters/keeper-creature.js';
import {Guardian} from '../src/temples/boss.js';
import {KEEPER} from '../src/temples/desert.js';
import {KEEPER_LEGS,keeperPoint} from '../src/characters/keeper-fit.js';

globalThis.ProgressEvent ??= class {constructor(type,v){this.type=type;Object.assign(this,v);}};
const bytes=fs.readFileSync(new URL('../public/guardians/keeper-v1/model.glb',import.meta.url));
const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+len));
for(const m of json.meshes)for(const p of m.primitives)delete p.material;
delete json.materials;delete json.textures;delete json.images;
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+len).toString('base64');
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
const vertex=(mesh,i)=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i));
const frame=(m,t,opts={})=>{m.group.position.copy(m.pos);m.group.rotation.y=m.heading;m.animate(1/60,t,{state:'fight',kit:{ground:()=>0},...opts});};

test('Keeper bind pose roundtrips every vertex; all 26 joints have influence',()=>{
 const m=createKeeperCreature(gltf),mesh=m.meshes[0],a=mesh.geometry.attributes,counts=new Array(26).fill(0);m.group.updateMatrixWorld(true);
 let error=0;
 for(let i=0;i<a.position.count;i++){
  error=Math.max(error,vertex(mesh,i).distanceTo(new T.Vector3().fromBufferAttribute(a.position,i)));
  let sum=0;for(let k=0;k<4;k++){const w=a.skinWeight.getComponent(i,k);sum+=w;if(w>.1)counts[a.skinIndex.getComponent(i,k)]++;}assert.ok(Math.abs(sum-1)<1e-6);
 }
 assert.ok(error<2e-6,`bind error ${error}`);assert.equal(mesh.skeleton.bones.length,26);assert.ok(counts.every(n=>n>100));m.dispose();
});

test('each leg and jaw visibly deforms only its own weighted region',()=>{
 const m=createKeeperCreature(gltf),mesh=m.meshes[0],a=mesh.geometry.attributes;
 for(const name of [...Array.from({length:6},(_,i)=>`leg${i}_shin`),'jaw']){
  const bone=m.bones[name],index=mesh.skeleton.bones.indexOf(bone),before=Array.from({length:a.position.count},(_,i)=>vertex(mesh,i));
  const q=bone.quaternion.clone();bone.rotateX(.35);m.group.updateMatrixWorld(true);let changed=0;
  for(let i=0;i<a.position.count;i++){
   let influence=0;for(let k=0;k<4;k++)if(a.skinIndex.getComponent(i,k)===index)influence+=a.skinWeight.getComponent(i,k);
   const displacement=vertex(mesh,i).distanceTo(before[i]);if(influence===0)assert.ok(displacement<1e-6,`${name} leaked to vertex ${i}`);else if(displacement>.005)changed++;
  }
  assert.ok(changed>100,`${name} only moved ${changed} vertices`);bone.quaternion.copy(q);m.group.updateMatrixWorld(true);
 }m.dispose();
});

test('six legs reuse measured lengths and hold planted world-space feet while walking and turning',()=>{
 const m=createKeeperCreature(gltf),swings=new Set();let maxError=0,stance=0;
 KEEPER_LEGS.forEach((l,i)=>assert.ok(Math.abs(m.kit.legs[i].lenA-keeperPoint(l.hip).distanceTo(keeperPoint(l.knee)))<1e-8));
 for(let f=0;f<600;f++){
  const t=f/60;m.heading=t*.13;m.pos.set(5+Math.sin(m.heading)*4,0,8+t*.65);frame(m,t);
  m.kit.rig.planner.feet.forEach((foot,i)=>{
   const actual=m.bones[`leg${i}_foot`].getWorldPosition(new T.Vector3());
   maxError=Math.max(maxError,actual.distanceTo(foot.pos));
   if(!foot.planted)swings.add(i);else {stance++;assert.ok(Math.abs(actual.y)<.002,`foot ${i} y ${actual.y}`);}
  });
 }
 assert.equal(swings.size,6);assert.ok(stance>1000);assert.ok(maxError<.002,`IK target error ${maxError}`);m.dispose();
});

test('real boss poses keep finite skin vertices and reachable mouth; reset repeats the same gait',()=>{
 const m=createKeeperCreature(gltf),rt={def:{id:'keeper-test'},root:new T.Group(),logic:{resolved:false},physics:{groundAt:()=>0},player:{pos:new T.Vector3(0,0,9),dead:false}};
 const boss=new Guardian(rt,{def:KEEPER,model:m,arena:{center:new T.Vector3(),r:20,y:0}});
 const mesh=m.meshes[0];
 for(const mode of ['sleep','wake','open','weary','resolved',...Object.keys(KEEPER.attacks)]){
  m.reset();boss.state=KEEPER.attacks[mode]?'fight':mode;boss.attack=KEEPER.attacks[mode]?{...KEEPER.attacks[mode],id:mode}:null;
  for(let f=0;f<150;f++){
   const t=f/60,k=t/1.4;boss.attackK=k;boss.struck=k>=1;boss.poseRig(1/60,t);frame(m,t,{state:boss.state,attack:boss.attack,k});
   assert.ok(m.mouth.toArray().every(Number.isFinite));
   if(f%30===0)for(let i=0;i<mesh.geometry.attributes.position.count;i+=37)assert.ok(vertex(mesh,i).toArray().every(Number.isFinite),mode);
  }
  if(mode==='open'||mode==='weary')assert.ok(m.mouth.y>0&&m.mouth.y<3.5,`${mode} mouth ${m.mouth.y}`);
 }
 const sample=()=>{m.reset();for(let f=0;f<120;f++){m.pos.z=f/60;frame(m,f/60);}return Object.values(m.bones).flatMap(b=>[...b.position,...b.quaternion]);};
 assert.deepEqual(sample(),sample());boss.dispose();m.dispose();
});

test('generated Keeper runs through real encounter updates and reset without replacing the controller',()=>{
 const m=createKeeperCreature(gltf),rt={def:{id:'keeper-encounter-test'},root:new T.Group(),logic:{resolved:false},physics:{groundAt:()=>0},player:{pos:new T.Vector3(0,0,9),dead:false}};
 const boss=new Guardian(rt,{def:KEEPER,model:m,arena:{center:new T.Vector3(),r:20,y:0}}),states=new Set(),attacks=new Set();
 for(let f=0;f<3600;f++){boss.update(1/60,f/60);states.add(boss.state);if(boss.attack)attacks.add(boss.attack.id);assert.ok(m.mouth.toArray().every(Number.isFinite));}
 assert.ok(states.has('wake')&&states.has('fight'));assert.ok(attacks.size>=2,`attacks: ${[...attacks]}`);
 boss.reset();assert.equal(boss.state,'sleep');boss.dispose();m.dispose();
});

test('independent footfalls keep four supports and never lift neighbouring legs together',()=>{
 const m=createKeeperCreature(gltf),p=m.kit.rig.planner,used=new Set();let lastLift=-Infinity,overlap=0;
 assert.equal(p.gait,'independent');assert.ok(p.groups.every(g=>g.length===1));
 let planted=p.feet.map(()=>true);
 for(let f=0;f<1200;f++){
  const t=f/60;m.pos.set(Math.sin(t*.1)*2,0,t*.9);m.heading=t*.1;frame(m,t);
  const airborne=p.feet.flatMap((v,i)=>v.planted?[]:[i]);assert.ok(airborne.length<=2);if(airborne.length===2)overlap++;
  const lifted=p.feet.flatMap((v,i)=>!v.planted&&planted[i]?[i]:[]);assert.ok(lifted.length<=1);
  if(lifted.length){assert.ok(t-lastLift>=.13);lastLift=t;used.add(lifted[0]);}
  for(const i of airborne)assert.ok(p.neighbours[i].every(j=>p.feet[j].planted));
  planted=p.feet.map(v=>v.planted);
 }
 assert.equal(used.size,6);assert.ok(overlap>10,'independent steps overlap without tripod batches');m.dispose();
});

test('flowing steps have zero lift-off and landing velocity',()=>{
 const m=createKeeperCreature(gltf),p=m.kit.rig.planner,f=p.feet[0];f.from.set(0,0,0);f.to.set(0,0,1);f.lift=.2;
 const eps=1e-4,a=new T.Vector3(),b=new T.Vector3();
 for(const end of [0,1]){p.arcAt(f,end,a);p.arcAt(f,end===0?eps:1-eps,b);assert.ok(a.distanceTo(b)/eps<.002);}
 m.dispose();
});

test('resting jaw closes the hanging lower lip without deforming the upper muzzle',()=>{
 const m=createKeeperCreature(gltf),mesh=m.meshes[0],pos=mesh.geometry.attributes.position;
 const upper=[],lower=[];
 for(let i=0;i<pos.count;i++){const x=-pos.getZ(i)/8,y=pos.getY(i)/8;if(x<-.42&&y>.848)upper.push([i,vertex(mesh,i)]);if(x<-.43&&y<.81&&y>.79)lower.push([i,vertex(mesh,i)]);}
 assert.ok(upper.length>20&&lower.length>20);
 m.jaw.rotation.x=-1.04;m.group.updateMatrixWorld(true);
 for(const[i,v]of upper)assert.ok(vertex(mesh,i).distanceTo(v)<1e-6);
 const rise=lower.reduce((sum,[i,v])=>sum+vertex(mesh,i).y-v.y,0)/lower.length;
 assert.ok(rise>.2,`lower lip rise ${rise}`);
 for(let f=0;f<180;f++)frame(m,f/60);assert.ok(Math.abs(m.jaw.rotation.x+1.04)<1e-6,'default jaw is closed');m.dispose();
});

test('sweep neck motion blends across the strike and release boundaries',()=>{
 const m=createKeeperCreature(gltf);let previous=m.neck[4].quaternion.clone();
 for(let f=0;f<240;f++){
  const t=f/60;frame(m,t,{attack:t<2.4?{id:'sweep',side:1}:null,k:t/1.8});
  if((f>=106&&f<=110)||(f>=142&&f<=147))assert.ok(previous.angleTo(m.neck[4].quaternion)<.06,`neck snap at ${t}`);
  previous.copy(m.neck[4].quaternion);
 }m.dispose();
});
