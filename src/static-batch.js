import * as THREE from 'three';
import { VERTEX_UNIFORMS } from './vertex-material.js';

// ---------------------------------------------------------------------------
// The world's still meshes drawn by a few batches (docs/systems/xbox.md, "Towards 60 on the Xbox").
//
// On the Xbox every WebGL call costs the main thread about 5 µs, and a draw about 40 µs all told (three.js's work for
// it and its calls). The desert's spawn drew ~600 meshes in the G-buffer and ~400 in the near shadow map, most of them
// props and buildings that never move, in ~480 materials of ~25 programs. Once the world is built, those meshes are
// drawn by batches instead (THREE.BatchedMesh, one multi-draw call each, WEBGL_multi_draw):
//
// - **The view (G-buffer)**: one batch for each group of materials that differ only in the values the surface shader
//   can read per mesh (VARIES: the three colours and flat shading; every other uniform, the
//   defines and the state equal: restKey), and the same vertex attributes. Each mesh's vertices carry its id
//   (aBatchId); the surface shader (materials.js USE_BATCHING, S_BATCH) reads its matrixWorld and its material's
//   values from two textures shared by every batch, and uses the matrix as an instance's, so modelMatrix × it is the
//   mesh's own matrixWorld and the shader sees what it saw (vObjPos, the scale, the facet normals; the values exact
//   floats). Each pass, a batch draws the meshes that would have drawn themselves: shown (every parent visible: the
//   cullers hide them as before), in the camera's frustum, in their current geometry (a level of detail swapped in by
//   lod.js is copied in the first time it is drawn), front to back as three sorts them; touching ranges merged.
// - **The shadow maps**: one batch of every still mesh (positions only, the same ids), drawn after each cascade's own
//   pass with a depth material doing what the passes' override does (DoubleSide, depth only), with the visibility the
//   shadow culler and the cascades' rules give each mesh for that pass. A material's few still meshes, too few for a
//   view batch, draw themselves in the view and cast through this one (their layers off for the shadow passes only).
//
// The meshes stay in the scene, where every system finds them (cullers, levels of detail, physics, rays): only their
// layers are off, so the passes skip them (as part-batch.js does). What the batches copied is checked each frame: a
// mesh that moves is followed (its matrix written again); one that moves a third time, gets another material, or
// whose material's values change beyond the varying ones, goes back to drawing itself for good (changes of the
// varying ones are written to the texture). `statics.enabled = false` gives every mesh its own draws back.
//
// Taken: plain meshes (not skinned, instanced or batched) in the surface material (userData.surface), opaque, one
// material, no morphs, the default draw range, frustum-culled, no onBeforeRender of their own, nothing flagged
// dynamic or noBatch, not under a mover (`keep`: the traveller, people, vehicles). Materials with defines beyond the
// surface's own features (a sway, a crowd, the fluid's march, face keys…) or hooks of their own are left out.
// ---------------------------------------------------------------------------

/** The surface's own defines (materials.js surfaceFeatures): a material with any other is left out. */
const SURFACE_DEFINE = /^(SURFACE_SPEC|S_[A-Z_]+|METAL|METAL_BRUSHED|LAMP_TINT|NIGHT_PAINT)$/;
/** The uniforms read per mesh in a view batch (materials.js S_BATCH, as S_VMAT's: vertex-material.js). */
export const VARIES = ['uColor', 'uColor2', 'uColor3', 'uFlat'];
/** The id attribute's name (materials.js USE_BATCHING). */
export const BATCH_ID = 'aBatchId';
/** In how many frames every material a batch copied has been compared whole (StaticBatches.update). */
const ROUNDS = 8;
const _frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _v = new THREE.Vector3();

