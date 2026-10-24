import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {keeperGuardian,elderGuardian} from '../src/temples/guardian-generated.js';
import cistern from '../src/minigames/cistern.js';
import elderflight from '../src/minigames/elderflight.js';

globalThis.ProgressEvent ??= class {constructor(type,v){Object.assign(this,{type},v);}};
const assets={};
for(const id of ['keeper-v1','elder-v3']){
 const bytes=fs.readFileSync(new URL(`../public/guardians/${id}/model.glb`,import.meta.url));
 const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+len));
 for(const m of json.meshes)for(const p of m.primitives)delete p.material;
 delete json.materials;delete json.textures;delete json.images;
 json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+len).toString('base64');
 assets[id]=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
}
GLTFLoader.prototype.load=function(url,onLoad,_progress,onError){const id=Object.keys(assets).find(id=>String(url).includes('/'+id+'/'));queueMicrotask(()=>id?onLoad(assets[id]):onError?.(Error('unexpected asset '+url)));};
const V=(...x)=>new T.Vector3(...x),DT=1/60;
const flight={beat:1.1,amplitude:.3,callSide:0,callStrength:0};
const opts={state:'fight',phase:1,attack:null,k:0,meter:1,flight};
const finite=p=>p.toArray().every(Number.isFinite);
function session(def){
 const scene=new T.Scene();let gen=def.build(scene),step;do{step=gen.next();}while(!step.done);
 const level=step.value,player={pos:V(),vel:V(),object:new T.Group(),finishFrame(){}};scene.add(player.object);
 const results=[],ctx={scene,level,player,camera:new T.PerspectiveCamera(44,16/9,.1,3000),sound:null,sfx:new Proxy({},{get:()=>()=>{}}),helper:{temple:def===cistern?'desert':'arzach',seed:23},option:()=> 'easy',add:o=>{scene.add(o);return o;},status(){},speed(){},setFov(){},flash(){},kick(){},setScore(){},finish:r=>results.push(r)};
 const run=def.start(ctx);return {scene,player,run,results,tick:()=>run.update(DT,{x:0,y:0,jump:false,tuck:0},{live:false,phase:'paused',raw:{}})};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('actual Cistern and flight sessions replace the old body with approved skins and dispose them on exit/retry',async()=>{
 for(const [def,bones] of [[cistern,26],[elderflight,23]]){
  const s=session(def);await flush();await flush();s.tick();s.scene.updateMatrixWorld(true);
  const skins=[];s.scene.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton.bones.length===bones)skins.push(o);});assert.ok(skins.length>0);
  const groups=skins.map(m=>{let p=m;while(p.parent&&!/generated (guardian|mesh)/.test(p.name))p=p.parent;return p;});
  assert.ok(groups.every(g=>/generated (guardian|mesh)/.test(g.name)));assert.ok(skins.every(m=>m.material.isShaderMaterial));
  let disposed=0;skins.forEach(m=>m.material.addEventListener('dispose',()=>disposed++));s.run.end();assert.equal(disposed,skins.length);assert.ok(groups.every(g=>g.parent===null));
  const retry=session(def);retry.run.end();await flush();await flush();const late=[];retry.scene.traverse(o=>{if(o.isSkinnedMesh)late.push(o);});assert.equal(late.length,0,'late load after exit cannot resurrect a skin');
  assert.deepEqual(s.results,[],'model loading cannot award minigame results');
 }
});
test('delayed/failing Elder loading keeps flight cues safe and cancels a pending swap on disposal',async()=>{
 let resolve;const m=elderGuardian({load:()=>new Promise(r=>resolve=r)}),parent=new T.Group();parent.add(m.group);m.pos.set(0,-4.4,0);m.group.position.copy(m.pos);
 m.animate(DT,0,{...opts,kit:{ground:()=>-4.4,frame:parent}});assert.equal(m.generated,false);assert.ok(finite(m.mouth));
 await Promise.resolve();m.dispose();resolve(assets['elder-v3']);assert.equal(await m.ready,false);assert.equal(parent.children.length,0);
 const failed=elderGuardian({load:async()=>{throw Error('offline');}});parent.add(failed.group);assert.equal(await failed.ready,false);failed.animate(DT,1,opts);assert.ok(finite(failed.mouth));failed.dispose();
});
test('generated Elder receives wingbeats and directional calls across a live swap, with real tucked feet',async()=>{
 let resolve;const m=elderGuardian({load:()=>new Promise(r=>resolve=r)}),parent=new T.Group();parent.position.set(75,160,210);parent.rotation.set(.14,.6,-.2);parent.add(m.group);m.pos.set(0,-4.4,0);m.group.position.copy(m.pos);
 const kit={ground:()=>-4.4,frame:parent};m.animate(DT,0,{...opts,kit});const old=m.group;
 await Promise.resolve();resolve(assets['elder-v3']);assert.equal(await m.ready,true);assert.equal(old.parent,null);assert.equal(m.group.parent,parent);assert.equal(m.inner.pos,m.pos);
 for(let i=0;i<180;i++)m.animate(DT,i*DT,{...opts,kit});assert.ok(m.inner.pose.air>.98);
 const before=m.inner.wings.map(c=>c[0].rotation.z);m.animate(DT,3,{...opts,flight:{...flight,callSide:1,callStrength:1},kit});
 assert.ok(Math.abs(m.inner.wings[0][0].rotation.z-before[0]-.35)<1e-10);assert.equal(m.inner.wings[1][0].rotation.z,before[1]);
 const tips=[-1,1].map(s=>m.part('feet',V(),s));assert.ok(tips.every(finite));assert.ok(m.mouth.distanceTo(m.inner.mouth)<1e-9);
 const localFeet=[0,1].map(i=>m.inner.bones[`leg${i}_foot`].position.y);assert.ok(localFeet.every(y=>y>1),'generated feet tuck under body rather than remain planted');m.dispose();
});
test('generated Elder lands in a translated/rotated flight frame without planting feet in world coordinates twice',async()=>{
 const m=elderGuardian({load:async()=>assets['elder-v3']}),frame=new T.Group();frame.position.set(420,180,690);frame.rotation.y=.7;frame.add(m.group);m.pos.set(0,-4.4,0);m.group.position.copy(m.pos);await m.ready;
 const kit={ground:()=>-4.4,frame};for(let i=0;i<180;i++)m.animate(DT,i*DT,{...opts,kit});
 for(let i=0;i<240;i++)m.animate(DT,3+i*DT,{state:'resolved',phase:0,attack:null,meter:1,kit});
 assert.ok(m.inner.pose.air<.01);frame.updateMatrixWorld(true);
 for(let i=0;i<2;i++){const foot=frame.worldToLocal(m.inner.bones[`leg${i}_foot`].getWorldPosition(V()));assert.ok(Math.abs(foot.y+4.4)<.08,`foot ${i}: ${foot.toArray()}`);assert.ok(Math.hypot(foot.x,foot.z)<3);}
 assert.ok(finite(m.mouth));m.dispose();
});
test('generated Keeper walking and drinking retain finite anchors and foot contacts under the scaled Cistern frame',async()=>{
 const m=keeperGuardian({load:async()=>assets['keeper-v1']}),root=new T.Group();root.scale.setScalar(.67);root.add(m.group);await m.ready;
 const kit={ground:()=>0};for(let i=0;i<120;i++){m.pos.set(5,0,i/90);m.heading=.4;m.group.position.copy(m.pos);m.group.rotation.y=m.heading;m.animate(DT,i*DT,{state:'fight',attack:null,meter:0,kit});}
 const closed=m.inner.open;for(let i=0;i<120;i++)m.animate(DT,2+i*DT,{state:'open',attack:null,meter:1,kit});
 assert.ok(m.inner.open>closed+.7);assert.ok(finite(m.mouth));assert.ok(m.mouth.distanceTo(m.inner.mouth)<1e-9);
 for(let i=0;i<6;i++){const p=m.inner.bones[`leg${i}_foot`].getWorldPosition(V());assert.ok(finite(p));assert.ok(Math.abs(p.y)<.12,`foot ${i}: ${p.y}`);}m.dispose();
});
