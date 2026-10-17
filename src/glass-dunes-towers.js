import * as THREE from 'three';
import { box, opening } from './glass-dunes-architecture.js';

/** A tall street frontage assembled from offset masonry floors and projecting rooms. */
export function stackedStreetHouse(kit,M,{x,z,w,d,h,color,seed=0,yaw=0}){
  const facingX=Math.abs(Math.sin(yaw))>.5;
  const put=(u,y,v)=>[x+u*Math.cos(yaw)+v*Math.sin(yaw),y,z-u*Math.sin(yaw)+v*Math.cos(yaw)];
  const depth=(facingX?w:d)/2,fw=facingX?d:w,floors=Math.floor(h/3.4),step=h/floors;
  box(kit,M[color],x,h/2,z,w*.76,h,d*.76);
  for(let floor=0;floor<floors;floor++){
    const y0=floor*step,trim=floor%3===2,shrink=.96-.035*((floor+seed)%3),face=depth*shrink;
    box(kit,(floor+seed)%7===4?M.stone:M[color],x,y0+step/2,z,w*shrink,step,d*shrink);
    if(trim)box(kit,M.trim,x,y0+.16,z,w*shrink+.2,.32,d*shrink+.2);
    const cols=fw>10?3:2;
    for(let col=0;col<cols;col++){
      const u=(col-(cols-1)/2)*fw*.27,pos=put(u,y0+1.1,face+.11);
      if(floor===0&&col===0){opening(kit,M,{x:pos[0],y:.1,z:pos[2],yaw,w:1.05,h:2.6,paint:'gold'});continue;}
      const lit=(floor*3+col+seed)%5!==0;
      opening(kit,M,{x:pos[0],y:pos[1],z:pos[2],yaw,w:.62+(col%2)*.12,h:1.15,window:true,paint:lit?'windowLight':'shadow'});
      const mullion=new THREE.BoxGeometry(.045,1.12,.04).rotateY(yaw).translate(...put(u,y0+1.67,face+.25));kit.add(M.woodline,mullion);
    }
    // Upper bays vary in width, height and position; their backs sink into the main wall.
    if(floor>4&&(floor+seed)%3===1){
      const u=((floor+seed)%2?-.2:.2)*fw,bw=fw*(.39+.08*(seed%2)),by=y0-.2,bd=2.3;
      const g=new THREE.BoxGeometry(bw,step+1.2,bd).rotateY(yaw).translate(...put(u,by+step/2,face+.55));kit.add(M[(floor+seed)%4===0?'stone':color],g);
      kit.add(M.trim,new THREE.BoxGeometry(bw+.35,.42,bd+.25).rotateY(yaw).translate(...put(u,by-.55,face+.55)));
      const wp=put(u,by+.5,face+1.76);opening(kit,M,{x:wp[0],y:wp[1],z:wp[2],yaw,w:.9,h:1.5,window:true,paint:'windowLight'});
      for(const sign of [-1,1])kit.add(M.trim,new THREE.BoxGeometry(.3,1.5,1.4).rotateY(yaw).translate(...put(u+sign*bw*.32,by-1.1,face+.3)));
    }
    // Thin masonry strips and recessed panels break up the unlit returns.
    if(floor%2===0)for(const side of [-1,1])box(kit,M.trim,x+side*w*.4,y0+step/2,z-d*.48,.18,step-.6,.24);
  }
  // Uneven parapets and a smaller service room leave a staggered skyline.
  box(kit,M.trim,x,h+.2,z,w*.92,.45,d*.92);
  if(seed%3===0)box(kit,M[color],x-w*.18,h+1.25,z-d*.1,w*.42,2.1,d*.48);
}
