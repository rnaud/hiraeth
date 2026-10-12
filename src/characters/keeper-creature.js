import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GuardianLegs,TurnLag} from '../temples/guardian-motion.js';
import {GUARDIAN_PLANS} from '../motion-kit/plans.js';
import {Rig,matrixTo} from '../motion-kit/rig.js';
import {KEEPER_BODY,KEEPER_LEGS,KEEPER_JAW,keeperPoint} from './keeper-fit.js';
import {makeReviewInkMaterial} from './tripo-material.js';

/** One approved mesh on the existing guardian motion kit. Source stays untouched; each instance owns its bones. */
export function createKeeperCreature(gltf,{gameMaterial=false}={}) {
 const group=clone(gltf.scene),bones={},meshes=[];
 group.name='Cistern-Keeper · generated mesh';group.traverse(o=>{o.userData.noCollide=true;o.userData.dynamic=true;if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh){o.frustumCulled=false;o.material=o.material.clone();meshes.push(o);}});
 const body=bones.body,neck=Array.from({length:5},(_,i)=>bones[`neck${i}`]),head=bones.head,jaw=bones.jaw;
 if(!body||neck.some(x=>!x)||!head||!jaw)throw new Error('Keeper custom skeleton is missing required joints');
 // Only the body and its neck go in the encounter's tell frame. Feet stay planted outside it.
 const tellRig=new T.Group();tellRig.name='tell rig';group.add(tellRig);tellRig.add(body);
 const debugMat=new T.MeshBasicMaterial({visible:false});
 const plan={...GUARDIAN_PLANS.keeper,gait:{...GUARDIAN_PLANS.keeper.gait,gait:'independent',arc:'flowing',duty:.78,drift:.15,reach:.34,height:.055,stepTime:[.36,.5]},body:{...GUARDIAN_PLANS.keeper.body,bob:.008,spring:{f:1.8,z:.9,r:0},height:{f:2.2,z:.85,r:0}},poses:{...GUARDIAN_PLANS.keeper.poses,coil:{...GUARDIAN_PLANS.keeper.poses.coil,spread:1.06},'coil:stamp':{...GUARDIAN_PLANS.keeper.poses['coil:stamp'],spread:1.04},'coil:charge':{...GUARDIAN_PLANS.keeper.poses['coil:charge'],spread:1.06}}};
 const kit=new GuardianLegs({plan,group,body,seed:71,legs:KEEPER_LEGS.map(L=>{
  const h=keeperPoint(L.hip),k=keeperPoint(L.knee),f=keeperPoint(L.foot),a=f.clone().setY(.2);
  const along=a.clone().sub(h),pole=k.clone().sub(h).addScaledVector(along,-k.clone().sub(h).dot(along)/along.lengthSq()).normalize();
  return {hip:h.clone().sub(KEEPER_BODY),foot:f,lenA:h.distanceTo(k),lenB:k.distanceTo(a),pole,ankle:.2,radius:.04,mats:{joint:debugMat}};
 })});
 for(const L of kit.legs){const remove=[];L.root.traverse(o=>{if(o.isMesh)remove.push(o);});for(const o of remove){o.geometry.dispose();o.removeFromParent();}}
 debugMat.dispose();
 const lag=new TurnLag(.9,.5),tmp=new T.Vector3(),scale=new T.Vector3(),matrix=new T.Matrix4(),mouthLocal=keeperPoint([-.455,.837,0]).sub(keeperPoint(KEEPER_JAW));
 const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
 const originals=meshes.map(m=>m.material);if(gameMaterial)for(const m of meshes)m.material=makeReviewInkMaterial(m);
 const M={group,body,neck,head,jaw,kit,tellRig,bones,meshes,materials:originals,pos:new T.Vector3(),heading:0,home:null,rest:null,restHeading:0,
  mouth:new T.Vector3(),mouthR:.85,radius:2.9,height:4.4,marks:{c:[0,3.8,0],r:[1.45,1.1,2.4]},rise:1,open:0,rear:0,low:0,sink:0,sweep:0,
  reset(){
   Object.assign(M,{rise:1,open:0,rear:0,low:0,sink:0,sweep:0,heading:0});M.pos.set(0,0,0);group.position.set(0,0,0);group.rotation.set(0,0,0);
   tellRig.position.set(0,0,0);tellRig.rotation.set(0,0,0);tellRig.scale.setScalar(1);
   for(const x of rest){x.b.position.copy(x.p);x.b.quaternion.copy(x.q);x.b.scale.copy(x.s);}
   jaw.rotation.x=-1.04;
   kit.rig=new Rig({plan,group,body,legs:kit.legs,seed:71});lag.first=true;M.updateAnchors();
  },
  part(name,out,side=1){if(name==='feet')return kit.footAt(side>0?1:0,out);if(name==='head')return head.getWorldPosition(out);return null;},
  updateAnchors(){group.updateMatrixWorld(true);M.mouth.copy(jaw.localToWorld(tmp.copy(mouthLocal)));},
  animate(dt,t,opts){
   const {state,attack,k=0,meter=0}=opts;const id=attack?.pose??attack?.id,side=attack?.side??1;
   const ease=(v,w,r)=>v+(w-v)*(1-Math.exp(-dt*r)),sleep=state==='sleep',weary=state==='weary'||state==='resolved';
   M.rise=ease(M.rise,sleep?0:state==='wake'?.85:weary?.35:1,state==='wake'?.8:2);
   M.open=ease(M.open,opts.jawOpen??(state==='open'?1:id==='spit'?Math.min(1,k*1.4):id==='sweep'&&k>.6?.65:0),6);
   M.rear=ease(M.rear,id==='stamp'&&k<1?k:0,id==='stamp'&&k>=1?20:4);
   M.low=ease(M.low,state==='open'||weary||id==='sweep'||id==='charge'?1:sleep?1.15:id==='spit'?-.2*Math.min(1,k):0,3);
   M.sink=ease(M.sink,id==='burrow'&&k<1?Math.min(1,k*1.6):0,id==='burrow'&&k>=1?9:2.5);
   kit.legs.forEach((L,i)=>{L.lift=i<2?M.rear:0;L.air.set(0,M.rear*.7,M.rear*.5);});
   const o=kit.update(M,dt,opts,{air:M.sink>.02?1+M.sink:0});
   body.position.set(o.x,T.MathUtils.lerp(1.35,KEEPER_BODY.y-.20,M.rise)+Math.sin(t*(sleep||weary?.9:1.6))*.035-M.sink*4.5+o.y,o.z);
   body.rotation.set(-M.rear*.28+o.pitch,o.yaw,o.roll);
   M.sweep=ease(M.sweep,id==='sweep'?side*Math.sin(Math.min(1,k)*Math.PI*2.2)*(k>=1?.15:.5):0,7);
   const turn=lag.update(dt,M.heading),sway=Math.sin(t*.7)*.03+M.sweep-turn*.6;
   const low=[.65,.45,.35,.22,.12];neck.forEach((b,i)=>{b.rotation.set(low[i]*M.low+(i===0?M.rear*.25-o.pitch*.6:0),sway*(.25+i*.06),0);});
   head.rotation.x=-1.05*M.low-o.pitch*.4;
   // The reference mouth is open. Closing pivots only the fitted lower-jaw region.
   jaw.rotation.x=-1.04*(1-M.open)+(state==='open'?Math.sin(t*7)*.025:0);
   kit.write();
   kit.legs.forEach((L,i)=>{for(const [role,obj]of [['thigh',L.thigh],['shin',L.shin],['foot',L.foot]]){matrixTo(obj,group,matrix);matrix.decompose(bones[`leg${i}_${role}`].position,bones[`leg${i}_${role}`].quaternion,scale);}});
   M.updateAnchors();
  },
  dispose(){for(const m of meshes){m.material.dispose();if(m.material!==originals[meshes.indexOf(m)])originals[meshes.indexOf(m)].dispose();}group.removeFromParent();}
 };
 M.updateAnchors();return M;
}
