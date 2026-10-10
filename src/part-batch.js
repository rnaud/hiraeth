import * as THREE from 'three';
import { selfLitSkips } from './shadows.js';

// ---------------------------------------------------------------------------
// A body's repeated parts in one draw (docs/systems/performance.md, "A foe's repeated parts in one draw"): the
// roster's bodies (src/enemies/plans/) are built of many small meshes on the kit's joints, a leg's segments, a
// jelly's tentacle beads, a centipede's legs, each a mesh of its own in the same material, so a pack of them was
// thousands of draws a frame (a draw each in the G-buffer and in each shadow map). Parts with the same shape (equal
// vertex arrays: each part builds its own geometry, so they are compared, not looked up) and the same material
// are drawn by one InstancedMesh, its instances the parts' own world matrices: modelMatrix * instanceMatrix is the
// part's matrixWorld, so the surface shader (materials.js: vObjPos, vObjRel, the normals) sees exactly what it saw,
// and the picture does not change. The parts stay where they are, moved by the kit as before; they are only no
// longer drawn themselves (their layers off: their children, if any, still draw).
//
// The batch reads the parts when the scene's matrices are updated (main.js renderFrame: scene.updateMatrixWorld,
// before any pass): it is the last child of the body's root, so the parts' matrices are this frame's by then. Only
// the parts shown are drawn (it and its parents up to the root visible: a centipede's shed segments, a toad's tongue,
// a listening stone's glyphs come and go; none shown, the batch is hidden); a part taken out of the body (a machine's
// pieces flying apart) goes back to drawing itself.
//
// Left out: skinned meshes (already one draw), self-lit parts (they stay out of the shadow passes by their own
// rule, shadows.js selfLitSkips), see-through ones (their order of drawing kept), multi-material meshes, and anything
// flagged userData.noBatch. A part alone in its shape is a batch of one: the body's parts all draw instanced, so a
// body compiles one set of programs (instanced), not two.
//
//   batchParts(root, { min: 1, cell: 0 }) → the batches made (each a PartBatch, userData.batch: true)
// ---------------------------------------------------------------------------

const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _s = new THREE.Sphere();

/** Do two geometries hold the same shape (the same attributes, index and groups, value for value)? */
export function sameShape(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a.attributes), kb = Object.keys(b.attributes);
  if (ka.length !== kb.length || !!a.index !== !!b.index || a.groups.length !== b.groups.length) return false;
  if (Object.keys(a.morphAttributes).length || Object.keys(b.morphAttributes).length) return false;
  const eq = (x, y) => {
    if (!x || !y || x.itemSize !== y.itemSize || x.count !== y.count || x.normalized !== y.normalized || x.isInterleavedBufferAttribute || y.isInterleavedBufferAttribute) return false;
    const p = x.array, q = y.array;
    if (p.length !== q.length) return false;
    for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return false;
    return true;
  };
  for (const k of ka) if (!eq(a.attributes[k], b.attributes[k])) return false;
  if (a.index && !eq(a.index, b.index)) return false;
  return a.drawRange.start === b.drawRange.start && a.drawRange.count === b.drawRange.count;
}

/** Can this mesh be drawn by a batch? */
export function batchable(o) {
  return o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.userData.noBatch && !o.userData.batch
    && !!o.geometry?.attributes?.position && !Array.isArray(o.material) && !!o.material && !o.material.transparent && !selfLitSkips(o)
    && !Object.keys(o.geometry.morphAttributes).length;
}

/** Parts of one shape in one material, drawn as instances of one mesh, under `root`. */
export class PartBatch extends THREE.InstancedMesh {
  constructor(root, parts) {
    const rep = parts[0];
    super(rep.geometry, rep.material, parts.length);
    this.root = root;
    this.parts = parts;
    this.masks = parts.map((p) => p.layers.mask);
    this.out = parts.map(() => false);
    this.on = true;   // (taken out of the body: drawing itself again)
    this.name = `parts: ${rep.name || rep.geometry.type} ×${parts.length}`;
    this.castShadow = rep.castShadow; this.receiveShadow = rep.receiveShadow; this.renderOrder = rep.renderOrder; this.frustumCulled = rep.frustumCulled;
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.userData = { ...rep.userData, batch: true, dynamic: true, noCollide: true, noHurt: true };
    this.boundingSphere = new THREE.Sphere();
    if (!rep.geometry.boundingSphere) rep.geometry.computeBoundingSphere();
    // the size of one part (m, in this mesh's frame): what the shadow passes judge it by (shadows.js ShadowCuller)
    root.updateMatrixWorld(true);
    const ws = new THREE.Vector3(), rs = root.getWorldScale(new THREE.Vector3());
    this.partRadius = rep.geometry.boundingSphere.radius * Math.max(...parts.map((p) => { p.getWorldScale(ws); return Math.max(ws.x / rs.x, ws.y / rs.y, ws.z / rs.z); }));
    for (const p of parts) p.layers.disableAll();
  }

