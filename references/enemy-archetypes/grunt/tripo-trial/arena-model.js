import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {makeReviewInkMaterial} from '/src/characters/tripo-material.js';
import {makeMaterial} from '/src/materials.js';
// The grunt@desert palette's zone colours (src/enemies/skins.js), to find the procedural grunt's material for each zone.
const FLAT_PALETTE={skin:'d65a40',cloth:'c6b071',leather:'6b4630',iron:'5e5852',bone:'efe2c4',ink:'1b1414'};
const templates=new Map(),V=new T.Vector3(),Q=new T.Quaternion(),Q2=new T.Quaternion();
export async function loadTrialModel(file='tripo-rigged.glb'){
 if(templates.has(file))return templates.get(file);
 const g=await new GLTFLoader().loadAsync(new URL(file,import.meta.url).href);
 // (the flat export, flatten-tripo.mjs: one mesh a colour zone, its material the procedural grunt's own, given in attachTrial)
 g.scene.traverse(n=>{if(n.isMesh){const zone=n.material.userData?.zone;if(zone)n.userData.zone=zone;else n.material=makeReviewInkMaterial(n);n.geometry.userData.foeShared=true;n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;n.userData.dynamic=true;n.userData.noCollide=true;}});
 const box=new T.Box3().setFromObject(g.scene),s=1.3/(box.max.y-box.min.y),c=box.getCenter(new T.Vector3());g.scene.scale.multiplyScalar(s);g.scene.position.set(-c.x*s,-box.min.y*s,-c.z*s);g.scene.updateMatrixWorld(true);templates.set(file,g.scene);return g.scene;
}
export function inventory(root){const ps=new Set(),as=new Set(),gs=new Set(),ms=new Set(),ts=new Set(),ss=new Set();let triangles=0,vertices=0,draws=0,geometryBytes=0;root.traverseVisible(n=>{if(!n.isMesh||n.layers.mask===0)return;draws+=n.geometry.groups.length||1;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3*(n.isInstancedMesh?n.count:1);if(!ps.has(n.geometry.attributes.position)){ps.add(n.geometry.attributes.position);vertices+=n.geometry.attributes.position.count*(n.isInstancedMesh?n.count:1)}gs.add(n.geometry);[].concat(n.material).forEach(m=>{ms.add(m);if(m.map)ts.add(m.map);if(m.uniforms?.uMap?.value)ts.add(m.uniforms.uMap.value)});if(n.skeleton)ss.add(n.skeleton)});// (arrays counted once: the flat zones share their vertices and one index buffer)
 for(const g of gs)for(const a of [g.index,...Object.values(g.attributes)])if(a&&!as.has(a.array.buffer)){as.add(a.array.buffer);geometryBytes+=a.array.buffer.byteLength}return{triangles,vertices,draws,materials:ms.size,geometryBytes,bones:[...ss].reduce((a,s)=>a+s.bones.length,0),textures:[...ts].filter(t=>t.image).map(t=>({width:t.image.width,height:t.image.height,estimatedRGBA8MipBytes:t.image.width*t.image.height*4*4/3}))}}

