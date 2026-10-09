// Weight transfer onto the repo's MakeHuman skeleton. Generic outputs remain
// experiments; --father applies the measured stationary-recording asset fit.
// This does not create a hidden body, cloth, or exported facial expressions.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { fitDonorToSurface } from '../../tools/tripo-fit.js';
import { fitFatherToSurface, fatherBodyWeights } from '../../src/characters/father-fit.js';
import { MeshBVH } from 'three-mesh-bvh';
const el = () => ({ classList:{add(){},remove(){},toggle(){}}, style:{}, dataset:{}, addEventListener(){}, appendChild(){}, remove(){}, querySelector(){return null;} });
globalThis.document ??= { createElement:el,body:el(),getElementById:()=>null,querySelector:()=>null };
const { parseBody, makeBody } = await import('../../src/makehuman/body.js');
const { personParams } = await import('../../src/makehuman/shape.js');
const input = process.argv[2] ?? 'output/character-tripo/baseline/model.glb';
const output = process.argv[3] ?? 'output/character-tripo/rig-prototype.glb';
const father = process.argv.includes('--father');
const source = readFileSync(input);
if (source.toString('ascii',0,4)!=='glTF') throw new Error('Expected GLB');
const jsonSize=source.readUInt32LE(12), g=JSON.parse(source.toString('utf8',20,20+jsonSize));
const binStart=28+jsonSize, bin=source.subarray(binStart,binStart+source.readUInt32LE(20+jsonSize));
if(g.skins?.length) throw new Error('Input already rigged');
const mh=readFileSync('public/anim/mh/body.bin');
const params=personParams({kind:'m',years:26,build:'slim',world:'desert'});
const donor=makeBody(parseBody(mh.buffer.slice(mh.byteOffset,mh.byteOffset+mh.byteLength)),params);
const body=donor.getObjectByName('Body');
let geo=body.geometry.clone();
geo.computeBoundingBox();
const skeleton=body.skeleton;

