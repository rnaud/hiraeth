import { createReviewInk } from './tripo-render.js';
import { updateTripoHands } from './tripo-hands.js';
import { makeTripoCloth } from './tripo-cloth.js';
import { relaxWalkArms, relaxWalkHands, seatTripoArms } from './tripo-walk.js';
import { fitDonorToSurface } from './tripo-fit.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadBody, makeBody } from '../src/makehuman/body.js';
import { Humanoid } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { Animator, loadAnimationLibrary } from '../src/animator.js';
const $=id=>document.getElementById(id);
try {
 const [gltf,data,report,lib,colors]=await Promise.all([new GLTFLoader().loadAsync('/output/character-tripo/rig-prototype.glb'),loadBody('/'),fetch('/output/character-tripo/rig-prototype.glb.json').then(r=>r.json()),loadAnimationLibrary('/anim/ual.glb'),fetch('/output/character-tripo/baseline/vertex-colors.json').then(r=>r.json())]);
 const template=makeBody(data,report.params),surface=[];
 gltf.scene.traverse(o=>{if(o.isSkinnedMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)surface.push(new THREE.Vector3().fromBufferAttribute(p,i));}});
 fitDonorToSurface(template,surface);
 const char=buildCharacter(),humanoid=new Humanoid(template,char,'m'),animator=new Animator(lib,char);
 char.root.traverse(o=>{if(o.isMesh)o.visible=false;});
 const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9de');scene.add(char.root);
 const skins=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});

 const meshes=[];
 for(const source of skins){const material=source.material.clone();material.roughness=1;material.metalness=0;material.roughnessMap=null;material.metalnessMap=null;material.normalMap=null;const mesh=new THREE.SkinnedMesh(source.geometry,material);mesh.name='TripoSurface';mesh.frustumCulled=false;humanoid.body.parent.add(mesh);mesh.bind(humanoid.body.skeleton,humanoid.body.bindMatrix);meshes.push(mesh);}
 scene.add(new THREE.HemisphereLight(0xffffff,0x87818a,2));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(2,4,3);scene.add(sun);
 const grid=new THREE.GridHelper(4,20,0xb4ac9f,0xd6d0c6);scene.add(grid);
 const helper=new THREE.SkeletonHelper(humanoid.model);helper.visible=false;scene.add(helper);
 const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 const camera=new THREE.PerspectiveCamera(33,1,.01,100);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=.35;controls.maxDistance=8;controls.minPolarAngle=.06;controls.maxPolarAngle=Math.PI-.06;
 let trackedHand=null;
 function frameView(){
  const focus=$('focus').value,targets={body:[0,.93,0],face:[0,1.65,0],legs:[0,.55,0]},distances={body:3.9,face:.82,hand:.62,legs:2};
  const target=focus==='hand'?humanoid.b.hand_l.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(...targets[focus]);
  const directions={front:[0,1],side:[1,0],back:[0,-1],quarter:[.65,.76]},d=directions[$('angle').value],dist=distances[focus];
  trackedHand=focus==='hand'?target.clone():null;
  controls.target.copy(target);camera.position.set(target.x+d[0]*dist,target.y+.04,target.z+d[1]*dist);controls.update();
 }
 $('angle').onchange=frameView;$('focus').onchange=frameView;$('reset-view').onclick=frameView;frameView();
 humanoid.body.skeleton.pose();
 char.root.updateMatrixWorld(true);
 const cloth=makeTripoCloth(meshes[0],colors);
 let ink=null;
 const rest=new Map(humanoid.body.skeleton.bones.map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 let play=true,last=0,time=0,settle=false;
 $('play').onclick=()=>{play=!play;$('play').textContent=play?'Pause':'Play';};
 $('step').onclick=()=>{const motion=$('motion').value;if(!lib.clips[motion])return;time+=lib.clips[motion].duration/8;play=false;settle=true;$('play').textContent='Play';};
 function frame(t){const dt=Math.min((t-last)/1000,.04);last=t;if(play)time+=dt;const motion=$('motion').value;
  if(motion==='rest'){for(const [b,r]of rest){b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}}
  else {for(const [name,action]of Object.entries(animator.actions)){action.setEffectiveWeight(name===motion?1:0);if(name===motion)action.time=time%lib.clips[name].duration;}animator.mixer.update(0);animator.src.updateMatrixWorld(true);animator.apply(char.root);const rotations=relaxWalkArms(char,motion,$('relax').checked);humanoid.update();humanoid.poseHands(animator);relaxWalkHands(humanoid,rotations);seatTripoArms(humanoid,motion);updateTripoHands(humanoid,play?dt:0,motion,$('hand-pose').value);}
  if(motion==='rest')updateTripoHands(humanoid,play?dt:0,motion,$('hand-pose').value);
  cloth.underlayer.visible=$('repairs').checked;char.root.updateMatrixWorld(true);if(settle){cloth.update(0,'rest',true);for(let i=0;i<45;i++){updateTripoHands(humanoid,1/90,motion,$('hand-pose').value);cloth.update(1/90,motion,$('cloth').checked);}settle=false;}const clothStats=cloth.update(play?dt:0,motion,$('cloth').checked);$('cloth-status').textContent=`Overshirt: ${clothStats.particles} simulation points · ${clothStats.renderTriangles} textured triangles · ${$('cloth').checked?'collision enabled':'simulation off'}`;helper.visible=$('bones').checked;helper.updateMatrixWorld(true);
  if(trackedHand){const next=humanoid.b.hand_l.getWorldPosition(new THREE.Vector3()),shift=next.clone().sub(trackedHand);controls.target.add(shift);camera.position.add(shift);trackedHand.copy(next);}
  controls.update();
  const w=$('view').clientWidth,h=$('view').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if($('style').checked){ink??=createReviewInk(renderer,scene,[...meshes,cloth.garment,cloth.underlayer,cloth.innerShirt],{garment:cloth.garment,grid,helper});ink.render(camera,time);}else renderer.render(scene,camera);requestAnimationFrame(frame);
 }

 window.tripoReview={scene,meshes,humanoid,animator,renderer,camera,controls};$('status').textContent=`${report.vertices.toLocaleString()} vertices · ${report.bones} MakeHuman bones · surface-fitted arms · matte material · lower overshirt simulation`;
 requestAnimationFrame(frame);
} catch(error){$('status').textContent=error.message;console.error(error);}
