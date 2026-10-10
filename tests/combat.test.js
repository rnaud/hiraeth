import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidBlade, SWINGS, attackSample, sweptBladeTouches } from '../src/fluid-blade.js';
import { Foe, FOES } from '../src/foes.js';
import { toolInput } from '../src/fluid-tool.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { clearTargets, registerTarget } from '../src/targets.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z), dt=1/60;
const env={ground:()=>0,seen:()=>true};

test('a committed lunge moves over several frames, hits once, and respects obstruction',()=>{
 for(const fps of [30,60,120]){
  const f=new Foe('blot',v()); f.state='wind'; f.attackH=0;
  const p={pos:v(0,0,1.8)};let events=[],deltas=[];
  for(let i=0;i<fps*2;i++){const z=f.pos.z;events.push(...f.update(1/fps,p,env));deltas.push(f.pos.z-z);}
  assert.equal(events.filter(e=>e.type==='strike').length,1);
  assert.ok(Math.max(...deltas)<.6,'lunge never teleports');
 }
 const f=new Foe('blot',v());f.state='wind';f.attackH=0;
 const e=[];for(let i=0;i<100;i++)e.push(...f.update(dt,{pos:v(0,0,1.8)},{...env,seen:()=>false}));
 assert.ok(e.filter(x=>x.type==='strike').every(x=>!x.hit),'a wall blocks damage');
});
test('blot can be interrupted; late machine wind-up commits; a timed block gives a longer opening',()=>{
 const blot=new Foe('blot',v());blot.state='strike';blot.hit('blade',v(0,0,1),{damage:1});assert.equal(blot.state,'recover');
 const machine=new Foe('machine',v());machine.state='wind';machine.k=.9;machine.hit('blade',v(0,0,1),{damage:1});assert.equal(machine.state,'wind');
 machine.staggered(false);const normal=machine.timer;machine.staggered(true);assert.ok(machine.timer>normal*2);
});
test('swept contact catches the travelled blade but not a target elsewhere in the old cone',()=>{
 const a={a:v(-1,1,0),b:v(-1,1,2)},b={a:v(1,1,0),b:v(1,1,2)};
 assert.ok(sweptBladeTouches(v(0,1,1),.2,a,b));
 assert.equal(sweptBladeTouches(v(0,1,3),.2,a,b),false);
 for(const S of SWINGS){const t=attackSample(S,0);assert.equal(t.phase,'wind');assert.equal(attackSample(S,t.wind+.01).phase,'strike');assert.equal(attackSample(S,t.duration-.01).phase,'recover');}
});
test('guard and evade have independent keyboard, pad and touch inputs',()=>{
 for(const key of ['KeyZ','ControlLeft','PadGuard','TouchGuard']){const c=toolInput({[key]:true});assert.ok(c.guard&&!c.blade&&!c.evade);}
 for(const key of ['AltLeft','PadEvade','TouchEvade'])assert.ok(toolInput({[key]:true}).evade);
 assert.ok(!toolInput({KeyF:true}).guard);
 assert.ok(!toolInput({KeyB:true}).guard,'B only chooses gadgets: it never guards');
 assert.ok(toolInput({MouseLeft:true}).blade&&!toolInput({MouseLeft:true,MouseRight:true}).blade,'a left click swings the blade, except while aiming (then it shoots)');
});
async function combatPlayer(matching=false){
 items.grant('backpack');const scene=course();const p=await traveller(scene,v(0,0,-60),{moves:true,matching,body:'v1'});
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,-65);camera.lookAt(0,1,-55);camera.updateMatrixWorld();
 const tool=new FluidTool({scene,player:p,physics:p.physics,camera,rig:{aimK:0},state:new GameState(null)});
 return {p,tool,tick(input={}){p.update(dt,input,CAM_PLUS_Z);tool.update(dt,input);}};
}
test('timed guard works without charge, expires while held, cannot be refreshed by rapid taps',async()=>{
 const {p,tool,tick}=await combatPlayer();tool.reserve.level=0;tool.reserve.since=0;
 for(let i=0;i<4;i++)tick({KeyZ:true});
 assert.ok(!tool.blade.swinging && tool.blade.guarding);
 assert.ok(tool.blade.block(p.pos.clone().add(v(0,0,1))));assert.ok(p.perfectBlock);
 tick({});for(let i=0;i<3;i++)tick({KeyZ:true});
 assert.equal(tool.blade.block(p.pos.clone().add(v(0,0,1))),false);
 for(let i=0;i<30;i++)tick({KeyZ:true});assert.equal(tool.blade.block(p.pos.clone().add(v(0,0,1))),false);
 tool.dispose();
});
test('grounded combat uses legs and smoothly returns to locomotion, with matching off and on',async()=>{
 for(const mm of [false,true]){
  clearTargets();const {p,tool,tick}=await combatPlayer(mm);let hit=0;
  registerTarget({kind:'foe',lock:true,accepts:['blade'],radius:.8,position:()=>v(0,1,-58.6),onHit:()=>hit++});
  let full=0,maxTurn=0,previous=null;
  for(let i=0;i<75;i++){
   tick(i<3?{KeyF:true}:{}); full=Math.max(full,p.animator.legsW);   // (a tap: held, it charges: tests/blade-attacks.test.js)
   const q=p.animator.bone('upperarm_r').quaternion.clone();if(previous)maxTurn=Math.max(maxTurn,q.angleTo(previous));previous=q;
  }
  assert.ok(full>.95,'full body during the cut');assert.equal(hit,1,'one real blade contact per target');
  assert.ok(maxTurn<1.2,`no large pose snap (${maxTurn})`);assert.equal(p.swingMove,null);assert.ok(!tool.blade.guarding,'attacking does not guard');
  const start=p.pos.clone();tick({AltLeft:true});for(let i=0;i<18;i++)tick({AltLeft:true});assert.ok(p.pos.distanceTo(start)>1,'evade moves through the controller');
  assert.ok(tool.blade.evadeCool>0,'held evade does not retrigger');tool.dispose();clearTargets();
 }
});

