// Blender-authored review model; no production ship imports this module.
// Full-scale right-handed metres: bow -X, porch +Z, Y up.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CaravanDeployment, caravanStowPose } from './caravan-deployment.js';
import { makeMaterial } from '../materials.js';
export const CARAVAN = Object.freeze({ length: 40, humanHeight: 1.75, source: '/references/The Travellers Ship/redesign/rounded-caravan-a/approved-reference.png' });
/** The authoring asset is public, so Vite serves the same URL in development and built previews. */
export const CARAVAN_MODEL_URL = `${import.meta.env?.BASE_URL ?? '/'}models/ships/caravan-a/caravan.glb`;

/** Load the authored model before marking the review ready. Failure is surfaced to the review UI. */
export async function loadCaravanPrototype({ url = CARAVAN_MODEL_URL, loader = new GLTFLoader() } = {}) {
  const gltf = await loader.loadAsync(url);
  return bindCaravanModel(gltf.scene);
}

/** Authored open transforms stay intact; extras supply closed deltas in each pivot's local axes. */
export function bindCaravanMechanisms(root) {
  const stages = new Set([...Object.keys(caravanStowPose(0)), 'gear']);
  const mechanisms = [];
  root.traverse(node => {
    const spec = node.userData.caravanMechanism;
    if (!spec) return;
    if (!spec.range && !stages.has(spec.stage)) throw new Error(`Unknown caravan mechanism stage: ${node.name}`);
    const vector = (value, fallback) => {
      const values = value ?? fallback;
      if (!Array.isArray(values) || values.length !== 3 || !values.every(Number.isFinite)) throw new Error(`Invalid caravan transform: ${node.name}`);
      return new THREE.Vector3(...values);
    };
    if (spec.range && (!Array.isArray(spec.range) || spec.range.length !== 2 || !spec.range.every(Number.isFinite) || spec.range[0] < 0 || spec.range[1] > 1 || spec.range[0] >= spec.range[1])) throw new Error(`Invalid caravan range: ${node.name}`);
    const rotation = vector(spec.closedRotation, [0, 0, 0]);
    mechanisms.push({ node, spec, position: node.position.clone(), scale: node.scale.clone(), quaternion: node.quaternion.clone(),
      offset: vector(spec.closedOffset, [0, 0, 0]), closedScale: vector(spec.closedScale, [1, 1, 1]),
      closedQuaternion: node.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.toArray()))),
    });
  });
  return (camp, altitude) => {
    const pose = caravanStowPose(camp);
    for (const m of mechanisms) {
      const open = m.spec.range ? THREE.MathUtils.smoothstep(camp, ...m.spec.range)
        : m.spec.stage === 'gear' ? 1 - THREE.MathUtils.clamp(altitude / 4, 0, 1) : pose[m.spec.stage];
      m.node.position.copy(m.position).addScaledVector(m.offset, 1 - open);
      m.node.quaternion.slerpQuaternions(m.closedQuaternion, m.quaternion, open);
      m.node.scale.copy(m.closedScale).lerp(new THREE.Vector3(1, 1, 1), open).multiply(m.scale);
      m.node.visible = !m.spec.hideClosed || open > 0;
    }
  };
}

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
