import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GuardianLegs,TurnLag} from '../temples/guardian-motion.js';
import {GUARDIAN_PLANS} from '../motion-kit/plans.js';
import {Rig,matrixTo} from '../motion-kit/rig.js';
import {aimIn} from '../motion-kit/ik.js';
import * as originalFit from './elder-v3-fit.js';
import {makeReviewInkMaterial} from './tripo-material.js';

/** Generated Elder skin, driven through the same contract as elderModel/ELDER. */
export function createElderCreature(gltf,{gameMaterial=false,fit=originalFit}={}){
 const {ELDER_BODY,ELDER_LEGS,ELDER_JAW,ELDER_JAW_AXIS,ELDER_CLOSE,ELDER_SCALE,elderPoint}=fit;
 const group=clone(gltf.scene),bones={},meshes=[];
 group.name='Elder · generated guardian';group.traverse(o=>{o.userData.noCollide=true;o.userData.dynamic=true;if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh){o.frustumCulled=false;o.material=o.material.clone();o.userData.inkLine=.45;o.userData.inkTint=.67;o.userData.inkShade={hatch:.12,shade:.25,shadeHue:.8};meshes.push(o);}});
 const body=bones.body,neck=Array.from({length:4},(_,i)=>bones[`neck${i}`]),head=bones.head,jaw=bones.jaw,wings=[0,1].map(i=>Array.from({length:4},(_,j)=>bones[`wing${i}_${j}`]));
 if(!body||neck.some(b=>!b)||wings.flat().some(b=>!b)||!jaw)throw new Error('Incomplete Elder skeleton');
 const tellRig=new T.Group();group.add(tellRig);tellRig.add(body);
 const debugMat=new T.MeshBasicMaterial({visible:false});
 const plan={...GUARDIAN_PLANS.elder,gait:{...GUARDIAN_PLANS.elder.gait,arc:'flowing',drift:.22,reach:.4,height:.08,stepTime:[.4,.62]},body:{...GUARDIAN_PLANS.elder.body,bob:.012,sway:.12,tilt:.06,spring:{f:1.8,z:.9,r:0},height:{f:2,z:.9,r:0}}};
 const kit=new GuardianLegs({plan,group,body,seed:83,legs:ELDER_LEGS.map((L,i)=>{const h=elderPoint(L.hip),k=elderPoint(L.knee),f=elderPoint(L.foot),a=f.clone().add(new T.Vector3(0,L.ankle*ELDER_SCALE,0)),v=a.clone().sub(h),pole=k.clone().sub(h).addScaledVector(v,-k.clone().sub(h).dot(v)/v.lengthSq()).normalize();return {hip:h.clone().sub(ELDER_BODY),foot:f,lenA:h.distanceTo(k),lenB:k.distanceTo(a),pole:fit.ELDER_POLES?new T.Vector3(...fit.ELDER_POLES[i]):pole,ankle:L.ankle*ELDER_SCALE,radius:.04,mats:{joint:debugMat}};})});
 for(const L of kit.legs){const list=[];L.root.traverse(o=>{if(o.isMesh)list.push(o);});for(const o of list){o.geometry.dispose();o.removeFromParent();}}debugMat.dispose();
 const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()})),originals=meshes.map(m=>m.material),lag=new TurnLag(.8,.85),matrix=new T.Matrix4(),scale=new T.Vector3(),tmp=new T.Vector3();
 // Shortest-arc +Y aiming is singular near a downward leg. Calibrate a full
 // bend-plane frame against each exported segment's rest rotation instead.
 const frame=new T.Object3D(),hip=new T.Vector3(),knee=new T.Vector3(),end=new T.Vector3(),pole=new T.Vector3(),bodyQ=new T.Quaternion();
 const legFrames=ELDER_LEGS.map((L,i)=>{
  const h=elderPoint(L.hip),k=elderPoint(L.knee),a=elderPoint(L.foot).add(new T.Vector3(0,L.ankle*ELDER_SCALE,0));
  return [[h,k,'thigh'],[k,a,'shin']].map(([from,to,role])=>{
   aimIn(frame,from,to,kit.legs[i].pole);
   return frame.quaternion.clone().invert().multiply(bones[`leg${i}_${role}`].quaternion);
  });
 });
 const mouthLocal=elderPoint(fit.ELDER_MOUTH??[-.106,.571,.272]).sub(elderPoint(ELDER_JAW));
 if(gameMaterial)for(const m of meshes)m.material=makeReviewInkMaterial(m);
 const life={bob:0,pitch:0,yaw:0,roll:0};
 const pose={fold:0,raise:0,beat:0,pitch:0,lower:0,neck:0,jaw:0,lift:0,air:0};
 const M={group,body,rig:body,neck,head,jaw,wings,bones,meshes,materials:originals,kit,tellRig,pos:new T.Vector3(),heading:0,home:null,rest:null,restHeading:0,
 mouth:new T.Vector3(),mouthR:1.1,radius:3,height:7,bodyR:2.6,touchR:1,hover:3.5,floats:false,marks:{c:[0,3.6,0],r:[1.25,1.6,1.5]},pose,
 updateAnchors(){group.updateMatrixWorld(true);M.mouth.copy(jaw.localToWorld(tmp.copy(mouthLocal)));},
 part(name,out,side=1){if(name==='wings')return wings[side<0?0:1][3].getWorldPosition(out);if(name==='feet')return kit.footAt(side<0?0:1,out);if(name==='mouth')return out.copy(M.mouth);if(name==='head')return head.getWorldPosition(out);return null;},
 reset(){M.pos.set(0,0,0);M.heading=0;M.floats=false;group.position.set(0,0,0);group.rotation.set(0,0,0);tellRig.position.set(0,0,0);tellRig.rotation.set(0,0,0);tellRig.scale.setScalar(1);for(const x of rest){x.b.position.copy(x.p);x.b.quaternion.copy(x.q);}for(const k in pose)pose[k]=0;for(const k in life)life[k]=0;kit.rig=new Rig({plan,group,body,legs:kit.legs,seed:83});lag.first=true;M.updateAnchors();},
 animate(dt,t,opts){
  const {state,attack,k=0,phase=0}=opts,id=attack?.pose??attack?.id,struck=k>=1,calm=state==='resolved';M.floats=phase>=1&&(state==='fight'||state==='open');
  const want={fold:M.floats?.08:.65,raise:0,beat:M.floats?1:0,pitch:0,lower:0,neck:.05,jaw:0,lift:0,air:M.floats?1:0};
  if(state==='sleep'){Object.assign(want,{fold:1,lower:.75,neck:.8,pitch:.08});}
  else if(state==='wake'){Object.assign(want,{fold:.5,neck:.12,raise:.15});}
  else if(state==='weary'){Object.assign(want,{fold:.9,lower:1,neck:.8,pitch:.1});}
  else if(calm){Object.assign(want,{fold:.1,neck:-.08,raise:.16,beat:.15});}
  else if(state==='open'){Object.assign(want,{fold:.05,neck:-.12,raise:.3,beat:M.floats?.65:.12});}
  else if(id==='buffet'||id==='gale'||id==='feathers'){Object.assign(want,{fold:0,raise:struck?-.38:.55*Math.min(k,1),neck:struck?.12:-.12,pitch:struck?.08:-.1,beat:id==='feathers'?.8:0,jaw:.25});}
  else if(id==='stamp'){Object.assign(want,{fold:.2,raise:.25,lift:struck?0:1.1*Math.sin(Math.min(1,k)*Math.PI/2),pitch:struck?.1:-.15});}
  else if(id==='peck'){Object.assign(want,{fold:.35,neck:struck?1:-.22*Math.min(1,k),pitch:struck?.16:-.1,lower:struck?.35:0});}
  else if(id==='dive'){Object.assign(want,{fold:struck?.4:0,raise:struck?-.1:.45,lift:struck?-1:1.3*Math.min(k,1),pitch:struck?.25:-.16,neck:struck?.8:-.15,beat:struck?0:1});}
  if(opts.wingsSpread!==undefined)want.fold=1-opts.wingsSpread;
  if(opts.jawOpen!==undefined)want.jaw=opts.jawOpen;
  for(const key in pose){const rate=key==='air'?4:key==='beat'?3:key==='lift'?5:6;pose[key]+=(want[key]-pose[key])*(1-Math.exp(-dt*rate));}
  const tuck=Math.max(pose.air,Math.max(0,Math.min(1,pose.lift/1.0)));
  const groundY=opts.kit?.ground?.(M.pos.x,M.pos.y+1.5,M.pos.z);
  const clearance=Number.isFinite(groundY)?Math.max(0,M.pos.y-groundY):0;
  const air=Math.max(M.floats?1:0,tuck,Math.min(1,clearance/.4));
  const wasAir=kit.rig.air;
  kit.legs.forEach(L=>{
   // Fold the hock back and draw the feet under the belly, with body-relative
   // targets that follow banking; the kit blends out of/in to planted contacts.
   L.air.copy(L.hip.position).add(new T.Vector3(0,-.72,-.38)).sub(L.restBody).multiplyScalar(tuck);
  });
  const o=kit.update(M,dt,opts,{air});
  if(wasAir>0&&air<=.01){
   const positions=kit.legs.map((L,i)=>bones[`leg${i}_foot`].getWorldPosition(new T.Vector3()));
   kit.rig.planner.replant(positions,M.pos);kit.rig.planner.heading=M.heading;
  }
  body.position.set(o.x,ELDER_BODY.y-.38-pose.lower+pose.lift+o.y*(1-air)+Math.sin(t*1.3)*.015,o.z+(fit.ELDER_PRESERVE_BODY_OFFSET?ELDER_BODY.z:0));body.rotation.set(pose.pitch+o.pitch,o.yaw,o.roll);
  const turn=lag.update(dt,M.heading);
  // Couple the fore/aft head gesture to actual foot swings, rather than a
  // free-running walk clock. The upper neck counter-pitches to steady the gaze.
  const speed=Math.hypot(kit.rig.vel.x,kit.rig.vel.z),moving=Math.min(1,speed/.65)*(1-air);
  const swing=kit.rig.planner.feet.find(f=>!f.planted),step=swing?Math.sin(swing.t*Math.PI*2)*(1+.28*Math.sin(swing.t*Math.PI*2)):0;
  const quiet=state==='sleep'?.12:state==='weary'?.35:1,active=opts.headMotion===false?0:quiet;
  const activity=attack?.id==='peck'?.2:1;
  const targets={bob:active*activity*(moving*step*.115+Math.sin(t*1.1)*.012+air*Math.sin(t*4.3-.65)*.016),pitch:active*(Math.sin(t*.93)*.014+Math.sin(t*.41)*.008),yaw:active*(Math.sin(t*.57)*.027+Math.sin(t*.23)*.012),roll:active*Math.sin(t*.71)*.009};
  for(const key in life)life[key]+=(targets[key]-life[key])*(1-Math.exp(-dt*12));
  neck.forEach((b,i)=>b.rotation.set(pose.neck*[.44,.48,.45,.3][i]-o.pitch*.15+life.bob*[.75,.4,-.45,-.55][i],-turn*(.3+i*.08)+life.yaw*[0,.08,.12,.20][i],life.roll*[.1,.15,.2,.15][i]));
  head.rotation.set(-pose.neck*.6-pose.pitch*.4-life.bob*.15+life.pitch,life.yaw*.6,life.roll*.4);
  jaw.quaternion.setFromAxisAngle(ELDER_JAW_AXIS,ELDER_CLOSE+pose.jaw*.24);
  for(let i=0;i<2;i++){const s=i?1:-1;wings[i].forEach((b,j)=>{const flap=pose.beat*Math.sin(t*4.3-j*.5);b.rotation.set(0,s*pose.fold*(j===0?1.12:j===1?.42:j===2?.2:0),s*(j===0?pose.raise+flap*.3-pose.fold*.32:flap*.10));});}
  bones.tail0.rotation.set(-pose.pitch*.25+Math.sin(t*1.2)*.025,-turn*.15,0);bones.tail1.rotation.x=Math.sin(t*1.2-.4)*.035;
  kit.write();
  matrixTo(body,group,matrix);matrix.decompose(tmp,bodyQ,scale);
  kit.legs.forEach((L,i)=>{
   matrixTo(L.thigh,group,matrix);hip.setFromMatrixPosition(matrix);
   matrixTo(L.shin,group,matrix);knee.setFromMatrixPosition(matrix);
   matrixTo(L.foot,group,matrix);end.setFromMatrixPosition(matrix);end.y+=L.ankle;
   pole.copy(L.pole).applyQuaternion(bodyQ);
   [[hip,knee,'thigh'],[knee,end,'shin']].forEach(([from,to,role],j)=>{
    aimIn(frame,from,to,pole);const b=bones[`leg${i}_${role}`];
    b.position.copy(from);b.quaternion.copy(frame.quaternion).multiply(legFrames[i][j]);
   });
   const foot=bones[`leg${i}_foot`],shin=bones[`leg${i}_shin`];
   const restShin=rest.find(x=>x.b===shin).q;
   frame.quaternion.copy(shin.quaternion).multiply(restShin.clone().invert());
   foot.quaternion.identity().slerp(frame.quaternion,air);
   foot.position.copy(end).sub(tmp.set(0,L.ankle,0).applyQuaternion(foot.quaternion));
   // Keep the gameplay anchor on the same articulated foot as the skin.
   L.foot.position.copy(foot.position).sub(L.root.position);L.foot.quaternion.copy(foot.quaternion);
  });M.updateAnchors();
 },
 dispose(){for(const m of meshes){m.material.dispose();const original=originals[meshes.indexOf(m)];if(m.material!==original)original.dispose();}group.removeFromParent();}
 };M.updateAnchors();return M;
}

let cached;
export function loadElderV3(base=import.meta.env?.BASE_URL??'/'){
 return cached??=new GLTFLoader().loadAsync(`${base}guardians/elder-v3/model.glb`).catch(e=>{cached=null;throw e;});
}
