import * as T from 'three';
import {cleanExpression} from '../expression.js';
import {headInkState} from './head-ink.js';

// Measured on head-v3's orthographic unlit export (source-front: x=(px-512)/1024,
// y=.99-py/1024). This fit keeps the accepted head/hair mesh, not head-v2's face drawing.
export const PORTRAIT_HEAD = Object.freeze({
 scale:.264, offset:[-.001,1.510,-.006], neck:[1.514,1.543],
 eyes:[[-.118,.522],[.125,.522]], eyeWidth:.056, eyeHeight:.025,
 browY:.588, mouthY:.293, mouthWidth:.090, chinY:.134,
});
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const patch=(x,y,w,h)=>1-smooth(.55,1,Math.hypot(x/w,y/h));
export function makePortraitHead(asset,body){
 const sources=[];asset.scene.traverse(o=>{if(o.isMesh)sources.push(o)});
 if(sources.length!==1)throw new Error('Portrait head needs its single prepared mesh');
 const source=sources[0],g=source.geometry.clone(),raw=g.attributes.position.clone(),p=g.attributes.position,F=PORTRAIT_HEAD;
 if(!g.attributes._portrait_hair)throw new Error('Portrait head is missing its prepared hair mask attribute');
 const bones=body.skeleton.bones,head=bones.findIndex(b=>b.name==='Head'),neck=bones.findIndex(b=>b.name==='neck_01');
 if(head<0||neck<0)throw new Error('Portrait head needs Head and neck_01 joints');
 const si=new Uint16Array(p.count*4),sw=new Float32Array(p.count*4),keys=Array.from({length:6},()=>new Float32Array(p.count*3));
 for(let i=0;i<p.count;i++){
  const x=raw.getX(i),y=raw.getY(i),z=raw.getZ(i),hair=g.attributes._portrait_hair.getX(i);
  const collar=1-smooth(0,.12,y);
  const throat=1-smooth(.17,.24,z),flare=1+.32*(1-smooth(.045,.19,y))*throat;
  p.setXYZ(i,x*F.scale*flare+F.offset[0],y*F.scale+F.offset[1]-.050*collar,((z+.015)*flare-.015)*F.scale+F.offset[2]);
  // The short neck meets the scarf. The chin and jaw underside are skull, even
  // where they share a height with the back of the neck.
  const skull=Math.max(smooth(...F.neck,p.getY(i)),smooth(.12,.15,y)*smooth(.12,.19,z));
  si[i*4]=head;si[i*4+1]=neck;sw[i*4]=skull;sw[i*4+1]=1-skull;
  const front=smooth(.10,.18,z)*(1-hair),eye=F.eyes[x<0?0:1],ex=x-eye[0],ey=y-eye[1];
  const lid=(1-smooth(.053,.083,Math.abs(ex)))*(1-smooth(.026,.054,Math.abs(ey)))*front;
  const brow=patch(ex,y-F.browY,.095,.049)*front;
  const mouth=patch(x,y-F.mouthY,.18,.095)*front,corner=smooth(.025,.10,Math.abs(x))*mouth;
  const lower=smooth(.13,.20,y)*(1-smooth(.285,.306,y))*patch(x,y-.235,.21,.17)*front;
  const delta=(k,dx,dy,dz=0)=>{keys[k][i*3]=dx*F.scale;keys[k][i*3+1]=dy*F.scale;keys[k][i*3+2]=dz*F.scale};
  delta(0,0,-ey*.995*lid);
  delta(1,Math.sign(x)*.009*corner,.016*corner);
  delta(2,0,.018*brow);delta(3,0,(.12-Math.abs(x))*.25*brow);
  delta(4,0,Math.sign(x)*(.007*brow+.004*corner));
  delta(5,0,-.040*lower,-.004*lower);
 }
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
 const names=['blink','smile','brow','browTilt','asymmetry','open'];
 g.morphAttributes.position=keys.map((v,i)=>{const a=new T.Float32BufferAttribute(v,3);a.name=names[i];return a});
 const scratch=new T.BufferGeometry();scratch.setIndex(g.index);scratch.setAttribute('position',p.clone());scratch.computeVertexNormals();const base=scratch.attributes.normal.array.slice();
 // Refit normals only on the collar extension; the prepared skull normals stay intact.
 for(let i=0;i<p.count;i++)if(raw.getY(i)<.19&&raw.getZ(i)<.24)g.attributes.normal.setXYZ(i,base[i*3],base[i*3+1],base[i*3+2]);
 g.morphAttributes.normal=keys.map(k=>{const q=scratch.attributes.position.array;for(let i=0;i<q.length;i++)q[i]=p.array[i]+k[i];scratch.computeVertexNormals();return new T.Float32BufferAttribute(scratch.attributes.normal.array.map((v,i)=>v-base[i]),3)});scratch.dispose();
 g.morphTargetsRelative=true;g.computeBoundingBox();g.computeBoundingSphere();
 const mesh=new T.SkinnedMesh(g,source.material.clone());mesh.name='TravellerPortraitHead';mesh.frustumCulled=false;mesh.userData.portraitHead=true;
 mesh.userData.inkLine=.45;mesh.userData.inkTint=.5;
 body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);return mesh;
}
const SRGB='albedo=mix(albedo*12.92,1.055*pow(max(albedo,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),albedo));';
const F=PORTRAIT_HEAD;
export function wearPortraitHeadFace(mesh,hairInk){
 const mat=mesh.material;if(!mat.fragmentShader.includes(SRGB))throw new Error('Portrait face needs the game material');
 mat.uniforms.uPortraitHairInk={value:hairInk};mat.uniforms.uPortraitHairAmount={value:1};
 mat.uniforms.uHeadSpeech={value:new T.Vector4()};mat.uniforms.uHeadEye={value:new T.Vector4()};mat.uniforms.uPortraitBlink={value:0};
 mat.uniforms.uShade.value.z=0; // source contours carry this face; no procedural cross-hatching
 mat.vertexShader=mat.vertexShader.replace('out vec2 vTextureUV;','out vec2 vTextureUV;\nin float _portrait_hair; out float vPortraitHair;').replace('vTextureUV = uv;','vTextureUV = uv; vPortraitHair = _portrait_hair;');
 mat.fragmentShader=mat.fragmentShader.replace('void main()',`in float vPortraitHair;
 uniform sampler2D uPortraitHairInk;uniform float uPortraitHairAmount;uniform float uPortraitBlink;
 uniform vec4 uHeadSpeech;uniform vec4 uHeadEye;
 void main()`).replace(SRGB,`${SRGB}
 vec3 ph=(vBind-vec3(${F.offset.join(',')}))/${F.scale};
 vec3 phPaint=albedo;
 float phHair=clamp(vPortraitHair,0.0,1.0);
 float phFront=smoothstep(.10,.18,ph.z);
 vec2 phEye=vec2(ph.x<0.0?-.118:.125,.522);
 vec2 phQ=ph.xy-phEye;
 float phInside=(1.0-smoothstep(.78,1.0,length(phQ/vec2(.052,.024))))*phFront;
 // Move the original painted iris within its own eye, without moving the lids or inventing a new eye.
 vec2 px=dFdx(ph.xy),py=dFdy(ph.xy),tx=dFdx(vTextureUV),ty=dFdy(vTextureUV);
 float pd=px.x*py.y-px.y*py.x;
 vec2 shift=vec2(0.0);
 if(abs(pd)>1e-10)shift=((tx*py.y-ty*px.y)*uHeadEye.z+(ty*px.x-tx*py.x)*uHeadEye.w)/pd;
 vec3 eyePaint=texture(uMap,vTextureUV-clamp(shift,vec2(-.025),vec2(.025))).rgb;
 eyePaint=mix(eyePaint*12.92,1.055*pow(max(eyePaint,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),eyePaint));
 albedo=mix(albedo,eyePaint,phInside);
 vec3 phSkin=vec3(.79,.525,.37);
 float warm=smoothstep(.06,.17,albedo.r-albedo.g)*smoothstep(.12,.25,albedo.r-albedo.b)*smoothstep(.28,.62,albedo.r);
 albedo=mix(albedo,phSkin,.65*warm*(1.0-phHair)*(1.0-phInside));
 // Remove the generator's fixed black hatch patch on the neck, below the actual chin.
 float neckClean=(1.0-smoothstep(.14,.19,ph.y))*(1.0-phHair);
 albedo=mix(albedo,phSkin,neckClean);
 float faceInk=(1.0-smoothstep(.43,.72,albedo.r))*phFront*(1.0-phHair)*(1.0-phInside);
 albedo*=1.0-.14*faceInk;
 float phNose=(1.0-smoothstep(.085,.105,abs(ph.x)))*smoothstep(.335,.35,ph.y)*(1.0-smoothstep(.48,.495,ph.y));
 float phMouth=(1.0-smoothstep(.103,.12,abs(ph.x)))*smoothstep(.25,.263,ph.y)*(1.0-smoothstep(.319,.331,ph.y));
 float phFeatureInk=(1.0-smoothstep(.43,.78,phPaint.r))*max(phNose,phMouth)*phFront;
 // These source marks travel through the ink channel once, so the colour-edge
 // detector cannot outline both sides of each small painted nose/lip stroke.
 albedo=mix(albedo,phSkin,max(phNose,phMouth)*phFront*(1.0-phHair));
 // A UV mask projected once from the selected drawings: attached grey lock/strand accents, no gloss.
 float phHighlight=texture(uPortraitHairInk,vTextureUV).r*uPortraitHairAmount;
 vec3 phHairColor=mix(vec3(.022,.027,.030),vec3(.24,.275,.285),phHighlight);
 albedo=mix(albedo,phHairColor,phHair);
 // At a complete blink the collapsed white/iris is replaced by one fine closed-lid line.
 float eyeClose=(1.0-smoothstep(.052,.063,abs(phQ.x)))*(1.0-smoothstep(.024,.033,abs(phQ.y)))*phFront*(1.0-phHair)*smoothstep(.82,.99,uPortraitBlink);
 float closedInk=1.0-smoothstep(.0015,.0030,abs(phQ.y));
 albedo=mix(albedo,mix(phSkin,vec3(.16,.085,.045),closedInk),eyeClose);
 // A restrained drawn oral opening, bounded to this head's measured lips.
 float ho=uHeadSpeech.x,ha=max(fwidth(ph.y),.0008),hx=ph.x/(.087-.013*ho);
 float hh=.022*ho*sqrt(max(0.0,1.0-hx*hx));
 float oral=(1.0-smoothstep(hh-ha,hh+ha,abs(ph.y-${F.mouthY})))*(1.0-smoothstep(.92,1.0,abs(hx)))*phFront*smoothstep(.02,.08,ho);
 albedo=mix(albedo,vec3(.14,.055,.045),oral);
 `).replace('float detail = 0.0;','float detail = min(1.7, 2.0 * phFeatureInk);');
 mat.needsUpdate=true;
 const matrix=new T.Matrix4(),centre=new T.Vector3(F.offset[0],F.offset[1]+.414*F.scale,F.offset[2]+.31*F.scale);
 const face={mesh,expression:cleanExpression(),blink:0,look:[0,0],state:headInkState(cleanExpression()),
 set(e){this.expression=cleanExpression(e);this.push()},
 eyes(blink=0,squint=null,look=null){this.blink=blink;if(squint!=null)this.expression.squint=squint;this.look[0]=look?(look.x??look[0]):0;this.look[1]=look?(look.y??look[1]):0;this.push()},
 push(){const s=headInkState(this.expression,{blink:this.blink,look:this.look},this.state),w=mesh.morphTargetInfluences;for(let i=0;i<6;i++)w[i]=s.keys[i];w[0]=Math.min(1,Math.max(this.blink,this.expression.squint*.45));const u=mesh.material.uniforms;u.uHeadSpeech.value.set(s.speech[0],s.speech[1],0,0);u.uHeadEye.value.set(...s.eye);u.uPortraitBlink.value=w[0]},
 at(head,out){const sk=mesh.skeleton,i=sk.bones.indexOf(head);if(i<0)return null;matrix.multiplyMatrices(head.matrixWorld,sk.boneInverses[i]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld);return out.copy(centre).applyMatrix4(matrix)},
 facing(out){return out.set(0,0,1).transformDirection(matrix)}};
 face.push();return face;
}
