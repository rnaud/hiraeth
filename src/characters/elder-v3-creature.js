import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {skinColours} from './skin-colours.js';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {GuardianLegs,TurnLag} from '../temples/guardian-motion.js';
import {GUARDIAN_PLANS} from '../motion-kit/plans.js';
import {Rig,matrixTo} from '../motion-kit/rig.js';
import {aimIn} from '../motion-kit/ik.js';
import {SecondOrder} from '../motion-kit/spring.js';
import {SkinnedLod,skinnedLods} from '../skinned-lod.js';
import * as originalFit from './elder-v3-fit.js';
import {makeReviewInkMaterial} from './tripo-material.js';

/**
 * Her own poses (issues #319, #237): each move's wind-up (`wind`, reached by 80 % of it and held) and its blow
 * (`strike`, reached `ELDER_RAMP` s after it leaves her), over her guard. Keys: fold (wings folded back, 1 shut),
 * raise (the shoulders up), sweep (the wings forward), beat (wingbeats), gust (their strength), quiver (a shiver of the
 * outer feathers), pitch (the body tipped forward), tip (the body over her feet, the head carried with it), lower (the
 * breast down, m), neck (her neck bowed), reach (stretched forward, the head kept level), head (the skull pitched down),
 * jaw (the bill open), lift (the body up, m), stamp (her left foot raised), tail (the tail up).
 *
 * The peck's blow stretches her neck out and down and tips her over her feet, the skull lifted against it, so the beak
 * comes down 1.1 m up, 3.5 m ahead of her, pointing 50° down at the traveller (#319: it stopped 4 m up; #237: it then
 * curled the head under her breast, the bill pointing back between her feet); its wind-up draws the neck back into an
 * S, the body reared. The stamp raises one foot
 * high over her other leg and brings it down; the buffet cups the wings forward and claps them down; the gale rears
 * back, wings high, then beats them hard through its blow; the feathers spread wide and shiver, then fling forward;
 * the dive rises, wings beating, then stoops, wings swept back, beak first.
 */
const smooth=originalFit.smooth;
export const ELDER_RAMP=.22,ELDER_FADE=.35;
export const ELDER_POSE={
 peck:{wind:{neck:-.42,reach:-.25,pitch:-.14,fold:.45,raise:.08,jaw:.12,lower:-.12},strike:{neck:.1,reach:1.5,tip:1,lower:.7,pitch:.1,head:-.9,fold:.85,raise:-.05,jaw:.55,tail:.25}},
 stamp:{wind:{stamp:1,fold:.3,raise:.3,pitch:-.1,neck:-.12,tail:.3},strike:{stamp:0,lower:.28,fold:.2,raise:.42,pitch:.12,neck:.12,jaw:.3}},
 buffet:{wind:{fold:0,raise:.6,sweep:.2,pitch:-.12,neck:-.18,jaw:.2},strike:{fold:.05,raise:-.22,sweep:.38,pitch:.12,neck:.15,jaw:.35,lower:.12}},
 gale:{wind:{fold:0,raise:.78,sweep:-.18,pitch:-.2,neck:-.22,tail:.4,lower:-.15},strike:{fold:0,raise:.15,sweep:.12,beat:1,gust:1,pitch:.1,neck:.1,jaw:.4,tail:.2}},
 feathers:{wind:{fold:0,raise:.28,quiver:1,lower:-.12,neck:-.2,head:-.15,jaw:.25},strike:{fold:.05,raise:-.12,sweep:.36,pitch:.12,neck:.2,jaw:.6}},
 dive:{wind:{fold:0,raise:.45,lift:1.3,beat:1,gust:.6,pitch:-.16,neck:-.2},strike:{fold:.72,raise:.25,lift:-1,beat:0,pitch:.55,neck:.2,reach:.7,head:.15}},
};
/** The fight's links and their moves: each poses as its own (the fight hands a link over as `move`). */
const MOVE_POSE={peck2:'peck',buffetEnd:'buffet',diveEnd:'dive'};
/** How fast her pose follows its target (Hz; second-order, critically damped but for the blow's slight overshoot). */
export const ELDER_SPRING={rest:1.4,wind:2.4,strike:4,strikeZ:.7,air:.9};
/** Her breath, a period (s) and a depth per state; her wings settle (a ruffle) every `ruffle` s at rest. */
const BREATH={sleep:[4.2,1.4],weary:[1.15,2.2],open:[1.8,1.3],fight:[3,1],resolved:[3.4,1],wake:[2.4,1.2]};
const RUFFLE=6.7;
/** How a fold shares out along each wing (rad at fold 1, shoulder to tip): more at the elbow and wrist, less at the
 shoulder, as a bird folds (the shoulder alone took 1.12 and crushed the skin over it, #237). */