function positions(p){
 const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView];
 if(a.componentType!==5126||a.type!=='VEC3')throw new Error('Unsupported positions');
 const points=[];
 for(let i=0;i<a.count;i++){let k=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12);points.push(new THREE.Vector3(bin.readFloatLE(k),bin.readFloatLE(k+4),bin.readFloatLE(k+8)));}
 return points;
}
if(g.nodes.some(n=>n.mesh!==undefined&&(n.matrix||n.translation||n.rotation||n.scale)))throw new Error('Bake mesh transforms first');
const colorFile=father?'data/characters/father-v1/colors.json':'output/character-tripo/baseline/vertex-colors.json';
const colors=(father||input==='output/character-tripo/baseline/model.glb')&&existsSync(colorFile)?JSON.parse(readFileSync(colorFile,'utf8')):null;
const meshes=g.meshes.flatMap(m=>m.primitives.map(p=>({p,points:positions(p)})));
const box=new THREE.Box3().setFromPoints(meshes.flatMap(m=>m.points));
const baseY=geo.boundingBox.min.y;
const height=geo.boundingBox.max.y-baseY, factor=height/(box.max.y-box.min.y);
const fittedSurface=meshes.flatMap(m=>m.points.map(p=>new THREE.Vector3(p.x*factor,(p.y-box.min.y)*factor+baseY,p.z*factor)));
const fit=(father?fitFatherToSurface:fitDonorToSurface)(donor,fittedSurface);
geo=body.geometry.clone();
const bvh=new MeshBVH(geo,{indirect:true});
let chunks=[bin],length=bin.length;
function append(array,type,componentType,min,max){
 const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=g.bufferViews.length;
 g.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;
 const idx=g.accessors.length;g.accessors.push({bufferView:view,componentType,count:array.length/({SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type]),type,...(min?{min,max}: {})});return idx;
}
const pDonor=geo.attributes.position, jDonor=geo.attributes.skinIndex,wDonor=geo.attributes.skinWeight;
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),bary=new THREE.Vector3();
const distances=[];
for(const {p,points} of meshes){
 const pos=new Float32Array(points.length*3),joints=new Uint16Array(points.length*4),weights=new Float32Array(points.length*4),bounds=new THREE.Box3();
 points.forEach((pt,i)=>{
  pt.x*=factor;pt.y=(pt.y-box.min.y)*factor+baseY;pt.z*=factor;pt.toArray(pos,i*3);bounds.expandByPoint(pt);
  const hit=bvh.closestPointToPoint(pt);distances.push(hit.distance);
  const verts=[0,1,2].map(k=>geo.index.getX(hit.faceIndex*3+k));
  a.fromBufferAttribute(pDonor,verts[0]);b.fromBufferAttribute(pDonor,verts[1]);c.fromBufferAttribute(pDonor,verts[2]);
  THREE.Triangle.getBarycoord(hit.point,a,b,c,bary);
  let accumulated=new Map();
  verts.forEach((v,k)=>{for(let w=0;w<4;w++){const joint=jDonor.getComponent(v,w),weight=wDonor.getComponent(v,w)*bary.getComponent(k);accumulated.set(joint,(accumulated.get(joint)??0)+Math.max(0,weight));}});
  if(father) accumulated=fatherBodyWeights(pt,skeleton);
  // A loose shirt hem must not inherit leg weights from the nearest thigh.
  if(!father&&colors&&pt.y>.64&&pt.y<1.14&&Math.abs(pt.x)<.32){const [r,green,blue]=colors[i];if(r>150&&r>green*1.43&&r>blue*1.7){accumulated.clear();const t=THREE.MathUtils.smoothstep(pt.y,.97,1.14);accumulated.set(skeleton.bones.findIndex(b=>b.name==='pelvis'),1-t);accumulated.set(skeleton.bones.findIndex(b=>b.name==='spine_01'),t);}}
  const best=[...accumulated].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((s,x)=>s+x[1],0);
  if(!(sum>0))throw new Error('Unweighted vertex');
  best.forEach(([j,w],k)=>{joints[i*4+k]=j;weights[i*4+k]=w/sum;});
 });
 p.attributes.POSITION=append(pos,'VEC3',5126,bounds.min.toArray(),bounds.max.toArray());
 p.attributes.JOINTS_0=append(joints,'VEC4',5123);p.attributes.WEIGHTS_0=append(weights,'VEC4',5126);
}
const boneStart=g.nodes.length, ids=new Map(skeleton.bones.map((b,i)=>[b,boneStart+i]));
for(const b of skeleton.bones)g.nodes.push({name:b.name,translation:b.position.toArray(),rotation:b.quaternion.toArray(),scale:b.scale.toArray(),children:b.children.filter(c=>ids.has(c)).map(c=>ids.get(c))});
const roots=skeleton.bones.filter(b=>!ids.has(b.parent)).map(b=>ids.get(b));
g.scenes[g.scene??0].nodes.push(...roots);
const inverse=new Float32Array(skeleton.bones.length*16);skeleton.boneInverses.forEach((m,i)=>m.toArray(inverse,i*16));
g.skins=[{name:'MakeHuman_game_engine',joints:skeleton.bones.map(b=>ids.get(b)),inverseBindMatrices:append(inverse,'MAT4',5126)}];
for(const n of g.nodes)if(n.mesh!==undefined)n.skin=0;
for(const material of g.materials??[]){const pbr=material.pbrMetallicRoughness??={};pbr.roughnessFactor=1;pbr.metallicFactor=0;delete pbr.metallicRoughnessTexture;delete material.normalTexture;}
g.asset.extras={status:father?'Father stationary recording: fitted skin, rigid lower body; runtime face keys':'EXPERIMENTAL: surface weight transfer; no cloth or facial morphs',params};
g.buffers=[{byteLength:length}];
let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
mkdirSync(new URL('../../output/character-tripo/',import.meta.url),{recursive:true});writeFileSync(output,Buffer.concat([header,jh,json,bh,binary]));
distances.sort((a,b)=>a-b);
const report={input,output,params,fit,bones:skeleton.bones.length,scale:factor,vertices:distances.length,donorDistanceMetres:{median:distances[Math.floor(distances.length*.5)],p95:distances[Math.floor(distances.length*.95)],max:distances.at(-1)},limitations:[father?'Stationary recording fit; lower body follows pelvis rigidly. Not a walking NPC.':'Weight transfer is a prototype, not validated production rigging.','Original generated shape is preserved apart from uniform scaling.','Body and clothing remain fused unless the input was segmented.','No exported facial morphs or cloth simulation.']};
writeFileSync(output+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
