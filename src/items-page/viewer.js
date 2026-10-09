import * as THREE from 'three';
import { sharedUniforms, makeMaterial } from '../materials.js';
import { createPost, PRESETS } from '../post.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from '../pipeline.js';
import { Cascade, shadowDirection } from '../shadows.js';
import { applyTimeOfDay } from '../timeofday.js';
import { buildItemModel, fluidMaterials } from '../boxes/model.js';

// The items in 3D (items.html, src/items-page/main.js): each item's own model (the one that hovers out of its
// box, src/boxes/model.js) drawn by the game's own pipeline (the G-buffer materials, a shadow map, the ink
// pass of post.js, FXAA), as the character studio draws its people (src/studio/main.js), on the slots' paper.
// One renderer for the whole page: a card's picture is drawn into the card's own canvas (and again only while
// it is turned); the full-screen view draws live.
//
//   const v = new ItemViewer()
//   v.drawInto(canvas, id, orbit)         a card: one picture of the item at { yaw, pitch, zoom }
//   v.show(host, id) / v.hide()           the full-screen view, live in `host`
//   v.orbit                               its { yaw, pitch, zoom }; v.spin: turning on its own

export const PAPER = '#f3e7cc';
export const VIEW = { fov: 28, margin: 1.2, fullZoom: 1.7, pitch: 0.38, yaw: 0.6, minPitch: -1.2, maxPitch: 1.35, minZoom: 0.35, maxZoom: 3 };
const UP = new THREE.Vector3(0, 1, 0);

THREE.ColorManagement.enabled = false;   // (as in the game: colours authored as display values)