export const ELDER_FOLD=[.85,.62,.32,0];
/** How a nod of her head shares out over neck0-neck3 and the skull: the skull alone tore the throat 60 cm open, #237. */
export const ELDER_NOD=[0,.15,.3,.35,.2];
const POSE_KEYS=['fold','raise','sweep','beat','gust','quiver','pitch','tip','lower','neck','reach','head','jaw','lift','stamp','tail','air'];
/** What she does with no move: her guard, aloft or afoot, and each state's own. t: how long she has been in it (s). */
function restPose(state,floats,t){
 const w={fold:floats?.08:.65,raise:0,sweep:0,beat:floats?1:0,gust:0,quiver:0,pitch:0,tip:0,lower:0,neck:.05,reach:0,head:0,jaw:0,lift:0,stamp:0,tail:0,air:floats?1:0};
 if(state==='sleep')Object.assign(w,{fold:1,lower:.75,neck:.8,head:1.1,pitch:.08});   // (head: the bill down with the neck, not held level against it: the throat tore, #237)
 else if(state==='wake'){
  // (up out of sleep: the head first, then a stretch of both wings, hissing, then folded to her guard: ELDER.wakeTime)
  const up=smooth(0,1.2,t),spread=smooth(.9,1.7,t)*(1-smooth(2.2,3.1,t));
  Object.assign(w,{fold:(1-smooth(2.2,3.2,t))*(1-.35*up)+.65*smooth(2.2,3.2,t),lower:.75*(1-up),neck:.8-.75*up,head:1.1*(1-up),pitch:.08*(1-up),raise:.5*spread,quiver:.8*spread,jaw:.45*spread});
  w.fold+=(.02-w.fold)*spread;
 }
 else if(state==='weary')Object.assign(w,{fold:.68,raise:.02,lower:.85,neck:.55,head:.8,pitch:.12,tail:-.1});
 else if(state==='resolved')Object.assign(w,{fold:.25,neck:-.08,raise:.14,beat:.15});
 else if(state==='open')Object.assign(w,{fold:.3,neck:-.15,head:-.3,raise:.3,beat:floats?.65:.12,quiver:.45});
 return w;
}
function lerpInto(w,P,u){if(P&&u>0)for(const k in P)w[k]+=(P[k]-w[k])*u;}
/**
 * Generated Elder skin, driven through the same contract as elderModel/ELDER. Inked as the world is (issue #319: "the
 * Elder doesn't follow the same ink outline as the rest of the world": her line was glass's hairline, 0.45, in a shade
 * of her own colour, 0.67, so she read as a pale cut-out pasted on the Aerie; now the world's weight and its black).
 */
/** How much of the fight's generic wind-up motions (boss.js poseRig: rearing, rising, swelling) her body takes: her own poses tell her moves. */
/**
 * Her levels of detail (cells of 2^min .. 2^max m: 47.8k triangles whole; 32.5k at 1/16 m, 18.4k at 1/8, 6.8k at 1/4),
 * picked as the people's are, by the Graphics preset's lodPx (High 1 px, Handheld 2: on the Retroid her coarser levels
 * come in at half the distance). Issue #237.
 */
