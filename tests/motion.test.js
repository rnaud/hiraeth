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
