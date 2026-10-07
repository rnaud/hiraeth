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


/** What a render hook is handed for the renderer: nothing it can draw with (hooks here read the scene, not it). */
const RENDERER_STUB = Object.freeze({ isWebGLRenderer: false, info: { render: { frame: 0 } } });

export class SceneMirror {
  /**
   * @param backend  the engine side (see above); missing methods are skipped
   * @param o.forgetAfter  frames an object may be out of the scene before it is removed
   * @param o.filter (o) => false to leave an object (and its children) out
   */
  constructor(backend, { forgetAfter = 120, filter = null, materialSpec = inkSpec, castsShadow = null } = {}) {
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
    this.time = 0;            // the game's clock (sharedUniforms.uTime), set before sync: handed to instances()   // (the bones' share timed apart: costs a clock read a skinned mesh)
  }

  _geometry(geo) {
    let g = this.geoms.get(geo);
    const version = attrVersion(geo, -1);   // (the list read afresh: an upload is rare)
    if (g && g.version === version) return g.gid;
    // only the points and their normals moved (cloth: the capes, banners, a trail), the same count and
    // triangles: those go alone, in the frame (a backend with vertices()), not the whole geometry again
    if (g && this.backend.vertices && sameShape(geo, g)) {
      g.version = version; g.versions = versionsOf(geo);
      const A = geo.attributes;
      this.backend.vertices(g.gid, plain(A.position), A.normal ? plain(A.normal) : null, A.position.count, A.aAlpha ? plain(A.aAlpha) : null);
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

  _create(o) {
    const id = this.nextId++;
    this.ids.set(o, id);
    const kind = o.isSkinnedMesh ? 'skinned' : o.isInstancedMesh ? 'instanced' : o.isMesh && isInstGeo(o.geometry) ? 'instgeo' : o.isMesh ? 'mesh' : o.isPoints ? 'points' : o.isLine ? (o.isLineSegments ? 'segments' : 'line') : 'sprite';
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const node = { id, object: o, matrix: new Float32Array(16).fill(NaN), shown: false, seen: -1, instVersion: -1, kind, geo: null, gv: -1 };
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
    scene.updateMatrixWorld();
    camera?.updateMatrixWorld();
    P.matrices += now() - t; t = now();
    let n = 0, drawn = 0, tb = 0;
    const B = this.backend, perSkeleton = !!B.skeleton, filter = this.filter;
    // (an explicit stack, not a recursive closure: ~3 000 objects a frame in the desert)
    const stack = this._stack; stack.length = 0; stack.push(scene);
    let visited = 0;
    while (stack.length) {
      const o = stack.pop();
      visited++;
      if (!o.visible) continue;
      if (filter && filter(o) === false) continue;
      if (o.isMesh || o.isPoints || o.isLine || o.isSprite) {
        let node = o.__mirror;
        if (!node || this.nodes.get(node.id) !== node) node = this.nodes.get(this._create(o));
        const id = node.id;
        node.seen = f;
        drawn++;
        // a geometry swapped or rewritten (cloth, a trail, a morph baked): sent again, and each node drawing it told
        const geo = o.geometry;
        if (geo && (geo !== node.geo || node.gv !== attrVersion(geo, f))) {
          this._full = false;
          const gid = this._geometry(geo);
          // (told only when it is another geometry or was sent whole again: moved points alone need nothing)
          if (node.geo && (geo !== node.geo || this._full)) B.geometryOf?.(id, gid);
          node.geo = geo; node.gv = this.geoms.get(geo).version;
        }
        // an object's own render hook (the crowd's tiers set their count in it; a face binds its keys): called as the
        // renderer would before drawing it, in the main pass (no override material)
        if (Object.prototype.hasOwnProperty.call(o, 'onBeforeRender')) { try { o.onBeforeRender(RENDERER_STUB, scene, camera, geo, o.material, null); } catch { /* a hook that wants a real renderer */ } }
        if (!node.shown) { node.shown = true; B.visible?.(id, true); }
        const e = o.matrixWorld.elements, m = node.matrix;
        // (compared as the floats they are sent as: a double that floats can't hold is no move)
        let k = 0;
        while (k < 16 && m[k] === Math.fround(e[k])) k++;
        if (k < 16) {
          for (k = 0; k < 16; k++) m[k] = e[k];
          if (n >= this._ids.length) this._grow();
          this._ids[n] = id; this._mats.set(m, n * 16); n++;
        }
        if (o.isInstancedMesh) {
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
        if (o.isSkinnedMesh && o.skeleton) {
          // (timed only when profiling: in Puerts the clock is a call into C#, ~5 µs each)
          const t0 = this.profiling ? now() : 0;
          const sk = o.skeleton;
          if (perSkeleton && o.bindMode !== 'detached') {
            // once a frame a skeleton, however many meshes it moves (a person's body, eyes, brows, hair)
            if (sk.__mirrorFrame !== f) { sk.__mirrorFrame = f; sk.update(); B.skeleton(this._skeletonId(sk), sk.boneMatrices, sk.bones.length); }
          } else {
            if (sk.__mirrorFrame !== f) { sk.__mirrorFrame = f; sk.update(); }   // boneMatrices = bone world × inverse bind (three's own)
            B.bones?.(id, sk.boneMatrices, sk.bones.length, o.bindMatrix.elements, o.bindMatrixInverse.elements);
          }
          if (this.profiling) tb += now() - t0;
        }
      }
      const ch = o.children;
      for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
    }
    P.walk += now() - t - tb; P.bones += tb; t = now();
    if (n) B.transforms?.(this._ids, this._mats, n);
    // what was not reached: hidden, and in time forgotten
    for (const [id, node] of this.nodes) {
      if (node.seen === f) continue;
      if (node.shown) { node.shown = false; B.visible?.(id, false); }
      if (f - node.seen > this.forgetAfter && !inScene(node.object, scene)) { B.remove?.(id); this.nodes.delete(id); this.ids.delete(node.object); if (node.object.__mirror === node) node.object.__mirror = null; this.stats.nodes--; }
    }
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

  /** The time the mirror spent (ms a frame, averaged since the last call): the matrices, the walk, the bones, the rest, the backend's frame. */
  profile() {
    const P = this.prof, k = Math.max(P.frames, 1), out = {};
    for (const key of ['matrices', 'walk', 'bones', 'tail', 'frame']) out[key] = +(P[key] / k).toFixed(3);
    out.frames = P.frames;
    this.prof = { matrices: 0, walk: 0, bones: 0, tail: 0, frame: 0, frames: 0 };
    return out;
  }

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
  let v = geo.index ? geo.index.version + 1 : 0;
  const L = c.list;
  // (an interleaved attribute, as glTF loads them, keeps its version on its buffer)
  for (let i = 0; i < L.length; i++) { const a = L[i]; v += (a.isInterleavedBufferAttribute ? a.data.version : a.version) ?? 0; }
  return (v * 64 + L.length) + c.epoch * 1e12;
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
  for (const k of keys) if (now[k] !== was[k] && k !== 'position' && k !== 'normal' && k !== 'aAlpha') return false;
  return now.position !== was.position || now.normal !== was.normal || now.aAlpha !== was.aAlpha;
}
const plain = (a) => (a.isInterleavedBufferAttribute ? deinterleave(a) : a.array);

function inScene(o, scene) { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; }

function deinterleave(attr) {
  const out = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k);
  return out;
}
