import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { GLASS_ATTR } from './dune-glass-shader.js';
import { Z_GAP } from './temples/kit.js';

// Geometry shared by the three selected-reference spaces. All visible walking
// surfaces are the actual colliders; the builders return routes for traversal QA.
const V = (p) => new THREE.Vector3(...p);
export const box = (kit, mat, x,y,z,w,h,d) => kit.add(mat,new THREE.BoxGeometry(w,h,d).translate(x,y,z));
const mesh = (positions, indices) => {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
};

/** A genuinely round, slightly irregular plaster terrace with a level walking top. */
export function terrace(kit,mat,{x,z,y,h,rx,rz,seed=0}) {
  const n=96, rings=10,p=[],ix=[];
  for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++) {
    const a=i/n*Math.PI*2,t=j/rings, bulge=1+.012*Math.sin(a*3+seed)+.009*Math.sin(a*5-seed);
    const taper=1+.045*(1-t),lip=j===rings?-.06:0;
    p.push(x+Math.cos(a)*(rx*taper*bulge+lip),y+t*h,z+Math.sin(a)*(rz*taper*bulge+lip));
  }
  for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=b+n+1,d=a+n+1;ix.push(a,d,b,b,d,c);}
  const top=p.length/3;p.push(x,y+h,z);const bottom=p.length/3;p.push(x,y,z);
  for(let i=0;i<n;i++){ix.push(top,rings*(n+1)+i+1,rings*(n+1)+i);ix.push(bottom,i,i+1);}
  kit.add(mat,mesh(p,ix));
}

/** A continuous flowing parapet following an authored walk, smooth on top. */
export function ribbonWall(kit,mat,points,{width=.65,height=1.05,bottom=null,scallop=0}={}) {
  const path=new THREE.CatmullRomCurve3(points.map(V),false,'centripetal'),n=Math.max(24,points.length*12),p=[],ix=[];
  for(let i=0;i<=n;i++) {
    const q=path.getPoint(i/n),t=path.getTangent(i/n),l=Math.hypot(t.x,t.z),nx=t.z/l,nz=-t.x/l;
    const phase=(i/n*path.getLength()/1.5)%1,top=q.y+height+scallop*Math.sqrt(Math.max(0,1-(phase*2-1)**2));
    for(const [d,y] of [[-width/2,bottom??q.y-.15],[-width/2,top],[width/2,top],[width/2,bottom??q.y-.15]])p.push(q.x+nx*d,y,q.z+nz*d);
    if(i<n)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4;ix.push(a,b,b+4,a,b+4,a+4);}
  }
  ix.push(0,2,1,0,3,2,n*4,n*4+1,n*4+2,n*4,n*4+2,n*4+3);for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];kit.add(mat,mesh(p,ix));
}

export function arcPoints(cx,cz,rx,rz,a0,a1,y0,y1,n=12) {
  return Array.from({length:n+1},(_,i)=>{const t=i/n,a=a0+(a1-a0)*t;return[cx+Math.cos(a)*rx,y0+(y1-y0)*t,cz+Math.sin(a)*rz];});
}

