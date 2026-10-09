// A recording-specific derivative. Keep the full generated source and rebuildable
// rig; remove only geometry below the projection, preserving face/hand topology.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, writeGlb, slimGlb, makeResize } from './slim-traveller.mjs';
export const FATHER_BUDGET = { cutY: .90, texture: 2048, maxBytes: 2_000_000, maxTriangles: 26000 };
const TYPES={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array};
const SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
export function trimFather(buf) {
  const {json:g,bin}=readGlb(buf);
  if(g.meshes.length!==1||g.meshes[0].primitives.length!==1)throw Error('Expected single father mesh');
  const p=g.meshes[0].primitives[0];
  if(p.targets?.length)throw Error('Trim before adding runtime morphs');
  const read=id=>{const a=g.accessors[id],v=g.bufferViews[a.bufferView],C=TYPES[a.componentType],n=SIZE[a.type];
    if(!C||!n||a.sparse||v.byteStride)throw Error('Unsupported accessor');
    return new C(bin.buffer,bin.byteOffset+(v.byteOffset??0)+(a.byteOffset??0),a.count*n);};
  const pos=read(p.attributes.POSITION),indices=read(p.indices),kept=[],used=[],map=new Map();
  for(let i=0;i<indices.length;i+=3){
    if(Math.max(...[0,1,2].map(k=>pos[indices[i+k]*3+1]))<FATHER_BUDGET.cutY)continue;
    for(let k=0;k<3;k++){const v=indices[i+k];if(!map.has(v)){map.set(v,used.length);used.push(v);}kept.push(map.get(v));}
  }
  const chunks=[bin];let size=bin.length;
  const add=(array,old)=>{const pad=(4-size%4)%4;chunks.push(Buffer.alloc(pad));size+=pad;
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=g.bufferViews.length;
    g.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});chunks.push(bytes);size+=bytes.length;
    const a={...old,bufferView:view,byteOffset:0,count:array.length/SIZE[old.type]};delete a.min;delete a.max;
    g.accessors.push(a);return g.accessors.length-1;};
  for(const [name,id] of Object.entries(p.attributes)){
    const a=g.accessors[id],old=read(id),n=SIZE[a.type],out=new old.constructor(used.length*n);
    used.forEach((v,i)=>out.set(old.subarray(v*n,v*n+n),i*n));
    p.attributes[name]=add(out,a);
    if(name==='POSITION'){const a2=g.accessors[p.attributes[name]];a2.min=[Infinity,Infinity,Infinity];a2.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i++) {const k=i%3;a2.min[k]=Math.min(a2.min[k],out[i]);a2.max[k]=Math.max(a2.max[k],out[i]);}}
  }
  p.indices=add(new Uint16Array(kept),{type:'SCALAR',componentType:5123});
  g.buffers=[{byteLength:size}];g.asset.extras={...g.asset.extras,derivative:'Holographic bust; lower geometry below 0.90m removed'};
  return {bytes:writeGlb(g,Buffer.concat(chunks)),triangles:kept.length/3,vertices:used.length,sourceVertices:pos.length/3,sourceTriangles:indices.length/3};
}
export async function slimFather(input){const trim=trimFather(input);const bytes=await slimGlb(trim.bytes,await makeResize({maxTexture:FATHER_BUDGET.texture}));return {...trim,bytes};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: slim-father.mjs full-rig.glb output.glb');
  const before=readFileSync(input),result=await slimFather(before);
  if(result.bytes.length>FATHER_BUDGET.maxBytes||result.triangles>FATHER_BUDGET.maxTriangles)throw Error('Father asset exceeds budget');
  writeFileSync(output,result.bytes);
  const {bytes,...counts}=result;delete counts.bytes;
  const report={...counts,beforeBytes:before.length,afterBytes:bytes.length,textureSize:FATHER_BUDGET.texture,textureGpuBytesWithMipmaps:Math.round(2048*2048*4*4/3)};
  writeFileSync('data/characters/father-v1/optimization.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}
