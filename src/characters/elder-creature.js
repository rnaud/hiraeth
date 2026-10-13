import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GuardianLegs,TurnLag} from '../temples/guardian-motion.js';
import {GUARDIAN_PLANS} from '../motion-kit/plans.js';
import {Rig} from '../motion-kit/rig.js';
import {ELDER_BODY,ELDER_LEGS,ELDER_JAW,ELDER_JAW_AXIS,ELDER_CLOSE,ELDER_SCALE,elderPoint} from './elder-fit.js';
import {SecondOrder} from '../motion-kit/spring.js';
import {makeReviewInkMaterial} from './tripo-material.js';
import {SkinLegs} from './creature-legs.js';

/** The head's straightening turn on neck0..3 and the skull (rad, about each joint's parent's up): measured, issue #237. */
export const ELDER_STRAIGHT=[0,8,12,12,11].map(d=>d*Math.PI/180);
/** Generated Elder skin, driven through the same contract as elderModel/ELDER. */
export function createElderCreature(gltf,{gameMaterial=false}={}){
 const group=clone(gltf.scene),bones={},meshes=[];
 group.name='Elder · generated guardian';group.traverse(o=>{o.userData.noCollide=true;o.userData.dynamic=true;if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh){o.frustumCulled=false;o.material=o.material.clone();o.userData.inkLine=.45;o.userData.inkTint=.67;meshes.push(o);}});
 const body=bones.body,neck=Array.from({length:4},(_,i)=>bones[`neck${i}`]),head=bones.head,jaw=bones.jaw,wings=[0,1].map(i=>Array.from({length:4},(_,j)=>bones[`wing${i}_${j}`]));
 if(!body||neck.some(b=>!b)||wings.flat().some(b=>!b)||!jaw)throw new Error('Incomplete Elder skeleton');
 const tellRig=new T.Group();group.add(tellRig);tellRig.add(body);
 const debugMat=new T.MeshBasicMaterial({visible:false});
 const plan={...GUARDIAN_PLANS.elder,gait:{...GUARDIAN_PLANS.elder.gait,arc:'flowing',drift:.22,reach:.4,height:.08,stepTime:[.4,.62]},body:{...GUARDIAN_PLANS.elder.body,bob:.012,sway:.12,tilt:.06,spring:{f:1.8,z:.9,r:0},height:{f:2,z:.9,r:0}}};
 // The source's two legs stand differently (the left hock turned in, its foot out and raised): each leg's bend plane
 // from its own rest knee made the two legs bend in different planes and wobble (issue #237). Both bend in one mirrored
 // plane now, the mean of the two, and stand on mirrored homes; lengths stay each leg's own.
 const raw=ELDER_LEGS.map(L=>{const h=elderPoint(L.hip),k=elderPoint(L.knee),f=elderPoint(L.foot),a=f.clone().add(new T.Vector3(0,L.ankle*ELDER_SCALE,0)),v=a.clone().sub(h);return {L,h,k,f,a,side:Math.sign(h.x),pole:k.clone().sub(h).addScaledVector(v,-k.clone().sub(h).dot(v)/v.lengthSq()).normalize()};});
 const mean=(fn)=>raw.reduce((s,r)=>s+fn(r),0)/raw.length,pole=new T.Vector3(mean(r=>r.pole.x*r.side),mean(r=>r.pole.y),mean(r=>r.pole.z)),stance=[mean(r=>Math.abs(r.f.x)),mean(r=>r.f.z)];
 const kit=new GuardianLegs({plan,group,body,seed:83,legs:raw.map(({L,h,k,a,side})=>({hip:h.clone().sub(ELDER_BODY),foot:new T.Vector3(side*stance[0],0,stance[1]),lenA:h.distanceTo(k),lenB:k.distanceTo(a),pole:pole.clone().setX(pole.x*side).normalize(),ankle:L.ankle*ELDER_SCALE,radius:.04,mats:{joint:debugMat}}))});
 for(const L of kit.legs){const list=[];L.root.traverse(o=>{if(o.isMesh)list.push(o);});for(const o of list){o.geometry.dispose();o.removeFromParent();}}debugMat.dispose();
 const skinLegs=new SkinLegs({kit,bones,group,body});
 const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()})),originals=meshes.map(m=>m.material),lag=new TurnLag(.8,.85),tmp=new T.Vector3(),gaze=new SecondOrder(1.2,.8,0),ground={pos:new T.Vector3(),heading:0},yq=new T.Quaternion(),Y=new T.Vector3(0,1,0);
 const mouthLocal=elderPoint([-.106,.571,.272]).sub(elderPoint(ELDER_JAW));
 if(gameMaterial)for(const m of meshes)m.material=makeReviewInkMaterial(m);
 const pose={fold:0,raise:0,beat:0,pitch:0,lower:0,neck:0,jaw:0,lift:0,alt:0};
 const M={group,body,rig:body,neck,head,jaw,wings,bones,meshes,materials:originals,kit,skinLegs,tellRig,gaze:0,pos:new T.Vector3(),heading:0,home:null,rest:null,restHeading:0,
 mouth:new T.Vector3(),mouthR:1.1,radius:3,height:7,bodyR:2.6,touchR:1,hover:3.5,floats:false,marks:{c:[0,3.6,0],r:[1.25,1.6,1.5]},pose,
 updateAnchors(){group.updateMatrixWorld(true);M.mouth.copy(jaw.localToWorld(tmp.copy(mouthLocal)));},
 part(name,out,side=1){if(name==='wings')return wings[side<0?0:1][3].getWorldPosition(out);if(name==='feet')return kit.footAt(side<0?0:1,out);if(name==='mouth')return out.copy(M.mouth);if(name==='head')return head.getWorldPosition(out);return null;},
 reset(){M.pos.set(0,0,0);M.heading=0;M.floats=false;group.position.set(0,0,0);group.rotation.set(0,0,0);tellRig.position.set(0,0,0);tellRig.rotation.set(0,0,0);tellRig.scale.setScalar(1);for(const x of rest){x.b.position.copy(x.p);x.b.quaternion.copy(x.q);}for(const k in pose)pose[k]=0;gaze.reset(0);M.gaze=0;kit.rig=new Rig({plan,group,body,legs:kit.legs,seed:83});lag.first=true;for(const S of skinLegs.legs)S.yaw=null;M.updateAnchors();},
 animate(dt,t,opts){
  const {state,attack,k=0,phase=0}=opts,id=attack?.pose??attack?.id,struck=k>=1,calm=state==='resolved';M.floats=phase>=1&&(state==='fight'||state==='open');
  const want={fold:M.floats?.08:.65,raise:0,beat:M.floats?1:0,pitch:0,lower:0,neck:.05,jaw:0,lift:0};
  if(state==='sleep'){Object.assign(want,{fold:1,lower:.75,neck:.8,pitch:.08});}
  else if(state==='wake'){Object.assign(want,{fold:.5,neck:.12,raise:.15});}
  else if(state==='weary'){Object.assign(want,{fold:.9,lower:1,neck:1,pitch:.1});}
  else if(calm){Object.assign(want,{fold:.1,neck:-.08,raise:.16,beat:.15});}
  else if(state==='open'){Object.assign(want,{fold:.05,neck:-.12,raise:.3,beat:M.floats?.65:.12});}
  else if(id==='buffet'||id==='gale'||id==='feathers'){Object.assign(want,{fold:0,raise:struck?-.38:.55*Math.min(k,1),neck:struck?.12:-.12,pitch:struck?.08:-.1,beat:id==='feathers'?.8:0,jaw:.25});}
  else if(id==='stamp'){Object.assign(want,{fold:.2,raise:.25,lift:struck?0:1.1*Math.sin(Math.min(1,k)*Math.PI/2),pitch:struck?.1:-.15});}
  else if(id==='peck'){Object.assign(want,{fold:.35,neck:struck?1:-.22*Math.min(1,k),pitch:struck?.16:-.1,lower:struck?.35:0});}
  else if(id==='dive'){Object.assign(want,{fold:struck?.4:0,raise:struck?-.1:.45,lift:struck?-1:1.3*Math.min(k,1),pitch:struck?.25:-.16,neck:struck?.8:-.15,beat:struck?0:1});}
  if(opts.wingsSpread!==undefined)want.fold=1-opts.wingsSpread;
  if(opts.jawOpen!==undefined)want.jaw=opts.jawOpen;
  // flight (issue #237): the fight lifts her to her hover at once (boss.js place); she rises to it over a second and a
  // half, wings beating, and comes down the same way. alt 0 on the floor, 1 at her hover: her body drawn that far up from
  // where she was, her feet planted until she is clear, then folded up under her (hips, hocks and toes), and let down to
  // the floor again before she lands, where they plant under her.
  want.alt=M.floats?1:0;
  for(const key in pose){const rate=key==='beat'?3:key==='lift'?5:key==='alt'?1.6:6;pose[key]+=(want[key]-pose[key])*(1-Math.exp(-dt*rate));}
  const alt=T.MathUtils.smoothstep(pose.alt,0,1),off=(alt-(M.floats?1:0))*M.hover,rise=T.MathUtils.smoothstep(alt,.05,.35),tuck=T.MathUtils.smoothstep(alt,.3,.85);
  const air=Math.max(rise,Math.min(1,Math.max(0,pose.lift/1.0)))+tuck*.85;
  // (off the floor her feet go where they would stand under her, on the floor below: there they land)
  // (the kit stands her on the floor under her: aloft, the fight's pos is her hover, not the ground)
  ground.pos.set(M.pos.x,M.pos.y-(M.floats?M.hover:0),M.pos.z);ground.heading=M.heading;
  if(air>.01){const P=kit.rig.planner;for(const f of P.feet){P.homeOf(f,ground.pos,M.heading,f.pos);f.planted=true;f.t=0;}}
  const o=kit.update(ground,dt,opts,{air,landHome:true}),planted=1-Math.min(1,air);
  body.position.set(o.x,ELDER_BODY.y-.38-pose.lower+pose.lift+o.y*planted+off+Math.sin(t*1.3)*.015+alt*Math.sin(t*4.3-.6)*.12,o.z);body.rotation.set(pose.pitch+o.pitch,o.yaw,o.roll);
  // the head: the source's is turned 42° to her left on its neck (issue #237); a fixed turn spread up the neck and onto
  // the skull straightens it (ELDER_STRAIGHT), then she looks toward you, the last two joints carrying it
  const eye=opts.kit?.eye,look=eye&&state!=='sleep'?T.MathUtils.clamp(Math.atan2(Math.sin(Math.atan2(eye.x-M.pos.x,eye.z-M.pos.z)-M.heading),Math.cos(Math.atan2(eye.x-M.pos.x,eye.z-M.pos.z)-M.heading)),-.55,.55):0;
  M.gaze=gaze.update(dt,look);
  const turn=lag.update(dt,M.heading);neck.forEach((b,i)=>{b.rotation.set(pose.neck*[.44,.48,.45,.3][i]-o.pitch*.15,-turn*(.3+i*.08),Math.sin(t*.8-i*.3)*.006);b.quaternion.premultiply(yq.setFromAxisAngle(Y,ELDER_STRAIGHT[i]+(i===3?M.gaze*.4:0)));});
  head.rotation.set(-pose.neck*.6-pose.pitch*.4,0,0);head.quaternion.premultiply(yq.setFromAxisAngle(Y,ELDER_STRAIGHT[4]+M.gaze*.6));
  jaw.quaternion.setFromAxisAngle(ELDER_JAW_AXIS,ELDER_CLOSE+pose.jaw*.24);
  for(let i=0;i<2;i++){const s=i?1:-1;wings[i].forEach((b,j)=>{const flap=pose.beat*Math.sin(t*4.3-j*.5);b.rotation.set(0,s*pose.fold*(j===0?1.12:j===1?.42:j===2?.2:0),s*(j===0?pose.raise+flap*.3-pose.fold*.32:flap*.10));});}
  bones.tail0.rotation.set(-pose.pitch*.25+Math.sin(t*1.2)*.025,-turn*.15,0);bones.tail1.rotation.x=Math.sin(t*1.2-.4)*.035;
  kit.write();skinLegs.write(M.heading,{air,curl:tuck*1.1});M.updateAnchors();
 },
 dispose(){for(const m of meshes){m.material.dispose();const original=originals[meshes.indexOf(m)];if(m.material!==original)original.dispose();}group.removeFromParent();}
 };M.updateAnchors();return M;
}
