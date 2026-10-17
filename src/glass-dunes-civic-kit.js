import * as THREE from 'three';
import { ruinedHouse } from './glass-dunes-ruins.js';
import { box, terrace, dwelling, opening, ribbonWall, arcPoints } from './glass-dunes-architecture.js';

/** A stone span with a flat walking deck and an arched, load-bearing underside. */
export function stoneBridge(kit,M,{from,to,w=3.5,drop=4,rail=.6,scallop=0}) {
  const dx=to[0]-from[0],dz=to[2]-from[2],len=Math.hypot(dx,dz),sh=new THREE.Shape();
  sh.moveTo(-len/2,0);sh.lineTo(len/2,0);
  for(let i=48;i>=0;i--){const t=i/48;sh.lineTo((t-.5)*len,-.65-drop*(t*2-1)**2);}
  sh.closePath();
  const yaw=-Math.atan2(dz,dx),cx=(from[0]+to[0])/2,cz=(from[2]+to[2])/2;
  kit.add(M.stone,new THREE.ExtrudeGeometry(sh,{depth:w,bevelEnabled:false,curveSegments:32}).translate(0,from[1],-w/2).rotateY(yaw).translate(cx,0,cz));
  const nx=-dz/len,nz=dx/len;
  for(const side of [-1,1]) ribbonWall(kit,M.stone,[from,to].map(p=>[p[0]+nx*side*(w/2-.18),p[1],p[2]+nz*side*(w/2-.18)]),{width:.38,height:rail,scallop});
  return [from,to];
}

/** The pearl city's wide, shallow galleries stand on slender flared columns. */
export function pillarGallery(kit,M,{x,y,z,rx,rz,base}) {
  terrace(kit,M.stone,{x,z,y:y-1.25,h:1.25,rx,rz});
  terrace(kit,M.trim,{x,z,y:y-1.8,h:.65,rx:rx*.92,rz:rz*.92});
  for(const [dx,dz] of [[-.57,-.15],[.53,-.1],[0,.55]]){
    const h=y-base-1.6;
    const pts=[[1.5,0],[1.25,.4],[.65,1.4],[.55,h-1.4],[1.1,h-.4],[2,h]].map(p=>new THREE.Vector2(...p));
    kit.add(M.stone,new THREE.LatheGeometry(pts,24).translate(x+dx*rx,base,z+dz*rz));
  }
  // Leave broad gaps where stairs and bridges meet the platform.
  ribbonWall(kit,M.stone,arcPoints(x,z,rx-.25,rz-.25,Math.PI*1.1,Math.PI*1.95,y,y,28),{height:.6,width:.45,scallop:.5});
}

/** A connected facade: tall walls, overhanging bays and small warm openings. */
export function streetHouse(kit,M,{x,z,y=0,w=8,d=9,h=13,color='stone',seed=0,yaw=0,pearl=false}) {
  if(pearl){ruinedHouse(kit,M,{x,z,y,w,d,h,seed});return;}
  dwelling(kit,M,{x,z,y,w,d,h,color,seed,squareness:.22});
  const pos=(u,v,along)=>[x+u*Math.cos(yaw)+along*Math.sin(yaw),y+v,z-u*Math.sin(yaw)+along*Math.cos(yaw)];
  const depth=(Math.abs(Math.sin(yaw))>.5?w:d)/2;
  const frontWidth=Math.abs(Math.sin(yaw))>.5?d:w;
  const at=(u,v,along)=>{const [xx,yy,zz]=pos(u,v,along);return{x:xx,y:yy,z:zz,yaw};};
  opening(kit,M,{...at(-frontWidth*.16,.08,depth+.08),w:1.05,h:2.8,paint:seed%4===0?'coral':'gold'});
  for(let row=0;row<Math.floor((h-2)/3.3);row++) for(const side of [-1,1]) {
    opening(kit,M,{...at(side*frontWidth*.24,3.4+row*3.15,depth*.96+.1),w:.7,h:1.25,window:true,paint:seed%3===0?'blue':'gold'});
  }
  if(seed%2===0){
    const bayY=y+h*.57,bw=frontWidth*.48;
    const [bx,,bz]=pos(frontWidth*.12,0,depth+.65);
    const g=new THREE.BoxGeometry(bw,.45,1.65).rotateY(yaw).translate(bx,bayY,bz);kit.add(M.trim,g);
    const bay=new THREE.BoxGeometry(bw,2.35,1.45).translate(0,1.3,0).rotateY(yaw).translate(bx,bayY,bz);kit.add(M[color],bay);
    opening(kit,M,{...at(frontWidth*.12,h*.57+.6,depth+1.42),w:.75,h:1.2,window:true,paint:'gold'});
    for(const u of [-bw*.37,bw*.37])kit.add(M.trim,new THREE.BoxGeometry(.22,1.3,1.1).translate(u,-.7,-.25).rotateY(yaw).translate(bx,bayY,bz));
  }
  if(pearl){
    const pts=Array.from({length:25},(_,i)=>pos(-frontWidth*.46+frontWidth*.92*i/24,h-.1,depth*.95));
    ribbonWall(kit,M.stone,pts,{height:.35,scallop:.55,width:.5});
  }else{
    box(kit,M.trim,x,y+h-.25,z,w+.14,.25,d+.14);
    // A smaller upper room offsets the silhouette rather than repeating a row of boxes.
    if(seed%3===1&&h<13.5)dwelling(kit,M,{x:x-w*.12,z:z-d*.08,y:y+h-.2,w:w*.64,d:d*.7,h:1.7,color,seed:seed+20});
  }
}