/** Why this mesh can't be drawn by a static batch ('' if it can, before the movers are judged). */
export function staticReason(o) {
  if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isBatchedMesh || o.isPoints || o.isLine) return 'kind';
  const m = o.material, g = o.geometry, ud = o.userData;
  if (!m || Array.isArray(m)) return 'materials';
  if (!m.userData?.surface) return 'not surface';
  if (m.transparent || m.allowOverride === false || m.visible === false || m.wireframe) return 'material state';
  if (m.onBeforeRender !== THREE.Material.prototype.onBeforeRender || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return 'material hooks';
  for (const k of Object.keys(m.defines ?? {})) if (!SURFACE_DEFINE.test(k)) return 'define ' + k;
  if (!g?.attributes?.position || Object.keys(g.morphAttributes).length) return 'geometry';
  if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return 'draw range';
  for (const x of Object.values(g.attributes)) if (x.isInterleavedBufferAttribute || x.isInstancedBufferAttribute) return 'attributes';
  if (g.attributes[BATCH_ID]) return 'attributes';
  if (!o.frustumCulled) return 'unculled';
  if (ud.dynamic || ud.noBatch || ud.batch) return 'flagged';
  if (o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return 'onBeforeRender';
  return '';
}
/** Could this mesh be drawn by a static batch (before the movers are judged)? */
export const staticCandidate = (o) => staticReason(o) === '';

/** The attributes a geometry carries, as a key: meshes share a batch only with the same ones (BatchedMesh). */
export function attributeKey(g) {
  return Object.keys(g.attributes).sort().map((k) => { const a = g.attributes[k]; return `${k}:${a.itemSize}:${a.normalized ? 1 : 0}:${a.array.constructor.name}`; }).join(',') + (g.index ? '|i' : '');
}

const valueKey = (v) => (v === null || v === undefined ? 'n' : v.isTexture ? 't' + v.uuid : v.toArray ? v.toArray().join(',')
  : Array.isArray(v) ? v.map(valueKey).join(';') : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** What of a material must agree for its meshes to share a view batch with another's: all but the varying values. */
export function restKey(m) {
  // (merged meshes, S_VMAT, carry their own values per vertex already: theirs share a batch when everything else agrees,
  //  each merged group of the City-Shaft's towers a draw and a material of its own before, issue #111)
  const vary = m.defines?.S_VMAT ? VERTEX_UNIFORMS : VARIES;
  const u = Object.entries(m.uniforms ?? {}).filter(([k]) => !vary.includes(k)).map(([k, x]) => k + '=' + valueKey(x.value));
  return [m.defines?.S_VMAT ? 'vmat' : '', JSON.stringify(m.defines ?? {}), m.side, m.depthWrite, m.depthTest, m.depthFunc, m.blending, m.colorWrite,
    m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.vertexColors, m.alphaTest, m.vertexShader.length, m.fragmentShader.length, ...u].join('|');
}

/** Is `o` shown, all its parents visible up to `root` (and still under it)? */
export function shownUnder(o, root) {
  for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === root) return true; }
  return false;
}

const compacted = new WeakMap();
/**
 * An indexed geometry with only the vertices its index uses (the world's tiles share one mesh's vertices, each tile
 * drawing a part of them: copied whole, the desert's batches held 82 million vertices). Kept per geometry.
 */
export function compact(src) {
  if (!src.index) return src;
  let c = compacted.get(src);
  if (c) return c;
  const idx = src.index.array, n = src.attributes.position.count, remap = new Int32Array(n).fill(-1);
  let used = 0;
  for (let i = 0; i < idx.length; i++) if (remap[idx[i]] < 0) remap[idx[i]] = used++;
  if (used === n) { compacted.set(src, src); return src; }
  c = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(src.attributes)) {
    const s = a.itemSize, out = new a.array.constructor(used * s), from = a.array;
    for (let v = 0; v < n; v++) { const r = remap[v]; if (r >= 0) for (let j = 0; j < s; j++) out[r * s + j] = from[v * s + j]; }
    c.setAttribute(k, new THREE.BufferAttribute(out, s, a.normalized));
  }
  const ix = new (used > 65535 ? Uint32Array : Uint16Array)(idx.length);
  for (let i = 0; i < idx.length; i++) ix[i] = remap[idx[i]];
  c.setIndex(new THREE.BufferAttribute(ix, 1));
  compacted.set(src, c);
  return c;
}

