// The three.js scene, mirrored into an engine's own scene once a frame (docs/systems/engine-bridge.md).
//
// The game keeps building and moving three.js objects exactly as it does on the web; nothing draws
// them in the VM. Each frame `mirror.sync(scene, camera)` walks the scene and tells the backend
// only what changed. (How it knows without looking at everything: the scene's list, engine/scene-matrices.js, says
// which world matrices changed and what is shown; the notices, engine/mirror-notices.js, say which hooks and attributes
// were rewritten; a drawable's geometry and material are read, its materials' values once a frame: `noticed`, the
// Unity bridge's, issue #455. tests/mirror-noticed.test.js holds it to the mirror that looks at everything.)
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
//   materialSkin(mid, data)    a temple skin's uniforms moved (skin-shader.js's vec4 slots: a bell ringing, a lamp lit)
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
import { skinPatternSpec } from '../src/temples/skins/skin-shader.js';
import { survey, CHECK_ROUND, SURVEY_EVERY } from './mirror-freeze.js';
import { updateSceneMatrices, sceneList } from './scene-matrices.js';
import { WORLD_STAMP } from '../src/matrix-cache.js';
import { skeletonUpdate } from '../src/skeleton-update.js';
import { noticesOn, ownHook, attrIn } from './mirror-notices.js';


/**
 * A material's vectors that move after it is made, sent live (materialVec's `which` is the index): a makers' box's
 * ray and clock (boxes/), the coral-shirt traveller's drawn face (characters/tripo-face.js: brows, eyes, mouth), a
 * face's expression as its ink draws it (Humanoid.setExpression: uMood, uMood2).
 */
