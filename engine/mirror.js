// The three.js scene, mirrored into an engine's own scene once a frame (docs/systems/engine-bridge.md).
//
// The game keeps building and moving three.js objects exactly as it does on the web; nothing draws
// them in the VM. Each frame `mirror.sync(scene, camera)` walks the scene and tells the backend
// only what changed:
//
//   geometry(gid, g)            once per geometry (and again when an attribute's version moves):
//                               typed arrays, as three holds them (position, normal, uv, color,
//                               skinIndex / skinWeight, index) and its groups
//   material(mid, spec)         once per material (inkSpec: makeMaterial's options read back)
//   create(id, node)            a drawable appears: { kind, gid, mids, name, shadow, ... }
//   transforms(ids, mats, n)    the world matrices that moved, packed: n ids, 16 floats each
//   visible(id, on)             shown / hidden (an ancestor hidden or the object left the scene)
//   geometryOf(id, gid)         a drawable's geometry swapped or rewritten (sent again first)
//   vertices(gid, positions, normals, n, alpha)   only a geometry's points and normals moved (cloth), or its points and
//                               a per-vertex alpha (aAlpha: the wind's wisps, rebuilt each frame): those alone
//   instances(id, count, mats, colors, attrs, time)   an InstancedMesh's instances, when they change: their
//                               matrices, colours and per-instance attributes ({ aAnim: { array, itemSize }… }), the
//                               game's clock then (mirror.time: the crowd's figures pose by it in their shader).
//                               A plain Mesh on an InstancedBufferGeometry (kind 'instgeo': the grass blades, flora-grass.js)
//                               has no matrices: mats and colors are null, its attributes carry their version and
//                               the range rewritten since they were last sent ({ array, itemSize, version, range: [start, count] | null })
//   materialLive(mid, color, glow)   a material's colour or glow changed after it was sent (the answering plants
//                               waking, a lamp lit, a beacon breathing): checked each frame a drawable using it is drawn
//   materialVec(mid, which, v)  a material's vector moved (LIVE_VECTORS[which]: a box's ray, the traveller's drawn face)
//   keyWeights(id, w)           a face's shape-key weights moved (face-keys.js mesh.userData.keyWeights)
//   materialFluid(mid, f)       the traveller's fluid on a material (fluid-tool.js): uFluidA, uFluidB, the six tones, its base (29 floats), when they move
//   drawState(id, object)       each frame an 'instgeo' drawable is drawn: the backend reads what moves on it (its
//                               material's per-frame uniforms: the grass patch's centre and fades)
//   skeleton(sid, mats, n)      a skeleton's bone matrices (bone world × inverse bind: three's boneMatrices), once a frame
//                               it is drawn, however many meshes it moves; a skinned mesh's create says its skeleton
//                               and its bind matrix (desc.skeleton, desc.bind, desc.attached). A backend with
//                               skeleton() gets them so; one without gets bones() a mesh, as before:
//   bones(id, mats, n, bind, bindInverse)   a SkinnedMesh's bone matrices and its bind matrices, each frame it is seen
//                               (skin.js skinMatrices folds them into one per bone)
//   remove(id)                  gone for good (not in the scene for `forgetAfter` frames)
//   camera(c)                   { world: 16 floats, fov, near, far, aspect }
//   frame(f)                    once a frame, last: { sunDir, time, stats }
//
// Ids are small integers, given in the order things are first seen; the backend keeps whatever it
// made for them. Every array handed over is the mirror's own (or the geometry's): a backend that
// keeps one must copy it.
import { inkSpec } from './ink-spec.js';
import { survey, CHECK_ROUND, SURVEY_EVERY } from './mirror-freeze.js';
import { updateSceneMatrices, sceneList } from './scene-matrices.js';
import { WORLD_STAMP } from '../src/matrix-cache.js';


/**
 * A material's vectors that move after it is made, sent live (materialVec's `which` is the index): a makers' box's
 * ray and clock (boxes/), the coral-shirt traveller's drawn face (characters/tripo-face.js: brows, eyes, mouth), a
 * face's expression as its ink draws it (Humanoid.setExpression: uMood, uMood2).
 */
export const LIVE_VECTORS = ['uBoxA', 'uTfBrowA', 'uTfBrowB', 'uTfEye', 'uTfMouth', 'uMood', 'uMood2'];
const LIVE_FROM_SPEC = LIVE_VECTORS.indexOf('uMood');

