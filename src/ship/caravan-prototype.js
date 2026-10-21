// Blender-authored review model; no production ship imports this module.
// Full-scale right-handed metres: bow -X, porch +Z, Y up.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bindCaravanMechanisms } from './caravan-mechanisms.js';
import { CaravanDeployment } from './caravan-deployment.js';
import { makeMaterial } from '../materials.js';
export const CARAVAN = Object.freeze({ length: 40, humanHeight: 1.75, source: '/references/The Travellers Ship/redesign/rounded-caravan-a/approved-reference.png' });
/** The authoring asset is public, so Vite serves the same URL in development and built previews. */
export const CARAVAN_MODEL_URL = `${import.meta.env?.BASE_URL ?? '/'}models/ships/caravan-a/caravan.glb`;

/** Load the authored model before marking the review ready. Failure is surfaced to the review UI. */
export async function loadCaravanPrototype({ url = CARAVAN_MODEL_URL, loader = new GLTFLoader() } = {}) {
  const gltf = await loader.loadAsync(url);
  return bindCaravanModel(gltf.scene);
}

export { bindCaravanMechanisms } from './caravan-mechanisms.js';

export function bindCaravanModel(root) {
  for (const name of ['hull', 'cockpit', 'engines', 'roof']) {
    if (!root.getObjectByName(name)) throw new Error(`Caravan model is missing ${name}`);
  }
  const parts = {};
  root.traverse(node => { if (node.name) parts[node.name] = node; });
  for (const name of ['porch-panel', 'porch-rail', 'porch-supports', 'ramp', 'porch-furniture', 'plants', 'awning', 'laundry', 'solar-panel', 'roof-ladder', 'landing-gear']) {
    if (!parts[name]?.userData.caravanMechanism) throw new Error(`Caravan model is missing mechanism ${name}`);
  }
  const apply = bindCaravanMechanisms(root);
  const materials = new Map(), originals = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = node.receiveShadow = true;
    const remap = original => {
      originals.add(original);
      const key = `${original.name}:${original.side}`;
      if (!materials.has(key)) {
        const material = makeMaterial({ color: original.color ?? '#e7d8b6', side: original.side });
        material.name = original.name; materials.set(key, material);
      }
      return materials.get(key);
    };
    node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material);
  });
  originals.forEach(material => material.dispose());
  let camp = 1;
  const deployment = new CaravanDeployment({
    applyCamp(value) { camp = value; },
    applyAltitude(altitude) { root.position.y = altitude; apply(camp, altitude); },
  });
  root.name = 'caravan-prototype';
  root.userData = { ...root.userData, prototype: true, source: CARAVAN.source, authored: true };
  return { root, parts, deployment, materials: Object.fromEntries(materials), dispose() {
    const geometries = new Set();
    root.traverse(node => { if (node.geometry) geometries.add(node.geometry); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  } };
}
