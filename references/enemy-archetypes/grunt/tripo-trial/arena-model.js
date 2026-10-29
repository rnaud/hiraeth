import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {makeReviewInkMaterial} from '/src/characters/tripo-material.js';
import {makeMaterial} from '/src/materials.js';
const templates=new Map(),V=new T.Vector3(),Q=new T.Quaternion(),Q2=new T.Quaternion();
export async function loadTrialModel(file='tripo-rigged.glb'){
 if(templates.has(file))return templates.get(file);
 const g=await new GLTFLoader().loadAsync(new URL(file,import.meta.url).href);
 g.scene.traverse(n=>{if(n.isMesh){n.material=makeReviewInkMaterial(n);n.geometry.userData.foeShared=true;n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;n.userData.dynamic=true;n.userData.noCollide=true;}});
 const box=new T.Box3().setFromObject(g.scene),s=1.3/(box.max.y-box.min.y),c=box.getCenter(new T.Vector3());g.scene.scale.multiplyScalar(s);g.scene.position.set(-c.x*s,-box.min.y*s,-c.z*s);g.scene.updateMatrixWorld(true);templates.set(file,g.scene);return g.scene;
}
export function inventory(root){const gs=new Set(),ms=new Set(),ts=new Set(),ss=new Set();let triangles=0,vertices=0,draws=0,geometryBytes=0;root.traverseVisible(n=>{if(!n.isMesh||n.layers.mask===0)return;draws+=n.geometry.groups.length||1;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3*(n.isInstancedMesh?n.count:1);vertices+=n.geometry.attributes.position.count*(n.isInstancedMesh?n.count:1);gs.add(n.geometry);[].concat(n.material).forEach(m=>{ms.add(m);if(m.map)ts.add(m.map);if(m.uniforms?.uMap?.value)ts.add(m.uniforms.uMap.value)});if(n.skeleton)ss.add(n.skeleton)});for(const g of gs){geometryBytes+=g.index?.array.byteLength??0;for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength}return{triangles,vertices,draws,materials:ms.size,geometryBytes,bones:[...ss].reduce((a,s)=>a+s.bones.length,0),textures:[...ts].filter(t=>t.image).map(t=>({width:t.image.width,height:t.image.height,estimatedRGBA8MipBytes:t.image.width*t.image.height*4*4/3}))}}
export function attachTrial(f,file='tripo-rigged.glb'){
 const M=f.model,J=M.joints;if(!J)return;const original=[];M.group.traverse(n=>{if(n.isMesh)original.push(n)});
 const visibility=new Map(original.map(n=>[n,n.visible]));
 const root=clone(templates.get(file)),base=root.position.clone(),bones={};root.updateMatrixWorld(true);root.traverse(n=>{if(n.isBone)bones[n.name.replace(/^mixamorig:?/,'')]=n});
 const mappings=[];const add=(name,src,child=null)=>{const b=bones[name];if(!b)return;const rest=b.getWorldQuaternion(new T.Quaternion());let align=new T.Quaternion();if(child&&bones[child]){const dir=bones[child].getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();align.setFromUnitVectors(dir,new T.Vector3(0,-1,0));}mappings.push({b,src,offset:align.multiply(rest)})};
 add('Hips',J.body);add('Spine',J.torso);add('Spine1',J.torso);add('Spine2',J.torso);add('Neck',J.head);add('Head',J.head);
 for(const [s,i]of[['Left',1],['Right',0]]){add(s+'Shoulder',J.torso);add(s+'Arm',J.arms[i],s+'ForeArm');add(s+'ForeArm',J.elbows[i],s+'Hand');add(s+'Hand',J.hands[i],s+'HandMiddle1');add(s+'UpLeg',J.legs[i],s+'Leg');add(s+'Leg',J.knees[i],s+'Foot');add(s+'Foot',J.feet[i]);}
 // Parent-before-child is required because target local quaternions undo the parent's current world pose.
 const order=[];root.traverse(n=>{const m=mappings.find(m=>m.b===n);if(m)order.push(m)});
 const fingerRest=[];root.traverse(n=>{if(n.isBone&&/Hand(Index|Middle|Ring|Pinky|Thumb)/.test(n.name))fingerRest.push([n,n.quaternion.clone()])});
 root.traverse(n=>{if(!n.isSkinnedMesh)return;const local=n.skeleton.bones.map(()=>new T.Box3()),pos=n.geometry.attributes.position,W=n.geometry.attributes.skinWeight,I=n.geometry.attributes.skinIndex;for(let i=0;i<pos.count;i++){for(let k=0;k<4;k++){if(W.getComponent(i,k)<.15)continue;const j=I.getComponent(i,k);V.fromBufferAttribute(pos,i).applyMatrix4(n.skeleton.boneInverses[j]);local[j].expandByPoint(V)}}n.userData.boneBoxes={bones:n.skeleton.bones,local};});
 const club=new T.Group(),wood=makeMaterial({color:'#9d8a6c',key:'trial.club',figure:true});const shaft=new T.Mesh(new T.CylinderGeometry(.068,.03,.82,8,4).translate(0,.328,0),wood),cap=new T.Mesh(new T.SphereGeometry(.075,9,7).scale(1,1.4,1).translate(0,.69,0),wood);club.add(shaft,cap);club.traverse(n=>{if(n.isMesh){n.castShadow=true;n.userData.dynamic=true;n.userData.noHurt=true;n.geometry.userData.foeShared=true}});
 M.body.add(root);M.group.add(club);const grip=M.group.getObjectByName('grip');let active=true,disposed=false;
 const api={root,original,club,file,set(on){active=on;root.visible=club.visible=on;for(const n of original){n.visible=on?false:visibility.get(n);n.userData.noHurt=on}M._body=null;M._reach=null;},update(){if(!active)return;root.position.copy(base).add(J.body.position);M.group.updateMatrixWorld(true);for(const {b,src,offset}of order){src.getWorldQuaternion(Q);Q.multiply(offset);b.parent.getWorldQuaternion(Q2).invert();b.quaternion.copy(Q2.multiply(Q));b.updateMatrixWorld(true)}
  // A trial grip, not a hand IK solution: curl the right fingers around the club.
  for(const[b,q]of fingerRest){b.quaternion.copy(q);if(/Right/.test(b.name)&&f.weapon!=='none'&&!f.disarmed){b.parent.getWorldQuaternion(Q2).invert();V.set(/Thumb/.test(b.name)?1:0,/Thumb/.test(b.name)?0:1,0).applyQuaternion(Q2);b.quaternion.premultiply(Q.setFromAxisAngle(V,.65));b.updateMatrixWorld(true)}}
  club.visible=f.weapon!=='none'&&!f.disarmed&&active;const hand=bones.RightHand;if(grip&&hand){hand.getWorldPosition(V);M.group.worldToLocal(V);club.position.copy(V);grip.getWorldQuaternion(Q);M.group.getWorldQuaternion(Q2).invert();club.quaternion.copy(Q2.multiply(Q));}root.updateMatrixWorld(true);
 },dispose(){if(disposed)return;disposed=true;active=false;root.traverse(n=>n.skeleton?.dispose());club.traverse(n=>n.geometry?.dispose());root.removeFromParent();club.removeFromParent();}};
 const disposeBase=M.dispose;M.dispose=()=>{api.dispose();disposeBase?.()};api.set(true);f.tripoTrial=api;return api;
}
