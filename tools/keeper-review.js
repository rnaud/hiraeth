import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createKeeperCreature} from '../src/characters/keeper-creature.js';
import {createReviewInk} from './tripo-render.js';
import {Guardian} from '../src/temples/boss.js';
import {KEEPER} from '../src/temples/desert.js';
const $=id=>document.getElementById(id);
try{
 const gltf=await new GLTFLoader().loadAsync('/guardians/keeper-v1/model.glb');
 const scene=new T.Scene();scene.background=new T.Color('#eee9de');
 let model,guard,t=0,playing=true,last=0,viewOffset=new T.Vector3(0,3.6,0),cssWidth=0,cssHeight=0,frameMs=16.7;
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));document.body.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(35,1,.05,250),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const light=new T.DirectionalLight(0xffffff,2.3);light.position.set(3,5,4);scene.add(light,new T.HemisphereLight(0xffffff,0x817d89,1));
 const grid=new T.GridHelper(50,50,0xb8af9d,0xd9d2c4);scene.add(grid);const helper=new T.Group();helper.visible=false;scene.add(helper);
 const runtime={def:{id:'keeper-review'},root:new T.Group(),logic:{resolved:false},notice(){},player:{pos:new T.Vector3(0,0,9),dead:false},physics:{groundAt:()=>0}};scene.add(runtime.root);
 const floor=new T.Mesh(new T.PlaneGeometry(250,250),new T.MeshStandardMaterial({color:'#ded7c4',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
 let ink,materials;
 function rebuild(){if(model){t=0;model.reset();guard.state='sleep';guard.floor=guard.meter=0;guard.reset();Object.assign(guard.rigK,{x:0,y:0,z:0,ry:0,s:1,sy:1,spin:0});return;}model=createKeeperCreature(gltf);scene.add(model.group);materials=[...model.meshes,floor].map(m=>({mesh:m,lit:m.material,unlit:new T.MeshBasicMaterial({map:m.material.map,color:m.material.color}),clay:new T.MeshStandardMaterial({color:'#d9d1bd',roughness:1})}));ink=createReviewInk(renderer,scene,[...model.meshes,floor],{grid,helper,focus:()=>model.pos});guard=new Guardian(runtime,{def:KEEPER,model,arena:{center:new T.Vector3(),r:20,y:0}});runtime.root.visible=false;t=0;}
 rebuild();
 function angle(a){viewOffset.set(0,a==='head'?6.95:3.6,a==='head'?3.1:0);const d={head:[1,0,.08],front:[0,.05,1],side:[1,.05,0],back:[0,.05,-1],quarter:[.85,.20,1]}[a];controls.target.copy(model.pos).add(viewOffset);camera.position.copy(new T.Vector3(...d).normalize().multiplyScalar((a==='head'?4:22)*Math.max(1,.9*innerHeight/innerWidth))).add(controls.target);controls.update();}
 document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>angle(b.dataset.angle));angle('quarter');$('light').onclick=()=>{$('mode').value='lit';light.position.x*=-1;light.position.z*=-1;};
 $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};$('step').onclick=()=>{playing=false;$('play').textContent='Play';advance(1/30);};$('reset').onclick=()=>rebuild();$('motion').onchange=()=>rebuild();$('go').onclick=()=>{const target=Math.max(0,Math.min(30,Number($('seek').value)||0));rebuild();playing=false;$('play').textContent='Play';for(let i=0;i<Math.round(target*60);i++)advance(1/60);};
 function advance(dt){t+=dt;const motion=$('motion').value;runtime.root.visible=motion==='encounter';
  if(motion==='encounter'){guard.update(dt,t);return;}
  const states=['sleep','wake','open','weary','resolved'];const state=states.includes(motion)?motion:'fight';const attack=KEEPER.attacks[motion]&&t%6<2.4?{...KEEPER.attacks[motion],id:motion}:null;
  const k=(t%6)/1.8;model.pos.set(0,0,0);model.heading=0;
  if(motion==='walk')model.pos.z=t*.9;
  if(motion==='turn'){model.heading=t*.22;model.pos.set(Math.sin(model.heading)*4,0,Math.cos(model.heading)*4);}
  if(motion==='charge')model.pos.z=t*.9;
  model.group.position.copy(model.pos);model.group.rotation.y=model.heading;
  // Use the real encounter telegraph driver in isolated attack reviews too.
  guard.state=state;guard.attack=attack;guard.attackK=k;guard.struck=k>=1;guard.poseRig(dt,t);
  model.animate(dt,t,{state,attack,k,jawOpen:motion==='jawClosed'?0:motion==='jawOpen'?1:undefined,speed:motion==='walk'?.9:0,meter:state==='resolved'?1:0,phase:0,kit:{ground:()=>0}});
 }
 function frame(now){const elapsed=last?(now-last)/1000:1/60;last=now;frameMs+=(elapsed*1000-frameMs)*.06;if(playing){const dt=Math.min(.1,elapsed),steps=Math.max(1,Math.ceil(dt/(1/60)));for(let i=0;i<steps;i++)advance(dt/steps);}
  const focus=model.pos.clone().add(viewOffset),delta=focus.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(focus);controls.update();
  if(cssWidth!==innerWidth||cssHeight!==innerHeight){cssWidth=innerWidth;cssHeight=innerHeight;renderer.setSize(cssWidth,cssHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  const mode=$('mode').value;for(const x of materials)x.mesh.material=x[mode==='ink'?'lit':mode];runtime.root.visible=false; // encounter logic runs; its effect meshes need separate material review
  if(mode==='ink')ink.render(camera,t);else renderer.render(scene,camera);
  floor.position.x=model.pos.x;floor.position.z=model.pos.z;
  $('status').textContent=`${$('motion').selectedOptions[0].text}${$('motion').value==='encounter'?' ('+guard.state+(guard.attack?' / '+guard.attack.id:'')+'; effects hidden)':''} · ${t.toFixed(2)} s · independent footfalls + planted feet · 26 fitted bones · mouth height ${model.mouth.y.toFixed(2)} m · ${playing?'playing':'paused'} · ${Math.round(1000/frameMs)} fps`;
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(e){$('status').textContent=e.stack;}
