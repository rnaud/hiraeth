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

/**
 * The garment's vertex shader (gpu): what update() did a vertex at a time on the main thread (docs/systems/
 * performance.md). The vertex is the rigid rest shape on the attachment bone (uGarmentRigid) eased into its
 * skinned place (three's skinning, from the bone texture) by 1 - its freedom; plus its cell's displacement off
 * the targets (uClothP - uClothG, bilinear, times the freedom); then, while simulated and nearly free, pushed
 * out of the leg capsules along its outward direction. Its normal: the rest normal turned the same way (rigid,
 * skinned), then by the cage's own turn in its cell (its normal over the targets to over the particles).
 */
export const GARMENT_CAPS=5;   // the leg capsules (each thigh and shin, and the crotch's)
export const GARMENT_GLSL=`
  uniform mat4 uGarmentRigid;
  uniform sampler2D uClothP, uClothG;
  uniform vec4 uGarmentCapA[${GARMENT_CAPS}], uGarmentCapB[${GARMENT_CAPS}];
  uniform float uGarmentSim;
  in vec4 aCage;
  in vec3 aOutward;
  vec3 garmentAt(sampler2D t, int i) { return texelFetch(t, ivec2(i, 0), 0).xyz; }
  float garmentD2(float t, vec3 x, vec3 o, vec3 a, vec3 ax, float l2) { vec3 d = x + o * t - a; vec3 q = d - clamp(dot(d, ax) / l2, 0.0, 1.0) * ax; return dot(q, q); }
`;
/** Patch a makeMaterial ShaderMaterial to draw the overshirt (GARMENT_GLSL), `cols` columns of cells in its cage. */
export function garmentShader(material,cols){
 if(material.defines?.GARMENT)return material;
 const vs=material.vertexShader,skinEnd='#include <skinning_vertex>\n    #endif\n',at=vs.indexOf(skinEnd);
 if(at<0||!vs.includes('vObjNormal = normal / scl;'))throw new Error('tripo-cloth: the material\'s vertex shader changed (no skinning block to move the garment after)');
 const main=vs.indexOf('void main()');
 const body=garmentBody(cols);
 material.vertexShader=vs.slice(0,main)+GARMENT_GLSL+'\n  '+vs.slice(main,at+skinEnd.length)+body+vs.slice(at+skinEnd.length);
 return finishGarment(material);
}
/** The vertex shader's own steps (after three's skinning chunks: `transformed`, `objectNormal` skinned). */
function garmentBody(cols){
 return `    {
      // the overshirt (tripo-cloth.js garmentShader)
      float free = aCage.w, sk = 1.0 - free;
      vec3 p = mix((uGarmentRigid * vec4(position, 1.0)).xyz, transformed, sk);
      vec3 nn = normalize(mix(mat3(uGarmentRigid) * normal, objectNormal, sk));
      if (free > 0.0) {
        int i0 = int(aCage.x + 0.5), i1 = i0 + 1, i2 = i0 + ${cols+1}, i3 = i2 + 1;
        float u = aCage.y, v = aCage.z;
        vec3 P0 = garmentAt(uClothP, i0), P1 = garmentAt(uClothP, i1), P2 = garmentAt(uClothP, i2), P3 = garmentAt(uClothP, i3);
        vec3 G0 = garmentAt(uClothG, i0), G1 = garmentAt(uClothG, i1), G2 = garmentAt(uClothG, i2), G3 = garmentAt(uClothG, i3);
        p += ((P0 - G0) * (1.0 - u) * (1.0 - v) + (P1 - G1) * u * (1.0 - v) + (P2 - G2) * (1.0 - u) * v + (P3 - G3) * u * v) * free;
        vec3 a = normalize(cross(mix(G1 - G0, G3 - G2, v), mix(G2 - G0, G3 - G1, u)));
        vec3 b = normalize(mix(a, normalize(cross(mix(P1 - P0, P3 - P2, v), mix(P2 - P0, P3 - P1, u))), free));
        vec3 ax = cross(a, b); float c = dot(a, b);
        if (c > -0.95) nn = nn * c + cross(ax, nn) + ax * (dot(ax, nn) / (1.0 + c));
        if (uGarmentSim > 0.5 && free > 0.95) for (int k = 0; k < ${GARMENT_CAPS}; k++) {
          vec4 A = uGarmentCapA[k], B = uGarmentCapB[k];
          float r2 = A.w * A.w;
          if (A.w <= 0.0 || garmentD2(0.0, p, aOutward, A.xyz, B.xyz, B.w) >= r2) continue;
          float lo = 0.0, hi = A.w * 3.0;
          for (int i = 0; i < 14; i++) { float mid = 0.5 * (lo + hi); if (garmentD2(mid, p, aOutward, A.xyz, B.xyz, B.w) < r2) lo = mid; else hi = mid; }
          p += aOutward * hi;
          // pressed against the leg, the cloth faces away from its axis (the main thread's normals, worked out from that shape, did)
          vec3 d = p - A.xyz, q = d - clamp(dot(d, B.xyz) / B.w, 0.0, 1.0) * B.xyz;
          nn = normalize(mix(nn, normalize(q), clamp(hi / 0.012, 0.0, 1.0)));
        }
      }
      transformed = p; objectNormal = normalize(nn);
    }
`;
}
function finishGarment(material){
 material.vertexShader=material.vertexShader.replace('vObjNormal = normal / scl;','vObjNormal = normal / scl;\n    #ifdef GARMENT\n      vObjPos = transformed * scl; vObjNormal = objectNormal / scl;   // (strokes on the moving cloth, as when it was rewritten here)\n    #endif');
 material.defines={...material.defines,GARMENT:1};
 Object.assign(material.uniforms,{uGarmentRigid:{value:new T.Matrix4()},uClothP:{value:null},uClothG:{value:null},uGarmentSim:{value:0},uGarmentCapA:{value:Array.from({length:GARMENT_CAPS},()=>new T.Vector4())},uGarmentCapB:{value:Array.from({length:GARMENT_CAPS},()=>new T.Vector4(0,0,0,1))}});
 material.needsUpdate=true;
 return material;
}
/**
 * The garment in the shadow maps (gpu): the scene's shadow passes draw everything with one plain material,
 * which would skin the garment but not move it with the cage, so its shadow fell where it isn't and shaded
 * it in patches. It is left out of them (Humanoid.noShadow) and this draws it there instead, the same shape
 * (main.js shadowPass: a character's shadowCasters, each drawn with its own material).
 */
