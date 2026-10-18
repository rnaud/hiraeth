import * as THREE from 'three';

// ---------------------------------------------------------------------------
// A material's instanced meshes drawn by one draw a pass (issue #453).
//
// The world builds many of its repeated things as instanced meshes cut by place, so that the passes can leave out
// what is off screen: the City-Shaft's trees one mesh per terrace, kind and eighth of the ring, the desert's pebbles
// and the flora a mesh per tile. Each is a draw of its own in each pass, all of them in one material: 98 draws of the
// trees' material in the City-Shaft's G-buffer and as many in its near shadow map, each paying three's whole per-draw
// work (~27 µs at a 4x-throttled CPU) for a few dozen instances.
//
// Here, as each pass of the flat list is handed to three (src/flat-pass.js), the instanced meshes it hands over that
// share a material, a geometry and a world matrix are replaced by one instanced mesh of the pass's own (not in the
// scene: nothing else sees it) holding their instances one after the other, copied in only when what it holds has
// changed. The picture is the same, triangle for triangle:
//
// - the instances' matrices and colours are copied as they are, under the same world matrix: the same numbers reach
//   the shader;
// - a pass draws them in the order three would have drawn the meshes: a sorted pass (the G-buffer) orders its opaque
//   draws by material, then by screen depth, then by id, so a material's meshes are drawn one after the other, front to
//   back; nothing else can come between them, since only materials used by these instanced meshes alone are merged (a
//   mesh drawing itself in the same material, or a still batch taking one, keeps the material out). In that order only
//   runs of one shape are merged: far off, two trees' surfaces can meet at one depth, and the later wins the pixel
//   (merged by shape regardless, 13 pixels of the City-Shaft's picture changed). An unsorted pass (the shadow maps:
//   depth only, where the order changes nothing) merges each shape whole;
// - only plain meshes are merged: opaque, one material, no hook of their own, no children, culled by the frustum, not
//   skinned, no morphs, all of a material with the same layers, render order and instance colours (or none).
//
// What three's frustum test would have dropped of what the flat pass hands over (a mesh within a millimetre of a plane)
// is drawn in the merged mesh: wholly outside the frustum, it draws no pixel.
//
// Web only: the Unity bridge mirrors the scene, where nothing changes.
// ---------------------------------------------------------------------------

const plainBefore = THREE.Object3D.prototype.onBeforeRender;
const _v = new THREE.Vector4();

/** Could this object be merged with others of its material? */
export function mergeCandidate(o) {
  if (!o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || o.children.length !== 0) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || m.transparent || o.onBeforeRender !== plainBefore || o.frustumCulled !== true) return false;
  if (o.morphTexture || Object.keys(o.geometry.morphAttributes).length || o.userData?.noMerge) return false;
  return true;
}

/** The groups and the passes' merged meshes. */
export class InstanceMerge {
  constructor() {
    this.on = true;
    this.groupOf = new Map();   // member → its group
    this.groups = [];
    this.slots = new WeakMap();  // camera → Map(key → slot)
    this.frame = 0;
    this.stats = { groups: 0, members: 0, passes: 0, merged: 0, saved: 0, copies: 0 };
  }

