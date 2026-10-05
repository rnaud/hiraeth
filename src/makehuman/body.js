// The MakeHuman prototype's bodies (docs/makehuman.md): an alternative body source, in the
// character studio only. scripts/makehuman/build.py makes one GLB per person (public/anim/mh/:
// MPFB's base mesh with the person's age, sex and build, the 'game_engine' skeleton with the
// game's bone names, T-posed, the hips where the Quaternius man's are, the face's shape keys) and
// a manifest of what it measured on each (people.json: the face ink's landmarks, the outfit's
// regions, the ears, the skull for the hair, the person's real size).
//
// prepareMakeHuman() makes a loaded one a Humanoid template, as prepareHuman() does the Quaternius
// ones: the eyeballs measured for eyes.js, and a profile the Humanoid reads instead of its
// per-kind tables (humanoid.js: face, outfit, earZ, headFrame, headScale, faceKeys).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { eyeballOf } from '../eyes.js';
import { skullPoint } from '../costumes.js';
import { faceKeysFor } from './face-keys.js';

/** The game's bone names a body must have (humanoid.js, feet.js, costumes' frames). */
export const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'middle_01_l', 'index_01_l', 'pinky_01_l', 'thigh_l', 'calf_l', 'foot_l', 'ball_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'middle_01_r', 'index_01_r', 'pinky_01_r', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];

/** How much a costume's head pieces (fitted to the Quaternius skull of `kind`) scale to fit this skull: [x, y, z]. */
export function headScale(skull, kind = 'm') {
  const sx = skullPoint(kind, 90, 0)[0], sy = skullPoint(kind, 0, 90)[1];
  const front = skullPoint(kind, 0, 0)[2], back = -skullPoint(kind, 180, 0)[2];
  return [skull.x / sx, skull.y / sy, (skull.front + skull.back) / (front + back)];
}

/** A loaded MakeHuman GLB (its scene) made into a Humanoid template, with its manifest entry. */
export function prepareMakeHuman(scene, entry) {
  scene.updateMatrixWorld(true);
  let eyes = null;
  const names = new Set();
  scene.traverse((o) => {
    if (o.isBone) names.add(o.name);
    if (o.isMesh && /eye/i.test(o.name) && !/brow/i.test(o.name)) eyes = o;
  });
  const missing = BONES.filter((b) => !names.has(b));
  if (missing.length) throw new Error(`MakeHuman body ${entry.id}: no bones ${missing.join(', ')}`);
  if (eyes) eyes.userData.eyeball = eyeballOf(eyes.geometry, entry.face[0]);
  scene.userData.profile = {
    id: `mh:${entry.id}`, source: 'makehuman', entry,
    face: entry.face, outfit: entry.outfit, earZ: entry.earZ, headFrame: entry.headFrame,
    headScale: (kind) => headScale(entry.skull, kind),
    faceKeys: faceKeysFor,
  };
  return scene;
}

const manifests = new Map(), bodies = new Map();
/** The manifest (public/anim/mh/people.json). */
export function loadMakeHumanManifest(base = '/') {
  if (!manifests.has(base)) manifests.set(base, fetch(`${base}anim/mh/people.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`people.json: ${r.status}`)))));
  return manifests.get(base);
}
/** A person's body as a Humanoid template (cached). */
export function loadMakeHuman(entry, base = '/') {
  const key = `${base}|${entry.id}`;
  if (!bodies.has(key)) bodies.set(key, new GLTFLoader().loadAsync(`${base}anim/mh/${entry.id}.glb`).then((g) => prepareMakeHuman(g.scene, entry)));
  return bodies.get(key);
}
