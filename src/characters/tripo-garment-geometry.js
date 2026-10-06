import * as T from 'three';
export const isShirtColor=([r,g,b])=>r>25&&r>g*1.22&&r>b*1.4&&(g-b)/(r-b)<.43;
// Fill the hidden upper-trouser surfaces the AI model never generated. They are weighted to the same skeleton and live inside the shirt.
// Loft two leg openings into one waist. The inner top arcs share vertex indices,
// so the crotch is connected geometry rather than overlapping tubes or a fly patch.
export function makeUnderlayer(source,colors){
 const geometry=source.geometry,A=geometry.attributes,bones=source.skeleton.bones;
 const CUT=.665,ROWS=14,COLS=48,HALF=COLS/2,segments=[];
 const point=i=>new T.Vector3().fromBufferAttribute(A.position,i);
 const blendWeights=(entries)=>{const sums=new Map();for(const [i,amount]of entries)for(let k=0;k<4;k++){const j=A.skinIndex.getComponent(i,k);sums.set(j,(sums.get(j)??0)+A.skinWeight.getComponent(i,k)*amount);}const top=[...sums].sort((a,b)=>b[1]-a[1]).slice(0,4),total=top.reduce((s,v)=>s+v[1],0);return {j:Array.from({length:4},(_,k)=>top[k]?.[0]??0),w:Array.from({length:4},(_,k)=>(top[k]?.[1]??0)/(total||1))};};
 const edge=(a,b,t)=>({p:point(a).lerp(point(b),t),entries:[[a,1-t],[b,t]]});
 for(let k=0;k<geometry.index.count;k+=3){const ids=[0,1,2].map(d=>geometry.index.getX(k+d)),cross=[];for(let d=0;d<3;d++){const a=ids[d],b=ids[(d+1)%3],ya=A.position.getY(a),yb=A.position.getY(b);if((ya-CUT)*(yb-CUT)<0)cross.push(edge(a,b,(CUT-ya)/(yb-ya)));}if(cross.length===2)segments.push(cross);}
 if(!segments.length)throw new Error('No closed trouser section at the lower repair boundary');
 const position=[],joint=[],weight=[],rgb=[],index=[],boundary=[],rings=[];
 const fabric=new T.Color().setHex(0xcbb897, T.LinearSRGBColorSpace).convertSRGBToLinear(),boneIndex=name=>bones.findIndex(b=>b.name===name);
 function vertex(p,skin,color){const i=position.length/3;position.push(...p.toArray());joint.push(...skin.j);weight.push(...skin.w);rgb.push(color.r,color.g,color.b);return i;}
 const cross2=(a,b)=>a.x*b.z-a.z*b.x;
 for(const [side,sign]of [['l',1],['r',-1]]){
  const hip=bones[boneIndex('thigh_'+side)].getWorldPosition(new T.Vector3()),knee=bones[boneIndex('calf_'+side)].getWorldPosition(new T.Vector3());
  const center=hip.clone().lerp(knee,(hip.y-CUT)/(hip.y-knee.y)).setY(CUT),ring=[];
  for(let col=0;col<COLS;col++){
   const angle=col/COLS*Math.PI*2,dir=new T.Vector3(sign*Math.sin(angle),0,Math.cos(angle));let hit=null;
   for(const [a,b]of segments){const e=b.p.clone().sub(a.p),offset=a.p.clone().sub(center),den=cross2(dir,e);if(Math.abs(den)<1e-9)continue;const distance=cross2(offset,e)/den,u=cross2(offset,dir)/den;if(distance>.015&&distance<.20&&u>=-1e-6&&u<=1+1e-6&&(!hit||distance<hit.distance))hit={a,b,u:T.MathUtils.clamp(u,0,1),distance};}
   if(!hit)throw new Error(`Incomplete trouser boundary: ${side}/${col}`);
   const entries=[...hit.a.entries.map(([i,w])=>[i,w*(1-hit.u)]),...hit.b.entries.map(([i,w])=>[i,w*hit.u])];
   const p=center.clone().addScaledVector(dir,hit.distance),normal=new T.Vector3(),color=new T.Color(0,0,0);
   for(const [i,w]of entries){normal.addScaledVector(new T.Vector3().fromBufferAttribute(A.normal,i),w);const c=colors[i];color.add(new T.Color().setRGB(c[0]/255,c[1]/255,c[2]/255).convertSRGBToLinear().multiplyScalar(w));}
   color.lerp(fabric,T.MathUtils.smoothstep(CUT,.60,.76));ring.push({p,skin:blendWeights(entries),normal:normal.normalize(),color});
  }
  const rows=[];
  for(let row=0;row<=ROWS;row++){const t=row/ROWS,s=t*t*(3-2*t),ids=[];
   for(let col=0;col<COLS;col++){
    const angle=col/COLS*Math.PI*2,sin=Math.sin(angle),cos=Math.cos(angle),start=ring[col];
    const end=new T.Vector3(sign*.163*Math.max(0,sin),.935+Math.min(0,sin)*.10,.103*cos-.012);
    const p=start.p.clone().lerp(end,t);
    // Ease the change of section near the original trouser opening, retaining its folds.
    p.x=T.MathUtils.lerp(start.p.x,end.x,s);p.z=T.MathUtils.lerp(start.p.z,end.z,s);
    if(side==='r'&&row===ROWS&&col>=HALF){ids.push(rings[0][ROWS][col]);continue;}
    if(side==='r'&&row===ROWS&&col===0){ids.push(rings[0][ROWS][0]);continue;}
    const i=vertex(p,start.skin,start.color.clone().lerp(fabric,T.MathUtils.smoothstep(t,0,.4)));ids.push(i);if(row===0)boundary.push({i,normal:start.normal});
   }rows.push(ids);
  }
  for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){const next=(col+1)%COLS,a=rows[row][col],b=rows[row][next],c=rows[row+1][col],d=rows[row+1][next];if(sign===1)index.push(a,b,c,b,d,c);else index.push(a,c,b,b,c,d);}
  rings.push(rows);
 }
 // Outer half arcs form a single waist boundary; the inner arcs are the shared crotch.
 let previous=[...rings[0][ROWS].slice(0,HALF+1),...rings[1][ROWS].slice(1,HALF).reverse()];
 const baseWaist=previous.map(i=>new T.Vector3().fromArray(position,i*3));
 for(let row=1;row<=5;row++){const t=row/5,next=[];for(let col=0;col<previous.length;col++){const p=baseWaist[col].clone();p.x*=T.MathUtils.lerp(1,.90,t);p.z=(p.z+.012)*T.MathUtils.lerp(1,.92,t)-.012;p.y=T.MathUtils.lerp(.935,1.002,t);next.push(vertex(p,{j:[boneIndex('pelvis'),0,0,0],w:[1,0,0,0]},fabric));}
  for(let col=0;col<previous.length;col++){const n=(col+1)%previous.length;index.push(previous[col],previous[n],next[col],previous[n],next[n],next[col]);}previous=next;
 }
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(position,3));out.setAttribute('skinIndex',new T.Uint16BufferAttribute(joint,4));out.setAttribute('skinWeight',new T.Float32BufferAttribute(weight,4));out.setAttribute('color',new T.Float32BufferAttribute(rgb,3));out.setIndex(index);out.computeVertexNormals();
 for(const {i,normal}of boundary)out.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);
 const mesh=new T.SkinnedMesh(out,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));source.parent?.add(mesh);mesh.bind(source.skeleton,source.bindMatrix);mesh.frustumCulled=false;return mesh;
}

