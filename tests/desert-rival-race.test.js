import test from 'node:test';
import { ensureNpcDom } from './helpers/npc-dom.js';
ensureNpcDom();
import assert from 'node:assert/strict';
import rivalGame from '../src/minigames/canyon-rival.js';
import {checkGame} from '../src/minigames/kit/registry.js';
import {COURSE,makeTrack,makeCourse,newBike,bikeStep,botInput,newRival,stepRival,rivalWinner,awardRivalBike,loseRivalWager} from '../src/minigames/canyon.js';
import {buildRivalSled} from '../src/minigames/canyon-sled.js';
import {bikeWager} from '../src/story/bike-wager.js';
import {DialogueRunner} from '../src/story/dialogue.js';
import {parseLine} from '../src/story/tone.js';
import {budget} from '../src/vehicle-kit.js';
import {resultActions} from '../src/minigames/kit/flow.js';
const course=()=>makeCourse(makeTrack(),{...COURSE,laps:1});
const state=()=>({flags:{},flag(k){return this.flags[k]},set(k,v){this.flags[k]=v}});

test('Kamal explains the salvage, fluid requirement and stakes before accepting a race',()=>{
 const s=state();let fuel=false,launches=0;
 const person=bikeWager({fuelled:()=>fuel,race:()=>launches++,practice:()=>{}});
 const r=new DialogueRunner(person,{game:s});
 const pick=text=>{while(!r.lastPage)r.advance();const c=r.choices().find(c=>c.text.includes(text));assert.ok(c,text);r.choose(c.index);};
 pick('Then can I take it');
 assert.match(r.pages.join(' '),/fan sled/);assert.match(r.pages.join(' '),/your battery/);
 while(!r.lastPage)r.advance();
 assert.ok(!r.choices().some(c=>c.text.includes('One lap')), 'an empty tank cannot accept');
 fuel=true;pick('One lap');assert.equal(launches,1);assert.equal(s.flag('desert.bike.found'),undefined);
 for(const node of Object.values(person.talk.nodes))for(const line of [...(node.say??[]),...(node.choices??[]).map(c=>c.text)])assert.ok(parseLine(line).explicit,line);
});
test('a lost accepted wager retains a claim until a win without removing the essential backpack',()=>{
 const s=state();s.set('item.backpack',true);
 assert.equal(loseRivalWager(s),false,'an unrelated arcade loss does not create a debt');
 s.set('desert.bike.race.accepted',true);assert.equal(loseRivalWager(s),true);
 assert.equal(s.flag('desert.bike.race.debt'),true);assert.equal(s.flag('item.backpack'),true);
 const r=new DialogueRunner(bikeWager({fuelled:()=>true,race:()=>{},practice:()=>{}}),{game:s});
 assert.equal(r.nodeId,'rematch');assert.match(r.pages.join(' '),/loan/);
 awardRivalBike(s);assert.equal(s.flag('desert.bike.race.debt'),false);assert.equal(s.flag('desert.bike.found'),true);
 assert.equal(loseRivalWager(s),false,'later practice cannot revoke earned ownership');
});
test('Kamal rides a compact independent fan sled with no fluid tank socket',()=>{
 const sled=buildRivalSled();const cost=budget(sled.root);
 assert.equal(sled.root.name,'Kamal-fan-sled');assert.ok(sled.seatAnchor);assert.equal(sled.socket,undefined);
 assert.ok(cost.draws<=3 && cost.tris<2400,JSON.stringify(cost));
 const rotor=sled.body.children.find(c=>c.isGroup && c!==sled.seatAnchor),before=rotor.rotation.z;
 sled.animate(1/30,{speed:30});assert.notEqual(rotor.rotation.z,before);
});

