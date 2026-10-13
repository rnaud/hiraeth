// Rebuild from the untouched reviewed Tripo export; no service auto-rig is used.
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import * as T from 'three';
import {splitElderBeak} from './elder-beak.mjs';
import {elderIslands} from './elder-v3-islands.mjs';
import {elderPoint,elderAlignedSource,elderWeights,elderRestBones} from '../../src/characters/elder-v3-fit.js';
const input=process.argv[2]??'references/guardians/elder/source-v3.glb',out='public/guardians/elder-v3/model.glb';
const bytes=fs.readFileSync(input);if(crypto.createHash('sha256').update(bytes).digest('hex')!=='dfc099830284fff48127cbe003998b7170c2a1b67fd67ffee107014ff36388d9')throw new Error('This fitted rig requires the reviewed Elder source mesh');
const n=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);const chunks=[bin];let length=bin.length;
function append(bytes){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const i=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;return i;}
function accessor(array,type,componentType){const v=append(Buffer.from(array.buffer,array.byteOffset,array.byteLength)),count=array.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type]);g.accessors.push({bufferView:v,componentType,count,type});return g.accessors.length-1;}
function read(i,C,components){const a=g.accessors[i],v=g.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0);return new C(bin.buffer.slice(bin.byteOffset+start,bin.byteOffset+start+a.count*components*C.BYTES_PER_ELEMENT));}
const {bones}=elderRestBones(),names=bones.map(b=>b.name),counts=Object.fromEntries(names.map(n=>[n,0]));let verts=0;
for(const m of g.meshes)for(const p of m.primitives){
 const sourcePosition=read(p.attributes.POSITION,Float32Array,3),sourceNormal=read(p.attributes.NORMAL,Float32Array,3);
 const regions=elderIslands(sourcePosition,read(p.indices,Uint32Array,1));
 const cut=splitElderBeak(sourcePosition,sourceNormal,read(p.attributes.TEXCOORD_0,Float32Array,2),read(p.indices,Uint32Array,1),{height:.610,slope:.70,base:.06,start:.058,full:.082,minY:.51});
 const pos=cut.position,normal=cut.normal,j=new Uint16Array(pos.length/3*4),w=new Float32Array(j.length);
 for(let v=0;v<pos.length/3;v++){
  const original=Array.from(pos.subarray(v*3,v*3+3));elderPoint(original).toArray(pos,v*3);
  // Transform the source's smooth normals with the rest correction's Jacobian;
  // recomputing indexed normals would introduce seams at every UV island.
  const base=elderAlignedSource(original),eps=1e-5,axes=[0,1,2].map(k=>{const p=[...original];p[k]+=eps;return elderAlignedSource(p).sub(base).divideScalar(eps);});
  const [a,b,c]=axes,normalMatrix=new T.Matrix3().set(a.x,b.x,c.x,a.y,b.y,c.y,a.z,b.z,c.z).invert().transpose();
  new T.Vector3().fromArray(normal,v*3).applyMatrix3(normalMatrix).normalize().toArray(normal,v*3);
  let weights=elderWeights(original,regions[v]);
  if(cut.sides[v]){const blend=T.MathUtils.smoothstep(original[2],.058,.082);weights=[['head',cut.sides[v]===1?1:1-blend],['jaw',cut.sides[v]===1?0:blend]];}
  weights.forEach(([name,weight],k)=>{j[v*4+k]=names.indexOf(name);w[v*4+k]=weight;if(weight>.1)counts[name]++;});
 }
 p.attributes.POSITION=accessor(pos,'VEC3',5126);const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<pos.length;i++){const k=i%3;bounds.min[k]=Math.min(bounds.min[k],pos[i]);bounds.max[k]=Math.max(bounds.max[k],pos[i]);}Object.assign(g.accessors[p.attributes.POSITION],bounds);
 p.attributes.NORMAL=accessor(normal,'VEC3',5126);p.attributes.TEXCOORD_0=accessor(cut.uv,'VEC2',5126);p.indices=accessor(cut.index,'SCALAR',5125);p.attributes.JOINTS_0=accessor(j,'VEC4',5123);p.attributes.WEIGHTS_0=accessor(w,'VEC4',5126);verts+=pos.length/3;
 console.log('Beak separation', {cutVertices:cut.cutVertices,capVertices:cut.capVertices});
}
g.nodes=[{name:'ElderSurface',mesh:0,skin:0},...bones.map(b=>({name:b.name,translation:b.position.toArray(),rotation:b.quaternion.toArray(),children:b.children.map(c=>bones.indexOf(c)+1)}))];g.scenes=[{nodes:[0,...bones.map((b,i)=>b.parent?null:i+1).filter(x=>x!==null)]}];g.scene=0;
const inv=new Float32Array(bones.length*16);bones.forEach((b,i)=>b.matrixWorld.clone().invert().toArray(inv,i*16));g.skins=[{name:'Elder_custom',joints:bones.map((_,i)=>i+1),inverseBindMatrices:accessor(inv,'MAT4',5126)}];delete g.animations;
// 2K is sufficient for this first review; preserve the full 4K source outside the shipped asset.
for(const image of g.images??[]){const v=g.bufferViews[image.bufferView],raw=bin.subarray(v.byteOffset,v.byteOffset+v.byteLength);const jpg=await sharp(raw).resize(2048,2048,{fit:'inside'}).jpeg({quality:90}).toBuffer();image.bufferView=append(jpg);image.mimeType='image/jpeg';}
for(const m of g.materials??[]){m.pbrMetallicRoughness.metallicFactor=0;m.pbrMetallicRoughness.roughnessFactor=1;delete m.normalTexture;}
// Repack referenced views; remove replaced positions, normals and the old texture payload.
const all=Buffer.concat(chunks),views=new Set();const usedAcc=new Set();for(const m of g.meshes)for(const p of m.primitives){Object.values(p.attributes).forEach(i=>usedAcc.add(i));usedAcc.add(p.indices);}usedAcc.add(g.skins[0].inverseBindMatrices);const remapAcc=new Map([...usedAcc].map((x,i)=>[x,i]));g.accessors=[...usedAcc].map(i=>g.accessors[i]);for(const a of g.accessors)views.add(a.bufferView);for(const i of g.images)views.add(i.bufferView);for(const m of g.meshes)for(const p of m.primitives){for(const k of Object.keys(p.attributes))p.attributes[k]=remapAcc.get(p.attributes[k]);p.indices=remapAcc.get(p.indices);}g.skins[0].inverseBindMatrices=remapAcc.get(g.skins[0].inverseBindMatrices);
const packed=[],viewMap=new Map();let offset=0;const newViews=[];for(const i of views){const v=g.bufferViews[i],pad=(4-offset%4)%4;if(pad){packed.push(Buffer.alloc(pad));offset+=pad;}packed.push(all.subarray(v.byteOffset,v.byteOffset+v.byteLength));viewMap.set(i,newViews.length);newViews.push({...v,byteOffset:offset});offset+=v.byteLength;}g.bufferViews=newViews;g.accessors.forEach(a=>a.bufferView=viewMap.get(a.bufferView));g.images.forEach(i=>i.bufferView=viewMap.get(i.bufferView));g.buffers=[{byteLength:offset}];g.asset.generator='Hiraeth natural-wing Elder v3 rig';
let jb=Buffer.from(JSON.stringify(g)),bb=Buffer.concat(packed);jb=Buffer.concat([jb,Buffer.alloc((4-jb.length%4)%4,32)]);bb=Buffer.concat([bb,Buffer.alloc((4-bb.length%4)%4)]);const h=Buffer.alloc(20);h.write('glTF');h.writeUInt32LE(2,4);h.writeUInt32LE(28+jb.length+bb.length,8);h.writeUInt32LE(jb.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bb.length);bh.writeUInt32LE(0x004e4942,4);const result=Buffer.concat([h,jb,bh,bb]);fs.mkdirSync('public/guardians/elder-v3',{recursive:true});fs.writeFileSync(out,result);
const report={input,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),output:out,bytes:result.length,vertices:verts,bones:counts,animation:'Runtime shared motion kit; no baked clips',texture:'2K JPEG, original ink retained; lighting neutrality remains under review'};fs.writeFileSync('public/guardians/elder-v3/rig.json',JSON.stringify(report,null,2)+'\n');console.log(report);