  /**
   * The groups, from a list of the scene's objects (engine/scene-matrices.js's flat list, each time it is made): for each
   * material used only by instanced meshes that may be merged, alike in layers, render order and colours, those meshes.
   */
  build(objs, n) {
    const users = new Map();   // material → its meshes, or null (something else draws it, or they differ)
    const silent = new Map();  // material → the instanced meshes cut into tiles (perf.js tileSceneSteps: count 0, the tiles their children)
    for (let i = 0; i < n; i++) {
      const o = objs[i], m = o.material;
      if (!m || !(o.isMesh || o.isLine || o.isPoints || o.isSprite)) continue;
      if (Array.isArray(m)) { for (const x of m) users.set(x, null); continue; }
      if (o.isInstancedMesh && o.count === 0 && o.children.length > 0) { if (!silent.has(m)) silent.set(m, []); silent.get(m).push(o); continue; }
      let u = users.get(m);
      if (u === null) continue;
      if (!mergeCandidate(o)) { users.set(m, null); continue; }
      if (u === undefined) users.set(m, (u = []));
      else {
        const f = u[0];
        if (f.layers.mask !== o.layers.mask || f.renderOrder !== o.renderOrder || (f.instanceColor === null) !== (o.instanceColor === null)) { users.set(m, null); continue; }
      }
      u.push(o);
    }
    this.groupOf.clear();
    this.groups = [];
    let members = 0;
    for (const [material, list] of users) {
      if (!list || list.length < 2) continue;
      const f = list[0];
      const g = { id: this.groups.length, material, members: list, frame: -1, hand: [], mask: f.layers.mask, order: f.renderOrder, colours: f.instanceColor !== null, silent: silent.get(material) ?? [] };
      for (const o of list) this.groupOf.set(o, g);
      this.groups.push(g);
      members += list.length;
    }
    this.stats.groups = this.groups.length; this.stats.members = members;
  }

  /**
   * One pass: the objects handed to three (`out`, changed in place), the camera, its projection × view (`pm`, as three
   * makes it), whether three sorts this pass.
   */
  apply(out, camera, pm, sort) {
    if (!this.on || this.groups.length === 0) return;
    const stamp = ++this.frame, touched = [];
    for (let i = 0; i < out.length; i++) {
      const g = this.groupOf.get(out[i]);
      if (g === undefined) continue;
      if (g.frame !== stamp) { g.frame = stamp; g.hand.length = 0; touched.push(g); }
      g.hand.push(i);
    }
    if (touched.length === 0) return;
    this.stats.passes++;
    let drop = null;
    for (const g of touched) {
      if (g.hand.length < 2) continue;
      if (sort && g.silent.some((o) => o.count !== 0)) continue;   // (a tiles' source drawing again: sorted among them, unknown here)
      // (as it was when the groups were made: anything changed since, it draws itself)
      const fit = (o) => o.count !== 0 && o.material === g.material && o.layers.mask === g.mask && o.renderOrder === g.order && (o.instanceColor !== null) === g.colours
        && o.onBeforeRender === plainBefore && o.children.length === 0 && !g.material.transparent;
      const buckets = sort ? runs(out, g, fit, pm) : byShape(out, g, fit);
      for (const b of buckets) {
        if (b.list.length < 2) continue;
        const mesh = this.fill(camera, g, b);
        out[b.at] = mesh;
        (drop ??= new Set());
        for (const o of b.list) drop.add(o);   // (and its place taken by the merged mesh)
        this.stats.merged++; this.stats.saved += b.list.length - 1;
      }
    }
    if (drop) {
      let k = 0;
      for (let i = 0; i < out.length; i++) if (!drop.has(out[i])) out[k++] = out[i];
      out.length = k;
    }
  }