/** What a render hook is handed for the renderer: nothing it can draw with (hooks here read the scene, not it). */
// (a drawable unchanged this many frames is "quiet": its geometry, materials and keys looked at every 4th frame, quietWalk)
const QUIET_AFTER = 30;
const RENDERER_STUB = Object.freeze({ isWebGLRenderer: false, info: { render: { frame: 0 } } });

export class SceneMirror {
  /**
   * @param backend  the engine side (see above); missing methods are skipped
   * @param o.forgetAfter  frames an object may be out of the scene before it is removed
   * @param o.filter (o) => false to leave an object (and its children) out
   * @param o.freeze  still subtrees taken whole, not walked (mirror-freeze.js; off: in Puerts its watches cost the game more than they saved)
   * @param o.quietWalk  drawables unchanged for QUIET_AFTER frames looked at in full every 4th frame only (the Unity backend's)
   * @param o.listMatrices  the scene's matrices from a flat list of it (engine/scene-matrices.js), not a walk down it
   * @param o.stillMatrices  with listMatrices: a drawable's world matrix compared with the one last sent only when it may
   *   have changed (the list made it anew, or a walk outside it did: src/matrix-cache.js WORLD_STAMP), and every 8th frame
   * @param o.skipHidden  with listMatrices: hidden subtrees' matrices left until they are shown or read (scene-matrices.js)
   */
  constructor(backend, { forgetAfter = 120, filter = null, materialSpec = inkSpec, castsShadow = null, freeze = false, quietWalk = false, listMatrices = false, stillMatrices = false, skipHidden = false } = {}) {
    this.backend = backend;
    this.castsShadow = castsShadow;   // (o) → false: left out of the sun's shadow (the game's caster rules: shadows.js)
    this.forgetAfter = forgetAfter;
    this.filter = filter;
    this.materialSpec = materialSpec;
    this.ids = new WeakMap();          // Object3D → id
    this.nodes = new Map();            // id → { object, matrix: Float32Array(16), shown, seen, instVersion }
    this.geoms = new WeakMap();        // BufferGeometry → { gid, version }
    this.mats = new WeakMap();         // Material → mid
    this.nextId = 1; this.nextGeo = 1; this.nextMat = 1; this.nextSkeleton = 1;
    this._stack = [];
    this.frameNo = 0;
    this._ids = new Int32Array(256);
    this._mats = new Float32Array(256 * 16);
    this._cam = new Float32Array(16);
    this.stats = { nodes: 0, drawn: 0, moved: 0, geometries: 0, materials: 0, uploadedBytes: 0, skipped: 0 };
    this.prof = { matrices: 0, walk: 0, bones: 0, tail: 0, frame: 0, frames: 0 };
    this.profiling = false;
    this.freeze = freeze && !filter;
    this.listMatrices = listMatrices;
    this.stillMatrices = stillMatrices && listMatrices;
    this.skipHidden = skipHidden && listMatrices;
    if (this.stillMatrices) WORLD_STAMP.on = true;
    this.quietWalk = quietWalk;   // (a filter may change its mind about what is inside: walked each frame)
    this._frozen = []; this._frozenDirty = false; this._checkAt = 0;
    this.time = 0;            // the game's clock (sharedUniforms.uTime), set before sync: handed to instances()   // (the bones' share timed apart: costs a clock read a skinned mesh)
  }

