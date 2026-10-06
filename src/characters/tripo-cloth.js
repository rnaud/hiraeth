import { makeUnderlayer, makeInnerShirt, separateShirt, fitTrouserWeights, isShirtColor, shadeTrouserRepair, removeTrouserBand } from './tripo-garment-geometry.js';
import * as T from 'three';
import { CAP, CLOTH_STEP, segmentDistance2, pushOut, setCap, simulate } from './tripo-cloth-sim.js';

const V = () => new T.Vector3();
const clamp = T.MathUtils.clamp;
const TOP = 1.22, BOTTOM = .69, COLS = 32, ROWS = 14;
const START = .40, END = Math.PI * 2 - START;
const angleOf = p => { let a = Math.atan2(p.x, p.z + .016); return a < 0 ? a + Math.PI * 2 : a; };
const red = isShirtColor;

/** Push p out of the capsule a-b along `outward` (the cage's own step, tripo-cloth-sim.js): how far it went. */
export function projectOutward(p,a,b,radius,outward){
 const ax=b.x-a.x,ay=b.y-a.y,az=b.z-a.z,length2=Math.max(ax*ax+ay*ay+az*az,1e-10);
 const x=p.x,y=p.y,z=p.z,ox=outward.x,oy=outward.y,oz=outward.z,r2=radius*radius;
 if(segmentDistance2(0,x,y,z,ox,oy,oz,a.x,a.y,a.z,ax,ay,az,length2)>=r2)return 0;
 let lo=0,hi=radius*3;
 for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(segmentDistance2(mid,x,y,z,ox,oy,oz,a.x,a.y,a.z,ax,ay,az,length2)<r2)lo=mid;else hi=mid;}
 p.addScaledVector(outward,hi);return hi;
}

/**
 * BufferGeometry.computeVertexNormals for an indexed geometry, on the arrays themselves (the same sums in the
 * same order, so the same normals): three's goes through a Vector3 read and write per corner, several times
 * slower, and the shirt's are worked out every frame.
 */
export function vertexNormals(geometry){
 const position=geometry.attributes.position.array,index=geometry.index.array;
 let normal=geometry.attributes.normal;
 if(!normal){normal=new T.BufferAttribute(new Float32Array(position.length),3);geometry.setAttribute('normal',normal);}
 const n=normal.array;n.fill(0);
 for(let i=0;i<index.length;i+=3){
  const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
  const bx=position[b],by=position[b+1],bz=position[b+2];
  const cbx=position[c]-bx,cby=position[c+1]-by,cbz=position[c+2]-bz,abx=position[a]-bx,aby=position[a+1]-by,abz=position[a+2]-bz;
  const x=cby*abz-cbz*aby,y=cbz*abx-cbx*abz,z=cbx*aby-cby*abx;
  n[a]+=x;n[a+1]+=y;n[a+2]+=z;n[b]+=x;n[b+1]+=y;n[b+2]+=z;n[c]+=x;n[c+1]+=y;n[c+2]+=z;
 }
 for(let i=0;i<n.length;i+=3){const x=n[i],y=n[i+1],z=n[i+2],s=1/(Math.sqrt(x*x+y*y+z*z)||1);n[i]=x*s;n[i+1]=y*s;n[i+2]=z*s;}
 normal.needsUpdate=true;
}

/** A copy of `geometry` with only the vertices `used` (in that order; the index renumbered), without `drop`'s attributes. */
export function compactGeometry(geometry,used,drop=[]){
 const result=new T.BufferGeometry(),remap=new Map(used.map((v,k)=>[v,k]));
 for(const [name,attr]of Object.entries(geometry.attributes)){
  if(drop.includes(name))continue;
  const size=attr.itemSize,src=attr.array,array=new src.constructor(used.length*size);
  for(let k=0;k<used.length;k++)for(let c=0;c<size;c++)array[k*size+c]=src[used[k]*size+c];
  result.setAttribute(name,new T.BufferAttribute(array,size,attr.normalized));
 }
 result.setIndex(Array.from(geometry.index.array,v=>remap.get(v)));
 for(const g of geometry.groups)result.addGroup(g.start,g.count,g.materialIndex);
 return result;
}

