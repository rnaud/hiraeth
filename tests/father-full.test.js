import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document??={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
const {buildCharacter}=await import('../src/player.js');
const {createFatherFull,COAT}=await import('../src/characters/father-full.js');
const {HoloFigure,FatherPace,WINDOW_WALK,holoLayout}=await import('../src/ship/hologram.js');
const {libraryFrom}=await import('../src/animator.js');

// The whole father (issue #26): public/characters/father-v1/full.glb, its texture left out (the browser decodes it).
const bytes=readFileSync('public/characters/father-v1/full.glb'),size=bytes.readUInt32LE(12);
const json=JSON.parse(bytes.subarray(20,20+size)),bin=bytes.subarray(28+size);
json.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
delete json.images;delete json.textures;delete json.materials;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
asset.scene.traverse(o=>{if(o.isMesh)o.material=new T.MeshStandardMaterial({map:new T.Texture()});});
const anim=readFileSync('public/anim/ual.glb');
const lib=libraryFrom(await new GLTFLoader().parseAsync(anim.buffer.slice(anim.byteOffset,anim.byteOffset+anim.byteLength),''));

const dominant=(mesh,i)=>{const J=mesh.geometry.attributes.skinIndex,W=mesh.geometry.attributes.skinWeight;let b=0,w=-1;for(let k=0;k<4;k++)if(W.getComponent(i,k)>w){w=W.getComponent(i,k);b=J.getComponent(i,k);}return mesh.skeleton.bones[b].name;};

test('the whole father is rigged to walk: legs on their bones, the coat on its chains, the bind pose unchanged',()=>{
  const char=buildCharacter();char.root.position.set(12,-3,40);char.root.rotation.y=0.8;
  const h=createFatherFull(char,asset),mesh=h.body,g=mesh.geometry,p=g.attributes.position;
  assert.ok(char.root.position.equals(new T.Vector3(12,-3,40)),'his spawn kept');
  g.computeBoundingBox();assert.ok(g.boundingBox.min.y<0.02,'uncut: down to his boots');
  const coat=mesh.skeleton.bones.filter(b=>/^coat_\d+_[01]$/.test(b.name));
  assert.equal(coat.length,COAT.columns*2);assert.equal(mesh.skeleton.bones.length,53+COAT.columns*2);
  for(const b of coat.filter(b=>b.name.endsWith('_0')))assert.equal(b.parent.name,'pelvis');
  mesh.skeleton.pose();char.root.updateMatrixWorld(true);mesh.skeleton.update();
  const W=g.attributes.skinWeight,counts={};
  for(let i=0;i<p.count;i++){
    let sum=0;for(let k=0;k<4;k++)sum+=W.getComponent(i,k);
    assert.ok(Math.abs(sum-1)<1e-5,'normalized');
    if(i%97===0){const v=new T.Vector3().fromBufferAttribute(p,i);assert.ok(mesh.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-4,'identity at rest');}
    const y=p.getY(i),name=dominant(mesh,i).replace(/_[lr]$|_\d+_[01]$/,'');
    const band=y<0.15?'boot':y<0.36?'shin':y>0.55&&y<0.85?'skirt':null;
    if(band)(counts[band]??={})[name]=(counts[band][name]??0)+1;
  }
  const share=(band,names)=>{const c=counts[band],all=Object.values(c).reduce((a,b)=>a+b,0);return names.reduce((s,n)=>s+(c[n]??0),0)/all;};
  assert.ok(share('boot',['foot','ball'])>0.95,`boots on the feet: ${JSON.stringify(counts.boot)}`);
  assert.ok(share('shin',['calf','foot'])>0.95,`shins on the calves: ${JSON.stringify(counts.shin)}`);
  assert.ok(share('skirt',['coat'])>0.9,`the skirt on its chains: ${JSON.stringify(counts.skirt)}`);
});

test('on the window recording he walks to the window and back, his feet striding, his coat swinging',()=>{
  const f=new HoloFigure('fatherFull',{lib,humans:[],fullAsset:asset});
  f.object.scale.setScalar(WINDOW_WALK.scale);
  const h=f.humanoid,mesh=h.body,B=h.b;
  assert.equal(f.u.uCut.value.x,-1,'drawn whole, not cut to a bust');
  const g=mesh.geometry,p=g.attributes.position,ix=g.index,edges=[],seen=new Set();
  for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){const a=ix.getX(i+k),b=ix.getX(i+(k+1)%3),key=a<b?a+','+b:b+','+a;if(seen.has(key))continue;seen.add(key);const l=new T.Vector3().fromBufferAttribute(p,a).distanceTo(new T.Vector3().fromBufferAttribute(p,b));if(l>.002)edges.push([a,b,l]);}
  const posed=Array.from({length:p.count},()=>new T.Vector3());
  const boot=[];for(let i=0;i<p.count;i+=7)if(p.getY(i)<0.12)boot.push(i);
  let stride=0,swingWalking=0,walked=0,reached=false,looked=false,bad=0,total=0;
  const local=new T.Vector3(),inv=new T.Matrix4();
  for(let frame=0;frame<600;frame++){
    f.update(1/60,{talking:frame>300&&frame<400});
    f.object.updateMatrixWorld(true);mesh.skeleton.update();
    if(f.walk.speed>0){
      walked++;
      inv.copy(f.object.matrixWorld).invert();
      const l=B.foot_l.getWorldPosition(new T.Vector3()).applyMatrix4(inv),r=B.foot_r.getWorldPosition(local).applyMatrix4(inv);
      stride=Math.max(stride,Math.abs(l.z-r.z));
      swingWalking=Math.max(swingWalking,h.coat.swing());
    }
    if(f.walk.at==='to'){reached=true;if(f.walk.look?.pitch<0)looked=true;}
    if(frame%40===0){
      for(let i=0;i<p.count;i++)mesh.applyBoneTransform(i,posed[i].fromBufferAttribute(p,i));
      for(const [a,b,l] of edges){if(posed[a].distanceTo(posed[b])/l>3)bad++;total++;}
      // the boots go with the feet: rigid on them
      for(const i of boot){const n=dominant(mesh,i);assert.ok(/^(foot|ball)_[lr]$/.test(n),`boot vertex ${i} on ${n}`);}
    }
  }
  assert.ok(walked>60,`he walks (${walked} frames)`);
  assert.ok(reached&&looked,'he stands at the window, looking up');
  assert.ok(Math.abs(f.object.position.x-WINDOW_WALK.from[0])>0.05||walked>200,'he went across the lens');
  assert.ok(stride>0.25,`his feet stride apart: ${stride.toFixed(3)} m`);
  assert.ok(swingWalking>0.02,`the coat swings off where the pelvis carries it: ${swingWalking.toFixed(3)} m`);
  assert.ok(bad/total<0.01,`no tearing: ${(bad/total*100).toFixed(2)}% of edges past 3x`);
});