// ---------------------------------------------------------------- the fitted grip (round 3, the LOD export)
// The plain retarget copies each procedural bone's world turn onto the Tripo bone, so the Tripo hands end wherever its
// own longer, differently set arms take them: the club, placed at the procedural grip, left the open hands (the recover's
// overhead) and the shoulders folded under arms raised high. Fitted: (1) each clavicle lifts with its upper arm once the
// arm rises past level (a share of the rise, as a body shrugs), so the deltoid is not crushed into the neck; (2) a
// two-bone IK puts the right palm where the procedural grip is, measured from each one's own shoulder and scaled by arm
// length, the elbow bending toward the procedural elbow; the club sits in that palm on the procedural grip's turn, the
// fingers closed round it; (3) when the procedural left hand is on the haft (two-handed moves), the Tripo left palm goes
// to the same place on the Tripo club, eased in by how close the procedural hand is to its haft.
const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),D=new T.Vector3(),E=new T.Vector3(),F=new T.Vector3(),G=new T.Vector3(),Qa=new T.Quaternion(),Qb=new T.Quaternion(),Qh=new T.Quaternion();
const wp=(o,out)=>o.getWorldPosition(out);
function setWorldQuat(b,q){b.parent.getWorldQuaternion(Qb).invert();b.quaternion.copy(Qb.multiply(q));b.updateMatrixWorld(true);}
// aim bone b so that the world direction from b to its child c becomes dir (shortest arc), its world turn otherwise kept
function aimBone(b,c,dir){wp(b,A);wp(c,B);B.sub(A).normalize();Qa.setFromUnitVectors(B,D.copy(dir).normalize());b.getWorldQuaternion(Qh);setWorldQuat(b,Qa.multiply(Qh));}
// two-bone IK: upper u, lower l, end e (the wrist); the end to `target`, the knee/elbow toward `pole`
function twoBone(u,l,e,target,pole){wp(u,A);wp(l,B);wp(e,C);const a=A.distanceTo(B),b=B.distanceTo(C);E.copy(target).sub(A);let d=E.length();d=Math.min(Math.max(d,Math.abs(a-b)+1e-4),a+b-1e-4);E.normalize();
 // the elbow: in the plane of target and pole, at the angle the law of cosines gives
 F.copy(pole).sub(A);F.addScaledVector(E,-F.dot(E));if(F.lengthSq()<1e-10)F.set(0,-1,0).addScaledVector(E,E.y);F.normalize();
 const cosA=(a*a+d*d-b*b)/(2*a*d),sinA=Math.sqrt(Math.max(0,1-cosA*cosA));G.copy(E).multiplyScalar(cosA*a).addScaledVector(F,sinA*a);// (G: shoulder → elbow)
 aimBone(u,l,G);wp(l,B);aimBone(l,e,D.copy(target).sub(B).setLength(1).multiplyScalar(1));}
export function fitArms(ctx){const {J,bones,f,club,grip,gripL,M}=ctx;const held=f.weapon!=='none'&&!f.disarmed;
 // (1) the clavicles: lift by a share of the upper arm's rise above level, in the torso's frame
 for(const s of['Left','Right']){const sh=bones[s+'Shoulder'],arm=bones[s+'Arm'],fore=bones[s+'ForeArm'];if(!sh||!arm||!fore)continue;
  wp(arm,A);wp(fore,B);B.sub(A).normalize();J.torso.getWorldQuaternion(Qh);C.set(0,1,0).applyQuaternion(Qh);const rise=Math.asin(Math.max(-1,Math.min(1,B.dot(C))));
  const lift=Math.max(0,rise-0.15)*0.45;if(lift<=0)continue;D.set(0,0,1).applyQuaternion(Qh);// (the torso's forward: the lift turns round it)
  const handW=new T.Quaternion();bones[s+'Hand'].getWorldQuaternion(handW);const armW=new T.Quaternion();arm.getWorldQuaternion(armW);const foreW=new T.Quaternion();fore.getWorldQuaternion(foreW);
  wp(sh,E);F.copy(A).sub(E);const up=Math.sign(G.copy(D).cross(F).dot(C))||1;Qa.setFromAxisAngle(D,up*lift);sh.getWorldQuaternion(Qb);setWorldQuat(sh,Qa.multiply(Qb));setWorldQuat(arm,armW);setWorldQuat(fore,foreW);setWorldQuat(bones[s+'Hand'],handW);}
 if(!held||!grip)return false;
 // (2) the right palm to the procedural grip
 const R={u:bones.RightArm,l:bones.RightForeArm,e:bones.RightHand,m:bones.RightHandMiddle1};if(!R.u||!R.l||!R.e||!R.m)return false;
 const pS=wp(J.arms[0],new T.Vector3()),pE=wp(J.elbows[0],new T.Vector3()),pH=wp(J.hands[0],new T.Vector3()),pG=wp(grip,new T.Vector3());
 const tS=wp(R.u,new T.Vector3()),tE=wp(R.l,new T.Vector3()),tH=wp(R.e,new T.Vector3()),tM=wp(R.m,new T.Vector3());
 const ratio=(tS.distanceTo(tE)+tE.distanceTo(tH))/(pS.distanceTo(pE)+pE.distanceTo(pH)||1);
 const palmOff=tM.clone().sub(tH).multiplyScalar(.55);// (the palm: a little past the wrist, toward the middle knuckle)
 const target=pG.clone().sub(pS).multiplyScalar(ratio).add(tS),pole=pE.clone().sub(pS).multiplyScalar(ratio).add(tS);
 const handW=new T.Quaternion();R.e.getWorldQuaternion(handW);
 twoBone(R.u,R.l,R.e,target.clone().sub(palmOff),pole);setWorldQuat(R.e,handW);
 wp(R.e,tH);wp(R.m,tM);const palm=tH.clone().addScaledVector(tM.sub(tH),.55);
 grip.getWorldQuaternion(Qh);M.group.worldToLocal(club.position.copy(palm));M.group.getWorldQuaternion(Qb).invert();club.quaternion.copy(Qb.multiply(Qh));club.updateMatrixWorld(true);
 // (3) the left palm onto the haft, where the procedural left hand holds its haft
 const L={u:bones.LeftArm,l:bones.LeftForeArm,e:bones.LeftHand,m:bones.LeftHandMiddle1};
 if(L.u&&L.l&&L.e&&L.m){const axisP=new T.Vector3(0,1,0).applyQuaternion(grip.getWorldQuaternion(Qa)),pL=wp(gripL??J.hands[1],new T.Vector3());
  const sAlong=pL.clone().sub(pG).dot(axisP),off=pL.clone().sub(pG).addScaledVector(axisP,-sAlong),dist=off.length();
  const w=sAlong>-.05&&sAlong<.6?Math.min(1,Math.max(0,(.16-dist)/.08)):0;ctx.twoHand=w;
  if(w>0){const axisT=new T.Vector3(0,1,0).applyQuaternion(club.getWorldQuaternion(Qa)),want=palm.clone().addScaledVector(axisT,sAlong*ratio);
   const lS=wp(L.u,new T.Vector3()),lE=wp(L.l,new T.Vector3()),lH=wp(L.e,new T.Vector3()),lM=wp(L.m,new T.Vector3()),lOff=lM.sub(lH).multiplyScalar(.55);
   const free=lH.clone(),aim=free.lerp(want.sub(lOff),w),lpole=wp(J.elbows[1],new T.Vector3()).sub(wp(J.arms[1],new T.Vector3())).multiplyScalar(ratio).add(lS);
   const lhW=new T.Quaternion();L.e.getWorldQuaternion(lhW);twoBone(L.u,L.l,L.e,aim,lpole);setWorldQuat(L.e,lhW);}}
 return true;}
