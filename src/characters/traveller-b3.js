import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadBody,makeBody} from '../makehuman/body.js';
import {Humanoid} from '../humanoid.js';
import {HAND_POSES} from '../hands.js';
import {fitTravellerB3,travellerB3Weights,armsOffTorso} from './traveller-b3-fit.js';
import {makePortraitHead,wearPortraitHeadFace,PORTRAIT_HEAD} from './portrait-head.js';
import {makeReviewInkMaterial} from './tripo-material.js';
import {compactGeometry,makeTripoClothSteps} from './tripo-cloth.js';
import {loadClothInk} from './traveller-cloth-ink.js';
import {relaxWalkArms,relaxWalkHands} from './tripo-walk.js';
import {runSteps} from '../load-steps.js';

export const B3_HEAD_FIT={...PORTRAIT_HEAD,scale:.280,offset:[-.001,1.487,-.006],neck:[1.450,1.523],neckFlare:0};

export async function loadTravellerB3(base='/'){
 const folder=`${base}characters/traveller-b3/`,portrait=`${base}characters/traveller-v1/head-v3/`;
 const json=async (name,at=folder)=>{const r=await fetch(at+name);if(!r.ok)throw new Error(`B3 ${name}: HTTP ${r.status}`);return r.json()};
 const [gltf,data,report,head,hairInk,faceInk,colors,headColors]=await Promise.all([
  new GLTFLoader().loadAsync(folder+'model.glb'),loadBody(base),json('rig.json'),
  new GLTFLoader().loadAsync(portrait+'model.glb'),loadClothInk(portrait+'hair-ink.png'),loadClothInk(portrait+'face-ink.png',2),json('colors.json'),json('colors.json',portrait),
 ]);return {gltf,data,report,head,hairInk,faceInk,colors,headColors};
}

