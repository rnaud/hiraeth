import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bundle} from '../scripts/engine-bundle.mjs';
import {loadBundle} from '../engine/vm-run.mjs';
import {tempPath} from '../scripts/temp-dirs.mjs';

// Exercise the real native frame loop: a standalone Player test cannot catch a missing
// syncMovers call between the world's animated geometry and its collision transform.
test('native Moon Foundry carrier updates collision and keeps the traveller grounded in both directions',async()=>{
 const file=tempPath(join(tmpdir(),`hiraeth-moving-ground-${process.pid}.cjs`));
 await bundle('godot',{input:'engine/game.js',out:[file]});
 const unset=new Set(['shapeAttrs','quietWalk','listMatrices','stillMatrices','skipHidden','peopleLod','portrait','capeOffload','clothOffload','brush','materialFluid','materialLive','materialVec','vertices','then','photo']);
 const backend=new Proxy({},{get:(t,k)=>unset.has(k)?undefined:()=>{}});
 const old={info:console.info,log:console.log,warn:console.warn,error:console.error},errors=[];
 console.info=console.log=()=>{};console.warn=console.error=(...a)=>{if(/failed in|TypeError|ReferenceError/.test(a.join(' ')))errors.push(a.join(' '));};
 let g;
 try{
  const B=loadBundle(file);g=await B.exports.createGame({levelId:'moonfoundry',backend,saves:false});
  const C=g.level.cranes,st=C.ride.state,P=g.player,fn=P.finishFrame.bind(P);let checked=0;
  P.finishFrame=function(dt,hs){fn(dt,hs);if(!(dt>0))return;const y=C.ride.piece.position.y;assert.ok(P.onGround,'grounded in engine frame');assert.ok(Math.abs(P.pos.y-y)<.003,`native sole gap ${P.pos.y-y}`);checked++;};
  for(const held of [false,true])for(const to of [1,0]){
   Object.assign(st,{u:.5,to,wait:0});C.update(0,0,12);g.physics.syncMovers(0);
   P.pos.copy(C.ride.piece.position);P.vel.set(0,0,0);P.onGround=true;P.lastSafe.copy(P.pos);
   const start=P.pos.clone();for(let i=0;i<90;i++){g.frame(1/30);if(held){const before=P.pos.clone();g.frame(0);assert.ok(P.pos.distanceTo(before)<.0001,'held render does not move the traveller');}}
   assert.ok(Math.abs(P.pos.y-start.y)>2,'actually carried vertically, not just grounded on stale collision');
  }
  assert.equal(checked,360);assert.deepEqual(errors,[]);
 }finally{g?.dispose?.();Object.assign(console,old);}
});