  _geometry(geo) {
    let g = this.geoms.get(geo);
    const version = attrVersion(geo, -1);   // (the list read afresh: an upload is rare)
    if (g && g.version === version) return g.gid;
    // only the points, their normals, alpha or colours moved (cloth: the capes, banners, a trail; the flames' flicker),
    // the same count and triangles: those go alone, in the frame (a backend with vertices()), not the whole geometry again
    if (g && this.backend.vertices && sameShape(geo, g)) {
      const was = g.versions;
      g.version = version; g.versions = versionsOf(geo);
      const A = geo.attributes;
      const col = A.color && g.versions.color !== was.color ? { array: plain(A.color), itemSize: A.color.itemSize, normalized: A.color.normalized } : null;
      this.backend.vertices(g.gid, plain(A.position), A.normal ? plain(A.normal) : null, A.position.count, A.aAlpha ? plain(A.aAlpha) : null, col);
      this.stats.vertexUpdates = (this.stats.vertexUpdates ?? 0) + 1;
      return g.gid;
    }
    if (!g) { g = { gid: this.nextGeo++, version }; this.geoms.set(geo, g); this.stats.geometries++; }
    g.version = version; g.versions = versionsOf(geo);
    this._full = true;
    const a = geo.attributes;
    const out = { groups: geo.groups.length ? geo.groups.map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex ?? 0 })) : null, attributes: {} };
    for (const [name, attr] of Object.entries(a)) {
      if (attr.isInstancedBufferAttribute) continue;   // (per instance: they go with instances())
      if (attr.isInterleavedBufferAttribute) { out.attributes[name] = { array: deinterleave(attr), itemSize: attr.itemSize, normalized: attr.normalized }; continue; }
      out.attributes[name] = { array: attr.array, itemSize: attr.itemSize, normalized: attr.normalized };
      this.stats.uploadedBytes += attr.array.byteLength;
    }
    if (geo.index) { out.index = geo.index.array; this.stats.uploadedBytes += geo.index.array.byteLength; }
    out.drawRange = geo.drawRange.count === Infinity ? null : { start: geo.drawRange.start, count: geo.drawRange.count };
    this.backend.geometry?.(g.gid, out, geo);
    return g.gid;
  }

  _material(m) {
    let mid = this.mats.get(m);
    if (mid) return mid;
    mid = this.nextMat++;
    this.mats.set(m, mid);
    this.stats.materials++;
    this.backend.material?.(mid, this.materialSpec(m), m);
    return mid;
  }

  _skeletonId(sk) { return sk.__mirrorId ??= this.nextSkeleton++; }

  /** A material's colour and glow as last sent (once a frame, however many drawables use it): told when they moved. */
  _live(m, f) {
    if (m.__mirrorLiveF === f) return;
    m.__mirrorLiveF = f;
    const U = m.uniforms, c = U?.uColor?.value, g = U?.uGlow?.value;
    // the vectors that move every frame (LIVE_VECTORS: a makers' box's ray and clock, the coral-shirt traveller's drawn face)
    if (this.backend.materialVec && U) {
      // (which of them the material has, looked up again every 64 frames: most have none)
      let H = m.__mirrorHas;
      if (!H || f - H.at >= 64 || H.of !== U) {
        H = m.__mirrorHas = { at: f, of: U, w: [] };
        for (let w = 0; w < LIVE_VECTORS.length; w++) if (U[LIVE_VECTORS[w]]?.value?.isVector4) H.w.push(w);
      }
      for (let k = 0; k < H.w.length; k++) {
        const w = H.w[k], A = U[LIVE_VECTORS[w]]?.value;
        if (!A?.isVector4) continue;
        // (a face's mood starts as the material was sent with it: only its moves go; the others once as they are)
        const L2 = (m.__mirrorVec ??= {})[w] ??= w >= LIVE_FROM_SPEC ? Float32Array.of(A.x, A.y, A.z, A.w) : new Float32Array(4).fill(NaN);
        if (L2[0] === Math.fround(A.x) && L2[1] === Math.fround(A.y) && L2[2] === Math.fround(A.z) && L2[3] === Math.fround(A.w)) continue;
        L2[0] = A.x; L2[1] = A.y; L2[2] = A.z; L2[3] = A.w;
        const mid = this.mats.get(m);
        m.__mirrorMovedAt = f;
        if (mid) this.backend.materialVec(mid, w, [A.x, A.y, A.z, A.w]);
      }
    }
    // the traveller's fluid (fluid-tool.js): its fill, tones and clock move every frame it flows
    if (U?.uFluidA && U.uFluidTones && this.backend.materialFluid) {
      const F = m.__mirrorFluid ??= new Float32Array(29).fill(NaN), A = U.uFluidA.value, Bv = U.uFluidB?.value, T = U.uFluidTones.value, FB = U.uFluidBase?.value;
      let moved = false;
      const put = (k, v) => { const x = Math.fround(v); if (F[k] !== x) { F[k] = x; moved = true; } };
      put(0, A.x); put(1, A.y); put(2, A.z); put(3, A.w);
      if (Bv) { put(4, Bv.x); put(5, Bv.y); put(6, Bv.z); put(7, Bv.w); }
      for (let i = 0; i < 6 && i < T.length; i++) { put(8 + i * 3, T[i].r); put(9 + i * 3, T[i].g); put(10 + i * 3, T[i].b); }
      if (FB?.isColor) { put(26, FB.r); put(27, FB.g); put(28, FB.b); }
      const mid = this.mats.get(m);
      if (moved) m.__mirrorMovedAt = f;
      if (moved && mid) this.backend.materialFluid(mid, F);
    }
    if (!c?.isColor && typeof g !== 'number') return;
    const r = c?.isColor ? Math.fround(c.r) : 0, gr = c?.isColor ? Math.fround(c.g) : 0, b = c?.isColor ? Math.fround(c.b) : 0, gl = typeof g === 'number' ? Math.fround(g) : 0;
    const L = m.__mirrorLive;
    if (!L) { m.__mirrorLive = [r, gr, b, gl]; return; }   // (as sent with the material)
    if (L[0] === r && L[1] === gr && L[2] === b && L[3] === gl) return;
    L[0] = r; L[1] = gr; L[2] = b; L[3] = gl;
    m.__mirrorMovedAt = f;
    const mid = this.mats.get(m);
    if (mid) this.backend.materialLive(mid, c?.isColor ? [c.r, c.g, c.b] : null, typeof g === 'number' ? g : null);
  }

  _create(o) {
    const id = this.nextId++;
    this.ids.set(o, id);
    const kind = o.isSkinnedMesh ? 'skinned' : o.isInstancedMesh ? 'instanced' : o.isMesh && isInstGeo(o.geometry) ? 'instgeo' : o.isMesh ? 'mesh' : o.isPoints ? 'points' : o.isLine ? (o.isLineSegments ? 'segments' : 'line') : 'sprite';
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const node = { id, object: o, matrix: new Float32Array(16).fill(NaN), shown: false, seen: -1, mw: -1, instVersion: -1, kind, geo: null, gv: -1, changedAt: this.frameNo, frozen: null, owner: this, dead: false, hook: undefined, matMovedAt: -1e9 };
    o.__mirror = node;   // (the walk finds it on the object: no map lookups a frame)
    this.nodes.set(id, node);
    this.stats.nodes++;
    const desc = { kind, name: o.name || '', gid: o.geometry ? this._geometry(o.geometry) : 0, mids: mats.map((m) => (m ? this._material(m) : 0)), renderOrder: o.renderOrder ?? 0 };
    desc.shadow = this.castsShadow ? this.castsShadow(o) !== false : true;
    if (o.isSkinnedMesh) {
      desc.bones = o.skeleton?.bones.length ?? 0;
      if (o.skeleton) { desc.skeleton = this._skeletonId(o.skeleton); desc.bind = Array.from(o.bindMatrix.elements); desc.attached = o.bindMode !== 'detached'; }
    }
    if (o.isInstancedMesh) desc.capacity = o.instanceMatrix.count;
    if (kind === 'instgeo') { desc.capacity = o.geometry.instanceCount; desc.attrs = Object.keys(instancedAttributes(o.geometry)); }
    this.backend.create?.(id, desc, o);
    return id;
  }

  /** One frame: everything that changed since the last one. Call after the game's update. */
  sync(scene, camera) {
    const f = ++this.frameNo;
    const P = this.prof, now = () => performance.now();
    let t = now();
    // (the stamp the walks outside the list put on what they change from now on: src/matrix-cache.js WORLD_STAMP)
    const stamp = ++WORLD_STAMP.n;
    const fromList = this.listMatrices ? updateSceneMatrices(scene, this.skipHidden) : (scene.updateMatrixWorld(), false);
    camera?.updateMatrixWorld();
    P.matrices += now() - t; t = now();
    let drawn = 0;
    this._moved = 0; this._tb = 0;
    const B = this.backend, perSkeleton = !!B.skeleton, filter = this.filter, liveMats = !!B.materialLive;
    let visited = 0;
    // the scene's flat list (engine/scene-matrices.js, the matrices' own, depth first as the walk below goes), walked
    // down instead of the scene: what each object is (drawable, a bone carrying nothing) kept beside it, a hidden one's
    // subtree stepped over; the same objects in the same order, with fewer reads off the objects themselves
    const L = this.listMatrices && !filter && !this.freeze ? sceneList(scene) : null;
    if (L) {
      if (this._wl !== L || this._wlBuilt !== L.built) {
        this._wl = L; this._wlBuilt = L.built;
        const W = this._wlKind = new Uint8Array(L.n);
        for (let i = 0; i < L.n; i++) {
          const o = L.objs[i];
          W[i] = (o.isMesh || o.isPoints || o.isLine || o.isSprite ? 1 : 0) | (o.isBone && !boneCarries(o) ? 2 : 0);
        }
      }
      const { objs, end, WE } = L, W = this._wlKind;
      // (still: the list ran this frame, so its `changed` says which world matrices it changed; a drawable it did not
      // change, that no walk outside it changed since the last frame (its node's stamp older than the last frame's) and
      // whose matrix was sent or compared last frame has the matrix it had: no need to compare its 16 numbers again)
      const ch = this.stillMatrices && fromList === true ? L.changed : null, old = stamp - 1;
      for (let i = 0, N = L.n; i < N; i++) {
        const o = objs[i];
        visited++;
        if (!o.visible) { i = end[i] - 1; continue; }
        const w = W[i];
        if (w & 1) { drawn++; this._see(o, WE[i], f, B, perSkeleton, liveMats, scene, camera, ch !== null && ch[i] === 0 ? old : 0); }
        if (w & 2) i = end[i] - 1;
      }
    }
    // (an explicit stack, not a recursive closure: ~3 000 objects a frame in the desert)
    const stack = this._stack; stack.length = 0; if (!L) stack.push(scene);
    while (stack.length) {
      const o = stack.pop();
      visited++;
      if (!o.visible) continue;
      if (filter && filter(o) === false) continue;
      // a frozen subtree (mirror-freeze.js): its drawables seen as they were, their materials' live values looked at
      const fz = o.__frozen;
      if (fz && fz.root === o && fz.mirror === this && !fz.dead) {
        fz.seen = f; drawn += fz.drawn;
        if (liveMats) { const M = fz.mats; for (let i = 0; i < M.length; i++) this._live(M[i], f); }
        continue;
      }
      if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { drawn++; this._see(o, o.matrixWorld.elements, f, B, perSkeleton, liveMats, scene, camera); }
      // (a skeleton's bones are walked only down to what hangs on them: a prop in a hand, a hat)
      if (o.isBone && !boneCarries(o)) continue;
      const ch = o.children;
      for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
    }
    const n = this._moved, tb = this._tb;
    P.walk += now() - t - tb; P.bones += tb; t = now();
    if (n) B.transforms?.(this._ids, this._mats, n);
    // what was not reached: hidden, and in time forgotten
    // (forEach, not for-of: a destructured entry is an array a node, ~2 000 of them a frame)
    this.nodes.forEach((node, id) => {
      if (node.seen === f) return;
      const fz = node.frozen;
      if (fz && fz.seen === f && !fz.dead) return;   // (in a frozen subtree the walk took whole)
      if (node.shown) { node.shown = false; B.visible?.(id, false); }
      if (f - node.seen > this.forgetAfter && !inScene(node.object, scene)) { B.remove?.(id); node.dead = true; this.nodes.delete(id); this.ids.delete(node.object); if (node.object.__mirror === node) node.object.__mirror = null; this.stats.nodes--; }
    });
    if (this.freeze) this._still(scene, f);
    if (camera) {
      this._cam.set(camera.matrixWorld.elements);
      B.camera?.({ world: this._cam, fov: camera.fov, near: camera.near, far: camera.far, aspect: camera.aspect, zoom: camera.zoom ?? 1 });
    }
    this.stats.drawn = drawn; this.stats.moved = n; this.stats.visited = visited;
    P.tail += now() - t; t = now();
    B.frame?.({ frame: f, stats: this.stats });
    P.frame += now() - t; P.frames++;
    return this.stats;
  }

  /**
   * One drawable reached by the walk this frame: made if new, shown, its geometry, hooks, materials' live values, shape
   * keys, world matrix (e: its elements), instances and bones told the backend as they change.
   */
  _see(o, e, f, B, perSkeleton, liveMats, scene, camera, still = 0) {
    let node = o.__mirror;
    if (!node || node.owner !== this || node.dead) node = this.nodes.get(this._create(o));
    const id = node.id;
    // (its world matrix as last sent, without comparing: sent or compared last frame, unchanged by the list (still > 0),
    // no walk's stamp since the last frame's began, its matrices its own; every 8th frame compared anyway)
    const same = still > 0 && node.seen === f - 1 && node.mw < still && ((f + id) & 7) !== 0 && o.matrixAutoUpdate === true && o.matrixWorldAutoUpdate === true;
    node.seen = f;
    // a drawable that has not changed for half a second (no move, geometry, shape key or material value, no render
    // hook, not skinned or instanced): its geometry, materials and keys looked at every 4th frame (staggered by its
    // id), its matrix every frame. ~3 000 objects are walked a frame and most stand still: each look touches a few
    // objects more, which on the Xbox's memory costs more than the arithmetic
    const look = !this.quietWalk || node.hook !== false || f - node.changedAt <= QUIET_AFTER || f - (node.matMovedAt ?? -1e9) <= QUIET_AFTER || ((f + id) & 3) === 0;
    // a geometry swapped or rewritten (cloth, a trail, a morph baked): sent again, and each node drawing it told
    const geo = o.geometry;
    if (look && geo && (geo !== node.geo || node.gv !== attrVersion(geo, f))) {
      this._full = false;
      const gid = this._geometry(geo);
      // (told only when it is another geometry or was sent whole again: moved points alone need nothing)
      if (node.geo && (geo !== node.geo || this._full)) B.geometryOf?.(id, gid);
      node.geo = geo; node.gv = this.geoms.get(geo).version; node.changedAt = f;
    }
    // an object's own render hook (the crowd's tiers set their count in it; a face binds its keys): called as the
    // renderer would before drawing it, in the main pass (no override material)
    if (look) node.hook = Object.prototype.hasOwnProperty.call(o, 'onBeforeRender') || node.kind === 'skinned' || node.kind === 'instanced' || node.kind === 'instgeo';
    if (look && Object.prototype.hasOwnProperty.call(o, 'onBeforeRender')) { try { o.onBeforeRender(RENDERER_STUB, scene, camera, geo, o.material, null); } catch { /* a hook that wants a real renderer */ } }
    if (!node.shown) { node.shown = true; node.changedAt = f; B.visible?.(id, true); }
    if (look && liveMats) {
      const M = o.material;
      let moved = -1e9;
      if (Array.isArray(M)) { for (const m of M) { this._live(m, f); moved = Math.max(moved, m.__mirrorMovedAt ?? -1e9); } } else if (M) { this._live(M, f); moved = M.__mirrorMovedAt ?? -1e9; }
      node.matMovedAt = moved;
    }
    // a MakeHuman face's shape keys (face-keys.js: the mesh's own weights), when they move
    const KW = look ? o.userData.keyWeights : null;
    if (KW && B.keyWeights) {
      const S = node.keys ??= new Float32Array(KW.length).fill(NaN);
      let moved = false;
      for (let i = 0; i < KW.length; i++) if (S[i] !== Math.fround(KW[i])) { S[i] = KW[i]; moved = true; }
      if (moved) { B.keyWeights(id, S); node.changedAt = f; }
    }
    const m = node.matrix;
    // (compared as the floats they are sent as: a double that floats can't hold is no move)
    let k = 16;
    if (!same) { k = 0; while (k < 16 && m[k] === Math.fround(e[k])) k++; }
    if (k < 16) {
      for (k = 0; k < 16; k++) m[k] = e[k];
      node.changedAt = f;
      const n = this._moved++;
      if (n >= this._ids.length) this._grow();
      this._ids[n] = id; this._mats.set(m, n * 16);
    }
    if (node.kind === 'instanced') {
      // (and the per-instance attributes, as the crowd's figures carry their pose in: aAnim, aReact…)
      const ia = node.instAttrs ??= instancedAttributes(geo);
      let v = o.instanceMatrix.version + (o.instanceColor?.version ?? 0) * 1e6 + o.count * 1e12;
      for (const k in ia) v += geo.attributes[k].version * 1e3;
      if (v !== node.instVersion) {
        node.instVersion = v;
        let attrs = null;
        for (const k in ia) (attrs ??= {})[k] = { array: geo.attributes[k].array, itemSize: geo.attributes[k].itemSize };
        B.instances?.(id, o.count, o.instanceMatrix.array, o.instanceColor?.array ?? null, attrs, this.time);
      }
    }
    if (node.kind === 'instgeo') {
      // instances with no matrices (the grass): their attributes when they move (only the range rewritten), the count
      const ia = node.instAttrs ??= instancedAttributes(geo);
      let v = geo.instanceCount * 1e12;
      for (const k in ia) v += geo.attributes[k].version * 1e3;
      if (v !== node.instVersion) {
        const first = node.instVersion === -1;
        node.instVersion = v;
        const attrs = {};
        node.sentAttr ??= {};
        for (const k in ia) {
          const a = geo.attributes[k];
          if (!first && node.sentAttr[k] === a.version) continue;
          node.sentAttr[k] = a.version;
          const r = a.updateRanges?.length ? a.updateRanges.reduce((m, x) => [Math.min(m[0], x.start), Math.max(m[1], x.start + x.count)], [Infinity, -Infinity]) : null;
          attrs[k] = { array: a.array, itemSize: a.itemSize, version: a.version, range: !first && r ? [r[0], r[1] - r[0]] : null };
        }
        B.instances?.(id, geo.instanceCount, null, null, attrs, this.time);
      }
      B.drawState?.(id, o);
    }
    if (node.kind === 'skinned' && o.skeleton) {
      // (timed only when profiling: in Puerts the clock is a call into C#, ~5 µs each)
      const t0 = this.profiling ? performance.now() : 0;
      const sk = o.skeleton;
      if (perSkeleton && o.bindMode !== 'detached') {
        // once a frame a skeleton, however many meshes it moves (a person's body, eyes, brows, hair)
        if (sk.__mirrorFrame !== f) { sk.__mirrorFrame = f; skeletonUpdate(sk, f); B.skeleton(this._skeletonId(sk), sk.boneMatrices, sk.bones.length); }
      } else {
        if (sk.__mirrorFrame !== f) { sk.__mirrorFrame = f; skeletonUpdate(sk, f); }   // boneMatrices = bone world × inverse bind (three's own)
        B.bones?.(id, sk.boneMatrices, sk.bones.length, o.bindMatrix.elements, o.bindMatrixInverse.elements);
      }
      if (this.profiling) this._tb += performance.now() - t0;
    }
  }

  /** The time the mirror spent (ms a frame, averaged since the last call): the matrices, the walk, the bones, the rest, the backend's frame. */
  profile() {
    const P = this.prof, k = Math.max(P.frames, 1), out = {};
    for (const key of ['matrices', 'walk', 'bones', 'tail', 'frame']) out[key] = +(P[key] / k).toFixed(3);
    out.frames = P.frames;
    this.prof = { matrices: 0, walk: 0, bones: 0, tail: 0, frame: 0, frames: 0 };
    return out;
  }

  /** The frozen subtrees: a few looked at for what has no hook, and the scene surveyed for more now and then. */
  _still(scene, f) {
    let L = this._frozen;
    if (this._frozenDirty) { L = this._frozen = L.filter((r) => !r.dead); this._frozenDirty = false; }
    const k = Math.ceil(L.length / CHECK_ROUND);
    for (let i = 0; i < k && L.length; i++) { const r = L[this._checkAt++ % L.length]; if (!r.dead) r.check(f, attrVersion); }
    if (f % SURVEY_EVERY === 0) survey(this, scene, f);
  }

  /** Every frozen subtree thawed (a test, or before the scene is handed elsewhere). */
  thawAll() { for (const r of this._frozen) r.thaw(); this._frozen = []; this._frozenDirty = false; }

  _grow() {
    const ids = new Int32Array(this._ids.length * 2); ids.set(this._ids); this._ids = ids;
    const mats = new Float32Array(this._mats.length * 2); mats.set(this._mats); this._mats = mats;
  }

  /** The id an object was given (0 if it was never drawn). */
  idOf(o) { return this.ids.get(o) ?? 0; }
}