/** A copy of a geometry for a batch: the attributes named (or all), an index if the batch has one, the id per vertex. */
export function batchCopy(geometry, id, names = null, indexed = !!geometry.index) {
  const src = compact(geometry);
  const g = new THREE.BufferGeometry();
  for (const k of names ?? Object.keys(src.attributes)) g.setAttribute(k, src.attributes[k]);
  const n = src.attributes.position.count;
  if (src.index) g.setIndex(src.index);
  else if (indexed) { const ix = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  g.setAttribute(BATCH_ID, new THREE.BufferAttribute(new Float32Array(n).fill(id), 1));
  return g;
}

// ------------------------------------------------------------------ the values a material holds, as numbers
/** Every number in a uniform's value, appended to `out` (textures by their id): to see that it changed. */
export function numbersOf(v, out) {
  if (v === null || v === undefined) out.push(NaN);
  else if (typeof v === 'number') out.push(v);
  else if (typeof v === 'boolean') out.push(v ? 1 : 0);
  else if (v.isTexture) out.push(v.id, v.version);
  else if (v.isColor) out.push(v.r, v.g, v.b);
  else if (v.isVector2) out.push(v.x, v.y);
  else if (v.isVector3) out.push(v.x, v.y, v.z);
  else if (v.isVector4 || v.isQuaternion) out.push(v.x, v.y, v.z, v.w);
  else if (v.isMatrix3 || v.isMatrix4) for (const x of v.elements) out.push(x);
  else if (Array.isArray(v) || ArrayBuffer.isView(v)) for (const x of v) numbersOf(x, out);
  else out.push(NaN);
  return out;
}

/** Watches what of a material a batch copied: its non-shared uniforms and its varying values. */
class Watch {
  constructor(m, shared) {
    this.m = m;
    this.keys = Object.keys(m.uniforms).filter((k) => !shared.has(k) && !VARIES.includes(k));
    this.rest = this.snap(this.keys);
    this.vary = this.snap(VARIES);
    this.dirty = false;
    this.listen();
  }
  /** A number or flag set on one of its uniforms marks it at once (an accessor on the uniform); what changes inside an
   *  object (a vector set in place) is found by the rounds of holds() (StaticBatches.update). */
  listen() {
    for (const k of this.keys) {
      const u = this.m.uniforms[k];
      if (u?.__watches) { u.__watches.add(this); continue; }
      const d = u && Object.getOwnPropertyDescriptor(u, 'value');
      if (!d || !('value' in d) || (d.value !== null && typeof d.value === 'object')) continue;
      let v = d.value;
      const ws = u.__watches = new Set([this]);
      Object.defineProperty(u, 'value', { get: () => v, set: (x) => { if (x !== v) for (const w of ws) w.dirty = true; v = x; }, enumerable: true, configurable: true });
      Object.defineProperty(u, '__watches', { enumerable: false });
    }
  }
  snap(keys) { const out = []; for (const k of keys) numbersOf(this.m.uniforms[k]?.value, out); return Float64Array.from(out); }
  /** Do the material's uniforms `keys` still hold the numbers `snap` took (no allocation: every frame)? */
  holds(keys, snap) {
    const U = this.m.uniforms;
    let i = 0;
    const eq = (x) => { const s = snap[i++]; return x === s || (x !== x && s !== s); };
    const walk = (v) => {
      if (typeof v === 'number') return eq(v);
      if (v === null || v === undefined) return eq(NaN);
      if (typeof v === 'boolean') return eq(v ? 1 : 0);
      if (v.isTexture) return eq(v.id) && eq(v.version);
      if (v.isColor) return eq(v.r) && eq(v.g) && eq(v.b);
      if (v.isVector2) return eq(v.x) && eq(v.y);
      if (v.isVector3) return eq(v.x) && eq(v.y) && eq(v.z);
      if (v.isVector4 || v.isQuaternion) return eq(v.x) && eq(v.y) && eq(v.z) && eq(v.w);
      if (v.isMatrix3 || v.isMatrix4) { for (const x of v.elements) if (!eq(x)) return false; return true; }
      if (Array.isArray(v) || ArrayBuffer.isView(v)) { for (const x of v) if (!walk(x)) return false; return true; }
      return eq(NaN);
    };
    for (const k of keys) if (!walk(U[k]?.value)) return false;
    return i === snap.length;
  }
  static same(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(a[i] !== a[i] && b[i] !== b[i])) return false; return true; }
}

