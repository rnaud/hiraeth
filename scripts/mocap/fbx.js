// FBX files (Mixamo's downloads: FBX Binary, Without Skin), read by three's FBXLoader in Node into
// a take (take.js). FBXLoader only needs a few browser globals to construct (a texture loader it
// never uses without a skin): the same minimal DOM the world exporter uses
// (scripts/unity-export/shim.mjs).
import '../unity-export/shim.mjs';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { sampleSkeleton } from './skeleton-take.js';
import { mapFor } from './maps.js';

const strip = (n) => n.replace(/^mixamorig\d*[:_]?/, '');

/** @param buffer the file's bytes (ArrayBuffer); o.clip which animation (default the longest) */
export function fbxTake(buffer, { fps = 30, name = 'fbx', clip: which = null } = {}) {
  const quiet = console.warn; console.warn = () => {};
  let group;
  try { group = new FBXLoader().parse(buffer, ''); } finally { console.warn = quiet; }
  // names without the rig's prefix (the tracks too)
  group.traverse((o) => { o.name = strip(o.name); });
  const anims = group.animations ?? [];
  if (!anims.length) throw new Error(`${name}: no animation in the file`);
  const src = which ? anims.find((a) => a.name === which) : anims.reduce((a, b) => (b.duration > a.duration ? b : a));
  const tracks = src.tracks.map((t) => { const c = t.clone(); const dot = c.name.lastIndexOf('.'); c.name = strip(c.name.slice(0, dot)) + c.name.slice(dot); return c; });
  const names = [];
  group.traverse((o) => { if (o.isBone || o.type === 'Bone') names.push(o.name); });
  const m = mapFor(names);
  if (!m) throw new Error(`${name}: unknown skeleton (${names.slice(0, 8).join(', ')}…)`);
  // the rest pose is the file's bind pose (Mixamo's T-pose), as loaded before any frame is played
  const take = sampleSkeleton(group, new THREE.AnimationClip(name, src.duration, tracks), { fps, name, landmarks: m.landmarks, bones: names });
  take.map = m.map;
  return take;
}
