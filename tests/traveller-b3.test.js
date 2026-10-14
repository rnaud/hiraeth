import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const el=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document??={createElement:el,body:el(),getElementById:()=>null,querySelector:()=>null};globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init)}};
const {parseBody}=await import('../src/makehuman/body.js');
const {buildCharacter}=await import('../src/player.js');
const {createTravellerB3}=await import('../src/characters/traveller-b3.js');
const {Animator,libraryFrom}=await import('../src/animator.js');
async function load(path,texture=false){const b=readFileSync(path);if(texture)return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'');const n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n)),bin=b.subarray(28+n);j.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;return new GLTFLoader().parseAsync(JSON.stringify(j),'')}
const b=readFileSync('public/anim/mh/body.bin'),data=parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));
const gltf=await load('public/characters/traveller-b3/model.glb'),head=await load('public/characters/traveller-v1/head-v3/model.glb'),report=JSON.parse(readFileSync('public/characters/traveller-b3/rig.json'));
const lib=libraryFrom(await load('public/anim/ual.glb',true));
const create=()=>{const char=buildCharacter();return {char,...createTravellerB3(char,{gltf,data,report,head,colors:JSON.parse(readFileSync('public/characters/traveller-b3/colors.json'))})}};

test('B3 shares the fitted body/head skeleton and preserves rest binding at arbitrary spawns',()=>{
 const c=create(),h=c.humanoid;h.body.skeleton.pose();c.char.root.position.set(61,13,-29);c.char.root.rotation.set(.1,.7,.2);c.char.root.updateMatrixWorld(true);h.body.skeleton.update();
 assert.equal(c.head.skeleton,c.mesh.skeleton);assert.equal(c.mesh.skeleton.bones.length,53);assert.ok(c.mesh.material.isShaderMaterial&&c.head.material.isShaderMaterial);
 assert.ok(c.mesh.geometry.attributes.position.count<29288,'original head removed');
 for(const mesh of [c.mesh,c.head]){const p=mesh.geometry.attributes.position,w=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i+=23){const v=new T.Vector3().fromBufferAttribute(p,i);assert.ok(mesh.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-5);assert.ok(Math.abs([0,1,2,3].reduce((s,k)=>s+w.getComponent(i,k),0)-1)<1e-6)}}
 const left=h.rest.get(h.b.upperarm_l).p,right=h.rest.get(h.b.upperarm_r).p;assert.ok(left.distanceTo(right)<.33,'narrow shoulder pivots');
});

test('all thirty B3 digit joints deform actual hand vertices',()=>{
 const c=create(),h=c.humanoid,m=c.mesh,p=m.geometry.attributes.position,j=m.geometry.attributes.skinIndex,w=m.geometry.attributes.skinWeight;
 h.body.skeleton.pose();c.char.root.updateMatrixWorld(true);m.skeleton.update();
 for(const side of h.hands.sides)for(const joint of [...side.joints,...side.thumb]){const index=m.skeleton.bones.indexOf(joint.b),ids=[];for(let i=0;i<p.count;i++)if([0,1,2,3].some(k=>j.getComponent(i,k)===index&&w.getComponent(i,k)>.2))ids.push(i);assert.ok(ids.length>=3,`${joint.b.name} support ${ids.length}`);const before=ids.map(i=>m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i))),q=joint.b.quaternion.clone();joint.b.rotateOnAxis(joint.curl??joint.bend,.4);joint.b.updateMatrixWorld(true);m.skeleton.update();const moved=Math.max(...ids.map((i,k)=>m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)).distanceTo(before[k])));assert.ok(moved>.001,`${joint.b.name} moves ${moved}`);joint.b.quaternion.copy(q);joint.b.updateMatrixWorld(true);m.skeleton.update()}
});

test('B3 full locomotion cycles keep mesh deformation finite and seams bounded',()=>{
 const c=create(),h=c.humanoid,m=c.mesh,a=new Animator(lib,c.char),p=m.geometry.attributes.position,idx=m.geometry.index,edges=[],seen=new Set();
 for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){const x=idx.getX(i+k),y=idx.getX(i+(k+1)%3),key=[Math.min(x,y),Math.max(x,y)].join(':');if(seen.has(key))continue;seen.add(key);const u=new T.Vector3().fromBufferAttribute(p,x),v=new T.Vector3().fromBufferAttribute(p,y),len=u.distanceTo(v);if(len>.003)edges.push([x,y,len])}
 const posed=Array.from({length:p.count},()=>new T.Vector3()),stats={};
 for(const motion of ['idle','walk','jog','climbUp','drive']){let max=0,worst;
  for(let phase=0;phase<24;phase++){for(const [name,action]of Object.entries(a.actions)){action.setEffectiveWeight(name===motion?1:0);if(name===motion)action.time=phase/24*lib.clips[motion].duration}a.mixer.update(0);a.src.updateMatrixWorld(true);a.apply(c.char.root);const rot=c.poseArms(motion);h.update();c.poseHands(a,rot);h.hands.update(1/30,{mode:'ground',speed:motion==='jog'?3.8:1.4});c.char.root.updateMatrixWorld(true);m.skeleton.update();
   for(let i=0;i<p.count;i++){m.applyBoneTransform(i,posed[i].fromBufferAttribute(p,i));assert.ok(posed[i].toArray().every(Number.isFinite))}
   for(const [x,y,len]of edges){const ratio=posed[x].distanceTo(posed[y])/len;if(ratio>max){max=ratio;worst=[x,y,p.getX(x),p.getY(x),len]}}
  }stats[motion]={max,worst};
 }
 console.log('B3 cycle edge ratios',JSON.stringify(stats));
 for(const [motion,s]of Object.entries(stats))assert.ok(s.max<5,`${motion} severe edge stretch ${s.max}`);
});

