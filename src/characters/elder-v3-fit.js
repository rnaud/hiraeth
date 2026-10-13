// Tripo 908b4352: approved natural-wing reference, profile in Left slot.
// Source already faces +Z. No neck correction or skull rotation is applied.
import * as T from 'three';
export const ELDER_SCALE=10.5;
export const ELDER_PRESERVE_BODY_OFFSET=true;
export const ELDER_POLES=[[-.1,0,-1],[.1,0,-1]];
export const elderAlignedSource=p=>new T.Vector3(...p);
export const elderPoint=p=>elderAlignedSource(p).multiplyScalar(ELDER_SCALE);
export const ELDER_BODY=elderPoint([0,.34,-.045]);
export const ELDER_LEGS=[-1,1].map(s=>({hip:[s*.045,.283,-.05],knee:[s*.040,.176,-.07],foot:[s*.062,0,-.061],ankle:.03}));
export const ELDER_NECK=[[0,.447,.019],[0,.500,.025],[0,.55,-.003],[0,.598,-.010]];
export const ELDER_HEAD=[0,.636,.004],ELDER_JAW=[0,.608,.045],ELDER_MOUTH=[0,.581,.098];
export const ELDER_WINGS=[-1,1].map(s=>[[s*.080,.450,-.025],[s*.198,.452,-.020],[s*.324,.35,-.052],[s*.450,.21,-.095]]);
export const ELDER_JAW_AXIS=new T.Vector3(1,0,0);
export const ELDER_CLOSE=0;
export function smooth(a,b,x){const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
export function elderWeights([x,y,z],region=0){
 const w=new Map([['body',1]]);
 const overlay=(parts,amount)=>{for(const[k,v]of w)w.set(k,v*(1-amount));for(const[k,v]of parts)w.set(k,(w.get(k)||0)+amount*v);};
 const wing=smooth(.08,.16,Math.abs(x))*smooth(.10,.15,y);
 if(wing){const a=Math.abs(x),side=x<0?0:1;let j=0;const knots=[.10,.22,.34,.48];while(j<2&&a>knots[j+1])j++;const k=smooth(knots[j],knots[j+1],a);overlay([[`wing${side}_${j}`,1-k],[`wing${side}_${j+1}`,k]],wing);}
 const toes=1-smooth(.08,.12,y),width=.002+.037*smooth(.14,.22,y);
 const leg=(1-smooth(.21,.30,y))*(toes+(1-toes)*smooth(-.125,-.085,z))*(1-smooth(.085+.07*toes,.145+.07*toes,Math.abs(x)))*(1-smooth(.21,.27,y)+smooth(.21,.27,y)*smooth(0,.035,Math.abs(x)));
 if(leg){const side=smooth(-width,width,x),parts=[];for(let i=0;i<2;i++){const L=ELDER_LEGS[i],shin=1-smooth(.15,.205,y),foot=1-smooth(.035,.065,y),share=i?side:1-side;parts.push([`leg${i}_thigh`,(1-shin)*share],[`leg${i}_shin`,shin*(1-foot)*share],[`leg${i}_foot`,shin*foot*share]);}overlay(parts,leg);}
 const tail=smooth(.085,.13,y)*(1-smooth(-.12,-.075,z))*(1-smooth(.26,.34,y))*(1-smooth(.075,.14,Math.abs(x)));
 if(tail){const k=1-smooth(.225,.31,y);overlay([['tail0',1-k],['tail1',k]],tail);}
 const neck=smooth(.424,.49,y)*(1-smooth(.035,.080,Math.abs(x)));
 if(neck){const ys=[.44,.50,.55,.598,.635];let i=0;while(i<3&&y>ys[i+1])i++;const k=smooth(ys[i],ys[i+1],y);overlay([[`neck${i}`,1-k],[i===3?'head':`neck${i+1}`,k]],neck);}
 const head=Math.max(smooth(.604,.63,y),smooth(.045,.062,z)*smooth(.51,.535,y));
 if(head)overlay([['head',1]],head);
 // Keep detached toe/leg surfaces and the tail on their own chains, even where
 // their silhouettes overlap. Only the feathered attachment blends back to body.
 if(region){let parts;if(region===3)parts=[['tail1',1]];else{const i=region-1,shin=1-smooth(.15,.205,y),foot=1-smooth(.035,.065,y);parts=[[`leg${i}_thigh`,1-shin],[`leg${i}_shin`,shin*(1-foot)],[`leg${i}_foot`,shin*foot]];}overlay(parts,1-smooth(.205,.235,y));}
 const r=[...w].filter(([,v])=>v>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=r.reduce((s,[,v])=>s+v,0);return r.map(([n,v])=>[n,v/sum]);
}
export function elderRestBones(){
 const bones=[],named={};const add=(name,p,parent=null,q=null)=>{const b=new T.Bone();b.name=name;b.position.copy(p);if(parent){b.position.sub(named[parent].getWorldPosition(new T.Vector3()));named[parent].add(b);}if(q)b.quaternion.copy(q);b.updateMatrixWorld(true);bones.push(b);named[name]=b;};
 add('body',ELDER_BODY);ELDER_NECK.forEach((p,i)=>add(`neck${i}`,elderPoint(p),i?`neck${i-1}`:'body'));add('head',elderPoint(ELDER_HEAD),'neck3');add('jaw',elderPoint(ELDER_JAW),'head');
 ELDER_WINGS.forEach((chain,i)=>chain.forEach((p,j)=>add(`wing${i}_${j}`,elderPoint(p),j?`wing${i}_${j-1}`:'body')));
 add('tail0',elderPoint([0,.275,-.105]),'body');add('tail1',elderPoint([0,.165,-.14]),'tail0');
 ELDER_LEGS.forEach((L,i)=>{const a=elderPoint(L.hip),b=elderPoint(L.knee),c=elderPoint([L.foot[0],L.foot[1]+L.ankle,L.foot[2]]),up=new T.Vector3(0,1,0);add(`leg${i}_thigh`,a,null,new T.Quaternion().setFromUnitVectors(up,b.clone().sub(a).normalize()));add(`leg${i}_shin`,b,null,new T.Quaternion().setFromUnitVectors(up,c.clone().sub(b).normalize()));add(`leg${i}_foot`,elderPoint(L.foot));});
 return {bones,named};
}