/** Curving stair whose steps share boundary vertices: no overlapping box wedges. */
export function windingStair(kit,M,routes,points,{w=3.1,inner=false,outer=true,rail=.8,base=null,thin=false,thickness=.6,viaSamples=20,refine=false,railGaps=[]}={}) {
  const path=new THREE.CatmullRomCurve3(points.map(V),false,'centripetal');
  // Local steepness, including bends, determines riser count; total rise alone misses steep portions.
  let dy=0,last=path.getPoint(0).y;for(let i=1;refine&&i<=512;i++){const y=path.getPoint(i/512).y;dy=Math.max(dy,Math.abs(y-last)*512);last=y;}
  const n=Math.max(Math.ceil(path.getLength()/.48),Math.ceil(Math.abs(points.at(-1)[1]-points[0][1])/.16),refine?Math.ceil(dy/.16):0);
  const p=[],ix=[],left=[],right=[],via=[];base??=points[0][1]-.25;
  for(let i=0;i<n;i++) {
    const a=path.getPoint(i/n),b=path.getPoint((i+1)/n),ta=path.getTangent(i/n),tb=path.getTangent((i+1)/n);
    const na=new THREE.Vector3(ta.z,0,-ta.x).normalize(),nb=new THREE.Vector3(tb.z,0,-tb.x).normalize();
    const A=a.clone().addScaledVector(na,-w/2),B=a.clone().addScaledVector(na,w/2),C=b.clone().addScaledVector(nb,w/2),D=b.clone().addScaledVector(nb,-w/2),at=p.length/3;
    // A tread and its supporting riser are one closed volume.
    // (the last tread Z_GAP under its top, issue #498: it lies on a landing, a terrace or a bridge's deck of another stone)
    const t=i===n-1?b.y-Z_GAP:b.y;
    for(const y of [thin?t-thickness:base,t])for(const q of [A,B,C,D])p.push(q.x,y,q.z);
    for(const f of [[4,7,6,5],[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])ix.push(at+f[0],at+f[1],at+f[2],at+f[0],at+f[2],at+f[3]);
    if(i%Math.max(1,Math.floor(n/viaSamples))===0)via.push([a.x,b.y,a.z]);
  }
  const steps=mesh(p,ix).toNonIndexed();steps.computeVertexNormals();kit.add(M.step??M.stone,steps);
  for(let i=0;i<=24;i++){const q=path.getPoint(i/24),t=path.getTangent(i/24),n=new THREE.Vector3(t.z,0,-t.x).normalize();left.push(q.clone().addScaledVector(n,-w/2-.3).toArray());right.push(q.clone().addScaledVector(n,w/2+.3).toArray());}
  const parapet=(edge)=>{let run=[];const flush=()=>{if(run.length>1)ribbonWall(kit,M.stone,run,{height:rail,bottom:thin?null:base});run=[];};for(const p of edge){if(railGaps.some(g=>Math.hypot(p[0]-g.at[0],p[2]-g.at[2])<g.r))flush();else run.push(p);}flush();};
  if(inner)parapet(left);if(outer)parapet(right);
  via[0]=points[0];via.push(points.at(-1));routes.push({from:points[0],to:points.at(-1),via});
  return routes.at(-1);
}

/** Unequal rounded plaster dwelling, with softly rolled shoulders. */
export function dwelling(kit,M,{x,z,y,w=7,d=6,h=6,color='stone',seed=0,round=false,spire=false,squareness=.53}) {
  const n=64,rows=12,p=[],ix=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++) {
    const a=i/n*Math.PI*2,t=j/rows, exponent=round?1:squareness;
    const sx=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),exponent),sz=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),exponent);
    const roll=1-.07*t-.025*Math.pow(t,8),top=h+Math.sin(a*2+seed)*.28+Math.cos(a*3-seed)*.13;
    p.push(x+sx*w/2*roll,y+t*top,z+sz*d/2*roll);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=b+n+1,d=a+n+1;ix.push(a,d,b,b,d,c);}
  const top=p.length/3;p.push(x,y+h-.2,z);for(let i=0;i<n;i++)ix.push(top,rows*(n+1)+i+1,rows*(n+1)+i);
  kit.add(M[color],mesh(p,ix));
  if(spire){const pts=[[0,0],[1.4,0],[1.2,.6],[.72,2],[.35,4],[.12,6],[0,6.8]].map(([r,h])=>new THREE.Vector2(r,h));kit.add(M.stone,new THREE.LatheGeometry(pts,32).translate(x-w*.2,y+h-.4,z));}
}

