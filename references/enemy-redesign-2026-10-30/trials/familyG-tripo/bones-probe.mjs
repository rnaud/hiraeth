// #800 family G: each rig bone's share of a rebuilt body: how many vertices it carries most, and their box (m, at rest).
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/bones-probe.mjs <kind>
import * as THREE from 'three';
import { archetypeModel } from '../../../../src/enemies/plans/index.js';

const M = archetypeModel(process.argv[2] ?? 'hulk', 'desert');
let sm = null; M.group.traverse((o) => { if (o.isSkinnedMesh && o.name === 'tripo body') sm = o; });
M.group.updateMatrixWorld(true); sm.skeleton.update();
const P = sm.geometry.attributes.position, SI = sm.geometry.attributes.skinIndex, SW = sm.geometry.attributes.skinWeight, by = new Map(), v = new THREE.Vector3();
for (let i = 0; i < P.count; i++) {
  let b = 0; for (let k = 1; k < 4; k++) if (SW.getComponent(i, k) > SW.getComponent(i, b)) b = k;
  const bone = sm.skeleton.bones[SI.getComponent(i, b)], e = by.get(bone) ?? { n: 0, box: new THREE.Box3() };
  e.n++; e.box.expandByPoint(sm.applyBoneTransform(i, v.fromBufferAttribute(P, i)).applyMatrix4(sm.matrixWorld)); by.set(bone, e);
}
for (const [b, e] of by) console.log((b.name + (b.parent ? ` (${b.parent.name})` : '')).padEnd(28), String(e.n).padStart(5), e.box.min.toArray().map((x) => x.toFixed(2)).join(','), '..', e.box.max.toArray().map((x) => x.toFixed(2)).join(','));
