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
// The face's pen lines (issue #198): the approved front portrait's own lines in source-front space
// (box: x0, y0, x1, y1; scripts/tripo/bake-face-ink.mjs), drawn into the detail channel. jaw: the
// jaw curve's height at the chin and its rise (y = a + b x²), the rest normal's y at the crease,
// its width in px; throat: the depth the throat stays behind (z < a − b|x|) and how far down its
// shadow fades; hatch: the throat strokes' spacing (source units), width in px and how much
// shows in light; fade: the face's height on screen (px) over which each weight of line comes in;
// steep: where the view sees the skin more squarely than the front projection does (that ratio) the line threshold
// rises to this, so lines laid on the wings' grooves stay pen lines from the side; nostrils: where the baked nostrils
// sit (the nose's centre line, each side's offset and height, the patch's half-sizes) and when they give way, as
// a drawing loses them: the near one once the view is that far round to its side (the sine), both once it is
// that far off his face (the cosine). On the wings' insides they would otherwise read as a dark ring.
export const PORTRAIT_FACE_INK = Object.freeze({
 box:[-.25,.05,.25,.62], size:[512,584], faceHeight:.47,
 jaw:[.142,4.0,-.45,1.7], throat:[.2,.3,.09], hatch:[.0085,1.0,.8],
 fade:{major:[22,45], minor:[90,170]},
 weight:{major:1.6, minor:1.35, jaw:1.9, hatch:1.4},
 steep:[[1.15,2.2],.82],
 nostrils:{ridge:.01, x:.047, y:.373, size:[.013,.012], near:[.3,.55], front:[.05,.2]},
 side:{x:[.005,.024], y:[.405,.545], front:[.16,.34]},
});
// side (#276): the nose's side line lies on the mesh's own edge between the nose's narrow front and its side wall
// (face-landmarks.mjs noseSide, x from the nostrils' ridge, y its height); seen from nearly in profile that front is
// edge-on and the line runs a millimetre inside the nose's outline, a doubled contour, so on its own side it gives
// way as the view's z in the head's frame falls through `front` (about 70 to 80 degrees round).
const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const patch=(x,y,w,h)=>1-smooth(.55,1,Math.hypot(x/w,y/h));
export function makePortraitHead(asset,body,fit=PORTRAIT_HEAD){
 const sources=[];asset.scene.traverse(o=>{if(o.isMesh)sources.push(o)});
 if(sources.length!==1)throw new Error('Portrait head needs its single prepared mesh');
 const source=sources[0],g=source.geometry.clone(),raw=g.attributes.position.clone(),p=g.attributes.position,F=fit;
 if(!g.attributes._portrait_hair)throw new Error('Portrait head is missing its prepared hair mask attribute');
 const bones=body.skeleton.bones,head=bones.findIndex(b=>b.name==='Head'),neck=bones.findIndex(b=>b.name==='neck_01');
 if(head<0||neck<0)throw new Error('Portrait head needs Head and neck_01 joints');
 const si=new Uint16Array(p.count*4),sw=new Float32Array(p.count*4),keys=Array.from({length:6},()=>new Float32Array(p.count*3));
 for(let i=0;i<p.count;i++){
  const x=raw.getX(i),y=raw.getY(i),z=raw.getZ(i),hair=g.attributes._portrait_hair.getX(i);
  const collar=1-smooth(0,.12,y);
  const throat=1-smooth(.17,.24,z),flare=1+(F.neckFlare??.32)*(1-smooth(.045,.19,y))*throat;
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
 const mesh=new T.SkinnedMesh(g,source.material.clone());mesh.name='TravellerPortraitHead';mesh.frustumCulled=false;mesh.userData.portraitHead=true;mesh.userData.portraitHeadFit=fit;
 mesh.userData.inkLine=.45;mesh.userData.inkTint=.5;
 body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);return mesh;
}
const SRGB='albedo=mix(albedo*12.92,1.055*pow(max(albedo,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),albedo));';
const FI=PORTRAIT_FACE_INK;
export function wearPortraitHeadFace(mesh,hairInk,faceInk=null){
 const F=mesh.userData.portraitHeadFit??PORTRAIT_HEAD;
 const mat=mesh.material;if(!mat.fragmentShader.includes(SRGB))throw new Error('Portrait face needs the game material');
 mat.uniforms.uPortraitHairInk={value:hairInk};mat.uniforms.uPortraitHairAmount={value:1};
 mat.uniforms.uPortraitFaceInk={value:faceInk};mat.uniforms.uPortraitFaceAmount={value:faceInk?1:0};
 mat.uniforms.uHeadSpeech={value:new T.Vector4()};mat.uniforms.uHeadEye={value:new T.Vector4()};mat.uniforms.uPortraitBlink={value:0};
 mat.uniforms.uHeadView={value:new T.Vector3(0,0,1)};
 mat.uniforms.uShade.value.z=0; // source contours carry this face; no procedural cross-hatching
 mat.vertexShader=mat.vertexShader.replace('out vec2 vTextureUV;','out vec2 vTextureUV;\nin float _portrait_hair; out float vPortraitHair;').replace('vTextureUV = uv;','vTextureUV = uv; vPortraitHair = _portrait_hair;');
 mat.fragmentShader=mat.fragmentShader.replace('void main()',`in float vPortraitHair;
 uniform sampler2D uPortraitHairInk;uniform float uPortraitHairAmount;uniform float uPortraitBlink;
 uniform sampler2D uPortraitFaceInk;uniform float uPortraitFaceAmount;
 uniform vec4 uHeadSpeech;uniform vec4 uHeadEye;uniform vec3 uHeadView;
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
 // One flat skin over the face (the reference's: a colour and the world's one shadow tone over it).
 // Only the painted eyes, their lash lines and the brows keep the source paint; its blotches,
 // baked shading and scratchy nose/lip marks give way to the portrait's own lines below.
 vec2 phB=vec2(abs(ph.x)-.12,ph.y-.592);
 float phKeep=max(1.0-smoothstep(.8,1.0,length(phQ/vec2(.074,.040))),(1.0-smoothstep(.085,.11,abs(phB.x)))*(1.0-smoothstep(.034,.05,abs(phB.y))));
 float phFace=phFront*(1.0-phHair)*(1.0-smoothstep(.17,.2,abs(ph.x)))*smoothstep(.15,.2,ph.y);
 float phDark=1.0-smoothstep(.2,.42,phPaint.r);
 albedo=mix(albedo,phSkin,max(phFace*(1.0-phInside)*(1.0-phKeep*phDark),(1.0-smoothstep(.28,.32,ph.y))*(1.0-phHair)));
 // The portrait's pen lines (bake-face-ink.mjs), front-projected in rest space so they ride the
 // face's morphs. Lines narrow as they magnify, and fade out by the face's size on screen.
 vec3 phN=normalize(vObjNormal);
 vec2 fiUV=vec2((ph.x-(${FI.box[0].toFixed(3)}))/${(FI.box[2]-FI.box[0]).toFixed(3)},(${FI.box[3].toFixed(3)}-ph.y)/${(FI.box[3]-FI.box[1]).toFixed(3)});
 vec2 fiTex=texture(uPortraitFaceInk,fiUV).rg;
 float fiPx=1.0/max(max(fwidth(fiUV.x),fwidth(fiUV.y))*${FI.size[0].toFixed(1)},1e-4);   // render px per texel
 float phFaceH=${FI.faceHeight.toFixed(2)}/max(max(fwidth(ph.x),fwidth(ph.y)),1e-6)/max(uPixelRatio,1e-3);   // the face's height in px (as shown: the portrait chip draws large, then shrinks)
 float fiThr=mix(.5,.75,smoothstep(1.2,5.0,fiPx/max(uPixelRatio,1e-3))),fiAa=.5*max(fwidth(fiTex.r),fwidth(fiTex.g))+.04;
 // (the mask is laid on from in front: where the view sees the skin more squarely than the front does (the wings' grooves
 // and the nostrils from three-quarters or the side) its lines come out wider; a higher threshold keeps them pen lines)
 float fiStretch=max(dot(normalize(vNormal),normalize(-vWorldRel)),0.0)/max(phN.z,.15);
 fiThr=mix(fiThr,${FI.steep[1].toFixed(2)},smoothstep(${FI.steep[0][0].toFixed(2)},${FI.steep[0][1].toFixed(2)},fiStretch));
 float fiOn=step(0.0,fiUV.x)*step(fiUV.x,1.0)*step(0.0,fiUV.y)*step(fiUV.y,1.0)*smoothstep(.02,.3,phN.z)*phFront*(1.0-phHair)*(1.0-phInside)*uPortraitFaceAmount;
 // (the nostrils, seen from more than about 50 degrees off his face, give way: on the wing's inside they would read as a ring)
 vec2 phNo=vec2(abs(ph.x-${FI.nostrils.ridge.toFixed(3)})-${FI.nostrils.x.toFixed(3)},ph.y-${FI.nostrils.y.toFixed(3)})/vec2(${FI.nostrils.size.map((v)=>v.toFixed(3)).join(',')});
 float phNearSide=uHeadView.x*sign(ph.x-${FI.nostrils.ridge.toFixed(3)});
 float phNostril=(1.0-smoothstep(.8,1.0,length(phNo)))*max(smoothstep(${FI.nostrils.near.map((v)=>v.toFixed(2)).join(',')},phNearSide),1.0-smoothstep(${FI.nostrils.front.map((v)=>v.toFixed(2)).join(',')},uHeadView.z));
 // (the nose's side line, on the edge of the nose's front: seen nearly in profile from its side, it would double the outline)
 float phSideX=ph.x-${FI.nostrils.ridge.toFixed(3)};
 float phSideLine=step(${(-FI.side.x[1]).toFixed(3)},phSideX)*step(phSideX,${(-FI.side.x[0]).toFixed(3)})*step(${FI.side.y[0].toFixed(3)},ph.y)*step(ph.y,${FI.side.y[1].toFixed(3)})
   *(1.0-smoothstep(${FI.side.front.map((v)=>v.toFixed(2)).join(',')},uHeadView.z))*smoothstep(.0,.3,-uHeadView.x);
 float phMajor=smoothstep(fiThr-fiAa,fiThr+fiAa,fiTex.r)*fiOn*(1.0-phNostril)*(1.0-phSideLine)*smoothstep(${FI.fade.major[0].toFixed(1)},${FI.fade.major[1].toFixed(1)},phFaceH);
 float phMinor=smoothstep(fiThr-fiAa,fiThr+fiAa,fiTex.g)*fiOn*smoothstep(${FI.fade.minor[0].toFixed(1)},${FI.fade.minor[1].toFixed(1)},phFaceH);
 // The jaw: where the rest normal turns under the chin (the crease, at any angle), near the jaw's
 // measured curve, on the skull's side of the step back to the throat (the throat sits well behind
 // the chin: z under ${FI.throat[0]} − ${FI.throat[1]}|x|), so it stays one clean contour.
 float phJawY=${FI.jaw[0].toFixed(3)}+${FI.jaw[1].toFixed(2)}*ph.x*ph.x;
 float phThroatZ=${FI.throat[0].toFixed(3)}-${FI.throat[1].toFixed(2)}*abs(ph.x);
 float phSkull=smoothstep(phThroatZ-.01,phThroatZ+.02,ph.z);
 float phJawZone=(1.0-smoothstep(.022,.04,abs(ph.y-phJawY)))*phSkull*(1.0-phHair)*(1.0-smoothstep(.15,.19,abs(ph.x)))*uPortraitFaceAmount;
 float phJd=abs(phN.y-(${FI.jaw[2].toFixed(2)}))/max(fwidth(phN.y),1e-4);
 float phJaw=inkLine(phJd,${FI.jaw[3].toFixed(2)})*phJawZone*smoothstep(${FI.fade.major[0].toFixed(1)},${FI.fade.major[1].toFixed(1)},phFaceH);
 // The reference's shadow on the throat: vertical strokes below and behind the jaw, never on the chin
 // or the jaw's underside, darkest just under the jaw and fading down the neck.
 float phBelow=phJawY-ph.y;
 float phThroat=(1.0-phSkull)*smoothstep(-.03,.02,ph.z)*smoothstep(-.01,.012,phBelow)*(1.0-smoothstep(.0,${FI.throat[2].toFixed(3)},phBelow))
   *smoothstep(-.85,-.65,phN.y)*(1.0-phHair)*(1.0-smoothstep(.15,.19,abs(ph.x)))*uPortraitFaceAmount;
 float phHu=ph.x/${FI.hatch[0].toFixed(4)}+.35*sin(ph.y*90.0);
 float phHatch=inkLine(abs(fract(phHu)-.5)/max(fwidth(phHu),1e-4),${FI.hatch[1].toFixed(2)})*phThroat*(1.0-smoothstep(.25,.45,fwidth(phHu)))*smoothstep(${FI.fade.minor[0].toFixed(1)},${FI.fade.minor[1].toFixed(1)},phFaceH);
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
 `).replace('float detail = 0.0;',`float detail = max(max(${FI.weight.major.toFixed(2)}*phMajor,${FI.weight.minor.toFixed(2)}*phMinor),max(${FI.weight.jaw.toFixed(2)}*phJaw,${FI.weight.hatch.toFixed(2)}*phHatch*max(${FI.hatch[2].toFixed(2)},clamp((uToon-L)/uToon*2.0,0.0,1.0))));`);
 mat.needsUpdate=true;
 const matrix=new T.Matrix4(),centre=new T.Vector3(F.offset[0],F.offset[1]+.414*F.scale,F.offset[2]+.31*F.scale);
 const face={mesh,expression:cleanExpression(),blink:0,look:[0,0],state:headInkState(cleanExpression()),
 set(e){this.expression=cleanExpression(e);this.push()},
 eyes(blink=0,squint=null,look=null){this.blink=blink;if(squint!=null)this.expression.squint=squint;this.look[0]=look?(look.x??look[0]):0;this.look[1]=look?(look.y??look[1]):0;this.push()},
 push(){const s=headInkState(this.expression,{blink:this.blink,look:this.look},this.state),w=mesh.morphTargetInfluences;for(let i=0;i<6;i++)w[i]=s.keys[i];w[0]=Math.min(1,Math.max(this.blink,this.expression.squint*.45));const u=mesh.material.uniforms;u.uHeadSpeech.value.set(s.speech[0],s.speech[1],0,0);u.uHeadEye.value.set(...s.eye);u.uPortraitBlink.value=w[0]},
 at(head,out){const sk=mesh.skeleton,i=sk.bones.indexOf(head);if(i<0)return null;matrix.multiplyMatrices(head.matrixWorld,sk.boneInverses[i]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld);return out.copy(centre).applyMatrix4(matrix)},
 facing(out){return out.set(0,0,1).transformDirection(matrix)}};
 // (where his face looks, for the nostrils' fade: from the head joint each time the head is drawn)
 const headBone=mesh.skeleton.bones.find((b)=>b.name==='Head'),_c=new T.Vector3(),_e=new T.Vector3(),_i=new T.Matrix4();
 // (the material drawn, not mat: the passes draw clones of it)
 mesh.onBeforeRender=(renderer,scene,camera,geometry,material)=>{const u=material?.uniforms?.uHeadView;if(!u||!headBone||!face.at(headBone,_c))return;camera.getWorldPosition(_e).sub(_c);u.value.copy(_e).transformDirection(_i.copy(matrix).invert())};
 face.push();return face;
}
