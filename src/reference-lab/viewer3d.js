// The reference lab's 3D viewer (docs/systems/reference-lab.md, "3D mode"): each Tripo candidate's GLB (or FBX,
// when quad) in a small three.js stage, orbited with the mouse, turning on a turntable, with wireframe, clay
// (no texture) and, for a rigged one, its preview walk. Loaded by the page only when a 3D batch is shown.
//
// Browsers give a page about 16 WebGL contexts: a viewer is made when its card scrolls into view and dropped when
// it leaves, at most MAX live at once (the others show Tripo's still). The page redraws its batches while one
// runs: a live viewer moves into its card's new element instead of loading again.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MAX = 8;
const PAPER = 0xf7ecd2, CLAY = 0xd8c9a8;
const live = new Map();   // model url → Viewer
let observer = null;

/** A model file loaded: { object, clips }. */
async function load(url, format) {
  if (format === 'fbx') { const o = await new FBXLoader().loadAsync(url); return { object: o, clips: o.animations ?? [] }; }
  const g = await new GLTFLoader().loadAsync(url);
  return { object: g.scene, clips: g.animations ?? [] };
}

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x6d5f57, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
}

/** The object centred on the ground and scaled to a unit size; the camera placed to see it whole. */
function frame(object, camera, controls) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const s = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
  object.scale.multiplyScalar(s);
  object.position.sub(centre.multiplyScalar(s));
  camera.position.set(2.05, 1.2, 2.6);   // (far enough that a T-pose turning keeps its hands in frame)
  camera.lookAt(0, 0, 0);
  if (controls) { controls.target.set(0, 0, 0); controls.update(); }
}

function disposeObject(o) {
  o?.traverse?.((n) => {
    n.geometry?.dispose?.();
    for (const m of [].concat(n.material ?? [])) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose?.(); }
  });
}

class Viewer {
  constructor(el) {
    this.el = el;
    this.url = el.dataset.model; this.format = el.dataset.format; this.anim = el.dataset.anim ?? null;
    this.state = { spin: true, wire: false, clay: false, walk: false };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'live';
    this.scene = new THREE.Scene();
    lights(this.scene);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.autoRotate = true; this.controls.autoRotateSpeed = 2.4;
    this.timer = new THREE.Timer();
    el.appendChild(this.canvas);
    el.classList.add('loading');
    this.show(this.url, this.format).catch((e) => { el.classList.add('failed'); el.title = `could not load: ${e.message}`; });
  }

  async show(url, format) {
    const { object, clips } = await load(url, format);
    if (this.dead) { disposeObject(object); return; }
    if (this.object) { this.scene.remove(this.object); disposeObject(this.object); }
    this.object = object; this.originals = new Map();
    frame(object, this.camera, this.controls);
    this.scene.add(object);
    this.mixer = null;
    if (clips.length) { this.mixer = new THREE.AnimationMixer(object); this.mixer.clipAction(clips[0]).play(); }
    this.apply();
    this.el.classList.remove('loading');
    this.el.classList.add('ready');
  }

  /** wireframe and clay on every mesh, as the state says. */
  apply() {
    this.controls.autoRotate = this.state.spin;
    this.object?.traverse((n) => {
      if (!n.isMesh) return;
      if (!this.originals.has(n)) this.originals.set(n, n.material);
      if (this.state.clay) n.material = this.clayMat ??= new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.85 });
      else n.material = this.originals.get(n);
      for (const m of [].concat(n.material)) m.wireframe = this.state.wire;
    });
    const fig = this.el.closest('figure');
    if (fig) for (const [act, key] of [['spin', 'spin'], ['wire', 'wire'], ['tex', 'clay'], ['anim', 'walk']]) fig.querySelector(`[data-view-act="${act}"]`)?.classList.toggle('on', !!this.state[key]);
  }

  async act(name) {
    if (name === 'spin') this.state.spin = !this.state.spin;
    else if (name === 'wire') this.state.wire = !this.state.wire;
    else if (name === 'tex') this.state.clay = !this.state.clay;
    else if (name === 'anim' && this.anim) {
      this.state.walk = !this.state.walk;
      this.el.classList.add('loading');
      await this.show(this.state.walk ? this.anim : this.url, this.state.walk ? 'glb' : this.format);
    }
    this.apply();
  }

  /** The page redrew: into the card's new element. */
  move(el) {
    this.el = el;
    el.appendChild(this.canvas);
    el.classList.add(this.object ? 'ready' : 'loading');
    this.apply();
  }

  render() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio()) || this.canvas.height !== Math.round(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    this.timer.update();
    const dt = this.timer.getDelta();
    this.mixer?.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.dead = true;
    this.controls.dispose();
    disposeObject(this.object);
    this.clayMat?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.el.classList.remove('ready', 'loading');
  }
}

let looping = false;
function loop() {
  looping = live.size > 0;
  if (!looping) return;
  for (const v of live.values()) v.render();
  requestAnimationFrame(loop);
}

function observe(entries) {
  for (const e of entries) {
    const el = e.target, url = el.dataset.model;
    const v = live.get(url);
    if (e.isIntersecting && !v && live.size < MAX) live.set(url, new Viewer(el));
    else if (!e.isIntersecting && v && v.el === el) { v.dispose(); live.delete(url); }
  }
  if (!looping && live.size) loop();
}

/**
 * Every `.viewer[data-model]` under `root` watched: a live viewer while it is on screen. Viewers whose card is
 * gone are dropped; one whose card was redrawn moves into it.
 */
export function mountViewers(root = document) {
  observer ??= new IntersectionObserver(observe, { rootMargin: '200px' });
  observer.disconnect();
  const els = [...root.querySelectorAll('.viewer[data-model]')];
  const urls = new Set(els.map((el) => el.dataset.model));
  for (const [url, v] of live) if (!urls.has(url)) { v.dispose(); live.delete(url); }
  for (const el of els) {
    const v = live.get(el.dataset.model);
    if (v && v.el !== el) v.move(el);
    observer.observe(el);
  }
}

/** A button under a card's viewer pressed (spin, wire, tex, anim). */
export function viewerAct(figure, name) {
  const v = live.get(figure.querySelector('.viewer')?.dataset.model);
  if (v) v.act(name);
}

/**
 * A turntable sheet of a model: `frames` views around it on the lab's paper, `cols` a row, as a WebP data URL
 * (the pick's preview: model-N-preview.webp beside the GLB).
 */
export async function turntable(url, format = 'glb', { size = 320, frames = 8, cols = 4 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(PAPER, 1);
    const scene = new THREE.Scene();
    lights(scene);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const { object } = await load(url, format);
    frame(object, camera, null);
    const pivot = new THREE.Group();
    pivot.add(object);
    scene.add(pivot);
    const rows = Math.ceil(frames / cols);
    const out = document.createElement('canvas');
    out.width = size * cols; out.height = size * rows;
    const g = out.getContext('2d');
    for (let i = 0; i < frames; i++) {
      pivot.rotation.y = (i / frames) * Math.PI * 2;
      renderer.render(scene, camera);
      g.drawImage(renderer.domElement, (i % cols) * size, Math.floor(i / cols) * size);
    }
    disposeObject(object);
    return out.toDataURL('image/webp', 0.86);
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