// These regions are on separated fingertip surfaces, independent of the
// nearest-chain weighting implementation. Curling one finger cannot drag them.
test('B3 fingers curl independently without pulling neighboring fingertips',()=>{
 const c=create(),h=c.humanoid,m=c.mesh,p=m.geometry.attributes.position;
 const regions={index:[.832,1.391,1.416],middle:[.840,1.350,1.379],ring:[.831,1.312,1.344],pinky:[.806,1.280,1.310],thumb:[.745,1.443,1.49]};
 for(const side of ['l','r']){
  const tips=Object.fromEntries(Object.entries(regions).map(([f,[x,y0,y1]])=>[f,Array.from({length:p.count},(_,i)=>i).filter(i=>p.getX(i)*(side==='l'?1:-1)>x&&p.getY(i)>y0&&p.getY(i)<y1)]));
  for(const [f,ids]of Object.entries(tips))assert.ok(ids.length>=3,`${side} ${f} fingertip sampled`);
  for(const f of Object.keys(regions)){
   h.body.skeleton.pose();c.char.root.updateMatrixWorld(true);m.skeleton.update();
   const b=h.b[`${f}_01_${side}`],S=h.hands.sides.find(s=>s.s===side),J=[...S.joints,...S.thumb].find(j=>j.b===b);
   b.rotateOnAxis(J.curl??J.bend,.7);b.updateMatrixWorld(true);m.skeleton.update();
   for(const [other,ids]of Object.entries(tips)){
    const moved=ids.map(i=>{const v=new T.Vector3().fromBufferAttribute(p,i);return m.applyBoneTransform(i,v.clone()).distanceTo(v)});
    if(other===f)assert.ok(Math.max(...moved)>.006,`${side} ${f} bends its mesh`);
    else assert.ok(Math.max(...moved)<.0006,`${side} ${f} pulls ${other} by ${Math.max(...moved)} m`);
   }
  }
 }
});

function atClip(c,a,motion,phase){
 for(const [name,action]of Object.entries(a.actions)){action.setEffectiveWeight(name===motion?1:0);if(name===motion)action.time=phase*lib.clips[motion].duration}
 a.mixer.update(0);a.src.updateMatrixWorld(true);a.apply(c.char.root);
}

test('B3 wrist anatomy follows the source palm and finger directions across the clips',()=>{
 const c=create(),h=c.humanoid,a=new Animator(lib,c.char);
 c.char.root.position.set(9,2,-3);c.char.root.rotation.y=.7;
 for(const motion of ['idle','walk','jog','climbUp'])for(const phase of [0,.25,.5,.75]){
  atClip(c,a,motion,phase);const rotations=c.poseArms(motion);h.update();c.poseHands(a,rotations);
  for(const [i,s]of ['r','l'].entries()){
   const hand=h.b[`hand_${s}`],delta=hand.getWorldQuaternion(new T.Quaternion()).multiply(h.rest.get(hand).q.clone().invert());
   const q=a.bone(`hand_${s}`).getWorldQuaternion(new T.Quaternion()).premultiply(c.char.root.getWorldQuaternion(new T.Quaternion()));
   for(const axis of ['along','normal']){
    const actual=h.handFrames[s][axis].clone().applyQuaternion(delta);
    const want=a.handFrames[s][axis].clone().applyQuaternion(q);if(rotations[i])want.applyQuaternion(rotations[i]);
    // Normal is orthogonalized by the anatomical basis; the source axes may
    // contain a small non-orthogonal component from its measured landmarks.
    assert.ok(actual.angleTo(want)<.025,`${motion} ${s} ${axis} mismatch`);
   }
  }
 }
});

