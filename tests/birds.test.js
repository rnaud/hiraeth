import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Flock} from '../src/life.js';
import {Bird} from '../src/bird.js';
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
