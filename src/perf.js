import * as THREE from 'three';

// Split world-spanning meshes into tiles so frustum culling can skip what's
// off-screen in each pass (main view and each shadow cascade). Without this
// the terrain and every merged prop set are drawn in full, four times a
// frame: one merged mesh that touches the 24 m fine cascade is drawn whole.
// Tiles share the original buffers, so this costs little memory.
//  - big meshes (terrain, merged rocks and props): triangles grouped by centroid
//  - big InstancedMeshes (rocks, plants, scrub, clouds): instances grouped by position
// Tiles become children of the original (which then draws nothing), so a mesh
// a level moves or hides keeps doing so. Meshes flagged userData.dynamic, or
// with instances rewritten every frame, are left alone.

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _c = new THREE.Color();

const triangleCount = (g) => (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
function spread(o) {
  const g = o.geometry;
  if (o.isInstancedMesh) { o.computeBoundingSphere(); return o.boundingSphere.radius; }
  if (!g.boundingSphere) g.computeBoundingSphere();
  return g.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
}

export function tileScene(scene, { tile = 260, propTile = 110 } = {}) {
  const small = [];   // tiles of small props (excluded from the far shadow pass)
  const todo = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.dynamic || o.userData.tiled || !o.geometry.attributes.position) return;
    if (o.isInstancedMesh) {
      if (o.instanceMatrix.usage === THREE.DynamicDrawUsage) return;
      const total = o.count * triangleCount(o.geometry);
      if ((o.count > 300 || (o.count >= 48 && total >= 30000)) && spread(o) > propTile * 0.6) todo.push(o);
    } else {
      const tris = triangleCount(o.geometry);
      if (tris >= 150000 || (tris >= 20000 && spread(o) > propTile * 0.6)) todo.push(o);
    }
  });
  for (const o of todo) {
    const size = !o.isInstancedMesh && triangleCount(o.geometry) >= 150000 ? tile : propTile;
    const tiles = o.isInstancedMesh ? tileInstances(o, size) : tileTriangles(o, size);
    if (tiles.length < 2) continue;
    for (const t of tiles) {
      t.userData = { ...o.userData, tiled: true };
      t.castShadow = o.castShadow; t.receiveShadow = o.receiveShadow; t.renderOrder = o.renderOrder;
      o.add(t);
      if (o.isInstancedMesh) small.push(t);
    }
    // the original keeps its transform and visibility; its own draw becomes empty
    if (o.isInstancedMesh) o.count = 0;
    else {   // same buffers (anything reading them still works), nothing drawn; shared geometries stay intact
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(o.geometry.attributes)) g.setAttribute(name, attr);
      g.setIndex(o.geometry.index); g.boundingSphere = o.geometry.boundingSphere; g.boundingBox = o.geometry.boundingBox;
      g.setDrawRange(0, 0);
      o.geometry = g;
    }
    o.userData.tiled = true;
  }
  return { small };
}

function tileTriangles(mesh, size) {
  const g = mesh.geometry, P = g.attributes.position;
  const idx = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i);
  const buckets = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const cx = (P.getX(a) + P.getX(b) + P.getX(c)) / 3, cz = (P.getZ(a) + P.getZ(b) + P.getZ(c)) / 3;
    const k = `${Math.floor(cx / size)},${Math.floor(cz / size)}`;
    let arr = buckets.get(k);
    if (!arr) buckets.set(k, (arr = []));
    arr.push(a, b, c);
  }
  const out = [];
  for (const arr of buckets.values()) {
    const tg = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) tg.setAttribute(name, attr);
    tg.setIndex(new THREE.BufferAttribute(new Uint32Array(arr), 1));
    // bounding volume from just this tile's vertices
    const box = new THREE.Box3();
    for (const v of arr) box.expandByPoint(_p.fromBufferAttribute(P, v));
    tg.boundingBox = box;
    tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    for (const [name, morph] of Object.entries(g.morphAttributes)) tg.morphAttributes[name] = morph;
    out.push(new THREE.Mesh(tg, mesh.material));
  }
  return out;
}

function tileInstances(mesh, size) {
  const buckets = new Map();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, _m);
    _p.setFromMatrixPosition(_m);
    const k = `${Math.floor(_p.x / size)},${Math.floor(_p.z / size)}`;
    let arr = buckets.get(k);
    if (!arr) buckets.set(k, (arr = []));
    arr.push(i);
  }
  const out = [];
  for (const ids of buckets.values()) {
    const t = new THREE.InstancedMesh(mesh.geometry, mesh.material, ids.length);
    ids.forEach((src, j) => {
      mesh.getMatrixAt(src, _m);
      t.setMatrixAt(j, _m);
      if (mesh.instanceColor) { mesh.getColorAt(src, _c); t.setColorAt(j, _c); }
    });
    t.computeBoundingSphere();
    t.frustumCulled = true;
    out.push(t);
  }
  return out;
}

/** Hide small-prop tiles far from the camera in every pass: beyond this they are
 * sub-pixel pebbles and shrubs under the haze. Call once a frame before rendering;
 * returns what it hid, to be shown again after the frame (a level's own hiding is kept). */
export function cullFar(tiles, camera, distance = 520) {
  const cam = camera.position, hidden = [];
  for (const t of tiles) {
    if (!t.visible) continue;
    let c = t.userData.cullCentre;
    if (!c) {
      if (!t.boundingSphere) t.computeBoundingSphere?.();
      const s = t.boundingSphere ?? t.geometry.boundingSphere;
      if (!s) continue;
      t.updateWorldMatrix(true, false);
      c = t.userData.cullCentre = s.center.clone().applyMatrix4(t.matrixWorld);
      t.userData.cullRadius = s.radius * t.matrixWorld.getMaxScaleOnAxis();
    }
    if (cam.distanceTo(c) - t.userData.cullRadius > distance) { t.visible = false; hidden.push(t); }
  }
  return hidden;
}

