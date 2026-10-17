import * as THREE from 'three';
import { sceneList } from '../engine/scene-matrices.js';

// ---------------------------------------------------------------------------
// One walk of the scene a frame, not one per pass (issue #448).
//
// renderer.render(scene, camera) walks the whole scene (three's projectObject): each object's visible flag, its layers,
// its kind, and each mesh's frustum test (its bounding sphere carried into the world). A Handheld frame renders the
// world two or three times (a shadow cascade, the G-buffer, the hero map: ~5 400 objects walked each time, 4-5 ms of a
// 4x-throttled frame in the desert), and nearly all of it is the same work each time.
//
// Here each pass is drawn from the scene's flat list (engine/scene-matrices.js, made for the frame's matrices) instead:
// three is handed a stand-in for the scene (the scene itself as its prototype: its background, override material, fog
// and hooks are the scene's) whose children are what of the list could be drawn in this pass, in the walk's order.
// The list is run down without recursion and with what it reads off each object kept in arrays of one kind:
//
// - a container (a group, a bone, a plain object) is not handed over: a hidden one steps over its whole subtree, as the
//   walk does;
// - a mesh is handed over only if its layers meet the camera's, it is shown, and its world sphere (the one three tests:
//   its own, an instanced or skinned mesh's, or its geometry's; carried into the world once a frame, when first
//   reached) is not certainly outside the frustum (by a margin: three tests again what is handed over, so a mesh near a
//   plane is three's to judge, and the pass draws exactly what the walk drew). A mesh with children that draws nothing
//   itself (a mesh cut into tiles, its tiles its children: perf.js tileSceneSteps) is not handed over (three's draw of
//   it was an empty one) and its children are run down here;
// - anything else (lines, sprites, lights, an unculled mesh, one with a hook of its own or with children that draws
//   something, a group with a render order) is handed over whole, and three walks it as ever.
//
// What is read once a frame is what nothing changes between a frame's passes: the world matrices are the frame's (made
// before them, renderFrame), and a level of detail swapped in for a shadow pass has its source's bounds (lod.js).
// So three still does everything it did for what it draws (its frustum test, objects.update, the render list, the sort:
// the stand-in's children come in the walk's order, so the unsorted shadow passes draw in the same order too). Any
// frame whose list is stale (the scene edited since the matrices: sceneList() null) is drawn by the walk.
// tests/flat-pass.test.js: the same render list as the walk's, pass for pass, through hides, layers and moves.
// ---------------------------------------------------------------------------

const CONTAINER = 0, WHOLE = 1, MESH = 2, EMPTY = 3;   // (what each object of the list is to a pass)
const OWN_SPHERE = 1, PLAIN_TEST = 2, KIDS = 4, INSTANCED = 8;   // (a mesh's kind, as the list was made)
const MARGIN = 1e-3;   // (m, and as much again per km: never drop what three's own test might keep)
const meshFrustum = THREE.Mesh.prototype.intersectsFrustum, plainBefore = THREE.Object3D.prototype.onBeforeRender;
const _pm = new THREE.Matrix4();

export class FlatPass {
  constructor(scene) {
    this.scene = scene;
    this.proxy = Object.create(scene);
    this.proxy.children = [];
    this.on = true;
    this.list = null; this.built = -1; this.frame = 0; this.active = false;
    this.frustum = new THREE.Frustum();
    this.planes = new Float64Array(24);
    this.stats = { passes: 0, walked: 0, handed: 0, dropped: 0, classified: 0, frames: 0 };
  }

