// BVH files (e.g. the CMU database as converted by Bruce Hahne for cgspeed, or any BVH with
// Mixamo's names), read by three's BVHLoader into a take (take.js).
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { sampleSkeleton } from './skeleton-take.js';
import { mapFor } from './maps.js';

export function bvhTake(text, { fps = 30, name = 'bvh' } = {}) {
  const { skeleton, clip } = new BVHLoader().parse(text);
  const root = new THREE.Group();
  root.add(skeleton.bones[0]);
  // (BVHLoader names its tracks .bones[name]; on a plain hierarchy they bind by the bone's name)
  const tracks = clip.tracks.map((t) => { const c = t.clone(); c.name = c.name.replace(/^\.bones\[([^\]]+)\]/, '$1'); return c; });
  const c = new THREE.AnimationClip(name, clip.duration, tracks);
  const names = skeleton.bones.map((b) => b.name);
  const m = mapFor(names);
  if (!m) throw new Error(`${name}: unknown skeleton (${names.slice(0, 8).join(', ')}…)`);
  const take = sampleSkeleton(root, c, { fps, name, landmarks: m.landmarks });
  take.map = m.map;
  return take;
}
