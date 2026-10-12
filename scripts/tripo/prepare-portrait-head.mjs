// Retain the accepted H3.1 topology/positions, clean its lighting normals, and
// project only the selected drawings' grey hair strokes into a UV data mask.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {readGlb,writeGlb,slimGlb,makeResize} from './slim-traveller.mjs';
const dir='data/characters/traveller-v1/head-v3',out='public/characters/traveller-v1/head-v3';
const raw=await fs.readFile(`${dir}/model.glb`),{json:g,bin}=readGlb(raw),prim=g.meshes[0].primitives[0];
const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array},width={SCALAR:1,VEC2:2,VEC3:3};
function accessor(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0),C=types[a.componentType];return new C(bin.buffer.slice(bin.byteOffset+start,bin.byteOffset+start+a.count*width[a.type]*C.BYTES_PER_ELEMENT));}
const pos=accessor(prim.attributes.POSITION),norm=accessor(prim.attributes.NORMAL),uv=accessor(prim.attributes.TEXCOORD_0),ix=accessor(prim.indices),count=pos.length/3;
const im=g.images[0],iv=g.bufferViews[im.bufferView],tex=await sharp(bin.subarray(iv.byteOffset,iv.byteOffset+iv.byteLength)).removeAlpha().raw().toBuffer({resolveWithObject:true});
const sample=(data,w,h,u,v)=>{const x=Math.max(0,Math.min(w-1,Math.round(u))),y=Math.max(0,Math.min(h-1,Math.round(v))),at=(y*w+x)*3;return [data[at],data[at+1],data[at+2]];};
const colors=Array.from({length:count},(_,i)=>sample(tex.data,tex.info.width,tex.info.height,uv[2*i]*tex.info.width,uv[2*i+1]*tex.info.height));
const nodes=[],nodeOf=[],weld=new Map();
for(let i=0;i<count;i++){const xyz=Array.from(pos.subarray(i*3,i*3+3)),key=xyz.map(v=>Math.round(v*1e5)).join(',');let j=weld.get(key);if(j===undefined){j=nodes.length;weld.set(key,j);nodes.push({xyz,edges:new Set(),dark:false,hair:false,normal:[0,0,0]});}nodeOf[i]=j;const n=nodes[j],c=colors[i];n.dark ||= c[0]<62&&c[1]<65&&c[2]<68;for(let k=0;k<3;k++)n.normal[k]+=norm[3*i+k];}
for(let i=0;i<ix.length;i+=3){const tri=[nodeOf[ix[i]],nodeOf[ix[i+1]],nodeOf[ix[i+2]]];for(const a of tri)for(const b of tri)if(a!==b)nodes[a].edges.add(b);}
const queue=[];nodes.forEach((n,i)=>{if(n.dark&&n.xyz[1]>.73){n.hair=true;queue.push(i)}});
for(let i=0;i<queue.length;i++)for(const j of nodes[queue[i]].edges){const n=nodes[j];if(n.dark&&!n.hair&&n.xyz[1]>.18){n.hair=true;queue.push(j)}}
const hair=new Float32Array(nodeOf.map(i=>nodes[i].hair?1:0));
const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};let normals=nodes.map(n=>unit(n.normal));
// UV duplicates share normals; restrained smoothing removes scan ripples, never moves the mesh.
for(let pass=0;pass<3;pass++)normals=nodes.map((n,i)=>{if(n.hair)return normals[i];const sum=normals[i].map(v=>v*4);for(const j of n.edges)if(!nodes[j].hair)for(let k=0;k<3;k++)sum[k]+=normals[j][k];return unit(sum)});
for(let i=0;i<count;i++)if(!hair[i])norm.set(normals[nodeOf[i]],i*3);
const refs=await Promise.all(['front','left','back','right'].map(async name=>{const v=await sharp(`${dir}/reference/${name}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});return {name,...v}}));
function highlight(x,y,z){
 const us=[x,-z,-x,z],facing=[z,x,-z,-x],radius=Math.hypot(x,z)||1;let value=0,total=0;
 for(let j=0;j<4;j++){const weight=Math.pow(Math.max(0,facing[j]/radius),4);if(weight<.005)continue;const r=refs[j],c=sample(r.data,r.info.width,r.info.height,512+us[j]*833,80+(.979-y)*833),l=(c[0]+c[1]+c[2])/3;
 // Warm skin and ivory background never become hair highlights.
 const gray=Math.max(...c)<125&&Math.min(...c)>Math.max(...c)*.57;
 value+=weight*(gray?Math.max(0,Math.min(1,(l-9)/66)):0);total+=weight;
 }
 return total?value/total:0;
}
const S=1024,mask=new Uint8Array(S*S),covered=new Uint8Array(S*S);
for(let k=0;k<ix.length;k+=3){const ids=[ix[k],ix[k+1],ix[k+2]];if(!ids.some(i=>hair[i]))continue;
 const q=ids.map(i=>[uv[i*2]*S-.5,uv[i*2+1]*S-.5]),den=(q[1][1]-q[2][1])*(q[0][0]-q[2][0])+(q[2][0]-q[1][0])*(q[0][1]-q[2][1]);if(Math.abs(den)<1e-9)continue;
 const xmin=Math.max(0,Math.ceil(Math.min(...q.map(v=>v[0])))),xmax=Math.min(S-1,Math.floor(Math.max(...q.map(v=>v[0])))),ymin=Math.max(0,Math.ceil(Math.min(...q.map(v=>v[1])))),ymax=Math.min(S-1,Math.floor(Math.max(...q.map(v=>v[1]))));
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const a=((q[1][1]-q[2][1])*(x-q[2][0])+(q[2][0]-q[1][0])*(y-q[2][1]))/den,b=((q[2][1]-q[0][1])*(x-q[2][0])+(q[0][0]-q[2][0])*(y-q[2][1]))/den,c=1-a-b;if(Math.min(a,b,c)<-1e-6)continue;const w=[a,b,c],h=ids.reduce((s,i,j)=>s+hair[i]*w[j],0),p=[0,1,2].map(d=>ids.reduce((s,i,j)=>s+pos[3*i+d]*w[j],0));mask[y*S+x]=Math.round(255*h*highlight(...p));covered[y*S+x]=1;}
}
// Padding across UV island borders prevents black seams in the mip chain.
for(let pass=0;pass<4;pass++){const next=mask.slice(),hit=covered.slice();for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){const i=y*S+x;if(covered[i])continue;let sum=0,n=0;for(const j of [i-1,i+1,i-S,i+S])if(covered[j]){sum+=mask[j];n++;}if(n){next[i]=Math.round(sum/n);hit[i]=1;}}mask.set(next);covered.set(hit);}
await fs.mkdir(out,{recursive:true});await sharp(mask,{raw:{width:S,height:S,channels:1}}).png().toFile(`${out}/hair-ink.png`);
const nview=g.bufferViews[g.accessors[prim.attributes.NORMAL].bufferView],noff=(nview.byteOffset??0)+(g.accessors[prim.attributes.NORMAL].byteOffset??0);Buffer.from(norm.buffer).copy(bin,noff);
const padded=Buffer.alloc((bin.length+3)&~3);bin.copy(padded);const hbytes=Buffer.from(hair.buffer),v=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:padded.length,byteLength:hbytes.length});g.accessors.push({bufferView:v,componentType:5126,count,type:'SCALAR',min:[0],max:[1]});prim.attributes._PORTRAIT_HAIR=g.accessors.length-1;
g.scenes[0].extras={...g.scenes[0].extras,travellerHead:'v3'};g.buffers[0].byteLength=padded.length+hbytes.length;
const derived=writeGlb(g,Buffer.concat([padded,hbytes])),slim=await slimGlb(derived,await makeResize());await fs.writeFile(`${out}/model.glb`,slim);
// Native colour fallback samples the same shipped 2K texture and vertex order.
const shipped=readGlb(slim),img=shipped.json.images[0],view=shipped.json.bufferViews[img.bufferView],rgb=await sharp(shipped.bin.subarray(view.byteOffset,view.byteOffset+view.byteLength)).removeAlpha().raw().toBuffer({resolveWithObject:true});
await fs.writeFile(`${out}/colors.json`,JSON.stringify(Array.from({length:count},(_,i)=>sample(rgb.data,rgb.info.width,rgb.info.height,uv[i*2]*rgb.info.width,uv[i*2+1]*rgb.info.height))));
const report={source:`${dir}/model.glb`,sourceBytes:raw.length,shippedBytes:slim.length,triangles:ix.length/3,vertices:count,drawCalls:1,textureSize:2048,baseColorMiB:2048*2048*4*4/3/2**20,hairMaskSize:S,hairMaskMiB:S*S*4/3/2**20,hairVertices:hair.reduce((a,b)=>a+b,0),positionsUnchanged:true,uvsUnchanged:true,normalSmoothingPasses:3,referenceProjection:{scale:833,centreX:512,crownY:80,sourceCrown:.979}};
await fs.writeFile(`${out}/provenance.json`,JSON.stringify(report,null,2)+'\n');console.log(report);