test('B3 jog reduces forward neck reach without moving the torso or changing the skull facing',()=>{
 const c=create(),h=c.humanoid,a=new Animator(lib,c.char);
 c.char.root.position.set(12,3,-8);c.char.root.rotation.y=.7;
 for(let phase=0;phase<24;phase++){
  atClip(c,a,'jog',phase/24);h.update();
  const q=c.char.root.getWorldQuaternion(new T.Quaternion()),qi=q.clone().invert();
  const neck=c.char.head,skull=c.char.headNod.getWorldQuaternion(new T.Quaternion());
  const direction=()=>new T.Vector3(0,1,0).applyQuaternion(neck.getWorldQuaternion(new T.Quaternion())).applyQuaternion(qi);
  const before=direction(),torso=c.char.torso.quaternion.clone();
  const oldHead=h.b.Head.getWorldPosition(new T.Vector3()).applyMatrix4(c.char.root.matrixWorld.clone().invert());
  c.poseArms('jog');h.update();const after=direction();
  const newHead=h.b.Head.getWorldPosition(new T.Vector3()).applyMatrix4(c.char.root.matrixWorld.clone().invert());
  assert.ok(Math.atan2(after.z,after.y)<Math.atan2(before.z,before.y)*.5,'less than half the neck pitch');
  assert.ok(oldHead.z-newHead.z>.005,'head moves back over shoulders');
  assert.ok(torso.angleTo(c.char.torso.quaternion)<1e-6);
  assert.ok(skull.angleTo(c.char.headNod.getWorldQuaternion(new T.Quaternion()))<1e-6,'preserve skull facing');
 }
});

test('B3 fists oppose the thumb toward the palm instead of rolling it behind the hand',()=>{
 const c=create(),h=c.humanoid;
 h.body.skeleton.pose();c.char.root.updateMatrixWorld(true);
 const start=Object.fromEntries(['l','r'].map(s=>[s,h.b[`thumb_03_${s}`].getWorldPosition(new T.Vector3())]));
 h.hands.set('fist');c.char.root.updateMatrixWorld(true);
 for(const s of ['l','r']){
  const tip=h.b[`thumb_03_${s}`].getWorldPosition(new T.Vector3());
  assert.ok(tip.y<start[s].y-.025,`${s} thumb closes toward fingers`);
  assert.ok(tip.z>start[s].z+.01,`${s} thumb opposes toward palm`);
 }
 const first=h.body.skeleton.bones.map(b=>b.quaternion.clone());
 for(let i=0;i<20;i++)h.hands.set('fist');
 h.body.skeleton.bones.forEach((b,i)=>assert.deepEqual(b.quaternion.toArray(),first[i].toArray(),'pose does not accumulate'));
});

const {b3MotionCatalogue,B3MotionPlayer,B3_MOTION_FILES}=await import('../src/characters/traveller-b3-motion.js');
const auditFiles=Object.fromEntries(await Promise.all(B3_MOTION_FILES.map(async name=>[name,await load(`public/anim/${name}.glb`,true)])));
const catalogue=b3MotionCatalogue(lib,auditFiles);
test('B3 complete animation-library mesh audit',()=>{
 const c=create(),a=new Animator(lib,c.char),driver=new B3MotionPlayer(c,a,catalogue),rows=[];
 const meshes=[c.mesh,c.head].map(m=>{const p=m.geometry.attributes.position,idx=m.geometry.index,edges=[],seen=new Set();for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){const x=idx.getX(i+k),y=idx.getX(i+(k+1)%3),key=Math.min(x,y)*p.count+Math.max(x,y);if(seen.has(key))continue;seen.add(key);const len=new T.Vector3().fromBufferAttribute(p,x).distanceTo(new T.Vector3().fromBufferAttribute(p,y));if(len>.003)edges.push([x,y,len])}return {m,p,edges,posed:Array.from({length:p.count},()=>new T.Vector3())}});
 for(const entry of catalogue.filter(e=>!process.env.B3_AUDIT_MATCH||new RegExp(process.env.B3_AUDIT_MATCH).test(e.id))){let max=0,headMax=0,worst=null;
  for(let phase=0;phase<=32;phase++){
   driver.pose(entry.id,phase/32*(entry.clip.duration-1e-5),0);
   for(const {m,p,edges,posed}of meshes){
    for(let i=0;i<p.count;i++){m.applyBoneTransform(i,posed[i].fromBufferAttribute(p,i));assert.ok(posed[i].toArray().every(Number.isFinite),`${entry.id} nonfinite vertex`)}
    for(const [x,y,len]of edges){const ratio=posed[x].distanceTo(posed[y])/len;if(m===c.head)headMax=Math.max(headMax,ratio);else if(ratio>max){max=ratio;worst={phase:phase/32,at:[p.getX(x),p.getY(x),p.getZ(x)]}}}
   }
  }
  rows.push({id:entry.id,group:entry.group,duration:entry.clip.duration,bodyStretch:max,headStretch:headMax,worst});
 }
 mkdirSync('output/character-tripo/body-b3',{recursive:true});writeFileSync('output/character-tripo/body-b3/motion-audit.json',JSON.stringify({clips:rows.length,samplesPerClip:33,rows},null,2));
 console.log('B3 full audit',JSON.stringify({count:rows.length,bodyMax:Math.max(...rows.map(r=>r.bodyStretch)),headMax:Math.max(...rows.map(r=>r.headStretch))}));
 for(const row of rows){assert.ok(row.bodyStretch<5.6,`${row.id}: excessive body stretch ${row.bodyStretch}`);assert.ok(row.headStretch<2.5,`${row.id}: excessive neck stretch ${row.headStretch}`)}
 if(!process.env.B3_AUDIT_MATCH)assert.equal(rows.length,209,'200 runtime clips plus nine procedural motion scenarios');
});


