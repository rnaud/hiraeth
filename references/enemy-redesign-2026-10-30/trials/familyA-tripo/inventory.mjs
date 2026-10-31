// Every skin of a kind built in node: which body it wears, what it draws (meshes, skinned, triangles) and its box.
//
//   node references/enemy-redesign-2026-10-30/trials/familyA-tripo/inventory.mjs <kind>
import * as THREE from 'three';
import { archetypeModel } from '../../../../src/enemies/plans/index.js';
import { SKINS } from '../../../../src/enemies/skins.js';
import { archetypeOfKind } from '../../../../src/enemies/archetypes.js';

THREE.ColorManagement.enabled = false;
const kind = process.argv[2], a = archetypeOfKind(kind);
for (const id of Object.keys(SKINS[a])) {
  const M = archetypeModel(kind, id); let n = 0, tris = 0, skinned = 0;
  M.group.traverseVisible((o) => { if (o.isMesh) { n++; if (o.isSkinnedMesh) skinned++; tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  M.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(M.group);
  console.log(id, M.tripo ?? M.toad ?? '(legacy)', n, 'meshes', skinned, 'skinned', tris, 'tris', box.min.toArray().map((x) => x.toFixed(2)).join(','), '|', box.max.toArray().map((x) => x.toFixed(2)).join(','));
  M.dispose();
}