/** A recessed closed oak door/window on an arbitrary wall normal. */
export function opening(kit,M,{x,y,z,yaw=0,w=1.05,h=2.8,paint='ochre',window=false}) {
  const put=(g)=>g.rotateY(yaw).translate(x,y,z);
  kit.add(M.shadow,put(new THREE.BoxGeometry(w+.26,h+.24,.14).translate(0,h/2,0)));
  kit.add(M[paint],put(new THREE.BoxGeometry(w-.13,h-.14,.07).translate(0,h/2,.09)));
  if(!window)for(let i=-1;i<=1;i++)kit.add(M.woodline,put(new THREE.BoxGeometry(.025,h-.2,.02).translate(i*w*.24,h/2,.14)));
  // Uneven stone jambs make the recess part of the wall instead of a black sticker.
  // (their backs Z_GAP in front of the recess's, issue #498: both lay in one plane where a curved wall leaves them bare)
  for(const s of [-1,1])kit.add(M.trim,put(new THREE.BoxGeometry(.12,h+.22,.16).translate(s*(w/2+.11),h/2,.03)));
  kit.add(M.trim,put(new THREE.BoxGeometry(w+.4,.16,.2).translate(0,h+.1,.02)));
}

export function ellipseOpenings(kit,M,{x,z,y,rx,rz,angles,h=2.7,seed=0}) {
  angles.forEach((a,i)=>{const nx=Math.cos(a)/rx,nz=Math.sin(a)/rz;opening(kit,M,{x:x+Math.cos(a)*(rx+.16),z:z+Math.sin(a)*(rz+.16),y:y+.08,yaw:Math.atan2(nx,nz),w:i%3===0?1.2:.86,h: h+(i%2)*.3,paint:i===seed?'blue':'ochre'});});
}

/** Swept thin, twisting green fold. Unlike a solid mound it frames a real void. */
export function glassFold(kit,mat,points,{width=10,seed=0,thick=.8}={}) {
  const curve=new THREE.CatmullRomCurve3(points.map(V),false,'centripetal'),nu=90,nv=12,p=[],ix=[],colors=[],data=[];
  const dark=new THREE.Color('#2c6855'),mid=new THREE.Color('#6ba77b'),edge=new THREE.Color('#cadf99');
  for(let side=0;side<2;side++)for(let i=0;i<=nu;i++) {
    const t=i/nu,c=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
    let cross=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();if(cross.lengthSq()<.1)cross.set(1,0,0);
    cross.applyAxisAngle(tangent,Math.sin(t*Math.PI*2+seed)*.92);
    const normal=new THREE.Vector3().crossVectors(tangent,cross).normalize();
    const span=width*(.68+.32*Math.sin(Math.PI*t));
    for(let j=0;j<=nv;j++) {
      const v=j/nv*2-1,cupping=(1-v*v)*span*.075;
      const at=c.clone().addScaledVector(cross,v*span/2).addScaledVector(normal,cupping+(side?-.5:.5)*thick);
      p.push(...at.toArray());const col=dark.clone().lerp(mid,.3+.4*Math.sin(t*3+seed)).lerp(edge,Math.pow(Math.abs(v),4)*.82);colors.push(col.r,col.g,col.b);data.push(100,.2+.7*Math.pow(Math.abs(v),3),.4,t);
    }
  }
  const stride=nv+1,face=(nu+1)*stride;
  for(let side=0;side<2;side++)for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=side*face+i*stride+j,b=a+1,d=a+stride,c=d+1;side?ix.push(a,c,b,a,d,c):ix.push(a,b,c,a,c,d);}
  for(let i=0;i<nu;i++)for(const j of [0,nv]){const a=i*stride+j,b=a+stride;ix.push(a,b,b+face,a,b+face,a+face);}
  const g=mesh(p,ix);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute(GLASS_ATTR,new THREE.Float32BufferAttribute(data,4));kit.mesh(g,mat);
}