test('B3 neck refit preserves the approved face and restricts collar changes to the neck',()=>{
 const c=create(),m=c.mesh,p=m.geometry.attributes.position,mask=m.geometry.attributes.b3NeckSkin;
 assert.ok(mask&&Array.from(mask.array).some(x=>x===1));
 for(let i=0;i<p.count;i++)if(mask.getX(i)>0){assert.ok(p.getY(i)>1.44&&p.getY(i)<1.515);assert.ok(Math.abs(p.getX(i))<.077)}
 let source;head.scene.traverse(o=>{if(o.isMesh)source=o.geometry.attributes.position});const hp=c.head.geometry.attributes.position;
 for(let i=0;i<hp.count;i++)if(source.getY(i)>.24){assert.ok(Math.abs(hp.getX(i)-(source.getX(i)*.280-.001))<1e-6);assert.ok(Math.abs(hp.getY(i)-(source.getY(i)*.280+1.487))<1e-6);assert.ok(Math.abs(hp.getZ(i)-(source.getZ(i)*.280-.006))<1e-6)}
});

test('B3 transitions remain finite and continuous across locomotion, recovery and gestures',()=>{
 const c=create(),a=new Animator(lib,c.char),driver=new B3MotionPlayer(c,a,catalogue),m=c.mesh,p=m.geometry.attributes.position;
 const ids=Array.from({length:p.count},(_,i)=>i).filter(i=>i%37===0),previous=ids.map(()=>new T.Vector3());
 const pairs=[['idle','walk'],['walk','jog'],['jog','sprint'],['climbIdle','climbUp'],['moves:mixamo_ss_slash_1','moves:mixamo_ss_block_1'],['moves:mixamo_get_up_back','idle'],['gestures:gesture_waving','idle']];
 for(const [from,to]of pairs){
  driver.pose(from,.2,0);ids.forEach((id,k)=>m.applyBoneTransform(id,previous[k].fromBufferAttribute(p,id)));
  for(let frame=1;frame<=45;frame++){
   driver.pose(to,.2+frame/60,1/60,{blend:true});
   ids.forEach((id,k)=>{const v=m.applyBoneTransform(id,new T.Vector3().fromBufferAttribute(p,id));assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.distanceTo(previous[k])<.35,`${from} to ${to}: frame ${frame}, vertex ${id} at ${p.getX(id)},${p.getY(id)}: jump ${v.distanceTo(previous[k])}`);previous[k].copy(v)});
  }
 }
});


test('B3 head replacement preserves the raised coral back collar',()=>{
 const c=create(),p=c.mesh.geometry.attributes.position;let original;
 gltf.scene.traverse(o=>{if(o.isSkinnedMesh)original=o.geometry.attributes.position});
 const colors=JSON.parse(readFileSync('public/characters/traveller-b3/colors.json'));
 const key=(p,i)=>[p.getX(i),p.getY(i),p.getZ(i)].join(',');
 const kept=new Set(Array.from({length:p.count},(_,i)=>key(p,i)));let checked=0;
 for(let i=0;i<original.count;i++){
  const [r,g,b]=colors[i];
  if(original.getY(i)>1.495&&original.getY(i)<1.51&&original.getZ(i)<-.035&&Math.abs(original.getX(i))<.1&&g/r<.7&&r>180){
   assert.ok(kept.has(key(original,i)),`raised shirt collar vertex ${i} was cut or moved`);checked++;
  }
 }
 assert.ok(checked>20,`sampled ${checked} raised collar vertices`);
});