/** Shared fitted body; the review uses CPU cloth for surface measurements. */
export function createTravellerB3(char,assets,options){return runSteps(createTravellerB3Steps(char,assets,options))}
export function* createTravellerB3Steps(char,{gltf,data,report,head:headAsset,hairInk,faceInk,colors},options={offload:null,gpu:false,useWorker:false}){
 const template=makeBody(data,report.params,{fresh:true});fitTravellerB3(template);yield;
 const root=char.root,position=root.position.clone(),rotation=root.quaternion.clone(),scale=root.scale.clone();
 root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);root.updateMatrixWorld(true);
 try{
  const humanoid=new Humanoid(template,char,'m');humanoid.ownOutfit=true;humanoid.hingeElbows=true;humanoid._plan=null;
  root.traverse(o=>{if(o.isMesh)o.visible=false});
  const skins=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o)});if(skins.length!==1||colors?.length!==skins[0].geometry.attributes.position.count)throw new Error('B3 needs its matching skinned source and colours');
  const source=skins[0],mesh=new T.SkinnedMesh(source.geometry.clone(),source.material.clone());
  mesh.name='TravellerB3Body';mesh.frustumCulled=false;humanoid.body.parent.add(mesh);mesh.bind(humanoid.body.skeleton,humanoid.body.bindMatrix);armsOffTorso(mesh.geometry,mesh.skeleton);
  humanoid.body.skeleton.pose();root.updateMatrixWorld(true);
  const cloth=yield* makeTripoClothSteps(mesh,colors,{...options,fit:{
   top:1.20,bottom:.825,freeHeight:.18,preservePinNormals:true,detailCollisions:false,
   growMask:2,maskBottom:.80,maskWidth:.25,width:[.20,.22],depth:[.13,.15],
   retainTrousers:true,underlayer:{cut:.68,inset:.012,hipY:.965,waistY:1.035,rx:.155,rz:.085,centerZ:-.015,fabric:0xded2b5},repairTop:1.035,
   innerShirt:{bottom:.92,top:1.34,rx:.155,rz:.100,centerZ:-.006,closed:true},
   hipX:.105,kneeX:.115,legZ:-.015,thighRadius:.108,
   weights(part){const g=part.geometry,p=g.attributes.position;for(let i=0;i<p.count;i++){
    const best=[...travellerB3Weights(new T.Vector3().fromBufferAttribute(p,i),part.skeleton)].sort((a,b)=>b[1]-a[1]).slice(0,4),total=best.reduce((n,v)=>n+v[1],0);
    for(let k=0;k<4;k++){g.attributes.skinIndex.setComponent(i,k,best[k]?.[0]??0);g.attributes.skinWeight.setComponent(i,k,(best[k]?.[1]??0)/total)}
   }}
  }});
  cloth.garment.name='TravellerB3Overshirt';cloth.underlayer.name='TravellerB3Trousers';cloth.innerShirt.name='TravellerB3InnerShirt';
  // (never a surface for a splat to paint (src/splat-decal.js DrawnSurfaces): the engines' offloaded overshirt is a plain mesh,
  // not a skinned one, and its 3 600 triangles filled a splat's gather by his feet, the ground left out: issue #459)
  for(const m of [cloth.garment,cloth.underlayer,cloth.innerShirt])if(m)m.userData.noSplat=true;
  yield;
  if(headAsset){
   // The source neck/face starts above the scarf. Keep the collar and remove
   // the old head before fitting the independently approved portrait asset.
   // The raised rear collar reaches above 1.495 m; leave its full rim and
   // a short tucked skin overlap rather than slicing through the fabric.
   const g=mesh.geometry,p=g.attributes.position,indices=[];
   // Blend the original collar lining under the portrait neck. Removing it
   // leaves holes inside the scarf; its top must tuck under the new skin.
   const oldNeck=i=>{const rgb=colors?.[i];return rgb&&p.getY(i)>1.44&&Math.abs(p.getX(i))<.077&&((rgb[1]/rgb[0]<.85&&rgb[1]/rgb[0]>.70&&rgb[1]/rgb[2]>1.17)||(p.getY(i)>1.493&&p.getZ(i)<-.035&&rgb[1]/rgb[0]>.85))};
   const mask=new Float32Array(p.count);
   for(let i=0;i<p.count;i++)if(oldNeck(i)){
    mask[i]=1;const k=.45*T.MathUtils.smoothstep(p.getY(i),1.46,1.495);
    p.setX(i,p.getX(i)*(1-k));p.setZ(i,-.02+(p.getZ(i)+.02)*(1-k));
   }
   g.setAttribute('b3NeckSkin',new T.Float32BufferAttribute(mask,1));
   for(let i=0;i<g.index.count;i+=3){const tri=[0,1,2].map(k=>g.index.getX(i+k));if(tri.every(k=>p.getY(k)<1.515))indices.push(...tri)}
   g.setIndex(indices);mesh.geometry=compactGeometry(g,[...new Set(indices)]);g.dispose();
  }
  for(const part of [mesh,cloth.garment,cloth.underlayer,cloth.innerShirt])part.userData.inkShade={hatch:.2};fitB3NeckMaterial(mesh.material);
  const head=headAsset?makePortraitHead(headAsset,mesh,B3_HEAD_FIT):null;
  yield;
  const standardMaterials=new Map();
  for(const part of [mesh,head,cloth.garment,cloth.underlayer,cloth.innerShirt].filter(Boolean)){standardMaterials.set(part,part.material);part.material=makeReviewInkMaterial(part,{lining:part===cloth.garment})}
  fitB3NeckMaterial(mesh.material);
  cloth.gpuMaterial(cloth.garment.material);
  if(cloth.shadow)humanoid.noShadow.push(cloth.garment);
  if(head)humanoid.drawnFace=wearPortraitHeadFace(head,hairInk,faceInk);
  // This source's thumb opens in the palm plane. The shared poses were
  // authored for the donor's opposed thumb: their negative roll/in values
  // must turn toward this palm and index finger, not away from them.
  for(const side of humanoid.hands.sides)for(const joint of side.thumb){
   joint.roll.negate();joint.in?.negate();
   const b=joint.b,next=b.children.find(o=>o.isBone),R=humanoid.rest;
   const direction=next?R.get(next).p.clone().sub(R.get(b).p):R.get(b).p.clone().sub(R.get(b.parent).p);
   joint.bend.crossVectors(direction,side.normal).applyQuaternion(R.get(b).q.clone().invert()).normalize();
  }
  humanoid.hands.reach.thumb=.65;
  // The generated hand is already fanned in its rest geometry. A more even
  // resting curl avoids a straight index paired with hooked little fingers.
  humanoid.hands.poses={...HAND_POSES,relaxed:Float32Array.from(
   [18,28,14,20,30,15,24,34,17,28,38,19,0,-45,-60,28],v=>v*Math.PI/180),
   talk:Float32Array.from([6,12,6,9,15,8,12,18,9,15,22,11,1,-40,-32,20],v=>v*Math.PI/180),
   limp:Float32Array.from([22,36,18,28,42,22,34,50,26,40,56,30,1,-45,-60,28],v=>v*Math.PI/180)};
  humanoid.hands.seed=0;
  humanoid.hands.apply();
  return {humanoid,mesh,head,cloth,standardMaterials,clothEnabled:true,
   // Rest ahead of the long lap panels on this shorter, narrower body.
   seatedFit:{along:.72,lift:.175,outward:.025},
   updateCloth(dt,reset=false){root.updateMatrixWorld(true);if(reset)cloth.update(0,'rest',false);return cloth.update(dt,'game',this.clothEnabled)},
   poseArms(motion,jogWeight=motion==='jog'?1:0,style={walk:motion==='walk'?1:0,jog:motion==='jog'?1:0}){
    // The library neck line leans much farther than this compact body's neck.
    // Reduce only its forward pitch; keep the skull's existing world-facing
    // direction and all the clip's torso motion, nods and side-to-side motion.
    if(jogWeight>0){
     root.updateMatrixWorld(true);
     const skull=char.headNod.getWorldQuaternion(new T.Quaternion());
     const rootQ=root.getWorldQuaternion(new T.Quaternion());
     const neckQ=char.head.getWorldQuaternion(new T.Quaternion());
     const up=new T.Vector3(0,1,0).applyQuaternion(neckQ).applyQuaternion(rootQ.clone().invert());
     const pitch=Math.max(0,Math.atan2(up.z,up.y));
     neckQ.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0).applyQuaternion(rootQ),-pitch*.55*jogWeight));
     char.head.quaternion.copy(char.head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(neckQ));
     char.head.updateMatrixWorld(true);
     char.headNod.quaternion.copy(neckQ.clone().invert().multiply(skull));
     char.headNod.updateMatrixWorld(true);
    }
    // Keep this correction proportional to the blended locomotion state.
    const walk=style.walk>0?relaxWalkArms(char,'walk',true,{minimum:22,maximum:8,outward:18,weight:style.walk}):[];
    const jog=style.jog>0?relaxWalkArms(char,'jog',true,{minimum:38,outward:28,weight:style.jog}):[];
    return walk.length||jog.length?[0,1].map(i=>(jog[i]??new T.Quaternion()).clone().multiply(walk[i]??new T.Quaternion())):[];
   },
   poseProceduralHands(){
    for(const side of ['l','r']){
     const hand=humanoid.b[`hand_${side}`],delta=hand.getWorldQuaternion(new T.Quaternion()).multiply(humanoid.rest.get(hand).q.clone().invert()),frame=humanoid.handFrames[side];
     humanoid.orientContact(hand,frame.along,frame.normal,new T.Vector3(side==='l'?1:-1,0,0).applyQuaternion(delta),new T.Vector3(0,-1,0).applyQuaternion(delta));
     humanoid.shareWristRoll(side);
    }
   },
   poseHands(animator,rotations=[]){
    const rootQ=root.getWorldQuaternion(new T.Quaternion());
    for(const s of ['r','l']){
     const q=animator.bone(`hand_${s}`).getWorldQuaternion(new T.Quaternion()).premultiply(rootQ);
     const from=humanoid.handFrames[s],to=animator.handFrames[s];
     humanoid.orientContact(humanoid.b[`hand_${s}`],from.along,from.normal,to.along.clone().applyQuaternion(q),to.normal.clone().applyQuaternion(q));
    }
    relaxWalkHands(humanoid,rotations);
    // Distribute the final anatomical rotation once, after all wrist changes.
    for(const s of ['r','l'])humanoid.shareWristRoll(s);
   },
  };
 }finally{root.position.copy(position);root.quaternion.copy(rotation);root.scale.copy(scale);root.updateMatrixWorld(true)}
}