test('buffered combo lands three distinct contacts and cannot be evaded out of its active cut', async()=>{
 clearTargets(); const {p,tool,tick}=await combatPlayer(); const hits=[];
 registerTarget({kind:'foe',lock:true,accepts:['blade'],radius:.8,position:()=>v(0,1,-58.6),onHit:(_m,_p,_d,info)=>hits.push(info.combo)});
 tick({KeyF:true}); tick({}); tick({KeyF:true});
 for(let i=0;i<12;i++)tick({});
 assert.equal(tool.blade.phase,'strike'); tick({AltLeft:true});assert.equal(tool.blade.evadeT,0,'cannot dodge-cancel the cut');
 for(let i=0;i<25;i++)tick({});
 assert.equal(tool.blade.n,1);tick({KeyF:true});
 for(let i=0;i<100;i++)tick({});
 assert.deepEqual(hits,[0,1,2]); assert.equal(tool.blade.swinging,false);
 tool.dispose();clearTargets();
});

test('the upgraded whirl keeps its full circular cut active instead of becoming a forward-only hit', async()=>{
 clearTargets(); const {p,tool,tick}=await combatPlayer(); tool.state.set('ink',20);const hits=[];
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4, point=p.pos.clone().add(v(Math.sin(a)*1.3,1,Math.cos(a)*1.3));
  registerTarget({kind:'foe',accepts:['blade'],radius:.6,position:()=>point,onHit:()=>hits.push(i)});
 }
 tool.blade.start(2);for(let i=0;i<70;i++)tick({});
 assert.ok(hits.some(i=>i>=3&&i<=5),`the rear arc makes contact (${hits})`);
 assert.ok(hits.some(i=>i<=1||i===7),`the front arc makes contact (${hits})`);
 assert.equal(hits.length,new Set(hits).size);
 tool.dispose();clearTargets();
});