/** Actual open ruin wall: fractured outline, rounded worn stone, cut-through arches. */
export function ruinWall(kit,M,{x,z,y,w=12,h=12,depth=1.6,yaw=0,seed=0,door=true,windows=true,doorHeight=null,doorWidth=null}) {
  const sh=new THREE.Shape();sh.moveTo(-w/2,-.4);
  if(door){const cx=-w*.18,ww=doorWidth??(seed===2?5:2.3),hh=doorHeight??(seed===2?11:4.5);sh.lineTo(cx-ww/2,-.4);sh.lineTo(cx-ww/2,hh-ww/2);sh.absarc(cx,hh-ww/2,ww/2,Math.PI,0,true);sh.lineTo(cx+ww/2,-.4);}
  sh.lineTo(w/2,-.4);
  const n=14;
  for(let i=n;i>=0;i--){const u=i/n,top=h*(.77+.17*Math.sin(u*5+seed)**2)+.5*Math.sin(u*24+seed);sh.lineTo((u-.5)*w,top);}
  sh.closePath();
  const hole=(cx,yy,ww,hh,arch=false)=>{const p=new THREE.Path();p.moveTo(cx-ww/2,yy);p.lineTo(cx-ww/2,yy+hh-(arch?ww/2:0));if(arch)p.absarc(cx,yy+hh-ww/2,ww/2,Math.PI,0,true);else p.lineTo(cx+ww/2,yy+hh);p.lineTo(cx+ww/2,yy);p.closePath();sh.holes.push(p);};

  if(windows){hole(w*.18,h*.48,1.1,2.2);if(h>12&&(!door||h*.67>(doorHeight??(seed===2?11:4.5))+.5))hole(-w*.15,h*.67,.8,1.6);}
  const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSegments:3,bevelSize:h>25?.45:.22,bevelThickness:h>25?.35:.2,curveSegments:16,steps:2}).translate(0,0,-depth/2).rotateY(yaw).translate(x,y,z);kit.add(M.stone,g);
  // Rounded eroded footings merge into the wall rather than sit on its face.
  for(const side of [-1,1]) {
    const xx=side*(w/2-.4),hh=h*(side<0?.58:.35);
    const sh=new THREE.Shape();sh.moveTo(-.85,-.3);sh.lineTo(.95,-.3);sh.lineTo(.68,hh*.52);sh.quadraticCurveTo(.7,hh,.1,hh+.4);sh.quadraticCurveTo(-.6,hh+.25,-.68,hh*.55);sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:depth+1.1,bevelEnabled:true,bevelSize:.23,bevelThickness:.2,bevelSegments:3,curveSegments:10}).translate(xx,0,-depth/2-.1).rotateY(yaw).translate(x,y,z);kit.add(M.trim,g);
  }

}

/** Restrained vegetation at the foot of old plaster; every leaf is scenery. */
export function wallGrowth(kit,{x,y,z,h=3,seed=1}) {
  const rng=mulberry32(seed),stem=kit.mat({color:'#526247',line:.35,hatch:.2}),leaves=['#465d43','#71825b','#8e9967'].map(color=>kit.mat({color,line:.3,hatch:.2,shade:.16}));
  for(let branch=0;branch<5;branch++) {
    const dx=(rng()-.5)*1.6,top=h*(.45+rng()*.55),pts=[[x+dx,y,z],[x+dx+.3,y+top*.4,z-.14],[x+dx-.2,y+top*.75,z+.12],[x+dx+.25,y+top,z]];
    const curve=new THREE.CatmullRomCurve3(pts.map(V));kit.add(stem,new THREE.TubeGeometry(curve,12,.035,4,false),{solid:false});
    for(let i=0;i<18;i++){const p=curve.getPoint(.05+rng()*.93);p.x+=(rng()-.5)*.7;p.z+=(rng()-.5)*.28;kit.add(leaves[i%3],new THREE.IcosahedronGeometry(.16+rng()*.13,0).scale(1,.65,.48).rotateZ(rng()*3).translate(...p.toArray()),{solid:false});}
  }
}