test('B3 walking hands clear the actual posed trousers through a complete cycle',async()=>{
 const {MeshBVH}=await import('three-mesh-bvh');
 const c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.mesh,p=m.geometry.attributes.position,idx=m.geometry.index;
 const split=predicate=>{const g=new T.BufferGeometry();g.setAttribute('position',p.clone());const ids=[];for(let i=0;i<idx.count;i+=3){const tri=[0,1,2].map(k=>idx.getX(i+k));if(tri.every(k=>predicate(k)))ids.push(...tri)}g.setIndex(ids);return g};
 const pants=split(i=>p.getY(i)<1.14&&Math.abs(p.getX(i))<.30),hands=['l','r'].map(s=>split(i=>p.getX(i)*(s==='l'?1:-1)>.685));
 const bvh=new MeshBVH(pants),v=new T.Vector3(),hits=[];for(const g of hands)g.boundsTree=new MeshBVH(g);
 for(let phase=0;phase<60;phase++){
  driver.pose('walk',phase/60*lib.clips.walk.duration,0);
  for(let i=0;i<p.count;i++){m.applyBoneTransform(i,v.fromBufferAttribute(p,i));pants.attributes.position.setXYZ(i,v.x,v.y,v.z);for(const g of hands)g.attributes.position.setXYZ(i,v.x,v.y,v.z)}
  bvh.refit();for(const [side,g]of hands.entries()){g.boundsTree.refit();g.computeBoundingBox();if(bvh.intersectsGeometry(g,new T.Matrix4()))hits.push([phase,side]);}
 }
 console.log('B3 walk trouser intersections',JSON.stringify(hits));assert.equal(hits.length,0,'hand triangles must not intersect trouser triangles');
});


test('B3 speech drives both hands on the actual mesh and leaves a held idle body unchanged',()=>{
 const c=create(),h=c.humanoid,driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.mesh,p=m.geometry.attributes.position;
 const tips=Object.fromEntries(['l','r'].map(s=>[s,Array.from({length:p.count},(_,i)=>i).filter(i=>p.getX(i)*(s==='l'?1:-1)>.82)]));
 const points=ids=>ids.map(i=>m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)));
 driver.pose('idle',.3,0);const before=Object.fromEntries(Object.entries(tips).map(([s,ids])=>[s,points(ids)])),torso=h.b.spine_03.matrixWorld.clone();
 driver.pose('idle',.3,0,{speaking:true});assert.deepEqual(h.b.spine_03.matrixWorld.elements,torso.elements);
 for(const [s,ids]of Object.entries(tips)){const after=points(ids);assert.ok(Math.max(...after.map((p,i)=>p.distanceTo(before[s][i])))>.004,`${s} talking fingers visibly move`)}
 const talk=h.hands.sides.map(s=>Array.from(s.cur));
 driver.pose('idle',.3,0,{speaking:true,tone:'curious'});assert.ok(h.hands.sides.some((s,i)=>s.cur.some((v,j)=>Math.abs(v-talk[i][j])>.2)),'speech tone reaches finger poses');
 driver.pose('idle',.3,0);for(const [s,ids]of Object.entries(tips))points(ids).forEach((p,i)=>assert.ok(p.distanceTo(before[s][i])<1e-6,'talk ends without residual curl'));
 driver.pose('talk',.15,0);const first=h.hands.sides.map(s=>Array.from(s.cur));driver.pose('talk',.5,0);
 for(const [i,s]of h.hands.sides.entries())assert.ok(s.cur.some((v,j)=>Math.abs(v-first[i][j])>.02),'syllable beat changes each hand');
 const frozen=h.hands.sides.flatMap(s=>[...s.joints,...s.thumb].map(j=>j.b.quaternion.toArray()));for(let i=0;i<5;i++)driver.pose('talk',.5,0);
 assert.deepEqual(h.hands.sides.flatMap(s=>[...s.joints,...s.thumb].map(j=>j.b.quaternion.toArray())),frozen,'paused speech is deterministic');
});


test('B3 jogging hands clear the animated shirt and the hem has real simulation motion',async()=>{
 const {MeshBVH}=await import('three-mesh-bvh');
 const c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.mesh,p=m.geometry.attributes.position,idx=m.geometry.index;
 const split=predicate=>{const g=new T.BufferGeometry();g.setAttribute('position',p.clone());const ids=[];for(let i=0;i<idx.count;i+=3){const tri=[0,1,2].map(k=>idx.getX(i+k));if(tri.every(k=>predicate(k)))ids.push(...tri)}g.setIndex(ids);g.boundsTree=new MeshBVH(g);return g};
 const torso=split(i=>p.getY(i)>.80&&p.getY(i)<1.35&&Math.abs(p.getX(i))<.25),hands=['l','r'].map(s=>split(i=>p.getX(i)*(s==='l'?1:-1)>.685));
 const cloth=c.cloth.garment.geometry;cloth.boundsTree=new MeshBVH(cloth);const v=new T.Vector3(),hits=[];
 for(const motion of ['walk','jog','sprint']){
  driver.pose(motion,0,0);const dt=lib.clips[motion].duration/60;
  for(let frame=0;frame<180;frame++){
   driver.pose(motion,frame*dt,dt,{blend:true});if(frame<120)continue;
   for(let i=0;i<p.count;i++){m.applyBoneTransform(i,v.fromBufferAttribute(p,i));torso.attributes.position.setXYZ(i,v.x,v.y,v.z);for(const g of hands)g.attributes.position.setXYZ(i,v.x,v.y,v.z)}
   torso.boundsTree.refit();cloth.boundsTree.refit();for(const [side,g]of hands.entries()){g.boundsTree.refit();g.computeBoundingBox();const upper=torso.boundsTree.intersectsGeometry(g,new T.Matrix4()),lower=cloth.boundsTree.intersectsGeometry(g,new T.Matrix4());if(upper||lower)hits.push([motion,frame-120,side,upper?'upper':'hem']);}
  }
 }
 console.log('B3 moving shirt hand intersections',JSON.stringify(hits));assert.equal(hits.length,0);
 const dynamic=cloth.attributes.position.array.slice();c.clothEnabled=false;c.updateCloth(0);let moved=0;for(let i=0;i<dynamic.length;i++)moved=Math.max(moved,Math.abs(dynamic[i]-cloth.attributes.position.array[i]));assert.ok(moved>.001,'simulated hem differs from rigid target');
});