export function garmentDepthMaterial(cols){
 const m=new T.ShaderMaterial({side:T.DoubleSide,colorWrite:false,
  vertexShader:`#include <common>
  #include <skinning_pars_vertex>
  ${GARMENT_GLSL}
  void main() {
    vec3 transformed = position;
    vec3 objectNormal = normal;
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <skinning_vertex>
${garmentBody(cols)}
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }`,
  fragmentShader:'void main() { gl_FragColor = vec4(1.0); }'});
 m.defines={GARMENT:1};
 Object.assign(m.uniforms,{uGarmentRigid:{value:new T.Matrix4()},uClothP:{value:null},uClothG:{value:null},uGarmentSim:{value:0},uGarmentCapA:{value:Array.from({length:GARMENT_CAPS},()=>new T.Vector4())},uGarmentCapB:{value:Array.from({length:GARMENT_CAPS},()=>new T.Vector4(0,0,0,1))}});
 return m;
}

/**
 * Where an engine takes the overshirt's work over (engine/game.js sets it before the traveller is made): an
 * object { init(desc), frame(packet) }. Then the cage's steps, the garment's vertices and their normals are the
 * engine's (in Unity a Burst job: engine/unity/backend.js clothOffload), fed each frame what this module works
 * out from the bones (the targets, the capsules, the bones' and the attachment's matrices); the garment's
 * geometry is left as it is here. null: everything here (the web: the cage in a worker, the rest on this thread).
 */