/**
 * A geometry's version: the sum of its attributes' versions (and its index's), times 64, plus how many
 * there are, so an attribute added or rewritten moves it. The attribute list is kept on the geometry
 * and looked at again every 32 frames (a for-in over every drawable's attributes each frame was most
 * of the walk).
 */
function attrVersion(geo, frame = -1) {
  let c = geo.__mirrorAttrs;
  if (!c || frame < 0 || frame - c.at >= 32 || c.of !== geo.attributes) {
    const list = [];
    for (const k in geo.attributes) if (!geo.attributes[k].isInstancedBufferAttribute) list.push(geo.attributes[k]);
    c = geo.__mirrorAttrs = { list, at: frame, of: geo.attributes, index: geo.index, epoch: c ? c.epoch + (c.index !== geo.index ? 1 : 0) : 0 };
  }
  // (a new index, setIndex: a new shape, whatever its version says)
  if (c.index !== geo.index) { c.index = geo.index; c.epoch++; }
  else if (frame >= 0 && c.vf === frame) return c.v;   // (a geometry drawn by many: summed once a frame)
  let v = geo.index ? geo.index.version + 1 : 0;
  const L = c.list;
  // (an interleaved attribute, as glTF loads them, keeps its version on its buffer)
  for (let i = 0; i < L.length; i++) { const a = L[i]; v += (a.isInterleavedBufferAttribute ? a.data.version : a.version) ?? 0; }
  c.vf = frame;
  return (c.v = (v * 64 + L.length) + c.epoch * 1e12);
}