// ------------------------------------------------------------------ the shared textures
/** The still meshes' matrices and their materials' varying values (4 texels each: 3 used), by id. */
class Tables {
  constructor(n) {
    const side = (texels) => Math.max(4, Math.ceil(Math.sqrt(texels) / 4) * 4);
    const sm = side(n * 4), sv = side(n * 4);
    this.matrices = new THREE.DataTexture(new Float32Array(sm * sm * 4), sm, sm, THREE.RGBAFormat, THREE.FloatType);
    this.values = new THREE.DataTexture(new Float32Array(sv * sv * 4), sv, sv, THREE.RGBAFormat, THREE.FloatType);
  }
  setMatrix(id, m) { this.matrices.image.data.set(m.elements, id * 16); this.matrices.needsUpdate = true; }
  setValues(id, mat) {
    const U = mat.uniforms, d = this.values.image.data, at = id * 16;
    const c = (k, j) => { const x = U[k].value; d[at + j] = x.r; d[at + j + 1] = x.g; d[at + j + 2] = x.b; };
    c('uColor', 0);
    c('uColor2', 4);
    c('uColor3', 8); d[at + 11] = U.uFlat.value;
    this.values.needsUpdate = true;
  }
}

const vertsOf = (g) => compact(g).attributes.position.count;   // (what a copy takes: compact)
const indicesOf = (g) => { const c = compact(g); return c.index ? c.index.count : c.attributes.position.count; };

/** A batch of still meshes: entries { o, id, … }; `want(e)` says whether a pass draws one. */
class StillBatch extends THREE.BatchedMesh {
  constructor(entries, material, owner, { names = null, indexed, room = 1.3 } = {}) {
    let verts = 0, idx = 0;
    for (const e of entries) { verts += vertsOf(e.o.geometry); idx += indicesOf(e.o.geometry); }
    // (room for the levels of detail lod.js swaps in: each coarser than the full mesh)
    super(entries.length, Math.ceil(verts * room) + 16, Math.ceil(idx * room) + 48, material);
    this.owner = owner; this.names = names; this.indexed = indexed;
    this._matricesTexture.dispose();
    this._matricesTexture = owner.tables.matrices;   // (one texture for every batch: bound once, not again at each)
    this.perObjectFrustumCulled = false; this.sortObjects = false; this.frustumCulled = false;
    this.userData = { batch: true, dynamic: true, noCollide: true, noHurt: true, noLod: true };
    this.matrixAutoUpdate = false;
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    this.items = entries.map((e) => ({ e, geo: new Map() }));
    for (const it of this.items) this.geometryFor(it);
    this.list = [];
    this.drawn = 0;
  }

  /**
   * The batch's geometry id for the entry's current geometry (copied in the first time), or -1 (no room). later: not
   * copied now but at the frame's update (addLater), -2 meanwhile. A pass's build runs in three's onBeforeRender, after
   * three has taken the batch's geometry and uploaded its buffers for the pass: a geometry copied in then was drawn from
   * buffers that did not have it yet, and one that outgrew the room (setGeometrySize: a new geometry, the old one
   * disposed) drew the new ranges from the old buffers (the Deck's GL: "glMultiDrawElementsANGLE: Insufficient buffer
   * size", the batch lost for that pass; issue #111).
   */
  geometryFor(it, later = false) {
    const g = it.e.o.geometry;
    let gid = it.geo.get(g);
    if (gid !== undefined) return gid;
    if (later) { (this.later ??= new Set()).add(it); return -2; }
    if (vertsOf(g) > this.unusedVertexCount || indicesOf(g) > this.unusedIndexCount) {
      // (the levels of detail outgrew the room left for them: half as much again, copied over: one upload)
      try { this.setGeometrySize(Math.ceil(this._maxVertexCount * 1.5) + vertsOf(g), Math.ceil(this._maxIndexCount * 1.5) + indicesOf(g)); } catch { return -1; }
    }
    try { gid = this.addGeometry(batchCopy(g, it.e.id, this.names, this.indexed)); } catch { return -1; }
    it.geo.set(g, gid);
    return gid;
  }

