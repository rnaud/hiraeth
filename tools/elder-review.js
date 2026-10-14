import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createElderCreature} from '../src/characters/elder-v3-creature.js';
import * as fit from '../src/characters/elder-v3-fit.js';
import {createReviewInk} from './tripo-render.js';
import {Guardian} from '../src/temples/boss.js';
import {ELDER} from '../src/temples/arzach.js';
import {driveElder} from './elder-drive.js';
import {simplify,triCount} from '../src/lod.js';
const $=id=>document.getElementById(id);
try{
 const gltf=await new GLTFLoader().loadAsync('/guardians/elder-v3/model.glb');
 const scene=new T.Scene();scene.background=new T.Color('#eee9de');
 let model,guard,t=0,playing=true,last=0,viewOffset=new T.Vector3(0,3.6,0),cssWidth=0,cssHeight=0,frameMs=16.7;
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));document.body.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(35,1,.05,250),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const light=new T.DirectionalLight(0xffffff,2.3);light.position.set(3,5,4);scene.add(light,new T.HemisphereLight(0xffffff,0x817d89,1));
 const grid=new T.GridHelper(50,50,0xb8af9d,0xd9d2c4);scene.add(grid);const helper=new T.Group();helper.visible=false;scene.add(helper);
 const runtime={def:{id:'elder-review'},root:new T.Group(),logic:{resolved:false},notice(){},player:{pos:new T.Vector3(0,0,9),dead:false},physics:{groundAt:()=>0}};scene.add(runtime.root);
 const floor=new T.Mesh(new T.PlaneGeometry(250,250),new T.MeshStandardMaterial({color:'#ded7c4',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
 let ink,materials,skeleton,legLines;
 function rebuild(){if(model){t=0;model.reset();guard.state='sleep';guard.floor=guard.meter=0;guard.reset();Object.assign(guard.rigK,{x:0,y:0,z:0,ry:0,s:1,sy:1,spin:0});return;}model=createElderCreature(gltf,{fit});scene.add(model.group);materials=[...model.meshes,floor].map(m=>({mesh:m,lit:m.material,unlit:new T.MeshBasicMaterial({map:m.material.map,color:m.material.color}),clay:new T.MeshStandardMaterial({color:'#d9d1bd',roughness:1})}));ink=createReviewInk(renderer,scene,[...model.meshes,floor],{grid,helper,focus:()=>model.pos});guard=new Guardian(runtime,{def:ELDER,model,arena:{center:new T.Vector3(),r:20,y:0}});runtime.root.visible=false;t=0;}
 rebuild();skeleton=new T.SkeletonHelper(model.group);skeleton.material.depthTest=false;helper.add(skeleton);const legGeo=new T.BufferGeometry();legGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(24),3));legLines=new T.LineSegments(legGeo,new T.LineBasicMaterial({color:0xd17535,depthTest:false}));helper.add(legLines);
 $('rig').onchange=()=>helper.visible=$('rig').checked;
 $('phase').onchange=()=>rebuild();
 function angle(a,zoom=1){const close=a==='head'||a==='face';viewOffset.set(0,close?5.9:3.6,close?.8:0);const d={face:[0,0,1],head:[1,0,.08],front:[0,.05,1],side:[1,.05,0],back:[0,.05,-1],quarter:[.85,.20,1],under:[.6,-.35,.75],above:[.3,1.1,.6]}[a];controls.target.copy(model.pos).add(viewOffset);camera.position.copy(new T.Vector3(...d).normalize().applyAxisAngle(new T.Vector3(0,1,0),model.heading).multiplyScalar(zoom*(close?5.3:22)*Math.max(1,.9*innerHeight/innerWidth))).add(controls.target);controls.update();}
 document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>angle(b.dataset.angle));angle('quarter');$('light').onclick=()=>{$('mode').value='lit';light.position.x*=-1;light.position.z*=-1;};
 $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};$('step').onclick=()=>{playing=false;$('play').textContent='Play';advance(1/30);};$('reset').onclick=()=>rebuild();$('motion').onchange=()=>{$('phase').value=$('motion').value==='hover'?'1':'0';rebuild();};const seekTo=target=>{rebuild();playing=false;$('play').textContent='Play';for(let i=0;i<Math.round(target*60);i++)advance(1/60);};$('headMotion').onchange=()=>{const target=t,wasPlaying=playing;seekTo(target);playing=wasPlaying;$('play').textContent=playing?'Pause':'Play';};$('go').onclick=()=>{const target=Math.max(0,Math.min(30,Number($('seek').value)||0));rebuild();playing=false;$('play').textContent='Play';for(let i=0;i<Math.round(target*60);i++)advance(1/60);};
 function advance(dt){t+=dt;const motion=$('motion').value;runtime.root.visible=motion==='encounter';
  const shown=driveElder({model,guard,t,dt,motion,phase:Number($('phase').value),headMotion:$('headMotion').checked});
  if(motion==='flightCycle')$('phase').value=String(shown);
 }
 function draw(){const mode=$('mode').value;floor.position.x=model.pos.x;floor.position.z=model.pos.z;for(const x of materials)x.mesh.material=x[mode==='ink'?'lit':mode];runtime.root.visible=false; // encounter logic runs; its effect meshes need separate material review
  if(mode==='ink')ink.render(camera,t);else renderer.render(scene,camera);}
 // Scripted review (scripts/tripo/elder-sheets.mjs): contact sheets of whole cycles, each frame from several angles and
 // renderings. stop() ends the page's own loop; start() resets to a motion, step() advances at 60 Hz, view() draws one.
 let stopped=false;
 window.elderReview={stop(){stopped=true;playing=false;},start(motion,phase){$('motion').value=motion;$('phase').value=String(phase??(motion==='hover'?1:0));playing=false;rebuild();},
  step(seconds){for(let i=0;i<Math.round(seconds*60);i++)advance(1/60);},size(w,h){renderer.setPixelRatio(1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();cssWidth=innerWidth;cssHeight=innerHeight;},
  view(a,mode,zoom){$('mode').value=mode;angle(a,zoom);draw();return renderer.domElement;},
  // (her levels of detail, as the game's ELDER_LOD builds them: j the cell 2^j m; -Infinity: whole)
  lod(j){const m=model.meshes[0];m.userData.full??=m.geometry;m.geometry=j===-Infinity||j==null?m.userData.full:simplify(m.userData.full,2**j);return triCount(m.geometry);},get t(){return t;},get model(){return model;},get guard(){return guard;}};
 function frame(now){if(stopped)return;const elapsed=last?(now-last)/1000:1/60;last=now;frameMs+=(elapsed*1000-frameMs)*.06;if(playing){const dt=Math.min(.1,elapsed),steps=Math.max(1,Math.ceil(dt/(1/60)));for(let i=0;i<steps;i++)advance(dt/steps);}
  const focus=model.pos.clone().add(viewOffset),delta=focus.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(focus);controls.update();
  if(cssWidth!==innerWidth||cssHeight!==innerHeight){cssWidth=innerWidth;cssHeight=innerHeight;renderer.setSize(cssWidth,cssHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  if(helper.visible){const p=legLines.geometry.attributes.position;let at=0;for(let i=0;i<2;i++)for(const names of [['thigh','shin'],['shin','foot']])for(const role of names){const v=model.bones[`leg${i}_${role}`].getWorldPosition(new T.Vector3());p.setXYZ(at++,v.x,v.y,v.z);}p.needsUpdate=true;legLines.geometry.computeBoundingSphere();}
  draw();
  $('status').textContent=`${$('motion').selectedOptions[0].text}${$('motion').value==='encounter'?' ('+guard.state+(guard.attack?' / '+guard.attack.id:'')+'; effects hidden)':''} · ${t.toFixed(2)} s · Aerie guardian · Natural wings · 23 fitted bones · ${Number($('phase').value)>0?'airborne phase · ':''}mouth height ${model.mouth.y.toFixed(2)} m · ${playing?'playing':'paused'} · ${Math.round(1000/frameMs)} fps`;
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(e){$('status').textContent=e.stack;}
