import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GuardianLegs,TurnLag} from '../temples/guardian-motion.js';
import {GUARDIAN_PLANS} from '../motion-kit/plans.js';
import {Rig} from '../motion-kit/rig.js';
import {KEEPER_BODY,KEEPER_LEGS,KEEPER_JAW,keeperPoint} from './keeper-fit.js';
import {makeReviewInkMaterial} from './tripo-material.js';
import {SkinLegs} from './creature-legs.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {glyphGeometry} from '../story/sign-text.js';
import {makeMaterial,releaseMaterial} from '../materials.js';

let cached=null;
/** The fitted Keeper skin (public/guardians/keeper-v1/model.glb), loaded once; a failed load is tried again next time. */
export function loadKeeperV1(base=import.meta.env?.BASE_URL??'/'){
 return cached??=new GLTFLoader().loadAsync(`${base}guardians/keeper-v1/model.glb`).catch(e=>{cached=null;throw e;});
}

/**
 * The calm glyphs on its shell (the old body's glow spots, src/temples/guardians.js keeperModel): the makers' sign laid on
 * the plates where a ray from above meets the bind-pose surface, carried by the body bone. One mesh, one draw.
 */
function shellGlyphs(mesh,body,material){
 const probe=new T.Mesh(mesh.geometry),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),z=new T.Vector3(0,0,1),parts=[];
 const spots=[...Array.from({length:8},(_,i)=>{const a=(i+.5)/8*Math.PI*2;return [Math.sin(a)*.62,Math.cos(a)*1.25-.25,.62];}),[0,-.25,1.05]];
 for(const [x,zz,size] of spots){
  ray.set(new T.Vector3(x,20,zz),down);const hit=ray.intersectObject(probe)[0];
  if(!hit||hit.point.y<KEEPER_BODY.y+.3)continue;
  const n=hit.face.normal.clone().normalize(),q=new T.Quaternion().setFromUnitVectors(z,n);
  // (each sign upright toward the head, +Z on the body)
  const up=new T.Vector3(0,1,0).applyQuaternion(q),want=new T.Vector3(0,0,1).addScaledVector(n,-n.z).normalize();
  const spin=Math.atan2(new T.Vector3().crossVectors(up,want).dot(n),up.dot(want));
  const g=glyphGeometry(size,.05);g.applyQuaternion(new T.Quaternion().setFromAxisAngle(n,spin).multiply(q));
  g.translate(...hit.point.clone().addScaledVector(n,.025).sub(KEEPER_BODY).toArray());parts.push(g);
 }
 const glyphs=new T.Mesh(mergeGeometries(parts),material);parts.forEach(g=>g.dispose());
 glyphs.name='calm glyphs';glyphs.userData.noCollide=true;glyphs.userData.dynamic=true;body.add(glyphs);return glyphs;
}

/**
 * The skin's walk (issues #287, #315: "the keeper movement is unnatural"). It shuffled: strides of 2.9 m skimming 0.26 m
 * over the floor at 0.75 steps a second, the shell carried dead level (a bob of 8 cm, no roll), and a quick turn dragged
 * its feet 0.2 m. Now shorter, quicker, higher steps (drift, height, stepTime: in leg lengths and s), the shell riding
 * them on softer springs (bob, the springs' damping z), rolling over the feet that carry it (`roll`, rad per m of
 * sway), and a planted foot steps again sooner after a turn (maxStance). Slow, one foot at a time; at the fight's pace
 * (fast.at m/s) the tripods.
 */
