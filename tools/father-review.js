import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HoloFigure, HOLO } from '../src/ship/hologram.js';
import { loadAnimationLibrary } from '../src/animator.js';
import { resetFatherGaze } from '../src/characters/father-v1.js';
const $ = id => document.getElementById(id);
try {
  const original=new URLSearchParams(location.search).get('asset')==='full';
  $('asset').value=original?'full':'runtime';
  $('asset').onchange=()=>{location.search=$('asset').value==='full'?'?asset=full':'';};
  const [gltf,lib] = await Promise.all([new GLTFLoader().loadAsync(original?'/output/character-tripo/father-v1/full-before.glb':'/characters/father-v1/model.glb'),loadAnimationLibrary('/anim/ual.glb')]);
  const scene = new T.Scene(); scene.background = new T.Color('#eee9de');
  const figure=new HoloFigure('father',{lib,humans:[],fatherAsset:gltf});
  const root=figure.object;scene.add(root);
  figure.u.uAlpha.value=1;figure.u.uSpan.value.set(-1,3);figure.u.uCut.value.set(-2,-1);
  const emptyDepth=new T.DataTexture(new Float32Array(4),1,1,T.RGBAFormat,T.FloatType);emptyDepth.needsUpdate=true;
  HOLO.uniforms.tNormal.value=emptyDepth;
  const meshes = [], variants = new Map();
  root.traverse(o => {
    if (!o.isMesh || !o.userData.father) return;
    const map = o.material.uniforms.uMap.value;
    variants.set(o, {
      unlit: new T.MeshBasicMaterial({map}),
      matte: new T.MeshStandardMaterial({map, roughness:1, metalness:0}),
      clay: new T.MeshStandardMaterial({color:'#b9ac96',roughness:1}),
      hologram:o.material
    }); meshes.push(o);
  });
  scene.add(new T.AmbientLight(0xffffff,.6));
  const sun = new T.DirectionalLight(0xffffff,2.5); scene.add(sun);
  const renderer = new T.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const camera = new T.PerspectiveCamera(35,1,.01,100), controls = new OrbitControls(camera,renderer.domElement);
  function frameView() {
    const angle = {front:0,quarter:.65,side:Math.PI/2,back:Math.PI}[$('angle').value];
    const focus=$('focus').value;
    const target=focus==='elbow'?figure.humanoid.b.lowerarm_l.getWorldPosition(new T.Vector3()):focus==='hand'?figure.humanoid.b.hand_l.getWorldPosition(new T.Vector3()):focus==='face'?figure.humanoid.b.Head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.04,0)):new T.Vector3(0,focus==='bust'?1.45:.95,0);
    const dist=focus==='face'?1.1:focus==='hand'?.60:focus==='elbow'?.85:focus==='bust'?2.0:4.2;
    controls.target.copy(target);camera.position.set(target.x+Math.sin(angle)*dist,target.y+.02,target.z+Math.cos(angle)*dist);controls.update();
  }
  $('angle').onchange = frameView;$('focus').onchange=frameView;frameView();
  $('gaze').onchange=()=>{figure.glance.t=0;figure.glance.until=0;};
  let paused=false; $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';};
  const guides=new T.Group();scene.add(guides);
  for(const y of [1.58,1.60,1.62,1.64,1.66,1.68,1.70,1.72]){const label=document.createElement('div');label.style.cssText='position:fixed;color:#c22;background:#fff9;font:12px monospace;pointer-events:none';label.textContent=y.toFixed(2);document.body.append(label);const g=new T.BufferGeometry().setFromPoints([new T.Vector3(-.11,y,.20),new T.Vector3(.11,y,.20)]);guides.add(new T.Line(g,new T.LineBasicMaterial({color:0xff2222,transparent:true,opacity:.5,depthTest:false})));guides.children.at(-1).userData.label=label;}
  let last=0,frames=[],updates=[];
  const tris=gltf.scene.getObjectsByProperty('isSkinnedMesh',true).reduce((n,o)=>n+o.geometry.index.count/3,0);
  function frame(time) {
    const dt=paused?0:Math.min((time-last)/1000,.04);last=time;
    const updateStart=performance.now();
    if($('motion').value==='rest') {resetFatherGaze(figure.humanoid.body);figure.humanoid.body.skeleton.pose();figure.humanoid.body.morphTargetInfluences.fill(0);}
    else {
      if($('gaze').value!=='auto'){
        const yaw={center:0,left:.6,right:-.6}[$('gaze').value];
        Object.assign(figure.glance,{t:100,until:100,target:'aside',yaw,pitch:0});
        // A paused comparison must change only gaze, without advancing the clip.
        if(paused)Object.assign(figure.look,{yaw,pitch:0});
      }
      figure.update(dt,{talking:$('motion').value==='talk'});
    }
    if($('hands').value!=='auto')figure.humanoid.hands.set($('hands').value);
    if($('mouth').value!=='auto'){const k=$('mouth').value==='open'?1:0;figure.humanoid.body.morphTargetInfluences[1]=k;figure.u.uTalk.value=k;}
    root.updateMatrixWorld(true);
    updates.push(performance.now()-updateStart);if(updates.length>180)updates.shift();
    const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    HOLO.uniforms.uRes.value.set(renderer.domElement.width,renderer.domElement.height);HOLO.uniforms.uTime.value=time/1000;
    sun.position.set($('light').value==='left'?-3:3,2,2);
    for (const mesh of meshes) mesh.material=variants.get(mesh)[$('finish').value];
    guides.visible=$('landmarks').checked;for(const o of guides.children){const a=o.geometry.attributes.position,v=new T.Vector3(a.getX(1),a.getY(1),a.getZ(1)).project(camera),label=o.userData.label;label.style.display=guides.visible?'block':'none';label.style.left=`${(v.x+1)*w/2}px`;label.style.top=`${renderer.domElement.getBoundingClientRect().top+(1-v.y)*h/2}px`;}
    const start=performance.now();renderer.render(scene,camera);frames.push(performance.now()-start);if(frames.length>180)frames.shift();
    if(frames.length%30===0){const sorted=[...frames].sort((a,b)=>a-b),u=[...updates].sort((a,b)=>a-b);$('status').textContent=`${original?'Full working rig':'Optimized recording bust'} · ${tris.toLocaleString()} triangles · ${renderer.info.render.calls} draw call(s) · animation ${u[Math.floor(u.length*.5)].toFixed(2)} ms + render submission ${sorted[Math.floor(sorted.length*.5)].toFixed(2)} ms (CPU medians, not GPU frame time)`;}
    requestAnimationFrame(frame);
  }
  $('status').textContent='Loading review…';
  requestAnimationFrame(frame);
} catch(e) { $('status').textContent=e.message;console.error(e); }
