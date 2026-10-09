import * as T from 'three';
import { fitDonorToSurface } from './tripo-fit.js';

// Father H3.1 f45a1697: palms face forward, unlike the traveller's palms-down
// reference. Coordinates below are measured in the uniformly normalized mesh.
export const FATHER_DIGITS = {
  thumb: [[.718,1.463],[.738,1.485],[.745,1.510]],
  index: [[.773,1.462],[.816,1.461],[.851,1.460]],
  middle: [[.777,1.432],[.820,1.429],[.855,1.429]],
  ring: [[.767,1.408],[.808,1.396],[.842,1.389]],
  pinky: [[.758,1.390],[.788,1.374],[.815,1.367]],
};

export function fitFatherToSurface(donor, surface) {
  const report=fitDonorToSurface(donor,surface), body=donor.getObjectByName('Body'), bones=body.skeleton.bones;
  donor.updateMatrixWorld(true);
  const before=bones.map(b=>b.getWorldPosition(new T.Vector3())), target=before.map(p=>p.clone());
  // Loose coat slices include the torso: medians placed the shoulders too low
  // and asymmetrically forward. These are anatomical centres in this T-pose.
  for(const [name,y] of [['spine_01',1.06],['spine_02',1.20],['spine_03',1.36]])
    target[bones.findIndex(b=>b.name===name)].set(0,y,-.035);
  // The inherited skull pivot sat behind and above the narrow neck transition,
  // making a turn sweep the throat sideways. Fit it inside this mesh's neck.
  target[bones.findIndex(b=>b.name==='Head')].set(0,1.58,.035);
  for(const side of ['l','r']) {
    const sign=side==='l'?1:-1;
    for(const [name,x,y,z] of [['clavicle',.07,1.46,-.025],['upperarm',.205,1.445,-.012],['lowerarm',.455,1.444,-.012]]) {
      const i=bones.findIndex(b=>b.name===`${name}_${side}`);if(i>=0)target[i].set(sign*x,y,z);
    }
    const hand=bones.findIndex(b=>b.name===`hand_${side}`);
    target[hand].set(sign*.697,1.444,-.012);
    for(const [digit,points] of Object.entries(FATHER_DIGITS)) points.forEach(([x,y],j)=>{
      const index=bones.findIndex(b=>b.name===`${digit}_0${j+1}_${side}`);
      const near=surface.filter(p=>Math.abs(p.x-sign*x)<.012&&Math.abs(p.y-y)<.012);
      const zs=near.map(p=>p.z).sort((a,b)=>a-b);
      target[index].set(sign*x,y,zs.length?zs[Math.floor(zs.length/2)]:-.013);
    });
  }
  const shifts=target.map((p,i)=>p.clone().sub(before[i]));
  donor.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<p.count;i++) {
      const delta=new T.Vector3();
      for(let k=0;k<4;k++)delta.addScaledVector(shifts[j.getComponent(i,k)],w.getComponent(i,k));
      p.setXYZ(i,p.getX(i)+delta.x,p.getY(i)+delta.y,p.getZ(i)+delta.z);
    }
    mesh.geometry.computeVertexNormals();
  });
  for(let i=0;i<bones.length;i++) { bones[i].position.copy(bones[i].parent.worldToLocal(target[i].clone()));bones[i].updateMatrixWorld(true); }
  donor.updateMatrixWorld(true);body.skeleton.calculateInverses();
  donor.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.bind(body.skeleton,mesh.matrixWorld);});
  return {...report,method:'Father: surface body fit with measured forward-facing palm and digit chains',
    joints:bones.map((b,i)=>({name:b.name,fitted:target[i].toArray()}))};
}

// A continuous anatomical field for this loose coat. Painted colour thresholds
// and nearest naked-body triangles create discontinuities across lapels/sleeves.
export function fatherBodyWeights(p,skeleton) {
  const hand=fatherHandWeights(p,skeleton);if(hand)return hand;
  const ids=new Map(skeleton.bones.map((b,i)=>[b.name,i])),w=new Map();
  const add=(name,k)=>{const i=ids.get(name);w.set(i,(w.get(i)??0)+k);};
  const s=(a,b,x)=>T.MathUtils.smoothstep(x,a,b),side=p.x>0?'l':'r',ax=Math.abs(p.x);
  const arm=s(.17,.31,ax)*s(1.19,1.34,p.y);
  // Finish the skull blend below the jaw, not through the lower face. Keep
  // raised outer coat collars outside the anatomical neck's influence.
  const neckCore=1-s(.065,.115,ax);
  const chest=s(.94,1.37,p.y),neck=s(1.49,1.55,p.y)*neckCore;
  // The chin projects down/forward to y~1.575, while the rear skull sits above
  // the raised collar. A horizontal cutoff shears the chin or pulls the coat.
  const jawLine=1.635-.45*p.z;
  const head=s(Math.max(1.55,jawLine-.05),Math.max(1.568,jawLine),p.y);
  add('pelvis',(1-arm)*(1-chest));add('spine_03',(1-arm)*chest*(1-neck)*(1-head));
  add('neck_01',(1-arm)*neck*(1-head));add('Head',(1-arm)*head);
  const elbow=s(.365,.545,ax),wrist=s(.65,.715,ax);
  add(`upperarm_${side}`,arm*(1-elbow));add(`lowerarm_${side}`,arm*elbow*(1-wrist));add(`hand_${side}`,arm*wrist);
  return w;
}

// Hand weights are restricted to the closest anatomical digit, preventing
// nearest-body transfer from mixing adjacent fingers across the open gaps.
export function fatherHandWeights(point,skeleton) {
  if(Math.abs(point.x)<.71)return null;
  const side=point.x>0?'l':'r', byName=new Map(skeleton.bones.map((b,i)=>[b.name,i]));
  const palm=byName.get(`hand_${side}`), candidates=[];
  for(const digit of Object.keys(FATHER_DIGITS)) {
    const ids=[1,2,3].map(j=>byName.get(`${digit}_0${j}_${side}`));
    const pts=ids.map(i=>skeleton.bones[i].getWorldPosition(new T.Vector3()));
    const tip=pts[2].clone().add(pts[2].clone().sub(pts[1]).multiplyScalar(.55));pts.push(tip);
    for(let j=0;j<3;j++) {
      const line=new T.Line3(pts[j],pts[j+1]), t=line.closestPointToPointParameter(point,true);
      candidates.push({distance:line.at(t,new T.Vector3()).distanceTo(point),ids,j,t});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  const c=candidates[0],w=new Map(), palmBlend=T.MathUtils.smoothstep(Math.abs(point.x),.72,.778);
  const thumb=c.ids[0]===byName.get(`thumb_01_${side}`);
  const blend=thumb?T.MathUtils.smoothstep(point.y,1.46,1.49):palmBlend;
  w.set(palm,1-blend);w.set(c.ids[c.j],blend*(1-c.t));
  const next=c.ids[Math.min(c.j+1,2)];w.set(next,(w.get(next)??0)+blend*c.t);
  return w;
}