/**
 * three's Skeleton.update (each bone's world matrix times its inverse bind, into boneMatrices), the same products in the
 * same order, from the bones' and inverses' element arrays kept on the skeleton (looked up again every 32 frames, or
 * when the bones change): the walk to them through each bone and matrix was most of its cost.
 */
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function skeletonUpdate(sk, f) {
  const bones = sk.bones, inv = sk.boneInverses, out = sk.boneMatrices;
  let c = sk.__mirrorEls;
  if (!c || f - c.at >= 32 || c.n !== bones.length || c.of !== bones || c.inv !== inv) {
    const n = bones.length, A = new Array(n), Bm = new Array(n);
    for (let i = 0; i < n; i++) { A[i] = bones[i] ? bones[i].matrixWorld.elements : IDENTITY; Bm[i] = inv[i].elements; }
    c = sk.__mirrorEls = { at: f, n, of: bones, inv, A, B: Bm };
  }
  const A = c.A, Bm = c.B;
  for (let i = 0, n = c.n; i < n; i++) {
    const ae = A[i], be = Bm[i], o = i * 16;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    out[o] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    out[o + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    out[o + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    out[o + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    out[o + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    out[o + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    out[o + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    out[o + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    out[o + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    out[o + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    out[o + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    out[o + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    out[o + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    out[o + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    out[o + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    out[o + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
  }
  if (sk.boneTexture) sk.boneTexture.needsUpdate = true;
}

/** A plain mesh's instanced geometry with a count of its own (the grass blades: flora-grass.js). */
function isInstGeo(geo) { return !!geo?.isInstancedBufferGeometry && Number.isFinite(geo.instanceCount); }

/** A geometry's per-instance attributes (InstancedBufferAttribute), by name. */
function instancedAttributes(geo) {
  const out = {};
  for (const k in geo?.attributes ?? {}) if (geo.attributes[k].isInstancedBufferAttribute) out[k] = true;
  return out;
}

/** Each attribute's version (and the index's), by name. */
function versionsOf(geo) {
  const v = { __index: geo.index ? geo.index.version : -1, __indexRef: geo.index, __count: geo.attributes.position?.count ?? 0 };
  for (const k in geo.attributes) { const a = geo.attributes[k]; if (!a.isInstancedBufferAttribute) v[k] = a.isInterleavedBufferAttribute ? a.data.version : a.version; }
  return v;
}
/** Did only the positions and normals (and a per-vertex alpha) change since the geometry was last sent? */
function sameShape(geo, g) {
  const was = g.versions, now = versionsOf(geo);
  if (!was || now.__index !== was.__index || now.__indexRef !== was.__indexRef || now.__count !== was.__count) return false;
  const keys = Object.keys(now);
  if (keys.length !== Object.keys(was).length) return false;
  for (const k of keys) if (now[k] !== was[k] && k !== 'position' && k !== 'normal' && k !== 'aAlpha' && k !== 'color') return false;
  return now.position !== was.position || now.normal !== was.normal || now.aAlpha !== was.aAlpha || now.color !== was.color;
}
const plain = (a) => (a.isInterleavedBufferAttribute ? deinterleave(a) : a.array);

/**
 * Does anything that is not a bone hang below this bone? Kept on the bones, and forgotten up the chain when a
 * child is added to or taken from one of them (three's childadded / childremoved).
 */
function boneCarries(b) {
  const c = b.__mirrorCarries;
  if (c !== undefined) return c;
  if (!b.__mirrorBoneWatch) { b.__mirrorBoneWatch = true; b.addEventListener?.('childadded', forgetCarries); b.addEventListener?.('childremoved', forgetCarries); }
  let any = false;
  const ch = b.children;
  for (let i = 0; i < ch.length; i++) if (!ch[i].isBone || boneCarries(ch[i])) any = true;
  return (b.__mirrorCarries = any);
}
function forgetCarries(e) { for (let p = e.target; p && p.isBone; p = p.parent) p.__mirrorCarries = undefined; }

function inScene(o, scene) { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; }

function deinterleave(attr) {
  const out = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k);
  return out;
}
