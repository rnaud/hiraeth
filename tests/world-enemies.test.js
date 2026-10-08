import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync,existsSync} from 'node:fs';
import {ENEMY_ROSTER,WORLD_ENEMIES,worldPack} from '../src/enemies/roster.js';
import {ATTACKS,lockAttack,attackReach} from '../src/enemies/attacks.js';
import {Foe,Foes,PEACEFUL} from '../src/foes.js';
import {GameState} from '../src/game-state.js';
import {materialCount} from '../src/materials.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), P=()=>({pos:v(0,0,2),health:1,vel:v(),hurt(){}});
const system=(world='arena',player=P(),extra={})=>new Foes({scene:new T.Scene(),level:{spawn:v(0,0,-200)},levelId:world,physics:{groundAt:()=>0},player,game:new GameState(null),...extra});
const env={ground:()=>0,seen:()=>true};
test('all 100 reference designs have models, two authored moves and complete world coverage',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../references/enemy-roster.json',import.meta.url)));
 assert.equal(ENEMY_ROSTER.length,100);assert.equal(new Set(ENEMY_ROSTER.map(e=>e.id)).size,100);
 assert.deepEqual(Object.keys(WORLD_ENEMIES).sort(),manifest.worlds.map(w=>w.world).sort());
 for(const w of manifest.worlds){const entries=WORLD_ENEMIES[w.world];assert.deepEqual(entries.map(e=>e.name),w.types.map(t=>t.name));assert.equal(entries.filter(e=>e.family==='machine'||e.family==='shade').length,2);
  for(const e of entries){assert.ok(existsSync(new URL('../'+e.reference,import.meta.url)));assert.equal(e.attacks.length,2);for(const a of e.attacks)assert.ok(ATTACKS[a]);}
 }
});
test('every model animates finitely through both attacks, stays upright and releases owned materials',()=>{
 const sys=system();const warm=sys.add(ENEMY_ROSTER[0].id,v());sys.remove(warm);const baseline=materialCount();
 for(const e of ENEMY_ROSTER){
  const f=sys.add(e.id,v());assert.ok(f.model.reference);assert.ok(f.def.height>.3);assert.ok(f.def.radius>=.3);
  for(let attack=0;attack<2;attack++){f.selectAttack(attack);lockAttack(f,P());for(const state of ['chase','wind','strike','recover'])for(const k of [0,.5,1]){f.state=state;f.k=k;f.heading=Math.PI*1.2;sys.look(f,1/60);f.model.group.updateMatrixWorld(true);f.model.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),e.id);});assert.ok(new T.Vector3(0,1,0).applyQuaternion(f.model.group.quaternion).y>.98);}}
  const b=new T.Box3().setFromObject(f.model.group);assert.ok(b.max.y>b.min.y+.5,e.id);sys.remove(f);
 }
 assert.equal(materialCount(),baseline);sys.dispose();
});
test('every custom attack telegraphs first, commits aim, contacts once per beat and alternates after recovery',()=>{
 for(const e of ENEMY_ROSTER)for(let i=0;i<2;i++){
  const f=new Foe(e.id,v(),{rng:()=>.5});f.selectAttack(i);const a=f.def.attack,Q=P();f.heading=0;Q.pos.z=attackReach(a)*.9;f.state='chase';f.cool=0;
  f.update(0,Q,env);assert.equal(f.state,'wind',e.id);const spots=f.zones.map(z=>z.at.clone());
  for(let t=0;t<a.wind-.01;t+=.01)assert.equal(f.update(.01,Q,env).filter(e=>e?.type==='strike').length,0);
  // Complete the wind, then sample contact counts, with a stationary player.
  while(f.state==='wind')f.update(.001,Q,env);
  let n=0;while(f.state==='strike')n+=f.update(.01,Q,env).filter(e=>e?.type==='strike').length;
  assert.equal(n,a.contacts.length,e.id+' '+a.name);f.zones.forEach((z,k)=>assert.ok(z.at.equals(spots[k]),'locked warning'));
  f.update(a.recover+.01,Q,env);assert.equal(f.attackIndex,(i+1)%2);
 }
});
test('custom ranged strikes respect walls and moving out of the locked landing zones',()=>{
 const id=WORLD_ENEMIES.edena[0].id;
 for(const blocked of [false,true]){const f=new Foe(id,v()),Q=P();f.heading=0;f.state='chase';f.cool=0;Q.pos.z=5;f.update(0,Q,env);
  while(f.state==='wind')f.update(.02,Q,env);
  if(!blocked)Q.pos.set(25,0,25);
  let hit=false;while(f.state==='strike')hit ||= f.update(.02,Q,{...env,seen:()=>!blocked}).some(e=>e?.hit);
  assert.equal(hit,false);
 }
});
test('a perfect parry interrupts remaining custom contacts; Gentle reduces harm and Off hides warnings',()=>{
 const Q=P(),sys=system('desert',Q,{settings:{enemies:'normal'}}),f=sys.add(WORLD_ENEMIES.desert[0].id,v());let damage=0;
 Q.hurt=d=>damage+=d;Q.guard=()=> 'perfect';sys.strike(f);assert.equal(damage,0);assert.equal(f.state,'recover');assert.ok(f.stunned>0);
 Q.guard=null;f.stunned=0;sys.strike(f);const normal=damage;damage=0;sys.settings.enemies='gentle';sys.strike(f);assert.equal(damage,normal*.5);
 f.state='wind';f.k=.5;lockAttack(f,Q);sys.look(f,.01);assert.ok(f.zoneTells.some(t=>t.group.visible));sys.settings.enemies='off';sys.update(.01);assert.ok(f.zoneTells.every(t=>!t.group.visible));sys.dispose();
});
test('world packs introduce all four designs and wilderness machines fight without a temple',()=>{
 for(const world of Object.keys(WORLD_ENEMIES)){const ids=new Set(Array.from({length:6},(_,i)=>worldPack(i,world)).flat());assert.equal(ids.size,4);}
 const Q=P(),sys=system('desert',Q),f=sys.add(WORLD_ENEMIES.desert[2].id,v());f.cool=0;for(let i=0;i<6;i++)sys.update(.1);assert.notEqual(f.state,'idle');assert.equal(f.templeOnly,false);sys.dispose();
 for(const world of ['home','atelier','overnighttrain']){assert.ok(PEACEFUL.has(world));const s=system(world);s.update(10);assert.equal(s.list.length,0);s.dispose();}
});
test('a broken custom machine can finish its debris without leaking materials',()=>{
 const sys=system(),id=WORLD_ENEMIES.desert[2].id;let f=sys.add(id,v());sys.remove(f);const baseline=materialCount();
 f=sys.add(id,v());sys.hurt(f,'blade',v(0,0,1),{damage:99});sys.update(1);sys.update(4);assert.equal(materialCount(),baseline);sys.dispose();
});
