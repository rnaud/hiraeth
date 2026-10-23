import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidBlade, RIPOSTE } from '../src/fluid-blade.js';
import { Foe, Foes } from '../src/foes.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { FoeReact } from '../src/foe-react.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { resetFeel, feelState, setMotion } from '../src/feel.js';

const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
function fixture({ special=null, reduce=false }={}) {
  clearTargets(); resetFeel(); setMotion({reduce,shake:1});
  const log={impacts:[],splashes:[],ripostes:0,rings:0,ripples:0,glances:0,sparks:[],reacts:0};
  const tool={physics:{rayDistance:()=>Infinity},info:()=>({}),splash:(at)=>log.splashes.push(at.clone()),
    sound:{fluidSlashHit:(...a)=>log.impacts.push(a),fluidRiposte:()=>log.ripostes++},
    rings:{add:()=>log.rings++},glow:{add(){}},lastHit:null};
  const blade=Object.assign(Object.create(FluidBlade.prototype),{tool,n:0,special,rising:true,hit:false,
    dir:v(0,0,1),hitTargets:new Set(),coarse:()=>({origin:v(0,1,0),dir:v(0,0,1),reach:4,angle:1.3}),
    rippleAt:()=>log.ripples++});
  const foes={list:[],sound:{foeGlance:()=>log.glances++,foeHurt(){}},
    sparks:(f,at)=>log.sparks.push(at.clone()),react:()=>log.reacts++,defeat(){},armour(){},tool};
  const target=(onHit,x=0,kind='foe')=>registerTarget({kind,accepts:kind==='wildlife'?[]:['blade'],radius:.4,position:()=>v(x,1,2),onHit});
  const foe=(f,x=0)=>target((mode,point,dir,info)=>Foes.prototype.hurt.call(foes,f,mode,dir,info,point),x);
  return {blade,log,tool,target,foe};
}
function noSuccess(F) {
  assert.equal(F.blade.hit,false); assert.equal(F.tool.lastHit,null);
  assert.deepEqual(F.log.impacts,[]); assert.deepEqual(F.log.splashes,[]);
  assert.equal(F.log.ripples,0); assert.equal(F.log.ripostes,0);
  assert.equal(feelState().stop,0); assert.equal(feelState().shake,0);
}

