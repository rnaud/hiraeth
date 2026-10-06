import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
const {parseBody,makeBody}=await import('../../src/makehuman/body.js');
const {Humanoid}=await import('../../src/humanoid.js');
const {buildCharacter}=await import('../../src/player.js');
const {Animator,libraryFrom}=await import('../../src/animator.js');
const {relaxWalkArms}=await import('../../tools/tripo-walk.js');
const {fitDonorToSurface}=await import('../../tools/tripo-fit.js');
const bytes=readFileSync('public/anim/ual.glb');
const lib=libraryFrom(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));
const b=readFileSync('public/anim/mh/body.bin'),data=parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const report=JSON.parse(readFileSync('output/character-tripo/rig-prototype.glb.json'));
const g=readFileSync('output/character-tripo/rig-prototype.glb'),n=g.readUInt32LE(12),json=JSON.parse(g.toString('utf8',20,20+n)),bin=g.subarray(28+n);
const acc=json.accessors[json.meshes[0].primitives[0].attributes.POSITION],view=json.bufferViews[acc.bufferView],surface=[];
for(let i=0;i<acc.count;i++){const o=(view.byteOffset??0)+(acc.byteOffset??0)+i*(view.byteStride??12);surface.push(new T.Vector3(bin.readFloatLE(o),bin.readFloatLE(o+4),bin.readFloatLE(o+8)));}

const {makeTripoCloth}=await import('../../tools/tripo-cloth.js');
globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
json.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];delete json.images;delete json.textures;delete json.materials;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let source;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)source=o;});
const template=makeBody(data,report.params);fitDonorToSurface(template,surface);
const char=buildCharacter(),h=new Humanoid(template,char,'m'),a=new Animator(lib,char);
h.body.skeleton.pose();char.root.updateMatrixWorld(true);
const mesh=new T.SkinnedMesh(source.geometry,new T.MeshStandardMaterial());h.body.parent.add(mesh);mesh.bind(h.body.skeleton,h.body.bindMatrix);char.root.updateMatrixWorld(true);
const cloth=makeTripoCloth(mesh,JSON.parse(readFileSync('output/character-tripo/baseline/vertex-colors.json')));
// With no leg motion, collision must not inflate the original rear silhouette.
const usedGarment=[...new Set(cloth.garment.geometry.index.array)];
const rearExtent=()=>Math.min(...usedGarment.map(i=>cloth.garment.geometry.attributes.position.getZ(i)));
cloth.update(0,'rest');const restRear=rearExtent();
for(let i=0;i<90;i++)cloth.update(1/90,'idle');
const rearInflation=restRear-rearExtent();
if(rearInflation>.025)throw new Error(`Idle coat balloons behind the source silhouette by ${rearInflation} m`);
cloth.update(0,'rest');
const motionName=process.argv[2]??'walk';
let minTriangleClearance=Infinity,minClearance=Infinity,maxStretch=0,maxMotion=0,worst=null;const start=performance.now();
for(let frame=0;frame<120;frame++){
 for(const [key,action]of Object.entries(a.actions)){action.setEffectiveWeight(key===motionName?1:0);if(key===motionName)action.time=(frame/30)%lib.clips[motionName].duration;}
 a.mixer.update(0);a.src.updateMatrixWorld(true);a.apply(char.root);relaxWalkArms(char,motionName);h.update();char.root.updateMatrixWorld(true);cloth.update(1/30,motionName);
 for(let i=33;i<cloth.positions.length;i++){const p=cloth.positions[i];if(!p.toArray().every(Number.isFinite)||p.length()>3)throw new Error('Unstable cloth');maxMotion=Math.max(maxMotion,p.distanceTo(cloth.rest[i]));for(const c of cloth.caps){const axis=c.to.clone().sub(c.from),t=T.MathUtils.clamp(p.clone().sub(c.from).dot(axis)/axis.lengthSq(),0,1);minClearance=Math.min(minClearance,p.distanceTo(c.from.clone().addScaledVector(axis,t))-c.radius);}}
 const renderP=cloth.garment.geometry.attributes.position,used=new Set(cloth.garment.geometry.index.array);
 for(const i of used){const p=new T.Vector3().fromBufferAttribute(renderP,i);if(!p.toArray().every(Number.isFinite)||p.length()>3)throw new Error('Unstable render cloth');}
 const idx=cloth.mesh.geometry.index;
 for(let i=0;i<idx.count;i+=3){const p=new T.Vector3();for(let k=0;k<3;k++)p.add(cloth.positions[idx.getX(i+k)]);p.divideScalar(3);for(const c of cloth.caps){const axis=c.to.clone().sub(c.from),t=T.MathUtils.clamp(p.clone().sub(c.from).dot(axis)/axis.lengthSq(),0,1);minTriangleClearance=Math.min(minTriangleClearance,p.distanceTo(c.from.clone().addScaledVector(axis,t))-c.radius);}}
 for(const [i,j,d]of cloth.edges){const ratio=cloth.positions[i].distanceTo(cloth.positions[j])/d;if(ratio>maxStretch){maxStretch=ratio;worst={i,j,restA:cloth.rest[i].toArray(),restB:cloth.rest[j].toArray(),a:cloth.positions[i].toArray(),b:cloth.positions[j].toArray()};}}
}
console.log(JSON.stringify({motion:motionName,rearInflation,minTriangleClearance,radii:cloth.caps.map(c=>c.radius),frames:120,minClearance,maxStretch,maxMotion,milliseconds:performance.now()-start},null,2));
if(minClearance<-.001)throw new Error('Cloth penetrates trouser colliders');

if(minTriangleClearance<0)throw new Error('Cloth face centroids penetrate trouser colliders');