export function separateShirt(geometry,mask,height,below=false){
 const attrs=geometry.attributes,names=Object.keys(attrs),arrays=Object.fromEntries(names.map(n=>[n,Array.from(attrs[n].array)])),index=[];
 let count=attrs.position.count;
 const intersection=(a,b)=>{const t=(height-arrays.position[a*3+1])/(arrays.position[b*3+1]-arrays.position[a*3+1]);for(const n of names){const size=attrs[n].itemSize;for(let k=0;k<size;k++)arrays[n].push(n==='skinIndex'||n==='skinWeight'?arrays[n][(t<.5?a:b)*size+k]:T.MathUtils.lerp(arrays[n][a*size+k],arrays[n][b*size+k],t));}return count++;};
 for(let k=0;k<geometry.index.count;k+=3){const ids=[0,1,2].map(d=>geometry.index.getX(k+d));if(!ids.some(i=>mask[i])){if(!below)index.push(...ids);continue;}
 const poly=[];for(let d=0;d<3;d++){const a=ids[d],b=ids[(d+1)%3],ia=below?attrs.position.getY(a)<=height:attrs.position.getY(a)>=height,ib=below?attrs.position.getY(b)<=height:attrs.position.getY(b)>=height;if(ia)poly.push(a);if(ia!==ib)poly.push(intersection(a,b));}
 for(let d=1;d+1<poly.length;d++)index.push(poly[0],poly[d],poly[d+1]);
 }
 const result=new T.BufferGeometry();for(const n of names)result.setAttribute(n,new T.BufferAttribute(new attrs[n].array.constructor(arrays[n]),attrs[n].itemSize));result.setIndex(index);return result;
}

