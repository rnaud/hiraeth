import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {ReactionField,ReactiveWorld,WORLD_REACTIONS,bloomRoom,BLOOM} from '../src/reactive-world.js';
const p=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),forward=p(0,0,-1);
const nodes=[{pos:p(0,0,-5),radius:3,cluster:'a'},{pos:p(15,0,-5),radius:3,cluster:'a'},{pos:p(30,0,-5),radius:3,cluster:'b'}];
test('attention wakes an object and sends a delayed wave only to connected neighbors',()=>{
 let encounters=0;const f=new ReactionField(nodes,{onEncounter:()=>encounters++});
 f.update(.1,p(),p(),forward);assert.equal(encounters,1);assert.ok(f.nodes[0].energy>0);assert.equal(f.nodes[1].energy,0);
 for(let i=0;i<30;i++)f.update(.1,p(100),p(100),forward);
 assert.ok(f.nodes[1].energy>.1);assert.equal(f.nodes[2].energy,0);assert.equal(encounters,1);
});
test('occlusion prevents sensing through walls and departing lets the response settle',()=>{
 const f=new ReactionField(nodes);f.update(.1,p(),p(),forward,()=>false);assert.equal(f.nodes[0].energy,0);
 f.update(1,p(),p(),forward);assert.ok(f.nodes[0].energy>.5);
 for(let i=0;i<180;i++)f.update(.1,p(100),p(100),forward);
 assert.ok(f.nodes.every(n=>n.energy<.001));
});
test('standing near a node does not spam reactions; return visits are remembered',()=>{
 const known=[];const f=new ReactionField(nodes,{onEncounter:(n,k)=>known.push(k)});
 for(let i=0;i<100;i++)f.update(.1,p(0,0,-5),p(0,0,-5),forward);
 assert.deepEqual(known,[false]);f.update(1,p(100),p(100),forward);f.update(.1,p(0,0,-5),p(0,0,-5),forward);
 assert.deepEqual(known,[false,true]);
});
test('all eight worlds build reactive scenery without adding collision or sharing color state',()=>{
 const store={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
 const physics={rayHit:origin=>({point:p(origin.x,0,origin.z)}),rayDistance:()=>Infinity};
 for(const id of Object.keys(WORLD_REACTIONS)){
  const scene=new THREE.Scene(),world=new ReactiveWorld(scene,{id,spawn:p(),ground:{heightAt:()=>0}},physics,{npcs:[],story:{goal:[0,0,-100]},relics:{spots:[]}},{storage:store});
  assert.ok(world.nodes.length>=18,id);assert.equal(world.root.userData.noCollide,true);
  assert.notEqual(world.nodes[0].obj.m.uniforms.uColor.value,world.nodes[1].obj.m.uniforms.uColor.value);
  const camera=new THREE.PerspectiveCamera();camera.position.copy(p());camera.lookAt(p(0,0,-10));camera.updateMatrixWorld();
  world.update(.25,0,{pos:world.nodes[0].pos.clone(),frame:{up:p(0,1,0)}},camera);world.flush();
  assert.ok(JSON.parse(store.value).worlds.includes(id));
  assert.ok(world.particles.length<=72);
  const before=world.field.time;world.update(2,0,{pos:p(),frame:{up:p(0,1,0)}},camera,true);assert.equal(world.field.time,before);
 }
});
test('the makers’ listening stones show glyphs, not words: a first meeting, a return, a rumour from elsewhere',()=>{
 const src=readFileSync(new URL('../src/reactive-world.js',import.meta.url),'utf8');
 for(const w of ['WE SEE YOU',"'AGAIN'","'HEARD'"])assert.ok(!src.includes(w),`no ${w} lettered on them`);
 const physics={rayHit:origin=>({point:p(origin.x,0,origin.z)}),rayDistance:()=>Infinity};
 for(const id of ['incal','bazaar','garage']){
  const world=new ReactiveWorld(new THREE.Scene(),{id,spawn:p(),ground:{heightAt:()=>0}},physics,{npcs:[],story:{goal:[0,0,-100]},relics:{spots:[]}},{storage:null});
  const obj=world.nodes[0].obj;
  assert.equal(obj.texts.length,3,id);
  assert.equal(new Set(obj.texts.map(t=>{t.geometry.computeBoundingBox();const b=t.geometry.boundingBox;return `${t.geometry.attributes.position.count}:${b.min.y.toFixed(2)}:${b.max.y.toFixed(2)}`;})).size,3,'three different glyphs');
  assert.ok(obj.texts.every(t=>!t.visible),'quiet until woken');
  assert.ok(obj.moving.children.some(c=>c.material===obj.m),'the face and its three lenses share the waking light');
 }
});

// ------------------------------------------------------------------ room to bloom
const ring=(d)=>Array.from({length:BLOOM.rays},(_,k)=>{const a=k*Math.PI*2/BLOOM.rays;return {dir:[Math.cos(a),Math.sin(a)],d:d(Math.cos(a),Math.sin(a))};});
test('bloom room: in the open a flower opens fully and stands straight',()=>{
 const r=bloomRoom(ring(()=>Infinity),{reach:1.2,height:1.4});
 assert.equal(r.open,BLOOM.wide);assert.equal(r.angle,0);assert.equal(r.sway,1);assert.ok(r.ok);
});
test('bloom room: by a wall it leans away and opens only as far as the room left; boxed in, it grows elsewhere',()=>{
 // a wall 0.9 m off along +x (each ray meets it at 0.9 / cos)
 const hits=ring((c)=>c>0.05?0.9/c:Infinity),reach=1.2,height=1.4,r=bloomRoom(hits,{reach,height});
 assert.ok(r.lean[0]<-0.95,`leans away from the wall (${r.lean})`);
 assert.ok(r.angle>0&&r.angle<=BLOOM.maxTilt);
 const shift=height*Math.sin(r.angle);
 assert.ok(r.open*reach+BLOOM.margin<=0.9+shift+1e-9,'the petals stop short of the wall');
 assert.ok(r.open*reach>0.9-BLOOM.margin,'leaning gives it more room than standing straight');
 assert.ok(r.sway<1,'stirred, it swings less');
 assert.equal(bloomRoom(ring(()=>0.5),{reach,height}).ok,false,'boxed in on every side');
 // a shy fungus rests open: it needs the room for that
 assert.equal(bloomRoom(ring(()=>1.1),{reach,height,quiet:1}).ok,false);
 assert.equal(bloomRoom(ring(()=>1.1),{reach,height}).ok,true);
});
test('bloom room: no flower opens into a wall or into an awake neighbour, even in full fluid bloom',()=>{
 const WALL=4.2;   // a wall across the world at x = 4.2 (the flowers stand either side of it)
 const physics={
  rayHit:(o,d)=>d.y<-0.5?{point:p(o.x,0,o.z)}:null,
  rayDistance:(o,d,far)=>{if(Math.abs(d.x)<1e-6)return Infinity;const t=(WALL-o.x)/d.x;return t>0&&t<=far?t:Infinity;},
 };
 const world=new ReactiveWorld(new THREE.Scene(),{id:'edena',spawn:p(),ground:{heightAt:()=>0}},physics,{npcs:[],story:{goal:[0,0,-100]},relics:{spots:[]}},{storage:null});
 const flowers=world.nodes.filter(n=>n.obj.petals);
 assert.ok(flowers.length>=12,`${flowers.length} flowers`);
 assert.ok(flowers.some(n=>n.room.angle>0.05),'some lean away from the wall');
 assert.ok(flowers.every(n=>Math.abs(n.foot.x-WALL)>0.3),'none stands in the wall');
 // every flower awake and blooming in the fluid's tones at once
 for(const n of world.field.nodes){n.energy=1;n.fluid={tones:[new THREE.Color('#52c8cf'),new THREE.Color('#966ede')],t:1};}
 const camera=new THREE.PerspectiveCamera();camera.updateMatrixWorld();
 for(const t of [0,0.3,0.7,1.1])world.update(0.016,t,{pos:p(0,0,30),frame:{up:p(0,1,0)}},camera);
 const v=new THREE.Vector3(),tips=n=>{n.obj.root.updateMatrixWorld(true);const m=n.obj.petals.children[0],P=m.geometry.attributes.position,out=[];for(let i=0;i<P.count;i++)out.push(v.fromBufferAttribute(P,i).applyMatrix4(m.matrixWorld).clone());return out;};
 let worst=Infinity;
 for(const n of flowers){const side=Math.sign(n.foot.x-WALL);for(const q of tips(n))worst=Math.min(worst,(q.x-WALL)*side);}
 assert.ok(worst>0,`no petal crosses the wall (closest ${worst.toFixed(3)} m)`);
 // a flower in full bloom stays clear of its neighbour's petals open awake
 const centre=n=>n.obj.petals.getWorldPosition(new THREE.Vector3()),spread=n=>n.obj.reach*n.obj.root.scale.x*n.obj.petals.scale.x*n.obj.moving.scale.x;
 for(const a of flowers)for(const b of flowers){
  if(a===b)continue;
  const ca=centre(a),cb=centre(b),d=Math.hypot(ca.x-cb.x,ca.z-cb.z);
  if(Math.abs(ca.y-cb.y)>1)continue;
  assert.ok(spread(a)+Math.min(spread(b),b.reach)<=d+0.25||spread(a)<=d/2+0.25,`flowers ${d.toFixed(2)} m apart: ${spread(a).toFixed(2)} into ${b.reach.toFixed(2)}`);
 }
});
