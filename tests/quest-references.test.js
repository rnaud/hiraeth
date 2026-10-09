import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const el=()=>({classList:{add(){},remove(){},toggle(){},contains:()=>false},style:{},dataset:{},remove(){},addEventListener(){},querySelector:()=>null,appendChild(){},set textContent(v){},set innerHTML(v){}});
globalThis.document??={createElement:el,body:el(),getElementById:()=>null,querySelector:()=>null};
globalThis.window??={innerWidth:1200,innerHeight:800};
const {QUEST_LOOKS}=await import('../src/characters/quest-looks.js');
const {namedLook,crowdLook}=await import('../src/costumes.js');
const {questPieces}=await import('../src/characters/quest-pieces.js');
const {castOf}=await import('../src/studio/people.js');
const {NPC}=await import('../src/npc.js');
const {Physics}=await import('../src/physics.js');
const {parseBody}=await import('../src/makehuman/body.js');
const {MakeHumanPeople}=await import('../src/makehuman/people.js');
const {loadAssets}=await import('./gait-sim.js');
const {mulberry32}=await import('../src/noise.js');
const {cabModel}=await import('../src/taxi.js');
const V=()=>new THREE.Vector3();
const bin=readFileSync(new URL('../public/anim/mh/body.bin',import.meta.url));
const data=parseBody(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength));
const cast=new Map();for(const world of Object.keys(QUEST_LOOKS))cast.set(world,await castOf(world));

test('every reference outfit resolves to an existing story person, including older locals and street vendors',()=>{
 let count=0;
 for(const [world,designs] of Object.entries(QUEST_LOOKS))for(const [id,design] of Object.entries(designs)){
   const def=cast.get(world).find(p=>p.id===id);assert.ok(def,`${world}/${id} exists`);
   assert.equal(def.name,design.name);count++;
 }
 assert.equal(count,46);
 assert.equal(cast.get('arzach').find(p=>p.id==='tam').age,'child');
});

test('reference costumes keep both body families skinned and their held tools attached through a pose change',async()=>{
 const {lib,human}=await loadAssets();
 for(const family of ['makehuman','quaternius'])for(const [world,designs] of Object.entries(QUEST_LOOKS)){
   const mh=new MakeHumanPeople(data,world);
   for(const id of Object.keys(designs)){
     const def=cast.get(world).find(p=>p.id===id),kind=def.body??def.kind??'m';
     const scene=new THREE.Scene(),npc=new NPC(scene,new Physics(scene),{world,def,kind,lines:['…'],route:[V()],lib,human:family==='makehuman'?mh.template(kind):human[kind],palette:def.palette,head:def.head,look:def.look,scale:def.scale});
     assert.equal(npc.look.reference,`${world}/${id}`);assert.equal(npc.char.pack.visible,false);
     const h=npc.humanoid;let vertices=0,moved=false;
     for(const mesh of h._costume){
       const g=mesh.geometry,P=g.attributes.position,J=g.attributes.skinIndex,W=g.attributes.skinWeight;
       assert.ok(P.count>0);vertices+=P.count;
       for(let i=0;i<P.count;i++){
         assert.ok(Number.isFinite(P.getX(i)+P.getY(i)+P.getZ(i)),`${id}: finite`);
         assert.ok(Math.abs(W.getX(i)+W.getY(i)+W.getZ(i)+W.getW(i)-1)<1e-5,`${id}: normalized weights`);
         for(let k=0;k<4;k++)assert.ok(J.array[i*4+k]<mesh.skeleton.bones.length);
       }
       g.computeBoundingBox();assert.ok(g.boundingBox.getSize(V()).length()<5,`${id}: wearable bounds`);
       if(!designs[id].tool)continue;
       const j=mesh.skeleton.bones.indexOf(h.b.hand_r),i=Array.from({length:J.count},(_,i)=>i).find(i=>J.getX(i)===j&&W.getX(i)>.99);
       if(i===undefined)continue;
       npc.object.updateMatrixWorld(true);const before=mesh.applyBoneTransform(i,V().fromBufferAttribute(P,i));
       h.b.lowerarm_r.rotation.x+=.6;npc.object.updateMatrixWorld(true);const after=mesh.applyBoneTransform(i,V().fromBufferAttribute(P,i));
       moved ||= before.distanceTo(after)>.015;
     }
     assert.ok(vertices<60000,`${id}: bounded detail budget (${vertices})`);
     if(designs[id].tool)assert.ok(moved,`${family}/${id}: tool follows arm`);
     npc.cape?.dispose(scene);
   }
 }
});

test('late-named locals acquire their reference without losing their route, scale, or body',async()=>{
 const {lib,human}=await loadAssets(),scene=new THREE.Scene();
 const npc=new NPC(scene,new Physics(scene),{lines:['…'],world:'arzach',kind:'m',route:[V(),new THREE.Vector3(2,0,1)],scale:.72,age:'child',years:7,lib,human:human.m});
 const route=npc.route,body=npc.humanoid,scale=npc.object.scale.clone();
 npc.identify(cast.get('arzach').find(p=>p.id==='tam'),'arzach');
 assert.equal(npc.look.reference,'arzach/tam');assert.equal(npc.route,route);assert.equal(npc.humanoid,body);assert.deepEqual(npc.object.scale,scale);
 const look=npc.look;npc.identify(npc.def,'arzach');assert.equal(npc.look,look,'idempotent');
});

test('unnamed people keep their original pieces; reference geometry is isolated per identity',()=>{
 const look=crowdLook(mulberry32(22),{world:'buried',kind:'m',pos:V()}),pieces={head:[],chest:[],hand:[],back:[]};
 assert.equal(questPieces(look,pieces),pieces);
 assert.equal(namedLook({world:'desert',id:'nour'}).reference,undefined);
 const a=namedLook({world:'garage',id:'ottla'}),b=namedLook({world:'bazaar',id:'ferro'});
 assert.notEqual(a.reference,b.reference);
 const pa=questPieces(a,{...pieces}),pb=questPieces(b,{...pieces});
 assert.notEqual(pa.head.length,pb.head.length,'distinct helmet details survive shared base head/prop ids');
});

test('Wren alone gets her numbered repairs, within the existing cab envelope',()=>{
 const normal=cabModel('#f2c54b',1,{fares:false}),wren=cabModel('#f2c54b',1,{fares:false,reference:'wren'});
 assert.equal(normal.getObjectByName('Wren — 991 and repairs'),undefined);
 const trim=wren.getObjectByName('Wren — 991 and repairs');assert.ok(trim);
 trim.geometry.computeBoundingBox();const b=trim.geometry.boundingBox;
 assert.ok(b.min.x>-.95&&b.max.x<.95&&b.min.y>-.4&&b.max.z<2.21);
 assert.equal(trim.userData.noCollide,true);
});
