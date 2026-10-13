import * as T from 'three';

// Measured on c8bf8b97's 1.75 m source, with open palms facing +Z.
export const B3_HEIGHT = 1.75;
export const B3_JOINTS = {
 Root:[0,0,0], pelvis:[0,.955,-.043], spine_01:[0,1.055,-.045],
 spine_02:[0,1.185,-.043], spine_03:[0,1.32,-.044],
 neck_01:[0,1.485,-.035], Head:[0,1.535,-.028],
};
const digits={
 index:[[.753,1.383,-.054],[.798,1.396,-.058],[.832,1.401,-.058]],
 middle:[[.758,1.360,-.054],[.808,1.363,-.059],[.845,1.365,-.057]],
 ring:[[.751,1.340,-.052],[.800,1.334,-.058],[.838,1.327,-.056]],
 pinky:[[.738,1.324,-.049],[.778,1.310,-.054],[.811,1.298,-.052]],
 thumb:[[.699,1.387,-.042],[.728,1.421,-.035],[.751,1.448,-.033]],
};
for(const side of ['l','r']){
 const sign=side==='l'?1:-1;
 const put=(name,p)=>B3_JOINTS[`${name}_${side}`]=[p[0]*sign,p[1],p[2]];
 Object.entries({clavicle:[.03,1.409,-.044],upperarm:[.157,1.392,-.05],lowerarm:[.425,1.360,-.054],hand:[.684,1.354,-.051],thigh:[.109,.931,-.039],calf:[.119,.488,-.022],foot:[.133,.125,-.035],ball:[.134,.044,.089]}).forEach(([n,p])=>put(n,p));
 for(const [f,points]of Object.entries(digits))points.forEach((p,i)=>put(`${f}_0${i+1}`,p));
}

export function fitTravellerB3(donor){
 donor.updateMatrixWorld(true);
 const body=donor.getObjectByName('Body'),bones=body.skeleton.bones;
 const original=bones.map(b=>b.getWorldPosition(new T.Vector3()));
 for(const b of bones){const p=B3_JOINTS[b.name];if(!p)throw new Error(`Missing B3 joint ${b.name}`);b.position.copy(b.parent.worldToLocal(new T.Vector3(...p)));b.updateMatrixWorld(true);}
 donor.updateMatrixWorld(true);body.skeleton.calculateInverses();
 donor.traverse(m=>{if(m.isSkinnedMesh)m.bind(body.skeleton,m.matrixWorld);});
 // Both normal inference and the finger driver must know this source's palm plane.
 donor.userData.palmNormal=[0,0,1];
 return {method:'Measured B3 landmarks; palm-forward digit chains',joints:bones.map((b,i)=>({name:b.name,original:original[i].toArray(),fitted:B3_JOINTS[b.name]}))};
}
const smooth=T.MathUtils.smoothstep;
const v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),d=new T.Vector3();
function segment(p,from,to){a.fromArray(from);b.fromArray(to);d.subVectors(b,a);const t=T.MathUtils.clamp(v.subVectors(p,a).dot(d)/d.lengthSq(),0,1);return {t,distance:v.copy(a).addScaledVector(d,t).distanceTo(p)};}
export function travellerB3Weights(p,skeleton){
 const side=p.x>=0?'l':'r',x=Math.abs(p.x),y=p.y;
 const sums=new Map(),put=(n,w)=>{if(w>0){const i=skeleton.bones.findIndex(b=>b.name===n);sums.set(i,(sums.get(i)??0)+w)};};
 const blend=(n,m,t)=>{put(n,1-t);put(m,t);};
 // Fingers get an exclusive chain selected in the separated distal hand. Within
 // the palm the field eases into that chain so no hard band forms at the knuckle.
 if(x>.688&&y>1.25){
  const choices=Object.keys(digits).map(f=>{
   const points=[...digits[f],digits[f][2].map((c,k)=>c+(digits[f][2][k]-digits[f][1][k])*.65)].map(q=>[q[0]*(side==='l'?1:-1),q[1],q[2]]);
   const segs=points.slice(0,3).map((q,i)=>({...segment(p,q,points[i+1]),i}));
   return {f,points,...segs.reduce((a,b)=>a.distance<b.distance?a:b)};
  }).sort((a,b)=>a.distance-b.distance);
  // Blend only in the web. Separated fingers must not follow their neighbors.
  // Keep each phalanx on its own joint until the next knuckle, not halfway
  // along the bone (which made every finger bend like a rubber hose).
  const distal=Math.max(smooth(x,.77,.80),smooth(y,1.405,1.43));
  const sigma=T.MathUtils.lerp(.006,.0006,distal),weights=choices.slice(0,2).map(c=>Math.exp(-(c.distance-choices[0].distance)/sigma)),total=weights[0]+weights[1];
  choices.slice(0,2).forEach((c,n)=>{
   const base=c.points[0],amount=weights[n]/total;
   const k=c.f==='thumb'?smooth(y,1.376,1.408):smooth(x,Math.abs(base[0])-.022,Math.abs(base[0])+.014);
   put(`hand_${side}`,amount*(1-k));
   const i=c.i,t=smooth(c.t,.72,1);
   put(`${c.f}_0${i+1}_${side}`,amount*k*(i===2?1:1-t));if(i<2)put(`${c.f}_0${i+2}_${side}`,amount*k*t);
  });
  return sums;
 }
 // Continuous torso field, also used on the fused shirt/trouser seam.
 const spine=[['pelvis',.96],['spine_01',1.09],['spine_02',1.24],['spine_03',1.38],['neck_01',1.505],['Head',1.58]];
 // Keep the chest/collar on the ribcage. A height-only neck blend bent the
 // whole upper shirt with the bowed head and flattened it in sad idles.
 if(y>=1.38&&y<1.58){
  const neck=smooth(y,1.44,1.505)*(1-smooth(Math.hypot(p.x,p.z+.035),.06,.105));
  const head=smooth(y,1.505,1.58);
  put('spine_03',(1-neck)*(1-head));put('neck_01',neck*(1-head));put('Head',head);
 }else if(y>=.985){
  const upper=spine.findIndex((q,i)=>i>0&&y<q[1]);
  if(upper<0)put('Head',1);else blend(spine[upper-1][0],spine[upper][0],smooth(y,spine[upper-1][1],spine[upper][1]));
 }else{
  const pelvis=Math.max(smooth(y,.86,.96),(1-smooth(x,.03,.12))*smooth(y,.67,.88)),knee=1-smooth(y,.43,.55),ankle=1-smooth(y,.105,.18),left=smooth(p.x,-.055,.055);
  put('pelvis',pelvis);for(const [s,amount]of [['l',left],['r',1-left]]){put(`thigh_${s}`,amount*(1-pelvis)*(1-knee));put(`calf_${s}`,amount*(1-pelvis)*knee*(1-ankle));put(`foot_${s}`,amount*(1-pelvis)*knee*ankle)}
 }
 const shoulder=smooth(x,.135,.225)*smooth(y,1.20,1.34);
 if(shoulder>0){
  for(const [i,w]of sums)sums.set(i,w*(1-shoulder));
  const elbow=smooth(x,.370,.476),wrist=smooth(x,.628,.683);
  put(`upperarm_${side}`,shoulder*(1-elbow));put(`lowerarm_${side}`,shoulder*elbow*(1-wrist));put(`hand_${side}`,shoulder*elbow*wrist);
 }
 return sums;
}