/** Keep the tucked collar lining the same skin colour as the approved portrait. */
export function fitB3NeckMaterial(material){
 const inject=(vertex,fragment,ink)=>{
  vertex=vertex.replace('void main()', 'attribute float b3NeckSkin; varying float vB3NeckSkin; void main()').replace('#include <begin_vertex>','#include <begin_vertex>\nvB3NeckSkin=b3NeckSkin;');
  if(ink)vertex=vertex.replace('vTextureUV = uv;','vTextureUV = uv; vB3NeckSkin=b3NeckSkin;');
  fragment='varying float vB3NeckSkin;\n'+fragment;
  const marker=ink?'albedo=mix(albedo*12.92,1.055*pow(max(albedo,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),albedo));':'#include <map_fragment>';
  const skin=ink?[.79,.525,.37]:new T.Color().setRGB(.79,.525,.37,T.SRGBColorSpace).toArray();
  const name=ink?'albedo':'diffuseColor.rgb';
  fragment=fragment.replace(marker,`${marker}\n${name}=mix(${name},vec3(${skin.join(',')}),vB3NeckSkin);`);
  return {vertexShader:vertex,fragmentShader:fragment};
 };
 if(material.isShaderMaterial)Object.assign(material,inject(material.vertexShader,material.fragmentShader,true));
 else{material.onBeforeCompile=shader=>Object.assign(shader,inject(shader.vertexShader,shader.fragmentShader,false));material.customProgramCacheKey=()=> 'b3-neck-skin';}
 return material;
}
