// One catalogue and posing path for the browser review and offline mesh audit.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {attachMotion,segmentClips} from '../motion-match.js';
import {Player} from '../player.js';
import {swimPose} from '../swim.js';
import {flipPose,FLIP,BACK_FLIP,SIDE_HOP} from '../jump.js';
import {tightness} from '../hands.js';
import {TONE_GESTURES,GESTURE_CLIPS} from '../talk-gesture.js';
import {seatTripoArms} from './tripo-walk.js';
export const B3_MOTION_FILES=['moves','gestures','walks','locomotion'];
export async function loadB3Motions(lib,base='/'){
 const files=await Promise.all(B3_MOTION_FILES.map(n=>new GLTFLoader().loadAsync(`${base}anim/${n}.glb`)));
 return b3MotionCatalogue(lib,Object.fromEntries(B3_MOTION_FILES.map((n,i)=>[n,files[i]])));
}
export function b3MotionCatalogue(lib,files){
 const catalogue=Object.entries(lib.clips).filter(([,clip])=>clip).map(([id,clip])=>({id,clip,group:'Game',label:id}));
 for(const name of B3_MOTION_FILES){
  const g=files[name];if(!g)throw new Error(`Missing B3 audit animation file: ${name}`);
  // Same root stripping and segmentation as the game's motion loader.
  const own={...lib,motion:null};
  const sheet=g.animations.find(c=>c.name==='walk_loops'||c.name==='mm_database');
  const clips=sheet?segmentClips(sheet,name==='walks'?'walk':'mm'):(attachMotion(own,g),own.motion.all);
  for(const clip of clips)catalogue.push({id:`${name}:${clip.name}`,clip,group:{moves:'Actions',gestures:'Gestures',walks:'Character walks',locomotion:'Motion matching'}[name],label:clip.name});
 }
 for(const name of ['glide','jetHover','jetFlight','treadWater','breaststroke','crawl','frontFlip','backFlip','sideHop'])catalogue.push({id:`procedural:${name}`,label:name,group:'Procedural',clip:{duration:({frontFlip:FLIP,backFlip:BACK_FLIP,sideHop:SIDE_HOP}[name]?.time??2)},procedural:true});
 return catalogue;
}
export function b3HandContext(entry,time=0,{speaking=false,tone}={}){
 const n=entry?.label??'',id=entry?.id??'';
 if(id==='drive')return {mode:'seated'};
 if(/climb/i.test(n))return {mode:'climb'};
 if(id==='ledge')return {mode:'mantle'};
 if(/jump/i.test(n))return {mode:'air',air:1};
 if(/_(ss|gs)_/.test(n))return {pose:'grip'};
 const gesture=n.replace(/^gesture_/,''),speech=speaking||id==='talk'||entry?.group==='Gestures';
 const voice=tone??Object.entries(TONE_GESTURES).find(([,names])=>names.includes(gesture))?.[0]??'neutral';
 return {talk:speech?{tone:voice,k:1,beat:.5+.5*Math.sin(time*9)}:null,mode:'ground',speed:/sprint/.test(n)?7.2:/jog|running|run_/.test(n)?3.8:/walk/.test(n)?1.4:0};
}
export class B3MotionPlayer{
 constructor(model,animator,catalogue){this.model=model;this.animator=animator;this.catalogue=catalogue;this.actions=new Map();this.weights=new Map();}
 pose(id,time,dt=0,{hands='auto',blend=false,speaking=false,tone,cloth=true}={}){
  const entry=this.catalogue.find(e=>e.id===id);if(!entry)throw new Error(`Unknown B3 motion ${id}`);
  const {model,animator:a}=this,h=model.humanoid;
  if(entry.procedural)return this.procedural(entry,time,dt,hands);
  if(!this.actions.has(id)){const action=a.mixer.clipAction(entry.clip);action.play();this.actions.set(id,action);}
  for(const action of Object.values(a.actions))action.setEffectiveWeight(0);
  for(const [key,action]of this.actions){const w=blend?T.MathUtils.lerp(this.weights.get(key)??0,key===id?1:0,1-Math.exp(-dt*12)):(key===id?1:0);this.weights.set(key,w);action.enabled=true;action.paused=false;action.setEffectiveWeight(w);const clock=blend&&key!==id?action.time+dt:time,duration=Math.max(.001,action.getClip().duration),group=this.catalogue.find(e=>e.id===key).group;
   // Attacks, recoveries and gestures are one-shot clips. Wrapping a held
   // block or a get-up back to its first frame creates a visible snap.
   const loopGesture=group==='Gestures'&&GESTURE_CLIPS[action.getClip().name.replace(/^gesture_/,'')]?.loop;
   action.time=group==='Actions'||(group==='Gestures'&&!loopGesture)?Math.min(clock,duration-1e-5):clock%duration;}
  a.mixer.update(0);a.src.updateMatrixWorld(true);
  // Captured recoveries/kneels/attacks need full hip orientation, as Animator.play.
  a.fullW=0;a.headW=0;
  for(const [key,w]of this.weights){const e=this.catalogue.find(e=>e.id===key);if(e.group==='Actions')a.fullW+=w;if(e.group!=='Game')a.headW+=w;}
  a.apply(model.humanoid.char.root);
  const fast=(this.weights.get('jog')??0)+(this.weights.get('sprint')??0);
  const rotations=model.poseArms(id,fast,{walk:this.weights.get('walk')??0,jog:this.weights.get('jog')??0});h.update();model.poseHands(a,rotations);seatTripoArms(h,id,model.seatedFit);
  const ctx={...b3HandContext(entry,time,{speaking,tone}),...(hands==='auto'?{}:{pose:hands})};
  h.hands.t=time-dt;h.hands.update(dt,ctx);
  if(!blend){for(const side of h.hands.sides){side.cur.set(side.goal);side.lag=side.lagV=0;side.tight=tightness(h.hands.targets[side.s]);side.last=null;}h.hands.apply();}
  h.char.root.updateMatrixWorld(true);h.body.skeleton.update();if(cloth){model.updateCloth(dt,dt===0&&(this.clothId!==id||this.clothTime!==time));this.clothId=id;this.clothTime=time;}return entry;
 }
 procedural(entry,time,dt,hands){
  this.pose('idle',0,0,{hands:'auto',cloth:false});
  const h=this.model.humanoid,c=h.char,n=entry.label,q=c.root.quaternion.clone();c.headNod.quaternion.identity();
  const p={char:c,object:c.root,pos:c.root.position.clone(),frame:{up:new T.Vector3(0,1,0),quaternion:(heading,out)=>out.copy(q)},vel:new T.Vector3(0,1,3),time,heading:0,onGround:false,gliding:n==='glide',onJets:n.startsWith('jet'),thrusting:false,jetFlight:{along:n==='jetFlight'?25:0,pitch:0,bank:0}};
  let mode='air';
  if(['treadWater','breaststroke','crawl'].includes(n)){
   p.swim={k:n==='treadWater'?0:1,crawl:n==='crawl'?1:0,ph:(time/2)%1,hs:2,vy:0,pitch:n==='treadWater'?.18:1.4,roll:0};swimPose(p,dt);mode='swim';
  }else{
   Player.prototype.animate.call(p,dt,3);
   const spec={frontFlip:FLIP,backFlip:BACK_FLIP,sideHop:SIDE_HOP}[n];if(spec)flipPose(c,time%spec.time,1,spec);
   if(p.gliding)mode='glide';if(p.onJets)mode='jet';
  }
  h.update();
  if(this.model.poseProceduralHands)this.model.poseProceduralHands();
  else for(const s of ['l','r']){
   const hand=h.b[`hand_${s}`],delta=hand.getWorldQuaternion(new T.Quaternion()).multiply(h.rest.get(hand).q.clone().invert()),F=h.handFrames[s];
   h.orientContact(hand,F.along,F.normal,new T.Vector3(s==='l'?1:-1,0,0).applyQuaternion(delta),new T.Vector3(0,-1,0).applyQuaternion(delta));h.shareWristRoll(s);
  }
  h.hands.update(dt,{mode,air:1,...(hands==='auto'?{}:{pose:hands})});for(const side of h.hands.sides)side.cur.set(side.goal);h.hands.apply();
  c.root.updateMatrixWorld(true);h.body.skeleton.update();this.model.updateCloth(dt,dt===0&&(this.clothId!==entry.id||this.clothTime!==time));this.clothId=entry.id;this.clothTime=time;return entry;
 }

}