// Use the same continuous hip/thigh field on original and reconstructed upper
// trousers. Independent nearest-surface transfers made their common edge separate.
export function fitTrouserWeights(mesh){
 const bones=mesh.skeleton.bones,idx=n=>bones.findIndex(b=>b.name===n),p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
 const smooth=T.MathUtils.smoothstep;
 for(let i=0;i<p.count;i++){
  const y=p.getY(i),x=p.getX(i);if(y<.56||y>1.025||Math.abs(x)>.24)continue;
  const blend=smooth(y,.56,.65)*(1-smooth(y,.985,1.025));
  const pelvis=smooth(y,.88,1.00),left=smooth(x,-.035,.035);
  const desired=[[idx('pelvis'),pelvis],[idx('thigh_l'),(1-pelvis)*left],[idx('thigh_r'),(1-pelvis)*(1-left)]];
  const sums=new Map();for(let k=0;k<4;k++)sums.set(j.getComponent(i,k),(sums.get(j.getComponent(i,k))??0)+w.getComponent(i,k)*(1-blend));
  for(const [bone,value]of desired)sums.set(bone,(sums.get(bone)??0)+value*blend);
  const best=[...sums].sort((a,b)=>b[1]-a[1]).slice(0,4),total=best.reduce((s,b)=>s+b[1],0);for(let k=0;k<4;k++){j.setComponent(i,k,best[k]?.[0]??0);w.setComponent(i,k,(best[k]?.[1]??0)/total);}
 }
 j.needsUpdate=true;w.needsUpdate=true;
}

// The source texture bakes a dark shirt-hem shadow onto the trouser cut. Once the
// shirt moves, that stationary shadow reads as a torn edge. Fade it into the same
// neutral fabric used on the newly exposed trouser surface.
export function shadeTrouserRepair(mesh){
 const p=mesh.geometry.attributes.position,blend=new Float32Array(p.count);
 for(let i=0;i<p.count;i++){const y=p.getY(i);blend[i]=Math.abs(p.getX(i))<.24?T.MathUtils.smoothstep(y,.60,.76)*(1-T.MathUtils.smoothstep(y,.98,1.04)):0;}
 mesh.geometry.setAttribute('trouserRepair',new T.BufferAttribute(blend,1));
 const fabric=new T.Color().setHex(0xcbb897, T.LinearSRGBColorSpace).convertSRGBToLinear();
 mesh.material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float trouserRepair; varying float vTrouserRepair;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTrouserRepair=trouserRepair;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vTrouserRepair;').replace('#include <map_fragment>',`#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(${fabric.r},${fabric.g},${fabric.b}),vTrouserRepair);`);
 };
 mesh.material.customProgramCacheKey=()=> 'tripo-trouser-repair-v1';
}