test('a geometric miss has no impact or success feedback',()=>{
  const F=fixture(); assert.deepEqual(F.blade.strike(),[]); noSuccess(F);
});
test('a phased foe rejects the cut with no damage or phantom success',()=>{
  const F=fixture({special:RIPOSTE});
  const f=new Foe('blot',v(0,0,2),{def:{phase:true}}); f.dist=100; f.state='chase'; f.lit=0; f.stunned=0;
  const hp=f.hp; assert.equal(f.phased,true); F.foe(f);
  assert.deepEqual(F.blade.strike(),[]); assert.equal(f.hp,hp); noSuccess(F);
});
test('armour keeps its own contact sparks and sound without wet success feedback',()=>{
  const F=fixture(); const f=new Foe('crab',v(0,0,2)); f.heading=Math.PI; f.shelled=true;
  const hp=f.hp; F.foe(f); assert.deepEqual(F.blade.strike(),[]);
  assert.equal(f.hp,hp); assert.equal(F.log.glances,1); assert.equal(F.log.sparks.length,1);
  assert.ok(F.log.sparks[0].distanceTo(v(0,1,2))<1e-9,'sparks at actual contact');
  noSuccess(F); F.blade.strike(); assert.equal(F.log.glances,1,'one attempt per swing');
});
test('guardian dull outcomes suppress celebration even when the legacy callback returns true',()=>{
  const F=fixture({special:RIPOSTE}); let calls=0;
  F.target((mode,point,dir,info)=>{calls++;info.dull=true;return true;});
  F.blade.strike(); noSuccess(F); F.blade.strike(); assert.equal(calls,1);
});
test('accepted damage remains once per target per swing with one intended impact',()=>{
  const F=fixture(); const f=new Foe('blot',v(0,0,2)); f.hp=10; const hp=f.hp; F.foe(f);
  assert.equal(F.blade.strike().length,1); assert.equal(f.hp,hp-1); assert.equal(F.log.reacts,1);
  assert.equal(F.log.impacts.length,1); assert.equal(F.log.splashes.length,1); assert.equal(F.log.ripples,1);
  assert.ok(feelState().stop>0); F.blade.strike(); assert.equal(f.hp,hp-1); assert.equal(F.log.impacts.length,1);
});
test('legacy puzzle callbacks without a return remain accepted',()=>{
  const F=fixture(); let progress=0; F.target(()=>{progress++;},0,'switch');
  assert.equal(F.blade.strike().length,1); assert.equal(progress,1); assert.equal(F.log.impacts.length,1);
});
test('mixed targets only splash accepted contacts and invoke every callback once',()=>{
  const F=fixture(); const calls=[0,0,0];
  F.target(()=>{calls[0]++;return false;},-.3);
  F.target((m,p,d,i)=>{calls[1]++;i.dull=true;return true;},0);
  F.target(()=>{calls[2]++;return true;},.3);
  assert.equal(F.blade.strike().length,1); assert.deepEqual(calls,[1,1,1]);
  assert.equal(F.log.impacts.length,1); assert.equal(F.log.splashes.length,1); assert.equal(F.log.splashes[0].x,.3);
});
test('wildlife bonks give one lighter impact, without a second blade miss callback',()=>{
  const F=fixture(); let bonks=0; F.target(()=>{bonks++;return true;},0,'wildlife');
  F.blade.strike(); assert.equal(bonks,1); assert.deepEqual(F.log.impacts,[[true,false]]);
  assert.equal(feelState().stop,.035); assert.equal(F.log.splashes.length,0);
});
test('reduced motion keeps damage and feedback while disabling camera freeze and kick',()=>{
  const F=fixture({reduce:true}); F.target(()=>true); F.blade.strike();
  assert.equal(F.log.impacts.length,1); assert.equal(F.log.splashes.length,1);
  assert.equal(feelState().stop,0); assert.equal(feelState().shake,0); setMotion({reduce:false,shake:1});
});
test('vertical and directionless accepted hits recoil away from current facing, never an old blow',()=>{
  const f=new Foe('blot',v()); f.heading=Math.PI/2;
  f.model={group:new THREE.Group(),tones:[]}; f.react=new FoeReact();
  f.react.hit(v(0,0,1));
  for(const dir of [v(0,-1,0),null]) {
    Foes.prototype.react.call({tool:null},f,'blade',dir,{damage:1});
    assert.ok(f.react.dir.distanceTo(v(-1,0,0))<1e-8);
    f.react.update(1/60); assert.ok(f.react.push.y>0);
  }
  Foes.prototype.react.call({tool:null},f,'blade',v(.5,-1,.5),{damage:1});
  assert.ok(f.react.dir.distanceTo(v(1,0,1).normalize())<1e-8,'horizontal incoming direction preserved');
});

function liveTool(sound) {
  clearTargets(); resetFeel(); setMotion({reduce:false,shake:1}); items.grant('backpack');
  const player={pos:v(),vel:v(),heading:0,frame:{up:v(0,1,0),fwd:v(0,0,1),right:v(1,0,0),dir:(h,out)=>out.set(Math.sin(h),0,Math.cos(h)),headingOf:d=>Math.atan2(d.x,d.z),quaternion:(h,q)=>q},
    vehicles:[],object:{visible:true},ride:null,onGround:true,aim:null,opts:{},health:1,down:null,dead:false};
  const camera=new THREE.PerspectiveCamera(); camera.position.set(0,1.6,-3); camera.lookAt(0,1.6,10); camera.updateMatrixWorld();
  const tool=new FluidTool({scene:new THREE.Scene(),player,physics:{groundAt:()=>0,rayDistance:()=>Infinity,rayHit:()=>null},camera,rig:{aimK:0},state:new GameState(null),sound});
  return tool;
}
test('a complete missed swing retains one windup and one air swish, with zero impact cues',()=>{
  let windups=0,swings=0,impacts=0;
  const tool=liveTool({fluidWindup:()=>windups++,fluidSlash:()=>swings++,fluidSlashHit:()=>impacts++});
  tool.blade.start(0);
  for(let i=0;i<120;i++)tool.update(1/60,{});
  assert.equal(windups,1);assert.equal(swings,1);assert.equal(impacts,0);
  tool.dispose?.();
});
test('a regular block and perfect parry each keep one distinct shield cue, without a blade impact',()=>{
  for(const perfect of [false,true]) {
    const cues=[];let impacts=0,extraChirps=0;
    const tool=liveTool({fluidBlock:p=>{cues.push(p);return true;},fluidSlashHit:()=>impacts++,fluidMode:()=>extraChirps++});
    const b=tool.blade;b.guardK=1;b.guardAge=perfect?0:1;b.perfectReady=perfect;b.dir.set(0,0,1);
    assert.equal(b.block(v(0,0,2)),perfect?'perfect':true);
    assert.deepEqual(cues,[perfect]);assert.equal(impacts,0);assert.equal(extraChirps,0,'selected parry owns its cue');
    tool.dispose?.();
  }
});
