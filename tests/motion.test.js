import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Humanoid} from '../src/humanoid.js';
import {buildCharacter,Player} from '../src/player.js';
import {Physics} from '../src/physics.js';

const bytes=await readFile(new URL('../public/anim/human_m.glb',import.meta.url));
const template=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
test('climbing fingers point up and boots point into the wall, including rotated gravity',()=>{
 for(const up of [new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0)]){
  const H=new Humanoid(template,buildCharacter());H.update();
  const normal=new THREE.Vector3(0,0,-1), B=H.b;
  H.reach({hands:['r','l'].map(s=>B['hand_'+s].getWorldPosition(new THREE.Vector3())),feet:['r','l'].map(s=>B['foot_'+s].getWorldPosition(new THREE.Vector3())),wallN:normal,up,wallContact:true});
  for(const s of ['r','l']){
   const direction=(from,to)=>B[to].getWorldPosition(new THREE.Vector3()).sub(B[from].getWorldPosition(new THREE.Vector3())).normalize();
   const finger = direction('hand_'+s,'middle_01_'+s);
   assert.ok(finger.dot(up)>.99,'fingers point up');
   const span=B['index_01_'+s].getWorldPosition(new THREE.Vector3()).sub(B['pinky_01_'+s].getWorldPosition(new THREE.Vector3()));
   const palm=new THREE.Vector3().crossVectors(finger,span).normalize().multiplyScalar(s==='r'?-1:1);
   assert.ok(palm.dot(normal)<-.99,'palms face into the wall');
   const toe=direction('foot_'+s,'ball_'+s);assert.ok(toe.dot(normal)<-.9,'toes point at the wall');assert.ok(toe.dot(up)>.2,'toes tip upward');
  }
 }
});
test('climbing speed matches the support stroke and sprint scales clip cadence',()=>{
 const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(20,40,1));wall.position.set(0,20,8);scene.add(wall);
 const physics=new Physics(scene),p=new Player(physics);p.pos.set(0,2,7.1);p.animator={};p.startClimb(new THREE.Vector3(0,0,-1));
 const start=p.pos.y;for(let i=0;i<60;i++)p.updateClimb(1/60,1,0,{});
 assert.ok(Math.abs(p.pos.y-start-1.4)<.01);assert.equal(p._climbRate,1);
 p.updateClimb(1/60,1,0,{ShiftLeft:true});assert.ok(Math.abs(p._climbRate-1.5)<1e-9);
});

test('mantle hands release into the standing pose before completion', () => {
 const p = new Player(new Physics(new THREE.Scene()));
 p.humanoid = new Humanoid(template, p.char);p.humanoid.update();
 p.mantle = {from:new THREE.Vector3(),to:new THREE.Vector3(0,1,1),edge:new THREE.Vector3(0,1,.3),rise:1,t:.95,n:new THREE.Vector3(0,0,-1)};
 const targets=p.mantleTargets();
 for(const [i,s] of ['r','l'].entries()) assert.ok(targets.hands[i].distanceTo(p.humanoid.b['hand_'+s].getWorldPosition(new THREE.Vector3()))<1e-8);
 for(let i=0;i<120 && p.mantle;i++) p.updateMantle(1/60);
 assert.equal(p.mantle,null);assert.ok(p.pos.distanceTo(new THREE.Vector3(0,1,1))<1e-8);
});

test('a stretched foot does not repeatedly acquire the same support stroke', () => {
 const char=buildCharacter(), H=new Humanoid(template,char);H.update();
 const up=new THREE.Vector3(0,1,0), root=new THREE.Vector3(), fwd=new THREE.Vector3(0,0,1);
 const physics={heightAbove:p=>p.y,groundNormal:(x,y,z,out)=>out.set(0,1,0)};
 let steps=0;H.plantFeet(1/60,physics,up,root,fwd,()=>steps++);
 const initial=steps;assert.ok(initial>0);
 for(const s of ['l','r']) H._feet[s].pos.x+=1;
 H.update();H.plantFeet(1/60,physics,up,root,fwd,()=>steps++);
 for(let i=0;i<5;i++){H.update();H.plantFeet(1/60,physics,up,root,fwd,()=>steps++);}
 assert.equal(steps,initial);
});

test('climbing knees hinge forward toward the wall and up, never backward, including rotated gravity',()=>{
 for(const angle of [0,Math.PI/2,Math.PI]){
  const char=buildCharacter(),H=new Humanoid(template,char);
  char.root.rotation.z=angle;char.root.updateMatrixWorld(true);
  const up=new THREE.Vector3(0,1,0).applyAxisAngle(new THREE.Vector3(0,0,1),angle);
  const wallN=new THREE.Vector3(0,0,-1),into=wallN.clone().negate(),B=H.b,P=n=>B[n].getWorldPosition(new THREE.Vector3());
  // feet low under the hips, at mid height and stepping high (a climber's range of holds)
  for(const [drop,ahead] of [[.75,.12],[.55,.15],[.3,.2]]){
   H.update();
   const feet=['r','l'].map(s=>P('thigh_'+s).addScaledVector(up,-drop).addScaledVector(into,ahead));
   H.reach({feet,wallN,up,wallContact:true});
   for(const s of ['r','l']){
    const hip=P('thigh_'+s),knee=P('calf_'+s),foot=P('foot_'+s);
    const line=foot.clone().sub(hip).normalize();
    const off=knee.clone().sub(hip);off.addScaledVector(line,-off.dot(line));
    assert.ok(off.length()>.03,'the knee is bent');
    assert.ok(off.dot(into)>.02,`${s} knee comes toward the wall (drop ${drop}, angle ${angle.toFixed(2)}): ${off.dot(into).toFixed(3)}`);
    assert.ok(off.dot(up)>-.02,`${s} knee does not drop below the hip-foot line`);
   }
  }
 }
});