  /** The pass's merged mesh for a bucket, holding its meshes' instances in its order (copied when they changed). */
  fill(camera, g, b) {
    let byCam = this.slots.get(camera);
    if (!byCam) this.slots.set(camera, (byCam = new Map()));
    const key = g.id + ':' + b.key;
    let s = byCam.get(key);
    let n = 0;
    for (const o of b.list) n += o.count;
    const colours = b.first.instanceColor !== null;
    if (!s || s.capacity < n || s.colours !== colours) {
      const capacity = Math.max(n, Math.ceil((s?.capacity ?? 0) * 1.5), 16);
      s?.mesh.dispose();
      const mesh = new THREE.InstancedMesh(b.geometry, g.material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colours) { mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false; mesh.matrixWorldAutoUpdate = false;
      mesh.name = 'merged instances';
      mesh.userData.merged = true;
      byCam.set(key, (s = { mesh, capacity, colours, sig: [] }));
    }
    const mesh = s.mesh;
    mesh.geometry = b.geometry; mesh.material = g.material;
    mesh.layers.mask = b.first.layers.mask; mesh.renderOrder = b.first.renderOrder;
    mesh.matrixWorld.copy(b.first.matrixWorld);
    if (b.first.boundingSphere === null) b.first.computeBoundingSphere();
    mesh.boundingSphere = b.first.boundingSphere;   // (three's screen depth reads it: never computed over the instances)
    // (what it holds: each mesh, its count and its buffers' versions; the same as last time, nothing is copied)
    const sig = s.sig;
    let same = sig.length === b.list.length * 4;
    for (let j = 0; same && j < b.list.length; j++) {
      const o = b.list[j];
      same = sig[j * 4] === o && sig[j * 4 + 1] === o.count && sig[j * 4 + 2] === o.instanceMatrix.version && sig[j * 4 + 3] === (o.instanceColor?.version ?? -1);
    }
    if (!same) {
      sig.length = 0;
      const M = mesh.instanceMatrix, C = mesh.instanceColor;
      let at = 0;
      for (const o of b.list) {
        M.array.set(o.instanceMatrix.array.subarray(0, o.count * 16), at * 16);
        if (C) C.array.set(o.instanceColor.array.subarray(0, o.count * 3), at * 3);
        at += o.count;
        sig.push(o, o.count, o.instanceMatrix.version, o.instanceColor?.version ?? -1);
      }
      M.clearUpdateRanges(); M.addUpdateRange(0, n * 16); M.needsUpdate = true;
      if (C) { C.clearUpdateRanges(); C.addUpdateRange(0, n * 3); C.needsUpdate = true; }
      this.stats.copies++;
    }
    mesh.count = n;
    return mesh;
  }
}

function sameMatrix(a, b) {
  if (a === b) return true;
  const x = a.elements, y = b.elements;
  for (let i = 0; i < 16; i++) if (x[i] !== y[i]) return false;
  return true;
}

/**
 * An unsorted pass (depth only): the group's meshes handed over, by shape (geometry, and world matrix), in the order
 * handed. Each bucket: { key, geometry, first, at (first's place in out), list }.
 */
function byShape(out, g, fit) {
  const buckets = [];
  for (const i of g.hand) {
    const o = out[i];
    if (!fit(o)) continue;
    let b = null;
    for (const x of buckets) if (x.geometry === o.geometry && sameMatrix(x.first.matrixWorld, o.matrixWorld)) { b = x; break; }
    if (b === null) buckets.push((b = { key: 'g' + o.geometry.id + ':' + buckets.length, geometry: o.geometry, first: o, at: i, list: [] }));
    b.list.push(o);
  }
  return buckets;
}

/**
 * A sorted pass: the group's meshes handed over in the order three draws them (its opaque sort among one material: by
 * screen depth, its own sphere's centre carried by its world matrix and the camera, then by id), cut into runs of the
 * same shape: the draws keep their order exactly (at equal depth, far away, the later of two surfaces may win a pixel).
 * A run whose depth equals its neighbour's is left alone (the merged mesh's id would order them).
 */
function runs(out, g, fit, pm) {
  const items = [];
  for (const i of g.hand) {
    const o = out[i];
    if (o.material !== g.material) continue;   // (another material now: sorted elsewhere)
    if (o.boundingSphere === null) o.computeBoundingSphere();
    _v.copy(o.boundingSphere.center);
    items.push({ o, i, z: _v.applyMatrix4(o.matrixWorld).applyMatrix4(pm).z, ok: fit(o) });
  }
  items.sort((a, b) => a.z - b.z || a.o.id - b.o.id);
  const buckets = [];
  for (let k = 0; k < items.length;) {
    const a = items[k];
    let e = k + 1;
    if (a.ok) while (e < items.length && items[e].ok && items[e].o.geometry === a.o.geometry && sameMatrix(items[e].o.matrixWorld, a.o.matrixWorld)) e++;
    if (e - k >= 2 && !(k > 0 && items[k - 1].z === a.z) && !(e < items.length && items[e].z === a.z)) {
      const list = [];
      let at = a.i;
      for (let j = k; j < e; j++) { list.push(items[j].o); if (items[j].i < at) at = items[j].i; }
      buckets.push({ key: 'r' + buckets.length, geometry: a.o.geometry, first: a.o, at, list });
    }
    k = e;
  }
  return buckets;
}