// Drive the original textured lower overshirt with a regular open-front cage.
// useWorker: simulate the cage in a worker (the game; tests and pages without workers step it here)
export function makeTripoCloth(source, colors, { useWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined' } = {}) {
  const original = source.geometry, pos = original.attributes.position;
  const points = Array.from({length:pos.count}, (_,i) => V().fromBufferAttribute(pos,i));
  const shirt = points.map((p,i) => p.y > .66 && p.y < TOP + .035 && Math.abs(p.x) < .25 && red(colors[i]));

  const skinSource=new T.SkinnedMesh(original,source.material);skinSource.bind(source.skeleton,source.bindMatrix);
  // Retain non-garment faces; repair missing surfaces below the fused hem separately.
  source.geometry=removeTrouserBand(separateShirt(original,shirt,TOP));
  const underlayer=makeUnderlayer(skinSource,colors);source.parent.add(underlayer);fitTrouserWeights(source);fitTrouserWeights(underlayer);shadeTrouserRepair(source);
  const innerShirt=makeInnerShirt(skinSource,colors);source.parent.add(innerShirt);
  const geo=new T.BufferGeometry();
  // The regular cage is hidden; the original textured folds follow its displacement.
  const material=new T.MeshStandardMaterial({color:0xcc7558,roughness:1,metalness:0,side:T.DoubleSide});
  const mesh=new T.Mesh(geo,material);mesh.name='SimulatedOvershirt';mesh.frustumCulled=false;mesh.visible=false;source.parent.add(mesh);


  const section=[];
  for(let k=0;k<original.index.count;k+=3){const ids=[0,1,2].map(d=>original.index.getX(k+d));if(!ids.some(i=>shirt[i]))continue;for(let d=0;d<3;d++){const a=ids[d],b=ids[(d+1)%3],pa=points[a],pb=points[b];if((pa.y-TOP)*(pb.y-TOP)>=0)continue;const t=(TOP-pa.y)/(pb.y-pa.y),p=pa.clone().lerp(pb,t);section.push({p,a,b,t});}}
  if(!section.length)throw new Error('The shirt has no usable attachment section');
  const top=Array.from({length:COLS+1},(_,col)=>{const theta=T.MathUtils.lerp(START,END,col/COLS);return section.reduce((best,s)=>Math.abs(angleOf(s.p)-theta)<Math.abs(angleOf(best.p)-theta)?s:best);});
  const rest=[],positions=[],previous=[],edges=[],pins=[];
  const id=(row,col)=>row*(COLS+1)+col;
  // A smooth, tailored rest silhouette gives the solver regular triangles.

  for(let row=0;row<=ROWS;row++)for(let col=0;col<=COLS;col++){
    const theta=T.MathUtils.lerp(START,END,col/COLS), y=T.MathUtils.lerp(TOP+.025,BOTTOM,row/ROWS);
    const v=row/ROWS,rx=T.MathUtils.lerp(.178,.197,v),rz=T.MathUtils.lerp(.126,.147,v);
    const radius=1/Math.sqrt((Math.sin(theta)/rx)**2+(Math.cos(theta)/rz)**2);
    const p=new T.Vector3(Math.sin(theta)*radius,y,Math.cos(theta)*radius-.016);
    if(row===0)p.copy(top[col].p).add(new T.Vector3(0,.008,0));
    rest.push(p);positions.push(p.clone());previous.push(p.clone());pins.push(row===0?0:1);
  }
  const add=(a,b,stiffness)=>edges.push([a,b,rest[a].distanceTo(rest[b]),stiffness]);
  for(let row=0;row<=ROWS;row++)for(let col=0;col<=COLS;col++){
    if(col<COLS)add(id(row,col),id(row,col+1),1);
    if(row<ROWS)add(id(row,col),id(row+1,col),1);
    if(row<ROWS&&col<COLS){add(id(row,col),id(row+1,col+1),.7);add(id(row,col+1),id(row+1,col),.7);}
    if(row+2<=ROWS)add(id(row,col),id(row+2,col),.7);
    if(col+2<=COLS)add(id(row,col),id(row,col+2),.7);
  }
  const renderIndex=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const a=id(r,c),b=id(r,c+1),d=id(r+1,c),e=id(r+1,c+1);renderIndex.push(a,d,b,b,d,e);
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(rest.flatMap(p=>p.toArray()),3));
  const vertexColors=[];
  for(let r=0;r<=ROWS;r++)for(let c=0;c<=COLS;c++){const s=top[c],rgb=colors[s.a].map((v,k)=>T.MathUtils.lerp(v,colors[s.b][k],s.t)/255),color=new T.Color().setRGB(...rgb).convertSRGBToLinear();color.lerp(new T.Color().setHex(0xcc7558, T.LinearSRGBColorSpace).convertSRGBToLinear(),Math.min(1,r/4));vertexColors.push(color.r,color.g,color.b);}
  geo.setAttribute('color',new T.Float32BufferAttribute(vertexColors,3));material.color.set(0xffffff);material.vertexColors=true;
  geo.setIndex(renderIndex);geo.computeVertexNormals();
  const attachment=source.skeleton.bones.find(b=>b.name==='spine_02');
  const inverseAttachment=attachment.matrixWorld.clone().invert();
  const attachmentRest=rest.map(p=>p.clone().applyMatrix4(source.matrixWorld).applyMatrix4(inverseAttachment));
  const target=rest.map(p=>p.clone());
  const detailed=separateShirt(original,shirt,TOP,true);
  const detailedRest=detailed.attributes.position.array.slice();
  const skinDetail=new T.SkinnedMesh(detailed,source.material);skinDetail.bind(source.skeleton,source.bindMatrix);
  // Only the vertices the shirt's triangles use (about a sixth of the body's): the geometry is rewritten,
  // its normals worked out and uploaded every frame, so the unused rest would only cost time.
  const used=[...new Set(Array.from(detailed.index.array))];
  const garmentGeometry=compactGeometry(detailed,used,['skinIndex','skinWeight']);
  const garmentMaterial=source.material.clone();garmentMaterial.side=T.DoubleSide;
  const lining=new T.Color().setHex(0xb46249, T.LinearSRGBColorSpace).convertSRGBToLinear();
  garmentMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(${lining.r},${lining.g},${lining.b});`);};
  garmentMaterial.customProgramCacheKey=()=> 'tripo-cloth-lining-v1';
  const garment=new T.Mesh(garmentGeometry,garmentMaterial);garment.frustumCulled=false;source.parent.add(garment);
  const mapping=used.map((i,o)=>{const p=V().fromArray(detailedRest,i*3),u=clamp((angleOf(p)-START)/(END-START)*COLS,0,COLS-.000001),v=clamp((TOP+.025-p.y)/(TOP+.025-BOTTOM)*ROWS,0,ROWS-.000001),c=Math.floor(u),r=Math.floor(v);return {i,o,p,ids:[id(r,c),id(r,c+1),id(r+1,c),id(r+1,c+1)],weights:[(1-u+c)*(1-v+r),(u-c)*(1-v+r),(1-u+c)*(v-r),(u-c)*(v-r)],free:T.MathUtils.smoothstep(TOP-p.y,0,.10),local:p.clone().applyMatrix4(source.matrixWorld).applyMatrix4(inverseAttachment),outward:new T.Vector3(p.x,0,p.z+.016).normalize()};});
  const caps=[];
  // The donor joints sit behind the generated trousers. Center the collision
  // axes on the repaired fabric, not on those anatomical joint positions; the
  // previous .13 m circles around the joints inflated the coat into a bell.
  const bone=name=>source.skeleton.bones.find(b=>b.name===name);
  function collider(a,b,from,to,radius){
    caps.push({a,b,radius,from:V(),to:V(),localFrom:from.clone().applyMatrix4(a.matrixWorld.clone().invert()),localTo:to.clone().applyMatrix4(b.matrixWorld.clone().invert())});
  }
  for(const side of ['l','r']){
    const sign=side==='l'?1:-1,hip=bone('thigh_'+side),knee=bone('calf_'+side),foot=bone('foot_'+side);
    const h=hip.getWorldPosition(V()).setX(sign*.078).setZ(-.012);
    const k=knee.getWorldPosition(V()).setX(sign*.096).setZ(-.012);
    collider(hip,knee,h,k,.103);
    collider(knee,foot,k,foot.getWorldPosition(V()),.085);
  }
  collider(bone('thigh_l'),bone('thigh_r'),new T.Vector3(.065,.948,-.012),new T.Vector3(-.065,.948,-.012),.096);
  let initialized=false,accumulator=0,lastMotion=null;
  const current=V(),scratch=V(),toLocal=new T.Matrix4(),attachToLocal=new T.Matrix4();
  // What the hot loops read, worked out once: the particles as flat arrays, each one's outward direction
  // (constant: from its rest place), the edges, the capsules (each frame), the bones' skinning matrices
  // (once a frame, not once a vertex). The cage itself steps in tripo-cloth-sim.js.
  const N=rest.length,pinArray=Float64Array.from(pins),outwardArray=new Float64Array(N*3);
  rest.forEach((p,i)=>{const o=new T.Vector3(p.x,0,p.z+.016).normalize();outwardArray[i*3]=o.x;outwardArray[i*3+1]=o.y;outwardArray[i*3+2]=o.z;});
  const constants={pins:pinArray,outwards:outwardArray,edgeA:Int32Array.from(edges,e=>e[0]),edgeB:Int32Array.from(edges,e=>e[1]),edgeLength:Float64Array.from(edges,e=>e[2]),edgeK:Float64Array.from(edges,e=>e[3])};
  const sim={...constants,P:new Float64Array(N*3),Q:new Float64Array(N*3)},G=new Float64Array(N*3);
  const simCaps=new Float64Array(caps.length*CAP),mapCaps=new Float64Array(caps.length*CAP);
  // the targets the positions were last simulated against: the garment follows positions - simTarget
  const simTarget=new Float64Array(N*3);
  // Off the main thread where there are workers: each frame sends the targets and the capsules with the steps
  // due and uses the newest positions back (a frame old: the shirt's own swing; the body under it is this
  // frame's). Steps the worker hasn't taken yet wait for the next send.
  let worker=null,waiting=false,pendingSteps=0,reset=true,requestId=0;
  if(useWorker){
    try{
      worker=new Worker(new URL('./tripo-cloth-worker.js',import.meta.url),{type:'module'});
      worker.postMessage({type:'init',constants});
      worker.onmessage=({data})=>{waiting=false;if(data.id!==requestId)return;sim.P.set(data.P);simTarget.set(data.G);for(let i=0;i<N;i++)positions[i].set(data.P[i*3],data.P[i*3+1],data.P[i*3+2]);};
      worker.onerror=(e)=>{console.warn('cloth: the worker failed; simulating on the main thread',e.message??e);worker=null;waiting=false;initialized=false;};
    }catch{worker=null;}
  }
  const skeleton=source.skeleton,boneSkin=skeleton.bones.map(()=>new T.Matrix4());
  const sourceSkin=[original.attributes.skinIndex.array,original.attributes.skinWeight.array];
  const detailSkin=[detailed.attributes.skinIndex.array,detailed.attributes.skinWeight.array];
  const base=new T.Vector4(),bindMatrix=skinSource.bindMatrix;
  /** p (the mesh's local space) skinned with vertex `index`'s weights: SkinnedMesh.applyBoneTransform's own math */
  function skin([indices,weights],index,p){
    base.set(p.x,p.y,p.z,1).applyMatrix4(bindMatrix);
    let x=0,y=0,z=0;
    for(let k=0;k<4;k++){
      const w=weights[index*4+k];if(w===0)continue;
      const e=boneSkin[indices[index*4+k]].elements,bx=base.x,by=base.y,bz=base.z,bw=base.w;
      x+=(e[0]*bx+e[4]*by+e[8]*bz+e[12]*bw)*w;y+=(e[1]*bx+e[5]*by+e[9]*bz+e[13]*bw)*w;z+=(e[2]*bx+e[6]*by+e[10]*bz+e[14]*bw)*w;
    }
    return p.set(x,y,z).applyMatrix4(source.bindMatrixInverse);
  }
  function update(dt,motion,enabled=true){
    source.skeleton.update();source.updateMatrixWorld(true);
    // These CPU skinning proxies are detached from the scene. Follow the real
    // mesh's inverse world bind or a travelling character leaves its hem behind.
    skinSource.bindMatrixInverse.copy(source.bindMatrixInverse);
    skinDetail.bindMatrixInverse.copy(source.bindMatrixInverse);
    for(let b=0;b<boneSkin.length;b++)boneSkin[b].multiplyMatrices(skeleton.bones[b].matrixWorld,skeleton.boneInverses[b]);
    toLocal.copy(source.matrixWorld).invert();
    for(let i=0;i<target.length;i++)target[i].copy(attachmentRest[i]).applyMatrix4(attachment.matrixWorld).applyMatrix4(toLocal);
    for(let i=0;i<=COLS;i++){const s=top[i],a=skin(sourceSkin,s.a,current.copy(rest[i])),b=skin(sourceSkin,s.b,scratch.copy(rest[i]));target[i].copy(a.lerp(b,s.t));}
    for(let i=0;i<N;i++){G[i*3]=target[i].x;G[i*3+1]=target[i].y;G[i*3+2]=target[i].z;}
    caps.forEach((c,k)=>{c.from.copy(c.localFrom).applyMatrix4(c.a.matrixWorld).applyMatrix4(toLocal);c.to.copy(c.localTo).applyMatrix4(c.b.matrixWorld).applyMatrix4(toLocal);setCap(simCaps,k,c.from,c.to,c.radius+.012);setCap(mapCaps,k,c.from,c.to,c.radius+.008);});
    const simulated=enabled&&motion!=='rest';
    if(!initialized||motion!==lastMotion||!simulated){
      for(let i=0;i<N;i++){positions[i].copy(target[i]);previous[i].copy(target[i]);}
      sim.P.set(G);sim.Q.set(G);simTarget.set(G);
      initialized=true;accumulator=0;lastMotion=motion;reset=true;pendingSteps=0;requestId++;
    }
    if(simulated){
      accumulator+=Math.min(dt,.05);
      let steps=0;while(accumulator>=CLOTH_STEP){accumulator-=CLOTH_STEP;steps++;}
      if(worker){
        pendingSteps=Math.min(pendingSteps+steps,9);   // (a worker that fell behind: at most a tenth of a second to catch up)
        if(!waiting&&pendingSteps){
          worker.postMessage({type:'step',id:++requestId,G:G.slice(),caps:simCaps.slice(),steps:pendingSteps,reset:reset?G.slice():null});
          waiting=true;pendingSteps=0;reset=false;
        }
      }else if(steps){
        simulate(sim,G,simCaps,steps);simTarget.set(G);
        for(let i=0;i<N;i++){positions[i].set(sim.P[i*3],sim.P[i*3+1],sim.P[i*3+2]);previous[i].set(sim.Q[i*3],sim.Q[i*3+1],sim.Q[i*3+2]);}
      }
    }
    const cage=geo.attributes.position.array;
    for(let i=0;i<N;i++){cage[i*3]=positions[i].x;cage[i*3+1]=positions[i].y;cage[i*3+2]=positions[i].z;}
    const out=garmentGeometry.attributes.position.array,P=sim.P;
    // (the attachment bone into the mesh's space as one affine matrix: one product a vertex, not two)
    const e=attachToLocal.multiplyMatrices(toLocal,attachment.matrixWorld).elements;
    for(const m of mapping){
      const l=m.local,free=m.free,p=current.set(e[0]*l.x+e[4]*l.y+e[8]*l.z+e[12],e[1]*l.x+e[5]*l.y+e[9]*l.z+e[13],e[2]*l.x+e[6]*l.y+e[10]*l.z+e[14]);
      // (a vertex the cloth moves all by itself, free = 1, doesn't need its skinned place: lerp by 0)
      if(free<1)p.lerp(skin(detailSkin,m.i,scratch.copy(m.p)),1-free);
      if(free>0)for(let k=0;k<4;k++){const j=m.ids[k]*3,w=m.weights[k]*free;p.x+=(P[j]-simTarget[j])*w;p.y+=(P[j+1]-simTarget[j+1])*w;p.z+=(P[j+2]-simTarget[j+2])*w;}
      if(simulated&&free>.95){const o=m.outward;for(let k=0;k<caps.length;k++){const hi=pushOut(p.x,p.y,p.z,o.x,o.y,o.z,mapCaps,k);if(hi)p.addScaledVector(o,hi);}}
      out[m.o*3]=p.x;out[m.o*3+1]=p.y;out[m.o*3+2]=p.z;
    }
    garmentGeometry.attributes.position.needsUpdate=true;vertexNormals(garmentGeometry);
    // (the regular cage itself is never drawn: its normals only when it is shown, for a debug view)
    geo.attributes.position.needsUpdate=true;if(mesh.visible)geo.computeVertexNormals();
    return {particles:positions.length,triangles:renderIndex.length/3,renderTriangles:detailed.index.count/3,radii:caps.map(c=>c.radius),threaded:!!worker};
  }
  const dispose=()=>{worker?.terminate();worker=null;};
  return {mesh,garment,underlayer,innerShirt,update,dispose,caps,positions,rest,edges,get threaded(){return !!worker;}};
}