export const LIVE_VECTORS = ['uBoxA', 'uTfBrowA', 'uTfBrowB', 'uTfEye', 'uTfMouth', 'uMood', 'uMood2', 'uRays', 'uDoor', 'uHoloA', 'uHoloB', 'uHoloC', 'uBreathe', 'uVeinBox', 'uSplatTime'];   // (uRays: a light's wash, its rays' clock: src/veil.js; uDoor: a way through's glow, src/door-light.js; uHoloA..C: a recording's figure, src/ship/hologram.js)
const LIVE_FROM_SPEC = LIVE_VECTORS.indexOf('uMood');
// (uBreathe: the Buried Machine's clock, src/breathe-shader.js; uVeinBox: where Lorn's vein map lies, src/lorn-veins.js; uSplatTime:
// the splats' clock, a number sent as (t, 0, 0, 0), src/splat-decal.js; issue #264)
const liveVec = (v) => (v?.isVector4 ? v : typeof v === 'number' ? (LIVE_NUM.x = v, LIVE_NUM) : null);
const LIVE_NUM = { x: 0, y: 0, z: 0, w: 0 };

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
   * @param o.noticed  with stillMatrices, the notices on (engine/mirror-notices.js): a drawable looked at in full only when
   *   something of it was rewritten (its geometry, an attribute, a hook, its material), its materials' values read
   *   every frame, its matrix compared only when the list or a walk says it may have moved (issue #455)
   */
  constructor(backend, { forgetAfter = 120, filter = null, materialSpec = inkSpec, castsShadow = null, freeze = false, quietWalk = false, listMatrices = false, stillMatrices = false, skipHidden = false, noticed = false } = {}) {
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
    // (what the frame's work was against what changed, summed over the profile's frames: the bench's -split, issue #455)
    this.census = newCensus();
    this.profiling = false;
    this.freeze = freeze && !filter;
    this.listMatrices = listMatrices;
    this.stillMatrices = stillMatrices && listMatrices;
    this.skipHidden = skipHidden && listMatrices;
    if (this.stillMatrices) WORLD_STAMP.on = true;
    this.noticed = noticed && this.stillMatrices && !filter && !this.freeze && noticesOn();
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
    // (a backend's shapeAttrs may move with them too: the Unity bridge's aObjP / aObjN, the banners' own frame, issue
    // #113; vertices() is told, and answers false when what it drew needs them, for the whole geometry again)
    const extra = this.backend.shapeAttrs ?? null;
    if (g && this.backend.vertices && sameShape(geo, g, extra)) {
      const was = g.versions, now = versionsOf(geo);
      const A = geo.attributes;
      let moved = null;
      if (extra) for (const k of extra) if (now[k] !== was[k]) (moved ??= []).push(k);
      const col = A.color && now.color !== was.color ? { array: plain(A.color), itemSize: A.color.itemSize, normalized: A.color.normalized } : null;
      if (this.backend.vertices(g.gid, plain(A.position), A.normal ? plain(A.normal) : null, A.position.count, A.aAlpha ? plain(A.aAlpha) : null, col, moved) !== false) {
        g.version = version; g.versions = now;
        this.stats.vertexUpdates = (this.stats.vertexUpdates ?? 0) + 1;
        return g.gid;
      }
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

  /**
   * A material's colour and glow as last sent (once a frame, however many drawables use it): told when they moved.
   * Which of its uniforms can move (colour, glow or wash, the live vectors, the fluid, a temple skin) and their holders
   * (the { value } objects) are kept on it and looked up again every 64 frames (or when its uniforms are another
   * object): a material is read every frame a drawable shows it, and most hold none of the vectors (issue #455).
   */
  _live(m, f) {
    if (m.__mirrorLiveF === f) return;
    m.__mirrorLiveF = f;
    this.census.live++;
    const U = m.uniforms;
    let R = m.__mirrorRec;
    if (R === undefined || f - R.at >= 64 || R.of !== U) R = m.__mirrorRec = liveRecord(m, U, f, this.backend.materialVec ? LIVE_VECTORS.length : 0);
    // (a see-through surface's wash, src/veil.js: its alpha goes as its glow, LightShaft.fade moving it)
    const c = R.col !== null ? R.col.value : undefined, g = R.glow !== null ? R.glow.value : R.wash !== null && R.wash.value?.isVector3 ? R.wash.value.x : undefined;
    // the vectors that move every frame (LIVE_VECTORS: a makers' box's ray and clock, the coral-shirt traveller's drawn face)
    const VW = R.vw;
    for (let k = 0; k < VW.length; k++) {
      const w = VW[k], A = liveVec(R.vh[k].value);
      if (!A) continue;
      // (a face's mood starts as the material was sent with it: only its moves go; the others once as they are)
      const L2 = (m.__mirrorVec ??= {})[w] ??= w >= LIVE_FROM_SPEC ? Float32Array.of(A.x, A.y, A.z, A.w) : new Float32Array(4).fill(NaN);
      if (L2[0] === Math.fround(A.x) && L2[1] === Math.fround(A.y) && L2[2] === Math.fround(A.z) && L2[3] === Math.fround(A.w)) continue;
      L2[0] = A.x; L2[1] = A.y; L2[2] = A.z; L2[3] = A.w;
      const mid = this.mats.get(m);
      m.__mirrorMovedAt = f;
      if (mid) this.backend.materialVec(mid, w, [A.x, A.y, A.z, A.w]);
    }
    // Lorn's vein map (lorn-veins.js: baked after the water is made, bound to it then): the texture sent and named on the
    // material when it is bound (backend.materialTexture; issue #264)
    const vt = R.vein !== null ? R.vein.value : null;
    if (vt?.isTexture && vt !== m.__mirrorVeinMap && this.backend.materialTexture) {
      const mid = this.mats.get(m);
      if (mid) { m.__mirrorVeinMap = vt; this.backend.materialTexture(mid, 'veins', vt); }
    }
    // the traveller's fluid (fluid-tool.js): its fill, tones and clock move every frame it flows
    if (R.fluid && this.backend.materialFluid) {
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
    // a temple skin's uniforms (src/temples/skins/skin-shader.js: a bell ringing, a lamp lit), looked at every other time
    // (by the material's own count, not the frame's)
    if (R.skin && this.backend.materialSkin && ((m.__mirrorSkinN = (m.__mirrorSkinN ?? -1) + 1) & 1) === 0) {
      const S = m.__mirrorSkin, now = skinPatternSpec(m, this._skinScratch)?.data;
      if (now) {
        this._skinScratch = now;
        if (!S) m.__mirrorSkin = Float32Array.from(now);   // (as sent with the material)
        else {
          let moved = S.length !== now.length;
          for (let i = 0; !moved && i < now.length; i++) moved = S[i] !== now[i];
          if (moved) {
            m.__mirrorSkin = Float32Array.from(now);
            m.__mirrorMovedAt = f;
            const mid = this.mats.get(m);
            if (mid) this.backend.materialSkin(mid, m.__mirrorSkin);
          }
        }
      }
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
    const node = { id, object: o, matrix: new Float32Array(16).fill(NaN), shown: false, seen: -1, mw: -1, instVersion: -1, kind, geo: null, gv: -1, changedAt: this.frameNo, frozen: null, owner: this, dead: false, hook: undefined, matMovedAt: -1e9, touched: false, grec: null };
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
    const fromList = this.listMatrices ? updateSceneMatrices(scene, this.skipHidden, this.stillMatrices) : (scene.updateMatrixWorld(), false);
    camera?.updateMatrixWorld();
    const C = this.census, SL = this.listMatrices ? sceneList(scene) : null;
    if (SL) { C.listed += SL.n; C.listChanged += SL.nChanged; C.listStepped += SL.over; }
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
        this._wlNodes = new Array(L.n).fill(null);
      }
      const { objs, end, WE } = L, W = this._wlKind;
      // (still: the list ran this frame, so its `changed` says which world matrices it changed; a drawable it did not
      // change, that no walk outside it changed since the last frame (its node's stamp older than the last frame's) and
      // whose matrix was sent or compared last frame has the matrix it had: no need to compare its 16 numbers again)
      const ch = this.stillMatrices && fromList === true ? L.changed : null, old = stamp - 1;
      if (ch !== null && L.tracked === true) {
        // (and what the list read off each object this frame kept beside it: its visible, whether its matrices are the
        // walk's; each drawable's node kept beside it too, so a quiet drawable that did not move is not read at all:
        // only the mirror's own arrays and its node, issue #455)
        const { vis, auto } = L, ND = this._wlNodes;
        for (let i = 0, N = L.n; i < N; i++) {
          visited++;
          const v = vis[i];
          if (v === 0 || (v === 2 && !objs[i].visible)) { i = end[i] - 1; continue; }
          const w = W[i];
          if (w & 1) {
            drawn++;
            let node = ND[i];
            if (node === null || node.owner !== this || node.dead) {
              const o = objs[i];
              node = o.__mirror;
              if (!node || node.owner !== this || node.dead) node = this.nodes.get(this._create(o));
              ND[i] = node;
            }
            this._see(objs[i], WE[i], f, B, perSkeleton, liveMats, scene, camera, ch[i] === 0 ? old : 0, node, auto[i]);
          }
          if (w & 2) i = end[i] - 1;
        }
      } else {
        for (let i = 0, N = L.n; i < N; i++) {
          const o = objs[i];
          visited++;
          if (!o.visible) { i = end[i] - 1; continue; }
          const w = W[i];
          if (w & 1) { drawn++; this._see(o, WE[i], f, B, perSkeleton, liveMats, scene, camera, ch !== null && ch[i] === 0 ? old : 0); }
          if (w & 2) i = end[i] - 1;
        }
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
    C.drawn += drawn; C.sent += n; C.visited += visited;
    P.tail += now() - t; t = now();
    B.frame?.({ frame: f, stats: this.stats });
    P.frame += now() - t; P.frames++;
    return this.stats;
  }

  /**
   * One drawable reached by the walk this frame: made if new, shown, its geometry, hooks, materials' live values, shape
   * keys, world matrix (e: its elements), instances and bones told the backend as they change. nd: its node, when the
   * walk keeps it; auto: whether its matrices are the walk's, as the list read it this frame (-1: read it here).
   */
  _see(o, e, f, B, perSkeleton, liveMats, scene, camera, still = 0, nd = null, auto = -1) {
    let node = nd ?? o.__mirror;
    if (!node || node.owner !== this || node.dead) node = this.nodes.get(this._create(o));
    const id = node.id;
    // (its world matrix as last sent, without comparing: sent or compared last frame, unchanged by the list (still > 0),
    // no walk's stamp since the last frame's began, its matrices its own; every 8th frame compared anyway)
    // (noticed: none compared for safety's sake, every 8th frame; what can move it is all known)
    const noticed = this.noticed;
    const cand = still > 0 && node.seen === f - 1 && node.mw < still && (noticed || ((f + id) & 7) !== 0);
    let same = cand && (auto >= 0 ? auto === 1 : o.matrixAutoUpdate === true && o.matrixWorldAutoUpdate === true);
    if (cand && !same) this.census.ownMatrix++;   // (unchanged by the list, compared all the same: its matrix is its owner's)
    node.seen = f;
    // a drawable that has not changed for half a second (no move, geometry, shape key or material value, no render
    // hook, not skinned or instanced): its geometry, materials and keys looked at every 4th frame (staggered by its
    // id), its matrix every frame. ~3 000 objects are walked a frame and most stand still: each look touches a few
    // objects more, which on the Xbox's memory costs more than the arithmetic
    // noticed: its geometry and material read (two reads off the object), and looked at in full only when it has a hook
    // (or is skinned, instanced: node.hook) or shape keys, a hook was put on it (touched), its geometry is another or its
    // record stale (an attribute or the index rewritten), or it was never looked at (grec null)
    const geo0 = noticed ? o.geometry ?? null : null, mat0 = noticed ? o.material : null;
    const look = noticed
      ? node.hook !== false || node.touched || node.keys !== undefined || node.grec === null || node.grec.stale || geo0 !== node.geo
      : !this.quietWalk || node.hook !== false || f - node.changedAt <= QUIET_AFTER || f - (node.matMovedAt ?? -1e9) <= QUIET_AFTER || ((f + id) & 3) === 0;
    if (look) node.touched = false;
    // a geometry swapped or rewritten (cloth, a trail, a morph baked): sent again, and each node drawing it told
    // (read only when looked at: a quiet drawable is not touched; the kinds read below are never quiet)
    const geo = noticed ? geo0 : look ? o.geometry : null;
    if (look && geo && (geo !== node.geo || node.gv !== attrVersion(geo, f, noticed))) {
      this._full = false;
      const gid = this._geometry(geo);
      // (told only when it is another geometry or was sent whole again: moved points alone need nothing)
      if (node.geo && (geo !== node.geo || this._full)) B.geometryOf?.(id, gid);
      node.geo = geo; node.gv = this.geoms.get(geo).version; node.changedAt = f;
    }
    if (look && noticed) node.grec = geo?.__mirrorAttrs ?? NO_RECORD;
    // an object's own render hook (the crowd's tiers set their count in it; a face binds its keys): called as the
    // renderer would before drawing it, in the main pass (no override material)
    const hooked = look && ownHook(o, 'onBeforeRender');
    if (look) node.hook = hooked || node.kind === 'skinned' || node.kind === 'instanced' || node.kind === 'instgeo';
    if (hooked) {
      try { o.onBeforeRender(RENDERER_STUB, scene, camera, geo, o.material, null); } catch { /* a hook that wants a real renderer */ }
      // (a hook that moved it, through a walk of its own: compared after all, as the walk that compares every one would)
      if (noticed && same && node.mw >= still) same = false;
    }
    if (!node.shown) { node.shown = true; node.changedAt = f; B.visible?.(id, true); }
    if (noticed && liveMats && !look) {
      // (its materials' values every frame: nothing tells when a colour or a glow is written; read as the walk that looks
      // at everything reads them, at the first drawable of each in the list's order)
      const M = mat0;
      if (Array.isArray(M)) { for (let i = 0; i < M.length; i++) this._live(M[i], f); } else if (M) this._live(M, f);
    }
    if (look && liveMats) {
      const M = o.material;
      let moved = -1e9;
      if (Array.isArray(M)) { for (const m of M) { this._live(m, f); moved = Math.max(moved, m.__mirrorMovedAt ?? -1e9); } } else if (M) { this._live(M, f); moved = M.__mirrorMovedAt ?? -1e9; }
      node.matMovedAt = moved;
    }
    // ...and its after-hook once its material's values are read, as the renderer calls it after the draw: a hook that lends
    // its material a look for the draw (a foe's flash, foe-react.js installFlash) gives it back. (Never called before, a
    // struck foe stayed white and glowing in Unity, its flash laid on again every frame: issue #264)
    if (hooked && ownHook(o, 'onAfterRender')) { try { o.onAfterRender(RENDERER_STUB, scene, camera, geo, o.material, null); } catch { /* as above */ } }
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
    if (!same) { k = 0; while (k < 16 && m[k] === Math.fround(e[k])) k++; this.census.compared++; }
    // (looked at: for a hook (or skinned, instanced), or for anything else: noticed, a notice or another geometry; else
    // its recent change, or its turn in the quiet walk's every 4th frame)
    if (look) { const C = this.census; C.looked++; if (node.hook !== false) C.lookHook++; else if (noticed || f - node.changedAt <= QUIET_AFTER || f - (node.matMovedAt ?? -1e9) <= QUIET_AFTER) C.lookOther++; }
    if (k < 16) {
      for (k = 0; k < 16; k++) m[k] = e[k];
      node.changedAt = f;
      const n = this._moved++;
      if (n >= this._ids.length) this._grow();
      this._ids[n] = id; this._mats.set(m, n * 16);
    }
    if (node.kind === 'instanced') {
      const g = geo ?? o.geometry;
      // (and the per-instance attributes, as the crowd's figures carry their pose in: aAnim, aReact…)
      const ia = node.instAttrs ??= instancedAttributes(g);
      let v = o.instanceMatrix.version + (o.instanceColor?.version ?? 0) * 1e6 + o.count * 1e12;
      for (const k in ia) v += g.attributes[k].version * 1e3;
      if (v !== node.instVersion) {
        node.instVersion = v;
        let attrs = null;
        for (const k in ia) (attrs ??= {})[k] = { array: g.attributes[k].array, itemSize: g.attributes[k].itemSize };
        B.instances?.(id, o.count, o.instanceMatrix.array, o.instanceColor?.array ?? null, attrs, this.time);
      }
    }
    if (node.kind === 'instgeo') {
      const g = geo ?? o.geometry;
      // instances with no matrices (the grass): their attributes when they move (only the range rewritten), the count
      const ia = node.instAttrs ??= instancedAttributes(g);
      let v = g.instanceCount * 1e12;
      for (const k in ia) v += g.attributes[k].version * 1e3;
      if (v !== node.instVersion) {
        const first = node.instVersion === -1;
        node.instVersion = v;
        const attrs = {};
        node.sentAttr ??= {};
        for (const k in ia) {
          const a = g.attributes[k];
          if (!first && node.sentAttr[k] === a.version) continue;
          node.sentAttr[k] = a.version;
          const r = a.updateRanges?.length ? a.updateRanges.reduce((m, x) => [Math.min(m[0], x.start), Math.max(m[1], x.start + x.count)], [Infinity, -Infinity]) : null;
          attrs[k] = { array: a.array, itemSize: a.itemSize, version: a.version, range: !first && r ? [r[0], r[1] - r[0]] : null };
        }
        B.instances?.(id, g.instanceCount, null, null, attrs, this.time);
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
    // (a frame's average: objects in the list, their world matrices changed, stepped over hidden; walked, drawables
    // reached, looked at in full, matrices compared, matrices sent; materials whose live values were read)
    const C = this.census;
    out.census = {};
    for (const key in C) out.census[key] = +(C[key] / k).toFixed(1);
    this.census = newCensus();
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

const newCensus = () => ({ listed: 0, listChanged: 0, listStepped: 0, visited: 0, drawn: 0, looked: 0, lookHook: 0, lookOther: 0, compared: 0, ownMatrix: 0, sent: 0, live: 0 });

/**
 * A geometry's version: the sum of its attributes' versions (and its index's), times 64, plus how many
 * there are, so an attribute added or rewritten moves it. The attribute list is kept on the geometry
 * and looked at again every 32 frames (a for-in over every drawable's attributes each frame was most
 * of the walk). With the notices on (engine/mirror-notices.js) the record is marked stale when an attribute, the
 * index or the list is rewritten, and the list read afresh then (each attribute, its interleaved buffer, the index
 * knows the records it is in); noticed (the noticed mirror's): the version kept until it is.
 */
function attrVersion(geo, frame = -1, noticed = false) {
  let c = geo.__mirrorAttrs;
  if (noticed && c !== undefined && c.stale === false) return c.v;
  if (!c || frame < 0 || frame - c.at >= 32 || c.of !== geo.attributes || c.stale) {
    const list = [];
    for (const k in geo.attributes) if (!geo.attributes[k].isInstancedBufferAttribute) list.push(geo.attributes[k]);
    // (the record kept, its list made again: a notice marks the record it was given)
    if (!c) c = geo.__mirrorAttrs = { list, at: frame, of: geo.attributes, index: geo.index, epoch: 0, vf: undefined, v: 0, stale: true };
    else { c.epoch += c.index !== geo.index ? 1 : 0; c.list = list; c.at = frame; c.of = geo.attributes; c.index = geo.index; c.vf = undefined; }
    for (let i = 0; i < list.length; i++) inRecord(list[i].isInterleavedBufferAttribute ? list[i].data : list[i], c);
    if (geo.index) inRecord(geo.index, c);
  }
  // (a new index, setIndex: a new shape, whatever its version says)
  if (c.index !== geo.index) { c.index = geo.index; c.epoch++; if (geo.index) inRecord(geo.index, c); }
  else if (frame >= 0 && c.vf === frame && !c.stale) return c.v;   // (a geometry drawn by many: summed once a frame)
  let v = geo.index ? geo.index.version + 1 : 0;
  const L = c.list;
  // (an interleaved attribute, as glTF loads them, keeps its version on its buffer)
  for (let i = 0; i < L.length; i++) { const a = L[i]; v += (a.isInterleavedBufferAttribute ? a.data.version : a.version) ?? 0; }
  c.vf = frame; c.stale = false;
  return (c.v = (v * 64 + L.length) + c.epoch * 1e12);
}
/** The record an attribute's notices go to (engine/mirror-notices.js attrTouched), with the notices on. */
const inRecord = (a, c) => { if (noticesOn()) attrIn(a, c); };

// (three's Skeleton.update from the bones' element arrays: src/skeleton-update.js, the web game's too)
export { skeletonUpdate };

/**
 * What of a material's uniforms the mirror reads each frame (SceneMirror._live): the colour's, glow's and wash's
 * holders, the live vectors it has (vw: their LIVE_VECTORS indices, vh: their holders; nv 0: none looked for), whether it
 * has the fluid's and a temple skin's.
 */
function liveRecord(m, U, f, nv) {
  const R = { at: f, of: U, col: U?.uColor ?? null, glow: null, wash: null, vw: [], vh: [], fluid: !!(U?.uFluidA && U.uFluidTones), skin: !!m.userData?.skinPattern, vein: U?.uVeinMap ?? null };
  if (U?.uGlow) R.glow = U.uGlow; else if (U?.uWash) R.wash = U.uWash;
  if (U) for (let w = 0; w < nv; w++) { const h = U[LIVE_VECTORS[w]]; if (liveVec(h?.value)) { R.vw.push(w); R.vh.push(h); } }
  return R;
}

/** The geometry record of a drawable without one (never stale). */
const NO_RECORD = Object.freeze({ stale: false });

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
function sameShape(geo, g, extra = null) {
  const was = g.versions, now = versionsOf(geo);
  if (!was || now.__index !== was.__index || now.__indexRef !== was.__indexRef || now.__count !== was.__count) return false;
  const keys = Object.keys(now);
  if (keys.length !== Object.keys(was).length) return false;
  for (const k of keys) if (now[k] !== was[k] && k !== 'position' && k !== 'normal' && k !== 'aAlpha' && k !== 'color' && !extra?.includes(k)) return false;
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
