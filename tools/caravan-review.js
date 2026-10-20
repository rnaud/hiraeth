import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCaravanPrototype, CARAVAN } from '../src/ship/caravan-prototype.js';
// A silent review scene: it never constructs the game or an audio system, and reads no save/preferences.
const $=id=>document.getElementById(id),canvas=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color('#b9d4cf');scene.fog=new THREE.Fog('#b9d4cf',130,250);
const camera=new THREE.PerspectiveCamera(37,1,.1,400),controls=new OrbitControls(camera,canvas);controls.target.set(0,7,1);controls.enableDamping=true;controls.minDistance=18;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight('#fff7e5','#b7a3a6',2.0));const sun=new THREE.DirectionalLight('#fff3d8',1.7);sun.position.set(-30,55,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:35,bottom:-35,near:1,far:130});sun.shadow.bias=-.0002;sun.shadow.normalBias=.03;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:'#e1bca4',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const model=createCaravanPrototype();scene.add(model.root);
// A clearly separate scale figure, exactly 1.75 m from soles to crown.
const human=new THREE.Group();human.name='scale-person';human.position.set(-5,0,15);
const mat=new THREE.MeshStandardMaterial({color:'#776b82',roughness:1});
function body(geo,pos,material=mat){const m=new THREE.Mesh(geo,material);m.position.set(...pos);m.castShadow=true;human.add(m);return m;}
body(new THREE.CylinderGeometry(.17,.28,1.05,8),[0,.8,0]);body(new THREE.SphereGeometry(.13,12,8),[0,1.62,0],new THREE.MeshStandardMaterial({color:'#b6977e'}));for(const x of [-.11,.11])body(new THREE.CapsuleGeometry(.07,.4,4,8),[x,.27,0]);body(new THREE.SphereGeometry(.19,12,8),[0,1.15,-.19],new THREE.MeshStandardMaterial({color:'#78a49a'}));scene.add(human);
// Sparse ground marks give distance without importing a production world.
const rockMat=new THREE.MeshStandardMaterial({color:'#c6a69a',roughness:1});for(let i=0;i<46;i++){const a=i*2.399,r=23+(i%9)*3;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.1+(i%4)*.08,0),rockMat);rock.position.set(Math.cos(a)*r,.08,Math.sin(a)*r);rock.scale.y=.45;rock.castShadow=true;scene.add(rock);}
const positions={orbit:[-35,18,54],front:[-63,15,0],side:[0,16,64],rear:[61,19,13]};
function setView(name){camera.position.set(...positions[name]);controls.target.set(0,7,1);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
$('camp').onchange=()=>{for(const name of ['porch','awning','plants'])model.parts[name].visible=$('camp').checked;};$('human').onchange=()=>human.visible=$('human').checked;$('rotate').onchange=()=>controls.autoRotate=$('rotate').checked;controls.autoRotateSpeed=.65;
const showRef=()=>$('reference-dialog').showModal();$('reference').onclick=showRef;$('reference').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showRef();}};$('close-reference').onclick=()=>$('reference-dialog').close();
function resize(){const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=2*Math.atan(Math.tan(37*Math.PI/360)*Math.max(1,1.2/camera.aspect))*180/Math.PI;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(canvas);resize();setView(new URLSearchParams(location.search).get('view') in positions?new URLSearchParams(location.search).get('view'):'orbit');
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
window.caravanReview={ready:true,model,camera,renderer,scene,setView,human,dimensions:CARAVAN};
