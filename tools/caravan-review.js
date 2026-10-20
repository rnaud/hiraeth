import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeMaterial } from '../src/materials.js';
import { createCaravanInkRenderer } from './caravan-renderer.js';
import { loadCaravanPrototype, CARAVAN } from '../src/ship/caravan-prototype.js';
// A silent review scene: it never constructs the game or an audio system, and reads no save/preferences.
THREE.ColorManagement.enabled = false;
const $=id=>document.getElementById(id),canvas=$('view');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(37,1,.1,2000),controls=new OrbitControls(camera,canvas);controls.target.set(0,7,1);controls.enableDamping=true;controls.minDistance=18;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.49;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),makeMaterial({color:'#e1bca4'}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
$('arrive').disabled = $('depart').disabled = true;
$('flight-state').textContent = 'Loading the ship…';
let model;
try {
  model = await loadCaravanPrototype();
  scene.add(model.root);
} catch (error) {
  $('flight-state').textContent = 'The ship could not load. Reload to try again.';
  window.caravanReview = { ready: false, error: String(error.message ?? error) };
  throw error;
}
// A clearly separate scale figure, exactly 1.75 m from soles to crown.
const human=new THREE.Group();human.name='scale-person';human.position.set(-5,0,15);
const mat=makeMaterial({color:'#776b82'});
function body(geo,pos,material=mat){const m=new THREE.Mesh(geo,material);m.position.set(...pos);m.castShadow=true;human.add(m);return m;}
body(new THREE.CylinderGeometry(.17,.28,1.05,8),[0,.8,0]);body(new THREE.SphereGeometry(.13,12,8),[0,1.62,0],makeMaterial({color:'#b6977e'}));for(const x of [-.11,.11])body(new THREE.CapsuleGeometry(.07,.4,4,8),[x,.27,0]);body(new THREE.SphereGeometry(.19,12,8),[0,1.15,-.19],makeMaterial({color:'#78a49a'}));scene.add(human);
// Sparse ground marks give distance without importing a production world.
const rockMat=makeMaterial({color:'#c6a69a'});for(let i=0;i<46;i++){const a=i*2.399,r=23+(i%9)*3;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.1+(i%4)*.08,0),rockMat);rock.position.set(Math.cos(a)*r,.08,Math.sin(a)*r);rock.scale.y=.45;rock.castShadow=true;scene.add(rock);}
const pipeline=createCaravanInkRenderer({canvas,scene,camera,subject:human}), renderer=pipeline.renderer;
let currentView='reference';
const positions={reference:[-25,12,85],orbit:[-35,18,54],front:[-63,15,0],side:[0,16,64],rear:[61,19,13]};
function setView(name){currentView=name;camera.position.set(...positions[name]);camera.fov=name==='reference'?25:37;camera.updateProjectionMatrix();controls.target.set(...(name==='reference'?[0,8,0]:[0,7,1]));controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
$('arrive').onclick=()=>model.deployment.arrive();$('depart').onclick=()=>model.deployment.depart();$('human').onchange=()=>human.visible=$('human').checked;$('rotate').onchange=()=>controls.autoRotate=$('rotate').checked;controls.autoRotateSpeed=.65;
const showRef=()=>$('reference-dialog').showModal();$('reference').onclick=showRef;$('reference').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showRef();}};$('close-reference').onclick=()=>$('reference-dialog').close();
function resize(){const {width,height}=canvas.getBoundingClientRect();pipeline.resize(width,height);camera.aspect=width/height;camera.fov=2*Math.atan(Math.tan((currentView==='reference'?25:37)*Math.PI/360)*Math.max(1,1.2/camera.aspect))*180/Math.PI;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(canvas);resize();setView(new URLSearchParams(location.search).get('view') in positions?new URLSearchParams(location.search).get('view'):'reference');
let last=performance.now();
const flightLabels={landed:'Landed · porch open',departing:'Stowing the camp…','taking-off':'Camp secured · lifting off',flight:'In flight · camp secured',arriving:'Arriving · camp secured',deploying:'Landed · opening the camp…'};
renderer.setAnimationLoop((now)=>{model.deployment.update(Math.min(.05,Math.max(0,(now-last)/1000)));last=now;const phase=model.deployment.phase;$('flight-state').textContent=flightLabels[phase];$('arrive').disabled=phase!=='flight';$('depart').disabled=!['landed','deploying'].includes(phase);controls.update();pipeline.render();});
window.caravanReview={ready:true,pipeline,model,camera,renderer,scene,setView,human,dimensions:CARAVAN};
