import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadTravellerB3,createTravellerB3,fitB3NeckMaterial} from '../src/characters/traveller-b3.js';
import {buildCharacter} from '../src/player.js';
import {Animator,loadAnimationLibrary} from '../src/animator.js';
import {loadB3Motions,B3MotionPlayer} from '../src/characters/traveller-b3-motion.js';
import {createReviewInk,makeReviewInkMaterial} from './tripo-render.js';
import {makeBody} from '../src/makehuman/body.js';
import {Humanoid} from '../src/humanoid.js';
const $=id=>document.getElementById(id);
try{
 const [assets,lib]=await Promise.all([loadTravellerB3('/'),loadAnimationLibrary('/anim/ual.glb')]);
 const char=buildCharacter(),model=createTravellerB3(char,assets),h=model.humanoid,animator=new Animator(lib,char);
 const catalogue=await loadB3Motions(lib),motionPlayer=new B3MotionPlayer(model,animator,catalogue);
 // Unfitted, average adult male MakeHuman body: no B3 geometry, proportions,
 // arm-clearance or neck corrections. Both players use the same clip clock.
 const referenceChar=buildCharacter(),referenceHumanoid=new Humanoid(makeBody(assets.data,{gender:1,age:.5,muscle:.5,weight:.5,height:.5,proportions:.5},{fresh:true}),referenceChar,'m');
 referenceHumanoid.ownOutfit=true;referenceHumanoid.hingeElbows=true;referenceHumanoid._plan=null;
 referenceChar.root.traverse(o=>{if(o.isMesh)o.visible=false});
 const referenceMeshes=[referenceHumanoid.body,referenceHumanoid.eyeMesh,referenceHumanoid.browMesh].filter(Boolean);for(const o of referenceMeshes){o.visible=true;o.material=new T.MeshStandardMaterial({color:'#a5bbb9',roughness:1})}
 const referenceModel={humanoid:referenceHumanoid,updateCloth(){},poseArms(){return []},poseHands(a){
  const rootQ=referenceChar.root.getWorldQuaternion(new T.Quaternion());
  for(const side of ['r','l']){const q=a.bone(`hand_${side}`).getWorldQuaternion(new T.Quaternion()).premultiply(rootQ),from=referenceHumanoid.handFrames[side],to=a.handFrames[side];referenceHumanoid.orientContact(referenceHumanoid.b[`hand_${side}`],from.along,from.normal,to.along.clone().applyQuaternion(q),to.normal.clone().applyQuaternion(q));referenceHumanoid.shareWristRoll(side)}
 }};
 const referencePlayer=new B3MotionPlayer(referenceModel,new Animator(lib,referenceChar),catalogue);
 const b3Stage=new T.Group(),referenceStage=new T.Group();b3Stage.add(char.root);referenceStage.add(referenceChar.root);

 $('motion').replaceChildren();
 for(const group of [...new Set(catalogue.map(e=>e.group))]){const opt=document.createElement('optgroup');opt.label=group;for(const entry of catalogue.filter(e=>e.group===group)){const o=document.createElement('option');o.value=entry.id;o.textContent=entry.label.replaceAll('_',' ');opt.append(o)}$('motion').append(opt)}
 const restOption=document.createElement('option');restOption.value='rest';restOption.textContent='T-pose';$('motion').append(restOption);
 const scene=new T.Scene();scene.background=new T.Color('#eee9de');scene.add(b3Stage,referenceStage);
 const renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const camera=new T.PerspectiveCamera(33,1,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const light=new T.DirectionalLight(0xffffff,2.2);light.position.set(2,4,3);scene.add(light,new T.HemisphereLight(0xffffff,0x87818a,1.6));
 const grid=new T.GridHelper(4,20,0xb4ac9f,0xd6d0c6);scene.add(grid);
 const helper=new T.Group();helper.add(new T.SkeletonHelper(h.model));const referenceHelper=new T.SkeletonHelper(referenceHumanoid.model);helper.add(referenceHelper);helper.visible=false;scene.add(helper);
 const meshes=[model.mesh,model.head,model.cloth.garment,model.cloth.underlayer,model.cloth.innerShirt],inkMaterials=new Map(meshes.map(m=>[m,m.material]));
 const materials=meshes.map(m=>{const lit=model.standardMaterials.get(m);return {mesh:m,lit,unlit:new T.MeshBasicMaterial({map:lit.map,color:lit.color,vertexColors:lit.vertexColors,side:T.DoubleSide}),clay:new T.MeshStandardMaterial({color:'#d4cbbc',roughness:1,side:T.DoubleSide})}});
 for(const mesh of referenceMeshes){const lit=mesh.material;materials.push({mesh,lit,unlit:new T.MeshBasicMaterial({color:'#a5bbb9'}),clay:new T.MeshStandardMaterial({color:'#d4cbbc',roughness:1})});inkMaterials.set(mesh,makeReviewInkMaterial(mesh));meshes.push(mesh)}
 for(const m of materials){if(m.mesh===model.mesh)fitB3NeckMaterial(m.unlit);m.mesh.material=m.lit;}
 const ink=createReviewInk(renderer,scene,meshes,{grid,helper,inkMaterials});
 let playing=true,time=0,last=0,w=0,hh=0;

 const captureRest=humanoid=>humanoid.body.skeleton.bones.map(b=>({b,p:b.position.clone(),q:(b.parent?.isBone?humanoid.rest.get(b.parent).q.clone().invert():new T.Quaternion()).multiply(humanoid.rest.get(b).q),s:b.scale.clone()}));
 const rest=captureRest(h),referenceRest=captureRest(referenceHumanoid);
 function handTarget(){const s=$('focus').value==='hand'?'l':'r';return h.b[`hand_${s}`].getWorldPosition(new T.Vector3()).lerp(h.b[`middle_02_${s}`].getWorldPosition(new T.Vector3()),.5)}
 function shirtTarget(){return h.b.pelvis.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.10,0))}
 function bodyTarget(){const head=h.b.Head.getWorldPosition(new T.Vector3()),feet=['l','r'].map(s=>h.b[`foot_${s}`].getWorldPosition(new T.Vector3()));const pelvis=h.b.pelvis.getWorldPosition(new T.Vector3());return new T.Vector3(pelvis.x,(Math.max(head.y,...feet.map(p=>p.y))+.16+Math.min(head.y,...feet.map(p=>p.y)))/2,pelvis.z)}
 function faceTarget(){const b=h.b.Head,r=h.rest.get(b),q=b.getWorldQuaternion(new T.Quaternion()).multiply(r.q.clone().invert());return new T.Vector3(0,1.63,.01).sub(r.p).applyQuaternion(q).add(b.getWorldPosition(new T.Vector3()))}
 function comparing(){return $('compare').checked&&!$('sheet').checked}
 function focusTarget(){const focus=$('focus').value;return (['hand','rightHand'].includes(focus)?handTarget():focus==='face'?faceTarget():focus==='shirt'?shirtTarget():bodyTarget()).sub(b3Stage.position)}
 function stageComparison(){
  const on=comparing(),focus=$('focus').value,gap=focus==='body'?1.95:focus==='shirt'?.80:focus==='face'?.40:.34;
  camera.updateMatrixWorld();const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  b3Stage.position.copy(right).multiplyScalar(on?-gap/2:0);referenceStage.position.copy(right).multiplyScalar(gap/2);referenceStage.visible=on;referenceHelper.visible=on;$('comparison-labels').hidden=!on;
 }
 function frameView(){const focus=$('focus').value,target=focusTarget();const dir={front:[0,0,1],side:[1,0,0],right:[-1,0,0],back:[0,0,-1],quarter:[.65,.05,.76]}[$('angle').value];if(focus==='rightHand'&&$('angle').value==='quarter')dir[0]*=-1;
  const aspect=$('view').clientWidth/Math.max(1,$('view').clientHeight),base=['hand','rightHand'].includes(focus)?.6:focus==='face'?.85:focus==='shirt'?1.3:3.85;
  const span=focus==='body'?3.95:focus==='shirt'?1.45:focus==='face'?.75:.63;
  const dist=comparing()?Math.max(base,span/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*aspect)):base*Math.max(1,.85/aspect);
  controls.target.copy(target);camera.position.copy(target).add(new T.Vector3(...dir).normalize().multiplyScalar(dist));controls.update();stageComparison();
 }
 $('angle').onchange=frameView;$('focus').onchange=frameView;$('compare').onchange=frameView;
 function pose(dt){model.cloth.underlayer.visible=model.cloth.innerShirt.visible=$('backing').checked;model.clothEnabled=$('cloth').checked;const motion=$('motion').value;
  if(motion==='rest'){for(const r of [...rest,...referenceRest]){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s)}if($('hands').value!=='auto')h.hands.set($('hands').value);if($('hands').value!=='auto')referenceHumanoid.hands.set($('hands').value);model.updateCloth(0,true)}
  else {const options={hands:$('hands').value,blend:playing&&dt>0,speaking:$('talk').checked};motionPlayer.pose(motion,time,dt,options);if(comparing())referencePlayer.pose(motion,time,dt,options);}
  // Face controls remain the approved head's own morphs and ink.
  model.head.material=inkMaterials.get(model.head);
  h.drawnFace.eyes(time%4.5<.16?Math.sin(time%4.5/.16*Math.PI):0,0,[Math.sin(time*.5)*.15,0]);h.setExpression({open:$('talk').checked?.18+.12*Math.sin(time*9):0});
  char.root.updateMatrixWorld(true);h.body.skeleton.update();referenceChar.root.updateMatrixWorld(true);referenceHumanoid.body.skeleton.update();
 }
 $('play').onclick=()=>{const e=catalogue.find(e=>e.id===$('motion').value);if(!playing&&e&&['Actions','Gestures'].includes(e.group)&&time>=e.clip.duration)time=0;playing=!playing;$('play').textContent=playing?'Pause':'Play'};
 $('step').onclick=()=>{playing=false;$('play').textContent='Play';time+=1/30;pose(1/30)};
 $('seek').onclick=()=>{playing=false;$('play').textContent='Play';time=Math.max(0,Number($('time').value)||0);pose(0)};
 $('motion').onchange=()=>{time=0;pose(playing?1/60:0);frameView()};$('hands').onchange=()=>{if($('hands').value!=='auto')h.hands.set($('hands').value);pose(0)};
 $('light').onclick=()=>{$('mode').value='lit';light.position.x*=-1;light.position.z*=-1};
 for(let i=0;i<Math.ceil(catalogue.length/16);i++){const o=document.createElement('option');o.value=i;o.textContent=`${i+1} / ${Math.ceil(catalogue.length/16)}`;$('sheetPage').append(o)}
 function renderSheet(){
  if(!$('sheet').checked)return;
  const canvas=$('gallery'),ctx=canvas.getContext('2d'),cell=256,row=300,start=Number($('sheetPage').value)*16,phase=Number($('sheetPhase').value);
  canvas.width=1024;canvas.height=1200;ctx.fillStyle='#eee9de';ctx.fillRect(0,0,1024,1200);
  const cam=new T.PerspectiveCamera(36,1,.01,100);cam.position.set(2.4,1.5,3.5);cam.lookAt(0,.9,0);
  renderer.setPixelRatio(1);renderer.setSize(cell,cell,false);helper.visible=false;grid.visible=false;
  for(const m of materials)m.mesh.material=m.clay;
  for(let k=0;k<16&&start+k<catalogue.length;k++){
   const e=catalogue[start+k];motionPlayer.pose(e.id,e.clip.duration*phase,0);
   b3Stage.position.set(0,0,0);referenceStage.visible=false;const target=bodyTarget();cam.position.copy(target).add(new T.Vector3(2.4,.6,3.5));cam.lookAt(target);renderer.render(scene,cam);const x=k%4*cell,y=Math.floor(k/4)*row;
   ctx.drawImage(renderer.domElement,x,y,cell,cell);ctx.fillStyle='#292d34';ctx.font='12px system-ui';ctx.fillText(`${start+k+1}. ${e.label}`,x+5,y+270,246);ctx.fillText(`${e.group} · ${Math.round(phase*100)}%`,x+5,y+287,246);
  }
  grid.visible=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));w=hh=0;
 }
 $('sheet').onchange=()=>{const on=$('sheet').checked;$('gallery').hidden=!on;$('view').style.display=on?'none':'block';document.body.style.overflow=on?'auto':'hidden';renderSheet();frameView()};
 $('sheetPage').onchange=renderSheet;$('sheetPhase').onchange=renderSheet;
 function frame(now){if($('sheet').checked){last=now;requestAnimationFrame(frame);return}const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(playing)time+=dt;pose(playing?dt:0);helper.visible=$('rig').checked;const target=focusTarget(),delta=target.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(target);controls.update();stageComparison();
  const cw=$('view').clientWidth,ch=$('view').clientHeight;if(cw!==w||ch!==hh){w=cw;hh=ch;renderer.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix();frameView()}
  const mode=$('mode').value;for(const m of materials)m.mesh.material=m[mode==='ink'?'lit':mode];if(mode==='ink')ink.render(camera,time);else renderer.render(scene,camera);
  $('status').textContent=`${$('motion').selectedOptions[0].text} · ${time.toFixed(2)} s · ${catalogue.length} clips available · Approved portrait head · 53 fitted bones${comparing()?' · Left: B3 · Right: default male rig · Same scale and clip time':''} · Accepted body · Shirt physics ${model.clothEnabled?'on':'off'}.`;
  requestAnimationFrame(frame);
 }
 pose(0);frameView();window.travellerB3Review={model,char,animator,referenceModel,referencePlayer,scene,renderer,camera,pose,get time(){return time}};requestAnimationFrame(frame);
}catch(e){$('status').textContent=e.stack;console.error(e)}
