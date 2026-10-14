import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {travellerB3} from './gait-sim.js';
import {createTraveller} from '../src/characters/traveller.js';
import {B3_HEAD_FIT as F} from '../src/characters/traveller-b3.js';
import {buildCharacter} from '../src/player.js';
import {PORTRAIT_EYES_FAR as EF} from '../src/characters/portrait-head.js';
import {TalkFace} from '../src/talk-face.js';
import {markHero} from '../src/materials.js';
import {readGlb} from '../scripts/tripo/slim-traveller.mjs';
// (the head the game's traveller wears, B3: src/characters/traveller.js, fitted by B3_HEAD_FIT)
const assets=await travellerB3();
const source=assets.head.scene.children.find(o=>o.isMesh),raw=source.geometry.attributes.position;
const make=()=>{const char=buildCharacter();return {char,...createTraveller(char,assets)}};

test('portrait source positions, indices and UVs survive preparation; 2K plus R8 mask stays within the head budget',()=>{
 const original=readGlb(readFileSync('data/characters/traveller-v1/head-v3/model.glb'));
 const prepared=readGlb(readFileSync('public/characters/traveller-v1/head-v3/model.glb'));
 const bytes=(g,k)=>{const p=g.json.meshes[0].primitives[0],a=g.json.accessors[k==='indices'?p.indices:p.attributes[k]],v=g.json.bufferViews[a.bufferView];return g.bin.subarray(v.byteOffset+(a.byteOffset??0),v.byteOffset+v.byteLength)};
 for(const key of ['POSITION','TEXCOORD_0','indices'])assert.deepEqual(bytes(prepared,key),bytes(original,key),key);
 const report=JSON.parse(readFileSync('public/characters/traveller-v1/head-v3/provenance.json'));
 assert.ok(report.shippedBytes<2.5e6);assert.equal(report.textureSize,2048);assert.ok(report.baseColorMiB+report.hairMaskMiB<23);
 assert.equal(assets.head.scene.userData.travellerHead,'v3');assert.ok(source.geometry.attributes._portrait_hair.count===raw.count);
});

test('portrait fit preserves the entire accepted skull, anchors the jaw rigidly and buries the neck end under the scarf',()=>{
 const c=make(),{head,mesh,char}=c,p=head.geometry.attributes.position,w=head.geometry.attributes.skinWeight;
 assert.equal(head.name,'TravellerPortraitHead');assert.equal(head.skeleton,mesh.skeleton);
 assert.deepEqual(head.geometry.attributes.uv.array,source.geometry.attributes.uv.array);
 let jaw=0,extended=0;
 for(let i=0;i<p.count;i++){
  const expected=new T.Vector3().fromBufferAttribute(raw,i).multiplyScalar(F.scale).add(new T.Vector3(...F.offset));
  if(raw.getY(i)>=.19||raw.getZ(i)>=.24)assert.ok(new T.Vector3().fromBufferAttribute(p,i).distanceTo(expected)<1e-6,'skull/face unchanged');
  // (the neck's end 3.8 cm under the fit's origin: 1.472 m on v1's fit, 1.449 on B3's)
  if(raw.getY(i)<.015){assert.ok(p.getY(i)<F.offset[1]-.038);extended++;}
  if(raw.getY(i)>.134&&raw.getZ(i)>.20){assert.equal(w.getX(i),1,'jaw belongs to skull');jaw++;}
  assert.ok(Math.abs(w.getX(i)+w.getY(i)-1)<1e-6);
 }
 assert.ok(jaw>100&&extended>50);
 char.root.position.set(110,14,-84);char.root.rotation.set(.15,.8,-.2);char.root.updateMatrixWorld(true);head.skeleton.update();
 for(let i=0;i<p.count;i+=83){const q=new T.Vector3().fromBufferAttribute(p,i);assert.ok(head.applyBoneTransform(i,q.clone()).distanceTo(q)<1e-4,'neutral bind away from origin');}
 const before=mesh.geometry.attributes.position.array.slice();c.humanoid.b.Head.rotateY(.65);char.root.updateMatrixWorld(true);head.skeleton.update();
 let moved=0;for(let i=0;i<p.count;i+=83){const q=new T.Vector3().fromBufferAttribute(p,i);if(w.getX(i)===1&&head.applyBoneTransform(i,q.clone()).distanceTo(q)>.01)moved++;}
 assert.ok(moved>100);assert.deepEqual(mesh.geometry.attributes.position.array,before,'face/head work never rewrites clothing positions');
});

