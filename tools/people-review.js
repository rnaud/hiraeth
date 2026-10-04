// People review (/tools/people-review.html): a row of a world's people as full NPCs, and the same
// looks as GPU crowd figures behind them, to compare kinds, builds and heights at a glance.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadAnimationLibrary, Animator } from '../src/animator.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { COSTUME_WORLDS, crowdLook, dressFor, BUILDS } from '../src/costumes.js';
import { figureGeometry, packLook } from '../src/crowd.js';
import { CROWD_GLSL } from '../src/crowd-shader.js';
import { mulberry32 } from '../src/noise.js';

const $ = (id) => document.getElementById(id);
const load = (url, kind) => new GLTFLoader().loadAsync(url).then((g) => prepareHuman(g.scene, kind));
const [lib, hm, hf] = await Promise.all([loadAnimationLibrary('/anim/ual.glb'), load('/anim/human_m.glb', 'm'), load('/anim/human_f.glb', 'f')]);
const params = new URLSearchParams(location.search);
for (const w of COSTUME_WORLDS) $('world').append(new Option(w, w));
$('world').value = params.get('world') ?? 'bazaar';
$('seed').value = params.get('seed') ?? 1;
if (params.get('angle')) $('angle').value = params.get('angle');

const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#eee9de');
scene.add(new THREE.HemisphereLight('#ffffff', '#b8b0a0', 2.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(3, 6, 5); scene.add(sun);
scene.add(new THREE.GridHelper(30, 60, '#beb7a6', '#d5cebf'));
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const time = { value: 0 };
const crowdMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, side: THREE.DoubleSide, uniforms: { uTime: time },
  vertexShader: `${CROWD_GLSL}
    out vec3 vCol; out vec3 vN;
    void main() { vec3 p = position, n = normal, c; crowdAnimate(p, n, c); vCol = c; vN = normalize(mat3(modelViewMatrix * instanceMatrix) * n);
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0); }`,
  fragmentShader: `in vec3 vCol; in vec3 vN; out vec4 o; void main() { float l = 0.55 + 0.45 * max(dot(normalize(vN), normalize(vec3(0.4, 0.6, 0.7))), 0.0); o = vec4(vCol * l, 1.0); }`,
});
let group = null;
const N = 12;
function build() {
  if (group) scene.remove(group);
  group = new THREE.Group(); scene.add(group);
  const world = $('world').value, rng = mulberry32(+$('seed').value * 7919 + 13), krng = mulberry32(+$('seed').value);
  const looks = [];
  // ?builds=1: every build for a man and for a woman, all of one height
  const builds = params.get('builds') ? ['m', 'f'].flatMap((kind) => Object.keys(BUILDS).map((build) => ({ kind, build }))) : null;
  for (let i = 0; i < N; i++) {
    const b = builds?.[i];
    if (builds && !b) break;
    const kind = b?.kind ?? (krng() < 0.5 ? 'm' : 'f');
    looks.push(b ? dressFor(world, rng, { kind, look: { build: b.build, height: 1, robe: 0, body: 'none', prop: 'none' } }) : crowdLook(rng, { world, kind }));
  }
  const people = [];
  // the GPU figures, a row behind
  const geo = figureGeometry('mid', world);
  for (const k of ['aAnim', 'aReact', 'aLook0', 'aLook1', 'aDress', 'aBody']) geo.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4));
  const inst = new THREE.InstancedMesh(geo, crowdMat, N); inst.frustumCulled = false; group.add(inst);
  const n = looks.length;
  looks.forEach((s, i) => {
    const x = (i - (n - 1) / 2) * (builds ? 1.3 : 1.0), size = (builds ? 1 : s.size) * s.height;
    // the full NPC
    const char = buildCharacter({ cloak: s.cloak, cloth: s.cloth, legs: s.legs });
    char.root.position.set(x, 0, 0); char.root.scale.setScalar(size); group.add(char.root);
    const h = new Humanoid(s.kind === 'f' ? hf : hm, char, s.kind, { skin: s.skin, build: s.build });
    h.dress(s);
    h.model.traverse((o) => {
      if (!o.isMesh) return;
      const u = o.material.uniforms;
      o.material = new THREE.MeshLambertMaterial({ color: o.material.vertexColors ? '#ffffff' : u?.uColor?.value ?? '#888', vertexColors: !!o.material.vertexColors, side: THREE.DoubleSide });
      if (o === h.body) o.material.color.set(s.cloth);
    });
    // no cape here (the game's is cloth), nor its collar or a satchel
    char.pack.visible = false;
    char.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.parent === char.capeAnchor) o.visible = false; });
    const a = new Animator(lib, char);
    people.push({ char, h, a, s });
    // the crowd figure
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, -2.2), new THREE.Quaternion(), new THREE.Vector3().setScalar(size * (s.kind === 'm' ? 1.03 : 1)));
    inst.setMatrixAt(i, m);
    const L = packLook(s);
    geo.attributes.aAnim.array.set([i / N, 0, (i * 0.37) % 1, 0], i * 4);
    geo.attributes.aLook0.array.set(L[0], i * 4); geo.attributes.aLook1.array.set(L[1], i * 4); geo.attributes.aDress.array.set(L[2], i * 4); geo.attributes.aBody.array.set(L[3], i * 4);
  });
  for (const k of Object.keys(geo.attributes)) geo.attributes[k].needsUpdate = true;
  inst.instanceMatrix.needsUpdate = true;
  inst.count = n;
  $('status').textContent = looks.map((s) => `${s.kind}·${s.build}·${(s.size * s.height).toFixed(2)}`).join('  ');
  window.review = { people, looks, inst };
  return people;
}
let people = build();
for (const id of ['world', 'seed']) $(id).onchange = () => { people = build(); };
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  time.value += dt;
  const walk = $('walk').checked;
  const A = window.review.inst.geometry.attributes.aAnim;
  for (let i = 0; i < N; i++) { A.array[i * 4 + 1] = walk ? 0.9 : 0; A.array[i * 4 + 3] = walk ? 1 : 0; }
  A.needsUpdate = true;
  for (const p of people) {
    p.a.update(dt, { speed: walk ? 1.3 : 0, onGround: true, mode: 'ground', walkAt: 1.2, jogAt: 3, sprintAt: 6, strideScale: 1 });
    p.a.apply(p.char.root, { legScale: 1.04 }); p.h.update(); p.h.poseHands(p.a);
  }
  const w = $('view').clientWidth, h = $('view').clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const near = params.get('builds') ? 0.85 : 1;
  const view = { front: [0, 1.3, 10.5 * near], side: [11, 1.3, -1], threequarter: [5.5 * near, 1.6, 8 * near] }[$('angle').value];
  camera.position.set(...view); camera.lookAt(0, 0.95, -1);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