  /** This pass's ranges: the entries want() keeps, in the frustum, sorted (or not), touching ranges merged. */
  build(camera, sort) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pm, camera.coordinateSystem, camera.reversedDepth);
    const list = this.list;
    let n = 0;
    for (const it of this.items) {
      const e = it.e;
      if (e.out) continue;
      // (the frustum first: most of a batch is off screen, and the visibility walks up the mesh's parents)
      if (e.sphereOf !== e.o.geometry) this.owner.place(e);
      if (!_frustum.intersectsSphere(e.sphere) || !this.want(e)) continue;
      let gid = this.geometryFor(it, true);
      // (a new level of detail is copied in at the frame's update: the one it had, one frame more)
      if (gid === -2) { gid = it.cur ?? it.geo.values().next().value; if (gid === undefined) continue; }
      if (gid < 0) { this.owner.release(e, 'room'); continue; }
      // (three's opaque order inside a material: by the depth of the object's origin on screen)
      if (sort) e.z = _v.setFromMatrixPosition(e.o.matrixWorld).applyMatrix4(_pm).z;
      it.cur = gid;
      list[n++] = it;
    }
    list.length = n;
    // (as three orders a pass's opaque draws: by material, then front to back; ties at one depth end as before)
    if (sort) list.sort((p, q) => p.e.mat.id - q.e.mat.id || p.e.z - q.e.z || p.e.o.id - q.e.o.id);
    const starts = this._multiDrawStarts, counts = this._multiDrawCounts, info = this._geometryInfo;
    const bytes = this.geometry.index ? this.geometry.index.array.BYTES_PER_ELEMENT : 1;
    let k = 0, end = -1;
    for (const it of list) {
      const gi = info[it.cur];
      if (k && gi.start === end) { counts[k - 1] += gi.count; end += gi.count; continue; }
      starts[k] = gi.start * bytes; counts[k] = gi.count; end = gi.start + gi.count; k++;
    }
    this._multiDrawCount = k;
    this._multiDrawBytesPerElement = bytes;
    this.drawn = n;
  }

  /** The geometries the passes asked for, copied in before the frame's passes (StaticBatches.update). */
  addLater() {
    const L = this.later;
    if (!L || !L.size) return;
    this.later = null;
    for (const it of L) if (!it.e.out && this.geometryFor(it) < 0) this.owner.release(it.e, 'room');
  }

  // (three's per-instance culling, sorting and indirect texture: replaced by build())
  onBeforeRender() {}
  computeBoundingSphere() {}
  computeBoundingBox() {}
}

/** A group of materials' still meshes in the view, drawn with the surface shader as each was. */
class ViewBatch extends StillBatch {
  constructor(entries, material, owner) {
    super(entries, material, owner, { indexed: !!entries[0].o.geometry.index });
    const r = entries[0].o;
    this.name = `still: ${r.material.name || 'surface'} ×${entries.length}`;
    this.castShadow = r.castShadow; this.receiveShadow = r.receiveShadow; this.renderOrder = r.renderOrder;
    this.layers.mask = r.layers.mask;
  }
  want(e) { return e.mat.visible && shownUnder(e.o, this.owner.root); }
  // (a ray through the batch tries its meshes, so a hit names the mesh, as before: the photo hunt's)
  raycast(raycaster, intersects) { for (const { e } of this.items) if (!e.out && shownUnder(e.o, this.owner.root)) e.o.raycast(raycaster, intersects); }
  onBeforeRender(renderer, scene, camera) {
    if (scene?.overrideMaterial) { this._multiDrawCount = 0; return; }   // (an override pass draws the shadow batch instead)
    this.build(camera, true);
  }
}

/**
 * The depth-only material of the shadow batch: what main.js's shadow override (MeshBasicMaterial, DoubleSide, no
 * colour) does for a mesh, with the mesh's matrix read from the batches' texture by its vertices' id.
 */
export function shadowBatchMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide, colorWrite: false,
    vertexShader: /* glsl */ `
      in float aBatchId;
      uniform highp sampler2D batchingTexture;
      void main() {
        int size = textureSize(batchingTexture, 0).x, j = int(aBatchId) * 4, x = j % size, y = j / size;
        mat4 m = mat4(texelFetch(batchingTexture, ivec2(x, y), 0), texelFetch(batchingTexture, ivec2(x + 1, y), 0),
                      texelFetch(batchingTexture, ivec2(x + 2, y), 0), texelFetch(batchingTexture, ivec2(x + 3, y), 0));
        gl_Position = projectionMatrix * (modelViewMatrix * (m * vec4(position, 1.0)));
      }`,
    fragmentShader: /* glsl */ `out vec4 o; void main() { o = vec4(0.0); }`,
  });
}

