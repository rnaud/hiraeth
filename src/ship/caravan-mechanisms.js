import * as THREE from 'three';
import { caravanStowPose } from './caravan-deployment.js';

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