export function attachTrial(f,file='tripo-rigged.glb',o={}){const fitted=o.fitted??/lod/.test(file);
 const M=f.model,J=M.joints;if(!J)return;const original=[];M.group.traverse(n=>{if(n.isMesh)original.push(n)});
 const visibility=new Map(original.map(n=>[n,n.visible]));
 const root=clone(templates.get(file)),base=root.position.clone(),bones={};root.updateMatrixWorld(true);root.traverse(n=>{if(n.isBone)bones[n.name.replace(/^mixamorig:?/,'')]=n});
 const mappings=[];const add=(name,src,child=null)=>{const b=bones[name];if(!b)return;const rest=b.getWorldQuaternion(new T.Quaternion());let align=new T.Quaternion();if(child&&bones[child]){const dir=bones[child].getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();align.setFromUnitVectors(dir,new T.Vector3(0,-1,0));}mappings.push({b,src,offset:align.multiply(rest)})};
 add('Hips',J.body);add('Spine',J.torso);add('Spine1',J.torso);add('Spine2',J.torso);add('Neck',J.head);add('Head',J.head);
 for(const [s,i]of[['Left',1],['Right',0]]){add(s+'Shoulder',J.torso);add(s+'Arm',J.arms[i],s+'ForeArm');add(s+'ForeArm',J.elbows[i],s+'Hand');add(s+'Hand',J.hands[i],s+'HandMiddle1');add(s+'UpLeg',J.legs[i],s+'Leg');add(s+'Leg',J.knees[i],s+'Foot');add(s+'Foot',J.feet[i]);}
 // Parent-before-child is required because target local quaternions undo the parent's current world pose.
 const order=[];root.traverse(n=>{const m=mappings.find(m=>m.b===n);if(m)order.push(m)});
 const fingerRest=[];root.traverse(n=>{if(n.isBone&&/Hand(Index|Middle|Ring|Pinky|Thumb)/.test(n.name))fingerRest.push([n,n.quaternion.clone()])});
 // Flat zones: the procedural grunt's materials, found by their palette colour (skins.js grunt.desert); the eyes its own
 // flashing one (monster.js gruntModel's eyeMat), so the wind-up's orange and the stun's blue show on the Tripo face too.
 const flat=[];root.traverse(n=>{if(n.isMesh&&n.userData.zone)flat.push(n)});
 if(flat.length){const byHex=new Map();for(const n of original)if(n.isSkinnedMesh&&n.material.uniforms?.uColor)byHex.set(n.material.uniforms.uColor.value.getHexString(),n.material);
  for(const n of flat){const m=n.userData.zone==='eye'?M.eyeMat:byHex.get(FLAT_PALETTE[n.userData.zone]);if(!m)throw Error('no procedural material for zone '+n.userData.zone);n.material=m;if(n.userData.zone==='eye')n.castShadow=false}}
 // (the zones share one set of vertices: one skeleton for them all, so its joints go up once a frame, and one body box)
 const boxed=new Set();let skeleton=null;root.traverse(n=>{if(!n.isSkinnedMesh||!flat.length)return;if(skeleton){n.skeleton.dispose();n.bind(skeleton,n.bindMatrix)}else skeleton=n.skeleton});
 root.traverse(n=>{if(!n.isSkinnedMesh)return;if(boxed.has(n.geometry.attributes.position)){n.userData.boneBoxes=null;return}boxed.add(n.geometry.attributes.position);const local=n.skeleton.bones.map(()=>new T.Box3()),pos=n.geometry.attributes.position,W=n.geometry.attributes.skinWeight,I=n.geometry.attributes.skinIndex;for(let i=0;i<pos.count;i++){for(let k=0;k<4;k++){if(W.getComponent(i,k)<.15)continue;const j=I.getComponent(i,k);V.fromBufferAttribute(pos,i).applyMatrix4(n.skeleton.boneInverses[j]);local[j].expandByPoint(V)}}n.userData.boneBoxes={bones:n.skeleton.bones,local};});
 const club=new T.Group(),wood=makeMaterial({color:'#9d8a6c',key:'trial.club',figure:true});const shaft=new T.Mesh(new T.CylinderGeometry(.068,.03,.82,8,4).translate(0,.328,0),wood),cap=new T.Mesh(new T.SphereGeometry(.075,9,7).scale(1,1.4,1).translate(0,.69,0),wood);club.add(shaft,cap);club.traverse(n=>{if(n.isMesh){n.castShadow=true;n.userData.dynamic=true;n.userData.noHurt=true;n.geometry.userData.foeShared=true}});
 M.body.add(root);M.group.add(club);const grip=M.group.getObjectByName('grip'),gripL=M.group.getObjectByName('grip l'),ctx={J,bones,f,club,grip,gripL,M,twoHand:0};let active=true,disposed=false;
 const api={root,original,club,file,set(on){active=on;root.visible=club.visible=on;for(const n of original){n.visible=on?false:visibility.get(n);n.userData.noHurt=on}M._body=null;M._reach=null;},update(){if(!active)return;root.position.copy(base).add(J.body.position);M.group.updateMatrixWorld(true);for(const {b,src,offset}of order){src.getWorldQuaternion(Q);Q.multiply(offset);b.parent.getWorldQuaternion(Q2).invert();b.quaternion.copy(Q2.multiply(Q));b.updateMatrixWorld(true)}
  // A trial grip, not a hand IK solution: curl the right fingers around the club.
  for(const[b,q]of fingerRest){b.quaternion.copy(q);const curl=/Right/.test(b.name)?(f.weapon!=='none'&&!f.disarmed?(fitted?1.05:.65):0):(fitted?(ctx.twoHand??0)*1.05:0);if(curl>0){b.parent.getWorldQuaternion(Q2).invert();V.set(/Thumb/.test(b.name)?1:0,/Thumb/.test(b.name)?0:1,0).applyQuaternion(Q2);b.quaternion.premultiply(Q.setFromAxisAngle(V,curl));b.updateMatrixWorld(true)}}
  club.visible=f.weapon!=='none'&&!f.disarmed&&active;const hand=bones.RightHand;if(fitted&&fitArms(ctx)){}else if(grip&&hand){hand.getWorldPosition(V);M.group.worldToLocal(V);club.position.copy(V);grip.getWorldQuaternion(Q);M.group.getWorldQuaternion(Q2).invert();club.quaternion.copy(Q2.multiply(Q));}root.updateMatrixWorld(true);
 },dispose(){if(disposed)return;disposed=true;active=false;root.traverse(n=>n.skeleton?.dispose());club.traverse(n=>n.geometry?.dispose());root.removeFromParent();club.removeFromParent();}};
 const disposeBase=M.dispose;M.dispose=()=>{api.dispose();disposeBase?.()};api.set(true);f.tripoTrial=api;return api;
}
