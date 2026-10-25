// Generated-skin IO is separate from procedural motion measurements.
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createKeeperCreature } from '../../src/characters/keeper-creature.js';
import { createElderCreature } from '../../src/characters/elder-creature.js';
import { createElderCreature as createElderV3 } from '../../src/characters/elder-v3-creature.js';
import { GUARDIANS, guardianSubject, boneLegs } from './walk-procedural.mjs';

/**
 * A generated skin's GLB (public/guardians/<file>/model.glb; a prototype no page loads, such as elder-v1, under
 * data/guardians/: issue #300) parsed in node, its materials and textures left out.
 */
export async function loadSkin(file) {
  globalThis.ProgressEvent ??= class { constructor(type, x) { this.type = type; Object.assign(this, x); } };
  const at = (dir) => new URL(`../../${dir}/guardians/${file}/model.glb`, import.meta.url);
  const bytes = fs.readFileSync(fs.existsSync(at('public')) ? at('public') : at('data')), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
  for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  delete json.materials; delete json.textures; delete json.images;
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
/**
 * The generated skins (src/characters/*-creature.js) joined to GUARDIANS: the Rose House's Keeper (issue #267, live), the
 * Elder's first prototype (issue #237) and the Aerie's Elder (elder-v3, live since v1.67), measured on their own bones
 * (boneLegs). Loaded once.
 */
let skinsAdded = null;
export function addGeneratedSkins() {
  return (skinsAdded ??= Promise.all([loadSkin('keeper-v1'), loadSkin('elder-v1'), loadSkin('elder-v3')]).then(([keeper, elder, elder3]) => {
    GUARDIANS['keeper (generated)'] = (pace) => guardianSubject(() => createKeeperCreature(keeper), boneLegs, 2.2, pace);
    GUARDIANS['elder (generated)'] = (pace) => guardianSubject(() => createElderCreature(elder), boneLegs, 1.8, pace);
    // (the Aerie's Elder since v1.67, the natural-wing body: src/characters/elder-v3-creature.js)
    GUARDIANS['elder v3 (generated)'] = (pace) => guardianSubject(() => createElderV3(elder3), boneLegs, 1.8, pace);
  }));
}