test('B3 seated shirt settles instead of shaking at a held driving pose',()=>{
 const c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),cloth=c.cloth.garment.geometry.attributes.position;
 driver.pose('drive',.3,0);let previous=cloth.array.slice(),max=0;
 for(let frame=0;frame<360;frame++){
  driver.pose('drive',.3,1/60,{blend:true});
  if(frame>=300)for(let i=0;i<cloth.count;i++){const k=i*3;max=Math.max(max,Math.hypot(cloth.array[k]-previous[k],cloth.array[k+1]-previous[k+1],cloth.array[k+2]-previous[k+2]));}
  previous.set(cloth.array);
 }
 console.log('B3 seated settled maximum frame motion',max);assert.ok(max<.0005,`held seated cloth still shakes by ${max} m/frame`);
});

test('B3 moving cloth stays outside reconstructed trousers',async()=>{
 const {MeshBVH}=await import('three-mesh-bvh'),c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.cloth.underlayer,g=m.geometry.clone(),p=m.geometry.attributes.position,v=new T.Vector3(),cloth=c.cloth.garment.geometry,hits=[];
 cloth.boundsTree=new MeshBVH(cloth);g.boundsTree=new MeshBVH(g);
 for(const motion of ['idle','walk','jog','drive']){
  driver.pose(motion,0,0);const dt=lib.clips[motion].duration/60;
  for(let frame=0;frame<180;frame++){
   driver.pose(motion,frame*dt,dt,{blend:true});if(frame<120)continue;
   for(let i=0;i<p.count;i++){m.applyBoneTransform(i,v.fromBufferAttribute(p,i));g.attributes.position.setXYZ(i,v.x,v.y,v.z)}
   g.computeBoundingBox();g.boundsTree.refit();cloth.boundsTree.refit();if(cloth.boundsTree.intersectsGeometry(g,new T.Matrix4()))hits.push([motion,frame-120]);
  }
 }
 console.log('B3 shirt/trouser intersections',JSON.stringify(hits));assert.equal(hits.length,0);
});


test('B3 procedural poses update cloth once, after the final pose, without resetting every frame',()=>{
 const c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),calls=[],update=c.updateCloth;
 c.updateCloth=function(dt,reset){calls.push({dt,reset});return update.call(this,dt,reset)};
 driver.pose('procedural:glide',0,0);assert.equal(calls.length,1);assert.equal(calls[0].reset,true);calls.length=0;
 for(let frame=1;frame<=60;frame++)driver.pose('procedural:glide',frame/60,1/60);
 assert.equal(calls.length,60);assert.ok(calls.every(c=>!c.reset));
 assert.ok(c.cloth.garment.geometry.attributes.position.array.every(Number.isFinite));
});

test('B3 inner T-shirt is closed and opaque through torso motion',()=>{
 const c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.cloth.innerShirt,g=m.geometry,p=g.attributes.position,edges=new Map();
 for(let i=0;i<g.index.count;i+=3)for(let k=0;k<3;k++){const a=g.index.getX(i+k),b=g.index.getX(i+(k+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)??0)+1)}
 assert.ok([...edges.values()].every(n=>n===2),'no open waist or chest boundary');
 const original=c.standardMaterials.get(m);assert.equal(original.transparent,false);assert.equal(original.opacity,1);
 // Actual skinned ray coverage, from both the front and sides at five torso
 // levels, not just a closed rest mesh or nonzero skin weights.
 const posed=i=>m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i));
 for(const motion of ['idle','walk','jog','drive'])for(let phase=0;phase<24;phase++){
  driver.pose(motion,phase/24*lib.clips[motion].duration,0);m.computeBoundingSphere();m.computeBoundingBox();
  for(const row of [1,3,6,9,11]){
   const points=[0,12,24,36].map(col=>posed(row*48+col)),center=points.reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(.25);
   for(const point of points){const direction=point.clone().sub(center).normalize(),ray=new T.Raycaster(center.clone().addScaledVector(direction,.5),direction.negate());assert.ok(ray.intersectObject(m,false).length>=2,`${motion} ${phase}/24 row ${row} missing opaque front/back`)}
  }
 }
});

