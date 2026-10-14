import {ELDER} from '../src/temples/arzach.js';
import {windOf} from '../src/temples/boss.js';
import {smooth} from '../src/characters/elder-v3-fit.js';

// The Elder's review motions (issue #237), shared by tools/elder-review.html, the contact sheets
// (scripts/tripo/elder-sheets.mjs) and the cycle audit (scripts/tripo/elder-cycles.mjs): one frame of a motion at t s
// from its start. An attack runs as the fight runs it (src/temples/boss.js Guardian: its own wind-up, then its active
// window and recovery, `view` as the fight hands it over: id its pose, move its own id), once every CYCLE s, LEAD s in.
export const STATES=['sleep','wake','open','weary','resolved'];
export const CYCLE=6,LEAD=1;   // (an attack begins LEAD s into its cycle, from her guard)
/** An attack's beats in the review's cycle (s): its strike (the wind-up's end), the end of its blow, the end of its recovery. */
export function attackBeats(id){const a=ELDER.attacks[id];if(!a)return null;const wind=windOf(a),active=a.active??.4;return {wind,active:wind+active,end:wind+active+(a.recover??.8)};}

/**
 * model: the Elder's creature (src/characters/elder-v3-creature.js); guard: a Guardian on it (its telegraph rig and,
 * for 'encounter', its whole fight); phase: 0 ground, 1 hover, 2 final; o: headMotion, jaw / wings overrides.
 * Returns the phase shown (the take-off cycle changes it).
 */
export function driveElder({model,guard,t,dt,motion,phase=0,headMotion=true}){
 if(motion==='encounter'){if(phase>0)guard.meter=guard.floor=phase===1?.46:.76;guard.update(dt,t);return phase;}
 const state=STATES.includes(motion)?motion:'fight',beats=attackBeats(motion),c=t%CYCLE-LEAD;
 const a=beats&&c>=0&&c<beats.end?ELDER.attacks[motion]:null,attack=a?{...a,id:a.pose??motion,move:motion}:null;
 const k=beats?Math.max(0,c)/beats.wind:0;
 model.pos.set(0,0,0);model.heading=0;
 if(motion==='walk')model.pos.z=t*.9;
 if(motion==='turn'){model.heading=t*.22;model.pos.set(Math.sin(model.heading)*4,0,Math.cos(model.heading)*4);}
 const flightTime=t%12;
 phase=motion==='flightCycle'?(flightTime<6?1:0):motion==='hover'||motion==='dive'?Math.max(1,phase):phase;
 if(motion==='flightCycle')model.pos.y=3.5*smooth(0,2,flightTime)*(1-smooth(6,8,flightTime));else if(phase>0&&!STATES.includes(motion))model.pos.y=3.5;
 model.group.position.copy(model.pos);model.group.rotation.y=model.heading;
 // (the real encounter's telegraph rig in the isolated reviews too)
 guard.state=state;guard.attack=attack;guard.attackK=Math.min(k,1);guard.struck=!!attack&&k>=1;guard.poseRig(dt,t);
 model.animate(dt,t,{state,attack,k:attack?Math.min(k,1):0,headMotion,jawOpen:motion==='jawClosed'?0:motion==='jawOpen'?1:undefined,speed:motion==='walk'?.9:0,meter:state==='resolved'?1:0,phase,wingsSpread:motion==='wingsFolded'?0:motion==='wingsSpread'?1:undefined,kit:{ground:()=>0}});
 return phase;
}
