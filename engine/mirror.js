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
//   create(id, node)            a drawable appears: { kind, gid, mids, name, ... }
//   transforms(ids, mats, n)    the world matrices that moved, packed: n ids, 16 floats each
//   visible(id, on)             shown / hidden (an ancestor hidden or the object left the scene)
//   instances(id, count, mats, colors)   an InstancedMesh's instances, when they change
//   bones(id, mats, n)          a SkinnedMesh's bone matrices (bone world × inverse bind), each frame it is seen
//   remove(id)                  gone for good (not in the scene for `forgetAfter` frames)
//   camera(c)                   { world: 16 floats, fov, near, far, aspect }
//   frame(f)                    once a frame, last: { sunDir, time, stats }
//
// Ids are small integers, given in the order things are first seen; the backend keeps whatever it
// made for them. Every array handed over is the mirror's own (or the geometry's): a backend that
// keeps one must copy it.
import { inkSpec } from './ink-spec.js';

const DRAWABLE = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;

export class SceneMirror {
  /**
   * @param backend  the engine side (see above); missing methods are skipped
   * @param o.forgetAfter  frames an object may be out of the scene before it is removed
   * @param o.filter (o) => false to leave an object (and its children) out
   */
  constructor(backend, { forgetAfter = 120, filter = null, materialSpec = inkSpec } = {}) {
    this.backend = backend;
    this.forgetAfter = forgetAfter;
    this.filter = filter;
    this.materialSpec = materialSpec;
    this.ids = new WeakMap();          // Object3D → id
    this.nodes = new Map();            // id → { object, matrix: Float32Array(16), shown, seen, instVersion }
    this.geoms = new WeakMap();        // BufferGeometry → { gid, version }
    this.mats = new WeakMap();         // Material → mid
    this.nextId = 1; this.nextGeo = 1; this.nextMat = 1;
    this.frameNo = 0;
    this._ids = new Int32Array(256);
    this._mats = new Float32Array(256 * 16);
    this._cam = new Float32Array(16);
    this.stats = { nodes: 0, drawn: 0, moved: 0, geometries: 0, materials: 0, uploadedBytes: 0, skipped: 0 };
  }

  _geometry(geo) {
    let g = this.geoms.get(geo);
    const version = attrVersion(geo);
    if (g && g.version === version) return g.gid;
    if (!g) { g = { gid: this.nextGeo++, version }; this.geoms.set(geo, g); this.stats.geometries++; }
    g.version = version;
    const a = geo.attributes;
    const out = { groups: geo.groups.length ? geo.groups.map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex ?? 0 })) : null, attributes: {} };
    for (const [name, attr] of Object.entries(a)) {
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

  _create(o) {
    const id = this.nextId++;
    this.ids.set(o, id);
    const kind = o.isSkinnedMesh ? 'skinned' : o.isInstancedMesh ? 'instanced' : o.isMesh ? 'mesh' : o.isPoints ? 'points' : o.isLine ? (o.isLineSegments ? 'segments' : 'line') : 'sprite';
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const node = { object: o, matrix: new Float32Array(16).fill(NaN), shown: false, seen: -1, instVersion: -1, kind };
    this.nodes.set(id, node);
    this.stats.nodes++;
    const desc = { kind, name: o.name || '', gid: o.geometry ? this._geometry(o.geometry) : 0, mids: mats.map((m) => (m ? this._material(m) : 0)), renderOrder: o.renderOrder ?? 0 };
    if (o.isSkinnedMesh) desc.bones = o.skeleton?.bones.length ?? 0;
    if (o.isInstancedMesh) desc.capacity = o.instanceMatrix.count;
    this.backend.create?.(id, desc, o);
    return id;
  }

  /** One frame: everything that changed since the last one. Call after the game's update. */
  sync(scene, camera) {
    const f = ++this.frameNo;
    scene.updateMatrixWorld();
    camera?.updateMatrixWorld();
    let n = 0, drawn = 0;
    const visit = (o) => {
      if (!o.visible) return;
      if (this.filter && this.filter(o) === false) { return; }
      if (DRAWABLE(o)) {
        let id = this.ids.get(o);
        if (!id) id = this._create(o);
        const node = this.nodes.get(id);
        node.seen = f;
        drawn++;
        // geometry swapped or rewritten (a re-uploaded attribute, a morph baked)
        if (o.geometry) { const g = this.geoms.get(o.geometry); if (!g || g.version !== attrVersion(o.geometry)) { const gid = this._geometry(o.geometry); this.backend.geometryOf?.(id, gid); } }
        if (!node.shown) { node.shown = true; this.backend.visible?.(id, true); }
        const e = o.matrixWorld.elements, m = node.matrix;
        let moved = false;
        for (let k = 0; k < 16; k++) if (m[k] !== e[k]) { moved = true; break; }
        if (moved) {
          for (let k = 0; k < 16; k++) m[k] = e[k];
          if (n >= this._ids.length) this._grow();
          this._ids[n] = id; this._mats.set(m, n * 16); n++;
        }
        if (o.isInstancedMesh) {
          const v = o.instanceMatrix.version + (o.instanceColor?.version ?? 0) * 1e6 + o.count * 1e12;
          if (v !== node.instVersion) { node.instVersion = v; this.backend.instances?.(id, o.count, o.instanceMatrix.array, o.instanceColor?.array ?? null); }
        }
        if (o.isSkinnedMesh && o.skeleton) {
          o.skeleton.update();   // boneMatrices = bone world × inverse bind (three's own)
          this.backend.bones?.(id, o.skeleton.boneMatrices, o.skeleton.bones.length, o.bindMatrix.elements);
        }
      }
      const ch = o.children;
      for (let i = 0; i < ch.length; i++) visit(ch[i]);
    };
    visit(scene);
    if (n) this.backend.transforms?.(this._ids, this._mats, n);
    // what was not reached: hidden, and in time forgotten
    for (const [id, node] of this.nodes) {
      if (node.seen === f) continue;
      if (node.shown) { node.shown = false; this.backend.visible?.(id, false); }
      if (f - node.seen > this.forgetAfter && !inScene(node.object, scene)) { this.backend.remove?.(id); this.nodes.delete(id); this.ids.delete(node.object); this.stats.nodes--; }
    }
    if (camera) {
      this._cam.set(camera.matrixWorld.elements);
      this.backend.camera?.({ world: this._cam, fov: camera.fov, near: camera.near, far: camera.far, aspect: camera.aspect, zoom: camera.zoom ?? 1 });
    }
    this.stats.drawn = drawn; this.stats.moved = n;
    this.backend.frame?.({ frame: f, stats: this.stats });
    return this.stats;
  }

  _grow() {
    const ids = new Int32Array(this._ids.length * 2); ids.set(this._ids); this._ids = ids;
    const mats = new Float32Array(this._mats.length * 2); mats.set(this._mats); this._mats = mats;
  }

  /** The id an object was given (0 if it was never drawn). */
  idOf(o) { return this.ids.get(o) ?? 0; }
}

function attrVersion(geo) {
  // (the sum of the versions, and how many there are: an attribute added or rewritten moves it)
  let v = geo.index ? geo.index.version + 1 : 0, n = 0;
  for (const k in geo.attributes) { v += geo.attributes[k].version; n++; }
  return v * 64 + n;
}

function inScene(o, scene) { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; }

function deinterleave(attr) {
  const out = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k);
  return out;
}