test('B3 bowed sad idles preserve chest depth while the neck still moves',()=>{
 const c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.mesh,p=m.geometry.attributes.position;
 const nearest=target=>{let best=0,d=Infinity;for(let i=0;i<p.count;i++){const q=new T.Vector3().fromBufferAttribute(p,i),n=q.distanceToSquared(target);if(n<d){best=i;d=n}}return best};
 // Actual front/back vertices: the old neck weights lost ~10% of upper-chest
 // depth even though the lower torso and bone lengths passed deformation tests.
 const pairs=[1.24,1.31,1.38,1.42,1.46].map(y=>[nearest(new T.Vector3(0,y,.14)),nearest(new T.Vector3(0,y,-.14))]);
 let minimum=Infinity,maximum=0,neckMotion=0;
 for(const e of catalogue.filter(e=>e.id.includes('sad_idle'))){
  let first;
  for(let phase=0;phase<=64;phase++){
   driver.pose(e.id,e.clip.duration*phase/64,0);
   const q=c.humanoid.b.neck_01.getWorldQuaternion(new T.Quaternion());first??=q.clone();neckMotion=Math.max(neckMotion,first.angleTo(q));
   for(const [a,b]of pairs){const x=new T.Vector3().fromBufferAttribute(p,a),y=new T.Vector3().fromBufferAttribute(p,b),ratio=m.applyBoneTransform(a,x.clone()).distanceTo(m.applyBoneTransform(b,y.clone()))/x.distanceTo(y);minimum=Math.min(minimum,ratio);maximum=Math.max(maximum,ratio);assert.ok(ratio>.98&&ratio<1.02,`${e.id} phase ${phase}/64 chest depth ${ratio}`)}
  }
 }
 assert.ok(neckMotion>.05,'sad head movement is retained');
 console.log('B3 sad idle chest depth ratios',minimum,maximum,'neck motion',neckMotion);
});

test('B3 seated hands and wrists clear the moving clothes across drive cycles',async()=>{
 const {MeshBVH}=await import('three-mesh-bvh'),c=create(),driver=new B3MotionPlayer(c,new Animator(lib,c.char),catalogue),m=c.mesh,p=m.geometry.attributes.position,idx=m.geometry.index;
 const split=predicate=>{const g=new T.BufferGeometry(),ids=[];g.setAttribute('position',p.clone());for(let i=0;i<idx.count;i+=3){const tri=[0,1,2].map(k=>idx.getX(i+k));if(tri.every(predicate))ids.push(...tri)}g.setIndex(ids);g.boundsTree=new MeshBVH(g);return g};
 // Include the distal forearm, not just fingers or bone/contact proxies.
 const hands=['l','r'].map(side=>split(i=>p.getX(i)*(side==='l'?1:-1)>.60));
 const lap=split(i=>p.getY(i)<1.25&&Math.abs(p.getX(i))<.25),cloth=c.cloth.garment.geometry;
 cloth.boundsTree=new MeshBVH(cloth);const v=new T.Vector3(),hits=[],dt=lib.clips.drive.duration/60;
 driver.pose('drive',0,0);
 for(let frame=0;frame<180;frame++){
  driver.pose('drive',frame*dt,dt,{blend:true});
  for(let i=0;i<p.count;i++){m.applyBoneTransform(i,v.fromBufferAttribute(p,i));for(const g of [...hands,lap])g.attributes.position.setXYZ(i,v.x,v.y,v.z)}
  lap.boundsTree.refit();cloth.boundsTree.refit();
  for(const [side,g]of hands.entries()){
   g.boundsTree.refit();g.computeBoundingBox();
   for(const [name,surface]of [['shirt',cloth],['lap',lap]])if(surface.boundsTree.intersectsGeometry(g,new T.Matrix4())){hits.push([frame,side,name]);}
  }
 }
 console.log('B3 drive clothes/hand intersections',JSON.stringify(hits));assert.equal(hits.length,0);
});


