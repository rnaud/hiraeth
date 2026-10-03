import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Scout, nextObjective, viaPortal } from '../src/scout.js';
import { makeMaterial, markHero, sharedUniforms } from '../src/materials.js';
const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

test('guide advances through traveler, climb, lenses, return, story, relics and gate', () => {
  const ctx = { player: {pos:v()}, level:{}, story:{done:false,def:{label:'Story'},goal:v(50)}, relics:{items:[{i:1,pos:v(20),done:false}]}, gate:{pos:v(90),destTitle:'Next'} };
  ctx.expedition = {state:{started:false,done:false,returned:false},traveler:{pos:v(10)},model:{center:v(100,51),ledges:[v(126,8),v(124,16)],receivers:[{visible:true},{visible:false}],dials:[new THREE.Object3D(),new THREE.Object3D()]}};
  const goal = () => nextObjective(ctx).id;
  assert.equal(goal(),'traveler');
  ctx.expedition.state.started=true; assert.equal(goal(),'ledge-0');
  ctx.player.pos.y=10; assert.equal(goal(),'ledge-1');
  ctx.player.pos.set(100,51,0); assert.equal(goal(),'lens-1');
  ctx.expedition.state.done=true; assert.equal(goal(),'traveler');
  ctx.expedition.state.returned=true; assert.equal(goal(),'story');
  ctx.story.done=true; assert.equal(goal(),'relic-1');
  ctx.relics.items[0].done=true; assert.equal(goal(),'gate');
  ctx.gate=null; assert.equal(nextObjective(ctx),null);
});

test('route chooses the first of chained portals, but keeps nearby objectives direct', () => {
  const target={id:'goal',label:'Goal',position:v(1000)};
  const links=[{at:v(10),to:v(400)},{pos:v(410),to:v(990)}];
  assert.equal(viaPortal(v(),target,links).position.x,10);
  assert.equal(viaPortal(v(400),target,links).position.x,410);
  assert.equal(viaPortal(v(998),target,links),target);
});

function fixture(physics={rayDistance:()=>Infinity}) {
  const dock=new THREE.Object3D(); dock.position.set(0,2,0);
  const player={pos:v(),vel:v(),frame:{up:v(0,1)},gear:{scoutDock:dock}};
  const scout=new Scout({scene:new THREE.Scene(),player,physics,getTarget:()=>({id:'test',label:'Test',position:v(100)})});
  return {scout,player};
}
test('scout undocks, waits ahead, pauses, refreshes on ping and returns to its dock', () => {
  const {scout}=fixture(); assert.equal(scout.phase,'docked'); scout.ping();
  for(let i=0;i<200;i++)scout.update(.05);
  assert.equal(scout.phase,'guide'); assert.ok(scout.object.position.x>8);
  const age=scout.age; scout.update(2,true); assert.equal(scout.age,age);
  scout.ping(); assert.equal(scout.age,0);
  for(let i=0;i<650;i++)scout.update(.05);
  assert.equal(scout.phase,'docked'); assert.ok(scout.object.position.distanceTo(scout.anchor())<.01);
});
test('scout avoids solid obstacles and terrain; teleport recalls it', () => {
  const {scout,player}=fixture({rayDistance:(_p,d)=>d.x>.5 ? 0 : Infinity,base:{heightAt:()=>0}});
  scout.moveToward(v(10,2),1,v(0,1)); assert.ok(scout.object.position.x<1);
  scout.moveToward(v(0,-10),5,v(0,1)); assert.ok(scout.object.position.y>=.35);
  scout.ping(); player.pos.x=100; scout.update(.01); assert.equal(scout.phase,'docked');
});
test('hero tagging isolates cached materials while preserving live scene uniforms', () => {
  const shared=makeMaterial({color:'#aabbcc'}), root=new THREE.Group();
  const a=new THREE.Mesh(new THREE.BoxGeometry(),shared), b=a.clone();root.add(a,b);
  markHero(root);
  assert.equal(shared.uniforms.uHero.value,0);
  assert.equal(a.material,b.material); assert.notEqual(a.material,shared);
  assert.equal(a.material.uniforms.uHero.value,1);
  for(const key of Object.keys(sharedUniforms))assert.equal(a.material.uniforms[key],sharedUniforms[key]);
});
