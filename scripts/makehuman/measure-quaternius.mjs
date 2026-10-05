// The Quaternius bodies' rest pose, the numbers the MakeHuman bodies are fitted to (build.py
// scales each MakeHuman body so its hips stand where the game's rig puts them):
//   node scripts/makehuman/measure-quaternius.mjs
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const BONES = ['pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l'];
const out = {};
for (const k of ['m', 'f']) {
  const bytes = await readFile(new URL(`../../public/anim/human_${k}.glb`, import.meta.url));
  const g = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  g.scene.updateMatrixWorld(true);
  const p = {};
  g.scene.traverse((o) => { if (o.isBone) p[o.name] = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); });
  const box = new THREE.Box3();
  g.scene.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  out[k] = { bones: Object.fromEntries(BONES.map((n) => [n, p[n].toArray().map((x) => +x.toFixed(4))])), min: box.min.toArray().map((x) => +x.toFixed(4)), max: box.max.toArray().map((x) => +x.toFixed(4)) };
}
console.log(JSON.stringify(out, null, 1));

// how far the face leans forward at rest (rad: the line from the chin to the forehead against the vertical; + looks down),
// on the bodies as the game prepares them (humanoid.js prepareHuman: the lower face lengthened)
const { prepareHuman, FACE } = await import('../../src/humanoid.js');
for (const k of ['m', 'f']) {
  const bytes = await readFile(new URL(`../../public/anim/human_${k}.glb`, import.meta.url));
  const scene = prepareHuman((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, k);
  let body = null;
  scene.traverse((o) => { if (o.isSkinnedMesh && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o; });
  const P = body.geometry.attributes.position, [eyeY, , , , chin0] = FACE[k];
  const chinY = eyeY + (chin0 - eyeY) * 1.22;
  let F = null, C = null;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (Math.abs(x) > 0.006) continue;
    if (y > eyeY + 0.02 && y < eyeY + 0.045 && (!F || z > F[1])) F = [y, z];
    if (y > chinY && y < chinY + 0.02 && (!C || z > C[1])) C = [y, z];
  }
  console.log(k, 'face pitch', Math.atan2(F[1] - C[1], F[0] - C[0]).toFixed(3), 'forehead', F, 'chin', C);
}
