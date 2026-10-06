import { makeUnderlayer, makeInnerShirt, separateShirt, fitTrouserWeights, isShirtColor, shadeTrouserRepair, removeTrouserBand } from './tripo-garment-geometry.js';
import * as T from 'three';

const V = () => new T.Vector3();
const clamp = T.MathUtils.clamp;
const TOP = 1.22, BOTTOM = .69, COLS = 32, ROWS = 14;
const START = .40, END = Math.PI * 2 - START;
const angleOf = p => { let a = Math.atan2(p.x, p.z + .016); return a < 0 ? a + Math.PI * 2 : a; };
const red = isShirtColor;

export function projectOutward(p,a,b,radius,outward){
 const ax=b.x-a.x,ay=b.y-a.y,az=b.z-a.z,length2=Math.max(ax*ax+ay*ay+az*az,1e-10);
 const x=p.x,y=p.y,z=p.z,r2=radius*radius;
 const distance2=t=>{const dx=x+outward.x*t-a.x,dy=y+outward.y*t-a.y,dz=z+outward.z*t-a.z,u=clamp((dx*ax+dy*ay+dz*az)/length2,0,1),qx=dx-u*ax,qy=dy-u*ay,qz=dz-u*az;return qx*qx+qy*qy+qz*qz;};
 if(distance2(0)>=r2)return 0;
 let lo=0,hi=radius*3;
 for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(distance2(mid)<r2)lo=mid;else hi=mid;}
 p.addScaledVector(outward,hi);return hi;
}

// Drive the original textured lower overshirt with a regular open-front cage.
export function makeTripoCloth(source, colors) {
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
  const garmentGeometry=detailed.clone();garmentGeometry.deleteAttribute('skinIndex');garmentGeometry.deleteAttribute('skinWeight');
  const garmentMaterial=source.material.clone();garmentMaterial.side=T.DoubleSide;
  const lining=new T.Color().setHex(0xb46249, T.LinearSRGBColorSpace).convertSRGBToLinear();
  garmentMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(${lining.r},${lining.g},${lining.b});`);};
  garmentMaterial.customProgramCacheKey=()=> 'tripo-cloth-lining-v1';
  const garment=new T.Mesh(garmentGeometry,garmentMaterial);garment.frustumCulled=false;source.parent.add(garment);
  const used=[...new Set(Array.from(detailed.index.array))];
  const mapping=used.map(i=>{const p=V().fromArray(detailedRest,i*3),u=clamp((angleOf(p)-START)/(END-START)*COLS,0,COLS-.000001),v=clamp((TOP+.025-p.y)/(TOP+.025-BOTTOM)*ROWS,0,ROWS-.000001),c=Math.floor(u),r=Math.floor(v);return {i,p,ids:[id(r,c),id(r,c+1),id(r+1,c),id(r+1,c+1)],weights:[(1-u+c)*(1-v+r),(u-c)*(1-v+r),(1-u+c)*(v-r),(u-c)*(v-r)],free:T.MathUtils.smoothstep(TOP-p.y,0,.10),local:p.clone().applyMatrix4(source.matrixWorld).applyMatrix4(inverseAttachment)};});
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
  const current=V(),delta=V();
  function update(dt,motion,enabled=true){
    source.skeleton.update();source.updateMatrixWorld(true);
    // These CPU skinning proxies are detached from the scene. Follow the real
    // mesh's inverse world bind or a travelling character leaves its hem behind.
    skinSource.bindMatrixInverse.copy(source.bindMatrixInverse);
    skinDetail.bindMatrixInverse.copy(source.bindMatrixInverse);
    const toLocal=source.matrixWorld.clone().invert();
    for(let i=0;i<target.length;i++)target[i].copy(attachmentRest[i]).applyMatrix4(attachment.matrixWorld).applyMatrix4(toLocal);
    for(let i=0;i<=COLS;i++){const s=top[i],a=rest[i].clone(),b=rest[i].clone();skinSource.applyBoneTransform(s.a,a);skinSource.applyBoneTransform(s.b,b);target[i].copy(a.lerp(b,s.t));}
    for(const c of caps){c.from.copy(c.localFrom).applyMatrix4(c.a.matrixWorld).applyMatrix4(toLocal);c.to.copy(c.localTo).applyMatrix4(c.b.matrixWorld).applyMatrix4(toLocal);}
    if(!initialized||motion!==lastMotion||!enabled||motion==='rest'){
      for(let i=0;i<positions.length;i++){positions[i].copy(target[i]);previous[i].copy(target[i]);}
      initialized=true;accumulator=0;lastMotion=motion;
    }
    if(enabled&&motion!=='rest'){
      accumulator+=Math.min(dt,.05);
      const step=1/90;
      while(accumulator>=step){
        accumulator-=step;
        for(let i=0;i<positions.length;i++){
          if(!pins[i]){positions[i].copy(target[i]);previous[i].copy(target[i]);continue;}
          current.copy(positions[i]);delta.subVectors(positions[i],previous[i]).multiplyScalar(.90);
          positions[i].add(delta);positions[i].y-=1.5*step*step;
          // Gentle tether preserves the coat's tailored volume; gravity and leg
          // contact remain free to move the hem away from its animated rest shape.
          positions[i].lerp(target[i],.02);previous[i].copy(current);
        }
        for(let iteration=0;iteration<18;iteration++){
          for(const [a,b,length,k]of edges){delta.subVectors(positions[b],positions[a]);const d=delta.length(),w=pins[a]+pins[b];if(d<1e-8||!w)continue;delta.multiplyScalar((d-length)/d*k/w);if(pins[a])positions[a].addScaledVector(delta,pins[a]);if(pins[b])positions[b].addScaledVector(delta,-pins[b]);}
          for(let i=0;i<positions.length;i++){
            if(!pins[i]){positions[i].copy(target[i]);continue;}
            // Keep each panel on its original side of the body. A nearest-point
            // push can send a front panel into the crotch between overlapping legs.
            const outward=new T.Vector3(rest[i].x,0,rest[i].z+.016).normalize();
            for(const c of caps)projectOutward(positions[i],c.from,c.to,c.radius+.012,outward);
            const inward=delta.subVectors(positions[i],target[i]).dot(outward);if(inward<-.02)positions[i].addScaledVector(outward,-.02-inward);
          }
        }
      }
    }
    for(let i=0;i<positions.length;i++)geo.attributes.position.setXYZ(i,positions[i].x,positions[i].y,positions[i].z);
    for(const m of mapping){
      const p=m.local.clone().applyMatrix4(attachment.matrixWorld).applyMatrix4(toLocal);
      const skinned=m.p.clone();skinDetail.applyBoneTransform(m.i,skinned);p.lerp(skinned,1-m.free);
      for(let k=0;k<4;k++)p.addScaledVector(delta.subVectors(positions[m.ids[k]],target[m.ids[k]]),m.weights[k]*m.free);
      if(enabled&&motion!=='rest'&&m.free>.95){const outward=new T.Vector3(m.p.x,0,m.p.z+.016).normalize();for(const c of caps)projectOutward(p,c.from,c.to,c.radius+.008,outward);}
      garmentGeometry.attributes.position.setXYZ(m.i,p.x,p.y,p.z);
    }
    garmentGeometry.attributes.position.needsUpdate=true;garmentGeometry.computeVertexNormals();
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();
    return {particles:positions.length,triangles:renderIndex.length/3,renderTriangles:detailed.index.count/3,radii:caps.map(c=>c.radius)};
  }
  return {mesh,garment,underlayer,innerShirt,update,caps,positions,rest,edges};
}