/** Every still mesh in the shadow maps: positions only, one draw a cascade. */
class ShadowBatch extends StillBatch {
  constructor(entries, owner) {
    super(entries, shadowBatchMaterial(), owner, { names: ['position'], indexed: true });
    this.name = `still shadows ×${entries.length}`;
    this.layerMask = 1;
  }
  // (shown, its material drawn, on a layer the cascade's camera sees: as the override pass judged it)
  want(e) { return e.mat.visible && (e.mask & this.layerMask) !== 0 && shownUnder(e.o, this.owner.root); }
  onBeforeRender(renderer, scene, camera) { this.layerMask = camera.layers.mask; this.build(camera, false); }
}

/** A view batch's material: the group's first, with S_BATCH (the varying values per mesh) and its own copies of the
 *  uniforms the group's materials don't share (the same values: restKey), the shared ones shared. */
function batchMaterial(materials, tables) {
  const rep = materials[0];
  const shared = new Set(Object.keys(rep.uniforms).filter((k) => materials.every((m) => m.uniforms[k] === rep.uniforms[k])));
  const uniforms = {};
  for (const [k, u] of Object.entries(rep.uniforms)) {
    if (shared.has(k)) { uniforms[k] = u; continue; }
    const v = u.value;
    uniforms[k] = { value: v?.isTexture ? v : v?.clone ? v.clone() : Array.isArray(v) ? v.map((x) => (x?.clone ? x.clone() : x)) : v };
  }
  const vmat = !!rep.defines?.S_VMAT;
  if (!vmat) uniforms.uBatchValues = { value: tables.values };
  const m = new THREE.ShaderMaterial({ glslVersion: rep.glslVersion, vertexShader: rep.vertexShader, fragmentShader: rep.fragmentShader, uniforms, defines: { ...rep.defines, ...(vmat ? {} : { S_BATCH: 1 }) } });
  for (const k of ['side', 'depthWrite', 'depthTest', 'depthFunc', 'blending', 'colorWrite', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'vertexColors', 'alphaTest', 'name']) m[k] = rep[k];
  m.defaultAttributeValues = { ...rep.defaultAttributeValues };
  m.extensions = { ...rep.extensions };
  m.userData = { ...rep.userData, batchOf: materials.length };
  m.batchSortId = Math.min(...materials.map((x) => x.id));   // (drawn where its first material was: opaqueSort)
  return { material: m, shared };
}

/**
 * three's opaque order (WebGLRenderLists painterSortStable) with a view batch put where its first material was: by
 * material, then front to back. A batch's material is new (a higher id than every material of the world), so it was
 * drawn after all the rest, and two coplanar surfaces (a sign's face on its board) came out the other way round.
 * renderer.setOpaqueSort(opaqueSort) (main.js).
 */
export function opaqueSort(a, b) {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const ma = a.material.batchSortId ?? a.material.id, mb = b.material.batchSortId ?? b.material.id;
  if (ma !== mb) return ma - mb;
  if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}

