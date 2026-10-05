import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Flock} from '../src/life.js';
import {Bird,TAKEOFF} from '../src/bird.js';
const physics={groundAt:()=>0,pushCapsule:()=>false};
test('small birds have separate bodies and feathered wings, with bounded distance scaling',()=>{
 const scene=new THREE.Scene(),flock=new Flock(scene,{count:5,size:1});
 flock.update(.016,1,new THREE.Vector3(),new THREE.Vector3(0,0,10000));
 assert.equal(flock.bodies.count,5);assert.equal(scene.children.length,3);
 const m=new THREE.Matrix4(),s=new THREE.Vector3();flock.bodies.getMatrixAt(0,m);s.setFromMatrixScale(m);assert.ok(s.x<=1.70001);
 for(const wing of flock.wings) assert.ok(wing.geometry.attributes.position.count>100);
});
test('mount unfolds smoothly for flight and folds to a narrower landed silhouette',()=>{
 const bird=new Bird(physics);
 bird.pose(1);bird.object.updateMatrixWorld(true);
 const wingsBox=()=>{const b=new THREE.Box3();for(const w of bird.wings)b.expandByObject(w.shoulder);return b.getSize(new THREE.Vector3()).x;};
 const folded=wingsBox();bird.landed=false;
 for(let i=0;i<180;i++)bird.pose(1/60);
 bird.object.updateMatrixWorld(true);assert.ok(wingsBox()>folded*1.4,`${folded} -> ${wingsBox()}`);
 assert.ok(bird.legs.every(l=>l.rotation.x<-1));
 bird.flapPower=1;bird.pose(.1);const a=bird.wings[0].shoulder.rotation.z;bird.pose(.2);assert.notEqual(bird.wings[0].shoulder.rotation.z,a);
 bird.landed=true;for(let i=0;i<180;i++)bird.pose(1/60);assert.ok(bird.wingFold>.99);
});
test('mount can still board, take off, fly and provide a finite rider seat',()=>{
 const bird=new Bird(physics);bird.board();for(let i=0;i<120;i++)bird.update(1/60,{Space:true});
 assert.equal(bird.landed,false);assert.ok(bird.pos.y>3);
 bird.object.updateMatrixWorld(true);const p=new THREE.Vector3(),q=new THREE.Quaternion();bird.seatTransform(p,q);assert.ok(p.toArray().every(Number.isFinite));assert.ok(q.toArray().every(Number.isFinite));
});
test('on the ground with a rider she walks: legs stepping in turn, the body bobbing, wings folded',()=>{
 const bird=new Bird(physics);bird.board();
 const y0=bird.pos.y,z0=bird.pos.clone();
 const legs=[],bob=[];
 for(let i=0;i<60;i++){bird.update(1/60,{KeyW:true});legs.push(bird.legs.map(l=>l.rotation.x));bob.push(bird.body.position.y);}
 assert.equal(bird.landed,true,'still on the ground');
 assert.ok(bird.pos.distanceTo(z0)>4,`she walked: ${bird.pos.distanceTo(z0).toFixed(1)} m`);
 assert.ok(Math.abs(bird.pos.y-y0)<0.01,'her feet on the ground');
 assert.ok(bird.walkK>0.9,'the gait is on');
 assert.ok(legs.some(([a,b])=>a>0.2&&b<-0.2)&&legs.some(([a,b])=>a<-0.2&&b>0.2),'one leg forward while the other is back, then the other way round');
 assert.ok(Math.max(...bob)-Math.min(...bob)>0.04,'the body bobs');
 assert.ok(bird.wingFold>0.95&&bird.flapPower<0.2,'wings folded, not beating');
 // standing still: the gait settles
 for(let i=0;i<60;i++)bird.update(1/60,{});
 assert.ok(bird.walkK<0.05);
 assert.ok(bird.legs.every(l=>Math.abs(l.rotation.x)<0.05));
});
test('taking off she crouches, leaps, and beats her wings only at the top of the leap',()=>{
 const bird=new Bird(physics);bird.board();
 const y0=bird.pos.y;
 let crouched=false,rose=0,beatBefore=false,i=0,topY=0;
 for(;i<120;i++){
  bird.update(1/60,{Space:true});
  if(bird.takeoff&&!bird.takeoff.leapt){crouched||=bird.body.position.y<-0.25;assert.ok(Math.abs(bird.pos.y-y0)<0.01,'the crouch stays on the ground');}
  if(bird.takeoff){assert.equal(bird.landed,true,'not flying yet');beatBefore||=bird.flapPower>0.05;rose=Math.max(rose,bird.pos.y-y0);}
  if(!bird.takeoff&&!bird.landed){topY=bird.pos.y-y0;break;}
 }
 assert.ok(crouched,'down into a crouch first');
 assert.ok(i>TAKEOFF.crouch*60,'the crouch takes a moment');
 assert.ok(!beatBefore,'no wingbeat during the leap');
 assert.ok(rose>1.8&&topY>1.8,`a leap: up ${topY.toFixed(2)} m when the wings open`);
 assert.equal(bird.flapPower,1,'the first beat, at the top');
 const z=bird.wings[0].shoulder.rotation.z;bird.update(1/60,{Space:true});bird.update(1/60,{Space:true});
 assert.notEqual(bird.wings[0].shoulder.rotation.z,z,'and the wings beat');
 // off her back mid-crouch: no leap without a rider
 const b2=new Bird(physics);b2.board();b2.update(1/60,{Space:true});assert.ok(b2.takeoff);b2.leave();b2.update(1/60,null);assert.equal(b2.takeoff,null);assert.equal(b2.landed,true);
});
