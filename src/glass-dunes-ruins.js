import * as THREE from 'three';
import { box, ribbonWall } from './glass-dunes-architecture.js';

/** Broken masonry with actual open arches/windows and a torn, uneven skyline. */
export function ruinedFacade(kit,M,{x,y,z,w,h,depth=1.2,yaw=0,seed=0,door=true,grand=false}){
  const sh=new THREE.Shape(),dw=grand?Math.min(10,w*.28):1.4,dh=grand?Math.min(24,h*.52):3.1;
  sh.moveTo(-w/2,0);
  if(door){sh.lineTo(-dw/2,0);sh.lineTo(-dw/2,dh-dw/2);sh.absarc(0,dh-dw/2,dw/2,Math.PI,0,true);sh.lineTo(dw/2,0);}
  sh.lineTo(w/2,0);
  // Broad missing pieces and worn shoulders, rather than evenly serrated battlements.
  const n=40,top=[];
  for(let i=0;i<=n;i++){
    const t=i/n,notch=Math.exp(-(((t-(.2+(seed%4)*.17))/.12)**2));
    top.push(h*(.86+.045*Math.sin(t*8+seed)-.23*notch)+Math.min(.32,h*.025)*Math.sin(t*31+seed));
  }
  for(let i=n;i>=0;i--)sh.lineTo((i/n-.5)*w,top[i]);sh.closePath();
  const spacing=grand?10:3.5,ww=grand?2.1:.65,wh=grand?4.8:1.3;
  for(let yy=grand?8:4.1;yy<h*.68;yy+=spacing)for(const sx of [-1,1]){
    if((Math.round(yy)+seed+sx)%5===0)continue;
    const cx=sx*w*.29,p=new THREE.Path();p.moveTo(cx-ww/2,yy);p.lineTo(cx-ww/2,yy+wh);p.lineTo(cx+ww/2,yy+wh+.1);p.lineTo(cx+ww/2,yy);p.closePath();sh.holes.push(p);
  }
  const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSize:grand?.28:.13,bevelThickness:grand?.25:.12,bevelSegments:2,curveSegments:14}).translate(0,0,-depth/2).rotateY(yaw).translate(x,y,z);
  kit.add(M.stone,g);
  // Isolated surviving scallops, with missing runs and broken ends.
  if(!grand)for(const [a,b] of [[3,10],[28,35]]){
    const pts=[];for(let i=a;i<=b;i++){const u=(i/n-.5)*w;pts.push([x+u*Math.cos(yaw),y+top[i]-.15,z-u*Math.sin(yaw)]);}
    ribbonWall(kit,M.stone,pts,{width:depth*.9,height:.18,scallop:.25});
  }
}

/** Empty shells and broken balcony remnants replace the pearl city's intact houses. */
export function ruinedHouse(kit,M,{x,z,y=0,w,d,h,seed=0}){
  ruinedFacade(kit,M,{x,z:z+d/2,y,w,h,seed});
  ruinedFacade(kit,M,{x,z:z-d/2,y,w,h:h*(seed%2?.73:.91),seed:seed+3,yaw:Math.PI,door:false});
  for(const side of [-1,1])ruinedFacade(kit,M,{x:x+side*w/2,z,y,w:d,h:h*(side<0?1:.78),yaw:side*Math.PI/2,seed:seed+side+5,door:false});
  if(seed%2===0){
    box(kit,M.trim,x+w*.18,y+h*.47,z+d/2+.6,w*.37,.4,1.5);
    box(kit,M.stone,x+w*.33,y+h*.47+1.5,z+d/2+.75,.66,3,1.25);   // (its sides off the balcony's ends: issue #498)
  }
  // Fallen fragments stay within the shell, so the adjacent walking lanes remain clear.
  for(let i=0;i<5;i++){
    const g=new THREE.DodecahedronGeometry(.3+(i%3)*.22,0).scale(1.6,.6,.9).rotateY(i+seed).translate(x+(i-2)*w*.12,y+.24,z+(i%2-.5)*d*.48);
    kit.add(M.trim,g);
  }
}
