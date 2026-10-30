import * as THREE from 'three';
export { tripoHoundModel, hornPath, HORN } from '../../../../src/enemies/plans/hound-tripo.js';

// The broad-pawed hound from Tripo (issue #800 phase 2b), the author's pick: the body is the game's now
// (src/enemies/plans/hound-tripo.js, its asset public/enemies/hound/body.glb, made from this folder's tripo-lod.glb by
// ship.mjs). The trial page and its scripts still build it from this folder's own asset (the 1024² texture and
// landmarks.json, as prepare.mjs writes them), through the game's builder.

/** The trial's source, loaded once (browser): { geometry, map, landmarks }. base: this folder's URL. */
export async function loadTripoHound(base) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const get = async (name) => { const r = await fetch(`${base}${name}`); if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${base}${name} (${r.status})`); return r; };
  const [bytes, landmarks] = await Promise.all([get('tripo-lod.glb').then((r) => r.arrayBuffer()), get('landmarks.json').then((r) => r.json())]);
  const gltf = await new GLTFLoader().parseAsync(bytes, base);
  let mesh = null; gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const map = mesh.material.map; if (map) { map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true; }
  return { geometry: mesh.geometry, map, landmarks };
}