test('measured blink closes the original eyes; speech leaves nose, hair and throat stationary',()=>{
 const {head,humanoid:h}=make(),m=head.geometry.morphAttributes.position,hair=head.geometry.attributes._portrait_hair;
 let distance=0,closed=0,n=0,mouth=0;
 for(let i=0;i<raw.count;i++){
  const x=raw.getX(i),y=raw.getY(i),z=raw.getZ(i),eye=F.eyes[x<0?0:1];
  if(Math.abs(x-eye[0])<.035&&Math.abs(y-eye[1])<.018&&z>.2){distance+=Math.abs(y-eye[1]);closed+=Math.abs(y-eye[1]+m[0].getY(i)/F.scale);n++;}
  if(y>.335||y<.13||hair.getX(i)===1)assert.ok(Math.abs(m[5].getY(i))<1e-9,'speech bounded to lower face');
  if(m[5].getY(i)<-.001)mouth++;
  if(hair.getX(i)===1)for(const morph of m)for(let k=0;k<3;k++)assert.ok(Math.abs(morph.getComponent(i,k))<1e-9,'expressions do not deform locks');
 }
 assert.ok(n>20&&closed<distance*.02,`${n} vertices close to ${closed/distance} of open height`);assert.ok(mouth>100);
 markHero(head.parent);h.setExpression({});h.drawnFace.eyes(0,0,null);assert.ok(head.morphTargetInfluences.every(v=>v===0));
 h.drawnFace.eyes(1,0,null);assert.equal(head.morphTargetInfluences[0],1);assert.equal(head.material.uniforms.uPortraitBlink.value,1);
 h.drawnFace.eyes(0,0,null);const before=[...head.morphTargetInfluences];h.drawnFace.eyes(0,0,{x:.25,y:-.12});assert.deepEqual(head.morphTargetInfluences,before);assert.ok(head.material.uniforms.uHeadEye.value.z>0);
 const talk=new TalkFace(h);let min=1,max=0;for(let i=0;i<180;i++){talk.update(1/60,{speaking:true,tone:'neutral',mouth:i%20<10?.9:0});if(i>40){min=Math.min(min,head.morphTargetInfluences[5]);max=Math.max(max,head.morphTargetInfluences[5]);}}
 assert.ok(max>.2&&min<max*.5);for(let i=0;i<400;i++)talk.update(1/60,{});assert.ok(head.morphTargetInfluences[5]<1e-4);
 assert.ok(!head.material.fragmentShader.includes('headInk('),'old eye/brow drawing is absent');assert.equal(head.material.uniforms.uShade.value.z,0,'face does not accumulate generic crosshatching');
});

test('the visible jaw and skull stay rigid through combined head yaw/pitch and reset without drift',()=>{
 const c=make(),{head,char}=c,bone=c.humanoid.b.Head,p=head.geometry.attributes.position,rest=bone.quaternion.clone(),index=head.geometry.index;
 // (above the chin, source y .1326: 1.545 m on v1's fit, 1.524 on B3's)
 const edges=new Set(),pairs=[],chin=F.offset[1]+.1326*F.scale;
 for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){const a=index.getX(i+k),b=index.getX(i+(k+1)%3),key=Math.min(a,b)+','+Math.max(a,b);if(edges.has(key)||p.getY(a)<chin||p.getY(b)<chin)continue;edges.add(key);const len=new T.Vector3().fromBufferAttribute(p,a).distanceTo(new T.Vector3().fromBufferAttribute(p,b));if(len>1e-5)pairs.push([a,b,len]);}
 assert.ok(pairs.length>20000);
 for(const [pitch,yaw] of [[.4,.8],[-.35,-.8],[0,0]]){
  bone.quaternion.copy(rest).multiply(new T.Quaternion().setFromEuler(new T.Euler(pitch,yaw,0)));char.root.updateMatrixWorld(true);head.skeleton.update();
  const posed=Array.from({length:p.count},(_,i)=>head.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(p,i)));
  for(const [a,b,len] of pairs)assert.ok(Math.abs(posed[a].distanceTo(posed[b])/len-1)<.002,'visible edges keep their length');
 }
 bone.quaternion.copy(rest);char.root.updateMatrixWorld(true);head.skeleton.update();
 for(let i=0;i<p.count;i+=79){const q=new T.Vector3().fromBufferAttribute(p,i);assert.ok(head.applyBoneTransform(i,q.clone()).distanceTo(q)<1e-4);}
});

// Issue #302 (the ink-lines audit v1.66): from 10 m his painted eyes were two dark dots on a 12 px face, 4.4 times the 1 m
// portrait's share of the face at 1080p. Under PORTRAIT_EYES_FAR.face render pixels of face the eye's patch is one warm
// tone; the 4 m portrait at 1080p (31 px) is drawn as before, the 10 m one (12-13 px, 9 on the Deck) all the far tone.
test('the portrait head\'s eyes from afar turn to one warm tone by the face\'s size on screen, not dark dots (issue #302)',()=>{
 const {head}=make(),fs=head.material.fragmentShader;
 assert.ok(EF.face[1]<31&&EF.face[0]>=13,'4 m at 1080p untouched, 10 m all far');
 assert.ok(fs.includes(`smoothstep(${EF.face[0].toFixed(1)},${EF.face[1].toFixed(1)},phFaceR)`),'faded by the face in render pixels');
 assert.ok(fs.includes(`albedo=mix(albedo,vec3(${EF.tone.map(v=>v.toFixed(3)).join(',')}),phFar);`));
 // after the eye's paint and the kept dark round it, before the pen lines and the blink's drawn lid
 assert.ok(fs.indexOf('phFar);')>fs.indexOf('albedo=mix(albedo,eyePaint,phInside);')&&fs.indexOf('phFar);')<fs.indexOf('float eyeClose='));
 // a little darker than the skin (.79, .525, .37), warm, never a dark mark (darker, it added to the eyes' dark share)
 const L=(c)=>.2126*c[0]+.7152*c[1]+.0722*c[2];
 assert.ok(L(EF.tone)>.8*L([.79,.525,.37])&&L(EF.tone)<.97*L([.79,.525,.37])&&EF.tone[0]>EF.tone[1]&&EF.tone[1]>EF.tone[2]);
});