export const ELDER_LOD={min:-4,max:-2};
export const ELDER_TELL=0;
/** The fastest she turns (rad/s, boss.js Guardian.turnTo): she spun 12 rad/s to face you as a move began, a whip of her whole body in a frame (#237). */
export const ELDER_TURN=3,ELDER_TURN_ACCEL=7;
/** How she takes off and lands as her phases change (Hz, boss.js Guardian.place: eased, about 1.5 s up). */
export const ELDER_RISE=.55;
export function createElderCreature(gltf,{gameMaterial=false,fit=originalFit,lod=false}={}){
 const {ELDER_BODY,ELDER_LEGS,ELDER_JAW,ELDER_JAW_AXIS,ELDER_CLOSE,ELDER_SCALE,elderPoint}=fit;
 const group=clone(gltf.scene),bones={},meshes=[];
 group.name='Elder · generated guardian';group.traverse(o=>{o.userData.noCollide=true;o.userData.dynamic=true;if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh){o.frustumCulled=false;o.material=o.material.clone();o.userData.inkShade={hatch:.12,shade:.25,shadeHue:.8};meshes.push(o);}});
 const body=bones.body,neck=Array.from({length:4},(_,i)=>bones[`neck${i}`]),head=bones.head,jaw=bones.jaw,wings=[0,1].map(i=>Array.from({length:4},(_,j)=>bones[`wing${i}_${j}`]));
 if(!body||neck.some(b=>!b)||wings.flat().some(b=>!b)||!jaw)throw new Error('Incomplete Elder skeleton');
 const tellRig=new T.Group();group.add(tellRig);tellRig.add(body);
 const debugMat=new T.MeshBasicMaterial({visible:false});
 const plan={...GUARDIAN_PLANS.elder,gait:{...GUARDIAN_PLANS.elder.gait,arc:'flowing',drift:.22,reach:.4,height:.08,stepTime:[.4,.62]},body:{...GUARDIAN_PLANS.elder.body,bob:.012,sway:.12,tilt:.06,spring:{f:1.8,z:.9,r:0},height:{f:2,z:.9,r:0}},
  // (her own poses carry her moves, ELDER_POSE: the kit's generic strike snapped her whole body 0.4 m in a frame, #237;
  // only its wide-braced stance in a wind-up is kept)
  poses:{coil:{spread:GUARDIAN_PLANS.elder.poses.coil.spread}}};
 const kit=new GuardianLegs({plan,group,body,seed:83,legs:ELDER_LEGS.map((L,i)=>{const h=elderPoint(L.hip),k=elderPoint(L.knee),f=elderPoint(L.foot),a=f.clone().add(new T.Vector3(0,L.ankle*ELDER_SCALE,0)),v=a.clone().sub(h),pole=k.clone().sub(h).addScaledVector(v,-k.clone().sub(h).dot(v)/v.lengthSq()).normalize();return {hip:h.clone().sub(ELDER_BODY),foot:f,lenA:h.distanceTo(k),lenB:k.distanceTo(a),pole:fit.ELDER_POLES?new T.Vector3(...fit.ELDER_POLES[i]):pole,ankle:L.ankle*ELDER_SCALE,radius:.04,mats:{joint:debugMat}};})});
 for(const L of kit.legs){const list=[];L.root.traverse(o=>{if(o.isMesh)list.push(o);});for(const o of list){o.geometry.dispose();o.removeFromParent();}}debugMat.dispose();
 const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()})),originals=meshes.map(m=>m.material),lag=new TurnLag(.8,.85),matrix=new T.Matrix4(),scale=new T.Vector3(),tmp=new T.Vector3();
 // Shortest-arc +Y aiming is singular near a downward leg. Calibrate a full
 // bend-plane frame against each exported segment's rest rotation instead.
 const frame=new T.Object3D(),hip=new T.Vector3(),knee=new T.Vector3(),end=new T.Vector3(),pole=new T.Vector3(),bodyQ=new T.Quaternion(),side=new T.Vector3(),UP=new T.Vector3(0,1,0);
 // (each segment's frame turned about the leg's bend-plane normal, not toward its pole: a thigh swung back along the
 // pole, her breast lowered when worn out, flipped half a turn in a frame, #237)
 const normals=kit.legs.map(L=>L.pole.clone().cross(UP).normalize());
 const sideOf=(n,from,to)=>side.crossVectors(n,tmp.subVectors(to,from).normalize());
 const legFrames=ELDER_LEGS.map((L,i)=>{
  const h=elderPoint(L.hip),k=elderPoint(L.knee),a=elderPoint(L.foot).add(new T.Vector3(0,L.ankle*ELDER_SCALE,0));
  return [[h,k,'thigh'],[k,a,'shin']].map(([from,to,role])=>{
   aimIn(frame,from,to,sideOf(normals[i],from,to));
   return frame.quaternion.clone().invert().multiply(bones[`leg${i}_${role}`].quaternion);
  });
 });
 const mouthLocal=elderPoint(fit.ELDER_MOUTH??[-.106,.571,.272]).sub(elderPoint(ELDER_JAW));
 if(gameMaterial)for(const m of meshes)m.material=makeReviewInkMaterial(m);
 const life={bob:0,pitch:0,yaw:0,roll:0};
 // (her wingtips and feet as points of her skin, as it is drawn: the farthest vertex of each wing's last joint, the one
 // of each foot nearest where it stands; the joints themselves lay 0.43 and 0.26 m off her surface, #237. Skinned from
 // her whole mesh's own arrays, whichever level of detail is drawn.)
 const skin=meshes[0],SG=skin.geometry,SA=SG.attributes,boneOf=i=>{let b=0,w=0;for(let k=0;k<4;k++){const x=SA.skinWeight.getComponent(i,k);if(x>w){w=x;b=SA.skinIndex.getComponent(i,k);}}return skin.skeleton.bones[b].name;};
 const pick=(name,score)=>{let best=-1,bs=-Infinity;for(let i=0;i<SA.position.count;i++){if(boneOf(i)!==name)continue;const v=tmp.fromBufferAttribute(SA.position,i),x=score(v);if(x>bs){bs=x;best=i;}}return best;};
 const tips=[0,1].map(i=>pick(`wing${i}_3`,v=>Math.abs(v.x))),toes=ELDER_LEGS.map((L,i)=>{const at=elderPoint(L.foot);return pick(`leg${i}_foot`,v=>-v.distanceTo(at));});
 const sk={p:new T.Vector3(),q:new T.Vector3(),m:new T.Matrix4()};
 const skinPoint=(i,out)=>{
  const sw=SA.skinWeight,si=SA.skinIndex,S=skin.skeleton;sk.p.fromBufferAttribute(SA.position,i).applyMatrix4(skin.bindMatrix);out.set(0,0,0);
  for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(!w)continue;const b=si.getComponent(i,k);sk.m.multiplyMatrices(S.bones[b].matrixWorld,S.boneInverses[b]);out.addScaledVector(sk.q.copy(sk.p).applyMatrix4(sk.m),w);}
  return out.applyMatrix4(skin.bindMatrixInverse).applyMatrix4(skin.matrixWorld);
 };
 const pose={},springs={},clock={state:null,in:0,struck:false,since:0,wing:0},fade={cue:null,t:0,from:{},last:{}};
 const settle=()=>{const w=restPose('fight',false,0);for(const k of POSE_KEYS){pose[k]=w[k];(springs[k]??=new SecondOrder(ELDER_SPRING.rest,1,0)).reset(w[k]);}Object.assign(clock,{state:null,in:0,struck:false,since:0,wing:0});fade.cue=null;};
 settle();
 // (a raised foot, in the body's frame from where it stands: up and forward; a tucked one, from her hip: folded back under her)
 const STAMP_FOOT=new T.Vector3(0,1.3,.6),TUCK_FOOT=new T.Vector3(0,-.72,-.38);
 const M={group,body,rig:body,neck,head,jaw,wings,bones,meshes,materials:originals,kit,tellRig,pos:new T.Vector3(),heading:0,home:null,rest:null,restHeading:0,
 mouth:new T.Vector3(),mouthR:1.1,radius:3,height:7,bodyR:2.6,touchR:1,hover:3.5,floats:false,tellWeight:ELDER_TELL,turnRate:ELDER_TURN,turnAccel:ELDER_TURN_ACCEL,rises:ELDER_RISE,marks:{c:[0,3.6,0],r:[1.25,1.6,1.5]},pose,
 updateAnchors(){group.updateMatrixWorld(true);M.mouth.copy(jaw.localToWorld(tmp.copy(mouthLocal)));},
 part(name,out,side=1){if(name==='wings')return skinPoint(tips[side<0?0:1],out);if(name==='feet')return skinPoint(toes[side<0?0:1],out);if(name==='mouth')return out.copy(M.mouth);if(name==='head')return head.getWorldPosition(out);return null;},
 reset(){M.pos.set(0,0,0);M.heading=0;M.floats=false;group.position.set(0,0,0);group.rotation.set(0,0,0);tellRig.position.set(0,0,0);tellRig.rotation.set(0,0,0);tellRig.scale.setScalar(1);for(const x of rest){x.b.position.copy(x.p);x.b.quaternion.copy(x.q);}settle();for(const k in life)life[k]=0;kit.rig=new Rig({plan,group,body,legs:kit.legs,seed:83});lag.first=true;M.updateAnchors();},
 animate(dt,t,opts){
  const {state,attack,k=0,phase=0}=opts,move=attack?.move??attack?.id,id=MOVE_POSE[move]??move,struck=!!attack&&k>=1,calm=state==='resolved';M.floats=phase>=1&&(state==='fight'||state==='open');
  if(state!==clock.state){clock.state=state;clock.in=0;}clock.in+=dt;
  if(struck&&!clock.struck)clock.since=0;clock.struck=struck;if(struck)clock.since+=dt;
  const want=restPose(state,M.floats,clock.in),P=attack?ELDER_POSE[id]:null;
  // (a move: its wind-up held from 80 % of it, then its blow, ELDER_RAMP s after; back to her guard when it ends)
  if(P){lerpInto(want,P.wind,struck?1:smooth(0,.8,k));if(struck)lerpInto(want,P.strike,smooth(0,ELDER_RAMP,clock.since));
   // (the stamp's foot comes down faster and faster, onto the floor: an ease-in, not an ease-out that set it down)
   if(id==='stamp'&&struck)want.stamp=Math.max(0,1-(clock.since/ELDER_RAMP)**2);}
  // (at rest her wings settle now and then: a ruffle and a little fold)
  const quiet=!attack&&(state==='fight'||state==='resolved'),x=t%RUFFLE,ruffle=quiet&&x<.9?Math.sin(Math.PI*x/.9)**2:0;
  want.quiver+=.6*ruffle;want.fold-=.08*ruffle;
  // (a new move, a move over, a new state: her pose crossfades to its new target over ELDER_FADE s, the blow itself
  // aside, which has its ramp; a target that jumped started her whole body at speed in a frame, #237)
  const cue=`${state}|${attack?move:''}`;
  if(cue!==fade.cue){if(fade.cue!==null){Object.assign(fade.from,fade.last);fade.t=0;}else fade.t=ELDER_FADE;fade.cue=cue;}
  fade.t+=dt;const u=fade.t<ELDER_FADE&&!(struck&&clock.since>0)?smooth(0,ELDER_FADE,fade.t):1;
  if(u<1)for(const key of POSE_KEYS)want[key]=fade.from[key]+(want[key]-fade.from[key])*u;
  Object.assign(fade.last,want);
  if(opts.wingsSpread!==undefined)want.fold=1-opts.wingsSpread;
  if(opts.jawOpen!==undefined)want.jaw=opts.jawOpen;
  const f=struck?ELDER_SPRING.strike:P?ELDER_SPRING.wind:ELDER_SPRING.rest,z=struck?ELDER_SPRING.strikeZ:1;
  for(const key of POSE_KEYS){const s=springs[key],kz=key==='stamp'?1:z;if(key==='air')s.set(ELDER_SPRING.air,1,0);else if(s.f!==f||s.z!==kz)s.set(f,kz,0);pose[key]=s.update(dt,want[key]);}
  pose.air=T.MathUtils.clamp(pose.air,0,1);pose.stamp=Math.max(0,pose.stamp);
  const tuck=Math.max(pose.air,Math.max(0,Math.min(1,pose.lift/1.0)));
  const groundY=opts.kit?.ground?.(M.pos.x,M.pos.y+1.5,M.pos.z);
  const clearance=Number.isFinite(groundY)?Math.max(0,M.pos.y-groundY):0;
  // (aloft as her air eases in, not at once: her feet hung in a frame when her phase took her up, #237)
  const air=Math.max(tuck,Math.min(1,clearance/.4));
  const wasAir=kit.rig.air,lifted=pose.stamp*(1-air);
  kit.legs.forEach((L,i)=>{
   // Fold the hock back and draw the feet under the belly, with body-relative targets that follow banking; the kit
   // blends out of/in to planted contacts. Her left foot (leg 1) raised alone for the stamp, the other planted.
   L.air.copy(L.hip.position).add(TUCK_FOOT).sub(L.restBody).multiplyScalar(tuck);
   if(i===1){L.air.addScaledVector(STAMP_FOOT,lifted);L.lift=lifted;}
  });
  const o=kit.update(M,dt,opts,{air});
  if(wasAir>0&&air<=.01){
   const positions=kit.legs.map((L,i)=>bones[`leg${i}_foot`].getWorldPosition(new T.Vector3()));
   kit.rig.planner.replant(positions,M.pos);kit.rig.planner.heading=M.heading;
  }
  // (her breath: the breast rising and the feathers with it, slow asleep, fast and deep worn out; a shiver when afraid)
  const [period,depth]=BREATH[state]??BREATH.fight,breath=Math.sin(t*Math.PI*2/period)*depth,shiver=state==='open'?Math.sin(t*31)*.012:0;
  body.position.set(o.x-.22*lifted,ELDER_BODY.y-.38-pose.lower+pose.lift+o.y*(1-air)+Math.sin(t*1.3)*.015+breath*.018,o.z+(fit.ELDER_PRESERVE_BODY_OFFSET?ELDER_BODY.z:0));
  body.rotation.set(pose.pitch+pose.tip+o.pitch-breath*.008,o.yaw,o.roll+.07*lifted+shiver);
  const turn=lag.update(dt,M.heading);
  // Couple the fore/aft head gesture to actual foot swings, rather than a
  // free-running walk clock. The upper neck counter-pitches to steady the gaze.
  const speed=Math.hypot(kit.rig.vel.x,kit.rig.vel.z),moving=Math.min(1,speed/.65)*(1-air);
  const swing=kit.rig.planner.feet.find(f=>!f.planted),step=swing?Math.sin(swing.t*Math.PI*2)*(1+.28*Math.sin(swing.t*Math.PI*2)):0;
  const hush=state==='sleep'?.12:state==='weary'?.35:1,active=opts.headMotion===false?0:hush;
  const activity=id==='peck'&&attack?.2:1,glance=!attack&&state!=='sleep'&&state!=='weary'?.1*(Math.sin(t*.31)+Math.sin(t*.17+1)):0;
  const targets={bob:active*activity*(moving*step*.115+Math.sin(t*1.1)*.012+air*Math.sin(t*4.3-.65)*.016),pitch:active*(Math.sin(t*.93)*.014+Math.sin(t*.41)*.008),yaw:active*(Math.sin(t*.57)*.027+Math.sin(t*.23)*.012+glance),roll:active*Math.sin(t*.71)*.009};
  for(const key in life)life[key]+=(targets[key]-life[key])*(1-Math.exp(-dt*12));
  // (bowed: each joint forward; nodded: the head down, spread over the upper neck; reached: the lower neck forward and the upper back, the head kept level as it goes out)
  neck.forEach((b,i)=>b.rotation.set(pose.neck*[.44,.48,.45,.3][i]+pose.reach*[.62,.22,-.32,-.42][i]+pose.head*ELDER_NOD[i]-o.pitch*.15+life.bob*[.75,.4,-.45,-.55][i]+breath*.004,-turn*(.3+i*.08)+life.yaw*[0,.08,.12,.20][i],life.roll*[.1,.15,.2,.15][i]));
  head.rotation.set(-pose.neck*.6-pose.reach*.1+pose.head*ELDER_NOD[4]-pose.pitch*.4-life.bob*.15+life.pitch,life.yaw*.6,life.roll*.4);
  jaw.quaternion.setFromAxisAngle(ELDER_JAW_AXIS,ELDER_CLOSE+(pose.jaw+(state==='weary'?.1*(1+breath/2.2):0))*.24);
  // (wingbeats on a phase of their own, so a stronger beat quickens them without a jump; the outer wing folds a little
  // on the upstroke, as a bird's does)
  clock.wing+=dt*(4.3+1.4*pose.gust);
  const amp=.3+.22*pose.gust,quiv=pose.quiver*Math.sin(t*25)*.025;
  for(let i=0;i<2;i++){const s=i?1:-1;wings[i].forEach((b,j)=>{const ph=clock.wing-j*.5,flap=pose.beat*Math.sin(ph),flex=j?pose.beat*.14*Math.max(0,Math.cos(ph)):0;b.rotation.set(0,s*(pose.fold*ELDER_FOLD[j]-pose.sweep*[.55,.25,.1,0][j]+flex),s*(j===0?pose.raise+flap*amp-pose.fold*.32+breath*.012:flap*.10*(1+pose.gust)+quiv*[0,.5,1,1.4][j]));});}
  bones.tail0.rotation.set(-pose.pitch*.25+pose.tail+Math.sin(t*1.2)*.025+breath*.01,-turn*.15,0);bones.tail1.rotation.x=Math.sin(t*1.2-.4)*.035+pose.tail*.3;
  kit.write();
  matrixTo(body,group,matrix);matrix.decompose(tmp,bodyQ,scale);
  kit.legs.forEach((L,i)=>{
   matrixTo(L.thigh,group,matrix);hip.setFromMatrixPosition(matrix);
   matrixTo(L.shin,group,matrix);knee.setFromMatrixPosition(matrix);
   matrixTo(L.foot,group,matrix);end.setFromMatrixPosition(matrix);end.y+=L.ankle;
   pole.copy(normals[i]).applyQuaternion(bodyQ);
   [[hip,knee,'thigh'],[knee,end,'shin']].forEach(([from,to,role],j)=>{
    aimIn(frame,from,to,sideOf(pole,from,to));const b=bones[`leg${i}_${role}`];
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
 dispose(){if(M.lod){skinnedLods.remove(M.lod);M.lod.reset();}for(const m of meshes){m.material.dispose();const original=originals[meshes.indexOf(m)];if(m.material!==original)original.dispose();}group.removeFromParent();}
 };
 // (far off, simpler copies of her skin on the same skeleton, as the people's: src/skinned-lod.js, ELDER_LOD; the game's
 // own, registered for main.js to pick each frame; the reviews and tests draw her whole)
 if(lod)M.lod=skinnedLods.add(new SkinnedLod({model:group,char:{root:group}},ELDER_LOD));
 M.updateAnchors();return M;
}

let cached;
export function loadElderV3(base=import.meta.env?.BASE_URL??'/'){
 return cached??=new GLTFLoader().loadAsync(`${base}guardians/elder-v3/model.glb`).then((g)=>skinColours(g,`${base}guardians/elder-v3/`)).catch(e=>{cached=null;throw e;});
}