  /** Classify the list's objects (each time the list is made again). */
  classify(L) {
    const n = L.n, objs = L.objs;
    this.kind = new Uint8Array(n); this.layers = new Array(n); this.ws = new Float64Array(n * 4);
    this.stamp = new Int32Array(n).fill(-1); this.mode = new Uint8Array(n); this.flags = new Uint8Array(n);
    this.groups = [];
    for (let i = 0; i < n; i++) {
      const o = objs[i];
      this.layers[i] = o.layers;
      let k = WHOLE;
      if (o.isMesh || o.isLine || o.isPoints || o.isSprite) {
        if (o.isMesh) {
          k = MESH;
          this.flags[i] = (o.boundingSphere !== undefined ? OWN_SPHERE : 0) | (o.intersectsFrustum === meshFrustum ? PLAIN_TEST : 0)
            | (o.children.length > 0 ? KIDS : 0) | (o.isInstancedMesh ? INSTANCED : 0);
        }
      } else if (!o.isLOD && !o.isLight && !o.isLightProbeGrid) {
        k = CONTAINER;
        if (o.isGroup) this.groups.push(i);
      }
      this.kind[i] = k;
    }
    // (a container with nothing but containers under it, a rig's bones: nothing in it is drawn, so it is stepped over
    //  without a look at its flags)
    const end = L.end, draws = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) draws[i + 1] = draws[i] + (this.kind[i] === CONTAINER ? 0 : 1);
    for (let i = 0; i < n; i++) if (this.kind[i] === CONTAINER && draws[end[i]] === draws[i]) this.kind[i] = EMPTY;
    this.groups = this.groups.filter((i) => this.kind[i] === CONTAINER);
    this.list = L; this.built = L.built; this.stats.classified++;
  }

  /** Once a frame, before its passes (after the matrices): the list this frame's passes are drawn from. */
  begin() {
    this.active = false;
    if (!this.on) return;
    const L = sceneList(this.scene);
    if (!L) return;
    if (L !== this.list || L.built !== this.built) this.classify(L);
    // (a group's render order orders its subtree's draws: a group with one is handed over whole)
    const { kind, groups } = this, objs = L.objs;
    for (let j = 0; j < groups.length; j++) { const i = groups[j]; kind[i] = objs[i].renderOrder === 0 ? CONTAINER : WHOLE; }
    this.frame++; this.stats.frames++;
    this.active = true;
  }

  end() { this.active = false; }

  /** A mesh's flags and world sphere (three's: its own, an instanced or skinned mesh's, or its geometry's, carried by
   *  its world matrix as three carries it), made once a frame when first reached. Its mode: handed over whole (0: a hook
   *  of its own, children), culled here (1), or not handed over but its children run down here (2: children, and itself
   *  drawing nothing, as a mesh cut into tiles is: perf.js tileSceneSteps). */
  refresh(i, o) {
    this.stamp[i] = this.frame;
    const f = this.flags[i], g = o.geometry, s = (f & OWN_SPHERE) !== 0 ? o.boundingSphere : g.boundingSphere;
    const cull = !!s && o.frustumCulled === true && Number.isFinite(s.radius);
    const plain = o.onBeforeRender === plainBefore && (f & PLAIN_TEST) !== 0;
    this.mode[i] = !plain ? 0 : (f & KIDS) === 0 ? (cull ? 1 : 0) : ((f & INSTANCED) !== 0 ? o.count === 0 : g.drawRange.count === 0) ? 2 : 0;
    if (this.mode[i] !== 1) return;
    const e = this.list.WE[i], c = s.center, W = this.ws, j = i * 4;
    const x = c.x, y = c.y, z = c.z;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    const cx = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    const cy = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    const cz = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    const sx = e[0] * e[0] + e[1] * e[1] + e[2] * e[2], sy = e[4] * e[4] + e[5] * e[5] + e[6] * e[6], sz = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
    const r = s.radius * Math.sqrt(Math.max(sx, sy, sz));
    W[j] = cx; W[j + 1] = cy; W[j + 2] = cz;
    // (the sphere grown by the margin: what is near a plane is handed over, three's own test the judge)
    W[j + 3] = r + MARGIN * (1 + (Math.abs(cx) + Math.abs(cy) + Math.abs(cz) + r) * 1e-3);
  }

  /** The scene's stand-in for a pass by this camera (or the scene itself when this frame can't be drawn so). */
  sceneFor(camera) {
    const L = this.list;
    if (!this.active || sceneList(this.scene) !== L) return this.scene;
    // (the frustum as three makes it for this camera, the same numbers)
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(_pm, THREE.WebGLCoordinateSystem, camera.reversedDepth);
    const P = this.frustum.planes, F = this.planes;
    for (let k = 0; k < 6; k++) { const p = P[k]; F[k * 4] = p.normal.x; F[k * 4 + 1] = p.normal.y; F[k * 4 + 2] = p.normal.z; F[k * 4 + 3] = p.constant; }
    const W = this.ws;
    const mask = camera.layers.mask;
    const { kind, layers, stamp, mode, frame } = this;
    const { objs, end } = L;
    const out = this.proxy.children;
    out.length = 0;
    let walked = 0, dropped = 0;
    for (let i = 1, n = L.n; i < n; i++) {
      walked++;
      const k = kind[i];
      if (k === CONTAINER) { if (objs[i].visible === false) i = end[i] - 1; continue; }
      if (k === WHOLE) { out.push(objs[i]); i = end[i] - 1; continue; }
      if (k === EMPTY) { i = end[i] - 1; continue; }
      // a mesh. Hidden, it and its subtree are passed by; its layers failing, it is not drawn but its children are still
      // walked. (Read here only
      // when it is needed: a mesh outside the frustum is passed by on the numbers kept here alone.)
      const o = objs[i];
      let met = false;
      if (stamp[i] !== frame) {
        if (o.visible === false) { if (end[i] !== i + 1) i = end[i] - 1; continue; }   // (hidden: nothing in it drawn, nothing to make)
        if ((layers[i].mask & mask) === 0) continue;
        this.refresh(i, o);
        met = true;
      }
      const m = mode[i];
      if (m === 1) {
        const j = i * 4, x = W[j], y = W[j + 1], z = W[j + 2], r = -W[j + 3];
        if (F[0] * x + F[1] * y + F[2] * z + F[3] < r || F[4] * x + F[5] * y + F[6] * z + F[7] < r
          || F[8] * x + F[9] * y + F[10] * z + F[11] < r || F[12] * x + F[13] * y + F[14] * z + F[15] < r
          || F[16] * x + F[17] * y + F[18] * z + F[19] < r || F[20] * x + F[21] * y + F[22] * z + F[23] < r) { dropped++; continue; }
        if ((met || (layers[i].mask & mask) !== 0) && o.visible === true) out.push(o);   // (hidden: three would pass it by)
        continue;
      }
      if (!met && (layers[i].mask & mask) === 0) { if (end[i] !== i + 1 && o.visible === false) i = end[i] - 1; continue; }
      if (m === 0) { out.push(o); i = end[i] - 1; continue; }
      // (drawing nothing: hidden, its whole subtree is; shown, its children come next)
      if (o.visible === false) i = end[i] - 1;
    }
    const st = this.stats;
    st.passes++; st.walked += walked; st.handed += out.length; st.dropped += dropped;
    return this.proxy;
  }
}

/**
 * Draw every renderer.render(scene, …) of a frame (between flat.begin() and flat.end()) from the flat list: the scene
 * swapped for its stand-in. Only while the scene's matrices are the frame's (matrixWorldAutoUpdate off, as renderFrame
 * leaves it): a render that would update them walks as ever.
 */
export function flatPasses(renderer, scene) {
  const flat = new FlatPass(scene);
  const render = renderer.render;
  renderer.render = function (s, camera) {
    if (s === scene && flat.active && scene.matrixWorldAutoUpdate === false) s = flat.sceneFor(camera);
    return render.call(this, s, camera);
  };
  return flat;
}