test('the coat settles when he stands, and swings again as he walks',()=>{
  const f=new HoloFigure('fatherFull',{lib,humans:[],fullAsset:asset});
  const coat=f.humanoid.coat;
  let still=0,moving=0;
  f.pace=null;   // (driven by hand: stand, then walk on the spot)
  for(let i=0;i<180;i++){f.update(1/60);}
  still=coat.swing();
  for(let i=0;i<120;i++){
    const a=f.animator,N=lib.native;
    a.update(1/60,{speed:0.8,onGround:true,mode:'ground',walkAt:N.walk*1.3,jogAt:N.jog,sprintAt:N.sprint*1.2,strideScale:1.05});
    a.apply(f.char.root,{legScale:1.04});f.humanoid.update();coat.update(1/60,{velocity:new T.Vector3(0,0,0.8)});
    moving=Math.max(moving,coat.swing());
  }
  assert.ok(still<0.03,`standing it hangs: ${still.toFixed(3)}`);
  assert.ok(moving>still+0.02,`walking it swings: ${moving.toFixed(3)}`);
  const bones=f.humanoid.coat.rig.chainBones.flat();
  assert.ok(bones.some(b=>2*Math.acos(Math.min(1,Math.abs(b.quaternion.w)))>0.05),'the chains turn');
});

test('the window recording: his walk, and his place on the lens',()=>{
  const [L]=holoLayout('window');
  assert.equal(L.id,'fatherFull');assert.ok(L.full);
  const pace=new FatherPace(),seen=new Set();let x0=pace.x;
  for(let i=0;i<60*20;i++){const s=pace.update(1/60,0.3);seen.add(s.at??'walk');x0=Math.max(x0,s.x);
    assert.ok(Math.hypot(s.x,s.z)<0.18,'on the lens');}
  assert.ok(seen.has('to')&&seen.has('from')&&seen.has('walk'),'there and back, again and again');
  assert.ok(Math.abs(x0-WINDOW_WALK.to[0])<1e-3,'at the window');
});
