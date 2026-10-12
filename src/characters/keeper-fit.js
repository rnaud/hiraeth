// Measured on the approved Keeper source, in Tripo's coordinates (head toward -X).
// These are this creature's landmarks, not a general six-legged auto-rigger.
import * as T from 'three';
export const KEEPER_SCALE = 8;
export const keeperPoint = ([x,y,z]) => new T.Vector3(z * KEEPER_SCALE, y * KEEPER_SCALE, -x * KEEPER_SCALE);
export const KEEPER_BODY = keeperPoint([0,.425,0]);
export const KEEPER_LEGS = [-1,1].flatMap(side => [
 {pair:0,side,hip:[-.19,.414,side*.114],knee:[-.145,.253,side*.113],foot:[-.205,0,side*.114]},
 {pair:1,side,hip:[-.032,.395,side*.102],knee:[.066,.248,side*.079],foot:[.022,0,side*.083]},
 {pair:2,side,hip:[.128,.391,side*.093],knee:[.235,.249,side*.110],foot:[.207,0,side*.124]},
]).sort((a,b)=>a.pair-b.pair||a.side-b.side);
export const KEEPER_NECK = [[-.225,.49,0],[-.285,.595,0],[-.313,.681,0],[-.308,.759,0],[-.302,.828,0]];
export const KEEPER_HEAD = [-.345,.876,0], KEEPER_JAW = [-.411,.842,0];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function segmentDistance(p,a,b){const v=new T.Vector3().subVectors(b,a),q=new T.Vector3().subVectors(p,a);const t=T.MathUtils.clamp(q.dot(v)/v.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(v,t));}
export function keeperWeights([x,y,z]) {
 const p=new T.Vector3(x,y,z), weights=new Map([['body',1]]);
 // Six separate tubes; no colour thresholds and no weight transfer across neighbouring legs.
 let best=null,dist=Infinity;
 for(let i=0;i<KEEPER_LEGS.length;i++){
  const L=KEEPER_LEGS[i];if(Math.sign(z)!==L.side)continue;
  const a=new T.Vector3(...L.hip),b=new T.Vector3(...L.knee),c=new T.Vector3(L.foot[0],.025,L.foot[2]);
  const d=Math.min(segmentDistance(p,a,b),segmentDistance(p,b,c));if(d<dist){dist=d;best=i;}
 }
 if(best!==null){const L=KEEPER_LEGS[best];const leg=(1-smooth(L.hip[1]-.035,L.hip[1]+.025,y))*(1-smooth(.043,.065,dist));
  if(leg>0){const shin=1-smooth(L.knee[1]-.035,L.knee[1]+.025,y),foot=1-smooth(.022,.055,y);
   weights.set('body',1-leg);weights.set(`leg${best}_thigh`,leg*(1-shin));weights.set(`leg${best}_shin`,leg*shin*(1-foot));weights.set(`leg${best}_foot`,leg*shin*foot);}
 }
 // Blend the base of the neck into the chest without moving the shell behind it.
 const neck=smooth(.475,.56,y)*(1-smooth(-.235,-.185,x));
 if(neck>0){for(const[k,v]of weights)weights.set(k,v*(1-neck));
  const nodes=[...KEEPER_NECK,KEEPER_HEAD];let i=0;while(i<nodes.length-2&&y>nodes[i+1][1])i++;
  const blend=smooth(nodes[i][1],nodes[i+1][1],y);const a=`neck${i}`,b=i===4?'head':`neck${i+1}`;
  weights.set(a,(weights.get(a)||0)+neck*(1-blend));weights.set(b,(weights.get(b)||0)+neck*blend);
 }
 // Head rigid above the hinge, jaw only below the actual mouth gap.
 if(y>.79&&x<-.335){const h=Math.max(smooth(.842,.871,y),smooth(.36,.395,-x)*smooth(.79,.834,y));for(const[k,v]of weights)weights.set(k,v*(1-h));weights.set('head',(weights.get('head')||0)+h);}
 if(x<-.397&&y<.844){
  // The hanging lower jaw is below .834; the upper muzzle must stay on the skull.
  const amount=(1-smooth(.834,.844,y))*smooth(.397,.418,-x);
  for(const[k,v]of weights)weights.set(k,v*(1-amount));weights.set('jaw',amount);
 }
 const sorted=[...weights].filter(([,w])=>w>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,[,w])=>s+w,0);
 return sorted.map(([name,w])=>[name,w/sum]);
}
export function keeperRestBones(){
 const bones=[],named={};
 const add=(name,point,parent=null,q=null)=>{const b=new T.Bone();b.name=name;b.position.copy(point);if(parent){b.position.sub(named[parent].getWorldPosition(new T.Vector3()));named[parent].add(b);}if(q)b.quaternion.copy(q);b.updateMatrixWorld(true);bones.push(b);named[name]=b;return b;};
 add('body',KEEPER_BODY);
 KEEPER_NECK.forEach((p,i)=>add(`neck${i}`,keeperPoint(p),i?`neck${i-1}`:'body'));
 add('head',keeperPoint(KEEPER_HEAD),'neck4');add('jaw',keeperPoint(KEEPER_JAW),'head');
 KEEPER_LEGS.forEach((L,i)=>{const a=keeperPoint(L.hip),b=keeperPoint(L.knee),c=keeperPoint([L.foot[0],.025,L.foot[2]]),up=new T.Vector3(0,1,0);
  add(`leg${i}_thigh`,a,null,new T.Quaternion().setFromUnitVectors(up,b.clone().sub(a).normalize()));
  add(`leg${i}_shin`,b,null,new T.Quaternion().setFromUnitVectors(up,c.clone().sub(b).normalize()));
  add(`leg${i}_foot`,keeperPoint(L.foot));
 });
 return {bones,named};
}
