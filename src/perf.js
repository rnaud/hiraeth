import * as THREE from 'three';

// Split world-spanning meshes into tiles so frustum culling can skip what's
// off-screen in each pass (main view and each shadow cascade). Without this
// the terrain and every scattered prop set are drawn in full, four times a
// frame. Tiles share the original buffers, so this costs little memory.
//  - big indexed meshes (terrain): triangles grouped by centroid
//  - big InstancedMeshes (rocks, plants, scrub): instances grouped by position
// Meshes flagged userData.dynamic (instances updated every frame) are left alone.

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _c = new THREE.Color();

export function tileScene(scene, { tile = 260 } = {}) {
  const small = [];   // tiles of small props (excluded from the far shadow pass)
  const todo = [];
  scene.traverse((o) => {
    if (o.userData.dynamic || o.userData.tiled) return;
    if (o.isInstancedMesh && o.count > 300) todo.push(o);
    else if (o.isMesh && !o.isSkinnedMesh && o.geometry.index && o.geometry.index.count > 150000) todo.push(o);
  });
  for (const o of todo) {
    const parent = o.parent;
    const tiles = o.isInstancedMesh ? tileInstances(o, tile) : tileTriangles(o, tile);
    for (const t of tiles) {
      t.userData = { ...o.userData, tiled: true };
      t.castShadow = o.castShadow;
      parent.add(t);
      if (o.isInstancedMesh) small.push(t);
    }
    parent.remove(o);
  }
  return { small };
}

function tileTriangles(mesh, size) {
  const g = mesh.geometry, idx = g.index.array, P = g.attributes.position;
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
    const m = new THREE.Mesh(tg, mesh.material);
    m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
    out.push(m);
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
    t.position.copy(mesh.position); t.quaternion.copy(mesh.quaternion); t.scale.copy(mesh.scale);
    t.computeBoundingSphere();
    t.frustumCulled = true;
    out.push(t);
  }
  return out;
}
