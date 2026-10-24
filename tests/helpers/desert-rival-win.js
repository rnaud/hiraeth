// Node playthrough adapter: drives the real rival session with ordinary controls.
// It never sets rewards, elapsed time, positions, progress or result state.
import assert from 'node:assert/strict';
import { ensureNpcDom } from './npc-dom.js';
ensureNpcDom();
import * as THREE from 'three';
import {buildCharacter} from '../../src/player.js';
import rivalGame from '../../src/minigames/canyon-rival.js';
import {COURSE,makeTrack,makeCourse,start,canyonHeight,botInput} from '../../src/minigames/canyon.js';

export async function winDesertRival(state) {
 const K=makeCourse(makeTrack(),{...COURSE,laps:1});
 const scene=new THREE.Scene(),char=buildCharacter(),camera=new THREE.PerspectiveCamera();
 scene.add(char.root);
 const results=[];let clock=0;
 const noop=()=>{},sfx=new Proxy({},{get:()=>noop});
 const ctx={def:rivalGame,state,scene,camera,player:{char,object:char.root,pos:new THREE.Vector3(),vel:new THREE.Vector3()},
  level:{canyon:{K,H:(x,z)=>canyonHeight(K,x,z),gates:K.checks.map(()=>({flags:[],colours:[]})),pads:K.pads.map(()=>({glow:0,chev:{}})),cloth:{}}},
  sfx,sound:null,add:o=>scene.add(o),get time(){return clock},finish:r=>results.push(r),setFov:noop,status:noop,flash:noop,kick:noop,speed:noop,addTime:noop};
 const session=start(ctx);
 try {
  for(let frame=0;frame<60*75&&!results.length;frame++){
   const input=botInput(session.bike,session.course);
   const x=Math.sign(input.x)*(.12+.88*Math.abs(input.x)**(1/1.6));
   clock+=1/60;
   session.update(1/60,{x,y:1,tuck:1,brake:0,jump:false},{live:true,phase:'play'});
  }
  assert.equal(results.length,1,'rival race must finish through actual physics');
  assert.equal(results[0].failed,false,'route solver must beat the rival');
  assert.equal(state.flag('desert.bike.race.won'),true,'real race awards the victory');
  assert.equal(state.flag('desert.bike.found'),true,'real race awards ownership');
  return {result:results[0],seconds:clock};
 } finally {session.end();}
}
