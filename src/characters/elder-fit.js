// Landmarks measured on Tripo job 83a6d028. Source is in metres with +Z forward.
import * as T from 'three';
export const ELDER_SCALE=10.7;
export const elderPoint=p=>new T.Vector3(...p).multiplyScalar(ELDER_SCALE);
export const ELDER_BODY=elderPoint([0,.33,.015]);
export const ELDER_LEGS=[
 {hip:[-.049,.267,.019],knee:[-.049,.177,-.019],foot:[-.103,.031,.116],ankle:.024},
 {hip:[.061,.264,.030],knee:[.071,.178,.012],foot:[.084,0,.118],ankle:.022},
];
export const ELDER_NECK=[[0,.421,.08],[-.002,.481,.125],[-.006,.534,.16],[-.014,.583,.175]];
export const ELDER_HEAD=[-.026,.616,.187],ELDER_JAW=[-.049,.595,.213];
export const ELDER_WINGS=[-1,1].map(s=>[[s*.075,.425,.045],[s*.207,.453,-.016],[s*.32,.388,-.08],[s*.405,.302,-.133]]);
export const ELDER_JAW_AXIS=new T.Vector3(.82,0,.57).normalize();
export const ELDER_CLOSE=-.055;
export const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function elderWeights([x,y,z]){
 const w=new Map([['body',1]]);
 const overlay=(parts,amount)=>{for(const[k,v]of w)w.set(k,v*(1-amount));for(const[k,v]of parts)w.set(k,(w.get(k)||0)+amount*v);};
 // Wings separate laterally from the torso; the body/neck and lower legs remain fixed.
 const wing=smooth(.075,.16,Math.abs(x))*smooth(.13,.20,y)*(1-smooth(.515,.535,y));
 if(wing){const a=Math.abs(x),side=x<0?0:1;let j=0;const knots=[.10,.22,.34,.46];while(j<2&&a>knots[j+1])j++;const k=smooth(knots[j],knots[j+1],a);overlay([[`wing${side}_${j}`,1-k],[`wing${side}_${j+1}`,k]],wing);}
 // Leg islands sit in front of the tail. Blend only near their attachment to the belly.
 const point=new T.Vector3(x,y,z);
 const distanceToSegment=(a,b)=>{a=new T.Vector3(...a);b=new T.Vector3(...b);const v=b.sub(a),t=T.MathUtils.clamp(point.clone().sub(a).dot(v)/v.lengthSq(),0,1);return point.distanceTo(a.addScaledVector(v,t));};
 const Lnear=ELDER_LEGS[x<0?0:1],distance=Math.min(distanceToSegment(Lnear.hip,Lnear.knee),distanceToSegment(Lnear.knee,Lnear.foot));
 const tube=1-smooth(.012,.07,distance),toeRegion=1-smooth(.10,.145,y);
 const leg=(1-smooth(.205,.29,y))*smooth(-.07,-.005,z)*(1-smooth(.14,.20,Math.abs(x)))*(toeRegion+(1-toeRegion)*tube*smooth(.005,.032,Math.abs(x)));
 if(leg){const i=x<0?0:1,L=ELDER_LEGS[i],shin=1-smooth(L.knee[1]-.028,L.knee[1]+.026,y),foot=1-smooth(L.foot[1]+.024,L.foot[1]+.05,y);overlay([[`leg${i}_thigh`,1-shin],[`leg${i}_shin`,shin*(1-foot)],[`leg${i}_foot`,shin*foot]],leg);}
 const tail=(1-smooth(-.12,-.035,z))*(1-smooth(.24,.33,y))*(1-smooth(.16,.23,Math.abs(x)));
 if(tail){const k=1-smooth(-.23,-.10,z);overlay([['tail0',1-k],['tail1',k]],tail);}
 const widen=smooth(.46,.53,y);
 const neck=smooth(.416,.465,y)*(1-smooth(.045+.045*widen,.105+.035*widen,Math.abs(x)));
 if(neck){const ys=[.425,.481,.534,.583,.616];let i=0;while(i<3&&y>ys[i+1])i++;const k=smooth(ys[i],ys[i+1],y);overlay([[`neck${i}`,1-k],[i===3?'head':`neck${i+1}`,k]],neck);}
 const head=smooth(.575,.605,y)*smooth(.12,.19,z);
 if(head)overlay([['head',1]],head);
 // Both beak halves are on the skull, then only the lower half follows the hinge.
 const beak=smooth(.214,.235,z)*smooth(.56-.6*(z-.22),.575-.6*(z-.22),y);
 if(beak){overlay([['head',1]],beak);const seam=.604-.61*(z-.20);const jaw=beak*smooth(.22,.245,z)*(1-smooth(seam-.002,seam+.001,y));if(jaw)overlay([['jaw',1]],jaw);}
 const r=[...w].filter(([,v])=>v>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=r.reduce((s,[,v])=>s+v,0);return r.map(([n,v])=>[n,v/sum]);
}
export function elderRestBones(){
 const bones=[],named={};const add=(name,p,parent=null,q=null)=>{const b=new T.Bone();b.name=name;b.position.copy(p);if(parent){b.position.sub(named[parent].getWorldPosition(new T.Vector3()));named[parent].add(b);}if(q)b.quaternion.copy(q);b.updateMatrixWorld(true);bones.push(b);named[name]=b;};
 add('body',ELDER_BODY);ELDER_NECK.forEach((p,i)=>add(`neck${i}`,elderPoint(p),i?`neck${i-1}`:'body'));add('head',elderPoint(ELDER_HEAD),'neck3');add('jaw',elderPoint(ELDER_JAW),'head');
 ELDER_WINGS.forEach((chain,i)=>chain.forEach((p,j)=>add(`wing${i}_${j}`,elderPoint(p),j?`wing${i}_${j-1}`:'body')));
 add('tail0',elderPoint([0,.27,-.06]),'body');add('tail1',elderPoint([0,.19,-.17]),'tail0');
 ELDER_LEGS.forEach((L,i)=>{const a=elderPoint(L.hip),b=elderPoint(L.knee),c=elderPoint([L.foot[0],L.foot[1]+L.ankle,L.foot[2]]),up=new T.Vector3(0,1,0);add(`leg${i}_thigh`,a,null,new T.Quaternion().setFromUnitVectors(up,b.clone().sub(a).normalize()));add(`leg${i}_shin`,b,null,new T.Quaternion().setFromUnitVectors(up,c.clone().sub(b).normalize()));add(`leg${i}_foot`,elderPoint(L.foot));});
 return {bones,named};
}