test('rival race is a shared game with ordinary retry/quit, no skip or difficulty award',()=>{
 assert.deepEqual(checkGame(rivalGame),[]);assert.equal(rivalGame.rival,true);
 assert.equal(rivalGame.options,undefined);
 for(const fails of [0,1,5,100])assert.ok(!resultActions({failed:true},null,fails).some(a=>/skip|continue/.test(a.id??a.act??'')));
});
test('finish order uses actual within-frame crossings; a tie does not hand over a bike',()=>{
 assert.equal(rivalWinner(99,101,98,102,100),'rival');
 assert.equal(rivalWinner(99,103,98,101,100),'player');
 assert.equal(rivalWinner(98,99,90,99,100),null);
 assert.equal(rivalWinner(98,100,99,100,100),'rival');
 assert.equal(rivalWinner(90,99,99,100,100),'rival');
});
test('the fixed rival completes both chasms at 20–120 fps and can be beaten by the same physics',()=>{
 const times=[];
 for(const fps of [20,30,60,120]){
  const K=course(),r=newRival(K),p=newBike(K,6,-3);let t=0,playerTime=null,rivalTime=null;
  while(t<75&&(!playerTime||!rivalTime)){
   const before=p.prog,rb=r.bike.prog;
   if(!playerTime)bikeStep(p,botInput(p,K),1/fps,K);
   if(!rivalTime)stepRival(r,K,1/fps);
   t+=1/fps;
   if(!playerTime&&p.prog>=K.L){playerTime=t;assert.equal(rivalWinner(before,p.prog,rb,r.bike.prog,K.L),'player');}
   if(!rivalTime&&r.bike.prog>=K.L)rivalTime=t;
  }
  assert.ok(playerTime&&rivalTime,`${fps}: both finish`);
  assert.ok(rivalTime-playerTime>8&&rivalTime-playerTime<14,`${fps}: margin ${rivalTime-playerTime}`);
  assert.equal(r.falls,0);assert.equal(r.race.splits.length,K.C.checkpoints);
  times.push(rivalTime);
 }
 assert.ok(Math.max(...times)-Math.min(...times)<2,'fixed skill remains consistent across frame rates');
});
test('a stopped rider loses to an independently simulated rival, and retries restart both progress',()=>{
 const K=course(),r=newRival(K),p=newBike(K,6);let outcome=null;
 for(let i=0;i<60*60&&!outcome;i++){const before=r.bike.prog;stepRival(r,K,1/60);outcome=rivalWinner(p.prog,p.prog,before,r.bike.prog,K.L);}
 assert.equal(outcome,'rival');assert.ok(r.race.done);
 const again=newRival(K);assert.equal(again.bike.prog,p.prog);assert.equal(again.time,0);assert.equal(again.race.done,false);
});
test('rival falls use the same last-checkpoint recovery, never a free progress jump',()=>{
 const K=course(),r=newRival(K);r.race.next=3;r.bike.prog=K.L*.5;r.dying=.01;
 stepRival(r,K,1/60);
 assert.equal(r.bike.prog,2*K.L/K.C.checkpoints+4);assert.equal(r.race.next,3);
});
test('winning uses the existing ownership flag and records the actual race award',()=>{
 const s=state();assert.equal(awardRivalBike(s),true);
 assert.equal(s.flag('desert.bike.found'),true);assert.equal(s.flag('desert.bike.race.won'),true);assert.equal(s.flag('desert.bike.uncovered'),true,'winning via the game menu also completes the discovery step');
 awardRivalBike(s);assert.equal(s.flag('desert.bike.found'),true);
});

test('real session awards only a win; losing, intro and disposal never grant ownership',async()=>{
 const THREE=await import('three');const {buildCharacter}=await import('../src/player.js');
 const {start,canyonHeight}=await import('../src/minigames/canyon.js');
 function session(){
  const K=course(),scene=new THREE.Scene(),char=buildCharacter(),camera=new THREE.PerspectiveCamera();scene.add(char.root);
  const save=state(),results=[],status=[];let clock=0;
  const noop=()=>{};const sfx=new Proxy({},{get:()=>noop});
  const ctx={def:rivalGame,state:save,scene,camera,player:{char,object:char.root,pos:new THREE.Vector3(),vel:new THREE.Vector3()},
   level:{canyon:{K,H:(x,z)=>canyonHeight(K,x,z),gates:K.checks.map(()=>({flags:[],colours:[]})),pads:K.pads.map(()=>({glow:0,chev:{}})),cloth:{}}},
   sfx,sound:null,add:o=>scene.add(o),get time(){return clock},finish:r=>results.push(r),setFov:noop,status:s=>status.push(s),flash:noop,kick:noop,speed:noop,addTime:noop};
  const S=start(ctx);return {S,save,results,status,step(input,live=true){clock+=1/60;S.update(1/60,input,{live,phase:live?'play':'intro'})}};
 }
 const stopped=session();for(let i=0;i<120;i++)stopped.step({},false);
 assert.equal(stopped.S.rival.bike.prog,6,'rival does not move during intro');assert.deepEqual(stopped.save.flags,{});
 for(let i=0;i<4000&&!stopped.results.length;i++)stopped.step({x:0,y:0,tuck:0,brake:0,jump:false});
 assert.equal(stopped.results.length,1);assert.equal(stopped.results[0].failed,true);assert.deepEqual(stopped.save.flags,{});stopped.S.end();
 const good=session();
 for(let i=0;i<4000&&!good.results.length;i++){
  const b=botInput(good.S.bike,good.S.course);const x=Math.sign(b.x)*(.12+.88*Math.abs(b.x)**(1/1.6));
  good.step({x,y:1,tuck:1,brake:0,jump:false});
 }
 assert.equal(good.results.length,1);assert.equal(good.results[0].failed,false);assert.equal(good.save.flag('desert.bike.race.won'),true);
 assert.equal(good.save.flag('desert.bike.found'),true);assert.ok(good.status.some(x=>/1st \/ 2/.test(x)));
 const prior={x:good.S.rival.bike.x,z:good.S.rival.bike.z,speed:good.S.rival.bike.speed};
 good.S.update(.1,{}, {live:false,phase:'finishing'});
 assert.ok(Math.hypot(good.S.rival.bike.x-prior.x,good.S.rival.bike.z-prior.z)>0,'rival coasts after finish');
 assert.ok(good.S.rival.bike.speed<prior.speed,'rival brakes after finish');good.S.end();
 const quit=session();quit.S.end();assert.deepEqual(quit.save.flags,{});
});
