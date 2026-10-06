import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
const {parseBody,makeBody}=await import('../../src/makehuman/body.js');
const {Humanoid}=await import('../../src/humanoid.js');
const {buildCharacter}=await import('../../src/player.js');
const {fitDonorToSurface}=await import('../../tools/tripo-fit.js');
const b=readFileSync('public/anim/mh/body.bin'),data=parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const report=JSON.parse(readFileSync('output/character-tripo/rig-prototype.glb.json'));
const g=readFileSync('output/character-tripo/rig-prototype.glb'),n=g.readUInt32LE(12),json=JSON.parse(g.toString('utf8',20,20+n)),bin=g.subarray(28+n);
const acc=json.accessors[json.meshes[0].primitives[0].attributes.POSITION],view=json.bufferViews[acc.bufferView],surface=[];
for(let i=0;i<acc.count;i++){const o=(view.byteOffset??0)+(acc.byteOffset??0)+i*(view.byteStride??12);surface.push(new T.Vector3(bin.readFloatLE(o),bin.readFloatLE(o+4),bin.readFloatLE(o+8)));}

globalThis.ProgressEvent??=class{constructor(type,init){Object.assign(this,{type},init);}};
json.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];delete json.images;delete json.textures;delete json.materials;for(const m of json.meshes)for(const p of m.primitives)delete p.material;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let source;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)source=o;});
const template=makeBody(data,report.params);fitDonorToSurface(template,surface);
const char=buildCharacter(),h=new Humanoid(template,char,'m');
h.body.skeleton.pose();char.root.updateMatrixWorld(true);
const mesh=new T.SkinnedMesh(source.geometry,new T.MeshStandardMaterial());h.body.parent.add(mesh);mesh.bind(h.body.skeleton,h.body.bindMatrix);char.root.updateMatrixWorld(true);

const P=mesh.geometry.attributes.position,J=mesh.geometry.attributes.skinIndex,W=mesh.geometry.attributes.skinWeight,results=[];
for(const side of h.hands.sides)for(const joint of [...side.joints,...side.thumb]){
 const bone=joint.b,j=h.body.skeleton.bones.indexOf(bone),ids=[];
 for(let i=0;i<P.count;i++){let w=0;for(let k=0;k<4;k++)if(J.getComponent(i,k)===j)w+=W.getComponent(i,k);if(w>.2)ids.push(i);}
 if(ids.length<3)throw new Error(`${bone.name}: no meaningful mesh support (${ids.length} vertices)`);
 const before=ids.map(i=>mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(P,i))),q=bone.quaternion.clone();
 bone.rotateOnAxis(joint.curl??joint.bend,.5);bone.updateMatrixWorld(true);mesh.skeleton.update();
 let displacement=0;ids.forEach((i,k)=>{displacement=Math.max(displacement,mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(P,i)).distanceTo(before[k]));});
 bone.quaternion.copy(q);bone.updateMatrixWorld(true);mesh.skeleton.update();
 if(displacement<.001)throw new Error(`${bone.name}: rotation does not articulate its surface (${displacement} m)`);
 results.push({bone:bone.name,vertices:ids.length,displacement});
}
if(results.length!==30)throw new Error(`Expected 30 animated digit joints, found ${results.length}`);
console.log(JSON.stringify({status:'all digit joints have mesh support and deform it',joints:results.length,distalJoints:results.filter(r=>r.bone.includes('_03_')).length,minSupport:Math.min(...results.map(r=>r.vertices)),minimumDisplacementMetres:Math.min(...results.map(r=>r.displacement)),...(process.argv.includes('--details')?{results}:{})},null,2));