export class ItemViewer {
  constructor() {
    const R = (this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    R.autoClear = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.01, 200);
    this.gbuffer = createGBuffer();
    this.post = createPost();
    const U = (this.U = this.post.uniforms), SU = sharedUniforms;
    U.tAlbedo.value = this.gbuffer.textures[0]; U.tNormal.value = this.gbuffer.textures[1]; U.tHatch.value = this.gbuffer.textures[2];
    this.composeRT = createComposeTarget();
    this.blit = createBlit(this.composeRT.texture);
    // one fine shadow map round the item, as the game's fine cascade; the near and far ones made and switched
    // off (the materials sample all three as depth maps: one left unbound is an invalid draw)
    this.cascade = new Cascade({ name: 'fine', size: 1024, extent: 3, depth: 60, bias: 3.4, offset: 2.6, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0, texel: [SU.uShadowTexel, 0] } });
    const near = new Cascade({ name: 'near', size: 256, extent: 20, depth: 60, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset, texel: [SU.uShadowTexel, 1] } });
    const far = new Cascade({ name: 'far', size: 256, extent: 40, depth: 60, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2, texel: [SU.uShadowTexel, 2] } });
    for (const c of [this.cascade, near, far]) c.prime(R);
    near.disable(); far.disable();   // (each cascade keeps uShadowTexel in step with its map: reconfigure freely)
    for (const [k, v] of Object.entries(PRESETS['Moebius print'])) if (U[k]) U[k].value = v;
    applyTimeOfDay(10.5, SU.uSunDir.value, U, null);
    SU.uCloudShadows.value = 0;
    this.shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
    // the paper all round, and a floor of it under the item for its shadow
    const paper = makeMaterial({ color: PAPER, flat: true, hatch: 0, line: 0.25, key: 'items-paper', side: THREE.BackSide });
    this.backdrop = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12), paper);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(50, 64).rotateX(-Math.PI / 2), makeMaterial({ color: PAPER, flat: true, hatch: 0, key: 'items-floor' }));
    this.scene.add(this.backdrop, this.floor);
    this.models = new Map();
    this.orbit = { yaw: VIEW.yaw, pitch: VIEW.pitch, zoom: 1 };
    this.spin = true; this.time = 0; this.live = null; this.size = [0, 0];
  }

  /** The item's model, centred on the origin, sitting on the floor; its radius for framing. */
  model(id) {
    if (this.models.has(id)) return this.models.get(id);
    const g = buildItemModel(id), box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    g.position.sub(c);
    holder.add(g);
    const r = Math.max(0.05, box.getBoundingSphere(new THREE.Sphere()).radius);
    const m = { holder, r, lift: box.max.y - c.y, fluids: fluidMaterials(g), height: box.max.y - box.min.y };
    this.models.set(id, m);
    return m;
  }

  setSize(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (this.size[0] === w && this.size[1] === h) return;
    this.size = [w, h];
    const R = this.renderer, U = this.U, SU = sharedUniforms;
    R.setPixelRatio(1); R.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.gbuffer.setSize(w, h); this.composeRT.setSize(w, h);
    this.blit.material.uniforms.resolution.value.set(1 / w, 1 / h);
    U.uRes.value.set(w, h); U.uPixelRatio.value = 1; SU.uPixelRatio.value = 1;
  }

  /** Draw item `id` at `orbit` (the camera round it), to the renderer's canvas. */
  render(id, orbit = this.orbit) {
    const m = this.model(id), S = this.scene;
    for (const x of this.models.values()) if (x.holder.parent && x !== m) S.remove(x.holder);
    if (!m.holder.parent) S.add(m.holder);
    m.holder.position.set(0, m.height / 2 + 0.02, 0);
    this.floor.position.y = 0;
    // (a flask's fluid stands full and churns, in its two first tones, as it hovers out of its box)
    for (const f of m.fluids) if (f.uniforms.uFluidA) { const A = f.uniforms.uFluidA.value; A.x = 1; A.y = Math.max(A.y, 2); A.z = this.time; }
    const centre = m.holder.position, d = (m.r * VIEW.margin * orbit.zoom) / Math.sin(THREE.MathUtils.degToRad(VIEW.fov / 2));
    const C = this.camera, cp = Math.cos(orbit.pitch);
    C.position.set(centre.x + Math.sin(orbit.yaw) * cp * d, centre.y + Math.sin(orbit.pitch) * d, centre.z + Math.cos(orbit.yaw) * cp * d);
    C.lookAt(centre); C.updateMatrixWorld();
    S.updateMatrixWorld();
    const R = this.renderer, U = this.U, SU = sharedUniforms;
    SU.uTime.value = U.uTime.value = this.time;
    // 1. the shadow round the item
    this.backdrop.visible = false;
    S.overrideMaterial = this.shadowOverride;
    // (centred on the subject's own foot where a viewer says where that is: EnemyViewer, whose frame also holds
    // the attack's marked area)
    this.cascade.aim(shadowDirection(SU.uSunDir.value, new THREE.Vector3())); this.cascade.place(this.shadowCentre?.(m) ?? centre); this.cascade.render(R, S);
    S.overrideMaterial = null;
    this.backdrop.visible = true;
    // 2. the G-buffer, 3. the ink pass, 4. FXAA to the canvas
    R.setRenderTarget(this.gbuffer); R.setClearColor(0x000000, 0); R.clear(); R.render(S, C);
    U.uInvProj.value.copy(C.projectionMatrixInverse); U.uCamWorld.value.copy(C.matrixWorld); U.uProj11.value = C.projectionMatrix.elements[5];
    setSubject(U, C, centre, UP, true);
    R.setRenderTarget(this.composeRT); R.clear(); R.render(this.post.scene, this.post.camera);
    R.setRenderTarget(null); R.render(this.blit.scene, this.post.camera);
  }

  /** A card: one picture of the item, drawn into `canvas` (its own size, at the device's pixel ratio up to 2). */
  drawInto(canvas, id, orbit) {
    if (this.live) return false;   // (the full-screen view has the renderer)
    const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    this.setSize(w, h);
    this.render(id, orbit);
    canvas.getContext('2d').drawImage(this.renderer.domElement, 0, 0, w, h);
    return true;
  }

  /** The full-screen view: live in `host` (the renderer's own canvas fills it), turning on its own until touched. */
  show(host, id) {
    this.live = { host, id };
    this.orbit = { yaw: VIEW.yaw, pitch: VIEW.pitch, zoom: VIEW.fullZoom };
    this.spin = true;
    host.prepend(this.renderer.domElement);
    const loop = (t) => {
      if (!this.live) return;
      const dt = Math.min((t - (this._last ?? t)) / 1000, 0.05); this._last = t;
      this.time += dt;
      if (this.spin) this.orbit.yaw += dt * 0.5;
      const dpr = Math.min(devicePixelRatio || 1, 2), c = this.renderer.domElement;   // (its canvas's own size: beside the words when they are open)
      this.setSize((c.clientWidth || host.clientWidth) * dpr, (c.clientHeight || host.clientHeight) * dpr);
      this.render(this.live.id, this.orbit);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  hide() { this.live = null; cancelAnimationFrame(this._raf); this._last = undefined; this.renderer.domElement.remove(); }
}

/** Turning by dragging: yaw and pitch from the pointer's travel, clamped (shared by the cards and the full view). */
export function dragOrbit(orbit, dx, dy) {
  orbit.yaw -= dx * 0.01;
  orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.008, VIEW.minPitch, VIEW.maxPitch);
  return orbit;
}
export const zoomOrbit = (orbit, k) => { orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * k, VIEW.minZoom, VIEW.maxZoom); return orbit; };
