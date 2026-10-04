import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {ReactionField,ReactiveWorld,WORLD_REACTIONS} from '../src/reactive-world.js';
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
