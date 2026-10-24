import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Door } from '../src/temples/pieces.js';
import { helperThreshold } from '../src/temples/helper-threshold.js';
import { beginHelperEncounter, helperRun, consumeHelperReturn, HELPER_KEY } from '../src/temples/helper-encounter.js';
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
function fixture(id='desert', z=-2) {
  const flags={'item.sword':true,'item.shield':true,'item.gun':true,'item.glider':true};
  const game={flag:k=>flags[k],set:(k,v)=>flags[k]=structuredClone(v)};
  const group=new THREE.Group();group.updateMatrixWorld(true);
  const door={group,w:4.4,h:6,open:true,handle:null,slab:{position:V(0,-6.3,0)}};
  const player={pos:V(0,0,z),onGround:true,heading:0,frame:{up:V(0,1,0),dir:(_,v)=>v.set(0,0,1)},teleport(p,u,f){this.pos.copy(p);this.frame.up.copy(u);this.onGround=false;}};
  const rt={id,piece:()=>door,logic:{resolved:false,isOpen:()=>true},inside:()=>true,guardian:{arena:{center:V(0,0,20),r:18,y:0}}};
  const calls=[];const invitation={start:o=>{calls.push(o);return true;}};
  const flow=helperThreshold(rt,{game,player,invitation,slot:()=> 'a'});
  const step=(x,y,z)=>{player.pos.set(x,y,z);flow.update();};
  return {flow,flags,game,player,door,rt,calls,step};
}
for(const id of ['desert','arzach'])test(`${id}: actual doorway crossing owns one intro and distinct quit/completion poses`,()=>{
 const f=fixture(id);f.flow.update();f.step(0,0,-2);f.step(0,0,-.1);f.step(0,0,.2);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].entrance,true);
 assert.deepEqual(f.calls[0].returnPose.pos,[0,0,-2]);assert.ok(f.calls[0].completionPose.pos[2]>0);
 f.step(0,0,.3);assert.equal(f.calls.length,1);assert.equal(f.flow.legacyAvailable(),false);
});
for(const mode of ['locked','slab','width','height','teleport','missing-item','dead'])test(`${mode} cannot start the ending`,()=>{
 const f=fixture();f.flow.update();f.step(0,0,-2);
 if(mode==='locked')f.rt.logic.isOpen=()=>false;
 if(mode==='slab')f.door.slab.position.y=0;
 if(mode==='missing-item')f.flags['item.gun']=false;
 if(mode==='dead')f.player.dead=true;
 f.step(0,0,-.1);
 f.step(mode==='width'?4:0,mode==='height'?4:0,mode==='teleport'?6:.2);
 assert.equal(f.calls.length,0);
});
test('loaded inside offers explicit continuation, never boot auto-entry',()=>{
 const f=fixture('desert',8);f.flow.update();f.step(0,0,8.1);
 assert.equal(f.calls.length,0);assert.equal(f.flow.legacyAvailable(),true);
 assert.equal(f.flow.continueLegacy(),true);assert.equal(f.calls.length,1);
 assert.deepEqual(f.calls[0].returnPose.pos,[0,0,8.1]);
});
test('interrupted intro restores recorded outside pose without completion',()=>{
 const f=fixture('desert',.3);f.flags['temple.desert.help.entry']={slot:'a',pose:{pos:[0,0,-2],up:[0,1,0],fwd:[0,0,1]}};
 f.flow.update();assert.deepEqual(f.player.pos.toArray(),[0,0,-2]);assert.equal(f.calls.length,0);assert.equal(f.flags['temple.desert.done'],undefined);
});
test('success is revalidated at departure and recovery retains goal ownership',()=>{
 const f=fixture();let slot='a';
 const p={pos:[0,0,-2],up:[0,1,0],fwd:[0,0,1]},done={...p,pos:[0,0,8]};
 beginHelperEncounter(f.game,'desert',{from:'desert',returnPose:p,completionPose:done,slot});
 const token=f.flags[HELPER_KEY].token;const run=helperRun(f.game,'cistern',token,{slot:()=>slot});
 const result={goal:{game:'cistern',complete:true}};
 assert.equal(run.completionHref(result),null);assert.equal(run.onResult(result),true);
 assert.equal(run.completionHref(result),'?level=desert');slot='b';assert.equal(run.completionHref(result),null);slot='a';
 const recovered=helperRun(f.game,'cistern',token,{slot:()=>slot});assert.equal(recovered.recoveryHref(),'?level=desert');
 let restored;consumeHelperReturn(f.game,'desert','desert',{slot,restore:p=>restored=p,resolve:()=>f.game.set('temple.desert.done',true)});
 assert.deepEqual(restored,done);assert.equal(f.flags[HELPER_KEY],null);
});

test('failed quit restores outside, and stale runner cannot claim a replaced receipt',()=>{
 const f=fixture(),p={pos:[0,0,-2],up:[0,1,0],fwd:[0,0,1]};
 beginHelperEncounter(f.game,'desert',{from:'desert',returnPose:p,slot:'a'});
 const token=f.flags[HELPER_KEY].token, old=helperRun(f.game,'cistern',token,{slot:()=> 'a'});
 const current=helperRun(f.game,'cistern',token,{slot:()=> 'a'});
 assert.equal(old.onResult({goal:{game:'cistern',complete:true}}),false);
 assert.equal(current.onResult({failed:true,goal:{game:'cistern',complete:true}}),false);
 current.left();assert.equal(current.recoveryHref(),'?level=desert');
 let restored,resolved=0;consumeHelperReturn(f.game,'desert','desert',{slot:'a',restore:p=>restored=p,resolve:()=>resolved++});
 assert.deepEqual(restored,p);assert.equal(resolved,0);assert.equal(f.flags[HELPER_KEY],null);
});
test('dispose or completed temple while approaching cannot launch',()=>{
 for(const dispose of [true,false]) {
  const f=fixture();f.flow.update();f.step(0,0,-2);
  if(dispose)f.flow.dispose();else f.rt.logic.resolved=true;
  f.step(0,0,-.1);f.step(0,0,.2);assert.equal(f.calls.length,0);
 }
});


test('partly opening real Door update retains a crossing beyond the trigger strip',()=>{
 const f=fixture('arzach');f.flow.update();f.step(0,0,-2);
 // Exercise the production door's actual 1.8-second descent and ease curve.
 Object.assign(f.door,{k:0,rt:{},o:{},lamps:[],glow:{uniforms:{uGlow:{value:0}}},apply:Door.prototype.apply});
 const lower=dt=>Door.prototype.update.call(f.door,dt,0);
 lower(.2);f.step(0,0,-.1);f.step(0,0,.2);
 lower(.4);f.step(0,0,2.2);lower(.4);f.step(0,0,4.2);
 assert.equal(f.calls.length,0);
 lower(.8);f.step(0,0,6.2);
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].returnPose.pos,[0,0,-2]);
});
test('already-inside legacy continuation does not impose newly added equipment or lock requirements',()=>{
 const f=fixture('arzach',8);delete f.flags['item.gun'];f.rt.logic.isOpen=()=>false;f.door.open=false;
 f.flow.update();assert.equal(f.flow.continueLegacy(),true);assert.equal(f.calls.length,1);
});