export const KEEPER_GAIT={
 gait:{gait:'independent',fast:{gait:'alternate',at:1.4},arc:'flowing',duty:.78,drift:.17,reach:.6,height:.15,stepTime:[.24,.4],maxStance:1},
 body:{bob:.03,sway:.25,spring:{f:1.8,z:.55,r:0},height:{f:2.2,z:.5,r:0}},
 roll:.3,
 // (rad/s: the fastest it turns, src/temples/boss.js Guardian.face: past this its feet could no longer step it round)
 turn:1.5,
};
/** The skin's own poses: how far the sweep bows its neck (rad at the neck's base, KEEPER_POSE.dip). */
export const KEEPER_POSE={dip:1};
let uid=0;
/** One approved mesh on the existing guardian motion kit. Source stays untouched; each instance owns its bones. */
export function createKeeperCreature(gltf,{gameMaterial=false}={}) {
 const group=clone(gltf.scene),bones={},meshes=[];
 group.name='Cistern-Keeper · generated mesh';group.traverse(o=>{o.userData.noCollide=true;o.userData.dynamic=true;if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh){o.frustumCulled=false;o.material=o.material.clone();meshes.push(o);}});
 const body=bones.body,neck=Array.from({length:5},(_,i)=>bones[`neck${i}`]),head=bones.head,jaw=bones.jaw;
 if(!body||neck.some(x=>!x)||!head||!jaw)throw new Error('Keeper custom skeleton is missing required joints');
 // Only the body and its neck go in the encounter's tell frame. Feet stay planted outside it.
 const tellRig=new T.Group();tellRig.name='tell rig';group.add(tellRig);tellRig.add(body);
 const debugMat=new T.MeshBasicMaterial({visible:false});
 const plan={...GUARDIAN_PLANS.keeper,gait:{...GUARDIAN_PLANS.keeper.gait,...KEEPER_GAIT.gait},body:{...GUARDIAN_PLANS.keeper.body,...KEEPER_GAIT.body},poses:{...GUARDIAN_PLANS.keeper.poses,coil:{...GUARDIAN_PLANS.keeper.poses.coil,spread:1.06},'coil:stamp':{...GUARDIAN_PLANS.keeper.poses['coil:stamp'],spread:1.04},'coil:charge':{...GUARDIAN_PLANS.keeper.poses['coil:charge'],spread:1.06}}};
 const kit=new GuardianLegs({plan,group,body,seed:71,legs:KEEPER_LEGS.map(L=>{
  const h=keeperPoint(L.hip),k=keeperPoint(L.knee),f=keeperPoint(L.foot),a=f.clone().setY(.2);
  const along=a.clone().sub(h),pole=k.clone().sub(h).addScaledVector(along,-k.clone().sub(h).dot(along)/along.lengthSq()).normalize();
  // (its home a quarter of the way in under the hip: the splayed rest stance left a hind foot dragged straight behind at the fight's pace)
  const home=f.clone();home.z+=(h.z-f.z)*.25;
  return {hip:h.clone().sub(KEEPER_BODY),foot:home,lenA:h.distanceTo(k),lenB:k.distanceTo(a),pole,ankle:.2,radius:.04,mats:{joint:debugMat}};
 })});
 for(const L of kit.legs){const remove=[];L.root.traverse(o=>{if(o.isMesh)remove.push(o);});for(const o of remove){o.geometry.dispose();o.removeFromParent();}}
 debugMat.dispose();
 const skinLegs=new SkinLegs({kit,bones,group,body});
 const lag=new TurnLag(.9,.5),tmp=new T.Vector3(),mouthLocal=keeperPoint([-.455,.837,0]).sub(keeperPoint(KEEPER_JAW));
 const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
 const originals=meshes.map(m=>m.material);if(gameMaterial)for(const m of meshes)m.material=makeReviewInkMaterial(m);
 const glowM=makeMaterial({color:'#70e7df',glow:.15,flat:true,key:`keeper-v1.glow.${uid++}`}),glyphs=shellGlyphs(meshes[0],body,glowM);
 const M={group,body,neck,head,jaw,kit,skinLegs,tellRig,bones,meshes,materials:originals,glowM,glyphs,pos:new T.Vector3(),heading:0,home:null,rest:null,restHeading:0,
  mouth:new T.Vector3(),mouthR:.85,radius:2.9,height:4.4,marks:{c:[0,3.8,0],r:[1.45,1.1,2.4]},shadow:{rx:1.7,rz:3.4,feet:.55},rise:1,open:0,rear:0,low:0,sink:0,sweep:0,dip:0,
  reset(){
   Object.assign(M,{rise:1,open:0,rear:0,low:0,sink:0,sweep:0,dip:0,heading:0});M.pos.set(0,0,0);group.position.set(0,0,0);group.rotation.set(0,0,0);
   tellRig.position.set(0,0,0);tellRig.rotation.set(0,0,0);tellRig.scale.setScalar(1);
   for(const x of rest){x.b.position.copy(x.p);x.b.quaternion.copy(x.q);x.b.scale.copy(x.s);}
   jaw.rotation.x=-1.04;
   kit.rig=new Rig({plan,group,body,legs:kit.legs,seed:71});lag.first=true;for(const S of skinLegs.legs)S.yaw=null;M.updateAnchors();
  },
  part(name,out,side=1){if(name==='feet')return kit.footAt(side>0?1:0,out);if(name==='head')return head.getWorldPosition(out);return null;},
  /**
   * The body a blow lands with (issue #314: its hits were floor shapes up to 13.7 m from its body), on its posed bones
   * this frame: spheres { c, r } in the world (src/temples/boss.js Guardian.contact). 'head': the jaw's tip, the head
   * and the neck's top half; 'feet': the forefeet, a stamp's splash round each; 'body': the shell, nose to tail.
   */
  hitParts(name,out=[]){
   out.length=0;const S=(c,r)=>out.push({c,r});
   if(name==='head'){S(M.mouth.clone(),.9);S(head.getWorldPosition(new T.Vector3()),1);S(neck[4].getWorldPosition(new T.Vector3()),.8);S(neck[3].getWorldPosition(new T.Vector3()),.8);S(neck[2].getWorldPosition(new T.Vector3()),.9);}
   else if(name==='feet'){for(const i of [0,1])S(bones[`leg${i}_foot`].getWorldPosition(new T.Vector3()),1.1);}
   else if(name==='body'){const c=body.getWorldPosition(new T.Vector3()),f=new T.Vector3(0,0,1).applyQuaternion(body.getWorldQuaternion(new T.Quaternion()));S(c.clone().addScaledVector(f,2.2),1.4);S(c,1.6);S(c.clone().addScaledVector(f,-2.4),1.4);}
   return out;
  },
  /** Where the lock-on aims (src/foes.js GuardianLock.aim): its open mouth, the one place water calms it. */
  lockAt(out){return out.copy(M.mouth);},
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
   body.position.set(o.x,T.MathUtils.lerp(1.35,KEEPER_BODY.y-.4,M.rise)+Math.sin(t*(sleep||weary?.9:1.6))*.035-M.sink*4.5+o.y,o.z);
   body.rotation.set(-M.rear*.28+o.pitch,o.yaw,o.roll-o.x*KEEPER_GAIT.roll);
   M.sweep=ease(M.sweep,id==='sweep'?side*Math.sin(Math.min(1,k)*Math.PI*2.2)*(k>=1?.15:.5):0,7);
   const turn=lag.update(dt,M.heading),sway=Math.sin(t*.7)*.03+M.sweep-turn*.6;
   // (the sweep's dip, issue #314: its head swung 3.5 m up, over the traveller's; now the neck's base bows through the
   // wind-up's last half and the whip, the head kept level, so the jaw sweeps at his height: KEEPER_POSE.dip)
   M.dip=ease(M.dip,id==='sweep'?KEEPER_POSE.dip*T.MathUtils.smoothstep(k,.45,.9):0,id==='sweep'?4:2.5);
   const low=[.65,.45,.35,.22,.12],dip=[.5,.3,0,0,0];neck.forEach((b,i)=>{b.rotation.set(low[i]*M.low+dip[i]*M.dip+(i===0?M.rear*.25-o.pitch*.6:0),sway*(.25+i*.06),0);});
   head.rotation.x=-1.05*M.low-.8*M.dip-o.pitch*.4;
   // The reference mouth is open. Closing pivots only the fitted lower-jaw region.
   jaw.rotation.x=-1.04*(1-M.open)+(state==='open'?Math.sin(t*7)*.025:0);
   // the glyphs on its shell: dim and flickering afraid, steady and bright as it calms
   const calm=state==='resolved'?1:meter;
   glowM.uniforms.uGlow.value=.12+.75*calm+(calm<.5?Math.max(0,Math.sin(t*9))*.08:.08*Math.sin(t*1.5));
   kit.write();skinLegs.write(M.heading,{air:M.sink>.02?1:0});
   M.updateAnchors();
  },
  dispose(){for(const m of meshes){m.material.dispose();if(m.material!==originals[meshes.indexOf(m)])originals[meshes.indexOf(m)].dispose();}glyphs.geometry.dispose();releaseMaterial(glowM);group.removeFromParent();}
 };
 M.updateAnchors();return M;
}