/** The static batches of a scene (main.js). */
export class StaticBatches {
  /**
   * @param root   the scene
   * @param o.keep roots whose meshes move and are left alone (the traveller, people, vehicles)
   * @param o.min  the fewest still meshes worth a view batch
   */
  constructor(root, { keep = [], min = 3 } = {}) {
    this.root = root;
    this.view = [];
    this.shadow = null;
    this.on = true;
    this.stats = { meshes: 0, batches: 0, materials: 0, released: 0, alone: 0 };
    this.why = new Map();   // (why a mesh was left out of the view's batches: measuring)
    const keepSet = new Set(keep.filter(Boolean));
    const kept = (o) => { for (let p = o; p; p = p.parent) if (keepSet.has(p) || p.userData?.noBatch || p.userData?.dynamic) return true; return false; };
    root.updateMatrixWorld(true);
    const groups = new Map(), all = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const why = staticReason(o) || (kept(o.parent) ? 'mover' : '');
      if (why) { this.why.set(o, why); return; }
      const k = `${restKey(o.material)}|${attributeKey(o.geometry)}|${o.renderOrder}|${o.layers.mask}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(o);
      all.push(o);
    });
    this.tables = new Tables(all.length);
    this.entries = all.map((o, id) => ({ o, id, mat: o.material, mask: o.layers.mask, mw: o.matrixWorld.clone(), we: o.matrixWorld.elements, moves: 0, out: false, view: null, sphere: new THREE.Sphere(), sphereOf: null, z: 0, lent: false }));
    const byObj = new Map(this.entries.map((e) => [e.o, e]));
    for (const e of this.entries) { this.tables.setMatrix(e.id, e.o.matrixWorld); this.tables.setValues(e.id, e.mat); this.place(e); }
    this.watches = new Map();   // material → Watch (what its batch copied)
    for (const meshes of groups.values()) {
      const entries = meshes.map((o) => byObj.get(o));
      if (entries.length < min) { for (const e of entries) { this.why.set(e.o, 'few'); e.alone = true; } continue; }
      const materials = [...new Set(entries.map((e) => e.mat))];
      const { material, shared } = batchMaterial(materials, this.tables);
      const b = new ViewBatch(entries, material, this);
      for (const e of entries) e.view = b;
      for (const m of materials) { const w = new Watch(m, shared); w.batch = b; this.watches.set(m, w); }
      this.view.push(b);
      this.stats.materials += materials.length;
    }
    if (this.entries.length) this.shadow = new ShadowBatch(this.entries, this);
    for (const e of this.entries) if (e.view) e.o.layers.disableAll();
    for (const b of this.view) root.add(b);
    this.stats.meshes = this.entries.filter((e) => e.view).length; this.stats.batches = this.view.length;
    this.stats.alone = this.entries.length - this.stats.meshes;
    this.skip();
  }

  /**
   * The subtrees with nothing for a pass to draw (every mesh in them drawn by a view batch, nothing else but empty groups
   * and bones: a body's skeleton, ~900 bones at the desert's spawn)
   * marked renderSkip: three's walk of the scene (projectObject, patched in scripts/three-program-keys.mjs) doesn't go
   * into them. A mark comes off with anything added under it or a mesh in it drawing itself again.
   */
  skip() {
    this.unskip();
    const batched = new Set(this.entries.filter((e) => e.view && !e.out).map((e) => e.o));
    const plain = (o) => !o.isMesh && !o.isLight && !o.isPoints && !o.isLine && !o.isSprite && !o.isCamera && !o.isScene && !o.material && o.constructor !== undefined && o.type !== 'LOD';
    const empty = new Map();
    const judge = (o) => {
      let ok = batched.has(o) ? o.layers.mask === 0 : plain(o);
      for (const c of o.children) ok = judge(c) && ok;
      empty.set(o, ok);
      return ok;
    };
    judge(this.root);
    this.skipped = [];
    const onAdd = () => { this.unskip(); this.skipAgain = 120; };   // (marked again two seconds on: a body's hand took a prop)
    for (const [o, ok] of empty) {
      if (!ok || o === this.root || empty.get(o.parent)) continue;
      o.renderSkip = true;
      this.skipped.push(o);
      o.traverse((d) => { d.addEventListener('childadded', onAdd); });
    }
    this.onAdd = onAdd;
    this.stats.skipped = this.skipped.length;
  }
  unskip() {
    for (const o of this.skipped ?? []) { o.renderSkip = false; o.traverse((d) => d.removeEventListener('childadded', this.onAdd)); }
    this.skipped = [];
  }

  /** An entry's world sphere for its current geometry. */
  place(e) {
    const g = e.o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    e.sphere.copy(g.boundingSphere).applyMatrix4(e.o.matrixWorld);
    e.sphereOf = g;
  }

  /** A mesh back to drawing itself, for good (moved too often, its material changed, no room for its geometry). */
  release(e, why = '') {
    if (e.out) return;
    e.out = true;
    if (e.lent || e.view) e.o.layers.mask = e.mask;
    e.lent = false;
    e.released = why;
    for (let p = e.o; p; p = p.parent) if (p.renderSkip) p.renderSkip = false;   // (it draws itself: its walk again)
    this.stats.released++;
  }

  /** Once a frame, after the scene's matrices (main.js renderFrame): what moved or changed since. */
  update(renderer = null) {
    if (!this.on) return;
    if (this.skipAgain > 0 && --this.skipAgain === 0) this.skip();
    for (const b of this.view) b.addLater();
    this.shadow?.addLater();
    const T = this.tables;
    for (const e of this.entries) {
      if (e.out) continue;
      const o = e.o;
      if (o.material !== e.mat) { this.release(e, 'material'); continue; }
      // (the mesh's world matrix's elements kept on the entry: a read off the mesh, whose shape is one of hundreds, is a
      //  megamorphic one in V8, and this runs over every still mesh a frame; three never replaces a matrix's array)
      const a = e.we, b = e.mw.elements;
      let same = true;
      for (let k = 0; k < 16; k++) if (a[k] !== b[k]) { same = false; break; }
      if (same) continue;
      e.moves++;   // (followed however often it moves: one upload of the matrices a frame for all that did)
      e.mw.copy(o.matrixWorld);
      T.setMatrix(e.id, o.matrixWorld);
      this.place(e);
    }
    // the materials the view's batches copied: their varying values written again when they change; any other change
    // and their meshes draw themselves (every frame: a change shows the frame it is made)
    if (!this.watchList) { this.watchList = [...this.watches.values()]; this.watchAt = 0; }
    // (the colours every frame, for every material; the rest when a number was set on it, and a share of them a frame
    //  in turn, ROUNDS frames for all: a vector changed in place shows within that)
    const W = this.watchList, n = W.length, turn = (this.round = ((this.round ?? 0) + 1) % ROUNDS);
    for (let i = 0; i < n; i++) {
      const w = W[i];
      if (w.gone) continue;
      // (only what the batch's program reads: a prop's material carries the face's and the eyes' uniforms too, unused; known
      // once the program is linked, asked only then: the query would wait for it)
      if (!w.narrowed && renderer) {
        const p = renderer.properties.get(w.batch.material).currentProgram;
        if (p && (!p.isReady || p.isReady())) { const used = p.getUniforms().map; w.keys = w.keys.filter((k) => k in used); w.rest = w.snap(w.keys); w.narrowed = true; }
      }
      if ((w.dirty || i % ROUNDS === turn) && (w.dirty = false, !w.holds(w.keys, w.rest))) { w.gone = true; for (const e of this.entries) if (e.mat === w.m) this.release(e, 'values'); continue; }
      if (!w.holds(VARIES, w.vary)) { w.vary = w.snap(VARIES); for (const e of this.entries) if (e.mat === w.m && !e.out) T.setValues(e.id, w.m); }
    }
  }

  /** Around the shadow passes: the view's batches are not drawn there (the shadow batch is, by drawShadows), and the
   *  still meshes left drawing themselves in the view cast through the shadow batch. */
  shadowsBegin() {
    for (const b of this.view) b.visible = false;
    if (!this.on) return;
    for (const e of this.entries) if (!e.out && !e.view) { e.o.layers.mask = 0; e.lent = true; }
  }
  shadowsEnd() {
    for (const b of this.view) b.visible = this.on;
    for (const e of this.entries) if (e.lent) { e.lent = false; e.o.layers.mask = e.mask; }
  }
  /** After a cascade's own pass, into its target: the still meshes' shadows. */
  drawShadows(renderer, camera) { if (this.on && this.shadow) renderer.render(this.shadow, camera); }

  /** Off: every mesh draws itself again (and on again). For measuring and pictures. */
  set enabled(v) {
    v = !!v;
    if (v === this.on) return;
    this.on = v;
    for (const e of this.entries) if (!e.out && e.view) e.o.layers.mask = v ? 0 : e.mask;
    for (const b of this.view) b.visible = v;
    if (v) this.skip(); else this.unskip();
  }
  get enabled() { return this.on; }

  /** Why each mesh shown in the view was left out of the batches, counted (measuring). */
  reasons() {
    const out = {};
    for (const [o, why] of this.why) if (o.layers.mask !== 0 && shownUnder(o, this.root)) out[why] = (out[why] ?? 0) + 1;
    return out;
  }

  /** The numbers: meshes batched, batches, what the last pass of each drew. */
  report() {
    return { ...this.stats, viewDrawn: this.view.reduce((s, b) => s + b.drawn, 0), viewRanges: this.view.reduce((s, b) => s + b._multiDrawCount, 0), shadowDrawn: this.shadow?.drawn ?? 0, shadowRanges: this.shadow?._multiDrawCount ?? 0 };
  }
}