export function removeTrouserBand(geometry,low=.665,high=.955){
 const attrs=geometry.attributes,names=Object.keys(attrs),arrays=Object.fromEntries(names.map(n=>[n,Array.from(attrs[n].array)])),index=[];let count=attrs.position.count;
 const split=(a,b,y)=>{const t=(y-arrays.position[a*3+1])/(arrays.position[b*3+1]-arrays.position[a*3+1]);for(const n of names){const size=attrs[n].itemSize;for(let k=0;k<size;k++)arrays[n].push(n==='skinIndex'||n==='skinWeight'?arrays[n][(t<.5?a:b)*size+k]:T.MathUtils.lerp(arrays[n][a*size+k],arrays[n][b*size+k],t));}return count++;};
 for(let k=0;k<geometry.index.count;k+=3){const ids=[0,1,2].map(d=>geometry.index.getX(k+d));for(const [plane,above]of [[low,false],[high,true]]){const poly=[];for(let d=0;d<3;d++){const a=ids[d],b=ids[(d+1)%3],ia=above?attrs.position.getY(a)>=plane:attrs.position.getY(a)<=plane,ib=above?attrs.position.getY(b)>=plane:attrs.position.getY(b)<=plane;if(ia)poly.push(a);if(ia!==ib)poly.push(split(a,b,plane));}for(let d=1;d+1<poly.length;d++)index.push(poly[0],poly[d],poly[d+1]);}}
 const result=new T.BufferGeometry();for(const n of names)result.setAttribute(n,new T.BufferAttribute(new attrs[n].array.constructor(arrays[n]),attrs[n].itemSize));result.setIndex(index);return result;
}

// The generated inner shirt exists only in the narrow opening between the coat
// panels. Add an opaque tucked-in backing beneath its original textured folds.
export function makeInnerShirt(source,colors){
 const A=source.geometry.attributes,position=[],skinIndex=[],skinWeight=[],index=[],ROWS=12,COLS=48;
 const candidates=[];
 for(let i=0;i<A.position.count;i++){
  const c=colors[i];if(A.position.getY(i)>.98&&A.position.getY(i)<1.3&&Math.abs(A.position.getX(i))<.045&&A.position.getZ(i)>.04&&c[0]>120&&c[1]>c[0]*.8)candidates.push(i);
 }
 if(!candidates.length)throw new Error('No inner-shirt surface for backing weights');
 const shade=new T.Color(0,0,0);
 for(const i of candidates){const c=colors[i];shade.add(new T.Color().setRGB(c[0]/255,c[1]/255,c[2]/255).convertSRGBToLinear());}shade.multiplyScalar(1/candidates.length);
 for(let row=0;row<=ROWS;row++){
  const t=row/ROWS,y=T.MathUtils.lerp(.975,1.27,t),nearest=candidates.reduce((a,b)=>Math.abs(A.position.getY(a)-y)<Math.abs(A.position.getY(b)-y)?a:b);
  for(let col=0;col<COLS;col++){
   const angle=col/COLS*Math.PI*2;position.push(.148*Math.sin(angle),y,.086*Math.cos(angle)-.020);
   for(let k=0;k<4;k++){skinIndex.push(A.skinIndex.getComponent(nearest,k));skinWeight.push(A.skinWeight.getComponent(nearest,k));}
   if(row<ROWS){const a=row*COLS+col,b=row*COLS+(col+1)%COLS,c=a+COLS,d=b+COLS;index.push(a,b,c,b,d,c);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));geometry.setIndex(index);geometry.computeVertexNormals();
 const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({color:shade,roughness:1,side:T.DoubleSide}));mesh.name='InnerShirtBacking';mesh.bind(source.skeleton,source.bindMatrix);mesh.frustumCulled=false;return mesh;
}