  /**
   * The parts' matrices now, in this mesh's frame, the shown ones first (count: how many), and the bounds round them.
   * Written straight into the instance buffer and compared as they go: a batch whose parts stood still (most of a
   * world's, most frames: the matrix cache leaves their matrices as they were) uploads nothing and keeps its bounds.
   */
  sync() {
    const root = this.root, arr = this.instanceMatrix.array, fr = Math.fround;
    _inv.copy(this.matrixWorld).invert();
    let n = 0, changed = false;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (this.out[i]) continue;
      let shown = true, o = p;
      for (; o && o !== root; o = o.parent) if (!o.visible) shown = false;
      if (!o) { this.out[i] = true; p.layers.mask = this.masks[i]; changed = true; continue; }   // (no longer in the body: it draws itself)
      if (!shown) continue;
      const e = _m.multiplyMatrices(_inv, p.matrixWorld).elements, at = n * 16;
      for (let k = 0; k < 16; k++) { const v = fr(e[k]); if (arr[at + k] !== v) { arr[at + k] = v; changed = true; } }
      n++;
    }
    if (n !== this.count) changed = true;
    // (none shown: not drawn at all, as the hidden parts weren't; a culler that hides it for a pass finds it hidden already)
    this.count = n;
    this.visible = n > 0;
    if (!changed) return;
    const gs = this.geometry.boundingSphere, B = this.boundingSphere;
    for (let j = 0; j < n; j++) { _s.copy(gs).applyMatrix4(_m.fromArray(arr, j * 16)); if (j) B.union(_s); else B.copy(_s); }
    if (!n) B.set(B.center, 0);
    this.instanceMatrix.needsUpdate = true;
  }

  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    if (!this.on) { this.visible = false; return; }
    // (a body hidden whole, a foe parked or out of range: nothing to read until it shows again)
    for (let o = this.parent; o; o = o.parent) if (!o.visible) { this.visible = false; return; }
    this.sync();
  }

  /** On (the batch draws the parts) or off (each part draws itself again, as before it): for measuring both in turns. */
  set enabled(v) {
    v = !!v;
    if (v === this.on) return;
    this.on = v;
    this.parts.forEach((p, i) => { if (!this.out[i]) p.layers.mask = v ? 0 : this.masks[i]; });
    if (v) { this.count = -1; this.updateMatrixWorld(true); }
  }
  get enabled() { return this.on; }

  computeBoundingSphere() { if (!this.boundingSphere) this.boundingSphere = new THREE.Sphere(); this.sync(); }

  /** Back to the parts drawing themselves (the batch taken out). */
  undo() {
    this.parts.forEach((p, i) => { p.layers.mask = this.masks[i]; });
    this.removeFromParent();
    this.dispose();
  }
}

/**
 * The repeated parts under `root` (min: how many of one shape and material make a batch; cell: m, parts batched only
 * with those in the same cell of that size) as PartBatches, added to root as its last children. Returns them.
 */
export function batchParts(root, { min = 1, cell = 0 } = {}) {
  const groups = new Map();   // material → [[parts of one shape], …]
  if (cell) root.updateMatrixWorld(true);
  const _p = new THREE.Vector3();
  root.traverse((o) => {
    if (o === root || !batchable(o)) return;
    // (cell: parts spread over a world batched by where they stand, so a batch is culled with what is round it)
    const at = cell ? _p.setFromMatrixPosition(o.matrixWorld) : null;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}|${o.frustumCulled}${at ? `|${Math.floor(at.x / cell)},${Math.floor(at.y / cell)},${Math.floor(at.z / cell)}` : ''}`;
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    const g = list.find((s) => sameShape(s[0].geometry, o.geometry));
    if (g) g.push(o); else list.push([o]);
  });
  const made = [];
  for (const list of groups.values()) for (const parts of list) if (parts.length >= min) made.push(new PartBatch(root, parts));
  root.updateMatrixWorld(true);
  for (const b of made) root.add(b);
  for (const b of made) { b.updateMatrixWorld(true); }
  return made;
}