test('playable B3 retains equipment, world binding and authoritative interaction poses',async()=>{
 const {createTraveller}=await import('../src/characters/traveller.js'),{Gear}=await import('../src/gear.js');
 const char=buildCharacter();char.root.position.set(180,12,-84);char.root.rotation.set(.2,1.4,-.3);
 const pos=char.root.position.clone(),q=char.root.quaternion.clone();
 const c=createTraveller(char,{gltf,data,report,head,colors:JSON.parse(readFileSync('public/characters/traveller-b3/colors.json'))},{gpu:false,useWorker:false});
 const h=c.humanoid;assert.ok(char.root.position.equals(pos));assert.ok(char.root.quaternion.equals(q));assert.equal(h.body.visible,false);assert.equal(c.mesh.visible,true);assert.equal(c.beltHook,false);
 assert.ok(h.glove.meshes.length>0);assert.ok(h.glove.muzzle);assert.ok(h.tankAt.every(Number.isFinite));
 const scene=new T.Scene();scene.add(char.root);const gear=new Gear(scene,h,char);assert.equal(gear.springs.length,0);assert.ok(!gear.device);
 const a=new Animator(lib,char);atClip({char},a,'jog',.25);a.w={walk:0,jog:1,sprint:0};
 const rotations=c.poseArms({animator:a,onGround:true});h.update();c.poseHands(a,rotations);h.hands.update(1/60,{mode:'ground',speed:3.8});c.updateCloth(1/60);
 const local=c.cloth.garment.geometry.attributes.position.array.slice();char.root.position.add(new T.Vector3(-330,22,70));char.root.rotateY(1);char.root.updateMatrixWorld(true);c.updateCloth(0);
 const moved=c.cloth.garment.geometry.attributes.position.array;let max=0;for(let i=0;i<local.length;i++)max=Math.max(max,Math.abs(local[i]-moved[i]));assert.ok(max<1e-4,`cloth travels in body space ${max}`);
 for(const state of [{ride:{}},{aim:{}},{climbing:true},{mantle:{}},{overlay:()=>{}},{swim:true},{gliding:true},{thrusting:true},{boarding:{}}]){
  const arms=char.arms.map(a=>a.quaternion.clone()),neck=char.head.quaternion.clone();assert.deepEqual(c.poseArms({animator:a,onGround:true,...state}),[]);char.arms.forEach((a,i)=>assert.ok(a.quaternion.equals(arms[i])));assert.ok(char.head.quaternion.equals(neck));
 }
});

test('playable GPU cloth uses the accepted B3 cage without projecting each fold again',async()=>{
 const {createTraveller}=await import('../src/characters/traveller.js');
 const c=createTraveller(buildCharacter(),{gltf,data,report,head,colors:JSON.parse(readFileSync('public/characters/traveller-b3/colors.json'))},{gpu:true,useWorker:false});
 assert.ok(c.cloth.gpu);assert.ok(c.cloth.garment.isSkinnedMesh);assert.ok(c.shadowCasters.includes(c.cloth.shadow));assert.ok(c.humanoid.noShadow.includes(c.cloth.garment));
 const a=new Animator(lib,c.humanoid.char);atClip({char:c.humanoid.char},a,'jog',.25);a.w={jog:1};const r=c.poseArms({animator:a,onGround:true});c.humanoid.update();c.poseHands(a,r);c.updateCloth(1/30);
 assert.ok(c.cloth.gpuState.capA.every(c=>c.w===0),'detail projection disabled on GPU, as in accepted CPU review');assert.ok(c.cloth.caps.every(c=>c.radius>0),'the cage still collides');
 assert.ok(c.cloth.gpuState.P.image.data.every(Number.isFinite));assert.ok(c.cloth.garment.material.vertexShader.includes('aCage'),'real game material has cage deformation');
});


test('B3 procedural palms and cab lap fit follow gameplay controls',async()=>{
 const {createTraveller}=await import('../src/characters/traveller.js'),{Player}=await import('../src/player.js');
 const char=buildCharacter(),c=createTraveller(char,{gltf,data,report,head,colors:JSON.parse(readFileSync('public/characters/traveller-b3/colors.json'))},{gpu:false,useWorker:false}),h=c.humanoid;
 const p={char,ride:{kind:'taxi',bank:.15},time:0};
 for(let i=0;i<90;i++){
  p.time=i/30;Player.prototype.animateSeated.call(p,.5);h.update();c.poseRiding(p);h.hands.update(1/30,{mode:'ride',ride:'taxi'});c.updateCloth(1/30);
  for(const side of ['l','r']){
   const hand=h.b[`hand_${side}`],delta=hand.getWorldQuaternion(new T.Quaternion()).multiply(h.rest.get(hand).q.clone().invert());
   assert.ok(h.handFrames[side].normal.clone().applyQuaternion(delta).angleTo(new T.Vector3(0,-1,0))<.02,'cab palm rests down');
   const hip=h.b[`thigh_${side}`].getWorldPosition(new T.Vector3()),knee=h.b[`calf_${side}`].getWorldPosition(new T.Vector3()),target=hip.lerp(knee,c.seatedFit.along).add(new T.Vector3((side==='l'?1:-1)*c.seatedFit.outward,c.seatedFit.lift,0));
   assert.ok(hand.getWorldPosition(new T.Vector3()).distanceTo(target)<.004,'cab wrist reaches the fitted lap position');
  }
 }
 p.ride.kind='bike';h.update();const positions=['l','r'].map(s=>h.b[`hand_${s}`].getWorldPosition(new T.Vector3()));c.poseRiding(p);
 ['l','r'].forEach((s,i)=>assert.ok(h.b[`hand_${s}`].getWorldPosition(new T.Vector3()).distanceTo(positions[i])<1e-6,'lap correction does not move vehicle-control hands'));
});
