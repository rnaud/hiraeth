import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createReviewInk } from './tripo-render.js';

const $ = id => document.getElementById(id);
const studyV3 = document.body.dataset.study === 'head-v3';
const source = studyV3 ? '/data/characters/traveller-v1/head-v3' : '/data/characters/traveller-v1/head-v2';
try {
  const gltf = await new GLTFLoader().loadAsync(`${source}/model.glb`);
  const scene = new T.Scene(); scene.background = new T.Color('#eee9de');
  const root = gltf.scene, box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3());
  const centre = box.getCenter(new T.Vector3()), scale = 0.34 / size.y;
  root.scale.multiplyScalar(scale); root.position.sub(centre.multiplyScalar(scale)); root.position.y += 1.65;
  scene.add(root);
  const meshes = [], matte = new Map(), unlit = new Map(), clay = new T.MeshStandardMaterial({color:'#b9ac96',roughness:1});
  let triangles = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) throw new Error('Review expects one material per primitive');
    o.material = o.material.clone(); o.material.roughness = 1; o.material.metalness = 0;
    o.material.normalMap = null; o.material.roughnessMap = null; o.material.metalnessMap = null; o.material.aoMap = null;
    unlit.set(o, new T.MeshBasicMaterial({map:o.material.map,color:o.material.color,vertexColors:o.material.vertexColors,side:o.material.side}));
    matte.set(o, o.material); meshes.push(o); triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  scene.add(new T.HemisphereLight(0xffffff,0x87818a,studyV3 ? .4 : 2));
  const sun = new T.DirectionalLight(0xffffff,2.2); sun.position.set(2,4,3); scene.add(sun);
  const renderer = new T.WebGLRenderer({canvas:$('view'),antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const halfHeight = .2175, targetY = studyV3 ? 1.632 : 1.65;
  const camera = studyV3 ? new T.OrthographicCamera(-halfHeight,halfHeight,halfHeight,-halfHeight,.005,100) : new T.PerspectiveCamera(33,1,.005,100);
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping = true; controls.minDistance = .2; controls.maxDistance = 3;
  function frameView() {
    const angle = {front:0,quarter:.65,side:Math.PI/2,left:Math.PI/2,right:-Math.PI/2,back:Math.PI}[$('angle').value];
    controls.target.set(0,targetY,0); camera.position.set(Math.sin(angle)*.85,targetY,Math.cos(angle)*.85); camera.zoom = 1; camera.updateProjectionMatrix(); controls.update();
    if (studyV3) {
      const ref = ['left','right','back'].includes($('angle').value) ? $('angle').value : 'front';
      $('reference').src = `${source}/reference/${ref}.png`;
      $('reference-label').textContent = ref === 'front' ? 'Original portrait · cropped, unchanged face' : `Selected turnaround · ${ref}`;
    }
  }
  $('angle').onchange = frameView; $('reset').onclick = frameView; frameView();
  const dummy = new T.Object3D(); dummy.visible = false;
  const ink = createReviewInk(renderer,scene,meshes,{grid:dummy,helper:dummy});
  function frame(time) {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    if (renderer.domElement.width !== Math.round(w*renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h*renderer.getPixelRatio())) renderer.setSize(w,h,false);
    if (camera.isOrthographicCamera) { camera.left = -halfHeight*w/h; camera.right = halfHeight*w/h; } else camera.aspect = w/h;
    camera.updateProjectionMatrix(); controls.update();
    if (studyV3) sun.position.x = $('light').value === 'left' ? -3 : 3;
    for (const mesh of meshes) mesh.material = $('finish').value === 'clay' ? clay : $('finish').value === 'unlit' ? unlit.get(mesh) : matte.get(mesh);
    if ($('finish').value === 'ink') ink.render(camera,time/1000); else renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  window.headReview = {scene,root,meshes,camera,controls,renderer,sourceBounds:box};
  $('status').textContent = `${Math.round(triangles).toLocaleString()} triangles · Tripo H3.1 · 50 credits · original export preserved`;
  requestAnimationFrame(frame);
} catch (e) { $('status').textContent = e.message; console.error(e); }
