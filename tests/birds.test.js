import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Flock} from '../src/life.js';
import {Bird,TAKEOFF,LANDING,FOOT} from '../src/bird.js';
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

// Landing: coming down, her legs lower and reach forward and her wings flare and brake; she
// touches down with her feet on the ground (each foot on its own ray), sinks into her knees, and
// walks out what's left of her speed.
const feetY=(bird)=>{bird.object.updateMatrixWorld(true);return bird.legs.map(l=>l.localToWorld(FOOT.clone()));};
function comeIn(ground,{h=6,speed=12}={}){
 const bird=new Bird({groundAt:(x,y,z)=>ground(x,z),pushCapsule:()=>false});
 bird.pos.set(0,ground(0,0)+1.4+h,0);bird.heading=0;bird.landed=false;bird.speed=speed;bird.board();
 const log=[];
 let down=-1;
 for(let i=0;i<600&&(down<0||i<down+150);i++){
  const air=!bird.landed;bird.update(1/60,{});
  if(bird.landed&&down<0)down=i;
  log.push({air,landed:bird.landed,landK:bird.landK,vy:bird.vy,legs:bird.legs.map(l=>l.rotation.x),pitch:bird.body.rotation.x,dip:bird.body.position.y,h:bird.heightOver(),speed:bird.speed,walk:bird.walkK});
 }
 return {bird,log,touch:down};
}
test('coming in to land she lowers her legs forward, flares and brakes, and touches down gently',()=>{
 const {log,touch}=comeIn(()=>0);
 assert.ok(touch>0,'she lands');
 const before=log.slice(Math.max(0,touch-12),touch);
 assert.ok(before.every(e=>e.landK>0.8),'the legs are out over the last moments');
 const flying=-1.25;
 assert.ok(before.every(e=>e.legs.every(x=>x>flying+0.5)),`legs down from their tuck: ${before[0].legs.map(x=>x.toFixed(2))}`);
 assert.ok(log.slice(0,touch).some(e=>e.legs.every(x=>x<-0.3)&&e.landK>0.5),'and reaching forward on the way down');
 assert.ok(log.slice(0,touch).some(e=>e.pitch<-0.3),'the body flares nose up');
 assert.ok(log[0].landK<0.05,'not while still high up');
 const sink=-log[touch-1].vy;
 assert.ok(sink<LANDING.touch+0.6,`a gentle touchdown: ${sink.toFixed(2)} m/s down`);
 assert.ok(log[touch-1].speed<log[0].speed-2,'the flare braked her');
});
test('touching down her feet are on the ground, she sinks into her knees, settles and walks out her speed',()=>{
 const {bird,log,touch}=comeIn(()=>0);
 const after=log.slice(touch);
 assert.ok(Math.min(...after.slice(0,40).map(e=>e.dip))<-LANDING.dip*0.3,'a sink into the knees');
 assert.ok(after.slice(0,40).some(e=>e.walk>0.3),'a few steps to walk off the speed');
 assert.ok(Math.abs(after.at(-1).dip)<0.01&&after.at(-1).walk<0.05,'and settled, standing');
 for(const f of feetY(bird))assert.ok(Math.abs(f.y-0)<0.08,`a foot on the ground: ${f.y.toFixed(3)}`);
 assert.ok(bird.legs.every(l=>Math.abs(l.rotation.x)<0.05),'standing straight');
});
test('on a slope each foot finds the ground under it (no sinking, no floating)',()=>{
 const slope=(x)=>0.45*x;   // across her: one foot lower than the other
 const {bird,touch}=comeIn((x)=>slope(x));
 assert.ok(touch>0);
 const [a,b]=feetY(bird);
 assert.ok(Math.abs(a.y-slope(a.x))<0.07&&Math.abs(b.y-slope(b.x))<0.07,`feet ${a.y.toFixed(2)}/${slope(a.x).toFixed(2)} and ${b.y.toFixed(2)}/${slope(b.x).toFixed(2)}`);
 assert.ok(Math.abs(a.y-b.y)>0.2,'one foot higher than the other');
 // and walking on, still on it
 for(let i=0;i<40;i++)bird.update(1/60,{KeyW:true});
 for(let i=0;i<40;i++)bird.update(1/60,{});
 for(const f of feetY(bird))assert.ok(Math.abs(f.y-slope(f.x))<0.08,`after a walk: ${f.y.toFixed(2)} vs ${slope(f.x).toFixed(2)}`);
});
test('flying level low over the ground, or skimming fast, she keeps her legs tucked',()=>{
 const bird=new Bird(physics);bird.pos.set(0,1.4+3,0);bird.landed=false;bird.speed=20;bird.board();
 for(let i=0;i<60;i++)bird.update(1/60,{});
 assert.ok(bird.landK<0.1,`legs tucked flying level: ${bird.landK.toFixed(2)}`);
 assert.ok(bird.legs.every(l=>l.rotation.x<-1),'tucked');
});
test('called down beside you, or circling down without a rider, she lands on her feet the same way',()=>{
 const bird=new Bird(physics);bird.pos.set(-60,40,-60);bird.landed=false;
 bird.summon(0,0,0,null);
 let legsOut=0,i=0;
 for(;i<900&&!bird.landed;i++){bird.update(1/60,null);if(bird.heightOver()<1.5)legsOut=Math.max(legsOut,bird.landK);}
 assert.ok(bird.landed,'down');assert.ok(legsOut>0.7,`legs out coming down: ${legsOut.toFixed(2)}`);
 for(let k=0;k<60;k++)bird.update(1/60,null);
 for(const f of feetY(bird))assert.ok(Math.abs(f.y)<0.08,`feet on the ground: ${f.y.toFixed(3)}`);
 const b2=new Bird(physics);b2.pos.set(0,12,0);b2.landed=false;b2.mode='glide-down';
 let out2=0;for(let k=0;k<600&&!b2.landed;k++){b2.update(1/60,null);if(b2.heightOver()<1)out2=Math.max(out2,b2.landK);}
 assert.ok(b2.landed&&out2>0.7,`circling down: legs out ${out2.toFixed(2)}`);
});
