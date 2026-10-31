import * as THREE from 'three';
const W = new URL('../../../../', import.meta.url).href;
const { archetypeModel } = await import(W + 'src/enemies/plans/index.js');
const kind = process.argv[2] ?? 'mummerking';
for (const tier of [0, 1]) {
  const M = archetypeModel(kind, 'desert', tier);
  let meshes = 0, tris = 0; M.group.traverseVisible((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  M.group.updateMatrixWorld(true);
  const box = new THREE.Box3(); M.group.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  console.log(kind, 'tier', tier, M.group.name, 'meshes', meshes, 'tris', tris, 'box', box.min.toArray().map((x) => x.toFixed(2)), box.max.toArray().map((x) => x.toFixed(2)), 'tripo', JSON.stringify(M.tripo));
  M.dispose();
}
