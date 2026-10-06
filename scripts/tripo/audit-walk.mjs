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
const motion=process.argv[2]??'walk';
const direction=(a,b)=>b.getWorldPosition(new T.Vector3()).sub(a.getWorldPosition(new T.Vector3())).normalize();
for(const [fitted,relaxed] of [[false,false],[true,false],[true,true]]){
 const template=makeBody(data,report.params);if(fitted)fitDonorToSurface(template,surface);
 const char=buildCharacter(),h=new Humanoid(template,char,'m'),a=new Animator(lib,char);
 const stats={model:fitted?('Tripo fitted'+(relaxed?' relaxed':'')):'MakeHuman',min:Infinity,max:-Infinity,maxDirectionError:0};
 for(let i=0;i<60;i++){
 for(const [key,action]of Object.entries(a.actions)){action.setEffectiveWeight(key===motion?1:0);if(key===motion)action.time=i/60*lib.clips[motion].duration;}
 a.mixer.update(0);a.src.updateMatrixWorld(true);a.apply(char.root);relaxWalkArms(char,motion,relaxed);h.update();
 for(const side of ['l','r']){const source=direction(a.bone('upperarm_'+side),a.bone('lowerarm_'+side)),target=direction(h.b['upperarm_'+side],h.b['lowerarm_'+side]);const deg=Math.atan2(Math.abs(target.x),-target.y)*180/Math.PI;stats.min=Math.min(stats.min,deg);stats.max=Math.max(stats.max,deg);stats.maxDirectionError=Math.max(stats.maxDirectionError,source.angleTo(target)*180/Math.PI);}
 }
 console.log(stats);
}