export const CLOTH_HOST = { offload: null };

// Drive the original textured lower overshirt with a regular open-front cage.
// useWorker: simulate the cage in a worker (the game; tests and pages without workers step it here)
// gpu: the garment is skinned and moved by the cage in its vertex shader (garmentShader: the game; its
// material is patched once made, gpuMaterial), not rewritten here a vertex at a time (tests: the arrays, here)
// offload: an engine's (CLOTH_HOST): the cage, the garment and its normals are its own (neither a worker nor gpu)
export function makeTripoCloth(source, colors, { offload = CLOTH_HOST.offload, useWorker = !offload && typeof window !== 'undefined' && typeof Worker !== 'undefined', gpu = !offload && typeof window !== 'undefined' } = {}) {
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
  const garmentGeometry=compactGeometry(detailed,used,gpu?[]:['skinIndex','skinWeight']);
  // (its normals at rest as they were worked out each frame from the shape: the shader turns these)
  if(gpu)vertexNormals(garmentGeometry);
  const garmentMaterial=source.material.clone();garmentMaterial.side=T.DoubleSide;
  const lining=new T.Color().setHex(0xb46249, T.LinearSRGBColorSpace).convertSRGBToLinear();
  garmentMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(${lining.r},${lining.g},${lining.b});`);};
  garmentMaterial.customProgramCacheKey=()=> 'tripo-cloth-lining-v1';
  const garment=gpu?new T.SkinnedMesh(garmentGeometry,garmentMaterial):new T.Mesh(garmentGeometry,garmentMaterial);garment.frustumCulled=false;source.parent.add(garment);
  if(gpu)garment.bind(source.skeleton,source.bindMatrix);
  // (its shadow, the same shape: drawn by the shadow passes on its own, garmentDepthMaterial)
  let shadow=null;
  if(gpu){shadow=new T.SkinnedMesh(garmentGeometry,garmentDepthMaterial(COLS));shadow.name='TravellerOvershirt shadow';shadow.bindMode='detached';shadow.bind(source.skeleton,source.bindMatrix);shadow.frustumCulled=false;shadow.matrixAutoUpdate=false;shadow.matrixWorldAutoUpdate=false;}
  const mapping=used.map((i,o)=>{const p=V().fromArray(detailedRest,i*3),u=clamp((angleOf(p)-START)/(END-START)*COLS,0,COLS-.000001),v=clamp((TOP+.025-p.y)/(TOP+.025-BOTTOM)*ROWS,0,ROWS-.000001),c=Math.floor(u),r=Math.floor(v);return {i,o,p,ids:[id(r,c),id(r,c+1),id(r+1,c),id(r+1,c+1)],weights:[(1-u+c)*(1-v+r),(u-c)*(1-v+r),(1-u+c)*(v-r),(u-c)*(v-r)],free:T.MathUtils.smoothstep(TOP-p.y,0,.10),local:p.clone().applyMatrix4(source.matrixWorld).applyMatrix4(inverseAttachment),outward:new T.Vector3(p.x,0,p.z+.016).normalize()};});
  // the shader's inputs (gpu): each vertex's cell (its first particle, where in it, its freedom) and its outward
  // direction; the particles and their targets, a texel each, every frame; the rest shape onto the attachment bone
  let gpuState=null;
  if(gpu){
    const cell=new Float32Array(mapping.length*4),outward=new Float32Array(mapping.length*3);
    mapping.forEach((m,v)=>{const p=m.p,u=clamp((angleOf(p)-START)/(END-START)*COLS,0,COLS-.000001),w=clamp((TOP+.025-p.y)/(TOP+.025-BOTTOM)*ROWS,0,ROWS-.000001),c=Math.floor(u),r=Math.floor(w);cell.set([id(r,c),u-c,w-r,m.free],v*4);outward.set([m.outward.x,m.outward.y,m.outward.z],v*3);});
    garmentGeometry.setAttribute('aCage',new T.BufferAttribute(cell,4));garmentGeometry.setAttribute('aOutward',new T.BufferAttribute(outward,3));
    const tex=()=>{const t=new T.DataTexture(new Float32Array(rest.length*4),rest.length,1,T.RGBAFormat,T.FloatType);t.minFilter=t.magFilter=T.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;};
    gpuState={P:tex(),G:tex(),restToAttach:source.matrixWorld.clone().premultiply(inverseAttachment),rigid:new T.Matrix4(),capA:Array.from({length:GARMENT_CAPS},()=>new T.Vector4()),capB:Array.from({length:GARMENT_CAPS},()=>new T.Vector4(0,0,0,1))};
  }
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
  const simTarget=new Float64Array(N*3),D=new Float64Array(N*3);
  // the garment's vertices as flat arrays: where each sits on the attachment bone, its four particles (as
  // offsets into the particle arrays) with their weights already times its freedom, its outward direction
  const mapArrays={count:mapping.length,local:new Float64Array(mapping.length*3),ids:new Int32Array(mapping.length*4),weights:new Float64Array(mapping.length*4),free:new Float64Array(mapping.length),outward:new Float64Array(mapping.length*3),out:new Int32Array(mapping.length)};
  mapping.forEach((m,v)=>{const A=mapArrays;A.local.set([m.local.x,m.local.y,m.local.z],v*3);A.outward.set([m.outward.x,m.outward.y,m.outward.z],v*3);A.free[v]=m.free;A.out[v]=m.o*3;for(let k=0;k<4;k++){A.ids[v*4+k]=m.ids[k]*3;A.weights[v*4+k]=m.weights[k]*m.free;}});
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
  const skeleton=source.skeleton,boneSkin=skeleton.bones.map(()=>new T.Matrix4()),boneMesh=skeleton.bones.map(()=>new T.Matrix4());
  const sourceSkin=[original.attributes.skinIndex.array,original.attributes.skinWeight.array];
  const detailSkin=[detailed.attributes.skinIndex.array,detailed.attributes.skinWeight.array];
  // the garment's skinned vertices (free < 1): their rest places in bind space and their bones, worked out once
  {
    const A=mapArrays,[idx,wts]=detailSkin,b=new T.Vector3();A.base=new Float64Array(A.count*3);A.skinB=new Int32Array(A.count*4);A.skinW=new Float64Array(A.count*4);
    mapping.forEach((m,v)=>{if(m.free>=1)return;b.copy(m.p).applyMatrix4(skinSource.bindMatrix);A.base.set([b.x,b.y,b.z],v*3);for(let k=0;k<4;k++){A.skinB[v*4+k]=idx[m.i*4+k];A.skinW[v*4+k]=wts[m.i*4+k];}});
  }
  // an engine's own (CLOTH_HOST): everything it needs that never changes, once; then a packet a frame (update)
  const packet=offload?{G,simCaps,mapCaps,boneMesh:new Float64Array(boneMesh.length*16),attach:new Float64Array(16),steps:0,reset:true,simulated:false}:null;
  if(offload)offload.init({garment,N,caps:caps.length,constants,map:mapArrays,index:garmentGeometry.index.array,vertices:garmentGeometry.attributes.position.count,bones:boneMesh.length});
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
    if(!gpu)for(let b=0;b<boneSkin.length;b++)boneMesh[b].multiplyMatrices(source.bindMatrixInverse,boneSkin[b]);   // (the vertex loop's; the shader has three's)
    toLocal.copy(source.matrixWorld).invert();
    // (the attachment bone into the mesh's space as one affine matrix: one product a point, not two)
    attachToLocal.multiplyMatrices(toLocal,attachment.matrixWorld);
    for(let i=0;i<target.length;i++)target[i].copy(attachmentRest[i]).applyMatrix4(attachToLocal);
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
      if(offload){
        packet.steps=steps;
      }else if(worker){
        pendingSteps=Math.min(pendingSteps+steps,9);   // (a worker that fell behind: at most a tenth of a second to catch up)
        if(!waiting&&pendingSteps){
          const msg={type:'step',id:++requestId,G:G.slice(),caps:simCaps.slice(),steps:pendingSteps,reset:reset?G.slice():null};
          worker.postMessage(msg,[msg.G.buffer,msg.caps.buffer,...(msg.reset?[msg.reset.buffer]:[])]);   // (handed over, not copied again)
          waiting=true;pendingSteps=0;reset=false;
        }
      }else if(steps){
        simulate(sim,G,simCaps,steps);simTarget.set(G);
        for(let i=0;i<N;i++){positions[i].set(sim.P[i*3],sim.P[i*3+1],sim.P[i*3+2]);previous[i].set(sim.Q[i*3],sim.Q[i*3+1],sim.Q[i*3+2]);}
      }
    }
    if(offload){
      // the rest is the engine's: the bones (bind inverse folded in) and the attachment into the mesh's space
      for(let b=0;b<boneMesh.length;b++)packet.boneMesh.set(boneMesh[b].elements,b*16);
      packet.attach.set(attachToLocal.multiplyMatrices(toLocal,attachment.matrixWorld).elements);
      packet.simulated=simulated;if(!simulated)packet.steps=0;packet.reset=reset;reset=false;
      offload.frame(packet);
      return {particles:N,triangles:renderIndex.length/3,renderTriangles:detailed.index.count/3,radii:caps.map(c=>c.radius),threaded:true,offloaded:true};
    }
    const cage=geo.attributes.position.array;
    if(mesh.visible||!gpu){for(let i=0;i<N;i++){cage[i*3]=positions[i].x;cage[i*3+1]=positions[i].y;cage[i*3+2]=positions[i].z;}}
    const out=garmentGeometry.attributes.position.array,P=sim.P;
    const e=attachToLocal.elements;
    if(gpu){
      // the shader does the rest (garmentShader): the particles and their targets, the rigid frame, the legs
      const S=gpuState,tp=S.P.image.data,tg=S.G.image.data;
      for(let i=0;i<N;i++){tp[i*4]=P[i*3];tp[i*4+1]=P[i*3+1];tp[i*4+2]=P[i*3+2];tg[i*4]=simTarget[i*3];tg[i*4+1]=simTarget[i*3+1];tg[i*4+2]=simTarget[i*3+2];}
      S.P.needsUpdate=S.G.needsUpdate=true;
      S.rigid.multiplyMatrices(attachToLocal,S.restToAttach);
      if(caps.length>GARMENT_CAPS)throw new Error('tripo-cloth: more leg capsules than the shader takes');
      for(let k=0;k<GARMENT_CAPS;k++){const c=k*CAP;if(k<caps.length){S.capA[k].set(mapCaps[c],mapCaps[c+1],mapCaps[c+2],mapCaps[c+7]);S.capB[k].set(mapCaps[c+3],mapCaps[c+4],mapCaps[c+5],mapCaps[c+6]);}else S.capA[k].set(0,0,0,0);}
      // (on the garment's material now: markHero gives the player copies of his, uniforms and all)
      for(const m of [garment.material,shadow.material]){
        const u=m.uniforms;
        if(u?.uClothP){u.uClothP.value=S.P;u.uClothG.value=S.G;u.uGarmentRigid.value.copy(S.rigid);u.uGarmentSim.value=simulated?1:0;for(let k=0;k<GARMENT_CAPS;k++){u.uGarmentCapA.value[k].copy(S.capA[k]);u.uGarmentCapB.value[k].copy(S.capB[k]);}}
      }
      garment.updateMatrixWorld();shadow.matrixWorld.copy(garment.matrixWorld);shadow.bindMatrixInverse.copy(garment.bindMatrixInverse);
      if(mesh.visible){geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();}
      return {particles:positions.length,triangles:renderIndex.length/3,renderTriangles:detailed.index.count/3,radii:caps.map(c=>c.radius),threaded:!!worker,gpu:true};
    }
    // each particle's displacement off its target, once; then every vertex from the flat arrays (mapArrays)
    for(let j=0;j<N*3;j++)D[j]=P[j]-simTarget[j];
    const M=mapArrays;
    for(let v=0;v<M.count;v++){
      const l=v*3,lx=M.local[l],ly=M.local[l+1],lz=M.local[l+2],free=M.free[v];
      let x=e[0]*lx+e[4]*ly+e[8]*lz+e[12],y=e[1]*lx+e[5]*ly+e[9]*lz+e[13],z=e[2]*lx+e[6]*ly+e[10]*lz+e[14];
      // (a vertex the cloth moves all by itself, free = 1, doesn't need its skinned place: lerp by 0)
      if(free<1){
        // skinned: its four bones' matrices (bind inverse folded in, once a frame) on its bind-space rest place (once)
        let sx=0,sy=0,sz=0;const bx=M.base[l],by=M.base[l+1],bz=M.base[l+2];
        for(let k=v*4,end=k+4;k<end;k++){const w=M.skinW[k];if(w===0)continue;const c=boneMesh[M.skinB[k]].elements;sx+=(c[0]*bx+c[4]*by+c[8]*bz+c[12])*w;sy+=(c[1]*bx+c[5]*by+c[9]*bz+c[13])*w;sz+=(c[2]*bx+c[6]*by+c[10]*bz+c[14])*w;}
        const t=1-free;x+=(sx-x)*t;y+=(sy-y)*t;z+=(sz-z)*t;
      }
      if(free>0)for(let k=v*4,end=k+4;k<end;k++){const j=M.ids[k],w=M.weights[k];x+=D[j]*w;y+=D[j+1]*w;z+=D[j+2]*w;}
      if(simulated&&free>.95){const ox=M.outward[l],oy=M.outward[l+1],oz=M.outward[l+2];for(let k=0,c=0;k<caps.length;k++,c+=CAP){if(x<mapCaps[c+8]||x>mapCaps[c+11]||y<mapCaps[c+9]||y>mapCaps[c+12]||z<mapCaps[c+10]||z>mapCaps[c+13])continue;const hi=pushOut(x,y,z,ox,oy,oz,mapCaps,k);if(hi){x+=ox*hi;y+=oy*hi;z+=oz*hi;}}}   // (the box first, here: most vertices are nowhere near a leg)
      const o=M.out[v];out[o]=x;out[o+1]=y;out[o+2]=z;
    }
    garmentGeometry.attributes.position.needsUpdate=true;vertexNormals(garmentGeometry);
    // (the regular cage itself is never drawn: its normals only when it is shown, for a debug view)
    geo.attributes.position.needsUpdate=true;if(mesh.visible)geo.computeVertexNormals();
    return {particles:positions.length,triangles:renderIndex.length/3,renderTriangles:detailed.index.count/3,radii:caps.map(c=>c.radius),threaded:!!worker};
  }
  const dispose=()=>{worker?.terminate();worker=null;};
  /** Draw the garment with `material` (a makeMaterial ShaderMaterial): with gpu, its vertex shader skins it and moves it with the cage. */
  const gpuMaterial=(material)=>{if(gpu)garmentShader(material,COLS);return material;};
  return {mesh,garment,shadow,underlayer,innerShirt,update,dispose,caps,positions,rest,edges,gpuMaterial,gpu,get gpuState(){return gpuState;},get threaded(){return !!worker;}};
}
