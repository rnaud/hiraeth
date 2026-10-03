import { attachPortraitPreview } from '../src/face.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadAnimationLibrary, Animator } from '../src/animator.js';
import { Humanoid } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
const $ = id => document.getElementById(id);
const [lib, gltf] = await Promise.all([loadAnimationLibrary('/anim/ual.glb'), new GLTFLoader().loadAsync('/anim/traveller.glb')]);
const char = buildCharacter(), humanoid = new Humanoid(gltf.scene, char, 'm', { imported: true }), animator = new Animator(lib, char);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#eee9de'); scene.add(char.root);
humanoid.model.traverse(o => {
  if (!o.isMesh) return;
  const u = o.material.uniforms, glass = u.uGlass.value > 0;
  o.material = new THREE.MeshBasicMaterial({ color: u.uColor.value, map: u.uMap.value, transparent: glass, opacity: glass ? .12 : 1, depthWrite: !glass, side: THREE.DoubleSide });
  if (u.uPortrait?.value) attachPortraitPreview(o.material, humanoid.face.uniforms);
});
const grid = new THREE.GridHelper(5, 20, '#beb7a6', '#d5cebf');scene.add(grid);
const lines = new THREE.Group();scene.add(lines);
function segment(a, b, color) {
 const geometry = new THREE.BufferGeometry().setFromPoints([a,b]);
 const line = new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:false}));line.renderOrder=10;lines.add(line);
 for(const p of [a,b]) { const ball = new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),new THREE.MeshBasicMaterial({color,depthTest:false}));ball.position.copy(p);ball.renderOrder=11;lines.add(ball); }
}
function updateLines() {
 for(const o of [...lines.children]){o.geometry.dispose();o.material.dispose();lines.remove(o);}
 const B=humanoid.b, pos=n=>B[n].getWorldPosition(new THREE.Vector3());
 for(const s of ['r','l']) {
  for(const [a,b] of [['upperarm','lowerarm'],['lowerarm','hand'],['thigh','calf'],['calf','foot'],['foot','ball']])segment(pos(`${a}_${s}`),pos(`${b}_${s}`),s==='r'?'#007d98':'#de633f');
  const hand=B[`hand_${s}`],from=pos(`hand_${s}`),along=new THREE.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
  segment(from,from.clone().addScaledVector(along,.14),'#e0aa00');
 }
}
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const camera=new THREE.PerspectiveCamera(35,1,.01,100);
function sample(frame) {
 humanoid.face.update(0, { blink: Number($('blink').value), smile: Number($('smile').value) });
 const motion=$('motion').value;
 for(const [name,action] of Object.entries(animator.actions)){action.setEffectiveWeight(name===motion?1:0);action.time=frame/120*lib.clips[name].duration;}
 animator.mixer.update(0);animator.src.updateMatrixWorld(true);animator.apply(char.root);humanoid.update();humanoid.poseHands(animator);
 if(motion.startsWith('climb')) {
  const B=humanoid.b,point=n=>B[n].getWorldPosition(new THREE.Vector3());
  humanoid.reach({hands:['r','l'].map(s=>point(`hand_${s}`)),feet:['r','l'].map(s=>point(`foot_${s}`)),wallN:new THREE.Vector3(0,0,-1),up:new THREE.Vector3(0,1,0),wallContact:true});
 }
 updateLines();
 $('status').textContent=`${frame+1}/120 · ${(frame/120*100).toFixed(0)}%`;
}
function render() {
 const width=$('view').clientWidth,height=$('view').clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
 const positions={front:[0,1.15,4.5],side:[4.5,1.15,0],back:[0,1.15,-4.5],threequarter:[3,1.15,3]};
 const close=$('face').checked;camera.position.set(...positions[$('angle').value]);if(close){camera.position.multiplyScalar(.19);camera.position.y=1.84;}camera.lookAt(0,close?1.82:1.04,0);
 lines.visible=$('bones').checked;renderer.render(scene,camera);
}
function update(){sample(+$('phase').value);render();}
$('blink').oninput=$('smile').oninput=$('phase').oninput=$('motion').onchange=$('angle').onchange=$('bones').onchange=$('face').onchange=update;
$('prev').onclick=()=>{$('phase').value=(+$('phase').value+119)%120;update();};$('next').onclick=()=>{$('phase').value=(+$('phase').value+1)%120;update();};
let playing=false,last=0,elapsed=0;
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};
function loop(t){const dt=Math.min((t-last)/1000,.1);last=t;if(playing){elapsed=(elapsed+dt/lib.clips[$('motion').value].duration)%1;$('phase').value=Math.floor(elapsed*120);update();}requestAnimationFrame(loop);}requestAnimationFrame(loop);
$('capture').onclick=()=>{
 playing=false;$('play').textContent='Play';
 const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=900;const ctx=sheet.getContext('2d');ctx.fillStyle='#eee9de';ctx.fillRect(0,0,1800,900);
 renderer.setPixelRatio(1);renderer.setSize(300,410,false);camera.aspect=300/410;camera.updateProjectionMatrix();
 for(let i=0;i<12;i++){sample(i*10);lines.visible=$('bones').checked;renderer.render(scene,camera);const x=i%6*300,y=Math.floor(i/6)*450;ctx.drawImage(renderer.domElement,x,y+34);ctx.fillStyle='#242c38';ctx.font='18px sans-serif';ctx.fillText(`${$('motion').value} · ${Math.round(i/12*100)}%`,x+12,y+25);}
 const a=document.createElement('a');a.download=`traveller-${$('motion').value}-${$('angle').value}-frames.png`;a.href=sheet.toDataURL();const img=new Image();img.src=a.href;a.append(img);$('sheet').replaceChildren(a);renderer.setPixelRatio(Math.min(devicePixelRatio,2));update();
};
window.addEventListener('resize',render);update();

$('faceCapture').onclick=()=>{
 playing=false;$('play').textContent='Play';$('face').checked=true;$('bones').checked=false;
 // Restore the neutral pose so facial proportions can be compared across views.
 for(const o of [...char.arms,...char.elbows,...char.legs,...char.knees,...char.feet,char.torso,char.head,char.body])o.quaternion.identity();char.body.position.set(0,0,0);humanoid.update();
 const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=500;const ctx=sheet.getContext('2d');ctx.fillStyle='#eee9de';ctx.fillRect(0,0,1200,500);
 renderer.setPixelRatio(1);renderer.setSize(400,460,false);camera.aspect=400/460;camera.updateProjectionMatrix();lines.visible=false;
 for(const [i,[label,eye]] of [['Front',[0,1.83,.87]],['Three-quarter',[.56,1.83,.67]],['Profile',[.87,1.83,0]]].entries()){
  camera.position.set(...eye);camera.lookAt(0,1.81,0);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,i*400,40);ctx.fillStyle='#242c38';ctx.font='20px sans-serif';ctx.fillText(label,i*400+16,28);
 }
 const a=document.createElement('a');a.download='traveller-face-views.png';a.href=sheet.toDataURL();const img=new Image();img.src=a.href;a.append(img);$('sheet').replaceChildren(a);renderer.setPixelRatio(Math.min(devicePixelRatio,2));render();
};
